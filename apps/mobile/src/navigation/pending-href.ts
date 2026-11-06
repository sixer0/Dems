/**
 * The pending href of 04_mobile_specs §3.3: a guarded URL that arrived while no operator was
 * signed in. The `Stack.Protected` guard then shows `/login` (the guarded `(app)` group is not in
 * the navigator, so Expo Router falls back to the anchor `/`, whose boot router redirects to
 * `/login`); after sign-in the boot router opens the pending href, unless the session resync
 * target wins (§3.3 order: resync target, pending href, `/home`).
 *
 * Privacy (04 §3.3, §6.1): kept in module memory only — never persisted, never logged, never
 * put in another URL. It holds a path and query, never credentials.
 *
 * Fed by `src/app/+native-intent.tsx` (`redirectSystemPath`), which Expo Router calls for the
 * launch URL and for every later deep link, before routing.
 */
import { isGuardedPath } from './routes';
import { toInternalHref } from './params';

let pendingHref: string | null = null;
let signedIn = false;

/**
 * Called by the root navigator whenever the guard changes. A signed-in operator follows links
 * directly, so a stale pending href is dropped on sign-in-time links and on sign-out.
 */
export function setSignedInSnapshot(isSignedIn: boolean): void {
  if (signedIn && !isSignedIn) pendingHref = null; // sign-out never resumes an old link
  signedIn = isSignedIn;
}

/** Where a guarded link goes while signed out (04 §3.3). */
export const SIGN_IN_PATH = '/login';

/**
 * Records a system URL (launch URL or a later deep link) and returns the path Expo Router should
 * open instead, or `null` to keep the link as it is. A guarded in-app path received while signed
 * out becomes the pending href and is redirected to `/login` (04 §3.3: "An unauthenticated visit
 * to any (app) URL lands on /login"): without the redirect, a link that arrives while the app is
 * already running on a public screen (`/stack-check`, `/pair`) would be dropped silently, because
 * the protected group is not in the navigator. A link received while signed in clears any pending
 * href (the router opens that link itself).
 */
export function recordIncomingLink(url: string): string | null {
  const href = toInternalHref(url);
  if (href === null) return null;
  if (signedIn) {
    pendingHref = null;
    return null;
  }
  if (!isGuardedPath(href.pathname)) return null;
  pendingHref = `${href.pathname}${href.search}`;
  return SIGN_IN_PATH;
}

/** The pending href, without consuming it (the boot router reads it during render). */
export function peekPendingHref(): string | null {
  return pendingHref;
}

/** Drops the pending href once the boot router has navigated to it (or to a resync target). */
export function clearPendingHref(): void {
  pendingHref = null;
}

/** Test hook: back to the cold-start state (signed out, nothing pending). */
export function resetPendingHrefForTests(): void {
  pendingHref = null;
  signedIn = false;
}
