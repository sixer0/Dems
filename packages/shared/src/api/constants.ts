/**
 * Network constants (masterplan/01_specs.md §2.4).
 *
 * Both apps use these values directly; there are no environment overrides. The Android
 * emulator reaches the same loopback URLs through `adb reverse tcp:4400 tcp:4400`.
 */

export const MOCK_CORE_HOST = '127.0.0.1';
export const MOCK_CORE_PORT = 4400;
export const CORE_HTTP_ORIGIN = 'http://127.0.0.1:4400';

/** `/api/v1`-versioned REST surface (01 L363, ICD-23). */
export const API_BASE_PATH = '/api/v1';
/** Service liveness (not the book's `/api/v1/device/health` snapshot). */
export const HEALTH_PATH = '/api/v1/health';
/** The book leaves the WS path undefined (01 G6); `/ws` is the spec's choice. */
export const WS_PATH = '/ws';
export const CORE_WS_URL = 'ws://127.0.0.1:4400/ws';

export const HEARTBEAT_INTERVAL_MS = 1000;
export const HEARTBEAT_STALE_AFTER_MS = 2500;
/** Reconnect delays; the last value repeats. */
export const RECONNECT_BACKOFF_MS = [500, 1000, 2000, 4000, 8000] as const;
export const RECONNECT_JITTER_MS = 250;

/** Browser origins of the Vite dev server (CORS and WS allowlist). */
export const WEB_DEV_ORIGINS = ['http://127.0.0.1:5173', 'http://localhost:5173'] as const;
/** The service's own loopback origins (React Native may send one on WS upgrade, H-S4). */
export const SELF_ORIGINS = ['http://127.0.0.1:4400', 'http://localhost:4400'] as const;

export const SERVICE_NAME = 'dems-mock-core';
export const API_VERSION = 'v1';

// ── Core server (backend task: 2026-10-04 01_specs §2.4, §7.1; 02_plan §3.4) ──────────────────
// Additive: every value above stays as it is, so mock-core, the packaged launcher and their
// guard test are untouched. The server's own lists (web console origins, its own origins, the
// cookie name) live in its configuration module, not here (OR-7).

/** The PostgreSQL-backed Core server (`apps/core-server`): loopback only, main instance. */
export const CORE_SERVER_HOST = '127.0.0.1';
/** The main instance. Lane instances listen on 4421 to 4423; every app reaches 4420. */
export const CORE_SERVER_PORT = 4420;
export const CORE_SERVER_HTTP_ORIGIN = 'http://127.0.0.1:4420';
export const CORE_SERVER_WS_URL = 'ws://127.0.0.1:4420/ws';
/** `service` of the Core server's health answer (`HealthResponse`). */
export const CORE_SERVER_SERVICE_NAME = 'dems-core-server';

/** Largest JSON request body in bytes (API-4); a larger one answers 413 `PAYLOAD_TOO_LARGE`. */
export const API_BODY_LIMIT_BYTES = 65_536;

/** Every answer of the Core server carries the request ID here; an error envelope repeats it as `error.requestId`. */
export const REQUEST_ID_HEADER_NAME = 'x-request-id';
/**
 * API-7: every 2xx answer of a POST carries the state revision that holds the command's effect.
 * Both values are non-negative integers, sent as decimal text: the epoch counts demo resets and
 * scenario loads (it continues, previous plus 1), the revision restarts at 0 with each epoch.
 */
export const EPOCH_HEADER_NAME = 'x-dems-epoch';
export const REVISION_HEADER_NAME = 'x-dems-revision';
/** Sent with 429 `RATE_LIMITED`: whole seconds until the caller's key is counted afresh. */
export const RETRY_AFTER_HEADER_NAME = 'retry-after';
/** Sent with 405 `METHOD_NOT_ALLOWED`: the methods the path accepts. */
export const ALLOW_HEADER_NAME = 'allow';

// ── Realtime protocol of the Core server (backend task: 2026-10-04 01_specs §9.1, §9.4) ───────
// The numbers a client and the server must agree on. The server's own limits (connection caps,
// send buffers, the ping, delta pacing, the meter rate) live in its configuration, not here.

/** A client sends at most one `resync` in this time; the server answers each with a `snapshot` (RT-6). */
export const REALTIME_RESYNC_MIN_INTERVAL_MS = 2_000;
/** Largest message a client may send, in bytes (RT-P4). */
export const REALTIME_CLIENT_MESSAGE_MAX_BYTES = 65_536;
/** A connection that sends more client messages than this is closed with 1008 (RT-P5). */
export const REALTIME_CLIENT_MESSAGE_LIMIT = { count: 30, windowMs: 10_000 } as const;

// ── List reads of the Core server (backend task: 2026-10-04 01_specs §7.1 API-9) ──────────────
// A list is cursor-paged: the query takes `cursor` (opaque) and `limit`, the answer holds
// `nextCursor` or null. A client that sends no limit gets the default; the query schemas carry no
// default of their own, so the typed client sends only what the caller gave.

/**
 * Longest reason of an export (evidence, audit log, log bundle), in characters and in UTF-16 code
 * units, after trimming. The reason is mandatory for all three (01_specs §7.9, §7.13) and is
 * stored with the export record and in its audit row; the specification gives the minimum of 5
 * only, and 500 is the cap the contract gives every other reason.
 */
export const EXPORT_REASON_MAX_LENGTH = 500;

/** Rows of a page when the query names no `limit`. */
export const API_PAGE_LIMIT_DEFAULT = 50;
/** Largest `limit` a list read accepts. */
export const API_PAGE_LIMIT_MAX = 200;
