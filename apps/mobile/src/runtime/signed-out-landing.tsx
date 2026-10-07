/**
 * After a sign-out, the boot router picks the screen (row FX-M1, defect E2E-S-1 of the end-to-end
 * round; D201). Mounted by `src/app/_layout.tsx` beside the root navigator.
 *
 * The root navigator's guard (`Stack.Protected`, 04_mobile_specs §3.3) removes `(app)` when the
 * operator is signed out (Sign Out, idle expiry, Lock console, a revocation). React Navigation then
 * keeps every route that is still allowed, and the screen under `(app)` becomes the top one. The
 * root navigator's comment counts on "Expo Router falls back to the anchor `/`", which is true only
 * when nothing is left underneath: on the phone of E2E-S-1 the Pair screen that deep links had pushed
 * earlier was still there, so after Sign Out (10:16:22, `POST /auth/sign-out 204`) the app showed the
 * paired Pair view instead of Login. The root navigator handles the mirror case after a sign-in (a
 * public screen left on top goes to `/`); this does it after a sign-out.
 *
 * | Top screen once `(app)` is gone | Gate | Then |
 * |---|---|---|
 * | still `(app)` | any | wait: the guard has not removed it yet |
 * | `/` (the boot router itself) or `(auth)` | any | nothing: the boot router has chosen |
 * | `/pair` | holds (LIVE, not paired) | nothing: Pair is the boot router's choice too |
 * | any other public screen (`/pair` while paired, `/stack-check`, the debug gallery, not-found) | any | the stack is reset to `/`, so the boot router chooses: `/login`, or `/pair` while the gate holds |
 *
 * The reset (`resetToBootRouter`) pops the root stack to its first screen and replaces that with `/`,
 * so nothing visited before stays underneath the target ("whatever was visited before"). `/` gets no
 * query, so the `?motion=` of a launch link never turns it into the proof screen; `core=` and
 * `motion=` are read from the raw launch URL by the runtime and the motion kit, not from routes.
 */
import type { Href } from 'expo-router';
// The hooks module directly, not the `expo-router` entry (see `session-route-sync.tsx`): the same
// module instance, without the ESM-only package the entry loads.
import { useRouter, useSegments } from 'expo-router/build/hooks';
import { useEffect, useRef } from 'react';
import { isPairingBlocked, useAuth, usePairing } from './contract';
import { reportRuntimeIssue } from './log';

/** What the landing does with the top screen after a sign-out (the table of this file's header). */
export type SignedOutLandingStep = 'wait' | 'done' | 'boot';

export function signedOutLandingFor(top: string | undefined, gateHeld: boolean): SignedOutLandingStep {
  if (top === '(app)') return 'wait';
  if (top === undefined || top === 'index' || top === '(auth)') return 'done';
  if (top === 'pair' && gateHeld) return 'done';
  return 'boot';
}

/** The router calls the reset needs (Expo Router's imperative router has them all). */
export interface BootResetRouter {
  canDismiss(): boolean;
  dismissAll(): void;
  replace(href: Href): void;
}

/**
 * Resets the root stack to the boot router: pops to the first screen (when there is anything to
 * pop), then replaces it with `/`. Both go through Expo Router's routing queue in this order.
 */
export function resetToBootRouter(router: BootResetRouter): void {
  if (router.canDismiss()) router.dismissAll();
  router.replace('/');
}

export function SignedOutLanding(): null {
  const { isAuthenticated } = useAuth();
  const gateHeld = isPairingBlocked(usePairing());
  const segments = useSegments();
  const router = useRouter();
  const wasAuthenticated = useRef(isAuthenticated);
  const awaiting = useRef(false);

  useEffect(() => {
    if (wasAuthenticated.current && !isAuthenticated) awaiting.current = true;
    if (isAuthenticated) awaiting.current = false;
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    if (!awaiting.current) return;
    const top = segments[0];
    const landing = signedOutLandingFor(top, gateHeld);
    if (landing === 'wait') return;
    awaiting.current = false;
    if (landing === 'done') return;
    try {
      resetToBootRouter(router);
      reportRuntimeIssue('info', 'runtime.signedOutLanding', 'Signed out over a public screen: the boot router chooses', { top: top ?? null, gateHeld });
    } catch (error) {
      reportRuntimeIssue('error', 'runtime.signedOutLanding', error, { top: top ?? null, gateHeld });
    }
  }, [segments, gateHeld, router, isAuthenticated]);

  return null;
}
