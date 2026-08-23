// Cliente de estado de Ollama para el escritorio de Pancho OS.
//
// Ollama corre localmente (loopback) en el puerto 11434. Este modulo solo pregunta
// si esta vivo y que modelos tiene; no ejecuta prompts ni expone la API completa
// de generacion. La idea es que la UI del OS pueda mostrar "Ollama disponible"
// antes de ofrecer capacidades locales.
//
// Decisiones:
//   1. Se apunta a 127.0.0.1 (no "localhost") para evitar retrasos de IPv6.
//   2. Si Ollama no esta corriendo, el comando devuelve available: false en vez
//      de un error: es un estado esperado, no una falla. Solo los errores de
//      parseo o argumento invalido se devuelven como OllamaError.
//   3. Los modelos se listan desde /api/tags, que no requiere autenticacion.

use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::Value;

const OLLAMA_BASE: &str = "http://127.0.0.1:11434";
const TIMEOUT_CONEXION: Duration = Duration::from_millis(800);
const TIMEOUT_TOTAL: Duration = Duration::from_secs(3);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaStatus {
  pub available: bool,
  pub version: Option<String>,
  pub models: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OllamaError {
  pub codigo: String,
  pub mensaje: String,
}

impl OllamaError {
  fn nuevo(codigo: &str, mensaje: impl Into<String>) -> Self {
    Self { codigo: codigo.to_string(), mensaje: mensaje.into() }
  }
}

fn cliente() -> Result<reqwest::Client, OllamaError> {
  reqwest::Client::builder()
    .timeout(TIMEOUT_TOTAL)
    .connect_timeout(TIMEOUT_CONEXION)
    .no_proxy()
    .build()
    .map_err(|err| OllamaError::nuevo("ollama_cliente", err.to_string()))
}

/// GET /api/tags
///
/// Devuelve el estado de Ollama y la lista de modelos instalados. Si Ollama no
/// responde, available es false; la UI decide como mostrarlo.
#[tauri::command]
pub async fn ollama_status() -> Result<OllamaStatus, OllamaError> {
  let cliente = cliente()?;
  let url = format!("{OLLAMA_BASE}/api/tags");

  let respuesta = match cliente.get(&url).send().await {
    Ok(r) => r,
    Err(err) => {
      if err.is_connect() || err.is_timeout() {
        return Ok(OllamaStatus { available: false, version: None, models: vec![] });
      }
      return Err(OllamaError::nuevo("ollama_cliente", err.to_string()));
    }
  };

  let status = respuesta.status();
  let cuerpo = respuesta.text().await.map_err(|err| OllamaError::nuevo("ollama_cliente", err.to_string()))?;

  if !status.is_success() {
    return Ok(OllamaStatus {
      available: false,
      version: None,
      models: vec![],
    });
  }

  let json: Value = serde_json::from_str(&cuerpo)
    .map_err(|err| OllamaError::nuevo("ollama_respuesta_invalida", format!("Ollama no devolvio JSON valido: {err}")))?;

  let models: Vec<String> = json
    .get("models")
    .and_then(Value::as_array)
    .map(|lista| {
      lista
        .iter()
        .filter_map(|m| m.get("name").and_then(Value::as_str).map(str::to_string))
        .collect()
    })
    .unwrap_or_default();

  Ok(OllamaStatus {
    available: true,
    version: json.get("version").and_then(Value::as_str).map(str::to_string),
    models,
  })
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn el_timeout_de_conexion_es_el_mas_corto() {
    assert!(TIMEOUT_TOTAL > TIMEOUT_CONEXION);
  }
}
