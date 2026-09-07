import { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = [
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#f43f5e", // Rose
  "#64748b", // Slate (Outros)
];

const ORIGEM_COLORS = [
  "#8b5cf6", // Roxo para Psicotrópicos
  "#0ea5e9", // Azul céu para Clínicos
  "#64748b", // Slate
];

const CustomTooltip = ({ active, payload, total }) => {
  if (active && payload && payload.length) {
    const item = payload[0];
    const val = item.value || 0;
    const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
    return (
      <div className="bg-slate-900/95 backdrop-blur border border-slate-700/80 rounded-xl px-3.5 py-2.5 shadow-2xl text-xs z-50">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.payload?.fill || item.color }} />
          <span className="text-slate-200 font-semibold">{item.name}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-white font-bold text-sm">{val.toLocaleString("pt-BR")} un.</span>
          <span className="text-slate-400 text-[11px]">({pct}%)</span>
        </div>
      </div>
    );
  }
  return null;
};

export default function GrupoChart({ data = [], origemData = [] }) {
  const [tab, setTab] = useState("grupos"); // "grupos" ou "origem"

  const activeData = tab === "origem" && origemData.length > 0 ? origemData : data;
  const palette = tab === "origem" ? ORIGEM_COLORS : COLORS;

  const total = activeData.reduce((acc, curr) => acc + (curr.value || 0), 0);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200/60 dark:border-slate-700/60 flex flex-col justify-between">
      {/* Header com Toggle */}
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            Estoque por {tab === "origem" ? "Origem" : "Categoria"}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {tab === "origem" ? "Psicotrópicos vs Clínicos" : "Top 5 maiores grupos em estoque"}
          </p>
        </div>

        {origemData.length > 0 && (
          <div className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setTab("grupos")}
              className={`px-2.5 py-1 rounded-md transition-all ${
                tab === "grupos"
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Categorias
            </button>
            <button
              type="button"
              onClick={() => setTab("origem")}
              className={`px-2.5 py-1 rounded-md transition-all ${
                tab === "origem"
                  ? "bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              Origem
            </button>
          </div>
        )}
      </div>

      {activeData.length === 0 ? (
        <div className="h-52 flex items-center justify-center text-slate-400 text-sm">
          Nenhum dado disponível
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-4">
          {/* Donut Chart */}
          <div className="sm:col-span-5 h-48 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={activeData}
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={68}
                  paddingAngle={3}
                  dataKey="value"
                  nameKey="categoria"
                  strokeWidth={0}
                >
                  {activeData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={palette[index % palette.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip total={total} />} />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Indicador no centro do Donut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total</span>
              <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                {total > 1000000 
                  ? `${(total / 1000000).toFixed(1)}M` 
                  : total > 1000 
                    ? `${(total / 1000).toFixed(0)}k` 
                    : total}
              </span>
            </div>
          </div>

          {/* Legenda Lateral Elegante e Organizada */}
          <div className="sm:col-span-7 flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-1">
            {activeData.map((entry, index) => {
              const val = entry.value || 0;
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
              const color = palette[index % palette.length];

              return (
                <div
                  key={index}
                  className="flex items-center justify-between text-xs py-1 px-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0 mr-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span
                      className="font-medium text-slate-700 dark:text-slate-300 truncate"
                      title={entry.categoria}
                    >
                      {entry.categoria}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      {val.toLocaleString("pt-BR")}
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
