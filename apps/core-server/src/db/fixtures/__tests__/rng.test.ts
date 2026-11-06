// The generator of the bulk fixture (plan row W25; BF-3, BF-4): deterministic, one stream per
// entity, and hash columns that are the hash of no credential. Database-free.
import {
  BIOMETRIC_TOKEN_PATTERN,
  DEVICE_CREDENTIAL_PATTERN,
  PAIRING_CODE_PATTERN,
  PAIRING_QR_PAYLOAD_PATTERN,
  SESSION_TOKEN_PATTERN,
} from '@dems/shared/api';
import { createRng, deriveSeed } from '@dems/shared/sim';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { BULK_FIXTURE_SEED, FIXTURE_TAG, fakeSecretHash, fakeSecretText, fixtureRng, type FakeSecretKind } from '../rng';

const KINDS: readonly FakeSecretKind[] = ['session-token', 'device-credential', 'device-credential-next', 'biometric-token', 'pairing-code'];

describe('the seeded generator', () => {
  it('is the shared generator: a stream is createRng(deriveSeed(seed, name))', () => {
    const fixture = fixtureRng(BULK_FIXTURE_SEED, 'operators');
    const shared = createRng(deriveSeed(BULK_FIXTURE_SEED, `${FIXTURE_TAG}:operators`));
    expect(Array.from({ length: 50 }, () => fixture.next())).toEqual(Array.from({ length: 50 }, () => shared.next()));
  });

  it('gives the same numbers for the same seed and stream, and other numbers for another seed or stream', () => {
    const draw = (seed: number, stream: string): number[] => {
      const rng = fixtureRng(seed, stream);
      return Array.from({ length: 20 }, () => rng.int(0, 1_000_000));
    };
    expect(draw(BULK_FIXTURE_SEED, 'a')).toEqual(draw(BULK_FIXTURE_SEED, 'a'));
    expect(draw(BULK_FIXTURE_SEED, 'a')).not.toEqual(draw(BULK_FIXTURE_SEED, 'b'));
    expect(draw(BULK_FIXTURE_SEED, 'a')).not.toEqual(draw(BULK_FIXTURE_SEED + 1, 'a'));
  });

  it('a stream is not shifted by what another stream draws', () => {
    const alone = fixtureRng(7, 'sessions');
    const expected = Array.from({ length: 10 }, () => alone.next());
    const other = fixtureRng(7, 'devices');
    const sessions = fixtureRng(7, 'sessions');
    const interleaved = Array.from({ length: 10 }, () => {
      other.bytes(13);
      return sessions.next();
    });
    expect(interleaved).toEqual(expected);
  });

  it('bytes: the length asked for, equal for equal streams, spread over the byte range', () => {
    const a = fixtureRng(1, 'bytes').bytes(4_096);
    const b = fixtureRng(1, 'bytes').bytes(4_096);
    expect(a).toHaveLength(4_096);
    expect(a.equals(b)).toBe(true);
    expect(new Set(a).size).toBeGreaterThan(250);
    expect(fixtureRng(1, 'bytes').bytes(0)).toHaveLength(0);
  });

  it('uuid: the form of a version-4 identifier, deterministic, and no repetition in ten thousand', () => {
    const rng = fixtureRng(BULK_FIXTURE_SEED, 'uuids');
    const ids = Array.from({ length: 10_000 }, () => rng.uuid());
    for (const id of ids.slice(0, 200)) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(new Set(ids).size).toBe(ids.length);
    expect(fixtureRng(BULK_FIXTURE_SEED, 'uuids').uuid()).toBe(ids[0]);
  });

  it('shuffle: a permutation, the input unchanged, deterministic', () => {
    const input = Array.from({ length: 200 }, (_, index) => index);
    const copy = [...input];
    const shuffled = fixtureRng(3, 'shuffle').shuffle(input);
    expect(input).toEqual(copy);
    expect([...shuffled].sort((x, y) => x - y)).toEqual(input);
    expect(shuffled).not.toEqual(input);
    expect(fixtureRng(3, 'shuffle').shuffle(input)).toEqual(shuffled);
    expect(fixtureRng(3, 'shuffle').shuffle([])).toEqual([]);
  });

  it('refuses a seed that is not a safe integer', () => {
    expect(() => fixtureRng(Number.NaN, 'x')).toThrow(RangeError);
    expect(() => fixtureRng(1.5, 'x')).toThrow(RangeError);
  });
});

describe('the fake secret of a hash column', () => {
  it('is the SHA-256 of a text that says what it is', () => {
    const text = fakeSecretText('session-token', 17, BULK_FIXTURE_SEED);
    expect(text).toBe(`dems-bulk-fixture/session-token/17/seed-${BULK_FIXTURE_SEED}`);
    const hash = fakeSecretHash('session-token', 17, BULK_FIXTURE_SEED);
    expect(hash).toHaveLength(32);
    expect(hash.equals(createHash('sha256').update(text, 'utf8').digest())).toBe(true);
  });

  it('is deterministic, and distinct for another kind, index or seed', () => {
    const hashes = new Set<string>();
    for (const kind of KINDS) {
      for (let index = 1; index <= 400; index += 1) hashes.add(fakeSecretHash(kind, index, BULK_FIXTURE_SEED).toString('hex'));
    }
    expect(hashes.size).toBe(KINDS.length * 400);
    expect(fakeSecretHash('pairing-code', 1, 1).equals(fakeSecretHash('pairing-code', 1, 1))).toBe(true);
    expect(fakeSecretHash('pairing-code', 1, 1).equals(fakeSecretHash('pairing-code', 1, 2))).toBe(false);
  });

  it('has the form of no credential of the server, so no request can present it', () => {
    const anywhere = (anchored: RegExp): RegExp => new RegExp(anchored.source.slice(1, -1));
    for (const kind of KINDS) {
      const text = fakeSecretText(kind, 123, BULK_FIXTURE_SEED);
      for (const pattern of [SESSION_TOKEN_PATTERN, DEVICE_CREDENTIAL_PATTERN, BIOMETRIC_TOKEN_PATTERN, PAIRING_QR_PAYLOAD_PATTERN, PAIRING_CODE_PATTERN]) {
        expect(pattern.test(text), `${kind} against ${pattern.source}`).toBe(false);
      }
      for (const pattern of [SESSION_TOKEN_PATTERN, DEVICE_CREDENTIAL_PATTERN, BIOMETRIC_TOKEN_PATTERN, PAIRING_QR_PAYLOAD_PATTERN]) {
        expect(anywhere(pattern).test(text), `${kind} holds ${pattern.source}`).toBe(false);
      }
      // A pairing code is hashed as "<code id>:<six digits>": the fake text is not of that form either.
      expect(/^PCD-[0-9]{6,}:[0-9]{6}$/.test(text)).toBe(false);
    }
  });
});
