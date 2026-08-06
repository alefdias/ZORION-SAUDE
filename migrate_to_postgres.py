import sqlite3
import psycopg2
import os

SQLITE_DB_PATH = os.path.expanduser("~/.local/share/com.axion.saude/pharmacy.db")

PG_HOST = "127.0.0.1"
PG_DB = "axion"
PG_USER = "postgres"
PG_PASS = "admin123"

def migrate():
    sqlite_conn = sqlite3.connect(SQLITE_DB_PATH)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cursor = sqlite_conn.cursor()

    pg_conn = psycopg2.connect(host=PG_HOST, database=PG_DB, user=PG_USER, password=PG_PASS)
    pg_cursor = pg_conn.cursor()

    tables = [
        "Categoria", "Fornecedor", "Ala", "Medicamento", 
        "Lote", "Entrada", "Saida", "Emprestimo", 
        "Inventario", "InventarioItem",
        "CarrinhoPadronizacao", "CarrinhoEstoqueCentral",
        "CarrinhoEstoqueFisico", "CarrinhoMovimentacao",
        "Paciente", "PrescricaoPaciente"
    ]

    for table in tables:
        # Get Postgres columns and types
        pg_cursor.execute(f"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{table}'")
        pg_cols_info = {row[0]: row[1] for row in pg_cursor.fetchall()}
        
        if not pg_cols_info:
            print(f"Tabela {table} não existe no Postgres.")
            continue
            
        sqlite_cursor.execute(f"SELECT * FROM {table}")
        rows = sqlite_cursor.fetchall()
        
        if not rows:
            continue

        sqlite_columns = rows[0].keys()
        
        # Only use columns that exist in BOTH databases
        common_cols = [c for c in sqlite_columns if c in pg_cols_info]
        if not common_cols:
            continue
            
        col_names = ", ".join([f'"{col}"' for col in common_cols])
        placeholders = ", ".join(["%s"] * len(common_cols))
        
        insert_query = f'INSERT INTO "{table}" ({col_names}) VALUES ({placeholders}) ON CONFLICT ("id") DO UPDATE SET '
        update_parts = [f'"{col}" = EXCLUDED."{col}"' for col in common_cols if col != "id"]
        if update_parts:
            insert_query += ", ".join(update_parts)
        else:
            insert_query += 'id = EXCLUDED.id'

        success_count = 0
        for row in rows:
            values = []
            for col in common_cols:
                val = row[col]
                # Fix booleans (SQLite stores 0/1, Postgres wants boolean)
                if pg_cols_info[col] == 'boolean':
                    val = bool(val) if val is not None else False
                # Fix empty dates (SQLite stores '', Postgres wants NULL)
                if pg_cols_info[col] in ('date', 'timestamp without time zone', 'timestamp with time zone'):
                    if val == '':
                        val = None
                values.append(val)
                
            try:
                pg_cursor.execute(insert_query, tuple(values))
                success_count += 1
            except psycopg2.Error as e:
                print(f"  [!] Erro ao inserir linha na tabela {table}: {e}")
                pg_conn.rollback()
                break # Stop processing this table if schema mismatch
                
        pg_conn.commit()
        print(f"-> Migrados {success_count} registros para {table}")

    print("Finalizado!")

if __name__ == "__main__":
    migrate()
