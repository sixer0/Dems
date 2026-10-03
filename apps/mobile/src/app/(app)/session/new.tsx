import { Redirect, useLocalSearchParams } from 'expo-router';
import { SessionNewScreen } from '@/features/session-new/session-new-screen';
import { parseSessionStep, useSessionNewRedirect } from '@/navigation';

/**
 * Route `/session/new?step=1|2|3` (MB 3; 04_mobile_specs §4.4). Refused with a toast while a
 * session is busy (§3.5); the step is parsed with zod (invalid or absent → 1).
 */
export default function SessionNewRoute() {
  const { step } = useLocalSearchParams<{ step?: string }>();
  const redirect = useSessionNewRedirect();
  if (redirect !== null) return <Redirect href={redirect} />;
  return <SessionNewScreen step={parseSessionStep(step)} />;
}
