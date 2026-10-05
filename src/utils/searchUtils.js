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

export function matchesSearch(sourceText, searchTerm) {
  if (!searchTerm || !String(searchTerm).trim()) return true;
  if (!sourceText) return false;

  const normalizedSource = normalizeSearch(sourceText);
  const normalizedTerms = normalizeSearch(searchTerm).split(/\s+/).filter(Boolean);

  return normalizedTerms.every(term => normalizedSource.includes(term));
}
