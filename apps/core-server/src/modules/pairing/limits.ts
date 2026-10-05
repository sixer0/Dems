/**
 * The numbers of the pairing module (plan row W32; spec §6.1 PR-P1 to PR-P9, §6.5). Constants
 * only.
 *
 * They are the specification's, not configuration: no environment variable reaches them, and
 * the frozen `config.ts` holds none of them (the same rule as the identity module's and the
 * throttle's limits). Where the shared simulator already states a number, the server takes it
 * from there, so both modes lock alike (`packages/shared/src/sim/constants.ts`).
 */
import { AUTH_FAILURE_WINDOW_MS, PAIRING_CODE_LENGTH, PAIRING_LOCKOUT_MS, PAIRING_MAX_FAILURES } from '@dems/shared/sim';

/** PR-P1: a pairing code is this many decimal digits. */
export const PAIRING_CODE_DIGITS = PAIRING_CODE_LENGTH;
/** PR-P1: the number of different codes, 10^6. A code is drawn uniformly below it. */
export const PAIRING_CODE_SPACE = 10 ** PAIRING_CODE_DIGITS;
/** PR-P2: a code is valid this long after its issue (300 s). */
export const PAIRING_CODE_LIFETIME_MS = 300_000;
/** PR-P5: failed redeems of one code before it is closed as EXHAUSTED. The table's CHECK is the same bound. */
export const PAIRING_CODE_MAX_FAILED_REDEEMS = 5;
/** PR-P7: the QR payload is this text followed by the code. Not a URL. */
export const PAIRING_QR_PREFIX = 'DEMS-PAIR:1:';

/** PR-P4: failed redeems within the window before redeeming locks. */
export const REDEEM_LOCK_MAX_FAILURES = PAIRING_MAX_FAILURES;
/** PR-P4: the window of the count, 300 s. It opens at the first counted attempt. */
export const REDEEM_LOCK_WINDOW_MS = AUTH_FAILURE_WINDOW_MS;
/** PR-P4: how long redeeming stays locked, 60 s. */
export const REDEEM_LOCK_DURATION_MS = PAIRING_LOCKOUT_MS;
/**
 * PR-P4: the key of the redeem lock is global. Unpaired callers cannot be told apart on
 * loopback, so there is one count for all of them, never a value a caller supplies.
 */
export const REDEEM_LOCK_KEY = 'redeem';

/** PR-P8: the prefix of a device credential, and its random part in bytes (256 bits). */
export const DEVICE_CREDENTIAL_PREFIX = 'dvc_';
export const DEVICE_CREDENTIAL_BYTES = 32;

/** PR-P9: `DEV-NNNN`, at least four digits; and `PCD-NNNNNN`, at least six (database contract §4.7, §4.8). */
export const DEVICE_ID_PREFIX = 'DEV-';
export const DEVICE_ID_MIN_DIGITS = 4;
export const PAIRING_CODE_ID_PREFIX = 'PCD-';
export const PAIRING_CODE_ID_MIN_DIGITS = 6;

/** Spec §6.5: `lastSeenAt` of a device is written at most this often (once a minute). */
export const DEVICE_SEEN_MIN_INTERVAL_MS = 60_000;

/**
 * The expiry sweep of the active code runs this often (5 s, as the session sweep). A timer in
 * real time: it only says WHEN a sweep runs. What is expired is decided by the server clock.
 */
export const PAIRING_CODE_SWEEP_INTERVAL_MS = 5_000;
