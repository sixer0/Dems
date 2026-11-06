// Fix wave J - JA2-25 / JW-21 and the controller's ruling: the web's bell agrees with the phone's. The badge counts every
// alert that is still open for the operator, also one the Core resolved that nobody acknowledged. A new module
// (`open-alerts.ts`): its own test file, named after it.
import { describe, expect, it } from 'vitest'
import { SEAL_UNSEALABLE_EXAMPLE_ALERT, type SimAlert } from '@dems/shared/sim'
import { acknowledgeAllPlan, isOpenAlert, OPEN_ALERTS_LISTED, openAlertsOf, selectOpenUnacknowledgedCount } from '../open-alerts'

const alert = (id: number, over: Partial<SimAlert>): SimAlert => ({ id: `ALR-${String(id).padStart(6, '0')}`, at: id * 1_000, severity: 'WARNING', kind: 'SYSTEM', message: `alert ${id}`, active: true, acknowledged: false, resolvedAt: null, ...over })

describe('the alerts that are still open for the operator (JA2-25 / JW-21)', () => {
  const ACTIVE = alert(1, {})
  const ACTIVE_ACKED = alert(2, { acknowledged: true })
  const RESOLVED_OPEN = alert(3, { active: false, resolvedAt: 3_500 })
  const CLOSED = alert(4, { active: false, acknowledged: true, resolvedAt: 4_500 })

  it('open: active, or resolved and acknowledged by nobody; closed: resolved AND acknowledged', () => {
    expect([ACTIVE, ACTIVE_ACKED, RESOLVED_OPEN, CLOSED].map(isOpenAlert)).toEqual([true, true, true, false])
  })

  it('the list: the open ones, newest first; the closed one is not listed', () => {
    expect(openAlertsOf([ACTIVE, ACTIVE_ACKED, RESOLVED_OPEN, CLOSED]).map((entry) => entry.id)).toEqual([RESOLVED_OPEN.id, ACTIVE_ACKED.id, ACTIVE.id])
  })

  it('the badge counts the unacknowledged ones - the resolved one too (it was not counted before)', () => {
    expect(selectOpenUnacknowledgedCount({ alerts: [ACTIVE, ACTIVE_ACKED, RESOLVED_OPEN, CLOSED] })).toBe(2)
    // NEGATIVE CONTROL: once it is acknowledged it leaves the count and the list.
    const acked = { ...RESOLVED_OPEN, acknowledged: true }
    expect(selectOpenUnacknowledgedCount({ alerts: [ACTIVE, acked] })).toBe(1)
    expect(openAlertsOf([ACTIVE, acked]).map((entry) => entry.id)).toEqual([ACTIVE.id])
  })

  it('at most twenty are listed (the newest); the badge still counts all', () => {
    const many = Array.from({ length: 30 }, (_, index) => alert(100 + index, { active: false }))
    const listed = openAlertsOf(many)
    expect(listed).toHaveLength(OPEN_ALERTS_LISTED)
    expect(listed[0]?.id).toBe(many.at(-1)?.id)
    expect(selectOpenUnacknowledgedCount({ alerts: many })).toBe(30)
  })
})

// Fix wave J round three, driver J3-W: "Acknowledge all" - what one confirmed press acknowledges
// (`acknowledgeAllPlan`). Lane 2's bell read "84 new alerts" under the counting rule above.
describe('what "Acknowledge all" acknowledges', () => {
  const ACTIVE = alert(1, {})
  const ACTIVE_ACKED = alert(2, { acknowledged: true })
  const RESOLVED_OPEN = alert(3, { active: false, resolvedAt: 3_500 })
  const CLOSED = alert(4, { active: false, acknowledged: true, resolvedAt: 4_500 })
  const notice = (id: number, over: Partial<SimAlert> = {}): SimAlert => ({ ...SEAL_UNSEALABLE_EXAMPLE_ALERT, id: `ALR-${String(id).padStart(6, '0')}`, at: id * 1_000, ...over })
  const NOTICE = notice(5)
  const NOTICE_ACKED_BY_OTHER = notice(6, { acknowledged: true })
  const NOTICE_CLOSED = notice(7, { active: false, acknowledged: true, resolvedAt: 7_500 })
  const ALL = [NOTICE_CLOSED, NOTICE_ACKED_BY_OTHER, NOTICE, CLOSED, RESOLVED_OPEN, ACTIVE_ACKED, ACTIVE]

  it('every unacknowledged alert, the ones the Core resolved included; nothing that is already acknowledged; oldest first', () => {
    const plan = acknowledgeAllPlan([CLOSED, RESOLVED_OPEN, ACTIVE_ACKED, ACTIVE])
    expect(plan).toEqual({ alertIds: [ACTIVE.id, RESOLVED_OPEN.id], leftNotices: 0 })
  })

  // Fix wave J closing pass (J4, item 1; the controller's ruling replaces the rule of round three, under which a reviewing
  // role's "all" closed the notices): a notice about a recording in quarantine is closed one by one, knowingly.
  it('the unsealable notices are NEVER in "all": the open ones are counted as left for individual acknowledgement; the plan takes no role, so no role can sweep them up', () => {
    const plan = acknowledgeAllPlan(ALL)
    expect(plan.alertIds).toEqual([ACTIVE.id, RESOLVED_OPEN.id])
    for (const id of [NOTICE.id, NOTICE_ACKED_BY_OTHER.id, NOTICE_CLOSED.id]) expect(plan.alertIds).not.toContain(id)
    // The two that are still open (one of them acknowledged by a role that cannot close it); the closed one is nobody's work.
    expect(plan.leftNotices).toBe(2)
    expect(acknowledgeAllPlan).toHaveLength(1)
    // CONTROL: the same alert without the notice's mark IS in "all" - it is the mark that keeps it out, not its other fields.
    expect(acknowledgeAllPlan([{ ...NOTICE, params: {} }])).toEqual({ alertIds: [NOTICE.id], leftNotices: 0 })
  })

  it('only notices are open: nothing to send, the count of the notices left', () => {
    expect(acknowledgeAllPlan([NOTICE, NOTICE_ACKED_BY_OTHER, NOTICE_CLOSED])).toEqual({ alertIds: [], leftNotices: 2 })
  })

  it('the backlog of lane 2: 84 unacknowledged alerts are 84 ids, though the bell lists twenty', () => {
    const backlog = Array.from({ length: 84 }, (_, index) => alert(200 + index, { active: false, resolvedAt: 1 }))
    expect(openAlertsOf(backlog)).toHaveLength(OPEN_ALERTS_LISTED)
    expect(acknowledgeAllPlan(backlog).alertIds).toHaveLength(84)
  })
})
