import { useState, useEffect, useMemo } from "react";
import { Users, UserPlus, ShieldCheck, Key, Edit, Trash, History, AlertTriangle, FileCheck } from "lucide-react";
import { toast } from "sonner";
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
  const [coren, setCoren] = useState("");
  const [crf, setCrf] = useState("");
  const [selectedUserModules, setSelectedUserModules] = useState(["estoque_farmacia", "farmacia_satelite", "carrinho_parada"]);

  const AVAILABLE_MODULES = [
    { id: "estoque_farmacia", name: "Estoque Central" },
    { id: "farmacia_satelite", name: "Farmácia Satélite" },
    { id: "carrinho_parada", name: "Carrinho de Parada" },
    { id: "responsavel_tecnico", name: "Responsável Técnico" }
  ];

  const carregarUsuarios = async () => {
    try {
      const data = await db.entities.Usuario.list();
      setUsers(data);
      // Mapear também para o localStorage por retrocompatibilidade com telas que ainda não migraram
      const localUsers = data.map(u => ({
          id: u.id,
          nome: u.nome,
          username: u.login,
          password: u.senha,
          cargo: u.perfil,
          coren: u.coren,
          crf: u.crf,
          // Convertendo módulos de volta para array que o WelcomeScreen usa. 
          // O DB não armazena array diretamente, poderíamos salvar na tabela Usuario uma coluna módulos.
          // Mas como adaptamos a tabela Usuario agora, os perfis já definem o que eles podem fazer.
          // Para não quebrar o WelcomeScreen:
          modules: u.perfil === "administrador" ? AVAILABLE_MODULES.map(m => m.id) : 
                   u.perfil === "farmaceutico" ? ["estoque_farmacia", "farmacia_satelite", "carrinho_parada"] : 
                   ["carrinho_parada", "carrinho_enfermagem"],
          first_login: u.primeiro_acesso !== false
      }));
      localStorage.setItem("axion_users", JSON.stringify(localUsers));
    } catch (e) {
      console.error("Erro ao carregar usuários do PG", e);
    }
  };

  useEffect(() => {
    carregarUsuarios();
    
    // Load logs
    setLogs(getLogs());
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!username || !password || !nome) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    if (!cargo) {
      toast.error("Selecione um cargo para o usuário");
      return;
    }
    if (cargo === 'farmaceutico' && !crf) {
      toast.error("CRF é obrigatório para Farmacêuticos");
      return;
    }
    if (cargo === 'enfermeiro' && !coren) {
      toast.error("COREN é obrigatório para Enfermeiros");
      return;
    }

    if (selectedUserModules.length === 0) {
      toast.error("Selecione pelo menos um módulo de acesso para este usuário.");
      return;
    }

    try {
      if (editingId) {
        // update
        await db.entities.Usuario.update(editingId, {
           nome,
           login: username,
           senha: password,
           perfil: cargo,
           coren: cargo === 'enfermeiro' ? coren : "",
           crf: cargo !== 'enfermeiro' ? crf : "",
           primeiro_acesso: true
        });
        toast.success("Usuário atualizado com sucesso no banco de dados!");
      } else {
        // create
        const data = await db.entities.Usuario.list();
        const exists = data.find(u => u.login === username);
        if (exists) {
          toast.error("Nome de usuário (login) já existe no banco!");
          return;
        }
        await db.entities.Usuario.create({
           nome,
           login: username,
           senha: password,
           perfil: cargo,
           coren: cargo === 'enfermeiro' ? coren : "",
           crf: cargo !== 'enfermeiro' ? crf : "",
           primeiro_acesso: true
        });
        toast.success("Usuário cadastrado no Postgres com sucesso!");
      }
      
      resetForm();
      setShowForm(false);
      carregarUsuarios();
    } catch (error) {
      toast.error("Falha ao salvar no Postgres: " + error.message);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setNome("");
    setUsername("");
    setPassword("");
    setCoren("");
    setCrf("");
    setCargo("farmaceutico");
    setSelectedUserModules(["estoque_farmacia", "farmacia_satelite", "carrinho_parada"]);
  };

  const handleEdit = (u) => {
    setEditingId(u.id);
    setNome(u.nome);
    setUsername(u.login || u.username);
    setPassword(u.senha || u.password);
    setCoren(u.coren || "");
    setCrf(u.crf || "");
    setCargo(u.perfil || u.cargo || "farmaceutico");
    // Simulando modulos selecionados baseados no perfil
    const defaultModules = u.perfil === "administrador" ? AVAILABLE_MODULES.map(m => m.id) : 
             u.perfil === "farmaceutico" ? ["estoque_farmacia", "farmacia_satelite", "carrinho_parada"] : 
             ["carrinho_parada"];
    setSelectedUserModules(defaultModules);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (confirm("Tem certeza que deseja remover este usuário do banco de dados?")) {
      try {
        await db.entities.Usuario.delete(id);
        toast.success("Usuário removido do Postgres");
        carregarUsuarios();
      } catch (error) {
         toast.error("Erro ao deletar: " + error.message);
      }
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

            {/* Inputs Condicionais de CRF ou COREN */}
            <div className="grid grid-cols-2 gap-5 pt-2">
              {(cargo === 'farmaceutico' || cargo === 'administrador') && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">CRF {cargo === 'farmaceutico' && '*'}</label>
                  <input value={crf} onChange={e=>setCrf(e.target.value)} type="text" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-sm outline-none focus:border-blue-500 transition-colors" placeholder="Ex: 12345/SP" required={cargo === 'farmaceutico'} />
                </div>
              )}
              {cargo === 'enfermeiro' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">COREN *</label>
                  <input value={coren} onChange={e=>setCoren(e.target.value)} type="text" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-sm outline-none focus:border-blue-500 transition-colors" placeholder="Ex: 123456-SP" required />
                </div>
              )}
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Módulos de Acesso Permitidos</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {AVAILABLE_MODULES.map(module => (
                  <label key={module.id} className={`flex items-center gap-2 cursor-pointer p-3 border rounded-xl transition-colors ${selectedUserModules.includes(module.id) ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-500' : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    <input 
                      type="checkbox"
                      checked={selectedUserModules.includes(module.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedUserModules([...selectedUserModules, module.id]);
                        } else {
                          setSelectedUserModules(selectedUserModules.filter(m => m !== module.id));
                        }
                      }}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-600"
                    />
                    <span className={`text-sm font-medium ${selectedUserModules.includes(module.id) ? 'text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300'}`}>
                      {module.name}
                    </span>
                  </label>
                ))}
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
                  <th className="px-4 py-3 font-medium">Registro (CRF/COREN)</th>
                  <th className="px-4 py-3 font-medium">Cargo</th>
                  <th className="px-4 py-3 font-medium text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{u.nome}</td>
                    <td className="px-4 py-3">{u.login || u.username}</td>
                    <td className="px-4 py-3 font-mono text-xs">{u.crf || u.coren || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        (u.perfil === 'administrador' || u.cargo === 'administrador') 
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' 
                          : (u.perfil === 'enfermeiro' || u.cargo === 'enfermeiro')
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                      }`}>
                        {(u.perfil === 'administrador' || u.cargo === 'administrador') 
                          ? 'Administrador (RT)' 
                          : (u.perfil === 'enfermeiro' || u.cargo === 'enfermeiro') 
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

      {/* ZONA DE PERIGO */}
      <div className="pt-8 mt-12 border-t border-red-200 dark:border-red-900/50">
        <div className="bg-red-50 dark:bg-red-900/10 rounded-2xl p-6 border border-red-200 dark:border-red-900/50">
          <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
            <div>
              <h3 className="text-red-700 dark:text-red-400 font-bold text-lg flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Zona de Perigo (Hard Reset)
              </h3>
              <p className="text-red-600/80 dark:text-red-400/80 text-sm mt-1">
                Zerar completamente o banco de dados. Apaga todos os Medicamentos, Lotes, Entradas, Saídas, Movimentações e Pedidos.
                (Usuários e Configurações não são apagados).
              </p>
            </div>
            <button
              onClick={async () => {
                if (window.prompt("TEM CERTEZA ABSOLUTA? ISSO APAGARÁ TODOS OS MEDICAMENTOS E ESTOQUES!\n\nESCREVA 'SIM' PARA CONTINUAR:") !== "SIM") {
                  return;
                }
                try {
                  const { invoke } = await import('@tauri-apps/api/core');
                  const ip = localStorage.getItem("pg_ip") || "localhost";
                  const dbName = localStorage.getItem("pg_db");
                  const password = localStorage.getItem("pg_pass");
                  if (!ip || !dbName) {
                    toast.error("Banco não configurado.");
                    return;
                  }
                  const query = `TRUNCATE TABLE "Medicamento", "Lote", "Entrada", "Saida", "Emprestimo", "InventarioItem", "TransferenciaPendente", "PedidoSatelite", "CarrinhoPadronizacao", "CarrinhoEstoqueCentral", "CarrinhoEstoqueFisico", "CarrinhoMovimentacao", "PrescricaoPaciente" CASCADE;`;
                  await invoke("execute_postgres", { ip, dbName, password, query });
                  toast.success("BANCO DE DADOS FOI ZERADO COM SUCESSO!");
                  setTimeout(() => window.location.reload(), 2000);
                } catch (e) {
                  toast.error("Erro ao zerar: " + e);
                }
              }}
              className="whitespace-nowrap bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-red-600/20 transition-all"
            >
              Zerar Banco de Dados de Medicamentos
            </button>
          </div>
          
          <div className="flex flex-col md:flex-row gap-6 items-center justify-between mt-6 pt-6 border-t border-indigo-200 dark:border-indigo-900/50">
             <div>
               <h3 className="text-indigo-700 dark:text-indigo-400 font-bold text-lg flex items-center gap-2">
                 Inserir Medicamentos Padrão (Por Script)
               </h3>
               <p className="text-indigo-600/80 dark:text-indigo-400/80 text-sm mt-1">
                 Clique para inserir automaticamente os medicamentos padrões iniciais no banco de dados, incluindo Acetilcisteína.
               </p>
             </div>
             <button
               onClick={async () => {
                 try {
                    const defaultMeds = [
                        { id: crypto.randomUUID(), nome: "ACETILCISTEINA", codigo: "5/6", concentracao: "120 MG/G", apresentacao: "SACHE 5G", via_administracao: "ORAL", grupo_terapeutico: "CLÍNICOS - MUCOLÍTICO", forma_farmaceutica: "Sólida", estoque_minimo: 0, estoque_atual: 0, padronizado: true, is_mav: false, created_at: new Date().toISOString() },
                        { id: crypto.randomUUID(), nome: "DIPIRONA SÓDICA", codigo: "MED002", concentracao: "500 MG/ML", apresentacao: "AMPOLA", via_administracao: "IV", grupo_terapeutico: "CLÍNICOS - ANALGÉSICO, ANTITERMICO", forma_farmaceutica: "Líquida", estoque_minimo: 10, estoque_atual: 0, padronizado: true, is_mav: false, created_at: new Date().toISOString() },
                        { id: crypto.randomUUID(), nome: "PARACETAMOL", codigo: "MED003", concentracao: "750 MG", apresentacao: "COMPRIMIDO", via_administracao: "ORAL", grupo_terapeutico: "CLÍNICOS - ANALGÉSICO, ANTITERMICO", forma_farmaceutica: "Sólida", estoque_minimo: 10, estoque_atual: 0, padronizado: true, is_mav: false, created_at: new Date().toISOString() },
                        { id: crypto.randomUUID(), nome: "AMOXICILINA", codigo: "MED004", concentracao: "500 MG", apresentacao: "CÁPSULA", via_administracao: "ORAL", grupo_terapeutico: "CLÍNICOS - ANTIBIÓTICO / ANTIBACTERIANO", forma_farmaceutica: "Sólida", estoque_minimo: 5, estoque_atual: 0, padronizado: true, is_mav: false, created_at: new Date().toISOString() },
                        { id: crypto.randomUUID(), nome: "OMEPRAZOL", codigo: "MED005", concentracao: "40 MG", apresentacao: "AMPOLA", via_administracao: "IV", grupo_terapeutico: "CLÍNICOS - ANTIULCEROSO", forma_farmaceutica: "Líquida", estoque_minimo: 5, estoque_atual: 0, padronizado: true, is_mav: false, created_at: new Date().toISOString() },
                        { id: crypto.randomUUID(), nome: "CEFTRIAXONA", codigo: "MED006", concentracao: "1 G", apresentacao: "FRASCO", via_administracao: "IV", grupo_terapeutico: "CLÍNICOS - ANTIBIÓTICO / ANTIBACTERIANO", forma_farmaceutica: "Líquida", estoque_minimo: 5, estoque_atual: 0, padronizado: true, is_mav: false, created_at: new Date().toISOString() },
                        { id: crypto.randomUUID(), nome: "ADRENALINA", codigo: "MED007", concentracao: "1 MG/ML", apresentacao: "AMPOLA", via_administracao: "IV", grupo_terapeutico: "CLÍNICOS - CARDIOTÔNICO", forma_farmaceutica: "Líquida", estoque_minimo: 5, estoque_atual: 0, padronizado: true, is_mav: true, created_at: new Date().toISOString() },
                        { id: crypto.randomUUID(), nome: "DIAZEPAM", codigo: "MED008", concentracao: "10 MG", apresentacao: "AMPOLA", via_administracao: "IV", grupo_terapeutico: "PSICOTRÓPICOS - ANSIOLITICO, SEDATIVO", forma_farmaceutica: "Líquida", estoque_minimo: 5, estoque_atual: 0, padronizado: true, is_mav: true, portaria_344: true, created_at: new Date().toISOString() }
                    ];
                    let count = 0;
                    for (const med of defaultMeds) {
                        try {
                           const exists = await db.entities.Medicamento.list();
                           if (!exists.find(m => m.nome === med.nome)) {
                               await db.entities.Medicamento.create(med);
                               count++;
                           }
                        } catch (e) { console.error(e); }
                    }
                    toast.success(`${count} Medicamentos foram inseridos pelo script com sucesso!`);
                 } catch (e) {
                    toast.error("Erro ao inserir via script: " + e.message);
                 }
               }}
               className="whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-3 rounded-xl shadow-lg shadow-indigo-600/20 transition-all"
             >
               Rodar Script de Inserção
             </button>
          </div>

        </div>
      </div>

    </div>
  );
}
