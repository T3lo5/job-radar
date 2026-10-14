import type { Seniority } from '../types/seniority.js';

/**
 * Rótulo e cor por senioridade.
 *
 * O `Record<Seniority, ...>` é deliberado: se alguém acrescentar um valor no
 * enum e esquecer o rótulo aqui, o build quebra em vez de a UI cair no
 * `?? job.seniority` mostrando 'SPECIALIST' cru para o usuário.
 */
export const SENIORITY_LABELS: Record<Seniority, { label: string; color: string }> = {
  UNKNOWN: { label: 'N/A', color: 'bg-slate-700 text-slate-400' },
  INTERN: { label: 'Estagiário', color: 'bg-slate-700 text-slate-300' },
  JUNIOR: { label: 'Júnior', color: 'bg-green-900/50 text-green-300' },
  MID: { label: 'Pleno', color: 'bg-blue-900/50 text-blue-300' },
  SENIOR: { label: 'Sênior', color: 'bg-purple-900/50 text-purple-300' },
  SPECIALIST: { label: 'Especialista', color: 'bg-orange-900/50 text-orange-300' },
  LEAD: { label: 'Lead', color: 'bg-red-900/50 text-red-300' },
};

/** Rótulo legível, com fallback para o valor cru se vier algo inesperado. */
export function seniorityLabel(value: string | null | undefined): string {
  if (!value) return SENIORITY_LABELS.UNKNOWN.label;
  return SENIORITY_LABELS[value as Seniority]?.label ?? value;
}
