#!/usr/bin/env bash
# restore.sh — restaura um backup .dump em um banco de teste
#
# Uso:
#   ./scripts/f0/restore.sh <arquivo.dump> <banco_destino> [--recreate] [--force-prod]
#
# Segurança:
#   - Recusa restaurar no banco de produção (PROD_DB, padrão "zorion").
#   - Só apaga o banco destino com --recreate, e nunca se for produção.
#   - Confere o checksum .sha256 quando existir.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_lib.sh
source "$SCRIPT_DIR/_lib.sh"

usage() {
  sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}

[[ $# -ge 2 ]] || usage
[[ "${1:-}" == "-h" || "${1:-}" == "--help" ]] && usage

DUMP="$1"
TARGET="$2"
shift 2

RECREATE=0
FORCE_PROD=0
for arg in "$@"; do
  case "$arg" in
    --recreate)   RECREATE=1 ;;
    --force-prod) FORCE_PROD=1 ;;
    *) die "Opção desconhecida: $arg" ;;
  esac
done

load_env "$SCRIPT_DIR/../../.env"
pg_env_defaults

need pg_restore
need psql
safe_dbname "$TARGET"

[[ -f "$DUMP" ]] || die "Arquivo não encontrado: $DUMP"

if [[ "$TARGET" == "$PROD_DB" && "$FORCE_PROD" -ne 1 ]]; then
  die "Destino '$TARGET' é o banco de PRODUÇÃO. Uso bloqueado. (use --force-prod apenas com backup recém-validado e autorização)"
fi

require_conn

# 1) Checksum
if [[ -f "$DUMP.sha256" ]]; then
  EXPECTED="$(awk '{print $1}' "$DUMP.sha256")"
  ACTUAL="$(sha256_of "$DUMP")"
  if [[ -n "$EXPECTED" && -n "$ACTUAL" ]]; then
    [[ "$EXPECTED" == "$ACTUAL" ]] || die "Checksum divergente! Arquivo corrompido: $DUMP"
    ok "Checksum confere."
  fi
else
  warn "Sem arquivo .sha256 ao lado do dump: seguindo sem verificação de integridade."
fi

# 2) Valida a estrutura do dump
pg_restore --list "$DUMP" >/dev/null 2>&1 || die "Dump inválido (pg_restore --list falhou)."

# 3) Prepara destino
if db_exists "$TARGET"; then
  if (( RECREATE == 0 )); then
    die "O banco '$TARGET' já existe. Use --recreate para apagá-lo e recriar (nunca em produção)."
  fi
  [[ "$TARGET" == "$PROD_DB" ]] && die "Recusando apagar o banco de produção '$TARGET'."
  log "Encerrando conexões e apagando '$TARGET'..."
  psql -d postgres -v ON_ERROR_STOP=1 -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TARGET' AND pid <> pg_backend_pid();" >/dev/null
  dropdb --if-exists --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" "$TARGET"
  ok "Banco '$TARGET' removido."
fi

createdb --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" --owner="$PGUSER" "$TARGET"
ok "Banco '$TARGET' criado."

# 4) Restaura
START="$(date +%s)"
log "Restaurando $(basename "$DUMP") em '$TARGET'..."
pg_restore \
  --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" \
  --dbname="$TARGET" --no-owner --no-privileges --jobs=2 \
  "$DUMP"

END="$(date +%s)"
ok "Restore concluído em $((END - START))s."

# 5) Resumo rápido
TABLES="$(psql -d "$TARGET" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")"
log "Tabelas no banco restaurado: ${TABLES//[[:space:]]/}"
log "Conferir paridade: ./scripts/f0/conferir_clone.sh \"$PROD_DB\" \"$TARGET\""
