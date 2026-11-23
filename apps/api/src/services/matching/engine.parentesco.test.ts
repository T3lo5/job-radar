import { describe, expect, it } from 'vitest';
import { computeMatchScore } from './engine.js';

/**
 * Ticket 25 — matching sem falso parentesco.
 *
 * A versão anterior comparava skills com `includes` nos dois sentidos, então
 * 'javascript'.includes('java') dava match para quem só sabia Java e
 * 'terraform'.includes('r') dava match para quem só sabia R. Senioridade
 * ignorava `job.seniority` e assumia MID quando o título não dizia nada, o que
 * penalizava perfil sênior em vaga que não declarou nível.
 */

function skill(name: string, aliases: string[] = []) {
  return { id: name, name, aliases, category: null, createdAt: new Date() } as never;
}

function job(opcoes: {
  title?: string;
  seniority?: string | null;
  skills?: ReturnType<typeof skill>[];
}) {
  return {
    id: 'j1',
    title: opcoes.title ?? 'Desenvolvedor',
    company: 'ACME',
    description: 'd',
    location: null,
    remote: 'REMOTE',
    seniority: opcoes.seniority ?? null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    skills: (opcoes.skills ?? []).map((s) => ({ skill: s, required: true })),
  } as never;
}

function profile(opcoes: { seniority?: string | null; skills?: ReturnType<typeof skill>[] }) {
  return {
    id: 'p1',
    title: 'Desenvolvedor',
    summary: null,
    yearsExp: 5,
    seniority: opcoes.seniority ?? null,
    location: null,
    remotePreference: 'ANY',
    languages: [],
    skills: (opcoes.skills ?? []).map((s) => ({
      id: `ps-${(s as unknown as { id: string }).id}`,
      profileId: 'p1',
      skillId: (s as unknown as { id: string }).id,
      level: 'ADVANCED',
      yearsExp: 3,
      skill: s,
    })),
  } as never;
}

const score = (jobSkills: string[], profileSkills: string[]) =>
  computeMatchScore(
    job({ skills: jobSkills.map((name) => skill(name)) }),
    profile({ skills: profileSkills.map((name) => skill(name)) }),
  );

describe('falso parentesco entre skills', () => {
  const casos: Array<{ vaga: string; perfil: string; esperado: number }> = [
    // Prefixo não é parentesco.
    { vaga: 'Java', perfil: 'JavaScript', esperado: 0 },
    { vaga: 'JavaScript', perfil: 'Java', esperado: 0 },
    { vaga: 'Java', perfil: 'Java', esperado: 100 },
    // Letra solta não é framework.
    { vaga: 'React', perfil: 'R', esperado: 0 },
    { vaga: 'R', perfil: 'React', esperado: 0 },
    // Grafia/abreviação é a MESMA skill: match cheio.
    { vaga: 'JavaScript', perfil: 'JS', esperado: 100 },
    { vaga: 'TypeScript', perfil: 'TS', esperado: 100 },
    { vaga: 'PostgreSQL', perfil: 'Postgres', esperado: 100 },
    // Tecnologia vizinha continua valendo meio ponto.
    { vaga: 'Vue', perfil: 'React', esperado: 50 },
    { vaga: 'Kubernetes', perfil: 'Docker', esperado: 50 },
  ];

  for (const caso of casos) {
    it(`vaga "${caso.vaga}" × perfil "${caso.perfil}" → ${caso.esperado}`, () => {
      expect(score([caso.vaga], [caso.perfil]).breakdown.technologies).toBe(caso.esperado);
    });
  }

  it('skill ausente por prefixo vai para missing, não para partial', () => {
    const r = score(['JavaScript'], ['Java']);
    expect(r.missingSkills).toEqual(['JavaScript']);
    expect(r.partialSkills).toEqual([]);
  });
});

describe('evidência do match de skill', () => {
  it('nome igual produz evidência EXACT', () => {
    const r = score(['React'], ['React']);
    expect(r.breakdown.skillEvidence).toEqual([{ skill: 'React', reason: 'EXACT' }]);
  });

  it('sinônimo conhecido produz ALIAS apontando a skill do perfil', () => {
    const r = score(['PostgreSQL'], ['Postgres']);
    expect(r.breakdown.skillEvidence).toEqual([
      { skill: 'PostgreSQL', reason: 'ALIAS', via: 'Postgres' },
    ]);
  });

  it('alias declarado no catálogo também conta como ALIAS', () => {
    const r = computeMatchScore(
      job({ skills: [skill('Tailwind CSS', ['Tailwind'])] }),
      profile({ skills: [skill('Tailwind')] }),
    );

    expect(r.breakdown.technologies).toBe(100);
    expect(r.breakdown.skillEvidence).toEqual([
      { skill: 'Tailwind CSS', reason: 'ALIAS', via: 'Tailwind' },
    ]);
  });

  it('tecnologia vizinha produz GROUP com a skill que casou', () => {
    const r = score(['Vue'], ['React']);
    expect(r.breakdown.technologies).toBe(50);
    expect(r.breakdown.skillEvidence).toEqual([{ skill: 'Vue', reason: 'GROUP', via: 'React' }]);
  });

  it('skill sem correspondência não gera evidência', () => {
    const r = score(['Rust'], ['React']);
    expect(r.breakdown.skillEvidence).toEqual([]);
    expect(r.missingSkills).toEqual(['Rust']);
  });
});

describe('senioridade da vaga', () => {
  const nota = (vaga: string | null, perfil: string | null, title = 'Desenvolvedor') =>
    computeMatchScore(
      job({ title, seniority: vaga, skills: [] }),
      profile({ seniority: perfil, skills: [] }),
    ).breakdown.seniority;

  it('usa job.seniority quando presente', () => {
    expect(nota('SENIOR', 'SENIOR')).toBe(100);
    // Júnior contra sênior é mismatch real: penaliza.
    expect(nota('JUNIOR', 'SENIOR')).toBe(50);
    expect(nota('SENIOR', 'JUNIOR')).toBe(50);
  });

  it('o campo vence o título', () => {
    // Título diz "Senior", mas o campo extraído diz JUNIOR. Antes o título
    // mandava e o sênior recebia 100 numa vaga júnior.
    expect(nota('JUNIOR', 'SENIOR', 'Senior Engineer')).toBe(50);
  });

  it('usa o título só quando o campo está ausente', () => {
    expect(nota(null, 'SENIOR', 'Senior Engineer')).toBe(100);
    expect(nota(null, 'JUNIOR', 'Senior Engineer')).toBe(50);
    expect(nota('UNKNOWN', 'JUNIOR', 'Desenvolvedor Júnior')).toBe(100);
  });

  it('sem campo nem sinal no título, não penaliza', () => {
    // Antes o default era MID: perfil SENIOR levava 75 e LEAD levava 50 por uma
    // informação que a vaga nunca deu.
    for (const perfil of ['JUNIOR', 'MID', 'SENIOR', 'SPECIALIST', 'LEAD']) {
      expect(nota(null, perfil)).toBe(100);
    }
  });

  it('perfil sem senioridade continua neutro', () => {
    expect(nota('SENIOR', null)).toBe(50);
    expect(nota('SENIOR', 'UNKNOWN')).toBe(50);
  });
});
