-- =====================================================================
-- ZORION SAUDE - INDICE UNICO DE LOTE (medicamento + numero + validade)
-- =====================================================================
-- Impede, no banco, que o mesmo lote fisico seja criado duas vezes.
--
-- Antes de criar o indice, consolida os lotes que ja estao duplicados:
--   - mantem o lote com mais saldo (ou o mais antigo);
--   - soma quantidade_atual / quantidade_satelite / quantidade_inicial;
--   - re-aponta Saida, Entrada, TransferenciaPendente, InventarioItem e
--     Emprestimo para o lote mantido;
--   - marca os duplicados com deleted_at.
--
-- O TOTAL DE ESTOQUE NAO MUDA: a soma dos lotes antes e depois e conferida
-- e o script ABORTA se houver diferenca.
--
-- Rode com o aplicativo FECHADO, depois do backup.
-- =====================================================================

BEGIN;

-- 0. totais antes
CREATE TEMP TABLE tot_antes ON COMMIT DROP AS
SELECT coalesce(sum(coalesce(quantidade_atual,0)),0)    AS central,
       coalesce(sum(coalesce(quantidade_satelite,0)),0) AS satelite
  FROM "Lote" WHERE deleted_at IS NULL;

-- 1. consolida duplicados
DO $$
DECLARE
    g record;
    sobrevivente text;
    duplicados text[];
    soma_c int;
    soma_s int;
    soma_i int;
    grupos int := 0;
BEGIN
    FOR g IN
        SELECT medicamento_id,
               upper(btrim(coalesce(numero_lote,''))) AS num,
               coalesce(data_validade, DATE '1900-01-01') AS val,
               array_agg(id ORDER BY (coalesce(quantidade_atual,0) + coalesce(quantidade_satelite,0)) DESC,
                                      created_at NULLS LAST, id) AS ids
          FROM "Lote"
         WHERE deleted_at IS NULL
         GROUP BY 1, 2, 3
        HAVING count(*) > 1
    LOOP
        sobrevivente := g.ids[1];
        duplicados   := g.ids[2:];

        SELECT coalesce(sum(quantidade_atual),0),
               coalesce(sum(quantidade_satelite),0),
               coalesce(sum(quantidade_inicial),0)
          INTO soma_c, soma_s, soma_i
          FROM "Lote"
         WHERE id = ANY(g.ids);

        UPDATE "Lote"
           SET quantidade_atual    = soma_c,
               quantidade_satelite = soma_s,
               quantidade_inicial  = soma_i,
               deleted_at          = NULL
         WHERE id = sobrevivente;

        UPDATE "Saida"                  SET lote_id = sobrevivente WHERE lote_id = ANY(duplicados);
        UPDATE "Entrada"                SET lote_id = sobrevivente WHERE lote_id = ANY(duplicados);
        UPDATE "TransferenciaPendente"  SET lote_id = sobrevivente WHERE lote_id = ANY(duplicados);
        UPDATE "InventarioItem"         SET lote_id = sobrevivente WHERE lote_id = ANY(duplicados);
        UPDATE "Emprestimo"             SET lote_id = sobrevivente WHERE lote_id = ANY(duplicados);

        UPDATE "Lote" SET deleted_at = now() WHERE id = ANY(duplicados);

        grupos := grupos + 1;
    END LOOP;

    RAISE NOTICE 'Grupos de lotes duplicados consolidados: %', grupos;
END $$;

-- 2. conferencia: o total nao pode mudar
DO $$
DECLARE
    a_c int; a_s int; d_c int; d_s int;
BEGIN
    SELECT central, satelite INTO a_c, a_s FROM tot_antes;
    SELECT coalesce(sum(coalesce(quantidade_atual,0)),0),
           coalesce(sum(coalesce(quantidade_satelite,0)),0)
      INTO d_c, d_s
      FROM "Lote" WHERE deleted_at IS NULL;

    IF a_c <> d_c OR a_s <> d_s THEN
        RAISE EXCEPTION 'ABORTADO: a soma dos lotes mudaria (central % -> %, satelite % -> %). Nada gravado.',
            a_c, d_c, a_s, d_s;
    END IF;

    RAISE NOTICE 'Conferencia OK: central % e satelite % preservados', d_c, d_s;
END $$;

-- 3. indice unico (ignora lotes apagados e trata validade nula)
CREATE UNIQUE INDEX IF NOT EXISTS lote_unico_por_med_num_val
    ON "Lote" (
        medicamento_id,
        upper(btrim(coalesce(numero_lote,''))),
        coalesce(data_validade, DATE '1900-01-01')
    )
    WHERE deleted_at IS NULL;

-- 4. resultado
SELECT count(*) AS lotes_ativos,
       count(*) FILTER (WHERE coalesce(numero_lote,'') = '') AS sem_numero,
       count(*) FILTER (WHERE data_validade IS NULL) AS sem_validade
  FROM "Lote" WHERE deleted_at IS NULL;

COMMIT;
