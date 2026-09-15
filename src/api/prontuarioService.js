import { invoke } from "@tauri-apps/api/core";

function getPgConfig() {
  const ip = localStorage.getItem("pg_ip");
  const dbName = localStorage.getItem("pg_db") || "axion";
  const password = localStorage.getItem("pg_pass");
  if (!ip || !password) {
    throw new Error("PostgreSQL não configurado.");
  }
  return { ip, dbName, password };
}

let tablesEnsured = false;

export async function ensureProntuarioTables() {
  if (tablesEnsured) return;
  try {
    const { ip, dbName, password } = getPgConfig();
    const query = `
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
    `;
    await invoke("execute_postgres", { ip, dbName, password, query });
    tablesEnsured = true;
  } catch (e) {
    console.warn("Aviso ao verificar tabelas do Prontuário:", e);
  }
}

export const ProntuarioService = {
  // ─── EVOLUÇÃO CLÍNICA / HISTÓRICO ──────────────────────────────────────────
  async listEvolucoes(pacienteId) {
    if (!pacienteId) return [];
    try {
      await ensureProntuarioTables();
      const { ip, dbName, password } = getPgConfig();
      const safeId = String(pacienteId).replace(/'/g, "''");
      const query = `
        SELECT * FROM "ProntuarioEvolucao"
        WHERE "paciente_id" = '${safeId}' AND "deleted_at" IS NULL
        ORDER BY "data_hora" DESC;
      `;
      return await invoke("query_postgres", { ip, dbName, password, query }) || [];
    } catch (e) {
      console.warn("Erro ao buscar evoluções clínicas:", e);
      return [];
    }
  },

  async createEvolucao({
    paciente_id,
    tipo = "Evolução Médica",
    titulo = "",
    descricao,
    conduta = "",
    pressao_arterial = "",
    frequencia_cardiaca = "",
    temperatura = "",
    saturacao_o2 = "",
    glicemia = "",
    profissional_nome = "Médico",
    profissional_cargo = "Médico",
    profissional_crm = ""
  }) {
    if (!paciente_id || !descricao) throw new Error("Paciente e descrição são obrigatórios.");
    await ensureProntuarioTables();
    const { ip, dbName, password } = getPgConfig();

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const query = `
      INSERT INTO "ProntuarioEvolucao" (
        "id", "paciente_id", "tipo", "titulo", "descricao", "conduta",
        "pressao_arterial", "frequencia_cardiaca", "temperatura", "saturacao_o2", "glicemia",
        "profissional_nome", "profissional_cargo", "profissional_crm",
        "data_hora", "created_at"
      ) VALUES (
        '${id}',
        '${String(paciente_id).replace(/'/g, "''")}',
        '${String(tipo).replace(/'/g, "''")}',
        '${String(titulo || "").replace(/'/g, "''")}',
        '${String(descricao).replace(/'/g, "''")}',
        '${String(conduta || "").replace(/'/g, "''")}',
        '${String(pressao_arterial || "").replace(/'/g, "''")}',
        '${String(frequencia_cardiaca || "").replace(/'/g, "''")}',
        '${String(temperatura || "").replace(/'/g, "''")}',
        '${String(saturacao_o2 || "").replace(/'/g, "''")}',
        '${String(glicemia || "").replace(/'/g, "''")}',
        '${String(profissional_nome || "").replace(/'/g, "''")}',
        '${String(profissional_cargo || "").replace(/'/g, "''")}',
        '${String(profissional_crm || "").replace(/'/g, "''")}',
        '${now}',
        '${now}'
      );
      NOTIFY app_update;
      NOTIFY table_change;
    `;

    await invoke("execute_postgres", { ip, dbName, password, query });
    return { id, paciente_id, tipo, titulo, descricao, data_hora: now };
  },

  async deleteEvolucao(id) {
    if (!id) return;
    await ensureProntuarioTables();
    const { ip, dbName, password } = getPgConfig();
    const now = new Date().toISOString();
    const query = `
      UPDATE "ProntuarioEvolucao"
      SET "deleted_at" = '${now}'
      WHERE "id" = '${String(id).replace(/'/g, "''")}';
      NOTIFY app_update;
      NOTIFY table_change;
    `;
    await invoke("execute_postgres", { ip, dbName, password, query });
  },

  // ─── EXAMES LABORATORIAIS E IMAGEM ──────────────────────────────────────────
  async listExames(pacienteId) {
    if (!pacienteId) return [];
    try {
      await ensureProntuarioTables();
      const { ip, dbName, password } = getPgConfig();
      const safeId = String(pacienteId).replace(/'/g, "''");
      const query = `
        SELECT * FROM "ProntuarioExame"
        WHERE "paciente_id" = '${safeId}' AND "deleted_at" IS NULL
        ORDER BY "data_solicitacao" DESC, "created_at" DESC;
      `;
      return await invoke("query_postgres", { ip, dbName, password, query }) || [];
    } catch (e) {
      console.warn("Erro ao buscar exames:", e);
      return [];
    }
  },

  async createExame({
    paciente_id,
    tipo = "Laboratorial",
    nome_exame,
    data_solicitacao = new Date().toISOString().slice(0, 10),
    data_resultado = null,
    status = "Concluído",
    resultado = "",
    valores_referencia = "",
    solicitante_nome = "",
    laudo_medico = ""
  }) {
    if (!paciente_id || !nome_exame) throw new Error("Paciente e nome do exame são obrigatórios.");
    await ensureProntuarioTables();
    const { ip, dbName, password } = getPgConfig();

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const dtRes = data_resultado ? `'${String(data_resultado).replace(/'/g, "''")}'` : "NULL";

    const query = `
      INSERT INTO "ProntuarioExame" (
        "id", "paciente_id", "tipo", "nome_exame", "data_solicitacao", "data_resultado",
        "status", "resultado", "valores_referencia", "solicitante_nome", "laudo_medico", "created_at"
      ) VALUES (
        '${id}',
        '${String(paciente_id).replace(/'/g, "''")}',
        '${String(tipo).replace(/'/g, "''")}',
        '${String(nome_exame).replace(/'/g, "''")}',
        '${String(data_solicitacao).replace(/'/g, "''")}',
        ${dtRes},
        '${String(status).replace(/'/g, "''")}',
        '${String(resultado || "").replace(/'/g, "''")}',
        '${String(valores_referencia || "").replace(/'/g, "''")}',
        '${String(solicitante_nome || "").replace(/'/g, "''")}',
        '${String(laudo_medico || "").replace(/'/g, "''")}',
        '${now}'
      );
      NOTIFY app_update;
      NOTIFY table_change;
    `;

    await invoke("execute_postgres", { ip, dbName, password, query });
    return { id, paciente_id, nome_exame, status, created_at: now };
  },

  async updateExame(id, updates = {}) {
    if (!id) return;
    await ensureProntuarioTables();
    const { ip, dbName, password } = getPgConfig();

    const setClauses = [];
    if (updates.status) setClauses.push(`"status" = '${String(updates.status).replace(/'/g, "''")}'`);
    if (updates.resultado !== undefined) setClauses.push(`"resultado" = '${String(updates.resultado).replace(/'/g, "''")}'`);
    if (updates.laudo_medico !== undefined) setClauses.push(`"laudo_medico" = '${String(updates.laudo_medico).replace(/'/g, "''")}'`);
    if (updates.data_resultado) setClauses.push(`"data_resultado" = '${String(updates.data_resultado).replace(/'/g, "''")}'`);

    if (setClauses.length === 0) return;

    const query = `
      UPDATE "ProntuarioExame"
      SET ${setClauses.join(", ")}
      WHERE "id" = '${String(id).replace(/'/g, "''")}';
      NOTIFY app_update;
      NOTIFY table_change;
    `;
    await invoke("execute_postgres", { ip, dbName, password, query });
  },

  async deleteExame(id) {
    if (!id) return;
    await ensureProntuarioTables();
    const { ip, dbName, password } = getPgConfig();
    const now = new Date().toISOString();
    const query = `
      UPDATE "ProntuarioExame"
      SET "deleted_at" = '${now}'
      WHERE "id" = '${String(id).replace(/'/g, "''")}';
      NOTIFY app_update;
      NOTIFY table_change;
    `;
    await invoke("execute_postgres", { ip, dbName, password, query });
  },

  // ─── ALERGIAS E SENSIBILIDADES ──────────────────────────────────────────────
  async listAlergias(pacienteId) {
    if (!pacienteId) return [];
    try {
      await ensureProntuarioTables();
      const { ip, dbName, password } = getPgConfig();
      const safeId = String(pacienteId).replace(/'/g, "''");
      const query = `
        SELECT * FROM "ProntuarioAlergia"
        WHERE "paciente_id" = '${safeId}' AND "deleted_at" IS NULL
        ORDER BY 
          CASE 
            WHEN "gravidade" = 'Choque Anafilático' THEN 1
            WHEN "gravidade" = 'Grave' THEN 2
            WHEN "gravidade" = 'Moderada' THEN 3
            ELSE 4
          END,
          "created_at" DESC;
      `;
      return await invoke("query_postgres", { ip, dbName, password, query }) || [];
    } catch (e) {
      console.warn("Erro ao buscar alergias:", e);
      return [];
    }
  },

  async createAlergia({
    paciente_id,
    agente,
    tipo = "Medicamentosa",
    gravidade = "Grave",
    reacao = "",
    registrado_por = "Equipe de Saúde"
  }) {
    if (!paciente_id || !agente) throw new Error("Paciente e agente são obrigatórios.");
    await ensureProntuarioTables();
    const { ip, dbName, password } = getPgConfig();

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const query = `
      INSERT INTO "ProntuarioAlergia" (
        "id", "paciente_id", "agente", "tipo", "gravidade", "reacao", "registrado_por", "data_registro", "created_at"
      ) VALUES (
        '${id}',
        '${String(paciente_id).replace(/'/g, "''")}',
        '${String(agente).replace(/'/g, "''")}',
        '${String(tipo).replace(/'/g, "''")}',
        '${String(gravidade).replace(/'/g, "''")}',
        '${String(reacao || "").replace(/'/g, "''")}',
        '${String(registrado_por || "").replace(/'/g, "''")}',
        '${now}',
        '${now}'
      );
    `;
    await invoke("execute_postgres", { ip, dbName, password, query });

    // Sincroniza string acumulada no cadastro do paciente
    await this.syncPacienteAlergiasString(paciente_id);
    return { id, paciente_id, agente, gravidade, created_at: now };
  },

  async deleteAlergia(id, paciente_id) {
    if (!id) return;
    await ensureProntuarioTables();
    const { ip, dbName, password } = getPgConfig();
    const now = new Date().toISOString();
    const query = `
      UPDATE "ProntuarioAlergia"
      SET "deleted_at" = '${now}'
      WHERE "id" = '${String(id).replace(/'/g, "''")}';
    `;
    await invoke("execute_postgres", { ip, dbName, password, query });
    if (paciente_id) {
      await this.syncPacienteAlergiasString(paciente_id);
    }
  },

  async syncPacienteAlergiasString(pacienteId) {
    try {
      const list = await this.listAlergias(pacienteId);
      const str = list.map(a => `${a.agente} (${a.gravidade})`).join(", ");
      const { ip, dbName, password } = getPgConfig();
      const query = `
        UPDATE "Paciente"
        SET "alergias" = '${str.replace(/'/g, "''")}'
        WHERE "id" = '${String(pacienteId).replace(/'/g, "''")}';
        NOTIFY app_update;
        NOTIFY table_change;
      `;
      await invoke("execute_postgres", { ip, dbName, password, query });
    } catch (e) {
      console.warn("Erro ao sincronizar texto de alergias:", e);
    }
  },

  // ─── DOCUMENTOS, LAUDOS E TERMOS ───────────────────────────────────────────
  async listDocumentos(pacienteId) {
    if (!pacienteId) return [];
    try {
      await ensureProntuarioTables();
      const { ip, dbName, password } = getPgConfig();
      const safeId = String(pacienteId).replace(/'/g, "''");
      const query = `
        SELECT * FROM "ProntuarioDocumento"
        WHERE "paciente_id" = '${safeId}' AND "deleted_at" IS NULL
        ORDER BY "data_emissao" DESC, "created_at" DESC;
      `;
      return await invoke("query_postgres", { ip, dbName, password, query }) || [];
    } catch (e) {
      console.warn("Erro ao buscar documentos:", e);
      return [];
    }
  },

  async createDocumento({
    paciente_id,
    titulo,
    categoria = "Relatório Médico",
    conteudo,
    responsavel_nome = "Médico",
    responsavel_cargo = "Médico",
    data_emissao = new Date().toISOString().slice(0, 10)
  }) {
    if (!paciente_id || !titulo || !conteudo) throw new Error("Paciente, título e conteúdo são obrigatórios.");
    await ensureProntuarioTables();
    const { ip, dbName, password } = getPgConfig();

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const query = `
      INSERT INTO "ProntuarioDocumento" (
        "id", "paciente_id", "titulo", "categoria", "conteudo",
        "responsavel_nome", "responsavel_cargo", "data_emissao", "created_at"
      ) VALUES (
        '${id}',
        '${String(paciente_id).replace(/'/g, "''")}',
        '${String(titulo).replace(/'/g, "''")}',
        '${String(categoria).replace(/'/g, "''")}',
        '${String(conteudo).replace(/'/g, "''")}',
        '${String(responsavel_nome || "").replace(/'/g, "''")}',
        '${String(responsavel_cargo || "").replace(/'/g, "''")}',
        '${String(data_emissao).replace(/'/g, "''")}',
        '${now}'
      );
      NOTIFY app_update;
      NOTIFY table_change;
    `;

    await invoke("execute_postgres", { ip, dbName, password, query });
    return { id, paciente_id, titulo, categoria, created_at: now };
  },

  async deleteDocumento(id) {
    if (!id) return;
    await ensureProntuarioTables();
    const { ip, dbName, password } = getPgConfig();
    const now = new Date().toISOString();
    const query = `
      UPDATE "ProntuarioDocumento"
      SET "deleted_at" = '${now}'
      WHERE "id" = '${String(id).replace(/'/g, "''")}';
      NOTIFY app_update;
      NOTIFY table_change;
    `;
    await invoke("execute_postgres", { ip, dbName, password, query });
  },

  // ─── RESUMO / DADOS CLÍNICOS RÁPIDOS ───────────────────────────────────────
  async updatePacienteResumo(pacienteId, { observacoes, diagnostico, status }) {
    if (!pacienteId) return;
    await ensureProntuarioTables();
    const { ip, dbName, password } = getPgConfig();

    const sets = [];
    if (observacoes !== undefined) sets.push(`"observacoes" = '${String(observacoes).replace(/'/g, "''")}'`);
    if (diagnostico !== undefined) sets.push(`"diagnostico" = '${String(diagnostico).replace(/'/g, "''")}'`);
    if (status !== undefined) sets.push(`"status" = '${String(status).replace(/'/g, "''")}'`);

    if (sets.length === 0) return;

    const query = `
      UPDATE "Paciente"
      SET ${sets.join(", ")}
      WHERE "id" = '${String(pacienteId).replace(/'/g, "''")}';
      NOTIFY app_update;
      NOTIFY table_change;
    `;
    await invoke("execute_postgres", { ip, dbName, password, query });
  }
};
