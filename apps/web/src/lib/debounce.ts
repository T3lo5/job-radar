import { useEffect, useRef, useState } from 'react';

/**
 * Debounce de valor para a busca de vagas.
 *
 * Antes, cada tecla disparava uma request e trocava a lista por skeleton. O
 * núcleo é uma função pura (testável com timers fake): agenda, cancela o
 * agendamento anterior e aplica só o último valor depois da pausa.
 */

export interface TimerApi {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

const timersReais: TimerApi = {
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export interface Debouncer<T> {
  /** (Re)agenda `value`; só o último sobrevive à pausa. */
  schedule(value: T): void;
  /** Desiste do agendamento pendente. */
  cancel(): void;
}

export function createDebouncer<T>(
  delay: number,
  apply: (value: T) => void,
  timers: TimerApi = timersReais,
): Debouncer<T> {
  let handle: unknown = null;

  return {
    schedule(value) {
      if (handle !== null) timers.clearTimeout(handle);
      handle = timers.setTimeout(() => {
        handle = null;
        apply(value);
      }, delay);
    },
    cancel() {
      if (handle !== null) timers.clearTimeout(handle);
      handle = null;
    },
  };
}

/** Valor que só acompanha a entrada depois de `delay` ms sem mudanças. */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  const debouncer = useRef<Debouncer<T> | null>(null);

  if (debouncer.current === null) {
    debouncer.current = createDebouncer(delay, setDebounced);
  }

  useEffect(() => {
    debouncer.current?.schedule(value);
  }, [value]);

  // Desmontou: não deixa timer pendente chamando setState.
  useEffect(() => () => debouncer.current?.cancel(), []);

  return debounced;
}
