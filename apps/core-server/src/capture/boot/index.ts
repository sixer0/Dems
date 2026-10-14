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
 * `storedCameraInterface`). SIMULATED and REAL_DEVELOPMENT never ask, whatever is handed in.
 *
 * FAIL-CLOSED (task 4 row 85; decision C46; code review finding F-07). Until row 85 a mount WITHOUT
 * the facts ran neither step, so a composition that forgot them started a production Core unchecked.
 * Now BOTH STEPS ALWAYS RUN in REAL_PRODUCTION. The facts come through ONE door of the control,
 * `provideHost`, which the entry point calls between `app.ready()` and the boot steps (`host-facts.ts`
 * makes them of the process's own facts); a test hands in an explicit test host through the same door
 * or through the seam `host`. A Core that was handed NO facts is a host that cannot be seen
 * (`HOST_NOT_SEEN`): its first question has no answer, and step 4d refuses the start by its own code
 * (`CAPTURE_HOST_CORE_FILE_LIMIT`, reason `LIMIT_UNREADABLE`). There is no default that passes and none
 * that skips. The order of the checks is unchanged: 1 to 4c refuse first, as before.
 *
 * ROW HC (decision C55 DD-2) corrects the code named above: the step now TELLS the checks whether any facts were
 * handed in (`hostFactsHandedIn`), and a production Core that was handed none is refused by a code of its own,
 * `CAPTURE_HOST_FACTS_NOT_HANDED_IN` / `NO_HOST_FACTS`, before step 4d asks anything. `HOST_NOT_SEEN` stays what the
 * two steps are built from in that case, so a caller that leaves the new member out is still refused by 4d. The step
 * also hands in the configured socket path of the address helper (C53 (4c): check 4d-3 of `checks.ts`).
 */
import type { FastifyInstance } from 'fastify';
import type { QueryResultRow } from 'pg';
import { isDevelopmentKeySubject } from '@dems/shared/evidence-verify';
import { DEMO_OPERATOR_PASSWORD } from '@dems/shared/sim';
import { verifyPassword } from '../../modules/identity/password-hash';
import { factDoorsOf } from '../../engine';
import { inspectProgram, type ProgramInspector } from '../adapters/local';
// Row NB (design 06 row N13): the two system programs of the macOS microphone listing, by the literals of row N4's table.
import { MACOS_SYSTEM_AUDIO_PROGRAM, MACOS_USB_TREE_PROGRAM } from '../adapters/local/mic-helper-args';
import { captureOperationDecisionOf, type CaptureOperationDecision } from '../fence/operation';
import { createProcessLauncher } from '../ipc';
import { SignerError, certificateDer, loadSoftwareSigner } from '../signer';
import type { CaptureTimers, WorkerLauncher } from '../types';
import { BOOT_PROBE_LOG_NAME, captureWorkerArguments } from '../worker-arguments';
import { CAPTURE_BOOT_STEP, SIGNING_STORE_SUBPATH, runCaptureBootChecks, type CaptureBootDeps, type CaptureBootOutcome, type CaptureBootSinks, type EvidenceVolumeFacts, type WorkerHandshake } from './checks';
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
  PLATFORM_NOT_LINUX_OR_DARWIN,
  PRODUCTION_PLATFORMS,
  PROOF_BUILD_MARK,
  RELEASE_WORKER_VERSION,
  SIGNING_STORE_SUBPATH,
  SIMULATED_WITHOUT_DEMO_CONTROLS,
  WorkerProgramProblem,
  evidenceStoreProblemOf,
  hostProfileStatementOf,
  isProductionPlatform,
  isProofWorkerVersion,
  runCaptureBootChecks,
  workerProgramProblemOf,
  workerVersionMismatchReasonOf,
  workerVersionRefusalOf,
  type CaptureBootDeps,
  type CaptureBootOutcome,
  type CaptureBootSinks,
  type EvidenceVolumeFacts,
  type HostProfileStatement,
  type ProductionPlatform,
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
// Row HC (decisions C55 DD-2, C53 (4c), C94 (j), C49 (2)): the two fixed reasons, the code of the one line "the helper is absent",
// the installed socket path (the fence states whether it is there) and the finding type the two check files share.
export { ALIAS_HELPER_ABSENT, CONFIGURED_PATH_NOT_THE_INSTALLED_ONE, NO_HOST_FACTS } from './checks';
export { ALIAS_SOCKET_INSTALLED_PATH, type AliasSocketFinding } from './host-checks';
export { BOOT_PROBE_SESSION, probeWorkerHandshake, type WorkerProbeOptions } from './worker-probe';
export { captureHostOfProcess, captureHostRunnerOf, coreFileLimitOf, type OwnProcessFacts } from './host-facts';

/**
 * THE HOST FACTS the entry point hands in (task 4 rows 80, 81): what only the Core's own process
 * knows, and the runner of the questions. The two program paths are NOT here: they are the
 * configuration's (`captureRelayPath`, `captureGuardPath`) and the mount adds them.
 */
export type CaptureBootHostFacts = Omit<CaptureHostDeps, 'relayProgram' | 'guardProgram'>;

/**
 * A HOST THAT CANNOT BE SEEN (row 85, C46): what the boot step asks when no facts were handed in.
 * Nothing of it is "in place": the core-file limit cannot be read, the runtime's option variable
 * counts as set, and no question to the host is started. In REAL_PRODUCTION the first host check
 * therefore refuses the start; the two other operations never ask.
 */
export const HOST_NOT_SEEN: CaptureBootHostFacts = Object.freeze({
  platform: 'not-stated',
  coreFileLimit: (): number | null => null,
  startArguments: Object.freeze([]),
  nodeOptionsSet: true,
  run: async () => ({ outcome: 'NOT_STARTED' as const }),
});

/** `code` of a second hand-over of the host facts, or of one that comes after the boot step asked them. */
export const HOST_FACTS_NOT_TAKEN = 'CAPTURE_BOOT_HOST_FACTS_NOT_TAKEN';

export class CaptureHostFactsError extends Error {
  readonly code = HOST_FACTS_NOT_TAKEN;
  readonly reason: 'ALREADY_PROVIDED' | 'ALREADY_ASKED';
  constructor(reason: 'ALREADY_PROVIDED' | 'ALREADY_ASKED') {
    super('the host facts of the capture boot checks are handed in once, before the boot steps run');
    this.name = 'CaptureHostFactsError';
    this.reason = reason;
  }
}

export interface CaptureBootControl {
  /** The decision of the one function for this app's configuration. */
  readonly decision: CaptureOperationDecision;
  /** What the boot step found; null until it passed. */
  outcome(): CaptureBootOutcome | null;
  /**
   * THE DOOR OF THE HOST FACTS (row 85, C46): called ONCE, by the entry point, after the app is ready
   * and before the boot steps run. A second call, a call on a mount that was given the seam `host`,
   * and a call after the boot step asked the facts are refused (`CaptureHostFactsError`): the facts a
   * production start was judged by are never replaced. Without a call the host is `HOST_NOT_SEEN`.
   */
  provideHost(facts: CaptureBootHostFacts): void;
  /**
   * THE DOOR OF THE INSTALLATION ID (row 228; check 4b-2): called ONCE, at its mount, by the unit that holds the
   * installation identity of the Core - the capture unit does not read that setting (one reader). Null: no id is
   * configured. A second call, a call on a mount that was given the seam `installationId`, and a call after the
   * boot step asked are refused (`CaptureInstallationIdError`): the id a production start was judged by is never
   * replaced. Without a call the id is not known and check 4b-2 refuses a production start.
   */
  provideInstallationId(installationId: string | null): void;
  /**
   * THE DOOR OF THE JUDGED KEY (row 226c; decision C81): the key id of the ONE certificate this boot step loaded from
   * the signer store and its checks judged (4, 4b, 4b-2), once the checks PASSED. The unit that holds the Core's
   * signer asks it before each signature and signs with no other key until the Core is started again. Null: the step
   * has not passed, or it loaded no key of the store - `SIMULATED` (nothing is inspected), or a test whose key is a seam.
   */
  judgedSigningKey(): string | null;
  /**
   * Row P1 (decision U21 (2)): THE PLATFORM WORD OF THE HOST FACTS IN FORCE - what the entry point handed in through
   * `provideHost` (or the seam `host` of a bare mount) - or null while none was handed in. A READ of a fact already
   * handed in: it adds no door and no member to the facts, it asks the host nothing, and it does not count as the boot
   * step having asked (a later `provideHost` is still taken). The capture fence states it in the boot audit entry,
   * which is written BEFORE the boot checks run; what the checks then found is `outcome().hostProfile`.
   */
  hostPlatform(): string | null;
}

/** `code` of a second hand-over of the installation id, or of one that comes after the boot step asked it. */
export const INSTALLATION_ID_NOT_TAKEN = 'CAPTURE_BOOT_INSTALLATION_ID_NOT_TAKEN';

export class CaptureInstallationIdError extends Error {
  readonly code = INSTALLATION_ID_NOT_TAKEN;
  readonly reason: 'ALREADY_PROVIDED' | 'ALREADY_ASKED';
  constructor(reason: 'ALREADY_PROVIDED' | 'ALREADY_ASKED') {
    super('the installation id of the capture boot checks is handed in once, before the boot steps run');
    this.name = 'CaptureInstallationIdError';
    this.reason = reason;
  }
}

const controls = new WeakMap<object, CaptureBootControl>();

/** The boot checks of an app. Available after the capture unit mounted them. */
export function captureBootControl(app: { readonly stages: object }): CaptureBootControl {
  const control = controls.get(app.stages);
  if (control === undefined) throw new Error('the capture boot checks are not mounted: the capture unit mounts them');
  return control;
}

/**
 * Row P1: the platform word the boot checks of `app` were handed (`CaptureBootControl.hostPlatform`), for a unit that
 * runs BEFORE them and must not fail where they are not mounted. `undefined`: no boot checks are mounted on this app
 * (a test of another unit alone) - nothing can be stated. `null`: mounted, and no host facts were handed in.
 */
export function bootHostPlatformOf(app: { readonly stages: object }): string | null | undefined {
  const control = controls.get(app.stages);
  return control === undefined ? undefined : control.hostPlatform();
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
   * Another reader of "the organisational units of the stored certificate" (check 4b-2, row 228), for a test whose
   * key is a seam and no store. Default: the certificate of the store, of the same load as the two readers above.
   */
  readonly signingKeyUnits?: (directory: string, now: number) => readonly string[] | null;
  /**
   * THE INSTALLATION ID check 4b-2 compares with (row 228), for a test of the bare mount. The product hands it in
   * through `provideInstallationId` of the control: the unit that holds the installation identity does, at its mount.
   * ABSENT AND NOT PROVIDED: the id is not known, and a production start is refused - no default passes.
   */
  readonly installationId?: string | null;
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
   * only. A test of the bare mount hands in a double of a host here; the product hands the real ones in
   * through `provideHost` of the control (the entry point). ABSENT AND NOT PROVIDED: `HOST_NOT_SEEN`, and
   * a production start is refused (row 85, C46) - both steps run in every case.
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

/** The loader of the signer store, as the two readers below call it. */
type SigningKeyLoad = (options: { readonly dir: string; readonly now: number }) => ReturnType<typeof loadSoftwareSigner>;

/**
 * ONE LOAD FOR CHECKS 4 AND 4b (task 4 row 211; security review SX-16 second half, finding F1-8). The
 * store is loaded at the FIRST ask and that one outcome - the loaded signer, or the error the load threw -
 * is what every later ask gets: check 4 and check 4b judge the same loaded certificate, never two reads
 * of a directory that could change between them. Made per run of the boot step, so nothing outlives it.
 * The directory and the instant of the first ask are the ones of the load.
 */
function loadedOnce(load: SigningKeyLoad): SigningKeyLoad {
  let outcome: { readonly signer: ReturnType<typeof loadSoftwareSigner> } | { readonly thrown: unknown } | null = null;
  return (options) => {
    if (outcome === null) {
      try {
        outcome = { signer: load(options) };
      } catch (thrown) {
        outcome = { thrown };
      }
    }
    if ('thrown' in outcome) throw outcome.thrown;
    return outcome.signer;
  };
}

/**
 * The two readers of the stored signing key over ONE load (row 211): `problem` is check 4's question,
 * `isDevelopment` check 4b's. `load` is the store's loader; a test hands in a counting double.
 * Row 228 adds the THIRD reader over the same load: `organisationalUnits`, what check 4b-2 judges.
 */
export function storedSigningKeyReaders(load: SigningKeyLoad = loadSoftwareSigner): {
  readonly problem: (directory: string, now: number) => string | null;
  readonly isDevelopment: (directory: string, now: number) => boolean;
  readonly organisationalUnits: (directory: string, now: number) => readonly string[] | null;
  /** Row 226c: the key id of the certificate that ONE load gave the readers above; null while nothing was loaded. It asks the store nothing. */
  readonly loadedKeyId: () => string | null;
} {
  let loadedKeyId: string | null = null;
  const once = loadedOnce((options) => {
    const loaded = load(options);
    loadedKeyId = loaded.certificate.keyId;
    return loaded;
  });
  return {
    problem: (directory, now) => storedSigningKeyProblem(directory, now, once),
    isDevelopment: (directory, now) => storedSigningKeyIsDevelopment(directory, now, once),
    organisationalUnits: (directory, now) => storedSigningKeyUnits(directory, now, once),
    loadedKeyId: () => loadedKeyId,
  };
}

// ── check 4b-2 (task 4 row 228; X1-5, SX-10, UD-4): the active certificate names this installation ──────────────

/** The unit of a production certificate is this text, one space and the installation device id (the command of row 206 writes it). */
export const SIGNING_KEY_UNIT_PREFIX = 'Evidence signing';

/**
 * The fixed words check 4b-2 refuses with. None holds a value: neither the configured id nor a text of the
 * certificate reaches a log or the error log through this check.
 */
export const InstallationBindingProblem = {
  /** No installation id was handed to the boot checks, or none is configured: there is nothing a certificate could equal. */
  INSTALLATION_ID_NOT_KNOWN: 'INSTALLATION_ID_NOT_KNOWN',
  /** The id handed in is not of the form of an installation device id (ASCII; row 206): it is never compared. */
  INSTALLATION_ID_FORM: 'INSTALLATION_ID_FORM',
  /** The subject of the certificate could not be read attribute by attribute, or a unit is not plain ASCII text. */
  SUBJECT_UNREADABLE: 'SUBJECT_UNREADABLE',
  NO_ORGANISATIONAL_UNIT: 'NO_ORGANISATIONAL_UNIT',
  SEVERAL_ORGANISATIONAL_UNITS: 'SEVERAL_ORGANISATIONAL_UNITS',
  /** One unit, and it is not `Evidence signing <configured installation id>` as a whole. */
  OTHER_INSTALLATION: 'OTHER_INSTALLATION',
} as const;
export type InstallationBindingProblem = (typeof InstallationBindingProblem)[keyof typeof InstallationBindingProblem];

/** The form of an installation device id: the rule of the configuration and of the key command (a test holds the three together). */
const INSTALLATION_ID_FORM = /^[A-Z][A-Z0-9-]{0,31}$/;

/**
 * THE RULE OF CHECK 4b-2, pure. `units` are the values of every organisational-unit ATTRIBUTE of the
 * certificate's subject, as parsed from its bytes (`organisationalUnitsOf`) - never a part of the subject
 * text, so a comma, an equals sign or a second attribute typed into another field cannot make a match.
 * Exactly one unit, equal as a whole to the prefix, one space and the configured id.
 */
export function signingKeyInstallationProblemOf(units: readonly string[] | null, installationId: string | null | undefined): InstallationBindingProblem | null {
  if (typeof installationId !== 'string' || installationId === '') return InstallationBindingProblem.INSTALLATION_ID_NOT_KNOWN;
  if (!INSTALLATION_ID_FORM.test(installationId)) return InstallationBindingProblem.INSTALLATION_ID_FORM;
  if (units === null) return InstallationBindingProblem.SUBJECT_UNREADABLE;
  if (units.length === 0) return InstallationBindingProblem.NO_ORGANISATIONAL_UNIT;
  if (units.length > 1) return InstallationBindingProblem.SEVERAL_ORGANISATIONAL_UNITS;
  return units[0] === `${SIGNING_KEY_UNIT_PREFIX} ${installationId}` ? null : InstallationBindingProblem.OTHER_INSTALLATION;
}

interface DerItem {
  readonly tag: number;
  readonly start: number;
  readonly end: number;
}

/** The items that fill `bytes[from, to)` exactly, or null: definite lengths of at most four bytes, single-byte tags, no overrun. */
function derItems(bytes: Uint8Array, from: number, to: number): DerItem[] | null {
  const items: DerItem[] = [];
  let at = from;
  while (at < to) {
    const tag = bytes[at];
    const first = bytes[at + 1];
    if (tag === undefined || first === undefined || (tag & 0x1f) === 0x1f) return null;
    let size = first;
    let start = at + 2;
    if (first >= 0x80) {
      const count = first & 0x7f;
      if (count === 0 || count > 4 || start + count > to) return null;
      size = 0;
      for (let index = 0; index < count; index += 1) size = size * 256 + (bytes[start + index] ?? 0);
      start += count;
    }
    if (start + size > to) return null;
    items.push({ tag, start, end: start + size });
    at = start + size;
  }
  return items;
}

const SEQUENCE = 0x30;
const SET = 0x31;
const INTEGER = 0x02;
const OBJECT_IDENTIFIER = 0x06;
const UTF8_STRING = 0x0c;
const PRINTABLE_STRING = 0x13;
/** 2.5.4.11, organizationalUnitName. */
const ORGANISATIONAL_UNIT_OID = [0x55, 0x04, 0x0b] as const;

/**
 * The values of the organisational-unit attributes of a certificate's SUBJECT, read from the certificate's
 * own bytes (the PEM text of the loaded certificate), in their order; null when the bytes are not a
 * certificate this reader follows to its subject, or when a unit is not a UTF-8 or printable string of
 * plain visible ASCII (the command of row 206 writes nothing else). Pure: no file, no cryptography - the
 * loader has already checked the certificate's own signature.
 */
export function organisationalUnitsOf(pemText: string): readonly string[] | null {
  const der = certificateDer(pemText);
  if (der === null) return null;
  const inside = (item: DerItem | undefined, tag: number): DerItem[] | null => (item === undefined || item.tag !== tag ? null : derItems(der, item.start, item.end));
  const certificate = inside(derItems(der, 0, der.length)?.[0], SEQUENCE);
  if (certificate === null || certificate.length !== 3) return null;
  const signed = inside(certificate[0], SEQUENCE);
  if (signed === null) return null;
  // version [0] (optional), serial, algorithm, issuer, validity, SUBJECT.
  const fields = signed[0]?.tag === 0xa0 ? signed.slice(1) : signed;
  if (fields[0]?.tag !== INTEGER) return null;
  const names = inside(fields[4], SEQUENCE);
  if (names === null) return null;
  const units: string[] = [];
  for (const name of names) {
    const attributes = inside(name, SET);
    if (attributes === null || attributes.length === 0) return null;
    for (const attribute of attributes) {
      const pair = inside(attribute, SEQUENCE);
      const type = pair?.[0];
      const value = pair?.[1];
      if (pair === null || pair.length !== 2 || type === undefined || value === undefined || type.tag !== OBJECT_IDENTIFIER) return null;
      if (type.end - type.start !== ORGANISATIONAL_UNIT_OID.length || ORGANISATIONAL_UNIT_OID.some((byte, index) => der[type.start + index] !== byte)) continue;
      if (value.tag !== UTF8_STRING && value.tag !== PRINTABLE_STRING) return null;
      const text = der.subarray(value.start, value.end);
      if (text.some((byte) => byte < 0x20 || byte > 0x7e)) return null;
      units.push(text.toString('latin1'));
    }
  }
  return Object.freeze(units);
}

/**
 * The organisational units of the stored signing key's certificate - of the SAME load checks 4 and 4b
 * judged (`load` is the once-loader of the run). Null when the key does not load (check 4 refused it
 * before this is asked) or its subject cannot be read: check 4b-2 then refuses (fail closed).
 */
function storedSigningKeyUnits(directory: string, now: number, load: SigningKeyLoad = loadSoftwareSigner): readonly string[] | null {
  try {
    return organisationalUnitsOf(load({ dir: directory, now }).certificate.pemText);
  } catch {
    return null;
  }
}

/**
 * Checks 4 and 4b of ONE run of the boot step: the seam of a test where the mount has one, else the
 * readers over one load. Called once per run, so the one load never outlives the run it was made for.
 */
function signingKeyQuestionsOf(
  mount: CaptureBootMount,
  directory: string,
  now: () => number,
  installationId: () => string | null,
  loadedKeyReader: (reader: () => string | null) => void,
): Pick<CaptureBootDeps, 'signingKeyProblem' | 'signingKeyIsDevelopment'> & Required<Pick<CaptureBootDeps, 'signingKeyInstallationProblem'>> {
  const stored = storedSigningKeyReaders();
  // Row 226c: the key id of the one certificate these questions are answered from (null where a test's seam answers instead).
  loadedKeyReader(stored.loadedKeyId);
  return {
    signingKeyProblem: () => (mount.signingKeyProblem ?? stored.problem)(directory, now()),
    signingKeyIsDevelopment: () => (mount.signingKeyIsDevelopment ?? stored.isDevelopment)(directory, now()),
    // Check 4b-2 (row 228): ALWAYS handed in. The units are those of the certificate the two readers above loaded.
    signingKeyInstallationProblem: () => signingKeyInstallationProblemOf((mount.signingKeyUnits ?? stored.organisationalUnits)(directory, now()), installationId()),
  };
}

/** The evidence signing key of the store, loaded and dropped: a code of the signer when it does not load. */
function storedSigningKeyProblem(directory: string, now: number, load: SigningKeyLoad = loadSoftwareSigner): string | null {
  try {
    load({ dir: directory, now });
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
function storedSigningKeyIsDevelopment(directory: string, now: number, load: SigningKeyLoad = loadSoftwareSigner): boolean {
  try {
    return isDevelopmentKeySubject(load({ dir: directory, now }).certificate.subject);
  } catch {
    return false;
  }
}

/** Every stored hash set of an operator, by the columns the verifier needs. Read at boot of a production Core only (S99-01). */
export const SELECT_STORED_HASH_SETS = 'SELECT algorithm, memory_kib, passes, parallelism, salt, hash FROM public.operator_credentials';

export interface StoredHashSetRow extends QueryResultRow {
  readonly algorithm: string;
  readonly memory_kib: number;
  readonly passes: number;
  readonly parallelism: number;
  readonly salt: Buffer;
  readonly hash: Buffer;
}

/**
 * THE COUNT OF CHECK 4c OVER ROWS ALREADY READ (task 4 row 211; requirement R-X2-11): how many of these
 * stored hash sets verify against the published demo password, one derivation after another. The ONE place
 * of the product where the published password meets the verifier: `storedDemoPasswordOperators` counts with
 * it, and so does the host command that sets passwords (row 215), so the command's final count and the boot
 * check cannot disagree. It catches nothing: a set that cannot be verified rejects, and each caller keeps
 * its own fail-closed answer. Nothing but the count is returned.
 */
export async function demoPasswordHashSetsAmong(
  rows: readonly StoredHashSetRow[],
  verify: (candidate: string, record: Parameters<typeof verifyPassword>[1]) => Promise<boolean> = verifyPassword,
): Promise<number> {
  let count = 0;
  for (const row of rows) {
    if (await verify(DEMO_OPERATOR_PASSWORD, { algorithm: row.algorithm, memoryKib: row.memory_kib, passes: row.passes, parallelism: row.parallelism, salt: row.salt, hash: row.hash })) count += 1;
  }
  return count;
}

/** THE PER-ROW PREDICATE OF CHECK 4c (row 211): true when this one stored hash set is counted by the function above. */
export async function storedHashSetIsDemoPassword(
  row: StoredHashSetRow,
  verify: (candidate: string, record: Parameters<typeof verifyPassword>[1]) => Promise<boolean> = verifyPassword,
): Promise<boolean> {
  return (await demoPasswordHashSetsAmong([row], verify)) === 1;
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
    return await demoPasswordHashSetsAmong(rows, verify);
  } catch {
    // The error of a read or of a derivation is not passed on: it could name a row. The refusal says OPERATORS_UNREADABLE.
    return null;
  }
}

/**
 * Row NB (design 06 row N13): the system programs of the macOS microphone listing that a production boot on `darwin` holds to the
 * path rule - rows L1 and L2 of row N4's table, in that order, by its own constants (no key of the configuration names them).
 */
export const SYSTEM_LISTING_PROGRAMS: readonly string[] = Object.freeze([MACOS_USB_TREE_PROGRAM, MACOS_SYSTEM_AUDIO_PROGRAM]);

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
  /** The host facts in force: the seam of a bare mount, or what the entry point handed in. Null: none yet. */
  let provided: CaptureBootHostFacts | null = mount.host ?? null;
  /** True from the moment the boot step read the facts: nothing replaces them after that. */
  let asked = false;
  /** The installation id in force (row 228): the seam of a bare mount, or what the identity's unit handed in. Undefined: none yet. */
  let installation: string | null | undefined = mount.installationId;
  /** Row 226c: the key id of the certificate the checks of this step loaded and passed. Null until then, and where none was loaded. */
  let judgedKeyId: string | null = null;
  /** The reader of the key id the boot step's one load of the store gave: set by the run of the step, null before it. */
  let loadedKeyId: () => string | null = () => null;
  const control: CaptureBootControl = {
    decision,
    outcome: () => outcome,
    judgedSigningKey: () => judgedKeyId,
    hostPlatform: () => (provided === null ? null : provided.platform),
    provideHost(facts) {
      if (asked) throw new CaptureHostFactsError('ALREADY_ASKED');
      if (provided !== null) throw new CaptureHostFactsError('ALREADY_PROVIDED');
      provided = facts;
    },
    provideInstallationId(installationId) {
      if (asked) throw new CaptureInstallationIdError('ALREADY_ASKED');
      if (installation !== undefined) throw new CaptureInstallationIdError('ALREADY_PROVIDED');
      installation = installationId;
    },
  };
  controls.set(app.stages, control);

  const { captureWorkerPath, mediaStoreDir, dataDir, captureRelayPath, captureGuardPath } = app.config;
  // Row HC: read apart from the line above, which stays as it was. Null when `DEMS_CAPTURE_ALIAS_SOCKET` is unset.
  const captureAliasSocketPath: string | null = app.config.captureAliasSocketPath ?? null;
  // Steps 4d and 4e (rows 80, 81): the facts in force, with the two program paths of the configuration. ALWAYS built
  // (row 85, C46): with no facts handed in, the host is one that cannot be seen, and `checks.ts` refuses a production start.
  const hostChecksOf = (facts: CaptureBootHostFacts) => ({
    host: { ...facts, coreFileLimit: () => facts.coreFileLimit(), relayProgram: captureRelayPath, guardProgram: captureGuardPath },
    programs: {
      platform: facts.platform,
      relayProgram: captureRelayPath,
      run: facts.run,
      storedInterface: () => (mount.storedCameraInterface ?? (() => storedCameraInterface(app)))(),
      // Row NB (design 06 row N13): held to the path rule on `darwin` only (`program-checks.ts` decides by the platform); never started.
      systemListingPrograms: SYSTEM_LISTING_PROGRAMS,
    },
  });
  const handshake = (): Promise<WorkerHandshake> => {
    // Reached only after the path rule passed, so the program is set. THE SAME ARGUMENTS AS A SESSION START (gate 64 C7):
    // a worker that does not accept one of them ends with its usage text HERE and the start is refused, not the first session.
    const launcher = mount.launcher ?? createProcessLauncher({ command: captureWorkerPath ?? '', args: captureWorkerArguments(`${dataDir}/${BOOT_PROBE_LOG_NAME}`) });
    return probeWorkerHandshake({ launcher, timers: mount.timers, ...(mount.helloTimeoutMs === undefined ? {} : { helloTimeoutMs: mount.helloTimeoutMs }) });
  };

  app.readiness.addBootStep({
    id: CAPTURE_BOOT_STEP,
    async run() {
      asked = true;
      const hostChecks = hostChecksOf(provided ?? HOST_NOT_SEEN);
      outcome = await runCaptureBootChecks({
        decision,
        workerProgram: captureWorkerPath,
        inspect: mount.inspect ?? inspectProgram,
        probeEvidenceVolume: () => (mount.probeEvidenceVolume ?? probeEvidenceVolume)(mediaStoreDir),
        // Checks 4 and 4b judge ONE loaded certificate (row 211, SX-16): the store is loaded at most once in this run.
        // Check 4b-2 (row 228) judges that same certificate against the installation id in force; none in force is "not known".
        // Row 226c: the last argument takes the reader of the key id that one load gave (asked below, after the checks passed).
        ...signingKeyQuestionsOf(mount, `${dataDir}/${SIGNING_STORE_SUBPATH}`, () => app.clock.now(), () => installation ?? null, (reader) => void (loadedKeyId = reader)),
        // Check 4b-3 (row 228b): ALWAYS handed in - the id in force is asked whether it is a reserved test id; none in force is null.
        installationId: () => installation ?? null,
        demoPasswordOperators: () => (mount.demoPasswordOperators ?? (() => storedDemoPasswordOperators(app)))(),
        handshake,
        // Row HC (C55 DD-2): the step says whether ANY host facts were handed in; with none, a production start is refused by a code of its own.
        hostFactsHandedIn: provided !== null,
        // Row HC (C53 (4c)): the socket path the client of the address helper would dial; a production start refuses one that is not the installed path.
        configuredAliasSocket: captureAliasSocketPath,
        ...hostChecks,
        sinks: mount.sinks,
      });
      // Row 226c (C81): THE ONE HAND-OVER. The checks passed: the key id of the certificate they judged is what the Core's signer is held to.
      judgedKeyId = loadedKeyId();
      await publishEvidenceVolume(app, outcome, mount);
    },
  });
  return control;
}
