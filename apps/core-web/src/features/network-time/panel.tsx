import { DemoMark } from '@/components/demo-mark'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { NoProducerNotice } from '@/components/synthetic-values-chip'
import { useSelfCaptureCore } from '@/lib/own-capture'
import { Button, Card } from '@heroui/react'
import { motion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useRetryCooldown } from '@dems/shared/realtime'
import { cn } from '@/lib/utils'
import { PANEL_BEAT_MS, usePanelVariants, type NetworkTimePanelId } from './choreography'
import { logNetworkTimeError } from './log'

export interface NetworkTimePanelProps {
  id: NetworkTimePanelId
  icon: LucideIcon
  title: string
  /** Header right side: a state chip, a headline figure or a note. */
  action?: ReactNode
  className?: string
  bodyClassName?: string
  children: ReactNode
}

/**
 * Fix wave L (G75d-07) -> audit fix row 104 (DF-21, D25 N3): the blocks of this page whose values a Core in its own
 * capture replicates from the appliance model and does not report. A block that is ALL model (the domains
 * diagram) draws "Not reported" (`NoProducerNotice`, register S7) in place of its body on such a Core.
 * Network status mixes model rows (LAN, PoE, bandwidth) with the tablet link the Core does produce:
 * network-panel.tsx gates its model rows one by one with `NoProducerGate` (row 107, on row 104's routed
 * request), so no block carries the "Synthetic demo values" chip any more. The simulated lane draws no notice.
 */
const NO_PRODUCER_BLOCKS: ReadonlySet<string> = new Set(['domains'])

/**
 * One Network & Time panel: a kit `Card` (the bronze-edged L2 surface) with the mockup's panel
 * header (gold icon, tracked uppercase title, optional right-side action), entering on its M-PG-NET
 * beat (R1). Every panel has its own error boundary, so one failing panel never blanks the page.
 */
export function NetworkTimePanel({ id, icon: Icon, title, action, className, bodyClassName, children }: NetworkTimePanelProps) {
  const variants = usePanelVariants(PANEL_BEAT_MS[id])
  const noProducer = useSelfCaptureCore() && NO_PRODUCER_BLOCKS.has(id)
  return (
    <motion.section
      className={cn('nt-panel', `nt-area-${id}`, className)}
      data-testid={`network-time-panel-${id}`}
      aria-label={title}
      variants={variants}
      initial="hidden"
      animate="visible"
    >
      <Card className="nt-card">
        <div className="nt-card-header">
          <Icon className="nt-card-icon" aria-hidden="true" strokeWidth={1.75} />
          <h2 className="nt-card-title">{title}</h2>
          {/* Fix wave J (JW-07): the demonstration Core's network and time values are marked on every panel. */}
          <DemoMark block={`network-${id}`} />
          {action && !noProducer ? <div className="nt-card-action">{action}</div> : null}
        </div>
        <div className={cn('nt-card-body', noProducer ? undefined : bodyClassName)}>
          {noProducer ? <NoProducerNotice block={id} /> : <NetworkTimeBoundary panel={id}>{children}</NetworkTimeBoundary>}
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
 * rate-limited retry (3 s → 6 s → 12 s, at most 3), and the structured record goes to the dev
 * console (no client log endpoint exists, D41(g)). The rest of the page keeps working.
 */
export class NetworkTimeBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { error: null, resets: 0 }

  static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    logNetworkTimeError('PanelBoundary', error, { panel: this.props.panel, componentStack: info.componentStack })
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
    <div role="alert" className="nt-fallback">
      <p className="nt-fallback-title">{t('common.errors.panelTitle')}</p>
      <p className="nt-fallback-body">{t('common.errors.panelBody')}</p>
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
