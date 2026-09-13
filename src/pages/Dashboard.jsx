import { useEffect } from "react";
import { db } from "@/api/db";
import { useQuery } from "@tanstack/react-query";
import { Package, TrendingUp, TrendingDown, Boxes } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { format, subMonths, startOfMonth, endOfMonth, differenceInDays, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import StatsCard from "@/components/dashboard/StatsCard";
import MovimentacaoChart from "@/components/dashboard/MovimentacaoChart";
import GrupoChart from "@/components/dashboard/GrupoChart";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const queryClient = useQueryClient();
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

  // Calcular estatísticas
  const totalMedicamentos = medicamentos.length;
  const totalEstoque = medicamentos.reduce((sum, m) => sum + (m.estoque_atual || 0), 0);

  // Medicamentos com estoque baixo
  const estoqueBaixo = medicamentos
    .filter(m => m.estoque_atual <= (m.estoque_minimo || 0) && m.ativo !== false)
    .map(m => ({
      nome: m.nome,
      atual: m.estoque_atual || 0,
      minimo: m.estoque_minimo || 0,
    }));

  // Lotes próximos do vencimento (até 4 meses = 120 dias)
  const hoje = new Date();
  const proximosVencer = lotes
    .filter(l => {
      if (l.quantidade_atual <= 0) return false;
      if (!l.data_validade) return false;
      const dataVenc = parseISO(l.data_validade);
      if (!isValid(dataVenc)) return false;
      const diasParaVencer = differenceInDays(dataVenc, hoje);
      // Entre 1 e 120 dias (4 meses)
      return diasParaVencer > 0 && diasParaVencer <= 120;
    })
    .map(l => ({
      nome: l.medicamento_nome,
      lote: l.numero_lote,
      validade: l.data_validade,
      qtd: l.quantidade_atual || 0,
      diasRestantes: differenceInDays(parseISO(l.data_validade), hoje),
    }));

  // Lotes vencidos
  const vencidos = lotes
    .filter(l => {
      if (l.quantidade_atual <= 0) return false;
      if (!l.data_validade) return false;
      const dataVenc = parseISO(l.data_validade);
      if (!isValid(dataVenc)) return false;
      return dataVenc < hoje;
    })
    .map(l => ({
      nome: l.medicamento_nome,
      lote: l.numero_lote,
      validade: l.data_validade,
      qtd: l.quantidade_atual || 0,
    }));

  // Dados para gráfico de movimentação (últimos 6 meses)
  const chartData = [];
  for (let i = 5; i >= 0; i--) {
    const mesData = subMonths(hoje, i);
    const inicio = startOfMonth(mesData);
    const fim = endOfMonth(mesData);

    const entradasMes = entradas.filter(e => {
      if (!e.data_entrada) return false;
      const data = parseISO(e.data_entrada);
      return isValid(data) && data >= inicio && data <= fim;
    }).reduce((sum, e) => sum + (e.quantidade || 0), 0);

    const saidasMes = saidas.filter(s => {
      if (!s.data_saida) return false;
      const data = parseISO(s.data_saida);
      return isValid(data) && data >= inicio && data <= fim;
    }).reduce((sum, s) => sum + (s.quantidade || 0), 0);

    chartData.push({
      mes: format(mesData, "MMM", { locale: ptBR }),
      entradas: entradasMes,
      saidas: saidasMes,
    });
  }

  // Dados para gráfico de categorias (ordenados e com Top 5 + Outros para evitar poluição visual)
  const gruposContados = {};
  const origensContadas = {};
  medicamentos.forEach(m => {
    const qtd = m.estoque_atual || 0;
    if (qtd > 0) {
      const grupo = m.grupo_terapeutico?.trim() || "Outros";
      gruposContados[grupo] = (gruposContados[grupo] || 0) + qtd;

      const origem = m.origem?.trim() || "Outros";
      origensContadas[origem] = (origensContadas[origem] || 0) + qtd;
    }
  });

  const sortedGrupos = Object.entries(gruposContados).sort((a, b) => b[1] - a[1]);
  const grupoData = [];
  if (sortedGrupos.length <= 6) {
    sortedGrupos.forEach(([categoria, value]) => grupoData.push({ categoria, value }));
  } else {
    const top5 = sortedGrupos.slice(0, 5);
    const outrosSoma = sortedGrupos.slice(5).reduce((acc, curr) => acc + curr[1], 0);
    top5.forEach(([categoria, value]) => grupoData.push({ categoria, value }));
    if (outrosSoma > 0) {
      grupoData.push({ categoria: "Outros", value: outrosSoma });
    }
  }

  const origemData = Object.entries(origensContadas)
    .map(([categoria, value]) => ({ categoria, value }))
    .sort((a, b) => b.value - a.value);

  // Total entradas do mês
  const inicioMes = startOfMonth(hoje);
  const fimMes = endOfMonth(hoje);
  const entradasMesAtual = entradas
    .filter(e => {
      if (!e.data_entrada) return false;
      const data = parseISO(e.data_entrada);
      return isValid(data) && data >= inicioMes && data <= fimMes;
    })
    .reduce((sum, e) => sum + (e.quantidade || 0), 0);

  const saidasMesAtual = saidas
    .filter(s => {
      if (!s.data_saida) return false;
      const data = parseISO(s.data_saida);
      return isValid(data) && data >= inicioMes && data <= fimMes;
    })
    .reduce((sum, s) => sum + (s.quantidade || 0), 0);



  // Alerta de medicamentos próximos ao vencimento (até 4 meses)
  useEffect(() => {
    if (isLoading) return;
    if (proximosVencer.length > 0) {
      // Agrupa por urgência: até 30 dias e até 120 dias
      const urgentes = proximosVencer.filter(l => l.diasRestantes <= 30);
      const moderados = proximosVencer.filter(l => l.diasRestantes > 30 && l.diasRestantes <= 120);

      if (urgentes.length > 0) {
        toast.error(
          `⚠️ ATENÇÃO: ${urgentes.length} lote(s) vencem em até 30 dias! Verifique o estoque.`,
          { duration: 12000, id: "vencimento-urgente" }
        );
      }
      if (moderados.length > 0) {
        toast.warning(
          `🕐 ${moderados.length} lote(s) vencem nos próximos 4 meses. Planeje o uso com antecedência.`,
          { duration: 9000, id: "vencimento-moderado" }
        );
      }
    }
  }, [isLoading]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header Clean & Modern */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-950/60 border border-sky-200/80 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-xs font-semibold mb-2 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Estoque Central Ativo
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
            Painel Geral da Farmácia Central
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-0.5">
            Visão consolidada em tempo real de produtos, entradas, saídas e movimentações.
          </p>
        </div>
        <div className="text-right hidden sm:block bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 capitalize">
            {format(hoje, "EEEE", { locale: ptBR })}
          </p>
          <p className="text-[11px] text-slate-400 capitalize mt-0.5">
            {format(hoje, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>
      </div>



      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total de Medicamentos"
          value={totalMedicamentos}
          subtitle="Produtos cadastrados"
          icon={Package}
          color="blue"
        />
        <StatsCard
          title="Unidades em Estoque"
          value={totalEstoque.toLocaleString('pt-BR')}
          subtitle="Total de itens"
          icon={Boxes}
          color="purple"
        />
        <StatsCard
          title="Entradas do Mês"
          value={entradasMesAtual.toLocaleString('pt-BR')}
          subtitle={format(hoje, "MMMM 'de' yyyy", { locale: ptBR })}
          icon={TrendingUp}
          color="green"
        />
        <StatsCard
          title="Saídas do Mês"
          value={saidasMesAtual.toLocaleString('pt-BR')}
          subtitle={format(hoje, "MMMM 'de' yyyy", { locale: ptBR })}
          icon={TrendingDown}
          color="amber"
        />
      </div>



      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MovimentacaoChart data={chartData} />
        <GrupoChart data={grupoData} origemData={origemData} />
      </div>

      {/* Footer */}
      <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 text-center">
        <p className="text-slate-400 text-xs">
          Desenvolvido por{" "}
          <a
            href="https://github.com/SrGumball/"
            target="_blank"
            rel="noreferrer"
            className="text-blue-500 font-semibold hover:underline"
          >
            Alef De Araujo Dias
          </a>
        </p>
      </div>
    </div>
  );
}
