export type MatchScore = number;

export type MatchLabel = 'excelente' | 'muito_boa' | 'boa' | 'possivel' | 'baixa';

export interface MatchBreakdown {
  technologies: number;
  experience: number;
  seniority: number;
  location: number;
  cloudDevOps: number;
  languages: number;
  other: number;
}

export interface MatchResult {
  score: MatchScore;
  label: MatchLabel;
  breakdown: MatchBreakdown;
  matchedSkills: string[];
  partialSkills: string[];
  missingSkills: string[];
}
