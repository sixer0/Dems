// Fix pass F-M7b (review row 88, R88-02 (c); rulings D178 (2), D183): a session the Core could not
// seal is shown as a STATE of the recording, in the Core's own words - never as an operator error and
// with no retry control. The state is read from the Core's alert (`unsealableNoticeOf`).
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { en } from '@dems/shared/i18n'
import { ALWAYS_VISIBLE, createSim, SimProvider, unsealableSentence, type Sim, type SimAlert } from '@dems/shared/sim'
import '@/i18n'
import { UnsealableNotice } from '../unsealable-notice'

const SESSION = 'SES-20261010-0007'
const sims: Sim[] = []
afterEach(() => {
  cleanup()
  for (const sim of sims.splice(0)) sim.stop()
})

function mount(alerts: SimAlert[], sessionId: string | null = SESSION) {
  const sim = createSim({ storage: null, authStorage: null, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
  sims.push(sim)
  sim.store.setState({ ...sim.store.getState(), alerts }, true)
  return render(
    <SimProvider sim={sim} autoStart={false}>
      <UnsealableNotice sessionId={sessionId} />
    </SimProvider>,
  )
}
const unsealable = (cause: string, sessionId = SESSION): SimAlert => ({ id: 'ALR-000900', at: 1, severity: 'CRITICAL', kind: 'SYSTEM', message: unsealableSentence(cause), active: true, acknowledged: false, resolvedAt: null, target: sessionId, params: { reason: 'UNSEALABLE', cause, sessionId } })

describe('the UNSEALABLE state on the Session Monitor overlay', () => {
  it('says, as a status, that the recording could not be sealed and that its files are in quarantine on the Core, with the cause', () => {
    mount([unsealable('NOTHING_SEALABLE')])
    const notice = screen.getByTestId('sm-unsealable')
    expect(notice.textContent).toBe('This recording could not be sealed. Its files were kept in quarantine on the Core. (NOTHING_SEALABLE)')
    expect(notice.textContent).toBe(en.common.sealUnsealable.notice.replace('{{cause}}', 'NOTHING_SEALABLE'))
    // A state, not an operator error: a status region, no alert role, no control to press.
    expect(notice.getAttribute('role')).toBe('status')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('CONTROL: nothing is drawn without that state - no alert, another session, a resolved alert, another reason', () => {
    expect(mount([]).container.textContent).toBe('')
    cleanup()
    expect(mount([unsealable('NOTHING_SEALABLE', 'SES-20261010-0001')]).container.textContent).toBe('')
    cleanup()
    expect(mount([{ ...unsealable('NOTHING_SEALABLE'), active: false, resolvedAt: 2 }]).container.textContent).toBe('')
    cleanup()
    expect(mount([{ ...unsealable('NOTHING_SEALABLE'), params: { reason: 'CAPTURE_DISCOVERY_EMPTY' } }]).container.textContent).toBe('')
  })
})
