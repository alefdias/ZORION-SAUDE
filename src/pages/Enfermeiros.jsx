import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { UserPlus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Enfermeiros({ _isTab }) {
  const [enfermeiros, setEnfermeiros] = useState([]);
  const [nome, setNome] = useState('');
  const [coren, setCoren] = useState('');
  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  
  useEffect(() => {
    try {
      const saved = localStorage.getItem('axion_enfermeiros');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setEnfermeiros(parsed);
        }
      }
    } catch (e) {
      console.error("Failed to parse enfermeiros", e);
    }
  }, []);

  const handleSave = (e) => {
    e.preventDefault();
    if (!nome || !usuario || !senha) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    const novo = {
      id: Date.now().toString(),
      nome,
      coren,
      usuario,
      senha,
      role: 'enfermeiro'
    };

    const novosEnfermeiros = [...enfermeiros, novo];
    setEnfermeiros(novosEnfermeiros);
    localStorage.setItem('axion_enfermeiros', JSON.stringify(novosEnfermeiros));
    
    toast.success("Enfermeiro cadastrado com sucesso!");
    setNome('');
    setCoren('');
    setUsuario('');
    setSenha('');
  };

  const handleDelete = (id) => {
    const novosEnfermeiros = enfermeiros.filter(e => e.id !== id);
    setEnfermeiros(novosEnfermeiros);
    localStorage.setItem('axion_enfermeiros', JSON.stringify(novosEnfermeiros));
    toast.success("Cadastro removido");
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-blue-500" />
          Cadastro de Enfermeiros
        </h2>
        <p className="text-sm text-slate-500">
          Enfermeiros cadastrados aqui terão acesso exclusivo à Checagem de Enfermagem no Carrinho de Parada.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <form onSubmit={handleSave} className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nome Completo *</label>
              <input 
                type="text" 
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">COREN</label>
              <input 
                type="text" 
                value={coren}
                onChange={(e) => setCoren(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Usuário *</label>
              <input 
                type="text" 
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Senha *</label>
              <input 
                type="password" 
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
                required
              />
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2">
              <Save className="w-4 h-4" />
              Salvar Cadastro
            </Button>
          </form>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">COREN</th>
                  <th className="px-4 py-3 font-medium">Usuário</th>
                  <th className="px-4 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {enfermeiros.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="px-4 py-8 text-center text-slate-500">
                      Nenhum enfermeiro cadastrado.
                    </td>
                  </tr>
                ) : (
                  enfermeiros.map(enf => (
                    <tr key={enf.id} className="border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-4 py-3">{enf.nome}</td>
                      <td className="px-4 py-3">{enf.coren || '-'}</td>
                      <td className="px-4 py-3 font-mono text-xs">{enf.usuario}</td>
                      <td className="px-4 py-3 text-right">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDelete(enf.id)}
                          className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
