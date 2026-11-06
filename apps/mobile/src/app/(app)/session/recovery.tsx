import { Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LayoutAnimationConfig } from 'react-native-reanimated';
import { SessionFinalizingScreen } from '@/features/session-finalizing/session-finalizing-screen';
import { SessionRecoveryScreen } from '@/features/session-recovery/session-recovery-screen';
import { useActiveSession } from '@/runtime';

/**
 * Route `/session/recovery` (T16; 04_mobile_specs §4.8).
 *
 * Task 3, integration pass D7 item 2 (MB-06; row 87's request; ux §5 flow 4, §5.6 "Hand-off: in
 * place"; E-13): a recovery that RESUMES the seal moves the session this route shows from FAULT /
 * RECOVERY to FINALIZING. Nothing forces a route change for that step (the runtime's route sync owns
 * STOPPING -> FINALIZING, FINALIZING -> SEALED and any -> FAULT), and the recovery screen then drew
 * its "not interrupted" notice. Now the commit that drops the recovery view draws the Finalizing
 * screen IN PLACE (`handover`: no enter motion, drawn from React only, row 87's B9), and the redirect
 * follows — the recipe of `live.tsx` (E-fix row FX-M2), with its `LayoutAnimationConfig skipExiting`
 * wrapper so that the removal of the recovery view keeps no Reanimated ghost (CF-M1).
 *
 * Only a session this route SHOWED in FAULT or RECOVERY is handed over: a deep link into
 * `/session/recovery` while another session finalizes keeps the screen's own notice, as before.
 */
export default function SessionRecoveryRoute() {
  const session = useActiveSession();
  // The session this route showed as interrupted ("adjusting state while rendering": no effect, so
  // the hand-over is decided in the very render that sees FINALIZING).
  const [shownId, setShownId] = useState<string | null>(null);
  const interrupted = session.state === 'FAULT' || session.state === 'RECOVERY';
  if (interrupted && session.sessionId !== null && session.sessionId !== shownId) setShownId(session.sessionId);

  if (session.state === 'FINALIZING' && session.sessionId !== null && session.sessionId === shownId) {
    return (
      <>
        <SessionFinalizingScreen handover />
        <Redirect href="/session/finalizing" />
      </>
    );
  }
  return (
    <LayoutAnimationConfig skipExiting>
      <View collapsable={false} style={styles.recovery} testID="session-recovery-exit-boundary">
        <SessionRecoveryScreen />
      </View>
    </LayoutAnimationConfig>
  );
}

const styles = StyleSheet.create({ recovery: { flex: 1 } });
