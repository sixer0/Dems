/**
 * The boot of the capture-config module (blueprint row 52 / M2-W10; register NM-09 "store/slices
 * boot"; specs C-N9 pattern).
 *
 * WHAT THE BOOT STEP DOES. It loads the store once, from the two KEPT tables, before the process
 * serves: slices 29 and 30 exist the moment the listener opens, so operations 76/77 (row 66) and
 * every client reading the replicated snapshot never see them missing. It runs as every other boot
 * step: added by the module's plugin, executed by `app.readiness.boot()`, a failure stops the
 * start with the step's id in the log line.
 *
 * FAIL CLOSED, WITH ONE NAMED EXCEPTION. A row set that cannot form a valid slice stops the boot
 * (the same rule the engine's rehydration holds for a stored state): serving a selector nobody
 * could validate would let a session record against a configuration no one signed. The one
 * exception is the EMPTY selector table: the production seed does not yet write the built-in
 * `capture_config` row (row 49 §6 routes that wiring here, but this row's file set closes
 * `src/db/seed/**`; the KEPT-upsert carry is row 54's). An empty table therefore loads the
 * built-in baseline (the five devices and the idle selector of `dbc-3 §E.3`, identical to the
 * simulator's defaults), says so in a warn line AND in the persistent error log, and marks the
 * snapshot `builtInBaseline` so the M2 gate can see the seed wiring is still open. Writes (ops
 * 78 to 80, 89) are refused by the missing row itself until the seed lands - the runtime role has
 * no INSERT on the table (dbc-3 §D), so the baseline can never be silently edited into existence.
 */
import { CaptureSliceError } from './slices';
import type { CaptureConfigStore, CaptureStoreReader } from './store';
import type { ErrorLogEntry } from '../../plugins/logger';

/** ID of the boot step this module adds. It appears in the log line of a boot that stops at it. */
export const CAPTURE_CONFIG_BOOT_STEP = 'capture.config';

/** Log/error-log sinks, so the runner needs no Fastify instance (the test drives it directly). */
export interface CaptureBootSinks {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
  error(fields: Record<string, unknown>, message: string): void;
  /** The persistent error log (`app.errorLog`); every refusal and the baseline notice land there too. */
  persist(entry: Pick<ErrorLogEntry, 'level' | 'source' | 'message' | 'code' | 'context'>): void;
}

const SOURCE = 'captureConfig.boot';
const LOADED = 'capture-config store loaded';
const BASELINE = 'the capture_config table holds no row; the built-in selector baseline loaded';
const REFUSED = 'the capture configuration cannot form a valid slice: the server does not start';

/**
 * Load the store and report what the load decided. Throws the `CaptureSliceError` after logging
 * and persisting it, so the readiness plugin stops the start exactly as it does for any boot step.
 */
export async function runCaptureConfigBoot(store: CaptureConfigStore, reader: CaptureStoreReader, sinks: CaptureBootSinks): Promise<void> {
  try {
    const snapshot = await store.load(reader);
    const fields = {
      code: snapshot.builtInBaseline ? 'CAPTURE_CONFIG_BASELINE' : 'CAPTURE_CONFIG_LOADED',
      devices: snapshot.captureDevices.devices.length,
      revision: snapshot.revision,
      locked: snapshot.locked,
    };
    if (snapshot.builtInBaseline) {
      // Named in the log AND in the persistent error log: the seed wiring is an open item, not a
      // state to serve quietly. (Row 49 §6 routed the production seed insert here; this row's
      // file set closes src/db/seed - the controller owns the reassignment.)
      sinks.warn(fields, BASELINE);
      sinks.persist({ level: 'warn', source: SOURCE, message: BASELINE, code: 'CAPTURE_CONFIG_BASELINE', context: fields });
      return;
    }
    sinks.info(fields, LOADED);
  } catch (cause) {
    const failure = cause instanceof CaptureSliceError ? cause : new CaptureSliceError('CAPTURE_CONFIG_LOAD_FAILED', cause instanceof Error ? cause.message : 'unknown', {});
    const context = { code: failure.code, ...failure.context };
    sinks.error({ code: failure.code, ...failure.context }, REFUSED);
    sinks.persist({ level: 'error', source: SOURCE, message: REFUSED, code: failure.code, context });
    throw failure;
  }
}
