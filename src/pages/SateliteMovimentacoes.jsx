import { useState } from "react";
import Saidas from "./Saidas";
import Devolucoes from "./Devolucoes";
import { ShoppingCart, AlertTriangle, RotateCcw, PackageMinus } from "lucide-react";
import { PedidosSateliteManager } from "@/components/PedidosSateliteManager";
import PedidosSateliteUrgencia from "@/components/PedidosSateliteUrgencia";
import { cn } from "@/lib/utils";


// ─── Página Principal ─────────────────────────────────────────────────────────
export default function SateliteMovimentacoes() {
  const [activeTab, setActiveTab] = useState("pedidos");

  return (
    <div className="w-full h-full bg-slate-50/50 dark:bg-slate-950 flex flex-col">
      {/* Tabs */}
      <div className="flex gap-0 border-b border-slate-200 bg-white px-4 shrink-0 overflow-x-auto">
        <button
          onClick={() => setActiveTab("pedidos")}
          className={cn(
            "flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors shrink-0",
            activeTab === "pedidos"
              ? "border-indigo-600 text-indigo-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          <ShoppingCart className="w-4 h-4 text-indigo-600" />
          Pedidos à Central
        </button>

        <button
          onClick={() => setActiveTab("pedidos_urgencia")}
          className={cn(
            "flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors shrink-0",
            activeTab === "pedidos_urgencia"
              ? "border-rose-600 text-rose-700 font-bold bg-rose-50/50"
              : "border-transparent text-rose-600 hover:text-rose-700 hover:bg-rose-50/30"
          )}
        >
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          Pedidos à Central (Urgência)
          <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] bg-rose-100 text-rose-800 font-black border border-rose-300">
            Manual
          </span>
        </button>

        <button
          onClick={() => setActiveTab("devolucoes")}
          className={cn(
            "flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors shrink-0",
            activeTab === "devolucoes"
              ? "border-emerald-500 text-emerald-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          <RotateCcw className="w-4 h-4" />
          Devoluções
        </button>

        <button
          onClick={() => setActiveTab("saidas")}
          className={cn(
            "flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors shrink-0",
            activeTab === "saidas"
              ? "border-blue-500 text-blue-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          <PackageMinus className="w-4 h-4" />
          Saídas
        </button>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto">
        {activeTab === "pedidos" ? (
          <div className="p-6">
            <PedidosSateliteManager mode="satelite" />
          </div>
        ) : activeTab === "pedidos_urgencia" ? (
          <div className="p-6">
            <PedidosSateliteUrgencia />
          </div>
        ) : activeTab === "devolucoes" ? (
          <Devolucoes isTab={true} />
        ) : (
          <Saidas isTab={true} />
        )}
      </div>
    </div>
  );
}
