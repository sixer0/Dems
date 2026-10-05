/**
 * Entry point of the DEMS Core server (plan row W08; spec §2.1, §8.6).
 *
 * Start order: configuration; build the app; boot (the boot steps: database checks, epoch,
 * rehydration, as the units add them); listen. A step that fails stops the process with one log
 * line that names it, and no listener is opened.
 *
 * This is the only file that listens, and the host is the constant `127.0.0.1` (SR-01): no
 * variable can change it. The port is `DEMS_CORE_PORT`, 4420 unless a lane sets 4421 to 4423.
 * It is also the only file that reads `process.env`.
 *
 * Stop: on SIGINT or SIGTERM requests are refused (503 `NOT_READY`), then `app.close()` runs
 * the units' `preClose` and `onClose` hooks: the pipeline is drained, the sockets are closed
 * and the pool is closed last.
 *
 * FROZEN after plan row W08 (P25): no later row edits this file.
 */
import { buildApp } from './app';
import { ConfigError, LISTEN_HOST, type CoreServerConfig } from './config';
import { loadConfig } from './plugins/config';
import { removeDriverEnvironment } from './plugins/db';
import { DEFAULT_ERROR_LOG_FILE, createErrorLog, describeError } from './plugins/logger';
import { BootError } from './plugins/readiness';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const errorLog = createErrorLog(DEFAULT_ERROR_LOG_FILE);

/**
 * A failure before the logger exists: one JSON line on standard error and one entry in the
 * error log. A `ConfigError` carries a message that is safe to print (it names a variable, a
 * file or a key, never a value); anything else is reported by name and code only.
 */
function refuseToStart(source: string, error: unknown): never {
  const description = describeError(error);
  const safe = error instanceof ConfigError;
  const code = safe ? error.code : description.code;
  const message = safe ? error.message : 'the server could not start';
  process.stderr.write(
    `${JSON.stringify({ level: 'fatal', time: new Date().toISOString(), source, code, message, errorName: description.errorName })}\n`,
  );
  errorLog.append({ level: 'fatal', source, message, ...description, code });
  process.exit(1);
}

const ignoredVariables = removeDriverEnvironment(process.env);

let config: CoreServerConfig;
try {
  config = loadConfig({ env: process.env });
} catch (error) {
  refuseToStart('index.config', error);
}

const app = buildApp({ config, errorLogFile: DEFAULT_ERROR_LOG_FILE });
let shuttingDown = false;

/** `source` says where the server stopped; `context` holds identifiers only (a boot check ID). */
function fatal(source: string, error: unknown, context: Record<string, string> = {}): never {
  const message = `the server stopped: ${source}`;
  app.log.fatal({ err: error, ...context }, message);
  errorLog.append({ level: 'fatal', source: `index.${source}`, message, ...describeError(error), context });
  process.exit(1);
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) {
    app.log.error({ signal }, 'second signal during shutdown; forcing exit');
    process.exit(1);
  }
  shuttingDown = true;
  app.log.info({ signal }, 'shutdown requested');
  if (app.hasDecorator('readiness')) app.readiness.hold('shutdown');

  const timer = setTimeout(() => {
    app.log.error({ timeoutMs: SHUTDOWN_TIMEOUT_MS }, 'shutdown timeout');
    errorLog.append({ level: 'error', source: 'index.shutdown', message: 'shutdown timeout' });
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  timer.unref();

  try {
    await app.close();
    app.log.info('shutdown complete');
    // Let standard output drain and exit naturally; the timer only fires if something hangs.
    process.exitCode = 0;
  } catch (error) {
    fatal('shutdown', error);
  }
}

process.on('SIGINT', (signal) => void shutdown(signal));
process.on('SIGTERM', (signal) => void shutdown(signal));
process.on('uncaughtException', (error) => fatal('uncaughtException', error));
process.on('unhandledRejection', (reason) => fatal('unhandledRejection', reason));

try {
  await app.ready();
  if (ignoredVariables.length > 0) {
    app.log.warn({ names: ignoredVariables }, 'ignored driver variables of the environment');
  }
  app.log.info(
    { port: config.port, database: config.database.database, demoControls: config.demoControls },
    'configuration loaded',
  );
  await app.readiness.boot();
  await app.listen({ host: LISTEN_HOST, port: config.port });
} catch (error) {
  if (error instanceof BootError) fatal('boot', error.cause, { check: error.stepId });
  fatal('start', error);
}
