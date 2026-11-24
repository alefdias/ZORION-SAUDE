# Banco de dados congelado — decisão de 24/11/2026

## Regra

**Nenhuma alteração de schema ou de dados será feita.** Nem no banco local, nem no servidor do hospital.

Isso vale para:

- ❌ dedupe de IDs, usuários ou alas
- ❌ criação de PK, FK, índice ou constraint
- ❌ migrations (`database/migrations/` foi removido do repositório)
- ❌ UPDATE/DELETE em massa
- ❌ "só um ajustinho" em produção

## Escopo permitido

- ✅ código da aplicação (React)
- ✅ código do backend Tauri (Rust)
- ✅ configuração de segurança (credenciais, TLS, CSP)
- ✅ scripts de **leitura** (backup, diagnóstico, conferência)

## O que aconteceu antes desta decisão

Os scripts de migration foram aplicados **somente na cópia local** `Zorion` (não no servidor) e depois **revertidos**:

| Item | Estado final |
|---|---:|
| `Usuario` | 62 linhas |
| `Ala` | 25 linhas |
| PKs | 1 |
| Índice de login | 0 |

Backups:
- `backups/Zorion_20261124_115626.dump` — antes das mudanças
- `backups/Zorion_20261124_124832.dump` — estado alterado (segurança)

O clone `Zorion_test` foi removido.

## Servidor real

O servidor do hospital está em **outro computador**. Ele nunca foi acessado, copiado ou alterado por este trabalho.

Qualquer intervenção futura no servidor exige:
1. autorização explícita do responsável;
2. janela de manutenção;
3. backup feito **no próprio servidor** e restore testado;
4. plano de rollback documentado.

## Segurança de repositório (código)

O repositório é **público**. Por isso:
- `.env` saiu do versionamento;
- senha fixa saiu do `test_db.js`;
- relatórios com dado de paciente (`RELATORIO_*.html/pdf`, `Duplicidade.sql`) **não** devem ser commitados.

> Se algum desses arquivos já foi enviado ao GitHub, o ideal é rotacionar credenciais e avaliar limpeza de histórico — sem alterar o banco.
