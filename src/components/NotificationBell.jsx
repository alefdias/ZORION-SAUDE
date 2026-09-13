import { useEffect, useRef, useState } from "react";
import { db } from "@/api/db";
import { useQuery } from "@tanstack/react-query";
import { Bell, ShoppingCart, ArrowRight, PackageCheck, Ban, AlertTriangle, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { useLocation } from "react-router-dom";

// Web Audio API Sound Generator for clean chime alert
export function playNotificationChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // First tone (D5 - 587.33Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
    gain1.gain.setValueAtTime(0.25, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.25);

    // Second tone (A5 - 880Hz) slightly delayed for pleasant bell effect
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
    gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.45);
  } catch (e) {
    console.warn("Chime playback error:", e);
  }
}

export function playUrgentNotificationChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // Pulse 1
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    gain1.gain.setValueAtTime(0.3, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.15);

    // Pulse 2 (Higher)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.18);
    gain2.gain.setValueAtTime(0.35, ctx.currentTime + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.18);
    osc2.stop(ctx.currentTime + 0.35);

    // Pulse 3
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = "sine";
    osc3.frequency.setValueAtTime(1396.91, ctx.currentTime + 0.38);
    gain3.gain.setValueAtTime(0.4, ctx.currentTime + 0.38);
    gain3.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.65);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(ctx.currentTime + 0.38);
    osc3.stop(ctx.currentTime + 0.65);
  } catch (e) {
    console.warn("Urgent chime error:", e);
  }
}

export function NotificationBell({ activeSection }) {
  const prevCountRef = useRef(0);
  const prevSignatureRef = useRef("");
  const hasPlayedOnLogin = useRef(false);
  const location = useLocation();

  // Resolve current active module
  let moduleKey = activeSection?.id;
  if (!moduleKey) {
    try {
      moduleKey = sessionStorage.getItem("zorion_active_section");
    } catch {}
  }
  if (!moduleKey) {
    const path = (location.pathname + location.hash).toLowerCase();
    if (path.includes("satelite")) moduleKey = "satelite";
    else if (path.includes("estoque") || path.includes("movimentacoes") || path.includes("medicamentos") || path.includes("dashboard") || path.includes("vencimentos") || path.includes("compras") || path.includes("relatorios")) moduleKey = "estoque";
    else moduleKey = "estoque";
  }

  const isSatelite = moduleKey === "satelite";
  const isCentral = moduleKey === "estoque";

  // Pedidos cancelados dispensados pela farmácia satélite
  const [dismissedCancelled, setDismissedCancelled] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("zorion_dismissed_cancelled") || "[]");
    } catch {
      return [];
    }
  });

  const handleDismissCancelled = (pedidoId, e) => {
    if (e) e.stopPropagation();
    setDismissedCancelled(prev => {
      const updated = [...new Set([...prev, pedidoId])];
      try {
        localStorage.setItem("zorion_dismissed_cancelled", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Poll orders every 1.5s as ultra-fast fallback alongside PostgreSQL LISTEN/NOTIFY
  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos_satelite'],
    queryFn: async () => {
      const all = await db.entities.PedidoSatelite.list('-created_at');
      return all || [];
    },
    refetchInterval: 1500
  });

  // Separação estrita de notificações por módulo:
  // - ESTOQUE CENTRAL: Apenas pedidos pendentes/em separação vindos da satélite que precisam de atendimento da central
  // - FARMÁCIA SATÉLITE: Apenas pedidos que foram separados (prontos para recebimento) ou cancelados pela central (com motivo)
  let pendingPedidos = [];
  let readyPedidos = [];
  let cancelledPedidos = [];

  const now = Date.now();

  if (isCentral) {
    pendingPedidos = pedidos.filter(p => p.status === "Pendente" || p.status === "Em Separação");
  } else if (isSatelite) {
    readyPedidos = pedidos.filter(p => p.status === "Separado");
    cancelledPedidos = pedidos.filter(p => {
      if (p.status !== "Cancelado") return false;
      if (dismissedCancelled.includes(p.id)) return false;
      const cancelTime = p.data_cancelamento 
        ? new Date(p.data_cancelamento).getTime() 
        : (p.created_at ? new Date(p.created_at).getTime() : 0);
      return (now - cancelTime) < 24 * 60 * 60 * 1000;
    });
  }

  const count = pendingPedidos.length + readyPedidos.length + cancelledPedidos.length;
  const hasUrgent = pendingPedidos.some(p => p.prioridade === "Emergência" || p.prioridade === "Urgente") 
    || cancelledPedidos.length > 0;

  const notifSignature = [
    ...pendingPedidos.map(p => `${p.id}:${p.status}:${p.prioridade}`),
    ...readyPedidos.map(p => `${p.id}:${p.status}`),
    ...cancelledPedidos.map(p => `${p.id}:${p.status}:${p.data_cancelamento}`)
  ].join("|");

  // Sound alert on new orders or upon initial load/login if count > 0
  useEffect(() => {
    if (count > 0) {
      const isNewNotification = !hasPlayedOnLogin.current || count > prevCountRef.current || (prevSignatureRef.current && prevSignatureRef.current !== notifSignature);
      if (isNewNotification) {
        if (hasUrgent) {
          playUrgentNotificationChime();
        } else {
          playNotificationChime();
        }
        hasPlayedOnLogin.current = true;
      }
    }
    prevCountRef.current = count;
    prevSignatureRef.current = notifSignature;
  }, [count, hasUrgent, notifSignature]);

  const handleNavigateToCentral = () => {
    window.location.hash = "#/Movimentacoes?tab=pedidos_satelite";
  };

  const handleNavigateToSatelite = () => {
    window.location.hash = "#/SateliteMovimentacoes?tab=pedidos";
  };

  const headerTitle = isCentral 
    ? "Notificações do Estoque Central" 
    : isSatelite 
      ? "Notificações da Farmácia Satélite" 
      : "Notificações";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button 
          title={headerTitle}
          className="relative p-2 rounded-xl text-slate-600 hover:text-amber-600 hover:bg-slate-100 border border-slate-200/80 transition-colors focus:outline-none cursor-pointer"
        >
          <Bell className={`w-4 h-4 ${count > 0 ? "text-amber-500 animate-bounce" : "text-slate-600"}`} />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white ring-2 ring-white shadow-xs animate-pulse">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-88 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xl p-0 overflow-hidden rounded-xl">
        <div className="p-3 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-xs uppercase tracking-wider">{headerTitle}</span>
          </div>
          {count > 0 && (
            <Badge variant="destructive" className="text-[10px] font-bold">
              {count} alerta(s)
            </Badge>
          )}
        </div>

        <div className="max-h-84 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {count === 0 ? (
            <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-xs">
              <PackageCheck className="w-8 h-8 mx-auto mb-2 text-emerald-500/60" />
              {isCentral 
                ? "Nenhum pedido da Satélite pendente de separação." 
                : isSatelite 
                  ? "Nenhum pedido aguardando conferência ou cancelado." 
                  : "Nenhuma notificação para este módulo."}
            </div>
          ) : (
            <>
              {/* SATÉLITE: Pedidos Prontos / Separados pela Central */}
              {readyPedidos.length > 0 && (
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 border-b border-emerald-200">
                  <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Pronto para Recebimento na Satélite ({readyPedidos.length})
                </div>
              )}
              {readyPedidos.map(pedido => {
                let itensCount = 0;
                try { itensCount = JSON.parse(pedido.itens_json || "[]").length; } catch {}

                return (
                  <div 
                    key={pedido.id} 
                    onClick={handleNavigateToSatelite}
                    className="p-3 bg-emerald-50/40 hover:bg-emerald-100/50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400 group-hover:underline flex items-center gap-1">
                        🚚 {pedido.codigo}
                      </span>
                      <Badge className="text-[10px] bg-emerald-600 text-white font-bold">
                        {pedido.status === "Separado" ? "Separado (Pronto)" : "Em Trânsito"}
                      </Badge>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Ala: {pedido.ala_nome} — Aguardando Conferência
                    </p>
                    <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                      <span>{itensCount} item(s) • Clique para Receber</span>
                      <span>
                        {pedido.data_separacao ? format(new Date(pedido.data_separacao), "HH:mm 'hs'", { locale: ptBR }) : ""}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* SATÉLITE: Pedidos Cancelados pela Central */}
              {cancelledPedidos.length > 0 && (
                <div className="p-2 bg-rose-50 dark:bg-rose-950/30 text-[11px] font-bold text-rose-800 dark:text-rose-300 flex items-center justify-between border-b border-rose-200">
                  <div className="flex items-center gap-1.5">
                    <Ban className="w-3.5 h-3.5 text-rose-600" />
                    <span>Pedidos Cancelados pela Central ({cancelledPedidos.length})</span>
                  </div>
                  <span className="text-[10px] text-rose-500 font-normal">Ação requerida</span>
                </div>
              )}
              {cancelledPedidos.map(pedido => {
                let itensCount = 0;
                try { itensCount = JSON.parse(pedido.itens_json || "[]").length; } catch {}

                return (
                  <div 
                    key={pedido.id} 
                    onClick={handleNavigateToSatelite}
                    className="p-3 bg-rose-50/40 hover:bg-rose-100/50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group relative"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-mono text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1 group-hover:underline">
                        <Ban className="w-3.5 h-3.5 text-rose-600" />
                        {pedido.codigo}
                      </span>
                      <div className="flex items-center gap-1">
                        <Badge className="text-[10px] bg-rose-600 text-white font-bold">
                          CANCELADO
                        </Badge>
                        <button
                          title="Dispensar alerta"
                          onClick={(e) => handleDismissCancelled(pedido.id, e)}
                          className="p-0.5 rounded text-rose-400 hover:text-rose-800 hover:bg-rose-200 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Ala / Setor: {pedido.ala_nome}
                    </p>
                    {pedido.motivo_cancelamento && (
                      <div className="mt-1 p-1.5 bg-white/95 dark:bg-slate-900/90 rounded border border-rose-200 dark:border-rose-900/50 text-[11px] text-rose-700 dark:text-rose-300 font-medium shadow-xs">
                        <span className="font-bold text-rose-900 dark:text-rose-200">Motivo da Central: </span>
                        {pedido.motivo_cancelamento}
                      </div>
                    )}
                    <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                      <span>{itensCount} item(s)</span>
                      <span>
                        {pedido.data_cancelamento 
                          ? format(new Date(pedido.data_cancelamento), "HH:mm 'hs'", { locale: ptBR }) 
                          : ""}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* CENTRAL: Pedidos Pendentes de Separação da Satélite */}
              {pendingPedidos.length > 0 && (
                <div className="p-2 bg-amber-50 dark:bg-amber-950/30 text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 border-b border-amber-200">
                  <ShoppingCart className="w-3.5 h-3.5 text-amber-600" />
                  Pedidos da Satélite para Separação ({pendingPedidos.length})
                </div>
              )}
              {pendingPedidos.map(pedido => {
                let itensCount = 0;
                try { itensCount = JSON.parse(pedido.itens_json || "[]").length; } catch {}

                return (
                  <div 
                    key={pedido.id} 
                    onClick={handleNavigateToCentral}
                    className="p-3 hover:bg-amber-50/60 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:underline">
                        {pedido.codigo}
                      </span>
                      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300">
                        {pedido.status}
                      </Badge>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Ala / Setor: {pedido.ala_nome}
                    </p>
                    <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                      <span>{itensCount} item(s) • {pedido.dias_calculados}D</span>
                      <span>
                        {pedido.data_solicitacao ? format(new Date(pedido.data_solicitacao), "HH:mm 'hs'", { locale: ptBR }) : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {count > 0 && (
          <div className="p-2 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-1.5 text-center">
            {readyPedidos.length > 0 && isSatelite && (
              <Button
                size="sm"
                onClick={handleNavigateToSatelite}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5 h-8"
              >
                <PackageCheck className="w-3.5 h-3.5" />
                Ir para Recebimento na Satélite
                <ArrowRight className="w-3.5 h-3.5 ml-auto" />
              </Button>
            )}
            {pendingPedidos.length > 0 && isCentral && (
              <Button
                size="sm"
                onClick={handleNavigateToCentral}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold gap-1.5 h-8"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                Ir para Separação na Central
                <ArrowRight className="w-3.5 h-3.5 ml-auto" />
              </Button>
            )}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
