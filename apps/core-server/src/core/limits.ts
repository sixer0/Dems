/**
 * Limits of the core services (plan row W21). Constants only.
 *
 * The specification names the serial pipeline (spec §2.3 stages 8 and 9, §8.2 ENG-1, ENG-6,
 * ENG-23) and is silent on its length and on how long one unit may run. The values below are
 * this row's choice. They are not configuration: no environment variable reaches them, and the
 * frozen `config.ts` holds none of them (the same rule as the throttle's `limits.ts`).
 */

/**
 * Units that may WAIT for their turn. The unit that is running is not counted. The next
 * submission is refused at once with 503 `NOT_READY`.
 *
 * Why 256: it is above every burst the specification names (50 concurrent appends, AC-B-54;
 * 20 concurrent sign-ins of two units each, AC-B-80; 100 concurrent denied calls, of which the
 * denial budget lets 20 write a row, AC-B-75) with the engine's ticks on top, and a unit takes
 * a few milliseconds, so a full queue is worked off in about a second.
 */
export const PIPELINE_MAX_PENDING = 256;

/**
 * Longest run of one unit, in milliseconds of real time: from the start of its work to the end
 * of its COMMIT. It is a watchdog, not a domain deadline: it stamps nothing and it is measured
 * with a timer, because a manual clock does not move by itself.
 *
 * Why 5,000: a unit is a handful of statements on loopback (single-digit milliseconds); the
 * pool waits at most 2,000 ms for a connection (`DATABASE_TIMEOUT_MS`); the entry point gives a
 * shutdown 10,000 ms in all.
 */
export const PIPELINE_UNIT_TIMEOUT_MS = 5_000;

/**
 * Longest wait of `close()` for the units that were accepted before it, in milliseconds. After
 * it, the running unit is abandoned and every waiting unit is refused. Above the unit timeout,
 * so that a running unit ends by its own watchdog first, and below the entry point's shutdown
 * limit of 10,000 ms.
 */
export const PIPELINE_CLOSE_TIMEOUT_MS = 6_000;

/**
 * A unit's label goes into log lines, so it is a name chosen in the code, never request data:
 * `identity.signIn`, `rbac.denied`, `engine.tick`.
 */
export const UNIT_LABEL_PATTERN = /^[a-z][A-Za-z0-9]*(?:[.:-][A-Za-z0-9]+)*$/;
export const UNIT_LABEL_MAX_LENGTH = 64;

/** A row written by a server-native module: its message and each string of its payload map. */
export const NATIVE_TEXT_MAX_LENGTH = 500;
/** A row written by a server-native module: the keys of its payload map. */
export const NATIVE_PAYLOAD_KEYS_MAX = 16;
/** A reference (session, evidence, device) in a row: a short identifier, never free text. */
export const REFERENCE_MAX_LENGTH = 64;

/** The counter of `engine_counters` that numbers the events (database contract §4.24). */
export const EVENT_COUNTER_NAME = 'event';
