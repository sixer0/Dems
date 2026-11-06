// Step 54 (D96, audit 45 F45-03; review 40 m5): the SECURE pill and its checklist agree with the
// system-state ring. A warning during a recording reads ATTENTION (it used to read SECURE while the
// Session Monitor showed ATTENTION and the bell 1); a critical fault reads CRITICAL; POWER_FAIL
// fails a checklist row instead of leaving every row OK.
import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest'
import { createManualClock, createSim, selectSystemState, type ScenarioName } from '@dems/shared/sim'
import {
  INTEGRITY_CHECK_IDS,
  selectIntegrityChecks,
  selectPillState,
  type IntegrityCheckId, pillSubtitle, selectPillCause,
} from '@/components/shell/integrity-checks'
import { en } from '@dems/shared/i18n'
import { createI18n } from '@/i18n'
import { enWeb } from '@/i18n-web'
import { configure } from '@testing-library/react'

const START = Date.UTC(2026, 9, 1, 3, 0, 0) // 10:00 WIB

function newSim(scenario: ScenarioName = 'idle') {
  return createSim({ clock: createManualClock(START), storage: null, authStorage: null, scenario })
}

const row = (checks: readonly string[], id: IntegrityCheckId) => checks[INTEGRITY_CHECK_IDS.indexOf(id)]

describe('SECURE pill (D96)', () => {
  it('idle: SECURE with nine OK rows', () => {
    const sim = newSim()
    expect(selectPillState(sim.store.getState())).toBe('SECURE')
    expect(selectIntegrityChecks(sim.store.getState())).toEqual(Array(9).fill('OK'))
  })

  it('recording with no flag stays SECURE (the ring shows RECORDING)', () => {
    const sim = newSim('recording')
    expect(selectSystemState(sim.store.getState()).state).toBe('RECORDING')
    expect(selectPillState(sim.store.getState())).toBe('SECURE')
  })

  it('recording + MIC clip → ATTENTION (amber), inputs row ATTENTION; the ring still shows RECORDING', () => {
    const sim = newSim('recording')
    sim.actions.inject('MIC_CLIP', { channel: 'AUDIO-02' })
    const state = sim.store.getState()
    expect(selectSystemState(state).state).toBe('RECORDING')
    expect(selectPillState(state)).toBe('ATTENTION')
    expect(row(selectIntegrityChecks(state), 'inputs')).toBe('ATTENTION')
  })

  it('recording + fan stall → ATTENTION, platform row ATTENTION', () => {
    const sim = newSim('recording')
    sim.actions.inject('FAN_STALL')
    expect(selectPillState(sim.store.getState())).toBe('ATTENTION')
    expect(row(selectIntegrityChecks(sim.store.getState()), 'platform')).toBe('ATTENTION')
  })

  it('recording + storage full → CRITICAL', () => {
    const sim = newSim('recording')
    sim.actions.inject('STORAGE_FULL')
    expect(selectPillState(sim.store.getState())).toBe('CRITICAL')
    expect(row(selectIntegrityChecks(sim.store.getState()), 'storage')).toBe('CRITICAL')
  })

  it('POWER_FAIL at idle → CRITICAL, and the recording row fails (no all-OK checklist under a CRITICAL ring)', () => {
    const sim = newSim()
    sim.actions.inject('POWER_FAIL')
    const state = sim.store.getState()
    expect(selectSystemState(state).state).toBe('CRITICAL')
    expect(selectPillState(state)).toBe('CRITICAL')
    expect(row(selectIntegrityChecks(state), 'recording')).toBe('CRITICAL')
  })

  it('the checklist array is stable between ticks (useSim shallow)', () => {
    const sim = newSim('recording')
    const before = selectIntegrityChecks(sim.store.getState())
    sim.tick()
    expect(selectIntegrityChecks(sim.store.getState())).toBe(before)
  })
})

// Fix wave I, driver B - finding G75b-07 (re-gate 75): the header pill read "CRITICAL / An integrity
// check failed" for ANY critical fault (a demo capture fault, a power fail beside a blocked seal).
// No integrity check had failed. The rule (`selectPillCause`):
//
// | The critical flags of the system state | The pill's second line |
// |---|---|
// | the audit chain or the security platform (TPM / Secure Boot) | "An integrity check failed" (kept) |
// | one other kind | "Critical fault: <the kind's own name>" |
// | several other kinds | "<n> critical faults" |
describe("the header names the critical fault (G75b-07)", () => {
  vi.resetConfig()
  beforeAll(() => void configure({ asyncUtilTimeout: 1_000 }))
  afterAll(() => void configure({ asyncUtilTimeout: 1_000 }))

  const START = Date.UTC(2026, 9, 1, 3, 0, 0)
  const t = createI18n().t
  const INTEGRITY = en.shell.securePill.CRITICAL.subtitle

  function newSim(scenario: ScenarioName = 'idle') {
    return createSim({ clock: createManualClock(START), storage: null, authStorage: null, scenario })
  }
  const line = (sim: ReturnType<typeof newSim>) => pillSubtitle(t, selectPillState(sim.store.getState()), selectPillCause(sim.store.getState()))

  describe('G75b-07 the header names the critical fault', () => {
    it('a capture fault of a recording: "Critical fault: Capture fault", never the integrity sentence', () => {
      const sim = newSim('recording')
      sim.actions.inject('CAPTURE_FAULT')
      expect(selectPillState(sim.store.getState())).toBe('CRITICAL')
      expect(selectPillCause(sim.store.getState())).toBe('KIND:CAPTURE_FAULT')
      expect(line(sim)).toBe(`Critical fault: ${en.common.faultKind.CAPTURE_FAULT}`)
      expect(line(sim)).not.toBe(INTEGRITY)
    })

    it('a power fail: "Critical fault: Power failure"', () => {
      const sim = newSim('idle')
      sim.actions.inject('POWER_FAIL')
      expect(selectPillState(sim.store.getState())).toBe('CRITICAL')
      expect(line(sim)).toBe(`Critical fault: ${en.common.faultKind.POWER_FAIL}`)
    })

    it('two kinds that are no integrity check: a neutral count', () => {
      const sim = newSim('idle')
      sim.actions.inject('POWER_FAIL')
      sim.actions.inject('STORAGE_FULL')
      expect(selectPillCause(sim.store.getState())).toMatch(/^COUNT:[2-9]$/)
      expect(line(sim)).toMatch(/^\d critical faults$/)
      expect(line(sim)).not.toBe(INTEGRITY)
    })

    it('NEGATIVE CONTROL - the audit chain broken: the integrity sentence stays', () => {
      const sim = newSim('idle')
      sim.actions.inject('AUDIT_TAMPER')
      expect(selectPillState(sim.store.getState())).toBe('CRITICAL')
      expect(selectPillCause(sim.store.getState())).toBe('INTEGRITY')
      expect(line(sim)).toBe(INTEGRITY)
    })

    it('NEGATIVE CONTROL - a TPM failure, also beside another critical fault: the integrity sentence stays', () => {
      const sim = newSim('idle')
      sim.actions.inject('TPM_FAILURE')
      sim.actions.inject('POWER_FAIL')
      expect(selectPillCause(sim.store.getState())).toBe('INTEGRITY')
      expect(line(sim)).toBe(INTEGRITY)
    })

    it('SECURE and ATTENTION keep their own lines; no cause is stated', () => {
      const sim = newSim('idle')
      expect(selectPillCause(sim.store.getState())).toBe('')
      expect(line(sim)).toBe(en.shell.securePill.SECURE.subtitle)
      sim.actions.inject('FAN_STALL')
      expect(selectPillCause(sim.store.getState())).toBe('')
      expect(line(sim)).toBe(en.shell.securePill.ATTENTION.subtitle)
    })

    it('the count sentence has a singular (one critical flag whose kind the console cannot name)', () => {
      expect(pillSubtitle(t, 'CRITICAL', 'COUNT:1')).toBe(enWeb.web.securePill.criticalCount_one.replace('{{count}}', '1'))
    })
  })
})

// Fix wave J, driver J-W - findings JW-04, JW-05, JT-01 (truth rule 3c): the header pill, the Dashboard ring and the
// pre-check read ONE statement of the system's state, `systemStatementOf` - a pure function of the Core's facts. The
// table is every combination the judges met (and the ones beside them): the pill read "SECURE - All systems operational"
// in rows 2, 6, 7, 9 and 10.
import { systemStatementKindOf, systemStatementOf, statesSecure, selectSystemStatementKind, linkLostOf, type SystemFacts, type SystemStatementKind } from '@/lib/system-statement'
import { LiveLinkState } from '@dems/shared/live'

describe('ONE statement of system state (wave J: JW-04, JW-05, JT-01)', () => {
  const CALM: SystemFacts = { ready: true, linkLost: false, severity: 'OK', sealBlocked: false, sealRetrying: false, criticalAlerts: 0, warningAlerts: 0, openNotices: 0, platformNotReported: false, allOperational: true }
  const TABLE: readonly [string, Partial<SystemFacts>, SystemStatementKind][] = [
    ['1 the simulated device, nothing wrong', {}, 'SECURE'],
    ['2 a Core that reports no platform (JW-04: pill SECURE, popover "Not reported")', { platformNotReported: true }, 'NO_FAULT_REPORTED'],
    ['3 not hydrated', { ready: false }, 'UNKNOWN'],
    ['4 not hydrated beats everything', { ready: false, severity: 'CRITICAL', linkLost: true }, 'UNKNOWN'],
    ['5 the Core link is lost (rule 3c: "state unknown", never Ready)', { linkLost: true }, 'CORE_OFFLINE'],
    ['6 the link is lost on a real-capture Core with an alert: still unknown', { linkLost: true, platformNotReported: true, warningAlerts: 1 }, 'CORE_OFFLINE'],
    ['7 an unreachable camera: an active WARNING alert no flag stands for (JW-05 / JT-01 b)', { warningAlerts: 1, allOperational: false }, 'ALERT_ACTIVE'],
    ['8 the same on a real-capture Core', { warningAlerts: 1, platformNotReported: true, allOperational: false }, 'ALERT_ACTIVE'],
    ['9 a seal is retried (JT-01 a)', { sealRetrying: true, platformNotReported: true, allOperational: false }, 'SEAL_RETRYING'],
    ['10 a recording in quarantine (an open notice)', { openNotices: 1, platformNotReported: true, allOperational: false }, 'OPEN_NOTICE'],
    ['11 a blocked seal', { sealBlocked: true, allOperational: false }, 'CRITICAL'],
    ['12 a blocked seal beats a retried one and an alert', { sealBlocked: true, sealRetrying: true, warningAlerts: 2, allOperational: false }, 'CRITICAL'],
    ['13 a critical flag', { severity: 'CRITICAL', allOperational: false }, 'CRITICAL'],
    ['14 an active CRITICAL alert no flag stands for', { criticalAlerts: 1, allOperational: false }, 'CRITICAL'],
    ['15 a warning flag', { severity: 'WARNING', allOperational: false }, 'ATTENTION'],
    ['16 a warning flag beside a retried seal: the flag', { severity: 'WARNING', sealRetrying: true, allOperational: false }, 'ATTENTION'],
    ['17 a retried seal beside an unreachable camera: the seal', { sealRetrying: true, warningAlerts: 1, allOperational: false }, 'SEAL_RETRYING'],
    ['18 an alert beside an open notice: the alert', { warningAlerts: 1, openNotices: 2, allOperational: false }, 'ALERT_ACTIVE'],
    ['19 the shared reader says "not all operational" and no fact above names it: never SECURE', { allOperational: false }, 'ATTENTION'],
    ['20 the same on a real-capture Core: never "no fault reported"', { allOperational: false, platformNotReported: true }, 'ATTENTION'],
  ]
  it.each(TABLE)('%s', (_name, facts, expected) => {
    expect(systemStatementKindOf({ ...CALM, ...facts })).toBe(expected)
  })

  it('only ONE statement may be worded "secure / all systems operational", and it needs every fact calm', () => {
    for (const [, facts, expected] of TABLE) expect(statesSecure(systemStatementKindOf({ ...CALM, ...facts }))).toBe(expected === 'SECURE')
    // Each single fact, alone, takes SECURE away (the negative control of the row 1).
    const singles: Partial<SystemFacts>[] = [{ ready: false }, { linkLost: true }, { severity: 'WARNING' }, { severity: 'CRITICAL' }, { sealBlocked: true }, { sealRetrying: true }, { criticalAlerts: 1 }, { warningAlerts: 1 }, { openNotices: 1 }, { platformNotReported: true }, { allOperational: false }]
    for (const single of singles) expect(statesSecure(systemStatementKindOf({ ...CALM, ...single }))).toBe(false)
  })

  it('the tone the pill and the ring colour by', () => {
    expect(systemStatementOf(CALM).tone).toBe('SECURE')
    expect(systemStatementOf({ ...CALM, platformNotReported: true }).tone).toBe('NEUTRAL')
    expect(systemStatementOf({ ...CALM, linkLost: true }).tone).toBe('UNKNOWN')
    expect(systemStatementOf({ ...CALM, warningAlerts: 1 }).tone).toBe('ATTENTION')
    expect(systemStatementOf({ ...CALM, sealBlocked: true }).tone).toBe('CRITICAL')
  })

  it('from the state: an active unreachable-camera alert takes SECURE away, and its resolution gives it back', () => {
    const sim = newSim()
    expect(selectSystemStatementKind(sim.store.getState())).toBe('SECURE')
    const state = sim.store.getState()
    const alert = { id: 'ALR-000900', at: state.clock.now, severity: 'WARNING' as const, kind: 'SYSTEM' as const, message: 'Camera 2 (CAM-02) is not reachable.', active: true, acknowledged: false, resolvedAt: null, params: { reason: 'CAPTURE_DEVICE_UNREACHABLE', deviceId: 'CAM-02', deviceKind: 'CAMERA', phase: 'PRECHECK', cause: 'UNREACHABLE' } }
    expect(selectSystemStatementKind({ ...state, alerts: [alert] })).toBe('ALERT_ACTIVE')
    expect(selectSystemStatementKind({ ...state, alerts: [{ ...alert, active: false }] })).toBe('SECURE')
    // An INFO alert of a running session changes no statement.
    expect(selectSystemStatementKind({ ...state, alerts: [{ ...alert, severity: 'INFO' as const }] })).toBe('SECURE')
    // A Core that states `platformNotReported` is never SECURE.
    expect(selectSystemStatementKind({ ...state, security: { ...state.security, platformNotReported: true } })).toBe('NO_FAULT_REPORTED')
  })

  it('a lost link is OFFLINE or STALE; a socket being opened decides nothing', () => {
    expect(linkLostOf(LiveLinkState.OFFLINE)).toBe(true)
    expect(linkLostOf(LiveLinkState.STALE)).toBe(true)
    expect(linkLostOf(LiveLinkState.CONNECTING)).toBe(false)
    expect(linkLostOf(LiveLinkState.ONLINE)).toBe(false)
    expect(linkLostOf(null)).toBe(false)
  })
})
