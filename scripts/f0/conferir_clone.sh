#!/usr/bin/env bash
# conferir_clone.sh — compara contagens do banco origem x clone
#
# Uso:
#   ./scripts/f0/conferir_clone.sh [banco_origem] [banco_destino]
#
# Padrão: origem "zorion", destino "zorion_test".
# Sai com código 1 se alguma tabela crítica divergir.

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
require_conn
db_exists "$SOURCE" || die "Banco de origem '$SOURCE' não existe."
db_exists "$TARGET" || die "Banco de destino '$TARGET' não existe."

TABLES=(
  Medicamento
  Lote
  Entrada
  Saida
  Paciente
  PrescricaoPaciente
  PedidoSatelite
  TransferenciaPendente
  Inventario
  InventarioItem
  Usuario
  Auditoria
  CarrinhoEstoqueCentral
  CarrinhoMovimentacao
  EnfermagemChecagem
)

printf '\n%-26s %10s %10s   %s\n' "TABELA" "$SOURCE" "$TARGET" "RESULTADO"
printf '%.0s-' {1..62}; printf '\n'

DIFFS=0
CHECKED=0

for t in "${TABLES[@]}"; do
  A="$(count_rows "$SOURCE" "$t" || true)"
  B="$(count_rows "$TARGET" "$t" || true)"
  A="${A:-ERRO}"
  B="${B:-ERRO}"

  # Tabela pode não existir na versão antiga do schema.
  if [[ "$A" == "ERRO" && "$B" == "ERRO" ]]; then
    printf '%-26s %10s %10s   %s\n' "$t" "-" "-" "ausente nos dois"
    continue
  fi

  CHECKED=$((CHECKED + 1))
  if [[ "$A" == "$B" ]]; then
    printf '%-26s %10s %10s   %sPARIDADE%s\n' "$t" "$A" "$B" "$C_OK" "$C_RST"
  else
    printf '%-26s %10s %10s   %sDIVERGE%s\n' "$t" "$A" "$B" "$C_ERR" "$C_RST"
    DIFFS=$((DIFFS + 1))
  fi
done

printf '\n'
if (( CHECKED == 0 )); then
  die "Nenhuma tabela comparável encontrada. Verifique se o banco está correto."
fi

if (( DIFFS > 0 )); then
  fail "$DIFFS tabela(s) divergente(s) de $CHECKED comparadas."
  exit 1
fi

ok "Paridade confirmada em $CHECKED tabela(s): $SOURCE == $TARGET"
