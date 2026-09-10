import React, { useState, useMemo } from "react";
import { db } from "@/api/db";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Printer,
  Search,
  CreditCard,
  Users,
  Pill,
  Building2,
  ChevronDown,
  ChevronRight,
  FileText,
  Clock,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  format,
  parseISO,
  isValid,
  subDays,
  startOfMonth,
  endOfMonth,
  startOfDay,
  endOfDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";

export default function SateliteAdiantamento() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMedId, setSelectedMedId] = useState("all");
  const [selectedAla, setSelectedAla] = useState("all");
  const [periodo, setPeriodo] = useState("todos"); // 'hoje', '7dias', '30dias', 'mes', 'todos', 'custom'
  const [customInicio, setCustomInicio] = useState(
    format(startOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [customFim, setCustomFim] = useState(
    format(endOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [viewMode, setViewMode] = useState("pacientes"); // 'pacientes' | 'extrato'
  const [expandedPatients, setExpandedPatients] = useState({});

  // Carregar dados das entidades
  const { data: medicamentos = [], isLoading: loadingMeds } = useQuery({
    queryKey: ["medicamentos"],
    queryFn: () => db.entities.Medicamento.list(),
  });

  const { data: pacientes = [], isLoading: loadingPacientes } = useQuery({
    queryKey: ["pacientes"],
    queryFn: () => db.entities.Paciente.list(),
  });

  const { data: prescricoes = [], isLoading: loadingPresc } = useQuery({
    queryKey: ["prescricoes_paciente"],
    queryFn: () => db.entities.PrescricaoPaciente.list(),
  });

  const { data: saidas = [], isLoading: loadingSaidas } = useQuery({
    queryKey: ["saidas"],
    queryFn: () => db.entities.Saida.list("-created_date"),
  });

  const { data: alas = [] } = useQuery({
    queryKey: ["alas"],
    queryFn: () => db.entities.Ala.list(),
  });

  const isLoading =
    loadingMeds || loadingPacientes || loadingPresc || loadingSaidas;

  // Medicamentos marcados como adiantamento
  const adiantamentoMeds = useMemo(() => {
    return medicamentos.filter(
      (m) =>
        m.is_adiantamento === true ||
        m.is_adiantamento === "true" ||
        m.is_adiantamento === 1
    );
  }, [medicamentos]);

  const adiantamentoMedsMap = useMemo(() => {
    const map = new Map();
    adiantamentoMeds.forEach((m) => {
      map.set(m.id, m);
      if (m.nome) {
        map.set(m.nome.toLowerCase().trim(), m);
      }
    });
    return map;
  }, [adiantamentoMeds]);

  // Intervalo de datas
  const dateRange = useMemo(() => {
    const hoje = new Date();
    if (periodo === "hoje") {
      return { from: startOfDay(hoje), to: endOfDay(hoje) };
    }
    if (periodo === "7dias") {
      return { from: startOfDay(subDays(hoje, 7)), to: endOfDay(hoje) };
    }
    if (periodo === "30dias") {
      return { from: startOfDay(subDays(hoje, 30)), to: endOfDay(hoje) };
    }
    if (periodo === "mes") {
      return { from: startOfMonth(hoje), to: endOfMonth(hoje) };
    }
    if (periodo === "custom") {
      const di = parseISO(customInicio);
      const df = parseISO(customFim);
      return {
        from: isValid(di) ? startOfDay(di) : null,
        to: isValid(df) ? endOfDay(df) : null,
      };
    }
    return { from: null, to: null };
  }, [periodo, customInicio, customFim]);

  // Todas as saídas relacionadas a medicamentos de adiantamento
  const adiantamentoSaidas = useMemo(() => {
    return saidas.filter((s) => {
      // Verifica se o medicamento é de adiantamento
      const isMedAdiantamento =
        adiantamentoMedsMap.has(s.medicamento_id) ||
        (s.medicamento_nome &&
          adiantamentoMedsMap.has(s.medicamento_nome.toLowerCase().trim())) ||
        (s.motivo && s.motivo.toLowerCase().includes("adiantamento")) ||
        (s.observacao && s.observacao.toLowerCase().includes("adiantamento"));

      if (!isMedAdiantamento) return false;

      // Filtro de data
      if (dateRange.from && dateRange.to && s.data_saida) {
        try {
          const d = parseISO(s.data_saida);
          if (isValid(d)) {
            if (d < dateRange.from || d > dateRange.to) return false;
          }
        } catch {
          // segue em caso de parse falhar
        }
      }

      // Filtro por medicamento específico
      if (selectedMedId !== "all" && s.medicamento_id !== selectedMedId) {
        return false;
      }

      return true;
    });
  }, [saidas, adiantamentoMedsMap, dateRange, selectedMedId]);

  // Prescrições de medicamentos de adiantamento
  const adiantamentoPrescricoes = useMemo(() => {
    return prescricoes.filter((pr) => {
      const medId = pr.medicamentoId || pr.medicamento_id;
      const medNome = pr.medicamentoNome || pr.medicamento_nome;
      const isMedAdiantamento =
        adiantamentoMedsMap.has(medId) ||
        (medNome && adiantamentoMedsMap.has(medNome.toLowerCase().trim()));

      if (!isMedAdiantamento) return false;

      if (selectedMedId !== "all" && medId !== selectedMedId) {
        return false;
      }

      return true;
    });
  }, [prescricoes, adiantamentoMedsMap, selectedMedId]);

  // Mapeamento consolidado de pacientes que tomaram ou têm prescrição de adiantamento
  const pacientesRelatorio = useMemo(() => {
    const map = new Map();

    // 1. Processar Saídas com paciente identificado
    adiantamentoSaidas.forEach((s) => {
      const pacNome =
        s.paciente_nome ||
        (s.destino && s.destino.startsWith("Paciente ")
          ? s.destino.replace("Paciente ", "").split("(")[0].trim()
          : s.destino) ||
        "Não Especificado";

      // Ignora transferências se não forem direcionadas a paciente
      if (
        s.motivo === "Transferência de Estoque" ||
        s.destino === "Estoque Satélite"
      ) {
        return;
      }

      const key = pacNome.toLowerCase().trim();
      if (!map.has(key)) {
        const pacObj = pacientes.find(
          (p) =>
            p.nome?.toLowerCase().trim() === key ||
            p.id === s.paciente_id ||
            p.id === s.pacienteId
        );

        map.set(key, {
          key,
          pacienteId: pacObj?.id || null,
          nome: pacObj?.nome || pacNome,
          prontuario: pacObj?.prontuario || "—",
          alaNome: pacObj?.alaNome || s.ala_nome || "Geral",
          leito: pacObj?.leito || "—",
          status: pacObj?.status || "Ativo",
          medicamentos: new Map(),
          totalDosesMinistradas: 0,
          primeiraDose: null,
          ultimaDose: null,
        });
      }

      const entry = map.get(key);
      const med =
        adiantamentoMedsMap.get(s.medicamento_id) ||
        adiantamentoMedsMap.get(s.medicamento_nome?.toLowerCase().trim()) || {
          id: s.medicamento_id,
          nome: s.medicamento_nome || "Medicamento de Adiantamento",
        };

      const medKey = med.id || med.nome;
      if (!entry.medicamentos.has(medKey)) {
        entry.medicamentos.set(medKey, {
          med,
          totalDoses: 0,
          saidas: [],
        });
      }

      const medItem = entry.medicamentos.get(medKey);
      const qtd = Number(s.quantidade || 0);
      medItem.totalDoses += qtd;
      medItem.saidas.push(s);
      entry.totalDosesMinistradas += qtd;

      // Datas
      if (s.data_saida) {
        if (!entry.primeiraDose || s.data_saida < entry.primeiraDose) {
          entry.primeiraDose = s.data_saida;
        }
        if (!entry.ultimaDose || s.data_saida > entry.ultimaDose) {
          entry.ultimaDose = s.data_saida;
        }
      }
    });

    // 2. Processar Prescrições de Adiantamento
    adiantamentoPrescricoes.forEach((pr) => {
      const pacId = pr.pacienteId || pr.paciente_id;
      const pacNome = pr.pacienteNome || pr.paciente_nome;
      const pacObj = pacientes.find(
        (p) => p.id === pacId || p.nome?.toLowerCase().trim() === pacNome?.toLowerCase().trim()
      );

      const nomeFinal = pacObj?.nome || pacNome || "Paciente sem nome";
      const key = nomeFinal.toLowerCase().trim();

      if (!map.has(key)) {
        map.set(key, {
          key,
          pacienteId: pacObj?.id || pacId,
          nome: nomeFinal,
          prontuario: pacObj?.prontuario || pr.prontuario || "—",
          alaNome: pacObj?.alaNome || pr.alaNome || "Geral",
          leito: pacObj?.leito || pr.leito || "—",
          status: pacObj?.status || "Ativo",
          medicamentos: new Map(),
          totalDosesMinistradas: 0,
          primeiraDose: null,
          ultimaDose: null,
        });
      }

      const entry = map.get(key);
      const medId = pr.medicamentoId || pr.medicamento_id;
      const med =
        adiantamentoMedsMap.get(medId) ||
        adiantamentoMedsMap.get(pr.medicamentoNome?.toLowerCase().trim()) || {
          id: medId,
          nome: pr.medicamentoNome || "Medicamento de Adiantamento",
        };

      const medKey = med.id || med.nome;
      if (!entry.medicamentos.has(medKey)) {
        entry.medicamentos.set(medKey, {
          med,
          totalDoses: 0,
          saidas: [],
        });
      }

      const medItem = entry.medicamentos.get(medKey);
      medItem.prescricao = pr;
    });

    return Array.from(map.values()).map((p) => ({
      ...p,
      medicamentosList: Array.from(p.medicamentos.values()),
    }));
  }, [adiantamentoSaidas, adiantamentoPrescricoes, pacientes, adiantamentoMedsMap]);

  // Filtros aplicados à lista consolidada de pacientes
  const filteredPacientes = useMemo(() => {
    return pacientesRelatorio.filter((p) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchNome = p.nome?.toLowerCase().includes(term);
        const matchProntuario = p.prontuario?.toLowerCase().includes(term);
        const matchMed = p.medicamentosList.some((m) =>
          m.med?.nome?.toLowerCase().includes(term)
        );
        if (!matchNome && !matchProntuario && !matchMed) return false;
      }

      if (selectedAla !== "all") {
        if (p.alaNome?.toLowerCase() !== selectedAla.toLowerCase()) {
          return false;
        }
      }

      return true;
    });
  }, [pacientesRelatorio, searchTerm, selectedAla]);

  const totalPacientes = filteredPacientes.length;
  const totalDosesTomadas = useMemo(() => {
    return filteredPacientes.reduce((acc, p) => acc + p.totalDosesMinistradas, 0);
  }, [filteredPacientes]);

  const uniqueMedsUsados = useMemo(() => {
    const medSet = new Set();
    filteredPacientes.forEach((p) => {
      p.medicamentosList.forEach((m) => {
        if (m.med?.nome) medSet.add(m.med.nome);
      });
    });
    return medSet.size;
  }, [filteredPacientes]);

  const alasEnvolvidas = useMemo(() => {
    const alaSet = new Set();
    filteredPacientes.forEach((p) => {
      if (p.alaNome) alaSet.add(p.alaNome);
    });
    return alaSet.size;
  }, [filteredPacientes]);

  const toggleExpand = (key) => {
    setExpandedPatients((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 p-4 sm:p-8 bg-slate-50/50 dark:bg-slate-950 min-h-full print:bg-white print:p-0">
      {/* Estilos específicos de Impressão A4 */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body, html, #root {
            height: auto !important;
            min-height: auto !important;
            display: block !important;
            overflow: visible !important;
            background-color: white !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .no-print, nav, header, footer, button, aside, .sidebar {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          .table-print {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          .table-print th, .table-print td {
            border: 1px solid #cbd5e1 !important;
            padding: 6px 8px !important;
            font-size: 11px !important;
          }
          .table-print th {
            background-color: #f8fafc !important;
            font-weight: bold !important;
          }
        }
        @media screen {
          .print-only {
            display: none !important;
          }
        }
      `}</style>

      {/* ─── CABEÇALHO FORMAL DE IMPRESSÃO (Apenas no Print) ─── */}
      <div className="print-only mb-6 border-b-2 border-slate-800 pb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold uppercase text-slate-900 tracking-tight">
              Farmácia Satélite • Relatório de Pacientes
            </h1>
            <p className="text-sm font-semibold text-slate-700">
              Medicamentos Adquiridos por Adiantamento (Cartão Corporativo do Estado)
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Finalidade: Prestação de Contas, Auditoria Clínica e Rastreabilidade Nominal
            </p>
          </div>
          <div className="text-right text-xs text-slate-600">
            <p>
              <strong>Emissão:</strong>{" "}
              {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
            <p>
              <strong>Filtro Período:</strong>{" "}
              {periodo === "todos"
                ? "Todo o Histórico"
                : periodo === "hoje"
                ? "Hoje"
                : periodo === "7dias"
                ? "Últimos 7 dias"
                : periodo === "30dias"
                ? "Últimos 30 dias"
                : "Personalizado"}
            </p>
            <p>
              <strong>Total de Pacientes:</strong> {totalPacientes} |{" "}
              <strong>Doses Ministradas:</strong> {totalDosesTomadas}
            </p>
          </div>
        </div>
      </div>

      {/* ─── HEADER DE TELA (No-Print) ─── */}
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Relatório de Pacientes • Adiantamento
                <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300 text-xs font-semibold">
                  Cartão do Estado
                </Badge>
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Acompanhamento nominal de pacientes que tomaram medicações compradas por verba de adiantamento na Farmácia Satélite.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handlePrint}
            variant="outline"
            className="border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-sm"
          >
            <Printer className="w-4 h-4 mr-2 text-slate-600 dark:text-slate-300" />
            Imprimir Relatório A4
          </Button>
        </div>
      </div>

      {/* ─── CARDS DE INDICADORES (No-Print) ─── */}
      <div className="no-print grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-amber-500 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                Pacientes Atendidos
              </p>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {isLoading ? <Skeleton className="h-8 w-16" /> : totalPacientes}
              </h3>
            </div>
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 rounded-lg">
              <Users className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Identificados com dose ou prescrição
          </p>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                Doses Tomadas / Baixadas
              </p>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {isLoading ? <Skeleton className="h-8 w-16" /> : `${totalDosesTomadas} un`}
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg">
              <Pill className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Total de unidades ministradas aos pacientes
          </p>
        </Card>

        <Card className="p-4 border-l-4 border-l-blue-500 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                Medicamentos Distintos
              </p>
              <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {isLoading ? <Skeleton className="h-8 w-16" /> : uniqueMedsUsados}
              </h3>
            </div>
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 rounded-lg">
              <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Itens de adiantamento administrados
          </p>
        </Card>

        <Card className="p-4 border-l-4 border-l-purple-500 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                Alas / Setores
              </p>
              <h3 className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                {isLoading ? <Skeleton className="h-8 w-16" /> : alasEnvolvidas}
              </h3>
            </div>
            <div className="p-2.5 bg-purple-50 dark:bg-purple-950/50 rounded-lg">
              <Building2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Setores com pacientes em tratamento
          </p>
        </Card>
      </div>

      {/* ─── FILTROS (No-Print) ─── */}
      <Card className="no-print p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Busca Paciente / Prontuário */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar paciente, prontuário ou medicamento..."
              className="pl-9 text-sm"
            />
          </div>

          {/* Filtro por Medicamento de Adiantamento */}
          <div>
            <Select value={selectedMedId} onValueChange={setSelectedMedId}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Todos os Medicamentos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Medicamentos de Adiantamento</SelectItem>
                {adiantamentoMeds.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nome} {m.concentracao ? `(${m.concentracao})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por Ala */}
          <div>
            <Select value={selectedAla} onValueChange={setSelectedAla}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Todas as Alas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Alas</SelectItem>
                {alas.map((a) => (
                  <SelectItem key={a.id || a.nome} value={a.nome || a.id}>
                    {a.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro por Período */}
          <div>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todo o Histórico</SelectItem>
                <SelectItem value="hoje">Hoje</SelectItem>
                <SelectItem value="7dias">Últimos 7 dias</SelectItem>
                <SelectItem value="30dias">Últimos 30 dias</SelectItem>
                <SelectItem value="mes">Este Mês</SelectItem>
                <SelectItem value="custom">Período Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {periodo === "custom" && (
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500 font-medium">De:</span>
            <Input
              type="date"
              value={customInicio}
              onChange={(e) => setCustomInicio(e.target.value)}
              className="w-40 text-xs"
            />
            <span className="text-xs text-slate-500 font-medium">Até:</span>
            <Input
              type="date"
              value={customFim}
              onChange={(e) => setCustomFim(e.target.value)}
              className="w-40 text-xs"
            />
          </div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "pacientes" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("pacientes")}
              className={
                viewMode === "pacientes"
                  ? "bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                  : "text-slate-600"
              }
            >
              <Users className="w-4 h-4 mr-1.5" />
              Visão por Paciente ({filteredPacientes.length})
            </Button>
            <Button
              variant={viewMode === "extrato" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("extrato")}
              className={
                viewMode === "extrato"
                  ? "bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                  : "text-slate-600"
              }
            >
              <FileText className="w-4 h-4 mr-1.5" />
              Extrato de Doses ({adiantamentoSaidas.length})
            </Button>
          </div>

          {(searchTerm || selectedMedId !== "all" || selectedAla !== "all" || periodo !== "todos") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setSelectedMedId("all");
                setSelectedAla("all");
                setPeriodo("todos");
              }}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Limpar Filtros
            </Button>
          )}
        </div>
      </Card>

      {/* ─── TABELA PRINCIPAL ─── */}
      {viewMode === "pacientes" ? (
        <Card className="bg-white dark:bg-slate-900 shadow-sm border-slate-200 dark:border-slate-800 overflow-hidden print:border-none print:shadow-none">
          <Table className="table-print">
            <TableHeader className="bg-slate-50 dark:bg-slate-800/60">
              <TableRow>
                <TableHead className="w-8 no-print"></TableHead>
                <TableHead className="font-bold text-slate-800 dark:text-slate-200">
                  Paciente
                </TableHead>
                <TableHead className="font-bold text-slate-800 dark:text-slate-200">
                  Ala / Leito
                </TableHead>
                <TableHead className="font-bold text-slate-800 dark:text-slate-200">
                  Medicamento(s) de Adiantamento
                </TableHead>
                <TableHead className="font-bold text-slate-800 dark:text-slate-200 text-center">
                  Posologia Prescrita
                </TableHead>
                <TableHead className="font-bold text-slate-800 dark:text-slate-200 text-center">
                  Doses Tomadas
                </TableHead>
                <TableHead className="font-bold text-slate-800 dark:text-slate-200 text-center">
                  Última Administração
                </TableHead>
                <TableHead className="font-bold text-slate-800 dark:text-slate-200 text-center">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8} className="py-4">
                        <Skeleton className="h-6 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
              ) : filteredPacientes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-16 text-center text-slate-500">
                    <CreditCard className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                    <p className="font-semibold text-base text-slate-700 dark:text-slate-300">
                      Nenhum paciente encontrado
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {adiantamentoMeds.length === 0
                        ? "Nenhum medicamento está cadastrado com a flag de Adiantamento (Cartão do Estado)."
                        : "Não há registros de doses tomadas ou prescrições para os filtros selecionados."}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredPacientes.map((pac) => {
                  const isExpanded = expandedPatients[pac.key];

                  return (
                    <React.Fragment key={pac.key}>
                      <TableRow
                        onClick={() => toggleExpand(pac.key)}
                        className="cursor-pointer hover:bg-amber-50/40 dark:hover:bg-amber-950/20 transition-colors"
                      >
                        <TableCell className="w-8 no-print text-slate-400">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-amber-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </TableCell>

                        {/* Paciente */}
                        <TableCell>
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {pac.nome}
                          </div>
                          <div className="text-xs text-slate-500 font-mono">
                            Prontuário: {pac.prontuario || "—"}
                          </div>
                        </TableCell>

                        {/* Ala / Leito */}
                        <TableCell>
                          <div className="font-medium text-slate-800 dark:text-slate-200">
                            {pac.alaNome || "Geral"}
                          </div>
                          <div className="text-xs text-slate-500">
                            Leito: {pac.leito || "S/L"}
                          </div>
                        </TableCell>

                        {/* Medicamentos */}
                        <TableCell className="max-w-[320px] min-w-[180px] break-words whitespace-normal [overflow-wrap:anywhere] [word-break:break-word]">
                          <div className="space-y-1">
                            {pac.medicamentosList.map((mItem, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 flex-wrap">
                                <Badge className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-amber-300 text-xs font-semibold whitespace-normal break-words [overflow-wrap:anywhere] [word-break:break-word] text-left inline-block max-w-full leading-snug py-1">
                                  💳 {mItem.med?.nome || "Medicamento"}
                                </Badge>
                                {mItem.med?.concentracao && (
                                  <span className="text-[11px] text-slate-500 whitespace-nowrap">
                                    {mItem.med.concentracao}
                                  </span>
                                )}
                                {mItem.med?.nota_fiscal && (
                                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-slate-600 dark:text-slate-400 border font-mono whitespace-nowrap">
                                    NF: {mItem.med.nota_fiscal}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </TableCell>

                        {/* Posologia Prescrita */}
                        <TableCell className="text-center">
                          {pac.medicamentosList.map((mItem, idx) => (
                            <div key={idx} className="text-xs text-slate-700 dark:text-slate-300 my-0.5">
                              {mItem.prescricao?.esquemaPosologico ? (
                                <div className="flex flex-col items-center">
                                  <span className="font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border">
                                    {mItem.prescricao.esquemaPosologico}
                                  </span>
                                  {mItem.prescricao.horarioInicio && (
                                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold block mt-0.5">
                                      Início: {mItem.prescricao.horarioInicio} {mItem.prescricao.horarioInicio === '22:00' ? '🌙' : mItem.prescricao.horarioInicio === '14:00' ? '🌤️' : mItem.prescricao.horarioInicio === '06:00' ? '🌌' : '☀️'}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-xs">Saída Avulsa</span>
                              )}
                            </div>
                          ))}
                        </TableCell>

                        {/* Doses Tomadas */}
                        <TableCell className="text-center">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200">
                            {pac.totalDosesMinistradas} un
                          </span>
                        </TableCell>

                        {/* Última Administração */}
                        <TableCell className="text-center text-xs text-slate-600 dark:text-slate-300">
                          {pac.ultimaDose ? (
                            <span className="font-mono">
                              {format(parseISO(pac.ultimaDose), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>

                        {/* Status */}
                        <TableCell className="text-center">
                          <Badge
                            variant={pac.status === "Ativo" ? "default" : "secondary"}
                            className={
                              pac.status === "Ativo"
                                ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                                : "bg-slate-200 text-slate-700"
                            }
                          >
                            {pac.status || "Ativo"}
                          </Badge>
                        </TableCell>
                      </TableRow>

                      {/* Linha Expandida: Extrato Detalhado de Saídas do Paciente */}
                      {isExpanded && (
                        <TableRow className="bg-slate-50/80 dark:bg-slate-900/60 no-print">
                          <TableCell colSpan={8} className="p-4 pl-12">
                            <div className="space-y-3 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-inner">
                              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                  <Clock className="w-4 h-4 text-amber-600" />
                                  Histórico Nominal de Administrações / Saídas para{" "}
                                  <span className="text-amber-700 dark:text-amber-400 font-extrabold">
                                    {pac.nome}
                                  </span>
                                </h4>
                                <span className="text-xs text-slate-500">
                                  Total registrado: {pac.totalDosesMinistradas} doses
                                </span>
                              </div>

                              {pac.medicamentosList.flatMap((m) => m.saidas).length === 0 ? (
                                <p className="text-xs text-slate-500 italic py-2">
                                  Este paciente possui prescrição de medicamento de adiantamento, mas ainda não houve registro de baixa/saída em estoque.
                                </p>
                              ) : (
                                <Table className="text-xs">
                                  <TableHeader>
                                    <TableRow className="bg-slate-100 dark:bg-slate-700">
                                      <TableHead>Data da Saída</TableHead>
                                      <TableHead>Medicamento</TableHead>
                                      <TableHead>Lote</TableHead>
                                      <TableHead className="text-center">Qtd Ministrada</TableHead>
                                      <TableHead>Motivo / Observação</TableHead>
                                      <TableHead>Responsável</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {pac.medicamentosList
                                      .flatMap((m) => m.saidas)
                                      .sort(
                                        (a, b) =>
                                          new Date(b.created_at || b.data_saida || 0) -
                                          new Date(a.created_at || a.data_saida || 0)
                                      )
                                      .map((s, sIdx) => (
                                        <TableRow key={sIdx} className="hover:bg-slate-50">
                                          <TableCell className="font-mono text-slate-700 dark:text-slate-300">
                                            {s.data_saida
                                              ? format(parseISO(s.data_saida), "dd/MM/yyyy", {
                                                  locale: ptBR,
                                                })
                                              : "—"}
                                          </TableCell>
                                          <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                                            {s.medicamento_nome}
                                          </TableCell>
                                          <TableCell className="font-mono text-slate-600">
                                            {s.numero_lote || "—"}
                                          </TableCell>
                                          <TableCell className="text-center font-bold text-emerald-700">
                                            {s.quantidade} un
                                          </TableCell>
                                          <TableCell className="text-slate-600 max-w-xs truncate">
                                            {s.motivo || s.observacao || "Baixa de medicação"}
                                          </TableCell>
                                          <TableCell className="text-slate-500">
                                            {s.responsavel || "Farmácia Satélite"}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                  </TableBody>
                                </Table>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      ) : (
        /* ─── VISÃO EXTRATO GERAL DE SAÍDAS (Linha por linha) ─── */
        <Card className="bg-white dark:bg-slate-900 shadow-sm border-slate-200 dark:border-slate-800 overflow-hidden print:border-none print:shadow-none">
          <Table className="table-print">
            <TableHeader className="bg-slate-50 dark:bg-slate-800/60">
              <TableRow>
                <TableHead className="font-bold">Data da Saída</TableHead>
                <TableHead className="font-bold">Paciente Destino</TableHead>
                <TableHead className="font-bold">Ala / Leito</TableHead>
                <TableHead className="font-bold">Medicamento Adiantamento</TableHead>
                <TableHead className="font-bold">Lote</TableHead>
                <TableHead className="font-bold text-center">Quantidade</TableHead>
                <TableHead className="font-bold">Nota Fiscal / Origem</TableHead>
                <TableHead className="font-bold">Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adiantamentoSaidas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-16 text-center text-slate-400">
                    Nenhuma saída de medicamento de adiantamento encontrada no período.
                  </TableCell>
                </TableRow>
              ) : (
                adiantamentoSaidas.map((s, idx) => {
                  const med =
                    adiantamentoMedsMap.get(s.medicamento_id) ||
                    adiantamentoMedsMap.get(s.medicamento_nome?.toLowerCase().trim());

                  return (
                    <TableRow key={s.id || idx} className="hover:bg-slate-50">
                      <TableCell className="font-mono text-xs text-slate-600">
                        {s.data_saida
                          ? format(parseISO(s.data_saida), "dd/MM/yyyy", { locale: ptBR })
                          : "—"}
                      </TableCell>
                      <TableCell className="font-bold text-slate-900 dark:text-slate-100">
                        {s.paciente_nome || s.destino || "Paciente não informado"}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {s.ala_nome || "Geral"}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-amber-900 dark:text-amber-200">
                          {s.medicamento_nome}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-600">
                        {s.numero_lote || "—"}
                      </TableCell>
                      <TableCell className="text-center font-bold text-emerald-700">
                        {s.quantidade} un
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {med?.nota_fiscal ? `NF: ${med.nota_fiscal}` : "—"}
                        {med?.fornecedor_nome ? ` (${med.fornecedor_nome})` : ""}
                      </TableCell>
                      <TableCell className="text-xs text-slate-500 max-w-xs truncate">
                        {s.motivo || s.observacao || "Dispensação Satélite"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* ─── RODAPÉ FORMAL PARA ASSINATURA (Apenas Impressão) ─── */}
      <div className="print-only mt-12 pt-8 border-t border-slate-300">
        <div className="grid grid-cols-2 gap-12 text-center text-xs text-slate-700">
          <div>
            <div className="border-t border-slate-500 mx-auto w-64 pt-2"></div>
            <p className="font-bold">Farmacêutico(a) Responsável</p>
            <p className="text-slate-500">Farmácia Satélite • CRF / Assinatura</p>
          </div>
          <div>
            <div className="border-t border-slate-500 mx-auto w-64 pt-2"></div>
            <p className="font-bold">Supervisão de Enfermagem / Setor</p>
            <p className="text-slate-500">COREN / Assinatura</p>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 text-center mt-6">
          Zorion Saúde • Sistema de Gestão Hospitalar e Farmacêutica • Rastreabilidade Portaria e Cartão Corporativo do Estado
        </p>
      </div>
    </div>
  );
}
