import { describe, it, expect } from 'vitest';
import { createLocationFilter } from './location-filter.js';

// Regressão da Sprint D: o filtro descartava por padrão "Remote - Worldwide" e
// "Anywhere" — justamente as vagas que um buscador remoto mais valoriza.
// Agora a modalidade vem do perfil (profile.remotePreference).

describe('createLocationFilter com modalidade', () => {
  it('respeita a exclusão por país mesmo em vaga remota', () => {
    // "Remote - Ukraine" exige morar lá; a modalidade remota não pode
    // furar a lista de países excluídos.
    const f = createLocationFilter(null, 'ANY');
    expect(f.isAllowed('Remote - Ukraine', '', 'remote')).toBe(false);
    expect(f.isAllowed('Poland - Remote', '', 'remote')).toBe(false);
    // já o remoto sem paísrestrictionado continua passando
    expect(f.isAllowed('Remote - Worldwide', '', 'remote')).toBe(true);
    expect(f.isAllowed('Anywhere', '', 'remote')).toBe(true);
    expect(f.isAllowed('', 'Fully remote', 'remote')).toBe(true);
  });

  it('aceita vaga remota em qualquer país por padrão', () => {
    for (const pref of [null, 'ANY', 'REMOTE', 'HYBRID']) {
      const f = createLocationFilter(null, pref);
      expect(f.isAllowed('Remote - Worldwide', '', 'remote')).toBe(true);
      expect(f.isAllowed('Anywhere', '', 'remote')).toBe(true);
      expect(f.isAllowed('', 'Fully remote role', 'remote')).toBe(true);
    }
  });

  it('ON_SITE exclui remoto mas aceita local', () => {
    const f = createLocationFilter(null, 'ON_SITE');
    expect(f.isAllowed('Remote - Worldwide', '', 'remote')).toBe(false);
    expect(f.isAllowed('Anywhere', '', 'remote')).toBe(false);
    expect(f.isAllowed('São Paulo, SP', '', 'on_site')).toBe(true);
    expect(f.isAllowed('Hibrido - SP', '', 'hybrid')).toBe(true);
  });

  it('mantém a exclusão de países fora da lista de interesse', () => {
    const f = createLocationFilter(null, 'ANY');
    expect(f.isAllowed('Berlin', '', 'on_site')).toBe(false);
  });

  it('aceita híbrido sem cidade quando remoto é aceito', () => {
    const f = createLocationFilter(null, 'ANY');
    expect(f.isAllowed('', 'Modelo híbrido', 'hybrid')).toBe(true);
  });

  it('respeita a lista de países digitada no perfil', () => {
    // A lista de países libera contém nomes de país, não de cidade: o filtro
    // casa por substring, então "Portugal" passa e "São Paulo" não.
    const f = createLocationFilter('Portugal, Espanha', 'ANY');
    expect(f.isAllowed('Portugal', '', 'on_site')).toBe(true);
    expect(f.isAllowed('Espanha - Madri', '', 'on_site')).toBe(true);
    expect(f.isAllowed('São Paulo, SP', '', 'on_site')).toBe(false);
    // remoto continua passando, que é o combinado
    expect(f.isAllowed('Anywhere', '', 'remote')).toBe(true);
  });
});
