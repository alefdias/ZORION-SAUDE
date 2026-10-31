-- ZORION - devolver os lotes dos medicamentos reclamados ao cadastro certo
-- (BROMOPRIDA, LEVOMEPROMAZINA, CLORPROMAZINA, DIPIRONA, CLORETO DE SODIO)
-- Nao altera quantidade de lote. Idempotente.
BEGIN;
CREATE TEMP TABLE mapa (lote_id text, med_id text) ON COMMIT DROP;
INSERT INTO mapa (lote_id, med_id) VALUES
  ('08eed3a6-88b1-46f3-8274-c2667c65acef','e626e1b0-7db2-4b08-aec8-533a470d21cb'),
  ('09a23490-2984-49d2-acf4-7ac265ec4327','03af46e6-0c6c-4674-be56-efa9935cd74d'),
  ('0eb9d729-9e7b-4652-bcba-cded2baf09d1','45073dba-b777-4c79-8f11-3a731e55b41e'),
  ('1307c301-62bd-4a97-9d0c-cf665d5d6d62','e626e1b0-7db2-4b08-aec8-533a470d21cb'),
  ('188afe1c-2586-4ff7-903c-4a2ebf9c4803','13fcb695-dbf5-491d-97e1-1197bcc1ab64'),
  ('2b958d52-3a52-41d3-9982-f0448d2d07f9','4ea3b0ca-3f0a-4b22-845e-35f05dc81dbf'),
  ('3df4b819-574b-49cc-bfd2-21bf08f7c15c','1be75689-a1e6-4b6a-85bf-c93957a71cfa'),
  ('421a1bec-c054-4233-8339-99f90f8fa2c1','e71105c7-d75c-407a-9037-0e7ba3ca9a27'),
  ('46573da9-27b8-4799-b037-d14046079707','11d94f77-8146-475d-85b4-2b1f7e997283'),
  ('4d020fc7-5403-44c2-993a-fccc983d2775','33941521-b55b-4780-a50d-3f567ce9152c'),
  ('560b1403-a62b-4c90-be6d-3cd6ecc1b8c3','11d94f77-8146-475d-85b4-2b1f7e997283'),
  ('5ae6511f-f0e7-4e45-a0af-c985d2c1f571','25ac7b76-b499-4c4b-b42c-647d1558fe3f'),
  ('5b078bd5-57fa-4f8e-9496-3dfd8cd35deb','45ec12ca-de53-4b6b-bb27-ac314b30468a'),
  ('687e3f8c-388e-4085-a746-b629e1ab88f4','d6a4a12c-f060-4401-bdc6-0f7248dbd0d0'),
  ('6a46b9bb-12f6-4c17-b738-adcae9dc438f','13fcb695-dbf5-491d-97e1-1197bcc1ab64'),
  ('7231a726-fdc2-4234-b4f0-5171f88f4b36','e5695167-7a33-4cc4-9ea1-f186841e781f'),
  ('74948384-edee-4685-8472-db38db90cb30','d6a4a12c-f060-4401-bdc6-0f7248dbd0d0'),
  ('76a258bc-29b2-497b-8ad5-29a035e96a3a','91ae7d8d-6b9f-4b98-b2ff-67cd69bb0452'),
  ('7be9eb7c-e353-40ad-b464-30bc7051c54e','1be75689-a1e6-4b6a-85bf-c93957a71cfa'),
  ('7cf6fe61-7c88-44d6-947e-bf5a9e9db789','d6a4a12c-f060-4401-bdc6-0f7248dbd0d0'),
  ('8312da6b-3d20-4f2b-9834-93d20767740b','e626e1b0-7db2-4b08-aec8-533a470d21cb'),
  ('87e0526e-196e-4628-a430-6bd6034253b7','973bedd4-6af6-4d48-b990-177522eeb542'),
  ('9a0c156c-d234-4752-b2a2-fb425785c6b5','e71105c7-d75c-407a-9037-0e7ba3ca9a27'),
  ('9ba331a4-2aa7-41f8-b147-0a9f9eef8287','e626e1b0-7db2-4b08-aec8-533a470d21cb'),
  ('a07c16ed-6828-448e-8e5c-78d269f3bd73','91ae7d8d-6b9f-4b98-b2ff-67cd69bb0452'),
  ('a5906eed-1add-446c-8eaf-980111b4e0f9','13fcb695-dbf5-491d-97e1-1197bcc1ab64'),
  ('a97cded0-9768-408f-815a-90ec01f12a70','4ea3b0ca-3f0a-4b22-845e-35f05dc81dbf'),
  ('ba22b5de-3e91-4fa3-991b-4d54b63b8a00','e5695167-7a33-4cc4-9ea1-f186841e781f'),
  ('bc855fcc-e8da-46d0-9ab5-606e79bb916f','bee7c7d4-2600-4f6f-8dfd-b8c40cecb8cd'),
  ('c6b95770-6d63-47c2-9530-73e94910fde1','03af46e6-0c6c-4674-be56-efa9935cd74d'),
  ('ce0f51ae-bd07-44c7-b5d3-f067325d7c96','1be75689-a1e6-4b6a-85bf-c93957a71cfa'),
  ('e1a71349-025c-4827-b077-f3c743f40bc8','91ae7d8d-6b9f-4b98-b2ff-67cd69bb0452'),
  ('efd14b2e-9758-469e-a9d8-4385d7c36834','cddc2818-fab3-4a68-b88b-ba34c738acb1'),
  ('f29c3d76-ec04-4f89-912c-5563934cc201','45ec12ca-de53-4b6b-bb27-ac314b30468a'),
  ('f76e5e80-f5d0-48fd-9b25-8c27a05617eb','45073dba-b777-4c79-8f11-3a731e55b41e'),
  ('f7b03e92-488b-49d8-aa9a-c141f056e914','33941521-b55b-4780-a50d-3f567ce9152c'),
  ('fb0c78a0-145a-430a-9fef-319cd783c4b2','d6a4a12c-f060-4401-bdc6-0f7248dbd0d0');

CREATE TEMP TABLE mov ON COMMIT DROP AS
SELECT l.id lote_id, l.medicamento_id atual, m.med_id destino,
       coalesce(l.quantidade_satelite,0) qs
  FROM "Lote" l JOIN mapa m ON m.lote_id = l.id
 WHERE l.medicamento_id IS DISTINCT FROM m.med_id;

SELECT 'LOTES A DEVOLVER' AS etapa, count(*) AS lotes FROM mov;

UPDATE "Lote" l SET medicamento_id = m.destino FROM mov m WHERE l.id = m.lote_id;

UPDATE "Medicamento" x
   SET estoque_atual = coalesce((
         SELECT sum(coalesce(l.quantidade_atual,0)) FROM "Lote" l
          WHERE l.medicamento_id = x.id AND l.deleted_at IS NULL),0)
 WHERE x.id IN ('03af46e6-0c6c-4674-be56-efa9935cd74d','11d94f77-8146-475d-85b4-2b1f7e997283','13fcb695-dbf5-491d-97e1-1197bcc1ab64','1be75689-a1e6-4b6a-85bf-c93957a71cfa','25ac7b76-b499-4c4b-b42c-647d1558fe3f','33941521-b55b-4780-a50d-3f567ce9152c','45073dba-b777-4c79-8f11-3a731e55b41e','45ec12ca-de53-4b6b-bb27-ac314b30468a','4ea3b0ca-3f0a-4b22-845e-35f05dc81dbf','91ae7d8d-6b9f-4b98-b2ff-67cd69bb0452','973bedd4-6af6-4d48-b990-177522eeb542','bee7c7d4-2600-4f6f-8dfd-b8c40cecb8cd','cddc2818-fab3-4a68-b88b-ba34c738acb1','d6a4a12c-f060-4401-bdc6-0f7248dbd0d0','e5695167-7a33-4cc4-9ea1-f186841e781f','e626e1b0-7db2-4b08-aec8-533a470d21cb','e71105c7-d75c-407a-9037-0e7ba3ca9a27','edd1c952-c62a-46c0-b3d4-49f38aaed3a4');

WITH d AS (
  SELECT id, sum(qs) qs FROM (
    SELECT atual id, -qs qs FROM mov UNION ALL SELECT destino id, qs FROM mov
  ) z GROUP BY id
)
UPDATE "Medicamento" x
   SET estoque_satelite = greatest(0, coalesce(x.estoque_satelite,0) + d.qs)
  FROM d WHERE x.id = d.id AND d.qs <> 0;

SELECT nome, concentracao, apresentacao, estoque_atual, estoque_satelite
  FROM "Medicamento"
 WHERE upper(nome) LIKE '%BROMOPRIDA%' OR upper(nome) LIKE '%LEVOMEPROMAZINA%'
    OR upper(nome) LIKE '%CLORPROMAZINA%' OR upper(nome) LIKE '%DIPIRONA%'
    OR upper(nome) LIKE '%CLORETO DE S%'
 ORDER BY nome, concentracao, apresentacao;
COMMIT;
