/**
 * The generator of the bulk fixture (plan row W25; database contract BF-3, BF-4, §5.1).
 *
 * DETERMINISM. Everything the fixture draws comes from here, and everything here is a function
 * of one integer seed and a stream name. The pseudo-random core is the shared simulator's
 * `mulberry32` (`@dems/shared/sim`, `createRng`, `deriveSeed`), as BF-3 asks: one generator in
 * the repository, no new dependency. This file adds what a fixture needs on top of it (bytes, an
 * identifier in UUID form, a pick without repetition) and the one function that makes the hash
 * of an obviously fake secret.
 *
 * ONE STREAM PER ENTITY. Each kind of row draws from its own stream (`fixture:operators`,
 * `fixture:sessions`, ...), so that a change of one entity's rows never shifts the numbers
 * another entity draws.
 *
 * NO SECRET. A hash column of the fixture holds the SHA-256 of a text that says what it is
 * (`dems-bulk-fixture/session-token/17/seed-20261004`). That text has not the form of any
 * credential of the server (no prefix `ses_`, `dvc_`, `bio_`, not six digits), so no request can
 * ever present a value that hashes to a fixture row. Nothing here reads a clock, a file, the
 * environment or the system's random source.
 */
import { createHash } from 'node:crypto';
import { createRng, deriveSeed, type Rng } from '@dems/shared/sim';

/** The seed of the bulk fixture (BF-3: a fixed seed). */
export const BULK_FIXTURE_SEED = 20_261_004;

/** The prefix of every stream name and of every fake secret text. */
export const FIXTURE_TAG = 'dems-bulk-fixture';

export interface FixtureRng extends Rng {
  /** `length` pseudo-random bytes. */
  bytes(length: number): Buffer;
  /** An identifier in the form of a version-4 UUID, from 16 pseudo-random bytes. */
  uuid(): string;
  /** The items in a pseudo-random order (Fisher-Yates); the input is not changed. */
  shuffle<T>(items: readonly T[]): T[];
}

/** The stream `stream` of the fixture seeded with `seed`. Two calls give two equal streams. */
export function fixtureRng(seed: number, stream: string): FixtureRng {
  if (!Number.isSafeInteger(seed)) throw new RangeError('the fixture seed must be a safe integer.');
  const core = createRng(deriveSeed(seed, `${FIXTURE_TAG}:${stream}`));
  const bytes = (length: number): Buffer => {
    const out = Buffer.alloc(length);
    for (let index = 0; index < length; index += 1) out[index] = Math.floor(core.next() * 256);
    return out;
  };
  return {
    ...core,
    bytes,
    uuid() {
      const raw = bytes(16);
      // Version 4 and the RFC 4122 variant, so the value has the form the column's default makes.
      raw[6] = ((raw[6] ?? 0) & 0x0f) | 0x40;
      raw[8] = ((raw[8] ?? 0) & 0x3f) | 0x80;
      const hex = raw.toString('hex');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const out = [...items];
      for (let index = out.length - 1; index > 0; index -= 1) {
        const other = Math.floor(core.next() * (index + 1));
        const held = out[index] as T;
        out[index] = out[other] as T;
        out[other] = held;
      }
      return out;
    },
  };
}

/** What a fake secret stands in for. The name goes into the hashed text. */
export type FakeSecretKind = 'session-token' | 'device-credential' | 'device-credential-next' | 'biometric-token' | 'pairing-code';

/** The text a fixture hash column is the SHA-256 of. It says what it is and is no credential. */
export function fakeSecretText(kind: FakeSecretKind, index: number, seed: number): string {
  return `${FIXTURE_TAG}/${kind}/${index}/seed-${seed}`;
}

/** 32 bytes: the SHA-256 of `fakeSecretText(kind, index, seed)`. Distinct inputs, distinct hashes. */
export function fakeSecretHash(kind: FakeSecretKind, index: number, seed: number): Buffer {
  return createHash('sha256').update(fakeSecretText(kind, index, seed), 'utf8').digest();
}
