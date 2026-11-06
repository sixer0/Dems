import type { ReactNode } from 'react'
import { Card } from '@heroui/react'
import type { LucideIcon } from 'lucide-react'
import { TextEffect } from '@/components/ui/text-effect'
import { cn } from '@/lib/utils'
import { useRouteEnterDelay } from './shell-motion-context'

/** M-APP-04: the title reveal runs about 1.4× the TextEffect default speed. */
const TITLE_SPEED_REVEAL = 1.4

export interface PageHeaderProps {
  /** Lucide page icon (the page's sidebar icon, or 04 §5's choice for sub-pages). */
  icon: LucideIcon
  title: string
  subtitle?: string
  /**
   * Right-side status banner (04 §3.2 K): an `Alert` with a custom layout, or a `Card` with a
   * status dot. Pages own its content; the header only reserves the slot.
   */
  status?: ReactNode
  className?: string
}

/**
 * Page header template (01_specs §14.4; research/04 §3.2 K), used by every shell page except the
 * Dashboard: `Card variant="transparent"` with a Lucide icon, the display title (Orbitron,
 * uppercase, synthetic oblique skewX(-9deg), white-to-gold gradient text) and a `foreground-2`
 * subtitle, plus an optional right-side status banner.
 *
 * Typography (D41(d), D49): title and subtitle are plain elements styled in `shell.css` (display
 * size `clamp(24px, 2.2vw, 32px)`, 01_specs §14.3), so no kit tailwind-merge can drop a size class.
 *
 * Motion (M-APP-04): the title enters with MP **TextEffect** `preset="fade-in-blur"` `per="word"`
 * (speedReveal 1.4) once the route exit is over (`useRouteEnterDelay`). The `<h1>` keeps the
 * accessible name (TextEffect's screen-reader copy); the gradient moves onto each word, because a
 * parent's `background-clip: text` does not reach words that animate on their own layer.
 * Reduced motion: opacity only (TextEffect honours the policy).
 */
export function PageHeader({ icon: Icon, title, subtitle, status, className }: PageHeaderProps) {
  const enterDelayMs = useRouteEnterDelay()
  return (
    <Card variant="transparent" className={cn('dems-page-header', className)} data-testid="page-header">
      <div className="dems-page-header-main">
        <Icon className="dems-page-header-icon" aria-hidden="true" strokeWidth={1.5} />
        <div className="dems-page-header-text">
          <h1 className="dems-page-title" data-shell-slot="page-title" data-text-effect="">
            <TextEffect
              as="span"
              per="word"
              preset="fade-in-blur"
              speedReveal={TITLE_SPEED_REVEAL}
              delay={enterDelayMs / 1000}
              className="dems-page-title-text"
            >
              {title}
            </TextEffect>
          </h1>
          {subtitle ? <p className="dems-page-subtitle">{subtitle}</p> : null}
        </div>
      </div>
      {status ? <div className="dems-page-header-status">{status}</div> : null}
    </Card>
  )
}
