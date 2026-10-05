import { normalizeSearch } from "@/utils/searchUtils";
import { useState, useMemo } from "react";
import { db } from "@/api/db";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  Download, 
  Printer, 
  User, 
  Boxes, 
  Package, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ArrowUpDown, 
  ShieldAlert, 
  Copy, 
  Check, 
  RefreshCw, 
  Layers, 
  Pill, 
  Sparkles, 
  X,
  ChevronRight,
  TrendingDown,
  Building2,
  Calendar
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { differenceInDays, format } from "date-fns";
import { safeFormatDate, safeParseISO } from "@/utils/dateUtils";
import { isMav, isPsicotropico } from "@/utils/mavUtils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_COLORS = {
  disponivel: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
  vencendo: "bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800",
  vencido: "bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300 border border-red-200 dark:border-red-800 font-bold",
  esgotado: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700",
};

export default function SateliteEstoque() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [copiedCode, setCopiedCode] = useState(null);
  const [statusFilter, setStatusFilter] = useState("todos"); // "todos", "com_saldo", "alerta_minimo", "sem_saldo", "mav", "psico", "vencendo"
  const [sortBy, setSortBy] = useState("nome_asc"); // "nome_asc", "saldo_desc", "saldo_asc", "central_desc", "validade_asc"
  const hoje = new Date();

  const { data: medicamentos = [], isLoading: loadingMeds, isRefetching } = useQuery({
    queryKey: ['medicamentos'],
    queryFn: () => db.entities.Medicamento.list(),
  });

  const { data: lotes = [], isLoading: loadingLotes } = useQuery({
    queryKey: ['lotes'],
    queryFn: () => db.entities.Lote.list(),
  });

  const isLoading = loadingMeds || loadingLotes;

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['medicamentos'] });
    await queryClient.invalidateQueries({ queryKey: ['lotes'] });
    toast.success("Dados do estoque satélite atualizados!");
  };

  const handleCopyCode = (codigo, e) => {
    e.stopPropagation();
    if (!codigo) return;
    navigator.clipboard.writeText(codigo);
    setCopiedCode(codigo);
    toast.success(`Código ${codigo} copiado!`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Filtrar e agrupar medicamentos da satélite
  const estoqueSatelite = useMemo(() => {
    return medicamentos
      .filter(m => m.ativo !== false && !m.deleted_at)
      .map(med => {
        const lotesDoMed = lotes
          .filter(l => l.medicamento_id === med.id)
          .map(l => {
            const parsedValidade = safeParseISO(l.data_validade);
            const vencido = parsedValidade ? parsedValidade < hoje : false;
            const diasParaVencer = parsedValidade ? differenceInDays(parsedValidade, hoje) : 999;
            const vencendo = !vencido && diasParaVencer <= 30;
            
            let statusCalculado = "disponivel";
            if (vencido) statusCalculado = "vencido";
            else if (l.quantidade_atual <= 0) statusCalculado = "esgotado";
            else if (vencendo) statusCalculado = "vencendo";

            return {
              ...l,
              vencido,
              vencendo,
              diasParaVencer,
              statusCalculado,
            };
          })
          .sort((a, b) => {
            const da = safeParseISO(a.data_validade);
            const db = safeParseISO(b.data_validade);
            if (!da) return 1;
            if (!db) return -1;
            return da - db;
          });

        const saldoSat = Number(med.estoque_satelite) || 0;
        const estoqueMin = Number(med.estoque_minimo) || 0;
        const temAlerta = saldoSat > 0 && estoqueMin > 0 && saldoSat <= estoqueMin;
        const zerado = saldoSat <= 0;
        const temVencido = lotesDoMed.some(l => l.vencido && l.quantidade_atual > 0);
        const temVencendo = lotesDoMed.some(l => l.vencendo && l.quantidade_atual > 0);

        return {
          ...med,
          lotes: lotesDoMed,
          saldoSat,
          estoqueMin,
          temAlerta,
          zerado,
          temVencido,
          temVencendo,
        };
      });
  }, [medicamentos, lotes, hoje]);

  // Estatísticas Gerais (KPIs)
  const stats = useMemo(() => {
    const totalItens = estoqueSatelite.length;
    const totalUnidadesSatelite = estoqueSatelite.reduce((acc, m) => acc + (Number(m.estoque_satelite) || 0), 0);
    const totalUnidadesCentral = estoqueSatelite.reduce((acc, m) => acc + (Number(m.estoque_atual) || 0), 0);
    const comSaldo = estoqueSatelite.filter(m => (m.estoque_satelite || 0) > 0).length;
    const zerados = estoqueSatelite.filter(m => (m.estoque_satelite || 0) <= 0).length;
    const estoqueBaixo = estoqueSatelite.filter(m => m.temAlerta).length;
    const lotesCriticos = estoqueSatelite.filter(m => m.temVencido || m.temVencendo).length;
    const padronizadosCount = estoqueSatelite.filter(m => m.padronizado !== false).length;

    return {
      totalItens,
      totalUnidadesSatelite,
      totalUnidadesCentral,
      comSaldo,
      zerados,
      estoqueBaixo,
      lotesCriticos,
      padronizadosCount,
      taxaDisponibilidade: totalItens > 0 ? Math.round((comSaldo / totalItens) * 100) : 0
    };
  }, [estoqueSatelite]);

  // Filtragem composta
  const filteredEstoque = useMemo(() => {
    const term = normalizeSearch(search);
    const terms = term ? term.split(/\s+/).filter(Boolean) : [];

    let list = estoqueSatelite.filter(med => {
      // Busca composta
      if (terms.length > 0) {
        const fullText = normalizeSearch(`${med.nome || ""} ${med.principio_ativo || ""} ${med.codigo || ""} ${med.concentracao || ""} ${med.unidade_medida || ""} ${med.apresentacao || ""}`);
        const matchesSearch = terms.every(t => fullText.includes(t));
        if (!matchesSearch) return false;
      }

      // Filtros rápidos
      if (statusFilter === "com_saldo" && med.saldoSat <= 0) return false;
      if (statusFilter === "sem_saldo" && med.saldoSat > 0) return false;
      if (statusFilter === "alerta_minimo" && !med.temAlerta) return false;
      if (statusFilter === "mav" && !isMav(med)) return false;
      if (statusFilter === "psico" && !isPsicotropico(med.grupo_terapeutico)) return false;
      if (statusFilter === "vencendo" && !med.temVencendo && !med.temVencido) return false;

      return true;
    });

    // Ordenação
    list.sort((a, b) => {
      if (sortBy === "nome_asc") return (a.nome || "").localeCompare(b.nome || "");
      if (sortBy === "saldo_desc") return (b.saldoSat || 0) - (a.saldoSat || 0);
      if (sortBy === "saldo_asc") return (a.saldoSat || 0) - (b.saldoSat || 0);
      if (sortBy === "central_desc") return (Number(b.estoque_atual) || 0) - (Number(a.estoque_atual) || 0);
      if (sortBy === "validade_asc") {
        const validadeA = a.lotes?.[0]?.data_validade || "9999-99-99";
        const validadeB = b.lotes?.[0]?.data_validade || "9999-99-99";
        return validadeA.localeCompare(validadeB);
      }
      return 0;
    });

    return list;
  }, [estoqueSatelite, search, statusFilter, sortBy]);

  const padronizados = useMemo(() => filteredEstoque.filter(m => m.padronizado !== false), [filteredEstoque]);
  const naoPadronizados = useMemo(() => filteredEstoque.filter(m => m.padronizado === false), [filteredEstoque]);

  const handleExportCSV = () => {
    try {
      const headers = [
        "Código", 
        "Medicamento", 
        "Concentração", 
        "Apresentação", 
        "Estoque Satélite", 
        "Estoque Central", 
        "Estoque Mínimo",
        "Status Saldo",
        "Padronizado",
        "MAV",
        "Controlado"
      ];
      const rows = filteredEstoque.map(med => [
        med.codigo || "S/C",
        med.nome,
        med.concentracao || med.unidade_medida || "-",
        med.apresentacao || "-",
        med.saldoSat,
        med.estoque_atual || 0,
        med.estoqueMin || "-",
        med.zerado ? "Zerado" : med.temAlerta ? "Abaixo do Mínimo" : "Normal",
        med.padronizado !== false ? "Sim" : "Não",
        isMav(med) ? "Sim" : "Não",
        isPsicotropico(med.grupo_terapeutico) ? "Sim" : "Não"
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      ].join("\n");

      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `estoque-satelite-${format(hoje, "dd-MM-yyyy-HHmm")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Relatório de estoque exportado com sucesso!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao exportar CSV");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="p-6 sm:p-8 space-y-6 max-w-7xl mx-auto">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  const renderMedList = (items) => {
    if (items.length === 0) {
      return (
        <Card className="p-12 text-center bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Boxes className="w-8 h-8" />
          </div>
          <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">Nenhum medicamento encontrado</h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1 mb-5">
            Nenhum item corresponde aos critérios de pesquisa ou filtros selecionados para a Farmácia Satélite.
          </p>
          {(search || statusFilter !== "todos") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setStatusFilter("todos");
              }}
              className="text-xs font-semibold rounded-xl"
            >
              <X className="w-3.5 h-3.5 mr-1.5" />
              Limpar Pesquisa e Filtros
            </Button>
          )}
        </Card>
      );
    }

    return (
      <div className="space-y-3">
        <Accordion type="multiple" className="w-full space-y-3">
          {items.map(med => {
            const hasSatelite = med.saldoSat > 0;
            const hasLotes = med.lotes && med.lotes.length > 0;
            const loteMaisProximo = hasLotes ? med.lotes[0] : null;

            // Borda e cores de status
            let borderAccentClass = "border-l-4 border-l-slate-300 dark:border-l-slate-700";
            let statusPill = (
              <Badge variant="outline" className="text-[10px] bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 font-semibold px-2 py-0.5">
                Zerado no Posto
              </Badge>
            );

            if (med.temVencido) {
              borderAccentClass = "border-l-4 border-l-red-500";
              statusPill = (
                <Badge className="text-[10px] bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 border border-red-300 dark:border-red-800 font-bold px-2 py-0.5">
                  Lote Vencido
                </Badge>
              );
            } else if (med.temAlerta) {
              borderAccentClass = "border-l-4 border-l-amber-500";
              statusPill = (
                <Badge className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-bold px-2 py-0.5">
                  Estoque Baixo
                </Badge>
              );
            } else if (hasSatelite) {
              borderAccentClass = "border-l-4 border-l-emerald-500";
              statusPill = (
                <Badge className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold px-2 py-0.5">
                  Saldo Ativo
                </Badge>
              );
            }

            return (
              <AccordionItem 
                key={med.id} 
                value={med.id} 
                className={cn(
                  "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-900/60 transition-all duration-200 overflow-hidden",
                  borderAccentClass
                )}
              >
                <AccordionTrigger className="hover:no-underline py-4 px-4 sm:px-5 group cursor-pointer">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between w-full gap-4 pr-3">
                    
                    {/* Informações Principais do Medicamento */}
                    <div className="flex items-start gap-3.5 min-w-0">
                      {/* Código com Cópia Rápida */}
                      <button
                        type="button"
                        onClick={(e) => handleCopyCode(med.codigo, e)}
                        title="Clique para copiar código"
                        className="group/code relative font-mono text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 dark:hover:bg-indigo-950/50 transition-colors shrink-0 flex items-center gap-1.5 mt-0.5"
                      >
                        <span>{med.codigo || "S/C"}</span>
                        {copiedCode === med.codigo ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3 opacity-40 group-hover/code:opacity-100 transition-opacity" />
                        )}
                      </button>

                      <div className="text-left min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn(
                            "font-bold text-sm sm:text-base leading-snug break-words",
                            isMav(med) ? "text-red-600 dark:text-red-400 font-black" : "text-slate-900 dark:text-white"
                          )}>
                            {med.nome}
                          </span>

                          {/* Badges de Segurança e Atenção */}
                          {isMav(med) && (
                            <Badge className="bg-gradient-to-r from-red-600 to-rose-600 text-white font-black text-[10px] px-2 py-0.5 rounded-lg shadow-xs flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3" />
                              MAV
                            </Badge>
                          )}

                          {isPsicotropico(med.grupo_terapeutico) && (
                            <Badge className="bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800 text-[10px] px-2 py-0.5 rounded-lg flex items-center gap-1 font-semibold">
                              <User className="w-3 h-3" />
                              Portaria 344
                            </Badge>
                          )}

                          {statusPill}
                        </div>

                        {/* Metadados: Concentração, Apresentação e Forma */}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                          <span className="font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md">
                            {med.concentracao || med.unidade_medida || "Dose não especificada"}
                          </span>
                          
                          {med.apresentacao && (
                            <span className="text-slate-600 dark:text-slate-300 font-medium">
                              • {med.apresentacao}
                            </span>
                          )}

                          {med.principio_ativo && med.principio_ativo !== med.nome && (
                            <span className="text-slate-400 dark:text-slate-500 italic truncate max-w-xs">
                              ({med.principio_ativo})
                            </span>
                          )}

                          {hasLotes && loteMaisProximo && (
                            <span className="text-[11px] text-slate-400 flex items-center gap-1 ml-auto lg:ml-2">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              Validade FEFO: <strong className={cn(
                                loteMaisProximo.vencido ? "text-red-600" : loteMaisProximo.diasParaVencer <= 30 ? "text-amber-600" : "text-slate-600 dark:text-slate-300"
                              )}>{safeFormatDate(loteMaisProximo.data_validade)}</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Blocos de Saldo Central vs Satélite */}
                    <div className="flex items-center gap-3 sm:gap-4 shrink-0 justify-end pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100 dark:border-slate-800">
                      
                      {/* Box Estoque Central */}
                      <div className="text-right px-3 sm:px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 min-w-[105px]">
                        <div className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 flex items-center justify-end gap-1">
                          <Building2 className="w-3 h-3" />
                          Central
                        </div>
                        <div className="text-sm sm:text-base font-extrabold text-slate-700 dark:text-slate-200 font-mono mt-0.5">
                          {med.estoque_atual || 0} <span className="text-[10px] text-slate-400 font-normal">un</span>
                        </div>
                      </div>

                      {/* Box Estoque Satélite (Foco Principal) */}
                      <div className={cn(
                        "text-right px-4 py-2 rounded-xl min-w-[125px] transition-all",
                        hasSatelite
                          ? "bg-gradient-to-br from-indigo-50 via-indigo-50/60 to-purple-50/40 dark:from-indigo-950/40 dark:to-purple-950/20 border border-indigo-200/80 dark:border-indigo-800/50"
                          : "bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800"
                      )}>
                        <div className="text-[10px] uppercase font-black text-indigo-700 dark:text-indigo-400 flex items-center justify-end gap-1">
                          <Sparkles className="w-3 h-3" />
                          Satélite
                        </div>
                        <div className={cn(
                          "text-xl sm:text-2xl font-black font-mono tracking-tight",
                          med.temAlerta 
                            ? "text-amber-600 dark:text-amber-400" 
                            : hasSatelite 
                              ? "text-indigo-600 dark:text-indigo-400" 
                              : "text-slate-400 dark:text-slate-600"
                        )}>
                          {med.saldoSat}
                          <span className="text-xs font-semibold ml-1 text-slate-500 dark:text-slate-400">un</span>
                        </div>
                      </div>

                      <div className="p-1 rounded-lg text-slate-400 group-hover:text-indigo-600 transition-colors hidden sm:block">
                        <ChevronRight className="w-5 h-5 group-data-[state=open]:rotate-90 transition-transform duration-200" />
                      </div>
                    </div>

                  </div>
                </AccordionTrigger>

                {/* Conteúdo Expandido: Lotes e Detalhes */}
                <AccordionContent className="pt-2 pb-5 px-4 sm:px-6 bg-slate-50/50 dark:bg-slate-950/40 border-t border-slate-100 dark:border-slate-800">
                  <div className="space-y-4">
                    
                    {/* Header da Seção de Lotes */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-lg">
                          <Package className="w-4 h-4" />
                        </div>
                        <div>
                          <h5 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                            Rastreamento de Lotes & Validades FEFO
                          </h5>
                          <p className="text-[11px] text-slate-400">
                            Dispensação prioritária pelo lote com menor prazo de validade
                          </p>
                        </div>
                      </div>

                      {med.estoqueMin > 0 && (
                        <div className="text-xs text-slate-500 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-2 self-start sm:self-auto">
                          <TrendingDown className="w-3.5 h-3.5 text-amber-500" />
                          <span>Estoque Mínimo de Segurança: <strong>{med.estoqueMin} un</strong></span>
                        </div>
                      )}
                    </div>

                    {/* Tabela de Lotes */}
                    {(!med.lotes || med.lotes.length === 0) ? (
                      <div className="text-center py-8 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-4">
                        <Boxes className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
                        <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                          Nenhum lote físico vinculado no momento
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          As movimentações anteriores podem ter operado em lote padrão ou o item aguarda abastecimento com entrada de lote.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
                        <Table>
                          <TableHeader className="bg-slate-100/70 dark:bg-slate-800/60">
                            <TableRow>
                              <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 py-2.5">Número do Lote</TableHead>
                              <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 py-2.5">Data de Validade</TableHead>
                              <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 py-2.5">Tempo Restante</TableHead>
                              <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 py-2.5 text-center">Qtd Atual no Lote</TableHead>
                              <TableHead className="text-xs font-bold text-slate-700 dark:text-slate-300 py-2.5 text-right">Status do Lote</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {med.lotes.map((lote, lIdx) => {
                              const isFefoFirst = lIdx === 0 && lote.quantidade_atual > 0 && !lote.vencido;

                              return (
                                <TableRow 
                                  key={lote.id}
                                  className={cn(
                                    "transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40",
                                    isFefoFirst && "bg-emerald-50/40 dark:bg-emerald-950/20"
                                  )}
                                >
                                  {/* Lote */}
                                  <TableCell className="py-2.5 font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                                    <div className="flex items-center gap-1.5">
                                      <span>{lote.numero_lote || "S/LOTE"}</span>
                                      {isFefoFirst && (
                                        <Badge className="bg-emerald-600 text-white text-[9px] font-black px-1.5 py-0 h-4">
                                          FEFO 1º
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>

                                  {/* Validade */}
                                  <TableCell className="py-2.5 text-xs">
                                    <span className={cn(
                                      "font-semibold",
                                      lote.vencido ? "text-red-600 dark:text-red-400 font-bold" : lote.diasParaVencer <= 30 ? "text-amber-600 dark:text-amber-400 font-bold" : "text-slate-700 dark:text-slate-300"
                                    )}>
                                      {safeFormatDate(lote.data_validade)}
                                    </span>
                                  </TableCell>

                                  {/* Dias Restantes */}
                                  <TableCell className="py-2.5 text-xs">
                                    {lote.vencido ? (
                                      <span className="text-red-600 dark:text-red-400 font-black text-[11px] flex items-center gap-1">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        Vencido há {Math.abs(lote.diasParaVencer)} dias
                                      </span>
                                    ) : lote.diasParaVencer <= 30 ? (
                                      <span className="text-amber-600 dark:text-amber-400 font-bold text-[11px] flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" />
                                        Vence em {lote.diasParaVencer} dias
                                      </span>
                                    ) : (
                                      <span className="text-slate-500 dark:text-slate-400 text-[11px]">
                                        Restam {lote.diasParaVencer} dias
                                      </span>
                                    )}
                                  </TableCell>

                                  {/* Qtd Atual */}
                                  <TableCell className="py-2.5 text-center font-mono font-bold text-xs text-slate-800 dark:text-slate-100">
                                    {lote.quantidade_atual || 0} un
                                  </TableCell>

                                  {/* Status */}
                                  <TableCell className="py-2.5 text-right">
                                    <Badge className={cn("text-[10px] font-bold px-2 py-0.5", STATUS_COLORS[lote.statusCalculado])}>
                                      {lote.statusCalculado === "disponivel" ? "Disponível" :
                                       lote.statusCalculado === "vencendo" ? "Vencendo (≤30d)" :
                                       lote.statusCalculado === "vencido" ? "Vencido" : "Esgotado"}
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
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto pb-16">
      
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Farmácia Satélite • Tempo Real
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-600 text-white shadow-md shadow-indigo-600/25">
              <Package className="w-6 h-6" />
            </div>
            Estoque Atual (Satélite)
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 max-w-2xl">
            Gestão visual de saldos de dispensação imediata, lotes por validade FEFO e confronto com o Estoque Central do hospital.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            disabled={isRefetching}
            className="rounded-xl h-10 px-3.5 text-xs font-bold text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 gap-2 cursor-pointer"
          >
            <RefreshCw className={cn("w-4 h-4 text-indigo-600", isRefetching && "animate-spin")} />
            Atualizar
          </Button>

          <Button 
            onClick={handleExportCSV} 
            variant="outline" 
            size="sm"
            className="rounded-xl h-10 px-3.5 text-xs font-bold text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Exportar CSV
          </Button>

          <Button 
            onClick={handlePrint} 
            variant="outline" 
            size="sm"
            className="rounded-xl h-10 px-3.5 text-xs font-bold text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            Imprimir
          </Button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Total Catálogo */}
        <Card className="p-4 sm:p-5 rounded-2xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total de Medicamentos</p>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white font-mono mt-0.5">
              {stats.totalItens}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">{stats.padronizadosCount}</span> padronizados no posto
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Boxes className="w-6 h-6" />
          </div>
        </Card>

        {/* Card 2: Saldo Físico na Satélite */}
        <Card className="p-4 sm:p-5 rounded-2xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Unidades na Satélite</p>
            <div className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 font-mono mt-0.5">
              {stats.totalUnidadesSatelite.toLocaleString("pt-BR")}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
              <span>vs</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">{stats.totalUnidadesCentral.toLocaleString("pt-BR")} un</span>
              <span>na Central</span>
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6" />
          </div>
        </Card>

        {/* Card 3: Disponibilidade */}
        <Card className="p-4 sm:p-5 rounded-2xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Itens com Saldo</p>
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
              {stats.comSaldo}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
              <span className="font-bold text-emerald-600">{stats.taxaDisponibilidade}%</span> do catálogo com saldo imediato
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </Card>

        {/* Card 4: Alertas e Vencimentos */}
        <Card className="p-4 sm:p-5 rounded-2xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Atenção & Vencimentos</p>
            <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">
              {stats.estoqueBaixo + stats.lotesCriticos}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
              <span className="font-bold text-amber-600">{stats.estoqueBaixo}</span> baixo estoque • <span className="font-bold text-red-500">{stats.lotesCriticos}</span> lotes
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </Card>

      </div>

      {/* Barra de Pesquisa, Ordenação e Filtros Interativos */}
      <Card className="p-4 sm:p-5 rounded-3xl border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
        
        <div className="flex flex-col md:flex-row gap-3">
          {/* Input de Busca */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <Input
              placeholder="Buscar por nome comercial, dosagem (ex: 500mg), apresentação, princípio ativo ou código..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-9 h-11 text-xs sm:text-sm rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 focus:bg-white dark:focus:bg-slate-900 transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Seletor de Ordenação */}
          <div className="flex items-center gap-2 self-end md:self-auto w-full md:w-auto">
            <div className="flex items-center gap-1.5 px-3 h-11 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-semibold text-slate-600 dark:text-slate-300 shrink-0">
              <ArrowUpDown className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Ordenar:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
              >
                <option value="nome_asc" className="bg-white dark:bg-slate-900">Nome (A - Z)</option>
                <option value="saldo_desc" className="bg-white dark:bg-slate-900">Maior Saldo Satélite</option>
                <option value="saldo_asc" className="bg-white dark:bg-slate-900">Menor Saldo Satélite</option>
                <option value="central_desc" className="bg-white dark:bg-slate-900">Maior Saldo Central</option>
                <option value="validade_asc" className="bg-white dark:bg-slate-900">Validade Mais Próxima</option>
              </select>
            </div>
          </div>
        </div>

        {/* Filtros Rápidos (Chips Pills) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pt-1 border-t border-slate-100 dark:border-slate-800">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setStatusFilter("todos")}
            className={cn(
              "h-8 text-xs font-bold rounded-xl px-3 whitespace-nowrap transition-all cursor-pointer",
              statusFilter === "todos"
                ? "bg-indigo-600 text-white shadow-xs hover:bg-indigo-700 hover:text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            )}
          >
            Todos ({estoqueSatelite.length})
          </Button>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setStatusFilter("com_saldo")}
            className={cn(
              "h-8 text-xs font-bold rounded-xl px-3 whitespace-nowrap transition-all cursor-pointer gap-1.5",
              statusFilter === "com_saldo"
                ? "bg-emerald-600 text-white shadow-xs hover:bg-emerald-700 hover:text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Com Saldo ({stats.comSaldo})
          </Button>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setStatusFilter("alerta_minimo")}
            className={cn(
              "h-8 text-xs font-bold rounded-xl px-3 whitespace-nowrap transition-all cursor-pointer gap-1.5",
              statusFilter === "alerta_minimo"
                ? "bg-amber-600 text-white shadow-xs hover:bg-amber-700 hover:text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            )}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            Estoque Baixo ({stats.estoqueBaixo})
          </Button>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setStatusFilter("sem_saldo")}
            className={cn(
              "h-8 text-xs font-bold rounded-xl px-3 whitespace-nowrap transition-all cursor-pointer gap-1.5",
              statusFilter === "sem_saldo"
                ? "bg-slate-700 text-white shadow-xs hover:bg-slate-800 hover:text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            )}
          >
            Sem Saldo ({stats.zerados})
          </Button>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setStatusFilter("mav")}
            className={cn(
              "h-8 text-xs font-bold rounded-xl px-3 whitespace-nowrap transition-all cursor-pointer gap-1.5",
              statusFilter === "mav"
                ? "bg-red-600 text-white shadow-xs hover:bg-red-700 hover:text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            )}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            MAV
          </Button>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setStatusFilter("psico")}
            className={cn(
              "h-8 text-xs font-bold rounded-xl px-3 whitespace-nowrap transition-all cursor-pointer gap-1.5",
              statusFilter === "psico"
                ? "bg-purple-600 text-white shadow-xs hover:bg-purple-700 hover:text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            )}
          >
            <User className="w-3.5 h-3.5 text-purple-500" />
            Portaria 344
          </Button>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setStatusFilter("vencendo")}
            className={cn(
              "h-8 text-xs font-bold rounded-xl px-3 whitespace-nowrap transition-all cursor-pointer gap-1.5",
              statusFilter === "vencendo"
                ? "bg-orange-600 text-white shadow-xs hover:bg-orange-700 hover:text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            )}
          >
            <Clock className="w-3.5 h-3.5 text-orange-500" />
            Vencimentos Próximos ({stats.lotesCriticos})
          </Button>
        </div>

      </Card>

      {/* Tabs Principais com Cabeçalho e Contadores */}
      <Tabs defaultValue="todos" className="w-full">
        <TabsList className="h-11 bg-slate-200/70 dark:bg-slate-800/80 p-1 rounded-2xl mb-4 w-full sm:w-auto">
          <TabsTrigger 
            value="todos" 
            className="rounded-xl font-bold text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-indigo-600 data-[state=active]:shadow-xs px-4 cursor-pointer"
          >
            Todos os Itens ({filteredEstoque.length})
          </TabsTrigger>
          <TabsTrigger 
            value="padronizados" 
            className="rounded-xl font-bold text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-emerald-600 data-[state=active]:shadow-xs px-4 cursor-pointer"
          >
            Padronizados ({padronizados.length})
          </TabsTrigger>
          <TabsTrigger 
            value="nao_padronizados" 
            className="rounded-xl font-bold text-xs data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:text-purple-600 data-[state=active]:shadow-xs px-4 cursor-pointer"
          >
            Não Padronizados ({naoPadronizados.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="todos" className="space-y-4 focus-visible:outline-none">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
            <span>Mostrando <strong>{filteredEstoque.length}</strong> medicamentos na Satélite</span>
            <span>Clique sobre o item para detalhar lotes e validades</span>
          </div>
          {renderMedList(filteredEstoque)}
        </TabsContent>

        <TabsContent value="padronizados" className="space-y-4 focus-visible:outline-none">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
            <span>Medicamentos do protocolo institucional de padronização</span>
            <span>Mostrando <strong>{padronizados.length}</strong> itens</span>
          </div>
          {renderMedList(padronizados)}
        </TabsContent>

        <TabsContent value="nao_padronizados" className="space-y-4 focus-visible:outline-none">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
            <span>Medicamentos especiais, adiantamentos e não padronizados</span>
            <span>Mostrando <strong>{naoPadronizados.length}</strong> itens</span>
          </div>
          {renderMedList(naoPadronizados)}
        </TabsContent>
      </Tabs>

    </div>
  );
}
