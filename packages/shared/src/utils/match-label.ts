import type { MatchLabel, MatchScore, SkillMatchReason } from '../types/match.js';

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

/**
 * Rótulo da evidência de skill.
 *
 * Fica no shared, e não na página, para API (que produz o motivo) e UI (que
 * exibe) usarem o mesmo vocabulário. `Record` completo quebra o build se um
 * motivo novo for criado sem rótulo.
 */
export const SKILL_MATCH_REASON_LABELS: Record<SkillMatchReason, string> = {
  EXACT: 'nome exato',
  ALIAS: 'sinônimo',
  GROUP: 'relacionada',
};
