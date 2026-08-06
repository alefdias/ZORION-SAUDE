/**
 * db.js — Camada de dados: SQLite (via Tauri invoke) como fonte principal.
 *
 * Fluxo:
 *  - Leitura: SQLite local (instantâneo, sem rede)
 *  - Escrita: SQLite local → enfileira operação pendente → dispara sync background
 *  - O Nuvem só é usado via syncManager para sincronização
 */

import { invoke } from "@tauri-apps/api/core";
import { scheduleSyncAfterWrite } from "./syncManager";
import {
  localList,
  localGet,
  localCreate,
  localUpdate,
  localDelete,
} from "./localStore";

// ─── Helper ────────────────────────────────────────────────────────────────────

async function tauriCreate(entityName, data) {
  const result = await invoke("create_entity", { name: entityName, data });
  // Marcar como pendente de sync
  try {
    await invoke("mark_pending_sync", {
      entityName,
      recordId: result.id,
      operation: "create",
    });
  } catch (e) {
    console.warn("[db] Falha ao marcar pending_sync:", e);
  }
  return result;
}

async function tauriUpdate(entityName, id, data) {
  const result = await invoke("update_entity", { name: entityName, id, data });
  try {
    await invoke("mark_pending_sync", {
      entityName,
      recordId: id,
      operation: "update",
    });
  } catch (e) {
    console.warn("[db] Falha ao marcar pending_sync:", e);
  }
  return result;
}

async function tauriDelete(entityName, id) {
  await invoke("delete_entity", { name: entityName, id });
  try {
    await invoke("mark_pending_sync", {
      entityName,
      recordId: id,
      operation: "delete",
    });
  } catch (e) {
    console.warn("[db] Falha ao marcar pending_sync:", e);
  }
}

// ─── Proxy de entidade com Fallback Resiliente ───────────────────────────────────

const createEntityProxy = (entityName) => ({
  list: async (orderBy) => {
    try {
      return await invoke("list_entities", { name: entityName, orderBy: orderBy ?? null });
    } catch (e) {
      console.warn(`[db] list fallback para ${entityName}:`, e);
      return localList(entityName, orderBy);
    }
  },

  get: async (id) => {
    try {
      const all = await invoke("list_entities", { name: entityName, orderBy: null });
      return all.find((item) => item.id === id) ?? null;
    } catch (e) {
      console.warn(`[db] get fallback para ${entityName}:`, e);
      return localGet(entityName, id);
    }
  },

  create: async (data) => {
    try {
      const item = await tauriCreate(entityName, data);
      scheduleSyncAfterWrite();
      return item;
    } catch (e) {
      console.warn(`[db] create fallback localStore para ${entityName}:`, e);
      const item = localCreate(entityName, data);
      scheduleSyncAfterWrite();
      return item;
    }
  },

  update: async (id, data) => {
    try {
      const item = await tauriUpdate(entityName, id, data);
      scheduleSyncAfterWrite();
      return item;
    } catch (e) {
      console.warn(`[db] update fallback localStore para ${entityName}:`, e);
      const item = localUpdate(entityName, id, data);
      scheduleSyncAfterWrite();
      return item;
    }
  },

  delete: async (id) => {
    try {
      await tauriDelete(entityName, id);
      scheduleSyncAfterWrite();
    } catch (e) {
      console.warn(`[db] delete fallback localStore para ${entityName}:`, e);
      localDelete(entityName, id);
      scheduleSyncAfterWrite();
    }
  },
});

// ─── Exportação ────────────────────────────────────────────────────────────────

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
  },
};
