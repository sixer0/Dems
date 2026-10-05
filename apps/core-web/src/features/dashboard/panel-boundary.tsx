import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@heroui/react'
import { TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { RETRY_MAX_ATTEMPTS } from '@dems/shared/realtime'
import { reportDashboardError } from './report'

/** Retry cooldown after each attempt: 3 s → 6 s → 12 s (capped at 15 s), as `useRetryCooldown`. */
const RETRY_BASE_MS = 3000
const RETRY_MAX_WAIT_MS = 15_000

interface PanelBoundaryProps {
  /** Panel letter, for the structured log entry. */
  panel: string
  children: ReactNode
}

interface PanelBoundaryState {
  error: unknown
  /** Retries used so far; the children remount fresh on each one. */
  attempt: number
  /** Wall-clock time before which the next retry is not allowed. */
  nextRetryAt: number
}

/**
 * One panel's render errors stay inside that panel (frontend error handling: user feedback,
 * logging, graceful degradation). The fallback names the problem in plain words, keeps the rest
 * of the Dashboard working, and offers a rate-limited retry: at most 3 retries, 3 s → 6 s → 12 s
 * apart, with a countdown on the disabled button. The count lives in the boundary, so a panel
 * that fails again at once cannot be retried faster than the cooldown allows.
 *
 * Logging: mock-core has no client-log endpoint (D3/D4, D41(g)). Since plan row W63 the error is
 * one record in the page's own log (`report.ts` → `webErrorSink`: in memory in every build, printed
 * to the development console as before), named by its class, code and status and never by its
 * text (CPW1-8); nothing personal is logged.
 */
export class PanelBoundary extends Component<PanelBoundaryProps, PanelBoundaryState> {
  override state: PanelBoundaryState = { error: null, attempt: 0, nextRetryAt: 0 }

  static getDerivedStateFromError(error: unknown): Partial<PanelBoundaryState> {
    return { error }
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    reportDashboardError(`features/dashboard.panel-${this.props.panel}`, error, 'A Dashboard panel failed to render and shows its fallback.', {
      panel: this.props.panel,
      attempt: this.state.attempt,
      // Component names only: no value of the page.
      componentStack: info.componentStack ?? null,
    })
  }

  private readonly retry = () => {
    this.setState((state) => {
      if (state.attempt >= RETRY_MAX_ATTEMPTS || Date.now() < state.nextRetryAt) return null
      const wait = Math.min(RETRY_BASE_MS * 2 ** state.attempt, RETRY_MAX_WAIT_MS)
      return { error: null, attempt: state.attempt + 1, nextRetryAt: Date.now() + wait }
    })
  }

  override render() {
    const { error, attempt, nextRetryAt } = this.state
    if (error !== null) {
      return <PanelFallback attempt={attempt} nextRetryAt={nextRetryAt} onRetry={this.retry} />
    }
    return <PanelAttempt key={attempt}>{this.props.children}</PanelAttempt>
  }
}

function PanelAttempt({ children }: { children: ReactNode }) {
  return <>{children}</>
}

function secondsUntil(at: number): number {
  return Math.max(0, Math.ceil((at - Date.now()) / 1000))
}

function PanelFallback({ attempt, nextRetryAt, onRetry }: { attempt: number; nextRetryAt: number; onRetry: () => void }) {
  const { t } = useTranslation()
  const [cooldown, setCooldown] = useState(() => secondsUntil(nextRetryAt))
  useEffect(() => {
    if (secondsUntil(nextRetryAt) === 0) return undefined
    const id = setInterval(() => {
      const left = secondsUntil(nextRetryAt)
      setCooldown(left)
      if (left === 0) clearInterval(id)
    }, 250)
    return () => clearInterval(id)
  }, [nextRetryAt])
  const exhausted = attempt >= RETRY_MAX_ATTEMPTS

  return (
    <div role="alert" data-testid="dashboard-panel-fallback" className="flex h-full min-h-0 flex-col items-start justify-center gap-2 p-1">
      <div className="flex items-center gap-2 text-warning-soft-foreground">
        <TriangleAlert aria-hidden="true" size={16} />
        <span className="text-body font-semibold">{t('common.errors.panelTitle')}</span>
      </div>
      <p className="text-caption text-muted">{t('common.errors.panelBody')}</p>
      <Button size="sm" variant="outline" isDisabled={exhausted || cooldown > 0} onPress={onRetry}>
        {exhausted
          ? t('common.errors.maxRetries')
          : cooldown > 0
            ? t('common.actions.retryIn', { seconds: cooldown })
            : t('common.actions.retry')}
      </Button>
    </div>
  )
}
