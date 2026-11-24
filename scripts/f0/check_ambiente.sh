#!/usr/bin/env bash
# check_ambiente.sh — verifica se a máquina está pronta para a F0
#
# Uso:
#   ./scripts/f0/check_ambiente.sh
#
# Não altera nada. Apenas checa ferramentas, conexão, espaço em disco,
# proteções do .gitignore e o baseline do git.

set -uo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_lib.sh
source "$SCRIPT_DIR/_lib.sh"
set +e

load_env "$SCRIPT_DIR/../../.env"
pg_env_defaults

FAILS=0
pass() { ok "$1"; }
nope() { fail "$1"; FAILS=$((FAILS + 1)); }

echo
echo "== Ferramentas =="
for bin in psql pg_dump pg_restore pg_isready createdb dropdb; do
  if command -v "$bin" >/dev/null 2>&1; then
    pass "$bin -> $(command -v "$bin")"
  else
    nope "$bin não encontrado"
  fi
done

echo
echo "== Versões (cliente x servidor) =="
CLIENT_MAJOR="$(psql --version | grep -oE '[0-9]+' | head -1)"
if pg_ready; then
  SERVER_VERSION="$(psql -d postgres -tAc 'SHOW server_version' 2>/dev/null | tr -d '[:space:]')"
  SERVER_MAJOR="${SERVER_VERSION%%.*}"
  pass "Postgres acessível em $PGHOST:$PGPORT (servidor $SERVER_VERSION)"
  if [[ "$CLIENT_MAJOR" == "$SERVER_MAJOR" ]]; then
    pass "Versão do cliente ($CLIENT_MAJOR) compatível com o servidor ($SERVER_MAJOR)"
  else
    warn "Cliente major $CLIENT_MAJOR x servidor major $SERVER_MAJOR. pg_dump costuma funcionar, mas prefira versões iguais."
  fi
  DB_SIZE="$(psql -d "$PROD_DB" -tAc "SELECT pg_size_pretty(pg_database_size('$PROD_DB'))" 2>/dev/null | tr -d '[:space:]')"
  [[ -n "$DB_SIZE" ]] && log "Tamanho do banco '$PROD_DB': $DB_SIZE"
else
  nope "Postgres não respondeu em $PGHOST:$PGPORT (usuário $PGUSER)"
fi

echo
echo "== Espaço em disco =="
AVAIL_KB="$(df -Pk "$SCRIPT_DIR" | awk 'NR==2 {print $4}')"
AVAIL_GB=$((AVAIL_KB / 1024 / 1024))
if (( AVAIL_GB >= 5 )); then
  pass "Espaço livre: ${AVAIL_GB} GB"
else
  nope "Espaço livre baixo: ${AVAIL_GB} GB (recomendado >= 5 GB)"
fi

echo
echo "== Proteções do repositório =="
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
if [[ -f "$ROOT/.gitignore" ]]; then
  for pattern in "backups/" "*.dump"; do
    if grep -qF -- "$pattern" "$ROOT/.gitignore"; then
      pass ".gitignore cobre '$pattern'"
    else
      nope ".gitignore NÃO cobre '$pattern'"
    fi
  done
else
  nope ".gitignore não encontrado"
fi

if git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
  BRANCH="$(git -C "$ROOT" branch --show-current 2>/dev/null || echo "(detached)")"
  log "Branch atual: $BRANCH"
  if git -C "$ROOT" rev-parse -q --verify "refs/tags/baseline-profissionalizacao" >/dev/null; then
    pass "Tag baseline-profissionalizacao existe"
  else
    warn "Tag baseline-profissionalizacao não existe (recomendada antes de começar)"
  fi
  DIRTY="$(git -C "$ROOT" status --porcelain | wc -l | tr -d '[:space:]')"
  if [[ "$DIRTY" == "0" ]]; then
    pass "Árvore de trabalho limpa"
  else
    warn "$DIRTY arquivo(s) modificado(s)/não rastreado(s) na árvore de trabalho"
  fi
else
  warn "Este diretório não é um repositório git"
fi

echo
echo "== Pasta de backups =="
BACKUP_DIR="$ROOT/backups"
if mkdir -p "$BACKUP_DIR" 2>/dev/null && [[ -w "$BACKUP_DIR" ]]; then
  pass "Pasta '$BACKUP_DIR' gravável"
else
  nope "Não foi possível criar/escrever em '$BACKUP_DIR'"
fi

echo
if (( FAILS > 0 )); then
  fail "$FAILS verificação(ões) falharam. Resolva antes de rodar o backup."
  exit 1
fi
ok "Ambiente pronto para a F0."
