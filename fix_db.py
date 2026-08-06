import sqlite3
import re

db_path = "/home/alef/.local/share/com.axion.saude/pharmacy.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("SELECT id, apresentacao, unidade_medida FROM Medicamento WHERE unidade_medida = 'un'")
rows = cursor.fetchall()

update_count = 0

for row in rows:
    id_val = row[0]
    apr = row[1]
    
    if not apr:
        continue
        
    match = re.match(r'^(COMP|AMP|TUBO|CAPS|FR|ENV|BISN|SER)\s+(.*)$', apr, re.IGNORECASE)
    if match:
        prefix = match.group(1).upper()
        new_dosage = match.group(2).strip()
        new_apres = apr
        
        if prefix == 'COMP':
            new_apres = 'comprimido'
        elif prefix == 'AMP':
            new_apres = 'ampola'
        elif prefix == 'TUBO':
            new_apres = 'tubo'
        elif prefix == 'CAPS':
            new_apres = 'capsula'
        elif prefix == 'FR':
            new_apres = 'frasco'
        elif prefix == 'ENV':
            new_apres = 'envelope'
        elif prefix == 'BISN':
            new_apres = 'pomada'
        elif prefix == 'SER':
            new_apres = 'seringa'
            
        cursor.execute("UPDATE Medicamento SET apresentacao = ?, unidade_medida = ? WHERE id = ?", (new_apres, new_dosage, id_val))
        update_count += 1

conn.commit()
conn.close()

print(f"Updated {update_count} records.")
