/**
 * MotionPolicyProvider (04_mobile_specs §3.2 item 6, §7.7; D43).
 *
 * Feeds the motion store and applies the policy app-wide:
 * - OS reduce motion: Reanimated's start-time value (`useReducedMotion`, VM-05) seeds the first
 *   render, then `AccessibilityInfo.isReduceMotionEnabled()` and the `reduceMotionChanged`
 *   listener keep it live (VM-06);
 * - the persisted Settings switches (`dems.mobile.prefs.v1`: `reduceMotion`, `haptics`);
 * - deep-link switches on every incoming URL: `?motion=off` (D43 test switch: ambient loops off so
 *   uiautomator / Maestro reach idle), `?motion=slow` (proof ×10), `?motion=full`, `?debug=1|0`;
 * - app state: loops pause in the background;
 * - renders `<ReducedMotionConfig mode={reduced ? ReduceMotion.Always : ReduceMotion.Never}>`
 *   (explicit modes, because `System` would only use the start-time value, VM-05);
 * - mounts the `?debug=1` overlay;
 * - watches the animation runtime (`./ui-runtime-watch`, fix wave J): when it stops, the policy turns
 *   `reduced` for the rest of the process and the children are mounted anew under it.
 *
 * The HeroUI Native `animation: 'disable-all'` switch lives in `AppProviders` (step 68,
 * `heroUIConfig(reducedMotion)`). The root layout (step 70) passes the policy through the render
 * prop, because a hook cannot read a provider that the same component renders:
 *
 *   <MotionPolicyProvider>
 *     {(policy) => <AppProviders reducedMotion={policy === 'reduced'}>…</AppProviders>}
 *   </MotionPolicyProvider>
 *
 * `kitAnimation(policy)` gives the same value for any other kit root.
 */
import * as Linking from 'expo-linking';
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, AppState, LogBox, Pressable, StyleSheet, Text, View } from 'react-native';
import { fontFamily, palette, spacing, typography } from '@dems/shared/tokens';
import { ReduceMotion, ReducedMotionConfig, useReducedMotion } from 'react-native-reanimated';
import { MotionDebugOverlay } from './debug-overlay';
import { reportMotionIssue } from './log';
import { motionStore } from './policy';
import { MOBILE_PREFS_KEY, readMotionPrefs } from './prefs';
import type { MotionPolicy } from './tokens';
import { restartNow, useUiRuntimeWatch } from './ui-runtime-watch';
import { useMotionPolicy, useMotionState } from './use-motion-policy';

// Reanimated prints one dev warning when ReducedMotionConfig overrides the system value. The
// override is intended (explicit modes, VM-05), so the LogBox banner, which would cover the bottom
// bar in screencaps and Maestro taps, is suppressed for this exact message; Metro still logs it.
LogBox.ignoreLogs(['[Reanimated] Reduced motion setting is overwritten with mode']);

/** The `ReducedMotionConfig` mode for a policy. */
export function reducedMotionMode(policy: MotionPolicy): ReduceMotion {
  return policy === 'reduced' ? ReduceMotion.Always : ReduceMotion.Never;
}

export interface MotionPolicyProviderProps {
  /** Children, or a render function that receives the policy (for `AppProviders reducedMotion`). */
  children: ReactNode | ((policy: MotionPolicy) => ReactNode);
  /** Mount the `?debug=1` overlay here (default true). Pass false to mount `MotionDebugOverlay` elsewhere. */
  debugOverlay?: boolean;
}

export function MotionPolicyProvider({ children, debugOverlay = true }: MotionPolicyProviderProps) {
  const startTimeReduced = useReducedMotion();
  const url = Linking.useLinkingURL();

  // Seed once, before the children's first render, so the first frame already follows the OS
  // setting and a launch deep link (`?motion=off`). Both setters are no-ops when nothing changes.
  useState(() => {
    const store = motionStore.getState();
    store.setOsReduceMotion(startTimeReduced);
    store.applyLinkingUrl(url);
    return true;
  });

  // Later deep links (the app already running).
  useEffect(() => {
    motionStore.getState().applyLinkingUrl(url);
  }, [url]);

  // Live OS reduce-motion setting.
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (alive) motionStore.getState().setOsReduceMotion(enabled);
      })
      .catch((error: unknown) => reportMotionIssue('warn', 'motion.provider.osReduceMotion', error));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      motionStore.getState().setOsReduceMotion(enabled);
    });
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  // Foreground / background.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      motionStore.getState().setAppActive(state !== 'background');
    });
    return () => subscription.remove();
  }, []);

  // Persisted Settings switches.
  useEffect(() => {
    let alive = true;
    readMotionPrefs()
      .then((prefs) => {
        if (alive) motionStore.getState().hydratePrefs(prefs);
      })
      .catch((error: unknown) => {
        reportMotionIssue('warn', 'motion.provider.readPrefs', error, { key: MOBILE_PREFS_KEY });
        if (alive) motionStore.getState().hydratePrefs({}, 'read');
      });
    return () => {
      alive = false;
    };
  }, []);

  // Fix wave J (JM-01 d): the heartbeat and the error trap of the animation runtime. When it has stopped the
  // policy below is `reduced` (reason `runtime`); `UiRuntimeBoundary` mounts the screens anew under it.
  useUiRuntimeWatch();
  const policy = useMotionPolicy();

  return (
    <>
      <ReducedMotionConfig mode={reducedMotionMode(policy)} />
      {typeof children === 'function' ? children(policy) : children}
      {debugOverlay ? <MotionDebugOverlay /> : null}
    </>
  );
}

/** The notice's words (plain: this screen must not depend on anything that can fail with the runtime). */
export const UI_RUNTIME_NOTICE = {
  title: 'The display is restarting',
  heldTitle: 'The display stopped',
  body: 'An animation fault stopped the display engine of this device. The app starts itself again; you will be asked to sign in.',
  heldBody: 'An animation fault stopped the display engine of this device, for the second time within a minute, so the app did not start itself again.',
  recording: 'A recording in progress is not affected: it continues on the Core server.',
  restart: 'Restart the app',
} as const;

/**
 * Fix wave J (JM-01 d: "one failed animation can never take a screen away"), the place where the screens meet
 * the state of the animation runtime (`./ui-runtime-watch`). It sits BELOW the app's providers (the root
 * layout puts it around the navigator).
 *
 * - The runtime REPORTED an error: the screens are not drawn at all - any of them may hold a view that waits,
 *   hidden, for an animation that will never run. A plain notice stands in their place while the app starts
 *   itself again; if it may not (a second fault within a minute) the notice offers the restart to the operator.
 * - Only the heartbeat is missing: the screens are mounted anew under the `still` settings (the operator stays
 *   signed in; the navigator keeps its route).
 */
export function UiRuntimeBoundary({ children }: { children: ReactNode }) {
  const stalled = useMotionState((s) => s.uiRuntimeStalled);
  const fault = useMotionState((s) => s.uiRuntimeFault);
  if (fault !== null) {
    const held = fault === 'held';
    return (
      <View style={noticeStyles.root} testID="ui-runtime-notice" accessibilityRole="alert">
        <Text style={noticeStyles.title} accessibilityRole="header">
          {held ? UI_RUNTIME_NOTICE.heldTitle : UI_RUNTIME_NOTICE.title}
        </Text>
        <Text style={noticeStyles.body}>{held ? UI_RUNTIME_NOTICE.heldBody : UI_RUNTIME_NOTICE.body}</Text>
        <Text style={noticeStyles.body}>{UI_RUNTIME_NOTICE.recording}</Text>
        {held ? (
          <Pressable style={noticeStyles.button} accessibilityRole="button" testID="ui-runtime-notice-restart" onPress={() => void restartNow()}>
            <Text style={noticeStyles.buttonLabel}>{UI_RUNTIME_NOTICE.restart}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  return <Fragment key={stalled ? 'ui-runtime-stalled' : 'ui-runtime-live'}>{children}</Fragment>;
}

const noticeStyles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3], padding: spacing[6], backgroundColor: palette.black },
  title: { fontFamily: fontFamily.native.semibold, fontSize: typography.h2.size, lineHeight: typography.h2.lineHeight, color: palette.foreground, textAlign: 'center' },
  body: { fontFamily: fontFamily.native.normal, fontSize: typography.body.size, lineHeight: typography.body.lineHeight, color: palette.gray, textAlign: 'center', maxWidth: 560 },
  button: { marginTop: spacing[3], paddingVertical: spacing[3], paddingHorizontal: spacing[6], borderRadius: 999, backgroundColor: palette.gold, minHeight: 48, justifyContent: 'center' },
  buttonLabel: { fontFamily: fontFamily.native.semibold, fontSize: typography.body.size, color: palette.black },
});
