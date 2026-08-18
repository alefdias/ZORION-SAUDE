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
import { 
  ShoppingCart, 
  PackageCheck, 
  Send, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Building2, 
  Calendar, 
  CheckSquare, 
  Square, 
  Truck,
  Eye,
  Search,
  Filter,
  Package,
  Layers,
  ArrowRight
} from "lucide-react";

export function PedidosSateliteManager({ mode = "satelite" }) {
  // mode can be "satelite" or "central"
  const queryClient = useQueryClient();

  // State for order creation (satelite)
  const [selectedAlaId, setSelectedAlaId] = useState("all");
  const [diasCalculo, setDiasCalculo] = useState(1);
  const [customDias, setCustomDias] = useState("");
  const [customQuantities, setCustomQuantities] = useState({}); // medId -> custom quantity
  const [observacaoPedido, setObservacaoPedido] = useState("");

  // State for order view modal
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

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
    refetchInterval: 4000 // Real-time sync every 4s
  });

  // Effective days count
  const effectiveDays = useMemo(() => {
    if (diasCalculo === "custom") {
      const parsed = parseInt(customDias, 10);
      return isNaN(parsed) || parsed < 1 ? 1 : parsed;
    }
    return Number(diasCalculo) || 1;
  }, [diasCalculo, customDias]);

  // Calculation of medication needs per selected Ala and Days
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

    return Object.values(medMap).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [prescricoes, pacientes, medicamentos, selectedAlaId, alas, effectiveDays]);

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
          : item.qtdCalculada;

        return {
          medicamento_id: item.medicamentoId,
          medicamento_nome: item.nome,
          codigo: item.codigo,
          concentracao: item.concentracao,
          apresentacao: item.apresentacao,
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
      const novoPedido = {
        id: pedidoId,
        codigo: `PED-${timestampCode}`,
        ala_id: selectedAlaId,
        ala_nome: alaNomeStr,
        dias_calculados: effectiveDays,
        solicitante: "Farmácia Satélite",
        data_solicitacao: new Date().toISOString(),
        status: "Pendente",
        itens_json: JSON.stringify(itens),
        observacao: observacaoPedido || "",
        created_at: new Date().toISOString()
      };

      await db.entities.PedidoSatelite.create(novoPedido);
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

  // Modal Action Mutation (Separar, Entregar, Conferir/Receber)
  const updatePedidoMutation = useMutation({
    mutationFn: async ({ pedido, newStatus, updatedItens, actionType }) => {
      const payload = {
        status: newStatus,
        itens_json: JSON.stringify(updatedItens)
      };

      if (newStatus === "Separado") {
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
      const { newStatus } = variables;
      if (newStatus === "Em Separação") toast.info("Pedido marcado em separação.");
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
                Calcule a necessidade de medicamentos fixos por Ala e Período para reposição do estoque satélite.
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Selector de Ala */}
              <div className="w-[200px]">
                <Label className="text-[11px] text-slate-500 font-semibold mb-1 block">Ala / Setor</Label>
                <Select value={selectedAlaId} onValueChange={setSelectedAlaId}>
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

              {/* Selector de Período de Dias */}
              <div>
                <Label className="text-[11px] text-slate-500 font-semibold mb-1 block">Dias de Suprimento</Label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 5, 7, 10].map(d => (
                    <Button
                      key={d}
                      size="sm"
                      variant={diasCalculo === d ? "default" : "outline"}
                      onClick={() => setDiasCalculo(d)}
                      className={cn("h-9 text-xs px-2.5", diasCalculo === d && "bg-blue-600 font-bold")}
                    >
                      {d}D
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant={diasCalculo === "custom" ? "default" : "outline"}
                    onClick={() => setDiasCalculo("custom")}
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
                      onChange={(e) => setCustomDias(e.target.value)}
                      className="w-16 h-9 text-xs"
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tabela de Cálculo da Necessidade */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-blue-600" />
                Itens Necessários para {effectiveDays} Dia(s) ({calculoNecessidade.length} medicamentos)
              </span>

              {calculoNecessidade.length > 0 && (
                <Button
                  onClick={() => criarPedidoMutation.mutate()}
                  disabled={criarPedidoMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 shadow-md"
                >
                  <Send className="w-4 h-4" />
                  {criarPedidoMutation.isPending ? "Enviando..." : "Fazer Pedido à Central"}
                </Button>
              )}
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-100 dark:bg-slate-800">
                  <TableRow>
                    <TableHead className="w-16">Cód</TableHead>
                    <TableHead>Medicamento / Concentração</TableHead>
                    <TableHead className="text-center">Consumo Diário (1D)</TableHead>
                    <TableHead className="text-center bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300 font-bold">
                      Calculado ({effectiveDays} Dias)
                    </TableHead>
                    <TableHead className="text-center w-36">Quantidade a Pedir</TableHead>
                    <TableHead className="text-center">Estoque Satélite</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calculoNecessidade.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-slate-500">
                        Nenhuma necessidade calculada para esta Ala e Período.
                      </TableCell>
                    </TableRow>
                  ) : (
                    calculoNecessidade.map(item => {
                      const currentVal = customQuantities[item.medicamentoId] !== undefined 
                        ? customQuantities[item.medicamentoId] 
                        : item.qtdCalculada;

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
                          <TableCell className="text-center font-mono font-black text-blue-700 dark:text-blue-400 text-base bg-blue-50/30 dark:bg-blue-950/20">
                            {item.qtdCalculada} un
                          </TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              min="1"
                              value={currentVal}
                              onChange={(e) => setCustomQuantities({
                                ...customQuantities,
                                [item.medicamentoId]: e.target.value
                              })}
                              className="w-24 text-center font-bold font-mono mx-auto h-8 text-sm bg-white"
                            />
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold text-slate-600">
                            {item.estoqueSatelite} un
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
                      <TableCell className="font-mono font-bold text-xs text-indigo-600">{p.codigo}</TableCell>
                      <TableCell className="font-semibold text-slate-800">{p.ala_nome}</TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {p.data_solicitacao ? format(new Date(p.data_solicitacao), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"}
                      </TableCell>
                      <TableCell className="text-center font-mono font-bold">{p.dias_calculados}D</TableCell>
                      <TableCell className="text-center font-mono">{itensArr.length} item(s)</TableCell>
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
          onUpdateStatus={(newStatus, updatedItens) => {
            updatePedidoMutation.mutate({
              pedido: selectedPedido,
              newStatus,
              updatedItens
            });
          }}
          isPending={updatePedidoMutation.isPending}
        />
      )}
    </div>
  );
}

// ─── SUBCOMPONENTE MODAL DE DETALHES & CONFERÊNCIA ───────────────────────────
function OrderDetailsModal({ open, onOpenChange, pedido, mode, onUpdateStatus, isPending }) {
  const [itensState, setItensState] = useState(() => {
    const rawItens = pedido.itens || [];
    return rawItens.map(i => ({
      ...i,
      qtd_recebida: i.qtd_recebida !== undefined ? i.qtd_recebida : i.qtd_atendida
    }));
  });

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
              <DialogDescription className="text-xs">
                Solicitado em {pedido.data_solicitacao ? format(new Date(pedido.data_solicitacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "-"} para {pedido.dias_calculados} dia(s).
              </DialogDescription>
            </div>
            <Badge variant="outline" className="text-sm font-bold">
              Status: {pedido.status}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
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

        <DialogFooter className="border-t pt-3 flex justify-between items-center w-full">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>

          <div className="flex gap-2">
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
      </DialogContent>
    </Dialog>
  );
}
