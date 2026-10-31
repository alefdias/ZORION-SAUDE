-- =====================================================================
-- ZORION SAÚDE — CORREÇÃO DE DUPLICIDADE (versão curta, para colar)
-- =====================================================================
-- 1) Faça o backup antes (pgAdmin: botão direito no banco → Backup → Custom).
-- 2) Feche o aplicativo em todos os terminais.
-- 3) Cole TUDO isto no Query Tool do pgAdmin e aperte F5.
--
-- O que faz:
--   • cria as 2 colunas que o app criaria sozinho;
--   • une os cadastros de medicamento repetidos (soma o estoque no cadastro
--     que tem os lotes e o histórico, e desativa os outros);
--   • confere no fim se o estoque total continua igual.
--
-- Não apaga nada: os cadastros absorvidos vão para
-- "Medicamento_arquivo_consolidado_2026_10_31".
-- =====================================================================

-- 1. colunas que faltam ------------------------------------------------
BEGIN;
ALTER TABLE "Lote"  ADD COLUMN IF NOT EXISTS "quantidade_satelite" INTEGER DEFAULT 0;
ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "baixa_grupo_id" TEXT;
ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "origem" TEXT;
COMMIT;

-- 2. consolidação dos cadastros duplicados -----------------------------
BEGIN;

CREATE TEMP TABLE estoque_antes AS
SELECT coalesce(sum(coalesce(estoque_atual,0)),0)    AS central,
       coalesce(sum(coalesce(estoque_satelite,0)),0) AS satelite
  FROM "Medicamento" WHERE deleted_at IS NULL;

CREATE TEMP TABLE mapa ON COMMIT DROP AS
WITH dup AS (
  SELECT upper(btrim(nome)) AS n
    FROM "Medicamento" WHERE deleted_at IS NULL
   GROUP BY 1 HAVING count(*) > 1
),
r AS (
  SELECT m.id, upper(btrim(m.nome)) || '|' || upper(btrim(coalesce(m.concentracao,''))) || '|' || upper(btrim(coalesce(m.apresentacao,''))) AS n, m.created_at,
         coalesce(m.estoque_atual,0) + coalesce(m.estoque_satelite,0) AS total,
         (SELECT count(*) FROM "Lote" l WHERE l.medicamento_id = m.id)
       + (SELECT count(*) FROM "Saida" s WHERE s.medicamento_id = m.id)
       + (SELECT count(*) FROM "Entrada" e WHERE e.medicamento_id = m.id)
       + (SELECT count(*) FROM "TransferenciaPendente" t WHERE t.medicamento_id = m.id)
       + (SELECT count(*) FROM "PrescricaoPaciente" p WHERE p."medicamentoId" = m.id) AS refs
    FROM "Medicamento" m WHERE m.deleted_at IS NULL
),
rank AS (
  SELECT r.*, row_number() OVER (
           PARTITION BY r.n ORDER BY r.refs DESC, r.total DESC, r.created_at NULLS LAST, r.id
         ) AS pos
    FROM r JOIN dup d ON d.n = r.n
)
SELECT id, first_value(id) OVER (PARTITION BY n ORDER BY pos) AS sobrevivente FROM rank;

CREATE TEMP TABLE pares ON COMMIT DROP AS
SELECT id AS absorvido, sobrevivente FROM mapa WHERE id <> sobrevivente;

CREATE TABLE IF NOT EXISTS "Medicamento_arquivo_consolidado_2026_10_31"
    (LIKE "Medicamento" INCLUDING DEFAULTS);
ALTER TABLE "Medicamento_arquivo_consolidado_2026_10_31"
    ADD COLUMN IF NOT EXISTS id_sobrevivente TEXT,
    ADD COLUMN IF NOT EXISTS motivo_arquivamento TEXT;

INSERT INTO "Medicamento_arquivo_consolidado_2026_10_31"
SELECT m.*, p.sobrevivente, 'cadastro duplicado consolidado'
  FROM "Medicamento" m JOIN pares p ON p.absorvido = m.id;

UPDATE "Lote"                  x SET medicamento_id = p.sobrevivente FROM pares p WHERE x.medicamento_id = p.absorvido;
UPDATE "Saida"                 x SET medicamento_id = p.sobrevivente FROM pares p WHERE x.medicamento_id = p.absorvido;
UPDATE "Entrada"               x SET medicamento_id = p.sobrevivente FROM pares p WHERE x.medicamento_id = p.absorvido;
UPDATE "TransferenciaPendente" x SET medicamento_id = p.sobrevivente FROM pares p WHERE x.medicamento_id = p.absorvido;
UPDATE "Emprestimo"            x SET medicamento_id = p.sobrevivente FROM pares p WHERE x.medicamento_id = p.absorvido;
UPDATE "InventarioItem"        x SET medicamento_id = p.sobrevivente FROM pares p WHERE x.medicamento_id = p.absorvido;
UPDATE "GavetaPaciente"        x SET medicamento_id = p.sobrevivente FROM pares p WHERE x.medicamento_id = p.absorvido;
UPDATE "CarrinhoEstoqueCentral" x SET medicamento_id = p.sobrevivente FROM pares p WHERE x.medicamento_id = p.absorvido;
UPDATE "CarrinhoEstoqueFisico"  x SET medicamento_id = p.sobrevivente FROM pares p WHERE x.medicamento_id = p.absorvido;
UPDATE "CarrinhoMovimentacao"   x SET medicamento_id = p.sobrevivente FROM pares p WHERE x.medicamento_id = p.absorvido;
UPDATE "CarrinhoPadronizacao"   x SET medicamento_id = p.sobrevivente FROM pares p WHERE x.medicamento_id = p.absorvido;

UPDATE "PrescricaoPaciente" x SET "medicamentoId" = p.sobrevivente
  FROM pares p WHERE x."medicamentoId" = p.absorvido;

UPDATE "PedidoSatelite" ps SET itens_json = replace(ps.itens_json, p.absorvido, p.sobrevivente)
  FROM pares p WHERE ps.itens_json LIKE '%' || p.absorvido || '%';

UPDATE "Medicamento" m
   SET estoque_atual    = t.central,
       estoque_satelite = t.satelite,
       estoque_minimo   = greatest(coalesce(m.estoque_minimo,0), t.minimo)
  FROM (
    SELECT mapa.sobrevivente,
           sum(coalesce(x.estoque_atual,0))    AS central,
           sum(coalesce(x.estoque_satelite,0)) AS satelite,
           max(coalesce(x.estoque_minimo,0))   AS minimo
      FROM "Medicamento" x JOIN mapa ON mapa.id = x.id
     WHERE x.deleted_at IS NULL
     GROUP BY mapa.sobrevivente
  ) t
 WHERE m.id = t.sobrevivente;

UPDATE "Medicamento" m SET ativo = false, deleted_at = now()
  FROM pares p WHERE m.id = p.absorvido;

COMMIT;

-- 3. conferência -------------------------------------------------------
SELECT a.central  AS central_antes,
       d.central  AS central_depois,
       a.satelite AS satelite_antes,
       d.satelite AS satelite_depois,
       (a.central = d.central AND a.satelite = d.satelite) AS estoque_preservado
  FROM estoque_antes a,
       (SELECT coalesce(sum(coalesce(estoque_atual,0)),0)    AS central,
               coalesce(sum(coalesce(estoque_satelite,0)),0) AS satelite
          FROM "Medicamento" WHERE deleted_at IS NULL) d;

SELECT count(*) AS nomes_ainda_duplicados
  FROM (SELECT 1 FROM "Medicamento" WHERE deleted_at IS NULL
         GROUP BY upper(btrim(nome)) HAVING count(*) > 1) x;

SELECT count(*) AS cadastros_arquivados FROM "Medicamento_arquivo_consolidado_2026_10_31";

-- 4. travas (impedem o problema de voltar) -----------------------------
-- Se já existir lote duplicado, o índice não é criado e o script avisa —
-- em vez de abortar tudo.
DO $$
BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_lote_identidade
        ON "Lote" (medicamento_id, upper(btrim(numero_lote)), data_validade);
EXCEPTION WHEN unique_violation THEN
    RAISE NOTICE 'Indice de lote NAO criado: existem lotes duplicados para corrigir antes.';
END $$;

CREATE OR REPLACE FUNCTION fn_lote_saldo_nao_negativo() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.quantidade_atual < 0 OR NEW.quantidade_satelite < 0 THEN
        RAISE EXCEPTION 'Saldo negativo recusado no lote %', NEW.id
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_lote_saldo_nao_negativo ON "Lote";
CREATE TRIGGER tg_lote_saldo_nao_negativo
    BEFORE INSERT OR UPDATE ON "Lote"
    FOR EACH ROW EXECUTE FUNCTION fn_lote_saldo_nao_negativo();

CREATE OR REPLACE FUNCTION fn_auditoria_imutavel() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Auditoria imutavel: % nao permitido', TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS tg_auditoria_imutavel ON "Auditoria";
CREATE TRIGGER tg_auditoria_imutavel
    BEFORE UPDATE OR DELETE ON "Auditoria"
    FOR EACH ROW EXECUTE FUNCTION fn_auditoria_imutavel();

SELECT 'travas aplicadas' AS etapa;
