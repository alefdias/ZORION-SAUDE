#!/usr/bin/env bash
# integridade.sh — diagnóstico SOMENTE LEITURA da qualidade dos dados
#
# Uso:
#   ./scripts/f0/integridade.sh [banco]
#
# Padrão: Zorion_test. Não altera nada. Falha (exit 1) apenas em problemas críticos.
# Rode no clone (Zorion_test) para ter a linha de base antes das migrations da F3.

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

TARGET="${1:-${SMOKE_DB:-Zorion_test}}"
safe_dbname "$TARGET"
require_conn
db_exists "$TARGET" || die "Banco '$TARGET' não existe."

has_col() {
  local t="$1" c="$2"
  psql -d "$TARGET" -tAc "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='$t' AND column_name='$c'" 2>/dev/null | grep -q 1
}

q() { psql -d "$TARGET" -tAc "$1" 2>/dev/null | tr -d '[:space:]' || true; }

CRIT=0
WARN=0
INFO=0

check_zero() {
  local label="$1" sql="$2" level="${3:-critico}"
  local n
  n="$(q "$sql")"
  if [[ -z "$n" ]]; then
    warn "não avaliado: $label"
    return
  fi
  if [[ "$n" == "0" ]]; then
    ok "$label: 0"
  else
    case "$level" in
      critico) fail "$label: $n"; CRIT=$((CRIT + 1)) ;;
      aviso)   warn "$label: $n"; WARN=$((WARN + 1)) ;;
      info)    log  "$label: $n"; INFO=$((INFO + 1)) ;;
    esac
  fi
}

echo
log "Diagnóstico de integridade (somente leitura) — banco: $TARGET"

echo
echo "== Estrutura =="
TABLES=(
  Medicamento Lote Entrada Saida Paciente PrescricaoPaciente
  PedidoSatelite TransferenciaPendente Inventario InventarioItem
  Usuario Auditoria CarrinhoEstoqueCentral CarrinhoMovimentacao
  EnfermagemChecagem
)
MISSING=0
for t in "${TABLES[@]}"; do
  exists="$(psql -d "$TARGET" -tAc "SELECT to_regclass('public.\"$t\"') IS NOT NULL" 2>/dev/null | tr -d '[:space:]')"
  if [[ "$exists" == "t" ]]; then
    ok "tabela $t"
  else
    fail "tabela $t ausente"
    MISSING=$((MISSING + 1))
    CRIT=$((CRIT + 1))
  fi
done

echo
echo "== Órfãos (registros apontando para algo inexistente) =="
check_zero "Lotes sem medicamento" \
  "SELECT count(*) FROM \"Lote\" l WHERE l.\"medicamento_id\" IS NOT NULL AND l.\"deleted_at\" IS NULL AND NOT EXISTS (SELECT 1 FROM \"Medicamento\" m WHERE m.\"id\" = l.\"medicamento_id\")"

check_zero "Entradas sem medicamento" \
  "SELECT count(*) FROM \"Entrada\" e WHERE e.\"medicamento_id\" IS NOT NULL AND e.\"deleted_at\" IS NULL AND NOT EXISTS (SELECT 1 FROM \"Medicamento\" m WHERE m.\"id\" = e.\"medicamento_id\")"

check_zero "Saídas sem medicamento" \
  "SELECT count(*) FROM \"Saida\" s WHERE s.\"medicamento_id\" IS NOT NULL AND s.\"deleted_at\" IS NULL AND NOT EXISTS (SELECT 1 FROM \"Medicamento\" m WHERE m.\"id\" = s.\"medicamento_id\")"

if has_col PrescricaoPaciente pacienteId; then
  check_zero "Prescrições sem paciente" \
    "SELECT count(*) FROM \"PrescricaoPaciente\" p WHERE p.\"pacienteId\" IS NOT NULL AND p.\"deleted_at\" IS NULL AND NOT EXISTS (SELECT 1 FROM \"Paciente\" x WHERE x.\"id\" = p.\"pacienteId\")"
fi

if has_col Saida paciente_id; then
  check_zero "Saídas com paciente inexistente" \
    "SELECT count(*) FROM \"Saida\" s WHERE s.\"paciente_id\" IS NOT NULL AND s.\"deleted_at\" IS NULL AND NOT EXISTS (SELECT 1 FROM \"Paciente\" x WHERE x.\"id\" = s.\"paciente_id\")" aviso
fi

echo
echo "== Consistência de estoque =="
check_zero "Lotes com saldo negativo" \
  "SELECT count(*) FROM \"Lote\" WHERE \"quantidade_atual\" < 0 AND \"deleted_at\" IS NULL"

check_zero "Lotes com saldo acima do inicial" \
  "SELECT count(*) FROM \"Lote\" WHERE \"quantidade_atual\" > \"quantidade_inicial\" AND \"deleted_at\" IS NULL" aviso

check_zero "Lotes vencidos com saldo em estoque" \
  "SELECT count(*) FROM \"Lote\" WHERE \"quantidade_atual\" > 0 AND \"deleted_at\" IS NULL AND \"data_validade\"::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' AND \"data_validade\"::text < to_char(CURRENT_DATE, 'YYYY-MM-DD')" aviso

echo
echo "== Duplicidades =="
if has_col Medicamento concentracao; then
  check_zero "Medicamentos duplicados (nome + concentração)" \
    "SELECT count(*) FROM (SELECT upper(trim(\"nome\")) n, upper(trim(coalesce(\"concentracao\", ''))) c FROM \"Medicamento\" WHERE \"deleted_at\" IS NULL GROUP BY 1,2 HAVING count(*) > 1) d" info
fi

check_zero "Usuários com login duplicado" \
  "SELECT count(*) FROM (SELECT lower(\"login\") FROM \"Usuario\" WHERE \"deleted_at\" IS NULL GROUP BY 1 HAVING count(*) > 1) d"

echo
echo "== Resumo =="
if (( CRIT > 0 )); then
  fail "$CRIT problema(s) crítico(s), $WARN aviso(s), $INFO informativo(s)."
  exit 1
fi
ok "Nenhum problema crítico. $WARN aviso(s), $INFO informativo(s)."
