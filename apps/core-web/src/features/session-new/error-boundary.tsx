import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react'
import { Button, Card } from '@heroui/react'
import { useTranslation } from 'react-i18next'
import { useRetryCooldown } from '@dems/shared/realtime'
import { logSessionNew } from './log'

interface BoundaryProps {
  /** Which part failed (a step name), for the log record. */
  part: string
  children: ReactNode
}

interface BoundaryState {
  error: Error | null
  resets: number
}

/**
 * Catches a render failure inside one wizard step (including its simulator selectors): the step
 * slot shows a friendly message with a rate-limited retry (3 s → 6 s → 12 s, max 3); the header,
 * stepper and footer keep working (frontend error rules, layer 3). There is no client log endpoint
 * on mock-core (D41(g)), so the structured record goes to the dev console.
 */
export class FlowErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { error: null, resets: 0 }

  static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    logSessionNew('error', 'FlowErrorBoundary', error, { part: this.props.part, componentStack: info.componentStack })
  }

  private readonly reset = () => {
    this.setState((state) => ({ error: null, resets: state.resets + 1 }))
  }

  override render() {
    if (this.state.error) return <StepFallback onRetry={this.reset} />
    return <Fragment key={this.state.resets}>{this.props.children}</Fragment>
  }
}

function StepFallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  const { retry, cooldown, exhausted, canRetry } = useRetryCooldown(onRetry)
  return (
    <Card className="sn-card" data-testid="sn-step-error">
      <div role="alert" className="sn-fallback">
        <p className="sn-fallback-title">{t('common.errors.panelTitle')}</p>
        <p className="sn-caption">{t('common.errors.generic')}</p>
        <Button size="sm" variant="outline" isDisabled={!canRetry} onPress={retry}>
          {exhausted ? t('common.errors.maxRetries') : cooldown > 0 ? t('common.actions.retryIn', { seconds: cooldown }) : t('common.actions.retry')}
        </Button>
      </div>
    </Card>
  )
}
