/**
 * THE STATE OF A SOURCE LINE ON A CORE IN REAL CAPTURE (fix wave I, driver B; finding G70b-06 of
 * re-gate 70; ruling of driver A2, `delegation_progress/contract_wave_i_a2.md` section 4). Pure.
 *
 * `online` / `streamState` of the capture configuration are read at boot from the stored `enabled`
 * column and change only when the Core reads the device (a pre-check, a probe, the telemetry of a
 * recording). On an idle real-capture Core "Online" therefore means "registered and not known to be
 * gone", and `streamState: LIVE` does NOT mean a stream is flowing. At the re-gate a track naming a
 * source nobody had opened read "Online / Stream live" with a PoE port and a bitrate.
 *
 * | Core | Condition | The line says |
 * |---|---|---|
 * | real capture | `checkedAt === null` | NOT_CHECKED, no stream line |
 * | real capture | no session is RECORDING | wave L: NOT_CHECKED (`online: true` = the row is enabled, no read), REACHABLE only with a stated `checkedAt`; NOT_REACHABLE from `online: false`; a LIVE stream is not said |
 * | real capture | a session is RECORDING | the stream state (the recording's telemetry makes it true) |
 * | real capture | `streamState: LOST` | stays: a negative fact of a read is never hidden |
 * | simulated | any | ONLINE / OFFLINE and the stream state, as before |
 *
 * `checkedAt` is a PLANNED additive member of `captureDevices.devices[]` (the name is fixed by the
 * contract note; whether it lands in wave I is the server driver's): it is read by name
 * (`checkedAtOf`), so this module behaves the same before and after the shared type carries it.
 * Absent = the Core does not state it = drawn from `online` as today.
 */
export type SourceReach = 'ONLINE' | 'OFFLINE' | 'REACHABLE' | 'NOT_REACHABLE' | 'NOT_CHECKED'

export interface SourceLineState {
  readonly reach: SourceReach
  readonly stream: 'LIVE' | 'LOST' | null
}

export interface SourceLineInput {
  /** The console shows a Core that records for real (`useRealCaptureCore`). */
  readonly realCapture: boolean
  /** A session of this Core is RECORDING. */
  readonly recording: boolean
  readonly online: boolean
  readonly streamState?: 'LIVE' | 'LOST' | null | undefined
  /** `checkedAtOf(device)`: undefined = not stated. */
  readonly checkedAt?: number | null | undefined
}

export function sourceLineState(input: SourceLineInput): SourceLineState {
  const stream = input.streamState ?? null
  if (!input.realCapture) return { reach: input.online ? 'ONLINE' : 'OFFLINE', stream }
  if (input.checkedAt === null) return { reach: 'NOT_CHECKED', stream: null }
  // A negative fact of a read is never hidden.
  if (!input.online) return { reach: 'NOT_REACHABLE', stream: stream === 'LIVE' ? null : stream }
  // Fix wave L (G70c-02; `contract_wave_l.md` section 5): at rest `online: true` only says "the registry row is
  // enabled" - a camera on a dead address read "Reachable". Reachable is said while a recording runs on the line
  // (its telemetry makes it true) or when the Core states when it checked (`checkedAt`).
  const checked = input.recording || (typeof input.checkedAt === 'number' && Number.isFinite(input.checkedAt))
  if (!checked) return { reach: 'NOT_CHECKED', stream: stream === 'LOST' ? stream : null }
  return { reach: 'REACHABLE', stream: stream === 'LIVE' && !input.recording ? null : stream }
}

/** The planned member `checkedAt` of a capture device, read by name: a finite number, null, or undefined (absent / malformed). */
export function checkedAtOf(device: unknown): number | null | undefined {
  if (typeof device !== 'object' || device === null) return undefined
  const value = (device as { checkedAt?: unknown }).checkedAt
  if (value === null) return null
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/**
 * The PoE port and the bitrate of a camera tile (the same ruling: "no bitrate / PoE figure the Core
 * did not measure"). Both are values of the simulator's camera slice. In real capture the Core
 * states no PoE port for a source, and a bitrate exists only while a recording's telemetry runs.
 */
export function measuredFiguresShown(input: { readonly realCapture: boolean; readonly recording: boolean }): { poePort: boolean; bitrate: boolean } {
  if (!input.realCapture) return { poePort: true, bitrate: true }
  return { poePort: false, bitrate: input.recording }
}
