import sqlite3
import os

db_path = os.path.expanduser('~/.local/share/com.axion.saude/pharmacy.db')

tables = [
  "Categoria", "Fornecedor", "Ala", "Medicamento", "Lote", "Entrada", "Saida", 
  "Emprestimo", "Inventario", "InventarioItem", "CarrinhoPadronizacao", 
  "CarrinhoEstoqueCentral", "CarrinhoEstoqueFisico", "CarrinhoMovimentacao", 
  "Paciente", "PrescricaoPaciente"
]

if not os.path.exists(db_path):
    print('Banco de dados local nao encontrado!')
    exit(1)

conn = sqlite3.connect(db_path)
cur = conn.cursor()

total_added = 0
for table in tables:
    try:
        cur.execute(f"SELECT id FROM {table} WHERE deleted_at IS NULL")
        rows = cur.fetchall()
        for row in rows:
            record_id = row[0]
            cur.execute(
                "INSERT OR REPLACE INTO pending_sync (entity_name, record_id, operation, created_at) VALUES (?, ?, 'update', datetime('now'))",
                (table, record_id)
            )
            total_added += 1
    except Exception as e:
        print(f"Aviso na tabela {table}: {e}")

conn.commit()
conn.close()

print(f"Sucesso! {total_added} registros foram adicionados a fila de sincronizacao.")
print("Agora basta abrir o aplicativo e clicar em Sincronizar!")
