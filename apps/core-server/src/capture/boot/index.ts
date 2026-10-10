/**
 * The boot checks of real capture, mounted (blueprint row 61 / M3-W5; register CS-22, CS-09; specs
 * R-2 AC-3; check `M3-BC-1`).
 *
 *   checks.ts           the decision, pure: what a real start needs and why it is refused
 *   evidence-volume.ts  the probe of the evidence store (the ONE file here with the file system)
 *   worker-probe.ts     the worker started once for its `HELLO`, through the process channel
 *
 * `mountCaptureBootChecks` adds ONE boot step, `capture.boot`, and a control. The capture unit
 * calls it once, after the capture fence, and hands in the log sinks: the unit's `index.ts` stays
 * the one file of the folder that logs (static rule G-R4).
 *
 * THE CAPTURE OPERATION IS ASKED, NOT READ: the decision is `captureOperationDecisionOf(app.config)`,
 * THE one function of `../fence/operation.ts`. Nothing in this folder compares the capture mode,
 * the demo flag or the development flag (static rules G-R15, G-R16).
 *
 * In `SIMULATED` the step is inert: it inspects no file and starts no process, so `buildApp()` and
 * every database-free test keep working with no worker, no media root and no signing key.
 *
 * CS-09, SECOND HALF (integration passes D6 and D10): once the checks passed in a real operation,
 * the measured figures of the evidence volume are handed to the engine's INTERNAL action
 * `applyStorageVolume` (the fact door of the engine host), so slice `storage` - and with it
 * operations 53 / 54 and every client - shows the real volume. ONE statement of the boot step,
 * after the probe. In `SIMULATED` nothing is measured and nothing is handed over: the figures stay
 * the simulator's. A hand-over that fails does not refuse the start (the checks passed; the figure
 * is a display fact): it is logged and persisted, and the figures stay as they were.
 */
import type { FastifyInstance } from 'fastify';
import { CAPTURE_IPC_DEFAULTS } from '@dems/capture-protocol';
import { isDevelopmentKeySubject } from '@dems/shared/evidence-verify';
import { factDoorsOf } from '../../engine';
import { inspectProgram, type ProgramInspector } from '../adapters/local';
import { captureOperationDecisionOf, type CaptureOperationDecision } from '../fence/operation';
import { createProcessLauncher } from '../ipc';
import { SignerError, loadSoftwareSigner } from '../signer';
import type { CaptureTimers, WorkerLauncher } from '../types';
import { CAPTURE_BOOT_STEP, SIGNING_STORE_SUBPATH, runCaptureBootChecks, type CaptureBootOutcome, type CaptureBootSinks, type EvidenceVolumeFacts, type WorkerHandshake } from './checks';
import { probeEvidenceVolume } from './evidence-volume';
import { probeWorkerHandshake } from './worker-probe';

export {
  CAPTURE_BOOT_STEP,
  CaptureBootError,
  CaptureBootRefusal,
  EvidenceStoreProblem,
  HandshakeFailure,
  PROOF_BUILD_MARK,
  RELEASE_WORKER_VERSION,
  SIGNING_STORE_SUBPATH,
  SIMULATED_WITHOUT_DEMO_CONTROLS,
  WorkerProgramProblem,
  evidenceStoreProblemOf,
  isProofWorkerVersion,
  runCaptureBootChecks,
  workerProgramProblemOf,
  workerVersionRefusalOf,
  type CaptureBootDeps,
  type CaptureBootOutcome,
  type CaptureBootSinks,
  type EvidenceVolumeFacts,
  type WorkerHandshake,
} from './checks';
export { probeEvidenceVolume } from './evidence-volume';
export { BOOT_PROBE_SESSION, probeWorkerHandshake, type WorkerProbeOptions } from './worker-probe';

/** The log of a worker the boot check started: beside the worker's own log, never the same file. */
const BOOT_PROBE_LOG_NAME = 'capture-worker-boot.jsonl';

export interface CaptureBootControl {
  /** The decision of the one function for this app's configuration. */
  readonly decision: CaptureOperationDecision;
  /** What the boot step found; null until it passed. */
  outcome(): CaptureBootOutcome | null;
}

const controls = new WeakMap<object, CaptureBootControl>();

/** The boot checks of an app. Available after the capture unit mounted them. */
export function captureBootControl(app: { readonly stages: object }): CaptureBootControl {
  const control = controls.get(app.stages);
  if (control === undefined) throw new Error('the capture boot checks are not mounted: the capture unit mounts them');
  return control;
}

export interface CaptureBootMount {
  readonly sinks: CaptureBootSinks;
  readonly timers: CaptureTimers;
  /** Test seams. Defaults: the real inspector, the real probe of the media root, the real key store, the worker program through the process channel. */
  readonly inspect?: ProgramInspector;
  readonly probeEvidenceVolume?: (directory: string) => EvidenceVolumeFacts;
  readonly signingKeyProblem?: (directory: string, now: number) => string | null;
  /** Another reader of "the stored signing key is a development key", for tests. Default: the certificate of the store. */
  readonly signingKeyIsDevelopment?: (directory: string, now: number) => boolean;
  readonly launcher?: WorkerLauncher;
  readonly helloTimeoutMs?: number;
  /** Where the measured figures go (CS-09). Default: the engine's fact door `applyStorageVolume`, when an engine runs behind the seam. */
  readonly applyStorageVolume?: (volume: { readonly totalBytes: number; readonly freeBytes: number }) => Promise<unknown>;
}

/** The code of a hand-over of the volume figures that failed (error log, never a refusal of the start). */
export const STORAGE_VOLUME_NOT_APPLIED = 'CAPTURE_BOOT_STORAGE_VOLUME_NOT_APPLIED';

/**
 * CS-09, second half: the figures the probe measured become the figures of slice `storage`.
 * Nothing in `SIMULATED` (no figure was measured) and nothing when the probe could not read both
 * figures. Never throws: see the file header.
 */
async function publishEvidenceVolume(app: FastifyInstance, outcome: CaptureBootOutcome, mount: CaptureBootMount): Promise<void> {
  const volume = outcome.evidenceVolume;
  if (volume === null || volume.totalBytes === null || volume.freeBytes === null) return;
  const figures = { totalBytes: volume.totalBytes, freeBytes: volume.freeBytes };
  try {
    if (mount.applyStorageVolume !== undefined) await mount.applyStorageVolume(figures);
    // No engine behind the seam (a test app of this folder), or one that is not running yet: nothing to hand to.
    else if (app.seams?.has('engine') === true && app.engine.running) await factDoorsOf(app.engine).applyStorageVolume(figures);
    else return;
    mount.sinks.info({ step: CAPTURE_BOOT_STEP, operation: outcome.operation, totalBytes: figures.totalBytes, freeBytes: figures.freeBytes }, 'the measured evidence volume was handed to the engine');
  } catch (error) {
    const code = error instanceof Error && typeof (error as { code?: unknown }).code === 'string' ? ((error as unknown as { code: string }).code) : STORAGE_VOLUME_NOT_APPLIED;
    mount.sinks.error({ step: CAPTURE_BOOT_STEP, code }, 'the measured evidence volume was not handed to the engine: the storage figures stay as they were');
    mount.sinks.persist({ level: 'error', source: 'capture.boot', message: 'the measured evidence volume was not handed to the engine', code: STORAGE_VOLUME_NOT_APPLIED, context: { step: CAPTURE_BOOT_STEP, cause: code } });
  }
}

/** The evidence signing key of the store, loaded and dropped: a code of the signer when it does not load. */
function storedSigningKeyProblem(directory: string, now: number): string | null {
  try {
    loadSoftwareSigner({ dir: directory, now });
    return null;
  } catch (error) {
    // The signer's errors hold a code and a key ID; anything else is reduced to a fixed word.
    return error instanceof SignerError ? error.code : 'UNREADABLE';
  }
}

/**
 * True when the certificate of the stored signing key carries the development-key mark (the unit
 * `provisionDevelopmentSigningKey` writes; the verifier reads the same mark from the certificate).
 * A key that does not load is not "development": check 4 has refused it before this is asked.
 */
function storedSigningKeyIsDevelopment(directory: string, now: number): boolean {
  try {
    return isDevelopmentKeySubject(loadSoftwareSigner({ dir: directory, now }).certificate.subject);
  } catch {
    return false;
  }
}

/** Mounts the boot checks on the app: the control and the boot step. Called once, by the capture unit, after the fence. */
export function mountCaptureBootChecks(app: FastifyInstance, mount: CaptureBootMount): CaptureBootControl {
  const decision = captureOperationDecisionOf(app.config);
  let outcome: CaptureBootOutcome | null = null;
  const control: CaptureBootControl = { decision, outcome: () => outcome };
  controls.set(app.stages, control);

  const { captureWorkerPath, mediaStoreDir, dataDir } = app.config;
  const handshake = (): Promise<WorkerHandshake> => {
    // Reached only after the path rule passed, so the program is set.
    const launcher =
      mount.launcher ??
      createProcessLauncher({ command: captureWorkerPath ?? '', args: ['--log', `${dataDir}/${BOOT_PROBE_LOG_NAME}`, '--heartbeat-ms', String(CAPTURE_IPC_DEFAULTS.heartbeatIntervalMs)] });
    return probeWorkerHandshake({ launcher, timers: mount.timers, ...(mount.helloTimeoutMs === undefined ? {} : { helloTimeoutMs: mount.helloTimeoutMs }) });
  };

  app.readiness.addBootStep({
    id: CAPTURE_BOOT_STEP,
    async run() {
      outcome = await runCaptureBootChecks({
        decision,
        workerProgram: captureWorkerPath,
        inspect: mount.inspect ?? inspectProgram,
        probeEvidenceVolume: () => (mount.probeEvidenceVolume ?? probeEvidenceVolume)(mediaStoreDir),
        signingKeyProblem: () => (mount.signingKeyProblem ?? storedSigningKeyProblem)(`${dataDir}/${SIGNING_STORE_SUBPATH}`, app.clock.now()),
        signingKeyIsDevelopment: () => (mount.signingKeyIsDevelopment ?? storedSigningKeyIsDevelopment)(`${dataDir}/${SIGNING_STORE_SUBPATH}`, app.clock.now()),
        handshake,
        sinks: mount.sinks,
      });
      await publishEvidenceVolume(app, outcome, mount);
    },
  });
  return control;
}
