-- ZORION - DIAZEPAM 10 MG com os valores do banco duplicado (29/10)
-- central 17.084 (lotes 9.084 + 8.000) e satelite 557
BEGIN;

UPDATE "Lote"
   SET deleted_at = NULL, status = 'disponivel'
 WHERE id IN ('999d2158-64c1-4e72-a207-b962f491c207','6d377b23-46de-4049-88d7-6115edb29f3a');

-- devolve os lotes ao DIAZEPAM 10 MG
UPDATE "Lote"
   SET medicamento_id = '607364c9-c3a2-4a4f-bc20-6b4b55522ab9'
 WHERE id IN ('999d2158-64c1-4e72-a207-b962f491c207','6d377b23-46de-4049-88d7-6115edb29f3a');

-- quantidades do banco duplicado
UPDATE "Lote" SET quantidade_atual = 9084, quantidade_satelite = 557
 WHERE id = '999d2158-64c1-4e72-a207-b962f491c207';
UPDATE "Lote" SET quantidade_atual = 8000, quantidade_satelite = 0
 WHERE id = '6d377b23-46de-4049-88d7-6115edb29f3a';

-- recalcula o DIAZEPAM 10 MG pela soma dos lotes
UPDATE "Medicamento" m
   SET estoque_atual = coalesce((SELECT sum(coalesce(l.quantidade_atual,0))
                                   FROM "Lote" l WHERE l.medicamento_id = m.id AND l.deleted_at IS NULL),0),
       estoque_satelite = coalesce((SELECT sum(coalesce(l.quantidade_satelite,0))
                                   FROM "Lote" l WHERE l.medicamento_id = m.id AND l.deleted_at IS NULL),0)
 WHERE m.id = '607364c9-c3a2-4a4f-bc20-6b4b55522ab9';

-- o cadastro que ficou com os lotes por engano perde a soma (so o central)
UPDATE "Medicamento" m
   SET estoque_atual = coalesce((SELECT sum(coalesce(l.quantidade_atual,0))
                                   FROM "Lote" l WHERE l.medicamento_id = m.id AND l.deleted_at IS NULL),0)
 WHERE m.id IN ('c2300ec4-11b1-4a7a-832c-7b13f78c35aa','3fac5ddd-303c-4a5f-baf9-f2fa316285ff');

SELECT id, nome, concentracao, apresentacao, estoque_atual, estoque_satelite
  FROM "Medicamento"
 WHERE upper(nome) LIKE '%DIAZEPAM%'
 ORDER BY concentracao, apresentacao;

COMMIT;
