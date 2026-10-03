import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button, Card } from '@heroui/react'
import { motion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useRetryCooldown } from '@dems/shared/realtime'
import { cn } from '@/lib/utils'
import { usePanelVariants, type ApiPanelId } from './choreography'
import { logApiReference } from './log'

export interface ApiPanelProps {
  id: Exclude<ApiPanelId, 'strip'>
  icon: LucideIcon
  title: string
  /** Header right side (a state chip). */
  action?: ReactNode
  className?: string
  bodyClassName?: string
  children: ReactNode
}

/**
 * One API Reference panel: a kit `Card` (the bronze-edged L2 surface) with the mockup's panel
 * header, entering on its M-PG-API beat. Each panel has its own error boundary, so a renderer
 * failure never blanks the Realtime panel or the page.
 */
export function ApiPanel({ id, icon: Icon, title, action, className, bodyClassName, children }: ApiPanelProps) {
  const variants = usePanelVariants(id)
  return (
    <motion.section
      className={cn('api-panel', `api-area-${id}`, className)}
      data-testid={`api-panel-${id}`}
      aria-label={title}
      variants={variants}
      initial="hidden"
      animate="visible"
    >
      <Card className="api-card">
        <div className="api-card-header">
          <Icon className="api-card-icon" aria-hidden="true" strokeWidth={1.75} />
          <h2 className="api-card-title">{title}</h2>
          {action ? <div className="api-card-action">{action}</div> : null}
        </div>
        <div className={cn('api-card-body', bodyClassName)}>
          <ApiPanelBoundary panel={id}>{children}</ApiPanelBoundary>
        </div>
      </Card>
    </motion.section>
  )
}

interface BoundaryProps {
  panel: string
  /** Fallback copy keys; defaults to the shared panel copy. */
  fallback?: { title: string; body: string }
  children: ReactNode
}

interface BoundaryState {
  error: Error | null
  resets: number
}

/**
 * Frontend error rules, layers 1–3: a render failure shows friendly copy with a rate-limited retry
 * (3 s → 6 s → 12 s, at most 3, `useRetryCooldown`), and the structured record goes to the dev
 * console (no client log endpoint exists, D41(g)).
 */
export class ApiPanelBoundary extends Component<BoundaryProps, BoundaryState> {
  override state: BoundaryState = { error: null, resets: 0 }

  static getDerivedStateFromError(error: Error): Partial<BoundaryState> {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    logApiReference('error', 'PanelBoundary', error, { panel: this.props.panel, componentStack: info.componentStack })
  }

  private readonly reset = () => {
    this.setState((state) => ({ error: null, resets: state.resets + 1 }))
  }

  override render() {
    if (this.state.error) return <PanelFallback onRetry={this.reset} copy={this.props.fallback} />
    return (
      <div key={this.state.resets} className="contents">
        {this.props.children}
      </div>
    )
  }
}

function PanelFallback({ onRetry, copy }: { onRetry: () => void; copy: BoundaryProps['fallback'] }) {
  const { t } = useTranslation()
  const { retry, cooldown, exhausted, canRetry } = useRetryCooldown(onRetry)
  return (
    <div role="alert" className="api-fallback" data-testid="api-panel-fallback">
      <p className="api-fallback-title">{copy?.title ?? t('common.errors.panelTitle')}</p>
      <p className="api-fallback-body">{copy?.body ?? t('common.errors.panelBody')}</p>
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
