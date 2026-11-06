/**
 * The operator-confirmed RE-ADDRESS of a registered camera (task 4 blueprint row 97, WP-12;
 * decision register NEW-1 as answered by U12 A7; `masterplan/01_specs.md` fork F-5 "Following a
 * camera whose address changed"; findings SEC35-28, S13-11; AD-02).
 *
 * WHAT IT IS. A search can list a candidate that IS a registered camera by its endpoint reference
 * and answers from another address than the stored one (`addressChanged`). The reference
 * application followed such a camera by itself. The Core never does: a probe answer is forgeable,
 * and re-pointing a registered camera silently would send its stored credential to whoever
 * answered. Here an OPERATOR looks at the target, confirms it, and the Core then stores the new
 * address with ONE audit entry (`CAPTURE_DEVICE_ADDRESS_CHANGED`, reason `OPERATOR_CONFIRMED`).
 *
 * NEVER AUTOMATIC, and how that is held:
 *   1. the function takes an `OperatorReaddressConfirmation`, which only
 *      `operatorReaddressConfirmation` makes (a private brand) - and that maker has ONE production
 *      caller: the route edge of operation 100, which makes it from the body of the request it
 *      answers (`readdress-route.ts`, row 197; static rule 6 of this folder: the list of callers
 *      is closed and holds that one file);
 *   2. the caller is an OPERATOR session (`ReaddressCaller`), never the search, a timer or a tick;
 *   3. the confirmation names the address the operator SAW: it must equal the address the
 *      candidate holds NOW, so a list that changed under the dialog confirms nothing;
 *   4. the search, the store and the registered matcher of this folder do not import this file.
 *
 * WHAT IS HELD BEFORE ANYTHING IS WRITTEN (each a named refusal, nothing written, no audit entry):
 *   - no session is open (the selector's idle lock, as adoption);
 *   - the candidate is of the caller's own live search, is REGISTERED as the confirmed device BY
 *     ENDPOINT REFERENCE with a changed address, and is not in an identity conflict (two devices
 *     announcing one reference - SEC35-28);
 *   - the new address passes the DESTINATION RULE for a stored camera (`capture/destination-rule`,
 *     AD-02: loopback, public, the host's own and every other interface's subnet are refused) -
 *     through the seam `addressRule`, which the composition binds to the host's facts;
 *   - no other registered device holds the new address; the stored one differs from it.
 *
 * WHAT IT WRITES, in ONE unit of the engine: the device's address (through the seam
 * `readdresser`, the engine's own door - this folder holds no statement for it, static rule 3) and
 * the audit entry. Either both or neither. The stored credential stays with the device: the
 * operator confirmed that the camera is the same one.
 *
 * WIRED BY ROW 197 (`readdress-route.ts`): operation 100 `confirmCaptureDeviceAddress` of the
 * contract (row 194) calls this file with its three seams - the caller's own candidate directory,
 * the fence's binding of the destination rule on the injected network facts, and the engine's
 * door `readdressCaptureDeviceIn` (row 196). A seam that is absent answers `NOT_READY`; a rule
 * without facts refuses every address.
 *
 * Nothing here reads or holds a credential. No log line carries an address or an endpoint
 * reference: the audit entry carries the two IP literals, as its closed detail rule states.
 */
import { CAPTURE_HOST_LITERAL_PATTERN } from '@dems/shared/api';
import { AuditType, Permission, isSessionActive } from '@dems/shared/sim';
import type { CameraCandidate } from '../../capture/adapters';
import type { AuditEntry } from '../../core';
import type { DurableSlices } from '../../db/mapping';
import type { EngineOutcome, EngineUnit } from '../../engine';
import type { Principal } from '../../plugins/authenticate';

// ── What is refused, by name ───────────────────────────────────────────────────────────────────

export const ReaddressRefusal = {
  /** No confirmation of an operator was handed in. The answer of every call that is not an operator's act. */
  NOT_CONFIRMED: 'READDRESS_NOT_CONFIRMED',
  /** A seam is not provided: the candidate state, the destination rule or the engine's door. */
  NOT_READY: 'READDRESS_NOT_READY',
  /** A session is open: the capture configuration is locked. */
  CAPTURE_LOCKED: 'READDRESS_CAPTURE_LOCKED',
  /** Unknown, expired or of another operator session's search: one answer for all three. */
  CANDIDATE_UNKNOWN: 'READDRESS_CANDIDATE_UNKNOWN',
  /** The candidate is not the confirmed device by endpoint reference with a changed address. */
  NOT_THE_REGISTERED_CAMERA: 'READDRESS_NOT_THE_REGISTERED_CAMERA',
  /** Two devices announce this identity: neither is followed. */
  IDENTITY_CONFLICT: 'READDRESS_IDENTITY_CONFLICT',
  /** The address the operator confirmed is not the one the candidate holds now. */
  CONFIRMATION_MISMATCH: 'READDRESS_CONFIRMATION_MISMATCH',
  /** The destination rule refused the new address; `rule` names its refusal. */
  ADDRESS_NOT_ALLOWED: 'READDRESS_ADDRESS_NOT_ALLOWED',
  /** The registry has no such camera. */
  DEVICE_UNKNOWN: 'READDRESS_DEVICE_UNKNOWN',
  /** The stored address already is the new one. */
  ADDRESS_UNCHANGED: 'READDRESS_ADDRESS_UNCHANGED',
  /** Another registered device holds the new address. */
  ADDRESS_TAKEN: 'READDRESS_ADDRESS_TAKEN',
  /** The stored address is no IP literal: the audit entry could not state it. */
  STORED_ADDRESS_UNREADABLE: 'READDRESS_STORED_ADDRESS_UNREADABLE',
} as const;
export type ReaddressRefusal = (typeof ReaddressRefusal)[keyof typeof ReaddressRefusal];

/** The reason code of the audit entry: an operator confirmed the target. The set-IP job writes its own (`SET_CAMERA_ADDRESS`). */
export const READDRESS_AUDIT_REASON = 'OPERATOR_CONFIRMED';
/** The operation of the contract an operator confirms through (row 194, operation 100): the `operationId` of the audit entry, as the sibling entries of this module carry theirs. */
export const READDRESS_OPERATION_ID = 'confirmCaptureDeviceAddress';
/** The label of the engine unit. */
export const READDRESS_UNIT_LABEL = 'captureReaddress.confirm';
const SOURCE = 'captureReaddress';
const RULE_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;
/** What stands for a rule answer that names no code. */
export const READDRESS_RULE_FAILED = 'RULE_FAILED';

/** A refusal: thrown, so that a unit it happens in rolls back. Its text names the rule, never an address. */
export class ReaddressRefused extends Error {
  readonly code: ReaddressRefusal;
  /** The destination rule's own refusal code, for `ADDRESS_NOT_ALLOWED` only. */
  readonly rule: string | null;
  constructor(code: ReaddressRefusal, rule: string | null = null) {
    super(`the address of a registered camera was not changed: ${code}`);
    this.name = 'ReaddressRefused';
    this.code = code;
    this.rule = rule;
  }
}

// ── The confirmation of ONE request ────────────────────────────────────────────────────────────

const OPERATOR_CONFIRMED = Symbol('an operator confirmed the new address of a registered camera in this request');

/** What the operator confirmed. Made by `operatorReaddressConfirmation` at a route edge and by nothing else. */
export interface OperatorReaddressConfirmation {
  readonly [OPERATOR_CONFIRMED]: true;
  /** The registered camera. */
  readonly deviceId: string;
  /** The candidate of the operator's own search that answers for it. */
  readonly candidateId: string;
  /** The address the dialog SHOWED and the operator confirmed: `host`, or `host:port`. */
  readonly address: string;
}

/**
 * THE ROUTE EDGE: the confirmation in the body of an operator's request. The one maker of an
 * `OperatorReaddressConfirmation`; static rule 6 of this folder holds its production callers to a
 * closed list.
 */
export function operatorReaddressConfirmation(body: { readonly deviceId: string; readonly candidateId: string; readonly address: string }): OperatorReaddressConfirmation {
  return Object.freeze({ [OPERATOR_CONFIRMED]: true as const, deviceId: body.deviceId, candidateId: body.candidateId, address: body.address });
}

function isConfirmation(value: unknown): value is OperatorReaddressConfirmation {
  if (typeof value !== 'object' || value === null) return false;
  const held = value as Partial<OperatorReaddressConfirmation>;
  return held[OPERATOR_CONFIRMED] === true && typeof held.deviceId === 'string' && typeof held.candidateId === 'string' && typeof held.address === 'string';
}

// ── Seams ──────────────────────────────────────────────────────────────────────────────────────

/** A candidate of the caller's own live search, as far as a re-address reads it (`store.ts` `HeldCandidate`). */
export interface ReaddressCandidate {
  readonly candidateId: string;
  readonly searchId: string;
  readonly camera: Pick<CameraCandidate, 'host' | 'serviceAddress' | 'endpointRef' | 'conflict'>;
  /** The registered device this candidate matches, or null. */
  readonly registeredDeviceId: string | null;
  /** REGISTERED by endpoint reference while the answering address differs from the stored one. */
  readonly addressChanged: boolean;
}

/** THE SEAM TO THE CANDIDATE STATE: data of ONE operator session, in memory. */
export interface ReaddressCandidates {
  /** Null for an id that is unknown, expired or of another session's search. */
  find(sessionId: string, candidateId: string): ReaddressCandidate | null;
}

/** The destination rule's answer, as far as it is read: allowed is the literal `true` and nothing else. */
export type ReaddressRuleDecision = { readonly allowed: true } | { readonly allowed: false; readonly refusal: string };

/**
 * THE SEAM TO THE DESTINATION RULE (AD-02): `decideDestination` with the purpose `STORED_CAMERA`,
 * bound to the host's facts by the composition. `port` is left out when the address names none.
 */
export type ReaddressRule = (host: string, port: number | undefined) => ReaddressRuleDecision;

/**
 * THE SEAM TO THE ENGINE'S REGISTRY: changes the address of a registered camera in the replicated
 * `captureDevices` slice INSIDE the caller's unit (the durable mapping then writes
 * `capture_devices.address` in the same transaction). Throws to roll the unit back.
 */
export type DeviceReaddresser = (scope: EngineUnit, change: { readonly deviceId: string; readonly address: string; readonly at: number }) => Promise<void>;

/** What the flow needs of the app. A test hands in doubles. */
export interface ReaddressHost {
  now(): number;
  /** The committed replicated state (`app.engine.state`). */
  state(): Pick<DurableSlices, 'session' | 'captureDevices'>;
  /** One unit of the engine (`app.engine.run`). */
  engineUnit<Value>(label: string, work: (scope: EngineUnit) => Promise<Value>): Promise<EngineOutcome<Value>>;
  /** Codes and counts only: never an address, never an endpoint reference. */
  note(fields: Readonly<Record<string, string | number | boolean | null>>, message: string): void;
}

export interface ReaddressSeams {
  readonly host: ReaddressHost;
  candidates(): ReaddressCandidates | null;
  addressRule(): ReaddressRule | null;
  readdresser(): DeviceReaddresser | null;
}

/** Who asked: the operator's session, never a request field. */
export interface ReaddressCaller {
  readonly principal: Extract<Principal, { kind: 'OPERATOR' }>;
}

/** What a confirmed re-address answers. The two addresses are the stored forms (`host`, or `host:port`). */
export interface ConfirmedReaddress {
  readonly deviceId: string;
  readonly fromAddress: string;
  readonly toAddress: string;
}

// ── Addresses ──────────────────────────────────────────────────────────────────────────────────

/** Host, or host and port when the service address names a port: what adoption stores (`connect/service.ts`). */
export function readdressTargetOf(camera: Pick<CameraCandidate, 'host' | 'serviceAddress'>): { readonly address: string; readonly host: string; readonly port: number | undefined } {
  let port = '';
  try {
    port = camera.serviceAddress === null ? '' : new URL(camera.serviceAddress).port;
  } catch {
    port = '';
  }
  return port === '' ? { address: camera.host, host: camera.host, port: undefined } : { address: `${camera.host}:${port}`, host: camera.host, port: Number(port) };
}

/** The IP literal of a stored address (`host`, or `host:port` for a dotted quad), or null when it is none. */
export function storedHostLiteral(address: string): string | null {
  const dotted = /^(\d{1,3}(?:\.\d{1,3}){3})(?::\d{1,5})?$/.exec(address);
  const host = dotted === null ? address : (dotted[1] ?? address);
  return CAPTURE_HOST_LITERAL_PATTERN.test(host) ? host : null;
}

function ruleRefusalOf(decision: unknown): string | null {
  if (typeof decision === 'object' && decision !== null && (decision as { allowed?: unknown }).allowed === true) return null;
  const refusal = typeof decision === 'object' && decision !== null ? (decision as { refusal?: unknown }).refusal : undefined;
  return typeof refusal === 'string' && RULE_CODE.test(refusal) ? refusal : READDRESS_RULE_FAILED;
}

// ── The one function ───────────────────────────────────────────────────────────────────────────

/**
 * Stores the confirmed new address of a registered camera and writes its audit entry, in one unit.
 * Throws `ReaddressRefused` for everything the file comment lists; then nothing was written.
 */
export async function confirmCameraReaddress(seams: ReaddressSeams, caller: ReaddressCaller, confirmation: OperatorReaddressConfirmation): Promise<ConfirmedReaddress> {
  const { host } = seams;
  const refuse = (code: ReaddressRefusal, rule: string | null = null): ReaddressRefused => {
    host.note({ code, source: SOURCE, ...(rule === null ? {} : { rule }) }, 'camera re-address refused');
    return new ReaddressRefused(code, rule);
  };

  // 1. An operator's confirmation, or nothing happens.
  if (!isConfirmation(confirmation) || caller?.principal?.kind !== 'OPERATOR') throw refuse(ReaddressRefusal.NOT_CONFIRMED);
  if (isSessionActive(host.state().session)) throw refuse(ReaddressRefusal.CAPTURE_LOCKED);
  const directory = seams.candidates();
  const rule = seams.addressRule();
  const readdresser = seams.readdresser();
  if (directory === null || rule === null || readdresser === null) throw refuse(ReaddressRefusal.NOT_READY);

  // 2. The candidate of the caller's OWN search, registered as this device by its endpoint reference.
  const candidate = directory.find(caller.principal.sessionId, confirmation.candidateId);
  if (candidate === null) throw refuse(ReaddressRefusal.CANDIDATE_UNKNOWN);
  if (candidate.camera.conflict) throw refuse(ReaddressRefusal.IDENTITY_CONFLICT);
  if (candidate.registeredDeviceId !== confirmation.deviceId || candidate.addressChanged !== true || candidate.camera.endpointRef === null) {
    throw refuse(ReaddressRefusal.NOT_THE_REGISTERED_CAMERA);
  }

  // 3. The address the operator saw IS the address the candidate holds now.
  const target = readdressTargetOf(candidate.camera);
  if (confirmation.address !== target.address) throw refuse(ReaddressRefusal.CONFIRMATION_MISMATCH);

  // 4. The destination rule, before anything is written. A rule that throws allows nothing.
  let decision: unknown;
  try {
    decision = rule(target.host, target.port);
  } catch {
    throw refuse(ReaddressRefusal.ADDRESS_NOT_ALLOWED, READDRESS_RULE_FAILED);
  }
  const ruleRefusal = ruleRefusalOf(decision);
  if (ruleRefusal !== null) throw refuse(ReaddressRefusal.ADDRESS_NOT_ALLOWED, ruleRefusal);
  const toLiteral = storedHostLiteral(target.address);
  if (toLiteral === null) throw refuse(ReaddressRefusal.ADDRESS_NOT_ALLOWED, READDRESS_RULE_FAILED);

  // 5. ONE UNIT: the address and its audit entry. Anything thrown rolls both back.
  const { deviceId } = confirmation;
  const outcome = await host.engineUnit(READDRESS_UNIT_LABEL, async (scope) => {
    const before = scope.pending();
    if (isSessionActive(before.session)) throw refuse(ReaddressRefusal.CAPTURE_LOCKED);
    const device = before.captureDevices.devices.find((entry) => entry.id === deviceId && entry.kind === 'CAMERA');
    if (device === undefined) throw refuse(ReaddressRefusal.DEVICE_UNKNOWN);
    const fromAddress = device.host;
    if (fromAddress === target.address) throw refuse(ReaddressRefusal.ADDRESS_UNCHANGED);
    if (before.captureDevices.devices.some((entry) => entry.id !== deviceId && entry.host === target.address)) throw refuse(ReaddressRefusal.ADDRESS_TAKEN);
    const fromLiteral = typeof fromAddress === 'string' ? storedHostLiteral(fromAddress) : null;
    if (typeof fromAddress !== 'string' || fromLiteral === null) throw refuse(ReaddressRefusal.STORED_ADDRESS_UNREADABLE);
    await readdresser(scope, { deviceId, address: target.address, at: host.now() });
    const entry: AuditEntry = {
      type: AuditType.CAPTURE_DEVICE_ADDRESS_CHANGED,
      message: 'Camera address changed',
      actorId: caller.principal.operatorId,
      deviceId,
      // The two IP literals and the code for why: no port, no endpoint reference, no announced text.
      details: { deviceId, fromAddress: fromLiteral, toAddress: toLiteral, reason: READDRESS_AUDIT_REASON, operationId: READDRESS_OPERATION_ID, permission: Permission.CAPTURE_CONFIG },
    };
    await scope.unit.audit.append(entry);
    return { deviceId, fromAddress, toAddress: target.address };
  });
  host.note({ code: AuditType.CAPTURE_DEVICE_ADDRESS_CHANGED, source: SOURCE, deviceId, reason: READDRESS_AUDIT_REASON, epoch: outcome.epoch, revision: outcome.revision }, 'camera address changed by an operator');
  return outcome.value;
}
