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

/** Bytes written when `event` happened: `params.bytesWritten`, else 8.2 GB/h from `startedAt`. */
export function bytesAt(event: Pick<TimelineEvent, 'at'> & Partial<Pick<TimelineEvent, 'params'>>, startedAt: number | null): number | null {
  const value = event.params?.bytesWritten
  if (typeof value === 'number') return value
  if (startedAt === null || event.at < startedAt) return null
  return recordingBytes(event.at - startedAt)
}
