-- =====================================================================
-- ZORION SAÚDE — APLICAR AS CORREÇÕES DE DUPLICIDADE (arquivo único)
-- =====================================================================
-- Rode com o aplicativo FECHADO em todos os terminais.
--
-- No pgAdmin: clique com o botão direito no banco Zorion → Backup (formato
-- Custom) ANTES de rodar isto. Depois: Query Tool → abrir este arquivo → F5.
--
-- No terminal:
--   psql -h 127.0.0.1 -U postgres -d Zorion -v ON_ERROR_STOP=1 -f ESTE_ARQUIVO.sql
--
-- O que faz, em ordem:
--   01 acrescenta as 2 colunas que o app criaria sozinho;
--   02 põe as travas (lote único, saldo não negativo, auditoria imutável);
--   03 arquiva e remove as saídas duplicadas e sem lote;
--   04 consolida os cadastros de medicamento repetidos (soma o estoque).
--
-- Nada é apagado sem ir para uma tabela de arquivo. O estoque total não muda.
-- Cada bloco é transacional: ou aplica inteiro, ou não aplica nada.
-- =====================================================================

-- =====================================================================
-- 01 · PREPARAR SCHEMA
-- =====================================================================
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

-- =====================================================================
-- 02 · TRAVAS
-- =====================================================================
-- =====================================================================
-- ZORION SAÚDE — TRAVAS CONTRA A DUPLICIDADE  (aplicado em 31/10/2026)
-- =====================================================================
-- Banco: "Zorion" em 127.0.0.1:5432
-- Backup antes: ~/Documentos/zorion-backups/Zorion_2026-10-31_075321.dump
--
-- Este arquivo é idempotente: pode ser rodado de novo sem erro.
-- Nada aqui apaga dados. Só impede que o problema volte.
--
--   psql -h HOST -U postgres -d Zorion -f 2026-10-31_travas_duplicidade.sql
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Lote: a identidade é (medicamento, número, validade)
-- ---------------------------------------------------------------------
-- O app antigo casa lote por `numero_lote` (string), então dois lotes com o
-- mesmo número e validades diferentes recebiam o mesmo movimento.
CREATE UNIQUE INDEX IF NOT EXISTS uq_lote_identidade
    ON "Lote" (medicamento_id, upper(btrim(numero_lote)), data_validade);

-- ---------------------------------------------------------------------
-- 2. Saída: quantidade não pode ser negativa
-- ---------------------------------------------------------------------
-- `>= 0` (e não `> 0`) porque o app grava 50 registros de LOG de exclusão com
-- quantidade 0.
ALTER TABLE "Saida" DROP CONSTRAINT IF EXISTS ck_saida_quantidade_nao_negativa;
ALTER TABLE "Saida"
    ADD CONSTRAINT ck_saida_quantidade_nao_negativa CHECK (quantidade >= 0);

-- ---------------------------------------------------------------------
-- 3. Saída: limite de sanidade
-- ---------------------------------------------------------------------
ALTER TABLE "Saida" DROP CONSTRAINT IF EXISTS ck_saida_quantidade_plausivel;
ALTER TABLE "Saida"
    ADD CONSTRAINT ck_saida_quantidade_plausivel CHECK (quantidade <= 100000);

-- ---------------------------------------------------------------------
-- 4. Dispensação idempotente (por grupo de baixa)
-- ---------------------------------------------------------------------
-- Índice parcial: só vale quando o campo está preenchido, então pode ser
-- criado agora mesmo com o app antigo ainda não gravando o campo.
CREATE UNIQUE INDEX IF NOT EXISTS uq_saida_grupo
    ON "Saida" (baixa_grupo_id)
    WHERE baixa_grupo_id IS NOT NULL;

-- ---------------------------------------------------------------------
-- 5. Saldo de lote não pode ficar negativo
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_lote_saldo_nao_negativo() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.quantidade_atual < 0 OR NEW.quantidade_satelite < 0 THEN
        RAISE EXCEPTION
            'Saldo negativo recusado no lote % (central=%, satélite=%)',
            NEW.id, NEW.quantidade_atual, NEW.quantidade_satelite
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_lote_saldo_nao_negativo ON "Lote";
CREATE TRIGGER tg_lote_saldo_nao_negativo
    BEFORE INSERT OR UPDATE ON "Lote"
    FOR EACH ROW EXECUTE FUNCTION fn_lote_saldo_nao_negativo();

-- ---------------------------------------------------------------------
-- 6. Auditoria imutável
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_auditoria_imutavel() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Auditoria é imutável: % não permitido', TG_OP
        USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS tg_auditoria_imutavel ON "Auditoria";
CREATE TRIGGER tg_auditoria_imutavel
    BEFORE UPDATE OR DELETE ON "Auditoria"
    FOR EACH ROW EXECUTE FUNCTION fn_auditoria_imutavel();

COMMIT;

-- ---------------------------------------------------------------------
-- NÃO aplicado de propósito
-- ---------------------------------------------------------------------
-- FK de "Saida".lote_id → "Lote".id: existem 23 saídas apontando para lote
-- que não existe mais. Criar a FK como NOT VALID passaria, mas qualquer
-- dispensação que grave um lote_id inválido passaria a falhar em produção —
-- e isso precisa de teste antes. Quando os 23 casos forem corrigidos:
--
--   ALTER TABLE "Saida" ADD CONSTRAINT fk_saida_lote
--       FOREIGN KEY (lote_id) REFERENCES "Lote"(id) NOT VALID;
--   -- depois de um período sem novas violações:
--   ALTER TABLE "Saida" VALIDATE CONSTRAINT fk_saida_lote;
--
-- `baixa_grupo_id` NOT NULL: depende do app passar a preencher o campo em
-- todas as baixas (ver plano no README de correções).

-- =====================================================================
-- 03 · LIMPAR SAÍDAS DUPLICADAS E ÓRFÃS
-- =====================================================================
-- =====================================================================
-- ZORION SAÚDE — LIMPEZA DAS LINHAS DUPLICADAS E ÓRFÃS
-- =====================================================================
-- Banco: "Zorion" em 127.0.0.1:5432
-- Backup: ~/Documentos/zorion-backups/Zorion_2026-10-31_075321.dump
--
-- Nada é apagado sem antes ir para uma tabela de arquivo — dá para conferir
-- e restaurar linha por linha.
--
-- O SALDO NÃO É ALTERADO. Apagar a linha duplicada não devolve a unidade ao
-- estoque: o ajuste de saldo é decisão separada, e por inferência seria
-- repetir exatamente o erro que criou o problema.
--
-- Pode rodar de novo: depois da primeira execução não sobra nada para mover.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Arquivos (espelho da tabela + motivo)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Saida_arquivo_duplicadas_2026_10_31"
    (LIKE "Saida" INCLUDING DEFAULTS);
ALTER TABLE "Saida_arquivo_duplicadas_2026_10_31"
    ADD COLUMN IF NOT EXISTS motivo_arquivamento TEXT;

CREATE TABLE IF NOT EXISTS "Saida_arquivo_sem_lote_2026_10_31"
    (LIKE "Saida" INCLUDING DEFAULTS);
ALTER TABLE "Saida_arquivo_sem_lote_2026_10_31"
    ADD COLUMN IF NOT EXISTS motivo_arquivamento TEXT;

-- ---------------------------------------------------------------------
-- 1. Duplicadas: mantém a mais antiga de cada grupo, arquiva o resto
-- ---------------------------------------------------------------------
CREATE TEMP TABLE tmp_dup AS
SELECT id,
       row_number() OVER (
           PARTITION BY paciente_id, lote_id, medicamento_id, quantidade, data_saida
           ORDER BY created_at, id
       ) AS ordem
  FROM "Saida"
 WHERE deleted_at IS NULL
   AND coalesce(medicamento_nome, '') NOT LIKE '[LOG%';

INSERT INTO "Saida_arquivo_duplicadas_2026_10_31"
SELECT s.*,
       'duplicata: mesmo paciente/lote/quantidade/data; mantida a mais antiga'
  FROM "Saida" s
  JOIN tmp_dup d ON d.id = s.id
 WHERE d.ordem > 1;

DELETE FROM "Saida" s
 USING tmp_dup d
 WHERE d.id = s.id
   AND d.ordem > 1;

-- ---------------------------------------------------------------------
-- 2. Sem lote válido (lote_id nulo ou apontando para lote inexistente)
-- ---------------------------------------------------------------------
CREATE TEMP TABLE tmp_orfas AS
SELECT s.id,
       CASE WHEN s.lote_id IS NULL
            THEN 'saída sem lote informado'
            ELSE 'saída aponta para lote que não existe mais'
       END AS motivo
  FROM "Saida" s
  LEFT JOIN "Lote" l ON l.id = s.lote_id
 WHERE s.deleted_at IS NULL
   AND coalesce(s.medicamento_nome, '') NOT LIKE '[LOG%'
   AND (s.lote_id IS NULL OR l.id IS NULL)
   AND NOT EXISTS (SELECT 1 FROM "Saida_arquivo_duplicadas_2026_10_31" a WHERE a.id = s.id);

INSERT INTO "Saida_arquivo_sem_lote_2026_10_31"
SELECT s.*, o.motivo
  FROM "Saida" s
  JOIN tmp_orfas o ON o.id = s.id;

DELETE FROM "Saida" s
 USING tmp_orfas o
 WHERE o.id = s.id;

COMMIT;

-- ---------------------------------------------------------------------
-- Conferência
-- ---------------------------------------------------------------------

SELECT 'duplicadas' AS grupo, count(*) FROM "Saida_arquivo_duplicadas_2026_10_31"
UNION ALL
SELECT 'sem lote', count(*) FROM "Saida_arquivo_sem_lote_2026_10_31";

SELECT count(*) AS total,
       count(*) FILTER (WHERE deleted_at IS NULL) AS ativas
  FROM "Saida";

SELECT count(*) AS grupos
  FROM (
    SELECT 1
      FROM "Saida"
     WHERE deleted_at IS NULL
       AND coalesce(medicamento_nome, '') NOT LIKE '[LOG%'
     GROUP BY paciente_id, lote_id, medicamento_id, quantidade, data_saida
    HAVING count(*) > 1
  ) x;

-- =====================================================================
-- 04 · CONSOLIDAR CADASTROS DUPLICADOS
-- =====================================================================
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
  SELECT upper(btrim(nome)) AS nome
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
