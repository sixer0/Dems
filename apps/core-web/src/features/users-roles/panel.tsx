import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button, Card } from '@heroui/react'
import { motion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useRetryCooldown } from '@dems/shared/realtime'
import { cn } from '@/lib/utils'
import { PANEL_BEAT_MS, usePanelVariants, type PanelId } from './choreography'
import { reportUsersError } from './report'

export interface PanelProps {
  readonly id: PanelId
  readonly icon: LucideIcon
  readonly title: string
  readonly subtitle?: string
  /** Header right side (the "Read-only" chip of the matrix). */
  readonly action?: ReactNode
  /** The first panel of the page enters as the hero (R3). */
  readonly hero?: boolean
  readonly children: ReactNode
}

/**
 * One panel of Users & Roles (backend task 04_client_integration_spec §10.1 PG-7: a feature-local
 * `Panel` with its own error boundary, in the pattern of `features/security-audit/panel.tsx`; each
 * feature folder owns its copy). The root carries `panel-<id>` (§10.2 test IDs).
 */
export function Panel({ id, icon: Icon, title, subtitle, action, hero = false, children }: PanelProps) {
  const variants = usePanelVariants(PANEL_BEAT_MS[id], hero)
  return (
    <motion.section className={cn('ur-panel', `ur-panel-${id}`)} data-testid={`panel-${id}`} aria-label={title} variants={variants} initial="hidden" animate="visible">
      <Card className="ur-card">
        <header className="ur-card-header">
          <Icon className="ur-card-icon" aria-hidden="true" strokeWidth={1.75} />
          <div className="ur-card-heading">
            <h2 className="ur-card-title">{title}</h2>
            {subtitle ? <p className="ur-card-subtitle">{subtitle}</p> : null}
          </div>
          {action ? <div className="ur-card-action">{action}</div> : null}
        </header>
        <div className="ur-card-body">
          <PanelErrorBoundary panel={id}>{children}</PanelErrorBoundary>
        </div>
      </Card>
    </motion.section>
  )
}

interface BoundaryProps {
  readonly panel: string
  readonly children: ReactNode
}

interface BoundaryState {
  readonly error: Error | null
  readonly resets: number
}

/**
 * A render failure inside one panel: the panel shows a friendly message with a rate-limited retry
 * (3 s, 6 s, 12 s, then reload; `useRetryCooldown`), the rest of the page keeps working. One record
 * in the page's own log, with a fixed sentence (never the error's text).
 */
export class PanelErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { error: null, resets: 0 }

  static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    reportUsersError('features/users-roles.PanelErrorBoundary', error, 'A panel of Users & Roles could not be displayed.', {
      panel: this.props.panel,
      hasComponentStack: Boolean(info.componentStack),
    })
  }

  private readonly reset = () => {
    this.setState((state) => ({ error: null, resets: state.resets + 1 }))
  }

  override render() {
    if (this.state.error) return <PanelFallback onRetry={this.reset} />
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
    <div role="alert" className="ur-panel-fallback">
      <p className="ur-fallback-title">{t('common.errors.panelTitle')}</p>
      <p className="ur-fallback-body">{t('common.errors.panelBody')}</p>
      <Button size="sm" variant="outline" isDisabled={!canRetry} onPress={retry}>
        {exhausted ? t('common.errors.maxRetries') : cooldown > 0 ? t('common.actions.retryIn', { seconds: cooldown }) : t('common.actions.retry')}
      </Button>
    </div>
  )
}
