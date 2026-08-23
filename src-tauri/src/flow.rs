// Cliente de Flow (C:\DEV\Flow) para el escritorio de Pancho OS.
//
// Flow es la app local de dictado y reuniones (Python/FastAPI) que ya corre en
// la maquina de Pancho en el puerto 5000. NO se reimplementa captura de audio
// ni hotkeys aca: el escritorio solo la consume como cliente HTTP. El codigo de
// Flow vive en otro repo y no se toca.
//
// Decisiones de este modulo:
//   1. Se apunta a 127.0.0.1 y no a "localhost". En esta maquina la resolucion
//      de "localhost" puede irse por IPv6 (::1) y colgar el fetch varios
//      segundos, mismo problema que ya se corrigio en el server de produccion.
//   2. Las respuestas se devuelven como serde_json::Value sin tipar. El
//      contrato de Flow es de otro repo y puede cambiar; tipar aca haria que un
//      cambio menor en Flow rompa la compilacion del escritorio. El tipado
//      "util" vive en desktopBridge.ts, del lado del frontend.
//   3. Todo error se devuelve como FlowError serializable, nunca panic. Si Flow
//      no esta corriendo el frontend recibe codigo "flow_no_corriendo" y puede
//      mostrar "Flow no esta corriendo" en vez de romper la app.
//   4. El timeout NO es uno solo para todo. Los GET son pings baratos y usan un
//      presupuesto corto, pero los POST de grabacion son operaciones pesadas del
//      lado de Flow y necesitan mucho mas aire (ver TIMEOUT_STOP abajo). Meter
//      todo en 3s hacia que la accion normal de cortar una reunion se reportara
//      como "Flow no esta corriendo" mientras Flow seguia trabajando.
//   5. "Flow apagado" y "Flow ocupado" son errores distintos y se devuelven con
//      codigos distintos ("flow_no_corriendo" vs "flow_timeout"). No es cosmetico:
//      ante un timeout la accion puede haber seguido su curso del lado de Flow,
//      asi que la UI debe reconsultar el estado, no decirle al usuario que
//      reinicie Flow en medio de un mix de varios cientos de MB.

use std::sync::OnceLock;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::Value;

// Base de la API local de Flow. Sin autenticacion: Flow confia en localhost.
const FLOW_BASE: &str = "http://127.0.0.1:5000";

// Presupuesto de conexion, comun a lecturas y escrituras.
//
// INVARIANTE: TIMEOUT_CONEXION tiene que ser MENOR que todos los timeouts
// totales de abajo, y esta cubierto por un test. Medido en esta maquina:
// conectar a un puerto cerrado de loopback en Windows no devuelve RST al
// instante, se queda reintentando ~2s. Si el timeout total de una llamada
// fuera mas corto que el de conexion, el que venceria primero seria el total,
// y "Flow apagado" se reportaria como "Flow ocupado", que es justo el error que
// no queremos. Con 800ms el corte lo da siempre la capa de conexion, que es la
// que reqwest clasifica como is_connect().
const TIMEOUT_CONEXION: Duration = Duration::from_millis(800);

// Lecturas (health, inbox, meetings, recording-status): son consultas baratas.
// Si no contestan en 3s algo esta mal y preferimos pintar el estado en la UI
// antes que dejar un spinner colgado.
const TIMEOUT_GET: Duration = Duration::from_secs(3);

// start-recording: Flow enumera los dispositivos de audio de Windows
// (recorder.resolve_mic_index) y abre los streams antes de contestar, y lo hace
// bloqueando su propio event loop. Con equipos con muchos dispositivos esto pasa
// de 3s sin ningun problema.
const TIMEOUT_START: Duration = Duration::from_secs(15);

// stop-recording: es la llamada mas pesada de toda la integracion. Del lado de
// Flow hace, en orden y de forma sincronica: live_transcript.stop(timeout=15),
// dos joins de threads de 3s y el mix final de los canales. El mix de una
// reunion de 3 horas mueve ~350 MB por canal. 120s es una decision de producto:
// cubre la reunion larga tipica sin dejar la promesa abierta para siempre. Si
// igual se pasa, el frontend recibe "flow_timeout" (no "apagado") y debe
// reconsultar recording-status en vez de asumir que fallo.
const TIMEOUT_STOP: Duration = Duration::from_secs(120);

/// Error tipado que el frontend puede mostrar sin adivinar.
///
/// codigo:
///   - "flow_no_corriendo": no se pudo abrir la conexion (Flow apagado).
///   - "flow_timeout": Flow esta arriba pero no contesto dentro del limite. Ojo:
///     la operacion puede haber seguido corriendo del lado de Flow.
///   - "flow_http": Flow contesto pero con status de error (4xx/5xx).
///   - "flow_respuesta_invalida": contesto 2xx pero el cuerpo no es JSON.
///   - "flow_cliente": no se pudo construir el cliente HTTP.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowError {
  pub codigo: String,
  pub mensaje: String,
  /// Status HTTP cuando aplica (solo en codigo "flow_http").
  #[serde(skip_serializing_if = "Option::is_none")]
  pub status: Option<u16>,
}

impl FlowError {
  fn nuevo(codigo: &str, mensaje: impl Into<String>) -> Self {
    Self { codigo: codigo.to_string(), mensaje: mensaje.into(), status: None }
  }

  fn http(status: u16, mensaje: impl Into<String>) -> Self {
    Self { codigo: "flow_http".to_string(), mensaje: mensaje.into(), status: Some(status) }
  }

  /// Traduce el error de reqwest a algo que el frontend entienda.
  ///
  /// El orden importa: en reqwest un timeout DE CONEXION reporta is_connect() y
  /// is_timeout() a la vez. Se pregunta primero por conexion para no etiquetar
  /// de "lento" a un Flow que en realidad esta apagado, y para que lo que quede
  /// en is_timeout() sea de verdad "conecte, pero tardo".
  fn desde_reqwest(err: reqwest::Error) -> Self {
    if err.is_connect() {
      return Self::nuevo(
        "flow_no_corriendo",
        format!("No se pudo conectar con Flow en {FLOW_BASE}. Revisa que Flow este abierto."),
      );
    }
    if err.is_timeout() {
      return Self::nuevo(
        "flow_timeout",
        "Flow esta abierto pero no respondio a tiempo. Puede estar ocupado \
         procesando audio. La operacion puede haber continuado del lado de Flow: \
         revisa el estado antes de reintentar.",
      );
    }
    Self::nuevo("flow_cliente", err.to_string())
  }
}

/// Cliente compartido para reusar conexiones entre llamadas.
fn cliente() -> Result<&'static reqwest::Client, FlowError> {
  static CLIENTE: OnceLock<Option<reqwest::Client>> = OnceLock::new();

  let creado = CLIENTE.get_or_init(|| {
    reqwest::Client::builder()
      // Default conservador: cada llamada fija ademas su propio limite con
      // RequestBuilder::timeout, que pisa a este. El default queda como red de
      // seguridad para que ninguna ruta futura quede sin acotar.
      .timeout(TIMEOUT_GET)
      .connect_timeout(TIMEOUT_CONEXION)
      // Flow es local: no queremos que un proxy corporativo o de sistema se
      // meta en el medio y agregue latencia o falle.
      .no_proxy()
      .build()
      .ok()
  });

  creado
    .as_ref()
    .ok_or_else(|| FlowError::nuevo("flow_cliente", "No se pudo construir el cliente HTTP."))
}

/// Ejecuta la request y normaliza status + cuerpo.
async fn ejecutar(req: reqwest::RequestBuilder) -> Result<Value, FlowError> {
  let respuesta = req.send().await.map_err(FlowError::desde_reqwest)?;
  let status = respuesta.status();
  let cuerpo = respuesta.text().await.map_err(FlowError::desde_reqwest)?;

  if !status.is_success() {
    let detalle = if cuerpo.trim().is_empty() {
      format!("Flow respondio {status}.")
    } else {
      // Se recorta para no volcar un stacktrace entero en la UI.
      let recorte: String = cuerpo.chars().take(500).collect();
      format!("Flow respondio {status}: {recorte}")
    };
    return Err(FlowError::http(status.as_u16(), detalle));
  }

  // Cuerpo vacio en un 2xx se trata como null, no como error.
  if cuerpo.trim().is_empty() {
    return Ok(Value::Null);
  }

  serde_json::from_str::<Value>(&cuerpo).map_err(|err| {
    FlowError::nuevo("flow_respuesta_invalida", format!("Flow no devolvio JSON valido: {err}"))
  })
}

async fn get(ruta: &str) -> Result<Value, FlowError> {
  let url = format!("{FLOW_BASE}{ruta}");
  ejecutar(cliente()?.get(url).timeout(TIMEOUT_GET)).await
}

/// El limite va explicito por llamada: no existe un presupuesto que sirva para
/// arrancar y para cortar una grabacion a la vez.
async fn post(ruta: &str, cuerpo: Option<Value>, limite: Duration) -> Result<Value, FlowError> {
  let url = format!("{FLOW_BASE}{ruta}");
  let req = cliente()?.post(url).timeout(limite);
  let req = match cuerpo {
    Some(json) => req.json(&json),
    None => req,
  };
  ejecutar(req).await
}

/// GET /api/system/health
/// Sirve de ping: si esto falla, Flow no esta corriendo.
#[tauri::command]
pub async fn flow_health() -> Result<Value, FlowError> {
  get("/api/system/health").await
}

/// GET /api/dictation/inbox?limit=N
/// Devuelve { total, offset, limit, items: [...] }.
#[tauri::command]
pub async fn flow_list_dictations(limit: Option<i32>) -> Result<Value, FlowError> {
  // Se acota el limite para no traer 2000 dictados de golpe a la UI.
  let n = limit.unwrap_or(20).clamp(1, 200);
  get(&format!("/api/dictation/inbox?limit={n}")).await
}

/// GET /api/meetings
/// Devuelve un arreglo de reuniones (no un objeto con items, ojo).
#[tauri::command]
pub async fn flow_list_meetings() -> Result<Value, FlowError> {
  get("/api/meetings").await
}

/// GET /api/meetings/recording-status
/// Estado en vivo de la grabacion. Util para saber si ya hay una corriendo
/// antes de ofrecer el boton de grabar.
#[tauri::command]
pub async fn flow_recording_status() -> Result<Value, FlowError> {
  get("/api/meetings/recording-status").await
}

/// POST /api/meetings/start-recording
/// Body RecordingStart. Se manda explicito el default de Flow (mic + audio del
/// sistema) para no depender de que ese default no cambie del otro lado.
/// Devuelve { meeting_id, status, channels, mic_label, system_label }: el
/// meeting_id de ahi es el que despues hay que pasarle a flow_stop_recording.
#[tauri::command]
pub async fn flow_start_recording() -> Result<Value, FlowError> {
  post(
    "/api/meetings/start-recording",
    Some(serde_json::json!({ "use_mic": true, "use_system": true })),
    TIMEOUT_START,
  )
  .await
}

/// POST /api/meetings/stop-recording/{mid}
///
/// Es la llamada lenta de la integracion (ver TIMEOUT_STOP). Si igual se vence
/// el limite, el error es "flow_timeout" y no "flow_no_corriendo": Flow sigue
/// cerrando la reunion aunque nosotros hayamos soltado la conexion, y abortar
/// del lado del cliente no cancela su trabajo.
#[tauri::command]
pub async fn flow_stop_recording(meeting_id: String) -> Result<Value, FlowError> {
  let id = meeting_id.trim();
  if id.is_empty() {
    return Err(FlowError::nuevo("flow_cliente", "Falta el id de la reunion."));
  }
  // El id va en el path: se valida que sea numerico para no armar una URL rara.
  if !id.chars().all(|c| c.is_ascii_digit()) {
    return Err(FlowError::nuevo("flow_cliente", "El id de la reunion debe ser numerico."));
  }
  post(&format!("/api/meetings/stop-recording/{id}"), None, TIMEOUT_STOP).await
}

#[cfg(test)]
mod tests {
  use super::*;

  fn cliente_de_prueba() -> reqwest::Client {
    reqwest::Client::builder()
      .timeout(TIMEOUT_GET)
      .connect_timeout(TIMEOUT_CONEXION)
      .no_proxy()
      .build()
      .expect("cliente de prueba")
  }

  /// Protege la invariante que hace que la clasificacion de errores funcione.
  /// Si algun timeout total baja por debajo del de conexion, un Flow apagado
  /// pasaria a reportarse como "flow_timeout" (ocupado) en vez de apagado.
  #[test]
  fn el_timeout_de_conexion_es_el_mas_corto() {
    for (nombre, limite) in [
      ("TIMEOUT_GET", TIMEOUT_GET),
      ("TIMEOUT_START", TIMEOUT_START),
      ("TIMEOUT_STOP", TIMEOUT_STOP),
    ] {
      assert!(limite > TIMEOUT_CONEXION, "{nombre} debe superar a TIMEOUT_CONEXION");
    }
  }

  /// Flow apagado: no se llega a abrir la conexion.
  #[tokio::test]
  async fn puerto_cerrado_es_flow_no_corriendo() {
    // Se abre y se cierra para quedarse con un puerto que seguro no escucha.
    let puerto = {
      let l = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
      l.local_addr().unwrap().port()
    };

    // Se usa el presupuesto real de un GET (3s), no uno inventado: en Windows
    // conectar a un puerto cerrado de loopback no da RST instantaneo, tarda ~2s
    // reintentando. Con un timeout total mas corto que TIMEOUT_CONEXION el caso
    // se clasificaria mal, y esa combinacion no existe en el codigo real.
    let err = cliente_de_prueba()
      .get(format!("http://127.0.0.1:{puerto}/api/system/health"))
      .timeout(TIMEOUT_GET)
      .send()
      .await
      .expect_err("deberia fallar la conexion");

    let flow_err = FlowError::desde_reqwest(err);
    assert_eq!(flow_err.codigo, "flow_no_corriendo", "mensaje: {}", flow_err.mensaje);
  }

  /// Flow abierto pero ocupado: acepta la conexion y no contesta. Es el caso
  /// real de stop-recording mezclando audio. NO debe reportarse como apagado.
  #[tokio::test]
  async fn servidor_que_no_contesta_es_flow_timeout() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let puerto = listener.local_addr().unwrap().port();

    std::thread::spawn(move || {
      // Acepta y se queda callado: la conexion se abre, la respuesta nunca llega.
      if let Ok((socket, _)) = listener.accept() {
        std::thread::sleep(Duration::from_secs(5));
        drop(socket);
      }
    });

    let err = cliente_de_prueba()
      .post(format!("http://127.0.0.1:{puerto}/api/meetings/stop-recording/1"))
      .timeout(Duration::from_millis(500))
      .send()
      .await
      .expect_err("deberia vencer el timeout");

    let flow_err = FlowError::desde_reqwest(err);
    assert_eq!(flow_err.codigo, "flow_timeout", "mensaje: {}", flow_err.mensaje);
  }
}
