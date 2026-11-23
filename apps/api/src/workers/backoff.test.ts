import { describe, expect, it } from 'vitest';
import { BACKOFF_BASE_MS, BACKOFF_MAX_MS, backoffWithJitter, MAX_ATTEMPTS } from './backoff.js';

describe('backoffWithJitter', () => {
  it('cresce exponencialmente a partir da base', () => {
    // random() = 0 devolve o piso (metade do exponencial).
    expect(backoffWithJitter(1, () => 0)).toBe(BACKOFF_BASE_MS / 2);
    expect(backoffWithJitter(2, () => 0)).toBe(BACKOFF_BASE_MS);
    expect(backoffWithJitter(3, () => 0)).toBe(BACKOFF_BASE_MS * 2);
  });

  it('aplica jitter entre 50% e 100% do intervalo', () => {
    const piso = backoffWithJitter(3, () => 0);
    const teto = backoffWithJitter(3, () => 1);

    expect(piso).toBe(BACKOFF_BASE_MS * 2);
    expect(teto).toBe(BACKOFF_BASE_MS * 4);
    expect(backoffWithJitter(3)).toBeGreaterThanOrEqual(piso);
    expect(backoffWithJitter(3)).toBeLessThanOrEqual(teto);
  });

  it('nunca passa do teto', () => {
    for (const tentativa of [1, 2, 3, 5, 20, 100]) {
      expect(backoffWithJitter(tentativa, () => 1)).toBeLessThanOrEqual(BACKOFF_MAX_MS);
    }
  });

  it('tentativa zero ou negativa não vira delay negativo/zero', () => {
    expect(backoffWithJitter(0, () => 0)).toBe(BACKOFF_BASE_MS / 2);
    expect(backoffWithJitter(-3, () => 0)).toBe(BACKOFF_BASE_MS / 2);
  });

  it('mantém o limite de tentativas documentado', () => {
    expect(MAX_ATTEMPTS).toBe(3);
  });
});
