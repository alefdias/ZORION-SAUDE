/**
 * Utilitários para gestão e inteligência de medicamentos líquidos
 * (Xaropes, suspensões, soluções orais, gotas, etc.)
 */

// 20 gotas = 1 mL (padrão médico e farmacopéico internacional)
export const GOTAS_POR_ML = 20;

/**
 * Identifica se o medicamento é uma formulação líquida multidose (frascos, gotas, xaropes)
 * Exclui formulações estéreis de dose única como FRASCO AMPOLA e AMPOLA.
 */
export function isLiquido(med) {
  if (!med) return false;
  if (med.is_liquido === true || med.is_liquido === 1 || med.is_liquido === "true") return true;

  const apresentacao = (med.apresentacao || "").toUpperCase().trim();
  const nome = (med.nome || "").toUpperCase().trim();

  // Excluir injetáveis dose única (ampolas e frascos-ampola)
  if (apresentacao.includes("FRASCO AMPOLA") || apresentacao.includes("FRASCO-AMPOLA")) return false;
  if (apresentacao.startsWith("AMPOLA")) return false;

  // Identificadores de formulação líquida multidose
  const termosLiquidos = [
    "GOTAS",
    "XAROPE",
    "SUSPENSÃO",
    "SUSPENSAO",
    "SOLUÇÃO",
    "SOLUCAO",
    "SOL. ORAL",
    "SOL ORAL",
    "EMULSÃO",
    "EMULSAO",
    "ELIXIR",
    "SPRAY",
    "COLÍRIO",
    "COLIRIO"
  ];

  for (const termo of termosLiquidos) {
    if (apresentacao.includes(termo) || nome.includes(termo)) return true;
  }

  // Frascos com indicação de volume em ML (ex: FRASCO 100 ML, FRASCO 20 ML)
  if (apresentacao.startsWith("FRASCO") && (apresentacao.includes("ML") || apresentacao.includes("DOSES"))) {
    return true;
  }

  return false;
}

/**
 * Extrai automaticamente o volume em mL a partir da apresentação ou do nome do medicamento.
 * Ex: "FRASCO 100 ML" -> 100, "FRASCO 20ML" -> 20, "FRASCO 120 ML" -> 120, "FRASCO 1000 ML" -> 1000
 */
export function extrairVolumeMl(med) {
  if (!med) return 100;
  if (Number(med.volume_frasco_ml) > 0) return Number(med.volume_frasco_ml);

  const texto = `${med.apresentacao || ""} ${med.nome || ""}`.toUpperCase();

  // Procura padrão como 100 ML, 100ML, 20 ML, 1000 ML
  const matchMl = texto.match(/(\d+(?:[.,]\d+)?)\s*(?:ML|MLS)\b/i);
  if (matchMl) {
    const val = parseFloat(matchMl[1].replace(",", "."));
    if (!isNaN(val) && val > 0) return val;
  }

  // Procura padrão em gotas (ex: 20 ML de gotas)
  if (texto.includes("GOTAS")) {
    return 20; // Frasco de gotas padrão costuma ser 20 mL se não especificado
  }

  if (texto.includes("XAROPE") || texto.includes("SUSPENS")) {
    return 100; // Xarope/suspensão padrão costuma ser 100 mL se não especificado
  }

  return 100;
}

/**
 * Converte quantidade de gotas para mL.
 * @param {number} gotas 
 * @returns {number} mL
 */
export function converterGotasParaMl(gotas) {
  const g = Number(gotas) || 0;
  return Number((g / GOTAS_POR_ML).toFixed(2));
}

/**
 * Converte mL para quantidade de gotas.
 * @param {number} ml 
 * @returns {number} gotas
 */
export function converterMlParaGotas(ml) {
  const m = Number(ml) || 0;
  return Math.round(m * GOTAS_POR_ML);
}

/**
 * Calcula quantos dias um frasco durará para o paciente com base no consumo diário em mL.
 * @param {number} volumeFrascoMl 
 * @param {number} consumoDiarioMl 
 * @returns {number} dias inteiros de duração
 */
export function calcularDuracaoFrascoDias(volumeFrascoMl, consumoDiarioMl) {
  const vol = Number(volumeFrascoMl) || 100;
  const consumo = Number(consumoDiarioMl) || 0;
  if (consumo <= 0) return 1;
  return Math.max(1, Math.floor(vol / consumo));
}
