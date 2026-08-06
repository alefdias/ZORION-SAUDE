import React from "react";
import { Briefcase } from "lucide-react";

export default function Terceirizado() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Briefcase className="w-6 h-6 text-slate-500" />
          Administração Terceirizada
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Módulo de gestão de serviços terceirizados, parceiros e contratos.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center shadow-sm">
        <Briefcase className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
          Em Desenvolvimento
        </h2>
        <p className="text-slate-500 dark:text-slate-500 text-sm max-w-md mx-auto">
          Este módulo está sendo construído para gerenciar parceiros terceirizados.
        </p>
      </div>
    </div>
  );
}
