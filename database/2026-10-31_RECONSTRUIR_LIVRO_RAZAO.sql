-- =====================================================================
-- ZORION SAÚDE — RECONSTRUIR O LIVRO-RAZÃO A PARTIR DA FOTO DO ESTOQUE
-- =====================================================================
-- Apaga TODAS as entradas e transferências e recria, lote por lote:
--
--   entrada       = quantidade_atual + quantidade_satelite   (do lote)
--   transferência = quantidade_satelite                       (central → satélite)
--
-- Resultado: entrada − transferência = saldo central do lote
--            transferência            = saldo satélite do lote
--
-- Quantidade de lote, dispensações (Saida) e validades NÃO são tocadas.
-- A única coisa recalculada em Medicamento são os dois campos de saldo,
-- que passam a ser a soma dos lotes.
--
-- Datas: mantém a data da entrada que aquele lote já tinha; lote sem entrada
-- usa a entrada mais antiga do mesmo medicamento; se não houver, a entrada
-- mais antiga do banco. A transferência fica 1 dia depois da entrada.
--
-- Rode com o aplicativo fechado. Faça backup antes.
-- =====================================================================

BEGIN;

-- 0a. equalizar o satélite POR LOTE com o campo do medicamento ----------
-- Se o total do satélite está no cadastro do medicamento mas não nos lotes
-- (comum em banco antigo), aloca a diferença no lote que vence primeiro.
-- Sem isso, a reconstrução zeraria o saldo de satélite.
WITH alvo AS (
  SELECT m.id,
         coalesce(m.estoque_satelite, 0)        AS campo,
         coalesce(sum(l.quantidade_satelite), 0) AS lotes
    FROM "Medicamento" m
    LEFT JOIN "Lote" l ON l.medicamento_id = m.id AND l.deleted_at IS NULL
   WHERE m.deleted_at IS NULL
   GROUP BY m.id, m.estoque_satelite
  HAVING coalesce(m.estoque_satelite, 0) > coalesce(sum(l.quantidade_satelite), 0)
),
escolhido AS (
  SELECT a.id AS med_id,
         a.campo - a.lotes AS falta,
         (SELECT l.id FROM "Lote" l
           WHERE l.medicamento_id = a.id AND l.deleted_at IS NULL
           ORDER BY l.data_validade NULLS LAST, l.id LIMIT 1) AS lote_id
    FROM alvo a
)
UPDATE "Lote" l
   SET quantidade_satelite = coalesce(l.quantidade_satelite, 0) + e.falta
  FROM escolhido e
 WHERE l.id = e.lote_id;

-- 0. fotografia (datas de referência) ---------------------------------
CREATE TEMP TABLE base ON COMMIT DROP AS
SELECT l.id                       AS lote_id,
       l.medicamento_id,
       m.nome                     AS medicamento_nome,
       l.numero_lote,
       l.data_validade,
       coalesce(l.quantidade_atual, 0)    AS central,
       coalesce(l.quantidade_satelite, 0) AS satelite,
       coalesce(
           (SELECT min(e.data_entrada) FROM "Entrada" e WHERE e.lote_id = l.id),
           (SELECT min(e2.data_entrada) FROM "Entrada" e2 WHERE e2.medicamento_id = l.medicamento_id),
           (SELECT min(e3.data_entrada) FROM "Entrada" e3),
           CURRENT_DATE
       )                          AS data_entrada,
       (SELECT e4.fornecedor_nome FROM "Entrada" e4
         WHERE e4.lote_id = l.id AND e4.fornecedor_nome IS NOT NULL
         LIMIT 1)                 AS fornecedor
  FROM "Lote" l
  JOIN "Medicamento" m ON m.id = l.medicamento_id
 WHERE l.deleted_at IS NULL
   AND m.deleted_at IS NULL
   AND (coalesce(l.quantidade_atual, 0) + coalesce(l.quantidade_satelite, 0)) > 0;

-- totais antes, para comparar no fim
CREATE TEMP TABLE totais_antes ON COMMIT DROP AS
SELECT coalesce(sum(central), 0)  AS central,
       coalesce(sum(satelite), 0) AS satelite
  FROM base;

-- 1. apagar o histórico antigo ----------------------------------------
DELETE FROM "TransferenciaPendente";
DELETE FROM "Entrada";

-- 2. uma entrada por lote (central + satélite) -------------------------
INSERT INTO "Entrada"
  (id, medicamento_id, medicamento_nome, lote_id, numero_lote, data_validade,
   data_entrada, quantidade, fornecedor_nome, observacao, created_at)
SELECT 'rebase-e-' || b.lote_id,
       b.medicamento_id,
       b.medicamento_nome,
       b.lote_id,
       b.numero_lote,
       b.data_validade,
       b.data_entrada,
       b.central + b.satelite,
       coalesce(b.fornecedor, 'SALDO INICIAL (migração)'),
       'Entrada recriada a partir da foto do estoque (central + satélite)',
       now()
  FROM base b;

-- 3. uma transferência central → satélite por lote com saldo no satélite
INSERT INTO "TransferenciaPendente"
  (id, medicamento_id, medicamento_nome, lote_id, numero_lote, quantidade,
   direcao, status, data_solicitacao, data_aceite, created_at, origem, observacao)
SELECT 'rebase-t-' || b.lote_id,
       b.medicamento_id,
       b.medicamento_nome,
       b.lote_id,
       b.numero_lote,
       b.satelite,
       'para_satelite',
       'Aceito',
       to_char(b.data_entrada + 1, 'YYYY-MM-DD'),
       to_char(b.data_entrada + 1, 'YYYY-MM-DD'),
       now()::text,
       'migracao_baseline',
       'Transferência recriada a partir da foto do estoque'
  FROM base b
 WHERE b.satelite > 0;

-- 4. saldos do medicamento = soma dos lotes ----------------------------
UPDATE "Medicamento" m
   SET estoque_atual = coalesce((
           SELECT sum(coalesce(l.quantidade_atual, 0))
             FROM "Lote" l WHERE l.medicamento_id = m.id AND l.deleted_at IS NULL), 0),
       estoque_satelite = coalesce((
           SELECT sum(coalesce(l.quantidade_satelite, 0))
             FROM "Lote" l WHERE l.medicamento_id = m.id AND l.deleted_at IS NULL), 0)
 WHERE m.deleted_at IS NULL;

-- 5. conferência dentro da transação ----------------------------------
DO $$
DECLARE
    erros integer;
    ca integer; sa integer;
BEGIN
    SELECT count(*) INTO erros
      FROM "Lote" l
     WHERE l.deleted_at IS NULL
       AND (coalesce(l.quantidade_atual,0) + coalesce(l.quantidade_satelite,0)) > 0
       AND (
             coalesce((SELECT sum(e.quantidade) FROM "Entrada" e WHERE e.lote_id = l.id), 0)
           - coalesce((SELECT sum(t.quantidade) FROM "TransferenciaPendente" t
                        WHERE t.lote_id = l.id AND t.direcao = 'para_satelite'
                          AND t.status = 'Aceito'), 0)
           ) <> coalesce(l.quantidade_atual, 0);

    SELECT coalesce(sum(quantidade_atual),0), coalesce(sum(quantidade_satelite),0)
      INTO ca, sa FROM "Lote" WHERE deleted_at IS NULL;

    IF erros > 0 THEN
        RAISE EXCEPTION 'ABORTADO: % lote(s) não fecham (entrada - transferência <> central)', erros;
    END IF;

    IF ca <> (SELECT central FROM totais_antes) OR sa <> (SELECT satelite FROM totais_antes) THEN
        RAISE EXCEPTION 'ABORTADO: total mudou (antes %/%, depois %/%)',
            (SELECT central FROM totais_antes), (SELECT satelite FROM totais_antes), ca, sa;
    END IF;

    RAISE NOTICE 'Conferência OK: % lote(s), central %, satélite %',
        (SELECT count(*) FROM base), ca, sa;
END $$;

COMMIT;

-- 6. resultado ---------------------------------------------------------
SELECT 'entradas' AS item, count(*) FROM "Entrada"
UNION ALL SELECT 'transferencias', count(*) FROM "TransferenciaPendente"
UNION ALL SELECT 'central', coalesce(sum(coalesce(estoque_atual,0)),0) FROM "Medicamento" WHERE deleted_at IS NULL
UNION ALL SELECT 'satelite', coalesce(sum(coalesce(estoque_satelite,0)),0) FROM "Medicamento" WHERE deleted_at IS NULL;
