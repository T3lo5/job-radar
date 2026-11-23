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

  it('detecta varias fabrications de uma vez', () => {
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

  it('devolve evidência de onde e por qual forma cada termo foi achado', () => {
    const r = checkCvIntegrity({
      skillsClaimed: ['NodeJS', 'AWS'],
      keywordsAdded: ['React'],
      sources,
    });

    // "NodeJS" não aparece literalmente; casou pelo alias "Node.js" no CV.
    expect(r.skillEvidence).toEqual([
      expect.objectContaining({
        term: 'NodeJS',
        found: true,
        matchedAlias: 'Node.js',
        sourceIndex: 0,
      }),
      expect.objectContaining({ term: 'AWS', found: false }),
    ]);
    expect(r.keywordEvidence).toEqual([
      expect.objectContaining({ term: 'React', matchedAlias: 'React', sourceIndex: 0 }),
    ]);
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
    expect(isTraceable('NodeJS', known)).toBe(true);
  });

  it('recusa termo ausente', () => {
    expect(isTraceable('Kubernetes', known)).toBe(false);
    expect(isTraceable('Rust', known)).toBe(false);
  });

  it('recusa termo curto demais', () => {
    expect(isTraceable('x', known)).toBe(false);
  });
});

describe('isTraceable — fronteira de palavra (falsos positivos do includes)', () => {
  const casos: Array<{ termo: string; texto: string; esperado: boolean }> = [
    // Os três reproduzíveis da auditoria.
    { termo: 'Go', texto: 'Trabalhei no Google', esperado: false },
    { termo: 'Java', texto: 'Experiência com JavaScript', esperado: false },
    { termo: 'R', texto: 'React, Rust e Ruby', esperado: false },
    // ...e os verdadeiros positivos.
    { termo: 'Go', texto: 'Escrevi serviços em Go', esperado: true },
    { termo: 'Java', texto: 'Java 17 e Spring', esperado: true },
    { termo: 'Go', texto: 'Golang no backend', esperado: true },
    { termo: 'React', texto: 'Frontend em React.js', esperado: true },
    { termo: 'React.js', texto: 'Frontend em React', esperado: true },
    { termo: 'Full Stack', texto: 'Desenvolvedor full-stack', esperado: true },
    { termo: 'Node', texto: 'Node.js no backend', esperado: true },
    { termo: 'Node.js', texto: 'APIs em Node', esperado: true },
    // Palavras que contêm o termo não contam.
    { termo: 'Rust', texto: 'Trust me', esperado: false },
    { termo: 'C', texto: 'C# e C++', esperado: false },
  ];

  it.each(casos)('"$termo" em "$texto" → $esperado', ({ termo, texto, esperado }) => {
    expect(isTraceable(termo, buildKnownTerms([texto]))).toBe(esperado);
  });

  it('nenhum termo de 1–2 letras casa por substring', () => {
    const texto = buildKnownTerms(['google javascript rust react']);
    for (const termo of ['o', 'g', 'go', 'va', 'js', 'r', 'rr', 'pt']) {
      expect(isTraceable(termo, texto)).toBe(false);
    }
  });
});

describe('isTraceable — termos compostos e aliases', () => {
  const casos: Array<{ termo: string; texto: string; esperado: boolean }> = [
    { termo: 'Node.js', texto: 'Node.js', esperado: true },
    { termo: 'Node', texto: 'Node.js', esperado: true },
    { termo: 'NodeJS', texto: 'Node', esperado: true },
    { termo: 'C++', texto: 'C++', esperado: true },
    { termo: 'C++', texto: 'cpp', esperado: true },
    { termo: 'Cpp', texto: 'C++', esperado: true },
    { termo: 'C#', texto: 'C#', esperado: true },
    { termo: 'C#', texto: 'csharp', esperado: true },
    { termo: 'CSharp', texto: 'C-Sharp', esperado: true },
    { termo: '.NET', texto: '.NET 8', esperado: true },
    { termo: '.NET', texto: 'dotnet', esperado: true },
    { termo: 'dotnet', texto: 'ASP.NET Core', esperado: true },
    { termo: '.NET', texto: 'network', esperado: false },
    { termo: 'CI/CD', texto: 'CI/CD', esperado: true },
    { termo: 'CI/CD', texto: 'CICD', esperado: true },
    { termo: 'CICD', texto: 'CI-CD', esperado: true },
    { termo: 'CI/CD', texto: 'continuous integration', esperado: true },
    { termo: 'CI/CD', texto: 'ci', esperado: false },
  ];

  it.each(casos)('"$termo" em "$texto" → $esperado', ({ termo, texto, esperado }) => {
    expect(isTraceable(termo, buildKnownTerms([texto]))).toBe(esperado);
  });
});
