// FXR-W (decision D242; findings W92-3, W92-4, W92-8, W92-9 of
// `verification/11_code_review_shared_web.md`): the shared Core reads of `lib/core-queries.ts` and the
// health query of `lib/health-query.ts`.
//
// | Finding | What is held | Where |
// |---------|--------------|-------|
// | W92-3 | The paired-device registry read (also the Devices drawer's), the role matrix and an evidence item's media reference are asked only while an operator is signed in, by the replicated state AND the Live source, even when the permission hint and the link still say yes | "W92-3" |
// | W92-4 | Retry goes through the key: a query whose observers are all disabled is not fetched by a press; an enabled one is, once | "W92-4" |
// | W92-8 | Each shared key has one `queryFn`: the two readers of a key mount in either order and the same function runs; its failure is presented by each observer once per NEW failure, also under StrictMode, and not again for a failure already cached at mount | "W92-8" |
// | W92-8, W92-9 | Static: each shared key is given a `queryKey:` in exactly one production file (in `lib/`); no feature reaches into another for the health query; no feature calls `query.refetch()` | "static" |
//
// The Live source, its link, its permission hint and the replicated store are stubbed here, so a test
// can hold "signed out" while the permission hint still says yes: the case a page still on screen
// sees for one render after the bridge removed the Core entries (finding F75-2).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { createElement, StrictMode, type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, QueryObserver, useQuery } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const stub = vi.hoisted(() => ({
  live: null as null | { session: unknown; client: { call: ReturnType<typeof vi.fn> } },
  signedIn: true,
  linkUp: true,
  permission: true,
}))

vi.mock('@/runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/runtime')>()),
  useWebLive: () => stub.live,
}))
vi.mock('@dems/shared/live', async (importOriginal) => {
  const original = await importOriginal<typeof import('@dems/shared/live')>()
  return {
    ...original,
    useLiveSelector: (read: (live: unknown) => unknown) => read(stub.live),
    useLiveLink: () => (stub.linkUp ? original.LiveLinkState.ONLINE : original.LiveLinkState.OFFLINE),
    useCorePermission: () => stub.permission,
  }
})
vi.mock('@dems/shared/sim', async (importOriginal) => {
  const original = await importOriginal<typeof import('@dems/shared/sim')>()
  return {
    ...original,
    useSim: (select: (state: unknown) => unknown) =>
      select({ auth: { status: stub.signedIn ? original.AuthStatus.SIGNED_IN : original.AuthStatus.SIGNED_OUT } }),
  }
})
vi.mock('@/lib/core-errors', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/core-errors')>()),
  useCoreErrorPresenter: () => () => null,
}))

const { CoreReadError, pairedDevicesQueryOptions, retryCoreQuery, roleMatrixQueryOptions, usePairedDevicesGate, useQueryFailure, useRoleMatrixGate } = await import('../core-queries')
const { useEvidenceMedia } = await import('@/features/evidence/use-evidence-media')
const { CORE_QUERY_KEYS } = await import('@/runtime')

const SESSION = { operator: { id: 'OPR-001' } }
const OK = { ok: true, data: { devices: [], roles: [], permissions: [], grants: [], evidence: {}, media: { source: 'NONE', packageSuffix: null } } }

function liveWith(call = vi.fn(async () => OK)) {
  return { session: SESSION as unknown, client: { call } }
}

let client: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children)
const strictWrapper = ({ children }: { children: ReactNode }) => createElement(StrictMode, null, createElement(QueryClientProvider, { client }, children))

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  stub.live = liveWith()
  stub.signedIn = true
  stub.linkUp = true
  stub.permission = true
})

afterEach(() => {
  client.clear()
})

/** The three reads of W92-3, each as its page builds it. */
const READS = [
  ['the paired-device registry (Paired Devices page, Devices drawer)', 'listPairedDevices', () => useQuery(pairedDevicesQueryOptions(usePairedDevicesGate()))],
  ['the role matrix (Users & Roles, Security & Audit)', 'getRoleMatrix', () => useQuery(roleMatrixQueryOptions(useRoleMatrixGate()))],
  ['an evidence item\'s media reference (the detail page)', 'getEvidence', () => useEvidenceMedia('EV-20260929-0001')],
] as const satisfies ReadonlyArray<readonly [string, string, () => unknown]>

describe('W92-3: no Core read for a signed-out console, whatever the permission hint and the link say', () => {
  it.each(READS)('%s: signed in, it is asked once', async (_name, operationId, hook) => {
    renderHook(hook as () => unknown, { wrapper })
    await waitFor(() => expect(stub.live!.client.call).toHaveBeenCalledTimes(1))
    expect(stub.live!.client.call.mock.calls[0]![0]).toBe(operationId)
  })

  it.each(READS)('%s: the replicated state says signed out (the hint and the link still yes): nothing is asked', async (_name, _operationId, hook) => {
    stub.signedIn = false
    renderHook(hook as () => unknown, { wrapper })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(stub.live!.client.call).not.toHaveBeenCalled()
  })

  it.each(READS)('%s: the Live source holds no session (the replicated state still signed in): nothing is asked', async (_name, _operationId, hook) => {
    stub.live!.session = null
    renderHook(hook as () => unknown, { wrapper })
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(stub.live!.client.call).not.toHaveBeenCalled()
  })

  it('the registry also needs the link and PAIRING_MANAGE; the role matrix the link (rule 6)', async () => {
    stub.linkUp = false
    const registry = renderHook(() => usePairedDevicesGate(), { wrapper })
    const matrix = renderHook(() => useRoleMatrixGate(), { wrapper })
    expect(registry.result.current.enabled).toBe(false)
    expect(matrix.result.current.enabled).toBe(false)
    stub.linkUp = true
    stub.permission = false
    registry.rerender()
    matrix.rerender()
    expect(registry.result.current.enabled).toBe(false)
    expect(matrix.result.current.enabled).toBe(true)
  })
})

describe('W92-4: Retry goes through the key and keeps the gate', () => {
  it('a failed query whose observers are all disabled is not fetched by a Retry; `refetch()` would have fetched it', async () => {
    const queryFn = vi.fn(async () => {
      throw new Error('outage')
    })
    const observer = new QueryObserver(client, { queryKey: CORE_QUERY_KEYS.pairedDevices, queryFn, retry: false })
    const unsubscribe = observer.subscribe(() => undefined)
    await waitFor(() => expect(observer.getCurrentResult().status).toBe('error'))
    expect(queryFn).toHaveBeenCalledTimes(1)
    // The gate closes (signed out, the link down, the permission lost) while the failed panel is on screen.
    observer.setOptions({ queryKey: CORE_QUERY_KEYS.pairedDevices, queryFn, retry: false, enabled: false })
    retryCoreQuery(client, CORE_QUERY_KEYS.pairedDevices)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(queryFn).toHaveBeenCalledTimes(1)
    // The control group: what the old Retry did.
    await observer.refetch()
    expect(queryFn).toHaveBeenCalledTimes(2)
    unsubscribe()
  })

  it('an enabled failed query is fetched once by a Retry, and only its own key', async () => {
    const failing = vi.fn(async () => {
      throw new Error('outage')
    })
    const other = vi.fn(async () => 'matrix')
    const observer = new QueryObserver(client, { queryKey: CORE_QUERY_KEYS.pairedDevices, queryFn: failing, retry: false })
    const otherObserver = new QueryObserver(client, { queryKey: CORE_QUERY_KEYS.roleMatrix, queryFn: other, retry: false })
    const stop = [observer.subscribe(() => undefined), otherObserver.subscribe(() => undefined)]
    await waitFor(() => expect(observer.getCurrentResult().status).toBe('error'))
    await waitFor(() => expect(otherObserver.getCurrentResult().status).toBe('success'))
    retryCoreQuery(client, CORE_QUERY_KEYS.pairedDevices)
    await waitFor(() => expect(failing).toHaveBeenCalledTimes(2))
    expect(other).toHaveBeenCalledTimes(1)
    for (const unsubscribe of stop) unsubscribe()
  })
})

describe('W92-8: one queryFn per key; each observer presents each new failure once', () => {
  it('whichever reader of the registry mounts first, the same function reads it', () => {
    const gate = { live: stub.live as never, enabled: true }
    expect(pairedDevicesQueryOptions(gate).queryKey).toEqual(CORE_QUERY_KEYS.pairedDevices)
    expect(roleMatrixQueryOptions(gate).queryKey).toEqual(CORE_QUERY_KEYS.roleMatrix)
    // A page narrows the matrix gate; it cannot widen it.
    expect(roleMatrixQueryOptions({ live: stub.live as never, enabled: false }, true).enabled).toBe(false)
    expect(roleMatrixQueryOptions(gate, false).enabled).toBe(false)
  })

  it('a failure carries the operation, status and code; the failed call stays off the enumerable members (a cache dump shows no answer text)', () => {
    const failure = { ok: false, operationId: 'listPairedDevices', kind: 'REFUSED', status: 403, error: { code: 'NOT_PERMITTED', message: 'marker-9c1 secret text' }, retryAfterSeconds: null, transport: null, requestId: null }
    const error = new CoreReadError('listPairedDevices', failure as never)
    expect(error).toMatchObject({ operationId: 'listPairedDevices', status: 403, code: 'NOT_PERMITTED' })
    expect(error.failure).toBe(failure)
    expect(JSON.stringify(error)).not.toContain('marker-9c1')
    expect(Object.keys(error)).not.toContain('failure')
  })

  it.each([
    ['without StrictMode', wrapper],
    ['under StrictMode', strictWrapper],
  ] as const)('%s: one presentation per failure; a second failure is presented again', async (_case, chosen) => {
    let fail = 0
    const queryFn = vi.fn(async () => {
      fail += 1
      throw new Error(`failure ${fail}`)
    })
    const present = vi.fn()
    renderHook(
      () => {
        const query = useQuery({ queryKey: ['core', 'fxr-w-once'], queryFn, retry: false })
        useQueryFailure(query, present)
        return query
      },
      { wrapper: chosen },
    )
    await waitFor(() => expect(present).toHaveBeenCalledTimes(1))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(present).toHaveBeenCalledTimes(1)
    await act(async () => {
      await client.invalidateQueries({ queryKey: ['core', 'fxr-w-once'] })
    })
    await waitFor(() => expect(present).toHaveBeenCalledTimes(2))
    expect(present.mock.calls.map(([error]) => (error as Error).message)).toEqual(['failure 1', 'failure 2'])
  })

  it('a failure already in the cache when the component mounts is not presented again; the refetch on mount that follows is', async () => {
    const queryFn = vi.fn(async () => {
      throw new Error('outage')
    })
    await client.prefetchQuery({ queryKey: ['core', 'fxr-w-cached'], queryFn, retry: false })
    expect(client.getQueryState(['core', 'fxr-w-cached'])?.status).toBe('error')
    const present = vi.fn()
    let gateOpen = false
    const view = renderHook(
      () => {
        const query = useQuery({ queryKey: ['core', 'fxr-w-cached'], queryFn, retry: false, enabled: gateOpen })
        useQueryFailure(query, present)
        return query
      },
      { wrapper },
    )
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(present).not.toHaveBeenCalled()
    gateOpen = true
    view.rerender()
    await waitFor(() => expect(present).toHaveBeenCalledTimes(1))
  })
})

describe('static: one definition per shared key, no feature-to-feature health import, no `refetch()` Retry (W92-4, W92-8, W92-9)', () => {
  const src = resolve(import.meta.dirname, '../..')
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      if (statSync(path).isDirectory()) return name === '__tests__' || name === 'test' || name === 'testing' ? [] : walk(path)
      return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
    })
  const production = walk(src).map((path) => ({ name: relative(src, path), text: readFileSync(path, 'utf8') }))
  const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  /** A query DEFINITION of `key`: one object literal with the key and a `queryFn` (an `invalidateQueries({ queryKey })` has none). */
  const definition = (key: string) => new RegExp(`queryKey:\\s*${key.replace('.', '\\.')}\\b[^{}]*\\bqueryFn\\b|\\bqueryFn\\b[^{}]*queryKey:\\s*${key.replace('.', '\\.')}\\b`)

  it.each([
    ['CORE_QUERY_KEYS.pairedDevices', 'lib/core-queries.ts'],
    ['CORE_QUERY_KEYS.roleMatrix', 'lib/core-queries.ts'],
    ['HEALTH_QUERY_KEY', 'lib/health-query.ts'],
  ])('%s has a query definition in exactly one production file, %s', (key, home) => {
    const definers = production.filter(({ text }) => definition(key).test(code(text))).map(({ name }) => name)
    expect(definers).toEqual([home])
  })

  it('both readers of the registry and both readers of the matrix use the factory', () => {
    const uses = (factory: string) => production.filter(({ text }) => code(text).includes(`useQuery(${factory}(`)).map(({ name }) => name).sort()
    expect(uses('pairedDevicesQueryOptions')).toEqual(['features/devices/device-drawer.tsx', 'features/paired-devices/live-data.ts'])
    expect(uses('roleMatrixQueryOptions')).toEqual(['features/security-audit/rbac-panel.tsx', 'features/users-roles/queries.ts'])
  })

  it('no feature imports another feature\'s health query; the old home is gone', () => {
    for (const { name, text } of production) expect(code(text), name).not.toMatch(/features\/home\/use-health|from '\.\/use-health'/)
    expect(production.map(({ name }) => name)).not.toContain('features/home/use-health.ts')
  })

  it('no feature, component or route calls `refetch()` on a query (it ignores `enabled`)', () => {
    for (const { name, text } of production) {
      if (!/^(features|components|routes)\//.test(name)) continue
      expect(code(text), name).not.toMatch(/\.refetch\(\)/)
    }
  })
})
