import type { ReactNode } from 'react'
import { Chip, Tooltip } from '@heroui/react'
import { Clock, Network, Settings, Shield, ShieldCheck, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DATE_PATTERNS, formatDate, formatUtcOffset } from '@dems/shared/realtime'
import { useSim, type SimState } from '@dems/shared/sim'
import type { StatusTone } from '@dems/shared/tokens'
import { isOwnCaptureCore, isPlatformNotReportedCore } from '@/lib/own-capture'
import { DashPanel } from './dash-panel'
import {
  chipColor,
  securityColumns,
  securityHeader,
  toneRank,
  TONE_TEXT_CLASS,
} from './dashboard-model'
import { DASH_BEATS, HELD_BEAT_AFTER_LAND_MS, useBeatDelay, useEscalationKey } from './dashboard-motion'
import { DrawIcon, Glint, StatusDot } from './status-bits'

const selectSecurityView = (s: SimState) => ({
  tpmOk: s.security.tpm.ok,
  tpmModel: s.security.tpm.model,
  secureBoot: s.security.secureBoot,
  encryption: s.security.encryption,
  hashAlgorithm: s.security.hashAlgorithm,
  posture: s.security.posture,
  controlsOpen: s.security.controls.filter((control) => !control.ok).length,
  activeAlerts: s.alerts.filter((alert) => alert.active).length,
  timeSource: s.time.source,
  timeLocked: s.time.locked,
  ownCore: isOwnCaptureCore(s),
  // Closing pass J (D217 (7)): the Core's own statement, read by name - not inferred from the time slice.
  platformNotReported: isPlatformNotReportedCore(s),
  linkUp: s.network.linkUp,
  ip: s.network.ip,
  lanName: s.network.lanName,
  gateway: s.network.gateway,
  linkSpeedMbps: s.network.linkSpeedMbps,
  poeActive: s.network.poe.activePorts,
  poeTotal: s.network.poe.totalPorts,
})
/** The panel shows the time to the minute: re-render once per simulator minute (§9.3). */
const selectMinute = (s: SimState) => Math.floor(s.clock.now / 60_000)
/** Tooltip-only details that change at 1 Hz: read only while the tooltip is open. */
const selectTimeDetails = (s: SimState) => ({
  source: s.time.source,
  stratum: s.time.stratum,
  offsetMs: s.time.offsetMs,
  lastSyncAt: s.time.lastSyncAt,
})

function TimeTooltip({ ownCore }: { ownCore: boolean }) {
  const { t } = useTranslation()
  const time = useSim(selectTimeDetails)
  // G75b-06: a host system clock has no stratum, no offset and no last synchronisation to quote.
  if (ownCore) return <>{t('web.ownCore.time.tooltip')}</>
  const zone = `UTC${formatUtcOffset()}`
  return (
    <>
      {t('dashboard.securityTimeNetwork.time.tooltip', {
        source: t(`common.enums.timeSource.${time.source}`),
        stratum: time.stratum,
        offset: time.offsetMs,
        time: `${formatDate(time.lastSyncAt, DATE_PATTERNS.time)} ${zone}`,
      })}
    </>
  )
}

interface ColumnProps {
  testId: string
  icon: LucideIcon
  /** Icon colour: the tone when degraded, else the drawn colour (green or gold, D1). */
  iconClass: string
  title: string
  chip: string
  tone: StatusTone
  lines: [string, string]
  tooltip: ReactNode
  drawMs: number
  glintMs: number
}

function Column({ testId, icon, iconClass, title, chip, tone, lines, tooltip, drawMs, glintMs }: ColumnProps) {
  const escalation = useEscalationKey(toneRank(tone))
  return (
    <Tooltip delay={400}>
      <Tooltip.Trigger className="dems-stn-col" data-testid={testId} data-tone={tone} aria-label={`${title}: ${chip}. ${lines.join(', ')}`}>
        <DrawIcon icon={icon} delayMs={drawMs} size={26} className={iconClass} />
        <span className="dems-stn-title" aria-hidden="true">
          {title}
        </span>
        <Chip size="sm" variant="soft" color={chipColor(tone)} className="dems-glint-host px-2 text-[0.625rem] font-semibold tracking-[0.08em]" aria-hidden="true">
          <Chip.Label>{chip}</Chip.Label>
          <Glint delayMs={escalation === 0 ? glintMs : 0} replayKey={escalation} />
        </Chip>
        <span className="dems-stn-line" aria-hidden="true">
          {lines[0]}
        </span>
        <span className="dems-stn-line" aria-hidden="true">
          {lines[1]}
        </span>
      </Tooltip.Trigger>
      <Tooltip.Content placement="top">{tooltip}</Tooltip.Content>
    </Tooltip>
  )
}

/**
 * Panel G, Security, Time & Network (01_specs §14.5.1 G; research/04 §3.1 G): four columns
 * (TPM / Secure Boot, GNSS / Time Sync, Network Status, Security Posture), each with an icon, a
 * soft status Chip, two detail lines and a Tooltip with the finer details. The header summarises
 * the worst column ("● All systems secure").
 *
 * Motion (M-PG-DASH t = 650): icons draw, chips glint once after the held beat; an escalation
 * replays the glint once (R8) while the chip colour follows the tone (M-C-10). Every time reads at
 * UTC+07:00 (AC-74).
 */
export function SecurityPanel() {
  const { t } = useTranslation()
  const v = useSim(selectSecurityView)
  const minute = useSim(selectMinute)
  const beat = DASH_BEATS.row3 + DASH_BEATS.stagger
  const beatMs = useBeatDelay(beat)
  const columns = securityColumns({
    tpmOk: v.tpmOk,
    secureBoot: v.secureBoot,
    timeSource: v.timeSource,
    timeLocked: v.timeLocked,
    linkUp: v.linkUp,
    posture: v.posture,
    ownCore: v.ownCore,
    platformNotReported: v.platformNotReported,
  })
  const postureNotReported = v.platformNotReported && v.posture === 'SECURE'
  // Fix wave L (G75d-07): the network column of a Core in its own capture that shows no fault.
  const ownNetwork = (v.ownCore || v.platformNotReported) && v.linkUp
  const header = securityHeader(columns)
  const zone = `UTC${formatUtcOffset()}`
  const synced = v.timeSource === 'GNSS' && v.timeLocked

  // The neutral columns of a Core in its own capture are statements, not items needing attention.
  const attention = v.ownCore || v.platformNotReported ? [columns.tpm, columns.time, columns.network, columns.posture].filter((tone) => tone === 'warning').length : header.attention
  const headerText =
    header.critical > 0
      ? t('dashboard.securityTimeNetwork.critical', { count: header.critical })
      : attention > 0
        ? t('dashboard.securityTimeNetwork.attention', { count: attention })
        : // Fix wave K (C-2 / G75c-04): "All systems secure" is a posture no Core computed where the columns read "Not reported" / "Host clock".
          v.ownCore || v.platformNotReported
          ? t('web.realCore.dashboard.securityHeader')
          : t('dashboard.securityTimeNetwork.allSecure')

  const glintMs = beatMs + HELD_BEAT_AFTER_LAND_MS
  const specs: ColumnProps[] = [
    {
      testId: 'stn-tpm',
      icon: ShieldCheck,
      iconClass: TONE_TEXT_CLASS[columns.tpm],
      title: t('dashboard.securityTimeNetwork.tpm.title'),
      // G75b-06: "TPM 2.0 Verified" was read from the simulator's constant on a Core that reports no TPM state.
      chip: v.platformNotReported
        ? t('web.ownCore.platform.chip')
        : columns.tpm === 'success'
          ? t('dashboard.securityTimeNetwork.tpm.chipOk')
          : t('dashboard.securityTimeNetwork.tpm.chipFault'),
      tone: columns.tpm,
      lines: v.platformNotReported
        ? [t('web.ownCore.platform.tpm'), t('web.ownCore.platform.secureBoot')]
        : [
            v.tpmOk ? t('dashboard.securityTimeNetwork.tpm.verified') : t('dashboard.securityTimeNetwork.tpm.failed'),
            v.secureBoot ? t('dashboard.securityTimeNetwork.tpm.secureBoot') : t('dashboard.securityTimeNetwork.tpm.secureBootOff'),
          ],
      tooltip: v.platformNotReported
        ? t('web.ownCore.platform.tooltip')
        : t('dashboard.securityTimeNetwork.tpm.tooltip', {
            model: v.tpmModel,
            secureBoot: v.secureBoot ? t('common.status.enabled') : t('common.status.disabled'),
            encryption: v.encryption,
            hash: v.hashAlgorithm,
          }),
      drawMs: beatMs,
      glintMs,
    },
    {
      testId: 'stn-time',
      icon: Clock,
      iconClass: TONE_TEXT_CLASS[columns.time],
      title: v.ownCore ? t('web.ownCore.time.label') : t('dashboard.securityTimeNetwork.time.title'),
      chip: v.ownCore ? t('web.ownCore.time.chip') : t(`dashboard.securityTimeNetwork.time.chip.${synced ? 'GNSS' : v.timeSource === 'RTC' ? 'RTC' : 'NTP'}`),
      tone: columns.time,
      lines: [formatDate(minute * 60_000, DATE_PATTERNS.dateTimeMinutes), zone],
      tooltip: <TimeTooltip ownCore={v.ownCore} />,
      drawMs: beatMs + 60,
      glintMs: glintMs + 60,
    },
    {
      testId: 'stn-network',
      icon: Network,
      iconClass: columns.network === 'success' ? 'text-accent' : TONE_TEXT_CLASS[columns.network],
      title: t('dashboard.securityTimeNetwork.network.title'),
      // Fix wave L (G75d-07, the one rule): the address, the LAN name, the gateway and the PoE ports are the appliance
      // model's network - a Core in its own capture reports none of them here. A link that is DOWN in the state stays said.
      chip: ownNetwork ? t('web.realCore.dashboard.notReportedChip') : v.linkUp ? t('dashboard.securityTimeNetwork.network.chipUp') : t('dashboard.securityTimeNetwork.network.chipDown'),
      tone: ownNetwork ? 'default' : columns.network,
      lines: ownNetwork ? [t('web.waveL.dashboardNetwork'), ''] : [v.ip, v.lanName],
      tooltip: ownNetwork
        ? t('web.waveL.dashboardNetwork')
        : t('dashboard.securityTimeNetwork.network.tooltip', {
            gateway: v.gateway,
            speed: v.linkSpeedMbps,
            active: v.poeActive,
            total: v.poeTotal,
          }),
      drawMs: beatMs + 120,
      glintMs: glintMs + 120,
    },
    {
      testId: 'stn-posture',
      icon: Shield,
      iconClass: columns.posture === 'success' ? 'text-accent' : TONE_TEXT_CLASS[columns.posture],
      title: t('dashboard.securityTimeNetwork.posture.title'),
      // Closing pass J (D217 (7)): "SECURE / All controls active" was the simulator's constant on a Core that computes no posture.
      chip: postureNotReported ? t('web.ownCore.platform.chip') : t(`common.posture.${v.posture}`),
      tone: columns.posture,
      lines: [
        postureNotReported
          ? t('common.platformNotReported.posture')
          : v.controlsOpen === 0
          ? t('dashboard.securityTimeNetwork.posture.allControls')
          : t('dashboard.securityTimeNetwork.posture.controlsOpen', { count: v.controlsOpen }),
        v.activeAlerts === 0
          ? t('dashboard.securityTimeNetwork.posture.noIssues')
          : t('dashboard.securityTimeNetwork.posture.alerts', { count: v.activeAlerts }),
      ],
      tooltip: postureNotReported ? t('common.platformNotReported.note') : `${t(`common.posture.${v.posture}`)} · ${v.encryption} · ${v.hashAlgorithm}`,
      drawMs: beatMs + 180,
      glintMs: glintMs + 180,
    },
  ]

  return (
    <DashPanel
      id="g"
      beatMs={beat}
      title={t('dashboard.securityTimeNetwork.title')}
      icon={Settings}
      action={
        <span className={`flex min-w-0 items-center gap-2 text-caption ${TONE_TEXT_CLASS[header.tone]}`} data-testid="stn-summary">
          <StatusDot tone={header.tone} />
          <span className="min-w-0 break-words" data-testid="stn-summary-text">{headerText}</span>
        </span>
      }
    >
      <div className="dems-stn-grid dems-dash-inset">
        {specs.map((spec) => (
          <Column key={spec.testId} {...spec} />
        ))}
      </div>
    </DashPanel>
  )
}
