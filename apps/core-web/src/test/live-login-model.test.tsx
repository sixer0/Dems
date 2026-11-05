// Plan row W55: the Live rules of the Login page, without rendering (backend task
// 04_client_integration_spec §5.5, §5.6 WS-14, §6.4, §6.5, §8.1 LB-10, §8.2 A1), the words the
// specification gives, and the static rules of the folder. File extension .tsx because the
// core-web Vitest include is `src/**/*.test.tsx`.
//
// | Criterion | Where it is proven here |
// |-----------|-------------------------|
// | CLG (c), AC-C-53: no production file of the folder imports `useSimActions` or reads `.actions` of a `Sim` | "static rules of the folder" |
// | MD-6: the folder loads neither the typed client nor the Live source as a value | "static rules of the folder" |
// | SR-16: the folder never reads the cookie and writes nothing about a session to web storage | "static rules of the folder" |
// | AC-C-42, AC-C-104, WS-14, §6.4: the sentences are the specification's | "the words" |
// | DF-23 / D25 N3 / D29 Q6 (audit row 106): with `VITE_DEMS_PRODUCTION_LOCK=1` the Login offers no "Data mode" selector; unset, a dev build still does (the one render of this file) | "the production console lock" |
import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { expectScanCovers } from './static-scan'
import { ApiErrorCode } from '@dems/shared/api'
import { en } from '@dems/shared/i18n'
import { CORE_MODES, CoreRefusalError, LiveTransportError, LiveTransportReason } from '@dems/shared/live'
import { SimErrorCode, SimNotFoundError, SimPermissionError, SimTransitionError } from '@dems/shared/sim'
import {
  isCoreStarting,
  liveArrivalNoticeFor,
  readinessOf,
  signInFailureFacts,
  signInFailureFor,
  type LiveSessionEnd,
} from '@/features/login/login-live-model'
import { alertStatusFor, displayStateFor, isArrivalNotice, noticeFor, validateCredentials } from '@/features/login/login-model'
import { ModeSelector } from '@/features/login/mode-selector'
import { i18n } from '@/i18n'
import { describeCoreError } from '@/lib/core-errors'
import { resolveCoreMode } from '@/runtime/core-mode'

const end = (over: Partial<LiveSessionEnd>): LiveSessionEnd => ({
  kind: 'SESSION_ENDED',
  reason: 'SIGNED_OUT',
  source: 'CONTROL',
  signOut: null,
  wasSignedIn: true,
  sessionState: null,
  helloReason: null,
  principal: 'OPERATOR',
  at: 1_790_823_600_000,
  ...over,
})

const failureOf = (error: unknown) => signInFailureFor(error, describeCoreError(error))

describe('why the operator is on the page (§6.5; brief list row 16)', () => {
  it('nothing without an end, and nothing for an end while nobody was signed in', () => {
    expect(liveArrivalNoticeFor(null)).toBeNull()
    expect(liveArrivalNoticeFor(end({ wasSignedIn: false, reason: null, source: 'HELLO' }))).toBeNull()
    expect(liveArrivalNoticeFor(end({ wasSignedIn: false, reason: 'IDLE_EXPIRED' }))).toBeNull()
  })

  it('this console\'s own sign-out decides before the reason: LOCK is "Console locked", USER is "signed out", whatever the source', () => {
    for (const source of ['SIGN_OUT', 'LOCAL', 'CONTROL'] as const) {
      expect(liveArrivalNoticeFor(end({ signOut: 'LOCK', source }))).toBe('console-locked')
      expect(liveArrivalNoticeFor(end({ signOut: 'USER', source }))).toBe('signed-out')
    }
  })

  it('an expiry reads the same whether the Core said it, confirmed it, or could not be asked', () => {
    for (const source of ['CONTROL', 'REST', 'LOCAL'] as const) {
      expect(liveArrivalNoticeFor(end({ reason: 'IDLE_EXPIRED', source }))).toBe('expired')
      expect(liveArrivalNoticeFor(end({ reason: 'ABSOLUTE_EXPIRED', source }))).toBe('expired-absolute')
    }
  })

  it('a disabled account, a sign-out or another sign-in elsewhere, and the ends a web console shows nothing for', () => {
    expect(liveArrivalNoticeFor(end({ reason: 'USER_DISABLED' }))).toBe('disabled')
    expect(liveArrivalNoticeFor(end({ reason: 'SIGNED_OUT' }))).toBe('signed-out')
    expect(liveArrivalNoticeFor(end({ reason: 'ROTATED', source: 'REST' }))).toBe('signed-out')
    // An invalid cookie (no reason), a token reuse (never sent to a web session), a revoked device.
    expect(liveArrivalNoticeFor(end({ reason: null, source: 'CLOSE' }))).toBeNull()
    expect(liveArrivalNoticeFor(end({ reason: 'TOKEN_REUSE' }))).toBeNull()
    expect(liveArrivalNoticeFor(end({ kind: 'DEVICE_REVOKED', reason: 'REVOKED' }))).toBeNull()
  })

  it('the two new notices take their place in the one Alert: after the attempt, with their own tone', () => {
    const noLock = { locked: false, retryInSeconds: 0 }
    expect(noticeFor({ lockout: noLock, coreBlocked: false, lastAttempt: null, arrival: 'expired-absolute' })).toEqual({ kind: 'expired-absolute' })
    expect(noticeFor({ lockout: noLock, coreBlocked: false, lastAttempt: null, arrival: 'disabled' })).toEqual({ kind: 'disabled' })
    expect(alertStatusFor({ kind: 'expired-absolute' })).toBe('accent')
    expect(alertStatusFor({ kind: 'disabled' })).toBe('danger')
    expect(isArrivalNotice({ kind: 'expired-absolute' })).toBe(true)
    expect(isArrivalNotice({ kind: 'disabled' })).toBe(true)
    expect(isArrivalNotice({ kind: 'core-starting' })).toBe(false)
    expect(isArrivalNotice(null)).toBe(false)
    expect(displayStateFor({ success: false, pending: false, notice: { kind: 'disabled' }, fieldErrors: {} })).toBe('signed-out')
  })
})

describe('a sign-in that was rejected (§8.2 A1; LB-10)', () => {
  it('row 1: a stopped data source shows nothing', () => {
    expect(failureOf(new LiveTransportError(LiveTransportReason.CORE_OFFLINE, { code: 'STOPPED' }))).toEqual({ kind: 'stopped' })
  })

  it('row 2: a 429 is a limit whatever the transport reason says, never the offline Alert', () => {
    expect(failureOf(new LiveTransportError(LiveTransportReason.UNAVAILABLE, { status: 429, code: ApiErrorCode.RATE_LIMITED, retryAfterSeconds: 37 }))).toEqual({ kind: 'limit' })
    expect(failureOf(new LiveTransportError(LiveTransportReason.CORE_OFFLINE, { status: 429, retryAfterSeconds: 3 }))).toEqual({ kind: 'limit' })
    expect(failureOf(new LiveTransportError(LiveTransportReason.UNAVAILABLE, { status: 429 }))).toEqual({ kind: 'limit' })
  })

  it('rows 3 and 4: no answer, a time-out and a link that is down are the offline Alert; the Core\'s own 503 is its "starting" wording', () => {
    const offline = { kind: 'alert', outcome: { kind: 'core-offline' }, present: false, report: false }
    expect(failureOf(new LiveTransportError(LiveTransportReason.CORE_OFFLINE))).toEqual(offline)
    expect(failureOf(new LiveTransportError(LiveTransportReason.CORE_OFFLINE, { code: 'NETWORK' }))).toEqual(offline)
    expect(failureOf(new LiveTransportError(LiveTransportReason.CORE_OFFLINE, { code: 'TIMEOUT' }))).toEqual(offline)
    // A gateway's 503 (the dev proxy with the backend down) is an outage, not a start.
    expect(failureOf(new LiveTransportError(LiveTransportReason.CORE_OFFLINE, { status: 503 }))).toEqual(offline)
    expect(failureOf(new LiveTransportError(LiveTransportReason.CORE_OFFLINE, { status: 503, code: ApiErrorCode.NOT_READY }))).toEqual({
      kind: 'alert',
      outcome: { kind: 'core-starting' },
      present: false,
      report: false,
    })
  })

  it('rows 5 and 6: an accepted sign-in whose state did not arrive, a 500, an action that does not exist in Live mode are the presenter\'s toast', () => {
    expect(failureOf(new LiveTransportError(LiveTransportReason.CORE_OFFLINE, { code: 'SNAPSHOT_TIMEOUT' }))).toEqual({ kind: 'toast' })
    expect(failureOf(new LiveTransportError(LiveTransportReason.UNAVAILABLE, { status: 500, code: ApiErrorCode.INTERNAL_ERROR }))).toEqual({ kind: 'toast' })
    expect(failureOf(new LiveTransportError(LiveTransportReason.UNAVAILABLE, { code: 'CONTRACT_VIOLATION' }))).toEqual({ kind: 'toast' })
    expect(failureOf(new CoreRefusalError('NOT_AVAILABLE'))).toEqual({ kind: 'toast' })
  })

  it('row 7: ORIGIN_NOT_ALLOWED is "unexpected", and the presenter names the address and writes the record', () => {
    expect(failureOf(new CoreRefusalError(ApiErrorCode.ORIGIN_NOT_ALLOWED, { status: 403 }))).toEqual({
      kind: 'alert',
      outcome: { kind: 'unexpected' },
      present: true,
      report: false,
    })
  })

  it('row 8: a 422 is the server\'s refusal of the input; the form has no second rule set', () => {
    expect(failureOf(new SimTransitionError(null, 'signIn', undefined, SimErrorCode.INVALID_INPUT))).toEqual({
      kind: 'alert',
      outcome: { kind: 'input-rejected' },
      present: false,
      report: false,
    })
    // The form's own bounds are "required" only (decision F59): 200 characters pass it.
    expect(validateCredentials('u'.repeat(200), 'p'.repeat(200))).toEqual({})
    expect(displayStateFor({ success: false, pending: false, notice: { kind: 'input-rejected' }, fieldErrors: {} })).toBe('error')
    expect(alertStatusFor({ kind: 'input-rejected' })).toBe('danger')
  })

  it('row 9: everything else is "unexpected" with a record of the page; a "signed out" or "not permitted" answer is never silent here', () => {
    const unexpected = { kind: 'alert', outcome: { kind: 'unexpected' }, present: false, report: true }
    expect(failureOf(new CoreRefusalError(ApiErrorCode.DEVICE_NOT_PAIRED, { status: 403 }))).toEqual(unexpected)
    expect(failureOf(new CoreRefusalError(ApiErrorCode.INVALID_JSON, { status: 400 }))).toEqual(unexpected)
    expect(failureOf(new SimPermissionError('signIn', '', SimErrorCode.NOT_SIGNED_IN))).toEqual(unexpected)
    expect(failureOf(new SimPermissionError('signIn', 'SESSION_START'))).toEqual(unexpected)
    expect(failureOf(new SimTransitionError(null, 'signIn'))).toEqual(unexpected)
    expect(failureOf(new SimNotFoundError('session', 'SES-1'))).toEqual(unexpected)
    expect(failureOf(new Error('boom'))).toEqual(unexpected)
    expect(failureOf('a string')).toEqual(unexpected)
    expect(failureOf(undefined)).toEqual(unexpected)
  })

  it('the page\'s record names the class, the code and the status, and never the text of an error', () => {
    expect(signInFailureFacts(new CoreRefusalError(ApiErrorCode.DEVICE_NOT_PAIRED, { status: 403 }))).toEqual({ errorName: 'CoreRefusalError', code: 'DEVICE_NOT_PAIRED', status: 403 })
    const unknown = new Error('a text that could hold what was typed')
    expect(signInFailureFacts(unknown)).toEqual({ errorName: 'Error', code: null, status: null })
    expect(JSON.stringify(signInFailureFacts(unknown))).not.toContain('typed')
    expect(signInFailureFacts('text')).toEqual({ errorName: 'string', code: null, status: null })
    expect(signInFailureFacts(null)).toEqual({ errorName: 'object', code: null, status: null })
  })
})

describe('the health answer (WS-5; §3.5)', () => {
  it('a member of `ready` is ready, not ready, or unknown', () => {
    expect(readinessOf(true)).toBe('ready')
    expect(readinessOf(false)).toBe('not-ready')
    expect(readinessOf(undefined)).toBe('unknown')
  })

  it('"starting" needs an answer that says so: no answer and a service without `ready` are not a start', () => {
    expect(isCoreStarting(undefined)).toBe(false)
    expect(isCoreStarting({})).toBe(false)
    expect(isCoreStarting({ ready: { database: true, engine: true } })).toBe(false)
    expect(isCoreStarting({ ready: { database: false, engine: true } })).toBe(true)
    expect(isCoreStarting({ ready: { database: true, engine: false } })).toBe(true)
  })

  it('a starting Core takes the place of the offline Alert, and only while the gate is closed', () => {
    const noLock = { locked: false, retryInSeconds: 0 }
    expect(noticeFor({ lockout: noLock, coreBlocked: true, coreStarting: true, lastAttempt: null, arrival: null })).toEqual({ kind: 'core-starting' })
    expect(noticeFor({ lockout: noLock, coreBlocked: true, coreStarting: false, lastAttempt: null, arrival: null })).toEqual({ kind: 'core-offline' })
    expect(noticeFor({ lockout: noLock, coreBlocked: false, coreStarting: true, lastAttempt: null, arrival: null })).toBeNull()
    expect(noticeFor({ lockout: { locked: true, retryInSeconds: 9 }, coreBlocked: true, coreStarting: true, lastAttempt: null, arrival: null })).toEqual({ kind: 'locked', retryInSeconds: 9 })
    expect(displayStateFor({ success: false, pending: false, notice: { kind: 'core-starting' }, fieldErrors: {} })).toBe('offline')
  })
})

describe('the words (the sentences are the specification\'s)', () => {
  it('WS-7: the trust line and its tooltip; the line holds neither "simulated" nor "paired" (AC-C-42)', () => {
    expect(en.login.live.trustLine).toBe('Core server on this computer • web console, no pairing required')
    expect(en.login.live.trustTooltip).toBe('This console signs in to the Core server with a session cookie. Only mobile devices are paired; see Paired Devices.')
    expect(en.login.live.trustLine).not.toMatch(/simulated|paired/i)
    expect(en.common.coreLink.lostTitle).toBe('Core server unreachable')
  })

  it('WS-9 C1, WS-14, §6.4: the plain sentence, the 8-hour sentence, the disabled account', () => {
    expect(en.login.live.demoNotice).toBe('Published demo credentials for synthetic accounts on this local demo. They are not a secret.')
    expect(en.login.live.notices.absoluteExpired).toBe('Your session reached its 8-hour limit. Sign in again.')
    expect(en.login.live.notices.userDisabled).toBe('This account was disabled by an administrator.')
  })

  it('§3.2: no Live string of the Login page says "simulated"; the Simulated strings are as they were', () => {
    const texts: string[] = []
    const collect = (value: unknown): void => {
      if (typeof value === 'string') texts.push(value)
      else if (value !== null && typeof value === 'object') for (const entry of Object.values(value)) collect(entry)
    }
    collect(en.login.live)
    expect(texts.length).toBeGreaterThan(10)
    for (const text of texts) expect(text).not.toMatch(/simulat|mock/i)
    expect(en.login.trustLine).toBe('Console: {{deviceId}} • paired (simulated)')
    expect(en.login.trustLineUnpaired).toBe('Console: {{deviceId}} • not paired (simulated)')
    expect(en.login.securityKey.button).toBe('Use security key (simulated)')
  })
})

describe('static rules of the folder', () => {
  // `import.meta.dirname` (Node, through Vitest): jsdom replaces the global `URL`, so no file URL is built here.
  const folder = resolve(import.meta.dirname, '../features/login')
  const production = readdirSync(folder)
    .filter((name) => /\.tsx?$/.test(name))
    .map((name) => ({ name, text: readFileSync(join(folder, name), 'utf8') }))
  /** The code of a file without its comments: a rule is about what runs. */
  const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  it('reads the files it means to read', () => {
    // Rule R1 (`static-scan.ts`): the scan equals an independent listing of the folder and is not empty.
    // The login folder is flat apart from its tests: the block reads the files of the folder itself.
    expectScanCovers({ scanned: production.map((file) => file.name), listed: import.meta.glob('../features/login/*.{ts,tsx}'), root: '../features/login' })
  })

  it('AC-C-53, CLG (c): no file imports `useSimActions` or reads `.actions` of a `Sim`; the actions come from `useCoreActions()` and are consumed through `settle`', () => {
    // The i18n keys `common.actions.*` are words, not a read of a data source: they are left out.
    const withoutActionWords = (text: string) => code(text).replace(/common\.actions\.[A-Za-z]+/g, '')
    for (const { name, text } of production) {
      expect(text, name).not.toMatch(/useSimActions/)
      expect(withoutActionWords(text), name).not.toMatch(/\.actions\b/)
    }
    const controller = production.find((file) => file.name === 'use-login-controller.ts')?.text ?? ''
    expect(controller).toMatch(/useCoreActions\(\)/)
    // Each of the two sign-in actions is called in a `settle(...)` and nowhere else.
    expect(code(controller).match(/actions\.signIn\(/g)).toHaveLength(2)
    expect(code(controller).match(/settle\(\(\) => actions\.signIn\(/g)).toHaveLength(2)
    expect(code(controller).match(/actions\.signInWithSecurityKey\(/g)).toHaveLength(1)
    expect(code(controller).match(/settle\(\(\) => actions\.signInWithSecurityKey\(/g)).toHaveLength(1)
  })

  it('MD-6: no file loads the typed client or the Live source as a value, builds a client, or imports a test double', () => {
    for (const { name, text } of production) {
      const source = code(text)
      expect(source, name).not.toMatch(/from '@dems\/shared\/(client|live\/source|live\/testing)'/)
      expect(source, name).not.toMatch(/createCoreClient|createLiveSim|runtime\/(testing|live-start|boot)/)
    }
  })

  it('SR-16: no file reads the cookie, names a storage of the browser, or holds a token prefix', () => {
    for (const { name, text } of production) {
      const source = code(text)
      expect(source, name).not.toMatch(/document\.cookie|localStorage|sessionStorage|indexedDB/)
      expect(source, name).not.toMatch(/\b(ses|dvc|bio)_/)
      expect(source, name).not.toMatch(/dems\.auth|dems_session/)
    }
  })

  // Retargeted by decision D144(4) (findings CPW1-4 and CPW1-5): the function left this folder for
  // `runtime/presentation-follow.ts`, and the pin on the root route is a loose pattern — what holds
  // is that the root installs it exactly once and hands its clean-up back to React, not the exact
  // source text of another row's file.
  it('WS-10 (decisions D128, D144(4)): the follow-up is installed in ONE place, the root route, and is no Login behaviour at all', () => {
    const root = readFileSync(resolve(import.meta.dirname, '../routes/__root.tsx'), 'utf8')
    expect(code(root).match(/followServerPresentationMode\(live\)/g)).toHaveLength(1)
    // The effect returns what the function returns: its clean-up.
    expect(code(root)).toMatch(/useEffect\([\s\S]{0,120}?followServerPresentationMode\(live\)[\s\S]{0,80}?\[live\]\)/)
    // Nothing of it stays in the folder: neither a definition nor a call.
    for (const { name, text } of production) {
      expect(code(text).match(/\bfollowServerPresentationMode\b/g) ?? [], name).toHaveLength(0)
    }
    const follow = readFileSync(resolve(import.meta.dirname, '../runtime/presentation-follow.ts'), 'utf8')
    expect(follow).toMatch(/export function followServerPresentationMode\(live: Pick<WebLive, 'store'>\): \(\) => void/)
  })

  it('the security key is the simulator\'s: its test ID is rendered in one place, behind the mode', () => {
    const card = production.find((file) => file.name === 'auth-card.tsx')?.text ?? ''
    expect(card.match(/data-testid="login-security-key"/g)).toHaveLength(1)
    expect(card).toMatch(/\{isLive \? null : \(\s*<>\s*<div className="dems-login-divider"/)
  })
})

describe('the production console lock (audit row 106; DF-23, D25 N3, D29 Q6)', () => {
  afterEach(() => cleanup())

  /** The Login selector as the card renders it, fed by the resolution of a dev page load. */
  const selectorFor = (lock: string | undefined) => {
    const resolution = resolveCoreMode({ dev: true, packaged: false, stored: 'SIMULATED', env: 'live', lock })
    render(
      <I18nextProvider i18n={i18n}>
        <ModeSelector
          modeSwitch={{ selectable: resolution.selectable, mode: resolution.mode, switching: false, request: vi.fn(), dialog: null }}
          disabled={false}
        />
      </I18nextProvider>,
    )
    return resolution
  }

  it('set: the page load is LIVE and the Login shows no "Data mode: Simulated | Live" selector', () => {
    expect(selectorFor('1')).toMatchObject({ mode: 'LIVE', selectable: false })
    expect(screen.queryByTestId('login-mode-selector')).toBeNull()
    for (const mode of CORE_MODES) expect(screen.queryByTestId(`login-mode-${mode}`)).toBeNull()
  })

  it('unset: a dev page load keeps the selector with both modes', () => {
    expect(selectorFor(undefined)).toMatchObject({ mode: 'SIMULATED', selectable: true })
    expect(screen.getByTestId('login-mode-selector')).toHaveAttribute('data-mode', 'SIMULATED')
    for (const mode of CORE_MODES) expect(screen.getByTestId(`login-mode-${mode}`)).toBeInTheDocument()
  })
})
