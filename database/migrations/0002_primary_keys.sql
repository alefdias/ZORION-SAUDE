-- 0002_primary_keys.sql
-- Adiciona chave primária em toda tabela que tenha coluna "id" NOT NULL,
-- exceto arquivos históricos (Saida_arquivo_*) e tabelas que já têm PK.
--
-- Pré-requisito: 0001_dedupe_legado.sql (sem IDs duplicados).
-- Seguro para dado legado: não altera valores, apenas a constraint.
-- Idempotente: não recria PK existente.

DO $$
DECLARE
  r record;
  cname text;
  reg regclass;
BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.column_name = 'id'
      AND c.is_nullable = 'NO'
      AND c.table_name NOT LIKE 'Saida_arquivo_%'
    ORDER BY c.table_name
  LOOP
    reg := (quote_ident('public') || '.' || quote_ident(r.table_name))::regclass;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = reg AND contype = 'p'
    ) THEN
      cname := 'pk_' || lower(r.table_name);
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I PRIMARY KEY ("id")', r.table_name, cname);
      RAISE NOTICE 'PK criada em %', r.table_name;
    END IF;
  END LOOP;
END $$;
