import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/api/db";
import {
  format,
  parseISO,
  isValid,
  startOfMonth,
  endOfMonth,
  getDaysInMonth,
  getDay,
  isWeekend,
  addDays,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
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
  Printer,
  FileSpreadsheet,
  Calendar,
  Filter,
  Package,
  Layers,
  Sparkles,
  Info,
  TrendingUp,
} from "lucide-react";
import { isMav, isPsicotropico, getPortaria344List } from "@/utils/mavUtils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function MapaMensalDispensacao() {
  const hoje = useMemo(() => new Date(), []);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth()); // 0 a 11
  const [categoriaFiltro, setCategoriaFiltro] = useState("todos"); // "todos" | "psicotropicos" | "clinica" | "mav"
  const [modoVisualizacao, setModoVisualizacao] = useState("ambas"); // "ambas" | "q1" | "q2"

  // Lista dinâmica de anos (de 2023 até o ano atual + 10 ou mais, adaptável dinamicamente)
  const anosDisponiveis = useMemo(() => {
    const anoAtual = hoje.getFullYear();
    const minAno = 2023;
    const maxAno = Math.max(anoAtual + 10, ano + 5, 2035);
    const lista = [];
    for (let y = minAno; y <= maxAno; y++) {
      lista.push(y);
    }
    return lista;
  }, [hoje, ano]);

  // 1. Carregar Medicamentos e Saídas do Sistema
  const { data: medicamentos = [], isLoading: loadingMeds } = useQuery({
    queryKey: ["medicamentos"],
    queryFn: () => db.entities.Medicamento.list(),
  });

  const { data: saidas = [], isLoading: loadingSaidas } = useQuery({
    queryKey: ["saidas"],
    queryFn: () => db.entities.Saida.list(),
  });

  // 2. Cálculo dos Dias do Mês Selecionado
  const dataReferencia = useMemo(() => new Date(ano, mes, 1), [ano, mes]);
  const totalDiasMes = useMemo(() => getDaysInMonth(dataReferencia), [dataReferencia]);

  const listaDias = useMemo(() => {
    return Array.from({ length: totalDiasMes }, (_, i) => i + 1);
  }, [totalDiasMes]);

  const diasQ1 = useMemo(() => listaDias.filter((d) => d <= 15), [listaDias]);
  const diasQ2 = useMemo(() => listaDias.filter((d) => d > 15), [listaDias]);

  // 3. Processamento das Saídas e Distribuição Diária (Opção 1)
  const matrizDispensacao = useMemo(() => {
    if (!medicamentos.length) return { linhas: [], totaisPorDia: {}, totalGeral: 0, totalQ1: 0, totalQ2: 0, diaPico: null };

    // Mapa acumulador: medId -> { dias: { [dia]: quantidade }, totalQ1, totalQ2, totalMes }
    const mapaMeds = {};

    // Inicializa estrutura para medicamentos
    medicamentos.forEach((med) => {
      mapaMeds[med.id] = {
        medicamento: med,
        dias: {},
        totalQ1: 0,
        totalQ2: 0,
        totalMes: 0,
      };
      for (let d = 1; d <= totalDiasMes; d++) {
        mapaMeds[med.id].dias[d] = 0;
      }
    });

    const mesStr = String(mes + 1).padStart(2, "0");
    const anoStr = String(ano);

    // Processa cada saída registrada no sistema
    saidas.forEach((saida) => {
      const medId = saida.medicamento_id || saida.medicamentoId;
      if (!medId || !mapaMeds[medId]) return;

      // 1. REGRA RIGOROSA: Apenas saídas destinadas diretamente a pacientes reais
      const nomePac = (saida.paciente_nome || saida.pacienteNome || "").trim();
      const idPac = (saida.paciente_id || saida.pacienteId || "").trim();
      
      // Se não há paciente vinculado ou é texto genérico/placeholder, descarta (não entra no mapa)
      if (!nomePac && !idPac) return;
      const nomePacLower = nomePac.toLowerCase();
      if (
        nomePacLower === "paciente não informado" || 
        nomePacLower === "sem paciente vinculado" ||
        nomePacLower === "não informado" ||
        nomePacLower === "n/i" ||
        nomePacLower === "null" ||
        nomePacLower === "undefined"
      ) {
        return;
      }

      // 2. REGRA RIGOROSA: Desconsidera movimentações internas, transferências, perdas, descarte, carrinho ou empréstimo
      const tipo = (saida.tipo || "").toLowerCase();
      const motivo = (saida.motivo || "").toLowerCase();
      const destino = (saida.destino || "").toLowerCase();

      if (
        tipo.includes("transferencia") || 
        tipo.includes("transferência") || 
        tipo.includes("carrinho") || 
        tipo.includes("abastecimento") ||
        tipo.includes("perda") || 
        tipo.includes("descarte") || 
        tipo.includes("emprestimo") || 
        tipo.includes("empréstimo") || 
        tipo.includes("ajuste") ||
        tipo.includes("inventario") ||
        tipo.includes("inventário") ||
        tipo.includes("estorno") ||
        motivo.includes("transferência") ||
        motivo.includes("transferencia") ||
        motivo.includes("abastecimento") ||
        motivo.includes("carrinho de parada") ||
        motivo.includes("ajuste de estoque") ||
        motivo.includes("perda") ||
        motivo.includes("quebra") ||
        destino.includes("farmácia satélite") ||
        destino.includes("farmacia satelite") ||
        destino.includes("estoque central") ||
        destino.includes("carrinho de parada") ||
        destino.includes("almoxarifado")
      ) {
        return;
      }

      const qtd = Number(saida.quantidade) || 0;
      if (qtd <= 0) return;

      // Caso A: Saída com cobertura de lote/ciclo (distribui nos dias do ciclo)
      if (
        (saida.is_baixa_lote_paciente || (saida.dias_cobertura && saida.dias_cobertura > 1)) &&
        saida.data_inicio_cobertura &&
        saida.data_fim_cobertura
      ) {
        const dInicio = parseISO(saida.data_inicio_cobertura);
        const dFim = parseISO(saida.data_fim_cobertura);

        if (isValid(dInicio) && isValid(dFim)) {
          const diasCob = Number(saida.dias_cobertura) || 1;
          const doseDia = Number(saida.dose_diaria) || (qtd / diasCob);

          // Percorre cada dia do intervalo de cobertura
          let curr = new Date(dInicio);
          while (curr <= dFim) {
            const currAno = curr.getFullYear();
            const currMes = curr.getMonth();
            const currDia = curr.getDate();

            // Se o dia estiver dentro do mês/ano selecionado
            if (currAno === ano && currMes === mes && currDia <= totalDiasMes) {
              mapaMeds[medId].dias[currDia] = (mapaMeds[medId].dias[currDia] || 0) + doseDia;
            }
            curr = addDays(curr, 1);
          }
          return;
        }
      }

      // Caso B: Saída avulsa comum (aloca no dia exato de data_saida)
      const dataSaidaStr = saida.data_saida || saida.created_at;
      if (!dataSaidaStr) return;

      const [sAno, sMes, sDia] = dataSaidaStr.slice(0, 10).split("-");
      if (sAno === anoStr && sMes === mesStr) {
        const diaNum = parseInt(sDia, 10);
        if (diaNum >= 1 && diaNum <= totalDiasMes) {
          mapaMeds[medId].dias[diaNum] = (mapaMeds[medId].dias[diaNum] || 0) + qtd;
        }
      }
    });

    // Calcular subtotais e totais por dia
    const totaisPorDia = {};
    for (let d = 1; d <= totalDiasMes; d++) {
      totaisPorDia[d] = 0;
    }

    let totalGeral = 0;
    let totalQ1Geral = 0;
    let totalQ2Geral = 0;

    const linhas = [];

    Object.values(mapaMeds).forEach((item) => {
      let tQ1 = 0;
      let tQ2 = 0;
      let tMes = 0;

      for (let d = 1; d <= totalDiasMes; d++) {
        const val = Math.round(item.dias[d] * 10) / 10; // arredondamento com 1 casa se fração
        item.dias[d] = val;

        if (d <= 15) tQ1 += val;
        else tQ2 += val;

        tMes += val;
        totaisPorDia[d] += val;
      }

      item.totalQ1 = Math.round(tQ1);
      item.totalQ2 = Math.round(tQ2);
      item.totalMes = Math.round(tMes);

      totalQ1Geral += item.totalQ1;
      totalQ2Geral += item.totalQ2;
      totalGeral += item.totalMes;

      // Classificações Farmacológicas
      const med = item.medicamento;
      const ehPsi = isPsicotropico(med);
      const ehMav = isMav(med);
      const listaP344 = ehPsi ? getPortaria344List(med) : null;

      item.isPsicotropico = ehPsi;
      item.isMav = ehMav;
      item.listaP344 = listaP344;
      item.isClinica = !ehPsi && !ehMav;

      // Inclui apenas itens que tiveram movimentação no mês ou todos com estoque ativo
      if (item.totalMes > 0 || (med.estoque_satelite && med.estoque_satelite > 0)) {
        linhas.push(item);
      }
    });

    // Ordenar: primeiro os com maior saída no mês
    linhas.sort((a, b) => b.totalMes - a.totalMes || a.medicamento.nome.localeCompare(b.medicamento.nome));

    // Identificar dia de pico
    let diaPico = null;
    let maxDiaVal = -1;
    for (let d = 1; d <= totalDiasMes; d++) {
      if (totaisPorDia[d] > maxDiaVal) {
        maxDiaVal = totaisPorDia[d];
        diaPico = { dia: d, valor: Math.round(maxDiaVal) };
      }
    }

    return {
      linhas,
      totaisPorDia,
      totalGeral: Math.round(totalGeral),
      totalQ1: Math.round(totalQ1Geral),
      totalQ2: Math.round(totalQ2Geral),
      diaPico,
    };
  }, [medicamentos, saidas, ano, mes, totalDiasMes]);

  // 4. Filtragem por Categoria
  const linhasFiltradas = useMemo(() => {
    return matrizDispensacao.linhas.filter((item) => {
      if (categoriaFiltro === "psicotropicos") return item.isPsicotropico;
      if (categoriaFiltro === "clinica") return item.isClinica;
      if (categoriaFiltro === "mav") return item.isMav;
      return true;
    });
  }, [matrizDispensacao.linhas, categoriaFiltro]);

  // Exportação CSV formatado para Excel
  const exportarExcel = () => {
    try {
      const nomeMes = format(dataReferencia, "MMMM_yyyy", { locale: ptBR });
      let csv = "\uFEFF"; // BOM UTF-8

      // Cabeçalho
      const colsDias = Array.from({ length: totalDiasMes }, (_, i) => `Dia_${String(i + 1).padStart(2, "0")}`).join(";");
      csv += `Código;Medicamento;Apresentação;Categoria;Portaria_344;${colsDias};Total_1Q;Total_2Q;Total_Mes\n`;

      linhasFiltradas.forEach((item) => {
        const med = item.medicamento;
        const cod = med.codigo || "S/C";
        const nome = `"${med.nome.replace(/"/g, '""')}"`;
        const apres = `"${(med.apresentacao || med.unidade_medida || "un").replace(/"/g, '""')}"`;
        const cat = item.isPsicotropico ? "Psicotrópico" : item.isMav ? "MAV" : "Clínico Geral";
        const p344 = item.listaP344 || "-";

        const valoresDias = [];
        for (let d = 1; d <= totalDiasMes; d++) {
          valoresDias.push(item.dias[d] || 0);
        }

        csv += `${cod};${nome};${apres};${cat};${p344};${valoresDias.join(";")};${item.totalQ1};${item.totalQ2};${item.totalMes}\n`;
      });

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `mapa_dispensacao_diaria_${nomeMes}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Planilha exportada com sucesso!");
    } catch (err) {
      toast.error("Erro ao exportar planilha: " + err.message);
    }
  };

  const mesesNomes = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  return (
    <div className="space-y-6">
      {/* ─── PAINEL DE CONTROLE (NO-PRINT) ─── */}
      <div className="no-print space-y-4">
        {/* Topo com Título e Ações */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 rounded-xl">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    Mapa Mensal de Dispensação Diária
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                      A4 Paisagem • 2 Folhas
                    </Badge>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Consolidação unificada: Baixas em Lote de Pacientes + Saídas Manuais da Farmácia Satélite
                  </p>
                </div>
              </div>
            </div>

            {/* Ações e Seletor de Período */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
                  <SelectTrigger className="w-[125px] h-8 text-xs font-bold bg-white dark:bg-slate-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {mesesNomes.map((m, idx) => (
                      <SelectItem key={idx} value={String(idx)} className="text-xs">
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={String(ano)} onValueChange={(v) => setAno(Number(v))}>
                  <SelectTrigger className="w-[90px] h-8 text-xs font-bold bg-white dark:bg-slate-900">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-64 overflow-y-auto">
                    {anosDisponiveis.map((a) => (
                      <SelectItem key={a} value={String(a)} className="text-xs font-semibold">
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline"
                onClick={exportarExcel}
                className="h-9 px-3 text-xs font-bold gap-1.5 text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 border-slate-300"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Exportar Excel (.csv)
              </Button>

              <Button
                onClick={() => window.print()}
                className="h-9 px-4 text-xs font-bold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              >
                <Printer className="w-4 h-4" />
                Imprimir em A4 (2 Folhas)
              </Button>
            </div>
          </div>

          {/* Barra de Filtros Farmacológicos e Abas de Tela */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pt-4 mt-4 border-t border-slate-100 dark:border-slate-800">
            {/* Categorias Farmacológicas */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-slate-500 uppercase mr-1">Filtrar:</span>
              <button
                type="button"
                onClick={() => setCategoriaFiltro("todos")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer",
                  categoriaFiltro === "todos"
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                Todos ({matrizDispensacao.linhas.length})
              </button>
              <button
                type="button"
                onClick={() => setCategoriaFiltro("psicotropicos")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer",
                  categoriaFiltro === "psicotropicos"
                    ? "bg-purple-600 text-white"
                    : "bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200"
                )}
              >
                🟣 Psicotrópicos / P344 ({matrizDispensacao.linhas.filter((x) => x.isPsicotropico).length})
              </button>
              <button
                type="button"
                onClick={() => setCategoriaFiltro("clinica")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer",
                  categoriaFiltro === "clinica"
                    ? "bg-sky-600 text-white"
                    : "bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200"
                )}
              >
                🔵 Clínica Geral ({matrizDispensacao.linhas.filter((x) => x.isClinica).length})
              </button>
              <button
                type="button"
                onClick={() => setCategoriaFiltro("mav")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer",
                  categoriaFiltro === "mav"
                    ? "bg-red-600 text-white"
                    : "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                )}
              >
                🔴 Alta Vigilância - MAV ({matrizDispensacao.linhas.filter((x) => x.isMav).length})
              </button>
            </div>

            {/* Alternar Folhas na Tela */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setModoVisualizacao("ambas")}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  modoVisualizacao === "ambas" ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs" : "text-slate-500"
                )}
              >
                📋 Ambas as Folhas
              </button>
              <button
                type="button"
                onClick={() => setModoVisualizacao("q1")}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  modoVisualizacao === "q1" ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 shadow-xs" : "text-slate-500"
                )}
              >
                📄 1ª Folha (01 a 15)
              </button>
              <button
                type="button"
                onClick={() => setModoVisualizacao("q2")}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  modoVisualizacao === "q2" ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-xs" : "text-slate-500"
                )}
              >
                📄 2ª Folha (16 a {totalDiasMes})
              </button>
            </div>
          </div>
        </div>

        {/* Cards de Resumo / KPIs Rápidos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3.5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Total Dispensado no Mês
            </span>
            <div className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">
              {matrizDispensacao.totalGeral.toLocaleString("pt-BR")} <span className="text-xs font-normal text-slate-500">un</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {mesesNomes[mes]} de {ano}
            </span>
          </Card>

          <Card className="p-3.5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              1ª Quinzena (Dias 01 a 15)
            </span>
            <div className="text-xl font-black text-blue-700 dark:text-blue-400 mt-1">
              {matrizDispensacao.totalQ1.toLocaleString("pt-BR")} <span className="text-xs font-normal text-slate-500">un</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Folha 1 da impressão
            </span>
          </Card>

          <Card className="p-3.5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              2ª Quinzena (Dias 16 a {totalDiasMes})
            </span>
            <div className="text-xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
              {matrizDispensacao.totalQ2.toLocaleString("pt-BR")} <span className="text-xs font-normal text-slate-500">un</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Folha 2 da impressão
            </span>
          </Card>

          <Card className="p-3.5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Pico de Saída no Mês
            </span>
            <div className="text-xl font-black text-indigo-700 dark:text-indigo-400 mt-1">
              {matrizDispensacao.diaPico ? `Dia ${String(matrizDispensacao.diaPico.dia).padStart(2, "0")}` : "--"}
              <span className="text-xs font-bold text-slate-500 ml-1">
                ({matrizDispensacao.diaPico?.valor || 0} un)
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Dia de maior demanda
            </span>
          </Card>
        </div>
      </div>

      {/* ─── CORPO PRINCIPAL DO MAPA (TABELAS QUINZENAIS) ─── */}
      <div className="space-y-6">

        {/* ===================================================================
            FOLHA 1: PRIMEIRA QUINZENA (DIAS 01 A 15)
            =================================================================== */}
        {(modoVisualizacao === "ambas" || modoVisualizacao === "q1") && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs print:border-none print:shadow-none print:m-0 print:p-0 page-break-after">
            
            {/* Cabeçalho da Folha 1 (visível na tela e na impressão) */}
            <div className="bg-slate-50 dark:bg-slate-800/80 p-3.5 px-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center print:border-b-2 print:border-black print:p-1 print:mb-1">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight print:text-xs">
                  Zorion Saúde • Mapa de Dispensação Diária — 1ª Quinzena (Dias 01 a 15)
                </h3>
                <p className="text-[11px] text-slate-500 print:text-[8px]">
                  Mês de Referência: <strong>{mesesNomes[mes]} / {ano}</strong> • Folha 1 de 2
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-black text-blue-700 dark:text-blue-300 font-mono print:text-[9px]">
                  Subtotal 1ª Q: {matrizDispensacao.totalQ1} un
                </span>
                <span className="text-[10px] text-slate-400 block print:hidden">A4 Paisagem</span>
              </div>
            </div>

            {/* Tabela Quinzena 1 */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[11px] print:text-[8px]">
                <thead>
                  <tr className="bg-slate-100/80 dark:bg-slate-800 border-b-2 border-slate-300 dark:border-slate-700 print:bg-slate-100">
                    <th className="text-left py-2 px-3 min-w-[220px] max-w-[260px] font-bold text-slate-700">
                      Medicamento / Apresentação
                    </th>
                    <th className="text-center py-2 px-1 w-12 font-bold text-slate-700">Cat.</th>
                    {diasQ1.map((d) => {
                      const dataDia = new Date(ano, mes, d);
                      const fds = isWeekend(dataDia);
                      return (
                        <th
                          key={d}
                          className={cn(
                            "text-center py-2 px-1 w-8 font-mono font-bold border-r border-slate-200 dark:border-slate-700",
                            fds ? "bg-slate-200/60 dark:bg-slate-700/60 text-slate-500" : "text-slate-800"
                          )}
                          title={`${String(d).padStart(2, "0")}/${String(mes + 1).padStart(2, "0")} (${fds ? "Final de semana" : "Dia útil"})`}
                        >
                          {String(d).padStart(2, "0")}{fds ? "*" : ""}
                        </th>
                      );
                    })}
                    <th className="text-center py-2 px-2 min-w-[70px] font-bold bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 border-l-2 border-blue-200">
                      TOTAL 1ª Q.
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {linhasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={18} className="text-center py-8 text-slate-400">
                        Nenhum medicamento encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    linhasFiltradas.map((item) => {
                      const med = item.medicamento;
                      return (
                        <tr key={med.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-1.5 px-3">
                            <div className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[240px]" title={med.nome}>
                              {med.nome}
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                              <span>Cód: {med.codigo || "S/C"}</span>
                              {med.concentracao && <span>• {med.concentracao}</span>}
                              {item.isPsicotropico && (
                                <span className="text-[9px] font-black text-purple-700 bg-purple-50 px-1 rounded border border-purple-200">
                                  {item.listaP344 || "P344"}
                                </span>
                              )}
                              {item.isMav && (
                                <span className="text-[9px] font-black text-red-700 bg-red-50 px-1 rounded border border-red-200">
                                  MAV
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="text-center py-1.5 px-1 font-mono text-[10px]">
                            {item.isPsicotropico ? (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-purple-50 text-purple-700 border-purple-200">
                                {item.listaP344 || "P344"}
                              </Badge>
                            ) : item.isMav ? (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-red-50 text-red-700 border-red-200">
                                MAV
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-sky-50 text-sky-700 border-sky-200">
                                Geral
                              </Badge>
                            )}
                          </td>

                          {diasQ1.map((d) => {
                            const val = item.dias[d] || 0;
                            const fds = isWeekend(new Date(ano, mes, d));
                            return (
                              <td
                                key={d}
                                className={cn(
                                  "text-center py-1 px-0.5 font-mono border-r border-slate-100 dark:border-slate-800",
                                  fds && "bg-slate-50/50 dark:bg-slate-800/20"
                                )}
                              >
                                {val > 0 ? (
                                  <span
                                    className={cn(
                                      "inline-block px-1 py-0.5 rounded text-[10px] font-bold",
                                      val >= 20 ? "bg-amber-100 text-amber-900" : "text-blue-900 dark:text-blue-200"
                                    )}
                                  >
                                    {val}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-600">-</span>
                                )}
                              </td>
                            );
                          })}

                          <td className="text-center py-1.5 px-2 font-mono font-bold bg-blue-50/50 dark:bg-blue-950/20 text-blue-950 dark:text-blue-200 border-l-2 border-blue-200">
                            {item.totalQ1} un
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {/* Rodapé Totalizador da Folha 1 */}
                <tfoot>
                  <tr className="bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 font-bold text-slate-900 dark:text-slate-100 print:bg-slate-100">
                    <td className="py-2 px-3 text-right uppercase text-[10px]">
                      TOTAL DISPENSADO NO DIA:
                    </td>
                    <td className="text-center">-</td>
                    {diasQ1.map((d) => (
                      <td key={d} className="text-center py-2 px-0.5 font-mono text-[10px] border-r border-slate-200">
                        {matrizDispensacao.totaisPorDia[d] || 0}
                      </td>
                    ))}
                    <td className="text-center py-2 px-2 font-mono font-black text-blue-900 dark:text-blue-200 bg-blue-100/70 border-l-2 border-blue-300">
                      {matrizDispensacao.totalQ1} un
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ===================================================================
            FOLHA 2: SEGUNDA QUINZENA (DIAS 16 AO FIM DO MÊS) + FECHAMENTO MENSAL
            =================================================================== */}
        {(modoVisualizacao === "ambas" || modoVisualizacao === "q2") && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs print:border-none print:shadow-none print:m-0 print:p-0 page-break-before">
            
            {/* Cabeçalho da Folha 2 */}
            <div className="bg-slate-50 dark:bg-slate-800/80 p-3.5 px-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center print:border-b-2 print:border-black print:p-1 print:mb-1">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight print:text-xs">
                  Zorion Saúde • Mapa de Dispensação Diária — 2ª Quinzena (Dias 16 a {totalDiasMes})
                </h3>
                <p className="text-[11px] text-slate-500 print:text-[8px]">
                  Mês de Referência: <strong>{mesesNomes[mes]} / {ano}</strong> • Folha 2 de 2 (Fechamento Mensal)
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 font-mono print:text-[9px]">
                  Subtotal 2ª Q: {matrizDispensacao.totalQ2} un &nbsp;|&nbsp; TOTAL MÊS: {matrizDispensacao.totalGeral} un
                </span>
                <span className="text-[10px] text-slate-400 block print:hidden">A4 Paisagem</span>
              </div>
            </div>

            {/* Tabela Quinzena 2 */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[11px] print:text-[8px]">
                <thead>
                  <tr className="bg-slate-100/80 dark:bg-slate-800 border-b-2 border-slate-300 dark:border-slate-700 print:bg-slate-100">
                    <th className="text-left py-2 px-3 min-w-[220px] max-w-[260px] font-bold text-slate-700">
                      Medicamento / Apresentação
                    </th>
                    <th className="text-center py-2 px-1 w-12 font-bold text-slate-700">Cat.</th>
                    {diasQ2.map((d) => {
                      const dataDia = new Date(ano, mes, d);
                      const fds = isWeekend(dataDia);
                      return (
                        <th
                          key={d}
                          className={cn(
                            "text-center py-2 px-1 w-8 font-mono font-bold border-r border-slate-200 dark:border-slate-700",
                            fds ? "bg-slate-200/60 dark:bg-slate-700/60 text-slate-500" : "text-slate-800"
                          )}
                          title={`${String(d).padStart(2, "0")}/${String(mes + 1).padStart(2, "0")} (${fds ? "Final de semana" : "Dia útil"})`}
                        >
                          {String(d).padStart(2, "0")}{fds ? "*" : ""}
                        </th>
                      );
                    })}
                    <th className="text-center py-2 px-2 min-w-[65px] font-bold bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-l-2 border-emerald-200">
                      TOTAL 2ª Q.
                    </th>
                    <th className="text-center py-2 px-2 min-w-[75px] font-bold bg-blue-100 dark:bg-blue-900 text-blue-950 dark:text-blue-100 border-l-2 border-blue-400">
                      TOTAL MÊS
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {linhasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={19} className="text-center py-8 text-slate-400">
                        Nenhum medicamento encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    linhasFiltradas.map((item) => {
                      const med = item.medicamento;
                      return (
                        <tr key={med.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-1.5 px-3">
                            <div className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[240px]" title={med.nome}>
                              {med.nome}
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                              <span>Cód: {med.codigo || "S/C"}</span>
                              {med.concentracao && <span>• {med.concentracao}</span>}
                              {item.isPsicotropico && (
                                <span className="text-[9px] font-black text-purple-700 bg-purple-50 px-1 rounded border border-purple-200">
                                  {item.listaP344 || "P344"}
                                </span>
                              )}
                              {item.isMav && (
                                <span className="text-[9px] font-black text-red-700 bg-red-50 px-1 rounded border border-red-200">
                                  MAV
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="text-center py-1.5 px-1 font-mono text-[10px]">
                            {item.isPsicotropico ? (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-purple-50 text-purple-700 border-purple-200">
                                {item.listaP344 || "P344"}
                              </Badge>
                            ) : item.isMav ? (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-red-50 text-red-700 border-red-200">
                                MAV
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 bg-sky-50 text-sky-700 border-sky-200">
                                Geral
                              </Badge>
                            )}
                          </td>

                          {diasQ2.map((d) => {
                            const val = item.dias[d] || 0;
                            const fds = isWeekend(new Date(ano, mes, d));
                            return (
                              <td
                                key={d}
                                className={cn(
                                  "text-center py-1 px-0.5 font-mono border-r border-slate-100 dark:border-slate-800",
                                  fds && "bg-slate-50/50 dark:bg-slate-800/20"
                                )}
                              >
                                {val > 0 ? (
                                  <span
                                    className={cn(
                                      "inline-block px-1 py-0.5 rounded text-[10px] font-bold",
                                      val >= 20 ? "bg-amber-100 text-amber-900" : "text-emerald-900 dark:text-emerald-200"
                                    )}
                                  >
                                    {val}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-600">-</span>
                                )}
                              </td>
                            );
                          })}

                          <td className="text-center py-1.5 px-2 font-mono font-bold bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-950 dark:text-emerald-200 border-l-2 border-emerald-200">
                            {item.totalQ2} un
                          </td>

                          <td className="text-center py-1.5 px-2 font-mono font-black bg-blue-50 dark:bg-blue-950 text-blue-900 dark:text-blue-100 border-l-2 border-blue-400">
                            {item.totalMes} un
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {/* Rodapé Totalizador da Folha 2 */}
                <tfoot>
                  <tr className="bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 font-bold text-slate-900 dark:text-slate-100 print:bg-slate-100">
                    <td className="py-2 px-3 text-right uppercase text-[10px]">
                      TOTAL DISPENSADO NO DIA:
                    </td>
                    <td className="text-center">-</td>
                    {diasQ2.map((d) => (
                      <td key={d} className="text-center py-2 px-0.5 font-mono text-[10px] border-r border-slate-200">
                        {matrizDispensacao.totaisPorDia[d] || 0}
                      </td>
                    ))}
                    <td className="text-center py-2 px-2 font-mono font-black text-emerald-900 dark:text-emerald-200 bg-emerald-100/70 border-l-2 border-emerald-300">
                      {matrizDispensacao.totalQ2} un
                    </td>
                    <td className="text-center py-2 px-2 font-mono font-black text-blue-900 dark:text-blue-100 bg-blue-200/80 border-l-2 border-blue-400">
                      {matrizDispensacao.totalGeral} un
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* Estilos Globais de Impressão A4 Paisagem com quebra exata */}
      <style>{`
        @page {
          size: A4 landscape;
          margin: 8mm 8mm 8mm 8mm;
        }
        @media print {
          body {
            background: white !important;
            color: black !important;
            font-size: 8px !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break-after {
            page-break-after: always !important;
            break-after: page !important;
          }
          .page-break-before {
            page-break-before: always !important;
            break-before: page !important;
          }
          table {
            font-size: 8px !important;
          }
          th, td {
            padding: 3px 2px !important;
          }
        }
      `}</style>
    </div>
  );
}

export default MapaMensalDispensacao;
