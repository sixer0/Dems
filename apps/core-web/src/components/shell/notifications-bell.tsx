import { useEffect, useRef, useState } from 'react'
import { Badge, Button, Popover } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { motion, useAnimate } from 'motion/react'
import { Bell, CircleAlert, Info, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DATE_PATTERNS, formatDate } from '@dems/shared/realtime'
import { selectActiveAlerts, selectUnacknowledgedAlertCount, useSim, type SimState } from '@dems/shared/sim'
import { motion as tokens } from '@dems/shared/tokens'
import { useMotionPolicy } from '@/motion'

const LATEST_ALERTS = 5
/** M-SH-06: the bell swings 0 → 12° → −8° → 0 in about 600 ms (spec literals, D49). */
const SWING_KEYFRAMES = [0, 12, -8, 0]
const SWING_MS = 600
/** R8: at most one swing per 5 s burst of new alerts. */
const BELL_SWING_THROTTLE_MS = 5000

const SEVERITY_ICON: Record<string, LucideIcon> = {
  CRITICAL: CircleAlert,
  WARNING: TriangleAlert,
}

/** Newest active alerts first; alert objects come from the store, so `useSim` stays shallow-stable. */
function selectLatestAlerts(s: SimState) {
  return selectActiveAlerts(s).slice(-LATEST_ALERTS).reverse()
}

/**
 * Bell (01_specs §14.4 item 8; research/04 §9 #37): kit icon-only `Button` with a `Badge` count of
 * unacknowledged alerts, opening a `Popover` of the latest alerts. Alert text is simulator data.
 *
 * Motion (M-SH-06): when the unacknowledged count rises, the badge pops (scale 0.6 → 1, spring
 * `bouncy`) and the bell swings (0 → 12° → −8° → 0, ≈600 ms), at most once per 5 s burst (R8).
 * The badge scale goes through the CSS `scale` property (`--dems-badge-scale`), so the kit's own
 * `translate` placement transform is untouched. Reduced motion: the badge simply appears.
 */
export function NotificationsBell() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const count = useSim(selectUnacknowledgedAlertCount)
  const alerts = useSim(selectLatestAlerts)
  const [swingScope, swings] = useAlertSwing(count)
  const label =
    count > 0
      ? `${t('shell.notifications.button')}, ${t('shell.notifications.count', { count })}`
      : t('shell.notifications.button')

  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      <span ref={swingScope} className="dems-bell-scope" data-swings={swings}>
        <Badge.Anchor className="dems-bell">
          <Button isIconOnly variant="ghost" aria-label={label} data-testid="notifications-bell" className="dems-icon-button">
            <motion.span className="dems-bell-swing" data-bell-swing="" aria-hidden="true">
              <Bell data-shell-slot="bell-icon" aria-hidden="true" size={22} strokeWidth={1.75} />
            </motion.span>
          </Button>
          {count > 0 ? (
            <Badge color="danger" size="sm" placement="top-right" data-shell-slot="bell-badge" aria-hidden="true">
              {count > 9 ? '9+' : count}
            </Badge>
          ) : null}
        </Badge.Anchor>
      </span>
      <Popover.Content placement="bottom end" offset={8} className="w-[360px] max-w-[calc(100vw-24px)]">
        <Popover.Dialog aria-label={t('shell.notifications.title')}>
          <Popover.Heading className="dems-popover-heading">{t('shell.notifications.title')}</Popover.Heading>
          {alerts.length === 0 ? (
            <p className="dems-popover-empty">{t('shell.notifications.empty')}</p>
          ) : (
            <ul className="dems-alert-list">
              {alerts.map((alert) => {
                const Icon = SEVERITY_ICON[alert.severity] ?? Info
                return (
                  <li key={alert.id} className="dems-alert-row" data-severity={alert.severity}>
                    <Icon className="dems-alert-icon" aria-hidden="true" size={16} />
                    <span className="dems-alert-message">{alert.message}</span>
                    <time className="dems-alert-time" dateTime={new Date(alert.at).toISOString()}>
                      {formatDate(alert.at, DATE_PATTERNS.time)}
                    </time>
                  </li>
                )
              })}
            </ul>
          )}
          <Link to="/security-audit" className="dems-popover-link" onClick={() => setOpen(false)}>
            {t('shell.notifications.viewAll')}
          </Link>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  )
}

/**
 * Plays the M-SH-06 swing and badge pop when `count` rises. Returns the animation scope and how many
 * swings have played (rendered as `data-swings`, for tests and scripted checks).
 */
function useAlertSwing(count: number) {
  const m = useMotionPolicy()
  const [scope, animate] = useAnimate<HTMLSpanElement>()
  const previous = useRef(count)
  const lastSwingAt = useRef(Number.NEGATIVE_INFINITY)
  const [swings, setSwings] = useState(0)

  useEffect(() => {
    const before = previous.current
    previous.current = count
    const root = scope.current
    if (count <= before || m.reduced || !root) return
    const now = performance.now()
    if (now - lastSwingAt.current < BELL_SWING_THROTTLE_MS * m.timeScale) return
    lastSwingAt.current = now
    const bell = root.querySelector('[data-bell-swing]')
    const badge = root.querySelector('[data-shell-slot="bell-badge"]')
    if (bell) {
      void animate(bell, { rotate: SWING_KEYFRAMES }, {
        duration: m.seconds(SWING_MS),
        ease: tokens.easing.emphasized,
        times: [0, 0.3, 0.65, 1],
      })
    }
    if (badge) void animate(badge, { '--dems-badge-scale': [0.6, 1] }, m.spring('bouncy'))
    setSwings((value) => value + 1)
  }, [count, m, animate, scope])

  return [scope, swings] as const
}
