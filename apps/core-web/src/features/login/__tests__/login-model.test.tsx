// Step 43: the Login view model (01_specs §14.8 state table; M-C-22; M-APP-01/02). Pure rules,
// tested without rendering. File extension .tsx because the core-web Vitest include is
// `src/**/*.test.tsx` (review 40 M7).
import { describe, expect, it } from 'vitest'
import { AuthStatus, SignOutReason, type SimEvent } from '@dems/shared/sim'
import {
  arrivalNoticeFor,
  coreAddress,
  coreLinkFor,
  countdownParts,
  displayStateFor,
  emblemSizeFor,
  fieldErrorFor,
  isCoreBlocked,
  isSubmitDisabled,
  lastAuthEvent,
  noticeFor,
  ringSizeFor,
  ringStateFor,
  splitAroundNumber,
  splitAroundToken,
  validateCredentials,
  withFieldError,
} from '../login-model'
import { buildLoginChoreography, HANDOFF } from '../login-choreography'
import { buildLoginLogEntry } from '../report'

const noLock = { locked: false, retryInSeconds: 0 }

function event(type: string, params: Record<string, string> = {}): SimEvent {
  return { id: type, seq: 1, at: 0, type: type as SimEvent['type'], severity: 'INFO', message: '', params, sessionId: null, deviceId: null }
}

describe('Core link (heartbeat → view)', () => {
  it('maps LIVE, STALE and OFFLINE, and keeps a reconnect cycle offline', () => {
    expect(coreLinkFor({ state: 'LIVE', reconnectAttempt: 0 })).toBe('online')
    expect(coreLinkFor({ state: 'STALE', reconnectAttempt: 0 })).toBe('stale')
    expect(coreLinkFor({ state: 'OFFLINE', reconnectAttempt: 1 })).toBe('offline')
    expect(coreLinkFor({ state: 'CONNECTING', reconnectAttempt: 0 })).toBe('connecting')
    expect(coreLinkFor({ state: 'CONNECTING', reconnectAttempt: 2 })).toBe('offline')
  })

  it('blocks sign-in only when offline, and names the Core address', () => {
    expect(isCoreBlocked('offline')).toBe(true)
    expect(isCoreBlocked('connecting')).toBe(false)
    expect(isCoreBlocked('stale')).toBe(false)
    expect(coreAddress()).toBe('127.0.0.1:4400')
  })
})

describe('ring and sizes', () => {
  it('lockout → ATTENTION, offline → CRITICAL, stale → ATTENTION, otherwise READY', () => {
    expect(ringStateFor({ locked: true, coreLink: 'offline' })).toBe('ATTENTION')
    expect(ringStateFor({ locked: false, coreLink: 'offline' })).toBe('CRITICAL')
    expect(ringStateFor({ locked: false, coreLink: 'stale' })).toBe('ATTENTION')
    expect(ringStateFor({ locked: false, coreLink: 'online' })).toBe('READY')
    expect(ringStateFor({ locked: false, coreLink: 'connecting' })).toBe('READY')
  })

  it('ring 320-360 at ≥ 1280 with the emblem at half (160-180 px, §14.8 / 04 §7)', () => {
    expect(ringSizeFor('wide', true)).toBe(340)
    expect(ringSizeFor('wide', false)).toBe(320)
    expect(ringSizeFor('split', true)).toBe(260)
    expect(emblemSizeFor(340)).toBe(170)
    expect(emblemSizeFor(320)).toBe(160)
  })
})

describe('form validation', () => {
  it('requires both fields; the username is trimmed, the password verbatim', () => {
    expect(validateCredentials('', '')).toEqual({ username: 'login.username.required', password: 'login.password.required' })
    expect(validateCredentials('   ', ' ')).toEqual({ username: 'login.username.required' })
    expect(validateCredentials('budi.santoso', 'x')).toEqual({})
    expect(fieldErrorFor('password', '')).toBe('login.password.required')
    expect(withFieldError({ username: 'login.username.required' }, 'username', undefined)).toEqual({})
  })
})

describe('arrival notice (M-APP-02; the last sign-out from the simulator)', () => {
  it('a fresh visit has none; an expiry says expired; a shell sign-out says signed out or locked', () => {
    expect(arrivalNoticeFor({ authStatus: AuthStatus.SIGNED_OUT, previousTopLevel: undefined, lastEvent: null })).toBeNull()
    expect(arrivalNoticeFor({ authStatus: AuthStatus.EXPIRED, previousTopLevel: undefined, lastEvent: null })).toBe('expired')
    expect(
      arrivalNoticeFor({ authStatus: AuthStatus.SIGNED_OUT, previousTopLevel: '/_app', lastEvent: event('AUTH_LOGOUT', { reason: SignOutReason.USER }) }),
    ).toBe('signed-out')
    expect(
      arrivalNoticeFor({ authStatus: AuthStatus.SIGNED_OUT, previousTopLevel: '/_app', lastEvent: event('AUTH_LOGOUT', { reason: SignOutReason.LOCK }) }),
    ).toBe('console-locked')
    expect(arrivalNoticeFor({ authStatus: AuthStatus.SIGNED_OUT, previousTopLevel: '/_app', lastEvent: event('AUTH_EXPIRED') })).toBe('expired')
  })

  it('finds the newest auth event in an oldest-first ring', () => {
    const events = [event('AUTH_LOGIN'), event('SESSION_CREATED'), event('AUTH_LOGOUT'), event('HEALTH_CHECK')]
    expect(lastAuthEvent(events)?.type).toBe('AUTH_LOGOUT')
    expect(lastAuthEvent([event('HEALTH_CHECK')])).toBeNull()
  })
})

describe('the one Alert and the §14.8 state name', () => {
  it('orders notices: locked, core offline, the last attempt, then the arrival notice', () => {
    const invalid = { kind: 'invalid', attemptsRemaining: 3 } as const
    expect(noticeFor({ lockout: { locked: true, retryInSeconds: 42 }, coreBlocked: true, lastAttempt: invalid, arrival: 'signed-out' })).toEqual({
      kind: 'locked',
      retryInSeconds: 42,
    })
    expect(noticeFor({ lockout: noLock, coreBlocked: true, lastAttempt: invalid, arrival: 'signed-out' })).toEqual({ kind: 'core-offline' })
    expect(noticeFor({ lockout: noLock, coreBlocked: false, lastAttempt: invalid, arrival: 'signed-out' })).toEqual(invalid)
    expect(noticeFor({ lockout: noLock, coreBlocked: false, lastAttempt: null, arrival: 'expired' })).toEqual({ kind: 'expired' })
    expect(noticeFor({ lockout: noLock, coreBlocked: false, lastAttempt: null, arrival: null })).toBeNull()
  })

  it('names all 8 states', () => {
    const none = {}
    expect(displayStateFor({ success: false, pending: false, notice: null, fieldErrors: none })).toBe('idle')
    expect(displayStateFor({ success: false, pending: false, notice: null, fieldErrors: { username: 'login.username.required' } })).toBe('validating')
    expect(displayStateFor({ success: false, pending: true, notice: null, fieldErrors: none })).toBe('submitting')
    expect(displayStateFor({ success: false, pending: false, notice: { kind: 'invalid', attemptsRemaining: 4 }, fieldErrors: none })).toBe('error')
    expect(displayStateFor({ success: false, pending: false, notice: { kind: 'locked', retryInSeconds: 60 }, fieldErrors: none })).toBe('locked')
    expect(displayStateFor({ success: false, pending: false, notice: { kind: 'core-offline' }, fieldErrors: none })).toBe('offline')
    expect(displayStateFor({ success: false, pending: false, notice: { kind: 'signed-out' }, fieldErrors: none })).toBe('signed-out')
    expect(displayStateFor({ success: true, pending: false, notice: null, fieldErrors: none })).toBe('success')
  })

  it('disables Sign In while locked, pending, succeeding or Core offline', () => {
    const base = { locked: false, pending: false, success: false, coreBlocked: false }
    expect(isSubmitDisabled(base)).toBe(false)
    expect(isSubmitDisabled({ ...base, locked: true })).toBe(true)
    expect(isSubmitDisabled({ ...base, pending: true })).toBe(true)
    expect(isSubmitDisabled({ ...base, success: true })).toBe(true)
    expect(isSubmitDisabled({ ...base, coreBlocked: true })).toBe(true)
  })
})

describe('text helpers', () => {
  it('formats the countdown as mm:ss and splits sentences around live values', () => {
    expect(countdownParts(60).text).toBe('01:00')
    expect(countdownParts(59.2).text).toBe('01:00')
    expect(countdownParts(9).text).toBe('00:09')
    expect(countdownParts(-3).text).toBe('00:00')
    expect(splitAroundToken((token) => `Try again in ${token}.`)).toEqual({ before: 'Try again in ', after: '.' })
    expect(splitAroundNumber('3 attempts remaining', 3)).toEqual({ before: '', after: ' attempts remaining' })
  })
})

describe('choreography (M-PG-LOGIN, M-APP-01, §8)', () => {
  it('cold entrance follows the spec beats; the hand-off commits at 450 ms', () => {
    const cold = buildLoginChoreography('cold', false)
    expect(cold.ringDelayMs).toBe(200)
    expect(cold.emblemDraw).toEqual({ startMs: 500, shieldMs: 500, arcStaggerMs: 70, arcMs: 240 })
    expect([cold.overlineMs, cold.stripMs, cold.cardMs]).toEqual([900, 1100, 1200])
    expect(HANDOFF.cardDelayMs + HANDOFF.cardMs).toBe(HANDOFF.navigateAtMs)
    // Everything but the emblem has left before the commit (DR-43-3).
    expect(HANDOFF.fadeDelayMs + HANDOFF.fadeMs).toBeLessThanOrEqual(HANDOFF.navigateAtMs)
    expect(HANDOFF.checkFadeAtMs + HANDOFF.checkFadeMs).toBeLessThanOrEqual(HANDOFF.navigateAtMs)
  })

  it('a return arrival flies the emblem (no draw); reduced motion has no draw, no stagger, no delays', () => {
    const back = buildLoginChoreography('return', false)
    expect(back.emblemDraw).toBeNull()
    expect(back.noticeMs).toBeGreaterThan(back.cardMs)
    const reduced = buildLoginChoreography('cold', true)
    expect(reduced.emblemDraw).toBeNull()
    expect(reduced.bloomAtMs).toBeNull()
    expect(Math.max(reduced.cardMs, reduced.stripMs, reduced.overlineMs, reduced.pillarGapMs)).toBe(0)
  })
})

describe('structured log entries', () => {
  it('carry the required fields and only the context they are given', () => {
    const entry = buildLoginLogEntry('error', 'login.signIn', new Error('boom'), { method: 'password' }, 'login-x-1')
    expect(entry).toMatchObject({ level: 'error', source: 'login.signIn', message: 'boom', context: { method: 'password' }, correlationId: 'login-x-1' })
    expect(typeof entry.timestamp).toBe('string')
    expect(entry.stack).toContain('boom')
  })
})
