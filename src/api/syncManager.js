/**
 * syncManager.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Sistema inteligente de sincronização SQLite ↔ Nuvem.
 *
 * Estratégia:
 *  1. Na inicialização, check_db_status() decide o modo:
 *     a) Banco com dados → abre imediatamente, sync incremental em background
 *     b) Banco vazio     → carga inicial completa do nuvem, depois abre
 *  2. Escrita sempre vai para SQLite (via db.js / Tauri invoke)
 *  3. nuvem só é acessado para sincronização (nunca para leitura de tela)
 *  4. Sem internet → funciona normalmente; pendentes ficam na fila
 * ──────────────────────────────────────────────────────────────────────────────
 */

// import {
//   collection,
//   doc,
//   getDocs,
//   setDoc,
//   deleteDoc,
//   writeBatch,
//   query,
//   where,
//   orderBy,
//   limit,
// } from "nuvem/firestore";
// import { firestoreDb } from "@/lib/nuvem";
import { supabase } from "../lib/supabase.js";
import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";
import { toast } from "sonner";

// ─── Constantes ───────────────────────────────────────────────────────────────

const ENTITIES = [
  "Categoria", "Fornecedor", "Ala", "Inventario",
  "Medicamento", "Lote", "Entrada", "Saida",
  "Emprestimo", "InventarioItem", "Config",
  "Paciente", "PrescricaoPaciente",
  "CarrinhoEstoqueCentral", "CarrinhoEstoqueFisico",
  "CarrinhoMovimentacao", "CarrinhoPadronizacao"
];

const BATCH_SIZE = 400;       // máximo do Firestore WriteBatch
const UPSERT_CHUNK = 200;     // registros por invoke de upsert_from_nuvem
const AUTO_SYNC_MS = 5 * 60 * 1000; // 5 min

// ─── Estado global ─────────────────────────────────────────────────────────────

let _isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
let _isSyncing = false;
let _isInitializing = false;
let _initMode = null;       // "local" | "nuvem" | null
let _pendingCount = 0;
let _syncProgress = 0;
let _syncCurrent = 0;
let _syncTotal = 0;
let _lastSync = null;
let _listeners = [];
let _initialized = false;
let _autoSyncInterval = null;

// ─── Notificação de estado ─────────────────────────────────────────────────────

function notify() {
  _listeners.forEach((fn) =>
    fn({
      isOnline: _isOnline,
      isSyncing: _isSyncing,
      isInitializing: _isInitializing,
      initMode: _initMode,
      pendingCount: _pendingCount,
      syncProgress: _syncProgress,
      syncCurrent: _syncCurrent,
      syncTotal: _syncTotal,
      lastSync: _lastSync,
    })
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const pause = (ms = 50) => new Promise((r) => setTimeout(r, ms));

function log(msg, ...args) {
  console.log(`[syncManager] ${msg}`, ...args);
}
function warn(msg, ...args) {
  console.warn(`[syncManager] ⚠ ${msg}`, ...args);
}
function err(msg, ...args) {
  console.error(`[syncManager] ✗ ${msg}`, ...args);
}

async function getPendingCount() {
  try {
    const pending = await invoke("get_pending_sync_records");
    return Array.isArray(pending) ? pending.length : 0;
  } catch {
    return 0;
  }
}

// ─── Carga inicial do Postgres → SQLite ──────────────────────────────────────

async function performInitialLoad() {
  const ip = localStorage.getItem("pg_ip");
  const db = localStorage.getItem("pg_db");
  const pass = localStorage.getItem("pg_pass");
  if (!ip || !pass) {
    throw new Error("Servidor Postgres não configurado. Impossível realizar carga inicial.");
  }

  let totalLoaded = 0;
  for (const table of ENTITIES) {
    try {
      const data = await invoke("query_postgres", {
        ip,
        dbName: db,
        password: pass,
        query: `SELECT * FROM "${table}"`
      });
      if (data && data.length > 0) {
        await invoke("upsert_from_server", { entityName: table, records: data });
        totalLoaded += data.length;
      }
    } catch (e) {
      console.warn(`[syncManager] Erro ao carregar tabela ${table}:`, e);
    }
  }
  
  await invoke("update_sync_metadata", {
    lastSync: new Date().toISOString(),
    appVersion: "2.0.0",
    initialLoadCompleted: true
  });
  
  return totalLoaded;
}

// ─── Sincronização incremental ──────────────────────────────

async function pullIncrementalFromnuvem(since) {
  return 0;
}

// ─── Push: SQLite (pendentes) → nuvem ──────────────────────────────────────

async function pushPendingTonuvem() {
  let pending;
  try {
    pending = await invoke("get_pending_sync_records");
  } catch (e) {
    return 0;
  }

  if (!pending || pending.length === 0) {
    return 0;
  }

  // Apenas limpa a fila local para o app continuar rápido e não acumular pendências
  for (const p of pending) {
    try {
      await invoke("mark_synced", { id: p.id });
    } catch (e) {
      console.warn("Erro ao limpar pendência:", e);
    }
  }

  return pending.length;
}

// ─── Ciclo completo de sincronização ──────────────────────────────────────────

export async function sync() {
  if (_isSyncing) return;
  _isSyncing = true;
  notify();

  const ip = localStorage.getItem("pg_ip");
  const db = localStorage.getItem("pg_db");
  const pass = localStorage.getItem("pg_pass");

  try {
    const pending = await invoke("get_pending_sync_records");
    if (pending && pending.length > 0) {
      if (!ip || !pass) {
         // Silently keep pending if postgres is not configured
         console.warn("Postgres não configurado. Pendências continuarão na fila.");
      } else {
         for (const p of pending) {
           try {
             let dataObj = typeof p.data === 'string' ? JSON.parse(p.data) : p.data;
             if (p.operation === "create" || p.operation === "update") {
                const cols = Object.keys(dataObj).map(k => `"${k}"`).join(", ");
                const vals = Object.values(dataObj).map(v => {
                   if (v === null || v === undefined || v === "") return "NULL";
                   if (typeof v === "boolean") return v ? "true" : "false";
                   if (typeof v === "number") return v.toString();
                   return `'${v.toString().replace(/'/g, "''")}'`;
                }).join(", ");
                
                const updates = Object.keys(dataObj).filter(k => k !== "id").map(k => `"${k}" = EXCLUDED."${k}"`).join(", ");
                let query = `INSERT INTO "${p.entity_name}" (${cols}) VALUES (${vals}) ON CONFLICT ("id") DO UPDATE SET ${updates || 'id = EXCLUDED.id'}`;
                
                await invoke("execute_postgres", { ip, dbName: db, password: pass, query });
             } else if (p.operation === "delete") {
                await invoke("execute_postgres", { ip, dbName: db, password: pass, query: `DELETE FROM "${p.entity_name}" WHERE "id" = '${p.record_id}'` });
             }
             // Mark as synced locally
             await invoke("mark_synced", { id: p.id });
           } catch (e) {
             console.error("Erro ao sincronizar pendência:", e);
           }
         }
      }
    }
  } catch (e) {
    console.warn("Offline sync log:", e);
  } finally {
    _isSyncing = false;
    _pendingCount = await getPendingCount();
    notify();
  }
}

// ─── Inicialização inteligente ─────────────────────────────────────────────────

/**
 * Deve ser chamado UMA VEZ ao iniciar o app.
 * Decide automaticamente entre:
 *   - Abrir com dados locais + sync incremental em background
 *   - Fazer carga inicial do nuvem (banco vazio ou novo)
 *
 * @returns {Promise<{ mode: string, counts: object }>}
 */
export async function initializeApp() {
  if (_isInitializing) return;
  _isInitializing = true;
  notify();

  let dbStatus;
  try {
    dbStatus = await invoke("check_db_status");
    log("Status do banco SQLite:", dbStatus);
  } catch (e) {
    err("Falha ao verificar status do banco:", e.message);
    _isInitializing = false;
    notify();
    return { mode: "error", error: e.message };
  }

  let mode;

  if (dbStatus.has_data && dbStatus.initial_load_completed) {
    // ── MODO A: Banco com dados válidos ─────────────────────────────────────
    if (dbStatus.last_sync) {
      log(`Banco SQLite com dados encontrado. Última sync: ${dbStatus.last_sync}`);
      log("Abrindo sistema imediatamente com dados locais.");
      log("Sincronização incremental iniciará em background.");
    } else {
      log("Banco SQLite importado de outro computador detectado (sem last_sync).");
      log("Usando dados locais. Sincronização incremental em background.");
    }
    mode = "local";
    _initMode = "local";
    _isInitializing = false;
    notify();

    // Sync incremental em background (não bloqueia a UI)
    if (_isOnline) {
      setTimeout(() => sync(), 2000);
    }
  } else {
    // ── MODO B: Banco vazio ou não inicializado ──────────────────────────────
    if (!dbStatus.has_data) {
      log("Banco SQLite vazio. Iniciando carga inicial do nuvem...");
    } else {
      log("Carga inicial não concluída. Retomando carga do nuvem...");
    }
    mode = "nuvem";
    _initMode = "nuvem";
    notify();

    if (_isOnline) {
      try {
        const loaded = await performInitialLoad();
        log(`Carga inicial concluída. ${loaded} registros carregados.`);
        toast.success(`Sistema inicializado com ${loaded} registros do nuvem.`);
      } catch (e) {
        err("Falha na carga inicial:", e.message);
        toast.error("Falha na carga inicial: " + e.message);
      }
    } else {
      warn("Banco vazio e sem conexão. O sistema iniciará sem dados.");
      toast.warning("Sem conexão com a internet. Conecte para baixar os dados.");
    }

    _isInitializing = false;
    _initMode = "local";
    notify();
  }

  _lastSync = dbStatus.last_sync;
  return { mode, counts: dbStatus.record_counts };
}

// ─── initSyncManager (listeners de rede + auto-sync) ──────────────────────────

export function initSyncManager() {
  if (_initialized) return;
  _initialized = true;

  window.addEventListener("online", async () => {
    _isOnline = true;
    log("Conexão restaurada. Iniciando sincronização...");
    notify();
    await sync();
  });

  window.addEventListener("offline", async () => {
    _isOnline = false;
    _pendingCount = await getPendingCount();
    warn("Conexão perdida. O sistema continua funcionando offline.");
    notify();
  });

  // Auto-sync periódico
  if (_autoSyncInterval) clearInterval(_autoSyncInterval);
  _autoSyncInterval = setInterval(async () => {
    if (_isOnline && !_isSyncing) {
      const pc = await getPendingCount();
      if (pc > 0) {
        log(`Auto-sync: ${pc} pendentes`);
        sync();
      }
    }
  }, AUTO_SYNC_MS);
}

// ─── Hook React ───────────────────────────────────────────────────────────────

export function useSyncStatus() {
  const [status, setStatus] = useState({
    isOnline: _isOnline,
    isSyncing: _isSyncing,
    isInitializing: _isInitializing,
    initMode: _initMode,
    pendingCount: _pendingCount,
    syncProgress: _syncProgress,
    syncCurrent: _syncCurrent,
    syncTotal: _syncTotal,
    lastSync: _lastSync,
  });

  useEffect(() => {
    const listener = (s) => setStatus({ ...s });
    _listeners.push(listener);
    return () => {
      _listeners = _listeners.filter((fn) => fn !== listener);
    };
  }, []);

  return status;
}

// ─── scheduleSyncAfterWrite (chamado pelo db.js) ───────────────────────────────

export function scheduleSyncAfterWrite() {
  // Atualiza contagem sem bloquear
  getPendingCount().then((pc) => {
    _pendingCount = pc;
    notify();
  });

  if (_isOnline) {
    clearTimeout(window._syncTimeout);
    window._syncTimeout = setTimeout(() => sync(), 1500);
  }
}

// ─── Utilitários exportados ────────────────────────────────────────────────────

export async function forceFullResync() {
  log("Forçando re-sincronização completa...");
  await invoke("set_sync_metadata", {
    lastSync: null,
    appVersion: null,
    initialLoadCompleted: false,
  });
  await invoke("clear_all_data");
  return initializeApp();
}

export function getLastSync() {
  return _lastSync;
}

export async function getPendingDetails() {
  try {
    return await invoke("get_pending_sync_records");
  } catch {
    return [];
  }
}
