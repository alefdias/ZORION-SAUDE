import pandas as pd
import sys

try:
    xls = pd.ExcelFile("Padronização  2026 e 2027 separada por class terapêutica NOVO.xls")
    print("Sheets:", xls.sheet_names)
    for sheet in xls.sheet_names:
        print(f"\nSheet: {sheet}")
        df = pd.read_excel(xls, sheet_name=sheet, nrows=5)
        print(df.to_dict(orient='records'))
except Exception as e:
    print(f"Error: {e}")
