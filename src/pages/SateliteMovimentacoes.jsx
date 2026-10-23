import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import Saidas from "./Saidas";
import Devolucoes from "./Devolucoes";
import PassagemPlantao from "./PassagemPlantao";
import { PackagePlus, RotateCcw, PackageMinus, ClipboardList, Calendar } from "lucide-react";
import PedidosSateliteUrgencia from "@/components/PedidosSateliteUrgencia";
import { MapaMensalDispensacao } from "@/components/relatorios/MapaMensalDispensacao";
import { cn } from "@/lib/utils";

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function SateliteMovimentacoes() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const tabParam = searchParams.get("tab");

  // Se vier tab="pedidos" legado ou não vier nada, padrão é "pedidos_urgencia" (Avulsos)
  const initialTab = (tabParam === "pedidos" || !tabParam) ? "pedidos_urgencia" : tabParam;
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam === "pedidos" ? "pedidos_urgencia" : tabParam);
    }
  }, [tabParam]);

  return (
    <div className="w-full h-full bg-slate-50/50 dark:bg-slate-950 flex flex-col">
      {/* Tabs */}
      <div className="flex gap-0 border-b border-slate-200 bg-white px-4 shrink-0 overflow-x-auto">
        <button
          onClick={() => setActiveTab("pedidos_urgencia")}
          className={cn(
            "flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors shrink-0",
            activeTab === "pedidos_urgencia"
              ? "border-blue-600 text-blue-700 font-bold bg-blue-50/50"
              : "border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-50/50"
          )}
        >
          <PackagePlus className="w-4 h-4 text-blue-600" />
          Pedidos à Central (Avulsos)
          <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] bg-blue-100 text-blue-800 font-bold border border-blue-200">
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

        <button
          onClick={() => setActiveTab("passagem_plantao")}
          className={cn(
            "flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors shrink-0",
            activeTab === "passagem_plantao"
              ? "border-purple-600 text-purple-700 font-bold bg-purple-50/40"
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          <ClipboardList className="w-4 h-4 text-purple-600" />
          Passagem de Plantão
        </button>

        <button
          onClick={() => setActiveTab("mapa_mensal")}
          className={cn(
            "flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors shrink-0",
            activeTab === "mapa_mensal"
              ? "border-blue-600 text-blue-700 font-bold bg-blue-50/50"
              : "border-transparent text-slate-600 hover:text-slate-800"
          )}
        >
          <Calendar className="w-4 h-4 text-blue-600" />
          Mapa Mensal de Dispensação
          <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] bg-blue-100 text-blue-800 font-bold border border-blue-200">
            A4
          </span>
        </button>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto">
        {(activeTab === "pedidos" || activeTab === "pedidos_urgencia") ? (
          <div className="p-6">
            <PedidosSateliteUrgencia />
          </div>
        ) : activeTab === "devolucoes" ? (
          <Devolucoes isTab={true} />
        ) : activeTab === "saidas" ? (
          <Saidas isTab={true} />
        ) : activeTab === "mapa_mensal" ? (
          <div className="p-6">
            <MapaMensalDispensacao />
          </div>
        ) : (
          <PassagemPlantao isTab={true} />
        )}
      </div>
    </div>
  );
}
