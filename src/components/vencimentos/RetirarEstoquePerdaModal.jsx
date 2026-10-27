import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { db } from "@/api/db";
import { validarSenhaUsuario } from "@/utils/authUtils";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trash2,
  AlertTriangle,
  Building2,
  Lock,
  PackageMinus,
  CheckCircle2,
  Layers,
  Calendar,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function RetirarEstoquePerdaModal({
  open,
  onOpenChange,
  lote,
  medicamentos = [],
  onSuccess,
}) {
  const [modoRetirada, setModoRetirada] = useState("ambos"); // "ambos", "central", "satelite", "personalizado"
  const [qtdCentral, setQtdCentral] = useState(0);
  const [qtdSatelite, setQtdSatelite] = useState(0);
  const [motivo, setMotivo] = useState("Vencimento Ultrapassado");
  const [observacao, setObservacao] = useState("");
  const [senhaInput, setSenhaInput] = useState("");
  const [senhaError, setSenhaError] = useState("");
  const [loading, setLoading] = useState(false);

  // Obter medicamento vinculado
  const med = lote
    ? medicamentos.find((m) => String(m.id) === String(lote.medicamento_id || lote.medicamentoId))
    : null;

  const saldoCentral = lote ? Math.max(0, Number(lote.quantidade_atual) || 0) : 0;
  const saldoSatelite = lote ? Math.max(0, Number(lote.quantidade_satelite) || 0) : 0;
  const saldoTotal = saldoCentral + saldoSatelite;

  // Atualizar quantidades ao trocar de lote ou modo
  useEffect(() => {
    if (!lote) return;
    if (modoRetirada === "ambos") {
      setQtdCentral(saldoCentral);
      setQtdSatelite(saldoSatelite);
    } else if (modoRetirada === "central") {
      setQtdCentral(saldoCentral);
      setQtdSatelite(0);
    } else if (modoRetirada === "satelite") {
      setQtdCentral(0);
      setQtdSatelite(saldoSatelite);
    }
  }, [modoRetirada, lote, saldoCentral, saldoSatelite]);

  // Resetar estados ao abrir
  useEffect(() => {
    if (open && lote) {
      setModoRetirada("ambos");
      setQtdCentral(saldoCentral);
      setQtdSatelite(saldoSatelite);
      setMotivo(lote.dias < 0 ? "Vencimento Ultrapassado" : "Validade Crítica (Risco de Vencimento)");
      setObservacao("");
      setSenhaInput("");
      setSenhaError("");
      setLoading(false);
    }
  }, [open, lote]);

  if (!lote) return null;

  const totalRetirar = (Number(qtdCentral) || 0) + (Number(qtdSatelite) || 0);

  const handleConfirmarRetirada = async () => {
    if (totalRetirar <= 0) {
      toast.error("Informe uma quantidade maior que zero para retirar do estoque.");
      return;
    }

    if (Number(qtdCentral) > saldoCentral) {
      toast.error(`Quantidade a retirar da Central (${qtdCentral}) excede o saldo disponível (${saldoCentral}).`);
      return;
    }

    if (Number(qtdSatelite) > saldoSatelite) {
      toast.error(`Quantidade a retirar da Satélite (${qtdSatelite}) excede o saldo disponível (${saldoSatelite}).`);
      return;
    }

    if (!senhaInput.trim()) {
      setSenhaError("Digite a sua senha de acesso para autorizar a baixa.");
      return;
    }

    setLoading(true);
    setSenhaError("");

    try {
      const senhaValida = await validarSenhaUsuario(senhaInput);
      if (!senhaValida) {
        setSenhaError("Senha incorreta! Digite a senha do usuário autenticado.");
        setLoading(false);
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

      const nowStr = new Date().toISOString();
      const todayDateStr = format(new Date(), "yyyy-MM-dd");
      const baixaGrupoId = crypto.randomUUID();
      const sqlStatements = [];

      const medNomeDisplay = lote.medicamento_nome_display || med?.nome || "Medicamento";
      const numLoteDisplay = lote.numero_lote || "S/ Lote";

      // 1. Registro de Saída como Perda da Central (se houver)
      if (Number(qtdCentral) > 0) {
        sqlStatements.push(
          db.buildInsertSql("Saida", {
            medicamento_id: med ? med.id : lote.medicamento_id,
            medicamento_nome: medNomeDisplay,
            lote_id: lote.id,
            numero_lote: numLoteDisplay,
            quantidade: Number(qtdCentral),
            destino: "Descarte / Perda por Vencimento (Central)",
            ala_nome: "Almoxarifado Central (Perda)",
            motivo: `Perda / Descarte: ${motivo}`,
            observacao: `[Baixa por Perda] Retirado da Farmácia Central: ${qtdCentral} un | Lote: ${numLoteDisplay} (Validade: ${lote.validadeFormatada || lote.data_validade}) | Motivo: ${motivo}${observacao ? ` | Obs: ${observacao}` : ""}`,
            tipo: "perda",
            data_saida: todayDateStr,
            created_at: nowStr,
            responsavel: responsavel,
            responsavel_crf: responsavelCrf,
            usuario_nome: responsavel,
            origem: "central",
            baixa_grupo_id: baixaGrupoId,
          })
        );
      }

      // 2. Registro de Saída como Perda da Satélite (se houver)
      if (Number(qtdSatelite) > 0) {
        sqlStatements.push(
          db.buildInsertSql("Saida", {
            medicamento_id: med ? med.id : lote.medicamento_id,
            medicamento_nome: medNomeDisplay,
            lote_id: lote.id,
            numero_lote: numLoteDisplay,
            quantidade: Number(qtdSatelite),
            destino: "Descarte / Perda por Vencimento (Satélite)",
            ala_nome: "Farmácia Satélite (Perda)",
            motivo: `Perda / Descarte: ${motivo}`,
            observacao: `[Baixa por Perda] Retirado da Farmácia Satélite: ${qtdSatelite} un | Lote: ${numLoteDisplay} (Validade: ${lote.validadeFormatada || lote.data_validade}) | Motivo: ${motivo}${observacao ? ` | Obs: ${observacao}` : ""}`,
            tipo: "perda",
            data_saida: todayDateStr,
            created_at: nowStr,
            responsavel: responsavel,
            responsavel_crf: responsavelCrf,
            usuario_nome: responsavel,
            origem: "satelite",
            baixa_grupo_id: baixaGrupoId,
          })
        );
      }

      // 3. Atualizar Lote (debitar quantidade_atual e quantidade_satelite)
      const novoSaldoCentral = Math.max(0, saldoCentral - Number(qtdCentral));
      const novoSaldoSat = Math.max(0, saldoSatelite - Number(qtdSatelite));
      const loteEsgotado = novoSaldoCentral <= 0 && novoSaldoSat <= 0;

      sqlStatements.push(
        db.buildUpdateSql("Lote", lote.id, {
          quantidade_atual: novoSaldoCentral,
          quantidade_satelite: novoSaldoSat,
          status: loteEsgotado ? "esgotado" : lote.status,
        })
      );

      // 4. Atualizar Medicamento (debitar estoque_atual e estoque_satelite)
      if (med) {
        const novoEstoqueCentral = Math.max(0, (Number(med.estoque_atual) || 0) - Number(qtdCentral));
        const novoEstoqueSatelite = Math.max(0, (Number(med.estoque_satelite) || 0) - Number(qtdSatelite));

        sqlStatements.push(
          db.buildUpdateSql("Medicamento", med.id, {
            estoque_atual: novoEstoqueCentral,
            estoque_satelite: novoEstoqueSatelite,
          })
        );
      }

      // 5. Executar tudo em transação atômica única no Postgres
      await db.batchExecute(sqlStatements, {
        auditAction: "PERDA_ESTOQUE_VENCIMENTO",
        auditEntity: "Saida",
        auditDetails: `Baixa de estoque por perda/vencimento: ${medNomeDisplay} (Lote: ${numLoteDisplay}). Total: ${totalRetirar} un (Central: ${qtdCentral}, Satélite: ${qtdSatelite}) por ${responsavel}. Motivo: ${motivo}`,
      });

      toast.success(
        `Retirada efetuada com sucesso! ${totalRetirar} un baixadas como perda e registradas no histórico.`
      );

      if (onSuccess) onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error("Erro ao registrar baixa por perda:", err);
      toast.error(`Erro ao efetuar baixa: ${err.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-2xl">
        {/* Header */}
        <div className="bg-red-600 dark:bg-red-900 text-white p-5 flex items-center gap-3">
          <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-xs">
            <PackageMinus className="w-6 h-6 text-white" />
          </div>
          <div>
            <DialogTitle className="text-base font-bold tracking-wide">
              Retirar Estoque • Baixa por Perda / Vencimento
            </DialogTitle>
            <p className="text-xs text-red-100 font-medium">
              Efetue a baixa de medicamentos vencidos ou impróprios na Central e Satélite com registro de perda.
            </p>
          </div>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {/* Card com Detalhes do Medicamento e Lote */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-mono text-[10px] text-slate-500 font-bold block">
                  CÓD: {lote.codigo || "S/C"}
                </span>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 leading-tight">
                  {lote.medicamento_nome_display}
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {lote.concentracao ? `${lote.concentracao} • ` : ""}
                  {lote.apresentacao || "COMPRIMIDO"}
                </p>
              </div>

              {lote.dias < 0 ? (
                <Badge className="bg-red-100 text-red-800 border-red-300 font-bold text-[10px] shrink-0">
                  Vencido ({Math.abs(lote.dias)}d atrás)
                </Badge>
              ) : (
                <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-bold text-[10px] shrink-0">
                  Vence em {lote.dias} dias
                </Badge>
              )}
            </div>

            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span>Lote: <strong className="font-mono text-slate-800 dark:text-slate-100">{lote.numero_lote || "S/ Lote"}</strong></span>
              <span>Validade: <strong>{lote.validadeFormatada || lote.data_validade}</strong></span>
            </div>
          </div>

          {/* Cards de Saldos Atuais */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-xl border border-blue-200 bg-blue-50/60 dark:bg-blue-950/30">
              <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 block uppercase">
                Saldo Central
              </span>
              <span className="text-base font-extrabold text-blue-800 dark:text-blue-200">
                {saldoCentral} un
              </span>
            </div>

            <div className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/30">
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 block uppercase">
                Saldo Satélite
              </span>
              <span className="text-base font-extrabold text-emerald-800 dark:text-emerald-200">
                {saldoSatelite} un
              </span>
            </div>

            <div className="p-2.5 rounded-xl border border-indigo-200 bg-indigo-50/80 dark:bg-indigo-950/40">
              <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 block uppercase">
                Total Geral
              </span>
              <span className="text-base font-black text-indigo-900 dark:text-indigo-100">
                {saldoTotal} un
              </span>
            </div>
          </div>

          {/* Opções de Onde Retirar */}
          <div className="space-y-2">
            <label className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 text-xs">
              <Building2 className="w-3.5 h-3.5 text-red-600" />
              Selecione de onde deseja retirar o estoque:
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setModoRetirada("ambos")}
                className={cn(
                  "p-2.5 rounded-xl border text-left transition-all cursor-pointer font-medium",
                  modoRetirada === "ambos"
                    ? "bg-red-50 border-red-500 text-red-900 ring-2 ring-red-500/20 font-bold"
                    : "bg-white dark:bg-slate-900 border-slate-200 hover:border-slate-300 text-slate-700"
                )}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs">Deletar Ambos os Estoques</span>
                  <Badge className="bg-red-600 text-white text-[9px]">Recomendado</Badge>
                </div>
                <p className="text-[11px] text-slate-500">
                  Zera Central ({saldoCentral}) e Satélite ({saldoSatelite})
                </p>
              </button>

              <button
                type="button"
                onClick={() => setModoRetirada("central")}
                className={cn(
                  "p-2.5 rounded-xl border text-left transition-all cursor-pointer font-medium",
                  modoRetirada === "central"
                    ? "bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-500/20 font-bold"
                    : "bg-white dark:bg-slate-900 border-slate-200 hover:border-slate-300 text-slate-700"
                )}
              >
                <div className="text-xs">Somente Farmácia Central</div>
                <p className="text-[11px] text-slate-500">
                  Retira {saldoCentral} un da Central
                </p>
              </button>

              <button
                type="button"
                onClick={() => setModoRetirada("satelite")}
                className={cn(
                  "p-2.5 rounded-xl border text-left transition-all cursor-pointer font-medium",
                  modoRetirada === "satelite"
                    ? "bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20 font-bold"
                    : "bg-white dark:bg-slate-900 border-slate-200 hover:border-slate-300 text-slate-700"
                )}
              >
                <div className="text-xs">Somente Farmácia Satélite</div>
                <p className="text-[11px] text-slate-500">
                  Retira {saldoSatelite} un da Satélite
                </p>
              </button>

              <button
                type="button"
                onClick={() => setModoRetirada("personalizado")}
                className={cn(
                  "p-2.5 rounded-xl border text-left transition-all cursor-pointer font-medium",
                  modoRetirada === "personalizado"
                    ? "bg-indigo-50 border-indigo-500 text-indigo-900 ring-2 ring-indigo-500/20 font-bold"
                    : "bg-white dark:bg-slate-900 border-slate-200 hover:border-slate-300 text-slate-700"
                )}
              >
                <div className="text-xs">Quantidade Personalizada</div>
                <p className="text-[11px] text-slate-500">
                  Digitar quantidades manuais
                </p>
              </button>
            </div>
          </div>

          {/* Inputs de Quantidade (habilitados se personalizado) */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Qtd a Retirar da Central:
              </label>
              <Input
                type="number"
                min="0"
                max={saldoCentral}
                value={qtdCentral}
                disabled={modoRetirada !== "personalizado" && modoRetirada !== "central"}
                onChange={(e) => setQtdCentral(Math.max(0, parseInt(e.target.value) || 0))}
                className="h-9 text-sm font-bold bg-white dark:bg-slate-800"
              />
              <span className="text-[10px] text-slate-400">Máx: {saldoCentral} un</span>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                Qtd a Retirar da Satélite:
              </label>
              <Input
                type="number"
                min="0"
                max={saldoSatelite}
                value={qtdSatelite}
                disabled={modoRetirada !== "personalizado" && modoRetirada !== "satelite"}
                onChange={(e) => setQtdSatelite(Math.max(0, parseInt(e.target.value) || 0))}
                className="h-9 text-sm font-bold bg-white dark:bg-slate-800"
              />
              <span className="text-[10px] text-slate-400">Máx: {saldoSatelite} un</span>
            </div>
          </div>

          {/* Motivo da Perda */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Motivo do Descarte / Baixa por Perda:
            </label>
            <Select value={motivo} onValueChange={setMotivo}>
              <SelectTrigger className="h-9 text-xs bg-white dark:bg-slate-800 border-slate-200">
                <SelectValue placeholder="Selecione o motivo..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Vencimento Ultrapassado">Vencimento Ultrapassado (Prazo Expirado)</SelectItem>
                <SelectItem value="Validade Crítica (Risco de Vencimento)">Validade Crítica (Sem Demanda Hospitalar)</SelectItem>
                <SelectItem value="Avaria / Frasco Quebrado">Avaria Física / Quebra de Frasco / Ampola</SelectItem>
                <SelectItem value="Alteração de Aspecto / Precipitação">Alteração Físico-Química / Precipitação</SelectItem>
                <SelectItem value="Descarte Técnico / Quarentena">Descarte Técnico Sanitário / Quarentena</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Observação Opcional */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Observação / Justificativa Técnica:
            </label>
            <Textarea
              placeholder="Descreva detalhes como laudo de descarte, número do boletim de inutilização, etc..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="h-16 text-xs resize-none bg-white dark:bg-slate-800"
            />
          </div>

          {/* Confirmação com Senha de Usuário */}
          <div className="p-3 bg-red-50/70 dark:bg-red-950/40 rounded-xl border border-red-200 dark:border-red-900/60 space-y-2">
            <label className="text-xs font-bold text-red-900 dark:text-red-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-red-600" />
              Digite sua senha de usuário para autorizar a baixa por perda:
            </label>
            <Input
              type="password"
              placeholder="Senha de acesso..."
              value={senhaInput}
              onChange={(e) => {
                setSenhaInput(e.target.value);
                if (senhaError) setSenhaError("");
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleConfirmarRetirada();
                }
              }}
              className="h-9 text-center font-mono font-bold bg-white dark:bg-slate-900"
            />
            {senhaError && <p className="text-xs text-red-600 font-bold">{senhaError}</p>}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>

          <Button
            onClick={handleConfirmarRetirada}
            disabled={loading || totalRetirar <= 0}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs gap-1.5 shadow-md"
          >
            <Trash2 className="w-4 h-4" />
            {loading ? "Processando Baixa..." : `Confirmar Baixa de ${totalRetirar} un como Perda`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
