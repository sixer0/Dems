import { useId, type ReactNode } from 'react'
import { Card } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { LayoutGroup, motion } from 'motion/react'
import { ArrowRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePanelVariants } from './dashboard-motion'
import { PanelBoundary } from './panel-boundary'

export type PanelId = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j'

export interface DashPanelProps {
  id: PanelId
  /** M-PG-DASH beat of the panel enter (ms after the route enter). */
  beatMs: number
  /** Panel header title (uppercase in the resources). Absent for the ring, hero and strip. */
  title?: string
  icon?: LucideIcon
  /** Right side of the header (a "View all" link, a status summary). */
  action?: ReactNode
  /** Accessible name when there is no visible title. */
  ariaLabel?: string
  /** `bare`: no card (A, B, C draw their own surfaces). */
  surface?: 'card' | 'bare'
  className?: string
  bodyClassName?: string
  children: ReactNode
}

/**
 * One Dashboard panel (01_specs §14.5.1): a grid cell (`panel-<id>` test ID, AC-60) holding a kit
 * `Card` with the panel header of research/04 §3.1 (gold icon, tracked uppercase title, right-side
 * action) and a body wrapped in its own error boundary.
 *
 * Motion: the cell inherits the route wrapper's `hidden → visible → exit` labels (M-APP-04) and
 * enters on its M-PG-DASH beat (R1: opacity, `rise`, `enterFrom`, spring `gentle`); the sign-out
 * exit plays with no stagger (R2). Reduced motion: opacity only (§8).
 */
export function DashPanel({
  id,
  beatMs,
  title,
  icon: Icon,
  action,
  ariaLabel,
  surface = 'card',
  className,
  bodyClassName,
  children,
}: DashPanelProps) {
  const variants = usePanelVariants(beatMs)
  const titleId = useId()
  // Each panel is its own layout group (like the shell clock, DR-41-10): a SlidingNumber timer or a
  // list insertion re-measures only its own panel's layout nodes, never the whole page (§9.3).
  const body = (
    <LayoutGroup id={`dash-${id}`} inherit={false}>
      <PanelBoundary panel={id.toUpperCase()}>{children}</PanelBoundary>
    </LayoutGroup>
  )

  return (
    <motion.section
      data-testid={`panel-${id}`}
      data-panel={id.toUpperCase()}
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : ariaLabel}
      className={cn('dems-dash-panel', `dems-dash-area-${id}`, className)}
      variants={variants}
    >
      {surface === 'bare' ? (
        body
      ) : (
        <Card className="dems-dash-card h-full min-h-0 gap-2 overflow-clip rounded-xl px-3.5 py-3 [overflow-clip-margin:4px]">
          {title ? (
            <header className="dems-dash-head">
              {Icon ? <Icon className="dems-dash-head-icon" aria-hidden="true" size={18} strokeWidth={1.75} /> : null}
              <h2 id={titleId} className="dems-dash-title">
                {title}
              </h2>
              {action ? <div className="dems-dash-head-action">{action}</div> : null}
            </header>
          ) : null}
          <div className={cn('flex min-h-0 flex-1 flex-col', bodyClassName)}>{body}</div>
        </Card>
      )}
    </motion.section>
  )
}

/** The gold "View all →" header link (research/04 §9 #22: links are gold). */
export function PanelLink({
  to,
  children,
}: {
  to: '/devices' | '/storage' | '/evidence' | '/security-audit' | '/network-time' | '/system'
  children: ReactNode
}) {
  return (
    <Link to={to} className="dems-dash-link">
      <span className="dems-dash-link-text">{children}</span>
      <ArrowRight aria-hidden="true" size={14} />
    </Link>
  )
}
