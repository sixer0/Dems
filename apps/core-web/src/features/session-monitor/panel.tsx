import { Component, Fragment, type ErrorInfo, type ReactNode, type RefObject } from 'react'
import { Button, Card } from '@heroui/react'
import { motion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useRetryCooldown } from '@dems/shared/realtime'
import { cn } from '@/lib/utils'
import { DemoMark } from '@/components/demo-mark'
import { PANEL_BEAT_MS, usePanelVariants, type PanelId } from './choreography'
import { logSessionMonitorError } from './log'

export interface PanelProps {
  id: PanelId
  icon: LucideIcon
  title: string
  /** Header right side (for example a "View All →" link). */
  action?: ReactNode
  /** LB-1 (Live mode only): a command of the header's control is out; its wrapper is `aria-busy`. */
  actionBusy?: boolean
  /** Body class (the body is a flex column that fills the card). */
  bodyClassName?: string
  /** Fix wave L (G89c-07): the body element, for a panel that shows a cue when its body scrolls. */
  bodyRef?: RefObject<HTMLDivElement | null>
  className?: string
  children: ReactNode
}

/**
 * One Session Monitor panel: a kit `Card` with the mockup's header (gold icon, tracked uppercase
 * title, optional link), entering on its M-PG-SM beat. The page wraps each panel component in a
 * `PanelErrorBoundary`, so a failing panel never blanks the page (frontend error rules, layer 3).
 */
export function Panel({ id, icon: Icon, title, action, actionBusy = false, bodyClassName, bodyRef, className, children }: PanelProps) {
  const variants = usePanelVariants(PANEL_BEAT_MS[id])
  return (
    <motion.section
      className={cn('sm-panel', className)}
      data-testid={`panel-${id}`}
      data-panel={id}
      aria-label={title}
      variants={variants}
      initial="hidden"
      animate="visible"
    >
      <Card className="sm-card">
        <header className="sm-card-header">
          <Icon className="sm-card-icon" aria-hidden="true" strokeWidth={1.75} />
          <h2 className="sm-card-title">{title}</h2>
          {/* Fix wave J (JW-07; truth rule 3f): on the demonstration Core every panel that shows a feed, a recording state or an integrity statement says DEMO. */}
          <DemoMark block={`monitor-${id}`} className="sm-card-demo" />
          {action ? (
            <div className="sm-card-action" aria-busy={actionBusy || undefined}>
              {action}
            </div>
          ) : null}
        </header>
        <div ref={bodyRef} className={cn('sm-card-body', bodyClassName)}>
          {children}
        </div>
      </Card>
    </motion.section>
  )
}

// ── Error boundary (frontend error rules, layers 1–3) ────────────────────────────────────
interface BoundaryProps {
  panel: PanelId | 'K'
  /** The panel's grid-area class, so the fallback keeps the layout. */
  areaClassName: string
  children: ReactNode
}

interface BoundaryState {
  error: Error | null
  resets: number
}

/**
 * Catches a render failure in one panel (including its simulator selectors): the panel's grid
 * slot shows a friendly message with a rate-limited retry (3 s → 6 s → 12 s, max 3), the rest of
 * the page keeps working. There is no client log endpoint on mock-core (D41(g)), so the structured
 * record goes to the dev console.
 */
export class PanelErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { error: null, resets: 0 }

  static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    logSessionMonitorError('PanelErrorBoundary', error, { panel: this.props.panel, componentStack: info.componentStack })
  }

  private readonly reset = () => {
    this.setState((state) => ({ error: null, resets: state.resets + 1 }))
  }

  override render() {
    if (this.state.error) {
      return <PanelFallback panel={this.props.panel} areaClassName={this.props.areaClassName} onRetry={this.reset} />
    }
    return <Fragment key={this.state.resets}>{this.props.children}</Fragment>
  }
}

function PanelFallback({ panel, areaClassName, onRetry }: { panel: string; areaClassName: string; onRetry: () => void }) {
  const { t } = useTranslation()
  const { retry, cooldown, exhausted, canRetry } = useRetryCooldown(onRetry)
  return (
    <section className={cn('sm-panel', areaClassName)} data-testid={`panel-${panel}`} data-panel={panel} data-error="true">
      <Card className="sm-card">
    <div role="alert" className="sm-panel-fallback">
      <p className="text-body font-medium text-foreground">{t('common.errors.panelTitle')}</p>
      <p className="text-caption text-foreground-2">{t('common.errors.panelBody')}</p>
      <Button size="sm" variant="outline" isDisabled={!canRetry} onPress={retry}>
        {exhausted
          ? t('common.errors.maxRetries')
          : cooldown > 0
            ? t('common.actions.retryIn', { seconds: cooldown })
            : t('common.actions.retry')}
      </Button>
    </div>
      </Card>
    </section>
  )
}
