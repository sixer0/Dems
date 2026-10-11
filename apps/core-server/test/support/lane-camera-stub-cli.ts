/**
 * The lane launcher of the development camera stub (fix wave H, driver D; gate 70 finding B-1;
 * decision D196; test strategy CR-5). A command-line program of the test support; not a test file.
 *
 *   tsx test/support/lane-camera-stub-cli.ts [--fixture-file <path>] [--mode-file <path>] [--seal-rig-file <path>] [--source-rig-file <path>]
 *
 * Started by `scripts/lane/lane.sh start <lane> --with-camera-stub`, through the npm script
 * `start:camera-stub` of this workspace, in the place of `src/index.ts`. It starts the SAME Core -
 * the same configuration loader, the same app factory, the same boot, the same one listener on the
 * constant host - and adds ONE thing: the fake ONVIF device on loopback as the discovery source
 * (`lane-camera-stub.ts`), when the capture fence admits it:
 *
 *   REAL_DEVELOPMENT   the Core starts with the stub;
 *   REAL_PRODUCTION    THE CORE IS NOT STARTED: one fatal line `the server stopped: boot`, check
 *                      `capture.cameraStub`, code `DEV_CAMERA_STUB_IN_PRODUCTION`, exit 1 - before
 *                      the stub binds anything and before any listener opens;
 *   SIMULATED          the Core starts WITHOUT the stub, and one warning line says so.
 *
 * THE START ORDER BELOW MIRRORS `src/index.ts` (frozen, P25: it has no seam for a launcher, by
 * design - the product's entry point cannot load test support). A change of the start order there
 * is mirrored here; `test/static/lane-camera-stub.test.ts` holds the two in step.
 *
 * THE SEAL RIG (fix wave K, decision D220). With `--seal-rig-file` the same launcher also puts the
 * development seal rig (`lane-seal-rig.ts`) in front of the fragment sealer: OFF until its switch
 * file says otherwise; a production configuration is not started (check `sealing.sealRig`, code
 * `DEV_SEAL_RIG_IN_PRODUCTION`); a SIMULATED lane starts without it and one line says so.
 *
 * THE SOURCE RIG (fix wave M, decision D232). With `--source-rig-file` the same launcher also hands
 * the capture fence the development source switch (`lane-source-rig.ts`): OFF until its switch file
 * names a generated test source; a production configuration is not started (check
 * `capture.sourceRig`, code `DEV_SOURCE_RIG_IN_PRODUCTION`); a SIMULATED lane starts without it.
 *
 * It reads `process.env` exactly as the entry point does (through the configuration loader) and
 * three paths from its arguments. It takes no address, no port and no credential from anywhere: the
 * stub binds 127.0.0.1 on ephemeral ports and makes its own fixture account.
 */
import { buildApp } from '../../src/app';
import { ConfigError, LISTEN_HOST, type CoreServerConfig } from '../../src/config';
import { DevelopmentDiscoveryError } from '../../src/capture/fence';
import { loadConfig } from '../../src/plugins/config';
import { removeDriverEnvironment } from '../../src/plugins/db';
import { DEFAULT_ERROR_LOG_FILE, createErrorLog, describeError } from '../../src/plugins/logger';
import { BootError } from '../../src/plugins/readiness';
import { LANE_CAMERA_STUB_CHECK, prepareLaneCameraStub } from './lane-camera-stub';
import { LANE_SEAL_RIG_CHECK, LaneSealRigError, prepareLaneSealRig } from './lane-seal-rig';
import { LANE_SOURCE_RIG_CHECK, LaneSourceRigError, prepareLaneSourceRig } from './lane-source-rig';

const SHUTDOWN_TIMEOUT_MS = 10_000;
const USAGE = 'usage: lane-camera-stub-cli.ts [--fixture-file <path>] [--mode-file <path>] [--seal-rig-file <path>] [--source-rig-file <path>]';

const errorLog = createErrorLog(DEFAULT_ERROR_LOG_FILE);

/** A failure before the logger exists: one JSON line on standard error and one entry in the error log. */
function refuseToStart(source: string, code: string, message: string, error: unknown): never {
  const description = describeError(error);
  process.stderr.write(`${JSON.stringify({ level: 'fatal', time: new Date().toISOString(), source, code, message, errorName: description.errorName })}\n`);
  errorLog.append({ level: 'fatal', source, message, ...description, code });
  process.exit(1);
}

interface LauncherFiles {
  fixtureFile: string | null;
  modeFile: string | null;
  sealRigFile: string | null;
  sourceRigFile: string | null;
}

/** The four paths of the command line. Anything else is a usage error: the program starts nothing. */
function argumentsOf(argv: readonly string[]): LauncherFiles {
  const found: LauncherFiles = { fixtureFile: null, modeFile: null, sealRigFile: null, sourceRigFile: null };
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (value === undefined || value === '' || value.startsWith('--')) throw new Error(USAGE);
    if (name === '--fixture-file') found.fixtureFile = value;
    else if (name === '--mode-file') found.modeFile = value;
    else if (name === '--seal-rig-file') found.sealRigFile = value;
    else if (name === '--source-rig-file') found.sourceRigFile = value;
    else throw new Error(USAGE);
  }
  return found;
}

let files: LauncherFiles;
try {
  files = argumentsOf(process.argv.slice(2));
} catch (error) {
  refuseToStart('laneCameraStub.arguments', 'LANE_CAMERA_STUB_USAGE', USAGE, error);
}

const ignoredVariables = removeDriverEnvironment(process.env);

let config: CoreServerConfig;
try {
  config = loadConfig({ env: process.env });
} catch (error) {
  const safe = error instanceof ConfigError;
  refuseToStart('laneCameraStub.config', safe ? error.code : describeError(error).code ?? 'CONFIG', safe ? error.message : 'the server could not start', error);
}

const app = buildApp({ config, errorLogFile: DEFAULT_ERROR_LOG_FILE });
let shuttingDown = false;

/** `source` says where the server stopped; `context` holds identifiers only (a boot check ID, a refusal code). */
function fatal(source: string, error: unknown, context: Record<string, string> = {}): never {
  const message = `the server stopped: ${source}`;
  // `check` and `code` before the error: `lane.sh` reads them from this line, in that order.
  app.log.fatal({ ...context, err: error }, message);
  errorLog.append({ level: 'fatal', source: `laneCameraStub.${source}`, message, ...describeError(error), context });
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
    errorLog.append({ level: 'error', source: 'laneCameraStub.shutdown', message: 'shutdown timeout' });
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  timer.unref();

  try {
    if (app.seams.has('capture')) await app.capture.shutdown();
    // `onClose` stops the stub and removes the fixture file.
    await app.close();
    app.log.info('shutdown complete');
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
  // THE FENCE, FIRST: a production configuration stops here, before the stub binds and before the app is ready.
  // The seal rig asks the same fence, before anything is started or bound (fix wave K).
  const sealRig = prepareLaneSealRig(app, files.sealRigFile);
  // The source rig asks the same fence, here, for the same reason (fix wave M).
  const sourceRig = prepareLaneSourceRig(app, files.sourceRigFile);
  const cameraStub = await prepareLaneCameraStub(app, files);
  await app.ready();
  cameraStub.announce();
  // Before the boot: the sealing host takes settings before its first seal only.
  sealRig.install();
  // The fence is mounted now; its generated sources ask the switch at every read and every open.
  sourceRig.install();
  if (ignoredVariables.length > 0) {
    app.log.warn({ names: ignoredVariables }, 'ignored driver variables of the environment');
  }
  app.log.info({ port: config.port, database: config.database.database, demoControls: config.demoControls, cameraStub: cameraStub.admission.admitted }, 'configuration loaded');
  await app.readiness.boot();
  await app.capture.boot();
  await app.listen({ host: LISTEN_HOST, port: config.port });
} catch (error) {
  if (error instanceof DevelopmentDiscoveryError) fatal('boot', error, { check: LANE_CAMERA_STUB_CHECK, code: error.code });
  if (error instanceof LaneSealRigError) fatal('boot', error, { check: LANE_SEAL_RIG_CHECK, code: error.code });
  if (error instanceof LaneSourceRigError) fatal('boot', error, { check: LANE_SOURCE_RIG_CHECK, code: error.code });
  if (error instanceof BootError) fatal('boot', error.cause, { check: error.stepId });
  fatal('start', error);
}
