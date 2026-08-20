mod sync;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_log::Builder::new().level(log::LevelFilter::Info).build())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
      if let Some(window) = app.get_webview_window("main") {
          let _ = window.maximize();
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      sync::test_postgres_connection,
      sync::query_postgres,
      sync::execute_postgres,
      sync::start_db_listener
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
