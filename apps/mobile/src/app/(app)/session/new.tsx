import { Redirect, useLocalSearchParams } from 'expo-router';
import { SessionNewScreen } from '@/features/session-new/session-new-screen';
import { StartEntryChecking } from '@/features/session-new/start-entry-checking';
import { useStartEntryGuard } from '@/features/session-new/use-start-entry-guard';
import { parseSessionStep, useSessionNewRedirect } from '@/navigation';

/**
 * Route `/session/new?step=1|2|3` (MB 3; 04_mobile_specs §4.4). Refused with a toast while a
 * session is busy (§3.5); the step is parsed with zod (invalid or absent → 1). R2 (E-fix row FX-M2,
 * decision D201): an operator without `SESSION_START` is not shown the wizard either; the route goes
 * to `/home` with "Not permitted / Requires the Investigator role" (`useStartEntryGuard`). Ruling W93-11
 * (D243): while the role is not yet known the route waits ("Checking your permissions…"), then applies
 * the same gate.
 */
export default function SessionNewRoute() {
  const { step } = useLocalSearchParams<{ step?: string }>();
  const redirect = useSessionNewRedirect();
  const entry = useStartEntryGuard({ enabled: redirect === null });
  if (redirect !== null) return <Redirect href={redirect} />;
  if (entry === '/home') return <Redirect href={entry} />;
  if (entry === 'checking') return <StartEntryChecking />;
  return <SessionNewScreen step={parseSessionStep(step)} />;
}
