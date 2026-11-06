/**
 * Where the web app finds the Core (06_packaging_spec §3.4, PK-12; D104; backend task
 * 04_client_integration_spec §4.2, plan row W50).
 *
 * | Mode                         | Selected by                              | REST origin               | Heartbeat socket            |
 * |------------------------------|------------------------------------------|---------------------------|-----------------------------|
 * | Simulated: dev, tests, build | `VITE_DEMS_CORE_ORIGIN` unset            | `http://127.0.0.1:4400`   | `ws://127.0.0.1:4400/ws`    |
 * | Simulated: packaged build    | `VITE_DEMS_CORE_ORIGIN=same-origin`      | `window.location.origin`  | `ws(s)://<page host>/ws`    |
 * | Live (dev builds only)       | The data source of the page is the Live source | `window.location.origin`  | `ws(s)://<page host>/ws`    |
 *
 * The packaged launcher serves the app, `GET /api/v1/health` and `/ws` from one origin, so the
 * page talks to its own origin. In Live mode the dev server proxies `/api/v1` and `/ws` to the
 * Core server (`vite.config.ts`, `DEMS_CORE_PROXY_PORT`), so the page again talks to its own
 * origin: the Home and Stack Check pages, the API Reference server strip and the Realtime panel
 * follow, and the health answer names `dems-core-server`.
 *
 * Every function reads the env, `window.location` and the mode at call time (no module-level
 * constant), so tests can switch modes with `vi.stubEnv`. Any value of the env key other than
 * `same-origin` keeps the dev defaults.
 *
 * The Live row is selected by `setCoreEndpointMode`, which the router factory calls with the mode
 * of the data source it is given (`router.tsx`): a simulator means Simulated, a Live source means
 * Live. Nothing reads the stored mode here: the mode of a page load is fixed when the page
 * starts, while the stored value is shared by the tabs of the origin and can change under an open
 * page. Without that call (the existing tests) the resolvers behave as before.
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
  fetchPanelFirmware,
  WEB_DEV_ORIGINS,
  WS_PATH,
  type HealthResponse,
  type PanelFirmwareResponse,
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

/** The data mode of this page load, as the router factory set it from its data source. */
let liveDataSource = false

/**
 * Selects the Live row (`'LIVE'`) or the Simulated rows (`'SIMULATED'`). Called by the router
 * factory with the mode of the data source it is given; a test that built a Live router calls it
 * with `'SIMULATED'` when it is done.
 */
export function setCoreEndpointMode(mode: 'SIMULATED' | 'LIVE'): void {
  liveDataSource = mode === 'LIVE'
}

/**
 * True when the page talks to the Core server through its own origin (Live mode). Dev builds
 * only: in a production build `import.meta.env.DEV` is false, whatever was set (MD-6).
 */
export function isLiveCore(): boolean {
  return import.meta.env.DEV && liveDataSource && !isSameOriginCore()
}

/** True when the Core is served from the page's own origin: the packaged build, or Live mode. */
function isPageOriginCore(): boolean {
  return isSameOriginCore() || isLiveCore()
}

/** `ws(s)://<page host>/ws`: the socket of a Core that is served from the page's own origin. */
export function pageWsUrl(location?: PageLocation): string {
  const { protocol, host } = page(location)
  return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}${WS_PATH}`
}

/** Origin of the Core REST surface (`fetchHealth`, the OpenAPI server, Try-it routing). */
export function coreHttpOrigin(location?: PageLocation): string {
  return isPageOriginCore() ? page(location).origin : CORE_HTTP_ORIGIN
}

/** URL of the heartbeat socket. */
export function coreWsUrl(location?: PageLocation): string {
  if (!isPageOriginCore()) return CORE_WS_URL
  return pageWsUrl(location)
}

/** Page origins the Core accepts WS upgrades from (the Realtime panel's origin check). */
export function allowedPageOrigins(location?: PageLocation): readonly string[] {
  return isPageOriginCore() ? [page(location).origin] : WEB_DEV_ORIGINS
}

/**
 * A `fetch` that moves the shared default origin (`CORE_HTTP_ORIGIN`) onto `origin`: what the
 * packaged build and Live mode need, because there the Core is served from the page's own origin.
 * Nothing else of a request is rewritten.
 */
function ontoPageOrigin(base: typeof fetch, origin: string): typeof fetch {
  return (input, init) =>
    base(
      typeof input === 'string' && input.startsWith(CORE_HTTP_ORIGIN)
        ? `${origin}${input.slice(CORE_HTTP_ORIGIN.length)}`
        : input,
      init,
    )
}

/**
 * `GET {coreHttpOrigin()}/api/v1/health`, validated by the shared `fetchHealth` (one schema check).
 * Dev mode calls `fetchHealth` exactly as before. The packaged build and Live mode pass a
 * `fetchImpl` that moves the shared default origin (`CORE_HTTP_ORIGIN`) onto the page origin;
 * nothing else is rewritten.
 */
export function fetchCoreHealth(fetchImpl?: typeof fetch): Promise<HealthResponse> {
  const origin = coreHttpOrigin()
  if (origin === CORE_HTTP_ORIGIN) return fetchImpl ? fetchHealth(fetchImpl) : fetchHealth()
  const base: typeof fetch = fetchImpl ?? ((input, init) => globalThis.fetch(input, init))
  return fetchHealth(ontoPageOrigin(base, origin))
}

/**
 * `GET {coreHttpOrigin()}/api/v1/lcd/panel-info` (operation 114), validated by the shared
 * `fetchPanelFirmware`. The same origin rule as `fetchCoreHealth`, because the same anonymous reader
 * asks for it: the device strip of the sign-in screen. An empty answer is a success — the Core sends
 * `200` with empty strings when it knows nothing of a panel — so only a transport or schema failure
 * reaches the caller as a rejection.
 */
export function fetchCorePanelFirmware(fetchImpl?: typeof fetch): Promise<PanelFirmwareResponse> {
  const origin = coreHttpOrigin()
  if (origin === CORE_HTTP_ORIGIN) return fetchPanelFirmware(fetchImpl ?? fetch)
  const base: typeof fetch = fetchImpl ?? ((input, init) => globalThis.fetch(input, init))
  return fetchPanelFirmware(ontoPageOrigin(base, origin))
}
