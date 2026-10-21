-- ==============================================================================
-- ZORION SAÚDE / ZORION RECEPÇÃO / ZORION MÉDICO - SCHEMA COMPLETO UNIFICADO
-- PostgreSQL Database Initial Schema & Migration Script
-- ==============================================================================

-- 1. MEDICAMENTO
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
ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "medicamento_origem_id" TEXT;
ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "fator_fracionamento" INTEGER DEFAULT 0;

-- 2. LOTE
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

-- 3. ENTRADA DE ESTOQUE
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
ALTER TABLE "Entrada" ADD COLUMN IF NOT EXISTS "medicamento_nome" TEXT;
ALTER TABLE "Entrada" ADD COLUMN IF NOT EXISTS "data_entrada" TEXT;

-- 4. SAÍDA DE ESTOQUE
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
ALTER TABLE "Saida" ALTER COLUMN "lote_id" DROP NOT NULL;
ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "numero_lote" TEXT;
ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "observacao" TEXT;
ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "tipo" TEXT;
ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "paciente_id" TEXT;
ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "paciente_nome" TEXT;
ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "ala_id" TEXT;
ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "ala_nome" TEXT;
ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "responsavel" TEXT;
ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "responsavel_crf" TEXT;
ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "usuario_nome" TEXT;
ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "usuario_id" TEXT;
ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "prescricao_id" TEXT;
ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "dias_cobertura" INTEGER;
ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "data_inicio_cobertura" TEXT;
ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "data_fim_cobertura" TEXT;
ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "dose_diaria" NUMERIC;
ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "is_baixa_lote_paciente" BOOLEAN DEFAULT false;
ALTER TABLE "Saida" ADD COLUMN IF NOT EXISTS "created_at" TEXT;

-- 5. FORNECEDOR
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

ALTER TABLE "Fornecedor" ADD COLUMN IF NOT EXISTS "razao_social" TEXT;
ALTER TABLE "Fornecedor" ADD COLUMN IF NOT EXISTS "municipio" TEXT;
ALTER TABLE "Fornecedor" ADD COLUMN IF NOT EXISTS "uf" TEXT;
ALTER TABLE "Fornecedor" ADD COLUMN IF NOT EXISTS "situacao" TEXT DEFAULT 'ATIVA';
ALTER TABLE "Fornecedor" ADD COLUMN IF NOT EXISTS "cnae" TEXT DEFAULT '4644-3/01';
ALTER TABLE "Fornecedor" ADD COLUMN IF NOT EXISTS "endereco" TEXT;
ALTER TABLE "Fornecedor" ADD COLUMN IF NOT EXISTS "contato" TEXT;

-- 6. ALA HOSPITALAR
CREATE TABLE IF NOT EXISTS "Ala" (
    "id" TEXT PRIMARY KEY,
    "nome" TEXT,
    "descricao" TEXT,
    "leitos" INTEGER DEFAULT 10,
    "created_at" TEXT,
    "deleted_at" TEXT
);

ALTER TABLE "Ala" ADD COLUMN IF NOT EXISTS "leitos" INTEGER DEFAULT 10;

-- 7. EMPRÉSTIMO
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

-- 8. CATEGORIA
CREATE TABLE IF NOT EXISTS "Categoria" (
    "id" TEXT PRIMARY KEY,
    "nome" TEXT,
    "descricao" TEXT,
    "created_at" TEXT,
    "deleted_at" TEXT
);

-- 9. INVENTÁRIO
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

-- 10. CONFIGURAÇÕES
CREATE TABLE IF NOT EXISTS "Config" (
    "id" TEXT PRIMARY KEY,
    "chave" TEXT,
    "valor" TEXT,
    "created_at" TEXT,
    "deleted_at" TEXT
);

-- 11. CARRINHO DE EMERGÊNCIA
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

-- 12. GAVETA DO PACIENTE (FRACIONAMENTO)
CREATE TABLE IF NOT EXISTS "GavetaPaciente" (
    "id" TEXT PRIMARY KEY,
    "paciente_id" TEXT,
    "medicamento_id" TEXT,
    "lote_id" TEXT,
    "quantidade" INTEGER,
    "created_at" TEXT,
    "deleted_at" TEXT
);

-- 13. PACIENTE
CREATE TABLE IF NOT EXISTS "Paciente" (
    "id" TEXT PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "prontuario" TEXT,
    "idade" INTEGER,
    "data_nascimento" TEXT,
    "alaId" TEXT,
    "ala_id" TEXT,
    "alaNome" TEXT,
    "leito" TEXT,
    "status" TEXT DEFAULT 'Ativo',
    "observacoes" TEXT,
    "dataAlta" TEXT,
    "foto" TEXT,
    "created_at" TEXT,
    "deleted_at" TEXT
);

ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "idade" INTEGER;
ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "alaId" TEXT;
ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "alaNome" TEXT;
ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "leito" TEXT;
ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'Ativo';
ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "observacoes" TEXT;
ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "dataAlta" TEXT;
ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "foto" TEXT;
ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "ciclo_coberto_ate" TEXT;
ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "ultimo_ciclo_dias" INTEGER;
ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "data_ultimo_ciclo" TEXT;
ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "data_ultimo_ajuste_ciclo" TEXT;
ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "created_at" TEXT;
ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "deleted_at" TEXT;

-- 14. PRESCRIÇÃO DO PACIENTE (COM DADOS MÉDICOS E APRAZAMENTO)
CREATE TABLE IF NOT EXISTS "PrescricaoPaciente" (
    "id" TEXT PRIMARY KEY,
    "pacienteId" TEXT,
    "paciente_id" TEXT,
    "pacienteNome" TEXT,
    "prontuario" TEXT,
    "alaNome" TEXT,
    "leito" TEXT,
    "medicamentoId" TEXT,
    "medicamento_id" TEXT,
    "medicamentoNome" TEXT,
    "medicamento_nome" TEXT,
    "medicamentoCodigo" TEXT,
    "apresentacao" TEXT,
    "concentracao" TEXT,
    "dose08" TEXT,
    "dose14" TEXT,
    "dose22" TEXT,
    "dose06" TEXT,
    "isMetade08" BOOLEAN DEFAULT false,
    "isMetade14" BOOLEAN DEFAULT false,
    "isMetade22" BOOLEAN DEFAULT false,
    "isMetade06" BOOLEAN DEFAULT false,
    "totalDiario" NUMERIC,
    "esquemaPosologico" TEXT,
    "horarios" TEXT,
    "observacoes" TEXT,
    "dataInicio" TEXT,
    "data_inicio" TEXT,
    "dataFim" TEXT,
    "data_fim" TEXT,
    "status" TEXT DEFAULT 'Ativa',
    "viaAdministracao" TEXT,
    "via_administracao" TEXT,
    "diasSemana" TEXT,
    "tipoFrequencia" TEXT DEFAULT 'diaria',
    "intervaloDias" INTEGER DEFAULT 1,
    "horarioInicio" TEXT DEFAULT '08:00',
    "is_liquido" BOOLEAN DEFAULT false,
    "unidade_dose" TEXT DEFAULT 'comp',
    "volume_frasco_ml" NUMERIC,
    "duracao_frasco_dias" INTEGER,
    "data_ultimo_frasco" TEXT,
    "data_proximo_frasco" TEXT,
    "medico_nome" TEXT,
    "medico_crm" TEXT,
    "motivo_alteracao" TEXT,
    "medico_alterou" TEXT,
    "data_alteracao" TEXT,
    "historico_alteracoes" TEXT,
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
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "medico_nome" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "medico_crm" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "motivo_alteracao" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "medico_alterou" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "data_alteracao" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "historico_alteracoes" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "data_suspensao" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "quantidade_ultimo_lote" NUMERIC;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "created_at" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "deleted_at" TEXT;

-- 15. NOTIFICAÇÕES PARA A FARMÁCIA (MÉDICO -> FARMÁCIA)
CREATE TABLE IF NOT EXISTS "NotificacaoFarmacia" (
    "id" TEXT PRIMARY KEY,
    "tipo" TEXT NOT NULL,
    "pacienteId" TEXT,
    "pacienteNome" TEXT,
    "prontuario" TEXT,
    "alaNome" TEXT,
    "leito" TEXT,
    "medicamentoNome" TEXT,
    "esquemaPosologico" TEXT,
    "motivo" TEXT,
    "medicoNome" TEXT,
    "crm" TEXT,
    "status" TEXT DEFAULT 'Pendente',
    "prioridade" TEXT DEFAULT 'Normal',
    "created_at" TEXT,
    "deleted_at" TEXT
);

-- 16. CONTROLE DE VISITAS (RECEPÇÃO & PORTARIA)
CREATE TABLE IF NOT EXISTS "Visita" (
    "id" TEXT PRIMARY KEY,
    "pacienteId" TEXT NOT NULL,
    "pacienteNome" TEXT NOT NULL,
    "prontuario" TEXT,
    "alaNome" TEXT,
    "leito" TEXT,
    "visitanteNome" TEXT NOT NULL,
    "tipoDocumento" TEXT NOT NULL DEFAULT 'RG',
    "documentoNumero" TEXT NOT NULL,
    "parentesco" TEXT,
    "dataHoraEntrada" TEXT NOT NULL,
    "dataHoraSaida" TEXT,
    "status" TEXT DEFAULT 'Em Andamento',
    "observacoes" TEXT,
    "recepcionista" TEXT,
    "foto" TEXT,
    "foto_recusada" BOOLEAN DEFAULT false,
    "foto_recusada_motivo" TEXT,
    "created_at" TEXT,
    "deleted_at" TEXT
);

ALTER TABLE "Visita" ADD COLUMN IF NOT EXISTS "tipoDocumento" TEXT DEFAULT 'RG';
ALTER TABLE "Visita" ADD COLUMN IF NOT EXISTS "documentoNumero" TEXT;
ALTER TABLE "Visita" ADD COLUMN IF NOT EXISTS "parentesco" TEXT;
ALTER TABLE "Visita" ADD COLUMN IF NOT EXISTS "dataHoraEntrada" TEXT;
ALTER TABLE "Visita" ADD COLUMN IF NOT EXISTS "dataHoraSaida" TEXT;
ALTER TABLE "Visita" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'Em Andamento';
ALTER TABLE "Visita" ADD COLUMN IF NOT EXISTS "observacoes" TEXT;
ALTER TABLE "Visita" ADD COLUMN IF NOT EXISTS "recepcionista" TEXT;
ALTER TABLE "Visita" ADD COLUMN IF NOT EXISTS "foto" TEXT;
ALTER TABLE "Visita" ADD COLUMN IF NOT EXISTS "foto_recusada" BOOLEAN DEFAULT false;
ALTER TABLE "Visita" ADD COLUMN IF NOT EXISTS "foto_recusada_motivo" TEXT;
ALTER TABLE "Visita" ADD COLUMN IF NOT EXISTS "created_at" TEXT;
ALTER TABLE "Visita" ADD COLUMN IF NOT EXISTS "deleted_at" TEXT;

-- 17. AUDITORIA E TRILHA DE SEGURANÇA
CREATE TABLE IF NOT EXISTS "Auditoria" (
    "id" TEXT PRIMARY KEY,
    "acao" TEXT NOT NULL,
    "entidade" TEXT,
    "entidade_id" TEXT,
    "detalhes" TEXT,
    "usuario" TEXT,
    "data_hora" TEXT,
    "created_at" TEXT,
    "deleted_at" TEXT
);

-- 18. PEDIDOS DA FARMÁCIA SATÉLITE
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
ALTER TABLE "PedidoSatelite" ADD COLUMN IF NOT EXISTS "prioridade" TEXT DEFAULT 'Normal';
ALTER TABLE "PedidoSatelite" ADD COLUMN IF NOT EXISTS "margem_seguranca" INTEGER DEFAULT 0;
ALTER TABLE "PedidoSatelite" ADD COLUMN IF NOT EXISTS "descontar_estoque" INTEGER DEFAULT 0;
ALTER TABLE "PedidoSatelite" ADD COLUMN IF NOT EXISTS "motivo_cancelamento" TEXT;
ALTER TABLE "PedidoSatelite" ADD COLUMN IF NOT EXISTS "data_cancelamento" TEXT;

-- 19. TRANSFERÊNCIA PENDENTE ENTRE ESTOQUES
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

-- 20. USUÁRIOS E CORPO CLÍNICO (COM CRM, COREN, CRF)
CREATE TABLE IF NOT EXISTS "Usuario" (
    "id" TEXT PRIMARY KEY,
    "nome" TEXT,
    "login" TEXT UNIQUE,
    "senha" TEXT,
    "coren" TEXT,
    "crf" TEXT,
    "crm" TEXT,
    "especialidade" TEXT,
    "perfil" TEXT,
    "primeiro_acesso" BOOLEAN DEFAULT true,
    "created_at" TEXT,
    "deleted_at" TEXT
);

ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "coren" TEXT;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "crf" TEXT;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "crm" TEXT;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "cargo" TEXT;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "modulos" TEXT;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "especialidade" TEXT;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "primeiro_acesso" BOOLEAN DEFAULT true;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "status_online" TEXT DEFAULT 'offline';
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "ultimo_acesso" TEXT;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "modulo_ativo" TEXT;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "telefone" TEXT;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "certificado_digital_nome" TEXT;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "certificado_digital_dados" TEXT;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "certificado_digital_expiracao" TEXT;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "certificado_digital_emissor" TEXT;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "certificado_digital_cpf" TEXT;

-- Suporte ao Modo Híbrido de Assinatura Digital de Prescrições
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "tipo_assinatura" TEXT DEFAULT 'login_crm';
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "assinatura_digital_hash" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "assinatura_digital_data" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "assinatura_digital_medico" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "assinatura_digital_crm" TEXT;
ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "assinatura_digital_emissor" TEXT;

-- Usuário Administrador padrão de fábrica (senha: admin123)
INSERT INTO "Usuario" ("id", "nome", "login", "senha", "perfil", "primeiro_acesso") 
VALUES ('user-admin-uuid', 'Administrador', 'admin', 'admin123', 'admin', false)
ON CONFLICT DO NOTHING;

-- 21. CHAT ZORION (COMUNICAÇÃO MULTI-MÓDULOS)
CREATE TABLE IF NOT EXISTS "ChatMessage" (
    "id" TEXT PRIMARY KEY,
    "canal" TEXT DEFAULT 'farmacia_recepcao',
    "remetente_id" TEXT,
    "remetente_modulo" TEXT NOT NULL,
    "remetente_usuario" TEXT NOT NULL,
    "remetente_cargo" TEXT,
    "destinatario_id" TEXT,
    "destinatario_nome" TEXT,
    "mensagem" TEXT NOT NULL,
    "lida" BOOLEAN DEFAULT false,
    "created_at" TEXT NOT NULL,
    "deleted_at" TEXT
);

ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "remetente_id" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "destinatario_id" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "destinatario_nome" TEXT;

CREATE INDEX IF NOT EXISTS "idx_chat_canal_created" ON "ChatMessage" ("canal", "created_at");

-- 22. PRONTUÁRIO CLÍNICO MULTI-DISCIPLINAR (EVOLUÇÕES, EXAMES, ALERGIAS, DOCUMENTOS)
CREATE TABLE IF NOT EXISTS "ProntuarioEvolucao" (
    "id" TEXT PRIMARY KEY,
    "paciente_id" TEXT NOT NULL,
    "tipo" TEXT DEFAULT 'Evolução Médica',
    "titulo" TEXT,
    "descricao" TEXT NOT NULL,
    "conduta" TEXT,
    "pressao_arterial" TEXT,
    "frequencia_cardiaca" TEXT,
    "temperatura" TEXT,
    "saturacao_o2" TEXT,
    "glicemia" TEXT,
    "profissional_nome" TEXT,
    "profissional_cargo" TEXT,
    "profissional_crm" TEXT,
    "data_hora" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "deleted_at" TEXT
);

CREATE TABLE IF NOT EXISTS "ProntuarioExame" (
    "id" TEXT PRIMARY KEY,
    "paciente_id" TEXT NOT NULL,
    "tipo" TEXT DEFAULT 'Laboratorial',
    "nome_exame" TEXT NOT NULL,
    "data_solicitacao" TEXT NOT NULL,
    "data_resultado" TEXT,
    "status" TEXT DEFAULT 'Concluído',
    "resultado" TEXT,
    "valores_referencia" TEXT,
    "solicitante_nome" TEXT,
    "laudo_medico" TEXT,
    "created_at" TEXT NOT NULL,
    "deleted_at" TEXT
);

CREATE TABLE IF NOT EXISTS "ProntuarioAlergia" (
    "id" TEXT PRIMARY KEY,
    "paciente_id" TEXT NOT NULL,
    "agente" TEXT NOT NULL,
    "tipo" TEXT DEFAULT 'Medicamentosa',
    "gravidade" TEXT DEFAULT 'Grave',
    "reacao" TEXT,
    "registrado_por" TEXT,
    "data_registro" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "deleted_at" TEXT
);

CREATE TABLE IF NOT EXISTS "ProntuarioDocumento" (
    "id" TEXT PRIMARY KEY,
    "paciente_id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "categoria" TEXT DEFAULT 'Relatório Médico',
    "conteudo" TEXT NOT NULL,
    "responsavel_nome" TEXT,
    "responsavel_cargo" TEXT,
    "data_emissao" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "deleted_at" TEXT
);

ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "diagnostico" TEXT;
ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "alergias" TEXT;

CREATE INDEX IF NOT EXISTS "idx_prontuario_evolucao_paciente" ON "ProntuarioEvolucao" ("paciente_id", "data_hora");
CREATE INDEX IF NOT EXISTS "idx_prontuario_exame_paciente" ON "ProntuarioExame" ("paciente_id", "data_solicitacao");
CREATE INDEX IF NOT EXISTS "idx_prontuario_alergia_paciente" ON "ProntuarioAlergia" ("paciente_id");
CREATE INDEX IF NOT EXISTS "idx_prontuario_documento_paciente" ON "ProntuarioDocumento" ("paciente_id", "data_emissao");

-- ==============================================================================
-- CAPACIDADES OFICIAIS DE LEITOS POR ALA
-- ==============================================================================
-- N1: 39 leitos
UPDATE "Ala" SET "leitos" = 39 WHERE LOWER(TRIM("nome")) IN ('n1', 'ala n1', 'ala-n1');
INSERT INTO "Ala" ("id", "nome", "descricao", "leitos", "created_at")
SELECT 'ala-n1-uuid', 'N1', 'Ala N1 (39 leitos)', 39, NOW()::text
WHERE NOT EXISTS (SELECT 1 FROM "Ala" WHERE LOWER(TRIM("nome")) IN ('n1', 'ala n1', 'ala-n1') AND deleted_at IS NULL);

-- N2: 39 leitos
UPDATE "Ala" SET "leitos" = 39 WHERE LOWER(TRIM("nome")) IN ('n2', 'ala n2', 'ala-n2');
INSERT INTO "Ala" ("id", "nome", "descricao", "leitos", "created_at")
SELECT 'ala-n2-uuid', 'N2', 'Ala N2 (39 leitos)', 39, NOW()::text
WHERE NOT EXISTS (SELECT 1 FROM "Ala" WHERE LOWER(TRIM("nome")) IN ('n2', 'ala n2', 'ala-n2') AND deleted_at IS NULL);

-- R1 M: 10 leitos
UPDATE "Ala" SET "leitos" = 10 WHERE LOWER(TRIM("nome")) IN ('r1 m', 'r1-m', 'r1m', 'r1 masculino', 'ala r1 m', 'ala r1 masculino');
INSERT INTO "Ala" ("id", "nome", "descricao", "leitos", "created_at")
SELECT 'ala-r1m-uuid', 'R1 M', 'Ala R1 Masculino (10 leitos)', 10, NOW()::text
WHERE NOT EXISTS (SELECT 1 FROM "Ala" WHERE LOWER(TRIM("nome")) IN ('r1 m', 'r1-m', 'r1m', 'r1 masculino', 'ala r1 m', 'ala r1 masculino') AND deleted_at IS NULL);

-- R1 F: 15 leitos
UPDATE "Ala" SET "leitos" = 15 WHERE LOWER(TRIM("nome")) IN ('r1 f', 'r1-f', 'r1f', 'r1 feminino', 'ala r1 f', 'ala r1 feminino');
INSERT INTO "Ala" ("id", "nome", "descricao", "leitos", "created_at")
SELECT 'ala-r1f-uuid', 'R1 F', 'Ala R1 Feminino (15 leitos)', 15, NOW()::text
WHERE NOT EXISTS (SELECT 1 FROM "Ala" WHERE LOWER(TRIM("nome")) IN ('r1 f', 'r1-f', 'r1f', 'r1 feminino', 'ala r1 f', 'ala r1 feminino') AND deleted_at IS NULL);

-- UCP: 10 leitos
UPDATE "Ala" SET "leitos" = 10 WHERE LOWER(TRIM("nome")) IN ('ucp', 'ala ucp');
INSERT INTO "Ala" ("id", "nome", "descricao", "leitos", "created_at")
SELECT 'ala-ucp-uuid', 'UCP', 'Unidade de Cuidados Prolongados (10 leitos)', 10, NOW()::text
WHERE NOT EXISTS (SELECT 1 FROM "Ala" WHERE LOWER(TRIM("nome")) IN ('ucp', 'ala ucp') AND deleted_at IS NULL);

-- CL1: 10 leitos
UPDATE "Ala" SET "leitos" = 10 WHERE LOWER(TRIM("nome")) IN ('cl1', 'cl 1', 'ala cl1', 'ala cl 1', 'clinica 1');
INSERT INTO "Ala" ("id", "nome", "descricao", "leitos", "created_at")
SELECT 'ala-cl1-uuid', 'CL1', 'Ala Clínica 1 (10 leitos)', 10, NOW()::text
WHERE NOT EXISTS (SELECT 1 FROM "Ala" WHERE LOWER(TRIM("nome")) IN ('cl1', 'cl 1', 'ala cl1', 'ala cl 1', 'clinica 1') AND deleted_at IS NULL);

-- CL2: 10 leitos
UPDATE "Ala" SET "leitos" = 10 WHERE LOWER(TRIM("nome")) IN ('cl2', 'cl 2', 'ala cl2', 'ala cl 2', 'clinica 2');
INSERT INTO "Ala" ("id", "nome", "descricao", "leitos", "created_at")
SELECT 'ala-cl2-uuid', 'CL2', 'Ala Clínica 2 (10 leitos)', 10, NOW()::text
WHERE NOT EXISTS (SELECT 1 FROM "Ala" WHERE LOWER(TRIM("nome")) IN ('cl2', 'cl 2', 'ala cl2', 'ala cl 2', 'clinica 2') AND deleted_at IS NULL);

-- CASA MENINOS: 3 leitos
UPDATE "Ala" SET "leitos" = 3 WHERE LOWER(TRIM("nome")) IN ('casa meninos', 'casa dos meninos', 'ala casa meninos', 'ala casa dos meninos');
INSERT INTO "Ala" ("id", "nome", "descricao", "leitos", "created_at")
SELECT 'ala-casameninos-uuid', 'Casa Meninos', 'Casa dos Meninos (3 leitos)', 3, NOW()::text
WHERE NOT EXISTS (SELECT 1 FROM "Ala" WHERE LOWER(TRIM("nome")) IN ('casa meninos', 'casa dos meninos', 'ala casa meninos', 'ala casa dos meninos') AND deleted_at IS NULL);

-- ==============================================================================
-- 23. MÓDULO ZORION ENFERMAGEM (CHECAGEM BEIRA-LEITO, SINAIS VITAIS, SAE, BALANÇO)
-- ==============================================================================

-- 1. Checagem Beira-Leito de Medicamentos
CREATE TABLE IF NOT EXISTS "EnfermagemChecagem" (
    "id" TEXT PRIMARY KEY,
    "prescricao_id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "paciente_nome" TEXT,
    "ala_nome" TEXT,
    "leito" TEXT,
    "medicamento_nome" TEXT NOT NULL,
    "dose" TEXT,
    "via" TEXT,
    "horario_previsto" TEXT NOT NULL,
    "horario_administrado" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendente', -- 'administrado', 'nao_administrado', 'pendente', 'adiado'
    "motivo_nao_administracao" TEXT,
    "profissional_nome" TEXT NOT NULL,
    "profissional_coren" TEXT,
    "profissional_cargo" TEXT, -- 'Tecnico de Enfermagem', 'Enfermeiro'
    "lote_utilizado" TEXT,
    "observacoes" TEXT,
    "data_referencia" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "deleted_at" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_enf_checagem_paciente_data" ON "EnfermagemChecagem" ("paciente_id", "data_referencia");
CREATE INDEX IF NOT EXISTS "idx_enf_checagem_status" ON "EnfermagemChecagem" ("status");

-- 2. Registro de Sinais Vitais Beira-Leito
CREATE TABLE IF NOT EXISTS "EnfermagemSinalVital" (
    "id" TEXT PRIMARY KEY,
    "paciente_id" TEXT NOT NULL,
    "pressao_arterial" TEXT,
    "frequencia_cardiaca" TEXT,
    "frequencia_respiratoria" TEXT,
    "temperatura" TEXT,
    "saturacao_o2" TEXT,
    "glicemia_capilar" TEXT,
    "dor_eva" INTEGER, -- 0 a 10
    "observacao" TEXT,
    "profissional_nome" TEXT NOT NULL,
    "profissional_coren" TEXT,
    "data_hora" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "deleted_at" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_enf_sinais_paciente" ON "EnfermagemSinalVital" ("paciente_id", "data_hora");

-- 3. Balanço Hídrico
CREATE TABLE IF NOT EXISTS "EnfermagemBalancoHidrico" (
    "id" TEXT PRIMARY KEY,
    "paciente_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL, -- 'entrada' ou 'saida'
    "categoria" TEXT NOT NULL, -- 'Soro Venoso', 'Dieta Oral', 'Dieta Enteral', 'Medicamentos', 'Diurese', 'Dreno', 'Vomito', 'Evacuacao'
    "volume_ml" NUMERIC NOT NULL,
    "observacao" TEXT,
    "profissional_nome" TEXT NOT NULL,
    "data_hora" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "deleted_at" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_enf_balanco_paciente" ON "EnfermagemBalancoHidrico" ("paciente_id", "data_hora");

-- 4. Prescrição de Cuidados de Enfermagem (SAE)
CREATE TABLE IF NOT EXISTS "EnfermagemPrescricaoCuidado" (
    "id" TEXT PRIMARY KEY,
    "paciente_id" TEXT NOT NULL,
    "enfermeiro_nome" TEXT NOT NULL,
    "enfermeiro_coren" TEXT,
    "descricao_cuidado" TEXT NOT NULL,
    "frequencia" TEXT NOT NULL, -- '2/2h', '4/4h', '6/6h', '1x ao dia', 'Se necessário'
    "horarios" TEXT,
    "status" TEXT DEFAULT 'Ativo',
    "data_inicio" TEXT NOT NULL,
    "data_fim" TEXT,
    "created_at" TEXT NOT NULL,
    "deleted_at" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_enf_cuidado_paciente" ON "EnfermagemPrescricaoCuidado" ("paciente_id", "status");

-- 5. Checagem de Cuidados de Enfermagem
CREATE TABLE IF NOT EXISTS "EnfermagemChecagemCuidado" (
    "id" TEXT PRIMARY KEY,
    "cuidado_id" TEXT NOT NULL,
    "paciente_id" TEXT NOT NULL,
    "horario_previsto" TEXT NOT NULL,
    "horario_realizado" TEXT,
    "status" TEXT DEFAULT 'pendente',
    "motivo" TEXT,
    "profissional_nome" TEXT NOT NULL,
    "data_hora" TEXT NOT NULL,
    "created_at" TEXT NOT NULL
);

-- 6. Anotações de Enfermagem
CREATE TABLE IF NOT EXISTS "EnfermagemAnotacao" (
    "id" TEXT PRIMARY KEY,
    "paciente_id" TEXT NOT NULL,
    "tipo" TEXT DEFAULT 'Anotação de Enfermagem',
    "texto" TEXT NOT NULL,
    "profissional_nome" TEXT NOT NULL,
    "profissional_coren" TEXT,
    "profissional_cargo" TEXT,
    "data_hora" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "deleted_at" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_enf_anotacao_paciente" ON "EnfermagemAnotacao" ("paciente_id", "data_hora");

-- 7. Passagem de Plantão da Enfermagem
CREATE TABLE IF NOT EXISTS "EnfermagemPassagemPlantao" (
    "id" TEXT PRIMARY KEY,
    "ala_id" TEXT NOT NULL,
    "ala_nome" TEXT NOT NULL,
    "turno" TEXT NOT NULL,
    "responsavel_nome" TEXT NOT NULL,
    "responsavel_coren" TEXT,
    "resumo_geral" TEXT,
    "intercorrencias" TEXT,
    "altas_transferencias" TEXT,
    "obitos" TEXT,
    "data_plantao" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "deleted_at" TEXT
);

CREATE INDEX IF NOT EXISTS "idx_enf_plantao_ala" ON "EnfermagemPassagemPlantao" ("ala_id", "data_plantao");
