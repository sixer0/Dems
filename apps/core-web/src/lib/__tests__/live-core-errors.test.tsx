// Plan row W50: the refusal presenter (backend task 04_client_integration_spec §6.2; §8.1 LB-5,
// LB-6, LB-7, LB-10; §2.5 CL-20, CL-21; brief list row 20 of implementation/44_live_source.md
// §17.4; finding F69).
//
// The errors are the REAL ones: what the Live source's own `rebuildRefusal` builds from a failed
// answer of the typed client, and what the typed client returns to a page. The translations are
// the app's own (`@/i18n`), so a missing key fails a test.
import { renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from '@heroui/react'
import type { CoreCallFailure } from '@dems/shared/client'
import { CoreRefusalError, LiveTransportError } from '@dems/shared/live'
import { rebuildRefusal } from '@dems/shared/live/source'
import { SimNotFoundError, SimPermissionError, SimTransitionError } from '@dems/shared/sim'
import { getMissingI18nKeys, i18n, resetMissingI18nKeys } from '@/i18n'
import { createErrorSink } from '@/runtime/error-sink'
import {
  CoreErrorNoticeKind,
  describeCoreError,
  LIVE_OFFLINE_TOAST_COALESCE_MS,
  presentCoreError,
  requiredRoleForPermission,
  resetCoreErrorPresenter,
  useCoreErrorPresenter,
  type CoreErrorPresenterDeps,
} from '../core-errors'

const t = i18n.t.bind(i18n) as CoreErrorPresenterDeps['t']

interface Shown {
  tone: 'danger' | 'warning'
  title: string
  description: string | undefined
}

function presenter(start = 1_000_000) {
  const shown: Shown[] = []
  let now = start
  const sink = createErrorSink({ dev: false })
  const deps: CoreErrorPresenterDeps = {
    t,
    now: () => now,
    sink,
    // A page under another host than the one the Core server accepts: the address to open differs from the page's own.
    location: { port: '5178', origin: 'http://localhost:5178' },
    toast: {
      danger: (title, options) => shown.push({ tone: 'danger', title, description: options?.description }),
      warning: (title, options) => shown.push({ tone: 'warning', title, description: options?.description }),
    },
  }
  return {
    shown,
    sink,
    present: (input: unknown, options?: Parameters<typeof presentCoreError>[2]) => presentCoreError(input, deps, options),
    advance: (ms: number) => {
      now += ms
    },
  }
}

/** A failed answer of the typed client, as `createCoreClient` returns it. */
function failure(partial: Partial<CoreCallFailure> & { code: string; details?: Record<string, unknown> }): CoreCallFailure {
  return {
    ok: false,
    operationId: 'archiveEvidence',
    kind: 'FORBIDDEN',
    status: 403,
    error: { code: partial.code, message: 'A message of the server that the UI never shows.', ...(partial.details ? { details: partial.details } : {}) },
    retryAfterSeconds: null,
    transport: null,
    requestId: 'req-test',
    ...partial,
  } as CoreCallFailure
}

/** What a void Live action rejects with for that answer: the Live source's own function. */
const rejected = (answer: CoreCallFailure, operationId = 'archiveEvidence'): Error =>
  rebuildRefusal(answer, { action: operationId, operationId, entity: null, sessionState: 'ARMED' })

const OFFLINE = 'Core server unreachable. Nothing was changed.'

beforeEach(() => {
  resetCoreErrorPresenter()
  resetMissingI18nKeys()
})

afterEach(() => {
  expect(getMissingI18nKeys()).toEqual([])
  vi.restoreAllMocks()
})

describe('LB-10: a limit is not an outage', () => {
  it('a 429 shows ONE warning toast with the seconds of `retry-after`, and no "unreachable" sentence', () => {
    const { present, shown } = presenter()
    const error = rejected(failure({ code: 'RATE_LIMITED', status: 429, kind: 'RATE_LIMITED', transport: 'UNAVAILABLE', retryAfterSeconds: 42 }))
    expect(error).toBeInstanceOf(LiveTransportError)
    expect(present(error)).toEqual({ kind: 'LIMIT', seconds: 42 })
    expect(shown).toEqual([
      { tone: 'warning', title: 'The Core server is limiting requests from this console. Try again in 42 s.', description: undefined },
    ])
    expect(shown[0]?.title).not.toMatch(/unreachable|nothing was changed|offline/i)
  })

  it('a burst of 429s (twenty selected rows) shows one toast, and each is still presented', () => {
    const { present, shown } = presenter()
    for (let row = 0; row < 20; row += 1) {
      expect(present(new LiveTransportError('UNAVAILABLE', { status: 429, code: 'RATE_LIMITED', retryAfterSeconds: 30 }))?.kind).toBe('LIMIT')
    }
    expect(shown).toHaveLength(1)
  })

  it('a 429 without `retry-after` names no number', () => {
    const { present, shown } = presenter()
    expect(present(new LiveTransportError('UNAVAILABLE', { status: 429, code: 'RATE_LIMITED' }))).toEqual({ kind: 'LIMIT', seconds: null })
    expect(shown[0]).toMatchObject({ tone: 'warning', title: 'The Core server is limiting requests from this console. Try again shortly.' })
  })

  it('a 429 is a limit whichever way it arrives: the failed answer of a page\'s own call, and a reason of CORE_OFFLINE beside the status', () => {
    const { present, shown } = presenter()
    const answer = failure({ code: 'RATE_LIMITED', status: 429, kind: 'RATE_LIMITED', transport: 'UNAVAILABLE', retryAfterSeconds: 7 })
    expect(present(answer)).toEqual({ kind: 'LIMIT', seconds: 7 })
    // Decided by the status before the reason is looked at.
    expect(describeCoreError(new LiveTransportError('CORE_OFFLINE', { status: 429, retryAfterSeconds: 3 }))).toEqual({ kind: 'LIMIT', seconds: 3 })
    // And by the envelope code alone, when the status did not travel.
    expect(describeCoreError(new LiveTransportError('UNAVAILABLE', { code: 'RATE_LIMITED', retryAfterSeconds: 4 }))).toEqual({ kind: 'LIMIT', seconds: 4 })
    expect(shown).toHaveLength(1)
    expect(shown[0]?.tone).toBe('warning')
  })

  it('a limit does not use the gate of the outage toast, and the outage does not use the limit\'s', () => {
    const { present, shown } = presenter()
    present(new LiveTransportError('CORE_OFFLINE'))
    present(new LiveTransportError('UNAVAILABLE', { status: 429, code: 'RATE_LIMITED', retryAfterSeconds: 5 }))
    expect(shown.map((toast) => toast.tone)).toEqual(['danger', 'warning'])
  })
})

describe('LB-6, LB-7: no usable answer', () => {
  it('the link is down (no request was sent): "Core server unreachable. Nothing was changed."', () => {
    const { present, shown } = presenter()
    expect(present(new LiveTransportError('CORE_OFFLINE'))).toEqual({ kind: 'OFFLINE' })
    expect(shown).toEqual([{ tone: 'danger', title: OFFLINE, description: undefined }])
  })

  it('AC-C-59 (the presenter\'s half): five presses show one toast; after 3 s the next one shows again', () => {
    const { present, shown, advance } = presenter()
    for (let press = 0; press < 5; press += 1) {
      expect(present(new LiveTransportError('CORE_OFFLINE'))).toEqual({ kind: 'OFFLINE' })
      advance(100)
    }
    expect(shown).toHaveLength(1)
    advance(LIVE_OFFLINE_TOAST_COALESCE_MS - 500 - 1)
    present(new LiveTransportError('CORE_OFFLINE'))
    expect(shown).toHaveLength(1)
    advance(1)
    present(new LiveTransportError('CORE_OFFLINE'))
    expect(shown).toHaveLength(2)
    expect(LIVE_OFFLINE_TOAST_COALESCE_MS).toBe(3_000)
  })

  it('a network failure of a real answer reads the same', () => {
    const { present, shown } = presenter()
    const error = rejected(failure({ code: 'NETWORK', status: null, kind: 'NETWORK', transport: 'CORE_OFFLINE' }))
    expect(present(error)).toEqual({ kind: 'OFFLINE' })
    expect(shown[0]?.title).toBe(OFFLINE)
  })

  it('a 503 `NOT_READY`: "The Core server is starting", in the place of the outage toast (one gate)', () => {
    const { present, shown } = presenter()
    const error = rejected(failure({ code: 'NOT_READY', status: 503, kind: 'NOT_READY', transport: 'CORE_OFFLINE' }))
    expect(present(error)).toEqual({ kind: 'STARTING' })
    expect(shown).toEqual([{ tone: 'danger', title: 'The Core server is starting. Nothing was changed.', description: undefined }])
    present(new LiveTransportError('CORE_OFFLINE'))
    expect(shown).toHaveLength(1)
  })

  it('FXR-W W92-13: after an accepted command (an export\'s paged walk) the outage and starting sentences drop "Nothing was changed"', () => {
    const offline = presenter()
    expect(offline.present(new LiveTransportError('CORE_OFFLINE'), { afterAcceptedCommand: true })).toEqual({ kind: 'OFFLINE' })
    expect(offline.shown).toEqual([{ tone: 'danger', title: 'Core server unreachable.', description: undefined }])
    resetCoreErrorPresenter() // one coalescing gate for both kinds; each case starts with it open
    const starting = presenter()
    const error = rejected(failure({ code: 'NOT_READY', status: 503, kind: 'NOT_READY', transport: 'CORE_OFFLINE' }))
    expect(starting.present(error, { afterAcceptedCommand: true })).toEqual({ kind: 'STARTING' })
    expect(starting.shown).toEqual([{ tone: 'danger', title: 'The Core server is starting.', description: undefined }])
    // Without the flag the sentences are unchanged.
    resetCoreErrorPresenter()
    const plain = presenter()
    plain.present(new LiveTransportError('CORE_OFFLINE'))
    expect(plain.shown[0]?.title).toBe('Core server unreachable. Nothing was changed.')
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('a 503 of the dev proxy with the backend down is an outage, not a start (WT-4: no envelope of the Core)', () => {
    const { present, shown } = presenter()
    const error = rejected(failure({ code: 'CONTRACT_VIOLATION', status: 503, kind: 'CONTRACT_VIOLATION', transport: 'CORE_OFFLINE' }))
    expect(present(error)).toEqual({ kind: 'OFFLINE' })
    expect(shown[0]?.title).toBe(OFFLINE)
  })

  it('LB-7: a time-out says that the command may or may not have been applied, and never "nothing was changed"', () => {
    const { present, shown } = presenter()
    const error = rejected(failure({ code: 'TIMEOUT', status: null, kind: 'TIMEOUT', transport: 'CORE_OFFLINE' }))
    expect(present(error)).toEqual({ kind: 'TIMED_OUT' })
    expect(shown[0]).toMatchObject({ tone: 'danger' })
    expect(shown[0]?.title).toContain('The command may or may not have been applied; the screen updates when the Core is reachable.')
    expect(shown[0]?.title).not.toContain('Nothing was changed')
  })

  it('a 500 and an answer outside the contract: the Core could not complete the request', () => {
    const { present, shown, advance } = presenter()
    expect(present(rejected(failure({ code: 'INTERNAL_ERROR', status: 500, kind: 'SERVER', transport: 'UNAVAILABLE' })))).toEqual({ kind: 'UNAVAILABLE' })
    advance(LIVE_OFFLINE_TOAST_COALESCE_MS)
    expect(present(rejected(failure({ code: 'CONTRACT_VIOLATION', status: 200, kind: 'CONTRACT_VIOLATION', transport: 'UNAVAILABLE' })))).toEqual({ kind: 'UNAVAILABLE' })
    expect(shown.map((toast) => toast.title)).toEqual([
      'The Core server could not complete the request. Try again.',
      'The Core server could not complete the request. Try again.',
    ])
  })
})

describe('brief list row 20: the codes of the client and of the Live source', () => {
  it('CREDENTIALS_UNAVAILABLE and CREDENTIALS_TIMEOUT: nothing was sent', () => {
    for (const code of ['CREDENTIALS_UNAVAILABLE', 'CREDENTIALS_TIMEOUT']) {
      // The coalescing state is the page's (one per module), not the presenter object's.
      resetCoreErrorPresenter()
      const { present, shown } = presenter()
      expect(present(new LiveTransportError('CORE_OFFLINE', { code })), code).toEqual({ kind: 'NOT_SENT' })
      expect(shown[0]?.title).toBe('The request was not sent: the stored credentials could not be read. Nothing was changed.')
    }
  })

  it('SNAPSHOT_TIMEOUT: the sign-in was accepted and the state has not arrived (no "unreachable", no "nothing was changed")', () => {
    const { present, shown } = presenter()
    expect(present(new LiveTransportError('CORE_OFFLINE', { code: 'SNAPSHOT_TIMEOUT' }))).toEqual({ kind: 'SNAPSHOT_TIMEOUT' })
    expect(shown).toHaveLength(1)
    expect(shown[0]?.tone).toBe('warning')
    expect(shown[0]?.title).toContain('The sign-in was accepted')
    expect(shown[0]?.title).not.toContain('Nothing was changed')
  })

  it('STOPPED: the screen is gone, nothing is shown, and the error still counts as presented', () => {
    const { present, shown } = presenter()
    expect(present(new LiveTransportError('CORE_OFFLINE', { code: 'STOPPED' }))).toEqual({ kind: 'STOPPED' })
    expect(shown).toEqual([])
  })

  it('NOT_AVAILABLE: the action does not exist in Live mode', () => {
    const { present, shown } = presenter()
    expect(present(new CoreRefusalError('NOT_AVAILABLE'))).toEqual({ kind: 'NOT_AVAILABLE' })
    expect(shown).toEqual([{ tone: 'warning', title: 'This action is not available in Live mode.', description: undefined }])
  })
})

describe('§6.2: a refused call names the role, with the existing words', () => {
  it('403 NOT_PERMITTED as the Live source rebuilds it: "Not permitted", "Requires the Supervisor role"', () => {
    const { present, shown } = presenter()
    const error = rejected(failure({ code: 'NOT_PERMITTED', details: { permission: 'EVIDENCE_EXPORT' } }))
    expect(error).toBeInstanceOf(SimPermissionError)
    expect(present(error)).toEqual({ kind: 'PERMISSION', role: 'SUPERVISOR', permission: 'EVIDENCE_EXPORT' })
    expect(shown).toEqual([{ tone: 'danger', title: 'Not permitted', description: 'Requires the Supervisor role' }])
  })

  it('the simulator\'s own error reads the same (Simulated mode)', () => {
    const { present, shown } = presenter()
    expect(present(new SimPermissionError('setStoragePolicy', 'MAINTENANCE'))).toMatchObject({ kind: 'PERMISSION', role: 'TECHNICIAN' })
    expect(shown).toEqual([{ tone: 'danger', title: 'Not permitted', description: 'Requires the Technician role' }])
  })

  it('each press shows its toast: a refusal is not coalesced', () => {
    const { present, shown } = presenter()
    present(new SimPermissionError('archiveEvidence', 'EVIDENCE_EXPORT'))
    present(new SimPermissionError('archiveEvidence', 'EVIDENCE_EXPORT'))
    expect(shown).toHaveLength(2)
  })

  it('the role is the first, least privileged first, that holds the permission; a label of several permissions is enough with one', () => {
    expect(requiredRoleForPermission('SESSION_START')).toBe('INVESTIGATOR')
    expect(requiredRoleForPermission('EVIDENCE_EXPORT')).toBe('SUPERVISOR')
    expect(requiredRoleForPermission('USER_ADMIN')).toBe('SUPERVISOR')
    expect(requiredRoleForPermission('PAIRING_MANAGE')).toBe('SUPERVISOR')
    expect(requiredRoleForPermission('MAINTENANCE')).toBe('TECHNICIAN')
    expect(requiredRoleForPermission('USER_ADMIN | PAIRING_MANAGE')).toBe('SUPERVISOR')
    expect(requiredRoleForPermission('MAINTENANCE | SESSION_START')).toBe('INVESTIGATOR')
    expect(requiredRoleForPermission('')).toBeNull()
    expect(requiredRoleForPermission('NO_SUCH_PERMISSION')).toBeNull()
  })

  it('no role known: the title alone, and never "Requires the  role"', () => {
    const { present, shown } = presenter()
    expect(present(new SimPermissionError('someAction', ''))).toEqual({ kind: 'PERMISSION', role: null, permission: '' })
    expect(shown).toEqual([{ tone: 'danger', title: 'Not permitted', description: undefined }])
  })

  it('a page\'s own call: the permission of the envelope, else the one the page names', () => {
    const { present, shown } = presenter()
    expect(present(failure({ operationId: 'assignUserRole', code: 'NOT_PERMITTED', details: { permission: 'USER_ADMIN' } }))).toMatchObject({
      kind: 'PERMISSION',
      role: 'SUPERVISOR',
    })
    expect(present(failure({ operationId: 'issuePairingCode', code: 'FORBIDDEN' }), { permission: 'PAIRING_MANAGE' })).toMatchObject({
      kind: 'PERMISSION',
      role: 'SUPERVISOR',
      permission: 'PAIRING_MANAGE',
    })
    expect(shown.map((toast) => toast.description)).toEqual(['Requires the Supervisor role', 'Requires the Supervisor role'])
  })

  it('401 NOT_SIGNED_IN: nothing is shown here; the session is over and the shell shows the login screen', () => {
    const { present, shown } = presenter()
    expect(present(rejected(failure({ code: 'NOT_SIGNED_IN', status: 401, kind: 'UNAUTHENTICATED' })))).toEqual({ kind: 'SIGNED_OUT' })
    expect(present(failure({ code: 'NOT_SIGNED_IN', status: 401, kind: 'UNAUTHENTICATED' }))).toEqual({ kind: 'SIGNED_OUT' })
    expect(shown).toEqual([])
  })
})

describe('refusals with a code of their own', () => {
  it('DEMO_DISABLED: a warning', () => {
    const { present, shown } = presenter()
    const error = rejected(failure({ code: 'DEMO_DISABLED' }), 'resetDemo')
    expect(error).toBeInstanceOf(CoreRefusalError)
    expect(present(error)).toEqual({ kind: 'DEMO_DISABLED' })
    expect(shown).toEqual([{ tone: 'warning', title: 'Demo controls are disabled on this Core server.', description: undefined }])
  })

  it('ORIGIN_NOT_ALLOWED (WT-2a, A1): the toast and the console record name the address to open', () => {
    const { present, shown, sink } = presenter()
    const error = rejected(failure({ code: 'ORIGIN_NOT_ALLOWED' }), 'signIn')
    expect(present(error)).toEqual({ kind: 'ORIGIN_NOT_ALLOWED' })
    expect(shown).toEqual([
      { tone: 'danger', title: 'The Core server does not accept requests from this address. Open the console at http://127.0.0.1:5178.', description: undefined },
    ])
    const records = sink.records()
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      level: 'error',
      source: 'core-errors.originNotAllowed',
      context: { current: 'http://localhost:5178', expected: 'http://127.0.0.1:5178' },
    })
    expect(records[0]?.message).toContain('The page is open at http://localhost:5178')
    expect(records[0]?.message).toContain('ORIGIN_NOT_ALLOWED')
    expect(records[0]?.message).toContain('Open the console at http://127.0.0.1:5178')
  })
})

describe('what is NOT the presenter\'s: the page words it', () => {
  it('F69: a blocked pre-check is a refusal of the session, never an outage of the Core server', () => {
    const { present, shown } = presenter()
    const blocked = rejected(failure({ code: 'PRECHECK_BLOCKED', status: 409, kind: 'CONFLICT' }), 'startRecording')
    expect(blocked).toBeInstanceOf(SimTransitionError)
    expect(present(blocked)).toBeNull()
    expect(describeCoreError(blocked)).toBeNull()
    expect(shown).toEqual([])
  })

  it('a transition the Core refuses, an entity it does not hold, a page\'s own refusal code, and anything unknown', () => {
    const { present, shown } = presenter()
    for (const input of [
      new SimTransitionError('RECORDING', 'restartServices', undefined, 'SESSION_ACTIVE'),
      new SimNotFoundError('evidence', 'EV-20260930-0004'),
      new CoreRefusalError('LAST_ADMIN', { status: 409 }),
      new CoreRefusalError('INVALID_CODE', { status: 401 }),
      failure({ code: 'LAST_ADMIN', status: 409, kind: 'CONFLICT' }),
      // A permission code on another status than 403 is not the refusal of §6.2.
      failure({ code: 'NOT_PERMITTED', status: 409, kind: 'CONFLICT' }),
      failure({ code: 'INVALID_REASON', status: 422, kind: 'INVALID' }),
      new Error('boom'),
      'a string',
      null,
      undefined,
      { ok: true },
      { ok: false },
      // An answer that is no failure is never presented, whatever else it carries.
      { ok: true, status: 403, error: { code: 'NOT_PERMITTED', message: '' }, transport: null, retryAfterSeconds: null },
      { ok: true, status: null, error: { code: 'NETWORK', message: '' }, transport: 'CORE_OFFLINE', retryAfterSeconds: null },
    ]) {
      expect(present(input), String(input)).toBeNull()
    }
    expect(shown).toEqual([])
  })
})

describe('the notice kinds', () => {
  it('are the thirteen of the module\'s table', () => {
    expect(Object.keys(CoreErrorNoticeKind).sort()).toEqual(
      [
        'DEMO_DISABLED',
        'LIMIT',
        'NOT_AVAILABLE',
        'NOT_SENT',
        'OFFLINE',
        'ORIGIN_NOT_ALLOWED',
        'PERMISSION',
        'SIGNED_OUT',
        'SNAPSHOT_TIMEOUT',
        'STARTING',
        'STOPPED',
        'TIMED_OUT',
        'UNAVAILABLE',
      ].sort(),
    )
  })

  it('no toast shows a machine code or the server\'s own message', () => {
    const { present, shown, advance } = presenter()
    const inputs = [
      new LiveTransportError('CORE_OFFLINE'),
      new LiveTransportError('CORE_OFFLINE', { code: 'TIMEOUT' }),
      new LiveTransportError('UNAVAILABLE', { status: 500, code: 'INTERNAL_ERROR' }),
      new LiveTransportError('UNAVAILABLE', { status: 429, code: 'RATE_LIMITED', retryAfterSeconds: 9 }),
      new SimPermissionError('archiveEvidence', 'EVIDENCE_EXPORT'),
      failure({ code: 'NOT_PERMITTED', details: { permission: 'USER_ADMIN' } }),
    ]
    for (const input of inputs) {
      present(input)
      advance(LIVE_OFFLINE_TOAST_COALESCE_MS)
    }
    expect(shown).toHaveLength(inputs.length)
    for (const { title, description } of shown) {
      expect(`${title} ${description ?? ''}`).not.toMatch(/CORE_OFFLINE|UNAVAILABLE|RATE_LIMITED|NOT_PERMITTED|INTERNAL_ERROR|A message of the server/)
    }
  })
})

describe('useCoreErrorPresenter: the presenter of a page', () => {
  const wrapper = ({ children }: { children: ReactNode }) => createElement(I18nextProvider, { i18n }, children)

  it('shows through the kit\'s toast with the page\'s translations, and returns a stable function', () => {
    const danger = vi.spyOn(toast, 'danger').mockImplementation(() => '')
    const warning = vi.spyOn(toast, 'warning').mockImplementation(() => '')
    const hook = renderHook(() => useCoreErrorPresenter(), { wrapper })
    const present = hook.result.current
    expect(present(new SimPermissionError('archiveEvidence', 'EVIDENCE_EXPORT'))).toMatchObject({ kind: 'PERMISSION' })
    expect(danger.mock.calls).toEqual([['Not permitted', { description: 'Requires the Supervisor role' }]])
    expect(present(new LiveTransportError('UNAVAILABLE', { status: 429, code: 'RATE_LIMITED', retryAfterSeconds: 12 }))).toEqual({ kind: 'LIMIT', seconds: 12 })
    expect(warning.mock.calls).toEqual([['The Core server is limiting requests from this console. Try again in 12 s.']])
    expect(present(new Error('boom'))).toBeNull()
    hook.rerender()
    expect(hook.result.current).toBe(present)
  })
})
