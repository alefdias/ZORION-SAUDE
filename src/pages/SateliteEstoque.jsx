import { useState, useMemo } from "react";
import { db } from "@/api/db";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, Download, Printer, User, Boxes, Package } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { differenceInDays, format } from "date-fns";
import { safeFormatDate, safeParseISO } from "@/utils/dateUtils";
import { isMav, isPsicotropico } from "@/utils/mavUtils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_COLORS = {
  disponivel: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  vencido: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  esgotado: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

export default function SateliteEstoque() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("padronizados");
  const [displayCount, setDisplayCount] = useState(50);
  const hoje = new Date();

  const { data: medicamentos = [], isLoading: loadingMeds } = useQuery({
    queryKey: ['medicamentos'],
    queryFn: () => db.entities.Medicamento.list(),
  });

  const { data: lotes = [], isLoading: loadingLotes } = useQuery({
    queryKey: ['lotes'],
    queryFn: () => db.entities.Lote.list(),
  });

  const isLoading = loadingMeds || loadingLotes;

  // Filtrar e agrupar medicamentos da satélite
  const estoqueSatelite = useMemo(() => {
    return medicamentos
      .filter(m => m.ativo !== false && ((m.estoque_satelite || 0) > 0 || (m.estoque_atual || 0) > 0))
      .map(med => {
        const lotesDoMed = lotes
          .filter(l => l.medicamento_id === med.id)
          .map(l => {
            const parsedValidade = safeParseISO(l.data_validade);
            const vencido = parsedValidade ? parsedValidade < hoje : false;
            const diasParaVencer = parsedValidade ? differenceInDays(parsedValidade, hoje) : 999;
            return {
              ...l,
              vencido,
              diasParaVencer,
              statusCalculado: vencido ? "vencido" : l.quantidade_atual <= 0 ? "esgotado" : "disponivel",
            };
          })
          .sort((a, b) => {
            const da = safeParseISO(a.data_validade);
            const db = safeParseISO(b.data_validade);
            if (!da) return 1;
            if (!db) return -1;
            return da - db;
          });

        return {
          ...med,
          lotes: lotesDoMed,
          temAlerta: (med.estoque_satelite || 0) <= (med.estoque_minimo || 0),
          temVencido: lotesDoMed.some(l => l.vencido && l.quantidade_atual > 0),
        };
      })
      .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
  }, [medicamentos, lotes]);

  const filteredEstoque = useMemo(() => {
    return estoqueSatelite.filter(med => {
      const matchSearch =
        med.nome?.toLowerCase().includes(search.toLowerCase()) ||
        med.principio_ativo?.toLowerCase().includes(search.toLowerCase()) ||
        med.codigo?.toLowerCase().includes(search.toLowerCase());
      return matchSearch;
    });
  }, [estoqueSatelite, search]);

  const padronizados = useMemo(() => filteredEstoque.filter(m => m.padronizado !== false), [filteredEstoque]);
  const naoPadronizados = useMemo(() => filteredEstoque.filter(m => m.padronizado === false), [filteredEstoque]);

  const handleExportCSV = () => {
    try {
      const headers = ["Código", "Medicamento", "Concentração", "Apresentação", "Estoque Satélite", "Estoque Central", "Padronizado"];
      const rows = filteredEstoque.map(med => [
        med.codigo || "S/C",
        med.nome,
        med.concentracao || "-",
        med.apresentacao || "-",
        med.estoque_satelite || 0,
        med.estoque_atual || 0,
        med.padronizado !== false ? "Sim" : "Não"
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
      ].join("\n");

      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `estoque-satelite-${format(hoje, "dd-MM-yyyy")}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("CSV exportado com sucesso!");
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
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const renderMedList = (items) => {
    if (items.length === 0) {
      return (
        <div className="text-center py-12 text-slate-500 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
          <Boxes className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="font-medium">Nenhum medicamento encontrado na farmácia satélite.</p>
        </div>
      );
    }

    return (
      <Accordion type="multiple" className="w-full bg-white dark:bg-slate-900 rounded-b-xl shadow-sm border border-slate-100 dark:border-slate-800">
        {items.slice(0, displayCount).map(med => (
          <AccordionItem key={med.id} value={med.id} className="border-b border-slate-100 dark:border-slate-800 px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <AccordionTrigger className="hover:no-underline py-2">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="font-mono text-[10px] w-16 justify-center">
                    {med.codigo || "S/C"}
                  </Badge>
                  <div className="text-left">
                    <p className={cn("font-semibold text-slate-800 dark:text-slate-100", isMav(med) && "text-red-600 font-bold flex items-center gap-1.5")}>
                      {med.nome}
                      {isMav(med) && <Badge variant="destructive" className="text-[10px] py-0 px-1">MAV</Badge>}
                      {isPsicotropico(med.grupo_terapeutico) && <User className="inline-block w-4 h-4 ml-1 text-indigo-600" title="Requer nome do paciente" />}
                    </p>
                    <div className="flex gap-2 items-center text-xs mt-1">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                        {med.concentracao ? `Concentração: ${med.concentracao}` : (med.unidade_medida ? `Concentração: ${med.unidade_medida}` : "Concentração não definida")}
                      </span>
                      {med.apresentacao && (
                        <span className="text-slate-500 dark:text-slate-400 font-medium px-2 border-l border-slate-200 dark:border-slate-700">
                          {med.apresentacao}
                        </span>
                      )}
                      {med.temAlerta && (
                        <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-0 text-[10px] px-1 py-0 h-4">
                          Baixo
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right border-r border-slate-200 dark:border-slate-700 pr-6">
                    <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 mb-0.5">Estoque Central</p>
                    <p className="text-base font-bold text-slate-600 dark:text-slate-300">
                      {med.estoque_atual || 0}
                    </p>
                  </div>
                  <div className="text-right min-w-[100px]">
                    <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-0.5">Estoque Satélite</p>
                    <p className={cn("text-xl font-black", med.temAlerta ? "text-amber-600" : "text-indigo-600 dark:text-indigo-400")}>
                      {med.estoque_satelite || 0}
                    </p>
                  </div>
                </div>
              </div>
            </AccordionTrigger>

            <AccordionContent className="pt-4 pb-2">
              {(!med.lotes || med.lotes.length === 0) ? (
                <div className="text-center py-6 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-dashed border-slate-200 dark:border-slate-700">
                  <p className="text-sm text-slate-500">Nenhum lote vinculado registrado no momento.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                    <TableRow>
                      <TableHead>Lote</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead>Qtd Geral</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {med.lotes.map(lote => (
                      <TableRow key={lote.id}>
                        <TableCell className="font-medium">{lote.numero_lote}</TableCell>
                        <TableCell className={cn(lote.vencido ? "text-red-600 font-bold" : lote.diasParaVencer <= 30 ? "text-amber-600 font-bold" : "text-emerald-600 font-bold")}>
                          {safeFormatDate(lote.data_validade)}
                        </TableCell>
                        <TableCell className="font-bold text-slate-700 dark:text-slate-300">
                          {lote.quantidade_atual || 0}
                        </TableCell>
                        <TableCell>
                          <Badge className={STATUS_COLORS[lote.statusCalculado]}>
                            {lote.statusCalculado === "disponivel" ? "Disponível" :
                              lote.statusCalculado === "vencido" ? "Vencido" : "Esgotado"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Package className="w-7 h-7 text-indigo-600" />
            Estoque Atual (Satélite)
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
            Medicamentos disponíveis com visualização de saldo, lotes e validades na farmácia satélite.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExportCSV} variant="outline" className="bg-white dark:bg-slate-800">
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
          <Button onClick={handlePrint} variant="outline" className="bg-white dark:bg-slate-800">
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        </div>
      </div>

      <Card className="p-4 shadow-sm border-slate-200 dark:border-slate-800">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-5 w-5" />
          <Input
            placeholder="Buscar por medicamento, princípio ativo ou código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 text-base"
          />
        </div>
      </Card>

      <Tabs defaultValue="padronizados" onValueChange={setActiveTab}>
        <TabsList className="mb-6 bg-slate-100 dark:bg-slate-800 p-1">
          <TabsTrigger value="padronizados" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm">
            Padronizados ({padronizados.length})
          </TabsTrigger>
          <TabsTrigger value="nao_padronizados" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm">
            Não Padronizados ({naoPadronizados.length})
          </TabsTrigger>
          <TabsTrigger value="todos" className="data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 data-[state=active]:shadow-sm">
            Todos os Itens ({filteredEstoque.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="padronizados" className="space-y-4">
          <Card className="border-0 shadow-sm overflow-hidden p-0 bg-transparent shadow-none">
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-t-xl shadow-sm mb-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Medicamentos Padronizados (Satélite)</h3>
              <p className="text-xs text-slate-500">Clique sobre o medicamento para ver lotes e validades</p>
            </div>
            {renderMedList(padronizados)}
          </Card>
        </TabsContent>

        <TabsContent value="nao_padronizados" className="space-y-4">
          <Card className="border-0 shadow-sm overflow-hidden p-0 bg-transparent shadow-none">
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-t-xl shadow-sm mb-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Medicamentos Não Padronizados (Satélite)</h3>
              <p className="text-xs text-slate-500">Clique sobre o medicamento para ver lotes e validades</p>
            </div>
            {renderMedList(naoPadronizados)}
          </Card>
        </TabsContent>

        <TabsContent value="todos" className="space-y-4">
          <Card className="border-0 shadow-sm overflow-hidden p-0 bg-transparent shadow-none">
            <div className="p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-t-xl shadow-sm mb-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Todos os Medicamentos (Satélite)</h3>
              <p className="text-xs text-slate-500">Clique sobre o medicamento para ver lotes e validades</p>
            </div>
            {renderMedList(filteredEstoque)}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
