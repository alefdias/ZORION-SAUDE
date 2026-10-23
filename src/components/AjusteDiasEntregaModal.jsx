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
  SelectGroup,
  SelectLabel,
  SelectSeparator,
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
  Filter,
  CheckSquare,
  Square,
  Calendar,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { safeFormatDate } from "@/utils/dateUtils";
import { calcularLotesSatelite } from "@/utils/sateliteLoteUtils";

export function AjusteDiasEntregaModal({
  open,
  onOpenChange,
  patient,
  prescricoes = [],
  medicamentos = [],
  lotes = [],
  onSuccess,
}) {
  const hoje = useMemo(() => new Date(), []);
  const hojeStr = useMemo(() => format(hoje, "yyyy-MM-dd"), [hoje]);

  // Data de referência da receita / alteração (padrão: hoje)
  const [dataFiltroReceita, setDataFiltroReceita] = useState(hojeStr);
  const [apenasDataReferencia, setApenasDataReferencia] = useState(true);

  const [dataFimCiclo, setDataFimCiclo] = useState("");
  const [selectedPrescIds, setSelectedPrescIds] = useState(new Set());
  const [customDias, setCustomDias] = useState({});
  const [customQtds, setCustomQtds] = useState({});
  const [selectedLotes, setSelectedLotes] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [internalLotes, setInternalLotes] = useState([]);
  const [internalMedicamentos, setInternalMedicamentos] = useState([]);

  const [internalTransferencias, setInternalTransferencias] = useState([]);
  const [internalPedidosSatelite, setInternalPedidosSatelite] = useState([]);
  const [internalSaidas, setInternalSaidas] = useState([]);

  // Busca lotes, medicamentos e movimentações da satélite frescos diretamente do banco ao abrir o modal
  useEffect(() => {
    if (!open) return;
    let isMounted = true;
    Promise.all([
      db.entities.Lote.list().catch(() => []),
      db.entities.Medicamento.list().catch(() => []),
      db.entities.TransferenciaPendente ? db.entities.TransferenciaPendente.list().catch(() => []) : Promise.resolve([]),
      db.entities.PedidoSatelite ? db.entities.PedidoSatelite.list().catch(() => []) : Promise.resolve([]),
      db.entities.Saida ? db.entities.Saida.list().catch(() => []) : Promise.resolve([]),
    ]).then(([lotesData, medsData, transfData, pedidosData, saidasData]) => {
      if (isMounted) {
        if (Array.isArray(lotesData)) setInternalLotes(lotesData);
        if (Array.isArray(medsData)) setInternalMedicamentos(medsData);
        if (Array.isArray(transfData)) setInternalTransferencias(transfData);
        if (Array.isArray(pedidosData)) setInternalPedidosSatelite(pedidosData);
        if (Array.isArray(saidasData)) setInternalSaidas(saidasData);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [open]);

  // Lista unificada de medicamentos
  const todosMedicamentos = useMemo(() => {
    const list = [...(medicamentos || []), ...internalMedicamentos];
    const map = new Map();
    for (const m of list) {
      if (m && m.id && !map.has(String(m.id))) {
        map.set(String(m.id), m);
      }
    }
    return Array.from(map.values());
  }, [medicamentos, internalMedicamentos]);

  // Mapa rápido de medicamentos por ID
  const medsMap = useMemo(() => {
    const map = new Map();
    for (const m of todosMedicamentos) {
      if (m?.id) map.set(String(m.id), m);
    }
    return map;
  }, [todosMedicamentos]);

  // Lista unificada e completa de lotes
  const todosLotes = useMemo(() => {
    const list = [...(lotes || []), ...internalLotes];
    const map = new Map();
    for (const l of list) {
      if (l && l.id && !map.has(String(l.id))) {
        map.set(String(l.id), l);
      }
    }
    return Array.from(map.values());
  }, [lotes, internalLotes]);

  // Lotes enriquecidos com nome e código do medicamento vinculado
  const lotesEnriquecidos = useMemo(() => {
    return todosLotes.map((l) => {
      const medId = String(l.medicamento_id || l.medicamentoId || "");
      const medObj = medsMap.get(medId);
      return {
        ...l,
        medicamento_nome: l.medicamento_nome || medObj?.nome || "",
        medicamento_codigo: l.medicamento_codigo || medObj?.codigo || "",
      };
    });
  }, [todosLotes, medsMap]);

  // Normalização fonética e de caracteres para matching infalível de nomes de medicamentos
  const normalize = (str) =>
    (str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, " ")
      .trim();

  const namesMatch = (nameA, nameB) => {
    const a = normalize(nameA);
    const b = normalize(nameB);
    if (!a || !b) return false;
    if (a === b) return true;
    const cleanA = a.replace(/\b(comprimido|cp|frasco|ampola|gotas)\b/g, "").replace(/\s+/g, " ").trim();
    const cleanB = b.replace(/\b(comprimido|cp|frasco|ampola|gotas)\b/g, "").replace(/\s+/g, " ").trim();
    return cleanA === cleanB;
  };

  // Função para extrair a dose diária mesmo se totalDiario for ausente, somando slots de horários ou analisando esquema
  const extrairDoseDiaria = (pr) => {
    if (!pr) return 1;

    // 1. Campo explícito totalDiario ou dose_diaria
    const tot = parseFloat(pr.totalDiario || pr.total_diario || pr.dose_diaria);
    if (tot && tot > 0) return tot;

    // 2. Soma de doses por horários (slots padrão hospitalares)
    const hDoses = [
      pr.dose08, pr.dose14, pr.dose22, pr.dose06,
      pr.dose07, pr.dose13, pr.dose19, pr.dose01,
      pr.doseManha, pr.doseTarde, pr.doseNoite, pr.doseMadrugada
    ];
    const somaSlots = hDoses.reduce((acc, d) => {
      const val = parseFloat(d);
      return acc + (val > 0 ? val : 0);
    }, 0);
    if (somaSlots > 0) return somaSlots;

    // 3. Esquema posológico com traço (ex: "1-0-1-0", "1 - 0 - 1", "1/0/1/0")
    const esquema = String(pr.esquemaPosologico || pr.esquema_posologico || pr.posologia || "");
    const partesTraco = esquema.split(/[-/]/);
    if (partesTraco.length >= 2) {
      const somaPartes = partesTraco.reduce((acc, p) => {
        const v = parseFloat(p.trim());
        return acc + (v > 0 ? v : 0);
      }, 0);
      if (somaPartes > 0) return somaPartes;
    }

    // 4. Frequência descritiva (12/12h, 8/8h, etc.)
    const doseUnit = parseFloat(pr.dose || pr.quantidade || pr.dose_unitaria) || 1;
    const freq = (pr.frequencia || pr.esquemaPosologico || "").toLowerCase();
    if (freq.includes("12/12") || freq.includes("12 em 12") || freq.includes("2x") || freq.includes("2 vezes")) {
      return doseUnit * 2;
    }
    if (freq.includes("8/8") || freq.includes("8 em 8") || freq.includes("3x") || freq.includes("3 vezes")) {
      return doseUnit * 3;
    }
    if (freq.includes("6/6") || freq.includes("6 em 6") || freq.includes("4x") || freq.includes("4 vezes")) {
      return doseUnit * 4;
    }
    if (freq.includes("24/24") || freq.includes("1x") || freq.includes("1 vez") || freq.includes("diario")) {
      return doseUnit * 1;
    }

    return doseUnit > 0 ? doseUnit : 1;
  };

  // Função para calcular estritamente os lotes existentes na Farmácia Satélite
  const calcularLotesSateliteLocal = (medId, medNome, saldoTotalSat, lotesCandidatos) => {
    return calcularLotesSatelite({
      medId,
      medNome,
      saldoTotalSat,
      lotes: lotesCandidatos,
      transferencias: internalTransferencias,
      pedidosSatelite: internalPedidosSatelite,
      saidas: internalSaidas,
    });
  };

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
      const coberturas = activePrescs
        .map((pr) => pr.coberto_ate)
        .filter((d) => d && d >= hojeStr)
        .sort();
      if (coberturas.length > 0) {
        cicloFinal = coberturas[coberturas.length - 1];
      }
    }

    if (!cicloFinal || cicloFinal < hojeStr) {
      cicloFinal = format(addDays(hoje, 7), "yyyy-MM-dd");
    }

    setDataFimCiclo(cicloFinal);
    setDataFiltroReceita(hojeStr);
    setApenasDataReferencia(true);
  }, [open, patient, activePrescs, hoje, hojeStr]);

  // Dias restantes do ciclo geral do paciente
  const diasRestantesCiclo = useMemo(() => {
    if (!dataFimCiclo) return 1;
    const dFim = parseISO(dataFimCiclo);
    if (!isValid(dFim)) return 1;
    const diff = differenceInCalendarDays(dFim, hoje);
    return Math.max(1, diff + 1);
  }, [dataFimCiclo, hoje]);

  // Função para definir ciclo rápido (ex: 8 dias padrão) pré-preenchendo a data de fechamento e dias a entregar
  const handleSetCicloDias = (numDias) => {
    const d = Math.max(1, parseInt(numDias) || 8);
    const novaDataFim = format(addDays(hoje, d - 1), "yyyy-MM-dd");
    setDataFimCiclo(novaDataFim);
    setCustomDias({});
    setCustomQtds({});
  };

  // Função para verificar se a prescrição teve receita / alteração na data especificada
  const teveAlteracaoNaData = (pr, dataAlvo) => {
    if (!dataAlvo) return true;
    const alvoISO = dataAlvo.split("T")[0];
    const dAlt = pr.data_alteracao?.split("T")[0];
    const dIni = (pr.dataInicio || pr.data_inicio)?.split("T")[0];
    const dCrea = pr.created_at?.split("T")[0];
    const dUpd = pr.updated_at?.split("T")[0];

    // ATENÇÃO: data_ultima_dispensacao indica quando a farmácia realizou a ENTREGA física,
    // NÃO representa uma nova alteração de receita médica pelo doutor.
    // Portanto, NÃO incluir dDisp === alvoISO para não fazer itens já entregues continuarem aparecendo como novas alterações.
    if (dAlt === alvoISO || dIni === alvoISO || dCrea === alvoISO || dUpd === alvoISO) {
      return true;
    }

    // Procura por formato brasileiro (ex: 11/10/2026 ou 11/10) nas observações
    try {
      const partes = alvoISO.split("-");
      if (partes.length === 3) {
        const diaMesAno = `${partes[2]}/${partes[1]}/${partes[0]}`;
        const diaMes = `${partes[2]}/${partes[1]}`;
        const obs = (pr.observacoes || "") + " " + (pr.historico_alteracoes || "") + " " + (pr.motivo_alteracao || "");
        if (obs.includes(diaMesAno) || obs.includes(diaMes)) return true;
      }
    } catch (e) {}

    return false;
  };

  // Calcula para cada prescrição a dose diária atual vs anterior e o teto de dias do tratamento
  const prescAnalise = useMemo(() => {
    return activePrescs
      .filter((pr) => {
        if (!apenasDataReferencia) return true;
        return teveAlteracaoNaData(pr, dataFiltroReceita);
      })
      .map((pr) => {
        const prMedId = String(pr.medicamentoId || pr.medicamento_id || "");
        const prMedNome = pr.medicamentoNome || pr.medicamento_nome || "";
        const prMedCodigo = pr.medicamentoCodigo || pr.medicamento_codigo || "";

        const med = todosMedicamentos.find(
          (m) =>
            (m.id && String(m.id) === prMedId) ||
            (m.codigo && prMedCodigo && m.codigo === prMedCodigo) ||
            (m.nome && prMedNome && namesMatch(m.nome, prMedNome))
        );

        const medId = med?.id || prMedId;
        const medNome = med?.nome || prMedNome;

        // Dose diária atual da prescrição (analisando totalDiario, horários e esquemas como 1-0-1-0)
        const doseAtual = extrairDoseDiaria(pr);

        // Dose dispensada no último lote
        const doseAnterior =
          pr.dose_diaria_dispensada !== undefined &&
          pr.dose_diaria_dispensada !== null
            ? parseFloat(pr.dose_diaria_dispensada)
            : null;

        const isNova = doseAnterior === null || doseAnterior === undefined;
        const diferencaDose = isNova ? doseAtual : doseAtual - doseAnterior;

        // ── REGRA DE DURAÇÃO DO TRATAMENTO ────────────────────────────────────
        // Se o medicamento foi prescrito com duração definida (ex: 5 dias), ele só entrega até o fim do tratamento!
        let diasTratamento = null;
        let dataFimTratamentoStr = null;

        const dFimRaw = pr.dataFim || pr.data_fim;
        if (dFimRaw) {
          const dFimParsed = parseISO(dFimRaw.split("T")[0]);
          if (isValid(dFimParsed)) {
            dataFimTratamentoStr = format(dFimParsed, "yyyy-MM-dd");
            const diffDias = differenceInCalendarDays(dFimParsed, hoje) + 1;
            if (diffDias > 0) {
              diasTratamento = diffDias;
            }
          }
        }

        // Se houver duração em dias registrada diretamente na prescrição
        const duracaoDiasCampo = parseInt(pr.duracao_dias || pr.dias_tratamento || pr.dias, 10);
        if (duracaoDiasCampo > 0 && !diasTratamento) {
          diasTratamento = duracaoDiasCampo;
          dataFimTratamentoStr = format(addDays(hoje, diasTratamento - 1), "yyyy-MM-dd");
        }

        // Tenta detectar menção de dias nas observações ou esquema (ex: "5 dias", "por 7 dias")
        if (!diasTratamento) {
          const matchDias =
            (pr.observacoes || "").match(/(\d+)\s*(?:dias|dia)/i) ||
            (pr.esquemaPosologico || "").match(/(\d+)\s*(?:dias|dia)/i);
          if (matchDias) {
            const num = parseInt(matchDias[1], 10);
            if (num > 0) {
              diasTratamento = num;
              dataFimTratamentoStr = format(addDays(hoje, num - 1), "yyyy-MM-dd");
            }
          }
        }

        // Data limite alvo desta medicação (menor entre fim do tratamento e o ciclo do paciente)
        const dataAlvoFimStr = (dataFimTratamentoStr && dataFimCiclo)
          ? (dataFimTratamentoStr < dataFimCiclo ? dataFimTratamentoStr : dataFimCiclo)
          : (dataFimTratamentoStr || dataFimCiclo || format(addDays(hoje, 6), "yyyy-MM-dd"));

        // O teto de dias para este medicamento é o menor entre o fim do tratamento e o ciclo do paciente
        const diasSugeridos = diasTratamento
          ? Math.min(diasRestantesCiclo, diasTratamento)
          : diasRestantesCiclo;

        // ── REGRA DE COBERTURA / JÁ DISPENSADO ──────────────────────────────────
        let cobertoAteStr = null;
        if (pr.coberto_ate) {
          try {
            const cobP = parseISO(pr.coberto_ate.split("T")[0]);
            if (isValid(cobP)) {
              cobertoAteStr = format(cobP, "yyyy-MM-dd");
            }
          } catch (e) {}
        }

        const dataUltimaDispStr = pr.data_ultima_dispensacao
          ? pr.data_ultima_dispensacao.split("T")[0]
          : null;
        const dispensadoHoje = dataUltimaDispStr === hojeStr;

        // Já está 100% coberto se coberto_ate cobre até ou além da data alvo
        const estaTotalmenteCoberto = Boolean(cobertoAteStr && cobertoAteStr >= dataAlvoFimStr);

        // Se foi dispensado hoje e já cobre a partir de hoje (sem aumento de dose)
        const dispensadoHojeValido = Boolean(
          dispensadoHoje &&
          cobertoAteStr &&
          cobertoAteStr >= hojeStr &&
          (!diferencaDose || diferencaDose <= 0)
        );

        let jaDispensado = estaTotalmenteCoberto || dispensadoHojeValido;

        // Dias restantes reais
        let diasRestantes = diasSugeridos;
        if (jaDispensado) {
          diasRestantes = 0;
        } else if (cobertoAteStr && cobertoAteStr >= hojeStr) {
          const diffRestante = differenceInCalendarDays(parseISO(dataAlvoFimStr), parseISO(cobertoAteStr));
          diasRestantes = Math.max(0, diffRestante);
          if (diasRestantes === 0) {
            jaDispensado = true;
          }
        }

        const maxDiasPermitidos = Math.max(1, diasRestantes || diasSugeridos || 1);
        const diasFinais = jaDispensado
          ? 0
          : (customDias[pr.id] !== undefined
              ? Math.min(maxDiasPermitidos, Math.max(1, parseInt(customDias[pr.id]) || 1))
              : maxDiasPermitidos);

        // Dose efetiva a dispensar (diferença se aumento, ou dose cheia se nova medicação)
        const doseEfetiva = jaDispensado
          ? 0
          : (diferencaDose > 0 && doseAnterior !== null
              ? diferencaDose
              : (doseAtual > 0 ? doseAtual : 1));

        const qtdSugerida = jaDispensado ? 0 : Math.max(1, Math.ceil(doseEfetiva * diasFinais));

        const saldoTotalSat = Number(med?.estoque_satelite) || 0;

        // Candidatos de lotes para este medicamento
        const lotesCandidatos = lotesEnriquecidos.filter((l) => {
          const lMedId = String(l.medicamento_id || l.medicamentoId || "");
          if (lMedId && (lMedId === String(medId) || lMedId === prMedId || (med?.id && lMedId === String(med.id)))) {
            return true;
          }
          if (l.medicamento_nome && (namesMatch(l.medicamento_nome, medNome) || namesMatch(l.medicamento_nome, prMedNome))) {
            return true;
          }
          if (med?.codigo && l.medicamento_codigo && l.medicamento_codigo === med.codigo) {
            return true;
          }
          if (pr.lote_id && String(l.id) === String(pr.lote_id)) {
            return true;
          }
          if (pr.numero_lote && l.numero_lote && l.numero_lote.trim().toUpperCase() === pr.numero_lote.trim().toUpperCase()) {
            return true;
          }
          return false;
        });

        // FILTRO ESTRITO DA SATÉLITE: Pega EXCLUSIVAMENTE lotes que existem na Farmácia Satélite
        const medLotes = calcularLotesSateliteLocal(medId, medNome, saldoTotalSat, lotesCandidatos);

        return {
          pr,
          med,
          doseAtual,
          doseAnterior,
          isNova,
          diferencaDose,
          diasTratamento,
          dataFimTratamentoStr,
          dataAlvoFimStr,
          cobertoAteStr,
          dispensadoHoje,
          jaDispensado,
          diasSugeridos,
          diasRestantes,
          diasFinais,
          qtdSugerida,
          medLotes,
          estoqueSatelite: saldoTotalSat,
        };
      });
  }, [
    activePrescs,
    todosMedicamentos,
    lotesEnriquecidos,
    internalTransferencias,
    internalPedidosSatelite,
    internalSaidas,
    diasRestantesCiclo,
    dataFiltroReceita,
    apenasDataReferencia,
    customDias,
    hoje,
    hojeStr,
  ]);

  // Inicializa a seleção automaticamente apenas quando o modal for aberto ou quando a lista de itens mudar
  useEffect(() => {
    if (!open) return;
    const initialSelected = new Set();
    const initialQtds = {};
    const initialDias = {};

    prescAnalise.forEach((item) => {
      // Auto-seleciona APENAS se NÃO estiver já dispensado e tiver quantidade maior que 0
      if (!item.jaDispensado && item.qtdSugerida > 0) {
        initialSelected.add(item.pr.id);
        initialQtds[item.pr.id] = item.qtdSugerida;
        initialDias[item.pr.id] = item.diasFinais;
      }
    });

    setSelectedPrescIds(initialSelected);
    setCustomQtds(initialQtds);
    setCustomDias(initialDias);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dataFiltroReceita, apenasDataReferencia]);

  // Toggle de seleção individual por medicamento
  const toggleSelect = (prId, item) => {
    if (item.jaDispensado) {
      toast.info(`"${item.pr.medicamentoNome}" já foi dispensado e está coberto até ${item.cobertoAteStr ? format(parseISO(item.cobertoAteStr), "dd/MM/yyyy") : "o final do ciclo"}. Não pode ser dispensado novamente.`);
      return;
    }
    setSelectedPrescIds((prev) => {
      const next = new Set(prev);
      if (next.has(prId)) {
        next.delete(prId);
      } else {
        next.add(prId);
        if (customQtds[prId] === undefined) {
          setCustomQtds((q) => ({
            ...q,
            [prId]: item.qtdSugerida || 1,
          }));
        }
        if (customDias[prId] === undefined) {
          setCustomDias((d) => ({
            ...d,
            [prId]: item.diasFinais || 1,
          }));
        }
      }
      return next;
    });
  };

  // Selecionar ou desmarcar todos os itens visíveis
  const toggleSelectAll = () => {
    const dispensaveis = prescAnalise.filter((p) => !p.jaDispensado && p.qtdSugerida > 0);
    const dispensaveisIds = new Set(dispensaveis.map((p) => p.pr.id));

    const todosDispensaveisEstaoSelecionados =
      dispensaveis.length > 0 && dispensaveis.every((p) => selectedPrescIds.has(p.pr.id));

    if (todosDispensaveisEstaoSelecionados) {
      setSelectedPrescIds(new Set());
    } else {
      setSelectedPrescIds(dispensaveisIds);
      const newQtds = { ...customQtds };
      const newDias = { ...customDias };
      dispensaveis.forEach((item) => {
        if (newQtds[item.pr.id] === undefined) {
          newQtds[item.pr.id] = item.qtdSugerida || 1;
        }
        if (newDias[item.pr.id] === undefined) {
          newDias[item.pr.id] = item.diasFinais || 1;
        }
      });
      setCustomQtds(newQtds);
      setCustomDias(newDias);
    }
  };

  // Alterar dias de uma prescrição específica
  const handleDiasChange = (prId, diasVal, item) => {
    if (item.jaDispensado) return;
    const maxTeto = item.diasRestantes || item.diasSugeridos || diasRestantesCiclo || 1;
    let d = Math.max(1, parseInt(diasVal) || 1);
    if (d > maxTeto) {
      d = maxTeto;
      toast.warning(`Limite do ciclo atingido: máximo de ${maxTeto} dia(s) para este medicamento.`);
    }
    setCustomDias((prev) => ({ ...prev, [prId]: d }));
    // Recalcula quantidade sugerida multiplicando a dose diária pelos dias
    const doseRef = item.doseAtual > 0 ? item.doseAtual : (item.diferencaDose > 0 ? item.diferencaDose : 1);
    const novaQtd = Math.max(1, Math.ceil(doseRef * d));
    setCustomQtds((prev) => ({ ...prev, [prId]: novaQtd }));
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

        if (item.jaDispensado) {
          throw new Error(
            `"${item.pr.medicamentoNome}" já foi dispensado anteriormente e sua cobertura está ativa até ${item.cobertoAteStr ? format(parseISO(item.cobertoAteStr), "dd/MM/yyyy") : "o final do ciclo"}. Não é permitido dispensar novamente.`
          );
        }

        const qtd =
          customQtds[prescId] !== undefined
            ? Math.max(0, parseInt(customQtds[prescId]) || 0)
            : item.qtdSugerida;

        if (qtd <= 0) continue;

        if (item.estoqueSatelite < qtd) {
          throw new Error(
            `Estoque insuficiente na Farmácia Satélite para: "${item.med?.nome || "Medicamento"}". Necessário: ${qtd} un, Disponível na Satélite: ${item.estoqueSatelite} un. Não é permitido dar baixa usando estoque da Central.`
          );
        }

        const loteId = selectedLotes[prescId] || item.medLotes[0]?.id;
        const loteObj = lotesEnriquecidos.find((l) => l.id === loteId) || item.medLotes.find((l) => l.id === loteId) || item.medLotes[0];

        if (!loteObj) {
          throw new Error(
            `Nenhum lote físico disponível na Farmácia Satélite para "${item.med?.nome || "Medicamento"}". A dispensação requer um lote físico existente.`
          );
        }

        const diasEfetivos =
          customDias[prescId] !== undefined
            ? customDias[prescId]
            : item.diasFinais;

        // Data fim da cobertura desta medicação (limitada estritamente aos dias que foram dispensados)
        const dataFimCoberturaMed = format(
          addDays(hoje, Math.max(1, diasEfetivos) - 1),
          "yyyy-MM-dd"
        );

        itensParaBaixar.push({
          item,
          qtd,
          diasEfetivos,
          dataFimCoberturaMed,
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

      // Executar as saídas e atualizações EXCLUSIVAMENTE na Farmácia Satélite
      const pacNome = patient?.nome || "Paciente";
      const pacLeito = patient?.leito || "S/L";
      const pacAlaId = patient?.alaId || patient?.ala_id || null;
      const pacAlaNome = patient?.alaNome || patient?.ala_nome || "Geral";

      for (const { item, qtd, diasEfetivos, dataFimCoberturaMed, loteObj } of itensParaBaixar) {
        const { pr, med, doseAtual } = item;
        const medId = med?.id || pr.medicamentoId;
        const loteId = loteObj?.id || selectedLotes[pr.id] || pr.lote_id || "SEM_LOTE";
        const numeroLote = loteObj?.numero_lote || pr.numero_lote || "S/ Lote";
        const doseAtualNum = Number.isFinite(doseAtual) ? doseAtual : 0;
        const doseDiariaNum =
          Number.isFinite(item.diferencaDose) && item.diferencaDose > 0
            ? item.diferencaDose
            : doseAtualNum;

        let dataFimFmt = dataFimCoberturaMed;
        try {
          dataFimFmt = format(parseISO(dataFimCoberturaMed), "dd/MM/yyyy");
        } catch (e) {}

        // 1. Debitar EXCLUSIVAMENTE do estoque_satelite (NUNCA toca no lote físico ou estoque da Central)
        // 1. Debitar EXCLUSIVAMENTE do estoque_satelite (NUNCA toca no lote físico ou estoque da Central)
        if (med && medId) {
          try {
            await db.entities.Medicamento.update(medId, {
              estoque_satelite: Math.max(0, (med.estoque_satelite || 0) - qtd),
            });
          } catch (medErr) {
            console.warn("Aviso ao atualizar estoque satélite do medicamento:", medErr);
          }
        }

        // 2. Gravar registro em Saida com cobertura e lote rastreável
        const loteIdVal = (loteObj?.id && loteObj.id !== "SEM_LOTE")
          ? loteObj.id
          : (selectedLotes[pr.id] && selectedLotes[pr.id] !== "SEM_LOTE"
            ? selectedLotes[pr.id]
            : (pr.lote_id && pr.lote_id !== "SEM_LOTE" ? pr.lote_id : null));

        await db.entities.Saida.create({
          medicamento_id: medId,
          medicamento_nome: pr.medicamentoNome || (med ? med.nome : "Medicamento"),
          lote_id: loteIdVal,
          numero_lote: numeroLote,
          quantidade: qtd,
          tipo: "Dispensação Paciente",
          destino: `Paciente ${pacNome} (Leito: ${pacLeito})`,
          paciente_nome: pacNome,
          paciente_id: patient?.id || null,
          prescricao_id: pr.id,
          ala_id: pacAlaId,
          ala_nome: pacAlaNome,
          motivo: "Ajuste de Dias de Entrega (Complemento de Ciclo)",
          observacao: `Ajuste de ${qtd} un para cobertura de ${diasEfetivos} dias (até ${dataFimFmt}) | Dose: ${doseAtualNum} un/dia | Lote: ${numeroLote}`,
          data_saida: hojeStr,
          created_at: nowStr,
          responsavel: responsavel,
          responsavel_crf: responsavelCrf,
          usuario_nome: responsavel,
          dias_cobertura: diasEfetivos,
          data_inicio_cobertura: hojeStr,
          data_fim_cobertura: dataFimCoberturaMed,
          dose_diaria: doseDiariaNum,
          is_baixa_lote_paciente: true,
        });

        // 3. Atualizar a prescrição com a nova cobertura calculada
        if (pr?.id) {
          try {
            await db.entities.PrescricaoPaciente.update(pr.id, {
              coberto_ate: dataFimCoberturaMed,
              dose_diaria_dispensada: doseAtualNum,
              data_ultima_dispensacao: hojeStr,
              quantidade_ultimo_lote: qtd,
              ultimo_lote_dias: diasEfetivos,
            });
          } catch (prErr) {
            console.warn("Aviso ao atualizar cobertura da prescrição:", prErr);
          }
        }
      }

      // 4. Atualizar o ciclo geral no paciente de forma segura
      if (patient?.id) {
        try {
          await db.entities.Paciente.update(patient.id, {
            ciclo_coberto_ate: dataFimCiclo || hojeStr,
            data_ultimo_ciclo: hojeStr,
            ultimo_ciclo_dias: diasRestantesCiclo || 1,
            data_ultimo_ajuste_ciclo: hojeStr,
          });
        } catch (pacErr) {
          console.warn("Aviso ao atualizar ciclo do paciente:", pacErr);
        }
      }

      toast.success(
        `Ajuste concluído! ${itensParaBaixar.length} medicamento(s) entregue(s) com sucesso com suas respectivas durações de tratamento.`
      );

      if (onSuccess) {
        try {
          onSuccess();
        } catch (succErr) {
          console.warn("Aviso no onSuccess:", succErr);
        }
      }
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Erro ao realizar ajuste de dias de entrega.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAllSelected =
    prescAnalise.length > 0 &&
    prescAnalise.every((p) => selectedPrescIds.has(p.pr.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[96vw] max-h-[92vh] flex flex-col p-5 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden">
        <DialogHeader className="border-b pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Ajuste de Dias de Entrega (Receitas do Dia & Complemento)
              </DialogTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Equalize a entrega de medicações prescritas ou alteradas no dia para fechar o ciclo do paciente
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1 space-y-4 pt-2">
          {/* Barra de Filtro de Data da Receita e Fechamento do Ciclo */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                    {patient?.nome || "Paciente"}
                  </h3>
                  <Badge variant="outline" className="bg-white text-indigo-700 border-indigo-200 text-xs font-mono font-bold">
                    Pront: {patient?.prontuario || "N/A"}
                  </Badge>
                  <Badge variant="outline" className="bg-white text-indigo-700 border-indigo-200 text-xs font-mono font-bold">
                    Leito: {patient?.leito || "S/L"}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Ala: <strong>{patient?.alaNome || patient?.ala_nome || "Geral"}</strong>
                </p>
              </div>

              {/* Seletor da Data Final do Ciclo e Atalhos */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 shadow-xs shrink-0">
                <div className="flex items-center gap-2">
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
                      className="h-7 text-xs font-bold font-mono px-2 py-0 w-[130px] border-slate-300"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-700 pt-1.5 sm:pt-0 sm:pl-2.5">
                  <span className="text-[10px] text-slate-400 font-bold block sm:hidden">
                    Atalhos:
                  </span>
                  <Button
                    type="button"
                    variant={diasRestantesCiclo === 8 ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSetCicloDias(8)}
                    className="h-6 px-2 text-[11px] font-bold"
                  >
                    8d (Padrão)
                  </Button>
                  <Button
                    type="button"
                    variant={diasRestantesCiclo === 15 ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSetCicloDias(15)}
                    className="h-6 px-2 text-[11px] font-bold"
                  >
                    15d
                  </Button>
                  <Button
                    type="button"
                    variant={diasRestantesCiclo === 30 ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleSetCicloDias(30)}
                    className="h-6 px-2 text-[11px] font-bold"
                  >
                    30d
                  </Button>
                  <div className="text-center pl-1">
                    <span className="text-[10px] text-slate-400 font-bold block leading-none">
                      Ciclo
                    </span>
                    <span className="text-xs font-black text-indigo-600 font-mono">
                      {diasRestantesCiclo}d
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Filtro Obrigatório: Apenas Receitas do Dia */}
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Data da Receita / Alteração:
                </span>
                <Input
                  type="date"
                  value={dataFiltroReceita}
                  onChange={(e) => setDataFiltroReceita(e.target.value)}
                  className="h-7 text-xs font-bold font-mono px-2 py-0 w-[125px] bg-white border-slate-300"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 dark:text-slate-300 font-semibold bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-2xs">
                <input
                  type="checkbox"
                  checked={apenasDataReferencia}
                  onChange={(e) => setApenasDataReferencia(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Exibir apenas receitas alteradas nesta data</span>
              </label>
            </div>
          </div>

          {/* Banner Informativo do Ciclo Fechado */}
          <div className="bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/80 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-600 shrink-0" />
              <span className="text-slate-700 dark:text-slate-300">
                <strong>Ciclo Fechado ({diasRestantesCiclo}d):</strong> As novas receitas e complementos são limitados até <strong>{safeFormatDate(dataFimCiclo)}</strong>. Medicamentos já cobertos até o fim do ciclo ficam com 🔒 0 dias e não geram duplicidade.
              </span>
            </div>
            <Badge className="bg-indigo-600 text-white font-mono shrink-0">
              Até {safeFormatDate(dataFimCiclo)}
            </Badge>
          </div>

          {/* Tabela de Prescrições para Ajuste */}
          <div className="space-y-2">
            <div className="flex justify-between items-center px-1">
              <div className="flex items-center gap-3">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Pill className="w-3.5 h-3.5 text-indigo-600" />
                  Medicamentos Disponíveis para Ajuste ({prescAnalise.length})
                </h4>
                {prescAnalise.length > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={toggleSelectAll}
                    className="h-6 px-2 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50"
                  >
                    {isAllSelected ? "Desmarcar Todos" : "Selecionar Todos"}
                  </Button>
                )}
              </div>
              <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                {selectedPrescIds.size} selecionado(s)
              </span>
            </div>

            {prescAnalise.length === 0 ? (
              <div className="p-8 text-center text-slate-500 border border-dashed rounded-xl bg-slate-50/50 space-y-2">
                <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                <p className="font-bold text-sm text-slate-700">
                  Nenhuma receita ou alteração encontrada em {format(parseISO(dataFiltroReceita), "dd/MM/yyyy")}.
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  O ajuste de dias de entrega é restrito a medicações que tiveram alteração ou inclusão na data selecionada.
                </p>
                {apenasDataReferencia && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setApenasDataReferencia(false)}
                    className="text-xs font-semibold mt-2"
                  >
                    Exibir todas as receitas ativas do paciente
                  </Button>
                )}
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto max-h-[48vh] overflow-y-auto shadow-xs">
                <Table>
                  <TableHeader className="bg-slate-100/90 dark:bg-slate-800 border-b border-slate-200 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-12 text-center">
                        <button
                          type="button"
                          onClick={toggleSelectAll}
                          className="flex items-center justify-center mx-auto text-slate-600 hover:text-indigo-600"
                          title={isAllSelected ? "Desmarcar Todos" : "Selecionar Todos"}
                        >
                          {isAllSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </TableHead>
                      <TableHead className="text-left font-bold text-xs text-slate-700">Medicamento / Posologia</TableHead>
                      <TableHead className="text-center font-bold text-xs text-slate-700">Status / Motivo</TableHead>
                      <TableHead className="text-center font-bold text-xs text-slate-700 w-28">Dias a Entregar</TableHead>
                      <TableHead className="text-center font-bold text-xs text-slate-700">Lote</TableHead>
                      <TableHead className="text-center font-bold text-xs text-slate-700 w-28">
                        <span className="flex items-center justify-center gap-1">
                          Quantidade
                          <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1 py-0.2 rounded border border-indigo-200">
                            Auto 🔒
                          </span>
                        </span>
                      </TableHead>
                      <TableHead className="text-right font-bold text-xs text-slate-700">Saldo Satélite</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {prescAnalise.map((item) => {
                      const {
                        pr,
                        med,
                        doseAtual,
                        doseAnterior,
                        isNova,
                        diferencaDose,
                        diasTratamento,
                        dataFimTratamentoStr,
                        diasFinais,
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
                        selectedLotes[pr.id] || medLotes[0]?.id || (medLotes.length === 0 ? "SEM_LOTE" : "");
                      const selectedLoteObj = medLotes.find((l) => l.id === selectedLoteId);

                      return (
                        <TableRow
                          key={pr.id}
                          onClick={() => !item.jaDispensado && toggleSelect(pr.id, item)}
                          className={cn(
                            "transition-colors select-none",
                            item.jaDispensado
                              ? "opacity-60 bg-slate-50/70 dark:bg-slate-900/40 cursor-not-allowed"
                              : isSelected
                              ? "cursor-pointer bg-indigo-50/70 dark:bg-indigo-950/40 font-medium"
                              : "cursor-pointer hover:bg-slate-50/60"
                          )}
                        >
                          {/* Checkbox de Seleção */}
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              disabled={item.jaDispensado}
                              onChange={() => toggleSelect(pr.id, item)}
                              className={cn(
                                "w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300",
                                item.jaDispensado ? "cursor-not-allowed opacity-40" : "cursor-pointer"
                              )}
                              title={item.jaDispensado ? "Medicamento já entregue e coberto" : "Selecionar para entrega"}
                            />
                          </TableCell>

                          {/* Medicamento e Esquema */}
                          <TableCell className="max-w-[220px]">
                            <p className="font-bold text-xs text-slate-900 dark:text-slate-100 leading-snug">
                              {pr.medicamentoNome}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[11px] font-semibold text-slate-600 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                                {pr.esquemaPosologico}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                ({doseAtual} un/dia)
                              </span>
                            </div>
                          </TableCell>

                          {/* Status / Motivo do Ajuste */}
                          <TableCell className="text-center">
                            {item.jaDispensado ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold shadow-xs">
                                ✅ Já Dispensado ({item.cobertoAteStr ? `até ${format(parseISO(item.cobertoAteStr), "dd/MM/yyyy")}` : "Coberto"})
                              </Badge>
                            ) : isNova ? (
                              <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-[10px] font-bold">
                                🆕 Receita Nova (+{doseAtual} un/dia)
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
                              <Badge
                                variant="outline"
                                className="bg-slate-100 text-slate-600 border-slate-200 text-[10px] font-medium"
                              >
                                Dose Mantida ({doseAtual} un/dia)
                              </Badge>
                            )}
                          </TableCell>

                          {/* Dias a Entregar (com trava automática de fim do tratamento e teto de ciclo) */}
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            {item.jaDispensado ? (
                              <div className="flex flex-col items-center justify-center">
                                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold flex items-center gap-1 shadow-2xs">
                                  <Lock className="w-3 h-3 text-emerald-600" /> 0 dias (Já coberto)
                                </Badge>
                                {item.cobertoAteStr && (
                                  <span className="text-[9px] text-emerald-600 font-mono mt-0.5">
                                    Até {safeFormatDate(item.cobertoAteStr)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <div className="flex items-center justify-center gap-1">
                                  <Input
                                    type="number"
                                    min="1"
                                    max={item.diasRestantes || diasRestantesCiclo}
                                    value={diasFinais}
                                    disabled={!isSelected}
                                    onChange={(e) => handleDiasChange(pr.id, e.target.value, item)}
                                    className="w-16 h-7 text-center font-mono font-bold text-xs bg-white border-slate-300"
                                  />
                                  <span className="text-xs text-slate-600 font-bold">dias</span>
                                </div>
                                <span className="text-[9px] font-semibold text-slate-500 block">
                                  Máx: {item.diasRestantes || diasRestantesCiclo}d (até {safeFormatDate(item.dataAlvoFimStr)})
                                </span>
                                {diasTratamento && (
                                  <span
                                    className="text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1 rounded block"
                                    title={`Tratamento prescrito com duração máxima de ${diasTratamento} dias até ${format(parseISO(dataFimTratamentoStr), "dd/MM/yyyy")}`}
                                  >
                                    ⏳ Tratamento: {diasTratamento}d
                                  </span>
                                )}
                              </div>
                            )}
                          </TableCell>

                          {/* Seletor de Lote com Escolha Manual e FEFO (Estritamente Farmácia Satélite) */}
                          <TableCell className="min-w-[210px]" onClick={(e) => e.stopPropagation()}>
                            <Select
                              value={selectedLoteId}
                              onValueChange={(val) =>
                                setSelectedLotes((prev) => ({
                                  ...prev,
                                  [pr.id]: val,
                                }))
                              }
                              disabled={!isSelected || item.jaDispensado}
                            >
                              <SelectTrigger className="h-8 text-xs font-mono bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 shadow-xs">
                                <SelectValue placeholder="Selecione o Lote">
                                  {selectedLoteObj ? (
                                    <span className="flex items-center gap-1.5 truncate">
                                      <span className="font-bold text-slate-900 dark:text-slate-100">
                                        {selectedLoteObj.numero_lote}
                                      </span>
                                      <span className="text-[10px] text-slate-500">
                                        (Val: {selectedLoteObj.data_validade || "N/I"})
                                      </span>
                                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded shrink-0">
                                        Sat: {selectedLoteObj.saldoSatelite} un
                                      </span>
                                      {medLotes[0]?.id === selectedLoteObj.id && (
                                        <span className="text-[9px] bg-amber-100 text-amber-800 font-extrabold px-1 rounded shrink-0">
                                          🌟 FEFO
                                        </span>
                                      )}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-[11px]">Selecione o Lote...</span>
                                  )}
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent className="max-h-72">
                                {medLotes.length > 0 ? (
                                  <SelectGroup>
                                    <SelectLabel className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold uppercase tracking-wider">
                                      Lotes na Farmácia Satélite (FEFO):
                                    </SelectLabel>
                                    {medLotes.map((l, idx) => (
                                      <SelectItem
                                        key={l.id}
                                        value={l.id}
                                        className="text-xs font-mono py-1.5 cursor-pointer"
                                      >
                                        <div className="flex items-center justify-between gap-2 w-full">
                                          <span>
                                            <strong>{l.numero_lote}</strong> (Val: {l.data_validade || "N/I"}) [Saldo Satélite: <strong>{l.saldoSatelite} un</strong>]
                                          </span>
                                          {idx === 0 && (
                                            <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded ml-1 shrink-0">
                                              🌟 FEFO
                                            </span>
                                          )}
                                        </div>
                                      </SelectItem>
                                    ))}
                                  </SelectGroup>
                                ) : (
                                  <div className="p-3 text-xs text-red-500 font-bold text-center">
                                    ⚠️ Nenhum lote físico disponível na Farmácia Satélite
                                  </div>
                                )}
                              </SelectContent>
                            </Select>
                          </TableCell>

                          {/* Quantidade Bloqueada / Automática (Dias x Dose/dia) */}
                          <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex flex-col items-center justify-center gap-0.5">
                              <div className="flex items-center justify-center gap-1">
                                <Input
                                  type="number"
                                  readOnly
                                  tabIndex={-1}
                                  value={item.jaDispensado ? 0 : valorFinal}
                                  title={item.jaDispensado ? "Medicamento já entregue e coberto." : "Quantidade calculada automaticamente pelo sistema com base nos dias e posologia diária. O campo fica bloqueado para digitação manual."}
                                  className={cn(
                                    "w-16 h-7 text-center font-mono font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700 cursor-not-allowed select-none shadow-none focus-visible:ring-0",
                                    item.jaDispensado && "text-slate-400 bg-slate-100/50",
                                    !temEstoque && isSelected && !item.jaDispensado && "border-red-500 bg-red-100 dark:bg-red-950/50 text-red-900 dark:text-red-300"
                                  )}
                                />
                                <span className="text-xs text-slate-500 font-medium">
                                  un
                                </span>
                              </div>
                              <span
                                className={cn(
                                  "inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded border",
                                  item.jaDispensado
                                    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                                    : "text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800"
                                )}
                                title={item.jaDispensado ? "Medicamento coberto" : "Cálculo automático: Dias × Dose diária"}
                              >
                                {item.jaDispensado ? "🔒 Entregue" : "🔒 Auto"}
                              </span>
                            </div>
                          </TableCell>

                          {/* Saldo Satélite */}
                          <TableCell className="text-right">
                            <Badge
                              variant="outline"
                              className={cn(
                                "font-mono text-[11px] font-bold",
                                temEstoque
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
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

          <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
            <HelpCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
            <div>
              <strong>Regra de Dispensação de Tratamento Limitado:</strong> Se a receita possui duração delimitada (ex: tratamento de 5 dias), o sistema limita automaticamente a entrega a <strong>5 dias</strong>, não ultrapassando o fim do tratamento mesmo que o ciclo do paciente vá além. O saldo é debitado <strong>estritamente da Farmácia Satélite</strong>.
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between border-t pt-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="text-xs font-semibold"
          >
            Cancelar
          </Button>
          <Button
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-2 shadow-sm"
            onClick={handleConfirm}
            disabled={isSubmitting || selectedPrescIds.size === 0}
          >
            <PackageMinus className="w-4 h-4" />
            {isSubmitting
              ? "Processando Saídas..."
              : `Confirmar Entrega (${selectedPrescIds.size} itens selecionados)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
export default AjusteDiasEntregaModal;
