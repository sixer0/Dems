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
 * WAIVED EDITS (task 3, decisions OD-14 and D108; capture spec §I edits 15 to 18): the two keys of
 * the development fence. `DEMS_CAPTURE_DEV_SOURCES` (`1` or `0`, the default: development sources
 * exist) and `DEMS_CAPTURE_HELPER_FFMPEG` (the program the development helpers run). What a start
 * refuses for them is the capture fence's decision (capture spec §A.1.2), not this file's.
 * WAIVED EDIT (task 3, fix wave H, ruling D198; the category of OD-14 and D108): one more key of the
 * development fence. `DEMS_CAPTURE_DEV_FAKE_MIC` (`tone`, the default, or `speech`): what the first
 * generated test microphone plays. What a start refuses for it is the capture fence's decision.
 * WAIVED EDIT (task 3, fix wave H closing pass Z1, decision D207): the installation identity of the
 * Core. `DEMS_INSTALLATION_DEVICE_ID` (a device id, e.g. `DEMS-SITE-21`) and `DEMS_INSTALLATION_NAME`
 * (a display name) are what the signed manifest of a sealed recording states as its device. Read
 * once, at start. Whether a start without them is refused is the sealing host's decision.
 * WAIVED EDIT (task 4 row 21, work package WP-02; the category of OD-14): the two program paths of
 * production capture. `DEMS_CAPTURE_RELAY` (the relay of a camera) and `DEMS_CAPTURE_GUARD` (the
 * guard of a helper) are absolute paths, started by the production door only. Whether a start
 * without them is refused is the decision of the boot checks of production capture, not this file's.
 * WAIVED EDIT (task 4 row 105, work package WP-19b; the category of OD-14): the socket of the capture
 * host's address helper. `DEMS_CAPTURE_ALIAS_SOCKET` is an absolute path; unset, the helper is "not
 * configured" for the capture commissioning functions. It is dialled by the one local-socket client.
 * WAIVED EDIT (task 4 row 85c, decision C60 (3); the category of OD-14): the audio helper of production
 * capture. `DEMS_CAPTURE_AUDIO_HELPER` is an absolute path; unset, no production microphone can be
 * opened. It is started by the guard of production capture, never directly and never by a development door.
 * WAIVED EDITS (decision D62, ratified 2026-11-05; the category of OD-14): the four keys of SMART
 * ATTACH. `DEMS_CAMERA_AUTOATTACH` (`1` turns the segment sweep on; unset, empty or `0` leaves it
 * off, and every other environment is exactly as it was), `DEMS_CAMERA_SEGMENT_CIDR` (one IPv4 `/24`
 * literal, required while the sweep is on: a start that turns it on without its segment stops the
 * boot here), and the optional pair `DEMS_CAMERA_DEFAULT_USER` with `DEMS_CAMERA_DEFAULT_PASSWORD`
 * (the bench camera credential, read ONLY to test and store an auto-adopted camera; the secret is a
 * `Secret` and prints as `[redacted]`). Without the pair the sweep still lists what answers: nothing
 * is tested, adopted or assigned.
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
export const ENV_LCD_BACKEND_URL = 'DEMS_LCD_BACKEND_URL';
export const ENV_CAPTURE_MODE = 'DEMS_CAPTURE_MODE';
export const ENV_CAPTURE_WORKER = 'DEMS_CAPTURE_WORKER';
export const ENV_MEDIA_DIR = 'DEMS_MEDIA_DIR';
export const ENV_CAPTURE_DEV_SOURCES = 'DEMS_CAPTURE_DEV_SOURCES';
export const ENV_CAPTURE_HELPER_FFMPEG = 'DEMS_CAPTURE_HELPER_FFMPEG';
export const ENV_CAPTURE_DEV_FAKE_MIC = 'DEMS_CAPTURE_DEV_FAKE_MIC';
export const ENV_INSTALLATION_DEVICE_ID = 'DEMS_INSTALLATION_DEVICE_ID';
export const ENV_INSTALLATION_NAME = 'DEMS_INSTALLATION_NAME';
export const ENV_CAPTURE_RELAY = 'DEMS_CAPTURE_RELAY';
export const ENV_CAPTURE_GUARD = 'DEMS_CAPTURE_GUARD';
export const ENV_CAPTURE_ALIAS_SOCKET = 'DEMS_CAPTURE_ALIAS_SOCKET';
export const ENV_CAPTURE_AUDIO_HELPER = 'DEMS_CAPTURE_AUDIO_HELPER';
// Decision D62 (2026-11-05): the four keys of SMART ATTACH (segment sweep, its /24, the bench pair).
export const ENV_CAMERA_AUTOATTACH = 'DEMS_CAMERA_AUTOATTACH';
export const ENV_CAMERA_SEGMENT_CIDR = 'DEMS_CAMERA_SEGMENT_CIDR';
export const ENV_CAMERA_DEFAULT_USER = 'DEMS_CAMERA_DEFAULT_USER';
export const ENV_CAMERA_DEFAULT_PASSWORD = 'DEMS_CAMERA_DEFAULT_PASSWORD';

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];
export const DEFAULT_LOG_LEVEL: LogLevel = 'info';

export const CAPTURE_MODES = ['simulated', 'real'] as const;
export type CaptureMode = (typeof CAPTURE_MODES)[number];
export const DEFAULT_CAPTURE_MODE: CaptureMode = 'simulated';
export const CAPTURE_DEV_FAKE_MICS = ['tone', 'speech'] as const;
export type CaptureDevFakeMic = (typeof CAPTURE_DEV_FAKE_MICS)[number];
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
  /** Optional local LCD bridge. Configured at startup; never a browser supplied URL. */
  readonly lcdBackendUrl?: string | null;
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
  /** The development flag of the capture fence. Read by ONE function: `captureOperationDecisionOf` (static rule G-R15). */
  readonly captureDevSources: boolean;
  /** Absolute path of the program the development helpers run, or null when none is configured. */
  readonly captureHelperFfmpegPath: string | null;
  /** What the first generated test microphone plays. Read by ONE function: `fakeMicDecisionOf` of the capture fence. */
  readonly captureDevFakeMic: CaptureDevFakeMic;
  /** The device id of this installation, or null when none is configured. Read by ONE function: `installationIdentityOf` of the sealing host. */
  readonly installationDeviceId: string | null;
  /** The display name of this installation, or null when none is configured. */
  readonly installationName: string | null;
  /** Absolute path of the relay program of production capture, or null when none is configured. Started by the production door only. */
  readonly captureRelayPath: string | null;
  /** Absolute path of the guard program of production capture, or null when none is configured. Started by the production door only. */
  readonly captureGuardPath: string | null;
  /** Absolute path of the socket of the capture host's address helper, or null when none is configured. */
  readonly captureAliasSocketPath: string | null;
  /** Absolute path of the audio helper of production capture, or null when none is configured. Started by the guard of production capture only. */
  readonly captureAudioHelperPath: string | null;
  /** Decision D62 (2026-11-05) SMART ATTACH: true only when `DEMS_CAMERA_AUTOATTACH=1`. Off by default: no sweep, no timer, nothing changes. */
  readonly cameraAutoattach: boolean;
  /** Decision D62: the one IPv4 `/24` literal of the camera segment the sweep reads, or null when unset. Required while the sweep is on: `createConfig` refuses the pair otherwise. */
  readonly cameraSegmentCidr: string | null;
  /** Decision D62: the bench camera user name, or null. Read ONLY for the auto connect-test and the stored credential; without it nothing is auto-adopted. */
  readonly cameraDefaultUser: string | null;
  /** Decision D62: its password as a `Secret` (prints `[redacted]`, reaches no log line), or null. */
  readonly cameraDefaultPassword: Secret | null;
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

/** `1` turns the development flag on; unset, empty or `0` leaves it off. Any other value stops the boot. */
export function parseCaptureDevSources(raw: string | undefined): boolean {
  if (raw === undefined || raw === '' || raw === '0') return false;
  if (raw === '1') return true;
  throw new ConfigError('CAPTURE_DEV_SOURCES_INVALID', `${ENV_CAPTURE_DEV_SOURCES} must be 1 or 0.`);
}

/** Unset or empty means `tone`. Any other value than the two stops the boot. */
export function parseCaptureDevFakeMic(raw: string | undefined): CaptureDevFakeMic {
  if (raw === undefined || raw === '') return 'tone';
  const source = CAPTURE_DEV_FAKE_MICS.find((known) => known === raw);
  if (source === undefined) throw new ConfigError('CAPTURE_DEV_FAKE_MIC_INVALID', `${ENV_CAPTURE_DEV_FAKE_MIC} must be one of ${CAPTURE_DEV_FAKE_MICS.join(', ')}.`);
  return source;
}

/** A device id of the contract's form (`DEMS-SITE-21`), or null when the variable is unset. Any other value stops the boot. */
export function parseInstallationDeviceId(raw: string | undefined): string | null {
  if (raw === undefined || raw === '') return null;
  if (!/^[A-Z][A-Z0-9-]{0,31}$/.test(raw)) throw new ConfigError('INSTALLATION_DEVICE_ID_INVALID', `${ENV_INSTALLATION_DEVICE_ID} must be a device id: a capital letter, then capitals, digits or hyphens, 32 characters at most.`);
  return raw;
}

/** A display name of 1 to 120 printable characters, or null when the variable is unset. Any other value stops the boot. */
export function parseInstallationName(raw: string | undefined): string | null {
  if (raw === undefined || raw === '') return null;
  if (raw.length > 120 || raw !== raw.trim() || [...raw].some((character) => (character.codePointAt(0) ?? 0) < 32 || character.codePointAt(0) === 127)) throw new ConfigError('INSTALLATION_NAME_INVALID', `${ENV_INSTALLATION_NAME} must be 1 to 120 printable characters without a leading or trailing space.`);
  return raw;
}

// ── Decision D62 (2026-11-05): SMART ATTACH ─────────────────────────────────────────────────────

/** `1` turns the SMART ATTACH segment sweep on; unset, empty or `0` leaves it off. Any other value stops the boot. */
export function parseCameraAutoattach(raw: string | undefined): boolean {
  if (raw === undefined || raw === '' || raw === '0') return false;
  if (raw === '1') return true;
  throw new ConfigError('CAMERA_AUTOATTACH_INVALID', `${ENV_CAMERA_AUTOATTACH} must be 1 or 0.`);
}

/**
 * The one form of `DEMS_CAMERA_SEGMENT_CIDR` (decision D62): a strict dotted IPv4 quad — four
 * decimal parts from 0 to 255 without a leading zero — and the literal prefix length `/24`. No
 * other prefix, no host name, no port, no blank: the sweep reads exactly one /24 of the host.
 */
export const CAMERA_SEGMENT_CIDR_PATTERN = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}\/24$/;

/** One IPv4 `/24` literal, or null when the variable is unset. Any other text stops the boot. */
export function parseCameraSegmentCidr(raw: string | undefined): string | null {
  if (raw === undefined || raw === '') return null;
  if (!CAMERA_SEGMENT_CIDR_PATTERN.test(raw)) throw new ConfigError('CAMERA_SEGMENT_CIDR_INVALID', `${ENV_CAMERA_SEGMENT_CIDR} must be one IPv4 /24 literal, e.g. 192.168.7.0/24.`);
  return raw;
}

/** The bench camera user name of decision D62: 1 to 120 printable characters without surrounding space, or null when unset. */
export function parseCameraDefaultUser(raw: string | undefined): string | null {
  if (raw === undefined || raw === '') return null;
  if (raw.length > 120 || raw !== raw.trim() || [...raw].some((character) => (character.codePointAt(0) ?? 0) < 32 || character.codePointAt(0) === 127)) throw new ConfigError('CAMERA_DEFAULT_USER_INVALID', `${ENV_CAMERA_DEFAULT_USER} must be 1 to 120 printable characters without a leading or trailing space.`);
  return raw;
}

/** The bench camera password of decision D62, sealed in a `Secret`: it prints as `[redacted]` and reaches no log line. Null when unset. */
export function parseCameraDefaultPassword(raw: string | undefined): Secret | null {
  if (raw === undefined || raw === '') return null;
  if (raw.length > 256 || [...raw].some((character) => (character.codePointAt(0) ?? 0) < 32 || character.codePointAt(0) === 127)) throw new ConfigError('CAMERA_DEFAULT_PASSWORD_INVALID', `${ENV_CAMERA_DEFAULT_PASSWORD} must be 1 to 256 printable characters.`);
  return new Secret(raw);
}

// ── Building the configuration object ──────────────────────────────────────────────────────────

export interface ConfigInput {
  readonly lcdBackendUrl?: string | null;
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
  /** Default: false (no development source exists). */
  readonly captureDevSources?: boolean;
  /** Default: null (no helper program). */
  readonly captureHelperFfmpegPath?: string | null;
  /** Default: `tone`. */
  readonly captureDevFakeMic?: CaptureDevFakeMic;
  /** Default: null (no installation identity is configured). */
  readonly installationDeviceId?: string | null;
  /** Default: null. */
  readonly installationName?: string | null;
  /** Default: null (no relay program of production capture). */
  readonly captureRelayPath?: string | null;
  /** Default: null (no guard program of production capture). */
  readonly captureGuardPath?: string | null;
  /** Default: null (no socket of the capture host's address helper). */
  readonly captureAliasSocketPath?: string | null;
  /** Default: null (no audio helper of production capture). */
  readonly captureAudioHelperPath?: string | null;
  /** Decision D62 (2026-11-05). Default: false (no SMART ATTACH sweep, no timer). */
  readonly cameraAutoattach?: boolean;
  /** Decision D62: one IPv4 `/24` literal, or null. Required when `cameraAutoattach` is on. */
  readonly cameraSegmentCidr?: string | null;
  /** Decision D62. Default: null (no bench camera user: nothing is auto-adopted). */
  readonly cameraDefaultUser?: string | null;
  /** Decision D62. Default: null (no bench camera password). */
  readonly cameraDefaultPassword?: Secret | null;
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
  const captureHelperFfmpegPath = parseCapturePath(ENV_CAPTURE_HELPER_FFMPEG, input.captureHelperFfmpegPath ?? undefined);
  // Decision D62 (2026-11-05): a sweep that is on without its segment is refused HERE, at the one
  // place that builds a configuration: no half-wired timer can start. Off is always whole: no CIDR needed.
  const cameraAutoattach = input.cameraAutoattach ?? false;
  const cameraSegmentCidr = parseCameraSegmentCidr(input.cameraSegmentCidr ?? undefined);
  if (cameraAutoattach && cameraSegmentCidr === null) {
    throw new ConfigError('CAMERA_SEGMENT_CIDR_REQUIRED', `${ENV_CAMERA_SEGMENT_CIDR} must hold one IPv4 /24 literal while ${ENV_CAMERA_AUTOATTACH} is on.`);
  }
  return Object.freeze({
    lcdBackendUrl: parseLcdBackendUrl(input.lcdBackendUrl ?? undefined),
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
    captureDevSources: input.captureDevSources ?? false,
    captureHelperFfmpegPath,
    captureDevFakeMic: input.captureDevFakeMic ?? 'tone',
    installationDeviceId: parseInstallationDeviceId(input.installationDeviceId ?? undefined),
    installationName: parseInstallationName(input.installationName ?? undefined),
    captureRelayPath: parseCapturePath(ENV_CAPTURE_RELAY, input.captureRelayPath ?? undefined),
    captureGuardPath: parseCapturePath(ENV_CAPTURE_GUARD, input.captureGuardPath ?? undefined),
    captureAliasSocketPath: parseCapturePath(ENV_CAPTURE_ALIAS_SOCKET, input.captureAliasSocketPath ?? undefined),
    captureAudioHelperPath: parseCapturePath(ENV_CAPTURE_AUDIO_HELPER, input.captureAudioHelperPath ?? undefined),
    // Decision D62 (2026-11-05): SMART ATTACH. Off by default; the segment is re-read through its pattern here, so no caller can smuggle another form in.
    cameraAutoattach,
    cameraSegmentCidr,
    cameraDefaultUser: parseCameraDefaultUser(input.cameraDefaultUser ?? undefined),
    cameraDefaultPassword: input.cameraDefaultPassword ?? null,
  });
}

/** LCD integration, user request 2026-10-19: host-only HTTP service, no redirects or remote hosts. */
export function parseLcdBackendUrl(raw: string | undefined): string | null {
  if (raw === undefined || raw === '') return null;
  const matched = /^http:\/\/127\.0\.0\.1:([0-9]{1,5})\/?$/.exec(raw);
  const port = Number(matched?.[1]);
  if (matched === null || port < 1 || port > 65_535) {
    throw new ConfigError('LCD_BACKEND_URL_INVALID', 'DEMS_LCD_BACKEND_URL must be http://127.0.0.1:<port> with a valid port.');
  }
  return `http://127.0.0.1:${port}`;
}
