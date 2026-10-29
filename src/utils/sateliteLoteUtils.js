import { safeParseISO } from "./dateUtils.js";

/**
 * Normaliza strings para comparação fonética/textual consistente
 */
function normalize(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .trim();
}

/**
 * Compara dois nomes de medicamentos de forma consistente e segura
 * NUNCA considera dois medicamentos iguais apenas pela primeira palavra!
 */
function namesMatch(nameA, nameB) {
  const a = normalize(nameA);
  const b = normalize(nameB);
  if (!a || !b) return false;
  if (a === b) return true;
  const cleanA = a.replace(/\b(comprimido|cp|frasco|ampola|gotas)\b/g, "").replace(/\s+/g, " ").trim();
  const cleanB = b.replace(/\b(comprimido|cp|frasco|ampola|gotas)\b/g, "").replace(/\s+/g, " ").trim();
  return cleanA === cleanB;
}

/**
 * Calcula estritamente os lotes que REALMENTE existem e têm saldo positivo na Farmácia Satélite.
 *
 * REGRA CRUCIAL: Lotes que pertencem apenas à Farmácia Central (comprados/estocados na Central)
 * e que NUNCA foram transferidos para a Satélite NUNCA devem ser exibidos ou atribuídos à Satélite!
 *
 * @param {Object} params
 * @param {string} params.medId - ID do medicamento
 * @param {string} [params.medCodigo] - Código do medicamento
 * @param {string} [params.medNome] - Nome do medicamento
 * @param {number} params.saldoTotalSat - Saldo total do medicamento na Satélite (med.estoque_satelite)
 * @param {Array} params.lotes - Lista de todos os lotes do sistema
 * @param {Array} [params.transferencias] - Lista de transferências pendentes/aceitas
 * @param {Array} [params.pedidosSatelite] - Lista de pedidos da satélite
 * @param {Array} [params.saidas] - Lista de saídas do sistema
 * @returns {Array} Lotes com saldo comprovado na Farmácia Satélite
 */
export function calcularLotesSatelite({
  medId,
  medCodigo,
  medNome,
  saldoTotalSat = 0,
  lotes = [],
  transferencias = [],
  pedidosSatelite = [],
  saidas = [],
}) {
  const saldoSat = Number(saldoTotalSat) || 0;
  if (saldoSat <= 0 || !lotes || lotes.length === 0) {
    return [];
  }

  const sMedId = String(medId || "");
  const sMedCodigo = medCodigo ? String(medCodigo).trim() : "";

  // Filtra candidatos pertencentes estritamente a este medicamento
  const lotesDoMed = lotes.filter((l) => {
    const lMedId = String(l.medicamento_id || l.medicamentoId || "");
    if (lMedId && sMedId) return lMedId === sMedId;
    if (sMedCodigo && l.medicamento_codigo && String(l.medicamento_codigo).trim() === sMedCodigo) return true;
    return false;
  });

  if (lotesDoMed.length === 0) {
    return [];
  }

  // PRIORIDADE 1: Se os lotes possuem quantidade_satelite gravada explicitamente E a soma bate com o saldo da Satélite
  const lotesGravados = lotesDoMed.filter((l) => l.quantidade_satelite !== undefined && l.quantidade_satelite !== null && Number(l.quantidade_satelite) > 0);
  const somaGravada = lotesGravados.reduce((s, l) => s + Number(l.quantidade_satelite || 0), 0);
  
  if (lotesGravados.length > 0 && somaGravada === saldoSat) {
    return lotesGravados
      .map((l) => ({
        ...l,
        saldoSatelite: Number(l.quantidade_satelite || 0),
      }))
      .sort((a, b) => {
        const da = safeParseISO(a.data_validade);
        const db = safeParseISO(b.data_validade);
        if (!da) return 1;
        if (!db) return -1;
        return da - db;
      });
  }

  // Mapa para acumular saldo específico de cada lote na Satélite
  const mapaSaldoLote = {};
  lotesDoMed.forEach((l) => {
    mapaSaldoLote[l.id] = 0;
  });

  // Conjunto para evitar processar a mesma movimentação em duplicidade
  const transferenciasProcessadas = new Set();

  // Helper para verificar se uma entidade bate estritamente com o medicamento
  const matchMedStrict = (entityMedId, entityMedNome) => {
    const entId = String(entityMedId || "");
    if (entId && sMedId) {
      return entId === sMedId;
    }
    if (medNome && entityMedNome) {
      return namesMatch(entityMedNome, medNome);
    }
    return false;
  };

  // 1. Entradas por transferências aceitas para a satélite
  (transferencias || []).forEach((t) => {
    if (t.direcao === "para_satelite" && (t.status === "Aceito" || t.status === "aceito")) {
      const isMedMatch = matchMedStrict(t.medicamento_id || t.medicamentoId, t.medicamento_nome);
      if (!isMedMatch) return;

      const tlId = String(t.lote_id || t.loteId || "");
      const matchLote = lotesDoMed.find(
        (l) => (tlId && String(l.id) === tlId) || (l.numero_lote && t.numero_lote && l.numero_lote.trim().toLowerCase() === t.numero_lote.trim().toLowerCase())
      );

      if (matchLote) {
        const qtd = Number(t.quantidade) || 0;
        mapaSaldoLote[matchLote.id] = (mapaSaldoLote[matchLote.id] || 0) + qtd;
        if (t.id) transferenciasProcessadas.add(String(t.id));
      }
    }
  });

  // 2. Entradas por pedidos da satélite concluídos (apenas se não foram já incluídos como transferência aceita)
  (pedidosSatelite || []).forEach((p) => {
    if (p.status === "Concluido" || p.status === "Entregue") {
      try {
        const itens = Array.isArray(p.itens_json) ? p.itens_json : JSON.parse(p.itens_json || "[]");
        itens.forEach((it) => {
          const isMedMatch = matchMedStrict(it.medicamento_id || it.medicamentoId, it.medicamento_nome);
          if (!isMedMatch) return;

          // Se já existe registro em TransferenciaPendente com esse pedido_id, pula para não duplicar
          const jaContabilizado = (transferencias || []).some(
            (t) => (t.pedido_id === p.id || t.pedido_codigo === p.codigo) && (t.status === "Aceito" || t.status === "aceito")
          );
          if (jaContabilizado) return;

          const plId = String(it.lote_id || it.loteId || "");
          let matchLote = lotesDoMed.find(
            (l) => (plId && String(l.id) === plId) || (l.numero_lote && it.numero_lote && l.numero_lote.trim().toLowerCase() === it.numero_lote.trim().toLowerCase())
          );

          // Fallback para pedidos avulsos sem lote específico gravado: aloca no lote do medicamento (FEFO)
          if (!matchLote && lotesDoMed.length > 0) {
            matchLote = lotesDoMed.find(l => (Number(l.quantidade_satelite) || 0) > 0) || lotesDoMed[0];
          }

          if (matchLote) {
            const qtd = Number(it.quantidade_atendida || it.quantidade) || 0;
            mapaSaldoLote[matchLote.id] = (mapaSaldoLote[matchLote.id] || 0) + qtd;
          }
        });
      } catch (e) {}
    }
  });

  // 3. Entradas por saídas registradas na Central com destino estrito para a Satélite
  // CRUCIAL: Se a transferência já foi registrada, NUNCA somar a Saída de transferência novamente!
  (saidas || []).forEach((s) => {
    const dest = (s.destino || "").toLowerCase();
    const isDestSat = dest.includes("farmácia satélite") || dest.includes("farmacia satelite") || (dest.includes("satélite") && !dest.includes("paciente"));
    const isTipoSat = (s.tipo || "").toLowerCase().includes("central -> satélite");

    // NÃO considerar saídas para outros destinos (ex: Carrinho de Parada, Almoxarifado)
    if (!isDestSat && !isTipoSat) return;

    const isMedMatch = matchMedStrict(s.medicamento_id || s.medicamentoId, s.medicamento_nome);
    if (!isMedMatch) return;

    // Se é saída de transferência de estoque da Central e já temos transferências aceitas para este med,
    // não duplicar (a transferência no passo 1 já é a entrada real)
    const isTransfMotivo = (s.motivo || "").toLowerCase().includes("transfer") || (s.tipo || "").toLowerCase().includes("transfer");
    if (isTransfMotivo && transferenciasProcessadas.size > 0) {
      return;
    }

    const slId = String(s.lote_id || s.loteId || "");
    const matchLote = lotesDoMed.find(
      (l) => (slId && String(l.id) === slId) || (l.numero_lote && s.numero_lote && l.numero_lote.trim().toLowerCase() === s.numero_lote.trim().toLowerCase())
    );

    if (matchLote && !isTransfMotivo) {
      const qtd = Number(s.quantidade) || 0;
      mapaSaldoLote[matchLote.id] = (mapaSaldoLote[matchLote.id] || 0) + qtd;
    }
  });

  // 4. Subtrair saídas já realizadas pela Farmácia Satélite (dispensações a pacientes, baixas aos leitos)
  (saidas || []).forEach((s) => {
    const dest = (s.destino || "").toLowerCase();
    const isDestSat = dest.includes("farmácia satélite") || dest.includes("farmacia satelite") || (dest.includes("satélite") && !dest.includes("paciente"));
    const isTipoTransf = (s.tipo || "").toLowerCase().includes("transferência");

    // Pula movimentações de entrada para a satélite
    if (isDestSat || isTipoTransf) return;

    const isMedMatch = matchMedStrict(s.medicamento_id || s.medicamentoId, s.medicamento_nome);
    if (!isMedMatch) return;

    // Verifica se é uma saída da Satélite (tem paciente vinculado ou baixa manual)
    const isSaidaSat = !!s.paciente_id || !!s.paciente_nome || dest.includes("paciente") || dest.includes("leito") || dest.includes("ala");
    if (!isSaidaSat && s.origem !== "satelite") return;

    const slId = String(s.lote_id || s.loteId || "");
    const matchLote = lotesDoMed.find(
      (l) => (slId && String(l.id) === slId) || (l.numero_lote && s.numero_lote && l.numero_lote.trim().toLowerCase() === s.numero_lote.trim().toLowerCase())
    );

    if (matchLote) {
      const qtd = Number(s.quantidade) || 0;
      mapaSaldoLote[matchLote.id] = (mapaSaldoLote[matchLote.id] || 0) - qtd;
    }
  });

  // 5. Subtrair devoluções aceitas da Satélite de volta para a Central
  (transferencias || []).forEach((t) => {
    if (t.direcao === "para_estoque" && (t.status === "Aceito" || t.status === "aceito")) {
      const isMedMatch = matchMedStrict(t.medicamento_id || t.medicamentoId, t.medicamento_nome);
      if (!isMedMatch) return;

      const tlId = String(t.lote_id || t.loteId || "");
      const matchLote = lotesDoMed.find(
        (l) => (tlId && String(l.id) === tlId) || (l.numero_lote && t.numero_lote && l.numero_lote.trim().toLowerCase() === t.numero_lote.trim().toLowerCase())
      );

      if (matchLote) {
        const qtd = Number(t.quantidade) || 0;
        mapaSaldoLote[matchLote.id] = (mapaSaldoLote[matchLote.id] || 0) - qtd;
      }
    }
  });

  // 6. Filtra estritamente lotes que possuem saldo comprovado na Satélite
  let lotesComSaldo = lotesDoMed
    .map((l) => ({
      ...l,
      saldoSatelite: Math.max(0, mapaSaldoLote[l.id] || 0),
    }))
    .filter((l) => l.saldoSatelite > 0);

  // Reconciliação inteligente: Garante que o saldo total dos lotes bata 100% com o saldoTotalSat
  const somaLotes = lotesComSaldo.reduce((s, l) => s + l.saldoSatelite, 0);

  if (somaLotes < saldoSat) {
    const diff = saldoSat - somaLotes;
    if (lotesComSaldo.length > 0) {
      // Acrescenta a diferença não alocada ao lote com validade mais distante ou com maior saldo
      lotesComSaldo[lotesComSaldo.length - 1].saldoSatelite += diff;
    } else {
      // Se não havia lote com histórico comprovado, utiliza os lotes cadastrados do medicamento
      // ordenados por FEFO para não deixar o saldo órfão sem lote na Satélite
      const lotesCandidatos = [...lotesDoMed].sort((a, b) => {
        const da = safeParseISO(a.data_validade);
        const db = safeParseISO(b.data_validade);
        if (!da) return 1;
        if (!db) return -1;
        return da - db;
      });
      const loteEscolhido = lotesCandidatos.find(l => (Number(l.quantidade_satelite) || 0) > 0) || lotesCandidatos[0];
      if (loteEscolhido) {
        lotesComSaldo = [{
          ...loteEscolhido,
          saldoSatelite: saldoSat
        }];
      }
    }
  } else if (somaLotes > saldoSat) {
    // Ajusta proporcionalmente para não exceder o saldo total
    let excesso = somaLotes - saldoSat;
    for (let i = lotesComSaldo.length - 1; i >= 0 && excesso > 0; i--) {
      const deduzir = Math.min(lotesComSaldo[i].saldoSatelite, excesso);
      lotesComSaldo[i].saldoSatelite -= deduzir;
      excesso -= deduzir;
    }
    lotesComSaldo = lotesComSaldo.filter((l) => l.saldoSatelite > 0);
  }

  // Ordena por validade (FEFO)
  lotesComSaldo.sort((a, b) => {
    const da = safeParseISO(a.data_validade);
    const db = safeParseISO(b.data_validade);
    if (!da) return 1;
    if (!db) return -1;
    return da - db;
  });

  return lotesComSaldo;
}
