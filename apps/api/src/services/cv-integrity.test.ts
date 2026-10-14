import { describe, it, expect } from 'vitest';
import { checkCvIntegrity, isTraceable, buildKnownTerms } from './cv-integrity.js';

const CV = `ANDERSON FRANCISCATO
Desenvolvedor Full Stack

EXPERIENCIA
Acme - Desenvolvedor Senior (2020-2024)
Construi aplicacoes com React, TypeScript e Node.js.

EDUCACAO
Universidade de Sao Paulo - Bacharelado em Ciencia da Computacao`;

const PROFILE = `Skills:
- React (ADVANCED)
- TypeScript (ADVANCED)
- Node.js (INTERMEDIATE)
- PostgreSQL (INTERMEDIATE)`;

const sources = [CV, PROFILE];

describe('checkCvIntegrity - Regra de Ouro', () => {
  it('aprova quando a IA usa apenas o que existe nas fontes', () => {
    const r = checkCvIntegrity({
      skillsClaimed: ['React', 'TypeScript', 'Node.js'],
      keywordsAdded: ['PostgreSQL'],
      sources,
    });
    expect(r.fabricatedSkills).toEqual([]);
    expect(r.keywordsAdded).toEqual(['PostgreSQL']);
    expect(r.warning).toBeUndefined();
  });

  it('REJEITA tecnologia inventada pelo modelo', () => {
    const r = checkCvIntegrity({
      skillsClaimed: ['React', 'Kubernetes'],
      keywordsAdded: [],
      sources,
    });
    expect(r.fabricatedSkills).toEqual(['Kubernetes']);
  });

  it('remove keyword inventada em vez de reprovar', () => {
    const r = checkCvIntegrity({
      skillsClaimed: ['React'],
      keywordsAdded: ['React', 'Terraform'],
      sources,
    });
    expect(r.droppedKeywords).toEqual(['Terraform']);
    expect(r.keywordsAdded).toEqual(['React']);
    expect(r.warning).toContain('Terraform');
  });

  it('detecta Several fabrications de uma vez', () => {
    const r = checkCvIntegrity({
      skillsClaimed: ['React', 'AWS', 'Rust', 'Docker'],
      keywordsAdded: [],
      sources,
    });
    expect(r.fabricatedSkills).toEqual(['AWS', 'Rust', 'Docker']);
  });

  it('funciona mesmo sem skillsClaimed (modelo antigo)', () => {
    const r = checkCvIntegrity({ keywordsAdded: ['React'], sources });
    expect(r.fabricatedSkills).toEqual([]);
    expect(r.keywordsAdded).toEqual(['React']);
  });

  it('ignora entradas vazias', () => {
    const r = checkCvIntegrity({ skillsClaimed: ['', '  '], keywordsAdded: [''], sources });
    expect(r.fabricatedSkills).toEqual([]);
    expect(r.droppedKeywords).toEqual([]);
  });
});

describe('isTraceable', () => {
  const known = buildKnownTerms(sources);

  it('aceita variacao de caixa e acento', () => {
    expect(isTraceable('react', known)).toBe(true);
    expect(isTraceable('Ciência da Computação', known)).toBe(true);
  });

  it('aceita Node.js / Node', () => {
    expect(isTraceable('Node.js', known)).toBe(true);
    expect(isTraceable('Node', known)).toBe(true);
  });

  it('recusa termo ausente', () => {
    expect(isTraceable('Kubernetes', known)).toBe(false);
    expect(isTraceable('Rust', known)).toBe(false);
  });

  it('recusa termo curto demais', () => {
    expect(isTraceable('x', known)).toBe(false);
  });
});
