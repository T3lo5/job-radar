/**
 * "Mover para…" de um card do Kanban.
 *
 * Um `<select>` nativo de propósito: funciona com teclado (setas + Enter),
 * leitor de tela anuncia a opção atual e não exige uma biblioteca de menu.
 * Antes, a única forma de mudar o status era arrastar com o mouse.
 */
export interface MoveOption {
  id: string;
  title: string;
}

export interface MoveSelectProps {
  applicationId: string;
  applicationTitle: string;
  current: string;
  options: MoveOption[];
  onMove: (status: string) => void;
}

export function MoveSelect({
  applicationId,
  applicationTitle,
  current,
  options,
  onMove,
}: MoveSelectProps) {
  const id = `mover-${applicationId}`;
  const atual = options.find((o) => o.id === current)?.title ?? current;

  return (
    <div
      // O clique não pode abrir o detalhe nem iniciar o arraste do card.
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <label htmlFor={id} className="mb-1 block text-[11px] font-medium text-muted-foreground">
        Mover para…
      </label>
      <select
        id={id}
        value={current}
        aria-label={`Mover ${applicationTitle} para outra coluna. Coluna atual: ${atual}.`}
        onChange={(e) => {
          if (e.target.value !== current) onMove(e.target.value);
        }}
        className="h-11 w-full rounded-[var(--radius-sm)] border border-border bg-surface px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.title}
          </option>
        ))}
      </select>
    </div>
  );
}
