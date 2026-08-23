// Cliente A2A de Hermes para el escritorio de Pancho OS.
//
// Hermes es el agente personal de Pancho. Corre en la laptop como proceso
// aparte ("hermes gateway run") y expone un servidor A2A (Agent2Agent) en su IP
// de Tailscale. El escritorio NO reimplementa nada de Hermes: lo consume como
// cliente A2A, igual que flow.rs consume a Flow.
//
// Todo lo que hay en este archivo esta verificado contra la implementacion real
// que corre en la laptop (plugins/platforms/a2a/{protocol,adapter,security}.py
// dentro del home de Hermes), no contra el spec generico de A2A. Donde el spec
// publico y la build de Pancho difieren, mandan los archivos de la laptop.
//
// ---------------------------------------------------------------------------
// CONFIGURACION QUE PANCHO TIENE QUE HACER A MANO (nada de esto es automatico)
// ---------------------------------------------------------------------------
// El escritorio necesita un token de peer propio para hablarle a Hermes. Hoy no
// existe: Hermes solo conoce a "pancho-vps" y "pancho-homelab". Son tres pasos,
// todos del lado de Hermes, y despues uno del lado del OS.
//
// En el .env de Hermes de la laptop (C:\Users\Francisco\AppData\Local\hermes\.env):
//
//   1. Generar un token nuevo y guardarlo en su propia variable, siguiendo el
//      patron de las que ya existen (A2A_VPS_PEER_TOKEN, A2A_HOMELAB_PEER_TOKEN):
//
//        A2A_OS_PEER_TOKEN=<token nuevo>
//
//   2. Agregar el peer a A2A_PEER_TOKENS. OJO: esta es la variable que el
//      servidor de verdad parsea (security.get_peer_tokens lee A2A_PEER_TOKENS y
//      nada mas). Las variables sueltas del paso 1 son solo para tenerlas
//      ordenadas; por si solas NO autentican a nadie. El formato es
//      "nombre:token" separado por comas:
//
//        A2A_PEER_TOKENS=pancho-vps:...,pancho-homelab:...,pancho-os:<token nuevo>
//
//   3. Agregar el peer a A2A_TRUSTED_PEERS. Sin esto el token autentica pero el
//      gate de confianza rechaza la llamada con -32052 "peer not trusted":
//
//        A2A_TRUSTED_PEERS=pancho-vps,pancho-homelab,pancho-os
//
//   Despues reiniciar el gateway de Hermes de la laptop para que relea el .env.
//
// Del lado del OS, pegar ese MISMO token en el archivo de config local (ver
// ruta_config mas abajo). Ese archivo no esta en git y no debe estarlo.
//
// El nombre "pancho-os" es el que Hermes va a ver como identidad del peer y el
// que va a quedar registrado en su a2a_audit.jsonl. Si Pancho prefiere otro, los
// pasos 2 y 3 tienen que usar el mismo string.
//
// ---------------------------------------------------------------------------
// Decisiones de este modulo
// ---------------------------------------------------------------------------
//  1. El agent card es publico y se pide SIN Authorization. Verificado en vivo
//     contra la laptop: GET /.well-known/agent.json devuelve 200 sin credencial
//     (adapter.do_GET responde el card antes de cualquier chequeo de auth). Por
//     eso hermes_agent_card sirve de ping y de diagnostico: si el card responde
//     pero la llamada real da 401, el problema es el token, no la red.
//
//  2. Se usa el metodo JSON-RPC "message/send". La build de Pancho acepta los
//     dos nombres (_method_info mapea "message/send" y "SendMessage" a la misma
//     operacion), pero difieren en la RESPUESTA: "SendMessage" envuelve el
//     resultado en {"task": {...}} y "message/send" devuelve el Task pelado.
//     Se parsea tolerando las dos formas para que el dia que se cambie el nombre
//     del metodo no haya que tocar el parser.
//
//  3. Los Parts van en la forma v1.0 ({"text": ..., "mediaType": ...}), sin el
//     campo "kind" de v0.3. Es lo que construye protocol.text_part en la build
//     que corre hoy. Al leer se toleran las dos formas.
//
//  4. NO se manda la cabecera "A2A-Version". El adapter la valida SOLO si viene
//     ("unsupported A2A-Version" si no es 1.0/1.0.0). Mandarla no aporta nada y
//     nos ata a que Hermes nunca suba de version: si mañana Hermes va a 1.1,
//     omitirla sigue funcionando y mandarla nos rompe. Omitir es la opcion que
//     no se puede volver en contra.
//
//  5. message/send es SINCRONICO Y BLOQUEANTE. Esto es lo mas importante de todo
//     el archivo. Hermes no contesta "recibido": se queda con la conexion HTTP
//     abierta hasta que el agente termina de pensar, y recien ahi responde
//     (adapter._rpc_message_send llama a _await_reply antes de contestar). Su
//     presupuesto propio es A2A_REPLY_TIMEOUT, 300s por defecto. Ver TIMEOUT_CALL.
//
//  6. Ningun camino hace panic. Todo error sale como HermesError serializable
//     con un codigo que el frontend puede mapear a un mensaje util. Falta de
//     token NO es un caso excepcional: es el estado normal hasta que Pancho haga
//     la configuracion de arriba, y devuelve un mensaje que dice exactamente
//     que archivo crear.

use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::OnceLock;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::Manager;

// Endpoint A2A de Hermes en la laptop. Es la IP de Tailscale, no localhost:
// Hermes bindea a su IP de tailnet a proposito y no a 0.0.0.0 (la laptop viaja a
// redes ajenas). Si Tailscale esta caido esto no resuelve y el error correcto es
// "hermes_no_alcanzable", no "token mal configurado".
const HERMES_A2A_URL: &str = "http://100.106.81.110:9900/";
const HERMES_AGENT_CARD_URL: &str = "http://100.106.81.110:9900/.well-known/agent.json";

// Presupuesto de conexion. Mas holgado que el de Flow (que es loopback): esto
// sale por Tailscale y el handshake puede tardar mas, sobre todo si la laptop
// acaba de despertar. Igual que en flow.rs, tiene que ser MENOR que todos los
// timeouts totales de abajo para que un Hermes apagado se clasifique como
// inalcanzable y no como lento. Hay un test que lo protege.
const TIMEOUT_CONEXION: Duration = Duration::from_secs(3);

// Agent card: es un GET barato que arma un dict en memoria. Si no contesta en
// 5s, Hermes no esta sano.
const TIMEOUT_CARD: Duration = Duration::from_secs(5);

// message/send: el limite se elige para MORIR DESPUES que Hermes, no antes.
//
// Hermes bloquea hasta A2A_REPLY_TIMEOUT (300s por defecto) y, si el agente no
// contesto en ese plazo, igual responde 200 con un Task en TASK_STATE_FAILED y
// el texto "[agent did not reply in time]". Ese es un error UTIL: dice que
// Hermes lo recibio y no pudo. Si nosotros cortaramos antes de los 300s
// perderiamos esa respuesta y la cambiariamos por un timeout de cliente ciego,
// que no distingue "Hermes no contesto" de "la red se cayo". Por eso 315s: los
// 300s de Hermes mas margen para la red. El costo es que la peor espera posible
// es larga, y por eso la UI debe mostrar progreso, no un spinner mudo.
const TIMEOUT_CALL: Duration = Duration::from_secs(315);

/// Error tipado que el frontend puede mostrar sin adivinar.
///
/// codigo:
///   - "hermes_sin_token": no hay archivo de config o no tiene token. Es el
///     estado inicial esperado, no una falla. El mensaje trae la ruta exacta.
///   - "hermes_config_invalida": el archivo existe pero no se pudo leer o no
///     tiene la forma esperada. Nunca se ignora en silencio.
///   - "hermes_no_alcanzable": no se pudo abrir la conexion (Hermes apagado o
///     Tailscale caido).
///   - "hermes_timeout": conecto pero no contesto dentro del limite. Hermes
///     puede seguir trabajando la tarea del otro lado.
///   - "hermes_no_autorizado": Hermes rechazo la credencial (401/403). Token mal
///     copiado, o el peer no esta en A2A_TRUSTED_PEERS.
///   - "hermes_rpc": Hermes contesto 200 pero con un error JSON-RPC. El campo
///     rpc_code trae el codigo original.
///   - "hermes_http": status HTTP de error que no es de auth.
///   - "hermes_respuesta_invalida": contesto 2xx pero el cuerpo no es el JSON-RPC
///     que esperamos.
///   - "hermes_cliente": no se pudo construir el cliente HTTP o el argumento
///     estaba mal.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HermesError {
  pub codigo: String,
  pub mensaje: String,
  /// Status HTTP cuando aplica.
  #[serde(skip_serializing_if = "Option::is_none")]
  pub status: Option<u16>,
  /// Codigo de error JSON-RPC cuando aplica (solo en codigo "hermes_rpc").
  /// Los que define esta build de Hermes: -32050 no autorizado, -32051 rate
  /// limit, -32052 peer no confiable, -32601 metodo desconocido.
  #[serde(skip_serializing_if = "Option::is_none")]
  pub rpc_code: Option<i64>,
}

impl HermesError {
  fn nuevo(codigo: &str, mensaje: impl Into<String>) -> Self {
    Self { codigo: codigo.to_string(), mensaje: mensaje.into(), status: None, rpc_code: None }
  }

  fn http(codigo: &str, status: u16, mensaje: impl Into<String>) -> Self {
    Self {
      codigo: codigo.to_string(),
      mensaje: mensaje.into(),
      status: Some(status),
      rpc_code: None,
    }
  }

  fn rpc(code: i64, mensaje: impl Into<String>) -> Self {
    Self {
      codigo: "hermes_rpc".to_string(),
      mensaje: mensaje.into(),
      status: None,
      rpc_code: Some(code),
    }
  }

  /// Traduce el error de reqwest.
  ///
  /// El orden importa y es el mismo criterio que en flow.rs: reqwest reporta
  /// is_connect() y is_timeout() a la vez cuando lo que vencio fue el timeout DE
  /// CONEXION. Se pregunta primero por conexion para no etiquetar de "lento" a
  /// un Hermes que en realidad esta apagado.
  fn desde_reqwest(err: reqwest::Error) -> Self {
    if err.is_connect() {
      return Self::nuevo(
        "hermes_no_alcanzable",
        format!(
          "No se pudo conectar con Hermes en {HERMES_A2A_URL}. Revisa que Hermes \
           este corriendo en la laptop y que Tailscale este conectado."
        ),
      );
    }
    if err.is_timeout() {
      return Self::nuevo(
        "hermes_timeout",
        "Hermes recibio la llamada pero no respondio a tiempo. La tarea puede \
         seguir corriendo de su lado: revisa antes de reintentar para no \
         mandarla dos veces.",
      );
    }
    Self::nuevo("hermes_cliente", err.to_string())
  }
}

// ---------------------------------------------------------------------------
// Config local: donde vive el token
// ---------------------------------------------------------------------------

/// Nombre del archivo de config dentro del directorio de config de la app.
const ARCHIVO_CONFIG: &str = "hermes.json";

/// Ruta esperada del archivo con el token.
///
/// Resuelve al directorio de config de la app segun el identifier de
/// tauri.conf.json (com.franciscoabad.panchoos). En Windows eso cae en
/// %APPDATA%\com.franciscoabad.panchoos\hermes.json.
///
/// Se eligio un archivo JSON plano y no tauri-plugin-store por dos razones:
/// Pancho tiene que PEGAR el token a mano, y un archivo de texto se abre con
/// cualquier editor; y ademas evita sumar un plugin nuevo con su entrada de ACL
/// en capabilities/default.json (hoy ese schema solo conoce core, autostart, log
/// y notification, ver el comentario en lib.rs).
///
/// Formato esperado:
///   { "token": "<el mismo token que quedo en A2A_PEER_TOKENS de Hermes>" }
///
/// Este archivo tiene una credencial: no va a git y no se loguea su contenido.
fn ruta_config(app: &tauri::AppHandle) -> Result<PathBuf, HermesError> {
  app
    .path()
    .app_config_dir()
    .map(|dir| dir.join(ARCHIVO_CONFIG))
    .map_err(|err| {
      HermesError::nuevo(
        "hermes_config_invalida",
        format!("No se pudo resolver el directorio de config de la app: {err}"),
      )
    })
}

/// Lee el token del archivo de config.
///
/// Cualquier problema devuelve un error ACCIONABLE que nombra la ruta exacta y
/// el formato. Nunca hace panic y nunca descarta el archivo en silencio: se
/// tolera tanto el JSON con clave "token" como un archivo que contenga
/// unicamente el token pelado, pero cualquier otra cosa se reporta como error
/// explicito en vez de tratarse como "no hay token".
///
/// Esa tolerancia es a proposito y viene de un incendio previo del ecosistema
/// Hermes: en connection.json del Hermes Desktop, un token guardado como string
/// donde se esperaba un objeto se descartaba SIN AVISAR, y el sintoma que veia
/// el usuario era un 401 sin explicacion. Aca preferimos aceptar las dos formas
/// razonables y, si igual no se entiende, decirlo fuerte.
fn leer_token(app: &tauri::AppHandle) -> Result<String, HermesError> {
  let ruta = ruta_config(app)?;
  let ruta_txt = ruta.display().to_string();

  let sin_token = |detalle: &str| {
    HermesError::nuevo(
      "hermes_sin_token",
      format!(
        "Configura el token de Hermes en {ruta_txt}. {detalle} El archivo debe \
         contener {{\"token\": \"<token>\"}} y el token tiene que ser el mismo \
         que quede en A2A_PEER_TOKENS del .env de Hermes en la laptop."
      ),
    )
  };

  if !ruta.exists() {
    return Err(sin_token("El archivo todavia no existe."));
  }

  let crudo = std::fs::read_to_string(&ruta).map_err(|err| {
    HermesError::nuevo(
      "hermes_config_invalida",
      format!("No se pudo leer {ruta_txt}: {err}. Revisa permisos del archivo."),
    )
  })?;

  let texto = crudo.trim();
  if texto.is_empty() {
    return Err(sin_token("El archivo esta vacio."));
  }

  // Caso normal: JSON con clave "token".
  if texto.starts_with('{') {
    let json: Value = serde_json::from_str(texto).map_err(|err| {
      HermesError::nuevo(
        "hermes_config_invalida",
        format!("{ruta_txt} no es JSON valido: {err}."),
      )
    })?;
    let token = json.get("token").and_then(Value::as_str).unwrap_or("").trim();
    if token.is_empty() {
      return Err(sin_token("El JSON no tiene una clave \"token\" con contenido."));
    }
    return Ok(token.to_string());
  }

  // Caso tolerado: el archivo es solo el token. Se acepta pero se exige que no
  // tenga espacios ni saltos, para no mandar basura en la cabecera Authorization
  // (un header con caracteres invalidos falla despues, lejos de aca, y el error
  // seria imposible de relacionar con este archivo).
  if texto.contains(char::is_whitespace) {
    return Err(HermesError::nuevo(
      "hermes_config_invalida",
      format!(
        "{ruta_txt} no se entiende: no es JSON y tiene espacios o saltos de \
         linea. Dejalo como {{\"token\": \"<token>\"}}."
      ),
    ));
  }
  Ok(texto.to_string())
}

// ---------------------------------------------------------------------------
// Cliente HTTP
// ---------------------------------------------------------------------------

fn cliente() -> Result<&'static reqwest::Client, HermesError> {
  static CLIENTE: OnceLock<Option<reqwest::Client>> = OnceLock::new();

  let creado = CLIENTE.get_or_init(|| {
    reqwest::Client::builder()
      // Default conservador. Cada llamada fija ademas su propio limite con
      // RequestBuilder::timeout, que pisa a este.
      .timeout(TIMEOUT_CARD)
      .connect_timeout(TIMEOUT_CONEXION)
      // Hermes vive en la tailnet: un proxy de sistema no tiene nada que hacer
      // en el medio y solo puede romper o demorar la llamada.
      .no_proxy()
      .build()
      .ok()
  });

  creado
    .as_ref()
    .ok_or_else(|| HermesError::nuevo("hermes_cliente", "No se pudo construir el cliente HTTP."))
}

/// Id incremental para el campo "id" del JSON-RPC y para messageId.
///
/// No hace falta un UUID real: el id solo tiene que ser unico dentro de esta
/// conexion para poder aparear pedido y respuesta, y Hermes lo devuelve tal
/// cual. Se combina el arranque del proceso con un contador para que dos
/// sesiones del escritorio no colisionen. Evita sumar la dependencia uuid.
fn id_unico(prefijo: &str) -> String {
  static CONTADOR: AtomicU64 = AtomicU64::new(0);
  static SEMILLA: OnceLock<u64> = OnceLock::new();

  let semilla = *SEMILLA.get_or_init(|| {
    std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)
      .map(|d| d.as_nanos() as u64)
      .unwrap_or(0)
  });
  let n = CONTADOR.fetch_add(1, Ordering::Relaxed);
  format!("{prefijo}-{semilla:x}-{n:x}")
}

// ---------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------

/// GET /.well-known/agent.json
///
/// El agent card es PUBLICO: se pide sin Authorization. Verificado en vivo
/// contra la laptop y confirmado en adapter.do_GET, que responde el card antes
/// de cualquier chequeo de credencial.
///
/// Sirve para dos cosas: saber si Hermes esta arriba antes de mandar una tarea,
/// y separar problemas de red de problemas de token. Si esto anda y
/// hermes_a2a_call da "hermes_no_autorizado", el token es el culpable.
///
/// Devuelve el card crudo. Es un documento del estandar A2A y de otro repo:
/// tiparlo aca haria que un campo nuevo del lado de Hermes rompa la
/// compilacion del escritorio, mismo criterio que en flow.rs.
#[tauri::command]
pub async fn hermes_agent_card() -> Result<Value, HermesError> {
  let respuesta = cliente()?
    .get(HERMES_AGENT_CARD_URL)
    .timeout(TIMEOUT_CARD)
    .send()
    .await
    .map_err(HermesError::desde_reqwest)?;

  let status = respuesta.status();
  let cuerpo = respuesta.text().await.map_err(HermesError::desde_reqwest)?;

  if !status.is_success() {
    return Err(HermesError::http(
      "hermes_http",
      status.as_u16(),
      format!("Hermes respondio {status} al pedir el agent card."),
    ));
  }

  serde_json::from_str::<Value>(&cuerpo).map_err(|err| {
    HermesError::nuevo(
      "hermes_respuesta_invalida",
      format!("El agent card de Hermes no es JSON valido: {err}"),
    )
  })
}

/// Respuesta ya masticada de una llamada A2A.
///
/// A diferencia del agent card, aca SI se extrae estructura. El motivo: la UI
/// necesita el texto de la respuesta y el estado, y hacer ese recorrido de
/// "result -> task -> status -> message -> parts -> text" en TypeScript en cada
/// pantalla es repetir la misma logica fragil en varios lados.
///
/// El riesgo de tipar (que un cambio en Hermes rompa la compilacion) se evita
/// asi: todos los campos se derivan con tolerancia y ninguno es obligatorio, y
/// ademas se devuelve `crudo` con el result completo. Si Hermes agrega algo, el
/// frontend lo puede leer de `crudo` sin tocar Rust.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HermesRespuesta {
  /// Id de la tarea del lado de Hermes (ej. "task-3f9c..."). Sirve para
  /// correlacionar con su a2a_audit.jsonl cuando algo sale raro.
  pub task_id: String,
  /// Id de contexto. Pasarlo de vuelta en la proxima llamada continua la misma
  /// conversacion: Hermes persiste el hilo por contextId en disco.
  pub context_id: String,
  /// Estado en crudo de A2A v1.0 (TASK_STATE_COMPLETED, TASK_STATE_FAILED,
  /// TASK_STATE_INPUT_REQUIRED, ...). Se deja tal cual y no se traduce a un
  /// booleano: "necesita mas datos" no es lo mismo que "fallo", y aplastarlos
  /// perderia la unica senal que permite pedirle a Pancho una aclaracion.
  pub estado: String,
  /// Texto de la respuesta del agente, ya concatenado.
  pub texto: String,
  /// El result del JSON-RPC completo, por si el frontend necesita mas.
  pub crudo: Value,
}

/// POST JSON-RPC "message/send" contra el A2A de Hermes.
///
/// SOBRE EL "SKILL a2a" DEL PEDIDO ORIGINAL: el agent card lista skills
/// (a2a, spotify, terminal), pero en A2A esas skills son PUBLICIDAD, no ruteo.
/// El request de message/send no tiene ningun campo para elegir skill: sus
/// params son { message: { role, parts, messageId, contextId? } } y nada mas.
/// Verificado en protocol.text_message y en adapter._prepare_task, donde la
/// palabra "skill" solo aparece al construir el card. Hermes decide que
/// herramienta usar leyendo el texto del mensaje. O sea: para que Hermes use su
/// terminal o su Spotify, eso se pide EN EL TEXTO, no en un campo del protocolo.
/// No se inventa un campo "skill" que Hermes ignoraria en silencio.
///
/// OJO CON EL TIEMPO: esta llamada bloquea hasta que Hermes termina de pensar
/// (ver TIMEOUT_CALL). No es un fire-and-forget. La UI tiene que mostrar que
/// esta esperando y no debe reintentar sola: un reintento manda la tarea dos
/// veces, y si la tarea toca la terminal de la laptop eso se ejecuta dos veces.
#[tauri::command]
pub async fn hermes_a2a_call(
  app: tauri::AppHandle,
  mensaje: String,
  context_id: Option<String>,
) -> Result<HermesRespuesta, HermesError> {
  let texto = mensaje.trim();
  if texto.is_empty() {
    return Err(HermesError::nuevo("hermes_cliente", "El mensaje para Hermes esta vacio."));
  }

  let token = leer_token(&app)?;

  // Message en la forma A2A v1.0 que construye protocol.text_message: rol en
  // SCREAMING_SNAKE_CASE y Part discriminado por presencia de miembro, sin el
  // campo "kind" que usaba v0.3.
  let mut message = serde_json::json!({
    "role": "ROLE_USER",
    "parts": [{ "text": texto, "mediaType": "text/plain" }],
    "messageId": id_unico("msg"),
  });
  // contextId va DENTRO del message en v1.0 (protocol.extract_context_id lo
  // busca ahi primero). Solo se manda si Pancho esta continuando un hilo; si no,
  // Hermes crea uno nuevo y lo devuelve en la respuesta.
  if let Some(ctx) = context_id.as_deref().map(str::trim).filter(|c| !c.is_empty()) {
    message["contextId"] = Value::String(ctx.to_string());
  }

  let cuerpo_req = serde_json::json!({
    "jsonrpc": "2.0",
    "id": id_unico("req"),
    "method": "message/send",
    "params": { "message": message },
  });

  let respuesta = cliente()?
    .post(HERMES_A2A_URL)
    .timeout(TIMEOUT_CALL)
    .bearer_auth(&token)
    .json(&cuerpo_req)
    .send()
    .await
    .map_err(HermesError::desde_reqwest)?;

  let status = respuesta.status();
  let cuerpo = respuesta.text().await.map_err(HermesError::desde_reqwest)?;

  // 401 y 403 se separan del resto: los dos significan "arregla la config de
  // Hermes", pero por motivos distintos, y el mensaje tiene que decir cual.
  if status.as_u16() == 401 {
    return Err(HermesError::http(
      "hermes_no_autorizado",
      401,
      "Hermes rechazo el token. Revisa que el token del archivo de config sea \
       exactamente el mismo que quedo en A2A_PEER_TOKENS del .env de Hermes, y \
       que hayas reiniciado el gateway despues de editarlo.",
    ));
  }
  if status.as_u16() == 403 {
    return Err(HermesError::http(
      "hermes_no_autorizado",
      403,
      "Hermes reconocio el token pero el peer no esta en su lista de confianza. \
       Agrega el nombre del peer (ej. pancho-os) a A2A_TRUSTED_PEERS en el .env \
       de Hermes y reinicia el gateway.",
    ));
  }
  if status.as_u16() == 429 {
    return Err(HermesError::http(
      "hermes_http",
      429,
      "Hermes esta limitando las llamadas (rate limit). Espera un momento.",
    ));
  }
  if !status.is_success() {
    let recorte: String = cuerpo.chars().take(500).collect();
    return Err(HermesError::http(
      "hermes_http",
      status.as_u16(),
      format!("Hermes respondio {status}: {recorte}"),
    ));
  }

  let json: Value = serde_json::from_str(&cuerpo).map_err(|err| {
    HermesError::nuevo(
      "hermes_respuesta_invalida",
      format!("Hermes no devolvio JSON valido: {err}"),
    )
  })?;

  // Hermes puede contestar 200 con un error JSON-RPC en el cuerpo: el gate de
  // confianza y el rate limit tambien viajan asi en algunos caminos. Un 200 no
  // garantiza que salio bien.
  if let Some(error) = json.get("error") {
    let code = error.get("code").and_then(Value::as_i64).unwrap_or(0);
    let msg = error.get("message").and_then(Value::as_str).unwrap_or("error sin mensaje");
    // Se traducen los codigos propios de Hermes a algo accionable; el resto se
    // pasa tal cual antes que inventarle una explicacion.
    let detalle = match code {
      -32050 => format!("Hermes rechazo la credencial ({msg}). Revisa el token."),
      -32052 => format!(
        "Hermes no confia en este peer ({msg}). Agregalo a A2A_TRUSTED_PEERS y \
         reinicia el gateway."
      ),
      -32051 => format!("Hermes esta limitando las llamadas ({msg})."),
      _ => format!("Hermes devolvio un error JSON-RPC {code}: {msg}"),
    };
    return Err(HermesError::rpc(code, detalle));
  }

  let result = json.get("result").cloned().ok_or_else(|| {
    HermesError::nuevo(
      "hermes_respuesta_invalida",
      "La respuesta de Hermes no trae ni \"result\" ni \"error\".",
    )
  })?;

  Ok(interpretar_result(result))
}

// ---------------------------------------------------------------------------
// Parsing tolerante de la respuesta
// ---------------------------------------------------------------------------

/// Saca el Task/Message de adentro del result.
///
/// "message/send" devuelve el Task pelado y "SendMessage" lo envuelve en
/// {"task": ...} o {"message": ...} (es el oneof SendMessageResponse de v1.0,
/// ver protocol.send_message_response). Se toleran las tres formas para que
/// cambiar de nombre de metodo no obligue a tocar el parser.
fn desenvolver(result: &Value) -> &Value {
  if let Some(task) = result.get("task") {
    if task.is_object() {
      return task;
    }
  }
  if let Some(message) = result.get("message") {
    if message.is_object() {
      return message;
    }
  }
  result
}

/// Concatena el texto de un arreglo de Parts.
///
/// Tolera las dos formas igual que lo hace protocol.extract_text del lado de
/// Hermes: v1.0 pone "text" como miembro directo, v0.3 lo marcaba con
/// kind == "text". En los dos casos el contenido vive en part["text"], asi que
/// alcanza con preguntar si hay un "text" que sea string.
fn texto_de_parts(parts: &Value) -> String {
  let Some(lista) = parts.as_array() else { return String::new() };
  lista
    .iter()
    .filter_map(|part| part.get("text").and_then(Value::as_str))
    .collect::<Vec<_>>()
    .join("\n")
    .trim()
    .to_string()
}

/// Arma la HermesRespuesta a partir del result del JSON-RPC.
///
/// Se busca el texto en dos lugares por orden de preferencia:
///   1. status.message.parts  -> es donde Hermes pone SIEMPRE la respuesta,
///      incluso cuando el estado es FAILED o INPUT_REQUIRED.
///   2. artifacts[].parts     -> solo lo llena cuando la tarea completa bien.
///   3. parts sueltos         -> cuando el result es un Message y no un Task.
///
/// El orden no es cosmetico: si se mirara artifacts primero, una tarea fallida
/// volveria con texto vacio y la UI no podria explicar POR QUE fallo, que es
/// justo el caso en que el usuario mas necesita leer algo.
fn interpretar_result(result: Value) -> HermesRespuesta {
  let cuerpo = desenvolver(&result);

  let task_id = cuerpo
    .get("id")
    .and_then(Value::as_str)
    .or_else(|| cuerpo.get("taskId").and_then(Value::as_str))
    .unwrap_or("")
    .to_string();

  let context_id = cuerpo.get("contextId").and_then(Value::as_str).unwrap_or("").to_string();

  let estado = cuerpo
    .get("status")
    .and_then(|s| s.get("state"))
    .and_then(Value::as_str)
    .unwrap_or("")
    .to_string();

  let mut texto = cuerpo
    .get("status")
    .and_then(|s| s.get("message"))
    .and_then(|m| m.get("parts"))
    .map(texto_de_parts)
    .unwrap_or_default();

  if texto.is_empty() {
    if let Some(artifacts) = cuerpo.get("artifacts").and_then(Value::as_array) {
      texto = artifacts
        .iter()
        .filter_map(|a| a.get("parts"))
        .map(texto_de_parts)
        .filter(|t| !t.is_empty())
        .collect::<Vec<_>>()
        .join("\n");
    }
  }

  if texto.is_empty() {
    if let Some(parts) = cuerpo.get("parts") {
      texto = texto_de_parts(parts);
    }
  }

  HermesRespuesta { task_id, context_id, estado, texto, crudo: result }
}

#[cfg(test)]
mod tests {
  use super::*;

  /// Misma invariante que protege flow.rs. Si un timeout total quedara por
  /// debajo del de conexion, un Hermes apagado se reportaria como "timeout"
  /// (ocupado) en vez de "no alcanzable", y el usuario iria a buscar el problema
  /// al lugar equivocado.
  #[test]
  fn el_timeout_de_conexion_es_el_mas_corto() {
    for (nombre, limite) in [("TIMEOUT_CARD", TIMEOUT_CARD), ("TIMEOUT_CALL", TIMEOUT_CALL)] {
      assert!(limite > TIMEOUT_CONEXION, "{nombre} debe superar a TIMEOUT_CONEXION");
    }
  }

  /// El limite de la llamada tiene que sobrevivir al presupuesto propio de
  /// Hermes (A2A_REPLY_TIMEOUT, 300s por defecto). Si cortaramos antes,
  /// perderiamos la respuesta FAILED con motivo que Hermes igual devuelve.
  #[test]
  fn el_timeout_de_llamada_supera_al_de_hermes() {
    assert!(TIMEOUT_CALL > Duration::from_secs(300));
  }

  /// Forma real de "message/send": Task pelado, sin envoltorio.
  #[test]
  fn interpreta_task_pelado() {
    let result = serde_json::json!({
      "id": "task-abc123",
      "contextId": "ctx-def456",
      "status": {
        "state": "TASK_STATE_COMPLETED",
        "message": {
          "role": "ROLE_AGENT",
          "parts": [{ "text": "listo", "mediaType": "text/plain" }]
        }
      },
      "artifacts": [{ "artifactId": "a1", "parts": [{ "text": "listo" }] }]
    });
    let r = interpretar_result(result);
    assert_eq!(r.task_id, "task-abc123");
    assert_eq!(r.context_id, "ctx-def456");
    assert_eq!(r.estado, "TASK_STATE_COMPLETED");
    assert_eq!(r.texto, "listo");
  }

  /// Forma de "SendMessage": el mismo Task envuelto en {"task": ...}. Se tolera
  /// para no atarnos al nombre del metodo.
  #[test]
  fn interpreta_task_envuelto() {
    let result = serde_json::json!({
      "task": {
        "id": "task-xyz",
        "contextId": "ctx-1",
        "status": {
          "state": "TASK_STATE_COMPLETED",
          "message": { "parts": [{ "text": "hola" }] }
        }
      }
    });
    let r = interpretar_result(result);
    assert_eq!(r.task_id, "task-xyz");
    assert_eq!(r.texto, "hola");
  }

  /// Una tarea fallida TIENE que traer el motivo. Es el caso que se rompe si
  /// alguien reordena la busqueda del texto para mirar artifacts primero:
  /// Hermes no llena artifacts cuando falla, solo status.message.
  #[test]
  fn una_tarea_fallida_conserva_el_motivo() {
    let result = serde_json::json!({
      "id": "task-f",
      "contextId": "ctx-f",
      "status": {
        "state": "TASK_STATE_FAILED",
        "message": { "parts": [{ "text": "[agent did not reply in time]" }] }
      }
    });
    let r = interpretar_result(result);
    assert_eq!(r.estado, "TASK_STATE_FAILED");
    assert_eq!(r.texto, "[agent did not reply in time]");
  }

  /// Parts en la forma vieja (v0.3, con "kind") tienen que seguir leyendose.
  #[test]
  fn tolera_parts_de_la_forma_vieja() {
    let parts = serde_json::json!([{ "kind": "text", "text": "compatible" }]);
    assert_eq!(texto_de_parts(&parts), "compatible");
  }

  /// Los ids no se repiten dentro del proceso.
  #[test]
  fn los_ids_son_unicos() {
    let a = id_unico("msg");
    let b = id_unico("msg");
    assert_ne!(a, b);
  }
}
