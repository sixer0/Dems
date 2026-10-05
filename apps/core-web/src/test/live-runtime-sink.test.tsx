// Plan row W50: where the reports of the Live layer go in the web console (brief list rows 5 and 6
// of implementation/44_live_source.md §17.4; P19: no credential in a log).
//
// | Rule | Where it is proven here |
// |------|-------------------------|
// | Every report is kept in the page's own log, the newest `ERROR_SINK_CAPACITY` of them | "the page's own log" |
// | In a dev build a report is loud: `console.error` for level `error`, `console.warn` for `warn` | "the console" |
// | Never the network, never web storage | "never leaves the page" |
// | A value with a credential prefix is blanked | "credentials" |
// | A Live result that is read as a value, and a subscriber that throws, reach the console (row 5) | "the Live source's own reports" |
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthStatus, selectAuth } from '@dems/shared/sim'
import { createErrorSink, ERROR_SINK_CAPACITY, redactCredentials, webErrorSink } from '@/runtime/error-sink'
import { createLiveTestBed, SUPERVISOR_SESSION, type LiveTestBed } from '@/runtime/testing/live-harness'

let bed: LiveTestBed | undefined

afterEach(() => {
  bed?.dispose()
  bed = undefined
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const quietConsole = () => ({ error: vi.fn(), warn: vi.fn() })

describe('the page\'s own log', () => {
  it('keeps what it is given, oldest first, and hands out a copy', () => {
    const sink = createErrorSink({ dev: false })
    sink.report({ level: 'warn', source: 'live.action.archiveEvidence', message: 'first', at: 1 })
    sink.report({ level: 'error', source: 'live.misuse', message: 'second', at: 2, stack: 'at somewhere', context: { action: 'verify' } })
    expect(sink.records()).toEqual([
      { level: 'warn', source: 'live.action.archiveEvidence', message: 'first', at: 1 },
      { level: 'error', source: 'live.misuse', message: 'second', at: 2, stack: 'at somewhere', context: { action: 'verify' } },
    ])
    const copy = sink.records() as unknown[]
    copy.length = 0
    expect(sink.records()).toHaveLength(2)
    sink.clear()
    expect(sink.records()).toEqual([])
  })

  it('is bounded: the newest 200 records stay', () => {
    expect(ERROR_SINK_CAPACITY).toBe(200)
    const sink = createErrorSink({ dev: false })
    for (let n = 1; n <= ERROR_SINK_CAPACITY + 3; n += 1) sink.report({ level: 'warn', source: 'test', message: `report ${n}`, at: n })
    const records = sink.records()
    expect(records).toHaveLength(ERROR_SINK_CAPACITY)
    expect(records[0]?.message).toBe('report 4')
    expect(records[records.length - 1]?.message).toBe(`report ${ERROR_SINK_CAPACITY + 3}`)
    const small = createErrorSink({ dev: false, capacity: 2 })
    for (const message of ['a', 'b', 'c']) small.report({ level: 'warn', source: 'test', message, at: 0 })
    expect(small.records().map((record) => record.message)).toEqual(['b', 'c'])
  })
})

describe('the console (dev builds; Live mode exists only there)', () => {
  it('an `error` report goes to console.error and a `warn` report to console.warn, each once, with the record', () => {
    const log = quietConsole()
    const sink = createErrorSink({ dev: true, console: log })
    sink.report({ level: 'error', source: 'live.subscriber', message: 'a subscriber threw', at: 5 })
    sink.report({ level: 'warn', source: 'live.action.signOut', message: 'refused', at: 6 })
    expect(log.error.mock.calls).toEqual([['[core-web] live', { level: 'error', source: 'live.subscriber', message: 'a subscriber threw', at: 5 }]])
    expect(log.warn.mock.calls).toEqual([['[core-web] live', { level: 'warn', source: 'live.action.signOut', message: 'refused', at: 6 }]])
  })

  it('a build that is not a dev build keeps the record and prints nothing', () => {
    const log = quietConsole()
    const sink = createErrorSink({ dev: false, console: log })
    sink.report({ level: 'error', source: 'live.owed', message: 'the storage could not be read', at: 1 })
    expect(sink.records()).toHaveLength(1)
    expect(log.error).not.toHaveBeenCalled()
    expect(log.warn).not.toHaveBeenCalled()
  })

  it('never fails its caller: a console that throws is contained, and the record is kept', () => {
    const sink = createErrorSink({
      dev: true,
      console: {
        error: () => {
          throw new Error('the console is gone')
        },
        warn: () => undefined,
      },
    })
    expect(() => sink.report({ level: 'error', source: 'test', message: 'kept', at: 1 })).not.toThrow()
    expect(sink.records().map((record) => record.message)).toEqual(['kept'])
  })

  it('the page\'s sink is a dev sink under the test runner', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    webErrorSink.report({ level: 'error', source: 'test.webErrorSink', message: 'loud', at: 1 })
    expect(error).toHaveBeenCalledTimes(1)
    expect(webErrorSink.records().some((record) => record.source === 'test.webErrorSink')).toBe(true)
    webErrorSink.clear()
  })
})

describe('never leaves the page', () => {
  it('a report causes no request and writes nothing to web storage', () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const before = { local: { ...window.localStorage }, session: { ...window.sessionStorage } }
    const sink = createErrorSink({ dev: true, console: quietConsole() })
    for (let n = 0; n < 5; n += 1) sink.report({ level: 'error', source: 'live.action.createSession', message: 'refused', at: n, context: { status: 403 } })
    expect(fetchSpy).not.toHaveBeenCalled()
    expect({ local: { ...window.localStorage }, session: { ...window.sessionStorage } }).toEqual(before)
  })
})

describe('credentials', () => {
  it('a value with one of the three token prefixes is blanked: in the message, the stack and the context, at any depth', () => {
    expect(redactCredentials('Bearer ses_Abc-123_xyz and dvc_9f8e7d and bio_token42.')).toBe('Bearer ses_*** and dvc_*** and bio_***.')
    expect(redactCredentials('a word like uses_this or studio_x is left alone')).toBe('a word like uses_this or studio_x is left alone')
    const log = quietConsole()
    const sink = createErrorSink({ dev: true, console: log })
    sink.report({
      level: 'error',
      source: 'test',
      message: 'the header was Bearer ses_marker-TOKEN-1',
      stack: 'Error: dvc_marker-credential-2\n    at call',
      at: 1,
      context: { header: 'ses_marker-TOKEN-3', nested: { list: ['bio_marker-4', 7, null] }, status: 401 },
    })
    const text = JSON.stringify([sink.records(), log.error.mock.calls])
    expect(text).not.toContain('marker')
    expect(sink.records()[0]).toEqual({
      level: 'error',
      source: 'test',
      message: 'the header was Bearer ses_***',
      stack: 'Error: dvc_***\n    at call',
      at: 1,
      context: { header: 'ses_***', nested: { list: ['bio_***', 7, null] }, status: 401 },
    })
  })
})

describe('the Live source\'s own reports reach the sink (brief list rows 5 and 6)', () => {
  it('a Live result that is read as a value is loud: `live.misuse`, level `error`, on console.error', async () => {
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
    const log = quietConsole()
    const sink = createErrorSink({ dev: true, console: log })
    const page = await bed.load({ sink })
    // A call site that treats the Live result as the simulator's value (finding CPC1-4).
    bed.fake.answer('verifyAuditChain', bed.fake.example('verifyAuditChain'))
    const result = page.live.actions.verifyAuditChain() as unknown as { ok?: boolean }
    void result.ok
    await bed.flush()
    const misuse = sink.records().filter((record) => record.source === 'live.misuse')
    // READ_AS_VALUE is an error; the same call was observed by nobody, which is a warning (NOT_OBSERVED).
    expect(misuse.map((record) => record.level).sort()).toEqual(['error', 'warn'])
    const read = misuse.find((record) => record.level === 'error')
    expect(read?.message).toContain('verifyAuditChain')
    expect(read?.message).toContain('was read as a value')
    expect(log.error.mock.calls.filter(([, record]) => (record as { source?: string }).source === 'live.misuse')).toHaveLength(1)
    expect(log.warn.mock.calls.filter(([, record]) => (record as { source?: string }).source === 'live.misuse')).toHaveLength(1)
  })

  it('a store subscriber that throws is contained by the Live source and reported here: `live.subscriber`, level `error`', async () => {
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
    const log = quietConsole()
    const sink = createErrorSink({ dev: true, console: log })
    const page = await bed.load({ sink })
    page.live.store.subscribe(
      (state) => state.auth.status,
      () => {
        throw new Error('a subscriber outside React that throws')
      },
    )
    await page.live.actions.signOut('USER')
    await bed.flush()
    // The source went on: the session ended although the subscriber threw.
    expect(selectAuth(page.live.store.getState()).status).toBe(AuthStatus.SIGNED_OUT)
    const reports = sink.records().filter((record) => record.source === 'live.subscriber')
    expect(reports.length).toBeGreaterThanOrEqual(1)
    expect(reports[0]?.level).toBe('error')
    expect(log.error).toHaveBeenCalled()
  })

  it('an answer outside the contract is reported by the typed client through the same sink, by operation and status only', async () => {
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
    const sink = createErrorSink({ dev: false })
    const page = await bed.load({ sink })
    bed.fake.answerOnce('listUsers', { status: 200, body: { users: 'not a list', sessionToken: 'ses_marker-leak' }, violatesContract: true })
    const answer = await page.live.client.call('listUsers')
    await bed.flush()
    expect(answer).toMatchObject({ ok: false, kind: 'CONTRACT_VIOLATION' })
    const report = sink.records().find((record) => record.source === 'CoreClient.call')
    expect(report).toMatchObject({ context: { operationId: 'listUsers', method: 'GET', path: '/api/v1/admin/users', status: 200, kind: 'CONTRACT_VIOLATION' } })
    expect(JSON.stringify(sink.records())).not.toContain('marker')
  })
})
