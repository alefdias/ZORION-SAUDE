import { invoke } from "@tauri-apps/api/core";

// Helper to get Postgres credentials
function getPgConfig() {
  const ip = localStorage.getItem("pg_ip");
  const dbName = localStorage.getItem("pg_db");
  const password = localStorage.getItem("pg_pass");
  if (!ip || !password) {
    throw new Error("Postgres não configurado. Vá em Configurações de Servidor.");
  }
  return { ip, dbName, password };
}

async function logAuditoria(entityName, acao, entidadeId, detalhes, ip, dbName, password) {
  try {
    const user = JSON.parse(localStorage.getItem("pharma_user") || "null");
    const userName = user ? (user.nome || user.login || "Sistema") : "Sistema";
    const auditId = crypto.randomUUID();
    const now = new Date().toISOString();
    let safeDetalhes = "";
    if (typeof detalhes === "object") {
      try { safeDetalhes = JSON.stringify(detalhes); } catch (e) { safeDetalhes = "Objeto modificado"; }
    } else {
      safeDetalhes = detalhes || "";
    }
    const safeDetalhesEscaped = safeDetalhes.replace(/'/g, "''");
    
    const q = `INSERT INTO "Auditoria" ("id", "acao", "entidade", "entidade_id", "detalhes", "usuario", "data_hora", "created_at") 
               VALUES ('${auditId}', '${acao}', '${entityName}', '${entidadeId}', '${safeDetalhesEscaped}', '${userName}', '${now}', '${now}')`;
    await invoke("execute_postgres", { ip, dbName, password, query: q });
  } catch (e) {
    console.warn("[db.js] Falha ao registrar auditoria silenciosamente:", e);
  }
}

const ensureTableQuery = {
  Medicamento: `
    ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "estoque_satelite" INTEGER DEFAULT 0;
    ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "origem" TEXT;
    ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "grupo_terapeutico" TEXT;
    ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "forma_farmaceutica" TEXT;
    ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "via_administracao" TEXT;
    ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "portaria_344" BOOLEAN DEFAULT false;
    ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "antimicrobiano" BOOLEAN DEFAULT false;
    ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "alto_risco_mav" BOOLEAN DEFAULT false;
    ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "ccih" BOOLEAN DEFAULT false;
    ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "apresentacao" TEXT;
    ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "concentracao" TEXT;
    ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "padronizado" BOOLEAN DEFAULT false;
    ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "is_mav" BOOLEAN DEFAULT false;
    ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "nome_comercial" TEXT;
    ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "principio_ativo" TEXT;
    ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "categoria" TEXT;
    ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "unidade_medida" TEXT;
    ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "localizacao" TEXT;
    ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "observacoes" TEXT;
    ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "is_adiantamento" BOOLEAN DEFAULT false;
    ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "nota_fiscal" TEXT;
    ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "valor_compra" REAL;
    ALTER TABLE "Medicamento" ADD COLUMN IF NOT EXISTS "fornecedor_nome" TEXT;
    UPDATE "Medicamento" SET "grupo_terapeutico" = 'IMUNOSSUPRESSOR (PORTARIA 344)' WHERE UPPER("nome") ~* '(TALIDOMIDA|LENALIDOMIDA|CICLOSPORINA|TACROLIMO|SIROLIMO|EVEROLIMO|AZATIOPRINA|MICOFENOLATO|LEFLUNOMIDA|METOTREXATO)';
    UPDATE "Medicamento" SET "grupo_terapeutico" = 'PSICOTRÓPICO / CONTROLADO (PORTARIA 344)' WHERE UPPER("nome") ~* '(MORFINA|TRAMADOL|METADONA|FENTANILA|ALPRAZOLAM|BROMAZEPAM|CLONAZEPAM|DIAZEPAM|LORAZEPAM|MIDAZOLAM|ZOLPIDEM|FENOBARBITAL|METILFENIDATO|RISPERIDONA|HALOPERIDOL|QUETIAPINA|OLANZAPINA|AMITRIPTILINA|FLUOXETINA|SERTRALINA|ESCITALOPRAM|PAROXETINA|VENLAFAXINA|DULOXETINA|CARBAMAZEPINA|VALPROATO|LAMOTRIGINA|TOPIRAMATO|GABAPENTINA|PREGABALINA)';
    UPDATE "Medicamento" SET "grupo_terapeutico" = 'ANTIBIÓTICO / ANTIMICROBIANO' WHERE UPPER("nome") ~* '(AMOXICILINA|AMPICILINA|AZITROMICINA|CLARITROMICINA|CEFALEXINA|CEFTRIAXONA|CEFAZOLINA|CIPROFLOXACINO|LEVOFLOXACINO|METRONIDAZOL|VANCOMICINA|MEROPENEM|PIPERACILINA|GENTAMICINA|AMIKACINA|CLINDAMICINA|SULFAMETOXAZOL)' AND ("grupo_terapeutico" IS NULL OR "grupo_terapeutico" = '');
    UPDATE "Medicamento" SET "grupo_terapeutico" = 'CLÍNICOS - MUCOLÍTICO E EXPECTORANTE' WHERE UPPER("nome") ~* '(ACETILCISTEINA|ACETILCISTEÍNA|AMBROXOL|ACEBROFILINA|CARBOCISTEINA|BROMEXINA)';
    UPDATE "Medicamento" SET "apresentacao" = 'AMPOLA 10 ML' WHERE UPPER("apresentacao") IN ('AMPOLA 10ML', 'AMPOLA 10 ML');
    UPDATE "Medicamento" SET "apresentacao" = 'AMPOLA 1 ML' WHERE UPPER("apresentacao") IN ('AMPOLA 1ML', 'AMPOLA 1 ML');
    UPDATE "Medicamento" SET "apresentacao" = 'AMPOLA 2 ML' WHERE UPPER("apresentacao") IN ('AMPOLA 2ML', 'AMPOLA 2 ML');
    UPDATE "Medicamento" SET "apresentacao" = 'AMPOLA 5 ML' WHERE UPPER("apresentacao") IN ('AMPOLA 5ML', 'AMPOLA 5 ML');
    UPDATE "Medicamento" SET "apresentacao" = 'AMPOLA 20 ML' WHERE UPPER("apresentacao") IN ('AMPOLA 20ML', 'AMPOLA 20 ML');
    UPDATE "Medicamento" SET "apresentacao" = 'AMPOLA 0,25 ML' WHERE UPPER("apresentacao") IN ('AMPOLA 0.25 ML', 'AMPOLA 0,25ML', 'AMPOLA 0.25ML', 'AMPOLA 0,25 ML');
    UPDATE "Medicamento" SET "apresentacao" = 'AMPOLA 2,5 ML' WHERE UPPER("apresentacao") IN ('AMPOLA 2.5 ML', 'AMPOLA 2,5ML', 'AMPOLA 2.5ML', 'AMPOLA 2,5 ML');
    UPDATE "Medicamento" SET "apresentacao" = 'FRASCO 100 ML' WHERE UPPER("apresentacao") IN ('FRASCO 100ML', 'FRASCO 100 ML');
    UPDATE "Medicamento" SET "apresentacao" = 'FRASCO 5 ML' WHERE UPPER("apresentacao") IN ('FRASCO 5ML', 'FRASCO 5 ML');
    UPDATE "Medicamento" SET "apresentacao" = 'FRASCO 10 ML' WHERE UPPER("apresentacao") IN ('FRASCO 10ML', 'FRASCO 10 ML');
    UPDATE "Medicamento" SET "apresentacao" = 'COMPRIMIDO' WHERE "apresentacao" IS NULL OR TRIM("apresentacao") = '';
  `,
  Entrada: `
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
    ALTER TABLE "Entrada" ADD COLUMN IF NOT EXISTS "medicamento_nome" TEXT;
    ALTER TABLE "Entrada" ADD COLUMN IF NOT EXISTS "data_entrada" TEXT;
    ALTER TABLE "Entrada" ALTER COLUMN "lote_id" DROP NOT NULL;
    ALTER TABLE "Entrada" ALTER COLUMN "fornecedor_id" DROP NOT NULL;
    ALTER TABLE "Entrada" ALTER COLUMN "nota_fiscal" DROP NOT NULL;
  `,
  PedidoSatelite: `
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
  `,
  TransferenciaPendente: `
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
        "created_at" TEXT,
        "deleted_at" TEXT
    );
    ALTER TABLE "TransferenciaPendente" ADD COLUMN IF NOT EXISTS "created_at" TEXT;
  `,
  Usuario: `
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
    ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "coren" TEXT;
    ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "crf" TEXT;
    ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "primeiro_acesso" BOOLEAN DEFAULT true;
    INSERT INTO "Usuario" ("id", "nome", "login", "senha", "perfil", "primeiro_acesso") 
    VALUES ('user-admin-uuid', 'Administrador', 'admin', 'admin123', 'admin', false)
    ON CONFLICT DO NOTHING;
  `,
  Paciente: `
    CREATE TABLE IF NOT EXISTS "Paciente" (
        "id" TEXT PRIMARY KEY,
        "nome" TEXT NOT NULL,
        "prontuario" TEXT,
        "idade" INTEGER,
        "alaId" TEXT,
        "alaNome" TEXT,
        "leito" TEXT,
        "status" TEXT DEFAULT 'Ativo',
        "observacoes" TEXT,
        "created_at" TEXT,
        "deleted_at" TEXT
    );
    ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "idade" INTEGER;
    ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "alaId" TEXT;
    ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "alaNome" TEXT;
    ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "leito" TEXT;
    ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT 'Ativo';
    ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "observacoes" TEXT;
    ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "created_at" TEXT;
    ALTER TABLE "Paciente" ADD COLUMN IF NOT EXISTS "deleted_at" TEXT;
  `,
  PrescricaoPaciente: `
    CREATE TABLE IF NOT EXISTS "PrescricaoPaciente" (
        "id" TEXT PRIMARY KEY,
        "pacienteId" TEXT,
        "pacienteNome" TEXT,
        "prontuario" TEXT,
        "alaNome" TEXT,
        "leito" TEXT,
        "medicamentoId" TEXT,
        "medicamentoNome" TEXT,
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
        "dataFim" TEXT,
        "status" TEXT DEFAULT 'Ativa',
        "viaAdministracao" TEXT,
        "horarioInicio" TEXT DEFAULT '08:00',
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
    ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "diasSemana" TEXT;
    ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "tipoFrequencia" TEXT DEFAULT 'diaria';
    ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "intervaloDias" INTEGER DEFAULT 1;
    ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "horarioInicio" TEXT DEFAULT '08:00';
    ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "created_at" TEXT;
    ALTER TABLE "PrescricaoPaciente" ADD COLUMN IF NOT EXISTS "deleted_at" TEXT;
  `,
  GavetaPaciente: `
    CREATE TABLE IF NOT EXISTS "GavetaPaciente" (
        "id" TEXT PRIMARY KEY,
        "paciente_id" TEXT,
        "medicamento_id" TEXT,
        "lote_id" TEXT,
        "quantidade" INTEGER,
        "created_at" TEXT,
        "deleted_at" TEXT
    );
  `,
  Auditoria: `
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
  `,
  Fornecedor: `
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
  `,
  PlantaoOcorrencia: `
    CREATE TABLE IF NOT EXISTS "PlantaoOcorrencia" (
        "id" TEXT PRIMARY KEY,
        "data_plantao" TEXT,
        "turno" TEXT,
        "tipo" TEXT,
        "titulo" TEXT,
        "descricao" TEXT,
        "farmaceutico_nome" TEXT,
        "farmaceutico_crf" TEXT,
        "created_at" TEXT,
        "deleted_at" TEXT
    );
  `,
  Visita: `
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
    ALTER TABLE "Visita" ADD COLUMN IF NOT EXISTS "created_at" TEXT;
    ALTER TABLE "Visita" ADD COLUMN IF NOT EXISTS "deleted_at" TEXT;
  `
};

async function autoEnsureTable(entityName) {
  const query = ensureTableQuery[entityName];
  if (!query) return;
  const { ip, dbName, password } = getPgConfig();
  if (ip && dbName) {
    try {
      const statements = query.split(';').map(s => s.trim()).filter(s => s.length > 0);
      for (const stmt of statements) {
        try {
          await invoke("execute_postgres", { ip, dbName, password, query: stmt });
        } catch (e) {
          console.warn(`[db.js] stmt falhou para ${entityName}: ${stmt}`, e);
        }
      }
    } catch(e) {
      console.warn(`[db.js] autoEnsureTable falhou para ${entityName}:`, e);
    }
  }
}

let hasSanitizedMedicamentos = false;
async function sanitizeMedicamentosDb(ip, dbName, password) {
  if (hasSanitizedMedicamentos) return;
  hasSanitizedMedicamentos = true;
  try {
    const stmts = [
      `UPDATE "Medicamento" SET "apresentacao" = 'AMPOLA 1 ML' WHERE UPPER(TRIM("apresentacao")) IN ('AMPOLA 1ML', 'AMPOLA 1 ML', 'AMPOLA1ML')`,
      `UPDATE "Medicamento" SET "apresentacao" = 'AMPOLA 2 ML' WHERE UPPER(TRIM("apresentacao")) IN ('AMPOLA 2ML', 'AMPOLA 2 ML', 'AMPOLA2ML')`,
      `UPDATE "Medicamento" SET "apresentacao" = 'AMPOLA 5 ML' WHERE UPPER(TRIM("apresentacao")) IN ('AMPOLA 5ML', 'AMPOLA 5 ML', 'AMPOLA5ML')`,
      `UPDATE "Medicamento" SET "apresentacao" = 'AMPOLA 10 ML' WHERE UPPER(TRIM("apresentacao")) IN ('AMPOLA 10ML', 'AMPOLA 10 ML', 'AMPOLA10ML')`,
      `UPDATE "Medicamento" SET "apresentacao" = 'AMPOLA 20 ML' WHERE UPPER(TRIM("apresentacao")) IN ('AMPOLA 20ML', 'AMPOLA 20 ML', 'AMPOLA20ML')`,
      `UPDATE "Medicamento" SET "apresentacao" = 'AMPOLA 0,25 ML' WHERE UPPER(TRIM("apresentacao")) IN ('AMPOLA 0.25 ML', 'AMPOLA 0,25ML', 'AMPOLA 0.25ML', 'AMPOLA 0,25 ML')`,
      `UPDATE "Medicamento" SET "apresentacao" = 'AMPOLA 2,5 ML' WHERE UPPER(TRIM("apresentacao")) IN ('AMPOLA 2.5 ML', 'AMPOLA 2,5ML', 'AMPOLA 2.5ML', 'AMPOLA 2,5 ML')`,
      `UPDATE "Medicamento" SET "apresentacao" = 'FRASCO 100 ML' WHERE UPPER(TRIM("apresentacao")) IN ('FRASCO 100ML', 'FRASCO 100 ML', 'FRASCO100ML')`,
      `UPDATE "Medicamento" SET "apresentacao" = 'FRASCO 50 ML' WHERE UPPER(TRIM("apresentacao")) IN ('FRASCO 50ML', 'FRASCO 50 ML')`,
      `UPDATE "Medicamento" SET "apresentacao" = 'FRASCO 10 ML' WHERE UPPER(TRIM("apresentacao")) IN ('FRASCO 10ML', 'FRASCO 10 ML')`,
      `UPDATE "Medicamento" SET "apresentacao" = 'FRASCO 5 ML' WHERE UPPER(TRIM("apresentacao")) IN ('FRASCO 5ML', 'FRASCO 5 ML')`,
      `UPDATE "Medicamento" SET "apresentacao" = 'COMPRIMIDO' WHERE "apresentacao" IS NULL OR TRIM("apresentacao") = ''`
    ];
    for (const q of stmts) {
      await invoke("execute_postgres", { ip, dbName, password, query: q }).catch(() => {});
    }
  } catch (err) {
    console.warn("Erro ao higienizar apresentações no Postgres:", err);
  }
}

// ─── Proxy de entidade - 100% Postgres ───────────────────────────────────

const createEntityProxy = (entityName) => ({
  list: async (orderBy) => {
    const { ip, dbName, password } = getPgConfig();
    if (entityName === "Medicamento" && !hasSanitizedMedicamentos) {
      await sanitizeMedicamentosDb(ip, dbName, password);
    }
    let query = `SELECT * FROM "${entityName}"`;
    
    const deletedColTables = ["Medicamento", "Lote", "Entrada", "Saida", "Emprestimo", "Fornecedor", "Ala", "Categoria", "InventarioItem", "Usuario", "PlantaoOcorrencia", "Visita"];
    if (deletedColTables.includes(entityName)) {
        query += ` WHERE deleted_at IS NULL`;
    }

    if (orderBy) {
      let orderClean = orderBy.replace(/[^a-zA-Z0-9_-]/g, "");
      if (orderClean === "-created_date" || orderClean === "created_date") {
          orderClean = orderClean.replace("created_date", "created_at");
      }
      
      const isDesc = orderClean.startsWith('-');
      const colName = isDesc ? orderClean.substring(1) : orderClean;
      query += ` ORDER BY "${colName}" ${isDesc ? 'DESC' : 'ASC'}`;
    }
    
    try {
      const data = await invoke("query_postgres", { ip, dbName, password, query });
      if (entityName === "Medicamento" && Array.isArray(data)) {
        return data.map(m => ({
          ...m,
          apresentacao: (m.apresentacao && m.apresentacao.trim()) ? m.apresentacao.trim() : "COMPRIMIDO"
        }));
      }
      return data;
    } catch (e) {
      await autoEnsureTable(entityName);
      try {
        const retryData = await invoke("query_postgres", { ip, dbName, password, query });
        if (entityName === "Medicamento" && Array.isArray(retryData)) {
          return retryData.map(m => ({
            ...m,
            apresentacao: (m.apresentacao && m.apresentacao.trim()) ? m.apresentacao.trim() : "COMPRIMIDO"
          }));
        }
        return retryData;
      } catch (retryErr) {
        console.error(`Erro ao listar ${entityName} do Postgres:`, retryErr, "Query:", query);
        throw retryErr;
      }
    }
  },

  get: async (id) => {
    const { ip, dbName, password } = getPgConfig();
    const query = `SELECT * FROM "${entityName}" WHERE "id" = '${id}'`;
    try {
      const data = await invoke("query_postgres", { ip, dbName, password, query });
      if (data.length === 0) return null;
      const item = data[0];
      if (entityName === "Medicamento" && item) {
        return {
          ...item,
          apresentacao: (item.apresentacao && item.apresentacao.trim()) ? item.apresentacao.trim() : "COMPRIMIDO"
        };
      }
      return item;
    } catch (e) {
      await autoEnsureTable(entityName);
      const data = await invoke("query_postgres", { ip, dbName, password, query });
      if (data.length === 0) return null;
      const item = data[0];
      if (entityName === "Medicamento" && item) {
        return {
          ...item,
          apresentacao: (item.apresentacao && item.apresentacao.trim()) ? item.apresentacao.trim() : "COMPRIMIDO"
        };
      }
      return item;
    }
  },

  create: async (data) => {
    const { ip, dbName, password } = getPgConfig();
    if (!data.id) data.id = crypto.randomUUID();
    if (!data.created_at) data.created_at = new Date().toISOString();

    const cols = Object.keys(data).map(k => `"${k}"`).join(", ");
    const vals = Object.values(data).map(v => {
      if (v === null || v === undefined || v === "") return "NULL";
      if (typeof v === "boolean") return v ? "true" : "false";
      if (typeof v === "number") return v.toString();
      return `'${v.toString().replace(/'/g, "''")}'`;
    }).join(", ");
    
    const query = `INSERT INTO "${entityName}" (${cols}) VALUES (${vals})`;
    try {
      await invoke("execute_postgres", { ip, dbName, password, query });
      if (['Medicamento', 'Saida', 'Entrada', 'Emprestimo', 'Usuario', 'PrescricaoPaciente'].includes(entityName)) {
        await logAuditoria(entityName, 'Criar', data.id, `Criação de registro`, ip, dbName, password);
      }
      return data;
    } catch (e) {
      await autoEnsureTable(entityName);
      try {
        await invoke("execute_postgres", { ip, dbName, password, query });
        if (['Medicamento', 'Saida', 'Entrada', 'Emprestimo', 'Usuario', 'PrescricaoPaciente'].includes(entityName)) {
          await logAuditoria(entityName, 'Criar', data.id, `Criação de registro`, ip, dbName, password);
        }
        return data;
      } catch (finalErr) {
        throw new Error(`${finalErr} | QUERY: ${query}`);
      }
    }
  },

  update: async (id, data) => {
    const { ip, dbName, password } = getPgConfig();
    
    const updates = Object.keys(data).filter(k => k !== "id").map(k => {
      let v = data[k];
      let valStr;
      if (v === null || v === undefined || v === "") valStr = "NULL";
      else if (typeof v === "boolean") valStr = v ? "true" : "false";
      else if (typeof v === "number") valStr = v.toString();
      else valStr = `'${v.toString().replace(/'/g, "''")}'`;
      return `"${k}" = ${valStr}`;
    }).join(", ");
    
    if (!updates) return data;

    const query = `UPDATE "${entityName}" SET ${updates} WHERE "id" = '${id}'`;
    try {
      await invoke("execute_postgres", { ip, dbName, password, query });
      if (['Medicamento', 'Saida', 'Entrada', 'Emprestimo', 'Usuario', 'PrescricaoPaciente'].includes(entityName)) {
        await logAuditoria(entityName, 'Atualizar', id, data, ip, dbName, password);
      }
      return data;
    } catch (e) {
      await autoEnsureTable(entityName);
      try {
        await invoke("execute_postgres", { ip, dbName, password, query });
        if (['Medicamento', 'Saida', 'Entrada', 'Emprestimo', 'Usuario', 'PrescricaoPaciente'].includes(entityName)) {
          await logAuditoria(entityName, 'Atualizar', id, data, ip, dbName, password);
        }
        return data;
      } catch (finalErr) {
        throw new Error(`${finalErr} | QUERY: ${query}`);
      }
    }
  },

  delete: async (id) => {
    const { ip, dbName, password } = getPgConfig();
    
    const deletedColTables = ["Medicamento", "Lote", "Entrada", "Saida", "Emprestimo", "Fornecedor", "Ala", "Categoria", "InventarioItem", "Usuario"];
    
    let query;
    if (deletedColTables.includes(entityName)) {
        if (entityName === "Medicamento") {
            // Soft delete Medicamento and cascade to Lote, InventarioItem, Saida, Entrada, Emprestimo
            const queries = [
                `UPDATE "InventarioItem" SET deleted_at = CURRENT_TIMESTAMP WHERE medicamento_id = '${id}'`,
                `UPDATE "Emprestimo" SET deleted_at = CURRENT_TIMESTAMP WHERE medicamento_id = '${id}'`,
                `UPDATE "Saida" SET deleted_at = CURRENT_TIMESTAMP WHERE medicamento_id = '${id}'`,
                `UPDATE "Entrada" SET deleted_at = CURRENT_TIMESTAMP WHERE medicamento_id = '${id}'`,
                `UPDATE "Lote" SET deleted_at = CURRENT_TIMESTAMP WHERE medicamento_id = '${id}'`,
                `UPDATE "Medicamento" SET deleted_at = CURRENT_TIMESTAMP WHERE "id" = '${id}'`
            ];
            for (let q of queries) {
                try { await invoke("execute_postgres", { ip, dbName, password, query: q }); } catch (e) {}
            }
            await logAuditoria(entityName, 'Excluir', id, `Exclusão em cascata do Medicamento`, ip, dbName, password);
            return;
        } else if (entityName === "Lote") {
            // Soft delete Lote and cascade
            const queries = [
                `UPDATE "InventarioItem" SET deleted_at = CURRENT_TIMESTAMP WHERE lote_id = '${id}'`,
                `UPDATE "Emprestimo" SET deleted_at = CURRENT_TIMESTAMP WHERE lote_id = '${id}'`,
                `UPDATE "Saida" SET deleted_at = CURRENT_TIMESTAMP WHERE lote_id = '${id}'`,
                `UPDATE "Entrada" SET deleted_at = CURRENT_TIMESTAMP WHERE lote_id = '${id}'`,
                `UPDATE "Lote" SET deleted_at = CURRENT_TIMESTAMP WHERE "id" = '${id}'`
            ];
            for (let q of queries) {
                try { await invoke("execute_postgres", { ip, dbName, password, query: q }); } catch (e) {}
            }
            await logAuditoria(entityName, 'Excluir', id, `Exclusão em cascata do Lote`, ip, dbName, password);
            return;
        } else {
            query = `UPDATE "${entityName}" SET deleted_at = CURRENT_TIMESTAMP WHERE "id" = '${id}'`;
        }
    } else {
        query = `DELETE FROM "${entityName}" WHERE "id" = '${id}'`;
    }

    try {
      await invoke("execute_postgres", { ip, dbName, password, query });
      if (['Medicamento', 'Saida', 'Entrada', 'Emprestimo', 'Usuario', 'PrescricaoPaciente'].includes(entityName)) {
        await logAuditoria(entityName, 'Excluir', id, `Registro excluído com sucesso`, ip, dbName, password);
      }
      return id;
    } catch (e) {
      await autoEnsureTable(entityName);
      try {
        await invoke("execute_postgres", { ip, dbName, password, query });
        if (['Medicamento', 'Saida', 'Entrada', 'Emprestimo', 'Usuario', 'PrescricaoPaciente'].includes(entityName)) {
          await logAuditoria(entityName, 'Excluir', id, `Registro excluído com sucesso`, ip, dbName, password);
        }
        return id;
      } catch (finalErr) {
        throw new Error(`${finalErr} | QUERY: ${query}`);
      }
    }
  },
});

// ─── Exportações ──────────────────────────────────────────────────────────────

export async function registrarAuditoria(acao, entidade, entidadeId, detalhes) {
  try {
    const user = JSON.parse(localStorage.getItem("pharma_user") || "null");
    const userName = user ? (user.nome || user.login || "Sistema") : "Sistema";
    const auditId = crypto.randomUUID();
    const now = new Date().toISOString();
    let safeDetalhes = "";
    if (typeof detalhes === "object") {
      try { safeDetalhes = JSON.stringify(detalhes); } catch (e) { safeDetalhes = String(detalhes); }
    } else {
      safeDetalhes = detalhes || "";
    }
    const safeDetalhesEscaped = safeDetalhes.replace(/'/g, "''");
    const { ip, dbName, password } = getPgConfig();
    if (!ip || !dbName) return;
    await autoEnsureTable("Auditoria");
    const q = `INSERT INTO "Auditoria" ("id", "acao", "entidade", "entidade_id", "detalhes", "usuario", "data_hora", "created_at") 
               VALUES ('${auditId}', '${acao}', '${entidade}', '${entidadeId || ''}', '${safeDetalhesEscaped}', '${userName}', '${now}', '${now}')`;
    await invoke("execute_postgres", { ip, dbName, password, query: q });
  } catch (e) {
    console.warn("[db.js] Falha ao registrar auditoria:", e);
  }
}

export const db = {
  logAction: registrarAuditoria,
  entities: {
    Medicamento: createEntityProxy("Medicamento"),
    Lote: createEntityProxy("Lote"),
    Entrada: createEntityProxy("Entrada"),
    Saida: createEntityProxy("Saida"),
    Fornecedor: createEntityProxy("Fornecedor"),
    Ala: createEntityProxy("Ala"),
    Emprestimo: createEntityProxy("Emprestimo"),
    Categoria: createEntityProxy("Categoria"),
    Inventario: createEntityProxy("Inventario"),
    InventarioItem: createEntityProxy("InventarioItem"),
    Config: createEntityProxy("Config"),
    CarrinhoPadronizacao: createEntityProxy("CarrinhoPadronizacao"),
    CarrinhoEstoqueCentral: createEntityProxy("CarrinhoEstoqueCentral"),
    CarrinhoEstoqueFisico: createEntityProxy("CarrinhoEstoqueFisico"),
    CarrinhoMovimentacao: createEntityProxy("CarrinhoMovimentacao"),
    Paciente: createEntityProxy("Paciente"),
    PrescricaoPaciente: createEntityProxy("PrescricaoPaciente"),
    Auditoria: createEntityProxy("Auditoria"),
    TransferenciaPendente: createEntityProxy("TransferenciaPendente"),
    PedidoSatelite: createEntityProxy("PedidoSatelite"),
    Usuario: createEntityProxy("Usuario"),
    GavetaPaciente: createEntityProxy("GavetaPaciente"),
    Visita: createEntityProxy("Visita")
  }
};
