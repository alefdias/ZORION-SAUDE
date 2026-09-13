import { useState, useMemo, useEffect } from "react";
import { db } from "@/api/db";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  Printer,
  AlertTriangle,
  Book,
  FileCheck2,
  Search,
  CheckCircle2,
  Package,
  Layers,
  ArrowRight,
  User,
  ShieldCheck,
  Building,
  Calendar,
  RefreshCw,
  FileSpreadsheet,
  Filter,
  CreditCard
} from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { isPsicotropico, getPortaria344List, getPortaria344CategoryKey } from "@/utils/mavUtils";

export default function LivroRegistro() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = new URLSearchParams(location.search);
  const initialMedId = searchParams.get("medId") || "";
  const queryClient = useQueryClient();

  // Active Main Tab: 'livro_diario' | 'bmpo_bspo' | 'rastreabilidade'
  const [activeTab, setActiveTab] = useState("livro_diario");

  // Filtro de Categoria da Portaria 344 para o Livro: 'psicotropicos' | 'controle_especial' | 'entorpecentes' | 'imunossupressores' | 'adiantamento' | 'todos'
  const [filtroCategoria344, setFiltroCategoria344] = useState("psicotropicos");

  // Selected Medication for Tab 1 (Livro Diário)
  const [selectedLivroMedId, setSelectedLivroMedId] = useState(initialMedId);

  // Modal Perda
  const [isPerdaModalOpen, setIsPerdaModalOpen] = useState(false);
  const [perdaQtd, setPerdaQtd] = useState("");
  const [perdaMotivoPreset, setPerdaMotivoPreset] = useState("");
  const [perdaMotivoCustom, setPerdaMotivoCustom] = useState("");
  const [perdaLote, setPerdaLote] = useState("");

  // Tab 2 (BMPO/BSPO) filters
  const [bmpoTipo, setBmpoTipo] = useState("BMPO"); // 'BMPO' | 'BSPO'
  const [bmpoPeriodicidade, setBmpoPeriodicidade] = useState("mensal"); // 'mensal' | 'trimestral' | 'anual'
  const [bmpoAno, setBmpoAno] = useState(new Date().getFullYear().toString());
  const [bmpoMes, setBmpoMes] = useState((new Date().getMonth() + 1).toString());
  const [bmpoTrimestre, setBmpoTrimestre] = useState("1");
  const [bmpoListaFiltro, setBmpoListaFiltro] = useState("TODAS");

  // Tab 3 (Rastreabilidade) search state
  const [searchLoteQuery, setSearchLoteQuery] = useState("");
  const [selectedLoteNumero, setSelectedLoteNumero] = useState("");

  // Current logged user safely parsed
  let currentUser = { full_name: "Farmacêutico Responsável", crf: "CRF-SP 45.291" };
  try {
    const rawUser = localStorage.getItem("pharma_user");
    if (rawUser) {
      const parsed = JSON.parse(rawUser);
      if (parsed && typeof parsed === "object") {
        currentUser = {
          full_name: parsed.full_name || parsed.nome || parsed.login || "Farmacêutico Responsável",
          crf: parsed.crf || "CRF-SP 45.291"
        };
      }
    }
  } catch (e) {
    console.warn("Erro ao ler pharma_user:", e);
  }

  // Hospital info - Dados oficiais CAIS Clemente Ferreira (Secretaria de Estado da Saúde)
  const rawHospitalCnpj = localStorage.getItem("hospital_cnpj");
  const hospitalCnpj = (rawHospitalCnpj && !rawHospitalCnpj.includes("12.345.678"))
    ? rawHospitalCnpj
    : "46.374.500/0054-04";

  const hospitalInfo = {
    nome: "CAIS CLEMENTE FERREIRA",
    razao_social: "SECRETARIA DE ESTADO DA SAÚDE",
    nome_fantasia: "CAIS-CLEMENTE FERREIRA",
    cnpj: hospitalCnpj,
    unidade: "FARMÁCIA CENTRAL & SATÉLITE",
    cidade: "Lins - SP",
    natureza_juridica: "Órgão Público do Poder Executivo Estadual (102-3)",
    situacao: "ATIVA",
    data_abertura: "26/04/1985",
    tipo_unidade: "FILIAL",
    rt_nome: currentUser.full_name,
    rt_crf: currentUser.crf || "45.291-SP",
    diretor_nome: localStorage.getItem("hospital_diretor_nome") || "Diretoria Técnica de Saúde",
    diretor_crm: localStorage.getItem("hospital_diretor_crm") || "CRM-SP"
  };

  // Garante atualização dos dados reais no localStorage
  useEffect(() => {
    localStorage.setItem("hospital_nome", "CAIS CLEMENTE FERREIRA");
    localStorage.setItem("hospital_cnpj", "46.374.500/0054-04");
    localStorage.setItem("hospital_razao_social", "Secretaria de Estado da Saúde");
    localStorage.setItem("hospital_cidade", "Lins - SP");
  }, []);

  // Safe date helper
  const safeFormatDate = (dateVal, formatPattern = "dd/MM/yyyy HH:mm", fallback = "-") => {
    if (!dateVal) return fallback;
    try {
      let d;
      if (dateVal instanceof Date) {
        d = dateVal;
      } else {
        d = parseISO(String(dateVal));
        if (isNaN(d.getTime())) {
          d = new Date(dateVal);
        }
      }
      if (isNaN(d.getTime())) return String(dateVal);
      return format(d, formatPattern, { locale: ptBR });
    } catch (e) {
      return String(dateVal) || fallback;
    }
  };

  const getSafeDateObj = (dateVal) => {
    if (!dateVal) return new Date();
    try {
      let d = parseISO(String(dateVal));
      if (isNaN(d.getTime())) {
        d = new Date(dateVal);
      }
      if (isNaN(d.getTime())) return new Date();
      return d;
    } catch {
      return new Date();
    }
  };

  // Queries
  const { data: medicamentosRaw = [] } = useQuery({
    queryKey: ['medicamentos'],
    queryFn: () => db.entities.Medicamento.list(),
  });

  const { data: saidasLivroRaw = [] } = useQuery({
    queryKey: ['saidas', 'livro344'],
    queryFn: () => db.entities.Saida.list('-created_date'),
    refetchInterval: 3000
  });

  const { data: entradasLivroRaw = [] } = useQuery({
    queryKey: ['entradas', 'livro344'],
    queryFn: () => db.entities.Entrada.list('-created_date'),
    refetchInterval: 3000
  });

  const { data: lotesRaw = [] } = useQuery({
    queryKey: ['lotes', 'livro344'],
    queryFn: () => db.entities.Lote.list('-created_date'),
  });

  const medicamentos = useMemo(() => Array.isArray(medicamentosRaw) ? medicamentosRaw : [], [medicamentosRaw]);
  const saidasLivro = useMemo(() => Array.isArray(saidasLivroRaw) ? saidasLivroRaw : [], [saidasLivroRaw]);
  const entradasLivro = useMemo(() => Array.isArray(entradasLivroRaw) ? entradasLivroRaw : [], [entradasLivroRaw]);
  const lotes = useMemo(() => Array.isArray(lotesRaw) ? lotesRaw : [], [lotesRaw]);

  // Formatação padrão brasileira (separador de milhar com ponto: 28.774, 300.000, 2.000, etc.)
  const formatQtd = (val) => {
    if (val === undefined || val === null || val === '') return '0';
    const num = Number(val);
    if (isNaN(num)) return String(val);
    return num.toLocaleString('pt-BR');
  };

  // Helper rigoroso para checar se o medicamento está ativo como Adiantamento
  const isAdiantamentoMed = (m) => {
    if (!m) return false;
    const val = m.is_adiantamento;
    return val === true || val === 1 || val === "1" || val === "true" || m.origem === "Adiantamento";
  };

  // Filter only controlled/psychotropic medications
  const medicamentosControlados = useMemo(() => {
    return medicamentos.filter(m => m && (isPsicotropico(m) || m.portaria_344));
  }, [medicamentos]);

  // Contagens de medicamentos por categoria
  const contagensCategorias = useMemo(() => {
    const counts = {
      psicotropicos: 0,
      controle_especial: 0,
      entorpecentes: 0,
      imunossupressores: 0,
      adiantamento: 0,
      todos: medicamentosControlados.length
    };
    medicamentosControlados.forEach(m => {
      if (!m) return;
      const cat = getPortaria344CategoryKey(m);
      if (counts[cat] !== undefined) counts[cat]++;
      if (isAdiantamentoMed(m)) counts.adiantamento++;
    });
    return counts;
  }, [medicamentosControlados]);

  // Medicamentos filtrados pela categoria selecionada
  const medicamentosFiltrados = useMemo(() => {
    let list = medicamentosControlados;
    if (filtroCategoria344 === "psicotropicos") {
      list = medicamentosControlados.filter(m => getPortaria344CategoryKey(m) === "psicotropicos");
    } else if (filtroCategoria344 === "controle_especial") {
      list = medicamentosControlados.filter(m => getPortaria344CategoryKey(m) === "controle_especial");
    } else if (filtroCategoria344 === "entorpecentes") {
      list = medicamentosControlados.filter(m => getPortaria344CategoryKey(m) === "entorpecentes");
    } else if (filtroCategoria344 === "imunossupressores") {
      list = medicamentosControlados.filter(m => getPortaria344CategoryKey(m) === "imunossupressores");
    } else if (filtroCategoria344 === "adiantamento") {
      list = medicamentosControlados.filter(isAdiantamentoMed);
    }
    return [...list].sort((a, b) => (a?.nome || "").localeCompare(b?.nome || ""));
  }, [medicamentosControlados, filtroCategoria344]);

  // Set default selected medication if none selected yet or if current is not in filtered list
  const effectiveSelectedMedId = useMemo(() => {
    if (selectedLivroMedId && medicamentosFiltrados.some(m => String(m.id) === String(selectedLivroMedId))) {
      return String(selectedLivroMedId);
    }
    return medicamentosFiltrados.length > 0 && medicamentosFiltrados[0]?.id ? String(medicamentosFiltrados[0].id) : "";
  }, [selectedLivroMedId, medicamentosFiltrados]);

  const selectedMed = useMemo(() => {
    return medicamentos.find(m => String(m.id) === String(effectiveSelectedMedId)) || null;
  }, [medicamentos, effectiveSelectedMedId]);

  // Movements for Tab 1 (Livro Diário Específico)
  const historicoMovimentos = useMemo(() => {
    if (!effectiveSelectedMedId) return [];

    const entradas = entradasLivro
      .filter(e => String(e.medicamento_id) === String(effectiveSelectedMedId) && (Number(e.quantidade) || 0) > 0)
      .map(e => ({
        ...e,
        tipo: 'ENTRADA',
        dataObj: getSafeDateObj(e.data_entrada || e.created_at)
      }));

    const saidas = saidasLivro
      .filter(s => String(s.medicamento_id) === String(effectiveSelectedMedId) && (Number(s.quantidade) || 0) > 0)
      .map(s => {
        const motivoStr = String(s.motivo || "").toLowerCase();
        const isPerda = s.destino === 'Perda' || s.motivo === 'Perda' || motivoStr.includes('quebra') || motivoStr.includes('perda');
        return {
          ...s,
          tipo: isPerda ? 'PERDA' : 'SAIDA',
          dataObj: getSafeDateObj(s.data_saida || s.created_at)
        };
      });

    const todos = [...entradas, ...saidas].sort((a, b) => {
      const timeA = a.dataObj?.getTime?.() || 0;
      const timeB = b.dataObj?.getTime?.() || 0;
      return timeA - timeB;
    });

    let saldoAtual = 0;
    return todos.map(mov => {
      const qtd = Number(mov.quantidade) || 0;
      if (mov.tipo === 'ENTRADA') saldoAtual += qtd;
      else saldoAtual -= qtd;
      return { ...mov, saldo: saldoAtual };
    });
  }, [effectiveSelectedMedId, entradasLivro, saidasLivro]);

  // Tab 2 (BMPO/BSPO) Calculations
  const bmpoData = useMemo(() => {
    // Determine date range
    let start, end;
    const ano = parseInt(bmpoAno, 10) || new Date().getFullYear();

    if (bmpoPeriodicidade === "mensal") {
      const mes = (parseInt(bmpoMes, 10) || 1) - 1;
      start = startOfMonth(new Date(ano, mes, 1));
      end = endOfMonth(new Date(ano, mes, 1));
    } else if (bmpoPeriodicidade === "trimestral") {
      const tri = parseInt(bmpoTrimestre, 10) || 1;
      const startMonth = (tri - 1) * 3;
      const endMonth = startMonth + 2;
      start = startOfMonth(new Date(ano, startMonth, 1));
      end = endOfMonth(new Date(ano, endMonth, 1));
    } else {
      // anual
      start = new Date(ano, 0, 1);
      end = new Date(ano, 11, 31, 23, 59, 59);
    }

    const startTs = start.getTime();
    const endTs = end.getTime();

    // Iterate through all controlled medications
    return medicamentosControlados
      .filter(med => {
        if (!med) return false;
        if (bmpoListaFiltro === "TODAS") return true;
        const lista = getPortaria344List(med);
        return lista.includes(bmpoListaFiltro);
      })
      .map(med => {
        // Entradas no período
        const entradasNoPeriodo = entradasLivro.filter(e => {
          if (String(e.medicamento_id) !== String(med.id)) return false;
          const dt = getSafeDateObj(e.data_entrada || e.created_at);
          const t = dt.getTime();
          return t >= startTs && t <= endTs;
        });
        const qtdEntradas = entradasNoPeriodo.reduce((acc, cur) => acc + (Number(cur.quantidade) || 0), 0);

        // Saídas comuns no período
        const saidasNoPeriodo = saidasLivro.filter(s => {
          if (String(s.medicamento_id) !== String(med.id)) return false;
          const motivoStr = String(s.motivo || "").toLowerCase();
          const isPerda = s.destino === 'Perda' || s.motivo === 'Perda' || motivoStr.includes('quebra') || motivoStr.includes('perda');
          if (isPerda) return false;
          const dt = getSafeDateObj(s.data_saida || s.created_at);
          const t = dt.getTime();
          return t >= startTs && t <= endTs;
        });
        const qtdSaidas = saidasNoPeriodo.reduce((acc, cur) => acc + (Number(cur.quantidade) || 0), 0);

        // Perdas no período
        const perdasNoPeriodo = saidasLivro.filter(s => {
          if (String(s.medicamento_id) !== String(med.id)) return false;
          const motivoStr = String(s.motivo || "").toLowerCase();
          const isPerda = s.destino === 'Perda' || s.motivo === 'Perda' || motivoStr.includes('quebra') || motivoStr.includes('perda');
          if (!isPerda) return false;
          const dt = getSafeDateObj(s.data_saida || s.created_at);
          const t = dt.getTime();
          return t >= startTs && t <= endTs;
        });
        const qtdPerdas = perdasNoPeriodo.reduce((acc, cur) => acc + (Number(cur.quantidade) || 0), 0);

        // Saldo final atual e cálculo do estoque inicial
        const estoqueFinal = (Number(med.estoque_atual) || 0) + (Number(med.estoque_satelite) || 0);
        // Estoque Inicial = Estoque Final - Entradas + Saídas + Perdas
        const estoqueInicial = Math.max(0, estoqueFinal - qtdEntradas + qtdSaidas + qtdPerdas);

        return {
          id: med.id,
          codigo: med.codigo || "P344",
          nome: med.nome || "Sem Nome",
          concentracao: med.concentracao || "-",
          apresentacao: med.apresentacao || med.unidade_medida || "UN",
          lista: getPortaria344List(med),
          estoqueInicial,
          entradas: qtdEntradas,
          saidas: qtdSaidas,
          perdas: qtdPerdas,
          estoqueFinal
        };
      });
  }, [medicamentosControlados, entradasLivro, saidasLivro, bmpoAno, bmpoMes, bmpoTrimestre, bmpoPeriodicidade, bmpoListaFiltro]);

  // Tab 3 (Rastreabilidade por Lote) Calculations
  // All unique batch numbers available in system
  const allBatchNumbers = useMemo(() => {
    const lotesSet = new Set();
    lotes.forEach(l => { if (l?.numero_lote) lotesSet.add(String(l.numero_lote).trim()); });
    entradasLivro.forEach(e => { if (e?.numero_lote) lotesSet.add(String(e.numero_lote).trim()); });
    saidasLivro.forEach(s => {
      const n = String(s?.numero_lote || "").trim();
      if (n && n !== "ALTA" && n !== "DESCARTE") lotesSet.add(n);
    });
    return Array.from(lotesSet).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [lotes, entradasLivro, saidasLivro]);

  const activeLoteNumber = selectedLoteNumero || (allBatchNumbers.length > 0 ? allBatchNumbers[0] : "");

  const loteTraceData = useMemo(() => {
    if (!activeLoteNumber) return null;

    const activeLoteStr = String(activeLoteNumber).trim();
    const loteObj = lotes.find(l => String(l.numero_lote || "").trim() === activeLoteStr);
    const entradas = entradasLivro.filter(e => String(e.numero_lote || "").trim() === activeLoteStr);
    const saidas = saidasLivro.filter(s => String(s.numero_lote || "").trim() === activeLoteStr);

    // Associated medication
    const medId = loteObj?.medicamento_id || entradas[0]?.medicamento_id || saidas[0]?.medicamento_id;
    const med = medicamentos.find(m => String(m.id) === String(medId)) || {
      nome: entradas[0]?.medicamento_nome || saidas[0]?.medicamento_nome || "Medicamento"
    };

    // Total purchased/entered
    const totalEntrada = entradas.reduce((acc, cur) => acc + (Number(cur.quantidade) || 0), 0) || (Number(loteObj?.quantidade_inicial) || 0);

    // Internal transfers (Central -> Satélite)
    const transferencias = saidas.filter(s =>
      s.motivo === "Transferência de Estoque" ||
      s.destino === "Farmácia Satélite" ||
      String(s.destino || "").includes("Satélite")
    );
    const totalTransferido = transferencias.reduce((acc, cur) => acc + (Number(cur.quantidade) || 0), 0);

    // Patient administrations
    const dispensacoesPacientes = saidas.filter(s => {
      const dest = String(s.destino || "");
      const motivo = String(s.motivo || "").toLowerCase();
      return (
        s.motivo !== "Transferência de Estoque" && 
        s.destino !== "Farmácia Satélite" && 
        s.destino !== "Perda" &&
        s.destino !== "Descarte Especial SNGPC" &&
        !dest.includes("Geral") &&
        !motivo.includes("quebra") &&
        !motivo.includes("perda")
      );
    });
    const totalDispensado = dispensacoesPacientes.reduce((acc, cur) => acc + (Number(cur.quantidade) || 0), 0);

    // Losses & Discards
    const perdasEDescartes = saidas.filter(s => {
      const motivo = String(s.motivo || "").toLowerCase();
      return (
        s.destino === "Perda" || 
        s.motivo === "Perda" || 
        s.destino === "Descarte Especial SNGPC" ||
        motivo.includes("quebra") ||
        motivo.includes("perda")
      );
    });
    const totalPerdas = perdasEDescartes.reduce((acc, cur) => acc + (Number(cur.quantidade) || 0), 0);

    const saldoAtual = loteObj?.quantidade_atual !== undefined ? Number(loteObj.quantidade_atual) : Math.max(0, totalEntrada - totalDispensado - totalPerdas);

    return {
      numero_lote: activeLoteNumber,
      loteObj,
      medicamento: med,
      data_validade: loteObj?.data_validade || entradas[0]?.data_validade || "-",
      fornecedor: loteObj?.fornecedor || entradas[0]?.fornecedor_nome || "Fornecedor Padrão / Distribuidora",
      nota_fiscal: loteObj?.nota_fiscal || entradas[0]?.numero_nota_fiscal || "NF-E Central",
      totalEntrada,
      totalTransferido,
      totalDispensado,
      totalPerdas,
      saldoAtual,
      entradas,
      transferencias,
      dispensacoesPacientes,
      perdasEDescartes
    };
  }, [activeLoteNumber, lotes, entradasLivro, saidasLivro, medicamentos]);

  // Handle registering Loss in Tab 1
  const handleRegistrarPerda = async (e) => {
    e.preventDefault();
    const finalMotivo = perdaMotivoPreset === "Outro" ? perdaMotivoCustom : perdaMotivoPreset;

    if (!perdaQtd || !finalMotivo || !perdaLote) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    try {
      const qtdInt = parseInt(perdaQtd, 10);
      const saidaRes = await db.entities.Saida.create({
        medicamento_id: effectiveSelectedMedId,
        medicamento_nome: selectedMed?.nome || "Controlado",
        quantidade: qtdInt,
        destino: "Perda",
        motivo: finalMotivo,
        responsavel: currentUser.full_name,
        numero_lote: perdaLote,
        data_saida: new Date().toISOString()
      });

      if (selectedMed) {
        await db.entities.Medicamento.update(selectedMed.id, {
          estoque_satelite: Math.max(0, (selectedMed.estoque_satelite || 0) - qtdInt)
        });
      }

      await db.logAction(
        "PERDA_REGISTRADA_344",
        "Saida",
        saidaRes?.id || effectiveSelectedMedId,
        `Perda registrada no Livro 344: ${qtdInt} un de '${selectedMed?.nome}' (Lote: ${perdaLote}). Motivo: ${finalMotivo}`
      );

      toast.success("Perda registrada com sucesso e lançada na auditoria.");
      setIsPerdaModalOpen(false);
      setPerdaQtd(""); setPerdaMotivoPreset(""); setPerdaMotivoCustom(""); setPerdaLote("");
      queryClient.invalidateQueries({ queryKey: ['saidas'] });
      queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
    } catch {
      toast.error("Erro ao registrar perda.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="bg-slate-50 min-h-screen p-4 sm:p-8 font-sans">
      {/* Top Action Bar (No-Print) */}
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 no-print">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-indigo-600" />
              Portaria 344/98 & Rastreabilidade Reversa
            </h1>
            <p className="text-xs text-slate-500">
              Conformidade SNGPC, Livro de Registro, Balanço BMPO/BSPO e Trilha por Lote.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "livro_diario" && (
            <Button
              onClick={() => setIsPerdaModalOpen(true)}
              variant="outline"
              className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 shadow-sm font-semibold text-xs"
            >
              <AlertTriangle className="w-4 h-4" />
              Registrar Quebra / Perda
            </Button>
          )}

          <Button
            onClick={handlePrint}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md font-semibold text-xs"
          >
            <Printer className="w-4 h-4" />
            Imprimir Documento Oficial (A4)
          </Button>
        </div>
      </div>

      {/* Main Tab Navigation (No-Print) */}
      <div className="max-w-6xl mx-auto mb-6 no-print">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-1 md:grid-cols-3 bg-slate-200/80 p-1.5 rounded-xl h-auto gap-1">
            <TabsTrigger value="livro_diario" className="gap-2 font-bold py-2.5 text-xs">
              <Book className="w-4 h-4 text-indigo-600" />
              1. Folha Diária de Registro Específico
            </TabsTrigger>
            <TabsTrigger value="bmpo_bspo" className="gap-2 font-bold py-2.5 text-xs">
              <FileCheck2 className="w-4 h-4 text-emerald-600" />
              2. Fechamento BMPO / BSPO (Anvisa)
            </TabsTrigger>
            <TabsTrigger value="rastreabilidade" className="gap-2 font-bold py-2.5 text-xs">
              <Layers className="w-4 h-4 text-blue-600" />
              3. Rastreabilidade Ponta a Ponta por Lote
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ─── TAB 1: FOLHA DIÁRIA DE REGISTRO ESPECÍFICO ───────────────────────────── */}
      {activeTab === "livro_diario" && (
        <div className="max-w-6xl mx-auto space-y-4">
          {/* Category Filter Bar (No-Print) */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm no-print">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                <Filter className="w-3.5 h-3.5 text-indigo-600" />
                Filtrar Livro por Categoria Portaria 344/98:
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {medicamentosFiltrados.length} medicamento(s) nesta lista
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={filtroCategoria344 === "psicotropicos" ? "default" : "outline"}
                size="sm"
                onClick={() => setFiltroCategoria344("psicotropicos")}
                className={`h-8 text-xs font-bold gap-1.5 transition-all ${
                  filtroCategoria344 === "psicotropicos"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                }`}
              >
                🧠 Psicotrópicos (B1, B2, A3)
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] bg-white/20 text-current">
                  {contagensCategorias.psicotropicos}
                </Badge>
              </Button>

              <Button
                type="button"
                variant={filtroCategoria344 === "controle_especial" ? "default" : "outline"}
                size="sm"
                onClick={() => setFiltroCategoria344("controle_especial")}
                className={`h-8 text-xs font-bold gap-1.5 transition-all ${
                  filtroCategoria344 === "controle_especial"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                }`}
              >
                📋 Controle Especial (C1, C2, C4, C5)
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] bg-white/20 text-current">
                  {contagensCategorias.controle_especial}
                </Badge>
              </Button>

              <Button
                type="button"
                variant={filtroCategoria344 === "entorpecentes" ? "default" : "outline"}
                size="sm"
                onClick={() => setFiltroCategoria344("entorpecentes")}
                className={`h-8 text-xs font-bold gap-1.5 transition-all ${
                  filtroCategoria344 === "entorpecentes"
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-slate-700 hover:bg-rose-50 hover:text-rose-700"
                }`}
              >
                🔴 Entorpecentes (A1, A2)
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] bg-white/20 text-current">
                  {contagensCategorias.entorpecentes}
                </Badge>
              </Button>

              <Button
                type="button"
                variant={filtroCategoria344 === "adiantamento" ? "default" : "outline"}
                size="sm"
                onClick={() => setFiltroCategoria344("adiantamento")}
                className={`h-8 text-xs font-bold gap-1.5 transition-all ${
                  filtroCategoria344 === "adiantamento"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "text-slate-700 hover:bg-amber-50 hover:text-amber-700"
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                💳 Adiantamento (Drogaria)
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] bg-white/20 text-current">
                  {contagensCategorias.adiantamento}
                </Badge>
              </Button>

              <Button
                type="button"
                variant={filtroCategoria344 === "todos" ? "default" : "outline"}
                size="sm"
                onClick={() => setFiltroCategoria344("todos")}
                className={`h-8 text-xs font-bold gap-1.5 transition-all ${
                  filtroCategoria344 === "todos"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Todos ({contagensCategorias.todos})
              </Button>
            </div>
          </div>

          {/* Medication Selector (No-Print) */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between no-print">
            <div className="flex-1 w-full sm:w-auto">
              <Label className="text-xs font-bold text-slate-700 mb-1.5 block">
                Selecione o Medicamento Controlado para o Livro ({medicamentosFiltrados.length} nesta categoria):
              </Label>
              <Select
                value={effectiveSelectedMedId ? String(effectiveSelectedMedId) : undefined}
                onValueChange={(val) => {
                  if (val && val !== "__none__") setSelectedLivroMedId(val);
                }}
              >
                <SelectTrigger className="w-full bg-slate-50 border-slate-300 font-semibold">
                  <SelectValue placeholder="Escolha um medicamento..." />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {medicamentosFiltrados.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      Nenhum medicamento nesta categoria
                    </SelectItem>
                  ) : (
                    medicamentosFiltrados
                      .filter(med => med && med.id)
                      .map(med => (
                        <SelectItem key={String(med.id)} value={String(med.id)}>
                          {med.nome || "Sem nome"} {med.concentracao ? `- ${med.concentracao}` : ""} ({getPortaria344List(med)})
                          {isAdiantamentoMed(med) ? " 💳 [Adiantamento / Drogaria]" : ""}
                        </SelectItem>
                      ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <span className="text-[11px] text-slate-500 font-medium block">Estoque Atual Total</span>
                <span className="text-lg font-black text-indigo-700">
                  {formatQtd((Number(selectedMed?.estoque_atual) || 0) + (Number(selectedMed?.estoque_satelite) || 0))} {selectedMed?.unidade_medida || "UN"}
                </span>
              </div>
            </div>
          </div>

          {/* Card Explicativo de Compra por Adiantamento / Drogaria (No-Print) */}
          {selectedMed && isAdiantamentoMed(selectedMed) && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3.5 shadow-sm flex items-start gap-3 no-print">
              <div className="p-2 rounded-lg bg-amber-500 text-white shrink-0 mt-0.5">
                <CreditCard className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-black text-amber-900 uppercase tracking-wide">
                    Medicamento Adquirido via Adiantamento (Compra Direta em Drogaria / Cartão do Estado)
                  </span>
                  <Badge className="bg-amber-600 text-white text-[10px] font-bold">Adiantamento</Badge>
                </div>
                <p className="text-xs text-amber-800 mt-1">
                  Este controlado foi adquirido em drogaria externa fora do fluxo ordinário de compra pública. No livro oficial, as entradas são identificadas com a origem da Drogaria e comprovante fiscal.
                </p>
                <div className="flex flex-wrap gap-4 mt-2 text-xs font-semibold text-amber-900 bg-white/70 p-2 rounded-lg border border-amber-200">
                  <span>🏪 Drogaria / Fornecedor: <strong className="text-slate-900">{selectedMed.fornecedor_nome || "Drogaria Externa"}</strong></span>
                  {selectedMed.nota_fiscal && <span>📄 NF / Cupom: <strong className="text-slate-900">{selectedMed.nota_fiscal}</strong></span>}
                  {selectedMed.valor_compra && (
                    <span>
                      💰 Valor Compra: <strong className="text-slate-900">
                        R$ {Number(String(selectedMed.valor_compra).replace(',', '.')).toFixed(2)}
                      </strong>
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Folha do Livro Print Area */}
          <div id="livro-print-area" className="border border-slate-200 shadow-xl bg-white p-4 sm:p-8 rounded-sm">
            <div className="text-center mb-6">
              <p className="text-xs font-black uppercase text-slate-600 tracking-widest">{hospitalInfo.nome}</p>
              <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                {hospitalInfo.razao_social} • CNPJ: {hospitalInfo.cnpj} • {hospitalInfo.cidade}
              </p>
              <h1 className="text-xl sm:text-2xl font-black uppercase underline mt-1 mb-2 text-slate-900">
                FOLHA DO LIVRO DE REGISTRO ESPECÍFICO
              </h1>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                Substância / Medicamento: {selectedMed ? `${selectedMed.nome} ${selectedMed.concentracao || ""} ${selectedMed.apresentacao || ""}` : "Selecione um Medicamento"}
              </h2>
              <p className="text-xs mt-1 text-slate-600 font-medium">
                Portaria SVS/MS nº 344/1998 • Classificação: {selectedMed ? getPortaria344List(selectedMed) : "-"}
              </p>
              <p className="text-[11px] text-slate-500 font-semibold">
                Unidade: {hospitalInfo.unidade} • Farmacêutico RT: {hospitalInfo.rt_nome} ({hospitalInfo.rt_crf})
              </p>

              {/* Tag oficial de aquisição se for Adiantamento */}
              {isAdiantamentoMed(selectedMed) && (
                <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-400 rounded text-amber-900 text-[11px] font-black uppercase tracking-wide">
                  <span>★ AQUISIÇÃO: COMPRA EM DROGARIA (VERBA DE ADIANTAMENTO ESTADUAL)</span>
                  {selectedMed.fornecedor_nome ? ` • FORNECEDOR: ${selectedMed.fornecedor_nome}` : ''}
                  {selectedMed.nota_fiscal ? ` • NF: ${selectedMed.nota_fiscal}` : ''}
                  <span>★</span>
                </div>
              )}
            </div>

            <Table className="border-collapse w-full border border-slate-300">
              <TableHeader>
                <TableRow className="bg-slate-100/80">
                  <TableHead className="font-bold text-slate-800 text-center border border-slate-300" colSpan={3}>DATA</TableHead>
                  <TableHead className="font-bold text-slate-800 border border-slate-300" rowSpan={2}>HISTÓRICO / ORIGEM / DESTINO</TableHead>
                  <TableHead className="font-bold text-slate-800 text-center border border-slate-300" colSpan={3}>MOVIMENTO</TableHead>
                  <TableHead className="font-bold text-slate-800 text-center border border-slate-300" rowSpan={2}>ESTOQUE</TableHead>
                  <TableHead className="font-bold text-slate-800 text-center border border-slate-300" rowSpan={2}>ASSINATURA DO RT</TableHead>
                  <TableHead className="font-bold text-slate-800 border border-slate-300" rowSpan={2}>OBSERVAÇÕES & LOTE</TableHead>
                </TableRow>
                <TableRow className="bg-slate-100/80">
                  <TableHead className="font-bold text-slate-800 text-center text-xs w-10 px-1 border border-slate-300">Dia</TableHead>
                  <TableHead className="font-bold text-slate-800 text-center text-xs w-10 px-1 border border-slate-300">Mês</TableHead>
                  <TableHead className="font-bold text-slate-800 text-center text-xs w-12 px-1 border border-slate-300">Ano</TableHead>
                  <TableHead className="font-bold text-slate-800 text-center text-xs w-16 px-1 border border-slate-300 text-emerald-700">Entrada</TableHead>
                  <TableHead className="font-bold text-slate-800 text-center text-xs w-16 px-1 border border-slate-300 text-blue-700">Saída</TableHead>
                  <TableHead className="font-bold text-slate-800 text-center text-xs w-16 px-1 border border-slate-300 text-red-700">Perdas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historicoMovimentos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-10 text-slate-500 italic border border-slate-300">
                      Nenhum registro de movimentação encontrado para este medicamento.
                    </TableCell>
                  </TableRow>
                ) : (
                  historicoMovimentos.map((mov, idx) => {
                    const d = mov.dataObj;
                    const isAdiantamentoEntrada = mov.tipo === 'ENTRADA' && isAdiantamentoMed(selectedMed);

                    return (
                      <TableRow key={idx} className="hover:bg-slate-50">
                        <TableCell className="text-center font-mono text-xs px-1 border border-slate-300 text-slate-700">{String(d.getDate()).padStart(2, '0')}</TableCell>
                        <TableCell className="text-center font-mono text-xs px-1 border border-slate-300 text-slate-700">{String(d.getMonth() + 1).padStart(2, '0')}</TableCell>
                        <TableCell className="text-center font-mono text-xs px-1 border border-slate-300 text-slate-700">{d.getFullYear()}</TableCell>
                        <TableCell className="font-semibold text-slate-800 uppercase text-xs border border-slate-300 pl-2">
                          {mov.tipo === 'ENTRADA' ? (
                            isAdiantamentoEntrada ? (
                              <span className="text-amber-900 font-bold">
                                COMPRA DROGARIA (ADIANTAMENTO)
                                {mov.fornecedor_nome ? ` - ${mov.fornecedor_nome}` : (selectedMed?.fornecedor_nome ? ` - ${selectedMed.fornecedor_nome}` : '')}
                              </span>
                            ) : (
                              mov.fornecedor_nome || 'Almoxarifado Central'
                            )
                          ) : (
                            mov.tipo === 'PERDA' ? 'PERDA / QUEBRA DECLARADA' : (mov.paciente_nome || mov.ala_nome || mov.destino || 'Paciente')
                          )}
                        </TableCell>
                        <TableCell className="text-center font-bold text-emerald-700 bg-emerald-50/50 px-1 border border-slate-300">{mov.tipo === 'ENTRADA' ? formatQtd(mov.quantidade) : '-'}</TableCell>
                        <TableCell className="text-center font-bold text-blue-700 bg-blue-50/50 px-1 border border-slate-300">{mov.tipo === 'SAIDA' ? formatQtd(mov.quantidade) : '-'}</TableCell>
                        <TableCell className="text-center font-bold text-red-700 bg-red-50/50 px-1 border border-slate-300">{mov.tipo === 'PERDA' ? formatQtd(mov.quantidade) : '-'}</TableCell>
                        <TableCell className="text-center font-bold text-slate-900 bg-slate-100/50 border border-slate-300 text-sm">{formatQtd(mov.saldo)}</TableCell>
                        <TableCell className="border border-slate-300 p-0 align-middle text-center">
                          <div className="flex flex-col items-center justify-center w-full py-1">
                            <span className="text-[9px] font-bold text-slate-800 uppercase print:text-[8px]">
                              {currentUser.full_name}
                            </span>
                            <span className="text-[8px] text-slate-600 print:text-[7px]">
                              {currentUser.crf || 'CRF: _______'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-[10px] text-slate-600 min-w-[150px] border border-slate-300 px-2 break-words whitespace-normal">
                          Lote: <span className="font-semibold text-slate-800">{mov.numero_lote || mov.lote || "-"}</span>
                          {isAdiantamentoEntrada && (
                            <span className="block text-amber-800 font-semibold mt-0.5">
                              [Compra Drogaria / Adiantamento{selectedMed?.nota_fiscal ? ` NF: ${selectedMed.nota_fiscal}` : ""}]
                            </span>
                          )}
                          {mov.motivo ? ` | ${mov.motivo}` : ''}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ─── TAB 2: FECHAMENTO BMPO / BSPO ────────────────────────────────────────── */}
      {activeTab === "bmpo_bspo" && (
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Controls Bar (No-Print) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 no-print">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  Configurar Fechamento de Balanço (Portaria 344)
                </h2>
                <p className="text-xs text-slate-500">
                  Gere o BMPO ou BSPO consolidado pronto para aposição de assinaturas com CRM e CRF.
                </p>
              </div>
              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1">
                Conformidade Anvisa & SNGPC
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1 block">Tipo de Relatório</Label>
                <Select value={bmpoTipo} onValueChange={setBmpoTipo}>
                  <SelectTrigger className="bg-slate-50 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BMPO">BMPO (Medicamentos)</SelectItem>
                    <SelectItem value="BSPO">BSPO (Substâncias)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1 block">Periodicidade</Label>
                <Select value={bmpoPeriodicidade} onValueChange={setBmpoPeriodicidade}>
                  <SelectTrigger className="bg-slate-50 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="trimestral">Trimestral</SelectItem>
                    <SelectItem value="anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {bmpoPeriodicidade === "mensal" && (
                <div>
                  <Label className="text-xs font-semibold text-slate-700 mb-1 block">Mês de Referência</Label>
                  <Select value={bmpoMes} onValueChange={setBmpoMes}>
                    <SelectTrigger className="bg-slate-50 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Janeiro</SelectItem>
                      <SelectItem value="2">Fevereiro</SelectItem>
                      <SelectItem value="3">Março</SelectItem>
                      <SelectItem value="4">Abril</SelectItem>
                      <SelectItem value="5">Maio</SelectItem>
                      <SelectItem value="6">Junho</SelectItem>
                      <SelectItem value="7">Julho</SelectItem>
                      <SelectItem value="8">Agosto</SelectItem>
                      <SelectItem value="9">Setembro</SelectItem>
                      <SelectItem value="10">Outubro</SelectItem>
                      <SelectItem value="11">Novembro</SelectItem>
                      <SelectItem value="12">Dezembro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {bmpoPeriodicidade === "trimestral" && (
                <div>
                  <Label className="text-xs font-semibold text-slate-700 mb-1 block">Trimestre</Label>
                  <Select value={bmpoTrimestre} onValueChange={setBmpoTrimestre}>
                    <SelectTrigger className="bg-slate-50 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1º Trimestre (Jan - Mar)</SelectItem>
                      <SelectItem value="2">2º Trimestre (Abr - Jun)</SelectItem>
                      <SelectItem value="3">3º Trimestre (Jul - Set)</SelectItem>
                      <SelectItem value="4">4º Trimestre (Out - Dez)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1 block">Ano de Exercício</Label>
                <Input
                  type="number"
                  value={bmpoAno}
                  onChange={e => setBmpoAno(e.target.value)}
                  className="bg-slate-50 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1 block">Filtro de Lista 344</Label>
                <Select value={bmpoListaFiltro} onValueChange={setBmpoListaFiltro}>
                  <SelectTrigger className="bg-slate-50 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODAS">Todas as Listas</SelectItem>
                    <SelectItem value="A1">Lista A1 / A2 (Entorpecentes)</SelectItem>
                    <SelectItem value="B1">Lista A3 / B1 / B2 (Psicotrópicos)</SelectItem>
                    <SelectItem value="C1">Lista C1 (Controle Especial)</SelectItem>
                    <SelectItem value="C3">Lista C3 (Imunossupressores)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Official Printable BMPO Document */}
          <div className="bg-white p-6 sm:p-10 border border-slate-300 shadow-xl rounded-sm print:p-0 print:border-none print:shadow-none">
            {/* Header Oficial Anvisa */}
            <div className="border-b-2 border-slate-900 pb-4 mb-6">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-black uppercase text-slate-900 tracking-tight">
                    {bmpoTipo === "BMPO" ? "BALANÇO DE MEDICAMENTOS PSICOTRÓPICOS E OUTROS (BMPO)" : "BALANÇO DE SUBSTÂNCIAS PSICOTRÓPICAS E OUTRAS (BSPO)"}
                  </h1>
                  <p className="text-xs text-slate-600 font-bold uppercase mt-0.5">
                    Portaria SVS/MS nº 344/1998 • RDC ANVISA nº 22/2014
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block bg-slate-900 text-white font-mono text-xs font-bold px-2.5 py-1 rounded">
                    {bmpoPeriodicidade === "mensal" ? `MÊS: ${String(bmpoMes).padStart(2, '0')}/${bmpoAno}` :
                     bmpoPeriodicidade === "trimestral" ? `${bmpoTrimestre}º TRIMESTRE/${bmpoAno}` : `ANO: ${bmpoAno}`}
                  </span>
                </div>
              </div>

              {/* Informações do Estabelecimento */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-3 border-t border-slate-200 text-xs text-slate-700">
                <div>
                  <span className="font-bold text-slate-900 block">ESTABELECIMENTO:</span>
                  <span className="font-black text-slate-900 block">{hospitalInfo.nome}</span>
                  <span className="text-[10px] text-slate-500 block font-semibold">{hospitalInfo.razao_social}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-900 block">CNPJ:</span>
                  <span className="font-mono font-black text-slate-900 block">{hospitalInfo.cnpj}</span>
                  <span className="text-[10px] text-slate-500 block">Situação: {hospitalInfo.situacao} ({hospitalInfo.tipo_unidade})</span>
                </div>
                <div>
                  <span className="font-bold text-slate-900 block">UNIDADE / LOCAL:</span>
                  <span className="font-semibold text-slate-800 block">{hospitalInfo.unidade}</span>
                  <span className="text-[10px] text-slate-500 block">Desde {hospitalInfo.data_abertura}</span>
                </div>
                <div>
                  <span className="font-bold text-slate-900 block">CIDADE / UF:</span>
                  <span className="font-semibold text-slate-800 block">{hospitalInfo.cidade}</span>
                  <span className="text-[10px] text-slate-500 block">{hospitalInfo.natureza_juridica}</span>
                </div>
              </div>
            </div>

            {/* BMPO Table */}
            <Table className="border-collapse w-full border border-slate-400 text-xs">
              <TableHeader>
                <TableRow className="bg-slate-100 font-black text-slate-900 border-b border-slate-400">
                  <TableHead className="border border-slate-400 text-center w-12 py-2">Item</TableHead>
                  <TableHead className="border border-slate-400 py-2">Substância / Nome Comercial</TableHead>
                  <TableHead className="border border-slate-400 py-2 text-center w-24">Lista 344</TableHead>
                  <TableHead className="border border-slate-400 py-2 text-center w-28">Apresentação</TableHead>
                  <TableHead className="border border-slate-400 py-2 text-center w-20">Est. Inicial</TableHead>
                  <TableHead className="border border-slate-400 py-2 text-center w-20 text-emerald-800">Entradas</TableHead>
                  <TableHead className="border border-slate-400 py-2 text-center w-20 text-blue-800">Saídas</TableHead>
                  <TableHead className="border border-slate-400 py-2 text-center w-20 text-red-800">Perdas</TableHead>
                  <TableHead className="border border-slate-400 py-2 text-center w-24 bg-slate-200 font-black">Est. Final</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bmpoData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-slate-500 italic border border-slate-400">
                      Nenhuma substância controlada encontrada no período selecionado.
                    </TableCell>
                  </TableRow>
                ) : (
                  bmpoData.map((item, idx) => (
                    <TableRow key={item.id} className="border-b border-slate-300 hover:bg-slate-50">
                      <TableCell className="text-center font-mono font-bold border border-slate-400">{idx + 1}</TableCell>
                      <TableCell className="font-bold text-slate-900 uppercase border border-slate-400">
                        {item.nome}
                        <span className="text-[10px] text-slate-500 font-normal block">{item.concentracao}</span>
                      </TableCell>
                      <TableCell className="text-center text-[10px] font-semibold border border-slate-400">{item.lista}</TableCell>
                      <TableCell className="text-center text-[11px] border border-slate-400">{item.apresentacao}</TableCell>
                      <TableCell className="text-center font-bold border border-slate-400">{formatQtd(item.estoqueInicial)}</TableCell>
                      <TableCell className="text-center font-bold text-emerald-700 bg-emerald-50/30 border border-slate-400">{formatQtd(item.entradas)}</TableCell>
                      <TableCell className="text-center font-bold text-blue-700 bg-blue-50/30 border border-slate-400">{formatQtd(item.saidas)}</TableCell>
                      <TableCell className="text-center font-bold text-red-700 bg-red-50/30 border border-slate-400">{formatQtd(item.perdas)}</TableCell>
                      <TableCell className="text-center font-black text-slate-900 bg-slate-100 border border-slate-400 text-sm">{formatQtd(item.estoqueFinal)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* Termo de Encerramento e Assinaturas (Pronto para Assinar) */}
            <div className="mt-8 pt-6 border-t border-slate-300">
              <p className="text-xs text-slate-600 text-justify leading-relaxed mb-8">
                <strong>TERMO DE RESPONSABILIDADE:</strong> Declaramos sob as penas da lei que as informações constantes
                deste balanço correspondem com fidelidade às movimentações físicas de estoque, prescrições e registros mantidos
                sob nossa responsabilidade técnica durante o período indicado, em total obediência às determinações da Portaria
                SVS/MS nº 344/1998 e normas complementares da ANVISA e Vigilância Sanitária local.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-12 text-center pt-8">
                <div>
                  <div className="w-4/5 mx-auto border-b border-slate-900 mb-2"></div>
                  <p className="font-bold text-xs uppercase text-slate-900">{hospitalInfo.rt_nome}</p>
                  <p className="text-[11px] text-slate-600 font-semibold">Farmacêutico(a) Responsável Técnico</p>
                  <p className="text-[10px] text-slate-500 font-mono">CRF: {hospitalInfo.rt_crf}</p>
                </div>

                <div>
                  <div className="w-4/5 mx-auto border-b border-slate-900 mb-2"></div>
                  <p className="font-bold text-xs uppercase text-slate-900">{hospitalInfo.diretor_nome}</p>
                  <p className="text-[11px] text-slate-600 font-semibold">Diretor(a) Clínico / Técnico do Hospital</p>
                  <p className="text-[10px] text-slate-500 font-mono">CRM: {hospitalInfo.diretor_crm}</p>
                </div>
              </div>

              <div className="mt-8 text-center text-[10px] text-slate-400 font-mono">
                Emitido eletronicamente via Sistema ZORION SAÚDE em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: RASTREABILIDADE REVERSA POR LOTE ──────────────────────────────── */}
      {activeTab === "rastreabilidade" && (
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Batch Search Box (No-Print) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 no-print">
            <div className="flex flex-col md:flex-row gap-4 items-end">
              <div className="flex-1 w-full">
                <Label className="text-xs font-bold text-slate-700 mb-1.5 block">
                  Digite ou Selecione o Número do Lote para Rastrear:
                </Label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <Input
                    placeholder="Ex: LOTE2026-A, ABC1234..."
                    value={searchLoteQuery}
                    onChange={e => {
                      const val = e.target.value;
                      setSearchLoteQuery(val);
                      if (val) {
                        const found = allBatchNumbers.find(b => String(b || "").toLowerCase().includes(val.toLowerCase()));
                        if (found) setSelectedLoteNumero(found);
                      }
                    }}
                    className="pl-9 font-mono font-semibold uppercase bg-slate-50"
                  />
                </div>
              </div>

              <div className="w-full md:w-72">
                <Label className="text-xs font-bold text-slate-700 mb-1.5 block">
                  Lotes Cadastrados no Sistema:
                </Label>
                <Select
                  value={activeLoteNumber ? String(activeLoteNumber) : undefined}
                  onValueChange={(val) => {
                    if (val && val !== "__none__") {
                      setSelectedLoteNumero(val);
                      setSearchLoteQuery(val);
                    }
                  }}
                >
                  <SelectTrigger className="font-mono bg-slate-50 font-bold">
                    <SelectValue placeholder="Selecione um lote..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {allBatchNumbers.length === 0 ? (
                      <SelectItem value="__none__" disabled>
                        Nenhum lote registrado
                      </SelectItem>
                    ) : (
                      allBatchNumbers.map(loteNum => (
                        <SelectItem key={String(loteNum)} value={String(loteNum)} className="font-mono">
                          {loteNum}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Traceability Dashboard & Dossier */}
          {loteTraceData ? (
            <div className="space-y-6">
              {/* Batch Metadata Header */}
              <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-lg">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-indigo-900/60 pb-4 mb-4">
                  <div>
                    <span className="text-indigo-400 text-xs font-bold tracking-widest uppercase block mb-1">
                      DOSSIÊ DE RASTREABILIDADE REVERSA
                    </span>
                    <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
                      Lote: <span className="font-mono text-amber-400 bg-amber-400/10 px-3 py-0.5 rounded-lg border border-amber-400/30">{loteTraceData.numero_lote}</span>
                    </h2>
                    <p className="text-sm text-slate-300 mt-1 font-semibold">
                      Medicamento: {loteTraceData.medicamento?.nome || "Medicamento"} {loteTraceData.medicamento?.concentracao ? `(${loteTraceData.medicamento?.concentracao})` : ""}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs px-3 py-1 font-bold">
                      Validade: {loteTraceData.data_validade || "Sem data"}
                    </Badge>
                    <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/40 text-xs px-3 py-1 font-bold">
                      NF: {loteTraceData.nota_fiscal || "-"}
                    </Badge>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 text-center">
                  <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">1. Entrada / Comprado</span>
                    <span className="text-xl font-black text-emerald-400">{formatQtd(loteTraceData.totalEntrada)} un</span>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">2. Transferido Satélite</span>
                    <span className="text-xl font-black text-cyan-400">{formatQtd(loteTraceData.totalTransferido)} un</span>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">3. Ministrado a Pacientes</span>
                    <span className="text-xl font-black text-indigo-300">{formatQtd(loteTraceData.totalDispensado)} un</span>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">4. Perdas / Descartes</span>
                    <span className="text-xl font-black text-red-400">{formatQtd(loteTraceData.totalPerdas)} un</span>
                  </div>
                  <div className="bg-white/10 p-3 rounded-xl border border-indigo-400/40 col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-amber-300 uppercase font-bold block">Saldo Remanescente</span>
                    <span className="text-xl font-black text-amber-300">{formatQtd(loteTraceData.saldoAtual)} un</span>
                  </div>
                </div>
              </div>

              {/* End-to-End Timeline */}
              <div className="space-y-4">
                {/* 1. Entrada / Fornecedor */}
                <Card className="border-l-4 border-l-emerald-500 shadow-sm">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-3 text-emerald-700 font-bold text-sm uppercase">
                      <CheckCircle2 className="w-5 h-5" />
                      Etapa 1: Origem & Entrada no Almoxarifado (NF de Compra)
                    </div>
                    {loteTraceData.entradas.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">Entrada registrada via implantação inicial de lote.</p>
                    ) : (
                      <div className="space-y-2">
                        {loteTraceData.entradas.map((ent, idx) => (
                          <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs grid grid-cols-1 sm:grid-cols-4 gap-2">
                            <div>
                              <span className="text-slate-400 font-semibold block">Data Entrada:</span>
                              <span className="font-mono font-bold text-slate-800">{safeFormatDate(ent.data_entrada || ent.created_at)}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-semibold block">Fornecedor:</span>
                              <span className="font-bold text-slate-800">{ent.fornecedor_nome || loteTraceData.fornecedor}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-semibold block">Nota Fiscal (NF):</span>
                              <span className="font-mono font-bold text-slate-800">{ent.numero_nota_fiscal || loteTraceData.nota_fiscal}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-semibold block">Quantidade Recebida:</span>
                              <span className="font-bold text-emerald-700">{formatQtd(ent.quantidade)} unidades</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 2. Transferências Internas */}
                <Card className="border-l-4 border-l-cyan-500 shadow-sm">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-3 text-cyan-700 font-bold text-sm uppercase">
                      <RefreshCw className="w-5 h-5" />
                      Etapa 2: Transferências Internas (Almoxarifado Geral → Farmácia Satélite)
                    </div>
                    {loteTraceData.transferencias.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">Nenhuma transferência interna específica registrada para este lote.</p>
                    ) : (
                      <div className="space-y-2">
                        {loteTraceData.transferencias.map((tr, idx) => (
                          <div key={idx} className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs grid grid-cols-1 sm:grid-cols-4 gap-2">
                            <div>
                              <span className="text-slate-400 font-semibold block">Data Movimento:</span>
                              <span className="font-mono font-bold text-slate-800">{safeFormatDate(tr.data_saida || tr.created_at)}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-semibold block">Destino:</span>
                              <span className="font-bold text-cyan-800">{tr.destino || "Farmácia Satélite"}</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-semibold block">Quantidade Transferida:</span>
                              <span className="font-bold text-cyan-700">{formatQtd(tr.quantidade)} unidades</span>
                            </div>
                            <div>
                              <span className="text-slate-400 font-semibold block">Responsável:</span>
                              <span className="font-medium text-slate-700">{tr.responsavel || "Almoxarifado"}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 3. Pacientes que Receberam Doses Deste Lote */}
                <Card className="border-l-4 border-l-indigo-600 shadow-sm">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-indigo-700 font-bold text-sm uppercase">
                        <User className="w-5 h-5" />
                        Etapa 3: Pacientes que Receberam Doses Deste Lote Exato ({loteTraceData.dispensacoesPacientes.length})
                      </div>
                      <Badge className="bg-indigo-100 text-indigo-800 border-none font-bold text-xs">
                        Total Ministrado: {formatQtd(loteTraceData.totalDispensado)} un
                      </Badge>
                    </div>

                    {loteTraceData.dispensacoesPacientes.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">Nenhum paciente recebeu doses deste lote até o momento.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table className="border-collapse w-full border border-slate-200 text-xs">
                          <TableHeader>
                            <TableRow className="bg-slate-100">
                              <TableHead className="font-bold text-slate-800 py-2">Data/Hora</TableHead>
                              <TableHead className="font-bold text-slate-800 py-2">Paciente</TableHead>
                              <TableHead className="font-bold text-slate-800 py-2">Ala / Leito</TableHead>
                              <TableHead className="font-bold text-slate-800 py-2 text-center">Dose / Qtd</TableHead>
                              <TableHead className="font-bold text-slate-800 py-2">Motivo / Prescrição</TableHead>
                              <TableHead className="font-bold text-slate-800 py-2">Responsável</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {loteTraceData.dispensacoesPacientes.map((disp, idx) => (
                              <TableRow key={idx} className="hover:bg-slate-50">
                                <TableCell className="font-mono text-slate-600 whitespace-nowrap">
                                  {safeFormatDate(disp.data_saida || disp.created_at)}
                                </TableCell>
                                <TableCell className="font-bold text-slate-900">
                                  {disp.paciente_nome || disp.destino?.replace("Paciente ", "") || "Paciente"}
                                </TableCell>
                                <TableCell className="font-semibold text-slate-700">
                                  {disp.ala_nome || "Ala Geral"}
                                </TableCell>
                                <TableCell className="text-center font-bold text-indigo-700 bg-indigo-50/50">
                                  {formatQtd(disp.quantidade)} un
                                </TableCell>
                                <TableCell className="text-slate-600 max-w-xs truncate" title={disp.motivo || disp.observacao}>
                                  {disp.motivo || disp.observacao || "Prescrição regular"}
                                </TableCell>
                                <TableCell className="text-slate-700 font-medium">
                                  {disp.responsavel || currentUser.full_name}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 4. Perdas, Quebras ou Descartes */}
                <Card className="border-l-4 border-l-red-500 shadow-sm">
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-center gap-2 mb-3 text-red-700 font-bold text-sm uppercase">
                      <AlertTriangle className="w-5 h-5" />
                      Etapa 4: Ocorrências de Perdas, Quebras de Ampola ou Descartes
                    </div>
                    {loteTraceData.perdasEDescartes.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">Nenhuma perda, quebra ou descarte registrado para este lote.</p>
                    ) : (
                      <div className="space-y-2">
                        {loteTraceData.perdasEDescartes.map((p, idx) => (
                          <div key={idx} className="bg-red-50/50 p-3 rounded-lg border border-red-200 text-xs grid grid-cols-1 sm:grid-cols-4 gap-2">
                            <div>
                              <span className="text-red-400 font-semibold block">Data do Registro:</span>
                              <span className="font-mono font-bold text-slate-800">{safeFormatDate(p.data_saida || p.created_at)}</span>
                            </div>
                            <div>
                              <span className="text-red-400 font-semibold block">Motivo Declarado:</span>
                              <span className="font-bold text-red-800">{p.motivo || "Perda operacional"}</span>
                            </div>
                            <div>
                              <span className="text-red-400 font-semibold block">Quantidade Perdida:</span>
                              <span className="font-bold text-red-700">{formatQtd(p.quantidade)} unidades</span>
                            </div>
                            <div>
                              <span className="text-red-400 font-semibold block">Responsável:</span>
                              <span className="font-medium text-slate-700">{p.responsavel || currentUser.full_name}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="bg-white p-12 text-center rounded-2xl border border-dashed border-slate-300 text-slate-500">
              <Layers className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="font-semibold text-slate-700">Nenhum lote selecionado para rastreabilidade.</p>
              <p className="text-xs text-slate-400 mt-1">Selecione ou digite um número de lote no campo acima.</p>
            </div>
          )}
        </div>
      )}

      {/* Print Styles for Official A4 Pages */}
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          body, html, #root {
            height: auto !important;
            min-height: auto !important;
            display: block !important;
            overflow: visible !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            background-color: white !important;
          }
          div, main {
            display: block !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }
          .no-print, .fixed, nav, header, footer, button, aside, [data-sonner-toaster], [role="status"] { display: none !important; }
          .p-4, .sm\\:p-8 { padding: 0 !important; }
          .max-w-6xl { max-width: 100% !important; border: none !important; box-shadow: none !important; margin: 0 !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border: 1px solid #64748b !important; }
          .bg-slate-100 { background-color: #f1f5f9 !important; }
          .bg-emerald-50\\/50, .bg-emerald-50\\/30 { background-color: #ecfdf5 !important; }
          .bg-blue-50\\/50, .bg-blue-50\\/30 { background-color: #eff6ff !important; }
          .bg-red-50\\/50 { background-color: #fef2f2 !important; }
        }
      `}</style>

      {/* Dialog: Registrar Quebra / Perda */}
      <Dialog open={isPerdaModalOpen} onOpenChange={setIsPerdaModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Registrar Quebra / Perda (Portaria 344)
            </DialogTitle>
            <DialogDescription>
              A perda será deduzida imediatamente do estoque e gravada na Trilha de Auditoria SNGPC.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRegistrarPerda} className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Quantidade Perdida</Label>
                <Input type="number" min="1" value={perdaQtd} onChange={e => setPerdaQtd(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Número do Lote</Label>
                <Input value={perdaLote} onChange={e => setPerdaLote(e.target.value)} placeholder="Obrigatório" required />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Motivo da Quebra / Perda</Label>
              <Select value={perdaMotivoPreset} onValueChange={setPerdaMotivoPreset} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Quebra de ampola / frasco">Quebra de ampola / frasco</SelectItem>
                  <SelectItem value="Vencimento / Descarte">Vencimento / Descarte</SelectItem>
                  <SelectItem value="Extravio">Extravio</SelectItem>
                  <SelectItem value="Danificado / Embalagem rompida">Danificado / Embalagem rompida</SelectItem>
                  <SelectItem value="Outro">Outro motivo...</SelectItem>
                </SelectContent>
              </Select>
              {perdaMotivoPreset === "Outro" && (
                <Input
                  value={perdaMotivoCustom}
                  onChange={e => setPerdaMotivoCustom(e.target.value)}
                  placeholder="Especifique o motivo exato..."
                  required
                  className="mt-2 text-xs"
                />
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Farmacêutico Responsável</Label>
              <Input value={currentUser.full_name} disabled className="bg-slate-100 text-slate-600 text-xs" />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsPerdaModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-bold">
                Confirmar e Gravar no Livro
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
