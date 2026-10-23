-- ==============================================================================
-- RECONCILIAÇÃO DO MACROGOL E AJUSTE DE ESTOQUES DE LOTES
-- ==============================================================================

BEGIN;

-- 1. CORREÇÃO DO LOTE 25A0213 (Macrogol)
-- Este lote estava esgotado mas recebeu 480 un indevidamente por devoluções que apontaram para ele
UPDATE "Lote"
SET "quantidade_atual" = 0,
    "quantidade_satelite" = 0,
    "status" = 'esgotado'
WHERE "id" = '7cf6fe61-7c88-44d6-947e-bf5a9e9db789';

-- 2. CORREÇÃO DO LOTE 25K0759 (Macrogol)
-- Este foi o lote da entrada de 240 un realizada hoje (23/10)
-- Como foi transferido para a Satélite pelo pedido, o saldo fica na Satélite disponível
UPDATE "Lote"
SET "quantidade_atual" = 0,
    "quantidade_satelite" = 240,
    "quantidade_inicial" = 240,
    "status" = 'disponivel'
WHERE "id" = '687e3f8c-388e-4085-a746-b629e1ab88f4';

-- 3. RECONCILIAÇÃO DO MEDICAMENTO MACROGOL
-- Central: 25K0440 (2160 un) + 25K0760 (960 un) = 3120 un
-- Satélite: 25K0440 (36 un) + 25K0759 (240 un) = 276 un
UPDATE "Medicamento"
SET "estoque_atual" = 3120,
    "estoque_satelite" = 276
WHERE "id" = 'd6a4a12c-f060-4401-bdc6-0f7248dbd0d0';

-- 4. RECONCILIAÇÃO GERAL: GARANTE QUE O ESTOQUE DOS MEDICAMENTOS REFLITA EXATAMENTE A SOMA DOS LOTES
UPDATE "Medicamento" m
SET "estoque_atual" = COALESCE((
    SELECT SUM("quantidade_atual")
    FROM "Lote" l
    WHERE l."medicamento_id" = m."id"
), 0)
WHERE m."id" IN (
    SELECT DISTINCT "medicamento_id" FROM "Lote"
);

COMMIT;
