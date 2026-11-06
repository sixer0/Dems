/**
 * THE KEY MAKER OF THE FIRST FULL SESSION (task 4 blueprint row 89; security addendum 04, requirement
 * AD-08 (1): "a signing key without the development mark, made by test support under
 * `apps/core-server/test/`"; static rule row 157 (b) of `src/capture/__tests__/static.test.ts` holds
 * that no production source imports this file).
 *
 * Test support, not a test file: it imports no Vitest and no `__tests__` folder (rule CPB1-12 of
 * `test/static/imports.test.ts`). It generates NO key pair of its own: the key is made by the ONE fixture
 * of the boot checks, `realBootFixture` (wave-12 brief rule 3), which the calling test makes and hands in;
 * the fixture's `provisionKey()` calls the signer's own `provisionSigningKey` into the fixture's data
 * directory - a temporary directory of the operating system, mode 0700, never below the repository. What
 * this file adds is the PROOF, by the product's own readers, that the key passes the boot's checks 4, 4b
 * and 4b-2 by real means:
 *
 *   - check 4: the key loads (`storedSigningKeyReaders().problem` answers null);
 *   - check 4b: its certificate carries NO development mark (`isDevelopment` answers false) - the reader the
 *     boot asks when no seam is injected (`capture/boot/index.ts`, `signingKeyQuestionsOf`);
 *   - check 4b-2: its organisational unit names THIS installation (`Evidence signing <id>`), and the id is
 *     not one of the reserved ids a production Core refuses (check 4b-3).
 *
 * A key that fails any of them is not handed out: the maker removes the fixture and throws. `gone()` says
 * whether the data directory (key store, media, credential store) and the programs directory are both
 * gone - the hygiene check of AD-08 (4).
 */
import { existsSync } from 'node:fs';
import { SIGNING_KEY_UNIT_PREFIX, storedSigningKeyReaders } from '../../src/capture/boot';
import { ReservedInstallationId, SIGNING_STORE_SUBPATH } from '../../src/capture/boot/checks';

/** What the maker needs of the boot fixture (`realBootFixture` of `src/capture/boot/__tests__/support.ts`), made by the calling test. */
export interface KeyFixture {
  readonly dataDir: string;
  /** Made at its first ask. */
  readonly programsDir: string;
  readonly installationId: string;
  provisionKey(): void;
  remove(): void;
}

/** What the maker proved of the key it made, by the product's readers. */
export interface ProductionKeyFacts {
  /** Check 4: null = the key loads. */
  readonly problem: string | null;
  /** Check 4b: false = no development mark. */
  readonly development: boolean;
  /** Check 4b-2: the organisational units of the certificate. */
  readonly units: readonly string[];
  /** The key id the one load gave. */
  readonly keyId: string | null;
}

export interface ProductionTestKey {
  readonly installationId: string;
  /** The directory of the signer's store below the fixture's data directory. */
  readonly signingDir: string;
  /** The fixture's programs directory (the stand-ins of the test live there). */
  readonly programsDir: string;
  readonly facts: ProductionKeyFacts;
  /** True when the data directory and the programs directory of the fixture both do not exist. */
  gone(): boolean;
}

/** `code` of a key the maker refuses to hand out. */
export const PRODUCTION_TEST_KEY_REFUSED = 'PRODUCTION_TEST_KEY_REFUSED';

const RESERVED: readonly string[] = Object.values(ReservedInstallationId);

/** The facts the boot's own readers state of the key stored under `signingDir`, read as the boot reads them, at `now`. */
export function productionKeyFactsOf(signingDir: string, now: number): ProductionKeyFacts {
  const readers = storedSigningKeyReaders();
  const problem = readers.problem(signingDir, now);
  return { problem, development: readers.isDevelopment(signingDir, now), units: readers.organisationalUnits(signingDir, now) ?? [], keyId: readers.loadedKeyId() };
}

/**
 * Provisions the fixture's key - a PRODUCTION key of the fixture's installation id (a synthetic,
 * non-reserved id of the calling test) - and proves it with the boot's own readers at `checkAt` (the
 * instant the test's Core boots at). Removes the fixture and throws when the id is reserved or a reader
 * disagrees.
 */
export function makeProductionTestKey(fixture: KeyFixture, checkAt: number): ProductionTestKey {
  const { installationId } = fixture;
  const refuse = (message: string, facts: Partial<ProductionKeyFacts> = {}): never => {
    fixture.remove();
    throw Object.assign(new Error(message), { code: PRODUCTION_TEST_KEY_REFUSED, problem: facts.problem ?? null, development: facts.development ?? null });
  };
  if (RESERVED.includes(installationId) || !/^[A-Z][A-Z0-9-]{0,31}$/.test(installationId)) refuse('the installation id of a production test key must be a synthetic, non-reserved device id');
  const signingDir = `${fixture.dataDir}/${SIGNING_STORE_SUBPATH}`;
  let facts: ProductionKeyFacts;
  try {
    fixture.provisionKey();
    facts = productionKeyFactsOf(signingDir, checkAt);
  } catch (error) {
    fixture.remove();
    throw error;
  }
  if (facts.problem !== null || facts.development || !facts.units.includes(`${SIGNING_KEY_UNIT_PREFIX} ${installationId}`)) refuse('the made key is not a loadable production key of the installation', facts);
  // The programs directory is made at its first ask: its path is taken once, here, for `gone()`.
  const programsDir = fixture.programsDir;
  return {
    installationId,
    signingDir,
    programsDir,
    facts,
    gone: () => !existsSync(fixture.dataDir) && !existsSync(programsDir),
  };
}
