import { describe, it, expect } from 'vitest';
import { computeMatchScore } from './engine.js';
import type { Skill } from '../../generated/prisma/index.js';

/**
 * O motor deixou de receber o catálogo inteiro de skills.
 *
 * O recorte (union das skills da vaga com as do perfil) é seguro por causa de
 * uma propriedade específica de `findSynonymMatch`: ele só produz resposta a
 * partir de (a) os aliases da própria skill da vaga e (b) os aliases das skills
 * cujo nome está no perfil. Qualquer outra linha é lida e descartada.
 *
 * Estes testes existem para travar essa propriedade. Sem eles, alguém pode
 * "otimizar" o recorte para só as skills do perfil e quebrar o matching sem
 * perceber: o erro é um false silencioso, não uma exceção.
 */

function skill(id: string, name: string, aliases: string[] = []): Skill {
  return { id, name, aliases, category: null, createdAt: new Date() } as Skill;
}

function jobCom(skills: Skill[]) {
  return {
    id: 'j1',
    title: 'Engenheiro',
    company: 'X',
    description: 'd',
    location: null,
    remote: 'REMOTE',
    seniority: 'SENIOR',
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    url: 'u',
    sourceId: 's1',
    externalId: null,
    publishedAt: null,
    collectedAt: new Date(),
    hash: 'h',
    status: 'DONE',
    sourceCount: 1,
    rawData: null,
    createdById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    skills: skills.map((s, i) => ({ id: `js${i}`, skill: s, required: true })),
  } as never;
}

function perfilCom(skills: Skill[]) {
  return {
    id: 'p1',
    title: 'Engenheiro',
    summary: null,
    yearsExp: 5,
    seniority: 'SENIOR',
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    location: null,
    remotePreference: 'ANY',
    languages: [],
    skills: skills.map((s, i) => ({
      id: `ps${i}`,
      profileId: 'p1',
      skillId: s.id,
      level: 'ADVANCED',
      yearsExp: 3,
      skill: s,
    })),
  } as never;
}

describe('recorte de skills do motor', () => {
  it('encontra sinonimo pelo alias da propria skill da vaga', () => {
    // React.js NÃO está no perfil. O match só acontece porque o recorte inclui
    // as skills da vaga e lê os aliases do alvo.
    const reactjs = skill('1', 'React.js', ['React']);
    const react = skill('2', 'React');

    const r = computeMatchScore(jobCom([reactjs]), perfilCom([react]));
    expect(r.matchedSkills).toContain('React.js');
    expect(r.breakdown.technologies).toBe(100);
  });

  it('encontra sinonimo pelo alias de uma skill DO PERFIL', () => {
    // Aqui o caminho é o outro: a skill do perfil declara o alias da vaga.
    const react = skill('1', 'React', ['React.js']);
    const reactjs = skill('2', 'React.js');

    const r = computeMatchScore(jobCom([reactjs]), perfilCom([react]));
    expect(r.matchedSkills).toContain('React.js');
  });

  it('skill fora da vaga e do perfil vai para missing', () => {
    // Rust não está em nenhum grupo "related" do motor, então não cai em
    // partial como cairia Vue (Vue e React compartilham o grupo de JS).
    const react = skill('1', 'React');
    const rust = skill('2', 'Rust');

    const r = computeMatchScore(jobCom([rust]), perfilCom([react]));
    expect(r.matchedSkills).not.toContain('Rust');
    expect(r.missingSkills).toEqual(['Rust']);
    expect(r.breakdown.technologies).toBe(0);
  });

  it('skill fora do perfil mas em grupo relacionado vai para partial, nao missing', () => {
    // Contrapartida do teste acima: o recorte nao pode confundir "nao casou"
    // com "nao existe". Vue pontua parcial contra um perfil de React.
    const react = skill('1', 'React');
    const vue = skill('2', 'Vue');

    const r = computeMatchScore(jobCom([vue]), perfilCom([react]));
    expect(r.matchedSkills).not.toContain('Vue');
    expect(r.partialSkills).toContain('Vue');
    expect(r.breakdown.technologies).toBe(50);
  });

  it('skills da vaga sem alias e fora do perfil ficam em missing', () => {
    const react = skill('1', 'React');
    const aws = skill('2', 'AWS');

    const r = computeMatchScore(jobCom([aws]), perfilCom([react]));
    expect(r.matchedSkills).toHaveLength(0);
    expect(r.missingSkills).toEqual(['AWS']);
  });

  it('o recorte inclui a skill da vaga mesmo fora do perfil (100, nao parcial)', () => {
    // Este é o teste que trava a armadilha do recorte. Se alguém reduzir o
    // conjunto para SÓ as skills do perfil, o alvo de findSynonymMatch não
    // seria encontrado por id, a função devolveria false em silêncio, e o
    // resultado cairia de 100 para 0 sem nenhuma exceção.
    //
    // Por isso a asserção é no score, e não só em 'matchedSkills conter X':
    // um partial também contaria como match e esconderia a regressão.
    const reactjs = skill('1', 'React.js', ['React']);
    const react = skill('2', 'React');

    const r = computeMatchScore(jobCom([reactjs]), perfilCom([react]));
    expect(r.breakdown.technologies).toBe(100);
    expect(r.partialSkills).toHaveLength(0);
    expect(r.missingSkills).toHaveLength(0);
  });

  it('duplicata entre vaga e perfil nao quebra nada', () => {
    const react = skill('1', 'React');
    const r = computeMatchScore(jobCom([react]), perfilCom([react]));
    expect(r.breakdown.technologies).toBe(100);
  });

  it('score permanece bounded mesmo com recorte vazio', () => {
    const r = computeMatchScore(jobCom([]), perfilCom([]));
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});
