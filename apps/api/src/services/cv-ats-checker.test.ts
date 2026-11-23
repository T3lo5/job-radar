import { describe, it, expect } from 'vitest';
import { cvAtsChecker } from './cv-ats-checker.js';

describe('cvAtsChecker — issues com trecho, confiança e como corrigir', () => {
  it('TOO_LONG com snippet, confiança alta e fix', () => {
    const textoLongo = 'palavra '.repeat(1300); // ~1300 palavras → 3 páginas
    const resultado = cvAtsChecker.check(textoLongo);

    const issue = resultado.issues.find((i) => i.code === 'TOO_LONG');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
    expect(issue!.snippet).toBeDefined();
    expect(issue!.confidence).toBe('alta');
    expect(issue!.fix).toBeDefined();
    expect(issue!.fix!.length).toBeGreaterThan(20);
  });

  it('HAS_TABLE com snippet e confiança alta', () => {
    const textoComTabela = [
      'Cargo | Empresa | Ano',
      'Dev | Acme | 2023',
      'Designer | Beta | 2022',
      'Analista | Gama | 2021',
    ].join('\n');
    const resultado = cvAtsChecker.check(textoComTabela);

    const issue = resultado.issues.find((i) => i.code === 'HAS_TABLE');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('error');
    expect(issue!.snippet).toBeDefined();
    expect(issue!.confidence).toBe('alta');
    expect(issue!.fix).toContain('bullet point');
  });

  it('MULTI_COLUMN com confiança média', () => {
    // Muitas linhas curtas (coluna esquerda) e poucas longas (coluna direita)
    const curtas = Array.from({ length: 25 }, () => 'Skill').join('\n');
    const longas =
      'Uma linha bem longa que simula o conteúdo da coluna direita do currículo em duas colunas.';
    const resultado = cvAtsChecker.check(`${curtas}\n${longas}`);

    const issue = resultado.issues.find((i) => i.code === 'MULTI_COLUMN');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('error');
    expect(issue!.confidence).toBe('media');
    expect(issue!.fix).toContain('coluna única');
  });

  it('NO_CONTACT com snippet, confiança alta e fix', () => {
    const textoSemContato = 'Experiência\nTrabalhei na Acme como desenvolvedor por 3 anos.';
    const resultado = cvAtsChecker.check(textoSemContato);

    const issue = resultado.issues.find((i) => i.code === 'NO_CONTACT');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
    expect(issue!.snippet).toBeDefined();
    expect(issue!.confidence).toBe('alta');
    expect(issue!.fix).toContain('e-mail');
  });

  it('CV limpo não gera issues', () => {
    const textoLimpo =
      'João Silva\njoao@email.com\n+55 11 99999-9999\nSão Paulo - SP\nExperiência\nDesenvolvedor na Acme (2020-2023)\nReact, TypeScript, Node.js';
    const resultado = cvAtsChecker.check(textoLimpo);

    expect(resultado.issues.length).toBe(0);
    expect(resultado.score).toBeGreaterThanOrEqual(80);
  });

  it('score nunca excede 100 nem fica negativo', () => {
    const ruim = cvAtsChecker.check(
      'A'.repeat(3000) + '\n| a | b | c |\n| x | y | z |\n| 1 | 2 | 3 |',
    );
    expect(ruim.score).toBeGreaterThanOrEqual(0);
    expect(ruim.score).toBeLessThanOrEqual(100);

    const otimo = cvAtsChecker.check(
      'João Silva\njoao@email.com\n+55 11 99999-9999\nExperiência\nDev na Acme (2020-2023)\nReact TypeScript Node.js',
    );
    expect(otimo.score).toBeLessThanOrEqual(100);
  });

  it('cada issue tem message em português', () => {
    const resultado = cvAtsChecker.check('A'.repeat(1200));
    for (const issue of resultado.issues) {
      expect(typeof issue.message).toBe('string');
      expect(issue.message.length).toBeGreaterThan(10);
    }
  });
});
