-- ZORION - abastecer o satelite com 10 dias de consumo (calculado do historico)
-- ALVO = 10 x consumo medio diario dos ultimos 45 dias, arredondado para 5.
-- Transfere SOMENTE a diferenca (alvo - satelite atual), do lote que vence antes.
-- Nao mexe em medicamento que ja tem satelite >= alvo. Idempotente.
BEGIN;

CREATE TEMP TABLE plano (med_id text, alvo int) ON COMMIT DROP;
INSERT INTO plano (med_id, alvo) VALUES
  ('25ac7b76-b499-4c4b-b42c-647d1558fe3f',75),
  ('e5695167-7a33-4cc4-9ea1-f186841e781f',15),
  ('4ea3b0ca-3f0a-4b22-845e-35f05dc81dbf',20),
  ('e626e1b0-7db2-4b08-aec8-533a470d21cb',40),
  ('45ec12ca-de53-4b6b-bb27-ac314b30468a',5),
  ('bee7c7d4-2600-4f6f-8dfd-b8c40cecb8cd',25),
  ('1be75689-a1e6-4b6a-85bf-c93957a71cfa',10),
  ('13fcb695-dbf5-491d-97e1-1197bcc1ab64',290),
  ('45073dba-b777-4c79-8f11-3a731e55b41e',2045),
  ('33941521-b55b-4780-a50d-3f567ce9152c',115),
  ('03af46e6-0c6c-4674-be56-efa9935cd74d',20),
  ('cddc2818-fab3-4a68-b88b-ba34c738acb1',25),
  ('e71105c7-d75c-407a-9037-0e7ba3ca9a27',340),
  ('91ae7d8d-6b9f-4b98-b2ff-67cd69bb0452',235),
  ('d6a4a12c-f060-4401-bdc6-0f7248dbd0d0',175);

SELECT '=== PLANO (antes) ===' AS etapa;
SELECT m.nome, m.concentracao, m.apresentacao, p.alvo,
       coalesce(m.estoque_satelite,0) AS sat_atual,
       greatest(0, p.alvo - coalesce(m.estoque_satelite,0)) AS falta,
       coalesce(m.estoque_atual,0) AS central
  FROM plano p JOIN "Medicamento" m ON m.id = p.med_id
 ORDER BY m.nome, m.concentracao;

DO $$
DECLARE
  r record; l record;
  central int; sat int; falta int; restante int; q int;
  v_nome text; v_conc text; v_apres text; movido int;
BEGIN
  FOR r IN SELECT * FROM plano ORDER BY med_id LOOP
    SELECT coalesce(central_med.estoque_atual,0), coalesce(central_med.estoque_satelite,0),
           central_med.nome, central_med.concentracao, central_med.apresentacao
      INTO central, sat, v_nome, v_conc, v_apres
      FROM "Medicamento" central_med WHERE central_med.id = r.med_id;

    falta := r.alvo - sat;
    CONTINUE WHEN falta <= 0;
    falta := least(falta, central);
    CONTINUE WHEN falta <= 0;

    restante := falta;
    movido := 0;

    FOR l IN
      SELECT id, numero_lote, quantidade_atual
        FROM "Lote"
       WHERE medicamento_id = r.med_id AND deleted_at IS NULL
         AND coalesce(quantidade_atual,0) > 0
       ORDER BY data_validade NULLS LAST, id
    LOOP
      EXIT WHEN restante <= 0;
      q := least(restante, l.quantidade_atual);

      UPDATE "Lote"
         SET quantidade_atual    = quantidade_atual - q,
             quantidade_satelite = coalesce(quantidade_satelite,0) + q,
             status = CASE WHEN quantidade_atual - q <= 0 THEN 'esgotado' ELSE status END
       WHERE id = l.id;

      INSERT INTO "TransferenciaPendente"
        (id, medicamento_id, medicamento_nome, lote_id, numero_lote, quantidade,
         direcao, status, data_solicitacao, data_aceite, created_at, origem, observacao)
      VALUES
        ('transf-auto-' || substr(md5(random()::text),1,12), r.med_id, v_nome, l.id,
         coalesce(l.numero_lote,'S/L'), q, 'para_satelite', 'Aceito',
         to_char(now(),'YYYY-MM-DD'), to_char(now(),'YYYY-MM-DD'), now()::text,
         'transferencia', 'Abastecimento automatico: 10 dias de consumo');

      restante := restante - q;
      movido := movido + q;
    END LOOP;

    UPDATE "Medicamento"
       SET estoque_atual    = greatest(0, estoque_atual - movido),
           estoque_satelite = coalesce(estoque_satelite,0) + movido
     WHERE id = r.med_id;
  END LOOP;
END $$;

SELECT '=== DEPOIS ===' AS etapa;
SELECT m.nome, m.concentracao, m.apresentacao, m.estoque_atual, m.estoque_satelite
  FROM plano p JOIN "Medicamento" m ON m.id = p.med_id
 ORDER BY m.nome, m.concentracao;

COMMIT;
