mod db;
mod sync;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_log::Builder::new().build())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_shell::init())
    .setup(|app| {
      let handle = app.handle().clone();
      let conn = db::init(handle)?;
      app.manage(db::DbState(std::sync::Mutex::new(conn)));
      
      if let Some(window) = app.get_webview_window("main") {
          let _ = window.maximize();
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      // ── CRUD principal ──────────────────────────────────
      db::list_entities,
      db::create_entity,
      db::update_entity,
      db::delete_entity,
      db::clear_all_data,
      db::delete_lote_cascade,
      db::delete_medicamento_cascade,
      db::bulk_cleanup,
      db::backup_database,
      db::import_backup,
      db::export_all_data_as_json,
      // ── Sincronização inteligente ────────────────────────
      sync::check_db_status,
      sync::get_sync_metadata,
      sync::set_sync_metadata,
      sync::upsert_from_server,
      sync::get_records_since,
      sync::mark_pending_sync,
      sync::get_pending_sync_records,
      sync::mark_synced,
      sync::clear_pending_sync_entity,
      sync::get_table_counts,
      sync::test_postgres_connection,
      sync::query_postgres,
      sync::execute_postgres
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
