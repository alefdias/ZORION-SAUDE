import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

const COLORS = ["#3b82f6", "#8b5cf6", "#10b981", "#f97316", "#ef4444", "#06b6d4", "#ec4899", "#f59e0b"];

const CATEGORIA_LABELS = {
  analgesico: "Analgésico",
  antitermico: "Antitérmico",
  anti_inflamatorio: "Anti-inflam.",
  antibiotico: "Antibiótico",
  antialergico: "Antialérgico",
  antihipertensivo: "Anti-hipert.",
  antidiabetico: "Antidiabét.",
  controlado: "Controlado",
  psicotropico: "Psicotrópico",
  hormonio: "Hormônio",
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div className="bg-[#0F172A] border border-white/10 rounded-xl px-3 py-2 shadow-xl text-xs">
        <p className="text-slate-300 font-semibold">{CATEGORIA_LABELS[item.name] || item.name}</p>
        <p className="text-white font-bold mt-0.5">{item.value} un.</p>
      </div>
    );
  }
  return null;
};

const renderCustomLegend = (props) => {
  const { payload } = props;
  return (
    <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: entry.color }} />
          <span className="text-[11px] text-slate-500">{CATEGORIA_LABELS[entry.value] || entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function CategoriaChart({ data = [] }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200/60 dark:border-slate-700/60">
      <div className="mb-5">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Estoque por Categoria</h3>
        <p className="text-xs text-slate-400 mt-0.5">Distribuição de unidades</p>
      </div>

      {data.length === 0 ? (
        <div className="h-52 flex items-center justify-center text-slate-400 text-sm">
          Nenhum dado disponível
        </div>
      ) : (
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="45%"
                innerRadius={55}
                outerRadius={75}
                paddingAngle={4}
                dataKey="value"
                nameKey="categoria"
                strokeWidth={0}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={renderCustomLegend} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
