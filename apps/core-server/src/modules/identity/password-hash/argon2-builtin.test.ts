// Proof AS-08 of TD-05 (masterplan/02_plan.md §6, row W09) and the known-vector half of AC-B-30:
// Node's built-in `crypto.argon2` reproduces published Argon2id test vectors on this runtime, in
// both of its forms and through the one function the wrapper calls it with, and it does so
// without a process warning. A failure in this file is the trigger of the fallback row Fh.
//
// The strings `password` and `somesalt` below are the inputs of a published vector, not
// credentials of this project.
import { argon2, argon2Sync } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { deriveArgon2id } from './password-hash';

// Registered before the first derivation of this file, checked after the last one.
const warnings: Error[] = [];
const onWarning = (warning: Error): void => {
  warnings.push(warning);
};
process.on('warning', onWarning);
afterAll(() => {
  process.off('warning', onWarning);
});

/**
 * RFC 9106, section 5.3 "Argon2id Test Vectors" (version 0x13): memory 32 KiB, 3 passes,
 * 4 lanes, tag 32 bytes; password 32 x 0x01, salt 16 x 0x02, secret 8 x 0x03, associated data
 * 12 x 0x04. The built-in takes all of them, so the RFC's vector is used as published.
 */
const RFC_9106_ARGON2ID = {
  parameters: {
    message: Buffer.alloc(32, 0x01),
    nonce: Buffer.alloc(16, 0x02),
    secret: Buffer.alloc(8, 0x03),
    associatedData: Buffer.alloc(12, 0x04),
    parallelism: 4,
    tagLength: 32,
    memory: 32,
    passes: 3,
  },
  tag: '0d640df58d78766c08c037a34a8b53c9d01ef0452d75b65eb52520e96b01e659',
} as const;

/**
 * Vectors of the reference implementation (P-H-C/phc-winner-argon2, `src/test.c`, the Argon2id
 * block for version 0x13): password `password`, salt `somesalt`, tag 32 bytes, no secret and no
 * associated data. That is the shape of the wrapper's own call, which the RFC's vector is not.
 */
const REFERENCE_ARGON2ID = [
  {
    memoryKib: 256,
    passes: 2,
    parallelism: 1,
    tag: '9dfeb910e80bad0311fee20f9c0e2b12c17987b4cac90c2ef54d5b3021c68bfe',
  },
  {
    memoryKib: 256,
    passes: 2,
    parallelism: 2,
    tag: '6d093c501fd5999645e0ea3bf620d7b8be7fd2db59c20d9fff9539da2bf57037',
  },
  {
    memoryKib: 65_536,
    passes: 2,
    parallelism: 1,
    tag: '09316115d5cf24ed5a15a31a3ba326e5cf32edc24702987c02b6566f61913cf7',
  },
] as const;

describe('crypto.argon2 on this runtime (AS-08)', () => {
  it('exists in both forms: argon2(algorithm, parameters, callback) and argon2Sync', () => {
    expect(typeof argon2).toBe('function');
    expect(typeof argon2Sync).toBe('function');
    expect(argon2.length).toBe(3);
    expect(argon2Sync.length).toBe(2);
  });

  it('reproduces the Argon2id test vector of RFC 9106 section 5.3 (asynchronous form)', async () => {
    const tag = await new Promise<Buffer>((resolve, reject) => {
      const returned: unknown = argon2('argon2id', RFC_9106_ARGON2ID.parameters, (error, key) => {
        if (error) reject(error);
        else resolve(key);
      });
      // The result arrives through the callback only.
      expect(returned).toBeUndefined();
    });
    expect(Buffer.isBuffer(tag)).toBe(true);
    expect(tag.toString('hex')).toBe(RFC_9106_ARGON2ID.tag);
  });

  it('reproduces the same vector in the synchronous form', () => {
    const tag = argon2Sync('argon2id', RFC_9106_ARGON2ID.parameters);
    expect(tag.toString('hex')).toBe(RFC_9106_ARGON2ID.tag);
  });

  it('throws synchronously, with a Node error code, on a parameter outside its range', () => {
    const tooShort = { ...RFC_9106_ARGON2ID.parameters, nonce: Buffer.alloc(7, 0x02) };
    expect(() => argon2('argon2id', tooShort, () => undefined)).toThrow(
      expect.objectContaining({ code: 'ERR_OUT_OF_RANGE' }),
    );
  });
});

describe('deriveArgon2id, the wrapper call into the built-in', () => {
  it.each(REFERENCE_ARGON2ID)(
    'reproduces the reference vector for $memoryKib KiB, $passes passes, parallelism $parallelism',
    async ({ tag, ...parameters }) => {
      const derived = await deriveArgon2id({
        message: Buffer.from('password', 'utf8'),
        salt: Buffer.from('somesalt', 'utf8'),
        tagLength: 32,
        ...parameters,
      });
      expect(derived.toString('hex')).toBe(tag);
    },
  );

  it('rejects, and does not throw, when the built-in refuses an argument', async () => {
    const request = {
      message: Buffer.from('password', 'utf8'),
      salt: Buffer.alloc(7, 0x02),
      memoryKib: 256,
      passes: 2,
      parallelism: 1,
      tagLength: 32,
    };
    let returned: Promise<Buffer> | undefined;
    expect(() => {
      returned = deriveArgon2id(request);
    }).not.toThrow();
    await expect(returned).rejects.toMatchObject({ code: 'ERR_OUT_OF_RANGE' });
  });
});

describe('process warnings', () => {
  it('none was emitted by the derivations of this file (the API is not experimental here)', async () => {
    // Node emits warnings on a later tick.
    await new Promise((resolve) => setImmediate(resolve));
    expect(warnings.map((warning) => `${warning.name}: ${warning.message}`)).toEqual([]);
  });
});
