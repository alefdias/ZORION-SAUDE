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
\echo '=== arquivadas ==='
SELECT 'duplicadas' AS grupo, count(*) FROM "Saida_arquivo_duplicadas_2026_10_31"
UNION ALL
SELECT 'sem lote', count(*) FROM "Saida_arquivo_sem_lote_2026_10_31";

\echo '=== situação atual da Saida ==='
SELECT count(*) AS total,
       count(*) FILTER (WHERE deleted_at IS NULL) AS ativas
  FROM "Saida";

\echo '=== sobraram duplicadas? (deve ser 0) ==='
SELECT count(*) AS grupos
  FROM (
    SELECT 1
      FROM "Saida"
     WHERE deleted_at IS NULL
       AND coalesce(medicamento_nome, '') NOT LIKE '[LOG%'
     GROUP BY paciente_id, lote_id, medicamento_id, quantidade, data_saida
    HAVING count(*) > 1
  ) x;
