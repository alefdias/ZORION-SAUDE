import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/api/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Sun, Snowflake, Leaf, Flame, Calendar, Package, Award, ArrowUpRight } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  LineChart, Line, Legend, Cell, PieChart, Pie
} from "recharts";
import { format, parseISO, getMonth, getYear, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const MESES_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

const ESTACOES = [
  { nome: "Verão",     meses: [11, 0, 1],  icon: Sun,       cor: "#f59e0b", bg: "from-amber-50 to-amber-100/50",   border: "border-amber-200", text: "text-amber-700" },
  { nome: "Outono",    meses: [2, 3, 4],   icon: Leaf,      cor: "#f97316", bg: "from-orange-50 to-orange-100/50", border: "border-orange-200", text: "text-orange-700" },
  { nome: "Inverno",   meses: [5, 6, 7],   icon: Snowflake, cor: "#6366f1", bg: "from-indigo-50 to-indigo-100/50", border: "border-indigo-200", text: "text-indigo-700" },
  { nome: "Primavera", meses: [8, 9, 10],  icon: Flame,     cor: "#10b981", bg: "from-emerald-50 to-emerald-100/50", border: "border-emerald-200", text: "text-emerald-700" },
];

const COR_MES = [
  "#f59e0b","#f59e0b","#f97316","#f97316","#f97316",
  "#6366f1","#6366f1","#6366f1","#10b981","#10b981","#10b981","#f59e0b"
];

const ANOS = (() => {
  const cur = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => cur - i);
})();

function buildConsumoMap(saidas) {
  const map = {};
  (saidas || []).forEach(s => {
    if (!s.medicamento_id || !s.quantidade || !s.data_saida) return;
    const d = parseISO(s.data_saida.split("T")[0]);
    if (!isValid(d)) return;
    const mes = getMonth(d), ano = getYear(d);
    if (!map[s.medicamento_id]) map[s.medicamento_id] = {};
    if (!map[s.medicamento_id][ano]) map[s.medicamento_id][ano] = Array(12).fill(0);
    map[s.medicamento_id][ano][mes] += (s.quantidade || 0);
  });
  return map;
}

const CustomTooltipArea = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-bold text-slate-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="font-semibold">{p.name}: <span className="font-bold">{p.value} un.</span></p>
      ))}
    </div>
  );
};

export default function SateliteEvolucao() {
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [medId, setMedId] = useState("__all__");

  const { data: medicamentos = [] } = useQuery({ queryKey: ['medicamentos'], queryFn: () => db.entities.Medicamento.list() });
  const { data: saidas = [] } = useQuery({ queryKey: ['saidas'], queryFn: () => db.entities.Saida.list() });

  const consumoMap = useMemo(() => buildConsumoMap(saidas), [saidas]);

  const anoNum = parseInt(ano, 10);
  const anoAnt = anoNum - 1;

  // ── Série mensal do ano selecionado ────────────────────────────────────────
  const serieMensal = useMemo(() => {
    return MESES.map((m, i) => {
      let val = 0, valAnt = 0;
      if (medId === "__all__") {
        Object.values(consumoMap).forEach(mapa => {
          val += mapa[anoNum]?.[i] || 0;
          valAnt += mapa[anoAnt]?.[i] || 0;
        });
      } else {
        val = consumoMap[medId]?.[anoNum]?.[i] || 0;
        valAnt = consumoMap[medId]?.[anoAnt]?.[i] || 0;
      }
      return { mes: m, [ano]: val, [String(anoAnt)]: valAnt };
    });
  }, [consumoMap, medId, anoNum, anoAnt, ano]);

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totais = serieMensal.map(d => d[ano]);
    const total = totais.reduce((a, b) => a + b, 0);
    const totalAnt = serieMensal.reduce((a, d) => a + (d[String(anoAnt)] || 0), 0);
    const max = Math.max(...totais);
    const picoIdx = totais.indexOf(max);
    const tendencia = totalAnt > 0 ? ((total - totalAnt) / totalAnt) * 100 : 0;

    const estacaoTotais = ESTACOES.map(e => ({
      nome: e.nome,
      total: e.meses.reduce((acc, m) => acc + (totais[m] || 0), 0),
    })).sort((a, b) => b.total - a.total);

    return { total, totalAnt, picoIdx, picoMes: MESES_FULL[picoIdx], picoQtd: max, tendencia, estacaoPico: estacaoTotais[0] };
  }, [serieMensal, ano, anoAnt]);

  // ── Dados por estação para Radar e Pie ────────────────────────────────────
  const dadosEstacao = useMemo(() => {
    const totais = serieMensal.map(d => d[ano]);
    return ESTACOES.map(e => ({
      estacao: e.nome,
      consumo: e.meses.reduce((acc, m) => acc + (totais[m] || 0), 0),
      fill: e.cor,
    }));
  }, [serieMensal, ano]);

  // ── Top 8 medicamentos ────────────────────────────────────────────────────
  const topMeds = useMemo(() => {
    return medicamentos
      .map(m => {
        const total = (consumoMap[m.id]?.[anoNum] || []).reduce((a, b) => a + b, 0);
        return { ...m, total };
      })
      .filter(m => m.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [medicamentos, consumoMap, anoNum]);

  const medOptions = [{ id: "__all__", nome: "Todos os Medicamentos" }, ...topMeds];

  const estPicoObj = ESTACOES.find(e => e.nome === kpis.estacaoPico?.nome);
  const EstIcon = estPicoObj?.icon || Sun;

  return (
    <div className="p-4 md:p-6 space-y-5 bg-gradient-to-br from-slate-50 to-indigo-50/30 min-h-screen">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-indigo-600" />
            Sazonalidade
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Padrão de consumo mensal da Farmácia Satélite</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={medId} onValueChange={setMedId}>
            <SelectTrigger className="w-[220px] h-9 bg-white border-slate-200 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {medOptions.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className="w-[100px] h-9 bg-white border-slate-200 font-bold text-sm">
              <Calendar className="w-3.5 h-3.5 mr-1 text-indigo-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANOS.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total */}
        <Card className="p-4 bg-gradient-to-br from-indigo-600 to-indigo-700 border-0 text-white shadow-lg shadow-indigo-200">
          <div className="flex items-center justify-between mb-2">
            <p className="text-indigo-200 text-xs font-semibold uppercase tracking-wide">Total {ano}</p>
            <Package className="w-4 h-4 text-indigo-300" />
          </div>
          <p className="text-3xl font-extrabold">{kpis.total.toLocaleString()}</p>
          <p className="text-indigo-200 text-xs mt-1">unidades dispensadas</p>
        </Card>

        {/* Pico mensal */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide">Mês Pico</p>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-extrabold text-slate-800">{kpis.picoMes}</p>
          <p className="text-slate-400 text-xs mt-1">{kpis.picoQtd} unidades</p>
        </Card>

        {/* Estação pico */}
        <Card className={cn("p-4 bg-gradient-to-br border shadow-sm", estPicoObj?.bg, estPicoObj?.border)}>
          <div className="flex items-center justify-between mb-2">
            <p className={cn("text-xs font-semibold uppercase tracking-wide", estPicoObj?.text)}>Est. Pico</p>
            <EstIcon className={cn("w-4 h-4", estPicoObj?.text)} />
          </div>
          <p className={cn("text-2xl font-extrabold", estPicoObj?.text)}>{kpis.estacaoPico?.nome || "—"}</p>
          <p className={cn("text-xs mt-1 opacity-70", estPicoObj?.text)}>{kpis.estacaoPico?.total || 0} un. na estação</p>
        </Card>

        {/* Tendência */}
        <Card className="p-4 bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-wide">vs {anoAnt}</p>
            {kpis.tendencia >= 0
              ? <TrendingUp className="w-4 h-4 text-emerald-500" />
              : <TrendingDown className="w-4 h-4 text-red-500" />}
          </div>
          <p className={cn("text-2xl font-extrabold", kpis.tendencia >= 0 ? "text-emerald-600" : "text-red-600")}>
            {kpis.tendencia >= 0 ? "+" : ""}{kpis.tendencia.toFixed(1)}%
          </p>
          <p className="text-slate-400 text-xs mt-1">em relação ao ano anterior</p>
        </Card>
      </div>

      {/* ── Gráfico Área (consumo mensal) + Radar (estações) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5 bg-white border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-800">Consumo Mensal</h2>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-indigo-500 inline-block rounded" />{ano}</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-slate-300 inline-block rounded dashed" />{anoAnt}</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={serieMensal} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="gradAtual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradAnt" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltipArea />} />
              <Area type="monotone" dataKey={String(anoAnt)} stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="4 3" fill="url(#gradAnt)" dot={false} name={String(anoAnt)} />
              <Area type="monotone" dataKey={ano} stroke="#6366f1" strokeWidth={2.5} fill="url(#gradAtual)" dot={{ r: 3, fill: "#6366f1" }} activeDot={{ r: 5 }} name={ano} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5 bg-white border-slate-200 shadow-sm">
          <h2 className="font-bold text-slate-800 mb-1">Por Estação</h2>
          <p className="text-xs text-slate-400 mb-3">Distribuição sazonal do consumo</p>
          <ResponsiveContainer width="100%" height={160}>
            <RadarChart data={dadosEstacao} margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="estacao" tick={{ fontSize: 10, fill: "#64748b" }} />
              <PolarRadiusAxis tick={false} axisLine={false} />
              <Radar name="consumo" dataKey="consumo" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} dot={{ r: 3, fill: "#6366f1" }} />
              <Tooltip formatter={(v) => [`${v} un.`, "Consumo"]} contentStyle={{ borderRadius: "8px", border: "none", fontSize: "11px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
            </RadarChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {dadosEstacao.sort((a, b) => b.consumo - a.consumo).map((e) => {
              const max = Math.max(...dadosEstacao.map(d => d.consumo));
              const pct = max > 0 ? Math.round((e.consumo / max) * 100) : 0;
              const est = ESTACOES.find(es => es.nome === e.estacao);
              return (
                <div key={e.estacao} className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 w-20 font-medium">{e.estacao}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: est?.cor }} />
                  </div>
                  <span className="text-xs font-bold text-slate-700 w-10 text-right">{e.consumo}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ── Top medicamentos + Barras por mês ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 8 ranking */}
        <Card className="p-5 bg-white border-slate-200 shadow-sm">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" />
            Top Medicamentos — {ano}
          </h2>
          {topMeds.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-8">Sem dados de consumo</p>
          ) : (
            <div className="space-y-3">
              {topMeds.map((m, i) => {
                const max = topMeds[0].total;
                const pct = max > 0 ? (m.total / max) * 100 : 0;
                const CORES = ["#6366f1","#8b5cf6","#a78bfa","#c4b5fd","#ddd6fe","#e0e7ff","#eef2ff","#f8fafc"];
                return (
                  <div key={m.id} className="flex items-center gap-3 group cursor-pointer" onClick={() => setMedId(m.id)}>
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white shrink-0"
                      style={{ background: CORES[i] }}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate group-hover:text-indigo-600 transition-colors">{m.nome}</p>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: CORES[i] }} />
                      </div>
                    </div>
                    <Badge className="shrink-0 bg-slate-100 text-slate-700 text-[10px] font-bold hover:bg-indigo-100 hover:text-indigo-700 transition-colors">
                      {m.total}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Barras mensais coloridas por estação */}
        <Card className="p-5 bg-white border-slate-200 shadow-sm">
          <h2 className="font-bold text-slate-800 mb-1 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            Distribuição Mensal por Estação
          </h2>
          <p className="text-xs text-slate-400 mb-4">Cada barra colorida representa uma estação do ano</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={serieMensal} margin={{ top: 0, right: 5, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [`${v} un.`, "Consumo"]} contentStyle={{ borderRadius: "8px", border: "none", fontSize: "11px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }} />
              <Bar dataKey={ano} radius={[5, 5, 0, 0]} maxBarSize={36}>
                {serieMensal.map((_, i) => (
                  <Cell key={i} fill={COR_MES[i]} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-3 mt-3 justify-center">
            {ESTACOES.map(e => {
              const Icon = e.icon;
              return (
                <span key={e.nome} className="flex items-center gap-1 text-[10px] text-slate-500">
                  <Icon className="w-3 h-3" style={{ color: e.cor }} />
                  {e.nome}
                </span>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
