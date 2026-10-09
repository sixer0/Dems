/**
 * The boot of the capture fence (blueprint row 136; capture spec §A.1.2 "Allowed combinations and
 * boot refusals"; `dbc-4` §N.9; SEC35-41 (b), SEC35-43 (a); decisions D82(e), D83, D108; checks
 * `M4-SEC-FENCE-1`, `M4-SEC-HELPER-1`).
 *
 * THE FENCE IS A SECURITY CONTROL: a production configuration must never be able to select a
 * development source. Every unsafe combination stops the start before a listener opens:
 *
 *   DEV_SOURCES_NEED_REAL_CAPTURE    the flag with capture mode `simulated`            (flags alone)
 *   DEV_FLAG_WITH_LAN_LISTENER       the flag with a listener outside loopback         (flags alone)
 *   REAL_CAPTURE_WITH_DEMO_CONTROLS  capture mode `real` with demo controls (row 61's) (flags alone)
 *   DEV_SOURCE_WITHOUT_FLAG          `REAL_PRODUCTION` and the selector assigns a development source
 *   DEV_FLAG_WITH_PRODUCTION_SOURCE  `REAL_DEVELOPMENT` and the selector assigns a production source
 *   DEV_HELPER_PROGRAM_UNUSABLE      `REAL_DEVELOPMENT` and the helper program is unset or fails the path rule
 *
 * "Stored sources" are the devices the SELECTOR ASSIGNS. A registered device nobody assigned is
 * ignored. In `SIMULATED` every stored kind is INERT: the registry is not even read, so a
 * database that holds local or production rows keeps booting.
 *
 * WHAT A BOOT WRITES (SEC35-41 (b)). A boot that passes in a REAL operation writes ONE audit row,
 * `SYSTEM_BOOT` with `captureOperation`, in the same unit as the registration of the local
 * devices. A refused boot writes no row: its code goes to the log and to the persistent error log,
 * and the start stops.
 * NOT YET IN `SIMULATED` (`BOOT_AUDIT_OPERATIONS`): SEC35-41 (b) and C3 §5.2 ask for the row at
 * EVERY boot, but a row at a simulated start contradicts the restart criteria the server is held
 * to today (AC-B-04: a restart changes nothing but the epoch and what spec §8.6 names) - measured:
 * with the row written in `SIMULATED` 25 closed tests of the restart family fail. Which of the two
 * yields is a ruling, not this row's choice; adding `SIMULATED` to the list below is the whole change.
 *
 * A refusal names codes and registry ids. It never holds a path, an address or a value of the
 * environment: the helper program is named by its configuration key.
 */
import { CaptureAdapterKind, CaptureOperation, CaptureSourceClass, sourceClassOf } from '../adapters/kinds';
import { HelperProgramRefusal, helperProgramRefusal, type ProgramInspector } from '../adapters/local';
import { CaptureFlagRefusal, captureOperationDecisionOf, type CaptureOperationDecision, type CaptureOperationInput } from './operation';
import { registerLocalDevices, type FenceExecutor, type LocalDeviceClass, type StoredCaptureDevice } from './registration';
import { READ_ASSIGNED_SOURCES } from './statements';

/** ID of the boot step. It appears in the log line of a boot that stops at it. */
export const CAPTURE_FENCE_BOOT_STEP = 'capture.fence';

export const CaptureFenceRefusal = {
  ...CaptureFlagRefusal,
  DEV_SOURCE_WITHOUT_FLAG: 'DEV_SOURCE_WITHOUT_FLAG',
  DEV_FLAG_WITH_PRODUCTION_SOURCE: 'DEV_FLAG_WITH_PRODUCTION_SOURCE',
  DEV_HELPER_PROGRAM_UNUSABLE: 'DEV_HELPER_PROGRAM_UNUSABLE',
} as const;
export type CaptureFenceRefusal = (typeof CaptureFenceRefusal)[keyof typeof CaptureFenceRefusal];

/** The five refusals of the development fence (spec §A.1.2; check `M4-SEC-FENCE-1`). The sixth code above is row 61's. */
export const DEVELOPMENT_FENCE_REFUSALS: readonly CaptureFenceRefusal[] = Object.freeze([
  CaptureFenceRefusal.DEV_SOURCES_NEED_REAL_CAPTURE,
  CaptureFenceRefusal.DEV_SOURCE_WITHOUT_FLAG,
  CaptureFenceRefusal.DEV_FLAG_WITH_PRODUCTION_SOURCE,
  CaptureFenceRefusal.DEV_HELPER_PROGRAM_UNUSABLE,
  CaptureFenceRefusal.DEV_FLAG_WITH_LAN_LISTENER,
]);

/**
 * The operations whose boot writes the `SYSTEM_BOOT` audit row. The real ones: the trace SEC35-41
 * (b) asks for - a development boot of a database that once held production evidence - is here.
 * `SIMULATED` waits for a ruling (see the header).
 */
export const BOOT_AUDIT_OPERATIONS: readonly CaptureOperation[] = Object.freeze([CaptureOperation.REAL_PRODUCTION, CaptureOperation.REAL_DEVELOPMENT]);

/** Why the helper program cannot be used: it is not configured, the path rule refuses it, or it cannot be executed. */
export const HelperProgramProblem = { ...HelperProgramRefusal, NOT_SET: 'NOT_SET', NOT_EXECUTABLE: 'NOT_EXECUTABLE' } as const;
export type HelperProgramProblem = (typeof HelperProgramProblem)[keyof typeof HelperProgramProblem];

const SETUP =
  'The helper must be a private copy: the file and every directory on the way to it owned by root or by the user of the server, none of them writable by group or others. ' +
  'An FFmpeg installed by a package manager does not pass (its directories are group-writable). ' +
  'Run `npm run capture:dev-setup` and set DEMS_CAPTURE_HELPER_FFMPEG to the path it prints.';

const TEXT: Readonly<Record<CaptureFenceRefusal, string>> = Object.freeze({
  DEV_SOURCES_NEED_REAL_CAPTURE:
    'DEMS_CAPTURE_DEV_SOURCES=1 is refused with capture mode simulated: development sources exist only where a capture worker records them. Unset the flag, or start with DEMS_CAPTURE_MODE=real.',
  DEV_FLAG_WITH_LAN_LISTENER: 'DEMS_CAPTURE_DEV_SOURCES=1 is refused while a listener outside loopback is configured: that is a production configuration. Unset the flag.',
  REAL_CAPTURE_WITH_DEMO_CONTROLS:
    'DEMS_CAPTURE_MODE=real is refused with DEMS_DEMO_CONTROLS=1: demo fault injection has no place beside a real capture worker, with or without development sources. Unset one of the two.',
  DEV_SOURCE_WITHOUT_FLAG:
    'The selector assigns development sources and DEMS_CAPTURE_DEV_SOURCES is not 1: a production configuration never records a development source. ' +
    'To remove them, start once with DEMS_CAPTURE_DEV_SOURCES=1, unassign them on the Devices page, then start without the flag.',
  DEV_FLAG_WITH_PRODUCTION_SOURCE:
    'DEMS_CAPTURE_DEV_SOURCES=1 is refused: the selector assigns production sources, and one session is never both. Start without the flag; to use development sources, unassign the production sources first.',
  DEV_HELPER_PROGRAM_UNUSABLE: `DEMS_CAPTURE_DEV_SOURCES=1 needs a usable helper program in DEMS_CAPTURE_HELPER_FFMPEG. ${SETUP}`,
});

/** A configuration the fence refuses. `code` is stable; the message names keys, codes and registry ids only. */
export class CaptureFenceError extends Error {
  readonly code: CaptureFenceRefusal;
  /** The registry ids the refusal is about, in id order. */
  readonly deviceIds: readonly string[];
  /** For `DEV_HELPER_PROGRAM_UNUSABLE`: which rule failed. */
  readonly helperProblem: HelperProgramProblem | null;
  constructor(code: CaptureFenceRefusal, deviceIds: readonly string[] = [], helperProblem: HelperProgramProblem | null = null) {
    super(`${TEXT[code]}${deviceIds.length === 0 ? '' : ` Devices: ${deviceIds.join(', ')}.`}${helperProblem === null ? '' : ` Reason: ${helperProblem}.`}`);
    this.name = 'CaptureFenceError';
    this.code = code;
    this.deviceIds = Object.freeze([...deviceIds]);
    this.helperProblem = helperProblem;
  }
}

/** One slot of the selector with the device it names. */
export interface AssignedSource {
  readonly slot: string;
  readonly id: string;
  readonly adapterKind: CaptureAdapterKind;
}

/** The helper program of the configuration against the path rule (SEC35-43 (a)), plus "is set" and "can be executed". */
export function helperProgramProblemOf(program: string | null, inspect: ProgramInspector): HelperProgramProblem | null {
  if (program === null || program === '') return HelperProgramProblem.NOT_SET;
  const facts = inspect(program);
  const refused = helperProgramRefusal(facts);
  if (refused !== null) return refused;
  return facts.file !== null && (facts.file.mode & 0o111) !== 0 ? null : HelperProgramProblem.NOT_EXECUTABLE;
}

/**
 * THE decision of the fence, pure: the flags' decision, the assigned sources and the state of the
 * helper program in, the refusal (or null) out. `assigned` and `helper` are read only for the
 * operation that needs them.
 */
export function captureFenceRefusalOf(decision: CaptureOperationDecision, assigned: readonly AssignedSource[], helper: HelperProgramProblem | null): CaptureFenceError | null {
  if (decision.refusal !== null) return new CaptureFenceError(decision.refusal);
  const idsOf = (wanted: CaptureSourceClass): string[] => [...new Set(assigned.filter((source) => sourceClassOf(source.adapterKind) === wanted).map((source) => source.id))].sort();
  if (decision.operation === CaptureOperation.REAL_PRODUCTION) {
    const development = idsOf(CaptureSourceClass.DEVELOPMENT);
    return development.length === 0 ? null : new CaptureFenceError(CaptureFenceRefusal.DEV_SOURCE_WITHOUT_FLAG, development);
  }
  if (decision.operation === CaptureOperation.REAL_DEVELOPMENT) {
    const production = idsOf(CaptureSourceClass.PRODUCTION);
    if (production.length > 0) return new CaptureFenceError(CaptureFenceRefusal.DEV_FLAG_WITH_PRODUCTION_SOURCE, production);
    return helper === null ? null : new CaptureFenceError(CaptureFenceRefusal.DEV_HELPER_PROGRAM_UNUSABLE, [], helper);
  }
  // SIMULATED: every stored kind is inert.
  return null;
}

/** Log and error-log sinks: the capture unit's one logging file hands them in (static rule G-R4). */
export interface CaptureFenceSinks {
  info(fields: Record<string, unknown>, message: string): void;
  warn(fields: Record<string, unknown>, message: string): void;
  error(fields: Record<string, unknown>, message: string): void;
  persist(entry: { readonly level: 'error' | 'warn'; readonly source: string; readonly message: string; readonly code: string; readonly context: Record<string, string | number> }): void;
}

/** The unit the boot writes in: its statements, and the one audit row of a boot. */
export interface CaptureFenceUnit extends FenceExecutor {
  appendBootAudit(operation: CaptureOperation): Promise<void>;
}

export interface CaptureFenceBootDeps {
  readonly config: CaptureOperationInput & { readonly captureHelperFfmpegPath: string | null };
  /** Runs `work` in ONE unit of the pipeline: everything it writes commits together or not at all. */
  inUnit<Value>(work: (unit: CaptureFenceUnit) => Promise<Value>): Promise<Value>;
  readonly inspect: ProgramInspector;
  /** The labels the two local device rows are registered with. */
  readonly labels: Readonly<Record<LocalDeviceClass, string>>;
  /** Whether a local device is in the device list now. Listing opens no device and asks for no permission. */
  listed(deviceClass: LocalDeviceClass, program: string): Promise<boolean>;
  readonly sinks: CaptureFenceSinks;
}

export interface CaptureFenceOutcome {
  readonly operation: CaptureOperation;
  /** The registry as stored, in id order. Empty in `SIMULATED`: it is not read there. */
  readonly devices: readonly StoredCaptureDevice[];
  /** The ids of the two local devices, in `REAL_DEVELOPMENT`; null otherwise. */
  readonly local: { readonly cameraId: string; readonly micId: string } | null;
  /** The ids this boot inserted. */
  readonly inserted: readonly string[];
  /** The helper program the fence vouched for, in `REAL_DEVELOPMENT`; null otherwise. */
  readonly helperProgram: string | null;
}

const SOURCE = 'capture.fence';
const PASSED = 'capture fence passed';
const REFUSED = 'the capture fence refuses this configuration: the server does not start';
const KINDS: readonly string[] = Object.values(CaptureAdapterKind);

async function readAssigned(unit: FenceExecutor): Promise<AssignedSource[]> {
  const { rows } = await unit.query<Record<string, unknown>>(READ_ASSIGNED_SOURCES);
  return rows.map((row) => {
    const { slot, id, adapterKind } = row;
    // A kind outside the closed set cannot be classed: the fence refuses rather than guess (the CHECK makes it impossible in a migrated database).
    if (typeof slot !== 'string' || typeof id !== 'string' || typeof adapterKind !== 'string' || !KINDS.includes(adapterKind)) throw new Error('an assigned capture source carries an adapter kind outside the closed set');
    return { slot, id, adapterKind: adapterKind as CaptureAdapterKind };
  });
}

/**
 * Decides, registers, writes the boot audit row. Throws `CaptureFenceError` after logging and
 * persisting it: the readiness runner stops the start as it does for any boot step.
 */
export async function runCaptureFenceBoot(deps: CaptureFenceBootDeps): Promise<CaptureFenceOutcome> {
  const decision = captureOperationDecisionOf(deps.config);
  const { operation } = decision;
  const refuse = (failure: CaptureFenceError): never => {
    const context = { code: failure.code, devices: failure.deviceIds.join(','), ...(failure.helperProblem === null ? {} : { reason: failure.helperProblem }) };
    deps.sinks.error(context, REFUSED);
    deps.sinks.persist({ level: 'error', source: SOURCE, message: REFUSED, code: failure.code, context });
    throw failure;
  };
  // Rows 4, 6 and 10: decided by the flags, before anything is read.
  const byFlags = captureFenceRefusalOf(decision, [], null);
  if (byFlags !== null) refuse(byFlags);

  const development = operation === CaptureOperation.REAL_DEVELOPMENT;
  const program = deps.config.captureHelperFfmpegPath;
  const helper = development ? helperProgramProblemOf(program, deps.inspect) : null;

  const decided = await deps.inUnit(async (unit): Promise<CaptureFenceOutcome | CaptureFenceError> => {
    // Rows 7 to 9. In SIMULATED the stored kinds are inert: the registry is not read at all.
    const assigned = operation === CaptureOperation.SIMULATED ? [] : await readAssigned(unit);
    const refused = captureFenceRefusalOf(decision, assigned, helper);
    // A refused boot writes nothing: no registration, no audit row.
    if (refused !== null) return refused;
    let registration: Awaited<ReturnType<typeof registerLocalDevices>> | null = null;
    if (development && program !== null) {
      registration = await registerLocalDevices(unit, { labels: deps.labels, listed: (deviceClass) => deps.listed(deviceClass, program) });
    }
    if (BOOT_AUDIT_OPERATIONS.includes(operation)) await unit.appendBootAudit(operation);
    return {
      operation,
      devices: registration?.devices ?? [],
      local: registration === null ? null : { cameraId: registration.cameraId, micId: registration.micId },
      inserted: registration?.inserted ?? [],
      helperProgram: development ? program : null,
    };
  });
  if (decided instanceof CaptureFenceError) return refuse(decided);
  const outcome = decided;
  deps.sinks.info({ code: 'CAPTURE_FENCE_PASSED', operation, registered: outcome.inserted.join(','), local: outcome.local === null ? '' : `${outcome.local.cameraId},${outcome.local.micId}` }, PASSED);
  return outcome;
}
