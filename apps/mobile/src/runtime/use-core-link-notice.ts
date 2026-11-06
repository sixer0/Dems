/**
 * The "Core server unreachable" notice of a screen in ONE call (row M1, decision D159; W66 F-1),
 * built on row M0's one rule (`link-notice.ts`; 04_client_integration_spec §3.5, LB-6, LB-10, CL-17).
 *
 * ```ts
 * const { view, offline } = useCoreLinkNotice();
 * ```
 *
 * - `offline`: show the notice. It shows at the first OFFLINE or STALE, hides at the first ONLINE,
 *   and a reconnect attempt (CONNECTING) between two OFFLINEs keeps it: no flicker, no hold time, no
 *   timer. A screen first opened while the socket reconnects after an outage shows it from its first
 *   render, because the first render starts from the app's connection banner, which has followed the
 *   same link since the runtime started (`initialOfflineNotice`). A cold start (CONNECTING before the
 *   first heartbeat) flashes nothing: the banner is hidden then.
 * - `view`: the link as a screen words it, `'up' | 'settling' | 'down' | 'none'` (a chip, a disabled
 *   control). Outside LIVE the view is `none` and `offline` is false, so no `live &&` gate is needed.
 *
 * The input is the runtime's own link, `useCoreLink()`: never its two-valued `state` and never a bare
 * heartbeat (M0, DN-4). A 429 is no link state and never reaches it (LB-10). The state is held with
 * the render-time "adjust state when an input changed" shape: no effect, no ref (React Compiler).
 */
import { useState } from 'react';
import { useConnectionBanner } from './connection-banner';
import { useCoreLink } from './contract';
import { coreLinkViewOf, initialOfflineNotice, offlineNoticeAfter, type CoreLinkView } from './link-notice';

export interface CoreLinkNotice {
  /** The Core link as a screen reads it: `up`, `settling`, `down`, or `none` outside LIVE. */
  readonly view: CoreLinkView;
  /** Show "Core server unreachable" (LIVE only). */
  readonly offline: boolean;
}

export function useCoreLinkNotice(): CoreLinkNotice {
  const view = coreLinkViewOf(useCoreLink());
  const banner = useConnectionBanner().kind;
  const [viewSeen, setViewSeen] = useState(view);
  const [offline, setOffline] = useState(() => initialOfflineNotice(view, banner));
  if (viewSeen !== view) {
    setViewSeen(view);
    setOffline(offlineNoticeAfter(offline, view));
  }
  return { view, offline };
}
