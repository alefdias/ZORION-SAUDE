import { db } from "@/api/db";

/**
 * Serviço centralizado para execução rápida em lote e cancelamento/estorno de baixas de estoque.
 * Todas as operações usam transações atômicas com db.batchExecute para garantir que o banco
 * de dados NUNCA trave por múltiplos acessos concorrentes e conexões TCP repetitivas.
 */

/**
 * Estorna uma baixa completa identificada por seu baixa_grupo_id ou lista de saídas.
 * Reverte:
 * - Estoque satélite do Medicamento
 * - Quantidade atual / satélite do Lote físico
 * - Cobertura da Prescrição do Paciente
 * - Ciclo coberto do Paciente
 * - Remove os registros de Saída
 */
export async function cancelarEstornarBaixaGrupo({
  baixaGrupoId,
  saidasDoGrupo = [],
  usuarioNome = "Farmacêutico",
  motivo = "Cancelamento de baixa solicitada pelo usuário",
}) {
  if (!baixaGrupoId && (!saidasDoGrupo || saidasDoGrupo.length === 0)) {
    throw new Error("Identificador do grupo de baixa não informado.");
  }

  // 1. Obter todas as saídas do grupo se não foram passadas
  let listaSaidas = saidasDoGrupo;
  if (!listaSaidas || listaSaidas.length === 0) {
    const todasSaidas = await db.entities.Saida.list();
    listaSaidas = todasSaidas.filter((s) => s.baixa_grupo_id === baixaGrupoId);
  }

  if (listaSaidas.length === 0) {
    throw new Error("Nenhum registro de saída encontrado para esta baixa.");
  }

  // Obter medicamentos e lotes atuais para calcular a devolução
  const [medicamentos, lotes, prescricoes, pacientes] = await Promise.all([
    db.entities.Medicamento.list(),
    db.entities.Lote.list(),
    db.entities.PrescricaoPaciente.list().catch(() => []),
    db.entities.Paciente.list().catch(() => []),
  ]);

  const medMap = new Map((medicamentos || []).map((m) => [String(m.id), m]));
  const loteMap = new Map((lotes || []).map((l) => [String(l.id), l]));
  const prescMap = new Map((prescricoes || []).map((p) => [String(p.id), p]));
  const pacMap = new Map((pacientes || []).map((p) => [String(p.id), p]));

  // Agrupar quantidades devolvidas por medicamento e lote
  const devolucoesMed = {}; // medId -> qtd
  const devolucoesLote = {}; // loteId -> qtd
  const prescricoesAfetadas = new Set();
  const pacientesAfetados = new Set();
  const saidasIds = [];

  for (const s of listaSaidas) {
    saidasIds.push(s.id);
    const qtd = Number(s.quantidade) || 0;
    if (qtd <= 0) continue;

    const medId = s.medicamento_id || s.medicamentoId;
    if (medId) {
      devolucoesMed[String(medId)] = (devolucoesMed[String(medId)] || 0) + qtd;
    }

    const loteId = s.lote_id || s.loteId;
    if (loteId) {
      devolucoesLote[String(loteId)] = (devolucoesLote[String(loteId)] || 0) + qtd;
    }

    if (s.prescricao_id) {
      prescricoesAfetadas.add(String(s.prescricao_id));
    }
    if (s.paciente_id) {
      pacientesAfetados.add(String(s.paciente_id));
    }
  }

  const sqlStatements = [];

  // 1. Reverter estoque satélite dos medicamentos
  for (const [medId, qtdDevolver] of Object.entries(devolucoesMed)) {
    const med = medMap.get(medId);
    if (med) {
      const novoEstoque = (Number(med.estoque_satelite) || 0) + qtdDevolver;
      sqlStatements.push(
        db.buildUpdateSql("Medicamento", med.id, { estoque_satelite: novoEstoque })
      );
    }
  }

  // 2. Reverter lotes físicos
  for (const [loteId, qtdDevolver] of Object.entries(devolucoesLote)) {
    const lote = loteMap.get(loteId);
    if (lote) {
      const novoSaldo = (Number(lote.quantidade_atual) || 0) + qtdDevolver;
      const novoSaldoSat = (Number(lote.quantidade_satelite) || 0) + qtdDevolver;
      sqlStatements.push(
        db.buildUpdateSql("Lote", lote.id, {
          quantidade_atual: novoSaldo,
          quantidade_satelite: novoSaldoSat,
          status: "ativo",
        })
      );
    }
  }

  // 3. Resetar cobertura das prescrições afetadas
  for (const prId of prescricoesAfetadas) {
    const pr = prescMap.get(prId);
    if (pr) {
      sqlStatements.push(
        db.buildUpdateSql("PrescricaoPaciente", pr.id, {
          coberto_ate: null,
          ultimo_lote_dias: 0,
          dose_diaria_dispensada: 0,
          quantidade_ultimo_lote: 0,
        })
      );
    }
  }

  // 4. Resetar ciclo dos pacientes afetados
  for (const pacId of pacientesAfetados) {
    const pac = pacMap.get(pacId);
    if (pac) {
      sqlStatements.push(
        db.buildUpdateSql("Paciente", pac.id, {
          ciclo_coberto_ate: null,
          ultimo_ciclo_dias: 0,
        })
      );
    }
  }

  // 5. Deletar os registros de Saída
  for (const sId of saidasIds) {
    sqlStatements.push(`DELETE FROM "Saida" WHERE "id" = '${sId}';`);
  }

  // Executar tudo em UMA única transação no Postgres
  await db.batchExecute(sqlStatements, {
    auditAction: "CANCELAMENTO_BAIXA_ESTOQUE",
    auditEntity: "Saida",
    auditDetails: `Cancelamento de baixa em lote (Grupo: ${baixaGrupoId || "manual"}). ${listaSaidas.length} saídas estornadas por ${usuarioNome}. Motivo: ${motivo}`,
  });

  return {
    estornadas: listaSaidas.length,
    medicamentosAtualizados: Object.keys(devolucoesMed).length,
    lotesAtualizados: Object.keys(devolucoesLote).length,
  };
}

/**
 * Estorna uma única saída individualmente, revertendo estoque e cobertura se aplicável.
 */
export async function cancelarEstornarSaidaIndividual({ saida, usuarioNome = "Farmacêutico" }) {
  if (!saida || !saida.id) {
    throw new Error("Saída inválida para estorno.");
  }

  const sqlStatements = [];
  const qtd = Number(saida.quantidade) || 0;

  // 1. Reverter estoque do medicamento
  const medId = saida.medicamento_id || saida.medicamentoId;
  if (medId && qtd > 0) {
    const med = await db.entities.Medicamento.get(medId).catch(() => null);
    if (med) {
      const novoEstoque = (Number(med.estoque_satelite) || 0) + qtd;
      sqlStatements.push(
        db.buildUpdateSql("Medicamento", med.id, { estoque_satelite: novoEstoque })
      );
    }
  }

  // 2. Reverter lote se houver
  const loteId = saida.lote_id || saida.loteId;
  if (loteId && qtd > 0) {
    const lote = await db.entities.Lote.get(loteId).catch(() => null);
    if (lote) {
      const novoSaldo = (Number(lote.quantidade_atual) || 0) + qtd;
      const novoSaldoSat = (Number(lote.quantidade_satelite) || 0) + qtd;
      sqlStatements.push(
        db.buildUpdateSql("Lote", lote.id, {
          quantidade_atual: novoSaldo,
          quantidade_satelite: novoSaldoSat,
          status: "ativo",
        })
      );
    }
  }

  // 3. Resetar prescrição se houver
  if (saida.prescricao_id) {
    sqlStatements.push(
      db.buildUpdateSql("PrescricaoPaciente", saida.prescricao_id, {
        coberto_ate: null,
        ultimo_lote_dias: 0,
      })
    );
  }

  // 4. Deletar saída
  sqlStatements.push(`DELETE FROM "Saida" WHERE "id" = '${saida.id}';`);

  await db.batchExecute(sqlStatements, {
    auditAction: "CANCELAMENTO_SAIDA_INDIVIDUAL",
    auditEntity: "Saida",
    auditDetails: `Estorno individual da saída ${saida.id} (${saida.medicamento_nome}, ${qtd} un) por ${usuarioNome}.`,
  });

  return true;
}
