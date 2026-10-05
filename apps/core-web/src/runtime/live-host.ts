/**
 * The address the console must be opened at in Live mode (backend task 04_client_integration_spec
 * §4.1 WT-2a; finding FC-12; plan row W50).
 *
 * The Core server accepts the web console only from `http://127.0.0.1:<port>`: its list of web
 * console origins holds no `localhost` entry, and the session cookie is bound to the host it was
 * set for. A page opened under `localhost` (or under any other host) would be refused at sign-in
 * with 403 `ORIGIN_NOT_ALLOWED`. So in Live mode such a page does not start the Live source at
 * all: it names the cause and the address to open instead. Simulated mode has no such rule.
 *
 * Only the host and the scheme are checked here. Which ports the Core server accepts is the
 * server's own list (its configuration, not a shared constant); a page on `127.0.0.1` with a port
 * outside that list is refused by the server at sign-in, and the refusal presenter words it.
 *
 * Pure: no global is read.
 */

/** The one host the Core server accepts the web console from. */
export const LIVE_CONSOLE_HOST = '127.0.0.1'
/** Live mode exists on the dev server only, which serves plain HTTP on loopback. */
export const LIVE_CONSOLE_PROTOCOL = 'http:'

/** The parts of `window.location` the check needs (tests pass their own). */
export type ConsoleLocation = Pick<Location, 'protocol' | 'hostname' | 'port' | 'pathname' | 'search' | 'hash' | 'origin'>

export interface LiveHostRefusal {
  readonly cause: 'HOST_NOT_ALLOWED'
  /** The origin the page was opened at, for example `http://localhost:5178`. */
  readonly current: string
  /** The origin to use: `http://127.0.0.1:<the same port>`. */
  readonly expected: string
  /** The same page at the right address: `expected` plus the path, the query and the fragment. */
  readonly href: string
}

/** `http://127.0.0.1:<port of the page>`: the origin the console is opened at in Live mode. */
export function liveConsoleOrigin(location: Pick<Location, 'port'>): string {
  return `${LIVE_CONSOLE_PROTOCOL}//${LIVE_CONSOLE_HOST}${location.port === '' ? '' : `:${location.port}`}`
}

/** `null` when Live mode may start at this address; otherwise the cause and the address to open. */
export function liveHostRefusal(location: ConsoleLocation): LiveHostRefusal | null {
  if (location.hostname === LIVE_CONSOLE_HOST && location.protocol === LIVE_CONSOLE_PROTOCOL) return null
  const expected = liveConsoleOrigin(location)
  return {
    cause: 'HOST_NOT_ALLOWED',
    current: location.origin,
    expected,
    href: `${expected}${location.pathname}${location.search}${location.hash}`,
  }
}
