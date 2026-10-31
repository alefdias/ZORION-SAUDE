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
