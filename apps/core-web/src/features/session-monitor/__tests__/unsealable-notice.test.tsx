// Fix pass F-M7b (review row 88, R88-02 (c); rulings D178 (2), D183): a session the Core could not
// seal is shown as a STATE of the recording, in the Core's own words - never as an operator error and
// with no retry control. The state is read from the Core's alert (`unsealableNoticeOf`).
import { cleanup, render, screen, act, fireEvent, waitFor, within, configure } from '@testing-library/react'
import { afterEach, describe, expect, it, vi, beforeAll, afterAll } from 'vitest'
import { en } from '@dems/shared/i18n'
import { ALWAYS_VISIBLE, createSim, SEAL_UNSEALABLE_PLAIN_SENTENCE, SimProvider, unsealableSentence, type Sim, type SimAlert, OPERATOR_IDS, SEAL_AUTOMATIC_RETRIES, SEAL_BLOCKED_EXAMPLE_ALERT, SEAL_BLOCKED_EXAMPLE_FINALIZATION, SEAL_BLOCKED_EXAMPLE_SESSION_ID, SEAL_UNSEALABLE_EXAMPLE_ALERT, SEAL_UNSEALABLE_EXAMPLE_SESSION_ID, alertBlocksRecording, canResolveUnsealable, canRetryBlockedSeal, openUnsealableNoticesOf, type SimState } from '@dems/shared/sim'
import '@/i18n'
import { UnsealableNotice } from '../unsealable-notice'
import { sealRetryingSessionOf } from '@/lib/seal-attention'
import { worstAlertOfSession } from '@/features/session-monitor/model'
import { selectUnsealableCause } from '@/features/session-monitor/unsealable-cause'
import { getMissingI18nKeys } from '@/i18n'
import { enWeb } from '@/i18n-web'
import { FIND, mount, newSim, page, realCore, unsealableOf, useRealCorePages } from '@/test/real-core-bed'

describe("the UNSEALABLE state as the Monitor overlay draws it (F-M7b)", () => {
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
      // Fix wave L (G75d-04), pins moved by delta: ONE sentence without a code in brackets; the code of the cause is a detail of its own.
      expect(screen.getByTestId('sm-unsealable-sentence').textContent).toBe('This recording could not be sealed. Its files were kept in quarantine on the Core.')
      expect(screen.getByTestId('sm-unsealable-sentence').textContent).toBe(SEAL_UNSEALABLE_PLAIN_SENTENCE)
      expect(notice.textContent).not.toContain('(NOTHING_SEALABLE)')
      expect(screen.getByTestId('sm-unsealable-cause').textContent).toBe('Cause code: NOTHING_SEALABLE')
      expect(en.common.sealUnsealable.notice).toContain('{{cause}}')
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
      // Fix wave L (G75d-04), by delta: the alert of THIS session that was acknowledged and resolved still states how the
      // session ended - the dialog of an ended session must never fall back to "Finalizing evidence / 0% complete".
      expect(mount([{ ...unsealable('NOTHING_SEALABLE'), active: false, resolvedAt: 2 }]).container.textContent).toContain(SEAL_UNSEALABLE_PLAIN_SENTENCE)
      cleanup()
      expect(mount([{ ...unsealable('NOTHING_SEALABLE'), params: { reason: 'CAPTURE_DISCOVERY_EMPTY' } }]).container.textContent).toBe('')
    })
  })
})

// Fix wave L, driver L-W (findings G75d-01 .. G75d-04 of re-check 75; rulings D227 .. D229) and fix wave M
// (G75e-04, G75e-06): what the web says of a recording that could not be sealed, of a seal that is blocked or
// retried, and of the unsealable end - on the header pill, the bell, the Dashboard ring, the Monitor banner and
// the seal dialog. The cases were written beside the "real capture states only facts" cases of the same round
// (`src/test/real-core-facts.test.tsx`) and share their page harness (`src/test/real-core-bed.tsx`).
describe("the open notice of a recording that could not be sealed, the retry of a blocked seal, the unsealable end: header pill, bell, Dashboard ring, Monitor banner and seal dialog (G75d-01 .. G75d-04, G75e-04, G75e-06)", () => {
  vi.resetConfig()
  beforeAll(() => void configure({ asyncUtilTimeout: 1_000 }))
  afterAll(() => void configure({ asyncUtilTimeout: 1_000 }))

  vi.setConfig({ testTimeout: 45_000 })

  const L = enWeb.web.waveL
  const M = enWeb.web.waveM
  useRealCorePages()

  describe('G75d-01 / G75d-03: the open notice of a recording that could not be sealed', () => {
    it('the contract\'s readers: the unsealable alert is an open notice that does not block recording; a blocked seal does', () => {
      expect(openUnsealableNoticesOf({ alerts: [SEAL_UNSEALABLE_EXAMPLE_ALERT] })).toHaveLength(1)
      expect(openUnsealableNoticesOf({ alerts: [{ ...SEAL_UNSEALABLE_EXAMPLE_ALERT, active: false }] })).toHaveLength(0)
      expect(alertBlocksRecording(SEAL_UNSEALABLE_EXAMPLE_ALERT)).toBe(false)
      expect(alertBlocksRecording(SEAL_BLOCKED_EXAMPLE_ALERT)).toBe(true)
      expect(canResolveUnsealable('SUPERVISOR')).toBe(true)
      expect(canResolveUnsealable('INVESTIGATOR')).toBe(false)
    })
    it('the Monitor never draws the alert of ANOTHER session as the fault of the session that records', () => {
      const base = newSim('recording').store.getState()
      const open = base.session!.id
      const with_ = (alerts: SimAlert[]): SimState => ({ ...base, alerts })
      // The notice of session X beside the recording of session Y: no condition of Y.
      expect(worstAlertOfSession(with_([SEAL_UNSEALABLE_EXAMPLE_ALERT]), open)).toBeNull()
      // Even the unsealable notice of the open session's own id is the open notice, never a fault state.
      expect(worstAlertOfSession(with_([unsealableOf(open)]), open)).toBeNull()
      // An alert that names another session is not this session's; one that names this session, or none, is read as before.
      const critical = { ...SEAL_BLOCKED_EXAMPLE_ALERT, params: { ...SEAL_BLOCKED_EXAMPLE_ALERT.params, sessionId: 'SES-20261011-0001' } } as SimAlert
      expect(worstAlertOfSession(with_([critical]), open)).toBeNull()
      expect(worstAlertOfSession(with_([{ ...critical, params: { ...critical.params, sessionId: open } }]), open)?.id).toBe(critical.id)
      const { sessionId: _none, ...unnamed } = critical.params as Record<string, unknown>
      expect(worstAlertOfSession(with_([{ ...critical, params: unnamed } as SimAlert]), open)?.id).toBe(critical.id)
    })
    it('the header pill reads "OPEN NOTICE" instead of "SECURE / All systems operational"; the bell names the session and the cause as a detail and tells a non-supervisor who closes it', async () => {
      mount('/security-audit', 'idle', (sim) => sim.store.setState({ alerts: [SEAL_UNSEALABLE_EXAMPLE_ALERT] }))
      const pill = await page('secure-pill')
      await waitFor(() => expect(pill).toHaveAttribute('data-open-notice', 'true'), FIND)
      expect(pill).toHaveTextContent(L.notice.pillLabel)
      expect(pill).not.toHaveTextContent(en.shell.securePill.SECURE.subtitle)
      fireEvent.click(screen.getByTestId('notifications-bell'))
      const row = await page(`alert-unsealable-${SEAL_UNSEALABLE_EXAMPLE_ALERT.id}`)
      expect(within(row).getByTestId(`alert-unsealable-sentence-${SEAL_UNSEALABLE_EXAMPLE_ALERT.id}`)).toHaveTextContent(SEAL_UNSEALABLE_PLAIN_SENTENCE)
      // No code in brackets in the sentence (G75d-04); the code is its own detail.
      expect(row).not.toHaveTextContent('(SESSION_KEY_NOT_OF_SESSION)')
      expect(row).toHaveTextContent(SEAL_UNSEALABLE_EXAMPLE_SESSION_ID)
      expect(row).toHaveTextContent('Cause code: SESSION_KEY_NOT_OF_SESSION')
      // BUDI is the investigator: no control, the sentence says who can.
      expect(within(row).queryByTestId(`alert-unsealable-acknowledge-${SEAL_UNSEALABLE_EXAMPLE_ALERT.id}`)).toBeNull()
      expect(within(row).getByTestId(`alert-unsealable-who-${SEAL_UNSEALABLE_EXAMPLE_ALERT.id}`)).toHaveTextContent(L.notice.closeBySupervisor)
      expect(getMissingI18nKeys()).toEqual([])
    })
    it('a supervisor acknowledges it from the bell: the alert is resolved and the pill is back', async () => {
      const sim = mount('/security-audit', 'idle', (prepared) => prepared.store.setState({ alerts: [{ ...SEAL_UNSEALABLE_EXAMPLE_ALERT, acknowledged: true }] }), OPERATOR_IDS.ANDI)
      const pill = await page('secure-pill')
      await waitFor(() => expect(pill).toHaveAttribute('data-open-notice', 'true'), FIND)
      fireEvent.click(screen.getByTestId('notifications-bell'))
      const button = await page(`alert-unsealable-acknowledge-${SEAL_UNSEALABLE_EXAMPLE_ALERT.id}`)
      await act(async () => {
        fireEvent.click(button)
      })
      await waitFor(() => expect(openUnsealableNoticesOf(sim.store.getState())).toHaveLength(0), FIND)
      expect(sim.store.getState().alerts.find((alert) => alert.id === SEAL_UNSEALABLE_EXAMPLE_ALERT.id)).toMatchObject({ active: false, acknowledged: true })
      await waitFor(() => expect(pill).not.toHaveAttribute('data-open-notice'), FIND)
    })
    it('CONTROL - no notice: the pill is the system\'s own state', async () => {
      mount('/security-audit', 'idle')
      const pill = await page('secure-pill')
      await waitFor(() => expect(pill).toHaveAttribute('data-state', 'SECURE'), FIND)
      expect(pill).not.toHaveAttribute('data-open-notice')
    })
    it('Dashboard ring: an open notice is said on it; a blocked seal makes it critical - never "READY ... ready for recording"', async () => {
      mount('/dashboard', 'idle', (sim) => sim.store.setState({ alerts: [SEAL_UNSEALABLE_EXAMPLE_ALERT] }))
      const line = await page('ring-status-line')
      await waitFor(() => expect(line).toHaveTextContent(L.notice.ringSub), FIND)
      expect(line.closest('[data-open-notice]')).not.toBeNull()
      cleanup()
      mount('/dashboard', 'finalizing', blocked)
      const blockedLine = await page('ring-status-line')
      await waitFor(() => expect(blockedLine).toHaveTextContent(L.notice.blockedRingSub), FIND)
      expect(blockedLine.closest('[data-seal-blocked]')).not.toBeNull()
      expect(blockedLine.closest('.dems-dash-ring-cell')).not.toHaveTextContent(en.dashboard.systemRing.caption.READY)
    })
    // Fix wave M (G75e-04, ruling D234 (1)): beside an open notice the ring of a RECORDING session read "SECURE • HEALTHY • RECORDING".
    it('G75e-04: the ring states the open notice ALSO while a session records beside it - never "SECURE • HEALTHY • RECORDING"', async () => {
      mount('/dashboard', 'recording', (sim) => {
        realCore(sim)
        sim.store.setState({ alerts: [SEAL_UNSEALABLE_EXAMPLE_ALERT] })
      })
      const line = await page('ring-status-line')
      await waitFor(() => expect(line).toHaveTextContent(M.ring.noticeRecording), FIND)
      const cell = line.closest('.dems-dash-ring-cell')!
      expect(cell).toHaveAttribute('data-open-notice', 'true')
      expect(cell).not.toHaveTextContent('SECURE')
      expect(cell).not.toHaveTextContent('HEALTHY')
      // The sentence of the notice, with its session, beside the recording.
      expect(cell).toHaveTextContent(L.notice.ringDetail_one.replace('{{sessionId}}', SEAL_UNSEALABLE_EXAMPLE_SESSION_ID))
      expect(getMissingI18nKeys()).toEqual([])
    })
    it('G75e-04, controls: a recording with no notice - a Core that reports no posture claims none; the simulated lane keeps its line', async () => {
      mount('/dashboard', 'recording', realCore)
      const line = await page('ring-status-line')
      await waitFor(() => expect(line).toHaveTextContent(M.ring.recordingFlags), FIND)
      expect(line).not.toHaveTextContent('SECURE')
      expect(line.closest('[data-open-notice]')).toBeNull()
      cleanup()
      mount('/dashboard', 'recording')
      const simulated = await page('ring-status-line')
      await waitFor(() => expect(simulated).toHaveTextContent(en.dashboard.systemRing.statusLine.RECORDING), FIND)
    })
    // Fix wave M (G75e-06 (a), ruling D234 (3)): during the automatic seal retries (up to 155 s) the pill read "SECURE / All systems operational".
    it('G75e-06: while the Core retries a seal by itself the header pill and the Dashboard ring say so', async () => {
      mount('/dashboard', 'finalizing', retrying)
      const pill = await page('secure-pill')
      await waitFor(() => expect(pill).toHaveAttribute('data-seal-retrying', 'true'), FIND)
      expect(pill).toHaveAttribute('data-state', 'ATTENTION')
      expect(pill).toHaveTextContent(M.pill.retryLabel)
      expect(pill).toHaveTextContent(M.pill.retrySub)
      expect(pill).not.toHaveTextContent(en.shell.securePill.SECURE.subtitle)
      expect(pill).not.toHaveAttribute('data-open-notice')
      const line = await page('ring-status-line')
      await waitFor(() => expect(line).toHaveTextContent(M.ring.retrySub), FIND)
      const cell = line.closest('.dems-dash-ring-cell')!
      expect(cell).toHaveAttribute('data-seal-retrying', 'true')
      expect(cell).toHaveTextContent(M.ring.retryDetail.replace('{{sessionId}}', SEAL_BLOCKED_EXAMPLE_SESSION_ID))
      expect(cell).not.toHaveTextContent(en.dashboard.systemRing.caption.READY)
      expect(getMissingI18nKeys()).toEqual([])
    })
    it('G75e-06: the retry RUN itself (the failed step reads `active` again, at attempt 2) is the same state - seen live as "SECURE" for the length of each run', () => {
      const base = newSim('finalizing').store.getState()
      const session = base.session!
      const running = (attempt: number, own: boolean) => ({ ...base, alerts: [], session: { ...session, state: 'FINALIZING', finalization: { ...session.finalization, steps: session.finalization.steps.map((step, index) => ({ ...step, status: index === 0 ? 'active' : 'pending', attempt })) }, ...(own ? { captureDurable: true } : {}) } }) as SimState
      expect(sealRetryingSessionOf(running(2, true))).toBe(session.id)
      // The first run; the simulator's own session (there the attempt grows on a recovery alone); a blocked seal (CRITICAL by its alert).
      expect(sealRetryingSessionOf(running(1, true))).toBeNull()
      expect(sealRetryingSessionOf(running(2, false))).toBeNull()
      const blockedState = newSim('finalizing')
      blocked(blockedState)
      expect(sealRetryingSessionOf(blockedState.store.getState())).toBeNull()
      expect(sealRetryingSessionOf({ ...base, session: null })).toBeNull()
    })
    it('G75e-06, control: a seal that simply runs leaves the pill the system\'s own state', async () => {
      mount('/dashboard', 'finalizing')
      const pill = await page('secure-pill')
      await waitFor(() => expect(pill).toHaveAttribute('data-state', 'SECURE'), FIND)
      expect(pill).not.toHaveAttribute('data-seal-retrying')
      expect((await page('ring-status-line')).closest('[data-seal-retrying]')).toBeNull()
    })
  })

  /** A seal whose first step failed once and is run again by the Core: no blocked notice yet (the shape of `sealAttentionOf`: RETRYING). */
  function retrying(sim: Sim): void {
    const session = sim.store.getState().session!
    const steps = SEAL_BLOCKED_EXAMPLE_FINALIZATION.steps.map((step, index) => (index === 0 ? { ...step, attempt: 2, detail: "Sealing is being retried (retry 1 of 3, in 5 s). The Core's key store cannot be used: the seal stopped and can be tried again." } : { ...step, attempt: 2 }))
    sim.store.setState({
      session: { ...session, id: SEAL_BLOCKED_EXAMPLE_SESSION_ID, state: 'FINALIZING', finalization: { ...SEAL_BLOCKED_EXAMPLE_FINALIZATION, steps }, captureDurable: true } as typeof session,
      alerts: [],
    })
  }

  function blocked(sim: Sim): void {
    const session = sim.store.getState().session!
    sim.store.setState({
      session: { ...session, id: SEAL_BLOCKED_EXAMPLE_SESSION_ID, state: 'FINALIZING', finalization: SEAL_BLOCKED_EXAMPLE_FINALIZATION, captureDurable: true } as typeof session,
      alerts: [SEAL_BLOCKED_EXAMPLE_ALERT],
    })
  }

  describe('G75d-02: the retry of a blocked seal', () => {
    it('the contract: an investigator and a supervisor may send operation 33, a technician may not; three automatic retries', () => {
      expect(canRetryBlockedSeal('INVESTIGATOR')).toBe(true)
      expect(canRetryBlockedSeal('SUPERVISOR')).toBe(true)
      expect(canRetryBlockedSeal('TECHNICIAN')).toBe(false)
      expect(SEAL_AUTOMATIC_RETRIES).toBe(3)
    })
    it('the Monitor banner and the seal dialog offer "Retry sealing" to a role that may retry, with the two true sentences', async () => {
      const sim = mount('/session', 'finalizing', blocked)
      const recover = vi.spyOn(sim.actions, 'recover')
      const banner = await page('sm-status-banner')
      await waitFor(() => expect(banner).toHaveAttribute('data-seal', 'BLOCKED'), FIND)
      const stopped = L.sealRetry.stopped.replace('{{count}}', String(SEAL_AUTOMATIC_RETRIES))
      expect(banner).toHaveTextContent(stopped)
      expect(banner).toHaveTextContent(L.sealRetry.whoCan)
      expect(within(banner).getByTestId('sm-seal-retry-banner')).toBeEnabled()
      const dialog = await page('sm-seal-attention')
      expect(dialog).toHaveTextContent(stopped)
      expect(dialog).toHaveTextContent(L.sealRetry.whoCan)
      await act(async () => {
        fireEvent.click(within(dialog).getByTestId('sm-seal-retry-dialog'))
      })
      expect(recover).toHaveBeenCalledTimes(1)
      expect(getMissingI18nKeys()).toEqual([])
    })
    it('a role that may not retry gets no control and reads who can', async () => {
      mount('/session', 'finalizing', blocked, OPERATOR_IDS.RINA)
      const banner = await page('sm-status-banner')
      await waitFor(() => expect(banner).toHaveAttribute('data-seal', 'BLOCKED'), FIND)
      for (const control of screen.getAllByTestId('sm-seal-retry')) {
        expect(control).toHaveAttribute('data-may-retry', 'false')
        expect(control).toHaveTextContent(L.sealRetry.whoCan)
      }
      expect(screen.queryByTestId('sm-seal-retry-banner')).toBeNull()
      expect(screen.queryByTestId('sm-seal-retry-dialog')).toBeNull()
    })
    it('CONTROL - a seal that runs offers no retry', async () => {
      mount('/session', 'finalizing')
      await page('sm-status-banner')
      expect(screen.queryByTestId('sm-seal-retry')).toBeNull()
    })
  })

  describe('G75d-04: the unsealable end', () => {
    it('the cause of ONE session, read from its own alert - open or already acknowledged; another session has none', () => {
      const state = { ...newSim('idle').store.getState(), alerts: [SEAL_UNSEALABLE_EXAMPLE_ALERT] }
      expect(selectUnsealableCause(SEAL_UNSEALABLE_EXAMPLE_SESSION_ID)(state)).toBe('SESSION_KEY_NOT_OF_SESSION')
      expect(selectUnsealableCause('SES-20261011-0043')(state)).toBeNull()
      expect(selectUnsealableCause(null)(state)).toBeNull()
      expect(selectUnsealableCause(SEAL_UNSEALABLE_EXAMPLE_SESSION_ID)({ ...state, alerts: [{ ...SEAL_UNSEALABLE_EXAMPLE_ALERT, active: false, acknowledged: true }] })).toBe('SESSION_KEY_NOT_OF_SESSION')
    })
    it('the dialog of a session that ended unsealable: one terminal sentence, the cause as a detail - no "Finalizing", no percentage, no steps, no "Resumed after restart"', async () => {
      const sim = mount('/session', 'finalizing', (prepared) => {
        const session = prepared.store.getState().session!
        // Two failed attempts on the Core: the web's own attempt counter is above 1 (what drew "Resumed after restart").
        prepared.store.setState({ session: { ...session, id: SEAL_UNSEALABLE_EXAMPLE_SESSION_ID, finalization: { ...session.finalization, steps: session.finalization.steps.map((step, index) => (index === 0 ? { ...step, attempt: 3 } : step)) } } as typeof session })
      })
      await page('sm-final-progress')
      // The Core ends the session: it is gone from the state, and its alert is there.
      await act(async () => {
        sim.store.setState({ session: null, alerts: [SEAL_UNSEALABLE_EXAMPLE_ALERT] })
      })
      const notice = await page('sm-unsealable')
      expect(within(notice).getByTestId('sm-unsealable-sentence')).toHaveTextContent(SEAL_UNSEALABLE_PLAIN_SENTENCE)
      expect(notice).not.toHaveTextContent('(SESSION_KEY_NOT_OF_SESSION)')
      expect(within(notice).getByTestId('sm-unsealable-cause')).toHaveTextContent('Cause code: SESSION_KEY_NOT_OF_SESSION')
      const dialog = notice.closest('[role=dialog]')!
      expect(dialog).toHaveTextContent(L.unsealableEnd.title)
      expect(dialog).not.toHaveTextContent(en.session.finalization.title)
      expect(within(dialog as HTMLElement).queryByTestId('sm-final-progress')).toBeNull()
      expect(within(dialog as HTMLElement).queryByTestId('sm-final-resumed')).toBeNull()
      expect(dialog).not.toHaveTextContent(en.session.finalization.resumed)
      expect(dialog).not.toHaveTextContent('% complete')
      expect(dialog.querySelector('.sm-final-stepper')).toBeNull()
    })
  })
})
