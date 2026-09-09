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

CREATE TABLE IF NOT EXISTS "Lote" (
    "id" TEXT PRIMARY KEY,
    "medicamento_id" TEXT,
    "numero_lote" TEXT,
    "data_validade" TEXT,
    "quantidade_atual" INTEGER,
    "status" TEXT,
    "created_at" TEXT,
    "deleted_at" TEXT
);

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
    "created_at" TEXT,
    "deleted_at" TEXT
);

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
