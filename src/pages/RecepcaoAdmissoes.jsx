import React, { useState, useEffect } from "react";
import { FileText, Search, Activity, Users } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function RecepcaoAdmissoes() {
  const [pendencias, setPendencias] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const p = localStorage.getItem("hospital_pendencias");
    if (p) setPendencias(JSON.parse(p));
  }, []);

  const filtered = pendencias.filter(p => 
    p.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.prontuario && p.prontuario.includes(searchTerm))
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <FileText className="w-6 h-6 text-emerald-500" />
            Histórico de Admissões
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Acompanhe os pacientes já admitidos que aguardam vaga/leito.
          </p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input 
            placeholder="Buscar por nome ou prontuário..." 
            className="pl-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-6 py-4 font-medium">Paciente / Prontuário</th>
              <th className="px-6 py-4 font-medium">Idade</th>
              <th className="px-6 py-4 font-medium">Tipo de Internação</th>
              <th className="px-6 py-4 font-medium">Setor de Destino</th>
              <th className="px-6 py-4 font-medium text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center justify-center">
                    <Users className="w-10 h-10 mb-3 text-slate-300 dark:text-slate-700" />
                    Nenhuma admissão pendente no momento.
                  </div>
                </td>
              </tr>
            ) : filtered.map((item) => (
              <tr key={item.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                <td className="px-6 py-4">
                  <span className="font-medium text-slate-700 dark:text-slate-200 block">{item.nome}</span>
                  <span className="text-xs text-slate-400 font-mono">Pront: {item.prontuario}</span>
                </td>
                <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                  {item.idade} anos
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 rounded-md text-xs font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    {item.tipo}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-600 dark:text-slate-300 font-medium">
                  {item.nomeSetor || "Não definido"}
                </td>
                <td className="px-6 py-4 text-right">
                  <span className="inline-flex items-center gap-1 text-orange-600 bg-orange-50 dark:bg-orange-900/30 dark:text-orange-400 px-2.5 py-1 rounded-md text-xs font-bold">
                    <Activity className="w-3.5 h-3.5" /> Aguardando Leito
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
