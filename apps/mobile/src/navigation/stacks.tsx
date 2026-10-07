import { Stack } from 'expo-router';
import { palette } from '@dems/shared/tokens';
import { stackAnimation, useMotionSettings } from '@/motion';
import { useActiveSession } from '@/runtime';
import { isSessionActive } from './session-routes';

/**
 * The nested stacks of the route tree (04_mobile_specs §3.1) with the M-APP-04 route motion
 * (`stackAnimation`, step 69: `fade` for tabs and auth, `slide_from_right` for drill-in,
 * `fade_from_bottom` into the session flow; a 160 ms cross-fade under reduced motion). Every
 * stack is headerless (screens draw their own headers, 04 §2.3) on the design-black canvas.
 */
const CONTENT_STYLE = { backgroundColor: palette.black } as const;

/** `(auth)/_layout.tsx`: Login (04 §3.1 "Stack, headerShown false, animation 'fade'"). */
export function AuthStack() {
  const motion = useMotionSettings();
  return <Stack screenOptions={{ headerShown: false, animation: stackAnimation('auth', motion), contentStyle: CONTENT_STYLE }} />;
}

/** `(app)/_layout.tsx`: the tabs, and the session flow above them (full-screen, no chrome, §2.3). */
export function AppStack() {
  const motion = useMotionSettings();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: CONTENT_STYLE }}>
      <Stack.Screen name="(tabs)" options={{ animation: stackAnimation('tabs', motion) }} />
      <Stack.Screen name="session" options={{ animation: stackAnimation('sessionFlow', motion) }} />
    </Stack>
  );
}

/**
 * Session-flow routes whose previous screen already draws them IN PLACE, so the route change swaps two
 * identical screens and must not fade (post-review fix FXR-M, finding W93-6; D236 RF-PH-3 residual):
 * the monitor draws Finalizing in the commit that drops it (`session/live.tsx`, D201) and Finalizing draws
 * the Summary once sealed (`session-finalizing-screen.tsx`, CF2-A). With the stack's `fade` the replace
 * still showed one 30-70 ms empty frame at the Summary (5/6 phone, 2/3 tablet runs in RF2).
 */
export const IN_PLACE_FLOW_ROUTES = ['finalizing', 'summary/[sessionId]'] as const;

/**
 * `(app)/session/_layout.tsx`: the session flow. While a session is active the back gesture is off
 * (04 §3.6 `gestureEnabled: false`); hardware back goes through the screens' back guards. Entering the
 * flow from the tabs keeps its motion: that belongs to `AppStack`'s `session` screen.
 */
export function SessionFlowStack() {
  const motion = useMotionSettings();
  const { state } = useActiveSession();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: stackAnimation('tabs', motion),
        gestureEnabled: !isSessionActive(state),
        contentStyle: CONTENT_STYLE,
      }}
    >
      {IN_PLACE_FLOW_ROUTES.map((name) => (
        <Stack.Screen key={name} name={name} options={{ animation: 'none' }} />
      ))}
    </Stack>
  );
}

/** Tab stacks with a list and a pushed detail (Sessions, Evidence, Devices, Settings). */
export function DrillInStack() {
  const motion = useMotionSettings();
  return <Stack screenOptions={{ headerShown: false, animation: stackAnimation('drillIn', motion), contentStyle: CONTENT_STYLE }} />;
}
