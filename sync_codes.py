import sqlite3

def run():
    db_path = "/home/alef/.local/share/com.axion.saude/pharmacy.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Pega todos que TEM código
    cursor.execute("SELECT nome, unidade_medida, codigo FROM Medicamento WHERE codigo IS NOT NULL AND codigo != ''")
    with_code = cursor.fetchall()

    code_map = {}
    for nome, dosagem, codigo in with_code:
        if nome:
            key = (nome.strip().lower(), (dosagem or "").strip().lower())
            code_map[key] = codigo

    # Pega todos que NÃO TEM código
    cursor.execute("SELECT id, nome, unidade_medida FROM Medicamento WHERE codigo IS NULL OR codigo = ''")
    without_code = cursor.fetchall()

    updates = 0
    for id_val, nome, dosagem in without_code:
        if not nome: continue
        
        key = (nome.strip().lower(), (dosagem or "").strip().lower())
        if key in code_map:
            new_codigo = code_map[key]
            cursor.execute("UPDATE Medicamento SET codigo = ? WHERE id = ?", (new_codigo, id_val))
            updates += 1

    conn.commit()
    conn.close()
    print(f"Updated {updates} medications.")

if __name__ == "__main__":
    run()
