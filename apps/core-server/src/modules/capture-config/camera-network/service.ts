/**
 * THE SET-IP JOB: what operations 106 `setCameraNetwork` and 107 `getCameraNetworkJob` do (task 4
 * blueprint row 111, package WP-22b; contract `packages/shared/src/api/capture-commissioning.ts`,
 * row 102; decisions C1, C7 (the typed account), C19, C74, C78 (the alias address and its
 * removal), U10; security requirements S13-04, S13-10, S13-11, S13-12; design rules DR-6, DR-7).
 *
 * ONE job on ONE camera: the camera that answers at `fromAddress` is given a fixed address inside
 * the camera subnet - the typed one, or the next free one from the configured first address.
 *
 * EVERYTHING THAT TOUCHES THE HOST OR THE NETWORK IS A PORT (`CameraNetworkParts`), handed in by
 * the composition of production capture. This file opens nothing, starts nothing, reads no clock
 * of its own and logs through its host:
 *
 *   camera.rule        `decideDestination` of the capture unit with the purpose of this job, on the
 *                      facts this file states: the ONLY judge of an address that is dialled;
 *   camera.newAddress  `decideNewCameraAddress`: the ONLY judge of the address that is written;
 *   camera.poll        the unauthenticated ONVIF clock read: one request, nothing typed in its reach;
 *   camera.set         the set-network file (row 110): the interface read, this file's judgement of
 *                      the hardware address it reports, then the set;
 *   alias              the alias address of the camera port (rows 105, 106, 106b);
 *   inputs             THE HOST'S OWN OBSERVATIONS: the neighbour table and "does anything answer
 *                      at this address". WITHOUT THEM NO JOB STARTS (fail closed);
 *   guard              the ONE lock-out guard of the connection tests (operations 95 and 96, the
 *                      stored test): this job is the FOURTH operation that can spend a camera's
 *                      authentication attempts, and it spends them from the same count.
 *
 * THE TYPED ACCOUNT (C1, C7). The route wraps what the technician typed into an opaque object at
 * the one place it reads the body; this file never sees the two values. The object lives in ONE
 * variable of the job's own closure, is handed to ONE call (`camera.set`) and is dropped when that
 * call ends, on every way out - before the wait at the new address begins. It is in no job record,
 * no log line, no audit detail, no error and no argument of a program. NOTHING typed is ever sent
 * to the new address: the camera is recognised there by the host's neighbour table.
 *
 * THE ORDER OF THE REFUSALS BEFORE A JOB EXISTS. Each sends nothing to the camera, asks for no
 * alias address and writes no audit entry:
 *
 *   409 CAPTURE_CONFIG_LOCKED                              a session is open (idle only)
 *   409 INVALID_STATE  COMMISSIONING_NOT_AVAILABLE         not production capture; no parts; no
 *                                                          inputs of the host; the helper does not
 *                                                          exist on this platform; the host cannot
 *                                                          be read
 *   409 INVALID_STATE  COMMISSIONING_JOB_IN_PROGRESS       a job or a scan runs, or a connection
 *                                                          test holds the one turn of the guard
 *   409 INVALID_STATE  COMMISSIONING_HELPER_NOT_CONFIGURED the helper cannot be reached as installed
 *   409 INVALID_STATE  COMMISSIONING_NOT_CONFIGURED        no interface or subnet is chosen
 *   422 INVALID_INPUT  COMMISSIONING_ADDRESS_NOT_ALLOWED   the rule refuses the present address, the
 *                                                          new address or the gateway; or the
 *                                                          present address is none of the last scan
 *   409 INVALID_STATE  CAMERA_SCAN_TOO_OLD                 the last scan is older than the contract's bound,
 *                                                          or the clock went back since (R119-03)
 *   409 INVALID_STATE  CAMERA_ADDRESS_CONFLICT             the last scan saw more than one device there
 *   409 INVALID_STATE  CAMERA_HARDWARE_ADDRESS_NOT_BOUND   the hardware address of the request is not the
 *                                                          one the last scan showed there, or it showed
 *                                                          none (R119-04)
 *   429 RATE_LIMITED   CONNECTION_TEST_LOCKOUT_GUARD       the guard of that address is closed
 *   429 RATE_LIMITED   CONNECTION_TEST_RATE_LIMITED        the spacing of the guard
 *   409 INVALID_STATE  CAMERA_NEW_ADDRESS_IN_USE           something answers at the typed new address
 *   409 INVALID_STATE  CAMERA_NO_FREE_ADDRESS              no free address from the configured first one
 *
 * WHAT THE LAST SCAN KNEW OF THE NUMBER OF DEVICES (security review of row 119, cautions R119-03
 * and R119-04; decision C94 (a)) is one of three states, each named in `prepare`: MORE_THAN_ONE
 * refuses; ONE and NOT_KNOWN go on. NOT_KNOWN - the scan could not count, today always - is NOT
 * "one": the job goes on ONLY because it is BOUND to the hardware address the technician saw on
 * the scan row (`scannedMac`, a required member of the request). The last scan must have shown
 * exactly that address; the neighbour table must hold exactly that address BEFORE the typed
 * account is used; the device must state exactly that address BEFORE any set request. The job's
 * answer and both of its audit entries say which state it ran on.
 *
 * "FREE" (caution R119-06): the new address is free only after `CAMERA_NETWORK_FREE_ADDRESS_ATTEMPTS`
 * observations in a row that each said "silent" (no echo, and the host's own entry says it asked
 * and nobody answered), inside one bound of time. One "taken" is taken; anything not known refuses.
 *
 * THE JOB, once it exists (202): REACHING (the alias address when the camera is outside the camera
 * subnet; the unauthenticated poll) - IDENTIFYING (the hardware address of the neighbour table) -
 * SETTING (the one call with the typed account; the device's own hardware address must equal the
 * neighbour table's or NO set request is made) - WAITING (the unauthenticated poll of the new
 * address every 4 s for at most 180 s, then the neighbour table: the SAME hardware address).
 * Whatever happens after `add` was asked, the alias address is asked away again (decision C78:
 * not after an `add` that answered "certainly nothing was changed").
 *
 * A REGISTERED CAMERA IS NOT RE-ADDRESSED IN THE REGISTRY BY THIS JOB: `deviceId` of a job is
 * always null, no CAPTURE_DEVICE_ADDRESS_CHANGED entry is written here, and the stored address of
 * a registered camera stays what it was until the operator confirms the new one (operation 100).
 *
 * DEVICE TEXT never reaches this file: the ports answer codes, counts and hardware addresses, and
 * a hardware address is held to its one form before it is kept. What a port THROWS is never read.
 */
import {
  ApiErrorCode,
  CAMERA_NETWORK_FREE_ADDRESS_ATTEMPTS,
  CAMERA_NETWORK_SCAN_MAX_AGE_MS,
  CAMERA_NETWORK_SET_POLL_MS,
  CAMERA_NETWORK_SET_WAIT_MS,
  CAPTURE_COMMISSIONING_REFUSAL_SENTENCES,
  CAPTURE_MAC_ADDRESS_PATTERN,
  CameraNetworkJobFailure,
  CameraNetworkJobState,
  CameraNetworkJobStep,
  CaptureCommissioningReason,
  CaptureConnectionOutcome,
  CaptureDiscoveryReason,
  FactoryCameraDeviceCount,
  HostAliasReason,
  RETRY_AFTER_HEADER_NAME,
  type CameraNetworkJob,
} from '@dems/shared/api';
import { AuditType, Permission } from '@dems/shared/sim';
import type { SealedCredential } from '../../../capture/adapters';
import type { DestinationContext } from '../../../capture/fence';
import type { AuditEntry } from '../../../core';
import { ApiFailure } from '../../../plugins/error-envelope';

// ── The ports ──────────────────────────────────────────────────────────────────────────────────

/** The operator behind a request, as stage 4 resolved it. A job is data of `sessionId`. */
export interface CameraNetworkCaller {
  readonly operatorId: string;
  readonly sessionId: string;
  readonly deviceId: string | null;
}

/** What the route hands over of the request body: the addresses. The typed account is the separate, opaque parameter. */
export interface CameraNetworkRequest {
  readonly fromAddress: string;
  /** The hardware address the technician saw on the scan row (R119-04): the job is bound to it. Held to its one form here again. */
  readonly scannedMac: string;
  readonly toAddress?: string | undefined;
  readonly gateway?: string | undefined;
}

/** An address the rule admitted, BY SHAPE; the rule's object is handed on unchanged (static rule SR-2 (2) of the capture unit). */
export interface CameraNetworkDestination {
  readonly address: string;
  readonly port: number;
  readonly sourceAddress?: unknown;
  readonly viaAlias?: unknown;
}
export type CameraNetworkRuleDecision = { readonly allowed: true; readonly destination: CameraNetworkDestination } | { readonly allowed: false; readonly refusal?: unknown };
/** THE RULE of an address this job dials: `decideDestination` with the purpose of the job, on the facts stated. */
export type CameraNetworkRule = (address: string, facts: DestinationContext) => CameraNetworkRuleDecision;

/** What the rule of the written address makes: the address, the prefix of the configuration, the gateway or none. */
export interface CameraNetworkAssignment {
  readonly address: string;
  readonly prefixLength: number;
  readonly gateway: string | null;
}
export type CameraNewAddressDecision = { readonly allowed: true; readonly assignment: CameraNetworkAssignment } | { readonly allowed: false; readonly refusal?: unknown };
/** THE RULE of the address a camera is given (`decideNewCameraAddress`). */
export type CameraNewAddressRule = (request: { readonly address: unknown; readonly gateway?: unknown }, context: DestinationContext & { readonly registeredCameraAddresses: readonly string[] }) => CameraNewAddressDecision;

/** What the set call answers, as far as this file reads it: codes, counts, one hardware address. */
export interface CameraNetworkSetAnswer {
  /** `SET`, `NOT_SET` or `UNKNOWN` (a set was sent and no valid answer came back). */
  readonly outcome: string;
  readonly reason: string | null;
  /** Requests the device refused although they carried the typed account: what a camera's own lock-out counts. */
  readonly rejectedCredentialRequests: number;
}

export interface CameraNetworkSetCall {
  /** The camera's present address, as the rule rebuilt it. */
  readonly address: string;
  /** The facts of the host this file read for THIS call. */
  readonly facts: DestinationContext;
  readonly assignment: CameraNetworkAssignment;
  readonly credential: SealedCredential;
  /** This file's judgement of the hardware address the device reports BEFORE the set: false sends no set request. */
  readonly admitHwAddress: (reported: string | null) => boolean;
  readonly signal: AbortSignal;
}

/** The camera, as the capture unit offers it through the fence. */
export interface CameraNetworkCamera {
  readonly rule: CameraNetworkRule;
  readonly newAddress: CameraNewAddressRule;
  /** The UNAUTHENTICATED poll: one request to an admitted address from the source the rule named. */
  poll(destination: CameraNetworkDestination, signal: AbortSignal): Promise<{ readonly answered: boolean }>;
  /** THE ONE CALL that carries the typed account. */
  set(call: CameraNetworkSetCall): Promise<CameraNetworkSetAnswer>;
}

/** Who asks for an alias address, and why: passed through to the journal of the lifecycle, unread here. */
export interface CameraNetworkAliasSubject {
  readonly operatorId: string;
  readonly deviceId: string | null;
  readonly reason: typeof HostAliasReason.SET_CAMERA_ADDRESS;
  readonly operationId: 'setCameraNetwork';
  readonly permission: typeof Permission.CAPTURE_COMMISSION;
}
export interface CameraNetworkAliasOutcome {
  /** null: done as asked. Else a word of a closed set. */
  readonly refusal: string | null;
  /** `DONE`, `NOT_DONE` or `UNKNOWN`. Only `DONE` with no refusal is a confirmation. */
  readonly effect: string;
}
/** THE ALIAS ADDRESS of the camera port (`productionHostAlias(app).jobs`). */
export interface CameraNetworkAlias {
  /** Whether the helper can be asked at all. Dials nothing. null: yes. */
  helper(): Promise<string | null>;
  add(request: { readonly address: string; readonly minutes: number; readonly subject: CameraNetworkAliasSubject }): Promise<CameraNetworkAliasOutcome>;
  remove(request: { readonly address: string; readonly subject: CameraNetworkAliasSubject }): Promise<CameraNetworkAliasOutcome>;
}

/**
 * THE HOST'S OWN OBSERVATIONS (decision C78). Since task 4 row 111b the production values are the
 * capture unit's (`hostCommissioningInputsOf`: two fixed program rows through the production door,
 * on `linux` only); on any other platform none is handed in and every job is refused.
 * Both are asked from the camera port and both may throw; neither returns a text of a device.
 */
export interface CameraNetworkInputs {
  /** The hardware address the host's neighbour table holds for an address, or null. */
  neighbour(address: string, signal: AbortSignal): Promise<string | null>;
  /** True when ANYTHING answers at the address (not only an ONVIF device). */
  answers(address: string, signal: AbortSignal): Promise<boolean>;
}

/** The one turn of the lock-out guard (`ConnectionTestTurn`, by shape). */
export interface CameraNetworkGuardTurn {
  end(outcome: CaptureConnectionOutcome, rejectedRequests: number | null): { readonly guardTripped: boolean };
  abandon(): void;
}
/** THE LOCK-OUT GUARD of the connection tests (`ConnectionTestLimits`, by shape): the same object operations 95 and 96 ask. */
export interface CameraNetworkGuard {
  refusal(host: string, sessionKey: string): { readonly reason: string; readonly retryAfterMs: number } | null;
  begin(host: string, sessionKey: string): CameraNetworkGuardTurn;
}

/** Everything the composition hands in. Without it, and without `inputs`, every job is refused. */
export interface CameraNetworkParts {
  readonly camera: CameraNetworkCamera;
  readonly alias: CameraNetworkAlias;
  /** Asked at each job: the guard of the app as it is NOW. */
  readonly guard: () => CameraNetworkGuard;
  readonly inputs?: CameraNetworkInputs;
}

/** The stored settings a job reads (the one row of `capture_network_config`, or the contract's defaults). */
export interface CameraNetworkSettings {
  readonly configured: boolean;
  readonly aliasHost: number;
  readonly aliasMinutes: number;
  readonly cameraIpStart: number;
}

export interface CameraNetworkHost {
  now(): number;
  /** True while a session is open. Throws the engine's own refusal when the engine does not run. */
  sessionOpen(): boolean;
  settings(): Promise<CameraNetworkSettings>;
  /** The network facts of the host NOW (the reader of row 108). null: not configured. May throw. */
  facts(): DestinationContext | null;
  /** The stored addresses of the registered production cameras, each as it is stored. */
  registeredAddresses(): Promise<readonly string[]>;
  /** ONE audit entry, in a unit of its own. Rejects when it could not be written. */
  audit(entry: AuditEntry): Promise<void>;
  /** Calls `callback` once after `delayMs` unless the returned function was called first. */
  after(delayMs: number, callback: () => void): () => void;
  /** A line of the log: codes and counts only. */
  note(fields: Record<string, unknown>, message: string): void;
  /** A failure for the log AND the persistent error log: a fixed message, codes and counts. */
  failed(source: string, message: string, code: string, context: Record<string, string | number | boolean | null>): void;
}

/** What the commissioning scan offers this job: the ONE turn of the commissioning functions, and what its last answer said of an address. */
export interface CameraNetworkScan {
  /** The release function, or null while a scan or a job runs. */
  claim(): (() => void) | null;
  /** What the last scan KNEW of the number of devices at the address, the hardware address its row showed (null: none) and when it began; null: no such scan or no such row. */
  lastScanOf(address: string): { readonly deviceCount: FactoryCameraDeviceCount; readonly mac: string | null; readonly scannedAt: number } | null;
}

/** The jobs of a Core, in memory only. */
export interface CameraNetworkJobs {
  /** A new job id (`CNJ-` and six digits). */
  mint(): string;
  put(job: JobRecord): void;
  get(jobId: string): JobRecord | null;
  /** Ends what runs: the Core is closing. */
  stop(): void;
  /** Resolves when no job runs. */
  idle(): Promise<void>;
}

export interface CameraNetworkSeams {
  readonly host: CameraNetworkHost;
  readonly scan: CameraNetworkScan;
  readonly jobs: CameraNetworkJobs;
  /** True on a Core in production capture. */
  available(): boolean;
  /** The parts the composition handed in, or null. */
  parts(): CameraNetworkParts | null;
}

// ── Bounds ─────────────────────────────────────────────────────────────────────────────────────

/** How long ONE unauthenticated poll, one question to the neighbour table or one "does it answer" is given. */
export const CAMERA_NETWORK_ASK_TIMEOUT_MS = 5_000;
/** How long the one call with the typed account is given, all its requests together. */
export const CAMERA_NETWORK_SET_DEADLINE_MS = 30_000;
/** How many addresses are asked "does anything answer" when the next free one is looked for. */
export const CAMERA_NETWORK_NEXT_FREE_MAX_ASKED = 16;
/** The spacing of two observations of ONE address that is being judged "free" (R119-06): the host's own address question gets time to end. */
export const CAMERA_NETWORK_FREE_ADDRESS_SPACING_MS = 1_000;
/** All the observations of ONE address that is being judged "free", with their spacing, end inside this; what is not settled by then is "not known". */
export const CAMERA_NETWORK_FREE_ADDRESS_TOTAL_MS = 8_000;
/** Jobs kept in memory; the oldest ended one leaves first. */
export const CAMERA_NETWORK_JOBS_KEPT = 32;

export const CAMERA_NETWORK_SET_OPERATION_ID = 'setCameraNetwork';
export const CAMERA_NETWORK_SETTINGS_LABEL = 'captureCameraNetwork.settings';
export const CAMERA_NETWORK_REGISTERED_LABEL = 'captureCameraNetwork.registered';
export const CAMERA_NETWORK_AUDIT_LABEL = 'captureCameraNetwork.set';
export const CAMERA_NETWORK_REQUESTED_MESSAGE = 'Camera address change requested';
export const CAMERA_NETWORK_COMPLETED_MESSAGE = 'Camera address changed';
export const CAMERA_NETWORK_FAILED_MESSAGE = 'Camera address change failed';
const SOURCE = 'captureCameraNetwork';

/** The codes this file writes to the log and the error log. Never beside a text of a device and never beside anything typed. */
export const CameraNetworkCode = {
  HOST_FACTS_UNREADABLE: 'CAMERA_NETWORK_HOST_FACTS_UNREADABLE',
  HELPER_NOT_ASKED: 'CAMERA_NETWORK_HELPER_NOT_ASKED',
  INPUT_FAILED: 'CAMERA_NETWORK_HOST_INPUT_FAILED',
  POLL_FAILED: 'CAMERA_NETWORK_POLL_FAILED',
  SET_CALL_FAILED: 'CAMERA_NETWORK_SET_CALL_FAILED',
  ALIAS_NOT_CONFIRMED: 'CAMERA_NETWORK_ALIAS_NOT_CONFIRMED',
  ALIAS_REMOVAL_NOT_CONFIRMED: 'CAMERA_NETWORK_ALIAS_REMOVAL_NOT_CONFIRMED',
  SESSION_OPENED: 'CAMERA_NETWORK_SESSION_OPENED',
  AUDIT_NOT_WRITTEN: 'CAMERA_NETWORK_AUDIT_NOT_WRITTEN',
  JOB_FAULT: 'CAMERA_NETWORK_JOB_FAULT',
} as const;

const HOST_UNREADABLE_TEXT = 'the network facts of the host could not be read: the address change was refused and nothing was asked of any address';
const HELPER_NOT_ASKED_TEXT = 'the address helper could not be asked whether it is available: the address change was refused';
const INPUT_FAILED_TEXT = 'an observation of the host failed during an address change: it is treated as not known';
const POLL_FAILED_TEXT = 'a poll of the address change failed: the address is treated as not answering';
const SET_CALL_FAILED_TEXT = 'the set call of an address change ended without an answer of its form: the camera may hold either address';
const ALIAS_NOT_CONFIRMED_TEXT = 'the alias address of an address change was not confirmed in place: nothing was asked from it';
const REMOVAL_NOT_CONFIRMED_TEXT = 'the removal of the alias address of an address change was not confirmed: the address may still be on the camera port';
const SESSION_OPENED_TEXT = 'a session opened while an address change was being prepared: no set request was made';
const AUDIT_NOT_WRITTEN_TEXT = 'the closing audit entry of an address change could not be written: the requested entry stands alone';
const JOB_FAULT_TEXT = 'an address change ended on a fault of the Core';
const JOB_ENDED_TEXT = 'camera address change ended';

// ── Refusals: fixed texts that quote nothing of the request and nothing of a device ────────────

const R = CaptureCommissioningReason;
const F = CameraNetworkJobFailure;
const sentence = (reason: CaptureCommissioningReason): string => CAPTURE_COMMISSIONING_REFUSAL_SENTENCES[reason];
const locked = (): ApiFailure => new ApiFailure(409, ApiErrorCode.CAPTURE_CONFIG_LOCKED, 'A camera address cannot be changed while a session is open.');
const invalidState = (reason: CaptureCommissioningReason): ApiFailure => new ApiFailure(409, ApiErrorCode.INVALID_STATE, sentence(reason), { details: { reason } });
const addressNotAllowed = (): ApiFailure =>
  new ApiFailure(422, ApiErrorCode.INVALID_INPUT, sentence(R.COMMISSIONING_ADDRESS_NOT_ALLOWED), { details: { in: 'body', reason: R.COMMISSIONING_ADDRESS_NOT_ALLOWED } });
const guarded = (reason: string, retryAfterMs: number): ApiFailure =>
  new ApiFailure(429, ApiErrorCode.RATE_LIMITED, reason === CaptureDiscoveryReason.CONNECTION_TEST_LOCKOUT_GUARD ? 'Too many refused sign-ins at this camera. Try again later.' : 'Too many attempts. Try again shortly.', {
    details: { reason, retryInMs: retryAfterMs },
    headers: { [RETRY_AFTER_HEADER_NAME]: String(Math.max(1, Math.ceil(retryAfterMs / 1_000))) },
  });
const notFound = (): ApiFailure => new ApiFailure(404, ApiErrorCode.NOT_FOUND, 'No such job.');

/** The word of the helper's check for "no such helper on this platform" (`HostAliasTransportFailure`, row 105). */
const NOT_THIS_PLATFORM = 'NOT_AVAILABLE_ON_THIS_PLATFORM';
const DONE = 'DONE';
const NOT_DONE = 'NOT_DONE';
const NOT_CONFIGURED = 'NOT_CONFIGURED';
const CODE = /^[A-Z][A-Z0-9_]{0,63}$/;
const codeOr = (value: unknown, fallback: string): string => (typeof value === 'string' && CODE.test(value) ? value : fallback);
/** A hardware address in its one closed form, or null: nothing else is ever kept, shown or compared. */
const macOf = (value: unknown): string | null => (typeof value === 'string' && CAPTURE_MAC_ADDRESS_PATTERN.test(value) ? value : null);

// ── Addresses and the rule ─────────────────────────────────────────────────────────────────────

const QUAD = /^(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})$/;

/** `a.b.c` of a strict dotted quad, or null. Only to NAME an address the rule then judges. */
function firstThreeOf(address: unknown): string | null {
  const match = typeof address === 'string' ? QUAD.exec(address) : null;
  if (match === null) return null;
  const parts = [match[1], match[2], match[3], match[4]].map(Number);
  return parts.every((part) => part <= 255) ? parts.slice(0, 3).join('.') : null;
}

/** The rule's answer, or null for a refusal, a rule that throws or an answer that is no decision. */
function judged(rule: CameraNetworkRule, address: string, facts: DestinationContext): CameraNetworkDestination | null {
  let decision: CameraNetworkRuleDecision;
  try {
    decision = rule(address, facts);
  } catch {
    return null;
  }
  if (decision === null || typeof decision !== 'object' || decision.allowed !== true) return null;
  const { destination } = decision;
  if (destination === null || typeof destination !== 'object') return null;
  if (typeof destination.address !== 'string' || typeof destination.sourceAddress !== 'string' || typeof destination.viaAlias !== 'boolean' || !Number.isInteger(destination.port)) return null;
  return destination;
}

/** The facts without any alias address: what the camera port holds of its own. */
const withoutAlias = (facts: DestinationContext): DestinationContext => ({ ...facts, cameraAddresses: facts.cameraAddresses.filter((held) => !held.alias) });
/** The facts with ONE alias address supposed on the camera port, and no other. */
function supposing(facts: DestinationContext, alias: string): DestinationContext {
  return {
    ...facts,
    cameraAddresses: [...facts.cameraAddresses.filter((held) => !held.alias), { address: alias, alias: true }],
    hostAddresses: [...facts.hostAddresses.filter((held) => held !== alias), alias],
  };
}

/** The stored address of a registered camera without its port (`host` or `host:port`). What is no such text stays as it is: the rule then refuses the job. */
const hostOfStored = (stored: string): string => /^([^:]+):\d{1,5}$/.exec(stored)?.[1] ?? stored;

// ── The jobs ───────────────────────────────────────────────────────────────────────────────────

/** A job as this file keeps it. No member holds anything typed. */
export interface JobRecord {
  readonly jobId: string;
  /** The operator session that started it: no other reads it. */
  readonly owner: string;
  state: CameraNetworkJobState;
  step: CameraNetworkJobStep;
  readonly fromAddress: string;
  readonly toAddress: string;
  /** The hardware address the technician saw on the scan row: the job changes no device that states another. */
  readonly scannedMac: string;
  /** What the last scan knew of the number of devices at `fromAddress`: ONE or NOT_KNOWN (MORE_THAN_ONE never becomes a job). */
  readonly deviceCount: FactoryCameraDeviceCount;
  neighbourMac: string | null;
  authenticatedMac: string | null;
  confirmedMac: string | null;
  failure: CameraNetworkJobFailure | null;
  readonly startedAt: number;
  endedAt: number | null;
  /** Ends the job when the Core closes. */
  readonly stop: AbortController;
  /** Settles when the job has ended and its alias address was asked away. */
  ended: Promise<void>;
}

const answerOf = (job: JobRecord): CameraNetworkJob => ({
  jobId: job.jobId,
  state: job.state,
  step: job.step,
  fromAddress: job.fromAddress,
  toAddress: job.toAddress,
  scannedMac: job.scannedMac,
  deviceCount: job.deviceCount,
  neighbourMac: job.neighbourMac,
  authenticatedMac: job.authenticatedMac,
  confirmedMac: job.confirmedMac,
  // THIS JOB CHANGES NO REGISTERED CAMERA: the stored address of one is changed by operation 100, on the operator's confirmation.
  deviceId: null,
  failure: job.failure,
  startedAt: job.startedAt,
  endedAt: job.endedAt,
});

/** The jobs of one Core. `first` is where the six digits begin (the mount hands in a random one). */
export function createCameraNetworkJobs(first = 0): CameraNetworkJobs {
  const kept = new Map<string, JobRecord>();
  let next = Number.isInteger(first) && first >= 0 ? first % 1_000_000 : 0;
  return {
    mint() {
      const jobId = `CNJ-${String(next).padStart(6, '0')}`;
      next = (next + 1) % 1_000_000;
      return jobId;
    },
    put(job) {
      kept.set(job.jobId, job);
      for (const [jobId, old] of kept) {
        if (kept.size <= CAMERA_NETWORK_JOBS_KEPT) break;
        if (old.state !== CameraNetworkJobState.RUNNING) kept.delete(jobId);
      }
    },
    get: (jobId) => kept.get(jobId) ?? null,
    stop() {
      for (const job of kept.values()) if (job.state === CameraNetworkJobState.RUNNING) job.stop.abort();
    },
    async idle() {
      await Promise.all([...kept.values()].map((job) => job.ended));
    },
  };
}

// ── Asking a port under a bound ────────────────────────────────────────────────────────────────

/** One question to a port under its own time bound and the job's stop signal. The port's signal is aborted when either ends it. */
async function bounded<T>(host: CameraNetworkHost, stop: AbortSignal | null, limitMs: number, ask: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const deadline = new AbortController();
  const end = (): void => deadline.abort();
  const cancel = host.after(limitMs, end);
  stop?.addEventListener('abort', end, { once: true });
  if (stop?.aborted === true) end();
  try {
    return await ask(deadline.signal);
  } finally {
    cancel();
    stop?.removeEventListener('abort', end);
  }
}

/** Waits `delayMs` on the host's timer; ends at once when the job is stopped. */
function pause(host: CameraNetworkHost, stop: AbortSignal, delayMs: number): Promise<void> {
  return new Promise<void>((resolve) => {
    if (stop.aborted) {
      resolve();
      return;
    }
    let cancel: () => void = () => undefined;
    const wake = (): void => {
      cancel();
      stop.removeEventListener('abort', wake);
      resolve();
    };
    stop.addEventListener('abort', wake, { once: true });
    cancel = host.after(delayMs, wake);
  });
}

// ── What the technician typed, held once ───────────────────────────────────────────────────────

/** THE ONE HOLDER of what the technician typed for a job. `take` hands it out and empties the holder; `drop` empties it. */
export interface TypedAccount {
  take(): SealedCredential | null;
  drop(): void;
  /** True while the holder still holds it. */
  held(): boolean;
}

/**
 * Wraps the opaque object the route made into its one holder. The holder closes over ONE variable
 * and that variable is emptied by `take` and `drop`: once either ran, nothing of this file reaches
 * what was typed. (The two texts themselves cannot be overwritten in this runtime: what ends is
 * every reference this job has to them.)
 */
export function holdTypedAccount(value: SealedCredential | null): TypedAccount {
  return {
    take() {
      const taken = value;
      value = null;
      return taken;
    },
    drop() {
      value = null;
    },
    held: () => value !== null,
  };
}

// ── Operation 107 ──────────────────────────────────────────────────────────────────────────────

/** ONE answer for an id that is unknown, of another operator session, or of a Core that restarted since. */
export function readCameraNetworkJob(seams: CameraNetworkSeams, caller: CameraNetworkCaller, jobId: string): CameraNetworkJob {
  const job = seams.jobs.get(jobId);
  if (job === null || job.owner !== caller.sessionId) throw notFound();
  return answerOf(job);
}

// ── Operation 106 ──────────────────────────────────────────────────────────────────────────────

interface Plan {
  /** The camera's present address, as the rule rebuilt it. */
  readonly from: string;
  /** The alias address the present address is reached from, or null: it lies inside the camera subnet. */
  readonly alias: string | null;
  readonly assignment: CameraNetworkAssignment;
  readonly minutes: number;
}

/**
 * Starts ONE job. `account` holds what the technician typed, wrapped by the route: this function
 * hands the holder to the job and to nothing else, and EVERY refusal empties it unread.
 */
export async function startCameraNetworkJob(seams: CameraNetworkSeams, caller: CameraNetworkCaller, request: CameraNetworkRequest, account: TypedAccount): Promise<CameraNetworkJob> {
  const { host } = seams;
  let release: (() => void) | null = null;
  let started = false;
  try {
    if (host.sessionOpen()) throw locked();
    if (!seams.available()) throw invalidState(R.COMMISSIONING_NOT_AVAILABLE);
    const parts = seams.parts();
    // WITHOUT THE HOST'S OWN OBSERVATIONS NO JOB STARTS: the camera could not be recognised, and a taken address not seen.
    if (parts === null || parts.inputs === undefined) throw invalidState(R.COMMISSIONING_NOT_AVAILABLE);
    release = seams.scan.claim();
    if (release === null) throw invalidState(R.COMMISSIONING_JOB_IN_PROGRESS);
    const job = await prepare(seams, parts, parts.inputs, caller, request, account, release);
    started = true;
    return job;
  } finally {
    if (!started) {
      account.drop();
      release?.();
    }
  }
}

async function prepare(seams: CameraNetworkSeams, parts: CameraNetworkParts, inputs: CameraNetworkInputs, caller: CameraNetworkCaller, request: CameraNetworkRequest, account: TypedAccount, release: () => void): Promise<CameraNetworkJob> {
  const { host } = seams;
  const { camera } = parts;

  // The helper: asked whether it CAN be asked. Nothing is dialled.
  let helper: string | null;
  try {
    helper = await parts.alias.helper();
  } catch {
    host.failed(`${SOURCE}.helper`, HELPER_NOT_ASKED_TEXT, CameraNetworkCode.HELPER_NOT_ASKED, {});
    throw invalidState(R.COMMISSIONING_NOT_AVAILABLE);
  }
  if (helper === NOT_THIS_PLATFORM) throw invalidState(R.COMMISSIONING_NOT_AVAILABLE);
  if (helper !== null) throw invalidState(R.COMMISSIONING_HELPER_NOT_CONFIGURED);

  // The stored settings and the facts of the host.
  const settings = await host.settings();
  if (!settings.configured) throw invalidState(R.COMMISSIONING_NOT_CONFIGURED);
  let facts: DestinationContext | null;
  try {
    facts = host.facts();
  } catch {
    host.failed(`${SOURCE}.facts`, HOST_UNREADABLE_TEXT, CameraNetworkCode.HOST_FACTS_UNREADABLE, {});
    throw invalidState(R.COMMISSIONING_NOT_AVAILABLE);
  }
  if (facts === null || facts.cameraSubnet === null) throw invalidState(R.COMMISSIONING_NOT_CONFIGURED);
  const own = withoutAlias(facts);

  // THE PRESENT ADDRESS, through the rule: from the camera port's own address, or from ONE alias address in its /24.
  let from: string;
  let alias: string | null = null;
  const direct = judged(camera.rule, request.fromAddress, own);
  if (direct !== null && direct.viaAlias === false) from = direct.address;
  else {
    const firstThree = firstThreeOf(request.fromAddress);
    if (firstThree === null) throw addressNotAllowed();
    alias = `${firstThree}.${String(settings.aliasHost)}`;
    const through = judged(camera.rule, request.fromAddress, supposing(facts, alias));
    if (through === null || through.viaAlias !== true || through.sourceAddress !== alias) throw addressNotAllowed();
    from = through.address;
  }

  // DR-6: the present address is one the last scan listed, and that scan saw ONE device there.
  const seen = seams.scan.lastScanOf(from);
  if (seen === null) throw addressNotAllowed();
  // R119-03: a statement has an age. A scan made before another camera was plugged in says nothing of the address now;
  // a clock that went back since the scan makes the age unknown, which is "too old".
  const scanAge = host.now() - seen.scannedAt;
  if (!Number.isFinite(scanAge) || scanAge < 0 || scanAge > CAMERA_NETWORK_SCAN_MAX_AGE_MS) throw invalidState(R.CAMERA_SCAN_TOO_OLD);
  // THE THREE STATES of what the scan knew, each named. Anything that is none of the three is refused as a conflict.
  let deviceCount: FactoryCameraDeviceCount;
  switch (seen.deviceCount) {
    case FactoryCameraDeviceCount.ONE:
      deviceCount = FactoryCameraDeviceCount.ONE;
      break;
    case FactoryCameraDeviceCount.NOT_KNOWN:
      // NOT "one": the scan could not count. The job goes on ONLY bound to the hardware address the technician saw (below).
      deviceCount = FactoryCameraDeviceCount.NOT_KNOWN;
      break;
    default:
      throw invalidState(R.CAMERA_ADDRESS_CONFLICT);
  }
  // R119-04: THE BINDING. The hardware address of the request is the one the scan row showed - in its one strict form,
  // and exactly equal. A row that showed none cannot be started; this holds for ONE as for NOT_KNOWN, and without it
  // NOT_KNOWN never proceeds.
  const scannedMac = macOf(request.scannedMac);
  if (scannedMac === null || macOf(seen.mac) !== scannedMac) throw invalidState(R.CAMERA_HARDWARE_ADDRESS_NOT_BOUND);

  // The guard of that address, BEFORE anything is asked of the network: a closed guard sends nothing.
  const guard = parts.guard();
  const refusedBy = (): ApiFailure | null => {
    const refusal = guard.refusal(from, caller.sessionId);
    if (refusal === null) return null;
    return refusal.reason === CaptureDiscoveryReason.CONNECTION_TEST_IN_PROGRESS ? invalidState(R.COMMISSIONING_JOB_IN_PROGRESS) : guarded(codeOr(refusal.reason, CaptureDiscoveryReason.CONNECTION_TEST_RATE_LIMITED), refusal.retryAfterMs);
  };
  const early = refusedBy();
  if (early !== null) throw early;

  // THE NEW ADDRESS, through the rule of the written address; then nothing may answer there.
  const context = { ...own, registeredCameraAddresses: (await host.registeredAddresses()).map(hostOfStored) };
  const assignmentOf = (address: string): CameraNetworkAssignment | typeof NOT_CONFIGURED | null => {
    let decision: CameraNewAddressDecision;
    try {
      decision = camera.newAddress({ address, ...(request.gateway === undefined ? {} : { gateway: request.gateway }) }, context);
    } catch {
      return null;
    }
    if (decision === null || typeof decision !== 'object') return null;
    if (decision.allowed !== true) return decision.refusal === NOT_CONFIGURED ? NOT_CONFIGURED : null;
    const { assignment } = decision;
    return assignment !== null && typeof assignment === 'object' && typeof assignment.address === 'string' && Number.isInteger(assignment.prefixLength) && (assignment.gateway === null || typeof assignment.gateway === 'string') ? assignment : null;
  };
  // R119-06: "FREE" IS NOT ONE UNANSWERED ECHO. The host's observation (the fixed echo row and the neighbour entry, once
  // each per call) is asked `CAMERA_NETWORK_FREE_ADDRESS_ATTEMPTS` times, one after the other with a spacing, and the
  // address is free only when EVERY one said "silent". One "taken" is taken at once. All of it ends inside ONE bound of
  // time; what is not settled by then, a clock that went back, and an observation that throws are "not known" - refused.
  const never = new AbortController().signal;
  const taken = async (address: string): Promise<boolean> => {
    const since = host.now();
    try {
      for (let attempt = 1; ; attempt += 1) {
        const elapsed = host.now() - since;
        const left = CAMERA_NETWORK_FREE_ADDRESS_TOTAL_MS - elapsed;
        if (!Number.isFinite(elapsed) || elapsed < 0 || left <= 0) throw new Error('not settled inside the bound');
        if ((await bounded(host, null, Math.min(CAMERA_NETWORK_ASK_TIMEOUT_MS, left), (signal) => inputs.answers(address, signal))) !== false) return true;
        if (attempt >= CAMERA_NETWORK_FREE_ADDRESS_ATTEMPTS) return false;
        await pause(host, never, CAMERA_NETWORK_FREE_ADDRESS_SPACING_MS);
      }
    } catch {
      // Not known is not "free": the job is refused rather than started on a guess.
      host.failed(`${SOURCE}.answers`, INPUT_FAILED_TEXT, CameraNetworkCode.INPUT_FAILED, {});
      throw invalidState(R.COMMISSIONING_NOT_AVAILABLE);
    }
  };
  let assignment: CameraNetworkAssignment | null = null;
  if (request.toAddress !== undefined) {
    const typed = assignmentOf(request.toAddress);
    if (typed === NOT_CONFIGURED) throw invalidState(R.COMMISSIONING_NOT_CONFIGURED);
    if (typed === null || typed.address === from) throw addressNotAllowed();
    if (await taken(typed.address)) throw invalidState(R.CAMERA_NEW_ADDRESS_IN_USE);
    assignment = typed;
  } else {
    // The next free address from the configured first one: `<the camera subnet's first three parts>.<start>` upwards.
    const firstThree = firstThreeOf(facts.cameraSubnet.network);
    let asked = 0;
    for (let part = settings.cameraIpStart; firstThree !== null && part <= 254 && asked < CAMERA_NETWORK_NEXT_FREE_MAX_ASKED && assignment === null; part += 1) {
      const candidate = assignmentOf(`${firstThree}.${String(part)}`);
      if (candidate === NOT_CONFIGURED) throw invalidState(R.COMMISSIONING_NOT_CONFIGURED);
      // The gateway of the request is judged with every candidate: one the rule refuses for it is refused as typed.
      if (candidate === null || candidate.address === from) continue;
      asked += 1;
      if (!(await taken(candidate.address))) assignment = candidate;
    }
    if (assignment === null) {
      // A gateway the rule refuses makes EVERY candidate refused: that is the gateway's refusal, not a full subnet.
      if (asked === 0 && request.gateway !== undefined) throw addressNotAllowed();
      throw invalidState(R.CAMERA_NO_FREE_ADDRESS);
    }
  }

  // THE TURN OF THE GUARD, taken in the same turn of the event loop in which it is asked again (a session may have opened meanwhile).
  if (host.sessionOpen()) throw locked();
  const late = refusedBy();
  if (late !== null) throw late;
  const turn = guard.begin(from, caller.sessionId);

  const job: JobRecord = {
    jobId: seams.jobs.mint(),
    owner: caller.sessionId,
    state: CameraNetworkJobState.RUNNING,
    step: CameraNetworkJobStep.REACHING,
    fromAddress: from,
    toAddress: assignment.address,
    scannedMac,
    deviceCount,
    neighbourMac: null,
    authenticatedMac: null,
    confirmedMac: null,
    failure: null,
    startedAt: host.now(),
    endedAt: null,
    stop: new AbortController(),
    ended: Promise.resolve(),
  };
  // THE INTENT, before anything is asked of the helper or of the camera: a Core that dies during the job leaves this entry.
  try {
    await host.audit({
      type: AuditType.CAMERA_NETWORK_SET,
      message: CAMERA_NETWORK_REQUESTED_MESSAGE,
      actorId: caller.operatorId,
      deviceId: caller.deviceId,
      // `deviceCount`: what the scan KNEW (R119-03) - an entry of a job that ran on NOT_KNOWN says that the count was not made.
      details: { phase: 'REQUESTED', fromAddress: job.fromAddress, toAddress: job.toAddress, deviceCount: job.deviceCount, operationId: CAMERA_NETWORK_SET_OPERATION_ID, permission: Permission.CAPTURE_COMMISSION },
    });
  } catch (error) {
    turn.abandon();
    throw error;
  }
  seams.jobs.put(job);
  const answer = answerOf(job);
  job.ended = run(seams, parts, inputs, caller, job, { from, alias, assignment, minutes: settings.aliasMinutes }, turn, account, release);
  return answer;
}

/**
 * THE JOB. It never rejects. `account` is the ONE holder of what the technician typed: it is
 * emptied when the set call takes it, again when that call ends, and again in the `finally` of
 * this function, whatever happened.
 */
async function run(
  seams: CameraNetworkSeams,
  parts: CameraNetworkParts,
  inputs: CameraNetworkInputs,
  caller: CameraNetworkCaller,
  job: JobRecord,
  plan: Plan,
  turn: CameraNetworkGuardTurn,
  account: TypedAccount,
  release: () => void,
): Promise<void> {
  const { host } = seams;
  const { camera } = parts;
  const stop = job.stop.signal;
  const subject: CameraNetworkAliasSubject = { operatorId: caller.operatorId, deviceId: caller.deviceId, reason: HostAliasReason.SET_CAMERA_ADDRESS, operationId: CAMERA_NETWORK_SET_OPERATION_ID, permission: Permission.CAPTURE_COMMISSION };
  let turnOpen = true;
  let guardTripped = false;
  /** The alias address that may be on the camera port because of THIS job. */
  let aliasToRemove: string | null = null;
  const counts = { polls: 0, pollFailures: 0, inputFailures: 0, removalsNotConfirmed: 0 };

  const facts = (): DestinationContext | null => {
    try {
      return host.facts();
    } catch {
      host.failed(`${SOURCE}.facts`, HOST_UNREADABLE_TEXT, CameraNetworkCode.HOST_FACTS_UNREADABLE, {});
      return null;
    }
  };
  const polled = async (destination: CameraNetworkDestination): Promise<boolean> => {
    counts.polls += 1;
    try {
      return (await bounded(host, stop, CAMERA_NETWORK_ASK_TIMEOUT_MS, (signal) => camera.poll(destination, signal)))?.answered === true;
    } catch {
      // What was thrown is NOT read: it may hold a device's words.
      counts.pollFailures += 1;
      return false;
    }
  };
  const neighbourOf = async (address: string): Promise<string | null> => {
    try {
      return macOf(await bounded(host, stop, CAMERA_NETWORK_ASK_TIMEOUT_MS, (signal) => inputs.neighbour(address, signal)));
    } catch {
      counts.inputFailures += 1;
      return null;
    }
  };
  const removeAlias = async (): Promise<void> => {
    const address = aliasToRemove;
    if (address === null) return;
    aliasToRemove = null;
    let removed: CameraNetworkAliasOutcome | null = null;
    try {
      removed = await parts.alias.remove({ address, subject });
    } catch {
      removed = null;
    }
    if (!(removed !== null && typeof removed === 'object' && removed.refusal === null && removed.effect === DONE)) {
      counts.removalsNotConfirmed += 1;
      host.failed(`${SOURCE}.alias`, REMOVAL_NOT_CONFIRMED_TEXT, CameraNetworkCode.ALIAS_REMOVAL_NOT_CONFIRMED, { aliasWord: codeOr(removed?.refusal, 'ALIAS_CALL_FAILED') });
    }
  };

  /** The steps: the failure of the job, or null when the SAME hardware address answered at the new address. */
  const steps = async (): Promise<CameraNetworkJobFailure | null> => {
    // ── REACHING ──
    if (plan.alias !== null) {
      let outcome: CameraNetworkAliasOutcome | null = null;
      try {
        outcome = await parts.alias.add({ address: plan.alias, minutes: plan.minutes, subject });
      } catch {
        outcome = null;
      }
      const confirmed = outcome !== null && typeof outcome === 'object' && outcome.refusal === null && outcome.effect === DONE;
      // Asked away on EVERY way out once `add` was called - unless `add` itself said that it certainly changed nothing.
      if (!(outcome !== null && typeof outcome === 'object' && outcome.effect === NOT_DONE)) aliasToRemove = plan.alias;
      if (!confirmed) {
        host.failed(`${SOURCE}.alias`, ALIAS_NOT_CONFIRMED_TEXT, CameraNetworkCode.ALIAS_NOT_CONFIRMED, { aliasWord: codeOr(outcome?.refusal, 'ALIAS_NOT_CONFIRMED') });
        return F.HOST_ALIAS_FAILED;
      }
    }
    if (stop.aborted) return F.CORE_RESTARTED;
    // The helper said "in place": the host must say so too - the rule, on the facts the host states NOW.
    const live = facts();
    const present = live === null ? null : judged(camera.rule, plan.from, live);
    if (live === null || present === null || present.viaAlias !== (plan.alias !== null) || (plan.alias !== null && present.sourceAddress !== plan.alias)) {
      if (plan.alias === null) return F.CAMERA_UNREACHABLE;
      host.failed(`${SOURCE}.alias`, ALIAS_NOT_CONFIRMED_TEXT, CameraNetworkCode.ALIAS_NOT_CONFIRMED, { aliasWord: 'ALIAS_NOT_IN_PLACE' });
      return F.HOST_ALIAS_FAILED;
    }
    // THE UNAUTHENTICATED POLL FIRST (S13-04 (a)): nothing typed is sent to an address that does not answer as an ONVIF device.
    if (!(await polled(present))) {
      if (stop.aborted) return F.CORE_RESTARTED;
      let anything = false;
      try {
        anything = (await bounded(host, stop, CAMERA_NETWORK_ASK_TIMEOUT_MS, (signal) => inputs.answers(plan.from, signal))) === true;
      } catch {
        counts.inputFailures += 1;
      }
      return anything ? F.ONVIF_NOT_ENABLED : F.CAMERA_UNREACHABLE;
    }

    // ── IDENTIFYING: the hardware address the HOST saw, before anything is sent with the typed account ──
    job.step = CameraNetworkJobStep.IDENTIFYING;
    job.neighbourMac = await neighbourOf(plan.from);
    if (stop.aborted) return F.CORE_RESTARTED;
    // No address of the neighbour table: the camera cannot be recognised, so nothing is set.
    if (job.neighbourMac === null) return F.MAC_MISMATCH;
    // R119-04: THE HOST NOW SEES ANOTHER DEVICE THAN THE ONE THE TECHNICIAN SAW. The job ends here, BEFORE the typed
    // account is used and before any request that carries it. (An entry that changed between two readings is also the
    // first sign of two devices on one address.)
    if (job.neighbourMac !== job.scannedMac) return F.MAC_MISMATCH;
    if (host.sessionOpen()) {
      host.failed(`${SOURCE}.session`, SESSION_OPENED_TEXT, CameraNetworkCode.SESSION_OPENED, {});
      return F.SET_REFUSED;
    }

    // ── SETTING: THE ONE CALL with the typed account ──
    job.step = CameraNetworkJobStep.SETTING;
    if (!account.held()) return F.SET_REFUSED;
    /** In a function of its own: when it returns, no variable of this job names what was typed. */
    const setOnce = async (): Promise<CameraNetworkSetAnswer | null> => {
      const used = account.take();
      if (used === null) return null;
      try {
        return await bounded(host, stop, CAMERA_NETWORK_SET_DEADLINE_MS, (signal) =>
          camera.set({
            address: present.address,
            facts: live,
            assignment: plan.assignment,
            credential: used,
            // The device's own statement must be the address the host saw AND the address the technician saw on the scan
            // row (R119-04: the technician's value is bound HERE, in the hook of the set-network file); if not, NO set
            // request is made (S13-12 (d)).
            admitHwAddress(reported) {
              job.authenticatedMac = macOf(reported);
              return job.authenticatedMac !== null && job.authenticatedMac === job.scannedMac && job.authenticatedMac === job.neighbourMac;
            },
            signal,
          }),
        );
      } catch {
        return null;
      } finally {
        // THE END OF WHAT WAS TYPED: nothing of this job holds it from here on.
        account.drop();
      }
    };
    const answer = await setOnce();
    const outcome = answer !== null && typeof answer === 'object' && (answer.outcome === 'SET' || answer.outcome === 'NOT_SET' || answer.outcome === 'UNKNOWN') ? answer.outcome : null;
    const reason = outcome === null ? null : codeOr(answer?.reason, '');
    const rejected = outcome !== null && Number.isInteger(answer?.rejectedCredentialRequests) && (answer?.rejectedCredentialRequests ?? 0) > 0 ? (answer?.rejectedCredentialRequests ?? 0) : 0;
    const refusedSignIn = reason === 'CREDENTIAL_REFUSED' || reason === 'SCHEME_NOT_ALLOWED';
    // THE GUARD: this job spends from the ONE count of the camera's address. An answer of no form is "not known", which counts.
    turnOpen = false;
    if (outcome === null) {
      guardTripped = turn.end(CaptureConnectionOutcome.AUTHENTICATION_FAILED, null).guardTripped;
      host.failed(`${SOURCE}.set`, SET_CALL_FAILED_TEXT, CameraNetworkCode.SET_CALL_FAILED, {});
    } else if (rejected > 0 || refusedSignIn) guardTripped = turn.end(CaptureConnectionOutcome.AUTHENTICATION_FAILED, rejected).guardTripped;
    else if (outcome === 'SET') turn.end(CaptureConnectionOutcome.REACHABLE, 0);
    else turn.end(CaptureConnectionOutcome.UNREACHABLE, 0);

    // The alias address was for the present address only: it is asked away before the wait.
    await removeAlias();
    if (outcome === 'NOT_SET') {
      if (reason === 'HW_ADDRESS_REFUSED') return F.MAC_MISMATCH;
      if (refusedSignIn) return F.AUTHENTICATION_FAILED;
      return reason === 'NO_ANSWER' || reason === 'DEADLINE' ? F.CAMERA_UNREACHABLE : F.SET_REFUSED;
    }
    if (stop.aborted) return F.CORE_RESTARTED;

    // ── WAITING: the SAME hardware address at the new address, asked without anything typed ──
    job.step = CameraNetworkJobStep.WAITING;
    const since = host.now();
    for (;;) {
      const now = facts();
      const moved = now === null ? null : judged(camera.rule, plan.assignment.address, withoutAlias(now));
      if (moved !== null && moved.viaAlias === false && (await polled(moved))) {
        const seen = await neighbourOf(plan.assignment.address);
        if (seen !== null) {
          job.confirmedMac = seen;
          if (seen === job.authenticatedMac) return null;
        }
      }
      if (stop.aborted) return F.CORE_RESTARTED;
      const elapsed = host.now() - since;
      if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed + CAMERA_NETWORK_SET_POLL_MS > CAMERA_NETWORK_SET_WAIT_MS) break;
      await pause(host, stop, CAMERA_NETWORK_SET_POLL_MS);
      if (stop.aborted) return F.CORE_RESTARTED;
    }
    // A set that was sent and never answered, and no camera at the new address: the set is not known to have happened.
    return outcome === null || outcome === 'UNKNOWN' ? F.SET_REFUSED : F.NOT_FOUND_AT_NEW_ADDRESS;
  };

  let failure: CameraNetworkJobFailure | null = F.SET_REFUSED;
  try {
    failure = await steps();
  } catch {
    // What was thrown is NOT read. The job ends as failed; the code says that the fault was the Core's.
    failure = stop.aborted ? F.CORE_RESTARTED : F.SET_REFUSED;
    host.failed(`${SOURCE}.job`, JOB_FAULT_TEXT, CameraNetworkCode.JOB_FAULT, {});
  } finally {
    // ON EVERY WAY OUT: what was typed is let go, the turn of the guard is given back, the alias address is asked away.
    account.drop();
    if (turnOpen) {
      turnOpen = false;
      try {
        turn.abandon();
      } catch {
        // The turn was ended by the step that threw.
      }
    }
    await removeAlias();
    job.failure = failure;
    job.state = failure === null ? CameraNetworkJobState.COMPLETED : CameraNetworkJobState.FAILED;
    job.step = CameraNetworkJobStep.DONE;
    job.endedAt = host.now();
    const mac = job.confirmedMac ?? job.authenticatedMac;
    try {
      await host.audit({
        type: AuditType.CAMERA_NETWORK_SET,
        message: failure === null ? CAMERA_NETWORK_COMPLETED_MESSAGE : CAMERA_NETWORK_FAILED_MESSAGE,
        actorId: caller.operatorId,
        deviceId: caller.deviceId,
        details: {
          phase: failure === null ? 'COMPLETED' : 'FAILED',
          fromAddress: job.fromAddress,
          toAddress: job.toAddress,
          deviceCount: job.deviceCount,
          ...(mac === null ? {} : { mac }),
          ...(failure === null ? {} : { failureReason: failure }),
          ...(guardTripped ? { guardTripped: true } : {}),
          operationId: CAMERA_NETWORK_SET_OPERATION_ID,
          permission: Permission.CAPTURE_COMMISSION,
        },
      });
    } catch {
      host.failed(`${SOURCE}.audit`, AUDIT_NOT_WRITTEN_TEXT, CameraNetworkCode.AUDIT_NOT_WRITTEN, {});
    }
    // Said once each, as counts: what a port threw was never read.
    if (counts.pollFailures > 0) host.failed(`${SOURCE}.poll`, POLL_FAILED_TEXT, CameraNetworkCode.POLL_FAILED, { pollFailures: counts.pollFailures });
    if (counts.inputFailures > 0) host.failed(`${SOURCE}.inputs`, INPUT_FAILED_TEXT, CameraNetworkCode.INPUT_FAILED, { inputFailures: counts.inputFailures });
    host.note(
      { code: AuditType.CAMERA_NETWORK_SET, source: SOURCE, jobId: job.jobId, outcome: failure === null ? 'COMPLETED' : 'FAILED', failureReason: failure, guardTripped, aliasUsed: plan.alias !== null, ...counts },
      JOB_ENDED_TEXT,
    );
    release();
  }
}
