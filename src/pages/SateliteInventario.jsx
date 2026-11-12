import { useState, useMemo, useRef } from "react";
import { db } from "@/api/db";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  ClipboardCheck,
  Printer,
  Search,
  Package,
  Layers,
  Boxes,
  EyeOff,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Sliders,
  FileCheck2,
  HeartPulse,
  AlertTriangle,
  RotateCcw,
  Pill,
  Plus,
  Trash2,
  Building2,
  Calendar,
  Check,
  Users,
  Calculator
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { normalizeSearch } from "@/utils/searchUtils";
import { isMav, isPsicotropico } from "@/utils/mavUtils";
import { safeFormatDate } from "@/utils/dateUtils";
import { calcularLotesSatelite } from "@/utils/sateliteLoteUtils";
import logo from "../assets/logo-tr.png";

/**
 * Divide um total inteiro entre N partes, distribuindo o resto +1 nas
 * primeiras partes. Ex.: 50 em 15 => 5 partes com 4 e 10 partes com 3.
 */
function dividirEmPartesInteiras(total, quantidadePartes) {
  const totalInt = Math.max(0, Math.floor(Number(total) || 0));
  const partes = Math.max(0, Math.floor(Number(quantidadePartes) || 0));
  if (partes === 0) return [];
  const base = Math.floor(totalInt / partes);
  const resto = totalInt % partes;
  return Array.from({ length: partes }, (_, index) => base + (index < resto ? 1 : 0));
}

export default function SateliteInventario() {
  const queryClient = useQueryClient();
  const printRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("com_saldo"); // "com_saldo", "todos", "padronizados", "controlados", "zerados"
  const [sortBy, setSortBy] = useState("nome"); // "nome", "codigo", "saldo_desc", "localizacao"
  const [isBlindCount, setIsBlindCount] = useState(false);
  const hoje = new Date();

  // Estados para Modal de Ajuste com Distribuição de Lotes
  const [ajusteModal, setAjusteModal] = useState({
    isOpen: false,
    medicamento: null,
    isControlado: false,
    lotesItens: [], // [{ id, loteId, numero_lote, data_validade, saldo_central, saldo_satelite_anterior, quantidade_satelite, isNovo }]
    motivo: "Ajuste de Balanço Físico Manual",
    tipoResolucao: "paciente", // 'paciente' | 'perda'
    pacienteId: "",
    pacientesSelecionados: [],
    medicoNome: "",
    medicoCrm: "",
    perdaMotivo: "Quebra acidental de ampola durante o plantão",
    observacao: ""
  });

  // Estados auxiliares da seleção múltipla de pacientes no balanço
  const [buscaPacienteModal, setBuscaPacienteModal] = useState("");
  const [filtroAlaModal, setFiltroAlaModal] = useState("todas");
  const [distribuicaoManual, setDistribuicaoManual] = useState({});
  const [confirmouAdministracao, setConfirmouAdministracao] = useState(false);

  // Usuário Logado
  let currentUser = { nome: "Farmacêutico Responsável", crf: "CRF-SP" };
  try {
    const rawUser = localStorage.getItem("pharma_user");
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      if (parsed) {
        currentUser = {
          nome: parsed.full_name || parsed.nome || parsed.login || "Farmacêutico",
          crf: parsed.crf || "CRF-SP"
        };
      }
    }
  } catch (e) {
    // ignore
  }

  // Buscar medicamentos
  const { data: medicamentos = [], isLoading: loadingMeds } = useQuery({
    queryKey: ['medicamentos'],
    queryFn: () => db.entities.Medicamento.list(),
  });

  // Buscar lotes
  const { data: lotes = [], isLoading: loadingLotes } = useQuery({
    queryKey: ['lotes'],
    queryFn: () => db.entities.Lote.list(),
  });

  // Buscar transferências pendentes
  const { data: transferencias = [] } = useQuery({
    queryKey: ['transferencias_pendentes'],
    queryFn: () => (db.entities.TransferenciaPendente ? db.entities.TransferenciaPendente.list() : []),
  });

  // Buscar pedidos satélite
  const { data: pedidosSatelite = [] } = useQuery({
    queryKey: ['pedidos_satelite'],
    queryFn: () => (db.entities.PedidoSatelite ? db.entities.PedidoSatelite.list() : []),
  });

  // Buscar saídas
  const { data: saidas = [] } = useQuery({
    queryKey: ['saidas'],
    queryFn: () => (db.entities.Saida ? db.entities.Saida.list() : []),
  });

  // Buscar pacientes para conciliação
  const { data: pacientes = [] } = useQuery({
    queryKey: ['pacientes'],
    queryFn: () => db.entities.Paciente.list(),
  });

  const isLoading = loadingMeds || loadingLotes;

  const pacientesAtivos = useMemo(() => {
    return pacientes.filter(p => !p.deleted_at && p.status !== 'Inativo');
  }, [pacientes]);

  const alasPacientesModal = useMemo(() => {
    const set = new Set();
    pacientesAtivos.forEach((p) => {
      const ala = p.alaNome || p.ala_nome;
      if (ala) set.add(ala);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [pacientesAtivos]);

  const pacientesFiltradosModal = useMemo(() => {
    const termo = normalizeSearch(buscaPacienteModal);
    const termos = termo ? termo.split(/\s+/).filter(Boolean) : [];

    return pacientesAtivos.filter((p) => {
      const ala = p.alaNome || p.ala_nome || "Geral";
      if (filtroAlaModal !== "todas" && ala !== filtroAlaModal) return false;
      if (!termos.length) return true;

      const texto = normalizeSearch(
        `${p.nome || ""} ${p.prontuario || ""} ${p.leito || ""} ${ala}`
      );
      return termos.every((t) => texto.includes(t));
    });
  }, [pacientesAtivos, buscaPacienteModal, filtroAlaModal]);

  // Resumo da contagem e distribuição da falta entre os pacientes selecionados
  const resumoDistribuicao = useMemo(() => {
    const med = ajusteModal.medicamento;
    const saldoAnterior = Number(med?.estoque_satelite) || 0;

    const linhasCalculadas = (ajusteModal.lotesItens || []).map((item, idx) => {
      const texto = String(item.quantidade_satelite ?? "").trim();
      const qtd = texto === "" ? 0 : Math.max(0, parseInt(texto, 10) || 0);
      const saldoAnteriorLote = Number(item.saldo_satelite_anterior) || 0;
      return {
        ...item,
        linha: idx + 1,
        qtd,
        saldoAnteriorLote,
        faltaLote: Math.max(0, saldoAnteriorLote - qtd),
      };
    });

    const totalContado = linhasCalculadas.reduce((acc, item) => acc + item.qtd, 0);
    const diferencaTotal = totalContado - saldoAnterior;
    const totalFalta = diferencaTotal < 0 ? Math.abs(diferencaTotal) : 0;
    const faltasLotes = linhasCalculadas.filter((item) => item.faltaLote > 0);
    const somaFaltasLotes = faltasLotes.reduce((acc, item) => acc + item.faltaLote, 0);

    const idsSelecionados = new Set(
      (ajusteModal.pacientesSelecionados || []).map((id) => String(id))
    );
    const selecionados = pacientesAtivos.filter((p) => idsSelecionados.has(String(p.id)));
    const automatica = dividirEmPartesInteiras(totalFalta, selecionados.length);

    const valores = selecionados.map((paciente, index) => {
      const manual = distribuicaoManual[String(paciente.id)];
      const quantidade =
        manual === undefined || manual === ""
          ? automatica[index] || 0
          : Math.max(0, parseInt(manual, 10) || 0);
      return { paciente, quantidade };
    });

    const somaDistribuida = valores.reduce((acc, item) => acc + item.quantidade, 0);
    const base = selecionados.length > 0 ? Math.floor(totalFalta / selecionados.length) : 0;
    const resto = selecionados.length > 0 ? totalFalta % selecionados.length : 0;

    return {
      linhasCalculadas,
      saldoAnterior,
      totalContado,
      diferencaTotal,
      totalFalta,
      faltasLotes,
      somaFaltasLotes,
      selecionados,
      valores,
      somaDistribuida,
      base,
      resto,
      divergenciaLotes: totalFalta > 0 && somaFaltasLotes !== totalFalta,
    };
  }, [
    ajusteModal.medicamento,
    ajusteModal.lotesItens,
    ajusteModal.pacientesSelecionados,
    pacientesAtivos,
    distribuicaoManual,
  ]);

  // Itens filtrados para o balanço satélite
  const processedItems = useMemo(() => {
    let list = medicamentos.filter(m => m.ativo !== false && !m.deleted_at);

    if (filterType === "com_saldo") {
      list = list.filter(m => (Number(m.estoque_satelite) || 0) > 0);
    } else if (filterType === "clinicos") {
      list = list.filter(m => !isPsicotropico(m.grupo_terapeutico) && !m.portaria_344);
    } else if (filterType === "controlados" || filterType === "psicotropicos") {
      list = list.filter(m => isPsicotropico(m.grupo_terapeutico) || m.portaria_344);
    } else if (filterType === "padronizados") {
      list = list.filter(m => m.padronizado !== false);
    } else if (filterType === "zerados") {
      list = list.filter(m => (Number(m.estoque_satelite) || 0) <= 0);
    }

    if (searchTerm.trim()) {
      const term = normalizeSearch(searchTerm);
      list = list.filter(m => {
        const nome = normalizeSearch(m.nome || "");
        const cod = normalizeSearch(m.codigo || "");
        const princ = normalizeSearch(m.principio_ativo || "");
        const loc = normalizeSearch(m.localizacao || "");
        return nome.includes(term) || cod.includes(term) || princ.includes(term) || loc.includes(term);
      });
    }

    return [...list].sort((a, b) => {
      if (sortBy === "nome") return (a.nome || "").localeCompare(b.nome || "");
      if (sortBy === "codigo") return (a.codigo || "").localeCompare(b.codigo || "");
      if (sortBy === "localizacao") return (a.localizacao || "ZZZ").localeCompare(b.localizacao || "ZZZ");
      if (sortBy === "saldo_desc") return (Number(b.estoque_satelite) || 0) - (Number(a.estoque_satelite) || 0);
      return 0;
    });
  }, [medicamentos, filterType, searchTerm, sortBy]);

  // Estatísticas Rápidas
  const stats = useMemo(() => {
    const totalItens = medicamentos.filter(m => m.ativo !== false && !m.deleted_at);
    const comSaldo = totalItens.filter(m => (Number(m.estoque_satelite) || 0) > 0);
    const clinicos = totalItens.filter(m => !isPsicotropico(m.grupo_terapeutico) && !m.portaria_344);
    const psicotropicos = totalItens.filter(m => isPsicotropico(m.grupo_terapeutico) || m.portaria_344);
    const totalUnidades = comSaldo.reduce((acc, m) => acc + (Number(m.estoque_satelite) || 0), 0);
    const zerados = totalItens.filter(m => (Number(m.estoque_satelite) || 0) <= 0);

    return {
      totalItens: totalItens.length,
      comSaldo: comSaldo.length,
      clinicos: clinicos.length,
      psicotropicos: psicotropicos.length,
      totalUnidades,
      zerados: zerados.length,
    };
  }, [medicamentos]);

  const handlePrint = (blind = false) => {
    setIsBlindCount(blind);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Abrir modal de balanço inteligente por lote
  const handleOpenAjuste = (med) => {
    const isControlado = isPsicotropico(med.grupo_terapeutico) || med.portaria_344;
    const saldoSatTotal = Number(med.estoque_satelite) || 0;

    // 1. Filtrar todos os lotes que pertencem a este medicamento (cadastrados na Central ou sistema)
    const medLotes = lotes.filter((l) => {
      const lMedId = String(l.medicamento_id || l.medicamentoId || "");
      if (lMedId && lMedId === String(med.id)) return true;
      if (med.codigo && l.medicamento_codigo && String(l.medicamento_codigo).trim() === String(med.codigo).trim()) return true;
      return false;
    });

    // 2. Calcular quais lotes possuem saldo comprovado na Satélite
    const lotesSatComprovados = calcularLotesSatelite({
      medId: med.id,
      medCodigo: med.codigo,
      medNome: med.nome,
      saldoTotalSat: saldoSatTotal,
      lotes,
      transferencias,
      pedidosSatelite,
      saidas,
    });

    // 3. Montar a lista inicial de lotes para contagem no modal com saldo limpo
    const lotesItens = medLotes.map((l) => {
      let saldoSatAnt = 0;
      if (l.quantidade_satelite !== undefined && l.quantidade_satelite !== null) {
        saldoSatAnt = Number(l.quantidade_satelite) || 0;
      } else {
        const satMatch = lotesSatComprovados.find(
          (ls) => ls.id === l.id || (ls.numero_lote && l.numero_lote && ls.numero_lote.trim().toLowerCase() === l.numero_lote.trim().toLowerCase())
        );
        saldoSatAnt = satMatch ? Number(satMatch.saldoSatelite) || 0 : 0;
      }

      return {
        id: l.id,
        loteId: l.id,
        numero_lote: l.numero_lote || "S/L",
        data_validade: l.data_validade || "",
        saldo_central: Number(l.quantidade_atual) || 0, // Apenas visualização
        saldo_satelite_anterior: saldoSatAnt,
        quantidade_satelite: saldoSatAnt > 0 ? String(saldoSatAnt) : "0",
        isNovo: false,
      };
    });

    // Se o medicamento não possui nenhum lote cadastrado na Central, criar linha inicial editável
    if (lotesItens.length === 0) {
      lotesItens.push({
        id: "lote-temp-1",
        loteId: null,
        numero_lote: "LOTE-01",
        data_validade: "",
        saldo_central: Number(med.estoque_atual) || 0,
        saldo_satelite_anterior: saldoSatTotal,
        quantidade_satelite: String(saldoSatTotal),
        isNovo: true,
      });
    }

    setAjusteModal({
      isOpen: true,
      medicamento: med,
      isControlado: !!isControlado,
      lotesItens,
      motivo: "Ajuste de Balanço Físico Manual",
      tipoResolucao: "paciente",
      pacienteId: pacientesAtivos[0]?.id || "",
      pacientesSelecionados: [],
      medicoNome: "",
      medicoCrm: "",
      perdaMotivo: "Quebra acidental de ampola durante o plantão",
      observacao: ""
    });

    setBuscaPacienteModal("");
    setFiltroAlaModal("todas");
    setDistribuicaoManual({});
    setConfirmouAdministracao(false);
  };

  // Adicionar linha de lote manual
  const handleAddLoteLinha = () => {
    setAjusteModal((prev) => ({
      ...prev,
      lotesItens: [
        ...prev.lotesItens,
        {
          id: `novo-lote-${Date.now()}`,
          loteId: null,
          numero_lote: "",
          data_validade: "",
          saldo_central: 0,
          saldo_satelite_anterior: 0,
          quantidade_satelite: "",
          isNovo: true,
        },
      ],
    }));
  };

  // Remover lote adicionado manualmente
  const handleRemoveLoteLinha = (idx) => {
    setAjusteModal((prev) => ({
      ...prev,
      lotesItens: prev.lotesItens.filter((_, i) => i !== idx),
    }));
  };

  // Alterar campo de um lote
  const handleLoteFieldChange = (idx, field, value) => {
    setAjusteModal((prev) => {
      const novosLotes = [...prev.lotesItens];
      novosLotes[idx] = {
        ...novosLotes[idx],
        [field]: value,
      };
      return { ...prev, lotesItens: novosLotes };
    });
    // A contagem mudou: a divisão automática precisa ser recalculada
    setDistribuicaoManual({});
    setConfirmouAdministracao(false);
  };

  // Alternar seleção de um paciente
  const togglePaciente = (id) => {
    setAjusteModal((prev) => {
      const atuais = (prev.pacientesSelecionados || []).map(String);
      const idStr = String(id);
      const proximos = atuais.includes(idStr)
        ? atuais.filter((item) => item !== idStr)
        : [...atuais, idStr];
      return { ...prev, pacientesSelecionados: proximos };
    });
    setDistribuicaoManual({});
    setConfirmouAdministracao(false);
  };

  // Selecionar todos os pacientes do filtro atual
  const selecionarTodosFiltrados = () => {
    setAjusteModal((prev) => {
      const set = new Set((prev.pacientesSelecionados || []).map(String));
      pacientesFiltradosModal.forEach((p) => set.add(String(p.id)));
      return { ...prev, pacientesSelecionados: Array.from(set) };
    });
    setDistribuicaoManual({});
    setConfirmouAdministracao(false);
  };

  // Limpar todos os pacientes selecionados
  const limparSelecaoPacientes = () => {
    setAjusteModal((prev) => ({ ...prev, pacientesSelecionados: [] }));
    setDistribuicaoManual({});
    setConfirmouAdministracao(false);
  };

  // Editar manualmente a quantidade de um paciente
  const atualizarDistribuicaoManual = (pacienteId, value) => {
    setDistribuicaoManual((prev) => ({ ...prev, [String(pacienteId)]: value }));
    setConfirmouAdministracao(false);
  };

  const fecharModalAjuste = () => {
    setAjusteModal((prev) => ({ ...prev, isOpen: false }));
    setBuscaPacienteModal("");
    setFiltroAlaModal("todas");
    setDistribuicaoManual({});
    setConfirmouAdministracao(false);
  };

  // Salvar Ajuste com Distribuição por Lote (sem mexer na Central)
  const handleSalvarAjuste = async (e) => {
    e.preventDefault();
    const med = ajusteModal.medicamento;
    if (!med) return;

    // Normaliza e valida TUDO antes de gravar qualquer coisa: sem transação
    // entre as chamadas, um erro no meio deixaria lote gravado e medicamento não.
    const soData = (v) => String(v || "").slice(0, 10);

    const linhas = ajusteModal.lotesItens.map((it, idx) => {
      const texto = String(it.quantidade_satelite ?? "").trim();
      const bruto = texto === "" ? 0 : parseInt(texto, 10);
      return {
        ...it,
        linha: idx + 1,
        qtd: Number.isNaN(bruto) ? 0 : Math.max(0, bruto),
      };
    });

    for (const it of linhas) {
      if (it.isNovo && !String(it.numero_lote || "").trim()) {
        toast.error(`Linha ${it.linha}: informe o número do lote.`);
        return;
      }
      if (it.isNovo && !soData(it.data_validade)) {
        toast.error(
          `Linha ${it.linha}: informe a validade do lote ${it.numero_lote}. ` +
          `Sem validade o lote não pode ser rastreado (e o sistema aceitaria duplicar).`
        );
        return;
      }
    }

    // Mesmo lote (número + validade) duas vezes na mesma contagem = soma dobrada
    const identidades = new Set();
    for (const it of linhas) {
      const numero = String(it.numero_lote || "").trim().toUpperCase();
      if (!numero || numero === "S/L") continue;
      const chave = `${numero}|${soData(it.data_validade)}`;
      if (identidades.has(chave)) {
        toast.error(
          `O lote ${it.numero_lote} vence ${soData(it.data_validade) || "sem validade"} aparece duas vezes. ` +
          `Some as quantidades em uma linha só.`
        );
        return;
      }
      identidades.add(chave);
    }

    // Cópia de trabalho: um lote criado na linha 1 já é encontrado na linha 2
    const lotesLocais = [...lotes];

    // Calcular soma total da contagem física
    const totalContado = linhas.reduce((acc, it) => acc + it.qtd, 0);

    const saldoAnterior = Number(med.estoque_satelite) || 0;
    const diferencaTotal = totalContado - saldoAnterior;

    // Se for psicotrópico e houver falta (redução)
    if (ajusteModal.isControlado && diferencaTotal < 0) {
      const { totalFalta, somaFaltasLotes, divergenciaLotes, selecionados, valores, somaDistribuida } =
        resumoDistribuicao;

      if (totalFalta <= 0) {
        toast.error("Não foi possível apurar a falta para justificativa no Livro 344.");
        return;
      }

      if (divergenciaLotes) {
        toast.error(
          `A soma das faltas por lote (${somaFaltasLotes} un) não confere com a divergência total (${totalFalta} un). ` +
          `Revise a contagem dos lotes antes de confirmar.`
        );
        return;
      }

      if (ajusteModal.tipoResolucao === "paciente") {
        if (selecionados.length === 0) {
          toast.error("Selecione pelo menos um paciente para justificar a saída legal no Livro 344.");
          return;
        }
        if (selecionados.length > totalFalta) {
          toast.error(
            `A falta é de ${totalFalta} unidade(s). Selecione no máximo ${totalFalta} paciente(s), ` +
            `para que ninguém receba quantidade zero.`
          );
          return;
        }
        if (valores.some((item) => item.quantidade <= 0)) {
          toast.error("Todos os pacientes selecionados precisam receber pelo menos 1 unidade.");
          return;
        }
        if (somaDistribuida !== totalFalta) {
          toast.error(
            `A distribuição soma ${somaDistribuida} un, mas a falta apurada é de ${totalFalta} un. ` +
            `Ajuste as quantidades antes de confirmar.`
          );
          return;
        }
        if (!confirmouAdministracao) {
          toast.error("Confirme que as doses foram efetivamente administradas aos pacientes selecionados.");
          return;
        }
      }
    }

    const baixasPorLote = [];

    try {
      toast.loading("Gravando balanço satélite por lote...");

      // Processar cada lote individualmente com número limpo direto
      for (const it of linhas) {
        const qtdFisicaLote = it.qtd;
        let targetLoteId = it.loteId;

        // Se for novo lote manual e ainda não tiver ID no banco
        if (it.isNovo && !targetLoteId && it.numero_lote) {
          const numLoteLimpo = it.numero_lote.trim();
          const matchExisting = lotesLocais.find(
            (l) =>
              String(l.medicamento_id || l.medicamentoId || "") === String(med.id) &&
              l.numero_lote &&
              l.numero_lote.trim().toLowerCase() === numLoteLimpo.toLowerCase() &&
              soData(l.data_validade) === soData(it.data_validade)
          );

          if (matchExisting) {
            targetLoteId = matchExisting.id;
            await db.entities.Lote.update(targetLoteId, {
              quantidade_satelite: qtdFisicaLote,
            });
          } else {
            // Cria o lote formalmente com QUANTIDADE_ATUAL = 0 para que a Central fique INTACTA!
            const novoLoteCriado = await db.entities.Lote.create({
              medicamento_id: med.id,
              numero_lote: numLoteLimpo,
              data_validade: it.data_validade || null,
              quantidade_atual: 0,
              quantidade_inicial: 0,
              quantidade_satelite: qtdFisicaLote,
              status: "disponivel",
              created_at: new Date().toISOString(),
            });
            targetLoteId = novoLoteCriado?.id || null;
            if (novoLoteCriado?.id) lotesLocais.push(novoLoteCriado);
          }
        } else if (targetLoteId) {
          // Lote existente: grava estritamente o número limpo contado para a Satélite (Central intocada!)
          await db.entities.Lote.update(targetLoteId, {
            quantidade_satelite: qtdFisicaLote,
          });
        }

        const saldoAntLote = Number(it.saldo_satelite_anterior) || 0;
        const diffLote = qtdFisicaLote - saldoAntLote;

        // Se for psicotrópico (Portaria 344) e houver falta, acumula a baixa
        // para depois distribuir entre os pacientes selecionados.
        if (ajusteModal.isControlado && diffLote < 0) {
          baixasPorLote.push({
            loteId: targetLoteId,
            numero_lote: it.numero_lote,
            quantidade: Math.abs(diffLote),
          });
        }
      }

      // Criar as saídas legais da Portaria 344
      if (ajusteModal.isControlado && baixasPorLote.length > 0) {
        if (ajusteModal.tipoResolucao === "paciente") {
          // Distribui cada baixa de lote entre os pacientes, mantendo a
          // rastreabilidade: um registro por paciente e por lote utilizado.
          const restantes = resumoDistribuicao.valores.map((item) => ({ ...item, usado: 0 }));

          for (const baixa of baixasPorLote) {
            let restanteLote = baixa.quantidade;

            for (const item of restantes) {
              if (restanteLote <= 0) break;

              const disponivelPaciente = item.quantidade - item.usado;
              if (disponivelPaciente <= 0) continue;

              const quantidadeUsada = Math.min(disponivelPaciente, restanteLote);
              const paciente = item.paciente;

              await db.entities.Saida.create({
                medicamento_id: med.id,
                medicamento_nome: med.nome,
                lote_id: baixa.loteId,
                numero_lote: baixa.numero_lote,
                quantidade: quantidadeUsada,
                destino: "Paciente",
                motivo: "Dispensação Hospitalar - Balanço Satélite",
                tipo: "SAIDA",
                origem: "satelite",
                paciente_id: paciente.id,
                paciente_nome: paciente.nome,
                ala_nome: paciente.alaNome || paciente.ala_nome || "Enfermaria",
                responsavel: currentUser.nome,
                responsavel_crf: currentUser.crf,
                data_saida: new Date().toISOString(),
                observacao:
                  `Conciliação de dose não baixada no plantão: ${ajusteModal.observacao || "Uso regular no leito"}. ` +
                  `Distribuição do balanço: ${quantidadeUsada} de ${resumoDistribuicao.totalFalta} un ` +
                  `entre ${resumoDistribuicao.selecionados.length} paciente(s).`,
              });

              item.usado += quantidadeUsada;
              restanteLote -= quantidadeUsada;
            }
          }
        } else if (ajusteModal.tipoResolucao === "perda") {
          for (const baixa of baixasPorLote) {
            await db.entities.Saida.create({
              medicamento_id: med.id,
              medicamento_nome: med.nome,
              lote_id: baixa.loteId,
              numero_lote: baixa.numero_lote,
              quantidade: baixa.quantidade,
              destino: "Ajuste de Balanço Satélite",
              motivo: "Perda",
              tipo: "SAIDA",
              origem: "satelite",
              paciente_id: null,
              paciente_nome: null,
              ala_nome: null,
              responsavel: currentUser.nome,
              responsavel_crf: currentUser.crf,
              data_saida: new Date().toISOString(),
              observacao: `Perda registrada no Balanço Satélite: ${ajusteModal.perdaMotivo}. ${ajusteModal.observacao || ""}`.trim(),
            });
          }
        }
      }

      // Atualizar o saldo físico total do medicamento na Satélite (NÚMERO LIMPO DIRETO!)
      await db.entities.Medicamento.update(med.id, {
        estoque_satelite: totalContado,
      });

      // Invalidar cache para atualizar visualmente todas as telas
      await queryClient.invalidateQueries({ queryKey: ["medicamentos"] });
      await queryClient.invalidateQueries({ queryKey: ["lotes"] });
      await queryClient.invalidateQueries({ queryKey: ["transferencias_pendentes"] });
      await queryClient.invalidateQueries({ queryKey: ["saidas"] });
      await queryClient.invalidateQueries({ queryKey: ["pedidos_satelite"] });

      toast.dismiss();
      const distribuiuPacientes =
        ajusteModal.isControlado &&
        diferencaTotal < 0 &&
        ajusteModal.tipoResolucao === "paciente" &&
        resumoDistribuicao.selecionados.length > 0;

      toast.success(
        `Balanço de ${med.nome} concluído com sucesso! Estoque satélite ajustado para ${totalContado} un.` +
        (distribuiuPacientes
          ? ` Falta de ${resumoDistribuicao.totalFalta} un distribuída entre ${resumoDistribuicao.selecionados.length} paciente(s).`
          : "")
      );

      setAjusteModal({
        isOpen: false,
        medicamento: null,
        isControlado: false,
        lotesItens: [],
        motivo: "",
        tipoResolucao: "paciente",
        pacienteId: "",
        pacientesSelecionados: [],
        medicoNome: "",
        medicoCrm: "",
        perdaMotivo: "",
        observacao: "",
      });
      setBuscaPacienteModal("");
      setFiltroAlaModal("todas");
      setDistribuicaoManual({});
      setConfirmouAdministracao(false);
    } catch (err) {
      toast.dismiss();
      toast.error("Erro ao salvar balanço por lote: " + (err.message || err));
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Estilos específicos de impressão */}
      <style>{`
        @media print {
          body, html, #root {
            background: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
            height: auto !important;
          }
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          @page {
            size: A4 portrait;
            margin: 10mm 12mm 12mm 12mm;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            font-size: 11px !important;
          }
          th {
            background-color: #0f172a !important;
            color: white !important;
            font-weight: bold !important;
            padding: 6px 8px !important;
            text-align: left !important;
            border: 1px solid #334155 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          td {
            padding: 8px 6px !important;
            border: 1px solid #cbd5e1 !important;
            color: #0f172a !important;
          }
          tr:nth-child(even) {
            background-color: #f8fafc !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .manual-box {
            border: 1.5px solid #64748b !important;
            height: 28px !important;
            width: 100% !important;
            background: #ffffff !important;
            display: block !important;
          }
          .page-break-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
        @media screen {
          .print-only {
            display: none !important;
          }
        }
      `}</style>

      {/* ÁREA DE TELA (NÃO IMPRESSA) */}
      <div className="no-print space-y-6">
        {/* Header Superior */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                <ClipboardCheck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Balanço Manual - Farmácia Satélite
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  Emissão de folha de contagem e conciliação protegida para o Livro Portaria 344
                </p>
              </div>
            </div>
          </div>

          {/* Botões de Ação de Impressão */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => handlePrint(false)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 font-bold shadow-sm rounded-xl h-10 px-4 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Imprimir Folha de Contagem
            </Button>
            <Button
              onClick={() => handlePrint(true)}
              variant="outline"
              className="border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 gap-2 font-semibold rounded-xl h-10 px-4 cursor-pointer text-slate-700 dark:text-slate-300"
              title="Gera a folha sem mostrar os saldos do sistema para auditoria sem viés"
            >
              <EyeOff className="w-4 h-4 text-amber-600" />
              Folha Cega (Sem Saldo)
            </Button>
          </div>
        </div>

        {/* Cards de Métricas Rápidas */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="p-4 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total com Saldo</p>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
                {stats.comSaldo}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Itens presentes no posto</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Boxes className="w-5 h-5" />
            </div>
          </Card>

          <Card className="p-4 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Unidades Físicas</p>
              <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
                {stats.totalUnidades.toLocaleString("pt-BR")}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Soma total de unidades</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
          </Card>

          <Card className="p-4 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Itens sem Saldo</p>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">
                {stats.zerados}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Itens zerados na satélite</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
          </Card>

          <Card className="p-4 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Catálogo</p>
              <div className="text-2xl font-black text-slate-700 dark:text-slate-300 font-mono mt-0.5">
                {stats.totalItens}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">Medicamentos cadastrados</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
          </Card>
        </div>

        {/* Filtros e Barra de Busca */}
        <Card className="p-4 rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            {/* Input de Busca */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar por nome, código, princípio ativo ou armário..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 text-sm"
              />
            </div>

            {/* Filtros de Tipo */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex flex-wrap p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold gap-1">
                <button
                  type="button"
                  onClick={() => setFilterType("todos")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
                    filterType === "todos"
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  )}
                >
                  Todos ({stats.totalItens})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("clinicos")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
                    filterType === "clinicos"
                      ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  )}
                  title="Medicamentos clínicos gerais (não controlados pela Portaria 344)"
                >
                  <Pill className="w-3.5 h-3.5 text-blue-500" />
                  <span>Clínicos</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-mono",
                    filterType === "clinicos"
                      ? "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  )}>
                    {stats.clinicos}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("psicotropicos")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5",
                    filterType === "psicotropicos" || filterType === "controlados"
                      ? "bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  )}
                  title="Medicamentos sob controle especial da Portaria SVS/MS 344/98"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                  <span>Psicotrópicos (Portaria 344)</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-full text-[10px] font-mono",
                    filterType === "psicotropicos" || filterType === "controlados"
                      ? "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-bold"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  )}>
                    {stats.psicotropicos}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("com_saldo")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                    filterType === "com_saldo"
                      ? "bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  )}
                >
                  Com Saldo ({stats.comSaldo})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType("padronizados")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg transition-all cursor-pointer",
                    filterType === "padronizados"
                      ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                  )}
                >
                  Padronizados
                </button>
              </div>

              {/* Ordenação */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-10 text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl px-3 text-slate-700 dark:text-slate-300"
              >
                <option value="nome">Ordem: Nome (A-Z)</option>
                <option value="codigo">Ordem: Código</option>
                <option value="saldo_desc">Ordem: Maior Saldo</option>
                <option value="localizacao">Ordem: Localização/Armário</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Tabela de Visualização em Tela */}
        <Card className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                {filterType === "clinicos" && `${processedItems.length} Medicamentos Clínicos (Gerais) selecionados`}
                {(filterType === "controlados" || filterType === "psicotropicos") && `${processedItems.length} Psicotrópicos (Portaria 344) selecionados`}
                {filterType === "com_saldo" && `${processedItems.length} Medicamentos com saldo ativo no posto`}
                {filterType === "padronizados" && `${processedItems.length} Medicamentos padronizados selecionados`}
                {filterType === "todos" && `${processedItems.length} Medicamentos (Catálogo completo) selecionados`}
              </span>
              {filterType === "clinicos" && (
                <Badge variant="outline" className="text-[10px] bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200">
                  Uso Geral / Sem Livro Especial
                </Badge>
              )}
              {(filterType === "controlados" || filterType === "psicotropicos") && (
                <Badge variant="outline" className="text-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200">
                  Controle Especial / Livro 344
                </Badge>
              )}
            </div>
            <span className="text-xs text-slate-400">
              Clique em "Ajustar Saldo" ou "Conciliar 344" para registrar a contagem física
            </span>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800/60">
                  <TableHead className="w-24 text-xs font-bold">CÓDIGO</TableHead>
                  <TableHead className="text-xs font-bold">MEDICAMENTO / APRESENTAÇÃO</TableHead>
                  <TableHead className="text-xs font-bold">LOCALIZAÇÃO</TableHead>
                  <TableHead className="text-xs font-bold text-center w-28">SALDO SISTEMA</TableHead>
                  <TableHead className="text-xs font-bold text-center w-36">CONTAGEM MANUAL</TableHead>
                  <TableHead className="text-xs font-bold text-center w-40">AÇÕES / CONCILIAÇÃO</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : processedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-slate-400">
                      Nenhum medicamento encontrado para os filtros selecionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  processedItems.map((med) => {
                    const saldo = Number(med.estoque_satelite) || 0;
                    const isControlado = isPsicotropico(med.grupo_terapeutico) || med.portaria_344;

                    return (
                      <TableRow key={med.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <TableCell className="font-mono text-xs font-semibold text-slate-600 dark:text-slate-400">
                          {med.codigo || "S/C"}
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-1.5 flex-wrap">
                            <span>{med.nome}</span>
                            {med.concentracao && (
                              <Badge variant="secondary" className="font-mono font-bold text-[11px] bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200/80 px-1.5 py-0 h-5">
                                {med.concentracao}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                            <span className="font-medium text-slate-600 dark:text-slate-400">
                              {[med.concentracao, med.apresentacao].filter(Boolean).join(" • ") || "-"}
                            </span>
                            {isControlado && (
                              <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200 flex items-center gap-1">
                                <ShieldAlert className="w-3 h-3 text-red-600" />
                                Portaria 344
                              </Badge>
                            )}
                            {isMav(med) && (
                              <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                                MAV
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                          {med.localizacao || "Geral"}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={cn(
                            "font-mono font-bold text-sm px-2.5 py-1 rounded-lg",
                            saldo > 0
                              ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                          )}>
                            {saldo}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="inline-block w-24 h-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-950/50 text-slate-400 text-xs flex items-center justify-center font-mono">
                            [ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ]
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {isControlado ? (
                            <Button
                              size="sm"
                              onClick={() => handleOpenAjuste(med)}
                              className="h-8 px-2.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg gap-1.5 shadow-xs cursor-pointer"
                              title="Ajuste auditado com proteção do Livro da Portaria 344"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-amber-200" />
                              Conciliar 344
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenAjuste(med)}
                              className="h-8 px-2.5 text-xs font-semibold rounded-lg gap-1.5 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                              <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                              Ajustar Saldo
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
      </div>

      {/* ========================================================================= */}
      {/* NOVO MODAL: BALANÇO FÍSICO SATÉLITE POR LOTES (ESTOQUE CENTRAL PROTEGIDO) */}
      {/* ========================================================================= */}
      <Dialog
        open={ajusteModal.isOpen}
        onOpenChange={(open) => !open && fecharModalAjuste()}
      >
        <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 text-lg">
              <Sliders className="w-5 h-5 text-indigo-600" />
              Balanço Físico Satélite • Contagem por Lote
            </DialogTitle>
            <DialogDescription className="text-xs">
              Informe a quantidade física que você tem de cada lote no posto/gaveta da Satélite.
            </DialogDescription>
          </DialogHeader>

          {ajusteModal.medicamento && (() => {
            const med = ajusteModal.medicamento;
            const saldoAnteriorSat = Number(med.estoque_satelite) || 0;
            const totalContadoSat = ajusteModal.lotesItens.reduce((acc, it) => {
              const val = parseInt(it.quantidade_satelite, 10);
              return acc + (isNaN(val) || val < 0 ? 0 : val);
            }, 0);
            const diferencaTotal = totalContadoSat - saldoAnteriorSat;

            return (
              <form onSubmit={handleSalvarAjuste} className="space-y-4 pt-1">
                {/* Identificação do Medicamento e Alerta da Central */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2 flex-wrap">
                        <span>{med.nome}</span>
                        {med.concentracao && (
                          <Badge className="bg-indigo-600 text-white font-mono font-bold text-xs px-2 py-0.5 shadow-xs">
                            {med.concentracao}
                          </Badge>
                        )}
                        {ajusteModal.isControlado && (
                          <Badge variant="outline" className="text-[10px] bg-red-50 text-red-700 border-red-200">
                            <ShieldAlert className="w-3 h-3 mr-1 text-red-600" />
                            Portaria 344
                          </Badge>
                        )}
                        {isMav(med) && (
                          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                            MAV
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                        <span><strong>Código:</strong> {med.codigo || "S/C"}</span>
                        <span>•</span>
                        <span><strong>Dosagem:</strong> {med.concentracao || "Não informada"}</span>
                        <span>•</span>
                        <span><strong>Forma:</strong> {med.apresentacao || "Geral"}</span>
                        <span>•</span>
                        <span><strong>Armário:</strong> {med.localizacao || "Satélite"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Banner de Proteção da Central */}
                  <div className="flex items-center gap-2 p-2.5 bg-blue-50/80 border border-blue-200 rounded-lg text-xs text-blue-900">
                    <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>
                      <strong>Estoque da Central Intacto:</strong> Os lotes da Farmácia Central são exibidos apenas para consulta/visualização. Qualquer ajuste (para mais ou para menos) afeta exclusivamente a Farmácia Satélite.
                    </span>
                  </div>
                </div>

                {/* Tabela de Lotes da Farmácia Central e Contagem Satélite */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      Lotes Cadastrados e Contagem Física na Satélite:
                    </Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleAddLoteLinha}
                      className="h-7 text-xs px-2.5 gap-1 border-dashed border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar outro lote físico
                    </Button>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-xs">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow className="text-[11px] font-bold text-slate-600">
                          <TableHead className="py-2">Lote</TableHead>
                          <TableHead className="py-2">Validade</TableHead>
                          <TableHead className="py-2 text-center" title="Saldo na Central (apenas visualização)">
                            Central (Visualizar)
                          </TableHead>
                          <TableHead className="py-2 text-center">Saldo Atual Satélite</TableHead>
                          <TableHead className="py-2 text-center bg-indigo-50/60 text-indigo-900">
                            Sua Contagem Satélite
                          </TableHead>
                          <TableHead className="py-2 text-center w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs">
                        {ajusteModal.lotesItens.map((item, idx) => (
                          <TableRow key={item.id || idx} className="hover:bg-slate-50/50">
                            {/* Número do Lote */}
                            <TableCell className="font-semibold py-2">
                              {item.isNovo ? (
                                <Input
                                  placeholder="Ex: LOT-2026-A"
                                  value={item.numero_lote}
                                  onChange={(e) => handleLoteFieldChange(idx, "numero_lote", e.target.value)}
                                  className="h-8 text-xs font-mono font-bold"
                                  required
                                />
                              ) : (
                                <div className="flex items-center gap-1.5 font-mono font-bold text-slate-800">
                                  <Boxes className="w-3.5 h-3.5 text-slate-400" />
                                  {item.numero_lote}
                                </div>
                              )}
                            </TableCell>

                            {/* Validade */}
                            <TableCell className="py-2 text-slate-600">
                              {item.isNovo ? (
                                <Input
                                  type="date"
                                  value={item.data_validade || ""}
                                  onChange={(e) => handleLoteFieldChange(idx, "data_validade", e.target.value)}
                                  className="h-8 text-xs font-mono"
                                />
                              ) : (
                                <div className="flex items-center gap-1 font-mono text-xs">
                                  <Calendar className="w-3 h-3 text-slate-400" />
                                  {safeFormatDate(item.data_validade)}
                                </div>
                              )}
                            </TableCell>

                            {/* Saldo na Central (Apenas Visualização) */}
                            <TableCell className="py-2 text-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono bg-slate-100 text-slate-600 border border-slate-200" title="Saldo atual na Farmácia Central (apenas informativo)">
                                <Building2 className="w-3 h-3 text-slate-400" />
                                {item.saldo_central} un
                              </span>
                            </TableCell>

                            {/* Saldo Anterior Satélite */}
                            <TableCell className="py-2 text-center font-mono font-medium text-slate-500">
                              {item.saldo_satelite_anterior} un
                            </TableCell>

                            {/* Quantidade Contada Satélite (Campo Editável) */}
                            <TableCell className="py-2 text-center bg-indigo-50/30">
                              <Input
                                type="number"
                                min="0"
                                required
                                value={item.quantidade_satelite}
                                onChange={(e) => handleLoteFieldChange(idx, "quantidade_satelite", e.target.value)}
                                className="h-8 w-24 mx-auto text-center font-mono font-bold text-sm bg-white border-indigo-200 text-indigo-700 focus:border-indigo-600"
                                placeholder="0"
                              />
                            </TableCell>

                            {/* Ação de remover se for lote adicionado */}
                            <TableCell className="py-2 text-center">
                              {item.isNovo && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveLoteLinha(idx)}
                                  className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  title="Remover linha"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Resumo do Balanço: Anterior vs Nova Contagem e Divergência */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                  <div className="p-2 bg-white rounded-lg border border-slate-200 text-center">
                    <span className="text-slate-500 block text-[11px]">Saldo Anterior Satélite</span>
                    <strong className="text-base font-mono text-slate-700">{saldoAnteriorSat} un</strong>
                  </div>

                  <div className="p-2 bg-indigo-50/70 rounded-lg border border-indigo-200 text-center">
                    <span className="text-indigo-800 block text-[11px] font-semibold">Nova Contagem Física Satélite</span>
                    <strong className="text-base font-mono text-indigo-700">{totalContadoSat} un</strong>
                  </div>

                  <div className={cn(
                    "p-2 rounded-lg border text-center",
                    diferencaTotal > 0
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : diferencaTotal < 0
                      ? "bg-amber-50 border-amber-200 text-amber-900"
                      : "bg-slate-100 border-slate-200 text-slate-700"
                  )}>
                    <span className="block text-[11px]">Divergência Total Satélite</span>
                    <strong className="text-base font-mono">
                      {diferencaTotal > 0 ? `+${diferencaTotal} un (Acréscimo)` : diferencaTotal < 0 ? `${diferencaTotal} un (Redução)` : "Sem divergência (0)"}
                    </strong>
                  </div>
                </div>

                {/* Se for Portaria 344 e houver falta física de psicotrópico */}
                {ajusteModal.isControlado && diferencaTotal < 0 && (
                  <div className="space-y-3 p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl">
                    <Label className="text-xs font-bold text-amber-900 flex items-center gap-1.5 block">
                      <ShieldAlert className="w-4 h-4 text-amber-600" />
                      Como deseja justificar a falta de {Math.abs(diferencaTotal)} unidade(s) no Livro da Portaria 344?
                    </Label>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setAjusteModal(prev => ({ ...prev, tipoResolucao: "paciente" }))}
                        className={cn(
                          "p-2.5 rounded-xl border text-left transition-all cursor-pointer",
                          ajusteModal.tipoResolucao === "paciente"
                            ? "border-indigo-600 bg-indigo-50/90 text-indigo-900 font-bold shadow-xs"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold">
                          <HeartPulse className="w-4 h-4 text-indigo-600" />
                          Uso em Paciente(s)
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 font-normal leading-tight">
                          Doses administradas no plantão (baixa esquecida). Pode dividir entre vários pacientes.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setAjusteModal(prev => ({ ...prev, tipoResolucao: "perda" }))}
                        className={cn(
                          "p-2.5 rounded-xl border text-left transition-all cursor-pointer",
                          ajusteModal.tipoResolucao === "perda"
                            ? "border-amber-600 bg-amber-50/90 text-amber-900 font-bold shadow-xs"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                        )}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold">
                          <AlertTriangle className="w-4 h-4 text-amber-600" />
                          Perda / Quebra
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 font-normal leading-tight">
                          Ampola quebrou, contaminou ou extraviou
                        </p>
                      </button>
                    </div>

                    {/* Formulário de Paciente(s) */}
                    {ajusteModal.tipoResolucao === "paciente" && (
                      <div className="space-y-3 pt-1">
                        <div className="flex items-center justify-between gap-2">
                          <Label className="text-xs font-semibold text-slate-700">
                            Selecione os pacientes que receberam as doses:
                          </Label>
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200 font-bold shrink-0"
                          >
                            {resumoDistribuicao.selecionados.length} selecionado(s)
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <Input
                              value={buscaPacienteModal}
                              onChange={(e) => setBuscaPacienteModal(e.target.value)}
                              placeholder="Buscar por nome, prontuário ou leito..."
                              className="h-9 pl-8 text-xs"
                            />
                          </div>
                          <Select value={filtroAlaModal} onValueChange={setFiltroAlaModal}>
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder="Filtrar por ala..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todas">Todas as alas</SelectItem>
                              {alasPacientesModal.map((ala) => (
                                <SelectItem key={ala} value={ala}>
                                  {ala}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-slate-500">
                            {pacientesFiltradosModal.length} paciente(s) encontrado(s)
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={selecionarTodosFiltrados}
                              className="h-7 text-[10px] font-bold"
                            >
                              Selecionar todos
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={limparSelecaoPacientes}
                              className="h-7 text-[10px] font-bold text-slate-500"
                            >
                              Limpar
                            </Button>
                          </div>
                        </div>

                        <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
                          {pacientesFiltradosModal.length === 0 ? (
                            <div className="p-4 text-center text-xs text-slate-500">
                              Nenhum paciente encontrado para o filtro.
                            </div>
                          ) : (
                            pacientesFiltradosModal.map((p) => {
                              const selecionado = (ajusteModal.pacientesSelecionados || [])
                                .map(String)
                                .includes(String(p.id));

                              return (
                                <button
                                  type="button"
                                  key={p.id}
                                  onClick={() => togglePaciente(p.id)}
                                  className={cn(
                                    "w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors cursor-pointer",
                                    selecionado ? "bg-indigo-50/80" : "hover:bg-slate-50"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "w-4 h-4 rounded border flex items-center justify-center shrink-0",
                                      selecionado
                                        ? "bg-indigo-600 border-indigo-600 text-white"
                                        : "border-slate-300 bg-white"
                                    )}
                                  >
                                    {selecionado && <Check className="w-3 h-3" />}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-xs font-semibold text-slate-800 truncate">
                                      {p.nome}
                                    </span>
                                    <span className="block text-[10px] text-slate-500 truncate">
                                      {p.prontuario ? `Pront. ${p.prontuario}` : "Sem prontuário"} •{" "}
                                      {p.alaNome || p.ala_nome || "Geral"}
                                      {p.leito ? ` • Leito ${p.leito}` : ""}
                                    </span>
                                  </span>
                                  <Users className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                                </button>
                              );
                            })
                          )}
                        </div>

                        {resumoDistribuicao.selecionados.length > resumoDistribuicao.totalFalta && (
                          <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-[11px] text-red-800 font-semibold">
                            A falta é de {resumoDistribuicao.totalFalta} unidade(s). Selecione no máximo{" "}
                            {resumoDistribuicao.totalFalta} paciente(s).
                          </div>
                        )}

                        {resumoDistribuicao.divergenciaLotes && (
                          <div className="p-2 rounded-lg bg-red-50 border border-red-200 text-[11px] text-red-800 font-semibold">
                            A soma das faltas por lote ({resumoDistribuicao.somaFaltasLotes} un) não confere
                            com a divergência total ({resumoDistribuicao.totalFalta} un). Revise a contagem
                            dos lotes antes de confirmar.
                          </div>
                        )}

                        {resumoDistribuicao.selecionados.length > 0 && (
                          <div className="rounded-xl border border-indigo-200 bg-white overflow-hidden">
                            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-indigo-50/70 border-b border-indigo-100">
                              <div className="text-[11px] font-bold text-indigo-900 flex items-center gap-1.5">
                                <Calculator className="w-3.5 h-3.5" />
                                {resumoDistribuicao.totalFalta} un ÷{" "}
                                {resumoDistribuicao.selecionados.length} paciente(s)
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setDistribuicaoManual({})}
                                className="h-6 text-[10px] font-bold text-indigo-700"
                              >
                                <RotateCcw className="w-3 h-3 mr-1" />
                                Recalcular
                              </Button>
                            </div>

                            <div className="px-3 py-1.5 text-[10px] text-slate-500 border-b border-slate-100">
                              {resumoDistribuicao.base} un para cada
                              {resumoDistribuicao.resto > 0
                                ? ` + ${resumoDistribuicao.resto} paciente(s) com ${resumoDistribuicao.base + 1} un`
                                : ""}.
                              Você pode ajustar as quantidades abaixo.
                            </div>

                            <div className="max-h-44 overflow-y-auto divide-y divide-slate-100">
                              {resumoDistribuicao.valores.map(({ paciente, quantidade }) => (
                                <div key={paciente.id} className="flex items-center gap-2 px-3 py-1.5">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-semibold text-slate-800 truncate">
                                      {paciente.nome}
                                    </p>
                                    <p className="text-[9px] text-slate-500 truncate">
                                      {paciente.prontuario ? `Pront. ${paciente.prontuario}` : "Sem prontuário"} •{" "}
                                      {paciente.alaNome || paciente.ala_nome || "Geral"}
                                    </p>
                                  </div>
                                  <Input
                                    type="number"
                                    min="0"
                                    value={quantidade}
                                    onChange={(e) => atualizarDistribuicaoManual(paciente.id, e.target.value)}
                                    className="h-7 w-16 text-center text-xs font-mono font-bold"
                                  />
                                  <span className="text-[10px] text-slate-500 w-5">un</span>
                                </div>
                              ))}
                            </div>

                            <div
                              className={cn(
                                "flex items-center justify-between px-3 py-2 border-t text-[11px] font-bold",
                                resumoDistribuicao.somaDistribuida === resumoDistribuicao.totalFalta
                                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  : "bg-red-50 text-red-800 border-red-200"
                              )}
                            >
                              <span>Total distribuído</span>
                              <span>
                                {resumoDistribuicao.somaDistribuida} / {resumoDistribuicao.totalFalta} un
                              </span>
                            </div>
                          </div>
                        )}

                        <label className="flex items-start gap-2 p-2.5 rounded-lg border border-slate-200 bg-white cursor-pointer">
                          <input
                            type="checkbox"
                            checked={confirmouAdministracao}
                            onChange={(e) => setConfirmouAdministracao(e.target.checked)}
                            className="mt-0.5 h-3.5 w-3.5 accent-indigo-600"
                          />
                          <span className="text-[11px] text-slate-700 font-medium leading-snug">
                            Confirmo que as doses foram efetivamente administradas aos pacientes
                            selecionados e que a distribuição representa a baixa real do plantão.
                          </span>
                        </label>
                      </div>
                    )}

                    {/* Formulário de Perda / Quebra */}
                    {ajusteModal.tipoResolucao === "perda" && (
                      <div className="space-y-1.5 pt-1">
                        <Label htmlFor="perdaMotivoSelect" className="text-xs font-semibold text-slate-700">
                          Motivo Formal da Perda:
                        </Label>
                        <Select
                          value={ajusteModal.perdaMotivo}
                          onValueChange={(val) => setAjusteModal(prev => ({ ...prev, perdaMotivo: val }))}
                        >
                          <SelectTrigger id="perdaMotivoSelect" className="h-9 text-xs">
                            <SelectValue placeholder="Selecione o motivo..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Quebra acidental de ampola durante o plantão">Quebra acidental de ampola no posto</SelectItem>
                            <SelectItem value="Contaminação acidental durante aspiração">Contaminação acidental de frasco</SelectItem>
                            <SelectItem value="Avaria ou dano físico no manuseio da gaveta">Avaria no manuseio da gaveta</SelectItem>
                            <SelectItem value="Extravio sob apuração pelo responsável do plantão">Extravio em apuração pelo RT</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label htmlFor="obsConciliacao" className="text-xs text-slate-600">
                        Observação Adicional / Prescrição:
                      </Label>
                      <Input
                        id="obsConciliacao"
                        value={ajusteModal.observacao}
                        onChange={(e) => setAjusteModal(prev => ({ ...prev, observacao: e.target.value }))}
                        placeholder="Ex: Dose prescrita no plantão"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* Motivo geral do ajuste */}
                <div className="space-y-1.5">
                  <Label htmlFor="motivoAjuste" className="text-xs font-semibold text-slate-700">
                    Motivo / Justificativa do Balanço:
                  </Label>
                  <Input
                    id="motivoAjuste"
                    value={ajusteModal.motivo}
                    onChange={(e) => setAjusteModal(prev => ({ ...prev, motivo: e.target.value }))}
                    className="h-8 text-xs"
                    placeholder="Ex: Balanço físico de rotina da satélite"
                  />
                </div>

                <DialogFooter className="pt-2 flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={fecharModalAjuste}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5">
                    <FileCheck2 className="w-4 h-4" />
                    Confirmar Balanço Satélite
                  </Button>
                </DialogFooter>
              </form>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* ÁREA DE IMPRESSÃO EXCLUSIVA (PRINT-ONLY) */}
      {/* ========================================================================= */}
      <div className="print-only" ref={printRef}>
        {/* Cabeçalho Hospitalar */}
        <div className="flex justify-between items-center pb-3 border-b-2 border-slate-800 mb-3">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Zorion Saúde" className="h-14 w-auto object-contain" />
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">
                ZORION SAÚDE
              </h1>
              <p className="text-xs font-bold text-slate-700 uppercase tracking-widest mt-1">
                FARMÁCIA SATÉLITE • CONTROLE DE ESTOQUE
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-block bg-slate-900 text-white font-bold text-[10px] uppercase px-2.5 py-1 rounded mb-1">
              {isBlindCount ? "CONTAGEM CEGA" : "FOLHA DE CONTAGEM"}
              {filterType === "controlados" || filterType === "psicotropicos"
                ? " • PSICOTRÓPICOS (PORTARIA 344)"
                : filterType === "clinicos"
                ? " • MEDICAMENTOS CLÍNICOS"
                : filterType === "com_saldo"
                ? " • ITENS COM SALDO ATIVO"
                : " • GERAL"}
            </span>
            <p className="text-[11px] font-bold text-slate-900">
              Data: {format(hoje, "dd/MM/yyyy 'às' HH:mm")}
            </p>
            <p className="text-[10px] text-slate-500">
              Total de Itens: {processedItems.length}
            </p>
          </div>
        </div>

        {/* Informações da Sessão de Contagem */}
        <div className="border border-slate-300 rounded p-2.5 mb-3 bg-slate-50 text-[11px] flex justify-between items-center">
          <div>
            <span className="font-bold text-slate-700">Setor / Posto:</span> Farmácia Satélite
          </div>
          <div>
            <span className="font-bold text-slate-700">Conferente:</span> __________________________________
          </div>
          <div>
            <span className="font-bold text-slate-700">Turno:</span> (&nbsp;&nbsp;) Manhã &nbsp;&nbsp; (&nbsp;&nbsp;) Tarde &nbsp;&nbsp; (&nbsp;&nbsp;) Noite
          </div>
        </div>

        {/* Tabela de Contagem para Impressão */}
        <table className="w-full">
          <thead>
            <tr>
              <th style={{ width: "65px" }}>CÓD.</th>
              <th>MEDICAMENTO / APRESENTAÇÃO</th>
              <th style={{ width: "160px" }}>LOTES / VALIDADE</th>
              <th style={{ width: "75px" }}>LOCALIZ.</th>
              {!isBlindCount && <th style={{ width: "70px", textAlign: "center" }}>SISTEMA</th>}
              <th style={{ width: "95px", textAlign: "center" }}>FÍSICO (CANETA)</th>
              <th style={{ width: "55px", textAlign: "center" }}>DIVERG.</th>
              <th style={{ width: "45px", textAlign: "center" }}>VISTO</th>
            </tr>
          </thead>
          <tbody>
            {processedItems.map((med) => {
              const saldo = Number(med.estoque_satelite) || 0;
              const lotesSat = calcularLotesSatelite({
                medId: med.id,
                medCodigo: med.codigo,
                medNome: med.nome,
                saldoTotalSat: saldo,
                lotes,
                transferencias,
                pedidosSatelite,
                saidas,
              });

              return (
                <tr key={med.id} className="page-break-avoid">
                  <td style={{ fontFamily: "monospace", fontWeight: "bold" }}>
                    {med.codigo || "S/C"}
                  </td>
                  <td>
                    <div style={{ fontWeight: "bold", textTransform: "uppercase", fontSize: "11px" }}>
                      {med.nome} {med.concentracao ? `(${med.concentracao})` : ""}
                    </div>
                    <div style={{ fontSize: "9px", color: "#64748b" }}>
                      {[med.concentracao, med.apresentacao].filter(Boolean).join(" • ")}
                      {med.portaria_344 ? " [PORTARIA 344]" : ""}
                      {isMav(med) ? " [MAV]" : ""}
                    </div>
                  </td>
                  <td style={{ fontSize: "10px" }}>
                    {lotesSat && lotesSat.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        {lotesSat.map((lt, idx) => (
                          <div key={idx} style={{ lineHeight: "1.2" }}>
                            <strong style={{ fontFamily: "monospace", fontSize: "10px" }}>{lt.numero_lote}</strong>
                            <span style={{ color: "#475569", marginLeft: "4px" }}>
                              {lt.data_validade ? `(Val: ${safeFormatDate(lt.data_validade)})` : ""}
                            </span>
                            {!isBlindCount && lt.saldoSatelite !== undefined && (
                              <span style={{ color: "#1e40af", fontWeight: "bold", marginLeft: "4px" }}>
                                [{lt.saldoSatelite} un]
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: "#94a3b8", fontStyle: "italic", fontSize: "9px" }}>
                        {saldo > 0 ? "Lote não individualizado" : "-"}
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: "10px" }}>
                    {med.localizacao || "Geral"}
                  </td>
                  {!isBlindCount && (
                    <td style={{ textAlign: "center", fontWeight: "bold", fontSize: "12px" }}>
                      {saldo}
                    </td>
                  )}
                  <td style={{ textAlign: "center", padding: "4px" }}>
                    <div className="manual-box"></div>
                  </td>
                  <td style={{ textAlign: "center", color: "#94a3b8" }}>
                    ____
                  </td>
                  <td style={{ textAlign: "center", color: "#94a3b8" }}>
                    [ &nbsp; ]
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Rodapé com Assinaturas */}
        <div className="page-break-avoid mt-6 pt-4 border-t border-slate-300">
          <div className="mb-4 text-[10px] text-slate-500">
            <strong>Observações de Campo / Avarias / Quebras:</strong>
            <div className="border-b border-slate-300 h-6 mt-1"></div>
            <div className="border-b border-slate-300 h-6"></div>
          </div>

          <div className="grid grid-cols-2 gap-12 mt-8 text-center text-xs">
            <div>
              <div className="border-t border-slate-800 pt-1 font-bold uppercase">
                Assinatura do Conferente (Enfermagem / Farmácia)
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Nome legível e Matrícula / Registro
              </div>
            </div>
            <div>
              <div className="border-t border-slate-800 pt-1 font-bold uppercase">
                Farmacêutico(a) Responsável Técnico
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Visto e Homologação do Balanço
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
