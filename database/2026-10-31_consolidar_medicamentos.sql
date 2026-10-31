-- =====================================================================
-- ZORION SAÚDE — CONSOLIDAÇÃO DOS CADASTROS DUPLICADOS DE MEDICAMENTO
-- =====================================================================
-- Banco: "Zorion" em 127.0.0.1:5432
-- Backup obrigatório antes: ~/Documentos/zorion-backups/Zorion_2026-10-31_075321.dump
--
-- O que faz, por nome duplicado:
--   1. escolhe o cadastro sobrevivente (o que tem mais histórico);
--   2. repointa lote, saída, entrada, transferência, prescrição, carrinho,
--      empréstimo, gaveta e inventário para o sobrevivente;
--   3. soma os saldos (central e satélite) no sobrevivente;
--   4. arquiva e desativa (soft delete) o cadastro absorvido.
--
-- O TOTAL DE ESTOQUE NÃO MUDA — só deixa de estar partido em dois cadastros.
-- Nada é apagado: os cadastros absorvidos vão para
-- "Medicamento_arquivo_consolidado_2026_10_31".
--
--   psql -h HOST -U postgres -d Zorion -v ON_ERROR_STOP=1 \
--        -f 2026-10-31_consolidar_medicamentos.sql
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Fotografia do estoque antes (para provar que nada se perdeu)
-- ---------------------------------------------------------------------
CREATE TEMP TABLE estoque_antes AS
SELECT coalesce(sum(coalesce(estoque_atual, 0)), 0)    AS central,
       coalesce(sum(coalesce(estoque_satelite, 0)), 0) AS satelite
  FROM "Medicamento"
 WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------
-- 1. Plano: sobrevivente por nome
-- ---------------------------------------------------------------------
CREATE TEMP TABLE plano ON COMMIT DROP AS
WITH dup AS (
  -- NOME + CONCENTRAÇÃO + APRESENTAÇÃO: 25 MG e 100 MG não são duplicados
  SELECT upper(btrim(nome)) || '|' ||
         upper(btrim(coalesce(concentracao,''))) || '|' ||
         upper(btrim(coalesce(apresentacao,''))) AS nome
    FROM "Medicamento"
   WHERE deleted_at IS NULL
   GROUP BY 1 HAVING count(*) > 1
),
refs AS (
  SELECT m.id,
         upper(btrim(m.nome))            AS nome_norm,
         coalesce(m.estoque_atual, 0)    AS central,
         coalesce(m.estoque_satelite, 0) AS satelite,
         m.created_at,
         (SELECT count(*) FROM "Lote" l WHERE l.medicamento_id = m.id)
       + (SELECT count(*) FROM "Saida" s WHERE s.medicamento_id = m.id)
       + (SELECT count(*) FROM "Entrada" e WHERE e.medicamento_id = m.id)
       + (SELECT count(*) FROM "TransferenciaPendente" t WHERE t.medicamento_id = m.id)
       + (SELECT count(*) FROM "PrescricaoPaciente" p WHERE p."medicamentoId" = m.id) AS referencias
    FROM "Medicamento" m
   WHERE m.deleted_at IS NULL
)
SELECT r.id,
       r.nome_norm,
       row_number() OVER (
         PARTITION BY r.nome_norm
         ORDER BY r.referencias DESC,
                  (r.central + r.satelite) DESC,
                  r.created_at ASC NULLS LAST,
                  r.id
       ) AS posicao
  FROM refs r
  JOIN dup d ON d.nome = r.nome_norm;

-- mapa: todo cadastro do grupo → id do sobrevivente
CREATE TEMP TABLE mapa ON COMMIT DROP AS
SELECT p.id,
       s.id AS sobrevivente
  FROM plano p
  JOIN plano s ON s.nome_norm = p.nome_norm AND s.posicao = 1;

-- pares: só os absorvidos
CREATE TEMP TABLE pares ON COMMIT DROP AS
SELECT m.id AS absorvido, m.sobrevivente
  FROM mapa m
  JOIN plano p ON p.id = m.id
 WHERE p.posicao > 1;

-- ---------------------------------------------------------------------
-- 2. Arquivo dos cadastros que serão absorvidos
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Medicamento_arquivo_consolidado_2026_10_31"
    (LIKE "Medicamento" INCLUDING DEFAULTS);
ALTER TABLE "Medicamento_arquivo_consolidado_2026_10_31"
    ADD COLUMN IF NOT EXISTS id_sobrevivente TEXT,
    ADD COLUMN IF NOT EXISTS motivo_arquivamento TEXT;

INSERT INTO "Medicamento_arquivo_consolidado_2026_10_31"
SELECT m.*, p.sobrevivente, 'cadastro duplicado consolidado no sobrevivente'
  FROM "Medicamento" m
  JOIN pares p ON p.absorvido = m.id;

-- ---------------------------------------------------------------------
-- 3. Repontar tudo o que aponta para o cadastro absorvido
-- ---------------------------------------------------------------------
UPDATE "Lote"                x SET medicamento_id = p.sobrevivente FROM pares p WHERE x.medicamento_id = p.absorvido;
UPDATE "Saida"               x SET medicamento_id = p.sobrevivente FROM pares p WHERE x.medicamento_id = p.absorvido;
UPDATE "Entrada"             x SET medicamento_id = p.sobrevivente FROM pares p WHERE x.medicamento_id = p.absorvido;
UPDATE "TransferenciaPendente" x SET medicamento_id = p.sobrevivente FROM pares p WHERE x.medicamento_id = p.absorvido;
UPDATE "Emprestimo"          x SET medicamento_id = p.sobrevivente FROM pares p WHERE x.medicamento_id = p.absorvido;
UPDATE "InventarioItem"      x SET medicamento_id = p.sobrevivente FROM pares p WHERE x.medicamento_id = p.absorvido;
UPDATE "GavetaPaciente"      x SET medicamento_id = p.sobrevivente FROM pares p WHERE x.medicamento_id = p.absorvido;
UPDATE "CarrinhoEstoqueCentral"  x SET medicamento_id = p.sobrevivente FROM pares p WHERE x.medicamento_id = p.absorvido;
UPDATE "CarrinhoEstoqueFisico"   x SET medicamento_id = p.sobrevivente FROM pares p WHERE x.medicamento_id = p.absorvido;
UPDATE "CarrinhoMovimentacao"    x SET medicamento_id = p.sobrevivente FROM pares p WHERE x.medicamento_id = p.absorvido;
UPDATE "CarrinhoPadronizacao"    x SET medicamento_id = p.sobrevivente FROM pares p WHERE x.medicamento_id = p.absorvido;

UPDATE "PrescricaoPaciente" x
   SET "medicamentoId" = p.sobrevivente
  FROM pares p
 WHERE x."medicamentoId" = p.absorvido;

-- Pedido da satélite guarda os itens em JSON: troca o id dentro do texto.
UPDATE "PedidoSatelite" ps
   SET itens_json = replace(ps.itens_json, p.absorvido, p.sobrevivente)
  FROM pares p
 WHERE ps.itens_json LIKE '%' || p.absorvido || '%';

-- ---------------------------------------------------------------------
-- 4. Somar os saldos no sobrevivente
-- ---------------------------------------------------------------------
UPDATE "Medicamento" m
   SET estoque_atual    = t.central,
       estoque_satelite = t.satelite,
       estoque_minimo   = greatest(coalesce(m.estoque_minimo, 0), t.minimo)
  FROM (
    SELECT mapa.sobrevivente,
           sum(coalesce(x.estoque_atual, 0))    AS central,
           sum(coalesce(x.estoque_satelite, 0)) AS satelite,
           max(coalesce(x.estoque_minimo, 0))   AS minimo
      FROM "Medicamento" x
      JOIN mapa ON mapa.id = x.id
     WHERE x.deleted_at IS NULL
     GROUP BY mapa.sobrevivente
  ) t
 WHERE m.id = t.sobrevivente;

-- ---------------------------------------------------------------------
-- 5. Desativar os absorvidos (soft delete — continuam no arquivo)
-- ---------------------------------------------------------------------
UPDATE "Medicamento" m
   SET ativo = false,
       deleted_at = now()
  FROM pares p
 WHERE m.id = p.absorvido;

COMMIT;

-- ---------------------------------------------------------------------
-- 6. Prova de que o estoque não mudou
-- ---------------------------------------------------------------------
\echo '=== conferência: estoque antes x depois ==='
SELECT a.central  AS central_antes,
       d.central  AS central_depois,
       a.satelite AS satelite_antes,
       d.satelite AS satelite_depois,
       (a.central = d.central AND a.satelite = d.satelite) AS estoque_preservado
  FROM estoque_antes a,
       (SELECT coalesce(sum(coalesce(estoque_atual, 0)), 0)    AS central,
               coalesce(sum(coalesce(estoque_satelite, 0)), 0) AS satelite
          FROM "Medicamento"
         WHERE deleted_at IS NULL) d;

SELECT count(*) AS nomes_ainda_duplicados
  FROM (
    SELECT 1 FROM "Medicamento"
     WHERE deleted_at IS NULL
     GROUP BY upper(btrim(nome)) HAVING count(*) > 1
  ) x;

SELECT count(*) AS arquivados FROM "Medicamento_arquivo_consolidado_2026_10_31";
