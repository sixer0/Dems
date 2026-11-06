// Plan row W81: the pure rules of the Paired Devices page (`model.ts`), one by one.
import { describe, expect, it } from 'vitest'
import type { ActivePairingCode, PairedDevice } from '@dems/shared/api'
import type { AuditRow } from '@dems/shared/sim'
import {
  closedReasonOf,
  countdownTone,
  deviceSummary,
  filterDevices,
  formatCountdown,
  issuePanelState,
  lastSeenParts,
  lifetimeShare,
  orderDevices,
  REDEEMED_HOLD_MS,
  secondsLeft,
  type HeldCodeFacts,
  type IssuePanelInput,
} from '../model'

const T0 = 1_790_823_600_000
const HELD: HeldCodeFacts = { codeId: 'PCD-000101', issuedAt: T0, expiresAt: T0 + 300_000, attemptsAllowed: 5, statusCount: 1 }
const status = (active: Partial<NonNullable<ActivePairingCode['active']>> | null): ActivePairingCode => ({
  active: active === null ? null : { codeId: 'PCD-000101', issuedBy: 'OPR-002', issuedAt: T0, expiresAt: T0 + 300_000, attemptsRemaining: 5, ...active },
})
const device = (change: Partial<PairedDevice>): PairedDevice => ({
  id: 'DEV-0001',
  name: 'Tablet',
  platform: 'android',
  appVersion: '0.2.0',
  state: 'PAIRED',
  pairedAt: T0,
  pairedWithCodeId: 'PCD-000001',
  codeIssuedBy: 'OPR-002',
  lastSeenAt: T0,
  online: false,
  signedInOperatorId: null,
  credentialRotatedAt: null,
  revokedAt: null,
  revokedBy: null,
  revokeReason: null,
  unpairedAt: null,
  ...change,
})
const input = (change: Partial<IssuePanelInput>): IssuePanelInput => ({
  held: HELD,
  outcome: null,
  status: undefined,
  statusCount: 1,
  devices: undefined,
  closedReason: null,
  cancelledHere: null,
  now: T0 + 1_000,
  ...change,
})
const closedRow = (codeId: string, reason: string, seq: number): AuditRow =>
  ({ seq, type: 'PAIRING_CODE_CLOSED', details: { codeId, reason } }) as unknown as AuditRow

describe('issuePanelState: a held code', () => {
  it('is Active, code known, with the attempts of the code from the status when it is about this code', () => {
    expect(issuePanelState(input({}))).toMatchObject({ kind: 'ACTIVE_KNOWN', expiresAt: T0 + 300_000, attemptsRemaining: 5 })
    expect(issuePanelState(input({ status: status({ attemptsRemaining: 2 }), statusCount: 2 }))).toMatchObject({ kind: 'ACTIVE_KNOWN', attemptsRemaining: 2 })
  })

  it('is Redeemed when the registry holds a device paired with it (before anything else)', () => {
    const state = issuePanelState(input({ devices: [device({ id: 'DEV-0002', name: 'New', pairedWithCodeId: HELD.codeId })], closedReason: 'EXHAUSTED', now: T0 + 400_000 }))
    expect(state).toEqual({ kind: 'REDEEMED', deviceId: 'DEV-0002', deviceName: 'New' })
  })

  it('is Active, code not known, only for a status read AFTER the issue that names a code issued no earlier', () => {
    const other = status({ codeId: 'PCD-000900', issuedAt: T0 })
    expect(issuePanelState(input({ status: other, statusCount: 2 })).kind).toBe('ACTIVE_UNKNOWN')
    // The same answer read before the issue (the previous code in the cache) proves nothing.
    expect(issuePanelState(input({ status: other, statusCount: 1 })).kind).toBe('ACTIVE_KNOWN')
    // An older code, even in a fresh answer, is not the one that replaced this.
    expect(issuePanelState(input({ status: status({ codeId: 'PCD-000050', issuedAt: T0 - 1 }), statusCount: 5 })).kind).toBe('ACTIVE_KNOWN')
  })

  it('follows the closed reason: EXPIRED, EXHAUSTED, CANCELLED elsewhere — and Idle for its own cancel', () => {
    expect(issuePanelState(input({ closedReason: 'EXPIRED' })).kind).toBe('EXPIRED')
    expect(issuePanelState(input({ closedReason: 'EXHAUSTED' })).kind).toBe('EXHAUSTED')
    expect(issuePanelState(input({ closedReason: 'CANCELLED' })).kind).toBe('CANCELLED_ELSEWHERE')
    expect(issuePanelState(input({ closedReason: 'CANCELLED', cancelledHere: HELD.codeId })).kind).toBe('IDLE')
  })

  it('expires on the Live clock at `expiresAt`, not a millisecond before', () => {
    expect(issuePanelState(input({ now: HELD.expiresAt - 1 })).kind).toBe('ACTIVE_KNOWN')
    expect(issuePanelState(input({ now: HELD.expiresAt })).kind).toBe('EXPIRED')
  })
})

describe('issuePanelState: no held code', () => {
  it('Redeemed for 4 s after the outcome, then the status decides', () => {
    const outcome = { kind: 'REDEEMED' as const, codeId: 'PCD-000101', deviceId: 'DEV-0002', deviceName: 'New', at: T0 }
    expect(issuePanelState(input({ held: null, outcome, now: T0 + REDEEMED_HOLD_MS - 1 })).kind).toBe('REDEEMED')
    expect(issuePanelState(input({ held: null, outcome, now: T0 + REDEEMED_HOLD_MS })).kind).toBe('IDLE')
  })

  it('an active code on the Core is Active, code not known — unless it is the code whose end this page knows', () => {
    expect(issuePanelState(input({ held: null, status: status({ codeId: 'PCD-000050' }) }))).toMatchObject({ kind: 'ACTIVE_UNKNOWN', issuedBy: 'OPR-002' })
    const outcome = { kind: 'EXHAUSTED' as const, codeId: 'PCD-000101', at: T0 }
    expect(issuePanelState(input({ held: null, outcome, status: status({}) })).kind).toBe('EXHAUSTED')
    expect(issuePanelState(input({ held: null, cancelledHere: 'PCD-000101', status: status({}) })).kind).toBe('IDLE')
    expect(issuePanelState(input({ held: null, outcome: { kind: 'CANCELLED_ELSEWHERE', codeId: 'PCD-000101', at: T0 } })).kind).toBe('CANCELLED_ELSEWHERE')
  })

  it('a status code whose time is over is no active code (the Core answers null for it)', () => {
    expect(issuePanelState(input({ held: null, status: status({ expiresAt: T0 + 1_000 }), now: T0 + 1_000 })).kind).toBe('IDLE')
  })
})

describe('closedReasonOf', () => {
  it('reads the NEWEST PAIRING_CODE_CLOSED of the code, ignores other codes, other types and unknown reasons', () => {
    const rows = [closedRow('PCD-000101', 'EXPIRED', 1), closedRow('PCD-000102', 'CANCELLED', 2), closedRow('PCD-000101', 'EXHAUSTED', 3)]
    expect(closedReasonOf(rows, 'PCD-000101')).toBe('EXHAUSTED')
    expect(closedReasonOf(rows, 'PCD-000102')).toBe('CANCELLED')
    expect(closedReasonOf(rows, 'PCD-000103')).toBeNull()
    expect(closedReasonOf(rows, null)).toBeNull()
    expect(closedReasonOf([{ ...closedRow('PCD-000101', 'EXPIRED', 1), type: 'PAIRING_SUCCESS' } as AuditRow], 'PCD-000101')).toBeNull()
    expect(closedReasonOf([closedRow('PCD-000101', 'SOMETHING', 1)], 'PCD-000101')).toBeNull()
  })
})

describe('the countdown', () => {
  it('whole seconds rounded up, never below zero; m:ss; the share left; the tones at 60 s and 15 s', () => {
    expect(secondsLeft(T0 + 300_000, T0)).toBe(300)
    expect(secondsLeft(T0 + 1_500, T0 + 1_000)).toBe(1)
    expect(secondsLeft(T0, T0 + 5_000)).toBe(0)
    expect(formatCountdown(300)).toBe('5:00')
    expect(formatCountdown(61)).toBe('1:01')
    expect(formatCountdown(9)).toBe('0:09')
    expect(lifetimeShare(T0, T0 + 300_000, T0 + 150_000)).toBe(0.5)
    expect(lifetimeShare(T0, T0 + 300_000, T0 + 400_000)).toBe(0)
    expect(lifetimeShare(T0, T0, T0)).toBe(0)
    expect([61, 60, 16, 15, 0].map(countdownTone)).toEqual(['gold', 'amber', 'amber', 'red', 'red'])
  })
})

describe('the device list', () => {
  const list = [
    device({ id: 'DEV-0001', state: 'REVOKED', pairedAt: T0 + 3 }),
    device({ id: 'DEV-0002', pairedAt: T0 + 1, online: true }),
    device({ id: 'DEV-0003', state: 'UNPAIRED', pairedAt: T0 + 5 }),
    device({ id: 'DEV-0004', pairedAt: T0 + 2 }),
  ]

  it('PAIRED first, then by `pairedAt` newest first', () => {
    expect(orderDevices(list).map((entry) => entry.id)).toEqual(['DEV-0004', 'DEV-0002', 'DEV-0003', 'DEV-0001'])
  })

  it('filters: PAIRED, ENDED (REVOKED and UNPAIRED), ALL', () => {
    expect(filterDevices(list, 'PAIRED').map((entry) => entry.id)).toEqual(['DEV-0002', 'DEV-0004'])
    expect(filterDevices(list, 'ENDED').map((entry) => entry.id)).toEqual(['DEV-0001', 'DEV-0003'])
    expect(filterDevices(list, 'ALL')).toHaveLength(4)
  })

  it('counts PAIRED devices and, of them, the online ones', () => {
    expect(deviceSummary([...list, device({ id: 'DEV-0005', state: 'REVOKED', online: true })])).toEqual({ paired: 2, online: 1 })
  })

  it('"Last seen" in one unit', () => {
    expect(lastSeenParts(T0, T0 + 59_999)).toEqual({ unit: 'justNow' })
    expect(lastSeenParts(T0, T0 + 60_000)).toEqual({ unit: 'minutes', count: 1 })
    expect(lastSeenParts(T0, T0 + 59 * 60_000)).toEqual({ unit: 'minutes', count: 59 })
    expect(lastSeenParts(T0, T0 + 60 * 60_000)).toEqual({ unit: 'hours', count: 1 })
    expect(lastSeenParts(T0, T0 + 48 * 3_600_000)).toEqual({ unit: 'days', count: 2 })
    expect(lastSeenParts(T0 + 5_000, T0)).toEqual({ unit: 'justNow' })
  })
})
