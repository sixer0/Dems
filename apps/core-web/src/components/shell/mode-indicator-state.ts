import { CoreMode, LiveLinkState } from '@dems/shared/live'

/** What the mode indicator says. SIMULATED: the simulator is the Core. The other three are Live mode, by its link. */
export type ModeIndicatorState = 'SIMULATED' | 'LIVE' | 'OFFLINE' | 'RECONNECTING'

/**
 * The indicator's state from the data mode and the Live link (backend task
 * 04_client_integration_spec §3.2; plan row W54):
 *
 * | Mode | Link | State | Chip |
 * |------|------|-------|------|
 * | SIMULATED | (none) | SIMULATED | `SIMULATED`, warning |
 * | LIVE | ONLINE | LIVE | `LIVE`, success |
 * | LIVE | OFFLINE, STALE | OFFLINE | `LIVE · OFFLINE`, danger |
 * | LIVE | CONNECTING, RESYNCING | RECONNECTING | `LIVE · RECONNECTING`, danger while the socket is being opened, warning while it resynchronises (D144(2)) |
 *
 * CONNECTING and RESYNCING are "the socket retries or resynchronises": a socket exists and its
 * snapshot is awaited. Only the link moves the indicator. A call the Core refused (a 403, a 429)
 * never changes the link, so a limit never reads as an outage here (LB-10).
 */
export function modeIndicatorState(mode: CoreMode, link: LiveLinkState | null): ModeIndicatorState {
  // `(LIVE, null)` is not a state of the shell: the top bar reads the link through `useLiveLink()`,
  // which answers a state as soon as the page has a Live source, so `null` means "no Live source"
  // and therefore Simulated mode (finding CPW1-6). The function is exported to the page rows, so a
  // caller that has a Live source must pass its link, never `null`: with `null` this says SIMULATED,
  // which would be the opposite of the truth for a Live page.
  if (mode !== CoreMode.LIVE || link === null) return 'SIMULATED'
  if (link === LiveLinkState.ONLINE) return 'LIVE'
  if (link === LiveLinkState.CONNECTING || link === LiveLinkState.RESYNCING) return 'RECONNECTING'
  return 'OFFLINE'
}

/**
 * Whether the Live link counts as lost for the link notice (§3.5). OFFLINE: no socket. STALE: a
 * socket that has been silent for 2,500 ms. A socket that is being opened (CONNECTING) decides
 * nothing by itself: the notice stays as it was until the link is up or lost again.
 */
export function isLinkLost(link: LiveLinkState | null): boolean {
  return link === LiveLinkState.OFFLINE || link === LiveLinkState.STALE
}

/** Whether the Live link is up: state messages arrive (ONLINE), or a newer snapshot is awaited on an open socket (RESYNCING). */
export function isLinkUp(link: LiveLinkState | null): boolean {
  return link === LiveLinkState.ONLINE || link === LiveLinkState.RESYNCING
}
