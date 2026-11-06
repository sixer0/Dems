import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button, Card } from '@heroui/react'
import { motion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useRetryCooldown } from '@dems/shared/realtime'
import { cn } from '@/lib/utils'
import { usePanelVariants, type PanelId } from './choreography'
import { PAIRING_RECORD, reportPairingError } from './report'

export interface PanelProps {
  id: PanelId
  icon: LucideIcon
  title: string
  /** Header right side (a chip, the filter). */
  action?: ReactNode
  className?: string
  /** Marks the panel while one of its commands is out (LB-1, for a control that is no button). */
  busy?: boolean
  children: ReactNode
}

/**
 * One panel of the Paired Devices page (backend task 04_client_integration_spec §10.1 PG-7): a kit
 * `Card` with the gold-icon header, entering on its beat (PG-9), with its own error boundary, so a
 * panel that fails to render never blanks the page (frontend error rules, layer 3). The feature's
 * own copy, in the pattern of `features/security-audit/panel.tsx` (P6: each folder owns its copy).
 */
export function Panel({ id, icon: Icon, title, action, className, busy, children }: PanelProps) {
  const variants = usePanelVariants(id)
  return (
    <motion.section
      className={cn('pd-panel', `pd-panel-${id}`, className)}
      data-testid={`panel-${id}`}
      aria-label={title}
      aria-busy={busy || undefined}
      variants={variants}
      initial="hidden"
      animate="visible"
    >
      <Card className="pd-card">
        <header className="pd-card-header">
          <Icon className="pd-card-icon" aria-hidden="true" strokeWidth={1.75} />
          <h2 className="pd-card-title">{title}</h2>
          {action ? <div className="pd-card-action">{action}</div> : null}
        </header>
        <div className="pd-card-body">
          <PanelErrorBoundary panel={id}>{children}</PanelErrorBoundary>
        </div>
      </Card>
    </motion.section>
  )
}

interface BoundaryProps {
  panel: PanelId
  children: ReactNode
}

interface BoundaryState {
  failed: boolean
  resets: number
}

/**
 * Catches a render failure inside one panel: a friendly message with a rate-limited retry
 * (3 s → 6 s → 12 s, at most 3). The record goes to the page's own log with the fixed sentence and
 * the cause by class only — never the error's text, never a stack, so no value the panel rendered
 * (a pairing code) can reach the log through an error message (rule 4).
 */
export class PanelErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { failed: false, resets: 0 }

  static getDerivedStateFromError(): Partial<BoundaryState> {
    return { failed: true }
  }

  override componentDidCatch(error: Error, _info: ErrorInfo) {
    reportPairingError('features/paired-devices.PanelErrorBoundary', error, PAIRING_RECORD.panel, { panel: this.props.panel })
  }

  private readonly reset = () => {
    this.setState((state) => ({ failed: false, resets: state.resets + 1 }))
  }

  override render() {
    if (this.state.failed) return <PanelFallback onRetry={this.reset} />
    return (
      <div key={this.state.resets} className="contents">
        {this.props.children}
      </div>
    )
  }
}

function PanelFallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  const { retry, cooldown, exhausted, canRetry } = useRetryCooldown(onRetry)
  return (
    <div role="alert" className="pd-panel-fallback">
      <p className="pd-fallback-title">{t('common.errors.panelTitle')}</p>
      <p className="pd-fallback-body">{t('common.errors.panelBody')}</p>
      <Button size="sm" variant="outline" isDisabled={!canRetry} onPress={retry}>
        {exhausted ? t('common.errors.maxRetries') : cooldown > 0 ? t('common.actions.retryIn', { seconds: cooldown }) : t('common.actions.retry')}
      </Button>
    </div>
  )
}
