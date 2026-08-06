/**
 * localStore.js
 * Camada de persistência offline usando localStorage.
 * Cada entidade tem seu próprio namespace: "entity_<NomeEntidade>"
 */

const PREFIX = "farmacia_";

// Gera um UUID simples
function generateId() {
  return 'local_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
}

// Retorna a chave do localStorage para uma entidade
function storeKey(entityName) {
  return `${PREFIX}${entityName}`;
}

// Lê todos os registros de uma entidade do localStorage
function readAll(entityName) {
  try {
    const raw = localStorage.getItem(storeKey(entityName));
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// Salva o mapa completo de registros de uma entidade
function writeAll(entityName, map) {
  localStorage.setItem(storeKey(entityName), JSON.stringify(map));
}

// Lista todos os registros de uma entidade (excluindo soft-deletes)
export function localList(entityName, orderBy = null) {
  const map = readAll(entityName);
  let items = Object.values(map).filter(item => !item._deletedAt);

  if (orderBy) {
    items = items.sort((a, b) => {
      const aVal = a[orderBy] ?? '';
      const bVal = b[orderBy] ?? '';
      if (typeof aVal === 'string') return aVal.localeCompare(bVal);
      return aVal - bVal;
    });
  } else {
    // Ordenar por createdAt por padrão (mais recente primeiro)
    items = items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }

  return items;
}

// Busca um registro por ID
export function localGet(entityName, id) {
  const map = readAll(entityName);
  const item = map[id];
  if (!item || item._deletedAt) return null;
  return item;
}

// Cria um novo registro
export function localCreate(entityName, data) {
  const map = readAll(entityName);
  const id = generateId();
  const now = new Date().toISOString();
  const item = {
    ...data,
    id,
    createdAt: now,
    updatedAt: now,
    _synced: false,   // pendente de sync com Firestore
  };
  map[id] = item;
  writeAll(entityName, map);
  return item;
}

// Atualiza um registro existente
export function localUpdate(entityName, id, data) {
  const map = readAll(entityName);
  if (!map[id]) throw new Error(`[localStore] Registro ${id} não encontrado em ${entityName}`);
  const now = new Date().toISOString();
  map[id] = {
    ...map[id],
    ...data,
    id,
    updatedAt: now,
    _synced: false,
  };
  writeAll(entityName, map);
  return map[id];
}

// Deleta um registro (soft delete para permitir sync de remoção)
export function localDelete(entityName, id) {
  const map = readAll(entityName);
  if (!map[id]) return;
  map[id] = {
    ...map[id],
    _deletedAt: new Date().toISOString(),
    _synced: false,
  };
  writeAll(entityName, map);
}

// Upsert de um registro vindo do Firestore (marcado como sincronizado)
export function localUpsertFromFirestore(entityName, firestoreDoc) {
  const map = readAll(entityName);
  // Só substitui se o dado local NÃO está pendente de sync (evita sobrescrever mudanças offline)
  const existing = map[firestoreDoc.id];
  if (existing && !existing._synced && existing.updatedAt > (firestoreDoc.updatedAt || '')) {
    // Mantém versão local mais recente e não sincronizada
    return;
  }
  map[firestoreDoc.id] = {
    ...firestoreDoc,
    _synced: true,
  };
  writeAll(entityName, map);
}

// Marca um registro como sincronizado e atualiza o ID local → ID do Firestore
export function localMarkSynced(entityName, localId, firestoreId) {
  const map = readAll(entityName);
  if (!map[localId]) return;
  const item = { ...map[localId], _synced: true };

  if (localId !== firestoreId) {
    // Troca o ID local pelo ID do Firestore
    item.id = firestoreId;
    map[firestoreId] = item;
    delete map[localId];
  } else {
    map[localId] = item;
  }
  writeAll(entityName, map);
}

// Remove definitivamente um registro do localStorage (após sync de delete)
export function localPurgeDeleted(entityName, id) {
  const map = readAll(entityName);
  delete map[id];
  writeAll(entityName, map);
}

export function localGetPending(entityName) {
  const map = readAll(entityName);
  return Object.values(map).filter(item => !item._synced);
}

// Exporta todo o banco local para JSON
export function exportDatabaseToJson() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(PREFIX)) {
      const entityName = key.replace(PREFIX, "");
      try {
        data[entityName] = JSON.parse(localStorage.getItem(key));
      } catch (e) {
        console.error("Erro ao exportar", key, e);
      }
    }
  }
  return JSON.stringify(data, null, 2);
}

// Importa um JSON (Merge Inteligente)
export function importDatabaseFromJson(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    let newItemsCount = 0;
    let ignoredItemsCount = 0;

    for (const [entityName, entityMap] of Object.entries(data)) {
      const localMap = readAll(entityName);
      
      for (const [id, item] of Object.entries(entityMap)) {
        // Inteligência: Só adiciona se o ID não existir
        if (localMap[id]) {
          ignoredItemsCount++;
        } else {
          localMap[id] = { ...item, _synced: false }; // Marca como pendente para subir pro Nuvem
          newItemsCount++;
        }
      }
      writeAll(entityName, localMap);
    }
    
    return { success: true, newItemsCount, ignoredItemsCount };
  } catch (error) {
    console.error("Erro na importação JSON:", error);
    return { success: false, error: error.message };
  }
}

// Restaura um Snapshot (usado para Desfazer Sincronização)
export function rollbackDatabaseFromJson(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    // Limpar localStore atual (apenas chaves da farmácia)
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith(PREFIX)) {
        localStorage.removeItem(key);
      }
    }
    // Gravar o estado exato
    for (const [entityName, entityMap] of Object.entries(data)) {
       writeAll(entityName, entityMap);
    }
    return { success: true };
  } catch (error) {
    console.error("Erro no rollback:", error);
    return { success: false, error: error.message };
  }
}

