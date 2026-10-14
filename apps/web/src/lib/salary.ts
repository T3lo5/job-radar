/**
 * Salário digitado por brasileiro.
 *
 * O bug: `z.coerce.number()` faz `Number("20.000")`, que é 20 — o ponto de
 * milhar some e o salário de R$ 20.000 vira R$ 20 no banco, em silêncio. O
 * usuário digitava certo e o perfil mostrava errado.
 *
 * Regra (formato brasileiro):
 * - `.` é separador de milhar e some: "20.000" -> 20000
 * - `,` é decimal e vira `.`: "20.500,50" -> 20500.5
 * - vazio/null/undefined -> undefined (campo intocado)
 * - resto inválido -> NaN (o schema rejeita, em vez de gravar lixo)
 */
export function parseSalaryInput(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;

  const texto = String(value).trim();
  if (texto === '') return undefined;

  const normalizado = texto.replace(/\./g, '').replace(',', '.');
  const numero = Number(normalizado);
  if (!Number.isFinite(numero)) return NaN as unknown as undefined;

  // A coluna é Int: arredonda em vez de truncar ou rejeitar.
  return Math.round(numero);
}

/** Exibição com milhar: 20000 -> "20.000". */
export function formatSalary(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return value.toLocaleString('pt-BR');
}
