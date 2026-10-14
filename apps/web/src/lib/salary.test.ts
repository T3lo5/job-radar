import { describe, it, expect } from 'vitest';
import { parseSalaryInput, formatSalary } from './salary';

describe('parseSalaryInput — formato brasileiro', () => {
  it('aceita numero puro', () => {
    expect(parseSalaryInput(20000)).toBe(20000);
    expect(parseSalaryInput('20000')).toBe(20000);
  });

  it('ponto de milhar some, nao divide por mil', () => {
    // Este é o bug: Number("20.000") === 20, e o salário ia errado pro banco.
    expect(parseSalaryInput('20.000')).toBe(20000);
    expect(parseSalaryInput('1.250.000')).toBe(1250000);
  });

  it('virgula decimal vira ponto', () => {
    expect(parseSalaryInput('20.500,50')).toBe(20501);
    expect(parseSalaryInput('1500,4')).toBe(1500);
  });

  it('vazio vira undefined (campo intocado), nao zero', () => {
    // `z.coerce.number()` transformava '' em 0 — limpar o campo gravava
    // salário zero em vez de manter o anterior.
    expect(parseSalaryInput('')).toBeUndefined();
    expect(parseSalaryInput('   ')).toBeUndefined();
    expect(parseSalaryInput(null)).toBeUndefined();
    expect(parseSalaryInput(undefined)).toBeUndefined();
  });

  it('lixo vira NaN para o schema rejeitar', () => {
    expect(parseSalaryInput('abc')).toBeNaN();
    expect(parseSalaryInput('R$ 20k')).toBeNaN();
  });

  it('arredonda a casa decimal da virgula', () => {
    // Ponto é SEMPRE milhar nesta regra: "20500.5" vira 205005. Patológico
    // para salário, mas a regra é uma só — sem exceção por "parecer decimal".
    expect(parseSalaryInput('20500,5')).toBe(20501);
    expect(parseSalaryInput('20500,4')).toBe(20500);
  });

  it('rejeita negativo? nao — devolve o numero e o schema decide', () => {
    // A faixa (min 0) é do schema, não do parser.
    expect(parseSalaryInput('-100')).toBe(-100);
  });
});

describe('formatSalary', () => {
  it('formata com milhar pt-BR', () => {
    expect(formatSalary(20000)).toBe('20.000');
    expect(formatSalary(1250000)).toBe('1.250.000');
  });

  it('mostra - quando ausente', () => {
    expect(formatSalary(null)).toBe('-');
    expect(formatSalary(undefined)).toBe('-');
  });
});
