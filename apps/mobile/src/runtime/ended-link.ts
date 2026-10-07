/**
 * A run the Core ended ON PURPOSE is no outage (row FX-M1, defect E2E-S-3 of the end-to-end round;
 * decision D201).
 *
 * When the Core revokes this device (close 4403) or ends the session of its socket (close 4401),
 * the socket client of `@dems/shared/realtime` goes to its ENDED phase: no socket, no reconnect by
 * itself, link OFFLINE and heartbeat OFFLINE (`live-socket-client.ts`, `handleClose`). The Live
 * source then lets the app delete the retired credential (`deviceUnpaired`) or forget the session
 * (`sessionCleared`) and reopens the socket itself (`live-sim.ts`, `afterEnd`). Under load that
 * takes seconds: on the phone of E2E-S-3 the 4403 came at 10:08:24.59 and the anonymous socket
 * opened at 10:08:27.67, and the Pair screen said "Core server unreachable" in between, although
 * the Core had just answered.
 *
 * The socket status tells the two OFFLINEs apart: `socketStatus().end` is set by close 4401 or 4403
 * and cleared by the next `start()` or `reconnect()`. While it is set the app is between two sockets
 * of its own making, so the link is SETTLING, not down: OFFLINE reads as CONNECTING here, for the
 * Live link and for the heartbeat alike. Every other state passes unchanged, and so does an OFFLINE
 * of a socket that was lost: a Core that is really gone still shows the notice at once (M0's rule,
 * `link-notice.ts`, is not touched). When the reopened socket cannot connect, the socket client is
 * no longer ENDED (`connect()` clears `end`), so the next OFFLINE shows the notice as before.
 */
import type { HeartbeatState } from '@dems/shared/domain';
import { useLiveSelector, type LiveLinkState } from '@dems/shared/live';
import { isClientRestart, type MobileLiveSim } from './sim-adapters';

/** What this file reads of the Live source: only the end of its socket's run. */
export interface EndedRunSource {
  socketStatus(): { readonly end: unknown };
}

/** True while the Core has ended the socket's run on purpose (4401, 4403) and the app has not reopened it yet. */
export function isRunEndedByCore(live: EndedRunSource | null | undefined): boolean {
  if (live === null || live === undefined || typeof live.socketStatus !== 'function') return false;
  try {
    const end = live.socketStatus().end;
    return end !== null && end !== undefined;
  } catch {
    // A status that cannot be read says nothing about an end: the link is taken as it is.
    return false;
  }
}

/**
 * CF-M1 (R-S-2): the link is settling, not down, while the Core ended the run on purpose (above) OR while
 * the app's own socket client is between a socket it gave up itself (SYNC_TIMEOUT after the pairing
 * hand-off) and the next one (`isClientRestart`, first restart of a series only). Both are sockets of the
 * app's own making; a Core that is really gone, or that keeps not answering, still shows the notice.
 */
export function isLinkSettling(live: (EndedRunSource & object) | null | undefined): boolean {
  return isRunEndedByCore(live) || isClientRestart(live);
}

/** The Live link as the notice reads it: OFFLINE while the run was ended on purpose is CONNECTING. */
export function liveLinkWhileEnded(link: LiveLinkState | null, ended: boolean): LiveLinkState | null {
  return ended && link === 'OFFLINE' ? 'CONNECTING' : link;
}

/** The heartbeat as the Core link reads it: OFFLINE while the run was ended on purpose is CONNECTING. */
export function heartbeatWhileEnded(heartbeat: HeartbeatState, ended: boolean): HeartbeatState {
  return ended && heartbeat === 'OFFLINE' ? 'CONNECTING' : heartbeat;
}

/**
 * The Live source's link for a screen that words the offline notice from it (the Pair screen, CL-22:
 * it must know when a redeem would be sent), or `null` in Simulated mode. Re-read whenever the Live
 * source reports a change: the end is set and cleared together with a change of the link.
 */
export function useNoticeLiveLink(): LiveLinkState | null {
  return useLiveSelector((live: MobileLiveSim | null) => (live === null ? null : liveLinkWhileEnded(live.link, isLinkSettling(live))));
}
