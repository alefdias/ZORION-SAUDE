#!/usr/bin/env bash
# aplicar.sh — aplica as migrations em ordem, uma única vez cada
#
# Uso:
#   ./database/migrations/aplicar.sh <banco> [--force-prod]
#
# Segurança:
#   - Recusa o banco de produção (PROD_DB, padrão "zorion") sem --force-prod.
#   - Para no primeiro erro (ON_ERROR_STOP).
#   - Todos os scripts são idempotentes: rodar de novo não duplica efeito.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

[[ $# -ge 1 ]] || { sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 1; }

TARGET="$1"
FORCE_PROD=0
[[ "${2:-}" == "--force-prod" ]] && FORCE_PROD=1

# .env opcional
if [[ -f "$ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$ROOT/.env" | sed 's/^/export /')
  set +a
fi

export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-5432}"
export PGUSER="${PGUSER:-postgres}"
PROD_DB="${PROD_DB:-zorion}"

[[ "$TARGET" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]] || { echo "Nome de banco inválido: $TARGET"; exit 1; }

if [[ "${TARGET,,}" == "${PROD_DB,,}" && "$FORCE_PROD" -ne 1 ]]; then
  echo "BLOQUEADO: '$TARGET' é o banco de produção. Use --force-prod com backup recente."
  exit 1
fi

pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" >/dev/null || {
  echo "Postgres não respondeu em $PGHOST:$PGPORT"; exit 1;
}

echo "Aplicando migrations em '$TARGET' @ $PGHOST:$PGPORT"
for f in "$HERE"/[0-9]*.sql; do
  [[ -f "$f" ]] || continue
  echo
  echo "== $(basename "$f")"
  psql -v ON_ERROR_STOP=1 --dbname="$TARGET" --file="$f"
done

echo
echo "Migrations aplicadas em '$TARGET'."
