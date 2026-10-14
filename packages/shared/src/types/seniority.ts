/**
 * Senioridade: os valores do enum `Seniority` do Prisma, em CAIXA ALTA.
 *
 * Estes nomes vinham em português minúsculo ('estagiario', 'pleno'), o que não
 * batia com nada do resto do sistema: a API devolve o enum do Prisma
 * (INTERN, MID, SENIOR...) e `SENIORITY_LABELS`, neste mesmo pacote, já era
 * indexado pelos valores do enum. Duas vocabulários contraditórios no mesmo
 * arquivo — e o que pegava quem usasse `isSeniority` num valor vindo da API:
 * `isSeniority('SENIOR')` devolvia false.
 *
 * A fonte da verdade é o schema. `seniority.test.ts` compara esta lista com o
 * enum do Prisma, então a divergência não volta em silêncio.
 */
export const SENIORITIES = [
  'UNKNOWN',
  'INTERN',
  'JUNIOR',
  'MID',
  'SENIOR',
  'SPECIALIST',
  'LEAD',
] as const;

export type Seniority = (typeof SENIORITIES)[number];

export function isSeniority(value: unknown): value is Seniority {
  return typeof value === 'string' && (SENIORITIES as readonly string[]).includes(value);
}
