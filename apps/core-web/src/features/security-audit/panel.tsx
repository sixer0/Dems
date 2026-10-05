import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button, Card } from '@heroui/react'
import { motion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useRetryCooldown } from '@dems/shared/realtime'
import { cn } from '@/lib/utils'
import { PANEL_BEAT_MS, usePanelVariants, type PanelId } from './choreography'
import { logSecurityAudit } from './log'

export interface PanelProps {
  id: PanelId
  icon: LucideIcon
  title: string
  /** Header right side (a summary chip, a switch, an action). */
  action?: ReactNode
  /** Header second line (a short description). */
  subtitle?: string
  className?: string
  bodyClassName?: string
  /** The hero panel enters from scale 0.9 (M-PG-SEC). */
  hero?: boolean
  children: ReactNode
}

/**
 * One Security & Audit panel: a kit `Card` with the mockup header (gold icon, tracked uppercase
 * title, optional action) entering on its M-PG-SEC beat. Each panel has its own error boundary,
 * so a failing panel never blanks the page (frontend error rules, layer 3).
 */
export function Panel({ id, icon: Icon, title, action, subtitle, className, bodyClassName, hero = false, children }: PanelProps) {
  const variants = usePanelVariants(PANEL_BEAT_MS[id], hero)
  return (
    <motion.section
      className={cn('sa-panel', `sa-panel-${id}`, className)}
      data-testid={`panel-${id}`}
      aria-label={title}
      variants={variants}
      initial="hidden"
      animate="visible"
    >
      <Card className="sa-card">
        <header className="sa-card-header">
          <Icon className="sa-card-icon" aria-hidden="true" strokeWidth={1.75} />
          <div className="sa-card-heading">
            <h2 className="sa-card-title">{title}</h2>
            {subtitle ? <p className="sa-card-subtitle">{subtitle}</p> : null}
          </div>
          {action ? <div className="sa-card-action">{action}</div> : null}
        </header>
        <div className={cn('sa-card-body', bodyClassName)}>
          <PanelErrorBoundary panel={id}>{children}</PanelErrorBoundary>
        </div>
      </Card>
    </motion.section>
  )
}

interface BoundaryProps {
  panel: string
  children: ReactNode
}

interface BoundaryState {
  error: Error | null
  resets: number
}

/**
 * Catches a render failure inside one panel: the panel shows a friendly message with a
 * rate-limited retry (3 s → 6 s → 12 s, max 3); the rest of the page keeps working. The
 * structured record goes to the page's own log (`./log`; no client log endpoint, D41(g)).
 */
export class PanelErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { error: null, resets: 0 }

  static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    logSecurityAudit('error', 'PanelErrorBoundary', error, { panel: this.props.panel, componentStack: info.componentStack ?? null })
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
    <div role="alert" className="sa-panel-fallback">
      <p className="sa-fallback-title">{t('common.errors.panelTitle')}</p>
      <p className="sa-fallback-body">{t('common.errors.panelBody')}</p>
      <Button size="sm" variant="outline" isDisabled={!canRetry} onPress={retry}>
        {exhausted
          ? t('common.errors.maxRetries')
          : cooldown > 0
            ? t('common.actions.retryIn', { seconds: cooldown })
            : t('common.actions.retry')}
      </Button>
    </div>
  )
}
