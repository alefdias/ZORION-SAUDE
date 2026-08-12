import { useState, useMemo } from "react";
import Saidas from "./Saidas";
import { getApresentacaoEDosagem } from "./Medicamentos";
import { Badge } from "@/components/ui/badge";
import { Package, ArrowUpFromLine, LayoutDashboard, Building2, Stethoscope, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/api/db";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

function PainelDashboard() {
  const { data: medicamentos = [] } = useQuery({
    queryKey: ['medicamentos'],
    queryFn: () => db.entities.Medicamento.list(),
  });

  const { data: saidas = [] } = useQuery({
    queryKey: ['saidas'],
    queryFn: () => db.entities.Saida.list(),
  });

  const stats = useMemo(() => {
    let totalSatelite = 0;
    let uniqueMeds = 0;
    let criticoSatelite = 0;
    
    // Calculate stock stats
    medicamentos.forEach(m => {
      const sateliteStock = m.estoque_satelite || 0;
      if (sateliteStock > 0) {
        totalSatelite += sateliteStock;
        uniqueMeds++;
      }
      if (sateliteStock > 0 && sateliteStock <= 5) {
        criticoSatelite++;
      }
    });

    // Calculate today's dispenses
    const todaySaidas = saidas.filter(s => {
      if (!s.data_saida) return false;
      try {
        // Ignora transferências no dashboard do satélite
        if (s.motivo === "Transferência de Estoque") return false;
        return isToday(parseISO(s.data_saida));
      } catch (e) {
        return false;
      }
    });

    const dispensesToday = todaySaidas.length;

    // Chart Data: Top 8 with most stock in satellite
    const chartData = medicamentos
      .filter(m => (m.estoque_satelite || 0) > 0)
      .sort((a, b) => (b.estoque_satelite || 0) - (a.estoque_satelite || 0))
      .slice(0, 8)
      .map(m => ({
        name: m.nome.substring(0, 15) + (m.nome.length > 15 ? '...' : ''),
        "Volume em Estoque": m.estoque_satelite || 0,
      }));

    // Recent Dispenses (Last 10)
    const recentSaidas = saidas
      .filter(s => s.motivo !== "Transferência de Estoque")
      .sort((a, b) => new Date(b.created_at || b.data_saida) - new Date(a.created_at || a.data_saida))
      .slice(0, 8);

    return { totalSatelite, uniqueMeds, criticoSatelite, dispensesToday, chartData, recentSaidas };
  }, [medicamentos, saidas]);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 h-full">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 border-l-4 border-l-indigo-500 hover:shadow-md transition-shadow bg-indigo-50/50 dark:bg-slate-900 dark:border-slate-800">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Unidades Disponíveis</p>
              <h3 className="text-3xl font-bold text-indigo-700 dark:text-indigo-400 mt-1">{stats.totalSatelite}</h3>
            </div>
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg">
              <Package className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 flex items-center gap-1">
            Total de comprimidos/frascos
          </p>
        </Card>

        <Card className="p-5 border-l-4 border-l-emerald-500 hover:shadow-md transition-shadow bg-white dark:bg-slate-900 dark:border-slate-800">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Medicamentos Únicos</p>
              <h3 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mt-1">{stats.uniqueMeds}</h3>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/40 rounded-lg">
              <Stethoscope className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 flex items-center gap-1">
            Tipos diferentes de medicamentos
          </p>
        </Card>

        <Card className="p-5 border-l-4 border-l-amber-500 hover:shadow-md transition-shadow bg-white dark:bg-slate-900 dark:border-slate-800">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Itens Acabando</p>
              <h3 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mt-1">{stats.criticoSatelite}</h3>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-900/40 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-amber-500 dark:text-amber-400" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-amber-500 dark:text-amber-400" /> Estoque menor que 5
          </p>
        </Card>

        <Card className="p-5 border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-white dark:bg-slate-900 dark:border-slate-800">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Dispensações (Hoje)</p>
              <h3 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mt-1">{stats.dispensesToday}</h3>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/40 rounded-lg">
              <ArrowUpFromLine className="w-6 h-6 text-blue-500 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 flex items-center gap-1">
            Saídas registradas hoje
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[400px]">
        <Card className="p-6 col-span-2 shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 h-full flex flex-col">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Top 8 Maior Volume (Satélite)</h3>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  cursor={{ fill: '#f1f5f9' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="Volume em Estoque" fill="#6366f1" radius={[4, 4, 0, 0]} name="Unidades no Satélite" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 shadow-sm border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col h-full">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">Saídas Recentes</h3>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            {stats.recentSaidas.length === 0 ? (
              <p className="text-sm text-slate-500 text-center mt-10">Nenhuma saída recente.</p>
            ) : (
              stats.recentSaidas.map(saida => (
                <div key={saida.id} className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 flex justify-between items-center group hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <div className="overflow-hidden">
                    <p className="font-semibold text-xs text-slate-700 dark:text-slate-200 truncate" title={saida.medicamento_nome}>
                      {saida.medicamento_nome}
                    </p>
                    <div className="flex gap-2 items-center mt-1">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">{saida.ala_nome || "Sem Ala"}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge variant="outline" className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/30 shadow-sm">
                      -{saida.quantidade}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function Satelite() {
  return (
    <div className="h-full flex flex-col p-4 md:p-6 space-y-4">
      <PainelDashboard />
    </div>
  );
}
