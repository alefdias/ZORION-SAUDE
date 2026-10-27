import React, { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/api/db";
import { cancelarEstornarBaixaGrupo } from "@/utils/baixaEstoqueService";
import { validarSenhaUsuario } from "@/utils/authUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  RotateCcw,
  Search,
  AlertTriangle,
  Calendar,
  User,
  Package,
  Layers,
  ChevronDown,
  ChevronUp,
  Lock,
  Trash2,
  CheckCircle2,
} from "lucide-react";

export default function CancelarBaixaModal({ open, onOpenChange, onSuccess }) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedGrupoId, setExpandedGrupoId] = useState(null);
  const [grupoSelecionadoParaEstorno, setGrupoSelecionadoParaEstorno] = useState(null);
  const [senhaInput, setSenhaInput] = useState("");
  const [senhaError, setSenhaError] = useState("");
  const [validandoSenha, setValidandoSenha] = useState(false);

  // Buscar saídas
  const { data: saidas = [], isLoading } = useQuery({
    queryKey: ["saidas"],
    queryFn: () => db.entities.Saida.list("-created_at"),
    enabled: open,
  });

  // Agrupar saídas por baixa_grupo_id ou por assinatura temporal (para baixas sem grupo gravado)
  const gruposBaixa = useMemo(() => {
    // Filtrar apenas saídas de dispensação de pacientes ou com baixa_grupo_id
    const saidasDispensacao = saidas.filter(
      (s) =>
        s.is_baixa_lote_paciente ||
        s.baixa_grupo_id ||
        s.prescricao_id ||
        (s.motivo && s.motivo.toLowerCase().includes("separação")) ||
        (s.motivo && s.motivo.toLowerCase().includes("baixa"))
    );

    const map = new Map();

    saidasDispensacao.forEach((s) => {
      // Chave do grupo: se tem baixa_grupo_id usa ele, senão agrupa por timestamp aprox (minuto) + responsável
      let grupoKey = s.baixa_grupo_id;
      if (!grupoKey) {
        const timePart = s.created_at ? s.created_at.slice(0, 16) : s.data_saida;
        grupoKey = `legado_${timePart}_${s.responsavel || "farmacia"}`;
      }

      if (!map.has(grupoKey)) {
        map.set(grupoKey, {
          id: grupoKey,
          baixa_grupo_id: s.baixa_grupo_id || null,
          dataHora: s.created_at || s.data_saida,
          dataSaida: s.data_saida,
          responsavel: s.responsavel || s.usuario_nome || "Farmacêutico",
          motivo: s.motivo || "Dispensação de Medicamentos",
          itens: [],
          totalQuantidade: 0,
          pacientesNomes: new Set(),
          medicamentosNomes: new Set(),
        });
      }

      const g = map.get(grupoKey);
      g.itens.push(s);
      g.totalQuantidade += Number(s.quantidade) || 0;
      if (s.paciente_nome) g.pacientesNomes.add(s.paciente_nome);
      if (s.medicamento_nome) g.medicamentosNomes.add(s.medicamento_nome);
    });

    return Array.from(map.values())
      .map((g) => ({
        ...g,
        pacientesCount: g.pacientesNomes.size,
        medicamentosCount: g.medicamentosNomes.size,
        pacientesList: Array.from(g.pacientesNomes),
        medicamentosList: Array.from(g.medicamentosNomes),
      }))
      .sort((a, b) => new Date(b.dataHora || 0) - new Date(a.dataHora || 0));
  }, [saidas]);

  // Filtrar grupos por busca
  const gruposFiltrados = useMemo(() => {
    if (!searchTerm.trim()) return gruposBaixa;
    const q = searchTerm.toLowerCase();
    return gruposBaixa.filter((g) => {
      const matchResp = (g.responsavel || "").toLowerCase().includes(q);
      const matchMotivo = (g.motivo || "").toLowerCase().includes(q);
      const matchPac = g.pacientesList.some((p) => p.toLowerCase().includes(q));
      const matchMed = g.medicamentosList.some((m) => m.toLowerCase().includes(q));
      return matchResp || matchMotivo || matchPac || matchMed;
    });
  }, [gruposBaixa, searchTerm]);

  // Mutação para executar o estorno
  const estornarMutation = useMutation({
    mutationFn: async (grupo) => {
      let responsavel = "Farmacêutico";
      try {
        const rawU = localStorage.getItem("pharma_user");
        if (rawU) {
          const u = JSON.parse(rawU);
          responsavel = u.full_name || u.nome || u.login || "Farmacêutico";
        }
      } catch (e) {}

      return await cancelarEstornarBaixaGrupo({
        baixaGrupoId: grupo.baixa_grupo_id,
        saidasDoGrupo: grupo.itens,
        usuarioNome: responsavel,
        motivo: `Cancelamento de baixa solicitado pelo usuário (${grupo.itens.length} itens)`,
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["medicamentos"] });
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      queryClient.invalidateQueries({ queryKey: ["saidas"] });
      queryClient.invalidateQueries({ queryKey: ["prescricoes_paciente"] });
      queryClient.invalidateQueries({ queryKey: ["pacientes"] });
      toast.success(
        `Baixa cancelada com sucesso! ${res.estornadas} saída(s) foram estornadas e o estoque satélite foi devolvido.`
      );
      setGrupoSelecionadoParaEstorno(null);
      setSenhaInput("");
      setSenhaError("");
      if (onSuccess) onSuccess();
    },
    onError: (err) => {
      toast.error(`Erro ao estornar baixa: ${err.message || err}`);
    },
  });

  const handleConfirmarEstornoComSenha = async () => {
    if (!senhaInput.trim()) {
      setSenhaError("Digite a sua senha de usuário para confirmar.");
      return;
    }
    setValidandoSenha(true);
    setSenhaError("");
    try {
      const valida = await validarSenhaUsuario(senhaInput);
      if (!valida) {
        setSenhaError("Senha incorreta! Digite a senha do usuário autenticado.");
        setValidandoSenha(false);
        return;
      }
      setValidandoSenha(false);
      estornarMutation.mutate(grupoSelecionadoParaEstorno);
    } catch (e) {
      setValidandoSenha(false);
      setSenhaError("Erro ao validar senha.");
    }
  };

  const formatDataHoraSafe = (dtStr) => {
    try {
      if (!dtStr) return "-";
      return format(parseISO(dtStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dtStr;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl">
          {/* Header */}
          <div className="bg-rose-600 dark:bg-rose-900 text-white p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-xs">
                <RotateCcw className="w-6 h-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold tracking-wide">
                  Cancelar / Estornar Baixa de Estoque
                </DialogTitle>
                <p className="text-xs text-rose-100 font-medium">
                  Selecione uma dispensação recente para desfazer a baixa, devolver o saldo ao estoque e resetar o ciclo dos pacientes.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="border-white/40 text-white bg-white/10 text-xs px-2.5 py-1">
              {gruposBaixa.length} registro(s) de baixa
            </Badge>
          </div>

          {/* Subheader com Busca e Alerta */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Buscar por paciente, medicamento, responsável ou motivo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9.5 bg-white dark:bg-slate-800 text-xs border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>

            <div className="flex items-start gap-2 p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-800 dark:text-rose-300 text-xs font-medium">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>
                <strong>Atenção:</strong> Ao cancelar uma baixa, todos os medicamentos retornam imediatamente ao estoque da Farmácia Satélite e os lotes físicos são restaurados. O ciclo de cobertura dos pacientes atendidos também será reiniciado.
              </span>
            </div>
          </div>

          {/* Lista de Grupos de Baixa */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isLoading ? (
              <div className="py-12 text-center text-slate-500 text-sm">
                Carregando histórico de baixas...
              </div>
            ) : gruposFiltrados.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-sm">
                Nenhum registro de baixa de estoque encontrado com os filtros atuais.
              </div>
            ) : (
              gruposFiltrados.map((grupo) => {
                const isExpanded = expandedGrupoId === grupo.id;

                return (
                  <div
                    key={grupo.id}
                    className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700 transition-all overflow-hidden"
                  >
                    {/* Header do Card */}
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-blue-600" />
                            {formatDataHoraSafe(grupo.dataHora)}
                          </span>
                          <Badge variant="outline" className="text-[10px] font-mono bg-blue-50 text-blue-700 border-blue-200">
                            {grupo.totalQuantidade} un total
                          </Badge>
                          <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-700">
                            {grupo.medicamentosCount} medicamento(s)
                          </Badge>
                          <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200">
                            {grupo.pacientesCount} paciente(s)
                          </Badge>
                        </div>

                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            Responsável: <strong>{grupo.responsavel}</strong>
                          </span>
                          <span>•</span>
                          <span className="italic">{grupo.motivo}</span>
                        </div>
                      </div>

                      {/* Botões de Ação */}
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedGrupoId(isExpanded ? null : grupo.id)}
                          className="h-8 text-xs text-slate-600 hover:text-slate-900 gap-1"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="w-3.5 h-3.5" /> Menos detalhes
                            </>
                          ) : (
                            <>
                              <ChevronDown className="w-3.5 h-3.5" /> Ver {grupo.itens.length} item(ns)
                            </>
                          )}
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setGrupoSelecionadoParaEstorno(grupo);
                            setSenhaInput("");
                            setSenhaError("");
                          }}
                          disabled={estornarMutation.isPending}
                          className="h-8 text-xs font-bold border-rose-300 text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                          Cancelar Baixa
                        </Button>
                      </div>
                    </div>

                    {/* Detalhes expandidos: lista de itens e pacientes */}
                    {isExpanded && (
                      <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 text-xs space-y-2">
                        <p className="font-bold text-[11px] uppercase tracking-wider text-slate-500">
                          Medicamentos e Pacientes Dispensados nesta Baixa:
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                          {grupo.itens.map((it, idx) => (
                            <div
                              key={it.id || idx}
                              className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between"
                            >
                              <div className="truncate pr-2">
                                <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {it.medicamento_nome}
                                </p>
                                <p className="text-[11px] text-slate-500 truncate">
                                  {it.paciente_nome ? `Paciente: ${it.paciente_nome}` : it.destino || "Dispensado"}
                                  {it.numero_lote ? ` • Lote: ${it.numero_lote}` : ""}
                                </p>
                              </div>
                              <span className="font-bold text-red-600 dark:text-red-400 font-mono shrink-0">
                                -{it.quantidade} un
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="p-3 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between sm:justify-between">
            <span className="text-xs text-slate-500">
              Operações canceladas são registradas na auditoria do sistema.
            </span>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="text-xs">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL DE CONFIRMAÇÃO COM SENHA PARA O ESTORNO ─────────────── */}
      <AlertDialog
        open={!!grupoSelecionadoParaEstorno}
        onOpenChange={(val) => {
          if (!val) {
            setGrupoSelecionadoParaEstorno(null);
            setSenhaInput("");
            setSenhaError("");
          }
        }}
      >
        <AlertDialogContent className="sm:max-w-[460px] rounded-2xl border-slate-200 dark:border-slate-800">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <AlertDialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Confirmar Cancelamento de Baixa
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs text-slate-500">
                  Esta ação estornará {grupoSelecionadoParaEstorno?.totalQuantidade} unidades de medicamento ao estoque da Satélite.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="py-2 space-y-3">
            <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1 font-medium">
              <p>
                <strong>Data da Baixa:</strong> {formatDataHoraSafe(grupoSelecionadoParaEstorno?.dataHora)}
              </p>
              <p>
                <strong>Medicamentos:</strong> {grupoSelecionadoParaEstorno?.medicamentosCount} distintos ({grupoSelecionadoParaEstorno?.totalQuantidade} un)
              </p>
              <p>
                <strong>Pacientes Atendidos:</strong> {grupoSelecionadoParaEstorno?.pacientesCount} paciente(s)
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-rose-600" />
                Digite a sua senha de usuário para autorizar o estorno:
              </label>
              <Input
                type="password"
                placeholder="Sua senha de login..."
                value={senhaInput}
                onChange={(e) => {
                  setSenhaInput(e.target.value);
                  if (senhaError) setSenhaError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleConfirmarEstornoComSenha();
                  }
                }}
                className="h-10 text-center font-mono text-base font-bold"
                autoFocus
              />
              {senhaError && <p className="text-xs text-rose-600 font-bold">{senhaError}</p>}
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={validandoSenha || estornarMutation.isPending}>
              Voltar
            </AlertDialogCancel>
            <Button
              onClick={handleConfirmarEstornoComSenha}
              disabled={validandoSenha || estornarMutation.isPending}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs gap-1.5"
            >
              {validandoSenha || estornarMutation.isPending
                ? "Processando Estorno..."
                : "Confirmar Cancelamento"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
