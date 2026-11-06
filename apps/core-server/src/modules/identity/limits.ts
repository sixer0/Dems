/**
 * The numbers of the identity module (plan row W24; spec §5.1 ID-P1 to ID-P9). Constants only.
 *
 * They are the specification's, not configuration: no environment variable reaches them, and the
 * frozen `config.ts` holds none of them (the same rule as the throttle's and the core's limits).
 * Where the shared simulator already states a number, the server takes it from there, so both
 * modes lock and expire alike (`packages/shared/src/sim/constants.ts`).
 */
import { AUTH_FAILURE_WINDOW_MS, AUTH_IDLE_TIMEOUT_MS, AUTH_LOCKOUT_MS, AUTH_MAX_FAILURES } from '@dems/shared/sim';

/** ID-P1: attempts of one console within a window before it locks. */
export const LOCKOUT_MAX_ATTEMPTS = AUTH_MAX_FAILURES;
/** ID-P1: the window of the count, 300 s. It opens at the console's first counted attempt. */
export const LOCKOUT_WINDOW_MS = AUTH_FAILURE_WINDOW_MS;
/** ID-P2: how long a console stays locked, 60 s. */
export const LOCKOUT_DURATION_MS = AUTH_LOCKOUT_MS;
// ID-P3, the lockout key of the web console, and the minimum interval of an activity write are
// read by stage 4 and by the access rule: they are defined with stage 4 (`plugins/authenticate`,
// review finding CPB1-10) and re-exported here, so that this file still lists every number of
// the identity module.
export { SESSION_TOUCH_MIN_INTERVAL_MS, WEB_CONSOLE_KEY } from '../../plugins/authenticate';

/** ID-P4: a session without activity for this long is expired (15 minutes). */
export const SESSION_IDLE_TIMEOUT_MS = AUTH_IDLE_TIMEOUT_MS;
/** ID-P5: a session ends this long after its issue, whatever its activity (8 hours). */
export const SESSION_ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60_000;
/**
 * ID-P8: the expiry sweep runs this often (5 s). A timer in real time, like the pipeline's
 * watchdog: it only says WHEN a sweep runs. What is expired is decided by the server clock.
 */
export const SESSION_SWEEP_INTERVAL_MS = 5_000;
