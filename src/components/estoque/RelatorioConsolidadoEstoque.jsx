import React, { useState, useMemo, useRef } from "react";
import { format, differenceInDays, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { safeParseISO } from "@/utils/dateUtils";
import { normalizeSearch } from "@/utils/searchUtils";
import { isMav, isPsicotropico } from "@/utils/mavUtils";
import { isMedicamentoAntibiotico } from "@/utils/prescricaoUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  Printer,
  Download,
  Building2,
  Boxes,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  XCircle,
  Filter,
  Layers,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function RelatorioConsolidadoEstoque({
  medicamentos = [],
  lotes = [],
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPadronizado, setFilterPadronizado] = useState("todos"); // "todos", "padronizado", "nao_padronizado"
  const [filterSaldo, setFilterSaldo] = useState("com_saldo"); // "todos", "com_saldo", "sem_saldo"
  const [filterValidade, setFilterValidade] = useState("todos"); // "todos", "proximo_vencer", "vencido"
  const [expandedMeds, setExpandedMeds] = useState(new Set());
  const printRef = useRef(null);

  const hoje = new Date();

  // Processamento e cruzamento de Medicamentos com seus Lotes e Saldos
  const dadosConsolidados = useMemo(() => {
    return (medicamentos || [])
      .filter((m) => m.ativo !== false)
      .map((med) => {
        const saldoCentral = Number(med.estoque_atual) || 0;
        const saldoSatelite = Number(med.estoque_satelite) || 0;
        const saldoTotal = saldoCentral + saldoSatelite;

        // Lotes deste medicamento
        const lotesDoMed = (lotes || [])
          .filter((l) => String(l.medicamento_id || l.medicamentoId) === String(med.id))
          .map((l) => {
            const parsedValidade = safeParseISO(l.data_validade);
            const vencido = parsedValidade ? parsedValidade < hoje : false;
            const diasParaVencer = parsedValidade ? differenceInDays(parsedValidade, hoje) : 999;
            const qtdCentral = Math.max(0, Number(l.quantidade_atual) || 0);
            const qtdSatelite = Math.max(0, Number(l.quantidade_satelite) || 0);
            const qtdTotalLote = qtdCentral + qtdSatelite;

            let statusValidade = "valido";
            if (vencido) statusValidade = "vencido";
            else if (diasParaVencer <= 60) statusValidade = "proximo";

            return {
              ...l,
              parsedValidade,
              vencido,
              diasParaVencer,
              qtdCentral,
              qtdSatelite,
              qtdTotalLote,
              statusValidade,
            };
          })
          .sort((a, b) => {
            if (!a.parsedValidade) return 1;
            if (!b.parsedValidade) return -1;
            return a.parsedValidade - b.parsedValidade;
          });

        const temLoteVencido = lotesDoMed.some((l) => l.vencido && l.qtdTotalLote > 0);
        const temLoteProximo = lotesDoMed.some(
          (l) => !l.vencido && l.diasParaVencer <= 60 && l.qtdTotalLote > 0
        );

        return {
          ...med,
          saldoCentral,
          saldoSatelite,
          saldoTotal,
          lotes: lotesDoMed,
          totalLotes: lotesDoMed.length,
          temLoteVencido,
          temLoteProximo,
          isMav: isMav(med),
          isPsico: isPsicotropico(med),
          isAnti: isMedicamentoAntibiotico(med),
        };
      })
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
  }, [medicamentos, lotes, hoje]);

  // Filtragem
  const dadosFiltrados = useMemo(() => {
    return dadosConsolidados.filter((med) => {
      // 1. Filtro de Texto
      if (searchTerm.trim()) {
        const q = normalizeSearch(searchTerm);
        const terms = q.split(/\s+/).filter(Boolean);
        const lotesText = med.lotes.map((l) => l.numero_lote || "").join(" ");
        const fullText = normalizeSearch(
          `${med.nome || ""} ${med.principio_ativo || ""} ${med.codigo || ""} ${lotesText}`
        );
        const match = terms.every((t) => fullText.includes(t));
        if (!match) return false;
      }

      // 2. Filtro de Padronização
      if (filterPadronizado === "padronizado" && !med.padronizado) return false;
      if (filterPadronizado === "nao_padronizado" && med.padronizado) return false;

      // 3. Filtro de Saldo
      if (filterSaldo === "com_saldo" && med.saldoTotal <= 0) return false;
      if (filterSaldo === "sem_saldo" && med.saldoTotal > 0) return false;

      // 4. Filtro de Validade
      if (filterValidade === "vencido" && !med.temLoteVencido) return false;
      if (filterValidade === "proximo_vencer" && !med.temLoteProximo) return false;

      return true;
    });
  }, [dadosConsolidados, searchTerm, filterPadronizado, filterSaldo, filterValidade]);

  // Totais KPIs
  const totaisGerais = useMemo(() => {
    let totalCentral = 0;
    let totalSatelite = 0;
    let totalLotesGerais = 0;
    let lotesCriticos = 0;

    dadosConsolidados.forEach((m) => {
      totalCentral += m.saldoCentral;
      totalSatelite += m.saldoSatelite;
      totalLotesGerais += m.lotes.length;
      m.lotes.forEach((l) => {
        if (l.diasParaVencer <= 60 && l.qtdTotalLote > 0) {
          lotesCriticos++;
        }
      });
    });

    return {
      totalCentral,
      totalSatelite,
      totalGeral: totalCentral + totalSatelite,
      totalLotesGerais,
      lotesCriticos,
    };
  }, [dadosConsolidados]);

  // Ações de expandir/recolher
  const toggleExpand = (medId) => {
    const s = new Set(expandedMeds);
    if (s.has(medId)) s.delete(medId);
    else s.add(medId);
    setExpandedMeds(s);
  };

  const handleExpandAll = () => {
    if (expandedMeds.size === dadosFiltrados.length) {
      setExpandedMeds(new Set());
    } else {
      setExpandedMeds(new Set(dadosFiltrados.map((m) => m.id)));
    }
  };

  // Exportar para CSV
  const handleExportCSV = () => {
    try {
      const headers = [
        "Código",
        "Medicamento",
        "Apresentação",
        "Padronizado",
        "Saldo Central",
        "Saldo Satélite",
        "Saldo Total",
        "Número Lote",
        "Data Validade",
        "Dias Para Vencer",
        "Status Validade",
        "Qtd Lote Central",
        "Qtd Lote Satélite",
        "Qtd Lote Total",
      ];

      const rows = [];

      dadosFiltrados.forEach((med) => {
        if (med.lotes.length === 0) {
          rows.push([
            `"${med.codigo || ""}"`,
            `"${(med.nome || "").replace(/"/g, '""')}"`,
            `"${med.apresentacao || ""}"`,
            `"${med.padronizado ? "Sim" : "Não"}"`,
            med.saldoCentral,
            med.saldoSatelite,
            med.saldoTotal,
            `"S/ Lote"`,
            `"-"`,
            `"-"`,
            `"-"`,
            med.saldoCentral,
            med.saldoSatelite,
            med.saldoTotal,
          ]);
        } else {
          med.lotes.forEach((l) => {
            rows.push([
              `"${med.codigo || ""}"`,
              `"${(med.nome || "").replace(/"/g, '""')}"`,
              `"${med.apresentacao || ""}"`,
              `"${med.padronizado ? "Sim" : "Não"}"`,
              med.saldoCentral,
              med.saldoSatelite,
              med.saldoTotal,
              `"${l.numero_lote || "S/ Lote"}"`,
              `"${l.data_validade ? format(safeParseISO(l.data_validade) || new Date(), "dd/MM/yyyy") : "-"}"`,
              l.diasParaVencer !== 999 ? l.diasParaVencer : "-",
              `"${l.statusValidade}"`,
              l.qtdCentral,
              l.qtdSatelite,
              l.qtdTotalLote,
            ]);
          });
        }
      });

      const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `estoque_central_satelite_${format(new Date(), "yyyy-MM-dd")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Relatório CSV exportado com sucesso!");
    } catch (e) {
      toast.error("Erro ao exportar CSV: " + e.message);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6" ref={printRef}>
      {/* ─── BANNER / HEADER DO RELATÓRIO ───────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 text-white rounded-2xl p-6 shadow-xl border border-indigo-800/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner">
              <Building2 className="w-6 h-6 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-extrabold tracking-tight">
                  Relatório Consolidado • Central vs Satélite
                </h2>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/40 text-[10px] font-bold">
                  Soma Integrada
                </Badge>
              </div>
              <p className="text-xs text-indigo-200 font-medium mt-0.5">
                Posição geral de estoque por medicamento, lotes físicos ativos e datas de validade (Padronizados & Não Padronizados).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-end md:self-center no-print">
            <Button
              onClick={handleExpandAll}
              variant="outline"
              size="sm"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-semibold"
            >
              <ArrowUpDown className="w-3.5 h-3.5 mr-1.5" />
              {expandedMeds.size === dadosFiltrados.length ? "Recolher Todos" : "Expandir Lotes"}
            </Button>
            <Button
              onClick={handleExportCSV}
              variant="outline"
              size="sm"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-semibold"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Exportar CSV
            </Button>
            <Button
              onClick={handlePrint}
              size="sm"
              className="bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs shadow-md"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
              Imprimir Relatório
            </Button>
          </div>
        </div>
      </div>

      {/* ─── CARDS DE INDICADORES (KPIS) ────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Geral */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Estoque Total Geral
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
                {totaisGerais.totalGeral.toLocaleString("pt-BR")}
              </span>
              <span className="text-xs text-slate-500 font-medium">unidades</span>
            </div>
            <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
              Central + Satélite somados
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 border border-indigo-100 dark:border-indigo-900">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Saldo Central */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Farmácia Central
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
                {totaisGerais.totalCentral.toLocaleString("pt-BR")}
              </span>
              <span className="text-xs text-slate-500 font-medium">un</span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Almoxarifado Principal
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 border border-blue-100 dark:border-blue-900">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Saldo Satélite */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Farmácia Satélite
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {totaisGerais.totalSatelite.toLocaleString("pt-BR")}
              </span>
              <span className="text-xs text-slate-500 font-medium">un</span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Disponível para Dispensação
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 border border-emerald-100 dark:border-emerald-900">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Alertas de Vencimento */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Lotes em Alerta
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                {totaisGerais.lotesCriticos}
              </span>
              <span className="text-xs text-slate-500 font-medium">lote(s)</span>
            </div>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
              Vencendo em até 60 dias
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-600 border border-amber-100 dark:border-amber-900">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ─── FILTROS E BARRA DE PESQUISA ────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3 no-print">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Busca por texto */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Buscar medicamento, código ou lote..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9.5 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200"
            />
          </div>

          {/* Filtro Padronização */}
          <div>
            <Select value={filterPadronizado} onValueChange={setFilterPadronizado}>
              <SelectTrigger className="h-9.5 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200">
                <SelectValue placeholder="Padronização" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos (Padronizados e Não)</SelectItem>
                <SelectItem value="padronizado">Apenas Padronizados</SelectItem>
                <SelectItem value="nao_padronizado">Apenas Não Padronizados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro Saldo */}
          <div>
            <Select value={filterSaldo} onValueChange={setFilterSaldo}>
              <SelectTrigger className="h-9.5 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200">
                <SelectValue placeholder="Situação de Estoque" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="com_saldo">Somente com Saldo (Total &gt; 0)</SelectItem>
                <SelectItem value="todos">Todos os Medicamentos</SelectItem>
                <SelectItem value="sem_saldo">Estoque Zerado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro Validade */}
          <div>
            <Select value={filterValidade} onValueChange={setFilterValidade}>
              <SelectTrigger className="h-9.5 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200">
                <SelectValue placeholder="Validade dos Lotes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as Validades</SelectItem>
                <SelectItem value="proximo_vencer">Próximos a Vencer (&le; 60 dias)</SelectItem>
                <SelectItem value="vencido">Com Lote Vencido</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
          <span>
            Exibindo <strong>{dadosFiltrados.length}</strong> de {dadosConsolidados.length} medicamentos cadastrados
          </span>
          <span className="text-[11px] text-slate-400">
            * Clique em cada linha para expandir e verificar o detalhamento de lote e validade
          </span>
        </div>
      </div>

      {/* ─── TABELA CONSOLIDADA ─────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                <th className="py-3 px-3 w-10 text-center no-print"></th>
                <th className="py-3 px-3">Código</th>
                <th className="py-3 px-3">Medicamento / Princípio Ativo</th>
                <th className="py-3 px-3">Apresentação</th>
                <th className="py-3 px-3">Padronização</th>
                <th className="py-3 px-3 text-right text-blue-700 dark:text-blue-400">Central</th>
                <th className="py-3 px-3 text-right text-emerald-700 dark:text-emerald-400">Satélite</th>
                <th className="py-3 px-3 text-right text-indigo-900 dark:text-indigo-200 font-extrabold bg-indigo-50/50 dark:bg-indigo-950/20">
                  Total Geral
                </th>
                <th className="py-3 px-3 text-center">Lotes Físicos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {dadosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 text-sm">
                    Nenhum medicamento encontrado para os critérios de busca selecionados.
                  </td>
                </tr>
              ) : (
                dadosFiltrados.map((med) => {
                  const isExpanded = expandedMeds.has(med.id);

                  return (
                    <React.Fragment key={med.id}>
                      {/* Linha Principal do Medicamento */}
                      <tr
                        onClick={() => toggleExpand(med.id)}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60",
                          isExpanded && "bg-slate-50/80 dark:bg-slate-800/40"
                        )}
                      >
                        <td className="py-2.5 px-3 text-center no-print text-slate-400">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-indigo-600 inline-block" />
                          ) : (
                            <ChevronRight className="w-4 h-4 inline-block" />
                          )}
                        </td>

                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 font-semibold">
                          {med.codigo || "S/C"}
                        </td>

                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                            {med.nome}
                          </div>
                          {med.principio_ativo && (
                            <div className="text-[11px] text-slate-500 italic">
                              {med.principio_ativo}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {med.isMav && (
                              <Badge className="bg-red-50 text-red-700 border-red-200 text-[9px] py-0 px-1">
                                MAV
                              </Badge>
                            )}
                            {med.isPsico && (
                              <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-[9px] py-0 px-1">
                                Portaria 344
                              </Badge>
                            )}
                            {med.isAnti && (
                              <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] py-0 px-1">
                                Antimicrobiano
                              </Badge>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 font-medium">
                          {med.concentracao ? `${med.concentracao} • ` : ""}
                          {med.apresentacao || "COMPRIMIDO"}
                        </td>

                        <td className="py-2.5 px-3">
                          {med.padronizado ? (
                            <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-bold">
                              Padronizado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-600 border-slate-300 text-[10px]">
                              Não Padronizado
                            </Badge>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right font-bold text-blue-700 dark:text-blue-300 text-sm">
                          {med.saldoCentral.toLocaleString("pt-BR")}
                        </td>

                        <td className="py-2.5 px-3 text-right font-bold text-emerald-700 dark:text-emerald-300 text-sm">
                          {med.saldoSatelite.toLocaleString("pt-BR")}
                        </td>

                        <td className="py-2.5 px-3 text-right font-extrabold text-indigo-950 dark:text-indigo-100 text-base bg-indigo-50/50 dark:bg-indigo-950/20">
                          {med.saldoTotal.toLocaleString("pt-BR")}
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-mono font-bold",
                              med.lotes.length > 0 ? "bg-slate-50 text-slate-700 border-slate-300" : "bg-red-50 text-red-700 border-red-200"
                            )}
                          >
                            {med.lotes.length} {med.lotes.length === 1 ? "lote" : "lotes"}
                          </Badge>
                        </td>
                      </tr>

                      {/* Detalhamento de Lotes Físicos (Quando Expandido) */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 dark:bg-slate-950/50">
                          <td colSpan={9} className="p-3 pl-12 pr-6">
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs space-y-2">
                              <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 pb-2 border-b border-slate-100 dark:border-slate-800">
                                <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                                  <Layers className="w-3.5 h-3.5" />
                                  Detalhamento de Lotes Físicos e Validades Cadastradas:
                                </span>
                                <span className="text-[11px] text-slate-400 font-normal">
                                  {med.lotes.length} lote(s) registrado(s)
                                </span>
                              </div>

                              {med.lotes.length === 0 ? (
                                <p className="text-xs text-slate-500 italic py-2">
                                  Nenhum lote físico individual cadastrado para este medicamento.
                                </p>
                              ) : (
                                <table className="w-full text-xs border-collapse">
                                  <thead>
                                    <tr className="text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800 text-[11px]">
                                      <th className="py-1.5 text-left">Número do Lote</th>
                                      <th className="py-1.5 text-left">Data de Validade</th>
                                      <th className="py-1.5 text-left">Situação / Validade</th>
                                      <th className="py-1.5 text-right text-blue-600">Qtd Central</th>
                                      <th className="py-1.5 text-right text-emerald-600">Qtd Satélite</th>
                                      <th className="py-1.5 text-right text-slate-800 dark:text-slate-100 font-bold">
                                        Total do Lote
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                                    {med.lotes.map((lote) => {
                                      const validadeFmt = lote.parsedValidade
                                        ? format(lote.parsedValidade, "dd/MM/yyyy")
                                        : lote.data_validade || "-";

                                      return (
                                        <tr key={lote.id} className="hover:bg-slate-50/50">
                                          <td className="py-2 font-mono font-bold text-slate-800 dark:text-slate-200">
                                            {lote.numero_lote || "S/ Lote"}
                                          </td>

                                          <td className="py-2 text-slate-600 dark:text-slate-300">
                                            {validadeFmt}
                                          </td>

                                          <td className="py-2">
                                            {lote.vencido ? (
                                              <Badge className="bg-red-50 text-red-700 border-red-300 text-[10px] font-bold gap-1">
                                                <XCircle className="w-3 h-3 text-red-600" />
                                                Vencido ({Math.abs(lote.diasParaVencer)}d atrás)
                                              </Badge>
                                            ) : lote.diasParaVencer <= 60 ? (
                                              <Badge className="bg-amber-50 text-amber-700 border-amber-300 text-[10px] font-bold gap-1">
                                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                                Vence em {lote.diasParaVencer} dias
                                              </Badge>
                                            ) : (
                                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] font-bold gap-1">
                                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                Válido ({lote.diasParaVencer} dias)
                                              </Badge>
                                            )}
                                          </td>

                                          <td className="py-2 text-right font-mono font-bold text-blue-700 dark:text-blue-300">
                                            {lote.qtdCentral.toLocaleString("pt-BR")}
                                          </td>

                                          <td className="py-2 text-right font-mono font-bold text-emerald-700 dark:text-emerald-300">
                                            {lote.qtdSatelite.toLocaleString("pt-BR")}
                                          </td>

                                          <td className="py-2 text-right font-mono font-black text-slate-900 dark:text-slate-100">
                                            {lote.qtdTotalLote.toLocaleString("pt-BR")} un
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
