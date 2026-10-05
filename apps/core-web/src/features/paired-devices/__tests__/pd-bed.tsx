/**
 * Test bed of the Paired Devices page in Live mode (plan row W81). FOR TESTS ONLY.
 *
 * It wraps W50's harness (`createLiveTestBed`) with a small model of the Core's pairing area
 * (operations 15, 16, 17, 19 and 20 with the server's rules of `implementation/32`: one active code,
 * 300 s, a new issue replaces the old one, a revoke needs PAIRED and a reason of 5 or more
 * characters) and the helpers the three test files share: toasts (F76-9), the replica's audit
 * append, and the scans of SD-23 (web storage, the URL, the query cache, the sinks).
 *
 * It imports no fake transport itself (the static rule of `live-runtime-static.test.tsx`: the
 * harness is the one non-test file that does); the reply type is taken from the harness.
 *
 * The tests use a MARKER code, `MARKER_CODE`, and scan for it (SD-23). It is not a real code of any
 * Core: the bed's model answers it, nothing else.
 */
import { act, screen } from '@testing-library/react'
import { toast } from '@heroui/react'
import type { QueryClient } from '@tanstack/react-query'
import type { AuthSessionInfo, PairedDevice } from '@dems/shared/api'
import { AUDIT_TYPE_CATEGORY } from '@dems/shared/sim'
import { createLiveTestBed, SUPERVISOR_SESSION, type LivePage, type LiveTestBed, type MountedPage, type MountOptions } from '@/runtime/testing/live-harness'

/** SD-23: the marker code. Its groups ("861", "204") are no run of `0123456789`, which `SlidingNumber` renders. */
export const MARKER_CODE = '861204'
export const MARKER_QR = `DEMS-PAIR:1:${MARKER_CODE}`
/** The lifetime of a code on the Core (`implementation/32` §11.3: `expiresAt = issuedAt + 300,000`). */
export const CODE_LIFETIME_MS = 300_000

type Session = Pick<AuthSessionInfo, 'operator' | 'permissions'>
export type Reply = ReturnType<LiveTestBed['fake']['example']>

/** A second operator who may open the page (AC-C-106: "a second operator on the same page load"). */
export const SECOND_SUPERVISOR: Session = {
  operator: { id: 'OPR-004', username: 'second.supervisor', rank: null, name: 'Second Supervisor', displayName: 'Second Supervisor', initials: 'SS', role: 'SUPERVISOR' },
  permissions: SUPERVISOR_SESSION.permissions,
}

export const without = (permissions: readonly string[], drop: string): AuthSessionInfo['permissions'] =>
  permissions.filter((permission) => permission !== drop) as AuthSessionInfo['permissions']

export interface ActiveCode {
  codeId: string
  code: string
  issuedBy: string
  issuedAt: number
  expiresAt: number
  attemptsRemaining: number
}

/** The Core's pairing area, as the bed answers it. Tests change it between steps. */
export interface PairingCore {
  active: ActiveCode | null
  devices: PairedDevice[]
  /** The digits the next issue returns. */
  nextCode: string
  /** Codes issued so far (the next ID is `PCD-` and this number plus one). */
  issued: number
  /** Who the Core believes issues (the session's operator). */
  issuer: string
}

export interface PdBed {
  readonly bed: LiveTestBed
  readonly core: PairingCore
  readonly page: LivePage
  readonly mounted: MountedPage
  /** Requests of one operation so far. */
  requests(operationId: string): readonly { method: string; path: string; body: unknown; params: Readonly<Record<string, string>> }[]
}

/** A device of the registry, from the contract's own example, changed where a test needs it. */
export function registryDevice(bed: LiveTestBed, change: Partial<PairedDevice> = {}): PairedDevice {
  const example = bed.fake.example('listPairedDevices').body as { devices: PairedDevice[] }
  return { ...example.devices[0]!, ...change }
}

/**
 * Answers operations 15, 16, 17, 19 and 20 by what `core` holds when the request arrives. A test
 * that wants another answer scripts it with `bed.fake.answer` / `answerOnce` after this call.
 */
export function installPairingCore(bed: LiveTestBed, initial: Partial<PairingCore> = {}): PairingCore {
  const core: PairingCore = { active: null, devices: [], nextCode: MARKER_CODE, issued: 0, issuer: SUPERVISOR_SESSION.operator.id, ...initial }
  const now = () => bed.fake.clock.now()
  const signedIn = () => bed.core.alive()
  const signedOut = (operationId: string): Reply => bed.fake.example(operationId, 401, 'notSignedIn')
  const live = (): ActiveCode | null => (core.active !== null && core.active.expiresAt > now() ? core.active : null)

  bed.fake.answer('getPairingCodeStatus', () => {
    if (!signedIn()) return signedOut('getPairingCodeStatus')
    const active = live()
    return {
      status: 200,
      body: {
        active:
          active === null
            ? null
            : { codeId: active.codeId, issuedBy: active.issuedBy, issuedAt: active.issuedAt, expiresAt: active.expiresAt, attemptsRemaining: active.attemptsRemaining },
      },
    }
  })
  bed.fake.answer('listPairedDevices', () => (signedIn() ? { status: 200, body: { devices: core.devices } } : signedOut('listPairedDevices')))
  bed.fake.answer('issuePairingCode', () => {
    if (!signedIn()) return signedOut('issuePairingCode')
    core.issued += 1
    const issuedAt = now()
    core.active = {
      codeId: `PCD-${String(100 + core.issued).padStart(6, '0')}`,
      code: core.nextCode,
      issuedBy: core.issuer,
      issuedAt,
      expiresAt: issuedAt + CODE_LIFETIME_MS,
      attemptsRemaining: 5,
    }
    return {
      status: 201,
      body: { codeId: core.active.codeId, code: core.active.code, qrPayload: `DEMS-PAIR:1:${core.active.code}`, issuedAt, expiresAt: core.active.expiresAt, attemptsAllowed: 5 },
    }
  })
  bed.fake.answer('cancelPairingCode', () => {
    if (!signedIn()) return signedOut('cancelPairingCode')
    core.active = null
    return { status: 204 }
  })
  bed.fake.answer('revokeDevice', (call) => {
    if (!signedIn()) return signedOut('revokeDevice')
    const id = call.params.id ?? ''
    const reason = String((call.body as { reason?: unknown } | undefined)?.reason ?? '').trim()
    const index = core.devices.findIndex((device) => device.id === id)
    if (index < 0) return bed.fake.example('revokeDevice', 404, 'notFound')
    const device = core.devices[index]!
    if (device.state !== 'PAIRED') return bed.fake.example('revokeDevice', 409, 'invalidState')
    if (reason.length < 5) return bed.fake.example('revokeDevice', 422, 'invalidReason')
    const revoked: PairedDevice = {
      ...device,
      state: 'REVOKED',
      online: false,
      signedInOperatorId: null,
      revokedAt: now(),
      revokedBy: core.issuer,
      revokeReason: reason,
    }
    core.devices = core.devices.map((entry) => (entry.id === id ? revoked : entry))
    return { status: 200, body: revoked }
  })
  return core
}

export interface OpenOptions {
  readonly session?: Session
  readonly core?: Partial<PairingCore>
  /** Scripts answers after the model, before the page loads. */
  readonly script?: (bed: LiveTestBed, core: PairingCore) => void
  readonly mount?: MountOptions
  /** Waits for this test ID after the page root (default `pd-issue-panel`); `null`: only the root. */
  readonly waitFor?: string | null
  readonly path?: string
}

let current: LiveTestBed | undefined

/** The bed of the running test, for `afterEach`. */
export function currentBed(): LiveTestBed | undefined {
  return current
}

export function disposeBed(): void {
  current?.dispose()
  current = undefined
}

/** The Paired Devices page in Live mode, signed in (the SUPERVISOR unless told otherwise). */
export async function openPairedDevices(options: OpenOptions = {}): Promise<PdBed> {
  const bed = createLiveTestBed({ session: options.session ?? SUPERVISOR_SESSION })
  current = bed
  const core = installPairingCore(bed, options.core)
  options.script?.(bed, core)
  const page = await bed.load()
  const mounted = await bed.mount(page, options.path ?? '/admin/devices', options.mount ?? {})
  await screen.findByTestId('page-paired-devices')
  const wait = options.waitFor === undefined ? 'pd-issue-panel' : options.waitFor
  if (wait !== null) await screen.findByTestId(wait)
  await bed.flush()
  return {
    bed,
    core,
    page,
    mounted,
    requests: (operationId) =>
      bed.fake.log.requestsOf(operationId).map((call) => ({ method: call.method, path: call.path, body: call.body, params: call.params })),
  }
}

/** Appends one row to the replica's audit ring, as the Core's delta does (`append` on `audit`). */
export async function appendAuditRow(bed: LiveTestBed, row: { type: keyof typeof AUDIT_TYPE_CATEGORY; details: Record<string, string | number | boolean | null>; deviceId?: string | null }) {
  const audit = bed.core.served.audit
  const seq = audit.total + 1
  const hash = seq.toString(16).padStart(64, 'a')
  const appended = {
    seq,
    id: `AUD-${String(seq).padStart(6, '0')}`,
    at: bed.fake.clock.now(),
    type: row.type,
    category: AUDIT_TYPE_CATEGORY[row.type],
    severity: row.details.reason === 'EXHAUSTED' ? 'WARNING' : 'INFO',
    actorId: null,
    message: 'A pairing code was closed.',
    sessionId: null,
    evidenceId: null,
    deviceId: row.deviceId ?? null,
    details: row.details,
    prevHash: audit.head,
    hash,
  }
  bed.core.served = { ...bed.core.served, audit: { ...audit, rows: [...audit.rows, appended as never], head: hash, total: seq } }
  await act(async () => {
    bed.fake.connection().delta([{ op: 'append', slice: 'audit', rows: [appended], head: hash, total: seq, dropped: audit.dropped }] as never)
  })
  await bed.flush()
}

const originalMatchMedia = typeof window === 'undefined' ? undefined : window.matchMedia
/** Empties the kit's toast queue, which is one per page and outlives a test (F76-9). */
export async function clearToasts(): Promise<void> {
  window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia
  toast.clear()
  window.matchMedia = originalMatchMedia as typeof window.matchMedia
  const queue = toast.getQueue() as { getExitingKeys?: () => ReadonlySet<string> }
  if ((queue.getExitingKeys?.().size ?? 0) > 0) await new Promise((resolve) => setTimeout(resolve, 350))
}

/** The text of every toast on screen (F76-9: toasts only, `[data-slot="toast"]`). */
export const toastTexts = (): string[] => Array.from(document.querySelectorAll('[data-slot="toast"]')).map((element) => element.textContent ?? '')
export const toastsWith = (text: string): string[] => toastTexts().filter((entry) => entry.includes(text))

/** Every value of both web storages (and the page load's own storage of the bed). */
export function webStorageText(bed: LiveTestBed): string {
  const values: string[] = []
  for (const storage of [window.localStorage, window.sessionStorage, bed.storage]) {
    if (storage === null) continue
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key === null) continue
      values.push(key, storage.getItem(key) ?? '')
    }
  }
  return values.join('\n')
}

/** Every URL the page knows: the router's location, the window's, and every URL the fake transport saw. */
export function urlText(bed: LiveTestBed, mounted: MountedPage): string {
  const location = mounted.router.state.location
  return [location.href, location.searchStr, location.hash, JSON.stringify(location.search), window.location.href, bed.location.assigned.join(' '), ...bed.fake.log.urls()].join('\n')
}

/** Every entry of the query cache and of the mutation cache, as JSON. */
export function cacheText(queryClient: QueryClient): string {
  const queries = queryClient.getQueryCache().getAll().map((query) => ({ key: query.queryKey, data: query.state.data, error: String(query.state.error) }))
  const mutations = queryClient.getMutationCache().getAll().map((mutation) => ({ key: mutation.options.mutationKey, data: mutation.state.data, variables: mutation.state.variables }))
  return JSON.stringify({ queries, mutations })
}

/** jsdom has neither media nor canvas nor Web Animations; the shell's pages touch them. */
export function installPageStubs(): () => void {
  const originalPlay = HTMLMediaElement.prototype.play
  const originalPause = HTMLMediaElement.prototype.pause
  const originalGetContext = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']
  HTMLMediaElement.prototype.play = (() => Promise.resolve()) as unknown as HTMLMediaElement['play']
  HTMLMediaElement.prototype.pause = (() => undefined) as unknown as HTMLMediaElement['pause']
  Element.prototype.getAnimations ??= function getAnimations() {
    return []
  }
  return () => {
    HTMLCanvasElement.prototype.getContext = originalGetContext
    HTMLMediaElement.prototype.play = originalPlay
    HTMLMediaElement.prototype.pause = originalPause
  }
}
