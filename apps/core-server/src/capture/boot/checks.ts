/**
 * THE CS-22 BOOT CHECKS OF REAL CAPTURE (blueprint row 61 / M3-W5; register CS-22, CS-09; specs
 * R-2 AC-3; capture spec §A.1.2, §A.2, §H; decisions D72(a), D72(l), D83 (O-2), D85; pair-58
 * findings A-3, A-12, F-10, R-5; check `M3-BC-1`).
 *
 * This file is PURE: facts in, a refusal (or none) out. It reads no file, starts no process and
 * reads no flag. The capture operation is handed in as the decision of THE ONE FUNCTION
 * (`captureOperationDecisionOf`, `../fence/operation.ts`): nothing here compares the capture mode
 * or the demo flag itself.
 *
 *   SIMULATED         INERT. Nothing is inspected, nothing is started, every stored adapter kind
 *                     stays inert (D83 O-2). Two things are SAID, never refused:
 *                       - table row 5 of spec §A.1.2 (`simulated` without demo controls) is
 *                         LABELLED: the passed line carries `SIMULATED_WITHOUT_DEMO_CONTROLS`
 *                         (decision of this row; see the implementation note for why it is not
 *                         refused);
 *                       - a worker program configured in `simulated` is a WARNING (A-12): it is
 *                         never started.
 *   REAL_PRODUCTION   every check below, in this order; the first that fails stops the start:
 *   REAL_DEVELOPMENT    1. the worker program is configured                (the missing key)
 *                       2. the worker program passes the path rule         (regular file,
 *                          executable, owned by root or the server's user, not writable by group
 *                          or others, no directory on the way writable by them: the SAME rule as
 *                          the helper program of the development fence, spec §A.1.2 row 9)
 *                       3. the evidence store is a private directory of the server's user on a
 *                          volume that takes an exclusive create, a sync and a HARD LINK (the
 *                          worker reaches the final name of a camera file by `link()`, D72(b),
 *                          D85 R-5: on a volume without hard links every session would end fatal)
 *                       4. the evidence signing key loads (fails closed, SEC35-07)
 *                       5. the worker answers `HELLO` with this protocol, a plain version and NO
 *                          proof-build mark (F-10)
 *
 * A refused combination of the flags (`decision.refusal`) is the capture fence's refusal; this
 * step repeats it with the fence's own code, so that it can never run a real check - or pass - on
 * a configuration the one function refused, whatever the order of the boot steps.
 *
 * A refusal names a code, a reason code and configuration keys. It never holds a path, a value of
 * the environment or a text of the operating system.
 */
import { CAPTURE_PROTOCOL_VERSION } from '@dems/capture-protocol';
import { CaptureOperation } from '../adapters/kinds';
import { HelperProgramRefusal, helperProgramRefusal, type ProgramFacts, type ProgramInspector } from '../adapters/local';
import type { CaptureOperationDecision } from '../fence/operation';

/** ID of the boot step. It appears in the log line of a boot that stops at it. */
export const CAPTURE_BOOT_STEP = 'capture.boot';

/** Where the evidence signing key lives below the data directory (decision D-83-7: apart from the media root). */
export const SIGNING_STORE_SUBPATH = 'signer';

export const CaptureBootRefusal = {
  /** The one function refused the flags (the fence's code is the reason). */
  OPERATION_REFUSED: 'CAPTURE_OPERATION_REFUSED',
  /** `DEMS_CAPTURE_WORKER` is unset in a real operation. */
  WORKER_NOT_CONFIGURED: 'CAPTURE_WORKER_NOT_CONFIGURED',
  WORKER_PROGRAM_UNUSABLE: 'CAPTURE_WORKER_PROGRAM_UNUSABLE',
  EVIDENCE_STORE_UNUSABLE: 'CAPTURE_EVIDENCE_STORE_UNUSABLE',
  SIGNING_KEY_UNUSABLE: 'CAPTURE_SIGNING_KEY_UNUSABLE',
  WORKER_NO_HANDSHAKE: 'CAPTURE_WORKER_NO_HANDSHAKE',
  WORKER_PROTOCOL_MISMATCH: 'CAPTURE_WORKER_PROTOCOL_MISMATCH',
  WORKER_PROOF_BUILD: 'CAPTURE_WORKER_PROOF_BUILD',
  WORKER_VERSION_UNKNOWN: 'CAPTURE_WORKER_VERSION_UNKNOWN',
} as const;
export type CaptureBootRefusal = (typeof CaptureBootRefusal)[keyof typeof CaptureBootRefusal];

const TEXT: Readonly<Record<CaptureBootRefusal, string>> = Object.freeze({
  CAPTURE_OPERATION_REFUSED: 'This combination of DEMS_CAPTURE_MODE, DEMS_DEMO_CONTROLS and DEMS_CAPTURE_DEV_SOURCES is refused. See the line of the capture fence for the remedy.',
  CAPTURE_WORKER_NOT_CONFIGURED: 'DEMS_CAPTURE_MODE=real needs the capture worker program in DEMS_CAPTURE_WORKER. Build it (make -C apps/capture-worker) and set the key to the absolute path of build/capture-worker.',
  CAPTURE_WORKER_PROGRAM_UNUSABLE:
    'The program in DEMS_CAPTURE_WORKER cannot be used: it must be a regular executable file owned by root or by the user of the server, not writable by group or others, with no directory on the way to it writable by them.',
  CAPTURE_EVIDENCE_STORE_UNUSABLE:
    'The evidence store (DEMS_MEDIA_DIR, default <data directory>/media/sessions) cannot be used: it must be a directory of the user of the server, not writable by group or others, on a volume that supports exclusive create, sync and hard links.',
  CAPTURE_SIGNING_KEY_UNUSABLE: 'The evidence signing key cannot be loaded from <data directory>/signer: real capture does not start without the key that seals its packages. Provision the key once, then start again.',
  CAPTURE_WORKER_NO_HANDSHAKE: 'The program in DEMS_CAPTURE_WORKER did not answer as a capture worker: no HELLO frame within the limit.',
  CAPTURE_WORKER_PROTOCOL_MISMATCH: 'The capture worker speaks another version of the capture protocol than this server. Build the worker of this repository state (make -C apps/capture-worker).',
  CAPTURE_WORKER_PROOF_BUILD: 'The program in DEMS_CAPTURE_WORKER is a PROOF build (a negative control of the capture checks). It is never started by the Core. Set the key to build/capture-worker.',
  CAPTURE_WORKER_VERSION_UNKNOWN: 'The capture worker names a version this server does not know as a release build. Only capture-worker/<major>.<minor>.<patch> is started.',
});

/** A real start the boot checks refuse. `code` and `reason` are machine codes; the message names keys and the remedy. */
export class CaptureBootError extends Error {
  readonly code: CaptureBootRefusal;
  /** Which rule failed (a code of the path rule, of the volume probe, of the signer, of the handshake), or null. */
  readonly reason: string | null;
  constructor(code: CaptureBootRefusal, reason: string | null = null) {
    super(`${TEXT[code]}${reason === null ? '' : ` Reason: ${reason}.`}`);
    this.name = 'CaptureBootError';
    this.code = code;
    this.reason = reason;
  }
}

// ── 1 and 2: the worker program ───────────────────────────────────────────────────────────────

export const WorkerProgramProblem = { ...HelperProgramRefusal, NOT_SET: 'NOT_SET', NOT_EXECUTABLE: 'NOT_EXECUTABLE' } as const;
export type WorkerProgramProblem = (typeof WorkerProgramProblem)[keyof typeof WorkerProgramProblem];

const EXECUTE_BITS = 0o111;
const GROUP_OR_OTHER_WRITE = 0o022;

/** The worker path against the path rule (the rule of the helper program, spec §A.1.2 row 9), plus "is set" and "can be executed". */
export function workerProgramProblemOf(program: string | null, inspect: ProgramInspector): WorkerProgramProblem | null {
  if (program === null || program === '') return WorkerProgramProblem.NOT_SET;
  const facts: ProgramFacts = inspect(program);
  const refused = helperProgramRefusal(facts);
  if (refused !== null) return refused;
  return facts.file !== null && (facts.file.mode & EXECUTE_BITS) !== 0 ? null : WorkerProgramProblem.NOT_EXECUTABLE;
}

// ── 3: the evidence store and its volume ──────────────────────────────────────────────────────

/** What the probe found (`evidence-volume.ts`). Facts only: the rule is `evidenceStoreProblemOf`. */
export interface EvidenceVolumeFacts {
  readonly absolute: boolean;
  /** The directory is there (it was, or the probe created it with mode 0700). */
  readonly present: boolean;
  readonly directory: boolean;
  readonly ownerUid: number | null;
  /** The permission bits of the directory (`mode & 0o7777`). */
  readonly mode: number | null;
  /** The user the server runs as; -1 when the platform has none. */
  readonly serverUid: number;
  /** A new file was created EXCLUSIVELY in the directory and its bytes were written. */
  readonly exclusiveCreate: boolean;
  /** The same name could NOT be created a second time (the volume honours the exclusive flag). */
  readonly exclusiveRefusesSecond: boolean;
  /** The file was synced to the device. */
  readonly synced: boolean;
  /** A second name was linked to the file, and both names are one file (same inode, two links). */
  readonly hardLink: boolean;
  /** A link onto a name that exists was refused: the property the worker's final name rests on. */
  readonly linkRefusesExisting: boolean;
  /** Both probe names were removed again. */
  readonly cleaned: boolean;
  /** The real figures of the volume (CS-09), or null when the volume did not say. */
  readonly totalBytes: number | null;
  readonly freeBytes: number | null;
}

export const EvidenceStoreProblem = {
  NOT_ABSOLUTE: 'NOT_ABSOLUTE',
  NOT_CREATABLE: 'NOT_CREATABLE',
  NOT_A_DIRECTORY: 'NOT_A_DIRECTORY',
  OWNER: 'OWNER',
  WRITABLE_BY_OTHERS: 'WRITABLE_BY_OTHERS',
  NOT_WRITABLE: 'NOT_WRITABLE',
  NO_EXCLUSIVE_CREATE: 'NO_EXCLUSIVE_CREATE',
  NO_SYNC: 'NO_SYNC',
  NO_HARD_LINKS: 'NO_HARD_LINKS',
  LINK_REPLACES_EXISTING: 'LINK_REPLACES_EXISTING',
  PROBE_LEFT_BEHIND: 'PROBE_LEFT_BEHIND',
} as const;
export type EvidenceStoreProblem = (typeof EvidenceStoreProblem)[keyof typeof EvidenceStoreProblem];

/** The first reason the evidence store is refused for, or null when the worker may write camera files there. */
export function evidenceStoreProblemOf(facts: EvidenceVolumeFacts): EvidenceStoreProblem | null {
  if (!facts.absolute) return EvidenceStoreProblem.NOT_ABSOLUTE;
  if (!facts.present) return EvidenceStoreProblem.NOT_CREATABLE;
  if (!facts.directory) return EvidenceStoreProblem.NOT_A_DIRECTORY;
  // The store is the server's own: a directory of another user (root included) is one the server cannot keep private.
  if (facts.ownerUid === null || facts.serverUid < 0 || facts.ownerUid !== facts.serverUid) return EvidenceStoreProblem.OWNER;
  if (facts.mode === null || (facts.mode & GROUP_OR_OTHER_WRITE) !== 0) return EvidenceStoreProblem.WRITABLE_BY_OTHERS;
  if (!facts.exclusiveCreate) return EvidenceStoreProblem.NOT_WRITABLE;
  if (!facts.exclusiveRefusesSecond) return EvidenceStoreProblem.NO_EXCLUSIVE_CREATE;
  if (!facts.synced) return EvidenceStoreProblem.NO_SYNC;
  if (!facts.hardLink) return EvidenceStoreProblem.NO_HARD_LINKS;
  if (!facts.linkRefusesExisting) return EvidenceStoreProblem.LINK_REPLACES_EXISTING;
  if (!facts.cleaned) return EvidenceStoreProblem.PROBE_LEFT_BEHIND;
  return null;
}

// ── 5: the worker's answer ────────────────────────────────────────────────────────────────────

export const HandshakeFailure = {
  /** The process could not be started. */
  SPAWN_FAILED: 'SPAWN_FAILED',
  /** No frame within the limit. */
  TIMEOUT: 'TIMEOUT',
  /** The process ended before it said `HELLO`. */
  EXITED: 'EXITED',
  /** Its first line is no frame of the protocol. */
  VIOLATION: 'VIOLATION',
  /** Its first frame is not `HELLO`. */
  HELLO_EXPECTED: 'HELLO_EXPECTED',
} as const;
export type HandshakeFailure = (typeof HandshakeFailure)[keyof typeof HandshakeFailure];

/** What the worker said when it was started once and asked for nothing (`worker-probe.ts`). */
export type WorkerHandshake =
  | { readonly outcome: 'HELLO'; readonly protocolVersion: number; readonly workerVersion: string }
  | { readonly outcome: 'NONE'; readonly failure: HandshakeFailure };

/** The mark a proof build of the worker puts on its version (`apps/capture-worker/src/ipc.c`, the `HELLO` line). */
export const PROOF_BUILD_MARK = '-PROOF';
/** A release build names itself so, and nothing else is started (an allowlist: a proof build under another mark is refused as well). */
export const RELEASE_WORKER_VERSION = /^capture-worker\/\d{1,4}\.\d{1,4}\.\d{1,4}$/;

/** True when a worker version carries the proof-build mark, in any case and at any place. */
export function isProofWorkerVersion(workerVersion: string): boolean {
  return workerVersion.toUpperCase().includes(PROOF_BUILD_MARK);
}

/**
 * Why the Core does not start a worker that said this `HELLO`, or null. ONE rule for the boot
 * check and for the supervisor's handshake of a session (a program can be replaced after boot).
 */
export function workerVersionRefusalOf(hello: { readonly protocolVersion: number; readonly workerVersion: string }): CaptureBootRefusal | null {
  if (hello.protocolVersion !== CAPTURE_PROTOCOL_VERSION) return CaptureBootRefusal.WORKER_PROTOCOL_MISMATCH;
  if (isProofWorkerVersion(hello.workerVersion)) return CaptureBootRefusal.WORKER_PROOF_BUILD;
  if (!RELEASE_WORKER_VERSION.test(hello.workerVersion)) return CaptureBootRefusal.WORKER_VERSION_UNKNOWN;
  return null;
}

// ── the step ──────────────────────────────────────────────────────────────────────────────────

/** Log and error-log sinks: the capture unit's one logging file hands them in (static rule G-R4). */
export interface CaptureBootSinks {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
  error(fields: Record<string, unknown>, message: string): void;
  persist(entry: { readonly level: 'error' | 'warn'; readonly source: string; readonly message: string; readonly code: string; readonly context: Record<string, string | number> }): void;
}

export interface CaptureBootDeps {
  /** The decision of THE one function for this configuration. */
  readonly decision: CaptureOperationDecision;
  /** `config.captureWorkerPath`. */
  readonly workerProgram: string | null;
  readonly inspect: ProgramInspector;
  /** Probes the evidence store. Called in a real operation only. */
  probeEvidenceVolume(): EvidenceVolumeFacts;
  /** A code of the signer when the evidence signing key does not load, else null. Called in a real operation only. */
  signingKeyProblem(): string | null;
  /** Starts the worker once and reads its first frame. Called in a real operation only, after every file check passed. */
  handshake(): Promise<WorkerHandshake>;
  readonly sinks: CaptureBootSinks;
}

/** What the label of table row 5 reads (spec §A.1.2): the Core is not real capture, and the demo controls are off. */
export const SIMULATED_WITHOUT_DEMO_CONTROLS = 'SIMULATED_WITHOUT_DEMO_CONTROLS';

export interface CaptureBootOutcome {
  readonly operation: CaptureOperation;
  /** `SIMULATED_WITHOUT_DEMO_CONTROLS` for table row 5; null otherwise. */
  readonly label: typeof SIMULATED_WITHOUT_DEMO_CONTROLS | null;
  /** The version the worker named, in a real operation; null in `SIMULATED` (no worker is started). */
  readonly workerVersion: string | null;
  /** The real figures of the evidence volume (CS-09), in a real operation; null in `SIMULATED`. */
  readonly evidenceVolume: { readonly totalBytes: number | null; readonly freeBytes: number | null } | null;
}

const SOURCE = 'capture.boot';
const PASSED = 'capture boot checks passed';
const REFUSED = 'the capture boot checks refuse this start: the server does not start';
const WORKER_IGNORED = 'a capture worker program is configured and capture mode is simulated: it is never started';

/**
 * Runs the checks. Throws `CaptureBootError` after logging and persisting it: the readiness runner
 * stops the start as it does for any boot step.
 */
export async function runCaptureBootChecks(deps: CaptureBootDeps): Promise<CaptureBootOutcome> {
  const { decision, sinks } = deps;
  const { operation } = decision;
  const refuse = (code: CaptureBootRefusal, reason: string | null): never => {
    const failure = new CaptureBootError(code, reason);
    const context = { code, operation, ...(reason === null ? {} : { reason }) };
    sinks.error(context, REFUSED);
    sinks.persist({ level: 'error', source: SOURCE, message: REFUSED, code, context });
    throw failure;
  };

  if (decision.refusal !== null) return refuse(CaptureBootRefusal.OPERATION_REFUSED, decision.refusal);

  if (operation === CaptureOperation.SIMULATED) {
    // INERT: no file is inspected, no process is started, no stored kind is read (D83 O-2).
    if (deps.workerProgram !== null && deps.workerProgram !== '') {
      const context = { code: 'CAPTURE_WORKER_IGNORED_IN_SIMULATED', operation };
      sinks.warn(context, WORKER_IGNORED);
      sinks.persist({ level: 'warn', source: SOURCE, message: WORKER_IGNORED, code: context.code, context });
    }
    const label = decision.demoControls ? null : SIMULATED_WITHOUT_DEMO_CONTROLS;
    sinks.info({ code: 'CAPTURE_BOOT_CHECKS_PASSED', operation, checks: 'inert', ...(label === null ? {} : { label }) }, PASSED);
    return Object.freeze({ operation, label, workerVersion: null, evidenceVolume: null });
  }

  // 1, 2: the worker program.
  const program = workerProgramProblemOf(deps.workerProgram, deps.inspect);
  if (program === WorkerProgramProblem.NOT_SET) return refuse(CaptureBootRefusal.WORKER_NOT_CONFIGURED, null);
  if (program !== null) return refuse(CaptureBootRefusal.WORKER_PROGRAM_UNUSABLE, program);

  // 3: the evidence store, on its real volume.
  const volume = deps.probeEvidenceVolume();
  const store = evidenceStoreProblemOf(volume);
  if (store !== null) return refuse(CaptureBootRefusal.EVIDENCE_STORE_UNUSABLE, store);

  // 4: the evidence signing key.
  const signing = deps.signingKeyProblem();
  if (signing !== null) return refuse(CaptureBootRefusal.SIGNING_KEY_UNUSABLE, signing);

  // 5: the worker itself, started once. Only now: nothing is started from a path that failed a rule above.
  const hello = await deps.handshake();
  if (hello.outcome !== 'HELLO') return refuse(CaptureBootRefusal.WORKER_NO_HANDSHAKE, hello.failure);
  const version = workerVersionRefusalOf(hello);
  if (version !== null) return refuse(version, null);

  const evidenceVolume = Object.freeze({ totalBytes: volume.totalBytes, freeBytes: volume.freeBytes });
  sinks.info({ code: 'CAPTURE_BOOT_CHECKS_PASSED', operation, checks: 'real', workerVersion: hello.workerVersion, volumeTotalBytes: volume.totalBytes ?? -1, volumeFreeBytes: volume.freeBytes ?? -1 }, PASSED);
  return Object.freeze({ operation, label: null, workerVersion: hello.workerVersion, evidenceVolume });
}
