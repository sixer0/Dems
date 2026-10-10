// Fix wave I, driver B - finding G75b-07 (re-gate 75): the header pill read "CRITICAL / An integrity
// check failed" for ANY critical fault (a demo capture fault, a power fail beside a blocked seal).
// No integrity check had failed. The rule (`selectPillCause`):
//
// | The critical flags of the system state | The pill's second line |
// |---|---|
// | the audit chain or the security platform (TPM / Secure Boot) | "An integrity check failed" (kept) |
// | one other kind | "Critical fault: <the kind's own name>" |
// | several other kinds | "<n> critical faults" |
import { describe, expect, it } from 'vitest'
import { en } from '@dems/shared/i18n'
import { createManualClock, createSim, type ScenarioName } from '@dems/shared/sim'
import { pillSubtitle, selectPillCause, selectPillState } from '@/components/shell/integrity-checks'
import { createI18n } from '@/i18n'
import { enWeb } from '@/i18n-web'

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
