// Closing copy round (decision D176 DC-5, finding F75-7; W83 ledger #94): the one deliberate change
// of Simulated copy in the round. The audit export's result note in Simulated mode said the demo
// simulator "does not record the export reason yet"; the simulator records it since step 54 (W51-1).
// The note now says what is true, in the words of the Live note. The dialog renders the key itself
// (`export-audit-dialog.tsx`); `live-security-audit-export.test.tsx` shows it on screen in both modes.
import { afterEach, describe, expect, it } from 'vitest'
import { en } from '@dems/shared/i18n'
import { ALWAYS_VISIBLE, createManualClock, createMemoryAuthStorage, createSim, OPERATOR_IDS, type Sim } from '@dems/shared/sim'
import { exportAuditWithReason } from '../sim-adapter'

const NOW = Date.parse('2026-10-01T10:00:00+07:00')
const sims: Sim[] = []

afterEach(() => {
  for (const sim of sims.splice(0)) sim.stop()
})

/** A simulator with the Supervisor (AUDIT_EXPORT, OPR-002 as in `security-audit.test.tsx`) signed in; nothing runs on its own. */
function supervisorSim(): Sim {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId: OPERATOR_IDS.ANDI, issuedAt: NOW })
  const sim = createSim({ storage: null, authStorage, visibility: ALWAYS_VISIBLE, clock: createManualClock(NOW), scheduler: () => () => undefined })
  sims.push(sim)
  return sim
}

describe('the audit export\'s result note (Simulated mode)', () => {
  it('says the reason is recorded, in the words of the Live note, and no longer that it is not', () => {
    const note = en.securityAudit.exportAudit.result.reasonNote
    expect(note).toBe('Recorded by the simulator in the audit row of the export.')
    expect(note).not.toMatch(/does not record|not record|yet/i)
    // One wording across the two modes: only the recorder differs.
    expect(note.replace('the simulator', 'the Core')).toBe(en.securityAudit.live.exportAudit.reasonNote)
  })

  it('is true: the simulator writes the reason into the export\'s AUDIT_EXPORTED row', () => {
    const sim = supervisorSim()
    const result = exportAuditWithReason(sim, 'Quarterly audit review')
    expect(result.ok).toBe(true)
    expect(sim.store.getState().audit.rows.at(-1)).toMatchObject({ type: 'AUDIT_EXPORTED', details: { reason: 'Quarterly audit review' } })
  })
})
