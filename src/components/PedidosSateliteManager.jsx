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
  Droplet
} from "lucide-react";

export function PedidosSateliteManager({ mode = "satelite" }) {
  // mode can be "satelite" or "central"
  const queryClient = useQueryClient();

  // State for order creation (satelite)
  const [selectedAlaIds, setSelectedAlaIds] = useState(["all"]);
  const [diasCalculo, setDiasCalculo] = useState(1);
  const [customDias, setCustomDias] = useState("");
  const [margemPercentual, setMargemPercentual] = useState(0); // 0, 10, 20, 25, 30, "custom"
  const [customMargem, setCustomMargem] = useState("");
  const [descontarEstoque, setDescontarEstoque] = useState(false);
  const [customQuantities, setCustomQuantities] = useState({}); // medId -> custom quantity
  const [observacaoPedido, setObservacaoPedido] = useState("");
  const [prioridadePedido, setPrioridadePedido] = useState("Normal"); // "Normal" | "Urgente" | "Emergência"

  // State for order view modal
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [printOrderData, setPrintOrderData] = useState(null);

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
    const ativas = prescricoes.filter(p => {
      // 1. Status check: aceita Ativa, Ativo (case-insensitive) ou sem status definido
      const statusStr = String(p.status || "Ativa").trim().toLowerCase();
      if (statusStr !== "ativa" && statusStr !== "ativo") return false;

      // 2. Paciente check
      const pacId = p.pacienteId || p.paciente_id;
      const pac = pacientes.find(patient => 
        (pacId && String(patient.id) === String(pacId)) ||
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
    const hojeStr = format(new Date(), "yyyy-MM-dd");

    ativas.forEach(p => {
      const medId = p.medicamentoId || p.medicamento_id;
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
        dailyDose = sumDoses > 0 ? sumDoses : (Number(p.dose) || 1);
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

  // Resumo macro do pedido calculado
  const resumoPedido = useMemo(() => {
    let totalPrescrito = 0;
    let totalMargemExtra = 0;
    let totalSolicitado = 0;

    calculoNecessidade.forEach(item => {
      const finalQtd = customQuantities[item.medicamentoId] !== undefined 
        ? parseInt(customQuantities[item.medicamentoId], 10) || 0 
        : item.qtdSugerida;

      totalPrescrito += item.qtdCalculada;
      totalMargemExtra += item.qtdMargemExtra;
      totalSolicitado += finalQtd;
    });

    return {
      totalItens: calculoNecessidade.length,
      totalPrescrito,
      totalMargemExtra,
      totalSolicitado
    };
  }, [calculoNecessidade, customQuantities]);

  // Create Order Mutation
  const criarPedidoMutation = useMutation({
    mutationFn: async () => {
      if (calculoNecessidade.length === 0) {
        throw new Error("Nenhuma medicação necessária encontrada para os filtros selecionados.");
      }

      const isAllAlasCalc = selectedAlaIds.includes("all") || selectedAlaIds.length === 0;
      const alasEncontradas = alas.filter(a => selectedAlaIds.includes(String(a.id)));
      const alaNomeStr = isAllAlasCalc 
        ? "Todas as Alas" 
        : (alasEncontradas.length > 0 ? alasEncontradas.map(a => a.nome).join(" + ") : "Alas Selecionadas");
      const alaIdStr = isAllAlasCalc ? "all" : selectedAlaIds.join(",");

      const itens = calculoNecessidade.map(item => {
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
          conferido: false
        };
      }).filter(i => i.qtd_solicitada > 0);

      if (itens.length === 0) {
        throw new Error("O pedido não possui itens com quantidade maior que zero.");
      }

      const pedidoId = crypto.randomUUID();
      const timestampCode = Date.now().toString().slice(-6);

      let obsFinal = observacaoPedido || "";
      if (effectiveMargem > 0 || descontarEstoque) {
        const tagMargem = effectiveMargem > 0 ? `Margem: +${effectiveMargem}%` : '';
        const tagEstoque = descontarEstoque ? 'Estoque Satélite Abatido' : '';
        const tags = [tagMargem, tagEstoque].filter(Boolean).join(' | ');
        obsFinal = obsFinal ? `[${tags}] ${obsFinal}` : `[${tags}]`;
      }

      const novoPedido = {
        id: pedidoId,
        codigo: `PED-${timestampCode}`,
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
        margem: effectiveMargem,
        itens: itens.length
      });

      // Atualiza automaticamente as prescrições de frascos líquidos que foram repostos neste pedido
      const hoje = format(new Date(), "yyyy-MM-dd");
      for (const item of calculoNecessidade) {
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
      let rawItens = pedidoCustom.itens || pedidoCustom.itens_json || [];
      if (typeof rawItens === "string") {
        try { rawItens = JSON.parse(rawItens); } catch {}
      }
      const itensArr = Array.isArray(rawItens) ? rawItens : [];
      setPrintOrderData({
        codigo: pedidoCustom.codigo || "PED-CENTRAL",
        alaNome: pedidoCustom.ala_nome || pedidoCustom.alaNome || "Geral",
        dataSolicitacao: pedidoCustom.data_solicitacao || pedidoCustom.dataSolicitacao || new Date().toISOString(),
        dias: pedidoCustom.dias_calculados || pedidoCustom.dias || effectiveDays,
        margem: pedidoCustom.margem_seguranca || pedidoCustom.margem || 0,
        descontarEstoque: pedidoCustom.descontar_estoque === 1 || pedidoCustom.descontarEstoque === true,
        prioridade: pedidoCustom.prioridade || "Normal",
        status: pedidoCustom.status || "Pendente",
        observacao: pedidoCustom.observacoes || pedidoCustom.observacao || "",
        itens: itensArr.map(i => ({
          codigo: i.codigo || "-",
          nome: i.medicamento_nome || i.medicamentoNome || i.nome || "Medicamento",
          concentracao: i.concentracao || "",
          apresentacao: i.apresentacao || "",
          qtdPrescrita: i.qtd_prescrita ?? i.qtdPrescrita ?? i.qtdCalculada ?? 0,
          estoqueSatelite: i.estoque_satelite_momento ?? i.estoqueSatelite ?? 0,
          qtdSolicitada: i.qtd_solicitada !== undefined 
            ? i.qtd_solicitada 
            : (i.qtdSolicitada !== undefined ? i.qtdSolicitada : (i.finalQtd ?? 0))
        }))
      });
    } else {
      const isAllAlasCalc = selectedAlaIds.includes("all") || selectedAlaIds.length === 0;
      const alasEncontradas = alas.filter(a => selectedAlaIds.includes(String(a.id)));
      const alaNomeStr = isAllAlasCalc 
        ? "Todas as Alas" 
        : (alasEncontradas.length > 0 ? alasEncontradas.map(a => a.nome).join(" + ") : "Alas Selecionadas");

      const itens = calculoNecessidade.map(item => {
        const finalQtd = customQuantities[item.medicamentoId] !== undefined 
          ? parseInt(customQuantities[item.medicamentoId], 10) || 0 
          : item.qtdSugerida;

        return {
          codigo: item.codigo || "-",
          nome: item.nome,
          concentracao: item.concentracao || "",
          apresentacao: item.apresentacao || "",
          qtdPrescrita: item.qtdCalculada,
          estoqueSatelite: item.estoqueSatelite,
          qtdSolicitada: finalQtd
        };
      });

      setPrintOrderData({
        codigo: `PREVIA-${Date.now().toString().slice(-4)}`,
        alaNome: alaNomeStr,
        dataSolicitacao: new Date().toISOString(),
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

  // Modal Action Mutation (Separar, Entregar, Conferir/Receber)
  const updatePedidoMutation = useMutation({
    mutationFn: async ({ pedido, newStatus, updatedItens, motivoCancelamento }) => {
      const payload = {
        status: newStatus,
        itens_json: JSON.stringify(updatedItens)
      };

      if (newStatus === "Cancelado") {
        payload.motivo_cancelamento = motivoCancelamento || "Cancelado pelo operador";
        payload.data_cancelamento = new Date().toISOString();
        payload.observacao = pedido.observacao 
          ? `[CANCELADO: ${motivoCancelamento || "Sem motivo"}] ${pedido.observacao}`
          : `[CANCELADO: ${motivoCancelamento || "Sem motivo"}]`;
        
        try {
          await db.logAction(
            "Cancelamento Pedido",
            "PedidoSatelite",
            pedido.id,
            `Pedido ${pedido.codigo} (${pedido.ala_nome}) cancelado. Motivo: ${motivoCancelamento || "Sem motivo informado"}`
          );
        } catch (e) {}
      } else if (newStatus === "Separado") {
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
      const { newStatus, pedido } = variables;
      if (newStatus === "Cancelado") {
        toast.error(`Pedido ${pedido.codigo} cancelado com sucesso. A Farmácia Satélite foi notificada!`);
      } else if (newStatus === "Em Separação") toast.info("Pedido marcado em separação.");
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
                  disabled={criarPedidoMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2 shadow-md h-9"
                >
                  <Send className="w-4 h-4" />
                  {criarPedidoMutation.isPending ? "Enviando..." : "Fazer Pedido à Central"}
                </Button>
              </div>
            )}
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200/60 dark:border-slate-800">
                <p className="text-[10px] uppercase font-bold text-slate-500">Medicamentos</p>
                <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{resumoPedido.totalItens} <span className="text-xs font-normal text-slate-500">itens</span></p>
              </div>
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200/60 dark:border-slate-800">
                <p className="text-[10px] uppercase font-bold text-slate-500">Consumo Prescrito ({effectiveDays}D)</p>
                <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{resumoPedido.totalPrescrito} <span className="text-xs font-normal text-slate-500">un</span></p>
              </div>
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200/70 dark:border-emerald-900/40">
                <p className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400">Reserva de Segurança ({effectiveMargem}%)</p>
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">+{resumoPedido.totalMargemExtra} <span className="text-xs font-normal text-emerald-600">un</span></p>
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
                  {calculoNecessidade.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={effectiveMargem > 0 ? 7 : 6} className="text-center py-10 text-slate-500">
                        Nenhuma necessidade calculada para esta Ala e Período.
                      </TableCell>
                    </TableRow>
                  ) : (
                    calculoNecessidade.map(item => {
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
                  try {
                    if (Array.isArray(p.itens)) itensArr = p.itens;
                    else itensArr = JSON.parse(p.itens_json || "[]");
                  } catch {}

                  return (
                    <TableRow key={p.id} className="hover:bg-slate-50">
                      <TableCell className="font-mono font-bold text-xs text-indigo-600">
                        {p.codigo}
                        {p.prioridade && p.prioridade !== "Normal" && (
                          <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                            p.prioridade === "Emergência" ? "bg-red-600 text-white animate-pulse" : "bg-amber-500 text-white"
                          }`}>
                            {p.prioridade}
                          </span>
                        )}
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

      {/* ─── MODAL DE PREVIEW DA IMPRESSÃO EM TELA ────────────────────── */}
      <Dialog open={Boolean(printOrderData)} onOpenChange={(open) => !open && setPrintOrderData(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 border-none bg-slate-100 dark:bg-slate-900 shadow-2xl print:!hidden print:hidden">
          <DialogHeader className="p-4 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex flex-row items-center justify-between no-print sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5 text-blue-600" />
              <DialogTitle className="text-base font-bold text-slate-900 dark:text-slate-100">
                Visualização de Impressão — Requisição à Farmácia Central
              </DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPrintOrderData(null)}>
                Fechar
              </Button>
              <Button size="sm" onClick={() => window.print()} className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1.5 shadow-sm">
                <Printer className="w-4 h-4" />
                Imprimir Agora
              </Button>
            </div>
          </DialogHeader>

          {/* FOLHA FORMAL A4 (PREVIEW EM TELA) */}
          <div className="p-6 sm:p-10 bg-white text-slate-900 mx-auto w-full shadow-sm">
            <PrintOrderSheetContent data={printOrderData} />
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── PORTAL OFICIAL DE IMPRESSÃO (DIRETO NO BODY, FORA DO MODAL E DO ROOT) ─ */}
      {Boolean(printOrderData) && typeof document !== "undefined" && createPortal(
        <div id="print-order-sheet-portal">
          <PrintOrderSheetContent data={printOrderData} />
        </div>,
        document.body
      )}

      {/* ─── ESTILOS CSS PARA IMPRESSÃO EM FOLHA A4 ───────────────────────────── */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
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

// ─── FOLHA FORMAL A4 DE REQUISIÇÃO (USADA NO PREVIEW E NA IMPRESSÃO) ────────
function PrintOrderSheetContent({ data }) {
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

  const totalUnidades = (data.itens || []).reduce(
    (acc, item) => acc + (Number(item.qtdSolicitada) || 0),
    0
  );

  return (
    <div className="order-sheet-container bg-white text-slate-900 w-full p-2">
      {/* Cabeçalho */}
      <div className="border-b-2 border-slate-900 pb-4 mb-5 flex justify-between items-start gap-4">
        <div>
          <h1 className="text-xl font-black uppercase text-slate-950 tracking-tight leading-tight">
            ZORION SAÚDE — FARMÁCIA HOSPITALAR
          </h1>
          <h2 className="text-sm font-bold text-blue-800 uppercase mt-0.5">
            REQUISIÇÃO DE MEDICAMENTOS • PEDIDO À FARMÁCIA CENTRAL
          </h2>
          <p className="text-xs text-slate-700 mt-1.5">
            Origem: <strong className="text-slate-950">Farmácia Satélite</strong> • Setor/Ala: <strong className="text-slate-950">{data.alaNome}</strong>
          </p>
          <p className="text-xs text-slate-600 font-mono mt-0.5">
            Código: <strong className="text-slate-950">{data.codigo}</strong> • Status: <strong className="text-slate-950">{data.status}</strong>
          </p>
        </div>
        <div className="text-right text-xs text-slate-700 font-mono space-y-1 shrink-0">
          <p>Emissão: <strong className="text-slate-950">{formattedDate}</strong></p>
          <p>
            Prioridade:{" "}
            <span className={`font-black uppercase px-2 py-0.5 rounded text-[11px] ${
              data.prioridade === "Emergência" 
                ? "bg-red-100 text-red-900 border border-red-300" 
                : data.prioridade === "Urgente" 
                  ? "bg-amber-100 text-amber-900 border border-amber-300" 
                  : "bg-slate-100 text-slate-900"
            }`}>
              {data.prioridade}
            </span>
          </p>
          <p>Suprimento: <strong className="text-slate-950">{data.dias} dia(s)</strong></p>
          {data.margem > 0 && (
            <p>Margem de Segurança: <strong className="text-slate-950">+{data.margem}%</strong></p>
          )}
          {data.descontarEstoque && (
            <p>Abatido Estoque Satélite: <strong className="text-slate-950">Sim</strong></p>
          )}
        </div>
      </div>

      {data.observacao && (
        <div className="mb-4 p-2.5 bg-slate-50 border border-slate-300 rounded text-xs text-slate-800">
          <strong className="text-slate-950">Observações da Requisição:</strong> {data.observacao}
        </div>
      )}

      {/* Tabela de Itens */}
      <table className="w-full text-xs border-collapse border border-slate-400 mb-6">
        <thead>
          <tr className="bg-slate-100 text-slate-900 font-bold border-b-2 border-slate-400">
            <th className="border border-slate-300 p-2 text-center w-10">Item</th>
            <th className="border border-slate-300 p-2 text-center w-16">Cód.</th>
            <th className="border border-slate-300 p-2 text-left">Medicamento / Concentração</th>
            <th className="border border-slate-300 p-2 text-center w-24">Prescr. ({data.dias}D)</th>
            <th className="border border-slate-300 p-2 text-center w-16">Est. Sat.</th>
            <th className="border border-slate-300 p-2 text-center w-28 bg-blue-50/80 font-black text-slate-950">
              Qtd Solicitada
            </th>
            <th className="border border-slate-300 p-2 text-center w-24">Conferência</th>
          </tr>
        </thead>
        <tbody>
          {(data.itens || []).map((item, idx) => (
            <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50/70"}>
              <td className="border border-slate-300 p-1.5 text-center font-mono text-slate-700">{idx + 1}</td>
              <td className="border border-slate-300 p-1.5 text-center font-mono text-slate-700">{item.codigo || "-"}</td>
              <td className="border border-slate-300 p-1.5 font-medium break-words [overflow-wrap:anywhere]">
                <span className="font-bold text-slate-950">{item.nome}</span>
                {item.concentracao && <span className="text-slate-700"> ({item.concentracao})</span>}
                {item.apresentacao && <span className="text-slate-500 text-[10px] block">[{item.apresentacao}]</span>}
              </td>
              <td className="border border-slate-300 p-1.5 text-center font-mono text-slate-800">{item.qtdPrescrita} un</td>
              <td className="border border-slate-300 p-1.5 text-center font-mono text-slate-800">{item.estoqueSatelite} un</td>
              <td className="border border-slate-300 p-1.5 text-center font-mono font-black text-sm bg-blue-50/50 text-slate-950">
                {item.qtdSolicitada} un
              </td>
              <td className="border border-slate-300 p-1.5 text-center font-mono text-slate-400">
                [&nbsp;&nbsp;&nbsp;&nbsp;]
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100 font-bold border-t-2 border-slate-400 text-slate-950">
            <td colSpan={5} className="border border-slate-300 p-2 text-right uppercase">
              Total de Itens: {data.itens?.length || 0} • Total de Unidades Solicitadas:
            </td>
            <td className="border border-slate-300 p-2 text-center font-mono text-sm font-black bg-blue-100/90 text-slate-950">
              {totalUnidades} un
            </td>
            <td className="border border-slate-300 p-2"></td>
          </tr>
        </tfoot>
      </table>

      {/* Campos de Assinatura */}
      <div className="signature-area mt-12 pt-6 border-t border-slate-300 grid grid-cols-2 gap-8 text-center text-xs">
        <div>
          <div className="border-b border-slate-400 w-56 mx-auto mb-1.5"></div>
          <p className="font-bold text-slate-900">Solicitante (Farmácia Satélite)</p>
          <p className="text-[10px] text-slate-500">Assinatura / Carimbo / Data</p>
        </div>
        <div>
          <div className="border-b border-slate-400 w-56 mx-auto mb-1.5"></div>
          <p className="font-bold text-slate-900">Atendido / Separado por (Farmácia Central)</p>
          <p className="text-[10px] text-slate-500">Assinatura / Carimbo / Data</p>
        </div>
      </div>
    </div>
  );
}

// ─── SUBCOMPONENTE MODAL DE DETALHES & CONFERÊNCIA ───────────────────────────
export function OrderDetailsModal({ open, onOpenChange, pedido, mode, onUpdateStatus, isPending, onPrint }) {
  const [itensState, setItensState] = useState(() => {
    let rawItens = pedido.itens || pedido.itens_json || [];
    if (typeof rawItens === "string") {
      try { rawItens = JSON.parse(rawItens); } catch {}
    }
    const arr = Array.isArray(rawItens) ? rawItens : [];
    return arr.map(i => ({
      ...i,
      qtd_recebida: i.qtd_recebida !== undefined ? i.qtd_recebida : i.qtd_atendida
    }));
  });

  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [motivoPreset, setMotivoPreset] = useState("Medicamento em falta / Desabastecimento na Central");
  const [motivoCustom, setMotivoCustom] = useState("");

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

                  <TableCell className="max-w-[280px] min-w-[170px] break-words whitespace-normal [overflow-wrap:anywhere] [word-break:break-word]">
                    <p className="font-bold text-slate-900 break-words whitespace-normal [overflow-wrap:anywhere] [word-break:break-word] leading-snug">{item.medicamento_nome}</p>
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

        <DialogFooter className="border-t pt-3 flex flex-wrap justify-between items-center w-full gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>

            {/* BOTAO CANCELAR PEDIDO */}
            {pedido.status !== "Concluido" && pedido.status !== "Cancelado" && (
              <Button
                variant="outline"
                onClick={() => setIsCancelDialogOpen(true)}
                disabled={isPending}
                className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold gap-1.5"
              >
                <Ban className="w-4 h-4" />
                Cancelar Pedido
              </Button>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onPrint?.({ ...pedido, itens: itensState })}
              className="gap-1.5 font-bold border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              Imprimir Pedido
            </Button>

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

        {/* DIALOG DE CONFIRMAÇÃO E MOTIVO DE CANCELAMENTO */}
        <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
          <DialogContent className="max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="text-red-700 flex items-center gap-2 text-base font-bold">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Cancelar Pedido {pedido.codigo}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Informe o motivo do cancelamento deste pedido. Uma notificação será enviada imediatamente para a Farmácia Satélite.
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
