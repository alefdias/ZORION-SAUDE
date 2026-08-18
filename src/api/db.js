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
        "deleted_at" TEXT
    );
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
    INSERT INTO "Usuario" ("id", "nome", "login", "senha", "perfil") 
    VALUES ('user-admin-uuid', 'Administrador', 'admin', 'admin123', 'admin')
    ON CONFLICT DO NOTHING;
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

// ─── Proxy de entidade - 100% Postgres ───────────────────────────────────

const createEntityProxy = (entityName) => ({
  list: async (orderBy) => {
    const { ip, dbName, password } = getPgConfig();
    let query = `SELECT * FROM "${entityName}"`;
    
    const deletedColTables = ["Medicamento", "Lote", "Entrada", "Saida", "Emprestimo", "Fornecedor", "Ala", "Categoria", "InventarioItem", "Usuario"];
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
      return data;
    } catch (e) {
      await autoEnsureTable(entityName);
      try {
        const retryData = await invoke("query_postgres", { ip, dbName, password, query });
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
      return data.length > 0 ? data[0] : null;
    } catch (e) {
      await autoEnsureTable(entityName);
      const data = await invoke("query_postgres", { ip, dbName, password, query });
      return data.length > 0 ? data[0] : null;
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
      return data;
    } catch (e) {
      await autoEnsureTable(entityName);
      try {
        await invoke("execute_postgres", { ip, dbName, password, query });
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
      return data;
    } catch (e) {
      await autoEnsureTable(entityName);
      try {
        await invoke("execute_postgres", { ip, dbName, password, query });
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
            return;
        } else {
            query = `UPDATE "${entityName}" SET deleted_at = CURRENT_TIMESTAMP WHERE "id" = '${id}'`;
        }
    } else {
        query = `DELETE FROM "${entityName}" WHERE "id" = '${id}'`;
    }
    
    await invoke("execute_postgres", { ip, dbName, password, query });
  },
});

// ─── Exportações ──────────────────────────────────────────────────────────────

export const db = {
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
    Usuario: createEntityProxy("Usuario")
  }
};
