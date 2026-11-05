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

/**
 * Row W6 (request lines 566, 569; decisions C141, C143): `NOT_READ` is the Core's own `streamState: null` -
 * nobody reads the stream now (an idle registered camera; LIVE is stated only while an open session's ingest
 * receives it). It is said as "Stream not read", never as live, lost or online. `null` stays "nothing is said":
 * the member absent, or a state the rule does not show (a LIVE at rest, any state of a source never checked).
 * A source that is NOT REACHABLE keeps no stream word: its reach is the negative fact.
 */
export interface SourceLineState {
  readonly reach: SourceReach
  readonly stream: 'LIVE' | 'LOST' | 'NOT_READ' | null
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
  /**
   * Row 129 (register R7; contract row 125 `captureDevices.devices[].reach`): the outcome of the Core's last reading of
   * the device. A stated reach is preferred over the word drawn from `online`: NOT_REACHABLE is said whatever `online`
   * and `checkedAt` say (a negative fact of a read is never hidden); REACHABLE counts as checked. Absent or null: as before.
   */
  readonly reach?: 'REACHABLE' | 'NOT_REACHABLE' | null | undefined
}

export function sourceLineState(input: SourceLineInput): SourceLineState {
  const read = input.streamState ?? null
  // Row W6: the Core's explicit null is "not read"; an absent member says nothing.
  const stream = input.streamState === null ? 'NOT_READ' : read
  if (!input.realCapture) return { reach: input.online ? 'ONLINE' : 'OFFLINE', stream }
  // Row 129 (R7): the Core's stated NOT_REACHABLE is said first - its reading is the newest fact of the device.
  if (input.reach === 'NOT_REACHABLE') return { reach: 'NOT_REACHABLE', stream: read === 'LIVE' ? null : read }
  if (input.checkedAt === null) return { reach: 'NOT_CHECKED', stream: null }
  // A negative fact of a read is never hidden.
  if (!input.online) return { reach: 'NOT_REACHABLE', stream: read === 'LIVE' ? null : read }
  // Fix wave L (G70c-02; `contract_wave_l.md` section 5): at rest `online: true` only says "the registry row is
  // enabled" - a camera on a dead address read "Reachable". Reachable is said while a recording runs on the line
  // (its telemetry makes it true) or when the Core states when it checked (`checkedAt`).
  const checked = input.recording || input.reach === 'REACHABLE' || (typeof input.checkedAt === 'number' && Number.isFinite(input.checkedAt))
  if (!checked) return { reach: 'NOT_CHECKED', stream: stream === 'LOST' || stream === 'NOT_READ' ? stream : null }
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
 * states no PoE port for a source.
 *
 * THE BITRATE (task 4 row W4; review `verification/060c` finding R-01; decision C36: a default never stands in
 * for a fact). Until row W4 it was drawn on a Core in real capture while a session records, on the reading "a
 * bitrate exists only while a recording's telemetry runs". No telemetry writes it: a camera's `bitrateMbps`
 * has ONE writer, the simulator's initial literal `9`, and the Core's reads pass that on. An operator read
 * "9 Mbps" beside a recording of a real camera. On a Core in real capture the figure is therefore NEVER
 * drawn, recording or not. The contract's member is not nullable (`CamerasSliceSchema.bitrateMbps`,
 * `amount()`), so the Core cannot say "not stated" for it: the nullable member is asked of the contract's
 * writer (request line of row W4); when it exists and a writer states a bitrate, this rule reads the member.
 * In Simulated mode and on a Core in simulated capture the figure is the simulator's own statement: drawn.
 *
 * PASS I-9b: THE MEMBER IS NULLABLE NOW (null = no telemetry states a bitrate). The rule reads it: a bitrate of
 * null is NEVER drawn, in any mode - hand the member in as `bitrateMbps` (not handed in: judged by the mode
 * alone, as before). The mode rule above STAYS beside it: the slice a Core in real capture serves still
 * carries the simulator's literal (the Core's devices module does not state null yet - request line of row
 * I-9b); when it does, the mode's part for the bitrate has nothing left to hide and is taken out.
 */
export function measuredFiguresShown(input: { readonly realCapture: boolean; readonly recording: boolean; readonly bitrateMbps?: number | null }): { poePort: boolean; bitrate: boolean } {
  const stated = input.bitrateMbps !== null
  if (!input.realCapture) return { poePort: true, bitrate: stated }
  return { poePort: false, bitrate: false }
}
