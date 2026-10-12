import { useEffect, useMemo, useRef, useState } from 'react'
import { Badge, Button, Popover, toast } from '@heroui/react'
import { Link } from '@tanstack/react-router'
import { motion, useAnimate } from 'motion/react'
import { Bell, CircleAlert, Info, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AcknowledgeAllButton, AcknowledgeAllDialog } from './acknowledge-all'
import { useAcknowledgeAll } from './use-acknowledge-all'
import { openAlertsOf, selectOpenUnacknowledgedCount } from './open-alerts'
import { DATE_PATTERNS, formatDate } from '@dems/shared/realtime'
import { settle, useCoreActions } from '@dems/shared/live'
import { SEAL_UNSEALABLE_PLAIN_SENTENCE, canResolveUnsealable, isUnsealableAlert, selectOperator, useSim, type SimAlert, type SimState } from '@dems/shared/sim'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import { usePendingControl } from '@/lib/pending-control'
import { reportShellError } from './shell-report'
import { motion as tokens } from '@dems/shared/tokens'
import { captureFailedStartOf, captureNoticeLine, captureNoticeOf, type CaptureFailedStart } from '@/lib/capture-notices'
import { failedStartAlertLine } from './failed-start-alert'
import { useMotionPolicy } from '@/motion'

/** M-SH-06: the bell swings 0 → 12° → −8° → 0 in about 600 ms (spec literals, D49). */
const SWING_KEYFRAMES = [0, 12, -8, 0]
const SWING_MS = 600
/** R8: at most one swing per 5 s burst of new alerts. */
const BELL_SWING_THROTTLE_MS = 5000

const SEVERITY_ICON: Record<string, LucideIcon> = {
  CRITICAL: CircleAlert,
  WARNING: TriangleAlert,
}

/** The store's alert list (a stable reference); the open ones are derived while rendering (`open-alerts.ts`). */
const selectAlerts = (s: SimState) => s.alerts

/** The failed start of the open session (FAULT with `captureDurable: false`), or null: a primitive. */
const selectFailedStart = (s: SimState): CaptureFailedStart | null => captureFailedStartOf(s.session, s.alerts)

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
  // Fix wave J (JA2-25 / JW-21; ruling): the badge counts every alert still OPEN for the operator - also one the Core
  // resolved that nobody acknowledged - and the popover lists them, each with its acknowledgement.
  const count = useSim(selectOpenUnacknowledgedCount)
  const allAlerts = useSim(selectAlerts)
  const alerts = useMemo(() => openAlertsOf(allAlerts), [allAlerts])
  const failedStart = useSim(selectFailedStart)
  const [swingScope, swings] = useAlertSwing(count)
  // The confirmation and the run live here, outside the popover: it closes when the confirmation opens.
  const acknowledgeAll = useAcknowledgeAll('bell', () => setOpen(false))
  const label =
    count > 0
      ? `${t('shell.notifications.button')}, ${t('shell.notifications.count', { count })}`
      : t('shell.notifications.button')

  return (
    <>
    <AcknowledgeAllDialog control={acknowledgeAll} />
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
          {/* Fix wave J round three: a backlog is cleared with one confirmed press (`acknowledge-all.tsx`). */}
          <AcknowledgeAllButton control={acknowledgeAll} />
          {alerts.length === 0 ? (
            <p className="dems-popover-empty">{t('shell.notifications.empty')}</p>
          ) : (
            <ul className="dems-alert-list dems-alert-scroll" data-testid="bell-open-alerts">
              {alerts.map((alert) => {
                const Icon = SEVERITY_ICON[alert.severity] ?? Info
                // Task 3 R-10 (blueprint row 137; ux §8e.1): a no-device notice is worded from `params.reason`,
                // with the device by label and id; every other alert keeps the Core's text.
                const notice = captureNoticeOf(alert)
                // Pass D7 item 3: the critical alert of a session start that recorded nothing says so, from its reason.
                const failedLine = failedStartAlertLine(t, alert, failedStart)
                // Fix wave L (G75d-01, ruling D228 (2)): the open notice of a recording that could not be sealed -
                // its plain sentence, its session, its cause as a detail, and the acknowledgement that closes it.
                if (isUnsealableAlert(alert)) return <UnsealableNoticeRow key={alert.id} alert={alert} />
                return (
                  <li key={alert.id} className="dems-alert-row" data-severity={alert.severity}>
                    <Icon className="dems-alert-icon" aria-hidden="true" size={16} />
                    <span className="dems-alert-message" data-notice={failedLine !== null ? 'FAILED_START' : notice?.kind}>
                      {failedLine ?? (notice === null ? alert.message : captureNoticeLine(t, notice))}
                    </span>
                    <time className="dems-alert-time" dateTime={new Date(alert.at).toISOString()}>
                      {formatDate(alert.at, DATE_PATTERNS.time)}
                    </time>
                    {!alert.active ? (
                      <span className="dems-alert-resolved" data-testid={`alert-resolved-${alert.id}`}>
                        {t('web.waveJ.alerts.resolvedOpen')}
                      </span>
                    ) : null}
                    {alert.acknowledged ? null : <AcknowledgeAlert alertId={alert.id} />}
                  </li>
                )
              })}
            </ul>
          )}
          {/* Fix wave J (JW-21): the alerts have a page of their own - every alert, cleared ones too, with its acknowledgement. */}
          <Link to="/alerts" className="dems-popover-link" onClick={() => setOpen(false)} data-testid="bell-all-alerts">
            {t('web.waveJ.alerts.link')}
          </Link>
          <Link to="/security-audit" className="dems-popover-link" onClick={() => setOpen(false)}>
            {t('shell.notifications.viewAll')}
          </Link>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
    </>
  )
}

/**
 * Fix wave L (G75d-01; `contract_wave_l.md` section 1): THE OPEN NOTICE "this recording could not be
 * sealed" in the alerts list. It states a condition of ITS session (named in the row), blocks no
 * recording, and ends in one way: operation 70 `acknowledgeAlert` sent by a role that holds the
 * permission (`canResolveUnsealable`, a supervisor today). That role gets the control; every other
 * role reads who can. The code of the cause is a detail, never part of the sentence (G75d-04).
 * The control works on an alert that is already `acknowledged` and still active.
 */
function UnsealableNoticeRow({ alert }: { alert: SimAlert }) {
  const { t } = useTranslation()
  const actions = useCoreActions()
  const presentCoreError = useCoreErrorPresenter()
  const { busy, pending, run } = usePendingControl()
  const role = useSim((s) => selectOperator(s)?.role ?? null)
  const mayClose = canResolveUnsealable(role)
  const sessionId = typeof alert.params?.['sessionId'] === 'string' ? alert.params['sessionId'] : (alert.target ?? null)
  const cause = typeof alert.params?.['cause'] === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(alert.params['cause']) ? alert.params['cause'] : null
  const acknowledge = () =>
    run((release) => {
      settle(() => actions.acknowledgeAlert(alert.id), {
        ok: () => undefined,
        fail: (error) => {
          if (presentCoreError(error) !== null) return
          reportShellError('NotificationsBell.acknowledgeUnsealable', error, 'The acknowledgement of an unsealable notice was not accepted', { alertId: alert.id })
        },
        done: release,
      })
    })
  return (
    <li className="dems-alert-row dems-alert-row-notice" data-severity={alert.severity} data-notice="UNSEALABLE" data-testid={`alert-unsealable-${alert.id}`} aria-busy={busy || undefined}>
      <CircleAlert className="dems-alert-icon" aria-hidden="true" size={16} />
      <span className="dems-alert-message">
        <span data-testid={`alert-unsealable-sentence-${alert.id}`}>{SEAL_UNSEALABLE_PLAIN_SENTENCE}</span>
        <span className="dems-alert-detail">
          {sessionId !== null ? t('web.waveL.notice.ofSession', { sessionId }) : null}
          {sessionId !== null && cause !== null ? ' · ' : null}
          {cause !== null ? t('web.waveL.notice.cause', { cause }) : null}
        </span>
        {mayClose ? (
          <Button size="sm" variant="outline" onPress={acknowledge} isDisabled={busy} isPending={pending} data-testid={`alert-unsealable-acknowledge-${alert.id}`}>
            {t('web.waveL.notice.acknowledge')}
          </Button>
        ) : (
          <span className="dems-alert-detail" data-testid={`alert-unsealable-who-${alert.id}`}>
            {t('web.waveL.notice.closeBySupervisor')}
          </span>
        )}
      </span>
      <time className="dems-alert-time" dateTime={new Date(alert.at).toISOString()}>
        {formatDate(alert.at, DATE_PATTERNS.time)}
      </time>
    </li>
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

/** Fix wave J (JW-21): the acknowledgement of one open alert (operation 70); the Core decides who may. */
function AcknowledgeAlert({ alertId }: { alertId: string }) {
  const { t } = useTranslation()
  const actions = useCoreActions()
  const presentCoreError = useCoreErrorPresenter()
  const { busy, pending, run } = usePendingControl()
  const acknowledge = () =>
    run((release) => {
      settle(() => actions.acknowledgeAlert(alertId), {
        fail: (error) => {
          if (presentCoreError(error) !== null) return
          reportShellError('NotificationsBell.acknowledge', error, 'The acknowledgement of an alert was not accepted', { alertId })
          toast.danger(t('common.errors.generic'))
        },
        done: release,
      })
    })
  return (
    <Button size="sm" variant="ghost" className="dems-alert-ack" onPress={acknowledge} isDisabled={busy} isPending={pending} data-testid={`alert-acknowledge-${alertId}`}>
      {t('web.waveJ.alerts.acknowledge')}
    </Button>
  )
}
