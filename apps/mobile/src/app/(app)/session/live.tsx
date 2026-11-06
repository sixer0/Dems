import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { LayoutAnimationConfig } from 'react-native-reanimated';
import { SessionFinalizingScreen } from '@/features/session-finalizing/session-finalizing-screen';
import { MonitorLeavingNotice } from '@/features/session-live/monitor-leaving-notice';
import { SessionLiveScreen } from '@/features/session-live/session-live-screen';
import { useSessionLiveRedirect } from '@/navigation';
import { useLateStopHandoverMark } from '@/runtime';

/**
 * Route `/session/live` (MB 4; 04_mobile_specs §4.5). Opens only while RECORDING; otherwise it goes
 * where the current session belongs, or Home when there is none (§3.5).
 *
 * E-fix row FX-M2 (E2E-P-4, E2E-T-4): when the recording stops (on this device or on another
 * console) the monitor hands over to Finalizing IN PLACE: the same commit that drops the monitor
 * draws the Finalizing screen (no enter motion), and the redirect follows. Before, this route
 * rendered only the redirect, which draws nothing, and the device showed an empty screen until the
 * Finalizing route had mounted and faded in (about 1.2 s on the phone, 2 s on the tablet).
 *
 * Closing-fix row CF-M1 (R-P-1, the High crash of the re-test round): the hand-over removes the whole
 * monitor in one commit, and the redirect follows a moment later. Reanimated keeps every view with an
 * `exiting` animation (the link banner's fade; in full motion also the camera feed's cross-fade and the
 * NO SIGNAL fade) alive as a "ghost" with its ancestors, and rewrites the indices of the next mount
 * instructions around it (`LayoutAnimationsProxy_Legacy`). On the phone that bookkeeping went wrong in the
 * hand-over: `Tried to remove view [21688] of parent [20372] at index 0, but got view tag 19014`, then
 * `addViewAt: failed to insert view [22216] into parent [20378] at index 1` (IndexOutOfBounds, count 0) in
 * the monitor's own subtree, and React Native destroyed the React instance. So the monitor is wrapped in
 * `LayoutAnimationConfig skipExiting`: when the hand-over (or anything else that is not a screen pop)
 * unmounts it, Reanimated runs NO exiting animation below it, keeps no ghost and shifts no index; the
 * removal is a plain Fabric removal. The host view under the wrapper is not collapsable, so its tag is the
 * one Reanimated reads (`findNodeHandle`) and the one that leaves the tree.
 */
export default function SessionLiveRoute() {
  const redirect = useSessionLiveRedirect();
  // Row 62 (B11): the instant of the in-place hand-over, for the late-stop measurement. Renders nothing.
  useLateStopHandoverMark(redirect === '/session/finalizing');
  if (redirect === '/session/finalizing') {
    return (
      <>
        <SessionFinalizingScreen handover />
        <Redirect href={redirect} />
      </>
    );
  }
  // Round two (JA2-19): a recording ended from OUTSIDE (a fault that opens recovery, a session that is gone) left
  // this route with a redirect only, which draws nothing - a black screen for 1.5 s or more on the phone. The
  // route says in one plain sentence what happened until the next screen has mounted (no motion, no ghost: the
  // same rule as the Finalizing hand-over above).
  if (redirect !== null) {
    return (
      <>
        <MonitorLeavingNotice to={redirect} />
        <Redirect href={redirect} />
      </>
    );
  }
  return (
    <LayoutAnimationConfig skipExiting>
      <View collapsable={false} style={styles.monitor} testID="session-live-exit-boundary">
        <SessionLiveScreen />
      </View>
    </LayoutAnimationConfig>
  );
}

const styles = StyleSheet.create({ monitor: { flex: 1 } });
