// Password-hash wrapper HB-4 (masterplan/02_plan.md W09; 01_specs.md SR-05, SR-06, SR-08, ID-2,
// ID-P10, AC-B-30): the record against the columns of `operator_credentials`, a round trip with
// the production parameters, rejection of a wrong password and of a tampered record, the
// unknown-user path, `needsRehash`, the input limits, and what an error may carry.
//
// Every password here is an obvious dummy made in the test. The production-cost derivation
// (19,456 KiB, 2 passes) runs a small, fixed number of times: the blocks that need it are marked
// "production cost"; everything else uses a derivation of 64 KiB or a fake.
import { randomBytes } from 'node:crypto';
import { inspect } from 'node:util';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  PASSWORD_HASH_ALGORITHM,
  PASSWORD_HASH_BYTES,
  PASSWORD_HASH_PARAMETERS,
  PASSWORD_MAX_LENGTH,
  PASSWORD_SALT_BYTES,
  PasswordHashError,
  PasswordHashErrorCode,
  createPasswordHasher,
  deriveArgon2id,
  hashPassword,
  needsRehash,
  verifyAgainstDummy,
  verifyPassword,
  type Argon2idDerive,
  type PasswordHashRecord,
  type StoredPasswordHash,
} from './index';

/** A new, obviously made-up password for every call. */
const dummyPassword = (): string => `dummy-${randomBytes(9).toString('base64url')}`;

/** The real derivation at a cost a test can afford; it still depends on every input byte. */
const cheapDerive: Argon2idDerive = (request) =>
  deriveArgon2id({ ...request, memoryKib: 64, passes: 1, parallelism: 1 });

/** A hash set written under older, cheaper parameters than the current ones. */
async function olderRecord(password: string): Promise<StoredPasswordHash> {
  const older = { memoryKib: 1024, passes: 1, parallelism: 1 };
  const salt = randomBytes(PASSWORD_SALT_BYTES);
  const hash = await deriveArgon2id({
    message: Buffer.from(password, 'utf8'),
    salt,
    tagLength: PASSWORD_HASH_BYTES,
    ...older,
  });
  return { algorithm: PASSWORD_HASH_ALGORITHM, ...older, salt, hash };
}

/** A copy of `buffer` with its first bit flipped. */
function flipped(buffer: Buffer): Buffer {
  const copy = Buffer.from(buffer);
  copy.writeUInt8(copy.readUInt8(0) ^ 0x01, 0);
  return copy;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('current parameters (SR-05)', () => {
  it('are argon2id, 19,456 KiB, 2 passes, parallelism 1, a 16-byte salt and a 32-byte tag', () => {
    expect(PASSWORD_HASH_ALGORITHM).toBe('argon2id');
    expect(PASSWORD_HASH_PARAMETERS).toEqual({ memoryKib: 19_456, passes: 2, parallelism: 1 });
    expect(PASSWORD_SALT_BYTES).toBe(16);
    expect(PASSWORD_HASH_BYTES).toBe(32);
    expect(PASSWORD_MAX_LENGTH).toBe(128);
  });
});

describe('hashPassword and verifyPassword with the built-in (production cost)', () => {
  let password: string;
  let record: PasswordHashRecord;

  beforeAll(async () => {
    password = dummyPassword();
    record = await hashPassword(password);
  });

  it('returns the hash set of SR-06, one member per column of operator_credentials', () => {
    expect(Object.keys(record).sort()).toEqual([
      'algorithm',
      'hash',
      'memoryKib',
      'parallelism',
      'passes',
      'salt',
    ]);
    expect(record.algorithm).toBe('argon2id');
    expect(record.memoryKib).toBe(19_456);
    expect(record.passes).toBe(2);
    expect(record.parallelism).toBe(1);
    expect(Buffer.isBuffer(record.salt)).toBe(true);
    expect(record.salt).toHaveLength(16);
    expect(Buffer.isBuffer(record.hash)).toBe(true);
    expect(record.hash).toHaveLength(32);
  });

  it('holds the tag the built-in derives from the UTF-8 password, the salt and the parameters', async () => {
    const tag = await deriveArgon2id({
      message: Buffer.from(password, 'utf8'),
      salt: record.salt,
      memoryKib: 19_456,
      passes: 2,
      parallelism: 1,
      tagLength: 32,
    });
    expect(tag.equals(record.hash)).toBe(true);
  });

  it('verifies the password it hashed', async () => {
    await expect(verifyPassword(password, record)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    await expect(verifyPassword(`${password}x`, record)).resolves.toBe(false);
  });

  it('rejects a tampered tag', async () => {
    await expect(verifyPassword(password, { ...record, hash: flipped(record.hash) })).resolves.toBe(
      false,
    );
  });

  it('rejects a tampered salt', async () => {
    await expect(verifyPassword(password, { ...record, salt: flipped(record.salt) })).resolves.toBe(
      false,
    );
  });

  it.each([
    ['memoryKib', { memoryKib: 19_456 + 4 }],
    ['passes', { passes: 3 }],
    ['parallelism', { parallelism: 2 }],
  ])('rejects a tampered %s', async (_name, change) => {
    await expect(verifyPassword(password, { ...record, ...change })).resolves.toBe(false);
  });

  it('gives a different salt and a different tag for the same password', async () => {
    const second = await hashPassword(password);
    expect(second.salt.equals(record.salt)).toBe(false);
    expect(second.hash.equals(record.hash)).toBe(false);
    expect(needsRehash(second)).toBe(false);
  });
});

describe('the salt source (SR-05)', () => {
  it('asks the random source for 16 bytes once and stores exactly those bytes', async () => {
    const salt = Buffer.alloc(PASSWORD_SALT_BYTES, 0x5a);
    const random = vi.fn((_size: number) => salt);
    const derive = vi.fn(cheapDerive);
    const hasher = createPasswordHasher({ derive, randomBytes: random });

    const record = await hasher.hashPassword(dummyPassword());

    expect(random.mock.calls).toEqual([[16]]);
    expect(record.salt).toBe(salt);
    expect(derive.mock.calls[0]?.[0].salt).toBe(salt);
  });

  it.each([
    [
      'throws',
      () => {
        throw new Error('entropy');
      },
    ],
    ['returns 15 bytes', () => Buffer.alloc(15)],
    ['returns 17 bytes', () => Buffer.alloc(17)],
  ])(
    'fails with SALT_UNAVAILABLE and derives nothing when the source %s',
    async (_name, random) => {
      const derive = vi.fn(cheapDerive);
      const hasher = createPasswordHasher({ derive, randomBytes: random });
      await expect(hasher.hashPassword(dummyPassword())).rejects.toMatchObject({
        code: PasswordHashErrorCode.SALT_UNAVAILABLE,
      });
      expect(derive).not.toHaveBeenCalled();
    },
  );
});

describe('verifyPassword recomputes with the stored parameters (SR-06)', () => {
  it('verifies a row written under older, cheaper parameters, with those parameters', async () => {
    const password = dummyPassword();
    const record = await olderRecord(password);
    const derive = vi.fn(deriveArgon2id);
    const hasher = createPasswordHasher({ derive });

    await expect(hasher.verifyPassword(password, record)).resolves.toBe(true);
    await expect(hasher.verifyPassword(`${password}x`, record)).resolves.toBe(false);

    expect(derive).toHaveBeenCalledTimes(2);
    expect(derive.mock.calls[0]?.[0]).toMatchObject({
      memoryKib: 1024,
      passes: 1,
      parallelism: 1,
      tagLength: 32,
    });
    expect(derive.mock.calls[0]?.[0].salt).toBe(record.salt);
  });

  it('accepts the two bytea members as plain Uint8Array values', async () => {
    const password = dummyPassword();
    const record = await olderRecord(password);
    const plain = {
      ...record,
      salt: new Uint8Array(record.salt),
      hash: new Uint8Array(record.hash),
    };
    await expect(verifyPassword(password, plain)).resolves.toBe(true);
  });
});

describe('needsRehash (SR-06)', () => {
  const current: StoredPasswordHash = {
    algorithm: 'argon2id',
    memoryKib: 19_456,
    passes: 2,
    parallelism: 1,
    salt: Buffer.alloc(16, 1),
    hash: Buffer.alloc(32, 2),
  };

  it('is false for a record of the current parameters', () => {
    expect(needsRehash(current)).toBe(false);
    expect(createPasswordHasher().needsRehash(current)).toBe(false);
  });

  it.each([
    ['less memory', { memoryKib: 19_455 }],
    ['fewer passes', { passes: 1 }],
    ['more memory but fewer passes', { memoryKib: 47_104, passes: 1 }],
    ['another algorithm', { algorithm: 'argon2i' }],
    ['a salt below 16 bytes', { salt: Buffer.alloc(15, 1) }],
    ['a tag that is not 32 bytes', { hash: Buffer.alloc(31, 2) }],
    ['a parameter that is not an integer', { memoryKib: Number.NaN }],
  ])('is true for %s', (_name, change) => {
    expect(needsRehash({ ...current, ...change })).toBe(true);
  });

  it.each([
    ['more memory', { memoryKib: 65_536 }],
    ['more passes', { passes: 3 }],
    ['more lanes', { parallelism: 4 }],
    ['a longer salt', { salt: Buffer.alloc(32, 1) }],
  ])('is false for %s: a stronger row is not downgraded', (_name, change) => {
    expect(needsRehash({ ...current, ...change })).toBe(false);
  });

  it('is true for a row under older parameters that still verifies', async () => {
    const password = dummyPassword();
    const record = await olderRecord(password);
    await expect(verifyPassword(password, record)).resolves.toBe(true);
    expect(needsRehash(record)).toBe(true);
  });
});

describe('verifyAgainstDummy, the unknown-user path (ID-2, SR-08)', () => {
  it('runs one full derivation with the current parameters and answers false (production cost)', async () => {
    const derive = vi.fn(deriveArgon2id);
    const hasher = createPasswordHasher({ derive });
    const password = dummyPassword();

    await expect(hasher.verifyAgainstDummy(password)).resolves.toBe(false);

    expect(derive).toHaveBeenCalledTimes(1);
    const request = derive.mock.calls[0]?.[0];
    expect(request).toMatchObject({ memoryKib: 19_456, passes: 2, parallelism: 1, tagLength: 32 });
    expect(request?.salt).toHaveLength(16);
    expect(request?.message.equals(Buffer.from(password, 'utf8'))).toBe(true);
    // The derivation really ran: it resolved a 32-byte tag.
    await expect(derive.mock.results[0]?.value).resolves.toHaveLength(32);
  });

  it('asks for the same work as a verification against a current record', async () => {
    const derive = vi.fn(cheapDerive);
    const hasher = createPasswordHasher({ derive });
    const password = dummyPassword();
    const record = await hasher.hashPassword(password);
    derive.mockClear();

    await hasher.verifyPassword(password, record);
    await hasher.verifyAgainstDummy(password);

    expect(derive).toHaveBeenCalledTimes(2);
    const [known, unknown] = derive.mock.calls.map(([request]) => ({
      messageBytes: request.message.length,
      saltBytes: request.salt.byteLength,
      memoryKib: request.memoryKib,
      passes: request.passes,
      parallelism: request.parallelism,
      tagLength: request.tagLength,
    }));
    expect(unknown).toEqual(known);
  });

  it('answers false even if the derivation gives the tag the dummy record holds', async () => {
    // The dummy record's tag is 32 zero bytes; a derivation that hits it must still not sign in.
    const derive = vi.fn<Argon2idDerive>(async () => Buffer.alloc(PASSWORD_HASH_BYTES));
    const hasher = createPasswordHasher({ derive });
    await expect(hasher.verifyAgainstDummy(dummyPassword())).resolves.toBe(false);
    expect(derive).toHaveBeenCalledTimes(1);
  });
});

describe('derivations per call (the spy that AC-B-24 counts)', () => {
  it('is exactly one for hashPassword, verifyPassword and verifyAgainstDummy', async () => {
    const derive = vi.fn(cheapDerive);
    const hasher = createPasswordHasher({ derive });
    const password = dummyPassword();

    const record = await hasher.hashPassword(password);
    expect(derive).toHaveBeenCalledTimes(1);
    await hasher.verifyPassword(password, record);
    expect(derive).toHaveBeenCalledTimes(2);
    await hasher.verifyAgainstDummy(password);
    expect(derive).toHaveBeenCalledTimes(3);
  });
});

describe('password input (ID-P10, SR-07): 1 to 128 characters, nothing normalised', () => {
  const record: StoredPasswordHash = {
    algorithm: 'argon2id',
    ...PASSWORD_HASH_PARAMETERS,
    salt: Buffer.alloc(16, 1),
    hash: Buffer.alloc(32, 2),
  };

  it.each([
    ['an empty password', '', PasswordHashErrorCode.PASSWORD_EMPTY],
    ['129 characters', 'x'.repeat(129), PasswordHashErrorCode.PASSWORD_TOO_LONG],
    ['a number', 12_345 as unknown as string, PasswordHashErrorCode.PASSWORD_NOT_STRING],
    ['undefined', undefined as unknown as string, PasswordHashErrorCode.PASSWORD_NOT_STRING],
    ['null', null as unknown as string, PasswordHashErrorCode.PASSWORD_NOT_STRING],
    ['a Buffer', Buffer.from('x') as unknown as string, PasswordHashErrorCode.PASSWORD_NOT_STRING],
  ])(
    'refuses %s in all three functions, by rejection, without a derivation',
    async (_name, input, code) => {
      const derive = vi.fn(cheapDerive);
      const hasher = createPasswordHasher({ derive });

      await expect(hasher.hashPassword(input)).rejects.toMatchObject({ code });
      await expect(hasher.verifyPassword(input, record)).rejects.toMatchObject({ code });
      await expect(hasher.verifyAgainstDummy(input)).rejects.toMatchObject({ code });
      expect(derive).not.toHaveBeenCalled();
    },
  );

  it('accepts 1 character and 128 characters', async () => {
    const hasher = createPasswordHasher({ derive: cheapDerive });
    for (const password of ['x', 'x'.repeat(128)]) {
      const stored = await hasher.hashPassword(password);
      await expect(hasher.verifyPassword(password, stored)).resolves.toBe(true);
    }
  });

  it('hashes the UTF-8 bytes of the password: 128 three-byte characters are 384 bytes', async () => {
    const derive = vi.fn(cheapDerive);
    const hasher = createPasswordHasher({ derive });
    const password = '✓'.repeat(128);

    await hasher.hashPassword(password);

    const message = derive.mock.calls[0]?.[0].message;
    expect(message).toHaveLength(384);
    expect(message?.equals(Buffer.from(password, 'utf8'))).toBe(true);
  });

  it('does not trim, fold case or normalise Unicode', async () => {
    const hasher = createPasswordHasher({ derive: cheapDerive });
    const password = `Dummy-é-${randomBytes(6).toString('hex')}`;
    const stored = await hasher.hashPassword(password);

    await expect(hasher.verifyPassword(password, stored)).resolves.toBe(true);
    for (const variant of [
      ` ${password}`,
      `${password} `,
      password.toLowerCase(),
      password.toUpperCase(),
      password.normalize('NFD'),
    ]) {
      expect(variant).not.toBe(password);
      await expect(hasher.verifyPassword(variant, stored)).resolves.toBe(false);
    }
  });
});

describe('a stored record that is not well formed', () => {
  const good: StoredPasswordHash = {
    algorithm: 'argon2id',
    ...PASSWORD_HASH_PARAMETERS,
    salt: Buffer.alloc(16, 1),
    hash: Buffer.alloc(32, 2),
  };

  it.each([
    ['another algorithm', { algorithm: 'argon2i' }],
    ['a tag of 31 bytes', { hash: Buffer.alloc(31, 2) }],
    ['a tag of 33 bytes', { hash: Buffer.alloc(33, 2) }],
    ['a salt of 15 bytes', { salt: Buffer.alloc(15, 1) }],
    ['a tag that is not bytes', { hash: 'ab'.repeat(32) as unknown as Buffer }],
    ['memory 0', { memoryKib: 0 }],
    ['memory that is not an integer', { memoryKib: 19_456.5 }],
    ['memory as a string', { memoryKib: '19456' as unknown as number }],
    ['passes 0', { passes: 0 }],
    ['parallelism 0', { parallelism: 0 }],
    ['less than 8 KiB per lane', { memoryKib: 8, parallelism: 2 }],
  ])('is refused with RECORD_INVALID, without a derivation: %s', async (_name, change) => {
    const derive = vi.fn(cheapDerive);
    const hasher = createPasswordHasher({ derive });
    await expect(
      hasher.verifyPassword(dummyPassword(), { ...good, ...change }),
    ).rejects.toMatchObject({
      name: 'PasswordHashError',
      code: PasswordHashErrorCode.RECORD_INVALID,
    });
    expect(derive).not.toHaveBeenCalled();
  });

  it('is refused when it is not an object at all', async () => {
    await expect(
      verifyPassword(dummyPassword(), null as unknown as StoredPasswordHash),
    ).rejects.toMatchObject({ code: PasswordHashErrorCode.RECORD_INVALID });
  });
});

describe('errors carry a code only; nothing is logged', () => {
  /** Everything a caller, a logger or a serialiser could read from an error. */
  function everythingReadable(error: unknown): string {
    const e = error as Error & { cause?: unknown };
    return [
      e.message,
      e.stack ?? '',
      inspect(e, { depth: 5 }),
      JSON.stringify(e),
      String(e.cause),
    ].join('\n');
  }

  it('drops the message of a failed derivation, which can quote its input', async () => {
    const password = dummyPassword();
    const salt = Buffer.alloc(16, 0xc3);
    const derive: Argon2idDerive = async (request) => {
      throw new Error(
        `received ${request.message.toString('utf8')} ${Buffer.from(request.salt).toString('hex')}`,
      );
    };
    const hasher = createPasswordHasher({ derive, randomBytes: () => salt });

    const error: unknown = await hasher.hashPassword(password).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(PasswordHashError);
    expect(error).toMatchObject({
      name: 'PasswordHashError',
      code: PasswordHashErrorCode.DERIVATION_FAILED,
      message: 'DERIVATION_FAILED',
    });
    expect((error as { cause?: unknown }).cause).toBeUndefined();
    expect(Object.keys(error as object).sort()).toEqual(['code', 'name']);
    const readable = everythingReadable(error);
    expect(readable).not.toContain(password);
    expect(readable).not.toContain(salt.toString('hex'));
    expect(readable).not.toContain('received');
  });

  it('fails with DERIVATION_FAILED when the built-in refuses the stored parameters', async () => {
    // One above the built-in's range for `passes` (at most 2^32 - 1): it throws before it starts.
    const record: StoredPasswordHash = {
      algorithm: 'argon2id',
      memoryKib: 64,
      passes: 2 ** 32,
      parallelism: 1,
      salt: Buffer.alloc(16, 1),
      hash: Buffer.alloc(32, 2),
    };
    const password = dummyPassword();
    const error: unknown = await verifyPassword(password, record).catch(
      (caught: unknown) => caught,
    );
    expect(error).toMatchObject({ code: PasswordHashErrorCode.DERIVATION_FAILED });
    expect(everythingReadable(error)).not.toContain(password);
  });

  it.each([
    ['31 bytes', Buffer.alloc(31)],
    ['33 bytes', Buffer.alloc(33)],
    ['a string', 'ab'.repeat(32) as unknown as Buffer],
  ])('fails with DERIVATION_FAILED when the derivation gives a tag of %s', async (_name, tag) => {
    const hasher = createPasswordHasher({ derive: async () => tag });
    const record: StoredPasswordHash = {
      algorithm: 'argon2id',
      ...PASSWORD_HASH_PARAMETERS,
      salt: Buffer.alloc(16, 1),
      hash: Buffer.alloc(32, 2),
    };
    await expect(hasher.verifyPassword(dummyPassword(), record)).rejects.toMatchObject({
      code: PasswordHashErrorCode.DERIVATION_FAILED,
    });
    await expect(hasher.hashPassword(dummyPassword())).rejects.toMatchObject({
      code: PasswordHashErrorCode.DERIVATION_FAILED,
    });
  });

  it('does not put the record into a RECORD_INVALID error', async () => {
    const salt = Buffer.alloc(16, 0xa7);
    const record: StoredPasswordHash = {
      algorithm: 'argon2id',
      ...PASSWORD_HASH_PARAMETERS,
      salt,
      hash: Buffer.alloc(31, 0xb8),
    };
    const password = dummyPassword();
    const error: unknown = await verifyPassword(password, record).catch(
      (caught: unknown) => caught,
    );
    const readable = everythingReadable(error);
    expect(readable).not.toContain(password);
    expect(readable).not.toContain(salt.toString('hex'));
    expect(readable).not.toContain('b8b8');
  });

  it('writes nothing to the console or to the standard streams, on success or on failure', async () => {
    const sinks = [
      vi.spyOn(console, 'log').mockImplementation(() => undefined),
      vi.spyOn(console, 'info').mockImplementation(() => undefined),
      vi.spyOn(console, 'warn').mockImplementation(() => undefined),
      vi.spyOn(console, 'error').mockImplementation(() => undefined),
      vi.spyOn(console, 'debug').mockImplementation(() => undefined),
      vi.spyOn(process.stdout, 'write').mockImplementation(() => true),
      vi.spyOn(process.stderr, 'write').mockImplementation(() => true),
    ];
    const failing = createPasswordHasher({
      derive: async () => {
        throw new Error('boom');
      },
    });
    const password = dummyPassword();

    const record = await olderRecord(password);
    await verifyPassword(password, record);
    await verifyPassword(`${password}x`, record);
    await verifyAgainstDummy(password);
    needsRehash(record);
    await failing.hashPassword(password).catch(() => undefined);
    await failing.verifyAgainstDummy(password).catch(() => undefined);
    await verifyPassword('', record).catch(() => undefined);
    await verifyPassword(password, { ...record, hash: Buffer.alloc(3) }).catch(() => undefined);

    for (const sink of sinks) expect(sink).not.toHaveBeenCalled();
  });
});
