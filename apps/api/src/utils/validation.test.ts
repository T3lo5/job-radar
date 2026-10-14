import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { dataOpcional } from './validation.js';

describe('dataOpcional', () => {
  const schema = z.object({ inicio: dataOpcional, fim: dataOpcional });

  it('aceita string vazia como ausente (input date vazio)', () => {
    // Este é o bug: `<Input type="date">` vazio manda `''`, e `z.coerce.date`
    // puro transforma em Data Inválida — o PUT respondia 400 e a edição de
    // experiência importada do CV "não salvava".
    const r = schema.safeParse({ inicio: '', fim: '' });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ inicio: undefined, fim: undefined });
  });

  it('mantem ausente como ausente (PUT parcial nao apaga)', () => {
    const r = schema.safeParse({});
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ inicio: undefined, fim: undefined });
  });

  it('null explicito continua significando limpar', () => {
    const r = schema.safeParse({ inicio: null });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ inicio: null, fim: undefined });
  });

  it('aceita ISO e yyyy-mm-dd', () => {
    const r = schema.safeParse({ inicio: '2020-01-15T00:00:00.000Z', fim: '2021-06-30' });
    expect(r.success).toBe(true);
    expect(r.data?.inicio).toBeInstanceOf(Date);
    expect(r.data?.fim).toBeInstanceOf(Date);
  });

  it('rejeita texto que nao e data', () => {
    expect(schema.safeParse({ inicio: 'ontem' }).success).toBe(false);
  });
});
