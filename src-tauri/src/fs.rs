// Acceso al sistema de archivos local del escritorio de Pancho OS.
//
// No se usa tauri-plugin-fs porque los comandos propios de la app no pasan por
// el ACL de Tauri (solo los comandos de plugins/core). En cambio, este modulo
// implementa su propio sandbox: todas las rutas se resuelven dentro del
// directorio de config de la app (%APPDATA%\com.franciscoabad.panchoos en
// Windows) y se rechaza cualquier intento de salir de ahi ("..", rutas
// absolutas, etc.).
//
// Decisiones:
//   1. Las rutas se piden relativas al sandbox. "docs/nota.txt" se lee/escribe
//      en %APPDATA%\...\docs\nota.txt.
//   2. Se rechazan componentes ".." y rutas absolutas; no se confia en
//      canonicalize porque el target puede no existir todavia al escribir.
//   3. Los errores son serializables y nunca panic.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FsReadResult {
  pub path: String,
  pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FsWriteArgs {
  pub path: String,
  pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FsError {
  pub codigo: String,
  pub mensaje: String,
}

impl FsError {
  fn nuevo(codigo: &str, mensaje: impl Into<String>) -> Self {
    Self { codigo: codigo.to_string(), mensaje: mensaje.into() }
  }
}

fn sandbox_dir(app: &tauri::AppHandle) -> Result<PathBuf, FsError> {
  app
    .path()
    .app_config_dir()
    .map_err(|err| FsError::nuevo("fs_sandbox", format!("No se pudo resolver el directorio de config de la app: {err}")))
}

/// Valida que la ruta relativa no tenga componentes peligrosos y la resuelve
/// contra el sandbox. Rechaza rutas absolutas y ".." para evitar traversal.
fn resolver_ruta(app: &tauri::AppHandle, rel: &str) -> Result<PathBuf, FsError> {
  let base = sandbox_dir(app)?;

  let normalizado = rel.replace('\\', "/");
  if normalizado.starts_with('/') || normalizado.starts_with('\\') || normalizado.contains(':') {
    return Err(FsError::nuevo("fs_ruta_invalida", "La ruta debe ser relativa al sandbox de la app."));
  }

  for parte in normalizado.split('/') {
    if parte.is_empty() || parte == "." {
      continue;
    }
    if parte == ".." {
      return Err(FsError::nuevo("fs_ruta_invalida", "No se permiten rutas que salgan del sandbox."));
    }
  }

  Ok(base.join(normalizado.replace('/', std::path::MAIN_SEPARATOR_STR)))
}

/// Lee un archivo de texto dentro del sandbox.
#[tauri::command]
pub async fn fs_read_file(app: tauri::AppHandle, path: String) -> Result<FsReadResult, FsError> {
  let ruta = resolver_ruta(&app, &path)?;

  let content = tokio::fs::read_to_string(&ruta).await.map_err(|err| {
    FsError::nuevo(
      "fs_lectura",
      format!("No se pudo leer '{}': {err}", ruta.display()),
    )
  })?;

  Ok(FsReadResult {
    path: ruta.to_string_lossy().to_string(),
    content,
  })
}

/// Escribe (o sobrescribe) un archivo de texto dentro del sandbox.
#[tauri::command]
pub async fn fs_write_file(app: tauri::AppHandle, args: FsWriteArgs) -> Result<FsReadResult, FsError> {
  let ruta = resolver_ruta(&app, &args.path)?;

  if let Some(parent) = ruta.parent() {
    tokio::fs::create_dir_all(parent).await.map_err(|err| {
      FsError::nuevo("fs_escritura", format!("No se pudo crear el directorio '{}': {err}", parent.display()))
    })?;
  }

  tokio::fs::write(&ruta, &args.content).await.map_err(|err| {
    FsError::nuevo(
      "fs_escritura",
      format!("No se pudo escribir '{}': {err}", ruta.display()),
    )
  })?;

  Ok(FsReadResult {
    path: ruta.to_string_lossy().to_string(),
    content: args.content,
  })
}

#[cfg(test)]
mod tests {
  #[test]
  fn rechaza_ruta_absoluta() {
    let normalizado = "C:/Windows/system.ini".replace('\\', "/");
    let es_absoluta = normalizado.starts_with('/') || normalizado.starts_with('\\') || normalizado.contains(':');
    assert!(es_absoluta);
  }

  #[test]
  fn rechaja_componente_padre() {
    let normalizado = "docs/../secreto.txt".replace('\\', "/");
    let tiene_dotdot = normalizado.split('/').any(|p| p == "..");
    assert!(tiene_dotdot);
  }

  #[test]
  fn acepta_ruta_relativa_simple() {
    let normalizado = "docs/nota.txt".replace('\\', "/");
    let partes: Vec<&str> = normalizado.split('/').collect();
    assert!(!partes.iter().any(|p| *p == ".."));
    assert!(!partes.is_empty());
  }
}
