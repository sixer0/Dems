/**
 * The credential-gated connect flow of the Core (blueprint row 142; requirement R-9 AC-5 to AC-11;
 * contract C3 §2.6 operations 95 and 96, "Adoption and operation 89", §5.2; capture spec §A.6.2,
 * §A.6.3; decisions D76, D80(3), D80(7), D81, D82, D86 C-2 / C-3 / C-6, D103; SEC35-31 to
 * SEC35-38, SEC35-46, SEC35-47).
 *
 *   testCandidate      operation 95: one read-only connection test of a candidate
 *   adoptCandidate     operation 96: re-verification, then ONE transaction
 *   setCredential      operation 89: the credential of a registered camera, set or replaced
 *
 * NO CONNECTION TEST WITHOUT AN OPERATOR-ENTERED CREDENTIAL - BY CONSTRUCTION. A device is
 * contacted in exactly one function of this file, `contact`, and that function takes a
 * `ContactPermit`. A permit is made in exactly one function, `permitFor`, from the credential of
 * THIS request's body (an `OperatorCredential`, made at the route edge and nowhere else) - or,
 * for a DEVELOPMENT candidate only, from nothing. A PRODUCTION candidate without a credential gets
 * no permit (`422 CREDENTIAL_REQUIRED`). This file reads no store, no configuration and no other
 * device's entry: there is no code path from a stored or a default value to `contact`. A static
 * test holds the two call sites.
 *
 * THE CREDENTIAL LIVES FOR ONE REQUEST (CR-1, SEC35-34). It arrives sealed (an opaque object that
 * prints a fixed mark), is opened twice at most - by the connection test, and by the store write
 * of operations 96 and 89 - and is a member of nothing that outlives the call: not of the
 * candidate, not of the limits, not of a log line, an audit row, an error or an answer. It cannot
 * be erased from memory; no zeroing is claimed.
 *
 * EVERY REFUSAL COMES BEFORE A REQUEST (C3 §2.6). The order of each operation is the contract's;
 * a refusal by lock, state, validation or limit makes 0 outbound requests and writes no audit
 * row. An access refusal is stage 6's and never reaches this file.
 *
 * WHAT IS AUDITED. One `CAPTURE_CONNECTION_TESTED` row per attempt, for EVERY outcome, by
 * operation 95 and by the re-verification of operation 96 - written in a unit of its own as soon
 * as the attempt ended, so that it stands whether or not an adoption commits afterwards
 * (SEC35-46: the row says WHERE a credential was sent - `host` and `endpointRef`, for a
 * PRODUCTION candidate only). The adoption transaction holds the device, the credential row,
 * `CAPTURE_CANDIDATE_ADOPTED` and `CAPTURE_CREDENTIAL_SET`.
 *
 * SEAMS (decision D92: rows this one starts before). The candidate state is row 132's
 * (`CandidateDirectory`); the registration of a new device in the engine's replicated state needs
 * an engine action the contract does not have yet (`DeviceRegistrar`; request filed with row
 * 132). While a seam is not provided the operation that needs it answers `503 NOT_READY` BEFORE
 * any request leaves - never a made-up result.
 */
import {
  ApiErrorCode,
  CAPTURE_CONNECTION_TEST_TIMEOUT_MS,
  CAPTURE_CONNECTION_TEST_VALIDITY_MS,
  CAPTURE_DEVICE_CHANGED_CAUSE,
  CaptureConnectionOutcome,
  CaptureDiscoveryReason,
  CaptureSourceClass,
  RETRY_AFTER_HEADER_NAME,
  captureCandidateAdoptedDetails,
  captureConnectionTestedDetails,
  type CaptureCandidateAdoption,
  type CaptureConfigSliceBody,
  type CaptureConnectionTest,
} from '@dems/shared/api';
import { AuditType, Permission, isSessionActive } from '@dems/shared/sim';
import { CaptureAdapterError, CaptureAdapterKind, sourceClassOf, usingCredential, type CameraCandidate, type ConnectionTestResult, type SealedCredential } from '../../../capture/adapters';
import { SERVER_AUDIT_DETAIL_RULES, type AuditEntry, type UnitContext } from '../../../core';
import type { DurableSlices } from '../../../db/mapping';
import type { EngineOutcome, EngineUnit } from '../../../engine';
import type { Principal } from '../../../plugins/authenticate';
import { ApiFailure } from '../../../plugins/error-envelope';
import type { ConnectionTestLimits, ConnectionTestRefusal, GuardVerdict } from './limits';
import { insertCaptureCredential, upsertCaptureCredential, type CaptureCredentialRow } from './statements';

// ── Seams ──────────────────────────────────────────────────────────────────────────────────────

/** The outcome a candidate keeps of its last test. No credential, and the profile codes only for the comparison of operation 96. */
export interface CandidateTestRecord {
  readonly outcome: CaptureConnectionOutcome;
  readonly authenticated: boolean;
  readonly testedAt: number;
  /** The usable H.264 profile codes the test read; empty unless `REACHABLE`. */
  readonly profiles: readonly string[];
}

/** A candidate of the caller's own live search, as the connect flow needs it. */
export interface ConnectCandidate {
  readonly candidateId: string;
  readonly searchId: string;
  /** The adapter-layer record: host, service address, endpoint reference, the announced texts, `testable`, `conflict`. */
  readonly camera: CameraCandidate;
  /** The registered device this candidate matches, or null (`status: NEW`). */
  readonly registeredDeviceId: string | null;
  readonly lastTest: CandidateTestRecord | null;
}

/** THE SEAM TO THE CANDIDATE STATE (row 132): data of ONE operator session, in memory. */
export interface CandidateDirectory {
  /** Null for an id that is unknown, expired or of another session's search: one answer for all three. */
  find(sessionId: string, candidateId: string): ConnectCandidate | null;
  recordTest(sessionId: string, candidateId: string, test: CandidateTestRecord): void;
  markRegistered(sessionId: string, candidateId: string, deviceId: string): void;
}

/** What one read-only attempt answers; `rejectedCredentialRequests` is absent for an adapter that does not count them. */
export type ConnectionAttempt = ConnectionTestResult & { readonly rejectedCredentialRequests?: number };

/** THE SEAM TO THE DEVICE: the read-only test of `camera/onvif-session.ts`, or a camera adapter's `testConnection`. */
export interface ConnectionTester {
  test(candidate: CameraCandidate, credential: SealedCredential | null, signal: AbortSignal): Promise<ConnectionAttempt>;
}

/** A sealed secret as the table takes it. The shape of the Core credential store's envelope. */
export interface SealedCameraSecret {
  readonly keyRef: string;
  readonly ciphertext: Uint8Array;
  readonly nonce: Uint8Array;
}

/** THE SEAM TO THE CORE CREDENTIAL STORE (row 84): seals the secret of a camera credential for one device. */
export interface CameraSecretSealer {
  seal(deviceId: string, secret: string): Promise<SealedCameraSecret>;
}

/** What an adoption registers (C3 §2.6 "What adoption stores"). No candidate id, no search id, no test history. */
export interface AdoptedDevice {
  /** `CAM-NN`: the next free number, minted inside the unit. */
  readonly id: string;
  readonly adapterKind: CaptureAdapterKind;
  /** The announced model, already sanitised by the adapter; or null. */
  readonly model: string | null;
  /** Host, or host and port: never a locator with a user part. */
  readonly address: string;
  readonly endpointRef: string | null;
  readonly profiles: readonly string[];
  readonly at: number;
}

/**
 * THE SEAM TO THE ENGINE'S REGISTRY: makes the new device part of the replicated `captureDevices`
 * slice INSIDE the adoption unit (the durable mapping then writes its `capture_devices` row in the
 * same transaction). Resolves with the device as the slice holds it.
 */
export type DeviceRegistrar = (scope: EngineUnit, principal: Principal, device: AdoptedDevice) => Promise<CaptureCandidateAdoption['device']>;

/** What the flow needs of the app. A test hands in doubles; the routes hand in the app's own. */
export interface ConnectHost {
  now(): number;
  /** The committed replicated state (`app.engine.state`). */
  state(): Pick<DurableSlices, 'session' | 'captureDevices' | 'captureConfig'>;
  /** One unit of the engine (`app.engine.run`). */
  engineUnit<Value>(label: string, work: (scope: EngineUnit) => Promise<Value>): Promise<EngineOutcome<Value>>;
  /** One server-native unit (`app.pipeline.run`). */
  nativeUnit<Value>(label: string, work: (unit: UnitContext) => Promise<Value>): Promise<Value>;
  /** One call after a delay, cancelled by the returned function: the whole-test deadline. */
  after(delayMs: number, callback: () => void): () => void;
  /** Codes and counts only. */
  note(fields: Readonly<Record<string, string | number | boolean | null>>, message: string): void;
}

export interface ConnectSeams {
  readonly host: ConnectHost;
  readonly limits: ConnectionTestLimits;
  candidates(): CandidateDirectory | null;
  tester(): ConnectionTester | null;
  sealer(): CameraSecretSealer | null;
  registrar(): DeviceRegistrar | null;
}

/** Who asked: the operator's session, never a request field (SR-65). */
export interface ConnectCaller {
  readonly principal: Extract<Principal, { kind: 'OPERATOR' }>;
}

// ── The credential of one request ──────────────────────────────────────────────────────────────

const OPERATOR_ENTERED = Symbol('a credential an operator entered in the body of this request');

/** The credential of ONE request's body. Made by `operatorCredential` at the route edge and by nothing else. */
export interface OperatorCredential {
  readonly [OPERATOR_ENTERED]: true;
  readonly sealed: SealedCredential;
}

/** The route edge: the body's credential, already sealed. The only maker of an `OperatorCredential`. */
export function operatorCredential(sealed: SealedCredential): OperatorCredential {
  return Object.freeze({ [OPERATOR_ENTERED]: true as const, sealed });
}

/** What allows `contact` to reach a device. Made by `permitFor` and by nothing else. */
type ContactPermit = { readonly kind: 'OPERATOR_CREDENTIAL'; readonly sealed: SealedCredential } | { readonly kind: 'DEVELOPMENT_SOURCE' };

// ── Refusals: fixed texts that quote nothing of the request ────────────────────────────────────

const SOURCE = 'captureConnect';
const invalidState = (reason: CaptureDiscoveryReason, text: string, details: Readonly<Record<string, string>> = {}): ApiFailure => new ApiFailure(409, ApiErrorCode.INVALID_STATE, text, { details: { reason, ...details } });
const locked = (): ApiFailure => new ApiFailure(409, ApiErrorCode.CAPTURE_CONFIG_LOCKED, 'The capture configuration cannot be changed while a session is open.');
const noCandidate = (): ApiFailure => new ApiFailure(404, ApiErrorCode.NOT_FOUND, 'No candidate has this ID.');
const noDevice = (): ApiFailure => new ApiFailure(404, ApiErrorCode.NOT_FOUND, 'The capture registry has no such device.');
const notReady = (reason: CaptureDiscoveryReason, text: string): ApiFailure => new ApiFailure(503, ApiErrorCode.NOT_READY, text, { details: { reason } });
const discoveryNotReady = (): ApiFailure => notReady(CaptureDiscoveryReason.DISCOVERY_NOT_READY, 'The camera search is not ready. Try again shortly.');
const storeNotReady = (): ApiFailure => notReady(CaptureDiscoveryReason.CREDENTIAL_STORE_NOT_READY, 'A camera password cannot be stored yet: the credential store is not ready.');
const credentialRefused = (reason: typeof CaptureDiscoveryReason.CREDENTIAL_REQUIRED | typeof CaptureDiscoveryReason.CREDENTIAL_NOT_EXPECTED): ApiFailure =>
  new ApiFailure(422, ApiErrorCode.INVALID_INPUT, reason === CaptureDiscoveryReason.CREDENTIAL_REQUIRED ? 'This camera needs a user name and a password.' : 'This camera was tested without a password: none is stored with it.', {
    details: { in: 'body', reason },
  });

function limited(refusal: ConnectionTestRefusal): ApiFailure {
  if (refusal.reason === CaptureDiscoveryReason.CONNECTION_TEST_IN_PROGRESS) return invalidState(refusal.reason, 'Another connection test is running. Try again shortly.');
  return new ApiFailure(429, ApiErrorCode.RATE_LIMITED, 'Too many connection tests. Try again later.', {
    details: { reason: refusal.reason },
    headers: { [RETRY_AFTER_HEADER_NAME]: String(Math.max(1, Math.ceil(refusal.retryAfterMs / 1_000))) },
  });
}

/** An answer of the sealer that may not be stored. The text names the rule, never a byte. */
export class SealedCameraSecretRefused extends Error {
  readonly code = 'CAPTURE_SEALED_SECRET_INVALID';
  constructor() {
    super('the credential sealer did not answer a well-formed envelope; nothing was stored');
    this.name = 'SealedCameraSecretRefused';
  }
}

// ── Shared steps ───────────────────────────────────────────────────────────────────────────────

const KEY_REF = /^[A-Z][A-Z0-9_]{0,63}$/;
const CAMERA_ID = /^CAM-(\d{2,})$/;
const LOOPBACK = /^127\./;

const sourceClassOfCandidate = (candidate: ConnectCandidate): CaptureSourceClass => sourceClassOf(candidate.camera.adapterKind);

/** The candidate of the caller's own search, or the refusals that need no request: 503, 404, 409. */
function resolve(seams: ConnectSeams, caller: ConnectCaller, candidateId: string): { readonly directory: CandidateDirectory; readonly tester: ConnectionTester; readonly candidate: ConnectCandidate } {
  const directory = seams.candidates();
  const tester = seams.tester();
  if (directory === null || tester === null) throw discoveryNotReady();
  const candidate = directory.find(caller.principal.sessionId, candidateId);
  if (candidate === null) throw noCandidate();
  if (candidate.registeredDeviceId !== null) throw invalidState(CaptureDiscoveryReason.CANDIDATE_ALREADY_REGISTERED, 'This camera is already a capture device.', { deviceId: candidate.registeredDeviceId });
  return { directory, tester, candidate };
}

/** A candidate that can never be contacted (D80(11); SEC35-28, SEC35-32, SEC35-41 (a)). */
function assertTestable(candidate: ConnectCandidate): void {
  const { camera } = candidate;
  // A loopback address is a fixture and never a production camera, whatever the search said.
  const steered = LOOPBACK.test(camera.host) && camera.adapterKind !== CaptureAdapterKind.FAKE;
  if (!camera.testable || camera.conflict || camera.serviceAddress === null || steered) throw invalidState(CaptureDiscoveryReason.CANDIDATE_NOT_TESTABLE, 'This device cannot be tested.');
}

/**
 * THE ONLY MAKER OF A PERMIT. The one credential input is the body of this request; a PRODUCTION
 * candidate without it gets none ("no credential means no connection attempt").
 */
function permitFor(candidate: ConnectCandidate, credential: OperatorCredential | null): ContactPermit {
  if (credential !== null) return { kind: 'OPERATOR_CREDENTIAL', sealed: credential.sealed };
  if (sourceClassOfCandidate(candidate) !== CaptureSourceClass.DEVELOPMENT) throw credentialRefused(CaptureDiscoveryReason.CREDENTIAL_REQUIRED);
  return { kind: 'DEVELOPMENT_SOURCE' };
}

interface Attempt {
  readonly record: CandidateTestRecord;
  readonly verdict: GuardVerdict;
}

/**
 * THE ONLY PLACE A DEVICE IS CONTACTED: one read-only attempt under the Core's one turn and the
 * whole-test deadline, then the guard's count, the candidate's record and the audit row of the
 * attempt. It never retries. No transaction is open while the network attempt runs (SEC35-47).
 */
async function contact(
  seams: ConnectSeams,
  caller: ConnectCaller,
  resolved: { readonly directory: CandidateDirectory; readonly tester: ConnectionTester; readonly candidate: ConnectCandidate },
  permit: ContactPermit,
  operationId: 'testCaptureCandidateConnection' | 'adoptCaptureCandidate',
): Promise<Attempt> {
  const { host, limits } = seams;
  const { candidate, directory, tester } = resolved;
  const sessionId = caller.principal.sessionId;
  const refusal = limits.refusal(candidate.camera.host, sessionId);
  if (refusal !== null) throw limited(refusal);
  const turn = limits.begin(candidate.camera.host, sessionId);
  const deadline = new AbortController();
  const cancel = host.after(CAPTURE_CONNECTION_TEST_TIMEOUT_MS, () => deadline.abort());
  const sealed = permit.kind === 'OPERATOR_CREDENTIAL' ? permit.sealed : null;
  let attempt: ConnectionAttempt;
  try {
    attempt = await tester.test(candidate.camera, sealed, deadline.signal);
  } catch (error) {
    turn.abandon();
    // The adapter refused before a request (a candidate it may not contact): a state of the candidate, not a fault.
    if (error instanceof CaptureAdapterError) throw invalidState(CaptureDiscoveryReason.CANDIDATE_NOT_TESTABLE, 'This device cannot be tested.');
    throw error;
  } finally {
    cancel();
  }
  const verdict = turn.end(attempt.outcome, attempt.rejectedCredentialRequests ?? 0);
  const authenticated = sealed !== null;
  const record: CandidateTestRecord = {
    outcome: attempt.outcome,
    authenticated,
    testedAt: host.now(),
    profiles: attempt.outcome === CaptureConnectionOutcome.REACHABLE ? [...attempt.usableProfiles] : [],
  };
  directory.recordTest(sessionId, candidate.candidateId, record);
  const sourceClass = sourceClassOfCandidate(candidate);
  const entry: AuditEntry = {
    type: AuditType.CAPTURE_CONNECTION_TESTED,
    message: `Camera connection tested (${record.outcome})`,
    actorId: caller.principal.operatorId,
    deviceId: caller.principal.deviceId,
    details: captureConnectionTestedDetails({
      candidateId: candidate.candidateId,
      searchId: candidate.searchId,
      outcome: record.outcome,
      authenticated,
      adapter: candidate.camera.adapterKind,
      sourceClass,
      operationId,
      host: candidate.camera.host,
      endpointRef: auditEndpointRef(candidate.camera.endpointRef),
      // Marked on every refused credential: `true` on the one that closed the host (SEC35-46 (a)).
      ...(record.outcome === CaptureConnectionOutcome.AUTHENTICATION_FAILED ? { guardTripped: verdict.guardTripped } : {}),
      permission: Permission.CAPTURE_CONFIG,
    }),
  };
  await host.nativeUnit(`${SOURCE}.tested`, async (unit) => {
    await unit.audit.append(entry);
  });
  host.note({ code: AuditType.CAPTURE_CONNECTION_TESTED, source: SOURCE, operationId, outcome: record.outcome, authenticated, sourceClass, guardTripped: verdict.guardTripped }, 'camera connection tested');
  return { record, verdict };
}

/**
 * The endpoint reference as an audit row may hold it (pass D1a): the announced text when it has
 * the one form the audit rule takes (`urn:uuid:<UUID>`), else nothing. The reference is DEVICE
 * text; one of any other form is left out of the row rather than written or allowed to fail the
 * write - the row of the attempt must stand for every outcome (SEC35-46), and `host` still says
 * where the credential went.
 */
export function auditEndpointRef(announced: string | null): string | null {
  return announced !== null && SERVER_AUDIT_DETAIL_RULES.CAPTURE_CONNECTION_TESTED.endpointRef.accepts(announced) ? announced : null;
}

/** From this many bytes on, a secret found in a ciphertext cannot be chance (80 positions x 2^-64). */
export const CLEAR_SECRET_PROOF_BYTES = 8;

/**
 * Whether an answer of the sealer holds the secret in clear (a sealer that stores instead of
 * sealing). Pass D1a (D132, `connect.db.test.ts:474`): the test used to be "the ciphertext
 * contains the secret's bytes", which a SHORT secret meets by chance - a one-byte password is
 * somewhere in 80 random bytes about once in four writes, and the write answered 500. So the
 * bytes searched for are never fewer than `CLEAR_SECRET_PROOF_BYTES`: a shorter secret is
 * searched for as it stands in a clear zero-padded frame (the secret followed by zero bytes),
 * which is the form a non-encrypting sealer of this store's frame would hand back. A short secret
 * kept in clear with other neighbours is not found by this check; the length rule above and the
 * store's own tests are what stand against that.
 */
export function holdsClearSecret(ciphertext: Uint8Array, secret: string): boolean {
  const clear = Buffer.from(secret, 'utf8');
  const sought = clear.byteLength >= CLEAR_SECRET_PROOF_BYTES ? clear : Buffer.concat([clear, Buffer.alloc(CLEAR_SECRET_PROOF_BYTES - clear.byteLength)]);
  try {
    return clear.byteLength > 0 && Buffer.from(ciphertext.buffer, ciphertext.byteOffset, ciphertext.byteLength).includes(sought);
  } finally {
    sought.fill(0);
    clear.fill(0);
  }
}

/** Seals a secret for a device and holds the answer to the table's form before a statement is sent. */
async function sealFor(sealer: CameraSecretSealer, deviceId: string, credential: OperatorCredential, at: number): Promise<CaptureCredentialRow> {
  return usingCredential(credential.sealed, async ({ username, secret }) => {
    const sealed = await sealer.seal(deviceId, secret);
    const wellFormed =
      typeof sealed.keyRef === 'string' && KEY_REF.test(sealed.keyRef) && sealed.ciphertext instanceof Uint8Array && sealed.ciphertext.byteLength >= 33 && sealed.nonce instanceof Uint8Array && sealed.nonce.byteLength === 12;
    if (!wellFormed || holdsClearSecret(sealed.ciphertext, secret)) throw new SealedCameraSecretRefused();
    return { deviceId, username, ciphertext: sealed.ciphertext, nonce: sealed.nonce, keyRef: sealed.keyRef, at };
  });
}

const credentialSet = (caller: ConnectCaller, deviceId: string, operationId: 'adoptCaptureCandidate' | 'setCaptureDeviceCredential'): AuditEntry => ({
  type: AuditType.CAPTURE_CREDENTIAL_SET,
  message: 'Camera credential set',
  actorId: caller.principal.operatorId,
  deviceId,
  // The FACT of the write: never the account name, the secret, the ciphertext, the nonce or the key.
  details: { deviceId, operationId, permission: Permission.CAPTURE_CONFIG },
});

// ── Operation 95 ───────────────────────────────────────────────────────────────────────────────

export async function testCandidate(seams: ConnectSeams, caller: ConnectCaller, candidateId: string, credential: OperatorCredential | null): Promise<CaptureConnectionTest> {
  if (isSessionActive(seams.host.state().session)) throw locked();
  const resolved = resolve(seams, caller, candidateId);
  assertTestable(resolved.candidate);
  const permit = permitFor(resolved.candidate, credential);
  const { record, verdict } = await contact(seams, caller, resolved, permit, 'testCaptureCandidateConnection');
  return {
    candidateId,
    outcome: record.outcome,
    authenticated: record.authenticated,
    testedAt: record.testedAt,
    usableProfileCount: record.profiles.length,
    failedAttemptsRemaining: verdict.failedAttemptsRemaining,
  };
}

// ── Operation 96 ───────────────────────────────────────────────────────────────────────────────

/** The next free `CAM-NN`: the highest number the registry holds plus 1, two digits at least. */
export function nextCameraId(devices: readonly { readonly id: string }[]): string {
  const highest = devices.reduce((max, device) => Math.max(max, Number(CAMERA_ID.exec(device.id)?.[1] ?? 0)), 0);
  return `CAM-${String(highest + 1).padStart(2, '0')}`;
}

/** Host, or host and port when the service address names a port: what the registry stores, never a locator. */
function addressOf(camera: CameraCandidate): string {
  let port = '';
  try {
    port = camera.serviceAddress === null ? '' : new URL(camera.serviceAddress).port;
  } catch {
    port = '';
  }
  return port === '' ? camera.host : `${camera.host}:${port}`;
}

const sameSet = (left: readonly string[], right: readonly string[]): boolean => left.length === right.length && [...left].sort().join('\n') === [...right].sort().join('\n');

export async function adoptCandidate(seams: ConnectSeams, caller: ConnectCaller, candidateId: string, credential: OperatorCredential | null): Promise<CaptureCandidateAdoption> {
  const { host } = seams;
  if (isSessionActive(host.state().session)) throw locked();
  const resolved = resolve(seams, caller, candidateId);
  const { candidate, directory } = resolved;
  assertTestable(candidate);
  const tested = candidate.lastTest;
  if (tested === null || tested.outcome !== CaptureConnectionOutcome.REACHABLE || host.now() - tested.testedAt >= CAPTURE_CONNECTION_TEST_VALIDITY_MS) {
    throw invalidState(CaptureDiscoveryReason.CANDIDATE_NOT_TESTED, 'Test the connection to this camera first.');
  }
  // The credential is present exactly when the passing test was authenticated.
  if (tested.authenticated && credential === null) throw credentialRefused(CaptureDiscoveryReason.CREDENTIAL_REQUIRED);
  if (!tested.authenticated && credential !== null) throw credentialRefused(CaptureDiscoveryReason.CREDENTIAL_NOT_EXPECTED);
  const permit = permitFor(candidate, credential);
  // Everything the transaction needs is asked for BEFORE the credential is sent a second time.
  const sealer = seams.sealer();
  if (credential !== null && sealer === null) throw storeNotReady();
  const registrar = seams.registrar();
  if (registrar === null) throw discoveryNotReady();

  // The re-verification: one more read-only attempt, with the credential of THIS request.
  const { record } = await contact(seams, caller, resolved, permit, 'adoptCaptureCandidate');
  if (record.outcome !== CaptureConnectionOutcome.REACHABLE) throw invalidState(CaptureDiscoveryReason.CONNECTION_TEST_FAILED, 'The camera did not pass the connection test again.', { outcome: record.outcome });
  if (!sameSet(record.profiles, tested.profiles)) {
    throw invalidState(CaptureDiscoveryReason.CONNECTION_TEST_FAILED, 'The camera changed since it was tested. Test it again.', { cause: CAPTURE_DEVICE_CHANGED_CAUSE });
  }

  // ONE TRANSACTION: the device, its credential, the two audit rows. Anything thrown rolls all of it back.
  const sourceClass = sourceClassOfCandidate(candidate);
  const outcome = await host.engineUnit(`${SOURCE}.adopt`, async (scope) => {
    const before = scope.pending();
    if (isSessionActive(before.session)) throw locked();
    // Two adoptions of one camera: the second finds the address the first registered.
    const address = addressOf(candidate.camera);
    const taken = before.captureDevices.devices.find((device) => device.kind === 'CAMERA' && device.host === address);
    if (taken !== undefined) throw invalidState(CaptureDiscoveryReason.CANDIDATE_ALREADY_REGISTERED, 'This camera is already a capture device.', { deviceId: taken.id });
    const at = host.now();
    const deviceId = nextCameraId(before.captureDevices.devices);
    const device = await registrar(scope, caller.principal, {
      id: deviceId,
      adapterKind: candidate.camera.adapterKind,
      model: candidate.camera.model,
      address,
      endpointRef: candidate.camera.endpointRef,
      profiles: record.profiles,
      at,
    });
    if (credential !== null && sealer !== null) {
      await insertCaptureCredential(scope.unit, await sealFor(sealer, deviceId, credential, at));
      await scope.unit.audit.append(credentialSet(caller, deviceId, 'adoptCaptureCandidate'));
    }
    await scope.unit.audit.append({
      type: AuditType.CAPTURE_CANDIDATE_ADOPTED,
      message: `Camera ${deviceId} added`,
      actorId: caller.principal.operatorId,
      deviceId,
      details: captureCandidateAdoptedDetails({
        deviceId,
        candidateId: candidate.candidateId,
        searchId: candidate.searchId,
        adapter: candidate.camera.adapterKind,
        sourceClass,
        credentialSet: credential !== null,
        host: candidate.camera.host,
        endpointRef: auditEndpointRef(candidate.camera.endpointRef),
        permission: Permission.CAPTURE_CONFIG,
      }),
    });
    return { deviceId, device };
  });
  directory.markRegistered(caller.principal.sessionId, candidate.candidateId, outcome.value.deviceId);
  host.note({ code: AuditType.CAPTURE_CANDIDATE_ADOPTED, source: SOURCE, deviceId: outcome.value.deviceId, sourceClass, credentialSet: credential !== null, epoch: outcome.epoch, revision: outcome.revision }, 'camera candidate adopted');
  return { deviceId: outcome.value.deviceId, device: outcome.value.device, credentialSet: credential !== null };
}

// ── Operation 89 ───────────────────────────────────────────────────────────────────────────────

/**
 * Sets or REPLACES the credential of a registered camera: one unit of the engine, so that no
 * session can open between the lock read and the write. Writing a credential again is its
 * rotation: the sealer makes a new key each time, and the key of the replaced envelope is
 * destroyed by the unit that reads the stored references (the reveal side; `credentialKeys`).
 */
export async function setCredential(seams: ConnectSeams, caller: ConnectCaller, deviceId: string, credential: OperatorCredential): Promise<CaptureConfigSliceBody> {
  const { host } = seams;
  const camera = (state: Pick<DurableSlices, 'captureDevices'>): boolean => state.captureDevices.devices.some((device) => device.id === deviceId && device.kind === 'CAMERA');
  // The simulator's order: an unknown path ID is 404 also while the selector is locked.
  if (!camera(host.state())) throw noDevice();
  if (isSessionActive(host.state().session)) throw locked();
  const sealer = seams.sealer();
  if (sealer === null) throw storeNotReady();
  const outcome = await host.engineUnit(`${SOURCE}.setCredential`, async (scope) => {
    const before = scope.pending();
    if (!camera(before)) throw noDevice();
    if (isSessionActive(before.session)) throw locked();
    await upsertCaptureCredential(scope.unit, await sealFor(sealer, deviceId, credential, host.now()));
    await scope.unit.audit.append(credentialSet(caller, deviceId, 'setCaptureDeviceCredential'));
    return before.captureConfig;
  });
  host.note({ code: AuditType.CAPTURE_CREDENTIAL_SET, source: SOURCE, deviceId, epoch: outcome.epoch, revision: outcome.revision }, 'camera credential set');
  // No session is open: the unit read it. The stored slice never holds the lock.
  return { ...outcome.value, locked: false };
}
