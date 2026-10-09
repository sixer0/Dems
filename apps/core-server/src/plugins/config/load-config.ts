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
  ENV_CAPTURE_MODE,
  ENV_CAPTURE_WORKER,
  ENV_DEMO_CONTROLS,
  ENV_LISTEN_PORT,
  ENV_LOG_LEVEL,
  ENV_MEDIA_DIR,
  RUNTIME_ROLE,
  createConfig,
  parseCaptureMode,
  parseCapturePath,
  databaseNameFor,
  parseDemoControls,
  parseListenPort,
  parseLogLevel,
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
  const port = parseListenPort(options.env[ENV_LISTEN_PORT]);
  const demoControls = parseDemoControls(options.env[ENV_DEMO_CONTROLS]);
  const logLevel = parseLogLevel(options.env[ENV_LOG_LEVEL]);
  // The three capture keys (task 3, capture spec §I edits 7 to 10). Checked with the others,
  // before any file is opened. Nothing here says that `real` needs a worker: the boot checks do.
  const captureMode = parseCaptureMode(options.env[ENV_CAPTURE_MODE]);
  const captureWorkerPath = parseCapturePath(ENV_CAPTURE_WORKER, options.env[ENV_CAPTURE_WORKER]);
  const mediaStoreDir = parseCapturePath(ENV_MEDIA_DIR, options.env[ENV_MEDIA_DIR]);

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
  });
}
