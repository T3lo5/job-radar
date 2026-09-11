import { type ReactNode } from 'react';
import { cn } from '../lib/utils/cn';
import { Button } from './ui/button';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  actionLabel?: string;
  actionHref?: string;
  actionOnClick?: () => void;
  variant?: 'default' | 'illustrated';
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  actionLabel,
  actionHref,
  actionOnClick,
  variant = 'default',
  className,
}: EmptyStateProps) {
  const hasAction = action || actionLabel;

  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      {icon && (
        <div
          className={cn('mb-4 text-muted-foreground/50', variant === 'illustrated' && 'opacity-60')}
        >
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      {description && <p className="text-muted-foreground text-sm mb-6 max-w-md">{description}</p>}
      {hasAction && (
        <div className="flex items-center justify-center gap-2">
          {actionHref ? (
            <Button variant="primary" asChild>
              <a href={actionHref}>{actionLabel}</a>
            </Button>
          ) : actionOnClick ? (
            <Button variant="primary" onClick={actionOnClick}>
              {actionLabel}
            </Button>
          ) : action ? (
            action
          ) : null}
        </div>
      )}
    </div>
  );
}
