import React, { useState, useEffect, useMemo } from "react";
import { 
  Dialog, 
  DialogContent 
} from "@/components/ui/dialog";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  User, 
  Pill, 
  Clock, 
  Calendar, 
  FileText, 
  Building2, 
  Bed, 
  Plus, 
  Printer, 
  Pencil, 
  Trash2, 
  Droplet, 
  UserCheck, 
  X, 
  ArrowLeftRight,
  Activity, 
  Heart,
  Stethoscope,
  ShieldAlert,
  AlertTriangle,
  FolderOpen,
  FlaskConical,
  CheckCircle2,
  FileCheck,
  Thermometer,
  Eye
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { PrescricaoService, VisitaService, PacienteService, AlaService } from "../api/db";
import { ProntuarioService } from "../api/prontuarioService";
const DIAS_SEMANA_MAP = [
  { id: 1, label: "Seg" },
  { id: 2, label: "Ter" },
  { id: 3, label: "Qua" },
  { id: 4, label: "Qui" },
  { id: 5, label: "Sex" },
  { id: 6, label: "Sáb" },
  { id: 0, label: "Dom" }
];

function parseDiasSemana(dias) {
  if (!dias) return [];
  if (Array.isArray(dias)) return dias.map(Number);
  if (typeof dias === "string") {
    try {
      const parsed = JSON.parse(dias);
      if (Array.isArray(parsed)) return parsed.map(Number);
    } catch {}
    return dias.split(",").map(s => Number(s.trim())).filter(n => !isNaN(n));
  }
  return [];
}

export function formatDiasSemana(dias) {
  const arr = parseDiasSemana(dias);
  if (arr.length === 0) return "Nenhum dia";
  if (arr.length === 7) return "Todos os dias (Diário)";
  const order = [1, 2, 3, 4, 5, 6, 0];
  const sorted = [...arr].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const str = sorted.join(',');
  if (str === "1,2,3,4,5") return "Seg a Sex";
  if (str === "1,3,5") return "Seg, Qua, Sex";
  if (str === "6,0" || str === "0,6") return "Fim de semana (Sáb/Dom)";
  if (str === "1,2,3") return "Seg, Ter, Qua";
  return sorted.map(id => DIAS_SEMANA_MAP.find(d => d.id === id)?.label || "").filter(Boolean).join(', ');
}

export function formatFrequenciaPrescricao(pr) {
  if (!pr) return "";
  const tipo = pr.tipoFrequencia || pr.tipo_frequencia || "diaria";
  if (tipo === "intervalo_dias") {
    const inter = Math.max(1, parseInt(pr.intervaloDias || pr.intervalo_dias, 10) || 1);
    if (inter === 1) return "Todos os dias (Diário)";
    if (inter === 2) return "A cada 2 dias (Dia sim / Dia não)";
    if (inter === 7) return "A cada 7 dias (Semanal)";
    if (inter === 10) return "A cada 10 dias (Ex: Haldol Decanoato)";
    if (inter === 14) return "A cada 14 dias (Quinzenal)";
    if (inter === 15) return "A cada 15 dias";
    if (inter === 21) return "A cada 21 dias (3 semanas)";
    if (inter === 28) return "A cada 28 dias (4 semanas)";
    if (inter === 30) return "A cada 30 dias (Mensal)";
    return `A cada ${inter} dias`;
  }
  return formatDiasSemana(pr.diasSemana);
}

export function isMedicamentoAntibiotico(med) {
  if (!med) return false;
  if (med.antimicrobiano) return true;
  const grupo = (med.grupo_terapeutico || "").toUpperCase();
  if (grupo.includes("ANTIBI") || grupo.includes("ANTIMICROB")) return true;
  const nome = (med.nome || "").toLowerCase();
  return /amoxicilina|ampicilina|azitromicina|claritromicina|cefalexina|ceftriaxona|cefazolina|ciprofloxacino|levofloxacino|metronidazol|vancomicina|meropenem|piperacilina|gentamicina|amikacina|clindamicina|sulfametoxazol|ceftazidima|oxacilina|penicilina|polimixina|daptomicina|linezolida|ertapenem|colistina|tobramicina/i.test(nome);
}

export function calcularDiasEntre(inicioStr, fimStr) {
  if (!inicioStr || !fimStr) return "";
  const p1 = inicioStr.split("-");
  const p2 = fimStr.split("-");
  const d1 = new Date(parseInt(p1[0], 10), parseInt(p1[1], 10) - 1, parseInt(p1[2], 10));
  const d2 = new Date(parseInt(p2[0], 10), parseInt(p2[1], 10) - 1, parseInt(p2[2], 10));
  const diffTime = d2.getTime() - d1.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  if (diffDays <= 0) return 1;
  return diffDays;
}

export function ProntuarioPacienteModal({
  open,
  onOpenChange,
  patient,
  prescricoes = [],
  medicamentos = [],
  onOpenNewPrescricao,
  onEditPrescricao,
  onOpenPrintReceita,
  onRefresh
}) {
  const [activeTab, setActiveTab] = useState("medicacoes"); // "resumo" | "historico_clinico" | "medicacoes" | "visitas" | "exames" | "alergias" | "documentos"
  
  // Dados do prontuário carregados do PostgreSQL
  const [visitas, setVisitas] = useState([]);
  const [evolucoes, setEvolucoes] = useState([]);
  const [exames, setExames] = useState([]);
  const [alergias, setAlergias] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  // Modais de Ação do Cabeçalho
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [editPatientModalOpen, setEditPatientModalOpen] = useState(false);
  const [alas, setAlas] = useState([]);
  const [selectedAla, setSelectedAla] = useState("");
  const [selectedLeito, setSelectedLeito] = useState("");
  const [patientEditForm, setPatientEditForm] = useState({
    nome: "",
    prontuario: "",
    idade: "",
    leito: ""
  });

  // Modal de Suspensão de Medicação
  const [suspendModalOpen, setSuspendModalOpen] = useState(false);
  const [prescToSuspend, setPrescToSuspend] = useState(null);
  const [motivoSuspensao, setMotivoSuspensao] = useState("");
  const [isSuspending, setIsSuspending] = useState(false);

  // Modal: Nova Evolução Clínica
  const [evolucaoModalOpen, setEvolucaoModalOpen] = useState(false);
  const [evolucaoForm, setEvolucaoForm] = useState({
    tipo: "Evolução Médica",
    titulo: "Evolução Diária de Plantão",
    descricao: "",
    conduta: "",
    pressao_arterial: "",
    frequencia_cardiaca: "",
    temperatura: "",
    saturacao_o2: "",
    glicemia: ""
  });

  // Modal: Novo Exame
  const [exameModalOpen, setExameModalOpen] = useState(false);
  const [exameForm, setExameForm] = useState({
    tipo: "Laboratorial",
    nome_exame: "",
    data_solicitacao: new Date().toISOString().slice(0, 10),
    data_resultado: new Date().toISOString().slice(0, 10),
    status: "Concluído",
    resultado: "",
    valores_referencia: "",
    solicitante_nome: "",
    laudo_medico: ""
  });
  const [exameFiltro, setExameFiltro] = useState("todos");

  // Modal: Nova Alergia
  const [alergiaModalOpen, setAlergiaModalOpen] = useState(false);
  const [alergiaForm, setAlergiaForm] = useState({
    agente: "",
    tipo: "Medicamentosa",
    gravidade: "Grave",
    reacao: ""
  });

  // Modal: Novo Documento
  const [documentoModalOpen, setDocumentoModalOpen] = useState(false);
  const [documentoForm, setDocumentoForm] = useState({
    titulo: "",
    categoria: "Relatório Médico",
    conteudo: "",
    data_emissao: new Date().toISOString().slice(0, 10)
  });

  // Modal: Visualizar Documento
  const [docViewOpen, setDocViewOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);

  // Modal: Registrar Sinais Vitais Rápidos
  const [vitalsModalOpen, setVitalsModalOpen] = useState(false);
  const [vitalsForm, setVitalsForm] = useState({
    pressao_arterial: "120/80",
    frequencia_cardiaca: "76",
    temperatura: "36.5",
    saturacao_o2: "98",
    glicemia: "95"
  });

  // Diagnóstico Rápido
  const [editingDiagnostico, setEditingDiagnostico] = useState(false);
  const [diagnosticoText, setDiagnosticoText] = useState("");

  // Usuário médico logado
  const currentDoctor = useMemo(() => {
    try {
      const saved = sessionStorage.getItem("zorion_medico_user") || 
                    sessionStorage.getItem("zorion_recepcao_user") ||
                    localStorage.getItem("pharma_user");
      if (saved) return JSON.parse(saved);
    } catch {}
    return { nome: "Médico Assistente", crm: "CRM/SP 000000", cargo: "Médico" };
  }, []);

  // Carrega todos os dados do paciente ao abrir
  const loadProntuarioData = async () => {
    if (!patient?.id) return;
    setLoadingData(true);
    try {
      const [vList, evList, exList, alList, dcList] = await Promise.all([
        VisitaService.list({ pacienteId: patient.id }).catch(() => []),
        ProntuarioService.listEvolucoes(patient.id),
        ProntuarioService.listExames(patient.id),
        ProntuarioService.listAlergias(patient.id),
        ProntuarioService.listDocumentos(patient.id)
      ]);
      setVisitas(vList || []);
      setEvolucoes(evList || []);
      setExames(exList || []);
      setAlergias(alList || []);
      setDocumentos(dcList || []);
      setDiagnosticoText(patient.diagnostico || patient.observacoes || "");
    } catch (e) {
      console.warn("Aviso ao carregar dados do prontuário:", e);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (open && patient?.id) {
      loadProntuarioData();
    }
  }, [open, patient]);

  // Carrega alas para transferência
  useEffect(() => {
    if (transferModalOpen) {
      AlaService.list()
        .then(data => setAlas(data || []))
        .catch(err => console.warn("Erro ao buscar alas:", err));
      if (patient) {
        setSelectedAla(patient.alaId || "");
        setSelectedLeito(patient.leito || "");
      }
    }
  }, [transferModalOpen, patient]);

  // Preenche formulário de edição do paciente
  useEffect(() => {
    if (editPatientModalOpen && patient) {
      setPatientEditForm({
        nome: patient.nome || "",
        prontuario: patient.prontuario || "",
        idade: patient.idade || "",
        leito: patient.leito || ""
      });
    }
  }, [editPatientModalOpen, patient]);

  // Prescrições filtradas para este paciente
  const patientPrescricoes = useMemo(() => {
    if (!patient?.id) return [];
    const patId = String(patient.id);
    const patPront = String(patient.prontuario || "").trim();
    const patNome = String(patient.nome || "").trim().toLowerCase();

    return (prescricoes || []).filter(pr => {
      const pId = String(pr.pacienteId || pr.paciente_id || pr.pacienteid || "");
      if (pId && pId !== "[object Object]" && pId === patId) return true;
      if (patPront && pr.prontuario && String(pr.prontuario).trim() === patPront) return true;
      if (patNome && pr.pacienteNome && String(pr.pacienteNome).trim().toLowerCase() === patNome) return true;
      return false;
    });
  }, [prescricoes, patient]);

  const hojeStr = format(new Date(), "yyyy-MM-dd");

  const prescricoesAtivas = useMemo(() => {
    return patientPrescricoes.filter(pr => {
      const status = (pr.status || "Ativa").trim().toLowerCase();
      if (status !== "ativa") return false;
      if (pr.dataFim && pr.dataFim < hojeStr) return false;
      return true;
    });
  }, [patientPrescricoes, hojeStr]);

  const prescricoesHistorico = useMemo(() => {
    return patientPrescricoes.filter(pr => {
      const status = (pr.status || "Ativa").trim().toLowerCase();
      if (status === "suspensa" || status === "devolvida" || status === "inativa") return true;
      if (pr.dataFim && pr.dataFim < hojeStr) return true;
      return false;
    });
  }, [patientPrescricoes, hojeStr]);

  // Últimos sinais vitais registrados nas evoluções
  const ultimosSinais = useMemo(() => {
    for (const ev of evolucoes) {
      if (ev.pressao_arterial || ev.frequencia_cardiaca || ev.temperatura || ev.saturacao_o2 || ev.glicemia) {
        return {
          pa: ev.pressao_arterial || "--",
          fc: ev.frequencia_cardiaca || "--",
          temp: ev.temperatura || "--",
          sat: ev.saturacao_o2 || "--",
          gli: ev.glicemia || "--",
          data: ev.data_hora
        };
      }
    }
  }, [evolucoes]);

  // Filtragem de Exames (Chamado no nível superior seguindo as regras dos hooks do React)
  const filteredExames = useMemo(() => {
    if (exameFiltro === "todos") return exames;
    return exames.filter(ex => (ex.tipo || "").toLowerCase().includes(exameFiltro.toLowerCase()));
  }, [exames, exameFiltro]);

  // ─── HANDLERS DE AÇÕES ──────────────────────────────────────────────────────

  // Suspensão de medicamento
  const handleOpenSuspend = (pr) => {
    setPrescToSuspend(pr);
    setMotivoSuspensao("");
    setSuspendModalOpen(true);
  };

  const handleConfirmSuspend = async () => {
    if (!prescToSuspend) return;
    setIsSuspending(true);
    try {
      const doctorName = currentDoctor?.nome ? `Dr(a). ${currentDoctor.nome}` : "Médico Assistente";
      const motivoFinal = motivoSuspensao.trim() 
        ? `${motivoSuspensao.trim()} (Suspenso por ${doctorName})`
        : `Suspenso clinicamente por ${doctorName}`;

      await PrescricaoService.suspend(prescToSuspend.id, motivoFinal);
      toast.success(`Medicamento "${prescToSuspend.medicamentoNome}" suspenso.`);
      setSuspendModalOpen(false);
      setPrescToSuspend(null);
      if (onRefresh) onRefresh();
    } catch (e) {
      toast.error("Erro ao suspender medicamento.");
    } finally {
      setIsSuspending(false);
    }
  };

  // Transferência de Ala
  const handleSaveTransfer = async () => {
    try {
      const alaObj = alas.find(a => a.id === selectedAla);
      await PacienteService.update(patient.id, {
        alaId: selectedAla,
        alaNome: alaObj ? alaObj.nome : patient.alaNome,
        leito: selectedLeito
      });
      patient.alaId = selectedAla;
      patient.alaNome = alaObj ? alaObj.nome : patient.alaNome;
      patient.leito = selectedLeito;
      toast.success("Paciente transferido com sucesso!");
      setTransferModalOpen(false);
      if (onRefresh) onRefresh();
    } catch (e) {
      toast.error("Erro ao transferir ala.");
    }
  };

  // Edição Cadastral do Paciente
  const handleSaveEditPatient = async () => {
    try {
      await PacienteService.update(patient.id, {
        nome: patientEditForm.nome,
        prontuario: patientEditForm.prontuario,
        idade: patientEditForm.idade ? parseInt(patientEditForm.idade, 10) : null,
        leito: patientEditForm.leito
      });
      patient.nome = patientEditForm.nome;
      patient.prontuario = patientEditForm.prontuario;
      patient.idade = patientEditForm.idade ? parseInt(patientEditForm.idade, 10) : patient.idade;
      patient.leito = patientEditForm.leito;
      toast.success("Dados do paciente atualizados!");
      setEditPatientModalOpen(false);
      if (onRefresh) onRefresh();
    } catch (e) {
      toast.error("Erro ao atualizar paciente.");
    }
  };

  // Salvar Nova Evolução Clínica
  const handleSaveEvolucao = async (e) => {
    e?.preventDefault();
    if (!evolucaoForm.descricao.trim()) {
      toast.error("Preencha a descrição clínica da evolução.");
      return;
    }
    try {
      await ProntuarioService.createEvolucao({
        paciente_id: patient.id,
        tipo: evolucaoForm.tipo,
        titulo: evolucaoForm.titulo || "Evolução Médica",
        descricao: evolucaoForm.descricao,
        conduta: evolucaoForm.conduta,
        pressao_arterial: evolucaoForm.pressao_arterial,
        frequencia_cardiaca: evolucaoForm.frequencia_cardiaca,
        temperatura: evolucaoForm.temperatura,
        saturacao_o2: evolucaoForm.saturacao_o2,
        glicemia: evolucaoForm.glicemia,
        profissional_nome: currentDoctor.nome || "Médico Assistente",
        profissional_cargo: currentDoctor.cargo || "Médico",
        profissional_crm: currentDoctor.crm || ""
      });
      toast.success("Evolução clínica registrada com sucesso!");
      setEvolucaoModalOpen(false);
      setEvolucaoForm({
        tipo: "Evolução Médica",
        titulo: "Evolução Diária de Plantão",
        descricao: "",
        conduta: "",
        pressao_arterial: "",
        frequencia_cardiaca: "",
        temperatura: "",
        saturacao_o2: "",
        glicemia: ""
      });
      loadProntuarioData();
    } catch (err) {
      toast.error("Erro ao salvar evolução clínica.");
    }
  };

  const handleDeleteEvolucao = async (id) => {
    if (!window.confirm("Deseja realmente excluir este registro de evolução?")) return;
    try {
      await ProntuarioService.deleteEvolucao(id);
      toast.success("Evolução excluída.");
      loadProntuarioData();
    } catch {
      toast.error("Erro ao excluir evolução.");
    }
  };

  // Salvar Novo Exame
  const handleSaveExame = async (e) => {
    e?.preventDefault();
    if (!exameForm.nome_exame.trim()) {
      toast.error("Informe o nome do exame.");
      return;
    }
    try {
      await ProntuarioService.createExame({
        paciente_id: patient.id,
        tipo: exameForm.tipo,
        nome_exame: exameForm.nome_exame,
        data_solicitacao: exameForm.data_solicitacao,
        data_resultado: exameForm.status === "Concluído" ? exameForm.data_resultado : null,
        status: exameForm.status,
        resultado: exameForm.resultado,
        valores_referencia: exameForm.valores_referencia,
        solicitante_nome: exameForm.solicitante_nome || currentDoctor.nome,
        laudo_medico: exameForm.laudo_medico
      });
      toast.success("Exame cadastrado com sucesso!");
      setExameModalOpen(false);
      setExameForm({
        tipo: "Laboratorial",
        nome_exame: "",
        data_solicitacao: new Date().toISOString().slice(0, 10),
        data_resultado: new Date().toISOString().slice(0, 10),
        status: "Concluído",
        resultado: "",
        valores_referencia: "",
        solicitante_nome: "",
        laudo_medico: ""
      });
      loadProntuarioData();
    } catch {
      toast.error("Erro ao cadastrar exame.");
    }
  };

  const handleDeleteExame = async (id) => {
    if (!window.confirm("Deseja realmente remover este exame?")) return;
    try {
      await ProntuarioService.deleteExame(id);
      toast.success("Exame removido.");
      loadProntuarioData();
    } catch {
      toast.error("Erro ao excluir exame.");
    }
  };

  // Salvar Nova Alergia
  const handleSaveAlergia = async (e) => {
    e?.preventDefault();
    if (!alergiaForm.agente.trim()) {
      toast.error("Informe a substância ou alérgeno.");
      return;
    }
    try {
      await ProntuarioService.createAlergia({
        paciente_id: patient.id,
        agente: alergiaForm.agente.trim(),
        tipo: alergiaForm.tipo,
        gravidade: alergiaForm.gravidade,
        reacao: alergiaForm.reacao,
        registrado_por: currentDoctor.nome
      });
      toast.success("Alergia registrada no prontuário!");
      setAlergiaModalOpen(false);
      setAlergiaForm({ agente: "", tipo: "Medicamentosa", gravidade: "Grave", reacao: "" });
      loadProntuarioData();
    } catch {
      toast.error("Erro ao registrar alergia.");
    }
  };

  const handleDeleteAlergia = async (id) => {
    if (!window.confirm("Deseja remover o registro desta alergia?")) return;
    try {
      await ProntuarioService.deleteAlergia(id, patient.id);
      toast.success("Alergia removida.");
      loadProntuarioData();
    } catch {
      toast.error("Erro ao excluir alergia.");
    }
  };

  // Salvar Novo Documento
  const handleSaveDocumento = async (e) => {
    e?.preventDefault();
    if (!documentoForm.titulo.trim() || !documentoForm.conteudo.trim()) {
      toast.error("Preencha título e conteúdo do documento.");
      return;
    }
    try {
      await ProntuarioService.createDocumento({
        paciente_id: patient.id,
        titulo: documentoForm.titulo.trim(),
        categoria: documentoForm.categoria,
        conteudo: documentoForm.conteudo,
        responsavel_nome: currentDoctor.nome,
        responsavel_cargo: currentDoctor.cargo || "Médico",
        data_emissao: documentoForm.data_emissao
      });
      toast.success("Documento arquivado no prontuário!");
      setDocumentoModalOpen(false);
      setDocumentoForm({
        titulo: "",
        categoria: "Relatório Médico",
        conteudo: "",
        data_emissao: new Date().toISOString().slice(0, 10)
      });
      loadProntuarioData();
    } catch {
      toast.error("Erro ao arquivar documento.");
    }
  };

  const handleDeleteDocumento = async (id) => {
    if (!window.confirm("Deseja realmente excluir este documento?")) return;
    try {
      await ProntuarioService.deleteDocumento(id);
      toast.success("Documento excluído.");
      loadProntuarioData();
    } catch {
      toast.error("Erro ao excluir documento.");
    }
  };

  // Salvar Diagnóstico
  const handleSaveDiagnostico = async () => {
    try {
      await ProntuarioService.updatePacienteResumo(patient.id, {
        diagnostico: diagnosticoText,
        observacoes: diagnosticoText
      });
      patient.diagnostico = diagnosticoText;
      patient.observacoes = diagnosticoText;
      toast.success("Diagnóstico atualizado no prontuário!");
      setEditingDiagnostico(false);
    } catch {
      toast.error("Erro ao atualizar diagnóstico.");
    }
  };

  // Salvar Sinais Vitais Rápidos via Evolução
  const handleSaveQuickVitals = async () => {
    try {
      await ProntuarioService.createEvolucao({
        paciente_id: patient.id,
        tipo: "Sinais Vitais",
        titulo: "Registro Rápido de Sinais Vitais",
        descricao: `PA: ${vitalsForm.pressao_arterial} mmHg | FC: ${vitalsForm.frequencia_cardiaca} bpm | Temp: ${vitalsForm.temperatura} °C | SatO2: ${vitalsForm.saturacao_o2}% | Glicemia: ${vitalsForm.glicemia} mg/dL`,
        pressao_arterial: vitalsForm.pressao_arterial,
        frequencia_cardiaca: vitalsForm.frequencia_cardiaca,
        temperatura: vitalsForm.temperatura,
        saturacao_o2: vitalsForm.saturacao_o2,
        glicemia: vitalsForm.glicemia,
        profissional_nome: currentDoctor.nome,
        profissional_cargo: currentDoctor.cargo
      });
      toast.success("Sinais vitais registrados com sucesso!");
      setVitalsModalOpen(false);
      loadProntuarioData();
    } catch {
      toast.error("Erro ao salvar sinais vitais.");
    }
  };

  if (!patient) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[1150px] w-[96vw] h-[92vh] flex flex-col p-0 border-0 shadow-2xl rounded-xl bg-slate-50 dark:bg-slate-900 overflow-hidden print:m-0 print:p-0">
          
          {/* ─── CABEÇALHO AZUL ROYAL (#0e3b8f) IDÊNTICO À FOTO ─── */}
          <div className="bg-[#0e3b8f] text-white p-6 shrink-0 relative">
            
            {/* Botão de Fechar no Topo Direito */}
            <button
              onClick={() => onOpenChange(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-white/15 text-white/80 hover:text-white transition-colors cursor-pointer"
              title="Fechar prontuário"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pr-6">
              
              {/* Avatar e Identificação do Paciente */}
              <div className="flex items-start gap-4 min-w-0 flex-1">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white/40 shadow-inner flex items-center justify-center text-[#0e3b8f] shrink-0 mt-0.5 overflow-hidden">
                  {patient.foto ? (
                    <img 
                      src={patient.foto} 
                      alt={patient.nome} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <User className="w-8 h-8 sm:w-10 sm:h-10 text-slate-400" />
                  )}
                </div>

                <div className="min-w-0 flex-1 break-words whitespace-normal leading-tight">
                  <h2 className="text-xl sm:text-2xl font-black mb-1 break-words whitespace-normal leading-tight text-white">
                    {patient.nome}
                  </h2>
                  <div className="text-blue-200 text-xs sm:text-sm flex gap-2 flex-wrap items-center">
                    <span>ID: {patient.prontuario || "8999"}</span> |
                    <span>{patient.idade ? `${patient.idade} anos` : "-- anos"}</span>
                  </div>
                  <div className="text-blue-200 text-xs sm:text-sm mt-1 flex items-center gap-2 flex-wrap">
                    <span>Setor: {patient.alaNome || "N1"}</span> |
                    <span>Leito: {patient.leito || "S/L"}</span>
                  </div>
                </div>
              </div>

              {/* Ações e Data de Atualização */}
              <div className="text-right flex flex-col items-start sm:items-end gap-2 shrink-0">
                <div className="text-blue-200 text-xs sm:text-sm mb-1">
                  Última atualização: {new Date().toLocaleDateString('pt-BR')}
                </div>
                
                <div className="flex gap-2 flex-wrap">
                  <Button 
                    variant="outline" 
                    className="border-white/30 text-white hover:bg-white/10 bg-transparent rounded-full px-4 gap-1.5 text-xs sm:text-sm cursor-pointer shadow-xs" 
                    onClick={() => onOpenPrintReceita(patient, prescricoesAtivas)}
                    title="Imprimir relatório de prescrição deste paciente"
                  >
                    <Printer className="w-4 h-4" />
                    Imprimir Prescrição
                  </Button>

                  <Button 
                    variant="outline" 
                    className="border-white/30 text-white hover:bg-white/10 bg-transparent rounded-full px-4 gap-1.5 text-xs sm:text-sm cursor-pointer shadow-xs" 
                    onClick={() => setTransferModalOpen(true)}
                    title="Transferir paciente de ala ou leito"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    Transferir Ala
                  </Button>

                  <Button 
                    variant="outline" 
                    className="border-white/30 text-white hover:bg-white/10 bg-transparent rounded-full px-4 text-xs sm:text-sm cursor-pointer shadow-xs" 
                    onClick={() => setEditPatientModalOpen(true)}
                    title="Editar informações do paciente"
                  >
                    Editar Paciente
                  </Button>
                </div>
              </div>

            </div>
          </div>

          {/* ─── ABAS DE NAVEGAÇÃO SUPERIORES ─── */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-6 shrink-0 pt-2 overflow-x-auto hide-scrollbar">
            <button 
              onClick={() => setActiveTab('resumo')} 
              className={cn(
                "px-4 py-3 font-semibold text-sm border-b-2 transition-colors whitespace-nowrap cursor-pointer", 
                activeTab === 'resumo' 
                  ? 'border-blue-600 text-blue-700 dark:text-blue-400' 
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              )}
            >
              Resumo
            </button>

            <button 
              onClick={() => setActiveTab('historico_clinico')} 
              className={cn(
                "px-4 py-3 font-semibold text-sm border-b-2 transition-colors whitespace-nowrap cursor-pointer", 
                activeTab === 'historico_clinico' 
                  ? 'border-blue-600 text-blue-700 dark:text-blue-400' 
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              )}
            >
              Histórico Clínico
            </button>

            <button 
              onClick={() => setActiveTab('medicacoes')} 
              className={cn(
                "px-4 py-3 font-semibold text-sm border-b-2 transition-colors whitespace-nowrap cursor-pointer", 
                activeTab === 'medicacoes' 
                  ? 'border-blue-600 text-blue-700 dark:text-blue-400' 
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              )}
            >
              Medicações
            </button>

            <button 
              onClick={() => setActiveTab('visitas')} 
              className={cn(
                "px-4 py-3 font-semibold text-sm border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer", 
                activeTab === 'visitas' 
                  ? 'border-blue-600 text-blue-700 dark:text-blue-400' 
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              )}
            >
              <UserCheck className="w-4 h-4 text-emerald-600" />
              Visitas ({visitas.length})
            </button>

            <button 
              onClick={() => setActiveTab('exames')} 
              className={cn(
                "px-4 py-3 font-semibold text-sm border-b-2 transition-colors whitespace-nowrap cursor-pointer", 
                activeTab === 'exames' 
                  ? 'border-blue-600 text-blue-700 dark:text-blue-400' 
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              )}
            >
              Exames ({exames.length})
            </button>

            <button 
              onClick={() => setActiveTab('alergias')} 
              className={cn(
                "px-4 py-3 font-semibold text-sm border-b-2 transition-colors whitespace-nowrap cursor-pointer", 
                activeTab === 'alergias' 
                  ? 'border-blue-600 text-blue-700 dark:text-blue-400' 
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              )}
            >
              Alergias ({alergias.length})
            </button>

            <button 
              onClick={() => setActiveTab('documentos')} 
              className={cn(
                "px-4 py-3 font-semibold text-sm border-b-2 transition-colors whitespace-nowrap cursor-pointer", 
                activeTab === 'documentos' 
                  ? 'border-blue-600 text-blue-700 dark:text-blue-400' 
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              )}
            >
              Documentos ({documentos.length})
            </button>
          </div>

          {/* ─── CORPO PRINCIPAL DO PRONTUÁRIO ─── */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900">
            
            {/* ================================================================= */}
            {/* ABA 1: RESUMO CLÍNICO INTEGRADO */}
            {/* ================================================================= */}
            {activeTab === 'resumo' && (
              <div className="space-y-6 max-w-6xl mx-auto pb-10">
                
                {/* Alerta de Alergia Crítica caso exista */}
                {alergias.length > 0 && (
                  <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl flex items-center justify-between gap-4 text-rose-900 shadow-sm animate-in fade-in duration-200">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-rose-100 rounded-xl text-rose-600">
                        <ShieldAlert className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-black text-sm">Alergias Críticas Registradas</h4>
                        <p className="text-xs text-rose-700 mt-0.5">
                          {alergias.map(a => `${a.agente} (${a.gravidade})`).join(" • ")}
                        </p>
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setActiveTab('alergias')}
                      className="border-rose-300 text-rose-800 hover:bg-rose-100 text-xs font-bold rounded-xl shrink-0 cursor-pointer"
                    >
                      Ver Detalhes
                    </Button>
                  </div>
                )}

                {/* Sinais Vitais Rápidos */}
                <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                        <Activity className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                          Sinais Vitais Recentes
                        </h3>
                        <p className="text-xs text-slate-400">
                          {ultimosSinais.data ? `Última medição: ${format(new Date(ultimosSinais.data), "dd/MM/yyyy 'às' HH:mm")}` : "Valores basais de monitorização"}
                        </p>
                      </div>
                    </div>

                    <Button 
                      size="sm"
                      onClick={() => setVitalsModalOpen(true)}
                      className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Registrar Sinais
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                      <span className="text-[11px] font-bold text-slate-400 uppercase">Pressão Arterial</span>
                      <p className="text-xl font-black text-slate-800 dark:text-slate-100 mt-1">{ultimosSinais.pa}</p>
                      <span className="text-[10px] text-slate-400">mmHg</span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                      <span className="text-[11px] font-bold text-slate-400 uppercase">Frequência Card.</span>
                      <p className="text-xl font-black text-rose-600 mt-1">{ultimosSinais.fc}</p>
                      <span className="text-[10px] text-slate-400">bpm</span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                      <span className="text-[11px] font-bold text-slate-400 uppercase">Temperatura</span>
                      <p className="text-xl font-black text-amber-600 mt-1">{ultimosSinais.temp}</p>
                      <span className="text-[10px] text-slate-400">°C</span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                      <span className="text-[11px] font-bold text-slate-400 uppercase">Saturação O2</span>
                      <p className="text-xl font-black text-sky-600 mt-1">{ultimosSinais.sat}%</p>
                      <span className="text-[10px] text-slate-400">em ar ambiente</span>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 text-center col-span-2 sm:col-span-1">
                      <span className="text-[11px] font-bold text-slate-400 uppercase">Glicemia Capilar</span>
                      <p className="text-xl font-black text-emerald-600 mt-1">{ultimosSinais.gli}</p>
                      <span className="text-[10px] text-slate-400">mg/dL</span>
                    </div>
                  </div>
                </div>

                {/* Diagnóstico e Internação */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        Diagnóstico & Hipóteses
                      </h3>
                      {!editingDiagnostico ? (
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => setEditingDiagnostico(true)}
                          className="h-7 px-2 text-xs text-blue-600 hover:bg-blue-50 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5 mr-1" />
                          Editar
                        </Button>
                      ) : (
                        <div className="flex gap-1">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => setEditingDiagnostico(false)}
                            className="h-7 px-2 text-xs"
                          >
                            Cancelar
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={handleSaveDiagnostico}
                            className="h-7 px-2.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold"
                          >
                            Salvar
                          </Button>
                        </div>
                      )}
                    </div>

                    {editingDiagnostico ? (
                      <Textarea 
                        value={diagnosticoText}
                        onChange={(e) => setDiagnosticoText(e.target.value)}
                        placeholder="Descreva o diagnóstico clínico principal, comorbidades e CID..."
                        className="text-xs min-h-[90px] rounded-xl"
                      />
                    ) : (
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 min-h-[80px]">
                        {patient.diagnostico || patient.observacoes || "Nenhum diagnóstico formal cadastrado ainda. Clique em Editar para registrar."}
                      </p>
                    )}
                  </div>

                  {/* Resumo de Medicações em Uso */}
                  <div className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Pill className="w-4 h-4 text-emerald-600" />
                        Medicamentos Ativos ({prescricoesAtivas.length})
                      </h3>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => setActiveTab('medicacoes')}
                        className="h-7 px-2 text-xs text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                      >
                        Ver Todos →
                      </Button>
                    </div>

                    <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                      {prescricoesAtivas.length === 0 ? (
                        <p className="text-xs text-slate-400 py-4 text-center">Nenhuma medicação ativa no momento.</p>
                      ) : (
                        prescricoesAtivas.map(pr => (
                          <div key={pr.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-xs">
                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[220px]">
                              {pr.medicamentoNome}
                            </span>
                            <span className="font-mono text-slate-500 font-semibold">{pr.esquemaPosologico}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ================================================================= */}
            {/* ABA 2: HISTÓRICO CLÍNICO (TIMELINE DE EVOLUÇÕES MÉDICAS) */}
            {/* ================================================================= */}
            {activeTab === 'historico_clinico' && (
              <div className="space-y-6 max-w-5xl mx-auto pb-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                      <Stethoscope className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-base text-slate-900 dark:text-slate-100">
                        Evolução Clínica & Anamnese
                      </h3>
                      <p className="text-xs text-slate-500">
                        Histórico cronológico de acompanhamento médico e multiprofissional
                      </p>
                    </div>
                  </div>

                  <Button 
                    onClick={() => setEvolucaoModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 text-xs font-bold gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Nova Evolução Clínica
                  </Button>
                </div>

                {/* Linha do tempo de evoluções */}
                <div className="space-y-4">
                  {evolucoes.length === 0 ? (
                    <div className="bg-white dark:bg-slate-950 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
                      <Stethoscope className="w-12 h-12 text-slate-300 mx-auto" />
                      <h4 className="font-bold text-sm text-slate-700 dark:text-slate-200">
                        Nenhuma evolução registrada para este paciente
                      </h4>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        Registre a primeira evolução médica ou de enfermagem para documentar o acompanhamento do paciente.
                      </p>
                      <Button 
                        onClick={() => setEvolucaoModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                      >
                        Registrar Primeira Evolução
                      </Button>
                    </div>
                  ) : (
                    evolucoes.map((ev, index) => (
                      <div 
                        key={ev.id} 
                        className="bg-white dark:bg-slate-950 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 hover:border-blue-200 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className="bg-blue-600 text-white text-[10px] font-bold">
                              {ev.tipo || "Evolução Médica"}
                            </Badge>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                              {ev.titulo || "Evolução de Plantão"}
                            </span>
                            <span className="text-xs text-slate-400">•</span>
                            <span className="text-xs text-slate-500 font-mono">
                              {format(new Date(ev.data_hora), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 font-medium">
                              {ev.profissional_nome} {ev.profissional_crm ? `(${ev.profissional_crm})` : ""}
                            </span>
                            <button
                              onClick={() => handleDeleteEvolucao(ev.id)}
                              className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                              title="Excluir evolução"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Sinais Vitais se houver */}
                        {(ev.pressao_arterial || ev.frequencia_cardiaca || ev.temperatura || ev.saturacao_o2 || ev.glicemia) && (
                          <div className="flex items-center gap-3 flex-wrap p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl text-[11px] font-semibold text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-800">
                            {ev.pressao_arterial && <span>PA: <strong>{ev.pressao_arterial}</strong> mmHg</span>}
                            {ev.frequencia_cardiaca && <span>FC: <strong>{ev.frequencia_cardiaca}</strong> bpm</span>}
                            {ev.temperatura && <span>Temp: <strong>{ev.temperatura}</strong> °C</span>}
                            {ev.saturacao_o2 && <span>SatO2: <strong>{ev.saturacao_o2}</strong>%</span>}
                            {ev.glicemia && <span>Glicemia: <strong>{ev.glicemia}</strong> mg/dL</span>}
                          </div>
                        )}

                        {/* Conteúdo Clínico */}
                        <div className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                          {ev.descricao}
                        </div>

                        {/* Conduta Médica */}
                        {ev.conduta && (
                          <div className="p-3 bg-blue-50/60 dark:bg-blue-950/30 border-l-3 border-blue-600 rounded-r-xl text-xs space-y-1">
                            <strong className="text-blue-900 dark:text-blue-300 block font-bold">Plano / Conduta Médica:</strong>
                            <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                              {ev.conduta}
                            </p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ================================================================= */}
            {/* ABA 3: MEDICAÇÕES (IDÊNTICA À FOTO DA FARMÁCIA SATÉLITE) */}
            {/* ================================================================= */}
            {activeTab === 'medicacoes' && (
              <div className="space-y-6 max-w-6xl mx-auto pb-10">
                
                {/* 1. Medicações Ativas */}
                <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-3">
                      <div className="bg-emerald-100 p-2 rounded-lg text-emerald-700">
                        <Pill className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-500 leading-tight">
                          Medicações Ativas
                        </h3>
                        <p className="text-sm text-slate-500">
                          Medicamentos que o paciente está tomando atualmente
                        </p>
                      </div>
                    </div>
                    
                    <Button 
                      className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg px-4 gap-2 font-semibold shadow-sm cursor-pointer" 
                      onClick={() => onOpenNewPrescricao(patient?.id || patient)}
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Medicação
                    </Button>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50/50">
                        <TableRow>
                          <TableHead className="font-bold text-slate-600">Medicamento</TableHead>
                          <TableHead className="font-bold text-slate-600">Dose</TableHead>
                          <TableHead className="font-bold text-slate-600">Frequência</TableHead>
                          <TableHead className="font-bold text-slate-600">Via</TableHead>
                          <TableHead className="font-bold text-slate-600">Período / Duração</TableHead>
                          <TableHead className="font-bold text-slate-600">Prescrito por</TableHead>
                          <TableHead className="font-bold text-slate-600 text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      
                      <TableBody>
                        {prescricoesAtivas.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-slate-500 font-medium">
                              Nenhuma medicação ativa.
                            </TableCell>
                          </TableRow>
                        ) : (
                          prescricoesAtivas.map(pr => {
                            const med = medicamentos.find(m => m.id === (pr.medicamentoId || pr.medicamento_id));
                            const via = pr.viaAdministracao || pr.via_administracao || med?.via_administracao || "Oral";
                            const apresentacao = pr.apresentacao || med?.apresentacao || "Comprimido";
                            const rawConc = (pr.concentracao || med?.concentracao || (med?.unidade_medida && !["un", "unidade", "unid", "-", ""].includes(med?.unidade_medida?.toLowerCase()) ? med?.unidade_medida : "") || "").trim();
                            const hasConcInName = rawConc && pr.medicamentoNome?.toLowerCase().includes(rawConc.toLowerCase());
                            const concentracao = rawConc && !hasConcInName ? rawConc : "";

                            return (
                              <TableRow key={pr.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors border-b border-slate-100 dark:border-slate-800">
                                
                                <TableCell className="font-semibold text-slate-800 dark:text-slate-200 py-3 max-w-[280px] min-w-[170px] break-words whitespace-normal leading-snug">
                                  <span className="block">
                                    {pr.medicamentoNome}
                                    {concentracao && (
                                      <span className="ml-1 text-slate-600 dark:text-slate-400 font-medium">
                                        ({concentracao})
                                      </span>
                                    )}
                                  </span>
                                  <Badge variant="outline" className="inline-block w-auto max-w-full truncate mt-1 text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 rounded">
                                    {apresentacao}
                                  </Badge>
                                </TableCell>

                                <TableCell className="text-slate-600 dark:text-slate-300 text-sm font-medium">
                                  {pr.is_liquido ? (
                                    <div>
                                      <div className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                                        <Droplet className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                        {pr.totalDiario} {pr.unidade_dose === 'gotas' ? 'gotas/dia' : 'mL/dia'}
                                      </div>
                                      {pr.unidade_dose === 'gotas' && (
                                        <span className="text-[10px] text-slate-400 block font-normal">
                                          ({(Number(pr.totalDiario) / 20).toFixed(1)} mL/dia)
                                        </span>
                                      )}
                                      <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-[10px] font-bold mt-1 block w-max">
                                        💧 Frasco {pr.volume_frasco_ml || 100} mL ({pr.duracao_frasco_dias || 10}d)
                                      </Badge>
                                    </div>
                                  ) : (
                                    <div>
                                      <div>{pr.totalDiario} un/dia</div>
                                      {pr.tipoFrequencia === "intervalo_dias" ? (
                                        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-bold mt-1 block w-max">
                                          ⏱️ A cada {pr.intervaloDias || 1} dias
                                        </Badge>
                                      ) : formatDiasSemana(pr.diasSemana) !== "Todos os dias (Diário)" ? (
                                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold mt-1 block w-max">
                                          📅 {formatDiasSemana(pr.diasSemana)}
                                        </Badge>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 block mt-0.5">Diário</span>
                                      )}
                                    </div>
                                  )}
                                </TableCell>

                                <TableCell className="text-slate-600 text-sm font-medium">
                                  <div className="font-mono font-bold text-slate-900 dark:text-slate-100">
                                    {pr.esquemaPosologico}
                                  </div>
                                  <div className="mt-1">
                                    <span className={cn(
                                      "text-[10px] font-bold px-1.5 py-0.5 rounded border inline-flex items-center gap-1",
                                      pr.horarioInicio === "22:00" 
                                        ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                        : pr.horarioInicio === "14:00"
                                        ? "bg-amber-50 text-amber-700 border-amber-200"
                                        : pr.horarioInicio === "06:00"
                                        ? "bg-purple-50 text-purple-700 border-purple-200"
                                        : "bg-blue-50 text-blue-700 border-blue-200"
                                    )}>
                                      {pr.horarioInicio === "22:00" ? "🌙 Início: 22h" :
                                       pr.horarioInicio === "14:00" ? "🌤️ Início: 14h" :
                                       pr.horarioInicio === "06:00" ? "🌌 Início: 06h" :
                                       "☀️ Início: 08h"}
                                    </span>
                                  </div>
                                </TableCell>

                                <TableCell className="text-slate-600 text-sm">
                                  {via}
                                </TableCell>

                                <TableCell className="text-slate-600 text-xs py-3">
                                  {(() => {
                                    const isAnti = isMedicamentoAntibiotico(med);

                                    if (pr.dataFim) {
                                      const dataInicioFmt = pr.dataInicio ? new Date(pr.dataInicio).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '--';
                                      const dataFimFmt = new Date(pr.dataFim).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
                                      const diasTotais = pr.dataInicio ? calcularDiasEntre(pr.dataInicio, pr.dataFim, pr.horarioInicio || "08:00") : null;
                                      
                                      let diasDecorridos = 0;
                                      let diasRestantes = 0;
                                      if (pr.dataInicio) {
                                        const dInicio = new Date(pr.dataInicio);
                                        const dHoje = new Date(hojeStr);
                                        const dFim = new Date(pr.dataFim);
                                        diasDecorridos = Math.max(1, Math.round((dHoje.getTime() - dInicio.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                                        diasRestantes = Math.round((dFim.getTime() - dHoje.getTime()) / (1000 * 60 * 60 * 24));
                                      }

                                      const isUltimoDia = pr.dataFim === hojeStr;
                                      const isEncerrado = pr.dataFim < hojeStr;

                                      return (
                                        <div className="space-y-1">
                                          {isAnti && (
                                            <Badge className="bg-purple-600 hover:bg-purple-700 text-white text-[9px] py-0 px-1.5 font-bold block w-max">
                                              🧪 Antibiótico
                                            </Badge>
                                          )}
                                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                                            {dataInicioFmt} a {dataFimFmt}
                                            {diasTotais && <span className="text-slate-500 font-normal ml-1">({diasTotais}d)</span>}
                                          </div>
                                          {isEncerrado ? (
                                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-[10px] font-bold">
                                              Finalizado
                                            </Badge>
                                          ) : isUltimoDia ? (
                                            <Badge className="bg-amber-500 text-white text-[10px] font-bold">
                                              ⚠️ Último dia hoje!
                                            </Badge>
                                          ) : (
                                            <div className="text-[11px] text-blue-700 dark:text-blue-300 font-medium">
                                              Dia {diasDecorridos} de {diasTotais} • Faltam {diasRestantes}d
                                            </div>
                                          )}
                                        </div>
                                      );
                                    }

                                    return (
                                      <div className="space-y-0.5">
                                        <div className="font-medium text-slate-800 dark:text-slate-200">
                                          Início: {pr.dataInicio ? new Date(pr.dataInicio).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '--'}
                                        </div>
                                        <Badge variant="outline" className="text-[10px] text-slate-500 bg-slate-100 border-slate-200">
                                          Uso Contínuo
                                        </Badge>
                                      </div>
                                    );
                                  })()}
                                </TableCell>

                                <TableCell className="text-slate-600 text-sm leading-tight">
                                  <div className="font-medium text-slate-800 dark:text-slate-200">
                                    {pr.medico_nome || "Médico(a) Assist."}
                                  </div>
                                  <div className="text-[10px] text-slate-400">
                                    {pr.medico_crm ? `CRM ${pr.medico_crm}` : "CRM N/A"}
                                  </div>
                                  {pr.tipo_assinatura === "certificado_icp" ? (
                                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[9px] font-bold mt-0.5 block w-max">
                                      🟢 ICP-Brasil
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[9px] font-bold mt-0.5 block w-max">
                                      🔵 Login/CRM
                                    </Badge>
                                  )}
                                </TableCell>

                                <TableCell className="text-right py-3 space-x-1.5 whitespace-nowrap">
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-8 px-2.5 text-xs text-blue-700 bg-blue-50/80 border-blue-200 hover:bg-blue-100 hover:text-blue-800 font-semibold gap-1.5 shadow-xs cursor-pointer" 
                                    onClick={() => onEditPrescricao(pr)} 
                                    title="Alterar medicamento ou posologia"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                    Alterar
                                  </Button>

                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 cursor-pointer" 
                                    onClick={() => handleOpenSuspend(pr)} 
                                    title="Suspender medicamento"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TableCell>

                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* 2. Histórico de Medicações */}
                <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm mt-6">
                  <div className="flex gap-3 mb-4">
                    <div className="bg-slate-100 p-2 rounded-lg text-slate-600">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 leading-tight">
                        Histórico de Medicações
                      </h3>
                      <p className="text-sm text-slate-500">
                        Medicamentos que foram suspensos ou alterados
                      </p>
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50/50">
                        <TableRow>
                          <TableHead className="font-bold text-slate-600">Medicamento</TableHead>
                          <TableHead className="font-bold text-slate-600">Dose</TableHead>
                          <TableHead className="font-bold text-slate-600">Frequência</TableHead>
                          <TableHead className="font-bold text-slate-600">Via</TableHead>
                          <TableHead className="font-bold text-slate-600">Período de Uso</TableHead>
                          <TableHead className="font-bold text-slate-600">Motivo da Suspensão</TableHead>
                          <TableHead className="font-bold text-slate-600">Prescrito por</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {prescricoesHistorico.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-6 text-slate-500">
                              Nenhum histórico encontrado.
                            </TableCell>
                          </TableRow>
                        ) : (
                          prescricoesHistorico.map(pr => {
                            const med = medicamentos.find(m => m.id === (pr.medicamentoId || pr.medicamento_id));
                            const via = pr.viaAdministracao || pr.via_administracao || med?.via_administracao || "Oral";
                            const apresentacao = pr.apresentacao || med?.apresentacao || "Comprimido";
                            const rawConc = (pr.concentracao || med?.concentracao || "").trim();
                            const hasConcInName = rawConc && pr.medicamentoNome?.toLowerCase().includes(rawConc.toLowerCase());
                            const concentracao = rawConc && !hasConcInName ? rawConc : "";

                            return (
                              <TableRow key={pr.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                                
                                <TableCell className="font-semibold text-slate-800 py-3 opacity-60 max-w-[280px] min-w-[170px] break-words whitespace-normal leading-snug">
                                  <span className="block">
                                    {pr.medicamentoNome}
                                    {concentracao && (
                                      <span className="ml-1 text-slate-600 font-medium">
                                        ({concentracao})
                                      </span>
                                    )}
                                  </span>
                                  <Badge variant="outline" className="inline-block w-auto max-w-full truncate mt-1 text-[10px] bg-slate-50 text-slate-500 border-slate-200 rounded">
                                    {apresentacao}
                                  </Badge>
                                </TableCell>

                                <TableCell className="text-slate-600 text-sm font-medium opacity-60">
                                  <div>{pr.totalDiario} un/dia</div>
                                  {pr.tipoFrequencia === "intervalo_dias" ? (
                                    <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px] font-bold mt-0.5 block w-max">
                                      ⏱️ A cada {pr.intervaloDias || 1} dias
                                    </Badge>
                                  ) : formatDiasSemana(pr.diasSemana) !== "Todos os dias (Diário)" && (
                                    <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-300 text-[10px] font-bold mt-0.5 block w-max">
                                      📅 {formatDiasSemana(pr.diasSemana)}
                                    </Badge>
                                  )}
                                </TableCell>

                                <TableCell className="text-slate-600 text-sm font-medium opacity-60">
                                  <div className="flex flex-col items-start gap-1">
                                    <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 font-mono text-xs font-bold">
                                      {pr.esquemaPosologico}
                                    </Badge>
                                  </div>
                                </TableCell>

                                <TableCell className="text-slate-600 text-sm opacity-60">
                                  {via}
                                </TableCell>

                                <TableCell className="text-slate-600 text-xs py-3 opacity-60">
                                  {pr.dataInicio ? new Date(pr.dataInicio).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '--'} 
                                  {" até "} 
                                  {pr.dataFim ? new Date(pr.dataFim).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'Suspenso'}
                                </TableCell>

                                <TableCell className="text-xs text-rose-700 font-semibold max-w-[220px]">
                                  {pr.motivo_alteracao || "Suspenso clinicamente pelo médico"}
                                </TableCell>

                                <TableCell className="text-slate-600 text-xs">
                                  {pr.medico_nome || "Médico Assistente"}
                                </TableCell>

                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

              </div>
            )}

            {/* ================================================================= */}
            {/* ABA 4: VISITAS (REGISTRO DE VISITAS DA RECEPÇÃO) */}
            {/* ================================================================= */}
            {activeTab === 'visitas' && (
              <div className="space-y-6 max-w-6xl mx-auto pb-10">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total de Visitas Registradas</span>
                      <p className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">{visitas.length}</p>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-xl">
                      <UserCheck className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Status no Leito</span>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1 flex items-center gap-2">
                        {visitas.some(v => !v.dataHoraSaida || v.status === "Em Andamento") ? (
                          <>
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-emerald-600 dark:text-emerald-400">Visitante no Leito</span>
                          </>
                        ) : (
                          <span className="text-slate-500">Sem visitas no momento</span>
                        )}
                      </p>
                    </div>
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-xl">
                      <Bed className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Última Visita</span>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">
                        {visitas.length > 0 && visitas[0].dataHoraEntrada
                          ? format(new Date(visitas[0].dataHoraEntrada), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                          : "Nenhum registro"}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-slate-900 text-slate-500 rounded-xl">
                      <Clock className="w-6 h-6" />
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-sky-100 dark:bg-sky-950/50 p-2 rounded-lg text-sky-700 dark:text-sky-400">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 leading-tight">
                        Histórico de Visitantes
                      </h3>
                      <p className="text-sm text-slate-500">
                        Entradas e saídas de visitantes registradas na Recepção
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50/50">
                        <TableRow>
                          <TableHead className="font-bold text-slate-600">Visitante</TableHead>
                          <TableHead className="font-bold text-slate-600">Parentesco</TableHead>
                          <TableHead className="font-bold text-slate-600">Entrada</TableHead>
                          <TableHead className="font-bold text-slate-600">Saída</TableHead>
                          <TableHead className="font-bold text-slate-600">Status</TableHead>
                          <TableHead className="font-bold text-slate-600">Observações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visitas.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-6 text-slate-500">
                              Nenhuma visita registrada para este paciente.
                            </TableCell>
                          </TableRow>
                        ) : (
                          visitas.map((v) => (
                            <TableRow key={v.id}>
                              <TableCell className="font-semibold text-slate-800 dark:text-slate-200">
                                {v.nomeVisitante}
                              </TableCell>
                              <TableCell className="text-slate-600 text-sm">
                                {v.parentesco || "Familiar"}
                              </TableCell>
                              <TableCell className="text-slate-600 text-xs font-mono">
                                {v.dataHoraEntrada ? format(new Date(v.dataHoraEntrada), "dd/MM/yyyy HH:mm") : "--"}
                              </TableCell>
                              <TableCell className="text-slate-600 text-xs font-mono">
                                {v.dataHoraSaida ? format(new Date(v.dataHoraSaida), "dd/MM/yyyy HH:mm") : "Em andamento"}
                              </TableCell>
                              <TableCell>
                                <Badge variant={v.status === "Em Andamento" ? "default" : "secondary"}>
                                  {v.status || "Finalizada"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-slate-500 text-xs">
                                {v.observacoes || "—"}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}

            {/* ================================================================= */}
            {/* ABA 5: EXAMES LABORATORIAIS E IMAGEM */}
            {/* ================================================================= */}
            {activeTab === 'exames' && (
              <div className="space-y-6 max-w-6xl mx-auto pb-10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                      <FlaskConical className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-base text-slate-900 dark:text-slate-100">
                        Exames Laboratoriais e de Imagem
                      </h3>
                      <p className="text-xs text-slate-500">
                        Histórico de laudos, hemogramas e relatórios diagnósticos
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={exameFiltro}
                      onChange={(e) => setExameFiltro(e.target.value)}
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold rounded-xl px-3 py-1.5 text-slate-700 dark:text-slate-200"
                    >
                      <option value="todos">Todos os Tipos</option>
                      <option value="laboratorial">Laboratoriais</option>
                      <option value="imagem">Imagem / RX / TC</option>
                      <option value="cardiol">Cardiológicos</option>
                    </select>

                    <Button 
                      onClick={() => setExameModalOpen(true)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 text-xs font-bold gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Novo Exame / Laudo
                    </Button>
                  </div>
                </div>

                {filteredExames.length === 0 ? (
                  <div className="bg-white dark:bg-slate-950 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
                    <FlaskConical className="w-12 h-12 text-slate-300 mx-auto" />
                    <h4 className="font-bold text-sm text-slate-700 dark:text-slate-200">
                      Nenhum exame cadastrado
                    </h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Cadastre resultados de hemogramas, bioquímicas, gasometrias ou laudos de radiologia deste paciente.
                    </p>
                    <Button 
                      onClick={() => setExameModalOpen(true)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Adicionar Exame
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredExames.map((ex) => (
                      <div 
                        key={ex.id}
                        className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5 hover:border-indigo-200 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge className={cn(
                                "text-[10px] font-bold",
                                ex.status === "Concluído" ? "bg-emerald-500" :
                                ex.status === "Em Análise" ? "bg-amber-500" : "bg-blue-600"
                              )}>
                                {ex.status}
                              </Badge>
                              <span className="text-[10px] text-slate-400 font-semibold uppercase">{ex.tipo}</span>
                            </div>
                            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 mt-1">
                              {ex.nome_exame}
                            </h4>
                          </div>

                          <button
                            onClick={() => handleDeleteExame(ex.id)}
                            className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                            title="Remover exame"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="text-xs text-slate-500 flex items-center gap-3">
                          <span>Solicitado: {format(new Date(ex.data_solicitacao), "dd/MM/yyyy")}</span>
                          {ex.data_resultado && <span>• Resultado: {format(new Date(ex.data_resultado), "dd/MM/yyyy")}</span>}
                        </div>

                        {ex.resultado && (
                          <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                            <strong className="text-slate-700 dark:text-slate-300 block mb-1">Resultado Encontrado:</strong>
                            <p className="text-slate-900 dark:text-white font-mono font-semibold whitespace-pre-wrap">
                              {ex.resultado}
                            </p>
                            {ex.valores_referencia && (
                              <span className="text-[10px] text-slate-400 block mt-1">
                                Ref: {ex.valores_referencia}
                              </span>
                            )}
                          </div>
                        )}

                        {ex.laudo_medico && (
                          <div className="text-xs text-slate-600 dark:text-slate-300 italic bg-indigo-50/40 p-2.5 rounded-xl border border-indigo-100/50">
                            <strong>Conclusão do Laudo:</strong> {ex.laudo_medico}
                          </div>
                        )}

                        {ex.solicitante_nome && (
                          <div className="text-[10px] text-slate-400 text-right">
                            Dr(a). {ex.solicitante_nome}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ================================================================= */}
            {/* ABA 6: ALERGIAS E SENSIBILIDADES CLÍNICAS */}
            {/* ================================================================= */}
            {activeTab === 'alergias' && (
              <div className="space-y-6 max-w-5xl mx-auto pb-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-base text-slate-900 dark:text-slate-100">
                        Alergias e Sensibilidades Conhecidas
                      </h3>
                      <p className="text-xs text-slate-500">
                        Protocolo de segurança para prescrição de medicamentos e dieta
                      </p>
                    </div>
                  </div>

                  <Button 
                    onClick={() => setAlergiaModalOpen(true)}
                    className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl px-4 text-xs font-bold gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Alergia
                  </Button>
                </div>

                {alergias.length === 0 ? (
                  <div className="bg-white dark:bg-slate-950 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
                    <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                    <h4 className="font-bold text-sm text-slate-700 dark:text-slate-200">
                      Nenhuma alergia declarada
                    </h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Não há registros de reações anafiláticas ou hipersensibilidade alimentar/medicamentosa para este paciente.
                    </p>
                    <Button 
                      onClick={() => setAlergiaModalOpen(true)}
                      variant="outline"
                      className="text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Cadastrar Alergia
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {alergias.map(al => (
                      <div 
                        key={al.id}
                        className="bg-white dark:bg-slate-950 p-4 rounded-2xl border-2 border-rose-100 hover:border-rose-300 dark:border-slate-800 shadow-xs space-y-2 relative"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-rose-600 tracking-wider">
                              {al.tipo}
                            </span>
                            <h4 className="font-black text-base text-slate-900 dark:text-slate-100">
                              {al.agente}
                            </h4>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Badge className={cn(
                              "text-[10px] font-black",
                              al.gravidade === "Choque Anafilático" ? "bg-rose-600 text-white animate-pulse" :
                              al.gravidade === "Grave" ? "bg-rose-500 text-white" :
                              al.gravidade === "Moderada" ? "bg-amber-500 text-white" : "bg-sky-600 text-white"
                            )}>
                              {al.gravidade}
                            </Badge>

                            <button
                              onClick={() => handleDeleteAlergia(al.id)}
                              className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                              title="Remover alergia"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {al.reacao && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 bg-rose-50/50 dark:bg-rose-950/20 p-2.5 rounded-xl border border-rose-100">
                            <strong>Sintomas / Reação:</strong> {al.reacao}
                          </p>
                        )}

                        <div className="text-[10px] text-slate-400 pt-1 flex justify-between">
                          <span>Registrado por {al.registrado_por || "Equipe"}</span>
                          <span>{format(new Date(al.data_registro), "dd/MM/yyyy")}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ================================================================= */}
            {/* ABA 7: DOCUMENTOS E ANEXOS */}
            {/* ================================================================= */}
            {activeTab === 'documentos' && (
              <div className="space-y-6 max-w-5xl mx-auto pb-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-slate-100 text-slate-700 rounded-xl">
                      <FolderOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-black text-base text-slate-900 dark:text-slate-100">
                        Documentos, Laudos e Termos
                      </h3>
                      <p className="text-xs text-slate-500">
                        Arquivo documental seguro do prontuário hospitalar
                      </p>
                    </div>
                  </div>

                  <Button 
                    onClick={() => setDocumentoModalOpen(true)}
                    className="bg-slate-800 hover:bg-slate-900 text-white rounded-xl px-4 text-xs font-bold gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Novo Documento / Anexo
                  </Button>
                </div>

                {documentos.length === 0 ? (
                  <div className="bg-white dark:bg-slate-950 p-12 rounded-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
                    <FolderOpen className="w-12 h-12 text-slate-300 mx-auto" />
                    <h4 className="font-bold text-sm text-slate-700 dark:text-slate-200">
                      Nenhum documento arquivado
                    </h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Armazene termos de consentimento, sumários de alta, laudos digitalizados ou relatórios médicos.
                    </p>
                    <Button 
                      onClick={() => setDocumentoModalOpen(true)}
                      className="bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Cadastrar Documento
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {documentos.map(doc => (
                      <div 
                        key={doc.id}
                        className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-4 hover:border-slate-300 transition-colors"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="p-3 bg-slate-100 text-slate-700 rounded-xl shrink-0">
                            <FileCheck className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] font-bold">
                                {doc.categoria}
                              </Badge>
                              <span className="text-xs text-slate-400">
                                {format(new Date(doc.data_emissao), "dd/MM/yyyy")}
                              </span>
                            </div>
                            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate mt-0.5">
                              {doc.titulo}
                            </h4>
                            <p className="text-xs text-slate-400">
                              Responsável: {doc.responsavel_nome} ({doc.responsavel_cargo || "Médico"})
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setSelectedDoc(doc);
                              setDocViewOpen(true);
                            }}
                            className="rounded-xl text-xs font-semibold gap-1.5 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Visualizar
                          </Button>

                          <button
                            onClick={() => handleDeleteDocumento(doc.id)}
                            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-xl transition-colors cursor-pointer"
                            title="Excluir documento"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>

        </DialogContent>
      </Dialog>

      {/* ─── MODAL: NOVA EVOLUÇÃO CLÍNICA ─── */}
      <Dialog open={evolucaoModalOpen} onOpenChange={setEvolucaoModalOpen}>
        <DialogContent className="sm:max-w-xl p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center gap-3 text-blue-600 mb-3">
            <div className="p-2.5 bg-blue-100 rounded-xl">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white">Nova Evolução Clínica</h3>
              <p className="text-xs text-slate-500">Documente o estado atual e condutas do paciente</p>
            </div>
          </div>

          <form onSubmit={handleSaveEvolucao} className="space-y-3.5 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="font-bold text-slate-700 dark:text-slate-300 mb-1 block">Tipo de Evolução:</Label>
                <select
                  value={evolucaoForm.tipo}
                  onChange={(e) => setEvolucaoForm({...evolucaoForm, tipo: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2 text-xs"
                >
                  <option value="Evolução Médica">Evolução Médica</option>
                  <option value="Evolução de Enfermagem">Evolução de Enfermagem</option>
                  <option value="Parecer Especialista">Parecer Especialista</option>
                  <option value="Admissão Hospitalar">Admissão Hospitalar</option>
                </select>
              </div>

              <div>
                <Label className="font-bold text-slate-700 dark:text-slate-300 mb-1 block">Título / Assunto:</Label>
                <Input 
                  value={evolucaoForm.titulo}
                  onChange={(e) => setEvolucaoForm({...evolucaoForm, titulo: e.target.value})}
                  placeholder="Ex: Plantão Diurno, Intercorrência..."
                  className="text-xs rounded-xl"
                />
              </div>
            </div>

            {/* Sinais Vitais Opcionais */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-2">
              <span className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">Sinais Vitais no Momento (Opcional):</span>
              <div className="grid grid-cols-5 gap-2">
                <div>
                  <span className="text-[10px] text-slate-400 block">PA (mmHg)</span>
                  <Input 
                    value={evolucaoForm.pressao_arterial}
                    onChange={(e) => setEvolucaoForm({...evolucaoForm, pressao_arterial: e.target.value})}
                    placeholder="120/80"
                    className="text-xs h-7 px-1.5"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">FC (bpm)</span>
                  <Input 
                    value={evolucaoForm.frequencia_cardiaca}
                    onChange={(e) => setEvolucaoForm({...evolucaoForm, frequencia_cardiaca: e.target.value})}
                    placeholder="75"
                    className="text-xs h-7 px-1.5"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Temp (°C)</span>
                  <Input 
                    value={evolucaoForm.temperatura}
                    onChange={(e) => setEvolucaoForm({...evolucaoForm, temperatura: e.target.value})}
                    placeholder="36.5"
                    className="text-xs h-7 px-1.5"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">SatO2 (%)</span>
                  <Input 
                    value={evolucaoForm.saturacao_o2}
                    onChange={(e) => setEvolucaoForm({...evolucaoForm, saturacao_o2: e.target.value})}
                    placeholder="98"
                    className="text-xs h-7 px-1.5"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Glicemia</span>
                  <Input 
                    value={evolucaoForm.glicemia}
                    onChange={(e) => setEvolucaoForm({...evolucaoForm, glicemia: e.target.value})}
                    placeholder="90"
                    className="text-xs h-7 px-1.5"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                Descrição Clínica (Subjetivo, Objetivo e Exame Físico): *
              </Label>
              <Textarea 
                value={evolucaoForm.descricao}
                onChange={(e) => setEvolucaoForm({...evolucaoForm, descricao: e.target.value})}
                placeholder="Paciente lúcido, corado, eupneico em ar ambiente. Murmúrio vesicular presente sem ruídos adventícios. Abdome flácido, indolor..."
                className="text-xs rounded-xl min-h-[120px]"
                required
              />
            </div>

            <div>
              <Label className="font-bold text-slate-700 dark:text-slate-300 mb-1 block">
                Plano Terapêutico / Conduta Médica:
              </Label>
              <Textarea 
                value={evolucaoForm.conduta}
                onChange={(e) => setEvolucaoForm({...evolucaoForm, conduta: e.target.value})}
                placeholder="Manter antibioticoterapia, solicitar hemograma de controle amanhã cedo, reavaliação hemodinâmica no plantão..."
                className="text-xs rounded-xl min-h-[70px]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEvolucaoModalOpen(false)}
                className="text-xs rounded-xl cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-xl font-bold cursor-pointer"
              >
                Salvar Evolução
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: NOVO EXAME ─── */}
      <Dialog open={exameModalOpen} onOpenChange={setExameModalOpen}>
        <DialogContent className="sm:max-w-lg p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center gap-3 text-indigo-600 mb-3">
            <div className="p-2.5 bg-indigo-100 rounded-xl">
              <FlaskConical className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white">Registrar Exame / Laudo</h3>
              <p className="text-xs text-slate-500">Cadastre exames laboratoriais ou diagnósticos por imagem</p>
            </div>
          </div>

          <form onSubmit={handleSaveExame} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="font-bold text-slate-700 mb-1 block">Tipo de Exame:</Label>
                <select
                  value={exameForm.tipo}
                  onChange={(e) => setExameForm({...exameForm, tipo: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2 text-xs"
                >
                  <option value="Laboratorial">Laboratorial</option>
                  <option value="Imagem / RX">Imagem / RX</option>
                  <option value="Tomografia (TC)">Tomografia (TC)</option>
                  <option value="Ultrassom (USG)">Ultrassom (USG)</option>
                  <option value="Eletrocardiograma (ECG)">Eletrocardiograma (ECG)</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div>
                <Label className="font-bold text-slate-700 mb-1 block">Status:</Label>
                <select
                  value={exameForm.status}
                  onChange={(e) => setExameForm({...exameForm, status: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2 text-xs"
                >
                  <option value="Concluído">Concluído / Laudo Pronto</option>
                  <option value="Solicitado">Solicitado</option>
                  <option value="Em Análise">Em Análise Laboratorial</option>
                </select>
              </div>
            </div>

            <div>
              <Label className="font-bold text-slate-700 mb-1 block">Nome do Exame: *</Label>
              <Input 
                value={exameForm.nome_exame}
                onChange={(e) => setExameForm({...exameForm, nome_exame: e.target.value})}
                placeholder="Ex: Hemograma Completo, Gasometria Arterial, PCR, TC Tórax..."
                className="text-xs rounded-xl"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="font-bold text-slate-700 mb-1 block">Data Solicitação:</Label>
                <Input 
                  type="date"
                  value={exameForm.data_solicitacao}
                  onChange={(e) => setExameForm({...exameForm, data_solicitacao: e.target.value})}
                  className="text-xs rounded-xl"
                />
              </div>
              <div>
                <Label className="font-bold text-slate-700 mb-1 block">Data Resultado:</Label>
                <Input 
                  type="date"
                  value={exameForm.data_resultado}
                  onChange={(e) => setExameForm({...exameForm, data_resultado: e.target.value})}
                  className="text-xs rounded-xl"
                />
              </div>
            </div>

            <div>
              <Label className="font-bold text-slate-700 mb-1 block">Resultado / Valores Encontrados:</Label>
              <Textarea 
                value={exameForm.resultado}
                onChange={(e) => setExameForm({...exameForm, resultado: e.target.value})}
                placeholder="Ex: Hemoglobina: 13.8 g/dL | Leucócitos: 8.200 /mm³ | Plaquetas: 240.000 /mm³"
                className="text-xs rounded-xl min-h-[70px]"
              />
            </div>

            <div>
              <Label className="font-bold text-slate-700 mb-1 block">Valores de Referência:</Label>
              <Input 
                value={exameForm.valores_referencia}
                onChange={(e) => setExameForm({...exameForm, valores_referencia: e.target.value})}
                placeholder="Ex: Leucócitos 4.000 a 10.000 | Hb 12 a 16"
                className="text-xs rounded-xl"
              />
            </div>

            <div>
              <Label className="font-bold text-slate-700 mb-1 block">Conclusão do Laudo Médico:</Label>
              <Textarea 
                value={exameForm.laudo_medico}
                onChange={(e) => setExameForm({...exameForm, laudo_medico: e.target.value})}
                placeholder="Ex: Ausência de consolidações pleuropulmonares agudas. Seios costofrênicos livres."
                className="text-xs rounded-xl min-h-[60px]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setExameModalOpen(false)}
                className="text-xs rounded-xl cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-xl font-bold cursor-pointer"
              >
                Salvar Exame
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: NOVA ALERGIA ─── */}
      <Dialog open={alergiaModalOpen} onOpenChange={setAlergiaModalOpen}>
        <DialogContent className="sm:max-w-md p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 text-rose-600 mb-3">
            <div className="p-2.5 bg-rose-100 rounded-xl">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white">Cadastrar Alergia / Restrição</h3>
              <p className="text-xs text-slate-500">Adicione alérgenos ao alerta permanente do paciente</p>
            </div>
          </div>

          <form onSubmit={handleSaveAlergia} className="space-y-3 text-xs">
            <div>
              <Label className="font-bold text-slate-700 mb-1 block">Substância / Alérgeno: *</Label>
              <Input 
                value={alergiaForm.agente}
                onChange={(e) => setAlergiaForm({...alergiaForm, agente: e.target.value})}
                placeholder="Ex: Dipirona, Penicilina, Iodo, Látex, Frutos do Mar..."
                className="text-xs rounded-xl"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="font-bold text-slate-700 mb-1 block">Tipo de Alergia:</Label>
                <select
                  value={alergiaForm.tipo}
                  onChange={(e) => setAlergiaForm({...alergiaForm, tipo: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2 text-xs"
                >
                  <option value="Medicamentosa">Medicamentosa</option>
                  <option value="Alimentar">Alimentar</option>
                  <option value="Ambiental">Ambiental</option>
                  <option value="Contato">Contato</option>
                </select>
              </div>

              <div>
                <Label className="font-bold text-slate-700 mb-1 block">Gravidade:</Label>
                <select
                  value={alergiaForm.gravidade}
                  onChange={(e) => setAlergiaForm({...alergiaForm, gravidade: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2 text-xs"
                >
                  <option value="Choque Anafilático">🔴 Choque Anafilático</option>
                  <option value="Grave">🟠 Grave</option>
                  <option value="Moderada">🟡 Moderada</option>
                  <option value="Leve">🔵 Leve</option>
                </select>
              </div>
            </div>

            <div>
              <Label className="font-bold text-slate-700 mb-1 block">Reações / Sintomas:</Label>
              <Textarea 
                value={alergiaForm.reacao}
                onChange={(e) => setAlergiaForm({...alergiaForm, reacao: e.target.value})}
                placeholder="Ex: Urticária, edema de glote, dispneia intensa, hipotensão..."
                className="text-xs rounded-xl min-h-[60px]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAlergiaModalOpen(false)}
                className="text-xs rounded-xl cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs rounded-xl font-bold cursor-pointer"
              >
                Salvar Alergia
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: NOVO DOCUMENTO ─── */}
      <Dialog open={documentoModalOpen} onOpenChange={setDocumentoModalOpen}>
        <DialogContent className="sm:max-w-lg p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center gap-3 text-slate-800 dark:text-white mb-3">
            <div className="p-2.5 bg-slate-100 rounded-xl">
              <FolderOpen className="w-6 h-6 text-slate-700" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white">Novo Documento / Anexo</h3>
              <p className="text-xs text-slate-500">Arquivar relatório, sumário de alta ou declaração</p>
            </div>
          </div>

          <form onSubmit={handleSaveDocumento} className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="font-bold text-slate-700 mb-1 block">Categoria:</Label>
                <select
                  value={documentoForm.categoria}
                  onChange={(e) => setDocumentoForm({...documentoForm, categoria: e.target.value})}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2 text-xs"
                >
                  <option value="Relatório Médico">Relatório Médico</option>
                  <option value="Termo de Consentimento">Termo de Consentimento</option>
                  <option value="Sumário de Alta">Sumário de Alta</option>
                  <option value="Declaração de Internação">Declaração de Internação</option>
                  <option value="Laudo Pericial">Laudo Pericial</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div>
                <Label className="font-bold text-slate-700 mb-1 block">Data de Emissão:</Label>
                <Input 
                  type="date"
                  value={documentoForm.data_emissao}
                  onChange={(e) => setDocumentoForm({...documentoForm, data_emissao: e.target.value})}
                  className="text-xs rounded-xl"
                />
              </div>
            </div>

            <div>
              <Label className="font-bold text-slate-700 mb-1 block">Título do Documento: *</Label>
              <Input 
                value={documentoForm.titulo}
                onChange={(e) => setDocumentoForm({...documentoForm, titulo: e.target.value})}
                placeholder="Ex: Sumário de Alta Hospitalar, Termo de Cirurgia..."
                className="text-xs rounded-xl"
                required
              />
            </div>

            <div>
              <Label className="font-bold text-slate-700 mb-1 block">Conteúdo / Texto Completo: *</Label>
              <Textarea 
                value={documentoForm.conteudo}
                onChange={(e) => setDocumentoForm({...documentoForm, conteudo: e.target.value})}
                placeholder="Insira o texto completo do documento, laudo ou parecer..."
                className="text-xs rounded-xl min-h-[140px]"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDocumentoModalOpen(false)}
                className="text-xs rounded-xl cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs rounded-xl font-bold cursor-pointer"
              >
                Arquivar Documento
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: VISUALIZAR DOCUMENTO ─── */}
      <Dialog open={docViewOpen} onOpenChange={setDocViewOpen}>
        <DialogContent className="sm:max-w-xl p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200">
          <div className="border-b border-slate-200 pb-3 mb-3">
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-[10px] font-bold">
                {selectedDoc?.categoria}
              </Badge>
              <span className="text-xs text-slate-400">
                {selectedDoc?.data_emissao ? format(new Date(selectedDoc.data_emissao), "dd/MM/yyyy") : ""}
              </span>
            </div>
            <h3 className="font-black text-lg text-slate-900 dark:text-white mt-1">
              {selectedDoc?.titulo}
            </h3>
            <p className="text-xs text-slate-500">
              Responsável: {selectedDoc?.responsavel_nome} ({selectedDoc?.responsavel_cargo})
            </p>
          </div>

          <div className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed max-h-[50vh] overflow-y-auto p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100">
            {selectedDoc?.conteudo}
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => window.print()}
              className="text-xs rounded-xl gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </Button>
            <Button
              onClick={() => setDocViewOpen(false)}
              className="bg-slate-800 hover:bg-slate-900 text-white text-xs rounded-xl font-bold cursor-pointer"
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: REGISTRAR SINAIS VITAIS RÁPIDOS ─── */}
      <Dialog open={vitalsModalOpen} onOpenChange={setVitalsModalOpen}>
        <DialogContent className="sm:max-w-md p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200">
          <div className="flex items-center gap-3 text-rose-600 mb-3">
            <div className="p-2.5 bg-rose-100 rounded-xl">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white">Registrar Sinais Vitais</h3>
              <p className="text-xs text-slate-500">Atualize os parâmetros fisiológicos do paciente</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="font-bold text-slate-700 mb-1 block">PA (mmHg):</Label>
                <Input 
                  value={vitalsForm.pressao_arterial}
                  onChange={(e) => setVitalsForm({...vitalsForm, pressao_arterial: e.target.value})}
                  placeholder="120/80"
                  className="text-xs rounded-xl"
                />
              </div>
              <div>
                <Label className="font-bold text-slate-700 mb-1 block">FC (bpm):</Label>
                <Input 
                  value={vitalsForm.frequencia_cardiaca}
                  onChange={(e) => setVitalsForm({...vitalsForm, frequencia_cardiaca: e.target.value})}
                  placeholder="76"
                  className="text-xs rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="font-bold text-slate-700 mb-1 block">Temp (°C):</Label>
                <Input 
                  value={vitalsForm.temperatura}
                  onChange={(e) => setVitalsForm({...vitalsForm, temperatura: e.target.value})}
                  placeholder="36.5"
                  className="text-xs rounded-xl"
                />
              </div>
              <div>
                <Label className="font-bold text-slate-700 mb-1 block">SatO2 (%):</Label>
                <Input 
                  value={vitalsForm.saturacao_o2}
                  onChange={(e) => setVitalsForm({...vitalsForm, saturacao_o2: e.target.value})}
                  placeholder="98"
                  className="text-xs rounded-xl"
                />
              </div>
              <div>
                <Label className="font-bold text-slate-700 mb-1 block">Glicemia:</Label>
                <Input 
                  value={vitalsForm.glicemia}
                  onChange={(e) => setVitalsForm({...vitalsForm, glicemia: e.target.value})}
                  placeholder="95"
                  className="text-xs rounded-xl"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-5">
            <Button
              variant="outline"
              onClick={() => setVitalsModalOpen(false)}
              className="text-xs rounded-xl cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveQuickVitals}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs rounded-xl font-bold cursor-pointer"
            >
              Gravar Medição
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL DE CONFIRMAÇÃO DE SUSPENSÃO ─── */}
      <Dialog open={suspendModalOpen} onOpenChange={setSuspendModalOpen}>
        <DialogContent className="sm:max-w-md p-6 bg-white rounded-2xl shadow-xl border border-slate-200">
          <div className="flex items-center gap-3 text-rose-600 mb-2">
            <div className="p-2.5 bg-rose-100 rounded-xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900">Suspender Medicação</h3>
              <p className="text-xs text-slate-500">Confirme a interrupção terapêutica</p>
            </div>
          </div>

          <div className="my-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">Medicamento</span>
            <strong className="text-slate-800 text-sm block">{prescToSuspend?.medicamentoNome}</strong>
            <span className="text-slate-500 block">{prescToSuspend?.esquemaPosologico}</span>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-700">
              Motivo Clínico da Suspensão:
            </Label>
            <Input 
              value={motivoSuspensao}
              onChange={(e) => setMotivoSuspensao(e.target.value)}
              placeholder="Ex: Melhora clínica, reação adversa, troca de antibiótico..."
              className="text-xs rounded-xl"
            />
          </div>

          <div className="flex justify-end gap-2 mt-5">
            <Button
              variant="outline"
              onClick={() => setSuspendModalOpen(false)}
              className="text-xs rounded-xl cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmSuspend}
              disabled={isSuspending}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs rounded-xl font-bold cursor-pointer"
            >
              {isSuspending ? "Suspendendo..." : "Confirmar Suspensão"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL DE TRANSFERIR ALA ─── */}
      <Dialog open={transferModalOpen} onOpenChange={setTransferModalOpen}>
        <DialogContent className="sm:max-w-md p-6 bg-white rounded-2xl shadow-xl border border-slate-200">
          <div className="flex items-center gap-3 text-blue-600 mb-3">
            <div className="p-2.5 bg-blue-100 rounded-xl">
              <ArrowLeftRight className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900">Transferir Paciente</h3>
              <p className="text-xs text-slate-500">Alterar Ala ou Leito de internação</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <Label className="font-bold text-slate-700 mb-1 block">Ala / Setor:</Label>
              <select
                value={selectedAla}
                onChange={(e) => setSelectedAla(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione a ala...</option>
                {alas.map(a => (
                  <option key={a.id} value={a.id}>{a.nome} - {a.descricao || `${a.leitos || 10} leitos`}</option>
                ))}
              </select>
            </div>

            <div>
              <Label className="font-bold text-slate-700 mb-1 block">Leito:</Label>
              <Input 
                value={selectedLeito}
                onChange={(e) => setSelectedLeito(e.target.value)}
                placeholder="Ex: Leito 04, Box 2..."
                className="text-xs rounded-xl"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-5">
            <Button
              variant="outline"
              onClick={() => setTransferModalOpen(false)}
              className="text-xs rounded-xl cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveTransfer}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-xl font-bold cursor-pointer"
            >
              Salvar Transferência
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL DE EDITAR PACIENTE ─── */}
      <Dialog open={editPatientModalOpen} onOpenChange={setEditPatientModalOpen}>
        <DialogContent className="sm:max-w-md p-6 bg-white rounded-2xl shadow-xl border border-slate-200">
          <div className="flex items-center gap-3 text-slate-800 mb-3">
            <div className="p-2.5 bg-slate-100 rounded-xl">
              <User className="w-6 h-6 text-slate-600" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900">Editar Paciente</h3>
              <p className="text-xs text-slate-500">Atualizar dados cadastrais básicos</p>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <Label className="font-bold text-slate-700 mb-1 block">Nome Completo:</Label>
              <Input 
                value={patientEditForm.nome}
                onChange={(e) => setPatientEditForm({...patientEditForm, nome: e.target.value})}
                className="text-xs rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="font-bold text-slate-700 mb-1 block">Prontuário / ID:</Label>
                <Input 
                  value={patientEditForm.prontuario}
                  onChange={(e) => setPatientEditForm({...patientEditForm, prontuario: e.target.value})}
                  className="text-xs rounded-xl"
                />
              </div>
              <div>
                <Label className="font-bold text-slate-700 mb-1 block">Idade:</Label>
                <Input 
                  type="number"
                  value={patientEditForm.idade}
                  onChange={(e) => setPatientEditForm({...patientEditForm, idade: e.target.value})}
                  className="text-xs rounded-xl"
                />
              </div>
            </div>

            <div>
              <Label className="font-bold text-slate-700 mb-1 block">Leito:</Label>
              <Input 
                value={patientEditForm.leito}
                onChange={(e) => setPatientEditForm({...patientEditForm, leito: e.target.value})}
                className="text-xs rounded-xl"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-5">
            <Button
              variant="outline"
              onClick={() => setEditPatientModalOpen(false)}
              className="text-xs rounded-xl cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveEditPatient}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-xl font-bold cursor-pointer"
            >
              Salvar Dados
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ProntuarioPacienteModal;
