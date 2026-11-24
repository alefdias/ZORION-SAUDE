#!/usr/bin/env bash
# backup.sh — backup do banco do ZORION em formato custom do PostgreSQL
#
# Uso:
#   ./scripts/f0/backup.sh [diretório_destino]
#
# Variáveis (opcionais):
#   DBNAME, PGHOST, PGPORT, PGUSER, PGPASSWORD  credenciais/banco
#   RETENTION_DAYS                             dias de retenção (padrão 30)
#
# Exemplo:
#   PGPASSWORD=... DBNAME=zorion ./scripts/f0/backup.sh /var/backups/zorion
#
# O arquivo gerado é .dump (comprimido) + .sha256, e é validado com pg_restore --list.
# Nunca commite a pasta de backups: ela contém dados de paciente (LGPD).

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=_lib.sh
source "$SCRIPT_DIR/_lib.sh"

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
  exit 0
}
[[ "${1:-}" == "-h" || "${1:-}" == "--help" ]] && usage

load_env "$SCRIPT_DIR/../../.env"
pg_env_defaults

DEST="${1:-$SCRIPT_DIR/../../backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

need pg_dump
need pg_restore
need pg_isready
safe_dbname "$DBNAME"
[[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || die "RETENTION_DAYS deve ser um número (dias)."

require_conn

if [[ -z "${PGPASSWORD:-}" && ! -f "${PGPASSFILE:-$HOME/.pgpass}" ]]; then
  warn "Sem PGPASSWORD nem ~/.pgpass: o psql pode pedir a senha. Para agendamento (cron), configure ~/.pgpass."
fi

mkdir -p "$DEST"
chmod 700 "$DEST" 2>/dev/null || true

STAMP="$(date +%Y%m%d_%H%M%S)"
FILE="$DEST/${DBNAME}_${STAMP}.dump"
N=1
while [[ -e "$FILE" ]]; do
  FILE="$DEST/${DBNAME}_${STAMP}_${N}.dump"
  N=$((N + 1))
done

log "Banco: $DBNAME @ $PGHOST:$PGPORT (usuário $PGUSER)"
log "Destino: $FILE"

START="$(date +%s)"

if ! pg_dump \
      --host="$PGHOST" --port="$PGPORT" --username="$PGUSER" \
      --format=custom --compress=6 --no-owner --no-privileges \
      --file="$FILE" "$DBNAME"; then
  rm -f "$FILE"
  die "pg_dump falhou. Backup NÃO foi criado."
fi

[[ -s "$FILE" ]] || { rm -f "$FILE"; die "Backup gerado vazio. Abortando."; }

# Valida a estrutura do dump sem precisar de banco.
if ! pg_restore --list "$FILE" >/dev/null 2>&1; then
  rm -f "$FILE"
  die "Dump inválido (pg_restore --list falhou). Backup NÃO foi confiável."
fi

SUM="$(sha256_of "$FILE")"
if [[ -n "$SUM" ]]; then
  printf '%s  %s\n' "$SUM" "$(basename "$FILE")" > "$FILE.sha256"
  ok "Checksum SHA-256 gerado."
else
  warn "sha256sum/shasum não encontrado: checksum não gerado."
fi

END="$(date +%s)"
DUR=$((END - START))

ok "Backup criado: $(basename "$FILE") ($(human_size "$FILE")) em ${DUR}s"
log "Restaurar em teste: ./scripts/f0/restore.sh \"$FILE\" zorion_test --recreate"

# Retenção: apaga apenas dumps deste banco mais antigos que RETENTION_DAYS.
if (( RETENTION_DAYS > 0 )); then
  DELETED=0
  while IFS= read -r old; do
    rm -f "$old" "$old.sha256"
    DELETED=$((DELETED + 1))
  done < <(find "$DEST" -maxdepth 1 -type f -name "${DBNAME}_*.dump" -mtime +"$RETENTION_DAYS" 2>/dev/null || true)
  (( DELETED > 0 )) && log "Retenção: $DELETED backup(s) com mais de ${RETENTION_DAYS} dias removido(s)."
fi

printf '%s\n' "$FILE"
