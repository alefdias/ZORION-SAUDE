import { normalizeSearch } from "@/utils/searchUtils";
import { useState, useRef, useEffect, useMemo } from "react";
import { db } from "@/api/db";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Plus, Search, PackagePlus, FileText, Trash2, Printer, AlertTriangle, Clock, Pencil, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format, differenceInDays, parseISO, subDays, addDays, isValid, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { safeFormatDate } from "@/utils/dateUtils";
import { isMav, isPsicotropico } from "@/utils/mavUtils";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import EntradaForm from "@/components/forms/EntradaForm";
import { normalizeApresentacao } from "@/components/forms/MedicamentoForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings2 } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useSearchParams } from "react-router-dom";

export default function Entradas({ isTab = false }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [editingEntrada, setEditingEntrada] = useState(null);
  const [dateRange, setDateRange] = useState({ from: undefined, to: undefined });

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
    validade: true,
    dataEntrada: true,
    qtd: true,
    fornecedor: true,
    acoes: true
  });

  const printRef = useRef();

  const queryClient = useQueryClient();

  const { data: entradas = [], isLoading } = useQuery({
    queryKey: ['entradas'],
    queryFn: () => db.entities.Entrada.list('-created_date'),
  });

  const { data: medicamentos = [] } = useQuery({
    queryKey: ['medicamentos'],
    queryFn: () => db.entities.Medicamento.list(),
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ['fornecedores'],
    queryFn: () => db.entities.Fornecedor.list('nome'),
  });

  const { data: lotes = [] } = useQuery({
    queryKey: ['lotes'],
    queryFn: () => db.entities.Lote.list(),
  });

  const handlePrevDay = () => {
    setDateRange(prev => prev.from ? { from: subDays(prev.from, 1), to: subDays(prev.to || prev.from, 1) } : { from: subDays(new Date(), 1), to: subDays(new Date(), 1) });
  };

  const handleNextDay = () => {
    setDateRange(prev => prev.from ? { from: addDays(prev.from, 1), to: addDays(prev.to || prev.from, 1) } : { from: addDays(new Date(), 1), to: addDays(new Date(), 1) });
  };

  const medicamentosMap = useMemo(() => {
    const map = {};
    medicamentos.forEach(m => {
      map[m.id] = m;
    });
    return map;
  }, [medicamentos]);

  const filteredEntradas = useMemo(() => {
    return (entradas || []).filter(e => {
    const searchLow = (search || "").toLowerCase();
    
    // Filtro por termo de busca
    const matchesSearch = (e.medicamento_nome?.toLowerCase().includes(searchLow) ?? true) ||
                         (e.numero_lote?.toLowerCase().includes(searchLow) ?? true);
    
    // Filtro por data
    let matchesDate = true;
    if (dateRange?.from) {
      const entradaDateStr = e.data_entrada?.split('T')[0];
      const entradaDate = parseISO(entradaDateStr);
      
      const from = startOfDay(dateRange.from);
      const to = dateRange.to ? dateRange.to : startOfDay(dateRange.from);
      // Ajustamos endOfDay manualmente ou apenas checamos > from e <= to (se o to for final do dia)
      matchesDate = entradaDate.getTime() >= from.getTime() && entradaDate.getTime() <= (to.getTime() + 86400000);
    }

    // Ignora transferências internas e recebimento de pedidos da satélite na tela de compras/entradas
    const isNotTransferencia = e.tipo !== "Transferência Central -> Satélite" && 
                               !e.tipo?.toLowerCase().includes("transferência") &&
                               !e.fornecedor_nome?.toLowerCase().includes("recebimento pedido");

    return matchesSearch && matchesDate && isNotTransferencia;
  });
  }, [entradas, search, dateRange]);

  const createEntradaMutation = useMutation({
    mutationFn: async (data) => {
      console.log("Iniciando registro de entrada. Dados recebidos:", data);
      try {
        // 1. Obter dados frescos do DB para evitar problemas no Bulk Import
        const existingLotes = await db.entities.Lote.list();
        const normLote = (str) => (str || "").trim().toUpperCase();
        let loteParam = existingLotes.find(
          l => String(l.medicamento_id) === String(data.medicamento_id) && normLote(l.numero_lote) === normLote(data.numero_lote)
        );

        const volFrasco = data.volume_frasco_ml ? Number(data.volume_frasco_ml) : null;

        const qtdNum = Number(data.quantidade) || 0;
        let finalLoteId;
        if (loteParam) {
          console.log("Lote existente encontrado:", loteParam);
          // Atualizar quantidade do lote existente e volume se informado
          const novaQtd = (Number(loteParam.quantidade_atual) || 0) + qtdNum;
          const novaQtdInicial = (Number(loteParam.quantidade_inicial) || 0) + qtdNum;
          await db.entities.Lote.update(loteParam.id, {
            quantidade_atual: novaQtd,
            quantidade_inicial: novaQtdInicial,
            data_validade: data.data_validade || loteParam.data_validade,
            status: "disponivel",
            volume_frasco_ml: volFrasco || loteParam.volume_frasco_ml || null,
          });
          finalLoteId = loteParam.id;
        } else {
          console.log("Criando novo lote...");
          // Criar novo lote com volume do frasco
          const newLote = await db.entities.Lote.create({
            medicamento_id: data.medicamento_id,
            numero_lote: (data.numero_lote || "").trim(),
            data_validade: data.data_validade,
            quantidade_inicial: qtdNum,
            quantidade_atual: qtdNum,
            quantidade_satelite: 0,
            volume_frasco_ml: volFrasco,
            status: "disponivel",
          });
          finalLoteId = newLote.id;
        }

        // 2. Criar a entrada com o lote_id vinculado e volume_frasco_ml
        // Obter dados do usuário logado para vinculação oficial
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

        console.log("Criando registro de entrada...");
        const entradaData = {
          medicamento_id: data.medicamento_id,
          medicamento_nome: data.medicamento_nome,
          numero_lote: data.numero_lote,
          data_validade: data.data_validade,
          data_entrada: data.data_entrada,
          quantidade: qtdNum,
          volume_frasco_ml: volFrasco,
          fornecedor_id: data.fornecedor_id,
          fornecedor_nome: data.fornecedor_nome,
          lote_id: finalLoteId,
          responsavel: responsavel,
          responsavel_crf: responsavelCrf,
          usuario_nome: responsavel
        };
        console.log("Dados da entrada a serem salvos:", entradaData);
        const entrada = await db.entities.Entrada.create(entradaData);
        console.log("Entrada criada com sucesso:", entrada);

        // 3. Atualizar estoque do medicamento (e volume cadastrado se solicitado)
        const med = await db.entities.Medicamento.get(data.medicamento_id).catch(() => null)
          || (await db.entities.Medicamento.list()).find(m => String(m.id) === String(data.medicamento_id));
        if (med) {
          console.log("Atualizando estoque do medicamento:", med.nome);
          const novoEstoque = (Number(med.estoque_atual) || 0) + qtdNum;
          const medUpdate = {
            estoque_atual: novoEstoque,
          };
          if (data.atualizar_cadastro_med && volFrasco) {
            medUpdate.volume_frasco_ml = volFrasco;
            medUpdate.is_liquido = true;
          }
          await db.entities.Medicamento.update(med.id, medUpdate);
        }

        return entrada;
      } catch (error) {
        console.error("ERRO CRÍTICO NO REGISTRO DE ENTRADA:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entradas'] });
      queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      setFormOpen(false);
      toast.success("Entrada registrada com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao registrar entrada:", error);
      toast.error(typeof error === 'string' ? error : (error.message || "Erro ao registrar entrada"));
    },
  });


  const updateEntradaMutation = useMutation({
    mutationFn: async (data) => {
      console.log("Iniciando atualização de entrada:", data);
      const oldEntrada = editingEntrada;
      const qtyDiff = data.quantidade - oldEntrada.quantidade;

      try {
        // 1. Reverter ou atualizar o lote antigo
        const oldLote = lotes.find(l => l.id === oldEntrada.lote_id);
        
        const mudouMedicamento = data.medicamento_id && String(data.medicamento_id) !== String(oldEntrada.medicamento_id);
        const volFrasco = data.volume_frasco_ml ? Number(data.volume_frasco_ml) : null;
        
        if (mudouMedicamento) {
          // 1. Reverter estoque do medicamento antigo
          const oldMed = medicamentos.find(m => String(m.id) === String(oldEntrada.medicamento_id));
          if (oldMed) {
            await db.entities.Medicamento.update(oldMed.id, {
              estoque_atual: Math.max(0, (Number(oldMed.estoque_atual) || 0) - Number(oldEntrada.quantidade))
            });
          }

          // 2. Creditar no novo medicamento
          const newMed = medicamentos.find(m => String(m.id) === String(data.medicamento_id));
          if (newMed) {
            const medUp = {
              estoque_atual: (Number(newMed.estoque_atual) || 0) + Number(data.quantidade),
            };
            if (data.atualizar_cadastro_med && volFrasco) {
              medUp.volume_frasco_ml = volFrasco;
              medUp.is_liquido = true;
            }
            await db.entities.Medicamento.update(newMed.id, medUp);
          }

          // 3. Atualizar o lote vinculado para apontar para o novo medicamento (essencial para aparecer em Transferência)
          if (oldLote) {
            await db.entities.Lote.update(oldLote.id, {
              medicamento_id: data.medicamento_id,
              medicamento_nome: data.medicamento_nome,
              numero_lote: data.numero_lote,
              quantidade_atual: Math.max(0, (Number(oldLote.quantidade_atual) || 0) + qtyDiff),
              data_validade: data.data_validade,
              volume_frasco_ml: volFrasco || oldLote.volume_frasco_ml || null,
            });
          }
        } else {
          // Mesmo medicamento, ajusta lote e estoque
          if (oldLote) {
            await db.entities.Lote.update(oldLote.id, {
              quantidade_atual: (Number(oldLote.quantidade_atual) || 0) + qtyDiff,
              numero_lote: data.numero_lote,
              data_validade: data.data_validade,
              volume_frasco_ml: volFrasco || oldLote.volume_frasco_ml || null,
            });
          }

          const oldMed = medicamentos.find(m => String(m.id) === String(oldEntrada.medicamento_id));
          if (oldMed) {
            const medUp = {
              estoque_atual: (Number(oldMed.estoque_atual) || 0) + qtyDiff,
            };
            if (data.atualizar_cadastro_med && volFrasco) {
              medUp.volume_frasco_ml = volFrasco;
              medUp.is_liquido = true;
            }
            await db.entities.Medicamento.update(oldMed.id, medUp);
          }
        }

        // 3. Atualizar a entrada
        const entradaData = {
          medicamento_id: data.medicamento_id,
          medicamento_nome: data.medicamento_nome,
          numero_lote: data.numero_lote,
          data_validade: data.data_validade,
          data_entrada: data.data_entrada,
          quantidade: data.quantidade,
          volume_frasco_ml: volFrasco,
          fornecedor_id: data.fornecedor_id,
          fornecedor_nome: data.fornecedor_nome,
        };
        console.log("Salvando dados da entrada atualizada:", entradaData);
        return await db.entities.Entrada.update(oldEntrada.id, entradaData);
      } catch (error) {
        console.error("ERRO AO ATUALIZAR ENTRADA:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entradas'] });
      queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      setFormOpen(false);
      setEditingEntrada(null);
      toast.success("Entrada atualizada com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar entrada: " + (typeof error === 'string' ? error : (error.message || error)));
    },
  });

  const deleteEntradaMutation = useMutation({
    mutationFn: async (entrada) => {
      const qtdEntrada = Number(entrada.quantidade) || 0;
      // 1. Reverter estoque do medicamento
      const med = await db.entities.Medicamento.get(entrada.medicamento_id).catch(() => null)
        || medicamentos.find(m => String(m.id) === String(entrada.medicamento_id));
      if (med) {
        await db.entities.Medicamento.update(med.id, {
          estoque_atual: Math.max(0, (Number(med.estoque_atual) || 0) - qtdEntrada),
        });
      }

      // 2. Reverter quantidade do lote
      const lote = lotes.find(l => 
        (entrada.lote_id && String(l.id) === String(entrada.lote_id)) ||
        (String(l.medicamento_id) === String(entrada.medicamento_id) && String(l.numero_lote || '').trim().toUpperCase() === String(entrada.numero_lote || '').trim().toUpperCase())
      );
      if (lote) {
        const novaQuantidade = Math.max(0, (Number(lote.quantidade_atual) || 0) - qtdEntrada);
        await db.entities.Lote.update(lote.id, {
          quantidade_atual: novaQuantidade,
          status: novaQuantidade <= 0 ? "esgotado" : lote.status,
        });
      }

      // 3. Deletar a entrada
      await db.entities.Entrada.delete(entrada.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entradas'] });
      queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      setDeleteId(null);
      toast.success("Entrada deletada com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao deletar entrada");
    },
  });

  const handleSave = (data) => {
    if (editingEntrada) {
      updateEntradaMutation.mutate(data);
    } else {
      createEntradaMutation.mutate(data);
    }
  };

  const handleDelete = () => {
    const entrada = entradas.find(e => e.id === deleteId);
    if (entrada) {
      deleteEntradaMutation.mutate(entrada);
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
      pdf.save(`relatorio-entradas-${format(new Date(), "dd-MM-yyyy")}.pdf`);
      toast.dismiss();
      toast.success("PDF exportado com sucesso!");
    } catch (error) {
      toast.dismiss();
      toast.error("Erro ao gerar PDF");
    }
  };


  const reportContent = (
    <>
      <div className="text-center mb-8 pb-6 border-b-2 border-emerald-600">
        <div className="flex justify-between items-center mb-4">
          <div className="text-left">
            <p className="text-emerald-600 font-bold text-xl uppercase tracking-tight">ZORION SAÚDE</p>
            <p className="text-slate-500 text-xs">Sistema de Controle Farmacêutico</p>
          </div>
          <div className="text-right text-[10px] text-slate-400 font-mono">
            <p>Gerado em:</p>
            <p>{format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          </div>
        </div>

        <h1 className="text-2xl font-bold text-slate-800 mb-1 uppercase tracking-widest">Relatório de Entradas</h1>
        <p className="text-slate-500 text-sm font-medium">Registro Cronológico de Aquisição de Medicamentos</p>
      </div>

      <div className="mb-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="border border-slate-200 rounded-lg p-4 bg-emerald-50">
            <p className="text-xs font-medium text-slate-600 mb-2">Total de Entradas</p>
            <p className="text-2xl font-bold text-emerald-700">{filteredEntradas.length}</p>
          </div>
          <div className="border border-slate-200 rounded-lg p-4 bg-blue-50">
            <p className="text-xs font-medium text-slate-600 mb-2">Quantidade Total</p>
            <p className="text-2xl font-bold text-blue-700">
              {filteredEntradas.reduce((sum, e) => sum + (e.quantidade || 0), 0).toLocaleString('pt-BR')}
            </p>
          </div>
        </div>

        <table className="w-full border-collapse border border-slate-300">
          <thead>
            <tr className="bg-emerald-600 text-white">
              <th className="text-left py-2 px-3 text-xs font-semibold border border-emerald-600">Data</th>
              <th className="text-left py-2 px-3 text-xs font-semibold border border-emerald-600">Cód.</th>
              <th className="text-left py-2 px-3 text-xs font-semibold border border-emerald-600">Medicamento</th>
              <th className="text-left py-2 px-3 text-xs font-semibold border border-emerald-600">Lote</th>
              <th className="text-center py-2 px-3 text-xs font-semibold border border-emerald-600">Qtd</th>
              <th className="text-left py-2 px-3 text-xs font-semibold border border-emerald-600">Fornecedor</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntradas.map((entrada, idx) => {
              const med = medicamentosMap[entrada.medicamento_id];
              return (
                <tr key={entrada.id} className={idx % 2 === 0 ? "bg-slate-50/50" : "bg-white"}>
                  <td className="py-2 px-3 border border-slate-200 text-sm">
                    {safeFormatDate(entrada.data_entrada)}
                  </td>
                  <td className="py-2 px-3 border border-slate-200 text-[10px] font-mono whitespace-nowrap">
                    {med?.codigo || "S/C"}
                  </td>
                  <td className="py-2 px-3 border border-slate-200 text-sm font-medium">
                    <div>{entrada.medicamento_nome}</div>
                    {(med?.concentracao || med?.apresentacao) && (
                      <div className="text-xs text-slate-500 font-normal">
                        {med?.concentracao ? med.concentracao : (med?.unidade_medida || "")}
                        {med?.concentracao && med?.apresentacao ? ` • ${med.apresentacao}` : (med?.apresentacao || "")}
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-3 border border-slate-200 text-sm">{entrada.numero_lote}</td>
                  <td className="py-2 px-3 border border-slate-200 text-center font-bold text-emerald-700 text-sm">
                    +{entrada.quantidade}
                  </td>
                  <td className="py-2 px-3 border border-slate-200 text-sm">{entrada.fornecedor_nome || "-"}</td>
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

  const numVisibleColumns = Object.values(visibleColumns).filter(Boolean).length;

  return (
    <div className={cn("p-6 space-y-5 h-[calc(100vh)] overflow-hidden flex flex-col bg-slate-50/50", isTab && "p-4 h-[calc(100vh-140px)]")}>
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Registro de Entradas</h1>
          <p className="text-slate-500 text-sm font-medium mt-1">Controle cronológico e gestão de novos lotes e notas fiscais</p>
        </div>
        <div className="flex items-center gap-2.5 no-print">
          <Button variant="outline" onClick={() => setReportOpen(true)} className="gap-2 border-slate-300 hover:bg-slate-100 text-slate-700 shadow-sm transition-all">
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Relatório</span>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="border-slate-300 hover:bg-slate-100 text-slate-700 shadow-sm transition-all gap-2">
                <Settings2 className="w-4 h-4" />
                <span className="hidden sm:inline">Colunas</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {Object.keys(visibleColumns).map((col) => (
                <DropdownMenuCheckboxItem
                  key={col}
                  className="capitalize cursor-pointer"
                  checked={visibleColumns[col]}
                  onCheckedChange={(checked) =>
                    setVisibleColumns((prev) => ({ ...prev, [col]: checked }))
                  }
                >
                  {col === "codigo" ? "Cód." :
                    col === "dataEntrada" ? "Data Entrada" :
                      col === "qtd" ? "Quantidade" :
                        col === "acoes" ? "Ações" : col}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={() => { setEditingEntrada(null); setFormOpen(true); }} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 gap-2 transition-all">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline font-semibold">Nova Entrada</span>
          </Button>
        </div>
      </div>

      {/* Search and Date Filter */}
      <Card className="p-1.5 border-slate-200 shadow-sm bg-white rounded-xl flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-auto flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Buscar por medicamento, lote ou nota fiscal..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-slate-50 border-slate-200 hover:border-slate-300 focus:bg-white transition-colors h-10 rounded-lg text-sm w-full md:max-w-md"
          />
        </div>

        <div className="flex items-center gap-0 bg-slate-100/50 border border-slate-200 p-1 rounded-lg">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "h-8 px-4 flex items-center gap-2 text-xs font-semibold transition-all rounded-md bg-white border border-slate-200 shadow-sm min-w-[200px] justify-center",
                  dateRange?.from ? "text-emerald-700 bg-emerald-50/50 border-emerald-200" : "text-slate-600"
                )}
              >
                <CalendarIcon className={cn("h-4 w-4", dateRange?.from ? "text-emerald-600" : "text-slate-400")} />
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
      </Card>

      {/* Table */}
      <Card className="border border-slate-200 shadow-sm relative h-[calc(100vh-230px)] rounded-xl overflow-hidden bg-white">
        <Table className="min-w-[1200px] w-full" containerClassName="absolute inset-0 border-0">
          <TableHeader className="sticky top-0 z-20 bg-slate-100/80 backdrop-blur-md border-b border-slate-200">
            <TableRow className="hover:bg-transparent">
              {visibleColumns.codigo && <TableHead className="w-20 text-xs font-bold text-slate-600 uppercase tracking-wider">Cód.</TableHead>}
              {visibleColumns.medicamento && <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">Medicamento</TableHead>}
              {visibleColumns.lote && <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">Lote</TableHead>}
              {visibleColumns.validade && <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">Validade</TableHead>}
              {visibleColumns.dataEntrada && <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">Data Entrada</TableHead>}
              {visibleColumns.qtd && <TableHead className="text-center text-xs font-bold text-slate-600 uppercase tracking-wider">Qtd</TableHead>}
              {visibleColumns.fornecedor && <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">Fornecedor</TableHead>}
              {visibleColumns.acoes && <TableHead className="text-center w-16"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <TableRow key={i}>
                  {Array(numVisibleColumns).fill(0).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filteredEntradas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={numVisibleColumns} className="text-center py-12">
                  <PackagePlus className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500 dark:text-slate-400">Nenhuma entrada encontrada</p>
                </TableCell>
              </TableRow>
            ) : (
              filteredEntradas.map((entrada) => (
                <TableRow key={entrada.id} className="hover:bg-slate-50/50">
                  {visibleColumns.codigo && (
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px] uppercase">
                        {medicamentosMap[entrada.medicamento_id]?.codigo || "S/C"}
                      </Badge>
                    </TableCell>
                  )}
                  {visibleColumns.medicamento && (() => {
                    const med = medicamentosMap[entrada.medicamento_id];
                    const apr = med?.apresentacao ? normalizeApresentacao(med.apresentacao) : "COMPRIMIDO";
                    return (
                      <TableCell className={cn("font-medium text-slate-800", isMav(entrada.medicamento_nome) && "text-red-900 font-bold")}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{entrada.medicamento_nome}</span>
                          {isMav(entrada.medicamento_nome) && <Badge variant="destructive" className="text-[10px] py-0 px-1">MAV</Badge>}
                          {med?.is_adiantamento && (
                            <Badge className="bg-amber-100 text-amber-800 border border-amber-300 font-semibold text-[10px] py-0 px-1.5">
                              💳 Adiantamento
                            </Badge>
                          )}
                          {med && isPsicotropico(med.grupo_terapeutico) && <User className="inline-block w-4 h-4 text-indigo-600" title="Requer nome do paciente" />}
                        </div>
                        <div className="flex gap-2 items-center text-xs mt-1">
                          <span className="text-slate-500 font-medium">
                            {(med?.concentracao || med?.unidade_medida) ? `Concentração: ${med?.concentracao || med?.unidade_medida}` : "Concentração não definida"}
                          </span>
                          <span className="text-slate-500 font-medium px-2 border-l border-slate-200">
                            {apr}
                          </span>
                        </div>
                      </TableCell>
                    );
                  })()}
                  {visibleColumns.lote && (
                    <TableCell>
                      <div className="flex flex-col gap-1 items-start">
                        <Badge variant="outline">{entrada.numero_lote}</Badge>
                        {entrada.volume_frasco_ml && (
                          <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-[10px] font-bold">
                            💧 {entrada.volume_frasco_ml} mL
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  )}
                  {visibleColumns.validade && (
                    <TableCell>
                      {entrada.data_validade ? (() => {
                        const dias = (() => { const d = isValid(parseISO(entrada.data_validade)) ? parseISO(entrada.data_validade) : null; return d ? differenceInDays(d, new Date()) : null; })();
                        if (dias < 0) return (
                          <span className="flex items-center gap-1">
                            <Badge className="bg-red-100 text-red-700 gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              {safeFormatDate(entrada.data_validade)}
                            </Badge>
                          </span>
                        );
                        if (dias <= 90) return (
                          <Badge className="bg-amber-100 text-amber-700 gap-1">
                            <Clock className="w-3 h-3" />
                            {safeFormatDate(entrada.data_validade)}
                          </Badge>
                        );
                        return <span className="text-slate-600 text-sm">{safeFormatDate(entrada.data_validade)}</span>;
                      })() : <span className="text-slate-400">—</span>}
                    </TableCell>
                  )}
                  {visibleColumns.dataEntrada && (
                    <TableCell className="text-slate-600">
                      {entrada.data_entrada && safeFormatDate(entrada.data_entrada)}
                    </TableCell>
                  )}
                  {visibleColumns.qtd && (
                    <TableCell className="text-center">
                      <Badge className="bg-emerald-100 text-emerald-700 font-bold">+{entrada.quantidade}</Badge>
                      {entrada.volume_frasco_ml && (
                        <span className="block text-[10px] text-slate-500 font-medium mt-0.5 whitespace-nowrap">
                          frascos ({entrada.quantidade * Number(entrada.volume_frasco_ml)} mL)
                        </span>
                      )}
                    </TableCell>
                  )}
                  {visibleColumns.fornecedor && (
                    <TableCell className="text-slate-600">
                      {entrada.fornecedor_nome || "-"}
                    </TableCell>
                  )}
                  {visibleColumns.acoes && (
                    <TableCell className="text-center">
                      <div className="flex justify-center gap-1">

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingEntrada(entrada);
                            setFormOpen(true);
                          }}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(entrada.id)}
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

      <EntradaForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingEntrada(null);
        }}
        onSave={handleSave}
        medicamentos={medicamentos}
        fornecedores={fornecedores}
        isLoading={createEntradaMutation.isPending || updateEntradaMutation.isPending}
        entrada={editingEntrada}
      />


      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar esta entrada? Esta ação reverterá o estoque e não poderá ser desfeita.
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
            <DialogTitle>Relatório de Entradas</DialogTitle>
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
          
          .border-b-2.border-emerald-600 {
            border-bottom-color: #059669 !important;
            border-bottom-width: 2px !important;
          }
          
          .bg-emerald-50 { background-color: #ecfdf5 !important; }
          .bg-blue-50 { background-color: #eff6ff !important; }
          .bg-purple-50 { background-color: #f5f3ff !important; }
          .bg-slate-50 { background-color: #f8fafc !important; }
          
          .text-emerald-600 { color: #059669 !important; }
          .text-emerald-700 { color: #047857 !important; }
          .text-blue-700 { color: #1d4ed8 !important; }
          .text-purple-700 { color: #6d28d9 !important; }
        }
      `}</style>
    </div>
  );
}
