/**
 * The notice before a pre-check that turns on this Mac's camera or microphone (task 3, fix pass
 * F-M4, review finding R69-01; decisions D163, D178). A CLIENT rule only: the Core's fence is what
 * holds in production; this is what the operator is told before a development device is opened.
 *
 * | Rule | Where |
 * |------|-------|
 * | ONE decision: which local devices a selector names, from the two replicated slices and nothing else | `localSourcesOf` |
 * | A local device = a device of `captureDevices` whose `adapter` is `LOCAL_DEVICE`, named by a line of the selector | `localSourcesOf` |
 * | Only in real capture: in Simulated client mode nothing is opened, so there is no notice (the rule of the badge, D83) | `useLocalSources` |
 * | Nothing is sent before Confirm: the guarded action runs on Confirm and is dropped on Cancel; once per press | `useLocalSourceGate().guard` |
 * | No automatic re-send after a reload: the resume is allowed only by one Confirm, and that consent is used up by the one request it lets out | `resumeAllowed`, `started` |
 * | The START of a recording has its own notice (D181, ruling 7): the devices stay on until the recording ends. A confirmed pre-check notice never counts for it: every `guard` call asks again, and nothing of a Confirm is remembered for a later press | `guard(action, 'START')` |
 * | The "not started" sentence stands for a session in CREATE until THIS page sent that session's pre-check; a failed send brings it back | `waitingFor`, `started`, `failed` |
 * | FAILS CLOSED (wave H, G70-08; ruling D196): while the console does not KNOW the selector's device classes - the device list not answered yet, failed, the link down, or being read again after a reconnect - nothing is let out: `guard` refuses, the resume waits, a Confirm drops its action, and the page disables its controls with the reason | `captureSourcesKnowledge`, `localGuardDecision`, `useCaptureSourcesRead`, `knowledge` |
 * | The classes are read from the Core itself (operations 76 and 77, the selector's own gated reads), and a local device named by EITHER the replicated slices or those answers asks | `useCaptureSourcesRead`, `mergeLocalSources` |
 *
 * Kept in a `.ts` module so the dialog file exports only components.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSim } from '@dems/shared/sim'
import {
  captureConfigQueryOptions,
  captureDevicesQueryOptions,
  retryCoreQuery,
  useCaptureReadGate,
  useCaptureSliceRefresh,
  useQueryFailure,
} from '@/lib/core-queries'
import { CORE_QUERY_KEYS } from '@/runtime'
import { reportDevicesError } from './report'
import { LOCAL_DEVICE_ADAPTER, useRealCapture } from './source-class'

/** The local devices a selector names: the ids as the Core sent them. Two local cameras read as "CAM-03, CAM-05". */
export interface LocalSources {
  readonly camera: string | null
  readonly microphone: string | null
}

interface SelectorLines {
  readonly cameras: readonly { readonly deviceId: string }[]
  readonly mics: readonly { readonly deviceId: string }[]
}

interface RegisteredDevices {
  readonly devices: readonly { readonly id: string; readonly kind: string; readonly adapter?: string | null | undefined }[]
}

const ID_JOIN = ', '

/**
 * Which of this Mac's devices a pre-check under `config` opens; `null` when the selector names
 * none. Decided by the Core's data alone: the `adapter` the Core sent for the device of a selector
 * line. A device the registry does not hold, or one without `adapter`, is not a local device.
 */
export function localSourcesOf(config: SelectorLines | null | undefined, registry: RegisteredDevices | null | undefined): LocalSources | null {
  if (!config || !registry) return null
  const named = (lines: readonly { readonly deviceId: string }[], kind: 'CAMERA' | 'MIC'): string | null => {
    const ids: string[] = []
    for (const line of lines) {
      const device = registry.devices.find((entry) => entry.id === line.deviceId)
      if (device === undefined || device.kind !== kind || device.adapter !== LOCAL_DEVICE_ADAPTER) continue
      if (!ids.includes(device.id)) ids.push(device.id)
    }
    return ids.length === 0 ? null : ids.join(ID_JOIN)
  }
  const camera = named(config.cameras, 'CAMERA')
  const microphone = named(config.mics, 'MIC')
  return camera === null && microphone === null ? null : { camera, microphone }
}

// ── What the console knows of the selector's device classes (wave H, G70-08; ruling D196) ──

/**
 * Whether the console KNOWS which devices the selector names and what they are:
 * `KNOWN`, or not yet (`CHECKING`), or the read failed (`FAILED`). The rule fails closed: nothing
 * that can open a device is let out unless this is `KNOWN`.
 */
export type CaptureSourcesKnowledge = 'KNOWN' | 'CHECKING' | 'FAILED'

/** One of the two gated reads (operations 76 and 77), as far as the rule needs it. */
export interface CaptureSourcesRead {
  /** The read holds an answer of the Core. */
  readonly answered: boolean
  /** The last answer was a failure. */
  readonly failed: boolean
  /** The read is being asked (again): a first read, a Retry, the refetch after a reconnect. */
  readonly fetching: boolean
}

/**
 * The knowledge of the moment; pure. Simulated mode opens nothing, so it is always `KNOWN` there.
 * In Live mode: the link up (`open`), and BOTH reads answered, not failed, and not being asked
 * again. A read that is out is `CHECKING` whatever it held before - the answer on its way is the
 * newer truth (a refetch after RESYNCED, a Retry after a failure).
 */
export function captureSourcesKnowledge(input: { readonly live: boolean; readonly open: boolean; readonly reads: readonly CaptureSourcesRead[] }): CaptureSourcesKnowledge {
  if (!input.live) return 'KNOWN'
  if (!input.open) return 'CHECKING'
  if (input.reads.some((read) => read.fetching)) return 'CHECKING'
  if (input.reads.some((read) => read.failed)) return 'FAILED'
  if (input.reads.some((read) => !read.answered)) return 'CHECKING'
  return 'KNOWN'
}

/** The id of the reason line (`LocalSourceChecking`): a control disabled by the rule names it with `aria-describedby`. */
export const LOCAL_SOURCE_CHECKING_ID = 'local-source-checking'

/** What `guard` does with an action; pure. Unknown classes refuse BEFORE the question of a local device is asked. */
export function localGuardDecision(input: { readonly known: boolean; readonly local: boolean }): 'RUN' | 'ASK' | 'REFUSE' {
  if (!input.known) return 'REFUSE'
  return input.local ? 'ASK' : 'RUN'
}

/** What the confirmed action does to the device: a pre-check opens it briefly, a recording keeps it on until it ends. */
export type LocalSourceNoticeKind = 'PRECHECK' | 'START'

/** The text block of each kind. */
const NOTICE_BLOCK = { PRECHECK: 'common.localSourceNotice', START: 'common.localSourceStartNotice' } as const

/** The text keys of the notice's fixed parts. */
export function localSourceNoticeTextKeys<K extends LocalSourceNoticeKind>(kind: K) {
  const block: (typeof NOTICE_BLOCK)[K] = NOTICE_BLOCK[kind]
  return { title: `${block}.title`, body: `${block}.body`, confirm: `${block}.confirm`, cancel: `${block}.cancel` } as const
}

/** The text key of the notice's first sentence (the `web` wording: "this Mac's"). */
export function localSourceNoticeKey<K extends LocalSourceNoticeKind = 'PRECHECK'>(sources: LocalSources, kind?: K) {
  const block = NOTICE_BLOCK[kind ?? 'PRECHECK'] as (typeof NOTICE_BLOCK)[K]
  const which = sources.camera !== null && sources.microphone !== null ? 'both' : sources.camera !== null ? 'camera' : 'microphone'
  return `${block}.web.${which}` as const
}

const SLOT_JOIN = '\u0000'

/** The fixed sentences of the page's own record (never the answer's text). */
const READ_FAILED_RECORD = 'The capture sources could not be read: the notice rule stays closed.'
const GUARD_REFUSED_RECORD = 'An action that can open a capture device was refused: the capture sources are not known.'
const REPORT_SOURCE = 'features/devices.localSourceGate'

/** The ids of two decisions as one: a device named by either is named. */
function mergeIds(first: string | null, second: string | null): string | null {
  const ids: string[] = []
  for (const id of [...(first?.split(ID_JOIN) ?? []), ...(second?.split(ID_JOIN) ?? [])]) if (!ids.includes(id)) ids.push(id)
  return ids.length === 0 ? null : ids.join(ID_JOIN)
}

/** The local devices named by either decision; `null` when neither names one. */
export function mergeLocalSources(first: LocalSources | null, second: LocalSources | null): LocalSources | null {
  if (first === null) return second
  if (second === null) return first
  return { camera: mergeIds(first.camera, second.camera), microphone: mergeIds(first.microphone, second.microphone) }
}

const flatOf = (sources: LocalSources | null): string | null => (sources === null ? null : `${sources.camera ?? ''}${SLOT_JOIN}${sources.microphone ?? ''}`)
const sourcesOfFlat = (flat: string | null): LocalSources | null => {
  if (flat === null) return null
  const [camera = '', microphone = ''] = flat.split(SLOT_JOIN)
  return { camera: camera === '' ? null : camera, microphone: microphone === '' ? null : microphone }
}

/** What the page reads of the Core to know the selector's device classes (G70-08). */
export interface CaptureSourcesReadState {
  readonly knowledge: CaptureSourcesKnowledge
  /** The local devices the answers of operations 76 / 77 name (the open session's selector first); `null` when none, and while not `KNOWN`. */
  readonly sources: LocalSources | null
  /** Asks again after a failure; respects the gate of the reads (`retryCoreQuery`). */
  readonly retry: () => void
}

/**
 * The selector's own gated reads (operations 76 and 77, `lib/core-queries.ts`), kept current by the
 * republished slices, as the capture device selector reads them. In Simulated mode nothing is read
 * and the knowledge is `KNOWN`. Each new failure is one record in the page's own log.
 */
export function useCaptureSourcesRead(): CaptureSourcesReadState {
  const gate = useCaptureReadGate()
  const queryClient = useQueryClient()
  const config = useQuery(captureConfigQueryOptions(gate))
  const devices = useQuery(captureDevicesQueryOptions(gate))
  useCaptureSliceRefresh()
  useQueryFailure(config, (error) => reportDevicesError(REPORT_SOURCE, error, READ_FAILED_RECORD, { operationId: 'getCaptureConfig' }))
  useQueryFailure(devices, (error) => reportDevicesError(REPORT_SOURCE, error, READ_FAILED_RECORD, { operationId: 'getCaptureDevices' }))
  const knowledge = captureSourcesKnowledge({
    live: gate.live !== null,
    open: gate.enabled,
    reads: [
      { answered: config.data !== undefined, failed: config.error != null, fetching: config.fetchStatus === 'fetching' },
      { answered: devices.data !== undefined, failed: devices.error != null, fetching: devices.fetchStatus === 'fetching' },
    ],
  })
  // The selector the open session was created under, else the Core's answer (the rule of `useLocalSources`).
  const sessionConfig = useSim((state) => state.session?.captureConfig ?? null)
  const answered = gate.live !== null && knowledge === 'KNOWN' ? flatOf(localSourcesOf(sessionConfig ?? config.data, devices.data)) : null
  const sources = useMemo(() => sourcesOfFlat(answered), [answered])
  const retry = useCallback(() => {
    retryCoreQuery(queryClient, CORE_QUERY_KEYS.captureConfig)
    retryCoreQuery(queryClient, CORE_QUERY_KEYS.captureDevices)
  }, [queryClient])
  return { knowledge, sources, retry }
}

/**
 * The local devices the next pre-check opens, or `null`: the selector the open session was created
 * under (its `captureConfig` snapshot), else the stored one — the rule of `usePrecheckDevice`.
 * Always `null` outside real capture. Read as one flat string, so the result compares by value.
 */
export function useLocalSources(): LocalSources | null {
  const realCapture = useRealCapture()
  const flat = useSim((state) => flatOf(localSourcesOf(state.session?.captureConfig ?? state.captureConfig, state.captureDevices)))
  return useMemo(() => (realCapture ? sourcesOfFlat(flat) : null), [realCapture, flat])
}

export interface LocalSourceGate {
  /** The local devices the next pre-check opens; `null` = none, and - while `knowledge` is `KNOWN` - every member below is then a pass-through. */
  readonly sources: LocalSources | null
  /** G70-08: whether the console knows the selector's device classes. Anything but `KNOWN` closes the rule. */
  readonly knowledge: CaptureSourcesKnowledge
  /** `knowledge !== 'KNOWN'`: the page disables its pre-check and start controls and shows the reason (`LocalSourceChecking`). */
  readonly checking: boolean
  /** Asks for the capture sources again after a failed read. */
  readonly retryRead: () => void
  /**
   * REFUSES (runs nothing, one record) while the device classes are not known. Otherwise runs
   * `action` at once when the selector names no local device (the behaviour before the notice), or
   * opens the notice of `kind` (default `PRECHECK`) and runs it on Confirm; Cancel drops it. One
   * notice per call: an earlier Confirm, of either kind, allows nothing here.
   */
  readonly guard: (action: () => void, kind?: LocalSourceNoticeKind) => void
  /** The resume effect may send its pre-check: the classes are known, and no local device is named or the operator confirmed and that consent is not used yet. */
  readonly resumeAllowed: () => boolean
  /** This page sends the pre-check of session `sessionId` now: a resume consent is used up, and the "not started" sentence of that session goes. */
  readonly started: (sessionId: string) => void
  /** Changes when the operator confirmed a resume (a dependency of the resume effect). */
  readonly resumeKey: number
  /** The button "Run the device check": the notice, then the resume. */
  readonly requestResume: () => void
  /** A confirmed pre-check did not go through: the "not started" sentence is shown again. */
  readonly failed: () => void
  /** True while session `sessionId` (left in CREATE) waits for the operator: local devices named, and this page did not send its pre-check. */
  readonly waitingFor: (sessionId: string | null) => boolean
  /** The dialog's state. */
  readonly open: boolean
  readonly kind: LocalSourceNoticeKind
  readonly confirm: () => void
  readonly cancel: () => void
}

/** The notice's state for one page (Session New). */
export function useLocalSourceGate(): LocalSourceGate {
  const read = useCaptureSourcesRead()
  const replicated = useLocalSources()
  const merged = flatOf(mergeLocalSources(replicated, read.sources))
  const sources = useMemo(() => sourcesOfFlat(merged), [merged])
  const { knowledge } = read
  const known = knowledge === 'KNOWN'
  // Read at Confirm: the notice may have been open while the knowledge was lost.
  const knownNow = useRef(known)
  useEffect(() => {
    knownNow.current = known
  }, [known])
  // The action waiting for Confirm. In a ref: it must run exactly once, also when React renders twice.
  const pending = useRef<(() => void) | null>(null)
  const consent = useRef(false)
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<LocalSourceNoticeKind>('PRECHECK')
  const [startedFor, setStartedFor] = useState<string | null>(null)
  const [resumeKey, setResumeKey] = useState(0)
  const local = sources !== null

  const guard = useCallback(
    (action: () => void, noticeKind: LocalSourceNoticeKind = 'PRECHECK') => {
      const decision = localGuardDecision({ known, local })
      if (decision === 'REFUSE') {
        // G70-08, defence in depth: the page's controls are disabled in this state; a call that
        // arrives anyway (a form submit, a key) runs nothing.
        reportDevicesError(REPORT_SOURCE, null, GUARD_REFUSED_RECORD, { knowledge, kind: noticeKind }, 'warn')
        return
      }
      if (decision === 'RUN') {
        action()
        return
      }
      pending.current = action
      setKind(noticeKind)
      setOpen(true)
    },
    [known, knowledge, local],
  )
  const confirm = useCallback(() => {
    const action = pending.current
    pending.current = null
    setOpen(false)
    if (action === null) return
    if (!knownNow.current) {
      // The classes stopped being known while the notice stood: what it named may no longer be true.
      reportDevicesError(REPORT_SOURCE, null, GUARD_REFUSED_RECORD, { knowledge: 'LOST_AT_CONFIRM' }, 'warn')
      return
    }
    action()
  }, [])
  const cancel = useCallback(() => {
    pending.current = null
    setOpen(false)
  }, [])
  const resumeAllowed = useCallback(() => known && (!local || consent.current), [known, local])
  // Without a local device the two below change nothing: the page renders exactly as before.
  const started = useCallback(
    (sessionId: string) => {
      consent.current = false
      if (local) setStartedFor(sessionId)
    },
    [local],
  )
  const requestResume = useCallback(() => {
    guard(() => {
      consent.current = true
      setResumeKey((key) => key + 1)
    })
  }, [guard])
  const failed = useCallback(() => {
    consent.current = false
    if (local) setStartedFor(null)
  }, [local])
  const waitingFor = useCallback((sessionId: string | null) => local && sessionId !== null && startedFor !== sessionId, [local, startedFor])

  return { sources, knowledge, checking: !known, retryRead: read.retry, guard, resumeAllowed, started, resumeKey, requestResume, failed, waitingFor, open, kind, confirm, cancel }
}
