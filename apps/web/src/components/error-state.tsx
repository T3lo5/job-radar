import { AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils/cn';
import { Button } from './ui/button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  error?: unknown;
  onRetry?: () => void;
  /** Versão compacta para erros de dados secundários dentro de um card. */
  compact?: boolean;
  className?: string;
}

function technicalDetail(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return null;
}

/**
 * Estado de erro de uma consulta.
 *
 * Existe para impedir o padrão antigo: quando a API falhava, a página caía no
 * empty state e dizia "nenhuma vaga", "nenhum CV", "total: 0". O usuário agia
 * sobre uma mentira — recadastrava CV, refazia setup, concluía que a coleta não
 * tinha rodado. A regra de renderização é: pending → skeleton; error →
 * ErrorState; vazio → empty state.
 */
export function ErrorState({
  title = 'Não foi possível carregar os dados',
  message = 'A API não respondeu. Verifique sua conexão ou tente novamente em instantes.',
  error,
  onRetry,
  compact = false,
  className,
}: ErrorStateProps) {
  const detail = technicalDetail(error);

  if (compact) {
    return (
      <div
        role="alert"
        className={cn(
          'flex items-center justify-between gap-3 rounded-md border border-error/30 bg-error/5 px-3 py-2 text-sm',
          className,
        )}
      >
        <span className="flex items-center gap-2 text-error">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {title}
        </span>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
            Tentar de novo
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-error/30 bg-error/5 px-6 py-10 text-center',
        className,
      )}
    >
      <AlertTriangle className="mb-3 h-10 w-10 text-error" aria-hidden="true" />
      <h3 className="mb-1 text-lg font-semibold">{title}</h3>
      <p className="mb-4 max-w-md text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="primary" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Tentar de novo
        </Button>
      )}
      {detail && (
        <details className="mt-4 w-full max-w-lg text-left">
          <summary className="cursor-pointer text-xs text-muted-foreground">
            Detalhes técnicos
          </summary>
          <pre className="mt-2 overflow-x-auto rounded bg-surface-2 p-2 text-xs text-muted-foreground">
            {detail}
          </pre>
        </details>
      )}
    </div>
  );
}
