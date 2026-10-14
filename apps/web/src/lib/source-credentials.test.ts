import { describe, it, expect } from 'vitest';
import { sourceNeedsCredentials } from './source-credentials';

describe('sourceNeedsCredentials', () => {
  it('marca as fontes que pedem token', () => {
    expect(sourceNeedsCredentials('linkedin-apify')).toBe(true);
    expect(sourceNeedsCredentials('adzuna')).toBe(true);
  });

  it('NÃO marca o LinkedIn público', () => {
    // Regressão: o `linkedin` usa a API guest, sem credencial, mas aparecia
    // com o selo "Requer credenciais" — e o usuário procurava onde configurar
    // algo que não existe.
    expect(sourceNeedsCredentials('linkedin')).toBe(false);
  });

  it('não marca fontes abertas', () => {
    for (const id of [
      'remoteok',
      'remotive',
      'google-jobs',
      'indeed',
      'jobicy',
      'weworkremotely',
    ]) {
      expect(sourceNeedsCredentials(id)).toBe(false);
    }
  });

  it('não marca id desconhecido', () => {
    expect(sourceNeedsCredentials('fonte-nova')).toBe(false);
    expect(sourceNeedsCredentials('')).toBe(false);
  });
});
