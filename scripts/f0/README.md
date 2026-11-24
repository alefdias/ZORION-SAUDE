# Scripts F0 — rede de segurança

Tudo aqui é **somente leitura da produção** ou opera em banco de teste. Nada altera o schema.

## Ordem de uso

```bash
# 0) Verifica ferramentas, conexão, disco e proteções do git
./scripts/f0/check_ambiente.sh

# 1) Backup validado (gera .dump + .sha256 em ./backups)
PGPASSWORD='***' DBNAME=zorion ./scripts/f0/backup.sh
# ou: DBNAME=zorion ./scripts/f0/backup.sh /caminho/dos/backups

# 2) Clone da produção para teste (recria, restaura e confere)
PGPASSWORD='***' ./scripts/f0/clone_prod_para_test.sh zorion zorion_test

# 3) Conferência avulsa entre dois bancos
PGPASSWORD='***' ./scripts/f0/conferir_clone.sh Zorion Zorion_test

# 4) Diagnóstico de integridade (somente leitura) no clone
PGPASSWORD='***' ./scripts/f0/integridade.sh Zorion_test

# 5) Restore manual de um dump específico
PGPASSWORD='***' ./scripts/f0/restore.sh backups/zorion_20261124_120000.dump zorion_test --recreate
```

Atalhos via npm:

```bash
npm run f0:check
npm run f0:backup
npm run f0:clone
npm run f0:integridade
```

## Variáveis aceitas

| Variável | Padrão | Uso |
|---|---|---|
| `PGHOST` | `localhost` | servidor |
| `PGPORT` | `5432` | porta |
| `PGUSER` | `postgres` | usuário |
| `PGPASSWORD` | — | senha (ou use `~/.pgpass`) |
| `DBNAME` | `zorion` | banco do backup |
| `PROD_DB` | `zorion` | banco protegido contra restore |
| `RETENTION_DAYS` | `30` | retenção dos backups |

> **Atenção ao nome:** no ambiente atual o banco se chama `Zorion` (Z maiúsculo, case-sensitive). Use `PROD_DB=Zorion` ou passe o nome nos comandos.

As variáveis também podem vir do `.env` na raiz do projeto.

## Proteções embutidas

- `restore.sh` **recusa** o banco de produção, mesmo com `--recreate`.
- `clone_prod_para_test.sh` exige destino terminando em `_test` ou `_homolog`.
- O dump é validado com `pg_restore --list` antes de ser considerado bom.
- Checksum SHA-256 gerado no backup e conferido no restore.
- Nada de senha em arquivo versionado: use `~/.pgpass` ou variável de ambiente.

## Nunca commitar

`backups/`, `*.dump`, `*.dump.sha256` — contêm dados de paciente (LGPD). Já estão no `.gitignore`.

## Agendamento (opcional)

Cron diário às 23h:

```cron
0 23 * * * cd /caminho/ZORION-SAUDE && DBNAME=zorion ./scripts/f0/backup.sh /var/backups/zorion >> /var/log/zorion-backup.log 2>&1
```
