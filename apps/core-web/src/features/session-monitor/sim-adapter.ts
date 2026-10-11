/**
 * Session Monitor reads over the simulator (step 44; simplified by step 54, which closed W44-1 and
 * W44-2 in `packages/shared/src/sim`).
 *
 * - Write-rate sparkline (Panel S, 01_specs §14.5.2): the simulator keeps a 1 Hz measured
 *   write-rate history (`selectWriteRateHistory`: the nominal 8.2 GB/h with a ±3 % per-second
 *   variance; 120 points, back-filled at load). The chart samples it every 5 simulator seconds (60
 *   points span 5 minutes), so the Recharts sparkline re-renders at most at 0.2 Hz (§9.3).
 * - Timeline details: `TimelineEvent.params` carries the AUDIO_PEAK level (`dbfs`) and the
 *   AUTOSAVE segment and bytes (`segment`, `bytesWritten`). Items written before step 54 (a
 *   restored snapshot) fall back to the EN label and to the 8.2 GB/h rule.
 */
import { useEffect, useRef, useState } from 'react'
import {
  recordingBytes,
  selectWriteRateHistory,
  useSimInstance,
  type Sim,
  type TimelineEvent,
} from '@dems/shared/sim'

// ── Write rate (W44-1) ───────────────────────────────────────────────────────────────────
export const WRITE_RATE_POINTS = 60
/** One sample every 5 simulator seconds: 60 points span 5 minutes (§9.3). */
export const WRITE_RATE_SAMPLE_S = 5

export interface WriteRatePoint {
  /** Simulator second (epoch s). */
  t: number
  /** MB/s (decimal). */
  mbps: number
}

/** Every 5th second of the simulator's 1 Hz history, newest last, at most 60 points. */
function seriesOf(sim: Sim): WriteRatePoint[] {
  const history = selectWriteRateHistory(sim.store.getState())
  const points: WriteRatePoint[] = []
  for (let index = history.length - 1; index >= 0 && points.length < WRITE_RATE_POINTS; index -= WRITE_RATE_SAMPLE_S) {
    const point = history[index]
    if (point) points.push({ t: Math.floor(point.at / 1000), mbps: point.bytesPerSec / 1e6 })
  }
  return points.reverse()
}

/** The write-rate series, refreshed every 5 simulator seconds (a new array only when it changed). */
export function useWriteRateSeries(): WriteRatePoint[] {
  const sim = useSimInstance()
  const [series, setSeries] = useState<WriteRatePoint[]>(() => seriesOf(sim))
  const last = useRef<number>(-1)
  useEffect(
    () =>
      sim.store.subscribe(
        (state) => Math.floor(state.clock.now / (WRITE_RATE_SAMPLE_S * 1000)),
        (bucket) => {
          if (bucket === last.current) return
          last.current = bucket
          const next = seriesOf(sim)
          setSeries((previous) => {
            const a = previous.at(-1)
            const b = next.at(-1)
            return a && b && a.t === b.t && a.mbps === b.mbps && previous.length === next.length ? previous : next
          })
        },
      ),
    [sim],
  )
  return series
}

// ── Timeline details (W44-2) ─────────────────────────────────────────────────────────────
const DBFS_IN_LABEL = /(-?\d+(?:\.\d+)?)\s*dBFS/i
const SEGMENT_IN_LABEL = /segment\s+(\d+)/i

type TimelineFields = Pick<TimelineEvent, 'label'> & Partial<Pick<TimelineEvent, 'params'>>

/** The AUDIO_PEAK level: `params.dbfs`, else parsed from an older item's label, else null. */
export function audioPeakLevel(event: TimelineFields): number | null {
  const value = event.params?.dbfs
  if (typeof value === 'number') return value
  const match = DBFS_IN_LABEL.exec(event.label)
  return match ? Number(match[1]) : null
}

/** The AUTOSAVE segment: `params.segment`, else parsed from an older item's label, else null. */
export function autosaveSegment(event: TimelineFields): number | null {
  const value = event.params?.segment
  if (typeof value === 'number') return value
  const match = SEGMENT_IN_LABEL.exec(event.label)
  return match ? Number(match[1]) : null
}

/**
 * The timeline of a recording of the Core's OWN capture (wave H closing pass Z2; the rule of the
 * tablet's `timelineOfCaptureFacts`, driver A): AUTOSAVE, HEALTH and the generator's CHECK are rows
 * the simulator's generator invents - an auto-save segment with a byte figure of its formula, a
 * health check nobody ran. They are not drawn. A CHECK of the seal side (`params.source:
 * 'TAIL_VALIDATION'`) is a fact of the Core and stays. `ownCapture` false: every row, the same array.
 */
export function timelineOfOwnCapture<Event extends { kind: string; params?: Readonly<Record<string, unknown>> | null }>(events: readonly Event[], ownCapture: boolean): readonly Event[] {
  if (!ownCapture) return events
  const kept = events.filter((event) => event.kind !== 'AUTOSAVE' && event.kind !== 'HEALTH' && (event.kind !== 'CHECK' || event.params?.source === 'TAIL_VALIDATION'))
  return kept.length === events.length ? events : kept
}

/**
 * "Recording Started" only once the Core says recording (fix wave I, G75b-08): the START item is
 * written at the accepted start command, while the session is still connecting its cameras
 * (`captureFactsOf(session).capture === 'CONNECTING'`: nothing is recorded yet). Until the first
 * durable fragment the row is not drawn; it appears, with its own time, when the session reports
 * `captureDurable: true`. `connecting` false: every row, the same array.
 */
export function timelineWhileConnecting<Event extends { kind: string }>(events: readonly Event[], connecting: boolean): readonly Event[] {
  if (!connecting) return events
  const kept = events.filter((event) => event.kind !== 'START')
  return kept.length === events.length ? events : kept
}

/** `params.reason` of the Core's notice that the recorded video is not the configured profile (`apps/core-server/src/engine/sealing-notice-doors.ts`; `contract_wave_k.md` S1 section 3). */
export const STREAM_PROFILE_DIFFERS = 'STREAM_PROFILE_DIFFERS'

/**
 * The Core's notice for a session whose recorded stream is not the configured profile (fix wave K,
 * ruling D222 (2)): the alert `kind: SYSTEM`, `target: <sessionId>`, `params.reason:
 * STREAM_PROFILE_DIFFERS`. Returns the Core's own message ("The recorded video is not the configured
 * profile: VIDEO-01 is H264_720P30 (configured H264_1080P25). ..."), or null. A selector result: a
 * string compares by value.
 */
export function streamProfileNoticeOf(alerts: readonly { readonly kind: string; readonly target?: string | null; readonly message: string; readonly params?: Readonly<Record<string, unknown>> | null }[], sessionId: string | null): string | null {
  if (sessionId === null) return null
  return alerts.find((alert) => alert.kind === 'SYSTEM' && (alert.target ?? null) === sessionId && alert.params?.reason === STREAM_PROFILE_DIFFERS)?.message ?? null
}

/** How far the alert of a fault may lie from its timeline row and still be the same event (both are written in one step of the Core). */
export const FAULT_ALERT_WINDOW_MS = 2_000

type FaultRow = { readonly kind: string; readonly at: number; readonly params?: Readonly<Record<string, unknown>> | null }
type FaultAlert = { readonly kind: string; readonly at: number; readonly params?: Readonly<Record<string, unknown>> | null }

/**
 * THE REASON OF A CAPTURE-FAULT ROW (fix wave K, G75c-06): the row's own `params.reason`; a row
 * that carries none takes the reason of the CAPTURE_FAULT alert the Core raised at the same moment
 * (`alerts[].params.reason`: `DEMO_CAPTURE_FAULT`, `WORKER_KILLED`, ...). So the timeline says the
 * one sentence the alert says - "The demo control raised a capture fault. The recording is not
 * affected." - and never "the recording was interrupted" beside a session that keeps recording.
 * null: neither states a reason.
 */
export function captureFaultReasonOf(event: FaultRow, alerts: readonly FaultAlert[]): string | null {
  const own = event.params?.reason
  if (typeof own === 'string' && own !== '') return own
  let nearest: { reason: string; distance: number } | null = null
  for (const alert of alerts) {
    if (alert.kind !== 'CAPTURE_FAULT') continue
    const reason = alert.params?.reason
    const distance = Math.abs(alert.at - event.at)
    if (typeof reason !== 'string' || reason === '' || distance > FAULT_ALERT_WINDOW_MS) continue
    if (nearest === null || distance < nearest.distance) nearest = { reason, distance }
  }
  return nearest?.reason ?? null
}

/**
 * One row per fault (fix wave K, G75c-06 (c)): a FAULT row that repeats the row before it - the same
 * fault kind, the same reason, the same instant - is drawn once. Nothing else is ever dropped; no
 * repeat: the same array.
 */
export function timelineWithoutRepeatedFaults<Event extends FaultRow>(events: readonly Event[]): readonly Event[] {
  const kept: Event[] = []
  for (const event of events) {
    const previous = kept[kept.length - 1]
    if (
      previous !== undefined &&
      event.kind === 'FAULT' &&
      previous.kind === 'FAULT' &&
      previous.at === event.at &&
      previous.params?.kind === event.params?.kind &&
      (previous.params?.reason ?? null) === (event.params?.reason ?? null) &&
      (previous.params?.target ?? null) === (event.params?.target ?? null)
    )
      continue
    kept.push(event)
  }
  return kept.length === events.length ? events : kept
}

/** Bytes written when `event` happened: `params.bytesWritten`, else 8.2 GB/h from `startedAt`. */
export function bytesAt(event: Pick<TimelineEvent, 'at'> & Partial<Pick<TimelineEvent, 'params'>>, startedAt: number | null): number | null {
  const value = event.params?.bytesWritten
  if (typeof value === 'number') return value
  if (startedAt === null || event.at < startedAt) return null
  return recordingBytes(event.at - startedAt)
}

/**
 * Fix wave L (G75d-05, ruling D228 (3)): THE CONFIGURED PROFILE OF A SESSION on a Core in its own
 * capture is what its selector lines say - the snapshot the session took at its start
 * (`session.captureConfig`), else the selector in force (`captureConfig`). Never the label of
 * `session.input.profileId` ("Standard (1080p / 25 fps)"): that is the form's choice of the
 * simulator's model and stood beside recordings whose manifest states H264_720P30.
 * One line per track, "VIDEO-01: H264_720P30"; a primitive (a string) so the selector never loops.
 * '' = no line states a profile ("Not reported").
 */
export function configuredProfileLinesOf(state: {
  readonly session?: { readonly captureConfig?: { readonly cameras?: readonly { readonly trackId: string; readonly profile?: unknown }[] } | null } | null
  readonly captureConfig?: { readonly cameras?: readonly { readonly trackId: string; readonly profile?: unknown }[] } | null
}): string {
  // A fact OF the session this panel describes (its id, its start, its evidence stand in the same card): the session's OWN
  // snapshot is read whatever its state, also SEALED - not the rule of `selectorInForce` (closing pass L-Z, decision 1).
  const own = state.session?.captureConfig?.cameras
  const lines = own !== undefined ? own : (state.captureConfig?.cameras ?? [])
  return [...lines]
    .filter((line) => typeof line.profile === 'string' && line.profile !== '' && line.profile.length <= 40)
    .sort((a, b) => a.trackId.localeCompare(b.trackId))
    .map((line) => `${line.trackId}: ${line.profile as string}`)
    .join(' · ')
}
