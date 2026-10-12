/**
 * @vitest-environment jsdom
 * @vitest-environment-options { "url": "http://127.0.0.1:5178/" }
 */
// Fix wave J round three, driver J3-W (`contract_wave_j.md` J2-S 4; findings JW-22 remainder / JW-13):
// the Sessions page states WHY the seal of a quarantined session was given up, from the member
// `unsealableCause` of operation 38 BY NAME (exported example `SESSION_HISTORY_UNSEALABLE_ENTRY_EXAMPLE`).
// The page had no page test (round one tested its model): this is the page's own file, named after it.
//
// | Held | Where |
// |------|-------|
// | A Live console whose list holds a session in quarantine asks operation 38 ONCE and states the code on that row | "the member, by name" |
// | The slice entry carries no member: without the operation's answer the session's alert states it; with neither, the row says the Core states none | "fallback", "the read is refused" |
// | No session in quarantine: operation 38 is not asked | "CONTROL" |
import { cleanup, configure, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SESSION_HISTORY_UNSEALABLE_ENTRY_EXAMPLE } from '@dems/shared/api'
import { SEAL_UNSEALABLE_EXAMPLE_ALERT, type SessionHistoryEntry, type SimAlert } from '@dems/shared/sim'
import { SHELL_INTRO_STORAGE_KEY } from '@/components/shell/shell-entrance'
import { getMissingI18nKeys, resetMissingI18nKeys } from '@/i18n'
import { resetCoreErrorPresenter } from '@/lib/core-errors'
import { webErrorSink } from '@/runtime'
import { createLiveTestBed, SUPERVISOR_SESSION, type LiveTestBed } from '@/runtime/testing/live-harness'

configure({ asyncUtilTimeout: 8_000 })
vi.setConfig({ testTimeout: 30_000 })

const EXAMPLE = SESSION_HISTORY_UNSEALABLE_ENTRY_EXAMPLE
/** The session as the replicated slice holds it: the member has no column there. */
const { unsealableCause: _member, ...WITHOUT_MEMBER } = EXAMPLE
const SLICE_ENTRY = WITHOUT_MEMBER as unknown as SessionHistoryEntry

let bed: LiveTestBed | undefined
const requests = (operationId: string) => bed!.fake.log.requestsOf(operationId)
const records = (source: string) => webErrorSink.records().filter((record) => record.source === source)

async function liveSessions(prepare: (bed: LiveTestBed) => void): Promise<LiveTestBed> {
  const created = createLiveTestBed({ session: SUPERVISOR_SESSION })
  bed = created
  prepare(created)
  const page = await created.load()
  await created.mount(page, '/session/history')
  await screen.findByTestId('page-sessions')
  return created
}

const quarantined = (created: LiveTestBed, alerts: SimAlert[] = []): void => {
  created.core.served = { ...created.core.served, sessionHistory: [SLICE_ENTRY, ...created.core.served.sessionHistory], alerts }
}

beforeEach(() => {
  resetMissingI18nKeys()
  resetCoreErrorPresenter()
  webErrorSink.clear()
  window.sessionStorage.clear()
  window.sessionStorage.setItem(SHELL_INTRO_STORAGE_KEY, '1')
})

afterEach(() => {
  cleanup()
  bed?.dispose()
  bed = undefined
  vi.restoreAllMocks()
})

describe('Sessions page: why a seal was given up (operation 38 `unsealableCause`)', () => {
  it('the member, by name: one GET of operation 38; the quarantined row states the code the Core recorded', async () => {
    await liveSessions((created) => {
      quarantined(created)
      created.fake.answer('listSessionHistory', () => created.fake.example('listSessionHistory', 200, 'unsealable'))
    })
    const row = await screen.findByTestId(`session-row-${EXAMPLE.id}`)
    expect(row).toHaveAttribute('data-state', 'QUARANTINED')
    await waitFor(() => expect(within(row).getByTestId('session-unsealable-cause')).toHaveAttribute('data-cause', EXAMPLE.unsealableCause))
    // Fix wave Q (JW-13), pin moved: the cause in words first, the Core's code after them.
    expect(EXAMPLE.unsealableCause).toBe('SIGNING_KEY_UNAVAILABLE')
    expect(within(row).getByTestId('session-unsealable-cause')).toHaveTextContent('Why it could not be sealed: Signing key unavailable (the code the Core recorded: SIGNING_KEY_UNAVAILABLE)')
    expect(requests('listSessionHistory')).toHaveLength(1)
    expect(requests('listSessionHistory')[0]).toMatchObject({ method: 'GET' })
    // The page still says what became of the recording and what to do.
    expect(within(row).getByTestId('session-state-detail')).toHaveTextContent('quarantine folder of the Core')
    expect(screen.getByTestId('sessions-quarantine-note')).toBeInTheDocument()
    // No other row carries a cause line.
    expect(screen.getAllByTestId('session-unsealable-cause')).toHaveLength(1)
    expect(getMissingI18nKeys()).toEqual([])
  })

  it('fallback: the Core\'s answer carries no member for the session - its alert states the cause (the shared reader)', async () => {
    const alert: SimAlert = { ...SEAL_UNSEALABLE_EXAMPLE_ALERT, target: EXAMPLE.id, params: { ...SEAL_UNSEALABLE_EXAMPLE_ALERT.params, sessionId: EXAMPLE.id, cause: 'NOTHING_SEALABLE' } }
    await liveSessions((created) => quarantined(created, [alert]))
    const row = await screen.findByTestId(`session-row-${EXAMPLE.id}`)
    await waitFor(() => expect(requests('listSessionHistory')).toHaveLength(1))
    expect(within(row).getByTestId('session-unsealable-cause')).toHaveAttribute('data-cause', 'NOTHING_SEALABLE')
  })

  it('the read is refused and no alert names the session: the row says the Core states no cause code; ONE record, no guess', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    await liveSessions((created) => {
      quarantined(created)
      created.fake.answer('listSessionHistory', () => created.fake.example('listSessionHistory', 403, 'originNotAllowed'))
    })
    const row = await screen.findByTestId(`session-row-${EXAMPLE.id}`)
    await waitFor(() => expect(records('Sessions.listSessionHistory')).toHaveLength(1))
    expect(within(row).getByTestId('session-unsealable-cause')).toHaveTextContent('The Core states no cause code for this session.')
    expect(within(row).getByTestId('session-unsealable-cause')).toHaveAttribute('data-cause', '')
    expect(records('Sessions.listSessionHistory')[0]?.context).toMatchObject({ operation: 'listSessionHistory', status: 403, sessions: 1 })
  })

  it('CONTROL - no session in quarantine: operation 38 is not asked and no row carries a cause line', async () => {
    await liveSessions(() => undefined)
    expect(screen.queryByTestId('sessions-quarantine-note')).toBeNull()
    expect(screen.queryByTestId('session-unsealable-cause')).toBeNull()
    expect(requests('listSessionHistory')).toHaveLength(0)
  })
})
