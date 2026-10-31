-- =====================================================================
-- ZORION SAÚDE — DIAGNÓSTICO DE DUPLICIDADE (somente leitura)
-- =====================================================================
-- Rode antes de qualquer correção, no banco do hospital:
--   psql -h HOST -U postgres -d BANCO -f 2026-10-31_relatorio_duplicidade.sql
--
-- Nenhum comando aqui altera dados. Serve para saber o tamanho do problema
-- antes de mexer — e para comparar depois.
-- =====================================================================

\echo '=== 1. Saídas idênticas (mesmo paciente, lote, quantidade e data) ==='
SELECT paciente_nome,
       medicamento_nome,
       numero_lote,
       quantidade,
       data_saida,
       count(*)                                    AS repeticoes,
       min(created_at)                             AS primeiro_lancamento,
       max(created_at) - min(created_at)           AS intervalo
  FROM "Saida"
 WHERE deleted_at IS NULL
   AND coalesce(medicamento_nome, '') NOT LIKE '[LOG%'
 GROUP BY paciente_nome, medicamento_nome, lote_id, numero_lote, quantidade, data_saida
HAVING count(*) > 1
 ORDER BY repeticoes DESC, intervalo DESC;

\echo '=== 2. Total: linhas e unidades contadas mais de uma vez ==='
WITH g AS (
  SELECT paciente_id, lote_id, medicamento_id, quantidade, data_saida, count(*) AS reps
    FROM "Saida"
   WHERE deleted_at IS NULL
     AND coalesce(medicamento_nome, '') NOT LIKE '[LOG%'
   GROUP BY 1, 2, 3, 4, 5
  HAVING count(*) > 1
)
SELECT sum(reps)                    AS linhas_envolvidas,
       sum(reps - 1)                AS linhas_repetidas,
       sum((reps - 1) * quantidade) AS unidades_duplicadas
  FROM g;

\echo '=== 3. Central: campo do medicamento x soma dos lotes ==='
WITH por_med AS (
  SELECT m.id, m.nome,
         coalesce(m.estoque_atual, 0)        AS campo,
         coalesce(sum(l.quantidade_atual), 0) AS soma_lotes
    FROM "Medicamento" m
    LEFT JOIN "Lote" l ON l.medicamento_id = m.id
   GROUP BY 1, 2, 3
)
SELECT count(*) FILTER (WHERE campo <> soma_lotes) AS medicamentos_divergentes,
       sum(abs(campo - soma_lotes))                AS unidades_de_diferenca
  FROM por_med;

\echo '=== 4. Satélite: campo do medicamento x soma dos lotes ==='
WITH por_med AS (
  SELECT m.id, m.nome,
         coalesce(m.estoque_satelite, 0)           AS campo,
         coalesce(sum(l.quantidade_satelite), 0)   AS soma_lotes
    FROM "Medicamento" m
    LEFT JOIN "Lote" l ON l.medicamento_id = m.id
   GROUP BY 1, 2, 3
)
SELECT nome,
       campo,
       soma_lotes,
       (campo - soma_lotes) AS diferenca
  FROM por_med
 WHERE campo <> soma_lotes
 ORDER BY abs(campo - soma_lotes) DESC;

\echo '=== 5. Lotes com identidade ambígua (mesmo medicamento + número) ==='
SELECT m.nome,
       l.numero_lote,
       count(DISTINCT l.data_validade) AS validades,
       string_agg(to_char(l.data_validade, 'DD/MM/YYYY'), ' · ') AS datas
  FROM "Lote" l
  JOIN "Medicamento" m ON m.id = l.medicamento_id
 GROUP BY m.nome, l.numero_lote
HAVING count(DISTINCT l.data_validade) > 1
 ORDER BY m.nome;

\echo '=== 6. Saídas sem lote válido (rastreabilidade quebrada) ==='
SELECT count(*) FILTER (WHERE lote_id IS NULL)                          AS sem_lote_id,
       count(*) FILTER (WHERE lote_id IS NOT NULL AND l.id IS NULL)     AS lote_inexistente
  FROM "Saida" s
  LEFT JOIN "Lote" l ON l.id = s.lote_id
 WHERE s.deleted_at IS NULL
   AND coalesce(s.medicamento_nome, '') NOT LIKE '[LOG%';

\echo '=== 7. Lotes com quantidade negativa (não deveria existir) ==='
SELECT count(*) FILTER (WHERE quantidade_atual < 0)   AS central_negativo,
       count(*) FILTER (WHERE quantidade_satelite < 0) AS satelite_negativo
  FROM "Lote";
