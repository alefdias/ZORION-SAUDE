import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0F172A] border border-white/10 rounded-xl p-3 shadow-xl text-xs">
        <p className="text-slate-300 font-semibold mb-2 capitalize">{label}</p>
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-slate-400">{p.name === "entradas" ? "Entradas" : "Saídas"}:</span>
            <span className="text-white font-bold">{p.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function MovimentacaoChart({ data = [] }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200/60 dark:border-slate-700/60">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Movimentação do Estoque</h3>
          <p className="text-xs text-slate-400 mt-0.5">Últimos 6 meses</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-slate-500">Entradas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-400" />
            <span className="text-slate-500">Saídas</span>
          </div>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="h-52 flex items-center justify-center text-slate-400 text-sm">
          Nenhum dado disponível
        </div>
      ) : (
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorEntradas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorSaidas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
              <XAxis
                dataKey="mes"
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
                style={{ textTransform: "capitalize" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="entradas"
                stroke="#3b82f6"
                strokeWidth={2.5}
                fill="url(#colorEntradas)"
                dot={{ fill: "#3b82f6", r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#3b82f6" }}
              />
              <Area
                type="monotone"
                dataKey="saidas"
                stroke="#f97316"
                strokeWidth={2.5}
                fill="url(#colorSaidas)"
                dot={{ fill: "#f97316", r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: "#f97316" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
