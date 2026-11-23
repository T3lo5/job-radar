/** Exibição com milhar: 20000 -> "20.000". */
export function formatSalary(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return value.toLocaleString('pt-BR');
}
