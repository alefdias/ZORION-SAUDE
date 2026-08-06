import { useState, useEffect, useMemo } from "react";
import { Users, UserPlus, ShieldCheck, Key, Edit, Trash, Lock, History, FileText, AlertTriangle, UserX, LogOut, FileCheck } from "lucide-react";
import { Toaster, toast } from "sonner";
import { getLogs } from "../lib/logger";
import { db } from "@/api/db";
import { useQuery } from "@tanstack/react-query";

export default function ResponsavelTecnico() {
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState("usuarios"); // 'usuarios' | 'auditoria'
  const [auditSubTab, setAuditSubTab] = useState("exclusoes"); // 'exclusoes' | 'acessos'
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);

  const { data: saidalogs = [] } = useQuery({
    queryKey: ['saidas_auditoria'],
    queryFn: () => db.entities.Saida.list(),
  });

  const dbAuditLogs = useMemo(() => {
    return (saidalogs || []).filter(s => 
      (s.medicamento_nome && s.medicamento_nome.includes("[LOG")) || 
      (s.tipo && s.tipo.includes("Log"))
    ).sort((a, b) => (b.created_at || b.data_saida || "").localeCompare(a.created_at || a.data_saida || ""));
  }, [saidalogs]);
  
  // form state
  const [editingId, setEditingId] = useState(null);
  const [nome, setNome] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [cargo, setCargo] = useState("farmaceutico");

  useEffect(() => {
    const saved = localStorage.getItem("axion_users");
    if (saved) {
      setUsers(JSON.parse(saved));
    } else {
      // Default RT user
      const defaultUsers = [{
        id: "1",
        nome: "Admin RT",
        username: "admin",
        password: "123",
        cargo: "administrador",
        modules: ["estoque_farmacia", "farmacia_satelite", "responsavel_tecnico"],
        first_login: false
      }];
      localStorage.setItem("axion_users", JSON.stringify(defaultUsers));
      setUsers(defaultUsers);
    }
    
    // Load logs
    setLogs(getLogs());
  }, []);

  const saveUsers = (newUsers) => {
    setUsers(newUsers);
    localStorage.setItem("axion_users", JSON.stringify(newUsers));
  };



  const handleSave = (e) => {
    e.preventDefault();
    if (!username || !password || !nome) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    if (!cargo) {
      toast.error("Selecione um cargo para o usuário");
      return;
    }

    const selectedModules = cargo === "administrador" 
      ? ["estoque_farmacia", "farmacia_satelite", "responsavel_tecnico", "carrinho_parada", "carrinho_enfermagem", "carrinho_farmacia"]
      : cargo === "enfermeiro"
        ? ["carrinho_enfermagem", "carrinho_parada"]
        : ["estoque_farmacia", "farmacia_satelite", "carrinho_farmacia", "carrinho_parada"];

    if (editingId) {
      // update
      const updated = users.map(u => {
        if (u.id === editingId) {
          const passChanged = u.password !== password;
          return {
            ...u, nome, username, password, cargo, modules: selectedModules,
            first_login: passChanged ? true : u.first_login
          };
        }
        return u;
      });
      saveUsers(updated);
      toast.success("Usuário atualizado com sucesso!");
    } else {
      // create
      const exists = users.find(u => u.username === username);
      if (exists) {
        toast.error("Nome de usuário já existe!");
        return;
      }
      const newUser = {
        id: Date.now().toString(),
        nome,
        username,
        password,
        cargo,
        modules: selectedModules,
        first_login: true
      };
      saveUsers([...users, newUser]);
      toast.success("Usuário cadastrado com sucesso! No primeiro acesso ele precisará mudar a senha.");
    }
    
    resetForm();
    setShowForm(false);
  };

  const resetForm = () => {
    setEditingId(null);
    setNome("");
    setUsername("");
    setPassword("");
    setCargo("farmaceutico");
  };

  const handleEdit = (u) => {
    setEditingId(u.id);
    setNome(u.nome);
    setUsername(u.username);
    setPassword(u.password);
    setCargo(u.cargo || (u.modules.includes("responsavel_tecnico") ? "administrador" : "farmaceutico"));
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (confirm("Tem certeza que deseja remover este usuário?")) {
      saveUsers(users.filter(u => u.id !== id));
      toast.success("Usuário removido");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-blue-600" />
            Painel do Responsável Técnico (RT)
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Gestão técnica da farmácia e administração de usuários do sistema.
          </p>
        </div>
        
        {activeTab === "usuarios" && (
          <button
            onClick={() => {
              if (showForm) resetForm();
              setShowForm(!showForm);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-blue-600/20 font-medium"
          >
            <UserPlus className="w-4 h-4" />
            {showForm ? "Voltar ao Painel" : "Cadastrar Usuário"}
          </button>
        )}
      </div>

      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button 
          onClick={() => {setActiveTab("usuarios"); setShowForm(false);}} 
          className={`font-medium pb-2 ${activeTab === 'usuarios' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
        >
          Usuários Cadastrados
        </button>
        <button 
          onClick={() => {setActiveTab("auditoria"); setLogs(getLogs()); setShowForm(false);}} 
          className={`font-medium pb-2 ${activeTab === 'auditoria' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
        >
          Auditoria e Logs
        </button>
      </div>

      {activeTab === "auditoria" ? (
        <div className="space-y-4">
          <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
            <button
              onClick={() => setAuditSubTab("exclusoes")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                auditSubTab === "exclusoes" 
                  ? "bg-white dark:bg-slate-900 text-blue-600 shadow-sm" 
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Logs de Exclusões & Altas Hospitalares ({dbAuditLogs.length})
            </button>
            <button
              onClick={() => setAuditSubTab("acessos")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                auditSubTab === "acessos" 
                  ? "bg-white dark:bg-slate-900 text-blue-600 shadow-sm" 
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <History className="w-4 h-4 text-blue-500" />
              Acessos e Atividades do Sistema ({logs.length})
            </button>
          </div>

          {auditSubTab === "exclusoes" ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-amber-500/5">
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-amber-600" />
                    Registros de Auditoria Técnica RT (Exclusões Declaradas & Altas)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Histórico imutável de itens removidos (com motivo declarado) e movimentações de alta hospitalar.
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300">
                    <tr>
                      <th className="px-4 py-3 font-medium">Data/Hora</th>
                      <th className="px-4 py-3 font-medium">Registro / Evento</th>
                      <th className="px-4 py-3 font-medium">Motivo Auditado</th>
                      <th className="px-4 py-3 font-medium">Observações Gerais</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {dbAuditLogs.map(log => {
                      const isAlta = log.medicamento_nome?.includes("[LOG ALTA]");
                      return (
                        <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-4 py-3 text-xs whitespace-nowrap font-mono text-slate-500">
                            {log.created_at ? new Date(log.created_at).toLocaleString('pt-BR') : (log.data_saida || "-")}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100 text-xs">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs ${
                              isAlta 
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' 
                                : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                            }`}>
                              {isAlta ? <FileCheck className="w-3.5 h-3.5" /> : <Trash className="w-3.5 h-3.5" />}
                              {log.medicamento_nome}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs font-medium text-slate-700 dark:text-slate-300">
                            {log.motivo || "-"}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">
                            {log.observacao || "-"}
                          </td>
                        </tr>
                      );
                    })}
                    {dbAuditLogs.length === 0 && (
                      <tr>
                        <td colSpan="4" className="text-center py-8 text-slate-500">
                          Nenhum registro de exclusão auditada ou alta hospitalar gravado no momento.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <History className="w-5 h-5 text-blue-600" />
                  Histórico de Acessos e Ações de Usuários
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300">
                    <tr>
                      <th className="px-4 py-3 font-medium">Data/Hora</th>
                      <th className="px-4 py-3 font-medium">Usuário</th>
                      <th className="px-4 py-3 font-medium">Ação</th>
                      <th className="px-4 py-3 font-medium">Detalhes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {logs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{log.user}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs dark:bg-blue-900/30 dark:text-blue-300">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">{log.details}</td>
                      </tr>
                    ))}
                    {logs.length === 0 && (
                      <tr>
                        <td colSpan="4" className="text-center py-6 text-slate-500">Nenhum log de acesso registrado ainda.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : showForm ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
            {editingId ? "Editar Usuário" : "Novo Usuário do Sistema"}
          </h2>
          <form className="max-w-2xl space-y-5" onSubmit={handleSave}>
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nome Completo</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Users className="h-4 w-4 text-slate-400" />
                  </div>
                  <input required value={nome} onChange={e=>setNome(e.target.value)} type="text" className="pl-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-sm outline-none focus:border-blue-500 transition-colors" placeholder="Ex: João Silva" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Usuário de Login</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Users className="h-4 w-4 text-slate-400" />
                  </div>
                  <input required value={username} onChange={e=>setUsername(e.target.value)} type="text" className="pl-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-sm outline-none focus:border-blue-500 transition-colors" placeholder="joao.silva" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Senha</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Key className="h-4 w-4 text-slate-400" />
                  </div>
                  <input required value={password} onChange={e=>setPassword(e.target.value)} type="text" className="pl-10 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-sm outline-none focus:border-blue-500 transition-colors" placeholder="••••••••" />
                </div>
                <p className="text-xs text-slate-500">
                  {editingId ? "Alterar a senha forçará o usuário a trocá-la no próximo acesso." : "O usuário precisará alterar esta senha no primeiro acesso."}
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-4">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cargo e Acesso</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-xl flex-1 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <input 
                    type="radio" 
                    name="cargo"
                    checked={cargo === "administrador"} 
                    onChange={() => setCargo("administrador")} 
                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-600" 
                  />
                  <div>
                    <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">Administrador (RT)</span>
                    <span className="block text-xs text-slate-500">Acesso total ao sistema e configurações</span>
                  </div>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-xl flex-1 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <input 
                    type="radio" 
                    name="cargo"
                    checked={cargo === "farmaceutico"} 
                    onChange={() => setCargo("farmaceutico")} 
                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-600" 
                  />
                  <div>
                    <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">Farmacêutico</span>
                    <span className="block text-xs text-slate-500">Estoque, Farmácia Satélite e Carrinho de Parada</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 cursor-pointer p-3 border rounded-xl flex-1 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <input 
                    type="radio" 
                    name="cargo"
                    checked={cargo === "enfermeiro"} 
                    onChange={() => setCargo("enfermeiro")} 
                    className="w-4 h-4 text-blue-600 border-slate-300 focus:ring-blue-600" 
                  />
                  <div>
                    <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">Enfermeiro</span>
                    <span className="block text-xs text-slate-500">Apenas Carrinho de Parada (Enfermagem)</span>
                  </div>
                </label>
              </div>
            </div>
            
            <div className="pt-4 flex justify-end gap-3">
              <button type="button" onClick={() => {resetForm(); setShowForm(false)}} className="px-6 py-2.5 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors">
                Cancelar
              </button>
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors shadow-lg shadow-blue-600/20">
                Salvar Usuário
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Usuários Cadastrados</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Usuário</th>
                  <th className="px-4 py-3 font-medium">Cargo</th>
                  <th className="px-4 py-3 font-medium text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{u.nome}</td>
                    <td className="px-4 py-3">{u.username}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        (u.cargo === 'administrador' || u.modules.includes('responsavel_tecnico')) 
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' 
                          : u.cargo === 'enfermeiro'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      }`}>
                        {(u.cargo === 'administrador' || u.modules.includes('responsavel_tecnico')) 
                          ? 'Administrador (RT)' 
                          : u.cargo === 'enfermeiro' 
                            ? 'Enfermeiro' 
                            : 'Farmacêutico'}
                      </span>
                    </td>
                    <td className="px-4 py-3 flex justify-center gap-2">
                      <button onClick={() => handleEdit(u)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Editar / Resetar Senha">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(u.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Remover">
                        <Trash className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan="4" className="text-center py-6 text-slate-500">Nenhum usuário cadastrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
