import { useState, useMemo, useRef, useEffect } from "react";
import { db } from "@/api/db";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { 
  ClipboardList, 
  Sun, 
  Moon, 
  Clock, 
  User, 
  Plus, 
  Search, 
  X, 
  Printer, 
  FileText, 
  RotateCcw, 
  PackageMinus, 
  AlertTriangle, 
  CheckCircle2, 
  LogOut, 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Sparkles, 
  ShieldAlert, 
  Building2, 
  Pill, 
  Trash2, 
  Edit3,
  BookmarkCheck,
  SendHorizontal
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format, parseISO, isValid, addDays, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

// ─── Helpers de Plantão ───────────────────────────────────────────────────────
export function getCurrentShiftDetails() {
  const now = new Date();
  const hour = now.getHours();
  // 07h00 até 18h59:59 = Diurno
  // 19h00 até 06h59:59 = Noturno
  const isDiurno = hour >= 7 && hour < 19;
  
  // A data acompanha sempre o dia civil atual do relógio:
  // - 07/09 das 07h às 18h59 -> Data: 07/09/2026, Plantão: Diurno
  // - 07/09 das 19h às 23h59 -> Data: 07/09/2026, Plantão: Noturno
  // - 08/09 das 00h às 06h59 -> Data: 08/09/2026, Plantão: Noturno (continua noturno e vira a data para 08/09)
  // - 08/09 das 07h às 18h59 -> Data: 08/09/2026, Plantão: Diurno
  const dataStr = format(now, "yyyy-MM-dd");
  
  return {
    isDiurno,
    turno: isDiurno ? "diurno" : "noturno",
    dataStr
  };
}

export function computeShiftInterval(dataStr, turno) {
  const [year, month, day] = dataStr.split("-").map(Number);
  const baseDate = new Date(year, month - 1, day);
  
  if (turno === "diurno") {
    // 07:00:00 até 18:59:59 do mesmo dia
    const start = new Date(year, month - 1, day, 7, 0, 0, 0);
    const end = new Date(year, month - 1, day, 18, 59, 59, 999);
    return { 
      start, 
      end, 
      label: "Plantão Diurno (07:00 às 19:00)",
      periodoFormatado: `${format(baseDate, "dd/MM")} 07:00 até ${format(baseDate, "dd/MM")} 18:59`
    };
  } else {
    // Plantão Noturno:
    // Se a data selecionada for a data de hoje e estivermos na madrugada (00:00 às 06:59):
    // o plantão noturno iniciou ontem às 19:00 e vai até hoje às 06:59:59
    const now = new Date();
    const isToday = format(now, "yyyy-MM-dd") === dataStr;
    const isMadrugada = isToday && now.getHours() < 7;
    
    let start, end, periodoFormatado;
    if (isMadrugada) {
      const prevDay = subDays(baseDate, 1);
      start = new Date(prevDay.getFullYear(), prevDay.getMonth(), prevDay.getDate(), 19, 0, 0, 0);
      end = new Date(year, month - 1, day, 6, 59, 59, 999);
      periodoFormatado = `${format(prevDay, "dd/MM")} 19:00 até ${format(baseDate, "dd/MM")} 06:59`;
    } else {
      // Início do plantão às 19:00 até 06:59:59 do dia seguinte
      const nextDay = addDays(baseDate, 1);
      start = new Date(year, month - 1, day, 19, 0, 0, 0);
      end = new Date(nextDay.getFullYear(), nextDay.getMonth(), nextDay.getDate(), 6, 59, 59, 999);
      periodoFormatado = `${format(baseDate, "dd/MM")} 19:00 até ${format(nextDay, "dd/MM")} 06:59`;
    }
    
    return { 
      start, 
      end, 
      label: "Plantão Noturno (19:00 às 07:00)",
      periodoFormatado
    };
  }
}

export default function PassagemPlantao({ isTab = false }) {
  const queryClient = useQueryClient();
  const printRef = useRef();

  // Turno e Data selecionados
  const currentDetails = useMemo(() => getCurrentShiftDetails(), []);
  const [selectedDate, setSelectedDate] = useState(currentDetails.dataStr);
  const [selectedTurno, setSelectedTurno] = useState(currentDetails.turno);
  const [activeCategory, setActiveCategory] = useState("todos"); // todos, ocorrencias, saidas, devolucoes, altas
  const [search, setSearch] = useState("");

  // Dados do Farmacêutico do Plantão
  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("pharma_user") || "null");
    } catch {
      return null;
    }
  }, []);

  const [farmaceuticoNome, setFarmaceuticoNome] = useState(
    storedUser?.full_name || storedUser?.nome || "Dr(a). Farmacêutico(a)"
  );
  const [farmaceuticoCrf, setFarmaceuticoCrf] = useState(
    storedUser?.crf || "CRF-SP 00.000"
  );
  const [farmaceuticoModalOpen, setFarmaceuticoModalOpen] = useState(false);

  // Modal de Nova Ocorrência Manual
  const [ocorrenciaModalOpen, setOcorrenciaModalOpen] = useState(false);
  const [novaOcorrencia, setNovaOcorrencia] = useState({
    tipo: "Pendência para o Próximo Plantão",
    titulo: "",
    descricao: "",
  });

  // Queries
  const { data: saidas = [], isLoading: loadingSaidas } = useQuery({
    queryKey: ['saidas'],
    queryFn: () => db.entities.Saida.list('-created_date'),
  });

  const { data: entradas = [], isLoading: loadingEntradas } = useQuery({
    queryKey: ['entradas'],
    queryFn: () => db.entities.Entrada.list('-created_date'),
  });

  const { data: pacientes = [] } = useQuery({
    queryKey: ['pacientes'],
    queryFn: () => db.entities.Paciente.list(),
  });

  const { data: ocorrenciasDb = [], isLoading: loadingOcorrencias } = useQuery({
    queryKey: ['plantao_ocorrencias'],
    queryFn: async () => {
      try {
        const list = await db.entities.PlantaoOcorrencia.list('-created_at');
        return Array.isArray(list) ? list : [];
      } catch (err) {
        console.warn("Tabela PlantaoOcorrencia fallback para localStorage:", err);
        const local = localStorage.getItem("plantao_ocorrencias_backup");
        return local ? JSON.parse(local) : [];
      }
    }
  });

  // Calcular intervalo do plantão selecionado
  const shiftInterval = useMemo(() => {
    return computeShiftInterval(selectedDate, selectedTurno);
  }, [selectedDate, selectedTurno]);

  // Verificar se o plantão selecionado é o atual em tempo real
  const isCurrentLiveShift = useMemo(() => {
    const now = new Date();
    return now >= shiftInterval.start && now <= shiftInterval.end;
  }, [shiftInterval]);

  // Ref para acompanhar a data de hoje e só virar turno automaticamente se o usuário estiver acompanhando o dia ao vivo
  const lastLiveDateRef = useRef(currentDetails.dataStr);

  // Relógio em tempo real para sincronização automática de plantão (19h e 00h)
  useEffect(() => {
    const checkLiveShift = () => {
      const current = getCurrentShiftDetails();

      // Só interfere se o usuário estiver no dia atual ao vivo. Se navegou para uma data passada (ex: 05/09), não reseta!
      const wasOnToday = selectedDate === lastLiveDateRef.current;

      if (wasOnToday && selectedDate !== current.dataStr) {
        // Virada natural da meia-noite no plantão ao vivo
        setSelectedDate(current.dataStr);
        setSelectedTurno(current.turno);
        lastLiveDateRef.current = current.dataStr;
      } else if (selectedDate === current.dataStr) {
        // Se está no dia de hoje, atualiza o turno quando der 19h ou 07h
        if (selectedTurno !== current.turno) {
          setSelectedTurno(current.turno);
        }
        lastLiveDateRef.current = current.dataStr;
      }
    };

    const interval = setInterval(checkLiveShift, 10000);
    return () => clearInterval(interval);
  }, [selectedDate, selectedTurno]);

  // Mutation para criar Ocorrência Manual
  const createOcorrenciaMutation = useMutation({
    mutationFn: async (form) => {
      if (!form.titulo?.trim()) throw new Error("Informe o título ou resumo da ocorrência.");
      if (!form.descricao?.trim()) throw new Error("Descreva os detalhes da ocorrência.");

      const item = {
        id: crypto.randomUUID(),
        data_plantao: selectedDate,
        turno: selectedTurno,
        tipo: form.tipo,
        titulo: form.titulo.trim(),
        descricao: form.descricao.trim(),
        farmaceutico_nome: farmaceuticoNome,
        farmaceutico_crf: farmaceuticoCrf,
        created_at: new Date().toISOString()
      };

      try {
        await db.entities.PlantaoOcorrencia.create(item);
      } catch (e) {
        console.warn("Falha ao salvar no Postgres, persistindo em backup local:", e);
        const local = JSON.parse(localStorage.getItem("plantao_ocorrencias_backup") || "[]");
        localStorage.setItem("plantao_ocorrencias_backup", JSON.stringify([item, ...local]));
      }

      // Log de Auditoria
      await db.logAction(
        "OCORRENCIA_PLANTAO",
        "PlantaoOcorrencia",
        item.id,
        `Registro de ${item.tipo}: ${item.titulo} no plantão ${selectedTurno} de ${selectedDate}.`
      );

      return item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plantao_ocorrencias'] });
      setOcorrenciaModalOpen(false);
      setNovaOcorrencia({
        tipo: "Pendência para o Próximo Plantão",
        titulo: "",
        descricao: "",
      });
      toast.success("Ocorrência registrada na Passagem de Plantão!");
    },
    onError: (err) => {
      toast.error("Erro ao registrar ocorrência: " + (err.message || err));
    }
  });

  // Mutation para excluir ocorrência manual
  const deleteOcorrenciaMutation = useMutation({
    mutationFn: async (id) => {
      try {
        await db.entities.PlantaoOcorrencia.delete(id);
      } catch {
        const local = JSON.parse(localStorage.getItem("plantao_ocorrencias_backup") || "[]");
        const filtered = local.filter(o => o.id !== id);
        localStorage.setItem("plantao_ocorrencias_backup", JSON.stringify(filtered));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plantao_ocorrencias'] });
      toast.success("Anotação removida da passagem de plantão.");
    }
  });

  // ─── Consolidação Automática dos Eventos Técnicos do Turno ──────────────────
  const timelineEvents = useMemo(() => {
    const events = [];
    const { start, end } = shiftInterval;

    // 1. Processar Saídas
    (saidas || []).forEach(s => {
      if (s.motivo === "Transferência de Estoque") return;
      const isLog = (s.medicamento_nome && s.medicamento_nome.includes("[LOG")) || (s.tipo && s.tipo.includes("Log"));
      if (isLog) return;

      const saidaDateOnly = s.data_saida ? String(s.data_saida).split("T")[0] : null;
      const createdDateOnly = s.created_at ? String(s.created_at).split("T")[0].split(" ")[0] : null;
      const dateStr = s.created_at || (s.data_saida ? `${s.data_saida}T12:00:00` : null);
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return;

      const inInterval = d >= start && d <= end;
      const isDateMatch = saidaDateOnly === selectedDate || createdDateOnly === selectedDate;

      if (inInterval || isDateMatch) {
        const eventDate = (!inInterval && isDateMatch) ? new Date(`${selectedDate}T08:00:00`) : d;
        const qtd = Number(s.quantidade) || 0;
        const medNome = s.medicamento_nome || "Medicamento não informado";
        const lote = s.numero_lote || "Lote N/I";
        const destino = s.ala_nome || s.destino || (s.paciente_nome ? `Paciente ${s.paciente_nome}` : "Dispensação Setorial");
        const motivo = s.motivo || s.tipo || "Dispensação";

        let textoTecnico = `Dispensado ${qtd} un de ${medNome} (Lote: ${lote}) com destino a ${destino}.`;
        if (s.paciente_nome) {
          textoTecnico += ` Paciente atendido: ${s.paciente_nome}.`;
        }
        if (motivo && motivo !== "Dispensação") {
          textoTecnico += ` Motivo: ${motivo}.`;
        }
        if (s.observacoes) {
          textoTecnico += ` Obs: ${s.observacoes}.`;
        }

        events.push({
          id: `saida-${s.id}`,
          date: eventDate,
          tipoCategoria: "saida",
          titulo: "Dispensação de Medicamento",
          textoTecnico,
          medicamento: medNome,
          lote,
          quantidade: qtd,
          setorOuPaciente: destino,
          responsavel: s.responsavel || farmaceuticoNome,
          raw: s
        });
      }
    });

    // 2. Processar Entradas e Devoluções
    (entradas || []).forEach(e => {
      const entryDateOnly = e.data_entrada ? String(e.data_entrada).split("T")[0] : null;
      const createdDateOnly = e.created_at ? String(e.created_at).split("T")[0].split(" ")[0] : null;
      const dateStr = e.created_at || (e.data_entrada ? `${e.data_entrada}T12:00:00` : null);
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return;

      const inInterval = d >= start && d <= end;
      const isDateMatch = entryDateOnly === selectedDate || createdDateOnly === selectedDate;

      if (inInterval || isDateMatch) {
        const eventDate = (!inInterval && isDateMatch) ? new Date(`${selectedDate}T08:00:00`) : d;
        const fn = (e.fornecedor_nome || "").toLowerCase();
        const tp = (e.tipo || "").toLowerCase();
        const nl = (e.numero_lote || "").toUpperCase();
        const obs = (e.observacoes || "").toLowerCase();
        const isDevolucao = (
          fn.includes("devolução") || fn.includes("devolucao") || fn.includes("devolvido") ||
          tp.includes("devolucao") || tp.includes("devolução") || nl === "DEVOLVIDO" ||
          obs.includes("devolução") || obs.includes("devolucao")
        );

        const qtd = Number(e.quantidade) || 0;
        const medNome = e.medicamento_nome || "Medicamento";
        const lote = e.numero_lote || "Lote N/I";

        if (isDevolucao) {
          let textoTecnico = `Recebida devolução de ${qtd} un de ${medNome} (Lote: ${lote}). Retorno ao estoque satélite efetuado.`;
          if (e.fornecedor_nome) {
            textoTecnico += ` Origem: ${e.fornecedor_nome}.`;
          }
          if (e.observacoes && e.observacoes !== e.fornecedor_nome) {
            textoTecnico += ` Justificativa: ${e.observacoes}.`;
          }

          events.push({
            id: `dev-${e.id}`,
            date: eventDate,
            tipoCategoria: "devolucao",
            titulo: "Devolução Recebida na Satélite",
            textoTecnico,
            medicamento: medNome,
            lote,
            quantidade: qtd,
            setorOuPaciente: e.fornecedor_nome || "Posto / Leito",
            responsavel: farmaceuticoNome,
            raw: e
          });
        } else {
          let textoTecnico = `Entrada de abastecimento: Recebido ${qtd} un de ${medNome} (Lote: ${lote}).`;
          if (e.fornecedor_nome) {
            textoTecnico += ` Proveniente de: ${e.fornecedor_nome}.`;
          }

          events.push({
            id: `ent-${e.id}`,
            date: eventDate,
            tipoCategoria: "entrada",
            titulo: "Entrada / Remessa de Abastecimento",
            textoTecnico,
            medicamento: medNome,
            lote,
            quantidade: qtd,
            setorOuPaciente: e.fornecedor_nome || "Central",
            responsavel: farmaceuticoNome,
            raw: e
          });
        }
      }
    });

    // 3. Processar Altas de Pacientes
    (pacientes || []).forEach(p => {
      if (p.status === "Alta" && p.dataAlta) {
        const d = new Date(p.dataAlta);
        if (!isNaN(d.getTime()) && d >= start && d <= end) {
          const textoTecnico = `Desospitalização / Concessão de Alta médica para o paciente ${p.nome} (Prontuário: ${p.prontuario || 'S/P'}, Leito: ${p.leito || 'S/L'}, Ala: ${p.alaNome || 'Ala Geral'}). Rotina de suspensão de prescrições ativas concluída.`;

          events.push({
            id: `alta-${p.id}`,
            date: d,
            tipoCategoria: "alta",
            titulo: "Alta Hospitalar Concedida",
            textoTecnico,
            medicamento: "N/A",
            lote: "N/A",
            quantidade: 0,
            setorOuPaciente: `${p.nome} (${p.alaNome || 'Ala Geral'})`,
            responsavel: farmaceuticoNome,
            raw: p
          });
        }
      }
    });

    // 4. Processar Ocorrências Manuais do Farmacêutico
    (ocorrenciasDb || []).forEach(o => {
      // Filtrar pelo turno e data do plantão
      if (o.data_plantao === selectedDate && o.turno === selectedTurno) {
        const d = new Date(o.created_at || `${selectedDate}T12:00:00`);
        events.push({
          id: `oco-${o.id}`,
          date: d,
          tipoCategoria: "ocorrencia",
          subTipoOcorrencia: o.tipo,
          titulo: o.titulo,
          textoTecnico: o.descricao,
          medicamento: "N/A",
          lote: "N/A",
          quantidade: 0,
          setorOuPaciente: "Farmácia Satélite",
          responsavel: o.farmaceutico_nome || farmaceuticoNome,
          responsavelCrf: o.farmaceutico_crf || farmaceuticoCrf,
          isManual: true,
          raw: o
        });
      }
    });

    // Ordenação cronológica (mais recentes primeiro)
    return events.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [saidas, entradas, pacientes, ocorrenciasDb, shiftInterval, selectedDate, selectedTurno, farmaceuticoNome, farmaceuticoCrf]);

  // Contagens e KPIs
  const counts = useMemo(() => {
    let saidasQtd = 0;
    let entradasQtd = 0;
    let devQtd = 0;
    let totalUnidadesSaidas = 0;
    let totalUnidadesEntradas = 0;
    let ocorrenciasCount = 0;
    let altasCount = 0;

    timelineEvents.forEach(ev => {
      if (ev.tipoCategoria === "saida") {
        saidasQtd++;
        totalUnidadesSaidas += ev.quantidade;
      } else if (ev.tipoCategoria === "devolucao") {
        devQtd++;
        totalUnidadesEntradas += ev.quantidade;
      } else if (ev.tipoCategoria === "entrada") {
        entradasQtd++;
        totalUnidadesEntradas += ev.quantidade;
      } else if (ev.tipoCategoria === "ocorrencia") {
        ocorrenciasCount++;
      } else if (ev.tipoCategoria === "alta") {
        altasCount++;
      }
    });

    return {
      totalEventos: timelineEvents.length,
      saidasQtd,
      totalUnidadesSaidas,
      devolucoesQtd: devQtd,
      entradasQtd,
      totalUnidadesEntradas,
      ocorrenciasCount,
      altasCount
    };
  }, [timelineEvents]);

  // Eventos Filtrados por Categoria e Busca
  const filteredEvents = useMemo(() => {
    const q = (search || "").trim().toLowerCase();

    return timelineEvents.filter(ev => {
      // Filtro de categoria
      if (activeCategory === "ocorrencias" && ev.tipoCategoria !== "ocorrencia") return false;
      if (activeCategory === "saidas" && ev.tipoCategoria !== "saida") return false;
      if (activeCategory === "devolucoes" && ev.tipoCategoria !== "devolucao" && ev.tipoCategoria !== "entrada") return false;
      if (activeCategory === "altas" && ev.tipoCategoria !== "alta") return false;

      // Filtro de busca
      if (!q) return true;
      return (
        ev.titulo?.toLowerCase().includes(q) ||
        ev.textoTecnico?.toLowerCase().includes(q) ||
        ev.medicamento?.toLowerCase().includes(q) ||
        ev.lote?.toLowerCase().includes(q) ||
        ev.setorOuPaciente?.toLowerCase().includes(q) ||
        ev.subTipoOcorrencia?.toLowerCase().includes(q)
      );
    });
  }, [timelineEvents, activeCategory, search]);

  // Resetar categoria para "todos" sempre que a data mudar para não esconder movimentações
  useEffect(() => {
    setActiveCategory("todos");
  }, [selectedDate]);

  // Função para navegar entre dias
  const handlePrevDay = () => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const prev = subDays(new Date(y, m - 1, d), 1);
    setSelectedDate(format(prev, "yyyy-MM-dd"));
    setActiveCategory("todos");
  };

  const handleNextDay = () => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    const next = addDays(new Date(y, m - 1, d), 1);
    setSelectedDate(format(next, "yyyy-MM-dd"));
    setActiveCategory("todos");
  };

  const handleResetToCurrentShift = () => {
    const current = getCurrentShiftDetails();
    setSelectedDate(current.dataStr);
    setSelectedTurno(current.turno);
    setActiveCategory("todos");
    lastLiveDateRef.current = current.dataStr;
    toast.info(`Retornado para o ${current.turno === 'diurno' ? 'Plantão Diurno' : 'Plantão Noturno'} atual.`);
  };

  // Exportar PDF do Plantão (Estritamente 1 Única Folha)
  const handleExportPDF = async () => {
    try {
      toast.loading("Gerando PDF da Passagem de Plantão (1 Folha)...");
      const element = printRef.current;
      if (!element) {
        throw new Error("Elemento do relatório não encontrado para exportação.");
      }

      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false 
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.98);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Desenha estritamente em 1 única folha A4 (sem páginas excedentes)
      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`passagem-plantao-${selectedTurno}-${selectedDate}.pdf`);
      toast.dismiss();
      toast.success("PDF da Passagem de Plantão gerado em 1 folha!");
    } catch (error) {
      toast.dismiss();
      toast.error("Erro ao gerar PDF: " + (error?.message || error));
    }
  };

  // Impressão nativa do relatório
  const handlePrint = () => {
    window.print();
  };

  // ─── Renderização ─────────────────────────────────────────────────────────
  return (
    <div className={cn("p-6 space-y-4 min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col", isTab && "p-4 min-h-[calc(100vh-140px)]")}>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              Passagem de Plantão
            </h1>
            {isCurrentLiveShift ? (
              <Badge className="bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 shadow-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                Plantão em Tempo Real
              </Badge>
            ) : (
              <Badge variant="outline" className="text-slate-500 border-slate-300 font-semibold text-[10px]">
                Histórico de Turno
              </Badge>
            )}
          </div>
          <p className="text-slate-500 text-xs font-medium mt-0.5">
            Registro cronológico automatizado de dispensações, devoluções e anotações técnicas da Farmácia Satélite
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {!isCurrentLiveShift && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetToCurrentShift}
              className="h-9 text-xs font-semibold border-purple-200 bg-purple-50/70 hover:bg-purple-100 text-purple-900 shadow-xs gap-1.5"
            >
              <Clock className="w-3.5 h-3.5 text-purple-600" />
              Plantão Atual
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setFarmaceuticoModalOpen(true)}
            className="h-9 text-xs font-semibold border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs gap-1.5"
            title="Alterar dados do farmacêutico responsável do plantão"
          >
            <User className="w-3.5 h-3.5 text-slate-500" />
            <span className="max-w-[140px] truncate">{farmaceuticoNome}</span>
            <span className="text-[10px] text-slate-400 font-mono">({farmaceuticoCrf})</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            className="h-9 text-xs font-semibold border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            Exportar PDF
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="h-9 text-xs font-semibold border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs gap-1.5"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            Imprimir
          </Button>

          <Button
            onClick={() => setOcorrenciaModalOpen(true)}
            className="h-9 text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md shadow-purple-500/20 gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Escrever Ocorrência
          </Button>
        </div>
      </div>

      {/* Date Navigator and Shift Period Bar */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Date Navigator */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevDay}
            className="h-8.5 w-8.5 p-0 border-slate-200 bg-slate-50 hover:bg-white"
            title="Dia anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <CalendarIcon className="w-4 h-4 text-purple-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 outline-none cursor-pointer"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNextDay}
            className="h-8.5 w-8.5 p-0 border-slate-200 bg-slate-50 hover:bg-white"
            title="Próximo dia"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetToCurrentShift}
            className="text-xs text-purple-600 font-semibold hover:bg-purple-50 h-8.5 px-2.5"
          >
            Hoje
          </Button>
        </div>

        {/* Shift Details Badge */}
        <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 px-3.5 py-1.5 rounded-lg border border-slate-200/60 w-full md:w-auto justify-center md:justify-end">
          <Clock className="w-3.5 h-3.5 text-purple-600" />
          <span>
            Período: <strong>{format(shiftInterval.start, "dd/MM/yyyy HH:mm")}</strong> até <strong>{format(shiftInterval.end, "dd/MM/yyyy HH:mm")}</strong>
          </span>
        </div>
      </div>

      {/* KPI Stats Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Saídas */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dispensações (Saídas)</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-extrabold text-blue-600 dark:text-blue-400">{counts.saidasQtd}</span>
              <span className="text-[10px] text-slate-400 font-medium">({counts.totalUnidadesSaidas} un dispensadas)</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600">
            <PackageMinus className="w-4 h-4" />
          </div>
        </div>

        {/* Card 2: Devoluções & Entradas */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Devoluções / Entradas</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">{counts.devolucoesQtd + counts.entradasQtd}</span>
              <span className="text-[10px] text-slate-400 font-medium">({counts.totalUnidadesEntradas} un retornadas)</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600">
            <RotateCcw className="w-4 h-4" />
          </div>
        </div>

        {/* Card 3: Ocorrências do Farmacêutico */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Anotações do Plantão</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-extrabold text-purple-600 dark:text-purple-400">{counts.ocorrenciasCount}</span>
              <span className="text-[10px] text-slate-400 font-medium">ocorrências / pendências</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/50 flex items-center justify-center text-purple-600">
            <BookmarkCheck className="w-4 h-4" />
          </div>
        </div>

        {/* Card 4: Total de Acontecimentos */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Movimentações no Turno</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-extrabold text-slate-900 dark:text-white">{counts.totalEventos}</span>
              <span className="text-[10px] text-slate-400 font-medium">registros auditados</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Category Pills Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveCategory("todos")}
            className={cn(
              "h-8 rounded-lg text-xs font-bold gap-2 transition-all",
              activeCategory === "todos" 
                ? "bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-400 shadow-xs ring-1 ring-slate-200/80" 
                : "text-slate-600 dark:text-slate-400 hover:bg-white/50"
            )}
          >
            <ClipboardList className="w-3.5 h-3.5 text-purple-600" />
            Tudo do Plantão
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
              activeCategory === "todos" ? "bg-purple-100 text-purple-800" : "bg-slate-200 text-slate-600"
            )}>
              {counts.totalEventos}
            </span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveCategory("ocorrencias")}
            className={cn(
              "h-8 rounded-lg text-xs font-bold gap-2 transition-all",
              activeCategory === "ocorrencias" 
                ? "bg-purple-600 text-white shadow-xs" 
                : "text-slate-600 dark:text-slate-400 hover:bg-white/50"
            )}
          >
            <BookmarkCheck className="w-3.5 h-3.5 text-purple-200" />
            Anotações do Farmacêutico
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
              activeCategory === "ocorrencias" ? "bg-purple-700 text-purple-100" : "bg-slate-200 text-slate-600"
            )}>
              {counts.ocorrenciasCount}
            </span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveCategory("saidas")}
            className={cn(
              "h-8 rounded-lg text-xs font-bold gap-2 transition-all",
              activeCategory === "saidas" 
                ? "bg-blue-600 text-white shadow-xs" 
                : "text-slate-600 dark:text-slate-400 hover:bg-white/50"
            )}
          >
            <PackageMinus className="w-3.5 h-3.5 text-blue-200" />
            Saídas & Dispensações
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
              activeCategory === "saidas" ? "bg-blue-700 text-blue-100" : "bg-slate-200 text-slate-600"
            )}>
              {counts.saidasQtd}
            </span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveCategory("devolucoes")}
            className={cn(
              "h-8 rounded-lg text-xs font-bold gap-2 transition-all",
              activeCategory === "devolucoes" 
                ? "bg-emerald-600 text-white shadow-xs" 
                : "text-slate-600 dark:text-slate-400 hover:bg-white/50"
            )}
          >
            <RotateCcw className="w-3.5 h-3.5 text-emerald-200" />
            Devoluções & Entradas
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
              activeCategory === "devolucoes" ? "bg-emerald-700 text-emerald-100" : "bg-slate-200 text-slate-600"
            )}>
              {counts.devolucoesQtd + counts.entradasQtd}
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
            <LogOut className="w-3.5 h-3.5 text-amber-200" />
            Altas Hospitalares
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
              activeCategory === "altas" ? "bg-amber-700 text-amber-100" : "bg-slate-200 text-slate-600"
            )}>
              {counts.altasCount}
            </span>
          </Button>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Exibindo <strong>{filteredEvents.length}</strong> registro(s) técnico(s)
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Buscar por termo técnico, medicamento, paciente, lote ou tipo de ocorrência..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-9 h-9.5 bg-slate-50/70 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:bg-white transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Timeline Feed Container */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="p-4 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-slate-700 dark:text-slate-200">
              Linha do Tempo Oficial de Ocorrências e Movimentações
            </span>
            <span className="text-[11px] text-slate-400">• Formatação Técnica Hospitalar</span>
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>Farmacêutico: <strong>{farmaceuticoNome}</strong> ({farmaceuticoCrf})</span>
          </div>
        </div>

        <div className="overflow-auto flex-1 p-4 space-y-3">
          {loadingSaidas || loadingEntradas || loadingOcorrencias ? (
            Array(5).fill(0).map((_, i) => (
              <div key={i} className="p-4 rounded-xl border border-slate-200 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center mx-auto">
                <ClipboardList className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Nenhuma movimentação ou ocorrência encontrada para este plantão
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {search 
                    ? "Nenhum resultado corresponde à sua pesquisa." 
                    : "Assim que houver saídas, devoluções ou anotações neste turno, elas aparecerão aqui automaticamente."}
                </p>
              </div>
              <Button
                onClick={() => setOcorrenciaModalOpen(true)}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Ocorrência Manual
              </Button>
            </div>
          ) : (
            filteredEvents.map((ev) => {
              const isSaida = ev.tipoCategoria === "saida";
              const isDevolucao = ev.tipoCategoria === "devolucao";
              const isEntrada = ev.tipoCategoria === "entrada";
              const isAlta = ev.tipoCategoria === "alta";
              const isOcorrencia = ev.tipoCategoria === "ocorrencia";

              return (
                <div 
                  key={ev.id}
                  className={cn(
                    "p-3.5 rounded-xl border transition-all relative flex flex-col gap-2",
                    isOcorrencia 
                      ? "bg-purple-50/40 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/60" 
                      : isDevolucao
                      ? "bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-200/80 dark:border-emerald-800/40"
                      : isEntrada
                      ? "bg-teal-50/30 dark:bg-teal-950/10 border-teal-200/80 dark:border-teal-800/40"
                      : isAlta
                      ? "bg-amber-50/30 dark:bg-amber-950/10 border-amber-200/80 dark:border-amber-800/40"
                      : "bg-white dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/60"
                  )}
                >
                  {/* Card Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {/* Icon Badge */}
                      <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                        isOcorrencia ? "bg-purple-600 text-white" :
                        isDevolucao ? "bg-emerald-600 text-white" :
                        isEntrada ? "bg-teal-600 text-white" :
                        isAlta ? "bg-amber-600 text-white" :
                        "bg-blue-600 text-white"
                      )}>
                        {isOcorrencia ? <BookmarkCheck className="w-4 h-4" /> :
                         isDevolucao ? <RotateCcw className="w-4 h-4" /> :
                         isEntrada ? <Plus className="w-4 h-4" /> :
                         isAlta ? <LogOut className="w-4 h-4" /> :
                         <PackageMinus className="w-4 h-4" />}
                      </div>

                      {/* Title & Category Badge */}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-slate-800 dark:text-slate-100">
                            {ev.titulo}
                          </span>

                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-[10px] font-bold py-0 h-5",
                              isOcorrencia ? "bg-purple-100 text-purple-800 border-purple-300" :
                              isDevolucao ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
                              isEntrada ? "bg-teal-100 text-teal-800 border-teal-300" :
                              isAlta ? "bg-amber-100 text-amber-800 border-amber-300" :
                              "bg-blue-100 text-blue-800 border-blue-300"
                            )}
                          >
                            {isOcorrencia ? (ev.subTipoOcorrencia || "Ocorrência") :
                             isDevolucao ? "Devolução" :
                             isEntrada ? "Entrada" :
                             isAlta ? "Desospitalização" : "Dispensação"}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Time & Quick Actions */}
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded-md border border-slate-200/80 dark:border-slate-600">
                        {format(ev.date, "HH:mm:ss")}
                      </span>

                      {ev.isManual && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (window.confirm("Deseja realmente remover esta anotação do plantão?")) {
                              deleteOcorrenciaMutation.mutate(ev.raw.id);
                            }
                          }}
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          title="Excluir esta anotação"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Technical description text */}
                  <div className="pl-9 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-normal">
                    {ev.textoTecnico}
                  </div>

                  {/* Details Pill Footnotes */}
                  <div className="pl-9 flex flex-wrap items-center gap-2 pt-1">
                    {ev.medicamento && ev.medicamento !== "N/A" && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                        <Pill className="w-3 h-3 text-slate-400" />
                        {ev.medicamento}
                      </span>
                    )}

                    {ev.lote && ev.lote !== "N/A" && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded font-mono">
                        Lote: {ev.lote}
                      </span>
                    )}

                    {ev.quantidade > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                        Qtd: {ev.quantidade} un
                      </span>
                    )}

                    {ev.setorOuPaciente && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        {ev.setorOuPaciente}
                      </span>
                    )}

                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 ml-auto font-mono">
                      Resp: {ev.responsavel} {ev.responsavelCrf ? `(${ev.responsavelCrf})` : ""}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ─── MODAL: NOVA OCORRÊNCIA MANUAL ─────────────────────────────────── */}
      <Dialog open={ocorrenciaModalOpen} onOpenChange={setOcorrenciaModalOpen}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-purple-600" />
              Nova Ocorrência / Anotação do Plantão
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Registre intercorrências, pendências para o próximo turno, alertas clínicos ou observações técnicas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Tipo / Classificação da Ocorrência *
              </label>
              <Select 
                value={novaOcorrencia.tipo} 
                onValueChange={(val) => setNovaOcorrencia(prev => ({ ...prev, tipo: val }))}
              >
                <SelectTrigger className="text-xs h-9.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="Pendência para o Próximo Plantão">🟣 Pendência para o Próximo Plantão</SelectItem>
                  <SelectItem value="Intercorrência Clínica / Paciente">🔵 Intercorrência Clínica / Paciente</SelectItem>
                  <SelectItem value="Alerta de Saldo / Medicamento Crítico">🔴 Alerta de Saldo / Medicamento Crítico</SelectItem>
                  <SelectItem value="Farmacovigilância / Reação Adversa (RAM)">🟠 Farmacovigilância / Reação Adversa</SelectItem>
                  <SelectItem value="Observação Administrativa / Geral">⚪ Observação Administrativa / Geral</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Título ou Assunto Resumido *
              </label>
              <Input
                placeholder="Ex: Paciente leito 12 em agitação / Pendência de conferência armário B..."
                value={novaOcorrencia.titulo}
                onChange={(e) => setNovaOcorrencia(prev => ({ ...prev, titulo: e.target.value }))}
                className="text-xs h-9.5"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Descrição Técnica Detalhada *
              </label>
              <Textarea
                rows={4}
                placeholder="Descreva de forma clara e técnica o que ocorreu ou a orientação precisa para o farmacêutico que assumirá o próximo turno..."
                value={novaOcorrencia.descricao}
                onChange={(e) => setNovaOcorrencia(prev => ({ ...prev, descricao: e.target.value }))}
                className="text-xs resize-none"
              />
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between">
              <div>
                <span>Responsável Técnico: <strong>{farmaceuticoNome}</strong></span>
              </div>
              <span className="font-mono text-slate-500">{farmaceuticoCrf}</span>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOcorrenciaModalOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={() => createOcorrenciaMutation.mutate(novaOcorrencia)}
              disabled={createOcorrenciaMutation.isPending}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs gap-1.5 shadow-sm"
            >
              <SendHorizontal className="w-3.5 h-3.5" />
              Salvar Ocorrência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: DADOS DO FARMACÊUTICO & CRF ──────────────────────────────── */}
      <Dialog open={farmaceuticoModalOpen} onOpenChange={setFarmaceuticoModalOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <User className="w-5 h-5 text-purple-600" />
              Farmacêutico Responsável do Plantão
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Esses dados constarão no relatório impresso e no cabeçalho oficial do plantão.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Nome do Farmacêutico *
              </label>
              <Input
                value={farmaceuticoNome}
                onChange={(e) => setFarmaceuticoNome(e.target.value)}
                placeholder="Ex: Dr. Carlos Eduardo de Souza"
                className="text-xs h-9.5"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Número de Registro CRF *
              </label>
              <Input
                value={farmaceuticoCrf}
                onChange={(e) => setFarmaceuticoCrf(e.target.value)}
                placeholder="Ex: CRF-SP 45.291"
                className="text-xs h-9.5 font-mono"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              size="sm"
              onClick={() => {
                try {
                  const curr = JSON.parse(localStorage.getItem("pharma_user") || "{}");
                  curr.full_name = farmaceuticoNome;
                  curr.crf = farmaceuticoCrf;
                  localStorage.setItem("pharma_user", JSON.stringify(curr));
                } catch (e) {
                  console.warn(e);
                }
                setFarmaceuticoModalOpen(false);
                toast.success("Dados do Farmacêutico atualizados para este plantão!");
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs"
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── ESTILOS ESPECÍFICOS PARA IMPRESSÃO EM 1 ÚNICA FOLHA A4 ─────────── */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 6mm 8mm;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-plantao-sheet, #printable-plantao-sheet * {
            visibility: visible !important;
          }
          #printable-plantao-sheet {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 194mm !important;
            max-height: 284mm !important;
            height: 284mm !important;
            margin: 0 !important;
            padding: 4mm 6mm !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            background: white !important;
            color: #0f172a !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            page-break-after: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* ─── RELATÓRIO OFICIAL PARA IMPRESSÃO / PDF (1 ÚNICA FOLHA A4) ─────────── */}
      <div 
        style={{
          position: "fixed",
          left: "-9999px",
          top: "0",
          width: "210mm",
          zIndex: -9999,
          pointerEvents: "none",
          opacity: 1
        }}
      >
        <div 
          id="printable-plantao-sheet"
          ref={printRef} 
          className="w-[210mm] max-h-[296mm] h-[296mm] p-[8mm] box-border bg-white text-slate-900 flex flex-col justify-between overflow-hidden text-[10.5px]"
          style={{ width: "210mm", height: "296mm", maxHeight: "296mm", boxSizing: "border-box", backgroundColor: "#ffffff" }}
        >
          {/* Topo e Conteúdo */}
          <div className="space-y-2.5 flex-1 flex flex-col min-h-0">
            {/* Header Oficial */}
            <div className="border-b-2 border-purple-800 pb-2 flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-black text-purple-900 tracking-tight">ZORION SAÚDE</span>
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200">
                    Farmácia Satélite
                  </span>
                </div>
                <h2 className="text-sm font-extrabold text-slate-800 mt-0.5 uppercase tracking-wide">
                  Relatório Oficial de Passagem de Plantão
                </h2>
              </div>
              <div className="text-right text-[10px] font-mono text-slate-500 leading-tight">
                <p>Data do Turno: <strong className="text-slate-800">{format(parseISO(selectedDate), "dd/MM/yyyy")}</strong></p>
                <p>Turno: <strong className="text-purple-800">{selectedTurno === 'diurno' ? 'DIURNO (07h às 19h)' : 'NOTURNO (19h às 07h)'}</strong></p>
                <p>Horário: {shiftInterval.periodoFormatado}</p>
                <p className="text-[9px] text-slate-400 mt-0.5">Emissão: {format(new Date(), "dd/MM/yyyy HH:mm")}</p>
              </div>
            </div>

            {/* Dados do Farmacêutico */}
            <div className="p-2 bg-purple-50/70 rounded-md border border-purple-200 grid grid-cols-2 gap-2 text-[10.5px]">
              <div>
                <span className="text-slate-500 font-medium">Farmacêutico(a) Responsável do Plantão:</span>
                <p className="font-bold text-purple-950 text-xs">{farmaceuticoNome}</p>
              </div>
              <div className="text-right">
                <span className="text-slate-500 font-medium">Registro Profissional:</span>
                <p className="font-mono font-bold text-purple-950 text-xs">{farmaceuticoCrf}</p>
              </div>
            </div>

            {/* Quadro Estatístico Compacto */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-1.5 border border-slate-200 rounded-md bg-slate-50">
                <span className="text-[9px] text-slate-500 uppercase font-bold block">Dispensações</span>
                <p className="text-xs font-black text-blue-700">{counts.saidasQtd} ({counts.totalUnidadesSaidas} un)</p>
              </div>
              <div className="p-1.5 border border-slate-200 rounded-md bg-slate-50">
                <span className="text-[9px] text-slate-500 uppercase font-bold block">Devoluções / Entradas</span>
                <p className="text-xs font-black text-emerald-700">{counts.devolucoesQtd + counts.entradasQtd} ({counts.totalUnidadesEntradas} un)</p>
              </div>
              <div className="p-1.5 border border-slate-200 rounded-md bg-slate-50">
                <span className="text-[9px] text-slate-500 uppercase font-bold block">Anotações do Plantão</span>
                <p className="text-xs font-black text-purple-700">{counts.ocorrenciasCount}</p>
              </div>
              <div className="p-1.5 border border-slate-200 rounded-md bg-slate-50">
                <span className="text-[9px] text-slate-500 uppercase font-bold block">Total de Movimentações</span>
                <p className="text-xs font-black text-slate-800">{counts.totalEventos}</p>
              </div>
            </div>

            {/* Seção 1: Ocorrências e Pendências para o Próximo Plantão */}
            <div>
              <h3 className="font-bold text-[10px] uppercase tracking-wider text-slate-800 border-b border-purple-200 pb-0.5 mb-1 flex items-center justify-between">
                <span>1. Ocorrências Clínicas e Pendências para o Próximo Plantão</span>
                <span className="text-[9px] font-normal text-purple-700 font-mono">({timelineEvents.filter(e => e.tipoCategoria === 'ocorrencia').length} registro(s))</span>
              </h3>
              {timelineEvents.filter(e => e.tipoCategoria === "ocorrencia").length === 0 ? (
                <div className="p-1.5 bg-slate-50 rounded border border-slate-200 text-center text-slate-400 italic text-[9.5px]">
                  Nenhuma pendência ou intercorrência manual registrada neste plantão. Plantão decorrido sem alterações.
                </div>
              ) : (
                <div className="space-y-1 max-h-[120px] overflow-hidden">
                  {timelineEvents.filter(e => e.tipoCategoria === "ocorrencia").slice(0, 3).map((oco, idx) => (
                    <div key={idx} className="p-1.5 bg-purple-50/60 rounded border border-purple-200 text-[9.5px]">
                      <div className="flex justify-between font-bold text-purple-900">
                        <span>[{oco.subTipoOcorrencia}] {oco.titulo}</span>
                        <span className="font-mono text-[9px] text-slate-500">{format(oco.date, "HH:mm")}</span>
                      </div>
                      <p className="mt-0.5 text-slate-700 leading-snug line-clamp-2">{oco.textoTecnico}</p>
                    </div>
                  ))}
                  {timelineEvents.filter(e => e.tipoCategoria === "ocorrencia").length > 3 && (
                    <p className="text-[8.5px] text-purple-700 italic text-center">
                      + {timelineEvents.filter(e => e.tipoCategoria === "ocorrencia").length - 3} outra(s) ocorrência(s) registrada(s) em sistema.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Seção 2: Registro Cronológico de Movimentações */}
            <div className="flex-1 flex flex-col min-h-0">
              <h3 className="font-bold text-[10px] uppercase tracking-wider text-slate-800 border-b border-purple-200 pb-0.5 mb-1 flex items-center justify-between">
                <span>2. Registro Técnico Detalhado de Movimentações do Turno</span>
                <span className="text-[9px] font-normal text-slate-500 font-mono">({timelineEvents.filter(e => e.tipoCategoria !== 'ocorrencia').length} registro(s))</span>
              </h3>
              <div className="overflow-hidden border border-slate-200 rounded">
                <table className="w-full text-[9px] border-collapse">
                  <thead>
                    <tr className="bg-purple-900 text-white font-bold">
                      <th className="py-1 px-1.5 text-left w-14">Hora</th>
                      <th className="py-1 px-1.5 text-left w-16">Tipo</th>
                      <th className="py-1 px-1.5 text-left">Descrição Técnica / Medicamento</th>
                      <th className="py-1 px-1.5 text-center w-12">Qtd</th>
                      <th className="py-1 px-1.5 text-left w-24">Destino</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timelineEvents.filter(e => e.tipoCategoria !== "ocorrencia").length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-2.5 text-slate-400 italic">
                          Nenhuma movimentação de saída ou devolução registrada neste turno.
                        </td>
                      </tr>
                    ) : (
                      timelineEvents.filter(e => e.tipoCategoria !== "ocorrencia").slice(0, 8).map((ev, idx) => (
                        <tr key={idx} className="border-b border-slate-200 hover:bg-slate-50">
                          <td className="py-1 px-1.5 font-mono text-[8.5px] text-slate-600">{format(ev.date, "HH:mm")}</td>
                          <td className="py-1 px-1.5 font-bold uppercase text-[8.5px]">
                            <span className={cn(
                              ev.tipoCategoria === "saida" ? "text-blue-700" :
                              ev.tipoCategoria === "devolucao" ? "text-emerald-700" :
                              ev.tipoCategoria === "alta" ? "text-amber-700" : "text-slate-700"
                            )}>
                              {ev.tipoCategoria}
                            </span>
                          </td>
                          <td className="py-1 px-1.5 truncate max-w-[280px]">{ev.textoTecnico}</td>
                          <td className="py-1 px-1.5 text-center font-bold">{ev.quantidade > 0 ? `${ev.quantidade} un` : "-"}</td>
                          <td className="py-1 px-1.5 truncate max-w-[100px]">{ev.setorOuPaciente}</td>
                        </tr>
                      ))
                    )}
                    {timelineEvents.filter(e => e.tipoCategoria !== "ocorrencia").length > 8 && (
                      <tr className="bg-slate-50">
                        <td colSpan={5} className="py-1 px-2 text-center text-[8.5px] text-slate-500 italic">
                          [... e mais {timelineEvents.filter(e => e.tipoCategoria !== "ocorrencia").length - 8} movimentação(ões) auditadas em sistema ...]
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Rodapé com Assinaturas Oficiais (Sem quebra de folha) */}
          <div className="pt-2 border-t border-slate-300 shrink-0">
            <div className="grid grid-cols-2 gap-6 text-center text-[9.5px]">
              <div className="space-y-3">
                <div className="border-b border-slate-400 w-4/5 mx-auto" />
                <div>
                  <p className="font-bold text-slate-800 text-[11px]">{farmaceuticoNome}</p>
                  <p className="text-[9.5px] text-slate-500 font-mono">CRF: {farmaceuticoCrf}</p>
                  <p className="text-[8.5px] text-slate-400 uppercase font-semibold mt-0.5">Farmacêutico(a) que ENTREGA o Plantão</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="border-b border-slate-400 w-4/5 mx-auto" />
                <div>
                  <p className="font-bold text-slate-800 text-[11px]">Farmacêutico(a) Sucessor</p>
                  <p className="text-[9.5px] text-slate-500 font-mono">CRF: _______________________</p>
                  <p className="text-[8.5px] text-slate-400 uppercase font-semibold mt-0.5">Farmacêutico(a) que ASSUME o Plantão</p>
                </div>
              </div>
            </div>

            <div className="mt-1.5 text-center text-[8px] text-slate-400 font-mono">
              Documento emitido eletronicamente pelo Sistema ZORION SAÚDE • Emissão de Folha Única • Registro Imutável
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
