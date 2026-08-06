import { useState, useRef } from "react";
import { db } from "@/api/db";
import { useQuery } from "@tanstack/react-query";
import {  format, startOfMonth, endOfMonth, differenceInDays, subDays, startOfDay, endOfDay, isValid, subMonths, isAfter, isBefore , parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Printer, FileText, TrendingUp, TrendingDown, AlertTriangle, Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import RelatorioTable from "@/components/relatorios/RelatorioTable";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Relatorios() {
  const printRef = useRef();
  const [periodo, setPeriodo] = useState("mensal"); // diario, semanal, quinzenal, mensal, personalizado
  const [customInicio, setCustomInicio] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [customFim, setCustomFim] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [secoesVisiveis, setSecoesVisiveis] = useState({
    resumo: true,
    ala: true,
    vencimento: true,
    mmc: true,
    estoqueBaixo: true,
    medicamentoAla: true,
    relatorioIndividualAla: true
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
    case "personalizado":
      const di = new Date(customInicio + "T00:00:00");
      const df = new Date(customFim + "T23:59:59");
      dataInicio = isValid(di) ? startOfDay(di) : startOfMonth(hoje);
      dataFim = isValid(df) ? endOfDay(df) : endOfMonth(hoje);
      break;
    case "mensal":
    default:
      dataInicio = startOfMonth(hoje);
      dataFim = endOfMonth(hoje);
      break;
  }

  const { data: medicamentos = [], isLoading: loadingMeds } = useQuery({
    queryKey: ['medicamentos'],
    queryFn: () => db.entities.Medicamento.list(),
  });

  const { data: lotes = [], isLoading: loadingLotes } = useQuery({
    queryKey: ['lotes'],
    queryFn: () => db.entities.Lote.list(),
  });

  const { data: entradas = [], isLoading: loadingEntradas } = useQuery({
    queryKey: ['entradas'],
    queryFn: () => db.entities.Entrada.list(),
  });

  const { data: saidas = [], isLoading: loadingSaidas } = useQuery({
    queryKey: ['saidas'],
    queryFn: () => db.entities.Saida.list(),
  });

  const isLoading = loadingMeds || loadingLotes || loadingEntradas || loadingSaidas;

  // Estoque atual
  const totalEstoqueAtual = medicamentos.reduce((sum, m) => sum + (m.estoque_atual || 0), 0);

  // Estoque no início do mês (estoque atual - entradas do mês + saídas do mês)
  const entradasPeriodo = entradas
    .filter(e => {
      if (!e.data_entrada) return false;
      const data = parseISO(e.data_entrada);
      return isValid(data) && data >= dataInicio && data <= dataFim;
    })
    .reduce((sum, e) => sum + (e.quantidade || 0), 0);

  const saidasPeriodo = saidas
    .filter(s => {
      if (!s.data_saida) return false;
      const data = parseISO(s.data_saida);
      return isValid(data) && data >= dataInicio && data <= dataFim;
    })
    .reduce((sum, s) => sum + (s.quantidade || 0), 0);

  const estoqueInicioPeriodo = totalEstoqueAtual - entradasPeriodo + saidasPeriodo;
  const estoqueFimPeriodo = totalEstoqueAtual;

  // Uso por ala
  const usoPorAla = {};
  saidas
    .filter(s => {
      if (!s.data_saida) return false;
      const data = parseISO(s.data_saida);
      return isValid(data) && data >= dataInicio && data <= dataFim;
    })
    .forEach(s => {
      const ala = s.ala_nome || s.destino || "Não especificado";
      usoPorAla[ala] = (usoPorAla[ala] || 0) + (s.quantidade || 0);
    });

  // Uso de medicamento por ala
  const usoPorMedicamentoEAla = {};
  saidas
    .filter(s => {
      if (!s.data_saida) return false;
      const data = parseISO(s.data_saida);
      return isValid(data) && data >= dataInicio && data <= dataFim;
    })
    .forEach(s => {
      const ala = s.ala_nome || s.destino || "Não especificado";
      const medicamento = medicamentos.find(m => m.id === s.medicamento_id);
      const nome = medicamento ? medicamento.nome : (s.medicamento_nome || "Desconhecido");
      
      if (!usoPorMedicamentoEAla[nome]) {
        usoPorMedicamentoEAla[nome] = { total: 0, alas: {} };
      }
      usoPorMedicamentoEAla[nome].alas[ala] = (usoPorMedicamentoEAla[nome].alas[ala] || 0) + (s.quantidade || 0);
      usoPorMedicamentoEAla[nome].total += (s.quantidade || 0);
    });

  // Consumo detalhado por Ala (para relatório individual)
  const medicamentosPorAla = {};
  saidas
    .filter(s => {
      if (!s.data_saida) return false;
      const data = parseISO(s.data_saida);
      return isValid(data) && data >= dataInicio && data <= dataFim;
    })
    .forEach(s => {
      const ala = s.ala_nome || s.destino || "Não especificado";
      const medicamento = medicamentos.find(m => m.id === s.medicamento_id);
      const codigo = medicamento ? medicamento.codigo : "S/C";
      const nome = medicamento ? medicamento.nome : (s.medicamento_nome || "Desconhecido");
      
      if (!medicamentosPorAla[ala]) {
        medicamentosPorAla[ala] = {};
      }
      if (!medicamentosPorAla[ala][nome]) {
        medicamentosPorAla[ala][nome] = { codigo, nome, quantidade: 0 };
      }
      medicamentosPorAla[ala][nome].quantidade += (s.quantidade || 0);
    });

  // Medicamentos vencidos com estoque > 0
  const loteVencidosRelatorio = lotes
    .filter(l => {
      if (l.quantidade_atual <= 0) return false;
      if (!l.data_validade) return false;
      const parsedDate = parseISO(l.data_validade);
      if (!isValid(parsedDate)) return false;
      return differenceInDays(parsedDate, hoje) < 0;
    })
    .map(l => {
      const medicamento = medicamentos.find(m => m.id === l.medicamento_id);
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

  // Função auxiliar para filtrar por faixa de dias
  const getLotesFaixa = (min, max) => lotes
    .filter(l => {
      if (l.quantidade_atual <= 0) return false;
      if (!l.data_validade) return false;
      const parsedDate = parseISO(l.data_validade);
      if (!isValid(parsedDate)) return false;
      const diasParaVencer = differenceInDays(parsedDate, hoje);
      return diasParaVencer >= min && diasParaVencer <= max;
    })
    .map(l => {
      const medicamento = medicamentos.find(m => m.id === l.medicamento_id);
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

  const vencimento30 = getLotesFaixa(1, 30);
  const vencimento60 = getLotesFaixa(31, 60);
  const vencimento120 = getLotesFaixa(61, 120);
  // Manter compatibilidade com o nome antigo (usado em outras partes)
  const proximosVencimento = vencimento30;

  // --- CÁLCULO MMC (Média Móvel de Consumo - últimos 4 meses fechados) ---
  const mesAtualInicio = startOfMonth(hoje);
  const mmcDataFim = endOfDay(subDays(mesAtualInicio, 1)); // Último dia do mês passado
  const mmcDataInicio = startOfMonth(subMonths(mesAtualInicio, 4)); // Primeiro dia de 4 meses atrás

  // Pegar a data da primeira movimentação para saber se temos 4 meses de dados
  const todasMovimentacoes = [...entradas.map(e => e.data_entrada), ...saidas.map(s => s.data_saida)]
    .filter(d => d)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  
  const primeiraData = todasMovimentacoes.length > 0 ? new Date(todasMovimentacoes[0]) : hoje;
  const temQuatroMeses = isBefore(primeiraData, mmcDataInicio);

  const consumoMMC = {};
  saidas
    .filter(s => {
      if (!s.data_saida) return false;
      const data = parseISO(s.data_saida);
      return isValid(data) && data >= mmcDataInicio && data <= mmcDataFim;
    })
    .forEach(s => {
      consumoMMC[s.medicamento_id] = (consumoMMC[s.medicamento_id] || 0) + (s.quantidade || 0);
    });

  const mmcLista = medicamentos
    .map(m => {
      const totalConsumo = consumoMMC[m.id] || 0;
      return {
        id: m.id,
        codigo: m.codigo,
        nome: m.nome,
        total: totalConsumo,
        media: Math.ceil(totalConsumo / 4),
        estoque_atual: m.estoque_atual || 0
      };
    })
    .filter(m => m.total > 0 || m.estoque_atual > 0)
    .sort((a, b) => b.media - a.media);

  // Medicamentos com estoque baixo
  const estoqueBaixo = medicamentos
    .filter(m => m.estoque_atual <= (m.estoque_minimo || 0) && m.ativo !== false)
    .map(m => ({
      codigo: m.codigo || "S/C",
      nome: m.nome,
      categoria: m.categoria || "N/A",
      estoque_atual: m.estoque_atual || 0,
      estoque_minimo: m.estoque_minimo || 0,
    }))
    .sort((a, b) => a.estoque_atual - b.estoque_atual);

  // Função de impressão
  const handlePrint = () => {
    window.print();
  };

  // Função de exportação para PDF
  const handleExportPDF = async () => {
    try {
      toast.loading("Gerando PDF(s)...");
      const element = printRef.current;
      
      const alasContainer = document.getElementById("relatorio-alas-container");
      const hasAlas = alasContainer && alasContainer.children.length > 0;
      const hasGeneral = Array.from(element.children).some(child => child !== element.firstElementChild && child !== alasContainer);

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
        
        // Export general sections if they exist
        if (hasGeneral) {
          originalDisplay.set(alasContainer, alasContainer.style.display);
          alasContainer.style.display = "none";
          await exportCanvasToPdf(`relatorio-geral-${format(hoje, "dd-MM-yyyy")}.pdf`);
          alasContainer.style.display = originalDisplay.get(alasContainer) || "";
        }

        // Hide general sections
        Array.from(element.children).forEach(child => {
          if (child !== element.firstElementChild && child !== alasContainer) {
            originalDisplay.set(child, child.style.display);
            child.style.display = "none";
          }
        });

        // Export each ala
        const alasItems = Array.from(alasContainer.children);
        for (const alaItem of alasItems) {
          alasItems.forEach(item => {
            if (item !== alaItem) item.style.display = "none";
            else item.style.display = "";
          });
          const alaName = alaItem.getAttribute("data-ala");
          const cleanName = alaName.replace(/[^a-zA-Z0-9-]/g, "_");
          await exportCanvasToPdf(`relatorio-${cleanName}-${format(hoje, "dd-MM-yyyy")}.pdf`);
        }
        
        // Restore all
        alasItems.forEach(item => item.style.display = "");
        Array.from(element.children).forEach(child => {
          if (originalDisplay.has(child)) {
            child.style.display = originalDisplay.get(child) || "";
          }
        });

      } else {
        await exportCanvasToPdf(`relatorio-estoque-${format(hoje, "dd-MM-yyyy")}.pdf`);
      }

      toast.dismiss();
      toast.success("PDF(s) exportado(s) com sucesso!");
    } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error("Erro ao gerar PDF(s)");
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Relatório de Estoque</h1>
          <div className="flex flex-wrap gap-2 mt-3">
            <Button
              size="sm"
              variant={periodo === "diario" ? "default" : "outline"}
              onClick={() => setPeriodo("diario")}
              className={periodo === "diario" ? "bg-indigo-600" : ""}
            >
              Diário
            </Button>
            <Button
              size="sm"
              variant={periodo === "semanal" ? "default" : "outline"}
              onClick={() => setPeriodo("semanal")}
              className={periodo === "semanal" ? "bg-indigo-600" : ""}
            >
              Semanal
            </Button>
            <Button
              size="sm"
              variant={periodo === "quinzenal" ? "default" : "outline"}
              onClick={() => setPeriodo("quinzenal")}
              className={periodo === "quinzenal" ? "bg-indigo-600" : ""}
            >
              Quinzenal
            </Button>
            <Button
              size="sm"
              variant={periodo === "mensal" ? "default" : "outline"}
              onClick={() => setPeriodo("mensal")}
              className={periodo === "mensal" ? "bg-indigo-600" : ""}
            >
              Mensal
            </Button>
            <Button
              size="sm"
              variant={periodo === "personalizado" ? "default" : "outline"}
              onClick={() => setPeriodo("personalizado")}
              className={periodo === "personalizado" ? "bg-indigo-600" : ""}
            >
              Personalizado
            </Button>
          </div>

          {periodo === "personalizado" && (
            <div className="flex gap-4 mt-4 items-center mb-2 bg-slate-50 p-3 rounded-md border border-slate-200 w-fit">
              <div>
                <Label className="text-xs mb-1 block">Início</Label>
                <Input
                  type="date"
                  value={customInicio}
                  onChange={(e) => setCustomInicio(e.target.value)}
                  className="h-8 max-w-[150px]"
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Fim</Label>
                <Input
                  type="date"
                  value={customFim}
                  onChange={(e) => setCustomFim(e.target.value)}
                  className="h-8 max-w-[150px]"
                />
              </div>
            </div>
          )}

          <div className="mt-4 bg-slate-50 p-4 rounded-md border border-slate-200">
            <h3 className="text-sm font-semibold mb-3">Seções do Relatório para Impressão</h3>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input 
                  type="checkbox" 
                  checked={secoesVisiveis.resumo} 
                  onChange={(e) => setSecoesVisiveis(prev => ({ ...prev, resumo: e.target.checked }))}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Resumo Executivo
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input 
                  type="checkbox" 
                  checked={secoesVisiveis.ala} 
                  onChange={(e) => setSecoesVisiveis(prev => ({ ...prev, ala: e.target.checked }))}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Consumo por Ala
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input 
                  type="checkbox" 
                  checked={secoesVisiveis.vencimento} 
                  onChange={(e) => setSecoesVisiveis(prev => ({ ...prev, vencimento: e.target.checked }))}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Vencimentos
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input 
                  type="checkbox" 
                  checked={secoesVisiveis.mmc} 
                  onChange={(e) => setSecoesVisiveis(prev => ({ ...prev, mmc: e.target.checked }))}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Consumo Médio (MMC)
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input 
                  type="checkbox" 
                  checked={secoesVisiveis.estoqueBaixo} 
                  onChange={(e) => setSecoesVisiveis(prev => ({ ...prev, estoqueBaixo: e.target.checked }))}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Estoque Baixo
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input 
                  type="checkbox" 
                  checked={secoesVisiveis.medicamentoAla} 
                  onChange={(e) => setSecoesVisiveis(prev => ({ ...prev, medicamentoAla: e.target.checked }))}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Medicamento por Ala
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input 
                  type="checkbox" 
                  checked={secoesVisiveis.relatorioIndividualAla} 
                  onChange={(e) => setSecoesVisiveis(prev => ({ ...prev, relatorioIndividualAla: e.target.checked }))}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Relatório Individual p/ Ala
              </label>
            </div>

            {/* Seleção de Alas para Relatório Individual */}
            {secoesVisiveis.relatorioIndividualAla && Object.keys(medicamentosPorAla).length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <p className="text-xs font-semibold text-slate-600 mb-2">Selecione as Alas para imprimir:</p>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {Object.keys(medicamentosPorAla).sort((a, b) => a.localeCompare(b)).map(ala => (
                    <label key={ala} className="flex items-center gap-1.5 cursor-pointer text-xs bg-slate-100 px-2 py-1 rounded border border-slate-200 hover:bg-indigo-50">
                      <input
                        type="checkbox"
                        checked={alasSelecionadas.size === 0 || alasSelecionadas.has(ala)}
                        onChange={(e) => {
                          setAlasSelecionadas(prev => {
                            const next = new Set(
                              prev.size === 0
                                ? Object.keys(medicamentosPorAla).filter(a => a !== ala)
                                : [...prev]
                            );
                            if (e.target.checked) next.add(ala); else next.delete(ala);
                            return next.size === Object.keys(medicamentosPorAla).length ? new Set() : next;
                          });
                        }}
                        className="rounded border-slate-300 text-indigo-600"
                      />
                      {ala}
                    </label>
                  ))}
                </div>
                <div className="flex gap-3 mt-2">
                  <button onClick={() => setAlasSelecionadas(new Set())} className="text-xs text-indigo-600 underline">
                    Selecionar Todas
                  </button>
                  <button onClick={() => setAlasSelecionadas(new Set(["__none__"]))} className="text-xs text-slate-500 underline">
                    Desmarcar Todas
                  </button>
                </div>
              </div>
            )}
            <div className="mt-3 pt-3 border-t border-slate-200">
              <Button 
                variant="link" 
                size="sm" 
                className="h-auto p-0 text-indigo-600"
                onClick={() => setSecoesVisiveis({
                  resumo: true, ala: true, vencimento: true, mmc: true, estoqueBaixo: true, medicamentoAla: true, relatorioIndividualAla: true
                })}
              >
                Selecionar Tudo
              </Button>
            </div>
          </div>

          <p className="text-slate-500 text-xs mt-2 font-medium">
            Período: {isValid(dataInicio) ? format(dataInicio, "dd/MM/yyyy") : "Data inválida"} - {isValid(dataFim) ? format(dataFim, "dd/MM/yyyy") : "Data inválida"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handlePrint} variant="outline">
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
          <Button onClick={handleExportPDF} className="bg-red-600 hover:bg-red-700">
            <FileText className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Conteúdo para impressão */}
      <div ref={printRef} id="print-area" className="bg-white p-8">
        {/* Cabeçalho do PDF */}
        <div className="text-center mb-8 pb-6 border-b-2 border-indigo-600">
          <div className="flex justify-between items-center mb-4">
            <div className="text-left">
              <p className="text-indigo-600 font-bold text-xl">AXION SAÚDE</p>
              <p className="text-slate-500 text-xs">Sistema de Controle Farmacêutico</p>
            </div>
            <div className="text-right text-[10px] text-slate-400">
              <p>Gerado eletronicamente em:</p>
              <p>{format(hoje, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2 uppercase tracking-wide">Relatório de Movimentação e Estoque</h1>
          <div className="flex justify-center gap-4 text-sm text-slate-600 font-medium">
            <p>
              <span className="text-slate-400">Tipo:</span> {periodo === "diario" ? "Diário" : periodo === "semanal" ? "Semanal" : periodo === "quinzenal" ? "Quinzenal" : "Mensal"}
            </p>
            <p>
              <span className="text-slate-400">Período:</span> {isValid(dataInicio) ? format(dataInicio, "dd/MM/yyyy") : "Data inválida"} a {isValid(dataFim) ? format(dataFim, "dd/MM/yyyy") : "Data inválida"}
            </p>
          </div>
        </div>

        {/* Resumo Executivo */}
        {secoesVisiveis.resumo && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b border-slate-200">
              Resumo Executivo
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="border border-slate-200 rounded-lg p-4 bg-indigo-50">
                <p className="text-xs font-medium text-slate-600 mb-2">Estoque Início do Período</p>
                <p className="text-2xl font-bold text-indigo-700">
                  {estoqueInicioPeriodo.toLocaleString('pt-BR')}
                </p>
                <p className="text-xs text-slate-500 mt-1">unidades</p>
              </div>

              <div className="border border-slate-200 rounded-lg p-4 bg-purple-50">
                <p className="text-xs font-medium text-slate-600 mb-2">Estoque Fim do Período</p>
                <p className="text-2xl font-bold text-purple-700">
                  {estoqueFimPeriodo.toLocaleString('pt-BR')}
                </p>
                <p className="text-xs text-slate-500 mt-1">unidades</p>
              </div>

              <div className="border border-slate-200 rounded-lg p-4 bg-green-50">
                <p className="text-xs font-medium text-slate-600 mb-2">Entradas no Período</p>
                <p className="text-2xl font-bold text-green-700">
                  +{entradasPeriodo.toLocaleString('pt-BR')}
                </p>
                <p className="text-xs text-slate-500 mt-1">unidades</p>
              </div>

              <div className="border border-slate-200 rounded-lg p-4 bg-amber-50">
                <p className="text-xs font-medium text-slate-600 mb-2">Saídas no Período</p>
                <p className="text-2xl font-bold text-amber-700">
                  -{saidasPeriodo.toLocaleString('pt-BR')}
                </p>
                <p className="text-xs text-slate-500 mt-1">unidades</p>
              </div>
            </div>
          </div>
        )}

        {/* Uso por Ala */}
        {secoesVisiveis.ala && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b border-slate-200">
              Consumo por Ala/Setor (Período Selecionado)
            </h2>
            {Object.keys(usoPorAla).length > 0 ? (
              <table className="w-full border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-indigo-600 text-white">
                    <th className="text-left py-3 px-4 font-semibold border border-slate-300">Ala/Setor</th>
                    <th className="text-right py-3 px-4 font-semibold border border-slate-300">Quantidade Utilizada</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(usoPorAla)
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([ala, quantidade], idx) => (
                      <tr key={ala} className={idx % 2 === 0 ? "bg-slate-50" : "bg-white"}>
                        <td className="py-3 px-4 border border-slate-300 font-medium text-slate-700">{ala}</td>
                        <td className="py-3 px-4 border border-slate-300 text-right font-bold text-indigo-700">
                          {quantidade.toLocaleString('pt-BR')} un
                        </td>
                      </tr>
                    ))}
                  <tr className="bg-indigo-100 font-bold">
                    <td className="py-3 px-4 border border-slate-300">TOTAL</td>
                    <td className="py-3 px-4 border border-slate-300 text-right text-indigo-800">
                      {Object.values(usoPorAla).reduce((a, b) => a + b, 0).toLocaleString('pt-BR')} un
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p className="text-slate-500 text-center py-4 bg-slate-50 rounded border border-slate-200">
                Nenhuma saída registrada no mês
              </p>
            )}
          </div>
        )}

        {/* Uso por Medicamento e Ala */}
        {secoesVisiveis.medicamentoAla && (
          <div className="mb-8 break-before-page">
            <h2 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b border-slate-200">
              Consumo por Medicamento e Ala (Período Selecionado)
            </h2>
            {Object.keys(usoPorMedicamentoEAla).length > 0 ? (
              <table className="w-full border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-indigo-600 text-white">
                    <th className="text-left py-2 px-3 font-semibold border border-slate-300">Medicamento</th>
                    <th className="text-left py-2 px-3 font-semibold border border-slate-300">Distribuição por Ala</th>
                    <th className="text-right py-2 px-3 font-semibold border border-slate-300 w-32">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(usoPorMedicamentoEAla)
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([med, data], idx) => (
                      <tr key={med} className={idx % 2 === 0 ? "bg-slate-50" : "bg-white"}>
                        <td className="py-2 px-3 border border-slate-300 font-medium text-slate-700">{med}</td>
                        <td className="py-2 px-3 border border-slate-300 text-sm text-slate-600">
                          {Object.entries(data.alas)
                            .sort((a, b) => a[0].localeCompare(b[0]))
                            .map(([ala, qtd]) => (
                               <span key={ala} className="inline-block bg-slate-200 rounded px-2 py-1 mr-2 mb-1 text-xs">
                                <strong>{ala}:</strong> {qtd} un
                              </span>
                            ))}
                        </td>
                        <td className="py-2 px-3 border border-slate-300 text-right font-bold text-indigo-700">
                          {data.total.toLocaleString('pt-BR')} un
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <p className="text-slate-500 text-center py-4 bg-slate-50 rounded border border-slate-200">
                Nenhuma saída registrada no período
              </p>
            )}
          </div>
        )}

        {/* Relatório Individual por Ala */}
        {secoesVisiveis.relatorioIndividualAla && Object.keys(medicamentosPorAla).length > 0 && (
          <div id="relatorio-alas-container" className="mb-0">
            {Object.keys(medicamentosPorAla)
              .sort((a, b) => a.localeCompare(b))
              .filter(ala => alasSelecionadas.size === 0 || alasSelecionadas.has(ala))
              .map((ala) => (
              <div key={ala} data-ala={ala} className="mb-8 break-before-page border-t-4 border-indigo-600 pt-6 mt-8">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200">
                  <h2 className="text-xl font-bold text-slate-800">
                    Consumo da Ala: <span className="text-indigo-700">{ala}</span>
                  </h2>
                  <p className="text-sm font-medium text-slate-500">
                    Período: {isValid(dataInicio) ? format(dataInicio, "dd/MM/yyyy") : "Data inválida"} a {isValid(dataFim) ? format(dataFim, "dd/MM/yyyy") : "Data inválida"}
                  </p>
                </div>
                
                <table className="w-full border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-indigo-600 text-white">
                      <th className="text-left py-2 px-3 font-semibold border border-slate-300 w-24">Cód.</th>
                      <th className="text-left py-2 px-3 font-semibold border border-slate-300">Medicamento</th>
                      <th className="text-right py-2 px-3 font-semibold border border-slate-300 w-32">Quantidade Saída</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(medicamentosPorAla[ala])
                      .sort((a, b) => a.nome.toLowerCase() < b.nome.toLowerCase() ? -1 : a.nome.toLowerCase() > b.nome.toLowerCase() ? 1 : 0)
                      .map((item, idx) => (
                        <tr key={item.nome} className={idx % 2 === 0 ? "bg-slate-50" : "bg-white"}>
                          <td className="py-2 px-3 border border-slate-300 text-sm font-medium">{item.codigo}</td>
                          <td className="py-2 px-3 border border-slate-300 font-medium text-slate-700">{item.nome}</td>
                          <td className="py-2 px-3 border border-slate-300 text-right font-bold text-indigo-700">
                            {item.quantidade.toLocaleString('pt-BR')} un
                          </td>
                        </tr>
                    ))}
                    <tr className="bg-indigo-100 font-bold">
                      <td colSpan={2} className="py-3 px-4 border border-slate-300 text-right">TOTAL DA ALA:</td>
                      <td className="py-3 px-4 border border-slate-300 text-right text-indigo-800">
                        {Object.values(medicamentosPorAla[ala]).reduce((sum, item) => sum + item.quantidade, 0).toLocaleString('pt-BR')} un
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {/* Alertas - Vencimentos por faixa */}
        {secoesVisiveis.vencimento && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-2 pb-2 border-b border-slate-200 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              Controle de Vencimentos
            </h2>

            {/* Resumo visual das faixas */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              <div className="border-2 border-red-400 rounded-lg p-3 bg-red-50 text-center">
                <p className="text-2xl font-black text-red-700">{loteVencidosRelatorio.length}</p>
                <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Vencidos</p>
                <p className="text-[10px] text-red-400">com estoque ativo</p>
              </div>
              <div className="border-2 border-orange-400 rounded-lg p-3 bg-orange-50 text-center">
                <p className="text-2xl font-black text-orange-700">{vencimento30.length}</p>
                <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Até 30 dias</p>
                <p className="text-[10px] text-orange-400">vencimento crítico</p>
              </div>
              <div className="border-2 border-yellow-400 rounded-lg p-3 bg-yellow-50 text-center">
                <p className="text-2xl font-black text-yellow-700">{vencimento60.length}</p>
                <p className="text-xs font-semibold text-yellow-600 uppercase tracking-wide">31–60 dias</p>
                <p className="text-[10px] text-yellow-400">atenção moderada</p>
              </div>
              <div className="border-2 border-amber-400 rounded-lg p-3 bg-amber-50 text-center">
                <p className="text-2xl font-black text-amber-700">{vencimento120.length}</p>
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide">61–120 dias</p>
                <p className="text-[10px] text-amber-400">vigilância preventiva</p>
              </div>
            </div>

            {/* Tabela auxiliar para renderização das 4 faixas */}
            {[
              { label: "🔴 Medicamentos VENCIDOS (com estoque ativo)", items: loteVencidosRelatorio, headerCls: "bg-red-700", rowCls: "bg-red-50", diasCls: "text-red-900 font-black", diasLabel: (d) => `${Math.abs(d)}d atrás` },
              { label: "🟠 Próximos ao Vencimento — Até 30 dias (CRÍTICO)", items: vencimento30, headerCls: "bg-orange-600", rowCls: "bg-orange-50", diasCls: "text-orange-800 font-bold", diasLabel: (d) => `${d}d` },
              { label: "🟡 Próximos ao Vencimento — 31 a 60 dias", items: vencimento60, headerCls: "bg-yellow-500", rowCls: "bg-yellow-50", diasCls: "text-yellow-800 font-bold", diasLabel: (d) => `${d}d` },
              { label: "🟢 Atenção Preventiva — 61 a 120 dias", items: vencimento120, headerCls: "bg-amber-500", rowCls: "bg-amber-50", diasCls: "text-amber-800 font-semibold", diasLabel: (d) => `${d}d` },
            ].map(({ label, items, headerCls, rowCls, diasCls, diasLabel }) => (
              <div key={label} className="mb-5">
                <h3 className="text-sm font-bold text-slate-700 mb-2">{label}</h3>
                {items.length > 0 ? (
                  <table className="w-full border-collapse border border-slate-300">
                    <thead>
                      <tr className={`${headerCls} text-white`}>
                        <th className="text-left py-2 px-3 text-xs font-semibold border border-slate-300">Cód.</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold border border-slate-300">Medicamento</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold border border-slate-300">Lote</th>
                        <th className="text-center py-2 px-3 text-xs font-semibold border border-slate-300">Quant.</th>
                        <th className="text-center py-2 px-3 text-xs font-semibold border border-slate-300">Validade</th>
                        <th className="text-center py-2 px-3 text-xs font-semibold border border-slate-300">Restante</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <tr key={idx} className={idx % 2 === 0 ? rowCls : "bg-white"}>
                          <td className="py-2 px-3 border border-slate-300 text-[10px] font-medium">{item.codigo}</td>
                          <td className="py-2 px-3 border border-slate-300 font-medium text-sm">{item.medicamento}</td>
                          <td className="py-2 px-3 border border-slate-300 text-sm">{item.lote}</td>
                          <td className="py-2 px-3 border border-slate-300 text-center text-sm">{item.quantidade.toLocaleString('pt-BR')}</td>
                          <td className="py-2 px-3 border border-slate-300 text-center text-sm">{format(parseISO(item.validade), "dd/MM/yyyy")}</td>
                          <td className={`py-2 px-3 border border-slate-300 text-center text-sm ${diasCls}`}>
                            {diasLabel(item.dias)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-slate-400 text-center py-3 bg-slate-50 rounded border border-slate-200 text-sm italic">
                    Nenhum medicamento nesta faixa
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Média Mensal de Consumo (MMC) */}
        {secoesVisiveis.mmc && (
          <div className="mb-8 break-before-page">
            <h2 className="text-xl font-bold text-slate-800 mb-2 pb-2 border-b border-slate-200">
              Consumo Médio Mensal (MMC)
            </h2>
            <p className="text-xs text-slate-500 mb-4 italic">
              Baseado nos últimos 4 meses fechados ({format(mmcDataInicio, "MM/yyyy")} a {format(mmcDataFim, "MM/yyyy")})
            </p>

            {!temQuatroMeses && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <div>
                  <p className="font-bold text-sm">Informação: Dados em Acúmulo</p>
                  <p className="text-xs">
                    O sistema ainda não possui 4 meses completos de registros para gerar uma média histórica precisa. 
                    Os valores abaixo refletem apenas o período registrado até o momento.
                  </p>
                </div>
              </div>
            )}

            <table className="w-full border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="text-left py-2 px-3 text-xs font-semibold border border-slate-300">Cód.</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold border border-slate-300">Medicamento</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold border border-slate-300">Consumo Total (4m)</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold border border-slate-300">MMC (Média)</th>
                  <th className="text-right py-2 px-3 text-xs font-semibold border border-slate-300">Estoque Atual</th>
                  <th className="text-center py-2 px-3 text-xs font-semibold border border-slate-300">Autonomia</th>
                </tr>
              </thead>
              <tbody>
                {mmcLista.length > 0 ? (
                  mmcLista.map((item, idx) => {
                    const mediaNum = Number(item.media);
                    const estoqueNum = Number(item.estoque_atual);
                    const autonomia = mediaNum > 0 ? Math.floor(estoqueNum / mediaNum) : (estoqueNum > 0 ? "∞" : 0);
                    return (
                      <tr key={item.id} className={idx % 2 === 0 ? "bg-slate-50" : "bg-white"}>
                        <td className="py-2 px-3 border border-slate-300 text-[10px] font-medium">{item.codigo}</td>
                        <td className="py-2 px-3 border border-slate-300 font-medium text-sm">{item.nome}</td>
                        <td className="py-2 px-3 border border-slate-300 text-right text-sm">{item.total.toLocaleString('pt-BR')}</td>
                        <td className="py-2 px-3 border border-slate-300 text-right font-bold text-sm text-indigo-700">
                          {item.media.toLocaleString('pt-BR')}
                        </td>
                        <td className="py-2 px-3 border border-slate-300 text-right text-sm">{item.estoque_atual.toLocaleString('pt-BR')}</td>
                        <td className={`py-2 px-3 border border-slate-300 text-center text-xs font-bold ${typeof autonomia === 'number' && autonomia < 2 ? "text-red-600" : "text-slate-600"}`}>
                          {autonomia} {autonomia === "∞" ? "" : "meses"}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-500 italic text-sm">
                      Nenhum consumo registrado nos últimos 4 meses.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Medicamentos com estoque baixo */}
        {secoesVisiveis.estoqueBaixo && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4 pb-2 border-b border-slate-200 flex items-center gap-2">
              <Package className="w-5 h-5 text-red-600" />
              Medicamentos com Estoque Baixo
            </h2>
            {estoqueBaixo.length > 0 ? (
              <table className="w-full border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-red-600 text-white">
                    <th className="text-left py-2 px-3 text-xs font-semibold border border-slate-300">Cód.</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold border border-slate-300">Medicamento</th>
                    <th className="text-left py-2 px-3 text-xs font-semibold border border-slate-300">Categoria</th>
                    <th className="text-center py-2 px-3 text-xs font-semibold border border-slate-300">Atual</th>
                    <th className="text-center py-2 px-3 text-xs font-semibold border border-slate-300">Min.</th>
                    <th className="text-center py-2 px-3 text-xs font-semibold border border-slate-300">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {estoqueBaixo.map((item, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? "bg-red-50" : "bg-white"}>
                      <td className="py-2 px-3 border border-slate-300 text-[10px] font-medium">{item.codigo}</td>
                      <td className="py-2 px-3 border border-slate-300 font-medium text-sm">{item.nome}</td>
                      <td className="py-2 px-3 border border-slate-300 text-sm">{item.categoria}</td>
                      <td className="py-2 px-3 border border-slate-300 text-center font-bold text-red-700 text-sm">
                        {item.estoque_atual.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-2 px-3 border border-slate-300 text-center text-sm">
                        {item.estoque_minimo.toLocaleString('pt-BR')}
                      </td>
                      <td className="py-2 px-3 border border-slate-300 text-center font-bold text-red-700 text-xs">
                        {item.estoque_atual === 0 ? "ZERADO" : "CRÍTICO"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-slate-500 text-center py-4 bg-green-50 rounded border border-green-200">
                ✓ Todos os medicamentos com estoque adequado
              </p>
            )}
          </div>
        )}

        {/* Rodapé */}
        <div className="mt-12 pt-6 border-t-2 border-slate-300">
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-sm text-slate-600 mb-12">Responsável pela Farmácia:</p>
              <div className="border-t-2 border-slate-400 pt-2">
                <p className="text-xs text-slate-500">Assinatura e Carimbo</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-slate-600 mb-12">Farmacêutico Responsável:</p>
              <div className="border-t-2 border-slate-400 pt-2">
                <p className="text-xs text-slate-500">Assinatura e CRF</p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-sm font-semibold text-slate-700 mb-2">Observações:</p>
            <div className="border border-slate-300 rounded-lg p-4 min-h-[80px] bg-slate-50"></div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 15mm;
          }
          body { 
            print-color-adjust: exact; 
            -webkit-print-color-adjust: exact; 
            background-color: white !important;
          }
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0 !important;
          }
          
          .no-print, nav, header, footer, button { display: none !important; }
          
          .bg-white { border: none !important; padding: 0 !important; }
          
          table { 
            width: 100% !important;
            page-break-inside: auto;
            border-collapse: collapse !important;
          }
          tr { page-break-inside: avoid; page-break-after: auto; }
          thead { display: table-header-group; }
          
          h1, h2, h3 { 
            page-break-after: avoid; 
            color: black !important;
          }
          
          .border-b-2.border-indigo-600 {
            border-bottom-color: #4f46e5 !important;
            border-bottom-width: 2px !important;
          }
          
          .bg-indigo-50 { background-color: #f5f3ff !important; }
          .bg-purple-50 { background-color: #faf5ff !important; }
          .bg-green-50 { background-color: #f0fdf4 !important; }
          .bg-amber-50 { background-color: #fffbeb !important; }
          .bg-red-50 { background-color: #fef2f2 !important; }
          .bg-slate-50 { background-color: #f8fafc !important; }
          
          .text-indigo-600 { color: #4f46e5 !important; }
          .text-indigo-700 { color: #4338ca !important; }
          .text-purple-700 { color: #7e22ce !important; }
          .text-green-700 { color: #15803d !important; }
          .text-amber-700 { color: #b45309 !important; }
          .text-red-700 { color: #b91c1c !important; }
        }
      `}</style>
    </div>
  );
}
