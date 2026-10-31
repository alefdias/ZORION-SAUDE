-- =====================================================================
-- ZORION SAÚDE — CORRIGIR O CAMINHO DA DISPENSAÇÃO
-- =====================================================================
-- No sistema antigo a dispensação saía direto do ALMOXARIFADO CENTRAL para o
-- paciente. O certo é: central → satélite → paciente.
--
-- Este script não muda quantidade nenhuma. Ele:
--   1. cria a transferência CENTRAL → SATÉLITE que faltava, com a mesma data
--      (e antes) da saída;
--   2. marca a saída como vinda da SATÉLITE.
--
-- Efeito: o satélite passa a mostrar a entrada (transferência) e a saída
-- (dispensação) — net zero nele — e a central é debitada pela transferência,
-- como deveria. O estoque total do hospital NÃO muda.
--
-- É idempotente (id 'migr-<id-da-saida>'), pode rodar de novo.
-- Rode com o aplicativo fechado. Faça backup antes.
-- =====================================================================

-- 0. CONFIRA ANTES (só leitura) --------------------------------------
SELECT count(*) AS dispensacoes_a_reclassificar,
       coalesce(sum(quantidade),0) AS unidades
  FROM "Saida"
 WHERE deleted_at IS NULL
   AND origem IS NULL
   AND (paciente_id IS NOT NULL OR paciente_nome IS NOT NULL)
   AND coalesce(medicamento_nome,'') NOT LIKE '[LOG%'
   AND lote_id IS NOT NULL
   AND coalesce(quantidade,0) > 0
   AND NOT EXISTS (
       SELECT 1 FROM "TransferenciaPendente" t
        WHERE t.lote_id = "Saida".lote_id
          AND t.direcao = 'para_satelite'
          AND t.status = 'Aceito'
          AND coalesce(t.deleted_at, '') = ''
          AND t.data_aceite::date <= "Saida".data_saida::date
   );

BEGIN;

-- 1. cria a transferência que faltava --------------------------------
INSERT INTO "TransferenciaPendente"
  (id, medicamento_id, medicamento_nome, lote_id, numero_lote, quantidade,
   direcao, status, data_solicitacao, data_aceite, created_at, origem, observacao)
SELECT 'migr-' || s.id,
       s.medicamento_id,
       s.medicamento_nome,
       s.lote_id,
       s.numero_lote,
       s.quantidade,
       'para_satelite',
       'Aceito',
       to_char(coalesce(s.data_saida::date, current_date), 'YYYY-MM-DD'),
       to_char(coalesce(s.data_saida::date, current_date), 'YYYY-MM-DD'),
       coalesce(s.created_at, now())::text,
       'migracao_satelite',
       'Transferência criada na migração: no legado a dispensação saía direto da central'
  FROM "Saida" s
 WHERE s.deleted_at IS NULL
   AND s.origem IS NULL
   AND (s.paciente_id IS NOT NULL OR s.paciente_nome IS NOT NULL)
   AND coalesce(s.medicamento_nome,'') NOT LIKE '[LOG%'
   AND s.lote_id IS NOT NULL
   AND coalesce(s.quantidade,0) > 0
   AND EXISTS (SELECT 1 FROM "Lote" l WHERE l.id = s.lote_id)
   AND NOT EXISTS (
       SELECT 1 FROM "TransferenciaPendente" t WHERE t.id = 'migr-' || s.id
   )
   AND NOT EXISTS (
       SELECT 1 FROM "TransferenciaPendente" t
        WHERE t.lote_id = s.lote_id
          AND t.direcao = 'para_satelite'
          AND t.status = 'Aceito'
          AND coalesce(t.deleted_at, '') = ''
          AND t.data_aceite::date <= s.data_saida::date
   );

-- 2. a saída passa a ser do satélite ----------------------------------
UPDATE "Saida" s
   SET origem = 'satelite'
 WHERE s.deleted_at IS NULL
   AND s.origem IS NULL
   AND (s.paciente_id IS NOT NULL OR s.paciente_nome IS NOT NULL)
   AND coalesce(s.medicamento_nome,'') NOT LIKE '[LOG%'
   AND s.lote_id IS NOT NULL
   AND coalesce(s.quantidade,0) > 0
   AND EXISTS (SELECT 1 FROM "TransferenciaPendente" t WHERE t.id = 'migr-' || s.id);

COMMIT;

-- 3. CONFIRA DEPOIS ---------------------------------------------------
SELECT count(*) AS transferencias_criadas
  FROM "TransferenciaPendente"
 WHERE id LIKE 'migr-%';

SELECT count(*) AS saidas_agora_do_satelite
  FROM "Saida"
 WHERE deleted_at IS NULL AND origem = 'satelite';

SELECT count(*) AS sobrou_alguma_dispensacao_sem_origem
  FROM "Saida"
 WHERE deleted_at IS NULL
   AND origem IS NULL
   AND (paciente_id IS NOT NULL OR paciente_nome IS NOT NULL)
   AND coalesce(medicamento_nome,'') NOT LIKE '[LOG%'
   AND lote_id IS NOT NULL
   AND coalesce(quantidade,0) > 0;
