import { normalizeSearch } from "@/utils/searchUtils";
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { db } from "@/api/db";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { 
  Search, 
  User, 
  Bell, 
  PackageCheck, 
  Download, 
  Printer, 
  Trash2, 
  Pencil, 
  CalendarDays, 
  ShieldCheck, 
  ShieldAlert,
  Building2 
} from "lucide-react";
import RelatorioConsolidadoEstoque from "@/components/estoque/RelatorioConsolidadoEstoque";
import { Skeleton } from "@/components/ui/skeleton";
import { differenceInDays, parseISO, isValid, format } from "date-fns";
import { safeFormatDate, safeParseISO } from "@/utils/dateUtils";
import { isMav, isPsicotropico } from "@/utils/mavUtils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Label } from "@/components/ui/label";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";



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
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const tabParam = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState(tabParam || "padronizados");

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const { data: pedidosSatelite = [] } = useQuery({
    queryKey: ['pedidos_satelite'],
    queryFn: async () => {
      const all = await db.entities.PedidoSatelite.list('-created_at');
      return all || [];
    },
    refetchInterval: 4000
  });

  const pendingPedidosCount = pedidosSatelite.filter(p => p.status === "Pendente" || p.status === "Em Separação").length;

  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [displayCount, setDisplayCount] = useState(50);

  useEffect(() => {
    setDisplayCount(50);
  }, [search, filterStatus]);

  const [deleteLoteId, setDeleteLoteId] = useState(null);

  // Estado para modal de troca de validade
  const [trocaValidade, setTrocaValidade] = useState(null); // { loteId, numeroLote, dataAtual }
  const [novaValidade, setNovaValidade] = useState("");
  const [novoNumeroLote, setNovoNumeroLote] = useState("");

  const { data: medicamentos = [] } = useQuery({
    queryKey: ['medicamentos'],
    queryFn: () => db.entities.Medicamento.list(),
  });

  const { data: lotes = [] } = useQuery({
    queryKey: ['lotes'],
    queryFn: () => db.entities.Lote.list(),
  });

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
    const q = normalizeSearch(search);
    const terms = q ? q.split(/\s+/).filter(Boolean) : [];
    const fullText = normalizeSearch(`${med.nome || ""} ${med.principio_ativo || ""} ${med.codigo || ""}`);
    const matchSearch = terms.length === 0 || terms.every(t => fullText.includes(t));

    if (filterStatus === "all") return matchSearch;
    if (filterStatus === "baixo") return matchSearch && med.temAlerta;
    if (filterStatus === "vencido") return matchSearch && med.temVencido;
    if (filterStatus === "proximo_vencer") return matchSearch && med.temProximoVencer;
    return matchSearch;
  }).sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));

  const handleExportCSV = () => {
    try {
      const headers = ["Medicamento", "Concentração", "Lote", "Validade", "Quantidade", "Status"];
      const rows = [];

      filteredEstoque.forEach(med => {
        if (med.lotes.length === 0) {
          rows.push([
            med.nome,
            med.concentracao || med.unidade_medida || "-",
            "Sem Lote",
            "-",
            med.estoque_atual || 0,
            med.temAlerta ? "Estoque Baixo" : "OK"
          ]);
        } else {
          med.lotes.forEach(lote => {
            rows.push([
              med.nome,
              med.concentracao || med.unidade_medida || "-",
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
      const loteParaExcluir = lotes.find(l => l.id === deleteLoteId);
      await db.entities.Lote.delete(deleteLoteId);
      await db.logAction(
        "EXCLUSAO_LOTE",
        "Lote",
        deleteLoteId,
        `Exclusão manual do lote: ${loteParaExcluir?.numero_lote || deleteLoteId} (Med ID: ${loteParaExcluir?.medicamento_id || '-'}, Qtd: ${loteParaExcluir?.quantidade_atual ?? '-'})`
      );
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

  const handleTogglePadronizacao = async (med) => {
    try {
      toast.loading("Atualizando status...");
      await db.entities.Medicamento.update(med.id, {
        padronizado: !med.padronizado
      });
      await db.logAction(
        "ALTERACAO_PADRONIZACAO",
        "Medicamento",
        med.id,
        `${med.padronizado ? 'Removido da padronização' : 'Definido como padronizado'}: ${med.nome}`
      );
      queryClient.invalidateQueries();
      toast.dismiss();
      toast.success(med.padronizado ? "Removido da padronização." : "Medicamento padronizado com sucesso!");
    } catch (error) {
      toast.dismiss();
      toast.error(`Erro: ${error}`);
    }
  };

  const handleAbrirTrocaValidade = (lote) => {
    setTrocaValidade({ loteId: lote.id, numeroLote: lote.numero_lote, dataAtual: lote.data_validade, medId: lote.medicamento_id });
    const d = safeParseISO(lote.data_validade);
    setNovaValidade(d ? format(d, "yyyy-MM-dd") : "");
    setNovoNumeroLote(lote.numero_lote || "");
  };

  const handleTrocarValidade = async () => {
    if (!trocaValidade || !novaValidade || !novoNumeroLote) return;
    try {
      toast.loading("Atualizando lote...");
      await db.entities.Lote.update(trocaValidade.loteId, {
        data_validade: novaValidade,
        numero_lote: novoNumeroLote
      });
      await db.logAction(
        "ALTERACAO_LOTE_VALIDADE",
        "Lote",
        trocaValidade.loteId,
        `Lote alterado de '${trocaValidade.numeroLote}' (Validade: ${trocaValidade.dataAtual || '-'}) para '${novoNumeroLote}' (Validade: ${novaValidade})`
      );
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
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
            <Input
              placeholder="Buscar medicamento..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 text-base"
            />
          </div>
          <div className="w-full sm:w-56">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-10 bg-white">
                <SelectValue placeholder="Status do estoque" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="baixo">Estoque baixo</SelectItem>
                <SelectItem value="proximo_vencer">Próximo a vencer</SelectItem>
                <SelectItem value="vencido">Vencidos</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
 
      {/* Modal de Confirmação para Excluir Lote */}
      <ConfirmDialog
        open={!!deleteLoteId}
        onOpenChange={(open) => !open && setDeleteLoteId(null)}
        title="Excluir Lote"
        description="Tem certeza que deseja excluir este lote do sistema? Esta ação removerá o lote do estoque permanentemente."
        onConfirm={handleDeleteLote}
        confirmLabel="Excluir Lote"
        destructive={true}
      />

      {/* Banner de notificação para a Central de solicitações pendentes da Satélite */}
      {pendingPedidosCount > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-amber-500/15 via-orange-500/20 to-amber-500/15 border-2 border-amber-500/50 text-amber-950 dark:text-amber-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500 text-white rounded-xl shadow-md shrink-0">
              <Bell className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <h4 className="font-extrabold text-base flex items-center gap-2">
                🔔 NOTIFICAÇÃO DA CENTRAL: {pendingPedidosCount} Pedido(s) da Farmácia Satélite Aguardando Separação!
              </h4>
              <p className="text-xs text-amber-800 dark:text-amber-300 font-medium mt-0.5">
                Existem solicitações de medicamentos enviadas pela Satélite prontas para serem separadas e atendidas.
              </p>
            </div>
          </div>
          <Button
            onClick={() => navigate("/Movimentacoes?tab=pedidos_satelite")}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-2 shadow-lg shrink-0"
          >
            <PackageCheck className="w-4 h-4" />
            Ir para Movimentações / Separação
          </Button>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="padronizados" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Padronizados</TabsTrigger>
          <TabsTrigger value="nao_padronizados" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Não Padronizados</TabsTrigger>
          <TabsTrigger value="satelite" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Estoque Satélite</TabsTrigger>
          <TabsTrigger value="carrinho_parada" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Estoque Carrinho de Parada</TabsTrigger>
          <TabsTrigger value="consolidado" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-blue-600 data-[state=active]:text-white data-[state=active]:shadow-sm font-bold gap-1.5">
            <Building2 className="w-3.5 h-3.5" />
            Central vs Satélite (Consolidado)
          </TabsTrigger>
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
                              {isPsicotropico(med.grupo_terapeutico) && <User className="inline-block w-4 h-4 ml-1 text-indigo-600" title="Requer nome do paciente" />}
                            </p>
                            <div className="flex gap-2 items-center text-xs mt-1">
                              <span className="text-slate-500 font-medium">
                                {med.concentracao ? `Concentração: ${med.concentracao}` : "Concentração não definida"}
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
                              {(med.estoque_atual || 0).toLocaleString('pt-BR')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 pb-2">
                      <div className="flex justify-between items-center mb-4 px-1">
                        <h4 className="font-semibold text-slate-700">Lotes Registrados</h4>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={(e) => { e.stopPropagation(); handleTogglePadronizacao(med); }}
                          className="text-amber-700 hover:text-amber-800 hover:bg-amber-50 border-amber-200"
                        >
                          <ShieldAlert className="w-4 h-4 mr-2" />
                          Remover Padronização
                        </Button>
                      </div>
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
                                  {(lote.quantidade_atual || 0).toLocaleString('pt-BR')}
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
                              {isPsicotropico(med.grupo_terapeutico) && <User className="inline-block w-4 h-4 ml-2 text-indigo-600" title="Requer nome do paciente" />}
                            </p>
                            <div className="flex gap-2 items-center text-xs mt-1">
                              <span className="text-slate-500 font-medium">
                                {med.concentracao ? `Concentração: ${med.concentracao}` : "Concentração não definida"}
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
                              {(med.estoque_atual || 0).toLocaleString('pt-BR')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 pb-2">
                      <div className="flex justify-between items-center mb-4 px-1">
                        <h4 className="font-semibold text-slate-700">Lotes Registrados</h4>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={(e) => { e.stopPropagation(); handleTogglePadronizacao(med); }}
                          className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-200"
                        >
                          <ShieldCheck className="w-4 h-4 mr-2" />
                          Tornar Padronizado
                        </Button>
                      </div>
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
                                  {(lote.quantidade_atual || 0).toLocaleString('pt-BR')}
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
                        {isPsicotropico(med.grupo_terapeutico) && <User className="inline-block w-4 h-4 ml-2 text-indigo-600" title="Requer nome do paciente" />}
                        <div className="flex gap-2 items-center text-xs mt-1">
                          <span className="text-slate-500 font-medium">
                            {med.concentracao ? `Concentração: ${med.concentracao}` : "Concentração não definida"}
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

      <TabsContent value="consolidado" className="space-y-6">
        <RelatorioConsolidadoEstoque medicamentos={medicamentos} lotes={lotes} />
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
