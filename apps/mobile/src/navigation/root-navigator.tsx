import { Redirect, Stack, useRouter, useSegments, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { palette } from '@dems/shared/tokens';
import { putKeyboardAway } from '@/lib/keyboard';
import { stackAnimation, useMotionSettings } from '@/motion';
import { isPairingBlocked, useActiveSession, useAuth, usePairing } from '@/runtime';
import { clearPendingHref, peekPendingHref, setSignedInSnapshot } from './pending-href';
import { postSignInHref, sessionResyncHref } from './session-routes';

/**
 * The root stack with the auth guard (04_mobile_specs §3.3) and the pairing-required gate
 * (04_client_integration_spec §9.4 MP-11), rendered by `src/app/_layout.tsx` inside the providers:
 *
 * - public: `/` (boot router), `/stack-check`, `/pair`, plus `/dev-gallery` (debug) and
 *   `+not-found`, which Expo Router adds automatically because they are not listed as protected;
 * - `(auth)` only while signed out AND not blocked, `(app)` only while signed in AND not blocked,
 *   `dev-gallery` only while not blocked (`Stack.Protected`, VM-08; MP-11).
 *
 * `blocked` = `isPairingBlocked(pairing)` (MP-11): true only in LIVE mode while the device is not
 * PAIRED (also while its stored credential is still being read). In SIMULATED and HEARTBEAT mode
 * `pairing.required` is false, so `blocked` is false and every guard behaves exactly as before
 * (AC-C-74): the existing guard tests pass unchanged.
 *
 * When a guard removes the current group (sign-in, sign-out, idle expiry, Lock console, a revocation
 * or an unknown credential), React Navigation keeps every route that is still allowed. Only when
 * nothing is left underneath does Expo Router fall back to the anchor `/`, where the boot router
 * picks the target: `/pair` first when blocked (§9.4 route table, AC-C-73, AC-C-78), else the §3.3
 * order. A public screen left underneath needs help, in each direction:
 *
 * - After a SIGN-IN (this navigator): `/login` opened over a public screen (a guarded deep link
 *   arriving on `/stack-check` or `/pair`, see `+native-intent`) leaves that screen underneath; the
 *   effect below replaces it with `/`, so the boot router still applies the order (resync target,
 *   pending href, Home). While blocked, `/login` is itself guarded out, so such a link falls through
 *   `/` to `/pair` and stays pending (MP-12).
 * - After a SIGN-OUT (not this navigator): `SignedOutLanding` (`src/runtime/signed-out-landing.tsx`,
 *   row FX-M1, E2E-S-1; decision DX-2: the landing is mounted by `src/app/_layout.tsx` beside this
 *   navigator) resets the stack to `/` when a public screen is left on top, so the boot router
 *   chooses `/login`, or `/pair` while the gate holds.
 *
 * Recording is never touched by the auth guard (§3.3).
 */
export function RootNavigator() {
  const { isAuthenticated } = useAuth();
  const blocked = isPairingBlocked(usePairing());
  const motionSettings = useMotionSettings();
  const segments = useSegments();
  const router = useRouter();
  const wasAuthenticated = useRef(isAuthenticated);
  const awaitingTarget = useRef(false);

  // Fix wave J (JT-23 / JM-04): the soft keyboard belongs to the screen whose field opened it. Seen on both
  // devices: it stayed over Finalizing after the End Session reason, and once over Devices, a screen with no
  // field at all. Every change of route puts it away; a field of the new screen that takes focus opens it again.
  const route = segments.join('/');
  useEffect(() => putKeyboardAway(), [route]);

  useEffect(() => {
    setSignedInSnapshot(isAuthenticated);
    if (isAuthenticated && !wasAuthenticated.current) awaitingTarget.current = true;
    wasAuthenticated.current = isAuthenticated;
  }, [isAuthenticated]);

  // After a sign-in, once the auth group is gone: a public screen left on top goes to the boot router.
  useEffect(() => {
    if (!awaitingTarget.current) return;
    const top = segments[0];
    if (top === '(auth)') return; // the guard has not removed the login route yet
    awaitingTarget.current = false;
    if (top !== undefined && top !== '(app)') router.replace('/');
  }, [segments, router, isAuthenticated]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: stackAnimation('auth', motionSettings),
        contentStyle: { backgroundColor: palette.black },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="stack-check" />
      <Stack.Screen name="pair" />
      {/* MP-11: the pairing gate adds "and not blocked" to the two auth guards, and guards the
          debug gallery by "not blocked" alone. `index`, `stack-check` and `pair` stay unguarded, so
          an unpaired device in LIVE mode still reaches `/pair` and Stack Check. */}
      <Stack.Protected guard={!isAuthenticated && !blocked}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={isAuthenticated && !blocked}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!blocked}>
        <Stack.Screen name="dev-gallery" />
      </Stack.Protected>
    </Stack>
  );
}

/**
 * The boot router's target (04 §3.1 `index.tsx`, §3.3; §9.4 MP-11): `/pair` FIRST while the pairing
 * gate blocks (LIVE mode, device not PAIRED — AC-C-73); else `/login` while signed out; after
 * sign-in the resync target (§3.7), else the pending href, else `/home`. While blocked the pending
 * href is neither read nor dropped: a guarded link that arrived meanwhile is used only after both
 * the pairing and the sign-in (MP-12).
 */
export function useBootHref(): string {
  // Reads module state (the pending href) during render: opt out of React Compiler memoisation,
  // which assumes calls without reactive inputs return the same value every render.
  'use no memo';
  const { isAuthenticated } = useAuth();
  const session = useActiveSession();
  if (isPairingBlocked(usePairing())) return '/pair';
  if (!isAuthenticated) return '/login';
  // W93-22 (FXR-M): the runtime's contract declares `summaryAcknowledged` (`runtime/contract.ts`); read directly.
  const resync = sessionResyncHref(session.state, {
    sessionId: session.sessionId,
    ...(session.summaryAcknowledged !== undefined ? { summaryAcknowledged: session.summaryAcknowledged } : {}),
  });
  return postSignInHref(resync, peekPendingHref());
}

/**
 * Redirects from `/` to the boot target. The pending href is read during render and dropped in
 * the same commit as the redirect, so a re-render never reuses it and a signed-out render never
 * loses it.
 */
export function BootRedirect() {
  'use no memo';
  const { isAuthenticated } = useAuth();
  const href = useBootHref();

  useEffect(() => {
    if (isAuthenticated) clearPendingHref();
  }, [isAuthenticated, href]);

  // The target is either a literal route or a pending href that passed `toInternalHref` (params.ts).
  return <Redirect href={href as Href} />;
}
