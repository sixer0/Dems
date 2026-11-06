/**
 * The Realtime panel's feed in Live mode (backend task 04_client_integration_spec §11 AR-7; CL-7;
 * plan row W84, finding F72-4: AC-C-18, no second socket).
 *
 * In Live mode the console holds ONE socket, the Live source's. The panel opens none and builds no
 * heartbeat client: it reads what the source makes public about that socket, and prints no state
 * payload.
 *
 * | Entry | Read from | Printed |
 * |-------|-----------|---------|
 * | `heartbeat` | `live.heartbeat`, the heartbeat view of the one socket | type, `seq`, `serverTime`, `clients`: every member of a heartbeat the view keeps |
 * | `snapshot` | `live.socketStatus()`: its `snapshots` counter moved | type, epoch, revision and the names of the slices it carries (every replicated slice) |
 * | `delta` | the replica changed and the `deltas` counter moved since the last state entry | type, epoch, revision, the names of the replicated slices that changed (structural sharing keeps an untouched slice the same object) and how many deltas, when more than one was applied at once |
 * | meter frames | the `meters` counter, sampled at each heartbeat | a rate per second, never an entry (they come several times a second) |
 *
 * The source applies state messages through its command gate, so a delta can reach the replica a
 * little after it reached the socket: the entry is made when the replica changes, with the epoch and
 * revision the socket last handed on. Entries count from the moment the panel opened; the newest is
 * first and at most `REALTIME_MESSAGE_LIMIT` are kept.
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import { REPLICATED_SLICE_NAMES } from '@dems/shared/api'
import type { HeartbeatSnapshot, LiveSocketStatus } from '@dems/shared/realtime'
import type { WebLive } from '@/runtime'
import { REALTIME_MESSAGE_LIMIT } from './use-realtime-feed'

export type LiveRealtimeEntryType = 'heartbeat' | 'snapshot' | 'delta'

export interface LiveRealtimeEntry {
  /** Unique for the panel's life. */
  id: string
  type: LiveRealtimeEntryType
  /** The printed form: the members of the table above, never a payload. */
  text: string
}

/** One reading of the socket and the replica. */
export interface LiveFrameReading {
  heartbeat: HeartbeatSnapshot
  status: Pick<LiveSocketStatus, 'epoch' | 'revision' | 'counters'>
  /** The replica (the source's store state); only the replicated slices are compared, by identity. */
  replica: object
}

export interface LiveFrameTap {
  /** Takes one reading. Returns true when an entry or the meter rate changed. */
  observe(reading: LiveFrameReading): boolean
  subscribe(listener: () => void): () => void
  getEntries(): readonly LiveRealtimeEntry[]
  /** Meter frames per second over the last samples, one decimal; null before two samples. */
  getMetersRate(): number | null
  /**
   * The socket's epoch and revision as of the last reading; the same object until one of them changes
   * (FXR-W W92-26: the panel read `live.socketStatus()` during render, unsubscribed, so the two numbers
   * could lag until the next entry rendered). A change notifies the listeners.
   */
  getPosition(): LiveFramePosition
}

export interface LiveFramePosition {
  readonly epoch: number | null
  readonly revision: number | null
}

/** How long the meter rate looks back. */
export const METERS_RATE_WINDOW_MS = 3_000

/** Prints the members of an entry: one per line, a list on one line (it wraps in the panel). */
export function formatLiveEntry(members: Readonly<Record<string, unknown>>): string {
  const lines = Object.entries(members).map(([name, value]) => `  ${JSON.stringify(name)}: ${JSON.stringify(value)}`)
  return `{\n${lines.join(',\n')}\n}`
}

export function createLiveFrameTap(limit: number = REALTIME_MESSAGE_LIMIT): LiveFrameTap {
  let entries: readonly LiveRealtimeEntry[] = []
  let started = false
  let serial = 0
  let lastSeq: number | null = null
  let lastSnapshots = 0
  let lastDeltas = 0
  let lastSlices: readonly unknown[] = []
  let metersRate: number | null = null
  let meterSamples: { at: number; count: number }[] = []
  const listeners = new Set<() => void>()
  let position: LiveFramePosition = { epoch: null, revision: null }
  /** Keeps the epoch and revision of a reading; true when either changed. */
  const track = (status: LiveFrameReading['status']): boolean => {
    if (status.epoch === position.epoch && status.revision === position.revision) return false
    position = { epoch: status.epoch, revision: status.revision }
    return true
  }

  const push = (type: LiveRealtimeEntryType, members: Record<string, unknown>) => {
    serial += 1
    entries = [{ id: `${type}-${serial}`, type, text: formatLiveEntry({ type, ...members }) }, ...entries].slice(0, limit)
  }
  const slicesOf = (replica: object) => REPLICATED_SLICE_NAMES.map((name) => (replica as Readonly<Record<string, unknown>>)[name])

  return {
    observe({ heartbeat, status, replica }) {
      const slices = slicesOf(replica)
      const { counters } = status
      const moved = track(status)
      if (!started) {
        started = true
        lastSeq = heartbeat.seq
        lastSnapshots = counters.snapshots
        lastDeltas = counters.deltas
        lastSlices = slices
        if (heartbeat.lastBeatAt !== null) meterSamples = [{ at: heartbeat.lastBeatAt, count: counters.meters }]
        if (moved) for (const listener of listeners) listener()
        return false
      }
      let changed = false
      if (heartbeat.seq !== null && heartbeat.seq !== lastSeq) {
        lastSeq = heartbeat.seq
        push('heartbeat', { seq: heartbeat.seq, serverTime: heartbeat.serverTime, clients: heartbeat.clients })
        changed = true
        if (heartbeat.lastBeatAt !== null) {
          const at = heartbeat.lastBeatAt
          meterSamples = [...meterSamples.filter((sample) => at - sample.at <= METERS_RATE_WINDOW_MS && sample.at < at), { at, count: counters.meters }]
          const first = meterSamples[0]
          const next = first && first.at < at ? Math.round(((counters.meters - first.count) / ((at - first.at) / 1000)) * 10) / 10 : null
          if (next !== metersRate) metersRate = next
        }
      }
      if (counters.snapshots > lastSnapshots) {
        lastSnapshots = counters.snapshots
        lastDeltas = counters.deltas
        lastSlices = slices
        push('snapshot', { epoch: status.epoch, revision: status.revision, slices: [...REPLICATED_SLICE_NAMES] })
        changed = true
      } else {
        const touched = REPLICATED_SLICE_NAMES.filter((_name, index) => slices[index] !== lastSlices[index])
        if (touched.length > 0) {
          const applied = counters.deltas - lastDeltas
          lastDeltas = counters.deltas
          lastSlices = slices
          push('delta', { epoch: status.epoch, revision: status.revision, slices: touched, ...(applied > 1 ? { deltas: applied } : {}) })
          changed = true
        }
      }
      if (changed || moved) for (const listener of listeners) listener()
      return changed
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getEntries: () => entries,
    getMetersRate: () => metersRate,
    getPosition: () => position,
  }
}

export interface LiveRealtimeFeed {
  heartbeat: HeartbeatSnapshot
  entries: readonly LiveRealtimeEntry[]
  metersRate: number | null
  epoch: number | null
  revision: number | null
}

/** The panel's view of the Live source's one socket. Opens nothing: it subscribes to what the source already has. */
export function useLiveRealtimeFeed(live: WebLive): LiveRealtimeFeed {
  const [tap] = useState(createLiveFrameTap)
  const heartbeat = useSyncExternalStore(live.heartbeat.subscribe, live.heartbeat.getSnapshot, live.heartbeat.getSnapshot)
  useEffect(() => {
    const read = () => {
      tap.observe({ heartbeat: live.heartbeat.getSnapshot(), status: live.socketStatus(), replica: live.store.getState() })
    }
    read()
    const stopBeats = live.heartbeat.subscribe(read)
    const stopStore = live.store.subscribe(read)
    return () => {
      stopBeats()
      stopStore()
    }
  }, [live, tap])
  const entries = useSyncExternalStore(tap.subscribe, tap.getEntries, tap.getEntries)
  const metersRate = useSyncExternalStore(tap.subscribe, tap.getMetersRate, tap.getMetersRate)
  // W92-26: the epoch and revision through the tap's subscription, not a read of the source in render.
  const position = useSyncExternalStore(tap.subscribe, tap.getPosition, tap.getPosition)
  return { heartbeat, entries, metersRate, epoch: position.epoch, revision: position.revision }
}
