// Plan row W50: the web console's storage of a sign-out the Core has not heard of (decisions D90,
// D100; brief list rows 2, 28, 29 and 33 of implementation/44_live_source.md §17.4).
//
// | Rule | Where it is proven here |
// |------|-------------------------|
// | All three calls of the port are synchronous; a `write` followed by a `read` in the same turn returns the debt | "the port" |
// | `read` of an absent key returns `null`; `read` of a text that does not parse THROWS; `clear` removes the key | "the port" |
// | The storage is probed ONCE, and NO port is passed when there is none | "the probe"; "without a usable storage" |
// | A reload cannot forget a Lock that was made while the Core was unreachable: the login screen, and one `signOut` with `reason: 'LOCK'` reaches the Core | "a Lock survives a reload" |
// | A second tab that reads a debt pays it rather than taking the session | "a new tab pays the debt" |
// | A stored text that cannot be read starts the page closed | "a start whose read fails is closed" |
// | Optional (row 29): the `storage` event of another tab's Lock ends this tab's session too | "another tab's Lock" |
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LiveOwedSignOut } from '@dems/shared/live/source'
import { AuthStatus, selectAuth, selectIsSignedIn } from '@dems/shared/sim'
import {
  createOwedSignOutPort,
  hasUsableStorage,
  operatorSignOutOf,
  OWED_SIGN_OUT_STORAGE_KEY,
  OwedSignOutUnreadableError,
  STORAGE_PROBE_KEY,
} from '@/runtime/owed-sign-out-storage'
import {
  createLiveTestBed,
  createMemoryStorage,
  INVESTIGATOR_SESSION,
  SUPERVISOR_SESSION,
  type LivePage,
  type LiveTestBed,
} from '@/runtime/testing/live-harness'

let bed: LiveTestBed | undefined

afterEach(() => {
  bed?.dispose()
  bed = undefined
})

const DEBT: LiveOwedSignOut = { operatorId: 'OPR-002', issuedAt: 1_790_823_300_000, reason: 'LOCK', at: 1_790_823_900_000 }
const KEY = OWED_SIGN_OUT_STORAGE_KEY

const isThenable = (value: unknown): boolean => typeof (value as { then?: unknown } | null | undefined)?.then === 'function'
const signedIn = (page: LivePage): boolean => selectIsSignedIn(page.live.store.getState())
const lockRequests = (test: LiveTestBed) => test.fake.log.requestsOf('signOut').map((call) => call.body)

describe('the port: three synchronous calls on the origin\'s localStorage', () => {
  it('a `write` followed by a `read` in the same turn returns the debt, and neither call returns a promise', () => {
    const storage = createMemoryStorage()
    const port = createOwedSignOutPort(storage)
    const written = port.write(DEBT)
    expect(isThenable(written)).toBe(false)
    const read = port.read()
    expect(isThenable(read)).toBe(false)
    expect(read).toEqual(DEBT)
    expect(storage.getItem(KEY)).toBe(JSON.stringify(DEBT))
  })

  it('`read` of an absent key returns `null`, and only then', () => {
    const storage = createMemoryStorage()
    const port = createOwedSignOutPort(storage)
    expect(port.read()).toBeNull()
    port.write(DEBT)
    expect(port.read()).not.toBeNull()
  })

  it('`read` of a text that does not parse THROWS, does not show the text, and leaves it where it is', () => {
    for (const text of ['{"operatorId":"OPR-002"', 'not json', '', 'undefined']) {
      const storage = createMemoryStorage({ [KEY]: text })
      const port = createOwedSignOutPort(storage)
      let thrown: unknown
      try {
        port.read()
      } catch (error) {
        thrown = error
      }
      expect(thrown, JSON.stringify(text)).toBeInstanceOf(OwedSignOutUnreadableError)
      expect((thrown as Error).message).toBe('The stored sign-out debt cannot be read (NOT_JSON).')
      expect(storage.getItem(KEY)).toBe(text)
    }
  })

  it('a stored JSON `null` is not "nothing stored": `read` throws', () => {
    const port = createOwedSignOutPort(createMemoryStorage({ [KEY]: 'null' }))
    expect(() => port.read()).toThrow(OwedSignOutUnreadableError)
    expect(() => port.read()).toThrow('JSON_NULL')
  })

  it('a storage that throws is not caught: the exception reaches the Live source', () => {
    const storage = createMemoryStorage()
    vi.spyOn(storage, 'getItem').mockImplementation(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError')
    })
    expect(() => createOwedSignOutPort(storage).read()).toThrow('The operation is insecure.')
  })

  it('a value that parses and is no debt is handed on as it is: the Live source decides', () => {
    for (const [text, value] of [
      ['{"foo":1}', { foo: 1 }],
      ['5', 5],
      ['"LOCK"', 'LOCK'],
      ['[]', []],
    ] as const) {
      expect(createOwedSignOutPort(createMemoryStorage({ [KEY]: text })).read()).toEqual(value)
    }
  })

  it('`write` stores exactly the four members of the debt and nothing else', () => {
    const storage = createMemoryStorage()
    const port = createOwedSignOutPort(storage)
    // What a caller might hand over by mistake never reaches the storage.
    port.write({ ...DEBT, sessionToken: 'ses_marker-token', cookie: 'dems_session_4423=marker' } as LiveOwedSignOut)
    const text = storage.getItem(KEY) ?? ''
    expect(Object.keys(JSON.parse(text) as object).sort()).toEqual(['at', 'issuedAt', 'operatorId', 'reason'])
    expect(text).not.toContain('marker')
    expect(storage.length).toBe(1)
    // A later debt replaces the earlier one.
    port.write({ ...DEBT, reason: 'USER' })
    expect(port.read()).toEqual({ ...DEBT, reason: 'USER' })
    expect(storage.length).toBe(1)
  })

  it('`clear` removes the key, synchronously', () => {
    const storage = createMemoryStorage()
    const port = createOwedSignOutPort(storage)
    port.write(DEBT)
    expect(isThenable(port.clear())).toBe(false)
    expect(storage.getItem(KEY)).toBeNull()
    expect(storage.length).toBe(0)
    expect(port.read()).toBeNull()
  })

  it('the key is the port\'s own, with a version', () => {
    expect(KEY).toBe('dems.live.owedSignOut.v1')
  })
})

describe('the probe (brief list row 28): is there a storage that keeps a value?', () => {
  it('a working storage passes, and the probe key does not stay', () => {
    const storage = createMemoryStorage({ other: 'kept' })
    expect(hasUsableStorage(storage)).toBe(true)
    expect(storage.getItem(STORAGE_PROBE_KEY)).toBeNull()
    expect(storage.getItem('other')).toBe('kept')
    expect(storage.length).toBe(1)
  })

  it('no storage, a storage that throws, and a storage that keeps nothing all fail', () => {
    expect(hasUsableStorage(null)).toBe(false)
    expect(hasUsableStorage(undefined)).toBe(false)
    const throwing = createMemoryStorage()
    vi.spyOn(throwing, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    expect(hasUsableStorage(throwing)).toBe(false)
    const forgetful = createMemoryStorage()
    vi.spyOn(forgetful, 'setItem').mockImplementation(() => undefined)
    expect(hasUsableStorage(forgetful)).toBe(false)
  })
})

describe('a Lock survives a reload (D90, CPC1-24; the fake-transport form of the lane check of row 33)', () => {
  it('a Lock while the Core is unreachable is stored before it is reported; after the reload the login screen is shown and ONE signOut LOCK reaches the Core', async () => {
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
    const page = await bed.load()
    expect(page.runtime.owedSignOutPersisted).toBe(true)
    const session = page.live.session
    if (session === null) throw new Error('the page is signed in')
    bed.core.unreachable()
    await bed.flush()

    // The debt is in the storage at the moment the end is reported.
    const storedAtTheEnd: (string | null)[] = []
    page.live.onSessionEnd(() => storedAtTheEnd.push(bed?.storage?.getItem(KEY) ?? null))
    await page.live.actions.signOut('LOCK')
    await bed.flush()
    expect(signedIn(page)).toBe(false)
    expect(page.live.lastSessionEnd).toMatchObject({ source: 'LOCAL', signOut: 'LOCK' })
    expect(storedAtTheEnd).toHaveLength(1)
    const stored = JSON.parse(storedAtTheEnd[0] ?? 'null') as LiveOwedSignOut
    expect(stored).toMatchObject({ operatorId: session.operator.id, issuedAt: session.issuedAt, reason: 'LOCK' })
    expect(Object.keys(stored).sort()).toEqual(['at', 'issuedAt', 'operatorId', 'reason'])
    // Nothing was sent: the Core has not heard of the Lock, and still holds the session.
    expect(lockRequests(bed)).toEqual([])
    expect(bed.core.alive()).toBe(true)

    // The reload: a new source, the same cookie, the same storage. The Core answers again.
    bed.close(page)
    bed.core.back()
    // Every store update of the reloaded page is watched: the Core accepts the cookie at the
    // upgrade (its first socket is an OPERATOR socket), and nothing of it may be shown.
    const seen: { status: string; operators: number }[] = []
    const reloaded = await bed.load({}, (started) => {
      started.live.store.subscribe((state) => seen.push({ status: state.auth.status, operators: state.operators.length }))
    })
    await bed.elapse(1_000)
    expect(signedIn(reloaded)).toBe(false)
    expect(selectAuth(reloaded.live.store.getState()).status).toBe(AuthStatus.SIGNED_OUT)
    expect(reloaded.live.session).toBeNull()
    expect(lockRequests(bed)).toEqual([{ reason: 'LOCK' }])
    expect(bed.core.alive()).toBe(false)
    // Paid: nothing is owed any more.
    expect(bed.storage?.getItem(KEY)).toBeNull()
    expect(reloaded.sockets[0]?.principal).toBe('OPERATOR')
    expect(seen.length).toBeGreaterThan(0)
    expect(seen.filter((update) => update.status === AuthStatus.SIGNED_IN || update.operators > 0)).toEqual([])
  })

  it('a new tab pays the debt: it does not take the session the cookie still names', async () => {
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
    const first = await bed.load()
    bed.core.unreachable()
    await bed.flush()
    await first.live.actions.signOut('USER')
    await bed.flush()
    expect(bed.storage?.getItem(KEY)).not.toBeNull()

    // The first tab stays open and offline; a second tab is opened when the Core answers again.
    bed.core.back()
    const second = await bed.load()
    await bed.elapse(1_000)
    expect(signedIn(second)).toBe(false)
    expect(lockRequests(bed)).toEqual([{ reason: 'USER' }])
    expect(bed.core.alive()).toBe(false)
  })

  it('without a debt a reload takes the session again, as before', async () => {
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
    const page = await bed.load()
    bed.close(page)
    const reloaded = await bed.load()
    expect(signedIn(reloaded)).toBe(true)
    expect(lockRequests(bed)).toEqual([])
    expect(bed.storage?.getItem(KEY)).toBeNull()
  })
})

describe('a start whose read fails is closed (D100, CPC1-34; brief list row 28)', () => {
  it('a text under the key that is not JSON: the session the cookie names is NOT taken, nothing is signed out, and the log says why', async () => {
    const storage = createMemoryStorage({ [KEY]: '{"operatorId":' })
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION, storage })
    const page = await bed.load()
    await bed.elapse(1_000)
    expect(signedIn(page)).toBe(false)
    expect(page.live.session).toBeNull()
    // The Core still holds the session: nothing is known to be owed, so nothing is signed out.
    expect(lockRequests(bed)).toEqual([])
    expect(bed.core.alive()).toBe(true)
    const sources = page.sink.records().map((record) => `${record.level} ${record.source}`)
    expect(sources).toContain('error live.owed')
    // The failed call is reported by its name and the error's name, never by the stored text.
    const secrets = page.sink.records().find((record) => record.source === 'live.secrets')
    expect(secrets?.context).toMatchObject({ port: 'owedSignOut.read', errorName: 'OwedSignOutUnreadableError' })
    expect(JSON.stringify(page.sink.records())).not.toContain('{"operatorId":')
    // Residual, stated in the module: the text stays until a debt is written.
    expect(storage.getItem(KEY)).toBe('{"operatorId":')
  })

  it('a value that parses and is no debt: the start is closed too, and the Live source removes the value', async () => {
    const storage = createMemoryStorage({ [KEY]: '{"operatorId":"OPR-002","reason":"LOCK"}' })
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION, storage })
    const page = await bed.load()
    await bed.elapse(1_000)
    expect(signedIn(page)).toBe(false)
    expect(lockRequests(bed)).toEqual([])
    expect(storage.getItem(KEY)).toBeNull()
  })
})

describe('without a usable storage NO port is passed (brief list row 28)', () => {
  it('the storage is probed once and never touched again; a Lock is not kept, and the log says so', async () => {
    const storage = createMemoryStorage()
    const setItem = vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    })
    const getItem = vi.spyOn(storage, 'getItem')
    const removeItem = vi.spyOn(storage, 'removeItem')
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION, storage })
    const page = await bed.load()
    expect(page.runtime.owedSignOutPersisted).toBe(false)
    // An open start: with no port, the session is taken as without a storage.
    expect(signedIn(page)).toBe(true)
    expect(page.sink.records().map((record) => `${record.level} ${record.source}`)).toEqual(['warn runtime.live.storage'])
    expect(page.sink.records()[0]?.message).toContain('will not survive a reload')

    bed.core.unreachable()
    await bed.flush()
    await page.live.actions.signOut('LOCK')
    await bed.flush()
    expect(signedIn(page)).toBe(false)
    // The one probe, and nothing after it: no `read` at the start, no `write` at the Lock.
    expect(setItem).toHaveBeenCalledTimes(1)
    expect(setItem.mock.calls[0]?.[0]).toBe(STORAGE_PROBE_KEY)
    expect(getItem).not.toHaveBeenCalled()
    expect(removeItem).not.toHaveBeenCalled()
    // No watch either: there is no debt key to follow.
    expect(bed.storageEvents.listeners).toBe(0)
  })

  it('a browser without localStorage at all starts the same way', async () => {
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION, storage: null })
    const page = await bed.load()
    expect(page.runtime.owedSignOutPersisted).toBe(false)
    expect(signedIn(page)).toBe(true)
    expect(page.sink.records().map((record) => record.source)).toEqual(['runtime.live.storage'])
  })
})

describe('another tab\'s Lock (brief list row 29, the optional part)', () => {
  it('reads only a debt an operator asked for', () => {
    expect(operatorSignOutOf(JSON.stringify(DEBT))).toEqual({ operatorId: 'OPR-002', issuedAt: DEBT.issuedAt, reason: 'LOCK' })
    expect(operatorSignOutOf(JSON.stringify({ ...DEBT, reason: 'USER' }))?.reason).toBe('USER')
    for (const text of [
      null,
      'not json',
      'null',
      '5',
      JSON.stringify({ ...DEBT, reason: 'IDLE_EXPIRED' }),
      JSON.stringify({ ...DEBT, reason: 'ABSOLUTE_EXPIRED' }),
      JSON.stringify({ ...DEBT, operatorId: 7 }),
      JSON.stringify({ ...DEBT, issuedAt: '1790823300000' }),
      JSON.stringify({ reason: 'LOCK' }),
    ]) {
      expect(operatorSignOutOf(text), String(text)).toBeNull()
    }
  })

  async function signedInTab(): Promise<{ test: LiveTestBed; page: LivePage; debt: LiveOwedSignOut }> {
    bed = createLiveTestBed({ session: SUPERVISOR_SESSION })
    const page = await bed.load()
    const session = page.live.session
    if (session === null) throw new Error('the page is signed in')
    expect(bed.storageEvents.listeners).toBe(1)
    return { test: bed, page, debt: { operatorId: session.operator.id, issuedAt: session.issuedAt, reason: 'LOCK', at: bed.fake.clock.now() } }
  }

  it('a Lock that another tab stored for THIS tab\'s session ends the session here too', async () => {
    const { test, page, debt } = await signedInTab()
    test.storageEvents.emit({ key: KEY, newValue: JSON.stringify(debt), storageArea: test.storage })
    await test.flush()
    expect(signedIn(page)).toBe(false)
    expect(page.live.lastSessionEnd?.signOut).toBe('LOCK')
    // This tab's link is up, so its own sign-out reached the Core: the session is over for every tab.
    expect(lockRequests(test)).toEqual([{ reason: 'LOCK' }])
  })

  it('a sign-out another tab stored is followed with its own reason', async () => {
    const { test, page, debt } = await signedInTab()
    test.storageEvents.emit({ key: KEY, newValue: JSON.stringify({ ...debt, reason: 'USER' }), storageArea: test.storage })
    await test.flush()
    expect(signedIn(page)).toBe(false)
    expect(lockRequests(test)).toEqual([{ reason: 'USER' }])
  })

  it('is not followed: another key, a removal, another session, a reckoned expiry, another storage area, a text that is no debt', async () => {
    const { test, page, debt } = await signedInTab()
    const others = createMemoryStorage()
    const events = [
      { key: 'dems.core.mode.v1', newValue: JSON.stringify(debt), storageArea: test.storage },
      { key: null, newValue: null, storageArea: test.storage },
      { key: KEY, newValue: null, storageArea: test.storage },
      { key: KEY, newValue: JSON.stringify({ ...debt, issuedAt: debt.issuedAt - 1 }), storageArea: test.storage },
      { key: KEY, newValue: JSON.stringify({ ...debt, operatorId: INVESTIGATOR_SESSION.operator.id }), storageArea: test.storage },
      { key: KEY, newValue: JSON.stringify({ ...debt, reason: 'IDLE_EXPIRED' }), storageArea: test.storage },
      { key: KEY, newValue: JSON.stringify(debt), storageArea: others },
      { key: KEY, newValue: '{"operatorId":', storageArea: test.storage },
    ]
    for (const event of events) {
      test.storageEvents.emit(event)
      await test.flush()
      expect(signedIn(page), JSON.stringify({ ...event, storageArea: undefined })).toBe(true)
    }
    expect(lockRequests(test)).toEqual([])
  })

  it('a tab with nobody signed in ignores the event, and a stopped page no longer listens', async () => {
    bed = createLiveTestBed()
    const page = await bed.load()
    expect(signedIn(page)).toBe(false)
    bed.storageEvents.emit({ key: KEY, newValue: JSON.stringify(DEBT), storageArea: bed.storage })
    await bed.flush()
    expect(lockRequests(bed)).toEqual([])
    bed.close(page)
    expect(bed.storageEvents.listeners).toBe(0)
  })
})
