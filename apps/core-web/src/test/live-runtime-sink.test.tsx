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

  // Task 3 blueprint row 113 (C3 §2.5; SEC35-14; E-31): the STT server credential has no prefix of
  // this product, so the list blanks it by where it stands. One of the two log-blanking lists; the
  // other is the mobile runtime log, which holds the same forms.
  it('the STT credential forms are blanked: after Bearer, under a credential-named member, and the write-only credential of updateSttConfig', () => {
    // Synthetic markers, built from parts: nothing here is a real key.
    const KEY = ['sk', 'MARKER', 'stt', 'K3y.9f8e/7d='].join('-')
    const REF = ['omlx-settings', 'auth.MARKER_ref'].join(':')
    expect(redactCredentials(`Authorization: Bearer ${KEY}`)).not.toContain('MARKER')
    expect(redactCredentials(`Bearer ${KEY} was refused`)).toBe('Bearer *** was refused')
    expect(redactCredentials(`{"apiKey":"${KEY}","model":"m"}`)).toBe('{"apiKey":"***","model":"m"}')
    expect(redactCredentials(`api_key=${KEY}&x=1`)).toBe('api_key=***&x=1')
    expect(redactCredentials(`credentialRef: ${REF}, next`)).toBe('credentialRef: ***, next')
    expect(redactCredentials(`{"revision":1,"credential":{"kind":"SECRET","value":"${KEY} with spaces"}}`)).toBe('{"revision":1,"credential":{"kind":"SECRET","value":"***"}}')
    expect(redactCredentials(`{"credential":{"kind":"REFERENCE","ref":"${REF}"}}`)).toBe('{"credential":{"kind":"REFERENCE","ref":"***"}}')
    // A token of this server keeps its own rule, and prose is left alone.
    expect(redactCredentials('Bearer ses_Abc-123_xyz')).toBe('Bearer ses_***')
    expect(redactCredentials('a bearer of news; the secret of success; credentialSet: true, credentialKind: REFERENCE')).toBe(
      'a bearer of news; the secret of success; credentialSet: true, credentialKind: REFERENCE',
    )

    const log = quietConsole()
    const sink = createErrorSink({ dev: true, console: log })
    sink.report({
      level: 'error',
      source: 'live.action.updateSttConfig',
      message: `refused: {"credential":{"kind":"SECRET","value":"${KEY}"}}`,
      stack: `Error: fetch failed with Authorization: Bearer ${KEY}\n    at call`,
      at: 1,
      context: { apiKey: KEY, credential: { kind: 'SECRET', value: KEY }, authorization: `Bearer ${KEY}`, nested: { credentialRef: REF, note: `api_key=${KEY}` }, status: 503 },
    })
    const text = JSON.stringify([sink.records(), log.error.mock.calls])
    expect(text).not.toContain('MARKER')
    expect(sink.records()[0]?.context).toEqual({ apiKey: '***', credential: '***', authorization: '***', nested: { credentialRef: '***', note: 'api_key=***' }, status: 503 })
    // Negative control: the same search finds the marker in what was GIVEN to the sink.
    expect(JSON.stringify({ apiKey: KEY })).toContain('MARKER')
  })

  // Fix round 1, navigator finding N-1: the forms the first list let through. Every one of them
  // must lose the marker; none may throw.
  const N1_KEY = ['NAV', 'MARKER', '7f3a', 'Zq9Lm2Xw8Rt5'].join('-')
  const N1_REF = ['navstore', 'MARKER/zz9.key'].join(':')
  const N1_FORMS: ReadonlyArray<readonly [string, string]> = [
    ['members in the other order (SECRET)', `{"revision":1,"credential":{"value":"${N1_KEY}","kind":"SECRET"}}`],
    ['members in the other order (REFERENCE)', `{"revision":1,"credential":{"ref":"${N1_REF}","kind":"REFERENCE"}}`],
    ['bare object in the other order', `sent {"value":"${N1_KEY}","kind":"SECRET"} to the Core`],
    ['JSON inside a JSON string', JSON.stringify(JSON.stringify({ credential: { kind: 'SECRET', value: N1_KEY } }))],
    ['JSON inside a JSON string, twice', JSON.stringify(JSON.stringify(JSON.stringify({ credential: { kind: 'REFERENCE', ref: N1_REF } })))],
    ['a value holding a double quote', `{"credential":{"kind":"SECRET","value":"pre\\"${N1_KEY}"}}`],
    ['a value holding an apostrophe', `{"credential":{"kind":"SECRET","value":"it's ${N1_KEY}"}}`],
    ['an apostrophe-quoted value holding a double quote', `{ kind: 'SECRET', value: 'a"${N1_KEY}' }`],
    ['credential as a text member', `{"credential":"${N1_KEY}"}`],
    ['credential=', `credential=${N1_KEY}`],
    ['a dotted path to the member', `body.credential.value=${N1_KEY}`],
    ['a query string', `kind=SECRET&value=${N1_KEY}`],
    ['a query string in the other order', `value=${N1_KEY}&kind=SECRET`],
    ['value: beside its kind', `kind: SECRET, value: ${N1_KEY}`],
    ['a secret of two words', `{"secret":"two words ${N1_KEY}"}`],
    ['authorization with another scheme', `authorization: Basic ${N1_KEY}`],
    ['authorization in JSON with another scheme', `{"authorization":"Basic ${N1_KEY}"}`],
    ['x-api-key header', `x-api-key: ${N1_KEY}`],
    ['an unterminated value', `{"credential":{"kind":"SECRET","value":"${N1_KEY}`],
  ]

  it.each(N1_FORMS)('N-1: %s is blanked', (_name, text) => {
    const blanked = redactCredentials(text)
    expect(blanked).not.toContain('MARKER')
    expect(blanked).not.toContain('Zq9Lm2Xw8Rt5')
    expect(blanked).toContain('***')
  })

  it('N-1: text that only looks alike is left alone', () => {
    for (const text of [
      'credentialSet: true, credentialKind: REFERENCE',
      'the kind of value we expect; a reference value: 42',
      'the secretary said so; a secret of success',
      'value: 42, ref: main',
      '{"kind":"PACKAGE","value":"EXPJ-000001"}',
    ]) expect(redactCredentials(text)).toBe(text)
  })

  it('N-1: a context is blanked by key name at ANY depth, a value or ref beside a credential kind too, and what is too deep to walk is blanked whole', () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: { credential: N1_KEY, note: 'kept' } } } } } } } }
    // Deeper than the walk goes (CREDENTIAL_WALK_DEPTH): never returned as it came, whatever its members are called.
    let abyss: Record<string, unknown> = { plain: N1_KEY }
    for (let level = 0; level < 20; level += 1) abyss = { next: abyss }
    const sink = createErrorSink({ dev: true, console: quietConsole() })
    sink.report({
      level: 'error',
      source: 'test',
      message: 'refused',
      at: 1,
      context: {
        deep,
        abyss,
        write: { kind: 'SECRET', value: N1_KEY },
        pointer: { ref: N1_REF, kind: 'REFERENCE' },
        list: [{ value: N1_KEY, kind: 'SECRET' }],
        headers: { 'X-Api-Key': N1_KEY, Authorization: `Basic ${N1_KEY}` },
        job: { kind: 'PACKAGE', value: 'EXPJ-000001' },
        status: 503,
      },
    })
    const text = JSON.stringify(sink.records())
    expect(text).not.toContain('MARKER')
    const context = sink.records()[0]?.context as Record<string, unknown>
    expect(JSON.stringify(context['deep'])).toBe('{"a":{"b":{"c":{"d":{"e":{"f":{"g":{"credential":"***","note":"kept"}}}}}}}}')
    expect(JSON.stringify(context['abyss'])).toMatch(/"next":"\*\*\*"\}+$/)
    expect(context['write']).toEqual({ kind: 'SECRET', value: '***' })
    expect(context['pointer']).toEqual({ ref: '***', kind: 'REFERENCE' })
    expect(context['headers']).toEqual({ 'X-Api-Key': '***', Authorization: '***' })
    // A value beside a kind that is no credential kind, and a plain member, are kept.
    expect(context['job']).toEqual({ kind: 'PACKAGE', value: 'EXPJ-000001' })
    expect(context['status']).toBe(503)
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
