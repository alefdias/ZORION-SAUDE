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

      ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "status_online" TEXT DEFAULT 'offline';
      ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "ultimo_acesso" TEXT;
      ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "modulo_ativo" TEXT;
    `;
    await invoke("execute_postgres", { ip, dbName, password, query });
    tableEnsured = true;
  } catch (e) {
    console.warn("Aviso ao verificar tabela ChatMessage:", e);
  }
}

export const ChatService = {
  // Gera o identificador determinístico do canal 1-a-1
  getDmChannel(idA, idB) {
    if (!idA || !idB) return "farmacia_recepcao";
    const sorted = [String(idA).trim(), String(idB).trim()].sort();
    return `dm_${sorted[0]}_${sorted[1]}`;
  },

  // Atualiza a presença (heartbeat e status selecionado)
  async updatePresence(userId, status = "online", modulo = "Geral") {
    if (!userId) return;
    try {
      await ensureChatTable();
      const { ip, dbName, password } = getPgConfig();
      const now = new Date().toISOString();
      const safeUserId = String(userId).replace(/'/g, "''");
      const safeStatus = (status || "online").replace(/'/g, "''");
      const safeModulo = (modulo || "Geral").replace(/'/g, "''");

      const query = `
        UPDATE "Usuario"
        SET "status_online" = '${safeStatus}',
            "ultimo_acesso" = '${now}',
            "modulo_ativo" = '${safeModulo}'
        WHERE "id" = '${safeUserId}' OR "login" = '${safeUserId}';
        NOTIFY app_update;
        NOTIFY table_change;
      `;
      await invoke("execute_postgres", { ip, dbName, password, query });
    } catch (e) {
      console.warn("Erro ao atualizar presença:", e);
    }
  },

  // Lista todos os funcionários com status calculado em tempo real
  async listStaff(currentUserId = null) {
    try {
      await ensureChatTable();
      const { ip, dbName, password } = getPgConfig();
      const query = `
        SELECT "id", "nome", "login", "perfil", "crm", "coren", "crf", "especialidade", 
               COALESCE("status_online", 'offline') as status_online,
               "ultimo_acesso", "modulo_ativo"
        FROM "Usuario"
        WHERE "deleted_at" IS NULL
        ORDER BY "nome" ASC;
      `;
      const rows = await invoke("query_postgres", { ip, dbName, password, query });
      const now = Date.now();

      const processed = (rows || []).map((u) => {
        let effectiveStatus = u.status_online || "offline";
        let vistoTexto = "Offline";

        if (u.ultimo_acesso) {
          const lastSeenTime = new Date(u.ultimo_acesso).getTime();
          const diffSeconds = Math.floor((now - lastSeenTime) / 1000);

          // Se a última atividade foi há mais de 150 segundos (2.5 min), considera offline
          if (diffSeconds > 150) {
            effectiveStatus = "offline";
            const diffMinutes = Math.floor(diffSeconds / 60);
            if (diffMinutes < 60) {
              vistoTexto = `Visto há ${diffMinutes} min`;
            } else {
              const diffHours = Math.floor(diffMinutes / 60);
              vistoTexto = diffHours < 24 ? `Visto há ${diffHours}h` : "Offline";
            }
          } else {
            vistoTexto = effectiveStatus === "online" ? "Online agora" : effectiveStatus === "ausente" ? "Ausente" : "Em atendimento";
          }
        }

        return {
          ...u,
          status_online: effectiveStatus,
          vistoTexto,
          isSelf: currentUserId && (u.id === currentUserId || u.login === currentUserId)
        };
      });

      // Ordenar: Online (1), Ocupado (2), Ausente (3), Offline (4)
      const rank = { online: 1, ocupado: 2, ausente: 3, offline: 4 };
      return processed.sort((a, b) => {
        const rankA = rank[a.status_online] || 5;
        const rankB = rank[b.status_online] || 5;
        if (rankA !== rankB) return rankA - rankB;
        return (a.nome || "").localeCompare(b.nome || "");
      });
    } catch (e) {
      console.warn("Erro ao listar funcionários:", e);
      return [];
    }
  },

  // Busca mensagens de um canal (geral ou DM)
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
      return (rows || []).reverse();
    } catch (e) {
      console.warn("Erro ao buscar mensagens do chat:", e);
      return [];
    }
  },

  // Envia mensagem em canal geral ou DM
  async send({ 
    canal = "farmacia_recepcao", 
    mensagem, 
    remetente_id = null,
    remetente_modulo = "Farmácia Satélite", 
    remetente_usuario = "Usuário", 
    remetente_cargo = "",
    destinatario_id = null,
    destinatario_nome = null
  }) {
    if (!mensagem || !mensagem.trim()) return null;
    await ensureChatTable();
    const { ip, dbName, password } = getPgConfig();

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const safeCanal = (canal || "farmacia_recepcao").replace(/'/g, "''");
    const safeMsg = mensagem.trim().replace(/'/g, "''");
    const safeRemId = remetente_id ? `'${String(remetente_id).replace(/'/g, "''")}'` : "NULL";
    const safeMod = (remetente_modulo || "Geral").replace(/'/g, "''");
    const safeUser = (remetente_usuario || "Usuário").replace(/'/g, "''");
    const safeCargo = (remetente_cargo || "").replace(/'/g, "''");
    const safeDestId = destinatario_id ? `'${String(destinatario_id).replace(/'/g, "''")}'` : "NULL";
    const safeDestNome = destinatario_nome ? `'${String(destinatario_nome).replace(/'/g, "''")}'` : "NULL";

    const query = `
      INSERT INTO "ChatMessage" (
        "id", "canal", "remetente_id", "remetente_modulo", "remetente_usuario", "remetente_cargo", 
        "destinatario_id", "destinatario_nome", "mensagem", "lida", "created_at"
      ) VALUES (
        '${id}', '${safeCanal}', ${safeRemId}, '${safeMod}', '${safeUser}', '${safeCargo}',
        ${safeDestId}, ${safeDestNome}, '${safeMsg}', false, '${now}'
      );
      NOTIFY app_update;
      NOTIFY table_change;
    `;

    await invoke("execute_postgres", { ip, dbName, password, query });
    return {
      id,
      canal: safeCanal,
      remetente_id,
      remetente_modulo: safeMod,
      remetente_usuario: safeUser,
      remetente_cargo: safeCargo,
      destinatario_id,
      destinatario_nome,
      mensagem: safeMsg,
      lida: false,
      created_at: now
    };
  },

  // Conta mensagens não lidas no canal
  async countUnread(canal = "farmacia_recepcao", currentUserId = null, currentModule = "Geral") {
    try {
      await ensureChatTable();
      const { ip, dbName, password } = getPgConfig();
      const safeCanal = (canal || "farmacia_recepcao").replace(/'/g, "''");
      
      let filter = "";
      if (currentUserId) {
        const safeUid = String(currentUserId).replace(/'/g, "''");
        filter = `AND ("remetente_id" IS NULL OR "remetente_id" != '${safeUid}')`;
      } else {
        const safeMod = (currentModule || "").replace(/'/g, "''");
        filter = `AND "remetente_modulo" != '${safeMod}'`;
      }

      const query = `
        SELECT COUNT(*) as total FROM "ChatMessage"
        WHERE "canal" = '${safeCanal}' 
          ${filter}
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

  // Contagem de DMs não lidas agrupadas por remetente para a lista de funcionários
  async countUnreadDmsBySender(currentUserId) {
    if (!currentUserId) return { total: 0, bySender: {} };
    try {
      await ensureChatTable();
      const { ip, dbName, password } = getPgConfig();
      const safeUid = String(currentUserId).replace(/'/g, "''");

      const query = `
        SELECT "remetente_id", COUNT(*) as count 
        FROM "ChatMessage"
        WHERE "canal" LIKE 'dm_%'
          AND ("destinatario_id" = '${safeUid}' OR ("destinatario_id" IS NULL AND "remetente_id" != '${safeUid}'))
          AND "lida" = false
          AND "deleted_at" IS NULL
        GROUP BY "remetente_id";
      `;
      const rows = await invoke("query_postgres", { ip, dbName, password, query });
      const bySender = {};
      let total = 0;
      for (const r of rows || []) {
        const c = parseInt(r.count, 10) || 0;
        if (r.remetente_id) {
          bySender[r.remetente_id] = c;
        }
        total += c;
      }
      return { total, bySender };
    } catch {
      return { total: 0, bySender: {} };
    }
  },

  // Marca todas como lidas em um canal
  async markAllAsRead(canal = "farmacia_recepcao", currentUserId = null, currentModule = "Geral") {
    try {
      await ensureChatTable();
      const { ip, dbName, password } = getPgConfig();
      const safeCanal = (canal || "farmacia_recepcao").replace(/'/g, "''");
      
      let filter = "";
      if (currentUserId) {
        const safeUid = String(currentUserId).replace(/'/g, "''");
        filter = `AND ("remetente_id" IS NULL OR "remetente_id" != '${safeUid}')`;
      } else {
        const safeMod = (currentModule || "").replace(/'/g, "''");
        filter = `AND "remetente_modulo" != '${safeMod}'`;
      }

      const query = `
        UPDATE "ChatMessage"
        SET "lida" = true
        WHERE "canal" = '${safeCanal}'
          ${filter}
          AND "lida" = false
          AND "deleted_at" IS NULL;
      `;
      await invoke("execute_postgres", { ip, dbName, password, query });
    } catch (e) {
      console.warn("Aviso ao marcar mensagens como lidas:", e);
    }
  }
};
