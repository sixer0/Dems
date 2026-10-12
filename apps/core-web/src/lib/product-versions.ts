/**
 * ONE VERSION PER COMPONENT, on every surface of the console that shows a version (fix wave J round
 * three, driver J3-W; finding JW-26 / JA2-30; truth rule 3f; `contract_wave_j.md` J2-S 2).
 *
 * | Component | Where its version comes from | Shown as |
 * |-----------|------------------------------|----------|
 * | Core server | operation 64 `getSystemStatus`, member `components.core` BY NAME | "Core server" |
 * | Capture worker | the same answer, `components.captureWorker` (absent on a Core in SIMULATED capture) | "Capture worker" |
 * | API contract | the same answer, `components.apiContract` | "API contract" |
 * | Web console | `WEB_CONSOLE_VERSION` (`src/version.ts`), the console's one constant | "Web console" |
 * | The demonstration device model | `SOFTWARE_VERSION` / `device.softwareVersion` / the `update` slice | a model value: shown only on the demonstration |
 *
 * THE RULE (`productVersionsOf`): on a Core in its OWN capture nothing reads the model's version as
 * the version of the real thing - a surface asks `modelVersion`, gets `null` and draws the component
 * rows instead. On the SIMULATED lane and in the in-app simulator `modelVersion` is the model's value
 * and the surfaces are exactly what they were (pinned by `product-versions.test.tsx`).
 *
 * Operation 64 is read ONLY where its answer is shown: by a Live console, signed in, link up, on a
 * Core in its own capture (`useSystemComponents`). A read that fails or has not answered leaves the
 * Core's rows at "Not reported"; the failure goes to the console's own log once, with no toast (a
 * version row is not worth interrupting an operator; the row itself says what is missing).
 */
import { queryOptions, useQueries, type QueryKey } from '@tanstack/react-query'
import type { SystemStatus } from '@dems/shared/api'
import { isOwnCaptureCoreState, useSim, useSimReady } from '@dems/shared/sim'
import { CORE_QUERY_ROOT, type WebLive } from '@/runtime'
import { WEB_CONSOLE_VERSION } from '@/version'
import { CoreReadError, useQueryFailure, useRoleMatrixGate } from './core-queries'
import { createPageReporter } from './page-report'

export { WEB_CONSOLE_VERSION }

/** The versions a Core states about itself (operation 64 `components`). */
export type SystemComponents = NonNullable<SystemStatus['components']>

/** The components the console names, in the order it lists them. */
export const PRODUCT_COMPONENT_IDS = ['core', 'captureWorker', 'apiContract', 'webConsole'] as const
export type ProductComponentId = (typeof PRODUCT_COMPONENT_IDS)[number]

export interface ProductComponentRow {
  readonly id: ProductComponentId
  /** The version as its owner states it; `null`: the Core has not stated it (the row reads "Not reported"). */
  readonly version: string | null
}

export interface ProductVersions {
  /** This Core runs its own capture: the model's versions are not versions of it. */
  readonly ownCore: boolean
  /**
   * The demonstration model's version, for the surfaces that showed it: the given model value on the
   * demonstration, `null` on a Core in its own capture (draw `rows` there, never this).
   */
  readonly modelVersion: string | null
  /** The component rows to draw on a Core in its own capture, and in an "About" on every lane. */
  readonly rows: readonly ProductComponentRow[]
  /** `components.core.version`, or `null`. */
  readonly coreVersion: string | null
}

/**
 * The versions a surface may show. Pure.
 *
 * - `ownCore` false (the demonstration): `modelVersion` is the model's value; the rows hold the
 *   console's own version and whatever the Core stated (nothing, when operation 64 was not read).
 * - `ownCore` true: `modelVersion` is `null`. The Core server and the API contract always have a row
 *   (`null` = not stated yet); the capture worker has one only when the Core states it.
 */
export function productVersionsOf(input: { readonly ownCore: boolean; readonly components: SystemComponents | null | undefined; readonly modelVersion: string }): ProductVersions {
  const components = input.components ?? null
  const rows: ProductComponentRow[] = []
  if (components !== null || input.ownCore) rows.push({ id: 'core', version: components?.core.version ?? null })
  if (components?.captureWorker !== undefined) rows.push({ id: 'captureWorker', version: components.captureWorker.version })
  if (components !== null || input.ownCore) rows.push({ id: 'apiContract', version: components?.apiContract.version ?? null })
  rows.push({ id: 'webConsole', version: WEB_CONSOLE_VERSION })
  return { ownCore: input.ownCore, modelVersion: input.ownCore ? null : input.modelVersion, rows, coreVersion: components?.core.version ?? null }
}

/** The key of operation 64 as the version surfaces read it. It starts with `'core'`: the bridge empties it with a session end. */
export const SYSTEM_STATUS_QUERY_KEY: QueryKey = [CORE_QUERY_ROOT, 'system-status']

async function readSystemStatus(live: WebLive | null): Promise<SystemStatus> {
  if (live === null) throw new CoreReadError('getSystemStatus', null)
  const answer = await live.client.call('getSystemStatus')
  if (answer.ok) return answer.data
  throw new CoreReadError('getSystemStatus', answer)
}

/** Operation 64 under `SYSTEM_STATUS_QUERY_KEY`, enabled by the base gate of every Core read and by `ownCore`. */
export function systemStatusQueryOptions(gate: { readonly live: WebLive | null; readonly enabled: boolean }, ownCore: boolean) {
  return queryOptions({
    queryKey: SYSTEM_STATUS_QUERY_KEY,
    enabled: gate.live !== null && gate.enabled && ownCore,
    queryFn: () => readSystemStatus(gate.live),
    // The versions of a running Core do not change under it: one read per page load is enough.
    staleTime: Number.POSITIVE_INFINITY,
  })
}

const versionsReport = createPageReporter('ver')
/** What a reader sees while its gate is closed: nothing read, nothing failed. */
const IDLE_READ = { data: undefined, error: null, errorUpdatedAt: 0, status: 'pending' } as const
/** The failure already written to the log: the key has several readers on one page, and one failed read is ONE record. */
let reportedFailureAt = 0

/**
 * `components` of this Core, read through operation 64 where its answer is shown (a Live console on
 * a Core in its own capture). `null`: not such a Core, not answered yet, or the read failed.
 */
export function useSystemComponents(): { readonly ownCore: boolean; readonly components: SystemComponents | null } {
  const ready = useSimReady()
  const ownCore = useSim(isOwnCaptureCoreState) && ready
  // The base gate of an AUTHENTICATED read (Live, signed in by both the state and the source, link up).
  const gate = useRoleMatrixGate()
  // A closed gate mounts NO observer: a disabled `useQuery` would still put an entry under `['core', …]` into the
  // cache, and after a session end that cache holds no Core entry (AC-C-106, `test/live-runtime-startup.test.tsx`).
  const options = systemStatusQueryOptions(gate, ownCore)
  const [query = IDLE_READ] = useQueries({ queries: [options].filter((entry) => entry.enabled === true) })
  useQueryFailure(query, (error) => {
    if (query.errorUpdatedAt === reportedFailureAt) return
    reportedFailureAt = query.errorUpdatedAt
    versionsReport.report('ProductVersions.getSystemStatus', error, 'The versions of the components of this Core could not be read.', { operation: 'getSystemStatus' }, 'warn')
  })
  return { ownCore, components: ownCore ? (query.data?.components ?? null) : null }
}

/** `productVersionsOf` for this console: the Core's statement, the console's constant and the given model value. */
export function useProductVersions(modelVersion: string): ProductVersions {
  const { ownCore, components } = useSystemComponents()
  return productVersionsOf({ ownCore, components, modelVersion })
}
