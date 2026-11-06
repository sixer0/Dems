import { motion } from 'motion/react'
import { ClipboardList } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DATE_PATTERNS, EMPTY_DATE_TEXT, formatDate, formatDuration, formatUtcOffset } from '@dems/shared/realtime'
import { RECORDING_PROFILES, useSim } from '@dems/shared/sim'
import { useSelfCaptureCore } from '@/lib/own-capture'
import { configuredProfileLinesOf, streamProfileNoticeOf } from './sim-adapter'
import { useSimSecond } from '@/components/media'
import { useMotionPolicy } from '@/motion'
import { cn } from '@/lib/utils'
import { PANEL_BEAT_MS, useStaggerVariants } from './choreography'
import { selectDetails } from './model'
import { Panel } from './panel'

interface Row {
  id: string
  label: string
  value: string
  mono?: boolean
  gloss?: string
  /** Zone label shown after the value, wrapping to its own line when the cell is narrow (AC-74). */
  zone?: string
}

/**
 * M: SESSION DETAILS (01_specs §14.5.2 M; research/04 §3.2 M). Key-value rows with hairline
 * dividers; IDs and times in mono; the Duration in gold tabular digits (1 Hz, clock-derived so it
 * survives a reload, S4; DR-44-3). Rows stagger 30 ms on enter (M-PG-SM t = 140).
 */
export function DetailsPanel() {
  const { t } = useTranslation()
  const m = useMotionPolicy()
  const details = useSim(selectDetails)
  const container = useStaggerVariants(PANEL_BEAT_MS.M, 30)
  const profile = RECORDING_PROFILES.find((item) => item.id === details.profileId)
  const profileNotice = useSim((s) => streamProfileNoticeOf(s.alerts, details.sessionId))
  const profileDiffers = profileNotice !== null
  // Fix wave L (G75d-05): on a Core in its own capture the row is the selector's configured profile, per track.
  const selfCapture = useSelfCaptureCore()
  const configuredLines = useSim(configuredProfileLinesOf)
  const dash = EMPTY_DATE_TEXT

  const rows: Row[] = [
    { id: 'sessionId', label: t('session.details.sessionId'), value: details.sessionId ?? dash, mono: true },
    { id: 'caseNumber', label: t('session.details.caseNumber'), value: details.caseNumber ?? dash, mono: true },
    { id: 'investigator', label: t('session.details.investigator'), value: details.investigatorName ?? dash },
    {
      id: 'subjectType',
      label: t('session.details.subjectType'),
      value: details.subjectType
        ? t(`common.subjectType.${details.subjectType as 'TERSANGKA' | 'SAKSI' | 'LAINNYA'}`)
        : dash,
      gloss: details.subjectType
        ? t(`common.subjectTypeGloss.${details.subjectType as 'TERSANGKA' | 'SAKSI' | 'LAINNYA'}`)
        : undefined,
    },
    { id: 'subject', label: t('session.details.subject'), value: details.subjectName ?? dash },
    { id: 'room', label: t('session.details.room'), value: details.room ?? dash },
    {
      id: 'startTime',
      label: t('session.details.startTime'),
      value: details.startedAt === null ? dash : formatDate(details.startedAt, DATE_PATTERNS.dateTime),
      // AC-74: every timestamp carries its zone, as Dashboard D does (step 45b, F45-04).
      zone: details.startedAt === null ? undefined : `UTC${formatUtcOffset()}`,
      mono: true,
    },
  ]
  const tail: Row[] = [
    // Fix wave K (ruling D222 (2); `contract_wave_k.md` S1 section 3): where the Core's notice says the recorded video is not
    // the configured profile, the label is what was CONFIGURED - never a fact of the recording. The manifest states the stream.
    selfCapture
      ? { id: 'profile', label: t('web.waveL.profile.configuredLabel'), value: configuredLines === '' ? t('web.waveL.profile.notStated') : configuredLines, mono: true }
      : { id: 'profile', label: profileDiffers ? t('web.profile.configuredLabel') : t('session.details.profile'), value: profile?.label ?? dash },
  ]
  if (details.evidenceId) {
    tail.push({ id: 'evidenceId', label: t('session.details.evidenceId'), value: details.evidenceId, mono: true })
  }

  return (
    <Panel id="M" icon={ClipboardList} title={t('session.details.title')} className="sm-area-details">
      <motion.dl className="sm-kv" variants={container} data-testid="sm-details" data-motion={m.policy}>
        {rows.map((row) => (
          <DetailRow key={row.id} row={row} />
        ))}
        <motion.div className="sm-kv-row" variants={m.variants.row} data-row="duration">
          <dt className="sm-kv-label">{t('session.details.duration')}</dt>
          <dd className="sm-kv-value">
            <DurationValue startedAt={details.startedAt} stoppedAt={details.stoppedAt} />
          </dd>
        </motion.div>
        {tail.map((row) => (
          <DetailRow key={row.id} row={row} />
        ))}
      </motion.dl>
      {profileNotice !== null ? (
        <p className="sm-check-value" role="status" data-testid="sm-details-stream-profile" style={{ whiteSpace: 'normal', textAlign: 'left' }}>
          {profileNotice}
        </p>
      ) : null}
    </Panel>
  )
}

function DetailRow({ row }: { row: Row }) {
  const m = useMotionPolicy()
  return (
    <motion.div className="sm-kv-row" variants={m.variants.row} data-row={row.id}>
      <dt className="sm-kv-label">{row.label}</dt>
      {row.zone ? (
        // The time and its zone are two no-wrap pieces: one line when the cell is wide enough,
        // otherwise the zone drops under the time instead of being cut off by the ellipsis.
        <dd className={cn('sm-kv-value sm-kv-value-zoned', row.mono && 'font-mono tabular-nums')} title={`${row.value} ${row.zone}`}>
          <span className="sm-kv-time">{row.value}</span> <span className="sm-kv-zone">{row.zone}</span>
        </dd>
      ) : (
        <dd className={cn('sm-kv-value', row.mono && 'font-mono tabular-nums')} title={row.gloss ?? row.value}>
          {row.value}
        </dd>
      )}
    </motion.div>
  )
}

/**
 * The Duration in gold mono tabular digits, clock-derived at 1 Hz, frozen once the recording
 * stopped. DR-44-3: plain text, not MP SlidingNumber (spec M). The REC chip in L already shows the
 * same timer as SlidingNumber (the hero, M-C-05); each SlidingNumber set is 60 `layoutId` digit
 * layers that Motion re-measures on every tick, and a second set on this page produced a 55–84 ms
 * long task every second in the browser check (implementation/24_page_session_monitor.md §5).
 */
function DurationValue({ startedAt, stoppedAt }: { startedAt: number | null; stoppedAt: number | null }) {
  const nowSecond = useSimSecond()
  if (startedAt === null) return <span className="text-foreground-2">{EMPTY_DATE_TEXT}</span>
  const end = stoppedAt ?? nowSecond * 1000
  return (
    <span className="sm-duration" data-testid="sm-duration">
      {formatDuration(end - startedAt)}
    </span>
  )
}
