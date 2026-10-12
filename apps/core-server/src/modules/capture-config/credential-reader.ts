/**
 * THE CREDENTIAL READER: the read path of the stored camera credential (task 4 blueprint row 45,
 * work package WP-06a; design addendum 04 section 2.3 step 2; plan-review finding P12-B2; security
 * check 04 item 2, requirement AD-03, which governs where it corrects the addendum).
 *
 * ONE READ IS ONE UNIT AND ONE AUDIT ENTRY, IN THIS ORDER:
 *
 *   1. before any statement: the holder may say this reason, and the device id has the form of one;
 *   2. ONE unit of work (`app.pipeline.run`): the reveal function is called through the reveal
 *      module beside this file, THEN `CAPTURE_CREDENTIAL_REVEALED` is appended with exactly two
 *      detail keys, the device and the reason - a fact, never a value;
 *   3. the unit COMMITS. This file takes the commit from the unit itself (`unit.afterCommit`), not
 *      from the return of the runner it was handed: a runner that resolves without a commit yields
 *      no credential;
 *   4. only then, OUTSIDE the unit, the envelope is opened with the Core credential store and the
 *      two values are sealed into the opaque `SealedCredential` of the adapter layer.
 *
 * So no path returns a value without its committed entry: the reveal statement fails, the audit
 * append fails, the commit fails - 0 credentials and 0 entries each time (the unit rolled back).
 * And no entry exists without a call of the reveal function before it. The other direction
 * over-reports, which is the safe one: no credential stored for the device, a stored row of an
 * unknown form, an envelope the store cannot open - 0 credentials, 1 entry, 1 error-log code.
 * Every invocation of the function is audited (migration `0005`, SEC35-02).
 *
 * A CLOSED LIST OF HOLDERS, EACH BOUND TO ITS REASONS (AD-03 (1), weakness W-1). The reader is not
 * one function with a `reason` parameter. `createCaptureCredentialReaders` returns a handout that
 * gives each holder of `CAPTURE_CREDENTIAL_HOLDERS` its own reader ONCE: the camera adapter's can
 * say `SESSION_OPEN` and `RELAY_RESTART`, the connection test's `CONNECTION_TEST`. No method takes
 * a reason from its caller; a name outside the list and a second request for the same holder are
 * refused. The importers of this file are a pinned list (`__tests__/static.test.ts`): the wiring
 * builds the handout, a holder receives its reader as a parameter.
 *
 * WHAT IS RETURNED is the opaque `SealedCredential` (`capture/adapters/credential.ts`): it prints
 * as the mark, has no member a serialiser could read, and is read by `usingCredential` and by the
 * injection point only. This file never makes the injection result: `credentialAtInjection` has
 * one caller, the relay start of the production camera adapter (row 46), which has the locator.
 * Nothing is kept here: no member, no cache, no retry. A second read is a second reveal with its
 * own entry.
 *
 * THE DEVICE GATE, BEFORE THE REVEAL (AD-03 (4) with AD-02; row 144). Between step 1 and step 2
 * the reader asks what is STORED for the device and refuses, with 0 statements of the reveal and 0
 * entries: a device that is not registered, not a camera, or not of a PRODUCTION adapter kind
 * (`CAPTURE_CREDENTIAL_DEVICE_REFUSED`); and a camera whose stored address is absent, is not
 * `host` or `host:port`, or fails the destination rule (`CAPTURE_CREDENTIAL_ADDRESS_REFUSED`). The
 * stored facts and the rule are two dependencies: this module cannot import the rule's file (it is
 * inside the closed capture unit), so the composition inside that unit binds `decideDestination`
 * with the purpose of a stored camera to the host's facts and hands it in. The gate reads on the
 * pool, OUTSIDE the unit of step 2; a refusal is one error-log code, never an audit entry: the
 * reveal function was not called.
 *
 * THE SESSION IN THE AUDIT ROW (AD-03 (3); row 145). The two reasons of the camera adapter are said
 * FOR a session, so its two methods take the session beside the device and the entry carries it in
 * the audit row's own `session_id` member - never as a third detail key: the details stay the device
 * and the reason. Per session, the reveal entries with that session are then the cameras of its plan
 * plus its relay restarts. A session that does not have the form of a session id is refused before
 * any statement, like a device id that is none. The connection test is no session's: its entry has
 * no session, and its reader has no parameter for one.
 *
 * "COMMITTED" IS THE SERVER'S ACKNOWLEDGEMENT, NOT THE END OF THE WORK (AD-03 (2); row 145). While a
 * COMMIT is sent and not answered the read is pending and the opener has not been asked; a COMMIT
 * that is refused, a connection that is lost under it and a unit the pipeline's watchdog abandons
 * all end in `CAPTURE_CREDENTIAL_AUDIT_NOT_COMMITTED` with no credential. In the last two the
 * reader cannot know what the server did with the transaction: it answers as if nothing was
 * committed, which errs to an entry without a credential and never to a credential without an entry.
 *
 * NOT HERE: the set-IP job never calls this reader - its credential is the one typed for that
 * operation (decisions C1, C7).
 *
 * Nothing here logs a value. A failure is a `CaptureCredentialReadError`: a code, a device id and
 * a fixed sentence, no cause. The persistent error log gets the code and the name and code of
 * what was thrown (`describeError` reads no message).
 */
import { AuditType } from '@dems/shared/sim';
import { HARDWARE_DEVICE_ID_PATTERN, OPERATOR_ID_PATTERN, SESSION_ID_PATTERN } from '@dems/shared/api';
import { CAPTURE_ADAPTER_KINDS, CaptureSourceClass, sealCredential, sourceClassOf, type CaptureAdapterKind, type SealedCredential } from '../../capture/adapters';
import type { AuditEntry, UnitContext } from '../../core';
import { describeError, type ErrorLog } from '../../plugins/logger';
import { revealCaptureCredential, type RevealedCaptureCredential, type RevealedCaptureEnvelope } from './credential-reveal';

const SOURCE = 'captureConfig.credentialReader';
/** The label of the unit: a name, never request data. */
export const CAPTURE_CREDENTIAL_REVEAL_UNIT = 'captureConfig.credentialReveal';

// ── The closed list of holders ─────────────────────────────────────────────────────────────────

/** Who may hold a reader. Two, and no third without a decision (AD-03 (1)). */
export const CaptureCredentialHolder = { CAMERA_ADAPTER: 'CAMERA_ADAPTER', CONNECTION_TEST: 'CONNECTION_TEST' } as const;
export type CaptureCredentialHolder = (typeof CaptureCredentialHolder)[keyof typeof CaptureCredentialHolder];

/**
 * The reasons each holder can say. Together they are the closed set of three the audit writer
 * accepts for `reason` (`CAPTURE_CREDENTIAL_REVEAL_REASONS` of `core/audit-details.ts`; the test
 * of this file compares the two). Frozen: nothing adds a reason at run time.
 */
export const CAPTURE_CREDENTIAL_HOLDERS = Object.freeze({
  CAMERA_ADAPTER: Object.freeze(['SESSION_OPEN', 'RELAY_RESTART'] as const),
  CONNECTION_TEST: Object.freeze(['CONNECTION_TEST'] as const),
}) satisfies Readonly<Record<CaptureCredentialHolder, readonly string[]>>;
export type CaptureCredentialRevealReasonOf<Holder extends CaptureCredentialHolder> = (typeof CAPTURE_CREDENTIAL_HOLDERS)[Holder][number];

/**
 * The reader of the production camera adapter: one call inside `openSource`, at the injection
 * (addendum 2.3 step 3). Both reasons are said for a session: `sessionId` is the session the plan
 * was built for, never a request field, and it is written into the audit row (AD-03 (3)).
 */
export interface CameraAdapterCredentialReader {
  /** Session start, per camera line of the plan. Actor: none (the start itself is audited with its operator). */
  sessionOpen(deviceId: string, sessionId: string): Promise<SealedCredential>;
  /** A relay started again inside a session (addendum 2.4, only with WP-11). Actor: none. */
  relayRestart(deviceId: string, sessionId: string): Promise<SealedCredential>;
}

/** The reader of the connection test of an ADOPTED camera for which the operator types no credential. */
export interface ConnectionTestCredentialReader {
  /** `operatorId`: the operator of the session that asked, never a request field (SR-65). */
  connectionTest(deviceId: string, operatorId: string): Promise<SealedCredential>;
}

export interface CaptureCredentialReaderOf {
  readonly CAMERA_ADAPTER: CameraAdapterCredentialReader;
  readonly CONNECTION_TEST: ConnectionTestCredentialReader;
}

/** What the wiring holds: each holder's reader, once. */
export interface CaptureCredentialReaderHandout {
  /** `CAPTURE_CREDENTIAL_HOLDER_REFUSED` for a name outside the list and for a holder that took its reader already. */
  take<Holder extends CaptureCredentialHolder>(holder: Holder): CaptureCredentialReaderOf[Holder];
}

// ── Failures ───────────────────────────────────────────────────────────────────────────────────

export const CaptureCredentialReadFailure = {
  /** Not a holder of the closed list, or its reader was handed out already. */
  HOLDER_REFUSED: 'CAPTURE_CREDENTIAL_HOLDER_REFUSED',
  /** The holder cannot say this reason. Nothing was sent. */
  REASON_REFUSED: 'CAPTURE_CREDENTIAL_REASON_REFUSED',
  /** The device id, the session or the actor does not have the form of one (or a session is missing where the reason is a session's). Nothing was sent. */
  REQUEST_INVALID: 'CAPTURE_CREDENTIAL_REQUEST_INVALID',
  /** Not a registered camera of a production adapter kind (or its stored facts could not be read). The reveal function was not called. */
  DEVICE_REFUSED: 'CAPTURE_CREDENTIAL_DEVICE_REFUSED',
  /** The camera's stored address is absent, malformed or refused by the destination rule. The reveal function was not called. */
  ADDRESS_REFUSED: 'CAPTURE_CREDENTIAL_ADDRESS_REFUSED',
  /** The reveal statement failed: nothing was read, nothing was written. */
  REVEAL_FAILED: 'CAPTURE_CREDENTIAL_REVEAL_FAILED',
  /** The audit entry was not committed (the append or the commit failed): no credential is returned. */
  AUDIT_NOT_COMMITTED: 'CAPTURE_CREDENTIAL_AUDIT_NOT_COMMITTED',
  /** The function was called and audited: no credential is stored for this device. */
  NOT_STORED: 'CAPTURE_CREDENTIAL_NOT_STORED',
  /** Audited: the stored row is not of a form the contract knows. */
  ROW_INVALID: 'CAPTURE_CREDENTIAL_ROW_INVALID',
  /** Audited: the Core credential store could not open the envelope (key lost, altered bytes, another device). */
  OPEN_FAILED: 'CAPTURE_CREDENTIAL_OPEN_FAILED',
} as const;
export type CaptureCredentialReadFailure = (typeof CaptureCredentialReadFailure)[keyof typeof CaptureCredentialReadFailure];

const SENTENCES: Readonly<Record<CaptureCredentialReadFailure, string>> = Object.freeze({
  CAPTURE_CREDENTIAL_HOLDER_REFUSED: 'the credential reader is handed to the holders of its closed list, once each',
  CAPTURE_CREDENTIAL_REASON_REFUSED: 'this holder of the credential reader cannot say that reason',
  CAPTURE_CREDENTIAL_REQUEST_INVALID: 'the credential reader takes a registered device id, for a session its session id and, for an operator, an operator id',
  CAPTURE_CREDENTIAL_DEVICE_REFUSED: 'the credential reader serves a registered camera of a production kind and no other device',
  CAPTURE_CREDENTIAL_ADDRESS_REFUSED: 'the stored address of this camera is not one the Core may dial: its credential is not read',
  CAPTURE_CREDENTIAL_REVEAL_FAILED: 'the stored camera credential could not be read',
  CAPTURE_CREDENTIAL_AUDIT_NOT_COMMITTED: 'the reveal of the camera credential was not audited: no credential is returned',
  CAPTURE_CREDENTIAL_NOT_STORED: 'no credential is stored for this camera',
  CAPTURE_CREDENTIAL_ROW_INVALID: 'the stored camera credential is not of a form the contract knows',
  CAPTURE_CREDENTIAL_OPEN_FAILED: 'the stored camera credential could not be opened',
});

/** A code, at most a device id, a fixed sentence. Never a cause: nothing of what was thrown underneath travels with it. */
export class CaptureCredentialReadError extends Error {
  readonly code: CaptureCredentialReadFailure;
  readonly deviceId: string | null;

  constructor(code: CaptureCredentialReadFailure, deviceId: string | null = null) {
    super(SENTENCES[code]);
    this.name = 'CaptureCredentialReadError';
    this.code = code;
    this.deviceId = deviceId;
  }
}

// ── The reader ─────────────────────────────────────────────────────────────────────────────────

export interface CaptureCredentialReaderDependencies {
  /** One server-native unit of work (`app.pipeline.run`): commit when `work` returns, rollback when it throws. */
  unit<Value>(label: string, work: (unit: UnitContext) => Promise<Value>): Promise<Value>;
  /** The opener of the Core credential store for a camera credential (`store.capture.open`): bound to the device. */
  open(deviceId: string, sealed: RevealedCaptureEnvelope): string;
  /** The persistent error log (`app.errorLog`). */
  readonly errorLog: Pick<ErrorLog, 'append'>;
  /**
   * What is STORED for a device (`capture_devices`), or null for an id that is not registered.
   * Read on the pool, outside any unit of work. Never taken from a request.
   */
  device(deviceId: string): Promise<CaptureCredentialDevice | null>;
  /**
   * The destination rule on a STORED camera address (AD-02): `decideDestination` with the purpose
   * `STORED_CAMERA`, bound to the host's facts by the composition inside the capture unit. `port`
   * is left out when the stored address names none. There is no permissive value under `src/`.
   */
  storedAddress(host: string, port: number | undefined): StoredCameraAddressDecision;
}

/** The three stored facts the gate reads. Open texts: the reader holds them to the closed sets itself. */
export interface CaptureCredentialDevice {
  /** `capture_devices.kind`. */
  readonly kind: string;
  /** `capture_devices.adapter_kind`. */
  readonly adapterKind: string;
  /** `capture_devices.address`: `host`, or `host:port` (what adoption stores). */
  readonly address: string | null;
}

/** The answer of the destination rule, as far as the gate reads it (`DestinationDecision` fits it). */
export type StoredCameraAddressDecision = { readonly allowed: true } | { readonly allowed: false; readonly refusal: string };

/** Why the gate refused an address, where the rule itself was not asked. */
export const StoredAddressRefusal = { ABSENT: 'STORED_ADDRESS_ABSENT', MALFORMED: 'STORED_ADDRESS_MALFORMED', RULE_FAILED: 'STORED_ADDRESS_RULE_FAILED' } as const;

/** A refusal is named by a code in the error log; anything else a rule answered is not copied. */
const REFUSAL_CODE = /^[A-Z][A-Z0-9_]{0,47}$/;
/** `host` or `host:port`, nothing before, between or after: no scheme, no user part, no path. The rule judges the host. */
const STORED_ADDRESS = /^([0-9A-Za-z.-]{1,100})(?::([0-9]{1,5}))?$/;

/** True for a camera row whose adapter kind is one of the closed set AND of the production class. */
function isProductionCamera(device: CaptureCredentialDevice): boolean {
  if (device.kind !== 'CAMERA') return false;
  const kind = (CAPTURE_ADAPTER_KINDS as readonly string[]).includes(device.adapterKind) ? (device.adapterKind as CaptureAdapterKind) : null;
  return kind !== null && sourceClassOf(kind) === CaptureSourceClass.PRODUCTION;
}

type AnyReason = CaptureCredentialRevealReasonOf<CaptureCredentialHolder>;

/**
 * The reasons that are said FOR a session (AD-03 (3)): a read with one of them names its session,
 * a read with any other reason names none. Frozen; the two are the camera adapter's.
 */
export const CAPTURE_CREDENTIAL_SESSION_REASONS: readonly AnyReason[] = Object.freeze(['SESSION_OPEN', 'RELAY_RESTART'] as const);

/**
 * The fact of one reveal: the device and the reason as its details, and nothing else there (SEC35-02;
 * `core/audit-details.ts`). A reveal for a session carries the session as a member of the ROW
 * (`session_id`); an entry of the connection test has no such member at all.
 */
const revealedEntry = (deviceId: string, reason: AnyReason, actorId: string | null, sessionId: string | null): AuditEntry => ({
  type: AuditType.CAPTURE_CREDENTIAL_REVEALED,
  message: 'Camera credential revealed',
  actorId,
  deviceId,
  ...(sessionId === null ? {} : { sessionId }),
  details: { deviceId, reason },
});

/**
 * Builds the readers of one app and returns the handout the wiring gives them out with. Called in
 * one place per app, by a file of the pinned importer list.
 */
export function createCaptureCredentialReaders(dependencies: CaptureCredentialReaderDependencies): CaptureCredentialReaderHandout {
  const { unit: runUnit, open, errorLog, device: storedDevice, storedAddress } = dependencies;

  const failed = (code: CaptureCredentialReadFailure, deviceId: string, reason: AnyReason, thrown?: unknown, refusal?: string): CaptureCredentialReadError => {
    const described = thrown === undefined ? {} : describeError(thrown);
    // The reader's own code is the entry's code; what was thrown underneath is named, never quoted.
    const { code: causeCode, ...rest } = described as { code?: string; errorName?: string; causeName?: string; stackTrace?: string };
    errorLog.append({
      level: 'error',
      source: SOURCE,
      message: SENTENCES[code],
      ...rest,
      code,
      context: { deviceId, reason, ...(causeCode === undefined ? {} : { causeCode }), ...(refusal === undefined ? {} : { refusal }) },
    });
    return new CaptureCredentialReadError(code, deviceId);
  };

  /**
   * The device gate (AD-03 (4), AD-02). Resolves for a registered production camera whose stored
   * address passes the rule; throws the named refusal otherwise. No statement of the reveal has
   * been sent when it throws.
   */
  async function admit(deviceId: string, reason: AnyReason): Promise<void> {
    let stored: CaptureCredentialDevice | null;
    try {
      stored = await storedDevice(deviceId);
    } catch (error) {
      throw failed(CaptureCredentialReadFailure.DEVICE_REFUSED, deviceId, reason, error);
    }
    if (stored === null || typeof stored !== 'object' || !isProductionCamera(stored)) throw failed(CaptureCredentialReadFailure.DEVICE_REFUSED, deviceId, reason);
    if (typeof stored.address !== 'string' || stored.address === '') throw failed(CaptureCredentialReadFailure.ADDRESS_REFUSED, deviceId, reason, undefined, StoredAddressRefusal.ABSENT);
    const parts = STORED_ADDRESS.exec(stored.address);
    if (parts === null || parts[1] === undefined) throw failed(CaptureCredentialReadFailure.ADDRESS_REFUSED, deviceId, reason, undefined, StoredAddressRefusal.MALFORMED);
    let decision: StoredCameraAddressDecision;
    try {
      decision = storedAddress(parts[1], parts[2] === undefined ? undefined : Number(parts[2]));
    } catch (error) {
      throw failed(CaptureCredentialReadFailure.ADDRESS_REFUSED, deviceId, reason, error, StoredAddressRefusal.RULE_FAILED);
    }
    // Allowed is the literal `true` of the rule's answer, and nothing that merely is not a refusal.
    if (typeof decision !== 'object' || decision === null || decision.allowed !== true) {
      const named = typeof decision === 'object' && decision !== null && typeof decision.refusal === 'string' && REFUSAL_CODE.test(decision.refusal) ? decision.refusal : StoredAddressRefusal.RULE_FAILED;
      throw failed(CaptureCredentialReadFailure.ADDRESS_REFUSED, deviceId, reason, undefined, named);
    }
  }

  /** The one path. Closure-private: a holder reaches it through its bound methods only. */
  async function read(holder: CaptureCredentialHolder, reason: AnyReason, deviceId: string, actorId: string | null, sessionId: string | null): Promise<SealedCredential> {
    // 1. Before any statement.
    if (!(CAPTURE_CREDENTIAL_HOLDERS[holder] as readonly string[]).includes(reason)) throw new CaptureCredentialReadError(CaptureCredentialReadFailure.REASON_REFUSED);
    if (typeof deviceId !== 'string' || !HARDWARE_DEVICE_ID_PATTERN.test(deviceId)) throw new CaptureCredentialReadError(CaptureCredentialReadFailure.REQUEST_INVALID);
    if (actorId !== null && (typeof actorId !== 'string' || !OPERATOR_ID_PATTERN.test(actorId))) throw new CaptureCredentialReadError(CaptureCredentialReadFailure.REQUEST_INVALID, deviceId);
    // AD-03 (3): a session's reason names its session, in the form of one; any other reason names none.
    const forSession = CAPTURE_CREDENTIAL_SESSION_REASONS.includes(reason);
    if (forSession ? typeof sessionId !== 'string' || !SESSION_ID_PATTERN.test(sessionId) : sessionId !== null) throw new CaptureCredentialReadError(CaptureCredentialReadFailure.REQUEST_INVALID, deviceId);

    // 1b. The device gate, on what is stored: before the reveal, outside the unit.
    await admit(deviceId, reason);

    // 2. and 3. The reveal and its audit entry, one unit; its commit.
    const progress: { stage: 'reveal' | 'audit'; committed: boolean } = { stage: 'reveal', committed: false };
    let revealed: RevealedCaptureCredential;
    try {
      revealed = await runUnit(CAPTURE_CREDENTIAL_REVEAL_UNIT, async (unit) => {
        const answer = await revealCaptureCredential(unit, deviceId);
        progress.stage = 'audit';
        await unit.audit.append(revealedEntry(deviceId, reason, actorId, sessionId));
        // Runs after the server ACKNOWLEDGED the commit of THIS unit and before the runner resolves;
        // never after a rollback, a refused COMMIT, a lost connection or an abandoned unit.
        unit.afterCommit(() => {
          progress.committed = true;
        });
        return answer;
      });
    } catch (error) {
      throw failed(progress.stage === 'reveal' ? CaptureCredentialReadFailure.REVEAL_FAILED : CaptureCredentialReadFailure.AUDIT_NOT_COMMITTED, deviceId, reason, error);
    }
    if (!progress.committed) throw failed(CaptureCredentialReadFailure.AUDIT_NOT_COMMITTED, deviceId, reason);

    // 4. The entry is committed. Only now can a credential exist.
    if (revealed.kind === 'NONE') throw failed(CaptureCredentialReadFailure.NOT_STORED, deviceId, reason);
    if (revealed.kind === 'INVALID') throw failed(CaptureCredentialReadFailure.ROW_INVALID, deviceId, reason);
    try {
      // The secret has no name here: it goes from the opener into the opaque object.
      return sealCredential({ username: revealed.username, secret: open(deviceId, revealed.sealed) });
    } catch (error) {
      throw failed(CaptureCredentialReadFailure.OPEN_FAILED, deviceId, reason, error);
    }
  }

  const readers: { readonly [Holder in CaptureCredentialHolder]: CaptureCredentialReaderOf[Holder] } = Object.freeze({
    CAMERA_ADAPTER: Object.freeze({
      // A session is required: `read` refuses anything that is not a session id for these two reasons.
      sessionOpen: (deviceId: string, sessionId: string) => read(CaptureCredentialHolder.CAMERA_ADAPTER, 'SESSION_OPEN', deviceId, null, sessionId),
      relayRestart: (deviceId: string, sessionId: string) => read(CaptureCredentialHolder.CAMERA_ADAPTER, 'RELAY_RESTART', deviceId, null, sessionId),
    }),
    CONNECTION_TEST: Object.freeze({
      // An operator is required: a connection test without one is not this reason. No session: it is no session's read.
      connectionTest: (deviceId: string, operatorId: string) =>
        typeof operatorId === 'string' ? read(CaptureCredentialHolder.CONNECTION_TEST, 'CONNECTION_TEST', deviceId, operatorId, null) : Promise.reject(new CaptureCredentialReadError(CaptureCredentialReadFailure.REQUEST_INVALID)),
    }),
  });

  const taken = new Set<string>();
  return Object.freeze({
    take<Holder extends CaptureCredentialHolder>(holder: Holder): CaptureCredentialReaderOf[Holder] {
      if (typeof holder !== 'string' || !Object.hasOwn(readers, holder) || taken.has(holder)) throw new CaptureCredentialReadError(CaptureCredentialReadFailure.HOLDER_REFUSED);
      taken.add(holder);
      return readers[holder];
    },
  });
}
