# Correção da duplicidade — 31/10/2026

Banco corrigido: **`Zorion` em `127.0.0.1:5432`** (o que o aplicativo usa).
Backup feito antes de qualquer alteração:

```
~/Documentos/zorion-backups/Zorion_2026-10-31_075321.dump
```

Restaurar, se precisar: `pg_restore -h 127.0.0.1 -U postgres -d Zorion --clean --if-exists <arquivo>`

## O que foi diagnosticado no banco real

| item | número |
|---|---:|
| saídas idênticas (mesmo paciente, lote, quantidade e data) | 26 grupos / **49 linhas** |
| unidades contadas mais de uma vez | **964** |
| medicamentos com saldo de satélite sem lote | 3 (219 unidades) |
| saídas apontando para lote inexistente | 23 |
| saídas sem lote | 4 |
| lotes com identidade repetida | 0 |
| saldo negativo | 0 |

Metade das repetições é do mesmo minuto (clique duplo / reenvio); a outra metade
é de **horas depois** (a mesma dispensação lançada de novo em outro turno).

## O que foi alterado no código

### `src/utils/sateliteLoteUtils.js` — fim da "reconciliação inteligente"

Quando a soma dos lotes não fechava com `med.estoque_satelite`, o código
**empurrava a diferença para o último lote** (ou inventava um lote com o saldo
órfão). A tela "fechava", o número errado era gravado de volta e o lote inflava a
cada leitura.

Agora o que existe é o que aparece. A divergência vai em
`lotesComSaldo.divergenciaSaldo` (propriedade não enumerável) e um `console.warn`
registra o caso. Nenhum saldo é ajustado automaticamente.

### `src/api/db.js` — duas correções

1. **`create()` só repete quando o erro é de schema.** Antes, qualquer erro
   reexecutava o `INSERT`. Se o insert tinha sido gravado e a resposta falhou
   (timeout/rede), a repetição criava a segunda linha idêntica. Agora só repete
   em `undefined_column` / `undefined_table` (função `ehErroDeSchema`).
2. **`autoEnsureTable()` uma vez por versão.** Cada `list()` de Medicamento
   reexecutava o lote inteiro de `ALTER TABLE` (191 comandos por terminal, a cada
   abertura). Agora fica marcado em `localStorage` por versão
   (`VERSAO_SCHEMA = "2026-10-31"`). Ao acrescentar colunas em
   `ensureTableQuery`, **troque a data** para reaplicar.

## O que foi aplicado no banco

`database/2026-10-31_travas_duplicidade.sql` (idempotente, sem apagar nada):

| trava | prova |
|---|---|
| `uq_lote_identidade` — lote único por (medicamento, número, validade) | inserir lote duplicado → *"duplicar valor da chave viola…"* |
| `ck_saida_quantidade_nao_negativa` e `…plausivel` | — |
| `uq_saida_grupo` (parcial, em `baixa_grupo_id`) | — |
| `tg_lote_saldo_nao_negativo` | gravar saldo −1 → *"Saldo negativo recusado no lote…"* |
| `tg_auditoria_imutavel` | `UPDATE "Auditoria"` → *"Auditoria é imutável…"* |

## Limpeza executada (autorizada em 31/10/2026)

| o que | linhas | destino |
|---|---:|---|
| saídas duplicadas (mantida a mais antiga de cada grupo) | **49** | `"Saida_arquivo_duplicadas_2026_10_31"` |
| saídas sem lote válido (23 com lote inexistente + 4 sem lote) | **27** | `"Saida_arquivo_sem_lote_2026_10_31"` |

`Saida`: 1.029 → **953** linhas (947 ativas). Zero grupos duplicados, zero
saídas órfãs.

Nenhuma linha foi destruída: as duas tabelas de arquivo têm a cópia integral
mais `motivo_arquivamento`. Restaurar uma linha é um `INSERT ... SELECT` de
volta.

**O saldo não foi alterado de propósito.** Apagar a linha não devolve a unidade
ao estoque, e "devolver por inferência" é exatamente o erro que criou o
problema. O ajuste correto é a **contagem física**: no inventário, o sistema vai
apontar sobra nos lotes afetados e a homologação lança o ajuste com autor.

## O que **não** foi feito (precisa de decisão)

1. **`fk_saida_lote`.** As 27 linhas órfãs saíram, então a FK já pode ser
   criada. Não criei porque ela **passa a recusar** dispensação com `lote_id`
   inválido — é a trava certa, mas precisa de teste em homologação antes. O
   comando está no fim de `2026-10-31_travas_duplicidade.sql`.
2. **`baixa_grupo_id` obrigatório.** Depende do app passar a preencher o campo
   em todas as baixas (10 pontos de `Saida.create`).
3. **Saldo de satélite órfão** (MIDAZOLAN 200, NISTATINA 13, GLICOSE 6 = 219
   unidades no campo, zero nos lotes): precisa de inventário; o sistema não sabe
   mais em qual lote estava.
4. **Saldo geral**: as 964 unidades duplicadas continuam descontadas do estoque
   até a contagem física. Nenhum script deve "devolver" isso sem alguém olhar a
   prateleira.

## Como testar

```bash
cd ZORION-SAUDE-main
npm run build     # já verificado: compila
npm run dev
```

As travas valem no banco na hora; as mudanças de código só valem quando o app
for reiniciado (ou recompilado, se você usa o `.exe`).

---

## Ensaio contra o dump de produção (16/10)

O banco `Zorion` desta máquina é **cópia de desenvolvimento**; a produção está no
servidor do hospital. O dump `backup_zorion_1792148787.sql` (16/10) foi restaurado
num banco separado (`zorion_prod_sim`) e a sequência inteira rodou nele.

O ensaio encontrou dois problemas que teriam quebrado no servidor:

1. **Schema de produção mais antigo**: não existem `"Lote".quantidade_satelite`
   nem `"Saida".baixa_grupo_id` (o app as cria ao abrir). Criado o passo
   `2026-10-31_00_preparar_schema.sql`.
2. **Conferência errada**: a checagem de "estoque preservado" somava também os
   cadastros já desativados (soft delete), contando duas vezes. Corrigida para
   considerar só `deleted_at IS NULL`.

Resultado do ensaio (dump de produção):

```
central_antes 869.537 = central_depois 869.537
satelite_antes 17.434 = satelite_depois 17.434
estoque_preservado .... t
nomes_ainda_duplicados  0
cadastros arquivados   54
saídas arquivadas      36 duplicadas + 1 sem lote
```

## Ordem para aplicar no servidor

```bash
PGHOST=127.0.0.1 PGUSER=postgres PGDATABASE=Zorion \
  ./database/aplicar_no_servidor.sh
```

O script faz backup verificado, aplica os 4 passos e imprime a conferência.
Rode com o aplicativo fechado em todos os terminais.
