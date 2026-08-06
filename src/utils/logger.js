import { db } from "@/api/db";

/**
 * Registra uma ação na tabela de Auditoria (Logs do RT)
 * @param {string} acao - Ação realizada (ex: "Entrada de Estoque", "Cadastro de Medicamento", "Edição")
 * @param {string} detalhes - Descrição do que foi feito (ex: "Adicionado 50un de Paracetamol - Lote XYZ")
 * @param {string} modulo - Módulo onde ocorreu a ação (ex: "Estoque Central", "Responsável Técnico")
 * @param {string} usuario - Usuário que realizou a ação (Opcional, padronizado por enquanto)
 */
export async function logAction(acao, detalhes, modulo, usuario = "Administrador") {
  try {
    await db.entities.Auditoria.create({
      acao,
      detalhes,
      modulo,
      usuario,
    });
  } catch (error) {
    console.error("Falha ao registrar log de auditoria:", error);
  }
}
