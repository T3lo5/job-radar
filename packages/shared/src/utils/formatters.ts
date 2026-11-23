import { formatSalary } from './salary.js';
export function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  // `new Date(value)` interpreta ISO string em UTC. Para evitar deslocamento
  // de 1 dia em UTC-3, extraímos os componentes diretamente da string.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return value;
  const [, ano, mes, dia] = m;
  return `${dia}/${mes}/${ano}`;
}

/** Formata localização para exibição. */
export function formatLocation(value: string | null | undefined): string {
  if (!value) return 'Não informado';
  return value;
}

/** Reexporta formatSalary para manter uma única fonte de verdade. */
export { formatSalary };
