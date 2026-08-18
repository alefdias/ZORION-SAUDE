import { useState, useRef } from "react";
import { db } from "@/api/db";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Plus, Search, HandHelping, ArrowDownCircle, ArrowUpCircle, CheckCircle, Clock, AlertTriangle, FileText, Printer, Trash2, Settings2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { format, differenceInDays, parseISO, subDays, addDays, isValid, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, CalendarX, ChevronLeft, ChevronRight } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import EmprestimoForm from "@/components/forms/EmprestimoForm";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export default function Emprestimos() {
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [relatorioOpen, setRelatorioOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [filterDate, setFilterDate] = useState(null);
  const [columns, setColumns] = useState({
    tipo: true,
    codigo: true,
    medicamento: true,
    lote: true,
    qtd: true,
    destinatario: true,
    data: true,
    status: true,
    acoes: true
  });
  const relatorioRef = useRef(null);

  const toggleColumn = (col) => {
    setColumns(prev => ({ ...prev, [col]: !prev[col] }));
  };

  const queryClient = useQueryClient();

  const { data: emprestimos = [], isLoading } = useQuery({
    queryKey: ['emprestimos'],
    queryFn: () => db.entities.Emprestimo.list('-created_date'),
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

  const createEmprestimoMutation = useMutation({
    mutationFn: async (data) => {
      const emprestimo = await db.entities.Emprestimo.create(data);

      if (data.tipo === "emprestar") {
        // Emprestar: desconta do estoque
        const lote = lotes.find(l => l.id === data.lote_id);
        if (lote) {
          await db.entities.Lote.update(lote.id, {
            quantidade_atual: Math.max(0, (lote.quantidade_atual || 0) - data.quantidade),
          });
        }

        const medicamento = medicamentos.find(m => m.id === data.medicamento_id);
        if (medicamento) {
          await db.entities.Medicamento.update(medicamento.id, {
            estoque_atual: Math.max(0, (medicamento.estoque_atual || 0) - data.quantidade),
          });
        }
      } else if (data.tipo === "receber") {
        // Receber: soma ao estoque
        const medicamento = medicamentos.find(m => m.id === data.medicamento_id);
        if (medicamento) {
          await db.entities.Medicamento.update(medicamento.id, {
            estoque_atual: (medicamento.estoque_atual || 0) + data.quantidade,
          });
        }

        // Se informou lote, soma também no lote
        if (data.lote_id) {
          const lote = lotes.find(l => l.id === data.lote_id);
          if (lote) {
            await db.entities.Lote.update(lote.id, {
              quantidade_atual: (lote.quantidade_atual || 0) + data.quantidade,
            });
          }
        }
      }

      return emprestimo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emprestimos'] });
      queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      setFormOpen(false);
      toast.success("Empréstimo registrado com sucesso!");
    },
  });

  const devolverMutation = useMutation({
    mutationFn: async (emprestimo) => {
      console.log("Iniciando devolução do empréstimo:", emprestimo);
      try {
        await db.entities.Emprestimo.update(emprestimo.id, {
          status: "devolvido",
        });

        if (emprestimo.tipo === "emprestar") {
          console.log("Devolvendo estoque para o lote:", emprestimo.lote_id);
          const lote = lotes.find(l => l.id === emprestimo.lote_id);
          if (lote) {
            await db.entities.Lote.update(lote.id, {
              quantidade_atual: (lote.quantidade_atual || 0) + emprestimo.quantidade,
            });
          }

          const medicamento = medicamentos.find(m => m.id === emprestimo.medicamento_id);
          if (medicamento) {
            console.log("Atualizando estoque geral do medicamento:", medicamento.nome);
            await db.entities.Medicamento.update(medicamento.id, {
              estoque_atual: (medicamento.estoque_atual || 0) + emprestimo.quantidade,
            });
          }
        }
      } catch (error) {
        console.error("Erro interno na mutação de devolução:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emprestimos'] });
      queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      toast.success("Devolução registrada com sucesso!");
    },
    onError: (error) => {
      console.error("Falha ao registrar devolução:", error);
      toast.error("Erro ao registrar devolução: " + (error.message || error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (emprestimo) => {
      // Se foi um empréstimo que diminuiu o estoque (emprestar), devolver ao estoque
      if (emprestimo.tipo === "emprestar" && emprestimo.status === "pendente") {
        const lote = lotes.find(l => l.id === emprestimo.lote_id);
        if (lote) {
          await db.entities.Lote.update(lote.id, {
            quantidade_atual: (lote.quantidade_atual || 0) + emprestimo.quantidade,
          });
        }

        const medicamento = medicamentos.find(m => m.id === emprestimo.medicamento_id);
        if (medicamento) {
          await db.entities.Medicamento.update(medicamento.id, {
            estoque_atual: (medicamento.estoque_atual || 0) + emprestimo.quantidade,
          });
        }
      }

      await db.entities.Emprestimo.delete(emprestimo.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emprestimos'] });
      queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      toast.success("Empréstimo excluído com sucesso!");
    },
  });

  const handleSave = (data) => {
    createEmprestimoMutation.mutate(data);
  };

  const handleDevolver = (emprestimo) => {
    if (confirm("Confirmar devolução deste empréstimo?")) {
      devolverMutation.mutate(emprestimo);
    }
  };

  const handleDelete = (emprestimo) => {
    if (confirm("Tem certeza que deseja excluir este empréstimo?")) {
      deleteMutation.mutate(emprestimo);
    }
  };
  const handlePrevDay = () => {
    setFilterDate(prev => prev ? subDays(prev, 1) : subDays(new Date(), 1));
  };

  const handleNextDay = () => {
    setFilterDate(prev => prev ? addDays(prev, 1) : addDays(new Date(), 1));
  };


  const filteredEmprestimos = (emprestimos || []).filter(e => {
    const searchLow = (search || "").toLowerCase();
    
    // Filtro por termo de busca
    const matchSearch =
      e.medicamento_nome?.toLowerCase().includes(searchLow) ||
      e.ala_destino_nome?.toLowerCase().includes(searchLow);

    // Filtro por status
    const matchesStatus = filterStatus === "all" || e.status === filterStatus;

    // Filtro por data
    let matchesDate = true;
    if (filterDate) {
      const selectedDateStr = format(filterDate, "yyyy-MM-dd");
      const moveDateStr = e.data_emprestimo?.split('T')[0];
      matchesDate = moveDateStr === selectedDateStr;
    }

    return matchSearch && matchesStatus && matchesDate;
  });

  const handlePrintRelatorio = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    try {
      toast.loading("Gerando PDF...");
      const element = relatorioRef.current;
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
      pdf.save(`emprestimos-${format(new Date(), "dd-MM-yyyy")}.pdf`);
      toast.dismiss();
      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      toast.dismiss();
      toast.error("Erro ao gerar PDF");
    }
  };


  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Empréstimos</h1>
          <p className="text-slate-500 text-sm">Controle de medicamentos emprestados entre hospitais</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setRelatorioOpen(true)} variant="outline">
            <FileText className="w-4 h-4 mr-2" />
            Relatório
          </Button>

          {/* Date Picker Filter */}
          <div className="flex items-center gap-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm overflow-hidden">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-slate-600 hover:text-purple-600 hover:bg-purple-50 active:scale-95 transition-all rounded-none"
              onClick={handlePrevDay}
              title="Dia anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className={cn(
                    "h-9 px-4 flex items-center gap-2 text-sm font-bold transition-all rounded-none border-x border-slate-100 dark:border-slate-700 hover:bg-slate-50 min-w-[160px] justify-center",
                    filterDate ? "text-purple-700 bg-purple-50/30" : "text-slate-700 dark:text-slate-200"
                  )}
                >
                  <CalendarIcon className={cn("h-4 w-4", filterDate ? "text-purple-600" : "text-slate-400")} />
                  {filterDate ? format(filterDate, "dd 'de' MMMM", { locale: ptBR }) : "Todas as Datas"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={filterDate}
                  onSelect={setFilterDate}
                  initialFocus
                  locale={ptBR}
                />
                <div className="p-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                   <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs text-slate-500 hover:text-red-600"
                    onClick={() => {
                        setFilterDate(null);
                    }}
                   >
                     Limpar Filtro
                   </Button>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-slate-600 hover:text-purple-600 hover:bg-purple-50 active:scale-95 transition-all rounded-none"
              onClick={handleNextDay}
              title="Próximo dia"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <Button onClick={() => setFormOpen(true)} className="bg-purple-600 hover:bg-purple-700">
            <Plus className="w-4 h-4 mr-2" />
            Novo Empréstimo
          </Button>
        </div>
      </div>



      {/* Filters */}
      <Card className="p-4 border-0 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input
              placeholder="Buscar por medicamento ou hospital..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-slate-500" />
                <span className="hidden sm:inline">Colunas</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-3" align="end">
              <p className="font-semibold text-sm mb-3 text-slate-700 border-b pb-2">Mostrar Colunas</p>
              <div className="space-y-2">
                {[
                  { id: 'tipo', label: 'Tipo' },
                  { id: 'codigo', label: 'Cód.' },
                  { id: 'medicamento', label: 'Medicamento' },
                  { id: 'lote', label: 'Lote' },
                  { id: 'qtd', label: 'Qtd' },
                  { id: 'destinatario', label: 'Destinatário' },
                  { id: 'data', label: 'Data Empréstimo' },
                  { id: 'status', label: 'Status' },
                  { id: 'acoes', label: 'Ações' },
                ].map(col => (
                  <label key={col.id} className="flex items-center space-x-2 text-sm cursor-pointer hover:bg-slate-50 p-1 rounded">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                      checked={columns[col.id]}
                      onChange={() => toggleColumn(col.id)}
                    />
                    <span className="text-slate-700">{col.label}</span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Tabs value={filterStatus} onValueChange={setFilterStatus}>
            <TabsList>
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="pendente">Pendentes</TabsTrigger>
              <TabsTrigger value="devolvido">Devolvidos</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </Card>

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              {columns.tipo && <TableHead>Tipo</TableHead>}
              {columns.codigo && <TableHead className="w-20">Cód.</TableHead>}
              {columns.medicamento && <TableHead>Medicamento</TableHead>}
              {columns.lote && <TableHead>Lote</TableHead>}
              {columns.qtd && <TableHead className="text-center">Qtd</TableHead>}
              {columns.destinatario && <TableHead>Destinatário</TableHead>}
              {columns.data && <TableHead>Data Empréstimo</TableHead>}
              {columns.status && <TableHead>Status</TableHead>}
              {columns.acoes && <TableHead className="text-center">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <TableRow key={i}>
                  {Array(Object.values(columns).filter(Boolean).length || 1).fill(0).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredEmprestimos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={Object.values(columns).filter(Boolean).length || 1} className="text-center py-12">
                  <HandHelping className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Nenhum empréstimo encontrado</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredEmprestimos.map((emp) => (
                <TableRow key={emp.id} className="hover:bg-slate-50/50">
                  {columns.tipo && (
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          emp.tipo === "emprestar"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-green-50 text-green-700 border-green-200"
                        }
                      >
                        {emp.tipo === "emprestar" ? (
                          <><ArrowUpCircle className="w-3 h-3 mr-1" /> Cedido</>
                        ) : (
                          <><ArrowDownCircle className="w-3 h-3 mr-1" /> Recebido</>
                        )}
                      </Badge>
                    </TableCell>
                  )}
                  {columns.codigo && (
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px] uppercase">
                        {medicamentos.find(m => m.id === emp.medicamento_id)?.codigo || "S/C"}
                      </Badge>
                    </TableCell>
                  )}
                  {columns.medicamento && (
                    <TableCell className="font-medium text-slate-800">
                      {emp.medicamento_nome}
                    </TableCell>
                  )}
                  {columns.lote && (
                    <TableCell>
                      {emp.numero_lote ? (
                        <Badge variant="outline">{emp.numero_lote}</Badge>
                      ) : "-"}
                    </TableCell>
                  )}
                  {columns.qtd && (
                    <TableCell className="text-center">
                      <Badge className="bg-purple-100 text-purple-700">{emp.quantidade}</Badge>
                    </TableCell>
                  )}
                  {columns.destinatario && (
                    <TableCell className="text-slate-600">{emp.ala_destino_nome || "-"}</TableCell>
                  )}
                  {columns.data && (
                    <TableCell className="text-slate-600">
                      {format(parseISO(emp.data_emprestimo), "dd/MM/yyyy")}
                    </TableCell>
                  )}
                  {columns.status && (
                    <TableCell>
                      <Badge
                        className={
                          emp.status === "devolvido"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }
                      >
                        {emp.status === "devolvido" ? (
                          <><CheckCircle className="w-3 h-3 mr-1" /> Devolvido</>
                        ) : (
                          <><Clock className="w-3 h-3 mr-1" /> Pendente</>
                        )}
                      </Badge>
                    </TableCell>
                  )}
                  {columns.acoes && (
                    <TableCell className="text-center">
                      <div className="flex gap-1 justify-center">
                        {emp.status === "pendente" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDevolver(emp)}
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          >
                            Devolver
                          </Button>
                        )}
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(emp.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Form Modal */}
      <EmprestimoForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        medicamentos={medicamentos}
        lotes={lotes}
        alas={alas}
        isLoading={createEmprestimoMutation.isPending}
      />


      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Empréstimo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                const emp = emprestimos.find(e => e.id === deleteId);
                if (emp) deleteMutation.mutate(emp);
                setDeleteId(null);
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Relatório Modal */}
      <Dialog open={relatorioOpen} onOpenChange={setRelatorioOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="no-print">
            <DialogTitle>Relatório de Empréstimos</DialogTitle>
            <div className="flex gap-2 mt-4">
              <Button onClick={handlePrintRelatorio} variant="outline" size="sm">
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
              <Button onClick={handleExportPDF} size="sm" className="bg-red-600 hover:bg-red-700">
                <FileText className="w-4 h-4 mr-2" />
                Exportar PDF
              </Button>
            </div>
          </DialogHeader>

          <div ref={relatorioRef} className="p-8 bg-white">
            {/* Cabeçalho */}
            <div className="text-center mb-8 pb-6 border-b-2 border-amber-600">
              <div className="flex justify-between items-center mb-4">
                <div className="text-left">
                  <p className="text-amber-600 font-bold text-xl uppercase tracking-tight">ZORION SAÚDE</p>
                  <p className="text-slate-500 text-xs">Sistema de Controle Farmacêutico</p>
                </div>
                <div className="text-right text-[10px] text-slate-400 font-mono">
                  <p>Gerado em:</p>
                  <p>{format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                </div>
              </div>

              <h1 className="text-2xl font-bold text-slate-800 mb-1 uppercase tracking-widest">Relatório de Empréstimos</h1>
              <p className="text-slate-500 text-sm font-medium">Controle de Saída Temporária de Medicamentos</p>
            </div>

            {/* Tabela */}
            <table className="w-full border-collapse mb-12">
              <thead>
                <tr className="bg-amber-600 text-white">
                  <th className="text-left py-2 px-3 text-xs font-semibold border border-amber-600">Data</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold border border-amber-600">Cód.</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold border border-amber-600">Medicamento</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold border border-amber-600">Lote</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold border border-amber-600">Qtd</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold border border-amber-600">Destino</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold border border-amber-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmprestimos.map((emp, idx) => {
                  const med = medicamentos.find(m => m.id === emp.medicamento_id);
                  return (
                    <tr key={emp.id} className={idx % 2 === 0 ? "bg-slate-50/50" : "bg-white"}>
                      <td className="py-2 px-3 border border-slate-200 text-sm">
                        {format(parseISO(emp.data_emprestimo), "dd/MM/yyyy")}
                      </td>
                      <td className="py-2 px-3 border border-slate-200 text-[10px] font-mono whitespace-nowrap">
                        {med?.codigo || "S/C"}
                      </td>
                      <td className="py-2 px-3 border border-slate-200 text-sm font-medium">{emp.medicamento_nome}</td>
                      <td className="py-2 px-3 border border-slate-200 text-sm">{emp.numero_lote}</td>
                      <td className="py-2 px-3 border border-slate-200 text-center font-bold text-amber-700 text-sm">
                        {emp.quantidade}
                      </td>
                      <td className="py-2 px-3 border border-slate-200 text-sm">{emp.ala_destino_nome || "-"}</td>
                      <td className="py-2 px-3 border border-slate-200 text-center">
                        <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${emp.status === "devolvido" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                          }`}>
                          {emp.status === "devolvido" ? "Devolvido" : "Pendente"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Área de Assinaturas */}
            <div className="grid grid-cols-2 gap-8 mt-12 pt-8 border-t-2 border-slate-300">
              <div>
                <p className="text-sm text-slate-600 mb-8">Responsável pelo Empréstimo:</p>
                <div className="border-t border-slate-400 pt-2">
                  <p className="text-xs text-slate-500">Assinatura</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-8">Responsável pelo Recebimento:</p>
                <div className="border-t border-slate-400 pt-2">
                  <p className="text-xs text-slate-500">Assinatura</p>
                </div>
              </div>
            </div>

            {/* Observações */}
            <div className="mt-8">
              <p className="text-sm font-semibold text-slate-700 mb-2">Observações:</p>
              <div className="border border-slate-300 rounded p-3 min-h-[60px]"></div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
          .no-print, nav, header, footer, button { display: none !important; }
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
          
          .border-b-2.border-amber-600 {
            border-bottom-color: #d97706 !important;
            border-bottom-width: 2px !important;
          }
          
          .bg-amber-50 { background-color: #fffbeb !important; }
          .bg-emerald-50 { background-color: #ecfdf5 !important; }
          .bg-red-50 { background-color: #fef2f2 !important; }
          .bg-slate-50 { background-color: #f8fafc !important; }
          
          .text-amber-600 { color: #d97706 !important; }
          .text-amber-700 { color: #b45309 !important; }
          .text-emerald-700 { color: #047857 !important; }
          .text-red-700 { color: #b91c1c !important; }
          
          .bg-emerald-100 { background-color: #d1fae5 !important; }
          .bg-red-100 { background-color: #fee2e2 !important; }
        }
      `}</style>
    </div>
  );
}
