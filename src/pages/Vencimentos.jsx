import { useState, useMemo, useRef } from "react";
import { db } from "@/api/db";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { differenceInDays, parseISO, isValid, format, subMonths, startOfMonth, endOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import {
  CalendarX2,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Filter,
  Printer,
  Download,
  Trash2,
  BarChart2,
  History,
  PackageMinus,
  Building2,
  Layers,
  ShieldAlert,
  ArrowDownCircle,
  FileSpreadsheet,
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { isMav } from "@/utils/mavUtils";
import { cn } from "@/lib/utils";
import RetirarEstoquePerdaModal from "@/components/vencimentos/RetirarEstoquePerdaModal";

// ─── Paleta de cores por categoria ───────────────────────────────────────────
const CATEGORIA_COLORS = [
  { bg: "bg-violet-100", text: "text-violet-700", border: "border-violet-200", dot: "bg-violet-500" },
  { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-200", dot: "bg-blue-500" },
  { bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
  { bg: "bg-pink-100", text: "text-pink-700", border: "border-pink-200", dot: "bg-pink-500" },
  { bg: "bg-cyan-100", text: "text-cyan-700", border: "border-cyan-200", dot: "bg-cyan-500" },
  { bg: "bg-fuchsia-100", text: "text-fuchsia-700", border: "border-fuchsia-200", dot: "bg-fuchsia-500" },
  { bg: "bg-lime-100", text: "text-lime-700", border: "border-lime-200", dot: "bg-lime-500" },
  { bg: "bg-teal-100", text: "text-teal-700", border: "border-teal-200", dot: "bg-teal-500" },
  { bg: "bg-rose-100", text: "text-rose-700", border: "border-rose-200", dot: "bg-rose-500" },
  { bg: "bg-indigo-100", text: "text-indigo-700", border: "border-indigo-200", dot: "bg-indigo-500" },
  { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" },
  { bg: "bg-sky-100", text: "text-sky-700", border: "border-sky-200", dot: "bg-sky-500" },
];

let _catMap = {};
let _catCounter = 0;
function getGrupoColor(categoria) {
  const key = (categoria || "Sem categoria").toLowerCase().trim();
  if (!_catMap[key]) {
    _catMap[key] = CATEGORIA_COLORS[_catCounter % CATEGORIA_COLORS.length];
    _catCounter++;
  }
  return _catMap[key];
}

// ─── Faixas de urgência e Abas ────────────────────────────────────────────────
const TABS = [
  {
    key: "vencidos",
    label: "Vencidos",
    icon: XCircle,
    iconColor: "text-red-600",
    activeBg: "bg-red-600",
    activeText: "text-white",
    inactiveBg: "bg-white hover:bg-red-50",
    inactiveText: "text-red-600",
    border: "border-red-300",
    cardBg: "bg-red-50",
    cardBorder: "border-red-200",
    rowHighlight: "bg-red-50",
    badgeCls: "bg-red-100 text-red-800",
    filter: (dias) => dias < 0,
    diasLabel: (dias) => `${Math.abs(dias)}d atrás`,
    diasCls: "text-red-700 font-black",
    emptyMsg: "Nenhum medicamento vencido com estoque ativo na Central ou Satélite.",
  },
  {
    key: "30dias",
    label: "Até 30 dias",
    icon: AlertTriangle,
    iconColor: "text-orange-600",
    activeBg: "bg-orange-600",
    activeText: "text-white",
    inactiveBg: "bg-white hover:bg-orange-50",
    inactiveText: "text-orange-600",
    border: "border-orange-300",
    cardBg: "bg-orange-50",
    cardBorder: "border-orange-200",
    rowHighlight: "bg-orange-50",
    badgeCls: "bg-orange-100 text-orange-800",
    filter: (dias) => dias >= 0 && dias <= 30,
    diasLabel: (dias) => `${dias}d`,
    diasCls: "text-orange-700 font-bold",
    emptyMsg: "Nenhum medicamento vencendo nos próximos 30 dias.",
  },
  {
    key: "60dias",
    label: "31–60 dias",
    icon: Clock,
    iconColor: "text-yellow-600",
    activeBg: "bg-yellow-500",
    activeText: "text-white",
    inactiveBg: "bg-white hover:bg-yellow-50",
    inactiveText: "text-yellow-700",
    border: "border-yellow-300",
    cardBg: "bg-yellow-50",
    cardBorder: "border-yellow-200",
    rowHighlight: "bg-yellow-50",
    badgeCls: "bg-yellow-100 text-yellow-800",
    filter: (dias) => dias >= 31 && dias <= 60,
    diasLabel: (dias) => `${dias}d`,
    diasCls: "text-yellow-700 font-semibold",
    emptyMsg: "Nenhum medicamento vencendo entre 31 e 60 dias.",
  },
  {
    key: "120dias",
    label: "61–120 dias",
    icon: CheckCircle2,
    iconColor: "text-amber-600",
    activeBg: "bg-amber-500",
    activeText: "text-white",
    inactiveBg: "bg-white hover:bg-amber-50",
    inactiveText: "text-amber-700",
    border: "border-amber-300",
    cardBg: "bg-amber-50",
    cardBorder: "border-amber-200",
    rowHighlight: "bg-amber-50",
    badgeCls: "bg-amber-100 text-amber-800",
    filter: (dias) => dias >= 61 && dias <= 120,
    diasLabel: (dias) => `${dias}d`,
    diasCls: "text-amber-700",
    emptyMsg: "Nenhum medicamento vencendo entre 61 e 120 dias.",
  },
  {
    key: "mmc",
    label: "MMC (Análise)",
    icon: BarChart2,
    iconColor: "text-indigo-600",
    activeBg: "bg-indigo-600",
    activeText: "text-white",
    inactiveBg: "bg-white hover:bg-indigo-50",
    inactiveText: "text-indigo-700",
    border: "border-indigo-300",
    cardBg: "bg-indigo-50",
    cardBorder: "border-indigo-200",
    rowHighlight: "bg-indigo-50",
    badgeCls: "bg-indigo-100 text-indigo-800",
    filter: (dias) => dias >= 0 && dias <= 120,
    diasLabel: (dias) => `${dias}d`,
    diasCls: "text-indigo-700 font-bold",
    emptyMsg: "Nenhum medicamento com vencimento próximo (1-120 dias) para analisar o MMC.",
  },
  {
    key: "historico",
    label: "Histórico de Perdas",
    icon: History,
    iconColor: "text-rose-600",
    activeBg: "bg-rose-600",
    activeText: "text-white",
    inactiveBg: "bg-white hover:bg-rose-50",
    inactiveText: "text-rose-700",
    border: "border-rose-300",
    cardBg: "bg-rose-50",
    cardBorder: "border-rose-200",
    rowHighlight: "bg-rose-50",
    badgeCls: "bg-rose-100 text-rose-800",
    filter: () => false,
    diasLabel: () => "",
    diasCls: "",
    emptyMsg: "Nenhum descarte ou baixa registrada como perda até o momento.",
  },
];

// ─── Barra de urgência visual ──────────────────────────────────────────────────
function UrgencyBar({ dias }) {
  if (dias < 0) {
    return (
      <div className="w-full h-1.5 rounded-full bg-red-200 overflow-hidden">
        <div className="h-full w-full bg-red-600 rounded-full" />
      </div>
    );
  }
  const max = 120;
  const pct = Math.min(100, Math.max(0, 100 - (dias / max) * 100));
  const barColor =
    dias <= 30 ? "bg-orange-500" : dias <= 60 ? "bg-yellow-400" : "bg-amber-400";
  return (
    <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function Vencimentos() {
  const printRef = useRef();
  const queryClient = useQueryClient();
  const [abaAtiva, setAbaAtiva] = useState("vencidos");
  const [search, setSearch] = useState("");
  const [filterGrupo, setFilterGrupo] = useState("all");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedLoteParaPerda, setSelectedLoteParaPerda] = useState(null);

  const hoje = new Date();

  const { data: medicamentos = [], isLoading: loadingMeds } = useQuery({
    queryKey: ["medicamentos"],
    queryFn: () => db.entities.Medicamento.list(),
  });

  const { data: lotes = [], isLoading: loadingLotes } = useQuery({
    queryKey: ["lotes"],
    queryFn: () => db.entities.Lote.list(),
  });

  const { data: saidas = [], isLoading: loadingSaidas } = useQuery({
    queryKey: ["saidas"],
    queryFn: () => db.entities.Saida.list(),
  });

  const isLoading = loadingMeds || loadingLotes || loadingSaidas;

  // Histórico de saídas classificadas como perda ou descarte
  const historicoPerdas = useMemo(() => {
    return saidas
      .filter((s) => {
        const t = (s.tipo || s.tipo_saida || "").toLowerCase();
        const dest = (s.destino || "").toLowerCase();
        const ala = (s.ala_nome || "").toLowerCase();
        const mot = (s.motivo || "").toLowerCase();
        const obs = (s.observacao || "").toLowerCase();
        return (
          t === "perda" ||
          t === "descarte" ||
          dest.includes("perda") ||
          dest.includes("descarte") ||
          ala.includes("perda") ||
          ala.includes("descarte") ||
          mot.includes("perda") ||
          mot.includes("descarte") ||
          obs.includes("perda") ||
          obs.includes("descarte")
        );
      })
      .sort((a, b) => new Date(b.data_saida || b.created_at || 0) - new Date(a.data_saida || a.created_at || 0));
  }, [saidas]);

  const consumoMMC = useMemo(() => {
    const mesAtualInicio = startOfMonth(hoje);
    const mmcDataFim = endOfDay(subDays(mesAtualInicio, 1));
    const mmcDataInicio = startOfMonth(subMonths(mesAtualInicio, 4));

    const consumo = {};
    saidas.forEach((s) => {
      if (!s.data_saida) return;
      const data = parseISO(s.data_saida);
      if (isValid(data) && data >= mmcDataInicio && data <= mmcDataFim) {
        consumo[s.medicamento_id] = (consumo[s.medicamento_id] || 0) + (Number(s.quantidade) || 0);
      }
    });
    return consumo;
  }, [saidas, hoje]);

  // Enriquecer lotes considerando AMBOS os estoques: Central e Satélite
  const lotesEnriquecidos = useMemo(() => {
    return lotes
      .filter((l) => {
        const qtdCentral = Math.max(0, Number(l.quantidade_atual) || 0);
        const qtdSat = Math.max(0, Number(l.quantidade_satelite) || 0);
        const qtdTotal = qtdCentral + qtdSat;
        if (qtdTotal <= 0) return false;
        if (!l.data_validade) return false;
        const parsedDate = parseISO(l.data_validade);
        if (!isValid(parsedDate)) return false;
        const dias = differenceInDays(parsedDate, hoje);
        return dias < 0 || dias <= 120;
      })
      .map((l) => {
        const med = medicamentos.find((m) => String(m.id) === String(l.medicamento_id || l.medicamentoId));
        const parsedDate = parseISO(l.data_validade);
        const dias = differenceInDays(parsedDate, hoje);
        const qtdCentral = Math.max(0, Number(l.quantidade_atual) || 0);
        const qtdSat = Math.max(0, Number(l.quantidade_satelite) || 0);
        const qtdTotal = qtdCentral + qtdSat;
        return {
          ...l,
          qtdCentral,
          qtdSat,
          qtdTotal,
          medicamento_nome_display: l.medicamento_nome || med?.nome || "Desconhecido",
          codigo: med?.codigo || "S/C",
          categoria: med?.categoria || "Sem categoria",
          dias,
          validadeFormatada: isValid(parsedDate) ? format(parsedDate, "dd/MM/yyyy", { locale: ptBR }) : "—",
        };
      })
      .sort((a, b) => a.dias - b.dias);
  }, [lotes, medicamentos, hoje]);

  // Contadores por aba
  const contadores = useMemo(() => {
    const r = {};
    TABS.forEach((tab) => {
      if (tab.key === "historico") {
        r[tab.key] = historicoPerdas.length;
      } else {
        r[tab.key] = lotesEnriquecidos.filter((l) => tab.filter(l.dias)).length;
      }
    });
    return r;
  }, [lotesEnriquecidos, historicoPerdas]);

  // Categorias disponíveis
  const categorias = useMemo(() => {
    const s = new Set(lotesEnriquecidos.map((l) => l.grupo_terapeutico || l.categoria));
    return Array.from(s).filter(Boolean).sort();
  }, [lotesEnriquecidos]);

  // Aba e filtros ativos
  const tabAtual = TABS.find((t) => t.key === abaAtiva);
  const TabIcon = tabAtual?.icon;

  const itensFiltrados = useMemo(() => {
    if (abaAtiva === "historico") return [];
    return lotesEnriquecidos
      .filter((l) => tabAtual?.filter(l.dias))
      .filter((l) => {
        if (filterGrupo !== "all" && l.grupo_terapeutico !== filterGrupo && l.categoria !== filterGrupo) return false;
        if (search) {
          const s = search.toLowerCase();
          return (
            l.medicamento_nome_display?.toLowerCase().includes(s) ||
            l.numero_lote?.toLowerCase().includes(s) ||
            l.codigo?.toLowerCase().includes(s) ||
            l.grupo_terapeutico?.toLowerCase().includes(s)
          );
        }
        return true;
      });
  }, [lotesEnriquecidos, tabAtual, search, filterGrupo, abaAtiva]);

  // Filtro do histórico de perdas
  const historicoFiltrado = useMemo(() => {
    if (abaAtiva !== "historico") return [];
    return historicoPerdas.filter((s) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (s.medicamento_nome || "").toLowerCase().includes(q) ||
        (s.numero_lote || "").toLowerCase().includes(q) ||
        (s.motivo || "").toLowerCase().includes(q) ||
        (s.observacao || "").toLowerCase().includes(q) ||
        (s.responsavel || "").toLowerCase().includes(q) ||
        (s.ala_nome || "").toLowerCase().includes(q) ||
        (s.destino || "").toLowerCase().includes(q)
      );
    });
  }, [historicoPerdas, abaAtiva, search]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    try {
      toast.loading("Gerando PDF...");
      const element = printRef.current;
      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }
      pdf.save(`vencimentos-${format(hoje, "dd-MM-yyyy")}.pdf`);
      toast.dismiss();
      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error("Erro ao gerar PDF");
    }
  };

  // Limpeza de todos os vencidos de Central e Satélite em lote único atômico
  const limparVencidosMutation = useMutation({
    mutationFn: async () => {
      const lotesVencidos = lotesEnriquecidos.filter((l) => l.dias < 0 && l.qtdTotal > 0);
      if (lotesVencidos.length === 0) return;

      let responsavel = "Farmacêutico";
      try {
        const rawU = localStorage.getItem("pharma_user");
        if (rawU) {
          const u = JSON.parse(rawU);
          responsavel = u.full_name || u.nome || u.login || "Farmacêutico";
        }
      } catch (e) {}

      const baixaGrupoId = crypto.randomUUID();
      const nowStr = new Date().toISOString();
      const sqlStatements = [];

      const medDebitosCentral = {};
      const medDebitosSatelite = {};

      for (const lote of lotesVencidos) {
        const qtdC = lote.qtdCentral || 0;
        const qtdS = lote.qtdSat || 0;
        const medId = lote.medicamento_id || lote.medicamentoId;

        // Baixa Central
        if (qtdC > 0) {
          sqlStatements.push(
            db.buildInsertSql("Saida", {
              medicamento_id: medId,
              medicamento_nome: lote.medicamento_nome_display,
              lote_id: lote.id,
              numero_lote: lote.numero_lote,
              quantidade: qtdC,
              destino: "Descarte / Perda por Vencimento (Central)",
              ala_nome: "Almoxarifado Central (Perda)",
              motivo: "Perda / Descarte: Limpeza em Massa de Vencidos",
              observacao: `[Baixa por Perda em Massa] Retirado da Farmácia Central: ${qtdC} un | Lote: ${lote.numero_lote} (Validade: ${lote.validadeFormatada})`,
              tipo: "perda",
              tipo_saida: "perda",
              data_saida: nowStr,
              responsavel,
              baixa_grupo_id: baixaGrupoId,
            })
          );
          if (medId) {
            medDebitosCentral[medId] = (medDebitosCentral[medId] || 0) + qtdC;
          }
        }

        // Baixa Satélite
        if (qtdS > 0) {
          sqlStatements.push(
            db.buildInsertSql("Saida", {
              medicamento_id: medId,
              medicamento_nome: lote.medicamento_nome_display,
              lote_id: lote.id,
              numero_lote: lote.numero_lote,
              quantidade: qtdS,
              destino: "Descarte / Perda por Vencimento (Satélite)",
              ala_nome: "Farmácia Satélite (Perda)",
              motivo: "Perda / Descarte: Limpeza em Massa de Vencidos",
              observacao: `[Baixa por Perda em Massa] Retirado da Farmácia Satélite: ${qtdS} un | Lote: ${lote.numero_lote} (Validade: ${lote.validadeFormatada})`,
              tipo: "perda",
              tipo_saida: "perda",
              data_saida: nowStr,
              responsavel,
              baixa_grupo_id: baixaGrupoId,
            })
          );
          if (medId) {
            medDebitosSatelite[medId] = (medDebitosSatelite[medId] || 0) + qtdS;
          }
        }

        // Zerar lote (ambos os estoques)
        sqlStatements.push(
          db.buildUpdateSql("Lote", lote.id, {
            quantidade_atual: 0,
            quantidade_satelite: 0,
            status: "esgotado",
          })
        );
      }

      // Atualizar estoques consolidados dos medicamentos afetados
      const allMedIds = new Set([...Object.keys(medDebitosCentral), ...Object.keys(medDebitosSatelite)]);
      for (const medId of allMedIds) {
        const med = medicamentos.find((m) => String(m.id) === String(medId));
        if (med) {
          const debC = medDebitosCentral[medId] || 0;
          const debS = medDebitosSatelite[medId] || 0;
          sqlStatements.push(
            db.buildUpdateSql("Medicamento", med.id, {
              estoque_atual: Math.max(0, (Number(med.estoque_atual) || 0) - debC),
              estoque_satelite: Math.max(0, (Number(med.estoque_satelite) || 0) - debS),
            })
          );
        }
      }

      await db.batchExecute(sqlStatements, {
        auditAction: "LIMPEZA_MASSA_VENCIDOS",
        auditEntity: "Saida",
        auditDetails: `Limpeza em massa de ${lotesVencidos.length} lotes vencidos (Central e Satélite) por ${responsavel}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medicamentos"] });
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      queryClient.invalidateQueries({ queryKey: ["saidas"] });
      setConfirmOpen(false);
      toast.success("Todos os medicamentos vencidos foram baixados como perda e registrados no histórico!");
    },
    onError: (error) => {
      toast.error("Erro ao limpar vencidos: " + error.message);
    },
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600 shadow-xs">
              <CalendarX2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                Controle de Vencimentos & Perdas
                <Badge variant="outline" className="text-xs bg-slate-50 text-slate-600 border-slate-200">
                  Central & Satélite
                </Badge>
              </h1>
              <p className="text-slate-500 text-sm">
                Monitoramento preventivo, baixa de estoques vencidos como perda e histórico oficial de descarte
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 no-print self-end sm:self-auto">
          <Button onClick={handlePrint} variant="outline" className="gap-2 bg-white">
            <Printer className="w-4 h-4" />
            Imprimir
          </Button>
          <Button onClick={handleExportPDF} className="gap-2 bg-red-600 hover:bg-red-700 text-white border-0">
            <Download className="w-4 h-4" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Resumo cards (Abas) */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = abaAtiva === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setAbaAtiva(tab.key)}
                className={`
                  rounded-xl border-2 p-3.5 text-left transition-all duration-200 cursor-pointer
                  ${
                    isActive
                      ? `${tab.activeBg} ${tab.activeText} border-transparent shadow-lg scale-[1.02]`
                      : `bg-white ${tab.border} hover:shadow-md`
                  }
                `}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : tab.iconColor}`} />
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider truncate ${
                      isActive ? "text-white/90" : "text-slate-600"
                    }`}
                  >
                    {tab.label}
                  </span>
                </div>
                <p className={`text-2xl font-black leading-none ${isActive ? "text-white" : tab.iconColor}`}>
                  {contadores[tab.key] || 0}
                </p>
                <p className={`text-[10px] mt-1.5 font-medium ${isActive ? "text-white/70" : "text-slate-400"}`}>
                  {tab.key === "historico"
                    ? (contadores[tab.key] === 1 ? "registro de perda" : "registros de perdas")
                    : (contadores[tab.key] === 1 ? "lote ativo" : "lotes ativos")}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Legenda de categorias (somente se não estiver no histórico) */}
      {!isLoading && abaAtiva !== "historico" && categorias.length > 0 && (
        <Card className="p-4 border-0 shadow-xs">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" /> Filtrar por Categoria Terapêutica
          </p>
          <div className="flex flex-wrap gap-2">
            {categorias.map((cat) => {
              const c = getGrupoColor(cat);
              const isSelected = filterGrupo === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setFilterGrupo(isSelected ? "all" : cat)}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all cursor-pointer
                    ${
                      isSelected
                        ? `${c.bg} ${c.text} ${c.border} shadow-sm scale-105 ring-2 ring-indigo-400`
                        : `bg-white ${c.border} ${c.text} hover:${c.bg}`
                    }
                  `}
                >
                  <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                  {cat}
                </button>
              );
            })}
            {filterGrupo !== "all" && (
              <button
                onClick={() => setFilterGrupo("all")}
                className="px-3 py-1.5 rounded-full border border-slate-200 text-xs font-medium text-slate-500 hover:bg-slate-50 cursor-pointer"
              >
                × Limpar filtro
              </button>
            )}
          </div>
        </Card>
      )}

      {/* Busca */}
      <Card className="p-3.5 border-0 shadow-xs">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder={
              abaAtiva === "historico"
                ? "Buscar no histórico por medicamento, lote, motivo, responsável ou observação..."
                : "Buscar por medicamento, lote, código ou categoria..."
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-10 text-sm bg-white"
          />
        </div>
      </Card>

      <div ref={printRef} className="print-only-container">
        {/* VIEW: Histórico de Perdas */}
        {abaAtiva === "historico" ? (
          <Card className="border-0 shadow-xs overflow-hidden">
            <div className="px-6 py-4 bg-rose-50 border-b border-rose-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-rose-600" />
                <div>
                  <h2 className="font-bold text-base text-rose-800">
                    Histórico Oficial de Baixas por Perda & Descarte
                  </h2>
                  <p className="text-xs text-rose-600">
                    Registro de todas as medicações retiradas dos estoques Central e Satélite com baixa de perda
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                {historicoFiltrado.length} {historicoFiltrado.length === 1 ? "registro" : "registros"}
              </span>
            </div>

            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : historicoFiltrado.length === 0 ? (
              <div className="text-center py-16 px-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">Nenhum registro de perda encontrado.</p>
                <p className="text-slate-400 text-xs mt-1">
                  Quando você retirar medicações vencidas usando o botão "Retirar Estoque", elas serão listadas aqui como perdas.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                      <th className="text-left py-3 px-4">Data / Hora</th>
                      <th className="text-left py-3 px-4">Medicamento</th>
                      <th className="text-left py-3 px-4">Lote</th>
                      <th className="text-center py-3 px-4">Origem</th>
                      <th className="text-center py-3 px-4">Qtd. Baixada</th>
                      <th className="text-left py-3 px-4">Motivo da Perda</th>
                      <th className="text-left py-3 px-4">Responsável</th>
                      <th className="text-left py-3 px-4">Detalhes / Obs</th>
                      <th className="text-center py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {historicoFiltrado.map((saida, idx) => {
                      const dataFormatada = saida.data_saida
                        ? format(new Date(saida.data_saida), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : "—";
                      const isSat =
                        saida.ala_nome?.toLowerCase().includes("satélite") ||
                        saida.destino?.toLowerCase().includes("satélite");

                      return (
                        <tr
                          key={saida.id || idx}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            idx % 2 === 0 ? "bg-white" : "bg-slate-50/30"
                          }`}
                        >
                          <td className="py-3 px-4 text-xs font-mono text-slate-600 whitespace-nowrap">
                            {dataFormatada}
                          </td>
                          <td className="py-3 px-4">
                            <p
                              className={cn(
                                "font-semibold text-slate-800 leading-tight",
                                isMav(saida.medicamento_nome) && "text-red-900 font-bold"
                              )}
                            >
                              {saida.medicamento_nome}
                              {isMav(saida.medicamento_nome) && (
                                <span className="ml-1.5 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">
                                  MAV
                                </span>
                              )}
                            </p>
                          </td>
                          <td className="py-3 px-4 text-xs font-mono text-slate-600">
                            {saida.numero_lote || "S/ Lote"}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isSat ? (
                              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                                <Building2 className="w-3 h-3 mr-1" />
                                Satélite
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                                <Layers className="w-3 h-3 mr-1" />
                                Central
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="font-bold text-red-600 text-sm">
                              -{Number(saida.quantidade || 0).toLocaleString("pt-BR")} un
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-xs font-medium text-slate-700">
                              {saida.motivo || "Perda / Descarte"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600">
                            {saida.responsavel || "Farmacêutico"}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-500 max-w-xs truncate" title={saida.observacao}>
                            {saida.observacao || "—"}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200 text-[10px] uppercase font-bold">
                              Baixa Efetuada
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ) : (
          /* VIEW: Lotes Ativos por Faixa de Vencimento ou MMC */
          <Card className="border-0 shadow-xs overflow-hidden">
            {tabAtual && (
              <div
                className={`px-6 py-4 ${tabAtual.cardBg} border-b ${tabAtual.cardBorder} flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3`}
              >
                <div className="flex items-center gap-2">
                  {TabIcon && <TabIcon className={`w-5 h-5 ${tabAtual.iconColor}`} />}
                  <div>
                    <h2 className={`font-bold text-base ${tabAtual.iconColor}`}>
                      {tabAtual.label}
                      {tabAtual.key === "vencidos" && " — Estoque Central & Satélite"}
                      {tabAtual.key === "30dias" && " — Crítico"}
                      {tabAtual.key === "60dias" && " — Atenção"}
                      {tabAtual.key === "120dias" && " — Vigilância preventiva"}
                    </h2>
                    <p className="text-xs text-slate-500">
                      Visualize saldos da Central e Satélite e dê baixa como perda quando necessário
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {tabAtual.key === "vencidos" && itensFiltrados.length > 0 && (
                    <Button
                      onClick={() => setConfirmOpen(true)}
                      size="sm"
                      className="bg-red-600 hover:bg-red-700 text-white gap-2 shadow-xs font-semibold cursor-pointer"
                      disabled={limparVencidosMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                      Limpar Vencidos de Ambos os Estoques
                    </Button>
                  )}
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${tabAtual.badgeCls}`}>
                    {itensFiltrados.length} {itensFiltrados.length === 1 ? "item" : "itens"}
                  </span>
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : itensFiltrados.length === 0 ? (
              <div className="text-center py-16">
                <CheckCircle2 className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">{tabAtual?.emptyMsg}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                {abaAtiva === "mmc" ? (
                  /* Tabela MMC */
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Código
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Medicamento
                        </th>
                        <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Lote
                        </th>
                        <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Validade
                        </th>
                        <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Dias Restantes
                        </th>
                        <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Central
                        </th>
                        <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Satélite
                        </th>
                        <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Total
                        </th>
                        <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          MMC
                        </th>
                        <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Situação Estimada
                        </th>
                        <th className="text-center py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider no-print">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {itensFiltrados.map((lote, idx) => {
                        const mmcTotal = consumoMMC[lote.medicamento_id] || 0;
                        const mmc = Math.ceil(mmcTotal / 4);

                        const mesesAteVencer = Math.max(0.1, lote.dias / 30);
                        const consumoEstimado = mmc * mesesAteVencer;
                        const vaiUsarTudo = consumoEstimado >= lote.qtdTotal;

                        const mesesCobertura = mmc > 0 ? lote.qtdTotal / mmc : Infinity;
                        const coberturaLabel =
                          mmc === 0 ? "Sem consumo" : mesesCobertura > 24 ? "+24 meses" : `${mesesCobertura.toFixed(1)} meses`;
                        const coberturaVsVencer =
                          mmc > 0 ? Math.min(100, (lote.qtdTotal / Math.max(1, consumoEstimado)) * 100) : 100;

                        return (
                          <tr
                            key={lote.id}
                            className={`hover:bg-slate-50/40 transition-colors ${
                              idx % 2 === 0 ? "bg-white" : "bg-slate-50/20"
                            }`}
                          >
                            <td className="py-3 px-4 text-xs font-mono text-slate-500">{lote.codigo}</td>
                            <td className="py-3 px-4">
                              <p
                                className={cn(
                                  "font-semibold text-slate-800 text-sm leading-tight",
                                  isMav(lote.medicamento_nome_display) && "text-red-900 font-bold"
                                )}
                              >
                                {lote.medicamento_nome_display} {isMav(lote.medicamento_nome_display) && "(MAV)"}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-0.5">{lote.grupo_terapeutico}</p>
                            </td>
                            <td className="py-3 px-4 text-xs font-mono text-slate-600">{lote.numero_lote}</td>
                            <td className="py-3 px-4 text-center text-sm text-slate-700">{lote.validadeFormatada}</td>
                            <td className="py-3 px-4 text-center font-bold text-indigo-700">{lote.dias}d</td>

                            {/* Saldos */}
                            <td className="py-3 px-4 text-center font-semibold text-blue-700 text-sm">
                              {lote.qtdCentral.toLocaleString("pt-BR")}
                            </td>
                            <td className="py-3 px-4 text-center font-semibold text-purple-700 text-sm">
                              {lote.qtdSat.toLocaleString("pt-BR")}
                            </td>
                            <td className="py-3 px-4 text-center font-black text-slate-800 text-sm">
                              {lote.qtdTotal.toLocaleString("pt-BR")}
                            </td>

                            {/* MMC */}
                            <td className="py-3 px-4">
                              <div className="min-w-[120px]">
                                {mmc === 0 ? (
                                  <div className="text-center">
                                    <span className="text-xs text-slate-400 italic">Sem histórico</span>
                                    <p className="text-[10px] text-slate-300 mt-0.5">Nenhuma saída registrada</p>
                                  </div>
                                ) : (
                                  <>
                                    <div className="flex items-baseline gap-1 justify-center">
                                      <span className="font-bold text-indigo-700 text-base">{mmc.toLocaleString("pt-BR")}</span>
                                      <span className="text-[10px] text-slate-400 font-medium">un/mês</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 text-center mt-0.5">
                                      Cobre: <span className="font-semibold text-slate-600">{coberturaLabel}</span>
                                    </p>
                                    <div className="mt-1.5 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full transition-all ${
                                          vaiUsarTudo ? "bg-emerald-500" : "bg-amber-400"
                                        }`}
                                        style={{ width: `${coberturaVsVencer}%` }}
                                      />
                                    </div>
                                  </>
                                )}
                              </div>
                            </td>

                            {/* Situação */}
                            <td className="py-3 px-4 text-center">
                              {vaiUsarTudo ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> OK — Dá pra usar tudo
                                </span>
                              ) : (
                                <div>
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                    <AlertTriangle className="w-3.5 h-3.5" /> Fazer doação/troca
                                  </span>
                                  {mmc > 0 && (
                                    <p className="text-[10px] text-slate-400 mt-1">
                                      Sobra est.{" "}
                                      <span className="font-semibold text-amber-600">
                                        ~{Math.max(0, Math.round(lote.qtdTotal - consumoEstimado)).toLocaleString("pt-BR")} un
                                      </span>
                                    </p>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* Ações */}
                            <td className="py-3 px-4 text-center no-print">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedLoteParaPerda(lote)}
                                className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200 hover:border-red-300 font-semibold text-xs h-8 px-2.5 gap-1.5 cursor-pointer"
                                title="Retirar do estoque (Central / Satélite / Ambos) e registrar perda"
                              >
                                <PackageMinus className="w-3.5 h-3.5 text-red-600" />
                                Retirar Estoque
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  /* Tabela Padrão de Vencimento com Estoques Central e Satélite */
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-xs font-semibold uppercase tracking-wider">
                        <th className="text-left py-3 px-4">Código</th>
                        <th className="text-left py-3 px-4">Medicamento</th>
                        <th className="text-left py-3 px-4">Categoria</th>
                        <th className="text-left py-3 px-4">Lote</th>
                        <th className="text-center py-3 px-4">Validade</th>
                        <th className="text-center py-3 px-4">Dias</th>
                        <th className="text-center py-3 px-3">
                          <span className="flex items-center justify-center gap-1 text-blue-700">
                            <Layers className="w-3.5 h-3.5" /> Central
                          </span>
                        </th>
                        <th className="text-center py-3 px-3">
                          <span className="flex items-center justify-center gap-1 text-purple-700">
                            <Building2 className="w-3.5 h-3.5" /> Satélite
                          </span>
                        </th>
                        <th className="text-center py-3 px-3 font-bold text-slate-800">Total</th>
                        <th className="text-center py-3 px-4 w-28">Urgência</th>
                        <th className="text-center py-3 px-4 w-40 no-print">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {itensFiltrados.map((lote, idx) => {
                        const catColor = getGrupoColor(lote.grupo_terapeutico || lote.categoria);
                        const isVencido = lote.dias < 0;

                        return (
                          <tr
                            key={lote.id}
                            className={`hover:brightness-[0.98] transition-colors ${
                              isVencido ? "bg-red-50/60" : idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                            }`}
                          >
                            <td className="py-3 px-4 text-xs font-mono text-slate-500">{lote.codigo}</td>
                            <td className="py-3 px-4">
                              <p
                                className={cn(
                                  "font-semibold text-slate-800 leading-tight",
                                  isMav(lote.medicamento_nome_display) && "text-red-900 font-bold"
                                )}
                              >
                                {lote.medicamento_nome_display}
                                {isMav(lote.medicamento_nome_display) && (
                                  <span className="ml-1.5 text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">
                                    MAV
                                  </span>
                                )}
                              </p>
                            </td>
                            <td className="py-3 px-4">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${catColor.bg} ${catColor.text} ${catColor.border}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${catColor.dot}`} />
                                {lote.grupo_terapeutico || lote.categoria}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-xs font-mono text-slate-600">{lote.numero_lote}</td>
                            <td className="py-3 px-4 text-center text-slate-700 font-medium whitespace-nowrap">
                              {lote.validadeFormatada}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className={`text-sm font-bold ${tabAtual?.diasCls}`}>
                                {tabAtual?.diasLabel(lote.dias)}
                              </span>
                            </td>

                            {/* Saldo Central */}
                            <td className="py-3 px-3 text-center">
                              <span
                                className={cn(
                                  "font-bold text-sm",
                                  lote.qtdCentral > 0 ? "text-blue-700" : "text-slate-300"
                                )}
                              >
                                {lote.qtdCentral.toLocaleString("pt-BR")}
                              </span>
                            </td>

                            {/* Saldo Satélite */}
                            <td className="py-3 px-3 text-center">
                              <span
                                className={cn(
                                  "font-bold text-sm",
                                  lote.qtdSat > 0 ? "text-purple-700" : "text-slate-300"
                                )}
                              >
                                {lote.qtdSat.toLocaleString("pt-BR")}
                              </span>
                            </td>

                            {/* Saldo Total */}
                            <td className="py-3 px-3 text-center">
                              <span
                                className={cn(
                                  "font-black text-sm",
                                  isVencido ? "text-red-700" : "text-slate-800"
                                )}
                              >
                                {lote.qtdTotal.toLocaleString("pt-BR")}
                              </span>
                            </td>

                            {/* Urgência */}
                            <td className="py-3 px-4">
                              <UrgencyBar dias={lote.dias} />
                              <p className="text-[10px] text-center text-slate-400 mt-1">
                                {isVencido
                                  ? "VENCIDO"
                                  : lote.dias <= 30
                                  ? "CRÍTICO"
                                  : lote.dias <= 60
                                  ? "ATENÇÃO"
                                  : "VIGILÂNCIA"}
                              </p>
                            </td>

                            {/* Botão de Retirada / Baixa por Perda */}
                            <td className="py-2.5 px-4 text-center no-print">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedLoteParaPerda(lote)}
                                className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200 hover:border-red-300 font-semibold text-xs h-8 px-2.5 gap-1.5 cursor-pointer shadow-2xs hover:scale-[1.02] transition-transform w-full justify-center"
                                title="Dar baixa no estoque Central e/ou Satélite e registrar como perda"
                              >
                                <PackageMinus className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                <span>Retirar Estoque</span>
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Modal para Baixa de Estoque por Perda (Central, Satélite ou Ambos) */}
      <RetirarEstoquePerdaModal
        open={!!selectedLoteParaPerda}
        onOpenChange={(v) => !v && setSelectedLoteParaPerda(null)}
        lote={selectedLoteParaPerda}
        medicamentos={medicamentos}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["medicamentos"] });
          queryClient.invalidateQueries({ queryKey: ["lotes"] });
          queryClient.invalidateQueries({ queryKey: ["saidas"] });
        }}
      />

      {/* Alert Dialog de confirmação em massa para limpar todos os vencidos */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-2xl border-slate-200">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Confirmar remoção de vencidos de ambos os estoques
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-600 space-y-2">
              <p>
                Você está prestes a remover <strong>todos</strong> os itens vencidos da <strong>Farmácia Central</strong> e da <strong>Farmácia Satélite</strong>.
              </p>
              <div className="bg-red-50 p-3 rounded-xl border border-red-200 text-red-900 text-xs">
                Total de <strong>{lotesEnriquecidos.filter((l) => l.dias < 0 && l.qtdTotal > 0).length} lotes vencidos</strong> serão zerados e registrados no Histórico Oficial com classificação <strong>PERDA / DESCARTE POR VENCIMENTO</strong>.
              </div>
              <p>Essa ação não poderá ser desfeita facilmente. Deseja prosseguir?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={limparVencidosMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                limparVencidosMutation.mutate();
              }}
              disabled={limparVencidosMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              {limparVencidosMutation.isPending ? "Processando..." : "Sim, Limpar Ambos os Estoques"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }
          body { 
            print-color-adjust: exact; 
            -webkit-print-color-adjust: exact; 
            background-color: white !important;
          }
          .no-print, nav, header, footer, aside, .lucide-search, input, button { display: none !important; }
          .p-6 { padding: 0 !important; }
          
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border: 1px solid #e2e8f0 !important; }
        }
      `}</style>
    </div>
  );
}
