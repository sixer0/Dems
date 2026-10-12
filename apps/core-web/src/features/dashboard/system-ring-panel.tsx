import { DemoMark } from '@/components/demo-mark'
import { useId } from 'react'
import useMeasure from 'react-use-measure'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { useSim } from '@dems/shared/sim'
import { motion as tokens } from '@dems/shared/tokens'
import { GlowRing } from '@/components/composed'
import { usePlatformNotReported } from '@/lib/own-capture'
import { selectStatedAlertCount, selectStatedAlertMessage, useSystemStatement } from '@/lib/system-statement'
import { useMotionPolicy } from '@/motion'
import { DashPanel } from './dash-panel'
import { DASH_BEATS, useBeatDelay } from './dashboard-motion'
import { selectRingPrimitives, selectNewestNoticeSession, selectOpenNoticeCount, selectRingBlockedSession, selectRingRetryingSession } from './sim-adapter'

/** Ring size bounds: hero ≈ 320 at 1920 (M-C-01), smaller at 1440; never below a legible 180. */
const RING_MIN = 180
const RING_MAX = 336
/** Used before the first measurement (and in jsdom, which has no layout). */
const RING_FALLBACK = 300
/** Below this size the caption becomes screen-reader text (the centre has no room for 3 lines). */
const CAPTION_MIN_SIZE = 276
/** The centre words start 1,000 ms into the ring sequence (M-C-01); the details follow them. */
const DETAILS_AFTER_MS = 1250

/**
 * Panel A, the SYSTEM READY ring (01_specs §14.5.1 A; research/04 §3.1 A; M-C-01).
 *
 * GlowRing in `hero` mode with the state from the simulator. Below the state word it shows the
 * flags line ("SECURE • HEALTHY • OPERATIONAL", or the issue count) and the state caption. The
 * ring is the page's hero moment: its sweep starts at 900 ms and finishes last (R3, M-PG-DASH).
 * Its two ambient loops (rotation, breathing) are two of the page's four (§9.4).
 */
export function SystemRingPanel() {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  // Primitives only (review rule R1; stable since step 54, review 40 M1).
  const ring = useSim(selectRingPrimitives)
  const ringDelay = useBeatDelay(DASH_BEATS.ring)
  const [measureRef, bounds] = useMeasure({ debounce: 60 })
  const measured = Math.min(bounds.width, bounds.height)
  const size = measured > 0 ? Math.round(Math.max(RING_MIN, Math.min(RING_MAX, measured - 12))) : RING_FALLBACK
  const platformNotReported = usePlatformNotReported()
  const gradientId = `dash-ring-arc-${useId().replace(/[^A-Za-z0-9_-]/g, '_')}`

  // A critical fault during a recording does not stop it (the ring then reads CRITICAL while
  // `since` still carries the recording start): say so instead of "blocks recording" (F45-06).
  const captionKey = ring.state === 'CRITICAL' && ring.since !== null ? 'CRITICAL_RECORDING' : ring.state
  // Fix wave L (G75d-03, G75d-01): a blocked seal and an open unsealable notice are said ON the ring.
  const blockedSessionId = useSim(selectRingBlockedSession)
  const openNotices = useSim(selectOpenNoticeCount)
  const noticeSessionId = useSim(selectNewestNoticeSession)
  const blocked = blockedSessionId !== null
  // Fix wave M (G75e-06): while the Core retries a seal by itself the ring says so (the system's own flags say nothing of it).
  const retryingSessionId = useSim(selectRingRetryingSession)
  const retrying = !blocked && retryingSessionId !== null && (ring.state === 'READY' || ring.state === 'RECORDING')
  const noticeOnly = !blocked && !retrying && openNotices > 0 && ring.state === 'READY' && !ring.connecting
  // Fix wave M (G75e-04, ruling D234 (1) after D228 (2)): the open notice is said ALSO while a session records beside
  // it. The ring stays the recording ring (REC, the timer); its line and its caption state the notice, never "SECURE".
  const noticeRecording = !blocked && !retrying && openNotices > 0 && ring.state === 'RECORDING'
  // Fix wave J (JW-04, JW-05, JT-01; truth rule 3c): the ring reads the SAME statement as the header pill
  // (`lib/system-statement.ts`). Two facts the ring's own flags do not hold: a lost Core link ("state unknown", never
  // READY) and an active alert no flag stands for (an unreachable capture source) - also while a session records.
  const statement = useSystemStatement()
  const alertCount = useSim(selectStatedAlertCount)
  const alertMessage = useSim(selectStatedAlertMessage)
  const offline = statement.kind === 'CORE_OFFLINE'
  const alertActive = !offline && !blocked && !retrying && alertCount > 0 && (ring.state === 'READY' || ring.state === 'RECORDING')
  const alertCritical = alertActive && statement.kind === 'CRITICAL'
  const ringState = offline ? 'UNKNOWN' : blocked ? 'CRITICAL' : alertCritical ? 'CRITICAL' : retrying || noticeOnly || (alertActive && ring.state === 'READY') ? 'ATTENTION' : ring.state
  // Integration pass D7 item 3 (ux §8e.2; D84, D91): before the first durable fragment the ring is not the
  // recording ring (the adapter sends the system's own state, no REC, no timer) and the line under it says so.
  const statusLine = offline
    ? t('web.waveJ.ring.offlineSub')
    : blocked
    ? t('web.waveL.notice.blockedRingSub')
    : alertActive
      ? t(ring.state === 'RECORDING' ? 'web.waveJ.ring.alertRecording' : 'web.waveJ.ring.alertSub', { count: alertCount })
    : retrying
      ? t('web.waveM.ring.retrySub')
    : noticeRecording
      ? t('web.waveM.ring.noticeRecording')
    : noticeOnly
      ? t('web.waveL.notice.ringSub')
      : ring.connecting
    ? t('common.session.connectingCameras')
    : ring.state === 'READY'
      ? // Fix wave K (C-2 / G75c-04): "SECURE" is a posture no Core computed where it states `security.platformNotReported`.
        platformNotReported
        ? t('web.realCore.dashboard.ringFlags')
        : t('dashboard.systemRing.flags')
      : ring.state === 'RECORDING' && platformNotReported
        ? // Fix wave M (G75e-04): "SECURE • HEALTHY" is a posture no Core computed where it states `security.platformNotReported` - also while it records.
          t('web.waveM.ring.recordingFlags')
      : ring.state === 'RECORDING' || ring.state === 'UNKNOWN'
        ? t(`dashboard.systemRing.statusLine.${ring.state}`)
        : t('dashboard.systemRing.issues', { count: ring.issues })

  return (
    <DashPanel id="a" beatMs={DASH_BEATS.hero} surface="bare" ariaLabel={t(`dashboard.systemRing.ariaLabel.${ringState}`)}>
      <div
        ref={measureRef}
        className="dems-dash-ring-cell"
        data-ring-size={size}
        data-connecting={ring.connecting ? 'true' : undefined}
        data-statement={statement.kind}
        data-core-offline={offline ? 'true' : undefined}
        data-alert-active={alertActive ? 'true' : undefined}
        data-seal-blocked={blocked ? 'true' : undefined}
        data-open-notice={noticeOnly || noticeRecording ? 'true' : undefined}
        data-seal-retrying={retrying ? 'true' : undefined}
      >
        {/* The ring card's edge curving towards the hero (research/04 §3.1 A). Static. */}
        <svg className="dems-dash-ring-arc" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="currentColor" stopOpacity="0" />
              <stop offset="0.45" stopColor="currentColor" stopOpacity="0.5" />
              <stop offset="1" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M 62 1 C 96 16, 100 70, 78 99" fill="none" stroke={`url(#${gradientId})`} strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
        </svg>
        <GlowRing state={ringState} size={size} mode="hero" recordingSince={offline || blocked || retrying ? null : ring.since} delayMs={ringDelay}>
          <motion.div
            className="dems-ring-details"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{
              duration: m.seconds(m.reduced ? tokens.duration.fast : tokens.duration.slow),
              delay: m.reduced ? 0 : m.seconds(ringDelay + DETAILS_AFTER_MS),
              ease: tokens.easing.luxe,
            }}
          >
            <span className="dems-ring-status" data-testid="ring-status-line">
              {statusLine}
            </span>
            {/* Fix wave J (JW-07): "SECURE • HEALTHY • OPERATIONAL" of the demonstration Core is marked as that. */}
            <DemoMark block="dashboard-ring" className="dems-ring-demo" long />
            <span className={size < CAPTION_MIN_SIZE ? 'sr-only' : 'dems-ring-caption'}>
              {offline
                ? t('web.waveJ.ring.offlineDetail')
                : blocked
                ? t('web.waveL.notice.blockedRingDetail', { sessionId: blockedSessionId })
                : alertActive
                  ? alertMessage
                : retrying
                  ? t('web.waveM.ring.retryDetail', { sessionId: retryingSessionId })
                : noticeOnly || noticeRecording
                  ? t('web.waveL.notice.ringDetail', { count: openNotices, sessionId: noticeSessionId ?? '' })
                  : ring.connecting
                    ? t('session.audioSource.connecting.detail')
                    : // Fix wave L (G75d-07): "All core services are running" counts the appliance model's services.
                      platformNotReported && captionKey === 'READY'
                      ? t('web.waveL.ringReadyCaption')
                      : t(`dashboard.systemRing.caption.${captionKey}`)}
            </span>
          </motion.div>
        </GlowRing>
      </div>
    </DashPanel>
  )
}
