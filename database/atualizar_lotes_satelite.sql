-- ====================================================================
-- SCRIPT DE SINCRONIZAÇÃO E CORREÇÃO DE LOTES DA FARMÁCIA SATÉLITE
-- Corrige a divergência entre saldo do Medicamento e saldo dos Lotes
-- ====================================================================

BEGIN;

-- 1. Criação de lotes para medicamentos transferidos sem lote cadastrado
INSERT INTO "Lote" ("id", "medicamento_id", "numero_lote", "data_validade", "quantidade_inicial", "quantidade_atual", "status", "created_at", "quantidade_satelite")
SELECT 'f4b1a201-9871-4abc-9921-9988aa112233', '0141e8cd-7b4a-4e4b-ada1-b497b4fc2a3b', 'REM-358028', '2028-12-31', 200, 0, 'disponivel', NOW(), 200
WHERE NOT EXISTS (SELECT 1 FROM "Lote" WHERE "medicamento_id" = '0141e8cd-7b4a-4e4b-ada1-b497b4fc2a3b');

INSERT INTO "Lote" ("id", "medicamento_id", "numero_lote", "data_validade", "quantidade_inicial", "quantidade_atual", "status", "created_at", "quantidade_satelite")
SELECT 'a7c2d302-8762-4bcd-8812-7766bb223344', '91eccbd9-e21a-4478-aedc-ebcc9f289c5c', 'REM-358028', '2027-12-31', 20, 0, 'disponivel', NOW(), 20
WHERE NOT EXISTS (SELECT 1 FROM "Lote" WHERE "medicamento_id" = '91eccbd9-e21a-4478-aedc-ebcc9f289c5c');

-- 2. Atualização dos lotes físicos com os saldos reais sincronizados
UPDATE "Lote" SET "quantidade_satelite" = 4 WHERE "id" = 'dd905ccd-b4db-4264-ac3f-feeaff88bc57'; -- MIRTAZAPINA (15 MG) Lote: 5G4022 -> 4 un
UPDATE "Lote" SET "quantidade_satelite" = 2 WHERE "id" = '6ad8d1bc-c164-4c65-9b70-4255901ad085'; -- CINARIZINA (75 MG) Lote: DFG2824A -> 2 un
UPDATE "Lote" SET "quantidade_satelite" = 87 WHERE "id" = 'e4e7d1b5-f8e1-446d-a62b-15199b0ec1e9'; -- CINARIZINA (75 MG) Lote: DFG4370A -> 87 un
UPDATE "Lote" SET "quantidade_satelite" = 8 WHERE "id" = '2d2cd9e5-e7a9-4c13-a743-19f5c0477776'; -- CINARIZINA (75 MG) Lote: DFG4369 -> 8 un
UPDATE "Lote" SET "quantidade_satelite" = 30 WHERE "id" = '620441f0-0c9f-4d2b-8af2-13bfa0a595fb'; -- DONEPEZILA (5 MG) Lote: BRD2L002 -> 30 un
UPDATE "Lote" SET "quantidade_satelite" = 90 WHERE "id" = '4d956a52-0f97-4e23-b3b7-fcf9a992337b'; -- DONEPEZILA (5 MG) Lote: 50031323 -> 90 un
UPDATE "Lote" SET "quantidade_satelite" = 144 WHERE "id" = '29f7d9a3-305e-447f-8caa-f882ebd74f25'; -- CLOZAPINA (100 MG) Lote: 50022076 -> 144 un
UPDATE "Lote" SET "quantidade_satelite" = 52 WHERE "id" = '651600dc-e9d2-42b1-8e80-238162cf3bf4'; -- POMADA DE ASSADURA  (\N) Lote: 056004 -> 52 un
UPDATE "Lote" SET "quantidade_satelite" = 6 WHERE "id" = '549ad24f-8672-4472-8d97-938e0775bbae'; -- HEPARINA SÓDICA (5000 UI/0,25ML) Lote: U085/25M -> 6 un
UPDATE "Lote" SET "quantidade_satelite" = 35 WHERE "id" = '7231a726-fdc2-4234-b4f0-5171f88f4b36'; -- BROMOPRIDA (4MG/ML) Lote: 25I0162 -> 35 un
UPDATE "Lote" SET "quantidade_satelite" = 10 WHERE "id" = '8f648f18-bcdb-4302-803c-2aeae5911079'; -- ATROPINA, SULFATO (0,25 MG/ML) Lote: AT25D003 C-7/1 -> 10 un
UPDATE "Lote" SET "quantidade_satelite" = 23 WHERE "id" = 'ce1883f9-fc7f-406d-b712-d21dc78af093'; -- BECLOMETASONA, DIPROPIONATO (200 MCG / DOSE) Lote: 1220202 -> 23 un
UPDATE "Lote" SET "quantidade_satelite" = 461 WHERE "id" = '13c66fe4-b387-468f-8ec2-28843333938e'; -- BACLOFENO (10 MG) Lote: 2717247 -> 461 un
UPDATE "Lote" SET "quantidade_satelite" = 1348 WHERE "id" = '0eb9d729-9e7b-4652-bcba-cded2baf09d1'; -- CLORPROMAZINA, CLORIDRATO (25 MG) Lote: 50031486 -> 1348 un
UPDATE "Lote" SET "quantidade_satelite" = 11 WHERE "id" = '47ca67bf-3698-4da3-9b6d-6c78f39cf731'; -- LIDOCAÍNA, CLORIDRATO s/ vasoconstritor (20 MG/ML) Lote: 24122475 -> 11 un
UPDATE "Lote" SET "quantidade_satelite" = 9 WHERE "id" = '44ab960a-36f3-49a4-87aa-06c04f83f65d'; -- FUROSEMIDA (10 MG/ML) Lote: 20203125 -> 9 un
UPDATE "Lote" SET "quantidade_satelite" = 60 WHERE "id" = '2b958d52-3a52-41d3-9982-f0448d2d07f9'; -- BROMOPRIDA (5 MG/ML) Lote: 78UI4236 -> 60 un
UPDATE "Lote" SET "quantidade_satelite" = 167 WHERE "id" = 'f2ee0159-0fbc-4b46-8103-6364aeee550c'; -- ATENOLOL (25 MG) Lote: PH4089 -> 167 un
UPDATE "Lote" SET "quantidade_satelite" = 240 WHERE "id" = 'c0df49b5-a0fe-4cb4-a0a1-e23639bfba20'; -- ATENOLOL (25 MG) Lote: PN3426 -> 240 un
UPDATE "Lote" SET "quantidade_satelite" = 201 WHERE "id" = 'f4d2abd6-a8c1-4552-bbb4-c1189894c9da'; -- CLORIDRATO DE METFORMINA (500 MG) Lote: 25J2NE -> 201 un
UPDATE "Lote" SET "quantidade_satelite" = 262 WHERE "id" = '7051e9b7-42cc-4b3c-b2f1-1ef6de8f8657'; -- PENTOXIFILINA (400 MG) Lote: 5C9736 -> 262 un
UPDATE "Lote" SET "quantidade_satelite" = 20 WHERE "id" = '24d3916e-0b4d-468d-aa48-d152bd445277'; -- BECLOMETASONA (400 MG) Lote: 1213188 -> 20 un
UPDATE "Lote" SET "quantidade_satelite" = 13 WHERE "id" = '2ed836ed-6268-40f0-8e95-b07d63115f34'; -- NISTATINA (\N) Lote: 26F295 -> 13 un
UPDATE "Lote" SET "quantidade_satelite" = 5 WHERE "id" = '025871f5-a1f4-478d-a549-f123d444d791'; -- URÉIA (10%) Lote: 0061 -> 5 un
UPDATE "Lote" SET "quantidade_satelite" = 8 WHERE "id" = '63c08e51-079c-4a7b-943f-666e1fd9cbee'; -- HIDROCORTISONA, SUCCINATO SÓDICO (100 MG) Lote: 2595783 -> 8 un
UPDATE "Lote" SET "quantidade_satelite" = 8 WHERE "id" = '8cd5be37-c2a9-496c-a507-3baf7448c243'; -- HIDROCORTISONA, SUCCINATO SÓDICO (500 MG) Lote: 25060482 -> 8 un
UPDATE "Lote" SET "quantidade_satelite" = 630 WHERE "id" = 'f4c25ba6-b3df-44fe-8c01-2e68030573cb'; -- FENITOÍNA (100 MG) Lote: 1457480 -> 630 un
UPDATE "Lote" SET "quantidade_satelite" = 100 WHERE "id" = '185d6894-ff5f-423b-99f0-1938ad769064'; -- FENITOÍNA (100 MG) Lote: 14581337 -> 100 un
UPDATE "Lote" SET "quantidade_satelite" = 359 WHERE "id" = '11859da2-fa68-4e6c-9efb-cc36ea43a3ca'; -- DIOSMINA + HISPERIDINA (450/50 MG) Lote: A17B00825 -> 359 un
UPDATE "Lote" SET "quantidade_satelite" = 11 WHERE "id" = 'e8e9b833-dcee-4111-9a6e-071d04441452'; -- CETOPROFENO (100 MG) Lote: 2541662 -> 11 un
UPDATE "Lote" SET "quantidade_satelite" = 34 WHERE "id" = 'a5b6f1c3-56ff-4aef-a510-1038476f1516'; -- FLUCONAZOL (150 MG) Lote: 0B0961 -> 34 un
UPDATE "Lote" SET "quantidade_satelite" = 16 WHERE "id" = '702ffddd-33f7-4eeb-9616-81939579e663'; -- FLUCONAZOL (150 MG) Lote: 095145 -> 16 un
UPDATE "Lote" SET "quantidade_satelite" = 562 WHERE "id" = 'f23bd6e9-8a05-4980-ac4e-e2f61f28efd6'; -- FUROSEMIDA (40 MG) Lote: 25J501 -> 562 un
UPDATE "Lote" SET "quantidade_satelite" = 106 WHERE "id" = '663e6b28-77d6-44c2-bc2e-055bd99d6484'; -- FUROSEMIDA (40 MG) Lote: B25L0968 -> 106 un
UPDATE "Lote" SET "quantidade_satelite" = 128 WHERE "id" = 'bc7ad805-0fb7-4b04-bcdb-6c66efdcfecf'; -- DOXAZOSINA, MESILATO (2 MG) Lote: 5I3173 -> 128 un
UPDATE "Lote" SET "quantidade_satelite" = 107 WHERE "id" = 'f239d19b-b990-4d0b-9fd0-0559916b3b2c'; -- FINASTERIDA (5 MG) Lote: 2606303 -> 107 un
UPDATE "Lote" SET "quantidade_satelite" = 11 WHERE "id" = '5b078bd5-57fa-4f8e-9496-3dfd8cd35deb'; -- CLORETO DE SÓDIO (0,9 MG/ML (0,9%)) Lote: 387725 -> 11 un
UPDATE "Lote" SET "quantidade_satelite" = 188 WHERE "id" = '6f9f112d-fc95-4966-9b97-faebacc95632'; -- NICOTINA Goma   (2 MG) Lote: 1002797 -> 188 un
UPDATE "Lote" SET "quantidade_satelite" = 64 WHERE "id" = 'fc3c6392-9bdd-45f9-892b-13b5b7dea55b'; -- NICOTINA Goma   (2 MG) Lote: 1002818 -> 64 un
UPDATE "Lote" SET "quantidade_satelite" = 63 WHERE "id" = '86efa6ee-8901-480e-89a8-e07e791cc337'; -- LORAZEPAN (2 MG) Lote: 4R7373 -> 63 un
UPDATE "Lote" SET "quantidade_satelite" = 580 WHERE "id" = '02354adb-03be-421a-87e6-b5eb3efac6dc'; -- LORAZEPAN (2 MG) Lote: 512201 -> 580 un
UPDATE "Lote" SET "quantidade_satelite" = 90 WHERE "id" = '0a233bf5-9904-4497-a0bd-0a6d523eb275'; -- GLICOSAMINA, SULFATO + CONDRODOITINA, SULFATO (500 MG + 400 MG) Lote: 2601218 -> 90 un
UPDATE "Lote" SET "quantidade_satelite" = 208 WHERE "id" = '7010048a-6323-480f-b4fe-dc2c2e7796b7'; -- ACETILCISTEINA (120 MG/G) Lote: 255892 -> 208 un
UPDATE "Lote" SET "quantidade_satelite" = 9 WHERE "id" = 'a243894e-555b-4df5-adbd-dd3e87851fbc'; -- ACETILCISTEINA (120 MG/G) Lote: 5H2133 -> 9 un
UPDATE "Lote" SET "quantidade_satelite" = 10 WHERE "id" = '85300939-2360-4cf8-a05a-b2cc50027d0f'; -- TRIANCINOLONA  ACETONIDA (10 G) Lote: 2517/72 -> 10 un
UPDATE "Lote" SET "quantidade_satelite" = 310 WHERE "id" = 'cc731adc-9428-4583-bc53-5e7107b4dea7'; -- BUPROPIONA (150 MG) Lote: 5E7665 -> 310 un
UPDATE "Lote" SET "quantidade_satelite" = 65 WHERE "id" = 'efd14b2e-9758-469e-a9d8-4385d7c36834'; -- DIPIRONA SÓDICA (500 MG/ML) Lote: 25071004 -> 65 un
UPDATE "Lote" SET "quantidade_satelite" = 2 WHERE "id" = '3df4b819-574b-49cc-bfd2-21bf08f7c15c'; -- CLORETO DE SÓDIO (0,9 MG/ML (0,9%)) Lote: 114875 -> 2 un
UPDATE "Lote" SET "quantidade_satelite" = 20 WHERE "id" = 'ce0f51ae-bd07-44c7-b5d3-f067325d7c96'; -- CLORETO DE SÓDIO (0,9 MG/ML (0,9%)) Lote: 393725 -> 20 un
UPDATE "Lote" SET "quantidade_satelite" = 3 WHERE "id" = 'c266c17c-b3b6-4a6d-ad3f-ff25a8116bef'; -- AMIODARONA (50 MG/ML) Lote: 78UK4368 -> 3 un
UPDATE "Lote" SET "quantidade_satelite" = 206 WHERE "id" = 'd1075cc5-fec1-42b4-b64c-687931d4936d'; -- AMOXICILINA + CLAVULANATO (850/125 MG) Lote: DFG2745A -> 206 un
UPDATE "Lote" SET "quantidade_satelite" = 40 WHERE "id" = '9a87265a-1a27-46a8-8de2-5163964f6345'; -- AMOXICILINA + CLAVULANATO (850/125 MG) Lote: 175402 -> 40 un
UPDATE "Lote" SET "quantidade_satelite" = 211 WHERE "id" = '623cc97c-f3c8-440b-86c2-74bea11c5166'; -- METFORMINA, CLORIDRATO (500 MG XR) Lote: 26D1A8 -> 211 un
UPDATE "Lote" SET "quantidade_satelite" = 15 WHERE "id" = 'ee20a91b-f789-4b3c-87b4-0a5296d48b2e'; -- METFORMINA, CLORIDRATO (500 MG XR) Lote: 26F189 -> 15 un
UPDATE "Lote" SET "quantidade_satelite" = 42 WHERE "id" = '5b46ec74-ceac-4954-a2de-50b482a9665a'; -- HIDRÓXIDO DE ALUMÍNIO (60 MG/ML (6%)) Lote: 26B0185 -> 42 un
UPDATE "Lote" SET "quantidade_satelite" = 20 WHERE "id" = 'ac6d5bc0-4062-45f6-8a6e-c5da8f97bdd9'; -- CETOCONAZOL (20 MG/G (2%)) Lote: 320/25 -> 20 un
UPDATE "Lote" SET "quantidade_satelite" = 208 WHERE "id" = '0fbe5637-2241-43b4-b004-3bd6fb7010b6'; -- AMOXICILINA (500 MG) Lote: BACM25055 -> 208 un
UPDATE "Lote" SET "quantidade_satelite" = 29 WHERE "id" = '79317c76-21fa-4197-9fdb-f588612f4d47'; -- AMOXICILINA (500 MG) Lote: B25L2508 -> 29 un
UPDATE "Lote" SET "quantidade_satelite" = 53 WHERE "id" = 'bc855fcc-e8da-46d0-9ab5-606e79bb916f'; -- CLORETO DE SÓDIO (0,9 MG/ML (0,9%)) Lote: 433925 -> 53 un
UPDATE "Lote" SET "quantidade_satelite" = 169 WHERE "id" = 'c812fe03-f21c-4f51-ae02-f0d5b94457f2'; -- CILOSTASOL (50 MG) Lote: 2511859 -> 169 un
UPDATE "Lote" SET "quantidade_satelite" = 528 WHERE "id" = 'bc9d9209-83d5-4060-bc9c-9b7b200e0dde'; -- VITAMINA DO COMPLEXO B (associações) Lote: 251136 -> 528 un
UPDATE "Lote" SET "quantidade_satelite" = 535 WHERE "id" = '87c2a3b5-b03e-4dc7-8f6a-75df490fe3e6'; -- VITAMINA E SAIS MINERAIS (associações) Lote: 25A76Y -> 535 un
UPDATE "Lote" SET "quantidade_satelite" = 100 WHERE "id" = '843b86d2-0294-43af-b793-ed1993c87676'; -- AMINOFILINA (100 MG) Lote: 1380/25M -> 100 un
UPDATE "Lote" SET "quantidade_satelite" = 124 WHERE "id" = 'd3350230-7f5d-4900-aa9c-96ae403f90d0'; -- AMIODARONA (200 MG) Lote: DFG5348A -> 124 un
UPDATE "Lote" SET "quantidade_satelite" = 3 WHERE "id" = '52dde427-10c5-4d3a-8712-7146b8a1860a'; -- CETOCONAZOL (200 MG) Lote: 130226 -> 3 un
UPDATE "Lote" SET "quantidade_satelite" = 150 WHERE "id" = 'f370edf2-506a-48d9-8223-4752defe5a3c'; -- CETOCONAZOL (200 MG) Lote: 253671 -> 150 un
UPDATE "Lote" SET "quantidade_satelite" = 4 WHERE "id" = '1b08f999-fad0-4757-bc99-c5b687c96536'; -- CETOCONAZOL + DIPROPIONATO DE BETAMETASONA + SULFATO DE NEOMICINA (20 MG/G + 0,64 MG/G + 2,5 MG/G) Lote: 035186 -> 4 un
UPDATE "Lote" SET "quantidade_satelite" = 20 WHERE "id" = '5eafc1ae-776e-4a9c-b8f8-7abf0e845548'; -- CETOCONAZOL + DIPROPIONATO DE BETAMETASONA + SULFATO DE NEOMICINA (20 MG/G + 0,64 MG/G + 2,5 MG/G) Lote: 095292 -> 20 un
UPDATE "Lote" SET "quantidade_satelite" = 534 WHERE "id" = '3f52e324-cbe6-4d1d-bb98-aecfa1337fcb'; -- QUETIAPINA, HEMIFUMARATO (25 MG) Lote: 2513045 -> 534 un
UPDATE "Lote" SET "quantidade_satelite" = 619 WHERE "id" = '96b707d3-9503-4312-ab8e-3955c62b830d'; -- ANLODIPINA , BESILATO (5 MG) Lote: B25H2825 -> 619 un
UPDATE "Lote" SET "quantidade_satelite" = 12 WHERE "id" = 'cbd39e84-a9af-48ba-9d35-6ff64e63cc9d'; -- CARBONATO DE LÍTIO (300 MG) Lote: 50405243 -> 12 un
UPDATE "Lote" SET "quantidade_satelite" = 954 WHERE "id" = '1d4884d5-3dd1-43f6-ae79-e623010fde65'; -- CARBONATO DE LÍTIO (300 MG) Lote: 172887 -> 954 un
UPDATE "Lote" SET "quantidade_satelite" = 64 WHERE "id" = '15887630-2b99-4886-9c99-71d7b1727308'; -- CLINDAMICINA, CLORIDRATO (300 MG) Lote: 2520095 -> 64 un
UPDATE "Lote" SET "quantidade_satelite" = 545 WHERE "id" = '870fb8bb-5fbf-4d17-a309-c9f3c5873cdc'; -- CEFALEXINA (500 MG) Lote: 112712C -> 545 un
UPDATE "Lote" SET "quantidade_satelite" = 432 WHERE "id" = '2edd1c8c-46cf-4d32-8676-27b0715aae2a'; -- BROMAZEPAN (3 MG) Lote: 2447041 -> 432 un
UPDATE "Lote" SET "quantidade_satelite" = 104 WHERE "id" = '26af5fd0-5afd-4b53-9a73-26b3703b775e'; -- AZITROMICINA (500 MG) Lote: 261484 -> 104 un
UPDATE "Lote" SET "quantidade_satelite" = 234 WHERE "id" = '4edd8705-8275-42fa-a203-447ebc2469cc'; -- CIPROFLOXACINO, CLORIDRATO (500 MG) Lote: B25A0392 -> 234 un
UPDATE "Lote" SET "quantidade_satelite" = 66 WHERE "id" = 'cefd869d-f72e-4fd2-9d6d-6e72dc50390c'; -- CEFTRIAXONA DISSÓDICA (1  G) Lote: 25070345 -> 66 un
UPDATE "Lote" SET "quantidade_satelite" = 30 WHERE "id" = 'd78a3cee-3826-4f45-90d2-07b4038e0d46'; -- DEXAMETASONA, ACETATO (1 MG/ML) Lote: 25D99Y -> 30 un
UPDATE "Lote" SET "quantidade_satelite" = 4 WHERE "id" = '022ef7ef-eb8c-4c57-ac0a-f781016d1209'; -- CARVEDILOL (12,5 MG) Lote: 4X9939 -> 4 un
UPDATE "Lote" SET "quantidade_satelite" = 210 WHERE "id" = '792b4498-2d4c-47f5-bbc7-8f908bdf560d'; -- CARVEDILOL (12,5 MG) Lote: 5E9239 -> 210 un
UPDATE "Lote" SET "quantidade_satelite" = 32 WHERE "id" = '7f64852d-a1a3-4749-8e60-92351a086a40'; -- DICLOFENACO SÓDICO (25 MG/ML) Lote: DC25D049 -> 32 un
UPDATE "Lote" SET "quantidade_satelite" = 389 WHERE "id" = 'cc8a9dfd-b4c8-4c45-9dc5-596f0fdbbc72'; -- CARVEDILOL (3,125 MG) Lote: 5B3736 -> 389 un
UPDATE "Lote" SET "quantidade_satelite" = 14 WHERE "id" = 'a3daf062-723a-49af-8fd5-bd5e719e4c62'; -- CARVEDILOL (3,125 MG) Lote: 5E3191 -> 14 un
UPDATE "Lote" SET "quantidade_satelite" = 254 WHERE "id" = '5ae6511f-f0e7-4e45-a0af-c985d2c1f571'; -- BROMOPRIDA (10 MG) Lote: 4M0323 -> 254 un
UPDATE "Lote" SET "quantidade_satelite" = 15 WHERE "id" = '04ef37c8-b0dd-4390-815d-5c8c81e26d06'; -- PARACETAMOL (200 MG/ML) Lote: 4125 -> 15 un
UPDATE "Lote" SET "quantidade_satelite" = 86 WHERE "id" = '64274402-9f59-484d-b97c-b15bd51c58a1'; -- ATORVASTATINA (20 MG) Lote: 4Q4115 -> 86 un
UPDATE "Lote" SET "quantidade_satelite" = 282 WHERE "id" = '478bb308-27c4-4002-a92f-65ecb607dc7d'; -- CIPROFIBRATO (100MG) Lote: 50308503 -> 282 un
UPDATE "Lote" SET "quantidade_satelite" = 345 WHERE "id" = '7662352a-a0a6-4927-88e4-89fe59a5b755'; -- DEXCLORFENIRAMINA, MALEATO (2 MG) Lote: B25B2455 -> 345 un
UPDATE "Lote" SET "quantidade_satelite" = 33 WHERE "id" = 'a9502f90-3e02-4e22-91a4-15aebc67cbf8'; -- DEXCLORFENIRAMINA, MALEATO (2 MG) Lote: 2510840 -> 33 un
UPDATE "Lote" SET "quantidade_satelite" = 368 WHERE "id" = '1c803a30-0d2e-41cc-90f8-99c901cafdc3'; -- CITALOPRAM (20 MG) Lote: DFG8388A -> 368 un
UPDATE "Lote" SET "quantidade_satelite" = 482 WHERE "id" = 'f7b03e92-488b-49d8-aa9a-c141f056e914'; -- DIPIRONA MONOIDRATADA (500 MG) Lote: 260425 -> 482 un
UPDATE "Lote" SET "quantidade_satelite" = 58 WHERE "id" = '0a181aaf-6ce4-469a-9dd4-6068adf2b0ce'; -- DIGOXINA (0,25 MG) Lote: 245497 -> 58 un
UPDATE "Lote" SET "quantidade_satelite" = 90 WHERE "id" = 'f1ca8491-2200-471b-978a-3b1196120e5d'; -- DIGOXINA (0,25 MG) Lote: 252184 -> 90 un
UPDATE "Lote" SET "quantidade_satelite" = 91 WHERE "id" = '3935da04-6891-44f7-b9d1-76c03019a761'; -- ENALAPRIL (10 MG) Lote: 2526320 -> 91 un
UPDATE "Lote" SET "quantidade_satelite" = 490 WHERE "id" = 'c9bcbcc9-aa1d-4d6e-873c-4f5ec31e180e'; -- ESCOPOLAMINA, BUTILBROMETO (10 MG) Lote: J25M0007 -> 490 un
UPDATE "Lote" SET "quantidade_satelite" = 35 WHERE "id" = '90dfc0ef-b922-45a6-85b6-3e68add5a103'; -- LACTULOSE (667 MG/ML) Lote: 0269/25 -> 35 un
UPDATE "Lote" SET "quantidade_satelite" = 5 WHERE "id" = '15247da6-b58c-4b59-98fc-07243b471b3b'; -- LACTULOSE (667 MG/ML) Lote: 251179 -> 5 un
UPDATE "Lote" SET "quantidade_satelite" = 9 WHERE "id" = '47badec6-035d-4c7c-9a2f-3fb71247f07e'; -- BISACODIL (5 MG) Lote: 2602760 -> 9 un
UPDATE "Lote" SET "quantidade_satelite" = 16 WHERE "id" = '0a7f7803-1091-4f74-8a96-121afeecd1ac'; -- ESCOPOLAMINA, BUTILBROMETO (10 MG/ML) Lote: 0384/25 -> 16 un
UPDATE "Lote" SET "quantidade_satelite" = 270 WHERE "id" = '527ed377-1084-4eff-a57b-f334f66aa6b9'; -- LEVODOPA + BENZERAZIDA (250 MG + 50 MG) Lote: 2507838 -> 270 un
UPDATE "Lote" SET "quantidade_satelite" = 201 WHERE "id" = '70c44a00-13b2-4734-9c5e-e1e1556403eb'; -- DICLOFENACO POTÁSSICO (50 MG) Lote: 2519215 -> 201 un
UPDATE "Lote" SET "quantidade_satelite" = 29 WHERE "id" = '09a23490-2984-49d2-acf4-7ac265ec4327'; -- DIPIRONA MONOIDRATADA (500 MG/ML) Lote: DS25E249 -> 29 un
UPDATE "Lote" SET "quantidade_satelite" = 120 WHERE "id" = '28fbd4b2-1825-46f5-a590-4a082804ced2'; -- LEVODOPA + CARBIDOPA (250 MG + 25 MG) Lote: 50024913 -> 120 un
UPDATE "Lote" SET "quantidade_satelite" = 73 WHERE "id" = '36f9c2f1-4541-465d-bcb6-298bb0b3d900'; -- LEVODOPA + CARBIDOPA (250 MG + 25 MG) Lote: 50029796 -> 73 un
UPDATE "Lote" SET "quantidade_satelite" = 233 WHERE "id" = '7d757d9c-8785-43a1-930a-5eef6826cb55'; -- LEVOTIROXINA SÓDICA (25 MCG) Lote: BR180038 -> 233 un
UPDATE "Lote" SET "quantidade_satelite" = 226 WHERE "id" = '369f4a06-b6a7-4074-8baf-457bc18477dc'; -- LEVOTIROXINA SÓDICA (25 MCG) Lote: BR187218 -> 226 un
UPDATE "Lote" SET "quantidade_satelite" = 359 WHERE "id" = '258a2d9f-23f2-41d0-93d5-05577b789589'; -- LEVOTIROXINA SÓDICA (50 MCG) Lote: BR177828 -> 359 un
UPDATE "Lote" SET "quantidade_satelite" = 6 WHERE "id" = '82ed1068-330d-4573-acc3-12b66c0d5563'; -- OMEPRAZOL, SÓDICO (40 MG) Lote: 25071088 -> 6 un
UPDATE "Lote" SET "quantidade_satelite" = 51 WHERE "id" = 'b915af2d-038b-4102-ba3d-176acf4bc825'; -- GLICEROL (120 MG/ML (12%)) Lote: 972925 -> 51 un
UPDATE "Lote" SET "quantidade_satelite" = 10 WHERE "id" = 'c658f8ff-72d4-42a4-92f9-960516ee37b2'; -- LIDOCAÍNA, CLORIDRATO (20 MG/G (2%)) Lote: B25A2100 -> 10 un
UPDATE "Lote" SET "quantidade_satelite" = 14 WHERE "id" = 'b999a3b2-1406-4c31-a25b-aeb886cdeb2e'; -- OXACILINA SÓDICA (500 MG) Lote: 25102320 -> 14 un
UPDATE "Lote" SET "quantidade_satelite" = 58 WHERE "id" = '7ef8fb9a-346c-4131-969e-f4933835edb1'; -- IMIPRAMINA, CLORIDRATO (25 MG) Lote: 50027090 -> 58 un
UPDATE "Lote" SET "quantidade_satelite" = 627 WHERE "id" = 'b983be10-e7f2-4065-bb5a-dc1529b6f15f'; -- IMIPRAMINA, CLORIDRATO (25 MG) Lote: 50032533 -> 627 un
UPDATE "Lote" SET "quantidade_satelite" = 10 WHERE "id" = 'd5404739-40a1-49e3-9224-8c05903e89f9'; -- IMIPRAMINA, CLORIDRATO (25 MG) Lote: 5003367 -> 10 un
UPDATE "Lote" SET "quantidade_satelite" = 3 WHERE "id" = '67d4d78a-3656-4a03-9d2b-b1f512a3447f'; -- MANITOL (200 MG/ML (20%)) Lote: 880525 -> 3 un
UPDATE "Lote" SET "quantidade_satelite" = 104 WHERE "id" = '7d967fad-3cd8-464c-b403-1a89ac7265dc'; -- LEVOFLOXACINO,  CLORIDRATO (500 MG) Lote: 2504532 -> 104 un
UPDATE "Lote" SET "quantidade_satelite" = 36 WHERE "id" = '121616e5-2807-4b15-81b5-e845ab239e3f'; -- NORFLOXACINO (400 MG) Lote: 17601125 -> 36 un
UPDATE "Lote" SET "quantidade_satelite" = 3 WHERE "id" = '18449249-a9e0-4dc0-a54b-65921132f98a'; -- IPATRÓPIO, BROMETO (0,250 MG/ML) Lote: 24JSK8 -> 3 un
UPDATE "Lote" SET "quantidade_satelite" = 17 WHERE "id" = '4f0a2a39-9f3a-408b-88a1-b41d6a2f15c7'; -- IPATRÓPIO, BROMETO (0,250 MG/ML) Lote: 0445/25 -> 17 un
UPDATE "Lote" SET "quantidade_satelite" = 223 WHERE "id" = 'd2e10394-dd43-4a03-9b05-f1b550c7c9e2'; -- ETINILESTRADIOL+  LEVONORGESTREL (0,03 MG + 0,150 MG) Lote: 51006383 -> 223 un
UPDATE "Lote" SET "quantidade_satelite" = 22 WHERE "id" = '738d7af7-ee0d-4b79-ad0f-a0563f3611c1'; -- IVERMECTINA (6 MG) Lote: 4K3334 -> 22 un
UPDATE "Lote" SET "quantidade_satelite" = 12 WHERE "id" = 'b95231f7-45a6-4b44-b9d3-0fb03c038fc9'; -- IVERMECTINA (6 MG) Lote: 5G7864 -> 12 un
UPDATE "Lote" SET "quantidade_satelite" = 261 WHERE "id" = '923473bd-c3f5-4b0d-adb7-e30807acb477'; -- GLIBENCLAMIDA (5 MG) Lote: 2514581 -> 261 un
UPDATE "Lote" SET "quantidade_satelite" = 107 WHERE "id" = 'af1d6c73-bc88-4441-b67f-e897771edf24'; -- GLICAZIDA (30 MG) Lote: 4Z8294 -> 107 un
UPDATE "Lote" SET "quantidade_satelite" = 243 WHERE "id" = 'a7a5016d-3487-460b-8008-8b875d761345'; -- HIDROCLOROTIAZIDA (25 MG) Lote: 2511526 -> 243 un
UPDATE "Lote" SET "quantidade_satelite" = 45 WHERE "id" = '0d7f9dfb-cf7d-4c7b-b4ed-e1a336549932'; -- HIDROCLOROTIAZIDA (25 MG) Lote: 2601578 -> 45 un
UPDATE "Lote" SET "quantidade_satelite" = 20 WHERE "id" = 'ddc5fa2c-f01a-4935-93de-6afb8c0b0cc8'; -- ALBENDAZOL (40 MG/ML) Lote: 2416269 -> 20 un
UPDATE "Lote" SET "quantidade_satelite" = 691 WHERE "id" = '74b141dc-a47e-4a3d-8f90-8ff22fed49a4'; -- LOSARTANA (50 MG) Lote: B25K0983 -> 691 un
UPDATE "Lote" SET "quantidade_satelite" = 240 WHERE "id" = '7cf6fe61-7c88-44d6-947e-bf5a9e9db789'; -- MACROGOL + BICARBONATO DE  SODIO + CLORETO DE SÓDIO + CLORETO DE POTASSIO (13,125G + 0,1775G + 0, 350G + 0,0466G) Lote: 25A0213 -> 240 un
UPDATE "Lote" SET "quantidade_satelite" = 36 WHERE "id" = 'fb0c78a0-145a-430a-9fef-319cd783c4b2'; -- MACROGOL + BICARBONATO DE  SODIO + CLORETO DE SÓDIO + CLORETO DE POTASSIO (13,125G + 0,1775G + 0, 350G + 0,0466G) Lote: 25K0440 -> 36 un
UPDATE "Lote" SET "quantidade_satelite" = 97 WHERE "id" = '38d87993-53c4-4fad-b8cb-c78fcd4a5460'; -- METOCLOPRAMIDA,  CLORIDRATO (10 MG) Lote: 114435 -> 97 un
UPDATE "Lote" SET "quantidade_satelite" = 130 WHERE "id" = '125a4c57-f0a2-42fa-9067-d1ed56d24ca6'; -- LOSARTANA (25 MG) Lote: 2500818 -> 130 un
UPDATE "Lote" SET "quantidade_satelite" = 20 WHERE "id" = 'a9f271af-004b-4f01-b468-9fdf1bade2a5'; -- NEOMICINA  SULFATO + BACITRACINA (5 MG/G + 250 UI/G) Lote: 25F17U -> 20 un
UPDATE "Lote" SET "quantidade_satelite" = 4 WHERE "id" = 'e71032a4-bb94-4241-9f32-537f69a26070'; -- NEOMICINA  SULFATO + BACITRACINA (5 MG/G + 250 UI/G) Lote: 2526400 -> 4 un
UPDATE "Lote" SET "quantidade_satelite" = 150 WHERE "id" = '3e6876e6-cebc-457f-a8cb-d9a3c4a7af95'; -- NIMESULIDA (100 MG) Lote: 2519311 -> 150 un
UPDATE "Lote" SET "quantidade_satelite" = 133 WHERE "id" = 'de1769d5-4d4b-4297-9e50-d17c71ae147e'; -- NIMESULIDA (100 MG) Lote: 2519196 -> 133 un
UPDATE "Lote" SET "quantidade_satelite" = 13 WHERE "id" = 'c2367b72-3e04-4bbf-808b-a7e52fdfb12f'; -- NISTATINA (25.000 UI/G) Lote: 25E6H1 -> 13 un
UPDATE "Lote" SET "quantidade_satelite" = 22 WHERE "id" = 'ba78b4d3-d9a0-416a-b171-c29234f9004e'; -- PERMETRINA (10 MG/ML) Lote: 60425 -> 22 un
UPDATE "Lote" SET "quantidade_satelite" = 40 WHERE "id" = '0dcc833a-db1f-4a19-9f19-dc749881991f'; -- MIDAZOLAN, MALEATO (5MG/ML) Lote: 78XA0566 -> 40 un
UPDATE "Lote" SET "quantidade_satelite" = 70 WHERE "id" = '7e497a6b-1f24-42c0-80ba-97cbd5b86a7b'; -- ONDANSETRONA,  CLORIDRATO (8 MG) Lote: 4W6114 -> 70 un
UPDATE "Lote" SET "quantidade_satelite" = 52 WHERE "id" = 'cacb95e4-1733-42bb-ad7a-1b0deb3a6b20'; -- PIROXICAM (20 MG) Lote: 251995 -> 52 un
UPDATE "Lote" SET "quantidade_satelite" = 15 WHERE "id" = '7f1cc747-a6d8-4630-82a2-b90a16ddc0aa'; -- PIROXICAM (20 MG) Lote: B25K0833 -> 15 un
UPDATE "Lote" SET "quantidade_satelite" = 424 WHERE "id" = '5be6c129-1be9-43dc-b590-bd889056e412'; -- PANTOPRAZOL SÓDICO (40MG) Lote: 2517146 -> 424 un
UPDATE "Lote" SET "quantidade_satelite" = 1397 WHERE "id" = '9af16a27-2eaa-4686-983d-dcba23cf08b5'; -- PROMETAZINA,  CLORIDRATO (25 MG) Lote: 50020774 -> 1397 un
UPDATE "Lote" SET "quantidade_satelite" = 141 WHERE "id" = 'cc229cab-a93f-4d9f-b1c3-9abb3b0451b3'; -- SACCHAROMYCES BOULARDII (200 MG/G) Lote: B25H0676 -> 141 un
UPDATE "Lote" SET "quantidade_satelite" = 14 WHERE "id" = '3f174466-f467-4a40-8f2a-e0a9029f45ce'; -- NITROFURANTOINA (100 MG) Lote: B624225 -> 14 un
UPDATE "Lote" SET "quantidade_satelite" = 12 WHERE "id" = '8e19acd0-b5c6-4df6-842b-3da0bd2db463'; -- TAZOBACTAM SÓDICO + PIPERACILINA SÓDICA (500 MG + 4G) Lote: 5201050 -> 12 un
UPDATE "Lote" SET "quantidade_satelite" = 5 WHERE "id" = '25b4ae81-e2c5-45da-b741-1cae51e3d8f2'; -- POLISSULFATO DE MUCOPOLISSACARIDEO (3 MG/G) Lote: 251232 -> 5 un
UPDATE "Lote" SET "quantidade_satelite" = 397 WHERE "id" = '7b544f5e-ab62-4434-adb0-472aef861324'; -- NITRAZEPAN (5 MG) Lote: 5B3840 -> 397 un
UPDATE "Lote" SET "quantidade_satelite" = 400 WHERE "id" = '6d35314e-d62d-4f20-882f-5844f06eca45'; -- PERICIAZINA (10 MG) Lote: ERA05072 -> 400 un
UPDATE "Lote" SET "quantidade_satelite" = 275 WHERE "id" = '1a269508-5467-4e11-b4fd-af0d97d199b9'; -- RIVASTIGMINA (1,5 MG) Lote: 2515844 -> 275 un
UPDATE "Lote" SET "quantidade_satelite" = 56 WHERE "id" = 'daac37f8-c336-475f-9a9f-ba7668e6fcbb'; -- SULPIRIDA (50 MG) Lote: FRA00479 -> 56 un
UPDATE "Lote" SET "quantidade_satelite" = 52 WHERE "id" = '7416216a-df22-4830-b0ce-964c0df4df48'; -- METRONIDAZOL (250 MG) Lote: 26B99P -> 52 un
UPDATE "Lote" SET "quantidade_satelite" = 59 WHERE "id" = '782b9d9f-2fbe-4473-afed-4a92c6923097'; -- METRONIDAZOL (250 MG) Lote: 26F4G1 -> 59 un
UPDATE "Lote" SET "quantidade_satelite" = 5 WHERE "id" = '1af43393-34cc-4bd2-87dd-c385eafd330a'; -- SOLUÇÃO RINGER COM LACTATO (associação) Lote: 386725 -> 5 un
UPDATE "Lote" SET "quantidade_satelite" = 36 WHERE "id" = '8df2e418-975e-4a74-ad12-ec4bfa163c41'; -- SULFAMETOZAXOL + TRIMETOPRIMA (400MG + 80 MG) Lote: 25F17Q -> 36 un
UPDATE "Lote" SET "quantidade_satelite" = 4 WHERE "id" = 'd4eb47c3-61ad-4ad4-8f27-24a6aff17cde'; -- SOLUÇÃO GLICOSE (50 MG/ML (5%)) Lote: 1003824 -> 4 un
UPDATE "Lote" SET "quantidade_satelite" = 36 WHERE "id" = '2c389aee-c53f-4d46-b3fe-60ffc6704620'; -- ALBENDAZOL (400 MG) Lote: 25K9C8 -> 36 un
UPDATE "Lote" SET "quantidade_satelite" = 229 WHERE "id" = '65f8dbbe-0cd3-47ef-951e-3e3791293c72'; -- LORATADINA (10 MG) Lote: 2518639 -> 229 un
UPDATE "Lote" SET "quantidade_satelite" = 10 WHERE "id" = '3ba40e39-3e0b-4d9f-b69e-ef4019c853ae'; -- SULFAMETOZAXOL + TRIMETOPRIMA (40 MG/ML + 8MG/ML) Lote: 4N4494 -> 10 un
UPDATE "Lote" SET "quantidade_satelite" = 202 WHERE "id" = '153a1b6e-9173-4198-93de-32d998eb5719'; -- OXIBUTININA. CLORIDRATO (5 MG) Lote: 26010098 -> 202 un
UPDATE "Lote" SET "quantidade_satelite" = 296 WHERE "id" = '8416bd03-9200-4134-97e3-d2d39cad04f5'; -- PREDNISONA (20 MG) Lote: 1295/25M -> 296 un
UPDATE "Lote" SET "quantidade_satelite" = 105 WHERE "id" = '98b85207-77bf-4996-8136-3917398f6023'; -- PREDNISONA (5 MG) Lote: B25K0307 -> 105 un
UPDATE "Lote" SET "quantidade_satelite" = 152 WHERE "id" = '48ccd428-6811-4bf5-9741-0b24cf815fa4'; -- PROPANOLOL,  CLORIDRATO (40 MG) Lote: 126/25 -> 152 un
UPDATE "Lote" SET "quantidade_satelite" = 460 WHERE "id" = '537afdb4-84e1-46b4-8f52-5b49843d8e9d'; -- SINVASTATINA (20MG) Lote: 2513082 -> 460 un
UPDATE "Lote" SET "quantidade_satelite" = 424 WHERE "id" = '0d28ae6f-2748-43cf-a2d7-d28605633357'; -- SULFATO FERROSO (40 MG) Lote: 25E0192 -> 424 un
UPDATE "Lote" SET "quantidade_satelite" = 1344 WHERE "id" = 'f9a73453-43a8-4187-9b32-6ff7f1283f7e'; -- OMEPRAZOL (20 MG) Lote: 254072 -> 1344 un
UPDATE "Lote" SET "quantidade_satelite" = 17 WHERE "id" = 'e6d148c9-363a-4c6d-aafd-a461516cf786'; -- SIMETICONA (75 MG/ML) Lote: 25H0088 -> 17 un
UPDATE "Lote" SET "quantidade_satelite" = 1 WHERE "id" = '4019827e-db17-42ae-81e2-d65ecaf4023c'; -- SIMETICONA (75 MG/ML) Lote: 0344/26 -> 1 un
UPDATE "Lote" SET "quantidade_satelite" = 14 WHERE "id" = 'b755df04-06dd-42b1-be9a-0b847a474286'; -- ÁCIDO VALPRÓICO (50 MG/ML) Lote: 0477/25 -> 14 un
UPDATE "Lote" SET "quantidade_satelite" = 326 WHERE "id" = 'ee0a5391-5efb-4f81-aec1-e844e495f26a'; -- ÁCIDO FÓLICO (5 MG) Lote: 1577/24M -> 326 un
UPDATE "Lote" SET "quantidade_satelite" = 23 WHERE "id" = 'aef46a25-379b-4053-9335-8a65cc40ca92'; -- AMICACINA, SULFATO (250 MG/ML) Lote: 9070178 -> 23 un
UPDATE "Lote" SET "quantidade_satelite" = 10 WHERE "id" = '873bad7b-aabc-4122-9fc7-1b4807e26e8d'; -- AMICACINA, SULFATO (250 MG/ML) Lote: 9070182 -> 10 un
UPDATE "Lote" SET "quantidade_satelite" = 11 WHERE "id" = '1307c301-62bd-4a97-9d0c-cf665d5d6d62'; -- CLORETO DE SÓDIO (0,9 MG/ML (0,9%)) Lote: 25J8862C -> 11 un
UPDATE "Lote" SET "quantidade_satelite" = 5 WHERE "id" = 'bce00451-f633-45ab-99c9-f1518f367929'; -- DEXCLORFENIRAMINA, MALEATO (0,4 MG/ML) Lote: 0035518 -> 5 un
UPDATE "Lote" SET "quantidade_satelite" = 191 WHERE "id" = 'ab1a1af6-f31c-406d-a117-adaa0e21f5f1'; -- ACICLOVIR (400 MG) Lote: 4Z2505 -> 191 un
UPDATE "Lote" SET "quantidade_satelite" = 41 WHERE "id" = '05538b43-2188-4cd4-911e-f3bbd04e029d'; -- DOMPERIDONA (1 MG/ML) Lote: 161113 -> 41 un
UPDATE "Lote" SET "quantidade_satelite" = 16 WHERE "id" = 'a81f0c96-b1e4-4260-b848-589372a979b5'; -- TANSULOSINA (0,4 MG) Lote: 4Z3692 -> 16 un
UPDATE "Lote" SET "quantidade_satelite" = 120 WHERE "id" = 'b6edfda6-8d93-4849-8275-e37dfda0efe4'; -- TANSULOSINA (0,4 MG) Lote: 5K1576 -> 120 un
UPDATE "Lote" SET "quantidade_satelite" = 15 WHERE "id" = 'e7207f1b-cc20-42af-8ef4-2d223863bd09'; -- ESCOPOLAMINA, BUTILBROMETO (20 MG/ML) Lote: H528003 -> 15 un
UPDATE "Lote" SET "quantidade_satelite" = 6 WHERE "id" = 'fa5c9b7d-0bff-4bb6-a3ba-b2c3e61bd46e'; -- NORESTISTERONA, ENANTATO + VALERATO DE ESTRADIOL (50 MG/ML + 5 MG/ML) Lote: 129813 -> 6 un
UPDATE "Lote" SET "quantidade_satelite" = 72 WHERE "id" = '6a048e56-14be-415e-b1aa-c06a86b4337c'; -- LOPERAMIDA (2 MG) Lote: A05A04025 -> 72 un
UPDATE "Lote" SET "quantidade_satelite" = 25 WHERE "id" = '43cf1b4d-11fb-47fd-a0c6-733a49509637'; -- BIPERIDENO (5 MG/ML) Lote: 50027929 -> 25 un
UPDATE "Lote" SET "quantidade_satelite" = 50 WHERE "id" = 'e66c670c-f5d6-4e03-b0b5-09c0dc7196c7'; -- ÓLEO MINERAL (100 ML) Lote: 25J0093 -> 50 un
UPDATE "Lote" SET "quantidade_satelite" = 25 WHERE "id" = 'e6e29dea-bd3d-4e92-a31e-14b7c28575a1'; -- TIAMINA, CLORIDRATO (300 MG) Lote: 26D84S -> 25 un
UPDATE "Lote" SET "quantidade_satelite" = 489 WHERE "id" = '92e7d6f0-4baf-4988-b568-cf0ce549a6fa'; -- TIAMINA, CLORIDRATO (300 MG) Lote: 26H74E -> 489 un
UPDATE "Lote" SET "quantidade_satelite" = 277 WHERE "id" = '4f6b5e44-cc34-4ce4-adc6-755459330ee6'; -- ÁCIDO ACETILSALICILICO (100 MG) Lote: 16876 -> 277 un
UPDATE "Lote" SET "quantidade_satelite" = 269 WHERE "id" = 'd7796adc-c7f3-4753-aff0-5ba302487a52'; -- RIVAROXABANA (20 MG) Lote: 5A4281 -> 269 un
UPDATE "Lote" SET "quantidade_satelite" = 962 WHERE "id" = '89708f7c-a1fd-480b-a1a5-0d52935b3657'; -- ÁCIDO VALPRÓICO (250 MG) Lote: 1257113 -> 962 un
UPDATE "Lote" SET "quantidade_satelite" = 4 WHERE "id" = 'dd54ef1d-c946-4d87-a3ff-db0be386708c'; -- ÓXIDO FÉRRICO, SACARATO (20 MG/ML) Lote: 26011343 -> 4 un
UPDATE "Lote" SET "quantidade_satelite" = 8 WHERE "id" = 'ce6bffa8-7c7b-4ff2-9537-a9f4f4aea890'; -- ACICLOVIR (50 MG/G) Lote: 4N0963 -> 8 un
UPDATE "Lote" SET "quantidade_satelite" = 5 WHERE "id" = '03de29a7-7256-46ae-a296-42da79c7646e'; -- CARBOCISTEINA (50 MG/ML) Lote: 25C478 -> 5 un
UPDATE "Lote" SET "quantidade_satelite" = 833 WHERE "id" = 'fd694b4f-010c-4215-8de0-6d51c45bd821'; -- ÁCIDO VALPRÓICO (500 MG) Lote: 40906656 -> 833 un
UPDATE "Lote" SET "quantidade_satelite" = 224 WHERE "id" = '93061e38-24f6-4a04-a2c7-516aa8f4fc7c'; -- AMANTADINA,  CLORIDRATO (100 MG) Lote: 963360 -> 224 un
UPDATE "Lote" SET "quantidade_satelite" = 425 WHERE "id" = '73831adf-476b-4f02-9a27-62138437f77a'; -- TOPIRAMATO (100 MG) Lote: 4P0986 -> 425 un
UPDATE "Lote" SET "quantidade_satelite" = 844 WHERE "id" = '308d3956-aa9a-4416-9907-a47d23b6e524'; -- CLONAZEPAM (0,5 MG) Lote: 2601506 -> 844 un
UPDATE "Lote" SET "quantidade_satelite" = 209 WHERE "id" = '7a39a921-ed68-4a00-aa56-e8f6d3e8c7fa'; -- METILFENIDATO (10 MG) Lote: 26030288 -> 209 un
UPDATE "Lote" SET "quantidade_satelite" = 283 WHERE "id" = '81c737a4-b33d-4267-b22c-a59108dc64de'; -- OLANZAPINA (10 MG) Lote: 140246 -> 283 un
UPDATE "Lote" SET "quantidade_satelite" = 240 WHERE "id" = '027bdac6-24c2-4daf-83c1-b10c7b1381e1'; -- OLANZAPINA (10 MG) Lote: 50033737 -> 240 un
UPDATE "Lote" SET "quantidade_satelite" = 450 WHERE "id" = '241b919e-29a5-4a60-b41d-1a63185447bf'; -- OLANZAPINA (10 MG) Lote: 2512335 -> 450 un
UPDATE "Lote" SET "quantidade_satelite" = 661 WHERE "id" = '321fdfbb-d107-4249-9d3a-56d152b1afbb'; -- HALOPERIDOL (5 MG) Lote: 50021613 -> 661 un
UPDATE "Lote" SET "quantidade_satelite" = 887 WHERE "id" = 'ae7d2012-7eae-454f-81c5-5c443148d2d3'; -- LAMOTRIGINA (100 MG) Lote: 25D0C5 -> 887 un
UPDATE "Lote" SET "quantidade_satelite" = 180 WHERE "id" = '3a202ed9-6ee5-48e2-9898-ea35642c72b0'; -- LAMOTRIGINA (100 MG) Lote: DFH1631A -> 180 un
UPDATE "Lote" SET "quantidade_satelite" = 937 WHERE "id" = 'a07c16ed-6828-448e-8e5c-78d269f3bd73'; -- LEVOMEPROMAZINA, MALEATO (25 MG) Lote: 50021606 -> 937 un
UPDATE "Lote" SET "quantidade_satelite" = 1435 WHERE "id" = '421a1bec-c054-4233-8339-99f90f8fa2c1'; -- LEVOMEPROMAZINA, MALEATO (100 MG) Lote: 50027383 -> 1435 un
UPDATE "Lote" SET "quantidade_satelite" = 2 WHERE "id" = '1935c833-490d-4f96-b877-c391a37ce334'; -- HALOPERIDOL DECANOATO (50 MG/ML) Lote: 2511084 -> 2 un
UPDATE "Lote" SET "quantidade_satelite" = 31 WHERE "id" = '8060993f-3084-4ec8-bd47-005329eed24a'; -- HALOPERIDOL DECANOATO (50 MG/ML) Lote: 2611870 -> 31 un
UPDATE "Lote" SET "quantidade_satelite" = 1802 WHERE "id" = 'eb6fa7c3-b9e2-4e63-af92-4400f06b03b3'; -- QUETIAPINA, HEMIFUMARATO (100 MG) Lote: 40714027 -> 1802 un
UPDATE "Lote" SET "quantidade_satelite" = 1085 WHERE "id" = '12b50308-7764-4852-b339-899d744cd2d4'; -- DIAZEPAM (5 MG) Lote: 30302525 -> 1085 un
UPDATE "Lote" SET "quantidade_satelite" = 5 WHERE "id" = '9cf48ed0-26f5-4da0-a82b-a6bfc9d94ce5'; -- DELTAMETRINA (0,2 MG/ML) Lote: 035307 -> 5 un
UPDATE "Lote" SET "quantidade_satelite" = 6 WHERE "id" = '0db94c1d-cb09-492e-b5cb-12b28cadad4c'; -- CETOCONAZOL SHAMPOO (20 MG/G) Lote: 250392 -> 6 un
UPDATE "Lote" SET "quantidade_satelite" = 1804 WHERE "id" = '8f8607c5-71bc-4c9a-a577-2b3cec0ad184'; -- RISPERIDONA (2 MG) Lote: 50029490 -> 1804 un
UPDATE "Lote" SET "quantidade_satelite" = 252 WHERE "id" = '9a447663-82c0-4f96-b90f-b63f98146f78'; -- RISPERIDONA (1 MG) Lote: 2441679 -> 252 un
UPDATE "Lote" SET "quantidade_satelite" = 200 WHERE "id" = 'd6d277cd-98b8-4e9e-9a0d-3c385a99d60e'; -- RISPERIDONA (1 MG) Lote: 50034886 -> 200 un
UPDATE "Lote" SET "quantidade_satelite" = 435 WHERE "id" = 'a3378c9b-0c36-4ac3-ae20-ee53442e0e82'; -- LEVETIRACETAM (250 MG) Lote: MA04331A -> 435 un
UPDATE "Lote" SET "quantidade_satelite" = 1020 WHERE "id" = '68021feb-225d-43cc-892e-ed16a6e8a010'; -- TOPIRAMATO (25 MG) Lote: 519230 -> 1020 un
UPDATE "Lote" SET "quantidade_satelite" = 314 WHERE "id" = 'a27e11c2-3bb1-45d0-beb4-76969218cae2'; -- VENLAFAXINA (75 MG) Lote: HVB26010A -> 314 un
UPDATE "Lote" SET "quantidade_satelite" = 356 WHERE "id" = '91c97947-e178-4604-874a-c44992530b7f'; -- FENOBARBITAL (100 MG) Lote: 50029275 -> 356 un
UPDATE "Lote" SET "quantidade_satelite" = 4 WHERE "id" = 'b14ad9b9-0134-4c29-bd94-549cdcec9d68'; -- FITOMENADIONA (10 MG/ML) Lote: 25010047 -> 4 un
UPDATE "Lote" SET "quantidade_satelite" = 9 WHERE "id" = '3cd808b0-05e5-4da3-b60d-d417dcd567f0'; -- FITOMENADIONA (10 MG/ML) Lote: AU-004/25 -> 9 un
UPDATE "Lote" SET "quantidade_satelite" = 236 WHERE "id" = '4bfaae2f-f284-44e6-a5ed-f37cac0bf1ad'; -- HALOPERIDOL (5 MG/ML) Lote: 2534166 -> 236 un
UPDATE "Lote" SET "quantidade_satelite" = 11 WHERE "id" = '54c151ef-eca7-4442-bb14-2fbb41469eb7'; -- TIAMINA, CLORIDRATO + PIRIDOXINA, CLORIDRATO + CIANOCOBALAMINA ([object Object]) Lote: 111484 -> 11 un
UPDATE "Lote" SET "quantidade_satelite" = 7 WHERE "id" = 'e66c4cb8-b5b3-4781-a3c7-a44b3eba6e97'; -- VITAMINA DO COMPLEXO B (associações) Lote: 25060902 -> 7 un
UPDATE "Lote" SET "quantidade_satelite" = 329 WHERE "id" = 'b9b4de9c-55fe-4794-a8c7-806d824ab704'; -- PROMETAZINA,  CLORIDRATO (25 MG/ML) Lote: 50033280 -> 329 un
UPDATE "Lote" SET "quantidade_satelite" = 41 WHERE "id" = '25363455-e766-46f0-8278-a4ee513e8b5c'; -- GLICOSE (50%) Lote: 26C10190D -> 41 un
UPDATE "Lote" SET "quantidade_satelite" = 7 WHERE "id" = 'f08fcb13-e1ab-441b-a655-9a1d9d5c7398'; -- TRAMADOL, CLORIDRATO (100 MG/ML) Lote: B24M0031 -> 7 un
UPDATE "Lote" SET "quantidade_satelite" = 2 WHERE "id" = 'a98895a1-3346-4c38-91d0-bbccf5860128'; -- BRIMONIDINA,  TARTARATO (2MG/ML) Lote: 2603210 -> 2 un
UPDATE "Lote" SET "quantidade_satelite" = 3 WHERE "id" = '5e06a41e-0377-49ec-af46-3ac42253aa5e'; -- TOBRAMICINA + DEXAMETAZONA (3 MG/ML + 1MG/ML) Lote: 25130001 -> 3 un
UPDATE "Lote" SET "quantidade_satelite" = 3 WHERE "id" = 'c8aa9e72-2e3f-47a5-99d1-bae953b433d8'; -- TOBRAMICINA (3 MG/ML) Lote: 4U3754.1 -> 3 un
UPDATE "Lote" SET "quantidade_satelite" = 60 WHERE "id" = 'f5de497b-feaf-41ef-ac52-41738794e665'; -- BENZILPENICILINA BENZATINA (1.200.000UI) Lote: 2505887 -> 60 un
UPDATE "Lote" SET "quantidade_satelite" = 119 WHERE "id" = '3c0725ef-702a-43f3-b49a-6f51a32e3c9b'; -- PREGABALINA (75 MG) Lote: OB0322 -> 119 un
UPDATE "Lote" SET "quantidade_satelite" = 8 WHERE "id" = 'a707b464-a4a5-420f-a6b1-4189d1504fee'; -- TIMOLOL, MALEATO (5 MG/ML) Lote: 2603211 -> 8 un
UPDATE "Lote" SET "quantidade_satelite" = 6 WHERE "id" = '6a966936-ac9b-4348-a5e7-2b5473acb2a0'; -- CARMELOSE SÓDICA (5 MG/ML) Lote: 2503738 -> 6 un
UPDATE "Lote" SET "quantidade_satelite" = 156 WHERE "id" = 'abf3b7fb-b022-4a66-98f0-f76fd3198688'; -- DULOXETINA (30 MG) Lote: 2556340 -> 156 un
UPDATE "Lote" SET "quantidade_satelite" = 290 WHERE "id" = 'b1ed73c4-e0ce-4606-a4e1-00b3f26c5c44'; -- DULOXETINA (30 MG) Lote: 5J7089 -> 290 un
UPDATE "Lote" SET "quantidade_satelite" = 201 WHERE "id" = '78db9134-79d4-4f3c-a582-f9d6e6ae4f84'; -- OLANZAPINA (5 MG) Lote: 2602633 -> 201 un
UPDATE "Lote" SET "quantidade_satelite" = 369 WHERE "id" = 'aaf3de52-a8c9-4aa9-9ec2-1811795316be'; -- ARIPIPRAZOL (15 MG) Lote: 25D25D -> 369 un
UPDATE "Lote" SET "quantidade_satelite" = 118 WHERE "id" = 'fad60f5c-d617-483d-93e6-a7fe0aeb0755'; -- TRAMADOL, CLORIDRATO (50 MG) Lote: 4T4026 -> 118 un
UPDATE "Lote" SET "quantidade_satelite" = 1099 WHERE "id" = '28fdc21a-e393-4159-aaa3-6470a41a6e6b'; -- BIPERIDENO,  CLORIDRATO (2 MG) Lote: 50029082 -> 1099 un
UPDATE "Lote" SET "quantidade_satelite" = 743 WHERE "id" = '9aaeea18-b576-425e-a909-027d071b4f42'; -- FLUOXETINA, CLORIDRATO (20 MG) Lote: 26G28U -> 743 un
UPDATE "Lote" SET "quantidade_satelite" = 136 WHERE "id" = 'f6291816-e149-41cf-b868-d1d603c677c3'; -- METILFENIDATO (20 MG LA) Lote: APCF642 -> 136 un
UPDATE "Lote" SET "quantidade_satelite" = 1840 WHERE "id" = 'a6a7a7fc-e5c0-42e8-8ec3-520fb51cd662'; -- CARBAMAZEPINA (200 MG) Lote: 31224510 -> 1840 un
UPDATE "Lote" SET "quantidade_satelite" = 400 WHERE "id" = 'e3badee9-4338-4afd-887d-4ffee6c1338d'; -- CLOBAZAN (10 MG) Lote: FRA03479 -> 400 un
UPDATE "Lote" SET "quantidade_satelite" = 520 WHERE "id" = 'f9922ef3-d7c2-4f57-8ad7-8625b8e73dcf'; -- CLOBAZAN (10 MG) Lote: FRA03139 -> 520 un
UPDATE "Lote" SET "quantidade_satelite" = 1496 WHERE "id" = 'e5f28dcb-96ea-40e0-947e-279dec827cbb'; -- CLONAZEPAM (2 MG) Lote: 5F5765 -> 1496 un
UPDATE "Lote" SET "quantidade_satelite" = 590 WHERE "id" = 'c66abb8c-8460-48e6-99eb-5dcf6ddc7979'; -- LAMOTRIGINA (25  MG) Lote: 50036520 -> 590 un
UPDATE "Lote" SET "quantidade_satelite" = 676 WHERE "id" = '67c604ed-9d5a-485c-b8b0-1f3f3e53885b'; -- AMITRIPTILINA, CLORIDRATO (25 MG) Lote: B25C1679 -> 676 un
UPDATE "Lote" SET "quantidade_satelite" = 93 WHERE "id" = '89a80016-75d9-4ccd-9a1b-ce80591f3d9d'; -- AMINAFTONA (75 MG) Lote: EK50 -> 93 un
UPDATE "Lote" SET "quantidade_satelite" = 180 WHERE "id" = '42113c40-e348-4a42-802b-9e3a2be342cb'; -- AMINAFTONA (75 MG) Lote: EL58 -> 180 un
UPDATE "Lote" SET "quantidade_satelite" = 343 WHERE "id" = '0ce26639-dc4c-454d-b880-63f861cc4c3b'; -- ESPIRONOLACTONA (25 MG) Lote: 5E9328 -> 343 un
UPDATE "Lote" SET "quantidade_satelite" = 1342 WHERE "id" = '84af7e18-b5f6-4cba-8011-d0f1f1787d06'; -- SENNA ALEXANDRINA MILL + CASSIA FISTULA L (6 MG) Lote: B25D1458 -> 1342 un
UPDATE "Lote" SET "quantidade_satelite" = 1166 WHERE "id" = '26ac724b-3502-4817-a290-49824b8ae483'; -- SERTRALINA, CLORIDRATO (50 MG) Lote: 2510300 -> 1166 un
UPDATE "Lote" SET "quantidade_satelite" = 678 WHERE "id" = 'a5906eed-1add-446c-8eaf-980111b4e0f9'; -- CLORPROMAZINA, CLORIDRATO (100 MG) Lote: 2532988 -> 678 un
UPDATE "Lote" SET "quantidade_satelite" = 400 WHERE "id" = '188afe1c-2586-4ff7-903c-4a2ebf9c4803'; -- CLORPROMAZINA, CLORIDRATO (100 MG) Lote: 50037685 -> 400 un
UPDATE "Lote" SET "quantidade_satelite" = 200 WHERE "id" = '6a46b9bb-12f6-4c17-b738-adcae9dc438f'; -- CLORPROMAZINA, CLORIDRATO (100 MG) Lote: 50037682 -> 200 un
UPDATE "Lote" SET "quantidade_satelite" = 52 WHERE "id" = '44108738-5ce0-4666-9d2f-0a67b254f0f7'; -- DIAZEPAM (5 MG/ML) Lote: AO-002/24 -> 52 un
UPDATE "Lote" SET "quantidade_satelite" = 1 WHERE "id" = '9ffae2a1-ed48-48ed-800d-e8999f53b32c'; -- DIAZEPAM (5 MG/ML) Lote: 20102226 -> 1 un
UPDATE "Lote" SET "quantidade_satelite" = 9 WHERE "id" = '901718d9-e459-4471-bcaa-6e2e58ad9f0e'; -- FENOBARBITAL SÓDICO (100 MG/ML) Lote: 50031369 -> 9 un
UPDATE "Lote" SET "quantidade_satelite" = 617 WHERE "id" = '999d2158-64c1-4e72-a207-b962f491c207'; -- DIAZEPAM (10 MG) Lote: 30408525 -> 617 un

COMMIT;

-- Total de comandos de atualização gerados: 260