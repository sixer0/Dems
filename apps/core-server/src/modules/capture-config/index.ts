/**
 * Capture-config module (blueprint row 52 / M2-W10; register NM-09, CS-23, CS-06 read half,
 * SH-04, E-04; C3 §2.4, §3, §6; specs §E.6).
 *
 * WHAT THIS MODULE OWNS.
 *   - the STORE of the two capture slices (`store.ts`): the selector (`capture_config`, T-31) and
 *     the capture-device registry (`capture_devices`, T-32) read into slices 29 and 30 in their
 *     wire form (`slices.ts`); their own slice kind, never the paired-client registry (E-04);
 *   - the BOOT of that store (`boot.ts`, step `capture.config`): the slices exist before the
 *     listener opens; an invalid row set stops the start, an unseeded selector table loads the
 *     built-in baseline and says so loudly (NM-09 "store/slices boot");
 *   - the READING of the two capture modes (`fencing.ts`): Simulated versus real capture, what
 *     each refuses, and the two machine codes of the demo fence (`403 DEMO_DISABLED` for ops 71 to
 *     74, `409 RESET_BLOCKED_REAL_EVIDENCE` for op 75; OD-18, OD-19). The refusals themselves are
 *     enforced where they already live: stage 6 for the flag, row 54's guard for the reset.
 *
 * WHAT THIS MODULE DOES NOT DO YET. It registers no route: operations 76 to 80 and 89 answer from
 * this store when their live paths land (row 66 / M4-W2), and supervisor telemetry updates it when
 * the engine has the INTERNAL actions for it (SH-18). It is REGISTERED by `app.ts` since blueprint
 * row 57 (the OD-14 waiver of P25; capture spec §I edits 1 and 5): its boot step runs at every
 * start of the server, after the steps of the units registered before it.
 *
 * The plugin function opens no database connection: `buildApp()` works without PostgreSQL.
 */
import type { FastifyPluginAsync } from 'fastify';
import { CAPTURE_CONFIG_BOOT_STEP, runCaptureConfigBoot } from './boot';
import { createCaptureConfigStore, type CaptureConfigStore, type CaptureSnapshot } from './store';

export { CAPTURE_CONFIG_BOOT_STEP, runCaptureConfigBoot, type CaptureBootSinks } from './boot';
export { CaptureMode, DemoState, captureModeOf, demoFencingOf, type DemoFencing } from './fencing';
export {
  baselineCaptureConfig,
  baselineCaptureDevices,
  captureConfigSliceOf,
  captureDevicesSliceOf,
  CaptureSliceError,
  type CaptureConfigRecord,
  type CaptureDeviceRecord,
} from './slices';
export { createCaptureConfigStore, READ_CAPTURE_STATE, type CaptureConfigStore, type CaptureSnapshot, type CaptureStateRow, type CaptureStoreReader } from './store';

/** What this module offers beside its boot step: for its tests and for the rows that mount it. */
export interface CaptureConfigControl {
  /** The store this app owns. Loaded by the boot step; `snapshot()` throws before that. */
  readonly store: CaptureConfigStore;
  /** The current slices, by reference (the reads of row 66 answer from here). */
  snapshot(): CaptureSnapshot;
}

// Keyed by the app's stage registry: one object per app, the same from every scope of it
// (the `permissionGuard(app)` / `demoControl(app)` idiom).
const controls = new WeakMap<object, CaptureConfigControl>();

/** The module's controls of an app. Available after `ready()`. */
export function captureConfigControl(app: { readonly stages: object }): CaptureConfigControl {
  const control = controls.get(app.stages);
  if (control === undefined) throw new Error('the capture-config module is not loaded: register it before app.ready(), then call it after');
  return control;
}

export const captureConfigModule: FastifyPluginAsync = async (app) => {
  const store = createCaptureConfigStore();
  controls.set(app.stages, { store, snapshot: () => store.snapshot() });

  app.readiness.addBootStep({
    id: CAPTURE_CONFIG_BOOT_STEP,
    async run() {
      // A failure is logged and persisted by the runner, with its code and the identifiers it may
      // name; a pass is the readiness plugin's line "boot step passed".
      await runCaptureConfigBoot(store, app.db.pool, {
        info: (fields, message) => app.log.info(fields, message),
        warn: (fields, message) => app.log.warn(fields, message),
        error: (fields, message) => app.log.error(fields, message),
        persist: (entry) => app.errorLog.append(entry),
      });
    },
  });
};
