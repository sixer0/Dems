import { PairingScreen } from '@/features/pairing/pairing-screen';

/** Route `/pair` (public; reachable from Login and from Settings → Security, 04_mobile_specs §3.1). */
export default function PairRoute() {
  return <PairingScreen />;
}
