import { describe, it, expect } from 'vitest';
import { formatRate, cohortDetail } from './analytics-format';

describe('formatRate', () => {
  it('mostra "—" quando o denominador é zero (null)', () => {
    expect(formatRate(null)).toBe('—');
    expect(formatRate(undefined)).toBe('—');
    expect(formatRate(NaN)).toBe('—');
  });

  it('formata frações como percentual inteiro', () => {
    expect(formatRate(0.5)).toBe('50%');
    expect(formatRate(0.333)).toBe('33%');
    expect(formatRate(1)).toBe('100%');
    expect(formatRate(0)).toBe('0%');
  });

  it('nunca passa de 100%, mesmo com dado inesperado', () => {
    expect(formatRate(1.5)).toBe('100%');
  });
});

describe('cohortDetail', () => {
  it('mostra razão quando há coorte', () => {
    expect(cohortDetail(3, 10)).toBe('3 de 10');
    expect(cohortDetail(0, 10)).toBe('0 de 10');
  });

  it('explica o vazio em vez de "0 de 0"', () => {
    expect(cohortDetail(0, 0)).toBe('sem candidaturas no período');
    expect(cohortDetail(undefined, undefined)).toBe('sem candidaturas no período');
  });
});
