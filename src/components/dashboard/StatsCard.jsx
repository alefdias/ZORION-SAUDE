const gradients = {
  blue:   { from: "from-blue-500",   to: "to-blue-700",   icon: "bg-white/20", text: "text-white", shadow: "shadow-blue-500/30" },
  green:  { from: "from-emerald-500", to: "to-emerald-700", icon: "bg-white/20", text: "text-white", shadow: "shadow-emerald-500/30" },
  amber:  { from: "from-orange-400",  to: "to-orange-600",  icon: "bg-white/20", text: "text-white", shadow: "shadow-orange-500/30" },
  purple: { from: "from-violet-500",  to: "to-violet-700",  icon: "bg-white/20", text: "text-white", shadow: "shadow-violet-500/30" },
  red:    { from: "from-red-500",     to: "to-red-700",     icon: "bg-white/20", text: "text-white", shadow: "shadow-red-500/30" },
};

export default function StatsCard({ title, value, subtitle, icon: Icon, color = "blue", trend }) {
  const g = gradients[color] || gradients.blue;

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${g.from} ${g.to} p-5 shadow-lg ${g.shadow} transition-transform duration-200 hover:-translate-y-0.5`}>
      {/* Decorative circle */}
      <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
      <div className="absolute -right-2 -top-8 w-32 h-32 rounded-full bg-white/5" />

      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-white/70">{title}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
          {subtitle && <p className="text-xs text-white/60 mt-1 capitalize">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-xl ${g.icon}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        )}
      </div>
    </div>
  );
}
