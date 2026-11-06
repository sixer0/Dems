/**
 * Public surface of the password-hash wrapper HB-4 (masterplan/02_plan.md W09). The seed and the
 * identity module import from here; see `password-hash.ts` for the rules.
 */
export {
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
  type Argon2idRequest,
  type PasswordHashRecord,
  type PasswordHasher,
  type PasswordHasherOptions,
  type StoredPasswordHash,
} from './password-hash';
