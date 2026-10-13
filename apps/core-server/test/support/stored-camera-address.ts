/**
 * THE PERMISSIVE RULE OF A STORED CAMERA ADDRESS, FOR TESTS ONLY (task 4 blueprint row 46; security
 * addendum 04, requirement AD-02 point 2: "the permissive rule the full-session test needs is a
 * value defined under `apps/core-server/test/`; `src/` holds no such value").
 *
 * The credential reader refuses a camera whose STORED address fails the destination rule, before
 * the reveal (AD-02, AD-03 (4)); in the product that rule is `decideDestination` with the purpose
 * of a stored camera, and it refuses loopback. Every camera double of this Mac lives on loopback
 * (driver rule 8, decision U13), so an adapter-level test that reads a credential for a double
 * hands THIS function to `wireCaptureCredentialHolders` in place of the product's rule.
 *
 * It admits the loopback literal and nothing else. It is not a test file and imports nothing: no
 * production source may import it (the layer rules of `test/static` keep `src/` from `test/`).
 */
export type TestStoredAddressDecision = { readonly allowed: true } | { readonly allowed: false; readonly refusal: string };

/** `127.0.0.1` with any port, or none. Every other host is refused by a code of this file. */
export function loopbackStoredCameraAddress(host: string, _port: number | undefined): TestStoredAddressDecision {
  return host === '127.0.0.1' ? { allowed: true } : { allowed: false, refusal: 'TEST_RULE_LOOPBACK_ONLY' };
}
