import { describe, it, expect } from 'vitest';
import {
  calculateConfidence,
  CONFIDENCE_LOW_THRESHOLD,
  CONFIDENCE_MEDIUM_THRESHOLD,
} from './job-confidence.js';

const base = {
  title: 'Desenvolvedor Frontend',
  company: 'Acme Ltda',
  url: 'https://example.com/vaga/123',
  description: 'Procuramos desenvolvedor com React e TypeScript para time de produto. Remoto, CLT.',
  collectedAt: new Date().toISOString(),
  sourceCount: 1,
  salaryMin: null,
  salaryMax: null,
};

describe('calculateConfidence — sinais isolados', () => {
  it('vaga fresca, múltiplas fontes, salário e descrição completa = alta confiança', () => {
    const resultado = calculateConfidence({
      ...base,
      collectedAt: new Date().toISOString(),
      sourceCount: 3,
      salaryMin: 8000,
      salaryMax: 12000,
      description: 'A'.repeat(600),
    });

    expect(resultado.score).toBeGreaterThanOrEqual(CONFIDENCE_MEDIUM_THRESHOLD);
    expect(resultado.label).toBe('alta');
    expect(resultado.badges.some((b) => b.type === 'fresco')).toBe(true);
    expect(resultado.badges.some((b) => b.type === 'multifonte')).toBe(true);
    expect(resultado.badges.some((b) => b.type === 'com-salario')).toBe(true);
    expect(resultado.badges.some((b) => b.type === 'descricao-completa')).toBe(true);
  });

  it('vaga antiga, 1 fonte, sem salário, descrição curta = baixa confiança', () => {
    const resultado = calculateConfidence({
      ...base,
      collectedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
      sourceCount: 1,
      salaryMin: null,
      salaryMax: null,
      description: 'Vaga',
    });

    expect(resultado.score).toBeLessThan(CONFIDENCE_LOW_THRESHOLD);
    expect(resultado.label).toBe('baixa');
    expect(resultado.badges.some((b) => b.type === 'antigo')).toBe(true);
    expect(resultado.badges.some((b) => b.type === 'unifonte')).toBe(true);
    expect(resultado.badges.some((b) => b.type === 'sem-salario')).toBe(true);
    expect(resultado.badges.some((b) => b.type === 'descricao-resumida')).toBe(true);
  });

  it('score nunca excede 100 nem fica negativo', () => {
    const alto = calculateConfidence({
      ...base,
      collectedAt: new Date().toISOString(),
      sourceCount: 10,
      salaryMin: 1,
      salaryMax: 999999,
      description: 'A'.repeat(10000),
    });
    expect(alto.score).toBeLessThanOrEqual(100);

    const baixo = calculateConfidence({
      ...base,
      collectedAt: null,
      sourceCount: 0,
      salaryMin: null,
      salaryMax: null,
      description: '',
      url: 'not-a-url',
    });
    expect(baixo.score).toBeGreaterThanOrEqual(0);
  });

  it('URL inválida não tem badge url-valida', () => {
    const coletado = new Date().toISOString();
    const comUrlValida = calculateConfidence({
      ...base,
      collectedAt: coletado,
    });
    const comUrlInvalida = calculateConfidence({
      ...base,
      collectedAt: coletado,
      url: 'não é uma url',
    });
    expect(comUrlValida.badges.some((b) => b.type === 'url-valida')).toBe(true);
    expect(comUrlInvalida.badges.some((b) => b.type === 'url-valida')).toBe(false);
  });

  it('sem collectedAt não quebra o cálculo', () => {
    const resultado = calculateConfidence({
      ...base,
      collectedAt: null,
      sourceCount: 2,
      salaryMin: 5000,
      salaryMax: 7000,
      description: 'A'.repeat(300),
    });
    expect(resultado.score).toBeGreaterThan(0);
    expect(resultado.badges.some((b) => b.type === 'fresco' || b.type === 'antigo')).toBe(false);
  });
});

describe('thresholds', () => {
  it('baixa confiança começa abaixo de 40', () => {
    expect(CONFIDENCE_LOW_THRESHOLD).toBe(40);
  });

  it('alta confiança começa em 70', () => {
    expect(CONFIDENCE_MEDIUM_THRESHOLD).toBe(70);
  });
});
