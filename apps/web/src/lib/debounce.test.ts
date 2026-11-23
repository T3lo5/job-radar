import { describe, it, expect, vi, afterEach } from 'vitest';
import { createDebouncer } from './debounce';

afterEach(() => {
  vi.useRealTimers();
});

describe('createDebouncer', () => {
  it('10 tecladas seguidas aplicam só o último valor, uma vez', () => {
    vi.useFakeTimers();
    const aplicados: string[] = [];
    const d = createDebouncer(300, (v: string) => aplicados.push(v));

    for (const texto of ['r', 're', 'rea', 'reac', 'react', 'react ', 'react j', 'react js']) {
      d.schedule(texto);
    }

    expect(aplicados).toEqual([]);
    vi.advanceTimersByTime(299);
    expect(aplicados).toEqual([]);

    vi.advanceTimersByTime(1);
    expect(aplicados).toEqual(['react js']);
  });

  it('cada pausa realmente separada aplica de novo', () => {
    vi.useFakeTimers();
    const aplicados: string[] = [];
    const d = createDebouncer(300, (v: string) => aplicados.push(v));

    d.schedule('react');
    vi.advanceTimersByTime(300);
    d.schedule('node');
    vi.advanceTimersByTime(300);

    expect(aplicados).toEqual(['react', 'node']);
  });

  it('cancel não chama o callback pendente', () => {
    vi.useFakeTimers();
    const aplicados: string[] = [];
    const d = createDebouncer(300, (v: string) => aplicados.push(v));

    d.schedule('react');
    d.cancel();
    vi.advanceTimersByTime(1000);

    expect(aplicados).toEqual([]);
  });
});
