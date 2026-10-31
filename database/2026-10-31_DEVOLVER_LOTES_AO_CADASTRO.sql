-- =====================================================================
-- ZORION SAUDE - DEVOLVER OS LOTES AOS CADASTROS DE ORIGEM (merge por nome)
-- =====================================================================
-- Os cadastros ja estao ativos, mas o estoque aparece zerado/trocado porque
-- os LOTES ficaram no cadastro que sobreviveu ao merge (a recuperacao usou
-- o backup de 16/10 e nao alcancou os lotes criados depois disso).
--
-- Este script devolve os 79 lotes ao cadastro de origem (mapa extraido do
-- backup pre-merge de 31/10 08:10) e recalcula:
--   estoque_atual    = soma dos lotes que o cadastro tem HOJE
--   estoque_satelite = acompanha os lotes devolvidos
--
-- Nao mexe em quantidade de lote, saida, entrada nem validade.
-- Idempotente. Rode com o aplicativo FECHADO, depois do backup.
-- =====================================================================

BEGIN;

-- 0. fotografias antes ------------------------------------------------
CREATE TEMP TABLE tot_antes ON COMMIT DROP AS
SELECT coalesce(sum(coalesce(estoque_atual,0)),0)    AS campo_central,
       coalesce(sum(coalesce(estoque_satelite,0)),0) AS campo_satelite,
       (SELECT coalesce(sum(coalesce(quantidade_atual,0)),0)    FROM "Lote" WHERE deleted_at IS NULL) AS lote_central,
       (SELECT coalesce(sum(coalesce(quantidade_satelite,0)),0) FROM "Lote" WHERE deleted_at IS NULL) AS lote_satelite
  FROM "Medicamento" WHERE deleted_at IS NULL;

SELECT '=== LOTES QUE CADA RECLAMADO TEM AGORA ===' AS etapa;
SELECT m.nome, m.concentracao, m.apresentacao, m.estoque_atual AS campo,
       count(l.id) AS lotes, coalesce(sum(l.quantidade_atual),0) AS soma_lotes
  FROM "Medicamento" m
  LEFT JOIN "Lote" l ON l.medicamento_id = m.id AND l.deleted_at IS NULL
 WHERE upper(m.nome) LIKE '%LEVOMEPROMAZINA%'
    OR upper(m.nome) LIKE '%CLORPROMAZINA%'
    OR upper(m.nome) LIKE '%DIPIRONA%'
    OR upper(m.nome) LIKE '%CLORETO DE S%'
    OR upper(m.nome) LIKE '%BROMOPRIDA%'
 GROUP BY m.id, m.nome, m.concentracao, m.apresentacao, m.estoque_atual
 ORDER BY m.nome, m.concentracao, m.apresentacao;

-- 1. mapa lote -> cadastro de origem ----------------------------------
CREATE TEMP TABLE mapa (lote_id text, med_id text) ON COMMIT DROP;
INSERT INTO mapa (lote_id, med_id) VALUES
  ('0a7f7803-1091-4f74-8a96-121afeecd1ac','0edfdbc8-c0ab-4c10-9ba0-dc4e0bcc22ee'),
  ('0eb9d729-9e7b-4652-bcba-cded2baf09d1','45073dba-b777-4c79-8f11-3a731e55b41e'),
  ('0f7702cf-4142-456c-a594-feeb65a3ca2b','0d68a243-dec6-4efb-8161-39da4826d0e8'),
  ('125a4c57-f0a2-42fa-9067-d1ed56d24ca6','4afb86c6-4f58-4063-95f9-b7894a8167cd'),
  ('12b50308-7764-4852-b339-899d744cd2d4','c2300ec4-11b1-4a7a-832c-7b13f78c35aa'),
  ('20035354-34c6-4be1-84a5-c6c90dc85567','5175b0fb-fef0-4080-9335-9101066771d1'),
  ('21ddb832-a4e9-446b-a9cc-db7fc76b9c08','4afb86c6-4f58-4063-95f9-b7894a8167cd'),
  ('24227061-e1da-4aec-949b-9c5f8aa3774b','83f6c9c0-37db-4006-b7a5-8c19d2ed6b3c'),
  ('258a2d9f-23f2-41d0-93d5-05577b789589','61f8671d-467a-4c09-b544-50b107a86fcc'),
  ('298fa975-f8a8-4bb9-bc9d-c774a688b998','5106d44a-d4cc-4da1-b263-7c7be807e4b2'),
  ('2aae4b31-e70b-451f-a12e-7dbb44ebbd93','5106d44a-d4cc-4da1-b263-7c7be807e4b2'),
  ('2b958d52-3a52-41d3-9982-f0448d2d07f9','4ea3b0ca-3f0a-4b22-845e-35f05dc81dbf'),
  ('2c389aee-c53f-4d46-b3fe-60ffc6704620','b747d235-e11a-42ef-b3c2-ea7729d50c44'),
  ('308d3956-aa9a-4416-9907-a47d23b6e524','f0344c4e-57e5-47d4-ad5c-fdf38bea6a25'),
  ('3b560e11-fc55-4bce-95ce-7cdde9d34943','994c71ac-aa6e-49e6-b4b1-f387380199cc'),
  ('3ba40e39-3e0b-4d9f-b69e-ef4019c853ae','a243d654-1842-45bd-8d41-052c377d6e46'),
  ('3df4b819-574b-49cc-bfd2-21bf08f7c15c','1be75689-a1e6-4b6a-85bf-c93957a71cfa'),
  ('3f52e324-cbe6-4d1d-bb98-aecfa1337fcb','5175b0fb-fef0-4080-9335-9101066771d1'),
  ('403d5c75-1c35-4d7e-809d-f2c2ea2ebdba','540a497d-5632-4ab0-ab6c-6d496c21450a'),
  ('4060de83-5c33-47b3-a5ae-401078cf6918','2fd80054-0f9e-41a9-b485-eb95b2db237d'),
  ('40eede1f-9de6-4afd-8bf6-1f129c3be69d','74c28e54-02d2-40ed-88dd-1ebeb145abb8'),
  ('421a1bec-c054-4233-8339-99f90f8fa2c1','e71105c7-d75c-407a-9037-0e7ba3ca9a27'),
  ('44108738-5ce0-4666-9d2f-0a67b254f0f7','3fac5ddd-303c-4a5f-baf9-f2fa316285ff'),
  ('44ab960a-36f3-49a4-87aa-06c04f83f65d','d344562b-919b-41a0-8d8f-61603a4b7398'),
  ('46573da9-27b8-4799-b037-d14046079707','11d94f77-8146-475d-85b4-2b1f7e997283'),
  ('4bfaae2f-f284-44e6-a5ed-f37cac0bf1ad','e4a9cfe4-e752-4913-933b-5a673d4d7578'),
  ('4d020fc7-5403-44c2-993a-fccc983d2775','33941521-b55b-4780-a50d-3f567ce9152c'),
  ('52dde427-10c5-4d3a-8712-7146b8a1860a','9f1be289-13ea-4ea4-be9c-7a7ac3254bce'),
  ('52ef2d13-0911-465a-a9eb-a27e42ce0b1c','cd0c9e93-e0df-41cc-ba13-da0eff7033c9'),
  ('544d3bf9-52ef-4819-bd74-65a5d72b7d48','6cc15f5a-3a85-431c-a129-281c445ce915'),
  ('560b1403-a62b-4c90-be6d-3cd6ecc1b8c3','11d94f77-8146-475d-85b4-2b1f7e997283'),
  ('5887cc1a-e58c-4bb8-a78f-1a4b7e09fa7e','6cc15f5a-3a85-431c-a129-281c445ce915'),
  ('5a814e19-8332-41b5-8003-b4863cda5c9b','626574b3-10ce-4931-9fc6-ba9d311ba80d'),
  ('5ae6511f-f0e7-4e45-a0af-c985d2c1f571','25ac7b76-b499-4c4b-b42c-647d1558fe3f'),
  ('5b078bd5-57fa-4f8e-9496-3dfd8cd35deb','45ec12ca-de53-4b6b-bb27-ac314b30468a'),
  ('5c25b2ba-cd20-4480-9395-b93e685f56e5','61f7a298-59fc-406f-9f62-091ff94f760d'),
  ('63c08e51-079c-4a7b-943f-666e1fd9cbee','83f6c9c0-37db-4006-b7a5-8c19d2ed6b3c'),
  ('68021feb-225d-43cc-892e-ed16a6e8a010','6cc15f5a-3a85-431c-a129-281c445ce915'),
  ('6a6a8311-abde-4c8b-a45e-cb82d22eb47c','5175b0fb-fef0-4080-9335-9101066771d1'),
  ('6b248dac-15f9-4d34-96a1-a06110a7946e','83f6c9c0-37db-4006-b7a5-8c19d2ed6b3c'),
  ('753ca3cf-abec-4f49-a142-3ecc94a910dc','cd0c9e93-e0df-41cc-ba13-da0eff7033c9'),
  ('78db9134-79d4-4f3c-a582-f9d6e6ae4f84','61e4e94d-ac89-47fe-a418-f8f0ab65a6ac'),
  ('7a39a921-ed68-4a00-aa56-e8f6d3e8c7fa','dd1e6d50-9c1a-4137-ac91-7e1d9012db72'),
  ('7b0b6072-96aa-43b8-a33f-84638b2b56ff','74c28e54-02d2-40ed-88dd-1ebeb145abb8'),
  ('7be9eb7c-e353-40ad-b464-30bc7051c54e','1be75689-a1e6-4b6a-85bf-c93957a71cfa'),
  ('81502151-d6c0-45a7-9d7f-415418f496de','f0344c4e-57e5-47d4-ad5c-fdf38bea6a25'),
  ('87e0526e-196e-4628-a430-6bd6034253b7','973bedd4-6af6-4d48-b990-177522eeb542'),
  ('885505a4-c219-4bb4-86d2-09f54c7f7f3d','451f1b19-e84a-4b9a-85bd-cc117564f0ab'),
  ('89708f7c-a1fd-480b-a1a5-0d52935b3657','540a497d-5632-4ab0-ab6c-6d496c21450a'),
  ('89c2fe5a-ce1d-4f4e-b2be-b103ecdc6964','746b09ac-236e-4e23-9e08-4277376d69d5'),
  ('98b85207-77bf-4996-8136-3917398f6023','df7d2445-aef2-43ef-bb98-c96148af6749'),
  ('99f7b216-25ad-44c8-9e2c-f5c92b63c27d','6ee1e983-75cb-468b-af5a-79eaaa28c446'),
  ('9a0c156c-d234-4752-b2a2-fb425785c6b5','e71105c7-d75c-407a-9037-0e7ba3ca9a27'),
  ('9ffae2a1-ed48-48ed-800d-e8999f53b32c','3fac5ddd-303c-4a5f-baf9-f2fa316285ff'),
  ('a3daf062-723a-49af-8fd5-bd5e719e4c62','96e7f336-404f-4252-a266-b7fc4af13bc1'),
  ('a97cded0-9768-408f-815a-90ec01f12a70','4ea3b0ca-3f0a-4b22-845e-35f05dc81dbf'),
  ('ab75d9a4-2ec4-4860-a79c-262444ec4e50','fcd12f9e-13a9-4982-8c14-9323fd7049a4'),
  ('ac21b6e7-6d49-440f-8d02-b259e0eb28a6','fcd12f9e-13a9-4982-8c14-9323fd7049a4'),
  ('add408fb-b613-4820-a210-b6db19b72554','df7d2445-aef2-43ef-bb98-c96148af6749'),
  ('b755df04-06dd-42b1-be9a-0b847a474286','6ee1e983-75cb-468b-af5a-79eaaa28c446'),
  ('b9b4de9c-55fe-4794-a8c7-806d824ab704','0d68a243-dec6-4efb-8161-39da4826d0e8'),
  ('bc855fcc-e8da-46d0-9ab5-606e79bb916f','bee7c7d4-2600-4f6f-8dfd-b8c40cecb8cd'),
  ('bce00451-f633-45ab-99c9-f1518f367929','626574b3-10ce-4931-9fc6-ba9d311ba80d'),
  ('c266c17c-b3b6-4a6d-ad3f-ff25a8116bef','74c28e54-02d2-40ed-88dd-1ebeb145abb8'),
  ('c66abb8c-8460-48e6-99eb-5dcf6ddc7979','cd0c9e93-e0df-41cc-ba13-da0eff7033c9'),
  ('cc8a9dfd-b4c8-4c45-9dc5-596f0fdbbc72','96e7f336-404f-4252-a266-b7fc4af13bc1'),
  ('ce0f51ae-bd07-44c7-b5d3-f067325d7c96','1be75689-a1e6-4b6a-85bf-c93957a71cfa'),
  ('ce6bffa8-7c7b-4ff2-9537-a9f4f4aea890','2fd80054-0f9e-41a9-b485-eb95b2db237d'),
  ('d6d277cd-98b8-4e9e-9a0d-3c385a99d60e','746b09ac-236e-4e23-9e08-4277376d69d5'),
  ('e46832b6-50af-4c4c-bc5b-0363526f43b9','d9cc9635-174a-48d2-9cc0-d7ec62e06df4'),
  ('e66c4cb8-b5b3-4781-a3c7-a44b3eba6e97','d53b0b7a-65f3-4f8d-86e3-5189ff6ee3b9'),
  ('e7006a55-415e-425f-9eac-4f9698b4b28e','3fac5ddd-303c-4a5f-baf9-f2fa316285ff'),
  ('e7207f1b-cc20-42af-8ef4-2d223863bd09','61f7a298-59fc-406f-9f62-091ff94f760d'),
  ('f10106d6-b914-4994-afd4-e9a77d4dac6c','e4a9cfe4-e752-4913-933b-5a673d4d7578'),
  ('f29c3d76-ec04-4f89-912c-5563934cc201','45ec12ca-de53-4b6b-bb27-ac314b30468a'),
  ('f370edf2-506a-48d9-8223-4752defe5a3c','9f1be289-13ea-4ea4-be9c-7a7ac3254bce'),
  ('f76e5e80-f5d0-48fd-9b25-8c27a05617eb','45073dba-b777-4c79-8f11-3a731e55b41e'),
  ('f7b03e92-488b-49d8-aa9a-c141f056e914','33941521-b55b-4780-a50d-3f567ce9152c'),
  ('fad60f5c-d617-483d-93e6-a7fe0aeb0755','a3db1979-832e-454a-900d-fbd1db43c1f0');

CREATE TEMP TABLE mov ON COMMIT DROP AS
SELECT l.id AS lote_id, l.medicamento_id AS atual, mp.med_id AS destino,
       coalesce(l.quantidade_atual,0)    AS qa,
       coalesce(l.quantidade_satelite,0) AS qs
  FROM "Lote" l
  JOIN mapa mp ON mp.lote_id = l.id
 WHERE l.medicamento_id IS DISTINCT FROM mp.med_id;

SELECT '=== LOTES A DEVOLVER ===' AS etapa;
SELECT count(*) AS lotes, coalesce(sum(qa),0) AS central, coalesce(sum(qs),0) AS satelite
  FROM mov;

UPDATE "Lote" l SET medicamento_id = mv.destino
  FROM mov mv WHERE l.id = mv.lote_id;

-- 2. estoque central = soma dos lotes do cadastro ----------------------
UPDATE "Medicamento" m
   SET estoque_atual = coalesce((
           SELECT sum(coalesce(l.quantidade_atual,0))
             FROM "Lote" l
            WHERE l.medicamento_id = m.id AND l.deleted_at IS NULL), 0)
 WHERE m.id IN (SELECT med_id FROM mapa UNION SELECT atual FROM mov);

-- 3. estoque satelite acompanha os lotes devolvidos --------------------
WITH d AS (
  SELECT id, sum(qs) AS qs FROM (
        SELECT atual   AS id, -qs AS qs FROM mov
        UNION ALL
        SELECT destino AS id,  qs AS qs FROM mov
  ) x GROUP BY id
)
UPDATE "Medicamento" m
   SET estoque_satelite = greatest(0, coalesce(m.estoque_satelite,0) + d.qs)
  FROM d
 WHERE m.id = d.id AND d.qs <> 0;

-- 4. conferencia: os LOTES nao podem mudar (so mudou o dono) -----------
DO $$
DECLARE a_lc int; a_ls int; d_lc int; d_ls int;
        a_cc int; a_cs int; d_cc int; d_cs int;
BEGIN
  SELECT lote_central, lote_satelite, campo_central, campo_satelite
    INTO a_lc, a_ls, a_cc, a_cs FROM tot_antes;

  SELECT coalesce(sum(coalesce(quantidade_atual,0)),0),
         coalesce(sum(coalesce(quantidade_satelite,0)),0)
    INTO d_lc, d_ls FROM "Lote" WHERE deleted_at IS NULL;

  SELECT coalesce(sum(coalesce(estoque_atual,0)),0),
         coalesce(sum(coalesce(estoque_satelite,0)),0)
    INTO d_cc, d_cs FROM "Medicamento" WHERE deleted_at IS NULL;

  IF d_lc <> a_lc OR d_ls <> a_ls THEN
    RAISE EXCEPTION 'ABORTADO: a soma dos lotes mudou (central % -> %, satelite % -> %). Nada gravado.',
      a_lc, d_lc, a_ls, d_ls;
  END IF;

  RAISE NOTICE 'Lotes intactos: central % e satelite %', d_lc, d_ls;
  RAISE NOTICE 'Campo do cadastro: central % -> %, satelite % -> %', a_cc, d_cc, a_cs, d_cs;
END $$;

SELECT '=== SALDO DEPOIS ===' AS etapa;
SELECT nome, concentracao, apresentacao, estoque_atual, estoque_satelite
  FROM "Medicamento"
 WHERE upper(nome) LIKE '%LEVOMEPROMAZINA%'
    OR upper(nome) LIKE '%CLORPROMAZINA%'
    OR upper(nome) LIKE '%DIPIRONA%'
    OR upper(nome) LIKE '%CLORETO DE S%'
    OR upper(nome) LIKE '%BROMOPRIDA%'
 ORDER BY nome, concentracao, apresentacao;

SELECT '=== TOTAIS ===' AS etapa;
SELECT coalesce(sum(estoque_atual),0)    AS campo_central,
       coalesce(sum(estoque_satelite),0) AS campo_satelite,
       (SELECT coalesce(sum(quantidade_atual),0)    FROM "Lote" WHERE deleted_at IS NULL) AS lote_central,
       (SELECT coalesce(sum(quantidade_satelite),0) FROM "Lote" WHERE deleted_at IS NULL) AS lote_satelite
  FROM "Medicamento" WHERE deleted_at IS NULL;

COMMIT;
