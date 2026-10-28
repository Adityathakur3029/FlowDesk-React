import { Component, type ReactNode } from 'react'
import { ErrorState } from './ErrorState'

interface RouteErrorBoundaryProps {
  children: ReactNode
}

interface RouteErrorBoundaryState {
  error: unknown
}

// Catches render errors in a page so the shell around it keeps working. Give it key={pathname} to reset
// on navigation. API errors aren't thrown here: each query renders its own ErrorState.
// No componentDidCatch: React 19 already reports caught errors to the console.
export class RouteErrorBoundary extends Component<RouteErrorBoundaryProps, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: unknown): RouteErrorBoundaryState {
    return { error: error ?? new Error('Unknown render error') }
  }

  render() {
    if (this.state.error === null) return this.props.children
    return (
      <div className="flex flex-col items-center">
        <ErrorState error={this.state.error} title="This page crashed" onRetry={() => window.location.reload()} />
      </div>
    )
  }
}
