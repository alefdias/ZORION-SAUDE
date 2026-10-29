import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
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
import { format, parseISO, differenceInCalendarDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isLiquido, extrairVolumeMl, converterGotasParaMl, calcularDuracaoFrascoDias } from "@/utils/liquidUtils";
import { isPsicotropico, getPortaria344List } from "@/utils/mavUtils";
import { 
  ShoppingCart, 
  PackageCheck, 
  Send, 
  CheckCircle2, 
  Clock, 
  Truck,
  Eye,
  Search,
  Package,
  Layers,
  Percent,
  RotateCcw,
  Ban,
  AlertTriangle,
  XCircle,
  Printer,
  Building2,
  ChevronDown,
  Check,
  X,
  Droplet,
  MessagesSquare,
  Trash2,
  Plus,
  Wand2,
  Boxes,
  Save
} from "lucide-react";

export function PedidosSateliteManager({ mode = "satelite" }) {
  // mode can be "satelite" or "central"
  const queryClient = useQueryClient();

  // Permissão de Administrador
  const isAdm = useMemo(() => {
    try {
      const stored = sessionStorage.getItem("axion_active_user") || localStorage.getItem("pharma_user");
      if (stored) {
        const u = JSON.parse(stored);
        const role = String(u.cargo || u.perfil || u.role || "").toLowerCase();
        const login = String(u.login || u.username || "").toLowerCase();
        return role === "administrador" || role === "admin" || login === "admin";
      }
    } catch {}
    return false;
  }, []);

  const [pedidoToDelete, setPedidoToDelete] = useState(null);
  const [isDeleteAllDialogOpen, setIsDeleteAllDialogOpen] = useState(false);

  // State for order creation (satelite)
  const [selectedAlaIds, setSelectedAlaIds] = useState(["all"]);
  const [diasCalculo, setDiasCalculo] = useState(1);
  const [customDias, setCustomDias] = useState("");
  const [margemPercentual, setMargemPercentual] = useState(0); // 0, 10, 20, 25, 30, "custom"
  const [customMargem, setCustomMargem] = useState("");
  const [descontarEstoque, setDescontarEstoque] = useState(false); // Padrão: NÃO abater estoque satélite (quantidade sugerida igual à prescrição)
  const [customQuantities, setCustomQuantities] = useState({}); // medId -> custom quantity
  const [observacaoPedido, setObservacaoPedido] = useState("");
  const [prioridadePedido, setPrioridadePedido] = useState("Normal"); // "Normal" | "Urgente" | "Emergência"
  const [depositoFiltro, setDepositoFiltro] = useState("todos"); // "todos" | "clinico" | "psicotropico"

  // State for order view modal
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [printOrderData, setPrintOrderData] = useState(null);
  const [printDepotView, setPrintDepotView] = useState("todos"); // "todos" | "clinico" | "psicotropico"
  const [printDate, setPrintDate] = useState(format(new Date(), "yyyy-MM-dd"));

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
    refetchInterval: 2000 // Real-time sync every 2s alongside PostgreSQL LISTEN/NOTIFY
  });

  // Effective days count
  const effectiveDays = useMemo(() => {
    if (diasCalculo === "custom") {
      const parsed = parseInt(customDias, 10);
      return isNaN(parsed) || parsed < 1 ? 1 : parsed;
    }
    return Number(diasCalculo) || 1;
  }, [diasCalculo, customDias]);
  // Effective safety margin percentage
  const effectiveMargem = useMemo(() => {
    if (margemPercentual === "custom") {
      const parsed = parseFloat(customMargem);
      return isNaN(parsed) || parsed < 0 ? 0 : parsed;
    }
    return Number(margemPercentual) || 0;
  }, [margemPercentual, customMargem]);

  // Se todas as alas estão selecionadas
  const isAllAlas = useMemo(() => {
    return selectedAlaIds.includes("all") || selectedAlaIds.length === 0;
  }, [selectedAlaIds]);

  // Objetos das alas selecionadas
  const selectedAlasObjects = useMemo(() => {
    if (isAllAlas) return [];
    return alas.filter(a => selectedAlaIds.includes(String(a.id)));
  }, [isAllAlas, selectedAlaIds, alas]);

  // Calculation of medication needs per selected Ala(s), Days, Safety Margin, and Stock Discount
  const { calculoNecessidade, frascosAtivosNasAlas } = useMemo(() => {
    const hojeStr = format(new Date(), "yyyy-MM-dd");

    const ativas = prescricoes.filter(p => {
      // 1. Status check: aceita Ativa, Ativo (case-insensitive) ou sem status definido
      const statusStr = String(p.status || "Ativa").trim().toLowerCase();
      if (statusStr !== "ativa" && statusStr !== "ativo") return false;

      // 1.1 Não incluir prescrições com período finalizado
      if (p.dataFim && p.dataFim < hojeStr) return false;

      // 2. Paciente check
      const pacId = p.pacienteId || p.paciente_id || p.pacienteid;
      const pac = pacientes.find(patient => 
        (pacId && pacId !== "[object Object]" && String(patient.id) === String(pacId)) ||
        (p.prontuario && patient.prontuario && String(patient.prontuario).trim() === String(p.prontuario).trim()) ||
        (p.pacienteNome && patient.nome && patient.nome.trim().toLowerCase() === p.pacienteNome.trim().toLowerCase())
      );
      if (pac && (pac.status === "Alta" || pac.status === "alta" || pac.ativo === false)) return false;

      // 3. Ala check: suporta selecionar e somar múltiplas alas (ex: Ala X + Ala Y)
      if (!isAllAlas) {
        const pacAlaId = pac ? String(pac.alaId || pac.ala_id || "") : "";
        const pacAlaNome = (pac?.alaNome || pac?.ala_nome || p.alaNome || p.ala_nome || "").trim().toLowerCase();

        const match = selectedAlaIds.some(aid => {
          const alaObj = alas.find(a => String(a.id) === String(aid));
          const alaNomeSelected = alaObj?.nome?.trim().toLowerCase();
          const matchAlaId = pacAlaId && pacAlaId === String(aid);
          const matchAlaNome = Boolean(alaNomeSelected && pacAlaNome && pacAlaNome === alaNomeSelected);
          return matchAlaId || matchAlaNome;
        });

        if (!match) {
          return false;
        }
      }
      return true;
    });

    const medMap = {};
    const frascosAtivosNasAlas = [];

    ativas.forEach(p => {
      const medId = p.medicamentoId || p.medicamento_id || p.medicamentoid;
      const targetConc = (p.concentracao || "").replace(/\s+/g, "").toLowerCase();

      // 1. Prioridade: ID exato
      let med = medId ? medicamentos.find(m => String(m.id) === String(medId)) : null;

      // 2. Se não encontrou por ID, busca por Nome E Concentração (ex: Valproato 500mg não bate com 250mg)
      if (!med && p.medicamentoNome) {
        const pNome = p.medicamentoNome.trim().toLowerCase();
        med = medicamentos.find(m => {
          if (!m.nome || m.nome.trim().toLowerCase() !== pNome) return false;
          if (targetConc) {
            const mConc = (m.concentracao || m.unidade_medida || "").replace(/\s+/g, "").toLowerCase();
            return mConc === targetConc || mConc.includes(targetConc) || targetConc.includes(mConc);
          }
          return true;
        });

        // 3. Fallback se não bater concentração
        if (!med) {
          med = medicamentos.find(m => m.nome && m.nome.trim().toLowerCase() === pNome);
        }
      }

      const finalMed = med || {
        nome: p.medicamentoNome || p.nome || "Medicamento",
        codigo: p.medicamentoCodigo || p.codigo || "-",
        apresentacao: p.apresentacao || "",
        concentracao: p.concentracao || "",
        estoque_satelite: 0
      };

      const isLiq = Boolean(p.is_liquido || isLiquido(finalMed) || isLiquido(med));

      const d08 = Number(p.dose08 ?? p.dose_08 ?? 0) || 0;
      const d14 = Number(p.dose14 ?? p.dose_14 ?? 0) || 0;
      const d22 = Number(p.dose22 ?? p.dose_22 ?? 0) || 0;
      const d06 = Number(p.dose06 ?? p.dose_06 ?? 0) || 0;
      const sumDoses = d08 + d14 + d22 + d06;

      let dailyDose = Number(p.totalDiario ?? p.total_diario ?? 0);
      if (!dailyDose || dailyDose <= 0) {
        dailyDose = sumDoses > 0 ? sumDoses : (Number(p.dose) || 0);
      }
      if (!dailyDose || dailyDose <= 0) {
        if (p.horarios) {
          try {
            const parsedH = typeof p.horarios === "string" ? JSON.parse(p.horarios) : p.horarios;
            if (Array.isArray(parsedH)) {
              dailyDose = parsedH.reduce((acc, h) => acc + (Number(h.dose) || 0), 0);
            }
          } catch (e) {}
        }
      }
      if (!dailyDose || dailyDose <= 0) {
        dailyDose = 1;
      }

      // TRATAMENTO INTELIGENTE PARA MEDICAMENTOS LÍQUIDOS MULTIDOSE
      if (isLiq) {
        const volFrasco = Number(p.volume_frasco_ml) || extrairVolumeMl(finalMed) || extrairVolumeMl(med) || 100;
        let consumoDiarioMl = dailyDose;
        if (p.unidade_dose === "gotas") {
          consumoDiarioMl = converterGotasParaMl(dailyDose);
        }

        const duracaoDias = Number(p.duracao_frasco_dias) || calcularDuracaoFrascoDias(volFrasco, consumoDiarioMl) || 10;
        const dataProximo = p.data_proximo_frasco ? String(p.data_proximo_frasco).slice(0, 10) : null;
        const dataUltimo = p.data_ultimo_frasco ? String(p.data_ultimo_frasco).slice(0, 10) : null;

        // REGRA CRÍTICA: Se o paciente já possui frasco e AINDA NÃO É O DIA DO FRASCO TERMINAR
        if (dataProximo && hojeStr < dataProximo) {
          let diasRest = 1;
          try {
            diasRest = differenceInCalendarDays(parseISO(dataProximo), parseISO(hojeStr));
          } catch (e) {
            diasRest = 1;
          }

          const pac = pacientes.find(patient => 
            (p.pacienteId && String(patient.id) === String(p.pacienteId)) ||
            (p.pacienteNome && patient.nome && patient.nome.trim().toLowerCase() === p.pacienteNome.trim().toLowerCase())
          );

          frascosAtivosNasAlas.push({
            prescricaoId: p.id,
            pacienteNome: p.pacienteNome || pac?.nome || "Paciente",
            alaNome: pac?.alaNome || p.alaNome || "Ala",
            leito: pac?.leito || p.leito || "-",
            medicamentoNome: finalMed.nome,
            concentracao: p.concentracao || finalMed.concentracao || "",
            volumeFrascoMl: volFrasco,
            consumoDiario: `${consumoDiarioMl} mL/dia${p.unidade_dose === 'gotas' ? ` (${dailyDose} gotas)` : ''}`,
            duracaoDias: duracaoDias,
            dataUltimoFrasco: dataUltimo,
            dataProximoFrasco: dataProximo,
            diasRestantes: Math.max(1, diasRest)
          });

          // Pula este medicamento do pedido de hoje, pois o frasco ainda está ativo no leito!
          return;
        }

        // Se chegou aqui: OU é o 1º frasco OU HOJE É O DIA EXATO QUE O FRASCO ACABOU!
        const groupKey = med?.id
          ? String(med.id)
          : (medId
              ? String(medId)
              : `${finalMed.nome}_${p.concentracao || finalMed.concentracao || ''}_${p.apresentacao || finalMed.apresentacao || ''}`.toLowerCase().replace(/\s+/g, '_'));

        if (!medMap[groupKey]) {
          medMap[groupKey] = {
            medicamentoId: med?.id || medId || groupKey,
            nome: finalMed.nome || p.medicamentoNome || "Medicamento",
            codigo: finalMed.codigo || p.medicamentoCodigo || "-",
            apresentacao: `FRASCO (${volFrasco} mL)`,
            concentracao: p.concentracao || finalMed.concentracao || "",
            estoqueSatelite: Number(finalMed.estoque_satelite) || 0,
            qtdDiaria: 1,
            qtdCalculada: 0,
            totalPacientes: 0,
            isLiquido: true,
            volumeFrascoMl: volFrasco,
            duracaoDias: duracaoDias,
            unidadeMedida: "FRASCO",
            motivoReposicao: !dataProximo ? "1º Frasco (Início de tratamento)" : "Frasco anterior acabou hoje!",
            isPsicotropico: Boolean(
              (med && isPsicotropico(med)) ||
              isPsicotropico(finalMed) ||
              isPsicotropico(finalMed.nome || p.medicamentoNome) ||
              isPsicotropico(finalMed.grupo_terapeutico || p.grupo_terapeutico)
            ),
            portariaList: getPortaria344List(med || finalMed || p.medicamentoNome),
            prescricaoIds: []
          };
        }

        medMap[groupKey].qtdCalculada += 1;
        medMap[groupKey].totalPacientes += 1;
        if (!medMap[groupKey].prescricaoIds.includes(p.id)) {
          medMap[groupKey].prescricaoIds.push(p.id);
        }
        return;
      }

      // Sólidos e formulações comuns (comprimidos, cápsulas, ampolas)
      const tipoFreq = p.tipoFrequencia || p.tipo_frequencia || "diaria";
      const intervalo = Math.max(1, parseInt(p.intervaloDias || p.intervalo_dias, 10) || 1);

      let calculatedTotal = 0;
      let effectiveDailyDose = dailyDose;
      if (tipoFreq === "intervalo_dias" && intervalo > 1) {
        const dosesNoPeriodo = Math.max(1, Math.ceil(effectiveDays / intervalo));
        calculatedTotal = dailyDose * dosesNoPeriodo;
        effectiveDailyDose = Number((dailyDose / intervalo).toFixed(2));
      } else {
        calculatedTotal = dailyDose * effectiveDays;
      }

      // Chave única para nunca colidir em dosagens diferentes (250mg x 500mg)
      const groupKey = med?.id
        ? String(med.id)
        : (medId
            ? String(medId)
            : `${finalMed.nome}_${p.concentracao || finalMed.concentracao || ''}_${p.apresentacao || finalMed.apresentacao || ''}`.toLowerCase().replace(/\s+/g, '_'));

      if (!medMap[groupKey]) {
        medMap[groupKey] = {
          medicamentoId: med?.id || medId || groupKey,
          nome: finalMed.nome || p.medicamentoNome || "Medicamento",
          codigo: finalMed.codigo || p.medicamentoCodigo || "-",
          apresentacao: p.apresentacao || finalMed.apresentacao || "",
          concentracao: p.concentracao || finalMed.concentracao || "",
          estoqueSatelite: Number(finalMed.estoque_satelite) || 0,
          qtdDiaria: 0,
          qtdCalculada: 0,
          totalPacientes: 0,
          isLiquido: false,
          isPsicotropico: Boolean(
            (med && isPsicotropico(med)) ||
            isPsicotropico(finalMed) ||
            isPsicotropico(finalMed.nome || p.medicamentoNome) ||
            isPsicotropico(finalMed.grupo_terapeutico || p.grupo_terapeutico)
          ),
          portariaList: getPortaria344List(med || finalMed || p.medicamentoNome),
          prescricaoIds: []
        };
      }

      medMap[groupKey].qtdDiaria += effectiveDailyDose;
      medMap[groupKey].qtdCalculada += calculatedTotal;
      medMap[groupKey].totalPacientes += 1;
      if (!medMap[groupKey].prescricaoIds.includes(p.id)) {
        medMap[groupKey].prescricaoIds.push(p.id);
      }
    });

    const listaCalculada = Object.values(medMap).map(item => {
      // 1. Quantidade com margem de segurança (arredondado para cima)
      const qtdComMargem = (effectiveMargem > 0 && !item.isLiquido)
        ? Math.ceil(item.qtdCalculada * (1 + (effectiveMargem / 100)))
        : item.qtdCalculada;

      const qtdMargemExtra = qtdComMargem - item.qtdCalculada;

      // 2. Se a opção de abater o estoque satélite já existente estiver marcada
      const qtdSugerida = descontarEstoque
        ? Math.max(0, qtdComMargem - (item.estoqueSatelite || 0))
        : qtdComMargem;

      return {
        ...item,
        qtdComMargem,
        qtdMargemExtra,
        qtdSugerida
      };
    }).sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));

    return {
      calculoNecessidade: listaCalculada,
      frascosAtivosNasAlas
    };
  }, [prescricoes, pacientes, medicamentos, selectedAlaIds, isAllAlas, alas, effectiveDays, effectiveMargem, descontarEstoque]);

  // Filtro de necessidade por depósito selecionado (Todos / Clínico / Psicotrópico)
  const calculoNecessidadeFiltrado = useMemo(() => {
    if (depositoFiltro === "clinico") {
      return calculoNecessidade.filter(i => !i.isPsicotropico);
    }
    if (depositoFiltro === "psicotropico") {
      return calculoNecessidade.filter(i => i.isPsicotropico);
    }
    return calculoNecessidade;
  }, [calculoNecessidade, depositoFiltro]);

  const totalClinicosDisponiveis = useMemo(() => {
    return calculoNecessidade.filter(i => !i.isPsicotropico).length;
  }, [calculoNecessidade]);

  const totalPsicotropicosDisponiveis = useMemo(() => {
    return calculoNecessidade.filter(i => i.isPsicotropico).length;
  }, [calculoNecessidade]);

  // Resumo macro do pedido calculado
  const resumoPedido = useMemo(() => {
    let totalPrescrito = 0;
    let totalMargemExtra = 0;
    let totalSolicitado = 0;
    let totalClinicos = 0;
    let totalPsicotropicos = 0;

    calculoNecessidade.forEach(item => {
      if (item.isPsicotropico) {
        totalPsicotropicos += 1;
      } else {
        totalClinicos += 1;
      }
    });

    calculoNecessidadeFiltrado.forEach(item => {
      const finalQtd = customQuantities[item.medicamentoId] !== undefined 
        ? parseInt(customQuantities[item.medicamentoId], 10) || 0 
        : item.qtdSugerida;

      totalPrescrito += item.qtdCalculada;
      totalMargemExtra += (item.qtdMargemExtra || 0);
      totalSolicitado += finalQtd;
    });

    return {
      totalItens: calculoNecessidadeFiltrado.length,
      totalPrescrito,
      totalMargemExtra,
      totalSolicitado,
      totalClinicos,
      totalPsicotropicos
    };
  }, [calculoNecessidade, calculoNecessidadeFiltrado, customQuantities]);

  // Create Order Mutation
  const criarPedidoMutation = useMutation({
    mutationFn: async () => {
      if (calculoNecessidadeFiltrado.length === 0) {
        throw new Error(
          depositoFiltro === "clinico"
            ? "Nenhum medicamento do Depósito Clínico foi encontrado para os filtros selecionados."
            : depositoFiltro === "psicotropico"
              ? "Nenhum medicamento do Depósito Psicotrópico (Portaria 344) foi encontrado para os filtros selecionados."
              : "Nenhuma medicação necessária encontrada para os filtros selecionados."
        );
      }

      const isAllAlasCalc = selectedAlaIds.includes("all") || selectedAlaIds.length === 0;
      const alasEncontradas = alas.filter(a => selectedAlaIds.includes(String(a.id)));
      const alaNomeStr = isAllAlasCalc 
        ? "Todas as Alas" 
        : (alasEncontradas.length > 0 ? alasEncontradas.map(a => a.nome).join(" + ") : "Alas Selecionadas");
      const alaIdStr = isAllAlasCalc ? "all" : selectedAlaIds.join(",");

      const itens = calculoNecessidadeFiltrado.map(item => {
        const finalQtd = customQuantities[item.medicamentoId] !== undefined 
          ? parseInt(customQuantities[item.medicamentoId], 10) || 0 
          : item.qtdSugerida;

        return {
          medicamento_id: item.medicamentoId,
          medicamento_nome: item.nome,
          codigo: item.codigo,
          concentracao: item.concentracao,
          apresentacao: item.apresentacao,
          qtd_prescrita: item.qtdCalculada,
          margem_percentual: effectiveMargem,
          qtd_margem_extra: item.qtdMargemExtra,
          descontou_estoque: descontarEstoque ? 1 : 0,
          estoque_satelite_momento: item.estoqueSatelite,
          qtd_solicitada: finalQtd,
          qtd_atendida: finalQtd, // Central can adjust during separation
          separado: false,
          conferido: false,
          is_psicotropico: item.isPsicotropico ? 1 : 0,
          portaria_344: item.portariaList || null
        };
      }).filter(i => i.qtd_solicitada > 0);

      if (itens.length === 0) {
        throw new Error("O pedido não possui itens com quantidade maior que zero.");
      }

      const pedidoId = crypto.randomUUID();
      const timestampCode = Date.now().toString().slice(-6);

      const tagDeposito = depositoFiltro === "clinico"
        ? "DEPÓSITO CLÍNICO"
        : depositoFiltro === "psicotropico"
          ? "DEPÓSITO PSICOTRÓPICO"
          : "TODOS OS DEPÓSITOS";

      const prefixCodigo = "PED";

      let obsFinal = observacaoPedido || "";
      const extraTags = [];
      extraTags.push(tagDeposito);
      if (effectiveMargem > 0) extraTags.push(`Margem: +${effectiveMargem}%`);
      if (descontarEstoque) extraTags.push('Estoque Satélite Abatido');
      const tagStr = extraTags.map(t => `[${t}]`).join(" ");
      obsFinal = obsFinal ? `${tagStr} ${obsFinal}` : tagStr;

      const novoPedido = {
        id: pedidoId,
        codigo: `${prefixCodigo}-${timestampCode}`,
        ala_id: alaIdStr,
        ala_nome: alaNomeStr,
        dias_calculados: effectiveDays,
        margem_seguranca: effectiveMargem,
        descontar_estoque: descontarEstoque ? 1 : 0,
        solicitante: "Farmácia Satélite",
        data_solicitacao: new Date().toISOString(),
        status: "Pendente",
        prioridade: prioridadePedido || "Normal",
        itens_json: JSON.stringify(itens),
        observacao: obsFinal,
        created_at: new Date().toISOString()
      };

      await db.entities.PedidoSatelite.create(novoPedido);
      await db.logAction("Pedido Satélite", "PedidoSatelite", novoPedido.id, {
        codigo: novoPedido.codigo,
        ala: novoPedido.ala_nome,
        prioridade: novoPedido.prioridade,
        deposito: tagDeposito,
        margem: effectiveMargem,
        itens: itens.length
      });

      // Atualiza automaticamente as prescrições de frascos líquidos que foram repostos neste pedido
      const hoje = format(new Date(), "yyyy-MM-dd");
      for (const item of calculoNecessidadeFiltrado) {
        if (item.isLiquido && Array.isArray(item.prescricaoIds) && item.prescricaoIds.length > 0) {
          for (const prId of item.prescricaoIds) {
            const pr = prescricoes.find(p => p.id === prId);
            if (pr) {
              const dur = Number(pr.duracao_frasco_dias) || Number(item.duracaoDias) || 10;
              const prox = format(addDays(new Date(), dur), "yyyy-MM-dd");
              try {
                await db.entities.PrescricaoPaciente.update(pr.id, {
                  data_ultimo_frasco: hoje,
                  data_proximo_frasco: prox
                });
              } catch (e) {
                console.warn("Erro ao atualizar ciclo de frasco líquido:", e);
              }
            }
          }
        }
      }

      return novoPedido;
    },
    onSuccess: (data) => {
      toast.success(`Pedido ${data.codigo} enviado para a Farmácia Central com sucesso!`);
      setCustomQuantities({});
      setObservacaoPedido("");
      queryClient.invalidateQueries({ queryKey: ['pedidos_satelite'] });
      queryClient.invalidateQueries({ queryKey: ['prescricoes_paciente'] });
    },
    onError: (err) => {
      const msg = typeof err === "string" ? err : (err?.message || JSON.stringify(err));
      toast.error(`Erro ao criar pedido: ${msg}`);
    }
  });

  // Handlers para gestão manual de frascos líquidos
  const handleEntregarFrascoAgora = async (frasco) => {
    try {
      const hoje = format(new Date(), "yyyy-MM-dd");
      const dur = Number(frasco.duracaoDias) || 10;
      const prox = format(addDays(new Date(), dur), "yyyy-MM-dd");
      await db.entities.PrescricaoPaciente.update(frasco.prescricaoId, {
        data_ultimo_frasco: hoje,
        data_proximo_frasco: prox
      });
      queryClient.invalidateQueries({ queryKey: ['prescricoes_paciente'] });
      toast.success(`Frasco entregue para ${frasco.pacienteNome}! Próxima reposição em ${format(parseISO(prox), "dd/MM/yyyy")} (${dur} dias).`);
    } catch (e) {
      toast.error("Erro ao registrar entrega do frasco.");
    }
  };

  const handleForcarReposicaoHoje = async (frasco) => {
    try {
      const hoje = format(new Date(), "yyyy-MM-dd");
      await db.entities.PrescricaoPaciente.update(frasco.prescricaoId, {
        data_proximo_frasco: hoje
      });
      queryClient.invalidateQueries({ queryKey: ['prescricoes_paciente'] });
      toast.info(`Frasco de ${frasco.medicamentoNome} (${frasco.pacienteNome}) inserido no pedido de hoje para reposição!`);
    } catch (e) {
      toast.error("Erro ao solicitar reposição do frasco.");
    }
  };

  const handleOpenPrintPreview = (pedidoCustom = null) => {
    if (pedidoCustom) {
      const isCli = pedidoCustom.codigo?.startsWith("PED-CLI") || pedidoCustom.observacao?.includes("DEPÓSITO CLÍNICO");
      const isPsi = pedidoCustom.codigo?.startsWith("PED-PSI") || pedidoCustom.observacao?.includes("DEPÓSITO PSICOTRÓPICO");
      setPrintDepotView(isCli ? "clinico" : isPsi ? "psicotropico" : "todos");

      let rawItens = pedidoCustom.itens || pedidoCustom.itens_json || [];
      if (typeof rawItens === "string") {
        try { rawItens = JSON.parse(rawItens); } catch {}
      }
      const itensArr = Array.isArray(rawItens) ? rawItens : [];
      setPrintOrderData({
        codigo: pedidoCustom.codigo || "PED-CENTRAL",
        alaNome: pedidoCustom.ala_nome || pedidoCustom.alaNome || "Geral",
        dataSolicitacao: pedidoCustom.data_solicitacao || pedidoCustom.dataSolicitacao || new Date(printDate + "T12:00:00").toISOString(),
        dias: pedidoCustom.dias_calculados || pedidoCustom.dias || effectiveDays,
        margem: pedidoCustom.margem_seguranca || pedidoCustom.margem || 0,
        descontarEstoque: pedidoCustom.descontar_estoque === 1 || pedidoCustom.descontarEstoque === true,
        prioridade: pedidoCustom.prioridade || "Normal",
        status: pedidoCustom.status || "Pendente",
        observacao: pedidoCustom.observacoes || pedidoCustom.observacao || "",
        itens: itensArr.map(i => {
          const medId = i.medicamento_id || i.medicamentoId || i.id;
          const medObj = medicamentos.find(m => String(m.id) === String(medId)) ||
            medicamentos.find(m => m.codigo && i.codigo && m.codigo !== "-" && m.codigo === i.codigo) ||
            medicamentos.find(m => m.nome && (m.nome === i.medicamento_nome || m.nome === i.nome));

          const actualMedId = medObj ? medObj.id : medId;

          const isPsico = i.is_psicotropico !== undefined
            ? Boolean(i.is_psicotropico)
            : (i.isPsicotropico !== undefined
                ? Boolean(i.isPsicotropico)
                : Boolean(
                    (medObj && isPsicotropico(medObj)) ||
                    isPsicotropico(i.medicamento_nome || i.nome) ||
                    isPsicotropico(i.grupo_terapeutico || i.categoria)
                  ));

          const portariaList = i.portaria_344 || (isPsico ? getPortaria344List(medObj || i.medicamento_nome || i.nome) : null);

          // Descobrir lote(s) FEFO / alocados para a impressão
          let loteDesc = "";
          if (Array.isArray(i.alocacoes_lote) && i.alocacoes_lote.length > 0) {
            const alocsValidas = i.alocacoes_lote.filter(a => Number(a.quantidade || a.qtd) > 0);
            if (alocsValidas.length > 0) {
              loteDesc = alocsValidas.map(a => {
                const num = a.numero_lote || a.lote || "S/L";
                const val = a.data_validade ? format(new Date(a.data_validade), "dd/MM/yy") : "-";
                return `L: ${num} (V: ${val}) [${a.quantidade || a.qtd} un]`;
              }).join(" | ");
            }
          }

          if (!loteDesc && (i.lote_previsto || i.lote_numero || i.lote)) {
            const num = i.lote_previsto || i.lote_numero || i.lote;
            const rawVal = i.lote_previsto_validade || i.data_validade;
            const val = rawVal ? format(new Date(rawVal), "dd/MM/yy") : "-";
            loteDesc = `Lote: ${num} (Val: ${val})`;
          }

          if (!loteDesc) {
            const medLotes = (lotes || [])
              .filter(l => (String(l.medicamento_id) === String(actualMedId) || String(l.medicamentoId) === String(actualMedId)) && (Number(l.quantidade_atual) || 0) > 0 && l.status !== "Inativo")
              .sort((a, b) => new Date(a.data_validade) - new Date(b.data_validade));
            if (medLotes.length > 0) {
              const fefo = medLotes[0];
              const val = fefo.data_validade ? format(new Date(fefo.data_validade), "dd/MM/yy") : "-";
              loteDesc = `⭐ FEFO: ${fefo.numero_lote} (Val: ${val})`;
              if (medLotes.length > 1) {
                loteDesc += ` • Disp: ${fefo.quantidade_atual} un`;
              }
            } else {
              loteDesc = "Sem saldo na Central";
            }
          }

          return {
            codigo: i.codigo || "-",
            nome: i.medicamento_nome || i.medicamentoNome || i.nome || "Medicamento",
            concentracao: i.concentracao || "",
            apresentacao: i.apresentacao || "",
            qtdPrescrita: i.qtd_prescrita ?? i.qtdPrescrita ?? i.qtdCalculada ?? 0,
            estoqueSatelite: i.estoque_satelite_momento ?? i.estoqueSatelite ?? 0,
            qtdSolicitada: i.qtd_solicitada !== undefined 
              ? i.qtd_solicitada 
              : (i.qtdSolicitada !== undefined ? i.qtdSolicitada : (i.finalQtd ?? 0)),
            isPsicotropico: isPsico,
            portariaList,
            loteDesc
          };
        })
      });
    } else {
      setPrintDepotView(depositoFiltro || "todos");

      const isAllAlasCalc = selectedAlaIds.includes("all") || selectedAlaIds.length === 0;
      const alasEncontradas = alas.filter(a => selectedAlaIds.includes(String(a.id)));
      const alaNomeStr = isAllAlasCalc 
        ? "Todas as Alas" 
        : (alasEncontradas.length > 0 ? alasEncontradas.map(a => a.nome).join(" + ") : "Alas Selecionadas");

      const itens = calculoNecessidadeFiltrado.map(item => {
        const finalQtd = customQuantities[item.medicamentoId] !== undefined 
          ? parseInt(customQuantities[item.medicamentoId], 10) || 0 
          : item.qtdSugerida;

        const medObj = medicamentos.find(m => String(m.id) === String(item.medicamentoId)) ||
          medicamentos.find(m => m.nome === item.nome);

        const actualMedId = medObj ? medObj.id : item.medicamentoId;

        const isPsico = item.isPsicotropico !== undefined 
          ? Boolean(item.isPsicotropico)
          : Boolean(
              (medObj && isPsicotropico(medObj)) ||
              isPsicotropico(item.nome) ||
              isPsicotropico(item.grupo_terapeutico || item.categoria)
            );

        const portariaList = item.portariaList || (isPsico ? getPortaria344List(medObj || item.nome) : null);

        // Buscar lote FEFO para a prévia calculada
        const medLotes = (lotes || [])
          .filter(l => (String(l.medicamento_id) === String(actualMedId) || String(l.medicamentoId) === String(actualMedId)) && (Number(l.quantidade_atual) || 0) > 0 && l.status !== "Inativo")
          .sort((a, b) => new Date(a.data_validade) - new Date(b.data_validade));

        let loteDesc = "";
        if (medLotes.length > 0) {
          const fefo = medLotes[0];
          const val = fefo.data_validade ? format(new Date(fefo.data_validade), "dd/MM/yy") : "-";
          loteDesc = `⭐ FEFO: ${fefo.numero_lote} (Val: ${val})`;
          if (medLotes.length > 1) {
            loteDesc += ` • Disp: ${fefo.quantidade_atual} un`;
          }
        } else {
          loteDesc = "Sem saldo na Central";
        }

        return {
          codigo: item.codigo || "-",
          nome: item.nome,
          concentracao: item.concentracao || "",
          apresentacao: item.apresentacao || "",
          qtdPrescrita: item.qtdCalculada,
          estoqueSatelite: item.estoqueSatelite,
          qtdSolicitada: finalQtd,
          isPsicotropico: isPsico,
          portariaList,
          loteDesc
        };
      });

      const prefixCodigo = "PREVIA";

      setPrintOrderData({
        codigo: `${prefixCodigo}-${Date.now().toString().slice(-4)}`,
        alaNome: alaNomeStr,
        dataSolicitacao: new Date(printDate + "T12:00:00").toISOString(),
        dias: effectiveDays,
        margem: effectiveMargem,
        descontarEstoque: descontarEstoque,
        prioridade: prioridadePedido,
        status: "Em Elaboração (Sem envio)",
        observacao: observacaoPedido,
        itens: itens
      });
    }
  };

  // Modal Action Mutation (Separar, Entregar, Conferir/Receber) - OTIMIZADA EM LOTE SQL ATÔMICO
  const updatePedidoMutation = useMutation({
    mutationFn: async ({ pedido, newStatus, updatedItens, motivoCancelamento }) => {
      const payload = {
        status: newStatus,
        itens_json: JSON.stringify(updatedItens),
        saida_gerada: pedido.saida_gerada || 0
      };

      const esc = (val) => (val === null || val === undefined ? "NULL" : `'${String(val).replace(/'/g, "''")}'`);
      const nowIso = format(new Date(), "yyyy-MM-dd'T'HH:mm:ssXXX");
      const sqlBatch = ["BEGIN;"];

      const freshMeds = await db.entities.Medicamento.list();
      const freshLotes = await db.entities.Lote.list();

      // Função auxiliar para processar baixa de saída da Central por transferência (em lote SQL)
      const prepararSaidaTransferenciaCentralBatch = () => {
        for (const item of updatedItens) {
          const qtdAtendida = Number(item.qtd_atendida) || 0;
          if (qtdAtendida <= 0) continue;

          const med = freshMeds.find(m => m.id === item.medicamento_id);
          if (!med) continue;

          // Se o operador definiu alocações multi-lote na separação
          if (Array.isArray(item.alocacoes_lote) && item.alocacoes_lote.length > 0) {
            for (const aloc of item.alocacoes_lote) {
              const qtdConsumir = Number(aloc.quantidade) || 0;
              if (qtdConsumir <= 0) continue;

              const lote = aloc.lote_id ? freshLotes.find(l => l.id === aloc.lote_id) : null;
              if (lote) {
                // 1. Baixa no saldo do lote
                sqlBatch.push(
                  `UPDATE "Lote" SET "quantidade_atual" = GREATEST(0, "quantidade_atual" - ${qtdConsumir}), ` +
                  `"status" = CASE WHEN ("quantidade_atual" - ${qtdConsumir}) <= 0 THEN 'esgotado' ELSE "status" END ` +
                  `WHERE "id" = ${esc(lote.id)};`
                );

                // 2. Registra Saída Central
                sqlBatch.push(
                  `INSERT INTO "Saida" ("id", "medicamento_id", "medicamento_nome", "lote_id", "numero_lote", "quantidade", "data_saida", "destino", "motivo", "observacao", "tipo", "created_at") ` +
                  `VALUES (${esc(crypto.randomUUID())}, ${esc(med.id)}, ${esc(med.nome)}, ${esc(lote.id)}, ${esc(lote.numero_lote || "S/ Lote")}, ${qtdConsumir}, ${esc(nowIso)}, 'Farmácia Satélite', 'Transferência de Estoque', ${esc(`Transferência referente ao Pedido ${pedido.codigo} (${pedido.ala_nome})`)}, 'Transferência Central -> Satélite', ${esc(nowIso)});`
                );

                // 3. Registra TransferenciaPendente
                sqlBatch.push(
                  `INSERT INTO "TransferenciaPendente" ("id", "medicamento_id", "medicamento_nome", "lote_id", "numero_lote", "quantidade", "direcao", "status", "data_solicitacao", "data_aceite", "origem", "pedido_id", "pedido_codigo", "observacao", "created_at") ` +
                  `VALUES (${esc(crypto.randomUUID())}, ${esc(med.id)}, ${esc(med.nome)}, ${esc(lote.id)}, ${esc(lote.numero_lote || "S/ Lote")}, ${qtdConsumir}, 'para_satelite', '${newStatus === "Concluido" ? "Aceito" : "Pendente"}', ${esc(nowIso)}, ${newStatus === "Concluido" ? esc(nowIso) : "NULL"}, 'pedido_satelite', ${esc(pedido.id)}, ${esc(pedido.codigo)}, ${esc(`Pedido ${pedido.codigo} (${pedido.ala_nome})`)}, ${esc(nowIso)});`
                );
              } else {
                // Sem lote específico
                sqlBatch.push(
                  `INSERT INTO "Saida" ("id", "medicamento_id", "medicamento_nome", "lote_id", "numero_lote", "quantidade", "data_saida", "destino", "motivo", "observacao", "tipo", "created_at") ` +
                  `VALUES (${esc(crypto.randomUUID())}, ${esc(med.id)}, ${esc(med.nome)}, '', ${esc(aloc.numero_lote || "S/ LOTE")}, ${qtdConsumir}, ${esc(nowIso)}, 'Farmácia Satélite', 'Transferência de Estoque', ${esc(`Transferência referente ao Pedido ${pedido.codigo} (${pedido.ala_nome})`)}, 'Transferência Central -> Satélite', ${esc(nowIso)});`
                );

                sqlBatch.push(
                  `INSERT INTO "TransferenciaPendente" ("id", "medicamento_id", "medicamento_nome", "lote_id", "numero_lote", "quantidade", "direcao", "status", "data_solicitacao", "data_aceite", "origem", "pedido_id", "pedido_codigo", "observacao", "created_at") ` +
                  `VALUES (${esc(crypto.randomUUID())}, ${esc(med.id)}, ${esc(med.nome)}, '', ${esc(aloc.numero_lote || "S/ LOTE")}, ${qtdConsumir}, 'para_satelite', '${newStatus === "Concluido" ? "Aceito" : "Pendente"}', ${esc(nowIso)}, ${newStatus === "Concluido" ? esc(nowIso) : "NULL"}, 'pedido_satelite', ${esc(pedido.id)}, ${esc(pedido.codigo)}, ${esc(`Pedido ${pedido.codigo} (${pedido.ala_nome})`)}, ${esc(nowIso)});`
                );
              }
            }
          } else {
            // Lotes disponíveis deste medicamento ordenados por vencimento (FEFO)
            let medLotes = freshLotes
              .filter(l => l.medicamento_id === med.id && (Number(l.quantidade_atual) || 0) > 0)
              .sort((a, b) => new Date(a.data_validade) - new Date(b.data_validade));

            if (item.lote_id) {
              const chosenLote = medLotes.find(l => l.id === item.lote_id);
              if (chosenLote) {
                medLotes = [chosenLote, ...medLotes.filter(l => l.id !== item.lote_id)];
              }
            }

            let pendenteAlocar = qtdAtendida;
            for (const lote of medLotes) {
              if (pendenteAlocar <= 0) break;
              const qtdConsumir = Math.min(Number(lote.quantidade_atual) || 0, pendenteAlocar);
              if (qtdConsumir > 0) {
                sqlBatch.push(
                  `UPDATE "Lote" SET "quantidade_atual" = GREATEST(0, "quantidade_atual" - ${qtdConsumir}), ` +
                  `"status" = CASE WHEN ("quantidade_atual" - ${qtdConsumir}) <= 0 THEN 'esgotado' ELSE "status" END ` +
                  `WHERE "id" = ${esc(lote.id)};`
                );

                sqlBatch.push(
                  `INSERT INTO "Saida" ("id", "medicamento_id", "medicamento_nome", "lote_id", "numero_lote", "quantidade", "data_saida", "destino", "motivo", "observacao", "tipo", "created_at") ` +
                  `VALUES (${esc(crypto.randomUUID())}, ${esc(med.id)}, ${esc(med.nome)}, ${esc(lote.id)}, ${esc(lote.numero_lote || "S/ Lote")}, ${qtdConsumir}, ${esc(nowIso)}, 'Farmácia Satélite', 'Transferência de Estoque', ${esc(`Transferência referente ao Pedido ${pedido.codigo} (${pedido.ala_nome})`)}, 'Transferência Central -> Satélite', ${esc(nowIso)});`
                );

                sqlBatch.push(
                  `INSERT INTO "TransferenciaPendente" ("id", "medicamento_id", "medicamento_nome", "lote_id", "numero_lote", "quantidade", "direcao", "status", "data_solicitacao", "data_aceite", "origem", "pedido_id", "pedido_codigo", "observacao", "created_at") ` +
                  `VALUES (${esc(crypto.randomUUID())}, ${esc(med.id)}, ${esc(med.nome)}, ${esc(lote.id)}, ${esc(lote.numero_lote || "S/ Lote")}, ${qtdConsumir}, 'para_satelite', '${newStatus === "Concluido" ? "Aceito" : "Pendente"}', ${esc(nowIso)}, ${newStatus === "Concluido" ? esc(nowIso) : "NULL"}, 'pedido_satelite', ${esc(pedido.id)}, ${esc(pedido.codigo)}, ${esc(`Pedido ${pedido.codigo} (${pedido.ala_nome})`)}, ${esc(nowIso)});`
                );

                pendenteAlocar -= qtdConsumir;
              }
            }

            if (pendenteAlocar > 0) {
              sqlBatch.push(
                `INSERT INTO "Saida" ("id", "medicamento_id", "medicamento_nome", "lote_id", "numero_lote", "quantidade", "data_saida", "destino", "motivo", "observacao", "tipo", "created_at") ` +
                `VALUES (${esc(crypto.randomUUID())}, ${esc(med.id)}, ${esc(med.nome)}, '', 'S/ LOTE', ${pendenteAlocar}, ${esc(nowIso)}, 'Farmácia Satélite', 'Transferência de Estoque', ${esc(`Transferência referente ao Pedido ${pedido.codigo} (${pedido.ala_nome})`)}, 'Transferência Central -> Satélite', ${esc(nowIso)});`
              );

              sqlBatch.push(
                `INSERT INTO "TransferenciaPendente" ("id", "medicamento_id", "medicamento_nome", "lote_id", "numero_lote", "quantidade", "direcao", "status", "data_solicitacao", "data_aceite", "origem", "pedido_id", "pedido_codigo", "observacao", "created_at") ` +
                `VALUES (${esc(crypto.randomUUID())}, ${esc(med.id)}, ${esc(med.nome)}, '', 'S/ LOTE', ${pendenteAlocar}, 'para_satelite', '${newStatus === "Concluido" ? "Aceito" : "Pendente"}', ${esc(nowIso)}, ${newStatus === "Concluido" ? esc(nowIso) : "NULL"}, 'pedido_satelite', ${esc(pedido.id)}, ${esc(pedido.codigo)}, ${esc(`Pedido ${pedido.codigo} (${pedido.ala_nome})`)}, ${esc(nowIso)});`
              );
            }
          }

          // Atualiza estoque geral do medicamento no Central
          sqlBatch.push(
            `UPDATE "Medicamento" SET "estoque_atual" = GREATEST(0, "estoque_atual" - ${qtdAtendida}) WHERE "id" = ${esc(med.id)};`
          );
        }

        payload.saida_gerada = 1;
      };

      if (newStatus === "Cancelado") {
        payload.motivo_cancelamento = motivoCancelamento || "Cancelado pelo operador";
        payload.data_cancelamento = new Date().toISOString();
        payload.observacao = pedido.observacao 
          ? `[CANCELADO: ${motivoCancelamento || "Sem motivo"}] ${pedido.observacao}`
          : `[CANCELADO: ${motivoCancelamento || "Sem motivo"}]`;
        
        // Se o pedido já estava Concluído, estorna a entrada na Satélite e devolve à Central
        if (pedido.status === "Concluido") {
          try {
            const itensArr = Array.isArray(updatedItens) && updatedItens.length > 0
              ? updatedItens 
              : (typeof pedido.itens_json === "string" ? JSON.parse(pedido.itens_json || "[]") : (pedido.itens || []));

            for (const it of itensArr) {
              const qtdRecebida = Number(it.qtd_recebida !== undefined ? it.qtd_recebida : it.qtd_atendida) || 0;
              const medId = it.medicamento_id || it.id;
              if (qtdRecebida > 0 && medId) {
                sqlBatch.push(
                  `UPDATE "Medicamento" SET "estoque_satelite" = GREATEST(0, COALESCE("estoque_satelite", 0) - ${qtdRecebida}), "estoque_atual" = COALESCE("estoque_atual", 0) + ${qtdRecebida} WHERE "id" = ${esc(medId)};`
                );
                const loteId = it.lote_id || it.lote_previsto_id;
                if (loteId) {
                  sqlBatch.push(
                    `UPDATE "Lote" SET "quantidade_atual" = COALESCE("quantidade_atual", 0) + ${qtdRecebida}, "quantidade_satelite" = GREATEST(0, COALESCE("quantidade_satelite", 0) - ${qtdRecebida}), "status" = 'disponivel' WHERE "id" = ${esc(loteId)};`
                  );
                } else {
                  // Se o item não tem lote específico gravado, estorna o saldo da satélite do lote com saldo
                  sqlBatch.push(
                    `UPDATE "Lote" SET "quantidade_satelite" = GREATEST(0, COALESCE("quantidade_satelite", 0) - ${qtdRecebida}) WHERE "id" IN (SELECT "id" FROM "Lote" WHERE "medicamento_id" = ${esc(medId)} AND COALESCE("quantidade_satelite", 0) > 0 ORDER BY "data_validade" ASC LIMIT 1);`
                  );
                }
              }
            }

            sqlBatch.push(
              `UPDATE "TransferenciaPendente" SET "status" = 'Cancelado' WHERE ("pedido_id" = ${esc(pedido.id)} OR "pedido_codigo" = ${esc(pedido.codigo)});`
            );
          } catch (e) {
            console.warn("Erro ao preparar estornos de pedido concluído:", e);
          }
        } else if (pedido.saida_gerada) {
          try {
            const allTransfers = await db.entities.TransferenciaPendente.list();
            const pedidoTransfers = (allTransfers || []).filter(
              t => (t.pedido_id === pedido.id || t.pedido_codigo === pedido.codigo) && t.status === "Pendente"
            );
            for (const tr of pedidoTransfers) {
              if (tr.lote_id) {
                sqlBatch.push(
                  `UPDATE "Lote" SET "quantidade_atual" = "quantidade_atual" + ${Number(tr.quantidade) || 0}, "status" = 'disponivel' WHERE "id" = ${esc(tr.lote_id)};`
                );
              }
              if (tr.medicamento_id) {
                sqlBatch.push(
                  `UPDATE "Medicamento" SET "estoque_atual" = "estoque_atual" + ${Number(tr.quantidade) || 0} WHERE "id" = ${esc(tr.medicamento_id)};`
                );
              }
            }
            sqlBatch.push(
              `UPDATE "TransferenciaPendente" SET "status" = 'Cancelado' WHERE ("pedido_id" = ${esc(pedido.id)} OR "pedido_codigo" = ${esc(pedido.codigo)}) AND "status" = 'Pendente';`
            );
          } catch (e) {
            console.warn("Erro ao preparar estornos:", e);
          }
        }
      } else if (newStatus === "Separado") {
        payload.data_separacao = new Date().toISOString();
        if (!pedido.saida_gerada) {
          prepararSaidaTransferenciaCentralBatch();
        }
      } else if (newStatus === "Entregue") {
        payload.data_entrega = new Date().toISOString();
        if (!pedido.saida_gerada) {
          prepararSaidaTransferenciaCentralBatch();
        }
      } else if (newStatus === "Concluido") {
        payload.data_recebimento = new Date().toISOString();

        if (!pedido.saida_gerada) {
          prepararSaidaTransferenciaCentralBatch();
        }

        // Proteção contra duplicação: confere se alguma transferência deste pedido já foi aceita previamente
        let jaAceitoAnteriormente = false;
        try {
          const allTransfers = await db.entities.TransferenciaPendente.list();
          jaAceitoAnteriormente = (allTransfers || []).some(
            t => (t.pedido_id === pedido.id || t.pedido_codigo === pedido.codigo) && (t.status === "Aceito" || t.status === "aceito")
          );
        } catch (e) {
          console.warn("Erro ao checar transferências anteriores do pedido:", e);
        }

        // Credita estoque satélite SOMENTE se ainda não foi creditado por aceite prévio
        if (!jaAceitoAnteriormente) {
          for (const item of updatedItens) {
            const qtdRealRecebida = Number(item.qtd_recebida !== undefined ? item.qtd_recebida : item.qtd_atendida) || 0;
            const qtdEnviada = Number(item.qtd_atendida) || 0;

            if (qtdRealRecebida > 0) {
              sqlBatch.push(
                `UPDATE "Medicamento" SET "estoque_satelite" = COALESCE("estoque_satelite", 0) + ${qtdRealRecebida} WHERE "id" = ${esc(item.medicamento_id)};`
              );

              // Atualiza quantidade_satelite no Lote físico correspondente
              const alocs = Array.isArray(item.alocacoes_lote) && item.alocacoes_lote.length > 0
                ? item.alocacoes_lote
                : (item.lote_id ? [{ lote_id: item.lote_id, quantidade: qtdRealRecebida }] : []);

              let qtdAlocadaLotes = 0;
              for (const aloc of alocs) {
                const lId = aloc.lote_id;
                const qLote = Number(aloc.quantidade) || 0;
                if (lId && qLote > 0) {
                  qtdAlocadaLotes += qLote;
                  sqlBatch.push(
                    `UPDATE "Lote" SET "quantidade_satelite" = COALESCE("quantidade_satelite", 0) + ${qLote} WHERE "id" = ${esc(lId)};`
                  );
                }
              }

              // Se veio sem lote ou sobrou quantidade não alocada a lote específico, vincula ao lote existente mais recente do medicamento
              const sobraSemLote = qtdRealRecebida - qtdAlocadaLotes;
              if (sobraSemLote > 0) {
                const medLotes = (lotes || []).filter(l => (l.medicamento_id === item.medicamento_id || l.medicamentoId === item.medicamento_id) && l.status !== "Inativo");
                if (medLotes.length > 0) {
                  // Pega lote com saldo ou mais recente por validade
                  const lotePadrao = medLotes.find(l => (Number(l.quantidade_satelite) || 0) > 0) || medLotes[medLotes.length - 1] || medLotes[0];
                  if (lotePadrao && lotePadrao.id) {
                    sqlBatch.push(
                      `UPDATE "Lote" SET "quantidade_satelite" = COALESCE("quantidade_satelite", 0) + ${sobraSemLote} WHERE "id" = ${esc(lotePadrao.id)};`
                    );
                  }
                }
              }
            }

            // Se houve divergência (chegou menos), devolve sobra para Central
            if (qtdRealRecebida < qtdEnviada) {
              const dif = qtdEnviada - qtdRealRecebida;
              sqlBatch.push(
                `UPDATE "Medicamento" SET "estoque_atual" = COALESCE("estoque_atual", 0) + ${dif} WHERE "id" = ${esc(item.medicamento_id)};`
              );
            }
          }
        }

        // Marca todas as transferências pendentes como Aceito
        sqlBatch.push(
          `UPDATE "TransferenciaPendente" SET "status" = 'Aceito', "data_aceite" = ${esc(nowIso)} WHERE ("pedido_id" = ${esc(pedido.id)} OR "pedido_codigo" = ${esc(pedido.codigo)}) AND "status" = 'Pendente';`
        );
      }

      // Atualiza o PedidoSatelite
      sqlBatch.push(
        `UPDATE "PedidoSatelite" SET ` +
        `"status" = ${esc(payload.status)}, ` +
        `"itens_json" = ${esc(payload.itens_json)}, ` +
        `"saida_gerada" = ${payload.saida_gerada ? 1 : 0}` +
        (payload.data_separacao ? `, "data_separacao" = ${esc(payload.data_separacao)}` : '') +
        (payload.data_entrega ? `, "data_entrega" = ${esc(payload.data_entrega)}` : '') +
        (payload.data_recebimento ? `, "data_recebimento" = ${esc(payload.data_recebimento)}` : '') +
        (payload.data_cancelamento ? `, "data_cancelamento" = ${esc(payload.data_cancelamento)}` : '') +
        (payload.motivo_cancelamento ? `, "motivo_cancelamento" = ${esc(payload.motivo_cancelamento)}` : '') +
        (payload.observacao ? `, "observacao" = ${esc(payload.observacao)}` : '') +
        ` WHERE "id" = ${esc(pedido.id)};`
      );

      sqlBatch.push("COMMIT;");

      // Executa toda a transação em UMA ÚNICA chamada/conexão TCP rápida e protegida
      await db.executeRaw(sqlBatch.join("\n"));

      // Auditoria pontual
      try {
        if (newStatus === "Cancelado") {
          await db.logAction(
            "Cancelamento Pedido",
            "PedidoSatelite",
            pedido.id,
            `Pedido ${pedido.codigo} (${pedido.ala_nome}) cancelado. Motivo: ${motivoCancelamento || "Sem motivo informado"}`
          );
        } else if (payload.saida_gerada && !pedido.saida_gerada) {
          await db.logAction(
            "Transferência de Pedido Satélite",
            "PedidoSatelite",
            pedido.id,
            `Saída por transferência de estoque gerada para o Pedido ${pedido.codigo} (${pedido.ala_nome})`
          );
        }
      } catch (e) {}
    },
    onSuccess: (_, variables) => {
      const { newStatus, pedido } = variables;
      if (newStatus === "Cancelado") {
        toast.error(`Pedido ${pedido.codigo} cancelado com sucesso. A Farmácia Satélite foi notificada!`);
      } else if (newStatus === "Em Separação") {
        toast.success("Progresso salvo com sucesso! Você pode continuar a separação deste pedido a qualquer momento.");
      }
      else if (newStatus === "Separado") toast.success("Separação finalizada! Saída gerada e registrada em Transferência de Estoque.");
      else if (newStatus === "Entregue") toast.success("Pedido enviado para a Farmácia Satélite!");
      else if (newStatus === "Concluido") toast.success("Recebimento confirmado! Estoque da Satélite atualizado com sucesso!");
      
      queryClient.invalidateQueries({ queryKey: ['pedidos_satelite'] });
      queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
      queryClient.invalidateQueries({ queryKey: ['lotes'] });
      queryClient.invalidateQueries({ queryKey: ['transferencias'] });
      queryClient.invalidateQueries({ queryKey: ['saidas'] });
      queryClient.invalidateQueries({ queryKey: ['entradas'] });
      setModalOpen(false);
      setSelectedPedido(null);
    },
    onError: (err) => {
      const msg = typeof err === "string" ? err : (err?.message || JSON.stringify(err));
      console.error("Mutation updatePedidoMutation failed:", err);
      toast.error(`Erro ao atualizar pedido: ${msg}`);
    }
  });

  // Mutation: Excluir um pedido específico (Somente Administrador)
  const deletePedidoMutation = useMutation({
    mutationFn: async (pedido) => {
      if (!isAdm) {
        throw new Error("Apenas administradores têm permissão para excluir pedidos.");
      }

      // 1. Remover transferências pendentes geradas por este pedido (se existirem)
      try {
        const allTransfers = await db.entities.TransferenciaPendente.list();
        const related = (allTransfers || []).filter(
          t => t.pedido_id === pedido.id || t.pedido_codigo === pedido.codigo
        );
        for (const tr of related) {
          await db.entities.TransferenciaPendente.delete(tr.id);
        }
      } catch (e) {
        console.warn("Erro ao limpar transferências pendentes associadas:", e);
      }

      // 2. Excluir o pedido da tabela PedidoSatelite
      await db.entities.PedidoSatelite.delete(pedido.id);

      // 3. Auditoria
      try {
        await db.logAction(
          "Excluir Pedido",
          "PedidoSatelite",
          pedido.id,
          `Pedido ${pedido.codigo} (${pedido.ala_nome || ""}) excluído do histórico pelo Administrador.`
        );
      } catch (e) {}
    },
    onSuccess: (_, pedido) => {
      toast.success(`Pedido ${pedido.codigo} excluído com sucesso! Notificações pendentes zeradas.`);
      queryClient.invalidateQueries({ queryKey: ['pedidos_satelite'] });
      queryClient.invalidateQueries({ queryKey: ['transferencias'] });
      setPedidoToDelete(null);
      if (selectedPedido?.id === pedido.id) {
        setModalOpen(false);
        setSelectedPedido(null);
      }
    },
    onError: (err) => {
      const msg = typeof err === "string" ? err : (err?.message || "Erro desconhecido");
      toast.error(`Falha ao excluir pedido: ${msg}`);
    }
  });

  // Mutation: Limpar todo o histórico de pedidos (Somente Administrador)
  const clearAllPedidosMutation = useMutation({
    mutationFn: async () => {
      if (!isAdm) {
        throw new Error("Apenas administradores têm permissão para limpar o histórico de pedidos.");
      }

      const allList = await db.entities.PedidoSatelite.list();
      for (const p of (allList || [])) {
        await db.entities.PedidoSatelite.delete(p.id);
      }

      try {
        const allTransfers = await db.entities.TransferenciaPendente.list();
        for (const t of (allTransfers || [])) {
          if (t.pedido_id || t.pedido_codigo) {
            await db.entities.TransferenciaPendente.delete(t.id);
          }
        }
      } catch (e) {}

      try {
        await db.logAction(
          "Limpar Histórico de Pedidos",
          "PedidoSatelite",
          "ALL",
          "Histórico completo de pedidos da central/satélite apagado pelo Administrador."
        );
      } catch (e) {}
    },
    onSuccess: () => {
      toast.success("Histórico de pedidos limpo com sucesso! Todas as notificações foram zeradas.");
      queryClient.invalidateQueries({ queryKey: ['pedidos_satelite'] });
      queryClient.invalidateQueries({ queryKey: ['transferencias'] });
      setIsDeleteAllDialogOpen(false);
      setModalOpen(false);
      setSelectedPedido(null);
    },
    onError: (err) => {
      const msg = typeof err === "string" ? err : (err?.message || "Erro desconhecido");
      toast.error(`Falha ao limpar histórico: ${msg}`);
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
      case "Cancelado":
        return <Badge className="bg-red-100 text-red-800 border-red-300 flex items-center gap-1 font-bold"><Ban className="w-3 h-3 text-red-600" /> Cancelado</Badge>;
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
                Calcule a necessidade de medicamentos por Ala e Período com margem flexível de segurança para reposição do estoque satélite.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => window.dispatchEvent(new CustomEvent("open_zorion_chat", { detail: { canal: "central_satelite" } }))}
                className="border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 font-bold gap-1.5 shadow-xs text-xs h-9 cursor-pointer"
                title="Abrir linha direta do Zorion Chat com a Farmácia Central"
              >
                <MessagesSquare className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                Chat com a Central
              </Button>
            </div>

            {calculoNecessidade.length > 0 && (
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-600">Prioridade:</span>
                  <select
                    value={prioridadePedido}
                    onChange={e => setPrioridadePedido(e.target.value)}
                    className={`text-xs font-bold rounded-lg border px-2 py-1.5 outline-none ${
                      prioridadePedido === "Emergência" 
                        ? "bg-red-600 text-white border-red-700" 
                        : prioridadePedido === "Urgente" 
                          ? "bg-amber-500 text-white border-amber-600" 
                          : "bg-white text-slate-700 border-slate-300"
                    }`}
                  >
                    <option value="Normal">Normal</option>
                    <option value="Urgente">⚠️ Urgente</option>
                    <option value="Emergência">🚨 Emergência</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-600">Data Impressão:</span>
                  <input
                    type="date"
                    value={printDate}
                    onChange={(e) => setPrintDate(e.target.value)}
                    className="text-xs font-bold rounded-lg border px-2 py-1.5 outline-none bg-white text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700"
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenPrintPreview()}
                  className="border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold gap-2 shadow-sm h-9"
                  title="Imprimir requisição do pedido calculada (sem enviar)"
                >
                  <Printer className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  Imprimir Pedido
                </Button>

                <Button
                  onClick={() => criarPedidoMutation.mutate()}
                  disabled={criarPedidoMutation.isPending || calculoNecessidadeFiltrado.length === 0}
                  className={cn(
                    "text-white font-bold gap-2 shadow-md h-9 transition-all",
                    depositoFiltro === "clinico" && "bg-sky-600 hover:bg-sky-700",
                    depositoFiltro === "psicotropico" && "bg-purple-600 hover:bg-purple-700",
                    depositoFiltro === "todos" && "bg-blue-600 hover:bg-blue-700"
                  )}
                >
                  <Send className="w-4 h-4" />
                  {criarPedidoMutation.isPending 
                    ? "Enviando..." 
                    : depositoFiltro === "clinico"
                      ? "Fazer Pedido (Só Clínicos)"
                      : depositoFiltro === "psicotropico"
                        ? "Fazer Pedido (Só Psicotrópicos)"
                        : "Fazer Pedido à Central"}
                </Button>
              </div>
            )}
          </div>

          {/* Seletor de Tipo de Depósito do Pedido (Clínico / Psicotrópico / Ambos) */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 bg-gradient-to-r from-slate-50 via-sky-50/20 to-purple-50/20 dark:from-slate-800/80 dark:via-slate-800/60 dark:to-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 mb-4 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-base shrink-0">
                📦
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  Destino do Pedido por Depósito
                  {depositoFiltro === "clinico" && (
                    <Badge variant="outline" className="text-[10px] bg-sky-100 text-sky-800 border-sky-300 font-bold">
                      🏥 Filtro Ativo: Apenas Medicamentos Clínicos
                    </Badge>
                  )}
                  {depositoFiltro === "psicotropico" && (
                    <Badge variant="outline" className="text-[10px] bg-purple-100 text-purple-800 border-purple-300 font-bold">
                      🧠 Filtro Ativo: Apenas Psicotrópicos (Portaria 344)
                    </Badge>
                  )}
                  {depositoFiltro === "todos" && (
                    <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-700 border-slate-300 font-medium">
                      📑 Ambos os Depósitos
                    </Badge>
                  )}
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Deseja enviar a solicitação separadamente para o <strong>Depósito Clínico</strong>, para o <strong>Depósito Psicotrópico</strong> ou <strong>Ambos</strong> juntos?
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xs shrink-0">
              <Button
                type="button"
                size="sm"
                variant={depositoFiltro === "todos" ? "default" : "ghost"}
                onClick={() => setDepositoFiltro("todos")}
                className={cn(
                  "h-8 text-xs font-bold px-3 gap-1.5 transition-all",
                  depositoFiltro === "todos" ? "bg-slate-800 hover:bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
                )}
              >
                📑 Ambos ({calculoNecessidade.length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={depositoFiltro === "clinico" ? "default" : "ghost"}
                onClick={() => setDepositoFiltro("clinico")}
                className={cn(
                  "h-8 text-xs font-bold px-3 gap-1.5 transition-all",
                  depositoFiltro === "clinico" ? "bg-sky-600 hover:bg-sky-700 text-white shadow-xs" : "text-sky-700 hover:bg-sky-50"
                )}
              >
                🏥 Só Clínicos ({totalClinicosDisponiveis})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={depositoFiltro === "psicotropico" ? "default" : "ghost"}
                onClick={() => setDepositoFiltro("psicotropico")}
                className={cn(
                  "h-8 text-xs font-bold px-3 gap-1.5 transition-all",
                  depositoFiltro === "psicotropico" ? "bg-purple-600 hover:bg-purple-700 text-white shadow-xs" : "text-purple-700 hover:bg-purple-50"
                )}
              >
                🧠 Só Psicotrópicos ({totalPsicotropicosDisponiveis})
              </Button>
            </div>
          </div>

          {/* Painel de Controles e Parâmetros */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
            {/* Seletor de Ala / Setor (Multi-Ala com Checklist) */}
            <div className="md:col-span-3 space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] text-slate-500 font-semibold block">Ala / Setor</Label>
                {!isAllAlas && (
                  <button
                    type="button"
                    onClick={() => { setSelectedAlaIds(["all"]); setCustomQuantities({}); }}
                    className="text-[10px] text-blue-600 hover:underline font-semibold"
                  >
                    Somar Todas
                  </button>
                )}
              </div>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full h-9 text-xs justify-between font-normal bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 px-2.5"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate font-medium text-slate-800 dark:text-slate-200">
                        {isAllAlas
                          ? "Todas as Alas"
                          : selectedAlasObjects.length === 1
                          ? selectedAlasObjects[0].nome
                          : `${selectedAlasObjects.length} Alas (${selectedAlasObjects.map(a => a.nome).join(" + ")})`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-1">
                      {!isAllAlas && (
                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300 font-bold">
                          {selectedAlaIds.length}
                        </Badge>
                      )}
                      <ChevronDown className="w-3.5 h-3.5 opacity-50" />
                    </div>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-2.5 shadow-lg" align="start">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                      Somar Alas no Pedido
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() => { setSelectedAlaIds(["all"]); setCustomQuantities({}); }}
                        className="text-blue-600 font-semibold hover:underline"
                      >
                        Todas
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (alas.length > 0) {
                            setSelectedAlaIds([String(alas[0].id)]);
                            setCustomQuantities({});
                          }
                        }}
                        className="text-slate-500 hover:underline"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-2">
                    Marque as alas que deseja somar no pedido (ex: Ala X + Ala Y):
                  </p>

                  <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                    <label
                      className={cn(
                        "flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-xs font-medium transition-colors",
                        isAllAlas && "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isAllAlas}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedAlaIds(["all"]);
                          } else {
                            setSelectedAlaIds(alas.map(a => String(a.id)));
                          }
                          setCustomQuantities({});
                        }}
                        className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span>Todas as Alas (Consolidado Geral)</span>
                    </label>

                    {alas.map(a => {
                      const aIdStr = String(a.id);
                      const isChecked = isAllAlas || selectedAlaIds.includes(aIdStr);
                      return (
                        <label
                          key={a.id}
                          className={cn(
                            "flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-xs transition-colors",
                            !isAllAlas && selectedAlaIds.includes(aIdStr) && "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-semibold"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              setCustomQuantities({});
                              if (isAllAlas) {
                                if (!e.target.checked) {
                                  const remaining = alas.filter(item => String(item.id) !== aIdStr).map(item => String(item.id));
                                  setSelectedAlaIds(remaining.length > 0 ? remaining : ["all"]);
                                }
                              } else {
                                if (e.target.checked) {
                                  const updated = [...selectedAlaIds, aIdStr];
                                  if (updated.length === alas.length) {
                                    setSelectedAlaIds(["all"]);
                                  } else {
                                    setSelectedAlaIds(updated);
                                  }
                                } else {
                                  const updated = selectedAlaIds.filter(id => id !== aIdStr);
                                  setSelectedAlaIds(updated.length > 0 ? updated : ["all"]);
                                }
                              }
                            }}
                            className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <span className="flex-1 truncate">{a.nome}</span>
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Badges de Alas Ativas Selecionadas */}
              {!isAllAlas && selectedAlasObjects.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {selectedAlasObjects.map(a => (
                    <span
                      key={a.id}
                      className="inline-flex items-center gap-1 text-[10px] bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 rounded-md"
                    >
                      {a.nome}
                      {selectedAlasObjects.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = selectedAlaIds.filter(id => id !== String(a.id));
                            setSelectedAlaIds(updated.length > 0 ? updated : ["all"]);
                            setCustomQuantities({});
                          }}
                          className="hover:text-rose-600"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Seletor de Dias */}
            <div className="md:col-span-4">
              <Label className="text-[11px] text-slate-500 font-semibold mb-1 block">Dias de Suprimento</Label>
              <div className="flex items-center gap-1 flex-wrap">
                {[1, 2, 3, 5, 7, 10].map(d => (
                  <Button
                    key={d}
                    size="sm"
                    variant={diasCalculo === d ? "default" : "outline"}
                    onClick={() => { setDiasCalculo(d); setCustomQuantities({}); }}
                    className={cn("h-9 text-xs px-2.5", diasCalculo === d && "bg-blue-600 font-bold")}
                  >
                    {d}D
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant={diasCalculo === "custom" ? "default" : "outline"}
                  onClick={() => { setDiasCalculo("custom"); setCustomQuantities({}); }}
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
                    onChange={(e) => { setCustomDias(e.target.value); setCustomQuantities({}); }}
                    className="w-16 h-9 text-xs"
                  />
                )}
              </div>
            </div>

            {/* Seletor de Margem de Segurança (Altas e Admissões) */}
            <div className="md:col-span-5">
              <div className="flex items-center justify-between mb-1">
                <Label className="text-[11px] text-slate-700 dark:text-slate-200 font-bold flex items-center gap-1">
                  <Percent className="w-3.5 h-3.5 text-emerald-600" />
                  Margem de Segurança (Altas / Admissões)
                </Label>
                {effectiveMargem > 0 && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                    +{effectiveMargem}% ativo
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {[0, 10, 20, 25, 30].map(m => (
                  <Button
                    key={m}
                    size="sm"
                    variant={margemPercentual === m ? "default" : "outline"}
                    onClick={() => { setMargemPercentual(m); setCustomQuantities({}); }}
                    className={cn(
                      "h-9 text-xs px-2.5",
                      margemPercentual === m 
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm" 
                        : "border-slate-200 hover:border-emerald-300"
                    )}
                  >
                    {m === 0 ? "0% (Exato)" : `+${m}%`}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant={margemPercentual === "custom" ? "default" : "outline"}
                  onClick={() => { setMargemPercentual("custom"); setCustomQuantities({}); }}
                  className={cn(
                    "h-9 text-xs px-2.5",
                    margemPercentual === "custom" 
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white font-bold" 
                      : "border-slate-200"
                  )}
                >
                  Outro %
                </Button>
                {margemPercentual === "custom" && (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min="0"
                      max="200"
                      placeholder="%"
                      value={customMargem}
                      onChange={(e) => { setCustomMargem(e.target.value); setCustomQuantities({}); }}
                      className="w-16 h-9 text-xs font-bold text-center"
                    />
                    <span className="text-xs font-bold text-slate-500">%</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Linha de Configurações Extras (Abater Estoque Atual) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-800 mb-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={descontarEstoque}
                onChange={(e) => { setDescontarEstoque(e.target.checked); setCustomQuantities({}); }}
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Abater estoque já existente na Farmácia Satélite da quantidade a pedir
              </span>
              <span className="text-[11px] text-slate-500 hidden md:inline">
                (ex: precisa de 63, já tem 10 no estoque satélite → sugere pedir 53)
              </span>
            </label>

            {Object.keys(customQuantities).length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCustomQuantities({})}
                className="h-7 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50 gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Redefinir edições manuais
              </Button>
            )}
          </div>

          {/* Cards de Resumo do Cálculo */}
          {calculoNecessidade.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <div 
                onClick={() => setDepositoFiltro("todos")}
                className={cn(
                  "p-2.5 rounded-lg border cursor-pointer transition-all hover:scale-[1.01]",
                  depositoFiltro === "todos"
                    ? "bg-slate-100 dark:bg-slate-800 border-slate-400 dark:border-slate-500 ring-2 ring-slate-400/40"
                    : "bg-slate-50 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800"
                )}
                title="Clique para ver todos os medicamentos juntos"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase font-bold text-slate-500">
                    {depositoFiltro === "todos" ? "Total do Pedido" : "Itens Filtrados"}
                  </p>
                  {depositoFiltro === "todos" && (
                    <span className="text-[9px] bg-slate-700 text-white px-1.5 py-0.2 rounded font-bold">Ambos</span>
                  )}
                </div>
                <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{resumoPedido.totalItens} <span className="text-xs font-normal text-slate-500">itens</span></p>
              </div>

              <div 
                onClick={() => setDepositoFiltro("clinico")}
                className={cn(
                  "p-2.5 rounded-lg border cursor-pointer transition-all hover:scale-[1.01]",
                  depositoFiltro === "clinico"
                    ? "bg-sky-100 dark:bg-sky-950/60 border-sky-400 dark:border-sky-600 ring-2 ring-sky-400/40 shadow-xs"
                    : "bg-sky-50 dark:bg-sky-950/30 border-sky-200/70 dark:border-sky-900/40"
                )}
                title="Clique para filtrar apenas o Depósito Clínico"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase font-bold text-sky-700 dark:text-sky-400">🏥 Depósito Clínico</p>
                  {depositoFiltro === "clinico" && (
                    <span className="text-[9px] bg-sky-600 text-white px-1.5 py-0.2 rounded font-bold">Ativo</span>
                  )}
                </div>
                <p className="text-xl font-bold text-sky-700 dark:text-sky-400">{resumoPedido.totalClinicos} <span className="text-xs font-normal text-sky-600">itens</span></p>
              </div>

              <div 
                onClick={() => setDepositoFiltro("psicotropico")}
                className={cn(
                  "p-2.5 rounded-lg border cursor-pointer transition-all hover:scale-[1.01]",
                  depositoFiltro === "psicotropico"
                    ? "bg-purple-100 dark:bg-purple-950/60 border-purple-400 dark:border-purple-600 ring-2 ring-purple-400/40 shadow-xs"
                    : "bg-purple-50 dark:bg-purple-950/30 border-purple-200/70 dark:border-purple-900/40"
                )}
                title="Clique para filtrar apenas o Depósito Psicotrópico (Portaria 344)"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase font-bold text-purple-700 dark:text-purple-400">🧠 Depósito Psicotrópico</p>
                  {depositoFiltro === "psicotropico" && (
                    <span className="text-[9px] bg-purple-600 text-white px-1.5 py-0.2 rounded font-bold">Ativo</span>
                  )}
                </div>
                <p className="text-xl font-bold text-purple-700 dark:text-purple-400">{resumoPedido.totalPsicotropicos} <span className="text-xs font-normal text-purple-600">itens</span></p>
              </div>

              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200/60 dark:border-slate-800">
                <p className="text-[10px] uppercase font-bold text-slate-500">Consumo Prescrito ({effectiveDays}D)</p>
                <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{resumoPedido.totalPrescrito} <span className="text-xs font-normal text-slate-500">un</span></p>
              </div>

              <div className="p-2.5 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200/70 dark:border-blue-900/40">
                <p className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-400">Total a Solicitar</p>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-400">{resumoPedido.totalSolicitado} <span className="text-xs font-normal text-blue-600">un</span></p>
              </div>
            </div>
          )}

          {/* Tabela de Itens da Necessidade */}
          <div className="space-y-4">
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-100 dark:bg-slate-800">
                  <TableRow>
                    <TableHead className="w-16">Cód</TableHead>
                    <TableHead>Medicamento / Concentração</TableHead>
                    <TableHead className="text-center">Consumo Diário (1D)</TableHead>
                    <TableHead className="text-center">
                      Prescrição ({effectiveDays}D)
                    </TableHead>
                    {effectiveMargem > 0 && (
                      <TableHead className="text-center bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold">
                        Com Margem (+{effectiveMargem}%)
                      </TableHead>
                    )}
                    <TableHead className="text-center">Estoque Satélite</TableHead>
                    <TableHead className="text-center bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-300 font-bold w-40">
                      Quantidade a Pedir
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calculoNecessidadeFiltrado.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={effectiveMargem > 0 ? 7 : 6} className="text-center py-10 text-slate-500">
                        {depositoFiltro === "clinico"
                          ? "Nenhum medicamento do Depósito Clínico necessário para esta Ala e Período."
                          : depositoFiltro === "psicotropico"
                            ? "Nenhum medicamento do Depósito Psicotrópico (Portaria 344) necessário para esta Ala e Período."
                            : "Nenhuma necessidade calculada para esta Ala e Período."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    calculoNecessidadeFiltrado.map(item => {
                      const isCustom = customQuantities[item.medicamentoId] !== undefined;
                      const currentVal = isCustom 
                        ? customQuantities[item.medicamentoId] 
                        : item.qtdSugerida;

                      return (
                        <TableRow key={item.medicamentoId} className="hover:bg-slate-50/80">
                          <TableCell className="font-mono text-xs text-slate-500">{item.codigo || "-"}</TableCell>
                          <TableCell className="max-w-[280px] min-w-[170px] break-words whitespace-normal [overflow-wrap:anywhere] [word-break:break-word]">
                            <div className="flex items-center flex-wrap gap-1">
                              <span className="font-bold text-slate-900 dark:text-slate-100 break-words whitespace-normal [overflow-wrap:anywhere] [word-break:break-word] leading-snug">{item.nome}</span>
                              {item.isPsicotropico ? (
                                <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-800 border-purple-300 font-bold inline-flex items-center gap-0.5">
                                  🧠 Depósito Psicotrópico
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-800 border-sky-300 font-medium inline-flex items-center gap-0.5">
                                  🏥 Depósito Clínico
                                </Badge>
                              )}
                              {item.isLiquido && (
                                <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700 border-sky-300 font-bold inline-flex items-center gap-0.5">
                                  <Droplet className="w-2.5 h-2.5" /> Frasco {item.volumeFrascoMl} mL
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-slate-500 break-words whitespace-normal">
                              {item.concentracao} {item.apresentacao ? `(${item.apresentacao})` : ""}
                            </p>
                            {item.isLiquido && item.motivoReposicao && (
                              <span className="text-[10px] text-sky-600 font-semibold block mt-0.5">
                                • {item.motivoReposicao}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center font-mono font-semibold">
                            {item.isLiquido ? "1 frasco (reposição)" : `${item.qtdDiaria} un/dia`}
                          </TableCell>
                          <TableCell className="text-center font-mono font-bold text-slate-700 dark:text-slate-300">
                            {item.isLiquido ? `${item.qtdCalculada} frasco(s)` : `${item.qtdCalculada} un`}
                          </TableCell>
                          {effectiveMargem > 0 && (
                            <TableCell className="text-center font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20">
                              <span>{item.qtdComMargem} {item.isLiquido ? "frasco(s)" : "un"}</span>
                              <span className="text-[10px] text-emerald-600 block">(+{item.qtdMargemExtra})</span>
                            </TableCell>
                          )}
                          <TableCell className="text-center font-mono font-bold text-slate-600">
                            <div>{item.estoqueSatelite} {item.isLiquido ? "frasco(s)" : "un"}</div>
                            {descontarEstoque && (
                              <span className="text-[10px] text-blue-600 font-semibold block">
                                -{Math.min(item.estoqueSatelite, item.qtdComMargem)} abatido
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center bg-blue-50/20 dark:bg-blue-950/10">
                            <div className="flex flex-col items-center">
                              <Input
                                type="number"
                                min="0"
                                value={currentVal}
                                onChange={(e) => setCustomQuantities({
                                  ...customQuantities,
                                  [item.medicamentoId]: e.target.value
                                })}
                                className={cn(
                                  "w-24 text-center font-bold font-mono mx-auto h-8 text-sm bg-white",
                                  isCustom && "border-amber-500 focus:ring-amber-500 text-amber-900"
                                )}
                              />
                              {isCustom && (
                                <span className="text-[10px] text-amber-600 font-semibold mt-0.5">
                                  Ajustado manual (Sugestão: {item.qtdSugerida})
                                </span>
                              )}
                              {!isCustom && currentVal === 0 && (
                                <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                                  (Estoque suficiente)
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* ─── PAINEL: FRASCOS LÍQUIDOS ATIVOS NAS ALAS ─── */}
            {frascosAtivosNasAlas && frascosAtivosNasAlas.length > 0 && (
              <div className="mt-6 border border-sky-200 dark:border-sky-900/50 bg-sky-50/40 dark:bg-sky-950/20 rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-sky-100 dark:border-sky-900/40">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900/60 flex items-center justify-center text-sky-600 dark:text-sky-300">
                      <Droplet className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-sky-900 dark:text-sky-100 flex items-center gap-2">
                        Frascos Líquidos Ativos no Leito / Enfermaria
                        <Badge variant="secondary" className="bg-sky-100 text-sky-800 border-sky-200 font-bold text-xs">
                          {frascosAtivosNasAlas.length} frasco(s) em uso
                        </Badge>
                      </h4>
                      <p className="text-[11px] text-sky-700/80 dark:text-sky-300/80">
                        Estes medicamentos já estão com frasco ativo nas alas. A reposição no pedido só aparecerá automaticamente no dia exato em que o frasco acabar.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {frascosAtivosNasAlas.map((frasco) => (
                    <div
                      key={frasco.prescricaoId}
                      className="bg-white dark:bg-slate-900 border border-sky-100 dark:border-slate-800 rounded-lg p-3 shadow-xs flex flex-col justify-between"
                    >
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                            {frasco.pacienteNome}
                          </span>
                          <Badge variant="outline" className="text-[10px] bg-slate-50 font-mono shrink-0">
                            {frasco.alaNome} • Leito {frasco.leito}
                          </Badge>
                        </div>

                        <div className="text-xs font-semibold text-sky-800 dark:text-sky-300">
                          {frasco.medicamentoNome} {frasco.concentracao ? `(${frasco.concentracao})` : ""}
                        </div>

                        <div className="text-[11px] text-slate-600 dark:text-slate-400">
                          Frasco {frasco.volumeFrascoMl} mL • Consumo: <strong className="text-slate-800 dark:text-slate-200">{frasco.consumoDiario}</strong>
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-1">
                          <span className="text-slate-500">Duração: {frasco.duracaoDias} dias</span>
                          <span className="font-bold text-sky-700 dark:text-sky-400">
                            Próxima troca: {frasco.dataProximoFrasco ? format(parseISO(frasco.dataProximoFrasco), "dd/MM/yyyy") : "--"}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                          Restam {frasco.diasRestantes} dia(s)
                        </Badge>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-[10px] text-amber-700 hover:bg-amber-50"
                            onClick={() => handleForcarReposicaoHoje(frasco)}
                            title="Se o frasco quebrou ou acabou antes, força a inclusão no pedido de hoje"
                          >
                            Repor Hoje
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 px-1.5 text-[10px] text-sky-700 border-sky-200 hover:bg-sky-50"
                            onClick={() => handleEntregarFrascoAgora(frasco)}
                            title="Registra entrega de novo frasco agora e reinicia o ciclo"
                          >
                            Entregar Novo
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
            <Button
              type="button"
              variant="outline"
              onClick={() => window.dispatchEvent(new CustomEvent("open_zorion_chat", { detail: { canal: "central_satelite" } }))}
              className="border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/50 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 font-bold gap-1.5 shadow-xs text-xs h-8 cursor-pointer"
              title={mode === "central" ? "Abrir linha direta do Zorion Chat com a Farmácia Satélite" : "Abrir linha direta do Zorion Chat com a Farmácia Central"}
            >
              <MessagesSquare className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              {mode === "central" ? "Chat com Satélite" : "Chat com Central"}
            </Button>

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

            {isAdm && pedidos.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDeleteAllDialogOpen(true)}
                className="border-rose-200 dark:border-rose-900/50 bg-rose-50/70 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 font-bold gap-1.5 text-xs h-8 cursor-pointer shadow-xs"
                title="Limpar todos os pedidos do histórico (Ação restrita ao Administrador)"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                Limpar Histórico
              </Button>
            )}
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
                  try {
                    if (Array.isArray(p.itens)) itensArr = p.itens;
                    else itensArr = JSON.parse(p.itens_json || "[]");
                  } catch {}

                  const isCliOnly = p.codigo?.startsWith("PED-CLI") || p.observacao?.includes("DEPÓSITO CLÍNICO");
                  const isPsiOnly = p.codigo?.startsWith("PED-PSI") || p.observacao?.includes("DEPÓSITO PSICOTRÓPICO");

                  return (
                    <TableRow key={p.id} className="hover:bg-slate-50">
                      <TableCell className="font-mono font-bold text-xs text-indigo-600">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{p.codigo}</span>
                          {p.prioridade && p.prioridade !== "Normal" && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                              p.prioridade === "Emergência" ? "bg-red-600 text-white animate-pulse" : "bg-amber-500 text-white"
                            }`}>
                              {p.prioridade}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5">
                          {isCliOnly ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] bg-sky-50 text-sky-700 font-bold border border-sky-200">
                              🏥 Depósito Clínico
                            </span>
                          ) : isPsiOnly ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] bg-purple-50 text-purple-700 font-bold border border-purple-200">
                              🧠 Depósito Psicotrópico
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-700 font-medium border border-slate-200">
                              📑 Clínicos + Psico
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold text-slate-800">{p.ala_nome}</TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {p.data_solicitacao ? format(new Date(p.data_solicitacao), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "-"}
                      </TableCell>
                      <TableCell className="text-center font-mono">
                        <div className="font-bold">{p.dias_calculados}D</div>
                        {p.margem_seguranca > 0 && (
                          <span className="inline-block mt-0.5 px-1 py-0.2 rounded text-[10px] bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                            +{p.margem_seguranca}%
                          </span>
                        )}
                        {p.descontar_estoque === 1 && (
                          <span className="block text-[9px] text-blue-600 font-semibold">
                            Est. Abatido
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-mono">{itensArr.length} item(s)</TableCell>
                      <TableCell className="text-center">{getStatusBadge(p.status)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenPrintPreview({ ...p, itens: itensArr })}
                          className="h-8 w-8 p-0 text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                          title="Imprimir este Pedido"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </Button>
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
                          {mode === "central" ? (
                            p.status === "Em Separação" ? "⏳ Continuar Separação" :
                            p.status === "Pendente" ? "Separar Pedido" : "Ver Detalhes"
                          ) : (
                            p.status === "Separado" || p.status === "Entregue" ? "Conferir & Receber" : "Ver Detalhes"
                          )}
                        </Button>
                        {isAdm && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setPedidoToDelete(p)}
                            className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                            title="Excluir este Pedido do Histórico (Somente Administrador)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
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
          isAdm={isAdm}
          lotes={lotes}
          onDelete={(p) => setPedidoToDelete(p)}
          onPrint={(p) => handleOpenPrintPreview(p)}
          onUpdateStatus={(newStatus, updatedItens, motivoCancelamento) => {
            updatePedidoMutation.mutate({
              pedido: selectedPedido,
              newStatus,
              updatedItens,
              motivoCancelamento
            });
          }}
          isPending={updatePedidoMutation.isPending}
        />
      )}

      {/* ─── MODAL CONFIRMAR EXCLUSÃO INDIVIDUAL (ADMIN) ────────────────────── */}
      <Dialog open={Boolean(pedidoToDelete)} onOpenChange={(open) => !open && setPedidoToDelete(null)}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-rose-700 dark:text-rose-400 flex items-center gap-2 text-base font-bold">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              Excluir Pedido {pedidoToDelete?.codigo}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Esta ação é restrita ao <strong>Administrador</strong>. O pedido será permanentemente removido do histórico e as notificações pendentes serão zeradas.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-200 space-y-1">
            <div><strong>Código:</strong> {pedidoToDelete?.codigo}</div>
            <div><strong>Ala / Setor:</strong> {pedidoToDelete?.ala_nome}</div>
            <div><strong>Status atual:</strong> {pedidoToDelete?.status}</div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={deletePedidoMutation.isPending}
              onClick={() => setPedidoToDelete(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={deletePedidoMutation.isPending}
              onClick={() => deletePedidoMutation.mutate(pedidoToDelete)}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              {deletePedidoMutation.isPending ? "Excluindo..." : "Confirmar Exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL CONFIRMAR LIMPAR TODO HISTÓRICO (ADMIN) ──────────────────── */}
      <Dialog open={isDeleteAllDialogOpen} onOpenChange={setIsDeleteAllDialogOpen}>
        <DialogContent className="max-w-md bg-white dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="text-rose-700 dark:text-rose-400 flex items-center gap-2 text-base font-bold">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              Limpar Todo o Histórico de Pedidos
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Atenção: Ação restrita ao <strong>Administrador</strong>. Todos os pedidos ({pedidos.length}) serão permanentemente apagados e as notificações pendentes serão zeradas.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300">
            ⚠️ Pacientes, medicamentos cadastrados e estoque físico não serão afetados. Apenas a fila de pedidos e transferências pendentes serão limpas.
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={clearAllPedidosMutation.isPending}
              onClick={() => setIsDeleteAllDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={clearAllPedidosMutation.isPending}
              onClick={() => clearAllPedidosMutation.mutate()}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              {clearAllPedidosMutation.isPending ? "Limpando..." : "Sim, Limpar Todo Histórico"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL DE PREVIEW DA IMPRESSÃO EM TELA ────────────────────── */}
      <Dialog open={Boolean(printOrderData)} onOpenChange={(open) => !open && setPrintOrderData(null)}>
        <DialogContent className="max-w-5xl max-h-[94vh] overflow-y-auto p-0 border-none bg-slate-100 dark:bg-slate-900 shadow-2xl print:!hidden print:hidden">
          <DialogHeader className="p-4 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3 no-print sticky top-0 z-20">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-blue-600" />
              <div>
                <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Visualização de Impressão — Separação por Depósito
                </DialogTitle>
                <p className="text-xs text-slate-500">
                  Folhas independentes para Depósito Clínico e Depósito de Psicotrópicos (Portaria 344/98)
                </p>
              </div>
            </div>

            {/* SELETOR DE DEPÓSITO */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setPrintDepotView("todos")}
                  className={cn(
                    "px-2.5 py-1 rounded font-bold transition-all text-xs",
                    printDepotView === "todos"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                  )}
                >
                  📑 Ambos (1 Folha p/ Depósito)
                </button>
                <button
                  type="button"
                  onClick={() => setPrintDepotView("clinico")}
                  className={cn(
                    "px-2.5 py-1 rounded font-bold transition-all text-xs flex items-center gap-1",
                    printDepotView === "clinico"
                      ? "bg-sky-600 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                  )}
                >
                  🏥 Clínicos ({printOrderData?.itens?.filter(i => !i.isPsicotropico).length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setPrintDepotView("psicotropico")}
                  className={cn(
                    "px-2.5 py-1 rounded font-bold transition-all text-xs flex items-center gap-1",
                    printDepotView === "psicotropico"
                      ? "bg-purple-700 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900"
                  )}
                >
                  🧠 Psicotrópicos ({printOrderData?.itens?.filter(i => i.isPsicotropico).length || 0})
                </button>
              </div>

              <Button variant="outline" size="sm" onClick={() => setPrintOrderData(null)}>
                Fechar
              </Button>
              <Button size="sm" onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1.5 shadow-sm">
                <Printer className="w-4 h-4" />
                {printDepotView === "todos" 
                  ? "Imprimir Ambos (Separar Folhas)" 
                  : printDepotView === "clinico" 
                    ? "Imprimir Depósito Clínico" 
                    : "Imprimir Depósito Psicotrópicos"}
              </Button>
            </div>
          </DialogHeader>

          {/* FOLHA FORMAL A4 (PREVIEW EM TELA) */}
          <div className="p-4 sm:p-8 bg-slate-100 dark:bg-slate-900 mx-auto w-full space-y-6">
            <PrintOrderSheetContent data={printOrderData} selectedDepot={printDepotView} isPrintPortal={false} />
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── PORTAL OFICIAL DE IMPRESSÃO (DIRETO NO BODY, FORA DO MODAL E DO ROOT) ─ */}
      {Boolean(printOrderData) && typeof document !== "undefined" && createPortal(
        <div id="print-order-sheet-portal">
          <PrintOrderSheetContent data={printOrderData} selectedDepot={printDepotView} isPrintPortal={true} />
        </div>,
        document.body
      )}

      {/* ─── ESTILOS CSS PARA IMPRESSÃO EM FOLHA A4 ───────────────────────────── */}
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
          body > *:not(#print-order-sheet-portal) {
            display: none !important;
          }
          /* Ocultar app root, overlays e modais do radix, navegações e barras */
          #root,
          [role="dialog"],
          [data-radix-portal],
          [data-state],
          .fixed,
          .no-print,
          nav,
          header,
          aside,
          footer,
          button,
          .sonner-toaster {
            display: none !important;
          }
          /* Exibir exclusivamente a folha no portal de impressão direta */
          #print-order-sheet-portal {
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
          #print-order-sheet-portal * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-sizing: border-box !important;
          }
          #print-order-sheet-portal .sheet-wrapper {
            page-break-inside: auto !important;
            break-inside: auto !important;
            margin-bottom: 0 !important;
          }
          #print-order-sheet-portal .page-break {
            page-break-before: always !important;
            break-before: page !important;
            clear: both !important;
            display: block !important;
            height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
          }
          #print-order-sheet-portal table {
            width: 100% !important;
            border-collapse: collapse !important;
            page-break-inside: auto !important;
          }
          #print-order-sheet-portal thead {
            display: table-header-group !important;
          }
          #print-order-sheet-portal tbody {
            display: table-row-group !important;
          }
          #print-order-sheet-portal tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          #print-order-sheet-portal td, #print-order-sheet-portal th {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          #print-order-sheet-portal tfoot {
            display: table-footer-group !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          #print-order-sheet-portal .signature-area {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
        @media screen {
          #print-order-sheet-portal {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}

// ─── GERADOR DIRETO E ISOLADO DE IMPRESSÃO A4 (VIA IFRAME) ───────────────────
export function imprimirGuiaPedido(pedido, lotes = []) {
  if (!pedido) return;

  let rawItens = pedido.itens || pedido.itens_json || [];
  if (typeof rawItens === "string") {
    try { rawItens = JSON.parse(rawItens); } catch {}
  }
  const itensArr = Array.isArray(rawItens) ? rawItens : [];
  if (itensArr.length === 0) {
    toast.error("Este pedido não possui itens para impressão.");
    return;
  }

  const codigo = pedido.codigo || "PED-CENTRAL";
  const alaNome = pedido.ala_nome || pedido.alaNome || "Farmácia Satélite";
  const status = pedido.status || "Pendente";
  const prioridade = pedido.prioridade || "Normal";
  const observacao = pedido.observacoes || pedido.observacao || "";
  let formattedDate = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  try {
    if (pedido.data_solicitacao || pedido.dataSolicitacao) {
      formattedDate = format(new Date(pedido.data_solicitacao || pedido.dataSolicitacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    }
  } catch {}

  const safeValidade = (raw) => {
    if (!raw) return "-";
    try {
      const d = new Date(raw);
      if (isNaN(d.getTime())) return "-";
      return format(d, "dd/MM/yyyy");
    } catch {
      return "-";
    }
  };

  // Separar itens entre Clínicos e Psicotrópicos
  const clinicos = [];
  const psicotropicos = [];

  itensArr.forEach((item, idx) => {
    const isPsico = Boolean(
      item.is_psicotropico !== undefined ? Number(item.is_psicotropico) === 1 :
      item.isPsicotropico !== undefined ? Boolean(item.isPsicotropico) :
      isPsicotropico(item.medicamento_nome || item.nome)
    );

    // Extrair Lotes e Validades
    let lotesFormatados = [];
    if (Array.isArray(item.alocacoes_lote) && item.alocacoes_lote.length > 0) {
      const valid = item.alocacoes_lote.filter(a => Number(a.quantidade || a.qtd) > 0 || a.numero_lote);
      if (valid.length > 0) {
        lotesFormatados = valid.map(a => {
          const v = safeValidade(a.data_validade);
          return `Lote: <strong>${a.numero_lote || a.lote || "S/L"}</strong> &bull; Val: <strong>${v}</strong> [${a.quantidade || a.qtd} un]`;
        });
      }
    }

    if (lotesFormatados.length === 0 && (item.lote_previsto || item.numero_lote || item.lote)) {
      const num = item.lote_previsto || item.numero_lote || item.lote;
      const vRaw = item.lote_previsto_validade || item.data_validade;
      const v = safeValidade(vRaw);
      lotesFormatados.push(`Lote: <strong>${num}</strong> &bull; Val: <strong>${v}</strong>`);
    }

    if (lotesFormatados.length === 0) {
      const medId = item.medicamento_id || item.id;
      const medLotes = (lotes || [])
        .filter(l => (String(l.medicamento_id) === String(medId) || String(l.medicamentoId) === String(medId)) && (Number(l.quantidade_atual) || 0) > 0 && l.status !== "Inativo")
        .sort((a, b) => new Date(a.data_validade) - new Date(b.data_validade));
      if (medLotes.length > 0) {
        const fefo = medLotes[0];
        const v = safeValidade(fefo.data_validade);
        lotesFormatados.push(`⭐ FEFO: <strong>${fefo.numero_lote}</strong> &bull; Val: <strong>${v}</strong> &bull; Disp: ${fefo.quantidade_atual} un`);
      } else {
        lotesFormatados.push(`<span style="color:#94a3b8; font-style:italic;">Aguardando alocação Central</span>`);
      }
    }

    const itemProcessado = {
      idx: idx + 1,
      codigo: item.codigo || "-",
      nome: item.medicamento_nome || item.medicamentoNome || item.nome || "Medicamento",
      concentracao: item.concentracao || "",
      apresentacao: item.apresentacao || "",
      isPsicotropico: isPsico,
      portaria: item.portaria_344 || (isPsico ? getPortaria344List(item.medicamento_nome || item.nome) : ""),
      qtdSolicitada: Number(item.qtd_solicitada !== undefined ? item.qtd_solicitada : (item.qtdSolicitada ?? 0)),
      qtdEnviada: Number(item.qtd_atendida !== undefined ? item.qtd_atendida : (item.qtdAtendida ?? item.qtd_solicitada ?? 0)),
      lotesText: lotesFormatados.join("<br/>")
    };

    if (isPsico) {
      psicotropicos.push(itemProcessado);
    } else {
      clinicos.push(itemProcessado);
    }
  });

  const renderTabela = (lista, isPsico) => {
    const totalSol = lista.reduce((a, b) => a + b.qtdSolicitada, 0);
    const totalEnv = lista.reduce((a, b) => a + b.qtdEnviada, 0);

    const rows = lista.map((it, i) => `
      <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="border:1px solid #cbd5e1; padding:6px 4px; text-align:center; font-family:monospace; font-size:11px;">${i + 1}</td>
        <td style="border:1px solid #cbd5e1; padding:6px 4px; text-align:center; font-family:monospace; font-size:11px;">${it.codigo}</td>
        <td style="border:1px solid #cbd5e1; padding:6px 8px;">
          <strong style="color:#0f172a; font-size:12px;">${it.nome}</strong>
          ${it.concentracao ? `<span style="color:#475569; font-size:11px;"> (${it.concentracao})</span>` : ''}
          ${it.apresentacao ? `<div style="color:#64748b; font-size:10px;">[${it.apresentacao}]</div>` : ''}
        </td>
        ${isPsico ? `<td style="border:1px solid #cbd5e1; padding:6px 4px; text-align:center; font-weight:bold; color:#6b21a8; font-size:10px; background:#faf5ff;">${it.portaria || 'Portaria 344'}</td>` : ''}
        <td style="border:1px solid #cbd5e1; padding:6px 4px; text-align:center; font-family:monospace; font-weight:bold; font-size:12px;">${it.qtdSolicitada} un</td>
        <td style="border:1px solid #cbd5e1; padding:6px 4px; text-align:center; font-family:monospace; font-weight:bold; font-size:12px; color:#1e40af; background:#eff6ff;">${it.qtdEnviada} un</td>
        <td style="border:1px solid #cbd5e1; padding:6px 8px; font-size:11px; font-family:monospace; color:#1e293b; background:#fffbeb;">
          ${it.lotesText}
        </td>
        <td style="border:1px solid #cbd5e1; padding:6px 4px; text-align:center; color:#94a3b8; font-family:monospace; font-size:11px;">[ &nbsp; &nbsp; ]</td>
      </tr>
    `).join('');

    return `
      <table style="width:100%; border-collapse:collapse; margin-bottom:14px; font-size:11px;">
        <thead>
          <tr style="background:${isPsico ? '#f3e8ff' : '#f1f5f9'}; color:#0f172a; font-weight:bold;">
            <th style="border:1px solid #94a3b8; padding:6px 4px; width:28px; text-align:center;">#</th>
            <th style="border:1px solid #94a3b8; padding:6px 4px; width:55px; text-align:center;">Cód.</th>
            <th style="border:1px solid #94a3b8; padding:6px 8px; text-align:left;">Medicamento / Concentração</th>
            ${isPsico ? '<th style="border:1px solid #94a3b8; padding:6px 4px; width:85px; text-align:center;">Portaria 344</th>' : ''}
            <th style="border:1px solid #94a3b8; padding:6px 4px; width:80px; text-align:center;">Qtd Solicitada</th>
            <th style="border:1px solid #94a3b8; padding:6px 4px; width:80px; text-align:center; background:#dbeafe;">Qtd Enviada</th>
            <th style="border:1px solid #94a3b8; padding:6px 8px; text-align:left; background:#fef3c7;">Lote(s) & Validade (Central)</th>
            <th style="border:1px solid #94a3b8; padding:6px 4px; width:45px; text-align:center;">Visto</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
        <tfoot>
          <tr style="background:${isPsico ? '#f3e8ff' : '#f1f5f9'}; font-weight:bold;">
            <td colspan="${isPsico ? 4 : 3}" style="border:1px solid #94a3b8; padding:6px 8px; text-align:right; font-size:11px; text-transform:uppercase;">
              Totais (${lista.length} ${lista.length === 1 ? 'item' : 'itens'}):
            </td>
            <td style="border:1px solid #94a3b8; padding:6px 4px; text-align:center; font-family:monospace; font-size:12px;">${totalSol} un</td>
            <td style="border:1px solid #94a3b8; padding:6px 4px; text-align:center; font-family:monospace; font-size:13px; color:#1e40af; background:#bfdbfe;">${totalEnv} un</td>
            <td colspan="2" style="border:1px solid #94a3b8; padding:6px 8px;"></td>
          </tr>
        </tfoot>
      </table>
    `;
  };

  const renderCabecalho = (tipoTitulo, corTitulo) => `
    <div style="border-bottom:2px solid #0f172a; padding-bottom:8px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:flex-start;">
      <div>
        <h1 style="margin:0; font-size:15px; font-weight:900; letter-spacing:-0.5px; text-transform:uppercase; color:#0f172a;">ZORION SAÚDE &bull; FARMÁCIA HOSPITALAR</h1>
        <h2 style="margin:2px 0 0 0; font-size:12px; font-weight:bold; text-transform:uppercase; color:${corTitulo};">${tipoTitulo}</h2>
        <div style="margin-top:4px; font-size:11px; color:#334155;">
          Origem: <strong style="color:#0f172a;">${alaNome}</strong> &bull; Pedido: <strong style="color:#0f172a; font-family:monospace;">${codigo}</strong> &bull; Status: <strong style="color:#0f172a;">${status}</strong>
        </div>
      </div>
      <div style="text-align:right; font-size:11px; color:#334155; font-family:monospace;">
        <div>Emissão: <strong style="color:#0f172a;">${formattedDate}</strong></div>
        <div>Prioridade: <strong style="color:#0f172a; text-transform:uppercase;">${prioridade}</strong></div>
        ${observacao ? `<div style="margin-top:2px; font-size:10px; color:#64748b; max-width:280px;">Obs: ${observacao}</div>` : ''}
      </div>
    </div>
  `;

  const renderAssinaturas = (isPsico) => `
    <div style="margin-top:20px; padding-top:10px; border-top:1px solid #cbd5e1; display:flex; justify-content:space-around; text-align:center; font-size:11px; page-break-inside:avoid; break-inside:avoid;">
      <div>
        <div style="border-bottom:1px solid #475569; width:190px; margin:0 auto 4px auto;"></div>
        <div style="font-weight:bold; color:#0f172a;">Solicitante (Satélite)</div>
        <div style="font-size:9px; color:#64748b;">Assinatura / Data</div>
      </div>
      ${isPsico ? `
      <div>
        <div style="border-bottom:1px solid #6b21a8; width:190px; margin:0 auto 4px auto;"></div>
        <div style="font-weight:bold; color:#6b21a8;">Farmacêutico(a) Resp. Central</div>
        <div style="font-size:9px; color:#7e22ce;">Carimbo e CRF (Portaria 344)</div>
      </div>
      ` : ''}
      <div>
        <div style="border-bottom:1px solid #475569; width:190px; margin:0 auto 4px auto;"></div>
        <div style="font-weight:bold; color:#0f172a;">Separador Central</div>
        <div style="font-size:9px; color:#64748b;">Assinatura / Data</div>
      </div>
    </div>
  `;

  let bodyHtml = "";

  // FOLHA 1: CLÍNICOS
  if (clinicos.length > 0) {
    bodyHtml += `
      <div class="folha-deposito" style="page-break-after: ${psicotropicos.length > 0 ? 'always' : 'auto'}; break-after: ${psicotropicos.length > 0 ? 'page' : 'auto'}; margin-bottom: 24px;">
        <div style="background:#e0f2fe; color:#0369a1; border:1px solid #7dd3fc; border-radius:6px; padding:6px 10px; font-weight:bold; font-size:11px; margin-bottom:8px; display:flex; justify-content:space-between;">
          <span>🏥 DEPÓSITO 1: MEDICAMENTOS CLÍNICOS E GERAIS</span>
          <span>${clinicos.length} ${clinicos.length === 1 ? 'item' : 'itens'}</span>
        </div>
        ${renderCabecalho("REQUISIÇÃO DE MEDICAMENTOS • DEPÓSITO CLÍNICO", "#0369a1")}
        ${renderTabela(clinicos, false)}
        ${renderAssinaturas(false)}
      </div>
    `;
  }

  // FOLHA 2: PSICOTRÓPICOS
  if (psicotropicos.length > 0) {
    bodyHtml += `
      <div class="folha-deposito" style="margin-top:${clinicos.length > 0 ? '20px' : '0'};">
        <div style="background:#f3e8ff; color:#6b21a8; border:1px solid #d8b4fe; border-radius:6px; padding:6px 10px; font-weight:bold; font-size:11px; margin-bottom:8px; display:flex; justify-content:space-between;">
          <span>🧠 DEPÓSITO 2: MEDICAMENTOS PSICOTRÓPICOS & CONTROLADOS (PORTARIA SVS/MS 344/98)</span>
          <span>${psicotropicos.length} ${psicotropicos.length === 1 ? 'item' : 'itens'}</span>
        </div>
        <div style="background:#fffbeb; border-left:4px solid #f59e0b; padding:6px 10px; font-size:10px; color:#92400e; margin-bottom:8px; border-radius:4px;">
          ⚠️ <strong>AVISO LEGAL - PORTARIA SVS/MS 344/98:</strong> Medicamentos sujeitos a controle especial. Separação restrita ao cofre/depósito de controlados com conferência obrigatória de lote, validade e visto farmacêutico.
        </div>
        ${renderCabecalho("REQUISIÇÃO DE MEDICAMENTOS • DEPÓSITO PSICOTRÓPICOS (PORTARIA 344)", "#6b21a8")}
        ${renderTabela(psicotropicos, true)}
        ${renderAssinaturas(true)}
      </div>
    `;
  }

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <title>Pedido_${codigo}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 8mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          margin: 0;
          padding: 8px;
          color: #0f172a;
          background: #ffffff;
        }
        table {
          page-break-inside: auto;
        }
        tr {
          page-break-inside: avoid;
          page-break-after: auto;
        }
        @media print {
          body {
            padding: 0;
          }
        }
      </style>
    </head>
    <body>
      ${bodyHtml}
    </body>
    </html>
  `;

  toast.info("Abrindo formulário de impressão do pedido...");

  // Criar iframe temporário para acionar a impressão física com total isolamento
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "none";
  iframe.style.zIndex = "-9999";
  document.body.appendChild(iframe);

  iframe.contentWindow.document.open();
  iframe.contentWindow.document.write(fullHtml);
  iframe.contentWindow.document.close();

  iframe.contentWindow.focus();
  setTimeout(() => {
    try {
      iframe.contentWindow.print();
    } catch (err) {
      console.error("Erro ao imprimir pedido:", err);
    }
    setTimeout(() => {
      try { document.body.removeChild(iframe); } catch {}
    }, 1500);
  }, 300);
}

// ─── SUBCOMPONENTE DE FOLHA A4 INDIVIDUAL POR DEPÓSITO ───────────────────────
function SingleDepotSheet({ data, tipo, itens, formattedDate }) {
  const isPsico = tipo === "psicotropico";
  const totalSolicitado = (itens || []).reduce(
    (acc, item) => acc + (Number(item.qtdSolicitada) || 0),
    0
  );
  const totalEnviado = (itens || []).reduce(
    (acc, item) => acc + (Number(item.qtdEnviada !== undefined ? item.qtdEnviada : item.qtdSolicitada) || 0),
    0
  );

  return (
    <div className={cn(
      "order-sheet-container bg-white text-slate-900 w-full p-6 sm:p-8 rounded-lg border",
      isPsico ? "border-purple-300 shadow-sm" : "border-slate-300 shadow-sm"
    )}>
      {/* Faixa Superior Destacando o Depósito */}
      <div className={cn(
        "py-2 px-3 rounded-md mb-4 flex items-center justify-between text-xs font-black uppercase tracking-wider",
        isPsico ? "bg-purple-100 text-purple-900 border border-purple-300" : "bg-sky-100 text-sky-900 border border-sky-300"
      )}>
        <div className="flex items-center gap-2">
          <span className="text-base">{isPsico ? "🧠" : "🏥"}</span>
          <span>{isPsico ? "DEPÓSITO 2: MEDICAMENTOS PSICOTRÓPICOS & CONTROLADOS (PORTARIA 344/98)" : "DEPÓSITO 1: MEDICAMENTOS CLÍNICOS E GERAIS (ESTOQUE CENTRAL)"}</span>
        </div>
        <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded shadow-xs border">
          {itens.length} {itens.length === 1 ? "item" : "itens"}
        </span>
      </div>

      {isPsico && (
        <div className="mb-4 p-2 bg-amber-50 border-l-4 border-amber-500 rounded text-[11px] text-amber-950 font-medium">
          ⚠️ <strong>AVISO LEGAL - PORTARIA SVS/MS 344/98:</strong> Medicamentos sujeitos a controle especial. Separação restrita ao cofre/depósito de controlados. Conferência obrigatória de lote, validade e visto farmacêutico com CRF.
        </div>
      )}

      {/* Cabeçalho */}
      <div className="border-b-2 border-slate-900 pb-3 mb-4 flex justify-between items-start gap-4">
        <div>
          <h1 className="text-lg font-black uppercase text-slate-950 tracking-tight leading-tight">
            ZORION SAÚDE — FARMÁCIA HOSPITALAR
          </h1>
          <h2 className={cn(
            "text-xs font-bold uppercase mt-0.5",
            isPsico ? "text-purple-800" : "text-blue-800"
          )}>
            REQUISIÇÃO DE MEDICAMENTOS • {isPsico ? "SEPARAÇÃO DEPÓSITO PSICOTRÓPICOS" : "SEPARAÇÃO DEPÓSITO CLÍNICO"}
          </h2>
          <p className="text-xs text-slate-700 mt-1">
            Origem: <strong className="text-slate-950">Farmácia Satélite</strong> • Setor/Ala: <strong className="text-slate-950">{data.alaNome}</strong>
          </p>
          <p className="text-xs text-slate-600 font-mono mt-0.5">
            Código: <strong className="text-slate-950">{data.codigo}</strong> • Status: <strong className="text-slate-950">{data.status}</strong>
          </p>
        </div>
        <div className="text-right text-xs text-slate-700 font-mono space-y-0.5 shrink-0">
          <p>Emissão: <strong className="text-slate-950">{formattedDate}</strong></p>
          <p>
            Prioridade:{" "}
            <span className={`font-black uppercase px-1.5 py-0.5 rounded text-[10px] ${
              data.prioridade === "Emergência" 
                ? "bg-red-100 text-red-900 border border-red-300" 
                : data.prioridade === "Urgente" 
                  ? "bg-amber-100 text-amber-900 border border-amber-300" 
                  : "bg-slate-100 text-slate-900 border"
            }`}>
              {data.prioridade}
            </span>
          </p>
          <p>Suprimento: <strong className="text-slate-950">{data.dias} dia(s)</strong></p>
          {data.margem > 0 && (
            <p>Margem Reserva: <strong className="text-slate-950">+{data.margem}%</strong></p>
          )}
          {data.descontarEstoque && (
            <p>Abatido Est. Satélite: <strong className="text-slate-950">Sim</strong></p>
          )}
        </div>
      </div>

      {data.observacao && (
        <div className="mb-3 p-2 bg-slate-50 border border-slate-300 rounded text-xs text-slate-800">
          <strong className="text-slate-950">Observações da Requisição:</strong> {data.observacao}
        </div>
      )}

      {/* Tabela de Itens */}
      <table className="w-full text-xs border-collapse border border-slate-400 mb-4">
        <thead>
          <tr className={cn(
            "text-slate-900 font-bold border-b-2 border-slate-400",
            isPsico ? "bg-purple-50/80" : "bg-slate-100"
          )}>
            <th className="border border-slate-300 p-1.5 text-center w-7">#</th>
            <th className="border border-slate-300 p-1.5 text-center w-12">Cód.</th>
            <th className="border border-slate-300 p-1.5 text-left">
              {isPsico ? "Medicamento Psicotrópico / Controlado" : "Medicamento Clínico / Concentração"}
            </th>
            {isPsico && (
              <th className="border border-slate-300 p-1.5 text-center w-24">Portaria 344</th>
            )}
            <th className="border border-slate-300 p-1.5 text-center w-20 font-bold text-slate-900">
              Qtd Solicitada
            </th>
            <th className="border border-slate-300 p-1.5 text-center w-20 font-bold text-blue-900 bg-blue-100/70">
              Qtd Enviada
            </th>
            <th className="border border-slate-300 p-1.5 text-left w-60 font-bold text-slate-900 bg-amber-50/70">
              Lote(s) & Validade (Central)
            </th>
            <th className="border border-slate-300 p-1.5 text-center w-14">
              Visto
            </th>
          </tr>
        </thead>
        <tbody>
          {itens.map((item, idx) => (
            <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/70"}>
              <td className="border border-slate-300 p-1 text-center font-mono text-slate-700">{idx + 1}</td>
              <td className="border border-slate-300 p-1 text-center font-mono text-slate-700">{item.codigo || "-"}</td>
              <td className="border border-slate-300 p-1 font-medium break-words [overflow-wrap:anywhere]">
                <span className="font-bold text-slate-950">{item.nome}</span>
                {item.concentracao && <span className="text-slate-700"> ({item.concentracao})</span>}
                {item.apresentacao && <span className="text-slate-500 text-[10px] block">[{item.apresentacao}]</span>}
              </td>
              {isPsico && (
                <td className="border border-slate-300 p-1 text-center font-mono text-[10px] text-purple-900 font-bold bg-purple-50/40">
                  {item.portariaList || "Portaria 344"}
                </td>
              )}
              <td className="border border-slate-300 p-1 text-center font-mono font-bold text-xs text-slate-900">
                {item.qtdSolicitada} un
              </td>
              <td className="border border-slate-300 p-1 text-center font-mono font-black text-xs text-blue-900 bg-blue-50/50">
                {item.qtdEnviada !== undefined ? item.qtdEnviada : item.qtdSolicitada} un
              </td>
              <td className="border border-slate-300 p-1 text-left font-mono text-[10px] text-slate-900 font-semibold bg-amber-50/30 leading-tight">
                {item.loteDesc || <span className="text-slate-400 italic text-[9px]">Aguardando alocação Central</span>}
              </td>
              <td className="border border-slate-300 p-1 text-center font-mono text-slate-400 text-[10px]">
                [     ]
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className={cn(
            "font-bold border-t-2 border-slate-400 text-slate-950",
            isPsico ? "bg-purple-50/80" : "bg-slate-100"
          )}>
            <td colSpan={isPsico ? 4 : 3} className="border border-slate-300 p-2 text-right uppercase text-[11px]">
              Totais ({itens.length} {itens.length === 1 ? "item" : "itens"}):
            </td>
            <td className="border border-slate-300 p-2 text-center font-mono text-xs font-bold text-slate-900">
              {totalSolicitado} un
            </td>
            <td className="border border-slate-300 p-2 text-center font-mono text-xs font-black text-blue-900 bg-blue-100/70">
              {totalEnviado} un
            </td>
            <td className="border border-slate-300 p-2 font-mono text-[10px] text-slate-500"></td>
            <td className="border border-slate-300 p-2"></td>
          </tr>
        </tfoot>
      </table>

      {/* Assinaturas */}
      <div className={cn(
        "signature-area mt-8 pt-4 border-t border-slate-300 grid text-center text-xs",
        isPsico ? "grid-cols-3 gap-4" : "grid-cols-2 gap-8"
      )}>
        <div>
          <div className="border-b border-slate-400 w-44 sm:w-52 mx-auto mb-1"></div>
          <p className="font-bold text-slate-900">Solicitante (Satélite)</p>
          <p className="text-[10px] text-slate-500">Assinatura / Data</p>
        </div>
        {isPsico && (
          <div>
            <div className="border-b border-slate-400 w-44 sm:w-52 mx-auto mb-1"></div>
            <p className="font-bold text-purple-950">Farmacêutico(a) Resp.</p>
            <p className="text-[10px] text-purple-700">Carimbo e CRF</p>
          </div>
        )}
        <div>
          <div className="border-b border-slate-400 w-44 sm:w-52 mx-auto mb-1"></div>
          <p className="font-bold text-slate-900">
            {isPsico ? "Separado por (Dep. Psicotrópicos)" : "Separado por (Dep. Clínico)"}
          </p>
          <p className="text-[10px] text-slate-500">Assinatura / Data</p>
        </div>
      </div>
    </div>
  );
}

// ─── FOLHA FORMAL A4 DE REQUISIÇÃO (USADA NO PREVIEW E NA IMPRESSÃO) ────────
function PrintOrderSheetContent({ data, selectedDepot = "todos", isPrintPortal = false }) {
  if (!data) return null;

  let formattedDate = "--";
  try {
    if (data.dataSolicitacao) {
      const d = new Date(data.dataSolicitacao);
      if (!isNaN(d.getTime())) {
        formattedDate = format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      }
    }
  } catch {}

  const itens = data.itens || [];
  const clinicos = itens.filter(i => !i.isPsicotropico);
  const psicotropicos = itens.filter(i => i.isPsicotropico);

  const showClinicos = (selectedDepot === "todos" || selectedDepot === "clinico") && clinicos.length > 0;
  const showPsicotropicos = (selectedDepot === "todos" || selectedDepot === "psicotropico") && psicotropicos.length > 0;

  // Se o usuário filtrou por um depósito específico que não tem itens no pedido:
  if (selectedDepot === "clinico" && clinicos.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-lg border border-slate-200 text-slate-600">
        <p className="text-base font-bold text-slate-800">Nenhum medicamento clínico neste pedido.</p>
        <p className="text-xs text-slate-500 mt-1">Este pedido contém exclusivamente medicamentos psicotrópicos / controlados.</p>
      </div>
    );
  }

  if (selectedDepot === "psicotropico" && psicotropicos.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-lg border border-slate-200 text-slate-600">
        <p className="text-base font-bold text-slate-800">Nenhum medicamento psicotrópico neste pedido.</p>
        <p className="text-xs text-slate-500 mt-1">Este pedido contém exclusivamente medicamentos clínicos comuns.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Folha 1: Depósito Clínico */}
      {showClinicos && (
        <div className="sheet-wrapper mb-6">
          <SingleDepotSheet 
            data={data}
            tipo="clinico"
            itens={clinicos}
            formattedDate={formattedDate}
          />
        </div>
      )}

      {/* Quebra de Página se ambos estiverem visíveis */}
      {showClinicos && showPsicotropicos && (
        <>
          {/* Quebra física de página para a impressora */}
          <div className="page-break" style={{ pageBreakBefore: "always", breakBefore: "page" }} />
          {/* Divisor visual na tela (somente preview) */}
          {!isPrintPortal && (
            <div className="py-4 my-6 flex items-center justify-center gap-3 text-xs font-bold text-purple-700 uppercase tracking-widest border-y-2 border-dashed border-purple-300 bg-purple-50/60 rounded-lg">
              <span>✂️ QUEBRA DE PÁGINA (FOLHA 2 — SEPARAÇÃO NO DEPÓSITO DE PSICOTRÓPICOS)</span>
            </div>
          )}
        </>
      )}

      {/* Folha 2: Depósito Psicotrópicos */}
      {showPsicotropicos && (
        <div className="sheet-wrapper mb-6">
          <SingleDepotSheet 
            data={data}
            tipo="psicotropico"
            itens={psicotropicos}
            formattedDate={formattedDate}
          />
        </div>
      )}
    </div>
  );
}

// ─── SUBCOMPONENTE MODAL DE DETALHES & CONFERÊNCIA ───────────────────────────
export function OrderDetailsModal({ open, onOpenChange, pedido, mode, onUpdateStatus, isPending, onPrint, onDelete, isAdm, lotes = [] }) {
  const [itensState, setItensState] = useState(() => {
    let rawItens = pedido.itens || pedido.itens_json || [];
    if (typeof rawItens === "string") {
      try { rawItens = JSON.parse(rawItens); } catch {}
    }
    const arr = Array.isArray(rawItens) ? rawItens : [];
    return arr.map(i => {
      const medId = i.medicamento_id || i.id;
      const medLotes = (lotes || [])
        .filter(l => (l.medicamento_id === medId || l.medicamentoId === medId) && (Number(l.quantidade_atual) || 0) > 0 && l.status !== "Inativo")
        .sort((a, b) => new Date(a.data_validade) - new Date(b.data_validade));
      const fefoLote = medLotes[0];

      const initialQtdAtendida = Number(i.qtd_atendida !== undefined ? i.qtd_atendida : i.qtd_solicitada) || 0;

      let alocacoes = [];
      if (Array.isArray(i.alocacoes_lote) && i.alocacoes_lote.length > 0) {
        alocacoes = i.alocacoes_lote.map((al, alIdx) => {
          const lObj = medLotes.find(l => l.id === al.lote_id);
          return {
            id: al.id || `aloc-${medId}-${alIdx}-${Date.now()}`,
            lote_id: al.lote_id || "",
            numero_lote: al.numero_lote || lObj?.numero_lote || "",
            data_validade: al.data_validade || lObj?.data_validade || "",
            quantidade: Number(al.quantidade) || 0,
            saldo_lote: lObj ? Number(lObj.quantidade_atual) || 0 : 0
          };
        });
      } else {
        // Inicialização com distribuição inteligente FEFO
        if (medLotes.length === 0) {
          alocacoes = [{
            id: `aloc-${medId}-sem-lote`,
            lote_id: "",
            numero_lote: i.numero_lote || "S/ Lote",
            data_validade: i.data_validade || "",
            quantidade: initialQtdAtendida,
            saldo_lote: 0
          }];
        } else {
          let restante = initialQtdAtendida;
          for (let lIdx = 0; lIdx < medLotes.length; lIdx++) {
            const l = medLotes[lIdx];
            const saldo = Number(l.quantidade_atual) || 0;
            if (saldo <= 0) continue;

            const qtdDeste = Math.min(saldo, restante);
            alocacoes.push({
              id: `aloc-${medId}-${l.id}-${lIdx}`,
              lote_id: l.id,
              numero_lote: l.numero_lote,
              data_validade: l.data_validade,
              quantidade: qtdDeste,
              saldo_lote: saldo
            });
            restante -= qtdDeste;
            if (restante <= 0) break;
          }

          if (restante > 0) {
            if (alocacoes.length > 0) {
              alocacoes[alocacoes.length - 1].quantidade += restante;
            } else {
              alocacoes.push({
                id: `aloc-${medId}-${medLotes[0].id}-0`,
                lote_id: medLotes[0].id,
                numero_lote: medLotes[0].numero_lote,
                data_validade: medLotes[0].data_validade,
                quantidade: initialQtdAtendida,
                saldo_lote: Number(medLotes[0].quantidade_atual) || 0
              });
            }
          }
        }
      }

      const initialLoteId = alocacoes[0]?.lote_id || i.lote_id || fefoLote?.id || "";
      const matchedLote = medLotes.find(l => l.id === initialLoteId) || fefoLote;

      return {
        ...i,
        qtd_atendida: initialQtdAtendida,
        qtd_recebida: i.qtd_recebida !== undefined ? i.qtd_recebida : initialQtdAtendida,
        lote_id: initialLoteId,
        numero_lote: alocacoes.length > 1
          ? alocacoes.map(a => `${a.numero_lote || 'S/ Lote'} (${a.quantidade} un)`).join(", ")
          : (alocacoes[0]?.numero_lote || i.numero_lote || matchedLote?.numero_lote || ""),
        data_validade: alocacoes[0]?.data_validade || i.data_validade || matchedLote?.data_validade || "",
        alocacoes_lote: alocacoes,
        fefo_lote_id: fefoLote?.id || "",
        fefo_numero_lote: fefoLote?.numero_lote || "",
        motivo_troca_lote: i.motivo_troca_lote || ""
      };
    });
  });

  const [filterDepot, setFilterDepot] = useState("todos"); // "todos" | "clinico" | "psicotropico"

  const itensWithDepot = useMemo(() => {
    return itensState.map((item, originalIndex) => {
      const isPsico = item.is_psicotropico !== undefined
        ? Boolean(item.is_psicotropico)
        : (item.isPsicotropico !== undefined
            ? Boolean(item.isPsicotropico)
            : isPsicotropico(item.medicamento_nome || item.nome || item));

      return {
        ...item,
        originalIndex,
        isPsicotropico: isPsico,
        portariaList: item.portaria_344 || (isPsico ? getPortaria344List(item.medicamento_nome || item.nome || item) : null)
      };
    });
  }, [itensState]);

  const countClinicos = useMemo(() => itensWithDepot.filter(i => !i.isPsicotropico).length, [itensWithDepot]);
  const countPsicotropicos = useMemo(() => itensWithDepot.filter(i => i.isPsicotropico).length, [itensWithDepot]);

  const displayedItens = useMemo(() => {
    if (filterDepot === "clinico") return itensWithDepot.filter(i => !i.isPsicotropico);
    if (filterDepot === "psicotropico") return itensWithDepot.filter(i => i.isPsicotropico);
    return itensWithDepot;
  }, [itensWithDepot, filterDepot]);

  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [motivoPreset, setMotivoPreset] = useState("Medicamento em falta / Desabastecimento na Central");
  const [motivoCustom, setMotivoCustom] = useState("");

  const handleToggleCheck = (index, field) => {
    const next = [...itensState];
    next[index][field] = !next[index][field];
    setItensState(next);
  };

  const handleUpdateAlocacao = (itemIndex, alocId, field, value) => {
    const next = [...itensState];
    const item = next[itemIndex];
    if (!item.alocacoes_lote) item.alocacoes_lote = [];
    
    const medId = item.medicamento_id || item.id;
    const medLotes = (lotes || []).filter(l => (l.medicamento_id === medId || l.medicamentoId === medId));

    item.alocacoes_lote = item.alocacoes_lote.map(a => {
      if (a.id !== alocId) return a;
      if (field === "lote_id") {
        const selectedLote = medLotes.find(l => l.id === value);
        return {
          ...a,
          lote_id: value,
          numero_lote: selectedLote?.numero_lote || "",
          data_validade: selectedLote?.data_validade || "",
          saldo_lote: selectedLote ? Number(selectedLote.quantidade_atual) || 0 : 0
        };
      }
      if (field === "quantidade") {
        const num = parseInt(value, 10);
        return {
          ...a,
          quantidade: isNaN(num) ? 0 : Math.max(0, num)
        };
      }
      return { ...a, [field]: value };
    });

    const novaSoma = item.alocacoes_lote.reduce((s, a) => s + (Number(a.quantidade) || 0), 0);
    item.qtd_atendida = novaSoma;
    if (item.qtd_recebida === undefined || mode === "central") {
      item.qtd_recebida = novaSoma;
    }

    if (item.alocacoes_lote.length > 0) {
      item.lote_id = item.alocacoes_lote[0].lote_id;
      item.data_validade = item.alocacoes_lote[0].data_validade;
      item.numero_lote = item.alocacoes_lote.length > 1
        ? item.alocacoes_lote.map(a => `${a.numero_lote || 'S/ Lote'} (${a.quantidade} un)`).join(", ")
        : (item.alocacoes_lote[0].numero_lote || "S/ Lote");
    }

    setItensState(next);
  };

  const handleAdicionarLoteSplit = (itemIndex) => {
    const next = [...itensState];
    const item = next[itemIndex];
    if (!item.alocacoes_lote) item.alocacoes_lote = [];

    const medId = item.medicamento_id || item.id;
    const medLotes = (lotes || [])
      .filter(l => (l.medicamento_id === medId || l.medicamentoId === medId) && (Number(l.quantidade_atual) || 0) > 0 && l.status !== "Inativo")
      .sort((a, b) => new Date(a.data_validade) - new Date(b.data_validade));

    const lotesJaUsados = item.alocacoes_lote.map(a => a.lote_id);
    const proximoLote = medLotes.find(l => !lotesJaUsados.includes(l.id)) || medLotes[0];

    const somaAtual = item.alocacoes_lote.reduce((s, a) => s + (Number(a.quantidade) || 0), 0);
    const restanteSolicitado = Math.max(0, (Number(item.qtd_solicitada) || 0) - somaAtual);
    const saldoProximo = proximoLote ? Number(proximoLote.quantidade_atual) || 0 : 0;
    const qtdInicial = saldoProximo > 0 && restanteSolicitado > 0 ? Math.min(saldoProximo, restanteSolicitado) : restanteSolicitado;

    const novaAloc = {
      id: `aloc-${medId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      lote_id: proximoLote ? proximoLote.id : "",
      numero_lote: proximoLote?.numero_lote || "",
      data_validade: proximoLote?.data_validade || "",
      quantidade: qtdInicial,
      saldo_lote: saldoProximo
    };

    item.alocacoes_lote.push(novaAloc);

    const novaSoma = item.alocacoes_lote.reduce((s, a) => s + (Number(a.quantidade) || 0), 0);
    item.qtd_atendida = novaSoma;
    if (item.qtd_recebida === undefined || mode === "central") {
      item.qtd_recebida = novaSoma;
    }
    item.numero_lote = item.alocacoes_lote.map(a => `${a.numero_lote || 'S/ Lote'} (${a.quantidade} un)`).join(", ");

    setItensState(next);
    toast.info("Novo lote adicionado. Ajuste a quantidade a retirar de cada lote.");
  };

  const handleRemoverLoteSplit = (itemIndex, alocId) => {
    const next = [...itensState];
    const item = next[itemIndex];
    if (!item.alocacoes_lote || item.alocacoes_lote.length <= 1) return;

    item.alocacoes_lote = item.alocacoes_lote.filter(a => a.id !== alocId);

    const novaSoma = item.alocacoes_lote.reduce((s, a) => s + (Number(a.quantidade) || 0), 0);
    item.qtd_atendida = novaSoma;
    if (item.qtd_recebida === undefined || mode === "central") {
      item.qtd_recebida = novaSoma;
    }
    if (item.alocacoes_lote.length > 0) {
      item.lote_id = item.alocacoes_lote[0].lote_id;
      item.data_validade = item.alocacoes_lote[0].data_validade;
      item.numero_lote = item.alocacoes_lote.length > 1
        ? item.alocacoes_lote.map(a => `${a.numero_lote || 'S/ Lote'} (${a.quantidade} un)`).join(", ")
        : (item.alocacoes_lote[0].numero_lote || "S/ Lote");
    }

    setItensState(next);
  };

  const handleAutoDistribuirFefo = (itemIndex) => {
    const next = [...itensState];
    const item = next[itemIndex];
    const medId = item.medicamento_id || item.id;
    const medLotes = (lotes || [])
      .filter(l => (l.medicamento_id === medId || l.medicamentoId === medId) && (Number(l.quantidade_atual) || 0) > 0 && l.status !== "Inativo")
      .sort((a, b) => new Date(a.data_validade) - new Date(b.data_validade));

    const totalAlvo = Number(item.qtd_solicitada) || 0;
    let restante = totalAlvo;
    const novasAlocacoes = [];

    if (medLotes.length === 0) {
      novasAlocacoes.push({
        id: `aloc-${medId}-sem-lote`,
        lote_id: "",
        numero_lote: item.numero_lote || "S/ Lote",
        data_validade: item.data_validade || "",
        quantidade: totalAlvo,
        saldo_lote: 0
      });
    } else {
      for (let i = 0; i < medLotes.length; i++) {
        const l = medLotes[i];
        const saldo = Number(l.quantidade_atual) || 0;
        if (saldo <= 0) continue;

        const qtdDeste = Math.min(saldo, restante);
        novasAlocacoes.push({
          id: `aloc-${medId}-${l.id}-${i}`,
          lote_id: l.id,
          numero_lote: l.numero_lote,
          data_validade: l.data_validade,
          quantidade: qtdDeste,
          saldo_lote: saldo
        });
        restante -= qtdDeste;
        if (restante <= 0) break;
      }

      if (restante > 0) {
        if (novasAlocacoes.length > 0) {
          novasAlocacoes[novasAlocacoes.length - 1].quantidade += restante;
        } else {
          novasAlocacoes.push({
            id: `aloc-${medId}-${medLotes[0].id}-0`,
            lote_id: medLotes[0].id,
            numero_lote: medLotes[0].numero_lote,
            data_validade: medLotes[0].data_validade,
            quantidade: totalAlvo,
            saldo_lote: Number(medLotes[0].quantidade_atual) || 0
          });
        }
      }
    }

    item.alocacoes_lote = novasAlocacoes;
    const soma = novasAlocacoes.reduce((s, a) => s + (Number(a.quantidade) || 0), 0);
    item.qtd_atendida = soma;
    if (item.qtd_recebida === undefined || mode === "central") {
      item.qtd_recebida = soma;
    }
    if (novasAlocacoes.length > 0) {
      item.lote_id = novasAlocacoes[0].lote_id;
      item.data_validade = novasAlocacoes[0].data_validade;
      item.numero_lote = novasAlocacoes.length > 1
        ? novasAlocacoes.map(a => `${a.numero_lote || 'S/ Lote'} (${a.quantidade} un)`).join(", ")
        : (novasAlocacoes[0].numero_lote || "S/ Lote");
    }

    setItensState(next);
    toast.success("Lotes distribuídos por FEFO automaticamente!");
  };

  const handleMotivoTrocaLoteChange = (index, val) => {
    const next = [...itensState];
    next[index].motivo_troca_lote = val;
    setItensState(next);
  };

  const handleQtdAtendidaChange = (index, val) => {
    const next = [...itensState];
    const num = parseInt(val, 10);
    const valNum = isNaN(num) ? 0 : Math.max(0, num);
    const item = next[index];
    item.qtd_atendida = valNum;
    if (item.qtd_recebida === undefined || mode === "central") {
      item.qtd_recebida = valNum;
    }
    if (item.alocacoes_lote && item.alocacoes_lote.length === 1) {
      item.alocacoes_lote[0].quantidade = valNum;
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
    const targetIndices = new Set(displayedItens.map(i => i.originalIndex));
    const allChecked = displayedItens.every(i => i[field]);
    const next = itensState.map((i, idx) => {
      if (targetIndices.has(idx)) {
        return { ...i, [field]: !allChecked };
      }
      return i;
    });
    setItensState(next);
  };

  const allSeparated = displayedItens.every(i => i.separado);
  const allConferido = displayedItens.every(i => i.conferido);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col overflow-hidden print:!hidden print:hidden">
        <DialogHeader className="border-b pb-3">
          <div className="flex justify-between items-center pr-6">
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-indigo-600" />
                Pedido {pedido.codigo} — {pedido.ala_nome}
              </DialogTitle>
              <DialogDescription className="text-xs flex flex-wrap items-center gap-2 mt-1">
                <span>Solicitado em {pedido.data_solicitacao ? format(new Date(pedido.data_solicitacao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "-"} para {pedido.dias_calculados} dia(s).</span>
                {pedido.margem_seguranca > 0 && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 font-bold py-0.5">
                    +{pedido.margem_seguranca}% Margem de Segurança
                  </Badge>
                )}
                {pedido.descontar_estoque === 1 && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-300 font-semibold py-0.5">
                    Estoque Satélite Abatido
                  </Badge>
                )}
                {pedido.observacao && (
                  <span className="text-slate-500 font-medium ml-1">Obs: {pedido.observacao}</span>
                )}
              </DialogDescription>
            </div>
            <Badge variant="outline" className={`text-sm font-bold ${pedido.status === 'Cancelado' ? 'border-red-400 bg-red-50 text-red-700' : ''}`}>
              Status: {pedido.status}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Banner de Pedido Cancelado */}
          {pedido.status === "Cancelado" && (
            <div className="bg-red-50 border border-red-200 p-3.5 rounded-xl text-xs text-red-900 flex items-start gap-2.5 shadow-sm">
              <Ban className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-sm text-red-800">Pedido Cancelado</p>
                <p className="text-red-700">
                  <strong>Motivo:</strong> {pedido.motivo_cancelamento || "Cancelado pelo Estoque Central."}
                </p>
                {pedido.data_cancelamento && (
                  <p className="text-[11px] text-red-500">
                    Cancelado em {format(new Date(pedido.data_cancelamento), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Seletor de Depósito para Separação */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Depósito para Separação:</span>
              <button
                type="button"
                onClick={() => setFilterDepot("todos")}
                className={cn(
                  "px-2.5 py-1 rounded text-xs font-bold transition-all",
                  filterDepot === "todos" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs" : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border hover:bg-slate-100"
                )}
              >
                Todos ({itensState.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterDepot("clinico")}
                className={cn(
                  "px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1",
                  filterDepot === "clinico" ? "bg-sky-600 text-white shadow-xs" : "bg-white dark:bg-slate-800 text-sky-700 dark:text-sky-300 border border-sky-200 hover:bg-sky-50"
                )}
              >
                🏥 Clínico ({countClinicos})
              </button>
              <button
                type="button"
                onClick={() => setFilterDepot("psicotropico")}
                className={cn(
                  "px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1",
                  filterDepot === "psicotropico" ? "bg-purple-700 text-white shadow-xs" : "bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 border border-purple-200 hover:bg-purple-50"
                )}
              >
                🧠 Psicotrópicos ({countPsicotropicos})
              </button>
            </div>
            <span className="text-[11px] text-slate-500">
              Exibindo <strong>{displayedItens.length}</strong> de {itensState.length} itens
            </span>
          </div>

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
                <TableHead className="text-center min-w-[210px]">Lote / Validade (FEFO)</TableHead>
                <TableHead className="text-center">Qtd Solicitada</TableHead>
                <TableHead className="text-center bg-indigo-50/60 font-bold text-indigo-900">Qtd Enviada (Central)</TableHead>
                {(pedido.status === "Separado" || pedido.status === "Entregue" || pedido.status === "Concluido") && (
                  <TableHead className="text-center bg-emerald-50/80 font-bold text-emerald-900">Qtd Recebida (Satélite)</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedItens.map((item) => {
                const idx = item.originalIndex;
                return (
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

                    <TableCell className="max-w-[280px] min-w-[170px] break-words whitespace-normal [overflow-wrap:anywhere] [word-break:break-word]">
                      <div className="flex items-center flex-wrap gap-1">
                        <span className="font-bold text-slate-900 break-words whitespace-normal [overflow-wrap:anywhere] [word-break:break-word] leading-snug">{item.medicamento_nome}</span>
                        {item.isPsicotropico ? (
                          <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-800 border-purple-300 font-bold inline-flex items-center gap-0.5">
                            🧠 Depósito Psicotrópico
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-800 border-sky-300 font-medium inline-flex items-center gap-0.5">
                            🏥 Depósito Clínico
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 break-words whitespace-normal">{item.concentracao} {item.apresentacao ? `(${item.apresentacao})` : ""}</p>
                      {item.qtd_prescrita !== undefined && (
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Prescrição: <span className="font-semibold">{item.qtd_prescrita} un</span>
                          {item.margem_percentual > 0 && (
                            <span className="text-emerald-600 font-bold ml-1">
                              (+{item.margem_percentual}% margem: +{item.qtd_margem_extra || Math.ceil(item.qtd_prescrita * (item.margem_percentual / 100))} un)
                            </span>
                          )}
                          {item.descontou_estoque === 1 && (
                            <span className="text-blue-600 font-medium ml-1">
                              (-{item.estoque_satelite_momento || 0} em estoque)
                            </span>
                          )}
                        </p>
                      )}
                    </TableCell>

                    {/* COLUNA LOTE / VALIDADE (FEFO) */}
                    <TableCell className="min-w-[280px] text-xs">
                      {mode === "central" && (pedido.status === "Pendente" || pedido.status === "Em Separação") ? (
                        (() => {
                          const medId = item.medicamento_id || item.id;
                          const medLotes = (lotes || [])
                            .filter(l => (l.medicamento_id === medId || l.medicamentoId === medId) && (Number(l.quantidade_atual) || 0) > 0 && l.status !== "Inativo")
                            .sort((a, b) => new Date(a.data_validade) - new Date(b.data_validade));
                          
                          const alocacoes = item.alocacoes_lote || [];
                          const somaAlocada = alocacoes.reduce((s, a) => s + (Number(a.quantidade) || 0), 0);

                          if (medLotes.length === 0) {
                            return (
                              <div className="space-y-1">
                                <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-block font-semibold">
                                  Sem lote em estoque Central
                                </span>
                                {item.numero_lote && (
                                  <p className="text-[10px] text-slate-500 font-mono">Ref: {item.numero_lote}</p>
                                )}
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-2">
                              {/* Lista de Alocações de Lotes */}
                              <div className="space-y-1.5">
                                {alocacoes.map((aloc, aIdx) => {
                                  const loteObj = medLotes.find(l => l.id === aloc.lote_id);
                                  const saldoLote = loteObj ? Number(loteObj.quantidade_atual) || 0 : 0;
                                  const isExcedente = Number(aloc.quantidade) > saldoLote;

                                  return (
                                    <div key={aloc.id || aIdx} className="p-1.5 rounded bg-slate-50 border border-slate-200 space-y-1">
                                      <div className="flex items-center gap-1.5">
                                        <div className="flex-1">
                                          <Select
                                            value={aloc.lote_id}
                                            onValueChange={(val) => handleUpdateAlocacao(idx, aloc.id, "lote_id", val)}
                                          >
                                            <SelectTrigger className="h-7 text-xs font-mono font-medium bg-white border-slate-300">
                                              <SelectValue placeholder="Selecione o Lote" />
                                            </SelectTrigger>
                                            <SelectContent>
                                              {medLotes.map((l, lIdx) => (
                                                <SelectItem key={l.id} value={l.id} className="text-xs font-mono">
                                                  {l.numero_lote} (Val: {l.data_validade ? format(new Date(l.data_validade), "dd/MM/yy") : "-"}) — Saldo: {l.quantidade_atual} un
                                                  {lIdx === 0 ? " 🌟 [FEFO]" : ""}
                                                </SelectItem>
                                              ))}
                                            </SelectContent>
                                          </Select>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                          <Input
                                            type="number"
                                            min="0"
                                            value={aloc.quantidade}
                                            onChange={(e) => handleUpdateAlocacao(idx, aloc.id, "quantidade", e.target.value)}
                                            className={cn(
                                              "w-16 h-7 text-center font-mono font-bold text-xs bg-white border-slate-300",
                                              isExcedente && "border-red-500 text-red-600 bg-red-50"
                                            )}
                                            title="Quantidade a entregar deste lote"
                                          />
                                          <span className="text-[10px] text-slate-500 font-bold">un</span>
                                        </div>

                                        {alocacoes.length > 1 && (
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => handleRemoverLoteSplit(idx, aloc.id)}
                                            className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0"
                                            title="Remover este lote dividido"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </Button>
                                        )}
                                      </div>

                                      {/* Sub-linha de Informação do Lote */}
                                      <div className="flex items-center justify-between text-[10px] text-slate-500 px-0.5">
                                        <span>
                                          Saldo Central: <strong className={isExcedente ? "text-red-600" : "text-slate-800"}>{saldoLote} un</strong>
                                          {loteObj?.data_validade && ` • Val: ${format(new Date(loteObj.data_validade), "dd/MM/yy")}`}
                                        </span>
                                        {isExcedente && (
                                          <span className="text-red-600 font-bold">⚠️ Excede saldo!</span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>

                              {/* Barra de Ações Multi-Lote e Balanço */}
                              <div className="flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-slate-100">
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleAdicionarLoteSplit(idx)}
                                    className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 cursor-pointer bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 transition-colors"
                                    title="Dividir e entregar quantidade de múltiplos lotes"
                                  >
                                    <Plus className="w-3 h-3 text-indigo-600" />
                                    + Dividir em outro Lote
                                  </button>

                                  {medLotes.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleAutoDistribuirFefo(idx)}
                                      className="text-[10px] font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-0.5 cursor-pointer bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded border border-slate-200 transition-colors"
                                      title="Auto-distribuir pelos lotes mais próximos do vencimento (FEFO)"
                                    >
                                      <Wand2 className="w-2.5 h-2.5 text-amber-500" />
                                      Auto FEFO
                                    </button>
                                  )}
                                </div>

                                <div className="text-[10px] font-mono">
                                  {somaAlocada === Number(item.qtd_solicitada) ? (
                                    <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-bold flex items-center gap-1">
                                      <Check className="w-3 h-3 text-emerald-600 inline" />
                                      Total: {somaAlocada} un
                                    </span>
                                  ) : somaAlocada < Number(item.qtd_solicitada) ? (
                                    <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-bold">
                                      Total: {somaAlocada} un (Faltam {Number(item.qtd_solicitada) - somaAlocada})
                                    </span>
                                  ) : (
                                    <span className="text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 font-bold">
                                      Total: {somaAlocada} un (+{somaAlocada - Number(item.qtd_solicitada)})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="space-y-1 font-mono">
                          {item.alocacoes_lote && item.alocacoes_lote.length > 1 ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-700">
                                <Boxes className="w-3.5 h-3.5 text-indigo-600" />
                                <span>{item.alocacoes_lote.length} lotes atendidos:</span>
                              </div>
                              <div className="flex flex-col gap-1">
                                {item.alocacoes_lote.map((aloc, aIdx) => (
                                  <div key={aIdx} className="bg-indigo-50/80 border border-indigo-200 rounded px-1.5 py-0.5 text-[11px] flex items-center justify-between gap-1">
                                    <span className="font-bold text-indigo-950 font-mono">Lote: {aloc.numero_lote || "S/ Lote"}</span>
                                    <span className="text-slate-600 text-[10px]">{aloc.data_validade ? `Val: ${format(new Date(aloc.data_validade), "dd/MM/yy")}` : ""}</span>
                                    <Badge className="bg-indigo-600 text-white font-mono text-[10px] px-1 py-0 h-4">{aloc.quantidade} un</Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <Badge variant="outline" className="bg-indigo-50 text-indigo-900 border-indigo-300 font-bold text-[11px] py-0.5">
                                📦 Lote: {item.numero_lote || item.lote_previsto || "S/ Lote"}
                              </Badge>
                              {item.data_validade && (
                                <span className="text-[11px] text-slate-600">
                                  Val: {format(new Date(item.data_validade), "dd/MM/yyyy")}
                                </span>
                              )}
                            </div>
                          )}
                          {item.motivo_troca_lote && (
                            <div className="text-[10px] text-amber-800 bg-amber-50 p-1 rounded border border-amber-200 leading-tight">
                              <strong>⚠️ Troca:</strong> {item.motivo_troca_lote}
                            </div>
                          )}
                        </div>
                      )}
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
              );
            })}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="border-t pt-3 flex flex-wrap justify-between items-center w-full gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>

            {/* BOTAO CANCELAR / REVERTER PEDIDO */}
            {pedido.status !== "Cancelado" && (
              <Button
                variant="outline"
                onClick={() => setIsCancelDialogOpen(true)}
                disabled={isPending}
                className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold gap-1.5 cursor-pointer"
                title={pedido.status === "Concluido" ? "Reverter recebimento e estornar o estoque" : "Cancelar pedido"}
              >
                {pedido.status === "Concluido" ? (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    Reverter & Cancelar
                  </>
                ) : (
                  <>
                    <Ban className="w-4 h-4" />
                    Cancelar Pedido
                  </>
                )}
              </Button>
            )}

            {/* BOTAO EXCLUIR PEDIDO - APENAS ADMINISTRADOR */}
            {isAdm && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  onOpenChange(false);
                  if (onDelete) onDelete(pedido);
                }}
                disabled={isPending}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold gap-1.5 text-xs shadow-xs"
                title="Excluir este pedido do histórico e zerar notificações (Restrito ao Administrador)"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir Pedido (Adm)
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                imprimirGuiaPedido({ ...pedido, itens: itensState }, lotes);
              }}
              className="gap-1.5 font-bold border-slate-300 text-slate-700 hover:bg-slate-100 shadow-sm cursor-pointer"
              title="Imprimir folha de separação com lotes, validades e separação de clínicos e psicotrópicos"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              Imprimir Pedido
            </Button>

            {/* CENTRAL ACTIONS: Separar, Salvar Progresso ou Entregar à Satélite */}
            {mode === "central" && (pedido.status === "Pendente" || pedido.status === "Em Separação") && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onUpdateStatus("Em Separação", itensState)}
                  disabled={isPending}
                  className="border-blue-400 text-blue-700 hover:bg-blue-50 font-bold gap-1.5 shadow-xs"
                  title="Salva todos os lotes e quantidades já conferidos para continuar depois sem movimentar estoque ainda"
                >
                  <Save className="w-4 h-4 text-blue-600" />
                  Salvar Progresso (Continuar Depois)
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onUpdateStatus("Separado", itensState)}
                  disabled={isPending}
                  className="border-purple-300 text-purple-700 hover:bg-purple-50 font-bold"
                  title="Marca o pedido como Separado na Farmácia Central"
                >
                  Finalizar Separação
                </Button>

                <Button
                  type="button"
                  onClick={() => onUpdateStatus("Entregue", itensState)}
                  disabled={isPending}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold gap-1.5 shadow-sm"
                  title="Finaliza a separação e despacha o pedido para entrega na Farmácia Satélite"
                >
                  <Truck className="w-4 h-4" />
                  Finalizar & Entregar à Farmácia Satélite
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

        {/* DIALOG DE CONFIRMAÇÃO E MOTIVO DE CANCELAMENTO */}
        <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-red-700 flex items-center gap-2 text-base font-bold">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                {pedido.status === "Concluido" ? `Reverter & Cancelar Pedido ${pedido.codigo}` : `Cancelar Pedido ${pedido.codigo}`}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                {pedido.status === "Concluido" 
                  ? "Este pedido já foi recebido. Ao reverter, os medicamentos serão subtraídos do estoque da Satélite e restituídos à Farmácia Central."
                  : "Informe o motivo do cancelamento deste pedido. As reservas serão liberadas."
                }
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Motivo do Cancelamento *</Label>
                <Select value={motivoPreset} onValueChange={setMotivoPreset}>
                  <SelectTrigger className="text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Medicamento em falta / Desabastecimento na Central">
                      Medicamento em falta / Desabastecimento na Central
                    </SelectItem>
                    <SelectItem value="Lote com validade próxima / Divergência de estoque">
                      Lote com validade próxima / Divergência de estoque
                    </SelectItem>
                    <SelectItem value="Prescrição médica suspensa / Paciente em alta">
                      Prescrição médica suspensa / Paciente em alta
                    </SelectItem>
                    <SelectItem value="Pedido duplicado / Solicitado incorretamente">
                      Pedido duplicado / Solicitado incorretamente
                    </SelectItem>
                    <SelectItem value="Substituição terapêutica indicada pelo RT">
                      Substituição terapêutica indicada pelo RT
                    </SelectItem>
                    <SelectItem value="Outro">
                      Outro motivo (especificar abaixo)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  {motivoPreset === "Outro" ? "Descreva o motivo detalhado *" : "Observação / Justificativa adicional (opcional)"}
                </Label>
                <Textarea
                  placeholder="Detalhes adicionais para a equipe da farmácia..."
                  value={motivoCustom}
                  onChange={(e) => setMotivoCustom(e.target.value)}
                  className="text-xs min-h-[80px] bg-white"
                  required={motivoPreset === "Outro"}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCancelDialogOpen(false)}
              >
                Voltar
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isPending || (motivoPreset === "Outro" && !motivoCustom.trim())}
                onClick={() => {
                  const motivoFinal = motivoPreset === "Outro" 
                    ? motivoCustom.trim() 
                    : (motivoCustom.trim() ? `${motivoPreset} - ${motivoCustom.trim()}` : motivoPreset);
                  
                  onUpdateStatus("Cancelado", itensState, motivoFinal);
                  setIsCancelDialogOpen(false);
                }}
                className="bg-red-600 hover:bg-red-700 text-white font-bold gap-1.5 shadow-sm"
              >
                <Ban className="w-4 h-4" />
                Confirmar Cancelamento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
