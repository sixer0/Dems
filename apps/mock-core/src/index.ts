/**
 * mock-core entry point (masterplan/01_specs.md §3.1, §3.5).
 * Binds 127.0.0.1:4400 only (SD-41, NFR4) and shuts down gracefully on SIGINT/SIGTERM.
 */
import { MOCK_CORE_HOST, MOCK_CORE_PORT } from '@dems/shared/api';
import { buildApp } from './app';
import { appendErrorLog, toErrorFields } from './error-log';

const SHUTDOWN_TIMEOUT_MS = 5000;

const app = buildApp();
let shuttingDown = false;

function fatal(source: string, error: unknown): void {
  app.log.fatal({ err: error }, source);
  appendErrorLog({ level: 'fatal', source: `mock-core.${source}`, ...toErrorFields(error) });
  process.exit(1);
}

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) {
    app.log.error({ signal }, 'second signal during shutdown; forcing exit');
    process.exit(1);
  }
  shuttingDown = true;
  app.log.info({ signal }, 'shutdown requested');

  const timer = setTimeout(() => {
    app.log.error({ timeoutMs: SHUTDOWN_TIMEOUT_MS }, 'shutdown timeout');
    appendErrorLog({ level: 'error', source: 'mock-core.shutdown', message: 'shutdown timeout' });
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  timer.unref();

  try {
    await app.close();
    app.log.info('shutdown complete');
    // Let stdout drain and exit naturally; the unref'd timer only fires if something hangs.
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
  await app.listen({ host: MOCK_CORE_HOST, port: MOCK_CORE_PORT });
} catch (error) {
  fatal('listen', error);
}
