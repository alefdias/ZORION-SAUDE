import { useState, useMemo } from "react";
import Saidas from "./Saidas";
import { db } from "@/api/db";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, RotateCcw, PackageMinus, CalendarCheck, User, ShoppingCart } from "lucide-react";
import { PedidosSateliteManager } from "@/components/PedidosSateliteManager";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { safeFormatDate } from "@/utils/dateUtils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { startOfDay } from "date-fns";

// ─── Aba: Devoluções ──────────────────────────────────────────────────────────
function PainelDevolucoes() {
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState({ from: undefined, to: undefined });

  const { data: entradas = [], isLoading } = useQuery({
    queryKey: ['entradas'],
    queryFn: () => db.entities.Entrada.list('-created_date'),
  });

  const { data: medicamentos = [] } = useQuery({
    queryKey: ['medicamentos'],
    queryFn: () => db.entities.Medicamento.list(),
  });

  const medicamentosMap = useMemo(() => {
    const map = {};
    medicamentos.forEach(m => { map[m.id] = m; });
    return map;
  }, [medicamentos]);

  // Filtra apenas entradas que são devoluções
  const devolucoes = useMemo(() => {
    const searchLow = search.toLowerCase();

    return (entradas || [])
      .filter(e => {
        const iDev = e.fornecedor_nome?.toLowerCase().includes("devolução") ||
                     e.fornecedor_nome?.toLowerCase().includes("devolvido") ||
                     e.numero_lote === "DEVOLVIDO";
        if (!iDev) return false;

        // Busca por texto
        const matchSearch = !searchLow ||
          e.medicamento_nome?.toLowerCase().includes(searchLow) ||
          e.fornecedor_nome?.toLowerCase().includes(searchLow) ||
          e.numero_lote?.toLowerCase().includes(searchLow);

        // Filtro por data
        let matchDate = true;
        if (dateRange?.from) {
          const dateStr = e.data_entrada?.split('T')[0];
          const date = parseISO(dateStr);
          const from = startOfDay(dateRange.from);
          const to = dateRange.to ? dateRange.to : startOfDay(dateRange.from);
          matchDate = date.getTime() >= from.getTime() && date.getTime() <= (to.getTime() + 86400000);
        }

        return matchSearch && matchDate;
      });
  }, [entradas, search, dateRange]);

  const totalUnidades = useMemo(
    () => devolucoes.reduce((acc, d) => acc + (d.quantidade || 0), 0),
    [devolucoes]
  );

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-emerald-600" />
            Devoluções para a Farmácia Satélite
          </h2>
          <p className="text-slate-500 text-sm mt-0.5">
            Medicamentos devolvidos por pacientes — registros de retorno ao estoque satélite
          </p>
        </div>

        {/* Totalizadores */}
        <div className="flex gap-3 shrink-0">
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-center">
            <p className="text-xs text-emerald-600 font-medium">Devoluções</p>
            <p className="text-2xl font-bold text-emerald-700">{devolucoes.length}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-center">
            <p className="text-xs text-blue-600 font-medium">Unidades</p>
            <p className="text-2xl font-bold text-blue-700">{totalUnidades}</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <Card className="p-1.5 border-slate-200 shadow-sm bg-white rounded-xl flex flex-col md:flex-row items-center gap-3">
        <div className="relative w-full flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <Input
            placeholder="Buscar por medicamento, paciente ou lote..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-10 text-sm bg-slate-50 border-slate-200"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "h-10 px-4 flex items-center gap-2 text-xs font-semibold border-slate-200 min-w-[200px] justify-center",
                dateRange?.from ? "text-emerald-700 bg-emerald-50/50 border-emerald-200" : "text-slate-600"
              )}
            >
              <CalendarIcon className={cn("h-4 w-4", dateRange?.from ? "text-emerald-600" : "text-slate-400")} />
              {dateRange?.from
                ? dateRange.to
                  ? `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`
                  : format(dateRange.from, "dd/MM/yyyy")
                : "Filtrar Período..."}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={setDateRange}
              numberOfMonths={2}
              locale={ptBR}
            />
            <div className="p-2 border-t border-slate-100 flex justify-end">
              <Button variant="ghost" size="sm" className="text-xs text-slate-500 hover:text-red-600 font-semibold"
                onClick={() => setDateRange({ from: undefined, to: undefined })}>
                Limpar Período
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </Card>

      {/* Tabela */}
      <Card className="border border-slate-200 shadow-sm rounded-xl overflow-hidden bg-white">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">Data</TableHead>
              <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">Medicamento</TableHead>
              <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">Lote</TableHead>
              <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">Validade</TableHead>
              <TableHead className="text-center text-xs font-bold text-slate-600 uppercase tracking-wider">Qtd</TableHead>
              <TableHead className="text-xs font-bold text-slate-600 uppercase tracking-wider">Origem / Paciente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <TableRow key={i}>
                  {Array(6).fill(0).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : devolucoes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-16">
                  <RotateCcw className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-400 font-medium">Nenhuma devolução registrada</p>
                  <p className="text-slate-400 text-xs mt-1">As devoluções de pacientes aparecerão aqui</p>
                </TableCell>
              </TableRow>
            ) : (
              devolucoes.map((dev) => {
                const med = medicamentosMap[dev.medicamento_id];
                // Extrair nome do paciente de fornecedor_nome
                const origem = dev.fornecedor_nome || "-";
                const isPaciente = origem.toLowerCase().includes("paciente:");

                // Validade
                const validadeStr = dev.data_validade;
                let validadeFmt = "—";
                if (validadeStr) {
                  try {
                    const d = parseISO(validadeStr);
                    if (isValid(d)) validadeFmt = format(d, "dd/MM/yyyy", { locale: ptBR });
                  } catch { validadeFmt = validadeStr; }
                }

                return (
                  <TableRow key={dev.id} className="hover:bg-emerald-50/30">
                    <TableCell className="text-slate-600 text-sm whitespace-nowrap">
                      {safeFormatDate(dev.data_entrada)}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-slate-800 text-sm">{dev.medicamento_nome}</p>
                      {med?.concentracao && (
                        <p className="text-xs text-slate-400">{med.concentracao}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {dev.numero_lote || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {validadeStr ? (
                        <span className="flex items-center gap-1 text-sm text-slate-600">
                          <CalendarCheck className="w-3.5 h-3.5 text-emerald-500" />
                          {validadeFmt}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-emerald-100 text-emerald-700 font-bold">
                        +{dev.quantidade}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px]">
                      <div className="flex items-start gap-1.5">
                        {isPaciente && <User className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />}
                        <span className="text-xs text-slate-600 leading-snug break-words">{origem}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function SateliteMovimentacoes() {
  const [activeTab, setActiveTab] = useState("pedidos");

  return (
    <div className="w-full h-full bg-slate-50/50 dark:bg-slate-950 flex flex-col">
      {/* Tabs */}
      <div className="flex gap-0 border-b border-slate-200 bg-white px-4 shrink-0">
        <button
          onClick={() => setActiveTab("pedidos")}
          className={cn(
            "flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors",
            activeTab === "pedidos"
              ? "border-indigo-600 text-indigo-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          <ShoppingCart className="w-4 h-4 text-indigo-600" />
          Pedidos à Central
        </button>
        <button
          onClick={() => setActiveTab("devolucoes")}
          className={cn(
            "flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors",
            activeTab === "devolucoes"
              ? "border-emerald-500 text-emerald-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          <RotateCcw className="w-4 h-4" />
          Devoluções
        </button>
        <button
          onClick={() => setActiveTab("saidas")}
          className={cn(
            "flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors",
            activeTab === "saidas"
              ? "border-blue-500 text-blue-700 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          <PackageMinus className="w-4 h-4" />
          Saídas
        </button>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-auto">
        {activeTab === "pedidos" ? (
          <div className="p-6">
            <PedidosSateliteManager mode="satelite" />
          </div>
        ) : activeTab === "devolucoes" ? (
          <PainelDevolucoes />
        ) : (
          <Saidas isTab={true} />
        )}
      </div>
    </div>
  );
}
