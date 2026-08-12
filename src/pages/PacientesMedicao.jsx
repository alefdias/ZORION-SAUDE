import { useState, useMemo } from "react";
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
import { ComboboxMedicamento } from "@/components/ui/combobox-medicamento";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { isMav } from "@/utils/mavUtils";
import { 
  Users, 
  Pill, 
  CalendarDays, 
  Plus, 
  Search, 
  Pencil, 
  Trash2, 
  Printer, 
  CheckCircle2, 
  AlertTriangle, 
  PackageMinus, 
  Clock, 
  Bed, 
  Building2,
  FileCheck,
  RefreshCw,
  Power,
  Eye,
  FileText,
  LogOut,
  Undo2
} from "lucide-react";

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

export default function PacientesMedicao() {
  const queryClient = useQueryClient();

  const [activeMainTab, setActiveMainTab] = useState("pacientes");
  const [reportSubTab, setReportSubTab] = useState("consolidado");
  const [periodoDias, setPeriodoDias] = useState(1);
  const [searchPatient, setSearchPatient] = useState("");
  const [filterAla, setFilterAla] = useState("all");
  const [searchPrescription, setSearchPrescription] = useState("");

  // Modais State
  const [viewPatientDetails, setViewPatientDetails] = useState(null);
  const [patientModalOpen, setPatientModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [patientFormData, setPatientFormData] = useState({
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
    dose08: "1",
    dose14: "0",
    dose22: "2",
    dose06: "2",
    esquemaPosologico: "1-0-2-2",
    dataInicio: format(new Date(), "yyyy-MM-dd"),
    dataFim: "",
    status: "Ativa",
    observacoes: ""
  });

  const [baixaModalOpen, setBaixaModalOpen] = useState(false);
  const [selectedPatientIds, setSelectedPatientIds] = useState([]);
  const [batchBaixaModalOpen, setBatchBaixaModalOpen] = useState(false);
  const [batchBaixaDias, setBatchBaixaDias] = useState(1);

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

  // Queries
  const { data: pacientes = [], isLoading: loadingPacientes } = useQuery({
    queryKey: ['pacientes'],
    queryFn: () => db.entities.Paciente.list(),
  });

  const { data: prescricoes = [], isLoading: loadingPrescricoes } = useQuery({
    queryKey: ['prescricoes_paciente'],
    queryFn: () => db.entities.PrescricaoPaciente.list(),
  });

  const { data: medicamentos = [], isLoading: loadingMeds } = useQuery({
    queryKey: ['medicamentos'],
    queryFn: () => db.entities.Medicamento.list(),
  });

  // Apenas medicamentos com estoque positivo na farmácia/satélite podem ser cadastrados em prescrições
  const medicamentosComEstoque = useMemo(() => {
    return (medicamentos || []).filter(m => (m.estoque_atual || 0) > 0 || (m.estoque_satelite || 0) > 0);
  }, [medicamentos]);

  const { data: lotes = [] } = useQuery({
    queryKey: ['lotes'],
    queryFn: () => db.entities.Lote.list(),
  });

  const { data: alas = [] } = useQuery({
    queryKey: ['alas'],
    queryFn: () => db.entities.Ala.list(),
  });

  // Patient Mutations
  const savePatientMutation = useMutation({
    mutationFn: async (data) => {
      if (editingPatient) {
        return db.entities.Paciente.update(editingPatient.id, data);
      }
      return db.entities.Paciente.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pacientes'] });
      setPatientModalOpen(false);
      setEditingPatient(null);
      toast.success(editingPatient ? "Paciente atualizado com sucesso!" : "Paciente cadastrado com sucesso!");
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
      const patient = pacientes.find(p => p.id === data.pacienteId);
      const med = medicamentos.find(m => m.id === data.medicamentoId);

      if (!med) {
        throw new Error("Apenas medicamentos já cadastrados no sistema podem ser selecionados para a prescrição.");
      }

      const d08 = parseInt(data.dose08) || 0;
      const d14 = parseInt(data.dose14) || 0;
      const d22 = parseInt(data.dose22) || 0;
      const d06 = parseInt(data.dose06) || 0;
      const totalDiario = d08 + d14 + d22 + d06;
      const esquema = `${d08}-${d14}-${d22}-${d06}`;

      const payload = {
        ...data,
        pacienteNome: patient ? patient.nome : "Paciente não informado",
        prontuario: patient ? patient.prontuario : "",
        alaNome: patient ? patient.alaNome : "",
        leito: patient ? patient.leito : "",
        medicamentoNome: med ? med.nome : "Medicamento não informado",
        medicamentoCodigo: med ? med.codigo : "",
        apresentacao: med ? med.apresentacao : "",
        dosagem: med ? (med.dosagem || med.concentracao || "") : "",
        esquemaPosologico: esquema,
        totalDiario: totalDiario,
        horarios: JSON.stringify([
          { hora: "08:00", turno: "Manhã", dose: d08 },
          { hora: "14:00", turno: "Tarde", dose: d14 },
          { hora: "22:00", turno: "Noite", dose: d22 },
          { hora: "06:00", turno: "Madrugada/Manhã", dose: d06 },
        ])
      };

      if (editingPresc) {
        return db.entities.PrescricaoPaciente.update(editingPresc.id, payload);
      }
      return db.entities.PrescricaoPaciente.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescricoes_paciente'] });
      setPrescModalOpen(false);
      setEditingPresc(null);
      toast.success("Prescrição fixa salva com sucesso!");
    },
    onError: (err) => toast.error("Erro ao salvar prescrição: " + (err?.message || (typeof err === "string" ? err : "Erro desconhecido")))
  });

  const togglePrescStatusMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const newStatus = status === "Ativa" ? "Suspensa" : "Ativa";
      return db.entities.PrescricaoPaciente.update(id, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescricoes_paciente'] });
      toast.success("Status da prescrição alterado!");
    }
  });

  const deletePrescMutation = useMutation({
    mutationFn: (id) => db.entities.PrescricaoPaciente.delete(id),
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
      for (const item of itensConsolidados) {
        const med = medicamentos.find(m => m.id === item.medicamentoId);
        if (med) {
          let remQtd = item.qtdPeriodo;
          let newSatelite = med.estoque_satelite || 0;
          let newGeral = med.estoque_atual || 0;

          if (newSatelite > 0) {
            if (newSatelite >= remQtd) {
              newSatelite -= remQtd;
              remQtd = 0;
            } else {
              remQtd -= newSatelite;
              newSatelite = 0;
            }
          }
          if (remQtd > 0) {
            newGeral = Math.max(0, newGeral - remQtd);
          }

          await db.entities.Medicamento.update(med.id, {
            estoque_satelite: newSatelite,
            estoque_atual: newGeral
          });

          const loteDoMed = lotes.find(l => (l.medicamento_id === med.id || l.medicamentoId === med.id));
          if (loteDoMed) {
            const novaQtdLote = Math.max(0, (loteDoMed.quantidade_atual || 0) - item.qtdPeriodo);
            await db.entities.Lote.update(loteDoMed.id, {
              quantidade_atual: novaQtdLote,
              status: novaQtdLote <= 0 ? "esgotado" : loteDoMed.status
            });
          }

          const loteId = loteDoMed ? loteDoMed.id : (lotes[0]?.id || "lote_fixo");
          const numeroLote = loteDoMed ? loteDoMed.numero_lote : "Saída Fixa Continuada";

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
            created_at: nowStr
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
    mutationFn: async ({ patientIds, dias }) => {
      const nowStr = new Date().toISOString();
      const todayDateStr = getLocalDateString();
      const selectedPacs = pacientes.filter(p => patientIds.includes(p.id));
      const activePrescs = prescricoes.filter(pr => {
        const pId = pr.pacienteId || pr.paciente_id;
        const status = pr.status || "Ativa";
        return patientIds.includes(pId) && status === "Ativa";
      });

      const medDeductions = {};

      for (const pr of activePrescs) {
        const pacId = pr.pacienteId || pr.paciente_id;
        const medId = pr.medicamentoId || pr.medicamento_id;
        const pac = selectedPacs.find(p => p.id === pacId);
        const med = medicamentos.find(m => m.id === medId);

        // Calcular a dose diária
        const d08 = getDoseForHora(pr.horarios, "08:00");
        const d14 = getDoseForHora(pr.horarios, "14:00");
        const d22 = getDoseForHora(pr.horarios, "22:00");
        const d06 = getDoseForHora(pr.horarios, "06:00");
        const calculatedDaily = d08 + d14 + d22 + d06;
        const dailyTotal = calculatedDaily > 0 ? calculatedDaily : (pr.totalDiario || 0);

        const qtdSaida = dailyTotal * dias;

        if (qtdSaida <= 0) continue;

        // Acumular total por medicação para decrementar do estoque
        medDeductions[medId] = (medDeductions[medId] || 0) + qtdSaida;

        const loteDoMed = lotes.find(l => (l.medicamento_id === medId || l.medicamentoId === medId));
        const loteId = loteDoMed ? loteDoMed.id : (lotes[0]?.id || "lote_fixo");
        const numeroLote = loteDoMed ? loteDoMed.numero_lote : "Saída Fixa Paciente";

        // Criar registro de Saída no db.entities.Saida para aparecer na tela de Saída
        await db.entities.Saida.create({
          medicamento_id: medId,
          medicamento_nome: pr.medicamentoNome || pr.medicamento_nome || (med ? med.nome : "Medicamento"),
          lote_id: loteId,
          numero_lote: numeroLote,
          quantidade: qtdSaida,
          destino: pac ? `Paciente ${pac.nome} (Leito: ${pac.leito || "S/L"})` : "Paciente",
          paciente_nome: pac ? pac.nome : "",
          ala_id: pac?.alaId || pac?.ala_id || null,
          ala_nome: pac ? (pac.alaNome || pac.ala_nome || "Ala Geral") : "Geral",
          motivo: `Baixa de medicação fixa (${dias} ${dias === 1 ? 'dia' : 'dias'}) - Paciente: ${pac?.nome || "Paciente"} (Pront: ${pac?.prontuario || "N/A"})`,
          observacao: `Dispensação de medicação fixa: ${pr.esquemaPosologico || 'Grade 4 Horários'}`,
          data_saida: todayDateStr,
          created_at: nowStr
        });
      }

      // Atualizar estoque_satelite, estoque_atual e lote de cada medicamento deduzido
      for (const [medId, totalQtd] of Object.entries(medDeductions)) {
        const med = medicamentos.find(m => m.id === medId);
        if (med) {
          let remQtd = totalQtd;
          let newSatelite = med.estoque_satelite || 0;
          let newGeral = med.estoque_atual || 0;

          if (newSatelite > 0) {
            if (newSatelite >= remQtd) {
              newSatelite -= remQtd;
              remQtd = 0;
            } else {
              remQtd -= newSatelite;
              newSatelite = 0;
            }
          }
          if (remQtd > 0) {
            newGeral = Math.max(0, newGeral - remQtd);
          }

          await db.entities.Medicamento.update(medId, {
            estoque_satelite: newSatelite,
            estoque_atual: newGeral
          });

          const loteDoMed = lotes.find(l => (l.medicamento_id === medId || l.medicamentoId === medId));
          if (loteDoMed) {
            const novaQtdLote = Math.max(0, (loteDoMed.quantidade_atual || 0) - totalQtd);
            await db.entities.Lote.update(loteDoMed.id, {
              quantidade_atual: novaQtdLote,
              status: novaQtdLote <= 0 ? "esgotado" : loteDoMed.status
            });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      queryClient.invalidateQueries({ queryKey: ['saidas'] });
      setBatchBaixaModalOpen(false);
      setSelectedPatientIds([]);
      toast.success("Baixa em lote concluída! As saídas foram registradas com sucesso no módulo de Saídas.");
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
      
      // Cria Entrada para constar no Livro Portaria e relatórios
      await db.entities.Entrada.create({
        medicamento_id: med.id,
        medicamento_nome: med.nome,
        fornecedor_nome: (pac ? `Devolução Paciente: ${pac.nome}` : "Devolução") + ` - ${tipo} ${motivo ? '('+motivo+')' : ''}`,
        lote_id: loteDoMed ? loteDoMed.id : null,
        numero_lote: loteDoMed ? loteDoMed.numero_lote : "DEVOLVIDO",
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
             
             // Criar Entrada no DB
             await db.entities.Entrada.create({
                medicamento_id: med.id,
                medicamento_nome: med.nome,
                fornecedor_nome: `Devolução Alta Paciente: ${pac.nome} - ${tipo} ${devMotivo ? '('+devMotivo+')' : ''}`,
                lote_id: loteDoMed ? loteDoMed.id : null,
                numero_lote: loteDoMed ? loteDoMed.numero_lote : "DEVOLVIDO",
                quantidade: devQtd,
                data_entrada: todayDateStr,
                created_at: nowStr
             });
             extraObs = ` [Devolução de ${devQtd}un: ${devMotivo || 'Alta'}]`;
          }
        }

        await db.entities.PrescricaoPaciente.update(pr.id, {
          status: devInfo && parseInt(devInfo.qtd, 10) > 0 ? "Devolvida" : "Suspensa",
          observacoes: (pr.observacoes || "") + ` [Suspensa por ${tipo.toUpperCase()}]${extraObs}`
        });
      }

      // 3. Registrar Log Auditado de Alta
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
        observacao: `Prescrições suspensas. Levar medicação: ${dias} dias.`,
        data_saida: todayDateStr,
        created_at: nowStr
      });

      return { pac, tipo, dias, relatorioAlta };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pacientes'] });
      queryClient.invalidateQueries({ queryKey: ['prescricoes_paciente'] });
      queryClient.invalidateQueries({ queryKey: ['saidas'] });
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

  // Handlers Modal Paciente
  const handleOpenNewPatient = () => {
    setEditingPatient(null);
    setPatientFormData({
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
    setPatientFormData({
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

  // Handlers Modal Prescrição
  const handleOpenNewPresc = (pacienteIdTarget = "") => {
    setEditingPresc(null);
    setPrescFormData({
      pacienteId: pacienteIdTarget,
      medicamentoId: "",
      dose08: "1",
      dose14: "0",
      dose22: "2",
      dose06: "2",
      esquemaPosologico: "1-0-2-2",
      dataInicio: format(new Date(), "yyyy-MM-dd"),
      dataFim: "",
      status: "Ativa",
      observacoes: ""
    });
    setPrescModalOpen(true);
  };

  const handleOpenEditPresc = (p) => {
    setEditingPresc(p);
    const d08 = getDoseForHora(p.horarios, "08:00");
    const d14 = getDoseForHora(p.horarios, "14:00");
    const d22 = getDoseForHora(p.horarios, "22:00");
    const d06 = getDoseForHora(p.horarios, "06:00");

    setPrescFormData({
      pacienteId: p.pacienteId || "",
      medicamentoId: p.medicamentoId || "",
      dose08: String(d08),
      dose14: String(d14),
      dose22: String(d22),
      dose06: String(d06),
      esquemaPosologico: p.esquemaPosologico || `${d08}-${d14}-${d22}-${d06}`,
      dataInicio: p.dataInicio || format(new Date(), "yyyy-MM-dd"),
      dataFim: p.dataFim || "",
      status: p.status || "Ativa",
      observacoes: p.observacoes || ""
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

  // Previsão de 7 Dias / Cálculo Consolidado (Exclui Pacientes em ALTA)
  const calculoPrevisao = useMemo(() => {
    const ativas = prescricoes.filter(p => {
      if (p.status !== "Ativa") return false;
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
        dosagem: p.dosagem || "-",
        estoque_atual: 0
      };

      const dailyDose = p.totalDiario || 0;
      const periodDose = dailyDose * periodoDias;

      // Group Meds
      if (!medMap[p.medicamentoId]) {
        medMap[p.medicamentoId] = {
          medicamentoId: p.medicamentoId,
          nome: med.nome,
          codigo: med.codigo,
          apresentacao: med.apresentacao,
          dosagem: med.dosagem || med.concentracao,
          estoqueAtual: med.estoque_atual || 0,
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

  const filteredPatients = useMemo(() => {
    const search = searchPatient.toLowerCase();
    return activePatients.filter(p => {
      const matchSearch = p.nome?.toLowerCase().includes(search) ||
        p.prontuario?.toLowerCase().includes(search) ||
        p.leito?.toLowerCase().includes(search) ||
        p.alaNome?.toLowerCase().includes(search);
        
      const matchAla = filterAla === "all" || p.alaId === filterAla || p.alaNome === filterAla;
      
      return matchSearch && matchAla;
    });
  }, [activePatients, searchPatient, filterAla]);

  const filteredAltaPatients = useMemo(() => {
    const search = searchAltaPatient.toLowerCase();
    return dischargedPatients.filter(p => 
      p.nome?.toLowerCase().includes(search) ||
      p.prontuario?.toLowerCase().includes(search) ||
      p.leito?.toLowerCase().includes(search) ||
      p.alaNome?.toLowerCase().includes(search)
    );
  }, [dischargedPatients, searchAltaPatient]);

  const filteredPrescriptions = prescricoes.filter(p =>
    p.pacienteNome?.toLowerCase().includes(searchPrescription.toLowerCase()) ||
    p.medicamentoNome?.toLowerCase().includes(searchPrescription.toLowerCase()) ||
    p.prontuario?.toLowerCase().includes(searchPrescription.toLowerCase()) ||
    p.esquemaPosologico?.includes(searchPrescription)
  );

  return (
    <div className="p-6 space-y-6 min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Pacientes & Medicação Fixa</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Controle de posologia (08-14-22-06h), requisições continuadas e relatórios de previsão para separação
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto no-print">
          <Button onClick={() => handleOpenNewPatient()} variant="outline" className="border-slate-300 dark:border-slate-700">
            <Users className="w-4 h-4 mr-2 text-blue-600" />
            Novo Paciente
          </Button>
          <Button onClick={() => handleOpenNewPresc()} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
            <Plus className="w-4 h-4 mr-2" />
            Nova Prescrição Fixa
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-[700px] mb-4">
          <TabsTrigger value="pacientes" className="flex items-center gap-2 font-bold">
            <Users className="w-4 h-4 text-blue-600" />
            Pacientes Ativos ({activePatients.length})
          </TabsTrigger>
          <TabsTrigger value="relatorio" className="flex items-center gap-2 font-bold">
            <CalendarDays className="w-4 h-4 text-emerald-600" />
            Relatório {periodoDias} Dias
          </TabsTrigger>
          <TabsTrigger value="altas" className="flex items-center gap-2 font-bold">
            <LogOut className="w-4 h-4 text-amber-600" />
            Pacientes de Alta ({dischargedPatients.length})
          </TabsTrigger>
        </TabsList>

        {/* ─── TAB 1: PACIENTES ────────────────────────────────────────────── */}
        <TabsContent value="pacientes" className="space-y-4">
          {selectedPatientIds.length > 0 && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <p className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                    {selectedPatientIds.length} paciente(s) selecionado(s)
                  </p>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    Clique no botão ao lado para dar baixa de uma só vez em todas as medicações ativas destes pacientes.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setSelectedPatientIds([])}
                  variant="ghost"
                  size="sm"
                  className="text-slate-600 dark:text-slate-300 hover:text-slate-900"
                >
                  Limpar Seleção
                </Button>

                <Button
                  onClick={() => setBatchBaixaModalOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 shadow-sm"
                >
                  <PackageMinus className="w-4 h-4" />
                  Dar Baixa em Lote ({selectedPatientIds.length})
                </Button>
              </div>
            </div>
          )}

          <Card className="p-4 border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex flex-col md:flex-row gap-4 items-center w-full">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="Buscar paciente por nome, prontuário, ala ou leito..."
                  value={searchPatient}
                  onChange={(e) => setSearchPatient(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="w-full md:w-[250px]">
                <Select value={filterAla} onValueChange={setFilterAla}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filtrar por Ala..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Alas</SelectItem>
                    {alas.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-100 dark:bg-slate-800">
                <TableRow>
                  <TableHead className="w-12 text-center">
                    <input
                      type="checkbox"
                      checked={filteredPatients.length > 0 && selectedPatientIds.length === filteredPatients.length}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPatientIds(filteredPatients.map(p => p.id));
                        } else {
                          setSelectedPatientIds([]);
                        }
                      }}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      title="Selecionar Todos os Pacientes"
                    />
                  </TableHead>
                  <TableHead>Prontuário</TableHead>
                  <TableHead>Nome do Paciente</TableHead>
                  <TableHead>Ala / Leito</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Medicações Ativas</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPacientes ? (
                  Array(4).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-6 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-16 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-12 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredPatients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500 font-medium">Nenhum paciente cadastrado ou encontrado.</p>
                      <Button onClick={handleOpenNewPatient} variant="link" className="mt-2 text-blue-600">
                        Cadastrar Primeiro Paciente
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPatients.map((p) => {
                    const activePrescsCount = prescricoes.filter(pr => pr.pacienteId === p.id && pr.status === "Ativa").length;
                    const isSelected = selectedPatientIds.includes(p.id);

                    return (
                      <TableRow key={p.id} className={cn("hover:bg-slate-50/80 dark:hover:bg-slate-800/50", isSelected && "bg-blue-50/50 dark:bg-blue-950/20")}>
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
                        <TableCell className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                          {p.prontuario}
                        </TableCell>
                        <TableCell>
                          <div>
                            <button
                              onClick={() => setViewPatientDetails(p)}
                              className="text-left font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5 group cursor-pointer"
                              title="Clique para ver o prontuário e prescrições completas"
                            >
                              <span>{p.nome}</span>
                              <FileText className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 text-blue-500" />
                            </button>
                            {p.observacoes && (
                              <p className="text-xs text-amber-600 dark:text-amber-400">Obs: {p.observacoes}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            <span>{p.alaNome || "Ala não informada"}</span>
                            <span className="font-semibold text-slate-800 dark:text-slate-200">• {p.leito || "S/L"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={p.status === "Ativo" ? "default" : "secondary"} className={p.status === "Ativo" ? "bg-emerald-600" : ""}>
                            {p.status || "Ativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge 
                            onClick={() => setViewPatientDetails(p)} 
                            variant="outline" 
                            className="font-bold text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:border-blue-800 cursor-pointer transition-colors"
                            title="Ver todas as prescrições"
                          >
                            {activePrescsCount} remédio(s)
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="ghost" onClick={() => setViewPatientDetails(p)} title="Ver Prontuário & Prescrições">
                            <Eye className="w-4 h-4 text-blue-600" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleOpenNewPresc(p.id)} title="Adicionar Medicação Fixa">
                            <Plus className="w-4 h-4 text-emerald-600" />
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
                            title="Dar Alta ao Paciente (Suspender todas as medicações e remover do relatório)"
                          >
                            <LogOut className="w-4 h-4 text-amber-600" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => {
                              setDeleteTarget({ type: 'paciente', id: p.id, name: p.nome });
                              setDeleteReason("");
                              setDeleteLogModalOpen(true);
                            }} 
                            title="Excluir Paciente (Solicita motivo e grava log)"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* ─── TAB 2: RELATÓRIO DE PREVISÃO (7 DIAS) ────────────────────────── */}
        <TabsContent value="relatorio" className="space-y-6">
          {/* Seletor de Período + Ações de Impressão e Baixa */}
          <Card className="p-5 border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="flex items-center gap-3">
                <CalendarDays className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">Período de Previsão de Consumo</h3>
                  <p className="text-xs text-slate-500">Cálculo de suprimento para requisição e montagem de kits hospitalares</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap no-print">
                <span className="text-xs font-semibold text-slate-600">Dias:</span>
                {[1, 7, 14, 30].map(dias => (
                  <Button
                    key={dias}
                    size="sm"
                    variant={periodoDias === dias ? "default" : "outline"}
                    onClick={() => setPeriodoDias(dias)}
                    className={periodoDias === dias ? "bg-blue-600 text-white" : ""}
                  >
                    {dias} {dias === 1 ? "Dia" : "Dias"}
                  </Button>
                ))}
                
                <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1" />

                <Button onClick={() => window.print()} variant="outline" className="gap-2 border-slate-300">
                  <Printer className="w-4 h-4" />
                  Imprimir Relatório ({periodoDias}D)
                </Button>
              </div>
            </div>
          </Card>

          {/* Sub-Tabs: Consolidado Compras vs Kits por Paciente */}
          <Tabs value={reportSubTab} onValueChange={setReportSubTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 max-w-[450px] mb-4">
              <TabsTrigger value="consolidado">Visão Consolidada (Pedido/Estoque)</TabsTrigger>
              <TabsTrigger value="pacientes">Visão por Paciente (Kits de Separação)</TabsTrigger>
            </TabsList>

            {/* VISÃO 1: CONSOLIDADO MEDS */}
            <TabsContent value="consolidado" className="space-y-4">
              <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-4 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    Consolidado Geral de Medicamentos para {periodoDias} Dias ({calculoPrevisao.consolidadoMeds.length} itens)
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    Total de Pacientes com Prescrição: {calculoPrevisao.totalPacientesComMedicao}
                  </span>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cód</TableHead>
                      <TableHead>Medicamento / Concentração</TableHead>
                      <TableHead className="text-center">Consumo Diário Total</TableHead>
                      <TableHead className="text-center bg-blue-50/50 dark:bg-blue-950/20 font-bold text-blue-900 dark:text-blue-300">
                        Necessário ({periodoDias} Dias)
                      </TableHead>
                      <TableHead className="text-center">Estoque Atual Farmácia</TableHead>
                      <TableHead className="text-center">Status do Suprimento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calculoPrevisao.consolidadoMeds.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                          Nenhuma medicação fixa ativa para calcular no período.
                        </TableCell>
                      </TableRow>
                    ) : (
                      calculoPrevisao.consolidadoMeds.map(item => (
                        <TableRow key={item.medicamentoId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                          <TableCell className="font-mono text-xs text-slate-600">{item.codigo || "-"}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-slate-100">{item.nome}</p>
                              <p className="text-xs text-slate-500">{item.dosagem} {item.apresentacao ? `(${item.apresentacao})` : ""}</p>
                              <p className="text-[10px] text-blue-600">Utilizado por {item.totalPacientes} paciente(s)</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center font-mono font-semibold">
                            {item.qtdDiaria} un/dia
                          </TableCell>
                          <TableCell className="text-center font-mono font-black text-lg bg-blue-50/40 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300">
                            {item.qtdPeriodo} un
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold">
                            {item.estoqueAtual} un
                          </TableCell>
                          <TableCell className="text-center">
                            {item.suficiente ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 flex items-center justify-center gap-1 mx-auto w-fit">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Estoque Ok
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="flex items-center justify-center gap-1 mx-auto w-fit">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Falta: {item.diferenca} un
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>

            {/* VISÃO 2: KITS POR PACIENTE */}
            <TabsContent value="pacientes" className="space-y-4">
              {calculoPrevisao.consolidadoPacientes.length === 0 ? (
                <Card className="p-12 text-center text-slate-500">
                  Nenhum paciente com prescrição ativa para montar kits.
                </Card>
              ) : (
                <div className="space-y-8">
                  {Object.entries(
                    calculoPrevisao.consolidadoPacientes.reduce((acc, pac) => {
                      const ala = pac.alaNome || 'Sem Ala Definida';
                      if (!acc[ala]) acc[ala] = [];
                      acc[ala].push(pac);
                      return acc;
                    }, {})
                  ).sort(([alaA], [alaB]) => alaA.localeCompare(alaB)).map(([alaNome, pacientesDaAla]) => (
                    <div key={alaNome} className="space-y-4 print:break-inside-avoid">
                      <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex justify-between items-center">
                        <h3 className="font-black text-slate-800 dark:text-slate-100 text-lg uppercase flex items-center gap-2">
                          <Users className="w-5 h-5 text-indigo-600" />
                          Setor / Ala: {alaNome}
                        </h3>
                        <Badge variant="secondary" className="bg-slate-200 text-slate-700">
                          {pacientesDaAla.length} Paciente(s)
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {pacientesDaAla.map(pac => (
                          <Card key={pac.pacienteId} className="border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-3 print:break-inside-avoid">
                            <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-3">
                              <div>
                                <h4 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
                                  {pac.nome}
                                </h4>
                                <p className="text-xs text-slate-500 font-mono mt-1">
                                  Prontuário: {pac.prontuario} • Leito: {pac.leito}
                                </p>
                              </div>
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 font-bold border-blue-200">
                                Previsão {periodoDias}D
                              </Badge>
                            </div>

                            <Table>
                              <TableHeader>
                                <TableRow className="text-[11px]">
                                  <TableHead className="py-1">Medicamento</TableHead>
                                  <TableHead className="py-1 text-center">Posologia (08-14-22-06h)</TableHead>
                                  <TableHead className="py-1 text-right">Total {periodoDias}D</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {pac.prescricoes.map(pr => {
                                  const d08 = getDoseForHora(pr.horarios, "08:00");
                                  const d14 = getDoseForHora(pr.horarios, "14:00");
                                  const d22 = getDoseForHora(pr.horarios, "22:00");
                                  const d06 = getDoseForHora(pr.horarios, "06:00");

                                  return (
                                    <TableRow key={pr.id} className="text-xs">
                                      <TableCell className="py-1.5 font-medium">
                                        {pr.medNome}
                                      </TableCell>
                                      <TableCell className="py-1.5 text-center font-mono">
                                        <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-bold text-[10px]">
                                          {d08}-{d14}-{d22}-{d06}
                                        </span>
                                      </TableCell>
                                      <TableCell className="py-1.5 text-right font-bold text-blue-700 dark:text-blue-400 font-mono">
                                        {pr.qtdPeriodo} un
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* ─── TAB 3: PACIENTES DE ALTA ────────────────────────────────────── */}
        <TabsContent value="altas" className="space-y-4">
          <Card className="p-4 border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <Input
                placeholder="Buscar paciente de alta por nome, prontuário, setor ou leito..."
                value={searchAltaPatient}
                onChange={(e) => setSearchAltaPatient(e.target.value)}
                className="pl-10"
              />
            </div>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
            <Table>
              <TableHeader className="bg-amber-50/60 dark:bg-amber-950/20">
                <TableRow>
                  <TableHead>Prontuário</TableHead>
                  <TableHead>Nome do Paciente</TableHead>
                  <TableHead>Setor / Leito Anterior</TableHead>
                  <TableHead className="text-center">Data da Alta</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAltaPatients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <LogOut className="w-12 h-12 text-amber-300 dark:text-amber-700/40 mx-auto mb-3" />
                      <p className="text-slate-600 dark:text-slate-400 font-medium">Nenhum paciente registrado em alta hospitalar.</p>
                      <p className="text-xs text-slate-400 mt-1">Ao conceder alta no prontuário do paciente, ele será transferido para este histórico.</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAltaPatients.map((p) => (
                    <TableRow key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50">
                      <TableCell className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                        {p.prontuario}
                      </TableCell>
                      <TableCell className="font-bold text-slate-800 dark:text-slate-200">
                        {p.nome}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                        {p.alaNome || "Ala Geral"} • Leito: {p.leito || "S/L"}
                      </TableCell>
                      <TableCell className="text-center text-xs font-mono text-slate-600 dark:text-slate-400">
                        {p.dataAlta ? format(new Date(p.dataAlta), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "Alta Registrada"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-amber-600 text-white font-bold text-xs">Alta Hospitalar</Badge>
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setViewPatientDetails(p)}
                          title="Ver histórico de prontuário e medicações do paciente"
                        >
                          <Eye className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 font-bold text-xs shadow-sm"
                          onClick={() => reativarPacienteMutation.mutate(p.id)}
                          title="Reativar internação do paciente"
                        >
                          <RefreshCw className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                          Reativar Internação
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingPatient ? "Editar Paciente" : "Novo Paciente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
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
            <Button onClick={() => savePatientMutation.mutate(patientFormData)} disabled={!patientFormData.nome || !patientFormData.prontuario}>
              Salvar Paciente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: DETALHES & PRESCRIÇÕES COMPLETAS DO PACIENTE ─────────── */}
      <Dialog open={!!viewPatientDetails} onOpenChange={(open) => !open && setViewPatientDetails(null)}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto p-0 border-0 shadow-2xl rounded-2xl bg-white dark:bg-slate-900">
          <div className="bg-gradient-to-r from-slate-100 to-white dark:from-slate-900 dark:to-slate-800 border-b border-slate-200 dark:border-slate-800 p-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-2xl shadow-lg shadow-blue-500/30 ring-4 ring-white dark:ring-slate-900">
                  {viewPatientDetails?.nome?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <DialogTitle className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                    {viewPatientDetails?.nome}
                    <Badge variant="outline" className={cn(
                      "px-2.5 py-0.5 border-2 uppercase tracking-wider text-[10px]",
                      viewPatientDetails?.status === "Ativo" 
                        ? "border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10" 
                        : "border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-500/10"
                    )}>
                      {viewPatientDetails?.status || "Ativo"}
                    </Badge>
                  </DialogTitle>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium">
                    <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md font-mono text-slate-800 dark:text-slate-200">
                      <FileText className="w-3.5 h-3.5 text-blue-500" />
                      PRONT: {viewPatientDetails?.prontuario}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      Setor: <strong className="text-slate-800 dark:text-slate-200">{viewPatientDetails?.alaNome || "Não informado"}</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Bed className="w-3.5 h-3.5 text-slate-400" />
                      Leito: <strong className="text-slate-800 dark:text-slate-200">{viewPatientDetails?.leito || "S/L"}</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-4 sm:mt-0">
                <Button 
                  size="sm" 
                  className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-md hover:shadow-lg transition-all rounded-full px-5 font-bold"
                  onClick={() => handleOpenNewPresc(viewPatientDetails?.id)}
                >
                  <Plus className="w-4 h-4" />
                  Nova Prescrição
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-full w-9 h-9 p-0 border-slate-200 text-slate-600 hover:bg-slate-100"
                  onClick={() => handleOpenEditPatient(viewPatientDetails)}
                  title="Editar dados cadastrais do paciente"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-6 p-6 pt-2">
            {viewPatientDetails?.observacoes && (
              <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-900/30 border border-amber-200 dark:border-amber-800 p-4 rounded-xl flex items-start gap-3 shadow-sm animate-in fade-in">
                <div className="bg-amber-100 dark:bg-amber-900 p-2 rounded-full shrink-0 animate-pulse">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <strong className="font-black text-amber-900 dark:text-amber-300 block text-sm">Alergias e Observações Clínicas Relevantes</strong>
                  <span className="text-amber-800/90 dark:text-amber-400/90 text-sm mt-0.5 block leading-relaxed">{viewPatientDetails.observacoes}</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
              <h4 className="text-base font-black text-slate-800 dark:text-slate-200 flex items-center gap-2 uppercase tracking-wide">
                <div className="w-1.5 h-5 bg-blue-500 rounded-full"></div>
                Prescrições Ativas e Histórico
              </h4>
              <Badge variant="secondary" className="bg-white dark:bg-slate-900 border border-slate-200 shadow-sm font-mono text-blue-600">
                {prescricoes.filter(pr => pr.pacienteId === viewPatientDetails?.id).length} itens
              </Badge>
            </div>

            {prescricoes.filter(pr => pr.pacienteId === viewPatientDetails?.id).length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/50 transition-all hover:bg-slate-50">
                <div className="bg-white p-4 rounded-full inline-block shadow-sm mb-3">
                  <Pill className="w-8 h-8 text-blue-300" />
                </div>
                <p className="text-base text-slate-500 font-bold">Prontuário limpo.</p>
                <p className="text-sm text-slate-400 mb-4">Nenhuma medicação prescrita para este paciente ainda.</p>
                <Button 
                  onClick={() => handleOpenNewPresc(viewPatientDetails?.id)} 
                  className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-6 shadow-md hover:shadow-lg transition-all"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Prescrever Primeira Medicação
                </Button>
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm bg-white dark:bg-slate-900">
                <Table>
                  <TableHeader className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-bold text-slate-700">Medicamento</TableHead>
                      <TableHead className="text-center font-bold text-slate-700">Grade Posológica</TableHead>
                      <TableHead className="text-center font-bold text-slate-700">Dose/Dia</TableHead>
                      <TableHead className="text-center font-bold text-slate-700">Status</TableHead>
                      <TableHead className="text-right font-bold text-slate-700 pr-6">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prescricoes.filter(pr => pr.pacienteId === viewPatientDetails?.id).map((pr) => {
                      const d08 = getDoseForHora(pr.horarios, "08:00");
                      const d14 = getDoseForHora(pr.horarios, "14:00");
                      const d22 = getDoseForHora(pr.horarios, "22:00");
                      const d06 = getDoseForHora(pr.horarios, "06:00");
                      const isSuspensa = pr.status === "Suspensa" || pr.status === "Devolvida";

                      return (
                        <TableRow 
                          key={pr.id} 
                          className={cn(
                            "transition-all duration-300 border-b border-slate-100",
                            isSuspensa 
                              ? "bg-slate-50/60 dark:bg-slate-900/40 opacity-70 grayscale-[0.2]" 
                              : "bg-white dark:bg-slate-900 border-l-4 border-l-emerald-500 hover:bg-slate-50 shadow-[inset_0_-1px_0_0_rgba(0,0,0,0.05)]"
                          )}
                        >
                          <TableCell className="py-4">
                            <div>
                              <p className={cn(
                                "font-black flex items-center gap-2",
                                isSuspensa ? "text-slate-600 line-through decoration-slate-300" : "text-slate-900 dark:text-slate-100"
                              )}>
                                {pr.medicamentoNome}
                                {pr.is_mav && (
                                  <Badge variant="outline" className="text-[9px] font-black bg-red-100 text-red-700 border-red-300 px-1.5 py-0 rounded-sm uppercase">
                                    MAV
                                  </Badge>
                                )}
                              </p>
                              <p className="text-xs text-slate-500 font-medium mt-1">
                                {pr.apresentacao && <span className="mr-2 text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">{pr.apresentacao}</span>}
                                <span>Cod: {pr.medicamentoCodigo || "N/A"}</span>
                              </p>
                            </div>
                          </TableCell>

                          <TableCell className="text-center py-4">
                            <div className={cn(
                              "inline-flex items-center gap-1.5 p-1.5 rounded-xl border font-mono shadow-inner text-xs",
                              isSuspensa ? "bg-slate-100 border-slate-200" : "bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700"
                            )}>
                              <span className={cn("w-12 text-center py-1 rounded-md font-bold transition-colors", d08 > 0 ? "bg-blue-500 text-white shadow-sm" : "text-slate-300")}>{d08 > 0 ? `${d08}x` : '-'}</span>
                              <span className="text-slate-200">|</span>
                              <span className={cn("w-12 text-center py-1 rounded-md font-bold transition-colors", d14 > 0 ? "bg-amber-500 text-white shadow-sm" : "text-slate-300")}>{d14 > 0 ? `${d14}x` : '-'}</span>
                              <span className="text-slate-200">|</span>
                              <span className={cn("w-12 text-center py-1 rounded-md font-bold transition-colors", d22 > 0 ? "bg-purple-500 text-white shadow-sm" : "text-slate-300")}>{d22 > 0 ? `${d22}x` : '-'}</span>
                              <span className="text-slate-200">|</span>
                              <span className={cn("w-12 text-center py-1 rounded-md font-bold transition-colors", d06 > 0 ? "bg-indigo-500 text-white shadow-sm" : "text-slate-300")}>{d06 > 0 ? `${d06}x` : '-'}</span>
                            </div>
                          </TableCell>

                          <TableCell className="text-center py-4">
                            <div className="flex flex-col items-center">
                              <span className="font-black text-lg text-slate-700 dark:text-slate-200 leading-none">{pr.totalDiario}</span>
                              <span className="text-[10px] font-bold uppercase text-slate-400 mt-1">Dose/Dia</span>
                            </div>
                          </TableCell>

                          <TableCell className="text-center py-4">
                            <Badge 
                              variant={!isSuspensa ? "default" : "secondary"}
                              className={cn(
                                "cursor-pointer select-none px-3 py-1 font-bold uppercase tracking-wider text-[10px] transition-all hover:scale-105",
                                !isSuspensa ? "bg-emerald-500 hover:bg-emerald-600 shadow-sm shadow-emerald-500/20" : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                              )}
                              onClick={() => togglePrescStatusMutation.mutate({ id: pr.id, status: pr.status })}
                              title="Clique para alternar status (Ativa / Suspensa)"
                            >
                              {pr.status || "Ativa"}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-right py-4 pr-6">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="w-8 h-8 rounded-full text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                                onClick={() => handleOpenEditPresc(pr)}
                                title="Editar prescrição"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className={cn("w-8 h-8 rounded-full transition-colors", !isSuspensa ? "text-amber-500 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50")}
                                onClick={() => togglePrescStatusMutation.mutate({ id: pr.id, status: pr.status })}
                                title={!isSuspensa ? "Suspender prescrição" : "Ativar prescrição"}
                              >
                                <Power className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="w-8 h-8 rounded-full text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                                onClick={() => {
                                  setDevolucaoPresc(pr);
                                  setDevolucaoQtd("");
                                  setDevolucaoTipo("Alta a Pedido");
                                  setDevolucaoMotivo("");
                                  setDevolucaoModalOpen(true);
                                }}
                                title="Devolver medicação ao estoque central"
                              >
                                <Undo2 className="w-4 h-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="w-8 h-8 rounded-full text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors"
                                onClick={() => {
                                  setDeleteTarget({ type: 'prescricao', id: pr.id, name: pr.medicamentoNome });
                                  setDeleteReason("");
                                  setDeleteLogModalOpen(true);
                                }}
                                title="Excluir Permanentemente"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-b-2xl border-t border-slate-200 dark:border-slate-800">
            <Button variant="ghost" size="sm" onClick={() => setViewPatientDetails(null)} className="w-full sm:w-auto font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 rounded-full px-6">
              Fechar Prontuário
            </Button>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-2 text-slate-600 bg-white shadow-sm hover:shadow rounded-full font-bold">
                <Printer className="w-4 h-4" />
                Imprimir
              </Button>
              <Button 
                size="sm" 
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold gap-2 shadow-md hover:shadow-lg transition-all rounded-full px-5"
                onClick={() => {
                  setSelectedPatientIds([viewPatientDetails?.id]);
                  setBatchBaixaModalOpen(true);
                }}
              >
                <PackageMinus className="w-4 h-4" />
                Baixar Estoque
              </Button>
              {viewPatientDetails?.status !== "Alta" && (
                <Button 
                  size="sm" 
                  variant="outline"
                  className="border-amber-300 bg-gradient-to-br from-amber-50 to-orange-100 hover:from-amber-100 hover:to-orange-200 text-amber-900 font-bold gap-2 shadow-sm rounded-full px-5"
                  onClick={() => {
                    if (window.confirm(`Tem certeza que deseja DAR ALTA para o paciente ${viewPatientDetails?.nome}? Todas as prescrições serão suspensas e ele sairá dos relatórios.`)) {
                      setAltaPacienteId(viewPatientDetails.id);
                      setAltaDevolucoes({});
                      setAltaModalOpen(true);
                    }
                  }}
                  title="Dar alta hospitalar ao paciente"
                >
                  <LogOut className="w-4 h-4 text-amber-700" />
                  Conceder Alta
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                <Select value={String(batchBaixaDias)} onValueChange={(v) => setBatchBaixaDias(Number(v))}>
                  <SelectTrigger className="w-[120px] h-9 bg-white dark:bg-slate-900 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 dia</SelectItem>
                    <SelectItem value="7">7 dias</SelectItem>
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
                          <TableHead className="text-center">Dose Diária</TableHead>
                          <TableHead className="text-center">Total Saída ({batchBaixaDias}d)</TableHead>
                          <TableHead className="text-right">Estoque Atual</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activePrescs.map((pr) => {
                          const pac = selectedPacs.find(p => p.id === pr.pacienteId);
                          const med = medicamentos.find(m => m.id === pr.medicamentoId);
                          const qtdSaida = (pr.totalDiario || 0) * batchBaixaDias;
                          const estoqueDisponivel = med?.estoque_atual || 0;
                          const temEstoqueSuficiente = estoqueDisponivel >= qtdSaida;

                          return (
                            <TableRow key={pr.id} className="hover:bg-slate-50/50">
                              <TableCell>
                                <p className="font-bold text-xs text-slate-900 dark:text-slate-100">{pac?.nome || "Paciente"}</p>
                                <p className="text-[10px] text-slate-500 font-mono">Pront: {pac?.prontuario || "N/A"} • {pac?.leito || "S/L"}</p>
                              </TableCell>
                              <TableCell>
                                <p className="font-bold text-xs text-blue-900 dark:text-blue-200">{pr.medicamentoNome}</p>
                                <p className="text-[10px] text-slate-500">Cód: {pr.medicamentoCodigo || "N/A"}</p>
                              </TableCell>
                              <TableCell className="text-center font-mono text-xs font-bold">
                                {pr.totalDiario} un/dia
                              </TableCell>
                              <TableCell className="text-center font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                -{qtdSaida} un
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    "font-mono text-xs font-bold",
                                    temEstoqueSuficiente ? "bg-slate-50 text-slate-700" : "bg-red-50 text-red-700 border-red-300"
                                  )}
                                >
                                  {estoqueDisponivel} em estoque
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
                efetuandoBaixaLoteMutation.mutate({
                  patientIds: selectedPatientIds,
                  dias: batchBaixaDias
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
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>{editingPresc ? "Editar Prescrição Fixa" : "Nova Prescrição Fixa de Paciente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Paciente *</Label>
              <Select
                value={prescFormData.pacienteId}
                onValueChange={(val) => setPrescFormData(prev => ({ ...prev, pacienteId: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o paciente..." />
                </SelectTrigger>
                <SelectContent>
                  {pacientes.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome} (Pront: {p.prontuario}) - Leito: {p.leito || "S/L"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Medicamento * (Apenas com Estoque Disponível)</Label>
              <ComboboxMedicamento
                medicamentos={medicamentosComEstoque}
                value={prescFormData.medicamentoId}
                onChange={(val) => setPrescFormData(prev => ({ ...prev, medicamentoId: val }))}
                placeholder="Selecione ou busque o medicamento com estoque..."
              />
            </div>

            {/* Esquema Posológico 1-0-2-2 */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex justify-between items-center">
                <Label className="font-bold text-slate-800 dark:text-slate-200">
                  Esquema Posológico por Horário (Ex: 1-0-2-2)
                </Label>
                <Input
                  className="w-28 font-mono text-center font-bold text-blue-700"
                  value={prescFormData.esquemaPosologico}
                  onChange={(e) => handleEsquemaPosologicoStringChange(e.target.value)}
                  placeholder="1-0-2-2"
                />
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 block mb-1">08:00 (Manhã)</span>
                  <Input
                    type="number"
                    min="0"
                    className="text-center font-bold"
                    value={prescFormData.dose08}
                    onChange={(e) => {
                      const d08 = e.target.value;
                      setPrescFormData(prev => ({
                        ...prev,
                        dose08: d08,
                        esquemaPosologico: `${d08 || 0}-${prev.dose14 || 0}-${prev.dose22 || 0}-${prev.dose06 || 0}`
                      }));
                    }}
                  />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-blue-800 dark:text-blue-300 block mb-1">14:00 (Tarde)</span>
                  <Input
                    type="number"
                    min="0"
                    className="text-center font-bold"
                    value={prescFormData.dose14}
                    onChange={(e) => {
                      const d14 = e.target.value;
                      setPrescFormData(prev => ({
                        ...prev,
                        dose14: d14,
                        esquemaPosologico: `${prev.dose08 || 0}-${d14 || 0}-${prev.dose22 || 0}-${prev.dose06 || 0}`
                      }));
                    }}
                  />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-indigo-800 dark:text-indigo-300 block mb-1">22:00 (Noite)</span>
                  <Input
                    type="number"
                    min="0"
                    className="text-center font-bold"
                    value={prescFormData.dose22}
                    onChange={(e) => {
                      const d22 = e.target.value;
                      setPrescFormData(prev => ({
                        ...prev,
                        dose22: d22,
                        esquemaPosologico: `${prev.dose08 || 0}-${prev.dose14 || 0}-${d22 || 0}-${prev.dose06 || 0}`
                      }));
                    }}
                  />
                </div>
                <div>
                  <span className="text-[11px] font-semibold text-purple-800 dark:text-purple-300 block mb-1">06:00 (Madrug)</span>
                  <Input
                    type="number"
                    min="0"
                    className="text-center font-bold"
                    value={prescFormData.dose06}
                    onChange={(e) => {
                      const d06 = e.target.value;
                      setPrescFormData(prev => ({
                        ...prev,
                        dose06: d06,
                        esquemaPosologico: `${prev.dose08 || 0}-${prev.dose14 || 0}-${prev.dose22 || 0}-${d06 || 0}`
                      }));
                    }}
                  />
                </div>
              </div>

              <div className="text-right text-xs font-bold text-blue-900 dark:text-blue-300">
                Total Diário: {(parseInt(prescFormData.dose08)||0) + (parseInt(prescFormData.dose14)||0) + (parseInt(prescFormData.dose22)||0) + (parseInt(prescFormData.dose06)||0)} unidades/dia
              </div>
            </div>

            <div>
              <Label>Observações Gerais</Label>
              <Input
                value={prescFormData.observacoes}
                onChange={(e) => setPrescFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                placeholder="Ex: Tomar após as refeições"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrescModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => savePrescMutation.mutate(prescFormData)} disabled={!prescFormData.pacienteId || !prescFormData.medicamentoId}>
              Salvar Prescrição
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
              onClick={() => efetuarBaixaMutation.mutate(calculoPrevisao.consolidadoMeds)}
              disabled={calculoPrevisao.consolidadoMeds.length === 0 || efetuarBaixaMutation.isPending}
            >
              Confirmar e Dar Baixa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── AREA DE IMPRESSÃO (A4 OCULTA NA TELA) ─────────────────────────── */}
      <div id="print-area" className="hidden print:block p-8 bg-white text-slate-900 font-sans">
        <div className="border-b-2 border-blue-900 pb-4 mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-black text-blue-950 uppercase tracking-tight">AXION SAÚDE — PREVISÃO E SEPARAÇÃO DE MEDICAÇÃO FIXA</h1>
            <p className="text-xs text-slate-600 font-bold mt-1">RELATÓRIO DE DISPENSAÇÃO CONTINUADA • PREVISÃO PARA {periodoDias} DIAS</p>
          </div>
          <div className="text-right text-xs text-slate-600 font-mono">
            <p>Emissão: <strong>{format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</strong></p>
            <p>Total de Pacientes: <strong>{calculoPrevisao.totalPacientesComMedicao}</strong></p>
          </div>
        </div>

        {/* Consolidado Global de Pedido */}
        <div className="mb-8">
          <h2 className="text-base font-bold uppercase border-b border-slate-300 pb-1 mb-3 text-blue-900">
            1. Consolidado Geral para Compras e Separação ({periodoDias} Dias)
          </h2>
          <table className="w-full text-left border-collapse border border-slate-300 text-xs">
            <thead>
              <tr className="bg-slate-200 text-slate-900 font-bold uppercase">
                <th className="border border-slate-300 p-2">Código</th>
                <th className="border border-slate-300 p-2">Medicamento / Dosagem</th>
                <th className="border border-slate-300 p-2 text-center">Consumo Diário</th>
                <th className="border border-slate-300 p-2 text-center">Total {periodoDias}D</th>
                <th className="border border-slate-300 p-2 text-center">Estoque Atual</th>
                <th className="border border-slate-300 p-2 text-center">Situação</th>
              </tr>
            </thead>
            <tbody>
              {calculoPrevisao.consolidadoMeds.map(item => (
                <tr key={item.medicamentoId}>
                  <td className="border border-slate-300 p-2 font-mono">{item.codigo || "-"}</td>
                  <td className="border border-slate-300 p-2 font-bold">{item.nome} {item.dosagem ? `(${item.dosagem})` : ""}</td>
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

        {/* Fichas por Paciente */}
        <div>
          <h2 className="text-base font-bold uppercase border-b border-slate-300 pb-1 mb-3 text-blue-900">
            2. Kits de Aprazamento por Paciente / Leito ({periodoDias} Dias)
          </h2>
          {calculoPrevisao.consolidadoPacientes.map(pac => (
            <div key={pac.pacienteId} className="mb-6 border border-slate-400 p-4 rounded-md">
              <div className="flex justify-between border-b border-slate-300 pb-2 mb-2">
                <span className="font-bold text-sm uppercase">{pac.nome} — Prontuário: {pac.prontuario}</span>
                <span className="font-mono text-xs">Leito: {pac.alaNome} ({pac.leito})</span>
              </div>
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 font-bold border-b border-slate-300">
                    <th className="py-1">Medicamento</th>
                    <th className="py-1 text-center">Grade (08h - 14h - 22h - 06h)</th>
                    <th className="py-1 text-center">Diário</th>
                    <th className="py-1 text-right">Total {periodoDias}D</th>
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
                        <td className="py-1 font-semibold">{pr.medNome}</td>
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
      </div>

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
                          <TableCell className="font-medium">{pr.medicamentoNome}</TableCell>
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

      <style>{`
        @media print {
          @page { size: A4; margin: 12mm; }
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; background-color: white !important; }
          ${altaReportData ? `
            body * { visibility: hidden; }
            [role="dialog"], [role="dialog"] * { visibility: visible !important; }
            [role="dialog"] { position: absolute; left:0; top:0; width: 100%; height: 100%; margin: 0; padding: 0; }
          ` : `
            body * { visibility: hidden; }
            #print-area, #print-area * { visibility: visible; }
            #print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; }
          `}
          .no-print, nav, header, footer, button { display: none !important; }
        }
      `}</style>
    </div>
  );
}
