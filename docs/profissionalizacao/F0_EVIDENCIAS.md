# F0 — Evidências (banco LOCAL de teste)

> **Correção importante:** este relatório é da **cópia local** desta máquina, **não do servidor do hospital**.
> O servidor real está em outro computador e **nunca foi acessado nem alterado**.

**Data:** 24/11/2026 ~11:30
**Ambiente:** PostgreSQL 18.6 em `127.0.0.1:5432`
**Banco de origem:** `Zorion` local (15 MB, 39 tabelas) — cópia de teste
**Banco de teste:** `Zorion_test`
**Baseline git:** tag `baseline-profissionalizacao` (commit `2617eb1`)
**Branch de trabalho:** `profissionalizacao/f0-rede-seguranca` (commit `5b3b88c`)

---

## 1. Ambiente

| Verificação | Resultado |
|---|---|
| psql / pg_dump / pg_restore / createdb / dropdb | OK |
| Versão cliente x servidor | 18 x 18.6 — compatível |
| Espaço livre em disco | 807 GB |
| `.gitignore` cobre `backups/` e `*.dump` | OK |
| Tag de baseline | OK |

## 2. Backup

| Item | Valor |
|---|---|
| Arquivo | `backups/Zorion_20261124_113001.dump` |
| Tamanho | 924 KB |
| Formato | custom (`pg_dump -Fc`), compressão 6 |
| Validação | `pg_restore --list` OK |
| Checksum SHA-256 | gerado e conferido no restore |
| Tempo | < 1 s |

> O dump fica fora do git (`backups/` ignorado) por conter dados de paciente (LGPD).

## 3. Clone e paridade

`./scripts/f0/clone_prod_para_test.sh Zorion Zorion_test` → **PASSOU**

| Tabela | Zorion | Zorion_test | Resultado |
|---|---:|---:|---|
| Medicamento | 275 | 275 | paridade |
| Lote | 469 | 469 | paridade |
| Entrada | 476 | 476 | paridade |
| Saida | 953 | 953 | paridade |
| Paciente | 233 | 233 | paridade |
| PrescricaoPaciente | 1934 | 1934 | paridade |
| PedidoSatelite | 3 | 3 | paridade |
| TransferenciaPendente | 371 | 371 | paridade |
| Inventario | 0 | 0 | paridade |
| InventarioItem | 862 | 862 | paridade |
| Usuario | 62 | 62 | paridade |
| Auditoria | 5095 | 5095 | paridade |
| CarrinhoEstoqueCentral | 0 | 0 | paridade |
| CarrinhoMovimentacao | 0 | 0 | paridade |
| EnfermagemChecagem | 0 | 0 | paridade |

**Tabelas restauradas:** 39
**Tempo de restore:** < 1 s (banco pequeno e local — medir de novo no servidor real)

## 4. Proteções testadas (com falha proposital)

| Teste | Resultado |
|---|---|
| Restore no banco de produção `Zorion` | bloqueado |
| `--recreate` no banco de produção (mesmo com `--force-prod`) | bloqueado |
| Clone para destino sem `_test`/`_homolog` | bloqueado |
| Restore com checksum corrompido | bloqueado |
| Dois backups no mesmo segundo | não sobrescreve |
| Script de integridade com erro de tipo de coluna | corrigido e reexecutado |

## 5. Achados da cópia local (diagnóstico apenas — nada foi alterado)

### 5.1 Estrutura — muito mais fraca que o schema do repositório

| Métrica | Valor |
|---|---|
| Tabelas | 39 |
| Chaves primárias | **1** (só `AtendimentoRecepcao`) |
| Chaves estrangeiras | **0** |
| Tabelas sem PK | 38 |

> O `001_initial_schema.sql` declara PKs, mas `CREATE TABLE IF NOT EXISTS` não altera tabelas já existentes. Na prática, o banco de produção nasceu sem as constraints.

### 5.2 Usuário — duplicação e senha padrão

| Achado | Valor |
|---|---|
| Linhas em `Usuario` | 62 |
| IDs distintos | **1** (`user-admin-uuid`) |
| Logins distintos | **1** (`admin`) |
| Senhas `admin123` | **62 de 62** |
| PK em `Usuario` | **não existe** |

**Causa:** o `INSERT ... ON CONFLICT DO NOTHING` do app não tem constraint para conflitar. A cada inicialização, mais uma linha idêntica é inserida. O login `admin/admin123` continua ativo e é o único existente.

**Consequências:**
- A tabela cresce sem limite (62 linhas e subindo).
- Autenticação por `find` pega a primeira linha; qualquer `admin/admin123` entra.
- F1 precisa incluir: dedupe revisado + PK/unique + remoção do admin padrão.

### 5.3 Alas duplicadas

6 IDs duplicados, cada um com 2 linhas: `N1`, `N2`, `R1 M`, `R1 F`, `CL1`, `CL2`.
Impacto: relatórios que agrupam por `ala_id` podem contar em dobro. Precisa de dedupe com mapeamento antes de criar unique index.

### 5.4 Órfãos

| Verificação | Qtde | Classificação |
|---|---:|---|
| Prescrições sem paciente | 41 | crítico |
| Saídas com paciente inexistente | 40 | aviso |
| Lotes sem medicamento | 0 | OK |
| Entradas/saídas sem medicamento | 0 | OK |

> O paciente pode ter sido excluído fisicamente no passado; as prescrições ficaram. A F3 deve decidir a política: manter com `NOT VALID` ou arquivar.

### 5.5 Estoque

| Verificação | Qtde | Classificação |
|---|---:|---|
| Lotes com saldo negativo | 0 | OK |
| Lotes com saldo acima do inicial | 24 | aviso (ajustes?) |
| Lotes vencidos com saldo | 6 | aviso operacional |
| Medicamentos duplicados (nome + concentração) | 3 grupos | informativo |

Grupos duplicados: `CLORETO DE SÓDIO 0,9 MG/ML (0,9%)` (4), `PERICIAZINA 10 MG` (2), `VITAMINA DO COMPLEXO B ASSOCIAÇÕES` (2).

### 5.6 Resíduos de manutenção manual

Existem tabelas criadas por scripts antigos de deduplicação:
- `Saida_arquivo_duplicadas_2026_10_31`
- `Saida_arquivo_sem_lote_2026_10_31`

Não mexer agora. A F3 decide arquivar/renomear com aprovação.

## 6. Impacto no plano

> **Banco congelado por decisão do responsável.** Nenhum item abaixo será executado no banco — nem local, nem no servidor.

- ~~**F1** dedupe de `Usuario` + PK/unique~~ — **descartado** (altera dado/schema).
- ~~**F3** migrações, unique indexes, FKs `NOT VALID`~~ — **suspensa** (altera schema).
- **F5** continua valendo no código: permissões e auditoria podem ser endurecidas no cliente/Rust sem tocar no banco.
- O diagnóstico fica como referência para o servidor, caso um dia o responsável autorize uma intervenção planejada.

## 7. Portão da F0

| Critério | Status |
|---|---|
| Backup validado + checksum | ✅ |
| Restore completo no clone | ✅ |
| Paridade nas 15 tabelas críticas | ✅ |
| Proteções contra produção | ✅ |
| Diagnóstico de integridade executado | ✅ |
| **9 fluxos de UI no clone** | ⏳ pendente (manual) |
| Tempo de restore no servidor real | ⏳ pendente |

**F0 automatizada concluída.** Falta apenas o teste manual dos 9 fluxos com o app apontando para `Zorion_test`.

---

## 8. Bloco 1 — aplicado e REVERTIDO no banco local (24/11)

**Decisão do responsável:** banco de dados **congelado**. Nenhuma alteração de schema ou de dados será feita — nem aqui, nem no servidor. Somente código e segurança.

O que aconteceu:
1. Backup antes: `backups/Zorion_20261124_115626.dump`.
2. Migrations aplicadas **apenas no banco local** `Zorion` (ensaio).
3. Ordem recebida: reverter tudo.
4. Backup de segurança do estado alterado: `Zorion_20261124_124832.dump`.
5. `Zorion` restaurado do dump de 11:56 e conferido.

**Estado final do banco local (igual ao original):**

| Item | Valor |
|---|---:|
| Linhas em `Usuario` | **62** |
| Linhas em `Ala` | **25** |
| Chaves primárias | **1** |
| Índice único de login | **0** |

O clone `Zorion_test` foi removido. Os arquivos de migration foram retirados do repositório (`database/migrations/`), mas continuam no histórico git (commit `39938d5`) caso um dia sejam reavaliados — **não devem ser aplicados**.

**Código mantido (não toca no banco):**
- `db.js`: seed do admin com `WHERE NOT EXISTS` — evita criar linha nova a cada inicialização.
- `AuthDialog.jsx`: removido o fallback fixo `admin/admin123`.
- `db.js`: `logAuditoria` agora escapa todos os campos (fim da injeção por nome/entidade).


