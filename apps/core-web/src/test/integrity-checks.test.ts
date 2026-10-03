// Step 54 (D96, audit 45 F45-03; review 40 m5): the SECURE pill and its checklist agree with the
// system-state ring. A warning during a recording reads ATTENTION (it used to read SECURE while the
// Session Monitor showed ATTENTION and the bell 1); a critical fault reads CRITICAL; POWER_FAIL
// fails a checklist row instead of leaving every row OK.
import { describe, expect, it } from 'vitest'
import { createManualClock, createSim, selectSystemState, type ScenarioName } from '@dems/shared/sim'
import {
  INTEGRITY_CHECK_IDS,
  selectIntegrityChecks,
  selectPillState,
  type IntegrityCheckId,
} from '@/components/shell/integrity-checks'

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
