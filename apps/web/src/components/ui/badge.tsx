import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '../../lib/utils/cn'

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'success'
  | 'warning'
  | 'error'
  | 'outline'

const Badge = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { variant?: BadgeVariant }>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variantClasses = {
      default: 'bg-surface-2 text-foreground',
      primary: 'bg-accent/10 text-accent',
      success: 'bg-success/10 text-success',
      warning: 'bg-warning/10 text-warning',
      error: 'bg-error/10 text-error',
      outline: 'border border-border text-foreground',
    }[variant]

    return (
      <div
        className={cn(
          'inline-flex items-center rounded-[var(--radius-full)] px-2 py-0.5 text-xs font-medium',
          variantClasses,
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Badge.displayName = 'Badge'

export { Badge }
