/**
 * Where the web app finds the Core (06_packaging_spec §3.4, PK-12; D104).
 *
 * | Mode                    | `VITE_DEMS_CORE_ORIGIN` | REST origin               | Heartbeat socket            |
 * |-------------------------|-------------------------|---------------------------|-----------------------------|
 * | dev, tests, plain build | unset                   | `http://127.0.0.1:4400`   | `ws://127.0.0.1:4400/ws`    |
 * | packaged build          | `same-origin`           | `window.location.origin`  | `ws(s)://<page host>/ws`    |
 *
 * The packaged launcher serves the app, `GET /api/v1/health` and `/ws` from one origin, so the
 * page talks to its own origin. Every function reads the env and `window.location` at call time
 * (no module-level constant), so tests can switch modes with `vi.stubEnv`. Any value other than
 * `same-origin` keeps the dev defaults.
 *
 * Shared code is not edited here (D110: step 54 owns packages/shared/src/api while it runs), so
 * `fetchCoreHealth` reaches the shared `fetchHealth` through its `fetchImpl` seam, and the OpenAPI
 * document is re-pointed in `features/api-reference/api-document.ts`. The spec's shared
 * `fetchHealth(fetchImpl, origin)` / `serverUrl` options are left to the end pass.
 */
import {
  CORE_HTTP_ORIGIN,
  CORE_WS_URL,
  fetchHealth,
  WEB_DEV_ORIGINS,
  WS_PATH,
  type HealthResponse,
} from '@dems/shared/api'
import { SAME_ORIGIN_CORE } from './packaged-csp'

/** The parts of `window.location` the resolvers need (tests pass their own). */
export type PageLocation = Pick<Location, 'origin' | 'protocol' | 'host'>

function page(location?: PageLocation): PageLocation {
  return location ?? window.location
}

/** True in the packaged build (`VITE_DEMS_CORE_ORIGIN=same-origin`). */
export function isSameOriginCore(): boolean {
  return import.meta.env.VITE_DEMS_CORE_ORIGIN === SAME_ORIGIN_CORE
}

/** Origin of the Core REST surface (`fetchHealth`, the OpenAPI server, Try-it routing). */
export function coreHttpOrigin(location?: PageLocation): string {
  return isSameOriginCore() ? page(location).origin : CORE_HTTP_ORIGIN
}

/** URL of the heartbeat socket. */
export function coreWsUrl(location?: PageLocation): string {
  if (!isSameOriginCore()) return CORE_WS_URL
  const { protocol, host } = page(location)
  return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}${WS_PATH}`
}

/** Page origins the Core accepts WS upgrades from (the Realtime panel's origin check). */
export function allowedPageOrigins(location?: PageLocation): readonly string[] {
  return isSameOriginCore() ? [page(location).origin] : WEB_DEV_ORIGINS
}

/**
 * `GET {coreHttpOrigin()}/api/v1/health`, validated by the shared `fetchHealth` (one schema check).
 * Dev mode calls `fetchHealth` exactly as before. Packaged mode passes a `fetchImpl` that moves the
 * shared default origin (`CORE_HTTP_ORIGIN`) onto the page origin; nothing else is rewritten.
 */
export function fetchCoreHealth(fetchImpl?: typeof fetch): Promise<HealthResponse> {
  const origin = coreHttpOrigin()
  if (origin === CORE_HTTP_ORIGIN) return fetchImpl ? fetchHealth(fetchImpl) : fetchHealth()
  const base: typeof fetch = fetchImpl ?? ((input, init) => globalThis.fetch(input, init))
  return fetchHealth((input, init) =>
    base(
      typeof input === 'string' && input.startsWith(CORE_HTTP_ORIGIN)
        ? `${origin}${input.slice(CORE_HTTP_ORIGIN.length)}`
        : input,
      init,
    ),
  )
}
