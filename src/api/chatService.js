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

export const CHAT_CHANNELS = [
  {
    id: "central_satelite",
    nome: "Satélite ⇄ Central",
    descricao: "Linha direta de atendimento e urgências entre Satélite e Central",
    categoria: "direto",
    cor: "sky",
    modulos: ["Central", "Satélite"],
    tag: "Linha Direta"
  },
  {
    id: "modulo_central",
    nome: "Módulo Central",
    descricao: "Comunicação e avisos da Farmácia Central",
    categoria: "modulo",
    cor: "blue",
    modulos: ["Central"],
    tag: "Central"
  },
  {
    id: "modulo_satelite",
    nome: "Módulo Satélite",
    descricao: "Comunicação da Farmácia Satélite",
    categoria: "modulo",
    cor: "emerald",
    modulos: ["Satélite"],
    tag: "Satélite"
  },
  {
    id: "modulo_recepcao",
    nome: "Módulo Recepção",
    descricao: "Comunicação com Recepção, internações e triagem",
    categoria: "modulo",
    cor: "purple",
    modulos: ["Recepção"],
    tag: "Recepção"
  },
  {
    id: "farmacia_recepcao",
    nome: "Geral (Todos)",
    descricao: "Canal aberto e integrado entre todos os módulos",
    categoria: "geral",
    cor: "indigo",
    modulos: ["Central", "Satélite", "Recepção"],
    tag: "Geral"
  }
];

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
          "destinatario_modulo" TEXT,
          "mensagem" TEXT NOT NULL,
          "lida" BOOLEAN DEFAULT false,
          "created_at" TEXT NOT NULL,
          "deleted_at" TEXT
      );
      ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "remetente_id" TEXT;
      ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "destinatario_id" TEXT;
      ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "destinatario_nome" TEXT;
      ALTER TABLE "ChatMessage" ADD COLUMN IF NOT EXISTS "destinatario_modulo" TEXT;
      CREATE INDEX IF NOT EXISTS "idx_chat_canal_created" ON "ChatMessage" ("canal", "created_at");
      CREATE INDEX IF NOT EXISTS "idx_chat_remetente" ON "ChatMessage" ("remetente_id");
      CREATE INDEX IF NOT EXISTS "idx_chat_destinatario" ON "ChatMessage" ("destinatario_id");

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
  // Lista dos canais padrão por módulo
  getChannels() {
    return CHAT_CHANNELS;
  },

  // Gera o identificador determinístico do canal 1-a-1 estritamente privado
  getDmChannel(idA, idB) {
    if (!idA || !idB) return null;
    const a = String(idA).toLowerCase().trim();
    const b = String(idB).toLowerCase().trim();
    if (!a || !b) return null;
    const sorted = [a, b].sort();
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

        // Mapear módulo legível
        let moduloLimpo = u.modulo_ativo || "Geral";
        if (moduloLimpo.toLowerCase().includes("satelite") || moduloLimpo.toLowerCase().includes("satélite")) {
          moduloLimpo = "Satélite";
        } else if (moduloLimpo.toLowerCase().includes("central") || moduloLimpo.toLowerCase().includes("estoque")) {
          moduloLimpo = "Central";
        } else if (moduloLimpo.toLowerCase().includes("recep") || moduloLimpo.toLowerCase().includes("recepção")) {
          moduloLimpo = "Recepção";
        }

        return {
          ...u,
          modulo_ativo: moduloLimpo,
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

  // Busca mensagens de um canal com restrição estrita de privacidade
  async list(canal = "farmacia_recepcao", limit = 100, currentUserId = null, currentUserLogin = null) {
    try {
      await ensureChatTable();
      const { ip, dbName, password } = getPgConfig();
      const safeCanal = (canal || "farmacia_recepcao").replace(/'/g, "''");
      
      let privacyFilter = "";
      // PRIVACIDADE TOTAL: Em canais diretos (DM), NINGUÉM vê a conversa do outro!
      if (safeCanal.startsWith("dm_")) {
        if (!currentUserId && !currentUserLogin) {
          return []; // Sem autenticação, não expõe nenhuma mensagem privada
        }
        const ids = [currentUserId, currentUserLogin]
          .filter(Boolean)
          .map(x => `'${String(x).toLowerCase().replace(/'/g, "''")}'`);
        
        privacyFilter = ` AND (
          LOWER(COALESCE("remetente_id", '')) IN (${ids.join(", ")})
          OR LOWER(COALESCE("destinatario_id", '')) IN (${ids.join(", ")})
          OR LOWER("canal") LIKE '%${String(currentUserLogin || currentUserId).toLowerCase().replace(/'/g, "''")}%'
        )`;
      }

      const query = `
        SELECT * FROM "ChatMessage"
        WHERE "canal" = '${safeCanal}' AND "deleted_at" IS NULL ${privacyFilter}
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

  // Envia mensagem em canal de módulo ou DM
  async send({ 
    canal = "farmacia_recepcao", 
    mensagem, 
    remetente_id = null,
    remetente_modulo = "Central", 
    remetente_usuario = "Usuário", 
    remetente_cargo = "",
    destinatario_id = null,
    destinatario_nome = null,
    destinatario_modulo = null
  }) {
    if (!mensagem || !mensagem.trim()) return null;
    await ensureChatTable();
    const { ip, dbName, password } = getPgConfig();

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const safeCanal = (canal || "farmacia_recepcao").replace(/'/g, "''");
    const safeMsg = mensagem.trim().replace(/'/g, "''");
    const safeRemId = remetente_id ? `'${String(remetente_id).replace(/'/g, "''")}'` : "NULL";
    const safeMod = (remetente_modulo || "Central").replace(/'/g, "''");
    const safeUser = (remetente_usuario || "Usuário").replace(/'/g, "''");
    const safeCargo = (remetente_cargo || "").replace(/'/g, "''");
    const safeDestId = destinatario_id ? `'${String(destinatario_id).replace(/'/g, "''")}'` : "NULL";
    const safeDestNome = destinatario_nome ? `'${String(destinatario_nome).replace(/'/g, "''")}'` : "NULL";
    const safeDestMod = destinatario_modulo ? `'${String(destinatario_modulo).replace(/'/g, "''")}'` : "NULL";

    const query = `
      INSERT INTO "ChatMessage" (
        "id", "canal", "remetente_id", "remetente_modulo", "remetente_usuario", "remetente_cargo", 
        "destinatario_id", "destinatario_nome", "destinatario_modulo", "mensagem", "lida", "created_at"
      ) VALUES (
        '${id}', '${safeCanal}', ${safeRemId}, '${safeMod}', '${safeUser}', '${safeCargo}',
        ${safeDestId}, ${safeDestNome}, ${safeDestMod}, '${safeMsg}', false, '${now}'
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
      destinatario_modulo: destinatario_modulo,
      mensagem: safeMsg,
      lida: false,
      created_at: now
    };
  },

  // Conta mensagens não lidas em canais públicos/modulares
  async countUnreadByChannels(currentUserId = null, currentModule = "Geral") {
    try {
      await ensureChatTable();
      const { ip, dbName, password } = getPgConfig();
      
      let filter = "";
      if (currentUserId) {
        const safeUid = String(currentUserId).replace(/'/g, "''");
        filter = `AND ("remetente_id" IS NULL OR "remetente_id" != '${safeUid}')`;
      } else {
        const safeMod = (currentModule || "").replace(/'/g, "''");
        filter = `AND "remetente_modulo" != '${safeMod}'`;
      }

      const query = `
        SELECT "canal", COUNT(*) as count 
        FROM "ChatMessage"
        WHERE "canal" NOT LIKE 'dm_%'
          ${filter}
          AND "lida" = false
          AND "deleted_at" IS NULL
        GROUP BY "canal";
      `;
      const rows = await invoke("query_postgres", { ip, dbName, password, query });
      const byChannel = {};
      let total = 0;
      for (const r of rows || []) {
        const c = parseInt(r.count, 10) || 0;
        if (r.canal) {
          byChannel[r.canal] = c;
          total += c;
        }
      }
      return { total, byChannel };
    } catch (e) {
      console.warn("Erro ao contar mensagens por canal:", e);
      return { total: 0, byChannel: {} };
    }
  },

  // Conta mensagens não lidas no canal único
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
  async countUnreadDmsBySender(currentUserId, currentUserLogin = null) {
    if (!currentUserId && !currentUserLogin) return { total: 0, bySender: {} };
    try {
      await ensureChatTable();
      const { ip, dbName, password } = getPgConfig();
      const ids = [currentUserId, currentUserLogin]
        .filter(Boolean)
        .map(x => `'${String(x).toLowerCase().replace(/'/g, "''")}'`);

      const query = `
        SELECT "remetente_id", COUNT(*) as count 
        FROM "ChatMessage"
        WHERE "canal" LIKE 'dm_%'
          AND (
            LOWER(COALESCE("destinatario_id", '')) IN (${ids.join(", ")})
            OR ("destinatario_id" IS NULL AND LOWER(COALESCE("remetente_id", '')) NOT IN (${ids.join(", ")}))
          )
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
          bySender[String(r.remetente_id).toLowerCase()] = c;
        }
        total += c;
      }
      return { total, bySender };
    } catch {
      return { total: 0, bySender: {} };
    }
  },

  // Lista as conversas ativas exclusivas do usuário logado (Inbox / Minhas Conversas)
  // Garante que ninguém vê a lista de conversas de outro usuário
  async listUserConversations(currentUserId, currentUserLogin = null) {
    if (!currentUserId && !currentUserLogin) return [];
    try {
      await ensureChatTable();
      const { ip, dbName, password } = getPgConfig();
      const myIds = [currentUserId, currentUserLogin]
        .filter(Boolean)
        .map(x => String(x).toLowerCase().trim());
      const idsClause = myIds.map(x => `'${x.replace(/'/g, "''")}'`).join(", ");

      const query = `
        SELECT * FROM "ChatMessage"
        WHERE "canal" LIKE 'dm_%'
          AND "deleted_at" IS NULL
          AND (
            LOWER(COALESCE("remetente_id", '')) IN (${idsClause})
            OR LOWER(COALESCE("destinatario_id", '')) IN (${idsClause})
          )
        ORDER BY "created_at" DESC;
      `;
      const rows = await invoke("query_postgres", { ip, dbName, password, query });
      if (!rows || rows.length === 0) return [];

      const conversationsMap = new Map();

      for (const msg of rows) {
        const remLower = String(msg.remetente_id || "").toLowerCase().trim();
        const isFromMe = myIds.includes(remLower);
        const partnerKey = isFromMe 
          ? String(msg.destinatario_id || "").toLowerCase().trim()
          : remLower;

        if (!partnerKey) continue;

        if (!conversationsMap.has(partnerKey)) {
          conversationsMap.set(partnerKey, {
            partnerId: partnerKey,
            partnerNome: isFromMe ? (msg.destinatario_nome || "Colaborador") : (msg.remetente_usuario || "Colaborador"),
            partnerModulo: isFromMe ? (msg.destinatario_modulo || "Geral") : (msg.remetente_modulo || "Geral"),
            partnerCargo: isFromMe ? "" : (msg.remetente_cargo || ""),
            lastMessage: msg.mensagem,
            lastMessageTime: msg.created_at,
            lastMessageFromMe: isFromMe,
            unreadCount: (!msg.lida && !isFromMe) ? 1 : 0
          });
        } else {
          const conv = conversationsMap.get(partnerKey);
          if (!msg.lida && !isFromMe) {
            conv.unreadCount += 1;
          }
        }
      }

      return Array.from(conversationsMap.values());
    } catch (e) {
      console.warn("Erro ao buscar conversas do usuário:", e);
      return [];
    }
  },

  // Marca todas como lidas em um canal
  async markAllAsRead(canal = "farmacia_recepcao", currentUserId = null, currentModule = "Geral", currentUserLogin = null) {
    try {
      await ensureChatTable();
      const { ip, dbName, password } = getPgConfig();
      const safeCanal = (canal || "farmacia_recepcao").replace(/'/g, "''");
      
      let filter = "";
      if (currentUserId || currentUserLogin) {
        const ids = [currentUserId, currentUserLogin]
          .filter(Boolean)
          .map(x => `'${String(x).toLowerCase().replace(/'/g, "''")}'`);
        filter = `AND ("remetente_id" IS NULL OR LOWER(COALESCE("remetente_id", '')) NOT IN (${ids.join(", ")}))`;
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
        NOTIFY app_update;
        NOTIFY table_change;
      `;
      await invoke("execute_postgres", { ip, dbName, password, query });
    } catch (e) {
      console.warn("Aviso ao marcar mensagens como lidas:", e);
    }
  }
};
