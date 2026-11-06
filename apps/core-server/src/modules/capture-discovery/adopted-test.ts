/**
 * THE CONNECTION TEST OF AN ADOPTED CAMERA WITH ITS STORED CREDENTIAL (task 4 blueprint row 146,
 * M3; security addendum 04 item 4.2 weakness W-6, requirements AD-03 point 5 and AD-12 "S13-04
 * (d)"; AD-02 point 1 for the stored address; design addendum 04 section 2.3, the occasions table:
 * "connection test of an adopted camera when the operator types no credential - 1 reveal,
 * `CONNECTION_TEST`, the operator").
 *
 * WHY IT IS NOT IN `connect/`. The connect flow of a CANDIDATE (operations 95, 96, 89) holds "no
 * connection test without an operator-entered credential" BY CONSTRUCTION: its folder reads no
 * stored credential, and a static test holds its one call of the tester. This file is the one
 * place of the Core where a STORED credential is sent on an operator's request, so it stands
 * beside that folder, never inside it, and shares with it exactly two things: the tester of both
 * halves and THE SAME limits object.
 *
 * ONE TEST, IN THIS ORDER. Every refusal comes before the reveal; a refused test reveals nothing,
 * writes no audit entry and sends nothing:
 *
 *   1. a session is open: `409 CAPTURE_CONFIG_LOCKED` (as operation 95);
 *   2. a seam is missing - the reader, the destination rule or the tester was not handed in:
 *      `503 NOT_READY`. No production composition hands them in yet (the request of this row);
 *   3. the device is no registered camera: `404`;
 *   4. THE STORED FACTS, read now, outside any unit of work: a camera row of a PRODUCTION adapter
 *      kind with an address of the stored form, as the candidate the ONVIF session takes
 *      (`storedCameraCandidate`). Anything else: `409 CANDIDATE_NOT_TESTABLE`;
 *   5. THE DESTINATION RULE ON THAT STORED ADDRESS (`judgeStoredCamera`, AD-02 (1)): the stored
 *      value is untrusted. A loopback, link-local, public, out-of-subnet or host address is
 *      `409 CANDIDATE_NOT_TESTABLE`, said to the log and the persistent error log by the rule's
 *      own code. THE STORED ADDRESS ONLY: this function takes a device id and no address, host,
 *      port, path or credential from its caller. THE SOURCE HALF (row 143b): the judgement also
 *      names the camera-interface address the test must be made FROM; an admission that names
 *      none is refused the same way, and the address goes to the tester, which binds every dial
 *      of both halves to it;
 *   6. THE EXISTING BOUNDS (`connect/limits.ts`, the object operations 95 and 96 use): single
 *      flight per Core, the spacing per host and per operator session, the per-minute bound and
 *      the LOCK-OUT GUARD of the host. A refusal is `409` / `429` as there. So a camera whose
 *      stored credential was refused twice is not asked a third time, by this test or by a typed
 *      one, until the window has passed (AD-03 (5): "the fourth refused attempt is not sent");
 *   7. the turn is taken, THEN the credential is read: `reader.connectionTest(deviceId,
 *      operatorId)` - the reader bound to the reason `CONNECTION_TEST`, which takes no reason and
 *      no session from this file. THE READ IS NEVER INSIDE A UNIT OF WORK: this file opens none
 *      (the reader opens its own, and returns the opaque credential only after its audit entry
 *      is committed). A read that fails ends the turn without a request;
 *   8. both halves of the test (`camera/stream-probe.ts`: the ONVIF half, then the relay's probe
 *      of each stream the camera names), under the whole-test deadline;
 *   9. the guard's count: what the camera REFUSED with the credential, at the ONVIF half and at
 *      the stream (a refused RTSP authentication is one: S13-04 (d));
 *  10. THE OUTCOME ENTRY (task 4 rows 146b, 146c; decisions C58, C67, C75 (1), C83): one
 *      `CAPTURE_DEVICE_CONNECTION_TESTED` row, handed to the host's `record` seam, which appends
 *      it in ONE unit of work of its own (`recordOutcome`, the one writer of this file).
 *
 * WHAT IS AUDITED: ONE OUTCOME ENTRY FOR EVERY TEST THAT REACHED THE READER (row 146c, decision
 * C75 (1): a reveal never stands in the audit without a result).
 *   (a) the reader's own `CAPTURE_CREDENTIAL_REVEALED` (device, reason `CONNECTION_TEST`, the
 *       operator as its actor, no session), committed BEFORE the credential is returned - the
 *       reader's unit, not this file's;
 *   (b) the OUTCOME, `CAPTURE_DEVICE_CONNECTION_TESTED`, built by the contract's one builder
 *       (`captureDeviceConnectionTestedDetails`): the device's registry id, the outcome code, the
 *       adapter kind and its class, `guardTripped` for a refused credential, the one reason of a
 *       credential that was NOT sent, the permission - and, since row V4, `usableProfileCount`
 *       (the answer's own count, 0 to 16) when a camera was asked, and `unreachableReason` when
 *       none was. The builder takes no credential, no address, no locator and no device text, so
 *       none can be handed in.
 * WHICH OUTCOME, PER END OF A TEST THAT REACHED THE READER:
 *   - the tester answered (any of the five outcomes - a camera that did not answer, a relay that
 *     could not be started and the whole-test deadline are `UNREACHABLE` answers of the tester):
 *     that outcome and the count, NO `unreachableReason`;
 *   - the reader handed nothing on (nothing stored, the store not readable, the reader's own gate
 *     refused the device or its stored address): `UNREACHABLE`, `CREDENTIAL_NOT_READ`, no count,
 *     THEN the refusal (`409` / `503`) is thrown;
 *   - the adapter refused the camera before a request: `UNREACHABLE`, `NOT_SENT`, no count, then
 *     `409`;
 *   - the tester FAILED (a fault, not a refusal): `UNREACHABLE` with no reason and no count - what
 *     was sent is not known, and unknown is never said as "nothing was sent" - then the fault
 *     travels on.
 * A test refused at steps 1 to 6 reaches no reader and writes NOTHING, as the contract says of
 * them: "Refusals before the credential is read and before any request leaves the Core, with no
 * audit row". `CREDENTIAL_NOT_READ` is not their reason: it is "the reader was called and handed
 * nothing on".
 * AN OUTCOME THAT CANNOT BE RECORDED IS A FAULT, NOT AN ANSWER, on every one of these ends: when
 * the unit of (b) fails, THAT failure travels on (in place of a result, and in place of the `409`
 * / `503` of a failed read) after a code went to the log and the persistent error log. The guard
 * has counted by then.
 * THE READ IS STILL OUTSIDE ANY UNIT: this file opens none; (b)'s unit is the host's, opened after
 * the reader's own unit has ended.
 *
 * WHAT A TEST STORES (row PR, decision C117; rulings C36, C61 (1)). Until row PR this test "changed
 * no setting" and a camera whose profile list was empty could get one only by being adopted again.
 * Now a test whose STREAM HALF judged at least one stream meets what is stored for the camera, in
 * the unit of its outcome entry (`host.settle`; the work is `adopted-profiles.ts`):
 *   (a) NO stored profile: the judged statement is stored - by the adoption's own function, with
 *       the codes the stream test minted; the entry's message ends `; profiles stored: N`;
 *   (b) a stored statement and a stream that states something else: NOTHING is stored; the
 *       message ends `; STREAM_PROFILE_DIFFERS: stored N, stated N, differing N; nothing stored`
 *       and a code with the three counts goes to the persistent error log;
 *   (c) stored and stated agree: nothing is stored and the entry is the one of rows 146b / 146c.
 * In all three the ANSWER and the entry's `details` are the contract's, unchanged: the outcome is
 * the test's own (`REACHABLE`) and `usableProfileCount` is what the stream states NOW. The
 * contract has no member that says "stored" or "differs" (its `reason` is the closed
 * `SCHEME_NOT_ALLOWED`, and `STREAM_PROFILE_DIFFERS` is the word of the sealing notice): the
 * members are a request of row PR to the writer of the contract. A test that judged no stream -
 * any other outcome, a Core without a relay program - stores nothing and compares nothing.
 * The refusals before the reader, the guard, the destination rule and the bound source address
 * are untouched: all of this stands after step 9.
 *
 * WHAT IT KEEPS: nothing. The credential is the opaque object of one call; no member of it is
 * read here, and it is in no log line, answer, error, argument or environment. The answer carries
 * an outcome, counts and at most the one reason the contract tells a client.
 *
 * THE ROUTE is operation 108 `testCaptureDeviceConnection` (`adopted-test-route.ts`, row 146b): one
 * handler that calls `adoptedCameraTestControl(app).test(caller, deviceId)` and nothing else.
 */
import { ApiErrorCode, CAPTURE_CONNECTION_TEST_TIMEOUT_MS, CAPTURE_DEVICE_TEST_NOT_READY_SENTENCE, CaptureConnectionOutcome, CaptureConnectionTestReason, CaptureDeviceTestProfiles, CaptureDeviceTestUnreachableReason, CaptureDiscoveryReason, CaptureSourceClass, RETRY_AFTER_HEADER_NAME, captureDeviceConnectionTestedDetails } from '@dems/shared/api';
import { AuditType, Permission, isSessionActive } from '@dems/shared/sim';
import { CAPTURE_ADAPTER_KINDS, CaptureAdapterError, StoredCameraRefusal, judgeStoredCamera, sourceClassOf, storedCameraCandidate, type CameraCandidate, type CaptureAdapterKind, type SealedCredential, type StoredCameraAddressRule } from '../../capture/adapters';
import type { AuditEntry } from '../../core';
import type { DurableSlices } from '../../db/mapping';
import type { Principal } from '../../plugins/authenticate';
import { ApiFailure } from '../../plugins/error-envelope';
import { StoredProfilesVerdict, settleStatedProfiles, storedProfilesWords, type StoredProfilesComparison, type StoredProfilesUnit } from './adopted-profiles';
import type { AdoptedCameraStream } from './adoption';
import type { ConnectionTestLimits, ConnectionTestRefusal, ConnectionTester } from './connect';

/** The reader of this holder, by shape (`ConnectionTestCredentialReader` of the credential wiring): the device and the operator, no reason, no session. */
export interface StoredCredentialReader {
  connectionTest(deviceId: string, operatorId: string): Promise<SealedCredential>;
}

/** What the production composition hands in, once per app: the reader bound to `CONNECTION_TEST` and the destination rule bound to the host's facts. */
export interface AdoptedCameraTestParts {
  readonly reader: StoredCredentialReader;
  readonly storedAddress: StoredCameraAddressRule;
}

/** What is stored for a device, as far as this test reads it. One row or none. */
export const READ_ADOPTED_CAMERA = 'SELECT kind, adapter_kind, address, onvif_uuid FROM public.capture_devices WHERE id = $1';

export interface AdoptedCameraTestHost {
  now(): number;
  /** The committed replicated state (`app.engine.state`). */
  state(): Pick<DurableSlices, 'session' | 'captureDevices'>;
  /** One read on the pool as the runtime role, OUTSIDE any unit of work (`app.db.read`). */
  query(text: string, values: unknown[]): Promise<{ readonly rows: readonly unknown[] }>;
  /** One call after a delay, cancelled by the returned function: the whole-test deadline. */
  after(delayMs: number, callback: () => void): () => void;
  /** Codes and counts only. */
  note(fields: Readonly<Record<string, string | number | boolean | null>>, message: string): void;
  /** The persistent error log, for a refused stored address and a read that failed: a code and identifiers. */
  persist(entry: { readonly code: string; readonly message: string; readonly context: Readonly<Record<string, string | null>> }): void;
  /**
   * THE OUTCOME ENTRY of one test (row 146b): appended in ONE unit of work the host opens for it
   * (`app.pipeline.run` with `unit.audit.append`), resolved when that unit has committed. Called
   * once per test that reached the reader (row 146c): after the guard counted when the tester
   * answered, before the refusal or the fault travels on when no camera was asked.
   */
  record(entry: AuditEntry): Promise<void>;
  /**
   * THE UNIT OF A TEST THAT JUDGED A STREAM (row PR, decision C117): ONE unit of the engine
   * (`app.engine.run`) in which `work` reads what is stored for the camera, stores the judged
   * statement when nothing is, and hands back the outcome entry - which the host appends IN THAT
   * UNIT. Resolved when the unit has committed; a `work` or an append that fails rolls all of it
   * back. Called in the place of `record`, never beside it: one outcome entry per test.
   */
  settle(work: (scope: StoredProfilesUnit) => Promise<AuditEntry>): Promise<void>;
}

export interface AdoptedCameraTestSeams {
  readonly host: AdoptedCameraTestHost;
  /** THE limits of the connect flow: the same object operations 95 and 96 ask. Read at each call. */
  readonly limits: ConnectionTestLimits;
  tester(): ConnectionTester | null;
  parts(): AdoptedCameraTestParts | null;
}

/** Who asked: the operator's session, never a request field. */
export interface AdoptedCameraTestCaller {
  readonly principal: Extract<Principal, { kind: 'OPERATOR' }>;
}

/** The answer of one test. A failed test is this result, not an error. No address, no device text, no credential member. */
export interface AdoptedCameraTest {
  readonly deviceId: string;
  readonly outcome: CaptureConnectionOutcome;
  /** Always true: the stored credential was read for this test. A fact, never a value. */
  readonly authenticated: true;
  readonly testedAt: number;
  readonly usableProfileCount: number;
  /** Refused credentials this host may still see before the lock-out guard closes. */
  readonly failedAttemptsRemaining: number;
  /** Present only for an `AUTHENTICATION_FAILED` test in which the credential was NOT sent. */
  readonly reason?: CaptureConnectionTestReason;
  /** Rows PR, V7: present only when the test stored the camera's profiles, or found a stored statement the stream no longer makes. */
  readonly profiles?: CaptureDeviceTestProfiles;
}

const SOURCE = 'captureAdoptedTest';
export const ADOPTED_TEST_LOG_CODE = 'CAPTURE_STORED_CONNECTION_TESTED';
export const ADOPTED_TEST_ADDRESS_REFUSED = 'CAPTURE_STORED_TEST_ADDRESS_REFUSED';
export const ADOPTED_TEST_CREDENTIAL_NOT_READ = 'CAPTURE_STORED_TEST_CREDENTIAL_NOT_READ';
const ADDRESS_REFUSED_TEXT = 'the stored address of a camera is not one the Core connects to: its connection test was refused and no credential was read';
const CREDENTIAL_NOT_READ_TEXT = 'the stored credential of a camera could not be read for its connection test: nothing was sent to the camera';
/** The stored credential was read and the adapter refused the camera before a request: the outcome entry says `NOT_SENT` (rows 146b, 146c). */
export const ADOPTED_TEST_NOT_SENT = 'CAPTURE_STORED_TEST_NOT_SENT';
/** The outcome entry of a test that reached the reader could not be appended: the test fails as a fault (rows 146b, 146c). */
export const ADOPTED_TEST_OUTCOME_NOT_RECORDED = 'CAPTURE_STORED_TEST_OUTCOME_NOT_RECORDED';
/** The stored credential was read and the tester failed - a fault, not a refusal (row 146c). */
export const ADOPTED_TEST_FAULT = 'CAPTURE_STORED_TEST_FAULT';
const NOT_SENT_TEXT = 'the stored credential of a camera was read for its connection test and the adapter refused the camera before a request: nothing was sent';
const OUTCOME_NOT_RECORDED_TEXT = 'the outcome of a stored-credential connection test could not be written to the audit: the test is answered as a fault';
const FAULT_TEXT = 'the stored credential of a camera was read for its connection test and the test failed before an outcome: what was sent is not known';
/** Row PR (C117): the stream of a tested camera states something else than what is stored for it. Nothing was stored. */
export const ADOPTED_TEST_PROFILE_DIFFERS = 'CAPTURE_STORED_TEST_PROFILE_DIFFERS';
/** Row PR (C117): the camera holds no stored profile and the judged statement was NOT stored (a closed cause says why). */
export const ADOPTED_TEST_PROFILES_NOT_STORED = 'CAPTURE_STORED_TEST_PROFILES_NOT_STORED';
const PROFILE_DIFFERS_TEXT = 'the stream of a registered camera states something else than the profiles stored for it: nothing was stored, the stored statement stands';
const PROFILES_NOT_STORED_TEXT = 'a registered camera holds no stored profile and the statement of its stream was not stored by this connection test';

/**
 * What ONE outcome entry states beside the device and its adapter kind (row 146c): closed codes, a
 * flag and a count. No member can hold a credential, an address, a locator or text of a device.
 */
interface OutcomeFacts {
  readonly outcome: CaptureConnectionOutcome;
  /** Only on a refused credential: true on the one that closed the host. */
  readonly guardTripped?: boolean;
  /** Only for a credential that was NOT sent although a camera was asked (the scheme refusal). */
  readonly reason?: CaptureConnectionTestReason;
  /** Only when NO camera was asked: why. */
  readonly unreachableReason?: CaptureDeviceTestUnreachableReason;
  /** Only when the tester answered: the answer's own count. */
  readonly usableProfileCount?: number;
  /** Rows PR, V7: only when the test stored the camera's profiles or found a stored statement the stream no longer makes - the closed word and its three counts. */
  readonly profiles?: CaptureDeviceTestProfiles;
  readonly storedProfileCount?: number;
  readonly statedProfileCount?: number;
  readonly differingProfileCount?: number;
}

/**
 * Rows PR, V7 (decision C117): what a comparison states in the CONTRACT's words - the closed word of
 * operation 108's answer and of the outcome entry's details, with the three counts; nothing for a
 * comparison with nothing to say (agreement) and for one whose write was due and not made (its
 * cause is a code of the log and the error log, not a member of the contract).
 */
function storedProfilesFactsOf(compared: StoredProfilesComparison): Pick<OutcomeFacts, 'profiles' | 'storedProfileCount' | 'statedProfileCount' | 'differingProfileCount'> {
  const word =
    compared.verdict === StoredProfilesVerdict.PROFILES_STORED ? CaptureDeviceTestProfiles.PROFILES_STORED : compared.verdict === StoredProfilesVerdict.STREAM_PROFILE_DIFFERS ? CaptureDeviceTestProfiles.STREAM_PROFILE_DIFFERS : null;
  return word === null ? {} : { profiles: word, storedProfileCount: compared.stored, statedProfileCount: compared.stated, differingProfileCount: compared.differing };
}

/** A code word of another unit, as a log line may carry it: never a value. */
const CODE_WORD = /^[A-Z][A-Z0-9_]{0,63}$/;
const codeOf = (value: unknown): string | null => (typeof value === 'string' && CODE_WORD.test(value) ? value : null);

const locked = (): ApiFailure => new ApiFailure(409, ApiErrorCode.CAPTURE_CONFIG_LOCKED, 'The capture configuration cannot be changed while a session is open.');
const noDevice = (): ApiFailure => new ApiFailure(404, ApiErrorCode.NOT_FOUND, 'The capture registry has no such device.');
const notReady = (reason: CaptureDiscoveryReason, text: string): ApiFailure => new ApiFailure(503, ApiErrorCode.NOT_READY, text, { details: { reason } });
const notTestable = (): ApiFailure => new ApiFailure(409, ApiErrorCode.INVALID_STATE, 'This device cannot be tested.', { details: { reason: CaptureDiscoveryReason.CANDIDATE_NOT_TESTABLE } });
const nothingStored = (): ApiFailure => new ApiFailure(409, ApiErrorCode.INVALID_STATE, 'No password is stored for this camera. Set one first.', { details: { reason: CaptureDiscoveryReason.CREDENTIAL_REQUIRED } });

function limited(refusal: ConnectionTestRefusal): ApiFailure {
  if (refusal.reason === CaptureDiscoveryReason.CONNECTION_TEST_IN_PROGRESS) return new ApiFailure(409, ApiErrorCode.INVALID_STATE, 'Another connection test is running. Try again shortly.', { details: { reason: refusal.reason } });
  return new ApiFailure(429, ApiErrorCode.RATE_LIMITED, 'Too many connection tests. Try again later.', {
    details: { reason: refusal.reason },
    headers: { [RETRY_AFTER_HEADER_NAME]: String(Math.max(1, Math.ceil(refusal.retryAfterMs / 1_000))) },
  });
}

/** The reader's failures that mean "nothing is stored for this camera": the operator can act on it (operation 89). */
const NOT_STORED = 'CAPTURE_CREDENTIAL_NOT_STORED';
/** The reader's own gate refused the device or its address: the same answer as steps 4 and 5 of this file. */
const READER_GATE = ['CAPTURE_CREDENTIAL_DEVICE_REFUSED', 'CAPTURE_CREDENTIAL_ADDRESS_REFUSED'];

const textOrNull = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

/**
 * Step 4: the stored camera as a candidate, or null - no row, not a camera, an adapter kind that
 * is outside the closed set or not of the PRODUCTION class (a development source has no stored
 * credential), an address that is absent or not of the stored form.
 */
export function adoptedCameraOf(rows: readonly unknown[]): CameraCandidate | null {
  const row = rows[0];
  if (rows.length !== 1 || typeof row !== 'object' || row === null) return null;
  const { kind, adapter_kind: adapterKind, address, onvif_uuid: endpointRef } = row as { kind?: unknown; adapter_kind?: unknown; address?: unknown; onvif_uuid?: unknown };
  if (kind !== 'CAMERA' || typeof adapterKind !== 'string' || !(CAPTURE_ADAPTER_KINDS as readonly string[]).includes(adapterKind)) return null;
  if (sourceClassOf(adapterKind as CaptureAdapterKind) !== CaptureSourceClass.PRODUCTION) return null;
  return storedCameraCandidate({ adapterKind: adapterKind as CaptureAdapterKind, address: textOrNull(address), endpointRef: textOrNull(endpointRef) });
}

/** THE TEST. See the header for its order. */
export async function testAdoptedCamera(seams: AdoptedCameraTestSeams, caller: AdoptedCameraTestCaller, deviceId: string): Promise<AdoptedCameraTest> {
  const { host } = seams;
  // 1. to 3. What needs no read.
  if (isSessionActive(host.state().session)) throw locked();
  const parts = seams.parts();
  const tester = seams.tester();
  if (parts === null || tester === null) throw notReady(CaptureDiscoveryReason.DISCOVERY_NOT_READY, CAPTURE_DEVICE_TEST_NOT_READY_SENTENCE);
  if (!host.state().captureDevices.devices.some((device) => device.id === deviceId && device.kind === 'CAMERA')) throw noDevice();

  // 4. The stored facts, now. A read on the pool: no unit of work is open here, and none is opened.
  const camera = adoptedCameraOf((await host.query(READ_ADOPTED_CAMERA, [deviceId])).rows);
  if (camera === null) throw notTestable();

  // 5. AD-02 (1): the STORED address under the destination rule. Before the bounds are spent and before the reveal.
  const judged = judgeStoredCamera(camera, parts.storedAddress);
  // Row 143b (S13-11 point 2): THE SOURCE HALF. The same judgement names the camera-interface address every dial of the
  // test must leave from. An admission that names none is refused as a refused address: nothing is dialled as the host routes.
  const sourceAddress = !judged.allowed ? null : judged.sourceAddress;
  if (!judged.allowed || sourceAddress === null) {
    const refusal = judged.allowed ? StoredCameraRefusal.SOURCE_ABSENT : judged.refusal;
    host.note({ code: ADOPTED_TEST_ADDRESS_REFUSED, source: SOURCE, deviceId, refusal }, ADDRESS_REFUSED_TEXT);
    host.persist({ code: ADOPTED_TEST_ADDRESS_REFUSED, message: ADDRESS_REFUSED_TEXT, context: { deviceId, refusal } });
    throw notTestable();
  }

  // 6. The existing bounds, asked and taken in one turn of the event loop: single flight, spacing, the lock-out guard.
  const { limits } = seams;
  const sessionId = caller.principal.sessionId;
  const refusal = limits.refusal(camera.host, sessionId);
  if (refusal !== null) throw limited(refusal);
  const turn = limits.begin(camera.host, sessionId);

  // 7. The stored credential: ONE read, by the reader bound to its reason. Outside any unit of work.
  let sealed: SealedCredential;
  try {
    sealed = await parts.reader.connectionTest(deviceId, caller.principal.operatorId);
  } catch (error) {
    turn.abandon();
    const cause = codeOf((error as { code?: unknown } | null)?.code);
    host.note({ code: ADOPTED_TEST_CREDENTIAL_NOT_READ, source: SOURCE, deviceId, cause }, CREDENTIAL_NOT_READ_TEXT);
    host.persist({ code: ADOPTED_TEST_CREDENTIAL_NOT_READ, message: CREDENTIAL_NOT_READ_TEXT, context: { deviceId, cause } });
    // Row 146c (C75 (1)): the reader was reached, so the audit gets a RESULT before the refusal travels on - no camera
    // was asked, because the reader handed nothing on. An entry that cannot be recorded travels on in the refusal's place.
    await recordOutcome(host, caller, deviceId, camera.adapterKind, { outcome: CaptureConnectionOutcome.UNREACHABLE, unreachableReason: CaptureDeviceTestUnreachableReason.CREDENTIAL_NOT_READ });
    if (cause === NOT_STORED) throw nothingStored();
    if (cause !== null && READER_GATE.includes(cause)) throw notTestable();
    throw notReady(CaptureDiscoveryReason.CREDENTIAL_STORE_NOT_READY, 'The stored password of this camera could not be read.');
  }

  // 8. Both halves, under the whole-test deadline. It never retries.
  const deadline = new AbortController();
  const cancel = host.after(CAPTURE_CONNECTION_TEST_TIMEOUT_MS, () => deadline.abort());
  let attempt: Awaited<ReturnType<ConnectionTester['test']>>;
  try {
    attempt = await tester.test(camera, sealed, deadline.signal, sourceAddress);
  } catch (error) {
    turn.abandon();
    // The adapter refused before a request: a state of the device, not a fault. The credential WAS read (the reader's
    // entry says so) and nothing was sent: said by a code, and (row 146c) by the outcome entry with `NOT_SENT`.
    const cause = codeOf((error as { code?: unknown } | null)?.code);
    if (error instanceof CaptureAdapterError) {
      host.note({ code: ADOPTED_TEST_NOT_SENT, source: SOURCE, deviceId, cause }, NOT_SENT_TEXT);
      host.persist({ code: ADOPTED_TEST_NOT_SENT, message: NOT_SENT_TEXT, context: { deviceId, cause } });
      await recordOutcome(host, caller, deviceId, camera.adapterKind, { outcome: CaptureConnectionOutcome.UNREACHABLE, unreachableReason: CaptureDeviceTestUnreachableReason.NOT_SENT });
      throw notTestable();
    }
    // Row 146c: a FAULT of the tester after the reveal. The audit still gets a result: UNREACHABLE with no reason (what
    // was sent is not known, and unknown is never said as "nothing was sent") and no count. Then the fault travels on.
    host.note({ code: ADOPTED_TEST_FAULT, source: SOURCE, deviceId, cause }, FAULT_TEXT);
    host.persist({ code: ADOPTED_TEST_FAULT, message: FAULT_TEXT, context: { deviceId, cause } });
    await recordOutcome(host, caller, deviceId, camera.adapterKind, { outcome: CaptureConnectionOutcome.UNREACHABLE });
    throw error;
  } finally {
    cancel();
  }

  // 9. The guard counts what the camera refused with the credential, ONVIF and stream together; unknown counts as one.
  const verdict = turn.end(attempt.outcome, attempt.rejectedCredentialRequests ?? null);
  const testedAt = host.now();
  const reachable = attempt.outcome === CaptureConnectionOutcome.REACHABLE;
  const schemeRefused = attempt.outcome === CaptureConnectionOutcome.AUTHENTICATION_FAILED && attempt.reason === CaptureConnectionTestReason.SCHEME_NOT_ALLOWED;

  // The ONE count of this test: the answer's and (row 146c) the outcome entry's.
  const usableProfileCount = reachable ? attempt.usableProfiles.length : 0;

  // 10. THE OUTCOME ENTRY (rows 146b, 146c): the second entry of this test, after the reader's reveal. The tester
  // answered, so a camera was asked: the outcome as it is - UNREACHABLE too, with NO `unreachableReason` - and the count.
  const facts: OutcomeFacts = {
    outcome: attempt.outcome,
    // Marked on a refused credential: `true` on the one that closed the host (as on CAPTURE_CONNECTION_TESTED).
    ...(attempt.outcome === CaptureConnectionOutcome.AUTHENTICATION_FAILED ? { guardTripped: verdict.guardTripped } : {}),
    // The row of a scheme refusal says so: the credential was NOT sent.
    ...(schemeRefused ? { reason: CaptureConnectionTestReason.SCHEME_NOT_ALLOWED } : {}),
    usableProfileCount,
  };
  // Row PR (decision C117): a test that JUDGED A STREAM meets what is stored for the camera, in the unit of its entry -
  // nothing stored: the statement is stored; another statement stored: nothing is, and the difference is said in counts.
  const stated = reachable ? (attempt.streams ?? []) : [];
  const profiles = stated.length === 0 ? null : await settleOutcome(host, caller, deviceId, camera.adapterKind, facts, stated, testedAt);
  if (profiles === null) await recordOutcome(host, caller, deviceId, camera.adapterKind, facts);
  // Row V7: the contract's closed word of that comparison, for the answer (absent: nothing to say).
  const storedWord = profiles === null ? undefined : storedProfilesFactsOf(profiles).profiles;
  host.note(
    {
      code: ADOPTED_TEST_LOG_CODE,
      source: SOURCE,
      deviceId,
      outcome: attempt.outcome,
      guardTripped: verdict.guardTripped,
      testReason: codeOf(attempt.reason),
      judgedStreams: stated.length,
      // Case (c) - stored and stated agree - is the line of rows 146 / 146b, as it was.
      ...(profiles === null || profiles.verdict === StoredProfilesVerdict.PROFILES_AGREE ? {} : { profiles: profiles.verdict, storedProfiles: profiles.stored, differingProfiles: profiles.differing, profilesCause: profiles.cause ?? null }),
    },
    'stored-credential camera connection tested',
  );
  // A stored statement the stream no longer makes, and a statement that was due and not stored, are states somebody must
  // find the next morning: a code and counts in the persistent error log.
  if (profiles !== null && (profiles.verdict === StoredProfilesVerdict.STREAM_PROFILE_DIFFERS || profiles.verdict === StoredProfilesVerdict.PROFILES_NOT_STORED)) {
    const differs = profiles.verdict === StoredProfilesVerdict.STREAM_PROFILE_DIFFERS;
    host.persist({
      code: differs ? ADOPTED_TEST_PROFILE_DIFFERS : ADOPTED_TEST_PROFILES_NOT_STORED,
      message: differs ? PROFILE_DIFFERS_TEXT : PROFILES_NOT_STORED_TEXT,
      context: { deviceId, cause: profiles.cause ?? null, stored: String(profiles.stored), stated: String(profiles.stated), differing: String(profiles.differing) },
    });
  }
  return {
    deviceId,
    outcome: attempt.outcome,
    authenticated: true,
    testedAt,
    usableProfileCount,
    failedAttemptsRemaining: verdict.failedAttemptsRemaining,
    ...(schemeRefused ? { reason: CaptureConnectionTestReason.SCHEME_NOT_ALLOWED } : {}),
    // Row V7 (request of row PR): the answer says whether the profiles were stored, or differ from the stored ones.
    ...(storedWord === undefined ? {} : { profiles: storedWord }),
  };
}

/**
 * THE OUTCOME ENTRY OF A TEST THAT JUDGED A STREAM (row PR, decision C117): the same entry as
 * `recordOutcome` writes, in ONE unit of the host's in which the judged statement first meets what
 * is stored for the camera (`settleStatedProfiles`: nothing stored - it is stored; another
 * statement stored - nothing is). The entry is built INSIDE that unit, after the comparison, and
 * handed back to the host, which appends it: what was stored and the entry that says so commit
 * together or not at all. Of the comparison the entry takes fixed words and whole numbers, in its
 * message; its `details` are the contract's, unchanged.
 * A unit that fails is the fault of `recordOutcome`, by the same code.
 */
async function settleOutcome(host: AdoptedCameraTestHost, caller: AdoptedCameraTestCaller, deviceId: string, adapter: CaptureAdapterKind, facts: OutcomeFacts, stated: readonly AdoptedCameraStream[], at: number): Promise<StoredProfilesComparison> {
  const held: { compared: StoredProfilesComparison | null } = { compared: null };
  try {
    await host.settle(async (scope) => {
      const compared = await settleStatedProfiles(scope, deviceId, stated, at);
      held.compared = compared;
      // Row V7: the entry's DETAILS say it too, in the contract's closed word and counts (the message keeps its words).
      return outcomeEntryOf(caller, deviceId, adapter, { ...facts, ...storedProfilesFactsOf(compared) }, storedProfilesWords(compared));
    });
    // A host that resolved without running the work recorded no entry: the same fault as an entry that failed.
    if (held.compared === null) throw new Error('the unit of a stored-credential connection test ended without its comparison');
  } catch (error) {
    notRecorded(host, deviceId, facts, error);
    throw error;
  }
  return held.compared;
}

/**
 * THE ONE WRITER OF THE OUTCOME ENTRY (rows 146b, 146c): one `CAPTURE_DEVICE_CONNECTION_TESTED`
 * row per test that reached the reader, in one unit of the host's. Codes, a registry id, a flag
 * and a count, by the contract's one builder - it takes no credential, no address and no device
 * text, and this function is handed none: the adapter KIND and the closed facts, nothing of the
 * camera, the credential or the attempt.
 * An entry that cannot be recorded is a fault: a code goes to the log and the persistent error
 * log, and the failure of the unit travels on.
 */
async function recordOutcome(host: AdoptedCameraTestHost, caller: AdoptedCameraTestCaller, deviceId: string, adapter: CaptureAdapterKind, facts: OutcomeFacts): Promise<void> {
  try {
    const outcomeEntry = outcomeEntryOf(caller, deviceId, adapter, facts, '');
    await host.record(outcomeEntry);
  } catch (error) {
    notRecorded(host, deviceId, facts, error);
    throw error;
  }
}

/** The entry itself: the contract's one builder, and a message of closed codes - with, for a test that judged a stream, the fixed words and counts of row PR. */
function outcomeEntryOf(caller: AdoptedCameraTestCaller, deviceId: string, adapter: CaptureAdapterKind, facts: OutcomeFacts, profileWords: string): AuditEntry {
  return {
    type: AuditType.CAPTURE_DEVICE_CONNECTION_TESTED,
    message: `Registered camera connection tested (${facts.unreachableReason === undefined ? facts.outcome : `${facts.outcome}, ${facts.unreachableReason}`})${profileWords}`,
    actorId: caller.principal.operatorId,
    deviceId: caller.principal.deviceId,
    details: captureDeviceConnectionTestedDetails({
      deviceId,
      adapter,
      sourceClass: CaptureSourceClass.PRODUCTION,
      ...facts,
      permission: Permission.CAPTURE_CONFIG,
    }),
  };
}

/** An entry that could not be recorded: a code to the log and the persistent error log. The caller throws the failure on. */
function notRecorded(host: AdoptedCameraTestHost, deviceId: string, facts: OutcomeFacts, error: unknown): void {
  const cause = codeOf((error as { code?: unknown } | null)?.code);
  host.note({ code: ADOPTED_TEST_OUTCOME_NOT_RECORDED, source: SOURCE, deviceId, outcome: facts.outcome, cause }, OUTCOME_NOT_RECORDED_TEXT);
  host.persist({ code: ADOPTED_TEST_OUTCOME_NOT_RECORDED, message: OUTCOME_NOT_RECORDED_TEXT, context: { deviceId, outcome: facts.outcome, cause } });
}

// ── The control of one app ─────────────────────────────────────────────────────────────────────

export interface AdoptedCameraTestControl {
  /**
   * Hands in the reader and the destination rule. ONCE per app, by the production composition
   * (the file that wires the credential holders: `wireCaptureCredentialHolders(...).connectionTest`
   * and the binding of `decideDestination` it gives that wiring as `storedAddress`). A test hands
   * in the wiring on its throw-away database and the loopback rule of `test/support`.
   */
  provide(parts: AdoptedCameraTestParts): void;
  /** True when a test can run: the parts were handed in. */
  ready(): boolean;
  /** One test of a registered camera with its stored credential. */
  test(caller: AdoptedCameraTestCaller, deviceId: string): Promise<AdoptedCameraTest>;
}

const controls = new WeakMap<object, AdoptedCameraTestControl>();

/** The control of an app. Available once the capture-discovery module is registered. */
export function adoptedCameraTestControl(app: { readonly stages: object }): AdoptedCameraTestControl {
  const control = controls.get(app.stages);
  if (control === undefined) throw new Error('the stored-credential connection test is not loaded: register the capture-discovery module before app.ready()');
  return control;
}

/** Builds the control of one app around the host's seams, the connect flow's limits and its tester. Called once, by the module's plugin. */
export function registerAdoptedCameraTest(app: { readonly stages: object }, wiring: { readonly host: AdoptedCameraTestHost; readonly limits: () => ConnectionTestLimits; readonly tester: () => ConnectionTester | null }): AdoptedCameraTestControl {
  let parts: AdoptedCameraTestParts | null = null;
  const seams: AdoptedCameraTestSeams = {
    host: wiring.host,
    // Read at each call: the connect flow's limits may have been replaced by a test.
    get limits() {
      return wiring.limits();
    },
    tester: wiring.tester,
    parts: () => parts,
  };
  const control: AdoptedCameraTestControl = Object.freeze({
    provide(given: AdoptedCameraTestParts): void {
      if (parts !== null) throw new Error('the reader of the stored-credential connection test was provided twice');
      // The two members as they were handed in: this file gives the rule no value of its own (static rule A-10 (b)).
      const { reader, storedAddress } = given;
      parts = Object.freeze({ reader, storedAddress });
    },
    ready: () => parts !== null,
    test: (caller: AdoptedCameraTestCaller, deviceId: string) => testAdoptedCamera(seams, caller, deviceId),
  });
  controls.set(app.stages, control);
  return control;
}
