export const SENIORITIES = [
  'estagiario',
  'junior',
  'pleno',
  'senior',
  'especialista',
  'lead',
] as const;

export type Seniority = (typeof SENIORITIES)[number];

export function isSeniority(value: unknown): value is Seniority {
  return typeof value === 'string' && (SENIORITIES as readonly string[]).includes(value);
}
