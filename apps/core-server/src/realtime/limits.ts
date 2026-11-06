/**
 * The server's own numbers of the realtime channel (plan row W42; spec §9.1 RT-P3, RT-P6 to
 * RT-P12, §6.8). Constants only.
 *
 * The numbers a client and the server must agree on are the contract's
 * (`@dems/shared/api`: `HEARTBEAT_INTERVAL_MS`, `REALTIME_RESYNC_MIN_INTERVAL_MS`,
 * `REALTIME_CLIENT_MESSAGE_MAX_BYTES`, `REALTIME_CLIENT_MESSAGE_LIMIT`); this file repeats none
 * of them. The values here are not configuration: no environment variable reaches them.
 */
import {
  HEARTBEAT_INTERVAL_MS,
  REALTIME_CLIENT_MESSAGE_LIMIT,
  REALTIME_CLIENT_MESSAGE_MAX_BYTES,
  REALTIME_RESYNC_MIN_INTERVAL_MS,
} from '@dems/shared/api';

/** RT-P6: connections per server instance. An upgrade beyond it is closed with 1013. */
export const REALTIME_MAX_CONNECTIONS = 16;
/**
 * RT-P6, SR-42: of those, connections without a principal. Any local client can open one, so
 * they cannot take the ten places left for devices and operators (SD-13).
 */
export const REALTIME_MAX_ANONYMOUS = 6;
/**
 * Sockets of ONE operator session (review finding CPS1-5). A console opens one socket per tab
 * (client rule CL-7) and the tabs of a browser profile share the session cookie, so on the web
 * this is "four tabs". A session on a device lives in one app with one socket; the same number
 * is slack there. Without it one session could take all ten places of the principals.
 */
export const REALTIME_MAX_PER_SESSION = 4;
/**
 * Sockets opened with ONE device credential (a paired device with nobody signed in). The app
 * holds one socket (CL-7) and replaces it at a sign-out and at a retry (CL-11a); the second
 * place is for the moment in which the new socket and its predecessor overlap, in whichever
 * order the two reach the server: with one place, a predecessor that is admitted after its
 * successor would close the socket the client keeps.
 */
export const REALTIME_MAX_PER_DEVICE = 2;

/**
 * How long the socket of an upgrade request may wait to be taken by the socket route (review
 * finding CPS1-4). A handshake takes milliseconds; a client gives one up after 4,000 ms
 * (`LIVE_SOCKET_SYNC_TIMEOUT_MS`), so nothing is cut that a client still waits for. A socket
 * that is neither taken nor answered by then (an upgrade on a path the router cannot decode runs
 * no hook) is destroyed at the next pace step.
 */
export const REALTIME_HANDSHAKE_TIMEOUT_MS = 5_000;
/**
 * Sockets in a handshake at one time. All 16 clients may reconnect at once, anonymous retries
 * beside them; twice the connection cap leaves room for that. Beyond it the OLDEST waiting
 * socket is destroyed: a flood of upgrades that never complete cannot keep a new one out, and
 * cannot hold more than this many descriptors.
 */
export const REALTIME_MAX_PENDING_HANDSHAKES = 32;

/** RT-P3: a protocol ping this often; a connection that did not answer the previous one is terminated. */
export const REALTIME_PING_INTERVAL_MS = 30_000;

/** RT-P8: meter frames on the wire per second of the server clock. It may be lowered (I8). */
export const REALTIME_METER_WIRE_RATE_HZ = 20;
/** RT-P9: a meter frame is skipped for a connection whose send buffer holds more than this. */
export const REALTIME_METER_SKIP_BYTES = 65_536;
/** RT-P10: a connection whose send buffer holds more than this is closed with 4408. */
export const REALTIME_HARD_BUFFER_BYTES = 4_194_304;

/**
 * RT-P11: deltas caused only by the 1 Hz steps leave at the pace step, so at most four times a
 * second. It is also the step of the channel's housekeeping (the close deadline, a `resync`
 * that had to wait, the tablet link).
 */
export const REALTIME_DELTA_PACE_MS = 250;

/** RT-P12: from the commit to the push and the close. */
export const REALTIME_CONTROL_DEADLINE_MS = 1_000;
/**
 * How long a socket the server closed may take to answer the close frame before it is destroyed.
 * The close frame leaves in the turn of the publication; the pace step that finds the deadline
 * passed destroys the socket, so a socket is gone at the latest
 * `REALTIME_CLOSE_GRACE_MS + REALTIME_DELTA_PACE_MS` after its close: the control deadline.
 */
export const REALTIME_CLOSE_GRACE_MS = REALTIME_CONTROL_DEADLINE_MS - REALTIME_DELTA_PACE_MS;

/** Spec §6.8: a device that reconnects within this time does not toggle the tablet link. */
export const TABLET_LINK_DEBOUNCE_MS = 5_000;
/** After a `setTabletLink` that was not committed, the next try is not before this. */
export const TABLET_LINK_RETRY_MS = 1_000;

/**
 * E-fix FX-C (ruling R4; E2E-S-2, RESIDUAL-W70-1): a paired device's sign-in or sign-out (the
 * publication `device.session`) and the admission or departure of a device's socket are told to
 * the holders of the device permission as ONE `admin.changed DEVICES`, once this long has passed
 * without another change: a sign-in and the socket the app opens after it are one change, not
 * two. A run of changes never waits longer than `DEVICES_CHANGED_MAX_WAIT_MS` from its first one.
 */
export const DEVICES_CHANGED_DEBOUNCE_MS = 1_000;
/**
 * The longest a run of device changes waits for its `admin.changed DEVICES`, counted from its
 * first change: a device that reconnects again and again still updates Paired Devices every 5 s.
 * Its own number (review finding W91-3): it equals the tablet link's `TABLET_LINK_DEBOUNCE_MS`
 * today, but retuning the Core link (spec §6.8) must not change how stale Paired Devices may get.
 */
export const DEVICES_CHANGED_MAX_WAIT_MS = 5_000;

/**
 * How long the channel remembers that a session ended or a device was retired. An upgrade whose
 * credential was resolved before that commit and which reaches the channel after the publication
 * is refused by this memory (SR-41): no request spends this long between stage 4 and its handler.
 */
export const REALTIME_ENDED_MEMORY_MS = 60_000;

/** Every number the hub decides with. A test builds a hub with other values. */
export interface RealtimeLimits {
  readonly maxConnections: number;
  readonly maxAnonymous: number;
  readonly maxPerSession: number;
  readonly maxPerDevice: number;
  readonly heartbeatIntervalMs: number;
  readonly meterWireRateHz: number;
  readonly meterSkipBytes: number;
  readonly hardBufferBytes: number;
  readonly closeGraceMs: number;
  readonly resyncMinIntervalMs: number;
  readonly clientMessageMaxBytes: number;
  readonly clientMessageLimit: { readonly count: number; readonly windowMs: number };
  readonly tabletLinkDebounceMs: number;
  readonly tabletLinkRetryMs: number;
  readonly devicesChangedDebounceMs: number;
  readonly devicesChangedMaxWaitMs: number;
  readonly endedMemoryMs: number;
}

export const REALTIME_LIMITS: RealtimeLimits = Object.freeze({
  maxConnections: REALTIME_MAX_CONNECTIONS,
  maxAnonymous: REALTIME_MAX_ANONYMOUS,
  maxPerSession: REALTIME_MAX_PER_SESSION,
  maxPerDevice: REALTIME_MAX_PER_DEVICE,
  heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
  meterWireRateHz: REALTIME_METER_WIRE_RATE_HZ,
  meterSkipBytes: REALTIME_METER_SKIP_BYTES,
  hardBufferBytes: REALTIME_HARD_BUFFER_BYTES,
  closeGraceMs: REALTIME_CLOSE_GRACE_MS,
  resyncMinIntervalMs: REALTIME_RESYNC_MIN_INTERVAL_MS,
  clientMessageMaxBytes: REALTIME_CLIENT_MESSAGE_MAX_BYTES,
  clientMessageLimit: REALTIME_CLIENT_MESSAGE_LIMIT,
  tabletLinkDebounceMs: TABLET_LINK_DEBOUNCE_MS,
  tabletLinkRetryMs: TABLET_LINK_RETRY_MS,
  devicesChangedDebounceMs: DEVICES_CHANGED_DEBOUNCE_MS,
  devicesChangedMaxWaitMs: DEVICES_CHANGED_MAX_WAIT_MS,
  endedMemoryMs: REALTIME_ENDED_MEMORY_MS,
});

/** The text of a close frame. Fixed: it never holds anything of a request or a message. */
export const CLOSE_REASON = {
  SHUTDOWN: 'server shutdown',
  VIOLATION: 'protocol violation',
  CAP: 'connection cap',
  /** The oldest socket of a principal at its own cap, when a newer one of the same principal arrives. */
  REPLACED: 'replaced by a newer connection',
  SESSION_ENDED: 'session ended',
  CREDENTIAL: 'credential not valid',
  DEVICE_REVOKED: 'device not paired',
  SLOW_CONSUMER: 'slow consumer',
} as const;
