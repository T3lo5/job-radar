import { useState, useCallback, useEffect, type ReactNode } from 'react'
import * as ToastPrimitive from '@radix-ui/react-toast'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils/cn'

type ToastVariant = 'default' | 'success' | 'error' | 'warning'

interface ToastData {
  id: string
  title?: string
  description?: string
  variant: ToastVariant
}

const TOAST_LIMIT = 5
const TOAST_REMOVE_DELAY = 5000

let toastCount = 0

const toastState: {
  listeners: Set<(toasts: ToastData[]) => void>
  toasts: ToastData[]
} = {
  listeners: new Set(),
  toasts: [],
}

export function toast({
  title,
  description,
  variant = 'default',
}: {
  title?: string
  description?: string
  variant?: ToastVariant
}) {
  const id = `toast-${toastCount++}`
  const newToast: ToastData = { id, title, description, variant }

  toastState.toasts = [...toastState.toasts.slice(-TOAST_LIMIT + 1), newToast]
  toastState.listeners.forEach((l) => l(toastState.toasts))

  setTimeout(() => {
    toastState.toasts = toastState.toasts.filter((t) => t.id !== id)
    toastState.listeners.forEach((l) => l(toastState.toasts))
  }, TOAST_REMOVE_DELAY)
}

toast.success = (message: string | { title?: string; description?: string }) =>
  typeof message === 'string'
    ? toast({ title: message, variant: 'success' })
    : toast({ ...message, variant: 'success' })
toast.error = (message: string | { title?: string; description?: string }) =>
  typeof message === 'string'
    ? toast({ title: message, variant: 'error' })
    : toast({ ...message, variant: 'error' })
toast.warning = (message: string | { title?: string; description?: string }) =>
  typeof message === 'string'
    ? toast({ title: message, variant: 'warning' })
    : toast({ ...message, variant: 'warning' })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([])

  const updateToasts = useCallback((newToasts: ToastData[]) => {
    setToasts(newToasts)
  }, [])

  const removeToast = useCallback((id: string) => {
    toastState.toasts = toastState.toasts.filter((t) => t.id !== id)
    toastState.listeners.forEach((l) => l(toastState.toasts))
  }, [])

  useEffect(() => {
    toastState.listeners.add(updateToasts)
    return () => {
      toastState.listeners.delete(updateToasts)
    }
  }, [updateToasts])

  return (
    <ToastPrimitive.Provider>
      {children}
      <ToastPrimitive.ToastViewport className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-96">
        {toasts.map((t) => (
          <ToastPrimitive.Root
            key={t.id}
            className={cn(
              'group pointer-events-auto relative flex w-full items-center gap-3 overflow-hidden rounded-[var(--radius-md)] border px-4 py-3 text-sm shadow-lg',
              'data-[swipe=down]:animate-slide-out-down data-[swipe=up]:animate-slide-out-up',
              t.variant === 'success' && 'border-success bg-success/10 text-success',
              t.variant === 'error' && 'border-error bg-error/10 text-error',
              t.variant === 'warning' && 'border-warning bg-warning/10 text-warning',
              t.variant === 'default' && 'border-border bg-surface text-foreground',
            )}
          >
            <div className="flex-1">
              {t.title && <div className="font-medium">{t.title}</div>}
              {t.description && <div className="text-sm opacity-90">{t.description}</div>}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="shrink-0 rounded p-1 text-current opacity-60 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
            <ToastPrimitive.Close asChild />
          </ToastPrimitive.Root>
        ))}
      </ToastPrimitive.ToastViewport>
    </ToastPrimitive.Provider>
  )
}

export const useToast = toast
