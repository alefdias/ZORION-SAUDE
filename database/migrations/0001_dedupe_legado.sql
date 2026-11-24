-- 0001_dedupe_legado.sql
-- Remove duplicidades de ID que impedem a criação de chaves primárias.
-- Regra: manter a linha ATIVA mais recente; entre ativas, a mais nova.
-- Idempotente: rodar de novo não remove nada além do que já foi removido.
--
-- ACHADOS (24/11/2026):
--   Usuario: 62 linhas idênticas, 1 único id  -> mantém 1
--   Ala:      6 ids com 2 versões (1 excluída) -> mantém a ativa
--
-- NÃO TOCA em nenhuma outra tabela.

BEGIN;

-- Usuario ------------------------------------------------------------------
WITH ranked AS (
  SELECT ctid,
         row_number() OVER (
           PARTITION BY id
           ORDER BY (deleted_at IS NULL) DESC, created_at DESC NULLS LAST, ctid DESC
         ) AS rn
  FROM "Usuario"
)
DELETE FROM "Usuario" u
USING ranked r
WHERE u.ctid = r.ctid
  AND r.rn > 1;

-- Ala ----------------------------------------------------------------------
WITH ranked AS (
  SELECT ctid,
         row_number() OVER (
           PARTITION BY id
           ORDER BY (deleted_at IS NULL) DESC, created_at DESC NULLS LAST, ctid DESC
         ) AS rn
  FROM "Ala"
)
DELETE FROM "Ala" a
USING ranked r
WHERE a.ctid = r.ctid
  AND r.rn > 1;

COMMIT;
