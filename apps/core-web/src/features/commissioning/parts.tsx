/**
 * The shared pieces of the commissioning screen's panels (task 4, blueprint rows 112, 113, 118):
 * the house card with its own error boundary, the rate-limited retry, and the alert a refusal is
 * said in. Moved out of `index.tsx` by row 113, unchanged in behaviour, so that the set-IP panel
 * and the acceptance panel are drawn with the same ones.
 *
 * THE ERROR BOUNDARY NEVER QUOTES AN ERROR. What it draws is two fixed sentences of the shared
 * tree; what it records is a fixed sentence, the panel's name and the error's CLASS
 * (`@/lib/page-report`: `errorName`, a code, a status - never `message`, never the stack). A value
 * a panel held when it failed - a typed camera account among them - cannot reach either.
 *
 * Kit: `@heroui/react` (Card, Alert, Button).
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Alert, Button, Card } from '@heroui/react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useRetryCooldown } from '@dems/shared/realtime'
import type { CommissioningRefusal } from './model'
import { useRefusalSentence } from './refusal'
import { COMMISSIONING_RECORD, reportCommissioningError } from './report'

export type PanelId = 'settings' | 'scan' | 'alias' | 'setip' | 'acceptance'

/** A refusal or a result as one sentence. `kind` and `reason` are codes for the tests and for assistive tooling, never a text of an answer. */
export function SentenceAlert({ sentence, tone, testId, kind, reason }: { sentence: string; tone: 'warning' | 'danger' | 'success' | 'accent'; testId: string; kind?: string; reason?: string }) {
  return (
    <Alert status={tone} role={tone === 'success' || tone === 'accent' ? 'status' : 'alert'} data-testid={testId} data-refusal={kind} data-reason={reason}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{sentence}</Alert.Title>
      </Alert.Content>
    </Alert>
  )
}

export function RefusalAlert({ refusal, testId }: { refusal: CommissioningRefusal | null; testId: string }) {
  const sentenceOf = useRefusalSentence()
  if (refusal === null) return null
  return (
    <Alert status={refusal.kind === 'OTHER' ? 'danger' : 'warning'} role="alert" data-testid={testId} data-refusal={refusal.kind} data-reason={refusal.kind === 'REASON' ? refusal.reason : undefined}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{sentenceOf(refusal)}</Alert.Title>
      </Alert.Content>
    </Alert>
  )
}

// ── The panel (the house card, with its own error boundary) ──────────────────────────────

export function Panel({ id, icon: Icon, title, action, busy, children }: { id: PanelId; icon: LucideIcon; title: string; action?: ReactNode; busy?: boolean; children: ReactNode }) {
  return (
    <section className={`com-panel com-panel-${id}`} data-testid={`com-panel-${id}`} aria-label={title} aria-busy={busy || undefined}>
      <Card className="com-card">
        <header className="com-card-header">
          <Icon className="com-card-icon" aria-hidden="true" strokeWidth={1.75} />
          <h2 className="com-card-title">{title}</h2>
          {action ? <div className="com-card-action">{action}</div> : null}
        </header>
        <div className="com-card-body">
          <PanelErrorBoundary panel={id}>{children}</PanelErrorBoundary>
        </div>
      </Card>
    </section>
  )
}

/** A render failure inside one panel never blanks the page: a friendly message with the rate-limited retry. The record names the panel, never a value it drew and never the error's text. */
export class PanelErrorBoundary extends Component<{ panel: PanelId; children: ReactNode }, { failed: boolean; resets: number }> {
  override state = { failed: false, resets: 0 }

  static getDerivedStateFromError() {
    // The error is NOT kept: the state holds one flag, so no text of it can be drawn.
    return { failed: true }
  }

  override componentDidCatch(error: Error, _info: ErrorInfo) {
    reportCommissioningError('features/commissioning.PanelErrorBoundary', error, COMMISSIONING_RECORD.panel, { panel: this.props.panel })
  }

  private readonly reset = () => this.setState((state) => ({ failed: false, resets: state.resets + 1 }))

  override render() {
    if (this.state.failed) return <PanelFallback onRetry={this.reset} />
    return (
      <div key={this.state.resets} className="contents">
        {this.props.children}
      </div>
    )
  }
}

export function RetryButton({ onRetry, testId }: { onRetry: () => void; testId?: string }) {
  const { t } = useTranslation()
  const { retry, cooldown, exhausted, canRetry } = useRetryCooldown(onRetry)
  return (
    <Button size="sm" variant="outline" isDisabled={!canRetry} onPress={retry} data-testid={testId}>
      {exhausted ? t('common.errors.maxRetries') : cooldown > 0 ? t('common.actions.retryIn', { seconds: cooldown }) : t('common.actions.retry')}
    </Button>
  )
}

function PanelFallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="com-fallback" data-testid="com-panel-fallback">
      <p>{t('common.errors.panelTitle')}</p>
      <p className="com-text">{t('common.errors.panelBody')}</p>
      <RetryButton onRetry={onRetry} />
    </div>
  )
}

export function ReadFailed({ sentence, onRetry, testId }: { sentence: string; onRetry: () => void; testId: string }) {
  return (
    <Alert status="danger" data-testid={testId}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{sentence}</Alert.Title>
      </Alert.Content>
      <RetryButton onRetry={onRetry} testId={`${testId}-retry`} />
    </Alert>
  )
}
