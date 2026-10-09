import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { db } from "@/api/db";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PackagePlus, ShoppingCart, ArrowLeftRight } from "lucide-react";
import Entradas from "./Entradas";
import { PedidosSateliteManager } from "@/components/PedidosSateliteManager";
import TransferenciaEstoque from "@/components/movimentacoes/TransferenciaEstoque";

export default function Movimentacoes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    tabFromUrl && ["entradas", "pedidos_satelite", "transferencia"].includes(tabFromUrl) 
      ? tabFromUrl 
      : "entradas"
  );

  useEffect(() => {
    if (tabFromUrl && ["entradas", "pedidos_satelite", "transferencia"].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  // Contagem de pedidos satélite pendentes de separação pela Central
  const { data: pedidos = [] } = useQuery({
    queryKey: ['pedidos_satelite'],
    queryFn: async () => {
      const all = await db.entities.PedidoSatelite.list('-created_at');
      return all || [];
    },
    refetchInterval: 4000
  });

  const pendingPedidosCount = pedidos.filter(p => p.status === "Pendente" || p.status === "Em Separação").length;

  const handleTabChange = (val) => {
    setActiveTab(val);
    setSearchParams({ tab: val });
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50/50 dark:bg-slate-950 min-h-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Movimentações do Estoque Central
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gerencie entradas, separação de pedidos da satélite e transferências entre estoques
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="bg-slate-200/70 dark:bg-slate-800 p-1 rounded-xl">
          <TabsTrigger
            value="entradas"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm flex items-center gap-2 font-medium"
          >
            <PackagePlus className="w-4 h-4 text-emerald-600" />
            Entradas
          </TabsTrigger>

          <TabsTrigger
            value="pedidos_satelite"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm flex items-center gap-2 font-medium text-indigo-700 dark:text-indigo-400"
          >
            <ShoppingCart className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Pedidos Satélite (Separação)
            {pendingPedidosCount > 0 && (
              <Badge className="ml-1 bg-red-600 text-white px-1.5 py-0.5 text-[10px] animate-pulse">
                {pendingPedidosCount}
              </Badge>
            )}
          </TabsTrigger>

          <TabsTrigger
            value="transferencia"
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm flex items-center gap-2 font-medium"
          >
            <ArrowLeftRight className="w-4 h-4 text-amber-600" />
            Transferência
          </TabsTrigger>
        </TabsList>

        <TabsContent value="entradas" className="mt-0">
          <Entradas isTab={true} />
        </TabsContent>

        <TabsContent value="pedidos_satelite" className="mt-0">
          <PedidosSateliteManager mode="central" />
        </TabsContent>

        <TabsContent value="transferencia" className="mt-0">
          <TransferenciaEstoque />
        </TabsContent>
      </Tabs>
    </div>
  );
}
