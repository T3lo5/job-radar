import * as SelectPrimitive from '@radix-ui/react-select'
import { forwardRef, type ComponentRef } from 'react'
import { cn } from '../../lib/utils/cn'
import { ChevronDown } from 'lucide-react'

const Select = SelectPrimitive.Root

const SelectTrigger = forwardRef<
  ComponentRef<typeof SelectPrimitive.Trigger>,
  SelectPrimitive.SelectTriggerProps
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger ref={ref} asChild {...props}>
    <button
      type="button"
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-[var(--radius-sm)] border border-border bg-surface px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
    >
      {children}
      <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
    </button>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = 'SelectTrigger'

const SelectValue = forwardRef<
  ComponentRef<typeof SelectPrimitive.Value>,
  SelectPrimitive.SelectValueProps
>(({ className, placeholder, ...props }, ref) => (
  <SelectPrimitive.Value ref={ref} placeholder={placeholder} className={className} {...props} />
))
SelectValue.displayName = 'SelectValue'

const SelectContent = forwardRef<
  ComponentRef<typeof SelectPrimitive.Content>,
  SelectPrimitive.SelectContentProps
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      sideOffset={4}
      className={cn(
        'z-50 min-w-32 overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface text-foreground shadow-lg',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.Viewport>
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = 'SelectContent'

const SelectItem = forwardRef<
  ComponentRef<typeof SelectPrimitive.Item>,
  SelectPrimitive.SelectItemProps
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-default select-none items-center rounded px-2 py-1.5 text-sm outline-none',
      'focus:bg-surface-2 focus:text-foreground',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      '[&_[data-radix-select-item-text]]:leading-none',
      className,
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = 'SelectItem'

const SelectItemText = SelectPrimitive.ItemText
const SelectItemIndicator = SelectPrimitive.ItemIndicator

export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectItemIndicator,
}
