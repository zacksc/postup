import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] erro não capturado:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="w-full max-w-sm text-center flex flex-col items-center gap-4">
            <div className="bg-destructive/10 text-destructive rounded-2xl p-4 flex items-center justify-center">
              <AlertTriangle size={28} />
            </div>
            <div className="grid gap-1">
              <h1 className="text-lg font-bold">Algo deu errado</h1>
              <p className="text-sm text-muted-foreground">Ocorreu um erro inesperado. Recarregue a página para continuar.</p>
            </div>
            <p className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2 break-words">
              {this.state.error.message}
            </p>
            <Button onClick={() => window.location.reload()} className="gap-2">
              <RefreshCw size={16} />
              Recarregar a página
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
