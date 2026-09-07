import { useState, useRef, useEffect, useMemo } from "react";
import { db } from "@/api/db";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { 
    RotateCcw, Search, Plus, Trash2, FileText, Printer, 
    AlertTriangle, Settings2,
    Calendar as CalendarIcon, User, Building2, X, Sparkles, 
    CalendarCheck, Bed, ArrowUpRight, CheckCircle2, ShieldAlert,
    Clock, HelpCircle
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format, parseISO, startOfDay, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { safeFormatDate } from "@/utils/dateUtils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { isMav, isPsicotropico } from "@/utils/mavUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function Devolucoes({ isTab = false }) {
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState({ from: undefined, to: undefined });
  const [activeCategory, setActiveCategory] = useState("todos"); // "todos", "pacientes", "alta", "geral"
  const [displayCount, setDisplayCount] = useState(50);
  
  // Modais
  const [formOpen, setFormOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [comprovanteData, setComprovanteData] = useState(null);
  const [deleteDev, setDeleteDev] = useState(null);

  const [visibleColumns, setVisibleColumns] = useState({
    data: true,
    medicamento: true,
    lote: true,
    validade: true,
    qtd: true,
    origem: true,
    motivo: true,
    acoes: true,
  });

  const printRef = useRef();
  const comprovanteRef = useRef();
  const queryClient = useQueryClient();

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(50);
  }, [search, dateRange, activeCategory]);

  // Consultas de dados
  const { data: entradas = [], isLoading } = useQuery({
    queryKey: ['entradas'],
    queryFn: () => db.entities.Entrada.list('-created_date'),
  });

  const { data: medicamentos = [] } = useQuery({
    queryKey: ['medicamentos'],
    queryFn: () => db.entities.Medicamento.list(),
  });

  const { data: lotes = [] } = useQuery({
    queryKey: ['lotes'],
    queryFn: () => db.entities.Lote.list(),
  });

  const { data: alas = [] } = useQuery({
    queryKey: ['alas'],
    queryFn: () => db.entities.Ala.list(),
  });

  const { data: pacientes = [] } = useQuery({
    queryKey: ['pacientes'],
    queryFn: () => db.entities.Paciente.list(),
  });

  const medicamentosMap = useMemo(() => {
    const map = {};
    medicamentos.forEach(m => { map[m.id] = m; });
    return map;
  }, [medicamentos]);

  // Função para verificar se a Entrada é uma Devolução
  const isDevolucaoItem = (e) => {
    const fn = (e.fornecedor_nome || "").toLowerCase();
    const tp = (e.tipo || "").toLowerCase();
    const nl = (e.numero_lote || "").toUpperCase();
    const obs = (e.observacoes || "").toLowerCase();
    return (
      fn.includes("devolução") ||
      fn.includes("devolucao") ||
      fn.includes("devolvido") ||
      tp.includes("devolucao") ||
      tp.includes("devolução") ||
      nl === "DEVOLVIDO" ||
      obs.includes("devolução") ||
      obs.includes("devolucao")
    );
  };

  // Classifica a categoria da devolução
  const getDevolucaoCategory = (dev) => {
    const orig = (dev.fornecedor_nome || "").toLowerCase();
    const obs = (dev.observacoes || "").toLowerCase();
    const tp = (dev.tipo || "").toLowerCase();

    if (orig.includes("alta") || obs.includes("alta") || tp.includes("alta")) {
      return "alta";
    }
    if (orig.includes("paciente") || obs.includes("paciente") || orig.includes("leito") || obs.includes("leito")) {
      return "pacientes";
    }
    return "geral";
  };

  // Helper para limpar e extrair nome do paciente/origem e motivo
  const parseOrigemEMotivo = (dev) => {
    const rawOrigem = dev.fornecedor_nome || "";
    let cleanOrigem = rawOrigem;
    let motivo = dev.observacoes || "";

    // Se tiver padrão "Devolução Paciente: NOME - TIPO (MOTIVO)"
    if (rawOrigem.includes(" - ")) {
      const parts = rawOrigem.split(" - ");
      cleanOrigem = parts[0].replace(/^Devolu[çc][ãa]o\s*(Alta\s*)?(Paciente:\s*)?/i, "").trim();
      if (!motivo && parts[1]) {
        motivo = parts.slice(1).join(" - ");
      }
    } else {
      cleanOrigem = rawOrigem.replace(/^Devolu[çc][ãa]o\s*(Alta\s*)?(Paciente:\s*)?/i, "").trim();
    }

    if (!cleanOrigem || cleanOrigem.toLowerCase() === "devolução") {
      cleanOrigem = "Farmácia Satélite / Interna";
    }

    return { cleanOrigem, motivo: motivo || "Devolução ao estoque satélite" };
  };

  // Todas as devoluções filtradas pelo tipo
  const todasDevolucoes = useMemo(() => {
    return (entradas || []).filter(isDevolucaoItem);
  }, [entradas]);

  // Contadores para os 4 Cards de KPI
  const counts = useMemo(() => {
    let todos = 0;
    let pacientes = 0;
    let alta = 0;
    let avulsas = 0;
    let totalUnidades = 0;

    todasDevolucoes.forEach(d => {
      todos++;
      totalUnidades += (Number(d.quantidade) || 0);
      const cat = getDevolucaoCategory(d);
      if (cat === "alta") alta++;
      else if (cat === "pacientes") pacientes++;
      else avulsas++;
    });

    return { todos, pacientes, alta, avulsas, totalUnidades };
  }, [todasDevolucoes]);

  // Filtro de Busca, Data e Categoria
  const filteredDevolucoes = useMemo(() => {
    const searchLow = (search || "").trim().toLowerCase();

    return todasDevolucoes.filter(d => {
      // Busca
      const matchSearch = !searchLow ||
        (d.medicamento_nome?.toLowerCase().includes(searchLow)) ||
        (d.numero_lote?.toLowerCase().includes(searchLow)) ||
        (d.fornecedor_nome?.toLowerCase().includes(searchLow)) ||
        (d.observacoes?.toLowerCase().includes(searchLow));

      // Filtro por Data
      let matchDate = true;
      if (dateRange?.from) {
        const dateStr = d.data_entrada?.split('T')[0];
        const date = parseISO(dateStr);
        const from = startOfDay(dateRange.from);
        const to = dateRange.to ? dateRange.to : startOfDay(dateRange.from);
        matchDate = date.getTime() >= from.getTime() && date.getTime() <= (to.getTime() + 86400000);
      }

      // Filtro por Categoria
      let matchCategory = true;
      const cat = getDevolucaoCategory(d);
      if (activeCategory === "pacientes") {
        matchCategory = cat === "pacientes";
      } else if (activeCategory === "alta") {
        matchCategory = cat === "alta";
      } else if (activeCategory === "geral") {
        matchCategory = cat === "geral";
      }

      return matchSearch && matchDate && matchCategory;
    }).sort((a, b) => {
      const creatA = a.created_at || a.created_date || "";
      const creatB = b.created_at || b.created_date || "";
      if (creatA !== creatB) return creatB.localeCompare(creatA);

      const dateA = a.data_entrada || "";
      const dateB = b.data_entrada || "";
      return dateB.localeCompare(dateA);
    });
  }, [todasDevolucoes, search, dateRange, activeCategory]);

  // Mutação: Deletar / Estornar Devolução
  const deleteDevolucaoMutation = useMutation({
    mutationFn: async (dev) => {
      // 1. Reverter saldo do satélite (subtrair a quantidade devolvida)
      const med = medicamentos.find(m => m.id === dev.medicamento_id);
      if (med) {
        const novoEstoque = Math.max(0, (med.estoque_satelite || 0) - (dev.quantidade || 0));
        await db.entities.Medicamento.update(med.id, {
          estoque_satelite: novoEstoque
        });
      }

      // 2. Registrar no log de auditoria
      await db.logAction(
        "ESTORNO_DEVOLUCAO_SATELITE",
        "Entrada",
        dev.id,
        `Estorno de devolução de ${dev.quantidade}un do medicamento '${dev.medicamento_nome}' (Lote: ${dev.numero_lote || 'N/I'}). Origem: ${dev.fornecedor_nome || 'N/I'}`
      );

      // 3. Excluir o registro de Entrada
      await db.entities.Entrada.delete(dev.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entradas'] });
      queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      setDeleteDev(null);
      toast.success("Devolução estornada e removida com sucesso!");
    },
    onError: (err) => {
      toast.error("Erro ao estornar devolução: " + (err.message || err));
    }
  });

  // Mutação: Criar Nova Devolução Manual
  const [novoItem, setNovoItem] = useState({
    medicamento_id: "",
    medicamento_nome: "",
    lote_id: "",
    numero_lote: "",
    data_validade: "",
    quantidade: 1,
    tipoOrigem: "paciente", // paciente, setor, outro
    paciente_nome: "",
    ala_nome: "",
    motivo: "Suspensão Médica / Cancelamento de Dose",
    outroMotivo: "",
    observacoes: ""
  });

  const createDevolucaoMutation = useMutation({
    mutationFn: async (form) => {
      if (!form.medicamento_id) throw new Error("Selecione um medicamento");
      const qtdNum = parseInt(form.quantidade, 10);
      if (!qtdNum || qtdNum <= 0) throw new Error("Informe uma quantidade válida maior que zero");

      const med = medicamentos.find(m => m.id === form.medicamento_id);
      if (!med) throw new Error("Medicamento não encontrado");

      const todayStr = format(new Date(), "yyyy-MM-dd");
      const nowIso = new Date().toISOString();

      let origemFormatada = "Devolução";
      const motivoFinal = form.motivo === "Outro Motivo" ? form.outroMotivo : form.motivo;

      if (form.tipoOrigem === "paciente" && form.paciente_nome) {
        origemFormatada = `Devolução Paciente: ${form.paciente_nome} - ${motivoFinal}`;
      } else if (form.tipoOrigem === "setor" && form.ala_nome) {
        origemFormatada = `Devolução Setor: ${form.ala_nome} - ${motivoFinal}`;
      } else {
        origemFormatada = `Devolução Avulsa - ${motivoFinal}`;
      }

      // 1. Atualiza estoque satélite do medicamento
      const novoEstoqueSatelite = (med.estoque_satelite || 0) + qtdNum;
      await db.entities.Medicamento.update(med.id, {
        estoque_satelite: novoEstoqueSatelite
      });

      // 2. Cria registro na tabela Entrada
      const novaEntrada = await db.entities.Entrada.create({
        medicamento_id: med.id,
        medicamento_nome: med.nome,
        fornecedor_nome: origemFormatada,
        lote_id: form.lote_id || null,
        numero_lote: form.numero_lote || "DEVOLVIDO",
        data_validade: form.data_validade || null,
        quantidade: qtdNum,
        data_entrada: todayStr,
        created_at: nowIso,
        tipo: "DEVOLUCAO",
        observacoes: form.observacoes || motivoFinal
      });

      // 3. Auditoria
      await db.logAction(
        "REGISTRO_DEVOLUCAO_SATELITE",
        "Entrada",
        novaEntrada?.id || med.id,
        `Devolução de ${qtdNum}un de '${med.nome}' (Lote: ${form.numero_lote || 'DEVOLVIDO'}) retornada à Satélite. Motivo: ${motivoFinal}. Origem: ${origemFormatada}`
      );

      return novaEntrada;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entradas'] });
      queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      setFormOpen(false);
      setNovoItem({
        medicamento_id: "",
        medicamento_nome: "",
        lote_id: "",
        numero_lote: "",
        data_validade: "",
        quantidade: 1,
        tipoOrigem: "paciente",
        paciente_nome: "",
        ala_nome: "",
        motivo: "Suspensão Médica / Cancelamento de Dose",
        outroMotivo: "",
        observacoes: ""
      });
      toast.success("Devolução registrada com sucesso! Estoque satélite atualizado.");
    },
    onError: (err) => {
      toast.error("Erro ao registrar devolução: " + (err.message || err));
    }
  });

  // Exportar PDF do Relatório
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
      pdf.save(`relatorio-devolucoes-${format(new Date(), "dd-MM-yyyy")}.pdf`);
      toast.dismiss();
      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      toast.dismiss();
      toast.error("Erro ao gerar PDF");
    }
  };

  // Botões de Ação do Cabeçalho
  const actionButtons = (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        onClick={() => setReportOpen(true)}
        className="h-9 text-xs font-semibold border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs gap-1.5"
      >
        <FileText className="w-3.5 h-3.5 text-slate-500" />
        Relatório
      </Button>

      <Button
        onClick={() => setFormOpen(true)}
        className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 gap-1.5"
      >
        <Plus className="w-3.5 h-3.5" />
        Nova Devolução
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-9 text-xs font-semibold border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-xs ml-auto gap-1.5">
            <Settings2 className="w-3.5 h-3.5 text-slate-500" />
            Colunas
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-white shadow-lg border-slate-200">
          {Object.keys(visibleColumns).map((col) => (
            <DropdownMenuCheckboxItem
              key={col}
              className="text-xs capitalize"
              checked={visibleColumns[col]}
              onCheckedChange={(checked) =>
                setVisibleColumns((prev) => ({ ...prev, [col]: checked }))
              }
            >
              {col === "data" ? "Data Devolução" :
                col === "medicamento" ? "Medicamento" :
                col === "lote" ? "Lote" :
                col === "validade" ? "Validade" :
                col === "qtd" ? "Quantidade" :
                col === "origem" ? "Origem / Paciente" :
                col === "motivo" ? "Motivo / Detalhes" :
                col === "acoes" ? "Ações" : col}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <div className={cn("p-6 space-y-4 h-[calc(100vh)] overflow-hidden flex flex-col", isTab && "p-4 h-[calc(100vh-140px)]")}>
      {/* Header */}
      {!isTab ? (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <RotateCcw className="w-6 h-6 text-emerald-600" />
              Devoluções de Medicamentos
            </h1>
            <p className="text-slate-500 text-xs font-medium mt-0.5">
              Gestão, registro e histórico de devoluções para a Farmácia Satélite
            </p>
          </div>
          {actionButtons}
        </div>
      ) : (
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-emerald-600" />
            <span className="font-bold text-sm text-slate-800">Histórico de Devoluções da Satélite</span>
          </div>
          {actionButtons}
        </div>
      )}

      {/* KPI Stats Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Devoluções */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total de Devoluções</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-extrabold text-emerald-700 dark:text-emerald-400">{counts.todos}</span>
              <span className="text-[10px] text-slate-400 font-medium">({counts.totalUnidades} un)</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600">
            <RotateCcw className="w-4 h-4" />
          </div>
        </div>

        {/* Card 2: Por Pacientes */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Por Pacientes</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400">{counts.pacientes}</span>
              <span className="text-[10px] text-slate-400 font-medium">leitos / prescrições</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600">
            <User className="w-4 h-4" />
          </div>
        </div>

        {/* Card 3: Por Alta Hospitalar */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Por Alta Hospitalar</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-extrabold text-amber-600 dark:text-amber-400">{counts.alta}</span>
              <span className="text-[10px] text-slate-400 font-medium">desospitalizações</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600">
            <Sparkles className="w-4 h-4" />
          </div>
        </div>

        {/* Card 4: Gerais / Avulsas */}
        <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gerais / Avulsas</p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-extrabold text-teal-600 dark:text-teal-400">{counts.avulsas}</span>
              <span className="text-[10px] text-slate-400 font-medium">setores / ajustes</span>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center text-teal-600">
            <Building2 className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200/80">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveCategory("todos")}
            className={cn(
              "h-8 rounded-lg text-xs font-bold gap-2 transition-all",
              activeCategory === "todos" 
                ? "bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 shadow-xs ring-1 ring-slate-200/80" 
                : "text-slate-600 dark:text-slate-400 hover:bg-white/50"
            )}
          >
            <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
            Todas as Devoluções
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
              activeCategory === "todos" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
            )}>
              {counts.todos}
            </span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveCategory("pacientes")}
            className={cn(
              "h-8 rounded-lg text-xs font-bold gap-2 transition-all",
              activeCategory === "pacientes" 
                ? "bg-indigo-600 text-white shadow-xs" 
                : "text-slate-600 dark:text-slate-400 hover:bg-white/50"
            )}
          >
            <User className="w-3.5 h-3.5 text-indigo-300" />
            Devoluções por Pacientes
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
              activeCategory === "pacientes" ? "bg-indigo-700 text-indigo-100" : "bg-slate-200 text-slate-600"
            )}>
              {counts.pacientes}
            </span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveCategory("alta")}
            className={cn(
              "h-8 rounded-lg text-xs font-bold gap-2 transition-all",
              activeCategory === "alta" 
                ? "bg-amber-600 text-white shadow-xs" 
                : "text-slate-600 dark:text-slate-400 hover:bg-white/50"
            )}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            Devoluções por Alta
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
              activeCategory === "alta" ? "bg-amber-700 text-amber-100" : "bg-slate-200 text-slate-600"
            )}>
              {counts.alta}
            </span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveCategory("geral")}
            className={cn(
              "h-8 rounded-lg text-xs font-bold gap-2 transition-all",
              activeCategory === "geral" 
                ? "bg-teal-600 text-white shadow-xs" 
                : "text-slate-600 dark:text-slate-400 hover:bg-white/50"
            )}
          >
            <Building2 className="w-3.5 h-3.5 text-teal-300" />
            Devoluções Gerais / Avulsas
            <span className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-full font-bold",
              activeCategory === "geral" ? "bg-teal-700 text-teal-100" : "bg-slate-200 text-slate-600"
            )}>
              {counts.avulsas}
            </span>
          </Button>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Exibindo <strong>{Math.min(filteredDevolucoes.length, displayCount)}</strong> de <strong>{filteredDevolucoes.length}</strong> registro(s)
        </div>
      </div>

      {/* Search and Date Filter */}
      <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col sm:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Buscar por medicamento, lote, paciente ou motivo..."
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

          <div className="flex items-center gap-2 shrink-0">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant="outline"
                  className={cn(
                    "w-[230px] justify-start text-left font-normal border-slate-200 dark:border-slate-700 h-9.5 shadow-xs text-xs rounded-lg",
                    !dateRange?.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd/MM/yyyy")} - {format(dateRange.to, "dd/MM/yyyy")}
                      </>
                    ) : (
                      format(dateRange.from, "dd/MM/yyyy")
                    )
                  ) : (
                    "Filtrar Período..."
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={dateRange?.from}
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  locale={ptBR}
                />
                <div className="p-2 border-t border-slate-100 flex justify-end">
                   <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs text-slate-500 hover:text-red-600 font-semibold"
                    onClick={() => {
                        setDateRange({ from: undefined, to: undefined });
                    }}
                   >
                     Limpar Período
                   </Button>
                </div>
              </PopoverContent>
            </Popover>

            {(search || dateRange?.from) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setDateRange({ from: undefined, to: undefined });
                }}
                className="h-9.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-sm flex-1 min-h-[300px] overflow-hidden flex flex-col relative">
        <div className="overflow-auto flex-1">
          <Table className="min-w-[1100px] w-full">
            <TableHeader className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
              <TableRow className="hover:bg-transparent">
                {visibleColumns.data && <TableHead className="w-28 text-[11px] font-bold uppercase tracking-wider text-slate-600">Data Devolução</TableHead>}
                {visibleColumns.medicamento && <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Medicamento</TableHead>}
                {visibleColumns.lote && <TableHead className="w-28 text-[11px] font-bold uppercase tracking-wider text-slate-600">Lote</TableHead>}
                {visibleColumns.validade && <TableHead className="w-28 text-[11px] font-bold uppercase tracking-wider text-slate-600">Validade</TableHead>}
                {visibleColumns.qtd && <TableHead className="text-center w-28 text-[11px] font-bold uppercase tracking-wider text-slate-600">Qtd Devolvida</TableHead>}
                {visibleColumns.origem && <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Origem / Paciente</TableHead>}
                {visibleColumns.motivo && <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Motivo / Detalhes</TableHead>}
                {visibleColumns.acoes && <TableHead className="text-center w-24 text-[11px] font-bold uppercase tracking-wider text-slate-600">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    {Array(8).fill(0).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredDevolucoes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-center">
                      <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-3.5 ring-8 ring-emerald-50/50 dark:ring-emerald-950/20">
                        <RotateCcw className="w-7 h-7" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">Nenhuma devolução encontrada</h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                        {search || dateRange?.from 
                          ? "Não foram encontrados registros para os filtros selecionados." 
                          : "Nenhuma devolução de medicamento foi registrada ainda nesta categoria."}
                      </p>
                      {search || dateRange?.from ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => { setSearch(""); setDateRange({ from: undefined, to: undefined }); }}
                          className="text-xs font-semibold"
                        >
                          Limpar Filtros
                        </Button>
                      ) : (
                        <Button 
                          size="sm"
                          onClick={() => setFormOpen(true)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 gap-1.5 h-8"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Registrar Nova Devolução
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredDevolucoes.slice(0, displayCount).map((dev) => {
                  const med = medicamentosMap[dev.medicamento_id];
                  const { cleanOrigem, motivo } = parseOrigemEMotivo(dev);
                  const cat = getDevolucaoCategory(dev);

                  // Validade
                  const validadeStr = dev.data_validade;
                  let validadeFmt = "—";
                  if (validadeStr) {
                    try {
                      const d = parseISO(validadeStr);
                      if (isValid(d)) validadeFmt = format(d, "dd/MM/yyyy", { locale: ptBR });
                    } catch { validadeFmt = validadeStr; }
                  }

                  return (
                    <TableRow key={dev.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                      {/* Data */}
                      {visibleColumns.data && (
                        <TableCell className="text-xs font-medium text-slate-600 dark:text-slate-300 py-3 whitespace-nowrap">
                          {safeFormatDate(dev.data_entrada || dev.created_at)}
                        </TableCell>
                      )}

                      {/* Medicamento */}
                      {visibleColumns.medicamento && (
                        <TableCell className="py-3">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                              {dev.medicamento_nome}
                              {med && isMav(med.nome) && (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-black tracking-wider bg-red-600 text-white shadow-xs">
                                  MAV
                                </span>
                              )}
                              {med && isPsicotropico(med.nome, med.categoria) && (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-black tracking-wider bg-amber-500 text-slate-950 shadow-xs">
                                  P344
                                </span>
                              )}
                            </span>
                            {med?.concentracao && (
                              <span className="text-[11px] text-slate-400 font-normal">
                                {med.concentracao}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      )}

                      {/* Lote */}
                      {visibleColumns.lote && (
                        <TableCell className="py-3">
                          <Badge variant="outline" className="font-mono text-xs font-semibold bg-slate-50 text-slate-700 border-slate-200">
                            {dev.numero_lote || "—"}
                          </Badge>
                        </TableCell>
                      )}

                      {/* Validade */}
                      {visibleColumns.validade && (
                        <TableCell className="py-3">
                          {validadeStr ? (
                            <span className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
                              <CalendarCheck className="w-3.5 h-3.5 text-emerald-500" />
                              {validadeFmt}
                            </span>
                          ) : (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </TableCell>
                      )}

                      {/* Qtd */}
                      {visibleColumns.qtd && (
                        <TableCell className="text-center py-3">
                          <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold border border-emerald-200 text-xs px-2.5 py-0.5 shadow-2xs">
                            ↑ +{dev.quantidade} un
                          </Badge>
                        </TableCell>
                      )}

                      {/* Origem / Paciente */}
                      {visibleColumns.origem && (
                        <TableCell className="py-3 max-w-[240px]">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs",
                              cat === "alta" ? "bg-amber-100 text-amber-700" :
                              cat === "pacientes" ? "bg-indigo-100 text-indigo-700" :
                              "bg-slate-100 text-slate-600"
                            )}>
                              {cat === "alta" ? <Sparkles className="w-3 h-3" /> :
                               cat === "pacientes" ? <User className="w-3 h-3" /> :
                               <Building2 className="w-3 h-3" />}
                            </div>
                            <div className="truncate">
                              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 block truncate" title={cleanOrigem}>
                                {cleanOrigem}
                              </span>
                              <span className="text-[10px] text-slate-400 capitalize">
                                {cat === "alta" ? "Alta Hospitalar" : cat === "pacientes" ? "Paciente / Leito" : "Setorial / Avulso"}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                      )}

                      {/* Motivo / Detalhes */}
                      {visibleColumns.motivo && (
                        <TableCell className="py-3 max-w-[280px]">
                          <span className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2" title={motivo}>
                            {motivo}
                          </span>
                        </TableCell>
                      )}

                      {/* Ações */}
                      {visibleColumns.acoes && (
                        <TableCell className="text-center py-3">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setComprovanteData(dev)}
                              title="Comprovante de Devolução"
                              className="h-7 w-7 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteDev(dev)}
                              title="Estornar / Excluir Devolução"
                              className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Load More Button */}
        {filteredDevolucoes.length > displayCount && (
          <div className="p-2.5 bg-slate-50 border-t border-slate-200/80 flex justify-center shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDisplayCount(prev => prev + 50)}
              className="text-xs font-semibold text-slate-600 h-8"
            >
              Carregar mais devoluções ({filteredDevolucoes.length - displayCount} restantes)
            </Button>
          </div>
        )}
      </div>

      {/* ─── MODAL: NOVA DEVOLUÇÃO ────────────────────────────────────────── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden rounded-2xl border-slate-200">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-5 text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <RotateCcw className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold">Registrar Nova Devolução</h3>
                <p className="text-xs text-emerald-100 mt-0.5">Retorno físico e contábil de medicamentos à Farmácia Satélite</p>
              </div>
            </div>
          </div>

          <form onSubmit={(e) => {
            e.preventDefault();
            createDevolucaoMutation.mutate(novoItem);
          }} className="p-6 space-y-4">
            {/* Medicamento */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                <span>Medicamento *</span>
                {novoItem.medicamento_id && (
                  <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Saldo Satélite: {medicamentosMap[novoItem.medicamento_id]?.estoque_satelite || 0} un
                  </span>
                )}
              </label>
              <select
                required
                value={novoItem.medicamento_id}
                onChange={(e) => {
                  const mId = e.target.value;
                  const m = medicamentosMap[mId];
                  const lotesDoMed = lotes.filter(l => l.medicamento_id === mId || l.medicamentoId === mId);
                  const primeiroLote = lotesDoMed[0];
                  setNovoItem(prev => ({
                    ...prev,
                    medicamento_id: mId,
                    medicamento_nome: m?.nome || "",
                    lote_id: primeiroLote?.id || "",
                    numero_lote: primeiroLote?.numero_lote || "DEVOLVIDO",
                    data_validade: primeiroLote?.data_validade || ""
                  }));
                }}
                className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Selecione o medicamento devolvido...</option>
                {medicamentos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome} {m.concentracao ? `(${m.concentracao})` : ""} - [Satélite: {m.estoque_satelite || 0}]
                  </option>
                ))}
              </select>
            </div>

            {/* Lote e Validade */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Lote</label>
                <Input
                  placeholder="Ex: LOTE123 ou DEVOLVIDO"
                  value={novoItem.numero_lote}
                  onChange={(e) => setNovoItem(prev => ({ ...prev, numero_lote: e.target.value }))}
                  className="h-9.5 text-xs bg-slate-50 border-slate-200 rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Validade</label>
                <Input
                  type="date"
                  value={novoItem.data_validade}
                  onChange={(e) => setNovoItem(prev => ({ ...prev, data_validade: e.target.value }))}
                  className="h-9.5 text-xs bg-slate-50 border-slate-200 rounded-lg"
                />
              </div>
            </div>

            {/* Quantidade */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Quantidade a Retornar *</label>
              <Input
                type="number"
                min="1"
                required
                value={novoItem.quantidade}
                onChange={(e) => setNovoItem(prev => ({ ...prev, quantidade: e.target.value }))}
                className="h-9.5 text-xs font-bold bg-slate-50 border-slate-200 rounded-lg"
              />
            </div>

            {/* Tipo de Origem */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Origem da Devolução</label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNovoItem(prev => ({ ...prev, tipoOrigem: "paciente" }))}
                  className={cn(
                    "text-xs font-semibold h-8 rounded-lg",
                    novoItem.tipoOrigem === "paciente" ? "bg-emerald-50 border-emerald-500 text-emerald-700" : "text-slate-600"
                  )}
                >
                  <User className="w-3 h-3 mr-1" /> Paciente
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNovoItem(prev => ({ ...prev, tipoOrigem: "setor" }))}
                  className={cn(
                    "text-xs font-semibold h-8 rounded-lg",
                    novoItem.tipoOrigem === "setor" ? "bg-emerald-50 border-emerald-500 text-emerald-700" : "text-slate-600"
                  )}
                >
                  <Building2 className="w-3 h-3 mr-1" /> Setor / Ala
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNovoItem(prev => ({ ...prev, tipoOrigem: "outro" }))}
                  className={cn(
                    "text-xs font-semibold h-8 rounded-lg",
                    novoItem.tipoOrigem === "outro" ? "bg-emerald-50 border-emerald-500 text-emerald-700" : "text-slate-600"
                  )}
                >
                  <HelpCircle className="w-3 h-3 mr-1" /> Outro / Avulso
                </Button>
              </div>
            </div>

            {novoItem.tipoOrigem === "paciente" && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Nome do Paciente / Leito</label>
                <Input
                  placeholder="Ex: João da Silva (Leito 204)"
                  value={novoItem.paciente_nome}
                  onChange={(e) => setNovoItem(prev => ({ ...prev, paciente_nome: e.target.value }))}
                  className="h-9.5 text-xs bg-slate-50 border-slate-200 rounded-lg"
                />
              </div>
            )}

            {novoItem.tipoOrigem === "setor" && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Ala / Posto de Enfermagem</label>
                <select
                  value={novoItem.ala_nome}
                  onChange={(e) => setNovoItem(prev => ({ ...prev, ala_nome: e.target.value }))}
                  className="w-full h-9.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
                >
                  <option value="">Selecione o setor...</option>
                  {alas.map(a => (
                    <option key={a.id} value={a.nome}>{a.nome}</option>
                  ))}
                  <option value="UTI Geral">UTI Geral</option>
                  <option value="Centro Cirúrgico">Centro Cirúrgico</option>
                  <option value="Pronto Atendimento">Pronto Atendimento</option>
                </select>
              </div>
            )}

            {/* Motivo */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Motivo da Devolução</label>
              <select
                value={novoItem.motivo}
                onChange={(e) => setNovoItem(prev => ({ ...prev, motivo: e.target.value }))}
                className="w-full h-9.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white"
              >
                <option value="Suspensão Médica / Cancelamento de Dose">Suspensão Médica / Cancelamento de Dose</option>
                <option value="Alta Hospitalar / Desospitalização">Alta Hospitalar / Desospitalização</option>
                <option value="Troca de Prescrição / Aprazamento">Troca de Prescrição / Aprazamento</option>
                <option value="Dose Não Administrada / Recusa">Dose Não Administrada / Recusa</option>
                <option value="Devolução por Óbito">Devolução por Óbito</option>
                <option value="Transferência de Leito / Setor">Transferência de Leito / Setor</option>
                <option value="Sobra de Bancada / Fracionamento">Sobra de Bancada / Fracionamento</option>
                <option value="Outro Motivo">Outro Motivo</option>
              </select>
            </div>

            {novoItem.motivo === "Outro Motivo" && (
              <Input
                placeholder="Especifique o motivo..."
                value={novoItem.outroMotivo}
                onChange={(e) => setNovoItem(prev => ({ ...prev, outroMotivo: e.target.value }))}
                className="h-9.5 text-xs bg-slate-50 border-slate-200 rounded-lg"
              />
            )}

            {/* Observações */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Observações Adicionais</label>
              <Textarea
                placeholder="Detalhes ou justificativa farmacêutica..."
                value={novoItem.observacoes}
                onChange={(e) => setNovoItem(prev => ({ ...prev, observacoes: e.target.value }))}
                className="text-xs bg-slate-50 border-slate-200 rounded-lg resize-none h-18"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setFormOpen(false)}
                className="text-xs font-semibold text-slate-600"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createDevolucaoMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5"
              >
                {createDevolucaoMutation.isPending ? "Salvando..." : "Confirmar Devolução"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: COMPROVANTE INDIVIDUAL ─────────────────────────────────── */}
      <Dialog open={!!comprovanteData} onOpenChange={() => setComprovanteData(null)}>
        <DialogContent className="sm:max-w-[480px] p-6 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
              <RotateCcw className="w-4 h-4 text-emerald-600" />
              Comprovante de Devolução
            </DialogTitle>
          </DialogHeader>

          {comprovanteData && (
            <div ref={comprovanteRef} className="space-y-4 pt-2 text-xs">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="font-bold text-slate-800">Hospital Zorion Saúde</span>
                  <span className="text-slate-400 text-[11px]">{safeFormatDate(comprovanteData.data_entrada || comprovanteData.created_at)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Medicamento</span>
                    <span className="font-bold text-slate-800">{comprovanteData.medicamento_nome}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Quantidade Devolvida</span>
                    <span className="font-extrabold text-emerald-700">{comprovanteData.quantidade} un</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Lote</span>
                    <span className="font-mono text-slate-700">{comprovanteData.numero_lote || "DEVOLVIDO"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Origem / Paciente</span>
                    <span className="text-slate-700">{parseOrigemEMotivo(comprovanteData).cleanOrigem}</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-200">
                  <span className="text-slate-400 block text-[10px]">Motivo / Observação</span>
                  <span className="text-slate-700">{parseOrigemEMotivo(comprovanteData).motivo}</span>
                </div>
              </div>

              <div className="pt-8 text-center border-t border-dashed border-slate-300">
                <div className="w-48 mx-auto border-b border-slate-400 pb-1 mb-1"></div>
                <p className="text-[10px] text-slate-500 font-semibold">Responsável pela Recepção na Farmácia Satélite</p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 pt-4">
            <Button variant="ghost" size="sm" onClick={() => setComprovanteData(null)} className="text-xs">
              Fechar
            </Button>
            <Button
              size="sm"
              onClick={() => window.print()}
              className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir Comprovante
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: RELATÓRIO GERAL ────────────────────────────────────────── */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-6 rounded-2xl">
          <DialogHeader className="flex flex-row items-center justify-between">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              Relatório de Devoluções da Satélite
            </DialogTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => window.print()} className="gap-1.5 text-xs font-semibold">
                <Printer className="w-3.5 h-3.5" /> Imprimir
              </Button>
              <Button size="sm" onClick={handleExportPDF} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs font-bold">
                Exportar PDF
              </Button>
            </div>
          </DialogHeader>

          <div ref={printRef} className="space-y-4 p-4 bg-white text-slate-900 text-xs">
            {/* Cabeçalho do Relatório */}
            <div className="border-b-2 border-emerald-600 pb-3 flex justify-between items-end">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">ZORION SAÚDE — FARMÁCIA SATÉLITE</h2>
                <p className="text-xs text-slate-500">Relatório Consolidado de Devoluções de Medicamentos</p>
              </div>
              <div className="text-right text-[11px] text-slate-500">
                <p>Emitido em: <strong>{format(new Date(), "dd/MM/yyyy HH:mm")}</strong></p>
                <p>Total de Registros: <strong>{filteredDevolucoes.length}</strong></p>
              </div>
            </div>

            {/* Resumo */}
            <div className="grid grid-cols-4 gap-3 py-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold">Total Registros</p>
                <p className="text-base font-extrabold text-slate-800">{filteredDevolucoes.length}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold">Unidades Retornadas</p>
                <p className="text-base font-extrabold text-emerald-600">
                  {filteredDevolucoes.reduce((acc, d) => acc + (Number(d.quantidade) || 0), 0)} un
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold">Pacientes</p>
                <p className="text-base font-extrabold text-indigo-600">{counts.pacientes}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase font-bold">Altas</p>
                <p className="text-base font-extrabold text-amber-600">{counts.alta}</p>
              </div>
            </div>

            {/* Tabela do Relatório */}
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-200">
                  <TableHead className="text-[10px] font-bold text-slate-600">DATA</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-600">MEDICAMENTO</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-600">LOTE</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-600 text-center">QTD</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-600">ORIGEM</TableHead>
                  <TableHead className="text-[10px] font-bold text-slate-600">MOTIVO</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDevolucoes.map((d) => (
                  <TableRow key={d.id} className="border-b border-slate-100 text-[11px]">
                    <TableCell className="py-2">{safeFormatDate(d.data_entrada || d.created_at)}</TableCell>
                    <TableCell className="font-semibold py-2">{d.medicamento_nome}</TableCell>
                    <TableCell className="font-mono py-2">{d.numero_lote || "—"}</TableCell>
                    <TableCell className="text-center font-bold text-emerald-700 py-2">+{d.quantidade}</TableCell>
                    <TableCell className="py-2">{parseOrigemEMotivo(d).cleanOrigem}</TableCell>
                    <TableCell className="py-2 text-slate-600">{parseOrigemEMotivo(d).motivo}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: CONFIRMAR ESTORNO / EXCLUSÃO ───────────────────────────── */}
      <AlertDialog open={!!deleteDev} onOpenChange={() => setDeleteDev(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              Confirmar Estorno de Devolução
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-slate-600 space-y-2 pt-2">
              <p>
                Deseja realmente estornar a devolução de <strong>{deleteDev?.quantidade} un</strong> do medicamento <strong>{deleteDev?.medicamento_nome}</strong>?
              </p>
              <p className="bg-rose-50 text-rose-800 p-2.5 rounded-lg border border-rose-200 text-[11px] font-medium">
                ⚠️ O saldo de <strong>{deleteDev?.quantidade} un</strong> será subtraído do estoque da Farmácia Satélite para desfazer o retorno ao estoque.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="text-xs font-semibold">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDevolucaoMutation.mutate(deleteDev)}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
            >
              Confirmar Estorno
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
