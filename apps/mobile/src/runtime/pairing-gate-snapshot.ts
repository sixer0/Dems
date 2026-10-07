/**
 * The pairing gate outside React (row FX-M1, defect E2E-S-4 of the end-to-end round; D201).
 *
 * Expo Router hands every system URL to `src/app/+native-intent.tsx` BEFORE routing, outside the
 * component tree, so the hook `usePairing()` cannot answer there. While the gate holds (LIVE, device
 * not PAIRED, MP-11) the `(auth)` and `(app)` groups are not in the root navigator, and Expo Router
 * drops a warm link to one of their routes without a word (`expo-router/build/fork/
 * useLinking.native.js`: a state whose route is not among the navigator's `routeNames` is ignored).
 * So the intent must know the gate to send such a link to `/pair` instead.
 *
 * The app's Live source writes the gate here while it runs (`createMobileLive`: at `start()`, at
 * every change, released at `stop()`); SIMULATED and HEARTBEAT never write it, so there it reads
 * "not held", which is what the gate is in those modes (AC-C-74). One owner at a time: a stopped
 * source releases only its own entry, so a source that already took over keeps it.
 */
import { isPairingBlocked, type PairingInfo } from './contract';

let owner: object | null = null;
let held = false;

/** The Live source `source` reports its gate. */
export function notePairingGate(source: object, pairing: PairingInfo | undefined): void {
  owner = source;
  held = isPairingBlocked(pairing);
}

/** The Live source `source` stopped: its gate no longer applies. */
export function releasePairingGate(source: object): void {
  if (owner !== source) return;
  owner = null;
  held = false;
}

/** True while the running Live source's gate holds (LIVE, device not PAIRED, credential still being read included). */
export function isPairingGateHeld(): boolean {
  return held;
}

/** Test hook: no source, gate not held. */
export function resetPairingGateForTests(): void {
  owner = null;
  held = false;
}
