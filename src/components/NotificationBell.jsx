import { useEffect, useRef } from "react";
import { db } from "@/api/db";
import { useQuery } from "@tanstack/react-query";
import { Bell, ShoppingCart, ArrowRight, PackageCheck } from "lucide-react";
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

export function NotificationBell() {
  const prevCountRef = useRef(0);
  const hasPlayedOnLogin = useRef(false);
  const location = useLocation();
  const isSatelite = location.pathname.includes("Satelite") || location.pathname.includes("satelite");
  const isCentral = location.pathname.includes("Estoque") || location.pathname.includes("estoque");

  // Poll pending orders every 4s
  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos_satelite'],
    queryFn: async () => {
      const all = await db.entities.PedidoSatelite.list('-created_at');
      return all || [];
    },
    refetchInterval: 4000
  });

  const pendingPedidos = pedidos.filter(p => p.status === "Pendente" || p.status === "Em Separação");
  const readyPedidos = pedidos.filter(p => p.status === "Separado");
  const count = pendingPedidos.length + readyPedidos.length;

  // Sound alert on new orders or upon initial load/login if count > 0
  useEffect(() => {
    if (count > 0) {
      if (!hasPlayedOnLogin.current || count > prevCountRef.current) {
        playNotificationChime();
        hasPlayedOnLogin.current = true;
      }
    }
    prevCountRef.current = count;
  }, [count]);

  const handleNavigateToCentral = () => {
    window.location.hash = "#/Estoque?tab=pedidos_satelite";
  };

  const handleNavigateToSatelite = () => {
    window.location.hash = "#/SateliteMovimentacoes?tab=pedidos";
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative p-1.5 rounded-lg text-slate-300 hover:text-amber-400 hover:bg-slate-800 transition-colors focus:outline-none">
          <Bell className={`w-5 h-5 ${count > 0 ? "text-amber-400 animate-bounce" : "text-slate-400"}`} />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white ring-2 ring-[#0F172A] shadow-md animate-pulse">
              {count > 9 ? "9+" : count}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-84 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl p-0 overflow-hidden">
        <div className="p-3 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            <span className="font-bold text-xs uppercase tracking-wider">Alertas de Pedidos Satélite</span>
          </div>
          {count > 0 && (
            <Badge variant="destructive" className="text-[10px] font-bold">
              {count} alerta(s)
            </Badge>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {count === 0 ? (
            <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-xs">
              <PackageCheck className="w-8 h-8 mx-auto mb-2 text-emerald-500/60" />
              Nenhum pedido pendente ou aguardando recebimento.
            </div>
          ) : (
            <>
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
                    onClick={() => {
                      if (isSatelite) handleNavigateToSatelite();
                      else alert("Acesse o módulo Farmácia Satélite para confirmar os recebimentos.");
                    }}
                    className={`p-3 bg-emerald-50/40 hover:bg-emerald-100/50 dark:hover:bg-slate-800/60 transition-colors ${isSatelite ? 'cursor-pointer' : 'cursor-default'} group`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400 ${isSatelite ? 'group-hover:underline' : ''}`}>
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
                      <span>{itensCount} item(s) {isSatelite && "• Clique para Receber"}</span>
                      <span>
                        {pedido.data_separacao ? format(new Date(pedido.data_separacao), "HH:mm 'hs'", { locale: ptBR }) : ""}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Pending Central Separation */}
              {pendingPedidos.length > 0 && (
                <div className="p-2 bg-amber-50 dark:bg-amber-950/30 text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 border-b border-amber-200">
                  <ShoppingCart className="w-3.5 h-3.5 text-amber-600" />
                  Pendente de Separação na Central ({pendingPedidos.length})
                </div>
              )}
              {pendingPedidos.map(pedido => {
                let itensCount = 0;
                try { itensCount = JSON.parse(pedido.itens_json || "[]").length; } catch {}

                return (
                  <div 
                    key={pedido.id} 
                    onClick={() => {
                      if (isCentral) handleNavigateToCentral();
                      else alert("Acesse o módulo Estoque Central para realizar as separações.");
                    }}
                    className={`p-3 hover:bg-amber-50/50 dark:hover:bg-slate-800/60 transition-colors ${isCentral ? 'cursor-pointer' : 'cursor-default'} group`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className={`font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 ${isCentral ? 'group-hover:underline' : ''}`}>
                        {pedido.codigo}
                      </span>
                      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300">
                        {pedido.status}
                      </Badge>
                    </div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      Setor / Ala: {pedido.ala_nome}
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
