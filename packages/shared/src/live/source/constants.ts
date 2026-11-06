/**
 * Timings of the Live source (backend task 04_client_integration_spec §2.4; names pinned by
 * 02_plan §3.4 "Client constants"). The two display timings a page imports statically live in the
 * light module (`../constants`); the command time-out lives with the typed client.
 *
 * Plain numbers, in milliseconds. No import.
 */

/**
 * How long a Live action waits for the delta of the revision its answer named (CL-17). After it
 * the source asks for a new snapshot and resolves the action: the command did succeed. Twice the
 * heartbeat interval (§2.4).
 */
export const LIVE_SETTLE_TIMEOUT_MS = 2_000;

/**
 * The longest the bootstrap, and a sign-in that waits for its snapshot, may take (§2.3 `ready`,
 * §5.2 step 6). Equal to the sync deadline of the live socket client; a test holds the two equal.
 */
export const LIVE_BOOT_TIMEOUT_MS = 4_000;

/** CL-27: at most one `touchSession` per period of this length, plus one at its end when there was activity. */
export const LIVE_TOUCH_INTERVAL_MS = 60_000;

/** CL-23: a 403 `NOT_PERMITTED` refreshes the permission hint once, this long after the first one. */
export const LIVE_PERMISSION_REFRESH_MS = 1_000;

/**
 * How long the source waits before it asks again after a question of its own got no answer (the
 * session probe, and a sign-out this client owes). The wait doubles with every failure in a row,
 * up to `LIVE_SESSION_PROBE_RETRY_MAX_MS`; a `retry-after` of the server is never undercut.
 */
export const LIVE_SESSION_PROBE_RETRY_MS = 2_000;

/** The longest wait between two such questions: with the Core down, two requests a minute. */
export const LIVE_SESSION_PROBE_RETRY_MAX_MS = 30_000;

/**
 * The most state messages the gate holds back (a command in flight, or the session of the socket
 * not known yet). Beyond it everything held is dropped and one new snapshot is asked for when the
 * gate is free again, so a long hold cannot grow without bound.
 */
export const LIVE_HELD_MESSAGES_MAX = 256;

/**
 * How long the source waits for the app's storage of secrets (`sessionIssued`, `sessionCleared`,
 * `devicePaired`, `deviceUnpaired`). After it the wait is given up and reported: a port that never
 * answers must not keep the socket closed or a command in flight.
 */
export const LIVE_SECRETS_TIMEOUT_MS = 5_000;

/**
 * After a pairing ended and the reopened socket still presents the old device credential, the
 * source asks the app's storage to delete it again: this long after the refusal, doubling, and
 * `LIVE_DEVICE_CLEANUP_RETRIES` times at most. Then the socket stays closed until the app calls
 * `reconnect('CREDENTIAL')`.
 */
export const LIVE_DEVICE_CLEANUP_RETRY_MS = 2_000;
export const LIVE_DEVICE_CLEANUP_RETRIES = 3;

/** A store subscriber that keeps throwing is reported at most once in this time, with the count of what was left out. */
export const LIVE_SUBSCRIBER_REPORT_INTERVAL_MS = 1_000;

/** `errors()` keeps this many reports, as the simulator does (§2.3). */
export const LIVE_ERROR_LOG_SIZE = 50;
