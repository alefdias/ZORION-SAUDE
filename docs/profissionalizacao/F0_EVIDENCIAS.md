# F0 — Evidências da execução (banco real)

**Data:** 24/11/2026 ~11:30
**Ambiente:** PostgreSQL 18.6 em `127.0.0.1:5432`
**Banco de origem:** `Zorion` (15 MB, 39 tabelas)
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

## 5. Achados reais do banco (linha de base para F1/F3)

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

- **F1** cresce um item: dedupe de `Usuario` + PK/unique + fim do `admin123`.
- **F3** não pode criar FK antes de existir **unique index** nas colunas referenciadas. Ordem obrigatória:
  1. dedupe aprovado (`Usuario`, `Ala`);
  2. unique indexes;
  3. FKs `NOT VALID`;
  4. relatório de órfãos (já pronto em `integridade.sh`).
- **F5** ganha evidência concreta: hoje o perfil é validado no cliente e todos os 62 registros são admin.

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

## 8. Bloco 1 aplicado — integridade básica (24/11 ~11:56)

**Backup imediatamente antes:** `backups/Zorion_20261124_115626.dump` (924 KB, checksum OK).

Aplicado primeiro em `Zorion_test`, depois em produção com `--force-prod`:

| Migration | Efeito em produção |
|---|---|
| `0001_dedupe_legado.sql` | removeu **61** linhas idênticas de `Usuario` e **6** linhas excluídas duplicadas de `Ala` |
| `0002_primary_keys.sql` | criou PK em **36** tabelas (total agora: **37**, antes: 1) |
| `0003_unique_login.sql` | índice único em `lower(login)` (bloqueia login duplicado) |

**Antes → depois**

| Item | Antes | Depois |
|---|---:|---:|
| Linhas em `Usuario` | 62 | **1** |
| IDs distintos em `Usuario` | 1 | 1 |
| Linhas em `Ala` | 25 | **19** |
| Chaves primárias | 1 | **37** |
| Logins duplicados | 1 grupo (62) | **0** |

**Código ajustado (build OK):**
- `db.js`: seed do admin agora usa `WHERE NOT EXISTS` — não cria mais uma linha por inicialização.
- `AuthDialog.jsx`: removido o fallback fixo `admin/admin123` para tabela vazia.

**Não aplicado ainda:**
- FKs (`NOT VALID`) — próximo bloco, pois exigem observar o app em uso.
- Dedupe de `Medicamento` (3 grupos) e tratamento das 41 prescrições órfãs.

**Rollback:** restaurar o dump de 11:56 no banco de produção:

```bash
./scripts/f0/restore.sh backups/Zorion_20261124_115626.dump Zorion --recreate --force-prod
```

