import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { db } from "@/api/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { safeFormatDate } from "@/utils/dateUtils";
import { normalizeSearch } from "@/utils/searchUtils";
import { isMav } from "@/utils/mavUtils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDownRight,
  Boxes,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileSpreadsheet,
  PackageMinus,
  Printer,
  Search,
  Users,
  X,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function chaveDoDia(valor) {
  if (!valor) return "";
  if (valor instanceof Date) return format(valor, "yyyy-MM-dd");
  return String(valor).slice(0, 10);
}

function ignorarRegistro(saida) {
  if (!saida || saida.deleted_at) return true;

  const nome = (saida.medicamento_nome || "").toLowerCase();
  const tipo = (saida.tipo || "").toLowerCase();
  const motivo = (saida.motivo || "").toLowerCase();
  const texto = `${saida.status || ""} ${motivo} ${saida.observacao || ""} ${tipo}`.toLowerCase();

  // Logs de auditoria e transferências internas não entram no resumo de dispensação
  if (nome.includes("[log")) return true;
  if (tipo.includes("log")) return true;
  if (motivo === "transferência de estoque" || motivo === "transferencia de estoque") return true;
  if (tipo.includes("transferencia") || tipo.includes("transferência")) return true;

  // Registros cancelados / estornados já não representam dispensação real
  if (texto.includes("cancelad") || texto.includes("estorno") || texto.includes("excluíd") || texto.includes("excluid")) {
    return true;
  }

  return false;
}

function classificarSaida(saida) {
  const destino = (saida.destino || "").toLowerCase();
  const motivo = (saida.motivo || "").toLowerCase();
  const tipo = (saida.tipo || "").toLowerCase();

  const isPerda = destino === "perda" || motivo.includes("perda") || tipo.includes("perda");
  if (isPerda) return "perdas";

  const isPaciente =
    !!saida.paciente_nome ||
    destino.includes("paciente") ||
    motivo.includes("paciente") ||
    tipo.includes("paciente");

  return isPaciente ? "pacientes" : "geral";
}

function formatarApresentacao(med, nome) {
  if (!med) return nome || "";
  const partes = [];
  if (med.concentracao) partes.push(med.concentracao);
  if (med.apresentacao && !partes.some((p) => p.toLowerCase() === med.apresentacao.toLowerCase())) {
    partes.push(med.apresentacao);
  }
  return partes.join(" • ");
}

function escapeCsv(valor) {
  return `"${String(valor ?? "").replace(/"/g, '""')}"`;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function ResumoDiarioDispensacao() {
  const [dataSelecionada, setDataSelecionada] = useState(() => new Date());
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("todas"); // todas | pacientes | geral | perdas
  const [expandidos, setExpandidos] = useState(() => new Set());

  const { data: saidas = [], isLoading } = useQuery({
    queryKey: ["saidas"],
    queryFn: () => db.entities.Saida.list(),
  });

  const { data: medicamentos = [] } = useQuery({
    queryKey: ["medicamentos"],
    queryFn: () => db.entities.Medicamento.list(),
  });

  const medicamentosMap = useMemo(() => {
    const map = new Map();
    (medicamentos || []).forEach((m) => map.set(String(m.id), m));
    return map;
  }, [medicamentos]);

  const diaSelecionado = format(dataSelecionada, "yyyy-MM-dd", { locale: ptBR });

  const mudarDia = (delta) => setDataSelecionada((atual) => addDays(atual, delta));

  // Todas as dispensações reais do dia selecionado
  const saidasDoDia = useMemo(() => {
    return (saidas || []).filter((s) => {
      if (ignorarRegistro(s)) return false;
      const referencia = s.data_saida || s.created_at;
      return chaveDoDia(referencia) === diaSelecionado;
    });
  }, [saidas, diaSelecionado]);

  const contagemCategorias = useMemo(() => {
    const total = { todas: saidasDoDia.length, pacientes: 0, geral: 0, perdas: 0 };
    saidasDoDia.forEach((s) => {
      total[classificarSaida(s)] += 1;
    });
    return total;
  }, [saidasDoDia]);

  const saidasFiltradas = useMemo(() => {
    if (categoria === "todas") return saidasDoDia;
    return saidasDoDia.filter((s) => classificarSaida(s) === categoria);
  }, [saidasDoDia, categoria]);

  // Consolida as saídas por medicamento: 50 registros de Lactulose viram 1 linha com 50 un
  const resumo = useMemo(() => {
    const mapa = new Map();

    saidasFiltradas.forEach((saida) => {
      const med = medicamentosMap.get(String(saida.medicamento_id));
      const chave = saida.medicamento_id
        ? `id:${saida.medicamento_id}`
        : `nome:${normalizeSearch(saida.medicamento_nome || "sem-nome")}`;

      if (!mapa.has(chave)) {
        mapa.set(chave, {
          chave,
          medicamento_id: saida.medicamento_id || null,
          nome: saida.medicamento_nome || med?.nome || "Medicamento não identificado",
          codigo: med?.codigo || "",
          detalhe: formatarApresentacao(med, saida.medicamento_nome),
          unidade: med?.unidade_medida || "un",
          quantidade: 0,
          movimentos: 0,
          lotes: new Set(),
          destinos: new Set(),
          pacientes: new Set(),
          itens: [],
        });
      }

      const grupo = mapa.get(chave);
      grupo.quantidade += Number(saida.quantidade) || 0;
      grupo.movimentos += 1;
      if (saida.numero_lote) grupo.lotes.add(String(saida.numero_lote));

      const destino = String(saida.ala_nome || saida.destino || "").trim();
      if (destino) grupo.destinos.add(destino);
      if (saida.paciente_nome) grupo.pacientes.add(String(saida.paciente_nome).trim());

      grupo.itens.push(saida);
    });

    return Array.from(mapa.values())
      .map((grupo) => ({
        ...grupo,
        lotes: Array.from(grupo.lotes),
        destinos: Array.from(grupo.destinos),
        pacientes: Array.from(grupo.pacientes),
        itens: [...grupo.itens].sort((a, b) =>
          String(a.created_at || a.data_saida || "").localeCompare(String(b.created_at || b.data_saida || ""))
        ),
      }))
      .sort((a, b) => b.quantidade - a.quantidade || a.nome.localeCompare(b.nome));
  }, [saidasFiltradas, medicamentosMap]);

  const resumoFiltrado = useMemo(() => {
    const termo = normalizeSearch(busca);
    if (!termo) return resumo;

    const termos = termo.split(/\s+/).filter(Boolean);
    return resumo.filter((item) => {
      const texto = normalizeSearch(
        `${item.nome} ${item.codigo} ${item.detalhe} ${item.unidade} ${item.lotes.join(" ")} ${item.destinos.join(" ")} ${item.pacientes.join(" ")}`
      );
      return termos.every((t) => texto.includes(t));
    });
  }, [resumo, busca]);

  const totais = useMemo(() => {
    const pacientes = new Set();
    let unidades = 0;
    let movimentos = 0;

    resumoFiltrado.forEach((item) => {
      unidades += item.quantidade;
      movimentos += item.movimentos;
      item.pacientes.forEach((p) => pacientes.add(p));
    });

    return {
      unidades,
      movimentos,
      medicamentos: resumoFiltrado.length,
      pacientes: pacientes.size,
    };
  }, [resumoFiltrado]);

  const alternarDetalhe = (chave) => {
    setExpandidos((anterior) => {
      const proximo = new Set(anterior);
      if (proximo.has(chave)) proximo.delete(chave);
      else proximo.add(chave);
      return proximo;
    });
  };

  const exportarCSV = () => {
    try {
      let csv = "\uFEFF";
      csv += `RESUMO DIÁRIO DE DISPENSAÇÃO — ${format(dataSelecionada, "dd/MM/yyyy")}\n`;
      csv += `Categoria:;${escapeCsv(rotuloCategoria)};Gerado em:;${escapeCsv(format(new Date(), "dd/MM/yyyy HH:mm"))}\n\n`;
      csv += "Código;Medicamento;Apresentação;Unidade;Quantidade Total;Movimentos;Lotes;Alas/Destinos;Pacientes\n";

      resumoFiltrado.forEach((item) => {
        csv += [
          escapeCsv(item.codigo || "S/C"),
          escapeCsv(item.nome),
          escapeCsv(item.detalhe),
          escapeCsv(item.unidade),
          item.quantidade,
          item.movimentos,
          escapeCsv(item.lotes.join(", ")),
          escapeCsv(item.destinos.join(", ")),
          escapeCsv(item.pacientes.join(", ")),
        ].join(";");
        csv += "\n";
      });

      csv += `\nTOTAL;;;;${totais.unidades};${totais.movimentos};;;;\n`;

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `resumo_diario_dispensacao_${diaSelecionado}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Planilha do dia exportada com sucesso!");
    } catch (erro) {
      toast.error("Erro ao exportar planilha: " + (erro.message || erro));
    }
  };

  const rotuloCategoria =
    categoria === "pacientes"
      ? "Dispensações por paciente"
      : categoria === "geral"
        ? "Dispensações gerais / setores"
        : categoria === "perdas"
          ? "Perdas e descartes"
          : "Todas as dispensações";

  const categorias = [
    { id: "todas", rotulo: "Todas", total: contagemCategorias.todas, cor: "bg-slate-900 text-white" },
    { id: "pacientes", rotulo: "Por Pacientes", total: contagemCategorias.pacientes, cor: "bg-indigo-600 text-white" },
    { id: "geral", rotulo: "Gerais / Setores", total: contagemCategorias.geral, cor: "bg-emerald-600 text-white" },
    { id: "perdas", rotulo: "Perdas", total: contagemCategorias.perdas, cor: "bg-rose-600 text-white" },
  ];

  return (
    <div className="space-y-4">
      {/* ─── CONTROLES (NÃO IMPRIMIR) ─── */}
      <div className="no-print space-y-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400">
                <ClipboardList className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  Resumo do Dia
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                    Consolidado
                  </Badge>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Soma tudo o que foi dispensado no dia por medicamento. Ex.: 50 saídas de Lactulose aparecem como uma linha de 50 un.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/60 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => mudarDia(-1)}
                  className="h-8 w-8 text-slate-600 hover:text-blue-700"
                  title="Dia anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-8 px-3 text-xs font-bold bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 gap-1.5"
                    >
                      <CalendarIcon className="w-3.5 h-3.5 text-blue-600" />
                      {format(dataSelecionada, "dd/MM/yyyy")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={dataSelecionada}
                      onSelect={(dia) => dia && setDataSelecionada(dia)}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => mudarDia(1)}
                  className="h-8 w-8 text-slate-600 hover:text-blue-700"
                  title="Próximo dia"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDataSelecionada(new Date())}
                  className="h-8 text-[11px] font-bold text-blue-700 hover:bg-blue-50"
                >
                  Hoje
                </Button>
              </div>

              <Button
                variant="outline"
                onClick={exportarCSV}
                className="h-9 px-3 text-xs font-bold gap-1.5 text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 border-slate-300"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Exportar Excel
              </Button>

              <Button
                onClick={() => window.print()}
                className="h-9 px-4 text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              >
                <Printer className="w-4 h-4" />
                Imprimir Relatório
              </Button>
            </div>
          </div>

          {/* Filtros por categoria + busca */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">Filtrar:</span>
              {categorias.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoria(cat.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer border",
                    categoria === cat.id
                      ? `${cat.cor} border-transparent shadow-xs`
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                  )}
                >
                  {cat.rotulo} ({cat.total})
                </button>
              ))}
            </div>

            <div className="relative w-full md:w-72">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar medicamento, lote, ala ou paciente..."
                className="h-9 pl-8 pr-8 text-xs bg-white dark:bg-slate-900 border-slate-200 rounded-lg"
              />
              {busca && (
                <button
                  onClick={() => setBusca("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* KPIs do dia */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-3.5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Dispensado</span>
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                <PackageMinus className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-blue-700 dark:text-blue-400 mt-1">
              {totais.unidades.toLocaleString("pt-BR")}
              <span className="text-xs font-normal text-slate-500 ml-1">un</span>
            </div>
            <span className="text-[10px] text-slate-400">Soma de todas as saídas do dia</span>
          </Card>

          <Card className="p-3.5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Medicamentos</span>
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                <Boxes className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400 mt-1">{totais.medicamentos}</div>
            <span className="text-[10px] text-slate-400">Itens distintos dispensados</span>
          </Card>

          <Card className="p-3.5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Movimentos</span>
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                <ClipboardList className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-indigo-700 dark:text-indigo-400 mt-1">{totais.movimentos}</div>
            <span className="text-[10px] text-slate-400">Registros de saída somados</span>
          </Card>

          <Card className="p-3.5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pacientes</span>
              <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-1">{totais.pacientes}</div>
            <span className="text-[10px] text-slate-400">Pacientes atendidos no dia</span>
          </Card>
        </div>
      </div>

      {/* ─── TABELA CONSOLIDADA ─── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Dispensação de {format(dataSelecionada, "dd/MM/yyyy")}
            </span>
            <Badge variant="outline" className="text-[10px] bg-slate-50 text-slate-600 border-slate-200">
              {rotuloCategoria}
            </Badge>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            {resumoFiltrado.length} medicamento(s) • {totais.unidades} un
          </span>
        </div>

        <div className="overflow-auto max-h-[62vh]">
          <Table className="min-w-[900px] w-full">
            <TableHeader className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-950/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-8" />
                <TableHead className="w-20 text-[11px] font-bold uppercase tracking-wider text-slate-600">Cód.</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Medicamento</TableHead>
                <TableHead className="text-center text-[11px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">Qtd Total</TableHead>
                <TableHead className="text-center text-[11px] font-bold uppercase tracking-wider text-slate-600">Saídas</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Lotes</TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Destinos / Pacientes</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-14 text-xs text-slate-500">
                    Carregando dispensações...
                  </TableCell>
                </TableRow>
              ) : resumoFiltrado.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-14">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto text-center">
                      <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-3.5 ring-8 ring-blue-50/50 dark:ring-blue-950/20">
                        <PackageMinus className="w-7 h-7" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                        Nenhuma dispensação neste dia
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {busca
                          ? "Nenhum medicamento corresponde ao termo pesquisado."
                          : `Não há saídas registradas em ${format(dataSelecionada, "dd/MM/yyyy")} para o filtro selecionado.`}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                resumoFiltrado.map((item) => {
                  const expandido = expandidos.has(item.chave);
                  const mav = isMav(item.nome);

                  return (
                    <Fragment key={item.chave}>
                      <TableRow
                        onClick={() => alternarDetalhe(item.chave)}
                        className="cursor-pointer hover:bg-blue-50/40 dark:hover:bg-slate-800/40 transition-colors border-b border-slate-100 dark:border-slate-800/60"
                      >
                        <TableCell className="pr-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              alternarDetalhe(item.chave);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-blue-700 hover:bg-blue-50"
                            title={expandido ? "Recolher movimentos" : "Ver os movimentos que compõem este total"}
                          >
                            {expandido ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </button>
                        </TableCell>

                        <TableCell>
                          <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            {item.codigo || "S/C"}
                          </span>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={cn("font-bold text-xs text-slate-800 dark:text-slate-100", mav && "text-red-700 dark:text-red-400")}>
                              {item.nome}
                            </span>
                            {mav && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-red-100 text-red-700 border border-red-200">
                                <AlertTriangle className="w-2.5 h-2.5" /> MAV
                              </span>
                            )}
                          </div>
                          {item.detalhe && (
                            <div className="text-[10px] text-slate-400 mt-0.5 font-medium">{item.detalhe}</div>
                          )}
                        </TableCell>

                        <TableCell className="text-center">
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-black bg-blue-100 text-blue-800 border border-blue-300 shadow-2xs">
                            <ArrowDownRight className="w-3.5 h-3.5" />
                            {item.quantidade} {item.unidade}
                          </span>
                        </TableCell>

                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 text-[11px] font-bold">
                            {item.movimentos}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          {item.lotes.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {item.lotes.map((lote) => (
                                <span
                                  key={lote}
                                  className="font-mono text-[10px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700"
                                >
                                  {lote}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">S/ lote</span>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 max-w-[280px] truncate" title={item.destinos.join(", ")}>
                            {item.destinos.length > 0 ? item.destinos.join(", ") : "Geral"}
                          </div>
                          {item.pacientes.length > 0 && (
                            <div className="flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 mt-0.5 max-w-[280px] truncate" title={item.pacientes.join(", ")}>
                              <Users className="w-3 h-3 shrink-0" />
                              {item.pacientes.join(", ")}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>

                      {expandido && (
                        <TableRow className="bg-slate-50/70 dark:bg-slate-800/30">
                          <TableCell colSpan={7} className="p-0">
                            <div className="px-12 py-3">
                              <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-2">
                                Movimentos que somam {item.quantidade} {item.unidade}
                              </p>
                              <div className="space-y-1.5">
                                {item.itens.map((saida, idx) => (
                                  <div
                                    key={saida.id || `${item.chave}-${idx}`}
                                    className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-[11px]"
                                  >
                                    <span className="font-mono text-slate-500 w-12">
                                      {safeFormatDate(saida.created_at || saida.data_saida, "HH:mm")}
                                    </span>
                                    <span className="font-bold text-rose-700 dark:text-rose-400">
                                      -{saida.quantidade} {item.unidade}
                                    </span>
                                    <span className="text-slate-600 dark:text-slate-300">
                                      Lote: <strong>{saida.numero_lote || "S/L"}</strong>
                                    </span>
                                    <span className="text-slate-600 dark:text-slate-300">
                                      {saida.paciente_nome || saida.ala_nome || saida.destino || "Geral"}
                                    </span>
                                    {saida.observacao && (
                                      <span className="text-slate-400 truncate max-w-[240px]" title={saida.observacao}>
                                        {saida.observacao}
                                      </span>
                                    )}
                                    <span className="text-slate-400 ml-auto">
                                      {saida.responsavel || saida.usuario_nome || ""}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {resumoFiltrado.length > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              Total do dia
            </span>
            <span className="text-sm font-black text-blue-700 dark:text-blue-400">
              {totais.unidades.toLocaleString("pt-BR")} un em {totais.movimentos} saída(s)
            </span>
          </div>
        )}
      </div>

      {/* ─── ÁREA DE IMPRESSÃO ─── */}
      <div id="resumo-diario-print-area" className="hidden print:block bg-white text-black">
        <div className="text-center mb-5 pb-4 border-b-2 border-slate-800">
          <div className="flex justify-between items-center mb-3">
            <div className="text-left">
              <p className="font-bold text-lg uppercase tracking-tight">ZORION SAÚDE</p>
              <p className="text-xs text-slate-600">Sistema de Controle Farmacêutico — Farmácia Satélite</p>
            </div>
            <div className="text-right text-[10px] text-slate-500 font-mono">
              <p>Gerado em:</p>
              <p>{format(new Date(), "dd/MM/yyyy 'às' HH:mm")}</p>
            </div>
          </div>
          <h1 className="text-xl font-bold uppercase tracking-widest">Resumo Diário de Dispensação</h1>
          <p className="text-sm font-semibold mt-1">
            {format(dataSelecionada, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
          <p className="text-[11px] text-slate-600">{rotuloCategoria}</p>
        </div>

        <div className="grid grid-cols-4 gap-3 mb-4 text-center">
          <div className="border border-slate-300 rounded p-2">
            <p className="text-[9px] uppercase font-bold text-slate-500">Total Dispensado</p>
            <p className="text-lg font-bold">{totais.unidades} un</p>
          </div>
          <div className="border border-slate-300 rounded p-2">
            <p className="text-[9px] uppercase font-bold text-slate-500">Medicamentos</p>
            <p className="text-lg font-bold">{totais.medicamentos}</p>
          </div>
          <div className="border border-slate-300 rounded p-2">
            <p className="text-[9px] uppercase font-bold text-slate-500">Movimentos</p>
            <p className="text-lg font-bold">{totais.movimentos}</p>
          </div>
          <div className="border border-slate-300 rounded p-2">
            <p className="text-[9px] uppercase font-bold text-slate-500">Pacientes</p>
            <p className="text-lg font-bold">{totais.pacientes}</p>
          </div>
        </div>

        <table className="w-full border-collapse border border-slate-400 text-[11px]">
          <thead>
            <tr className="bg-slate-200">
              <th className="border border-slate-400 py-1.5 px-2 text-left">Cód.</th>
              <th className="border border-slate-400 py-1.5 px-2 text-left">Medicamento / Apresentação</th>
              <th className="border border-slate-400 py-1.5 px-2 text-center">Qtd Total</th>
              <th className="border border-slate-400 py-1.5 px-2 text-center">Saídas</th>
              <th className="border border-slate-400 py-1.5 px-2 text-left">Lotes</th>
              <th className="border border-slate-400 py-1.5 px-2 text-left">Destinos / Pacientes</th>
            </tr>
          </thead>
          <tbody>
            {resumoFiltrado.map((item) => (
              <tr key={`print-${item.chave}`}>
                <td className="border border-slate-300 py-1 px-2 font-mono">{item.codigo || "S/C"}</td>
                <td className="border border-slate-300 py-1 px-2">
                  <strong>{item.nome}</strong>
                  {item.detalhe && <div className="text-[9px] text-slate-500">{item.detalhe}</div>}
                </td>
                <td className="border border-slate-300 py-1 px-2 text-center font-bold">{item.quantidade} {item.unidade}</td>
                <td className="border border-slate-300 py-1 px-2 text-center">{item.movimentos}</td>
                <td className="border border-slate-300 py-1 px-2">{item.lotes.join(", ") || "S/L"}</td>
                <td className="border border-slate-300 py-1 px-2">
                  {item.destinos.join(", ") || "Geral"}
                  {item.pacientes.length > 0 && (
                    <div className="text-[9px] text-slate-600">{item.pacientes.join(", ")}</div>
                  )}
                </td>
              </tr>
            ))}
            <tr className="bg-slate-100 font-bold">
              <td colSpan={2} className="border border-slate-400 py-1.5 px-2 text-right uppercase">Total do dia</td>
              <td className="border border-slate-400 py-1.5 px-2 text-center">{totais.unidades} un</td>
              <td className="border border-slate-400 py-1.5 px-2 text-center">{totais.movimentos}</td>
              <td colSpan={2} className="border border-slate-400 py-1.5 px-2" />
            </tr>
          </tbody>
        </table>

        <div className="grid grid-cols-2 gap-8 mt-10 pt-4 border-t border-slate-300">
          <div>
            <p className="text-xs mb-10">Responsável pela Farmácia:</p>
            <div className="border-t border-slate-500 pt-1">
              <p className="text-[10px] text-slate-500">Assinatura e Carimbo</p>
            </div>
          </div>
          <div>
            <p className="text-xs mb-10">Farmacêutico Responsável:</p>
            <div className="border-t border-slate-500 pt-1">
              <p className="text-[10px] text-slate-500">Assinatura e CRF</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 12mm; }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            background-color: #ffffff !important;
          }
          body * { visibility: hidden; }
          #resumo-diario-print-area, #resumo-diario-print-area * { visibility: visible; }
          #resumo-diario-print-area {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0 !important;
          }
          .no-print, nav, aside, header, footer, button { display: none !important; }
        }
      `}</style>
    </div>
  );
}

export default ResumoDiarioDispensacao;
