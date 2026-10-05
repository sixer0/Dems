// Plan row W50: the query bridge (backend task 04_client_integration_spec §10.1 PG-6, PG-6a; §5.6
// WS-12; §6.3 RC-3; AC-C-106; security design review SD-20; brief list row 22).
//
// Every test uses the REAL query client of TanStack Query and a REAL Live source on the fake
// transport. What is asserted is the content of the cache, not a call of the bridge.
//
// | Rule | Where it is proven here |
// |------|-------------------------|
// | `admin.changed` invalidates the matching lists and removes nothing | "admin.changed" |
// | AC-C-106: after a sign-out the cache holds no `['core', …]` entry | "a session end removes" |
// | The same on `session.ended` with every reason, on an end decided here, and on a 401 | "a session end removes" |
// | The same on the loss of `USER_ADMIN` or `PAIRING_MANAGE`, in the turn of the message (RC-3) | "the loss of an administration permission" |
// | The same when another operator takes the session without a session end | "another operator" |
// | A `['core', …]` query is never repeated by itself | "no automatic repeat" |
import { MutationObserver, QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { pickReplicatedState, type ReplicatedState } from '@dems/shared/api'
import { asSim } from '@dems/shared/live/source'
import { ALWAYS_VISIBLE, createSim, selectIsSignedIn, type Sim } from '@dems/shared/sim'
import { createAppRouter } from '@/router'
import {
  ADMIN_CHANGED_QUERY_KEYS,
  applyCoreQueryDefaults,
  attachQueryBridge,
  clearCoreQueries,
  CORE_QUERY_DEFAULTS,
  CORE_QUERY_KEY,
  CORE_QUERY_KEYS,
  CORE_QUERY_PERMISSIONS,
  onCoreQueriesCleared,
  sessionChangeClearsCoreQueries,
} from '@/runtime/query-bridge'
import {
  createLiveTestBed,
  INVESTIGATOR_SESSION,
  SUPERVISOR_SESSION,
  type LivePage,
  type LiveTestBed,
} from '@/runtime/testing/live-harness'

let bed: LiveTestBed | undefined
const clients: QueryClient[] = []
const sims: Sim[] = []

afterEach(() => {
  for (const client of clients.splice(0)) client.clear()
  for (const sim of sims.splice(0)) sim.stop()
  bed?.dispose()
  bed = undefined
})

const USERS = [{ id: 'OPR-001' }, { id: 'OPR-002' }, { id: 'OPR-003' }]
const HEALTH_KEY = ['health'] as const
const OTHER_KEY = ['evidence', 'filters'] as const

function queryClient(): QueryClient {
  const client = new QueryClient()
  clients.push(client)
  return client
}

/** A cache as the two administration pages leave it, beside entries that are not the Core's. */
function fill(client: QueryClient): void {
  client.setQueryData(CORE_QUERY_KEYS.users, USERS)
  client.setQueryData(CORE_QUERY_KEYS.roleMatrix, { roles: ['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN'] })
  client.setQueryData(CORE_QUERY_KEYS.pairedDevices, [{ id: 'DEV-0001' }])
  client.setQueryData(CORE_QUERY_KEYS.pairingCode, { active: true })
  client.setQueryData([...CORE_QUERY_KEY, 'users', 'OPR-002', 'detail'], { id: 'OPR-002' })
  client.setQueryData(HEALTH_KEY, { status: 'ok' })
  client.setQueryData(OTHER_KEY, { status: 'SEALED' })
}

const coreEntries = (client: QueryClient): string[] =>
  client
    .getQueryCache()
    .findAll({ queryKey: CORE_QUERY_KEY })
    .map((query) => JSON.stringify(query.queryKey))
const allKeys = (client: QueryClient): string[] =>
  client
    .getQueryCache()
    .getAll()
    .map((query) => JSON.stringify(query.queryKey))
    .sort()
const invalidated = (client: QueryClient): string[] =>
  client
    .getQueryCache()
    .getAll()
    .filter((query) => query.state.isInvalidated)
    .map((query) => JSON.stringify(query.queryKey))
    .sort()

async function signedIn(session = SUPERVISOR_SESSION): Promise<{ test: LiveTestBed; page: LivePage; client: QueryClient; detach: () => void }> {
  bed = createLiveTestBed({ session })
  const page = await bed.load()
  expect(selectIsSignedIn(page.live.store.getState())).toBe(true)
  const client = queryClient()
  fill(client)
  const detach = attachQueryBridge(page.live, client)
  return { test: bed, page, client, detach }
}

const NOT_CORE = [JSON.stringify(OTHER_KEY), JSON.stringify(HEALTH_KEY)].sort()

describe('the keys and the rule (PG-6, PG-6a)', () => {
  it('the four keys of PG-6, each under `core`', () => {
    expect(CORE_QUERY_KEY).toEqual(['core'])
    expect(CORE_QUERY_KEYS).toEqual({
      users: ['core', 'users'],
      roleMatrix: ['core', 'role-matrix'],
      pairedDevices: ['core', 'paired-devices'],
      pairingCode: ['core', 'pairing-code'],
    })
    expect(ADMIN_CHANGED_QUERY_KEYS).toEqual({
      USERS: [['core', 'users']],
      DEVICES: [['core', 'paired-devices'], ['core', 'pairing-code']],
      PAIRING_CODE: [['core', 'pairing-code']],
    })
    expect(CORE_QUERY_PERMISSIONS).toEqual(['USER_ADMIN', 'PAIRING_MANAGE'])
  })

  it('a session that goes on empties the cache when it lost USER_ADMIN or PAIRING_MANAGE, or belongs to another operator', () => {
    const both = { operatorId: 'OPR-002', permissions: ['SESSION_START', 'USER_ADMIN', 'PAIRING_MANAGE'] }
    const cases: [previous: typeof both, next: typeof both, clears: boolean][] = [
      [both, both, false],
      [both, { ...both, permissions: ['SESSION_START', 'PAIRING_MANAGE'] }, true],
      [both, { ...both, permissions: ['SESSION_START', 'USER_ADMIN'] }, true],
      [both, { ...both, permissions: [] }, true],
      // Losing another permission keeps the lists.
      [both, { ...both, permissions: ['USER_ADMIN', 'PAIRING_MANAGE'] }, false],
      // Gaining one keeps them too.
      [{ ...both, permissions: ['SESSION_START'] }, both, false],
      [{ ...both, permissions: ['SESSION_START'] }, { ...both, permissions: ['EVIDENCE_VIEW'] }, false],
      // Another operator, whatever the permissions.
      [both, { ...both, operatorId: 'OPR-003' }, true],
      [{ ...both, permissions: [] }, { operatorId: 'OPR-001', permissions: [] }, true],
    ]
    for (const [previous, next, clears] of cases) {
      expect(sessionChangeClearsCoreQueries(previous, next), JSON.stringify([previous, next])).toBe(clears)
    }
  })
})

describe('admin.changed: the matching lists are refetched, and nothing is removed (PG-6)', () => {
  it('USERS, DEVICES and PAIRING_CODE each invalidate their own lists', async () => {
    const { test, client } = await signedIn()
    const before = allKeys(client)
    expect(invalidated(client)).toEqual([])

    test.core.adminChanged('USERS')
    await test.flush()
    // The prefix matches what a page keeps below the list, too.
    expect(invalidated(client)).toEqual([JSON.stringify(['core', 'users', 'OPR-002', 'detail']), JSON.stringify(['core', 'users'])])

    test.core.adminChanged('PAIRING_CODE')
    await test.flush()
    expect(invalidated(client)).toContain(JSON.stringify(['core', 'pairing-code']))
    expect(invalidated(client)).not.toContain(JSON.stringify(['core', 'paired-devices']))

    test.core.adminChanged('DEVICES')
    await test.flush()
    expect(invalidated(client)).toContain(JSON.stringify(['core', 'paired-devices']))
    // Never the matrix (it is read-only), and never an entry that is not the Core's.
    expect(invalidated(client)).not.toContain(JSON.stringify(['core', 'role-matrix']))
    expect(invalidated(client)).not.toContain(JSON.stringify(HEALTH_KEY))
    expect(invalidated(client)).not.toContain(JSON.stringify(OTHER_KEY))
    // An invalidation keeps the rows until the refetch answers.
    expect(allKeys(client)).toEqual(before)
    expect(client.getQueryData(CORE_QUERY_KEYS.users)).toEqual(USERS)
  })

  it('a list that is on screen is fetched again, without a reload (the mechanism of AC-C-90)', async () => {
    const { test, client } = await signedIn()
    const fetchUsers = vi.fn(async () => USERS)
    const observer = new QueryObserver(client, { queryKey: CORE_QUERY_KEYS.users, queryFn: fetchUsers, staleTime: Infinity })
    const stop = observer.subscribe(() => undefined)
    await test.flush()
    expect(fetchUsers).toHaveBeenCalledTimes(0)
    test.core.adminChanged('DEVICES')
    await test.flush()
    expect(fetchUsers).toHaveBeenCalledTimes(0)
    test.core.adminChanged('USERS')
    await test.flush()
    expect(fetchUsers).toHaveBeenCalledTimes(1)
    stop()
  })
})

describe('a session end removes every [\'core\', …] entry (PG-6a; AC-C-106)', () => {
  it('AC-C-106: after a sign-out the query cache holds no core entry; the entries that are not the Core\'s stay', async () => {
    const { test, page, client } = await signedIn()
    expect(coreEntries(client)).toHaveLength(5)
    await page.live.actions.signOut('USER')
    await test.flush()
    expect(selectIsSignedIn(page.live.store.getState())).toBe(false)
    expect(coreEntries(client)).toEqual([])
    expect(client.getQueryData(CORE_QUERY_KEYS.users)).toBeUndefined()
    expect(allKeys(client)).toEqual(NOT_CORE)
    expect(test.fake.log.requestsOf('signOut')).toHaveLength(1)
  })

  it('WS-12: the entries are gone in the turn in which the store says "signed out", before anything renders', async () => {
    const { test, page, client } = await signedIn()
    const atTheStoreUpdate: number[] = []
    const afterTheTurn: number[] = []
    page.live.store.subscribe(
      (state) => state.auth.status,
      () => {
        atTheStoreUpdate.push(coreEntries(client).length)
        // What a React render sees: it is scheduled on a promise job, after the reporting turn.
        void Promise.resolve().then(() => afterTheTurn.push(coreEntries(client).length))
      },
    )
    await page.live.actions.signOut('LOCK')
    await test.flush()
    expect(atTheStoreUpdate).toHaveLength(1)
    expect(afterTheTurn).toEqual([0])
  })

  it('a Lock removes them as a sign-out does', async () => {
    const { test, page, client } = await signedIn()
    await page.live.actions.signOut('LOCK')
    await test.flush()
    expect(page.live.lastSessionEnd?.signOut).toBe('LOCK')
    expect(coreEntries(client)).toEqual([])
  })

  it('`session.ended` from the Core removes them, whatever the reason', async () => {
    for (const reason of ['SIGNED_OUT', 'IDLE_EXPIRED', 'ABSOLUTE_EXPIRED', 'USER_DISABLED'] as const) {
      const { test, page, client } = await signedIn()
      test.core.end(reason)
      await test.flush()
      expect(page.live.lastSessionEnd, reason).toMatchObject({ reason, source: 'CONTROL' })
      expect(coreEntries(client), reason).toEqual([])
      expect(allKeys(client)).toEqual(NOT_CORE)
      test.dispose()
      bed = undefined
    }
  })

  it('an end that is decided HERE, while the Core cannot be told, removes them too (the LOCAL end, D80)', async () => {
    const { test, page, client } = await signedIn()
    test.core.unreachable()
    await test.flush()
    expect(coreEntries(client)).toHaveLength(5)
    await page.live.actions.signOut('USER')
    await test.flush()
    expect(page.live.lastSessionEnd).toMatchObject({ source: 'LOCAL', signOut: 'USER' })
    expect(test.fake.log.requestsOf('signOut')).toHaveLength(0)
    expect(coreEntries(client)).toEqual([])
  })

  it('a 401 on a page\'s own call ends the session and removes them (CL-23 through `live.client`)', async () => {
    const { test, page, client } = await signedIn()
    // The Core ended the session and this tab did not hear of it (the message was lost).
    if (test.core.session === null) throw new Error('the Core holds a session')
    test.core.session.open = false
    const answer = await page.live.client.call('listUsers')
    await test.flush()
    expect(answer).toMatchObject({ ok: false, status: 401 })
    expect(selectIsSignedIn(page.live.store.getState())).toBe(false)
    expect(coreEntries(client)).toEqual([])
  })

  it('the mutation cache is emptied with them: the answer of a command does not outlive the session', async () => {
    const { test, page, client } = await signedIn()
    const observer = new MutationObserver(client, { mutationFn: async () => ({ code: 'kept only in this mutation' }) })
    await observer.mutate()
    expect(client.getMutationCache().getAll()).toHaveLength(1)
    await page.live.actions.signOut('USER')
    await test.flush()
    expect(client.getMutationCache().getAll()).toEqual([])
  })

  it('a feature that keeps something outside the cache is told in the same turn, once per clearing', async () => {
    const { test, page, client } = await signedIn()
    const held = { code: 'held by the page' as string | null }
    const cleared = vi.fn(() => {
      // The cache is already empty when the feature is told.
      expect(coreEntries(client)).toEqual([])
      held.code = null
    })
    const broken = vi.fn(() => {
      throw new Error('a listener that throws must not keep the others from running')
    })
    onCoreQueriesCleared(client, broken)
    const stop = onCoreQueriesCleared(client, cleared)
    await page.live.actions.signOut('USER')
    await test.flush()
    expect(broken).toHaveBeenCalledTimes(1)
    expect(cleared).toHaveBeenCalledTimes(1)
    expect(held.code).toBeNull()
    stop()
    clearCoreQueries(client)
    expect(cleared).toHaveBeenCalledTimes(1)
    expect(broken).toHaveBeenCalledTimes(2)
  })

  it('a second operator who signs in on the same page load finds no row of the first', async () => {
    const { test, page, client } = await signedIn()
    await page.live.actions.signOut('USER')
    await test.flush()
    test.core.signInAs = INVESTIGATOR_SESSION
    const result = await page.live.actions.signIn(INVESTIGATOR_SESSION.operator.username, 'not-a-real-password')
    await test.flush()
    expect(result).toMatchObject({ ok: true, operatorId: INVESTIGATOR_SESSION.operator.id })
    expect(page.live.session?.operator.id).toBe(INVESTIGATOR_SESSION.operator.id)
    expect(coreEntries(client)).toEqual([])
    expect(client.getQueryData(CORE_QUERY_KEYS.users)).toBeUndefined()
  })
})

describe('the loss of an administration permission removes them while the session goes on (RC-3)', () => {
  const WITHOUT = (permission: string) => SUPERVISOR_SESSION.permissions.filter((held) => held !== permission)

  it('`session.updated` that removes USER_ADMIN: gone in the turn of the message, and nobody is signed out', async () => {
    const { test, page, client } = await signedIn()
    // Synchronous: the message is delivered inside the call, and the cache is read right after it.
    test.core.changeRole('SUPERVISOR', WITHOUT('USER_ADMIN'))
    expect(coreEntries(client)).toEqual([])
    await test.flush()
    expect(selectIsSignedIn(page.live.store.getState())).toBe(true)
    expect(page.live.session?.permissions).not.toContain('USER_ADMIN')
    expect(allKeys(client)).toEqual(NOT_CORE)
  })

  it('`session.updated` that removes PAIRING_MANAGE removes them too', async () => {
    const { test, client } = await signedIn()
    test.core.changeRole('SUPERVISOR', WITHOUT('PAIRING_MANAGE'))
    expect(coreEntries(client)).toEqual([])
    await test.flush()
  })

  it('a role change to INVESTIGATOR loses both', async () => {
    const { test, page, client } = await signedIn()
    test.core.changeRole('INVESTIGATOR', INVESTIGATOR_SESSION.permissions)
    expect(coreEntries(client)).toEqual([])
    await test.flush()
    expect(page.live.session?.operator.role).toBe('INVESTIGATOR')
  })

  it('a role change that keeps both permissions keeps the lists', async () => {
    const { test, client } = await signedIn()
    test.core.changeRole('SUPERVISOR', WITHOUT('DEMO_CONTROL'))
    await test.flush()
    expect(coreEntries(client)).toHaveLength(5)
    expect(client.getQueryData(CORE_QUERY_KEYS.users)).toEqual(USERS)
  })

  it('a gained permission keeps what is cached (the matrix of an operator who becomes an administrator)', async () => {
    const { test, client } = await signedIn(INVESTIGATOR_SESSION)
    test.core.changeRole('SUPERVISOR', SUPERVISOR_SESSION.permissions)
    await test.flush()
    expect(coreEntries(client)).toHaveLength(5)
    // And the loss that follows removes them.
    test.core.changeRole('INVESTIGATOR', INVESTIGATOR_SESSION.permissions)
    expect(coreEntries(client)).toEqual([])
    await test.flush()
  })
})

describe('another operator takes the session of this tab without a session end (brief list row 7 a)', () => {
  it('a sign-in in another tab, heard as ROTATED on the open socket: the earlier operator\'s lists are removed', async () => {
    const { test, page, client } = await signedIn()
    const ends: unknown[] = []
    page.live.onSessionEnd((end) => ends.push(end))
    // Another tab of this browser signs in as another operator: the cookie now names that session.
    test.core.signIn({ operator: { ...SUPERVISOR_SESSION.operator, id: 'OPR-003', username: 'rina.wijaya' }, permissions: SUPERVISOR_SESSION.permissions })
    await test.elapse(1_000)
    expect(page.live.session?.operator.id).toBe('OPR-003')
    expect(selectIsSignedIn(page.live.store.getState())).toBe(true)
    // No end was reported, and the cache was emptied all the same.
    expect(ends).toEqual([])
    expect(coreEntries(client)).toEqual([])
    expect(allKeys(client)).toEqual(NOT_CORE)
  })
})

describe('a resynchronised socket: the lists and the health answer are refetched (PG-6)', () => {
  it('after the link was lost and is back, every core entry and `health` are invalidated; nothing is removed', async () => {
    const { test, page, client } = await signedIn()
    test.core.unreachable()
    await test.flush()
    expect(invalidated(client)).toEqual([])
    test.core.back()
    await test.elapse(3_000)
    expect(page.live.link).toBe('ONLINE')
    expect(selectIsSignedIn(page.live.store.getState())).toBe(true)
    expect(invalidated(client)).toEqual([...coreEntries(client), JSON.stringify(HEALTH_KEY)].sort())
    expect(invalidated(client)).not.toContain(JSON.stringify(OTHER_KEY))
    expect(coreEntries(client)).toHaveLength(5)
  })
})

describe('a replica that is behind (RESYNCING) is not yet a reason to refetch', () => {
  it('nothing is invalidated while the snapshot is awaited; the lists are refetched when it arrived (RESYNCED)', async () => {
    const { test, page, client } = await signedIn()
    const phases: string[] = []
    page.live.onResync((event) => phases.push(event.phase))
    const connection = page.sockets[0]
    if (connection === undefined) throw new Error('the page has a socket')
    // A delta that skips revisions: the client asks for a resync and waits.
    connection.delta([{ op: 'replace', slice: 'tabletLink', value: { state: 'OFFLINE', changedAt: test.fake.clock.now() } }], { revision: test.fake.position.revision + 5 })
    await test.flush()
    expect(phases).toEqual(['RESYNCING'])
    expect(invalidated(client)).toEqual([])
    connection.snapshot(pickReplicatedState(JSON.parse(JSON.stringify(test.core.served)) as ReplicatedState))
    await test.flush()
    expect(phases).toEqual(['RESYNCING', 'RESYNCED'])
    expect(invalidated(client)).toContain(JSON.stringify(['core', 'users']))
    expect(invalidated(client)).toContain(JSON.stringify(HEALTH_KEY))
  })
})

describe('the end of the connection', () => {
  it('after the bridge is detached nothing is invalidated and nothing is removed', async () => {
    const { test, page, client, detach } = await signedIn()
    detach()
    test.core.adminChanged('USERS')
    await test.flush()
    expect(invalidated(client)).toEqual([])
    await page.live.actions.signOut('USER')
    await test.flush()
    expect(coreEntries(client)).toHaveLength(5)
  })

  it('each of the four listeners is ended: a lost permission and a resynchronised socket change nothing either', async () => {
    const { test, page, client, detach } = await signedIn()
    detach()
    // The session goes on without USER_ADMIN: the detached bridge does not empty the cache.
    test.core.changeRole('SUPERVISOR', SUPERVISOR_SESSION.permissions.filter((held) => held !== 'USER_ADMIN'))
    await test.flush()
    expect(page.live.session?.permissions).not.toContain('USER_ADMIN')
    expect(coreEntries(client)).toHaveLength(5)
    // The link is lost and comes back: the detached bridge does not refetch.
    const phases: string[] = []
    page.live.onResync((event) => phases.push(event.phase))
    test.core.unreachable()
    await test.flush()
    test.core.back()
    await test.elapse(3_000)
    expect(phases).toContain('RESYNCED')
    expect(invalidated(client)).toEqual([])
  })
})

describe('no automatic repeat of a core query (brief list row 22)', () => {
  it('the defaults: `retry: false` for every key under `core`, and for no other key', () => {
    expect(CORE_QUERY_DEFAULTS).toEqual({ retry: false })
    const client = queryClient()
    applyCoreQueryDefaults(client)
    expect(client.getQueryDefaults(CORE_QUERY_KEYS.users)).toMatchObject({ retry: false })
    expect(client.getQueryDefaults(['core', 'anything', 'below'])).toMatchObject({ retry: false })
    expect(client.getQueryDefaults(HEALTH_KEY).retry).toBeUndefined()
  })

  it('a refused list is asked for ONCE: no second request follows by itself', async () => {
    const client = queryClient()
    applyCoreQueryDefaults(client)
    const refused = vi.fn(async () => {
      throw new Error('403 NOT_PERMITTED')
    })
    const observer = new QueryObserver(client, { queryKey: CORE_QUERY_KEYS.users, queryFn: refused })
    const stop = observer.subscribe(() => undefined)
    await vi.waitFor(() => expect(observer.getCurrentResult().status).toBe('error'))
    expect(refused).toHaveBeenCalledTimes(1)
    expect(observer.getCurrentResult().failureCount).toBe(1)
    stop()
  })

  it('the router factory sets them for a Live source and leaves a simulator\'s query client alone', async () => {
    bed = createLiveTestBed()
    const page = await bed.load()
    const liveClient = queryClient()
    createAppRouter({ sim: asSim(page.live), queryClient: liveClient })
    expect(liveClient.getQueryDefaults(CORE_QUERY_KEYS.users)).toMatchObject({ retry: false })

    const sim = createSim({ storage: null, authStorage: null, visibility: ALWAYS_VISIBLE, scheduler: () => () => undefined })
    sims.push(sim)
    const simulatedClient = queryClient()
    createAppRouter({ sim, queryClient: simulatedClient })
    expect(simulatedClient.getQueryDefaults(CORE_QUERY_KEYS.users).retry).toBeUndefined()
  })
})
