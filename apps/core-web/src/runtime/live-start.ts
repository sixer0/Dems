/**
 * The Live start-up of the web console (backend task 04_client_integration_spec §5.1 steps 2 to
 * 4; ADQ-2, ADQ-6; brief list rows 1 to 7 and 28 to 30 of implementation/44_live_source.md §17.4;
 * plan row W50).
 *
 * THE HEAVY MODULE: this is the only file of the console that imports the typed client
 * (`@dems/shared/client`) and the Live source (`@dems/shared/live/source`) as values. It is
 * loaded only by the dynamic import of `./boot`, which sits behind `import.meta.env.DEV`, so a
 * production or packaged build carries no client and no socket code path that can run (MD-6).
 *
 * | Step | What happens | Rule |
 * |-----:|--------------|------|
 * | 1 | The origin's `localStorage` is probed once (write and remove). No usable storage: NO `owedSignOut` port is passed, and one `warn` record says that a Lock will not survive a reload | Row 28 |
 * | 2 | ONE typed client: `baseUrl` = the page's own origin, `credentials: 'browser-cookie'` (the browser attaches its `HttpOnly` session cookie; no `Authorization` header is ever sent) | CL-2; row 1 |
 * | 3 | `createLiveSim` with that client, the socket `ws://<page host>/ws` (no headers: the browser attaches the cookie at the upgrade), the storage port, the page-visibility adapter and the error sink. It starts at once (`autoStart`): the session probe goes out and the one socket opens | §5.1 steps 3, 4; CL-7, CL-8 |
 * | 4 | With a storage: the `storage` event of the debt key is watched | Row 29 |
 * | 5 | The caller awaits `live.ready` (it never rejects) and reads `live.session`, `live.link` and the store afterwards | Row 3 |
 *
 * The pages never get the typed client that is built here: they call `live.client.call(...)`, the
 * Live source's observed view of it (row 1). Structural sharing is the Live source's own default
 * (`shareStructure`): it also keeps the rows of a ring that moved by one row, which the query
 * library's `replaceEqualDeep` does not (CA-04 allows either).
 *
 * `stop()` ends the watch and stops the source (the socket is closed, every timer cleared, every
 * action that is out settled). The mode switch calls it before the page reloads.
 */
import { createCoreClient, type CoreClient, type CoreClientReport, type CoreFetch } from '@dems/shared/client'
import { asSim, createLiveSim, type LiveSim } from '@dems/shared/live/source'
import type { LiveSocketFactory, LiveSocketTimers } from '@dems/shared/realtime'
import { createDefaultVisibility, type Sim, type VisibilityAdapter } from '@dems/shared/sim'
import { pageWsUrl, type PageLocation } from '@/lib/core-endpoint'
import type { ErrorSink } from './error-sink'
import { createOwedSignOutPort, hasUsableStorage, watchOwedSignOut, type StorageEventTarget } from './owed-sign-out-storage'

/** The Live source of the web console: its `client` is the registry-typed client. */
export type WebLive = LiveSim<CoreClient>

export interface StartLiveRuntimeOptions {
  /** The page's own address: the base of every request and of the socket. */
  readonly location: PageLocation
  /** The origin's `localStorage`, or `null`. */
  readonly storage: Storage | null
  /** Receives every report of the Live source and of the typed client. */
  readonly sink: ErrorSink
  /** Where `storage` events come from (the window); `null`: another tab's Lock is not followed. */
  readonly storageEvents?: StorageEventTarget | null
  /** Default: the page-visibility API. Meters are subscribed only while the page is visible (CL-11b). */
  readonly visibility?: VisibilityAdapter
  // ── Tests: the fake transport and its clock ──
  readonly fetch?: CoreFetch
  readonly socketFactory?: LiveSocketFactory
  readonly now?: () => number
  readonly timers?: LiveSocketTimers
  readonly random?: () => number
}

export interface LiveRuntime {
  readonly live: WebLive
  /** The Live source as the `Sim` of the existing `SimContext` (ADQ-2). */
  readonly sim: Sim
  /** Whether a Lock made while the Core is unreachable survives a reload (the origin has a usable storage). */
  readonly owedSignOutPersisted: boolean
  /** Ends the storage watch and stops the source. Idempotent. */
  stop(): void
}

/** A report of the typed client (an answer outside the contract) as a record of the sink. */
function clientRecord(report: CoreClientReport, at: number) {
  return {
    level: report.level,
    source: report.source,
    message: report.message,
    at,
    context: {
      operationId: report.operationId,
      method: report.method,
      path: report.path,
      kind: report.kind,
      status: report.status,
      requestId: report.requestId,
      ...(report.issues === undefined ? {} : { issues: report.issues.join('; ') }),
    },
  }
}

export function startLiveRuntime(options: StartLiveRuntimeOptions): LiveRuntime {
  const { location, sink } = options
  const now = options.now ?? Date.now
  const storage = hasUsableStorage(options.storage) ? options.storage : null
  if (storage === null) {
    sink.report({
      level: 'warn',
      source: 'runtime.live.storage',
      message:
        'This browser gives the console no usable localStorage. A Lock or a sign-out made while the Core server is unreachable will not survive a reload of the page.',
      at: now(),
    })
  }

  const client = createCoreClient({
    baseUrl: location.origin,
    credentials: 'browser-cookie',
    report: (report) => sink.report(clientRecord(report, now())),
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    ...(options.now === undefined ? {} : { now: options.now }),
  })

  const live: WebLive = createLiveSim({
    client,
    socket: {
      url: pageWsUrl(location),
      ...(options.socketFactory === undefined ? {} : { factory: options.socketFactory }),
    },
    // Passed only for a storage that works: a later failure of `read` then means "a stored Lock may be unreadable".
    ...(storage === null ? {} : { owedSignOut: createOwedSignOutPort(storage) }),
    visibility: options.visibility ?? createDefaultVisibility(),
    onError: sink.report,
    ...(options.now === undefined ? {} : { now: options.now }),
    ...(options.timers === undefined ? {} : { timers: options.timers }),
    ...(options.random === undefined ? {} : { random: options.random }),
  })

  const events = options.storageEvents ?? null
  const stopWatch = storage !== null && events !== null ? watchOwedSignOut({ live, storage, target: events }) : () => undefined

  return {
    live,
    sim: asSim(live),
    owedSignOutPersisted: storage !== null,
    stop() {
      stopWatch()
      live.stop()
    },
  }
}
