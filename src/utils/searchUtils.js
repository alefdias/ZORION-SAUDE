/**
 * Utilitários para busca insensível a acentos (diacríticos) e maiúsculas/minúsculas.
 * Permite que 'litio' encontre 'Lítio', 'acido' encontre 'Ácido', etc.
 */

export function normalizeSearch(text) {
  if (text === null || text === undefined) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Como matchesSearch, mas também encontra quando o usuário digita junto
 * algo que está separado no cadastro: "10ml" acha "AMPOLA 10 ML".
 */
export function matchesSearchLoose(sourceText, searchTerm) {
  if (!searchTerm || !String(searchTerm).trim()) return true;
  if (!sourceText) return false;

  const normalizedSource = normalizeSearch(sourceText);
  const compactSource = normalizedSource.replace(/\s+/g, '');
  const normalizedTerms = normalizeSearch(searchTerm).split(/\s+/).filter(Boolean);

  return normalizedTerms.every((term) => {
    const compactTerm = term.replace(/\s+/g, '');
    return normalizedSource.includes(term) || (compactTerm && compactSource.includes(compactTerm));
  });
}

export function matchesSearch(sourceText, searchTerm) {
  if (!searchTerm || !String(searchTerm).trim()) return true;
  if (!sourceText) return false;

  const normalizedSource = normalizeSearch(sourceText);
  const normalizedTerms = normalizeSearch(searchTerm).split(/\s+/).filter(Boolean);

  return normalizedTerms.every(term => normalizedSource.includes(term));
}
