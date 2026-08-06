import { useState, useRef, useEffect } from "react";
import { db } from "@/api/db";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Boxes, AlertTriangle, Clock, ArrowRightLeft, Package, Book, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { differenceInDays, parseISO, isValid, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { safeFormatDate, safeParseISO } from "@/utils/dateUtils";
import { isMav, isPsicotropico, getPortaria344List } from "@/utils/mavUtils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Button } from "@/components/ui/button";
import { Download, Printer, Trash2, Pencil, CalendarDays } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { invoke } from "@tauri-apps/api/core";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { ComboboxMedicamento } from "@/components/ui/combobox-medicamento";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const STATUS_COLORS = {
  disponivel: "bg-emerald-100 text-emerald-700",
  vencido: "bg-red-100 text-red-700",
  esgotado: "bg-slate-100 text-slate-500",
};

function EstoqueCarrinhoParadaTab() {
  const { data: estoqueCentral = [], isLoading } = useQuery({
    queryKey: ['carrinhoEstoqueCentral'],
    queryFn: () => db.entities.CarrinhoEstoqueCentral.list(),
  });

  const { data: medicamentos = [] } = useQuery({
    queryKey: ['medicamentos'],
    queryFn: () => db.entities.Medicamento.list(),
  });

  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm p-6 space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </Card>
    );
  }

  const itens = estoqueCentral.map(item => {
    const med = medicamentos.find(m => m.id === item.medicamento_id);
    return { ...item, medicamento: med };
  }).filter(item => (item.quantidade || 0) > 0);

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className="p-4 bg-white border-b border-slate-100">
        <h3 className="font-bold text-slate-800">Estoque Central dos Carrinhos de Parada</h3>
        <p className="text-xs text-slate-500">Itens transferidos do estoque geral para distribuição nos carrinhos</p>
      </div>
      <div className="max-h-[600px] overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-slate-50 z-10 shadow-sm">
            <TableRow>
              <TableHead>Medicamento</TableHead>
              <TableHead>Lote</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead className="text-right">Quantidade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-slate-500 italic">
                  Nenhum item no estoque central dos carrinhos.
                </TableCell>
              </TableRow>
            ) : (
              itens.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-slate-800">
                    {item.medicamento_nome || item.medicamento?.nome || 'Desconhecido'}
                    {item.medicamento?.unidade_medida && item.medicamento.unidade_medida.toLowerCase() !== 'un' && (
                      <span className="text-slate-400 text-xs ml-1">- {item.medicamento.unidade_medida}</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-slate-600">{item.numero_lote || '-'}</TableCell>
                  <TableCell className="text-slate-600">{item.data_validade ? new Date(item.data_validade).toLocaleDateString('pt-BR') : '-'}</TableCell>
                  <TableCell className="text-right font-bold text-amber-700">{item.quantidade}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

export default function Estoque() {

  const queryClient = useQueryClient();
  const printRef = useRef();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [displayCount, setDisplayCount] = useState(50);
  const [selectedLista, setSelectedLista] = useState("");
  const [selectedLivroMedId, setSelectedLivroMedId] = useState("");

  useEffect(() => {
    setDisplayCount(50);
  }, [search, filterStatus]);

  const [deleteLoteId, setDeleteLoteId] = useState(null);
  const [deleteMedId, setDeleteMedId] = useState(null);

  // Estado para modal de troca de validade
  const [trocaValidade, setTrocaValidade] = useState(null); // { loteId, numeroLote, dataAtual }
  const [novaValidade, setNovaValidade] = useState("");
  const [novoNumeroLote, setNovoNumeroLote] = useState("");

  const [transferenciaForm, setTransferenciaForm] = useState({
    direcao: "para_satelite",
    medicamento_id: "",
    lote_id: "",
    quantidade: ""
  });

  const handleTransferenciaChange = (field, value) => {
    setTransferenciaForm(prev => {
      const next = { ...prev, [field]: value };
      
      // Auto-select FEFO lot when medication is selected
      if (field === "medicamento_id") {
        const lotesDoMed = lotes
          .filter(l => l.medicamento_id === value && (next.direcao === "para_satelite" ? l.quantidade_atual > 0 : true))
          .sort((a, b) => new Date(a.data_validade) - new Date(b.data_validade));
        
        const loteFefo = lotesDoMed.length > 0 ? lotesDoMed[0] : null;
        next.lote_id = loteFefo ? loteFefo.id : "";
      }
      
      return next;
    });
  };

  const { data: medicamentos = [], isLoading: loadingMeds } = useQuery({
    queryKey: ['medicamentos'],
    queryFn: () => db.entities.Medicamento.list(),
  });

  const { data: lotes = [], isLoading: loadingLotes } = useQuery({
    queryKey: ['lotes'],
    queryFn: () => db.entities.Lote.list(),
  });

  const { data: historicoTransferencias = [] } = useQuery({
    queryKey: ['saidas', 'transferencias'],
    queryFn: async () => {
      const allSaidas = await db.entities.Saida.list('-created_date');
      return allSaidas.filter(s => s.motivo === "Transferência de Estoque");
    }
  });

  const { data: saidasLivro = [], isLoading: loadingSaidas } = useQuery({
    queryKey: ['saidas', 'livro344'],
    queryFn: () => db.entities.Saida.list('-created_date'),
  });

  const isLoading = loadingMeds || loadingLotes || loadingSaidas;
  const hoje = new Date();

  // Agrupar lotes por medicamento
  const estoquePorMedicamento = medicamentos
    .filter(m => m.ativo !== false)
    .map(med => {
      const lotesDoMed = lotes
        .filter(l => l.medicamento_id === med.id)
        .map(l => {
          const parsedValidade = safeParseISO(l.data_validade);
          const vencido = parsedValidade ? parsedValidade < hoje : false;
          const diasParaVencer = parsedValidade ? differenceInDays(parsedValidade, hoje) : 999;
          return {
            ...l,
            vencido,
            diasParaVencer,
            statusCalculado: vencido ? "vencido" : l.quantidade_atual <= 0 ? "esgotado" : "disponivel",
          };
        })
        .sort((a, b) => {
          const da = safeParseISO(a.data_validade);
          const db = safeParseISO(b.data_validade);
          if (!da) return 1;
          if (!db) return -1;
          return da - db;
        });

      return {
        ...med,
        lotes: lotesDoMed,
        isVelho: med.created_at && isValid(parseISO(med.created_at)) ? differenceInDays(hoje, parseISO(med.created_at)) > 180 : false,
        temAlerta: (med.estoque_atual || 0) <= (med.estoque_minimo || 0),
        temVencido: lotesDoMed.some(l => l.vencido && l.quantidade_atual > 0),
        temProximoVencer: lotesDoMed.some(l => !l.vencido && l.diasParaVencer <= 30 && l.quantidade_atual > 0),
      };
    });

  const filteredEstoque = estoquePorMedicamento.filter(med => {
    const matchSearch =
      med.nome?.toLowerCase().includes(search.toLowerCase()) ||
      med.principio_ativo?.toLowerCase().includes(search.toLowerCase());

    if (filterStatus === "all") return matchSearch;
    if (filterStatus === "baixo") return matchSearch && med.temAlerta;
    if (filterStatus === "vencido") return matchSearch && med.temVencido;
    if (filterStatus === "proximo_vencer") return matchSearch && med.temProximoVencer;
    return matchSearch;
  }).sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));

  const handleExportCSV = () => {
    try {
      const headers = ["Medicamento", "Dosagem", "Lote", "Validade", "Quantidade", "Status"];
      const rows = [];

      filteredEstoque.forEach(med => {
        if (med.lotes.length === 0) {
          rows.push([
            med.nome,
            med.unidade_medida || "-",
            "Sem Lote",
            "-",
            med.estoque_atual || 0,
            med.temAlerta ? "Estoque Baixo" : "OK"
          ]);
        } else {
          med.lotes.forEach(lote => {
            rows.push([
              med.nome,
              med.unidade_medida || "-",
              lote.numero_lote,
              safeFormatDate(lote.data_validade),
              lote.quantidade_atual,
              lote.statusCalculado === "disponivel" ? "Disponivel" : lote.statusCalculado === "vencido" ? "Vencido" : "Esgotado"
            ]);
          });
        }
      });

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
      ].join("\n");

      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `estoque-${format(hoje, "dd-MM-yyyy")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("CSV exportado com sucesso!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao exportar CSV");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDeleteLote = async () => {
    if (!deleteLoteId) return;
    try {
      toast.loading("Excluindo lote...");
      await invoke("delete_lote_cascade", { loteId: deleteLoteId });
      toast.dismiss();
      toast.success("Lote excluído com sucesso.");
      queryClient.invalidateQueries();
    } catch (error) {
      toast.dismiss();
      toast.error(`Erro: ${error}`);
    } finally {
      setDeleteLoteId(null);
    }
  };

  const handleDeleteMedicamento = async () => {
    if (!deleteMedId) return;
    try {
      toast.loading("Excluindo medicamento...");
      await invoke("delete_medicamento_cascade", { medicamentoId: deleteMedId });
      toast.dismiss();
      toast.success("Medicamento excluído com sucesso.");
      queryClient.invalidateQueries();
    } catch (error) {
      toast.dismiss();
      toast.error(`Erro: ${error}`);
    } finally {
      setDeleteMedId(null);
    }
  };

  const handleAbrirTrocaValidade = (lote) => {
    setTrocaValidade({ loteId: lote.id, numeroLote: lote.numero_lote, dataAtual: lote.data_validade });
    const d = safeParseISO(lote.data_validade);
    setNovaValidade(d ? format(d, "yyyy-MM-dd") : "");
    setNovoNumeroLote(lote.numero_lote || "");
  };

  const handleTrocarValidade = async () => {
    if (!trocaValidade || !novaValidade || !novoNumeroLote) return;
    try {
      toast.loading("Atualizando lote...");
      await invoke("update_entity", {
        name: "Lote",
        id: trocaValidade.loteId,
        data: { data_validade: novaValidade, numero_lote: novoNumeroLote },
      });
      toast.dismiss();
      toast.success(`Lote atualizado! Número: ${novoNumeroLote} | Validade: ${format(new Date(novaValidade + 'T00:00:00'), "dd/MM/yyyy")}`);
      queryClient.invalidateQueries();
    } catch (error) {
      toast.dismiss();
      toast.error(`Erro ao atualizar lote: ${error}`);
    } finally {
      setTrocaValidade(null);
      setNovaValidade("");
      setNovoNumeroLote("");
    }
  };

  const observer = useRef();
  const lastElementRef = (node) => {
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && displayCount < filteredEstoque.length) {
        setDisplayCount(prev => prev + 50);
      }
    });
    if (node) observer.current.observe(node);
  };

  const realizarTransferencia = useMutation({
    mutationFn: async () => {
      if (!transferenciaForm.medicamento_id || !transferenciaForm.lote_id || !transferenciaForm.quantidade) {
        throw new Error("Preencha todos os campos");
      }
      const qtd = parseInt(transferenciaForm.quantidade, 10);
      if (isNaN(qtd) || qtd <= 0) {
        throw new Error("Quantidade inválida");
      }
      const lote = lotes.find(l => l.id === transferenciaForm.lote_id);
      const med = medicamentos.find(m => m.id === transferenciaForm.medicamento_id);
      
      if (transferenciaForm.direcao === "para_satelite") {
        if (!lote || lote.quantidade_atual < qtd) {
          throw new Error("Estoque insuficiente no lote selecionado");
        }
        // Update Lote
        await invoke("update_entity", {
          name: "Lote",
          id: lote.id,
          data: { quantidade_atual: lote.quantidade_atual - qtd, status: (lote.quantidade_atual - qtd) <= 0 ? "esgotado" : lote.status }
        });
        // Update Medicamento
        await invoke("update_entity", {
          name: "Medicamento",
          id: med.id,
          data: { 
            estoque_atual: Math.max(0, (med.estoque_atual || 0) - qtd),
            estoque_satelite: (med.estoque_satelite || 0) + qtd
          }
        });
        // Registrar histórico
        await db.entities.Saida.create({
          medicamento_id: med.id,
          medicamento_nome: med.nome,
          lote_id: lote.id,
          numero_lote: lote.numero_lote,
          data_saida: format(new Date(), "yyyy-MM-dd'T'HH:mm:ssXXX"),
          quantidade: qtd,
          destino: "Farmácia Satélite",
          motivo: "Transferência de Estoque",
          observacao: "Transferido do Estoque Geral para Farmácia Satélite"
        });
      } else if (transferenciaForm.direcao === "para_carrinho_parada") {
        if (!lote || lote.quantidade_atual < qtd) {
          throw new Error("Estoque insuficiente no lote selecionado");
        }
        // Update Lote
        await invoke("update_entity", {
          name: "Lote",
          id: lote.id,
          data: { quantidade_atual: lote.quantidade_atual - qtd, status: (lote.quantidade_atual - qtd) <= 0 ? "esgotado" : lote.status }
        });
        // Update Medicamento
        await invoke("update_entity", {
          name: "Medicamento",
          id: med.id,
          data: { 
            estoque_atual: Math.max(0, (med.estoque_atual || 0) - qtd)
          }
        });
        
        // Registrar no CarrinhoEstoqueCentral
        // Verifica se já existe um registro deste medicamento/lote no estoque central do carrinho
        const centralStock = await db.entities.CarrinhoEstoqueCentral.list();
        const existingCentral = centralStock.find(c => c.medicamento_id === med.id && c.lote_id === lote.id);
        
        if (existingCentral) {
           await db.entities.CarrinhoEstoqueCentral.update(existingCentral.id, {
             quantidade: (existingCentral.quantidade || 0) + qtd
           });
        } else {
           await db.entities.CarrinhoEstoqueCentral.create({
             medicamento_id: med.id,
             medicamento_nome: med.nome,
             lote_id: lote.id,
             numero_lote: lote.numero_lote,
             data_validade: lote.data_validade,
             quantidade: qtd
           });
        }
        
        // Registrar histórico do Carrinho
        await db.entities.CarrinhoMovimentacao.create({
             tipo: 'transferencia_central',
             medicamento_id: med.id,
             medicamento_nome: med.nome,
             lote_id: lote.id,
             numero_lote: lote.numero_lote,
             quantidade: qtd,
             responsavel: "Sistema - Transferência de Estoque",
             observacao: "Transferido do Estoque Geral para o Centro de Distribuição dos Carrinhos"
        });

        // Registrar histórico de Saída do Estoque Principal
        await db.entities.Saida.create({
          medicamento_id: med.id,
          medicamento_nome: med.nome,
          lote_id: lote.id,
          numero_lote: lote.numero_lote,
          data_saida: format(new Date(), "yyyy-MM-dd'T'HH:mm:ssXXX"),
          quantidade: qtd,
          destino: "Carrinho de Parada (Estoque Central)",
          motivo: "Transferência de Estoque",
          observacao: "Transferido do Estoque Geral para o Centro de Distribuição dos Carrinhos de Parada"
        });
      } else {
        if ((med.estoque_satelite || 0) < qtd) {
          throw new Error("Estoque insuficiente na satélite");
        }
        // Update Lote
        await invoke("update_entity", {
          name: "Lote",
          id: lote.id,
          data: { quantidade_atual: lote.quantidade_atual + qtd, status: "disponivel" }
        });
        // Update Medicamento
        await invoke("update_entity", {
          name: "Medicamento",
          id: med.id,
          data: { 
            estoque_atual: (med.estoque_atual || 0) + qtd,
            estoque_satelite: Math.max(0, (med.estoque_satelite || 0) - qtd)
          }
        });
        // Registrar histórico
        await db.entities.Saida.create({
          medicamento_id: med.id,
          medicamento_nome: med.nome,
          lote_id: lote.id,
          numero_lote: lote.numero_lote,
          data_saida: format(new Date(), "yyyy-MM-dd'T'HH:mm:ssXXX"),
          quantidade: qtd,
          destino: "Estoque Geral",
          motivo: "Transferência de Estoque",
          observacao: "Devolvido da Farmácia Satélite para o Estoque Geral"
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      queryClient.invalidateQueries({ queryKey: ['saidas'] });
      toast.success("Transferência realizada com sucesso!");
      setTransferenciaForm(prev => ({ ...prev, medicamento_id: "", lote_id: "", quantidade: "" }));
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao realizar transferência");
    }
  });

  const activeMedLotes = lotes
    .filter(l => 
      l.medicamento_id === transferenciaForm.medicamento_id && 
      ((transferenciaForm.direcao === "para_satelite" || transferenciaForm.direcao === "para_carrinho_parada") ? l.quantidade_atual > 0 : true)
    )
    .sort((a, b) => new Date(a.data_validade) - new Date(b.data_validade));
  const selectedTransferLote = lotes.find(l => l.id === transferenciaForm.lote_id);
  const selectedMed = medicamentos.find(m => m.id === transferenciaForm.medicamento_id);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Estoque Central</h1>
          <p className="text-slate-500">Visão geral do almoxarifado, satélite e transferências.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportCSV} variant="outline" className="bg-white">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          <Button onClick={handlePrint} variant="outline" className="bg-white">
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      <Card className="p-4 shadow-sm border-slate-200">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
          <Input
            placeholder="Buscar medicamento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 text-base"
          />
        </div>
      </Card>

      {/* Modal de Troca de Validade */}
      <Dialog open={!!trocaValidade} onOpenChange={(open) => !open && setTrocaValidade(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-blue-600" />
              Trocar Validade do Lote
            </DialogTitle>
            <DialogDescription>
              {trocaValidade && (
                <>
                  Lote: <strong>{trocaValidade.numeroLote}</strong>
                  <br />
                  Validade atual: <strong>{safeFormatDate(trocaValidade.dataAtual)}</strong>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="novo-numero-lote">Novo Número do Lote</Label>
              <Input
                id="novo-numero-lote"
                type="text"
                placeholder="Ex: LT2024-001"
                value={novoNumeroLote}
                onChange={(e) => setNovoNumeroLote(e.target.value)}
                className="text-slate-800"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nova-validade">Nova Data de Validade</Label>
              <Input
                id="nova-validade"
                type="date"
                value={novaValidade}
                onChange={(e) => setNovaValidade(e.target.value)}
                className="text-slate-800"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTrocaValidade(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleTrocarValidade}
              disabled={!novaValidade || !novoNumeroLote}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Confirmar Troca
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="padronizados">
        <TabsList className="mb-6">
          <TabsTrigger value="padronizados" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Padronizados</TabsTrigger>
          <TabsTrigger value="nao_padronizados" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Não Padronizados</TabsTrigger>
          <TabsTrigger value="satelite" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Estoque Satélite</TabsTrigger>
          <TabsTrigger value="carrinho_parada" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Estoque Carrinho de Parada</TabsTrigger>
          <TabsTrigger value="transferencia" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Transferência</TabsTrigger>
        </TabsList>

        <TabsContent value="padronizados" className="space-y-6">
          <Card className="border-0 shadow-sm overflow-hidden p-0 bg-transparent shadow-none">
            <div className="p-4 bg-white border border-slate-100 rounded-t-xl shadow-sm mb-4">
              <h3 className="font-bold text-slate-800">Estoque de Medicamentos Padronizados</h3>
              <p className="text-xs text-slate-500">Clique sobre o medicamento para ver lotes e validades</p>
            </div>
            
            <Accordion type="multiple" className="w-full bg-white rounded-b-xl shadow-sm border border-slate-100">
              {filteredEstoque.filter(m => m.padronizado).length === 0 ? (
                <div className="text-center py-8 text-slate-500 bg-white">Nenhum medicamento padronizado encontrado.</div>
              ) : (
                filteredEstoque.filter(m => m.padronizado).slice(0, displayCount).map(med => {
                  return (
                  <AccordionItem key={med.id} value={med.id} className="border-b border-slate-100 px-4 py-2 hover:bg-slate-50 transition-colors">
                    <AccordionTrigger className="hover:no-underline py-2">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-4">
                          <Badge variant="outline" className="font-mono text-[10px] w-16 justify-center">
                            {med.codigo || "S/C"}
                          </Badge>
                          <div className="text-left">
                            <p className={cn("font-semibold text-slate-800", isMav(med) && "text-red-600 font-bold flex items-center gap-1.5")}>
                              {med.nome}
                              {isMav(med) && <Badge variant="destructive" className="text-[10px] py-0 px-1">MAV</Badge>}
                              {isPsicotropico(med.categoria) && <User className="inline-block w-4 h-4 ml-1 text-indigo-600" title="Requer nome do paciente" />}
                            </p>
                            <div className="flex gap-2 items-center text-xs mt-1">
                              <span className="text-slate-500 font-medium">
                                {med.unidade_medida ? `Dosagem: ${med.unidade_medida}` : "Dosagem não definida"}
                              </span>
                              {med.apresentacao && (
                                <span className="text-slate-500 font-medium px-2 border-l border-slate-200">
                                  {med.apresentacao}
                                </span>
                              )}
                              {med.temAlerta && <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0 text-[10px] px-1 py-0 h-4">Baixo</Badge>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-xs text-slate-500">Estoque Atual</p>
                            <p className={cn("text-lg font-bold", med.temAlerta ? "text-amber-600" : "text-indigo-600")}>
                              {med.estoque_atual || 0}
                            </p>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 pb-2">
                      {(!med.lotes || med.lotes.length === 0) ? (
                        <div className="text-center py-6 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                          <p className="text-sm text-slate-500">Nenhum lote registrado no momento.</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader className="bg-slate-50">
                            <TableRow>
                              <TableHead>Lote</TableHead>
                              <TableHead>Validade</TableHead>
                              <TableHead>Qtd Atual</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-center">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {med.lotes.map(lote => (
                              <TableRow key={lote.id}>
                                <TableCell className="font-medium">{lote.numero_lote}</TableCell>
                                <TableCell className={cn(lote.vencido ? "text-red-600 font-bold" : lote.diasParaVencer <= 30 ? "text-amber-600 font-bold" : "text-emerald-600 font-bold")}>
                                  {safeFormatDate(lote.data_validade)}
                                </TableCell>
                                <TableCell className="font-bold text-slate-700">
                                  {lote.quantidade_atual || 0}
                                </TableCell>
                                <TableCell>
                                  <Badge className={STATUS_COLORS[lote.statusCalculado]}>
                                    {lote.statusCalculado === "disponivel" ? "Disponível" :
                                      lote.statusCalculado === "vencido" ? "Vencido" : "Esgotado"}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1 justify-center">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAbrirTrocaValidade(lote);
                                      }}
                                      title="Trocar validade deste lote"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    {(lote.quantidade_atual <= 0 || lote.vencido) && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeleteLoteId(lote.id);
                                        }}
                                        title="Apagar lote zerado ou vencido"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                  );
                })
              )}
            </Accordion>
            {filteredEstoque.filter(m => m.padronizado).length > displayCount && (
              <div className="p-4 flex justify-center bg-white border-t border-slate-100 rounded-b-xl">
                <Button variant="outline" onClick={() => setDisplayCount(prev => prev + 50)} className="w-full max-w-sm">
                  Carregar Mais Medicamentos
                </Button>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="nao_padronizados" className="space-y-6">
          <Card className="border-0 shadow-sm overflow-hidden p-0 bg-transparent shadow-none">
            <div className="p-4 bg-white border border-slate-100 rounded-t-xl shadow-sm mb-4">
              <h3 className="font-bold text-slate-800">Estoque de Medicamentos Não Padronizados</h3>
              <p className="text-xs text-slate-500">Clique sobre o medicamento para ver lotes e validades</p>
            </div>
            
            <Accordion type="multiple" className="w-full bg-white rounded-b-xl shadow-sm border border-slate-100">
              {filteredEstoque.filter(m => !m.padronizado).length === 0 ? (
                <div className="text-center py-8 text-slate-500 bg-white">Nenhum medicamento não padronizado encontrado.</div>
              ) : (
                filteredEstoque.filter(m => !m.padronizado).slice(0, displayCount).map(med => {
                  return (
                  <AccordionItem key={med.id} value={med.id} className="border-b border-slate-100 px-4 py-2 hover:bg-slate-50 transition-colors">
                    <AccordionTrigger className="hover:no-underline py-2">
                      <div className="flex items-center justify-between w-full pr-4">
                        <div className="flex items-center gap-4">
                          <Badge variant="outline" className="font-mono text-[10px] w-16 justify-center">
                            {med.codigo || "S/C"}
                          </Badge>
                          <div className="text-left">
                            <p className={cn("font-semibold text-slate-800", isMav(med) && "text-red-900 font-bold")}>
                              {med.nome} {isMav(med) && <Badge variant="destructive" className="text-[10px] py-0 px-1">MAV</Badge>}
                              {isPsicotropico(med.categoria) && <User className="inline-block w-4 h-4 ml-2 text-indigo-600" title="Requer nome do paciente" />}
                            </p>
                            <div className="flex gap-2 items-center text-xs mt-1">
                              <span className="text-slate-500 font-medium">
                                {med.unidade_medida ? `Dosagem: ${med.unidade_medida}` : "Dosagem não definida"}
                              </span>
                              {med.apresentacao && (
                                <span className="text-slate-500 font-medium px-2 border-l border-slate-200">
                                  {med.apresentacao}
                                </span>
                              )}
                              {med.temAlerta && <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0 text-[10px] px-1 py-0 h-4">Baixo</Badge>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-xs text-slate-500">Estoque Atual</p>
                            <p className={cn("text-lg font-bold", med.temAlerta ? "text-amber-600" : "text-indigo-600")}>
                              {med.estoque_atual || 0}
                            </p>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 pb-2">
                      {(!med.lotes || med.lotes.length === 0) ? (
                        <div className="text-center py-6 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                          <p className="text-sm text-slate-500">Nenhum lote registrado no momento.</p>
                        </div>
                      ) : (
                        <Table>
                          <TableHeader className="bg-slate-50">
                            <TableRow>
                              <TableHead>Lote</TableHead>
                              <TableHead>Validade</TableHead>
                              <TableHead>Qtd Atual</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-center">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {med.lotes.map(lote => (
                              <TableRow key={lote.id}>
                                <TableCell className="font-medium">{lote.numero_lote}</TableCell>
                                <TableCell className={cn(lote.vencido ? "text-red-600 font-bold" : lote.diasParaVencer <= 30 ? "text-amber-600 font-bold" : "text-emerald-600 font-bold")}>
                                  {safeFormatDate(lote.data_validade)}
                                </TableCell>
                                <TableCell className="font-bold text-slate-700">
                                  {lote.quantidade_atual || 0}
                                </TableCell>
                                <TableCell>
                                  <Badge className={STATUS_COLORS[lote.statusCalculado]}>
                                    {lote.statusCalculado === "disponivel" ? "Disponível" :
                                      lote.statusCalculado === "vencido" ? "Vencido" : "Esgotado"}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1 justify-center">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleAbrirTrocaValidade(lote);
                                      }}
                                      title="Trocar validade deste lote"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    {(lote.quantidade_atual <= 0 || lote.vencido) && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeleteLoteId(lote.id);
                                        }}
                                        title="Apagar lote zerado ou vencido"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                  );
                })
              )}
            </Accordion>
            {filteredEstoque.filter(m => !m.padronizado).length > displayCount && (
              <div className="p-4 flex justify-center bg-white border-t border-slate-100 rounded-b-xl">
                <Button variant="outline" onClick={() => setDisplayCount(prev => prev + 50)} className="w-full max-w-sm">
                  Carregar Mais Medicamentos
                </Button>
              </div>
            )}
          </Card>
        </TabsContent>

      <TabsContent value="satelite" className="space-y-6">
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="p-4 bg-white border-b border-slate-100 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800">Itens na Farmácia Satélite</h3>
              <p className="text-xs text-slate-500">Medicamentos e quantidades atualmente disponíveis no setor satélite</p>
            </div>
          </div>
          <div className="max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-slate-50 z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-24">Cód.</TableHead>
                  <TableHead>Medicamento</TableHead>
                  <TableHead className="text-right">Quantidade (Satélite)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEstoque.filter(m => (m.estoque_satelite || 0) > 0).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-slate-500">
                      Nenhum medicamento encontrado na farmácia satélite.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEstoque.filter(m => (m.estoque_satelite || 0) > 0).map(med => (
                    <TableRow key={med.id}>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px] uppercase">
                          {med.codigo || "S/C"}
                        </Badge>
                      </TableCell>
                      <TableCell className={cn("font-medium text-slate-800", isMav(med) && "text-red-600 font-bold flex items-center gap-1.5")}>
                        {med.nome}
                        {isMav(med) && <Badge variant="destructive" className="text-[10px] py-0 px-1">MAV</Badge>}
                        {isPsicotropico(med.categoria) && <User className="inline-block w-4 h-4 ml-2 text-indigo-600" title="Requer nome do paciente" />}
                        <div className="flex gap-2 items-center text-xs mt-1">
                          <span className="text-slate-500 font-medium">
                            {med.unidade_medida ? `Dosagem: ${med.unidade_medida}` : "Dosagem não definida"}
                          </span>
                          {med.apresentacao && (
                            <span className="text-slate-500 font-medium px-2 border-l border-slate-200">
                              {med.apresentacao}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-bold text-indigo-700">
                        {med.estoque_satelite}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
        </TabsContent>

      <TabsContent value="carrinho_parada" className="space-y-6">
        <EstoqueCarrinhoParadaTab />
      </TabsContent>

      <TabsContent value="transferencia">
        <Card className="max-w-2xl mx-auto p-6 space-y-6 shadow-sm border-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Transferência de Estoque</h2>
            <p className="text-sm text-slate-500">Mova itens entre o estoque geral e a farmácia satélite</p>
          </div>
          
          <div className="space-y-4">
            <div className="flex gap-4 p-1 bg-slate-100 rounded-lg">
              <Button
                variant={transferenciaForm.direcao === "para_satelite" ? "default" : "ghost"}
                className={transferenciaForm.direcao === "para_satelite" ? "bg-blue-600 text-white w-full" : "w-full"}
                onClick={() => handleTransferenciaChange("direcao", "para_satelite")}
              >
                Para Satélite
              </Button>
              <Button
                variant={transferenciaForm.direcao === "para_carrinho_parada" ? "default" : "ghost"}
                className={transferenciaForm.direcao === "para_carrinho_parada" ? "bg-amber-600 text-white w-full" : "w-full"}
                onClick={() => handleTransferenciaChange("direcao", "para_carrinho_parada")}
              >
                Para Carrinho Parada
              </Button>
              <Button
                variant={transferenciaForm.direcao === "para_estoque" ? "default" : "ghost"}
                className={transferenciaForm.direcao === "para_estoque" ? "bg-blue-600 text-white w-full" : "w-full"}
                onClick={() => handleTransferenciaChange("direcao", "para_estoque")}
              >
                Para Estoque Geral
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Medicamento</Label>
              <ComboboxMedicamento
                  medicamentos={medicamentos.filter(m => 
                    (transferenciaForm.direcao === "para_satelite" || transferenciaForm.direcao === "para_carrinho_parada") 
                      ? Number(m.estoque_atual || 0) > 0 
                      : Number(m.estoque_satelite || 0) > 0
                  )}
                  value={transferenciaForm.medicamento_id}
                  onChange={(val) => {
                    handleTransferenciaChange("medicamento_id", val);
                  }}
              />
            </div>
            
            <div className="space-y-2">
              <Label>{transferenciaForm.direcao === "para_satelite" ? "Lote de Origem" : "Lote de Destino"}</Label>
              <Select
                value={transferenciaForm.lote_id}
                onValueChange={(val) => handleTransferenciaChange("lote_id", val)}
                disabled={!transferenciaForm.medicamento_id || activeMedLotes.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o lote" />
                </SelectTrigger>
                <SelectContent>
                  {activeMedLotes.map((l, index) => (
                    <SelectItem key={l.id} value={l.id} className={index === 0 ? "font-bold text-amber-700 bg-amber-50" : ""}>
                      {index === 0 ? "⭐ " : ""}{l.numero_lote} (Estoque atual: {l.quantidade_atual}) - Val: {safeFormatDate(l.data_validade)} {index === 0 ? "(Vence Primeiro)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Quantidade a Transferir</Label>
              <Input 
                type="number" 
                min="1" 
                max={transferenciaForm.direcao === "para_satelite" ? selectedTransferLote?.quantidade_atual : selectedMed?.estoque_satelite}
                value={transferenciaForm.quantidade}
                onChange={(e) => handleTransferenciaChange("quantidade", e.target.value)}
                placeholder="Ex: 10"
              />
              {transferenciaForm.medicamento_id && (
                <p className="text-xs text-slate-500 mt-1">
                  Disponível: {transferenciaForm.direcao === "para_satelite" ? selectedTransferLote?.quantidade_atual || 0 : selectedMed?.estoque_satelite || 0}
                </p>
              )}
            </div>

            <Button 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white mt-4" 
              onClick={() => realizarTransferencia.mutate()}
              disabled={realizarTransferencia.isPending || !transferenciaForm.medicamento_id || !transferenciaForm.lote_id || !transferenciaForm.quantidade}
            >
              Confirmar Transferência
            </Button>
          </div>
        </Card>

        <Card className="max-w-4xl mx-auto p-6 space-y-4 shadow-sm border-0 mt-6">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Histórico de Transferências</h2>
            <p className="text-sm text-slate-500">Últimas transferências realizadas entre estoques</p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Medicamento</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead className="text-center">Quantidade</TableHead>
                  <TableHead>Destino</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historicoTransferencias.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-slate-500">
                      Nenhuma transferência registrada
                    </TableCell>
                  </TableRow>
                ) : (
                  historicoTransferencias.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="text-sm">{safeFormatDate(t.data_saida)}</TableCell>
                      <TableCell className="font-medium text-slate-800">{t.medicamento_nome}</TableCell>
                      <TableCell><Badge variant="outline">{t.numero_lote}</Badge></TableCell>
                      <TableCell className="text-center font-bold text-blue-700">{t.quantidade}</TableCell>
                      <TableCell>
                        <Badge className={t.destino === "Farmácia Satélite" ? "bg-indigo-100 text-indigo-700" : "bg-emerald-100 text-emerald-700"}>
                          {t.destino}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </TabsContent>


      </Tabs>

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
          .no-print, nav, header, footer, button, [data-state="closed"], [data-state="open"], aside { display: none !important; }
          .print-only { display: block !important; }
          .p-6 { padding: 0 !important; }
          
          .border-b-2.border-indigo-600 {
            border-bottom-color: #4f46e5 !important;
            border-bottom-width: 2px !important;
          }
          
          .text-indigo-600 { color: #4f46e5 !important; }
          .text-indigo-700 { color: #4338ca !important; }
          
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border: 1px solid #e2e8f0 !important; }
          .bg-slate-100 { background-color: #f1f5f9 !important; }
        }
      `}</style>
    </div>
  );
}
