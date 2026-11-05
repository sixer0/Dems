/**
 * The capture device selector of the web console: its read, its gates and its commands (task 3 M4,
 * blueprint row 67; `masterplan/08_client_ux_spec.md` §2 flow 1; `masterplan/03_api_contract.md`
 * §2.2-§2.4 operations 76-80; `masterplan/01_specs.md` R-1). Kept in a `.ts` module so the panel
 * file exports only components.
 *
 * | Export | What it is |
 * |--------|------------|
 * | `selectorRead` | The state of the gated read (ux §2.2 step 1, §2.5): waiting for the link, loading, forbidden, not ready, failed, ready |
 * | `selectorEditGate` | G1-G3 (ux §2.4): Checking → allowed, or refused with its reason (role, open session) |
 * | `poeCycleGate` | G9 (ux §2.4): offered only for a LOST stream; the role and recording rules are the one gate of `lib/device-command-gate.ts` |
 * | `useCaptureSelector` | The read in both data modes |
 * | `useCaptureSelectorCommands` | Operations 78 (the microphone lines by CHANNEL, D61; `unassign`; the two-line swap, D22(3)), 79, 80 and the camera PoE cycle (48) in both data modes |
 * | `micLineFor` | D61 (2026-11-04): the line of operation 78 for "this microphone on this channel" - ONE line by channel (a line assigns its channel ALONE; the slots it does not name keep what they hold) |
 * | `micMoveFor` | Audit row 156 (D5; D22(3); S5 §6): a microphone another pair holds is SWAPPED in (two lines by channel), or moved to an empty pair |
 * | `selectorSlotRows` | Task 4 row 31 (decision C18 (3)): one row per SLOT of the selector - an absent line is a row too |
 * | `selectorPairRows` | Audit row 156 (D27, D28 DQ-5; register N-04/N-40): the four "Camera N <-> Mic N" pair rows, in pair order |
 *
 * **Two data modes, one shape.** In Live mode the read is operations 76 and 77 through the two
 * query factories of `lib/core-queries.ts` (WB-11, E-17), kept current by the republished slices
 * (`useCaptureSliceRefresh`). In Simulated mode the simulator's own `captureConfig` and
 * `captureDevices` slices are the read, and a command is the simulator's own answer to the same
 * operation (`sim.request`, OD-17): the same RBAC, the same `409 CAPTURE_CONFIG_LOCKED`, the same
 * audit row. Nothing is optimistic (ux §2.2 step 4): a row changes when the Core's answer or slice
 * says so.
 */
import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { ApiErrorCode, type CaptureConfigSliceBody, type CaptureDevicesSliceBody } from '@dems/shared/api'
import type { CoreCallFailure } from '@dems/shared/client'
import { VIDEO_TRACK_IDS, type VideoTrackId } from '@dems/shared/domain' // D61 (2026-11-04): MicRole superseded — the roles became the numbered channels
import { useCoreActions, useCorePermission } from '@dems/shared/live'
import {
  CAPTURE_PAIRS,
  capturePairOfMicChannel,
  DeviceCommand,
  hasActiveSession,
  MIC_CHANNEL_IDS,
  OperatorRole,
  Permission,
  PRIMARY_MIC_CHANNEL,
  ROLE_PERMISSIONS,
  selectCan,
  selectIsRecording,
  useSim,
  useSimInstance,
  type CaptureSelectorSlot,
  type MicChannel,
} from '@dems/shared/sim' // D61 (2026-11-04): the four microphone channels of the selector
import {
  captureConfigQueryOptions,
  captureDevicesQueryOptions,
  CoreReadError,
  isForbiddenCoreRead,
  retryCoreQuery,
  useCaptureReadGate,
  useCaptureSliceRefresh,
} from '@/lib/core-queries'
import { deviceCommandGate, type DeviceCommandBlock } from '@/lib/device-command-gate'
import { CORE_QUERY_KEYS, useWebLive, type WebLive } from '@/runtime'
import { reportDevicesError } from './report'

/** The id of the selector panel; the System entry links to it (`/devices#capture-selector`, WB-07). */
export const CAPTURE_SELECTOR_ANCHOR = 'capture-selector'

export type CaptureConfig = CaptureConfigSliceBody
export type CaptureDevices = CaptureDevicesSliceBody
export type CaptureCameraLine = CaptureConfig['cameras'][number]
export type CaptureMicLine = CaptureConfig['mics'][number]
export type CaptureDevice = CaptureDevices['devices'][number]

// ── The read ─────────────────────────────────────────────────────────────────────────────

export type SelectorRead =
  /** Live mode, the link is not up (or the session is leaving): "waits for the link", never an instant enable. */
  | { readonly kind: 'WAITING' }
  | { readonly kind: 'LOADING' }
  /** `403`: the role may not read. */
  | { readonly kind: 'FORBIDDEN' }
  /** `503 NOT_READY` (`details.reason: CAPTURE_NOT_READY`): offered with a Retry. */
  | { readonly kind: 'NOT_READY' }
  | { readonly kind: 'FAILED' }
  | { readonly kind: 'READY'; readonly config: CaptureConfig; readonly devices: CaptureDevices }

/** One of the two queries, as far as the read state needs it. */
export interface SelectorQueryView<T> {
  readonly data: T | undefined
  readonly error: unknown
}

function failedRead(error: unknown): SelectorRead {
  if (isForbiddenCoreRead(error)) return { kind: 'FORBIDDEN' }
  if (error instanceof CoreReadError && (error.status === 503 || error.code === ApiErrorCode.NOT_READY)) return { kind: 'NOT_READY' }
  return { kind: 'FAILED' }
}

/** The state of the Live read, by the rows of ux §2.5; pure. A failure wins over data held from before it. */
export function selectorRead(input: {
  /** The base gate: Live, signed in, the link up. */
  readonly open: boolean
  readonly config: SelectorQueryView<CaptureConfig>
  readonly devices: SelectorQueryView<CaptureDevices>
}): SelectorRead {
  if (!input.open) return { kind: 'WAITING' }
  if (input.config.error != null) return failedRead(input.config.error)
  if (input.devices.error != null) return failedRead(input.devices.error)
  if (input.config.data === undefined || input.devices.data === undefined) return { kind: 'LOADING' }
  return { kind: 'READY', config: input.config.data, devices: input.devices.data }
}

// ── The gates ────────────────────────────────────────────────────────────────────────────

/** Why an edit control (G1-G3) is not offered now; `null` when it is. */
export type SelectorEditBlock =
  /** The role or the link is not resolved: "Checking your permissions..." (E-16). */
  | { readonly kind: 'CHECKING' }
  /** `CAPTURE_CONFIG` is not held: the roles that hold it are named. */
  | { readonly kind: 'ROLE'; readonly roles: readonly OperatorRole[] }
  /** A session is open (OD-10; `409 CAPTURE_CONFIG_LOCKED`). */
  | { readonly kind: 'LOCKED' }

/** The roles that hold `permission`, in the order of the role set. */
export function rolesHolding(permission: Permission): readonly OperatorRole[] {
  return Object.values(OperatorRole).filter((role) => (ROLE_PERMISSIONS[role] as readonly Permission[]).includes(permission))
}

/**
 * G1-G3 (ux §2.4): `Checking → allowed` or `Checking → refused with its reason`; pure. The role is
 * the lasting reason, so it is said before the lock.
 */
export function selectorEditGate(input: { readonly resolved: boolean; readonly can: boolean; readonly locked: boolean }): SelectorEditBlock | null {
  if (!input.resolved) return { kind: 'CHECKING' }
  if (!input.can) return { kind: 'ROLE', roles: rolesHolding(Permission.CAPTURE_CONFIG) }
  if (input.locked) return { kind: 'LOCKED' }
  return null
}

export type PoeCycleGate =
  /** The stream is not LOST: the control is not part of the row at all (ux §2.5 "offered only then"). */
  | { readonly offered: false }
  | { readonly offered: true; readonly block: { readonly kind: 'CHECKING' } | DeviceCommandBlock | null }

/** G9 (ux §2.4): offered only for a LOST stream; then Checking, then the one gate of the device commands (Restart). */
export function poeCycleGate(input: {
  readonly lost: boolean
  readonly resolved: boolean
  readonly canManage: boolean
  readonly recording: boolean
  readonly busy: boolean
  /** Audit row CS2 (O-124-1): the Core runs its own capture and refuses operation 48 - the cycle is NOT_AVAILABLE. Absent: false. */
  readonly notAvailable?: boolean
}): PoeCycleGate {
  if (!input.lost) return { offered: false }
  if (!input.resolved) return { offered: true, block: { kind: 'CHECKING' } }
  const blocks = deviceCommandGate({
    can: (permission) => permission === Permission.DEVICE_MANAGE && input.canManage,
    recording: input.recording,
    busy: input.busy,
    notAvailable: input.notAvailable === true,
  })
  return { offered: true, block: blocks.restart }
}

// ── The read in both data modes ──────────────────────────────────────────────────────────

export interface CaptureSelectorView {
  readonly read: SelectorRead
  /** The role and the link are resolved and the read answered: a gated control may leave Checking. */
  readonly resolved: boolean
  readonly canConfigure: boolean
  readonly canManageDevices: boolean
  readonly recording: boolean
  /** Asks again (a failed read); respects the gate (`retryCoreQuery`). Nothing to do in Simulated mode. */
  readonly retry: () => void
}

/** Whether the signed-in operator holds `permission`: the Core's list in Live mode, the simulator's table otherwise. */
function usePermission(live: boolean, permission: Permission): boolean {
  const core = useCorePermission(permission)
  const simulated = useSim((state) => selectCan(state, permission))
  return live ? core : simulated
}

export function useCaptureSelector(): CaptureSelectorView {
  const gate = useCaptureReadGate()
  const queryClient = useQueryClient()
  const live = gate.live !== null
  const configQuery = useQuery(captureConfigQueryOptions(gate))
  const devicesQuery = useQuery(captureDevicesQueryOptions(gate))
  useCaptureSliceRefresh()
  const simConfig = useSim((state) => state.captureConfig)
  const simDevices = useSim((state) => state.captureDevices)
  const sessionOpen = useSim(hasActiveSession)
  const recording = useSim(selectIsRecording)
  const canConfigure = usePermission(live, Permission.CAPTURE_CONFIG)
  const canManageDevices = usePermission(live, Permission.DEVICE_MANAGE)

  const read = useMemo<SelectorRead>(() => {
    // Simulated mode: the simulator's slices are the read; `locked` is recomputed as operation 76 does.
    if (!live) return { kind: 'READY', config: { ...simConfig, locked: sessionOpen }, devices: simDevices }
    return selectorRead({
      open: gate.enabled,
      config: { data: configQuery.data, error: configQuery.error },
      devices: { data: devicesQuery.data, error: devicesQuery.error },
    })
  }, [live, simConfig, simDevices, sessionOpen, gate.enabled, configQuery.data, configQuery.error, devicesQuery.data, devicesQuery.error])

  const retry = useCallback(() => {
    retryCoreQuery(queryClient, CORE_QUERY_KEYS.captureConfig)
    retryCoreQuery(queryClient, CORE_QUERY_KEYS.captureDevices)
  }, [queryClient])

  return { read, resolved: read.kind === 'READY', canConfigure, canManageDevices, recording, retry }
}

// ── The commands ─────────────────────────────────────────────────────────────────────────

export type SelectorOperation = 'updateCaptureConfig' | 'setCaptureCameraSource' | 'setPrimaryMic' | 'restartDevice'

/** One microphone line of operation 78 (D61 of 2026-11-04): `deviceId` equals `inputId` and the line names its CHANNEL. */
export interface MicChannelLine {
  readonly inputId: string
  readonly deviceId: string
  readonly channel: MicChannel
}

/**
 * D61 (2026-11-04) generalizes wave H (G70-02) and decision D133 (1): the pair replacement became
 * the per-channel line. Operation 78's mic lines are keyed by CHANNEL — "microphone `deviceId` on
 * channel `channel`" — and a line assigns its channel ALONE: the slots of the channels the change
 * does not name keep what they hold (`assignMicsByChannel` of `sim/capture-config.ts`). One
 * microphone never stands on two channels: choosing a device another ASSIGNED channel holds is a
 * MOVE (`micMoveFor`), not a bare line.
 */
export function micLineFor(channel: MicChannel, deviceId: string): readonly MicChannelLine[] {
  return [{ inputId: deviceId, deviceId, channel }]
}

/**
 * A microphone another pair holds, chosen for the pair of `channel` (audit row 156; D5; D22(3);
 * S5 §6 and §2.2; supersedes R-FLEX row 133's `{ unassign, line }` move wherever a swap exists).
 *
 * - `SWAP`: the target pair holds microphone `other`. The two microphones trade channels in ONE
 *   operation 78 edit of TWO lines by channel `{ mics: [to-line, from-line] }` - no `unassign`, so
 *   no camera is left without its paired microphone (D22(3)). Both channels are named, so the
 *   "held by another assigned channel" refusal does not fire (`assignMicsByChannel`); row 155 makes
 *   the Core write ONE channel-swap audit row for it (D30 K-6).
 * - `MOVE`: the target pair holds no microphone, so there is nothing to give back: the microphone
 *   moves and the pair it leaves is incomplete (`{ unassign: [from], mics: [line] }`, the one form the
 *   Core accepts for it). The panel confirms it with the incomplete-pair sentence.
 *
 * `from` / `to` are the channels (`MIC-0N`); `fromPair` / `toPair` their pair numbers (N-04).
 */
export type MicMove =
  | {
      readonly kind: 'SWAP'
      readonly from: MicChannel
      readonly to: MicChannel
      readonly fromPair: number
      readonly toPair: number
      /** The microphone chosen for `to`. */
      readonly deviceId: string
      /** The microphone `to` held; it goes to `from`. */
      readonly other: string
      /** `[the line on to, the line on from]`. */
      readonly lines: readonly [MicChannelLine, MicChannelLine]
    }
  | {
      readonly kind: 'MOVE'
      readonly from: MicChannel
      readonly to: MicChannel
      readonly fromPair: number
      readonly toPair: number
      readonly deviceId: string
      /** The one line by channel the microphone takes; `from` is cleared (`unassign`). */
      readonly line: MicChannelLine
    }

/** The swap (or, onto an empty pair, the move) of `deviceId` to the channel `channel`; `null` when `deviceId` holds no other assigned channel (then a bare `micLineFor` applies). */
export function micMoveFor(mics: readonly CaptureMicLine[], channel: MicChannel, deviceId: string): MicMove | null {
  const source = mics.find((line) => line.channel !== channel && line.deviceId === deviceId)
  if (source === undefined) return null
  const from = source.channel
  const pairs = { fromPair: capturePairOfMicChannel(from).pair, toPair: capturePairOfMicChannel(channel).pair }
  const line: MicChannelLine = { inputId: deviceId, deviceId, channel }
  const target = mics.find((entry) => entry.channel === channel)
  if (target === undefined) return { kind: 'MOVE', from, to: channel, ...pairs, deviceId, line }
  return {
    kind: 'SWAP',
    from,
    to: channel,
    ...pairs,
    deviceId,
    other: target.deviceId,
    lines: [line, { inputId: target.deviceId, deviceId: target.deviceId, channel: from }],
  }
}

/** The body of operation 78 for a `MicMove` (D61: by channel). */
export function micMoveBody(move: MicMove): { unassign?: MicChannel[]; mics: MicChannelLine[] } {
  const asLine = (line: MicChannelLine): MicChannelLine => ({ inputId: line.inputId, deviceId: line.deviceId, channel: line.channel })
  return move.kind === 'SWAP' ? { mics: move.lines.map(asLine) } : { unassign: [move.from], mics: [asLine(move.line)] }
}

// ── One row per slot (task 4 row 31; site W1; decision C18 (3)) ──────────────────────────

/** A video slot of the selector with the line that holds it; `line: null` is the slot NOT ASSIGNED. */
export interface CameraSlotRow {
  readonly slot: VideoTrackId
  readonly line: CaptureCameraLine | null
}

/** A microphone slot of the selector (a CHANNEL, D61) with the line that holds it; `line: null` is the slot NOT ASSIGNED. */
export interface MicSlotRow {
  readonly slot: MicChannel
  readonly line: CaptureMicLine | null
}

const VIDEO_SLOTS = VIDEO_TRACK_IDS // D60 (2026-11-04): four video slots, derived from the shared truth
const MIC_SLOTS = MIC_CHANNEL_IDS // D61 (2026-11-04): four microphone channels, derived from the shared truth

/**
 * The rows of the selector panel: ALWAYS four video rows (D60) and FOUR microphone rows (D61,
 * 2026-11-04), found by track and by CHANNEL and never by position (decision C18 (2), (3)). A slot
 * no line names is a row with `line: null`.
 *
 * Order: a kind whose slots are all held is drawn in the order the Core sent its lines - what
 * the panel drew before this row, so a complete selector reads as it did (the microphone lines are
 * in input order, ruling D137). A kind with an empty slot is drawn in the order of the contract's
 * slot list (`CAPTURE_SELECTOR_SLOTS`: VIDEO-01 … VIDEO-04, MIC-01 … MIC-04).
 */
export function selectorSlotRows(config: Pick<CaptureConfig, 'cameras' | 'mics'>): { readonly cameras: readonly CameraSlotRow[]; readonly mics: readonly MicSlotRow[] } {
  const cameras = VIDEO_SLOTS.map((slot): CameraSlotRow => ({ slot, line: config.cameras.find((line) => line.trackId === slot) ?? null }))
  const mics = MIC_SLOTS.map((slot): MicSlotRow => ({ slot, line: config.mics.find((line) => line.channel === slot) ?? null }))
  const asHeld = <Row extends { readonly line: object | null }>(rows: readonly Row[], lines: readonly object[]): readonly Row[] =>
    rows.every((row) => row.line !== null) ? [...rows].sort((a, b) => lines.indexOf(a.line!) - lines.indexOf(b.line!)) : rows
  return { cameras: asHeld(cameras, config.cameras), mics: asHeld(mics, config.mics) }
}

/** Audit row 156: one camera-microphone pair of the selector - Pair N = `VIDEO-0N` <-> `MIC-0N` (N-04, fixed by number, D27). */
export interface SelectorPairRow {
  readonly pair: number
  readonly camera: CameraSlotRow
  readonly mic: MicSlotRow
  /** Pair 1 is the transcribed pair (N-09, D28 DQ-3). */
  readonly transcribed: boolean
  /** A side holds no source: recording needs a camera and a microphone (S5 §6 "incomplete" warning). */
  readonly incomplete: boolean
}

/**
 * Audit row 156 (D27; D28 DQ-5; S5 §6; AC-4.5): the four pair rows of the selector, ALWAYS in pair
 * order 1..4 (`CAPTURE_PAIRS`) - the pairing is by number, so the Core's line order does not reorder
 * them. Each slot is found by track and by CHANNEL, never by position (decision C18 (2), (3)).
 */
export function selectorPairRows(config: Pick<CaptureConfig, 'cameras' | 'mics'>): readonly SelectorPairRow[] {
  return CAPTURE_PAIRS.map((entry): SelectorPairRow => {
    const camera: CameraSlotRow = { slot: entry.videoTrackId, line: config.cameras.find((line) => line.trackId === entry.videoTrackId) ?? null }
    const mic: MicSlotRow = { slot: entry.micChannel, line: config.mics.find((line) => line.channel === entry.micChannel) ?? null }
    return { pair: entry.pair, camera, mic, transcribed: entry.micChannel === PRIMARY_MIC_CHANNEL, incomplete: camera.line === null || mic.line === null }
  })
}

/**
 * Audit row 156 (U-13 of D74; N-40): the one label of a microphone slot on the selector, "Mic N
 * (Camera N)" for all four channels - not "Channel 1 (transcribed)" / "Channel 2" / "Microphone 3" /
 * "Microphone 4" (the transcription is said once, on the Pair 1 row). It is the one microphone label of
 * every page: the selector, `/session/new` (row 158), the Session Monitor (row 157) and the Dashboard
 * tiles (row W3T). Audit row W3T (D129): the old chip words `micChannelChipKey` and `micTrackChannelChip`
 * ("Channel 1 (transcribed)" / "Channel 2" / "Channel 3") lost their last readers and are removed.
 */
export function micPairLabel(channel: MicChannel): { readonly key: 'devices.pairs.micOfCamera'; readonly values: { readonly n: number } } {
  return { key: 'devices.pairs.micOfCamera', values: { n: capturePairOfMicChannel(channel).pair } }
}

/** A command that was refused or not answered: the status and the code, never the answer's text. */
export interface SelectorFailure {
  readonly ok: false
  readonly operationId: SelectorOperation
  readonly status: number | null
  readonly code: string
  /** `details.reason` of the answer (`DEVELOPMENT_SOURCE_NOT_ALLOWED`, `CAPTURE_NOT_READY`), when it is a code. */
  readonly reason: string | null
  /** The failed Live call, for the refusal presenter; `null` in Simulated mode. */
  readonly failure: CoreCallFailure | null
}

export type SelectorAnswer = { readonly ok: true } | SelectorFailure

/** What the panel does with a refusal; pure (ux §2.2 step 6, §2.5). */
export type SelectorRefusal = 'LOCKED' | 'DEVELOPMENT_ONLY' | 'INVALID' | 'UNKNOWN_DEVICE' | 'NOT_LOST' | 'RECORDING' | 'OTHER'

export function selectorRefusal(failure: SelectorFailure): SelectorRefusal {
  if (failure.status === 409 && failure.code === ApiErrorCode.CAPTURE_CONFIG_LOCKED) return 'LOCKED'
  if (failure.status === 409 && failure.code === ApiErrorCode.CAMERA_NOT_LOST) return 'NOT_LOST'
  if (failure.status === 409 && failure.code === 'RECORDING_ACTIVE') return 'RECORDING'
  if (failure.status === 422) return failure.reason === 'DEVELOPMENT_SOURCE_NOT_ALLOWED' ? 'DEVELOPMENT_ONLY' : 'INVALID'
  if (failure.status === 404) return 'UNKNOWN_DEVICE'
  return 'OTHER'
}

const reasonOf = (details: unknown): string | null => {
  const reason = (details as { reason?: unknown } | null | undefined)?.reason
  return typeof reason === 'string' ? reason : null
}

const liveFailure = (operationId: SelectorOperation, answer: CoreCallFailure): SelectorFailure => ({
  ok: false,
  operationId,
  status: answer.status,
  code: answer.error.code,
  reason: reasonOf(answer.error.details),
  failure: answer,
})

/** The simulator's answer to one request, as a `SelectorAnswer`. */
function simAnswer(operationId: SelectorOperation, response: { readonly status: number; readonly body: unknown }): SelectorAnswer {
  if (response.status >= 200 && response.status < 300) return { ok: true }
  const error = (response.body as { error?: { code?: unknown; details?: unknown } } | null)?.error
  return {
    ok: false,
    operationId,
    status: response.status,
    code: typeof error?.code === 'string' ? error.code : 'SIMULATOR_ERROR',
    reason: reasonOf(error?.details),
    failure: null,
  }
}

/** After an answer: the answer's snapshot is the newest one, and a refusal that says the read is stale asks again. */
function settleCache(queryClient: QueryClient, answer: SelectorAnswer, config: CaptureConfig | null): void {
  if (answer.ok) {
    if (config !== null && queryClient.getQueryData(CORE_QUERY_KEYS.captureConfig) !== undefined) {
      queryClient.setQueryData<CaptureConfig>(CORE_QUERY_KEYS.captureConfig, config)
    }
    return
  }
  const refusal = selectorRefusal(answer)
  if (refusal === 'LOCKED') retryCoreQuery(queryClient, CORE_QUERY_KEYS.captureConfig)
  if (refusal === 'UNKNOWN_DEVICE' || refusal === 'NOT_LOST') retryCoreQuery(queryClient, CORE_QUERY_KEYS.captureDevices)
}

const COMMAND_THREW_RECORD = 'A command of the capture device selector could not be sent.'

export interface CaptureSelectorCommands {
  /**
   * `deviceId` feeds `trackId`. Without `profile`: operation 79, as always. With `profile` (task 4 row W5,
   * review 060d Q-02; `camera-profile.ts`): ONE camera line of operation 78 that names the chosen stream
   * profile - operation 79's body has no profile member, and a production camera is assigned with one.
   */
  readonly setCameraSource: (deviceId: string, trackId: VideoTrackId, profile?: string) => Promise<SelectorAnswer>
  /** Operation 80 `setPrimaryMic` (D61; D30 K-4): the named input becomes the Mic of Camera 1 (Pair 1, transcribed); the input that held it takes the named input's old channel. */
  readonly setPrimaryMic: (inputId: string) => Promise<SelectorAnswer>
  /** Operation 78 by channel (D61, 2026-11-04): `lines` (of `micLineFor`) are microphone lines each naming its channel; a line assigns its channel alone. */
  readonly setMicLine: (lines: readonly MicChannelLine[]) => Promise<SelectorAnswer>
  /** Operation 78, member `unassign` (task 4 row 31; names register N1): the slot holds no source afterwards. */
  readonly unassign: (slot: CaptureSelectorSlot) => Promise<SelectorAnswer>
  /** Operation 78, ONE edit (`micMoveFor`, `micMoveBody`; audit row 156, D22(3)): a SWAP is two lines by channel; a MOVE onto an empty pair is `unassign` of the channel left and its one line. */
  readonly moveMic: (move: MicMove) => Promise<SelectorAnswer>
  /** Operation 48 for a camera: the confirmed PoE cycle (`{ confirm: true }`, OD-22). */
  readonly poeCycle: (deviceId: string) => Promise<SelectorAnswer>
}

async function callLive(
  live: WebLive,
  queryClient: QueryClient,
  operationId: SelectorOperation,
  send: () => Promise<{ readonly ok: true; readonly data: unknown } | CoreCallFailure>,
): Promise<SelectorAnswer> {
  const result = await send()
  const answer: SelectorAnswer = result.ok ? { ok: true } : liveFailure(operationId, result)
  settleCache(queryClient, answer, result.ok && operationId !== 'restartDevice' ? (result.data as CaptureConfig) : null)
  void live
  return answer
}

/**
 * The commands of the selector. Each resolves with the answer and never rejects: a call that could
 * not even be made (a programming error of the client) is one record in the page's own log and a
 * failure without a status.
 */
export function useCaptureSelectorCommands(): CaptureSelectorCommands {
  const live = useWebLive()
  const sim = useSimInstance()
  const actions = useCoreActions()
  const queryClient = useQueryClient()

  return useMemo<CaptureSelectorCommands>(() => {
    const guarded = async (operationId: SelectorOperation, run: () => Promise<SelectorAnswer> | SelectorAnswer): Promise<SelectorAnswer> => {
      try {
        return await run()
      } catch (error) {
        reportDevicesError('features/devices.captureSelector', error, COMMAND_THREW_RECORD, { operationId })
        return { ok: false, operationId, status: null, code: 'CLIENT_ERROR', reason: null, failure: null }
      }
    }
    return {
      setCameraSource: (deviceId, trackId, profile) =>
        profile !== undefined
          ? guarded('updateCaptureConfig', () => {
              const body = { cameras: [{ trackId, deviceId, profile }] }
              return live === null
                ? simAnswer('updateCaptureConfig', sim.request({ method: 'POST', path: '/api/v1/capture/config', body }))
                : callLive(live, queryClient, 'updateCaptureConfig', () => live.client.call('updateCaptureConfig', { body }))
            })
          : guarded('setCaptureCameraSource', () =>
          live === null
            ? simAnswer('setCaptureCameraSource', sim.request({ method: 'POST', path: `/api/v1/capture/cameras/${encodeURIComponent(deviceId)}/source`, body: { trackId } }))
            : callLive(live, queryClient, 'setCaptureCameraSource', () => live.client.call('setCaptureCameraSource', { params: { id: deviceId }, body: { trackId } })),
        ),
      setPrimaryMic: (inputId) =>
        guarded('setPrimaryMic', () =>
          live === null
            ? simAnswer('setPrimaryMic', sim.request({ method: 'POST', path: `/api/v1/capture/mics/${encodeURIComponent(inputId)}/primary` }))
            : callLive(live, queryClient, 'setPrimaryMic', () => live.client.call('setPrimaryMic', { params: { id: inputId } })),
        ),
      setMicLine: (lines) =>
        guarded('updateCaptureConfig', () => {
          // D61 (2026-11-04): the lines are keyed by channel (the role member is superseded).
          const body = { mics: lines.map((line) => ({ inputId: line.inputId, deviceId: line.deviceId, channel: line.channel })) }
          return live === null
            ? simAnswer('updateCaptureConfig', sim.request({ method: 'POST', path: '/api/v1/capture/config', body }))
            : callLive(live, queryClient, 'updateCaptureConfig', () => live.client.call('updateCaptureConfig', { body }))
        }),
      unassign: (slot) =>
        guarded('updateCaptureConfig', () => {
          const body = { unassign: [slot] }
          return live === null
            ? simAnswer('updateCaptureConfig', sim.request({ method: 'POST', path: '/api/v1/capture/config', body }))
            : callLive(live, queryClient, 'updateCaptureConfig', () => live.client.call('updateCaptureConfig', { body }))
        }),
      moveMic: (move) =>
        guarded('updateCaptureConfig', () => {
          const body = micMoveBody(move) // D61: by channel; row 156: the swap is two lines and no `unassign`
          return live === null
            ? simAnswer('updateCaptureConfig', sim.request({ method: 'POST', path: '/api/v1/capture/config', body }))
            : callLive(live, queryClient, 'updateCaptureConfig', () => live.client.call('updateCaptureConfig', { body }))
        }),
      poeCycle: (deviceId) =>
        guarded('restartDevice', () => {
          if (live !== null) {
            return callLive(live, queryClient, 'restartDevice', () => live.client.call('restartDevice', { params: { id: deviceId }, body: { confirm: true } }))
          }
          // Simulated mode: the simulator's own device command (it audits it and applies its RBAC); a throw is the refusal.
          // (`useCoreActions()` is the simulator's action here and settles in the call.)
          void actions.deviceCommand(deviceId, DeviceCommand.RESTART)
          return { ok: true }
        }),
    }
  }, [live, sim, actions, queryClient])
}
