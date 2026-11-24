import { db } from "@/api/db";

/**
 * Retorna os dados do usuário atualmente logado na aplicação
 */
export function getActiveUser() {
  try {
    const raw = sessionStorage.getItem("axion_active_user") || localStorage.getItem("pharma_user");
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn("Erro ao obter usuário ativo da sessão:", e);
  }
  return null;
}

/**
 * Valida se a senha digitada corresponde à senha do próprio usuário logado.
 * Não existe senha mestre: cada ação sensível exige a senha do próprio usuário.
 *
 * @param {string} inputSenha Senha digitada
 * @returns {Promise<boolean>} Verdadeiro se a senha for válida
 */
export async function validarSenhaUsuario(inputSenha) {
  const input = (inputSenha || "").trim();
  if (!input) return false;

  // 1. Validação contra o usuário atualmente ativo na sessão
  const currentUser = getActiveUser();
  if (currentUser) {
    if (currentUser.senha && currentUser.senha === input) return true;
    if (currentUser.password && currentUser.password === input) return true;
  }

  // 3. Validação consultando os usuários no banco de dados (db.entities.Usuario)
  try {
    const users = await db.entities.Usuario.list();
    if (Array.isArray(users) && users.length > 0) {
      if (currentUser) {
        const matched = users.find(
          (u) =>
            (currentUser.id && String(u.id) === String(currentUser.id)) ||
            (currentUser.login && u.login === currentUser.login) ||
            (currentUser.username && u.username === currentUser.username) ||
            (currentUser.coren && u.coren === currentUser.coren)
        );
        if (matched && (matched.senha === input || matched.password === input)) {
          return true;
        }
      }
    }
  } catch (err) {
    console.warn("Aviso ao consultar usuários para validação de senha:", err);
  }

  return false;
}
