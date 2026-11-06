import { Chip } from '@heroui/react'
import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { ChevronDown, Cpu, Satellite, SatelliteDish, Server, Timer, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DATE_PATTERNS, formatDate } from '@dems/shared/realtime'
import { selectClockSecond, useSim } from '@dems/shared/sim'
import { toneChipProps } from '@dems/shared/tokens'
import { OrbitingCircles } from '@/components/ui/orbiting-circles'
import { isOwnCaptureCore } from '@/lib/own-capture'
import { useMotionPolicy } from '@/motion'
import { ORBIT_FADE_MS, TIME_TIER_LAYOUT_ID } from './choreography'
import { formatOffset, secondsSince, TIERS, tierState, TIER_TONE, type TimeTier } from './model'
import { NetworkTimePanel } from './panel'

const TIER_ICON: Record<TimeTier, LucideIcon> = { GNSS: Satellite, NTP: Server, RTC: Cpu }

/** Satellites drawn on the two orbits (the sim reports 9–13 in view; the drawing caps at 8). */
const INNER_MAX = 3
const OUTER_MAX = 5

/**
 * Time-source hierarchy (01_specs §14.5.6 row 2; design book §2.2 "GNSS/PPS → System Time Service;
 * NTP priority; RTC fallback"; FMEA §23.1 "fallback to trusted NTP, then RTC; log source").
 *
 * - Left: the GNSS constellation (MU **OrbitingCircles**, the page's hero moment). It turns only
 *   while GNSS is locked and fades out on loss (M-PG-NET), leaving "NO FIX".
 * - Right: the three tiers in priority order. The active tier carries the one `time-tier`
 *   highlight (R5), which moves down to NTP on GNSS loss, down again to the RTC, and back up on
 *   recovery (spring `gentle`; a cross-fade under reduced motion, §8).
 * - Footer: lock, stratum, last sync, offset and server.
 *
 * A CORE IN ITS OWN CAPTURE (fix wave I, G75b-06) has no such hierarchy: its time is the host system
 * clock (`time.hostClock`). The panel then states that one fact. No constellation ("NO FIX" would say
 * a receiver lost its signal), no tiers ("RTC Active", "Signal lost"), no stratum, offset or last
 * synchronisation (zeros of the slice, never measured) are drawn.
 */
export function HierarchyPanel() {
  const { t } = useTranslation()
  const time = useSim((s) => s.time)
  const holdoverSince = useSim((s) => s.faults.active.find((fault) => fault.kind === 'GNSS_LOSS' && fault.target === 'RTC')?.since ?? null)
  const hostClock = isOwnCaptureCore({ time })
  if (hostClock) {
    return (
      <NetworkTimePanel id="hierarchy" icon={Timer} title={t('networkTime.hierarchy.title')} bodyClassName="nt-hier-body">
        <div className="nt-chart-empty" data-testid="network-time-host-clock">
          <p className="nt-tier-name">
            <Cpu className="nt-tier-icon" aria-hidden="true" strokeWidth={1.75} />
            <span className="nt-tier-label">{t('web.ownCore.time.value')}</span>
          </p>
          <p className="nt-collecting">{t('web.ownCore.time.hierarchyNotice')}</p>
        </div>
      </NetworkTimePanel>
    )
  }
  return (
    <NetworkTimePanel
      id="hierarchy"
      icon={Timer}
      title={t('networkTime.hierarchy.title')}
      action={<span className="nt-note">{t('networkTime.hierarchy.note')}</span>}
      bodyClassName="nt-hier-body"
    >
      <div className="nt-hier">
        <Constellation locked={time.gnss.locked} satellites={time.gnss.satellites} />
        <LayoutGroup id="nt-time-tiers">
          <ol className="nt-tiers" data-testid="network-time-tiers" data-active={time.source}>
            {TIERS.map((tier, index) => {
              const state = tierState(time, tier)
              const Icon = TIER_ICON[tier]
              const active = state === 'ACTIVE'
              let detail: string
              if (tier === 'GNSS') {
                detail = time.gnss.locked
                  ? t('networkTime.hierarchy.tierDetail.GNSS', { satellites: time.gnss.satellites })
                  : t('networkTime.hierarchy.tierDetail.GNSS_LOST')
              } else if (tier === 'NTP') {
                detail = time.ntp.reachable
                  ? t('networkTime.hierarchy.tierDetail.NTP', { server: time.ntp.server, stratum: time.ntp.stratum })
                  : t('networkTime.hierarchy.tierDetail.NTP_DOWN', { server: time.ntp.server })
              } else {
                detail =
                  active && holdoverSince !== null
                    ? t('networkTime.hierarchy.tierDetail.RTC_ACTIVE', { since: formatDate(holdoverSince, DATE_PATTERNS.time) })
                    : t('networkTime.hierarchy.tierDetail.RTC', { drift: time.rtc.driftPpm })
              }
              return (
                <li key={tier} className="nt-tier-item">
                  <div className="nt-tier" data-state={state} data-testid={`network-time-tier-${tier}`}>
                    {active ? <TierHighlight /> : null}
                    <span className="nt-tier-rank" aria-hidden="true">
                      {index + 1}
                    </span>
                    <Icon className="nt-tier-icon" aria-hidden="true" strokeWidth={1.75} />
                    <div className="nt-tier-text">
                      <p className="nt-tier-name">
                        <span className="nt-mono">{tier}</span>
                        <span className="nt-tier-label">{t(`networkTime.hierarchy.tiers.${tier}`)}</span>
                      </p>
                      <p className="nt-tier-detail">{detail}</p>
                    </div>
                    <Chip size="sm" variant="soft" {...toneChipProps(TIER_TONE[state])} className="nt-tier-chip">
                      {t(`networkTime.hierarchy.tierState.${state}`)}
                    </Chip>
                  </div>
                  {index < TIERS.length - 1 ? (
                    <div className="nt-tier-link" aria-hidden="true">
                      <ChevronDown className="nt-tier-link-icon" strokeWidth={1.75} />
                      <span>{t('networkTime.hierarchy.fallback')}</span>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ol>
        </LayoutGroup>
      </div>
      <TimeFacts />
    </NetworkTimePanel>
  )
}

/** The one active-tier highlight: a shared element under full motion, a cross-fade when reduced. */
function TierHighlight() {
  const m = useMotionPolicy()
  if (!m.flags.sharedLayout) {
    return (
      <motion.span
        className="nt-tier-highlight"
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={m.transitions.crossFade}
      />
    )
  }
  return <motion.span layoutId={TIME_TIER_LAYOUT_ID} className="nt-tier-highlight" aria-hidden="true" transition={m.transitions.layout} />
}

function Constellation({ locked, satellites }: { locked: boolean; satellites: number }) {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const inner = Math.min(INNER_MAX, satellites)
  const outer = Math.min(OUTER_MAX, Math.max(0, satellites - INNER_MAX))
  return (
    <div
      className="nt-orbit"
      data-testid="network-time-orbit"
      data-locked={locked ? 'true' : 'false'}
      role="img"
      aria-label={locked ? t('networkTime.hierarchy.orbitLabel', { satellites }) : t('networkTime.hierarchy.orbitLost')}
    >
      <motion.div
        className="nt-orbit-rings"
        initial={false}
        animate={{ opacity: locked ? 1 : 0.18 }}
        transition={{ duration: m.seconds(ORBIT_FADE_MS) }}
      >
        <AnimatePresence initial={false}>
          {locked ? (
            <motion.div
              key="sats"
              className="nt-orbit-sats"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: m.seconds(ORBIT_FADE_MS) }}
            >
              <OrbitingCircles radius={46} duration={36} iconSize={16} active={locked} loopGroup="nt-orbit">
                {Array.from({ length: inner }, (_, i) => (
                  <SatDot key={i} />
                ))}
              </OrbitingCircles>
              <OrbitingCircles radius={78} duration={60} iconSize={16} reverse active={locked} loopGroup="nt-orbit">
                {Array.from({ length: outer }, (_, i) => (
                  <SatDot key={i} />
                ))}
              </OrbitingCircles>
            </motion.div>
          ) : (
            <OrbitPaths key="paths" />
          )}
        </AnimatePresence>
      </motion.div>
      <div className="nt-orbit-core">
        <SatelliteDish className="nt-orbit-dish" aria-hidden="true" strokeWidth={1.5} />
      </div>
      <p className="nt-orbit-caption" data-testid="network-time-orbit-caption">
        {locked ? t('networkTime.hierarchy.satellites', { satellites }) : t('networkTime.hierarchy.noFix')}
      </p>
    </div>
  )
}

function SatDot() {
  return (
    <span className="nt-sat">
      <Satellite className="nt-sat-icon" aria-hidden="true" strokeWidth={2} />
    </span>
  )
}

/** The two orbit paths without satellites (GNSS lost). */
function OrbitPaths() {
  return (
    <svg className="nt-orbit-paths" viewBox="0 0 180 180" aria-hidden="true">
      <circle cx="90" cy="90" r="46" />
      <circle cx="90" cy="90" r="78" />
    </svg>
  )
}

function TimeFacts() {
  const { t } = useTranslation()
  const time = useSim((s) => ({
    locked: s.time.locked,
    stratum: s.time.stratum,
    offsetMs: s.time.offsetMs,
    lastSyncAt: s.time.lastSyncAt,
    server: s.time.ntp.server,
  }))
  const nowSecond = useSim(selectClockSecond)
  const ago = secondsSince(nowSecond, time.lastSyncAt)
  const syncTime = formatDate(time.lastSyncAt, DATE_PATTERNS.time)
  const lastSync =
    ago < 120
      ? t('networkTime.hierarchy.agoSeconds', { time: syncTime, seconds: ago })
      : t('networkTime.hierarchy.agoMinutes', { time: syncTime, minutes: Math.floor(ago / 60) })
  return (
    <dl className="nt-facts" data-testid="network-time-facts">
      <div className="nt-kv-item">
        <dt>{t('networkTime.hierarchy.lock')}</dt>
        <dd className={time.locked ? 'nt-ok' : 'nt-warn'}>
          {time.locked ? t('networkTime.hierarchy.locked') : t('networkTime.hierarchy.unlocked')}
        </dd>
      </div>
      <div className="nt-kv-item">
        <dt>{t('networkTime.hierarchy.stratum')}</dt>
        <dd className="nt-mono">{time.stratum}</dd>
      </div>
      <div className="nt-kv-item">
        <dt>{t('networkTime.hierarchy.lastSync')}</dt>
        <dd className="nt-mono" data-testid="network-time-last-sync">
          {lastSync}
        </dd>
      </div>
      <div className="nt-kv-item">
        <dt>{t('networkTime.hierarchy.offset')}</dt>
        <dd className="nt-mono" data-testid="network-time-offset">
          {t('networkTime.hierarchy.offsetValue', { value: formatOffset(time.offsetMs) })}
        </dd>
      </div>
      <div className="nt-kv-item">
        <dt>{t('networkTime.hierarchy.server')}</dt>
        <dd className="nt-mono">{time.server}</dd>
      </div>
    </dl>
  )
}
