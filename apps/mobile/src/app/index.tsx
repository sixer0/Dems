import { useLocalSearchParams } from 'expo-router';
import { BootRedirect, StackCheckRoute, firstParam, hasMotionParam } from '@/navigation';

/**
 * Route `/`: the boot router (04_mobile_specs §3.1).
 *
 * - With `?motion=` it renders the row-18 proof screen, so `demsdemo://?motion=slow` keeps opening
 *   Motion proof mode (AC-31, M-PX-02; 01_specs §5.6).
 * - Otherwise it redirects: `/login` while signed out; after sign-in the session resync target,
 *   else the pending href, else `/home` (§3.3). It is also the guard's anchor: when sign-in or
 *   sign-out removes the current group, Expo Router lands here and this picks the next screen.
 */
export default function BootRoute() {
  const params = useLocalSearchParams<{ motion?: string }>();
  if (hasMotionParam(params)) return <StackCheckRoute motion={firstParam(params.motion)} />;
  return <BootRedirect />;
}
