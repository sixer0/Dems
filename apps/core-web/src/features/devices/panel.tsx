import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button, Card } from '@heroui/react'
import { motion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useRetryCooldown } from '@dems/shared/realtime'
import { GlowLayer } from '@/motion'
import { cn } from '@/lib/utils'
import { logDevicesError, PANEL_BEAT_MS, usePanelVariants, type DevicesPanelId } from './motion'

export interface DevicesPanelProps {
  id: DevicesPanelId
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
  return (
    <motion.section
      className={cn('dev-panel', `dev-panel-${id}`, className)}
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
          {action ? <div className="dev-card-action">{action}</div> : null}
        </header>
        <div className={cn('dev-card-body', bodyClassName)}>
          <DevicesErrorBoundary panel={id}>{children}</DevicesErrorBoundary>
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
 * Catches a render failure inside one panel or the drawer: a friendly message with a
 * rate-limited retry (3 s → 6 s → 12 s, at most 3), while the rest of the page keeps working.
 * The structured record goes to the dev console (no client log endpoint, D41(g)).
 */
export class DevicesErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { error: null, resets: 0 }

  static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    logDevicesError('ErrorBoundary', error, { panel: this.props.panel, componentStack: info.componentStack })
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
