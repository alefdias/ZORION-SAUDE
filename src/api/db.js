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

// ─── Proxy de entidade - 100% Postgres ───────────────────────────────────

const createEntityProxy = (entityName) => ({
  list: async (orderBy) => {
    const { ip, dbName, password } = getPgConfig();
    let query = `SELECT * FROM "${entityName}"`;
    
    // Adiciona restrição de soft delete apenas para tabelas que suportam
    // Mas para simplificar e não dar erro se a coluna não existir, pegamos tudo no frontend
    // Ou podemos assumir que deletados são removidos no DB
    // Na verdade o delete_entity no Rust fazia soft delete. No Postgres, fazemos um `DELETE` real ou filtramos.
    const deletedColTables = ["Medicamento", "Lote", "Entrada", "Saida", "Emprestimo", "Fornecedor", "Ala", "Categoria", "InventarioItem"];
    if (deletedColTables.includes(entityName)) {
        query += ` WHERE deleted_at IS NULL`;
    }

    if (orderBy) {
      // Evita injeção simples
      let orderClean = orderBy.replace(/[^a-zA-Z0-9_-]/g, "");
      // Ajuste para postgres que usa created_at
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
      console.error(`Erro ao listar ${entityName} do Postgres:`, e, "Query:", query);
      throw e;
    }
  },

  get: async (id) => {
    const { ip, dbName, password } = getPgConfig();
    const query = `SELECT * FROM "${entityName}" WHERE "id" = '${id}'`;
    const data = await invoke("query_postgres", { ip, dbName, password, query });
    return data.length > 0 ? data[0] : null;
  },

  create: async (data) => {
    const { ip, dbName, password } = getPgConfig();
    if (!data.id) data.id = crypto.randomUUID();

    const cols = Object.keys(data).map(k => `"${k}"`).join(", ");
    const vals = Object.values(data).map(v => {
      if (v === null || v === undefined || v === "") return "NULL";
      if (typeof v === "boolean") return v ? "true" : "false";
      if (typeof v === "number") return v.toString();
      return `'${v.toString().replace(/'/g, "''")}'`;
    }).join(", ");
    
    const query = `INSERT INTO "${entityName}" (${cols}) VALUES (${vals})`;
    await invoke("execute_postgres", { ip, dbName, password, query });
    return data;
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
    await invoke("execute_postgres", { ip, dbName, password, query });
    return data;
  },

  delete: async (id) => {
    const { ip, dbName, password } = getPgConfig();
    
    const deletedColTables = ["Medicamento", "Lote", "Entrada", "Saida", "Emprestimo", "Fornecedor", "Ala", "Categoria", "InventarioItem"];
    
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
    TransferenciaPendente: createEntityProxy("TransferenciaPendente")
  }
};
