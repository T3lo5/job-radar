import { describe, expect, it, vi } from 'vitest';
import { generateBasicAnalysis, mapRecomendacao } from './analysis-step.js';

describe('mapRecomendacao', () => {
  it('Candidatar produz APPLY para score comum', () => {
    // Ticket 26: antes 'Candidatar' virava STRONG_APPLY sempre e APPLY nunca
    // existia no banco.
    expect(mapRecomendacao('Candidatar', 82)).toBe('APPLY');
    expect(mapRecomendacao('Candidatar')).toBe('APPLY');
  });

  it('Candidatar com score >= 85 sobe para STRONG_APPLY', () => {
    expect(mapRecomendacao('Candidatar', 85)).toBe('STRONG_APPLY');
    expect(mapRecomendacao('Candidatar', 96)).toBe('STRONG_APPLY');
  });

  it('as demais respostas do prompt têm mapeamento direto', () => {
    expect(mapRecomendacao('Avaliar', 70)).toBe('CONSIDER');
    expect(mapRecomendacao('Ignorar', 20)).toBe('SKIP');
  });

  it('aceita variação de caixa e espaço', () => {
    expect(mapRecomendacao('  candidatar  ', 80)).toBe('APPLY');
  });

  it('resposta fora do contrato cai em CONSIDER e deixa log', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(mapRecomendacao('Talvez')).toBe('CONSIDER');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"Talvez"'));

    warn.mockRestore();
  });
});

describe('generateBasicAnalysis', () => {
  it('ignora a evidência de skill ao listar pontos fortes e lacunas', () => {
    // `breakdown` agora carrega `skillEvidence` (lista). Comparar lista com
    // número não pode transformar a evidência em "ponto forte".
    const analysis = generateBasicAnalysis({
      score: 80,
      breakdown: {
        technologies: 100,
        experience: 90,
        seniority: 100,
        location: 90,
        cloudDevOps: 70,
        languages: 100,
        skillEvidence: [{ skill: 'React', reason: 'EXACT' }],
      },
    });

    expect(analysis.pontos_fortes).toEqual([
      'technologies',
      'experience',
      'seniority',
      'location',
      'cloudDevOps',
      'languages',
    ]);
    expect(analysis.pontos_fortes).not.toContain('skillEvidence');
    expect(analysis.requisitos_faltantes).toEqual([]);
  });

  it('recomendação da análise básica continua coerente com o score', () => {
    const alta = generateBasicAnalysis({ score: 90, breakdown: {} });
    const baixa = generateBasicAnalysis({ score: 30, breakdown: {} });

    expect(alta.recomendacao).toBe('Candidatar');
    expect(baixa.recomendacao).toBe('Ignorar');
  });
});
