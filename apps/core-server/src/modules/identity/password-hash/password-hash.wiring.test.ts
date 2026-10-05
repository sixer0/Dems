// What the default exports of the wrapper hand to `node:crypto` (masterplan/02_plan.md W09;
// 01_specs.md SR-05, SR-06, SR-61; SD-21): the salt comes from `crypto.randomBytes(16)`, the
// derivation is `crypto.argon2` with the parameters of SR-05 and neither `secret` nor
// `associatedData` (no pepper), and the tags are compared by `crypto.timingSafeEqual`.
//
// `node:crypto` is replaced by spies that call through, so the real functions still run.
import { argon2, argon2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword, verifyAgainstDummy, verifyPassword } from './index';

vi.mock('node:crypto', { spy: true });

// An obvious dummy, made once before the spies are cleared for the first test.
const password = `dummy-${randomBytes(9).toString('base64url')}`;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the default wrapper on node:crypto (production cost)', () => {
  it('hashPassword: randomBytes(16) once, argon2 once with the parameters of SR-05, no pepper', async () => {
    const record = await hashPassword(password);

    expect(vi.mocked(randomBytes).mock.calls).toEqual([[16]]);
    expect(vi.mocked(randomBytes).mock.results[0]?.value).toBe(record.salt);

    expect(argon2).toHaveBeenCalledTimes(1);
    expect(argon2Sync).not.toHaveBeenCalled();
    const [algorithm, parameters, callback] = vi.mocked(argon2).mock.calls[0] ?? [];
    expect(algorithm).toBe('argon2id');
    // Exactly these members: a `secret` or an `associatedData` member would be a pepper.
    expect(parameters).toStrictEqual({
      message: Buffer.from(password, 'utf8'),
      nonce: record.salt,
      parallelism: 1,
      tagLength: 32,
      memory: 19_456,
      passes: 2,
    });
    expect(typeof callback).toBe('function');
    expect(record.hash).toHaveLength(32);
  });

  it('verifyPassword: argon2 once with the stored salt, timingSafeEqual once on two 32-byte tags', async () => {
    const record = await hashPassword(password);
    vi.clearAllMocks();

    await expect(verifyPassword(password, record)).resolves.toBe(true);

    expect(randomBytes).not.toHaveBeenCalled();
    expect(argon2).toHaveBeenCalledTimes(1);
    expect(vi.mocked(argon2).mock.calls[0]?.[1]).toStrictEqual({
      message: Buffer.from(password, 'utf8'),
      nonce: record.salt,
      parallelism: 1,
      tagLength: 32,
      memory: 19_456,
      passes: 2,
    });
    expect(timingSafeEqual).toHaveBeenCalledTimes(1);
    const [derived, stored] = vi.mocked(timingSafeEqual).mock.calls[0] ?? [];
    expect(derived).toHaveLength(32);
    expect(stored).toBe(record.hash);
  });

  it('verifyAgainstDummy: argon2 once with the current parameters, one comparison, no new salt', async () => {
    await expect(verifyAgainstDummy(password)).resolves.toBe(false);

    expect(randomBytes).not.toHaveBeenCalled();
    expect(argon2).toHaveBeenCalledTimes(1);
    const [algorithm, parameters] = vi.mocked(argon2).mock.calls[0] ?? [];
    expect(algorithm).toBe('argon2id');
    expect(Object.keys(parameters ?? {}).sort()).toEqual([
      'memory',
      'message',
      'nonce',
      'parallelism',
      'passes',
      'tagLength',
    ]);
    expect(parameters).toMatchObject({ parallelism: 1, tagLength: 32, memory: 19_456, passes: 2 });
    expect(parameters?.nonce).toHaveLength(16);
    expect(timingSafeEqual).toHaveBeenCalledTimes(1);
  });
});
