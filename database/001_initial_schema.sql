CREATE TABLE IF NOT EXISTS "Medicamento" (
    "id" TEXT PRIMARY KEY,
    "nome" TEXT,
    "codigo" TEXT,
    "concentracao" TEXT,
    "categoria_id" TEXT,
    "estoque_atual" INTEGER DEFAULT 0,
    "estoque_minimo" INTEGER DEFAULT 0,
    "estoque_satelite" INTEGER DEFAULT 0,
    "created_at" TEXT,
    "deleted_at" TEXT
);

ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "estoque_atual" INTEGER DEFAULT 0;
ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "estoque_minimo" INTEGER DEFAULT 0;
ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "estoque_satelite" INTEGER DEFAULT 0;
ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "is_adiantamento" BOOLEAN DEFAULT false;
ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "nota_fiscal" TEXT;
ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "valor_compra" REAL;
ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "fornecedor_nome" TEXT;
ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "volume_frasco_ml" NUMERIC;
ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "is_liquido" BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS "Lote" (
    "id" TEXT PRIMARY KEY,
    "medicamento_id" TEXT,
    "numero_lote" TEXT,
    "data_validade" TEXT,
    "quantidade_inicial" INTEGER,
    "quantidade_atual" INTEGER,
    "volume_frasco_ml" NUMERIC,
    "status" TEXT,
    "created_at" TEXT,
    "deleted_at" TEXT
);

ALTER TABLE "Lote" ADD COLUMN IF NOT EXISTS "volume_frasco_ml" NUMERIC;
ALTER TABLE "Lote" ADD COLUMN IF NOT EXISTS "quantidade_inicial" INTEGER;

CREATE TABLE IF NOT EXISTS "Entrada" (
    "id" TEXT PRIMARY KEY,
    "medicamento_id" TEXT,
    "medicamento_nome" TEXT,
    "lote_id" TEXT,
    "numero_lote" TEXT,
    "data_validade" TEXT,
    "quantidade" INTEGER,
    "fornecedor_id" TEXT,
    "fornecedor_nome" TEXT,
    "nota_fiscal" TEXT,
    "numero_nota_fiscal" TEXT,
    "tipo" TEXT,
    "data_entrada" TEXT,
    "created_at" TEXT,
    "deleted_at" TEXT
);

ALTER TABLE "Entrada" ADD COLUMN IF NOT EXISTS "numero_lote" TEXT;
ALTER TABLE "Entrada" ADD COLUMN IF NOT EXISTS "data_validade" TEXT;
ALTER TABLE "Entrada" ADD COLUMN IF NOT EXISTS "fornecedor_nome" TEXT;
ALTER TABLE "Entrada" ADD COLUMN IF NOT EXISTS "numero_nota_fiscal" TEXT;
ALTER TABLE "Entrada" ADD COLUMN IF NOT EXISTS "tipo" TEXT;
ALTER TABLE "Entrada" ADD COLUMN IF NOT EXISTS "volume_frasco_ml" NUMERIC;

CREATE TABLE IF NOT EXISTS "Saida" (
    "id" TEXT PRIMARY KEY,
    "medicamento_id" TEXT,
    "medicamento_nome" TEXT,
    "lote_id" TEXT,
    "quantidade" INTEGER,
    "destino" TEXT,
    "motivo" TEXT,
    "data_saida" TEXT,
    "created_at" TEXT,
    "deleted_at" TEXT
);

CREATE TABLE IF NOT EXISTS "Fornecedor" (
    "id" TEXT PRIMARY KEY,
    "nome" TEXT,
    "razao_social" TEXT,
    "cnpj" TEXT,
    "municipio" TEXT,
    "uf" TEXT,
    "situacao" TEXT DEFAULT 'ATIVA',
    "cnae" TEXT DEFAULT '4644-3/01',
    "telefone" TEXT,
    "email" TEXT,
    "endereco" TEXT,
    "contato" TEXT,
    "created_at" TEXT,
    "deleted_at" TEXT
);

CREATE TABLE IF NOT EXISTS "Ala" (
    "id" TEXT PRIMARY KEY,
    "nome" TEXT,
    "descricao" TEXT,
    "leitos" INTEGER DEFAULT 10,
    "created_at" TEXT,
    "deleted_at" TEXT
);
ALTER TABLE "Ala" ADD COLUMN IF NOT EXISTS "leitos" INTEGER DEFAULT 10;

CREATE TABLE IF NOT EXISTS "Emprestimo" (
    "id" TEXT PRIMARY KEY,
    "medicamento_id" TEXT,
    "medicamento_nome" TEXT,
    "lote_id" TEXT,
    "quantidade" INTEGER,
    "instituicao" TEXT,
    "data_emprestimo" TEXT,
    "status" TEXT,
    "created_at" TEXT,
    "deleted_at" TEXT
);

CREATE TABLE IF NOT EXISTS "Categoria" (
    "id" TEXT PRIMARY KEY,
    "nome" TEXT,
    "descricao" TEXT,
    "created_at" TEXT,
    "deleted_at" TEXT
);

CREATE TABLE IF NOT EXISTS "Inventario" (
    "id" TEXT PRIMARY KEY,
    "data_inicio" TEXT,
    "data_fim" TEXT,
    "status" TEXT,
    "responsavel" TEXT,
    "created_at" TEXT,
    "deleted_at" TEXT
);

CREATE TABLE IF NOT EXISTS "InventarioItem" (
    "id" TEXT PRIMARY KEY,
    "inventario_id" TEXT,
    "medicamento_id" TEXT,
    "lote_id" TEXT,
    "quantidade_sistema" INTEGER,
    "quantidade_fisica" INTEGER,
    "divergencia" INTEGER,
    "created_at" TEXT,
    "deleted_at" TEXT
);

CREATE TABLE IF NOT EXISTS "Config" (
    "id" TEXT PRIMARY KEY,
    "chave" TEXT,
    "valor" TEXT,
    "created_at" TEXT,
    "deleted_at" TEXT
);

CREATE TABLE IF NOT EXISTS "CarrinhoPadronizacao" (
    "id" TEXT PRIMARY KEY,
    "medicamento_id" TEXT,
    "lote_id" TEXT,
    "quantidade" INTEGER,
    "created_at" TEXT,
    "deleted_at" TEXT
);

CREATE TABLE IF NOT EXISTS "CarrinhoEstoqueCentral" (
    "id" TEXT PRIMARY KEY,
    "medicamento_id" TEXT,
    "lote_id" TEXT,
    "quantidade" INTEGER,
    "created_at" TEXT,
    "deleted_at" TEXT
);

CREATE TABLE IF NOT EXISTS "CarrinhoEstoqueFisico" (
    "id" TEXT PRIMARY KEY,
    "medicamento_id" TEXT,
    "lote_id" TEXT,
    "quantidade" INTEGER,
    "created_at" TEXT,
    "deleted_at" TEXT
);

CREATE TABLE IF NOT EXISTS "CarrinhoMovimentacao" (
    "id" TEXT PRIMARY KEY,
    "medicamento_id" TEXT,
    "lote_id" TEXT,
    "quantidade" INTEGER,
    "created_at" TEXT,
    "deleted_at" TEXT
);

CREATE TABLE IF NOT EXISTS "Paciente" (
    "id" TEXT PRIMARY KEY,
    "nome" TEXT,
    "prontuario" TEXT,
    "data_nascimento" TEXT,
    "ala_id" TEXT,
    "leito" TEXT,
    "status" TEXT,
    "created_at" TEXT,
    "deleted_at" TEXT
);

CREATE TABLE IF NOT EXISTS "PrescricaoPaciente" (
    "id" TEXT PRIMARY KEY,
    "paciente_id" TEXT,
    "medicamento_id" TEXT,
    "medicamento_nome" TEXT,
    "concentracao" TEXT,
    "frequencia" TEXT,
    "via_administracao" TEXT,
    "data_inicio" TEXT,
    "data_fim" TEXT,
    "status" TEXT,
    "created_at" TEXT,
    "deleted_at" TEXT
);

ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "pacienteId" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "pacienteNome" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "prontuario" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "alaNome" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "leito" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "medicamentoId" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "medicamentoNome" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "medicamentoCodigo" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "apresentacao" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "concentracao" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "dose08" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "dose14" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "dose22" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "dose06" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "isMetade08" BOOLEAN DEFAULT false;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "isMetade14" BOOLEAN DEFAULT false;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "isMetade22" BOOLEAN DEFAULT false;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "isMetade06" BOOLEAN DEFAULT false;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "totalDiario" NUMERIC;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "esquemaPosologico" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "horarios" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "observacoes" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "dataInicio" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "dataFim" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'Ativa';
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "viaAdministracao" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "via_administracao" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "horarioInicio" TEXT DEFAULT '08:00';
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "is_liquido" BOOLEAN DEFAULT false;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "unidade_dose" TEXT DEFAULT 'comp';
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "volume_frasco_ml" NUMERIC;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "duracao_frasco_dias" INTEGER;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "data_ultimo_frasco" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "data_proximo_frasco" TEXT;
ALTER TABLE "PrescricaoPaciente" ALTER COLUMN "totalDiario" TYPE NUMERIC USING "totalDiario"::numeric;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "created_at" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "deleted_at" TEXT;


CREATE TABLE IF NOT EXISTS "Auditoria" (
    "id" TEXT PRIMARY KEY,
    "acao" TEXT,
    "entidade" TEXT,
    "entidade_id" TEXT,
    "detalhes" TEXT,
    "usuario" TEXT,
    "data_hora" TEXT,
    "created_at" TEXT,
    "deleted_at" TEXT
);

CREATE TABLE IF NOT EXISTS "PedidoSatelite" (
    "id" TEXT PRIMARY KEY,
    "codigo" TEXT,
    "ala_id" TEXT,
    "ala_nome" TEXT,
    "dias_calculados" INTEGER,
    "solicitante" TEXT,
    "data_solicitacao" TEXT,
    "status" TEXT,
    "data_separacao" TEXT,
    "data_entrega" TEXT,
    "data_recebimento" TEXT,
    "itens_json" TEXT,
    "observacao" TEXT,
    "created_at" TEXT,
    "deleted_at" TEXT
);

ALTER TABLE "PedidoSatelite" ADD COLUMN IF NOT EXISTS "data_separacao" TEXT;
ALTER TABLE "PedidoSatelite" ADD COLUMN IF NOT EXISTS "data_entrega" TEXT;
ALTER TABLE "PedidoSatelite" ADD COLUMN IF NOT EXISTS "data_recebimento" TEXT;
ALTER TABLE "PedidoSatelite" ADD COLUMN IF NOT EXISTS "observacao" TEXT;
ALTER TABLE "PedidoSatelite" ADD COLUMN IF NOT EXISTS "margem_seguranca" INTEGER DEFAULT 0;
ALTER TABLE "PedidoSatelite" ADD COLUMN IF NOT EXISTS "descontar_estoque" INTEGER DEFAULT 0;
ALTER TABLE "PedidoSatelite" ADD COLUMN IF NOT EXISTS "motivo_cancelamento" TEXT;
ALTER TABLE "PedidoSatelite" ADD COLUMN IF NOT EXISTS "data_cancelamento" TEXT;

CREATE TABLE IF NOT EXISTS "TransferenciaPendente" (
    "id" TEXT PRIMARY KEY,
    "medicamento_id" TEXT,
    "medicamento_nome" TEXT,
    "lote_id" TEXT,
    "numero_lote" TEXT,
    "quantidade" INTEGER,
    "direcao" TEXT,
    "status" TEXT,
    "data_solicitacao" TEXT,
    "data_aceite" TEXT,
    "deleted_at" TEXT
);

CREATE TABLE IF NOT EXISTS "Usuario" (
    "id" TEXT PRIMARY KEY,
    "nome" TEXT,
    "login" TEXT UNIQUE,
    "senha" TEXT,
    "coren" TEXT,
    "crf" TEXT,
    "perfil" TEXT,
    "created_at" TEXT,
    "deleted_at" TEXT
);

-- Tentar adicionar as colunas caso a tabela já tenha sido criada antes
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "coren" TEXT;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "crf" TEXT;

-- Inserindo usuário administrador padrão (senha: admin123)
INSERT INTO "Usuario" ("id", "nome", "login", "senha", "perfil") 
VALUES ('user-admin-uuid', 'Administrador', 'admin', 'admin123', 'admin')
ON CONFLICT DO NOTHING;

-- Garantir as colunas em tabelas vitais
ALTER TABLE "Entrada" ADD COLUMN IF NOT EXISTS "numero_lote" TEXT;
ALTER TABLE "Entrada" ADD COLUMN IF NOT EXISTS "data_validade" TEXT;
ALTER TABLE "Entrada" ADD COLUMN IF NOT EXISTS "fornecedor_nome" TEXT;
ALTER TABLE "Entrada" ADD COLUMN IF NOT EXISTS "numero_nota_fiscal" TEXT;
ALTER TABLE "Entrada" ADD COLUMN IF NOT EXISTS "tipo" TEXT;
ALTER TABLE "Entrada" ADD COLUMN IF NOT EXISTS "medicamento_nome" TEXT;
ALTER TABLE "Entrada" ADD COLUMN IF NOT EXISTS "data_entrada" TEXT;

ALTER TABLE "PedidoSatelite" ADD COLUMN IF NOT EXISTS "data_separacao" TEXT;
ALTER TABLE "PedidoSatelite" ADD COLUMN IF NOT EXISTS "data_entrega" TEXT;
ALTER TABLE "PedidoSatelite" ADD COLUMN IF NOT EXISTS "data_recebimento" TEXT;
ALTER TABLE "PedidoSatelite" ADD COLUMN IF NOT EXISTS "observacao" TEXT;

-- ==========================================
-- ALTERAÇÕES PARA FRACIONAMENTO E PORTARIA 344
-- ==========================================

-- 1. Ligação de Pai/Filho no Medicamento (Para o Fracionamento)
ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "medicamento_origem_id" TEXT;
ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "fator_fracionamento" INTEGER DEFAULT 0;

-- 2. Tabela da "Gaveta do Paciente" (Estoque Nominal de Metadinhas)
CREATE TABLE IF NOT EXISTS "GavetaPaciente" (
    "id" TEXT PRIMARY KEY,
    "paciente_id" TEXT,
    "medicamento_id" TEXT,
    "lote_id" TEXT,
    "quantidade" INTEGER,
    "created_at" TEXT,
    "deleted_at" TEXT
);

-- ==========================================
-- CAPACIDADES OFICIAIS DE LEITOS POR ALA
-- ==========================================
-- N1: 39 leitos
UPDATE "Ala" SET "leitos" = 39 WHERE LOWER(TRIM("nome")) IN ('n1', 'ala n1', 'ala-n1');
INSERT INTO "Ala" ("id", "nome", "descricao", "leitos", "created_at")
SELECT 'ala-n1-uuid', 'N1', 'Ala N1 (39 leitos)', 39, NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Ala" WHERE LOWER(TRIM("nome")) IN ('n1', 'ala n1', 'ala-n1') AND deleted_at IS NULL);

-- N2: 39 leitos
UPDATE "Ala" SET "leitos" = 39 WHERE LOWER(TRIM("nome")) IN ('n2', 'ala n2', 'ala-n2');
INSERT INTO "Ala" ("id", "nome", "descricao", "leitos", "created_at")
SELECT 'ala-n2-uuid', 'N2', 'Ala N2 (39 leitos)', 39, NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Ala" WHERE LOWER(TRIM("nome")) IN ('n2', 'ala n2', 'ala-n2') AND deleted_at IS NULL);

-- R1 M: 10 leitos
UPDATE "Ala" SET "leitos" = 10 WHERE LOWER(TRIM("nome")) IN ('r1 m', 'r1-m', 'r1m', 'r1 masculino', 'ala r1 m', 'ala r1 masculino');
INSERT INTO "Ala" ("id", "nome", "descricao", "leitos", "created_at")
SELECT 'ala-r1m-uuid', 'R1 M', 'Ala R1 Masculino (10 leitos)', 10, NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Ala" WHERE LOWER(TRIM("nome")) IN ('r1 m', 'r1-m', 'r1m', 'r1 masculino', 'ala r1 m', 'ala r1 masculino') AND deleted_at IS NULL);

-- R1 F: 15 leitos
UPDATE "Ala" SET "leitos" = 15 WHERE LOWER(TRIM("nome")) IN ('r1 f', 'r1-f', 'r1f', 'r1 feminino', 'ala r1 f', 'ala r1 feminino');
INSERT INTO "Ala" ("id", "nome", "descricao", "leitos", "created_at")
SELECT 'ala-r1f-uuid', 'R1 F', 'Ala R1 Feminino (15 leitos)', 15, NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Ala" WHERE LOWER(TRIM("nome")) IN ('r1 f', 'r1-f', 'r1f', 'r1 feminino', 'ala r1 f', 'ala r1 feminino') AND deleted_at IS NULL);

-- UCP: 10 leitos
UPDATE "Ala" SET "leitos" = 10 WHERE LOWER(TRIM("nome")) IN ('ucp', 'ala ucp');
INSERT INTO "Ala" ("id", "nome", "descricao", "leitos", "created_at")
SELECT 'ala-ucp-uuid', 'UCP', 'Unidade de Cuidados Prolongados (10 leitos)', 10, NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Ala" WHERE LOWER(TRIM("nome")) IN ('ucp', 'ala ucp') AND deleted_at IS NULL);

-- CL1: 10 leitos
UPDATE "Ala" SET "leitos" = 10 WHERE LOWER(TRIM("nome")) IN ('cl1', 'cl 1', 'ala cl1', 'ala cl 1', 'clinica 1');
INSERT INTO "Ala" ("id", "nome", "descricao", "leitos", "created_at")
SELECT 'ala-cl1-uuid', 'CL1', 'Ala Clínica 1 (10 leitos)', 10, NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Ala" WHERE LOWER(TRIM("nome")) IN ('cl1', 'cl 1', 'ala cl1', 'ala cl 1', 'clinica 1') AND deleted_at IS NULL);

-- CL2: 10 leitos
UPDATE "Ala" SET "leitos" = 10 WHERE LOWER(TRIM("nome")) IN ('cl2', 'cl 2', 'ala cl2', 'ala cl 2', 'clinica 2');
INSERT INTO "Ala" ("id", "nome", "descricao", "leitos", "created_at")
SELECT 'ala-cl2-uuid', 'CL2', 'Ala Clínica 2 (10 leitos)', 10, NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Ala" WHERE LOWER(TRIM("nome")) IN ('cl2', 'cl 2', 'ala cl2', 'ala cl 2', 'clinica 2') AND deleted_at IS NULL);

-- CASA MENINOS: 3 leitos
UPDATE "Ala" SET "leitos" = 3 WHERE LOWER(TRIM("nome")) IN ('casa meninos', 'casa dos meninos', 'ala casa meninos', 'ala casa dos meninos');
INSERT INTO "Ala" ("id", "nome", "descricao", "leitos", "created_at")
SELECT 'ala-casameninos-uuid', 'Casa Meninos', 'Casa dos Meninos (3 leitos)', 3, NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Ala" WHERE LOWER(TRIM("nome")) IN ('casa meninos', 'casa dos meninos', 'ala casa meninos', 'ala casa dos meninos') AND deleted_at IS NULL);

