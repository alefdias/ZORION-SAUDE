import { useState, useMemo } from "react";
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
  ShoppingCart,
  Search,
  Printer,
  Calendar,
  CheckCircle2,
  TrendingDown,
  FileSpreadsheet,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  parseISO,
  isValid,
  startOfMonth,
  subMonths,
  endOfDay,
  subDays,
  format,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function Compras() {
  // Período de projeção desejado
  const [periodoMeses, setPeriodoMeses] = useState(12); // Padrão: 1 ano (12 meses)
  const [customMeses, setCustomMeses] = useState(12);
  const [selectedTab, setSelectedTab] = useState("comprar"); // 'todos' | 'comprar' | 'suficiente' | 'top'
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoria, setSelectedCategoria] = useState("all");
  const [usarEstoqueMinimoComoFallback, setUsarEstoqueMinimoComoFallback] =
    useState(true);

  // Queries
  const { data: medicamentos = [], isLoading: loadingMeds } = useQuery({
    queryKey: ["medicamentos"],
    queryFn: () => db.entities.Medicamento.list(),
  });

  const { data: saidas = [], isLoading: loadingSaidas } = useQuery({
    queryKey: ["saidas"],
    queryFn: () => db.entities.Saida.list("-created_date"),
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias"],
    queryFn: () => db.entities.Categoria.list(),
  });

  const isLoading = loadingMeds || loadingSaidas;

  // ─── CÁLCULO DO CONSUMO MÉDIO MENSAL (MMC) ───
  // Analisa as saídas históricas dos últimos 4 meses fechados (ou total registrado)
  const { consumoMMC, mesesHistorico } = useMemo(() => {
    const hoje = new Date();
    const mesAtualInicio = startOfMonth(hoje);
    const mmcDataFim = endOfDay(subDays(mesAtualInicio, 1));
    const mmcDataInicio = startOfMonth(subMonths(mesAtualInicio, 4));

    const mapaConsumo = {};
    let countComData = 0;

    saidas.forEach((s) => {
      if (s.motivo === "Transferência de Estoque") return; // Não conta remanejamento interno como consumo
      const qtd = Number(s.quantidade || 0);
      if (qtd <= 0) return;

      let matchPeriodo = true;
      if (s.data_saida) {
        try {
          const d = parseISO(s.data_saida);
          if (isValid(d)) {
            countComData++;
            if (d < mmcDataInicio || d > mmcDataFim) {
              // Se houver poucas saídas históricas gerais, aproveitamos todas as saídas disponíveis
              matchPeriodo = saidas.length < 50;
            }
          }
        } catch {
          // ignora
        }
      }

      if (matchPeriodo && s.medicamento_id) {
        mapaConsumo[s.medicamento_id] =
          (mapaConsumo[s.medicamento_id] || 0) + qtd;
      }
    });

    const divisorMeses = 4;
    return { consumoMMC: mapaConsumo, mesesHistorico: divisorMeses };
  }, [saidas]);

  // Meses efetivos para a projeção
  const mesesProjecao = Number(periodoMeses) || 12;

  // ─── ANÁLISE COMPLETA POR MEDICAMENTO ───
  const analiseCompras = useMemo(() => {
    return medicamentos.map((m) => {
      const estoqueAtual = Number(m.estoque_atual || 0);
      const estoqueSatelite = Number(m.estoque_satelite || 0);
      const estoqueTotal = estoqueAtual + estoqueSatelite;

      const totalConsumoHist = consumoMMC[m.id] || 0;
      let mmcCalculado = Math.ceil(totalConsumoHist / mesesHistorico);

      // Fallback inteligente: se o sistema não possui saídas registradas ainda para este item,
      // utiliza o estoque_minimo cadastrado como estimativa de giro mensal
      let usouFallback = false;
      if (mmcCalculado === 0 && usarEstoqueMinimoComoFallback && (m.estoque_minimo || 0) > 0) {
        mmcCalculado = Number(m.estoque_minimo);
        usouFallback = true;
      }

      // Demanda prevista para o período escolhido (ex: 6 meses, 12 meses, 24 meses)
      const demandaPeriodo = Math.ceil(mmcCalculado * mesesProjecao);

      // Quantos meses o estoque atual vai durar?
      let mesesCobertura = 0;
      if (mmcCalculado > 0) {
        mesesCobertura = Number((estoqueTotal / mmcCalculado).toFixed(1));
      } else if (estoqueTotal > 0) {
        mesesCobertura = 999; // Cobertura indeterminada / sem consumo
      }

      // Déficit ou Superávit
      const saldoFinalEstimado = estoqueTotal - demandaPeriodo;
      const precisaComprar = saldoFinalEstimado < 0 && mmcCalculado > 0;
      const quantidadeAComprar = precisaComprar ? Math.abs(saldoFinalEstimado) : 0;

      // Status
      let statusTipo = "suficiente"; // 'comprar' | 'suficiente' | 'sem_consumo' | 'critico'
      if (mmcCalculado === 0 && estoqueTotal === 0) {
        statusTipo = "zerado_sem_giro";
      } else if (mmcCalculado === 0) {
        statusTipo = "sem_consumo";
      } else if (precisaComprar) {
        statusTipo = estoqueTotal <= 0 ? "critico" : "comprar";
      } else {
        statusTipo = "suficiente";
      }

      return {
        id: m.id,
        codigo: m.codigo || "S/C",
        nome: m.nome,
        concentracao: m.concentracao || "",
        apresentacao: m.apresentacao || "",
        categoria_id: m.categoria_id,
        categoriaNome: m.categoria || m.categoria_nome || "Geral",
        estoqueCentral: estoqueAtual,
        estoqueSatelite: estoqueSatelite,
        estoqueTotal: estoqueTotal,
        estoqueMinimo: m.estoque_minimo || 0,
        mmc: mmcCalculado,
        usouFallback,
        totalConsumoHist,
        mesesCobertura,
        demandaPeriodo,
        saldoFinalEstimado,
        precisaComprar,
        quantidadeAComprar,
        statusTipo,
        isAdiantamento: Boolean(m.is_adiantamento),
      };
    });
  }, [
    medicamentos,
    consumoMMC,
    mesesHistorico,
    mesesProjecao,
    usarEstoqueMinimoComoFallback,
  ]);

  // Lista ordenada: por padrão, prioriza quem precisa comprar (maior déficit) e quem tem maior consumo (MMC)
  const analiseOrdenada = useMemo(() => {
    return [...analiseCompras].sort((a, b) => {
      // Primeiro quem precisa comprar com maior quantidade
      if (a.precisaComprar && !b.precisaComprar) return -1;
      if (!a.precisaComprar && b.precisaComprar) return 1;
      if (a.precisaComprar && b.precisaComprar) {
        return b.quantidadeAComprar - a.quantidadeAComprar;
      }
      // Depois por maior consumo mensal
      return b.mmc - a.mmc;
    });
  }, [analiseCompras]);

  // Filtragem
  const filteredList = useMemo(() => {
    return analiseOrdenada.filter((item) => {
      // Filtro por Abas
      if (selectedTab === "comprar") {
        if (!item.precisaComprar) return false;
      } else if (selectedTab === "suficiente") {
        if (item.precisaComprar || item.mmc === 0) return false;
      } else if (selectedTab === "top") {
        // Top mais consumidos (MMC > 0)
        if (item.mmc <= 0) return false;
      } else if (selectedTab === "sem_consumo") {
        if (item.mmc > 0) return false;
      }

      // Filtro por Busca
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchNome = item.nome?.toLowerCase().includes(term);
        const matchCodigo = item.codigo?.toLowerCase().includes(term);
        if (!matchNome && !matchCodigo) return false;
      }

      // Filtro por Categoria
      if (selectedCategoria !== "all") {
        if (item.categoria_id !== selectedCategoria && item.categoriaNome !== selectedCategoria) {
          return false;
        }
      }

      return true;
    });
  }, [analiseOrdenada, selectedTab, searchTerm, selectedCategoria]);

  // ─── TOTAIS DE INDICADORES ───
  const totalItensAComprar = analiseCompras.filter((i) => i.precisaComprar).length;
  const volumeTotalAComprar = analiseCompras.reduce(
    (acc, i) => acc + i.quantidadeAComprar,
    0
  );
  const totalSuficientes = analiseCompras.filter(
    (i) => !i.precisaComprar && i.mmc > 0
  ).length;
  const topConsumoCount = analiseCompras.filter((i) => i.mmc > 0).length;

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = [
      "Código",
      "Medicamento",
      "Concentração",
      "Estoque Total",
      "Consumo Médio Mensal (MMC)",
      `Demanda (${mesesProjecao} meses)`,
      "Meses de Cobertura",
      "Status",
      "Quantidade a Comprar",
    ];

    const rows = filteredList.map((i) => [
      `"${i.codigo}"`,
      `"${i.nome}"`,
      `"${i.concentracao}"`,
      i.estoqueTotal,
      i.mmc,
      i.demandaPeriodo,
      i.mesesCobertura >= 999 ? "Sem consumo" : i.mesesCobertura,
      i.precisaComprar ? "NECESSITA COMPRA" : "ESTOQUE SUFICIENTE",
      i.quantidadeAComprar,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `previsao_compras_${mesesProjecao}meses_${format(new Date(), "yyyyMMdd")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatPeriodoLabel = (meses) => {
    if (meses === 6) return "6 Meses";
    if (meses === 12) return "1 Ano (12 meses)";
    if (meses === 24) return "2 Anos (24 meses)";
    return `${meses} Meses`;
  };

  return (
    <div className="space-y-6 p-4 sm:p-8 bg-slate-50/50 dark:bg-slate-950 min-h-full print:bg-white print:p-0">
      {/* Estilos de Impressão A4 */}
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
            padding: 5px 6px !important;
            font-size: 10px !important;
          }
          .table-print th {
            background-color: #f1f5f9 !important;
            font-weight: bold !important;
          }
        }
        @media screen {
          .print-only {
            display: none !important;
          }
        }
      `}</style>

      {/* ─── CABEÇALHO OFICIAL DE IMPRESSÃO (Apenas no Print) ─── */}
      <div className="print-only mb-4 border-b-2 border-slate-800 pb-3">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-lg font-bold uppercase text-slate-900 tracking-tight">
              Hospital Zorion Saúde • Planejamento e Previsão de Compras (MMC)
            </h1>
            <p className="text-xs text-slate-700">
              Relatório Analítico de Cobertura de Estoque • Horizonte de Planejamento:{" "}
              <strong>{formatPeriodoLabel(mesesProjecao)}</strong>
            </p>
          </div>
          <div className="text-right text-[10px] text-slate-600">
            <p>
              <strong>Emissão:</strong>{" "}
              {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
            <p>
              <strong>Itens a Comprar:</strong> {totalItensAComprar} |{" "}
              <strong>Volume a Adquirir:</strong> {volumeTotalAComprar.toLocaleString("pt-BR")} un
            </p>
          </div>
        </div>
      </div>

      {/* ─── HEADER DE TELA (No-Print) ─── */}
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Planejamento de Compras • Análise MMC
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Previsão de suprimentos e consumo médio mensal. Selecione o período desejado para saber se o estoque dá ou quanto precisa comprar.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleExportCSV}
            variant="outline"
            className="border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-600" />
            Exportar CSV
          </Button>
          <Button
            onClick={handlePrint}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
          >
            <Printer className="w-4 h-4 mr-2" />
            Imprimir Lista A4
          </Button>
        </div>
      </div>

      {/* ─── BARRA SELETORA DE HORIZONTE DE COMPRA (O QUE O USUÁRIO PEDIU) ─── */}
      <Card className="no-print p-4 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white shadow-md border-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-300" />
              <h3 className="font-bold text-base text-white">
                Para qual período você deseja planejar as compras?
              </h3>
            </div>
            <p className="text-xs text-indigo-200">
              O sistema calcula o consumo mensal (MMC) e informa exatamente se o estoque atual dura todo esse tempo ou quantas unidades você precisará comprar.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => setPeriodoMeses(6)}
              className={cn(
                "font-semibold text-xs transition-all",
                periodoMeses === 6
                  ? "bg-white text-indigo-900 hover:bg-indigo-50 shadow-md font-bold scale-105"
                  : "bg-indigo-700/60 hover:bg-indigo-700 text-white border border-indigo-500/50"
              )}
            >
              📅 6 Meses
            </Button>

            <Button
              size="sm"
              onClick={() => setPeriodoMeses(12)}
              className={cn(
                "font-semibold text-xs transition-all",
                periodoMeses === 12
                  ? "bg-white text-indigo-900 hover:bg-indigo-50 shadow-md font-bold scale-105"
                  : "bg-indigo-700/60 hover:bg-indigo-700 text-white border border-indigo-500/50"
              )}
            >
              📅 1 Ano (12 meses)
            </Button>

            <Button
              size="sm"
              onClick={() => setPeriodoMeses(24)}
              className={cn(
                "font-semibold text-xs transition-all",
                periodoMeses === 24
                  ? "bg-white text-indigo-900 hover:bg-indigo-50 shadow-md font-bold scale-105"
                  : "bg-indigo-700/60 hover:bg-indigo-700 text-white border border-indigo-500/50"
              )}
            >
              📅 2 Anos (24 meses)
            </Button>

            {/* Período Personalizado */}
            <div className="flex items-center gap-1.5 bg-indigo-950/60 p-1 rounded-lg border border-indigo-600/40">
              <span className="text-xs text-indigo-200 px-1 font-medium">Personalizado:</span>
              <Input
                type="number"
                min="1"
                max="120"
                value={customMeses}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value) || 1);
                  setCustomMeses(val);
                  setPeriodoMeses(val);
                }}
                className="w-16 h-8 text-xs font-bold text-center bg-white text-indigo-950"
              />
              <span className="text-xs text-indigo-200 pr-1">meses</span>
            </div>
          </div>
        </div>
      </Card>

      {/* ─── CARDS DE INDICADORES (No-Print) ─── */}
      <div className="no-print grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Necessitam Compra */}
        <Card
          onClick={() => setSelectedTab("comprar")}
          className={cn(
            "p-4 border-l-4 cursor-pointer transition-all shadow-sm",
            selectedTab === "comprar"
              ? "border-l-red-600 bg-red-50/70 dark:bg-red-950/30 ring-2 ring-red-500"
              : "border-l-red-500 bg-white dark:bg-slate-900 hover:shadow-md"
          )}
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                Medicamentos a Comprar
              </p>
              <h3 className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                {isLoading ? <Skeleton className="h-8 w-16" /> : `${totalItensAComprar} itens`}
              </h3>
            </div>
            <div className="p-2.5 bg-red-50 dark:bg-red-950/50 rounded-lg">
              <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Não duram até o fim de {formatPeriodoLabel(mesesProjecao)}
          </p>
        </Card>

        {/* Card 2: Volume Total a Comprar */}
        <Card className="p-4 border-l-4 border-l-amber-500 bg-white dark:bg-slate-900 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                Volume Total a Adquirir
              </p>
              <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                {isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  `${volumeTotalAComprar.toLocaleString("pt-BR")} un`
                )}
              </h3>
            </div>
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 rounded-lg">
              <ShoppingCart className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Soma das unidades em falta para o período
          </p>
        </Card>

        {/* Card 3: Estoque Suficiente */}
        <Card
          onClick={() => setSelectedTab("suficiente")}
          className={cn(
            "p-4 border-l-4 cursor-pointer transition-all shadow-sm",
            selectedTab === "suficiente"
              ? "border-l-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/30 ring-2 ring-emerald-500"
              : "border-l-emerald-500 bg-white dark:bg-slate-900 hover:shadow-md"
          )}
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                Estoque Suficiente
              </p>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {isLoading ? <Skeleton className="h-8 w-16" /> : `${totalSuficientes} itens`}
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Estoque cobre 100% dos {mesesProjecao} meses
          </p>
        </Card>

        {/* Card 4: Top Mais Usados */}
        <Card
          onClick={() => setSelectedTab("top")}
          className={cn(
            "p-4 border-l-4 cursor-pointer transition-all shadow-sm",
            selectedTab === "top"
              ? "border-l-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/30 ring-2 ring-indigo-500"
              : "border-l-indigo-500 bg-white dark:bg-slate-900 hover:shadow-md"
          )}
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">
                Itens com Giro (MMC Ativo)
              </p>
              <h3 className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                {isLoading ? <Skeleton className="h-8 w-16" /> : `${topConsumoCount} itens`}
              </h3>
            </div>
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg">
              <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Classificados por maior consumo mensal
          </p>
        </Card>
      </div>

      {/* ─── FILTROS E ABAS (No-Print) ─── */}
      <Card className="no-print p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        {/* Abas Rápidas */}
        <div className="flex items-center flex-wrap gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <Button
            size="sm"
            variant={selectedTab === "comprar" ? "default" : "outline"}
            onClick={() => setSelectedTab("comprar")}
            className={
              selectedTab === "comprar"
                ? "bg-red-600 hover:bg-red-700 text-white font-bold"
                : "text-slate-600"
            }
          >
            🚨 Precisa Comprar ({totalItensAComprar})
          </Button>

          <Button
            size="sm"
            variant={selectedTab === "suficiente" ? "default" : "outline"}
            onClick={() => setSelectedTab("suficiente")}
            className={
              selectedTab === "suficiente"
                ? "bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                : "text-slate-600"
            }
          >
            ✅ Estoque Suficiente ({totalSuficientes})
          </Button>

          <Button
            size="sm"
            variant={selectedTab === "top" ? "default" : "outline"}
            onClick={() => setSelectedTab("top")}
            className={
              selectedTab === "top"
                ? "bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                : "text-slate-600"
            }
          >
            🔥 Mais Consumidos (Ranking MMC)
          </Button>

          <Button
            size="sm"
            variant={selectedTab === "todos" ? "default" : "outline"}
            onClick={() => setSelectedTab("todos")}
            className={
              selectedTab === "todos"
                ? "bg-slate-800 hover:bg-slate-900 text-white font-bold"
                : "text-slate-600"
            }
          >
            📋 Todos os Medicamentos ({analiseCompras.length})
          </Button>
        </div>

        {/* Linha de Busca e Seletores */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por medicamento ou código..."
              className="pl-9 text-sm"
            />
          </div>

          <div>
            <Select value={selectedCategoria} onValueChange={setSelectedCategoria}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Todas as Categorias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Categorias</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c.id || c.nome} value={c.id || c.nome}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={usarEstoqueMinimoComoFallback}
                onChange={(e) => setUsarEstoqueMinimoComoFallback(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <span>Usar Estoque Mínimo se não houver saídas</span>
            </label>

            {(searchTerm || selectedCategoria !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategoria("all");
                }}
                className="text-xs text-slate-500"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* ─── TABELA DE ANÁLISE DE COMPRAS ─── */}
      <Card className="bg-white dark:bg-slate-900 shadow-sm border-slate-200 dark:border-slate-800 overflow-hidden print:border-none print:shadow-none">
        <Table className="table-print">
          <TableHeader className="bg-slate-50 dark:bg-slate-800/60">
            <TableRow>
              <TableHead className="w-16 font-mono text-xs">Cód.</TableHead>
              <TableHead className="font-bold text-slate-800 dark:text-slate-200">
                Medicamento
              </TableHead>
              <TableHead className="font-bold text-slate-800 dark:text-slate-200 text-right">
                Estoque Atual
              </TableHead>
              <TableHead className="font-bold text-slate-800 dark:text-slate-200 text-right">
                Consumo Mensal (MMC)
              </TableHead>
              <TableHead className="font-bold text-slate-800 dark:text-slate-200 text-center">
                Meses de Cobertura
              </TableHead>
              <TableHead className="font-bold text-slate-800 dark:text-slate-200 text-right">
                Demanda ({mesesProjecao}m)
              </TableHead>
              <TableHead className="font-bold text-slate-800 dark:text-slate-200 text-center">
                Dá para {formatPeriodoLabel(mesesProjecao)}?
              </TableHead>
              <TableHead className="font-bold text-slate-800 dark:text-slate-200 text-right">
                A Comprar
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(6)
                .fill(0)
                .map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8} className="py-4">
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))
            ) : filteredList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center text-slate-400">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p className="font-semibold text-slate-700 dark:text-slate-300">
                    Nenhum medicamento encontrado para este filtro
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {selectedTab === "comprar"
                      ? "Parabéns! Nenhum medicamento está em falta para o período de " +
                        formatPeriodoLabel(mesesProjecao)
                      : "Ajuste os filtros de busca ou categoria acima."}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              filteredList.map((item, idx) => {
                const daParaOPeriodo = !item.precisaComprar && item.mmc > 0;
                const semConsumo = item.mmc === 0;

                return (
                  <TableRow
                    key={item.id || idx}
                    className={cn(
                      "hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors",
                      item.precisaComprar && "bg-red-50/20 dark:bg-red-950/10"
                    )}
                  >
                    {/* Código */}
                    <TableCell className="font-mono text-xs text-slate-500">
                      {item.codigo}
                    </TableCell>

                    {/* Medicamento */}
                    <TableCell>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                          {item.nome}
                        </span>
                        {item.concentracao && (
                          <span className="text-xs text-slate-500">
                            {item.concentracao}
                          </span>
                        )}
                        {item.isAdiantamento && (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] px-1.5 py-0">
                            💳 Adiantamento
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>{item.categoriaNome}</span>
                        {item.estoqueSatelite > 0 && (
                          <span>
                            • Satélite: {item.estoqueSatelite} un
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Estoque Total */}
                    <TableCell className="text-right font-mono font-semibold text-slate-800 dark:text-slate-200">
                      {item.estoqueTotal.toLocaleString("pt-BR")}
                    </TableCell>

                    {/* Consumo Mensal (MMC) */}
                    <TableCell className="text-right">
                      {item.mmc > 0 ? (
                        <div>
                          <span className="font-mono font-bold text-indigo-700 dark:text-indigo-400">
                            {item.mmc.toLocaleString("pt-BR")}/mês
                          </span>
                          {item.usouFallback && (
                            <span
                              title="Baseado no Estoque Mínimo cadastrado"
                              className="block text-[10px] text-amber-600 italic cursor-help"
                            >
                              (estimado)
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">0/mês</span>
                      )}
                    </TableCell>

                    {/* Meses de Cobertura */}
                    <TableCell className="text-center">
                      {semConsumo ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : item.mesesCobertura >= 999 ? (
                        <span className="text-xs text-slate-500 font-medium">+24 meses</span>
                      ) : (
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold font-mono",
                            item.mesesCobertura >= mesesProjecao
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : item.mesesCobertura >= mesesProjecao / 2
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                              : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                          )}
                        >
                          {item.mesesCobertura} {item.mesesCobertura === 1 ? "mês" : "meses"}
                        </span>
                      )}
                    </TableCell>

                    {/* Demanda Prevista para o Período */}
                    <TableCell className="text-right font-mono text-slate-600 dark:text-slate-400">
                      {item.demandaPeriodo > 0 ? (
                        `${item.demandaPeriodo.toLocaleString("pt-BR")} un`
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </TableCell>

                    {/* Dá ou Não Dá? */}
                    <TableCell className="text-center">
                      {semConsumo ? (
                        <Badge variant="outline" className="text-xs text-slate-500">
                          Sem Consumo
                        </Badge>
                      ) : daParaOPeriodo ? (
                        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300 text-xs font-bold py-1">
                          🟢 Sim, Dá! (+{item.saldoFinalEstimado.toLocaleString("pt-BR")})
                        </Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-300 text-xs font-bold py-1">
                          🔴 Não Dá (Falta {item.quantidadeAComprar.toLocaleString("pt-BR")})
                        </Badge>
                      )}
                    </TableCell>

                    {/* Quantidade a Comprar */}
                    <TableCell className="text-right">
                      {item.precisaComprar ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-red-600 text-white shadow-sm font-mono">
                          +{item.quantidadeAComprar.toLocaleString("pt-BR")} un
                        </span>
                      ) : (
                        <span className="text-xs text-emerald-600 font-semibold">
                          0 un (OK)
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* ─── RODAPÉ FORMAL PARA IMPRESSÃO (Apenas no Print) ─── */}
      <div className="print-only mt-8 pt-6 border-t border-slate-300">
        <div className="grid grid-cols-2 gap-12 text-center text-xs text-slate-700">
          <div>
            <div className="border-t border-slate-500 mx-auto w-64 pt-2"></div>
            <p className="font-bold">Farmacêutico(a) Responsável Técnico</p>
            <p className="text-slate-500">CRF / Assinatura</p>
          </div>
          <div>
            <div className="border-t border-slate-500 mx-auto w-64 pt-2"></div>
            <p className="font-bold">Diretoria / Setor de Compras e Suprimentos</p>
            <p className="text-slate-500">Aprovação Orçamentária</p>
          </div>
        </div>
      </div>
    </div>
  );
}
