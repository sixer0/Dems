/**
 * The configuration loader (spec §2.4, §14.1; 02_plan §3.4).
 *
 * Inputs: three environment values (`DEMS_CORE_PORT`, `DEMS_DEMO_CONTROLS`, `DEMS_LOG_LEVEL`),
 * passed in as an object, and one file, the runtime connection file in the data directory.
 * It opens no other file: the two other credential files of the data directory belong to the
 * provisioning scripts and to the reset routine (SR-68, HC-1, HC-2).
 *
 * The database is not taken from the file: it follows the listen port, so one process per
 * database cannot be misconfigured (DA-07). Host and port come from the file and from nowhere
 * else; there is no default for either (decision D26).
 */
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONNECTION_FILE_KEYS,
  CONNECTION_FILE_NAME,
  ConfigError,
  ENV_CAPTURE_ALIAS_SOCKET,
  ENV_CAPTURE_AUDIO_HELPER,
  ENV_CAPTURE_DEV_FAKE_MIC,
  ENV_CAPTURE_DEV_SOURCES,
  ENV_CAPTURE_GUARD,
  ENV_CAPTURE_HELPER_FFMPEG,
  ENV_CAPTURE_MODE,
  ENV_CAPTURE_RELAY,
  ENV_CAPTURE_WORKER,
  ENV_DEMO_CONTROLS,
  ENV_INSTALLATION_DEVICE_ID,
  ENV_INSTALLATION_NAME,
  ENV_LISTEN_PORT,
  ENV_LOG_LEVEL,
  ENV_LCD_BACKEND_URL,
  ENV_MEDIA_DIR,
  RUNTIME_ROLE,
  createConfig,
  parseCaptureDevFakeMic,
  parseCaptureDevSources,
  parseCaptureMode,
  parseCapturePath,
  parseInstallationDeviceId,
  parseInstallationName,
  databaseNameFor,
  parseDemoControls,
  parseListenPort,
  parseLogLevel,
  parseLcdBackendUrl,
  type CoreServerConfig,
} from '../../config';
import { readConnectionFile } from './connection-file';

/** `<workspace root>/.data`: git-ignored, mode 0700, created by the provisioning script. */
export const DEFAULT_DATA_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  '..',
  '.data',
);

export interface LoadConfigOptions {
  /** The environment to read. The entry point passes `process.env`; tests pass a literal. */
  readonly env: Readonly<Record<string, string | undefined>>;
  /** The directory that holds the connection file. Default: `DEFAULT_DATA_DIR`. */
  readonly dataDir?: string;
}

/**
 * Builds the configuration or throws a `ConfigError`, which stops the boot. The environment is
 * checked first, so a wrong port or flag is reported before any file is opened.
 */
export function loadConfig(options: LoadConfigOptions): CoreServerConfig {
  const lcdBackendUrl = parseLcdBackendUrl(options.env[ENV_LCD_BACKEND_URL]);
  const port = parseListenPort(options.env[ENV_LISTEN_PORT]);
  const demoControls = parseDemoControls(options.env[ENV_DEMO_CONTROLS]);
  const logLevel = parseLogLevel(options.env[ENV_LOG_LEVEL]);
  // The three capture keys (task 3, capture spec §I edits 7 to 10). Checked with the others,
  // before any file is opened. Nothing here says that `real` needs a worker: the boot checks do.
  const captureMode = parseCaptureMode(options.env[ENV_CAPTURE_MODE]);
  const captureWorkerPath = parseCapturePath(ENV_CAPTURE_WORKER, options.env[ENV_CAPTURE_WORKER]);
  const mediaStoreDir = parseCapturePath(ENV_MEDIA_DIR, options.env[ENV_MEDIA_DIR]);
  // The two keys of the development fence (task 3 row 136, capture spec §I edits 15 to 18). Parsed
  // here and decided nowhere here: which combination boots is the capture fence's (spec §A.1.2).
  const captureDevSources = parseCaptureDevSources(options.env[ENV_CAPTURE_DEV_SOURCES]);
  const captureHelperFfmpegPath = parseCapturePath(ENV_CAPTURE_HELPER_FFMPEG, options.env[ENV_CAPTURE_HELPER_FFMPEG]);
  // What the first generated test microphone plays (fix wave H, ruling D198). Parsed here; refused or not by the capture fence.
  const captureDevFakeMic = parseCaptureDevFakeMic(options.env[ENV_CAPTURE_DEV_FAKE_MIC]);
  // The two programs of production capture (task 4 row 21; read here by integration pass I-3): the relay of a camera
  // and the guard of a microphone. Unset means null. The same rule as every program path above (absolute, no NUL);
  // whether production capture may boot without them is the boot checks', not this file's.
  const captureRelayPath = parseCapturePath(ENV_CAPTURE_RELAY, options.env[ENV_CAPTURE_RELAY]);
  const captureGuardPath = parseCapturePath(ENV_CAPTURE_GUARD, options.env[ENV_CAPTURE_GUARD]);
  // The socket of the capture host's address helper (task 4 row 105). Unset means null: the helper is "not configured".
  // The same path rule (absolute, no NUL); what the node must be is checked by the one client before it dials.
  const captureAliasSocketPath = parseCapturePath(ENV_CAPTURE_ALIAS_SOCKET, options.env[ENV_CAPTURE_ALIAS_SOCKET]);
  // The audio helper of production capture (task 4 row 85c, decision C60 (3)). Unset means null: no production microphone
  // can be opened. The same path rule as every program key above (absolute, no NUL); it is started by the guard only.
  const captureAudioHelperPath = parseCapturePath(ENV_CAPTURE_AUDIO_HELPER, options.env[ENV_CAPTURE_AUDIO_HELPER]);
  // The installation identity (fix wave H closing pass Z1, decision D207). Parsed here; whether a start without it is refused is the sealing host's.
  const installationDeviceId = parseInstallationDeviceId(options.env[ENV_INSTALLATION_DEVICE_ID]);
  const installationName = parseInstallationName(options.env[ENV_INSTALLATION_NAME]);

  const dataDir = resolve(options.dataDir ?? DEFAULT_DATA_DIR);
  const file = join(dataDir, CONNECTION_FILE_NAME);
  const fields = readConnectionFile(file);

  if (fields.user !== RUNTIME_ROLE) {
    throw new ConfigError(
      'CONNECTION_FILE_ROLE',
      `${file}: ${CONNECTION_FILE_KEYS.user} must be ${RUNTIME_ROLE}; the server holds no other role.`,
    );
  }
  if (!/^[0-9]{1,5}$/.test(fields.port)) {
    throw new ConfigError('DATABASE_PORT_INVALID', `${file}: ${CONNECTION_FILE_KEYS.port} must be a port number.`);
  }

  return createConfig({
    lcdBackendUrl,
    port,
    demoControls,
    logLevel,
    dataDir,
    database: {
      host: fields.host,
      port: Number(fields.port),
      database: databaseNameFor(port),
      user: fields.user,
      password: fields.password,
    },
    captureMode,
    captureWorkerPath,
    mediaStoreDir,
    captureDevSources,
    captureHelperFfmpegPath,
    captureDevFakeMic,
    captureRelayPath,
    captureGuardPath,
    captureAliasSocketPath,
    captureAudioHelperPath,
    installationDeviceId,
    installationName,
  });
}
