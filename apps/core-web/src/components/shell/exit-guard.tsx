import { Component, type ErrorInfo, type ReactNode } from 'react'

export interface ExitGuardProps {
  /** True while the shell plays its M-APP-02 exit after a sign-out. */
  leaving: boolean
  children: ReactNode
}

interface ExitGuardState {
  error: unknown
}

/**
 * Keeps the M-APP-02 exit safe (step 41). After a sign-out the page stays mounted for the ≈ 280 ms
 * exit, but it may no longer find an operator. An error thrown while leaving hides the page
 * instead of replacing the whole screen with the root error view; any other error is passed on
 * unchanged to the router's error boundary.
 */
export class ExitGuard extends Component<ExitGuardProps, ExitGuardState> {
  override state: ExitGuardState = { error: null }

  static getDerivedStateFromError(error: unknown): ExitGuardState {
    return { error }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    if (this.props.leaving && import.meta.env.DEV) {
      // No client-log endpoint exists on mock-core (D3/D4, D41(g)); dev console only.
      console.warn('[core-web] page hidden during sign-out exit', {
        level: 'warn',
        source: 'shell.ExitGuard',
        message: error instanceof Error ? error.message : String(error),
        componentStack: info.componentStack,
      })
    }
  }

  override render() {
    if (this.state.error !== null) {
      if (this.props.leaving) return null
      throw this.state.error
    }
    return this.props.children
  }
}
