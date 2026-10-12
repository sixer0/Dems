import { DemoMark } from '@/components/demo-mark'
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { SyntheticValuesChip } from '@/components/synthetic-values-chip'
import { Button, Card } from '@heroui/react'
import { motion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useRetryCooldown } from '@dems/shared/realtime'
import { cn } from '@/lib/utils'
import { PANEL_BEAT_MS, usePanelVariants, type StoragePanelId } from './choreography'
import { logStorageError } from './log'

export interface StoragePanelProps {
  id: StoragePanelId
  icon: LucideIcon
  title: string
  /** Header right side: a state chip, a headline figure or a link. */
  action?: ReactNode
  className?: string
  bodyClassName?: string
  children: ReactNode
}

/**
 * Fix wave L (G75d-07): the blocks of this page whose values a Core in its own capture replicates from the
 * appliance model and does not report. Each carries the "Synthetic demo values" chip on such a Core; the
 * simulated lane draws none (`SyntheticValuesChip`).
 */
const SYNTHETIC_BLOCKS: ReadonlySet<string> = new Set(['usage', 'volumes', 'calculator'])

/**
 * One Storage panel: a kit `Card` (the bronze-edged L2 surface) with the mockup's panel header
 * (gold icon, tracked uppercase title, optional right-side action), entering on its M-PG-STOR beat
 * (R1). Every panel has its own error boundary, so one failing panel never blanks the page.
 */
export function StoragePanel({ id, icon: Icon, title, action, className, bodyClassName, children }: StoragePanelProps) {
  const variants = usePanelVariants(PANEL_BEAT_MS[id])
  return (
    <motion.section
      className={cn('stor-panel', `stor-area-${id}`, className)}
      data-testid={`storage-panel-${id}`}
      aria-label={title}
      variants={variants}
      initial="hidden"
      animate="visible"
    >
      <Card className="stor-card">
        <div className="stor-card-header">
          <Icon className="stor-card-icon" aria-hidden="true" strokeWidth={1.75} />
          <h2 className="stor-card-title">{title}</h2>
          {SYNTHETIC_BLOCKS.has(id) ? <SyntheticValuesChip block={id} /> : null}
          {/* Fix wave J (JW-07): the demonstration Core's storage values are marked on every panel. */}
          <DemoMark block={`storage-${id}`} />
          {action ? <div className="stor-card-action">{action}</div> : null}
        </div>
        <div className={cn('stor-card-body', bodyClassName)}>
          <StoragePanelBoundary panel={id}>{children}</StoragePanelBoundary>
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
 * rate-limited retry (3 s → 6 s → 12 s, at most 3), and the structured record goes to the page's
 * own log, `webErrorSink` (no client log endpoint exists, D41(g); `./log`, plan row W71). The rest
 * of the page keeps working.
 */
export class StoragePanelBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { error: null, resets: 0 }

  static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    logStorageError('PanelBoundary', error, { panel: this.props.panel, componentStack: info.componentStack })
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
    <div role="alert" className="stor-fallback">
      <p className="stor-fallback-title">{t('common.errors.panelTitle')}</p>
      <p className="stor-fallback-body">{t('common.errors.panelBody')}</p>
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
