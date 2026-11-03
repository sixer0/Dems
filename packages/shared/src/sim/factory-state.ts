/**
 * The state a FACTORY database is seeded from (PT GSP, ruling of 30 Oct 2026).
 *
 * A unit leaving the factory holds no demonstration data: no subject, no example session, no
 * evidence item, no transcript, no export, no pairing code and no example audit row. This builder
 * therefore starts from `createNeutralState` — the product's OWN "a Core that holds no data" value
 * (empty lists, an empty device identity, the counters at their first value, the chain at its
 * genesis hash) — and adds the two things a factory database must hold:
 *
 *   - the two vendor identities of `FACTORY_OPERATORS`, so that the pre-deliver procedure
 *     (arranging the cameras and microphones, the diagnostics run, `acceptInstallation`, filling in
 *     the client's name) has an actor to sign in as once a human set its password;
 *   - the installation identity of THIS unit, handed in by the caller: the device id, the name and
 *     the fingerprint of the unit's own certificate. They are read from the Core's own environment
 *     keys by `db:seed --factory`, never from the demonstration dataset — the demo id
 *     (`DEMS-IR-01`) is one of the ids `ReservedInstallationId` forbids a real installation to
 *     carry, and the demo fingerprint belongs to the demonstration package of the repository.
 *
 * It is NOT `createIdleState`: that baseline IS the demonstration dataset (its history replay puts
 * subjects, evidence and 82 audit rows on the chain), which is exactly what must stay off a unit.
 * The hardware identity `DeviceIdentity` stays empty until provisioning reads the real board.
 *
 * Pure: the same input gives the same state.
 */
import { createNeutralState } from '../live/source/neutral-state';
import { FACTORY_OPERATORS } from './dataset';
import type { EpochMs, SimState } from './types';

/** What a factory unit is named by: the three texts its own configuration and certificate carry. */
export interface FactoryIdentityInput {
  /** The installation device id of this unit (`DEMS_INSTALLATION_DEVICE_ID`), e.g. `DEMS-BENCH-01`. */
  readonly installationDeviceId: string;
  /** The installation name (`DEMS_INSTALLATION_NAME`); it is also the room the acceptance record copies. */
  readonly installationName: string;
  /** The certificate fingerprint the pairing screen shows: 16 colon-separated byte pairs of the unit's own certificate. */
  readonly certificateFingerprint: string;
}

/**
 * The state of a factory seed: the neutral state, the two vendor identities and this unit's name.
 * `meta.counters` stays at the neutral 1 (the first id of each registry is the first real one), and
 * `audit`/`events`/`evidence`/`sessionHistory` stay empty, so the seed writes no chain row at all.
 */
export function createFactoryState(now: EpochMs, identity: FactoryIdentityInput): SimState {
  const neutral = createNeutralState(now);
  return {
    ...neutral,
    operators: FACTORY_OPERATORS.map((operator) => ({ ...operator })),
    device: {
      ...neutral.device,
      id: identity.installationDeviceId,
      name: identity.installationName,
      room: identity.installationName,
    },
    // Only `certificateFingerprint` of the pairing slice is stored (mapping/slices.ts); the state's
    // own pairing stays UNPAIRED: a factory unit has no tablet paired yet.
    pairing: { ...neutral.pairing, certificateFingerprint: identity.certificateFingerprint },
  };
}
