import { useState, useEffect } from "react";
import { db } from "@/api/db";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { CheckCheck, XCircle, CheckSquare, Square, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export function TransferenciaAcceptModal({ activeSection }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);

  const { data: pendingTransfers = [], isLoading } = useQuery({
    queryKey: ['transferencias_pendentes', activeSection?.id],
    queryFn: async () => {
      try {
        const all = await db.entities.TransferenciaPendente.list();
        if (!Array.isArray(all)) return [];
        return all.filter(t => {
          if (!t || t.status !== "Pendente") return false;
          // Pedidos da satélite têm conferência detalhada pelo painel de pedidos à central
          if (t.origem === "pedido_satelite" || t.pedido_codigo || t.pedido_id) return false;
          
          if (t.direcao === "para_satelite" && activeSection?.id !== "satelite") return false;
          if (t.direcao === "para_estoque" && activeSection?.id !== "estoque") return false;
          if (t.direcao === "para_carrinho_parada" && activeSection?.id !== "carrinho") return false;
          
          return true;
        });
      } catch (e) {
        console.warn("[TransferenciaAcceptModal] Falha ao carregar transferências pendentes:", e);
        return [];
      }
    },
    refetchInterval: 10000 // poll a cada 10 segundos
  });

  // Sempre que a lista de transferências mudar, pré-seleciona todas por conveniência
  useEffect(() => {
    if (Array.isArray(pendingTransfers) && pendingTransfers.length > 0) {
      setOpen(true);
      setSelectedIds(pendingTransfers.map(t => t.id));
    } else {
      setOpen(false);
      setSelectedIds([]);
    }
  }, [pendingTransfers]);

  const [isProcessing, setIsProcessing] = useState(false);

  const executeSingleTransfer = async (transfer, action) => {
    if (!transfer || !transfer.id) return;

    // Proteção Atômica: Confere se o registro no banco de dados ainda é 'Pendente'
    // Evita duplicar saldo caso o modal execute duas vezes ou haja duplo clique
    const freshTransfer = await db.entities.TransferenciaPendente.get(transfer.id).catch(() => null);
    if (!freshTransfer || freshTransfer.status !== "Pendente") {
      console.warn(`[TransferenciaAcceptModal] Transferência ${transfer.id} já processada ou não pendente (${freshTransfer?.status}). Ignorando.`);
      return;
    }

    const nowIso = format(new Date(), "yyyy-MM-dd'T'HH:mm:ssXXX");

    // Marca imediatamente o status no banco para evitar que concorrência processe ao mesmo tempo
    await db.entities.TransferenciaPendente.update(transfer.id, {
      status: action === "accept" ? "Aceito" : "Recusado",
      data_aceite: nowIso
    });

    const med = await db.entities.Medicamento.get(transfer.medicamento_id);
    const lote = transfer.lote_id ? await db.entities.Lote.get(transfer.lote_id).catch(() => null) : null;

    if (action === "accept") {
      if (transfer.direcao === "para_satelite") {
        if (med) {
          await db.entities.Medicamento.update(med.id, {
            estoque_satelite: (Number(med.estoque_satelite) || 0) + Number(transfer.quantidade)
          });
        }
        if (lote) {
          await db.entities.Lote.update(lote.id, {
            quantidade_satelite: (Number(lote.quantidade_satelite) || 0) + Number(transfer.quantidade)
          });
        }
        await db.entities.Saida.create({
          medicamento_id: med?.id || transfer.medicamento_id,
          medicamento_nome: med?.nome || transfer.medicamento_nome,
          lote_id: lote?.id || transfer.lote_id || null,
          numero_lote: lote?.numero_lote || transfer.numero_lote || "",
          data_saida: nowIso,
          quantidade: transfer.quantidade,
          destino: "Farmácia Satélite",
          motivo: "Transferência de Estoque",
          tipo: "transferencia_central",
          observacao: `Transferência aceita no posto Satélite (Reg: ${transfer.id})`
        });
        await db.logAction(
          "TRANSFERENCIA_ESTOQUE_ACEITA",
          "TransferenciaPendente",
          transfer.id,
          `Transferência de ${transfer.quantidade} un do medicamento '${med?.nome || transfer.medicamento_nome}' (Lote: ${lote?.numero_lote || transfer.numero_lote || 'N/I'}) aceita para Farmácia Satélite.`
        );
      } else if (transfer.direcao === "para_estoque") {
        if (med) {
          await db.entities.Medicamento.update(med.id, {
            estoque_atual: (Number(med.estoque_atual) || 0) + Number(transfer.quantidade),
            estoque_satelite: Math.max(0, (Number(med.estoque_satelite) || 0) - Number(transfer.quantidade))
          });
        }
        if (lote) {
          await db.entities.Lote.update(lote.id, {
            quantidade_atual: (Number(lote.quantidade_atual) || 0) + Number(transfer.quantidade),
            quantidade_satelite: Math.max(0, (Number(lote.quantidade_satelite) || 0) - Number(transfer.quantidade)),
            status: "disponivel"
          });
        }
        await db.entities.Saida.create({
          medicamento_id: med?.id || transfer.medicamento_id,
          medicamento_nome: med?.nome || transfer.medicamento_nome,
          lote_id: lote?.id || transfer.lote_id || null,
          numero_lote: lote?.numero_lote || transfer.numero_lote || "",
          data_saida: nowIso,
          quantidade: transfer.quantidade,
          destino: "Estoque Geral",
          motivo: "Transferência de Estoque",
          tipo: "devolucao_satelite",
          observacao: "Devolvido da Farmácia Satélite para o Estoque Geral"
        });
        await db.logAction(
          "TRANSFERENCIA_ESTOQUE_ACEITA",
          "TransferenciaPendente",
          transfer.id,
          `Devolução de ${transfer.quantidade} un do medicamento '${med?.nome || transfer.medicamento_nome}' (Lote: ${lote?.numero_lote || transfer.numero_lote || 'N/I'}) aceita para Estoque Geral.`
        );
      } else if (transfer.direcao === "para_carrinho_parada") {
        const centralStock = await db.entities.CarrinhoEstoqueCentral.list();
        const existingCentral = centralStock.find(c => c.medicamento_id === med?.id && c.lote_id === (lote?.id || transfer.lote_id));
        
        if (existingCentral) {
          await db.entities.CarrinhoEstoqueCentral.update(existingCentral.id, {
            quantidade: (existingCentral.quantidade || 0) + transfer.quantidade
          });
        } else {
          await db.entities.CarrinhoEstoqueCentral.create({
            medicamento_id: med?.id || transfer.medicamento_id,
            medicamento_nome: med?.nome || transfer.medicamento_nome,
            lote_id: lote?.id || transfer.lote_id || null,
            numero_lote: lote?.numero_lote || transfer.numero_lote || "",
            data_validade: lote?.data_validade || null,
            quantidade: transfer.quantidade
          });
        }
        
        await db.entities.CarrinhoMovimentacao.create({
          tipo: 'transferencia_central',
          medicamento_id: med?.id || transfer.medicamento_id,
          medicamento_nome: med?.nome || transfer.medicamento_nome,
          lote_id: lote?.id || transfer.lote_id || null,
          numero_lote: lote?.numero_lote || transfer.numero_lote || "",
          quantidade: transfer.quantidade,
          responsavel: "Sistema - Transferência de Estoque",
          observacao: "Transferido do Estoque Geral para o Centro de Distribuição dos Carrinhos"
        });
        await db.entities.Saida.create({
          medicamento_id: med?.id || transfer.medicamento_id,
          medicamento_nome: med?.nome || transfer.medicamento_nome,
          lote_id: lote?.id || transfer.lote_id || null,
          numero_lote: lote?.numero_lote || transfer.numero_lote || "",
          data_saida: nowIso,
          quantidade: transfer.quantidade,
          destino: "Carrinho de Parada (Estoque Central)",
          motivo: "Transferência de Estoque",
          tipo: "transferencia_carrinho",
          observacao: "Transferido do Estoque Geral para o Centro de Distribuição dos Carrinhos de Parada"
        });
      }
    } else if (action === "reject") {
      // Rollback deduction
      if (transfer.direcao === "para_satelite" || transfer.direcao === "para_carrinho_parada") {
        if (med) {
          await db.entities.Medicamento.update(med.id, {
            estoque_atual: (Number(med.estoque_atual) || 0) + Number(transfer.quantidade)
          });
        }
        if (lote) {
          await db.entities.Lote.update(lote.id, {
            quantidade_atual: (Number(lote.quantidade_atual) || 0) + Number(transfer.quantidade),
            status: "disponivel"
          });
        }
      } else if (transfer.direcao === "para_estoque") {
        if (med) {
          await db.entities.Medicamento.update(med.id, {
            estoque_satelite: (Number(med.estoque_satelite) || 0) + Number(transfer.quantidade)
          });
        }
      }
    }
  };

  const processBatchMutation = useMutation({
    mutationFn: async ({ transfersToProcess, action }) => {
      setIsProcessing(true);
      let count = 0;
      const seenIds = new Set();
      for (const t of transfersToProcess) {
        if (!t || !t.id || seenIds.has(t.id)) continue;
        seenIds.add(t.id);
        await executeSingleTransfer(t, action);
        count++;
      }
      return { count, action };
    },
    onSuccess: ({ count, action }) => {
      setSelectedIds([]);
      setIsProcessing(false);
      queryClient.invalidateQueries();
      toast.success(
        action === "accept"
          ? `${count} transferência(s) aceita(s) com sucesso e adicionadas ao estoque!`
          : `${count} transferência(s) recusada(s) e devolvidas!`
      );
    },
    onError: (err) => {
      setIsProcessing(false);
      queryClient.invalidateQueries();
      toast.error("Erro ao processar transferências: " + (err.message || err));
    }
  });

  const handleToggleSelectAll = () => {
    if (selectedIds.length === pendingTransfers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingTransfers.map(t => t.id));
    }
  };

  const handleToggleOne = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleAcceptSelected = () => {
    const list = pendingTransfers.filter(t => selectedIds.includes(t.id));
    if (list.length === 0) {
      toast.warning("Selecione ao menos uma transferência para aceitar.");
      return;
    }
    processBatchMutation.mutate({ transfersToProcess: list, action: "accept" });
  };

  const handleRejectSelected = () => {
    const list = pendingTransfers.filter(t => selectedIds.includes(t.id));
    if (list.length === 0) {
      toast.warning("Selecione ao menos uma transferência para recusar.");
      return;
    }
    processBatchMutation.mutate({ transfersToProcess: list, action: "reject" });
  };

  if (pendingTransfers.length === 0) return null;

  const isAllSelected = pendingTransfers.length > 0 && selectedIds.length === pendingTransfers.length;
  const isPending = processBatchMutation.isPending || isProcessing;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-6 rounded-2xl shadow-2xl">
        <DialogHeader className="border-b pb-3.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500 animate-ping inline-block" />
                Transferências Pendentes de Aceite
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Existem <strong>{pendingTransfers.length}</strong> transferência(s) aguardando sua confirmação no estoque.
              </DialogDescription>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                {selectedIds.length} de {pendingTransfers.length} selecionados
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* Barra de Ações em Lote */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-center justify-between gap-3 mt-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleToggleSelectAll}
              disabled={isPending}
              className="text-xs h-8 font-semibold text-slate-700 bg-white"
            >
              {isAllSelected ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
                  Desmarcar Todos
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                  Selecionar Todos ({pendingTransfers.length})
                </>
              )}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending || selectedIds.length === 0}
              onClick={handleRejectSelected}
              className="text-xs h-8 text-rose-600 border-rose-200 hover:bg-rose-50 font-semibold"
            >
              <XCircle className="w-3.5 h-3.5 mr-1.5 text-rose-500" />
              Recusar ({selectedIds.length})
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={isPending || selectedIds.length === 0}
              onClick={handleAcceptSelected}
              className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs px-3.5"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
                  Aceitar Selecionados ({selectedIds.length})
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Tabela de Transferências */}
        <div className="flex-1 overflow-y-auto mt-3 border rounded-xl shadow-xs">
          <Table>
            <TableHeader className="bg-slate-100/80 sticky top-0 z-10 text-xs">
              <TableRow>
                <TableHead className="w-12 text-center">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={handleToggleSelectAll}
                    disabled={isPending}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    title="Selecionar / Desmarcar todos"
                  />
                </TableHead>
                <TableHead className="font-bold text-slate-700">Medicamento</TableHead>
                <TableHead className="font-bold text-slate-700">Lote</TableHead>
                <TableHead className="font-bold text-slate-700 text-center">Quantidade</TableHead>
                <TableHead className="font-bold text-slate-700">Destino</TableHead>
                <TableHead className="text-right font-bold text-slate-700">Ações Individuais</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="text-xs">
              {pendingTransfers.map((t) => {
                const isSelected = selectedIds.includes(t.id);
                return (
                  <TableRow 
                    key={t.id} 
                    className={`transition-colors ${isSelected ? "bg-indigo-50/40" : "hover:bg-slate-50/60"}`}
                  >
                    <TableCell className="text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleOne(t.id)}
                        disabled={isPending}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </TableCell>
                    <TableCell className="font-bold text-slate-800">
                      {t.medicamento_nome}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-slate-700 font-semibold text-[11px]">
                        {t.numero_lote || "S/ Lote"}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 text-[11px]">
                        +{t.quantidade} un
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-[11px] font-semibold text-slate-600">
                        {t.direcao === "para_satelite" && "Farmácia Satélite"}
                        {t.direcao === "para_estoque" && "Estoque Central"}
                        {t.direcao === "para_carrinho_parada" && "Carrinho de Parada"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right space-x-1.5">
                      <Button 
                        size="sm" 
                        variant="ghost"
                        className="h-7 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 font-semibold"
                        onClick={() => processBatchMutation.mutate({ transfersToProcess: [t], action: "reject" })}
                        disabled={isPending}
                      >
                        Recusar
                      </Button>
                      <Button 
                        size="sm"
                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        onClick={() => processBatchMutation.mutate({ transfersToProcess: [t], action: "accept" })}
                        disabled={isPending}
                      >
                        Aceitar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
