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
 *
 * S99-01 (batch N; ruling D241): in REAL_PRODUCTION the step also asks HOW MANY operators still have
 * the published demo password of the seed (`storedDemoPasswordOperators`): one read of the stored
 * hash sets on the pool, each verified with the product's own verifier (the password-hash wrapper of
 * the identity module - the hashes are salted, so nothing is compared as text). The read hands back
 * a COUNT: no operator ID, no hash, no salt and no password leaves that function, and its failure is
 * "could not be read" (the check then refuses the start: fail closed).
 *
 * THE HOST CHECKS (task 4 rows 80 and 81; WP-20) ARE WIRED HERE. What a production host must be, and
 * what its delivered programs must be, is asked in steps 4d and 4e of `checks.ts` when - and only
 * when - the mount is handed THE HOST FACTS (`CaptureBootMount.host`): the facts of the Core's own
 * process and the command runner. This folder reads neither (it reads no environment and starts no
 * process for a question: static rules G-R2 and SR-1): the ENTRY POINT of the server knows its own
 * process and hands the facts in, as it hands in the file of the error log. The two program paths
 * come from the configuration, the stored camera interface from the database (one read on the pool,
 * `storedCameraInterface`). A mount WITHOUT the facts runs neither step: that is every test of before
 * and every Core that is not started by the entry point. SIMULATED and REAL_DEVELOPMENT never ask,
 * whatever is handed in.
 */
import type { FastifyInstance } from 'fastify';
import type { QueryResultRow } from 'pg';
import { isDevelopmentKeySubject } from '@dems/shared/evidence-verify';
import { DEMO_OPERATOR_PASSWORD } from '@dems/shared/sim';
import { verifyPassword } from '../../modules/identity/password-hash';
import { factDoorsOf } from '../../engine';
import { inspectProgram, type ProgramInspector } from '../adapters/local';
import { captureOperationDecisionOf, type CaptureOperationDecision } from '../fence/operation';
import { createProcessLauncher } from '../ipc';
import { SignerError, loadSoftwareSigner } from '../signer';
import type { CaptureTimers, WorkerLauncher } from '../types';
import { BOOT_PROBE_LOG_NAME, captureWorkerArguments } from '../worker-arguments';
import { CAPTURE_BOOT_STEP, SIGNING_STORE_SUBPATH, runCaptureBootChecks, type CaptureBootOutcome, type CaptureBootSinks, type EvidenceVolumeFacts, type WorkerHandshake } from './checks';
import { probeEvidenceVolume } from './evidence-volume';
import type { CaptureHostDeps } from './host-checks';
import { probeWorkerHandshake } from './worker-probe';

export {
  CAPTURE_BOOT_STEP,
  CAPTURE_WORKER_VERSION,
  CaptureBootError,
  CaptureBootRefusal,
  EvidenceStoreProblem,
  HandshakeFailure,
  OPERATORS_UNREADABLE,
  PROOF_BUILD_MARK,
  RELEASE_WORKER_VERSION,
  SIGNING_STORE_SUBPATH,
  SIMULATED_WITHOUT_DEMO_CONTROLS,
  WorkerProgramProblem,
  evidenceStoreProblemOf,
  isProofWorkerVersion,
  runCaptureBootChecks,
  workerProgramProblemOf,
  workerVersionMismatchReasonOf,
  workerVersionRefusalOf,
  type CaptureBootDeps,
  type CaptureBootOutcome,
  type CaptureBootSinks,
  type EvidenceVolumeFacts,
  type WorkerHandshake,
} from './checks';
export { probeEvidenceVolume } from './evidence-volume';
export {
  CaptureHostRefusal,
  HOST_COMMAND_BOUND_MS,
  HOST_COMMAND_CHECKS,
  HostCheckReason,
  HostCheckStatus,
  hostCheckResults,
  hostCommandRunnerOver,
  type CaptureHostDeps,
  type HostCheckResult,
  type HostCommand,
  type HostCommandResult,
  type HostCommandRunner,
} from './host-checks';
export {
  CaptureProgramRefusal,
  INTERFACE_FILE_COMMAND,
  PROGRAM_OWNERSHIP_CHECKS,
  ProgramCheckReason,
  ProgramCheckStatus,
  RELAY_EXIT,
  deliveredProgramResults,
  type DeliveredProgramDeps,
  type ProgramCheckResult,
} from './program-checks';
export { BOOT_PROBE_SESSION, probeWorkerHandshake, type WorkerProbeOptions } from './worker-probe';

/**
 * THE HOST FACTS the entry point hands in (task 4 rows 80, 81): what only the Core's own process
 * knows, and the runner of the questions. The two program paths are NOT here: they are the
 * configuration's (`captureRelayPath`, `captureGuardPath`) and the mount adds them.
 */
export type CaptureBootHostFacts = Omit<CaptureHostDeps, 'relayProgram' | 'guardProgram'>;

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
  /**
   * Another counter of "operators whose stored credential verifies against the published demo password"
   * (S99-01), for tests and for an app without a database. Default: the stored hash sets, read on the
   * pool and verified one by one (`storedDemoPasswordOperators`). Asked in REAL_PRODUCTION only.
   */
  readonly demoPasswordOperators?: () => Promise<number | null>;
  readonly launcher?: WorkerLauncher;
  readonly helloTimeoutMs?: number;
  /** Where the measured figures go (CS-09). Default: the engine's fact door `applyStorageVolume`, when an engine runs behind the seam. */
  readonly applyStorageVolume?: (volume: { readonly totalBytes: number; readonly freeBytes: number }) => Promise<unknown>;
  /**
   * THE HOST FACTS (task 4 rows 80, 81): handed on to steps 4d and 4e, which ask them in REAL_PRODUCTION
   * only. ABSENT: neither step runs (see the file header). The entry point hands in the real ones; a test
   * hands in a double of a host.
   */
  readonly host?: CaptureBootHostFacts;
  /**
   * Another reader of the camera interface the stored network configuration names (step 4e, check 4), for
   * tests and for an app without a database. Default: the stored row, read on the pool
   * (`storedCameraInterface`). Asked only when `host` is handed in, in REAL_PRODUCTION, on Linux.
   */
  readonly storedCameraInterface?: () => Promise<string | null>;
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

/** Every stored hash set of an operator, by the columns the verifier needs. Read at boot of a production Core only (S99-01). */
export const SELECT_STORED_HASH_SETS = 'SELECT algorithm, memory_kib, passes, parallelism, salt, hash FROM public.operator_credentials';

interface StoredHashSetRow extends QueryResultRow {
  readonly algorithm: string;
  readonly memory_kib: number;
  readonly passes: number;
  readonly parallelism: number;
  readonly salt: Buffer;
  readonly hash: Buffer;
}

/**
 * S99-01: how many operators of this database still have the published demo password - each stored
 * hash set is verified with the product's verifier, one after another (a derivation is memory-hard;
 * a boot is no place to run a dozen at once). Null when the operators cannot be read or a stored set
 * cannot be verified: the caller refuses the start. Nothing but the count is returned.
 */
export async function storedDemoPasswordOperators(
  app: Pick<FastifyInstance, 'db'>,
  verify: (candidate: string, record: Parameters<typeof verifyPassword>[1]) => Promise<boolean> = verifyPassword,
): Promise<number | null> {
  try {
    const rows = await app.db.read('capture.boot.operators', async (pool) => (await pool.query<StoredHashSetRow>(SELECT_STORED_HASH_SETS)).rows);
    let count = 0;
    for (const row of rows) {
      if (await verify(DEMO_OPERATOR_PASSWORD, { algorithm: row.algorithm, memoryKib: row.memory_kib, passes: row.passes, parallelism: row.parallelism, salt: row.salt, hash: row.hash })) count += 1;
    }
    return count;
  } catch {
    // The error of a read or of a derivation is not passed on: it could name a row. The refusal says OPERATORS_UNREADABLE.
    return null;
  }
}

/** The camera interface of the stored network configuration: the ONE row of the table, one column. Read at boot of a production Core only (row 81). */
export const SELECT_STORED_CAMERA_INTERFACE = 'SELECT interface_name FROM public.capture_network_config';

interface StoredInterfaceRow extends QueryResultRow {
  readonly interface_name: string | null;
}

/**
 * Check 4 of step 4e: the interface the stored network configuration names, or null when the table has
 * no row or the row names none (nothing was configured: there is nothing for the interface file to agree
 * with). A read that fails REJECTS - the check then refuses the start (fail closed) - and so does a table
 * with more than one row, which its own constraint forbids.
 */
export async function storedCameraInterface(app: Pick<FastifyInstance, 'db'>): Promise<string | null> {
  const rows = await app.db.read('capture.boot.camera-interface', async (pool) => (await pool.query<StoredInterfaceRow>(SELECT_STORED_CAMERA_INTERFACE)).rows);
  if (rows.length > 1) throw new Error('the stored network configuration is not one row');
  return rows[0]?.interface_name ?? null;
}

/** Mounts the boot checks on the app: the control and the boot step. Called once, by the capture unit, after the fence. */
export function mountCaptureBootChecks(app: FastifyInstance, mount: CaptureBootMount): CaptureBootControl {
  const decision = captureOperationDecisionOf(app.config);
  let outcome: CaptureBootOutcome | null = null;
  const control: CaptureBootControl = { decision, outcome: () => outcome };
  controls.set(app.stages, control);

  const { captureWorkerPath, mediaStoreDir, dataDir, captureRelayPath, captureGuardPath } = app.config;
  // Steps 4d and 4e (rows 80, 81): the facts the mount was handed, with the two program paths of the configuration.
  // Nothing is built when no fact was handed in: `checks.ts` then runs neither step.
  const facts = mount.host;
  const hostChecks =
    facts === undefined
      ? {}
      : {
          host: { ...facts, coreFileLimit: () => facts.coreFileLimit(), relayProgram: captureRelayPath, guardProgram: captureGuardPath },
          programs: {
            platform: facts.platform,
            relayProgram: captureRelayPath,
            run: facts.run,
            storedInterface: () => (mount.storedCameraInterface ?? (() => storedCameraInterface(app)))(),
          },
        };
  const handshake = (): Promise<WorkerHandshake> => {
    // Reached only after the path rule passed, so the program is set. THE SAME ARGUMENTS AS A SESSION START (gate 64 C7):
    // a worker that does not accept one of them ends with its usage text HERE and the start is refused, not the first session.
    const launcher = mount.launcher ?? createProcessLauncher({ command: captureWorkerPath ?? '', args: captureWorkerArguments(`${dataDir}/${BOOT_PROBE_LOG_NAME}`) });
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
        demoPasswordOperators: () => (mount.demoPasswordOperators ?? (() => storedDemoPasswordOperators(app)))(),
        handshake,
        ...hostChecks,
        sinks: mount.sinks,
      });
      await publishEvidenceVolume(app, outcome, mount);
    },
  });
  return control;
}
