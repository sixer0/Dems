/**
 * WHICH VERSION A FOOTER SHOWS (fix wave J round two; finding JW-26 mobile half, JA2-30; contract_wave_j.md
 * "J2-S 2", client rule 2-5).
 *
 * The Login footer, the rail's foot and the More page printed `SOFTWARE_VERSION` - the DEMONSTRATION device
 * model's "2.4.1" - on every Core, also one in its own capture, where it is the version of nothing real.
 *
 * - LIVE (the app shows a Core server's data): the app states its OWN build, `Constants.expoConfig.version`
 *   (the one constant; it is what the app sends as `appVersion` at pairing), labelled as the app's.
 * - Simulated source (the in-app simulator, the demonstration): the model's version, as before.
 *
 * The Core's own versions (Core server, capture worker, API contract) are operation 64's `components`,
 * shown on Settings -> About (`lib/core-components.ts`).
 */
import Constants from 'expo-constants';
import { SOFTWARE_VERSION } from '@dems/shared/sim';
import { useCoreLink } from '@/runtime';

export type ShownVersionKind = 'APP' | 'MODEL';

export interface ShownVersion {
  readonly version: string;
  readonly kind: ShownVersionKind;
}

/** The app's own build version, or null when the build states none. */
export function ownAppVersion(): string | null {
  const version = Constants.expoConfig?.version;
  return typeof version === 'string' && version !== '' ? version : null;
}

/** Pure. */
export function shownVersionOf(input: { readonly live: boolean; readonly appVersion: string | null }): ShownVersion {
  if (input.live && input.appVersion !== null) return { version: input.appVersion, kind: 'APP' };
  return { version: SOFTWARE_VERSION, kind: 'MODEL' };
}

export function useShownVersion(): ShownVersion {
  const live = useCoreLink().source === 'LIVE';
  return shownVersionOf({ live, appVersion: ownAppVersion() });
}
