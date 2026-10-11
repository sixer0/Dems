import { Fragment, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { motion } from 'motion/react'
import { Clock, Database, Mic, Network, ShieldCheck, Video, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { selectDeviceStats, storageSummary, useSim, type SimState } from '@dems/shared/sim'
import type { StatusTone } from '@dems/shared/tokens'
import { motion as tokens } from '@dems/shared/tokens'
import { AnimatedNumber } from '@/components/ui/animated-number'
import { isOwnCaptureCore, isPlatformNotReportedCore } from '@/lib/own-capture'
import { useMotionPolicy } from '@/motion'
import { DashPanel } from './dash-panel'
import {
  cameraTone,
  formatOneDecimal,
  MIC_SUMMARY_TONE,
  micSummary,
  networkTone,
  POSTURE_TONE,
  STRIP_CELL_ROUTES,
  storageTone,
  timeTone,
  toTb,
  TONE_TEXT_CLASS,
  type StripCellId,
} from './dashboard-model'
import { DASH_BEATS, useBeatDelay, useHeldBeat } from './dashboard-motion'
import { StatusDot } from './status-bits'

const selectMicSummary = (s: SimState) => micSummary(s.mics)
/** The displayed value only (one decimal): bytes grow at 1 Hz while recording (§9.3 render budget). */
const selectStorageCell = (s: SimState) => {
  const summary = storageSummary(s)
  return { freeTb: toTb(summary.freeBytes), state: summary.state }
}
/** `hostClock`: a Core in its own capture - the host system clock, no time service (G75b-06). */
const selectTimeCell = (s: SimState) => ({ source: s.time.source, locked: s.time.locked, hostClock: isOwnCaptureCore(s) })
const selectPosture = (s: SimState) => s.security.posture
/** Closing pass J (D217 (7)): the Core states that it computes no posture (`security.platformNotReported`). */
const selectPlatformNotReported = (s: SimState) => isPlatformNotReportedCore(s)
const selectLinkUp = (s: SimState) => s.network.linkUp

interface CellSpec {
  id: StripCellId
  icon: LucideIcon
  label: string
  value: ReactNode
  /** Plain-text value for the accessible name. */
  valueText: string
  tone: StatusTone
  page: string
}

/**
 * Panel C, the status strip (01_specs §14.5.1 C; research/04 §3.1 C): six cells, each a link to
 * the page that explains it, with an icon in a gold-ringed disc, a label and a status dot plus
 * value. It sits on the lower edge of the hero, as drawn.
 *
 * Motion (M-PG-DASH t = 250): cells stagger 50 ms; each value arrives after the held beat (R4);
 * the free space counts up with AnimatedNumber. A tone change (a fault) moves the dot colour.
 *
 * Narrow widths (E-fix FX-W, E2E-W1-6): each cell sits in a `.dems-strip-item` wrapper (the strip's
 * flex item), which the sm/xs rules size to three cells per row (sm) or two (xs); there the value
 * text truncates with an ellipsis inside its cell instead of running into the next one (wider tiers
 * keep their look). The link's accessible name still carries the whole value.
 */
export function StatusStripPanel() {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const stripMs = useBeatDelay(DASH_BEATS.strip)
  const ready = useHeldBeat(DASH_BEATS.strip)

  const devices = useSim(selectDeviceStats)
  const mics = useSim(selectMicSummary)
  const storage = useSim(selectStorageCell)
  const time = useSim(selectTimeCell)
  const posture = useSim(selectPosture)
  const platformNotReported = useSim(selectPlatformNotReported)
  const linkUp = useSim(selectLinkUp)

  const freeTb = storage.freeTb
  const freeText = t('common.units.tb', { value: formatOneDecimal(freeTb) })
  const camerasValue =
    devices.camerasOnline === devices.camerasTotal
      ? t('dashboard.statusStrip.value.ready')
      : t('dashboard.statusStrip.value.camerasOnline', { online: devices.camerasOnline, total: devices.camerasTotal })
  const micValue =
    mics === 'clip'
      ? t('dashboard.statusStrip.value.micClip')
      : mics === 'noSignal'
        ? t('dashboard.statusStrip.value.micNoSignal')
        : t('dashboard.statusStrip.value.ready')
  const storageValue =
    storage.state === 'FULL' ? t('dashboard.statusStrip.value.storageFull') : t('dashboard.statusStrip.storageFree', { free: freeText })
  const timeValue = time.hostClock
    ? t('web.ownCore.time.value')
    : time.source === 'GNSS' && time.locked
      ? t('dashboard.statusStrip.value.timeGnss')
      : time.source === 'RTC'
        ? t('dashboard.statusStrip.value.timeRtc')
        : t('dashboard.statusStrip.value.timeNtp')
  // A posture that names a fault keeps its words; "Secure" that nobody computed reads "Not reported".
  const postureNotReported = platformNotReported && posture === 'SECURE'
  const postureValue = postureNotReported ? t('common.platformNotReported.value') : t(`dashboard.statusStrip.value.posture.${posture}`)
  // Fix wave L (G75d-07): "Connected" is the appliance model's LAN link; a Core in its own capture reports no network status (a link that is down in the state stays said).
  const networkValue = platformNotReported && linkUp ? t('common.platformNotReported.value') : linkUp ? t('common.status.connected') : t('common.status.disconnected')

  const cells: CellSpec[] = [
    {
      id: 'cameras',
      icon: Video,
      label: t('dashboard.statusStrip.cameras', { count: devices.camerasTotal }),
      value: camerasValue,
      valueText: camerasValue,
      tone: cameraTone(devices),
      page: t('shell.nav.devices'),
    },
    {
      id: 'mics',
      icon: Mic,
      label: t('dashboard.statusStrip.microphones', { count: devices.micsTotal }),
      value: micValue,
      valueText: micValue,
      tone: MIC_SUMMARY_TONE[mics],
      page: t('shell.nav.devices'),
    },
    {
      id: 'storage',
      icon: Database,
      label: t('dashboard.statusStrip.storage'),
      value:
        storage.state === 'FULL' ? (
          storageValue
        ) : (
          <span>
            <AnimatedNumber value={ready ? freeTb : 0} from={0} format={formatOneDecimal} />
            {` ${t('dashboard.statusStrip.storageFree', { free: 'TB' })}`}
          </span>
        ),
      valueText: storageValue,
      tone: storageTone(storage.state),
      page: t('shell.nav.storage'),
    },
    {
      id: 'time',
      icon: Clock,
      // G75b-06: "GNSS / Time - RTC holdover" said a lost synchronisation of a Core that has no time service.
      label: time.hostClock ? t('web.ownCore.time.label') : t('dashboard.statusStrip.time'),
      value: timeValue,
      valueText: timeValue,
      tone: time.hostClock ? 'default' : timeTone(time.source, time.locked),
      page: t('shell.nav.networkTime'),
    },
    {
      id: 'security',
      icon: ShieldCheck,
      label: t('dashboard.statusStrip.security'),
      value: postureValue,
      valueText: postureValue,
      tone: postureNotReported ? 'default' : POSTURE_TONE[posture],
      page: t('shell.nav.securityAudit'),
    },
    {
      id: 'network',
      icon: Network,
      label: t('dashboard.statusStrip.network'),
      value: networkValue,
      valueText: networkValue,
      tone: platformNotReported && linkUp ? 'default' : networkTone(linkUp),
      page: t('shell.nav.networkTime'),
    },
  ]

  return (
    <DashPanel id="c" beatMs={DASH_BEATS.strip} surface="bare" ariaLabel={t('dashboard.statusStrip.label')}>
      <div className="dems-strip-card rounded-xl">
        <nav className="dems-strip" aria-label={t('dashboard.statusStrip.label')}>
          {cells.map((cell, index) => (
            <Fragment key={cell.id}>
              {index > 0 ? <span className="dems-strip-sep" aria-hidden="true" /> : null}
              <motion.div
                className="dems-strip-item flex min-w-0"
                initial={m.reduced ? { opacity: 0 } : { opacity: 0, y: tokens.distance.riseSm }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  ...m.transitions.enter,
                  delay: m.reduced ? 0 : m.seconds(stripMs + index * DASH_BEATS.stripStagger),
                }}
              >
                <Link
                  to={STRIP_CELL_ROUTES[cell.id]}
                  className="dems-strip-cell"
                  data-testid={`strip-${cell.id}`}
                  data-tone={cell.tone}
                  aria-label={t('dashboard.statusStrip.cellLink', { label: cell.label, value: cell.valueText, page: cell.page })}
                >
                  <span className="dems-strip-icon" aria-hidden="true">
                    <cell.icon strokeWidth={1.75} />
                  </span>
                  <span className="dems-strip-text" aria-hidden="true">
                    <span className="dems-strip-label">{cell.label}</span>
                    <motion.span
                      className={`dems-strip-value ${TONE_TEXT_CLASS[cell.tone]}`}
                      // Fix wave L (G89c-08): a long value ("Host system clock") wraps inside its cell instead of running under the next icon.
                      data-long={cell.valueText.length > 12 ? 'true' : undefined}
                      initial={false}
                      animate={{ opacity: ready ? 1 : 0 }}
                      transition={m.transitions.crossFade}
                    >
                      <StatusDot tone={cell.tone} />
                      <span className="dems-strip-value-text">{cell.value}</span>
                    </motion.span>
                  </span>
                </Link>
              </motion.div>
            </Fragment>
          ))}
        </nav>
      </div>
    </DashPanel>
  )
}
