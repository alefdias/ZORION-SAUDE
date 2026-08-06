import { useState, useRef, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { db } from "@/api/db";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { 
    Plus, Search, PackageMinus, Trash2, FileText, Printer, Edit, 
    AlertTriangle, ChevronLeft, ChevronRight, CalendarX, Settings2,
    Calendar as CalendarIcon, User
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format, parseISO, subDays, addDays, isValid, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { safeFormatDate } from "@/utils/dateUtils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { isMav, isPsicotropico } from "@/utils/mavUtils";
import SaidaForm from "@/components/forms/SaidaForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useSearchParams } from "react-router-dom";

export default function Saidas({ isTab = false }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [editData, setEditData] = useState(null);
  const [dateRange, setDateRange] = useState({ from: undefined, to: undefined });
  const [displayCount, setDisplayCount] = useState(50);
  const [activeCategory, setActiveCategory] = useState("todos"); // "todos", "pacientes", "geral", "logs"

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(50);
  }, [search, dateRange, activeCategory]);

  useEffect(() => {
    if (searchParams.get("action") === "new") {
      setFormOpen(true);
      // Remove 'action' from URL so it doesn't re-open on refresh
      searchParams.delete("action");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);
  const [visibleColumns, setVisibleColumns] = useState({
    codigo: true,
    medicamento: true,
    lote: true,
    dataSaida: true,
    qtd: true,
    ala: true,
    paciente: true,
    observacao: true,
    acoes: true
  });
  const printRef = useRef();

  const queryClient = useQueryClient();

  const { data: saidas = [], isLoading } = useQuery({
    queryKey: ['saidas'],
    queryFn: () => db.entities.Saida.list('-created_date'),
  });

  const { data: medicamentos = [] } = useQuery({
    queryKey: ['medicamentos'],
    queryFn: () => db.entities.Medicamento.list(),
  });

  const { data: alas = [] } = useQuery({
    queryKey: ['alas'],
    queryFn: () => db.entities.Ala.list(),
  });

  const { data: lotes = [] } = useQuery({
    queryKey: ['lotes'],
    queryFn: () => db.entities.Lote.list(),
  });

  const createSaidaMutation = useMutation({
    mutationFn: async (data) => {
      // 1. Criar a saída
      const saida = await db.entities.Saida.create(data);

      // 2. Atualizar quantidade do lote (Removido: itens na satélite já foram deduzidos do lote no momento da transferência)


      // 3. Atualizar estoque do medicamento (Apenas Satélite)
      const medicamento = medicamentos.find(m => m.id === data.medicamento_id);
      if (medicamento) {
        await db.entities.Medicamento.update(medicamento.id, {
          estoque_satelite: Math.max(0, (medicamento.estoque_satelite || 0) - data.quantidade),
        });
      }

      return saida;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saidas'] });
      queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      setFormOpen(false);
      toast.success("Saída registrada com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao registrar saída:", error);
      toast.error("Erro ao registrar saída: " + (error.message || error));
    }
  });

  const deleteSaidaMutation = useMutation({
    mutationFn: async (saida) => {
      // 1. Reverter estoque do medicamento (Apenas Satélite)
      const medicamento = medicamentos.find(m => m.id === saida.medicamento_id);
      if (medicamento) {
        await db.entities.Medicamento.update(medicamento.id, {
          estoque_satelite: (medicamento.estoque_satelite || 0) + saida.quantidade,
        });
      }

      // 2. Reverter quantidade do lote (Removido: lote não é mais atualizado nas saídas)

      // 3. Deletar a saída
      await db.entities.Saida.delete(saida.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saidas'] });
      queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      setDeleteId(null);
      toast.success("Saída deletada com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao deletar saída");
    },
  });


  const updateSaidaMutation = useMutation({
    mutationFn: async (data) => {
      const oldSaida = saidas.find(s => s.id === data.id);
      if (!oldSaida) throw new Error("Saída não encontrada");

      // Se mudou o medicamento ou o lote, revertemos a saída inteira e aplicamos a nova
      if (oldSaida.medicamento_id !== data.medicamento_id || oldSaida.lote_id !== data.lote_id) {
        // 1. Reverter antiga da satélite
        const oldMed = medicamentos.find(m => m.id === oldSaida.medicamento_id);
        if (oldMed) {
          await db.entities.Medicamento.update(oldMed.id, {
            estoque_satelite: (oldMed.estoque_satelite || 0) + oldSaida.quantidade,
          });
        }

        // 3. Aplicar nova na satélite
        const newMed = medicamentos.find(m => m.id === data.medicamento_id);
        if (newMed) {
          await db.entities.Medicamento.update(newMed.id, {
            estoque_satelite: Math.max(0, (newMed.estoque_satelite || 0) + oldSaida.quantidade - data.quantidade), 
          });
        }
      } else {
        // Mesmo lote e mesmo medicamento: apenas diferença algébrica
        const diff = data.quantidade - oldSaida.quantidade; 
        if (diff !== 0) {
          const med = medicamentos.find(m => m.id === data.medicamento_id);
          if (med) {
            await db.entities.Medicamento.update(med.id, {
              estoque_satelite: Math.max(0, (med.estoque_satelite || 0) - diff)
            });
          }
        }
      }

      // Por fim, atualizar o registro
      return db.entities.Saida.update(data.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saidas'] });
      queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      setFormOpen(false);
      setEditData(null);
      toast.success("Saída atualizada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar saída: " + (error.message || error));
    }
  });

  const handleSave = (data) => {
    if (editData) {
      updateSaidaMutation.mutate(data);
    } else {
      createSaidaMutation.mutate(data);
    }
  };

  const handleEdit = (saida) => {
    setEditData(saida);
    setFormOpen(true);
  };

  const handleDelete = () => {
    const saida = saidas.find(s => s.id === deleteId);
    if (saida) {
      deleteSaidaMutation.mutate(saida);
    }
  };

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
      pdf.save(`relatorio-saidas-${format(new Date(), "dd-MM-yyyy")}.pdf`);
      toast.dismiss();
      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      toast.dismiss();
      toast.error("Erro ao gerar PDF");
    }
  };



  const medicamentosMap = useMemo(() => {
    const map = {};
    medicamentos.forEach(m => {
      map[m.id] = m;
    });
    return map;
  }, [medicamentos]);

  const counts = useMemo(() => {
    let todos = 0, pacientes = 0, geral = 0, perdas = 0;
    (saidas || []).forEach(s => {
      if (s.motivo === "Transferência de Estoque") return;
      const isLog = (s.medicamento_nome && s.medicamento_nome.includes("[LOG")) || (s.tipo && s.tipo.includes("Log"));
      if (isLog) return; // Logs são exibidos exclusivamente no painel RT

      todos++;
      const isPac = !!s.paciente_nome || (s.destino && s.destino.toLowerCase().includes("paciente")) || (s.motivo && s.motivo.toLowerCase().includes("paciente")) || (s.tipo && s.tipo.toLowerCase().includes("paciente"));
      const isPerda = s.destino === "Perda" || (s.motivo && s.motivo.toLowerCase().includes("perda"));

      if (isPerda) perdas++;
      else if (isPac) pacientes++;
      else geral++;
    });
    return { todos, pacientes, geral, perdas };
  }, [saidas]);

  const filteredSaidas = useMemo(() => {
    return (saidas || []).filter(s => {
    const searchLow = (search || "").trim().toLowerCase();
    
    // Omitir logs de auditoria (exibidos exclusivamente no painel RT)
    const isLog = (s.medicamento_nome && s.medicamento_nome.includes("[LOG")) || (s.tipo && s.tipo.includes("Log"));
    if (isLog) return false;

    // Filtro por termo de busca
    const matchesSearch = !searchLow ||
      (s.medicamento_nome?.toLowerCase().includes(searchLow)) ||
      (s.numero_lote?.toLowerCase().includes(searchLow)) ||
      (s.paciente_nome?.toLowerCase().includes(searchLow)) ||
      (s.ala_nome?.toLowerCase().includes(searchLow)) ||
      (s.motivo?.toLowerCase().includes(searchLow)) ||
      (s.tipo?.toLowerCase().includes(searchLow));
    
    // Filtro por data
    let matchesDate = true;
    if (dateRange?.from) {
      const saidaDateStr = s.data_saida?.split('T')[0];
      const saidaDate = parseISO(saidaDateStr);
      
      const from = startOfDay(dateRange.from);
      const to = dateRange.to ? dateRange.to : startOfDay(dateRange.from);
      
      matchesDate = saidaDate.getTime() >= from.getTime() && saidaDate.getTime() <= (to.getTime() + 86400000);
    }

    // Ignore transferências de estoque
    const isNotTransferencia = s.motivo !== "Transferência de Estoque";

    // Filtro por Categoria (Abas)
    let matchesCategory = true;
    const isPac = !!s.paciente_nome || (s.destino && s.destino.toLowerCase().includes("paciente")) || (s.motivo && s.motivo.toLowerCase().includes("paciente")) || (s.tipo && s.tipo.toLowerCase().includes("paciente"));
    const isPerda = s.destino === "Perda" || (s.motivo && s.motivo.toLowerCase().includes("perda"));

    if (activeCategory === "pacientes") {
      matchesCategory = isPac && !isPerda;
    } else if (activeCategory === "geral") {
      matchesCategory = !isPac && !isPerda;
    } else if (activeCategory === "perdas") {
      matchesCategory = isPerda;
    }

    return matchesSearch && matchesDate && isNotTransferencia && matchesCategory;
  }).sort((a, b) => {
    // 1. Prioridade máxima: O que foi gravado agora (created_at)
    const creatA = a.created_at || "";
    const creatB = b.created_at || "";
    if (creatA !== creatB) return creatB.localeCompare(creatA);

    // 2. Data do movimento
    const dateA = a.data_saida || "";
    const dateB = b.data_saida || "";
    if (dateA !== dateB) return dateB.localeCompare(dateA);

    return (b.id || "").localeCompare(a.id || "");
  });
  }, [saidas, search, dateRange, activeCategory]);

  const observer = useRef();
  const lastElementRef = (node) => {
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && displayCount < filteredSaidas.length) {
        setDisplayCount(prev => prev + 50);
      }
    });
    if (node) observer.current.observe(node);
  };

  const reportContent = (
    <>
      <div className="text-center mb-8 pb-6 border-b-2 border-blue-600">
        <div className="flex justify-between items-center mb-4">
          <div className="text-left">
            <p className="text-blue-600 font-bold text-xl uppercase tracking-tight">AXION SAÚDE</p>
            <p className="text-slate-500 text-xs">Sistema de Controle Farmacêutico</p>
          </div>
          <div className="text-right text-[10px] text-slate-400 font-mono">
            <p>Gerado em:</p>
            <p>{format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-slate-800 mb-1 uppercase tracking-widest">Relatório de Saídas</h1>
        <p className="text-slate-500 text-sm font-medium">Registro Cronológico de Dispensação de Medicamentos</p>
      </div>

      <div className="mb-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="border border-slate-200 rounded-lg p-4 bg-blue-50">
            <p className="text-xs font-medium text-slate-600 mb-2">Total de Saídas</p>
            <p className="text-2xl font-bold text-blue-700">{filteredSaidas.length}</p>
          </div>
          <div className="border border-slate-200 rounded-lg p-4 bg-red-50">
            <p className="text-xs font-medium text-slate-600 mb-2">Quantidade Total</p>
            <p className="text-2xl font-bold text-red-700">
              {filteredSaidas.reduce((sum, s) => sum + (s.quantidade || 0), 0).toLocaleString('pt-BR')}
            </p>
          </div>
        </div>

        <table className="w-full border-collapse border border-slate-300">
          <thead>
            <tr className="bg-blue-600 text-white">
              <th className="text-left py-2 px-3 text-xs font-semibold border border-blue-600">Data</th>
              <th className="text-left py-2 px-3 text-xs font-semibold border border-blue-600">Cód.</th>
              <th className="text-left py-2 px-3 text-xs font-semibold border border-blue-600">Medicamento</th>
              <th className="text-left py-2 px-3 text-xs font-semibold border border-blue-600">Lote</th>
              <th className="text-center py-2 px-3 text-xs font-semibold border border-blue-600">Qtd</th>
              <th className="text-left py-2 px-3 text-xs font-semibold border border-blue-600">Ala</th>
              <th className="text-left py-2 px-3 text-xs font-semibold border border-blue-600">Observação</th>
            </tr>
          </thead>
          <tbody>
            {filteredSaidas.map((saida, idx) => {
              const med = medicamentosMap[saida.medicamento_id];
              return (
                <tr key={saida.id} className={idx % 2 === 0 ? "bg-slate-50/50" : "bg-white"}>
                  <td className="py-2 px-3 border border-slate-200 text-sm">
                    {safeFormatDate(saida.data_saida)}
                  </td>
                  <td className="py-2 px-3 border border-slate-200 text-[10px] font-mono whitespace-nowrap">
                    {med?.codigo || "S/C"}
                  </td>
                  <td className="py-2 px-3 border border-slate-200 text-sm font-medium">{saida.medicamento_nome}</td>
                  <td className="py-2 px-3 border border-slate-200 text-sm">{saida.numero_lote}</td>
                  <td className="py-2 px-3 border border-slate-200 text-center font-bold text-red-700 text-sm">
                    -{saida.quantidade}
                  </td>
                  <td className="py-2 px-3 border border-slate-200 text-sm">{saida.ala_nome || "-"}</td>
                  <td className="py-2 px-3 border border-slate-200 text-xs text-slate-500">{saida.observacao || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-12 pt-6 border-t-2 border-slate-300">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="text-sm text-slate-600 mb-12">Responsável pela Farmácia:</p>
            <div className="border-t-2 border-slate-400 pt-2">
              <p className="text-xs text-slate-500">Assinatura e Carimbo</p>
            </div>
          </div>
          <div>
            <p className="text-sm text-slate-600 mb-12">Farmacêutico Responsável:</p>
            <div className="border-t-2 border-slate-400 pt-2">
              <p className="text-xs text-slate-500">Assinatura e CRF</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const actionButtons = (
    <div className="flex gap-2 justify-end">
      <Button onClick={() => setReportOpen(true)} variant="outline">
        <FileText className="w-4 h-4 mr-2" />
        Relatório
      </Button>
      <Button onClick={() => { setEditData(null); setFormOpen(true); }} className="bg-blue-600 hover:bg-blue-700">
        <Plus className="w-4 h-4 mr-2" />
        Nova Saída
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="ml-auto">
            <Settings2 className="w-4 h-4 mr-2" />
            Colunas
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {Object.keys(visibleColumns).map((col) => (
            <DropdownMenuCheckboxItem
              key={col}
              className="capitalize"
              checked={visibleColumns[col]}
              onCheckedChange={(checked) =>
                setVisibleColumns((prev) => ({ ...prev, [col]: checked }))
              }
            >
              {col === "codigo" ? "Cód." :
                col === "dataSaida" ? "Data Saída" :
                  col === "qtd" ? "Quantidade" :
                    col === "observacao" ? "Observação" :
                      col === "paciente" ? "Paciente" :
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
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Saídas</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Registro de saída de medicamentos</p>
          </div>
          {actionButtons}
        </div>
      ) : (
        actionButtons
      )}

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-200/60 dark:bg-slate-900/60 p-1.5 rounded-xl">
        <Button
          variant={activeCategory === "todos" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveCategory("todos")}
          className={cn("h-8 rounded-lg text-xs font-semibold gap-1.5 transition-all", activeCategory === "todos" ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-white/50")}
        >
          <PackageMinus className="w-3.5 h-3.5 text-blue-500" />
          Todas as Saídas ({counts.todos})
        </Button>
        <Button
          variant={activeCategory === "pacientes" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveCategory("pacientes")}
          className={cn("h-8 rounded-lg text-xs font-semibold gap-1.5 transition-all", activeCategory === "pacientes" ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-white/50")}
        >
          <User className="w-3.5 h-3.5 text-blue-200" />
          Saídas por Pacientes ({counts.pacientes})
        </Button>
        <Button
          variant={activeCategory === "geral" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveCategory("geral")}
          className={cn("h-8 rounded-lg text-xs font-semibold gap-1.5 transition-all", activeCategory === "geral" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-white/50")}
        >
          <PackageMinus className="w-3.5 h-3.5 text-emerald-200" />
          Saídas Gerais / Avulsas ({counts.geral})
        </Button>
        <Button
          variant={activeCategory === "perdas" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveCategory("perdas")}
          className={cn("h-8 rounded-lg text-xs font-semibold gap-1.5 transition-all", activeCategory === "perdas" ? "bg-red-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:bg-white/50")}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-red-200" />
          Histórico de Perdas ({counts.perdas})
        </Button>
      </div>

      {/* Search and Date Filter */}
      <Card className="p-4 border-0 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Buscar por medicamento ou lote..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-11"
            />
          </div>

          <div className="flex items-center">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant="outline"
                  className={cn(
                    "w-[260px] justify-start text-left font-normal border-slate-200 h-11 shadow-sm",
                    !dateRange?.from && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
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
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="border-0 shadow-sm relative h-[calc(100vh-280px)]">
        <Table className="min-w-[1200px] w-full" containerClassName="absolute inset-0 border-0">
          <TableHeader className="sticky top-0 z-20 shadow-sm bg-white">
            <TableRow className="bg-slate-50 hover:bg-slate-50">
              {visibleColumns.codigo && <TableHead className="w-20">Cód.</TableHead>}
              {visibleColumns.medicamento && <TableHead>Medicamento</TableHead>}
              {visibleColumns.lote && <TableHead>Lote</TableHead>}
              {visibleColumns.dataSaida && <TableHead>Data Saída</TableHead>}
              {visibleColumns.qtd && <TableHead className="text-center">Qtd</TableHead>}
              {visibleColumns.ala && <TableHead>Ala</TableHead>}
              {visibleColumns.paciente && <TableHead>Paciente</TableHead>}
              {visibleColumns.observacao && <TableHead>Observação</TableHead>}
              {visibleColumns.acoes && <TableHead className="text-center">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <TableRow key={i}>
                  {Array(7).fill(0).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredSaidas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <PackageMinus className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 dark:text-slate-400">Nenhuma saída encontrada</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredSaidas.slice(0, displayCount).map((saida, index) => {
                const isLastElement = index === Math.min(filteredSaidas.length, displayCount) - 1;
                return (
                <TableRow ref={isLastElement ? lastElementRef : null} key={saida.id} className="hover:bg-slate-50/50">
                  {visibleColumns.codigo && (
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px] uppercase">
                        {medicamentosMap[saida.medicamento_id]?.codigo || "S/C"}
                      </Badge>
                    </TableCell>
                  )}
                  {visibleColumns.medicamento && (() => {
                    const med = medicamentosMap[saida.medicamento_id];
                    return (
                      <TableCell className={cn("font-medium text-slate-800", isMav(saida.medicamento_nome) && "text-red-900 font-bold")}>
                        {saida.medicamento_nome} {isMav(saida.medicamento_nome) && "(MAV)"}
                        {med && isPsicotropico(med.categoria) && <User className="inline-block w-4 h-4 ml-2 text-indigo-600" title="Requer nome do paciente" />}
                        <div className="flex gap-2 items-center text-xs mt-1">
                          <span className="text-slate-500 font-medium">
                            {med?.unidade_medida ? `Dosagem: ${med.unidade_medida}` : "Dosagem não definida"}
                          </span>
                          {med?.apresentacao && (
                            <span className="text-slate-500 font-medium px-2 border-l border-slate-200">
                              {med.apresentacao}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    );
                  })()}
                  {visibleColumns.lote && (
                    <TableCell>
                      <Badge variant="outline">{saida.numero_lote}</Badge>
                    </TableCell>
                  )}
                  {visibleColumns.dataSaida && (
                    <TableCell className="text-slate-600">
                      {saida.data_saida && safeFormatDate(saida.data_saida)}
                    </TableCell>
                  )}
                  {visibleColumns.qtd && (
                    <TableCell className="text-center">
                      <Badge className="bg-red-100 text-red-700">-{saida.quantidade}</Badge>
                    </TableCell>
                  )}
                  {visibleColumns.ala && (
                    <TableCell>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {saida.ala_nome || "-"}
                      </Badge>
                    </TableCell>
                  )}
                  {visibleColumns.paciente && (
                    <TableCell className="font-medium text-slate-800 uppercase text-xs max-w-[200px] truncate">
                      {saida.paciente_nome || "-"}
                    </TableCell>
                  )}
                  {visibleColumns.observacao && (
                    <TableCell className="text-slate-500 text-sm max-w-xs truncate">
                      {saida.observacao || "-"}
                    </TableCell>
                  )}
                  {visibleColumns.acoes && (
                    <TableCell className="text-center">
                      <div className="flex justify-center items-center gap-1">

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(saida)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(saida.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
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
        {filteredSaidas.length > displayCount && (
          <div className="py-3 text-center text-sm text-slate-500 border-t border-slate-200 bg-slate-50">
            Carregando mais itens...
          </div>
        )}
      </Card>

      {/* Form Modal */}
      <SaidaForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditData(null); }}
        onSave={handleSave}
        initialData={editData}
        medicamentos={medicamentos}
        lotes={lotes}
        alas={alas}
        isLoading={createSaidaMutation.isPending || updateSaidaMutation.isPending}
      />


      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar esta saída? Esta ação reverterá o estoque e não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report Modal */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Relatório de Saídas</DialogTitle>
          </DialogHeader>

          <div className="flex gap-2 mb-4 no-print">
            <Button onClick={handlePrint} variant="outline" size="sm">
              <Printer className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
            <Button onClick={handleExportPDF} className="bg-red-600 hover:bg-red-700" size="sm">
              <FileText className="w-4 h-4 mr-2" />
              Exportar PDF
            </Button>
          </div>

          <div ref={printRef} className="bg-white p-8">
            {reportContent}
          </div>
        </DialogContent>
      </Dialog>

      <div id="print-area" className="hidden print:block print-only bg-white p-8">
        {reportContent}
      </div>

      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 15mm;
          }
          body { 
            print-color-adjust: exact; 
            -webkit-print-color-adjust: exact; 
            background-color: white !important;
          }
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0 !important;
          }
          
          .no-print, nav, header, footer, button, .sonner-toaster, [data-radix-portal] { display: none !important; }
          .p-6 { padding: 0 !important; }
          
          .bg-white { border: none !important; padding: 0 !important; }
          
          table { 
            width: 100% !important;
            page-break-inside: auto;
            border-collapse: collapse !important;
          }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          
          h1, h2, h3 { 
            page-break-after: avoid; 
            color: black !important;
          }
          
          .border-b-2.border-blue-600 {
            border-bottom-color: #2563eb !important;
            border-bottom-width: 2px !important;
          }
          
          .bg-blue-50 { background-color: #eff6ff !important; }
          .bg-red-50 { background-color: #fef2f2 !important; }
          .bg-slate-50 { background-color: #f8fafc !important; }
          
          .text-blue-600 { color: #2563eb !important; }
          .text-blue-700 { color: #1d4ed8 !important; }
          .text-red-700 { color: #b91c1c !important; }
        }
      `}</style>
    </div>
  );
}
