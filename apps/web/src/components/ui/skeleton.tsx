import { forwardRef, type HTMLAttributes } from 'react'
import { cn } from '../../lib/utils/cn'

const Skeleton = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      className={cn('rounded-[var(--radius-sm)] bg-surface-2 animate-shimmer', className)}
      ref={ref}
      {...props}
    />
  ),
)
Skeleton.displayName = 'Skeleton'

export { Skeleton }
