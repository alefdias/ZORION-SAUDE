import { useState, useEffect, useMemo } from "react";
import { Users, UserPlus, ShieldCheck, Key, Edit, Trash, History, AlertTriangle, FileCheck, Search, Download, Printer, Filter, CheckCircle2, RefreshCw, FileText } from "lucide-react";
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
    </div>
  );
}
