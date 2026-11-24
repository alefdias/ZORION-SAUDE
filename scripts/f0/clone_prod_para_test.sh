#!/usr/bin/env bash
# clone_prod_para_test.sh — cria/atualiza um banco de teste a partir da produção
#
# Uso:
#   ./scripts/f0/clone_prod_para_test.sh [banco_origem] [banco_destino]
#
# Padrão: origem "zorion", destino "zorion_test".
# O destino PRECISA terminar em _test ou _homolog (proteção contra acidente).
# Faz: backup validado da origem -> recria o destino -> restaura -> confere contagens.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_lib.sh
source "$SCRIPT_DIR/_lib.sh"

usage() {
  sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}
[[ "${1:-}" == "-h" || "${1:-}" == "--help" ]] && usage

load_env "$SCRIPT_DIR/../../.env"
pg_env_defaults

SOURCE="${1:-$PROD_DB}"
TARGET="${2:-${SOURCE}_test}"

safe_dbname "$SOURCE"
safe_dbname "$TARGET"

[[ "$SOURCE" != "$TARGET" ]] || die "Origem e destino são o mesmo banco ('$SOURCE'). Abortando."
[[ "$TARGET" == "$PROD_DB" ]] && die "Destino não pode ser o banco de produção '$PROD_DB'."
if [[ "$TARGET" != *_test && "$TARGET" != *_homolog ]]; then
  die "Por segurança, o destino deve terminar em _test ou _homolog (recebido: '$TARGET')."
fi

require_conn
db_exists "$SOURCE" || die "Banco de origem '$SOURCE' não existe em $PGHOST:$PGPORT."

log "Clonando '$SOURCE' -> '$TARGET'..."

TMP_LOG="$(mktemp)"
trap 'rm -f "$TMP_LOG"' EXIT

if ! DBNAME="$SOURCE" "$SCRIPT_DIR/backup.sh" > "$TMP_LOG"; then
  cat "$TMP_LOG" >&2
  die "Backup da origem falhou. Clone abortado."
fi
cat "$TMP_LOG"

DUMP="$(tail -n 1 "$TMP_LOG")"
[[ -f "$DUMP" ]] || die "Não foi possível localizar o dump gerado. Clone abortado."

"$SCRIPT_DIR/restore.sh" "$DUMP" "$TARGET" --recreate
"$SCRIPT_DIR/conferir_clone.sh" "$SOURCE" "$TARGET"

ok "Clone pronto: '$TARGET' (origem: '$SOURCE')"
log "Dump usado: $DUMP"
