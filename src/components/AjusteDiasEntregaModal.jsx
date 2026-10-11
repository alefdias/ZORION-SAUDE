import React, { useState, useMemo, useEffect } from "react";
import { format, parseISO, differenceInCalendarDays, addDays, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/api/db";
import { toast } from "sonner";
import {
  CalendarDays,
  Clock,
  PackageMinus,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Pill,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function AjusteDiasEntregaModal({
  open,
  onOpenChange,
  patient,
  prescricoes = [],
  medicamentos = [],
  lotes = [],
  onSuccess,
}) {
  const [dataFimCiclo, setDataFimCiclo] = useState("");
  const [selectedPrescIds, setSelectedPrescIds] = useState(new Set());
  const [customQtds, setCustomQtds] = useState({});
  const [selectedLotes, setSelectedLotes] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hoje = useMemo(() => new Date(), []);
  const hojeStr = useMemo(() => format(hoje, "yyyy-MM-dd"), [hoje]);

  // Filtra as prescrições ativas do paciente
  const activePrescs = useMemo(() => {
    if (!patient?.id) return [];
    return prescricoes.filter((pr) => {
      const pId = pr.pacienteId || pr.paciente_id || pr.pacienteid;
      const status = pr.status || "Ativa";
      return String(pId) === String(patient.id) && status === "Ativa";
    });
  }, [prescricoes, patient]);

  // Descobre a data de cobertura atual registrada no paciente ou prescrições
  useEffect(() => {
    if (!open) return;

    let cicloFinal = patient?.ciclo_coberto_ate;
    if (!cicloFinal) {
      // Procura a maior data de cobertura das prescrições ativas
      const coberturas = activePrescs
        .map((pr) => pr.coberto_ate)
        .filter((d) => d && d >= hojeStr)
        .sort();
      if (coberturas.length > 0) {
        cicloFinal = coberturas[coberturas.length - 1];
      }
    }

    // Se ainda não tiver ou for no passado, sugere 7 dias à frente (fechando ciclo de 8 dias)
    if (!cicloFinal || cicloFinal < hojeStr) {
      cicloFinal = format(addDays(hoje, 7), "yyyy-MM-dd");
    }

    setDataFimCiclo(cicloFinal);
  }, [open, patient, activePrescs, hoje, hojeStr]);

  // Calcula os dias restantes a cobrir
  const diasRestantes = useMemo(() => {
    if (!dataFimCiclo) return 1;
    const dFim = parseISO(dataFimCiclo);
    if (!isValid(dFim)) return 1;
    const diff = differenceInCalendarDays(dFim, hoje);
    // Dias a cobrir inclui o dia de hoje se ainda não foi tomado + os dias até o fim
    return Math.max(1, diff + 1);
  }, [dataFimCiclo, hoje]);

  // Calcula para cada prescrição a dose diária atual vs anterior
  const prescAnalise = useMemo(() => {
    return activePrescs.map((pr) => {
      const med = medicamentos.find(
        (m) => m.id === (pr.medicamentoId || pr.medicamento_id)
      );

      // Dose diária atual da prescrição
      const doseAtual = parseFloat(pr.totalDiario) || 0;

      // Dose dispensada no último lote (se houver histórico)
      const doseAnterior =
        pr.dose_diaria_dispensada !== undefined &&
        pr.dose_diaria_dispensada !== null
          ? parseFloat(pr.dose_diaria_dispensada)
          : null;

      // Se não havia registro de dose dispensada anterior, verifica se é medicamento recém adicionado
      const isNova = doseAnterior === null || doseAnterior === undefined;
      const diferencaDose = isNova ? doseAtual : doseAtual - doseAnterior;

      // Quantidade sugerida para cobrir até a data fim
      let qtdSugerida = 0;
      if (diferencaDose > 0) {
        qtdSugerida = Math.ceil(diferencaDose * diasRestantes);
      }

      // Lotes FEFO disponíveis
      const medLotes = (lotes || [])
        .filter(
          (l) =>
            (l.medicamento_id === med?.id || l.medicamentoId === med?.id) &&
            (Number(l.quantidade_atual) || 0) > 0 &&
            l.status !== "Inativo"
        )
        .sort((a, b) => new Date(a.data_validade) - new Date(b.data_validade));

      return {
        pr,
        med,
        doseAtual,
        doseAnterior,
        isNova,
        diferencaDose,
        qtdSugerida,
        medLotes,
        estoqueSatelite: med?.estoque_satelite || 0,
      };
    });
  }, [activePrescs, medicamentos, lotes, diasRestantes]);

  // Auto-seleciona os que têm aumento de dose ou são novos
  useEffect(() => {
    if (!open) return;
    const newSelected = new Set();
    const newQtds = {};

    prescAnalise.forEach((item) => {
      if (item.diferencaDose > 0 && item.qtdSugerida > 0) {
        newSelected.add(item.pr.id);
        newQtds[item.pr.id] = item.qtdSugerida;
      }
    });

    setSelectedPrescIds(newSelected);
    setCustomQtds(newQtds);
  }, [open, prescAnalise]);

  const toggleSelect = (prId, item) => {
    const next = new Set(selectedPrescIds);
    if (next.has(prId)) {
      next.delete(prId);
    } else {
      next.add(prId);
      if (customQtds[prId] === undefined) {
        setCustomQtds((prev) => ({
          ...prev,
          [prId]: item.qtdSugerida || 1,
        }));
      }
    }
    setSelectedPrescIds(next);
  };

  const handleConfirm = async () => {
    if (selectedPrescIds.size === 0) {
      toast.error("Selecione ao menos um medicamento para entregar o complemento.");
      return;
    }

    setIsSubmitting(true);
    try {
      const nowStr = new Date().toISOString();
      const itensParaBaixar = [];

      // Validar quantidades e estoque
      for (const prescId of selectedPrescIds) {
        const item = prescAnalise.find((x) => x.pr.id === prescId);
        if (!item) continue;

        const qtd =
          customQtds[prescId] !== undefined
            ? Math.max(0, parseInt(customQtds[prescId]) || 0)
            : item.qtdSugerida;

        if (qtd <= 0) continue;

        if (item.estoqueSatelite < qtd) {
          throw new Error(
            `Estoque insuficiente na Farmácia Satélite para ${item.med?.nome || "Medicamento"}. Necessário: ${qtd} un, Disponível: ${item.estoqueSatelite} un`
          );
        }

        const loteId = selectedLotes[prescId] || item.medLotes[0]?.id || null;
        const loteObj = item.medLotes.find((l) => l.id === loteId) || item.medLotes[0];

        itensParaBaixar.push({
          item,
          qtd,
          loteObj,
        });
      }

      if (itensParaBaixar.length === 0) {
        toast.error("Nenhuma quantidade maior que zero para dispensar.");
        setIsSubmitting(false);
        return;
      }

      let responsavel = "Farmacêutico";
      let responsavelCrf = "";
      try {
        const rawU = localStorage.getItem("pharma_user");
        if (rawU) {
          const u = JSON.parse(rawU);
          responsavel = u.full_name || u.nome || u.login || "Farmacêutico";
          responsavelCrf = u.crf || "";
        }
      } catch (e) {}

      // Executar as saídas e atualizações
      for (const { item, qtd, loteObj } of itensParaBaixar) {
        const { pr, med, doseAtual } = item;
        const medId = med?.id || pr.medicamentoId;
        const loteId = loteObj?.id || null;
        const numeroLote = loteObj?.numero_lote || "S/ Lote";

        // 1. Debitar do lote se houver
        if (loteObj && Number(loteObj.quantidade_atual) > 0) {
          const novaQtdLote = Math.max(
            0,
            Number(loteObj.quantidade_atual) - qtd
          );
          await db.entities.Lote.update(loteObj.id, {
            quantidade_atual: novaQtdLote,
            status: novaQtdLote <= 0 ? "esgotado" : loteObj.status,
          });
        }

        // 2. Debitar do estoque da satélite
        if (med) {
          await db.entities.Medicamento.update(medId, {
            estoque_satelite: Math.max(0, (med.estoque_satelite || 0) - qtd),
          });
        }

        // 3. Gravar registro em Saida com cobertura
        await db.entities.Saida.create({
          medicamento_id: medId,
          medicamento_nome:
            pr.medicamentoNome || (med ? med.nome : "Medicamento"),
          lote_id: loteId,
          numero_lote: numeroLote,
          quantidade: qtd,
          destino: `Paciente ${patient.nome} (Leito: ${patient.leito || "S/L"})`,
          paciente_nome: patient.nome,
          paciente_id: patient.id,
          prescricao_id: pr.id,
          ala_id: patient.alaId || patient.ala_id || null,
          ala_nome: patient.alaNome || patient.ala_nome || "Geral",
          motivo: "Ajuste de Dias de Entrega (Complemento de Ciclo)",
          observacao: `Complemento de ${qtd} un para fechar ciclo até ${format(parseISO(dataFimCiclo), "dd/MM/yyyy")} (${diasRestantes} dias) | Dose: ${doseAtual} un/dia | Lote: ${numeroLote}`,
          data_saida: hojeStr,
          created_at: nowStr,
          responsavel: responsavel,
          responsavel_crf: responsavelCrf,
          usuario_nome: responsavel,
          dias_cobertura: diasRestantes,
          data_inicio_cobertura: hojeStr,
          data_fim_cobertura: dataFimCiclo,
          dose_diaria: item.diferencaDose > 0 ? item.diferencaDose : doseAtual,
          is_baixa_lote_paciente: true,
        });

        // 4. Atualizar a prescrição
        await db.entities.PrescricaoPaciente.update(pr.id, {
          coberto_ate: dataFimCiclo,
          dose_diaria_dispensada: doseAtual,
          data_ultima_dispensacao: hojeStr,
        });
      }

      // 5. Atualizar o ciclo no paciente
      await db.entities.Paciente.update(patient.id, {
        ciclo_coberto_ate: dataFimCiclo,
        data_ultimo_ajuste_ciclo: hojeStr,
      });

      toast.success(
        `Ajuste concluído! ${itensParaBaixar.length} medicamento(s) complementado(s) com sucesso até ${format(parseISO(dataFimCiclo), "dd/MM/yyyy")}.`
      );

      if (onSuccess) onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Erro ao realizar ajuste de dias de entrega.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[850px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-600" />
            Ajuste de Dias de Entrega (Complemento de Ciclo)
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Card do Paciente e Configuração do Ciclo */}
          <div className="bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-indigo-950 dark:text-indigo-200">
                    {patient?.nome || "Paciente"}
                  </h3>
                  <Badge variant="outline" className="bg-white text-indigo-700 border-indigo-300 text-xs">
                    Pront: {patient?.prontuario || "N/A"}
                  </Badge>
                  <Badge variant="outline" className="bg-white text-indigo-700 border-indigo-300 text-xs">
                    Leito: {patient?.leito || "S/L"}
                  </Badge>
                </div>
                <p className="text-xs text-indigo-700 dark:text-indigo-400 mt-1">
                  Equalize a entrega de novos medicamentos ou aumentos de posologia até a data de fechamento do lote deste paciente.
                </p>
              </div>

              {/* Seletor da Data Final do Ciclo */}
              <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-lg border border-indigo-200 shrink-0">
                <CalendarDays className="w-4 h-4 text-indigo-600" />
                <div className="text-left">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase block">
                    Fechar Ciclo Até:
                  </Label>
                  <Input
                    type="date"
                    min={hojeStr}
                    value={dataFimCiclo}
                    onChange={(e) => setDataFimCiclo(e.target.value)}
                    className="h-7 text-xs font-bold font-mono px-2 py-0 w-[130px]"
                  />
                </div>
                <div className="border-l pl-2 text-center">
                  <span className="text-[10px] text-slate-500 font-bold block">
                    Restam
                  </span>
                  <span className="text-xs font-black text-indigo-600 font-mono">
                    {diasRestantes}d
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabela de Prescrições para Ajuste */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Pill className="w-3.5 h-3.5 text-indigo-600" />
                Prescrições Ativas do Paciente ({prescAnalise.length})
              </h4>
              <span className="text-[11px] text-slate-500">
                {selectedPrescIds.size} selecionado(s) para entrega complementar
              </span>
            </div>

            {prescAnalise.length === 0 ? (
              <div className="p-8 text-center text-slate-500 border border-dashed rounded-xl">
                Nenhuma medicação ativa cadastrada para este paciente.
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                <Table>
                  <TableHeader className="bg-slate-100/80 dark:bg-slate-800">
                    <TableRow>
                      <TableHead className="w-10 text-center"></TableHead>
                      <TableHead>Medicamento / Posologia</TableHead>
                      <TableHead className="text-center">Status do Ajuste</TableHead>
                      <TableHead className="text-center">Lote (FEFO)</TableHead>
                      <TableHead className="text-center w-28">Complemento ({diasRestantes}d)</TableHead>
                      <TableHead className="text-right">Satélite</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {prescAnalise.map((item) => {
                      const {
                        pr,
                        med,
                        doseAtual,
                        doseAnterior,
                        isNova,
                        diferencaDose,
                        qtdSugerida,
                        medLotes,
                        estoqueSatelite,
                      } = item;

                      const isSelected = selectedPrescIds.has(pr.id);
                      const customVal = customQtds[pr.id];
                      const valorFinal =
                        customVal !== undefined ? customVal : qtdSugerida;
                      const temEstoque = estoqueSatelite >= valorFinal;
                      const selectedLoteId =
                        selectedLotes[pr.id] || medLotes[0]?.id || "";

                      return (
                        <TableRow
                          key={pr.id}
                          className={cn(
                            "transition-colors",
                            isSelected
                              ? "bg-indigo-50/40 dark:bg-indigo-950/20"
                              : "hover:bg-slate-50/50"
                          )}
                        >
                          {/* Checkbox de Seleção */}
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelect(pr.id, item)}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                            />
                          </TableCell>

                          {/* Medicamento e Esquema */}
                          <TableCell className="max-w-[220px]">
                            <p className="font-bold text-xs text-slate-900 dark:text-slate-100 leading-snug">
                              {pr.medicamentoNome}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[11px] font-semibold text-slate-600 bg-slate-100 px-1 rounded">
                                {pr.esquemaPosologico}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                ({doseAtual} un/dia)
                              </span>
                            </div>
                          </TableCell>

                          {/* Status / Motivo do Ajuste */}
                          <TableCell className="text-center">
                            {isNova ? (
                              <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px] font-bold">
                                🆕 Nova no Ciclo (+{doseAtual} un/dia)
                              </Badge>
                            ) : diferencaDose > 0 ? (
                              <div className="space-y-0.5">
                                <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] font-bold">
                                  ⚠️ Aumento (+{diferencaDose} un/dia)
                                </Badge>
                                <span className="text-[9px] text-slate-400 block font-mono">
                                  Anterior: {doseAnterior} un/dia
                                </span>
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <Badge
                                  variant="outline"
                                  className="bg-slate-50 text-slate-600 border-slate-200 text-[10px] font-medium"
                                >
                                  {diferencaDose < 0
                                    ? "🔻 Dose Reduzida (Sem complemento)"
                                    : "✅ Dose Mantida"}
                                </Badge>
                                <span className="text-[9px] text-slate-400 block font-mono">
                                  Cobertura OK
                                </span>
                              </div>
                            )}
                          </TableCell>

                          {/* Seletor de Lote (FEFO) */}
                          <TableCell className="min-w-[170px]">
                            {medLotes.length === 0 ? (
                              <span className="text-[10px] text-slate-400">
                                Sem lote com saldo
                              </span>
                            ) : (
                              <Select
                                value={selectedLoteId}
                                onValueChange={(val) =>
                                  setSelectedLotes((prev) => ({
                                    ...prev,
                                    [pr.id]: val,
                                  }))
                                }
                                disabled={!isSelected}
                              >
                                <SelectTrigger className="h-7 text-xs font-mono bg-white">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {medLotes.map((l, idx) => (
                                    <SelectItem
                                      key={l.id}
                                      value={l.id}
                                      className="text-xs font-mono"
                                    >
                                      {l.numero_lote} ({l.quantidade_atual} un)
                                      {idx === 0 ? " 🌟 FEFO" : ""}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>

                          {/* Quantidade Editável */}
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Input
                                type="number"
                                min="0"
                                disabled={!isSelected}
                                value={valorFinal}
                                onChange={(e) => {
                                  const v =
                                    e.target.value === ""
                                      ? ""
                                      : Math.max(0, parseInt(e.target.value) || 0);
                                  setCustomQtds((prev) => ({
                                    ...prev,
                                    [pr.id]: v,
                                  }));
                                }}
                                className={cn(
                                  "w-16 h-7 text-center font-mono font-bold text-xs bg-white",
                                  !temEstoque && isSelected && "border-red-500 bg-red-50"
                                )}
                              />
                              <span className="text-xs text-slate-500 font-medium">
                                un
                              </span>
                            </div>
                            {isSelected &&
                              customVal !== undefined &&
                              customVal !== qtdSugerida && (
                                <span className="text-[9px] text-amber-700 bg-amber-50 px-1 rounded block mt-0.5">
                                  Sugerido: {qtdSugerida} un
                                </span>
                              )}
                          </TableCell>

                          {/* Saldo Satélite */}
                          <TableCell className="text-right">
                            <Badge
                              variant="outline"
                              className={cn(
                                "font-mono text-[11px]",
                                temEstoque
                                  ? "bg-slate-50 text-slate-700"
                                  : "bg-red-50 text-red-700 border-red-300"
                              )}
                            >
                              {estoqueSatelite} un
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
            <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <div>
              <strong>Regra Clínica de Equalização:</strong> As doses diminuídas não geram débito e os comprimidos restantes permanecem no posto até eventual devolução manual. Medicamentos aumentados ou novos geram saída apenas para a quantidade complementar exata dos <strong>{diasRestantes} dias restantes</strong> até o fechamento do lote.
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between border-t pt-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2 shadow-sm"
            onClick={handleConfirm}
            disabled={isSubmitting || selectedPrescIds.size === 0}
          >
            <PackageMinus className="w-4 h-4" />
            {isSubmitting
              ? "Processando Saídas..."
              : `Confirmar Entrega Complementar (${selectedPrescIds.size} itens)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
export default AjusteDiasEntregaModal;
