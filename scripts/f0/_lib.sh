#!/usr/bin/env bash
# _lib.sh — funções comuns dos scripts da F0 (rede de segurança)
# Uso: source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

set -euo pipefail

if [[ -t 1 ]]; then
  C_OK=$'\033[32m'; C_WARN=$'\033[33m'; C_ERR=$'\033[31m'; C_DIM=$'\033[2m'; C_RST=$'\033[0m'
else
  C_OK=""; C_WARN=""; C_ERR=""; C_DIM=""; C_RST=""
fi

log()  { printf '%s[%s]%s %s\n' "$C_DIM" "$(date +%H:%M:%S)" "$C_RST" "$*"; }
ok()   { printf '%s[OK]%s   %s\n'   "$C_OK"   "$C_RST" "$*"; }
warn() { printf '%s[!]%s    %s\n'    "$C_WARN" "$C_RST" "$*" >&2; }
fail() { printf '%s[FALHA]%s %s\n'   "$C_ERR"  "$C_RST" "$*" >&2; }
die()  { fail "$*"; exit 1; }

need() {
  command -v "$1" >/dev/null 2>&1 || die "Comando '$1' não encontrado no PATH."
}

# Carrega .env local sem sobrescrever variáveis já exportadas.
# Aceita linhas CHAVE=valor e ignora comentários/linhas vazias.
load_env() {
  local file="${1:-.env}"
  [[ -f "$file" ]] || return 0
  local key val line
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    # remove aspas simples/duplas em volta do valor
    val="${val%\"}"; val="${val#\"}"
    val="${val%\'}"; val="${val#\'}"
    [[ -n "${!key:-}" ]] && continue
    export "$key=$val"
  done < "$file"
}

pg_env_defaults() {
  export PGHOST="${PGHOST:-localhost}"
  export PGPORT="${PGPORT:-5432}"
  export PGUSER="${PGUSER:-postgres}"
  export DBNAME="${DBNAME:-zorion}"
  export PROD_DB="${PROD_DB:-zorion}"
}

# Garante nome de banco seguro (evita injeção em comandos SQL).
safe_dbname() {
  [[ "$1" =~ ^[A-Za-z_][A-Za-z0-9_]{0,62}$ ]] || die "Nome de banco inválido: '$1'"
}

pg_ready() {
  pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" >/dev/null 2>&1
}

require_conn() {
  pg_ready || die "Postgres não respondeu em $PGHOST:$PGPORT (usuário $PGUSER). Verifique se o servidor está no ar."
}

db_exists() {
  local db="$1" out
  safe_dbname "$db"
  out="$(psql -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$db'" 2>/dev/null || true)"
  [[ "$out" == "1" ]]
}

count_rows() {
  local db="$1" table="$2"
  psql -d "$db" -tAc "SELECT count(*) FROM \"$table\"" 2>/dev/null | tr -d '[:space:]'
}

human_size() {
  du -h "$1" 2>/dev/null | cut -f1
}

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    echo ""
  fi
}
