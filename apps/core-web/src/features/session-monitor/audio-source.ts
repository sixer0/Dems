/**
 * The audio source of the Session Monitor: the transcribed input, the silence warning and the read
 * of the audio-source intervals (task 3 M5, blueprint row 72; `masterplan/03_api_contract.md` §2.4
 * operation 82; `masterplan/01_specs.md` R-3; decision OD-11).
 * Kept in a `.ts` module so the panel files export only components.
 *
 * Audit row 157 (D5, S5 §6; AC-4.6; decisions D4, D30, D130): operation 81 is retired - the
 * microphones are fixed by the camera-microphone pairing (Pair N = `VIDEO-0N` <-> `MIC-0N`,
 * `CAPTURE_PAIRS`; Pair 1 is transcribed). The confirmed manual switch, its gate (G4 / G5) and its
 * refusal classes are REMOVED from the console; the simulator (row 150) and the Core (row 149)
 * refuse the operation with `409 AUDIO_SOURCE_FIXED_BY_PAIRING`. Nothing in this module sends
 * operation 81.
 *
 * | Export | What it is |
 * |--------|------------|
 * | `selectActiveInputId`, `selectStandbyInputId` | The pair as the Core states it; each `null` when absent (task 4 row 168) |
 * | `silentInputOf` | The input an active `MIC_SILENT` warning names (ux §3.2 step 8) |
 * | `useAudioSource` | The transcribed input and the warning, in both data modes |
 * | `useAudioSourceIntervals` | Operation 82 in both data modes, for the audio-source band (WB-10) |
 */
import { useEffect, useMemo, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AudioSourceIntervalEntry } from '@dems/shared/api'
import { AUDIO_TRACK_IDS, SessionState, type AudioTrackId } from '@dems/shared/domain' // D61 (2026-11-04): the four meter channels
import {
  captureMicLines,
  meterInputOfChannel,
  selectOperator,
  useSim,
  useSimInstance,
  type ChannelMicLine, // D61 (2026-11-04): the role alias became the channel line
  type SimState,
  audioPairInForce,
  openSessionAudioSource,
  selectorInForce,
  sessionIsOpen,
} from '@dems/shared/sim'
import { isMicInputId, otherMicInput } from '@/lib/capture-notices'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import {
  audioSourceIntervalsQueryKey,
  audioSourceIntervalsQueryOptions,
  CoreReadError,
  retryCoreQuery,
  useAudioSourceReadGate,
  useQueryFailure,
} from '@/lib/core-queries'
import { logSessionMonitorError } from './log'

// ── The view ─────────────────────────────────────────────────────────────────────────────

/**
 * An OPEN session that states no pair yet (before its recording starts): `audioPairInForce` names
 * nothing for it, and this file reads the meters' member and the lines of the selector in force.
 * Not this state: no session, a sealed one, or a selector without a line for a role - there the
 * pair in force is the whole answer and a `null` of it is "no such input".
 */
const openSessionWithoutPair = (s: SimState): boolean => sessionIsOpen(s.session) && openSessionAudioSource(s.session) === null

/** The microphone lines of the selector the session records under (its snapshot WHILE IT IS OPEN, else the stored one). */
const linesInForce = (s: SimState): readonly { readonly inputId: string }[] => selectorInForce(s)?.mics ?? []

/**
 * The input inside `AUDIO-01` now, or `null` when there is none: the pair of the OPEN session; with
 * no open session the PRIMARY line of the current selector (`audioPairInForce`, fix 157: a SEALED
 * session's pair names nothing any more); under an open session that states no pair yet, the meters'
 * member.
 *
 * Task 4 row 168 (site W6; decision C18 (2); names register file 12): the answer is nullable and no
 * input stands in. A selector without a PRIMARY line has no active input, whatever the meters' member
 * still says; and the meters' member is answered only when the selector in force holds that input.
 */
export const selectActiveInputId = (s: SimState): string | null => {
  const named = audioPairInForce(s).activeInputId
  if (named !== null) return named
  if (!openSessionWithoutPair(s)) return null
  // Typed as the slice states it on the wire (`string | null`); the state's own type is behind the seam of row 28.
  const held: string | null = s.audio.activeInputId
  return held !== null && linesInForce(s).some((line) => line.inputId === held) ? held : null
}

/**
 * The hot standby, or `null` when there is none: the pair in force (the OPEN session's; with no open
 * session the current selector's STANDBY line); under an open session that states no pair yet, the
 * other microphone line of the selector it records under, whatever its number.
 *
 * Task 4 row 168: no built-in input is answered (the table `MIC-01` <-> `MIC-02` is gone) and the
 * active input never stands in for its own standby.
 */
export const selectStandbyInputId = (s: SimState): string | null => {
  const named = audioPairInForce(s).standbyInputId
  if (named !== null) return named
  if (!openSessionWithoutPair(s)) return null
  const active = selectActiveInputId(s)
  return active === null ? null : otherMicInput(linesInForce(s), active)
}

/**
 * The input an active `MIC_SILENT` warning names, or `null` when none is active or it names no
 * input. The fault's target is the channel of the input; a warning without a readable target is
 * about the active input. `mics`: the microphone lines of the capture configuration
 * (`captureMicLines`).
 *
 * Task 4 row 168 (site W6): the input of a channel is `meterInputOfChannel` - the line at the
 * channel's place of a COMPLETE pair (ruling D137, kept by C21 (7)), never a built-in input. A
 * channel without an input names none, and so does a fault without a target when no input is active.
 */
export function silentInputOf(faults: SimState['faults']['active'], activeInputId: string | null, mics: readonly ChannelMicLine[]): string | null {
  const fault = faults.find((entry) => entry.kind === 'MIC_SILENT')
  if (!fault) return null
  // The input itself, by the id the Core sent (`MIC-NN`, any number).
  if (isMicInputId(fault.target)) return fault.target
  // D61 (2026-11-04): the warning may name any of the four meter channels; each maps to its line's input.
  const target = fault.target as string | null
  if (target !== null && (AUDIO_TRACK_IDS as readonly string[]).includes(target)) return meterInputOfChannel(mics, target as AudioTrackId)
  return activeInputId
}

export interface AudioSourceView {
  readonly sessionId: string | null
  readonly recording: boolean
  /** The input inside `AUDIO-01` (the transcribed Pair 1 microphone) as the Core states it; `null`: none (task 4 row 168). */
  readonly activeInputId: string | null
  /** Core instant of the last stated change of the pair (a legacy session's switch); `null` before any. */
  readonly switchedAt: number | null
  /** The input of an active `MIC_SILENT` warning, or `null`. */
  readonly silentInputId: string | null
}

/**
 * The transcribed input and the silence warning, in both data modes. Row 157: the toggle's gate
 * (role, session holder, Checking) is gone with operation 81 - there is nothing to switch.
 */
export function useAudioSource(): AudioSourceView {
  const sessionId = useSim((s) => s.session?.id ?? null)
  const recording = useSim((s) => s.session?.state === SessionState.RECORDING)
  const activeInputId = useSim(selectActiveInputId)
  const switchedAt = useSim((s) => openSessionAudioSource(s.session)?.switchedAt ?? null)
  const faults = useSim((s) => s.faults.active)
  const micLines = useSim(captureMicLines)
  const silentInputId = useMemo(() => (recording ? silentInputOf(faults, activeInputId, micLines) : null), [recording, faults, activeInputId, micLines])
  return { sessionId, recording, activeInputId, switchedAt, silentInputId }
}

// ── Operation 82: the audio-source intervals ─────────────────────────────────────────────

export type AudioSourceIntervalsRead =
  /** No session, or the read is closed (Live: the link is not up). */
  | { readonly kind: 'NONE' }
  | { readonly kind: 'LOADING' }
  | { readonly kind: 'FAILED' }
  | { readonly kind: 'READY'; readonly items: readonly AudioSourceIntervalEntry[] }

export interface AudioSourceIntervalsView {
  readonly read: AudioSourceIntervalsRead
  /** Asks again after a failed read; respects the gate. Nothing to do in Simulated mode. */
  readonly retry: () => void
}

const NONE: AudioSourceIntervalsRead = { kind: 'NONE' }
const INTERVALS_READ_FAILED = 'listAudioSourceIntervals'

/**
 * The intervals of the open session (operation 82). Live mode: the query factory of
 * `lib/core-queries.ts`, asked again each time the Core reports a switch (`switchedAt` of the
 * session's pair). Simulated mode: the simulator's own answer to the same operation.
 * A failed read is one record of the page and a Retry on the band.
 */
export function useAudioSourceIntervals(view: Pick<AudioSourceView, 'sessionId' | 'switchedAt' | 'recording'>): AudioSourceIntervalsView {
  const gate = useAudioSourceReadGate()
  const live = gate.live !== null
  const sim = useSimInstance()
  const queryClient = useQueryClient()
  const presentCoreError = useCoreErrorPresenter()
  const signedIn = useSim((s) => selectOperator(s) !== null)
  const { sessionId, switchedAt, recording } = view
  const query = useQuery(audioSourceIntervalsQueryOptions(gate, sessionId))

  useQueryFailure(query, (error) => {
    const failure = error instanceof CoreReadError ? error.failure : null
    if (failure !== null && presentCoreError(failure) !== null) return
    logSessionMonitorError(INTERVALS_READ_FAILED, error, { operationId: 'listAudioSourceIntervals', status: failure?.status ?? null, code: failure?.error.code ?? null })
  })

  // The Core reported a change of the pair (or the recording ended): the list has a new interval. The value of
  // the mount is not a change: the read of the mount is at least as new.
  const seen = useRef({ switchedAt, recording })
  useEffect(() => {
    if (seen.current.switchedAt === switchedAt && seen.current.recording === recording) return
    seen.current = { switchedAt, recording }
    if (live && sessionId !== null) retryCoreQuery(queryClient, audioSourceIntervalsQueryKey(sessionId))
  }, [switchedAt, recording, live, sessionId, queryClient])

  const simulated = useMemo<AudioSourceIntervalsRead>(() => {
    if (live || sessionId === null || !signedIn) return NONE
    // The simulator's answer changes with a switch and with the end of the recording.
    void switchedAt
    void recording
    const response = sim.request({ method: 'GET', path: `/api/v1/session/${encodeURIComponent(sessionId)}/audio-source` })
    if (response.status !== 200) return NONE
    return { kind: 'READY', items: (response.body as { items: readonly AudioSourceIntervalEntry[] }).items }
  }, [live, sim, sessionId, signedIn, switchedAt, recording])

  const read = useMemo<AudioSourceIntervalsRead>(() => {
    if (!live) return simulated
    if (sessionId === null || !gate.enabled) return NONE
    if (query.error != null) return { kind: 'FAILED' }
    if (query.data === undefined) return { kind: 'LOADING' }
    return { kind: 'READY', items: query.data.items }
  }, [live, simulated, sessionId, gate.enabled, query.error, query.data])

  const retry = () => {
    if (live && sessionId !== null) retryCoreQuery(queryClient, audioSourceIntervalsQueryKey(sessionId))
  }
  return { read, retry }
}
