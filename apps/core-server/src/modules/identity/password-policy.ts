/**
 * THE PASSWORD POLICY for a NEW password (task 4 blueprint row 212, package X2-1; design
 * `masterplan/05_design_x1_x2.md` section 3.5; security review SX-13; requirement R-X2-6; the
 * working defaults UD-6 and UD-12 of decisions C42 and C44).
 *
 * THE POLICY ITSELF LIVES IN THE SHARED PACKAGE since row V3 (decision C53 (2)):
 * `packages/shared/src/api/password-policy.ts` holds the rules, the numbers, the refusals and the
 * guard of one run, and is re-exported here unchanged. THIS FILE BINDS THE TWO FACTS that the
 * shared package cannot hold, and nothing else:
 *
 *   (a) THE DEMONSTRATION PASSWORD of rule 4, named BY IMPORT from the seed (`@dems/shared/sim`).
 *       The shared contract folder may not load the simulator's dataset, so the constant is handed
 *       to the shared judge from here. `checkNewPassword(password, operator)` is that judge with
 *       the fact bound: the function the host command (row 215) calls, its signature unchanged.
 *   (b) THE PER-RUN KEY OF THE REPEAT HELPER. `createRunRepeatGuard()` makes the keyed digest the
 *       shared guard is built on: HMAC-SHA-256 under a random key that is made for the run, lives
 *       in memory only, and cannot be exported from the runtime's key object. It is the runtime's
 *       own Web Crypto. It stays on the server because the shared package is also loaded by the
 *       phone and tablet client, whose runtime has no Web Crypto. Nothing is written anywhere;
 *       when the process ends, the key and the digests are gone. The limit is "within one run".
 *
 * It does not hash, store, log or print anything: the hash wrapper (`password-hash/`) and its
 * parameters are untouched and are called by the command, not from here.
 *
 * NO Node built-in, no file system, no logger, no clock. The two imports are the shared package's.
 */
import {
  PASSWORD_POLICY,
  PASSWORD_POLICY_REFUSAL,
  RunRepeatGuardError,
  checkNewPasswordAgainst,
  createRunRepeatGuardWith,
  type PasswordPolicyRefusal,
  type PasswordPolicyRefusalCode,
  type RunRepeatGuard,
} from '@dems/shared/api';
import { DEMO_OPERATOR_PASSWORD } from '@dems/shared/sim';

export { PASSWORD_POLICY, PASSWORD_POLICY_REFUSAL, RunRepeatGuardError, type PasswordPolicyRefusal, type PasswordPolicyRefusalCode, type RunRepeatGuard };

/**
 * Judges a NEW password for one operator: the shared policy with the seed's demonstration password
 * bound. `null` = accepted. Pure: the same input gives the same answer, and nothing is read or
 * written. Called before the password is hashed (R-X2-6).
 */
export function checkNewPassword(password: string, operator: { readonly username: string }): PasswordPolicyRefusal | null {
  return checkNewPasswordAgainst(password, operator, { demonstrationPassword: DEMO_OPERATOR_PASSWORD });
}

const DIGEST_ALGORITHM = { name: 'HMAC', hash: 'SHA-256' } as const;
const RUN_KEY_BYTES = 32;

function hexOf(bytes: Uint8Array): string {
  let out = '';
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0');
  return out;
}

/**
 * A guard for one run. The key is 32 random bytes of the runtime's generator, imported as a key
 * object that cannot be exported; the bytes it was made from are zeroed at once. Only digests are
 * kept, in memory, by the shared guard this hands its keyed digest to (`createRunRepeatGuardWith`).
 */
export async function createRunRepeatGuard(): Promise<RunRepeatGuard> {
  const runtime = globalThis.crypto;
  if (runtime === undefined || runtime.subtle === undefined || typeof runtime.getRandomValues !== 'function') throw new RunRepeatGuardError();
  const material = runtime.getRandomValues(new Uint8Array(RUN_KEY_BYTES));
  let key: CryptoKey;
  try {
    key = await runtime.subtle.importKey('raw', material, DIGEST_ALGORITHM, false, ['sign']);
  } catch {
    throw new RunRepeatGuardError();
  } finally {
    material.fill(0);
  }

  async function digestOf(password: string): Promise<string> {
    const bytes = new TextEncoder().encode(password);
    try {
      return hexOf(new Uint8Array(await runtime.subtle.sign(DIGEST_ALGORITHM.name, key, bytes)));
    } catch {
      throw new RunRepeatGuardError();
    } finally {
      bytes.fill(0);
    }
  }

  return createRunRepeatGuardWith(digestOf);
}
