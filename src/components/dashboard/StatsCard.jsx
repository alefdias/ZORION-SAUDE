import React from "react";

const colorStyles = {
  blue:   { pill: "bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400", borderHover: "hover:border-sky-300", textHover: "group-hover:text-sky-600" },
  green:  { pill: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400", borderHover: "hover:border-emerald-300", textHover: "group-hover:text-emerald-600" },
  amber:  { pill: "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400", borderHover: "hover:border-amber-300", textHover: "group-hover:text-amber-600" },
  purple: { pill: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400", borderHover: "hover:border-indigo-300", textHover: "group-hover:text-indigo-600" },
  red:    { pill: "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400", borderHover: "hover:border-rose-300", textHover: "group-hover:text-rose-600" },
};

export default function StatsCard({ title, value, subtitle, icon: Icon, color = "blue", trend }) {
  const c = colorStyles[color] || colorStyles.blue;

  return (
    <div className={`bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md ${c.borderHover} transition-all duration-200 hover:-translate-y-0.5 group`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 transition-colors ${c.textHover}`}>
          {title}
        </span>
        {Icon && (
          <div className={`p-2.5 rounded-xl ${c.pill} transition-transform group-hover:scale-110 shadow-xs`}>
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
          {value}
        </span>
      </div>

      {subtitle && (
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 font-medium capitalize">
          {subtitle}
        </p>
      )}
    </div>
  );
}
