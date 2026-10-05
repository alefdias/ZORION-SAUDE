import { useState, useMemo } from "react";
import { db } from "@/api/db";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { 
  AlertTriangle, 
  Flame, 
  Plus, 
  Trash2, 
  Send, 
  PackageCheck, 
  Clock, 
  Layers, 
  Truck, 
  CheckCircle2, 
  Eye, 
  Search,
  ShieldAlert,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { OrderDetailsModal } from "./PedidosSateliteManager";

const MOTIVOS_URGENCIA = [
  "Agitação Psicomotora Grave / Risco Iminente de Auto ou Heteroagressão",
  "Contenção Farmacológica de Urgência / Surto Psicótico Agudo",
  "Admissão Emergencial Psiquiátrica (Prescrição em Aberto no Posto)",
  "Sintomas Extrapiramidais Graves / Distonia Aguda / Impregnação",
  "Intercorrência Clínica Aguda / Parada Cardiorrespiratória",
  "Reposição Crítica Imediata por Falta Súbita no Posto",
  "Outra Justificativa de Urgência Psiquiátrica / Clínica"
];

export default function PedidosSateliteUrgencia() {
  const queryClient = useQueryClient();

  // Current logged user
  const storedUser = JSON.parse(localStorage.getItem("pharma_user") || "null");
  const currentUser = storedUser || { full_name: "Farmacêutico Satélite", crf: "CRF-SP 45.291" };

  // Queries
  const { data: medicamentos = [], isLoading: isLoadingMeds } = useQuery({
    queryKey: ['medicamentos'],
    queryFn: () => db.entities.Medicamento.list(),
  });

  const { data: alas = [] } = useQuery({
    queryKey: ['alas'],
    queryFn: () => db.entities.Ala.list(),
  });

  const { data: pedidos = [], isLoading: isLoadingPedidos } = useQuery({
    queryKey: ['pedidos_satelite'],
    queryFn: async () => {
      const all = await db.entities.PedidoSatelite.list('-created_at');
      return all || [];
    },
    refetchInterval: 2000 // Real-time sync every 2s
  });

  // Form State
  const [selectedAlaId, setSelectedAlaId] = useState("URGENCIA");
  const [motivoSelecionado, setMotivoSelecionado] = useState(MOTIVOS_URGENCIA[0]);
  const [detalheMotivo, setDetalheMotivo] = useState("");

  // Item Selector State
  const [selectedMedId, setSelectedMedId] = useState("");
  const [qtdItem, setQtdItem] = useState(1);
  const [buscaMed, setBuscaMed] = useState("");

  // Order Items List
  const [itensPedido, setItensPedido] = useState([]);

  // Modal State for viewing/receiving orders
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filtroHistoricoUrgencia, setFiltroHistoricoUrgencia] = useState("urgentes"); // 'urgentes' | 'todos'

  // Filtered meds for selector
  const filteredMeds = useMemo(() => {
    if (!buscaMed.trim()) return medicamentos;
    const term = buscaMed.toLowerCase();
    return medicamentos.filter(m => 
      m.nome?.toLowerCase().includes(term) ||
      m.principio_ativo?.toLowerCase().includes(term) ||
      m.codigo?.toLowerCase().includes(term)
    );
  }, [medicamentos, buscaMed]);

  const selectedMedObj = useMemo(() => {
    return medicamentos.find(m => m.id === selectedMedId);
  }, [medicamentos, selectedMedId]);

  // Add Item to List
  const handleAddItem = () => {
    if (!selectedMedObj) {
      toast.error("Selecione um medicamento para adicionar.");
      return;
    }

    const qtd = parseInt(qtdItem, 10);
    if (isNaN(qtd) || qtd <= 0) {
      toast.error("Informe uma quantidade válida maior que zero.");
      return;
    }

    // Check if item already in list
    const existingIndex = itensPedido.findIndex(i => i.medicamento_id === selectedMedObj.id);
    if (existingIndex >= 0) {
      const next = [...itensPedido];
      next[existingIndex].qtd_solicitada += qtd;
      next[existingIndex].qtd_atendida += qtd;
      setItensPedido(next);
      toast.info(`Quantidade de ${selectedMedObj.nome} atualizada (+${qtd}).`);
    } else {
      const newItem = {
        medicamento_id: selectedMedObj.id,
        medicamento_nome: selectedMedObj.nome,
        codigo: selectedMedObj.codigo || "-",
        concentracao: selectedMedObj.concentracao || "",
        apresentacao: selectedMedObj.apresentacao || "",
        qtd_prescrita: 0,
        margem_percentual: 0,
        qtd_margem_extra: 0,
        descontou_estoque: 0,
        estoque_satelite_momento: selectedMedObj.estoque_satelite || 0,
        estoque_central_momento: selectedMedObj.estoque_atual || 0,
        qtd_solicitada: qtd,
        qtd_atendida: qtd,
        separado: false,
        conferido: false
      };
      setItensPedido([...itensPedido, newItem]);
      toast.success(`${selectedMedObj.nome} adicionado ao pedido de urgência.`);
    }

    // Reset selector
    setSelectedMedId("");
    setQtdItem(1);
    setBuscaMed("");
  };

  const handleRemoveItem = (index) => {
    const next = itensPedido.filter((_, idx) => idx !== index);
    setItensPedido(next);
  };

  const handleUpdateItemQtd = (index, val) => {
    const num = parseInt(val, 10);
    const valid = isNaN(num) || num < 0 ? 0 : num;
    const next = [...itensPedido];
    next[index].qtd_solicitada = valid;
    next[index].qtd_atendida = valid;
    setItensPedido(next);
  };

  // Mutation to Create Urgent Order
  const createPedidoUrgenciaMutation = useMutation({
    mutationFn: async () => {
      const validItens = itensPedido.filter(i => i.qtd_solicitada > 0);
      if (validItens.length === 0) {
        throw new Error("Adicione ao menos um medicamento com quantidade maior que zero.");
      }

      let alaNomeStr = "Urgência / Emergência Geral Satélite";
      if (selectedAlaId !== "URGENCIA") {
        const foundAla = alas.find(a => a.id === selectedAlaId);
        if (foundAla) alaNomeStr = foundAla.nome;
      }

      const motivoFinal = detalheMotivo.trim() 
        ? `${motivoSelecionado} (${detalheMotivo.trim()})`
        : motivoSelecionado;

      const timestampCode = Date.now().toString().slice(-6);
      const pedidoId = crypto.randomUUID();

      const novoPedido = {
        id: pedidoId,
        codigo: `PED-URG-${timestampCode}`,
        ala_id: selectedAlaId,
        ala_nome: alaNomeStr,
        dias_calculados: 0,
        margem_seguranca: 0,
        descontar_estoque: 0,
        solicitante: `Farmácia Satélite (${currentUser.full_name})`,
        data_solicitacao: new Date().toISOString(),
        status: "Pendente",
        prioridade: "Emergência",
        itens_json: JSON.stringify(validItens),
        observacao: `[PEDIDO MANUAL DE URGÊNCIA - SEM PRESCRIÇÃO] Motivo: ${motivoFinal}`,
        created_at: new Date().toISOString()
      };

      await db.entities.PedidoSatelite.create(novoPedido);
      await db.logAction("Pedido Urgente Satélite", "PedidoSatelite", novoPedido.id, {
        codigo: novoPedido.codigo,
        ala: novoPedido.ala_nome,
        motivo: motivoFinal,
        prioridade: "Emergência",
        itens: validItens.length
      });

      return novoPedido;
    },
    onSuccess: (data) => {
      toast.success(`🚨 Pedido de Urgência ${data.codigo} transmitido para a Central com sucesso!`);
      setItensPedido([]);
      setDetalheMotivo("");
      queryClient.invalidateQueries({ queryKey: ['pedidos_satelite'] });
    },
    onError: (err) => {
      const msg = typeof err === "string" ? err : (err?.message || JSON.stringify(err));
      toast.error(`Erro ao criar pedido de urgência: ${msg}`);
    }
  });

  // Mutation to receive/complete order
  const updatePedidoMutation = useMutation({
    mutationFn: async ({ pedido, newStatus, updatedItens, motivoCancelamento }) => {
      const payload = {
        status: newStatus,
        itens_json: JSON.stringify(updatedItens)
      };

      if (newStatus === "Cancelado") {
        payload.motivo_cancelamento = motivoCancelamento || "Cancelado pelo operador";
        payload.data_cancelamento = new Date().toISOString();
        payload.observacao = pedido.observacao 
          ? `[CANCELADO: ${motivoCancelamento || "Sem motivo"}] ${pedido.observacao}`
          : `[CANCELADO: ${motivoCancelamento || "Sem motivo"}]`;
        
        try {
          await db.logAction(
            "Cancelamento Pedido Urgência",
            "PedidoSatelite",
            pedido.id,
            `Pedido ${pedido.codigo} (${pedido.ala_nome}) cancelado. Motivo: ${motivoCancelamento || "Sem motivo informado"}`
          );
        } catch (e) {}
      } else if (newStatus === "Concluido") {
        payload.data_recebimento = new Date().toISOString();

        const freshMeds = await db.entities.Medicamento.list();

        // Dá entrada automática no estoque satélite com a quantidade recebida
        for (const item of updatedItens) {
          const qtdRealRecebida = Number(item.qtd_recebida !== undefined ? item.qtd_recebida : item.qtd_atendida) || 0;
          const qtdEnviada = Number(item.qtd_atendida) || 0;

          if (qtdRealRecebida > 0) {
            const med = freshMeds.find(m => m.id === item.medicamento_id);
            if (med) {
              const currentSat = Number(med.estoque_satelite || 0);
              await db.entities.Medicamento.update(med.id, {
                estoque_satelite: currentSat + qtdRealRecebida
              });
            }
          }

          // Se houve divergência, estorna sobra para o estoque central
          if (qtdRealRecebida < qtdEnviada) {
            const dif = qtdEnviada - qtdRealRecebida;
            const med = freshMeds.find(m => m.id === item.medicamento_id);
            if (med) {
              await db.entities.Medicamento.update(med.id, {
                estoque_atual: (Number(med.estoque_atual) || 0) + dif
              });
            }
          }
        }

        // Atualiza transferências pendentes vinculadas a este pedido para Aceito
        try {
          const allTransfers = await db.entities.TransferenciaPendente.list();
          const pedidoTransfers = (allTransfers || []).filter(
            t => (t.pedido_id === pedido.id || t.pedido_codigo === pedido.codigo) && t.status === "Pendente"
          );
          for (const tr of pedidoTransfers) {
            await db.entities.TransferenciaPendente.update(tr.id, {
              status: "Aceito",
              data_aceite: format(new Date(), "yyyy-MM-dd'T'HH:mm:ssXXX")
            });
          }
        } catch (e) {
          console.warn("Erro ao atualizar status de TransferenciaPendente em PedidosSateliteUrgencia:", e);
        }
      }

      await db.entities.PedidoSatelite.update(pedido.id, payload);
    },
    onSuccess: (_, variables) => {
      if (variables.newStatus === "Concluido") {
        toast.success("Recebimento confirmado! O estoque da Farmácia Satélite foi atualizado com sucesso!");
      }
      queryClient.invalidateQueries({ queryKey: ['pedidos_satelite'] });
      queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      queryClient.invalidateQueries({ queryKey: ['transferencias'] });
      queryClient.invalidateQueries({ queryKey: ['saidas'] });
      queryClient.invalidateQueries({ queryKey: ['entradas'] });
      setModalOpen(false);
      setSelectedPedido(null);
    },
    onError: (err) => {
      toast.error("Erro ao atualizar pedido: " + (err.message || err));
    }
  });

  // Filter urgent orders for the history table
  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter(p => {
      if (filtroHistoricoUrgencia === "urgentes") {
        return p.prioridade === "Emergência" || p.prioridade === "Urgente" || p.codigo?.includes("URG");
      }
      return true;
    });
  }, [pedidos, filtroHistoricoUrgencia]);

  const totalUnidades = useMemo(() => {
    return itensPedido.reduce((acc, item) => acc + (Number(item.qtd_solicitada) || 0), 0);
  }, [itensPedido]);

  const getStatusBadge = (status) => {
    switch (status) {
      case "Pendente":
        return <Badge className="bg-amber-100 text-amber-800 border-amber-300 flex items-center gap-1"><Clock className="w-3 h-3" /> Solicitado (Pendente)</Badge>;
      case "Em Separação":
        return <Badge className="bg-blue-100 text-blue-800 border-blue-300 flex items-center gap-1"><Layers className="w-3 h-3" /> Em Separação</Badge>;
      case "Separado":
        return <Badge className="bg-purple-100 text-purple-800 border-purple-300 flex items-center gap-1"><PackageCheck className="w-3 h-3" /> Separado (Pronto)</Badge>;
      case "Entregue":
        return <Badge className="bg-orange-100 text-orange-800 border-orange-300 flex items-center gap-1"><Truck className="w-3 h-3" /> Entregue (Aguardando Conferência)</Badge>;
      case "Concluido":
        return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Concluído & Recebido</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ─── BANNER DE ADVERTÊNCIA OBRIGATÓRIO (USO EXCLUSIVO URGÊNCIA) ───────── */}
      <div className="bg-rose-50/80 border-2 border-rose-400 dark:bg-rose-950/20 dark:border-rose-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-rose-600 text-white shrink-0 mt-0.5 shadow-sm">
            <Flame className="w-6 h-6 animate-pulse" />
          </div>
          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-black uppercase tracking-wide text-rose-950 dark:text-rose-200 flex items-center gap-2">
                Atenção: Uso Restrito a Situações de Emergência e Urgência
              </h2>
              <Badge className="bg-rose-600 hover:bg-rose-700 text-white font-black text-[11px] uppercase tracking-wider">
                Fluxo de Exceção Manual
              </Badge>
            </div>
            
            <div className="text-xs text-rose-900 dark:text-rose-300 space-y-1 leading-relaxed">
              <p className="font-bold">
                ⚠️ O fluxo padrão, seguro e obrigatório da Farmácia Satélite é utilizar a aba <span className="underline font-black">"Pedidos à Central"</span>, que apura as quantidades necessárias com base nas prescrições médicas ativas dos pacientes.
              </p>
              <p>
                Esta aba manual destina-se <strong>estritamente a situações emergenciais e imprevistas</strong> (ex.: agitação psicomotora grave, surto psicótico com risco de auto ou heteroagressão, contenção farmacológica imediata, distonia aguda / impregnação neuroléptica, intercorrência clínica aguda ou admissão psiquiátrica de emergência cujo paciente ainda não teve a prescrição lançada no sistema).
              </p>
              <p className="text-[11px] text-rose-800 dark:text-rose-400 italic">
                Todos os pedidos emitidos nesta aba são transmitidos com <strong>PRIORIDADE MÁXIMA (EMERGÊNCIA)</strong> para a Farmácia Central e ficam auditados no histórico do sistema.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── FORMULÁRIO DE PEDIDO MANUAL DE URGÊNCIA ───────────────────────── */}
      <Card className="p-6 border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              Emitir Pedido Manual de Urgência à Central
            </h3>
            <p className="text-xs text-slate-500">
              Monte a lista de medicamentos necessários para o atendimento de urgência sem vínculo de prescrição.
            </p>
          </div>
          <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-bold px-3 py-1 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-rose-600" />
            Prioridade: Urgente / Emergência
          </Badge>
        </div>

        {/* Setor e Motivo da Urgência */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
          <div>
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
              Ala / Setor de Destino da Urgência:
            </Label>
            <Select value={selectedAlaId} onValueChange={setSelectedAlaId}>
              <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 font-semibold text-xs h-9">
                <SelectValue placeholder="Selecione a ala de destino..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="URGENCIA" className="font-bold text-rose-700">
                  🚨 Pronto Atendimento / Urgência Geral Satélite
                </SelectItem>
                {alas.map(ala => (
                  <SelectItem key={ala.id} value={ala.id}>
                    {ala.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 block">
              Justificativa / Motivo da Urgência (Obrigatório):
            </Label>
            <Select value={motivoSelecionado} onValueChange={setMotivoSelecionado}>
              <SelectTrigger className="bg-white dark:bg-slate-800 border-slate-300 font-semibold text-xs h-9">
                <SelectValue placeholder="Selecione o motivo..." />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS_URGENCIA.map((mot, idx) => (
                  <SelectItem key={idx} value={mot}>
                    {mot}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5 block">
              Detalhamento / Observação Adicional da Urgência (Opcional):
            </Label>
            <Input
              placeholder="Ex: Paciente no Leito 08 em agitação psicomotora grave e risco de autoagressão, medicação para contenção imediata."
              value={detalheMotivo}
              onChange={(e) => setDetalheMotivo(e.target.value)}
              className="bg-white dark:bg-slate-800 text-xs h-9"
            />
          </div>
        </div>

        {/* Adicionar Medicamento à Lista */}
        <div className="bg-indigo-50/40 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30 space-y-3">
          <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-indigo-600" />
            Adicionar Medicamento ao Pedido de Urgência:
          </span>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-4">
              <Label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Filtrar Medicamento por Nome ou Princípio Ativo:
              </Label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Digite para buscar..."
                  value={buscaMed}
                  onChange={(e) => setBuscaMed(e.target.value)}
                  className="pl-8 bg-white h-9 text-xs"
                />
              </div>
            </div>

            <div className="md:col-span-5">
              <Label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Selecione o Medicamento ({filteredMeds.length} disponíveis):
              </Label>
              <Select value={selectedMedId} onValueChange={setSelectedMedId}>
                <SelectTrigger className="bg-white border-slate-300 text-xs h-9 font-medium">
                  <SelectValue placeholder="Escolha o medicamento..." />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {filteredMeds.map(med => (
                    <SelectItem key={med.id} value={med.id}>
                      {med.nome} {med.concentracao ? `- ${med.concentracao}` : ""} {med.apresentacao ? `(${med.apresentacao})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-1">
              <Label className="text-[11px] font-semibold text-slate-600 mb-1 block">
                Quantidade:
              </Label>
              <Input
                type="number"
                min="1"
                value={qtdItem}
                onChange={(e) => setQtdItem(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="bg-white text-center font-bold h-9 text-xs"
              />
            </div>

            <div className="md:col-span-2">
              <Button
                type="button"
                onClick={handleAddItem}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-9 text-xs gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar Item
              </Button>
            </div>
          </div>

          {/* Dica de Estoque do Medicamento Selecionado */}
          {selectedMedObj && (
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold bg-white p-2.5 rounded-lg border border-slate-200">
              <span className="text-slate-600">
                Item Selecionado: <strong className="text-slate-900">{selectedMedObj.nome} {selectedMedObj.concentracao}</strong>
              </span>
              <span className="text-indigo-700">
                Estoque Satélite: <strong>{selectedMedObj.estoque_satelite || 0} {selectedMedObj.unidade_medida || "UN"}</strong>
              </span>
              <span className={Number(selectedMedObj.estoque_atual || 0) > 0 ? "text-emerald-700" : "text-red-600 font-bold"}>
                Estoque Central: <strong>{selectedMedObj.estoque_atual || 0} {selectedMedObj.unidade_medida || "UN"}</strong>
                {Number(selectedMedObj.estoque_atual || 0) <= 0 && " (Atenção: Zerado na Central!)"}
              </span>
            </div>
          )}
        </div>

        {/* Grade de Itens Adicionados ao Pedido */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Itens a Solicitar no Pedido de Urgência ({itensPedido.length} itens, {totalUnidades} unidades):
            </h4>
            {itensPedido.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setItensPedido([])}
                className="text-xs text-red-600 hover:bg-red-50 h-7"
              >
                Limpar Todos os Itens
              </Button>
            )}
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800 text-slate-700">
                  <TableHead className="text-xs font-bold w-16">Cód</TableHead>
                  <TableHead className="text-xs font-bold">Medicamento / Apresentação</TableHead>
                  <TableHead className="text-xs font-bold text-center w-28">Estoque Central</TableHead>
                  <TableHead className="text-xs font-bold text-center w-28">Estoque Satélite</TableHead>
                  <TableHead className="text-xs font-bold text-center w-36">Qtd. Solicitada (Urgente)</TableHead>
                  <TableHead className="text-xs font-bold text-right w-16">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itensPedido.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-slate-400 italic text-xs">
                      Nenhum medicamento adicionado ao pedido de urgência ainda. Utilize o seletor acima para adicionar itens.
                    </TableCell>
                  </TableRow>
                ) : (
                  itensPedido.map((item, idx) => (
                    <TableRow key={idx} className="hover:bg-slate-50/70">
                      <TableCell className="font-mono text-xs text-slate-500">{item.codigo}</TableCell>
                      <TableCell>
                        <div className="font-bold text-slate-900 text-xs">{item.medicamento_nome}</div>
                        <div className="text-[11px] text-slate-500">{item.concentracao} {item.apresentacao}</div>
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs font-semibold">
                        <span className={item.estoque_central_momento > 0 ? "text-slate-700" : "text-red-600 font-bold"}>
                          {item.estoque_central_momento} un
                        </span>
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs text-indigo-700 font-semibold">
                        {item.estoque_satelite_momento} un
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min="1"
                          value={item.qtd_solicitada}
                          onChange={(e) => handleUpdateItemQtd(idx, e.target.value)}
                          className="w-20 text-center font-black font-mono mx-auto h-8 text-xs border-rose-300 focus:ring-rose-500 text-rose-900 bg-rose-50/30"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(idx)}
                          className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Rodapé de Ação / Transmissão */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="text-xs text-slate-500">
            Responsável pela Solicitação: <strong className="text-slate-800">{currentUser.full_name}</strong> ({currentUser.crf || "Farmácia Satélite"})
          </div>

          <Button
            type="button"
            disabled={itensPedido.length === 0 || createPedidoUrgenciaMutation.isPending}
            onClick={() => createPedidoUrgenciaMutation.mutate()}
            className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white font-black px-6 py-2.5 text-xs shadow-md gap-2"
          >
            <Flame className="w-4 h-4" />
            {createPedidoUrgenciaMutation.isPending ? "Transmitindo Pedido..." : "🚨 Transmitir Pedido de Urgência à Central"}
          </Button>
        </div>
      </Card>

      {/* ─── HISTÓRICO E STATUS DOS PEDIDOS DE URGÊNCIA ───────────────────── */}
      <Card className="p-6 border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-indigo-600" />
              Acompanhamento & Recebimento de Pedidos de Urgência
            </h3>
            <p className="text-xs text-slate-500">
              Acompanhe a separação na Farmácia Central e confirme o recebimento para creditar o estoque da satélite.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={filtroHistoricoUrgencia === "urgentes" ? "default" : "outline"}
              size="sm"
              onClick={() => setFiltroHistoricoUrgencia("urgentes")}
              className={`h-7 text-xs font-bold ${
                filtroHistoricoUrgencia === "urgentes" ? "bg-rose-600 text-white" : ""
              }`}
            >
              🚨 Apenas Urgência
            </Button>
            <Button
              type="button"
              variant={filtroHistoricoUrgencia === "todos" ? "default" : "outline"}
              size="sm"
              onClick={() => setFiltroHistoricoUrgencia("todos")}
              className="h-7 text-xs font-medium"
            >
              Todos os Pedidos
            </Button>
          </div>
        </div>

        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:bg-slate-800 text-slate-700">
                <TableHead className="text-xs font-bold">Código</TableHead>
                <TableHead className="text-xs font-bold">Ala / Setor</TableHead>
                <TableHead className="text-xs font-bold">Data Solicitação</TableHead>
                <TableHead className="text-xs font-bold text-center">Itens</TableHead>
                <TableHead className="text-xs font-bold text-center">Status</TableHead>
                <TableHead className="text-xs font-bold text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingPedidos ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-6 text-slate-400 text-xs">
                    Carregando pedidos...
                  </TableCell>
                </TableRow>
              ) : pedidosFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-slate-400 text-xs italic">
                    Nenhum pedido de urgência registrado no histórico.
                  </TableCell>
                </TableRow>
              ) : (
                pedidosFiltrados.map(p => {
                  let itensArr = [];
                  try { itensArr = JSON.parse(p.itens_json || "[]"); } catch {}
                  const isUrgente = p.prioridade === "Emergência" || p.prioridade === "Urgente" || p.codigo?.includes("URG");

                  return (
                    <TableRow key={p.id} className="hover:bg-slate-50">
                      <TableCell className="font-mono font-bold text-xs">
                        <span className={isUrgente ? "text-rose-700" : "text-indigo-600"}>{p.codigo}</span>
                        {isUrgente && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-black uppercase bg-red-600 text-white animate-pulse">
                            URGÊNCIA
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold text-xs text-slate-800">{p.ala_nome}</TableCell>
                      <TableCell className="text-xs text-slate-600 font-mono">
                        {p.data_solicitacao ? format(new Date(p.data_solicitacao), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"}
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs font-bold">{itensArr.length} item(s)</TableCell>
                      <TableCell className="text-center">{getStatusBadge(p.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedPedido({
                              ...p,
                              itens: itensArr
                            });
                            setModalOpen(true);
                          }}
                          className={`gap-1.5 h-8 text-xs font-bold ${
                            p.status === "Separado" || p.status === "Entregue"
                              ? "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                              : "border-slate-200 text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {p.status === "Separado" || p.status === "Entregue" ? "Conferir & Receber" : "Ver Detalhes"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* ─── MODAL DETALHADO DE RECEBIMENTO & CONFERÊNCIA ──────────────────── */}
      {selectedPedido && (
        <OrderDetailsModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          pedido={selectedPedido}
          mode="satelite"
          onUpdateStatus={(newStatus, updatedItens, motivoCancelamento) => {
            updatePedidoMutation.mutate({
              pedido: selectedPedido,
              newStatus,
              updatedItens,
              motivoCancelamento
            });
          }}
          isPending={updatePedidoMutation.isPending}
        />
      )}
    </div>
  );
}
