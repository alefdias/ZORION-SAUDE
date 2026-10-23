import { useState } from "react";
import { db } from "@/api/db";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ComboboxMedicamento } from "@/components/ui/combobox-medicamento";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Trash2, ShieldAlert, ArrowLeftRight } from "lucide-react";
import { format } from "date-fns";
import { safeFormatDate } from "@/utils/dateUtils";
import { toast } from "sonner";

export default function TransferenciaEstoque() {
  const queryClient = useQueryClient();

  const [transferenciaForm, setTransferenciaForm] = useState({
    direcao: "para_satelite",
    medicamento_id: "",
    lote_id: "",
    quantidade: ""
  });

  const [deleteTransferenciaModal, setDeleteTransferenciaModal] = useState(null);
  const [deleteTransferenciaMotivo, setDeleteTransferenciaMotivo] = useState("");

  const { data: medicamentos = [] } = useQuery({
    queryKey: ['medicamentos'],
    queryFn: () => db.entities.Medicamento.list(),
  });

  const { data: lotes = [] } = useQuery({
    queryKey: ['lotes'],
    queryFn: () => db.entities.Lote.list(),
  });

  const { data: transferenciasPendentes = [] } = useQuery({
    queryKey: ['transferencias'],
    queryFn: () => db.entities.TransferenciaPendente.list('-data_solicitacao'),
  });

  const handleTransferenciaChange = (field, value) => {
    setTransferenciaForm(prev => {
      const updated = { ...prev, [field]: value };
      if (field === "medicamento_id" || field === "direcao") {
        updated.lote_id = "";
      }
      return updated;
    });
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
        await db.entities.Lote.update(lote.id, {
          quantidade_atual: lote.quantidade_atual - qtd,
          status: (lote.quantidade_atual - qtd) <= 0 ? "esgotado" : lote.status
        });
        await db.entities.Medicamento.update(med.id, {
          estoque_atual: Math.max(0, (med.estoque_atual || 0) - qtd)
        });

        await db.entities.TransferenciaPendente.create({
          medicamento_id: med.id,
          medicamento_nome: med.nome,
          lote_id: lote.id,
          numero_lote: lote.numero_lote,
          quantidade: qtd,
          direcao: "para_satelite",
          status: "Pendente",
          origem: "transferencia_manual",
          data_solicitacao: format(new Date(), "yyyy-MM-dd'T'HH:mm:ssXXX")
        });

      } else if (transferenciaForm.direcao === "para_carrinho_parada") {
        if (!lote || lote.quantidade_atual < qtd) {
          throw new Error("Estoque insuficiente no lote selecionado");
        }
        await db.entities.Lote.update(lote.id, {
          quantidade_atual: lote.quantidade_atual - qtd,
          status: (lote.quantidade_atual - qtd) <= 0 ? "esgotado" : lote.status
        });
        await db.entities.Medicamento.update(med.id, {
          estoque_atual: Math.max(0, (med.estoque_atual || 0) - qtd)
        });

        await db.entities.TransferenciaPendente.create({
          medicamento_id: med.id,
          medicamento_nome: med.nome,
          lote_id: lote.id,
          numero_lote: lote.numero_lote,
          quantidade: qtd,
          direcao: "para_carrinho_parada",
          status: "Pendente",
          origem: "transferencia_manual",
          data_solicitacao: format(new Date(), "yyyy-MM-dd'T'HH:mm:ssXXX")
        });

      } else {
        if ((med.estoque_satelite || 0) < qtd) {
          throw new Error("Estoque insuficiente na satélite");
        }
        await db.entities.Medicamento.update(med.id, {
          estoque_satelite: Math.max(0, (med.estoque_satelite || 0) - qtd)
        });

        await db.entities.TransferenciaPendente.create({
          medicamento_id: med.id,
          medicamento_nome: med.nome,
          lote_id: lote.id,
          numero_lote: lote.numero_lote,
          quantidade: qtd,
          direcao: "para_estoque",
          status: "Pendente",
          origem: "transferencia_manual",
          data_solicitacao: format(new Date(), "yyyy-MM-dd'T'HH:mm:ssXXX")
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      queryClient.invalidateQueries({ queryKey: ['transferencias'] });
      queryClient.invalidateQueries({ queryKey: ['transferencias_pendentes'] });
      queryClient.invalidateQueries({ queryKey: ['saidas'] });
      toast.success("Transferência realizada com sucesso!");
      setTransferenciaForm(prev => ({ ...prev, medicamento_id: "", lote_id: "", quantidade: "" }));
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao realizar transferência");
    }
  });

  const deleteTransferenciaMutation = useMutation({
    mutationFn: async ({ transferencia, motivo }) => {
      // Obter dados frescos e atualizados diretamente do banco
      const freshMed = await db.entities.Medicamento.get(transferencia.medicamento_id).catch(() => null);
      const freshLote = transferencia.lote_id ? await db.entities.Lote.get(transferencia.lote_id).catch(() => null) : null;
      const qtd = Number(transferencia.quantidade) || 0;
      const isAccepted = transferencia.status === "Aceito" || transferencia.status === "aceito";

      if (transferencia.direcao === "para_satelite") {
        // Se já havia sido aceita na Satélite, o estoque_satelite foi incrementado.
        // Ao cancelar a transferência, DEVE debitar da Satélite e devolver para a Central!
        if (isAccepted) {
          if (freshMed) {
            await db.entities.Medicamento.update(freshMed.id, {
              estoque_satelite: Math.max(0, (Number(freshMed.estoque_satelite) || 0) - qtd),
              estoque_atual: (Number(freshMed.estoque_atual) || 0) + qtd
            });
          }
          if (freshLote) {
            const novoQtdLote = (Number(freshLote.quantidade_atual) || 0) + qtd;
            await db.entities.Lote.update(freshLote.id, {
              quantidade_atual: novoQtdLote,
              status: novoQtdLote > 0 ? "disponivel" : freshLote.status
            });
          }
        } else {
          // Se ainda estava pendente (não aceita), apenas estorna a dedução que havia sido feita na Central
          if (freshLote) {
            const novoQtdLote = (Number(freshLote.quantidade_atual) || 0) + qtd;
            await db.entities.Lote.update(freshLote.id, {
              quantidade_atual: novoQtdLote,
              status: novoQtdLote > 0 ? "disponivel" : freshLote.status
            });
          }
          if (freshMed) {
            await db.entities.Medicamento.update(freshMed.id, {
              estoque_atual: (Number(freshMed.estoque_atual) || 0) + qtd
            });
          }
        }
      } else if (transferencia.direcao === "para_carrinho_parada") {
        // Para carrinho de parada, se foi aceita, remove do carrinho; de qualquer forma estorna na Central
        if (freshLote) {
          const novoQtdLote = (Number(freshLote.quantidade_atual) || 0) + qtd;
          await db.entities.Lote.update(freshLote.id, {
            quantidade_atual: novoQtdLote,
            status: novoQtdLote > 0 ? "disponivel" : freshLote.status
          });
        }
        if (freshMed) {
          await db.entities.Medicamento.update(freshMed.id, {
            estoque_atual: (Number(freshMed.estoque_atual) || 0) + qtd
          });
        }
      } else {
        // direcao === 'para_estoque' (devolução da Satélite para a Central)
        if (isAccepted) {
          // Já havia entrado na Central: estorna da Central e devolve à Satélite
          if (freshMed) {
            await db.entities.Medicamento.update(freshMed.id, {
              estoque_atual: Math.max(0, (Number(freshMed.estoque_atual) || 0) - qtd),
              estoque_satelite: (Number(freshMed.estoque_satelite) || 0) + qtd
            });
          }
          if (freshLote) {
            const novoQtdLote = Math.max(0, (Number(freshLote.quantidade_atual) || 0) - qtd);
            await db.entities.Lote.update(freshLote.id, {
              quantidade_atual: novoQtdLote,
              status: novoQtdLote > 0 ? freshLote.status : "esgotado"
            });
          }
        } else {
          // Estava pendente: a Satélite havia sido debitada na criação, então restaura o estoque da Satélite
          if (freshMed) {
            await db.entities.Medicamento.update(freshMed.id, {
              estoque_satelite: (Number(freshMed.estoque_satelite) || 0) + qtd
            });
          }
        }
      }

      await db.entities.TransferenciaPendente.delete(transferencia.id);

      await db.logAction(
        "TRANSFERENCIA_CANCELADA",
        "TransferenciaPendente",
        transferencia.id,
        `Transferência de ${transferencia.quantidade} un de '${transferencia.medicamento_nome}' cancelada e revertida para o estoque de origem. Motivo: ${motivo}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transferencias'] });
      queryClient.invalidateQueries({ queryKey: ['transferencias_pendentes'] });
      queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      queryClient.invalidateQueries({ queryKey: ['saidas'] });
      setDeleteTransferenciaModal(null);
      setDeleteTransferenciaMotivo("");
      toast.success("Transferência cancelada e revertida com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao cancelar transferência: " + (error.message || error));
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
  const historicoTransferencias = transferenciasPendentes;

  return (
    <div className="space-y-6">
      <Card className="max-w-2xl mx-auto p-6 space-y-6 shadow-sm border-0 bg-white dark:bg-slate-900">
        <div>
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Transferência de Estoque</h2>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Mova itens entre o estoque geral, a farmácia satélite e o carrinho de parada
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
            <Button
              type="button"
              variant={transferenciaForm.direcao === "para_satelite" ? "default" : "ghost"}
              className={transferenciaForm.direcao === "para_satelite" ? "bg-blue-600 text-white w-full shadow-sm" : "w-full text-slate-600 dark:text-slate-300"}
              onClick={() => handleTransferenciaChange("direcao", "para_satelite")}
            >
              Para Satélite
            </Button>
            <Button
              type="button"
              variant={transferenciaForm.direcao === "para_carrinho_parada" ? "default" : "ghost"}
              className={transferenciaForm.direcao === "para_carrinho_parada" ? "bg-amber-600 text-white w-full shadow-sm" : "w-full text-slate-600 dark:text-slate-300"}
              onClick={() => handleTransferenciaChange("direcao", "para_carrinho_parada")}
            >
              Para Carrinho Parada
            </Button>
            <Button
              type="button"
              variant={transferenciaForm.direcao === "para_estoque" ? "default" : "ghost"}
              className={transferenciaForm.direcao === "para_estoque" ? "bg-blue-600 text-white w-full shadow-sm" : "w-full text-slate-600 dark:text-slate-300"}
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

      <Card className="max-w-4xl mx-auto p-6 space-y-4 shadow-sm border-0 bg-white dark:bg-slate-900">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Histórico de Transferências</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Últimas transferências realizadas entre estoques</p>
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
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historicoTransferencias.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-6 text-slate-500">
                    Nenhuma transferência registrada
                  </TableCell>
                </TableRow>
              ) : (
                historicoTransferencias.map(t => (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm">{safeFormatDate(t.data_solicitacao || t.created_at)}</TableCell>
                    <TableCell className="font-medium text-slate-800 dark:text-slate-200">{t.medicamento_nome}</TableCell>
                    <TableCell><Badge variant="outline">{t.numero_lote}</Badge></TableCell>
                    <TableCell className="text-center font-bold text-blue-700 dark:text-blue-400">{t.quantidade}</TableCell>
                    <TableCell>
                      <Badge className={
                        t.direcao === "para_satelite" ? "bg-indigo-100 text-indigo-700" :
                        t.direcao === "para_carrinho_parada" ? "bg-amber-100 text-amber-700" :
                        "bg-emerald-100 text-emerald-700"
                      }>
                        {t.direcao === "para_satelite" ? "Farmácia Satélite" :
                         t.direcao === "para_carrinho_parada" ? "Carrinho Parada" :
                         "Estoque Central"}
                      </Badge>
                      {t.pedido_codigo && (
                        <span className="block text-[11px] font-mono text-indigo-600 font-bold mt-1">
                          Pedido: {t.pedido_codigo}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={
                        t.status === 'Pendente' ? 'bg-amber-100 text-amber-700' :
                        t.status === 'Cancelado' ? 'bg-red-100 text-red-700' :
                        'bg-emerald-100 text-emerald-700'
                      }>
                        {t.status === 'Aceito' ? 'Concluída' : (t.status || 'Concluída')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTransferenciaModal(t)}
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Modal de Cancelamento de Transferência */}
      <Dialog open={!!deleteTransferenciaModal} onOpenChange={(open) => !open && setDeleteTransferenciaModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <ShieldAlert className="w-5 h-5" />
              Cancelar Transferência
            </DialogTitle>
            <DialogDescription>
              Você está prestes a excluir/cancelar uma transferência e reverter o estoque para sua origem. Essa ação ficará registrada no log de segurança (Auditoria).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-sm text-red-800">
              <p><strong>Medicamento:</strong> {deleteTransferenciaModal?.medicamento_nome}</p>
              <p><strong>Quantidade:</strong> {deleteTransferenciaModal?.quantidade}</p>
              <p><strong>Lote:</strong> {deleteTransferenciaModal?.numero_lote}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="motivo-exclusao" className="text-slate-700 font-semibold">
                Motivo do Cancelamento <span className="text-red-500">*</span>
              </Label>
              <Input
                id="motivo-exclusao"
                placeholder="Ex: Lançamento duplicado, quantidade incorreta..."
                value={deleteTransferenciaMotivo}
                onChange={(e) => setDeleteTransferenciaMotivo(e.target.value)}
                className="border-slate-300"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTransferenciaModal(null); setDeleteTransferenciaMotivo(""); }}>
              Sair
            </Button>
            <Button
              onClick={() => deleteTransferenciaMutation.mutate({ transferencia: deleteTransferenciaModal, motivo: deleteTransferenciaMotivo })}
              disabled={deleteTransferenciaMutation.isPending || deleteTransferenciaMotivo.trim().length < 5}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
