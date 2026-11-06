/**
 * The Core link as a screen reads it, and the ONE rule for the "Core server unreachable" notice of
 * LIVE mode (row M0, finding CPM1-3 of the CP-M1 review; 04_client_integration_spec §3.5, LB-6,
 * LB-10, CL-17).
 *
 * Before this file the rule lived twice, over two representations of the same link: the Pair screen
 * over the Live source's `LiveLinkState` (`useLiveLink()`), the Login screen over the heartbeat state
 * of the Core link (`useCoreLink().heartbeat`). Both screens now call `offlineNoticeAfter`, and a
 * screen hands it whatever it holds of the link.
 *
 * ## One view of the link: `coreLinkViewOf`
 *
 * | A caller holds | `up` | `settling` | `down` | `none` |
 * |---|---|---|---|---|
 * | `LiveLinkState` (`useLiveLink()`) | ONLINE | CONNECTING, RESYNCING | STALE, OFFLINE | `null` (Simulated mode) |
 * | `HeartbeatState` | LIVE | CONNECTING | STALE, OFFLINE | `undefined` |
 * | `CoreLinkInfo` (`useCoreLink()`), source LIVE | its `heartbeat` as above; without one, `state` ONLINE | | without a heartbeat, `state` OFFLINE | |
 * | `CoreLinkInfo`, source SIMULATED or HEARTBEAT | | | | always |
 * | A `CoreLinkView` | itself | itself | itself | itself |
 * | Any other value (a refusal's kind, a status code) | | always: it says nothing about the link | | |
 *
 * ## The rule: `offlineNoticeAfter(shown, link)`
 *
 * - `down` shows the notice AT ONCE: the first render that sees OFFLINE or STALE shows it. There is
 *   no hold time and no clock here. An OFFLINE is a socket that closed; a STALE already carries the
 *   transport's own time window (no message for `HEARTBEAT_STALE_AFTER_MS`, 2,500 ms, measured by the
 *   socket client of `@dems/shared/realtime` on its injected clock).
 * - `up` and `none` hide it at once.
 * - `settling` keeps what is shown. This is the no-flicker part: with the Core down the link
 *   alternates OFFLINE, CONNECTING, OFFLINE … at every reconnect attempt, and a notice that followed
 *   it would blink; at a cold start the link is CONNECTING before the first heartbeat, and a notice
 *   shown then would flash. The RESYNCING of a settle time-out (CL-17) is a transient too.
 * - A 429 cannot reach it. A limit is a refusal, not a link state (LB-10: a 429 never shows the
 *   offline notice and never changes the mode indicator). The input type has no place for one, and a
 *   value that is no link state keeps what is shown.
 *
 * For a fixed view the rule is idempotent, so a screen re-applies it whenever its input changed, in
 * the render-time "adjust state when an input changed" shape (no effect, no ref; React Compiler).
 * A screen takes all of it in ONE call, `useCoreLinkNotice()` (`use-core-link-notice.ts`, row M1),
 * which is this shape:
 *
 * ```ts
 * const view = coreLinkViewOf(useCoreLink());
 * const banner = useConnectionBanner().kind;
 * const [viewSeen, setViewSeen] = useState(view);
 * const [offline, setOffline] = useState(() => initialOfflineNotice(view, banner));
 * if (viewSeen !== view) {
 *   setViewSeen(view);
 *   setOffline(offlineNoticeAfter(offline, view));
 * }
 * ```
 *
 * ## The first render: `initialOfflineNotice(link, banner)` (row M1, W66 F-1)
 *
 * A screen first opened while the socket reconnects sees `settling`, which keeps what is shown, and
 * a new screen has shown nothing yet: starting from "not shown" (`offlineNoticeAfter(false, view)`,
 * row M0's first snippet) it read "Core Live" until the next failed attempt, up to one reconnect
 * step. The app's connection banner (`connection-banner.ts`) has followed the same link since the
 * runtime started, and in LIVE mode its `offline` kind IS this rule's "shown" (`link-notice.test.ts`,
 * "agree on every heartbeat"). So the first render starts from the banner: what the notice would
 * show had the screen been mounted all along. Outside LIVE the view is `none` and nothing shows,
 * whatever the banner says (HEARTBEAT mode has a banner too).
 *
 * Never hand it `useCoreLink().state`: that word has two values (ONLINE, OFFLINE) and reads a
 * CONNECTING link as OFFLINE, so the notice would flash at every start and blink during an outage.
 * Never hand it a bare heartbeat outside LIVE mode: HEARTBEAT mode has a heartbeat too (mock-core's),
 * and this is the notice of the Core server. Hand it `useCoreLink()` itself, and the source decides.
 *
 * Pure: no React, no clock, no storage, no timer.
 */
import type { HeartbeatState } from '@dems/shared/domain';
import type { LiveLinkState } from '@dems/shared/live';
import type { ConnectionBannerKind } from './connection-banner';
import type { CoreLinkInfo } from './contract';

/** The Core link as a screen reads it. */
export type CoreLinkView =
  /** The link carries commands: the Live link is ONLINE, the heartbeat is LIVE. */
  | 'up'
  /** A transient: the first connect, a reconnect between two attempts, a resync. */
  | 'settling'
  /** The Core server is unreachable: OFFLINE, or STALE (no message for 2.5 s). */
  | 'down'
  /** No Live link: Simulated mode, or the mock-core heartbeat of HEARTBEAT mode. */
  | 'none';

/** Whatever a caller holds of the link. */
export type CoreLinkInput = LiveLinkState | HeartbeatState | CoreLinkView | CoreLinkInfo | null | undefined;

/** The one view of the link, from any of its representations (the table of this file's header). */
export function coreLinkViewOf(link: CoreLinkInput): CoreLinkView {
  if (link === null || link === undefined) return 'none';
  if (typeof link === 'object') return viewOfCoreLink(link);
  switch (link) {
    case 'ONLINE':
    case 'LIVE':
    case 'up':
      return 'up';
    case 'CONNECTING':
    case 'RESYNCING':
    case 'settling':
      return 'settling';
    case 'STALE':
    case 'OFFLINE':
    case 'down':
      return 'down';
    case 'none':
      return 'none';
    default:
      // A value that is no link state says nothing about the link (a refusal's kind, a status code
      // of a limit): it keeps what is shown (LB-10).
      return 'settling';
  }
}

/** The runtime's link: only a LIVE source has a Core server link; its heartbeat says more than its two-valued state. */
function viewOfCoreLink(link: CoreLinkInfo): CoreLinkView {
  if (link.source !== 'LIVE') return 'none';
  if (link.heartbeat !== undefined) return coreLinkViewOf(link.heartbeat);
  return link.state === 'ONLINE' ? 'up' : 'down';
}

/**
 * Whether the "Core server unreachable" notice shows after a change of the link: `down` shows it at
 * once, `up` and `none` hide it at once, `settling` keeps `shown` (no flicker). See the header.
 */
export function offlineNoticeAfter(shown: boolean, link: CoreLinkInput): boolean {
  switch (coreLinkViewOf(link)) {
    case 'down':
      return true;
    case 'settling':
      return shown;
    case 'up':
    case 'none':
      return false;
  }
}

/**
 * The notice at a screen's FIRST render (row M1): `down` shows it, `up` and `none` hide it, and
 * `settling` shows it while the app's connection banner says the link is lost (`offline`). Then
 * `offlineNoticeAfter` takes over. See the header.
 */
export function initialOfflineNotice(link: CoreLinkInput, banner: ConnectionBannerKind): boolean {
  return offlineNoticeAfter(banner === 'offline', link);
}
