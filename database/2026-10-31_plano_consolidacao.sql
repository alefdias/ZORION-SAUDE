-- =====================================================================
-- ZORION SAÚDE — PLANO DE CONSOLIDAÇÃO DOS CADASTROS DUPLICADOS
-- =====================================================================
-- SOMENTE LEITURA. Não altera nada.
--
-- O banco "Zorion" tem 275 cadastros de medicamento para 220 nomes: 43 nomes
-- aparecem em 98 cadastros (55 excedentes), e em 33 desses grupos o estoque
-- está dividido entre cadastros diferentes.
--
-- Regra do sobrevivente (a que menos mexe no histórico):
--   1. mais referências (lotes + saídas + entradas + transferências + prescrições)
--   2. maior saldo total (central + satélite)
--   3. cadastro mais antigo
--   4. id, para desempate determinístico
--
--   psql -h HOST -U postgres -d Zorion -f 2026-10-31_plano_consolidacao.sql
-- =====================================================================

\echo '=== RESUMO POR NOME (43 grupos) ==='
WITH dup AS (
  SELECT upper(btrim(nome)) AS nome
    FROM "Medicamento"
   GROUP BY 1 HAVING count(*) > 1
),
refs AS (
  SELECT m.id,
         upper(btrim(m.nome))          AS nome_norm,
         m.codigo,
         m.created_at,
         coalesce(m.estoque_atual, 0)    AS central,
         coalesce(m.estoque_satelite, 0) AS satelite,
         (SELECT count(*) FROM "Lote" l WHERE l.medicamento_id = m.id)                    AS lotes,
         (SELECT count(*) FROM "Saida" s WHERE s.medicamento_id = m.id)                   AS saidas,
         (SELECT count(*) FROM "Entrada" e WHERE e.medicamento_id = m.id)                 AS entradas,
         (SELECT count(*) FROM "TransferenciaPendente" t WHERE t.medicamento_id = m.id)   AS transf,
         (SELECT count(*) FROM "PrescricaoPaciente" p WHERE p."medicamentoId" = m.id)     AS prescricoes
    FROM "Medicamento" m
),
rank AS (
  SELECT r.*,
         row_number() OVER (
           PARTITION BY r.nome_norm
           ORDER BY (r.lotes + r.saidas + r.entradas + r.transf + r.prescricoes) DESC,
                    (r.central + r.satelite) DESC,
                    r.created_at ASC NULLS LAST,
                    r.id
         ) AS posicao
    FROM refs r
    JOIN dup d ON d.nome = r.nome_norm
)
SELECT nome_norm                                      AS medicamento,
       count(*)                                       AS cadastros,
       sum(central)                                   AS central_somada,
       sum(satelite)                                  AS satelite_somada,
       sum(central + satelite)                        AS total_somado,
       max(codigo) FILTER (WHERE posicao = 1)         AS sobrevivente_codigo,
       max(id)     FILTER (WHERE posicao = 1)         AS sobrevivente_id
  FROM rank
 GROUP BY nome_norm
 ORDER BY sum(central + satelite) DESC, nome_norm;

\echo ''
\echo '=== DETALHE DOS CADASTROS (quem sobrevive e quem é absorvido) ==='
WITH dup AS (
  SELECT upper(btrim(nome)) AS nome
    FROM "Medicamento"
   GROUP BY 1 HAVING count(*) > 1
),
refs AS (
  SELECT m.id,
         upper(btrim(m.nome))          AS nome_norm,
         m.codigo,
         m.created_at,
         coalesce(m.estoque_atual, 0)    AS central,
         coalesce(m.estoque_satelite, 0) AS satelite,
         (SELECT count(*) FROM "Lote" l WHERE l.medicamento_id = m.id)                    AS lotes,
         (SELECT count(*) FROM "Saida" s WHERE s.medicamento_id = m.id)                   AS saidas,
         (SELECT count(*) FROM "Entrada" e WHERE e.medicamento_id = m.id)                 AS entradas,
         (SELECT count(*) FROM "TransferenciaPendente" t WHERE t.medicamento_id = m.id)   AS transf,
         (SELECT count(*) FROM "PrescricaoPaciente" p WHERE p."medicamentoId" = m.id)     AS prescricoes
    FROM "Medicamento" m
),
rank AS (
  SELECT r.*,
         row_number() OVER (
           PARTITION BY r.nome_norm
           ORDER BY (r.lotes + r.saidas + r.entradas + r.transf + r.prescricoes) DESC,
                    (r.central + r.satelite) DESC,
                    r.created_at ASC NULLS LAST,
                    r.id
         ) AS posicao
    FROM refs r
    JOIN dup d ON d.nome = r.nome_norm
)
SELECT nome_norm                        AS medicamento,
       posicao,
       CASE WHEN posicao = 1 THEN 'SOBREVIVE' ELSE 'absorvido' END AS papel,
       codigo,
       substr(id, 1, 8)                 AS id_curto,
       central,
       satelite,
       lotes,
       saidas,
       entradas,
       transf                           AS transferencias,
       prescricoes
  FROM rank
 ORDER BY nome_norm, posicao;
