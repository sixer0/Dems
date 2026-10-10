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
 *
 * Kept in a `.ts` module so the dialog file exports only components.
 */
import { useCallback, useMemo, useRef, useState } from 'react'
import { useSim } from '@dems/shared/sim'
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

/**
 * The local devices the next pre-check opens, or `null`: the selector the open session was created
 * under (its `captureConfig` snapshot), else the stored one — the rule of `usePrecheckDevice`.
 * Always `null` outside real capture. Read as one flat string, so the result compares by value.
 */
export function useLocalSources(): LocalSources | null {
  const realCapture = useRealCapture()
  const flat = useSim((state) => {
    const sources = localSourcesOf(state.session?.captureConfig ?? state.captureConfig, state.captureDevices)
    return sources === null ? null : `${sources.camera ?? ''}${SLOT_JOIN}${sources.microphone ?? ''}`
  })
  return useMemo(() => {
    if (!realCapture || flat === null) return null
    const [camera = '', microphone = ''] = flat.split(SLOT_JOIN)
    return { camera: camera === '' ? null : camera, microphone: microphone === '' ? null : microphone }
  }, [realCapture, flat])
}

export interface LocalSourceGate {
  /** The local devices the next pre-check opens; `null` = none, and every member below is then a pass-through. */
  readonly sources: LocalSources | null
  /**
   * Runs `action` at once when the selector names no local device (today's behaviour). Otherwise
   * opens the notice of `kind` (default `PRECHECK`) and runs it on Confirm; Cancel drops it. One
   * notice per call: an earlier Confirm, of either kind, allows nothing here.
   */
  readonly guard: (action: () => void, kind?: LocalSourceNoticeKind) => void
  /** The resume effect may send its pre-check: no local device, or the operator confirmed and that consent is not used yet. */
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
  const sources = useLocalSources()
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
      if (!local) {
        action()
        return
      }
      pending.current = action
      setKind(noticeKind)
      setOpen(true)
    },
    [local],
  )
  const confirm = useCallback(() => {
    const action = pending.current
    pending.current = null
    setOpen(false)
    if (action !== null) action()
  }, [])
  const cancel = useCallback(() => {
    pending.current = null
    setOpen(false)
  }, [])
  const resumeAllowed = useCallback(() => !local || consent.current, [local])
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

  return { sources, guard, resumeAllowed, started, resumeKey, requestResume, failed, waitingFor, open, kind, confirm, cancel }
}
