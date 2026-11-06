/**
 * The presentation-mode follow-up (backend task 04_client_integration_spec §5.5 WS-10; plan row
 * W55; decision D128 point 2; ruled into this path by decision D144(4), finding CPW1-4).
 *
 * Why it lives in `runtime/` and not in `features/login/`: since D128 it runs on EVERY route for
 * the lifetime of the page (`routes/__root.tsx`), so it is entry/root wiring rather than Login
 * behaviour, and a route file reaching a feature's internal adapter inverts the layering the rest
 * of `routes/**` respects. Why not `lib/presentation-mode.ts`: that file is marked "no change" by
 * [CS] §7.3 G15, and this function is not about storage — it subscribes to a Live source and
 * happens to write a storage flag. Its shape is the one `query-bridge.ts` beside it already has:
 * subscribe to a Live source, apply the effect to a page-side object, hand back the clean-up.
 *
 * What it does: the server's setting is not public before sign-in, so the Login page reads the
 * tab-local flag `dems.presentation.v1` only. While an operator is signed in, the server's
 * `settings.presentationMode` is copied into that flag on every change, so after a sign-out in the
 * same tab the page follows the server's last value. A fresh tab shows the disclosure until someone
 * signs in once (gap GC-07, accepted: the value is public). It is installed in ONE place, the root
 * route, so it holds on every route: also for a page load that starts inside the shell and never
 * shows the Login page. The Login page installs nothing.
 */
import { selectIsSignedIn, selectPresentationMode, type SimState } from '@dems/shared/sim'
import { getPresentationMode, setPresentationMode } from '@/lib/presentation-mode'
import { webErrorSink } from './error-sink'
import type { WebLive } from './live-start'

/** The server's presentation setting while an operator is signed in; `null` while nobody is. */
const selectServerPresentation = (state: SimState): boolean | null => (selectIsSignedIn(state) ? selectPresentationMode(state) : null)

/**
 * WS-10: copies the server's presentation setting into the tab-local flag while an operator is
 * signed in: at once when one is (a page load that starts signed in), and on every change after
 * it. Returns the function that ends it: the caller's effect owns the subscription, so React's
 * mount, clean-up, mount of a dev build leaves exactly one. It writes only when the value
 * differs from the flag, and it never throws (a store subscriber outside React must not: brief
 * list row 6).
 */
export function followServerPresentationMode(live: Pick<WebLive, 'store'>): () => void {
  return live.store.subscribe(
    selectServerPresentation,
    (enabled) => {
      try {
        if (enabled !== null && enabled !== getPresentationMode()) setPresentationMode(enabled)
      } catch (error) {
        webErrorSink.report({
          level: 'warn',
          source: 'runtime.presentationMode',
          message: 'The presentation setting of the Core server could not be copied into this tab.',
          at: Date.now(),
          context: { errorName: error instanceof Error ? error.name : typeof error },
        })
      }
    },
    { fireImmediately: true },
  )
}
