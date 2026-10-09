/**
 * The mic switch of the Session Monitor: its view, its gate, its refusals and the read of the
 * audio-source intervals (task 3 M5, blueprint row 72; `masterplan/08_client_ux_spec.md` §3 flow 2;
 * `masterplan/03_api_contract.md` §2.2-§2.4 operations 81 and 82; `masterplan/01_specs.md` R-3;
 * decisions D4 OD-09 and OD-11). Kept in a `.ts` module so the panel files export only components.
 *
 * | Export | What it is |
 * |--------|------------|
 * | `audioSourceToggleGate` | G4 / G5 (ux §3.4): Checking → allowed, or refused with its reason (not recording, the role, not the session holder) |
 * | `switchRefusal` | What a refused switch means to the panel (ux §3.5): conflict, not recording, not the open session |
 * | `silentInputOf` | The input an active `MIC_SILENT` warning names (ux §3.2 step 8) |
 * | `useAudioSource` | The active/standby pair, the gate and the warning, in both data modes |
 * | `useAudioSourceSwitch` | The confirmed switch: the dialog's state, the one `settle` site of operation 81, the refusal that stays on the panel |
 * | `useAudioSourceIntervals` | Operation 82 in both data modes, for the audio-source band (WB-10) |
 *
 * **One active microphone, switched by hand.** The pair on screen is what the Core holds
 * (`session.audioSource`, with the meters' `activeInputId` behind it): nothing here flips it. A
 * press sends operation 81 through `useCoreActions()` (the panel's `settle` site) and the pair moves
 * when the Core's state does. A `MIC_SILENT` warning only offers the switch; nothing in this module
 * or in the panel calls the action by itself (OD-11).
 */
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { toast } from '@heroui/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ApiErrorCode, type AudioSourceIntervalEntry } from '@dems/shared/api'
import { MicInputId, SessionState } from '@dems/shared/domain'
import { useCoreActions, useCorePermission } from '@dems/shared/live'
import {
  MIC_INPUT_OF_CHANNEL,
  OperatorRole,
  Permission,
  ROLE_PERMISSIONS,
  selectCan,
  selectOperator,
  selectRole,
  SimNotFoundError,
  SimTransitionError,
  useSim,
  useSimInstance,
  type SimState,
} from '@dems/shared/sim'
import { useCoreErrorPresenter } from '@/lib/core-errors'
import {
  audioSourceIntervalsQueryKey,
  audioSourceIntervalsQueryOptions,
  CoreReadError,
  retryCoreQuery,
  useAudioSourceReadGate,
  useQueryFailure,
} from '@/lib/core-queries'
import { usePendingControl } from '@/lib/pending-control'
import { logSessionMonitorError } from './log'
import { MIC_INPUT_LABEL_KEY } from './model'

// ── The gate (G4, G5) ────────────────────────────────────────────────────────────────────

/** Why the mic toggle is not offered now; `null` when it is. */
export type AudioSourceToggleBlock =
  /** The role, the link or the session holder is not resolved: "Checking your permissions…" (E-16). */
  | { readonly kind: 'CHECKING' }
  /** No session is recording (`409 INVALID_STATE`): the toggle is not drawn, its reason is. */
  | { readonly kind: 'NOT_RECORDING' }
  /** `SESSION_START` is not held: the roles that hold it are named. */
  | { readonly kind: 'ROLE'; readonly roles: readonly OperatorRole[] }
  /** `SESSION_START` is held, but the operator neither opened this session nor is a SUPERVISOR (OD-09). */
  | { readonly kind: 'HOLDER' }

/** The roles that hold `SESSION_START`, in the order of the role set. */
export function sessionStartRoles(): readonly OperatorRole[] {
  return Object.values(OperatorRole).filter((role) => (ROLE_PERMISSIONS[role] as readonly Permission[]).includes(Permission.SESSION_START))
}

/** OD-09: the operator who opened the session, or a SUPERVISOR. Pure. */
export function isSessionHolder(input: { readonly operatorId: string | null; readonly role: OperatorRole | null; readonly createdBy: string | null }): boolean {
  if (input.role === OperatorRole.SUPERVISOR) return true
  return input.operatorId !== null && input.operatorId === input.createdBy
}

/**
 * G4 / G5 (ux §3.4): `Checking → allowed` or `Checking → refused with its reason`; pure. The state
 * of the session is said before the role: without a recording there is nothing to switch.
 */
export function audioSourceToggleGate(input: {
  readonly resolved: boolean
  readonly recording: boolean
  /** `SESSION_START` is held. */
  readonly canStart: boolean
  /** `isSessionHolder`. */
  readonly holder: boolean
}): AudioSourceToggleBlock | null {
  if (!input.resolved) return { kind: 'CHECKING' }
  if (!input.recording) return { kind: 'NOT_RECORDING' }
  if (!input.canStart) return { kind: 'ROLE', roles: sessionStartRoles() }
  if (!input.holder) return { kind: 'HOLDER' }
  return null
}

// ── Refusals of operation 81 ─────────────────────────────────────────────────────────────

/** What the panel does with a refusal the presenter left to the page; pure (ux §3.2 steps 6-7, §3.5). */
export type SwitchRefusal = 'CONFLICT' | 'NOT_RECORDING' | 'NOT_OPEN' | 'OTHER'

/** The class of a refused switch: the Live rejection (code, status) or what the simulator threw. Never its text. */
export function switchRefusal(error: unknown): SwitchRefusal {
  const facts = (typeof error === 'object' && error !== null ? error : {}) as { code?: unknown; status?: unknown }
  const code = typeof facts.code === 'string' ? facts.code : null
  const status = typeof facts.status === 'number' ? facts.status : null
  if (code === ApiErrorCode.AUDIO_SOURCE_CONFLICT) return 'CONFLICT'
  if (code === ApiErrorCode.NOT_FOUND || status === 404 || error instanceof SimNotFoundError) return 'NOT_OPEN'
  if (code === ApiErrorCode.INVALID_STATE || error instanceof SimTransitionError) return 'NOT_RECORDING'
  return 'OTHER'
}

/** The facts of a failed switch for the page's own record: the class, the code and the status. */
export function switchFailureFacts(error: unknown): Record<string, unknown> {
  const facts = (typeof error === 'object' && error !== null ? error : {}) as { code?: unknown; status?: unknown }
  return {
    refusal: switchRefusal(error),
    code: typeof facts.code === 'string' ? facts.code : null,
    status: typeof facts.status === 'number' ? facts.status : null,
  }
}

// ── The view ─────────────────────────────────────────────────────────────────────────────

const OTHER_INPUT: Readonly<Record<MicInputId, MicInputId>> = { 'MIC-01': MicInputId.MIC_02, 'MIC-02': MicInputId.MIC_01 }

/** The input the Core says is inside `AUDIO-01` now: the session's pair, else the meters' member. */
export const selectActiveInputId = (s: SimState): MicInputId => s.session?.audioSource?.activeInputId ?? s.audio.activeInputId

/** The hot standby: the session's pair, else the other input. */
export const selectStandbyInputId = (s: SimState): MicInputId => s.session?.audioSource?.standbyInputId ?? OTHER_INPUT[selectActiveInputId(s)]

/**
 * The input an active `MIC_SILENT` warning names, or `null` when none is active. The fault's target
 * is the channel of the input; a warning without a readable target is about the active input.
 */
export function silentInputOf(faults: SimState['faults']['active'], activeInputId: MicInputId): MicInputId | null {
  const fault = faults.find((entry) => entry.kind === 'MIC_SILENT')
  if (!fault) return null
  if (fault.target === MicInputId.MIC_01 || fault.target === MicInputId.MIC_02) return fault.target
  const input = fault.target === null ? undefined : (MIC_INPUT_OF_CHANNEL as Readonly<Record<string, MicInputId | undefined>>)[fault.target]
  return input ?? activeInputId
}

export interface AudioSourceView {
  readonly sessionId: string | null
  readonly recording: boolean
  /** The pair as the Core holds it. */
  readonly activeInputId: MicInputId
  readonly standbyInputId: MicInputId
  /** Core instant of the last switch; `null` before the first. */
  readonly switchedAt: number | null
  /** G4 / G5: why the toggle is not offered; `null` when it is. */
  readonly block: AudioSourceToggleBlock | null
  /** The input of an active `MIC_SILENT` warning, or `null`. */
  readonly silentInputId: MicInputId | null
}

/** The active/standby pair, the gate of the toggle and the silence warning, in both data modes. */
export function useAudioSource(): AudioSourceView {
  const gate = useAudioSourceReadGate()
  const live = gate.live !== null
  const sessionId = useSim((s) => s.session?.id ?? null)
  const recording = useSim((s) => s.session?.state === SessionState.RECORDING)
  const createdBy = useSim((s) => s.session?.createdBy ?? null)
  const activeInputId = useSim(selectActiveInputId)
  const standbyInputId = useSim(selectStandbyInputId)
  const switchedAt = useSim((s) => s.session?.audioSource?.switchedAt ?? null)
  const operatorId = useSim((s) => selectOperator(s)?.id ?? null)
  const role = useSim(selectRole)
  const corePermission = useCorePermission(Permission.SESSION_START)
  const simPermission = useSim((s) => selectCan(s, Permission.SESSION_START))
  const faults = useSim((s) => s.faults.active)

  // Live mode: signed in and the link up (the Core's permission list and its session are the ones
  // on screen). Simulated mode: the simulator's operator is known in the same turn.
  const resolved = (live ? gate.enabled : true) && operatorId !== null
  const block = audioSourceToggleGate({
    resolved,
    recording,
    canStart: live ? corePermission : simPermission,
    holder: isSessionHolder({ operatorId, role, createdBy }),
  })
  const silentInputId = useMemo(() => (recording ? silentInputOf(faults, activeInputId) : null), [recording, faults, activeInputId])

  return { sessionId, recording, activeInputId, standbyInputId, switchedAt, block, silentInputId }
}

// ── The confirmed switch (operation 81) ──────────────────────────────────────────────────

export interface AudioSourceSwitchControl {
  /** The confirmation dialog is open. */
  readonly confirmOpen: boolean
  /** Opens the confirmation; does nothing while the gate blocks the toggle. */
  readonly ask: () => void
  readonly cancel: () => void
  /** The operator confirmed: sends operation 81 for the standby input. One command at a time. */
  readonly confirm: () => void
  /** LB-1: the command is out. */
  readonly busy: boolean
  /** LB-1: out for longer than the reveal time. */
  readonly pending: boolean
  /** For the confirm button: carries `aria-busy` while the command is out. */
  readonly ref: RefObject<HTMLButtonElement | null>
  /** A refusal that stays on the panel (ux §3.5) until the next press. */
  readonly refusal: Exclude<SwitchRefusal, 'OTHER'> | null
}

/**
 * The explicit, confirmed switch (ux §3.2 steps 2-7). The ONLY place of the console that calls
 * `actions.switchAudioSource`, and only from the operator's confirm. Nothing is flipped here: the
 * pair on screen follows the Core's state, and the success toast names the input the store holds
 * when the command settled.
 */
export function useAudioSourceSwitch(view: AudioSourceView): AudioSourceSwitchControl {
  const { t } = useTranslation()
  const actions = useCoreActions()
  const sim = useSimInstance()
  const presentCoreError = useCoreErrorPresenter()
  const press = usePendingControl()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [refusal, setRefusal] = useState<Exclude<SwitchRefusal, 'OTHER'> | null>(null)
  const { block, activeInputId, standbyInputId } = view

  const ask = () => {
    if (block !== null) return
    setRefusal(null)
    setConfirmOpen(true)
  }
  const cancel = () => {
    if (!press.busy) setConfirmOpen(false)
  }
  const confirm = () => {
    if (block !== null) return
    const from = activeInputId
    const to = standbyInputId
    press.settle(() => actions.switchAudioSource(to), {
      ok: () => {
        setConfirmOpen(false)
        // Read on the settle: the input the Core's state names, not the one that was asked for.
        const active = selectActiveInputId(sim.store.getState())
        toast.success(t('session.audioSource.switched', { mic: t(MIC_INPUT_LABEL_KEY[active]) }))
      },
      fail: (error) => {
        setConfirmOpen(false)
        logSessionMonitorError('AudioPanel.switchAudioSource', error, { from, to, ...switchFailureFacts(error) })
        if (presentCoreError(error) !== null) return
        const kind = switchRefusal(error)
        if (kind === 'OTHER') toast.danger(t('session.audioSource.failed'))
        else setRefusal(kind)
      },
    })
  }
  return { confirmOpen, ask, cancel, confirm, busy: press.busy, pending: press.pending, ref: press.ref, refusal }
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
 * A failed read is one record of the page and a Retry on the band; it never blocks the toggle.
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

  // The Core reported a switch (or the recording ended): the list has a new interval. The value of
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
