import sqlite3
import os

db_path = os.path.join(os.environ['APPDATA'], '..', 'Local', 'com.axion.saude', 'pharmacy.db')
print('DB path:', db_path)

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
cursor = conn.cursor()

cursor.execute("SELECT padronizado, count(*) as c FROM Medicamento GROUP BY padronizado")
rows = cursor.fetchall()
print("Padronizados count:")
for r in rows:
    print(f"padronizado={r['padronizado']}, count={r['c']}")

cursor.execute("SELECT id, nome, padronizado FROM Medicamento LIMIT 5")
rows = cursor.fetchall()
print("Sample:")
for r in rows:
    print(dict(r))
