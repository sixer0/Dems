/**
 * Configuration module of the DEMS Core server (masterplan/01_specs.md §2.4; 02_plan.md §3.4).
 *
 * Everything here is a constant, a type or a pure function. Reading the environment and the
 * connection file is the loader's job (`plugins/config`); the entry point (`index.ts`) is the only
 * file that touches `process.env`.
 *
 * FROZEN after plan row W08 (P25): no later row edits this file. A value that is missing here is
 * a `needs-review`, not a local constant somewhere else.
 *
 * Fixed here, not configurable:
 *   - the listen host (SR-01);
 *   - the web console origins and the instance's own origins (OR-1, OR-7): no `localhost` entry;
 *   - the session cookie name, derived from the listen port (ID-P7);
 *   - the database that belongs to a listen port (one process per database, DA-07).
 * Configurable, at start only: the listen port within 4420 to 4423, the demo flag, the log level.
 * WAIVED EDITS (task 3, decision OD-14; capture spec §I edits 7 to 10): the three capture keys.
 * `DEMS_CAPTURE_MODE` (`simulated`, the default, or `real`), `DEMS_CAPTURE_WORKER` (the worker
 * program) and `DEMS_MEDIA_DIR` (the media root). Whether a start in `real` mode is refused for a
 * missing key is the boot checks' decision (CS-22), not this file's.
 */

// ── Listener (SR-01, ADQ-5, ADQ-10) ────────────────────────────────────────────────────────────

/** The only address the server ever binds. A constant in code; no variable can change it. */
export const LISTEN_HOST = '127.0.0.1';
/** 4420 is the main instance; 4421 to 4423 are the lane instances. Any other value stops the boot. */
export const LISTEN_PORTS = [4420, 4421, 4422, 4423] as const;
export type ListenPort = (typeof LISTEN_PORTS)[number];
export const DEFAULT_LISTEN_PORT: ListenPort = 4420;

/**
 * `service` of the health answer (spec §7.4). The shared contract gains the same value as
 * `CORE_SERVER_SERVICE_NAME` in a contract-owner row; a test holds the two together from then on.
 */
export const SERVICE_NAME = 'dems-core-server';

// ── Environment variable names (02_plan §3.4) ──────────────────────────────────────────────────

export const ENV_LISTEN_PORT = 'DEMS_CORE_PORT';
export const ENV_DEMO_CONTROLS = 'DEMS_DEMO_CONTROLS';
export const ENV_LOG_LEVEL = 'DEMS_LOG_LEVEL';
export const ENV_CAPTURE_MODE = 'DEMS_CAPTURE_MODE';
export const ENV_CAPTURE_WORKER = 'DEMS_CAPTURE_WORKER';
export const ENV_MEDIA_DIR = 'DEMS_MEDIA_DIR';

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];
export const DEFAULT_LOG_LEVEL: LogLevel = 'info';

export const CAPTURE_MODES = ['simulated', 'real'] as const;
export type CaptureMode = (typeof CAPTURE_MODES)[number];
export const DEFAULT_CAPTURE_MODE: CaptureMode = 'simulated';
/** Where the camera files live below the data directory when `DEMS_MEDIA_DIR` is unset (capture spec §H). */
export const MEDIA_STORE_SUBPATH = 'media/sessions';

// ── Requests (API-4, SR-64) ────────────────────────────────────────────────────────────────────

/** Largest request body in bytes; a larger one answers 413 `PAYLOAD_TOO_LARGE`. */
export const BODY_LIMIT_BYTES = 65_536;

// ── Origins and the cookie (spec §2.4, §14.2) ──────────────────────────────────────────────────

/**
 * The web console origins: the Vite dev server of the main instance and of the three lanes.
 * Compared as exact strings. There is deliberately no `localhost` entry (OR-7).
 */
export const WEB_CONSOLE_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5176',
  'http://127.0.0.1:5177',
  'http://127.0.0.1:5178',
] as const;

/**
 * The instance's own origins: the address every app uses through `adb reverse` (always port
 * 4420 on the device side) and, on a lane, the lane's own port. They are accepted only on a
 * request that carries no cookie (OR-1, OR-4).
 */
export function ownOriginsFor(port: ListenPort): readonly string[] {
  const main = `http://${LISTEN_HOST}:${DEFAULT_LISTEN_PORT}`;
  return port === DEFAULT_LISTEN_PORT ? [main] : [main, `http://${LISTEN_HOST}:${port}`];
}

/** `dems_session_<listen port>`: one cookie name per instance, because cookies ignore the port. */
export function sessionCookieNameFor(port: ListenPort): string {
  return `dems_session_${port}`;
}

// ── Database (spec §2.1 C-4, §14.1; database contract §7.6; decisions D26 / F27) ───────────────

/** The project's PostgreSQL listens on loopback IPv4 only; no other host is accepted. */
export const DATABASE_HOST = '127.0.0.1';
/**
 * PostgreSQL's default port. Another server, not this project's, listens there on the
 * development host (F27), so the loader refuses it and nothing falls back to it. This is the one
 * place in the server's sources where the number appears.
 */
export const FOREIGN_DATABASE_PORT = 5432;
/** The runtime role. The running server's pool never holds another one (SR-68, HC-4). */
export const RUNTIME_ROLE = 'dems_app';

/** The one credential file the server's loader opens, inside the data directory. */
export const CONNECTION_FILE_NAME = 'pg.env';
/** The five keys of the connection file, in file order (CR-1). */
export const CONNECTION_FILE_KEYS = {
  host: 'DEMS_PG_HOST',
  port: 'DEMS_PG_PORT',
  database: 'DEMS_PG_DATABASE',
  user: 'DEMS_PG_APP_ROLE',
  password: 'DEMS_PG_APP_PASSWORD',
} as const;

/** 4420 serves `dems_demo`; lane 442k serves `dems_lane_k`. The database follows the port. */
export function databaseNameFor(port: ListenPort): string {
  return port === DEFAULT_LISTEN_PORT ? 'dems_demo' : `dems_lane_${port - DEFAULT_LISTEN_PORT}`;
}

// ── Values ─────────────────────────────────────────────────────────────────────────────────────

const REDACTED = '[redacted]';

/**
 * A secret that cannot be printed by accident: `JSON.stringify`, string conversion and
 * `util.inspect` (so `console.log` too) all give "[redacted]". Only `reveal()` returns the value.
 */
export class Secret {
  readonly #value: string;

  constructor(value: string) {
    this.#value = value;
  }

  reveal(): string {
    return this.#value;
  }

  toJSON(): string {
    return REDACTED;
  }

  toString(): string {
    return REDACTED;
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return REDACTED;
  }
}

/** Five discrete connection fields. There is no connection URL anywhere in this project (CR-1). */
export interface DatabaseConnection {
  readonly host: typeof DATABASE_HOST;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: Secret;
}

export interface CoreServerConfig {
  readonly host: typeof LISTEN_HOST;
  readonly port: ListenPort;
  /** The demo flag: read once at start, never changeable through the API (DC-2, SR-57). */
  readonly demoControls: boolean;
  readonly logLevel: LogLevel;
  readonly webConsoleOrigins: readonly string[];
  readonly ownOrigins: readonly string[];
  readonly sessionCookieName: string;
  /**
   * Absolute path of the data directory that holds the connection files. The reset routine
   * finds the owner-role file here, and only while a reset runs with the demo flag on (HC-3).
   */
  readonly dataDir: string;
  /** The runtime connection (role `dems_app`). */
  readonly database: DatabaseConnection;
  /** `real`: sessions record through the capture worker. `simulated`: no worker is ever started. */
  readonly captureMode: CaptureMode;
  /** Absolute path of the capture worker program, or null when none is configured. */
  readonly captureWorkerPath: string | null;
  /** Absolute path of the media root (OD-25: git-ignored, below the data directory by default). */
  readonly mediaStoreDir: string;
}

/** A configuration that must stop the boot. `code` is stable; `message` never holds a secret. */
export class ConfigError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'ConfigError';
    this.code = code;
  }
}

// ── Parsing the three environment values ───────────────────────────────────────────────────────

function isListenPort(value: number): value is ListenPort {
  return (LISTEN_PORTS as readonly number[]).includes(value);
}

/** Unset means 4420. Anything outside 4420 to 4423 stops the boot. */
export function parseListenPort(raw: string | undefined): ListenPort {
  if (raw === undefined || raw === '') return DEFAULT_LISTEN_PORT;
  const value = /^[0-9]{1,5}$/.test(raw) ? Number(raw) : Number.NaN;
  if (!isListenPort(value)) {
    throw new ConfigError(
      'LISTEN_PORT_NOT_ALLOWED',
      `${ENV_LISTEN_PORT} must be one of ${LISTEN_PORTS.join(', ')}.`,
    );
  }
  return value;
}

/** `1` turns the demo flag on; unset, empty or `0` leaves it off. Any other value stops the boot. */
export function parseDemoControls(raw: string | undefined): boolean {
  if (raw === undefined || raw === '' || raw === '0') return false;
  if (raw === '1') return true;
  throw new ConfigError('DEMO_FLAG_INVALID', `${ENV_DEMO_CONTROLS} must be 1 or 0.`);
}

function isLogLevel(value: string): value is LogLevel {
  return (LOG_LEVELS as readonly string[]).includes(value);
}

export function parseLogLevel(raw: string | undefined): LogLevel {
  if (raw === undefined || raw === '') return DEFAULT_LOG_LEVEL;
  if (!isLogLevel(raw)) {
    throw new ConfigError('LOG_LEVEL_INVALID', `${ENV_LOG_LEVEL} must be one of ${LOG_LEVELS.join(', ')}.`);
  }
  return raw;
}

/** Unset means `simulated`. Any other value than the two modes stops the boot. */
export function parseCaptureMode(raw: string | undefined): CaptureMode {
  if (raw === undefined || raw === '') return DEFAULT_CAPTURE_MODE;
  const mode = CAPTURE_MODES.find((known) => known === raw);
  if (mode === undefined) throw new ConfigError('CAPTURE_MODE_INVALID', `${ENV_CAPTURE_MODE} must be one of ${CAPTURE_MODES.join(', ')}.`);
  return mode;
}

/** An absolute path, or null when the variable is unset. The value itself is never put in a message. */
export function parseCapturePath(name: string, raw: string | undefined): string | null {
  if (raw === undefined || raw === '') return null;
  if (!raw.startsWith('/') || raw.includes('\0')) throw new ConfigError('CAPTURE_PATH_NOT_ABSOLUTE', `${name} must be an absolute path.`);
  return raw;
}

// ── Building the configuration object ──────────────────────────────────────────────────────────

export interface ConfigInput {
  readonly port: ListenPort;
  readonly demoControls: boolean;
  readonly logLevel: LogLevel;
  readonly dataDir: string;
  readonly database: {
    readonly host: string;
    readonly port: number;
    readonly database: string;
    readonly user: string;
    readonly password: Secret;
  };
  /** Default: `simulated`. */
  readonly captureMode?: CaptureMode;
  /** Default: null (no worker program). */
  readonly captureWorkerPath?: string | null;
  /** Default: `<dataDir>/media/sessions`. */
  readonly mediaStoreDir?: string | null;
}

/**
 * Validates the connection endpoint and derives everything that follows from the listen port.
 * Pure: it reads no file and no environment, so tests build a configuration with it directly.
 *
 * It does not check the role name: a start with another role is refused by boot check B-4,
 * which a database test must be able to reach (T-PV-3). The loader checks the role name.
 */
export function createConfig(input: ConfigInput): CoreServerConfig {
  const { database } = input;
  if (database.host !== DATABASE_HOST) {
    throw new ConfigError('DATABASE_HOST_NOT_LOOPBACK', `The database host must be ${DATABASE_HOST}.`);
  }
  if (!Number.isInteger(database.port) || database.port < 1 || database.port > 65_535) {
    throw new ConfigError('DATABASE_PORT_INVALID', 'The database port must be an integer from 1 to 65535.');
  }
  if (database.port === FOREIGN_DATABASE_PORT) {
    throw new ConfigError(
      'DATABASE_PORT_FOREIGN',
      `Port ${FOREIGN_DATABASE_PORT} is another PostgreSQL server on this host, not the project's.`,
    );
  }
  if (database.database === '' || database.user === '') {
    throw new ConfigError('DATABASE_FIELD_EMPTY', 'The database name and the role must not be empty.');
  }
  const captureWorkerPath = parseCapturePath(ENV_CAPTURE_WORKER, input.captureWorkerPath ?? undefined);
  const mediaStoreDir = parseCapturePath(ENV_MEDIA_DIR, input.mediaStoreDir ?? undefined) ?? `${input.dataDir}/${MEDIA_STORE_SUBPATH}`;
  return Object.freeze({
    host: LISTEN_HOST,
    port: input.port,
    demoControls: input.demoControls,
    logLevel: input.logLevel,
    webConsoleOrigins: WEB_CONSOLE_ORIGINS,
    ownOrigins: ownOriginsFor(input.port),
    sessionCookieName: sessionCookieNameFor(input.port),
    dataDir: input.dataDir,
    database: Object.freeze({
      host: DATABASE_HOST,
      port: database.port,
      database: database.database,
      user: database.user,
      password: database.password,
    }),
    captureMode: input.captureMode ?? DEFAULT_CAPTURE_MODE,
    captureWorkerPath,
    mediaStoreDir,
  });
}
