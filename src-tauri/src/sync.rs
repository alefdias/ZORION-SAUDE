use serde_json::Value;
use postgres::{Client, NoTls};
use fallible_iterator::FallibleIterator;
use tauri::Emitter;

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
                
                // Cria as tabelas necessárias automaticamente
                let schema = include_str!("../../database/001_initial_schema.sql");
                if let Err(e) = client.batch_execute(schema) {
                    return Err(format!("Conectado, mas falhou ao inicializar tabelas: {}", e));
                }

                Ok("Conexão bem-sucedida e banco de dados inicializado!".to_string())
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
                    "bool" => row.try_get::<_, bool>(name).ok().map(Value::from).unwrap_or(Value::Null),
                    "int2" => row.try_get::<_, i16>(name).ok().map(Value::from).unwrap_or(Value::Null),
                    "int4" => row.try_get::<_, i32>(name).ok().map(Value::from).unwrap_or(Value::Null),
                    "int8" => row.try_get::<_, i64>(name).ok().map(Value::from).unwrap_or(Value::Null),
                    "float4" => row.try_get::<_, f32>(name).ok().map(Value::from).unwrap_or(Value::Null),
                    "float8" => row.try_get::<_, f64>(name).ok().map(Value::from).unwrap_or(Value::Null),
                    "timestamp" | "timestamptz" => {
                        row.try_get::<_, chrono::DateTime<chrono::Utc>>(name)
                           .ok()
                           .map(|d| Value::from(d.to_rfc3339()))
                           .or_else(|| {
                               row.try_get::<_, chrono::NaiveDateTime>(name)
                                  .ok()
                                  .map(|d| Value::from(d.to_string()))
                           })
                           .unwrap_or(Value::Null)
                    },
                    "date" => {
                        row.try_get::<_, chrono::NaiveDate>(name)
                           .ok()
                           .map(|d| Value::from(d.to_string()))
                           .unwrap_or(Value::Null)
                    },
                    _ => {
                        row.try_get::<_, String>(name).ok().map(Value::from).unwrap_or(Value::Null)
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
        let mut client = Client::connect(&conn_str, NoTls).map_err(|e| format!("Conexão falhou: {:?}", e))?;
        client.batch_execute(&query).map_err(|e| format!("Execute falhou: {:?}", e))?;
        let _ = client.batch_execute("NOTIFY app_update");
        Ok(1)
    }).await.map_err(|e| e.to_string())?;

    result
}

#[tauri::command]
pub async fn start_db_listener(
    app: tauri::AppHandle,
    ip: String,
    db_name: String,
    password: String,
) -> Result<(), String> {
    let conn_str = format!("host={} user=postgres password={} dbname={} connect_timeout=3", ip, password, db_name);
    
    std::thread::spawn(move || {
        loop {
            let mut client = match Client::connect(&conn_str, NoTls) {
                Ok(c) => c,
                Err(_) => {
                    std::thread::sleep(std::time::Duration::from_secs(3));
                    continue;
                }
            };
            
            if client.batch_execute("LISTEN app_update; LISTEN table_change; LISTEN nova_admissao;").is_err() {
                std::thread::sleep(std::time::Duration::from_secs(3));
                continue;
            }
            
            loop {
                // Keep connection alive and poll network
                if client.execute("SELECT 1", &[]).is_err() {
                    break; // Sai do loop interno para reconectar
                }
                
                let mut has_update = false;
                let mut novas_admissoes = Vec::new();
                {
                    let mut notifs = client.notifications();
                    let mut iter = notifs.timeout_iter(std::time::Duration::from_millis(100));
                    while let Ok(Some(notif)) = iter.next() {
                        if notif.channel() == "nova_admissao" {
                            novas_admissoes.push(notif.payload().to_string());
                        } else {
                            has_update = true;
                        }
                    }
                }
                
                for payload in novas_admissoes {
                    let _ = app.emit("nova_admissao", payload);
                }

                if has_update {
                    let _ = app.emit("db_update", "update");
                }
                
                std::thread::sleep(std::time::Duration::from_millis(1500));
            }
            
            // Espera antes de tentar reconectar
            std::thread::sleep(std::time::Duration::from_secs(3));
        }
    });
    
    Ok(())
}
