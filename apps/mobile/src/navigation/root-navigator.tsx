import { Redirect, Stack, useRouter, useSegments, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { palette } from '@dems/shared/tokens';
import { stackAnimation, useMotionSettings } from '@/motion';
import { useActiveSession, useAuth, type ActiveSessionInfo } from '@/runtime';
import { clearPendingHref, peekPendingHref, setSignedInSnapshot } from './pending-href';
import { postSignInHref, sessionResyncHref } from './session-routes';

/**
 * The root stack with the auth guard (04_mobile_specs §3.3), rendered by `src/app/_layout.tsx`
 * inside the providers:
 *
 * - public: `/` (boot router), `/stack-check`, `/pair`, plus `/dev-gallery` (debug) and
 *   `+not-found`, which Expo Router adds automatically because they are not listed as protected;
 * - `(auth)` only while signed out, `(app)` only while signed in (`Stack.Protected`, VM-08).
 *
 * When the guard removes the current group (sign-in, sign-out, idle expiry, Lock console), Expo
 * Router falls back to the anchor `/`, and the boot router picks the target. One case needs help:
 * `/login` opened over a public screen (a guarded deep link arriving on `/stack-check` or `/pair`,
 * see `+native-intent`). After sign-in that public screen is still underneath, so there is no
 * fallback to `/`; the navigator then replaces it with `/`, so the boot router still applies the
 * §3.3 order (resync target, pending href, Home). Recording is never touched by the guard (§3.3).
 */
export function RootNavigator() {
  const { isAuthenticated } = useAuth();
  const motionSettings = useMotionSettings();
  const segments = useSegments();
  const router = useRouter();
  const wasAuthenticated = useRef(isAuthenticated);
  const awaitingTarget = useRef(false);

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
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={isAuthenticated}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

/** Reads `summaryAcknowledged` if the runtime (step 73, SCR-02) adds it to the session summary. */
function summaryAcknowledgedOf(session: ActiveSessionInfo): boolean | undefined {
  const value = (session as ActiveSessionInfo & { readonly summaryAcknowledged?: unknown }).summaryAcknowledged;
  return typeof value === 'boolean' ? value : undefined;
}

/**
 * The boot router's target (04 §3.1 `index.tsx`, §3.3): `/login` while signed out; after sign-in
 * the resync target (§3.7), else the pending href, else `/home`.
 */
export function useBootHref(): string {
  // Reads module state (the pending href) during render: opt out of React Compiler memoisation,
  // which assumes calls without reactive inputs return the same value every render.
  'use no memo';
  const { isAuthenticated } = useAuth();
  const session = useActiveSession();
  if (!isAuthenticated) return '/login';
  const resync = sessionResyncHref(session.state, {
    sessionId: session.sessionId,
    summaryAcknowledged: summaryAcknowledgedOf(session),
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
