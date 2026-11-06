import { reportNavigationIssue } from '@/navigation/log';
import { toInternalHref } from '@/navigation/params';
import { recordIncomingLink } from '@/navigation/pending-href';
import { isGuardedPath } from '@/navigation/routes';
import { isPairingGateHeld } from '@/runtime/pairing-gate-snapshot';

/** The screen that is open while the pairing gate holds (MP-11). */
const PAIR_PATH = '/pair';
/** Routes of the root stack that the gate removes besides the `(app)` group: sign-in and the debug gallery. */
const GATED_PATHS: ReadonlySet<string> = new Set(['/login', '/dev-gallery']);

/**
 * Expo Router's system-URL hook: called with the launch URL (`initial: true`) and with every later
 * deep link, before routing. A guarded URL that arrives while signed out is kept as the pending
 * href and opened as `/login` instead (04_mobile_specs §3.3); every other link is returned
 * unchanged, so routing is Expo Router's own. The global `?motion=` / `?debug=` switches still
 * apply: the motion kit reads the raw incoming URL, and so does the runtime for `core=`. Never logs
 * the URL (untrusted input).
 *
 * While the pairing gate holds (LIVE mode, device not PAIRED; row FX-M1, E2E-S-4) a link to a screen
 * the gate removes (`/login`, an `(app)` screen, the debug gallery) opens `/pair` instead. Expo Router
 * drops a warm link whose route is not in the root navigator without a word, so the app stayed on the
 * public screen it was on; the pending href is still recorded and opened after pairing and sign-in
 * (MP-12). At a cold launch the runtime has not started yet, the gate reads "not held", and the link
 * goes through unchanged: the guard then falls back to `/`, whose boot router opens `/pair`, as before.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    const target = recordIncomingLink(path) ?? path;
    return gatedTarget(target) ?? target;
  } catch (error) {
    reportNavigationIssue('warn', 'navigation.nativeIntent', error);
    return path;
  }
}

/** `/pair` for a link the pairing gate would leave unrouted, else `null`. */
function gatedTarget(target: string): string | null {
  if (!isPairingGateHeld()) return null;
  const href = toInternalHref(target);
  if (href === null) return null;
  return GATED_PATHS.has(href.pathname) || isGuardedPath(href.pathname) ? PAIR_PATH : null;
}
