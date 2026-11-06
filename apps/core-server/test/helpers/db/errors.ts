/**
 * Errors of the test helper. `code` is stable and is what a test asserts on; `message` is for a
 * person and never holds a credential value (it names a file or a key instead).
 */

export type DbTestHelperErrorCode =
  // The server cannot be used.
  | 'POSTGRES_UNREACHABLE'
  | 'ENDPOINT_REFUSED'
  | 'ROLE_REFUSED'
  | 'SUPERUSER_REFUSED'
  // Credential files.
  | 'CREDENTIAL_FILE_MISSING'
  | 'CREDENTIAL_FILE_MODE'
  | 'CREDENTIAL_FILE_FORMAT'
  // The name guard (TI-3, TI-12).
  | 'GUARD_PROTECTED_DATABASE'
  | 'GUARD_NOT_A_TEST_DATABASE'
  | 'GUARD_FOREIGN_RUN'
  | 'GUARD_NOT_STALE'
  // The run.
  | 'RUN_LABEL_INVALID'
  | 'RUN_NOT_PROVIDED'
  | 'RUN_NOT_OWNER'
  | 'RUN_CLOSED'
  | 'RUN_ALIVE'
  | 'RUN_PREFIX_UNAVAILABLE'
  | 'NAME_INVALID'
  // What a test file states it needs (`useTestDatabase({ needs })`, decision D134).
  | 'NEEDS_INVALID'
  | 'CLONE_SLOTS_EXHAUSTED'
  | 'CLONE_LOCK_TIMEOUT'
  // Templates.
  | 'TEMPLATE_NOT_AVAILABLE'
  | 'TEMPLATE_BUILD_FAILED'
  | 'TEMPLATE_HOOK_INVALID'
  // Cleanup.
  | 'SESSIONS_REMAIN'
  | 'DROP_REFUSED'
  | 'CLEANUP_INCOMPLETE'
  | 'DATABASE_NOT_READY';

export class DbTestHelperError extends Error {
  readonly code: DbTestHelperErrorCode;

  constructor(code: DbTestHelperErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'DbTestHelperError';
    this.code = code;
  }
}

/**
 * A refusal of the name guard. It is thrown before a statement is built, so nothing was sent to
 * the server when a caller sees it (T-TI-2).
 */
export class DbGuardError extends DbTestHelperError {
  /** The name that was refused. A database name is not a secret. */
  readonly database: string;

  constructor(code: DbTestHelperErrorCode, database: string, message: string) {
    super(code, message);
    this.name = 'DbGuardError';
    this.database = database;
  }
}

/** The SQLSTATE or the system error code of an unknown error, or `undefined`. */
export function errorCode(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  return undefined;
}

/** The message of an unknown error. The driver's messages hold no password. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
