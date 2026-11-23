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

/** Rótulos PT-BR do quadro. A UI não deve exibir o enum cru. */
export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  FOUND: 'Encontrada',
  INTERESTING: 'Interessante',
  CV_PREPARED: 'CV preparado',
  APPLIED: 'Aplicada',
  INTERVIEW: 'Entrevista',
  REJECTED: 'Rejeitada',
  OFFER: 'Oferta',
  ARCHIVED: 'Arquivada',
};

/**
 * Catálogo de ATS oferecidos no select de candidatura.
 *
 * Fonte única para web, API e testes: quando a UI e a validação divergem, o
 * usuário escolhe um valor, recebe 200 e o dado some (foi o bug do ticket 12).
 * "Outro" é um valor fechado; a UI não coleta texto livre.
 */
export const ATS_PROVIDERS = [
  'Greenhouse',
  'Lever',
  'Workday',
  'Ashby',
  'SmartRecruiters',
  'Workable',
  'iCIMS',
  'Taleo',
  'Outro',
] as const;

export type AtsProvider = (typeof ATS_PROVIDERS)[number];

export function isAtsProvider(value: unknown): value is AtsProvider {
  return typeof value === 'string' && (ATS_PROVIDERS as readonly string[]).includes(value);
}
