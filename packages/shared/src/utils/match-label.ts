import type { MatchLabel, MatchScore } from '../types/match.js';

export function matchLabelFor(score: MatchScore): MatchLabel {
  if (score >= 90) return 'excelente';
  if (score >= 80) return 'muito_boa';
  if (score >= 70) return 'boa';
  if (score >= 60) return 'possivel';
  return 'baixa';
}

export const MATCH_LABELS: Record<MatchLabel, { label: string; emoji: string }> = {
  excelente: { label: 'Excelente', emoji: '🔥' },
  muito_boa: { label: 'Muito boa', emoji: '🟢' },
  boa: { label: 'Boa', emoji: '🟡' },
  possivel: { label: 'Possível', emoji: '🟠' },
  baixa: { label: 'Baixa', emoji: '🔴' },
};
