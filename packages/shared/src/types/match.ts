export type MatchScore = number;

export type MatchLabel = 'excelente' | 'muito_boa' | 'boa' | 'possivel' | 'baixa';

/**
 * Critérios do score de match.
 *
 * `other` foi REMOVIDO: era um critério que ninguém calculava e que ficava
 * sempre no mesmo valor, o que inflava o score sem significar nada. Os pesos
 * foram redistribuídos entre os que existem.
 *
 * Aqui ainda estava declarado, então o tipo prometia um campo que o motor nunca
 * produz. `match.test.ts` compara esta lista com a interface do motor.
 */
export interface MatchBreakdown {
  technologies: number;
  experience: number;
  seniority: number;
  location: number;
  cloudDevOps: number;
  languages: number;
}

export interface MatchResult {
  score: MatchScore;
  label: MatchLabel;
  breakdown: MatchBreakdown;
  matchedSkills: string[];
  partialSkills: string[];
  missingSkills: string[];
}

/** Os critérios, como lista — para teste e para percorrer sem repetir. */
export const MATCH_CRITERIA = [
  'technologies',
  'experience',
  'seniority',
  'location',
  'cloudDevOps',
  'languages',
] as const satisfies ReadonlyArray<keyof MatchBreakdown>;
