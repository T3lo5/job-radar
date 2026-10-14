import { describe, it, expect } from 'vitest';
import { computeMatchScore } from './engine.js';

// Shapes mínimos exigidos pelo engine — o resto é preenchido com vazio porque
// só skills, senioridade e localização afetam os critérios testados.
const job = (skills: string[]) =>
  ({
    id: 'j1',
    title: 'Dev',
    description: 'd',
    company: 'C',
    location: 'Remote',
    remote: 'REMOTE',
    seniority: 'MID',
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    skills: skills.map((name) => ({ required: false, skill: { id: name, name, aliases: [] } })),
  }) as never;

const profile = (skills: string[]) =>
  ({
    id: 'p1',
    seniority: 'MID',
    seniorityList: [],
    location: 'Brasil',
    remotePreference: 'ANY',
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: 'BRL',
    summary: '',
    jobTypes: [],
    focusStacks: [],
    discardTerms: [],
    languages: [],
    skills: skills.map((name) => ({
      level: 'INTERMEDIATE',
      yearsExp: 3,
      skill: { id: name, name, aliases: [] },
    })),
  }) as never;

const score = (jobSkills: string[], profileSkills: string[]) =>
  computeMatchScore(job(jobSkills), profile(profileSkills));

describe('normalização de skills', () => {
  it('não confunde C++ com C#', () => {
    // Regressão: a normalização removia tudo fora de [a-z0-9], então 'C++' e
    // 'C#' viravam os dois 'c' e o perfil de C# pontuava 100 na vaga de C++.
    expect(score(['C++'], ['C#']).breakdown.technologies).toBe(0);
    expect(score(['C#'], ['C++']).breakdown.technologies).toBe(0);
    expect(score(['C++'], ['C++']).breakdown.technologies).toBe(100);
    expect(score(['C#'], ['C#']).breakdown.technologies).toBe(100);
  });

  it('não produz string vazia que casaria com qualquer coisa', () => {
    // 'JS' virava '' na versão anterior.
    expect(score(['JavaScript'], ['JS']).breakdown.technologies).not.toBe(100);
  });

  it('normaliza variações de escrita', () => {
    expect(score(['Node.js'], ['Node']).breakdown.technologies).toBe(100);
    expect(score(['TypeScript'], ['Type Script']).breakdown.technologies).toBe(100);
  });
});

describe('classificação cloud/DevOps', () => {
  it('não classifica skills curtas como cloud por substring', () => {
    // Regressão: comparava com `includes` nos dois sentidos, então
    // 'google cloud'.includes('go') classificava 'Go' como cloud e
    // 'terraform'.includes('r') classificava 'R'.
    expect(score(['Go'], ['React']).breakdown.cloudDevOps).toBe(70);
    expect(score(['R'], ['React']).breakdown.cloudDevOps).toBe(70);
    expect(score(['React'], ['React']).breakdown.cloudDevOps).toBe(70);
  });

  it('classifica cloud de verdade', () => {
    for (const cloud of ['AWS', 'Docker', 'Terraform', 'Kubernetes']) {
      expect(score([cloud], ['React']).breakdown.cloudDevOps).toBe(0);
      expect(score([cloud], [cloud]).breakdown.cloudDevOps).toBe(100);
    }
  });
});

describe('partição de skills', () => {
  const assertDisjoint = (jobSkills: string[], profileSkills: string[]) => {
    const r = score(jobSkills, profileSkills);
    const all = [...r.matchedSkills, ...r.partialSkills, ...r.missingSkills];
    expect(new Set(all).size).toBe(all.length);
    return r;
  };

  it('mantém as três listas disjuntas', () => {
    // Regressão: computeCloudDevOpsScore rodava depois do score de
    // technologies e fazia push nas listas compartilhadas, deixando a mesma
    // skill em 'partial' e em 'missing' ao mesmo tempo.
    const r = assertDisjoint(['Go', 'AWS'], ['AWS']);
    expect(r.matchedSkills).toEqual(['AWS']);
    expect(r.missingSkills).toEqual(['Go']);

    const r2 = assertDisjoint(['React', 'Node'], ['React']);
    expect(r2.matchedSkills).toEqual(['React']);

    assertDisjoint(['Python'], ['Go']);
  });

  it('coloca toda skill da vaga em alguma lista', () => {
    const r = score(['Go', 'AWS', 'Python'], ['AWS']);
    const all = [...r.matchedSkills, ...r.partialSkills, ...r.missingSkills];
    expect(all.sort()).toEqual(['AWS', 'Go', 'Python']);
  });
});

describe('invariantes do score', () => {
  it('sempre fica entre 0 e 100', () => {
    for (const [js, ps] of [
      [[], []],
      [['React'], ['React', 'Node', 'AWS', 'Docker', 'Python']],
      [['Go', 'Rust', 'Kubernetes'], ['Cobol']],
      [['C++'], ['C#']],
    ]) {
      const r = score(js, ps);
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });

  it('perfil com a skill exata pontua acima de perfil sem ela', () => {
    const com = score(['React'], ['React']);
    const sem = score(['React'], ['Python']);
    expect(com.score).toBeGreaterThan(sem.score);
  });

  it('não tem mais o critério fixo "other" no breakdown', () => {
    // Regressão: 'other' era um 50 constante com peso 0.05, ou seja 2,5
    // pontos garantidos em toda vaga e um teto que impedia 100.
    expect(score(['React'], ['React']).breakdown).not.toHaveProperty('other');
  });

  it('candidato muito aderente passa de 91 (teto antigo)', () => {
    const skills = ['React', 'TypeScript', 'Node.js', 'AWS', 'Docker'];
    expect(score(skills, skills).score).toBeGreaterThan(91);
  });

  it('trata "sem dados" como neutro, não como zero', () => {
    // Perfil sem skills não pode ser penalizado como se estivesse errado.
    const r = score(['React', 'TypeScript'], []);
    expect(r.breakdown.experience).toBe(50);
  });
});
