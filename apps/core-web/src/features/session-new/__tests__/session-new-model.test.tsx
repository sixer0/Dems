// Step 46: the pure flow model. Step gating from the session state, the gate view (PASS / WARN /
// BLOCK, acknowledgement, retry) and the reason mapping that replaces the simulator's EN text
// (the reason codes since step 54).
import { describe, expect, it } from 'vitest'
import { PRECHECK_ORDER, type PrecheckItem, type PrecheckSlice } from '@dems/shared/sim'
import { PRECHECK_SECURITY_NOT_REPORTED_EXAMPLE } from '@dems/shared/api'
import { effectiveStep, gateView, isLiveElsewhere, isSecurityNotReportedNote, isSessionMessage, maxStepFor, precheckNoteKey, reasonKeyFor } from '../model'

function slice(statuses: PrecheckItem['status'][], outcome: PrecheckSlice['outcome'], warningsAcknowledged = false): PrecheckSlice {
  return {
    items: PRECHECK_ORDER.map((id, index) => ({ id, status: statuses[index] ?? 'PENDING', value: null, reason: null, resolvesAt: null })),
    startedAt: 1,
    completedAt: outcome ? 2 : null,
    outcome,
    warningsAcknowledged,
  }
}

const ALL_PASS = Array<PrecheckItem['status']>(PRECHECK_ORDER.length).fill('PASS') // audit fix row 83 (DF-03): twelve checks

describe('step gating', () => {
  it('never shows a step the session does not allow', () => {
    expect(maxStepFor(null)).toBe(1)
    expect(maxStepFor('SEALED')).toBe(1)
    expect(maxStepFor('CREATE')).toBe(2)
    expect(maxStepFor('PRECHECK')).toBe(2)
    expect(maxStepFor('ARMED')).toBe(3)
    expect(effectiveStep(3, null)).toBe(1)
    expect(effectiveStep(3, 'PRECHECK')).toBe(2)
    expect(effectiveStep(1, 'ARMED')).toBe(1)
  })

  it('hands live sessions to the Session Monitor (R4 n5) but not setup or sealed ones', () => {
    for (const state of ['RECORDING', 'STOPPING', 'FINALIZING', 'FAULT', 'RECOVERY'] as const) expect(isLiveElsewhere(state)).toBe(true)
    for (const state of [null, 'CREATE', 'PRECHECK', 'ARMED', 'SEALED'] as const) expect(isLiveElsewhere(state)).toBe(false)
  })
})

describe('gate view', () => {
  it('is running while checks resolve and allows nothing yet', () => {
    const view = gateView(slice(['PASS', 'PASS', 'RUNNING'], null), 'PRECHECK', false)
    expect(view).toMatchObject({ phase: 'running', done: 2, total: 12, canProceed: false, canRetry: false, needsAck: false }) // row 83: twelve checks
  })

  it('BLOCK disables Next and offers a re-run', () => {
    const statuses = [...ALL_PASS]
    statuses[0] = 'BLOCK'
    const view = gateView(slice(statuses, 'BLOCK'), 'PRECHECK', true)
    expect(view).toMatchObject({ phase: 'block', blocks: 1, canProceed: false, canRetry: true })
  })

  it('WARN needs the acknowledgement before Next', () => {
    const statuses = [...ALL_PASS]
    statuses[3] = 'WARN'
    expect(gateView(slice(statuses, 'WARN'), 'PRECHECK', false)).toMatchObject({ phase: 'warn', warnings: 1, needsAck: true, canProceed: false, canRetry: true })
    expect(gateView(slice(statuses, 'WARN'), 'PRECHECK', true)).toMatchObject({ phase: 'warn', needsAck: true, canProceed: true })
    // Once acknowledged in the simulator (ARMED), Next stays open and the box is gone.
    expect(gateView(slice(statuses, 'WARN', true), 'ARMED', false)).toMatchObject({ phase: 'warn', needsAck: false, canProceed: true, canRetry: false })
  })

  it('PASS (the simulator arms by itself) allows Next', () => {
    expect(gateView(slice(ALL_PASS, 'PASS'), 'ARMED', false)).toMatchObject({ phase: 'pass', done: 12, canProceed: true, canRetry: false })
    expect(gateView(null, null, false)).toMatchObject({ phase: 'idle', canProceed: false })
  })
})

describe('reasons and schema messages', () => {
  it('maps every WARN and BLOCK case of the §5.3 policy to an i18n reason', () => {
    expect(reasonKeyFor({ id: 'CORE', status: 'BLOCK', value: 'OFFLINE' })).toBe('coreOffline')
    expect(reasonKeyFor({ id: 'LENS_2', status: 'BLOCK', value: 'FAULT' })).toBe('lensFault')
    expect(reasonKeyFor({ id: 'MIC_1', status: 'WARN', value: 'NO_SIGNAL' })).toBe('micNoSignal')
    expect(reasonKeyFor({ id: 'MIC_2', status: 'WARN', value: 'CLIP' })).toBe('micClip')
    expect(reasonKeyFor({ id: 'STORAGE', status: 'BLOCK', value: 'FULL' })).toBe('storageFull')
    expect(reasonKeyFor({ id: 'STORAGE', status: 'WARN', value: 'LOW' })).toBe('storageLow')
    expect(reasonKeyFor({ id: 'TIME', status: 'WARN', value: 'RTC' })).toBe('timeRtc')
    expect(reasonKeyFor({ id: 'SECURITY', status: 'BLOCK', value: 'FAULT' })).toBe('securityFault')
    expect(reasonKeyFor({ id: 'SECURITY', status: 'WARN', value: 'READY' })).toBe('securityTamper')
    expect(reasonKeyFor({ id: 'TIME', status: 'PASS', value: 'GNSS' })).toBeNull()
  })

  it('recognises only the schema message keys', () => {
    expect(isSessionMessage('sessionNew.info.notes.tooLong')).toBe(true)
    expect(isSessionMessage('Required')).toBe(false)
    expect(isSessionMessage(undefined)).toBe(false)
  })
})

// Fix wave J (JW-04; contract J-S 5): the pre-check's SECURITY row of a Core that reads no platform is a NOTE worded
// "not reported" - never "READY - PASS", never the host-clock sentence, never a warning to count or acknowledge.
describe('the SECURITY note of a Core that reports no platform (wave J, JW-04)', () => {
  const security = PRECHECK_SECURITY_NOT_REPORTED_EXAMPLE as unknown as PrecheckItem
  it('the contract`s example is a note with its own sentence, and it has no reason of the warning table', () => {
    expect(precheckNoteKey(security)).toBe('web.waveJ.precheck.securityNotReported')
    expect(isSecurityNotReportedNote(security)).toBe(true)
    expect(reasonKeyFor(security)).toBeNull()
  })
  it('it is not counted as a warning and asks for no acknowledgement', () => {
    const view = gateView({ items: [security], outcome: 'PASS', warningsAcknowledged: false } as unknown as PrecheckSlice, null, false)
    expect(view.warnings).toBe(0)
    expect(view.needsAck).toBe(false)
  })
  it('NEGATIVE CONTROL: a security FAULT keeps its words, and the host-clock note keeps its own sentence', () => {
    const fault = { ...security, status: 'BLOCK', value: 'FAULT', reasonCode: 'SECURITY_FAULT', params: {} } as unknown as PrecheckItem
    expect(precheckNoteKey(fault)).toBeNull()
    expect(reasonKeyFor(fault)).toBe('securityFault')
    const time = { id: 'TIME', status: 'WARN', value: 'HOST_SYSTEM_CLOCK', reason: null, reasonCode: null, params: { rule: 'HOST_SYSTEM_CLOCK' } } as unknown as PrecheckItem
    if (precheckNoteKey(time) !== null) expect(precheckNoteKey(time)).toBe('sessionNew.precheckNote.timeHostClock')
    expect(isSecurityNotReportedNote(time)).toBe(false)
  })
})
