import { AlertToasts } from '@/features/alerts/alert-toasts';
import { AppStack } from '@/navigation';
import { KeepAwakeController, SessionDiagnostics, SessionRouteSync } from '@/runtime';

/** Deep links into the session flow keep the tabs underneath, so Back leaves the flow to them. */
export const unstable_settings = { initialRouteName: '(tabs)' };

/**
 * `(app)`: present only while signed in (`Stack.Protected`, 04_mobile_specs §3.3). The tabs, and
 * the session flow above them; mounts the runtime's route resync (§3.7) and keep-awake (§6.6)
 * controllers, which the runtime step (73) implements behind these names.
 */
export default function AppLayout() {
  return (
    <>
      <AppStack />
      <SessionRouteSync />
      {/* W93-28 (FXR-M): quiet session-window measurements for W98 (runtime log only, no console). */}
      <SessionDiagnostics />
      <KeepAwakeController />
      {/* Fix wave J (JA2-05): the alert toasts Settings → Notifications promises, on every signed-in screen. */}
      <AlertToasts />
    </>
  );
}
