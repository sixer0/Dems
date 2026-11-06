import { memo, type ReactNode } from 'react'
import { AnimatePresence } from 'motion/react'
import { DATE_PATTERNS, formatDate } from '@dems/shared/realtime'
import { AnimatedListItem } from '@/components/ui/animated-list'
import { cn } from '@/lib/utils'

export interface FeedItem {
  id: string
  at: number
  tone: string
  title: ReactNode
  sub?: ReactNode
  trailing?: ReactNode
}

export interface FeedProps {
  items: readonly FeedItem[]
  label: string
  empty: string
  /** Rows with this ID get the M-C-07 gold highlight (the newest live insertion). */
  highlightId?: string | null
  testId?: string
}

/**
 * A short event list for the lenses. New rows enter through Magic UI **AnimatedListItem**
 * (M-C-07: from -12 px and 0.98, vendor spring, gold highlight on the newest; reduced motion:
 * instant with the highlight only). Rows present at mount do not animate (`initial={false}`).
 */
export const Feed = memo(function Feed({ items, label, empty, highlightId = null, testId }: FeedProps) {
  if (items.length === 0) {
    return (
      <p className="sa-feed-empty" data-testid={testId ? `${testId}-empty` : undefined}>
        {empty}
      </p>
    )
  }
  return (
    <div className="sa-feed" role="list" aria-label={label} data-testid={testId}>
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <AnimatedListItem key={item.id} highlight={item.id === highlightId}>
            <div className={cn('sa-feed-row', item.tone)} role="listitem">
              <span className="sa-dot" aria-hidden="true" />
              <span className="sa-feed-time">{formatDate(item.at, DATE_PATTERNS.time)}</span>
              <span className="sa-feed-text">
                <span className="sa-feed-title">{item.title}</span>
                {item.sub ? <span className="sa-feed-sub">{item.sub}</span> : null}
              </span>
              {item.trailing}
            </div>
          </AnimatedListItem>
        ))}
      </AnimatePresence>
    </div>
  )
})
