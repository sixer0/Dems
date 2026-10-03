import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button, Card } from '@heroui/react'
import { motion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useRetryCooldown } from '@dems/shared/realtime'
import { cn } from '@/lib/utils'
import { PANEL_BEAT_MS, usePanelVariants, type SystemPanelId } from './choreography'
import { logSystemError } from './log'

export interface SystemPanelProps {
  id: SystemPanelId
  icon: LucideIcon
  title: string
  /** Header right side: a chip, a summary figure, a switch. */
  action?: ReactNode
  className?: string
  bodyClassName?: string
  /** DOM id for in-page links (Settings → maintenance / identity). */
  anchorId?: string
  children: ReactNode
}

/**
 * One System panel: a kit `Card` (the bronze-edged L2 surface) with the mockup's panel header
 * (gold icon, tracked uppercase title, optional right-side action), entering on its M-PG-SYS beat
 * (R1). Each panel has its own error boundary, so one failing panel never blanks the page.
 */
export function SystemPanel({ id, icon: Icon, title, action, className, bodyClassName, anchorId, children }: SystemPanelProps) {
  const variants = usePanelVariants(PANEL_BEAT_MS[id])
  return (
    <motion.section
      id={anchorId}
      className={cn('sys-panel', `sys-area-${id}`, className)}
      data-testid={`system-panel-${id}`}
      aria-label={title}
      variants={variants}
      initial="hidden"
      animate="visible"
    >
      <Card className="sys-card">
        <div className="sys-card-header">
          <Icon className="sys-card-icon" aria-hidden="true" strokeWidth={1.75} />
          <h2 className="sys-card-title">{title}</h2>
          {action ? <div className="sys-card-action">{action}</div> : null}
        </div>
        <div className={cn('sys-card-body', bodyClassName)}>
          <SystemPanelBoundary panel={id}>{children}</SystemPanelBoundary>
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
 * Frontend error rules, layers 1–3: a render failure inside one panel shows friendly copy with a
 * rate-limited retry (3 s → 6 s → 12 s, at most 3) and a structured dev-console record (no client
 * log endpoint exists, D41(g)). The rest of the page keeps working.
 */
export class SystemPanelBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { error: null, resets: 0 }

  static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    logSystemError('PanelBoundary', error, { panel: this.props.panel, componentStack: info.componentStack })
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
    <div role="alert" className="sys-fallback">
      <p className="sys-fallback-title">{t('common.errors.panelTitle')}</p>
      <p className="sys-fallback-body">{t('common.errors.panelBody')}</p>
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
