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
