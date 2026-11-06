/**
 * Password-hash wrapper HB-4 (masterplan/02_plan.md W09; 01_specs.md SR-05, SR-06, SR-08, ID-2,
 * ID-P10; 03_database_contract.md §4.5, §5.1, §5.2; research/03_analysis.md TD-05).
 *
 * Node's `crypto.argon2` returns the raw derived key and has neither an encoded form nor a
 * verify helper, so this file is the small piece that sits on top of it:
 *
 * - `hashPassword` derives an Argon2id tag with the parameters of SR-05 and a fresh 16-byte salt
 *   from `crypto.randomBytes(16)`, and returns the hash set of SR-06 in the shape of the columns
 *   of `operator_credentials` (the caller adds `operator_id` and `hashed_at`).
 * - `verifyPassword` recomputes with the STORED salt and parameters and compares the two 32-byte
 *   tags with `crypto.timingSafeEqual`.
 * - `verifyAgainstDummy` does the same work against a fixed record of the current parameters and
 *   always answers `false`: the sign-in handler calls it when the username matches nobody, so an
 *   unknown user costs one derivation like a known one (ID-2, SR-08, SD-21 "always compute").
 * - `needsRehash` tells the handler that a row was written with weaker parameters and is to be
 *   re-hashed after a successful sign-in (SR-06).
 *
 * No pepper (SR-61; 01_specs.md §14.1): it would be one more secret under the same `.data/` and
 * the same uid as the database, so it adds no separation, and the seeded password is a published
 * constant. The built-in's `secret` and `associatedData` parameters are therefore never passed.
 *
 * The password is hashed as its UTF-8 bytes, exactly as given: not trimmed, not case-folded, not
 * Unicode-normalised (03_database_contract.md §5.1 "exact input of the hash").
 *
 * This file never logs, and no error it throws carries the password, the salt, the tag or the
 * built-in's own message (which can quote an argument): a `PasswordHashError` has a code only
 * (NL-1, NL-2). The caller logs the code.
 *
 * The asynchronous form of the built-in runs on the libuv thread pool, so a derivation does not
 * block the event loop; each one holds 19 MiB while it runs.
 */
import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';

/** Column `algorithm` of `operator_credentials`; the only value its CHECK accepts. */
export const PASSWORD_HASH_ALGORITHM = 'argon2id';

/**
 * Current cost parameters (SR-05, the OWASP minimum set: 19,456 KiB, 2 passes, parallelism 1).
 * They equal the floor that `operator_credentials_params_check` enforces.
 */
export const PASSWORD_HASH_PARAMETERS = {
  /** Column `memory_kib`: memory in KiB (the built-in's `memory`, in 1 KiB blocks). */
  memoryKib: 19_456,
  /** Column `passes`: iterations (the built-in's `passes`). */
  passes: 2,
  /** Column `parallelism`: lanes (the built-in's `parallelism`). */
  parallelism: 1,
} as const;

/** Column `salt`: bytes of a new salt (RFC 9106: 16 bytes for password hashing). */
export const PASSWORD_SALT_BYTES = 16;

/** Column `hash`: bytes of the derived tag; `operator_credentials_lengths_check` wants 32. */
export const PASSWORD_HASH_BYTES = 32;

/** ID-P10, SR-07: a password is 1 to 128 characters, counted as zod's `.max(128)` counts them. */
export const PASSWORD_MAX_LENGTH = 128;

/**
 * A hash set as read back from `operator_credentials`: one member per column, in camelCase (N-6).
 * `operator_id` and `hashed_at` belong to the caller. `algorithm` is a `text` column, so it is a
 * string here and checked at run time; the two `bytea` members may be a `Buffer` (what `pg`
 * returns) or any other `Uint8Array`. No member may be logged or returned by the API (NL-1).
 */
export interface StoredPasswordHash {
  /** `algorithm` text; the CHECK accepts `argon2id` only. */
  readonly algorithm: string;
  /** `memory_kib` integer, KiB. */
  readonly memoryKib: number;
  /** `passes` integer. */
  readonly passes: number;
  /** `parallelism` integer. */
  readonly parallelism: number;
  /** `salt` bytea, at least 16 bytes. */
  readonly salt: Uint8Array;
  /** `hash` bytea, the 32-byte Argon2id tag. */
  readonly hash: Uint8Array;
}

/** The hash set of SR-06 as `hashPassword` writes it: the current algorithm, 16 and 32 bytes. */
export interface PasswordHashRecord extends StoredPasswordHash {
  readonly algorithm: typeof PASSWORD_HASH_ALGORITHM;
  readonly salt: Buffer;
  readonly hash: Buffer;
}

/** The only thing an error of this file says. */
export const PasswordHashErrorCode = {
  /** The password is not a string (a caller that skipped the request schema). */
  PASSWORD_NOT_STRING: 'PASSWORD_NOT_STRING',
  /** The password has no characters. */
  PASSWORD_EMPTY: 'PASSWORD_EMPTY',
  /** The password is longer than `PASSWORD_MAX_LENGTH`. */
  PASSWORD_TOO_LONG: 'PASSWORD_TOO_LONG',
  /** The stored hash set is not a well-formed Argon2id record. */
  RECORD_INVALID: 'RECORD_INVALID',
  /** The random source did not give a salt of `PASSWORD_SALT_BYTES` bytes. */
  SALT_UNAVAILABLE: 'SALT_UNAVAILABLE',
  /** The derivation threw, or did not give a tag of `PASSWORD_HASH_BYTES` bytes. */
  DERIVATION_FAILED: 'DERIVATION_FAILED',
} as const;
export type PasswordHashErrorCode =
  (typeof PasswordHashErrorCode)[keyof typeof PasswordHashErrorCode];

/** Thrown by every function of this file. The message is the code; there is no `cause`. */
export class PasswordHashError extends Error {
  readonly code: PasswordHashErrorCode;

  constructor(code: PasswordHashErrorCode) {
    super(code);
    this.name = 'PasswordHashError';
    this.code = code;
  }
}

/** One Argon2id derivation, in the units of the table. */
export interface Argon2idRequest {
  /** The password's UTF-8 bytes. */
  readonly message: Buffer;
  readonly salt: Uint8Array;
  readonly memoryKib: number;
  readonly passes: number;
  readonly parallelism: number;
  /** Bytes of the tag to derive. */
  readonly tagLength: number;
}

/** The derivation seam: the built-in in production, a counting spy in a test (AC-B-24). */
export type Argon2idDerive = (request: Argon2idRequest) => Promise<Buffer>;

/**
 * The one call into `crypto.argon2` (asynchronous form). It passes no `secret` and no
 * `associatedData`: there is no pepper. An invalid argument makes the built-in throw
 * synchronously; inside the executor that becomes a rejection like any other failure.
 */
export const deriveArgon2id: Argon2idDerive = (request) =>
  new Promise<Buffer>((resolve, reject) => {
    argon2(
      PASSWORD_HASH_ALGORITHM,
      {
        message: request.message,
        nonce: request.salt,
        parallelism: request.parallelism,
        tagLength: request.tagLength,
        memory: request.memoryKib,
        passes: request.passes,
      },
      (error, tag) => {
        if (error) reject(error);
        else resolve(tag);
      },
    );
  });

export interface PasswordHasherOptions {
  /** Default: `deriveArgon2id`, the built-in. */
  readonly derive?: Argon2idDerive;
  /** Default: `crypto.randomBytes` (SR-05). */
  readonly randomBytes?: (size: number) => Buffer;
}

export interface PasswordHasher {
  /** Hashes a password with the current parameters and a new random salt. */
  readonly hashPassword: (password: string) => Promise<PasswordHashRecord>;
  /** Recomputes with the stored salt and parameters; `true` only when the tags are equal. */
  readonly verifyPassword: (password: string, record: StoredPasswordHash) => Promise<boolean>;
  /** One derivation against the fixed dummy record; always `false` (unknown user, ID-2). */
  readonly verifyAgainstDummy: (password: string) => Promise<false>;
  /** `true` when the record is weaker than the current parameters (SR-06). */
  readonly needsRehash: (record: StoredPasswordHash) => boolean;
}

/**
 * The record `verifyAgainstDummy` computes against. Its salt is fixed and public: it guards
 * nothing, it only makes the derivation cost what a real one costs. The comparison result is
 * ignored, so the value of `hash` does not matter either.
 */
const DUMMY_RECORD: PasswordHashRecord = {
  algorithm: PASSWORD_HASH_ALGORITHM,
  ...PASSWORD_HASH_PARAMETERS,
  salt: Buffer.from('dems-dummy-salt!', 'utf8'),
  hash: Buffer.alloc(PASSWORD_HASH_BYTES),
};

/** Validates the password input (ID-P10) and returns the bytes that are hashed. */
function passwordBytes(password: string): Buffer {
  if (typeof password !== 'string') {
    throw new PasswordHashError(PasswordHashErrorCode.PASSWORD_NOT_STRING);
  }
  if (password.length === 0) throw new PasswordHashError(PasswordHashErrorCode.PASSWORD_EMPTY);
  if (password.length > PASSWORD_MAX_LENGTH) {
    throw new PasswordHashError(PasswordHashErrorCode.PASSWORD_TOO_LONG);
  }
  return Buffer.from(password, 'utf8');
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}

/**
 * A stored hash set that can be recomputed: Argon2id, positive integer parameters with at least
 * 8 KiB per lane (RFC 9106), and the byte lengths of `operator_credentials_lengths_check`. The
 * cost parameters are NOT held to the current floor, so a row written under an older, cheaper
 * set still verifies and is then re-hashed (SR-06). No ceiling is applied either: a caller that
 * can write this row can replace the hash itself, so a bound on its cost would protect nothing.
 */
function isWellFormed(record: StoredPasswordHash): boolean {
  return (
    typeof record === 'object' &&
    record !== null &&
    record.algorithm === PASSWORD_HASH_ALGORITHM &&
    isPositiveInteger(record.memoryKib) &&
    isPositiveInteger(record.passes) &&
    isPositiveInteger(record.parallelism) &&
    record.memoryKib >= 8 * record.parallelism &&
    record.salt instanceof Uint8Array &&
    record.salt.byteLength >= PASSWORD_SALT_BYTES &&
    record.hash instanceof Uint8Array &&
    record.hash.byteLength === PASSWORD_HASH_BYTES
  );
}

/**
 * `true` when the row is to be re-hashed after a successful sign-in: any cost parameter is below
 * the current one, or the row is not a well-formed Argon2id record at all. A row at or above the
 * current parameters is left alone (no downgrade).
 */
export function needsRehash(record: StoredPasswordHash): boolean {
  return (
    !isWellFormed(record) ||
    record.memoryKib < PASSWORD_HASH_PARAMETERS.memoryKib ||
    record.passes < PASSWORD_HASH_PARAMETERS.passes ||
    record.parallelism < PASSWORD_HASH_PARAMETERS.parallelism
  );
}

/**
 * Builds the four functions around a derivation and a random source. Production code uses the
 * exports below, which are bound to the built-in; a test passes a spy to count derivations.
 * The three asynchronous functions never throw synchronously: every failure is a rejection with
 * a `PasswordHashError`.
 */
export function createPasswordHasher(options: PasswordHasherOptions = {}): PasswordHasher {
  const derive = options.derive ?? deriveArgon2id;
  const random = options.randomBytes ?? randomBytes;

  /** One derivation of a 32-byte tag with the salt and parameters of `record`. */
  async function tagFor(
    message: Buffer,
    record: Pick<StoredPasswordHash, 'salt' | 'memoryKib' | 'passes' | 'parallelism'>,
  ): Promise<Buffer> {
    let tag: Buffer;
    try {
      tag = await derive({
        message,
        salt: record.salt,
        memoryKib: record.memoryKib,
        passes: record.passes,
        parallelism: record.parallelism,
        tagLength: PASSWORD_HASH_BYTES,
      });
    } catch {
      // The cause is dropped on purpose: the built-in's message can quote an argument.
      throw new PasswordHashError(PasswordHashErrorCode.DERIVATION_FAILED);
    }
    // `timingSafeEqual` needs two buffers of one length; a tag of another length is a failure.
    if (!Buffer.isBuffer(tag) || tag.length !== PASSWORD_HASH_BYTES) {
      throw new PasswordHashError(PasswordHashErrorCode.DERIVATION_FAILED);
    }
    return tag;
  }

  /** Derives, then compares in constant time. Both buffers are 32 bytes long here. */
  async function matches(message: Buffer, record: StoredPasswordHash): Promise<boolean> {
    const tag = await tagFor(message, record);
    return timingSafeEqual(tag, record.hash);
  }

  function newSalt(): Buffer {
    let salt: Buffer;
    try {
      salt = random(PASSWORD_SALT_BYTES);
    } catch {
      throw new PasswordHashError(PasswordHashErrorCode.SALT_UNAVAILABLE);
    }
    if (!Buffer.isBuffer(salt) || salt.length !== PASSWORD_SALT_BYTES) {
      throw new PasswordHashError(PasswordHashErrorCode.SALT_UNAVAILABLE);
    }
    return salt;
  }

  return {
    async hashPassword(password) {
      const message = passwordBytes(password);
      const salt = newSalt();
      const hash = await tagFor(message, { salt, ...PASSWORD_HASH_PARAMETERS });
      return { algorithm: PASSWORD_HASH_ALGORITHM, ...PASSWORD_HASH_PARAMETERS, salt, hash };
    },

    async verifyPassword(password, record) {
      const message = passwordBytes(password);
      if (!isWellFormed(record)) throw new PasswordHashError(PasswordHashErrorCode.RECORD_INVALID);
      return matches(message, record);
    },

    async verifyAgainstDummy(password) {
      // Same input check, same derivation, same comparison as a real verification; the answer
      // is `false` whatever the comparison says, because nobody is being verified.
      await matches(passwordBytes(password), DUMMY_RECORD);
      return false;
    },

    needsRehash,
  };
}

const builtIn = createPasswordHasher();

/** Hashes a password with the current parameters and a new random salt (the seed; a re-hash). */
export const hashPassword = builtIn.hashPassword;

/** Verifies a password against a stored hash set, in constant time on the tags. */
export const verifyPassword = builtIn.verifyPassword;

/** The unknown-user path of sign-in: one full derivation, then `false` (ID-2). */
export const verifyAgainstDummy = builtIn.verifyAgainstDummy;
