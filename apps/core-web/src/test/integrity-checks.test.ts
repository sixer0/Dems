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
