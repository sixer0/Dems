import { Redirect } from 'expo-router';
import { SessionLiveScreen } from '@/features/session-live/session-live-screen';
import { useSessionLiveRedirect } from '@/navigation';

/**
 * Route `/session/live` (MB 4; 04_mobile_specs §4.5). Opens only while RECORDING; otherwise it goes
 * where the current session belongs, or Home when there is none (§3.5).
 */
export default function SessionLiveRoute() {
  const redirect = useSessionLiveRedirect();
  if (redirect !== null) return <Redirect href={redirect} />;
  return <SessionLiveScreen />;
}
