use serde_json::Value;
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
        let mut client = Client::connect(&conn_str, NoTls).map_err(|e| format!("Conexão falhou: {}", e))?;
        let affected = client.execute(&query, &[]).map_err(|e| format!("Execute falhou: {}", e))?;
        Ok(affected)
    }).await.map_err(|e| e.to_string())?;

    result
}
