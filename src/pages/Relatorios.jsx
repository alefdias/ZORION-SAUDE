import { useState, useRef } from "react";
import { db } from "@/api/db";
import { useQuery } from "@tanstack/react-query";
import {
  format,
  startOfMonth,
  endOfMonth,
  differenceInDays,
  subDays,
  startOfDay,
  endOfDay,
  isValid,
  subMonths,
  isBefore,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Printer,
  FileText,
  AlertTriangle,
  Package,
  Calendar,
  Layers,
  Building2,
  TrendingDown,
  TrendingUp,
  Activity,
  Boxes,
  CheckCircle2,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function Relatorios() {
  const printRef = useRef();
  const [periodo, setPeriodo] = useState("mensal"); // diario, semanal, quinzenal, mensal, personalizado
  const [customInicio, setCustomInicio] = useState(
    format(startOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [customFim, setCustomFim] = useState(
    format(endOfMonth(new Date()), "yyyy-MM-dd")
  );
  const [secoesVisiveis, setSecoesVisiveis] = useState({
    resumo: true,
    ala: true,
    vencimento: true,
    mmc: true,
    estoqueBaixo: true,
    medicamentoAla: true,
    relatorioIndividualAla: true,
  });
  const [alasSelecionadas, setAlasSelecionadas] = useState(new Set());

  const hoje = new Date();
  let dataInicio;
  let dataFim = endOfDay(hoje);

  switch (periodo) {
    case "diario":
      dataInicio = startOfDay(hoje);
      break;
    case "semanal":
      dataInicio = startOfDay(subDays(hoje, 7));
      break;
    case "quinzenal":
      dataInicio = startOfDay(subDays(hoje, 15));
      break;
    case "personalizado": {
      const di = new Date(customInicio + "T00:00:00");
      const df = new Date(customFim + "T23:59:59");
      dataInicio = isValid(di) ? startOfDay(di) : startOfMonth(hoje);
      dataFim = isValid(df) ? endOfDay(df) : endOfMonth(hoje);
      break;
    }
    case "mensal":
    default:
      dataInicio = startOfMonth(hoje);
      dataFim = endOfMonth(hoje);
      break;
  }

  const { data: medicamentos = [], isLoading: loadingMeds } = useQuery({
    queryKey: ["medicamentos"],
    queryFn: () => db.entities.Medicamento.list(),
  });

  const { data: lotes = [], isLoading: loadingLotes } = useQuery({
    queryKey: ["lotes"],
    queryFn: () => db.entities.Lote.list(),
  });

  const { data: entradas = [], isLoading: loadingEntradas } = useQuery({
    queryKey: ["entradas"],
    queryFn: () => db.entities.Entrada.list(),
  });

  const { data: saidas = [], isLoading: loadingSaidas } = useQuery({
    queryKey: ["saidas"],
    queryFn: () => db.entities.Saida.list(),
  });

  const isLoading =
    loadingMeds || loadingLotes || loadingEntradas || loadingSaidas;

  // Estoque atual
  const totalEstoqueAtual = medicamentos.reduce(
    (sum, m) => sum + (m.estoque_atual || 0),
    0
  );

  // Estoque no início do período
  const entradasPeriodo = entradas
    .filter((e) => {
      if (!e.data_entrada) return false;
      const data = parseISO(e.data_entrada);
      return isValid(data) && data >= dataInicio && data <= dataFim;
    })
    .reduce((sum, e) => sum + (e.quantidade || 0), 0);

  const saidasPeriodo = saidas
    .filter((s) => {
      if (!s.data_saida) return false;
      const data = parseISO(s.data_saida);
      return isValid(data) && data >= dataInicio && data <= dataFim;
    })
    .reduce((sum, s) => sum + (s.quantidade || 0), 0);

  const estoqueInicioPeriodo =
    totalEstoqueAtual - entradasPeriodo + saidasPeriodo;
  const estoqueFimPeriodo = totalEstoqueAtual;

  // Uso por ala
  const usoPorAla = {};
  saidas
    .filter((s) => {
      if (!s.data_saida) return false;
      const data = parseISO(s.data_saida);
      return isValid(data) && data >= dataInicio && data <= dataFim;
    })
    .forEach((s) => {
      const ala = s.ala_nome || s.destino || "Não especificado";
      usoPorAla[ala] = (usoPorAla[ala] || 0) + (s.quantidade || 0);
    });

  // Uso de medicamento por ala
  const usoPorMedicamentoEAla = {};
  saidas
    .filter((s) => {
      if (!s.data_saida) return false;
      const data = parseISO(s.data_saida);
      return isValid(data) && data >= dataInicio && data <= dataFim;
    })
    .forEach((s) => {
      const ala = s.ala_nome || s.destino || "Não especificado";
      const medicamento = medicamentos.find((m) => m.id === s.medicamento_id);
      const nome = medicamento
        ? medicamento.nome
        : s.medicamento_nome || "Desconhecido";

      if (!usoPorMedicamentoEAla[nome]) {
        usoPorMedicamentoEAla[nome] = { total: 0, alas: {} };
      }
      usoPorMedicamentoEAla[nome].alas[ala] =
        (usoPorMedicamentoEAla[nome].alas[ala] || 0) + (s.quantidade || 0);
      usoPorMedicamentoEAla[nome].total += s.quantidade || 0;
    });

  // Consumo detalhado por Ala (para relatório individual)
  const medicamentosPorAla = {};
  saidas
    .filter((s) => {
      if (!s.data_saida) return false;
      const data = parseISO(s.data_saida);
      return isValid(data) && data >= dataInicio && data <= dataFim;
    })
    .forEach((s) => {
      const ala = s.ala_nome || s.destino || "Não especificado";
      const medicamento = medicamentos.find((m) => m.id === s.medicamento_id);
      const codigo = medicamento ? medicamento.codigo : "S/C";
      const nome = medicamento
        ? medicamento.nome
        : s.medicamento_nome || "Desconhecido";

      if (!medicamentosPorAla[ala]) {
        medicamentosPorAla[ala] = {};
      }
      if (!medicamentosPorAla[ala][nome]) {
        medicamentosPorAla[ala][nome] = { codigo, nome, quantidade: 0 };
      }
      medicamentosPorAla[ala][nome].quantidade += s.quantidade || 0;
    });

  // Medicamentos vencidos com estoque > 0
  const loteVencidosRelatorio = lotes
    .filter((l) => {
      if (l.quantidade_atual <= 0) return false;
      if (!l.data_validade) return false;
      const parsedDate = parseISO(l.data_validade);
      if (!isValid(parsedDate)) return false;
      return differenceInDays(parsedDate, hoje) < 0;
    })
    .map((l) => {
      const medicamento = medicamentos.find((m) => m.id === l.medicamento_id);
      return {
        codigo: medicamento?.codigo || "S/C",
        medicamento: l.medicamento_nome || medicamento?.nome || "N/A",
        lote: l.numero_lote,
        quantidade: l.quantidade_atual,
        validade: l.data_validade,
        dias: differenceInDays(parseISO(l.data_validade), hoje),
      };
    })
    .sort((a, b) => a.dias - b.dias);

  const getLotesFaixa = (minDias, maxDias) => {
    return lotes
      .filter((l) => {
        if (l.quantidade_atual <= 0) return false;
        if (!l.data_validade) return false;
        const parsedDate = parseISO(l.data_validade);
        if (!isValid(parsedDate)) return false;
        const dias = differenceInDays(parsedDate, hoje);
        return dias >= minDias && dias <= maxDias;
      })
      .map((l) => {
        const medicamento = medicamentos.find((m) => m.id === l.medicamento_id);
        return {
          codigo: medicamento?.codigo || "S/C",
          medicamento: l.medicamento_nome || medicamento?.nome || "N/A",
          lote: l.numero_lote,
          quantidade: l.quantidade_atual,
          validade: l.data_validade,
          dias: differenceInDays(parseISO(l.data_validade), hoje),
        };
      })
      .sort((a, b) => a.dias - b.dias);
  };

  const vencimento30 = getLotesFaixa(0, 30);
  const vencimento60 = getLotesFaixa(31, 60);
  const vencimento120 = getLotesFaixa(61, 120);

  // --- CÁLCULO MMC (Média Móvel de Consumo - últimos 4 meses fechados) ---
  const mesAtualInicio = startOfMonth(hoje);
  const mmcDataFim = endOfDay(subDays(mesAtualInicio, 1));
  const mmcDataInicio = startOfMonth(subMonths(mesAtualInicio, 4));

  const todasMovimentacoes = [
    ...entradas.map((e) => e.data_entrada),
    ...saidas.map((s) => s.data_saida),
  ]
    .filter((d) => d)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  const primeiraData =
    todasMovimentacoes.length > 0 ? new Date(todasMovimentacoes[0]) : hoje;
  const temQuatroMeses = isBefore(primeiraData, mmcDataInicio);

  const consumoMMC = {};
  saidas
    .filter((s) => {
      if (!s.data_saida) return false;
      const data = parseISO(s.data_saida);
      return isValid(data) && data >= mmcDataInicio && data <= mmcDataFim;
    })
    .forEach((s) => {
      consumoMMC[s.medicamento_id] =
        (consumoMMC[s.medicamento_id] || 0) + (s.quantidade || 0);
    });

  const mmcLista = medicamentos
    .map((m) => {
      const totalConsumo = consumoMMC[m.id] || 0;
      return {
        id: m.id,
        codigo: m.codigo,
        nome: m.nome,
        total: totalConsumo,
        media: Math.ceil(totalConsumo / 4),
        estoque_atual: m.estoque_atual || 0,
      };
    })
    .filter((m) => m.total > 0 || m.estoque_atual > 0)
    .sort((a, b) => b.media - a.media);

  // Medicamentos com estoque baixo
  const estoqueBaixo = medicamentos
    .filter(
      (m) => m.estoque_atual <= (m.estoque_minimo || 0) && m.ativo !== false
    )
    .map((m) => ({
      codigo: m.codigo || "S/C",
      nome: m.nome,
      grupo_terapeutico: m.grupo_terapeutico || "N/A",
      estoque_atual: m.estoque_atual || 0,
      estoque_minimo: m.estoque_minimo || 0,
    }))
    .sort((a, b) => a.estoque_atual - b.estoque_atual);

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    try {
      toast.loading("Gerando PDF...");
      const element = printRef.current;

      const alasContainer = document.getElementById("relatorio-alas-container");
      const hasAlas = alasContainer && alasContainer.children.length > 0;
      const hasGeneral = Array.from(element.children).some(
        (child) => child !== element.firstElementChild && child !== alasContainer
      );

      const exportCanvasToPdf = async (filename) => {
        const canvas = await html2canvas(element, { scale: 2 });
        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "mm", "a4");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

        let heightLeft = pdfHeight;
        let position = 0;

        pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;

        while (heightLeft > 0) {
          position = heightLeft - pdfHeight;
          pdf.addPage();
          pdf.addImage(imgData, "PNG", 0, position, pdfWidth, pdfHeight);
          heightLeft -= pageHeight;
        }
        pdf.save(filename);
      };

      if (hasAlas) {
        const originalDisplay = new Map();

        if (hasGeneral) {
          originalDisplay.set(alasContainer, alasContainer.style.display);
          alasContainer.style.display = "none";
          await exportCanvasToPdf(
            `relatorio-geral-${format(hoje, "dd-MM-yyyy")}.pdf`
          );
          alasContainer.style.display =
            originalDisplay.get(alasContainer) || "";
        }

        Array.from(element.children).forEach((child) => {
          if (child !== element.firstElementChild && child !== alasContainer) {
            originalDisplay.set(child, child.style.display);
            child.style.display = "none";
          }
        });

        const alasItems = Array.from(alasContainer.children);
        for (const alaItem of alasItems) {
          alasItems.forEach((item) => {
            if (item !== alaItem) item.style.display = "none";
            else item.style.display = "";
          });
          const alaName = alaItem.getAttribute("data-ala");
          const cleanName = alaName.replace(/[^a-zA-Z0-9-]/g, "_");
          await exportCanvasToPdf(
            `relatorio-${cleanName}-${format(hoje, "dd-MM-yyyy")}.pdf`
          );
        }

        alasItems.forEach((item) => (item.style.display = ""));
        Array.from(element.children).forEach((child) => {
          if (originalDisplay.has(child)) {
            child.style.display = originalDisplay.get(child) || "";
          }
        });
      } else {
        await exportCanvasToPdf(
          `relatorio-estoque-${format(hoje, "dd-MM-yyyy")}.pdf`
        );
      }

      toast.dismiss();
      toast.success("PDF(s) exportado(s) com sucesso!");
    } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error("Erro ao gerar PDF(s)");
    }
  };

  const toggleSecao = (key) => {
    setSecoesVisiveis((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const selecionarTodasSecoes = (marcar) => {
    setSecoesVisiveis({
      resumo: marcar,
      ala: marcar,
      vencimento: marcar,
      mmc: marcar,
      estoqueBaixo: marcar,
      medicamentoAla: marcar,
      relatorioIndividualAla: marcar,
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 sm:p-8 space-y-6">
        <Skeleton className="h-12 w-72 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  const periodosOpcoes = [
    { key: "diario", label: "Diário" },
    { key: "semanal", label: "Semanal" },
    { key: "quinzenal", label: "Quinzenal" },
    { key: "mensal", label: "Mensal" },
    { key: "personalizado", label: "Personalizado" },
  ];

  return (
    <div className="p-4 sm:p-8 space-y-6 bg-slate-50/50 dark:bg-slate-950 min-h-full print:bg-white print:p-0">
      {/* ─── PAINEL DE CONTROLE SUPERIOR (No-Print) ─── */}
      <div className="no-print space-y-5">
        {/* Barra de Título e Ações */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Relatórios Gerenciais de Estoque
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Auditoria de movimentação, consumo por setor, validade e projeções analíticas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              variant="outline"
              className="border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Printer className="w-4 h-4 mr-2 text-slate-600" />
              Imprimir A4
            </Button>
            <Button
              onClick={handleExportPDF}
              className="bg-red-600 hover:bg-red-700 text-white shadow-sm font-semibold"
            >
              <FileText className="w-4 h-4 mr-2" />
              Exportar PDF
            </Button>
          </div>
        </div>

        {/* Card Moderno: Seletor de Período e Seções */}
        <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm space-y-4 rounded-2xl">
          {/* Seletor de Período Segmentado */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Período do Relatório:
              </span>
            </div>

            <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl flex-wrap gap-1">
              {periodosOpcoes.map((op) => (
                <button
                  key={op.key}
                  type="button"
                  onClick={() => setPeriodo(op.key)}
                  className={cn(
                    "px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all",
                    periodo === op.key
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  )}
                >
                  {op.label}
                </button>
              ))}
            </div>
          </div>

          {/* Intervalo Personalizado de Datas */}
          {periodo === "personalizado" && (
            <div className="flex flex-wrap items-center gap-4 p-3 bg-indigo-50/50 dark:bg-slate-800/60 rounded-xl border border-indigo-100 dark:border-slate-700 animate-in fade-in">
              <div className="flex items-center gap-2">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Data Inicial:
                </Label>
                <Input
                  type="date"
                  value={customInicio}
                  onChange={(e) => setCustomInicio(e.target.value)}
                  className="h-8 text-xs w-36 bg-white dark:bg-slate-900"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Data Final:
                </Label>
                <Input
                  type="date"
                  value={customFim}
                  onChange={(e) => setCustomFim(e.target.value)}
                  className="h-8 text-xs w-36 bg-white dark:bg-slate-900"
                />
              </div>
            </div>
          )}

          {/* Seletor de Seções com Badges Interativos */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                Seções Visíveis para Impressão
              </span>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => selecionarTodasSecoes(true)}
                  className="text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 font-semibold"
                >
                  Marcar Todas
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={() => selecionarTodasSecoes(false)}
                  className="text-slate-500 hover:text-slate-700"
                >
                  Desmarcar Todas
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {[
                { key: "resumo", label: "Resumo Executivo" },
                { key: "ala", label: "Consumo por Ala" },
                { key: "vencimento", label: "Vencimentos" },
                { key: "mmc", label: "Consumo Médio (MMC)" },
                { key: "estoqueBaixo", label: "Estoque Baixo" },
                { key: "medicamentoAla", label: "Medicamento por Ala" },
                { key: "relatorioIndividualAla", label: "Relatório Individual p/ Ala" },
              ].map(({ key, label }) => {
                const ativo = secoesVisiveis[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleSecao(key)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5",
                      ativo
                        ? "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-800 dark:text-indigo-300 shadow-xs font-bold"
                        : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-300"
                    )}
                  >
                    <span
                      className={cn(
                        "w-3.5 h-3.5 rounded flex items-center justify-center text-[10px]",
                        ativo
                          ? "bg-indigo-600 text-white"
                          : "border border-slate-300 text-transparent"
                      )}
                    >
                      ✓
                    </span>
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Seleção de Alas Individuais */}
            {secoesVisiveis.relatorioIndividualAla &&
              Object.keys(medicamentosPorAla).length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    Filtrar Alas no Relatório Individual:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(medicamentosPorAla)
                      .sort((a, b) => a.localeCompare(b))
                      .map((ala) => {
                        const selecionada =
                          alasSelecionadas.size === 0 ||
                          alasSelecionadas.has(ala);
                        return (
                          <button
                            key={ala}
                            type="button"
                            onClick={() => {
                              setAlasSelecionadas((prev) => {
                                const next = new Set(
                                  prev.size === 0
                                    ? Object.keys(medicamentosPorAla).filter(
                                        (a) => a !== ala
                                      )
                                    : [...prev]
                                );
                                if (selecionada) next.delete(ala);
                                else next.add(ala);
                                return next.size ===
                                  Object.keys(medicamentosPorAla).length
                                  ? new Set()
                                  : next;
                              });
                            }}
                            className={cn(
                              "px-2.5 py-1 rounded-md text-xs font-medium border transition-all",
                              selecionada
                                ? "bg-slate-900 text-white border-slate-900 dark:bg-indigo-600 dark:border-indigo-600"
                                : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                            )}
                          >
                            {ala}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
          </div>
        </Card>
      </div>

      {/* ─── DOCUMENTO / ÁREA DO RELATÓRIO (#print-area) ─── */}
      <div
        ref={printRef}
        id="print-area"
        className="max-w-7xl mx-auto bg-white dark:bg-slate-900 p-8 sm:p-12 rounded-2xl shadow-xl border border-slate-200/80 dark:border-slate-800 print:shadow-none print:border-none print:p-0"
      >
        {/* Cabeçalho Oficial do Relatório */}
        <div className="mb-8 pb-6 border-b-2 border-slate-900 dark:border-indigo-500">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black tracking-tight text-indigo-700 dark:text-indigo-400">
                  ZORION SAÚDE
                </span>
                <span className="text-xs bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 font-bold px-2 py-0.5 rounded uppercase">
                  Hospitalar
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Sistema Integrado de Gestão e Controle Farmacêutico
              </p>
            </div>
            <div className="text-left sm:text-right text-xs text-slate-500 font-mono">
              <p>
                <strong>Emissão:</strong>{" "}
                {format(hoje, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
              <p>
                <strong>Período:</strong>{" "}
                {isValid(dataInicio)
                  ? format(dataInicio, "dd/MM/yyyy")
                  : "—"}{" "}
                a{" "}
                {isValid(dataFim) ? format(dataFim, "dd/MM/yyyy") : "—"}
              </p>
            </div>
          </div>

          <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight text-center">
            Relatório de Movimentação e Estoque
          </h2>
          <p className="text-center text-xs text-slate-500 mt-1">
            Tipo de Consulta:{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {periodo === "diario"
                ? "Diário"
                : periodo === "semanal"
                ? "Semanal"
                : periodo === "quinzenal"
                ? "Quinzenal"
                : periodo === "mensal"
                ? "Mensal"
                : "Personalizado"}
            </span>
          </p>
        </div>

        {/* ─── SEÇÃO 1: RESUMO EXECUTIVO ─── */}
        {secoesVisiveis.resumo && (
          <div className="mb-10">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-4 pb-2 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-600" />
              Resumo Executivo do Período
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Estoque Início */}
              <div className="border border-indigo-200 dark:border-indigo-900/60 rounded-xl p-4 bg-indigo-50/50 dark:bg-indigo-950/20">
                <p className="text-xs font-bold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider">
                  Estoque Inicial
                </p>
                <p className="text-2xl font-extrabold text-indigo-700 dark:text-indigo-400 mt-1 font-mono">
                  {estoqueInicioPeriodo.toLocaleString("pt-BR")}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">unidades no início</p>
              </div>

              {/* Estoque Fim */}
              <div className="border border-purple-200 dark:border-purple-900/60 rounded-xl p-4 bg-purple-50/50 dark:bg-purple-950/20">
                <p className="text-xs font-bold text-purple-900 dark:text-purple-300 uppercase tracking-wider">
                  Estoque Final
                </p>
                <p className="text-2xl font-extrabold text-purple-700 dark:text-purple-400 mt-1 font-mono">
                  {estoqueFimPeriodo.toLocaleString("pt-BR")}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">unidades no término</p>
              </div>

              {/* Entradas */}
              <div className="border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-4 bg-emerald-50/50 dark:bg-emerald-950/20">
                <p className="text-xs font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Entradas</span>
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                </p>
                <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-1 font-mono">
                  +{entradasPeriodo.toLocaleString("pt-BR")}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">unidades recebidas</p>
              </div>

              {/* Saídas */}
              <div className="border border-amber-200 dark:border-amber-900/60 rounded-xl p-4 bg-amber-50/50 dark:bg-amber-950/20">
                <p className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Saídas</span>
                  <TrendingDown className="w-3.5 h-3.5 text-amber-600" />
                </p>
                <p className="text-2xl font-extrabold text-amber-700 dark:text-amber-400 mt-1 font-mono">
                  -{saidasPeriodo.toLocaleString("pt-BR")}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">unidades dispensadas</p>
              </div>
            </div>
          </div>
        )}

        {/* ─── SEÇÃO 2: USO POR ALA/SETOR ─── */}
        {secoesVisiveis.ala && (
          <div className="mb-10">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-4 pb-2 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              Consumo Consolidado por Ala / Setor
            </h3>
            {Object.keys(usoPorAla).length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white text-xs">
                      <th className="text-left py-3 px-4 font-bold">Ala / Setor Hospitalar</th>
                      <th className="text-right py-3 px-4 font-bold">Quantidade Dispensada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(usoPorAla)
                      .sort((a, b) => a[0].localeCompare(b[0]))
                      .map(([ala, quantidade], idx) => (
                        <tr
                          key={ala}
                          className={cn(
                            "border-b border-slate-200 dark:border-slate-700 text-sm",
                            idx % 2 === 0
                              ? "bg-slate-50/70 dark:bg-slate-800/40"
                              : "bg-white dark:bg-slate-900"
                          )}
                        >
                          <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                            {ala}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-indigo-700 dark:text-indigo-400">
                            {quantidade.toLocaleString("pt-BR")} un
                          </td>
                        </tr>
                      ))}
                    <tr className="bg-indigo-50/80 dark:bg-indigo-950/40 font-bold border-t-2 border-indigo-200">
                      <td className="py-3 px-4 text-indigo-950 dark:text-indigo-200">
                        TOTAL DE SAÍDAS DAS ALAS:
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-indigo-900 dark:text-indigo-300 font-extrabold text-base">
                        {Object.values(usoPorAla)
                          .reduce((a, b) => a + b, 0)
                          .toLocaleString("pt-BR")}{" "}
                        un
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-slate-500 text-center py-6 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 text-sm">
                Nenhuma saída registrada para alas no período selecionado.
              </p>
            )}
          </div>
        )}

        {/* ─── SEÇÃO 3: MEDICAMENTO POR ALA ─── */}
        {secoesVisiveis.medicamentoAla && (
          <div className="mb-10 break-before-page">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-4 pb-2 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <Boxes className="w-4 h-4 text-indigo-600" />
              Consumo por Medicamento e Distribuição nas Alas
            </h3>
            {Object.keys(usoPorMedicamentoEAla).length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white text-xs">
                      <th className="text-left py-3 px-4 font-bold">Medicamento</th>
                      <th className="text-left py-3 px-4 font-bold">Distribuição por Ala</th>
                      <th className="text-right py-3 px-4 font-bold w-32">Total Período</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(usoPorMedicamentoEAla)
                      .sort((a, b) => a[0].localeCompare(b[0]))
                      .map(([med, data], idx) => (
                        <tr
                          key={med}
                          className={cn(
                            "border-b border-slate-200 dark:border-slate-700 text-sm",
                            idx % 2 === 0
                              ? "bg-slate-50/70 dark:bg-slate-800/40"
                              : "bg-white dark:bg-slate-900"
                          )}
                        >
                          <td className="py-2.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                            {med}
                          </td>
                          <td className="py-2.5 px-4 text-xs">
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(data.alas)
                                .sort((a, b) => a[0].localeCompare(b[0]))
                                .map(([ala, qtd]) => (
                                  <span
                                    key={ala}
                                    className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded font-medium text-slate-700 dark:text-slate-300"
                                  >
                                    <strong>{ala}:</strong> {qtd} un
                                  </span>
                                ))}
                            </div>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-indigo-700 dark:text-indigo-400">
                            {data.total.toLocaleString("pt-BR")} un
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-slate-500 text-center py-6 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 text-sm">
                Nenhuma saída registrada no período selecionado.
              </p>
            )}
          </div>
        )}

        {/* ─── SEÇÃO 4: RELATÓRIO INDIVIDUAL POR ALA ─── */}
        {secoesVisiveis.relatorioIndividualAla &&
          Object.keys(medicamentosPorAla).length > 0 && (
            <div id="relatorio-alas-container" className="mb-10">
              {Object.keys(medicamentosPorAla)
                .sort((a, b) => a.localeCompare(b))
                .filter(
                  (ala) => alasSelecionadas.size === 0 || alasSelecionadas.has(ala)
                )
                .map((ala) => (
                  <div
                    key={ala}
                    data-ala={ala}
                    className="mb-8 break-before-page border-t-4 border-indigo-600 pt-6 mt-8"
                  >
                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
                      <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        Consumo Detalhado da Ala:{" "}
                        <span className="text-indigo-600 dark:text-indigo-400 font-black">
                          {ala}
                        </span>
                      </h4>
                      <p className="text-xs font-mono text-slate-500">
                        Período:{" "}
                        {isValid(dataInicio)
                          ? format(dataInicio, "dd/MM/yyyy")
                          : "—"}{" "}
                        a {isValid(dataFim) ? format(dataFim, "dd/MM/yyyy") : "—"}
                      </p>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-slate-800 text-white text-xs">
                            <th className="text-left py-2.5 px-3 font-semibold w-24">Cód.</th>
                            <th className="text-left py-2.5 px-3 font-semibold">Medicamento</th>
                            <th className="text-right py-2.5 px-3 font-semibold w-32">
                              Quantidade Saída
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.values(medicamentosPorAla[ala])
                            .sort((a, b) =>
                              a.nome.localeCompare(b.nome, "pt-BR")
                            )
                            .map((item, idx) => (
                              <tr
                                key={item.nome}
                                className={cn(
                                  "border-b border-slate-200 dark:border-slate-700 text-sm",
                                  idx % 2 === 0
                                    ? "bg-slate-50/70 dark:bg-slate-800/40"
                                    : "bg-white dark:bg-slate-900"
                                )}
                              >
                                <td className="py-2.5 px-3 font-mono text-xs text-slate-500">
                                  {item.codigo}
                                </td>
                                <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                                  {item.nome}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-700 dark:text-indigo-400">
                                  {item.quantidade.toLocaleString("pt-BR")} un
                                </td>
                              </tr>
                            ))}
                          <tr className="bg-indigo-50 dark:bg-indigo-950/40 font-bold border-t border-indigo-200">
                            <td
                              colSpan={2}
                              className="py-3 px-3 text-right text-indigo-950 dark:text-indigo-200 text-xs uppercase"
                            >
                              Total Consumido na Ala:
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-extrabold text-indigo-900 dark:text-indigo-300">
                              {Object.values(medicamentosPorAla[ala])
                                .reduce((sum, item) => sum + item.quantidade, 0)
                                .toLocaleString("pt-BR")}{" "}
                              un
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
            </div>
          )}

        {/* ─── SEÇÃO 5: VENCIMENTOS ─── */}
        {secoesVisiveis.vencimento && (
          <div className="mb-10">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-4 pb-2 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Controle e Vigilância de Vencimentos
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="border-2 border-red-400 rounded-xl p-3 bg-red-50 text-center">
                <p className="text-2xl font-black text-red-700">
                  {loteVencidosRelatorio.length}
                </p>
                <p className="text-xs font-bold text-red-600 uppercase">Vencidos</p>
                <p className="text-[10px] text-red-500">com estoque ativo</p>
              </div>
              <div className="border-2 border-orange-400 rounded-xl p-3 bg-orange-50 text-center">
                <p className="text-2xl font-black text-orange-700">
                  {vencimento30.length}
                </p>
                <p className="text-xs font-bold text-orange-600 uppercase">Até 30 dias</p>
                <p className="text-[10px] text-orange-500">vencimento crítico</p>
              </div>
              <div className="border-2 border-yellow-400 rounded-xl p-3 bg-yellow-50 text-center">
                <p className="text-2xl font-black text-yellow-700">
                  {vencimento60.length}
                </p>
                <p className="text-xs font-bold text-yellow-600 uppercase">31–60 dias</p>
                <p className="text-[10px] text-yellow-600">atenção moderada</p>
              </div>
              <div className="border-2 border-amber-400 rounded-xl p-3 bg-amber-50 text-center">
                <p className="text-2xl font-black text-amber-700">
                  {vencimento120.length}
                </p>
                <p className="text-xs font-bold text-amber-600 uppercase">61–120 dias</p>
                <p className="text-[10px] text-amber-600">vigilância preventiva</p>
              </div>
            </div>

            {[
              {
                label: "🔴 Medicamentos VENCIDOS (com estoque ativo)",
                items: loteVencidosRelatorio,
                headerCls: "bg-red-700",
                rowCls: "bg-red-50/50",
                diasCls: "text-red-900 font-bold",
                diasLabel: (d) => `${Math.abs(d)}d atrás`,
              },
              {
                label: "🟠 Próximos ao Vencimento — Até 30 dias (CRÍTICO)",
                items: vencimento30,
                headerCls: "bg-orange-600",
                rowCls: "bg-orange-50/50",
                diasCls: "text-orange-800 font-bold",
                diasLabel: (d) => `${d}d`,
              },
              {
                label: "🟡 Próximos ao Vencimento — 31 a 60 dias",
                items: vencimento60,
                headerCls: "bg-yellow-600",
                rowCls: "bg-yellow-50/50",
                diasCls: "text-yellow-800 font-bold",
                diasLabel: (d) => `${d}d`,
              },
              {
                label: "🟢 Atenção Preventiva — 61 a 120 dias",
                items: vencimento120,
                headerCls: "bg-amber-600",
                rowCls: "bg-amber-50/50",
                diasCls: "text-amber-800 font-semibold",
                diasLabel: (d) => `${d}d`,
              },
            ].map(({ label, items, headerCls, rowCls, diasCls, diasLabel }) => (
              <div key={label} className="mb-6">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  {label}
                </h4>
                {items.length > 0 ? (
                  <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className={cn(headerCls, "text-white font-bold")}>
                          <th className="text-left py-2 px-3">Cód.</th>
                          <th className="text-left py-2 px-3">Medicamento</th>
                          <th className="text-left py-2 px-3">Lote</th>
                          <th className="text-center py-2 px-3">Quant.</th>
                          <th className="text-center py-2 px-3">Validade</th>
                          <th className="text-center py-2 px-3">Prazo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr
                            key={idx}
                            className={cn(
                              "border-b border-slate-200 dark:border-slate-700",
                              idx % 2 === 0 ? rowCls : "bg-white dark:bg-slate-900"
                            )}
                          >
                            <td className="py-2 px-3 font-mono">{item.codigo}</td>
                            <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">
                              {item.medicamento}
                            </td>
                            <td className="py-2 px-3 font-mono">{item.lote}</td>
                            <td className="py-2 px-3 text-center font-bold font-mono">
                              {item.quantidade.toLocaleString("pt-BR")}
                            </td>
                            <td className="py-2 px-3 text-center font-mono">
                              {format(parseISO(item.validade), "dd/MM/yyyy")}
                            </td>
                            <td className={cn("py-2 px-3 text-center font-mono", diasCls)}>
                              {diasLabel(item.dias)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-400 text-center py-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-700 text-xs italic">
                    Nenhum lote nesta faixa de vencimento.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ─── SEÇÃO 6: CONSUMO MÉDIO MENSAL (MMC) ─── */}
        {secoesVisiveis.mmc && (
          <div className="mb-10 break-before-page">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              Consumo Médio Mensal (MMC)
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Baseado nos últimos 4 meses fechados ({format(mmcDataInicio, "MM/yyyy")} a{" "}
              {format(mmcDataFim, "MM/yyyy")})
            </p>

            {!temQuatroMeses && (
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl text-amber-900 dark:text-amber-200 flex items-center gap-2.5 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                <p>
                  <strong>Dados em Acúmulo:</strong> O sistema ainda não possui 4 meses completos de registros. Os valores abaixo refletem o período registrado até o momento.
                </p>
              </div>
            )}

            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold">
                    <th className="text-left py-2.5 px-3">Cód.</th>
                    <th className="text-left py-2.5 px-3">Medicamento</th>
                    <th className="text-right py-2.5 px-3">Consumo Total</th>
                    <th className="text-right py-2.5 px-3">MMC (Média/mês)</th>
                    <th className="text-right py-2.5 px-3">Estoque Atual</th>
                    <th className="text-center py-2.5 px-3">Autonomia</th>
                  </tr>
                </thead>
                <tbody>
                  {mmcLista.length > 0 ? (
                    mmcLista.map((item, idx) => {
                      const mediaNum = Number(item.media);
                      const estoqueNum = Number(item.estoque_atual);
                      const autonomia =
                        mediaNum > 0
                          ? Math.floor(estoqueNum / mediaNum)
                          : estoqueNum > 0
                          ? "∞"
                          : 0;
                      return (
                        <tr
                          key={item.id}
                          className={cn(
                            "border-b border-slate-200 dark:border-slate-700",
                            idx % 2 === 0
                              ? "bg-slate-50/70 dark:bg-slate-800/40"
                              : "bg-white dark:bg-slate-900"
                          )}
                        >
                          <td className="py-2.5 px-3 font-mono text-slate-500">
                            {item.codigo}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                            {item.nome}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            {item.total.toLocaleString("pt-BR")}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-700 dark:text-indigo-400">
                            {item.media.toLocaleString("pt-BR")}/mês
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono">
                            {item.estoque_atual.toLocaleString("pt-BR")}
                          </td>
                          <td
                            className={cn(
                              "py-2.5 px-3 text-center font-mono font-bold",
                              typeof autonomia === "number" && autonomia < 2
                                ? "text-red-600"
                                : "text-slate-700 dark:text-slate-300"
                            )}
                          >
                            {autonomia} {autonomia === "∞" ? "" : "meses"}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                        Nenhum consumo registrado nos últimos meses.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── SEÇÃO 7: ESTOQUE BAIXO ─── */}
        {secoesVisiveis.estoqueBaixo && (
          <div className="mb-10">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-4 pb-2 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <Package className="w-4 h-4 text-red-600" />
              Medicamentos com Estoque Baixo / Crítico
            </h3>
            {estoqueBaixo.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-red-700 text-white font-bold">
                      <th className="text-left py-2.5 px-3">Cód.</th>
                      <th className="text-left py-2.5 px-3">Medicamento</th>
                      <th className="text-left py-2.5 px-3">Categoria</th>
                      <th className="text-center py-2.5 px-3">Estoque Atual</th>
                      <th className="text-center py-2.5 px-3">Estoque Mín.</th>
                      <th className="text-center py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estoqueBaixo.map((item, idx) => (
                      <tr
                        key={idx}
                        className={cn(
                          "border-b border-slate-200 dark:border-slate-700",
                          idx % 2 === 0
                            ? "bg-red-50/50 dark:bg-red-950/20"
                            : "bg-white dark:bg-slate-900"
                        )}
                      >
                        <td className="py-2.5 px-3 font-mono text-slate-500">
                          {item.codigo}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100">
                          {item.nome}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500">
                          {item.grupo_terapeutico}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold text-red-700">
                          {item.estoque_atual.toLocaleString("pt-BR")}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          {item.estoque_minimo.toLocaleString("pt-BR")}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">
                            {item.estoque_atual === 0 ? "ZERADO" : "CRÍTICO"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Todos os medicamentos estão com estoque adequado acima do mínimo.
              </div>
            )}
          </div>
        )}

        {/* ─── RODAPÉ FORMAL PARA ASSINATURA ─── */}
        <div className="mt-12 pt-8 border-t-2 border-slate-300 dark:border-slate-700">
          <div className="grid grid-cols-2 gap-12 text-center text-xs text-slate-700 dark:text-slate-300">
            <div>
              <div className="border-t border-slate-500 mx-auto w-64 pt-2"></div>
              <p className="font-bold">Farmacêutico(a) Responsável Técnico</p>
              <p className="text-slate-400">CRF / Assinatura</p>
            </div>
            <div>
              <div className="border-t border-slate-500 mx-auto w-64 pt-2"></div>
              <p className="font-bold">Diretoria Clínica / Hospitalar</p>
              <p className="text-slate-400">Visto da Administração</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 text-center mt-6">
            Zorion Saúde • Sistema de Gestão e Farmácia Hospitalar
          </p>
        </div>
      </div>
    </div>
  );
}
