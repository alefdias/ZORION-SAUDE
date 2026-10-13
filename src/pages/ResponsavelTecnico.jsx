import { useState, useEffect, useMemo, useRef } from "react";
import { Users, UserPlus, ShieldCheck, Key, KeyRound, Edit, Trash, History, AlertTriangle, FileCheck, Search, Download, Printer, Filter, CheckCircle2, RefreshCw, FileText, Building2, Pill, Stethoscope, BadgeCheck, Eye, EyeOff, Lock, Sparkles, HeartHandshake, Boxes } from "lucide-react";
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
  const [crm, setCrm] = useState("");
  const [crmUf, setCrmUf] = useState("SP");
  const [crmNumero, setCrmNumero] = useState("");
  const [especialidade, setEspecialidade] = useState("");
  const [matricula, setMatricula] = useState("");
  const [selectedUserModules, setSelectedUserModules] = useState(["estoque_farmacia", "farmacia_satelite", "pacientes_medicao", "carrinho_parada"]);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userCargoFilter, setUserCargoFilter] = useState("todos");
  const [medicoSearchQuery, setMedicoSearchQuery] = useState("");
  const [medicoEspecialidadeFilter, setMedicoEspecialidadeFilter] = useState("todos");
  const [enfermagemSearchQuery, setEnfermagemSearchQuery] = useState("");
  const [enfermagemCargoFilter, setEnfermagemCargoFilter] = useState("todos");
  const [previewCarimboMedico, setPreviewCarimboMedico] = useState(null);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [newTempPassword, setNewTempPassword] = useState("");
  const [showTempPassword, setShowTempPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const ESTADOS_BRASIL = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", 
    "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", 
    "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
  ];

  const ESPECIALIDADES_MEDICAS = [
    "Clínica Médica / Geral",
    "Cirurgia Geral",
    "Pediatria",
    "Psiquiatria",
    "Cardiologia",
    "Ortopedia e Traumatologia",
    "Neurologia",
    "Ginecologia e Obstetrícia",
    "Medicina de Emergência / Plantonista",
    "Medicina Intensiva (UTI)",
    "Anestesiologia",
    "Infectologia",
    "Pneumologia",
    "Nefrologia",
    "Dermatologia",
    "Oftalmologia",
    "Medicina da Família",
    "Outra Especialidade"
  ];

  const handleCrmNumeroChange = (num) => {
    const clean = num.replace(/\D/g, "");
    setCrmNumero(clean);
    if (clean) {
      setCrm(`CRM/${crmUf} ${clean}`);
    } else {
      setCrm("");
    }
  };

  const handleCrmUfChange = (uf) => {
    setCrmUf(uf);
    if (crmNumero) {
      setCrm(`CRM/${uf} ${crmNumero}`);
    } else if (crm) {
      const match = crm.match(/\d+/);
      if (match) {
        setCrm(`CRM/${uf} ${match[0]}`);
      }
    }
  };

  const AVAILABLE_MODULES = [
    { id: "enfermagem", name: "Módulo Enfermagem", desc: "Checagem beira-leito, SAE, sinais vitais e anotações" },
    { id: "estoque_farmacia", name: "Estoque Central", desc: "Entradas, saídas e lotes" },
    { id: "farmacia_satelite", name: "Farmácia Satélite", desc: "Pedidos e distribuição de medicamentos" },
    { id: "pacientes_medicao", name: "Pacientes & Prescrições", desc: "Prontuários e aprazamento" },
    { id: "medico", name: "Módulo Médico", desc: "Prescrição hospitalar e prontuários" },
    { id: "recepcao", name: "Recepção & Admissão", desc: "Cadastro de pacientes e leitos" },
    { id: "carrinho_parada", name: "Carrinho de Parada", desc: "Kits de emergência e lacres" },
    { id: "responsavel_tecnico", name: "Responsável Técnico", desc: "Gestão RT e auditoria" }
  ];

  const carregarUsuarios = async () => {
    try {
      const data = await db.entities.Usuario.list();
      setUsers(data);
      // Mapear também para o localStorage por retrocompatibilidade e módulos
      const localUsers = data.map(u => {
        let userModules = [];
        if (u.modulos) {
          try {
            userModules = typeof u.modulos === 'string' && u.modulos.startsWith('[') 
              ? JSON.parse(u.modulos) 
              : (typeof u.modulos === 'string' ? u.modulos.split(',') : u.modulos);
          } catch {
            userModules = [];
          }
        }
        if (!userModules || userModules.length === 0) {
          const role = u.perfil || u.cargo;
          userModules = (role === "administrador" || role === "admin") ? AVAILABLE_MODULES.map(m => m.id) : 
                        (role === "farmaceutico") ? ["estoque_farmacia", "farmacia_satelite", "pacientes_medicao", "carrinho_parada"] : 
                        (role === "auxiliar_farmacia" || (role && role.includes("auxiliar"))) ? ["estoque_farmacia", "farmacia_satelite"] :
                        (role === "medico") ? ["medico"] :
                        (role === "enfermeiro") ? ["enfermagem", "carrinho_parada", "pacientes_medicao"] :
                        (role === "tecnico_enfermagem" || (role && role.includes("tec"))) ? ["enfermagem", "carrinho_parada"] :
                        (role === "recepcionista") ? ["recepcao", "pacientes_medicao"] :
                        ["enfermagem", "carrinho_parada"];
        }

        return {
          id: u.id,
          nome: u.nome,
          login: u.login,
          username: u.login,
          cargo: u.perfil || u.cargo,
          perfil: u.perfil || u.cargo,
          coren: u.coren,
          crf: u.crf,
          crm: u.crm,
          especialidade: u.especialidade,
          modulos: userModules,
          modules: userModules,
          first_login: u.primeiro_acesso !== false,
          primeiro_acesso: u.primeiro_acesso
        };
      });
      localStorage.setItem("axion_users", JSON.stringify(localUsers));
    } catch (e) {
      console.error("Erro ao carregar usuários do PG", e);
    }
  };

  useEffect(() => {
    const ensureColumns = async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const ip = localStorage.getItem('pg_ip');
        const dbName = localStorage.getItem('pg_db');
        const password = localStorage.getItem('pg_pass');
        if (!ip || !password) return;

        await invoke('execute_postgres', {
          ip, dbName, password,
          query: `
            ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "cargo" TEXT;
            ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "coren" TEXT;
            ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "modulos" TEXT;
            ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "primeiro_acesso" BOOLEAN DEFAULT true;
          `,
        });
      } catch (e) {
        // silencioso
      }
    };

    ensureColumns();
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
    } else if (newCargo === "auxiliar_farmacia") {
      setSelectedUserModules(["estoque_farmacia", "farmacia_satelite"]);
    } else if (newCargo === "medico") {
      setSelectedUserModules(["medico"]);
    } else if (newCargo === "enfermeiro") {
      setSelectedUserModules(["enfermagem", "carrinho_parada", "pacientes_medicao"]);
    } else if (newCargo === "tecnico_enfermagem") {
      setSelectedUserModules(["enfermagem", "carrinho_parada"]);
    } else if (newCargo === "recepcionista") {
      setSelectedUserModules(["recepcao", "pacientes_medicao"]);
    }
  };

  const userStats = useMemo(() => {
    const total = users.length;
    const admin = users.filter(u => u.perfil === "administrador" || u.cargo === "administrador" || u.perfil === "admin").length;
    const farma = users.filter(u => u.perfil === "farmaceutico" || u.cargo === "farmaceutico").length;
    const aux = users.filter(u => u.perfil === "auxiliar_farmacia" || u.cargo === "auxiliar_farmacia" || (u.cargo && u.cargo.toLowerCase().includes("auxiliar"))).length;
    const med = users.filter(u => u.perfil === "medico" || u.cargo === "medico").length;
    const enf = users.filter(u => u.perfil === "enfermeiro" || u.cargo === "enfermeiro").length;
    const tec = users.filter(u => u.perfil === "tecnico_enfermagem" || u.cargo === "tecnico_enfermagem" || (u.cargo && u.cargo.toLowerCase().includes("tec"))).length;
    const recep = users.filter(u => u.perfil === "recepcionista" || u.cargo === "recepcionista").length;
    return { total, admin, farma, aux, med, enf, tec, recep, enfermagemTotal: enf + tec };
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const role = u.perfil || u.cargo || "farmaceutico";
      if (userCargoFilter !== "todos") {
        if (userCargoFilter === "tecnico_enfermagem") {
          if (role !== "tecnico_enfermagem" && !(u.cargo && u.cargo.toLowerCase().includes("tec"))) return false;
        } else if (userCargoFilter === "auxiliar_farmacia") {
          if (role !== "auxiliar_farmacia" && !(u.cargo && u.cargo.toLowerCase().includes("auxiliar"))) return false;
        } else if (role !== userCargoFilter) {
          return false;
        }
      }
      if (userSearchQuery.trim()) {
        const q = userSearchQuery.toLowerCase();
        const nomeMatch = (u.nome || "").toLowerCase().includes(q);
        const loginMatch = (u.login || u.username || "").toLowerCase().includes(q);
        const regMatch = (u.crf || u.coren || u.crm || "").toLowerCase().includes(q);
        if (!nomeMatch && !loginMatch && !regMatch) return false;
      }
      return true;
    });
  }, [users, userCargoFilter, userSearchQuery]);

  const filteredEnfermagem = useMemo(() => {
    return users.filter(u => {
      const role = (u.perfil || u.cargo || "").toLowerCase();
      const isEnf = role === "enfermeiro" || (role.includes("enf") && !role.includes("tec"));
      const isTec = role === "tecnico_enfermagem" || role.includes("tec");
      if (!isEnf && !isTec) return false;

      if (enfermagemCargoFilter !== "todos") {
        if (enfermagemCargoFilter === "enfermeiro" && !isEnf) return false;
        if (enfermagemCargoFilter === "tecnico_enfermagem" && !isTec) return false;
      }

      if (enfermagemSearchQuery.trim()) {
        const q = enfermagemSearchQuery.toLowerCase();
        const nomeMatch = (u.nome || "").toLowerCase().includes(q);
        const loginMatch = (u.login || u.username || "").toLowerCase().includes(q);
        const corenMatch = (u.coren || "").toLowerCase().includes(q);
        if (!nomeMatch && !loginMatch && !corenMatch) return false;
      }
      return true;
    });
  }, [users, enfermagemCargoFilter, enfermagemSearchQuery]);

  const filteredMedicos = useMemo(() => {
    return users.filter(u => {
      const isMed = u.perfil === "medico" || u.cargo === "medico";
      if (!isMed) return false;
      if (medicoEspecialidadeFilter !== "todos" && (u.especialidade || "Clínica Médica / Geral") !== medicoEspecialidadeFilter) {
        return false;
      }
      if (medicoSearchQuery.trim()) {
        const q = medicoSearchQuery.toLowerCase();
        const nomeMatch = (u.nome || "").toLowerCase().includes(q);
        const loginMatch = (u.login || u.username || "").toLowerCase().includes(q);
        const crmMatch = (u.crm || "").toLowerCase().includes(q);
        const espMatch = (u.especialidade || "").toLowerCase().includes(q);
        if (!nomeMatch && !loginMatch && !crmMatch && !espMatch) return false;
      }
      return true;
    });
  }, [users, medicoSearchQuery, medicoEspecialidadeFilter]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!username || !nome) {
      toast.error("Preencha todos os campos obrigatórios (Nome e Login)");
      return;
    }
    if (!editingId && (!password || password.trim().length < 3)) {
      toast.error("Defina uma senha provisória de pelo menos 3 caracteres para o novo colaborador.");
      return;
    }
    if (editingId && password && password.trim().length < 3) {
      toast.error("A nova senha provisória deve ter pelo menos 3 caracteres.");
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
    let crmFinal = crm ? crm.trim() : "";
    if (cargo === 'medico') {
      if (!crmFinal && crmNumero) {
        crmFinal = `CRM/${crmUf} ${crmNumero.trim()}`;
        setCrm(crmFinal);
      }
      if (!crmFinal || crmFinal.length < 5) {
        toast.error("CRM é obrigatório para Médicos (Ex: CRM/SP 123456)");
        return;
      }
    }
    if ((cargo === 'enfermeiro' || cargo === 'tecnico_enfermagem') && !coren) {
      toast.error(`COREN é obrigatório para ${cargo === 'enfermeiro' ? 'Enfermeiros' : 'Técnicos de Enfermagem'}`);
      return;
    }

    let finalModules = selectedUserModules;
    if (cargo === 'medico') {
      finalModules = ["medico"];
    } else if (cargo === 'auxiliar_farmacia') {
      finalModules = ["estoque_farmacia", "farmacia_satelite"];
    }

    if (finalModules.length === 0) {
      toast.error("Selecione pelo menos um módulo de acesso para este colaborador.");
      return;
    }

    try {
      if (editingId) {
        // update
        const updatePayload = {
           nome,
           login: username,
           perfil: cargo,
           cargo: cargo,
           coren: (cargo === 'enfermeiro' || cargo === 'tecnico_enfermagem') ? coren : "",
           crf: (cargo === 'farmaceutico' || cargo === 'administrador') ? crf : "",
           crm: cargo === 'medico' ? crmFinal : "",
           especialidade: cargo === 'medico' ? (especialidade || "Clínica Médica / Geral") : "",
           modulos: JSON.stringify(finalModules)
        };

        // O administrador nunca vê a senha atual. Se digitou uma nova, atualiza e força primeiro_acesso para o usuário criar a sua
        if (password && password.trim()) {
          updatePayload.senha = password.trim();
          updatePayload.primeiro_acesso = true;
        }

        await db.entities.Usuario.update(editingId, updatePayload);
        if (password && password.trim()) {
          toast.success("Colaborador atualizado e nova senha provisória definida com sucesso!");
        } else {
          toast.success("Colaborador atualizado com sucesso no banco de dados!");
        }
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
           senha: password.trim(),
           perfil: cargo,
           cargo: cargo,
           coren: (cargo === 'enfermeiro' || cargo === 'tecnico_enfermagem') ? coren : "",
           crf: (cargo === 'farmaceutico' || cargo === 'administrador') ? crf : "",
           crm: cargo === 'medico' ? crmFinal : "",
           especialidade: cargo === 'medico' ? (especialidade || "Clínica Médica / Geral") : "",
           modulos: JSON.stringify(finalModules),
           primeiro_acesso: true
        });
        toast.success("Colaborador cadastrado! No primeiro login, o sistema exigirá a criação de senha pessoal.");
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
    setCrm("");
    setCrmNumero("");
    setCrmUf("SP");
    setEspecialidade("Clínica Médica / Geral");
    setMatricula("");
    setCargo("recepcionista");
    setSelectedUserModules(["recepcao", "pacientes_medicao"]);
  };

  const handleNewEnfermeiro = () => {
    resetForm();
    setCargo("enfermeiro");
    setSelectedUserModules(["enfermagem", "carrinho_parada", "pacientes_medicao"]);
    setShowForm(true);
  };

  const handleNewTecnico = () => {
    resetForm();
    setCargo("tecnico_enfermagem");
    setSelectedUserModules(["enfermagem", "carrinho_parada"]);
    setShowForm(true);
  };

  const handleOpenResetPasswordModal = (user) => {
    setResetPasswordUser(user);
    setNewTempPassword("123456");
    setShowTempPassword(false);
  };

  const handleConfirmPasswordReset = async () => {
    if (!resetPasswordUser) return;
    if (!newTempPassword || newTempPassword.trim().length < 3) {
      toast.error("A senha provisória deve ter pelo menos 3 caracteres.");
      return;
    }

    setIsResettingPassword(true);
    try {
      await db.entities.Usuario.update(resetPasswordUser.id, {
        senha: newTempPassword.trim(),
        primeiro_acesso: true
      });
      toast.success(`Senha provisória definida para ${resetPasswordUser.nome}! O colaborador deverá criar uma nova senha no próximo acesso.`);
      setResetPasswordUser(null);
      setNewTempPassword("");
      carregarUsuarios();
    } catch (error) {
      toast.error("Erro ao redefinir senha no banco: " + error.message);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleEdit = (u) => {
    setEditingId(u.id);
    setNome(u.nome);
    setUsername(u.login || u.username);
    setPassword(""); // NUNCA carrega a senha antiga! Administrador não tem acesso à senha do usuário
    setShowPassword(false);
    setCoren(u.coren || "");
    setCrf(u.crf || "");
    const userRole = u.perfil || u.cargo || "farmaceutico";
    setCargo(userRole);
    setEspecialidade(u.especialidade || "Clínica Médica / Geral");
    
    if (u.crm) {
      setCrm(u.crm);
      const match = u.crm.match(/CRM\/([A-Z]{2})\s*(\d+)/i) || u.crm.match(/(\d+)\/([A-Z]{2})/i);
      if (match) {
        if (match[1].length === 2) {
          setCrmUf(match[1].toUpperCase());
          setCrmNumero(match[2]);
        } else {
          setCrmNumero(match[1]);
          setCrmUf(match[2].toUpperCase());
        }
      } else {
        const digits = u.crm.replace(/\D/g, "");
        setCrmNumero(digits);
      }
    } else {
      setCrm("");
      setCrmNumero("");
      setCrmUf("SP");
    }
    
    let userMods = [];
    if (u.modulos) {
      try {
        userMods = typeof u.modulos === 'string' && u.modulos.startsWith('[') ? JSON.parse(u.modulos) : (typeof u.modulos === 'string' ? u.modulos.split(',') : u.modulos);
      } catch { userMods = []; }
    }
    if (!userMods || userMods.length === 0) {
      userMods = (userRole === "administrador" || userRole === "admin") ? AVAILABLE_MODULES.map(m => m.id) : 
                 (userRole === "farmaceutico") ? ["estoque_farmacia", "farmacia_satelite", "pacientes_medicao", "carrinho_parada"] : 
                 (userRole === "medico") ? ["medico", "pacientes_medicao"] :
                 (userRole === "enfermeiro") ? ["enfermagem", "carrinho_parada", "pacientes_medicao"] :
                 (userRole === "tecnico_enfermagem" || (userRole && userRole.includes("tec"))) ? ["enfermagem", "carrinho_parada"] :
                 (userRole === "recepcionista") ? ["recepcao", "pacientes_medicao"] :
                 ["enfermagem", "carrinho_parada"];
    }
    setSelectedUserModules(userMods);
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
            Gestão técnica da farmácia, equipe de enfermagem e administração de usuários do sistema.
          </p>
        </div>
        
        {activeTab === "usuarios" && (
          <button
            onClick={() => {
              if (showForm) resetForm();
              setShowForm(!showForm);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-blue-600/20 font-medium cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            {showForm ? "Voltar ao Painel" : "Cadastrar Usuário"}
          </button>
        )}

        {activeTab === "enfermagem" && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (showForm && cargo === "enfermeiro") {
                  setShowForm(false);
                } else {
                  handleNewEnfermeiro();
                }
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors shadow-lg shadow-indigo-600/20 font-bold text-xs sm:text-sm cursor-pointer"
            >
              <Users className="w-4 h-4" />
              {showForm && cargo === "enfermeiro" ? "Voltar à Lista" : "+ Novo Enfermeiro"}
            </button>
            <button
              onClick={() => {
                if (showForm && cargo === "tecnico_enfermagem") {
                  setShowForm(false);
                } else {
                  handleNewTecnico();
                }
              }}
              className="bg-teal-600 hover:bg-teal-700 text-white px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors shadow-lg shadow-teal-600/20 font-bold text-xs sm:text-sm cursor-pointer"
            >
              <HeartHandshake className="w-4 h-4" />
              {showForm && cargo === "tecnico_enfermagem" ? "Voltar à Lista" : "+ Novo Técnico de Enfermagem"}
            </button>
          </div>
        )}

        {activeTab === "medicos" && (
          <button
            onClick={() => {
              resetForm();
              handleCargoChange("medico");
              setShowForm(!showForm);
            }}
            className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-sky-600/20 font-bold cursor-pointer"
          >
            <Stethoscope className="w-4 h-4" />
            {showForm ? "Voltar ao Corpo Clínico" : "Cadastrar Médico (CRM)"}
          </button>
        )}
      </div>

      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button 
          onClick={() => {setActiveTab("usuarios"); setShowForm(false);}} 
          className={`font-medium pb-2 cursor-pointer ${activeTab === 'usuarios' ? 'text-blue-600 border-b-2 border-blue-600 font-bold' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
        >
          Todos os Usuários ({userStats.total})
        </button>
        <button 
          onClick={() => {setActiveTab("enfermagem"); setShowForm(false);}} 
          className={`font-medium pb-2 cursor-pointer flex items-center gap-1.5 ${activeTab === 'enfermagem' ? 'text-teal-600 border-b-2 border-teal-600 font-bold' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
        >
          <Users className="w-4 h-4 text-teal-600" />
          Equipe de Enfermagem ({userStats.enfermagemTotal})
        </button>
        <button 
          onClick={() => {setActiveTab("medicos"); setShowForm(false);}} 
          className={`font-medium pb-2 cursor-pointer flex items-center gap-1.5 ${activeTab === 'medicos' ? 'text-sky-600 border-b-2 border-sky-600 font-bold' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
        >
          <Stethoscope className="w-4 h-4 text-sky-600" />
          Corpo Clínico & Médicos ({userStats.med})
        </button>
        <button 
          onClick={() => {setActiveTab("auditoria"); setLogs(getLogs()); setShowForm(false);}} 
          className={`font-medium pb-2 cursor-pointer ${activeTab === 'auditoria' ? 'text-blue-600 border-b-2 border-blue-600 font-bold' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
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
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-3">
                {/* Médico */}
                <button
                  type="button"
                  onClick={() => handleCargoChange("medico")}
                  className={`p-3.5 rounded-2xl text-left border-2 transition-all flex flex-col justify-between space-y-3 cursor-pointer ${
                    cargo === "medico"
                      ? "border-sky-500 bg-sky-50/70 dark:bg-sky-950/30 shadow-md ring-2 ring-sky-400/20"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`p-2 rounded-xl ${cargo === "medico" ? "bg-sky-600 text-white" : "bg-sky-100 text-sky-700 dark:bg-sky-900/40"}`}>
                      <Stethoscope className="w-5 h-5" />
                    </div>
                    {cargo === "medico" && (
                      <CheckCircle2 className="w-5 h-5 text-sky-600" />
                    )}
                  </div>
                  <div>
                    <span className="block font-bold text-sm text-slate-900 dark:text-slate-100">Médico (CRM)</span>
                    <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">
                      Prescrição de medicamentos e receitas.
                    </span>
                  </div>
                </button>

                {/* Administrador */}
                <button
                  type="button"
                  onClick={() => handleCargoChange("administrador")}
                  className={`p-3.5 rounded-2xl text-left border-2 transition-all flex flex-col justify-between space-y-3 cursor-pointer ${
                    cargo === "administrador"
                      ? "border-purple-500 bg-purple-50/60 dark:bg-purple-950/30 shadow-md ring-2 ring-purple-400/20"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`p-2 rounded-xl ${cargo === "administrador" ? "bg-purple-600 text-white" : "bg-purple-100 text-purple-700 dark:bg-purple-900/40"}`}>
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    {cargo === "administrador" && (
                      <CheckCircle2 className="w-5 h-5 text-purple-600" />
                    )}
                  </div>
                  <div>
                    <span className="block font-bold text-sm text-slate-900 dark:text-slate-100">Administrador (RT)</span>
                    <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">
                      Acesso total, gestão e auditoria.
                    </span>
                  </div>
                </button>

                {/* Farmacêutico */}
                <button
                  type="button"
                  onClick={() => handleCargoChange("farmaceutico")}
                  className={`p-3.5 rounded-2xl text-left border-2 transition-all flex flex-col justify-between space-y-3 cursor-pointer ${
                    cargo === "farmaceutico"
                      ? "border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30 shadow-md ring-2 ring-emerald-400/20"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`p-2 rounded-xl ${cargo === "farmaceutico" ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40"}`}>
                      <Pill className="w-5 h-5" />
                    </div>
                    {cargo === "farmaceutico" && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    )}
                  </div>
                  <div>
                    <span className="block font-bold text-sm text-slate-900 dark:text-slate-100">Farmacêutico</span>
                    <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">
                      Estoque central, satélite e dispensação.
                    </span>
                  </div>
                </button>

                {/* Auxiliar de Farmácia */}
                <button
                  type="button"
                  onClick={() => handleCargoChange("auxiliar_farmacia")}
                  className={`p-3.5 rounded-2xl text-left border-2 transition-all flex flex-col justify-between space-y-3 cursor-pointer ${
                    cargo === "auxiliar_farmacia"
                      ? "border-cyan-500 bg-cyan-50/70 dark:bg-cyan-950/30 shadow-md ring-2 ring-cyan-400/20"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`p-2 rounded-xl ${cargo === "auxiliar_farmacia" ? "bg-cyan-600 text-white" : "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40"}`}>
                      <Boxes className="w-5 h-5" />
                    </div>
                    {cargo === "auxiliar_farmacia" && (
                      <CheckCircle2 className="w-5 h-5 text-cyan-600" />
                    )}
                  </div>
                  <div>
                    <span className="block font-bold text-sm text-slate-900 dark:text-slate-100">Auxiliar Farmácia</span>
                    <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">
                      Estoque Central e Satélite.
                    </span>
                  </div>
                </button>

                {/* Enfermeiro */}
                <button
                  type="button"
                  onClick={() => handleCargoChange("enfermeiro")}
                  className={`p-3.5 rounded-2xl text-left border-2 transition-all flex flex-col justify-between space-y-3 cursor-pointer ${
                    cargo === "enfermeiro"
                      ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30 shadow-md ring-2 ring-indigo-400/20"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`p-2 rounded-xl ${cargo === "enfermeiro" ? "bg-indigo-600 text-white" : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40"}`}>
                      <Users className="w-5 h-5" />
                    </div>
                    {cargo === "enfermeiro" && (
                      <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                    )}
                  </div>
                  <div>
                    <span className="block font-bold text-sm text-slate-900 dark:text-slate-100">Enfermeiro</span>
                    <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">
                      SAE, prescrição de cuidados e gestão.
                    </span>
                  </div>
                </button>

                {/* Técnico de Enfermagem */}
                <button
                  type="button"
                  onClick={() => handleCargoChange("tecnico_enfermagem")}
                  className={`p-3.5 rounded-2xl text-left border-2 transition-all flex flex-col justify-between space-y-3 cursor-pointer ${
                    cargo === "tecnico_enfermagem"
                      ? "border-teal-500 bg-teal-50/60 dark:bg-teal-950/30 shadow-md ring-2 ring-teal-400/20"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`p-2 rounded-xl ${cargo === "tecnico_enfermagem" ? "bg-teal-600 text-white" : "bg-teal-100 text-teal-700 dark:bg-teal-900/40"}`}>
                      <HeartHandshake className="w-5 h-5" />
                    </div>
                    {cargo === "tecnico_enfermagem" && (
                      <CheckCircle2 className="w-5 h-5 text-teal-600" />
                    )}
                  </div>
                  <div>
                    <span className="block font-bold text-sm text-slate-900 dark:text-slate-100">Técnico Enfermagem</span>
                    <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">
                      Checagem beira-leito, sinais e balanço.
                    </span>
                  </div>
                </button>

                {/* Recepção / Admissão */}
                <button
                  type="button"
                  onClick={() => handleCargoChange("recepcionista")}
                  className={`p-3.5 rounded-2xl text-left border-2 transition-all flex flex-col justify-between space-y-3 cursor-pointer ${
                    cargo === "recepcionista"
                      ? "border-amber-500 bg-amber-50/60 dark:bg-amber-950/30 shadow-md ring-2 ring-amber-400/20"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className={`p-2 rounded-xl ${cargo === "recepcionista" ? "bg-amber-600 text-white" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40"}`}>
                      <Building2 className="w-5 h-5" />
                    </div>
                    {cargo === "recepcionista" && (
                      <CheckCircle2 className="w-5 h-5 text-amber-600" />
                    )}
                  </div>
                  <div>
                    <span className="block font-bold text-sm text-slate-900 dark:text-slate-100">Recepção</span>
                    <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">
                      Pacientes, leitos e admissões.
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
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Key className="w-3.5 h-3.5 text-blue-600" />
                      {editingId ? "Trocar Senha (Opcional)" : "Senha Provisória de Acesso *"}
                    </span>
                    {editingId && (
                      <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" />
                        Senha atual protegida
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      required={!editingId}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      type={showPassword ? "text" : "password"}
                      className="w-full pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs sm:text-sm font-mono font-medium outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-900 transition-all placeholder:text-slate-400"
                      placeholder={editingId ? "Deixe em branco para manter a senha atual..." : "Ex: 123456"}
                    />
                    {password && (
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                        title={showPassword ? "Ocultar" : "Mostrar"}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                    {editingId 
                      ? "O administrador não pode visualizar a senha pessoal do usuário. Digite uma nova senha provisória apenas se desejar trocá-la (o usuário criará uma nova senha ao entrar)."
                      : "Defina uma senha provisória inicial. No 1º acesso, o colaborador deverá cadastrar sua própria senha pessoal."}
                  </p>
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

                {(cargo === "enfermeiro" || cargo === "tecnico_enfermagem") && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>Registro COREN *</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {cargo === "enfermeiro" ? "Ex: 123456-ENF / SP" : "Ex: 654321-TE / SP"}
                      </span>
                    </label>
                    <input
                      required
                      value={coren}
                      onChange={e => setCoren(e.target.value)}
                      type="text"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs sm:text-sm font-mono outline-none focus:border-indigo-500 transition-colors"
                      placeholder={cargo === "enfermeiro" ? "Ex: 123456-ENF" : "Ex: 654321-TE"}
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

                {cargo === "medico" && (
                  <>
                    <div className="space-y-1.5 sm:col-span-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Stethoscope className="w-3.5 h-3.5 text-sky-600" />
                        CRM - Estado (UF) *
                      </label>
                      <select
                        value={crmUf}
                        onChange={e => handleCrmUfChange(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs sm:text-sm font-bold outline-none focus:border-sky-500 transition-colors"
                      >
                        {ESTADOS_BRASIL.map(uf => (
                          <option key={uf} value={uf}>CRM / {uf}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5 sm:col-span-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Número do CRM *
                      </label>
                      <input
                        required
                        value={crmNumero}
                        onChange={e => handleCrmNumeroChange(e.target.value)}
                        type="text"
                        maxLength={8}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs sm:text-sm font-mono font-bold outline-none focus:border-sky-500 transition-colors"
                        placeholder="Ex: 123456"
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        Especialidade Médica *
                      </label>
                      <select
                        value={ESPECIALIDADES_MEDICAS.includes(especialidade) ? especialidade : (especialidade ? "Outra Especialidade" : "Clínica Médica / Geral")}
                        onChange={e => {
                          if (e.target.value === "Outra Especialidade") {
                            setEspecialidade("");
                          } else {
                            setEspecialidade(e.target.value);
                          }
                        }}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs sm:text-sm font-medium outline-none focus:border-sky-500 transition-colors"
                      >
                        {ESPECIALIDADES_MEDICAS.map(esp => (
                          <option key={esp} value={esp}>{esp}</option>
                        ))}
                      </select>
                    </div>

                    {(!ESPECIALIDADES_MEDICAS.includes(especialidade) || especialidade === "Outra Especialidade") && (
                      <div className="space-y-1.5 sm:col-span-3">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Especifique o Nome da Especialidade
                        </label>
                        <input
                          value={especialidade}
                          onChange={e => setEspecialidade(e.target.value)}
                          type="text"
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs sm:text-sm outline-none focus:border-sky-500 transition-colors"
                          placeholder="Ex: Mastologia, Reumatologia, Nutrologia..."
                        />
                      </div>
                    )}

                    {/* Preview do Carimbo Médico */}
                    <div className="p-4 rounded-2xl bg-sky-50/80 dark:bg-sky-950/40 border-2 border-dashed border-sky-300 dark:border-sky-700 sm:col-span-3 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center font-black shadow-md shrink-0">
                          <Stethoscope className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/60 px-2 py-0.5 rounded-md">
                              Carimbo Médico Digital (Preview)
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono font-bold">
                              {crm || `CRM/${crmUf} ${crmNumero || "000000"}`}
                            </span>
                          </div>
                          <h4 className="text-base font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                            Dr(a). {nome || "Nome do Profissional"}
                          </h4>
                          <p className="text-xs font-bold text-sky-700 dark:text-sky-300">
                            {especialidade || "Clínica Médica / Geral"} • Hospital Zorion Saúde
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 text-xs font-bold border border-emerald-300 dark:border-emerald-700">
                          <BadgeCheck className="w-4 h-4 text-emerald-600" />
                          Apto para Prescrição & Receituário A4
                        </span>
                      </div>
                    </div>
                  </>
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
                  {cargo === "medico" ? "1 módulo (Apenas Médico)" : cargo === "auxiliar_farmacia" ? "2 módulos (Estoque Central e Farmácia Satélite)" : `${selectedUserModules.length} módulo(s) habilitado(s)`}
                </span>
              </div>

              {cargo === "medico" && (
                <div className="p-3.5 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-xs flex items-center gap-2.5 text-sky-800 dark:text-sky-200">
                  <Stethoscope className="w-5 h-5 text-sky-600 shrink-0" />
                  <span>
                    <strong>Restrição de Acesso:</strong> Médicos possuem acesso liberado <strong>exclusivamente ao Módulo Médico</strong> (prescrições, receitas e prontuários). Os demais módulos hospitalares ficam bloqueados.
                  </span>
                </div>
              )}

              {cargo === "auxiliar_farmacia" && (
                <div className="p-3.5 rounded-2xl bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 text-xs flex items-center gap-2.5 text-cyan-800 dark:text-cyan-200">
                  <Boxes className="w-5 h-5 text-cyan-600 shrink-0" />
                  <span>
                    <strong>Restrição de Acesso:</strong> Auxiliares de Farmácia possuem acesso liberado <strong>ao Estoque Central e Farmácia Satélite</strong> (medicamentos e lotes). Os demais módulos hospitalares ficam bloqueados.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {AVAILABLE_MODULES.map(module => {
                  const isChecked = (cargo === "medico" && module.id === "medico") ||
                                    (cargo === "auxiliar_farmacia" && (module.id === "estoque_farmacia" || module.id === "farmacia_satelite")) ||
                                    (cargo !== "medico" && cargo !== "auxiliar_farmacia" && selectedUserModules.includes(module.id));
                  const isLocked = cargo === "medico" || cargo === "auxiliar_farmacia";

                  return (
                    <label
                      key={module.id}
                      className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                        isLocked ? "cursor-default opacity-80" : "cursor-pointer"
                      } ${
                        isChecked
                          ? "border-blue-500 bg-blue-50/70 dark:bg-blue-950/30 dark:border-blue-500 shadow-xs"
                          : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={isLocked}
                        onChange={(e) => {
                          if (isLocked) return;
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
      ) : activeTab === "enfermagem" ? (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Métricas da Equipe de Enfermagem */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Enfermagem</span>
                <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{userStats.enfermagemTotal}</div>
                <span className="text-[11px] text-slate-500">profissionais cadastrados</span>
              </div>
              <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40">
                <Users className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Enfermeiros (SAE & Gestão)</span>
                <div className="text-2xl font-black text-indigo-700 dark:text-indigo-400 mt-1">
                  {userStats.enf}
                </div>
                <span className="text-[11px] text-slate-500">aptos para SAE e prescrições</span>
              </div>
              <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40">
                <BadgeCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-teal-600 uppercase tracking-wider">Técnicos de Enfermagem</span>
                <div className="text-2xl font-black text-teal-700 dark:text-teal-400 mt-1">{userStats.tec}</div>
                <span className="text-[11px] text-slate-500">checagem beira-leito e sinais</span>
              </div>
              <div className="p-3 rounded-2xl bg-teal-50 text-teal-600 dark:bg-teal-950/40">
                <HeartHandshake className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Barra de Busca e Filtro de Enfermagem */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={enfermagemSearchQuery}
                onChange={e => setEnfermagemSearchQuery(e.target.value)}
                placeholder="Buscar por nome, login ou COREN..."
                className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setEnfermagemCargoFilter("todos")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  enfermagemCargoFilter === "todos"
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                Todos ({userStats.enfermagemTotal})
              </button>

              <button
                type="button"
                onClick={() => setEnfermagemCargoFilter("enfermeiro")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  enfermagemCargoFilter === "enfermeiro"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300"
                }`}
              >
                Enfermeiros ({userStats.enf})
              </button>

              <button
                type="button"
                onClick={() => setEnfermagemCargoFilter("tecnico_enfermagem")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  enfermagemCargoFilter === "tecnico_enfermagem"
                    ? "bg-teal-600 text-white shadow-xs"
                    : "bg-teal-50 text-teal-700 hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-300"
                }`}
              >
                Técnicos ({userStats.tec})
              </button>
            </div>
          </div>

          {/* Tabela de Profissionais da Enfermagem */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <th className="py-3 px-6">Profissional de Enfermagem</th>
                    <th className="py-3 px-6">Usuário Login</th>
                    <th className="py-3 px-6">Cargo Hospitalar</th>
                    <th className="py-3 px-6">Registro COREN</th>
                    <th className="py-3 px-6">Módulos Autorizados</th>
                    <th className="py-3 px-6 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs sm:text-sm">
                  {filteredEnfermagem.map(u => {
                    const role = (u.perfil || u.cargo || "").toLowerCase();
                    const isEnf = role === "enfermeiro" || (role.includes("enf") && !role.includes("tec"));
                    const isTec = role === "tecnico_enfermagem" || role.includes("tec");

                    let userMods = [];
                    if (u.modulos) {
                      try {
                        userMods = typeof u.modulos === "string" && u.modulos.startsWith("[") 
                          ? JSON.parse(u.modulos) 
                          : (typeof u.modulos === "string" ? u.modulos.split(",") : u.modulos);
                      } catch { userMods = []; }
                    }

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                              isEnf ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" :
                              "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300"
                            }`}>
                              {(u.nome || "E").substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                {u.nome}
                                {u.primeiro_acesso !== false && (
                                  <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-medium">1º Acesso</span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400">ID: {String(u.id).substring(0, 8)}...</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-6 font-mono font-semibold text-slate-700 dark:text-slate-300">
                          {u.login || u.username}
                        </td>

                        <td className="py-3.5 px-6">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                            isEnf 
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300"
                              : "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300"
                          }`}>
                            {isEnf ? <Users className="w-3.5 h-3.5 text-indigo-600" /> : <HeartHandshake className="w-3.5 h-3.5 text-teal-600" />}
                            {isEnf ? "Enfermeiro" : "Técnico de Enfermagem"}
                          </span>
                        </td>

                        <td className="py-3.5 px-6 font-mono text-xs">
                          {u.coren ? (
                            <span className="font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                              COREN: {u.coren}
                            </span>
                          ) : (
                            <span className="text-rose-500 font-semibold text-[11px]">Sem COREN cadastrado</span>
                          )}
                        </td>

                        <td className="py-3.5 px-6">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {userMods.length > 0 ? (
                              userMods.map(mId => {
                                const modObj = AVAILABLE_MODULES.find(m => m.id === mId);
                                return (
                                  <span key={mId} className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                    {modObj ? modObj.name : mId}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-[11px] text-slate-400">Padrão do cargo</span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-6 text-center space-x-1.5">
                          <button
                            onClick={() => handleOpenResetPasswordModal(u)}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors cursor-pointer"
                            title="Trocar / Resetar Senha (Forçar Nova Senha no Próximo Acesso)"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(u)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors cursor-pointer"
                            title="Editar Dados / Módulos de Acesso"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(u.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors cursor-pointer"
                            title="Remover Profissional"
                          >
                            <Trash className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredEnfermagem.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-12 text-center text-slate-500 space-y-3">
                        <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 stroke-[1.5]" />
                        <div className="text-sm font-semibold">Nenhum profissional de enfermagem encontrado</div>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto">
                          Cadastre enfermeiros e técnicos de enfermagem para liberar o acesso ao módulo hospitalar de enfermagem e carrinho de parada.
                        </p>
                        <div className="flex items-center justify-center gap-2 pt-2">
                          <button
                            onClick={handleNewEnfermeiro}
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md cursor-pointer"
                          >
                            + Novo Enfermeiro
                          </button>
                          <button
                            onClick={handleNewTecnico}
                            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md cursor-pointer"
                          >
                            + Novo Técnico de Enfermagem
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === "medicos" ? (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Cards de Métricas dos Médicos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total de Médicos</span>
                <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{userStats.med}</div>
                <span className="text-[11px] text-slate-500">profissionais cadastrados</span>
              </div>
              <div className="p-3 rounded-2xl bg-sky-50 text-sky-600">
                <Stethoscope className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-sky-600 uppercase tracking-wider">Com CRM Registrado</span>
                <div className="text-2xl font-black text-sky-700 mt-1">
                  {users.filter(u => (u.perfil === "medico" || u.cargo === "medico") && u.crm).length}
                </div>
                <span className="text-[11px] text-slate-500">aptos para prescrição</span>
              </div>
              <div className="p-3 rounded-2xl bg-sky-50 text-sky-600">
                <BadgeCheck className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Módulo Médico</span>
                <div className="text-2xl font-black text-emerald-700 mt-1">{userStats.med}</div>
                <span className="text-[11px] text-slate-500">emissão de receitas A4</span>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Barra de Filtros e Busca do Corpo Clínico */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Input de Busca */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={medicoSearchQuery}
                onChange={e => setMedicoSearchQuery(e.target.value)}
                placeholder="Buscar médico por nome, CRM, login ou especialidade..."
                className="w-full pl-9 pr-4 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 outline-none focus:border-sky-500 transition-colors font-medium"
              />
            </div>

            {/* Filtro por Especialidade */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Especialidade:</span>
              <select
                value={medicoEspecialidadeFilter}
                onChange={e => setMedicoEspecialidadeFilter(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none focus:border-sky-500"
              >
                <option value="todos">Todas as Especialidades</option>
                {ESPECIALIDADES_MEDICAS.map(esp => (
                  <option key={esp} value={esp}>{esp}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Tabela do Corpo Clínico */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200/80 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-sky-600" />
                  Corpo Clínico do Hospital (Médicos Plantonistas & Especialistas)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Exibindo {filteredMedicos.length} médico(s) credenciado(s) com CRM para prescrição eletrônica.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  resetForm();
                  handleCargoChange("medico");
                  setShowForm(true);
                }}
                className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Cadastrar Médico (CRM)
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-slate-800/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <th className="py-3 px-6">Médico / Nome</th>
                    <th className="py-3 px-6">Registro CRM / UF</th>
                    <th className="py-3 px-6">Especialidade</th>
                    <th className="py-3 px-6">Usuário Login</th>
                    <th className="py-3 px-6">Status ZORION-MEDICO</th>
                    <th className="py-3 px-6 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs sm:text-sm">
                  {filteredMedicos.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                            <Stethoscope className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900 dark:text-slate-100">{m.nome}</div>
                            <div className="text-[11px] text-slate-400">ID: {String(m.id).substring(0, 8)}...</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-6 font-mono">
                        <span className="font-black text-sky-800 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 rounded-lg border border-sky-200 dark:border-sky-800">
                          {m.crm || "NÃO INFORMADO"}
                        </span>
                      </td>

                      <td className="py-3.5 px-6 font-semibold text-slate-700 dark:text-slate-300">
                        {m.especialidade || "Clínica Geral"}
                      </td>

                      <td className="py-3.5 px-6 font-mono text-slate-600 dark:text-slate-400 font-medium">
                        {m.login || m.username}
                      </td>

                      <td className="py-3.5 px-6">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Prescrição & Receituário A4
                        </span>
                      </td>

                      <td className="py-3.5 px-6 text-center space-x-1">
                        <button
                          onClick={() => setPreviewCarimboMedico(m)}
                          className="p-1.5 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/30 rounded-lg transition-colors cursor-pointer"
                          title="Visualizar Carimbo Digital"
                        >
                          <BadgeCheck className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenResetPasswordModal(m)}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors cursor-pointer"
                          title="Trocar / Resetar Senha (Forçar Nova Senha no Próximo Acesso)"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(m)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors cursor-pointer"
                          title="Editar Médico"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(m.id)}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors cursor-pointer"
                          title="Remover Médico"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}

                  {filteredMedicos.length === 0 && (
                    <tr>
                      <td colSpan="6" className="text-center py-12 text-slate-400 space-y-2">
                        <Stethoscope className="w-10 h-10 mx-auto text-slate-300" />
                        <p className="font-bold text-slate-600 dark:text-slate-300 text-sm">
                          {medicoSearchQuery ? "Nenhum médico encontrado para a busca." : "Nenhum médico cadastrado no sistema ainda."}
                        </p>
                        <p className="text-xs">
                          Clique no botão "Cadastrar Médico (CRM)" para cadastrar profissionais com CRM.
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Cards de Métricas da Equipe */}
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3.5">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Equipe</span>
              <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{userStats.total}</div>
              <span className="text-[11px] text-slate-500">colaboradores ativos</span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold text-sky-600 uppercase tracking-wider">Médicos</span>
              <div className="text-2xl font-black text-sky-600 mt-1">{userStats.med}</div>
              <span className="text-[11px] text-slate-500">prescritores CRM</span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Farmacêuticos</span>
              <div className="text-2xl font-black text-emerald-600 mt-1">{userStats.farma}</div>
              <span className="text-[11px] text-slate-500">com registro CRF</span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold text-cyan-600 uppercase tracking-wider">Aux. Farmácia</span>
              <div className="text-2xl font-black text-cyan-600 mt-1">{userStats.aux}</div>
              <span className="text-[11px] text-slate-500">estoque central</span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Enfermagem</span>
              <div className="text-2xl font-black text-indigo-600 mt-1">{userStats.enfermagemTotal}</div>
              <span className="text-[11px] text-slate-500">enfermeiros e tec.</span>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Recepção</span>
              <div className="text-2xl font-black text-amber-600 mt-1">{userStats.recep}</div>
              <span className="text-[11px] text-slate-500">admissão de leitos</span>
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
                placeholder="Buscar por nome, login ou CRM/CRF/COREN..."
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
                onClick={() => setUserCargoFilter("medico")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  userCargoFilter === "medico"
                    ? "bg-sky-600 text-white"
                    : "bg-sky-50 text-sky-800 hover:bg-sky-100"
                }`}
              >
                Médicos ({userStats.med})
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
                onClick={() => setUserCargoFilter("auxiliar_farmacia")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  userCargoFilter === "auxiliar_farmacia"
                    ? "bg-cyan-600 text-white"
                    : "bg-cyan-50 text-cyan-800 hover:bg-cyan-100"
                }`}
              >
                Auxiliares ({userStats.aux})
              </button>

              <button
                onClick={() => setUserCargoFilter("enfermeiro")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  userCargoFilter === "enfermeiro"
                    ? "bg-indigo-600 text-white"
                    : "bg-indigo-50 text-indigo-800 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300"
                }`}
              >
                Enfermeiros ({userStats.enf})
              </button>

              <button
                onClick={() => setUserCargoFilter("tecnico_enfermagem")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  userCargoFilter === "tecnico_enfermagem"
                    ? "bg-teal-600 text-white"
                    : "bg-teal-50 text-teal-800 hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-300"
                }`}
              >
                Técnicos ({userStats.tec})
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
                onClick={() => setUserCargoFilter("administrador")}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
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
                    const isAdm = role === "administrador" || role === "admin";
                    const isFarma = role === "farmaceutico";
                    const isAux = role === "auxiliar_farmacia" || (u.cargo && u.cargo.toLowerCase().includes("auxiliar"));
                    const isMed = role === "medico";
                    const isEnf = role === "enfermeiro";
                    const isTec = role === "tecnico_enfermagem" || (u.cargo && u.cargo.toLowerCase().includes("tec"));
                    const isRecep = role === "recepcionista";

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                              isAdm ? "bg-purple-100 text-purple-700" :
                              isFarma ? "bg-emerald-100 text-emerald-700" :
                              isAux ? "bg-cyan-100 text-cyan-800" :
                              isMed ? "bg-sky-100 text-sky-700" :
                              isEnf ? "bg-indigo-100 text-indigo-700" :
                              isTec ? "bg-teal-100 text-teal-700" :
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
                              : isAux
                              ? "bg-cyan-50 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300"
                              : isMed
                              ? "bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300"
                              : isEnf 
                              ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300"
                              : isTec
                              ? "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300"
                              : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300"
                          }`}>
                            {isAdm && <ShieldCheck className="w-3.5 h-3.5" />}
                            {isFarma && <Pill className="w-3.5 h-3.5" />}
                            {isAux && <Boxes className="w-3.5 h-3.5 text-cyan-600" />}
                            {isMed && <Stethoscope className="w-3.5 h-3.5 text-sky-600" />}
                            {isEnf && <Users className="w-3.5 h-3.5" />}
                            {isTec && <HeartHandshake className="w-3.5 h-3.5 text-teal-600" />}
                            {isRecep && <Building2 className="w-3.5 h-3.5" />}

                            {isAdm ? "Administrador (RT)" :
                             isFarma ? "Farmacêutico" :
                             isAux ? "Auxiliar de Farmácia" :
                             isMed ? "Médico (Prescritor)" :
                             isEnf ? "Enfermeiro" :
                             isTec ? "Técnico de Enfermagem" :
                             "Recepção / Admissão"}
                          </span>
                        </td>

                        <td className="py-3.5 px-6 font-mono text-xs text-slate-600 dark:text-slate-400">
                          {u.crm ? (
                            <span className="font-bold text-sky-800 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded border border-sky-200">
                              CRM: {u.crm}
                            </span>
                          ) : u.crf ? `CRF: ${u.crf}` : u.coren ? `COREN: ${u.coren}` : "—"}
                          {u.especialidade && (
                            <div className="text-[10px] text-slate-400 font-sans mt-0.5">{u.especialidade}</div>
                          )}
                        </td>

                        <td className="py-3.5 px-6 text-center space-x-1.5">
                          <button
                            onClick={() => handleOpenResetPasswordModal(u)}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-lg transition-colors cursor-pointer"
                            title="Trocar / Resetar Senha (Forçar Nova Senha no Próximo Acesso)"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleEdit(u)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors cursor-pointer"
                            title="Editar Dados Cadastrais / Módulos"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(u.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-colors cursor-pointer"
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

      {/* Modal de Pré-visualização do Carimbo Médico */}
      {previewCarimboMedico && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-sky-700 dark:text-sky-400 font-extrabold text-sm">
                <BadgeCheck className="w-5 h-5 text-sky-600" />
                Carimbo Profissional Digital
              </div>
              <button
                onClick={() => setPreviewCarimboMedico(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                ✕ Fechar
              </button>
            </div>

            {/* Carimbo Visual */}
            <div className="p-6 rounded-2xl bg-gradient-to-b from-sky-50/70 to-blue-50/50 dark:from-sky-950/40 dark:to-slate-900 border-2 border-dashed border-sky-400 dark:border-sky-700 text-center space-y-2 relative shadow-inner">
              <div className="w-14 h-14 mx-auto rounded-full bg-sky-600 text-white flex items-center justify-center shadow-md mb-3">
                <Stethoscope className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">
                Dr(a). {previewCarimboMedico.nome}
              </h3>
              <div className="inline-block font-mono font-black text-sm text-sky-800 dark:text-sky-300 bg-white dark:bg-slate-800 px-3 py-1 rounded-lg border border-sky-200 dark:border-sky-700 shadow-2xs">
                {previewCarimboMedico.crm || "CRM NÃO INFORMADO"}
              </div>
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                {previewCarimboMedico.especialidade || "Clínica Médica / Geral"}
              </p>
              <div className="text-[11px] text-slate-500 pt-2 border-t border-sky-200/60 dark:border-sky-800/60">
                Hospital Geral Zorion Saúde • Corpo Clínico Credenciado
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
              <div className="flex justify-between">
                <span>Login de Acesso:</span>
                <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{previewCarimboMedico.login || previewCarimboMedico.username}</span>
              </div>
              <div className="flex justify-between">
                <span>Módulo:</span>
                <span className="font-bold text-emerald-600">ZORION-MEDICO (Prescrição A4)</span>
              </div>
            </div>

            <button
              onClick={() => setPreviewCarimboMedico(null)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              Concluir Visualização
            </button>
          </div>
        </div>
      )}

      {/* Modal Dedicado de Troca/Reset de Senha pelo Administrador */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-extrabold text-sm">
                <KeyRound className="w-5 h-5 text-amber-500" />
                Trocar Senha de Colaborador
              </div>
              <button
                onClick={() => setResetPasswordUser(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                ✕ Cancelar
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div className="text-xs text-slate-500 dark:text-slate-400">Colaborador selecionado:</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                  {resetPasswordUser.nome}
                </div>
                <div className="text-xs font-mono text-slate-600 dark:text-slate-300 mt-0.5">
                  Login: <strong>{resetPasswordUser.login || resetPasswordUser.username}</strong>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-3.5 rounded-2xl flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Privacidade do Usuário:</strong> O administrador não possui acesso visual à senha atual. Ao definir uma nova senha provisória abaixo, o colaborador será <strong>obrigado a cadastrar uma nova senha pessoal</strong> no próximo login.
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Nova Senha Provisória *
                  </label>
                  <button
                    type="button"
                    onClick={() => setNewTempPassword("123456")}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 cursor-pointer underline"
                  >
                    Usar padrão 123456
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showTempPassword ? "text" : "password"}
                    value={newTempPassword}
                    onChange={(e) => setNewTempPassword(e.target.value)}
                    placeholder="Digite a senha provisória..."
                    className="w-full pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-sm font-mono outline-none focus:border-amber-500 focus:bg-white dark:focus:bg-slate-900 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTempPassword(!showTempPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    {showTempPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setResetPasswordUser(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isResettingPassword || !newTempPassword}
                onClick={handleConfirmPasswordReset}
                className="px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {isResettingPassword ? "Salvando..." : "Confirmar e Forçar Troca"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
