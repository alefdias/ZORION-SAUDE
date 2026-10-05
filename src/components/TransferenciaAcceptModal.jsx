import { useState, useEffect } from "react";
import { db } from "@/api/db";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export function TransferenciaAcceptModal({ activeSection }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

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
    refetchInterval: 10000 // poll every 10 seconds
  });

  useEffect(() => {
    if (Array.isArray(pendingTransfers) && pendingTransfers.length > 0) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [pendingTransfers]);

  const processTransfer = useMutation({
    mutationFn: async ({ transfer, action }) => {
      const med = await db.entities.Medicamento.get(transfer.medicamento_id);
      const lote = await db.entities.Lote.get(transfer.lote_id);

      if (action === "accept") {
        if (transfer.direcao === "para_satelite") {
          await db.entities.Medicamento.update(med.id, {
            estoque_satelite: (med.estoque_satelite || 0) + transfer.quantidade
          });
          await db.entities.Saida.create({
            medicamento_id: med.id,
            medicamento_nome: med.nome,
            lote_id: lote.id,
            numero_lote: lote.numero_lote,
            data_saida: format(new Date(), "yyyy-MM-dd'T'HH:mm:ssXXX"),
            quantidade: transfer.quantidade,
            destino: "Farmácia Satélite",
            motivo: "Transferência de Estoque",
            observacao: "Transferido do Estoque Geral para Farmácia Satélite"
          });
          await db.logAction(
            "TRANSFERENCIA_ESTOQUE_ACEITA",
            "TransferenciaPendente",
            transfer.id,
            `Transferência de ${transfer.quantidade} un do medicamento '${med.nome}' (Lote: ${lote.numero_lote}) aceita para Farmácia Satélite.`
          );
        } else if (transfer.direcao === "para_estoque") {
          await db.entities.Medicamento.update(med.id, {
            estoque_atual: (med.estoque_atual || 0) + transfer.quantidade
          });
          await db.entities.Lote.update(lote.id, {
            quantidade_atual: lote.quantidade_atual + transfer.quantidade,
            status: "disponivel"
          });
          await db.entities.Saida.create({
            medicamento_id: med.id,
            medicamento_nome: med.nome,
            lote_id: lote.id,
            numero_lote: lote.numero_lote,
            data_saida: format(new Date(), "yyyy-MM-dd'T'HH:mm:ssXXX"),
            quantidade: transfer.quantidade,
            destino: "Estoque Geral",
            motivo: "Transferência de Estoque",
            observacao: "Devolvido da Farmácia Satélite para o Estoque Geral"
          });
          await db.logAction(
            "TRANSFERENCIA_ESTOQUE_ACEITA",
            "TransferenciaPendente",
            transfer.id,
            `Devolução de ${transfer.quantidade} un do medicamento '${med.nome}' (Lote: ${lote.numero_lote}) aceita para Estoque Geral.`
          );
        } else if (transfer.direcao === "para_carrinho_parada") {
          const centralStock = await db.entities.CarrinhoEstoqueCentral.list();
          const existingCentral = centralStock.find(c => c.medicamento_id === med.id && c.lote_id === lote.id);
          
          if (existingCentral) {
             await db.entities.CarrinhoEstoqueCentral.update(existingCentral.id, {
               quantidade: (existingCentral.quantidade || 0) + transfer.quantidade
             });
          } else {
             await db.entities.CarrinhoEstoqueCentral.create({
               medicamento_id: med.id,
               medicamento_nome: med.nome,
               lote_id: lote.id,
               numero_lote: lote.numero_lote,
               data_validade: lote.data_validade,
               quantidade: transfer.quantidade
             });
          }
          
          await db.entities.CarrinhoMovimentacao.create({
               tipo: 'transferencia_central',
               medicamento_id: med.id,
               medicamento_nome: med.nome,
               lote_id: lote.id,
               numero_lote: lote.numero_lote,
               quantidade: transfer.quantidade,
               responsavel: "Sistema - Transferência de Estoque",
               observacao: "Transferido do Estoque Geral para o Centro de Distribuição dos Carrinhos"
          });
          await db.entities.Saida.create({
            medicamento_id: med.id,
            medicamento_nome: med.nome,
            lote_id: lote.id,
            numero_lote: lote.numero_lote,
            data_saida: format(new Date(), "yyyy-MM-dd'T'HH:mm:ssXXX"),
            quantidade: transfer.quantidade,
            destino: "Carrinho de Parada (Estoque Central)",
            motivo: "Transferência de Estoque",
            observacao: "Transferido do Estoque Geral para o Centro de Distribuição dos Carrinhos de Parada"
          });
        }
        await db.entities.TransferenciaPendente.update(transfer.id, {
            status: "Aceito",
            data_aceite: format(new Date(), "yyyy-MM-dd'T'HH:mm:ssXXX")
        });
      } else if (action === "reject") {
        // Rollback deduction
        if (transfer.direcao === "para_satelite" || transfer.direcao === "para_carrinho_parada") {
          await db.entities.Medicamento.update(med.id, {
            estoque_atual: (med.estoque_atual || 0) + transfer.quantidade
          });
          await db.entities.Lote.update(lote.id, {
            quantidade_atual: lote.quantidade_atual + transfer.quantidade,
            status: "disponivel"
          });
        } else if (transfer.direcao === "para_estoque") {
          await db.entities.Medicamento.update(med.id, {
            estoque_satelite: (med.estoque_satelite || 0) + transfer.quantidade
          });
        }
        await db.entities.TransferenciaPendente.update(transfer.id, {
            status: "Recusado",
            data_aceite: format(new Date(), "yyyy-MM-dd'T'HH:mm:ssXXX")
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    }
  });

  if (pendingTransfers.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-red-600">Transferências Pendentes de Aceite</DialogTitle>
          <DialogDescription>
            Existem {pendingTransfers.length} transferência(s) aguardando sua confirmação.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto mt-4 border rounded-md">
          <Table>
            <TableHeader className="bg-slate-50 sticky top-0 z-10">
              <TableRow>
                <TableHead>Medicamento</TableHead>
                <TableHead>Lote</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingTransfers.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.medicamento_nome}</TableCell>
                  <TableCell>{t.numero_lote}</TableCell>
                  <TableCell>{t.quantidade}</TableCell>
                  <TableCell>
                    {t.direcao === "para_satelite" && "Farmácia Satélite"}
                    {t.direcao === "para_estoque" && "Estoque Central"}
                    {t.direcao === "para_carrinho_parada" && "Carrinho de Parada"}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => processTransfer.mutate({ transfer: t, action: "reject" })}
                      disabled={processTransfer.isPending}
                    >
                      Recusar
                    </Button>
                    <Button 
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => processTransfer.mutate({ transfer: t, action: "accept" })}
                      disabled={processTransfer.isPending}
                    >
                      Aceitar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
