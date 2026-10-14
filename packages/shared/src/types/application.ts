/**
 * Status de candidatura: o enum `ApplicationStatus` do Prisma, em caixa alta.
 *
 * Aqui eram os mesmos valores em português minúsculo ('encontrada',
 * 'interessante'), que não batiam com o que a API devolve. Ver o comentário
 * em `types/seniority.ts` — é o mesmo problema e a mesma correção.
 *
 * `application.test.ts` compara esta lista com o enum do schema.
 */
export const APPLICATION_STATUSES = [
  'FOUND',
  'INTERESTING',
  'CV_PREPARED',
  'APPLIED',
  'INTERVIEW',
  'REJECTED',
  'OFFER',
  'ARCHIVED',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return typeof value === 'string' && (APPLICATION_STATUSES as readonly string[]).includes(value);
}
