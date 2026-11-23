import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MoveSelect, type MoveOption } from './move-select';

// Sem Testing Library, `act` do React precisa desta flag para não avisar.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const OPTIONS: MoveOption[] = [
  { id: 'FOUND', title: 'Encontrada' },
  { id: 'APPLIED', title: 'Aplicada' },
  { id: 'INTERVIEW', title: 'Entrevista' },
  { id: 'OFFER', title: 'Oferta' },
];

let container: HTMLDivElement | null = null;

function render(onMove: (status: string) => void, current = 'APPLIED') {
  container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <MoveSelect
        applicationId="app-1"
        applicationTitle="Engenheira de Software"
        current={current}
        options={OPTIONS}
        onMove={onMove}
      />,
    );
  });
  return container;
}

afterEach(() => {
  act(() => {
    container?.remove();
  });
  container = null;
});

describe('MoveSelect — mover sem mouse', () => {
  it('lista todas as colunas e reflete a atual', () => {
    render(() => {});
    const select = container!.querySelector('select')!;

    expect([...select.options].map((o) => o.value)).toEqual([
      'FOUND',
      'APPLIED',
      'INTERVIEW',
      'OFFER',
    ]);
    expect(select.value).toBe('APPLIED');
  });

  it('tem label visível e nome acessível com a coluna atual', () => {
    render(() => {});
    const label = container!.querySelector('label')!;
    const select = container!.querySelector('select')!;

    expect(label.textContent).toContain('Mover para');
    expect(label.htmlFor).toBe(select.id);
    expect(select.getAttribute('aria-label')).toContain('Coluna atual: Aplicada');
  });

  it('escolher outra coluna dispara a mudança (caminho do teclado)', () => {
    const onMove = vi.fn();
    render(onMove);
    const select = container!.querySelector('select')!;

    act(() => {
      select.value = 'INTERVIEW';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(onMove).toHaveBeenCalledWith('INTERVIEW');
  });

  it('não dispara quando a coluna escolhida é a atual', () => {
    const onMove = vi.fn();
    render(onMove);
    const select = container!.querySelector('select')!;

    act(() => {
      select.value = 'APPLIED';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(onMove).not.toHaveBeenCalled();
  });
});
