import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "@/api/db";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { validarSenhaUsuario, getActiveUser } from "@/utils/authUtils";
import { cancelarEstornarBaixaGrupo } from "@/utils/baixaEstoqueService";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Boxes,
  RotateCcw,
  Search,
  Calendar,
  User,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  Layers,
  Users,
  ShieldAlert,
  Lock,
} from "lucide-react";

function safeFormatDate(val, fmt = "dd/MM/yyyy") {
  if (!val) return "-";
  try {
    const s = String(val).split("T")[0];
    const parts = s.split("-");
    if (parts.length === 3) {
      return format(new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)), fmt);
    }
    return format(new Date(val), fmt);
  } catch (e) {
    return String(val);
  }
}

function safeFormatDateTime(val) {
  if (!val) return "-";
  try {
    return format(new Date(val), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch (e) {
    return safeFormatDate(val);
  }
}

export function HistoricoSeparacoesModal({ open, onOpenChange, onSuccess }) {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos"); // "todos" | "concluidas" | "estornadas"
  const [expandedId, setExpandedId] = useState(null);

  // Estados do Modal de Confirmação de Estorno
  const [separacaoParaEstorno, setSeparacaoParaEstorno] = useState(null);
  const [senhaInput, setSenhaInput] = useState("");
  const [senhaError, setSenhaError] = useState("");
  const [validandoSenha, setValidandoSenha] = useState(false);

  // Buscar histórico gravado
  const { data: historicoDb = [], isLoading: loadingHistorico } = useQuery({
    queryKey: ["historico_separacao_consolidada"],
    queryFn: async () => {
      try {
        if (db.entities.HistoricoSeparacaoConsolidada) {
          return await db.entities.HistoricoSeparacaoConsolidada.list("-created_at");
        }
      } catch (e) {
        console.warn("Falha ao listar HistoricoSeparacaoConsolidada:", e);
      }
      return [];
    },
    enabled: open,
  });

  // Buscar saídas para compor detalhes e para agrupar separações legadas
  const { data: saidas = [], isLoading: loadingSaidas } = useQuery({
    queryKey: ["saidas"],
    queryFn: () => db.entities.Saida.list("-created_at"),
    enabled: open,
  });

  // Combinar histórico gravado com eventuais saídas em lote legadas
  const listaConsolidada = useMemo(() => {
    const map = new Map();

    // 1. Inserir registros do HistoricoSeparacaoConsolidada
    (historicoDb || []).forEach((h) => {
      const gId = h.baixa_grupo_id || h.id;
      map.set(gId, {
        id: gId,
        baixa_grupo_id: gId,
        data_separacao: h.data_separacao || (h.created_at ? h.created_at.slice(0, 10) : ""),
        dias_ciclo: h.dias_ciclo || 8,
        data_inicio_cobertura: h.data_inicio_cobertura,
        data_fim_cobertura: h.data_fim_cobertura,
        total_medicamentos: Number(h.total_medicamentos) || 0,
        total_unidades: Number(h.total_unidades) || 0,
        total_pacientes: Number(h.total_pacientes) || 0,
        alas_atendidas: h.alas_atendidas || "Geral",
        responsavel: h.responsavel || "Farmacêutico",
        responsavel_crf: h.responsavel_crf || "",
        status: h.status || "CONCLUIDA",
        created_at: h.created_at,
        revertido_em: h.revertido_em,
        revertido_por: h.revertido_por,
        itens: [],
      });
    });

    // 2. Associar as saídas existentes aos seus respectivos grupos
    (saidas || []).forEach((s) => {
      const gId = s.baixa_grupo_id;
      if (!gId) return;

      if (!map.has(gId)) {
        // Separação anterior que ainda não tinha registro mestre criado
        const isSeparacao =
          s.is_baixa_lote_paciente ||
          (s.motivo && s.motivo.toLowerCase().includes("separação"));

        if (isSeparacao) {
          map.set(gId, {
            id: gId,
            baixa_grupo_id: gId,
            data_separacao: s.data_saida || (s.created_at ? s.created_at.slice(0, 10) : ""),
            dias_ciclo: s.dias_cobertura || 8,
            data_inicio_cobertura: s.data_inicio_cobertura || s.data_saida,
            data_fim_cobertura: s.data_fim_cobertura,
            total_medicamentos: 0,
            total_unidades: 0,
            total_pacientes: 0,
            alas_atendidas: s.ala_nome || "Geral",
            responsavel: s.responsavel || s.usuario_nome || "Farmacêutico",
            responsavel_crf: s.responsavel_crf || "",
            status: "CONCLUIDA",
            created_at: s.created_at,
            itens: [],
          });
        }
      }

      if (map.has(gId)) {
        const entry = map.get(gId);
        entry.itens.push(s);
      }
    });

    // 3. Atualizar contadores calculados reais a partir dos itens presentes
    map.forEach((entry) => {
      if (entry.itens.length > 0) {
        const medsSet = new Set(entry.itens.map((i) => i.medicamento_nome || i.medicamento_id).filter(Boolean));
        const pacsSet = new Set(entry.itens.map((i) => i.paciente_nome || i.paciente_id).filter(Boolean));
        const alasSet = new Set(entry.itens.map((i) => i.ala_nome).filter(Boolean));
        const somaQtd = entry.itens.reduce((acc, i) => acc + (Number(i.quantidade) || 0), 0);

        if (!entry.total_medicamentos) entry.total_medicamentos = medsSet.size;
        if (!entry.total_unidades) entry.total_unidades = somaQtd;
        if (!entry.total_pacientes) entry.total_pacientes = pacsSet.size;
        if (alasSet.size > 0 && entry.alas_atendidas === "Geral") {
          entry.alas_atendidas = Array.from(alasSet).join(", ");
        }
      } else if (entry.status !== "ESTORNADA") {
        // Se não possui nenhuma saída no banco e não tem estorno registrado, pode já ter sido estornado
        entry.status = "ESTORNADA";
      }
    });

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at || b.data_separacao || 0) - new Date(a.created_at || a.data_separacao || 0)
    );
  }, [historicoDb, saidas]);

  // Filtragem por busca e status
  const filtrados = useMemo(() => {
    return listaConsolidada.filter((item) => {
      if (filtroStatus === "concluidas" && item.status === "ESTORNADA") return false;
      if (filtroStatus === "estornadas" && item.status !== "ESTORNADA") return false;

      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();

      const matchData = safeFormatDate(item.data_separacao).includes(q);
      const matchResp = (item.responsavel || "").toLowerCase().includes(q);
      const matchAla = (item.alas_atendidas || "").toLowerCase().includes(q);
      const matchItens = item.itens.some(
        (i) =>
          (i.medicamento_nome || "").toLowerCase().includes(q) ||
          (i.paciente_nome || "").toLowerCase().includes(q) ||
          (i.numero_lote || "").toLowerCase().includes(q)
      );

      return matchData || matchResp || matchAla || matchItens;
    });
  }, [listaConsolidada, filtroStatus, searchTerm]);

  // Mutação para reverter toda a separação em lote
  const reverterMutation = useMutation({
    mutationFn: async (separacao) => {
      const activeUser = getActiveUser();
      const nomeOperador = activeUser?.full_name || activeUser?.nome || activeUser?.login || "Farmacêutico";

      return await cancelarEstornarBaixaGrupo({
        baixaGrupoId: separacao.baixa_grupo_id || separacao.id,
        saidasDoGrupo: separacao.itens,
        usuarioNome: nomeOperador,
        motivo: `Reversão completa de Separação Consolidada (${separacao.dias_ciclo} dias, ${separacao.total_medicamentos} medicamentos)`,
      });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["medicamentos"] });
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      queryClient.invalidateQueries({ queryKey: ["saidas"] });
      queryClient.invalidateQueries({ queryKey: ["prescricoes_paciente"] });
      queryClient.invalidateQueries({ queryKey: ["pacientes"] });
      queryClient.invalidateQueries({ queryKey: ["historico_separacao_consolidada"] });

      toast.success(
        `Separação Consolidada revertida com sucesso! ${res.estornadas} saída(s) foram canceladas e todo o estoque foi devolvido.`
      );

      setSeparacaoParaEstorno(null);
      setSenhaInput("");
      setSenhaError("");
      if (onSuccess) onSuccess();
    },
    onError: (err) => {
      toast.error(`Erro ao reverter separação: ${err.message || err}`);
    },
  });

  const handleConfirmarReversao = async () => {
    if (!senhaInput.trim()) {
      setSenhaError("Digite a sua senha de usuário para confirmar a reversão.");
      return;
    }
    setValidandoSenha(true);
    setSenhaError("");
    try {
      const senhaCorreta = await validarSenhaUsuario(senhaInput);
      if (!senhaCorreta) {
        setSenhaError("Senha incorreta! Digite a senha do usuário atualmente conectado.");
        setValidandoSenha(false);
        return;
      }
      setValidandoSenha(false);
      reverterMutation.mutate(separacaoParaEstorno);
    } catch (e) {
      setValidandoSenha(false);
      setSenhaError("Erro ao validar senha: " + e.message);
    }
  };

  const isLoading = loadingHistorico || loadingSaidas;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[1020px] max-h-[88vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-700 via-indigo-600 to-blue-600 text-white p-5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-xs">
                <Boxes className="w-6 h-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold tracking-wide flex items-center gap-2">
                  Histórico de Separações Consolidadas
                  <Badge className="bg-indigo-900/60 text-indigo-100 border-indigo-400/40 text-[11px] font-normal">
                    Dispensação em Lote
                  </Badge>
                </DialogTitle>
                <p className="text-xs text-indigo-100 font-medium mt-0.5">
                  Visualize todas as separações consolidadas e reverta todas as saídas de uma vez com 1 clique.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="border-white/40 text-white bg-white/10 text-xs px-2.5 py-1">
              {filtrados.length} registro(s)
            </Badge>
          </div>

          {/* Barra de Filtros e Busca */}
          <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar por data, medicamento, paciente, ala ou responsável..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9.5 bg-white dark:bg-slate-800 text-xs border-slate-200 dark:border-slate-700"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <Button
                variant={filtroStatus === "todos" ? "default" : "ghost"}
                size="sm"
                onClick={() => setFiltroStatus("todos")}
                className="h-7 text-xs px-2.5"
              >
                Todas ({listaConsolidada.length})
              </Button>
              <Button
                variant={filtroStatus === "concluidas" ? "default" : "ghost"}
                size="sm"
                onClick={() => setFiltroStatus("concluidas")}
                className="h-7 text-xs px-2.5"
              >
                Ativas
              </Button>
              <Button
                variant={filtroStatus === "estornadas" ? "default" : "ghost"}
                size="sm"
                onClick={() => setFiltroStatus("estornadas")}
                className="h-7 text-xs px-2.5"
              >
                Revertidas
              </Button>
            </div>
          </div>

          {/* Lista de Separações Consolidadas */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {isLoading ? (
              <div className="py-16 text-center text-slate-500 text-sm">
                Carregando histórico de separações consolidadas...
              </div>
            ) : filtrados.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm space-y-2">
                <Boxes className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-700 dark:text-slate-300">
                  Nenhuma separação consolidada encontrada
                </p>
                <p className="text-xs text-slate-400">
                  {searchTerm ? "Tente buscar com outros termos." : "As dispensações consolidadas realizadas aparecerão aqui."}
                </p>
              </div>
            ) : (
              filtrados.map((item) => {
                const isExpanded = expandedId === item.id;
                const isEstornada = item.status === "ESTORNADA";

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "border rounded-xl shadow-2xs transition-all overflow-hidden",
                      isEstornada
                        ? "bg-slate-50/80 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-75"
                        : "bg-white dark:bg-slate-900 border-indigo-100 dark:border-slate-800 hover:border-indigo-300"
                    )}
                  >
                    {/* Header do Registro de Separação */}
                    <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-indigo-600" />
                            Data da Separação: {safeFormatDate(item.data_separacao)}
                          </span>

                          <Badge
                            className={cn(
                              "text-[10px] font-bold uppercase",
                              isEstornada
                                ? "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300"
                                : "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
                            )}
                          >
                            {isEstornada ? "Revertida / Estornada" : "Concluída"}
                          </Badge>

                          <Badge variant="outline" className="text-[10px] font-mono bg-blue-50 text-blue-700 border-blue-200">
                            Ciclo de {item.dias_ciclo} dia(s)
                          </Badge>

                          <Badge variant="outline" className="text-[10px] font-mono bg-indigo-50 text-indigo-700 border-indigo-200">
                            {item.total_medicamentos} medicamento(s)
                          </Badge>

                          <Badge variant="outline" className="text-[10px] font-mono bg-purple-50 text-purple-700 border-purple-200">
                            {item.total_unidades} un total
                          </Badge>

                          <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-700">
                            {item.total_pacientes} paciente(s)
                          </Badge>
                        </div>

                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                          <span>
                            Setor / Alas: <strong className="text-slate-700 dark:text-slate-300">{item.alas_atendidas}</strong>
                          </span>
                          <span>•</span>
                          <span>
                            Responsável: <strong>{item.responsavel}</strong> {item.responsavel_crf ? `(CRF: ${item.responsavel_crf})` : ""}
                          </span>
                          {item.created_at && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                <Clock className="w-3 h-3" />
                                Registrado: {safeFormatDateTime(item.created_at)}
                              </span>
                            </>
                          )}
                          {isEstornada && item.revertido_em && (
                            <>
                              <span>•</span>
                              <span className="text-[11px] text-rose-600 font-semibold">
                                Revertido em {safeFormatDateTime(item.revertido_em)} {item.revertido_por ? `por ${item.revertido_por}` : ""}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Ações */}
                      <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                        {item.itens.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedId(isExpanded ? null : item.id)}
                            className="h-8 text-xs text-slate-600 hover:text-slate-900 gap-1"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="w-3.5 h-3.5" /> Menos detalhes
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3.5 h-3.5" /> Ver {item.itens.length} saída(s)
                              </>
                            )}
                          </Button>
                        )}

                        {!isEstornada && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSeparacaoParaEstorno(item);
                              setSenhaInput("");
                              setSenhaError("");
                            }}
                            disabled={reverterMutation.isPending}
                            className="h-8 text-xs font-bold border-rose-300 text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 gap-1.5 cursor-pointer shadow-2xs"
                            title="Reverter todas as saídas desta separação de uma só vez"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                            Reverter Separação Completa
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Detalhes expandidos: lista de itens somados e pacientes */}
                    {isExpanded && item.itens.length > 0 && (
                      <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-100 dark:border-slate-800 text-xs space-y-2">
                        <p className="font-bold text-[11px] uppercase tracking-wider text-slate-500">
                          Saídas Geradas nesta Separação Consolidada ({item.itens.length} registros):
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                          {item.itens.map((it, idx) => (
                            <div
                              key={it.id || idx}
                              className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-between"
                            >
                              <div className="truncate pr-2">
                                <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {it.medicamento_nome}
                                </p>
                                <p className="text-[11px] text-slate-500 truncate">
                                  {it.paciente_nome ? `Paciente: ${it.paciente_nome}` : it.destino || "Paciente"}
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

          {/* Footer Informativo */}
          <div className="p-3 bg-slate-100/70 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs text-slate-500">
            <span>
              💡 Dica: Ao reverter a separação completa, todo o estoque da Satélite é devolvido e a cobertura dos pacientes é desfeita de forma atômica.
            </span>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Reversão com Senha */}
      <Dialog open={!!separacaoParaEstorno} onOpenChange={(v) => !v && setSeparacaoParaEstorno(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border border-rose-200 dark:border-rose-900 shadow-2xl">
          <div className="bg-rose-600 dark:bg-rose-900 text-white p-4 flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                Confirmar Reversão de Toda a Separação
              </DialogTitle>
              <p className="text-xs text-rose-100">
                Esta ação devolverá todas as unidades ao estoque satélite e cancelará o lote.
              </p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {separacaoParaEstorno && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Data da Separação:</span>
                  <strong className="text-slate-900 dark:text-slate-100 font-mono">
                    {safeFormatDate(separacaoParaEstorno.data_separacao)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Ciclo e Cobertura:</span>
                  <strong className="text-slate-900 dark:text-slate-100">
                    {separacaoParaEstorno.dias_ciclo} dias ({separacaoParaEstorno.total_pacientes} pacientes)
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Medicamentos / Unidades:</span>
                  <strong className="text-rose-700 dark:text-rose-400 font-bold">
                    {separacaoParaEstorno.total_medicamentos} itens ({separacaoParaEstorno.total_unidades} un a devolver)
                  </strong>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                Senha do Usuário Conectado:
              </label>
              <Input
                type="password"
                placeholder="Digite sua senha de acesso para liberar o estorno..."
                value={senhaInput}
                onChange={(e) => {
                  setSenhaInput(e.target.value);
                  setSenhaError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConfirmarReversao();
                }}
                className={cn(
                  "h-10 text-sm",
                  senhaError && "border-rose-500 focus-visible:ring-rose-500"
                )}
                autoFocus
              />
              {senhaError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                  {senhaError}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSeparacaoParaEstorno(null)}
              disabled={validandoSenha || reverterMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmarReversao}
              disabled={validandoSenha || reverterMutation.isPending}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {validandoSenha
                ? "Validando..."
                : reverterMutation.isPending
                ? "Revertendo..."
                : "Confirmar Reversão Completa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
