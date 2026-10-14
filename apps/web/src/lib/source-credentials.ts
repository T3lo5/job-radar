/**
 * Fontes que exigem credencial configurada para funcionar.
 *
 * - `linkedin-apify`: precisa do token da Apify (grátis, mas precisa criar).
 * - `adzuna`: precisa do app id + app key.
 *
 * O `linkedin` puro NÃO está aqui de propósito: ele usa a API pública de guest
 * (`jobs-guest`), sem login nem token. Ele já apareceu com o selo "Requer
 * credenciais" por estar na mesma lista, o que mandava o usuário configurar
 * algo que não existe.
 */
const SOURCES_COM_CREDENCIAL = new Set(['linkedin-apify', 'adzuna']);

export function sourceNeedsCredentials(sourceId: string): boolean {
  return SOURCES_COM_CREDENCIAL.has(sourceId);
}
