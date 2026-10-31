-- =====================================================================
-- ZORION SAÚDE — 00 — PREPARAR O SCHEMA PARA AS CORREÇÕES
-- =====================================================================
-- Rode PRIMEIRO, no servidor do hospital, antes dos outros scripts.
--
-- O banco de produção (dump de 16/10) não tem duas colunas que o app atual já
-- usa e que os scripts de correção precisam:
--   • "Lote".quantidade_satelite
--   • "Saida".baixa_grupo_id
--
-- O próprio app acrescenta essas colunas ao abrir (ensureTableQuery no
-- db.js). Este arquivo faz o mesmo por SQL, para não depender de abrir a
-- interface primeiro. É idempotente: rodar duas vezes não faz nada.
-- =====================================================================

BEGIN;

ALTER TABLE "Lote"  ADD COLUMN IF NOT EXISTS "quantidade_satelite" INTEGER DEFAULT 0;
ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "baixa_grupo_id" TEXT;
ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "origem" TEXT;

COMMIT;

\echo 'Schema pronto. Agora rode o relatório (2026-10-31_relatorio_duplicidade.sql).'
