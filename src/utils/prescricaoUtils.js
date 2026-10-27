import { format } from "date-fns";

export const DIAS_SEMANA_MAP = [
  { id: 1, label: "Seg", full: "Segunda-feira" },
  { id: 2, label: "Ter", full: "Terça-feira" },
  { id: 3, label: "Qua", full: "Quarta-feira" },
  { id: 4, label: "Qui", full: "Quinta-feira" },
  { id: 5, label: "Sex", full: "Sexta-feira" },
  { id: 6, label: "Sáb", full: "Sábado" },
  { id: 0, label: "Dom", full: "Domingo" },
];

export const safeParseHorarios = (horarios) => {
  if (!horarios) return [];
  if (Array.isArray(horarios)) return horarios;
  if (typeof horarios === "string") {
    try {
      const parsed = JSON.parse(horarios);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const getDoseForHora = (horariosData, targetHora) => {
  const list = safeParseHorarios(horariosData);
  const found = list.find((h) => h && h.hora === targetHora);
  if (!found || found.dose === undefined || found.dose === null || found.dose === "") return 0;
  const num = parseFloat(String(found.dose).replace(",", "."));
  return isNaN(num) ? 0 : num;
};

export const parseDiasSemana = (dias) => {
  if (!dias) return [0, 1, 2, 3, 4, 5, 6];
  if (Array.isArray(dias)) return dias.map(Number);
  if (typeof dias === "string") {
    try {
      const parsed = JSON.parse(dias);
      if (Array.isArray(parsed)) return parsed.map(Number);
    } catch {}
    if (dias.includes(",")) return dias.split(",").map((s) => Number(s.trim())).filter((n) => !isNaN(n));
  }
  return [0, 1, 2, 3, 4, 5, 6];
};

export const formatDiasSemana = (dias) => {
  const arr = parseDiasSemana(dias);
  if (arr.length === 0) return "Nenhum dia";
  if (arr.length === 7) return "Todos os dias (Diário)";

  const order = [1, 2, 3, 4, 5, 6, 0];
  const sorted = [...arr].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const str = sorted.join(",");
  if (str === "1,2,3,4,5") return "Seg a Sex";
  if (str === "1,3,5") return "Seg, Qua, Sex";
  if (str === "6,0" || str === "0,6") return "Fim de semana (Sáb/Dom)";
  if (str === "1,2,3") return "Seg, Ter, Qua";

  const labels = sorted
    .map((id) => {
      const found = DIAS_SEMANA_MAP.find((d) => d.id === id);
      return found ? found.label : "";
    })
    .filter(Boolean);

  return labels.join(", ");
};

export const formatFrequenciaPrescricao = (pr) => {
  if (!pr) return "";
  const tipo = pr.tipoFrequencia || pr.tipo_frequencia || "diaria";
  if (tipo === "intervalo_dias") {
    const inter = Math.max(1, parseInt(pr.intervaloDias || pr.intervalo_dias, 10) || 1);
    if (inter === 1) return "Todos os dias (Diário)";
    if (inter === 2) return "A cada 2 dias (Dia sim / Dia não)";
    if (inter === 7) return "A cada 7 dias (Semanal)";
    if (inter === 10) return "A cada 10 dias (Ex: Haldol Decanoato)";
    if (inter === 14) return "A cada 14 dias (Quinzenal)";
    if (inter === 15) return "A cada 15 dias";
    if (inter === 21) return "A cada 21 dias (3 semanas)";
    if (inter === 28) return "A cada 28 dias (4 semanas)";
    if (inter === 30) return "A cada 30 dias (Mensal)";
    return `A cada ${inter} dias`;
  }
  return formatDiasSemana(pr.diasSemana);
};

export function isMedicamentoAntibiotico(med) {
  if (!med) return false;
  if (med.antimicrobiano) return true;
  const grupo = (med.grupo_terapeutico || "").toUpperCase();
  if (grupo.includes("ANTIBI") || grupo.includes("ANTIMICROB")) return true;
  const nome = (med.nome || "").toLowerCase();
  return /amoxicilina|ampicilina|azitromicina|claritromicina|cefalexina|ceftriaxona|cefazolina|ciprofloxacino|levofloxacino|metronidazol|vancomicina|meropenem|piperacilina|gentamicina|amikacina|clindamicina|sulfametoxazol|ceftazidima|oxacilina|penicilina|polimixina|daptomicina|linezolida|ertapenem|colistina|tobramicina/i.test(
    nome
  );
}

export function calcularDataFim(inicioStr, diasQtd, horarioInicio = "08:00") {
  if (!inicioStr || !diasQtd || parseInt(diasQtd, 10) <= 0) return "";
  const parts = inicioStr.split("-");
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  const diasNum = parseInt(diasQtd, 10);
  const diasAdicionar = horarioInicio === "22:00" || horarioInicio === "14:00" ? diasNum : diasNum - 1;
  d.setDate(d.getDate() + diasAdicionar);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export function calcularDiasEntre(inicioStr, fimStr, horarioInicio = "08:00") {
  if (!inicioStr || !fimStr) return "";
  const p1 = inicioStr.split("-");
  const p2 = fimStr.split("-");
  const d1 = new Date(parseInt(p1[0], 10), parseInt(p1[1], 10) - 1, parseInt(p1[2], 10));
  const d2 = new Date(parseInt(p2[0], 10), parseInt(p2[1], 10) - 1, parseInt(p2[2], 10));
  const diffTime = d2.getTime() - d1.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  if (diffDays <= 0) return 1;
  if (horarioInicio === "22:00" || horarioInicio === "14:00") {
    return Math.max(1, diffDays - 1);
  }
  return diffDays;
}

export function isPrescricaoDoPaciente(pr, pacienteIdOrObj) {
  if (!pr || !pacienteIdOrObj) return false;
  const targetId = typeof pacienteIdOrObj === "object" ? String(pacienteIdOrObj.id ?? "") : String(pacienteIdOrObj);
  const targetProntuario = typeof pacienteIdOrObj === "object" ? String(pacienteIdOrObj.prontuario ?? "").trim() : "";
  const targetNome = typeof pacienteIdOrObj === "object" ? String(pacienteIdOrObj.nome ?? "").trim().toLowerCase() : "";

  const pId = String(pr.pacienteId || pr.paciente_id || pr.pacienteid || "").trim();
  if (targetId && pId && pId !== "[object Object]" && pId === targetId) return true;
  if (targetProntuario && pr.prontuario && String(pr.prontuario).trim() === targetProntuario) return true;
  if (targetNome && pr.pacienteNome && String(pr.pacienteNome).trim().toLowerCase() === targetNome) return true;
  return false;
}

export function isPrescricaoAtiva(pr, hojeStr = format(new Date(), "yyyy-MM-dd")) {
  if (!pr) return false;
  const status = (pr.status || "Ativa").trim().toLowerCase();
  if (status !== "ativa" && status !== "ativo" && status !== "em andamento") return false;
  if (pr.dataFim && pr.dataFim < hojeStr) return false;
  return true;
}

export const calculatePrescQtdParaDias = (pr, diasCount, dataReferencia = new Date()) => {
  if (!pr) return 0;
  const numDias = Math.max(0, parseInt(diasCount, 10) || 0);
  if (numDias === 0) return 0;

  // 1. Extração segura e puramente numérica das doses de horarios
  const horariosList = safeParseHorarios(pr.horarios);
  let calculatedDaily = 0;
  if (horariosList.length > 0) {
    calculatedDaily = horariosList.reduce((acc, h) => {
      const val = parseFloat(String(h?.dose ?? 0).replace(",", "."));
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
  }

  // Se não obteve de horarios, tenta colunas fixas dose08, dose14, dose22, dose06
  if (calculatedDaily <= 0) {
    const d08 = parseFloat(String(pr.dose08 ?? 0).replace(",", ".")) || 0;
    const d14 = parseFloat(String(pr.dose14 ?? 0).replace(",", ".")) || 0;
    const d22 = parseFloat(String(pr.dose22 ?? 0).replace(",", ".")) || 0;
    const d06 = parseFloat(String(pr.dose06 ?? 0).replace(",", ".")) || 0;
    calculatedDaily = d08 + d14 + d22 + d06;
  }

  // Fallback para totalDiario ou dose
  const rawTotalDiario = parseFloat(String(pr.totalDiario ?? pr.total_diario ?? pr.dose ?? 0).replace(",", ".")) || 0;
  const dailyTotal = calculatedDaily > 0 ? calculatedDaily : rawTotalDiario;

  if (dailyTotal <= 0) return 0;

  let maxDataFim = null;
  if (pr.dataFim) {
    const pFim = String(pr.dataFim).split("T")[0].split("-");
    if (pFim.length === 3) {
      maxDataFim = new Date(parseInt(pFim[0], 10), parseInt(pFim[1], 10) - 1, parseInt(pFim[2], 10), 23, 59, 59);
    }
  }

  const diasArr = parseDiasSemana(pr.diasSemana);
  let totalDoses = 0;

  // Base de data de referência (padrão: hoje, mas ajustável para qualquer data retroativa ou futura)
  let baseDate = new Date();
  if (dataReferencia instanceof Date && !isNaN(dataReferencia.getTime())) {
    baseDate = new Date(dataReferencia);
  } else if (typeof dataReferencia === "string") {
    const pRef = dataReferencia.split("T")[0].split("-");
    if (pRef.length === 3) {
      baseDate = new Date(parseInt(pRef[0], 10), parseInt(pRef[1], 10) - 1, parseInt(pRef[2], 10));
    }
  }
  baseDate.setHours(0, 0, 0, 0);

  const tipoFreq = pr.tipoFrequencia || pr.tipo_frequencia || "diaria";
  const intervalo = Math.max(1, parseInt(pr.intervaloDias || pr.intervalo_dias, 10) || 1);
  let dataInicioDate = null;
  const rawIni = pr.dataInicio || pr.data_inicio;
  if (rawIni) {
    const pIni = String(rawIni).split("T")[0].split("-");
    if (pIni.length === 3) {
      dataInicioDate = new Date(parseInt(pIni[0], 10), parseInt(pIni[1], 10) - 1, parseInt(pIni[2], 10));
      dataInicioDate.setHours(0, 0, 0, 0);
    }
  }

  for (let i = 0; i < numDias; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);

    // Se o dia avaliado é ANTERIOR à data em que o medicamento foi prescrito/iniciado,
    // o paciente ainda não tomava o remédio e a dose não deve ser contada!
    if (dataInicioDate && d < dataInicioDate) {
      continue;
    }

    if (maxDataFim && d > maxDataFim) {
      // Se for antibiótico/antimicrobiano com tempo determinado, interrompe na data final prescrita.
      // Medicamentos de uso contínuo (não antibióticos) com prescrição ativa não devem ser cortados
      // prematuramente na virada do mês durante a separação do ciclo da farmácia.
      if (isMedicamentoAntibiotico(pr)) {
        break;
      }
    }

    let isDiaDeAdministracao = false;
    if (tipoFreq === "intervalo_dias") {
      if (dataInicioDate) {
        const diffDays = Math.round((d.getTime() - dataInicioDate.getTime()) / (1000 * 60 * 60 * 24));
        isDiaDeAdministracao = diffDays >= 0 && (diffDays % intervalo === 0);
      } else {
        isDiaDeAdministracao = (i % intervalo === 0);
      }
    } else {
      isDiaDeAdministracao = (diasArr.length === 7 || diasArr.length === 0 || diasArr.includes(d.getDay()));
    }

    if (isDiaDeAdministracao) {
      totalDoses += dailyTotal;
    }
  }

  // Garantia: se for prescrição diária sem limites de data (sem dataInicio e sem dataFim limitante),
  // e não somou, aplica o cálculo simples
  if (totalDoses <= 0 && !dataInicioDate && !pr.dataFim && (diasArr.length === 7 || diasArr.length === 0)) {
    totalDoses = dailyTotal * numDias;
  }

  return Math.ceil(Math.round(totalDoses * 1000) / 1000);
};
