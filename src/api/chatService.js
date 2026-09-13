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

let tableEnsured = false;

export async function ensureChatTable() {
  if (tableEnsured) return;
  try {
    const { ip, dbName, password } = getPgConfig();
    const query = `
      CREATE TABLE IF NOT EXISTS "ChatMessage" (
          "id" TEXT PRIMARY KEY,
          "canal" TEXT DEFAULT 'farmacia_recepcao',
          "remetente_modulo" TEXT NOT NULL,
          "remetente_usuario" TEXT NOT NULL,
          "remetente_cargo" TEXT,
          "mensagem" TEXT NOT NULL,
          "lida" BOOLEAN DEFAULT false,
          "created_at" TEXT NOT NULL,
          "deleted_at" TEXT
      );
      CREATE INDEX IF NOT EXISTS "idx_chat_canal_created" ON "ChatMessage" ("canal", "created_at");
    `;
    await invoke("execute_postgres", { ip, dbName, password, query });
    tableEnsured = true;
  } catch (e) {
    console.warn("Aviso ao verificar tabela ChatMessage:", e);
  }
}

export const ChatService = {
  async list(canal = "farmacia_recepcao", limit = 100) {
    try {
      await ensureChatTable();
      const { ip, dbName, password } = getPgConfig();
      const safeCanal = (canal || "farmacia_recepcao").replace(/'/g, "''");
      const query = `
        SELECT * FROM "ChatMessage"
        WHERE "canal" = '${safeCanal}' AND "deleted_at" IS NULL
        ORDER BY "created_at" DESC
        LIMIT ${limit};
      `;
      const rows = await invoke("query_postgres", { ip, dbName, password, query });
      // Retorna em ordem cronológica crescente para o display da conversa
      return (rows || []).reverse();
    } catch (e) {
      console.warn("Erro ao buscar mensagens do chat:", e);
      return [];
    }
  },

  async send({ canal = "farmacia_recepcao", mensagem, remetente_modulo, remetente_usuario, remetente_cargo }) {
    if (!mensagem || !mensagem.trim()) return null;
    await ensureChatTable();
    const { ip, dbName, password } = getPgConfig();

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const safeCanal = (canal || "farmacia_recepcao").replace(/'/g, "''");
    const safeMsg = mensagem.trim().replace(/'/g, "''");
    const safeMod = (remetente_modulo || "Farmácia Satélite").replace(/'/g, "''");
    const safeUser = (remetente_usuario || "Usuário").replace(/'/g, "''");
    const safeCargo = (remetente_cargo || "Farmácia").replace(/'/g, "''");

    const query = `
      INSERT INTO "ChatMessage" (
        "id", "canal", "remetente_modulo", "remetente_usuario", "remetente_cargo", "mensagem", "lida", "created_at"
      ) VALUES (
        '${id}', '${safeCanal}', '${safeMod}', '${safeUser}', '${safeCargo}', '${safeMsg}', false, '${now}'
      );
      NOTIFY app_update;
      NOTIFY table_change;
    `;

    await invoke("execute_postgres", { ip, dbName, password, query });
    return {
      id,
      canal: safeCanal,
      remetente_modulo: safeMod,
      remetente_usuario: safeUser,
      remetente_cargo: safeCargo,
      mensagem: safeMsg,
      lida: false,
      created_at: now
    };
  },

  async countUnread(canal = "farmacia_recepcao", currentModule = "Farmácia Satélite") {
    try {
      await ensureChatTable();
      const { ip, dbName, password } = getPgConfig();
      const safeCanal = (canal || "farmacia_recepcao").replace(/'/g, "''");
      const safeMod = (currentModule || "").replace(/'/g, "''");

      // Mensagens não lidas que NÃO foram enviadas pelo módulo atual
      const query = `
        SELECT COUNT(*) as total FROM "ChatMessage"
        WHERE "canal" = '${safeCanal}' 
          AND "remetente_modulo" != '${safeMod}'
          AND "lida" = false
          AND "deleted_at" IS NULL;
      `;
      const res = await invoke("query_postgres", { ip, dbName, password, query });
      if (res && res[0] && res[0].total !== undefined) {
        return parseInt(res[0].total, 10) || 0;
      }
      return 0;
    } catch {
      return 0;
    }
  },

  async markAllAsRead(canal = "farmacia_recepcao", currentModule = "Farmácia Satélite") {
    try {
      await ensureChatTable();
      const { ip, dbName, password } = getPgConfig();
      const safeCanal = (canal || "farmacia_recepcao").replace(/'/g, "''");
      const safeMod = (currentModule || "").replace(/'/g, "''");

      const query = `
        UPDATE "ChatMessage"
        SET "lida" = true
        WHERE "canal" = '${safeCanal}'
          AND "remetente_modulo" != '${safeMod}'
          AND "lida" = false
          AND "deleted_at" IS NULL;
      `;
      await invoke("execute_postgres", { ip, dbName, password, query });
    } catch (e) {
      console.warn("Aviso ao marcar mensagens como lidas:", e);
    }
  }
};
