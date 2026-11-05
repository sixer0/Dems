import { DemoMark } from '@/components/demo-mark'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { NoProducerNotice } from '@/components/synthetic-values-chip'
import { useSelfCaptureCore } from '@/lib/own-capture'
import { Button, Card } from '@heroui/react'
import { motion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useRetryCooldown } from '@dems/shared/realtime'
import { GlowLayer } from '@/motion'
import { cn } from '@/lib/utils'
import { PANEL_BEAT_MS, usePanelVariants, type DevicesPanelId } from './motion'
import { reportDevicesError } from './report'

/**
 * Fix wave L (G75d-07) -> audit fix row 104 (DF-21, D25 N3): the blocks of this page whose values a Core in its own
 * capture replicates from the appliance model and does not report.
 * - ALL model (the port map): on such a Core the block draws "Not reported" (`NoProducerNotice`, register S7)
 *   in place of its body.
 * - The front panel: its LEDs and model LCD pages are gated where they are drawn (`NoProducerGate` around
 *   `<FrontPanel />` in index.tsx); the LCD connection beside them is the Core's own fact and stays.
 * - Other devices mixes model rows with the tablet link the Core produces: other-devices.tsx gates its model rows
 *   (PoE switch, relay lamp) row by row (row 107, on row 104's routed request), so the block carries no chip.
 * No block carries the "Synthetic demo values" chip any more. The simulated lane draws no notice.
 */
const NO_PRODUCER_BLOCKS: ReadonlySet<string> = new Set(['ports'])

export interface DevicesPanelProps {
  id: DevicesPanelId
  /** The DOM id of the panel, for an in-page link (the capture selector, WB-07). */
  anchorId?: string
  icon: LucideIcon
  title: string
  subtitle?: string
  /** Header right side (a count chip, a legend). */
  action?: ReactNode
  /** Change it to play one glow bloom (the hero finish, R3; escalations, R8). */
  glowPulseKey?: string | number
  className?: string
  bodyClassName?: string
  children: ReactNode
}

/**
 * One Devices & Inputs panel: a kit `Card` with the house header (gold icon, tracked uppercase
 * title, optional subtitle and action), entering on its M-PG-DEV beat (R1). Each panel has its
 * own error boundary, so one failing panel never blanks the page (frontend error rules, layer 3).
 * Glow is a pre-rendered layer whose opacity alone moves (§2.2, §9.2).
 */
export function DevicesPanel({
  id,
  anchorId,
  icon: Icon,
  title,
  subtitle,
  action,
  glowPulseKey,
  className,
  bodyClassName,
  children,
}: DevicesPanelProps) {
  const variants = usePanelVariants(PANEL_BEAT_MS[id])
  const noProducer = useSelfCaptureCore() && NO_PRODUCER_BLOCKS.has(id)
  return (
    <motion.section
      className={cn('dev-panel', `dev-panel-${id}`, className)}
      id={anchorId}
      data-testid={`panel-${id}`}
      aria-label={title}
      variants={variants}
      initial="hidden"
      animate="visible"
    >
      <Card className="dev-card">
        <GlowLayer level={1} pulseKey={glowPulseKey} pulseDurationMs={640} />
        <header className="dev-card-header">
          <Icon className="dev-card-icon" aria-hidden="true" strokeWidth={1.75} />
          <div className="dev-card-heading">
            <h2 className="dev-card-title">{title}</h2>
            {subtitle ? <p className="dev-card-subtitle">{subtitle}</p> : null}
          </div>
          {/* Fix wave J (JW-07): the demonstration Core's values are marked on every panel. */}
          <DemoMark block={`devices-${id}`} />
          {action && !noProducer ? <div className="dev-card-action">{action}</div> : null}
        </header>
        <div className={cn('dev-card-body', noProducer ? undefined : bodyClassName)}>
          {noProducer ? <NoProducerNotice block={id} /> : <DevicesErrorBoundary panel={id}>{children}</DevicesErrorBoundary>}
        </div>
      </Card>
    </motion.section>
  )
}

/** The fixed sentence of the boundary's record (never the error's text). */
const PANEL_FAILED_RECORD = 'A panel of Devices & Inputs failed to render; it shows its fallback with a retry.'

interface BoundaryProps {
  panel: string
  children: ReactNode
}

interface BoundaryState {
  error: Error | null
  resets: number
}

/**
 * Catches a render failure inside one panel or the drawer: a friendly message with a
 * rate-limited retry (3 s → 6 s → 12 s, at most 3), while the rest of the page keeps working.
 * The record goes to the page's own log through `reportDevicesError` (FXR-W, W92-5: a fixed
 * sentence, the panel, the error's class and React's `componentStack`, which names components and
 * source positions and can be many lines; never the error's message or its own stack, which the dev
 * console got before. Re-check finding RC-5: the stack of components is kept, as every other panel
 * boundary of the console keeps it, and is said here).
 */
export class DevicesErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { error: null, resets: 0 }

  static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    reportDevicesError('Devices.ErrorBoundary', error, PANEL_FAILED_RECORD, { panel: this.props.panel, componentStack: info.componentStack ?? null })
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
    <div role="alert" className="dev-panel-fallback">
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
  )
}
