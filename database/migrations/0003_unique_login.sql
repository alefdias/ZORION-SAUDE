-- 0003_unique_login.sql
-- Impede novos logins duplicados (inclusive diferença de maiúsculas).
-- Pré-requisito: 0001_dedupe_legado.sql (hoje há 1 login "admin").
-- Idempotente.

CREATE UNIQUE INDEX IF NOT EXISTS ux_usuario_login
  ON "Usuario" (lower("login"))
  WHERE "login" IS NOT NULL;
