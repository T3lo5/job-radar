import { describe, it, expect } from 'vitest';
import { lerEnumDoSchema } from './schema-enum.js';
import { SENIORITIES, isSeniority, type Seniority } from '../types/seniority.js';
import {
  SENIORITY_LABELS,
  SENIORITY_RANK,
  seniorityLabel,
  maxSeniority,
} from '../utils/seniority-label.js';
import { APPLICATION_STATUSES, isApplicationStatus } from '../types/application.js';
import { JOB_PROCESSING_STATUSES, isJobProcessingStatus } from '../types/job.js';
import { MATCH_CRITERIA } from '../types/match.js';

/**
 * Cada lista deste pacote é comparada com o enum do Prisma.
 *
 * As três primeiras divergiram em algum momento: os valores estavam em
 * português minúsculo ('estagiario', 'encontrada', 'raw') enquanto a API
 * devolvia o enum em caixa alta. Como o pacote não tinha teste, nada acusou.
 */
describe('tipos espelham os enums do Prisma', () => {
  it('SENIORITIES bate com o enum Seniority', () => {
    expect([...SENIORITIES].sort()).toEqual(lerEnumDoSchema('Seniority').sort());
  });

  it('APPLICATION_STATUSES bate com o enum ApplicationStatus', () => {
    expect([...APPLICATION_STATUSES].sort()).toEqual(lerEnumDoSchema('ApplicationStatus').sort());
  });

  it('JOB_PROCESSING_STATUSES bate com o enum JobStatus', () => {
    expect([...JOB_PROCESSING_STATUSES].sort()).toEqual(lerEnumDoSchema('JobStatus').sort());
  });

  it('nao sobrou valor em portugues minusculo', () => {
    // A forma exata do bug antigo. Se alguém reintroduzir, isto pega.
    for (const lista of [SENIORITIES, APPLICATION_STATUSES, JOB_PROCESSING_STATUSES]) {
      for (const valor of lista as readonly string[]) {
        expect(valor).toBe(valor.toUpperCase());
      }
    }
  });

  it('SENIORITY_LABELS cobre todos os valores da senioridade', () => {
    // `Record<Seniority, ...>` já obriga no build; isto é a rede de proteção
    // para quem editar a lista errada.
    for (const s of SENIORITIES) {
      expect(SENIORITY_LABELS[s]).toBeDefined();
      expect(SENIORITY_LABELS[s].label.length).toBeGreaterThan(0);
    }
  });
});

describe('isSeniority aceita o que a API devolve', () => {
  it('aceita os valores do enum', () => {
    expect(isSeniority('SENIOR')).toBe(true);
    expect(isSeniority('MID')).toBe(true);
    expect(isSeniority('UNKNOWN')).toBe(true);
  });

  // Este é o teste que existia para pegar o bug e não pegava: os valores
  // antigos em minúsculo passavam, os novos em caixa alta não.
  it('rejeita o que vier de fora do enum', () => {
    expect(isSeniority('senior')).toBe(false);
    expect(isSeniority('estagiario')).toBe(false);
    expect(isSeniority('pleno')).toBe(false);
    expect(isSeniority('')).toBe(false);
    expect(isSeniority(null)).toBe(false);
    expect(isSeniority(42)).toBe(false);
  });

  it('type Seniority so aceita valores do enum', () => {
    const bom: Seniority = 'SENIOR';
    expect(bom).toBe('SENIOR');
  });
});

describe('seniorityLabel', () => {
  it('traduz os valores do enum', () => {
    expect(seniorityLabel('MID')).toBe('Pleno');
    expect(seniorityLabel('SENIOR')).toBe('Sênior');
    expect(seniorityLabel('JUNIOR')).toBe('Júnior');
  });

  it('trata ausente como N/A em vez de undefined', () => {
    expect(seniorityLabel(null)).toBe('N/A');
    expect(seniorityLabel(undefined)).toBe('N/A');
    expect(seniorityLabel('')).toBe('N/A');
  });

  it('devolve o valor cru se vier algo inesperado', () => {
    // Preferir mostrar 'SPECIALISTA' a mostrar nada: o usuário ainda se orienta.
    expect(seniorityLabel('ESPECIALISTA')).toBe('ESPECIALISTA');
  });
});

describe('maxSeniority', () => {
  it('devolve a maior da lista', () => {
    expect(maxSeniority(['JUNIOR', 'SENIOR'])).toBe('SENIOR');
    expect(maxSeniority(['LEAD'])).toBe('LEAD');
  });

  it('ordem respeita a hierarquia, nao a ordem alfabetica', () => {
    // Alfabeticamente SPECIALIST < SENIOR; na hierarquia é o contrário.
    expect(maxSeniority(['SENIOR', 'SPECIALIST'])).toBe('SPECIALIST');
    expect(SENIORITY_RANK.indexOf('SENIOR')).toBeLessThan(SENIORITY_RANK.indexOf('SPECIALIST'));
  });

  it('ignora nulo e devolve null quando vazia', () => {
    expect(maxSeniority([null, undefined, 'MID'])).toBe('MID');
    expect(maxSeniority([])).toBeNull();
    expect(maxSeniority([null])).toBeNull();
  });
});

describe('guardas das outras listas', () => {
  it('isApplicationStatus aceita o enum', () => {
    expect(isApplicationStatus('FOUND')).toBe(true);
    expect(isApplicationStatus('ARCHIVED')).toBe(true);
    expect(isApplicationStatus('encontrada')).toBe(false);
    expect(isApplicationStatus(null)).toBe(false);
  });

  it('isJobProcessingStatus aceita o enum', () => {
    expect(isJobProcessingStatus('DONE')).toBe(true);
    expect(isJobProcessingStatus('FAILED')).toBe(true);
    expect(isJobProcessingStatus('done')).toBe(false);
    expect(isJobProcessingStatus(undefined)).toBe(false);
  });
});

describe('MATCH_CRITERIA nao promete campo morto', () => {
  // A completude entre MATCH_CRITERIA e MatchBreakdown é garantida em tempo de
  // compilação pelo `satisfies` na declaração. Em runtime não há o que medir
  // sem duplicar a lista, e um teste tautológico aqui só daria falsa confiança.
  it('lista os criterios que o motor realmente produz', () => {
    // `other` foi removido na Sprint D (era um criterio que ninguem calculava e
    // inflava o score). Este tipo ainda o declarava.
    expect(MATCH_CRITERIA).not.toContain('other' as never);
    expect(MATCH_CRITERIA).toEqual([
      'technologies',
      'experience',
      'seniority',
      'location',
      'cloudDevOps',
      'languages',
    ]);
  });
});
