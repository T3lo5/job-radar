/**
 * Formatação de números do analytics.
 *
 * Regra do ticket 20: sem denominador, a taxa é `null` e a tela mostra "—".
 * "0%" seria uma afirmação falsa sobre uma coorte que nem existe.
 */

/** `null`/`undefined`/NaN → "—"; senão percentual inteiro, limitado a 100%. */
export function formatRate(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const clamped = Math.min(1, Math.max(0, value));
  return `${Math.round(clamped * 100)}%`;
}

/** "3 de 10" para o rodapé do card; sem coorte, explica o vazio. */
export function cohortDetail(reached: number | undefined, total: number | undefined): string {
  if (!total) return 'sem candidaturas no período';
  return `${reached ?? 0} de ${total}`;
}
