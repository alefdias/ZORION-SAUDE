#!/usr/bin/env bash
# =====================================================================
# ZORION SAÚDE — aplica as correções de duplicidade no servidor do hospital
# =====================================================================
# Uso (no servidor, com o aplicativo FECHADO em todos os terminais):
#
#   PGHOST=127.0.0.1 PGUSER=postgres PGDATABASE=Zorion ./aplicar_no_servidor.sh
#
# O script:
#   1. faz backup completo do banco (pg_dump -Fc) com data/hora;
#   2. aplica o schema que falta (2 colunas);
#   3. aplica as travas (índices, checks, triggers);
#   4. limpa as saídas duplicadas e órfãs (arquivando, não apagando);
#   5. consolida os cadastros de medicamento duplicados;
#   6. confere que o estoque total não mudou.
#
# Se qualquer passo falhar, para na hora (ON_ERROR_STOP). Cada passo é
# transacional: ou aplica inteiro, ou não aplica nada.
# =====================================================================
set -euo pipefail

raiz="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
destino="${BACKUP_DIR:-$HOME/zorion-backups}"
timestamp="$(date +%Y-%m-%d_%H%M%S)"

: "${PGHOST:=127.0.0.1}"
: "${PGUSER:=postgres}"
: "${PGDATABASE:=Zorion}"
export PGHOST PGUSER PGDATABASE

if [ -z "${PGPASSWORD:-}" ]; then
    read -r -s -p "Senha do usuário $PGUSER: " PGPASSWORD; echo
    export PGPASSWORD
fi

mkdir -p "$destino"

echo "→ banco: $PGDATABASE em $PGHOST"
echo "→ backup em: $destino"

arquivo="$destino/${PGDATABASE}_antes_correcao_$timestamp.dump"
pg_dump -Fc -f "$arquivo"
pg_restore --list "$arquivo" >/dev/null
echo "✓ backup verificado: $(basename "$arquivo") ($(du -h "$arquivo" | cut -f1))"

aplicar() {
    echo "→ $2"
    psql -q -v ON_ERROR_STOP=1 -f "$raiz/$1"
}

aplicar "2026-10-31_00_preparar_schema.sql"      "preparando schema (colunas que faltam)"
aplicar "2026-10-31_travas_duplicidade.sql"      "aplicando travas (índices, checks, triggers)"
aplicar "2026-10-31_limpeza_duplicidade.sql"     "limpando saídas duplicadas e órfãs"
aplicar "2026-10-31_consolidar_medicamentos.sql" "consolidando cadastros duplicados"

echo
echo "✓ concluído. Guarde o relatório final e o backup:"
echo "  backup: $arquivo"
