import { normalizeSearch } from "@/utils/searchUtils";
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "@/api/db";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ComboboxMedicamento } from "@/components/ui/combobox-medicamento";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format, parseISO, differenceInCalendarDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { 
  Users, 
  Pill, 
  Plus, 
  Search, 
  Pencil, 
  Trash2, 
  Printer, 
  CheckCircle2, 
  AlertTriangle, 
  PackageMinus, 
  Building2, 
  RefreshCw, 
  Eye, 
  FileText, 
  LogOut, 
  Undo2, 
  User, 
  CreditCard, 
  ArrowLeftRight, 
  ArrowRight, 
  CalendarCheck, 
  Calendar,
  Clock,
  X, 
  Bed, 
  RotateCcw,
  Sparkles, 
  History,
  UserCheck,
  Droplet,
  Check,
  ChevronDown,
  Filter,
  ShieldAlert,
  Lock
} from "lucide-react";
import { PhotoCaptureField } from "@/components/ui/PhotoCaptureField";
import { isLiquido, extrairVolumeMl, converterGotasParaMl, converterMlParaGotas, calcularDuracaoFrascoDias } from "@/utils/liquidUtils";
import { ProntuarioPacienteModal } from "@/components/ProntuarioPacienteModal";
import { AjusteDiasEntregaModal } from "@/components/AjusteDiasEntregaModal";
import { SeparacaoLoteModal } from "@/components/SeparacaoLoteModal";

const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const safeParseHorarios = (horarios) => {
  if (!horarios) return [];
  if (Array.isArray(horarios)) return horarios;
  if (typeof horarios === 'string') {
    try {
      const parsed = JSON.parse(horarios);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const getDoseForHora = (horariosData, targetHora) => {
  const list = safeParseHorarios(horariosData);
  const found = list.find(h => h && h.hora === targetHora);
  return found?.dose ?? 0;
};

export const DIAS_SEMANA_MAP = [
  { id: 1, label: "Seg", full: "Segunda-feira" },
  { id: 2, label: "Ter", full: "Terça-feira" },
  { id: 3, label: "Qua", full: "Quarta-feira" },
  { id: 4, label: "Qui", full: "Quinta-feira" },
  { id: 5, label: "Sex", full: "Sexta-feira" },
  { id: 6, label: "Sáb", full: "Sábado" },
  { id: 0, label: "Dom", full: "Domingo" },
];

export const parseDiasSemana = (dias) => {
  if (!dias) return [0, 1, 2, 3, 4, 5, 6];
  if (Array.isArray(dias)) return dias.map(Number);
  if (typeof dias === 'string') {
    try {
      const parsed = JSON.parse(dias);
      if (Array.isArray(parsed)) return parsed.map(Number);
    } catch {}
    if (dias.includes(',')) return dias.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
  }
  return [0, 1, 2, 3, 4, 5, 6];
};

export const formatDiasSemana = (dias) => {
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

  const labels = sorted.map(id => {
    const found = DIAS_SEMANA_MAP.find(d => d.id === id);
    return found ? found.label : "";
  }).filter(Boolean);
  
  return labels.join(', ');
};

export const formatFrequenciaPrescricao = (pr) => {
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
};

export function isMedicamentoAntibiotico(med) {
  if (!med) return false;
  if (med.antimicrobiano) return true;
  const grupo = (med.grupo_terapeutico || "").toUpperCase();
  if (grupo.includes("ANTIBI") || grupo.includes("ANTIMICROB")) return true;
  const nome = (med.nome || "").toLowerCase();
  return /amoxicilina|ampicilina|azitromicina|claritromicina|cefalexina|ceftriaxona|cefazolina|ciprofloxacino|levofloxacino|metronidazol|vancomicina|meropenem|piperacilina|gentamicina|amikacina|clindamicina|sulfametoxazol|ceftazidima|oxacilina|penicilina|polimixina|daptomicina|linezolida|ertapenem|colistina|tobramicina/i.test(nome);
}

export function calcularDataFim(inicioStr, diasQtd, horarioInicio = "08:00") {
  if (!inicioStr || !diasQtd || parseInt(diasQtd, 10) <= 0) return "";
  const parts = inicioStr.split("-");
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  const diasNum = parseInt(diasQtd, 10);
  
  // Se iniciou à noite (22h) ou à tarde (14h), o paciente só toma parte das doses no 1º dia.
  // Portanto, para completar todos os ciclos de 24h, o tratamento se estende até o próximo dia correspondente.
  const diasAdicionar = (horarioInicio === "22:00" || horarioInicio === "14:00") ? diasNum : (diasNum - 1);
  d.setDate(d.getDate() + diasAdicionar);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export function calcularDiasEntre(inicioStr, fimStr, horarioInicio = "08:00") {
  if (!inicioStr || !fimStr) return "";
  const p1 = inicioStr.split("-");
  const p2 = fimStr.split("-");
  const d1 = new Date(parseInt(p1[0], 10), parseInt(p1[1], 10) - 1, parseInt(p1[2], 10));
  const d2 = new Date(parseInt(p2[0], 10), parseInt(p2[1], 10) - 1, parseInt(p2[2], 10));
  const diffTime = d2.getTime() - d1.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  if (diffDays <= 0) return 1;
  // Se iniciou à noite (22h) ou à tarde (14h), precisou de +1 dia de calendário para fechar o ciclo de 24h
  if (horarioInicio === "22:00" || horarioInicio === "14:00") {
    return Math.max(1, diffDays - 1);
  }
  return diffDays;
}

export function isPrescricaoDoPaciente(pr, pacienteIdOrObj) {
  if (!pr || !pacienteIdOrObj) return false;
  const targetId = typeof pacienteIdOrObj === "object" ? String(pacienteIdOrObj.id || "") : String(pacienteIdOrObj);
  const targetProntuario = typeof pacienteIdOrObj === "object" ? (pacienteIdOrObj.prontuario || "") : "";
  const targetNome = typeof pacienteIdOrObj === "object" ? (pacienteIdOrObj.nome || "") : "";

  const pId = String(pr.pacienteId || pr.paciente_id || pr.pacienteid || "");
  if (targetId && pId && pId !== "[object Object]" && pId === targetId) return true;
  if (targetProntuario && pr.prontuario && String(pr.prontuario).trim() === String(targetProntuario).trim()) return true;
  if (targetNome && pr.pacienteNome && String(pr.pacienteNome).trim().toLowerCase() === targetNome.trim().toLowerCase()) return true;
  return false;
}

export function isPrescricaoAtiva(pr, hojeStr = format(new Date(), "yyyy-MM-dd")) {
  if (!pr) return false;
  const status = (pr.status || "Ativa").trim().toLowerCase();
  if (status !== "ativa") return false;
  if (pr.dataFim && pr.dataFim < hojeStr) return false;
  return true;
}

export const calculatePrescQtdParaDias = (pr, diasCount) => {
  const d08 = getDoseForHora(pr.horarios, "08:00");
  const d14 = getDoseForHora(pr.horarios, "14:00");
  const d22 = getDoseForHora(pr.horarios, "22:00");
  const d06 = getDoseForHora(pr.horarios, "06:00");
  const calculatedDaily = d08 + d14 + d22 + d06;
  const dailyTotal = calculatedDaily > 0 ? calculatedDaily : (parseFloat(pr.totalDiario) || 0);

  const horarioInicio = pr.horarioInicio || "08:00";
  const dataInicioStr = pr.dataInicio;

  let maxDataFim = null;
  if (pr.dataFim) {
    const pFim = pr.dataFim.split("-");
    maxDataFim = new Date(parseInt(pFim[0], 10), parseInt(pFim[1], 10) - 1, parseInt(pFim[2], 10), 23, 59, 59);
  }

  const diasArr = parseDiasSemana(pr.diasSemana);
  let totalDoses = 0;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const tipoFreq = pr.tipoFrequencia || pr.tipo_frequencia || "diaria";
  const intervalo = Math.max(1, parseInt(pr.intervaloDias || pr.intervalo_dias, 10) || 1);
  let dataInicioDate = null;
  if (dataInicioStr) {
    const pIni = dataInicioStr.split("-");
    dataInicioDate = new Date(parseInt(pIni[0], 10), parseInt(pIni[1], 10) - 1, parseInt(pIni[2], 10));
    dataInicioDate.setHours(0, 0, 0, 0);
  }

  for (let i = 0; i < diasCount; i++) {
    const d = new Date(hoje);
    d.setDate(hoje.getDate() + i);

    if (maxDataFim && d > maxDataFim) {
      break;
    }

    let isDiaDeAdministracao = false;
    if (tipoFreq === "intervalo_dias") {
      if (dataInicioDate) {
        const diffDays = Math.round((d.getTime() - dataInicioDate.getTime()) / (1000 * 60 * 60 * 24));
        isDiaDeAdministracao = diffDays >= 0 && (diffDays % intervalo === 0);
      } else {
        isDiaDeAdministracao = (i % intervalo === 0);
      }
    } else {
      isDiaDeAdministracao = (diasArr.length === 7 || diasArr.length === 0 || diasArr.includes(d.getDay()));
    }

    if (isDiaDeAdministracao) {
      const dStr = format(d, "yyyy-MM-dd");

      // No dia exato de início da prescrição, apenas as doses a partir do horário de início são administradas
      if (dataInicioStr && dStr === dataInicioStr) {
        let dosesDoDiaInicio = 0;
        if (horarioInicio === "06:00") {
          dosesDoDiaInicio = d06 + d08 + d14 + d22;
        } else if (horarioInicio === "08:00") {
          dosesDoDiaInicio = d08 + d14 + d22;
        } else if (horarioInicio === "14:00") {
          dosesDoDiaInicio = d14 + d22;
        } else if (horarioInicio === "22:00") {
          dosesDoDiaInicio = d22;
        } else {
          dosesDoDiaInicio = dailyTotal;
        }
        totalDoses += dosesDoDiaInicio;
      } else if (pr.dataFim && dStr === pr.dataFim && (horarioInicio === "22:00" || horarioInicio === "14:00")) {
        // No último dia, se iniciou à noite ou tarde, toma apenas as doses restantes que fecham o ciclo durante o dia
        let dosesDoUltimoDia = 0;
        if (horarioInicio === "22:00") {
          dosesDoUltimoDia = d06 + d08 + d14;
        } else if (horarioInicio === "14:00") {
          dosesDoUltimoDia = d06 + d08;
        }
        totalDoses += dosesDoUltimoDia;
      } else {
        totalDoses += dailyTotal;
      }
    }
  }
  return Math.round(totalDoses);
};

export default function PacientesMedicao() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeCategory, setActiveCategory] = useState("todos"); // "todos", "com_prescricao", "sem_prescricao", "altas"
  const [periodoDias, setPeriodoDias] = useState(1);
  const [searchPatient, setSearchPatient] = useState("");
  const [filterAlas, setFilterAlas] = useState(["all"]);
  const filterAla = filterAlas.length === 1 ? filterAlas[0] : (filterAlas.includes("all") ? "all" : filterAlas[0]);
  const setFilterAla = (val) => setFilterAlas(val === "all" ? ["all"] : [val]);

  const toggleAlaFilter = (alaId) => {
    const aIdStr = String(alaId);
    if (aIdStr === "all") {
      setFilterAlas(["all"]);
      return;
    }
    if (filterAlas.includes("all")) {
      setFilterAlas([aIdStr]);
    } else if (filterAlas.includes(aIdStr)) {
      const updated = filterAlas.filter((id) => id !== aIdStr);
      setFilterAlas(updated.length === 0 ? ["all"] : updated);
    } else {
      const updated = [...filterAlas, aIdStr];
      if (updated.length >= alas.length) {
        setFilterAlas(["all"]);
      } else {
        setFilterAlas(updated);
      }
    }
  };
  const [searchPrescription, setSearchPrescription] = useState("");

  // Modais State
  const [viewPatientDetails, setViewPatientDetails] = useState(null);
  const [patientTab, setPatientTab] = useState("medicacoes");
  const [patientModalOpen, setPatientModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [patientFormData, setPatientFormData] = useState({
    foto: "",
    nome: "",
    prontuario: "",
    idade: "",
    alaId: "",
    alaNome: "",
    leito: "",
    status: "Ativo",
    observacoes: ""
  });

  const [prescModalOpen, setPrescModalOpen] = useState(false);
  const [editingPresc, setEditingPresc] = useState(null);
  const [prescFormData, setPrescFormData] = useState({
    pacienteId: "",
    medicamentoId: "",
    dose08: "0",
    dose14: "0",
    dose22: "0",
    dose06: "0",
    isMetade08: false,
    isMetade14: false,
    isMetade22: false,
    isMetade06: false,
    esquemaPosologico: "0-0-0-0",
    diasSemana: [0, 1, 2, 3, 4, 5, 6],
    tipoFrequencia: "diaria",
    intervaloDias: "10",
    horarios: "[]",
    observacoes: "",
    dataInicio: getLocalDateString(),
    dataFim: "",
    diasTratamento: "",
    status: "Ativa",
    alaNome: "",
    leito: ""
  });

  const [baixaModalOpen, setBaixaModalOpen] = useState(false);
  const [selectedPatientIds, setSelectedPatientIds] = useState([]);
  const [separacaoModalOpen, setSeparacaoModalOpen] = useState(false);
  const [batchBaixaModalOpen, setBatchBaixaModalOpen] = useState(false);
  const [batchBaixaDias, setBatchBaixaDias] = useState(8);
  const [selectedLotesBaixa, setSelectedLotesBaixa] = useState({});
  const [customQtdsBaixa, setCustomQtdsBaixa] = useState({});
  const [ajusteCicloModalOpen, setAjusteCicloModalOpen] = useState(false);
  const [ajusteCicloPatient, setAjusteCicloPatient] = useState(null);

  // ── SEGURANÇA / CONTROLE DE ACESSO (FASE DE TESTES - SENHA 102030) ──────────
  const [senhaBaixaModalOpen, setSenhaBaixaModalOpen] = useState(false);
  const [senhaBaixaInput, setSenhaBaixaInput] = useState("");
  const [senhaBaixaError, setSenhaBaixaError] = useState("");
  const [baixaPendingAction, setBaixaPendingAction] = useState(null);

  const executarComSenha102030 = (acao) => {
    setSenhaBaixaInput("");
    setSenhaBaixaError("");
    setBaixaPendingAction(() => acao);
    setSenhaBaixaModalOpen(true);
  };

  const handleConfirmarSenhaBaixa = () => {
    if (senhaBaixaInput.trim() !== "102030") {
      setSenhaBaixaError("ACESSO NEGADO: Senha de liberação incorreta! Tentativa registrada.");
      toast.error("ACESSO NEGADO: Senha incorreta! Tentativa registrada no sistema.");
      return;
    }
    setSenhaBaixaModalOpen(false);
    setSenhaBaixaInput("");
    setSenhaBaixaError("");
    toast.success("Autenticação autorizada! Processando baixa...");
    if (baixaPendingAction) {
      baixaPendingAction();
      setBaixaPendingAction(null);
    }
  };

  // Estados da Alta
  const [altaModalOpen, setAltaModalOpen] = useState(false);
  const [altaPacienteId, setAltaPacienteId] = useState(null);
  const [altaTipo, setAltaTipo] = useState("Alta Médica");
  const [altaDiasMedicao, setAltaDiasMedicao] = useState(0);
  const [altaReportData, setAltaReportData] = useState(null);
  const [altaDevolucoes, setAltaDevolucoes] = useState({}); // { [prescId]: { qtd: number, motivo: string } }

  // Estados de Exclusão Auditada com Motivo & Pacientes de Alta
  const [deleteLogModalOpen, setDeleteLogModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'paciente' | 'prescricao', id: string, name: string }
  const [deleteReason, setDeleteReason] = useState("");
  const [searchAltaPatient, setSearchAltaPatient] = useState("");

  // Estados de Devolução
  const [devolucaoModalOpen, setDevolucaoModalOpen] = useState(false);
  const [devolucaoPresc, setDevolucaoPresc] = useState(null);
  const [devolucaoQtd, setDevolucaoQtd] = useState("");
  const [devolucaoTipo, setDevolucaoTipo] = useState("Alta a Pedido");
  const [devolucaoMotivo, setDevolucaoMotivo] = useState("");

  // Estados para Modal de Transferência de Ala (Ala X -> Ala Y)
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferOriginAlaId, setTransferOriginAlaId] = useState("all");
  const [transferTargetAlaId, setTransferTargetAlaId] = useState("");
  const [transferSelectedPatientIds, setTransferSelectedPatientIds] = useState([]);
  const [transferLeitoStrategy, setTransferLeitoStrategy] = useState("keep"); // "keep" ou "define"
  const [transferSingleLeito, setTransferSingleLeito] = useState("");
  const [transferMotivo, setTransferMotivo] = useState("");

  // Estados para Modal de Impressão de Prescrições & Aprazamento (Checklist por Ala e Paciente)
  const [printPrescModalOpen, setPrintPrescModalOpen] = useState(false);
  const [printSelectedAlas, setPrintSelectedAlas] = useState(["all"]);
  const [printSelectedPatientIds, setPrintSelectedPatientIds] = useState([]);
  const [printPeriodoDias, setPrintPeriodoDias] = useState(1);
  const [printSearchPatient, setPrintSearchPatient] = useState("");
  const [printIncludeConsolidado, setPrintIncludeConsolidado] = useState(false);
  const [printIncludeKits, setPrintIncludeKits] = useState(true);

  // Estado para indicar reinternação de paciente de alta
  const [isReinternando, setIsReinternando] = useState(false);

  // Queries - com refetchInterval para sincronização automática entre Zorion Recepção e Zorion Saúde
  const { data: pacientes = [], isLoading: loadingPacientes } = useQuery({
    queryKey: ['pacientes'],
    queryFn: () => db.entities.Paciente.list(),
    refetchInterval: 2000,
  });

  const { data: prescricoes = [], isLoading: loadingPrescricoes } = useQuery({
    queryKey: ['prescricoes_paciente'],
    queryFn: () => db.entities.PrescricaoPaciente.list(),
    refetchInterval: 5000,
  });

  const { data: todasVisitas = [] } = useQuery({
    queryKey: ['todas_visitas'],
    queryFn: () => db.entities.Visita.list(),
    refetchInterval: 2000,
  });

  // Suspensão automática de prescrições com período finalizado (dataFim < hoje)
  useEffect(() => {
    if (!prescricoes || prescricoes.length === 0) return;
    const hojeStr = format(new Date(), "yyyy-MM-dd");

    const prescricoesVencidas = prescricoes.filter(pr => {
      const status = pr.status || "Ativa";
      return status === "Ativa" && pr.dataFim && pr.dataFim < hojeStr;
    });

    if (prescricoesVencidas.length === 0) return;

    let isMounted = true;
    (async () => {
      let suspensasCount = 0;
      for (const pr of prescricoesVencidas) {
        try {
          const obsAnterior = pr.observacoes ? `${pr.observacoes} | ` : "";
          const dataFimFmt = pr.dataFim ? new Date(pr.dataFim).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : pr.dataFim;
          const novaObs = `${obsAnterior}Tratamento com duração programada finalizado em ${dataFimFmt} (Suspenso automaticamente)`;
          
          await db.entities.PrescricaoPaciente.update(pr.id, {
            status: "Suspensa",
            observacoes: novaObs,
            data_suspensao: new Date().toISOString()
          });
          
          await db.logAction(
            "SUSPENSAO_AUTOMATICA_PRESCRICAO",
            "PrescricaoPaciente",
            pr.id,
            `Suspensão automática por término do período programado (${pr.dataInicio || ''} até ${pr.dataFim}) do medicamento '${pr.medicamentoNome}' do paciente '${pr.pacienteNome || pr.pacienteId}'.`
          );
          suspensasCount++;
        } catch (err) {
          console.error("Erro na suspensão automática da prescrição:", pr.id, err);
        }
      }

      if (isMounted && suspensasCount > 0) {
        queryClient.invalidateQueries({ queryKey: ['prescricoes_paciente'] });
        toast.info(
          `Tratamento concluído: ${suspensasCount} prescrição(ões) com período finalizado foram suspensas automaticamente.`,
          { duration: 6000 }
        );
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [prescricoes, queryClient]);

  const { data: medicamentos = [], isLoading: loadingMeds } = useQuery({
    queryKey: ['medicamentos'],
    queryFn: () => db.entities.Medicamento.list(),
  });

  // Mostra todos os medicamentos, independente do estoque (Central ou Satélite), conforme solicitado.
  // A cor no combobox indicará visualmente onde há estoque.
  const medicamentosComEstoque = useMemo(() => {
    return medicamentos || [];
  }, [medicamentos]);

  const { data: lotes = [] } = useQuery({
    queryKey: ['lotes'],
    queryFn: () => db.entities.Lote.list(),
  });

  const { data: alas = [] } = useQuery({
    queryKey: ['alas'],
    queryFn: () => db.entities.Ala.list(),
  });

  const { data: saidas = [] } = useQuery({
    queryKey: ['saidas'],
    queryFn: () => db.entities.Saida.list(),
  });

  const { data: gavetas = [] } = useQuery({
    queryKey: ['gavetas_paciente'],
    queryFn: () => db.entities.GavetaPaciente.list ? db.entities.GavetaPaciente.list() : [],
  });

  const getSaidasDoPaciente = (pacienteNome, pacienteId) => {
    if (!pacienteNome && !pacienteId) return [];
    const normNome = pacienteNome ? pacienteNome.trim().toLowerCase() : "";
    return saidas.filter(s => {
      const sNome = (s.paciente_nome || "").trim().toLowerCase();
      const matchNome = Boolean(normNome && sNome && (sNome === normNome || sNome.includes(normNome) || normNome.includes(sNome)));
      const matchId = Boolean(pacienteId && (s.paciente_id === pacienteId || s.pacienteId === pacienteId));
      return matchNome || matchId;
    }).sort((a, b) => new Date(b.created_at || b.data_saida || 0) - new Date(a.created_at || a.data_saida || 0));
  };

  const getSaidasAvulsasDoPaciente = (pacienteNome, pacienteId) => {
    return getSaidasDoPaciente(pacienteNome, pacienteId).filter(s => 
      (!s.motivo || !s.motivo.startsWith("Baixa de medicação fixa"))
    );
  };

  // Patient Mutations
  const savePatientMutation = useMutation({
    mutationFn: async (data) => {
      // 1. Validação de duplicidade: não permite múltiplos pacientes ativos com o mesmo prontuário
      const rawProntuario = (data.prontuario || "").trim().toLowerCase();
      const duplicateActive = pacientes.find(p => 
        (p.prontuario || "").trim().toLowerCase() === rawProntuario &&
        p.status !== "Alta" &&
        (!editingPatient || p.id !== editingPatient.id)
      );
      if (duplicateActive) {
        throw new Error(`Já existe um paciente ativo cadastrado com o prontuário "${data.prontuario}": ${duplicateActive.nome} (${duplicateActive.alaNome || 'Ala Geral'} • Leito: ${duplicateActive.leito || 'S/L'}).`);
      }

      if (editingPatient) {
        const payload = {
          ...data,
          status: "Ativo",
          dataAlta: null
        };
        const res = await db.entities.Paciente.update(editingPatient.id, payload);
        if (data.alaNome !== editingPatient.alaNome || data.leito !== editingPatient.leito) {
          const pacPrescs = prescricoes.filter(pr => (pr.pacienteId === editingPatient.id || pr.paciente_id === editingPatient.id) && pr.status === "Ativa");
          for (const presc of pacPrescs) {
            await db.entities.PrescricaoPaciente.update(presc.id, {
              alaNome: data.alaNome,
              leito: data.leito
            });
          }
        }
        return res;
      }
      return db.entities.Paciente.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pacientes'] });
      queryClient.invalidateQueries({ queryKey: ['prescricoes_paciente'] });
      setPatientModalOpen(false);
      const wasReinternando = isReinternando;
      setEditingPatient(null);
      setIsReinternando(false);
      toast.success(
        wasReinternando 
          ? "Paciente reinternado e reativado com sucesso!" 
          : (editingPatient ? "Paciente atualizado com sucesso!" : "Paciente cadastrado com sucesso!")
      );
    },
    onError: (err) => toast.error("Erro ao salvar paciente: " + (err?.message || (typeof err === "string" ? err : "Erro desconhecido")))
  });

  const deletePatientMutation = useMutation({
    mutationFn: (id) => db.entities.Paciente.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pacientes'] });
      toast.success("Paciente excluído com sucesso!");
    }
  });

  // Prescription Mutations
  const savePrescMutation = useMutation({
    mutationFn: async (data) => {
      const rawTarget = data.pacienteId || (editingPresc ? (editingPresc.pacienteId || editingPresc.paciente_id || editingPresc.pacienteid) : "") || (viewPatientDetails ? viewPatientDetails.id : "");
      const pacienteId = (typeof rawTarget === "object" && rawTarget !== null)
        ? String(rawTarget.id || "")
        : String(rawTarget || "");

      const patient = pacientes.find(p => String(p.id) === String(pacienteId)) || 
                      (viewPatientDetails && String(viewPatientDetails.id) === String(pacienteId) ? viewPatientDetails : null);
      const med = medicamentos.find(m => String(m.id) === String(data.medicamentoId));

      if (!med) {
        throw new Error("Apenas medicamentos já cadastrados no sistema podem ser selecionados para a prescrição.");
      }

      const d08 = parseFloat(data.dose08) || 0;
      const d14 = parseFloat(data.dose14) || 0;
      const d22 = parseFloat(data.dose22) || 0;
      const d06 = parseFloat(data.dose06) || 0;
      const totalDiario = d08 + d14 + d22 + d06;
      const esquema = `${d08}-${d14}-${d22}-${d06}`;

      const isLiq = isLiquido(med);
      const unDose = isLiq ? (data.unidadeDose || "ml") : "comp";
      const volMl = isLiq ? (Number(data.volumeFrascoMl) || extrairVolumeMl(med) || 100) : null;
      let consumoDiarioMl = totalDiario;
      if (isLiq && unDose === "gotas") {
        consumoDiarioMl = converterGotasParaMl(totalDiario);
      }
      const duracaoDias = isLiq ? (calcularDuracaoFrascoDias(volMl, consumoDiarioMl) || 10) : null;

      const resolvedPacienteId = pacienteId || (patient ? String(patient.id) : "");

      const payload = {
        pacienteId: resolvedPacienteId,
        pacienteNome: patient ? patient.nome : (data.pacienteNome || "Paciente não informado"),
        prontuario: patient ? (patient.prontuario || "") : (data.prontuario || ""),
        alaNome: patient ? (patient.alaNome || "") : (data.alaNome || ""),
        leito: patient ? (patient.leito || "") : (data.leito || ""),
        medicamentoId: data.medicamentoId,
        medicamentoNome: med ? med.nome : (data.medicamentoNome || "Medicamento não informado"),
        medicamentoCodigo: med ? (med.codigo || "") : (data.medicamentoCodigo || ""),
        apresentacao: med ? (med.apresentacao || "") : (data.apresentacao || ""),
        concentracao: med ? (med.concentracao || (med.unidade_medida && !["un", "unidade", "unid", "-", ""].includes(med.unidade_medida.toLowerCase()) ? med.unidade_medida : "") || "") : (data.concentracao || ""),
        dose08: String(data.dose08 ?? "0"),
        dose14: String(data.dose14 ?? "0"),
        dose22: String(data.dose22 ?? "0"),
        dose06: String(data.dose06 ?? "0"),
        isMetade08: Boolean(data.isMetade08),
        isMetade14: Boolean(data.isMetade14),
        isMetade22: Boolean(data.isMetade22),
        isMetade06: Boolean(data.isMetade06),
        esquemaPosologico: esquema,
        totalDiario: totalDiario,
        is_liquido: isLiq,
        unidade_dose: unDose,
        volume_frasco_ml: volMl,
        duracao_frasco_dias: duracaoDias,
        data_ultimo_frasco: editingPresc ? editingPresc.data_ultimo_frasco : null,
        data_proximo_frasco: editingPresc ? editingPresc.data_proximo_frasco : null,
        horarios: JSON.stringify([
          { hora: "08:00", turno: "Manhã", dose: d08 },
          { hora: "14:00", turno: "Tarde", dose: d14 },
          { hora: "22:00", turno: "Noite", dose: d22 },
          { hora: "06:00", turno: "Madrugada/Manhã", dose: d06 },
        ]),
        dataInicio: data.dataInicio || format(new Date(), "yyyy-MM-dd"),
        dataFim: data.dataFim || null,
        horarioInicio: data.horarioInicio || "08:00",
        status: data.status || "Ativa",
        diasSemana: JSON.stringify(data.diasSemana || [0, 1, 2, 3, 4, 5, 6]),
        tipoFrequencia: data.tipoFrequencia || "diaria",
        intervaloDias: Math.max(1, parseInt(data.intervaloDias, 10) || 1),
        observacoes: data.observacoes || ""
      };

      let result;
      if (editingPresc && data.gerarHistorico) {
        const today = format(new Date(), "yyyy-MM-dd");
        const motivo = data.motivoAlteracao
          ? `${data.motivoAlteracao} (Esquema anterior: ${editingPresc.esquemaPosologico})`
          : `Alterado em ${format(new Date(), "dd/MM/yyyy")}: esquema ${editingPresc.esquemaPosologico} alterado para ${esquema}`;

        // 1. Arquiva a prescrição antiga como Suspensa no histórico com dataFim = hoje
        await db.entities.PrescricaoPaciente.update(editingPresc.id, {
          status: "Suspensa",
          dataFim: today,
          data_suspensao: new Date().toISOString(),
          observacoes: editingPresc.observacoes
            ? `${editingPresc.observacoes} | ${motivo}`
            : motivo
        });

        // 2. Cria a nova prescrição com o novo esquema ativado
        const newPayload = {
          ...payload,
          dataInicio: data.dataInicio || today,
          dataFim: data.dataFim || null,
          status: "Ativa",
          observacoes: data.observacoes || (data.motivoAlteracao ? `Ajustado de ${editingPresc.esquemaPosologico} para ${esquema}: ${data.motivoAlteracao}` : "")
        };
        result = await db.entities.PrescricaoPaciente.create(newPayload);

        await db.logAction(
          "ALTERACAO_PRESCRICAO",
          "PrescricaoPaciente",
          result?.id || editingPresc.id,
          `Prescrição alterada para paciente '${patient?.nome || pacienteId}': esquema anterior '${editingPresc.esquemaPosologico}' arquivado no histórico e novo esquema '${esquema}' ativado.`
        );
      } else if (editingPresc) {
        result = await db.entities.PrescricaoPaciente.update(editingPresc.id, payload);
        await db.logAction(
          "ALTERACAO_PRESCRICAO",
          "PrescricaoPaciente",
          editingPresc.id,
          `Alteração na prescrição do paciente (ID: ${pacienteId || editingPresc.pacienteId}): Medicamento '${editingPresc.medicamentoNome || payload.medicamentoNome}', status: ${payload.status}`
        );
      } else {
        result = await db.entities.PrescricaoPaciente.create(payload);
        await db.logAction(
          "CRIACAO_PRESCRICAO",
          "PrescricaoPaciente",
          result?.id || pacienteId,
          `Nova prescrição adicionada para paciente ID: ${pacienteId}: Medicamento ID: ${payload.medicamentoId}, via: ${med?.via_administracao || data.viaAdministracao || '-'}`
        );
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescricoes_paciente'] });
      setPrescModalOpen(false);
      setEditingPresc(null);
      toast.success(editingPresc ? "Prescrição alterada e histórico do esquema anterior gerado com sucesso!" : "Prescrição fixa salva com sucesso!");
    },
    onError: (err) => toast.error("Erro ao salvar prescrição: " + (err?.message || (typeof err === "string" ? err : "Erro desconhecido")))
  });

  const togglePrescStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const newStatus = status === "Ativa" ? "Suspensa" : "Ativa";
      const todayStr = getLocalDateString();
      const updateData = { status: newStatus };
      if (newStatus === "Suspensa") {
        updateData.data_suspensao = new Date().toISOString();
        updateData.dataFim = todayStr;
      } else {
        updateData.data_suspensao = null;
      }
      const res = await db.entities.PrescricaoPaciente.update(id, updateData);
      await db.logAction(
        newStatus === "Suspensa" ? "SUSPENSAO_PRESCRICAO" : "REATIVACAO_PRESCRICAO",
        "PrescricaoPaciente",
        id,
        `Status da prescrição alterado de '${status}' para '${newStatus}'`
      );
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescricoes_paciente'] });
      toast.success("Status da prescrição alterado!");
    }
  });

  const deletePrescMutation = useMutation({
    mutationFn: async (id) => {
      const res = await db.entities.PrescricaoPaciente.delete(id);
      await db.logAction(
        "EXCLUSAO_PRESCRICAO",
        "PrescricaoPaciente",
        id,
        `Prescrição excluída permanentemente pelo usuário`
      );
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescricoes_paciente'] });
      toast.success("Prescrição removida!");
    }
  });

  // Baixa no estoque
  // Baixa no estoque
  const efetuarBaixaMutation = useMutation({
    mutationFn: async (itensConsolidados) => {
      const nowStr = new Date().toISOString();
      const todayDateStr = getLocalDateString();
      // 1. Validar se TODOS os itens possuem estoque suficiente EXCLUSIVAMENTE na Farmácia Satélite
      for (const item of itensConsolidados) {
        const med = medicamentos.find(m => m.id === item.medicamentoId);
        const saldoSatelite = med ? (Number(med.estoque_satelite) || 0) : 0;
        if (saldoSatelite < item.qtdPeriodo) {
          throw new Error(
            `Estoque insuficiente na Farmácia Satélite para: "${med?.nome || item.nome}". Necessário: ${item.qtdPeriodo} un, Disponível na Satélite: ${saldoSatelite} un. Não é permitido dar baixa usando estoque da Central.`
          );
        }
      }

      for (const item of itensConsolidados) {
        const med = medicamentos.find(m => m.id === item.medicamentoId);
        if (med) {
          const novoSatelite = Math.max(0, (Number(med.estoque_satelite) || 0) - item.qtdPeriodo);

          // Atualiza EXCLUSIVAMENTE o estoque_satelite (NUNCA toca no estoque_atual da Central)
          await db.entities.Medicamento.update(med.id, {
            estoque_satelite: novoSatelite
          });

          // Lotes disponíveis deste medicamento ordenados por vencimento (FEFO) para identificação e rastreabilidade
          const medLotes = (lotes || [])
            .filter(l => (l.medicamento_id === med.id || l.medicamentoId === med.id))
            .sort((a, b) => new Date(a.data_validade) - new Date(b.data_validade));
          const loteDoMed = medLotes[0] || lotes.find(l => (l.medicamento_id === med.id || l.medicamentoId === med.id));

          // A baixa da Satélite NUNCA altera a quantidade_atual do lote físico da Central
          const loteId = loteDoMed ? loteDoMed.id : (lotes[0]?.id || "lote_fixo");
          const numeroLote = loteDoMed ? (loteDoMed.numero_lote || "S/ Lote") : "Saída Fixa Continuada";

          let responsavel = "Farmacêutico";
          let responsavelCrf = "";
          try {
            const rawU = localStorage.getItem("pharma_user");
            if (rawU) {
              const u = JSON.parse(rawU);
              responsavel = u.full_name || u.nome || u.login || "Farmacêutico";
              responsavelCrf = u.crf || "";
            }
          } catch (e) {}

          await db.entities.Saida.create({
            medicamento_id: med.id,
            medicamento_nome: med.nome,
            lote_id: loteId,
            numero_lote: numeroLote,
            quantidade: item.qtdPeriodo,
            destino: "Dispensação Pacientes Continuados",
            ala_nome: "Geral",
            motivo: `Baixa programada de medicação fixa para ${periodoDias} ${periodoDias === 1 ? 'dia' : 'dias'} (${item.totalPacientes} paciente${item.totalPacientes === 1 ? '' : 's'})`,
            observacao: `Baixa automática consolidada do relatório de ${periodoDias} ${periodoDias === 1 ? 'dia' : 'dias'}`,
            data_saida: todayDateStr,
            created_at: nowStr,
            responsavel: responsavel,
            responsavel_crf: responsavelCrf,
            usuario_nome: responsavel
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      queryClient.invalidateQueries({ queryKey: ['saidas'] });
      setBaixaModalOpen(false);
      toast.success(`Baixa de estoque efetuada com sucesso para a previsão de ${periodoDias} dias!`);
    },
    onError: (err) => toast.error("Erro ao efetuar baixa em estoque: " + err.message)
  });

  // Baixa em Lote dos Pacientes Selecionados
  const efetuandoBaixaLoteMutation = useMutation({
    mutationFn: async ({ patientIds, dias, customQtds = {} }) => {
      const nowStr = new Date().toISOString();
      const todayDateStr = getLocalDateString();
      const hojeDate = new Date();
      const dataInicioStr = todayDateStr;
      const dataFimDate = addDays(hojeDate, Math.max(1, dias) - 1);
      const dataFimStr = format(dataFimDate, "yyyy-MM-dd");

      const selectedPacs = pacientes.filter(p => patientIds.includes(p.id));
      const activePrescs = prescricoes.filter(pr => {
        const pId = pr.pacienteId || pr.paciente_id;
        const status = pr.status || "Ativa";
        return patientIds.includes(pId) && status === "Ativa";
      });

      // Etapa 1: Calcular saídas e deduções diretas (unidades inteiras)
      const saidasParaRegistrar = [];
      const deducoesEstoqueCentral = {};

      for (const pr of activePrescs) {
        const pacId = pr.pacienteId || pr.paciente_id;
        const medId = pr.medicamentoId || pr.medicamento_id;

        const d08 = getDoseForHora(pr.horarios, "08:00");
        const d14 = getDoseForHora(pr.horarios, "14:00");
        const d22 = getDoseForHora(pr.horarios, "22:00");
        const d06 = getDoseForHora(pr.horarios, "06:00");
        const calculatedDaily = d08 + d14 + d22 + d06;
        const dailyTotal = calculatedDaily > 0 ? calculatedDaily : (parseFloat(pr.totalDiario) || 0);

        const qtdSugerida = calculatePrescQtdParaDias(pr, dias);
        const cobAte = pr.coberto_ate ? pr.coberto_ate.split("T")[0] : null;
        const jaCoberto = Boolean(cobAte && cobAte >= dataFimStr);

        const qtdSaida = (customQtds && customQtds[pr.id] !== undefined && customQtds[pr.id] !== "")
          ? Math.max(0, parseInt(customQtds[pr.id]) || 0)
          : (jaCoberto ? 0 : qtdSugerida);

        if (qtdSaida <= 0) continue;

        deducoesEstoqueCentral[medId] = (deducoesEstoqueCentral[medId] || 0) + qtdSaida;

        saidasParaRegistrar.push({
           pr, pacId, medId, qtdSaida, dailyTotal
        });
      }

      // Etapa 2: Validar se há estoque suficiente para TODAS as deduções
      for (const [medId, totalQtd] of Object.entries(deducoesEstoqueCentral)) {
        const med = medicamentos.find(m => m.id === medId);
        const atualSatelite = med ? (med.estoque_satelite || 0) : 0;
        if (atualSatelite < totalQtd) {
          throw new Error(`Estoque insuficiente na Farmácia Satélite para: ${med ? med.nome : "Medicamento Desconhecido"}. Necessário: ${totalQtd} un, Disponível: ${atualSatelite} un`);
        }
      }

      // Etapa 3: Criar registros de saída para o estoque e histórico, e deduzir saldo do lote
      for (const saida of saidasParaRegistrar) {
        const { pr, pacId, medId, qtdSaida, dailyTotal } = saida;
        
        const pac = selectedPacs.find(p => p.id === pacId);
        const med = medicamentos.find(m => m.id === medId);

        // Lotes disponíveis deste medicamento ordenados por vencimento (FEFO)
        const medLotes = (lotes || [])
          .filter(l => (l.medicamento_id === medId || l.medicamentoId === medId) && (Number(l.quantidade_atual) || 0) > 0 && l.status !== "Inativo")
          .sort((a, b) => new Date(a.data_validade) - new Date(b.data_validade));

        // Priorizar lote selecionado na interface ou o 1º lote pelo FEFO
        const customLoteId = selectedLotesBaixa[pr.id];
        let loteEscolhido = medLotes.find(l => l.id === customLoteId) || medLotes[0];

        // Se não houver saldo em lotes ativos, busca qualquer lote cadastrado
        if (!loteEscolhido) {
          loteEscolhido = (lotes || []).find(l => (l.medicamento_id === medId || l.medicamentoId === medId));
        }

        const loteId = loteEscolhido ? loteEscolhido.id : null;
        const numeroLote = loteEscolhido ? (loteEscolhido.numero_lote || "S/ Lote") : "S/ Lote";

        // A baixa realizada pela Farmácia Satélite é estritamente vinculada ao estoque_satelite e nunca reduz a quantidade_atual do lote físico da Central

        let responsavel = "Farmacêutico";
        let responsavelCrf = "";
        try {
          const rawU = localStorage.getItem("pharma_user");
          if (rawU) {
            const u = JSON.parse(rawU);
            responsavel = u.full_name || u.nome || u.login || "Farmacêutico";
            responsavelCrf = u.crf || "";
          }
        } catch (e) {}

        if (loteId && loteEscolhido) {
          const novaQtdSat = Math.max(0, (Number(loteEscolhido.quantidade_satelite) || 0) - qtdSaida);
          await db.entities.Lote.update(loteId, { quantidade_satelite: novaQtdSat });
        }

        await db.entities.Saida.create({
          medicamento_id: medId,
          medicamento_nome: pr.medicamentoNome || pr.medicamento_nome || (med ? med.nome : "Medicamento"),
          lote_id: loteId,
          numero_lote: numeroLote,
          quantidade: qtdSaida,
          destino: pac ? `Paciente ${pac.nome} (Leito: ${pac.leito || "S/L"})` : "Paciente",
          paciente_nome: pac ? pac.nome : "",
          paciente_id: pacId,
          prescricao_id: pr.id,
          ala_id: pac?.alaId || pac?.ala_id || null,
          ala_nome: pac ? (pac.alaNome || pac.ala_nome || "Ala Geral") : "Geral",
          motivo: `Baixa de medicação (${dias} ${dias === 1 ? 'dia' : 'dias'})`,
          observacao: `Grade: ${pr.esquemaPosologico || '4 Horários'} | Qt: ${qtdSaida} un | Lote: ${numeroLote} | Cobertura: ${format(hojeDate, "dd/MM")} a ${format(dataFimDate, "dd/MM/yyyy")}`,
          data_saida: todayDateStr,
          created_at: nowStr,
          responsavel: responsavel,
          responsavel_crf: responsavelCrf,
          usuario_nome: responsavel,
          dias_cobertura: dias,
          data_inicio_cobertura: dataInicioStr,
          data_fim_cobertura: dataFimStr,
          dose_diaria: dailyTotal,
          is_baixa_lote_paciente: true
        });

        // Atualizar prescrição com cobertura e dose dispensada
        await db.entities.PrescricaoPaciente.update(pr.id, {
          coberto_ate: dataFimStr,
          ultimo_lote_dias: dias,
          data_ultima_dispensacao: dataInicioStr,
          dose_diaria_dispensada: dailyTotal,
          quantidade_ultimo_lote: qtdSaida
        });
      }

      // Atualizar ciclo nos pacientes
      for (const pac of selectedPacs) {
        await db.entities.Paciente.update(pac.id, {
          ciclo_coberto_ate: dataFimStr,
          ultimo_ciclo_dias: dias,
          data_ultimo_ciclo: dataInicioStr
        });
      }

      // Etapa 4: Atualizar estoque_satelite com a dedução direta
      for (const [medId, totalQtd] of Object.entries(deducoesEstoqueCentral)) {
        const med = medicamentos.find(m => m.id === medId);
        if (med) {
          await db.entities.Medicamento.update(medId, {
            estoque_satelite: Math.max(0, (med.estoque_satelite || 0) - totalQtd)
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      queryClient.invalidateQueries({ queryKey: ['saidas'] });
      queryClient.invalidateQueries({ queryKey: ['gavetas_paciente'] });
      queryClient.invalidateQueries({ queryKey: ['prescricoes_paciente'] });
      queryClient.invalidateQueries({ queryKey: ['pacientes'] });
      setBatchBaixaModalOpen(false);
      setSelectedPatientIds([]);
      setSelectedLotesBaixa({});
      setCustomQtdsBaixa({});
      toast.success("Baixa em lote concluída! As saídas foram registradas com sucesso no módulo de Saídas e as coberturas foram atualizadas.");
    },
    onError: (err) => {
      toast.error("Erro ao efetuar baixa em lote: " + (err.message || err));
    }
  });

  // Mutation de Exclusão Auditada com Registro de Log Permanante
  const executeDeleteWithLogMutation = useMutation({
    mutationFn: async ({ type, id, name, reason }) => {
      const nowStr = new Date().toISOString();
      const todayDateStr = getLocalDateString();

      const firstMed = medicamentos.length > 0 ? medicamentos[0] : null;
      const firstLote = lotes.length > 0 ? lotes[0] : null;

      // 1. Gravar Registro de LOG de Auditoria nas Saídas/Histórico
      await db.entities.Saida.create({
        medicamento_id: type === 'paciente' ? (firstMed ? firstMed.id : null) : id,
        medicamento_nome: `[LOG EXCLUSÃO] ${type === 'paciente' ? 'Paciente' : 'Prescrição'}: ${name}`,
        lote_id: firstLote ? firstLote.id : null,
        numero_lote: "AUDITORIA",
        quantidade: 0,
        destino: "Auditoria de Logs",
        motivo: `EXCLUSÃO DE ${type === 'paciente' ? 'PACIENTE' : 'PRESCRIÇÃO'}: ${reason}`,
        observacao: `Item [${name}] excluído. Motivo declarado: ${reason}`,
        data_saida: todayDateStr,
        created_at: nowStr
      });

      // 2. Executar deleção real
      if (type === 'paciente') {
        const userPrescs = prescricoes.filter(pr => (pr.pacienteId === id || pr.paciente_id === id));
        for (const pr of userPrescs) {
          await db.entities.PrescricaoPaciente.delete(pr.id);
        }
        await db.entities.Paciente.delete(id);
      } else {
        await db.entities.PrescricaoPaciente.delete(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pacientes'] });
      queryClient.invalidateQueries({ queryKey: ['prescricoes_paciente'] });
      queryClient.invalidateQueries({ queryKey: ['saidas'] });
      setDeleteLogModalOpen(false);
      setDeleteTarget(null);
      setDeleteReason("");
      toast.success("Item excluído com sucesso! Motivo salvo no LOG auditado.");
    },
    onError: (err) => {
      toast.error("Erro ao realizar exclusão: " + (err.message || err));
    }
  });

  // Mutation de Devolução
  const efetuarDevolucaoMutation = useMutation({
    mutationFn: async ({ presc, qtd, tipo, motivo }) => {
      const nowStr = new Date().toISOString();
      const todayDateStr = getLocalDateString();
      
      const med = medicamentos.find(m => m.id === (presc.medicamentoId || presc.medicamento_id));
      if (!med) throw new Error("Medicamento não encontrado.");
      
      const pac = pacientes.find(p => p.id === (presc.pacienteId || presc.paciente_id));

      // Atualiza Estoque Satélite
      const newSatelite = (med.estoque_satelite || 0) + parseInt(qtd, 10);
      await db.entities.Medicamento.update(med.id, {
        estoque_satelite: newSatelite
      });

      const loteDoMed = lotes.find(l => l.medicamento_id === med.id || l.medicamentoId === med.id);
      
      // Cria Entrada para constar no Livro Portaria e relatórios (Satélite)
      await db.entities.Entrada.create({
        medicamento_id: med.id,
        medicamento_nome: med.nome,
        fornecedor_nome: (pac ? `Devolução Paciente: ${pac.nome}` : "Devolução") + ` - ${tipo} ${motivo ? '('+motivo+')' : ''}`,
        lote_id: loteDoMed ? loteDoMed.id : null,
        numero_lote: loteDoMed ? loteDoMed.numero_lote : "DEVOLVIDO",
        data_validade: loteDoMed ? loteDoMed.data_validade : null,
        quantidade: parseInt(qtd, 10),
        data_entrada: todayDateStr,
        created_at: nowStr
      });

      // Altera status da prescrição
      await db.entities.PrescricaoPaciente.update(presc.id, {
        status: "Devolvida",
        observacoes: (presc.observacoes || "") + ` [Devolução de ${qtd}un: ${tipo}${motivo ? " - " + motivo : ""}]`
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      queryClient.invalidateQueries({ queryKey: ['prescricoes_paciente'] });
      queryClient.invalidateQueries({ queryKey: ['entradas'] });
      setDevolucaoModalOpen(false);
      setDevolucaoPresc(null);
      setDevolucaoQtd("");
      setDevolucaoMotivo("");
      toast.success("Medicação devolvida! Estoque Satélite atualizado.");
    },
    onError: (err) => {
      toast.error("Erro ao devolver medicação: " + (err.message || err));
    }
  });

  // Mutation para Dar Alta ao Paciente
  const darAltaPacienteMutation = useMutation({
    mutationFn: async ({ pacienteId, tipo, dias, devolucoes }) => {
      const pac = pacientes.find(p => p.id === pacienteId);
      if (!pac) return null;

      const nowStr = new Date().toISOString();
      const todayDateStr = getLocalDateString();

      // 1. Alterar status do paciente para Alta
      await db.entities.Paciente.update(pacienteId, {
        status: "Alta"
      });

      // 2. Coletar e Suspender todas as prescrições do paciente
      const userPrescs = prescricoes.filter(pr => (pr.pacienteId === pacienteId || pr.paciente_id === pacienteId) && (pr.status === "Ativa" || !pr.status));
      
      const relatorioAlta = [];

      for (const pr of userPrescs) {
        // Calcular para o relatório se necessário
        if (dias > 0) {
          const d08 = getDoseForHora(pr.horarios, "08:00");
          const d14 = getDoseForHora(pr.horarios, "14:00");
          const d22 = getDoseForHora(pr.horarios, "22:00");
          const d06 = getDoseForHora(pr.horarios, "06:00");
          const totalDiario = d08 + d14 + d22 + d06;
          
          if (totalDiario > 0) {
            const med = medicamentos.find(m => m.id === (pr.medicamentoId || pr.medicamento_id));
            relatorioAlta.push({
              medNome: med ? med.nome : pr.medicamentoNome,
              posologia: `${d08}-${d14}-${d22}-${d06}`,
              total: totalDiario * dias
            });
          }
        }

        // Lógica de Devolução Automática (se houver devolucoes informadas)
        let extraObs = "";
        const devInfo = devolucoes && devolucoes[pr.id];
        if (devInfo && parseInt(devInfo.qtd, 10) > 0) {
          const devQtd = parseInt(devInfo.qtd, 10);
          const devMotivo = devInfo.motivo || "";
          const med = medicamentos.find(m => m.id === (pr.medicamentoId || pr.medicamento_id));
          
          if (med) {
             // Atualizar estoque satélite
             await db.entities.Medicamento.update(med.id, {
                estoque_satelite: (med.estoque_satelite || 0) + devQtd
             });
             const loteDoMed = lotes.find(l => l.medicamento_id === med.id || l.medicamentoId === med.id);
             
             // Criar Entrada no DB (Satélite)
             await db.entities.Entrada.create({
                medicamento_id: med.id,
                medicamento_nome: med.nome,
                fornecedor_nome: `Devolução Alta Paciente: ${pac.nome} - ${tipo} ${devMotivo ? '('+devMotivo+')' : ''}`,
                lote_id: loteDoMed ? loteDoMed.id : null,
                numero_lote: loteDoMed ? loteDoMed.numero_lote : "DEVOLVIDO",
                data_validade: loteDoMed ? loteDoMed.data_validade : null,
                quantidade: devQtd,
                data_entrada: todayDateStr,
                created_at: nowStr
             });
             extraObs = ` [Devolução de ${devQtd}un: ${devMotivo || 'Alta'}]`;
          }
        }

        await db.entities.PrescricaoPaciente.update(pr.id, {
          status: devInfo && parseInt(devInfo.qtd, 10) > 0 ? "Devolvida" : "Suspensa",
          data_suspensao: nowStr,
          dataFim: todayDateStr,
          observacoes: (pr.observacoes || "") + ` [Suspensa por ${tipo.toUpperCase()}]${extraObs}`
        });
      }

      // 3. Descarte de medicamentos fracionados na Gaveta (Portaria 344)
      const gavetasDoPaciente = gavetas.filter(g => g.paciente_id === pacienteId && (g.quantidade > 0));
      for (const gav of gavetasDoPaciente) {
         const med = medicamentos.find(m => m.id === gav.medicamento_id);
         await db.entities.Saida.create({
            medicamento_id: gav.medicamento_id,
            medicamento_nome: med ? med.nome : "Medicamento Desconhecido",
            lote_id: gav.lote_id,
            numero_lote: "DESCARTE",
            quantidade: 0, // Apenas descarte de frações
            destino: "Descarte Especial SNGPC",
            paciente_nome: pac.nome,
            motivo: `Descarte de sobras fracionadas (${gav.quantidade} metades) - Alta: ${tipo}`,
            observacao: `Descarte obrigatório de medicamento fracionado após alta hospitalar (Portaria 344).`,
            data_saida: todayDateStr,
            created_at: nowStr
         });
         // Zera a gaveta do paciente
         await db.entities.GavetaPaciente.update(gav.id, { quantidade: 0 });
      }

      // 4. Registrar Log Auditado de Alta
      const firstMed = medicamentos.length > 0 ? medicamentos[0] : null;
      const firstLote = lotes.length > 0 ? lotes[0] : null;

      await db.entities.Saida.create({
        medicamento_id: firstMed ? firstMed.id : null,
        medicamento_nome: `[LOG ALTA] Paciente: ${pac.nome}`,
        lote_id: firstLote ? firstLote.id : null,
        numero_lote: "ALTA",
        quantidade: 0,
        destino: "Histórico de Altas",
        motivo: `${tipo} concedida ao paciente ${pac.nome} (Prontuário: ${pac.prontuario || "N/A"})`,
        observacao: `Prescrições suspensas. Levar medicação: ${dias} dias. ${gavetasDoPaciente.length > 0 ? gavetasDoPaciente.length + ' sobras descartadas.' : ''}`,
        data_saida: todayDateStr,
        created_at: nowStr
      });

      await db.logAction(
        "ALTA_PACIENTE",
        "Paciente",
        pac.id,
        `${tipo} concedida ao paciente '${pac.nome}' (Prontuário: ${pac.prontuario || 'N/A'}, Leito: ${pac.leito || '-'}). Prescrições ativas suspensas.`
      );

      return { pac, tipo, dias, relatorioAlta };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pacientes'] });
      queryClient.invalidateQueries({ queryKey: ['prescricoes_paciente'] });
      queryClient.invalidateQueries({ queryKey: ['saidas'] });
      queryClient.invalidateQueries({ queryKey: ['gavetas_paciente'] });
      if (viewPatientDetails) setViewPatientDetails(null);
      setAltaModalOpen(false);
      
      toast.success("Alta do paciente registrada! Prescrições suspensas.");

      if (data && data.dias > 0 && data.relatorioAlta.length > 0) {
        setAltaReportData(data);
      }
    },
    onError: (err) => {
      toast.error("Erro ao conceder alta: " + (err.message || err));
    }
  });

  // Mutation para Reativar Paciente
  const reativarPacienteMutation = useMutation({
    mutationFn: async (pacienteId) => {
      await db.entities.Paciente.update(pacienteId, {
        status: "Ativo"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pacientes'] });
      toast.success("Paciente reativado! Os remédios antigos estão no histórico. Lembre-se de cadastrar as novas medicações.");
    }
  });

  // Mutation de Transferência de Paciente(s) entre Alas (Ala X -> Ala Y)
  const transferPatientMutation = useMutation({
    mutationFn: async ({ patientIds, targetAlaId, leitoStrategy, singleLeito, motivo }) => {
      const targetAla = alas.find(a => a.id === targetAlaId);
      if (!targetAla) throw new Error("Selecione a ala de destino.");
      if (!patientIds || patientIds.length === 0) throw new Error("Nenhum paciente selecionado para transferência.");

      const now = new Date();
      const timestamp = format(now, "dd/MM/yyyy HH:mm");
      const transferNote = motivo?.trim() 
        ? `Transferido para ${targetAla.nome} em ${timestamp} (${motivo.trim()})`
        : `Transferido para ${targetAla.nome} em ${timestamp}`;

      for (const pid of patientIds) {
        const pac = pacientes.find(p => p.id === pid);
        if (!pac) continue;

        const newLeito = (patientIds.length === 1 && singleLeito !== undefined && singleLeito.trim() !== "")
          ? singleLeito.trim()
          : (leitoStrategy === "keep" ? (pac.leito || "") : (singleLeito?.trim() || pac.leito || ""));

        const updatedObs = pac.observacoes 
          ? `${pac.observacoes} | ${transferNote}`
          : transferNote;

        // 1. Atualiza dados do Paciente
        await db.entities.Paciente.update(pid, {
          alaId: targetAla.id,
          alaNome: targetAla.nome,
          leito: newLeito,
          observacoes: updatedObs
        });

        // 2. Atualiza todas as prescrições médicas ativas do paciente para refletir a nova Ala e Leito
        const pacPrescs = prescricoes.filter(pr => (pr.pacienteId === pid || pr.paciente_id === pid) && pr.status === "Ativa");
        for (const presc of pacPrescs) {
          await db.entities.PrescricaoPaciente.update(presc.id, {
            alaNome: targetAla.nome,
            leito: newLeito
          });
        }
      }

      return { count: patientIds.length, targetAlaNome: targetAla.nome };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['pacientes'] });
      queryClient.invalidateQueries({ queryKey: ['prescricoes_paciente'] });
      toast.success(`${res.count} paciente(s) transferido(s) com sucesso para a ${res.targetAlaNome}!`);
      setTransferModalOpen(false);
      setSelectedPatientIds([]);
      setTransferSelectedPatientIds([]);
      if (viewPatientDetails) {
        setViewPatientDetails(prev => {
          if (!prev) return null;
          const targetAla = alas.find(a => a.id === transferTargetAlaId);
          return {
            ...prev,
            alaId: targetAla?.id || prev.alaId,
            alaNome: targetAla?.nome || prev.alaNome,
            leito: transferSingleLeito || prev.leito
          };
        });
      }
    },
    onError: (err) => {
      toast.error("Erro na transferência: " + (err?.message || (typeof err === "string" ? err : "Erro desconhecido")));
    }
  });

  // Validação em tempo real do prontuário digitado (detecção de duplicidade ativa e histórico de alta)
  const prontuarioCheck = useMemo(() => {
    const raw = (patientFormData.prontuario || "").trim().toLowerCase();
    if (!raw) return { active: null, alta: null };

    const active = pacientes.find(p => 
      (p.prontuario || "").trim().toLowerCase() === raw &&
      p.status !== "Alta" &&
      (!editingPatient || p.id !== editingPatient.id)
    );

    const alta = pacientes.find(p => 
      (p.prontuario || "").trim().toLowerCase() === raw &&
      p.status === "Alta" &&
      (!editingPatient || p.id !== editingPatient.id)
    );

    return { active, alta };
  }, [patientFormData.prontuario, pacientes, editingPatient]);

  // Restaurar / Reinternar paciente a partir do histórico de altas
  const handleRestaurarPacienteAlta = (pac) => {
    setEditingPatient(pac);
    setIsReinternando(true);
    setPatientFormData({
      foto: pac.foto || "",
      nome: pac.nome || "",
      prontuario: pac.prontuario || "",
      idade: pac.idade || "",
      alaId: pac.alaId || (alas[0]?.id || ""),
      alaNome: pac.alaNome || (alas[0]?.nome || ""),
      leito: "", // Deixa vazio para definir o novo leito nesta internação
      status: "Ativo",
      observacoes: pac.observacoes ? `${pac.observacoes} (Reinternação)` : "Reinternação hospitalar"
    });
    toast.info(`Dados de ${pac.nome} recuperados do histórico de alta. Defina a ala/leito e salve para confirmar.`);
  };

  // Handlers Modal Paciente
  const handleOpenNewPatient = () => {
    setEditingPatient(null);
    setIsReinternando(false);
    setPatientFormData({
      foto: "",
      nome: "",
      prontuario: `PRONT-${Date.now().toString().slice(-4)}`,
      idade: "",
      alaId: "",
      alaNome: "",
      leito: "",
      status: "Ativo",
      observacoes: ""
    });
    setPatientModalOpen(true);
  };

  const handleOpenEditPatient = (p) => {
    setEditingPatient(p);
    setIsReinternando(false);
    setPatientFormData({
      foto: p.foto || "",
      nome: p.nome || "",
      prontuario: p.prontuario || "",
      idade: p.idade || "",
      alaId: p.alaId || "",
      alaNome: p.alaNome || "",
      leito: p.leito || "",
      status: p.status || "Ativo",
      observacoes: p.observacoes || ""
    });
    setPatientModalOpen(true);
  };

  const handleAlaChange = (alaId) => {
    const selectedAla = alas.find(a => a.id === alaId);
    setPatientFormData(prev => ({
      ...prev,
      alaId,
      alaNome: selectedAla ? selectedAla.nome : ""
    }));
  };

  const handleOpenTransferModal = (patientIds = []) => {
    setTransferTargetAlaId("");
    setTransferMotivo("");

    if (patientIds.length === 1) {
      const pac = pacientes.find(p => p.id === patientIds[0]);
      setTransferSelectedPatientIds(patientIds);
      setTransferOriginAlaId(pac?.alaId || "all");
      setTransferSingleLeito(pac?.leito || "");
      setTransferLeitoStrategy("define");
    } else if (patientIds.length > 1) {
      setTransferSelectedPatientIds(patientIds);
      const firstPac = pacientes.find(p => p.id === patientIds[0]);
      const sameAla = patientIds.every(id => pacientes.find(p => p.id === id)?.alaId === firstPac?.alaId);
      setTransferOriginAlaId(sameAla ? (firstPac?.alaId || "all") : "all");
      setTransferSingleLeito("");
      setTransferLeitoStrategy("keep");
    } else {
      const initialAla = filterAla !== "all" ? filterAla : (alas[0]?.id || "all");
      setTransferOriginAlaId(initialAla);
      const pacsInAla = initialAla !== "all"
        ? activePatients.filter(p => p.alaId === initialAla || p.alaNome === alas.find(a => a.id === initialAla)?.nome).map(p => p.id)
        : [];
      setTransferSelectedPatientIds(pacsInAla);
      setTransferSingleLeito("");
      setTransferLeitoStrategy("keep");
    }
    setTransferModalOpen(true);
  };

  const handleOriginAlaChange = (alaId) => {
    setTransferOriginAlaId(alaId);
    if (alaId === "all") {
      setTransferSelectedPatientIds(activePatients.map(p => p.id));
    } else {
      const alaObj = alas.find(a => a.id === alaId);
      const pacs = activePatients.filter(p => p.alaId === alaId || p.alaNome === alaObj?.nome).map(p => p.id);
      setTransferSelectedPatientIds(pacs);
    }
  };

  // Handlers Modal Prescrição
  const handleOpenNewPresc = (pacienteIdTarget = "") => {
    const rawTarget = pacienteIdTarget || (viewPatientDetails ? viewPatientDetails.id : "");
    const targetId = (typeof rawTarget === "object" && rawTarget !== null)
      ? String(rawTarget.id || "")
      : String(rawTarget || "");

    setEditingPresc(null);
    setPrescFormData({
      pacienteId: targetId,
      isPatientLocked: Boolean(targetId),
      medicamentoId: "",
      isLiquido: false,
      unidadeDose: "comp",
      volumeFrascoMl: "",
      duracaoFrascoDias: "",
      dose08: "0",
      dose14: "0",
      dose22: "0",
      dose06: "0",
      isMetade08: false,
      isMetade14: false,
      isMetade22: false,
      isMetade06: false,
      esquemaPosologico: "0-0-0-0",
      horarioInicio: "08:00",
      dataInicio: format(new Date(), "yyyy-MM-dd"),
      dataFim: "",
      diasTratamento: "",
      status: "Ativa",
      observacoes: "",
      motivoAlteracao: "",
      gerarHistorico: false,
      diasSemana: [0, 1, 2, 3, 4, 5, 6],
      tipoFrequencia: "diaria",
      intervaloDias: "10"
    });
    setPrescModalOpen(true);
  };

  const handleOpenEditPresc = (p) => {
    setEditingPresc(p);
    const d08 = getDoseForHora(p.horarios, "08:00");
    const d14 = getDoseForHora(p.horarios, "14:00");
    const d22 = getDoseForHora(p.horarios, "22:00");
    const d06 = getDoseForHora(p.horarios, "06:00");
    const inicio = p.dataInicio || format(new Date(), "yyyy-MM-dd");
    const fim = p.dataFim || "";
    const horaIni = p.horarioInicio || "08:00";
    const dias = (inicio && fim) ? calcularDiasEntre(inicio, fim, horaIni) : "";

    const rawPid = p.pacienteId || p.paciente_id || p.pacienteid || (viewPatientDetails ? viewPatientDetails.id : "");
    const targetId = (typeof rawPid === "object" && rawPid !== null) ? String(rawPid.id || "") : String(rawPid || "");

    setPrescFormData({
      pacienteId: targetId,
      isPatientLocked: true,
      medicamentoId: p.medicamentoId || p.medicamento_id || "",
      isLiquido: Boolean(p.is_liquido),
      unidadeDose: p.unidade_dose || (p.is_liquido ? "ml" : "comp"),
      volumeFrascoMl: p.volume_frasco_ml || "",
      duracaoFrascoDias: p.duracao_frasco_dias || "",
      dose08: String(d08 || 0),
      isMetade08: false,
      dose14: String(d14 || 0),
      isMetade14: false,
      dose22: String(d22 || 0),
      isMetade22: false,
      dose06: String(d06 || 0),
      isMetade06: false,
      esquemaPosologico: p.esquemaPosologico || `${d08 || 0}-${d14 || 0}-${d22 || 0}-${d06 || 0}`,
      horarioInicio: horaIni,
      dataInicio: inicio,
      dataFim: fim,
      diasTratamento: dias ? String(dias) : "",
      status: p.status || "Ativa",
      observacoes: p.observacoes || "",
      motivoAlteracao: "",
      gerarHistorico: true,
      diasSemana: parseDiasSemana(p.diasSemana),
      tipoFrequencia: p.tipoFrequencia || p.tipo_frequencia || "diaria",
      intervaloDias: String(p.intervaloDias || p.intervalo_dias || 10)
    });
    setPrescModalOpen(true);
  };

  const handleEsquemaPosologicoStringChange = (val) => {
    setPrescFormData(prev => {
      const parts = val.split("-");
      if (parts.length === 4) {
        return {
          ...prev,
          esquemaPosologico: val,
          dose08: parts[0].trim() || "0",
          dose14: parts[1].trim() || "0",
          dose22: parts[2].trim() || "0",
          dose06: parts[3].trim() || "0",
        };
      }
      return { ...prev, esquemaPosologico: val };
    });
  };

  const toggleDiaSemana = (diaId) => {
    setPrescFormData(prev => {
      const current = parseDiasSemana(prev.diasSemana);
      let updated;
      if (current.includes(diaId)) {
        if (current.length === 1) {
          toast.warning("A medicação precisa ter ao menos 1 dia da semana selecionado.");
          return prev;
        }
        updated = current.filter(d => d !== diaId);
      } else {
        updated = [...current, diaId];
      }
      return { ...prev, diasSemana: updated };
    });
  };

  // Previsão de 7 Dias / Cálculo Consolidado (Exclui Pacientes em ALTA e Prescrições Expiradas)
  const calculoPrevisao = useMemo(() => {
    const hojeStr = format(new Date(), "yyyy-MM-dd");
    const ativas = prescricoes.filter(p => {
      if (!isPrescricaoAtiva(p, hojeStr)) return false;
      const pac = pacientes.find(patient => patient.id === p.pacienteId);
      return pac && pac.status !== "Alta";
    });
    
    // Group by Medication
    const medMap = {};
    // Group by Patient
    const patientMap = {};

    ativas.forEach(p => {
      const patient = pacientes.find(pac => pac.id === p.pacienteId) || {
        nome: p.pacienteNome || "Paciente",
        prontuario: p.prontuario || "-",
        alaNome: p.alaNome || "-",
        leito: p.leito || "-"
      };

      const med = medicamentos.find(m => m.id === p.medicamentoId) || {
        nome: p.medicamentoNome || "Medicamento",
        codigo: p.medicamentoCodigo || "-",
        apresentacao: p.apresentacao || "-",
        concentracao: p.concentracao || "-",
        estoque_atual: 0
      };

      const dailyDose = p.totalDiario || 0;
      const periodDose = calculatePrescQtdParaDias(p, periodoDias);

      // Group Meds
      if (!medMap[p.medicamentoId]) {
        medMap[p.medicamentoId] = {
          medicamentoId: p.medicamentoId,
          nome: med.nome,
          codigo: med.codigo,
          apresentacao: med.apresentacao,
          concentracao: med.concentracao,
          estoqueAtual: Number(med.estoque_satelite) || 0,
          qtdDiaria: 0,
          qtdPeriodo: 0,
          pacientesSet: new Set()
        };
      }
      medMap[p.medicamentoId].qtdDiaria += dailyDose;
      medMap[p.medicamentoId].qtdPeriodo += periodDose;
      medMap[p.medicamentoId].pacientesSet.add(patient.nome);

      // Group Patients
      if (!patientMap[p.pacienteId]) {
        patientMap[p.pacienteId] = {
          pacienteId: p.pacienteId,
          nome: patient.nome,
          prontuario: patient.prontuario,
          alaNome: patient.alaNome,
          leito: patient.leito,
          prescricoes: []
        };
      }
      patientMap[p.pacienteId].prescricoes.push({
        ...p,
        medNome: med.nome,
        medCodigo: med.codigo,
        medConcentracao: med.concentracao,
        medApresentacao: med.apresentacao,
        qtdPeriodo: periodDose
      });
    });

    const consolidadoMeds = Object.values(medMap).map(item => ({
      ...item,
      totalPacientes: item.pacientesSet ? item.pacientesSet.size : 0,
      suficiente: (item.estoqueAtual || 0) >= (item.qtdPeriodo || 0),
      diferenca: (item.qtdPeriodo || 0) - (item.estoqueAtual || 0)
    })).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    const consolidadoPacientes = Object.values(patientMap).sort((a, b) => a.nome.localeCompare(b.nome));

    return {
      consolidadoMeds,
      consolidadoPacientes,
      totalPrescricoesAtivas: ativas.length,
      totalPacientesComMedicao: Object.keys(patientMap).length
    };
  }, [prescricoes, pacientes, medicamentos, periodoDias]);

  // Listas separadas de Ativos e Altas
  const activePatients = useMemo(() => {
    return (pacientes || []).filter(p => p.status !== "Alta");
  }, [pacientes]);

  const dischargedPatients = useMemo(() => {
    return (pacientes || []).filter(p => p.status === "Alta");
  }, [pacientes]);

  // Previsão e Consolidação para Impressão com Filtro de Checklist (por Ala e por Paciente)
  const calculoImpressao = useMemo(() => {
    const hojeStr = format(new Date(), "yyyy-MM-dd");
    const ativas = prescricoes.filter(p => {
      if (!isPrescricaoAtiva(p, hojeStr)) return false;
      const pac = pacientes.find(patient => patient.id === p.pacienteId);
      if (!pac || pac.status === "Alta") return false;

      // 1. Filtro de paciente por checklist: se printSelectedPatientIds tiver seleção, deve estar contido
      if (printSelectedPatientIds.length > 0) {
        if (!printSelectedPatientIds.includes(p.pacienteId)) return false;
      } else if (!printSelectedAlas.includes("all") && printSelectedAlas.length > 0) {
        // Se nenhum paciente selecionado individualmente, filtra pelas alas marcadas
        const pacAlaId = pac.alaId || pac.ala_id || "";
        const pacAlaNome = (pac.alaNome || pac.ala_nome || "").trim().toLowerCase();
        const matchAla = printSelectedAlas.some(aid => {
          const alaObj = alas.find(a => String(a.id) === String(aid));
          const alaNome = alaObj?.nome?.trim().toLowerCase();
          return (pacAlaId && pacAlaId === String(aid)) || (alaNome && pacAlaNome === alaNome);
        });
        if (!matchAla) return false;
      }
      return true;
    });

    const medMap = {};
    const patientMap = {};

    ativas.forEach(p => {
      const patient = pacientes.find(pac => pac.id === p.pacienteId) || {
        nome: p.pacienteNome || "Paciente",
        prontuario: p.prontuario || "-",
        alaNome: p.alaNome || "-",
        leito: p.leito || "-"
      };

      const med = medicamentos.find(m => m.id === p.medicamentoId) || {
        nome: p.medicamentoNome || "Medicamento",
        codigo: p.medicamentoCodigo || "-",
        apresentacao: p.apresentacao || "-",
        concentracao: p.concentracao || "-",
        estoque_atual: 0
      };

      const dailyDose = p.totalDiario || 0;
      const periodDose = calculatePrescQtdParaDias(p, printPeriodoDias);

      if (!medMap[p.medicamentoId]) {
        medMap[p.medicamentoId] = {
          medicamentoId: p.medicamentoId,
          nome: med.nome,
          codigo: med.codigo,
          apresentacao: med.apresentacao,
          concentracao: med.concentracao,
          estoqueAtual: Number(med.estoque_satelite) || 0,
          qtdDiaria: 0,
          qtdPeriodo: 0,
          pacientesSet: new Set()
        };
      }
      medMap[p.medicamentoId].qtdDiaria += dailyDose;
      medMap[p.medicamentoId].qtdPeriodo += periodDose;
      medMap[p.medicamentoId].pacientesSet.add(patient.nome);

      if (!patientMap[p.pacienteId]) {
        patientMap[p.pacienteId] = {
          pacienteId: p.pacienteId,
          nome: patient.nome,
          prontuario: patient.prontuario,
          alaNome: patient.alaNome,
          leito: patient.leito,
          prescricoes: []
        };
      }
      patientMap[p.pacienteId].prescricoes.push({
        ...p,
        medNome: med.nome,
        medCodigo: med.codigo,
        medConcentracao: med.concentracao,
        medApresentacao: med.apresentacao,
        qtdPeriodo: periodDose
      });
    });

    const consolidadoMeds = Object.values(medMap).map(item => ({
      ...item,
      totalPacientes: item.pacientesSet ? item.pacientesSet.size : 0,
      suficiente: (item.estoqueAtual || 0) >= (item.qtdPeriodo || 0),
      diferenca: (item.qtdPeriodo || 0) - (item.estoqueAtual || 0)
    })).sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

    const consolidadoPacientes = Object.values(patientMap).sort((a, b) => a.nome.localeCompare(b.nome));

    return {
      consolidadoMeds,
      consolidadoPacientes,
      totalPrescricoesAtivas: ativas.length,
      totalPacientesComMedicao: Object.keys(patientMap).length
    };
  }, [prescricoes, pacientes, medicamentos, printPeriodoDias, printSelectedPatientIds, printSelectedAlas, alas]);

  // Handler para abertura do modal de impressão com pré-seleção flexível
  const handleOpenPrintPrescModal = (targetPatientIds = null) => {
    const hojeStr = format(new Date(), "yyyy-MM-dd");
    if (targetPatientIds && Array.isArray(targetPatientIds) && targetPatientIds.length > 0) {
      setPrintSelectedPatientIds(targetPatientIds);
      const relevantAlas = activePatients
        .filter(p => targetPatientIds.includes(p.id) && p.alaId)
        .map(p => String(p.alaId));
      setPrintSelectedAlas(relevantAlas.length > 0 ? Array.from(new Set(relevantAlas)) : ["all"]);
    } else if (selectedPatientIds.length > 0) {
      setPrintSelectedPatientIds([...selectedPatientIds]);
      setPrintSelectedAlas(["all"]);
    } else {
      const pacsComMed = activePatients
        .filter(p => prescricoes.some(pr => pr.pacienteId === p.id && isPrescricaoAtiva(pr, hojeStr)))
        .map(p => p.id);
      setPrintSelectedPatientIds(pacsComMed.length > 0 ? pacsComMed : activePatients.map(p => p.id));
      setPrintSelectedAlas(["all"]);
    }
    setPrintSearchPatient("");
    setPrintIncludeConsolidado(false);
    setPrintIncludeKits(true);
    setPrintPrescModalOpen(true);
  };

  // Pacientes candidatos exibidos no checklist do modal de impressão
  const displayedPrintCandidates = useMemo(() => {
    let list = activePatients;
    if (!printSelectedAlas.includes("all") && printSelectedAlas.length > 0) {
      list = list.filter(p => {
        const pAlaId = String(p.alaId || p.ala_id || "");
        return printSelectedAlas.includes(pAlaId) || printSelectedAlas.some(aid => {
          const alaObj = alas.find(a => String(a.id) === String(aid));
          return alaObj && alaObj.nome === p.alaNome;
        });
      });
    }
    if (printSearchPatient.trim()) {
      const term = printSearchPatient.trim().toLowerCase();
      list = list.filter(p => 
        (p.nome || "").toLowerCase().includes(term) ||
        (p.prontuario || "").toLowerCase().includes(term) ||
        (p.leito || "").toLowerCase().includes(term) ||
        (p.alaNome || "").toLowerCase().includes(term)
      );
    }
    return list;
  }, [activePatients, printSelectedAlas, printSearchPatient, alas]);

  const handleExecutePrint = () => {
    window.print();
  };

  // Contagens e KPIs de Pacientes
  const patientCounts = useMemo(() => {
    const ativos = (pacientes || []).filter(p => p.status !== "Alta");
    const altas = (pacientes || []).filter(p => p.status === "Alta");
    const hojeStr = format(new Date(), "yyyy-MM-dd");

    const comPrescricao = ativos.filter(p => 
      (prescricoes || []).some(pr => isPrescricaoDoPaciente(pr, p) && isPrescricaoAtiva(pr, hojeStr))
    ).length;
    const semPrescricao = ativos.length - comPrescricao;

    const activePrescList = (prescricoes || []).filter(pr => isPrescricaoAtiva(pr, hojeStr));
    const totalPrescricoes = activePrescList.length;
    const totalDosesDiarias = activePrescList.reduce((acc, pr) => acc + (parseFloat(pr.totalDiario) || 0), 0);

    const alasSet = new Set(ativos.map(p => p.alaNome || p.alaId).filter(Boolean));

    return {
      todos: ativos.length,
      comPrescricao,
      semPrescricao,
      altas: altas.length,
      totalPrescricoes,
      totalDosesDiarias: Math.round(totalDosesDiarias),
      alasDistintas: alasSet.size
    };
  }, [pacientes, prescricoes]);

  // Lista de pacientes exibidos baseada na categoria ativa, busca e filtro de ala
  const displayedPatients = useMemo(() => {
    const search = (searchPatient || "").trim().toLowerCase();
    const hojeStr = format(new Date(), "yyyy-MM-dd");

    const checkMatchAla = (p) => {
      if (filterAlas.includes("all") || filterAlas.length === 0) return true;
      return filterAlas.some((aId) => {
        const alaObj = alas.find((a) => String(a.id) === String(aId));
        const pAlaIdStr = String(p.alaId || p.ala_id || "");
        return (
          pAlaIdStr === String(aId) ||
          p.alaNome === aId ||
          (alaObj && p.alaNome === alaObj.nome)
        );
      });
    };

    if (activeCategory === "altas") {
      return (pacientes || []).filter(p => {
        if (p.status !== "Alta") return false;
        const qP = normalizeSearch(search);
        const termsP = qP ? qP.split(/\s+/).filter(Boolean) : [];
        const fullP = normalizeSearch(`${p.nome || ""} ${p.prontuario || ""} ${p.leito || ""} ${p.alaNome || ""}`);
        const matchSearch = termsP.length === 0 || termsP.every(t => fullP.includes(t));
        const matchAla = checkMatchAla(p);
        return matchSearch && matchAla;
      });
    }

    return (pacientes || []).filter(p => {
      if (p.status === "Alta") return false;

      const matchSearch = !search ||
        (p.nome?.toLowerCase().includes(search)) ||
        (p.prontuario?.toLowerCase().includes(search)) ||
        (p.leito?.toLowerCase().includes(search)) ||
        (p.alaNome?.toLowerCase().includes(search));

      const matchAla = checkMatchAla(p);
      if (!matchSearch || !matchAla) return false;

      const hasActive = (prescricoes || []).some(pr => isPrescricaoDoPaciente(pr, p) && isPrescricaoAtiva(pr, hojeStr));

      if (activeCategory === "com_prescricao") {
        return hasActive;
      }
      if (activeCategory === "sem_prescricao") {
        return !hasActive;
      }
      return true; // "todos"
    });
  }, [pacientes, prescricoes, activeCategory, searchPatient, filterAlas, alas]);

  const filteredPatients = displayedPatients;

  const candidatesForTransfer = useMemo(() => {
    if (transferOriginAlaId === "all") {
      return activePatients;
    }
    const alaObj = alas.find(a => a.id === transferOriginAlaId);
    return activePatients.filter(p => p.alaId === transferOriginAlaId || p.alaNome === alaObj?.nome);
  }, [activePatients, transferOriginAlaId, alas]);

  const availableTargetAlas = useMemo(() => {
    return alas.filter(a => a.id !== transferOriginAlaId);
  }, [alas, transferOriginAlaId]);

  const filteredPrescriptions = prescricoes.filter(p =>
    (() => {
      const q = normalizeSearch(searchPrescription);
      if (!q) return true;
      const terms = q.split(/\s+/).filter(Boolean);
      const full = normalizeSearch(`${p.pacienteNome || ""} ${p.medicamentoNome || ""} ${p.concentracao || ""} ${p.prontuario || ""} ${p.esquemaPosologico || ""}`);
      return terms.every(t => full.includes(t));
    })()
  );

  const currentViewPatient = useMemo(() => {
    if (!viewPatientDetails) return null;
    return pacientes.find(p => p.id === viewPatientDetails.id) || viewPatientDetails;
  }, [pacientes, viewPatientDetails]);

  const selectedPrescPatient = useMemo(() => {
    const rawPid = prescFormData.pacienteId || currentViewPatient?.id || editingPresc?.pacienteId || editingPresc?.paciente_id;
    const pId = (typeof rawPid === "object" && rawPid !== null) ? String(rawPid.id || "") : String(rawPid || "");
    return pacientes.find(p => String(p.id) === pId) || currentViewPatient || null;
  }, [pacientes, prescFormData.pacienteId, currentViewPatient, editingPresc]);

  const patientVisitas = useMemo(() => {
    if (!currentViewPatient?.id) return [];
    const pId = String(currentViewPatient.id);
    const pront = String(currentViewPatient.prontuario || "").trim();
    return (todasVisitas || []).filter(v => 
      String(v.pacienteId) === pId || 
      (pront && String(v.prontuario || "").trim() === pront)
    );
  }, [todasVisitas, currentViewPatient]);

  const isPatientLocked = Boolean(prescFormData.isPatientLocked || viewPatientDetails || editingPresc);

  return (
    <div className="p-6 space-y-4 min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Pacientes & Prescrições
          </h1>
          <p className="text-slate-500 text-xs font-medium mt-0.5">
            Gestão de pacientes internados, leitos e prescrições médicas fixas
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button 
            onClick={() => navigate('/SateliteAdiantamento')} 
            variant="outline" 
            className="h-9 text-xs font-semibold border-amber-200 bg-amber-50/80 hover:bg-amber-100 text-amber-900 shadow-xs gap-1.5"
          >
            <CreditCard className="w-3.5 h-3.5 text-amber-600" />
            Relatório Adiantamento
          </Button>

          <Button 
            onClick={() => handleOpenTransferModal()} 
            variant="outline" 
            className="h-9 text-xs font-semibold border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-900 shadow-xs gap-1.5"
            title="Transferir pacientes da Ala X para Ala Y"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600" />
            Transferir Ala
          </Button>

          <Button 
            onClick={() => handleOpenPrintPrescModal()} 
            variant="outline" 
            className="h-9 text-xs font-semibold border-slate-300 bg-white hover:bg-slate-50 text-slate-800 shadow-xs gap-1.5"
            title="Imprimir relatório de prescrições e aprazamento dos pacientes com checklist por ala"
          >
            <Printer className="w-3.5 h-3.5 text-blue-600" />
            Imprimir Prescrições
          </Button>

          <Button 
            onClick={() => handleOpenNewPatient()} 
            variant="outline" 
            className="h-9 text-xs font-semibold border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs gap-1.5"
          >
            <Users className="w-3.5 h-3.5 text-blue-600" />
            Novo Paciente
          </Button>

          <Button 
            onClick={() => handleOpenNewPresc()} 
            className="h-9 text-xs font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/20 gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Nova Prescrição Fixa
          </Button>
        </div>
      </div>

      {/* KPI Stats Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Pacientes Ativos */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pacientes Ativos</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-extrabold text-blue-600 dark:text-blue-400">{patientCounts.todos}</span>
              <span className="text-[10px] text-slate-400 font-medium">({patientCounts.alasDistintas} alas / setores)</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600">
            <Users className="w-4 h-4" />
          </div>
        </div>

        {/* Card 2: Em Tratamento */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Com Medicação Ativa</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">{patientCounts.comPrescricao}</span>
              <span className="text-[10px] text-slate-400 font-medium">em tratamento</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600">
            <Pill className="w-4 h-4" />
          </div>
        </div>

        {/* Card 3: Prescrições Fixas */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Prescrições Fixas</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400">{patientCounts.totalPrescricoes}</span>
              <span className="text-[10px] text-slate-400 font-medium">({patientCounts.totalDosesDiarias} doses/dia)</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600">
            <CalendarCheck className="w-4 h-4" />
          </div>
        </div>

        {/* Card 4: Histórico de Altas */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Histórico de Altas</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-extrabold text-amber-600 dark:text-amber-400">{patientCounts.altas}</span>
              <span className="text-[10px] text-slate-400 font-medium">desospitalizações</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600">
            <LogOut className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveCategory("todos")}
            className={cn(
              "h-8 rounded-lg text-xs font-bold gap-2 transition-all",
              activeCategory === "todos" 
                ? "bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-xs ring-1 ring-slate-200/80" 
                : "text-slate-600 dark:text-slate-400 hover:bg-white/50"
            )}
          >
            <Users className="w-3.5 h-3.5 text-blue-600" />
            Todos os Pacientes Ativos
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
              activeCategory === "todos" ? "bg-blue-100 text-blue-800" : "bg-slate-200 text-slate-600"
            )}>
              {patientCounts.todos}
            </span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveCategory("com_prescricao")}
            className={cn(
              "h-8 rounded-lg text-xs font-bold gap-2 transition-all",
              activeCategory === "com_prescricao" 
                ? "bg-emerald-600 text-white shadow-xs" 
                : "text-slate-600 dark:text-slate-400 hover:bg-white/50"
            )}
          >
            <Pill className="w-3.5 h-3.5 text-emerald-300" />
            Com Medicação Ativa
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
              activeCategory === "com_prescricao" ? "bg-emerald-700 text-emerald-100" : "bg-slate-200 text-slate-600"
            )}>
              {patientCounts.comPrescricao}
            </span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveCategory("sem_prescricao")}
            className={cn(
              "h-8 rounded-lg text-xs font-bold gap-2 transition-all",
              activeCategory === "sem_prescricao" 
                ? "bg-indigo-600 text-white shadow-xs" 
                : "text-slate-600 dark:text-slate-400 hover:bg-white/50"
            )}
          >
            <User className="w-3.5 h-3.5 text-indigo-300" />
            Sem Medicação
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
              activeCategory === "sem_prescricao" ? "bg-indigo-700 text-indigo-100" : "bg-slate-200 text-slate-600"
            )}>
              {patientCounts.semPrescricao}
            </span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveCategory("altas")}
            className={cn(
              "h-8 rounded-lg text-xs font-bold gap-2 transition-all",
              activeCategory === "altas" 
                ? "bg-amber-600 text-white shadow-xs" 
                : "text-slate-600 dark:text-slate-400 hover:bg-white/50"
            )}
          >
            <LogOut className="w-3.5 h-3.5 text-amber-300" />
            Pacientes de Alta
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
              activeCategory === "altas" ? "bg-amber-700 text-amber-100" : "bg-slate-200 text-slate-600"
            )}>
              {patientCounts.altas}
            </span>
          </Button>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Exibindo <strong>{displayedPatients.length}</strong> paciente(s)
        </div>
      </div>

      {/* Search and Ala Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder={activeCategory === "altas" 
                ? "Buscar paciente de alta por nome, prontuário, setor ou leito..." 
                : "Buscar paciente por nome, prontuário, ala ou leito..."}
              value={searchPatient}
              onChange={(e) => setSearchPatient(e.target.value)}
              className="pl-10 pr-9 h-9.5 bg-slate-50/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:bg-white transition-all"
            />
            {searchPatient && (
              <button
                onClick={() => setSearchPatient("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 rounded-full"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            {/* Popover Multi-Alas */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "h-9.5 px-3 text-xs justify-between gap-2 rounded-lg font-medium border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 w-full sm:w-auto min-w-[200px] max-w-[320px]",
                    !filterAlas.includes("all") && "border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-semibold"
                  )}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Building2 className={cn("w-3.5 h-3.5 shrink-0", !filterAlas.includes("all") ? "text-blue-600" : "text-slate-400")} />
                    <span className="truncate">
                      {filterAlas.includes("all") || filterAlas.length === 0
                        ? "Todas as Alas / Setores"
                        : filterAlas.length === 1
                        ? (alas.find(a => String(a.id) === String(filterAlas[0]))?.nome || "1 ala selecionada")
                        : `${filterAlas.length} alas selecionadas`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 ml-auto">
                    {!filterAlas.includes("all") && filterAlas.length > 0 && (
                      <Badge className="h-5 px-1.5 text-[10px] bg-blue-600 text-white font-bold rounded-full">
                        {filterAlas.length}
                      </Badge>
                    )}
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-3 space-y-2.5 z-[10001] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl rounded-xl">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-600" />
                    Filtrar por Ala
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setFilterAlas(["all"])}
                      className="text-blue-600 font-bold hover:underline"
                    >
                      Todas
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setFilterAlas([])}
                      className="text-slate-500 hover:underline"
                    >
                      Limpar
                    </button>
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                  {/* Opção Todas as Alas */}
                  <button
                    type="button"
                    onClick={() => setFilterAlas(["all"])}
                    className={cn(
                      "w-full flex items-center justify-between p-2 rounded-lg text-xs transition-colors text-left",
                      filterAlas.includes("all")
                        ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold"
                        : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                        filterAlas.includes("all")
                          ? "bg-blue-600 border-blue-600 text-white"
                          : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                      )}>
                        {filterAlas.includes("all") && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span>Todas as Alas / Setores</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-mono font-bold bg-white dark:bg-slate-800 text-slate-600">
                      {pacientes.filter(p => p.status !== "Alta").length}
                    </Badge>
                  </button>

                  <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                  {/* Cada Ala Individual */}
                  {alas.map(a => {
                    const aIdStr = String(a.id);
                    const isChecked = !filterAlas.includes("all") && filterAlas.includes(aIdStr);
                    const pacsCount = pacientes.filter(p => p.status !== "Alta" && (String(p.alaId || p.ala_id) === aIdStr || p.alaNome === a.nome)).length;

                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggleAlaFilter(aIdStr)}
                        className={cn(
                          "w-full flex items-center justify-between p-2 rounded-lg text-xs transition-colors text-left",
                          isChecked
                            ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold"
                            : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
                        )}
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <div className={cn(
                            "w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0",
                            isChecked
                              ? "bg-blue-600 border-blue-600 text-white"
                              : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                          )}>
                            {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span className="truncate">{a.nome}</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] font-mono font-bold bg-white dark:bg-slate-800 text-slate-600 shrink-0">
                          {pacsCount}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>

            {(searchPatient || !filterAlas.includes("all")) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setSearchPatient(""); setFilterAlas(["all"]); }}
                className="h-9.5 px-2.5 text-xs text-slate-500 hover:text-slate-800 font-medium"
                title="Limpar filtros"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </div>

        {/* Badges das alas selecionadas para visualização rápida e remoção com 1 clique */}
        {!filterAlas.includes("all") && filterAlas.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-xs">
            <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
              <Filter className="w-3 h-3 text-blue-600" />
              Alas Selecionadas:
            </span>
            {filterAlas.map(aId => {
              const alaObj = alas.find(a => String(a.id) === String(aId));
              const nome = alaObj ? alaObj.nome : aId;
              return (
                <Badge
                  key={aId}
                  className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 text-[11px] font-semibold flex items-center gap-1 pl-2 pr-1 py-0.5 shadow-2xs"
                >
                  <span>{nome}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAlaFilter(aId);
                    }}
                    className="hover:bg-blue-200/80 dark:hover:bg-blue-800 p-0.5 rounded-full transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              );
            })}
            <button
              type="button"
              onClick={() => setFilterAlas(["all"])}
              className="text-[11px] text-slate-400 hover:text-red-600 hover:underline font-medium ml-1 cursor-pointer"
            >
              Resetar para todas
            </button>
          </div>
        )}
      </div>

      {/* Batch Action Banner */}
      {activeCategory !== "altas" && selectedPatientIds.length > 0 && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <p className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                {selectedPatientIds.length} paciente(s) selecionado(s)
              </p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                Execute ações em lote para todos os pacientes selecionados.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              onClick={() => setSelectedPatientIds([])}
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-slate-600 hover:text-slate-900"
            >
              Limpar Seleção
            </Button>

            <Button
              onClick={() => handleOpenTransferModal(selectedPatientIds)}
              variant="outline"
              size="sm"
              className="h-8 text-xs border-indigo-200 bg-indigo-50/80 text-indigo-900 hover:bg-indigo-100 font-bold gap-1.5 shadow-xs"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-600" />
              Transferir de Ala ({selectedPatientIds.length})
            </Button>

            <Button
              onClick={() => handleOpenPrintPrescModal(selectedPatientIds)}
              variant="outline"
              size="sm"
              className="h-8 text-xs border-blue-300 bg-blue-50/90 text-blue-900 hover:bg-blue-100 font-bold gap-1.5 shadow-xs"
              title="Imprimir relatório de prescrições dos pacientes selecionados"
            >
              <Printer className="w-3.5 h-3.5 text-blue-600" />
              Imprimir Prescrições ({selectedPatientIds.length})
            </Button>

            <Button
              onClick={() => setSeparacaoModalOpen(true)}
              size="sm"
              className="h-8 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5 shadow-xs"
              title="Iniciar separação das medicações com conferência, divisão de lotes e impressão"
            >
              <PackageMinus className="w-3.5 h-3.5" />
              Começar Separação ({selectedPatientIds.length})
            </Button>
          </div>
        </div>
      )}

      {/* Table Container */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          <Table>
            <TableHeader className="bg-slate-50/80 dark:bg-slate-800/80 sticky top-0 z-10 backdrop-blur-xs">
              {activeCategory !== "altas" ? (
                <TableRow>
                  <TableHead className="w-12 text-center">
                    <input
                      type="checkbox"
                      checked={displayedPatients.length > 0 && selectedPatientIds.length === displayedPatients.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPatientIds(displayedPatients.map(p => p.id));
                        } else {
                          setSelectedPatientIds([]);
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      title="Selecionar Todos os Pacientes Exibidos"
                    />
                  </TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300">Prontuário</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300">Nome do Paciente</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300">Ala / Leito</TableHead>
                  <TableHead className="text-center text-xs font-bold text-slate-700 dark:text-slate-300">Status</TableHead>
                  <TableHead className="text-center text-xs font-bold text-slate-700 dark:text-slate-300">Medicações Ativas</TableHead>
                  <TableHead className="text-right text-xs font-bold text-slate-700 dark:text-slate-300 pr-4">Ações</TableHead>
                </TableRow>
              ) : (
                <TableRow>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 pl-4">Prontuário</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300">Nome do Paciente</TableHead>
                  <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300">Setor / Leito Anterior</TableHead>
                  <TableHead className="text-center text-xs font-bold text-slate-700 dark:text-slate-300">Data da Alta</TableHead>
                  <TableHead className="text-center text-xs font-bold text-slate-700 dark:text-slate-300">Status</TableHead>
                  <TableHead className="text-right text-xs font-bold text-slate-700 dark:text-slate-300 pr-4">Ações</TableHead>
                </TableRow>
              )}
            </TableHeader>
            <TableBody>
              {loadingPacientes ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-6 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-16 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : displayedPatients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={activeCategory === "altas" ? 6 : 7} className="text-center py-16">
                    <div className="max-w-xs mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                        {activeCategory === "altas" ? (
                          <LogOut className="w-6 h-6 text-amber-500/70" />
                        ) : (
                          <Users className="w-6 h-6 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          {activeCategory === "altas" 
                            ? "Nenhum paciente em alta encontrado" 
                            : activeCategory === "com_prescricao"
                            ? "Nenhum paciente com medicação ativa"
                            : activeCategory === "sem_prescricao"
                            ? "Nenhum paciente sem medicação"
                            : "Nenhum paciente cadastrado"}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {searchPatient || !filterAlas.includes("all") 
                            ? "Tente ajustar os filtros ou termo de busca." 
                            : activeCategory === "altas"
                            ? "Altas hospitalares registradas aparecerão neste histórico."
                            : "Cadastre novos pacientes ou prescrições para iniciar."}
                        </p>
                      </div>
                      {activeCategory !== "altas" && !searchPatient && filterAlas.includes("all") && (
                        <Button onClick={handleOpenNewPatient} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs gap-1.5 shadow-xs">
                          <Plus className="w-3.5 h-3.5" />
                          Cadastrar Paciente
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : activeCategory !== "altas" ? (
                displayedPatients.map((p) => {
                  const activePrescsCount = prescricoes.filter(pr => isPrescricaoDoPaciente(pr, p) && isPrescricaoAtiva(pr)).length;
                  const isSelected = selectedPatientIds.includes(p.id);

                  return (
                    <TableRow 
                      key={p.id} 
                      className={cn(
                        "hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors",
                        isSelected && "bg-blue-50/50 dark:bg-blue-950/20"
                      )}
                    >
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPatientIds(prev => [...prev, p.id]);
                            } else {
                              setSelectedPatientIds(prev => prev.filter(id => id !== p.id));
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-slate-700">
                          {p.prontuario || "S/P"}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[280px] min-w-[170px] break-words whitespace-normal [overflow-wrap:anywhere] [word-break:break-word]">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                            {p.foto ? (
                              <img src={p.foto} alt={p.nome} className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1 break-words whitespace-normal [overflow-wrap:anywhere] [word-break:break-word]">
                            <button
                              onClick={() => setViewPatientDetails(p)}
                              className="text-left font-bold text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-start gap-1.5 group cursor-pointer break-words whitespace-normal [overflow-wrap:anywhere] [word-break:break-word] leading-snug"
                              title="Clique para ver o prontuário e prescrições completas"
                            >
                              <span className="break-words whitespace-normal [overflow-wrap:anywhere] [word-break:break-word]">{p.nome}</span>
                              <FileText className="w-3 h-3 opacity-70 group-hover:opacity-100 text-blue-500 shrink-0 mt-0.5" />
                            </button>
                            {p.observacoes && (
                              <p className="text-[11px] text-amber-600 dark:text-amber-400 break-words whitespace-normal [overflow-wrap:anywhere] mt-0.5">
                                Obs: {p.observacoes}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{p.alaNome || "Sem Ala"}</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">• {p.leito || "S/L"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-[10px] font-bold py-0.5",
                            p.status === "Ativo" 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800" 
                              : "bg-slate-100 text-slate-700 border-slate-200"
                          )}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 inline-block" />
                          {p.status || "Ativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge 
                          onClick={() => setViewPatientDetails(p)} 
                          variant="outline" 
                          className={cn(
                            "text-[10px] font-bold py-0.5 cursor-pointer transition-colors",
                            activePrescsCount > 0
                              ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-950/40 dark:border-blue-800"
                              : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
                          )}
                          title="Ver prescrições completas do paciente"
                        >
                          {activePrescsCount > 0 ? (
                            <Pill className="w-3 h-3 mr-1 text-blue-600 inline" />
                          ) : null}
                          {activePrescsCount} medicação(ões)
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => setViewPatientDetails(p)} 
                            className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50 hover:text-blue-700" 
                            title="Ver Prontuário & Prescrições"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => {
                              setAjusteCicloPatient(p);
                              setAjusteCicloModalOpen(true);
                            }}
                            className="h-8 w-8 p-0 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700" 
                            title="Ajuste de Dias de Entrega (Complemento de Ciclo)"
                          >
                            <Sparkles className="w-4 h-4 text-indigo-600" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleOpenTransferModal([p.id])} 
                            className="h-8 w-8 p-0 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700" 
                            title="Transferir de Ala"
                          >
                            <ArrowLeftRight className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleOpenNewPresc(p.id)} 
                            className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700" 
                            title="Adicionar Prescrição Fixa"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleOpenEditPatient(p)} 
                            className="h-8 w-8 p-0 text-amber-600 hover:bg-amber-50 hover:text-amber-700" 
                            title="Editar Paciente"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => {
                              if (window.confirm(`Tem certeza que deseja DAR ALTA para o paciente ${p.nome}? Todas as prescrições serão suspensas.`)) {
                                setAltaPacienteId(p.id);
                                setAltaModalOpen(true);
                              }
                            }} 
                            className="h-8 w-8 p-0 text-amber-600 hover:bg-amber-50 hover:text-amber-700" 
                            title="Dar Alta ao Paciente"
                          >
                            <LogOut className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => {
                              setDeleteTarget({ type: 'paciente', id: p.id, name: p.nome });
                              setDeleteReason("");
                              setDeleteLogModalOpen(true);
                            }} 
                            className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 hover:text-red-600" 
                            title="Excluir Paciente"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                displayedPatients.map((p) => (
                  <TableRow key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <TableCell className="pl-4">
                      <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-slate-700">
                        {p.prontuario || "S/P"}
                      </span>
                    </TableCell>
                    <TableCell className="font-bold text-xs text-slate-800 dark:text-slate-200">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0 overflow-hidden shadow-xs">
                          {p.foto ? (
                            <img src={p.foto} alt={p.nome} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <span>{p.nome}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>{p.alaNome || "Ala Geral"}</span>
                        <span className="font-bold text-slate-700">• Leito: {p.leito || "S/L"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center text-xs font-mono text-slate-600 dark:text-slate-400">
                      {p.dataAlta ? format(new Date(p.dataAlta), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "Alta Registrada"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[10px] font-bold py-0.5 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1 inline-block" />
                        Alta Hospitalar
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap pr-4">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setViewPatientDetails(p)}
                          className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-50"
                          title="Ver histórico de prontuário e medicações"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 font-bold gap-1 shadow-xs"
                          onClick={() => reativarPacienteMutation.mutate(p.id)}
                          title="Reativar internação do paciente"
                        >
                          <RefreshCw className="w-3 h-3 text-emerald-600" />
                          Reativar Internação
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ─── MODAL: EXCLUSÃO AUDITADA COM REGISTRO DE LOG ───────────────── */}
      <Dialog open={deleteLogModalOpen} onOpenChange={setDeleteLogModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Confirmar Exclusão Auditada
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-3 rounded-lg text-xs text-red-900 dark:text-red-300">
              <p className="font-bold">⚠️ Registro de Log Auditado em Sistema</p>
              <p className="mt-1">
                Ao excluir o item <strong>"{deleteTarget?.name}"</strong>, um <strong>LOG PERMANENTE</strong> será gravado com a data, hora e o motivo declarado abaixo.
              </p>
            </div>

            <div>
              <Label className="font-bold text-slate-800 dark:text-slate-200">
                Informe o Motivo da Exclusão *
              </Label>
              <Textarea
                placeholder="Descreva detalhadamente o motivo pelo qual este item está sendo excluído..."
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="mt-1.5 min-h-[90px]"
              />
            </div>
          </div>

          <DialogFooter className="flex justify-between items-center border-t border-slate-200 dark:border-slate-800 pt-3">
            <Button variant="outline" onClick={() => setDeleteLogModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white font-bold gap-2 shadow-sm"
              disabled={executeDeleteWithLogMutation.isPending || !deleteReason.trim()}
              onClick={() => {
                if (!deleteReason.trim()) {
                  toast.error("É obrigatório informar o motivo da exclusão para gerar o log.");
                  return;
                }
                executeDeleteWithLogMutation.mutate({
                  type: deleteTarget.type,
                  id: deleteTarget.id,
                  name: deleteTarget.name,
                  reason: deleteReason.trim()
                });
              }}
            >
              <Trash2 className="w-4 h-4" />
              {executeDeleteWithLogMutation.isPending ? "Excluindo..." : "Confirmar Exclusão e Salvar Log"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: PACIENTE ────────────────────────────────────────────────── */}
      <Dialog open={patientModalOpen} onOpenChange={setPatientModalOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isReinternando ? (
                <>
                  <RotateCcw className="w-5 h-5 text-amber-600" />
                  <span>Reinternar Paciente (Histórico de Alta)</span>
                </>
              ) : editingPatient ? (
                <>
                  <Pencil className="w-5 h-5 text-blue-600" />
                  <span>Editar Paciente</span>
                </>
              ) : (
                <>
                  <Users className="w-5 h-5 text-blue-600" />
                  <span>Novo Paciente</span>
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {isReinternando 
                ? "Este paciente esteve internado anteriormente. Atualize os dados, selecione o novo setor/leito e confirme a reinternação."
                : "Cadastre as informações clínicas e de localização do paciente internado."
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Alerta de Reinternação em Andamento */}
            {isReinternando && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 p-2.5 rounded-lg text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="text-amber-900 dark:text-amber-200 font-semibold">
                    Reativando histórico do paciente. Defina o novo leito e ala abaixo.
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenNewPatient()}
                  className="h-6 text-[10px] text-slate-500 hover:text-slate-800"
                >
                  Limpar
                </Button>
              </div>
            )}

            {/* Foto do Paciente */}
            <PhotoCaptureField
              value={patientFormData.foto}
              onChange={(foto) => setPatientFormData(prev => ({ ...prev, foto }))}
              prontuario={patientFormData.prontuario}
              label="Foto do Paciente (Prontuário)"
              helperText={`Foto identificada pelo Prontuário: ${patientFormData.prontuario || "Informe o prontuário"}`}
            />

            <div>
              <Label>Nome Completo do Paciente *</Label>
              <Input
                value={patientFormData.nome}
                onChange={(e) => setPatientFormData(prev => ({ ...prev, nome: e.target.value }))}
                placeholder="Ex: João da Silva"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prontuário *</Label>
                <Input
                  value={patientFormData.prontuario}
                  onChange={(e) => setPatientFormData(prev => ({ ...prev, prontuario: e.target.value }))}
                  placeholder="PRONT-001"
                />
              </div>
              <div>
                <Label>Idade</Label>
                <Input
                  type="number"
                  value={patientFormData.idade}
                  onChange={(e) => setPatientFormData(prev => ({ ...prev, idade: e.target.value }))}
                  placeholder="Ex: 45"
                />
              </div>
            </div>

            {/* Aviso 1: Prontuário Duplicado Ativo */}
            {prontuarioCheck.active && (
              <div className="bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 p-3 rounded-lg text-xs flex items-start gap-2.5 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-red-900 dark:text-red-200">
                    Prontuário já em uso por paciente ativo!
                  </p>
                  <p className="text-red-700 dark:text-red-300 mt-0.5">
                    O paciente <strong>{prontuarioCheck.active.nome}</strong> já está internado com o prontuário "{patientFormData.prontuario}" no setor <strong>{prontuarioCheck.active.alaNome || "Geral"}</strong> (Leito: {prontuarioCheck.active.leito || "S/L"}).
                  </p>
                  <p className="text-[11px] text-red-600 dark:text-red-400 mt-1 font-medium">
                    Não é permitido cadastrar dois pacientes ativos com o mesmo número de prontuário.
                  </p>
                </div>
              </div>
            )}

            {/* Aviso 2: Paciente Encontrado no Histórico de Altas com Botão Restaurar */}
            {!isReinternando && prontuarioCheck.alta && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 p-3 rounded-lg text-xs space-y-2 animate-in fade-in">
                <div className="flex items-start gap-2">
                  <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-900 dark:text-amber-200">
                      Paciente encontrado no histórico de altas!
                    </p>
                    <p className="text-amber-800 dark:text-amber-300 mt-0.5">
                      O paciente <strong>{prontuarioCheck.alta.nome}</strong> (Prontuário: {prontuarioCheck.alta.prontuario}) já esteve internado e recebeu alta.
                    </p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                      Última Ala: {prontuarioCheck.alta.alaNome || "Geral"} • Leito anterior: {prontuarioCheck.alta.leito || "S/L"}
                    </p>
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleRestaurarPacienteAlta(prontuarioCheck.alta)}
                    className="h-8 bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1.5 text-xs shadow-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restaurar / Reinternar Paciente
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ala / Setor</Label>
                <Select value={patientFormData.alaId} onValueChange={handleAlaChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a ala..." />
                  </SelectTrigger>
                  <SelectContent>
                    {alas.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Leito</Label>
                <Input
                  value={patientFormData.leito}
                  onChange={(e) => setPatientFormData(prev => ({ ...prev, leito: e.target.value }))}
                  placeholder="Ex: Leito 04"
                />
              </div>
            </div>
            <div>
              <Label>Observações / Alergias</Label>
              <Textarea
                value={patientFormData.observacoes}
                onChange={(e) => setPatientFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                placeholder="Alergia a penicilina, restrição alimentar..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPatientModalOpen(false)}>Cancelar</Button>
            <Button 
              onClick={() => savePatientMutation.mutate(patientFormData)} 
              disabled={!patientFormData.nome || !patientFormData.prontuario || Boolean(prontuarioCheck.active) || savePatientMutation.isPending}
              className={cn(isReinternando && "bg-amber-600 hover:bg-amber-700 text-white font-bold")}
            >
              {savePatientMutation.isPending 
                ? "Salvando..." 
                : (isReinternando ? "Confirmar Reinternação" : (editingPatient ? "Salvar Alterações" : "Cadastrar Paciente"))
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ─── MODAL: DETALHES & PRONTUÁRIO COMPLETO DO PACIENTE (ZORION SAÚDE & MÉDICO) ─────────── */}
      <ProntuarioPacienteModal
        open={!!viewPatientDetails}
        onOpenChange={(open) => !open && setViewPatientDetails(null)}
        patient={currentViewPatient || viewPatientDetails}
        prescricoes={prescricoes}
        medicamentos={medicamentos}
        lotes={lotes}
        onOpenNewPrescricao={(target) => handleOpenNewPresc(target)}
        onEditPrescricao={(pr) => handleOpenEditPresc(pr)}
        onOpenPrintReceita={(pat) => handleOpenPrintPrescModal([pat?.id || pat])}
        onRefresh={() => {
          queryClient.invalidateQueries({ queryKey: ["prescricoes_paciente"] });
          queryClient.invalidateQueries({ queryKey: ["pacientes"] });
          queryClient.invalidateQueries({ queryKey: ["pacientes_medicao"] });
        }}
      />

      {/* ─── MODAL: AJUSTE DE DIAS DE ENTREGA (COMPLEMENTO DE CICLO) ─────────── */}
      <AjusteDiasEntregaModal
        open={ajusteCicloModalOpen}
        onOpenChange={setAjusteCicloModalOpen}
        patient={ajusteCicloPatient}
        prescricoes={prescricoes}
        medicamentos={medicamentos}
        lotes={lotes}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["medicamentos"] });
          queryClient.invalidateQueries({ queryKey: ["lotes"] });
          queryClient.invalidateQueries({ queryKey: ["saidas"] });
          queryClient.invalidateQueries({ queryKey: ["prescricoes_paciente"] });
          queryClient.invalidateQueries({ queryKey: ["pacientes"] });
        }}
      />

      {/* ─── MODAL: COMEÇAR SEPARAÇÃO & BAIXA EM LOTE COM MULTI-LOTE ─────── */}
      <SeparacaoLoteModal
        open={separacaoModalOpen}
        onOpenChange={setSeparacaoModalOpen}
        selectedPatientIds={selectedPatientIds}
        pacientes={pacientes}
        prescricoes={prescricoes}
        medicamentos={medicamentos}
        lotes={lotes}
        onSuccess={() => {
          setSelectedPatientIds([]);
        }}
      />

      {/* ─── MODAL: CONFIRMAÇÃO DE BAIXA EM LOTE DO ESTOQUE ───────────────── */}
      <Dialog open={batchBaixaModalOpen} onOpenChange={setBatchBaixaModalOpen}>
        <DialogContent className="sm:max-w-[750px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <PackageMinus className="w-6 h-6 text-emerald-600" />
              Confirmar Baixa em Lote de Medicações
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <p className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                  {selectedPatientIds.length} Paciente(s) Selecionado(s)
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  As saídas de estoque serão geradas e vinculadas aos nomes dos pacientes e aparecerão na tela de Saídas.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Período:</Label>
                <Select value={String(batchBaixaDias)} onValueChange={(v) => {
                  setBatchBaixaDias(Number(v));
                  setCustomQtdsBaixa({});
                }}>
                  <SelectTrigger className="w-[150px] h-9 bg-white dark:bg-slate-900 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 dia</SelectItem>
                    <SelectItem value="7">7 dias</SelectItem>
                    <SelectItem value="8">8 dias (Ciclo Padrão)</SelectItem>
                    <SelectItem value="15">15 dias</SelectItem>
                    <SelectItem value="30">30 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {(() => {
              const selectedPacs = pacientes.filter(p => selectedPatientIds.includes(p.id));
              const activePrescs = prescricoes.filter(pr => selectedPatientIds.includes(pr.pacienteId) && pr.status === "Ativa");

              if (activePrescs.length === 0) {
                return (
                  <div className="text-center py-8 border border-dashed border-amber-300 bg-amber-50/50 rounded-xl text-amber-800 text-sm font-medium">
                    <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                    Nenhuma medicação ativa cadastrada para o(s) paciente(s) selecionado(s).
                  </div>
                );
              }

              return (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                    Resumo das Saídas por Paciente ({activePrescs.length} medicação(ões))
                  </h4>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                    <Table>
                      <TableHeader className="bg-slate-100 dark:bg-slate-800">
                        <TableRow>
                          <TableHead>Paciente</TableHead>
                          <TableHead>Medicamento</TableHead>
                          <TableHead className="text-center min-w-[200px]">Lote da Saída (FEFO)</TableHead>
                          <TableHead className="text-center">Dose Diária</TableHead>
                          <TableHead className="text-center">Total Saída ({batchBaixaDias}d)</TableHead>
                          <TableHead className="text-right">Estoque Satélite</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activePrescs.map((pr) => {
                          const pac = selectedPacs.find(p => p.id === pr.pacienteId);
                          const med = medicamentos.find(m => m.id === pr.medicamentoId);
                          const targetEndStr = format(addDays(new Date(), batchBaixaDias - 1), "yyyy-MM-dd");
                          const cobAte = pr.coberto_ate ? pr.coberto_ate.split("T")[0] : null;
                          const jaCoberto = Boolean(cobAte && cobAte >= targetEndStr);
                          const qtdCalculada = calculatePrescQtdParaDias(pr, batchBaixaDias);
                          const qtdSaida = jaCoberto ? 0 : qtdCalculada;
                          const estoqueDisponivel = med?.estoque_satelite || 0;
                          const temEstoqueSuficiente = estoqueDisponivel >= qtdSaida;

                          // Lotes disponíveis deste medicamento ordenados por vencimento (FEFO)
                          const medLotes = (lotes || [])
                            .filter(l => (l.medicamento_id === pr.medicamentoId || l.medicamentoId === pr.medicamentoId) && (Number(l.quantidade_atual) || 0) > 0 && l.status !== "Inativo")
                            .sort((a, b) => new Date(a.data_validade) - new Date(b.data_validade));

                          const fefoLote = medLotes[0];
                          const selectedLoteId = selectedLotesBaixa[pr.id] || fefoLote?.id || "";

                          return (
                            <TableRow key={pr.id} className={cn("hover:bg-slate-50/50", jaCoberto && "opacity-65 bg-slate-50/60")}>
                              <TableCell className="max-w-[180px] min-w-[120px] break-words whitespace-normal [overflow-wrap:anywhere] [word-break:break-word]">
                                <p className="font-bold text-xs text-slate-900 dark:text-slate-100 break-words whitespace-normal [overflow-wrap:anywhere] [word-break:break-word]">{pac?.nome || "Paciente"}</p>
                                <p className="text-[10px] text-slate-500 font-mono break-words">Pront: {pac?.prontuario || "N/A"} • {pac?.leito || "S/L"}</p>
                              </TableCell>
                              <TableCell className="max-w-[240px] min-w-[140px] break-words whitespace-normal [overflow-wrap:anywhere] [word-break:break-word]">
                                <div className="flex flex-wrap items-center gap-1">
                                  <p className="font-bold text-xs text-blue-900 dark:text-blue-200 break-words whitespace-normal [overflow-wrap:anywhere] [word-break:break-word] leading-snug">
                                    {pr.medicamentoNome}
                                    {(() => {
                                      const rawC = (pr.concentracao || med?.concentracao || (med?.unidade_medida && !["un", "unidade", "unid", "-", ""].includes(med?.unidade_medida?.toLowerCase()) ? med?.unidade_medida : "") || "").trim();
                                      const hasC = rawC && pr.medicamentoNome?.toLowerCase().includes(rawC.toLowerCase());
                                      return rawC && !hasC ? ` (${rawC})` : "";
                                    })()}
                                  </p>
                                  {jaCoberto && (
                                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[9px] font-bold py-0 px-1">
                                      ✅ Já coberto (até {cobAte})
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-500">Cód: {pr.medicamentoCodigo || "N/A"}</p>
                              </TableCell>

                              {/* Lote da Saída (FEFO) */}
                              <TableCell className="min-w-[200px]">
                                {medLotes.length === 0 ? (
                                  <div className="text-center">
                                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                      Sem lote específico / Saldo Geral
                                    </span>
                                  </div>
                                ) : (
                                  <div className="space-y-1">
                                    <Select
                                      value={selectedLoteId}
                                      onValueChange={(val) => {
                                        setSelectedLotesBaixa(prev => ({ ...prev, [pr.id]: val }));
                                      }}
                                    >
                                      <SelectTrigger className="h-7 text-xs font-mono font-medium bg-white border-slate-300">
                                        <SelectValue placeholder="Selecione o Lote" />
                                      </SelectTrigger>
                                      <SelectContent>
                                          {medLotes.map((l, lIdx) => (
                                            <SelectItem key={l.id} value={l.id} className="text-xs font-mono">
                                              {l.numero_lote} (Val: {l.data_validade ? format(new Date(l.data_validade), "dd/MM/yy") : "-"})
                                              {lIdx === 0 ? " 🌟 [FEFO]" : ""}
                                            </SelectItem>
                                          ))}
                                      </SelectContent>
                                    </Select>
                                    {selectedLoteId && fefoLote && selectedLoteId !== fefoLote.id && (
                                      <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 block font-semibold">
                                        ⚠️ Lote alternativo (FEFO: {fefoLote.numero_lote})
                                      </span>
                                    )}
                                  </div>
                                )}
                              </TableCell>

                              <TableCell className="text-center font-mono text-xs font-bold">
                                {pr.totalDiario} un/dia
                              </TableCell>
                              <TableCell className="text-center w-32">
                                {(() => {
                                  const valCustom = customQtdsBaixa[pr.id];
                                  const valAtual = valCustom !== undefined ? valCustom : qtdSaida;
                                  const isAlterado = valCustom !== undefined && Number(valCustom) !== qtdSaida;
                                  return (
                                    <div className="flex flex-col items-center justify-center gap-1">
                                      <div className="flex items-center justify-center gap-1">
                                        <Input
                                          type="number"
                                          min="0"
                                          value={valAtual}
                                          onChange={(e) => {
                                            const v = e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value) || 0);
                                            setCustomQtdsBaixa(prev => ({ ...prev, [pr.id]: v }));
                                          }}
                                          className={cn(
                                            "w-20 h-7 text-center font-mono font-bold text-xs bg-white dark:bg-slate-900",
                                            isAlterado ? "border-amber-500 bg-amber-50 text-amber-900" : "border-slate-300 text-emerald-600"
                                          )}
                                          title="Você pode alterar a quantidade manualmente antes de confirmar"
                                        />
                                        <span className="text-xs text-slate-500 font-semibold">un</span>
                                      </div>
                                      {isAlterado && (
                                        <span className="text-[9px] text-amber-800 bg-amber-100/80 px-1 rounded font-medium">
                                          Sugerido: {qtdSaida} un
                                        </span>
                                      )}
                                    </div>
                                  );
                                })()}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    "font-mono text-xs font-bold",
                                    temEstoqueSuficiente ? "bg-slate-50 text-slate-700" : "bg-red-50 text-red-700 border-red-300"
                                  )}
                                >
                                  {estoqueDisponivel} na satélite
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              );
            })()}
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between border-t border-slate-200 dark:border-slate-800 pt-3">
            <Button variant="outline" onClick={() => setBatchBaixaModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 shadow-sm"
              disabled={efetuandoBaixaLoteMutation.isPending || selectedPatientIds.length === 0}
              onClick={() => {
                executarComSenha102030(() => {
                  efetuandoBaixaLoteMutation.mutate({
                    patientIds: selectedPatientIds,
                    dias: batchBaixaDias,
                    customQtds: customQtdsBaixa
                  });
                });
              }}
            >
              <PackageMinus className="w-4 h-4" />
              {efetuandoBaixaLoteMutation.isPending ? "Efetuando Baixa..." : "Confirmar e Registrar Saída no Estoque"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: PRESCRIÇÃO FIXA ────────────────────────────────────────── */}
      <Dialog open={prescModalOpen} onOpenChange={setPrescModalOpen}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-[580px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPresc ? "Alterar Prescrição do Paciente" : "Nova Prescrição Fixa de Paciente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editingPresc && (
              <div className="bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-blue-600" /> Prescrição Atual em Uso:
                  </span>
                  <Badge variant="outline" className="bg-white dark:bg-slate-900 text-blue-800 dark:text-blue-300 font-mono font-bold border-blue-300">
                    Esquema: {editingPresc.esquemaPosologico} ({editingPresc.totalDiario} un/dia) • {formatFrequenciaPrescricao(editingPresc)}
                  </Badge>
                </div>
                <p className="text-slate-700 dark:text-slate-300">
                  Medicamento: <strong>{editingPresc.medicamentoNome} {editingPresc.concentracao ? `(${editingPresc.concentracao})` : ''}</strong>
                </p>
                <label className="flex items-start gap-2 pt-1 font-medium text-slate-800 dark:text-slate-200 cursor-pointer select-none">
                  <input 
                    type="checkbox" 
                    checked={Boolean(prescFormData.gerarHistorico)} 
                    onChange={(e) => setPrescFormData(prev => ({ ...prev, gerarHistorico: e.target.checked }))}
                    className="w-4 h-4 mt-0.5 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>Arquivar o esquema anterior <strong>({editingPresc.esquemaPosologico})</strong> no histórico do paciente e ativar o novo</span>
                </label>
              </div>
            )}

            <div>
              <Label>Paciente *</Label>
              {isPatientLocked ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg text-sm mt-1">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <User className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1 break-words whitespace-normal [overflow-wrap:anywhere] [word-break:break-word]">
                      <span className="font-bold text-slate-900 dark:text-slate-100 break-words whitespace-normal [overflow-wrap:anywhere] [word-break:break-word] block leading-snug">
                        {selectedPrescPatient?.nome || "Paciente Selecionado"}
                      </span>
                      <span className="text-xs text-slate-500 font-mono block mt-0.5 break-words [overflow-wrap:anywhere]">
                        (Pront: {selectedPrescPatient?.prontuario || "S/P"} • Ala: {selectedPrescPatient?.alaNome || "Geral"} • Leito: {selectedPrescPatient?.leito || "S/L"})
                      </span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold border-slate-300 shrink-0 self-start sm:self-center ml-1">
                    🔒 Prontuário Bloqueado
                  </Badge>
                </div>
              ) : (
                <Select
                  value={prescFormData.pacienteId}
                  onValueChange={(val) => setPrescFormData(prev => ({ ...prev, pacienteId: val }))}
                >
                  <SelectTrigger className="w-full h-auto min-h-[42px] py-2 px-3 text-left [&>span]:!line-clamp-none [&>span]:!whitespace-normal break-words whitespace-normal [overflow-wrap:anywhere] [word-break:break-word]">
                    <SelectValue placeholder="Selecione o paciente..." />
                  </SelectTrigger>
                  <SelectContent className="max-w-[calc(100vw-2rem)] sm:max-w-[520px]">
                    {pacientes.map(p => (
                      <SelectItem key={p.id} value={p.id} className="whitespace-normal break-words [overflow-wrap:anywhere] [word-break:break-word] py-2.5">
                        <div className="break-words whitespace-normal [overflow-wrap:anywhere] [word-break:break-word] text-left">
                          <span className="font-bold text-slate-900 dark:text-slate-100 block break-words whitespace-normal [overflow-wrap:anywhere] [word-break:break-word] leading-snug">
                            {p.nome}
                          </span>
                          <span className="text-xs text-slate-500 font-mono block mt-0.5">
                            Pront: {p.prontuario || "S/P"} • Ala: {p.alaNome || "Geral"} • Leito: {p.leito || "S/L"}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div>
              <Label>Medicamento * (Apenas com Estoque Disponível)</Label>
              <ComboboxMedicamento
                medicamentos={medicamentosComEstoque}
                value={prescFormData.medicamentoId}
                onChange={(val) => {
                  const m = medicamentos.find(med => med.id === val);
                  const isAnti = isMedicamentoAntibiotico(m);
                  const isLiq = isLiquido(m);
                  const volMl = extrairVolumeMl(m);
                  setPrescFormData(prev => {
                    let next = { 
                      ...prev, 
                      medicamentoId: val,
                      isLiquido: isLiq,
                      unidadeDose: isLiq ? (prev.unidadeDose === "gotas" ? "gotas" : "ml") : "comp",
                      volumeFrascoMl: isLiq ? (volMl || prev.volumeFrascoMl || 100) : ""
                    };
                    if (isAnti && !prev.dataFim) {
                      const inicio = prev.dataInicio || format(new Date(), "yyyy-MM-dd");
                      const hora = prev.horarioInicio || "08:00";
                      next.diasTratamento = "7";
                      next.dataFim = calcularDataFim(inicio, 7, hora);
                    }
                    return next;
                  });
                }}
                placeholder="Selecione ou busque o medicamento com estoque..."
              />
            </div>

            {/* Painel Inteligente se for medicamento líquido (Gotas / Xarope / Solução) */}
            {(() => {
              const medSel = medicamentos.find(m => m.id === prescFormData.medicamentoId);
              const isLiq = prescFormData.isLiquido || isLiquido(medSel);
              if (!isLiq) return null;

              const totalDose = (Number(prescFormData.dose08) || 0) +
                                (Number(prescFormData.dose14) || 0) +
                                (Number(prescFormData.dose22) || 0) +
                                (Number(prescFormData.dose06) || 0);

              const vol = Number(prescFormData.volumeFrascoMl) || extrairVolumeMl(medSel) || 100;
              let consumoMlDia = totalDose;
              if (prescFormData.unidadeDose === "gotas") {
                consumoMlDia = converterGotasParaMl(totalDose);
              }
              const duracaoDias = calcularDuracaoFrascoDias(vol, consumoMlDia);

              return (
                <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 p-4 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Droplet className="w-5 h-5 text-sky-600 animate-pulse" />
                      <div>
                        <h4 className="font-bold text-sm text-sky-950 dark:text-sky-200">
                          Medicamento Líquido / Multidose Identificado
                        </h4>
                        <p className="text-xs text-sky-700 dark:text-sky-300">
                          Configure o volume do frasco e a unidade prescrita (20 gotas = 1 mL)
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-sky-600 text-white font-mono text-xs">
                      {duracaoDias ? `Dura ~ ${duracaoDias} dias/frasco` : 'Calculando duração...'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Unidade de Medida da Prescrição:
                      </Label>
                      <div className="flex gap-2 mt-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant={prescFormData.unidadeDose !== "gotas" ? "default" : "outline"}
                          className={prescFormData.unidadeDose !== "gotas" ? "bg-sky-600 hover:bg-sky-700 text-white h-8 text-xs font-bold" : "h-8 text-xs"}
                          onClick={() => setPrescFormData(prev => ({ ...prev, unidadeDose: "ml" }))}
                        >
                          💧 Em mL (mililitros)
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={prescFormData.unidadeDose === "gotas" ? "default" : "outline"}
                          className={prescFormData.unidadeDose === "gotas" ? "bg-sky-600 hover:bg-sky-700 text-white h-8 text-xs font-bold" : "h-8 text-xs"}
                          onClick={() => setPrescFormData(prev => ({ ...prev, unidadeDose: "gotas" }))}
                        >
                          💧 Em Gotas (20 gts = 1 mL)
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Volume Total do Frasco (mL):
                      </Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          type="number"
                          min="1"
                          placeholder="Ex: 10, 20, 100, 120"
                          value={prescFormData.volumeFrascoMl}
                          onChange={(e) => setPrescFormData(prev => ({ ...prev, volumeFrascoMl: e.target.value }))}
                          className="h-8 bg-white font-bold text-sky-800 dark:text-sky-200"
                        />
                        <span className="text-xs text-slate-500 font-semibold">mL</span>
                      </div>
                    </div>
                  </div>

                  {totalDose > 0 && duracaoDias && (
                    <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-sky-100 dark:border-sky-900 text-xs flex items-center justify-between">
                      <span className="text-slate-600 dark:text-slate-300">
                        Consumo: <b>{totalDose} {prescFormData.unidadeDose || 'mL'}/dia</b> {prescFormData.unidadeDose === 'gotas' && `(~ ${consumoMlDia.toFixed(1)} mL/dia)`}
                      </span>
                      <span className="font-bold text-sky-700 dark:text-sky-300">
                        🚚 O sistema só pedirá novo frasco após {duracaoDias} dias
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Esquema Posológico 0-0-0-0 */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex justify-between items-center">
                <Label className="font-bold text-slate-800 dark:text-slate-200">
                  {prescFormData.isLiquido || (medicamentos.find(m => m.id === prescFormData.medicamentoId) && isLiquido(medicamentos.find(m => m.id === prescFormData.medicamentoId)))
                    ? `Dose por Horário (${prescFormData.unidadeDose === 'gotas' ? 'Gotas' : 'mL'})`
                    : 'Esquema Posológico por Horário (Ex: 0-0-0-0)'}
                </Label>
                <Input
                  className="w-28 font-mono text-center font-bold text-blue-700 bg-white"
                  value={prescFormData.esquemaPosologico}
                  onChange={(e) => handleEsquemaPosologicoStringChange(e.target.value)}
                  placeholder="0-0-0-0"
                />
              </div>

              <div className="grid grid-cols-4 gap-2.5 text-center">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold text-amber-900 block mb-1 bg-amber-100 rounded px-1 py-0.5 w-full dark:bg-amber-900 dark:text-amber-100">
                    08:00<br/>{prescFormData.unidadeDose === 'gotas' ? '💧 Gotas' : prescFormData.unidadeDose === 'ml' ? 'mL' : '(Manhã)'}
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    className="text-center font-bold h-10 bg-white"
                    value={prescFormData.dose08}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPrescFormData(prev => ({
                        ...prev,
                        dose08: val,
                        esquemaPosologico: `${val || 0}-${prev.dose14 || 0}-${prev.dose22 || 0}-${prev.dose06 || 0}`
                      }));
                    }}
                  />
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold text-blue-900 block mb-1 bg-blue-100 rounded px-1 py-0.5 w-full dark:bg-blue-900 dark:text-blue-100">
                    14:00<br/>{prescFormData.unidadeDose === 'gotas' ? '💧 Gotas' : prescFormData.unidadeDose === 'ml' ? 'mL' : '(Tarde)'}
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    className="text-center font-bold h-10 bg-white"
                    value={prescFormData.dose14}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPrescFormData(prev => ({
                        ...prev,
                        dose14: val,
                        esquemaPosologico: `${prev.dose08 || 0}-${val || 0}-${prev.dose22 || 0}-${prev.dose06 || 0}`
                      }));
                    }}
                  />
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold text-indigo-900 block mb-1 bg-indigo-100 rounded px-1 py-0.5 w-full dark:bg-indigo-900 dark:text-indigo-100">
                    22:00<br/>{prescFormData.unidadeDose === 'gotas' ? '💧 Gotas' : prescFormData.unidadeDose === 'ml' ? 'mL' : '(Noite)'}
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    className="text-center font-bold h-10 bg-white"
                    value={prescFormData.dose22}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPrescFormData(prev => ({
                        ...prev,
                        dose22: val,
                        esquemaPosologico: `${prev.dose08 || 0}-${prev.dose14 || 0}-${val || 0}-${prev.dose06 || 0}`
                      }));
                    }}
                  />
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-bold text-purple-900 block mb-1 bg-purple-100 rounded px-1 py-0.5 w-full dark:bg-purple-900 dark:text-purple-100">
                    06:00<br/>{prescFormData.unidadeDose === 'gotas' ? '💧 Gotas' : prescFormData.unidadeDose === 'ml' ? 'mL' : '(Madrug)'}
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    className="text-center font-bold h-10 bg-white"
                    value={prescFormData.dose06}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPrescFormData(prev => ({
                        ...prev,
                        dose06: val,
                        esquemaPosologico: `${prev.dose08 || 0}-${prev.dose14 || 0}-${prev.dose22 || 0}-${val || 0}`
                      }));
                    }}
                  />
                </div>
              </div>

              <div className="text-right text-xs font-bold text-blue-900 dark:text-blue-300">
                Total Diário: {
                  (parseFloat(prescFormData.dose08) || 0) + 
                  (parseFloat(prescFormData.dose14) || 0) + 
                  (parseFloat(prescFormData.dose22) || 0) + 
                  (parseFloat(prescFormData.dose06) || 0)
                } unidades/dia
              </div>
            </div>

            {/* Horário de Início da 1ª Dose / Administração */}
            <div className="bg-indigo-50/70 dark:bg-indigo-950/40 p-3.5 rounded-xl border border-indigo-200/80 dark:border-indigo-800 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Horário de Início da 1ª Dose (Início da Administração) *
                </Label>
                <Badge variant="outline" className="bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 font-mono font-bold text-[11px] border-indigo-300">
                  {prescFormData.horarioInicio === "22:00" ? "🌙 Inicia às 22:00 (Noite)" :
                   prescFormData.horarioInicio === "14:00" ? "🌤️ Inicia às 14:00 (Tarde)" :
                   prescFormData.horarioInicio === "06:00" ? "🌌 Inicia às 06:00 (Madrug)" :
                   "☀️ Inicia às 08:00 (Manhã)"}
                </Badge>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[
                  { hora: "08:00", label: "08:00", turno: "Manhã", icon: "☀️" },
                  { hora: "14:00", label: "14:00", turno: "Tarde", icon: "🌤️" },
                  { hora: "22:00", label: "22:00", turno: "Noite", icon: "🌙" },
                  { hora: "06:00", label: "06:00", turno: "Madrug", icon: "🌌" },
                ].map(item => {
                  const isSelected = (prescFormData.horarioInicio || "08:00") === item.hora;
                  return (
                    <button
                      key={item.hora}
                      type="button"
                      onClick={() => {
                        const newHora = item.hora;
                        setPrescFormData(prev => {
                          const fim = prev.diasTratamento 
                            ? calcularDataFim(prev.dataInicio || format(new Date(), "yyyy-MM-dd"), prev.diasTratamento, newHora) 
                            : prev.dataFim;
                          return { ...prev, horarioInicio: newHora, dataFim: fim };
                        });
                      }}
                      className={cn(
                        "p-2 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5",
                        isSelected
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-400/40"
                          : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                      )}
                    >
                      <span className="text-sm">{item.icon}</span>
                      <span className="text-xs font-bold font-mono">{item.label}</span>
                      <span className={cn("text-[10px]", isSelected ? "text-indigo-100" : "text-slate-500")}>{item.turno}</span>
                    </button>
                  );
                })}
              </div>

              <p className="text-[11px] text-indigo-900 dark:text-indigo-300 bg-white/70 dark:bg-slate-900/60 p-2 rounded-lg border border-indigo-200/60 dark:border-indigo-800/60">
                {prescFormData.horarioInicio === "22:00" ? (
                  <span>🌙 <strong>Início no período noturno (22h):</strong> No 1º dia ({prescFormData.dataInicio ? new Date(prescFormData.dataInicio).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'início'}) o paciente toma apenas a dose noturna. Para fechar o ciclo de {prescFormData.diasTratamento || 7} dias completos, o tratamento estenderá até o dia seguinte pela manhã/tarde ({prescFormData.dataFim ? new Date(prescFormData.dataFim).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'término'}).</span>
                ) : prescFormData.horarioInicio === "14:00" ? (
                  <span>🌤️ <strong>Início à tarde (14h):</strong> No 1º dia toma as doses a partir da tarde, completando as 24h finais no último dia pela manhã.</span>
                ) : prescFormData.horarioInicio === "06:00" ? (
                  <span>🌌 <strong>Início na madrugada (06h):</strong> Inicia a escala nas primeiras horas do dia.</span>
                ) : (
                  <span>☀️ <strong>Início pela manhã (08h):</strong> Ciclo hospitalar padrão matutino completo. Inicia e finaliza o ciclo de dias durante o dia.</span>
                )}
              </p>
            </div>

            {/* Frequência: Dias da Semana ou Intervalo em Dias */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  Frequência de Administração *
                </Label>
                <Badge variant="outline" className="bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 font-bold text-[11px]">
                  {prescFormData.tipoFrequencia === "intervalo_dias" 
                    ? `⏱️ A cada ${prescFormData.intervaloDias || 1} dias`
                    : formatDiasSemana(prescFormData.diasSemana)}
                </Badge>
              </div>

              {/* Seletor do Modo de Frequência */}
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/70 dark:bg-slate-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPrescFormData(prev => ({ ...prev, tipoFrequencia: "diaria" }))}
                  className={cn(
                    "py-1.5 px-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                    (prescFormData.tipoFrequencia || "diaria") === "diaria"
                      ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  )}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Dias da Semana / Diário</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrescFormData(prev => ({ ...prev, tipoFrequencia: "intervalo_dias" }))}
                  className={cn(
                    "py-1.5 px-2 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                    prescFormData.tipoFrequencia === "intervalo_dias"
                      ? "bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  )}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>A cada N dias (Intervalo)</span>
                </button>
              </div>

              {/* MODO 1: Dias da Semana */}
              {(!prescFormData.tipoFrequencia || prescFormData.tipoFrequencia === "diaria") && (
                <div className="space-y-2">
                  {/* 7 Day Toggles */}
                  <div className="grid grid-cols-7 gap-1.5">
                    {DIAS_SEMANA_MAP.map(d => {
                      const currentDias = parseDiasSemana(prescFormData.diasSemana);
                      const isSelected = currentDias.includes(d.id);
                      return (
                        <button
                          type="button"
                          key={d.id}
                          onClick={() => toggleDiaSemana(d.id)}
                          className={cn(
                            "py-2 px-1 text-xs font-bold rounded-lg border transition-all text-center flex flex-col items-center justify-center cursor-pointer",
                            isSelected
                              ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                          )}
                          title={d.full}
                        >
                          <span>{d.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Atalhos rápidos de seleção */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                    <span className="text-[10px] text-slate-400 font-medium mr-0.5">Atalhos:</span>
                    <button
                      type="button"
                      onClick={() => setPrescFormData(prev => ({ ...prev, diasSemana: [0, 1, 2, 3, 4, 5, 6] }))}
                      className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-medium cursor-pointer"
                    >
                      Diário
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrescFormData(prev => ({ ...prev, diasSemana: [1, 2, 3, 4, 5] }))}
                      className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-medium cursor-pointer"
                    >
                      Seg a Sex
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrescFormData(prev => ({ ...prev, diasSemana: [1, 3, 5] }))}
                      className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-medium cursor-pointer"
                    >
                      Seg/Qua/Sex
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrescFormData(prev => ({ ...prev, diasSemana: [1, 2, 3] }))}
                      className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-medium cursor-pointer"
                    >
                      Seg/Ter/Qua
                    </button>
                    <button
                      type="button"
                      onClick={() => setPrescFormData(prev => ({ ...prev, diasSemana: [0, 6] }))}
                      className="px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-medium cursor-pointer"
                    >
                      Fim de Semana
                    </button>
                  </div>
                </div>
              )}

              {/* MODO 2: Intervalo em Dias (Ex: a cada 10 dias Haldol Decanoato) */}
              {prescFormData.tipoFrequencia === "intervalo_dias" && (
                <div className="space-y-2.5 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Administrar a cada:</span>
                    <div className="flex items-center gap-1.5 w-28">
                      <Input
                        type="number"
                        min="1"
                        max="365"
                        value={prescFormData.intervaloDias || ""}
                        onChange={(e) => {
                          const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                          setPrescFormData(prev => ({ ...prev, intervaloDias: String(val) }));
                        }}
                        className="h-8 text-center font-bold text-sm bg-white dark:bg-slate-900 border-indigo-300 dark:border-indigo-700 focus:border-indigo-500"
                      />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">dias</span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      (Ex: Haldol Decanoato a cada 10 dias)
                    </span>
                  </div>

                  {/* Atalhos rápidos para medicações de depósito / intervalo */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="text-[10px] text-slate-400 font-medium mr-0.5">Atalhos rápidos:</span>
                    {[
                      { label: "A cada 2 dias (Dia sim/não)", dias: 2 },
                      { label: "A cada 3 dias", dias: 3 },
                      { label: "A cada 7 dias (Semanal)", dias: 7 },
                      { label: "A cada 10 dias (Ex: Haldol)", dias: 10 },
                      { label: "A cada 14 dias (Quinzenal)", dias: 14 },
                      { label: "A cada 15 dias", dias: 15 },
                      { label: "A cada 21 dias (3 sem)", dias: 21 },
                      { label: "A cada 28 dias (4 sem)", dias: 28 },
                      { label: "A cada 30 dias (Mensal)", dias: 30 }
                    ].map(item => {
                      const isSel = String(prescFormData.intervaloDias) === String(item.dias);
                      return (
                        <button
                          key={item.dias}
                          type="button"
                          onClick={() => setPrescFormData(prev => ({ ...prev, intervaloDias: String(item.dias) }))}
                          className={cn(
                            "px-2 py-0.5 rounded border text-[11px] font-medium transition-all cursor-pointer",
                            isSel
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-xs font-bold"
                              : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 text-slate-700 dark:text-slate-300"
                          )}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Previsão visual das próximas administrações */}
                  {(() => {
                    const intervaloNum = Math.max(1, parseInt(prescFormData.intervaloDias, 10) || 1);
                    const baseDate = prescFormData.dataInicio ? new Date(prescFormData.dataInicio + "T00:00:00") : new Date();
                    const dates = [];
                    for (let step = 0; step < 4; step++) {
                      const nextD = new Date(baseDate);
                      nextD.setDate(baseDate.getDate() + (step * intervaloNum));
                      dates.push(format(nextD, "dd/MM/yyyy"));
                    }
                    return (
                      <div className="p-2.5 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 text-xs text-indigo-900 dark:text-indigo-300">
                        <div className="font-semibold flex items-center gap-1 text-[11px]">
                          <CalendarCheck className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Próximas datas calculadas a partir do início:</span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {dates.map((dt, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 font-mono text-[11px] font-bold text-indigo-700 dark:text-indigo-300">
                              {idx === 0 ? `1ª dose: ${dt}` : `${idx + 1}ª dose: ${dt}`}
                            </span>
                          ))}
                          <span className="text-[10px] text-indigo-500 font-medium">e assim por diante...</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Período de Tratamento (Início, Dias e Término com Suspensão Automática) */}
            {(() => {
              const selectedMed = medicamentos.find(m => m.id === prescFormData.medicamentoId);
              const isAnti = isMedicamentoAntibiotico(selectedMed);
              const horaIni = prescFormData.horarioInicio || "08:00";
              return (
                <div className={cn(
                  "p-3.5 rounded-xl border space-y-3 transition-all",
                  isAnti 
                    ? "bg-purple-50/90 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 shadow-sm"
                    : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700"
                )}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Calendar className={cn("w-4 h-4", isAnti ? "text-purple-600" : "text-blue-600")} />
                      Período do Tratamento & Término Automático
                    </Label>
                    {isAnti && (
                      <Badge className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] px-2 py-0.5">
                        🧪 Antibiótico / Antimicrobiano
                      </Badge>
                    )}
                  </div>

                  {isAnti && (
                    <p className="text-xs text-purple-800 dark:text-purple-300 bg-purple-100/70 dark:bg-purple-900/40 p-2 rounded-lg border border-purple-200 dark:border-purple-800">
                      ℹ️ Para antibióticos, defina a duração ou a data final. Ao alcançar o término, <strong>o sistema suspenderá a prescrição automaticamente</strong>.
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Data de Início *</Label>
                      <Input
                        type="date"
                        className="bg-white dark:bg-slate-900 text-xs font-medium h-9 mt-1"
                        value={prescFormData.dataInicio}
                        onChange={(e) => {
                          const newInicio = e.target.value;
                          setPrescFormData(prev => {
                            const newFim = prev.diasTratamento ? calcularDataFim(newInicio, prev.diasTratamento, prev.horarioInicio || "08:00") : prev.dataFim;
                            return { ...prev, dataInicio: newInicio, dataFim: newFim };
                          });
                        }}
                      />
                    </div>

                    <div>
                      <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Duração (Dias)</Label>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Ex: 7"
                        className="bg-white dark:bg-slate-900 text-xs font-medium h-9 mt-1"
                        value={prescFormData.diasTratamento}
                        onChange={(e) => {
                          const dias = e.target.value;
                          setPrescFormData(prev => {
                            const newFim = dias ? calcularDataFim(prev.dataInicio || format(new Date(), "yyyy-MM-dd"), dias, prev.horarioInicio || "08:00") : "";
                            return { ...prev, diasTratamento: dias, dataFim: newFim };
                          });
                        }}
                      />
                    </div>

                    <div>
                      <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Data de Término</Label>
                      <Input
                        type="date"
                        className="bg-white dark:bg-slate-900 text-xs font-medium h-9 mt-1"
                        value={prescFormData.dataFim || ""}
                        onChange={(e) => {
                          const newFim = e.target.value;
                          setPrescFormData(prev => {
                            const dias = newFim && prev.dataInicio ? calcularDiasEntre(prev.dataInicio, newFim, prev.horarioInicio || "08:00") : "";
                            return { ...prev, dataFim: newFim, diasTratamento: dias ? String(dias) : "" };
                          });
                        }}
                      />
                    </div>
                  </div>

                  {/* Atalhos rápidos de dias */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                    <span className="text-[10px] text-slate-400 font-medium mr-0.5">Duração rápida:</span>
                    {[3, 5, 7, 10, 14, 21].map(dias => (
                      <button
                        type="button"
                        key={dias}
                        onClick={() => {
                          setPrescFormData(prev => {
                            const inicio = prev.dataInicio || format(new Date(), "yyyy-MM-dd");
                            const fim = calcularDataFim(inicio, dias, prev.horarioInicio || "08:00");
                            return { ...prev, dataInicio: inicio, diasTratamento: String(dias), dataFim: fim };
                          });
                        }}
                        className={cn(
                          "px-2 py-0.5 rounded border text-xs font-medium transition-colors cursor-pointer",
                          String(prescFormData.diasTratamento) === String(dias)
                            ? "bg-purple-600 text-white border-purple-600 font-bold"
                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 text-slate-700 dark:text-slate-300"
                        )}
                      >
                        {dias} Dias
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        setPrescFormData(prev => ({ ...prev, diasTratamento: "", dataFim: "" }));
                      }}
                      className={cn(
                        "px-2 py-0.5 rounded border text-xs font-medium transition-colors cursor-pointer ml-auto",
                        !prescFormData.dataFim
                          ? "bg-slate-800 text-white border-slate-800 font-bold"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 text-slate-500"
                      )}
                      title="Medicamento de uso contínuo sem previsão de suspensão automática"
                    >
                      Uso Contínuo (Sem término)
                    </button>
                  </div>

                  {/* Explicação / Prévia */}
                  <div className="text-[11px] pt-1">
                    {prescFormData.dataFim ? (
                      <span className="text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1 flex-wrap">
                        ✓ Tratamento de <strong>{prescFormData.diasTratamento || calcularDiasEntre(prescFormData.dataInicio, prescFormData.dataFim, horaIni)} dias</strong>:
                        de {prescFormData.dataInicio ? new Date(prescFormData.dataInicio).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '--'} (iniciando às {horaIni}) 
                        até {new Date(prescFormData.dataFim).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} {horaIni === '22:00' || horaIni === '14:00' ? '(encerra de dia)' : ''}.
                        Suspensão automática programada.
                      </span>
                    ) : (
                      <span className="text-slate-500 italic">
                        Uso Contínuo selecionado. A medicação permanecerá ativa até suspensão manual.
                      </span>
                    )}
                  </div>
                </div>
              );
            })()}

            <div>
              <Label>Observações Gerais</Label>
              <Input
                value={prescFormData.observacoes}
                onChange={(e) => setPrescFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                placeholder="Ex: Tomar após as refeições"
              />
            </div>

            {editingPresc && prescFormData.gerarHistorico && (
              <div>
                <Label className="text-xs">Motivo da Alteração Posológica / Médica (Opcional)</Label>
                <Input
                  value={prescFormData.motivoAlteracao}
                  onChange={(e) => setPrescFormData(prev => ({ ...prev, motivoAlteracao: e.target.value }))}
                  placeholder="Ex: Ajuste de dosagem, redução gradual, etc."
                  className="h-9 text-xs"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrescModalOpen(false)}>Cancelar</Button>
            <Button 
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              onClick={() => savePrescMutation.mutate(prescFormData)} 
              disabled={!prescFormData.pacienteId || !prescFormData.medicamentoId || savePrescMutation.isPending}
            >
              {editingPresc ? (prescFormData.gerarHistorico ? "Salvar Alteração e Gerar Histórico" : "Atualizar Prescrição") : "Salvar Prescrição"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: CONFIRMAR BAIXA NO ESTOQUE ──────────────────────────────── */}
      <Dialog open={baixaModalOpen} onOpenChange={setBaixaModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <PackageMinus className="w-5 h-5" />
              Confirmar Baixa de Estoque para {periodoDias} Dias
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <p className="text-slate-600">
              Esta ação irá deduzir automaticamente o total calculado de medicamentos para a previsão de <strong>{periodoDias} dias</strong> de todos os pacientes ativos:
            </p>
            <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-3 bg-slate-50 space-y-1">
              {calculoPrevisao.consolidadoMeds.map(item => (
                <div key={item.medicamentoId} className="flex justify-between font-mono text-xs">
                  <span>{item.nome}</span>
                  <span className="font-bold text-red-600">-{item.qtdPeriodo} un</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded border border-amber-200">
              ⚠️ Registros de movimentação do tipo <strong>Saída Fixa</strong> serão criados para controle de rastreabilidade.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBaixaModalOpen(false)}>Cancelar</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                executarComSenha102030(() => {
                  efetuarBaixaMutation.mutate(calculoPrevisao.consolidadoMeds);
                });
              }}
              disabled={calculoPrevisao.consolidadoMeds.length === 0 || efetuarBaixaMutation.isPending}
            >
              Confirmar e Dar Baixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: IMPRESSÃO DE PRESCRIÇÕES COM CHECKLIST POR ALA E PACIENTE ─── */}
      <Dialog open={printPrescModalOpen} onOpenChange={setPrintPrescModalOpen}>
        <DialogContent className="sm:max-w-[780px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold">
              <Printer className="w-5 h-5" />
              <DialogTitle className="text-lg">Imprimir Prescrições & Aprazamento</DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Selecione as alas e marque no checklist quais pacientes deseja incluir no relatório de prescrições e kits de medicação.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Seção 1: Checklist por Ala */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  1. Filtrar por Ala / Setor
                </Label>
                <div className="flex items-center gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setPrintSelectedAlas(["all"]);
                      const hojeStr = format(new Date(), "yyyy-MM-dd");
                      const allWithMed = activePatients
                        .filter(p => prescricoes.some(pr => isPrescricaoDoPaciente(pr, p) && isPrescricaoAtiva(pr, hojeStr)))
                        .map(p => p.id);
                      setPrintSelectedPatientIds(allWithMed);
                    }}
                    className="text-blue-600 font-semibold hover:underline"
                  >
                    Todas as Alas
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      setPrintSelectedAlas([]);
                      setPrintSelectedPatientIds([]);
                    }}
                    className="text-slate-500 hover:underline"
                  >
                    Desmarcar Alas
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200/80 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    const hojeStr = format(new Date(), "yyyy-MM-dd");
                    if (printSelectedAlas.includes("all")) {
                      setPrintSelectedAlas([]);
                      setPrintSelectedPatientIds([]);
                    } else {
                      setPrintSelectedAlas(["all"]);
                      const allWithMed = activePatients
                        .filter(p => prescricoes.some(pr => isPrescricaoDoPaciente(pr, p) && isPrescricaoAtiva(pr, hojeStr)))
                        .map(p => p.id);
                      setPrintSelectedPatientIds(allWithMed);
                    }
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-bold transition-all border",
                    printSelectedAlas.includes("all")
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                      : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100"
                  )}
                >
                  Todas as Alas ({activePatients.length})
                </button>

                {alas.map(a => {
                  const aIdStr = String(a.id);
                  const pacsInAla = activePatients.filter(p => String(p.alaId || p.ala_id) === aIdStr || p.alaNome === a.nome);
                  const isChecked = printSelectedAlas.includes("all") || printSelectedAlas.includes(aIdStr);

                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        const pacIdsInAla = pacsInAla.map(p => p.id);
                        if (printSelectedAlas.includes("all")) {
                          setPrintSelectedAlas([aIdStr]);
                          setPrintSelectedPatientIds(pacIdsInAla);
                        } else if (printSelectedAlas.includes(aIdStr)) {
                          const updatedAlas = printSelectedAlas.filter(id => id !== aIdStr);
                          setPrintSelectedAlas(updatedAlas);
                          setPrintSelectedPatientIds(prev => prev.filter(pid => !pacIdsInAla.includes(pid)));
                        } else {
                          const updatedAlas = [...printSelectedAlas, aIdStr];
                          if (updatedAlas.length === alas.length) {
                            setPrintSelectedAlas(["all"]);
                          } else {
                            setPrintSelectedAlas(updatedAlas);
                          }
                          setPrintSelectedPatientIds(prev => Array.from(new Set([...prev, ...pacIdsInAla])));
                        }
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-md text-xs font-medium transition-all border flex items-center gap-1.5",
                        isChecked
                          ? "bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 font-semibold"
                          : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                      )}
                    >
                      <span className={cn("w-2 h-2 rounded-full", isChecked ? "bg-blue-600" : "bg-slate-300")} />
                      {a.nome}
                      <span className="text-[10px] text-slate-400">({pacsInAla.length})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Seção 2: Checklist por Paciente */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-600" />
                  2. Checklist de Pacientes ({printSelectedPatientIds.length} selecionado{printSelectedPatientIds.length === 1 ? '' : 's'})
                </Label>

                <div className="flex items-center gap-2">
                  <div className="relative w-48 sm:w-60">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Buscar paciente / leito..."
                      value={printSearchPatient}
                      onChange={(e) => setPrintSearchPatient(e.target.value)}
                      className="h-8 text-xs pl-8 pr-2"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const filtradosIds = displayedPrintCandidates.map(p => p.id);
                      setPrintSelectedPatientIds(prev => Array.from(new Set([...prev, ...filtradosIds])));
                    }}
                    className="text-[11px] text-blue-600 font-semibold hover:underline whitespace-nowrap"
                  >
                    Marcar Todos
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setPrintSelectedPatientIds([])}
                    className="text-[11px] text-slate-500 hover:underline whitespace-nowrap"
                  >
                    Limpar
                  </button>
                </div>
              </div>

              {/* Lista com Checkboxes */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {displayedPrintCandidates.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    Nenhum paciente encontrado com os filtros selecionados.
                  </div>
                ) : (
                  displayedPrintCandidates.map(pac => {
                    const isChecked = printSelectedPatientIds.includes(pac.id);
                    const hojeStr = format(new Date(), "yyyy-MM-dd");
                    const pacPrescsCount = prescricoes.filter(pr => isPrescricaoDoPaciente(pr, pac) && isPrescricaoAtiva(pr, hojeStr)).length;

                    return (
                      <label
                        key={pac.id}
                        className={cn(
                          "flex items-center gap-3 p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors text-xs",
                          isChecked && "bg-blue-50/40 dark:bg-blue-950/20"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPrintSelectedPatientIds(prev => [...prev, pac.id]);
                            } else {
                              setPrintSelectedPatientIds(prev => prev.filter(id => id !== pac.id));
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-900 dark:text-slate-100">{pac.nome}</span>
                            <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 rounded text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              Pront: {pac.prontuario || "S/P"}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Ala: <strong>{pac.alaNome || "Geral"}</strong> • Leito: <strong>{pac.leito || "S/L"}</strong>
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-2 py-0.5 shrink-0",
                            pacPrescsCount > 0
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40"
                              : "bg-slate-100 text-slate-500 border-slate-200"
                          )}
                        >
                          {pacPrescsCount} medicação(ões)
                        </Badge>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Seção 3: Parâmetros de Impressão */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200/80 dark:border-slate-800 space-y-3">
              <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-purple-600" />
                3. Previsão de Dias & Conteúdo do Relatório
              </Label>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-500 font-medium mr-1">Previsão:</span>
                  {[1, 2, 3, 5, 7, 14, 30].map(d => (
                    <Button
                      key={d}
                      type="button"
                      size="sm"
                      variant={printPeriodoDias === d ? "default" : "outline"}
                      onClick={() => setPrintPeriodoDias(d)}
                      className={cn("h-7 text-xs px-2.5", printPeriodoDias === d && "bg-blue-600 font-bold text-white")}
                    >
                      {d} {d === 1 ? 'Dia' : 'Dias'}
                    </Button>
                  ))}
                </div>

                <div className="flex items-center gap-4 text-xs font-medium">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={printIncludeConsolidado}
                      onChange={(e) => setPrintIncludeConsolidado(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600"
                    />
                    <span>1. Consolidado Geral</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={printIncludeKits}
                      onChange={(e) => setPrintIncludeKits(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600"
                    />
                    <span>2. Kits de Aprazamento</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-600 dark:text-slate-400">
              Total a imprimir: <strong>{calculoImpressao.consolidadoPacientes.length}</strong> paciente(s) e <strong>{calculoImpressao.consolidadoMeds.length}</strong> medicamento(s) ({printPeriodoDias} {printPeriodoDias === 1 ? 'dia' : 'dias'}).
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setPrintPrescModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleExecutePrint}
                disabled={calculoImpressao.consolidadoPacientes.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                Imprimir Relatório (A4)
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── AREA DE IMPRESSÃO (A4 OCULTA NA TELA) ─────────────────────────── */}
      {(() => {
        const printData = calculoImpressao.consolidadoPacientes.length > 0 ? calculoImpressao : calculoPrevisao;
        const diasImpressao = printPeriodoDias || periodoDias;
        const alasTexto = printSelectedAlas.includes("all") 
          ? "Todas as Alas" 
          : (alas.filter(a => printSelectedAlas.includes(String(a.id))).map(a => a.nome).join(" + ") || "Alas Selecionadas");

        return (
          <div id="print-area" className="hidden print:block p-8 bg-white text-slate-900 font-sans">
            <div className="border-b-2 border-blue-900 pb-4 mb-6 flex justify-between items-end">
              <div>
                <h1 className="text-2xl font-black text-blue-950 uppercase tracking-tight">ZORION SAÚDE — PREVISÃO E SEPARAÇÃO DE MEDICAÇÃO FIXA</h1>
                <p className="text-xs text-slate-600 font-bold mt-1">
                  RELATÓRIO DE DISPENSAÇÃO CONTINUADA & APRAZAMENTO • PREVISÃO PARA {diasImpressao} {diasImpressao === 1 ? 'DIA' : 'DIAS'}
                </p>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Setor / Ala(s): <strong>{alasTexto}</strong>
                </p>
              </div>
              <div className="text-right text-xs text-slate-600 font-mono">
                <p>Emissão: <strong>{format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</strong></p>
                <p>Pacientes Selecionados: <strong>{printData.totalPacientesComMedicao}</strong></p>
                <p>Prescrições Ativas: <strong>{printData.totalPrescricoesAtivas}</strong></p>
              </div>
            </div>

            {/* Consolidado Global de Pedido */}
            {printIncludeConsolidado && (
              <div className="mb-8">
                <h2 className="text-base font-bold uppercase border-b border-slate-300 pb-1 mb-3 text-blue-900">
                  1. Consolidado Geral para Compras e Separação ({diasImpressao} {diasImpressao === 1 ? 'Dia' : 'Dias'})
                </h2>
                <table className="w-full text-left border-collapse border border-slate-300 text-xs">
                  <thead>
                    <tr className="bg-slate-200 text-slate-900 font-bold uppercase">
                      <th className="border border-slate-300 p-2">Código</th>
                      <th className="border border-slate-300 p-2">Medicamento / Concentração</th>
                      <th className="border border-slate-300 p-2 text-center">Consumo Diário</th>
                      <th className="border border-slate-300 p-2 text-center">Total {diasImpressao}D</th>
                      <th className="border border-slate-300 p-2 text-center">Estoque Atual</th>
                      <th className="border border-slate-300 p-2 text-center">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printData.consolidadoMeds.map(item => (
                      <tr key={item.medicamentoId}>
                        <td className="border border-slate-300 p-2 font-mono">{item.codigo || "-"}</td>
                        <td className="border border-slate-300 p-2 font-bold">{item.nome} {item.concentracao ? `(${item.concentracao})` : ""}</td>
                        <td className="border border-slate-300 p-2 text-center font-mono">{item.qtdDiaria}</td>
                        <td className="border border-slate-300 p-2 text-center font-mono font-bold text-blue-900">{item.qtdPeriodo}</td>
                        <td className="border border-slate-300 p-2 text-center font-mono">{item.estoqueAtual}</td>
                        <td className="border border-slate-300 p-2 text-center font-bold">
                          {item.suficiente ? "SUFICIENTE" : `FALTA ${item.diferenca}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Fichas por Paciente */}
            {printIncludeKits && (
              <div>
                <h2 className="text-base font-bold uppercase border-b border-slate-300 pb-1 mb-3 text-blue-900">
                  2. Kits de Aprazamento por Paciente / Leito ({diasImpressao} {diasImpressao === 1 ? 'Dia' : 'Dias'})
                </h2>
                {printData.consolidadoPacientes.map(pac => (
                  <div key={pac.pacienteId} className="mb-6 border border-slate-400 p-4 rounded-md [break-inside:avoid] page-break">
                    <div className="flex justify-between border-b border-slate-300 pb-2 mb-2">
                      <span className="font-bold text-sm uppercase">{pac.nome} — Prontuário: {pac.prontuario}</span>
                      <span className="font-mono text-xs">Setor: {pac.alaNome} • Leito: ({pac.leito})</span>
                    </div>
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 font-bold border-b border-slate-300">
                          <th className="py-1">Medicamento</th>
                          <th className="py-1 text-center">Grade (08h - 14h - 22h - 06h)</th>
                          <th className="py-1 text-center">Diário</th>
                          <th className="py-1 text-right">Total {diasImpressao}D</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pac.prescricoes.map(pr => {
                          const d08 = getDoseForHora(pr.horarios, "08:00");
                          const d14 = getDoseForHora(pr.horarios, "14:00");
                          const d22 = getDoseForHora(pr.horarios, "22:00");
                          const d06 = getDoseForHora(pr.horarios, "06:00");

                          return (
                            <tr key={pr.id} className="border-b border-slate-200">
                              <td className="py-1 font-semibold">
                                {pr.medNome} {pr.medConcentracao ? `(${pr.medConcentracao})` : (pr.concentracao ? `(${pr.concentracao})` : "")}
                                {pr.tipoFrequencia === 'intervalo_dias' && (
                                  <span className="text-[10px] text-indigo-700 font-bold ml-1.5">(A cada {pr.intervaloDias || 1} dias)</span>
                                )}
                              </td>
                              <td className="py-1 text-center font-mono">{d08} - {d14} - {d22} - {d06}</td>
                              <td className="py-1 text-center font-mono">{pr.totalDiario}</td>
                              <td className="py-1 text-right font-mono font-bold">{pr.qtdPeriodo}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ─── MODAL DE CONFIRMAÇÃO DE ALTA ─────────────────────────── */}
      <Dialog open={altaModalOpen} onOpenChange={setAltaModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Dar Alta Hospitalar</DialogTitle>
            <DialogDescription>
              Selecione o tipo de alta e a necessidade de levar medicação para casa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo de Alta</Label>
              <Select value={altaTipo} onValueChange={(val) => {
                setAltaTipo(val);
                if (val === "Alta a Pedido" || val === "Óbito" || val === "Evasão") {
                  setAltaDiasMedicao(0);
                }
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Alta Médica">Alta Médica</SelectItem>
                  <SelectItem value="Alta a Pedido">Alta a Pedido</SelectItem>
                  <SelectItem value="Transferência">Transferência</SelectItem>
                  <SelectItem value="Evasão">Evasão</SelectItem>
                  <SelectItem value="Óbito">Óbito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {altaTipo !== "Alta a Pedido" && altaTipo !== "Óbito" && altaTipo !== "Evasão" && (
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <Label>Kit de Separação (Dias de Medicação para levar)</Label>
                <Input 
                  type="number" 
                  min="0" 
                  value={altaDiasMedicao} 
                  onChange={e => setAltaDiasMedicao(Number(e.target.value))} 
                />
                <p className="text-xs text-slate-500">
                  Se maior que zero, um relatório de separação será gerado. O estoque <strong>NÃO</strong> será baixado automaticamente, você usará o relatório para separar na Farmácia.
                </p>
              </div>
            )}

            {/* Nova Seção de Devolução na Alta */}
            <div className="space-y-3 border-t border-slate-200 dark:border-slate-700 pt-4 mt-2">
              <Label className="font-bold text-indigo-700 flex items-center gap-1.5">
                <Undo2 className="w-4 h-4" />
                Devolução Rápida (Opcional)
              </Label>
              <p className="text-xs text-slate-500 mb-2">
                Se o paciente está devolvendo medicações neste momento, informe abaixo. As quantidades serão repostas no Estoque Satélite.
              </p>
              
              <div className="max-h-[220px] overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-md">
                <Table className="text-xs w-full">
                  <TableHeader className="bg-slate-100 dark:bg-slate-800 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="font-bold py-2">Medicamento</TableHead>
                      <TableHead className="font-bold py-2 text-center w-20">Qtd (un)</TableHead>
                      <TableHead className="font-bold py-2 w-1/3">Motivo / Horários</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prescricoes.filter(pr => (pr.pacienteId === altaPacienteId || pr.paciente_id === altaPacienteId) && (pr.status === "Ativa" || !pr.status)).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-4 text-slate-400">Nenhuma medicação ativa.</TableCell>
                      </TableRow>
                    ) : (
                      prescricoes.filter(pr => (pr.pacienteId === altaPacienteId || pr.paciente_id === altaPacienteId) && (pr.status === "Ativa" || !pr.status)).map(pr => (
                        <TableRow key={pr.id}>
                          <TableCell className="font-medium max-w-[240px] min-w-[150px] break-words whitespace-normal [overflow-wrap:anywhere] [word-break:break-word] leading-snug">
                            {pr.medicamentoNome}
                            {(() => {
                              const med = medicamentos.find(m => m.id === (pr.medicamentoId || pr.medicamento_id));
                              const rawC = (pr.concentracao || med?.concentracao || (med?.unidade_medida && !["un", "unidade", "unid", "-", ""].includes(med?.unidade_medida?.toLowerCase()) ? med?.unidade_medida : "") || "").trim();
                              const hasC = rawC && pr.medicamentoNome?.toLowerCase().includes(rawC.toLowerCase());
                              return rawC && !hasC ? ` (${rawC})` : "";
                            })()}
                          </TableCell>
                          <TableCell className="p-1">
                            <Input
                              type="number"
                              min="0"
                              placeholder="0"
                              className="h-7 text-xs text-center"
                              value={altaDevolucoes[pr.id]?.qtd || ""}
                              onChange={e => {
                                const val = e.target.value;
                                setAltaDevolucoes(prev => ({
                                  ...prev,
                                  [pr.id]: { ...(prev[pr.id] || {}), qtd: val }
                                }));
                              }}
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Input
                              placeholder="Ex: Não tomou às 14h"
                              className="h-7 text-xs"
                              value={altaDevolucoes[pr.id]?.motivo || ""}
                              onChange={e => {
                                const val = e.target.value;
                                setAltaDevolucoes(prev => ({
                                  ...prev,
                                  [pr.id]: { ...(prev[pr.id] || {}), motivo: val }
                                }));
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAltaModalOpen(false)}>Cancelar</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => darAltaPacienteMutation.mutate({ pacienteId: altaPacienteId, tipo: altaTipo, dias: altaDiasMedicao, devolucoes: altaDevolucoes })}
              disabled={darAltaPacienteMutation.isPending}
            >
              {darAltaPacienteMutation.isPending ? "Registrando Alta..." : "Confirmar Alta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL RELATÓRIO DE ALTA ─────────────────────────── */}
      <Dialog open={!!altaReportData} onOpenChange={() => setAltaReportData(null)}>
        <DialogContent className="max-w-3xl print:max-w-none print:w-screen print:h-screen print:m-0 print:border-none print:shadow-none print:p-0">
          <DialogHeader className="no-print">
            <DialogTitle>Relatório de Separação - Alta Hospitalar</DialogTitle>
          </DialogHeader>
          <div id="print-alta-area" className="p-6 bg-white text-slate-900 mt-2 print:absolute print:inset-0 print:p-12 print:block">
            <div className="border-b-2 border-indigo-900 pb-4 mb-6 flex justify-between items-end">
              <div>
                <h1 className="text-xl font-black text-indigo-950 uppercase tracking-tight">KITS DE ALTA — {altaReportData?.tipo?.toUpperCase()}</h1>
                <p className="text-sm font-bold text-slate-600 mt-1">Paciente: {altaReportData?.pac?.nome}</p>
                <p className="text-xs text-slate-600 font-mono">Prontuário: {altaReportData?.pac?.prontuario} • Leito: {altaReportData?.pac?.leito}</p>
              </div>
              <div className="text-right text-xs text-slate-600 font-mono">
                <p>Emissão: <strong>{format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</strong></p>
                <p>Medicação para: <strong>{altaReportData?.dias} Dias</strong></p>
              </div>
            </div>
            <Table className="border border-slate-300 w-full text-xs">
              <TableHeader className="bg-slate-100">
                <TableRow>
                  <TableHead className="font-bold border border-slate-300">Medicamento</TableHead>
                  <TableHead className="font-bold text-center border border-slate-300">Posologia</TableHead>
                  <TableHead className="font-bold text-center border border-slate-300">Total ({altaReportData?.dias}D)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {altaReportData?.relatorioAlta?.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="border border-slate-300 font-medium">{item.medNome}</TableCell>
                    <TableCell className="border border-slate-300 text-center font-mono">{item.posologia}</TableCell>
                    <TableCell className="border border-slate-300 text-center font-bold text-indigo-700 font-mono text-base">{item.total} un</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="mt-12 pt-8 border-t border-slate-300 grid grid-cols-2 gap-8 text-center text-xs">
              <div>
                <div className="border-b border-slate-400 w-48 mx-auto mb-1"></div>
                <p>Farmacêutico Responsável</p>
              </div>
              <div>
                <div className="border-b border-slate-400 w-48 mx-auto mb-1"></div>
                <p>Paciente ou Responsável</p>
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4 no-print">
            <Button variant="outline" onClick={() => setAltaReportData(null)}>Fechar</Button>
            <Button onClick={() => window.print()} className="gap-2">
              <Printer className="w-4 h-4" />
              Imprimir Relatório de Alta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: DEVOLUÇÃO DE MEDICAÇÃO ──────────────────────────────────── */}
      <Dialog open={devolucaoModalOpen} onOpenChange={setDevolucaoModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-indigo-700 flex items-center gap-2">
              <Undo2 className="w-5 h-5 text-indigo-600" />
              Devolução de Medicação
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900 p-3 rounded-lg text-xs text-indigo-900 dark:text-indigo-300">
              <p className="font-bold">Reposição na Farmácia Satélite</p>
              <p className="mt-1">
                Ao confirmar, a quantidade informada será somada ao estoque da <strong>Farmácia Satélite</strong> e a prescrição passará para o status "Devolvida" no histórico do paciente.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label className="font-bold">Medicação a Devolver</Label>
                <Input value={devolucaoPresc?.medicamentoNome || ""} disabled className="bg-slate-100" />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="font-bold">Qtd Devolvida (un) *</Label>
                  <Input
                    type="number"
                    placeholder="Ex: 2"
                    value={devolucaoQtd}
                    onChange={(e) => setDevolucaoQtd(e.target.value)}
                    min="1"
                  />
                </div>
                <div>
                  <Label className="font-bold">Motivo da Devolução</Label>
                  <Select value={devolucaoTipo} onValueChange={setDevolucaoTipo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Alta a Pedido">Alta a Pedido</SelectItem>
                      <SelectItem value="Alta Médica">Alta Médica</SelectItem>
                      <SelectItem value="Terapia Suspensa">Terapia Suspensa</SelectItem>
                      <SelectItem value="Trocado para Injetável">Trocado para Injetável</SelectItem>
                      <SelectItem value="Recusa do Paciente">Recusa do Paciente</SelectItem>
                      <SelectItem value="Óbito">Óbito</SelectItem>
                      <SelectItem value="Outro">Outro...</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="font-bold text-slate-800 dark:text-slate-200">
                  Detalhes / Horários (Opcional)
                </Label>
                <Textarea
                  placeholder="Ex: Devolveu medicamentos das 14h em diante, paciente teve alta às 10h."
                  value={devolucaoMotivo}
                  onChange={(e) => setDevolucaoMotivo(e.target.value)}
                  className="mt-1.5 min-h-[70px]"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex justify-between items-center border-t border-slate-200 dark:border-slate-800 pt-3">
            <Button variant="outline" onClick={() => setDevolucaoModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2 shadow-sm"
              disabled={efetuarDevolucaoMutation.isPending || !devolucaoQtd || parseInt(devolucaoQtd, 10) <= 0}
              onClick={() => {
                efetuarDevolucaoMutation.mutate({
                  presc: devolucaoPresc,
                  qtd: devolucaoQtd,
                  tipo: devolucaoTipo,
                  motivo: devolucaoMotivo.trim()
                });
              }}
            >
              <Undo2 className="w-4 h-4" />
              {efetuarDevolucaoMutation.isPending ? "Devolvendo..." : "Confirmar Devolução"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: TRANSFERÊNCIA DE PACIENTES ENTRE ALAS (X → Y) ─────────── */}
      <Dialog open={transferModalOpen} onOpenChange={setTransferModalOpen}>
        <DialogContent className="sm:max-w-[620px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-900 text-white">
            <DialogTitle className="text-xl font-bold flex items-center gap-2.5 text-white">
              <div className="p-2 bg-indigo-500/30 rounded-lg border border-indigo-400/30">
                <ArrowLeftRight className="w-5 h-5 text-indigo-200" />
              </div>
              Transferência de Pacientes entre Alas
            </DialogTitle>
            <DialogDescription className="text-indigo-200 text-xs mt-1">
              Transfira pacientes e atualize suas prescrições ativas da <strong>Ala de Origem (X)</strong> para a <strong>Ala de Destino (Y)</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Box de Seleção de Alas Origem e Destino */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                {/* Ala Origem (X) */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    Ala de Origem (X)
                  </Label>
                  <Select value={transferOriginAlaId} onValueChange={handleOriginAlaChange}>
                    <SelectTrigger className="bg-white dark:bg-slate-950 font-medium">
                      <SelectValue placeholder="Selecione a ala de origem..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as Alas (Geral)</SelectItem>
                      {alas.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Ala Destino (Y) */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-500" />
                    Ala de Destino (Y) *
                  </Label>
                  <Select value={transferTargetAlaId} onValueChange={setTransferTargetAlaId}>
                    <SelectTrigger className="bg-white dark:bg-slate-950 border-indigo-300 dark:border-indigo-700 font-bold text-indigo-900 dark:text-indigo-200">
                      <SelectValue placeholder="Selecione a ala de destino..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableTargetAlas.map(a => (
                        <SelectItem key={a.id} value={a.id} className="font-medium">{a.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Seleção de Pacientes */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                  Pacientes a Transferir ({transferSelectedPatientIds.length} selecionado(s))
                </Label>
                {candidatesForTransfer.length > 1 && (
                  <div className="space-x-2">
                    <button
                      type="button"
                      onClick={() => setTransferSelectedPatientIds(candidatesForTransfer.map(p => p.id))}
                      className="text-xs text-indigo-600 hover:underline font-semibold"
                    >
                      Selecionar Todos
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setTransferSelectedPatientIds([])}
                      className="text-xs text-slate-500 hover:underline font-semibold"
                    >
                      Desmarcar
                    </button>
                  </div>
                )}
              </div>

              {candidatesForTransfer.length === 0 ? (
                <div className="text-center py-6 border border-dashed rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-400 text-sm">
                  Nenhum paciente encontrado na ala de origem selecionada.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-950">
                  {candidatesForTransfer.map(p => {
                    const checked = transferSelectedPatientIds.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className={cn(
                          "flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors",
                          checked && "bg-indigo-50/60 dark:bg-indigo-950/20"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setTransferSelectedPatientIds(prev => [...prev, p.id]);
                              } else {
                                setTransferSelectedPatientIds(prev => prev.filter(id => id !== p.id));
                              }
                            }}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          <div>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{p.nome}</p>
                            <p className="text-xs text-slate-500">
                              Pront: {p.prontuario} • Ala: {p.alaNome || "Geral"} • Leito: {p.leito || "S/L"}
                            </p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[11px] font-mono">
                          {p.leito || "S/L"}
                        </Badge>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Gestão do Leito na Ala de Destino */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
              {transferSelectedPatientIds.length === 1 ? (
                <div className="space-y-1.5">
                  <Label className="font-bold text-xs text-slate-700 dark:text-slate-300">
                    Novo Leito na Ala de Destino:
                  </Label>
                  <Input
                    placeholder="Ex: Leito 10, Box 02..."
                    value={transferSingleLeito}
                    onChange={(e) => setTransferSingleLeito(e.target.value)}
                    className="bg-white dark:bg-slate-950"
                  />
                  <p className="text-[11px] text-slate-500">
                    O leito do paciente e de suas prescrições será atualizado para este valor.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="font-bold text-xs text-slate-700 dark:text-slate-300">
                    Leito dos Pacientes no Destino:
                  </Label>
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="leitoStrategy"
                        value="keep"
                        checked={transferLeitoStrategy === "keep"}
                        onChange={() => setTransferLeitoStrategy("keep")}
                        className="text-indigo-600"
                      />
                      <span>Manter os leitos atuais de cada paciente</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Motivo da Transferência */}
            <div className="space-y-1.5">
              <Label className="font-bold text-xs text-slate-700 dark:text-slate-300">
                Motivo / Observação da Transferência (Opcional):
              </Label>
              <Input
                placeholder="Ex: Transferência clínica, alta da UTI para enfermaria, isolamento..."
                value={transferMotivo}
                onChange={(e) => setTransferMotivo(e.target.value)}
                className="bg-white dark:bg-slate-950"
              />
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex justify-between items-center">
            <Button variant="outline" onClick={() => setTransferModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={
                !transferTargetAlaId || 
                transferSelectedPatientIds.length === 0 || 
                transferPatientMutation.isPending
              }
              onClick={() => {
                transferPatientMutation.mutate({
                  patientIds: transferSelectedPatientIds,
                  targetAlaId: transferTargetAlaId,
                  leitoStrategy: transferLeitoStrategy,
                  singleLeito: transferSingleLeito,
                  motivo: transferMotivo
                });
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2 shadow-sm"
            >
              <ArrowLeftRight className="w-4 h-4" />
              {transferPatientMutation.isPending 
                ? "Transferindo..." 
                : `Confirmar Transferência (${transferSelectedPatientIds.length})`
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL DE SENHA DE SEGURANÇA (FASE DE TESTES: SENHA 102030) ─────────── */}
      <Dialog open={senhaBaixaModalOpen} onOpenChange={setSenhaBaixaModalOpen}>
        <DialogContent className="sm:max-w-[480px] border-2 border-red-500 bg-white dark:bg-slate-950 shadow-2xl p-0 overflow-hidden">
          <div className="bg-red-600 dark:bg-red-950 p-5 text-white flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-xs">
              <ShieldAlert className="w-7 h-7 text-white animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-wide uppercase">
                ACESSO RESTRITO • FASE DE TESTES
              </h2>
              <p className="text-xs text-red-100 font-medium">
                Auditoria de Estoque da Farmácia Satélite
              </p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl text-amber-900 dark:text-amber-200 text-xs leading-relaxed space-y-1.5 font-medium">
              <p className="font-bold flex items-center gap-1.5 text-amber-950 dark:text-amber-100">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                AVISO DE AUDITORIA E CONTROLE DE DISPENSAÇÃO:
              </p>
              <p>
                O sistema de confirmação de baixa está em <strong>FASE DE HOMOLOGAÇÃO RESTRITA</strong>. A confirmação debitará o estoque físico e registrará logs auditáveis no banco de dados.
              </p>
              <p className="text-[11px] text-red-700 dark:text-red-300 font-bold">
                ⚠️ Tentativas com senha incorreta serão bloqueadas e registradas.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-red-600" />
                Para liberar a baixa, insira a senha autorizada:
              </label>
              <Input
                type="password"
                autoFocus
                placeholder="Insira a senha de liberação..."
                value={senhaBaixaInput}
                onChange={(e) => {
                  setSenhaBaixaInput(e.target.value);
                  if (senhaBaixaError) setSenhaBaixaError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleConfirmarSenhaBaixa();
                  }
                }}
                className={cn(
                  "h-11 text-center font-mono text-lg tracking-widest font-black border-2",
                  senhaBaixaError
                    ? "border-red-500 bg-red-50/50 text-red-900 focus-visible:ring-red-400"
                    : "border-slate-300 focus-visible:ring-indigo-500"
                )}
              />
              {senhaBaixaError && (
                <p className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1 mt-1 animate-bounce">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  {senhaBaixaError}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSenhaBaixaModalOpen(false);
                setSenhaBaixaInput("");
                setSenhaBaixaError("");
                setBaixaPendingAction(null);
              }}
              className="font-bold text-xs"
            >
              Cancelar e Bloquear
            </Button>
            <Button
              type="button"
              onClick={handleConfirmarSenhaBaixa}
              className="bg-red-600 hover:bg-red-700 text-white font-black text-xs gap-1.5 shadow-md px-5"
            >
              <Lock className="w-3.5 h-3.5" />
              Liberar Baixa no Estoque
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; background-color: white !important; }
          ${altaReportData ? `
            body:not(.printing-separacao-lote) * { visibility: hidden; }
            body:not(.printing-separacao-lote) [role="dialog"], body:not(.printing-separacao-lote) [role="dialog"] * { visibility: visible !important; }
            body:not(.printing-separacao-lote) [role="dialog"] { position: absolute; left:0; top:0; width: 100%; height: 100%; margin: 0; padding: 0; }
          ` : `
            body:not(.printing-separacao-lote) * { visibility: hidden; }
            body:not(.printing-separacao-lote) [role="dialog"], body:not(.printing-separacao-lote) .dialog-overlay { display: none !important; visibility: hidden !important; }
            body:not(.printing-separacao-lote) #print-area, body:not(.printing-separacao-lote) #print-area * { visibility: visible !important; }
            body:not(.printing-separacao-lote) #print-area { display: block !important; position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; }
          `}
          body.printing-separacao-lote #print-area, body.printing-separacao-lote #print-area * { display: none !important; visibility: hidden !important; }
          .no-print, nav, header, footer, button { display: none !important; }
          .page-break { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
