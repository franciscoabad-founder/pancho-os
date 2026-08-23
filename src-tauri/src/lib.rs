use tauri::{
  menu::{Menu, MenuItem},
  tray::TrayIconBuilder,
  Manager,
};
use tauri_plugin_autostart::MacosLauncher;

// Cliente de Flow (app local de dictado y reuniones, otro repo). Ver flow.rs.
mod flow;
// Cliente A2A de Hermes (agente personal de Pancho, otro repo). Ver hermes.rs.
// Necesita un token de peer que Pancho tiene que configurar a mano: el archivo
// documenta los pasos exactos arriba de todo.
mod hermes;
// Estado de Ollama local.
mod ollama;
// Acceso al sistema de archivos dentro del sandbox de la app.
mod fs;
// Ejecucion de comandos de terminal con aprobacion previa.
mod terminal;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let mut builder = tauri::Builder::default();

  // single-instance va primero: si el usuario abre un segundo .exe (doble
  // click, atajo), esto lo detecta y en vez de otra ventana enfoca la que
  // ya existe. Debe registrarse antes que el resto de los plugins.
  builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
    if let Some(window) = app.get_webview_window("main") {
      let _ = window.show();
      let _ = window.set_focus();
    }
  }));

  builder = builder
    .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
    .plugin(tauri_plugin_notification::init())
    // Comandos propios de la app. Los comandos registrados aca quedan
    // disponibles para el frontend sin necesidad de permisos en
    // capabilities/default.json: el ACL de Tauri v2 aplica a comandos de
    // plugins y del core, no a los del propio app.
    //
    // Tampoco hace falta permiso de red: flow.rs habla por reqwest desde Rust,
    // no por el plugin http (que ni siquiera esta instalado). Verificado contra
    // gen/schemas/desktop-schema.json: los unicos permisos que ese schema
    // conoce en este proyecto son core, autostart, log y notification. No
    // existe ningun "http:*" que agregar.
    .invoke_handler(tauri::generate_handler![
      flow::flow_health,
      flow::flow_list_dictations,
      flow::flow_list_meetings,
      flow::flow_recording_status,
      flow::flow_start_recording,
      flow::flow_stop_recording,
      hermes::hermes_agent_card,
      hermes::hermes_a2a_call,
      ollama::ollama_status,
      fs::fs_read_file,
      fs::fs_write_file,
      terminal::terminal_request,
      terminal::terminal_list_pending,
      terminal::terminal_approve,
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Tray minimo: mostrar/ocultar la ventana y salir. El resto de
      // capacidades (dictado, estado de Ollama) se agregan en 2.1/2.2 como
      // items nuevos de este mismo menu, no un tray aparte.
      let mostrar = MenuItem::with_id(app, "mostrar", "Mostrar Pancho OS", true, None::<&str>)?;
      let salir = MenuItem::with_id(app, "salir", "Salir", true, None::<&str>)?;
      let menu = Menu::with_items(app, &[&mostrar, &salir])?;

      TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
          "mostrar" => {
            if let Some(window) = app.get_webview_window("main") {
              let _ = window.show();
              let _ = window.set_focus();
            }
          }
          "salir" => app.exit(0),
          _ => {}
        })
        .build(app)?;

      Ok(())
    });

  builder
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
