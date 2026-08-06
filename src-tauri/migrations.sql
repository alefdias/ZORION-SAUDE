-- Create tables for the pharmacy system

-- ─────────────────────────────────────────────────────────
-- Tabela de controle de sincronização (DEVE ser criada primeiro)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_metadata (
    id INTEGER PRIMARY KEY CHECK (id = 1), -- linha única
    last_sync TEXT,                         -- ISO-8601 da última sincronização bem-sucedida
    app_version TEXT DEFAULT '1.0.0',
    initial_load_completed INTEGER DEFAULT 0 -- 0 = falso, 1 = verdadeiro
);

-- Garante que a linha de controle sempre existe
INSERT OR IGNORE INTO sync_metadata (id, last_sync, app_version, initial_load_completed)
VALUES (1, NULL, '1.0.0', 0);

-- ─────────────────────────────────────────────────────────
-- Fila de operações pendentes (alterações offline)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pending_sync (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entity_name, record_id) ON CONFLICT REPLACE
);

CREATE TABLE IF NOT EXISTS Categoria (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    descricao TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Fornecedor (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    cnpj TEXT,
    email TEXT,
    telefone TEXT,
    endereco TEXT,
    contato TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Ala (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    descricao TEXT,
    responsavel TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Medicamento (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    codigo TEXT,
    principio_ativo TEXT,
    categoria TEXT,
    categoria_id TEXT,
    apresentacao TEXT,
    dosagem TEXT,
    unidade_medida TEXT,
    nome_comercial TEXT,
    padronizado BOOLEAN DEFAULT 0,
    is_mav BOOLEAN DEFAULT 0,
    estoque_satelite INTEGER DEFAULT 0,
    estoque_minimo INTEGER DEFAULT 0,
    estoque_atual INTEGER DEFAULT 0,
    markup REAL DEFAULT 0,
    valor_venda REAL DEFAULT 0,
    codigo_barras TEXT,
    localizacao TEXT,
    observacoes TEXT,
    ativo BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Lote (
    id TEXT PRIMARY KEY,
    medicamento_id TEXT NOT NULL,
    medicamento_nome TEXT,
    numero_lote TEXT NOT NULL,
    data_validade DATE NOT NULL,
    quantidade_inicial INTEGER NOT NULL,
    quantidade_atual INTEGER NOT NULL,
    valor_unitario REAL,
    fornecedor_id TEXT,
    status TEXT DEFAULT 'disponivel', -- disponivel, esgotado, vencido
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medicamento_id) REFERENCES Medicamento(id),
    FOREIGN KEY (fornecedor_id) REFERENCES Fornecedor(id)
);

CREATE TABLE IF NOT EXISTS Entrada (
    id TEXT PRIMARY KEY,
    medicamento_id TEXT NOT NULL,
    medicamento_nome TEXT,
    lote_id TEXT NOT NULL,
    numero_lote TEXT,
    data_validade DATE,
    data_entrada DATE NOT NULL,
    quantidade INTEGER NOT NULL,
    valor_unitario REAL,
    valor_total REAL,
    nota_fiscal TEXT,
    fornecedor_id TEXT,
    fornecedor_nome TEXT,
    observacao TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medicamento_id) REFERENCES Medicamento(id),
    FOREIGN KEY (lote_id) REFERENCES Lote(id),
    FOREIGN KEY (fornecedor_id) REFERENCES Fornecedor(id)
);

CREATE TABLE IF NOT EXISTS Saida (
    id TEXT PRIMARY KEY,
    medicamento_id TEXT NOT NULL,
    medicamento_nome TEXT,
    lote_id TEXT NOT NULL,
    numero_lote TEXT,
    data_saida DATE NOT NULL,
    quantidade INTEGER NOT NULL,
    destino TEXT, -- ala_id or custom string
    ala_id TEXT,
    ala_nome TEXT,
    motivo TEXT,
    responsavel TEXT,
    paciente_nome TEXT,
    observacao TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medicamento_id) REFERENCES Medicamento(id),
    FOREIGN KEY (lote_id) REFERENCES Lote(id),
    FOREIGN KEY (ala_id) REFERENCES Ala(id)
);

CREATE TABLE IF NOT EXISTS Emprestimo (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL, -- 'emprestar' ou 'receber'
    medicamento_id TEXT NOT NULL,
    medicamento_nome TEXT,
    lote_id TEXT,
    numero_lote TEXT,
    quantidade INTEGER NOT NULL,
    ala_destino_id TEXT,
    ala_destino_nome TEXT,
    responsavel TEXT,
    data_emprestimo DATE NOT NULL,
    status TEXT DEFAULT 'pendente', -- pendente, devolvido, concluido
    observacao TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medicamento_id) REFERENCES Medicamento(id),
    FOREIGN KEY (lote_id) REFERENCES Lote(id),
    FOREIGN KEY (ala_destino_id) REFERENCES Ala(id)
);

CREATE TABLE IF NOT EXISTS Config (
    key TEXT PRIMARY KEY,
    value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO Config (key, value) VALUES ('last_backup_date', NULL);

CREATE TABLE IF NOT EXISTS Inventario (
    id TEXT PRIMARY KEY,
    data_inicio DATETIME NOT NULL,
    data_fim DATETIME,
    responsavel TEXT,
    status TEXT DEFAULT 'em_andamento', -- em_andamento, concluido, cancelado
    observacao TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS InventarioItem (
    id TEXT PRIMARY KEY,
    inventario_id TEXT NOT NULL,
    medicamento_id TEXT NOT NULL,
    medicamento_nome TEXT,
    lote_id TEXT NOT NULL,
    numero_lote TEXT,
    quantidade_sistema INTEGER NOT NULL,
    quantidade_fisica INTEGER,
    divergencia INTEGER,
    ajustado BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (inventario_id) REFERENCES Inventario(id),
    FOREIGN KEY (medicamento_id) REFERENCES Medicamento(id),
    FOREIGN KEY (lote_id) REFERENCES Lote(id)
);

-- ─────────────────────────────────────────────────────────
-- Índices para performance em sincronização incremental
-- ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_medicamento_created_at ON Medicamento(created_at);
CREATE INDEX IF NOT EXISTS idx_lote_created_at ON Lote(created_at);
CREATE INDEX IF NOT EXISTS idx_entrada_created_at ON Entrada(created_at);
CREATE INDEX IF NOT EXISTS idx_saida_created_at ON Saida(created_at);
CREATE INDEX IF NOT EXISTS idx_fornecedor_created_at ON Fornecedor(created_at);
CREATE INDEX IF NOT EXISTS idx_ala_created_at ON Ala(created_at);
CREATE INDEX IF NOT EXISTS idx_emprestimo_created_at ON Emprestimo(created_at);
CREATE INDEX IF NOT EXISTS idx_inventario_created_at ON Inventario(created_at);
CREATE INDEX IF NOT EXISTS idx_inventario_item_created_at ON InventarioItem(created_at);

-- Índices adicionais para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_lote_medicamento_id ON Lote(medicamento_id);
CREATE INDEX IF NOT EXISTS idx_lote_data_validade ON Lote(data_validade);
CREATE INDEX IF NOT EXISTS idx_lote_status ON Lote(status);
CREATE INDEX IF NOT EXISTS idx_entrada_medicamento_id ON Entrada(medicamento_id);
CREATE INDEX IF NOT EXISTS idx_saida_medicamento_id ON Saida(medicamento_id);
CREATE INDEX IF NOT EXISTS idx_saida_data_saida ON Saida(data_saida);

-- ─────────────────────────────────────────────────────────
-- Tabelas do Módulo Carrinho de Parada
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS CarrinhoPadronizacao (
    id TEXT PRIMARY KEY,
    medicamento_id TEXT NOT NULL,
    medicamento_nome TEXT NOT NULL,
    qtd_padrao INTEGER NOT NULL DEFAULT 1,
    is_mav BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medicamento_id) REFERENCES Medicamento(id)
);

CREATE TABLE IF NOT EXISTS CarrinhoEstoqueCentral (
    id TEXT PRIMARY KEY,
    medicamento_id TEXT NOT NULL,
    medicamento_nome TEXT,
    lote_id TEXT NOT NULL,
    numero_lote TEXT,
    data_validade DATE,
    lote TEXT,
    validade DATE,
    quantidade INTEGER NOT NULL,
    is_mav BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medicamento_id) REFERENCES Medicamento(id),
    FOREIGN KEY (lote_id) REFERENCES Lote(id)
);

CREATE TABLE IF NOT EXISTS CarrinhoEstoqueFisico (
    id TEXT PRIMARY KEY,
    carrinho_id TEXT NOT NULL,
    medicamento_id TEXT NOT NULL,
    medicamento_nome TEXT,
    lote_id TEXT NOT NULL,
    numero_lote TEXT,
    data_validade DATE,
    lote TEXT,
    validade DATE,
    quantidade INTEGER NOT NULL,
    is_mav BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medicamento_id) REFERENCES Medicamento(id),
    FOREIGN KEY (lote_id) REFERENCES Lote(id)
);

CREATE TABLE IF NOT EXISTS CarrinhoMovimentacao (
    id TEXT PRIMARY KEY,
    tipo TEXT NOT NULL, -- 'transferencia_central', 'abastecimento_carrinho', 'substituicao_vencimento', 'consumo'
    medicamento_id TEXT NOT NULL,
    medicamento_nome TEXT,
    lote_id TEXT,
    numero_lote TEXT,
    quantidade INTEGER NOT NULL,
    carrinho_id TEXT,
    responsavel TEXT,
    data_movimentacao DATETIME DEFAULT CURRENT_TIMESTAMP,
    observacao TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medicamento_id) REFERENCES Medicamento(id),
    FOREIGN KEY (lote_id) REFERENCES Lote(id)
);

-- ─────────────────────────────────────────────────────────
-- Tabelas do Módulo Pacientes e Medicação Fixa
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Paciente (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    prontuario TEXT,
    idade INTEGER,
    alaId TEXT,
    alaNome TEXT,
    leito TEXT,
    status TEXT DEFAULT 'Ativo',
    observacoes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS PrescricaoPaciente (
    id TEXT PRIMARY KEY,
    pacienteId TEXT NOT NULL,
    pacienteNome TEXT,
    prontuario TEXT,
    alaNome TEXT,
    leito TEXT,
    medicamentoId TEXT NOT NULL,
    medicamentoNome TEXT,
    medicamentoCodigo TEXT,
    apresentacao TEXT,
    dosagem TEXT,
    dose08 TEXT,
    dose14 TEXT,
    dose22 TEXT,
    dose06 TEXT,
    esquemaPosologico TEXT,
    totalDiario INTEGER,
    horarios TEXT,
    dataInicio DATE,
    dataFim DATE,
    status TEXT DEFAULT 'Ativa',
    observacoes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pacienteId) REFERENCES Paciente(id),
    FOREIGN KEY (medicamentoId) REFERENCES Medicamento(id)
);

-- ─────────────────────────────────────────────────────────
-- Tabelas do Módulo RT (Auditoria/Logs)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS Auditoria (
    id TEXT PRIMARY KEY,
    usuario TEXT NOT NULL,
    acao TEXT NOT NULL,
    detalhes TEXT,
    modulo TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
