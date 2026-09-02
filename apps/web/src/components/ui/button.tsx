import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '../../lib/utils/cn'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  asChild?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(
          'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color_120ms_ease-out,border-color_120ms_ease-out,color_120ms_ease-out,transform_120ms_ease-out] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
          {
            'bg-accent text-accent-foreground hover:bg-accent/90': variant === 'primary',
            'bg-surface-2 text-foreground hover:bg-surface-2/80': variant === 'secondary',
            'border border-border bg-transparent hover:bg-surface/50': variant === 'outline',
            'hover:bg-surface-2 hover:text-foreground': variant === 'ghost',
            'bg-error text-error-foreground hover:bg-error/90': variant === 'danger',
          },
          {
            'h-9 rounded-[var(--radius-sm)] px-3 text-sm': size === 'sm',
            'h-10 rounded-[var(--radius-sm)] px-4 text-sm': size === 'md',
            'h-11 rounded-[var(--radius-sm)] px-6 text-base': size === 'lg',
            'h-9 w-9 rounded-[var(--radius-sm)]': size === 'icon',
          },
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)

Button.displayName = 'Button'

export { Button }
