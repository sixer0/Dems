import { auditTypeWords } from '@/lib/event-words'
import { memo, useRef, useState } from 'react'
import { ScrollShadow } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatClock } from '@dems/shared/realtime'
import { selectAuditTail, useSim, type AuditRow } from '@dems/shared/sim'
import { AnimatedListItem } from '@/components/ui/animated-list'
import { TextScramble } from '@/components/ui/text-scramble'
import { useMotionPolicy } from '@/motion'
import { cn } from '@/lib/utils'
import { PANEL_BEAT_MS, useStaggerVariants } from './choreography'
import { shortHash } from './model'
import { Panel } from './panel'
import { useScrollEdges } from './scroll-edges'

/** T shows the latest 12 audit rows (01_specs §14.5.2 T). */
export const AUDIT_ROWS = 12
const HEX = '0123456789abcdef'
/** M-C-07: the short hash resolves with TextScramble over 0.6 s. */
const SCRAMBLE_S = 0.6

function severityTone(row: AuditRow): 'success' | 'warning' | 'danger' {
  if (row.severity === 'CRITICAL') return 'danger'
  if (row.severity === 'WARNING') return 'warning'
  if (row.type === 'NOTE_ADDED' || row.type === 'MARKER_ADDED') return 'warning'
  return 'success'
}

/**
 * T: LIVE AUDIT EVENTS (01_specs §14.5.2 T; research/04 §3.2 T; M-C-07). The newest 12 rows of
 * the hash-chained audit log, newest first: time (UTC+07:00, mono), the i18n message and the short
 * row hash. Rows present on enter stagger 30 ms (cap 8, M-PG-SM t = 580); later rows enter with
 * MU AnimatedListItem (edited variants: y −12, scale 0.98, vendor spring) and a gold highlight
 * fading over 1.5 s, and their hash resolves with MP TextScramble. The oldest row fades out.
 */
export function AuditPanel() {
  const { t } = useTranslation()
  const rows = useSim((s) => selectAuditTail(s, AUDIT_ROWS))
  const container = useStaggerVariants(PANEL_BEAT_MS.T, 30)
  const [initialIds] = useState(() => new Set(rows.map((row) => row.id)))
  const newestId = rows[0]?.id
  const scrollRef = useRef<HTMLDivElement>(null)
  const edges = useScrollEdges(scrollRef, rows.length > 0)

  return (
    <Panel
      id="T"
      icon={ShieldCheck}
      title={t('session.audit.title')}
      className="sm-area-audit"
      bodyClassName="sm-scroll-body"
      action={
        <Link to="/security-audit" className="sm-card-link">
          {t('session.audit.viewAll')}
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      }
    >
      <ScrollShadow ref={scrollRef} className="sm-scroll" size={24} visibility={edges}>
        {rows.length === 0 ? (
          <p className="sm-empty">{t('session.audit.empty')}</p>
        ) : (
          <motion.ol className="sm-audit-list" variants={container} data-testid="sm-audit-list" aria-label={t('session.audit.title')}>
            <AnimatePresence initial={false}>
              {rows.map((row) =>
                initialIds.has(row.id) ? (
                  <AuditLine key={row.id} row={row} inserted={false} highlight={false} />
                ) : (
                  <AuditLine key={row.id} row={row} inserted highlight={row.id === newestId} />
                ),
              )}
            </AnimatePresence>
          </motion.ol>
        )}
      </ScrollShadow>
    </Panel>
  )
}

const AuditLine = memo(function AuditLine({ row, inserted, highlight }: { row: AuditRow; inserted: boolean; highlight: boolean }) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const tone = severityTone(row)
  const hash = shortHash(row.hash)
  const content = (
    <div className="sm-audit-row" data-audit-type={row.type} data-severity={row.severity}>
      <span className={cn('sm-dot', `sm-dot-${tone}`)} aria-hidden="true" />
      <time className="sm-audit-time" dateTime={new Date(row.at).toISOString()}>
        {formatClock(row.at)}
      </time>
      <span className="sm-audit-message">{auditTypeWords(t, row.type)}</span>
      {inserted ? (
        <TextScramble as="span" className="sm-audit-hash" characterSet={HEX} duration={SCRAMBLE_S} aria-label={t('session.audit.hash', { hash })}>
          {hash}
        </TextScramble>
      ) : (
        <span className="sm-audit-hash" aria-label={t('session.audit.hash', { hash })}>
          {hash}
        </span>
      )}
    </div>
  )
  if (inserted) {
    return (
      <li className="sm-audit-item" data-inserted="true">
        <AnimatedListItem highlight={highlight}>{content}</AnimatedListItem>
      </li>
    )
  }
  return (
    <motion.li className="sm-audit-item" variants={m.variants.row} exit={{ opacity: 0, transition: m.transitions.exit }}>
      {content}
    </motion.li>
  )
})
