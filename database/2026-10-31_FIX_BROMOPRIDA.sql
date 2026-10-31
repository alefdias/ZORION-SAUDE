-- ZORION - BROMOPRIDA: devolver os lotes ao cadastro certo
BEGIN;
CREATE TEMP TABLE mapa (lote_id text, med_id text) ON COMMIT DROP;
INSERT INTO mapa (lote_id, med_id) VALUES
  ('2b958d52-3a52-41d3-9982-f0448d2d07f9','4ea3b0ca-3f0a-4b22-845e-35f05dc81dbf'),
  ('5ae6511f-f0e7-4e45-a0af-c985d2c1f571','25ac7b76-b499-4c4b-b42c-647d1558fe3f'),
  ('7231a726-fdc2-4234-b4f0-5171f88f4b36','e5695167-7a33-4cc4-9ea1-f186841e781f'),
  ('a97cded0-9768-408f-815a-90ec01f12a70','4ea3b0ca-3f0a-4b22-845e-35f05dc81dbf'),
  ('ba22b5de-3e91-4fa3-991b-4d54b63b8a00','e5695167-7a33-4cc4-9ea1-f186841e781f');

CREATE TEMP TABLE mov ON COMMIT DROP AS
SELECT l.id lote_id, l.medicamento_id atual, m.med_id destino,
       coalesce(l.quantidade_satelite,0) qs
  FROM "Lote" l JOIN mapa m ON m.lote_id = l.id
 WHERE l.medicamento_id IS DISTINCT FROM m.med_id;

SELECT 'LOTES A DEVOLVER' AS etapa, count(*) AS lotes FROM mov;

UPDATE "Lote" l SET medicamento_id = m.destino FROM mov m WHERE l.id = m.lote_id;

UPDATE "Medicamento" x
   SET estoque_atual = coalesce((
         SELECT sum(coalesce(l.quantidade_atual,0)) FROM "Lote" l
          WHERE l.medicamento_id = x.id AND l.deleted_at IS NULL),0)
 WHERE x.id IN ('25ac7b76-b499-4c4b-b42c-647d1558fe3f','4ea3b0ca-3f0a-4b22-845e-35f05dc81dbf','e5695167-7a33-4cc4-9ea1-f186841e781f');

WITH d AS (
  SELECT id, sum(qs) qs FROM (
    SELECT atual id, -qs qs FROM mov UNION ALL SELECT destino id, qs FROM mov
  ) z GROUP BY id
)
UPDATE "Medicamento" x
   SET estoque_satelite = greatest(0, coalesce(x.estoque_satelite,0) + d.qs)
  FROM d WHERE x.id = d.id AND d.qs <> 0;

SELECT nome, concentracao, apresentacao, estoque_atual, estoque_satelite
  FROM "Medicamento" WHERE upper(nome) LIKE '%BROMOPRIDA%' ORDER BY concentracao;
COMMIT;
