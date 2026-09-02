import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from './ui/button'
import { AlertCircle } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onRetry?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined })
    this.props.onRetry?.()
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return <>{this.props.fallback}</>
      }
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-error/10 p-3 mb-4">
            <AlertCircle className="h-6 w-6 text-error" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Algo deu errado</h3>
          <p className="text-muted-foreground text-sm mb-4 max-w-md">
            Não foi possível carregar esta página. Tente novamente ou contate o suporte.
          </p>
          <Button variant="outline" onClick={this.handleRetry}>
            Tentar novamente
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
