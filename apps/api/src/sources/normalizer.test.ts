import { describe, it, expect } from 'vitest';
import { parseSalary, parseRemoteMode, normalizeJobFields } from './normalizer.js';

describe('parseSalary', () => {
  it('não infla salário brasileiro em 100x', () => {
    // Regressão: "R$ 8.000,00" virava 800000 porque vírgula E ponto eram
    // removidos, e o ".00" das centavos virava milhar.
    expect(parseSalary('R$ 8.000,00 - 12.000,00')).toEqual({
      min: 8000,
      max: 12000,
      currency: 'BRL',
    });
    expect(parseSalary('R$ 1.200,00').min).toBe(1200);
    expect(parseSalary('R$ 12.000,50').min).toBe(12000.5);
  });

  it('aceita valor único (antes era descartado)', () => {
    expect(parseSalary('R$ 10.000')).toEqual({ min: 10000, max: null, currency: 'BRL' });
    expect(parseSalary('Salary: $90,000')).toEqual({
      min: 90000,
      max: null,
      currency: 'USD',
    });
  });

  it('aceita sufixo k', () => {
    expect(parseSalary('$100k - $120k')).toEqual({
      min: 100000,
      max: 120000,
      currency: 'USD',
    });
    expect(parseSalary('50k-70k').min).toBe(50000);
  });

  it('aceita símbolo da moeda antes e entre os números', () => {
    expect(parseSalary('R$ 1.500 - R$ 2.500')).toEqual({
      min: 1500,
      max: 2500,
      currency: 'BRL',
    });
    expect(parseSalary('80.000 € - 100.000 €')).toEqual({
      min: 80000,
      max: 100000,
      currency: 'EUR',
    });
  });

  it('ordena min e max quando vêm invertidos', () => {
    expect(parseSalary('$120k - $80k')).toEqual({
      min: 80000,
      max: 120000,
      currency: 'USD',
    });
  });

  it('devolve null para entrada sem número', () => {
    expect(parseSalary('a combinar')).toEqual({ min: null, max: null, currency: null });
    expect(parseSalary('')).toEqual({ min: null, max: null, currency: null });
    expect(parseSalary(undefined)).toEqual({ min: null, max: null, currency: null });
  });
});

describe('parseRemoteMode', () => {
  it('reconhece remoto em pt-BR e en', () => {
    expect(parseRemoteMode('Remote - Worldwide')).toBe('remote');
    expect(parseRemoteMode('Remoto')).toBe('remote');
    expect(parseRemoteMode('100% remoto')).toBe('remote');
  });

  it('reconhece híbrido COM e SEM acento', () => {
    // Regressão: 'hibrido' sem acento caía no default e virava on_site.
    expect(parseRemoteMode('Híbrido')).toBe('hybrid');
    expect(parseRemoteMode('Hibrido')).toBe('hybrid');
  });

  it('reconhece presencial', () => {
    expect(parseRemoteMode('Presencial')).toBe('on_site');
    expect(parseRemoteMode('On-site')).toBe('on_site');
  });

  it('devolve unknown em vez de inventar presencial', () => {
    // Assumir on_site inventava informação: o matching trata unknown como
    // "não sabemos", que é o truthful.
    expect(parseRemoteMode('São Paulo, SP')).toBe('unknown');
    expect(parseRemoteMode('berlin')).toBe('unknown');
    expect(parseRemoteMode('')).toBe('unknown');
  });

  it('usa as tags quando a location não informa a modalidade', () => {
    // RemoteOK marca tags ['remote'] e costuma mandar location vazio.
    expect(parseRemoteMode('', ['remote'])).toBe('remote');
    expect(parseRemoteMode('', ['REMOTE', 'senior'])).toBe('remote');
    expect(parseRemoteMode('', ['onsite'])).toBe('on_site');
  });
});

describe('normalizeJobFields', () => {
  const base = {
    title: 'Dev',
    company: 'X',
    description: 'd',
    location: null,
    url: 'http://x/1',
  };

  it('deriva remote das tags quando location está vazia', () => {
    const job = normalizeJobFields({ ...base, location: '', tags: ['remote'] });
    expect(job.remote).toBe('remote');
  });

  it('sanitiza HTML da descrição', () => {
    const job = normalizeJobFields({
      ...base,
      description: '<p>ok</p><script>alert(1)</script>',
    });
    expect(job.description).not.toContain('<script>');
    expect(job.description).toContain('<p>ok</p>');
  });
});
