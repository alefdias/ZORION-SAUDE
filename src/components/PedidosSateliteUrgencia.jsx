import { useState, useMemo, useEffect } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { 
  PackagePlus, 
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
  RotateCcw,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ComboboxMedicamento } from "@/components/ui/combobox-medicamento";
import { isPsicotropico, getPortaria344List } from "@/utils/mavUtils";
import { safeFormatDate } from "@/utils/dateUtils";
import { OrderDetailsModal } from "./PedidosSateliteManager";

export default function PedidosSateliteUrgencia() {
  const queryClient = useQueryClient();

  // Current logged user
  let currentUser = { full_name: "Farmacêutico Satélite", crf: "CRF-SP 45.291" };
  try {
    const rawUser = localStorage.getItem("pharma_user");
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      if (parsed) {
        currentUser = {
          full_name: parsed.full_name || parsed.nome || "Farmacêutico Satélite",
          crf: parsed.crf || "CRF-SP 45.291"
        };
      }
    }
  } catch (e) {}

  // Queries
  const { data: medicamentos = [] } = useQuery({
    queryKey: ['medicamentos'],
    queryFn: () => db.entities.Medicamento.list(),
  });

  const { data: lotes = [] } = useQuery({
    queryKey: ['lotes'],
    queryFn: () => db.entities.Lote.list(),
  });

  const { data: pedidos = [], isLoading: isLoadingPedidos } = useQuery({
    queryKey: ['pedidos_satelite'],
    queryFn: async () => {
      const all = await db.entities.PedidoSatelite.list('-created_at');
      return all || [];
    },
    refetchInterval: 2000 // Real-time sync every 2s
  });

  // State: Adicionar Medicamento
  const [selectedMedId, setSelectedMedId] = useState("");
  const [selectedLoteId, setSelectedLoteId] = useState("");
  const [qtdItem, setQtdItem] = useState(1);
  const [observacaoPedido, setObservacaoPedido] = useState("");
  const [apenasComEstoqueCentral, setApenasComEstoqueCentral] = useState(true);

  // Order Items List
  const [itensPedido, setItensPedido] = useState([]);

  // Modal State for viewing/receiving orders
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filtroHistorico, setFiltroHistorico] = useState("avulsos"); // 'avulsos' | 'todos'

  // Medicamentos elegíveis para pedido à Central (filtra zerados se a opção estiver ativa)
  const medicamentosDisponiveis = useMemo(() => {
    if (!apenasComEstoqueCentral) return medicamentos;
    return (medicamentos || []).filter(m => (Number(m.estoque_atual) || 0) > 0);
  }, [medicamentos, apenasComEstoqueCentral]);

  const selectedMedObj = useMemo(() => {
    if (!selectedMedId) return null;
    return medicamentos.find(m => String(m.id) === String(selectedMedId));
  }, [medicamentos, selectedMedId]);

  // Lotes disponíveis na Farmácia Central ordenados por FEFO (menor validade primeiro)
  const medCentralLotes = useMemo(() => {
    if (!selectedMedObj) return [];
    return (lotes || [])
      .filter(l => String(l.medicamento_id) === String(selectedMedObj.id) && (Number(l.quantidade_atual) > 0) && l.status !== "Inativo")
      .sort((a, b) => new Date(a.data_validade) - new Date(b.data_validade));
  }, [selectedMedObj, lotes]);

  // Lote previsto que virá da Central baseado no sistema FEFO (o que vence primeiro)
  const loteFefoPrevisto = useMemo(() => {
    return medCentralLotes.length > 0 ? medCentralLotes[0] : null;
  }, [medCentralLotes]);

  // Ao mudar de medicamento, pré-seleciona automaticamente o lote FEFO (vence primeiro), mas permite mudar
  useEffect(() => {
    if (medCentralLotes.length > 0) {
      setSelectedLoteId(medCentralLotes[0].id);
    } else {
      setSelectedLoteId("");
    }
  }, [medCentralLotes]);

  // Add Item to List
  const handleAddItem = (e) => {
    if (e && e.preventDefault) e.preventDefault();

    if (!selectedMedObj) {
      toast.error("Selecione um medicamento para adicionar.");
      return;
    }

    const saldoCentral = Number(selectedMedObj.estoque_atual) || 0;
    if (saldoCentral <= 0) {
      toast.error(`O medicamento "${selectedMedObj.nome}" está com estoque ZERADO na Farmácia Central (Saldo: 0 un). Não é possível solicitar itens sem saldo na Central.`);
      return;
    }

    const qtd = parseInt(qtdItem, 10);
    if (isNaN(qtd) || qtd <= 0) {
      toast.error("Informe uma quantidade válida maior que zero.");
      return;
    }

    if (qtd > saldoCentral) {
      toast.error(`Quantidade solicitada (${qtd} un) não pode ser maior que o saldo disponível na Central (${saldoCentral} un).`);
      return;
    }

    const isPsico = Boolean(
      selectedMedObj.portaria_344 ||
      isPsicotropico(selectedMedObj) ||
      isPsicotropico(selectedMedObj.nome) ||
      isPsicotropico(selectedMedObj.grupo_terapeutico)
    );
    const portariaList = isPsico ? getPortaria344List(selectedMedObj) : null;

    // Lote escolhido (pode ser o FEFO ou qualquer outro lote selecionado pelo usuário)
    const chosenLote = medCentralLotes.find(l => String(l.id) === String(selectedLoteId)) || loteFefoPrevisto;

    // Check if item already in list
    const existingIndex = itensPedido.findIndex(i => String(i.medicamento_id) === String(selectedMedObj.id));
    if (existingIndex >= 0) {
      const novaQtdTotal = itensPedido[existingIndex].qtd_solicitada + qtd;
      if (novaQtdTotal > saldoCentral) {
        toast.error(`A quantidade total solicitada (${novaQtdTotal} un) excede o estoque disponível na Farmácia Central (${saldoCentral} un).`);
        return;
      }
      const next = [...itensPedido];
      next[existingIndex].qtd_solicitada = novaQtdTotal;
      next[existingIndex].qtd_atendida = novaQtdTotal;
      if (chosenLote) {
        next[existingIndex].lote_id = chosenLote.id;
        next[existingIndex].lote_previsto = chosenLote.numero_lote;
        next[existingIndex].lote_previsto_id = chosenLote.id;
        next[existingIndex].lote_previsto_validade = chosenLote.data_validade;
      }
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
        lote_id: chosenLote ? chosenLote.id : "",
        lote_previsto: chosenLote ? chosenLote.numero_lote : "",
        lote_previsto_id: chosenLote ? chosenLote.id : "",
        lote_previsto_validade: chosenLote ? chosenLote.data_validade : "",
        separado: false,
        conferido: false,
        is_psicotropico: isPsico ? 1 : 0,
        portaria_344: portariaList
      };
      setItensPedido([...itensPedido, newItem]);
      toast.success(`${selectedMedObj.nome} adicionado.`);
    }

    // Reset selector
    setSelectedMedId("");
    setSelectedLoteId("");
    setQtdItem(1);
  };

  const handleUpdateItemLote = (index, newLoteId) => {
    const next = [...itensPedido];
    const item = next[index];
    const itemLotes = (lotes || []).filter(l => String(l.medicamento_id) === String(item.medicamento_id) && Number(l.quantidade_atual) > 0);
    const newLote = itemLotes.find(l => String(l.id) === String(newLoteId));
    if (newLote) {
      next[index].lote_id = newLote.id;
      next[index].lote_previsto = newLote.numero_lote;
      next[index].lote_previsto_id = newLote.id;
      next[index].lote_previsto_validade = newLote.data_validade;
      setItensPedido(next);
      toast.info(`Lote do item ${item.medicamento_nome} alterado para ${newLote.numero_lote}.`);
    }
  };

  const handleRemoveItem = (index) => {
    const next = itensPedido.filter((_, idx) => idx !== index);
    setItensPedido(next);
  };

  const handleUpdateItemQtd = (index, val) => {
    const num = parseInt(val, 10);
    const valid = isNaN(num) || num < 0 ? 0 : num;
    const item = itensPedido[index];
    const med = medicamentos.find(m => String(m.id) === String(item.medicamento_id));
    const saldoCentral = Number(med ? med.estoque_atual : item.estoque_central_momento) || 0;

    if (saldoCentral <= 0) {
      toast.error(`O medicamento "${item.medicamento_nome}" está ZERADO na Farmácia Central.`);
      return;
    }

    if (valid > saldoCentral) {
      toast.error(`A quantidade (${valid} un) não pode ultrapassar o saldo da Farmácia Central (${saldoCentral} un).`);
      return;
    }

    const next = [...itensPedido];
    next[index].qtd_solicitada = valid;
    next[index].qtd_atendida = valid;
    setItensPedido(next);
  };

  // Mutation to Create Avulso Order
  const createPedidoAvulsoMutation = useMutation({
    mutationFn: async () => {
      const validItens = itensPedido.filter(i => i.qtd_solicitada > 0);
      if (validItens.length === 0) {
        throw new Error("Adicione ao menos um medicamento com quantidade maior que zero.");
      }

      // Validação de segurança em tempo real antes de salvar no banco
      const freshMeds = await db.entities.Medicamento.list();
      for (const item of validItens) {
        const med = freshMeds.find(m => String(m.id) === String(item.medicamento_id));
        const saldoCentral = Number(med ? med.estoque_atual : item.estoque_central_momento) || 0;
        if (saldoCentral <= 0) {
          throw new Error(`O medicamento "${item.medicamento_nome}" está com estoque ZERADO na Farmácia Central (Saldo: 0 un). Remova-o do pedido para prosseguir.`);
        }
        if (item.qtd_solicitada > saldoCentral) {
          throw new Error(`A quantidade solicitada de "${item.medicamento_nome}" (${item.qtd_solicitada} un) ultrapassa o estoque disponível na Farmácia Central (${saldoCentral} un).`);
        }
      }

      const timestampCode = Date.now().toString().slice(-6);
      const pedidoId = crypto.randomUUID();

      let obsFinal = observacaoPedido.trim();
      obsFinal = obsFinal ? `[PEDIDO AVULSO] ${obsFinal}` : "[PEDIDO AVULSO]";

      const novoPedido = {
        id: pedidoId,
        codigo: `PED-${timestampCode}`,
        ala_id: "AVULSO",
        ala_nome: "Farmácia Satélite (Avulso)",
        dias_calculados: 0,
        margem_seguranca: 0,
        descontar_estoque: 0,
        solicitante: `Farmácia Satélite (${currentUser.full_name})`,
        data_solicitacao: new Date().toISOString(),
        status: "Pendente",
        prioridade: "Normal",
        itens_json: JSON.stringify(validItens),
        observacao: obsFinal,
        created_at: new Date().toISOString()
      };

      await db.entities.PedidoSatelite.create(novoPedido);
      await db.logAction("Pedido Avulso Satélite", "PedidoSatelite", novoPedido.id, {
        codigo: novoPedido.codigo,
        ala: novoPedido.ala_nome,
        prioridade: novoPedido.prioridade,
        itens: validItens.length
      });

      return novoPedido;
    },
    onSuccess: (data) => {
      toast.success(`Pedido ${data.codigo} enviado para a Farmácia Central com sucesso!`);
      setItensPedido([]);
      setObservacaoPedido("");
      queryClient.invalidateQueries({ queryKey: ['pedidos_satelite'] });
    },
    onError: (err) => {
      toast.error("Erro ao criar pedido avulso: " + (err.message || err));
    }
  });

  // Modal Action Mutation (Conferir e Receber Pedido)
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
            "Cancelamento Pedido Avulso",
            "PedidoSatelite",
            pedido.id,
            `Pedido ${pedido.codigo} cancelado. Motivo: ${motivoCancelamento || "Sem motivo informado"}`
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
            const med = freshMeds.find(m => String(m.id) === String(item.medicamento_id));
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
            const med = freshMeds.find(m => String(m.id) === String(item.medicamento_id));
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

  // Filter orders for the history table
  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter(p => {
      if (filtroHistorico === "avulsos") {
        return p.ala_id === "AVULSO" || p.observacao?.includes("[PEDIDO AVULSO]") || p.codigo?.includes("URG");
      }
      return true;
    });
  }, [pedidos, filtroHistorico]);

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
      {/* ─── FORMULÁRIO DE PEDIDOS AVULSOS ───────────────────────── */}
      <Card className="p-6 border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PackagePlus className="w-5 h-5 text-blue-600" />
              Fazer Pedido Avulso à Farmácia Central
            </h3>
            <p className="text-xs text-slate-500">
              Solicite medicamentos pontuais para a Farmácia Satélite sem necessidade de cálculo de prescrições. Basta digitar o nome do medicamento e a quantidade desejada.
            </p>
          </div>
          <Badge className="bg-blue-50 text-blue-700 border-blue-200 font-semibold px-2.5 py-1">
            Transferência Central ➔ Satélite
          </Badge>
        </div>

        {/* Adicionar Medicamento à Lista (Combobox idêntico às outras janelas) */}
        <div className="bg-slate-50/80 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-blue-600" />
              Adicionar Medicamento:
            </span>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-medium cursor-pointer select-none bg-white dark:bg-slate-900 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
              <input
                type="checkbox"
                checked={apenasComEstoqueCentral}
                onChange={(e) => setApenasComEstoqueCentral(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
              />
              <span>Ocultar medicamentos zerados na Central ({medicamentos.filter(m => (Number(m.estoque_atual) || 0) <= 0).length} zerados)</span>
            </label>
          </div>

          <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-8 space-y-1">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Medicamento:
              </Label>
              <ComboboxMedicamento
                medicamentos={medicamentosDisponiveis}
                value={selectedMedId}
                onChange={setSelectedMedId}
                placeholder="Digite o nome do medicamento com estoque na Central..."
                stockMode="central"
                blockZeroStock={true}
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Quantidade:
              </Label>
              <Input
                type="number"
                min="1"
                value={qtdItem}
                onChange={(e) => setQtdItem(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="bg-white dark:bg-slate-800 text-center font-bold h-9 text-xs"
              />
            </div>

            <div className="md:col-span-2">
              <Button
                type="submit"
                disabled={!selectedMedObj || (Number(selectedMedObj.estoque_atual) || 0) <= 0}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold h-9 text-xs gap-1.5 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar
              </Button>
            </div>
          </form>

          {/* Dica de Estoque do Medicamento Selecionado */}
          {selectedMedObj && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                <span className="text-slate-700 dark:text-slate-300">
                  Selecionado: <strong className="text-slate-900 dark:text-white">{selectedMedObj.nome} {selectedMedObj.concentracao}</strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className="text-indigo-700 dark:text-indigo-400">
                  Estoque Satélite: <strong>{selectedMedObj.estoque_satelite || 0} un</strong>
                </span>
                <span className="text-slate-300">|</span>
                <span className={Number(selectedMedObj.estoque_atual || 0) > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 font-bold"}>
                  Estoque Central: <strong>{selectedMedObj.estoque_atual || 0} un</strong>
                  {Number(selectedMedObj.estoque_atual || 0) <= 0 ? " (ZERADO)" : ""}
                </span>
                {selectedMedObj.portaria_344 || isPsicotropico(selectedMedObj) ? (
                  <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-300 font-bold ml-auto">
                    🧠 Portaria 344
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700 border-sky-300 font-semibold ml-auto">
                    🏥 Clínico
                  </Badge>
                )}
              </div>

              {/* Aviso se o estoque na Central estiver zerado */}
              {(Number(selectedMedObj.estoque_atual) || 0) <= 0 && (
                <div className="bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 p-3 rounded-xl text-xs text-red-800 dark:text-red-300 flex items-center gap-2 font-medium">
                  <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
                  <div>
                    <strong className="block text-red-900 dark:text-red-200">Medicamento ZERADO na Farmácia Central (Saldo: 0 un)</strong>
                    Não é permitido solicitar este medicamento no pedido avulso porque a Farmácia Central não possui unidades em estoque.
                  </div>
                </div>
              )}

              {/* Seletor de Lote da Central com Indicação Clara de FEFO (o que vence 1º) mas permitindo escolher outro lote */}
              {medCentralLotes.length > 0 ? (
                <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3 rounded-lg space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-blue-600" />
                      Escolha o Lote a Pedir (Central):
                    </span>
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                      ⭐ FEFO pré-selecionado (vence mais cedo), mas você pode escolher outro lote abaixo:
                    </span>
                  </div>
                  <Select value={selectedLoteId} onValueChange={setSelectedLoteId}>
                    <SelectTrigger className="h-9 text-xs bg-white dark:bg-slate-800 font-mono border-slate-300 dark:border-slate-700">
                      <SelectValue placeholder="Selecione o lote..." />
                    </SelectTrigger>
                    <SelectContent>
                      {medCentralLotes.map((l, lIdx) => {
                        const isFefo = lIdx === 0;
                        return (
                          <SelectItem key={l.id} value={l.id} className={isFefo ? "font-bold text-emerald-700 bg-emerald-50/60" : ""}>
                            {isFefo ? "⭐ [FEFO - Vence 1º] " : ""}Lote: {l.numero_lote} • Val: {safeFormatDate(l.data_validade)} • Saldo Central: {l.quantidade_atual} un
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="text-xs bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-2 rounded-lg text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Nenhum lote ativo com saldo encontrado na Central. O lote será associado durante a separação na Farmácia Central.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tabela de Itens Adicionados ao Pedido */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Medicamentos no Pedido ({itensPedido.length} itens, {totalUnidades} un):
            </h4>
            {itensPedido.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setItensPedido([])}
                className="text-xs text-red-600 hover:bg-red-50 h-7 gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Limpar Lista
              </Button>
            )}
          </div>

          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800 text-slate-700">
                  <TableHead className="text-xs font-bold w-16">Cód</TableHead>
                  <TableHead className="text-xs font-bold">Medicamento / Apresentação</TableHead>
                  <TableHead className="text-xs font-bold text-center w-24">Tipo</TableHead>
                  <TableHead className="text-xs font-bold text-center w-28">Estoque Central</TableHead>
                  <TableHead className="text-xs font-bold text-center w-28">Estoque Satélite</TableHead>
                  <TableHead className="text-xs font-bold text-center w-48">Lote Solicitado</TableHead>
                  <TableHead className="text-xs font-bold text-center w-28">Qtd Pedido</TableHead>
                  <TableHead className="text-xs font-bold text-right w-16">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itensPedido.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-400 italic text-xs">
                      Nenhum medicamento adicionado ainda. Digite o nome do medicamento acima e clique em "Adicionar".
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
                      <TableCell className="text-center">
                        {item.is_psicotropico ? (
                          <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200 font-bold">
                            🧠 Psicotrópico
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700 border-sky-200 font-semibold">
                            🏥 Clínico
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs font-semibold">
                        <span className={item.estoque_central_momento > 0 ? "text-slate-700" : "text-amber-600 font-bold"}>
                          {item.estoque_central_momento} un
                        </span>
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs text-indigo-700 font-semibold">
                        {item.estoque_satelite_momento} un
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs">
                        {(() => {
                          const itemLotes = (lotes || [])
                            .filter(l => String(l.medicamento_id) === String(item.medicamento_id) && Number(l.quantidade_atual) > 0 && l.status !== "Inativo")
                            .sort((a, b) => new Date(a.data_validade) - new Date(b.data_validade));
                          
                          if (itemLotes.length > 1) {
                            return (
                              <Select
                                value={item.lote_id || item.lote_previsto_id || ""}
                                onValueChange={(newLoteId) => handleUpdateItemLote(idx, newLoteId)}
                              >
                                <SelectTrigger className="h-7 text-[11px] font-mono px-2 py-0 border-slate-300">
                                  <SelectValue placeholder="Lote..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {itemLotes.map((l, lIdx) => (
                                    <SelectItem key={l.id} value={l.id} className="text-xs">
                                      {lIdx === 0 ? "⭐ " : ""}{l.numero_lote} (Val: {safeFormatDate(l.data_validade)})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            );
                          }
                          
                          if (item.lote_previsto) {
                            return (
                              <div>
                                <span className="font-bold text-emerald-800 dark:text-emerald-300">
                                  {item.lote_previsto}
                                </span>
                                {item.lote_previsto_validade && (
                                  <div className="text-[10px] text-slate-500">
                                    Val: {safeFormatDate(item.lote_previsto_validade)}
                                  </div>
                                )}
                              </div>
                            );
                          }

                          return <span className="text-[10px] text-slate-400 italic">Central definirá</span>;
                        })()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min="1"
                          value={item.qtd_solicitada}
                          onChange={(e) => handleUpdateItemQtd(idx, e.target.value)}
                          className="w-20 text-center font-bold font-mono mx-auto h-8 text-xs border-blue-300 focus:ring-blue-500 text-blue-900 bg-blue-50/30"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveItem(idx)}
                          className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                          title="Remover este item"
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

        {/* Observações e Botão de Envio */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-4">
          <div>
            <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">
              Observação do Pedido (Opcional):
            </Label>
            <Input
              placeholder="Ex: Reposição pontual para estoque satélite / consumo extra no plantão..."
              value={observacaoPedido}
              onChange={(e) => setObservacaoPedido(e.target.value)}
              className="bg-white dark:bg-slate-800 text-xs h-9"
            />
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
            <div className="text-xs text-slate-500">
              Solicitante: <strong className="text-slate-800 dark:text-slate-200">{currentUser.full_name}</strong> ({currentUser.crf || "Farmácia Satélite"})
            </div>

            <Button
              type="button"
              disabled={itensPedido.length === 0 || createPedidoAvulsoMutation.isPending}
              onClick={() => createPedidoAvulsoMutation.mutate()}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 text-xs shadow-md gap-2"
            >
              <Send className="w-4 h-4" />
              {createPedidoAvulsoMutation.isPending ? "Enviando Pedido..." : "Enviar Pedido Avulso à Farmácia Central"}
            </Button>
          </div>
        </div>
      </Card>

      {/* ─── HISTÓRICO E STATUS DOS PEDIDOS ───────────────────── */}
      <Card className="p-6 border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-indigo-600" />
              Acompanhamento & Recebimento de Pedidos
            </h3>
            <p className="text-xs text-slate-500">
              Acompanhe a separação na Farmácia Central e confirme o recebimento para creditar o estoque da satélite.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={filtroHistorico === "avulsos" ? "default" : "outline"}
              size="sm"
              onClick={() => setFiltroHistorico("avulsos")}
              className={`h-7 text-xs font-bold ${
                filtroHistorico === "avulsos" ? "bg-blue-600 text-white" : ""
              }`}
            >
              📦 Apenas Avulsos
            </Button>
            <Button
              type="button"
              variant={filtroHistorico === "todos" ? "default" : "outline"}
              size="sm"
              onClick={() => setFiltroHistorico("todos")}
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
                <TableHead className="text-xs font-bold">Origem / Destino</TableHead>
                <TableHead className="text-xs font-bold">Data Solicitação</TableHead>
                <TableHead className="text-xs font-bold">Lote(s) / Vencimento</TableHead>
                <TableHead className="text-xs font-bold text-center">Itens</TableHead>
                <TableHead className="text-xs font-bold text-center">Status</TableHead>
                <TableHead className="text-xs font-bold text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingPedidos ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-slate-400 text-xs">
                    Carregando pedidos...
                  </TableCell>
                </TableRow>
              ) : pedidosFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-400 text-xs italic">
                    Nenhum pedido avulso registrado ainda.
                  </TableCell>
                </TableRow>
              ) : (
                pedidosFiltrados.map(p => {
                  let itensArr = [];
                  try { itensArr = JSON.parse(p.itens_json || "[]"); } catch {}

                  return (
                    <TableRow key={p.id} className="hover:bg-slate-50">
                      <TableCell className="font-mono font-bold text-xs text-indigo-600">
                        {p.codigo}
                      </TableCell>
                      <TableCell className="font-semibold text-xs text-slate-800">{p.ala_nome}</TableCell>
                      <TableCell className="text-xs text-slate-600 font-mono">
                        {p.data_solicitacao ? format(new Date(p.data_solicitacao), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {itensArr.slice(0, 2).map((it, i) => (
                          <div key={i} className="truncate max-w-[190px] font-mono text-[11px] flex items-center gap-1 mb-0.5">
                            <span className="font-semibold text-slate-800">{it.medicamento_nome?.split(" ")[0]}:</span>
                            <Badge variant="outline" className="text-[10px] py-0 px-1 bg-emerald-50 text-emerald-800 border-emerald-300 font-bold">
                              {it.numero_lote || it.lote_previsto || "FEFO"}
                            </Badge>
                          </div>
                        ))}
                        {itensArr.length > 2 && (
                          <span className="text-[10px] text-slate-400">+{itensArr.length - 2} item(s)...</span>
                        )}
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
          lotes={lotes}
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
