import React, { useState, useEffect, useMemo } from "react";
import { format, differenceInDays, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { db } from "@/api/db";
import { invoke } from "@tauri-apps/api/core";
import { validarSenhaUsuario, getActiveUser } from "@/utils/authUtils";
import { isPsicotropico, isMav } from "@/utils/mavUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  RefreshCw,
  AlertTriangle,
  CalendarX2,
  Package,
  Layers,
  User,
  ShieldCheck,
  Building2,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileCheck2,
  Clock,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function getPgConfig() {
  const ip = localStorage.getItem("pg_ip");
  const dbName = localStorage.getItem("pg_db");
  const password = localStorage.getItem("pg_pass");
  if (!ip || !password) {
    throw new Error("PostgreSQL não configurado.");
  }
  return { ip, dbName, password };
}

export function TrocaLoteValidadeModal({
  open,
  onOpenChange,
  pacientes = [],
  prescricoes = [],
  medicamentos = [],
  lotes = [],
  saidas = [],
  initialPacienteId = null,
  initialPrescricaoId = null,
  initialLoteId = null,
  onSuccess,
}) {
  const [selectedPacienteId, setSelectedPacienteId] = useState("");
  const [selectedPrescricaoId, setSelectedPrescricaoId] = useState("");
  const [loteAntigoId, setLoteAntigoId] = useState("");
  const [qtdTroca, setQtdTroca] = useState(1);
  const [localEstoque, setLocalEstoque] = useState("satelite"); // "satelite" | "central"
  const [selectedNovoLoteId, setSelectedNovoLoteId] = useState("");
  const [motivoPreset, setMotivoPreset] = useState("Validade Próxima (Prevenção)");
  const [motivoCustom, setMotivoCustom] = useState("");
  const [observacao, setObservacao] = useState("");
  const [senhaInput, setSenhaInput] = useState("");
  const [senhaError, setSenhaError] = useState("");
  const [loading, setLoading] = useState(false);

  // Inicialização e preenchimento ao abrir modal
  useEffect(() => {
    if (open) {
      setSenhaInput("");
      setSenhaError("");
      setLoading(false);
      setMotivoPreset("Validade Próxima (Prevenção)");
      setMotivoCustom("");
      setObservacao("");

      if (initialPacienteId) {
        setSelectedPacienteId(String(initialPacienteId));
      } else if (pacientes.length > 0 && !selectedPacienteId) {
        setSelectedPacienteId(String(pacientes[0].id));
      }

      if (initialPrescricaoId) {
        setSelectedPrescricaoId(String(initialPrescricaoId));
      }

      if (initialLoteId) {
        setLoteAntigoId(String(initialLoteId));
      }
    }
  }, [open, initialPacienteId, initialPrescricaoId, initialLoteId, pacientes]);

  // Paciente selecionado
  const currentPaciente = useMemo(() => {
    return pacientes.find((p) => String(p.id) === String(selectedPacienteId)) || null;
  }, [pacientes, selectedPacienteId]);

  // Prescrições ativas do paciente selecionado
  const prescricoesDoPaciente = useMemo(() => {
    if (!selectedPacienteId) return [];
    return prescricoes.filter((pr) => {
      const pId = String(pr.pacienteId || pr.paciente_id || "");
      const isMatch = pId === String(selectedPacienteId);
      const isAtiva = pr.status !== "Suspensa" && pr.status !== "Encerrada" && pr.status !== "Inativa";
      return isMatch && isAtiva;
    });
  }, [prescricoes, selectedPacienteId]);

  // Se trocar o paciente e a prescrição atual não for dele, seleciona a primeira
  useEffect(() => {
    if (prescricoesDoPaciente.length > 0) {
      const match = prescricoesDoPaciente.find((pr) => String(pr.id) === String(selectedPrescricaoId));
      if (!match) {
        setSelectedPrescricaoId(String(prescricoesDoPaciente[0].id));
      }
    } else {
      setSelectedPrescricaoId("");
    }
  }, [selectedPacienteId, prescricoesDoPaciente]);

  // Prescrição selecionada
  const currentPrescricao = useMemo(() => {
    return prescricoesDoPaciente.find((pr) => String(pr.id) === String(selectedPrescricaoId)) || null;
  }, [prescricoesDoPaciente, selectedPrescricaoId]);

  // Medicamento da prescrição
  const currentMedicamento = useMemo(() => {
    if (!currentPrescricao) return null;
    const medId = String(currentPrescricao.medicamentoId || currentPrescricao.medicamento_id || "");
    const medNome = (currentPrescricao.medicamentoNome || "").trim().toLowerCase();
    return medicamentos.find((m) => String(m.id) === medId || (m.nome && m.nome.trim().toLowerCase() === medNome)) || null;
  }, [medicamentos, currentPrescricao]);

  // Histórico de saídas recentes desta prescrição / paciente para identificar lote entregue
  const saidasDaPrescricao = useMemo(() => {
    if (!currentPrescricao) return [];
    const pId = String(currentPrescricao.id);
    return saidas.filter((s) => String(s.prescricao_id || "") === pId && (Number(s.quantidade) || 0) > 0);
  }, [saidas, currentPrescricao]);

  // Lotes possíveis de serem o Lote a Recolher (Lote Antigo)
  const lotesRecolherCandidatos = useMemo(() => {
    if (!currentMedicamento) return [];
    const medId = String(currentMedicamento.id);

    // Lotes do medicamento
    const medLotes = lotes.filter((l) => String(l.medicamento_id || l.medicamentoId) === medId);

    // Prioriza lotes que já constaram nas saídas deste paciente/prescrição
    const lotesUsadosIds = new Set(saidasDaPrescricao.map((s) => String(s.lote_id || "")));
    const lotesUsadosNumeros = new Set(saidasDaPrescricao.map((s) => String(s.numero_lote || "").trim().toLowerCase()));

    return medLotes.map((l) => {
      const isUtilizado = lotesUsadosIds.has(String(l.id)) || lotesUsadosNumeros.has(String(l.numero_lote || "").trim().toLowerCase());
      let diasVencimento = 999;
      if (l.data_validade) {
        const valDate = parseISO(String(l.data_validade).slice(0, 10));
        if (isValid(valDate)) {
          diasVencimento = differenceInDays(valDate, new Date());
        }
      }
      return {
        ...l,
        isUtilizado,
        diasVencimento,
      };
    }).sort((a, b) => {
      // Prioriza se foi utilizado e se está mais perto do vencimento
      if (a.isUtilizado !== b.isUtilizado) return a.isUtilizado ? -1 : 1;
      return a.diasVencimento - b.diasVencimento;
    });
  }, [currentMedicamento, lotes, saidasDaPrescricao]);

  // Auto-selecionar o Lote Antigo se não definido
  useEffect(() => {
    if (lotesRecolherCandidatos.length > 0) {
      const match = lotesRecolherCandidatos.find((l) => String(l.id) === String(loteAntigoId));
      if (!match) {
        setLoteAntigoId(String(lotesRecolherCandidatos[0].id));
      }
    } else {
      setLoteAntigoId("");
    }
  }, [lotesRecolherCandidatos]);

  const currentLoteAntigo = useMemo(() => {
    return lotesRecolherCandidatos.find((l) => String(l.id) === String(loteAntigoId)) || null;
  }, [lotesRecolherCandidatos, loteAntigoId]);

  // Lotes disponíveis para reposição (Lote Novo)
  const lotesReposicaoDisponiveis = useMemo(() => {
    if (!currentMedicamento) return [];
    const medId = String(currentMedicamento.id);
    const hoje = new Date();

    return lotes
      .filter((l) => {
        const matchMed = String(l.medicamento_id || l.medicamentoId) === medId;
        const diffLote = String(l.id) !== String(loteAntigoId);
        const statusOk = l.status !== "Inativo";

        // Saldo disponível no local escolhido
        const saldo = localEstoque === "satelite"
          ? (Number(l.quantidade_satelite) || 0)
          : (Number(l.quantidade_atual) || 0);

        // Validade não pode estar vencida
        let naoVencido = true;
        if (l.data_validade) {
          const valDate = parseISO(String(l.data_validade).slice(0, 10));
          if (isValid(valDate)) {
            naoVencido = differenceInDays(valDate, hoje) >= 0;
          }
        }

        return matchMed && diffLote && statusOk && saldo > 0 && naoVencido;
      })
      .map((l) => {
        let dias = 999;
        if (l.data_validade) {
          const valDate = parseISO(String(l.data_validade).slice(0, 10));
          if (isValid(valDate)) dias = differenceInDays(valDate, hoje);
        }
        const saldo = localEstoque === "satelite"
          ? (Number(l.quantidade_satelite) || 0)
          : (Number(l.quantidade_atual) || 0);
        return { ...l, dias, saldoDisponivel: saldo };
      })
      .sort((a, b) => a.dias - b.dias); // Ordem FEFO
  }, [currentMedicamento, lotes, loteAntigoId, localEstoque]);

  // Auto-selecionar o primeiro Lote Novo (FEFO)
  useEffect(() => {
    if (lotesReposicaoDisponiveis.length > 0) {
      const match = lotesReposicaoDisponiveis.find((l) => String(l.id) === String(selectedNovoLoteId));
      if (!match) {
        setSelectedNovoLoteId(String(lotesReposicaoDisponiveis[0].id));
      }
    } else {
      setSelectedNovoLoteId("");
    }
  }, [lotesReposicaoDisponiveis]);

  const currentLoteNovo = useMemo(() => {
    return lotesReposicaoDisponiveis.find((l) => String(l.id) === String(selectedNovoLoteId)) || null;
  }, [lotesReposicaoDisponiveis, selectedNovoLoteId]);

  // Se o medicamento é de controle especial / Portaria 344
  const isControlado344 = useMemo(() => {
    return isPsicotropico(currentMedicamento);
  }, [currentMedicamento]);

  // Saldo disponível no novo lote
  const saldoNovoLote = currentLoteNovo?.saldoDisponivel || 0;

  // Submeter a troca
  const handleConfirmarTroca = async () => {
    if (!currentPaciente) {
      toast.error("Selecione o paciente.");
      return;
    }
    if (!currentPrescricao || !currentMedicamento) {
      toast.error("Selecione uma prescrição válida.");
      return;
    }
    if (!currentLoteAntigo) {
      toast.error("Identifique o lote a recolher.");
      return;
    }
    if (!currentLoteNovo) {
      toast.error("Selecione o novo lote com saldo disponível para substituição.");
      return;
    }

    const qtd = parseInt(qtdTroca, 10);
    if (isNaN(qtd) || qtd <= 0) {
      toast.error("Informe uma quantidade válida para troca.");
      return;
    }

    if (qtd > saldoNovoLote) {
      toast.error(`Quantidade solicitada (${qtd}) excede o saldo disponível do novo lote (${saldoNovoLote} un).`);
      return;
    }

    if (!senhaInput.trim()) {
      setSenhaError("Digite sua senha de acesso para autorizar a operação.");
      return;
    }

    setLoading(true);
    setSenhaError("");

    try {
      const senhaValida = await validarSenhaUsuario(senhaInput);
      if (!senhaValida) {
        setSenhaError("Senha de usuário incorreta.");
        toast.error("Autenticação não autorizada: senha incorreta.");
        setLoading(false);
        return;
      }

      const activeUser = getActiveUser() || {};
      const responsavelNome = activeUser.nome || activeUser.full_name || activeUser.login || "Farmacêutico";
      const responsavelCrf = activeUser.crf || activeUser.coren || "";

      const { ip, dbName, password } = getPgConfig();
      const nowStr = new Date().toISOString();
      const todayDateStr = nowStr.slice(0, 10);

      const motivoFinal = (motivoPreset === "Outro" && motivoCustom.trim()) 
        ? motivoCustom.trim() 
        : motivoPreset;

      const numLoteAntigo = currentLoteAntigo.numero_lote || "LOTE_ANTIGO";
      const numLoteNovo = currentLoteNovo.numero_lote || "LOTE_NOVO";

      const safeMedNome = (currentMedicamento.nome || "Medicamento").replace(/'/g, "''");
      const safePacNome = (currentPaciente.nome || "Paciente").replace(/'/g, "''");
      const safeAlaNome = (currentPaciente.alaNome || currentPaciente.ala_nome || "Ala Geral").replace(/'/g, "''");
      const safeLeito = (currentPaciente.leito || "S/L").replace(/'/g, "''");
      const safePront = (currentPaciente.prontuario || "N/A").replace(/'/g, "''");
      const safeRespNome = responsavelNome.replace(/'/g, "''");
      const safeRespCrf = responsavelCrf.replace(/'/g, "''");
      const safeMotivo = motivoFinal.replace(/'/g, "''");
      const safeObs = (observacao || "").replace(/'/g, "''");

      // Gerar IDs únicos
      const entradaId = crypto.randomUUID();
      const saidaPerdaId = crypto.randomUUID();
      const saidaNovaId = crypto.randomUUID();
      const auditId = crypto.randomUUID();

      // Construção atômica do lote de comandos SQL
      const queries = [];

      // 1. ENTRADA: Devolução Técnica do Lote Antigo à Farmácia
      queries.push(`
        INSERT INTO "Entrada" (
          "id", "medicamento_id", "medicamento_nome", "fornecedor_nome", 
          "lote_id", "numero_lote", "data_validade", "quantidade", 
          "data_entrada", "tipo", "created_at"
        ) VALUES (
          '${entradaId}', '${currentMedicamento.id}', '${safeMedNome}', 
          'Retorno p/ Troca de Validade - Paciente: ${safePacNome} (${safePront})', 
          '${currentLoteAntigo.id}', '${numLoteAntigo}', 
          ${currentLoteAntigo.data_validade ? `'${currentLoteAntigo.data_validade}'` : 'NULL'}, 
          ${qtd}, '${todayDateStr}', 'RETORNO_TROCA_VALIDADE', '${nowStr}'
        );
      `);

      // 2. SAÍDA 1: Baixa Oficial por Perda / Incineração do Lote Antigo (Portaria 344)
      queries.push(`
        INSERT INTO "Saida" (
          "id", "medicamento_id", "medicamento_nome", "lote_id", "numero_lote", 
          "quantidade", "destino", "motivo", "observacao", "data_saida", 
          "responsavel", "responsavel_crf", "usuario_nome", "paciente_nome", 
          "created_at"
        ) VALUES (
          '${saidaPerdaId}', '${currentMedicamento.id}', '${safeMedNome}', 
          '${currentLoteAntigo.id}', '${numLoteAntigo}', ${qtd}, 
          'Perda', 
          'Perda por Validade / Troca Técnica (Paciente: ${safePacNome})', 
          'Substituição de ${qtd} un recolhidas da ala do paciente ${safePacNome}. Motivo: ${safeMotivo}. Obs: ${safeObs}', 
          '${todayDateStr}', '${safeRespNome}', '${safeRespCrf}', '${safeRespNome}', 
          '${safePacNome}', '${nowStr}'
        );
      `);

      // 3. SAÍDA 2: Dispensação do Lote Novo ao Paciente (Substituição sem duplicar prescrição)
      queries.push(`
        INSERT INTO "Saida" (
          "id", "medicamento_id", "medicamento_nome", "lote_id", "numero_lote", 
          "quantidade", "destino", "paciente_id", "paciente_nome", "prescricao_id", 
          "ala_id", "ala_nome", "motivo", "observacao", "data_saida", 
          "responsavel", "responsavel_crf", "usuario_nome", "is_baixa_lote_paciente", 
          "created_at"
        ) VALUES (
          '${saidaNovaId}', '${currentMedicamento.id}', '${safeMedNome}', 
          '${currentLoteNovo.id}', '${numLoteNovo}', ${qtd}, 
          'Paciente ${safePacNome} (Leito: ${safeLeito})', 
          '${currentPaciente.id}', '${safePacNome}', '${currentPrescricao.id}', 
          ${currentPaciente.alaId ? `'${currentPaciente.alaId}'` : 'NULL'}, '${safeAlaNome}', 
          'Substituição de Lote por Validade (Lote ${numLoteAntigo} -> Lote ${numLoteNovo})', 
          'Troca técnica de ${qtd} un: Lote anterior [${numLoteAntigo}] descartado por vencimento e substituído pelo Lote [${numLoteNovo}]. ${safeObs}', 
          '${todayDateStr}', '${safeRespNome}', '${safeRespCrf}', '${safeRespNome}', 
          true, '${nowStr}'
        );
      `);

      // 4. Atualizar Estoque do Lote Novo
      if (localEstoque === "satelite") {
        queries.push(`
          UPDATE "Lote" 
          SET "quantidade_satelite" = GREATEST(0, COALESCE("quantidade_satelite", 0) - ${qtd}) 
          WHERE "id" = '${currentLoteNovo.id}';
        `);
      } else {
        queries.push(`
          UPDATE "Lote" 
          SET "quantidade_atual" = GREATEST(0, COALESCE("quantidade_atual", 0) - ${qtd}) 
          WHERE "id" = '${currentLoteNovo.id}';
        `);
      }

      // 5. Atualizar Estoque Geral do Medicamento
      if (localEstoque === "satelite") {
        queries.push(`
          UPDATE "Medicamento" 
          SET "estoque_satelite" = GREATEST(0, COALESCE("estoque_satelite", 0) - ${qtd}) 
          WHERE "id" = '${currentMedicamento.id}';
        `);
      } else {
        queries.push(`
          UPDATE "Medicamento" 
          SET "quantidade" = GREATEST(0, COALESCE("quantidade", 0) - ${qtd}) 
          WHERE "id" = '${currentMedicamento.id}';
        `);
      }

      // 6. Atualizar observação da Prescrição com carimbo auditado
      const notaPrescricao = ` [Troca por Validade em ${format(new Date(), "dd/MM/yyyy HH:mm")}: ${qtd}un Lote ${numLoteAntigo} trocadas pelo Lote ${numLoteNovo}]`;
      queries.push(`
        UPDATE "PrescricaoPaciente" 
        SET "observacoes" = COALESCE("observacoes", '') || '${notaPrescricao.replace(/'/g, "''")}' 
        WHERE "id" = '${currentPrescricao.id}';
      `);

      // 7. Registro de Auditoria Institucional
      const detalhesAudit = `Substituição de lote por validade: ${qtd}un de '${safeMedNome}' do paciente '${safePacNome}'. Lote recolhido e baixado por perda: ${numLoteAntigo}. Novo lote dispensado: ${numLoteNovo}. Motivo: ${safeMotivo}`;
      queries.push(`
        INSERT INTO "Auditoria" (
          "id", "acao", "entidade", "entidade_id", "detalhes", "usuario", "data_hora", "created_at"
        ) VALUES (
          '${auditId}', 'SUBSTITUICAO_LOTE_VALIDADE', 'PrescricaoPaciente', 
          '${currentPrescricao.id}', '${detalhesAudit.replace(/'/g, "''")}', 
          '${safeRespNome}', '${nowStr}', '${nowStr}'
        );
      `);

      // 8. Notificações em tempo real
      queries.push(`NOTIFY app_update; NOTIFY table_change;`);

      // Executa toda a transação atômica
      const batchSql = `BEGIN;\n${queries.join("\n")}\nCOMMIT;`;
      await invoke("execute_postgres", { ip, dbName, password, query: batchSql });

      toast.success("Substituição de lote realizada com sucesso!", {
        description: `${qtd} un do Lote ${numLoteAntigo} foram baixadas por perda e substituídas pelo Lote ${numLoteNovo} no Livro e Prontuário.`,
      });

      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (e) {
      console.error("Erro ao efetuar substituição de lote:", e);
      toast.error("Erro ao efetuar substituição: " + (e.message || e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <RefreshCw className="w-5 h-5 animate-spin-slow" />
            <DialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Substituição de Lote por Validade (Troca Técnica)
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            Substitua com segurança medicamentos que estão vencendo na posse do paciente, registrando a 
            <strong> perda oficial</strong> do lote recolhido e a <strong>saída balanceada</strong> do novo lote no Livro da Portaria 344.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Alerta de Portaria 344 se for controlado */}
          {isControlado344 && (
            <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-xl flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
              <div className="leading-tight">
                <span className="font-bold text-purple-900 dark:text-purple-200">
                  Medicamento Sujeito a Controle Especial (Portaria 344/98)
                </span>
                <p className="text-[11px] text-purple-700 dark:text-purple-300 mt-0.5">
                  O sistema gerará automaticamente o retorno técnico do lote vencido, o lançamento de 
                  <strong> Perda Oficial por Vencimento</strong> no Livro de Registro e a saída do novo lote para o paciente sem duplicar o consumo prescrito.
                </p>
              </div>
            </div>
          )}

          {/* Seleção do Paciente */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
              <User className="w-3.5 h-3.5 text-sky-600" /> Paciente
            </Label>
            <Select
              value={selectedPacienteId}
              onValueChange={(val) => {
                setSelectedPacienteId(val);
                setSelectedPrescricaoId("");
              }}
            >
              <SelectTrigger className="w-full text-xs">
                <SelectValue placeholder="Selecione o paciente..." />
              </SelectTrigger>
              <SelectContent className="max-h-56">
                {pacientes.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)} className="text-xs">
                    {p.nome} — Prontuário: {p.prontuario || "S/P"} ({p.alaNome || p.ala_nome || "Geral"} • Leito: {p.leito || "S/L"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Seleção da Prescrição / Medicamento */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
              <Package className="w-3.5 h-3.5 text-emerald-600" /> Medicamento Prescrito
            </Label>
            {prescricoesDoPaciente.length === 0 ? (
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-xs">
                Nenhuma prescrição ativa encontrada para este paciente.
              </div>
            ) : (
              <Select
                value={selectedPrescricaoId}
                onValueChange={(val) => setSelectedPrescricaoId(val)}
              >
                <SelectTrigger className="w-full text-xs">
                  <SelectValue placeholder="Selecione a prescrição..." />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {prescricoesDoPaciente.map((pr) => (
                    <SelectItem key={pr.id} value={String(pr.id)} className="text-xs">
                      {pr.medicamentoNome} {pr.concentracao ? `(${pr.concentracao})` : ""} — {pr.esquemaPosologico || "Posologia Ativa"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Card Duplo: Lote a Recolher (Antigo) vs Novo Lote para Entrega */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {/* Lote Antigo (Recolher e Dar Perda) */}
            <div className="p-3 bg-red-50/60 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-red-800 dark:text-red-300 flex items-center gap-1">
                  <CalendarX2 className="w-3.5 h-3.5 text-red-600" /> 1. Lote a Recolher (Perda)
                </span>
                <Badge variant="outline" className="text-[10px] bg-red-100 text-red-700 border-red-200">
                  Descarte Oficial
                </Badge>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-slate-600 dark:text-slate-400">Lote Vencendo / Vencido:</Label>
                {lotesRecolherCandidatos.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">Nenhum lote associado.</p>
                ) : (
                  <Select value={loteAntigoId} onValueChange={(val) => setLoteAntigoId(val)}>
                    <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-900 border-red-200">
                      <SelectValue placeholder="Selecione o lote..." />
                    </SelectTrigger>
                    <SelectContent>
                      {lotesRecolherCandidatos.map((l) => (
                        <SelectItem key={l.id} value={String(l.id)} className="text-xs">
                          {l.numero_lote} (Val: {l.data_validade ? format(new Date(l.data_validade), "dd/MM/yy") : "-"})
                          {l.diasVencimento < 0 ? " ❌ VENCIDO" : ` ⚠️ (${l.diasVencimento}d)`}
                          {l.isUtilizado ? " • Entregue ao Paciente" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {currentLoteAntigo && (
                <div className="text-[10px] text-red-700 dark:text-red-300 bg-red-100/70 dark:bg-red-900/40 p-2 rounded-lg leading-tight">
                  <p><strong>Validade:</strong> {currentLoteAntigo.data_validade ? format(new Date(currentLoteAntigo.data_validade), "dd/MM/yyyy") : "Não informada"}</p>
                  <p className="mt-0.5">
                    {currentLoteAntigo.diasVencimento < 0
                      ? `Vencido há ${Math.abs(currentLoteAntigo.diasVencimento)} dias!`
                      : `Vence em ${currentLoteAntigo.diasVencimento} dias.`}
                  </p>
                </div>
              )}
            </div>

            {/* Lote Novo (Substituir e Dispensar) */}
            <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> 2. Novo Lote (Reposição)
                </span>
                <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">
                  Estoque Disponível
                </Badge>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] text-slate-600 dark:text-slate-400">Origem:</Label>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setLocalEstoque("satelite")}
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded font-semibold transition-all",
                        localEstoque === "satelite" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                      )}
                    >
                      Satélite
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocalEstoque("central")}
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded font-semibold transition-all",
                        localEstoque === "central" ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                      )}
                    >
                      Central
                    </button>
                  </div>
                </div>

                {lotesReposicaoDisponiveis.length === 0 ? (
                  <p className="text-[11px] text-amber-600 font-semibold italic p-1 bg-amber-50 rounded">
                    Nenhum lote com saldo positivo e validade futura encontrado na {localEstoque === "satelite" ? "Satélite" : "Central"}!
                  </p>
                ) : (
                  <Select value={selectedNovoLoteId} onValueChange={(val) => setSelectedNovoLoteId(val)}>
                    <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-900 border-emerald-200">
                      <SelectValue placeholder="Selecione o novo lote..." />
                    </SelectTrigger>
                    <SelectContent>
                      {lotesReposicaoDisponiveis.map((l, idx) => (
                        <SelectItem key={l.id} value={String(l.id)} className="text-xs">
                          {l.numero_lote} (Val: {l.data_validade ? format(new Date(l.data_validade), "dd/MM/yy") : "-"} — Saldo: {l.saldoDisponivel} un)
                          {idx === 0 ? " 🌟 [FEFO]" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {currentLoteNovo && (
                <div className="text-[10px] text-emerald-800 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/40 p-2 rounded-lg leading-tight">
                  <p><strong>Novo Lote:</strong> {currentLoteNovo.numero_lote} • <strong>Validade:</strong> {currentLoteNovo.data_validade ? format(new Date(currentLoteNovo.data_validade), "dd/MM/yyyy") : "-"}</p>
                  <p className="mt-0.5"><strong>Saldo Disponível:</strong> {currentLoteNovo.saldoDisponivel} unidades</p>
                </div>
              )}
            </div>
          </div>

          {/* Quantidade a Trocar & Motivo */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center justify-between text-slate-700 dark:text-slate-200">
                <span>Quantidade a Substituir:</span>
                <span className="text-[10px] text-slate-400 font-normal">Máx disponível: {saldoNovoLote} un</span>
              </Label>
              <Input
                type="number"
                min="1"
                max={saldoNovoLote || 9999}
                value={qtdTroca}
                onChange={(e) => setQtdTroca(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="h-9 text-xs font-bold"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Motivo da Substituição:
              </Label>
              <Select value={motivoPreset} onValueChange={(val) => setMotivoPreset(val)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione o motivo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Validade Próxima (Prevenção)">Validade Próxima (Prevenção)</SelectItem>
                  <SelectItem value="Validade Vencida na Ala">Validade Vencida na Ala</SelectItem>
                  <SelectItem value="Avaria / Troca Técnica">Avaria / Troca Técnica</SelectItem>
                  <SelectItem value="Recolhimento Preventivo pela Farmácia">Recolhimento Preventivo pela Farmácia</SelectItem>
                  <SelectItem value="Outro">Outro Motivo...</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {motivoPreset === "Outro" && (
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Descreva o Motivo:</Label>
              <Input
                type="text"
                placeholder="Ex: Frasco com alteração física / lote sob recolhimento ANVISA..."
                value={motivoCustom}
                onChange={(e) => setMotivoCustom(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          )}

          {/* Observações Opcionais */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Observações Adicionais (opcional):
            </Label>
            <Input
              type="text"
              placeholder="Ex: Entregue à Enfª Responsável no plantão diurno..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              className="h-8 text-xs"
            />
          </div>

          {/* Resumo da Operação Contábil e Regulatória */}
          <div className="p-3 bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
            <div className="flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-100">
              <FileCheck2 className="w-3.5 h-3.5 text-sky-600" />
              <span>Conformidade com o Livro da Portaria 344 e Prontuário:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[10.5px]">
              <li>
                <strong>1. Devolução Técnica:</strong> Registra a devolução de {qtdTroca} un do Lote [{currentLoteAntigo?.numero_lote || "Antigo"}] à farmácia.
              </li>
              <li>
                <strong>2. Descarte Oficial:</strong> Dá saída por <strong>Perda por Vencimento</strong> no Livro da Portaria 344 para incineração legal.
              </li>
              <li>
                <strong>3. Dispensação de Reposição:</strong> Dá saída de {qtdTroca} un do Lote [{currentLoteNovo?.numero_lote || "Novo"}] ao paciente sem duplicar as doses prescritas.
              </li>
            </ul>
          </div>

          {/* Autenticação com Senha do Usuário */}
          <div className="space-y-1.5 pt-1 border-t">
            <Label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-600" /> Senha de Usuário para Autorização:
            </Label>
            <Input
              type="password"
              placeholder="Digite sua senha de acesso ao sistema..."
              value={senhaInput}
              onChange={(e) => {
                setSenhaInput(e.target.value);
                setSenhaError("");
              }}
              className={cn("h-9 text-xs", senhaError && "border-red-500 focus-visible:ring-red-500")}
            />
            {senhaError && <p className="text-[11px] font-bold text-red-600">{senhaError}</p>}
          </div>
        </div>

        <DialogFooter className="border-t pt-3 flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleConfirmarTroca}
            disabled={loading || !currentLoteNovo || saldoNovoLote < qtdTroca}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1.5 shadow-sm"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
            {loading ? "Processando Troca..." : "Confirmar Substituição de Lote"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TrocaLoteValidadeModal;
