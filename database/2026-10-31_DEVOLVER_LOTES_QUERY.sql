-- ZORION SAUDE - devolver os 168 lotes dos 42 nomes afetados ao dono original
-- Fonte: backup pre-merge de 31/10 08:10. Nao altera quantidade de lote.
-- Idempotente. Rode com o aplicativo fechado, depois do backup.
BEGIN;

CREATE TEMP TABLE tot_antes ON COMMIT DROP AS
SELECT (SELECT coalesce(sum(quantidade_atual),0)    FROM "Lote" WHERE deleted_at IS NULL) lc,
       (SELECT coalesce(sum(quantidade_satelite),0) FROM "Lote" WHERE deleted_at IS NULL) ls;

CREATE TEMP TABLE mapa(lote_id text, med_id text) ON COMMIT DROP;
INSERT INTO mapa(lote_id, med_id)
SELECT lote, med FROM (
  SELECT split_part(par,'|',1) med,
         unnest(string_to_array(split_part(par,'|',2), ',')) lote
    FROM regexp_split_to_table($m$9db3d732-be10-4090-8872-40b3db605627|022ef7ef-eb8c-4c57-ac0a-f781016d1209,792b4498-2d4c-47f5-bbc7-8f908bdf560d;c1446d2e-ea9f-427c-ae7e-cf9f0de0683a|04ef37c8-b0dd-4390-815d-5c8c81e26d06,078cbc10-22f7-43f8-a8d5-aa621b58d233;9f957822-5eff-4474-a6a7-74b8ff800fdf|05755696-105f-4fd4-824b-961714c38905,10e4d216-81b1-4c6d-9300-1f120ce16627,74b141dc-a47e-4a3d-8f90-8ff22fed49a4;e2d91853-8823-4d54-b35d-895ad7e8ed9c|057f5af3-e8d5-4515-8f55-52616411628a,0dcc833a-db1f-4a19-9f19-dc749881991f;e626e1b0-7db2-4b08-aec8-533a470d21cb|08eed3a6-88b1-46f3-8274-c2667c65acef,1307c301-62bd-4a97-9d0c-cf665d5d6d62,8312da6b-3d20-4f2b-9834-93d20767740b,9ba331a4-2aa7-41f8-b147-0a9f9eef8287;03af46e6-0c6c-4674-be56-efa9935cd74d|09a23490-2984-49d2-acf4-7ac265ec4327,c6b95770-6d63-47c2-9530-73e94910fde1;0edfdbc8-c0ab-4c10-9ba0-dc4e0bcc22ee|0a7f7803-1091-4f74-8a96-121afeecd1ac;45073dba-b777-4c79-8f11-3a731e55b41e|0eb9d729-9e7b-4652-bcba-cded2baf09d1,f76e5e80-f5d0-48fd-9b25-8c27a05617eb;0d68a243-dec6-4efb-8161-39da4826d0e8|0f7702cf-4142-456c-a594-feeb65a3ca2b,b9b4de9c-55fe-4794-a8c7-806d824ab704;220f4694-4b0b-481a-9a1a-9218b4bcb34f|0ff49cfe-b236-446e-8adf-95b5abaf434d,fac18c35-9f3e-44e4-87eb-1e69226f676d,fd694b4f-010c-4215-8de0-6d51c45bd821;4afb86c6-4f58-4063-95f9-b7894a8167cd|125a4c57-f0a2-42fa-9067-d1ed56d24ca6,21ddb832-a4e9-446b-a9cc-db7fc76b9c08;c2300ec4-11b1-4a7a-832c-7b13f78c35aa|12b50308-7764-4852-b339-899d744cd2d4;587971d4-c24d-49b0-815a-ca953382d869|17e260b3-c5b7-4215-ab6a-f5dd549c817c,f9bf2684-0833-4b74-bb82-160805a73f32;13fcb695-dbf5-491d-97e1-1197bcc1ab64|188afe1c-2586-4ff7-903c-4a2ebf9c4803,6a46b9bb-12f6-4c17-b738-adcae9dc438f,a5906eed-1add-446c-8eaf-980111b4e0f9;74eefea8-69df-430f-98b9-8803e54a6247|1a269508-5467-4e11-b4fd-af0d97d199b9;5175b0fb-fef0-4080-9335-9101066771d1|20035354-34c6-4be1-84a5-c6c90dc85567,3f52e324-cbe6-4d1d-bb98-aecfa1337fcb,6a6a8311-abde-4c8b-a45e-cb82d22eb47c;f569dcbb-644b-4c03-9c69-f69043046d6c|241b919e-29a5-4a60-b41d-1a63185447bf,81c737a4-b33d-4267-b22c-a59108dc64de;83f6c9c0-37db-4006-b7a5-8c19d2ed6b3c|24227061-e1da-4aec-949b-9c5f8aa3774b,63c08e51-079c-4a7b-943f-666e1fd9cbee,6b248dac-15f9-4d34-96a1-a06110a7946e;b624ba4f-75ec-422c-ad64-945113778a0c|25363455-e766-46f0-8278-a4ee513e8b5c,f26d27b0-ba47-4b10-a06d-62a3debbc644;61f8671d-467a-4c09-b544-50b107a86fcc|258a2d9f-23f2-41d0-93d5-05577b789589;4a9fb29b-f583-434e-9b86-8c5fa94f5273|27bb306c-51ec-4efc-811c-b7e2db20928b,97d4b1ca-2104-4abb-9a59-e53840c78bd8,ddc5fa2c-f01a-4935-93de-6afb8c0b0cc8;5106d44a-d4cc-4da1-b263-7c7be807e4b2|298fa975-f8a8-4bb9-bc9d-c774a688b998,2aae4b31-e70b-451f-a12e-7dbb44ebbd93;4ea3b0ca-3f0a-4b22-845e-35f05dc81dbf|2b958d52-3a52-41d3-9982-f0448d2d07f9,a97cded0-9768-408f-815a-90ec01f12a70;b747d235-e11a-42ef-b3c2-ea7729d50c44|2c389aee-c53f-4d46-b3fe-60ffc6704620;f0344c4e-57e5-47d4-ad5c-fdf38bea6a25|308d3956-aa9a-4416-9907-a47d23b6e524,81502151-d6c0-45a7-9d7f-415418f496de;8d02b25b-e8d9-4344-8d60-6eaae31b7823|321fdfbb-d107-4249-9d3a-56d152b1afbb,4f7b32c9-290f-4cc0-bfd3-29da5ae7d068,6e805438-9e81-41b9-9728-e0af08bb1490;24ba227e-6a1a-469c-a53d-5dbb9ea11968|369f4a06-b6a7-4074-8baf-457bc18477dc,7d757d9c-8785-43a1-930a-5eef6826cb55;a88e217d-4cab-46cc-b415-2cf3578020be|3a202ed9-6ee5-48e2-9898-ea35642c72b0,ae7d2012-7eae-454f-81c5-5c443148d2d3;994c71ac-aa6e-49e6-b4b1-f387380199cc|3b560e11-fc55-4bce-95ce-7cdde9d34943;a243d654-1842-45bd-8d41-052c377d6e46|3ba40e39-3e0b-4d9f-b69e-ef4019c853ae;1be75689-a1e6-4b6a-85bf-c93957a71cfa|3df4b819-574b-49cc-bfd2-21bf08f7c15c,7be9eb7c-e353-40ad-b464-30bc7051c54e,ce0f51ae-bd07-44c7-b5d3-f067325d7c96;d1c8c012-fe2f-4028-aee3-0a36a4920d95|3efa563b-3f78-497d-96f3-8ace5b789fb3,eb6fa7c3-b9e2-4e63-af92-4400f06b03b3;540a497d-5632-4ab0-ab6c-6d496c21450a|403d5c75-1c35-4d7e-809d-f2c2ea2ebdba,89708f7c-a1fd-480b-a1a5-0d52935b3657;2fd80054-0f9e-41a9-b485-eb95b2db237d|4060de83-5c33-47b3-a5ae-401078cf6918,ce6bffa8-7c7b-4ff2-9537-a9f4f4aea890;74c28e54-02d2-40ed-88dd-1ebeb145abb8|40eede1f-9de6-4afd-8bf6-1f129c3be69d,7b0b6072-96aa-43b8-a33f-84638b2b56ff,c266c17c-b3b6-4a6d-ad3f-ff25a8116bef;e71105c7-d75c-407a-9037-0e7ba3ca9a27|421a1bec-c054-4233-8339-99f90f8fa2c1,9a0c156c-d234-4752-b2a2-fb425785c6b5;3fac5ddd-303c-4a5f-baf9-f2fa316285ff|44108738-5ce0-4666-9d2f-0a67b254f0f7,9ffae2a1-ed48-48ed-800d-e8999f53b32c,e7006a55-415e-425f-9eac-4f9698b4b28e;d344562b-919b-41a0-8d8f-61603a4b7398|44ab960a-36f3-49a4-87aa-06c04f83f65d;11d94f77-8146-475d-85b4-2b1f7e997283|46573da9-27b8-4799-b037-d14046079707,560b1403-a62b-4c90-be6d-3cd6ecc1b8c3;be84d479-fcbb-4912-b851-e73d40bf1c32|4ab77c77-663b-4500-a7d1-01fca44dbd3c,74802135-9c72-491e-a84b-ba3a87c6ee76,d3350230-7f5d-4900-aa9c-96ae403f90d0;e4a9cfe4-e752-4913-933b-5a673d4d7578|4bfaae2f-f284-44e6-a5ed-f37cac0bf1ad,f10106d6-b914-4994-afd4-e9a77d4dac6c;33941521-b55b-4780-a50d-3f567ce9152c|4d020fc7-5403-44c2-993a-fccc983d2775,f7b03e92-488b-49d8-aa9a-c141f056e914;9f1be289-13ea-4ea4-be9c-7a7ac3254bce|52dde427-10c5-4d3a-8712-7146b8a1860a,f370edf2-506a-48d9-8223-4752defe5a3c;cd0c9e93-e0df-41cc-ba13-da0eff7033c9|52ef2d13-0911-465a-a9eb-a27e42ce0b1c,753ca3cf-abec-4f49-a142-3ecc94a910dc,c66abb8c-8460-48e6-99eb-5dcf6ddc7979;6b3775ad-abb2-4b75-8bd4-c89730e1c96f|533fe2ce-4654-4d39-8fa5-26662be4859c,8cd5be37-c2a9-496c-a507-3baf7448c243,a058c0fc-72b6-4170-8958-264e462c0d66;6cc15f5a-3a85-431c-a129-281c445ce915|544d3bf9-52ef-4819-bd74-65a5d72b7d48,5887cc1a-e58c-4bb8-a78f-1a4b7e09fa7e,68021feb-225d-43cc-892e-ed16a6e8a010;626574b3-10ce-4931-9fc6-ba9d311ba80d|5a814e19-8332-41b5-8003-b4863cda5c9b,bce00451-f633-45ab-99c9-f1518f367929;80720927-19da-42fa-a1e2-081e274ce5ca|5ac1e554-0541-473d-b918-2f9997dce6b6,7f790eb3-d8b5-466a-9d8f-828e4184ea50;25ac7b76-b499-4c4b-b42c-647d1558fe3f|5ae6511f-f0e7-4e45-a0af-c985d2c1f571;45ec12ca-de53-4b6b-bb27-ac314b30468a|5b078bd5-57fa-4f8e-9496-3dfd8cd35deb,f29c3d76-ec04-4f89-912c-5563934cc201;61f7a298-59fc-406f-9f62-091ff94f760d|5c25b2ba-cd20-4480-9395-b93e685f56e5,e7207f1b-cc20-42af-8ef4-2d223863bd09;9ff08321-acc0-45df-9627-8879cac2a1ee|663e6b28-77d6-44c2-bc2e-055bd99d6484,f23bd6e9-8a05-4980-ac4e-e2f61f28efd6;d5c1ee19-695f-426a-9020-6172137c4307|6d35314e-d62d-4f20-882f-5844f06eca45,97682d16-5dd6-489b-b9ab-47bf383d8f8d;607364c9-c3a2-4a4f-bc20-6b4b55522ab9|6d377b23-46de-4049-88d7-6115edb29f3a,999d2158-64c1-4e72-a207-b962f491c207;e5695167-7a33-4cc4-9ea1-f186841e781f|7231a726-fdc2-4234-b4f0-5171f88f4b36,ba22b5de-3e91-4fa3-991b-4d54b63b8a00;bfabaae8-9d7c-4b8c-b23a-bba01ca5bca5|734f0afe-a62d-4463-9f2c-594a9d95ccc4,c2367b72-3e04-4bbf-808b-a7e52fdfb12f,db7623a4-854a-4f19-be78-ad7f96b58338;db801763-cfb8-44d9-b46b-6738874c850d|73831adf-476b-4f02-9a27-62138437f77a,ddc47a10-d575-4e7d-b2ea-cb301c682a61,fe42f65a-417d-4e79-b831-0ada08c25acd;f39528fb-914f-4de7-8b76-e729010f0de3|7416216a-df22-4830-b0ce-964c0df4df48,782b9d9f-2fbe-4473-afed-4a92c6923097;59300a8d-defb-4039-bfdd-6943412a54c5|7662352a-a0a6-4927-88e4-89fe59a5b755,a9502f90-3e02-4e22-91a4-15aebc67cbf8;91ae7d8d-6b9f-4b98-b2ff-67cd69bb0452|76a258bc-29b2-497b-8ad5-29a035e96a3a,a07c16ed-6828-448e-8e5c-78d269f3bd73,e1a71349-025c-4827-b077-f3c743f40bc8;61e4e94d-ac89-47fe-a418-f8f0ab65a6ac|78db9134-79d4-4f3c-a582-f9d6e6ae4f84;26302c64-4133-4f83-b7a5-2fef2307808e|7942423c-10ca-4513-b85b-dc359004f532,bc9d9209-83d5-4060-bc9c-9b7b200e0dde;dd1e6d50-9c1a-4137-ac91-7e1d9012db72|7a39a921-ed68-4a00-aa56-e8f6d3e8c7fa;c9bd5445-ae91-40e5-924e-42dcc825eb57|829bb2d6-3c4c-41c3-a2d7-fed3e5ae64c4,8f8607c5-71bc-4c9a-a577-2b3cec0ad184,fb0236d5-7028-4fab-9d1b-6f38a1c85f3d;a8619a3e-57ae-4940-b292-364ec4dbbfc7|8416bd03-9200-4134-97e3-d2d39cad04f5;3a24a981-9e23-4d68-9f37-e3919e34af48|843b86d2-0294-43af-b793-ed1993c87676;973bedd4-6af6-4d48-b990-177522eeb542|87e0526e-196e-4628-a430-6bd6034253b7;451f1b19-e84a-4b9a-85bd-cc117564f0ab|885505a4-c219-4bb4-86d2-09f54c7f7f3d;746b09ac-236e-4e23-9e08-4277376d69d5|89c2fe5a-ce1d-4f4e-b2be-b103ecdc6964,d6d277cd-98b8-4e9e-9a0d-3c385a99d60e;aa352af6-96fd-4000-b47a-451903b34f0b|8df2e418-975e-4a74-ad12-ec4bfa163c41,9441096b-1d1b-4623-a4cf-60099fe72900;df7d2445-aef2-43ef-bb98-c96148af6749|98b85207-77bf-4996-8136-3917398f6023,add408fb-b613-4820-a210-b6db19b72554;6ee1e983-75cb-468b-af5a-79eaaa28c446|99f7b216-25ad-44c8-9e2c-f5c92b63c27d,b755df04-06dd-42b1-be9a-0b847a474286;2e04c835-984a-44a9-bd10-b7c10c255e55|9af16a27-2eaa-4686-983d-dcba23cf08b5,a1cbe7d9-19ff-40d2-94c3-f451cf6ee638,e8414ded-4afc-46ce-b111-af788a6ae4ea;96e7f336-404f-4252-a266-b7fc4af13bc1|a3daf062-723a-49af-8fd5-bd5e719e4c62,cc8a9dfd-b4c8-4c45-9dc5-596f0fdbbc72;21e8e560-2a21-4480-b28f-8f8f74aa8e51|a94e20be-ec5b-49ca-b181-88949c69fdf6,ac6d5bc0-4062-45f6-8a6e-c5da8f97bdd9;2abb411a-f3af-4e8c-9444-ac38dbf2bb63|ab1a1af6-f31c-406d-a117-adaa0e21f5f1;fcd12f9e-13a9-4982-8c14-9323fd7049a4|ab75d9a4-2ec4-4860-a79c-262444ec4e50,ac21b6e7-6d49-440f-8d02-b259e0eb28a6;cdf8426b-9601-4fa4-af05-50a40ddc400c|ba8ff6d6-d23b-4b5a-8f27-9a6e2562da3c,c9bcbcc9-aa1d-4d6e-873c-4f5ec31e180e;bee7c7d4-2600-4f6f-8dfd-b8c40cecb8cd|bc855fcc-e8da-46d0-9ab5-606e79bb916f;d9cc9635-174a-48d2-9cc0-d7ec62e06df4|e46832b6-50af-4c4c-bc5b-0363526f43b9;8ca80d7f-f48b-4b28-bf22-f65f6c07c7fd|e5f28dcb-96ea-40e0-947e-279dec827cbb;d53b0b7a-65f3-4f8d-86e3-5189ff6ee3b9|e66c4cb8-b5b3-4781-a3c7-a44b3eba6e97;a373d8a5-5f7a-4173-934b-aba8dc926cd4|f08fcb13-e1ab-441b-a655-9a1d9d5c7398;e36fc525-2a34-4fd0-a56e-dd117f4c8489|f6291816-e149-41cf-b868-d1d603c677c3;a3db1979-832e-454a-900d-fbd1db43c1f0|fad60f5c-d617-483d-93e6-a7fe0aeb0755$m$, ';') par
) x;

CREATE TEMP TABLE mov ON COMMIT DROP AS
SELECT l.id lote_id, l.medicamento_id atual, mp.med_id destino,
       coalesce(l.quantidade_satelite,0) qs
  FROM "Lote" l JOIN mapa mp ON mp.lote_id = l.id
 WHERE l.medicamento_id IS DISTINCT FROM mp.med_id;

SELECT 'LOTES A DEVOLVER' AS etapa, count(*) AS lotes FROM mov;

UPDATE "Lote" l SET medicamento_id = m.destino FROM mov m WHERE l.id = m.lote_id;

UPDATE "Medicamento" m
   SET estoque_atual = coalesce((
         SELECT sum(coalesce(l.quantidade_atual,0)) FROM "Lote" l
          WHERE l.medicamento_id = m.id AND l.deleted_at IS NULL),0)
 WHERE m.id IN (SELECT med_id FROM mapa);

WITH d AS (
  SELECT id, sum(qs) qs FROM (
    SELECT atual   id, -qs qs FROM mov
    UNION ALL
    SELECT destino id,  qs FROM mov
  ) x GROUP BY id
)
UPDATE "Medicamento" m
   SET estoque_satelite = greatest(0, coalesce(m.estoque_satelite,0) + d.qs)
  FROM d WHERE m.id = d.id AND d.qs <> 0;

DO $$
DECLARE a_lc int; a_ls int; d_lc int; d_ls int;
BEGIN
  SELECT lc, ls INTO a_lc, a_ls FROM tot_antes;
  SELECT coalesce(sum(quantidade_atual),0), coalesce(sum(quantidade_satelite),0)
    INTO d_lc, d_ls FROM "Lote" WHERE deleted_at IS NULL;
  IF d_lc <> a_lc OR d_ls <> a_ls THEN
    RAISE EXCEPTION 'ABORTADO: soma dos lotes mudou (% -> % / % -> %)', a_lc, d_lc, a_ls, d_ls;
  END IF;
  RAISE NOTICE 'Lotes intactos: central % satelite %', d_lc, d_ls;
END $$;

SELECT 'BROMOPRIDA' AS etapa, concentracao, apresentacao, estoque_atual, estoque_satelite
  FROM "Medicamento" WHERE upper(nome) LIKE '%BROMOPRIDA%' ORDER BY concentracao;

SELECT 'RECLAMADOS' AS etapa, nome, concentracao, apresentacao, estoque_atual, estoque_satelite
  FROM "Medicamento"
 WHERE upper(nome) LIKE '%LEVOMEPROMAZINA%' OR upper(nome) LIKE '%CLORPROMAZINA%'
    OR upper(nome) LIKE '%DIPIRONA%' OR upper(nome) LIKE '%CLORETO DE S%'
 ORDER BY nome, concentracao;

SELECT 'TOTAIS' AS etapa,
       (SELECT coalesce(sum(estoque_atual),0)    FROM "Medicamento" WHERE deleted_at IS NULL) campo_central,
       (SELECT coalesce(sum(quantidade_atual),0) FROM "Lote" WHERE deleted_at IS NULL) lote_central;

COMMIT;
