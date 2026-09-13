import { useState, useEffect, useMemo } from "react";
import { Users, UserPlus, ShieldCheck, Key, Edit, Trash, History, AlertTriangle, FileCheck, Search, Download, Printer, Filter, CheckCircle2, RefreshCw, FileText, Building2, Pill, Stethoscope, BadgeCheck, Eye, EyeOff, Lock, Sparkles, HeartHandshake } from "lucide-react";
import { toast } from "sonner";
import { getLogs } from "../lib/logger";
import { db } from "@/api/db";
import { useQuery } from "@tanstack/react-query";

export default function ResponsavelTecnico() {
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState("usuarios"); // 'usuarios' | 'auditoria'
  const [auditSubTab, setAuditSubTab] = useState("trilha"); // 'trilha' | 'exclusoes' | 'acessos'
  const [auditAcaoFilter, setAuditAcaoFilter] = useState("TODAS");
  const [auditPeriodoFilter, setAuditPeriodoFilter] = useState("todos");
  const [auditSearchQuery, setAuditSearchQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);

  const { data: acoesAuditoria = [] } = useQuery({
    queryKey: ['auditoria_trilha'],
    queryFn: () => db.entities.Auditoria.list('-created_at'),
    refetchInterval: 5000
  });

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

  const filteredAuditAcoes = useMemo(() => {
    let list = acoesAuditoria || [];
    const now = new Date();

    if (auditPeriodoFilter === "hoje") {
      const todayStr = now.toISOString().split("T")[0];
      list = list.filter(a => (a.data_hora || a.created_at || "").startsWith(todayStr));
    } else if (auditPeriodoFilter === "7dias") {
      const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime();
      list = list.filter(a => {
        const t = new Date(a.data_hora || a.created_at || 0).getTime();
        return t >= cutoff;
      });
    } else if (auditPeriodoFilter === "30dias") {
      const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).getTime();
      list = list.filter(a => {
        const t = new Date(a.data_hora || a.created_at || 0).getTime();
        return t >= cutoff;
      });
    }

    if (auditAcaoFilter !== "TODAS") {
      list = list.filter(a => a.acao === auditAcaoFilter || (a.acao || "").includes(auditAcaoFilter));
    }

    if (auditSearchQuery.trim()) {
      const q = auditSearchQuery.toLowerCase();
      list = list.filter(a => 
        (a.usuario || "").toLowerCase().includes(q) ||
        (a.acao || "").toLowerCase().includes(q) ||
        (a.entidade || "").toLowerCase().includes(q) ||
        (a.detalhes || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [acoesAuditoria, auditAcaoFilter, auditPeriodoFilter, auditSearchQuery]);

  const handleExportAuditCSV = () => {
    if (filteredAuditAcoes.length === 0) {
      toast.error("Nenhum registro para exportar.");
      return;
    }
    const headers = ["Data/Hora", "Usuario", "Acao", "Entidade", "Detalhes"];
    const rows = filteredAuditAcoes.map(a => [
      `"${a.data_hora || a.created_at || ''}"`,
      `"${a.usuario || ''}"`,
      `"${a.acao || ''}"`,
      `"${a.entidade || ''}"`,
      `"${(a.detalhes || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `trilha_auditoria_rt_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Trilha de auditoria exportada com sucesso em CSV!");
  };
  
  // form state
  const [editingId, setEditingId] = useState(null);
  const [nome, setNome] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [cargo, setCargo] = useState("farmaceutico");
  const [coren, setCoren] = useState("");
  const [crf, setCrf] = useState("");
  const [matricula, setMatricula] = useState("");
  const [selectedUserModules, setSelectedUserModules] = useState(["estoque_farmacia", "farmacia_satelite", "pacientes_medicao", "carrinho_parada"]);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userCargoFilter, setUserCargoFilter] = useState("todos");

  const AVAILABLE_MODULES = [
    { id: "estoque_farmacia", name: "Estoque Central", desc: "Entradas, saídas e lotes" },
    { id: "farmacia_satelite", name: "Farmácia Satélite", desc: "Pedidos e distribuição de medicamentos" },
    { id: "pacientes_medicao", name: "Pacientes & Prescrições", desc: "Prontuários e aprazamento" },
    { id: "recepcao", name: "Recepção & Admissão", desc: "Cadastro de pacientes e leitos" },
    { id: "carrinho_parada", name: "Carrinho de Parada", desc: "Kits de emergência e lacres" },
    { id: "responsavel_tecnico", name: "Responsável Técnico", desc: "Gestão RT e auditoria" }
  ];

  const carregarUsuarios = async () => {
    try {
      const data = await db.entities.Usuario.list();
      setUsers(data);
      // Mapear também para o localStorage por retrocompatibilidade
      const localUsers = data.map(u => ({
          id: u.id,
          nome: u.nome,
          username: u.login,
          password: u.senha,
          cargo: u.perfil,
          coren: u.coren,
          crf: u.crf,
          modules: (u.perfil === "administrador" || u.cargo === "administrador") ? AVAILABLE_MODULES.map(m => m.id) : 
                   (u.perfil === "farmaceutico" || u.cargo === "farmaceutico") ? ["estoque_farmacia", "farmacia_satelite", "pacientes_medicao", "carrinho_parada"] : 
                   (u.perfil === "recepcionista" || u.cargo === "recepcionista") ? ["recepcao", "pacientes_medicao"] :
                   ["carrinho_parada", "carrinho_enfermagem", "pacientes_medicao"],
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

  const handleCargoChange = (newCargo) => {
    setCargo(newCargo);
    if (newCargo === "administrador") {
      setSelectedUserModules(AVAILABLE_MODULES.map(m => m.id));
    } else if (newCargo === "farmaceutico") {
      setSelectedUserModules(["estoque_farmacia", "farmacia_satelite", "pacientes_medicao", "carrinho_parada"]);
    } else if (newCargo === "enfermeiro") {
      setSelectedUserModules(["carrinho_parada", "pacientes_medicao"]);
    } else if (newCargo === "recepcionista") {
      setSelectedUserModules(["recepcao", "pacientes_medicao"]);
    }
  };

  const userStats = useMemo(() => {
    const total = users.length;
    const admin = users.filter(u => u.perfil === "administrador" || u.cargo === "administrador").length;
    const farma = users.filter(u => u.perfil === "farmaceutico" || u.cargo === "farmaceutico").length;
    const enf = users.filter(u => u.perfil === "enfermeiro" || u.cargo === "enfermeiro").length;
    const recep = users.filter(u => u.perfil === "recepcionista" || u.cargo === "recepcionista").length;
    return { total, admin, farma, enf, recep };
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const role = u.perfil || u.cargo || "farmaceutico";
      if (userCargoFilter !== "todos" && role !== userCargoFilter) {
        return false;
      }
      if (userSearchQuery.trim()) {
        const q = userSearchQuery.toLowerCase();
        const nomeMatch = (u.nome || "").toLowerCase().includes(q);
        const loginMatch = (u.login || u.username || "").toLowerCase().includes(q);
        const regMatch = (u.crf || u.coren || "").toLowerCase().includes(q);
        if (!nomeMatch && !loginMatch && !regMatch) return false;
      }
      return true;
    });
  }, [users, userCargoFilter, userSearchQuery]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!username || !password || !nome) {
      toast.error("Preencha todos os campos obrigatórios (Nome, Login e Senha)");
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
      toast.error("Selecione pelo menos um módulo de acesso para este colaborador.");
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
           crf: (cargo === 'farmaceutico' || cargo === 'administrador') ? crf : "",
           primeiro_acesso: true
        });
        toast.success("Colaborador atualizado com sucesso no banco de dados!");
      } else {
        // create
        const data = await db.entities.Usuario.list();
        const exists = data.find(u => u.login === username);
        if (exists) {
          toast.error("Nome de usuário (login) já cadastrado!");
          return;
        }
        await db.entities.Usuario.create({
           nome,
           login: username,
           senha: password,
           perfil: cargo,
           coren: cargo === 'enfermeiro' ? coren : "",
           crf: (cargo === 'farmaceutico' || cargo === 'administrador') ? crf : "",
           primeiro_acesso: true
        });
        toast.success("Colaborador cadastrado no Postgres com sucesso!");
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
    setShowPassword(false);
    setCoren("");
    setCrf("");
    setMatricula("");
    setCargo("recepcionista");
    setSelectedUserModules(["recepcao", "pacientes_medicao"]);
  };

  const handleEdit = (u) => {
    setEditingId(u.id);
    setNome(u.nome);
    setUsername(u.login || u.username);
    setPassword(u.senha || u.password);
    setShowPassword(false);
    setCoren(u.coren || "");
    setCrf(u.crf || "");
    const userRole = u.perfil || u.cargo || "farmaceutico";
    setCargo(userRole);
    
    const defaultModules = (userRole === "administrador") ? AVAILABLE_MODULES.map(m => m.id) : 
             (userRole === "farmaceutico") ? ["estoque_farmacia", "farmacia_satelite", "pacientes_medicao", "carrinho_parada"] : 
             (userRole === "recepcionista") ? ["recepcao", "pacientes_medicao"] :
             ["carrinho_parada", "pacientes_medicao"];
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
          <div className="flex flex-wrap gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
            <button
              onClick={() => setAuditSubTab("trilha")}
              className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
                auditSubTab === "trilha" 
                  ? "bg-white dark:bg-slate-900 text-blue-600 shadow-sm" 
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              Trilha de Auditoria Geral ({acoesAuditoria.length})
            </button>
            <button
              onClick={() => setAuditSubTab("exclusoes")}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                auditSubTab === "exclusoes" 
                  ? "bg-white dark:bg-slate-900 text-blue-600 shadow-sm" 
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Logs de Exclusões & Altas ({dbAuditLogs.length})
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

          {auditSubTab === "trilha" ? (
            <div className="space-y-4">
              {/* Filtros e Ações */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 no-print">
                <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
                  <div className="flex-1 w-full relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Buscar por usuário, ação, medicamento, paciente ou detalhes..."
                      value={auditSearchQuery}
                      onChange={e => setAuditSearchQuery(e.target.value)}
                      className="pl-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs outline-none focus:border-blue-500 transition-colors"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <select
                      value={auditAcaoFilter}
                      onChange={e => setAuditAcaoFilter(e.target.value)}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none"
                    >
                      <option value="TODAS">Todas as Ações Críticas</option>
                      <option value="ALTERACAO_LOTE_VALIDADE">Alteração de Lote / Validade</option>
                      <option value="BAIXA_MANUAL_ESTOQUE">Baixa Manual de Estoque</option>
                      <option value="PERDA_REGISTRADA_344">Perda Portaria 344</option>
                      <option value="EXCLUSAO_LOTE">Exclusão de Lote</option>
                      <option value="ALTA_PACIENTE">Alta de Paciente</option>
                      <option value="TRANSFERENCIA_ALA">Transferência de Ala (X → Y)</option>
                      <option value="PRESCRICAO">Prescrições (Criação/Alteração/Suspensão)</option>
                      <option value="CRIACAO_PEDIDO_URGENTE">Pedidos Urgentes Satélite</option>
                      <option value="TRANSFERENCIA_ESTOQUE">Transferências Internas</option>
                    </select>

                    <select
                      value={auditPeriodoFilter}
                      onChange={e => setAuditPeriodoFilter(e.target.value)}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none"
                    >
                      <option value="todos">Todo o Período</option>
                      <option value="hoje">Apenas Hoje</option>
                      <option value="7dias">Últimos 7 dias</option>
                      <option value="30dias">Últimos 30 dias</option>
                    </select>

                    <button
                      onClick={handleExportAuditCSV}
                      className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                      title="Exportar registros filtrados para CSV"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Exportar CSV
                    </button>

                    <button
                      onClick={() => window.print()}
                      className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
                      title="Imprimir relatório de auditoria"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Imprimir
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span>Exibindo <strong>{filteredAuditAcoes.length}</strong> de <strong>{acoesAuditoria.length}</strong> eventos registrados.</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">Trilha Criptografada e Imutável</span>
                </div>
              </div>

              {/* Tabela da Trilha */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-4 py-3 font-bold w-40">Data / Hora</th>
                        <th className="px-4 py-3 font-bold w-44">Usuário</th>
                        <th className="px-4 py-3 font-bold w-52">Ação Auditada</th>
                        <th className="px-4 py-3 font-bold w-32">Entidade</th>
                        <th className="px-4 py-3 font-bold">Detalhes do Evento</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                      {filteredAuditAcoes.map((item) => {
                        const isDanger = item.acao?.includes("EXCLUSAO") || item.acao?.includes("PERDA") || item.acao?.includes("URGENTE");
                        const isWarning = item.acao?.includes("ALTERACAO") || item.acao?.includes("SUSPENSAO") || item.acao?.includes("BAIXA");
                        const isInfo = !isDanger && !isWarning;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3 font-mono text-slate-500 whitespace-nowrap">
                              {item.data_hora || item.created_at ? new Date(item.data_hora || item.created_at).toLocaleString('pt-BR') : "-"}
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">
                              {item.usuario || "Administrador"}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-bold text-[10px] tracking-wide uppercase ${
                                isDanger
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                                  : isWarning
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                    : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                              }`}>
                                {item.acao?.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-400">
                              {item.entidade || "-"}
                            </td>
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium break-words leading-relaxed">
                              {item.detalhes || "-"}
                            </td>
                          </tr>
                        );
                      })}

                      {filteredAuditAcoes.length === 0 && (
                        <tr>
                          <td colSpan={5} className="text-center py-12 text-slate-400 italic">
                            Nenhum registro de auditoria encontrado com os filtros selecionados.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : auditSubTab === "exclusoes" ? (
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
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200/80 dark:border-slate-800 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold mb-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                {editingId ? "Atualização Cadastral" : "Novo Credenciamento"}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
                {editingId ? "Editar Colaborador / Usuário" : "Cadastrar Colaborador do Hospital"}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Configure os dados de acesso, cargo hospitalar e os módulos liberados.
              </p>
            </div>
            
            <button
              type="button"
              onClick={() => { resetForm(); setShowForm(false); }}
              className="text-xs font-semibold px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Voltar à Lista
            </button>
          </div>

          <form className="space-y-6 max-w-4xl" onSubmit={handleSave}>
            {/* 1. Escolha do Cargo */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                1. Selecione o Cargo / Perfil de Acesso *
              </label>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Administrador */}
                <button
                  type="button"
                  onClick={() => handleCargoChange("administrador")}
                  className={`p-4 rounded-2xl text-left border-2 transition-all flex flex-col justify-between space-y-3 ${
                    cargo === "administrador"
                      ? "border-purple-500 bg-purple-50/60 dark:bg-purple-950/30 shadow-md ring-2 ring-purple-400/20"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`p-2.5 rounded-xl ${cargo === "administrador" ? "bg-purple-600 text-white" : "bg-purple-100 text-purple-700 dark:bg-purple-900/40"}`}>
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    {cargo === "administrador" && (
                      <CheckCircle2 className="w-5 h-5 text-purple-600" />
                    )}
                  </div>
                  <div>
                    <span className="block font-bold text-sm text-slate-900 dark:text-slate-100">Administrador (RT)</span>
                    <span className="block text-[11px] text-slate-500 mt-1 leading-snug">
                      Acesso total, configurações do sistema e auditoria.
                    </span>
                  </div>
                </button>

                {/* Farmacêutico */}
                <button
                  type="button"
                  onClick={() => handleCargoChange("farmaceutico")}
                  className={`p-4 rounded-2xl text-left border-2 transition-all flex flex-col justify-between space-y-3 ${
                    cargo === "farmaceutico"
                      ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 shadow-md ring-2 ring-emerald-400/20"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`p-2.5 rounded-xl ${cargo === "farmaceutico" ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40"}`}>
                      <Pill className="w-5 h-5" />
                    </div>
                    {cargo === "farmaceutico" && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    )}
                  </div>
                  <div>
                    <span className="block font-bold text-sm text-slate-900 dark:text-slate-100">Farmacêutico</span>
                    <span className="block text-[11px] text-slate-500 mt-1 leading-snug">
                      Estoque central, farmácia satélite e dispensação.
                    </span>
                  </div>
                </button>

                {/* Enfermeiro */}
                <button
                  type="button"
                  onClick={() => handleCargoChange("enfermeiro")}
                  className={`p-4 rounded-2xl text-left border-2 transition-all flex flex-col justify-between space-y-3 ${
                    cargo === "enfermeiro"
                      ? "border-sky-500 bg-sky-50/60 dark:bg-sky-950/30 shadow-md ring-2 ring-sky-400/20"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`p-2.5 rounded-xl ${cargo === "enfermeiro" ? "bg-sky-600 text-white" : "bg-sky-100 text-sky-700 dark:bg-sky-900/40"}`}>
                      <Stethoscope className="w-5 h-5" />
                    </div>
                    {cargo === "enfermeiro" && (
                      <CheckCircle2 className="w-5 h-5 text-sky-600" />
                    )}
                  </div>
                  <div>
                    <span className="block font-bold text-sm text-slate-900 dark:text-slate-100">Enfermeiro</span>
                    <span className="block text-[11px] text-slate-500 mt-1 leading-snug">
                      Checagens de prescrição e carrinho de emergência.
                    </span>
                  </div>
                </button>

                {/* Recepção / Admissão */}
                <button
                  type="button"
                  onClick={() => handleCargoChange("recepcionista")}
                  className={`p-4 rounded-2xl text-left border-2 transition-all flex flex-col justify-between space-y-3 ${
                    cargo === "recepcionista"
                      ? "border-amber-500 bg-amber-50/60 dark:bg-amber-950/30 shadow-md ring-2 ring-amber-400/20"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`p-2.5 rounded-xl ${cargo === "recepcionista" ? "bg-amber-600 text-white" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40"}`}>
                      <Building2 className="w-5 h-5" />
                    </div>
                    {cargo === "recepcionista" && (
                      <CheckCircle2 className="w-5 h-5 text-amber-600" />
                    )}
                  </div>
                  <div>
                    <span className="block font-bold text-sm text-slate-900 dark:text-slate-100">Recepção / Admissão</span>
                    <span className="block text-[11px] text-slate-500 mt-1 leading-snug">
                      Cadastro de pacientes, leitos e altas hospitalares.
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* 2. Dados de Acesso */}
            <div className="space-y-4 pt-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                2. Identificação e Credenciais de Acesso
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Nome Completo */}
                <div className="space-y-1.5 sm:col-span-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    Nome Completo *
                  </label>
                  <input
                    required
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    type="text"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs sm:text-sm font-medium outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
                    placeholder="Ex: Ana Clara Souza"
                  />
                </div>

                {/* Usuário Login */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    Usuário de Login *
                  </label>
                  <input
                    required
                    value={username}
                    onChange={e => setUsername(e.target.value.toLowerCase().trim())}
                    type="text"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs sm:text-sm font-mono font-medium outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
                    placeholder="ex: ana.souza"
                  />
                </div>

                {/* Senha */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-blue-600" />
                    Senha *
                  </label>
                  <div className="relative">
                    <input
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      type={showPassword ? "text" : "password"}
                      className="w-full pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs sm:text-sm font-mono font-medium outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Registro Profissional / Matrícula */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                {cargo === "farmaceutico" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Registro CRF *
                    </label>
                    <input
                      required
                      value={crf}
                      onChange={e => setCrf(e.target.value)}
                      type="text"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs sm:text-sm font-mono outline-none focus:border-emerald-500 transition-colors"
                      placeholder="Ex: 54321/SP"
                    />
                  </div>
                )}

                {cargo === "administrador" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      CRF (opcional para RT)
                    </label>
                    <input
                      value={crf}
                      onChange={e => setCrf(e.target.value)}
                      type="text"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs sm:text-sm font-mono outline-none focus:border-purple-500 transition-colors"
                      placeholder="Ex: 12345/SP"
                    />
                  </div>
                )}

                {cargo === "enfermeiro" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Registro COREN *
                    </label>
                    <input
                      required
                      value={coren}
                      onChange={e => setCoren(e.target.value)}
                      type="text"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs sm:text-sm font-mono outline-none focus:border-sky-500 transition-colors"
                      placeholder="Ex: 123456-SP"
                    />
                  </div>
                )}

                {cargo === "recepcionista" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Setor / Matrícula (opcional)
                    </label>
                    <input
                      value={matricula}
                      onChange={e => setMatricula(e.target.value)}
                      type="text"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs sm:text-sm outline-none focus:border-amber-500 transition-colors"
                      placeholder="Ex: Recepção Central - Turno Diurno"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Aviso de Senha Mestre de Supervisão RT */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-50 to-indigo-50 dark:from-sky-950/30 dark:to-indigo-950/30 border border-sky-200/80 dark:border-sky-800/50 text-xs flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-sky-900 dark:text-sky-200">Supervisão Técnica Universal:</p>
                <p className="text-sky-800/90 dark:text-sky-300 leading-relaxed">
                  Lembrete: A senha mestre do Administrador (<span className="font-mono font-bold bg-white/80 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-sky-300">admin123</span>) possui acesso universal de supervisão e funciona para todos os usuários cadastrados no hospital.
                </p>
              </div>
            </div>

            {/* 3. Módulos de Acesso Permitidos */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  3. Módulos de Acesso do Colaborador
                </label>
                <span className="text-xs text-slate-400 font-medium">
                  {selectedUserModules.length} módulo(s) habilitado(s)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {AVAILABLE_MODULES.map(module => {
                  const isChecked = selectedUserModules.includes(module.id);
                  return (
                    <label
                      key={module.id}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                        isChecked
                          ? "border-blue-500 bg-blue-50/70 dark:bg-blue-950/30 dark:border-blue-500 shadow-xs"
                          : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUserModules([...selectedUserModules, module.id]);
                          } else {
                            setSelectedUserModules(selectedUserModules.filter(m => m !== module.id));
                          }
                        }}
                        className="w-4 h-4 text-blue-600 rounded mt-0.5 focus:ring-blue-500 border-slate-300"
                      />
                      <div>
                        <span className={`block font-bold text-xs sm:text-sm ${isChecked ? "text-blue-900 dark:text-blue-200" : "text-slate-800 dark:text-slate-200"}`}>
                          {module.name}
                        </span>
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">
                          {module.desc}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Rodapé e Ações */}
            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => { resetForm(); setShowForm(false); }}
                className="px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs sm:text-sm transition-all shadow-lg shadow-blue-600/25 flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                {editingId ? "Salvar Alterações" : "Concluir Cadastro"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Cards de Métricas da Equipe */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Equipe</span>
              <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{userStats.total}</div>
              <span className="text-[11px] text-slate-500">colaboradores ativos</span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Recepção / Admissão</span>
              <div className="text-2xl font-black text-amber-600 mt-1">{userStats.recep}</div>
              <span className="text-[11px] text-slate-500">atendentes de leitos</span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Farmacêuticos</span>
              <div className="text-2xl font-black text-emerald-600 mt-1">{userStats.farma}</div>
              <span className="text-[11px] text-slate-500">com registro CRF</span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold text-sky-600 uppercase tracking-wider">Enfermagem</span>
              <div className="text-2xl font-black text-sky-600 mt-1">{userStats.enf}</div>
              <span className="text-[11px] text-slate-500">com registro COREN</span>
            </div>
          </div>

          {/* Barra de Filtros e Busca */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Input de Busca */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={userSearchQuery}
                onChange={e => setUserSearchQuery(e.target.value)}
                placeholder="Buscar por nome, login ou CRF/COREN..."
                className="w-full pl-9 pr-4 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            {/* Pílulas de Filtro por Cargo */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setUserCargoFilter("todos")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  userCargoFilter === "todos"
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                }`}
              >
                Todos ({userStats.total})
              </button>

              <button
                onClick={() => setUserCargoFilter("recepcionista")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  userCargoFilter === "recepcionista"
                    ? "bg-amber-600 text-white"
                    : "bg-amber-50 text-amber-800 hover:bg-amber-100"
                }`}
              >
                Recepção ({userStats.recep})
              </button>

              <button
                onClick={() => setUserCargoFilter("farmaceutico")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  userCargoFilter === "farmaceutico"
                    ? "bg-emerald-600 text-white"
                    : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                }`}
              >
                Farmácia ({userStats.farma})
              </button>

              <button
                onClick={() => setUserCargoFilter("enfermeiro")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  userCargoFilter === "enfermeiro"
                    ? "bg-sky-600 text-white"
                    : "bg-sky-50 text-sky-800 hover:bg-sky-100"
                }`}
              >
                Enfermagem ({userStats.enf})
              </button>

              <button
                onClick={() => setUserCargoFilter("administrador")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  userCargoFilter === "administrador"
                    ? "bg-purple-600 text-white"
                    : "bg-purple-50 text-purple-800 hover:bg-purple-100"
                }`}
              >
                RT ({userStats.admin})
              </button>
            </div>
          </div>

          {/* Tabela de Colaboradores */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <th className="py-3 px-6">Colaborador</th>
                    <th className="py-3 px-6">Usuário Login</th>
                    <th className="py-3 px-6">Cargo / Perfil</th>
                    <th className="py-3 px-6">Conselho / Registro</th>
                    <th className="py-3 px-6 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs sm:text-sm">
                  {filteredUsers.map(u => {
                    const role = u.perfil || u.cargo || "farmaceutico";
                    const isAdm = role === "administrador";
                    const isFarma = role === "farmaceutico";
                    const isEnf = role === "enfermeiro";
                    const isRecep = role === "recepcionista";

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                              isAdm ? "bg-purple-100 text-purple-700" :
                              isFarma ? "bg-emerald-100 text-emerald-700" :
                              isEnf ? "bg-sky-100 text-sky-700" :
                              "bg-amber-100 text-amber-800"
                            }`}>
                              {(u.nome || "U").substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-slate-100">{u.nome}</div>
                              <div className="text-[11px] text-slate-400">ID: {String(u.id).substring(0, 8)}...</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-6 font-mono font-semibold text-slate-700 dark:text-slate-300">
                          {u.login || u.username}
                        </td>

                        <td className="py-3.5 px-6">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                            isAdm 
                              ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300" 
                              : isFarma 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300" 
                              : isEnf 
                              ? "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300"
                              : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300"
                          }`}>
                            {isAdm && <ShieldCheck className="w-3.5 h-3.5" />}
                            {isFarma && <Pill className="w-3.5 h-3.5" />}
                            {isEnf && <Stethoscope className="w-3.5 h-3.5" />}
                            {isRecep && <Building2 className="w-3.5 h-3.5" />}

                            {isAdm ? "Administrador (RT)" :
                             isFarma ? "Farmacêutico" :
                             isEnf ? "Enfermeiro" :
                             "Recepção / Admissão"}
                          </span>
                        </td>

                        <td className="py-3.5 px-6 font-mono text-xs text-slate-600 dark:text-slate-400">
                          {u.crf ? `CRF: ${u.crf}` : u.coren ? `COREN: ${u.coren}` : "—"}
                        </td>

                        <td className="py-3.5 px-6 text-center space-x-1.5">
                          <button
                            onClick={() => handleEdit(u)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                            title="Editar Dados / Resetar Senha"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(u.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors"
                            title="Remover Colaborador"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan="5" className="text-center py-10 text-slate-400 space-y-2">
                        <Users className="w-8 h-8 mx-auto text-slate-300" />
                        <p className="text-xs sm:text-sm font-medium">Nenhum colaborador encontrado com os filtros atuais.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
