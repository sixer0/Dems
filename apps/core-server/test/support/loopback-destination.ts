/**
 * THE PERMISSIVE DESTINATION RULE, FOR TESTS ONLY (task 4 blueprint row 110; security addendum 04,
 * requirement AD-02 point 2: "the permissive rule a test needs is a value defined under
 * `apps/core-server/test/`; `src/` holds no such value").
 *
 * The set-network file dials only what the destination rule handed to it admits; in the product
 * that rule is `decideDestination` (`src/capture/destination-rule.ts`), and it refuses loopback.
 * Every camera double of this Mac lives on loopback (driver rule 8, decision U13), so a test that
 * drives the fake ONVIF stub hands THIS function to the file in place of the product's rule.
 *
 * It admits the loopback literal with any valid port, names the loopback literal as the source,
 * and refuses every other address with the product's own code for "not inside the camera subnet".
 * It is not a test file; no production source may import it (the layer rules of `test/static`
 * keep `src/` from `test/`).
 */
import { DestinationRefusal, type DestinationDecision } from '../../src/capture/destination-rule';

const LOOPBACK = '127.0.0.1';

export function loopbackDestination(address: string, port: number): DestinationDecision {
  if (address !== LOOPBACK) return { allowed: false, refusal: DestinationRefusal.OUTSIDE_CAMERA_SUBNET };
  if (!Number.isInteger(port) || port < 1 || port > 65_535) return { allowed: false, refusal: DestinationRefusal.PORT_OUT_OF_RANGE };
  return { allowed: true, destination: { address: LOOPBACK, port, sourceAddress: LOOPBACK, viaAlias: false } };
}
