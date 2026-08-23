// Ejecucion local de comandos de terminal en el escritorio de Pancho OS.
//
// Este modulo NO expone un "execute libre": todo comando pasa por una puerta de
// aprobacion de dos pasos. El frontend pide ejecutar un comando con
// terminal_request, el usuario lo aprueba con terminal_approve, y recien ahi se
// corre el proceso. Mientras tanto, terminal_list_pending permite mostrar la
// cola de pedidos esperando.
//
// Decisiones:
//   1. No se usa shell (/bin/sh ni cmd.exe /c). Se ejecuta el binario directo
//      con argumentos separados, evitando injection de comillas y pipes.
//   2. El comando y los argumentos se reciben como String; el ejecutor los pasa
//      tal cual al proceso. No se interpreta PATH de forma inteligente: si el
//      caller quiere un ejecutable del PATH, el sistema operativo lo resuelve.
//   3. Cada ejecucion captura stdout/stderr y el exit code. No se deja el
//      proceso huérfano: se espera a que termine con un timeout.
//   4. No se permite redirigir a archivos ni modificar variables de entorno
//      desde la llamada; si se necesita eso, se hace desde el caller con
//      fs_write_file + un script aprobado aparte.

use std::collections::HashMap;
use std::process::Stdio;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

const TIMEOUT_EJECUCION: Duration = Duration::from_secs(30);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalRequest {
  pub id: String,
  pub command: String,
  pub args: Vec<String>,
  pub requested_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalResult {
  pub id: String,
  pub command: String,
  pub args: Vec<String>,
  pub stdout: String,
  pub stderr: String,
  pub exit_code: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalError {
  pub codigo: String,
  pub mensaje: String,
}

impl TerminalError {
  fn nuevo(codigo: &str, mensaje: impl Into<String>) -> Self {
    Self { codigo: codigo.to_string(), mensaje: mensaje.into() }
  }
}

fn ahora_ms() -> u64 {
  SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|d| d.as_millis() as u64)
    .unwrap_or(0)
}

fn id_unico() -> String {
  format!("term-{}", ahora_ms())
}

static PENDING: OnceLock<Mutex<HashMap<String, TerminalRequest>>> = OnceLock::new();

fn pending() -> &'static Mutex<HashMap<String, TerminalRequest>> {
  PENDING.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Crea un pedido de ejecucion y lo deja pendiente de aprobacion.
#[tauri::command]
pub fn terminal_request(command: String, args: Vec<String>) -> Result<TerminalRequest, TerminalError> {
  let cmd = command.trim();
  if cmd.is_empty() {
    return Err(TerminalError::nuevo("terminal_invalido", "El comando no puede estar vacio."));
  }

  let request = TerminalRequest {
    id: id_unico(),
    command: cmd.to_string(),
    args,
    requested_at: ahora_ms(),
  };

  pending().lock().map_err(|_| TerminalError::nuevo("terminal_lock", "No se pudo acceder a la cola de aprobaciones."))?
    .insert(request.id.clone(), request.clone());

  Ok(request)
}

/// Lista los pedidos de ejecucion pendientes de aprobacion.
#[tauri::command]
pub fn terminal_list_pending() -> Result<Vec<TerminalRequest>, TerminalError> {
  let map = pending().lock().map_err(|_| TerminalError::nuevo("terminal_lock", "No se pudo acceder a la cola de aprobaciones."))?;
  let mut lista: Vec<TerminalRequest> = map.values().cloned().collect();
  lista.sort_by(|a, b| a.requested_at.cmp(&b.requested_at));
  Ok(lista)
}

/// Aprueba un pedido pendiente y ejecuta el comando.
#[tauri::command]
pub async fn terminal_approve(id: String) -> Result<TerminalResult, TerminalError> {
  let request = {
    let mut map = pending().lock().map_err(|_| TerminalError::nuevo("terminal_lock", "No se pudo acceder a la cola de aprobaciones."))?;
    map.remove(&id).ok_or_else(|| TerminalError::nuevo("terminal_no_encontrado", "No existe un pedido pendiente con ese id."))?
  };

  ejecutar(request).await
}

async fn ejecutar(request: TerminalRequest) -> Result<TerminalResult, TerminalError> {
  let mut proceso = tokio::process::Command::new(&request.command);
  proceso
    .args(&request.args)
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());

  let salida = tokio::time::timeout(TIMEOUT_EJECUCION, proceso.output()).await.map_err(|_| {
    TerminalError::nuevo("terminal_timeout", "El comando supero el limite de 30 segundos.")
  })?;

  let output = salida.map_err(|err| TerminalError::nuevo("terminal_ejecucion", format!("No se pudo ejecutar el comando: {err}")))?;

  Ok(TerminalResult {
    id: request.id,
    command: request.command,
    args: request.args,
    stdout: String::from_utf8_lossy(&output.stdout).to_string(),
    stderr: String::from_utf8_lossy(&output.stderr).to_string(),
    exit_code: output.status.code(),
  })
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn rechaza_comando_vacio() {
    let err = terminal_request("   ".to_string(), vec![]).expect_err("deberia fallar");
    assert_eq!(err.codigo, "terminal_invalido");
  }

  #[test]
  fn crea_pedido_pendiente() {
    let req = terminal_request("echo".to_string(), vec!["hola".to_string()]).expect("pedido valido");
    assert_eq!(req.command, "echo");
    let lista = terminal_list_pending().expect("listar");
    assert!(lista.iter().any(|r| r.id == req.id));
  }
}
