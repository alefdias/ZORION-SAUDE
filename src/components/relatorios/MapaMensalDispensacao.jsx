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
  Search,
  X,
  Hospital,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { isMav, isPsicotropico, getPortaria344List } from "@/utils/mavUtils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function formatarApresentacaoMed(med) {
  if (!med) return "COMPRIMIDO";

  const rawApres = (med.apresentacao || "").trim().toUpperCase();
  const rawForma = (med.forma_farmaceutica || "").trim().toUpperCase();
  const rawUnidade = (med.unidade_medida || "").trim().toUpperCase();
  const rawVia = (med.via_administracao || "").trim().toUpperCase();
  const nomeUpper = (med.nome || "").trim().toUpperCase();

  // 1. Frasco-ampola
  if (
    rawApres.includes("FRASCO-AMPOLA") || rawApres.includes("F/A") || rawApres.includes("FA ") ||
    rawForma.includes("FRASCO-AMPOLA") ||
    rawUnidade === "FA" || rawUnidade === "F/A" ||
    nomeUpper.includes("FRASCO-AMPOLA") || nomeUpper.includes(" F/A") || nomeUpper.includes(" FA ")
  ) {
    return "FRASCO-AMPOLA";
  }

  // 2. Ampola / Injetável
  if (
    rawApres.includes("AMPOLA") || rawApres.includes("AMP") ||
    rawForma.includes("AMPOLA") ||
    rawUnidade === "AMP" || rawUnidade === "AMPOLA" ||
    nomeUpper.includes("AMPOLA") || nomeUpper.includes(" AMP ") || nomeUpper.endsWith(" AMP") || nomeUpper.includes("AMP/")
  ) {
    if (rawApres && (rawApres.includes("ML") || rawApres.includes("MG"))) {
      return rawApres;
    }
    return "AMPOLA";
  }

  // Se é injetável explícito
  if (
    rawForma.includes("INJETÁVEL") || rawForma.includes("INJETAVEL") || rawForma.includes("INJ") ||
    rawApres.includes("INJETÁVEL") || rawApres.includes("INJETAVEL") || rawApres.includes("INJ") ||
    nomeUpper.includes(" INJ") || nomeUpper.includes("INJETÁVEL") || nomeUpper.includes("INJETAVEL") ||
    ["EV", "IM", "IV", "SC", "ID", "ENDOVENOSA", "INTRAMUSCULAR"].includes(rawVia)
  ) {
    if (nomeUpper.includes("FRASCO") || rawApres.includes("FRASCO")) return "FRASCO / INJETÁVEL";
    if (rawApres && (rawApres.includes("ML") || rawApres.includes("MG"))) return `AMPOLA (${rawApres})`;
    return "AMPOLA / INJETÁVEL";
  }

  // 3. Frasco
  if (
    rawApres.includes("FRASCO") || rawApres.includes("FR ") || rawApres.endsWith("FR") ||
    rawForma.includes("FRASCO") ||
    rawUnidade === "FR" || rawUnidade === "FRASCO" ||
    nomeUpper.includes("FRASCO") || nomeUpper.includes(" FR ") || nomeUpper.endsWith(" FR") ||
    nomeUpper.includes("GOTAS") || nomeUpper.includes("XAROPE") || nomeUpper.includes("SUSP")
  ) {
    if (rawApres && rawApres.includes("ML")) return rawApres;
    if (nomeUpper.includes("GOTAS") || rawApres.includes("GOTAS")) return "FRASCO (GOTAS)";
    if (nomeUpper.includes("XAROPE") || rawApres.includes("XAROPE")) return "FRASCO (XAROPE)";
    return "FRASCO";
  }

  // 4. Blister
  if (
    rawApres.includes("BLISTER") || rawApres.includes("BLÍSTER") ||
    rawForma.includes("BLISTER") || rawForma.includes("BLÍSTER") ||
    rawUnidade === "BLIST" || rawUnidade === "BLISTER" || rawUnidade === "BLÍSTER" ||
    nomeUpper.includes("BLISTER") || nomeUpper.includes("BLÍSTER")
  ) {
    return "BLISTER";
  }

  // 5. Cápsula
  if (
    rawApres.includes("CÁPSULA") || rawApres.includes("CAPSULA") || rawApres.includes("CAP") ||
    rawForma.includes("CÁPSULA") || rawForma.includes("CAPSULA") ||
    rawUnidade === "CAP" || rawUnidade === "CAPSULA" || rawUnidade === "CÁPSULA" ||
    nomeUpper.includes("CÁPSULA") || nomeUpper.includes("CAPSULA") || nomeUpper.includes(" CAP ") || nomeUpper.endsWith(" CAP")
  ) {
    return "CÁPSULA";
  }

  // 6. Comprimido
  if (
    rawApres.includes("COMPRIMIDO") || rawApres.includes("COMP") || rawApres.includes("CP") ||
    rawForma.includes("COMPRIMIDO") || rawForma.includes("SÓLIDA") ||
    rawUnidade === "COMP" || rawUnidade === "COMPRIMIDO" || rawUnidade === "CP" ||
    nomeUpper.includes("COMPRIMIDO") || nomeUpper.includes(" COMP ") || nomeUpper.endsWith(" COMP") || nomeUpper.includes(" CP ") || nomeUpper.endsWith(" CP")
  ) {
    return "COMPRIMIDO";
  }

  // 7. Pomada / Creme / Gel
  if (rawApres.includes("POMADA") || rawForma.includes("POMADA") || nomeUpper.includes("POMADA")) return "POMADA";
  if (rawApres.includes("CREME") || rawForma.includes("CREME") || nomeUpper.includes("CREME")) return "CREME";
  if (rawApres.includes("GEL") || rawForma.includes("GEL") || nomeUpper.includes("GEL")) return "GEL";

  // 8. Sachê / Envelope
  if (rawApres.includes("SACHÊ") || rawApres.includes("SACHE") || nomeUpper.includes("SACHE") || nomeUpper.includes("SACHÊ")) return "SACHÊ";
  if (rawApres.includes("ENVELOPE") || nomeUpper.includes("ENVELOPE")) return "ENVELOPE";

  if (rawApres) return rawApres;
  if (rawForma) return rawForma;
  if (rawUnidade && !["UN", "UNIDADE", "UNID", "-", ""].includes(rawUnidade)) return rawUnidade;

  return "COMPRIMIDO";
}

export function MapaMensalDispensacao() {
  const hoje = useMemo(() => new Date(), []);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth()); // 0 a 11
  const [categoriaFiltro, setCategoriaFiltro] = useState("todos"); // "todos" | "psicotropicos" | "clinica" | "mav" | "clinica_psico"
  const [alaFiltro, setAlaFiltro] = useState("todas"); // "todas" ou ID / Nome da Ala selecionada
  const [apenasComSaida, setApenasComSaida] = useState(false); // Ocultar medicamentos zerados no período
  const [modoVisualizacao, setModoVisualizacao] = useState("ambas"); // "ambas" | "q1" | "q2"
  const [termoBusca, setTermoBusca] = useState("");

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

  // 1. Carregar Medicamentos, Saídas, Prescrições, Pacientes e Alas do Sistema
  const { data: medicamentos = [], isLoading: loadingMeds } = useQuery({
    queryKey: ["medicamentos"],
    queryFn: () => db.entities.Medicamento.list(),
  });

  const { data: saidas = [], isLoading: loadingSaidas } = useQuery({
    queryKey: ["saidas"],
    queryFn: () => db.entities.Saida.list(),
  });

  const { data: prescricoes = [] } = useQuery({
    queryKey: ["prescricoes_paciente"],
    queryFn: () => db.entities.PrescricaoPaciente.list(),
  });

  const { data: alas = [] } = useQuery({
    queryKey: ["alas"],
    queryFn: () => db.entities.Ala.list(),
  });

  const { data: pacientes = [] } = useQuery({
    queryKey: ["pacientes"],
    queryFn: () => db.entities.Paciente.list(),
  });

  // Lista unificada e padronizada de Alas disponíveis no sistema
  const listaAlasOpcoes = useMemo(() => {
    const map = new Map();

    alas.forEach((a) => {
      if (a?.nome && a.nome.trim()) {
        map.set(a.nome.trim().toUpperCase(), {
          id: String(a.id),
          nome: a.nome.trim(),
        });
      }
    });

    pacientes.forEach((p) => {
      const nomeAla = p.alaNome || p.ala_nome;
      if (nomeAla && nomeAla.trim()) {
        const upper = nomeAla.trim().toUpperCase();
        if (!map.has(upper)) {
          map.set(upper, {
            id: p.alaId || p.ala_id || upper,
            nome: nomeAla.trim(),
          });
        }
      }
    });

    saidas.forEach((s) => {
      const nomeAla = s.ala_nome || s.alaNome;
      if (nomeAla && nomeAla.trim()) {
        const upper = nomeAla.trim().toUpperCase();
        if (!map.has(upper)) {
          map.set(upper, {
            id: s.ala_id || s.alaId || upper,
            nome: nomeAla.trim(),
          });
        }
      }
    });

    const lista = Array.from(map.values());
    lista.sort((a, b) => a.nome.localeCompare(b.nome));
    return lista;
  }, [alas, pacientes, saidas]);

  // Nome legível da Ala atualmente selecionada
  const nomeAlaSelecionada = useMemo(() => {
    if (alaFiltro === "todas") return "Todas as Alas (Geral)";
    const alaObj = listaAlasOpcoes.find(
      (a) => String(a.id) === String(alaFiltro) || a.nome.trim().toLowerCase() === alaFiltro.trim().toLowerCase()
    );
    if (alaObj?.nome) return alaObj.nome;
    return alaFiltro;
  }, [alaFiltro, listaAlasOpcoes]);

  // Rótulo da Categoria Farmacológica selecionada
  const rotuloCategoria = useMemo(() => {
    switch (categoriaFiltro) {
      case "psicotropicos":
        return "Psicotrópicos / Portaria 344";
      case "clinica":
        return "Clínica Geral";
      case "mav":
        return "Alta Vigilância (MAV)";
      case "clinica_psico":
        return "Clínicos + Psicotrópicos";
      default:
        return "Todos os Medicamentos";
    }
  }, [categoriaFiltro]);

  // 2. Cálculo dos Dias do Mês Selecionado
  const dataReferencia = useMemo(() => new Date(ano, mes, 1), [ano, mes]);
  const totalDiasMes = useMemo(() => getDaysInMonth(dataReferencia), [dataReferencia]);

  const listaDias = useMemo(() => {
    return Array.from({ length: totalDiasMes }, (_, i) => i + 1);
  }, [totalDiasMes]);

  const diasQ1 = useMemo(() => listaDias.filter((d) => d <= 15), [listaDias]);
  const diasQ2 = useMemo(() => listaDias.filter((d) => d > 15), [listaDias]);

  // Mapas de busca rápida para Pacientes, Prescrições e Alas
  const mapasBusca = useMemo(() => {
    const mapPac = new Map();
    pacientes.forEach((p) => mapPac.set(String(p.id), p));

    const mapPr = new Map();
    prescricoes.forEach((pr) => mapPr.set(String(pr.id), pr));

    const mapAla = new Map();
    alas.forEach((a) => mapAla.set(String(a.id), a));

    return { mapPac, mapPr, mapAla };
  }, [pacientes, prescricoes, alas]);

  // Total acumulado por Ala no mês selecionado (para exibição rápida no dropdown)
  const totaisPorAla = useMemo(() => {
    const totais = {};
    const { mapPac, mapPr, mapAla } = mapasBusca;
    const mesStr = String(mes + 1).padStart(2, "0");
    const anoStr = String(ano);

    saidas.forEach((saida) => {
      const nomePac = (saida.paciente_nome || saida.pacienteNome || "").trim();
      const idPac = (saida.paciente_id || saida.pacienteId || "").trim();
      const sAlaNome = (saida.ala_nome || saida.alaNome || "").trim();
      const sAlaId = (saida.ala_id || saida.alaId || "").trim();
      if (!nomePac && !idPac && !sAlaNome && !sAlaId) return;

      const tipo = (saida.tipo || "").toLowerCase();
      const motivo = (saida.motivo || "").toLowerCase();
      const destino = (saida.destino || "").toLowerCase();

      if (
        tipo.includes("transferencia") || tipo.includes("transferência") ||
        tipo.includes("carrinho") || tipo.includes("abastecimento") ||
        tipo.includes("perda") || tipo.includes("descarte") ||
        tipo.includes("emprestimo") || tipo.includes("empréstimo") ||
        tipo.includes("ajuste") || tipo.includes("inventario") ||
        tipo.includes("inventário") || tipo.includes("estorno") ||
        motivo.includes("transferência") || motivo.includes("transferencia") ||
        motivo.includes("abastecimento") || motivo.includes("carrinho de parada") ||
        motivo.includes("ajuste de estoque") || motivo.includes("perda") ||
        motivo.includes("quebra") || destino.includes("farmácia satélite") ||
        destino.includes("farmacia satelite") || destino.includes("estoque central") ||
        destino.includes("carrinho de parada") || destino.includes("almoxarifado")
      ) {
        return;
      }

      const qtd = Number(saida.quantidade) || 0;
      if (qtd <= 0) return;

      // Resolução da Ala
      let alaNome = (saida.ala_nome || saida.alaNome || "").trim();
      if (!alaNome && (saida.ala_id || saida.alaId)) {
        const aObj = mapAla.get(String(saida.ala_id || saida.alaId));
        if (aObj?.nome) alaNome = aObj.nome.trim();
      }
      if (!alaNome && idPac) {
        const pObj = mapPac.get(String(idPac));
        if (pObj) {
          if (pObj.alaNome) alaNome = pObj.alaNome.trim();
          else if (pObj.ala_nome) alaNome = pObj.ala_nome.trim();
          else if (pObj.alaId || pObj.ala_id) {
            const aObj = mapAla.get(String(pObj.alaId || pObj.ala_id));
            if (aObj?.nome) alaNome = aObj.nome.trim();
          }
        }
      }
      if (!alaNome && saida.prescricao_id) {
        const prObj = mapPr.get(String(saida.prescricao_id));
        if (prObj?.alaNome) alaNome = prObj.alaNome.trim();
      }
      if (!alaNome) alaNome = "Sem Ala Definida";

      const dataSaidaStr = saida.data_inicio_cobertura || saida.data_saida || saida.created_at;
      if (!dataSaidaStr) return;

      if (saida.is_baixa_lote_paciente && saida.data_inicio_cobertura && saida.data_fim_cobertura) {
        const dInicio = parseISO(saida.data_inicio_cobertura);
        const dFim = parseISO(saida.data_fim_cobertura);
        if (isValid(dInicio) && isValid(dFim)) {
          let curr = new Date(dInicio);
          let countMes = 0;
          while (curr <= dFim) {
            if (curr.getFullYear() === ano && curr.getMonth() === mes) countMes++;
            curr = addDays(curr, 1);
          }
          if (countMes > 0) {
            const doseDia = Number(saida.dose_diaria) || (qtd / (Math.max(1, (dFim - dInicio) / 86400000 + 1)));
            totais[alaNome] = (totais[alaNome] || 0) + Math.round(doseDia * countMes);
          }
        }
      } else {
        const [sAno, sMes] = dataSaidaStr.slice(0, 10).split("-");
        if (sAno === anoStr && sMes === mesStr) {
          totais[alaNome] = (totais[alaNome] || 0) + Math.round(qtd);
        }
      }
    });

    return totais;
  }, [saidas, mapasBusca, ano, mes]);

  // 3. Processamento das Saídas e Distribuição Diária (Filtrável por Ala)
  const matrizDispensacao = useMemo(() => {
    if (!medicamentos.length) return { linhas: [], totaisPorDia: {}, totalGeral: 0, totalQ1: 0, totalQ2: 0, diaPico: null };

    const { mapPac, mapPr, mapAla } = mapasBusca;

    // Mapa acumulador: medId -> { dias: { [dia]: quantidade }, totalQ1, totalQ2, totalMes }
    const mapaMeds = {};

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
    const filtroAlaAtivo = alaFiltro && alaFiltro !== "todas";
    const filtroAlaNorm = filtroAlaAtivo ? alaFiltro.trim().toLowerCase() : "";

    // Processa cada saída registrada no sistema
    saidas.forEach((saida) => {
      const medId = saida.medicamento_id || saida.medicamentoId;
      if (!medId || !mapaMeds[medId]) return;

      // 1. Apenas saídas destinadas a pacientes reais ou diretamente à Ala/Setor
      const nomePac = (saida.paciente_nome || saida.pacienteNome || "").trim();
      const idPac = (saida.paciente_id || saida.pacienteId || "").trim();
      const sAlaNome = (saida.ala_nome || saida.alaNome || "").trim();
      const sAlaId = (saida.ala_id || saida.alaId || "").trim();
      
      if (!nomePac && !idPac && !sAlaNome && !sAlaId) return;

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

      // 3. REGRA DE ALA: Identificação precisa da Ala de destino
      let alaIdSaida = saida.ala_id || saida.alaId || "";
      let alaNomeSaida = (saida.ala_nome || saida.alaNome || "").trim();

      if (!alaNomeSaida && alaIdSaida && mapAla.has(String(alaIdSaida))) {
        alaNomeSaida = mapAla.get(String(alaIdSaida)).nome.trim();
      }

      if ((!alaNomeSaida || !alaIdSaida) && idPac && mapPac.has(String(idPac))) {
        const pObj = mapPac.get(String(idPac));
        if (!alaIdSaida) alaIdSaida = pObj.alaId || pObj.ala_id || "";
        if (!alaNomeSaida) {
          alaNomeSaida = (pObj.alaNome || pObj.ala_nome || "").trim();
          if (!alaNomeSaida && alaIdSaida && mapAla.has(String(alaIdSaida))) {
            alaNomeSaida = mapAla.get(String(alaIdSaida)).nome.trim();
          }
        }
      }

      if ((!alaNomeSaida || !alaIdSaida) && saida.prescricao_id && mapPr.has(String(saida.prescricao_id))) {
        const prObj = mapPr.get(String(saida.prescricao_id));
        if (!alaIdSaida) alaIdSaida = prObj.alaId || prObj.ala_id || "";
        if (!alaNomeSaida) {
          alaNomeSaida = (prObj.alaNome || prObj.ala_nome || "").trim();
          if (!alaNomeSaida && alaIdSaida && mapAla.has(String(alaIdSaida))) {
            alaNomeSaida = mapAla.get(String(alaIdSaida)).nome.trim();
          }
        }
      }

      // Se o filtro de Ala estiver ativo, valida se a saída pertence à Ala selecionada
      if (filtroAlaAtivo) {
        const idNorm = String(alaIdSaida).toLowerCase();
        const nomeNorm = alaNomeSaida.toLowerCase();

        // Obtém o nome da Ala selecionada no filtro (se for ID)
        const alaSelecionadaObj = mapAla.get(String(alaFiltro));
        const nomeAlvoFiltro = alaSelecionadaObj?.nome ? alaSelecionadaObj.nome.trim().toLowerCase() : filtroAlaNorm;

        const match =
          idNorm === filtroAlaNorm ||
          nomeNorm === filtroAlaNorm ||
          nomeNorm === nomeAlvoFiltro;

        if (!match) {
          return; // Não pertence à Ala filtrada
        }
      }

      // Identifica prescrição correspondente para verificar se foi suspensa
      const prId = saida.prescricao_id;
      const pr = prId
        ? mapPr.get(String(prId))
        : prescricoes.find(
            (p) =>
              (String(p.pacienteId || p.paciente_id) === String(idPac) ||
                (p.pacienteNome && nomePac && p.pacienteNome.trim().toLowerCase() === nomePac.toLowerCase())) &&
              (String(p.medicamentoId || p.medicamento_id) === String(medId) ||
                (p.medicamentoNome && saida.medicamento_nome && p.medicamentoNome.trim().toLowerCase() === saida.medicamento_nome.trim().toLowerCase()))
          );

      const statusPr = (pr?.status || "").toLowerCase();
      const isSuspensa = statusPr === "suspensa" || statusPr === "devolvida" || Boolean(pr?.data_suspensao);
      const dataSuspensaoStr = pr?.data_suspensao
        ? pr.data_suspensao.slice(0, 10)
        : (pr?.dataFim ? pr.dataFim.slice(0, 10) : null);

      // Caso A: Saída com cobertura de lote/ciclo (distribui nos dias do ciclo em números inteiros)
      if (
        (saida.is_baixa_lote_paciente || (saida.dias_cobertura && saida.dias_cobertura > 1)) &&
        saida.data_inicio_cobertura &&
        saida.data_fim_cobertura
      ) {
        const dInicio = parseISO(saida.data_inicio_cobertura);
        const dFim = parseISO(saida.data_fim_cobertura);

        if (isValid(dInicio) && isValid(dFim)) {
          const diasNoIntervalo = [];
          let curr = new Date(dInicio);
          while (curr <= dFim) {
            diasNoIntervalo.push(new Date(curr));
            curr = addDays(curr, 1);
          }

          const totalDiasCob = diasNoIntervalo.length || 1;
          const qtdTotalInt = Math.round(qtd);

          const doseInformada = Number(saida.dose_diaria);
          const isDoseInteira = Number.isFinite(doseInformada) && Number.isInteger(doseInformada) && doseInformada > 0;

          const doseBase = isDoseInteira ? doseInformada : Math.floor(qtdTotalInt / totalDiasCob);
          const resto = isDoseInteira ? 0 : (qtdTotalInt % totalDiasCob);

          diasNoIntervalo.forEach((dt, idx) => {
            const currAno = dt.getFullYear();
            const currMes = dt.getMonth();
            const currDia = dt.getDate();
            const dtStr = format(dt, "yyyy-MM-dd");

            if (isSuspensa) {
              if (dataSuspensaoStr && dtStr >= dataSuspensaoStr) {
                return;
              } else if (!dataSuspensaoStr && saida.data_saida && dtStr >= saida.data_saida.slice(0, 10)) {
                return;
              }
            }

            const doseDesteDia = doseBase + (idx < resto ? 1 : 0);

            if (currAno === ano && currMes === mes && currDia <= totalDiasMes) {
              mapaMeds[medId].dias[currDia] = (mapaMeds[medId].dias[currDia] || 0) + doseDesteDia;
            }
          });
          return;
        }
      }

      // Caso B: Saída avulsa comum (aloca no dia exato de data_saida)
      const dataSaidaStr = saida.data_saida || saida.created_at;
      if (!dataSaidaStr) return;

      const sDateOnly = dataSaidaStr.slice(0, 10);
      if (isSuspensa) {
        if (dataSuspensaoStr && sDateOnly >= dataSuspensaoStr) {
          return;
        }
      }

      const [sAno, sMes, sDia] = dataSaidaStr.slice(0, 10).split("-");
      if (sAno === anoStr && sMes === mesStr) {
        const diaNum = parseInt(sDia, 10);
        if (diaNum >= 1 && diaNum <= totalDiasMes) {
          mapaMeds[medId].dias[diaNum] = (mapaMeds[medId].dias[diaNum] || 0) + Math.round(qtd);
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
        const val = Math.round(item.dias[d]);
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
      item.apresentacaoFormatada = formatarApresentacaoMed(med);

      linhas.push(item);
    });

    // Ordenar: primeiro os com maior saída no mês, seguidos por ordem alfabética
    linhas.sort((a, b) => b.totalMes - a.totalMes || (a.medicamento.nome || "").localeCompare(b.medicamento.nome || ""));

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
  }, [medicamentos, saidas, prescricoes, mapasBusca, ano, mes, totalDiasMes, alaFiltro]);

  // 4. Filtragem por Categoria, Busca e Ocultação de Zerados
  const linhasFiltradas = useMemo(() => {
    return matrizDispensacao.linhas.filter((item) => {
      if (categoriaFiltro === "psicotropicos" && !item.isPsicotropico) return false;
      if (categoriaFiltro === "clinica" && !item.isClinica) return false;
      if (categoriaFiltro === "mav" && !item.isMav) return false;
      if (categoriaFiltro === "clinica_psico" && !item.isClinica && !item.isPsicotropico) return false;

      // Se solicitado, oculta medicamentos que não tiveram saída
      if (apenasComSaida && item.totalMes === 0) return false;

      if (termoBusca && termoBusca.trim()) {
        const termo = termoBusca.toLowerCase().trim();
        const nome = (item.medicamento.nome || "").toLowerCase();
        const cod = (item.medicamento.codigo || "").toLowerCase();
        return nome.includes(termo) || cod.includes(termo);
      }

      return true;
    });
  }, [matrizDispensacao.linhas, categoriaFiltro, apenasComSaida, termoBusca]);

  // Totais Reativos estritamente baseados nas linhas filtradas na tela/impressão
  const totaisFiltrados = useMemo(() => {
    const porDia = {};
    for (let d = 1; d <= totalDiasMes; d++) {
      porDia[d] = 0;
    }

    let q1 = 0;
    let q2 = 0;
    let geral = 0;

    linhasFiltradas.forEach((item) => {
      for (let d = 1; d <= totalDiasMes; d++) {
        porDia[d] += item.dias[d] || 0;
      }
      q1 += item.totalQ1 || 0;
      q2 += item.totalQ2 || 0;
      geral += item.totalMes || 0;
    });

    let diaPico = null;
    let maxDia = -1;
    for (let d = 1; d <= totalDiasMes; d++) {
      if (porDia[d] > maxDia && porDia[d] > 0) {
        maxDia = porDia[d];
        diaPico = { dia: d, valor: maxDia };
      }
    }

    return {
      porDia,
      q1,
      q2,
      geral,
      diaPico,
    };
  }, [linhasFiltradas, totalDiasMes]);

  // Exportação CSV formatado para Excel com Ala e Categoria
  const exportarExcel = () => {
    try {
      const nomeMes = format(dataReferencia, "MMMM_yyyy", { locale: ptBR });
      let csv = "\uFEFF"; // BOM UTF-8

      // Cabeçalho
      const colsDias = Array.from({ length: totalDiasMes }, (_, i) => `Dia_${String(i + 1).padStart(2, "0")}`).join(";");
      csv += `Código;Medicamento;Apresentação;Ala;Categoria;Portaria_344;${colsDias};Total_1Q;Total_2Q;Total_Mes\n`;

      linhasFiltradas.forEach((item) => {
        const med = item.medicamento;
        const cod = med.codigo || "S/C";
        const nome = `"${med.nome.replace(/"/g, '""')}"`;
        const apres = `"${(item.apresentacaoFormatada || med.apresentacao || med.unidade_medida || "un").replace(/"/g, '""')}"`;
        const alaStr = `"${nomeAlaSelecionada.replace(/"/g, '""')}"`;
        const cat = item.isPsicotropico ? "Psicotrópico" : item.isMav ? "MAV" : "Clínico Geral";
        const p344 = item.listaP344 || "-";

        const valoresDias = [];
        for (let d = 1; d <= totalDiasMes; d++) {
          valoresDias.push(item.dias[d] || 0);
        }

        csv += `${cod};${nome};${apres};${alaStr};${cat};${p344};${valoresDias.join(";")};${item.totalQ1};${item.totalQ2};${item.totalMes}\n`;
      });

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);

      const nomeAlaArquivo = (alaFiltro === "todas" ? "todas_alas" : nomeAlaSelecionada)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "_");

      link.setAttribute("download", `mapa_dispensacao_${nomeAlaArquivo}_${categoriaFiltro}_${nomeMes}.csv`);
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

            {/* Ações e Seletor de Período e Ala */}
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

                {/* Seletor de Ala */}
                <Select value={alaFiltro} onValueChange={setAlaFiltro}>
                  <SelectTrigger className="w-[195px] h-8 text-xs font-bold bg-white dark:bg-slate-900 text-blue-900 dark:text-blue-200 border-blue-200 dark:border-blue-900">
                    <div className="flex items-center gap-1.5 truncate">
                      <Hospital className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="truncate">{nomeAlaSelecionada}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent className="max-h-72 overflow-y-auto">
                    <SelectItem value="todas" className="text-xs font-bold text-slate-800">
                      🏥 Todas as Alas (Geral)
                    </SelectItem>
                    {listaAlasOpcoes.map((a) => {
                      const totalAla = totaisPorAla[a.nome] || 0;
                      return (
                        <SelectItem key={a.id} value={a.id} className="text-xs font-semibold">
                          <div className="flex items-center justify-between gap-2 w-full">
                            <span>{a.nome}</span>
                            {totalAla > 0 && (
                              <span className="text-[10px] font-mono text-blue-700 bg-blue-50 dark:bg-blue-950 px-1 rounded ml-1 font-bold">
                                {totalAla} un
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
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
              <button
                type="button"
                onClick={() => setCategoriaFiltro("clinica_psico")}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer",
                  categoriaFiltro === "clinica_psico"
                    ? "bg-indigo-600 text-white"
                    : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
                )}
              >
                💊 Clínicos + Psicotrópicos ({matrizDispensacao.linhas.filter((x) => x.isClinica || x.isPsicotropico).length})
              </button>
            </div>

            {/* Busca Rápida, Ocultar Zerados e Alternar Folhas na Tela */}
            <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
              <button
                type="button"
                onClick={() => setApenasComSaida((v) => !v)}
                className={cn(
                  "h-8 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 shrink-0",
                  apenasComSaida
                    ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                    : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50"
                )}
                title="Ocultar medicamentos que não tiveram dispensação no mês selecionado"
              >
                <Filter className="w-3.5 h-3.5" />
                {apenasComSaida ? "Apenas com Saída ✓" : "Ocultar Zerados"}
              </button>

              <div className="relative flex-1 sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  value={termoBusca}
                  onChange={(e) => setTermoBusca(e.target.value)}
                  placeholder="Buscar medicamento ou código..."
                  className="h-8 pl-8 pr-7 text-xs bg-white dark:bg-slate-900 border-slate-200 rounded-lg"
                />
                {termoBusca && (
                  <button
                    onClick={() => setTermoBusca("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Alternar Folhas na Tela */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl shrink-0">
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

          {/* Banner informativo de Ala ativa */}
          {alaFiltro !== "todas" && (
            <div className="flex items-center justify-between gap-2 px-3 py-2 bg-blue-50/90 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-900 dark:text-blue-200 font-semibold">
              <div className="flex items-center gap-2">
                <Hospital className="w-4 h-4 text-blue-600 shrink-0" />
                <span>
                  Filtrando exclusivamente dispensações da Ala: <strong className="uppercase underline">{nomeAlaSelecionada}</strong>
                  {categoriaFiltro !== "todos" && (
                    <> • Categoria: <strong className="underline">{rotuloCategoria}</strong></>
                  )}
                </span>
              </div>
              <button
                onClick={() => setAlaFiltro("todas")}
                className="px-2 py-0.5 hover:bg-blue-200/80 dark:hover:bg-blue-900 rounded text-blue-800 dark:text-blue-300 flex items-center gap-1 font-bold text-[11px] transition-colors"
                title="Limpar filtro e voltar para todas as alas"
              >
                <X className="w-3.5 h-3.5" />
                Ver Todas as Alas
              </button>
            </div>
          )}
        </div>

        {/* Cards de Resumo / KPIs Rápidos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-3.5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Total Dispensado no Mês
            </span>
            <div className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">
              {totaisFiltrados.geral.toLocaleString("pt-BR")} <span className="text-xs font-normal text-slate-500">un</span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block truncate" title={`${nomeAlaSelecionada} • ${rotuloCategoria}`}>
              {nomeAlaSelecionada} • {rotuloCategoria}
            </span>
          </Card>

          <Card className="p-3.5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              1ª Quinzena (Dias 01 a 15)
            </span>
            <div className="text-xl font-black text-blue-700 dark:text-blue-400 mt-1">
              {totaisFiltrados.q1.toLocaleString("pt-BR")} <span className="text-xs font-normal text-slate-500">un</span>
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
              {totaisFiltrados.q2.toLocaleString("pt-BR")} <span className="text-xs font-normal text-slate-500">un</span>
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
              {totaisFiltrados.diaPico ? `Dia ${String(totaisFiltrados.diaPico.dia).padStart(2, "0")}` : "--"}
              <span className="text-xs font-bold text-slate-500 ml-1">
                ({totaisFiltrados.diaPico?.valor || 0} un)
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              {totaisFiltrados.diaPico ? "Dia de maior demanda" : "Sem movimentação"}
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
                  Mês de Referência: <strong>{mesesNomes[mes]} / {ano}</strong> • Ala: <strong className="uppercase text-blue-700 print:text-black">{nomeAlaSelecionada}</strong> • Categoria: <strong className="text-slate-800">{rotuloCategoria}</strong> • Folha 1 de 2
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-black text-blue-700 dark:text-blue-300 font-mono print:text-[9px]">
                  Subtotal 1ª Q: {totaisFiltrados.q1} un
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
                            <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span className="font-mono">Cód: {med.codigo || "S/C"}</span>
                              <span className="font-extrabold px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-blue-50 text-blue-900 border border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800 print:bg-slate-100 print:text-black print:border-slate-300">
                                {item.apresentacaoFormatada}
                              </span>
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
                        {totaisFiltrados.porDia[d] || 0}
                      </td>
                    ))}
                    <td className="text-center py-2 px-2 font-mono font-black text-blue-900 dark:text-blue-200 bg-blue-100/70 border-l-2 border-blue-300">
                      {totaisFiltrados.q1} un
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
                  Mês de Referência: <strong>{mesesNomes[mes]} / {ano}</strong> • Ala: <strong className="uppercase text-emerald-700 print:text-black">{nomeAlaSelecionada}</strong> • Categoria: <strong className="text-slate-800">{rotuloCategoria}</strong> • Folha 2 de 2 (Fechamento Mensal)
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 font-mono print:text-[9px]">
                  Subtotal 2ª Q: {totaisFiltrados.q2} un &nbsp;|&nbsp; TOTAL MÊS: {totaisFiltrados.geral} un
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
                            <div className="text-[10px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span className="font-mono">Cód: {med.codigo || "S/C"}</span>
                              <span className="font-extrabold px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-blue-50 text-blue-900 border border-blue-200 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-800 print:bg-slate-100 print:text-black print:border-slate-300">
                                {item.apresentacaoFormatada}
                              </span>
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
                        {totaisFiltrados.porDia[d] || 0}
                      </td>
                    ))}
                    <td className="text-center py-2 px-2 font-mono font-black text-emerald-900 dark:text-emerald-200 bg-emerald-100/70 border-l-2 border-emerald-300">
                      {totaisFiltrados.q2} un
                    </td>
                    <td className="text-center py-2 px-2 font-mono font-black text-blue-900 dark:text-blue-100 bg-blue-200/80 border-l-2 border-blue-400">
                      {totaisFiltrados.geral} un
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
