import { useState, useCallback } from "react";
import { useSyncStatus, sync, getPendingDetails, getLastSync } from "@/api/syncManager";
import { Wifi, WifiOff, RefreshCw, X, CloudUpload, Trash2, Pencil, Plus, ChevronDown, ChevronRight, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const ENTITY_LABELS = {
  Medicamento: "Medicamentos",
  Lote: "Lotes",
  Entrada: "Entradas",
  Saida: "Saídas",
  Fornecedor: "Fornecedores",
  Ala: "Alas",
  Emprestimo: "Empréstimos",
  Categoria: "Categorias",
  Inventario: "Inventários",
  InventarioItem: "Itens de Inventário",
  Config: "Configurações",
};

function getItemLabel(entityName, item) {
  return (
    item.nome ||
    item.medicamento_nome ||
    item.numero_lote ||
    item.record_id?.slice(0, 12) ||
    item.id?.slice(0, 12) ||
    "—"
  );
}

function getOperationType(item) {
  // pending_sync records have an `operation` field
  if (item.operation) return item.operation;
  if (item._deletedAt) return "delete";
  if (item.id?.startsWith("local_")) return "create";
  return "update";
}

const OP_CONFIG = {
  create: { label: "Criar", icon: Plus, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  update: { label: "Editar", icon: Pencil, color: "text-amber-600 bg-amber-50 border-amber-200" },
  delete: { label: "Excluir", icon: Trash2, color: "text-red-600 bg-red-50 border-red-200" },
};

function EntityGroup({ entity, items }) {
  const [expanded, setExpanded] = useState(true);
  const label = ENTITY_LABELS[entity] || entity;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Header do grupo */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
          <span className="font-semibold text-slate-700 text-sm">{label}</span>
          <Badge variant="secondary" className="text-xs h-5 px-1.5">
            {items.length}
          </Badge>
        </div>
      </button>

      {/* Itens */}
      {expanded && (
        <div className="divide-y divide-slate-100">
          {items.map((item) => {
            const op = getOperationType(item);
            const cfg = OP_CONFIG[op];
            const Icon = cfg.icon;
            const itemLabel = getItemLabel(entity, item);

            return (
              <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
                  <Icon className="w-3 h-3" />
                  {cfg.label}
                </span>
                <span className="text-sm text-slate-700 truncate flex-1">{itemLabel}</span>
                {item.updatedAt && (
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">
                    {new Date(item.updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SyncStatusBadge() {
  const { isOnline, isSyncing, pendingCount, syncProgress, syncCurrent, syncTotal } = useSyncStatus();
  const [open, setOpen] = useState(false);
  const [pendingDetails, setPendingDetails] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [historyItem, setHistoryItem] = useState(null);

  const isSyncingNow = isSyncing || syncing;

  const handleOpen = useCallback(async () => {
    const details = await getPendingDetails();
    // Group by entity_name
    const grouped = {};
    for (const p of details) {
      if (!grouped[p.entity_name]) grouped[p.entity_name] = [];
      grouped[p.entity_name].push(p);
    }
    setPendingDetails(Object.entries(grouped).map(([entity, items]) => ({ entity, items })));
    setHistoryItem(getLastSync() ? { date: getLastSync() } : null);
    setOpen(true);
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await sync();
      const details = await getPendingDetails();
      const grouped = {};
      for (const p of details) {
        if (!grouped[p.entity_name]) grouped[p.entity_name] = [];
        grouped[p.entity_name].push(p);
      }
      setPendingDetails(Object.entries(grouped).map(([entity, items]) => ({ entity, items })));
      setHistoryItem(getLastSync() ? { date: getLastSync() } : null);
    } finally {
      setSyncing(false);
    }
  }, []);

  // Undo not available in SQLite-first architecture

  // Badge clicável
  const badge = (() => {
    if (isSyncing || syncing) {
      return (
        <button onClick={handleOpen} className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 hover:bg-amber-100 transition-colors">
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>Sincronizando...</span>
        </button>
      );
    }
    if (!isOnline) {
      return (
        <button onClick={handleOpen} className="flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-3 py-1 hover:bg-red-100 transition-colors">
          <WifiOff className="w-3 h-3" />
          <span>Offline{pendingCount > 0 ? ` · ${pendingCount} pendente${pendingCount !== 1 ? "s" : ""}` : ""}</span>
        </button>
      );
    }
    if (pendingCount > 0) {
      return (
        <button onClick={handleOpen} className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-3 py-1 hover:bg-amber-100 transition-colors">
          <Wifi className="w-3 h-3" />
          <span>{pendingCount} pendente{pendingCount !== 1 ? "s" : ""}</span>
        </button>
      );
    }
    return (
      <button onClick={handleOpen} className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 hover:bg-emerald-100 transition-colors">
        <Wifi className="w-3 h-3" />
        <span>Sincronizado</span>
      </button>
    );
  })();

  const totalPending = pendingDetails.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <>
      {badge}

      {/* Painel de pendências (slide-in da direita) */}
      {open && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/40 z-[999] backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Drawer */}
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-[1000] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div>
                <h2 className="font-bold text-slate-800 text-base">Fila de Sincronização</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {!isOnline
                    ? "Sem conexão — dados serão enviados quando a internet voltar"
                    : totalPending === 0
                    ? "Tudo sincronizado com o Nuvem ✓"
                    : `${totalPending} item${totalPending !== 1 ? "s" : ""} aguardando envio ao Nuvem`}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Status geral */}
            <div className={`mx-5 mt-4 rounded-xl px-4 py-3 flex items-center gap-3 ${
              !isOnline
                ? "bg-red-50 border border-red-200"
                : isSyncingNow
                ? "bg-amber-50 border border-amber-200"
                : totalPending === 0
                ? "bg-emerald-50 border border-emerald-200"
                : "bg-amber-50 border border-amber-200"
            }`}>
              {!isOnline ? (
                <WifiOff className="w-5 h-5 text-red-500 shrink-0" />
              ) : isSyncingNow ? (
                <RefreshCw className="w-5 h-5 text-amber-500 animate-spin shrink-0" />
              ) : (
                <Wifi className={`w-5 h-5 shrink-0 ${totalPending === 0 ? "text-emerald-500" : "text-amber-500"}`} />
              )}
              <span className={`text-sm font-medium ${
                !isOnline ? "text-red-700"
                : isSyncingNow ? "text-amber-700"
                : totalPending === 0 ? "text-emerald-700"
                : "text-amber-700"
              }`}>
                {!isOnline
                  ? "Dispositivo offline"
                  : isSyncingNow
                  ? `Sincronizando... ${syncTotal > 0 ? `(${syncCurrent}/${syncTotal})` : ""}`
                  : totalPending === 0
                  ? "Nuvem atualizado"
                  : `${totalPending} operação${totalPending !== 1 ? "ões" : ""} pendente${totalPending !== 1 ? "s" : ""}`}
              </span>

              {isOnline && totalPending > 0 && !isSyncingNow && (
                <button
                  onClick={handleSync}
                  className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-full px-3 py-1.5 transition-colors"
                >
                  <CloudUpload className="w-3.5 h-3.5" />
                  Sincronizar agora
                </button>
              )}
            </div>

            {/* Barra de progresso — só aparece durante sync com itens */}
            {isSyncingNow && syncTotal > 0 && (
              <div className="mx-5 mt-3 space-y-1">
                <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                  <span>Sincronizando com a Nuvem...</span>
                  <span className="text-blue-600 font-bold">{syncCurrent} / {syncTotal} itens — {syncProgress}%</span>
                </div>
                <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${syncProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Lista de pendentes */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {totalPending === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                    <Wifi className="w-7 h-7 text-emerald-500" />
                  </div>
                  <p className="text-slate-600 font-medium">Nenhum item pendente</p>
                  <p className="text-slate-400 text-sm mt-1">
                    Todos os dados estão sincronizados com a Nuvem
                  </p>
                </div>
              ) : (
                pendingDetails.map((group) => (
                  <EntityGroup
                    key={group.entity}
                    entity={group.entity}
                    items={group.items}
                  />
                ))
              )}
            </div>

            {/* Legenda e Histórico */}
            <div className="border-t border-slate-100">
              {totalPending > 0 && (
                <div className="px-5 py-4 border-b border-slate-100">
                  <p className="text-[11px] text-slate-400 mb-2 font-medium uppercase tracking-wide">Legenda</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(OP_CONFIG).map(([key, cfg]) => {
                      const Icon = cfg.icon;
                      return (
                        <span key={key} className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border ${cfg.color}`}>
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Última sincronização */}
              {historyItem && (
                <div className="px-5 py-4 bg-slate-50">
                  <p className="text-[11px] text-slate-400 mb-2 font-medium uppercase tracking-wide">Última Sincronização</p>
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">
                      {format(parseISO(historyItem.date), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
