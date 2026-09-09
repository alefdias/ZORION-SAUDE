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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { 
  ShoppingCart, 
  PackageCheck, 
  Send, 
  CheckCircle2, 
  Clock, 
  Truck,
  Eye,
  Search,
  Package,
  Layers,
  Percent,
  RotateCcw,
  Ban,
  AlertTriangle,
  XCircle,
  Printer
} from "lucide-react";

export function PedidosSateliteManager({ mode = "satelite" }) {
  // mode can be "satelite" or "central"
  const queryClient = useQueryClient();

  // State for order creation (satelite)
  const [selectedAlaId, setSelectedAlaId] = useState("all");
  const [diasCalculo, setDiasCalculo] = useState(1);
  const [customDias, setCustomDias] = useState("");
  const [margemPercentual, setMargemPercentual] = useState(0); // 0, 10, 20, 25, 30, "custom"
  const [customMargem, setCustomMargem] = useState("");
  const [descontarEstoque, setDescontarEstoque] = useState(false);
  const [customQuantities, setCustomQuantities] = useState({}); // medId -> custom quantity
  const [observacaoPedido, setObservacaoPedido] = useState("");
  const [prioridadePedido, setPrioridadePedido] = useState("Normal"); // "Normal" | "Urgente" | "Emergência"

  // State for order view modal
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [printOrderData, setPrintOrderData] = useState(null);

  // Queries
  const { data: pacientes = [] } = useQuery({
    queryKey: ['pacientes'],
    queryFn: () => db.entities.Paciente.list(),
  });

  const { data: prescricoes = [] } = useQuery({
    queryKey: ['prescricoes_paciente'],
    queryFn: () => db.entities.PrescricaoPaciente.list(),
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

  const { data: pedidos = [], isLoading: loadingPedidos } = useQuery({
    queryKey: ['pedidos_satelite'],
    queryFn: async () => {
      const list = await db.entities.PedidoSatelite.list('-created_at');
      return list || [];
    },
    refetchInterval: 2000 // Real-time sync every 2s alongside PostgreSQL LISTEN/NOTIFY
  });

  // Effective days count
  const effectiveDays = useMemo(() => {
    if (diasCalculo === "custom") {
      const parsed = parseInt(customDias, 10);
      return isNaN(parsed) || parsed < 1 ? 1 : parsed;
    }
    return Number(diasCalculo) || 1;
  }, [diasCalculo, customDias]);

  // Effective safety margin percentage
  const effectiveMargem = useMemo(() => {
    if (margemPercentual === "custom") {
      const parsed = parseFloat(customMargem);
      return isNaN(parsed) || parsed < 0 ? 0 : parsed;
    }
    return Number(margemPercentual) || 0;
  }, [margemPercentual, customMargem]);

  // Calculation of medication needs per selected Ala, Days, Safety Margin, and Stock Discount
  const calculoNecessidade = useMemo(() => {
    const ativas = prescricoes.filter(p => {
      if (p.status !== "Ativa") return false;
      const pac = pacientes.find(patient => patient.id === p.pacienteId);
      if (!pac || pac.status === "Alta") return false;
      if (selectedAlaId !== "all" && pac.alaId !== selectedAlaId && pac.alaNome !== alas.find(a => a.id === selectedAlaId)?.nome) {
        return false;
      }
      return true;
    });

    const medMap = {};

    ativas.forEach(p => {
      const med = medicamentos.find(m => m.id === p.medicamentoId) || {
        nome: p.medicamentoNome || "Medicamento",
        codigo: p.medicamentoCodigo || "-",
        apresentacao: p.apresentacao || "",
        concentracao: p.concentracao || "",
        estoque_satelite: 0
      };

      const dailyDose = p.totalDiario || 0;
      const calculatedTotal = dailyDose * effectiveDays;

      if (!medMap[p.medicamentoId]) {
        medMap[p.medicamentoId] = {
          medicamentoId: p.medicamentoId,
          nome: med.nome,
          codigo: med.codigo,
          apresentacao: med.apresentacao,
          concentracao: med.concentracao,
          estoqueSatelite: med.estoque_satelite || 0,
          qtdDiaria: 0,
          qtdCalculada: 0,
          totalPacientes: 0
        };
      }

      medMap[p.medicamentoId].qtdDiaria += dailyDose;
      medMap[p.medicamentoId].qtdCalculada += calculatedTotal;
      medMap[p.medicamentoId].totalPacientes += 1;
    });

    return Object.values(medMap).map(item => {
      // 1. Quantidade com margem de segurança (arredondado para cima)
      const qtdComMargem = effectiveMargem > 0
        ? Math.ceil(item.qtdCalculada * (1 + (effectiveMargem / 100)))
        : item.qtdCalculada;

      const qtdMargemExtra = qtdComMargem - item.qtdCalculada;

      // 2. Se a opção de abater o estoque satélite já existente estiver marcada
      const qtdSugerida = descontarEstoque
        ? Math.max(0, qtdComMargem - (item.estoqueSatelite || 0))
        : qtdComMargem;

      return {
        ...item,
        qtdComMargem,
        qtdMargemExtra,
        qtdSugerida
      };
    }).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [prescricoes, pacientes, medicamentos, selectedAlaId, alas, effectiveDays, effectiveMargem, descontarEstoque]);

  // Resumo macro do pedido calculado
  const resumoPedido = useMemo(() => {
    let totalPrescrito = 0;
    let totalMargemExtra = 0;
    let totalSolicitado = 0;

    calculoNecessidade.forEach(item => {
      const finalQtd = customQuantities[item.medicamentoId] !== undefined 
        ? parseInt(customQuantities[item.medicamentoId], 10) || 0 
        : item.qtdSugerida;

      totalPrescrito += item.qtdCalculada;
      totalMargemExtra += item.qtdMargemExtra;
      totalSolicitado += finalQtd;
    });

    return {
      totalItens: calculoNecessidade.length,
      totalPrescrito,
      totalMargemExtra,
      totalSolicitado
    };
  }, [calculoNecessidade, customQuantities]);

  // Create Order Mutation
  const criarPedidoMutation = useMutation({
    mutationFn: async () => {
      if (calculoNecessidade.length === 0) {
        throw new Error("Nenhuma medicação necessária encontrada para os filtros selecionados.");
      }

      const alaObj = alas.find(a => a.id === selectedAlaId);
      const alaNomeStr = selectedAlaId === "all" ? "Todas as Alas" : (alaObj?.nome || "Ala Selecionada");

      const itens = calculoNecessidade.map(item => {
        const finalQtd = customQuantities[item.medicamentoId] !== undefined 
          ? parseInt(customQuantities[item.medicamentoId], 10) || 0 
          : item.qtdSugerida;

        return {
          medicamento_id: item.medicamentoId,
          medicamento_nome: item.nome,
          codigo: item.codigo,
          concentracao: item.concentracao,
          apresentacao: item.apresentacao,
          qtd_prescrita: item.qtdCalculada,
          margem_percentual: effectiveMargem,
          qtd_margem_extra: item.qtdMargemExtra,
          descontou_estoque: descontarEstoque ? 1 : 0,
          estoque_satelite_momento: item.estoqueSatelite,
          qtd_solicitada: finalQtd,
          qtd_atendida: finalQtd, // Central can adjust during separation
          separado: false,
          conferido: false
        };
      }).filter(i => i.qtd_solicitada > 0);

      if (itens.length === 0) {
        throw new Error("O pedido não possui itens com quantidade maior que zero.");
      }

      const pedidoId = crypto.randomUUID();
      const timestampCode = Date.now().toString().slice(-6);

      let obsFinal = observacaoPedido || "";
      if (effectiveMargem > 0 || descontarEstoque) {
        const tagMargem = effectiveMargem > 0 ? `Margem: +${effectiveMargem}%` : '';
        const tagEstoque = descontarEstoque ? 'Estoque Satélite Abatido' : '';
        const tags = [tagMargem, tagEstoque].filter(Boolean).join(' | ');
        obsFinal = obsFinal ? `[${tags}] ${obsFinal}` : `[${tags}]`;
      }

      const novoPedido = {
        id: pedidoId,
        codigo: `PED-${timestampCode}`,
        ala_id: selectedAlaId,
        ala_nome: alaNomeStr,
        dias_calculados: effectiveDays,
        margem_seguranca: effectiveMargem,
        descontar_estoque: descontarEstoque ? 1 : 0,
        solicitante: "Farmácia Satélite",
        data_solicitacao: new Date().toISOString(),
        status: "Pendente",
        prioridade: prioridadePedido || "Normal",
        itens_json: JSON.stringify(itens),
        observacao: obsFinal,
        created_at: new Date().toISOString()
      };

      await db.entities.PedidoSatelite.create(novoPedido);
      await db.logAction("Pedido Satélite", "PedidoSatelite", novoPedido.id, {
        codigo: novoPedido.codigo,
        ala: novoPedido.ala_nome,
        prioridade: novoPedido.prioridade,
        margem: effectiveMargem,
        itens: itens.length
      });
      return novoPedido;
    },
    onSuccess: (data) => {
      toast.success(`Pedido ${data.codigo} enviado para a Farmácia Central com sucesso!`);
      setCustomQuantities({});
      setObservacaoPedido("");
      queryClient.invalidateQueries({ queryKey: ['pedidos_satelite'] });
    },
    onError: (err) => {
      const msg = typeof err === "string" ? err : (err?.message || JSON.stringify(err));
      toast.error(`Erro ao criar pedido: ${msg}`);
    }
  });

  const handleOpenPrintPreview = (pedidoCustom = null) => {
    if (pedidoCustom) {
      let itens = pedidoCustom.itens || [];
      if (typeof itens === "string") {
        try { itens = JSON.parse(itens); } catch {}
      }
      setPrintOrderData({
        codigo: pedidoCustom.codigo || "PED-CENTRAL",
        alaNome: pedidoCustom.ala_nome || "Geral",
        dataSolicitacao: pedidoCustom.data_solicitacao || new Date().toISOString(),
        dias: pedidoCustom.dias_calculados || effectiveDays,
        margem: pedidoCustom.margem_seguranca || 0,
        descontarEstoque: pedidoCustom.descontar_estoque === 1,
        prioridade: pedidoCustom.prioridade || "Normal",
        status: pedidoCustom.status || "Pendente",
        observacao: pedidoCustom.observacoes || pedidoCustom.observacao || "",
        itens: itens.map(i => ({
          codigo: i.codigo || "-",
          nome: i.medicamento_nome || i.nome,
          concentracao: i.concentracao || "",
          apresentacao: i.apresentacao || "",
          qtdPrescrita: i.qtd_prescrita || i.qtdCalculada || 0,
          estoqueSatelite: i.estoque_satelite_momento ?? i.estoqueSatelite ?? 0,
          qtdSolicitada: i.qtd_solicitada !== undefined ? i.qtd_solicitada : (i.finalQtd || 0)
        }))
      });
    } else {
      const alaObj = alas.find(a => a.id === selectedAlaId);
      const alaNomeStr = selectedAlaId === "all" ? "Todas as Alas" : (alaObj?.nome || "Ala Selecionada");

      const itens = calculoNecessidade.map(item => {
        const finalQtd = customQuantities[item.medicamentoId] !== undefined 
          ? parseInt(customQuantities[item.medicamentoId], 10) || 0 
          : item.qtdSugerida;

        return {
          codigo: item.codigo || "-",
          nome: item.nome,
          concentracao: item.concentracao || "",
          apresentacao: item.apresentacao || "",
          qtdPrescrita: item.qtdCalculada,
          estoqueSatelite: item.estoqueSatelite,
          qtdSolicitada: finalQtd
        };
      });

      setPrintOrderData({
        codigo: `PREVIA-${Date.now().toString().slice(-4)}`,
        alaNome: alaNomeStr,
        dataSolicitacao: new Date().toISOString(),
        dias: effectiveDays,
        margem: effectiveMargem,
        descontarEstoque: descontarEstoque,
        prioridade: prioridadePedido,
        status: "Em Elaboração (Sem envio)",
        observacao: observacaoPedido,
        itens: itens
      });
    }
  };

  // Modal Action Mutation (Separar, Entregar, Conferir/Receber)
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
            "Cancelamento Pedido",
            "PedidoSatelite",
            pedido.id,
            `Pedido ${pedido.codigo} (${pedido.ala_nome}) cancelado. Motivo: ${motivoCancelamento || "Sem motivo informado"}`
          );
        } catch (e) {}
      } else if (newStatus === "Separado") {
        payload.data_separacao = new Date().toISOString();
      } else if (newStatus === "Entregue") {
        payload.data_entrega = new Date().toISOString();
      } else if (newStatus === "Concluido") {
        payload.data_recebimento = new Date().toISOString();

        // 🟢 Dar entrada automática no estoque satélite usando a QUANTIDADE REAL RECEBIDA!
        for (const item of updatedItens) {
          const qtdRealRecebida = Number(item.qtd_recebida !== undefined ? item.qtd_recebida : item.qtd_atendida) || 0;
          if (qtdRealRecebida > 0) {
            const med = medicamentos.find(m => m.id === item.medicamento_id);
            if (med) {
              const currentSat = Number(med.estoque_satelite || 0);
              await db.entities.Medicamento.update(med.id, {
                estoque_satelite: currentSat + qtdRealRecebida
              });

              // Registra movimentação de entrada na Satélite com a quantidade real conferida
              const obsDivergencia = item.qtd_recebida !== undefined && item.qtd_recebida < item.qtd_atendida
                ? ` [Divergência: Recebido ${item.qtd_recebida} de ${item.qtd_atendida} enviados]`
                : '';

              await db.entities.Entrada.create({
                medicamento_id: med.id,
                medicamento_nome: med.nome,
                data_entrada: format(new Date(), "yyyy-MM-dd'T'HH:mm:ssXXX"),
                quantidade: qtdRealRecebida,
                fornecedor_nome: `Recebimento Pedido ${pedido.codigo} (${pedido.ala_nome})${obsDivergencia}`,
                numero_nota_fiscal: pedido.codigo,
                tipo: "Transferência Central -> Satélite"
              });
            }
          }
        }
      }

      await db.entities.PedidoSatelite.update(pedido.id, payload);
    },
    onSuccess: (_, variables) => {
      const { newStatus, pedido } = variables;
      if (newStatus === "Cancelado") {
        toast.error(`Pedido ${pedido.codigo} cancelado com sucesso. A Farmácia Satélite foi notificada!`);
      } else if (newStatus === "Em Separação") toast.info("Pedido marcado em separação.");
      else if (newStatus === "Separado") toast.success("Separação finalizada! Pedido pronto para entrega.");
      else if (newStatus === "Entregue") toast.success("Pedido entregue ao farmacêutico da satélite.");
      else if (newStatus === "Concluido") toast.success("Recebimento confirmado! Estoque da Satélite atualizado com sucesso!");
      
      queryClient.invalidateQueries({ queryKey: ['pedidos_satelite'] });
      queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      setModalOpen(false);
      setSelectedPedido(null);
    },
    onError: (err) => {
      const msg = typeof err === "string" ? err : (err?.message || JSON.stringify(err));
      console.error("Mutation updatePedidoMutation failed:", err);
      toast.error(`Erro ao atualizar pedido: ${msg}`);
    }
  });

  // Filtered Pedidos List
  const filteredPedidos = useMemo(() => {
    return pedidos.filter(p => {
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchCode = p.codigo?.toLowerCase().includes(term);
        const matchAla = p.ala_nome?.toLowerCase().includes(term);
        return matchCode || matchAla;
      }
      return true;
    });
  }, [pedidos, filterStatus, searchTerm]);

  // Helpers for Status Badges
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
      case "Cancelado":
        return <Badge className="bg-red-100 text-red-800 border-red-300 flex items-center gap-1 font-bold"><Ban className="w-3 h-3 text-red-600" /> Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* ─── GERADOR DE PEDIDOS (SATÉLITE) ─────────────────────────────────── */}
      {mode === "satelite" && (
        <Card className="p-5 border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
                Solicitar Pedido à Farmácia Central
              </h2>
              <p className="text-xs text-slate-500">
                Calcule a necessidade de medicamentos por Ala e Período com margem flexível de segurança para reposição do estoque satélite.
              </p>
            </div>

            {calculoNecessidade.length > 0 && (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-600">Prioridade:</span>
                  <select
                    value={prioridadePedido}
                    onChange={e => setPrioridadePedido(e.target.value)}
                    className={`text-xs font-bold rounded-lg border px-2 py-1.5 outline-none ${
                      prioridadePedido === "Emergência" 
                        ? "bg-red-600 text-white border-red-700" 
                        : prioridadePedido === "Urgente" 
                          ? "bg-amber-500 text-white border-amber-600" 
                          : "bg-white text-slate-700 border-slate-300"
                    }`}
                  >
                    <option value="Normal">Normal</option>
                    <option value="Urgente">⚠️ Urgente</option>
                    <option value="Emergência">🚨 Emergência</option>
                  </select>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenPrintPreview()}
                  className="border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold gap-2 shadow-sm h-9"
                  title="Imprimir requisição do pedido calculada (sem enviar)"
                >
                  <Printer className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  Imprimir Pedido
                </Button>

                <Button
                  onClick={() => criarPedidoMutation.mutate()}
                  disabled={criarPedidoMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 shadow-md h-9"
                >
                  <Send className="w-4 h-4" />
                  {criarPedidoMutation.isPending ? "Enviando..." : "Fazer Pedido à Central"}
                </Button>
              </div>
            )}
          </div>

          {/* Painel de Controles e Parâmetros */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
            {/* Seletor de Ala */}
            <div className="md:col-span-3">
              <Label className="text-[11px] text-slate-500 font-semibold mb-1 block">Ala / Setor</Label>
              <Select value={selectedAlaId} onValueChange={(val) => { setSelectedAlaId(val); setCustomQuantities({}); }}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione a Ala..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Alas</SelectItem>
                  {alas.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Seletor de Dias */}
            <div className="md:col-span-4">
              <Label className="text-[11px] text-slate-500 font-semibold mb-1 block">Dias de Suprimento</Label>
              <div className="flex items-center gap-1 flex-wrap">
                {[1, 2, 3, 5, 7, 10].map(d => (
                  <Button
                    key={d}
                    size="sm"
                    variant={diasCalculo === d ? "default" : "outline"}
                    onClick={() => { setDiasCalculo(d); setCustomQuantities({}); }}
                    className={cn("h-9 text-xs px-2.5", diasCalculo === d && "bg-blue-600 font-bold")}
                  >
                    {d}D
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant={diasCalculo === "custom" ? "default" : "outline"}
                  onClick={() => { setDiasCalculo("custom"); setCustomQuantities({}); }}
                  className={cn("h-9 text-xs px-2.5", diasCalculo === "custom" && "bg-blue-600 font-bold")}
                >
                  Outro
                </Button>
                {diasCalculo === "custom" && (
                  <Input
                    type="number"
                    min="1"
                    max="90"
                    placeholder="Dias"
                    value={customDias}
                    onChange={(e) => { setCustomDias(e.target.value); setCustomQuantities({}); }}
                    className="w-16 h-9 text-xs"
                  />
                )}
              </div>
            </div>

            {/* Seletor de Margem de Segurança (Altas e Admissões) */}
            <div className="md:col-span-5">
              <div className="flex items-center justify-between mb-1">
                <Label className="text-[11px] text-slate-700 dark:text-slate-200 font-bold flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5 text-emerald-600" />
                  Margem de Segurança (Altas / Admissões)
                </Label>
                {effectiveMargem > 0 && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                    +{effectiveMargem}% ativo
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {[0, 10, 20, 25, 30].map(m => (
                  <Button
                    key={m}
                    size="sm"
                    variant={margemPercentual === m ? "default" : "outline"}
                    onClick={() => { setMargemPercentual(m); setCustomQuantities({}); }}
                    className={cn(
                      "h-9 text-xs px-2.5",
                      margemPercentual === m 
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm" 
                        : "border-slate-200 hover:border-emerald-300"
                    )}
                  >
                    {m === 0 ? "0% (Exato)" : `+${m}%`}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant={margemPercentual === "custom" ? "default" : "outline"}
                  onClick={() => { setMargemPercentual("custom"); setCustomQuantities({}); }}
                  className={cn(
                    "h-9 text-xs px-2.5",
                    margemPercentual === "custom" 
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white font-bold" 
                      : "border-slate-200"
                  )}
                >
                  Outro %
                </Button>
                {margemPercentual === "custom" && (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min="0"
                      max="200"
                      placeholder="%"
                      value={customMargem}
                      onChange={(e) => { setCustomMargem(e.target.value); setCustomQuantities({}); }}
                      className="w-16 h-9 text-xs font-bold text-center"
                    />
                    <span className="text-xs font-bold text-slate-500">%</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Linha de Configurações Extras (Abater Estoque Atual) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-800 mb-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={descontarEstoque}
                onChange={(e) => { setDescontarEstoque(e.target.checked); setCustomQuantities({}); }}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Abater estoque já existente na Farmácia Satélite da quantidade a pedir
              </span>
              <span className="text-[11px] text-slate-500 hidden md:inline">
                (ex: precisa de 63, já tem 10 no estoque satélite → sugere pedir 53)
              </span>
            </label>

            {Object.keys(customQuantities).length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCustomQuantities({})}
                className="h-7 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50 gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Redefinir edições manuais
              </Button>
            )}
          </div>

          {/* Cards de Resumo do Cálculo */}
          {calculoNecessidade.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200/60 dark:border-slate-800">
                <p className="text-[10px] uppercase font-bold text-slate-500">Medicamentos</p>
                <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{resumoPedido.totalItens} <span className="text-xs font-normal text-slate-500">itens</span></p>
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200/60 dark:border-slate-800">
                <p className="text-[10px] uppercase font-bold text-slate-500">Consumo Prescrito ({effectiveDays}D)</p>
                <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{resumoPedido.totalPrescrito} <span className="text-xs font-normal text-slate-500">un</span></p>
              </div>
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200/70 dark:border-emerald-900/40">
                <p className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400">Reserva de Segurança ({effectiveMargem}%)</p>
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">+{resumoPedido.totalMargemExtra} <span className="text-xs font-normal text-emerald-600">un</span></p>
              </div>
              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200/70 dark:border-blue-900/40">
                <p className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-400">Total a Solicitar</p>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{resumoPedido.totalSolicitado} <span className="text-xs font-normal text-blue-600">un</span></p>
              </div>
            </div>
          )}

          {/* Tabela de Itens da Necessidade */}
          <div className="space-y-4">
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-100 dark:bg-slate-800">
                  <TableRow>
                    <TableHead className="w-16">Cód</TableHead>
                    <TableHead>Medicamento / Concentração</TableHead>
                    <TableHead className="text-center">Consumo Diário (1D)</TableHead>
                    <TableHead className="text-center">
                      Prescrição ({effectiveDays}D)
                    </TableHead>
                    {effectiveMargem > 0 && (
                      <TableHead className="text-center bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold">
                        Com Margem (+{effectiveMargem}%)
                      </TableHead>
                    )}
                    <TableHead className="text-center">Estoque Satélite</TableHead>
                    <TableHead className="text-center bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300 font-bold w-40">
                      Quantidade a Pedir
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calculoNecessidade.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={effectiveMargem > 0 ? 7 : 6} className="text-center py-10 text-slate-500">
                        Nenhuma necessidade calculada para esta Ala e Período.
                      </TableCell>
                    </TableRow>
                  ) : (
                    calculoNecessidade.map(item => {
                      const isCustom = customQuantities[item.medicamentoId] !== undefined;
                      const currentVal = isCustom 
                        ? customQuantities[item.medicamentoId] 
                        : item.qtdSugerida;

                      return (
                        <TableRow key={item.medicamentoId} className="hover:bg-slate-50/80">
                          <TableCell className="font-mono text-xs text-slate-500">{item.codigo || "-"}</TableCell>
                          <TableCell>
                            <p className="font-bold text-slate-900 dark:text-slate-100">{item.nome}</p>
                            <p className="text-xs text-slate-500">{item.concentracao} {item.apresentacao ? `(${item.apresentacao})` : ""}</p>
                          </TableCell>
                          <TableCell className="text-center font-mono font-semibold">
                            {item.qtdDiaria} un/dia
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                            {item.qtdCalculada} un
                          </TableCell>
                          {effectiveMargem > 0 && (
                            <TableCell className="text-center font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20">
                              <span>{item.qtdComMargem} un</span>
                              <span className="text-[10px] text-emerald-600 block">(+{item.qtdMargemExtra})</span>
                            </TableCell>
                          )}
                          <TableCell className="text-center font-mono font-bold text-slate-600">
                            <div>{item.estoqueSatelite} un</div>
                            {descontarEstoque && (
                              <span className="text-[10px] text-blue-600 font-semibold block">
                                -{Math.min(item.estoqueSatelite, item.qtdComMargem)} abatido
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center bg-blue-50/20 dark:bg-blue-950/10">
                            <div className="flex flex-col items-center">
                              <Input
                                type="number"
                                min="0"
                                value={currentVal}
                                onChange={(e) => setCustomQuantities({
                                  ...customQuantities,
                                  [item.medicamentoId]: e.target.value
                                })}
                                className={cn(
                                  "w-24 text-center font-bold font-mono mx-auto h-8 text-sm bg-white",
                                  isCustom && "border-amber-500 focus:ring-amber-500 text-amber-900"
                                )}
                              />
                              {isCustom && (
                                <span className="text-[10px] text-amber-600 font-semibold mt-0.5">
                                  Ajustado manual (Sugestão: {item.qtdSugerida})
                                </span>
                              )}
                              {!isCustom && currentVal === 0 && (
                                <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                                  (Estoque suficiente)
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </Card>
      )}

      {/* ─── TABELA DE HISTÓRICO & ACOMPANHAMENTO DOS PEDIDOS ───────────────── */}
      <Card className="p-5 border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-indigo-600" />
              {mode === "central" ? "Central de Separação de Pedidos da Satélite" : "Histórico & Status dos Pedidos"}
            </h3>
            <p className="text-xs text-slate-500">
              {mode === "central" 
                ? "Separe os itens solicitados pela Satélite, ajuste quantidades se necessário e confirme entrega." 
                : "Acompanhe a separação e confirme o recebimento para atualizar o estoque da satélite."}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar código ou Ala..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs w-[160px]">
                <SelectValue placeholder="Filtrar Status..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="Pendente">Solicitado (Pendente)</SelectItem>
                <SelectItem value="Em Separação">Em Separação</SelectItem>
                <SelectItem value="Separado">Separado (Pronto)</SelectItem>
                <SelectItem value="Entregue">Entregue</SelectItem>
                <SelectItem value="Concluido">Concluído</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-100 dark:bg-slate-800">
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Ala / Setor</TableHead>
                <TableHead>Data Solicitação</TableHead>
                <TableHead className="text-center">Período (Dias)</TableHead>
                <TableHead className="text-center">Itens</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingPedidos ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    Carregando pedidos...
                  </TableCell>
                </TableRow>
              ) : filteredPedidos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    Nenhum pedido encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPedidos.map(p => {
                  let itensArr = [];
                  try { itensArr = JSON.parse(p.itens_json || "[]"); } catch {}

                  return (
                    <TableRow key={p.id} className="hover:bg-slate-50">
                      <TableCell className="font-mono font-bold text-xs text-indigo-600">
                        {p.codigo}
                        {p.prioridade && p.prioridade !== "Normal" && (
                          <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                            p.prioridade === "Emergência" ? "bg-red-600 text-white animate-pulse" : "bg-amber-500 text-white"
                          }`}>
                            {p.prioridade}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-800">{p.ala_nome}</TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {p.data_solicitacao ? format(new Date(p.data_solicitacao), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"}
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        <div className="font-bold">{p.dias_calculados}D</div>
                        {p.margem_seguranca > 0 && (
                          <span className="inline-block mt-0.5 px-1 py-0.2 rounded text-[10px] bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                            +{p.margem_seguranca}%
                          </span>
                        )}
                        {p.descontar_estoque === 1 && (
                          <span className="block text-[9px] text-blue-600 font-semibold">
                            Est. Abatido
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-mono">{itensArr.length} item(s)</TableCell>
                      <TableCell className="text-center">{getStatusBadge(p.status)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenPrintPreview({ ...p, itens: itensArr })}
                          className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                          title="Imprimir este Pedido"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </Button>
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
                          className="gap-1.5 h-8 text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          {mode === "central" ? (p.status === "Pendente" || p.status === "Em Separação" ? "Separar / Processar" : "Ver Detalhes") : (p.status === "Separado" || p.status === "Entregue" ? "Conferir & Receber" : "Ver Detalhes")}
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

      {/* ─── MODAL DETALHADO DE PROCESSAMENTO DO PEDIDO ──────────────────────── */}
      {selectedPedido && (
        <OrderDetailsModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          pedido={selectedPedido}
          mode={mode}
          onPrint={(p) => handleOpenPrintPreview(p)}
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

      {/* ─── MODAL DE IMPRESSÃO DO PEDIDO (A4 FORMAL) ────────────────────── */}
      <Dialog open={Boolean(printOrderData)} onOpenChange={(open) => !open && setPrintOrderData(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 border-none bg-slate-100 dark:bg-slate-900 shadow-2xl">
          <DialogHeader className="p-4 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex flex-row items-center justify-between no-print sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-blue-600" />
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                Visualização de Impressão — Requisição à Farmácia Central
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPrintOrderData(null)}>
                Fechar
              </Button>
              <Button size="sm" onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1.5 shadow-sm">
                <Printer className="w-4 h-4" />
                Imprimir Agora
              </Button>
            </div>
          </DialogHeader>

          {/* FOLHA FORMAL A4 */}
          <div id="printable-order-sheet" className="p-6 sm:p-10 bg-white text-slate-900 mx-auto w-full shadow-sm print:p-0 print:shadow-none">
            <style>{`
              @media print {
                body * {
                  visibility: hidden !important;
                }
                #printable-order-sheet, #printable-order-sheet * {
                  visibility: visible !important;
                }
                #printable-order-sheet {
                  position: fixed !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  margin: 0 !important;
                  padding: 10mm !important;
                  background: white !important;
                  color: black !important;
                  display: block !important;
                  z-index: 999999 !important;
                }
              }
            `}</style>

            {/* Cabeçalho */}
            <div className="border-b-2 border-slate-900 pb-4 mb-5 flex justify-between items-start">
              <div>
                <h1 className="text-xl font-black uppercase text-slate-950 tracking-tight">
                  ZORION SAÚDE — FARMÁCIA HOSPITALAR
                </h1>
                <h2 className="text-sm font-bold text-blue-800 uppercase mt-0.5">
                  REQUISIÇÃO DE MEDICAMENTOS • PEDIDO À FARMÁCIA CENTRAL
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  Origem: <strong>Farmácia Satélite</strong> • Setor/Ala: <strong>{printOrderData?.alaNome}</strong>
                </p>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Código: <strong>{printOrderData?.codigo}</strong> • Status: <strong>{printOrderData?.status}</strong>
                </p>
              </div>
              <div className="text-right text-xs text-slate-600 font-mono space-y-1">
                <p>Emissão: <strong>{printOrderData?.dataSolicitacao ? format(new Date(printOrderData.dataSolicitacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "--"}</strong></p>
                <p>Prioridade: <span className="font-bold uppercase text-slate-900">{printOrderData?.prioridade}</span></p>
                <p>Suprimento: <strong>{printOrderData?.dias} dia(s)</strong></p>
                {printOrderData?.margem > 0 && <p>Margem de Segurança: <strong>+{printOrderData.margem}%</strong></p>}
                {printOrderData?.descontarEstoque && <p>Abatido Estoque Satélite: <strong>Sim</strong></p>}
              </div>
            </div>

            {printOrderData?.observacao && (
              <div className="mb-4 p-2.5 bg-slate-50 border border-slate-200 rounded text-xs">
                <strong>Observações da Requisição:</strong> {printOrderData.observacao}
              </div>
            )}

            {/* Tabela de Itens */}
            <table className="w-full text-xs border-collapse border border-slate-300 mb-6">
              <thead>
                <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                  <th className="border border-slate-300 p-2 text-center w-10">Item</th>
                  <th className="border border-slate-300 p-2 text-center w-16">Cód.</th>
                  <th className="border border-slate-300 p-2 text-left">Medicamento / Concentração</th>
                  <th className="border border-slate-300 p-2 text-center w-24">Prescr. ({printOrderData?.dias}D)</th>
                  <th className="border border-slate-300 p-2 text-center w-16">Est. Sat.</th>
                  <th className="border border-slate-300 p-2 text-center w-28 bg-blue-50/60 font-black">Qtd Solicitada</th>
                  <th className="border border-slate-300 p-2 text-center w-24">Conferência</th>
                </tr>
              </thead>
              <tbody>
                {printOrderData?.itens?.map((item, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                    <td className="border border-slate-300 p-1.5 text-center font-mono">{idx + 1}</td>
                    <td className="border border-slate-300 p-1.5 text-center font-mono">{item.codigo || "-"}</td>
                    <td className="border border-slate-300 p-1.5 font-medium">
                      <span className="font-bold">{item.nome}</span>
                      {item.concentracao && <span className="text-slate-600"> ({item.concentracao})</span>}
                      {item.apresentacao && <span className="text-slate-500 text-[10px] block">[{item.apresentacao}]</span>}
                    </td>
                    <td className="border border-slate-300 p-1.5 text-center font-mono">{item.qtdPrescrita} un</td>
                    <td className="border border-slate-300 p-1.5 text-center font-mono">{item.estoqueSatelite} un</td>
                    <td className="border border-slate-300 p-1.5 text-center font-mono font-bold text-sm bg-blue-50/30">
                      {item.qtdSolicitada} un
                    </td>
                    <td className="border border-slate-300 p-1.5 text-center font-mono text-slate-400">
                      [&nbsp;&nbsp;&nbsp;&nbsp;]
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold border-t-2 border-slate-400">
                  <td colSpan={5} className="border border-slate-300 p-2 text-right uppercase">
                    Total de Itens: {printOrderData?.itens?.length || 0} • Total de Unidades Solicitadas:
                  </td>
                  <td className="border border-slate-300 p-2 text-center font-mono text-sm font-black bg-blue-100/60">
                    {printOrderData?.itens?.reduce((acc, item) => acc + (Number(item.qtdSolicitada) || 0), 0) || 0} un
                  </td>
                  <td className="border border-slate-300 p-2"></td>
                </tr>
              </tfoot>
            </table>

            {/* Campos de Assinatura */}
            <div className="mt-12 pt-6 border-t border-slate-300 grid grid-cols-2 gap-8 text-center text-xs">
              <div>
                <div className="border-b border-slate-400 w-52 mx-auto mb-1"></div>
                <p className="font-bold text-slate-800">Solicitante (Farmácia Satélite)</p>
                <p className="text-[10px] text-slate-500">Assinatura / Carimbo</p>
              </div>
              <div>
                <div className="border-b border-slate-400 w-52 mx-auto mb-1"></div>
                <p className="font-bold text-slate-800">Atendido / Separado por (Farmácia Central)</p>
                <p className="text-[10px] text-slate-500">Assinatura / Carimbo</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── SUBCOMPONENTE MODAL DE DETALHES & CONFERÊNCIA ───────────────────────────
export function OrderDetailsModal({ open, onOpenChange, pedido, mode, onUpdateStatus, isPending, onPrint }) {
  const [itensState, setItensState] = useState(() => {
    const rawItens = pedido.itens || [];
    return rawItens.map(i => ({
      ...i,
      qtd_recebida: i.qtd_recebida !== undefined ? i.qtd_recebida : i.qtd_atendida
    }));
  });

  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [motivoPreset, setMotivoPreset] = useState("Medicamento em falta / Desabastecimento na Central");
  const [motivoCustom, setMotivoCustom] = useState("");

  const handleToggleCheck = (index, field) => {
    const next = [...itensState];
    next[index][field] = !next[index][field];
    setItensState(next);
  };

  const handleQtdAtendidaChange = (index, val) => {
    const next = [...itensState];
    const num = parseInt(val, 10);
    const valNum = isNaN(num) ? 0 : num;
    next[index].qtd_atendida = valNum;
    if (next[index].qtd_recebida === undefined) {
      next[index].qtd_recebida = valNum;
    }
    setItensState(next);
  };

  const handleQtdRecebidaChange = (index, val) => {
    const next = [...itensState];
    const num = parseInt(val, 10);
    next[index].qtd_recebida = isNaN(num) ? 0 : num;
    setItensState(next);
  };

  const handleToggleAll = (field) => {
    const allChecked = itensState.every(i => i[field]);
    const next = itensState.map(i => ({ ...i, [field]: !allChecked }));
    setItensState(next);
  };

  const allSeparated = itensState.every(i => i.separado);
  const allConferido = itensState.every(i => i.conferido);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="border-b pb-3">
          <div className="flex justify-between items-center pr-6">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-indigo-600" />
                Pedido {pedido.codigo} — {pedido.ala_nome}
              </DialogTitle>
              <DialogDescription className="text-xs flex flex-wrap items-center gap-2 mt-1">
                <span>Solicitado em {pedido.data_solicitacao ? format(new Date(pedido.data_solicitacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "-"} para {pedido.dias_calculados} dia(s).</span>
                {pedido.margem_seguranca > 0 && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 font-bold py-0.5">
                    +{pedido.margem_seguranca}% Margem de Segurança
                  </Badge>
                )}
                {pedido.descontar_estoque === 1 && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-300 font-semibold py-0.5">
                    Estoque Satélite Abatido
                  </Badge>
                )}
                {pedido.observacao && (
                  <span className="text-slate-500 font-medium ml-1">Obs: {pedido.observacao}</span>
                )}
              </DialogDescription>
            </div>
            <Badge variant="outline" className={`text-sm font-bold ${pedido.status === 'Cancelado' ? 'border-red-400 bg-red-50 text-red-700' : ''}`}>
              Status: {pedido.status}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Banner de Pedido Cancelado */}
          {pedido.status === "Cancelado" && (
            <div className="bg-red-50 border border-red-200 p-3.5 rounded-xl text-xs text-red-900 flex items-start gap-2.5 shadow-sm">
              <Ban className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-sm text-red-800">Pedido Cancelado</p>
                <p className="text-red-700">
                  <strong>Motivo:</strong> {pedido.motivo_cancelamento || "Cancelado pelo Estoque Central."}
                </p>
                {pedido.data_cancelamento && (
                  <p className="text-[11px] text-red-500">
                    Cancelado em {format(new Date(pedido.data_cancelamento), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
              </div>
            </div>
          )}
          {/* Central Workflow Instructions */}
          {mode === "central" && (pedido.status === "Pendente" || pedido.status === "Em Separação") && (
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg flex justify-between items-center text-xs text-blue-900">
              <span>Marque a caixa de seleção à medida que for separando os itens. Ajuste a <strong>Qtd Enviada</strong> se não puder atender o valor total solicitado.</span>
              <Button size="sm" variant="outline" onClick={() => handleToggleAll("separado")} className="h-7 text-xs bg-white">
                {allSeparated ? "Desmarcar Todos" : "Marcar Todos Separados"}
              </Button>
            </div>
          )}

          {/* Satélite Workflow Instructions */}
          {mode === "satelite" && (pedido.status === "Separado" || pedido.status === "Entregue") && (
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex justify-between items-center text-xs text-emerald-900">
              <span>Confira os itens entregues. Ajuste a <strong>Qtd Recebida</strong> se chegou menos. Apenas a quantidade realmente recebida entrará no Estoque Satélite.</span>
              <Button size="sm" variant="outline" onClick={() => handleToggleAll("conferido")} className="h-7 text-xs bg-white">
                {allConferido ? "Desmarcar Todos" : "Marcar Todos Conferidos"}
              </Button>
            </div>
          )}

          <Table border>
            <TableHeader className="bg-slate-100">
              <TableRow>
                {mode === "central" && (pedido.status === "Pendente" || pedido.status === "Em Separação") && (
                  <TableHead className="w-12 text-center">Sep.</TableHead>
                )}
                {(pedido.status === "Separado" || pedido.status === "Entregue" || pedido.status === "Concluido") && (
                  <TableHead className="w-12 text-center">Conf.</TableHead>
                )}
                <TableHead>Medicamento / Concentração</TableHead>
                <TableHead className="text-center">Qtd Solicitada</TableHead>
                <TableHead className="text-center bg-indigo-50/60 font-bold text-indigo-900">Qtd Enviada (Central)</TableHead>
                {(pedido.status === "Separado" || pedido.status === "Entregue" || pedido.status === "Concluido") && (
                  <TableHead className="text-center bg-emerald-50/80 font-bold text-emerald-900">Qtd Recebida (Satélite)</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {itensState.map((item, idx) => (
                <TableRow key={idx} className={cn(
                  item.separado && mode === "central" && "bg-blue-50/40",
                  item.conferido && mode === "satelite" && "bg-emerald-50/40"
                )}>
                  {mode === "central" && (pedido.status === "Pendente" || pedido.status === "Em Separação") && (
                    <TableCell className="text-center">
                      <input
                        type="checkbox"
                        checked={!!item.separado}
                        onChange={() => handleToggleCheck(idx, "separado")}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer"
                      />
                    </TableCell>
                  )}

                  {(pedido.status === "Separado" || pedido.status === "Entregue" || pedido.status === "Concluido") && (
                    <TableCell className="text-center">
                      <input
                        type="checkbox"
                        checked={!!item.conferido}
                        onChange={() => handleToggleCheck(idx, "conferido")}
                        disabled={pedido.status === "Concluido"}
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 cursor-pointer"
                      />
                    </TableCell>
                  )}

                  <TableCell>
                    <p className="font-bold text-slate-900">{item.medicamento_nome}</p>
                    <p className="text-xs text-slate-500">{item.concentracao} {item.apresentacao ? `(${item.apresentacao})` : ""}</p>
                    {item.qtd_prescrita !== undefined && (
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Prescrição: <span className="font-semibold">{item.qtd_prescrita} un</span>
                        {item.margem_percentual > 0 && (
                          <span className="text-emerald-600 font-bold ml-1">
                            (+{item.margem_percentual}% margem: +{item.qtd_margem_extra || Math.ceil(item.qtd_prescrita * (item.margem_percentual / 100))} un)
                          </span>
                        )}
                        {item.descontou_estoque === 1 && (
                          <span className="text-blue-600 font-medium ml-1">
                            (-{item.estoque_satelite_momento || 0} em estoque)
                          </span>
                        )}
                      </p>
                    )}
                  </TableCell>

                  <TableCell className="text-center font-mono font-bold text-slate-700">
                    {item.qtd_solicitada} un
                  </TableCell>

                  <TableCell className="text-center">
                    {mode === "central" && (pedido.status === "Pendente" || pedido.status === "Em Separação") ? (
                      <Input
                        type="number"
                        min="0"
                        value={item.qtd_atendida}
                        onChange={(e) => handleQtdAtendidaChange(idx, e.target.value)}
                        className="w-20 text-center font-mono font-bold mx-auto h-8 text-sm bg-white"
                      />
                    ) : (
                      <span className={cn(
                        "font-mono font-bold text-base",
                        item.qtd_atendida < item.qtd_solicitada ? "text-amber-600 font-black" : "text-indigo-700"
                      )}>
                        {item.qtd_atendida} un {item.qtd_atendida < item.qtd_solicitada && `(solicitado ${item.qtd_solicitada})`}
                      </span>
                    )}
                  </TableCell>

                  {(pedido.status === "Separado" || pedido.status === "Entregue" || pedido.status === "Concluido") && (
                    <TableCell className="text-center bg-emerald-50/30">
                      {pedido.status === "Concluido" ? (
                        <span className={cn(
                          "font-mono font-bold text-base",
                          (item.qtd_recebida ?? item.qtd_atendida) < item.qtd_atendida ? "text-red-600 font-black" : "text-emerald-700"
                        )}>
                          {item.qtd_recebida ?? item.qtd_atendida} un
                          {(item.qtd_recebida ?? item.qtd_atendida) < item.qtd_atendida && (
                            <span className="text-xs block text-red-600 font-bold">
                              (faltaram {item.qtd_atendida - (item.qtd_recebida ?? item.qtd_atendida)})
                            </span>
                          )}
                        </span>
                      ) : (
                        <div className="flex flex-col items-center mx-auto w-24">
                          <Input
                            type="number"
                            min="0"
                            max={item.qtd_atendida}
                            value={item.qtd_recebida !== undefined ? item.qtd_recebida : item.qtd_atendida}
                            onChange={(e) => handleQtdRecebidaChange(idx, e.target.value)}
                            className="w-20 text-center font-mono font-bold h-8 text-sm bg-white border-2 border-emerald-500 focus:ring-emerald-500 text-emerald-900 shadow-sm"
                          />
                          {(item.qtd_recebida !== undefined && item.qtd_recebida < item.qtd_atendida) && (
                            <span className="text-[10px] text-red-600 font-bold mt-0.5 whitespace-nowrap">
                              Divergência: -{item.qtd_atendida - item.qtd_recebida} un
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="border-t pt-3 flex flex-wrap justify-between items-center w-full gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>

            {/* BOTAO CANCELAR PEDIDO */}
            {pedido.status !== "Concluido" && pedido.status !== "Cancelado" && (
              <Button
                variant="outline"
                onClick={() => setIsCancelDialogOpen(true)}
                disabled={isPending}
                className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold gap-1.5"
              >
                <Ban className="w-4 h-4" />
                Cancelar Pedido
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onPrint?.(pedido)}
              className="gap-1.5 font-bold border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              Imprimir Pedido
            </Button>

            {/* CENTRAL ACTIONS */}
            {mode === "central" && pedido.status === "Pendente" && (
              <Button
                onClick={() => onUpdateStatus("Em Separação", itensState)}
                disabled={isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold"
              >
                Iniciar Separação
              </Button>
            )}

            {mode === "central" && (pedido.status === "Pendente" || pedido.status === "Em Separação") && (
              <>
                <Button
                  onClick={() => onUpdateStatus("Separado", itensState)}
                  disabled={isPending}
                  variant="outline"
                  className="border-purple-300 text-purple-700 hover:bg-purple-50 font-bold"
                >
                  Finalizar Separação
                </Button>
                <Button
                  onClick={() => onUpdateStatus("Entregue", itensState)}
                  disabled={isPending}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold gap-1.5 shadow-sm"
                >
                  <Truck className="w-4 h-4" />
                  Finalizar & Entregar à Farmácia
                </Button>
              </>
            )}

            {mode === "central" && pedido.status === "Separado" && (
              <Button
                onClick={() => onUpdateStatus("Entregue", itensState)}
                disabled={isPending}
                className="bg-orange-600 hover:bg-orange-700 text-white font-bold gap-2 shadow-md"
              >
                <Truck className="w-4 h-4" />
                Entregar à Farmácia Satélite
              </Button>
            )}

            {/* SATÉLITE ACTIONS */}
            {mode === "satelite" && (pedido.status === "Separado" || pedido.status === "Entregue") && (
              <Button
                onClick={() => onUpdateStatus("Concluido", itensState)}
                disabled={isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 shadow-md"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirmar Recebimento & Entrada no Estoque Satélite
              </Button>
            )}
          </div>
        </DialogFooter>

        {/* DIALOG DE CONFIRMAÇÃO E MOTIVO DE CANCELAMENTO */}
        <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-red-700 flex items-center gap-2 text-base font-bold">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Cancelar Pedido {pedido.codigo}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Informe o motivo do cancelamento deste pedido. Uma notificação será enviada imediatamente para a Farmácia Satélite.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Motivo do Cancelamento *</Label>
                <Select value={motivoPreset} onValueChange={setMotivoPreset}>
                  <SelectTrigger className="text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Medicamento em falta / Desabastecimento na Central">
                      Medicamento em falta / Desabastecimento na Central
                    </SelectItem>
                    <SelectItem value="Lote com validade próxima / Divergência de estoque">
                      Lote com validade próxima / Divergência de estoque
                    </SelectItem>
                    <SelectItem value="Prescrição médica suspensa / Paciente em alta">
                      Prescrição médica suspensa / Paciente em alta
                    </SelectItem>
                    <SelectItem value="Pedido duplicado / Solicitado incorretamente">
                      Pedido duplicado / Solicitado incorretamente
                    </SelectItem>
                    <SelectItem value="Substituição terapêutica indicada pelo RT">
                      Substituição terapêutica indicada pelo RT
                    </SelectItem>
                    <SelectItem value="Outro">
                      Outro motivo (especificar abaixo)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  {motivoPreset === "Outro" ? "Descreva o motivo detalhado *" : "Observação / Justificativa adicional (opcional)"}
                </Label>
                <Textarea
                  placeholder="Detalhes adicionais para a equipe da farmácia..."
                  value={motivoCustom}
                  onChange={(e) => setMotivoCustom(e.target.value)}
                  className="text-xs min-h-[80px] bg-white"
                  required={motivoPreset === "Outro"}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCancelDialogOpen(false)}
              >
                Voltar
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isPending || (motivoPreset === "Outro" && !motivoCustom.trim())}
                onClick={() => {
                  const motivoFinal = motivoPreset === "Outro" 
                    ? motivoCustom.trim() 
                    : (motivoCustom.trim() ? `${motivoPreset} - ${motivoCustom.trim()}` : motivoPreset);
                  
                  onUpdateStatus("Cancelado", itensState, motivoFinal);
                  setIsCancelDialogOpen(false);
                }}
                className="bg-red-600 hover:bg-red-700 text-white font-bold gap-1.5 shadow-sm"
              >
                <Ban className="w-4 h-4" />
                Confirmar Cancelamento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
