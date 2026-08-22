use tauri::{
  menu::{Menu, MenuItem},
  tray::TrayIconBuilder,
  Manager,
};
use tauri_plugin_autostart::MacosLauncher;

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
