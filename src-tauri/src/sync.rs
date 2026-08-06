use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::db::DbState;
use postgres::{Client, NoTls};

#[tauri::command]
pub async fn test_postgres_connection(
    ip: String,
    db_name: String,
    password: String,
) -> Result<String, String> {
    let conn_str = format!("host={} user=postgres password={} dbname={} connect_timeout=3", ip, password, db_name);
    
    let result = tauri::async_runtime::spawn_blocking(move || {
        match Client::connect(&conn_str, NoTls) {
            Ok(mut client) => {
                if let Err(e) = client.query("SELECT 1", &[]) {
                    return Err(format!("Conectado, mas falhou ao executar query: {}", e));
                }
                Ok("Conexão bem-sucedida ao Servidor Postgres!".to_string())
            },
            Err(e) => {
                Err(format!("Falha na conexão: {}", e))
            }
        }
    }).await.map_err(|e| e.to_string())?;

    result
}

#[tauri::command]
pub async fn query_postgres(
    ip: String,
    db_name: String,
    password: String,
    query: String,
) -> Result<Vec<Value>, String> {
    let conn_str = format!("host={} user=postgres password={} dbname={} connect_timeout=3", ip, password, db_name);
    
    let result = tauri::async_runtime::spawn_blocking(move || {
        let mut client = Client::connect(&conn_str, NoTls).map_err(|e| format!("Conexão falhou: {}", e))?;
        let rows = client.query(&query, &[]).map_err(|e| format!("Query falhou: {}", e))?;
        
        let mut result_json = Vec::new();
        for row in rows {
            let mut map = serde_json::Map::new();
            for col in row.columns() {
                let name = col.name();
                let ty = col.type_();
                let val: Value = match ty.name() {
                    "bool" => {
                        let v: Option<bool> = row.get(name);
                        v.map(Value::from).unwrap_or(Value::Null)
                    },
                    "int4" | "int8" | "int2" => {
                        let v: Option<i64> = row.get(name);
                        v.map(Value::from).unwrap_or(Value::Null)
                    },
                    "float4" | "float8" | "numeric" => {
                        let v: Option<f64> = row.get(name);
                        v.map(Value::from).unwrap_or(Value::Null)
                    },
                    _ => {
                        // Cast everything else to string for simplicity (frontend handles parsing)
                        let v: Option<String> = match row.try_get::<_, String>(name) {
                            Ok(s) => Some(s),
                            Err(_) => {
                                // If it fails, try bool, int etc or just return null
                                None
                            }
                        };
                        v.map(Value::from).unwrap_or(Value::Null)
                    }
                };
                map.insert(name.to_string(), val);
            }
            result_json.push(Value::Object(map));
        }
        Ok(result_json)
    }).await.map_err(|e| e.to_string())?;

    result
}

#[tauri::command]
pub async fn execute_postgres(
    ip: String,
    db_name: String,
    password: String,
    query: String,
) -> Result<u64, String> {
    let conn_str = format!("host={} user=postgres password={} dbname={} connect_timeout=3", ip, password, db_name);
    
    let result = tauri::async_runtime::spawn_blocking(move || {
        let mut client = Client::connect(&conn_str, NoTls).map_err(|e| format!("Conexão falhou: {}", e))?;
        let affected = client.execute(&query, &[]).map_err(|e| format!("Execute falhou: {}", e))?;
        Ok(affected)
    }).await.map_err(|e| e.to_string())?;

    result
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Debug)]
pub struct DbStatus {
    pub db_found: bool,
    pub has_data: bool,
    pub initial_load_completed: bool,
    pub last_sync: Option<String>,
    pub app_version: Option<String>,
    pub record_counts: serde_json::Map<String, Value>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SyncMetadata {
    pub last_sync: Option<String>,
    pub app_version: String,
    pub initial_load_completed: bool,
}

// ─── Helpers internos ─────────────────────────────────────────────────────────

fn value_from_row(row: &rusqlite::Row, column_names: &[String]) -> rusqlite::Result<Value> {
    let mut map = serde_json::Map::new();
    for (i, name) in column_names.iter().enumerate() {
        let val: Value = match row.get_ref(i)? {
            rusqlite::types::ValueRef::Null => Value::Null,
            rusqlite::types::ValueRef::Integer(v) => Value::from(v),
            rusqlite::types::ValueRef::Real(v) => Value::from(v),
            rusqlite::types::ValueRef::Text(v) => Value::from(String::from_utf8_lossy(v)),
            rusqlite::types::ValueRef::Blob(v) => Value::from(format!("{:?}", v)),
        };
        map.insert(name.clone(), val);
    }
    Ok(Value::Object(map))
}

fn count_table(conn: &Connection, table: &str) -> i64 {
    conn.query_row(
        &format!("SELECT COUNT(*) FROM {}", table),
        [],
        |row| row.get(0),
    )
    .unwrap_or(0)
}

// ─── Comandos Tauri ───────────────────────────────────────────────────────────

/// Verifica o status do banco: se existe, tem dados, e metadados de sync.
#[tauri::command]
pub async fn check_db_status(state: tauri::State<'_, DbState>) -> Result<DbStatus, String> {
    let conn = state.0.lock().unwrap();

    let main_tables = vec![
        "Medicamento", "Lote", "Entrada", "Saida",
        "Fornecedor", "Ala", "Categoria",
    ];

    let mut record_counts = serde_json::Map::new();
    let mut total = 0i64;

    for table in &main_tables {
        let count = count_table(&conn, table);
        record_counts.insert(table.to_string(), Value::from(count));
        total += count;
    }

    let has_data = total > 0;

    // Lê sync_metadata
    let meta: Option<(Option<String>, String, i64)> = conn.query_row(
        "SELECT last_sync, app_version, initial_load_completed FROM sync_metadata WHERE id = 1",
        [],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    ).ok();

    let (last_sync, app_version, initial_load_completed_raw) =
        meta.unwrap_or((None, "1.0.0".to_string(), 0));

    println!(
        "[sync] Status DB: has_data={}, initial_load_completed={}, last_sync={:?}, total_records={}",
        has_data, initial_load_completed_raw, last_sync, total
    );

    Ok(DbStatus {
        db_found: true,
        has_data,
        initial_load_completed: initial_load_completed_raw == 1,
        last_sync,
        app_version: Some(app_version),
        record_counts,
    })
}

/// Lê os metadados de sincronização.
#[tauri::command]
pub async fn get_sync_metadata(state: tauri::State<'_, DbState>) -> Result<SyncMetadata, String> {
    let conn = state.0.lock().unwrap();
    let (last_sync, app_version, initial_load_completed_raw): (Option<String>, String, i64) =
        conn.query_row(
            "SELECT last_sync, app_version, initial_load_completed FROM sync_metadata WHERE id = 1",
            [],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|e| e.to_string())?;

    Ok(SyncMetadata {
        last_sync,
        app_version,
        initial_load_completed: initial_load_completed_raw == 1,
    })
}

/// Atualiza os metadados de sincronização.
#[tauri::command]
pub async fn set_sync_metadata(
    state: tauri::State<'_, DbState>,
    last_sync: Option<String>,
    app_version: Option<String>,
    initial_load_completed: Option<bool>,
) -> Result<(), String> {
    let conn = state.0.lock().unwrap();

    if let Some(ls) = &last_sync {
        conn.execute(
            "UPDATE sync_metadata SET last_sync = ? WHERE id = 1",
            params![ls],
        )
        .map_err(|e| e.to_string())?;
        println!("[sync] last_sync atualizado para: {}", ls);
    }

    if let Some(av) = &app_version {
        conn.execute(
            "UPDATE sync_metadata SET app_version = ? WHERE id = 1",
            params![av],
        )
        .map_err(|e| e.to_string())?;
    }

    if let Some(ilc) = initial_load_completed {
        conn.execute(
            "UPDATE sync_metadata SET initial_load_completed = ? WHERE id = 1",
            params![if ilc { 1i64 } else { 0i64 }],
        )
        .map_err(|e| e.to_string())?;
        println!("[sync] initial_load_completed = {}", ilc);
    }

    Ok(())
}

/// Upsert de múltiplos registros vindos do Postgres em uma entidade (batch).
/// Evita duplicidades via INSERT OR REPLACE.
#[tauri::command]
pub async fn upsert_from_server(
    state: tauri::State<'_, DbState>,
    entity_name: String,
    records: Vec<Value>,
) -> Result<usize, String> {
    if records.is_empty() {
        return Ok(0);
    }

    let mut conn = state.0.lock().unwrap();
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let mut count = 0usize;

    // Get valid columns for the table
    let col_query = format!("PRAGMA table_info('{}')", entity_name);
    let mut valid_columns = std::collections::HashSet::new();
    if let Ok(mut stmt) = tx.prepare(&col_query) {
        if let Ok(rows) = stmt.query_map([], |row| row.get::<_, String>(1)) {
            for col in rows.filter_map(Result::ok) {
                valid_columns.insert(col);
            }
        }
    }

    for record in &records {
        let obj = match record.as_object() {
            Some(o) => o,
            None => continue,
        };

        let keys: Vec<&String> = obj.keys().filter(|k| valid_columns.contains(k.as_str())).collect();
        if keys.is_empty() {
            continue;
        }

        let columns = keys.iter().map(|k| k.as_str()).collect::<Vec<&str>>().join(", ");
        let placeholders = keys.iter().map(|_| "?").collect::<Vec<&str>>().join(", ");
        let query = format!(
            "INSERT OR REPLACE INTO {} ({}) VALUES ({})",
            entity_name, columns, placeholders
        );

        let values: Vec<rusqlite::types::Value> = keys.iter().map(|k| {
            match &obj[*k] {
                Value::Null => rusqlite::types::Value::Null,
                Value::Bool(b) => rusqlite::types::Value::Integer(if *b { 1 } else { 0 }),
                Value::Number(n) => {
                    if let Some(i) = n.as_i64() {
                        rusqlite::types::Value::Integer(i)
                    } else {
                        rusqlite::types::Value::Real(n.as_f64().unwrap_or(0.0))
                    }
                }
                Value::String(s) => rusqlite::types::Value::Text(s.clone()),
                v => rusqlite::types::Value::Text(v.to_string()),
            }
        }).collect();

        match tx.execute(&query, rusqlite::params_from_iter(values)) {
            Ok(_) => count += 1,
            Err(e) => eprintln!(
                "[sync] Erro ao upsert {}/{}: {}",
                entity_name,
                obj.get("id").and_then(|v| v.as_str()).unwrap_or("?"),
                e
            ),
        }
    }

    tx.commit().map_err(|e| e.to_string())?;
    println!("[sync] upsert_from_Nuvem: {} registros em {}", count, entity_name);
    Ok(count)
}

/// Retorna registros criados/atualizados após `since` (ISO-8601).
/// Se `since` for None, retorna todos os registros.
#[tauri::command]
pub async fn get_records_since(
    state: tauri::State<'_, DbState>,
    entity_name: String,
    since: Option<String>,
) -> Result<Vec<Value>, String> {
    let conn = state.0.lock().unwrap();

    let mut results = Vec::new();

    if let Some(ts) = &since {
        let query = format!(
            "SELECT * FROM {} WHERE created_at > ? ORDER BY created_at ASC",
            entity_name
        );
        let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
        let col_names: Vec<String> =
            stmt.column_names().into_iter().map(|n| n.to_string()).collect();
        let rows = stmt
            .query_map(params![ts], |row| value_from_row(row, &col_names))
            .map_err(|e| e.to_string())?;
        for row in rows {
            results.push(row.map_err(|e: rusqlite::Error| e.to_string())?);
        }
    } else {
        let query = format!("SELECT * FROM {} ORDER BY created_at ASC", entity_name);
        let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
        let col_names: Vec<String> =
            stmt.column_names().into_iter().map(|n| n.to_string()).collect();
        let rows = stmt
            .query_map([], |row| value_from_row(row, &col_names))
            .map_err(|e| e.to_string())?;
        for row in rows {
            results.push(row.map_err(|e: rusqlite::Error| e.to_string())?);
        }
    }

    Ok(results)
}

/// Marca registros como pendentes de sincronização (coluna _pending_sync).
/// Usado para alterações offline que ainda não foram enviadas ao Nuvem.
#[tauri::command]
pub async fn mark_pending_sync(
    state: tauri::State<'_, DbState>,
    entity_name: String,
    record_id: String,
    operation: String, // "create" | "update" | "delete"
) -> Result<(), String> {
    let conn = state.0.lock().unwrap();

    // Tabela de operações pendentes
    conn.execute(
        "INSERT OR REPLACE INTO pending_sync (entity_name, record_id, operation, created_at)
         VALUES (?, ?, ?, datetime('now'))",
        params![entity_name, record_id, operation],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Retorna todos os registros com operações pendentes de sincronização.
#[tauri::command]
pub async fn get_pending_sync_records(
    state: tauri::State<'_, DbState>,
) -> Result<Vec<Value>, String> {
    let conn = state.0.lock().unwrap();

    let mut stmt = conn
        .prepare("SELECT entity_name, record_id, operation, created_at FROM pending_sync ORDER BY created_at ASC")
        .map_err(|e| e.to_string())?;

    let col_names: Vec<String> = stmt.column_names().into_iter().map(|n| n.to_string()).collect();
    let rows = stmt
        .query_map([], |row| value_from_row(row, &col_names))
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for row in rows {
        results.push(row.map_err(|e| e.to_string())?);
    }

    Ok(results)
}

/// Remove da fila de pendentes após sincronização bem-sucedida.
#[tauri::command]
pub async fn mark_synced(
    state: tauri::State<'_, DbState>,
    entity_name: String,
    record_id: String,
) -> Result<(), String> {
    let conn = state.0.lock().unwrap();
    conn.execute(
        "DELETE FROM pending_sync WHERE entity_name = ? AND record_id = ?",
        params![entity_name, record_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Remove todos os pendentes de uma entidade (após sync completo da entidade).
#[tauri::command]
pub async fn clear_pending_sync_entity(
    state: tauri::State<'_, DbState>,
    entity_name: String,
) -> Result<usize, String> {
    let conn = state.0.lock().unwrap();
    let deleted = conn
        .execute("DELETE FROM pending_sync WHERE entity_name = ?", params![entity_name])
        .map_err(|e| e.to_string())?;
    println!("[sync] {} pendentes removidos de {}", deleted, entity_name);
    Ok(deleted)
}

/// Retorna contagem de registros de todas as tabelas principais.
#[tauri::command]
pub async fn get_table_counts(state: tauri::State<'_, DbState>) -> Result<Value, String> {
    let conn = state.0.lock().unwrap();
    let tables = vec![
        "Medicamento", "Lote", "Entrada", "Saida",
        "Fornecedor", "Ala", "Emprestimo", "Categoria",
        "Inventario", "InventarioItem", "pending_sync",
    ];
    let mut map = serde_json::Map::new();
    for table in tables {
        map.insert(table.to_string(), Value::from(count_table(&conn, table)));
    }
    Ok(Value::Object(map))
}
