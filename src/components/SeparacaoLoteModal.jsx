import React, { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { format, addDays, parseISO, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { db } from "@/api/db";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  PackageMinus,
  Printer,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Search,
  CheckSquare,
  Square,
  Calendar,
  Layers,
  FileText,
  User,
  Pill,
  ChevronDown,
  ChevronRight,
  Boxes,
  Stethoscope,
  ShieldAlert,
  Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  isPrescricaoDoPaciente,
  isPrescricaoAtiva,
  calculatePrescQtdParaDias,
} from "@/utils/prescricaoUtils";
import { isPsicotropico } from "@/utils/mavUtils";
import { safeFormatDate } from "@/utils/dateUtils";
import { calcularLotesSatelite } from "@/utils/sateliteLoteUtils";

/**
 * Verifica se um lote pertence a determinado medicamento por id, código ou nome
 */
function isLoteDoMedicamento(lote, item, medicamentos = []) {
  if (!lote || !item) return false;
  const lMedId = String(lote.medicamento_id || lote.medicamentoId || "").trim();
  const itemId = String(item.medicamentoId || "").trim();
  
  // Se ambos têm ID, a correspondência por ID é soberana e estrita
  if (lMedId && itemId) {
    if (lMedId === itemId) return true;
    const medObj = (medicamentos || []).find((m) => String(m.id).trim() === itemId);
    if (medObj && String(medObj.id).trim() === lMedId) return true;
    // Se ambos têm IDs e não batem, são medicamentos/dosagens diferentes!
    return false;
  }

  const medObj = (medicamentos || []).find((m) => String(m.id).trim() === itemId);
  if (medObj && lMedId && String(medObj.id).trim() === lMedId) return true;

  const lCodigo = lote.medicamento_codigo ? String(lote.medicamento_codigo).trim() : "";
  const itemCodigo = item.codigo ? String(item.codigo).trim() : (medObj?.codigo ? String(medObj.codigo).trim() : "");
  if (lCodigo && itemCodigo && lCodigo === itemCodigo) return true;

  const normalize = (s) =>
    (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, " ")
      .trim();

  const lNome = normalize(lote.medicamento_nome);
  const itemNome = normalize(item.medicamentoNome || medObj?.nome);
  if (lNome && itemNome) {
    let nameMatches = lNome === itemNome;
    if (!nameMatches) {
      const cleanL = lNome.replace(/\b(comprimido|cp|frasco|ampola|gotas)\b/g, "").replace(/\s+/g, " ").trim();
      const cleanItem = itemNome.replace(/\b(comprimido|cp|frasco|ampola|gotas)\b/g, "").replace(/\s+/g, " ").trim();
      nameMatches = Boolean(cleanL && cleanItem && cleanL === cleanItem);
    }
    if (!nameMatches) return false;

    // Se ambos tiverem concentração informada, ela DEVE bater para evitar misturar 500mg com 250mg ou suspensão
    const lConc = normalize(lote.concentracao);
    const itemConc = normalize(item.concentracao || medObj?.concentracao);
    if (lConc && itemConc && lConc !== itemConc) return false;

    return true;
  }

  return false;
}

export function SeparacaoLoteModal({
  open,
  onOpenChange,
  selectedPatientIds = [],
  pacientes = [],
  prescricoes = [],
  medicamentos = [],
  lotes = [],
  alas = [],
  filterAlas = [],
  onSuccess,
}) {
  const queryClient = useQueryClient();
  const [dias, setDias] = useState(8); // Padrão: 8 dias de ciclo
  const [categoriaFiltro, setCategoriaFiltro] = useState("todos"); // "todos" | "clinico" | "psicotropico"
  const [searchTerm, setSearchTerm] = useState("");
  const [isPrinting, setIsPrinting] = useState(false);
  const [itensConsolidados, setItensConsolidados] = useState([]);
  const [expandedMeds, setExpandedMeds] = useState({});

  // ── BUSCA DE ALAS CASO A PROP VENHA VAZIA ────────────────────────────────────
  const { data: dbAlas = [] } = useQuery({
    queryKey: ['alas'],
    queryFn: () => (db.entities.Ala ? db.entities.Ala.list() : []),
  });
  const allAlas = useMemo(() => (alas && alas.length > 0 ? alas : dbAlas), [alas, dbAlas]);

  // ── SEGURANÇA / CONTROLE DE ACESSO (FASE DE TESTES - SENHA 102030) ──────────
  const [senhaModalOpen, setSenhaModalOpen] = useState(false);
  const [senhaInput, setSenhaInput] = useState("");
  const [senhaError, setSenhaError] = useState("");

  // Resetar filtro e busca ao abrir a modal, e atualizar estoque fresco
  useEffect(() => {
    if (open) {
      setCategoriaFiltro("todos");
      setSearchTerm("");
      queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
    }
  }, [open, queryClient]);

  // Buscar todos os lotes do banco caso a prop venha vazia
  const { data: dbLotes = [] } = useQuery({
    queryKey: ['lotes'],
    queryFn: () => (db.entities.Lote ? db.entities.Lote.list() : []),
  });

  const allLotes = useMemo(() => {
    return (lotes && lotes.length > 0) ? lotes : dbLotes;
  }, [lotes, dbLotes]);

  // Buscar transferências da satélite para rastreabilidade precisa de lotes
  const { data: transferencias = [] } = useQuery({
    queryKey: ['transferencias_pendentes'],
    queryFn: () => (db.entities.TransferenciaPendente ? db.entities.TransferenciaPendente.list() : []),
  });

  // Buscar pedidos da satélite
  const { data: pedidosSatelite = [] } = useQuery({
    queryKey: ['pedidos_satelite'],
    queryFn: () => (db.entities.PedidoSatelite ? db.entities.PedidoSatelite.list() : []),
  });

  // Buscar saídas
  const { data: saidas = [] } = useQuery({
    queryKey: ['saidas'],
    queryFn: () => (db.entities.Saida ? db.entities.Saida.list() : []),
  });

  // Data de referência do ciclo
  const hoje = useMemo(() => new Date(), []);
  const hojeStr = useMemo(() => format(hoje, "yyyy-MM-dd"), [hoje]);
  const dataInicioStr = hojeStr;
  const dataFimDate = useMemo(() => addDays(hoje, Math.max(1, dias) - 1), [hoje, dias]);
  const dataFimStr = useMemo(() => format(dataFimDate, "yyyy-MM-dd"), [dataFimDate]);

  // Pacientes selecionados (compatível com id como número ou string)
  const selectedPacs = useMemo(() => {
    return (pacientes || []).filter((p) =>
      selectedPatientIds.some((id) => String(id) === String(p.id))
    );
  }, [pacientes, selectedPatientIds]);

  // Prescrições ativas dos pacientes selecionados
  const activePrescs = useMemo(() => {
    return (prescricoes || []).filter((pr) => {
      const ativa = isPrescricaoAtiva(pr, hojeStr);
      if (!ativa) return false;

      const pertence =
        selectedPacs.some((p) => isPrescricaoDoPaciente(pr, p)) ||
        selectedPatientIds.some((id) => String(id) === String(pr.pacienteId || pr.paciente_id));

      return pertence;
    });
  }, [prescricoes, selectedPacs, selectedPatientIds, hojeStr]);

  // Agrupamento Consolidado por Medicamento (Soma Tudo)
  useEffect(() => {
    if (!open) return;

    const map = new Map();

    activePrescs.forEach((pr) => {
      const pac =
        selectedPacs.find((p) => isPrescricaoDoPaciente(pr, p)) ||
        (pacientes || []).find((p) => isPrescricaoDoPaciente(pr, p));

      const pMedId = String(pr.medicamentoId || pr.medicamento_id || pr.medicamentoid || "").trim();
      const pCodigo = pr.medicamentoCodigo ? String(pr.medicamentoCodigo).trim() : "";
      const pNome = (pr.medicamentoNome || "").trim().toLowerCase();
      const pConc = (pr.concentracao || "").trim().toLowerCase();

      // 1. Busca estrita por ID exato do medicamento (PRIORIDADE MÁXIMA)
      let med = pMedId ? (medicamentos || []).find((m) => String(m.id).trim() === pMedId) : null;

      // 2. Busca por código cadastrado
      if (!med && pCodigo) {
        med = (medicamentos || []).find((m) => m.codigo && String(m.codigo).trim() === pCodigo);
      }

      // 3. Busca por NOME E CONCENTRAÇÃO exatas (evita que 500mg caia em 50mg/ml ou 250mg)
      if (!med && pNome && pConc) {
        med = (medicamentos || []).find(
          (m) =>
            m.nome &&
            m.nome.trim().toLowerCase() === pNome &&
            m.concentracao &&
            m.concentracao.trim().toLowerCase() === pConc
        );
      }

      // 4. Fallback por nome caso a prescrição não tenha concentração
      if (!med && pNome) {
        med = (medicamentos || []).find(
          (m) => m.nome && m.nome.trim().toLowerCase() === pNome
        );
      }

      const concentracao = pr.concentracao || med?.concentracao || "";
      const medNome = pr.medicamentoNome || med?.nome || "Medicamento";
      const medId = med?.id ? String(med.id) : (pMedId || `${medNome}_${concentracao}`);
      const codigo = pr.medicamentoCodigo || med?.codigo || "";
      const psico = isPsicotropico(med || medNome);

      // ── VERIFICAÇÃO DE COBERTURA PRECEDENTE (JÁ ENTREGUE / CADEADO) ──────────
      const cobAte = pr.coberto_ate ? pr.coberto_ate.split("T")[0] : null;
      // Já está 100% coberto se a prescrição já foi entregue até ou além da data fim deste ciclo
      const jaCoberto = Boolean(cobAte && cobAte >= dataFimStr);

      let qtdSugerida = 0;
      if (!jaCoberto) {
        if (cobAte && cobAte >= hojeStr && cobAte < dataFimStr) {
          // Cobertura parcial: calcula apenas os dias faltantes entre cobAte e dataFimStr
          const diasFaltantes = differenceInCalendarDays(parseISO(dataFimStr), parseISO(cobAte));
          if (diasFaltantes > 0) {
            qtdSugerida = calculatePrescQtdParaDias(pr, diasFaltantes);
            if (qtdSugerida <= 0 && Number(pr.totalDiario) > 0) {
              qtdSugerida = Math.ceil(Number(pr.totalDiario) * diasFaltantes);
            }
          }
        } else {
          // Cobertura total dos dias solicitados
          qtdSugerida = calculatePrescQtdParaDias(pr, dias);
          if (qtdSugerida <= 0 && Number(pr.totalDiario) > 0) {
            qtdSugerida = Math.ceil(Number(pr.totalDiario) * dias);
          }
        }
      }

      if (!map.has(medId)) {
        map.set(medId, {
          medicamentoId: medId,
          medicamentoNome: medNome,
          concentracao,
          codigo,
          isPsicotropico: psico,
          estoqueSatelite: med ? Number(med.estoque_satelite) || 0 : 0,
          qtdSugerida: 0,
          qtdTotal: 0,
          conferido: false,
          pacientesAtendidos: [],
          alocacoes: [],
        });
      }

      const item = map.get(medId);
      item.qtdSugerida += qtdSugerida;
      item.qtdTotal += qtdSugerida;
      item.pacientesAtendidos.push({
        pr,
        pac,
        qtdIndividual: qtdSugerida,
        doseDiaria: Number(pr.totalDiario) || 0,
        jaCoberto,
        cobertoAte: cobAte,
      });
    });

    // Para cada medicamento consolidado, calcula as alocações de lote com lote e validade reais da Satélite
    const listaConsolidada = Array.from(map.values())
      .sort((a, b) => a.medicamentoNome.localeCompare(b.medicamentoNome))
      .map((item) => {
        // 1. Todos os lotes cadastrados deste medicamento (ordenados por FEFO)
        const todosLotesMed = (allLotes || [])
          .filter((l) => isLoteDoMedicamento(l, item, medicamentos))
          .filter((l) => !l.status || String(l.status).toLowerCase() !== "inativo")
          .sort((a, b) => {
            const da = a.data_validade ? new Date(a.data_validade).getTime() : 9999999999999;
            const db = b.data_validade ? new Date(b.data_validade).getTime() : 9999999999999;
            return da - db;
          });

        // 2. Lotes comprovados com saldo na Satélite
        const lotesSatComprovados = calcularLotesSatelite({
          medId: item.medicamentoId,
          medCodigo: item.codigo,
          medNome: item.medicamentoNome,
          saldoTotalSat: item.estoqueSatelite,
          lotes: allLotes,
          transferencias,
          pedidosSatelite,
          saidas,
        });

        // Candidatos preferenciais: lotes com saldo comprovado na satélite com saldo > 0; se não houver saldo mapeado, todos os lotes do medicamento
        const medLotes = lotesSatComprovados.some((l) => (Number(l.saldoSatelite) || 0) > 0)
          ? lotesSatComprovados
          : todosLotesMed;

        let alocs = [];
        if (medLotes.length === 0) {
          alocs = [
            {
              id: `alloc-${item.medicamentoId}-default`,
              loteId: "",
              numero_lote: "Lote Geral",
              data_validade: "",
              quantidade: item.qtdTotal,
            },
          ];
        } else {
          let restante = item.qtdTotal;
          for (let i = 0; i < medLotes.length; i++) {
            const l = medLotes[i];
            const saldo = Number(l.saldoSatelite ?? l.quantidade_atual ?? 0);

            if (saldo > 0) {
              const qtdDeste = Math.min(saldo, restante);
              alocs.push({
                id: `alloc-${item.medicamentoId}-${l.id}`,
                loteId: l.id,
                numero_lote: l.numero_lote || "S/L",
                data_validade: l.data_validade || null,
                quantidade: qtdDeste,
              });
              restante -= qtdDeste;
              if (restante <= 0) break;
            }
          }

          if (restante > 0) {
            if (alocs.length > 0) {
              alocs[alocs.length - 1].quantidade += restante;
            } else {
              const primeiro = medLotes[0];
              alocs.push({
                id: `alloc-${item.medicamentoId}-${primeiro.id}`,
                loteId: primeiro.id,
                numero_lote: primeiro.numero_lote || "S/L",
                data_validade: primeiro.data_validade || null,
                quantidade: item.qtdTotal,
              });
            }
          }
        }

        return {
          ...item,
          alocacoes: alocs,
        };
      });

    setItensConsolidados(listaConsolidada);
  }, [open, dias, activePrescs, selectedPacs, pacientes, medicamentos, allLotes, transferencias, pedidosSatelite, saidas]);

  // Contagens para os botões de filtro
  const contagensCategorias = useMemo(() => {
    const totalTodos = itensConsolidados.length;
    const totalPsico = itensConsolidados.filter((i) => i.isPsicotropico).length;
    const totalClinico = itensConsolidados.filter((i) => !i.isPsicotropico).length;
    return { totalTodos, totalPsico, totalClinico };
  }, [itensConsolidados]);

  // Filtro de Categoria e Pesquisa
  const itensFiltrados = useMemo(() => {
    let list = itensConsolidados;

    if (categoriaFiltro === "clinico") {
      list = list.filter((i) => !i.isPsicotropico);
    } else if (categoriaFiltro === "psicotropico") {
      list = list.filter((i) => i.isPsicotropico);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.medicamentoNome.toLowerCase().includes(term) ||
          i.concentracao.toLowerCase().includes(term) ||
          i.codigo.toLowerCase().includes(term) ||
          i.pacientesAtendidos.some((p) => (p.pac?.nome || "").toLowerCase().includes(term))
      );
    }

    return list;
  }, [itensConsolidados, categoriaFiltro, searchTerm]);

  // Atualizar quantidade total de um medicamento consolidado
  const handleUpdateQtdTotal = (medId, novaQtd) => {
    setItensConsolidados((prev) =>
      prev.map((item) => {
        if (item.medicamentoId !== medId) return item;
        const q = Math.max(0, parseInt(novaQtd) || 0);

        let novasAlocs = item.alocacoes;
        if (item.alocacoes.length === 1) {
          novasAlocs = [
            {
              ...item.alocacoes[0],
              quantidade: q,
            },
          ];
        }
        return {
          ...item,
          qtdTotal: q,
          alocacoes: novasAlocs,
        };
      })
    );
  };

  // Alternar checkbox de conferido
  const handleToggleConferido = (medId) => {
    setItensConsolidados((prev) =>
      prev.map((item) =>
        item.medicamentoId === medId ? { ...item, conferido: !item.conferido } : item
      )
    );
  };

  // Marcar todos como conferidos dentro do filtro ativo
  const handleMarcarTodosConferidos = () => {
    const todosMarcados = itensFiltrados.every((i) => i.conferido);
    const idsFiltrados = new Set(itensFiltrados.map((i) => i.medicamentoId));

    setItensConsolidados((prev) =>
      prev.map((item) => {
        if (idsFiltrados.has(item.medicamentoId)) {
          return { ...item, conferido: !todosMarcados };
        }
        return item;
      })
    );
  };

  // Atualizar lote ou quantidade no split do medicamento
  const handleUpdateAlocacao = (medId, allocId, campo, valor) => {
    setItensConsolidados((prev) =>
      prev.map((item) => {
        if (item.medicamentoId !== medId) return item;
        const novasAlocs = item.alocacoes.map((aloc) => {
          if (aloc.id !== allocId) return aloc;
          if (campo === "quantidade") {
            return { ...aloc, quantidade: Math.max(0, parseInt(valor) || 0) };
          }
          if (campo === "loteId") {
            const loteObj = (allLotes || []).find((l) => String(l.id) === String(valor));
            return {
              ...aloc,
              loteId: valor,
              numero_lote: loteObj?.numero_lote || aloc.numero_lote || "S/L",
              data_validade: loteObj?.data_validade || aloc.data_validade || null,
            };
          }
          return aloc;
        });
        return { ...item, alocacoes: novasAlocs };
      })
    );
  };

  // Adicionar divisão de lote (+ Split)
  const handleAdicionarLoteSplit = (medId) => {
    setItensConsolidados((prev) =>
      prev.map((item) => {
        if (item.medicamentoId !== medId) return item;

        const medLotes = (allLotes || [])
          .filter((l) => isLoteDoMedicamento(l, item, medicamentos))
          .filter((l) => !l.status || String(l.status).toLowerCase() !== "inativo");

        const lotesUsados = item.alocacoes.map((a) => a.loteId);
        const proximoLote = medLotes.find((l) => !lotesUsados.includes(l.id)) || medLotes[0];

        const somaAtual = item.alocacoes.reduce((s, a) => s + (Number(a.quantidade) || 0), 0);
        const restante = Math.max(0, item.qtdTotal - somaAtual);

        const novaAloc = {
          id: `alloc-${medId}-${Date.now()}`,
          loteId: proximoLote ? proximoLote.id : "",
          numero_lote: proximoLote?.numero_lote || "S/L",
          data_validade: proximoLote?.data_validade || null,
          quantidade: restante,
        };

        return {
          ...item,
          alocacoes: [...item.alocacoes, novaAloc],
        };
      })
    );
  };

  // Remover uma alocação de lote dividida
  const handleRemoverLoteSplit = (medId, allocId) => {
    setItensConsolidados((prev) =>
      prev.map((item) => {
        if (item.medicamentoId !== medId) return item;
        if (item.alocacoes.length <= 1) return item;

        const filtradas = item.alocacoes.filter((a) => a.id !== allocId);
        return { ...item, alocacoes: filtradas };
      })
    );
  };

  // Expandir/recolher visualização de pacientes de um medicamento
  const toggleExpandMed = (medId) => {
    setExpandedMeds((prev) => ({
      ...prev,
      [medId]: !prev[medId],
    }));
  };

  // Validação de Senha de Segurança para Liberação de Baixa (Fase de Testes: 102030)
  const handleValidarSenhaEConfirmar = () => {
    if (senhaInput.trim() !== "102030") {
      setSenhaError("ACESSO NEGADO: Senha de liberação incorreta! Tentativa registrada.");
      toast.error("ACESSO NEGADO: Senha incorreta!", {
        description: "Operação travada. Verifique com a administração a senha de liberação.",
      });
      return;
    }

    setSenhaError("");
    setSenhaModalOpen(false);
    setSenhaInput("");
    toast.success("Autenticação autorizada! Processando baixa de medicamentos...");
    executarBaixaMutation.mutate();
  };

  // Executar Impressão da Guia de Separação (Padrão Idêntico ao Pedidos Central)
  const handleImprimirGuia = () => {
    window.print();
  };

  // Mutação de Baixa em Lote dos itens filtrados
  const executarBaixaMutation = useMutation({
    mutationFn: async () => {
      const nowStr = new Date().toISOString();
      const todayDateStr = format(hoje, "yyyy-MM-dd");

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

      // 1. Validar estoques da farmácia satélite para os itens a baixar
      for (const item of itensFiltrados) {
        const med = (medicamentos || []).find((m) => String(m.id) === String(item.medicamentoId));
        const atualSatelite = med ? Number(med.estoque_satelite) || 0 : 0;
        if (atualSatelite < item.qtdTotal) {
          throw new Error(
            `Estoque insuficiente na Satélite para: "${item.medicamentoNome}". Necessário: ${item.qtdTotal} un, Disponível: ${atualSatelite} un.`
          );
        }
      }

      // 2. Debitar os lotes físicos conforme o split escolhido pelo usuário
      for (const item of itensFiltrados) {
        for (const aloc of item.alocacoes) {
          const qtdAloc = Number(aloc.quantidade) || 0;
          if (qtdAloc <= 0) continue;

          const loteObj = (lotes || []).find((l) => String(l.id) === String(aloc.loteId));
          if (loteObj && (Number(loteObj.quantidade_atual) || 0) > 0) {
            const novoSaldoLote = Math.max(0, (Number(loteObj.quantidade_atual) || 0) - qtdAloc);
            await db.entities.Lote.update(loteObj.id, {
              quantidade_atual: novoSaldoLote,
              status: novoSaldoLote <= 0 ? "esgotado" : loteObj.status,
            });
            loteObj.quantidade_atual = novoSaldoLote;
          }
        }

        // Fila de lotes com saldo para atribuir às saídas dos pacientes atendidos
        let filaLotes = item.alocacoes
          .filter((a) => (Number(a.quantidade) || 0) > 0)
          .map((a) => {
            const lObj = (lotes || []).find((l) => String(l.id) === String(a.loteId));
            return {
              loteId: lObj ? lObj.id : null,
              numeroLote: lObj ? lObj.numero_lote || "S/ Lote" : "S/ Lote",
              saldoRestante: Number(a.quantidade) || 0,
            };
          });

        if (filaLotes.length === 0) {
          filaLotes = [{ loteId: null, numeroLote: "S/ Lote", saldoRestante: 999999 }];
        }

        let ponteiroLote = 0;

        // Registrar Saídas e Coberturas para cada paciente que toma este medicamento
        for (const pacEntry of item.pacientesAtendidos) {
          const { pr, pac, qtdIndividual, doseDiaria, jaCoberto } = pacEntry;
          if (jaCoberto || qtdIndividual <= 0) {
            continue; // Já entregue neste ciclo! Pula para não duplicar saída nem consumir estoque
          }
          let qtdRestantePac = qtdIndividual;

          while (qtdRestantePac > 0 && ponteiroLote < filaLotes.length) {
            const curLote = filaLotes[ponteiroLote];
            const qtdDesteLote = Math.min(qtdRestantePac, curLote.saldoRestante);

            if (qtdDesteLote > 0) {
              await db.entities.Saida.create({
                medicamento_id: item.medicamentoId,
                medicamento_nome: item.medicamentoNome,
                lote_id: curLote.loteId,
                numero_lote: curLote.numeroLote,
                quantidade: qtdDesteLote,
                destino: pac ? `Paciente ${pac.nome} (Leito: ${pac.leito || "S/L"})` : "Paciente",
                paciente_nome: pac ? pac.nome : "Paciente",
                paciente_id: pac?.id || pr.pacienteId || pr.paciente_id,
                prescricao_id: pr.id,
                ala_id: pac?.alaId || pac?.ala_id || null,
                ala_nome: pac ? pac.alaNome || pac.ala_nome || "Ala Geral" : "Geral",
                motivo: `Separação Consolidada (${dias} ${dias === 1 ? "dia" : "dias"})`,
                observacao: `Grade: ${pr.esquemaPosologico || "Posologia Fixa"} | Qt: ${qtdDesteLote} un | Lote: ${curLote.numeroLote} | Cobertura: ${format(hoje, "dd/MM")} a ${format(dataFimDate, "dd/MM/yyyy")}`,
                data_saida: todayDateStr,
                created_at: nowStr,
                responsavel: responsavel,
                responsavel_crf: responsavelCrf,
                usuario_nome: responsavel,
                dias_cobertura: dias,
                data_inicio_cobertura: dataInicioStr,
                data_fim_cobertura: dataFimStr,
                dose_diaria: doseDiaria,
                is_baixa_lote_paciente: true,
              });

              curLote.saldoRestante -= qtdDesteLote;
              qtdRestantePac -= qtdDesteLote;
            }

            if (curLote.saldoRestante <= 0) {
              ponteiroLote++;
            }
          }

          // Atualizar cobertura na prescrição
          if (pr) {
            await db.entities.PrescricaoPaciente.update(pr.id, {
              coberto_ate: dataFimStr,
              ultimo_lote_dias: dias,
              data_ultima_dispensacao: dataInicioStr,
              dose_diaria_dispensada: doseDiaria,
              quantidade_ultimo_lote: qtdIndividual,
            });
          }
        }

        // Debitar estoque satélite do medicamento
        const med = (medicamentos || []).find((m) => String(m.id) === String(item.medicamentoId));
        if (med) {
          const novoEstoque = Math.max(0, (Number(med.estoque_satelite) || 0) - item.qtdTotal);
          await db.entities.Medicamento.update(med.id, {
            estoque_satelite: novoEstoque,
          });
        }
      }

      // 3. Atualizar ciclos em todos os pacientes atendidos
      const todosPacientesIds = new Set();
      itensFiltrados.forEach((item) => {
        item.pacientesAtendidos.forEach((pEntry) => {
          if (pEntry.pac?.id) todosPacientesIds.add(String(pEntry.pac.id));
        });
      });

      for (const pac of selectedPacs) {
        if (todosPacientesIds.has(String(pac.id))) {
          await db.entities.Paciente.update(pac.id, {
            ciclo_coberto_ate: dataFimStr,
            ultimo_ciclo_dias: dias,
            data_ultimo_ciclo: dataInicioStr,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medicamentos"] });
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      queryClient.invalidateQueries({ queryKey: ["saidas"] });
      queryClient.invalidateQueries({ queryKey: ["prescricoes_paciente"] });
      queryClient.invalidateQueries({ queryKey: ["pacientes"] });
      toast.success(
        `Separação e Baixa de ${itensFiltrados.length} medicamento(s) concluída com sucesso!`
      );
      if (onSuccess) onSuccess();
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(`Erro ao efetuar baixa: ${err.message || err}`);
    },
  });

  // Totais consolidados dos itens filtrados
  const totalGeralUnidades = useMemo(() => {
    return itensFiltrados.reduce((total, item) => total + (Number(item.qtdTotal) || 0), 0);
  }, [itensFiltrados]);

  const totalPacientesAtendidos = useMemo(() => {
    const ids = new Set();
    itensFiltrados.forEach((item) => {
      item.pacientesAtendidos.forEach((p) => {
        if (p.pac?.id) ids.add(String(p.pac.id));
      });
    });
    return ids.size;
  }, [itensFiltrados]);

  const totalConferidos = useMemo(() => {
    return itensFiltrados.filter((i) => i.conferido).length;
  }, [itensFiltrados]);

  // Título da Guia Impressa de acordo com a categoria
  const tituloGuiaImpressa = useMemo(() => {
    if (categoriaFiltro === "psicotropico") {
      return "GUIA DE SEPARAÇÃO — PSICOTRÓPICOS & CONTROLADOS (PORTARIA 344/98)";
    }
    if (categoriaFiltro === "clinico") {
      return "GUIA DE SEPARAÇÃO — CLÍNICA GERAL";
    }
    return "GUIA DE SEPARAÇÃO CONSOLIDADA POR MEDICAMENTO (SOMA GERAL)";
  }, [categoriaFiltro]);

  // Lista de nomes de Alas atendidas na impressão
  const alasNomesTexto = useMemo(() => {
    // 1. Se filterAlas veio específico e não é ['all']
    if (filterAlas && filterAlas.length > 0 && !filterAlas.includes("all")) {
      const nomes = filterAlas
        .map((aid) => {
          const found = allAlas.find((a) => String(a.id) === String(aid));
          return found ? found.nome : null;
        })
        .filter(Boolean);
      if (nomes.length > 0) return nomes.join(", ");
    }

    // 2. Extrai das alas dos pacientes selecionados
    const setNomes = new Set();
    (selectedPacs || []).forEach((p) => {
      let nome = p.alaNome || p.ala_nome;
      if (!nome && (p.alaId || p.ala_id)) {
        const found = allAlas.find((a) => String(a.id) === String(p.alaId || p.ala_id));
        if (found) nome = found.nome;
      }
      if (nome && nome.trim()) setNomes.add(nome.trim());
    });

    // 3. Fallback: extrai de itensFiltrados (pacientesAtendidos)
    if (setNomes.size === 0) {
      (itensFiltrados || []).forEach((item) => {
        (item.pacientesAtendidos || []).forEach((pa) => {
          let nome = pa.pac?.alaNome || pa.pac?.ala_nome;
          if (!nome && (pa.pac?.alaId || pa.pac?.ala_id)) {
            const found = allAlas.find((a) => String(a.id) === String(pa.pac?.alaId || pa.pac?.ala_id));
            if (found) nome = found.nome;
          }
          if (nome && nome.trim()) setNomes.add(nome.trim());
        });
      });
    }

    const arr = Array.from(setNomes);
    if (arr.length === 0) return "Todas as Alas / Geral";
    return arr.join(", ");
  }, [filterAlas, allAlas, selectedPacs, itensFiltrados]);


  return (
    <>
      {/* ─── ESTILOS CSS PARA IMPRESSÃO EM FOLHA A4 (PADRÃO IDÊNTICO A PEDIDOS CENTRAL) ─── */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            width: 100% !important;
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Oculta rigorosamente TUDO que for filho do body, exceto nosso portal de impressão */
          body > *:not(#print-separacao-sheet-portal) {
            display: none !important;
          }
          /* Ocultar app root, overlays e modais do radix, navegações e barras */
          #root,
          [role="dialog"],
          [data-radix-portal],
          [data-state],
          .fixed,
          .no-print,
          #print-area,
          nav,
          header,
          aside,
          footer,
          button,
          .sonner-toaster {
            display: none !important;
          }
          /* Exibir exclusivamente a folha no portal de impressão direta */
          #print-separacao-sheet-portal {
            display: block !important;
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            overflow: visible !important;
            box-sizing: border-box !important;
          }
          #print-separacao-sheet-portal * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box !important;
          }
          #print-separacao-sheet-portal .sheet-wrapper {
            page-break-inside: auto !important;
            break-inside: auto !important;
            margin-bottom: 0 !important;
          }
          #print-separacao-sheet-portal .page-break {
            page-break-before: always !important;
            break-before: page !important;
            clear: both !important;
            display: block !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
          }
          #print-separacao-sheet-portal table {
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto !important;
          }
          #print-separacao-sheet-portal thead {
            display: table-header-group !important;
          }
          #print-separacao-sheet-portal tbody {
            display: table-row-group !important;
          }
          #print-separacao-sheet-portal tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          #print-separacao-sheet-portal td, #print-separacao-sheet-portal th {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          #print-separacao-sheet-portal tfoot {
            display: table-footer-group !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          #print-separacao-sheet-portal .signature-area {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
        @media screen {
          #print-separacao-sheet-portal {
            display: none !important;
          }
        }
      `}</style>

      {/* ─── PORTAL OFICIAL DE IMPRESSÃO DA GUIA (DIRETO NO BODY, PADRÃO PEDIDOS CENTRAL) ─ */}
      {open && typeof document !== "undefined" && createPortal(
        <div id="print-separacao-sheet-portal">
          <PrintGuiaContent
            itensFiltrados={itensFiltrados}
            categoriaFiltro={categoriaFiltro}
            alasNomesTexto={alasNomesTexto}
            selectedPacs={selectedPacs}
            dias={dias}
            hoje={hoje}
            dataFimDate={dataFimDate}
            allLotes={allLotes}
            medicamentos={medicamentos}
          />
        </div>,
        document.body
      )}

      {/* ─── MODAL EM TELA: SEPARAÇÃO CONSOLIDADA POR MEDICAMENTO ────────────── */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[1020px] max-h-[92vh] flex flex-col p-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="p-5 pb-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900 shrink-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Boxes className="w-6 h-6 text-indigo-600" />
                  Separação Consolidada por Medicamento (Soma Geral)
                </DialogTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Lista consolidada somando todos os pacientes para retirada rápida no armário/prateleira.
                </p>
              </div>

              {/* Botão de Impressão da Folha */}
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  onClick={handleImprimirGuia}
                  variant="outline"
                  size="sm"
                  disabled={itensFiltrados.length === 0}
                  className="h-9 px-3 text-xs font-bold gap-1.5 border-indigo-200 bg-indigo-50/70 text-indigo-900 hover:bg-indigo-100 dark:bg-indigo-950 dark:border-indigo-800 dark:text-indigo-200 shadow-xs"
                  title="Imprimir folha consolidada por medicamento para separar na prateleira"
                >
                  <Printer className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Imprimir Folha de Separação (A4)
                </Button>
              </div>
            </div>

            {/* Barra de Controles: Período, Ciclo, Filtro de Categoria e Busca */}
            <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-white dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Ciclo:</span>
                  <Select value={String(dias)} onValueChange={(v) => setDias(Number(v))}>
                    <SelectTrigger className="w-[140px] h-7 text-xs font-bold border-none shadow-none focus:ring-0 p-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 dia (Diário)</SelectItem>
                      <SelectItem value="7">7 dias (Semanal)</SelectItem>
                      <SelectItem value="8">8 dias (Ciclo Padrão)</SelectItem>
                      <SelectItem value="15">15 dias (Quinzenal)</SelectItem>
                      <SelectItem value="30">30 dias (Mensal)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                  Cobertura:{" "}
                  <strong className="text-indigo-700 dark:text-indigo-400 font-mono">
                    {format(hoje, "dd/MM")} a {format(dataFimDate, "dd/MM/yyyy")}
                  </strong>
                </div>

                {/* ── BOTÕES DE FILTRO: TODOS / SÓ CLÍNICO / SÓ PSICOTRÓPICO ── */}
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setCategoriaFiltro("todos")}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                      categoriaFiltro === "todos"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    )}
                  >
                    Todos ({contagensCategorias.totalTodos})
                  </button>

                  <button
                    type="button"
                    onClick={() => setCategoriaFiltro("clinico")}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                      categoriaFiltro === "clinico"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-blue-700 dark:text-blue-400 hover:bg-blue-50/70"
                    )}
                  >
                    <Stethoscope className="w-3.5 h-3.5" />
                    Só Clínico ({contagensCategorias.totalClinico})
                  </button>

                  <button
                    type="button"
                    onClick={() => setCategoriaFiltro("psicotropico")}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                      categoriaFiltro === "psicotropico"
                        ? "bg-purple-600 text-white shadow-xs"
                        : "text-purple-700 dark:text-purple-400 hover:bg-purple-50/70"
                    )}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Só Psicotrópico ({contagensCategorias.totalPsico})
                  </button>
                </div>
              </div>

              {/* Busca rápida */}
              <div className="relative w-full sm:w-60">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <Input
                  placeholder="Filtrar medicamento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 pl-8 text-xs bg-white dark:bg-slate-950"
                />
              </div>
            </div>
          </DialogHeader>

          {/* Tabela Consolidada de Medicamentos */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {itensFiltrados.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-amber-300 bg-amber-50/50 rounded-xl text-amber-800 text-sm font-medium">
                <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
                Nenhum medicamento encontrado para o filtro "{categoriaFiltro === "psicotropico" ? "Só Psicotrópico" : categoriaFiltro === "clinico" ? "Só Clínico" : "Todos"}" neste ciclo.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarcarTodosConferidos}
                    className="h-7 text-xs font-semibold gap-1 text-slate-600 hover:text-slate-900"
                  >
                    {totalConferidos === itensFiltrados.length ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                    Marcar todos como conferidos ({totalConferidos}/{itensFiltrados.length})
                  </Button>

                  <span className="text-[11px] text-slate-500">
                    💡 Exibindo <strong>{itensFiltrados.length}</strong> medicamentos ({categoriaFiltro === "psicotropico" ? "Psicotrópicos P344" : categoriaFiltro === "clinico" ? "Clínica Geral" : "Geral"}).
                  </span>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
                  <Table>
                    <TableHeader className="bg-slate-100 dark:bg-slate-800 text-xs">
                      <TableRow>
                        <TableHead className="w-10 text-center">Conf.</TableHead>
                        <TableHead>Medicamento / Apresentação</TableHead>
                        <TableHead className="text-center w-28">Pacientes</TableHead>
                        <TableHead className="text-center w-36">Total a Separar ({dias}d)</TableHead>
                        <TableHead className="min-w-[320px]">Distribuição de Lotes (Multi-Lote)</TableHead>
                        <TableHead className="text-right w-28">Estoque Satélite</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="text-xs divide-y divide-slate-100 dark:divide-slate-800">
                      {itensFiltrados.map((item) => {
                        const med = (medicamentos || []).find((m) => String(m.id) === String(item.medicamentoId));
                        const estoqueSat = med ? (Number(med.estoque_satelite) || 0) : (Number(item.estoqueSatelite) || 0);

                        // Lotes disponíveis deste medicamento
                        const lotesSatComprovados = calcularLotesSatelite({
                          medId: item.medicamentoId,
                          medCodigo: item.codigo,
                          medNome: item.medicamentoNome,
                          saldoTotalSat: estoqueSat,
                          lotes: allLotes,
                          transferencias,
                          pedidosSatelite,
                          saidas,
                        });

                        const medLotes = (allLotes || [])
                          .filter((l) => isLoteDoMedicamento(l, item, medicamentos))
                          .filter((l) => !l.status || String(l.status).toLowerCase() !== "inativo")
                          .map((l) => {
                            const satMatch = lotesSatComprovados.find((ls) => String(ls.id) === String(l.id));
                            return {
                              ...l,
                              saldoSatelite: satMatch ? satMatch.saldoSatelite : 0,
                            };
                          })
                          .sort((a, b) => {
                            const da = a.data_validade ? new Date(a.data_validade).getTime() : 9999999999999;
                            const db = b.data_validade ? new Date(b.data_validade).getTime() : 9999999999999;
                            return da - db;
                          });

                        // Soma das alocações dos lotes
                        const somaAlocacoes = item.alocacoes.reduce(
                          (s, a) => s + (Number(a.quantidade) || 0),
                          0
                        );
                        const isAlocacaoCorreta = somaAlocacoes === item.qtdTotal;
                        const temEstoqueSuficiente = estoqueSat >= item.qtdTotal;
                        const isExpanded = !!expandedMeds[item.medicamentoId];

                        return (
                          <React.Fragment key={item.medicamentoId}>
                            <TableRow
                              className={cn(
                                "transition-colors hover:bg-slate-50/70 dark:hover:bg-slate-900/50",
                                item.conferido && "bg-emerald-50/30 dark:bg-emerald-950/20"
                              )}
                            >
                              {/* Checkbox de conferido */}
                              <TableCell className="text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleConferido(item.medicamentoId)}
                                  className="cursor-pointer text-slate-400 hover:text-emerald-600 transition-colors p-1"
                                  title="Marcar como conferido no armário"
                                >
                                  {item.conferido ? (
                                    <CheckSquare className="w-4 h-4 text-emerald-600" />
                                  ) : (
                                    <Square className="w-4 h-4" />
                                  )}
                                </button>
                              </TableCell>

                              {/* Medicamento e Concentração */}
                              <TableCell className="max-w-[240px]">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-sm text-blue-900 dark:text-blue-200 leading-snug">
                                    {item.medicamentoNome}
                                    {item.concentracao && !item.medicamentoNome.toLowerCase().includes(item.concentracao.toLowerCase())
                                      ? ` (${item.concentracao})`
                                      : ""}
                                  </span>
                                  {item.isPsicotropico ? (
                                    <Badge className="bg-purple-100 text-purple-800 border-purple-200 font-bold text-[10px] px-1.5 py-0">
                                      P344
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-slate-500 text-[10px] px-1 py-0">
                                      Clínico
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  Cód: {item.codigo || "-"}
                                </p>
                              </TableCell>

                              {/* Quantidade de Pacientes com Botão de Expandir */}
                              <TableCell className="text-center">
                                <button
                                  type="button"
                                  onClick={() => toggleExpandMed(item.medicamentoId)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                                  title="Ver lista de pacientes que tomam este medicamento"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                                  ) : (
                                    <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                                  )}
                                  {item.pacientesAtendidos.length} pac.
                                </button>
                              </TableCell>

                              {/* Quantidade Total a Separar (Soma de Todos) */}
                              <TableCell className="text-center">
                                <div className="flex flex-col items-center gap-1">
                                  {item.pacientesAtendidos.length > 0 && item.pacientesAtendidos.every(p => p.jaCoberto) ? (
                                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-bold gap-1 py-1">
                                      <Lock className="w-3 h-3 text-emerald-600" />
                                      Já Entregue no Ciclo
                                    </Badge>
                                  ) : (
                                    <>
                                      <div className="flex items-center justify-center gap-1">
                                        <Input
                                          type="number"
                                          min="0"
                                          value={item.qtdTotal}
                                          onChange={(e) => handleUpdateQtdTotal(item.medicamentoId, e.target.value)}
                                          className="w-24 min-w-[5.5rem] h-8 px-1 text-center font-mono font-black text-sm bg-white dark:bg-slate-900 border-slate-300 text-indigo-900"
                                          title="Total somado de todos os pacientes (você pode editar antes da baixa)"
                                        />
                                        <span className="text-xs text-slate-600 font-bold">un</span>
                                      </div>
                                      {item.qtdTotal !== item.qtdSugerida && (
                                        <span className="text-[9px] text-amber-700 bg-amber-50 px-1 rounded font-medium">
                                          Sugerido: {item.qtdSugerida} un
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>
                              </TableCell>

                              {/* Alocação Multi-Lote */}
                              <TableCell className="py-2">
                                <div className="space-y-1.5">
                                  {item.alocacoes.map((aloc) => (
                                    <div key={aloc.id} className="flex items-center gap-1.5">
                                      {medLotes.length === 0 ? (
                                        <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-1 rounded border border-slate-200 font-mono flex-1">
                                          Saldo Geral / S/ Lote
                                        </span>
                                      ) : (
                                        <div className="flex-1">
                                          <Select
                                            value={aloc.loteId}
                                            onValueChange={(val) =>
                                              handleUpdateAlocacao(item.medicamentoId, aloc.id, "loteId", val)
                                            }
                                          >
                                            <SelectTrigger className="h-7 text-xs font-mono font-semibold bg-white dark:bg-slate-900 border-slate-300">
                                              <SelectValue placeholder="Selecione o Lote" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {medLotes.map((l, lIdx) => (
                                                <SelectItem key={l.id} value={l.id} className="text-xs font-mono">
                                                  {l.numero_lote} (Val: {safeFormatDate(l.data_validade)})
                                                  {l.saldoSatelite > 0
                                                    ? ` • Sat: ${l.saldoSatelite} un`
                                                    : ` • Central: ${l.quantidade_atual || 0} un`}
                                                  {lIdx === 0 ? " 🌟 [FEFO]" : ""}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>
                                      )}

                                      {/* Quantidade deste lote */}
                                      <div className="flex items-center gap-1 shrink-0">
                                        <Input
                                          type="number"
                                          min="0"
                                          value={aloc.quantidade}
                                          onChange={(e) =>
                                            handleUpdateAlocacao(
                                              item.medicamentoId,
                                              aloc.id,
                                              "quantidade",
                                              e.target.value
                                            )
                                          }
                                          className="w-24 min-w-[5.5rem] h-7 px-1 text-center font-mono font-bold text-xs bg-white dark:bg-slate-900 border-slate-300"
                                          title="Quantidade a retirar deste lote específico"
                                        />
                                        <span className="text-[10px] text-slate-500 font-mono">un</span>
                                      </div>

                                      {/* Botão Remover Lote Split */}
                                      {item.alocacoes.length > 1 && (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => handleRemoverLoteSplit(item.medicamentoId, aloc.id)}
                                          className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                                          title="Remover este lote dividido"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                      )}
                                    </div>
                                  ))}

                                  {/* Botão de Adicionar outro lote e Balanço */}
                                  <div className="flex items-center justify-between pt-0.5">
                                    <button
                                      type="button"
                                      onClick={() => handleAdicionarLoteSplit(item.medicamentoId)}
                                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer transition-colors"
                                    >
                                      <Plus className="w-3 h-3" />
                                      Dividir em outro lote
                                    </button>

                                    <div className="text-[10px] font-mono">
                                      {isAlocacaoCorreta ? (
                                        <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold border border-emerald-200">
                                          ✓ Lotes OK: {somaAlocacoes} un
                                        </span>
                                      ) : (
                                        <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded font-bold border border-amber-200">
                                          ⚠️ Alocado: {somaAlocacoes}/{item.qtdTotal} un
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </TableCell>

                              {/* Estoque Satélite */}
                              <TableCell className="text-right">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "font-mono text-xs font-bold",
                                    temEstoqueSuficiente
                                      ? "bg-slate-50 text-slate-700 border-slate-200"
                                      : "bg-red-50 text-red-700 border-red-300"
                                  )}
                                >
                                  {estoqueSat} un
                                </Badge>
                              </TableCell>
                            </TableRow>

                            {/* Detalhamento expandido dos pacientes que tomam esse remédio */}
                            {isExpanded && (
                              <TableRow className="bg-slate-50/90 dark:bg-slate-900/40">
                                <TableCell colSpan={6} className="p-3 pl-12">
                                  <div className="space-y-1.5 border-l-2 border-indigo-400 pl-3">
                                    <p className="text-[11px] font-bold text-indigo-900 dark:text-indigo-300">
                                      Pacientes que recebem {item.medicamentoNome} ({item.pacientesAtendidos.length}):
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                                      {item.pacientesAtendidos.map((pEntry, pIdx) => (
                                        <div
                                          key={pIdx}
                                          className="bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700 flex justify-between items-center"
                                        >
                                          <div className="min-w-0 pr-2">
                                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                              {pEntry.pac?.nome || "Paciente"}
                                            </p>
                                            <p className="text-[10px] text-slate-500">
                                              Leito: {pEntry.pac?.leito || "S/L"} • {pEntry.pac?.alaNome || "Geral"}
                                            </p>
                                          </div>
                                          {pEntry.jaCoberto ? (
                                            <div className="text-right shrink-0">
                                              <span className="inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded text-[10px] border border-emerald-300">
                                                <Lock className="w-3 h-3 text-emerald-600" />
                                                Já coberto {pEntry.cobertoAte ? `(até ${safeFormatDate(pEntry.cobertoAte)})` : ""}
                                              </span>
                                              <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                                                0 un a retirar
                                              </p>
                                            </div>
                                          ) : (
                                            <div className="text-right shrink-0">
                                              <span className="font-mono font-bold text-indigo-700 dark:text-indigo-400 text-xs">
                                                {pEntry.qtdIndividual} un
                                              </span>
                                              <p className="text-[9px] text-slate-400 font-mono">
                                                {pEntry.doseDiaria} un/dia
                                              </p>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>

          {/* Footer com Resumo e Ação de Baixa */}
          <DialogFooter className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
              <span>
                Conferência:{" "}
                <strong className={totalConferidos === itensFiltrados.length ? "text-emerald-600" : "text-slate-700"}>
                  {totalConferidos} de {itensFiltrados.length}
                </strong>{" "}
                medicamentos checados.
              </span>
              <span>•</span>
              <span>
                Total a Dispensar ({categoriaFiltro === "psicotropico" ? "Psicotrópicos" : categoriaFiltro === "clinico" ? "Clínicos" : "Geral"}):{" "}
                <strong className="text-indigo-700 dark:text-indigo-400 font-mono text-sm">
                  {totalGeralUnidades} un
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  setSenhaInput("");
                  setSenhaError("");
                  setSenhaModalOpen(true);
                }}
                disabled={executarBaixaMutation.isPending || itensFiltrados.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 shadow-sm cursor-pointer"
              >
                <PackageMinus className="w-4 h-4" />
                {executarBaixaMutation.isPending
                  ? "Efetivando Saída no Estoque..."
                  : `Confirmar Baixa (${itensFiltrados.length} ${categoriaFiltro === "psicotropico" ? "Psicotrópicos" : categoriaFiltro === "clinico" ? "Clínicos" : "Medicamentos"})`}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL DE SENHA DE SEGURANÇA (FASE DE TESTES: SENHA 102030) ─────────── */}
      <Dialog open={senhaModalOpen} onOpenChange={setSenhaModalOpen}>
        <DialogContent className="sm:max-w-[480px] border-2 border-red-500 bg-white dark:bg-slate-950 shadow-2xl p-0 overflow-hidden">
          {/* Header de Alerta Máximo */}
          <div className="bg-red-600 dark:bg-red-950 p-5 text-white flex items-center gap-3">
            <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-xs">
              <ShieldAlert className="w-7 h-7 text-white animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-wide uppercase">
                ACESSO RESTRITO • FASE DE TESTES
              </h2>
              <p className="text-xs text-red-100 font-medium">
                Auditoria de Estoque da Farmácia Satélite
              </p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl text-amber-900 dark:text-amber-200 text-xs leading-relaxed space-y-1.5 font-medium">
              <p className="font-bold flex items-center gap-1.5 text-amber-950 dark:text-amber-100">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                AVISO DE AUDITORIA E CONTROLE DE DISPENSAÇÃO:
              </p>
              <p>
                O sistema de confirmação de baixa está em <strong>FASE DE HOMOLOGAÇÃO RESTRITA</strong>. A confirmação irá debitar o estoque real e registrar a movimentação na auditoria técnica.
              </p>
              <p className="text-[11px] text-red-700 dark:text-red-300 font-bold">
                ⚠️ Tentativas com senha incorreta serão bloqueadas e registradas.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-red-600" />
                Para liberar a baixa, insira a senha autorizada:
              </label>
              <Input
                type="password"
                autoFocus
                placeholder="Insira a senha de liberação..."
                value={senhaInput}
                onChange={(e) => {
                  setSenhaInput(e.target.value);
                  if (senhaError) setSenhaError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleValidarSenhaEConfirmar();
                  }
                }}
                className={cn(
                  "h-11 text-center font-mono text-lg tracking-widest font-black border-2",
                  senhaError
                    ? "border-red-500 bg-red-50/50 text-red-900 focus-visible:ring-red-400"
                    : "border-slate-300 focus-visible:ring-indigo-500"
                )}
              />
              {senhaError && (
                <p className="text-xs font-bold text-red-600 dark:text-red-400 flex items-center gap-1 mt-1 animate-bounce">
                  <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                  {senhaError}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSenhaModalOpen(false);
                setSenhaInput("");
                setSenhaError("");
              }}
              className="font-bold text-xs"
            >
              Cancelar e Bloquear
            </Button>
            <Button
              type="button"
              onClick={handleValidarSenhaEConfirmar}
              disabled={executarBaixaMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white font-black text-xs gap-1.5 shadow-md px-5"
            >
              <Lock className="w-3.5 h-3.5" />
              Liberar Baixa no Estoque
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}


// ─── SUBCOMPONENTE DE FOLHA A4 DA GUIA DE SEPARAÇÃO POR DEPÓSITO (PADRÃO CENTRAL) ──
function SingleDepotGuiaSheet({
  tipo,
  itens,
  alasNomesTexto,
  selectedPacs,
  dias,
  hoje,
  dataFimDate,
  allLotes,
  medicamentos,
}) {
  const isPsico = tipo === "psicotropico";
  const totalUnidades = (itens || []).reduce(
    (acc, item) => acc + (Number(item.qtdTotal) || 0),
    0
  );
  const totalPacientes = (itens || []).reduce((acc, item) => {
    (item.pacientesAtendidos || []).forEach((p) => {
      if (p.pac?.id) acc.add(String(p.pac.id));
    });
    return acc;
  }, new Set()).size;

  const totalEstoqueSatelite = (itens || []).reduce(
    (acc, item) => acc + (Number(item.estoqueSatelite ?? item.estoque_satelite) || 0),
    0
  );

  return (
    <div
      className={cn(
        "order-sheet-container bg-white text-slate-900 w-full p-6 sm:p-8 rounded-lg border",
        isPsico ? "border-purple-300 shadow-sm" : "border-slate-300 shadow-sm"
      )}
    >
      {/* Faixa Superior Destacando o Depósito (Satélite) */}
      <div
        className={cn(
          "py-2 px-3 rounded-md mb-4 flex items-center justify-between text-xs font-black uppercase tracking-wider",
          isPsico
            ? "bg-purple-100 text-purple-900 border border-purple-300"
            : "bg-sky-100 text-sky-900 border border-sky-300"
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{isPsico ? "🧠" : "🏥"}</span>
          <span>
            {isPsico
              ? "DEPÓSITO 2: MEDICAMENTOS PSICOTRÓPICOS & CONTROLADOS (PORTARIA 344/98)"
              : "DEPÓSITO 1: MEDICAMENTOS CLÍNICOS E GERAIS (ESTOQUE SATÉLITE)"}
          </span>
        </div>
        <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded shadow-xs border">
          {itens.length} {itens.length === 1 ? "item" : "itens"}
        </span>
      </div>

      {isPsico && (
        <div className="mb-4 p-2 bg-amber-50 border-l-4 border-amber-500 rounded text-[11px] text-amber-950 font-medium">
          ⚠️ <strong>AVISO LEGAL - PORTARIA SVS/MS 344/98:</strong> Medicamentos sob controle especial. Separação restrita ao armário/depósito de psicotrópicos. Conferência obrigatória de lote físico, prazo de validade e assinatura com CRF do Farmacêutico RT.
        </div>
      )}

      {/* Cabeçalho */}
      <div className="border-b-2 border-slate-900 pb-3 mb-4 flex justify-between items-start gap-4">
        <div>
          <h1 className="text-lg font-black uppercase text-slate-950 tracking-tight leading-tight">
            ZORION SAÚDE — FARMÁCIA HOSPITALAR
          </h1>
          <h2
            className={cn(
              "text-xs font-bold uppercase mt-0.5",
              isPsico ? "text-purple-800" : "text-blue-800"
            )}
          >
            GUIA DE SEPARAÇÃO E REQUISIÇÃO • {isPsico ? "DEPÓSITO PSICOTRÓPICOS (PORTARIA 344)" : "DEPÓSITO CLÍNICO & GERAL"}
          </h2>
          <p className="text-xs text-slate-700 mt-1">
            Origem: <strong className="text-slate-950">Farmácia Satélite</strong> • Setor/Ala: <strong className="text-slate-950">{alasNomesTexto}</strong>
          </p>
          {selectedPacs && selectedPacs.length === 1 && (
            <p className="text-xs text-slate-700 mt-0.5">
              Paciente: <strong className="text-slate-950">{selectedPacs[0].nome}</strong> (Leito: {selectedPacs[0].leito || "S/L"})
            </p>
          )}
          <p className="text-xs text-slate-600 font-mono mt-0.5">
            Ciclo: <strong className="text-slate-950">{dias} dia(s)</strong> • Cobertura: <strong className="text-slate-950">{format(hoje, "dd/MM/yyyy")} a {format(dataFimDate, "dd/MM/yyyy")}</strong> • Pacientes: <strong className="text-slate-950">{totalPacientes} atendido(s)</strong>
          </p>
        </div>
        <div className="text-right text-xs text-slate-700 font-mono space-y-0.5 shrink-0">
          <p>Emissão: <strong className="text-slate-950">{format(hoje, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</strong></p>
          <p>
            Prioridade:{" "}
            <span
              className={cn(
                "font-black uppercase px-1.5 py-0.5 rounded text-[10px]",
                isPsico
                  ? "bg-purple-100 text-purple-900 border border-purple-300"
                  : "bg-slate-100 text-slate-900 border"
              )}
            >
              {isPsico ? "Controlado Especial" : "Rotina / Planejada"}
            </span>
          </p>
          <p>Suprimento: <strong className="text-slate-950">{dias} dia(s)</strong></p>
          <p>Total Unidades: <strong className={isPsico ? "text-purple-950 font-bold" : "text-blue-950 font-bold"}>{totalUnidades} un</strong></p>
        </div>
      </div>

      {/* Tabela de Itens (Idêntica à Pedidos Central) */}
      <table className="w-full text-xs border-collapse border border-slate-400 mb-4">
        <thead>
          <tr
            className={cn(
              "text-slate-900 font-bold border-b-2 border-slate-400",
              isPsico ? "bg-purple-50/80" : "bg-slate-100"
            )}
          >
            <th className="border border-slate-300 p-1.5 text-center w-7">#</th>
            <th className="border border-slate-300 p-1.5 text-center w-12">Cód.</th>
            <th className="border border-slate-300 p-1.5 text-left">
              {isPsico ? "Medicamento Psicotrópico / Controlado" : "Medicamento Clínico / Concentração"}
            </th>
            {isPsico && (
              <th className="border border-slate-300 p-1.5 text-center w-24">Portaria 344</th>
            )}
            <th className="border border-slate-300 p-1.5 text-center w-24">Alas / Pac.</th>
            <th className="border border-slate-300 p-1.5 text-center w-14">Est. Sat.</th>
            <th
              className={cn(
                "border border-slate-300 p-1.5 text-center w-20 font-black text-slate-950",
                isPsico ? "bg-purple-100/80" : "bg-blue-100/80"
              )}
            >
              Qtd Total
            </th>
            <th className="border border-slate-300 p-1.5 text-left w-64 font-bold text-slate-900 bg-amber-50/70">
              Lote(s) & Validade (FEFO Solicitado)
            </th>
            <th className="border border-slate-300 p-1.5 text-center w-14">Visto</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item, idx) => {
            const medLotes = (allLotes || [])
              .filter((l) => isLoteDoMedicamento(l, item, medicamentos))
              .filter((l) => !l.status || String(l.status).toLowerCase() !== "inativo")
              .sort((a, b) => {
                const da = a.data_validade ? new Date(a.data_validade).getTime() : 9999999999999;
                const db = b.data_validade ? new Date(b.data_validade).getTime() : 9999999999999;
                return da - db;
              });

            const alocsComLote = (item.alocacoes || []).filter(
              (a) => a.loteId || (a.numero_lote && a.numero_lote !== "Lote Geral" && a.numero_lote !== "S/ Lote")
            );

            const alasItem = Array.from(
              new Set((item.pacientesAtendidos || []).map((pa) => pa.pac?.alaNome || pa.pac?.ala_nome).filter(Boolean))
            ).join(", ") || alasNomesTexto;

            return (
              <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/70"}>
                <td className="border border-slate-300 p-1 text-center font-mono text-slate-700">{idx + 1}</td>
                <td className="border border-slate-300 p-1 text-center font-mono text-slate-700">{item.codigo || "-"}</td>
                <td className="border border-slate-300 p-1 font-medium break-words [overflow-wrap:anywhere]">
                  <span className="font-bold text-slate-950">{item.medicamentoNome}</span>
                  {item.concentracao && <span className="text-slate-700"> ({item.concentracao})</span>}
                  {item.apresentacao && <span className="text-slate-500 text-[10px] block">[{item.apresentacao}]</span>}
                </td>
                {isPsico && (
                  <td className="border border-slate-300 p-1 text-center font-mono text-[10px] text-purple-900 font-bold bg-purple-50/40">
                    {item.portariaList || "Portaria 344"}
                  </td>
                )}
                <td className="border border-slate-300 p-1 text-center text-[10px]">
                  <strong className="block text-slate-950 font-bold">{item.pacientesAtendidos.length} pac.</strong>
                  <span className="inline-block text-[8.5px] bg-sky-50 text-sky-900 border border-sky-200 px-1 rounded uppercase font-semibold">
                    {alasItem}
                  </span>
                </td>
                <td className="border border-slate-300 p-1 text-center font-mono text-slate-800">
                  {item.estoqueSatelite ?? item.estoque_satelite ?? 0} un
                </td>
                <td
                  className={cn(
                    "border border-slate-300 p-1 text-center font-mono font-black text-sm text-slate-950",
                    isPsico ? "bg-purple-50/50" : "bg-blue-50/50"
                  )}
                >
                  {item.qtdTotal} un
                </td>
                <td className="border border-slate-300 p-1 text-left font-mono text-[10px] text-slate-900 font-semibold bg-amber-50/30 leading-tight">
                  {alocsComLote.length > 0 ? (
                    <div className="space-y-1">
                      {alocsComLote.map((a, aIdx) => {
                        const lObj =
                          (allLotes || []).find((l) => String(l.id) === String(a.loteId)) ||
                          medLotes.find((l) => String(l.id) === String(a.loteId));

                        const num = lObj?.numero_lote || a.numero_lote || medLotes[0]?.numero_lote || "S/ Lote";
                        const rawVal = lObj?.data_validade || a.data_validade || medLotes[0]?.data_validade;
                        const val = rawVal ? safeFormatDate(rawVal) : "-";
                        const qtd = a.quantidade ?? item.qtdTotal;

                        return (
                          <div
                            key={aIdx}
                            className="flex items-center gap-1 bg-amber-100/70 border border-amber-300 px-1.5 py-0.5 rounded text-[9.5px]"
                          >
                            <span className="font-bold text-amber-950">LOTE: {num}</span>
                            <span className="text-slate-400">|</span>
                            <span className="font-black text-blue-950">VAL: {val}</span>
                            <span className="bg-amber-200 text-amber-950 px-1 rounded font-black text-[9px] border border-amber-300 ml-auto">
                              [{qtd} un]
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : medLotes.length > 0 ? (
                    <div className="flex items-center gap-1 bg-amber-100/70 border border-amber-300 px-1.5 py-0.5 rounded text-[9.5px]">
                      <span className="font-bold text-amber-950">LOTE: {medLotes[0].numero_lote || "S/ Lote"}</span>
                      <span className="text-slate-400">|</span>
                      <span className="font-black text-blue-950">
                        VAL: {medLotes[0].data_validade ? safeFormatDate(medLotes[0].data_validade) : "-"}
                      </span>
                      <span className="bg-amber-200 text-amber-950 px-1 rounded font-black text-[9px] border border-amber-300 ml-auto">
                        [{item.qtdTotal} un]
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic text-[9px]">Lote FEFO na separação</span>
                  )}
                </td>
                <td className="border border-slate-300 p-1 text-center font-mono text-slate-400 text-[10px]">
                  [     ]
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr
            className={cn(
              "font-bold border-t-2 border-slate-400 text-slate-950",
              isPsico ? "bg-purple-50/80" : "bg-slate-100"
            )}
          >
            <td colSpan={isPsico ? 4 : 3} className="border border-slate-300 p-2 text-right uppercase text-[11px]">
              Totais ({itens.length} {itens.length === 1 ? "item" : "itens"}):
            </td>
            <td className="border border-slate-300 p-2 text-center font-mono text-xs font-bold text-slate-900">
              {totalPacientes} pac.
            </td>
            <td className="border border-slate-300 p-2 text-center font-mono text-xs text-slate-700">
              {totalEstoqueSatelite} un
            </td>
            <td
              className={cn(
                "border border-slate-300 p-2 text-center font-mono text-sm font-black text-slate-950",
                isPsico ? "bg-purple-200/90" : "bg-blue-200/90"
              )}
            >
              {totalUnidades} un
            </td>
            <td className="border border-slate-300 p-2 font-mono text-[10px] text-slate-500">
              Dispensação e rastreabilidade por FEFO
            </td>
            <td className="border border-slate-300 p-2 text-center font-mono text-slate-400">[     ]</td>
          </tr>
        </tfoot>
      </table>

      {/* Assinaturas */}
      <div
        className={cn(
          "signature-area mt-8 pt-4 border-t border-slate-300 grid text-center text-xs",
          isPsico ? "grid-cols-3 gap-4" : "grid-cols-3 gap-6"
        )}
      >
        <div>
          <div className="border-b border-slate-400 w-44 sm:w-52 mx-auto mb-1"></div>
          <p className="font-bold text-slate-900">Solicitante (Satélite)</p>
          <p className="text-[10px] text-slate-500">Assinatura / Data</p>
        </div>
        <div>
          <div className="border-b border-slate-400 w-44 sm:w-52 mx-auto mb-1"></div>
          <p className="font-bold text-slate-900">Farmacêutico(a) RT {isPsico ? "(Obrigatório)" : ""}</p>
          <p className="text-[10px] text-slate-500">Carimbo e CRF</p>
        </div>
        <div>
          <div className="border-b border-slate-400 w-44 sm:w-52 mx-auto mb-1"></div>
          <p className="font-bold text-slate-900">Recebido no Posto / Ala</p>
          <p className="text-[10px] text-slate-500">Enfermagem (COREN)</p>
        </div>
      </div>
    </div>
  );
}

// ─── FOLHA FORMAL A4 DE GUIA DE SEPARAÇÃO (USADA NA IMPRESSÃO DA SATÉLITE) ────────
function PrintGuiaContent({
  itensFiltrados,
  categoriaFiltro,
  alasNomesTexto,
  selectedPacs,
  dias,
  hoje,
  dataFimDate,
  allLotes,
  medicamentos,
}) {
  const clinicos = (itensFiltrados || []).filter((i) => !i.isPsicotropico);
  const psicotropicos = (itensFiltrados || []).filter((i) => i.isPsicotropico);

  const showClinicos = (categoriaFiltro === "todos" || categoriaFiltro === "clinico") && clinicos.length > 0;
  const showPsico = (categoriaFiltro === "todos" || categoriaFiltro === "psicotropico") && psicotropicos.length > 0;

  return (
    <div className="w-full space-y-6">
      {showClinicos && (
        <SingleDepotGuiaSheet
          tipo="clinico"
          itens={clinicos}
          alasNomesTexto={alasNomesTexto}
          selectedPacs={selectedPacs}
          dias={dias}
          hoje={hoje}
          dataFimDate={dataFimDate}
          allLotes={allLotes}
          medicamentos={medicamentos}
        />
      )}

      {showClinicos && showPsico && (
        <div className="page-break" />
      )}

      {showPsico && (
        <SingleDepotGuiaSheet
          tipo="psicotropico"
          itens={psicotropicos}
          alasNomesTexto={alasNomesTexto}
          selectedPacs={selectedPacs}
          dias={dias}
          hoje={hoje}
          dataFimDate={dataFimDate}
          allLotes={allLotes}
          medicamentos={medicamentos}
        />
      )}
    </div>
  );
}
