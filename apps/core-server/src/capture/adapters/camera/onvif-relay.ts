/**
 * THE PRODUCTION CAMERA ADAPTER, adapter kind `ONVIF_RTSP`, WITH AN OPENER (task 4 blueprint row
 * 46, work package WP-06b; design addendum 2.3, 3.2, 6.2; security AD-02, AD-03, AD-05, AD-09 (3),
 * BR-07, BR-08, S13-01, S13-02; decisions C34 to C37, C40).
 *
 * REGISTERED NOWHERE. This file stands beside the class-C stub `onvif-rtsp.ts`, which stays the
 * adapter the loader `../real.ts` names. No boot path imports this file: it states an opener for a
 * kind the registry has none for, so a real registry REFUSES it (`CAPTURE_ADAPTER_INVALID`) until
 * the lift (WP-13, rows 85 and 88). Until then it is built and proven at adapter level only.
 *
 * `openSource(deviceId, target, signal)`, IN THIS ORDER (addendum 2.3 step 3):
 *
 *   0. refusals before anything is asked: an aborted signal, a device this adapter does not serve,
 *      a target without a profile (`CAPTURE_PROFILE_UNKNOWN`: NO default profile stands in for the
 *      stream's statement, C36), a target without its session or attempt, no relay program, a
 *      relay of the same device AND profile that is still alive;
 *   1. the stored facts of the stream: the camera's own address as a candidate and the ONVIF token
 *      of the plan's profile code (`stream`, handed in by the composition; none: profile unknown);
 *  1b. THE DESTINATION RULE ON THAT STORED ADDRESS (row 143; AD-02 (1)): `judgeStoredCamera` with
 *      the rule handed in (`storedAddress`). The stored value is untrusted - the runtime database
 *      role can write it - so a loopback, unspecified, link-local, multicast, public or
 *      out-of-subnet address, and an address of the Core host itself, is refused HERE by
 *      `CAPTURE_CAMERA_ADDRESS_REFUSED` with the rule's own code as the reason: before the reader
 *      is called (0 reveals, 0 audit entries), before any request and before any process. A rule
 *      that was not handed in refuses every open: this file holds no permissive value;
 *      THE SOURCE HALF (row 143b; S13-11 point 2): the same judgement names the camera-interface
 *      address the connection must be made FROM (`storedCameraSourceOf`). An admission that names
 *      none is refused here too (`STORED_ADDRESS_SOURCE_ABSENT`); the address goes to the locator
 *      read of step 3 (its local address) and into the relay's start message of step 4 (`source`:
 *      the relay gives it to its socket before it connects, at the first open and every re-open);
 *   2. the credential reader, ONCE: `credentials.sessionOpen(deviceId, sessionId)`. The reader
 *      reveals and audits in one unit of its own, and its device gate holds the stored address to
 *      the destination rule BEFORE the reveal (AD-02, AD-03 (4)). THIS ADAPTER OPENS NO UNIT OF
 *      WORK AND MUST NOT BE CALLED INSIDE ONE: a read from inside a unit is refused by the reader;
 *   3. ONE authenticated `GetStreamUri` for that token (`locator.locate`): the locator is resolved
 *      at each start of a relay and kept nowhere (H-11);
 *   4. the relay start (`relay-start.ts`: the injection point, the start message, the production
 *      door) with the session's ingest address for this track and attempt, unchanged;
 *   5. the wait for the relay's own word that the worker took its push (`PUSH_ESTABLISHED`), or
 *      for its end, which is a named refusal by its exit code.
 *
 * THE BOUND. The whole open is bounded at `CAMERA_OPEN_BOUND_MS` (25,000 ms: the production
 * ingest window of 30,000 ms minus 5,000 ms, addendum 3.2). At the bound, and when the signal is
 * aborted during the open, a started relay is KILLED AND REAPED before the open rejects (AD-09
 * (3)). Nothing is retried: a second open is a second reveal with its own audit entry.
 *
 * THE HANDLE. `close()` ends the relay within a bound: the end of its standard input is its order
 * to stop; a relay that has not ended after `CAMERA_RELAY_STOP_BOUND_MS` is killed; `close()`
 * resolves when the relay has been waited for, so that no report of an attempt the session left
 * behind can follow it (row 48, item 3). Closing twice is safe. The signal of the open stays the
 * relay's: aborted after the open, the source is closed the same way.
 *
 * WHAT IT TELLS, AND TO WHOM (it logs nothing itself: static rule G-R4):
 *   - `relayReports`: the source of the relay's side of the pairing SA-3 (`RelayIngestReports` of
 *     the session unit, by shape). Successes only, each naming session, device and attempt. A
 *     report of a relay that is being ended, or of an attempt a later open of the same session
 *     superseded, is DROPPED and counted (C37): it never reaches the pairing;
 *   - on the same source, with the member `leg` (finding F3-01 of the M3 review): the relay's word
 *     that its camera leg was LOST inside a session and that it was REOPENED (row 43). Told with the
 *     relay's first line of a loss, so that the camera's fault stands at once and not after the
 *     relay's six tries (62 s of waits). The same C37 rule; the push stands through both, so they
 *     are no report of the pairing;
 *   - `relayEnded`: a relay that ends by itself after its open is said ONCE, with its named cause;
 *   - a refusal of an open is a thrown error with a code: `CaptureAdapterError` for the layer's
 *     own (aborted, unknown device, unknown profile) and `CameraOpenError` for the camera path.
 *     A gate refusal of the worker (`CAPTURE_CAMERA_INGEST_REFUSED`) is its own code, apart from
 *     a camera that is absent (`CAPTURE_CAMERA_UNREACHABLE`): C35 (a) against C40 (2).
 *
 * WHAT IT KEEPS: per live relay its device, profile, session and attempt, and the process. NO
 * address: not the camera's, not the locator, not the ingest address (row 179: the address of an
 * attempt comes with the open and goes to the start message only). NO credential: the opaque
 * object lives inside one call of `openSource`.
 *
 * NOT BUILT HERE: the search and the connection test (the adapters of rows 131 and 142 serve
 * them; the stream-level half is row 50; the test of an ADOPTED camera with its stored credential
 * is row 146, in the connect flow, behind the same judgement), presence and the clock offset (row
 * 49: `camera-watch.ts`, which asks the same judgement before each of its reads - the adapter's
 * `ntpOffsetMs` is that watch's read and holds no address itself). `pullUrl` refuses by a named
 * code: the locator of a production camera never crosses the adapter boundary (P12-F05 a).
 */
import type { CaptureTimers } from '../../types';
import type { SealedCredential } from '../credential';
import { CaptureAdapterError, CaptureAdapterRefusal } from '../errors';
import { CaptureAdapterKind, sourceClassOf } from '../kinds';
import type { ProductionDoor, ProductionExit, ProductionProcess } from '../production-door';
import { ConnectionTestOutcome, type CameraAdapter, type CameraCandidate, type CameraSourceTarget, type CaptureDeviceEntry, type SourceHandle } from '../types';
import type { OnvifStreamLocator } from './onvif-session';
import { RELAY_ATTEMPT_MAX, RelayReportKind, createRelayReportReader, startCameraRelay, type RelayReport } from './relay-start';
import { judgeStoredCamera, storedCameraSourceOf, type StoredCameraAddressRule } from './stored-address';

/** The bound of one `openSource`: the production ingest window minus 5,000 ms (addendum 3.2). */
export const CAMERA_OPEN_BOUND_MS = 25_000;
/** How long a relay has to end after its standard input ended, before it is killed. */
export const CAMERA_RELAY_STOP_BOUND_MS = 3_000;
/** How long a killed relay is waited for. A relay that is still there after it is named, never forgotten. */
export const CAMERA_RELAY_REAP_BOUND_MS = 2_000;

/** The refusals of the camera path of this adapter. Codes only; each has one fixed sentence. */
export const CameraOpenRefusal = {
  /** The target names no session, or no attempt, of the form the session start hands in. */
  SESSION_UNKNOWN: 'CAPTURE_CAMERA_SESSION_UNKNOWN',
  /** No relay program is configured (`captureRelayPath`). */
  RELAY_NOT_CONFIGURED: 'CAPTURE_CAMERA_RELAY_NOT_CONFIGURED',
  /** A relay of this device and profile is still alive. */
  ALREADY_OPEN: 'CAPTURE_CAMERA_ALREADY_OPEN',
  /** The stored facts of the stream could not be read. */
  STREAM_FACTS_NOT_READ: 'CAPTURE_CAMERA_STREAM_FACTS_NOT_READ',
  /** The STORED address of the camera is refused by the destination rule (its own code is the reason), or no rule was handed in (row 143; AD-02). Nothing was read, asked or started. */
  ADDRESS_REFUSED: 'CAPTURE_CAMERA_ADDRESS_REFUSED',
  /** The credential reader answered no credential (its own code is the reason): a refused device or address, nothing stored, a reveal that was not audited. */
  CREDENTIAL_NOT_READ: 'CAPTURE_CAMERA_CREDENTIAL_NOT_READ',
  /** The camera did not answer: the ONVIF read, or the relay's connection. A camera that is absent (C35 a). */
  UNREACHABLE: 'CAPTURE_CAMERA_UNREACHABLE',
  /** The camera refused the credential (ONVIF or the stream). Counted by the camera's own lock-out. */
  AUTHENTICATION_REFUSED: 'CAPTURE_CAMERA_AUTHENTICATION_REFUSED',
  /** The camera asked for a scheme the relay never answers (S13-01): nothing derived from the secret was sent. */
  AUTH_SCHEME_REFUSED: 'CAPTURE_CAMERA_AUTH_SCHEME_REFUSED',
  /** The camera names no usable stream address for the profile, or has no stream there. */
  LOCATOR_REFUSED: 'CAPTURE_CAMERA_LOCATOR_REFUSED',
  /** What the camera sent is not a stream the relay takes: protocol, redirect, foreign control address, description, transport, codec, pictures. */
  STREAM_REFUSED: 'CAPTURE_CAMERA_STREAM_REFUSED',
  /** The camera's stream ended or stalled. */
  STREAM_LOST: 'CAPTURE_CAMERA_STREAM_LOST',
  /** The worker did not take the relay's push: the refusal of its gate (C40 (2)), or no listener. */
  INGEST_REFUSED: 'CAPTURE_CAMERA_INGEST_REFUSED',
  /** The worker went away under the push. */
  INGEST_LOST: 'CAPTURE_CAMERA_INGEST_LOST',
  /** The door refused the start (its own code is the reason). */
  RELAY_NOT_STARTED: 'CAPTURE_CAMERA_RELAY_NOT_STARTED',
  /** The relay ended for a cause of its own: its start message, its build, its rules, a signal. */
  RELAY_FAILED: 'CAPTURE_CAMERA_RELAY_FAILED',
  /** The relay ended by its order to stop although nobody had closed the source. */
  RELAY_STOPPED: 'CAPTURE_CAMERA_RELAY_STOPPED',
  /** The open did not come up inside `CAMERA_OPEN_BOUND_MS`. The relay was killed. */
  OPEN_TIMEOUT: 'CAPTURE_CAMERA_OPEN_TIMEOUT',
  /** A killed relay had not ended inside `CAMERA_RELAY_REAP_BOUND_MS`. */
  RELAY_NOT_REAPED: 'CAPTURE_CAMERA_RELAY_NOT_REAPED',
  /** `pullUrl`: the locator of a production camera is resolved inside `openSource` and handed to nobody. */
  LOCATOR_RESOLVED_AT_OPEN: 'CAPTURE_CAMERA_LOCATOR_RESOLVED_AT_OPEN',
} as const;
export type CameraOpenRefusal = (typeof CameraOpenRefusal)[keyof typeof CameraOpenRefusal];

const SENTENCE: Readonly<Record<CameraOpenRefusal, string>> = Object.freeze({
  CAPTURE_CAMERA_SESSION_UNKNOWN: 'a production camera is opened for a session and an attempt',
  CAPTURE_CAMERA_RELAY_NOT_CONFIGURED: 'no relay program is configured',
  CAPTURE_CAMERA_ALREADY_OPEN: 'a source of this camera and profile is open already',
  CAPTURE_CAMERA_STREAM_FACTS_NOT_READ: 'the stored facts of the camera stream could not be read',
  CAPTURE_CAMERA_ADDRESS_REFUSED: 'the stored address of this camera is not one the Core connects to',
  CAPTURE_CAMERA_CREDENTIAL_NOT_READ: 'no stored credential was read for this camera',
  CAPTURE_CAMERA_UNREACHABLE: 'the camera did not answer',
  CAPTURE_CAMERA_AUTHENTICATION_REFUSED: 'the camera refused the stored credential',
  CAPTURE_CAMERA_AUTH_SCHEME_REFUSED: 'the camera asked for an authentication scheme that is never answered',
  CAPTURE_CAMERA_LOCATOR_REFUSED: 'the camera names no usable stream for this profile',
  CAPTURE_CAMERA_STREAM_REFUSED: 'the camera stream is not one the relay takes',
  CAPTURE_CAMERA_STREAM_LOST: 'the camera stream ended',
  CAPTURE_CAMERA_INGEST_REFUSED: 'the capture worker did not take the push of this camera',
  CAPTURE_CAMERA_INGEST_LOST: 'the capture worker went away under the push of this camera',
  CAPTURE_CAMERA_RELAY_NOT_STARTED: 'the relay of this camera could not be started',
  CAPTURE_CAMERA_RELAY_FAILED: 'the relay of this camera ended for a cause of its own',
  CAPTURE_CAMERA_RELAY_STOPPED: 'the relay of this camera stopped',
  CAPTURE_CAMERA_OPEN_TIMEOUT: 'the camera source did not come up in time',
  CAPTURE_CAMERA_RELAY_NOT_REAPED: 'the relay of this camera had not ended when it was waited for',
  CAPTURE_CAMERA_LOCATOR_RESOLVED_AT_OPEN: 'the stream locator of a production camera is resolved when its source is opened',
});

/** A code word of another unit, as a reason: upper-case words, never a value. */
const REASON_WORD = /^[A-Z][A-Z0-9_]{0,63}$/;
const reasonOf = (value: unknown): string | null => (typeof value === 'string' && REASON_WORD.test(value) ? value : null);

/**
 * A refusal of the camera path: a code, the device, and at most the code word of the unit that
 * refused underneath (the reader's failure, the ONVIF reason, the door's refusal, the relay's
 * exit word). A fixed sentence, no cause: nothing of what was thrown underneath travels with it.
 */
export class CameraOpenError extends Error {
  readonly code: CameraOpenRefusal;
  readonly deviceId: string | null;
  readonly reason: string | null;
  constructor(code: CameraOpenRefusal, deviceId: string | null = null, reason: string | null = null) {
    super(SENTENCE[code]);
    this.name = 'CameraOpenError';
    this.code = code;
    this.deviceId = deviceId;
    this.reason = reasonOf(reason);
  }
}

/** The exit codes of the relay (its header `relay.h`): the word of each, and what it means for a camera source. */
const RELAY_EXIT: Readonly<Record<number, { readonly word: string; readonly refusal: CameraOpenRefusal }>> = Object.freeze({
  0: { word: 'STOPPED', refusal: CameraOpenRefusal.RELAY_STOPPED },
  2: { word: 'USAGE', refusal: CameraOpenRefusal.RELAY_FAILED },
  10: { word: 'START_MESSAGE_INVALID', refusal: CameraOpenRefusal.RELAY_FAILED },
  11: { word: 'START_MESSAGE_TIMEOUT', refusal: CameraOpenRefusal.RELAY_FAILED },
  12: { word: 'LIBAVFORMAT_VERSION_MISMATCH', refusal: CameraOpenRefusal.RELAY_FAILED },
  13: { word: 'HYGIENE_FAILED', refusal: CameraOpenRefusal.RELAY_FAILED },
  20: { word: 'CAMERA_UNREACHABLE', refusal: CameraOpenRefusal.UNREACHABLE },
  21: { word: 'CAMERA_PROTOCOL', refusal: CameraOpenRefusal.STREAM_REFUSED },
  22: { word: 'AUTH_SCHEME_NOT_ALLOWED', refusal: CameraOpenRefusal.AUTH_SCHEME_REFUSED },
  23: { word: 'AUTH_REFUSED', refusal: CameraOpenRefusal.AUTHENTICATION_REFUSED },
  24: { word: 'LOCATOR_NOT_FOUND', refusal: CameraOpenRefusal.LOCATOR_REFUSED },
  25: { word: 'REDIRECT_REFUSED', refusal: CameraOpenRefusal.STREAM_REFUSED },
  26: { word: 'CONTROL_ADDRESS_REFUSED', refusal: CameraOpenRefusal.STREAM_REFUSED },
  27: { word: 'DESCRIPTION_INVALID', refusal: CameraOpenRefusal.STREAM_REFUSED },
  28: { word: 'CODEC_NOT_SUPPORTED', refusal: CameraOpenRefusal.STREAM_REFUSED },
  29: { word: 'TRANSPORT_REFUSED', refusal: CameraOpenRefusal.STREAM_REFUSED },
  30: { word: 'KEYFRAME_TIMEOUT', refusal: CameraOpenRefusal.STREAM_REFUSED },
  31: { word: 'CAMERA_STALLED', refusal: CameraOpenRefusal.STREAM_LOST },
  32: { word: 'CAMERA_LOST', refusal: CameraOpenRefusal.STREAM_LOST },
  33: { word: 'STREAM_INVALID', refusal: CameraOpenRefusal.STREAM_REFUSED },
  40: { word: 'INGEST_REFUSED', refusal: CameraOpenRefusal.INGEST_REFUSED },
  41: { word: 'INGEST_LOST', refusal: CameraOpenRefusal.INGEST_LOST },
  42: { word: 'SOCKET_RULE', refusal: CameraOpenRefusal.RELAY_FAILED },
  43: { word: 'REPORT_NOT_WRITTEN', refusal: CameraOpenRefusal.RELAY_FAILED },
  70: { word: 'INTERNAL', refusal: CameraOpenRefusal.RELAY_FAILED },
});

/** What the end of a relay means: a code of this file and the relay's own word (or how it ended without one). */
export function relayEndOf(exit: Pick<ProductionExit, 'exitCode' | 'signal' | 'spawnFailed'>): { readonly refusal: CameraOpenRefusal; readonly reason: string } {
  if (exit.spawnFailed) return { refusal: CameraOpenRefusal.RELAY_NOT_STARTED, reason: 'NOT_STARTED' };
  if (exit.exitCode === null) return { refusal: CameraOpenRefusal.RELAY_FAILED, reason: 'ENDED_BY_SIGNAL' };
  const known = Object.hasOwn(RELAY_EXIT, exit.exitCode) ? RELAY_EXIT[exit.exitCode] : undefined;
  return known === undefined ? { refusal: CameraOpenRefusal.RELAY_FAILED, reason: 'EXIT_CODE_UNKNOWN' } : { refusal: known.refusal, reason: known.word };
}

/** The stored facts of one stream of an adopted camera, as the composition reads them. */
export interface StoredCameraStream {
  /** The camera at its STORED address, in the form the ONVIF session takes: its own host, its service address on that host. */
  readonly candidate: CameraCandidate;
  /** The ONVIF profile token stored for the profile code (`capture_device_streams.onvif_profile_token`). */
  readonly onvifProfileToken: string;
}

/**
 * THE RELAY'S WORD ABOUT ITS CAMERA LEG INSIDE A SESSION (task 4 row 43; finding F3-01 of the M3
 * review). The push to the worker STANDS through both: the worker sees one connection and writes
 * one file, so neither is a report of the pairing.
 *   LOST      the leg ended and the relay opens it again (up to 6 tries, 62 s of waits). `cause`
 *             is the relay's own exit word for that end (`CAMERA_LOST`, `CAMERA_STALLED`,
 *             `CAMERA_UNREACHABLE`, `AUTH_REFUSED`);
 *   REOPENED  the first keyframe of the new leg is about to be forwarded: the loss `loss` is over.
 *             `gapMs` is the relay's own measure from the loss to that keyframe, `heldBack` the
 *             pictures it held back before it, `tries` the tries the re-open took.
 * Numbers and code words only. A loss that is never followed by its `REOPENED` ends with the
 * relay: `relayEnded` says it (codes 20 / 31 / 32 after the open: the tries are used up).
 */
export type CameraLegReport =
  | { readonly event: 'LOST'; readonly profile: string; readonly loss: number; readonly cause: string }
  | { readonly event: 'REOPENED'; readonly profile: string; readonly loss: number; readonly tries: number; readonly heldBack: number; readonly gapMs: number };

/** The relay's side of the pairing SA-3: the shape of `RelayIngestReport` of the session unit. */
export interface CameraRelayReport {
  readonly sessionId: string;
  readonly deviceId: string;
  readonly attempt: number;
  /**
   * ABSENT on the report of an established push - the one report the pairing counts. PRESENT on a
   * word about the camera leg of a relay whose push is established already: such a report is NOT
   * an established push, and a listener that pairs must not count it (the session and the camera
   * watch each read this member first).
   */
  readonly leg?: CameraLegReport;
}

/** A relay that ended by itself after its source was open. */
export interface CameraRelayEnd extends CameraRelayReport {
  readonly profile: string;
  readonly code: CameraOpenRefusal;
  /** The relay's own exit word, or how it ended without one. */
  readonly reason: string;
}

/** A fact the composition may log: a code and identifiers, never a value. */
export interface CameraRelayNote extends CameraRelayReport {
  readonly code: 'CAPTURE_RELAY_REPORT_SUPERSEDED' | 'CAPTURE_RELAY_REPORT_ATTEMPT_DIFFERS' | 'CAPTURE_RELAY_REPORT_OUT_OF_ORDER' | 'CAPTURE_RELAY_NOT_REAPED' | 'CAPTURE_RELAY_LISTENER_FAILED';
}

/** The reader of the production camera adapter, by shape: the holder receives it as a parameter and imports nothing of its module (AD-03 (1)). */
export interface CameraSessionCredentialReader {
  sessionOpen(deviceId: string, sessionId: string): Promise<SealedCredential>;
}

export interface OnvifRelayCameraDependencies {
  /** The production process door (`startProductionProcess`). */
  readonly door: ProductionDoor;
  /** The relay program (`captureRelayPath` of the configuration): an absolute path, or null when none is configured. */
  readonly relayProgram: string | null;
  readonly timers: CaptureTimers;
  /** The reader taken for the holder `CAMERA_ADAPTER`. Called once per open, outside any unit of work. */
  readonly credentials: CameraSessionCredentialReader;
  /** The locator read of the ONVIF session (`createOnvifStreamLocator`). */
  readonly locator: OnvifStreamLocator;
  /** The stored facts of a stream, or null when the device has no stream of that profile code. */
  readonly stream: (deviceId: string, profile: string) => Promise<StoredCameraStream | null>;
  /**
   * THE DESTINATION RULE ON A STORED CAMERA ADDRESS (task 4 row 143; AD-02): `decideDestination`
   * with the purpose `STORED_CAMERA`, bound to the host's facts (camera interface, camera subnet,
   * the host's own addresses) by the composition - the SAME binding the credential wiring is given
   * as its `storedAddress`. Asked at every open, about what `stream` answered, before the reader.
   * Optional in the type only so that a composition without it still compiles: WITHOUT IT EVERY
   * OPEN IS REFUSED (`CAPTURE_CAMERA_ADDRESS_REFUSED`, reason `STORED_ADDRESS_RULE_ABSENT`). There
   * is no permissive value under `src/`; a loopback test hands in the rule of `test/support`.
   */
  readonly storedAddress?: StoredCameraAddressRule;
  /** Told once when a relay ends by itself after its open (the camera loss of row 49 hangs on it). Must not throw. */
  readonly relayEnded?: (end: CameraRelayEnd) => void;
  /** Told the facts this file cannot log itself. Must not throw. */
  readonly tell?: (note: CameraRelayNote) => void;
  /**
   * The clock read of a served camera (task 4 row 49: `clockOffsetMs` of the camera watch, ONE
   * unauthenticated ONVIF time read): the camera's clock minus the Core's, in milliseconds. It is
   * the adapter's `ntpOffsetMs`. Without it that member refuses as class C, as before row 49.
   */
  readonly clock?: (deviceId: string) => Promise<number>;
}

export interface OnvifRelayCameraAdapter extends CameraAdapter {
  /**
   * The source of the relay reports, to be handed to the session (`sessionCapture(app).replace({ relayReports })`).
   * TWO kinds travel on it: the established push (no member `leg`) and, since finding F3-01, the
   * relay's word about its camera leg inside a session (member `leg`: `CameraLegReport`).
   */
  readonly relayReports: { subscribe(listener: (report: CameraRelayReport) => void): () => void };
  /** Counts for a check: live relays, reports dropped as superseded (C37), and leg reports dropped because they followed nothing they could follow. */
  counts(): { readonly live: number; readonly droppedReports: number; readonly outOfOrderReports: number };
  /**
   * THE DOOR OF A LATER DEVICE (task 4 row 85d; decision C63 (g); `LateDeviceAdapter` of the fence,
   * by shape): a camera adopted on a RUNNING production Core is served from this call on exactly as
   * a camera of the first list - the same `served` check, and at every open the same stored stream
   * facts, the same judgement of its stored address (and its source address), the same reader.
   * NOTHING OF THE DEVICE IS READ OR KEPT HERE but its registry id: an admission dials nothing,
   * reveals nothing and trusts no address.
   *
   * It takes the entry form of the first list. Refused, by a `CaptureAdapterError` and with nothing
   * changed: what is no entry or names no camera id (`CAPTURE_DEVICE_UNKNOWN`), a device of another
   * class or an id of another class (`CAPTURE_DEVICE_CLASS_MISMATCH`), an entry that states another
   * adapter kind (`CAPTURE_ADAPTER_KIND_NOT_ALLOWED`) or another source class
   * (`DEVELOPMENT_SOURCE_NOT_ALLOWED`), a profile list not of the stored form
   * (`CAPTURE_PROFILE_UNKNOWN`). A camera that is served already: nothing happens (idempotent).
   */
  admitDevice(entry: CaptureDeviceEntry): void;
  /** The cameras admitted after the build, in the order they came. `devices` stays the first list. */
  admittedDevices(): readonly CaptureDeviceEntry[];
}

/** The registry id of a camera (`CAM-NN`), as an adoption mints it. */
const CAMERA_ID = /^CAM-[0-9]{2,}$/;
/** The longest profile list of a stored camera (the bound of the stored form). */
const ADMITTED_PROFILES_MAX = 16;

type Stop = 'ABORTED' | 'BOUND';

interface Slot {
  readonly deviceId: string;
  readonly profile: string;
  readonly sessionId: string;
  readonly attempt: number;
  process: ProductionProcess | null;
  /** True from the moment the source is being ended (a close, an aborted signal, a failed open): its reports are dropped. */
  ending: boolean;
  closed: Promise<void> | null;
  /** True once this relay's established push was handed on: only then can its camera leg be lost inside a session. */
  established: boolean;
  /** The highest loss number this relay said (it counts from 1); 0: none yet. */
  lastLoss: number;
  /** The loss that was said and is not over: no `REOPENED` of that number came yet. Null: the leg plays. */
  lossOpen: number | null;
}

const classC = (deviceId: string | null = null): never => {
  throw new CaptureAdapterError(CaptureAdapterRefusal.CLASS_C_NOT_BUILT, deviceId);
};

/** The form of a profile code, as the selector and the stream table hold it. */
const PROFILE_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;

export function createOnvifRelayCameraAdapter(devices: readonly CaptureDeviceEntry[], dependencies: OnvifRelayCameraDependencies): OnvifRelayCameraAdapter {
  const { door, relayProgram, timers, credentials, locator, stream } = dependencies;
  const served = new Set(devices.map((device) => device.id));
  /** The live relays, keyed by device AND profile: one camera may fill both tracks with two profiles. */
  const live = new Map<string, Slot>();
  /** The highest attempt this adapter opened a source for, per session with a live relay. */
  const attemptInForce = new Map<string, number>();
  const listeners = new Set<(report: CameraRelayReport) => void>();
  let droppedReports = 0;
  /** Leg reports of a live relay of the attempt in force that followed nothing they could follow (finding F3-01). */
  let outOfOrderReports = 0;
  /** Row 85d: the cameras admitted after the build. */
  const admittedLater: CaptureDeviceEntry[] = [];

  /** Row 85d: see `OnvifRelayCameraAdapter.admitDevice`. Every refusal stands before the one change. */
  function admitDevice(entry: CaptureDeviceEntry): void {
    const given = entry as unknown as Readonly<Record<string, unknown>> | null;
    if (typeof given !== 'object' || given === null || typeof given['id'] !== 'string') throw new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_UNKNOWN);
    const id = given['id'];
    if (given['deviceClass'] !== 'CAMERA' || !CAMERA_ID.test(id)) throw new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_CLASS_MISMATCH);
    // An entry states neither; a descriptor does. Either one that is not this adapter's is another device than the one it serves.
    if (Object.hasOwn(given, 'adapterKind') && given['adapterKind'] !== CaptureAdapterKind.ONVIF_RTSP) throw new CaptureAdapterError(CaptureAdapterRefusal.ADAPTER_KIND_NOT_ALLOWED);
    if (Object.hasOwn(given, 'sourceClass') && given['sourceClass'] !== sourceClassOf(CaptureAdapterKind.ONVIF_RTSP)) throw new CaptureAdapterError(CaptureAdapterRefusal.SOURCE_CLASS_NOT_ALLOWED);
    const profiles = given['profiles'];
    if (!Array.isArray(profiles) || profiles.length > ADMITTED_PROFILES_MAX || profiles.some((code, index) => typeof code !== 'string' || !PROFILE_CODE.test(code) || profiles.indexOf(code) !== index)) {
      throw new CaptureAdapterError(CaptureAdapterRefusal.PROFILE_UNKNOWN);
    }
    // What a camera can do: video, and nothing of a microphone or of a power controller.
    const capabilities = given['capabilities'];
    if (typeof given['label'] !== 'string' || !Array.isArray(capabilities) || !capabilities.includes('VIDEO') || capabilities.some((capability) => capability !== 'VIDEO' && capability !== 'PULL')) {
      throw new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_CLASS_MISMATCH);
    }
    if (served.has(id)) return;
    served.add(id);
    admittedLater.push(Object.freeze({ id, deviceClass: 'CAMERA' as const, label: given['label'], capabilities: Object.freeze([...(capabilities as CaptureDeviceEntry['capabilities'])]), profiles: Object.freeze([...(profiles as string[])]) }));
  }

  const keyOf = (deviceId: string, profile: string): string => `${deviceId} ${profile}`;
  const facts = (slot: Slot): CameraRelayReport => ({ sessionId: slot.sessionId, deviceId: slot.deviceId, attempt: slot.attempt });

  const tell = (code: CameraRelayNote['code'], slot: Slot): void => {
    try {
      dependencies.tell?.({ code, ...facts(slot) });
    } catch {
      // A sink never stops the adapter.
    }
  };

  /** Resolves true when the relay ended inside the bound. */
  const endedWithin = (process: ProductionProcess, boundMs: number): Promise<boolean> =>
    new Promise<boolean>((resolve) => {
      const cancel = timers.after(boundMs, () => resolve(false));
      void process.ended.then(() => {
        cancel();
        resolve(true);
      });
    });

  /** Forgets a slot whose relay has ended; the attempt of its session with it when no other relay of the session lives. */
  const forget = (key: string, slot: Slot): void => {
    if (live.get(key) === slot) live.delete(key);
    if (![...live.values()].some((other) => other.sessionId === slot.sessionId)) attemptInForce.delete(slot.sessionId);
  };

  /** Kills a relay and waits for it. False: it had not ended inside the bound (said, and forgotten only when it ends). */
  const killAndReap = async (key: string, slot: Slot): Promise<boolean> => {
    slot.ending = true;
    const process = slot.process;
    if (process === null) {
      forget(key, slot);
      return true;
    }
    process.kill('SIGKILL');
    if (await endedWithin(process, CAMERA_RELAY_REAP_BOUND_MS)) {
      forget(key, slot);
      return true;
    }
    tell('CAPTURE_RELAY_NOT_REAPED', slot);
    void process.ended.then(() => forget(key, slot));
    return false;
  };

  /** The one end of an open source: the order to stop, the kill at the bound, the wait. One promise per slot. */
  const close = (key: string, slot: Slot): Promise<void> => {
    slot.ending = true;
    slot.closed ??= (async () => {
      const process = slot.process;
      if (process === null) {
        forget(key, slot);
        return;
      }
      process.endInput();
      if (await endedWithin(process, CAMERA_RELAY_STOP_BOUND_MS)) {
        forget(key, slot);
        return;
      }
      if (!(await killAndReap(key, slot))) throw new CameraOpenError(CameraOpenRefusal.RELAY_NOT_REAPED, slot.deviceId);
    })();
    return slot.closed;
  };

  /** C37, for EVERY report line of a relay: false when it is dropped and counted - a relay that is being ended, an attempt a later open superseded, an attempt that is not the relay's own. */
  const inForce = (slot: Slot, report: RelayReport): boolean => {
    const attempt = attemptInForce.get(slot.sessionId);
    if (slot.ending || attempt === undefined || slot.attempt < attempt) {
      droppedReports += 1;
      tell('CAPTURE_RELAY_REPORT_SUPERSEDED', slot);
      return false;
    }
    // The relay names the attempt of its own start message; another number is not this relay's word.
    if (report.attempt !== slot.attempt) {
      droppedReports += 1;
      tell('CAPTURE_RELAY_REPORT_ATTEMPT_DIFFERS', slot);
      return false;
    }
    return true;
  };

  const hand = (slot: Slot, report: CameraRelayReport): void => {
    for (const listener of listeners) {
      try {
        listener(report);
      } catch {
        tell('CAPTURE_RELAY_LISTENER_FAILED', slot);
      }
    }
  };

  /** The established push of a relay: handed to the pairing, or dropped and counted (C37). */
  const reported = (slot: Slot, report: RelayReport): boolean => {
    if (!inForce(slot, report)) return false;
    slot.established = true;
    hand(slot, facts(slot));
    return true;
  };

  /**
   * THE CAMERA LEG INSIDE A SESSION (finding F3-01): the relay's `camera_lost` and
   * `camera_reopened`, told AT ONCE on the report source - the camera's fault is raised by the first
   * line of a loss, not when the relay has used up its tries. C37 first, as for every line. Then the
   * order, on the careful side of each doubt:
   *   - a loss before the push is established is no loss inside a session: dropped;
   *   - the relay counts its losses up: a loss whose number was said already is dropped; a HIGHER
   *     number is taken also when it skips one or follows a loss that is still open (the camera is
   *     away either way: the absence that was told goes on, nothing is told twice);
   *   - a re-open ends ONLY the loss that is open, by its number: any other is dropped, and the
   *     loss that was told stays told.
   * What is dropped here is counted (`outOfOrderReports`) and noted, never handed on.
   */
  const legReported = (slot: Slot, report: Exclude<RelayReport, { readonly kind: typeof RelayReportKind.PUSH_ESTABLISHED }>): void => {
    if (!inForce(slot, report)) return;
    const outOfOrder = (): void => {
      outOfOrderReports += 1;
      tell('CAPTURE_RELAY_REPORT_OUT_OF_ORDER', slot);
    };
    if (report.kind === RelayReportKind.CAMERA_LOST) {
      if (!slot.established || report.loss <= slot.lastLoss) return outOfOrder();
      const expected = slot.lossOpen === null && report.loss === slot.lastLoss + 1;
      const told = slot.lossOpen !== null;
      slot.lastLoss = report.loss;
      slot.lossOpen = report.loss;
      if (!expected) outOfOrder();
      if (told) return;
      // The cause as the relay's own exit word; the reader admits the four codes the relay opens again, each of which has one.
      const cause = (Object.hasOwn(RELAY_EXIT, report.cause) ? RELAY_EXIT[report.cause] : undefined)?.word ?? 'CAUSE_UNKNOWN';
      hand(slot, { ...facts(slot), leg: Object.freeze({ event: 'LOST' as const, profile: slot.profile, loss: report.loss, cause }) });
      return;
    }
    if (slot.lossOpen !== report.loss) return outOfOrder();
    slot.lossOpen = null;
    hand(slot, { ...facts(slot), leg: Object.freeze({ event: 'REOPENED' as const, profile: slot.profile, loss: report.loss, tries: report.tries, heldBack: report.heldBack, gapMs: report.gapMs }) });
  };

  async function openSource(deviceId: string, target: CameraSourceTarget, signal: AbortSignal): Promise<SourceHandle> {
    // 0. Before anything is asked.
    if (signal.aborted) throw new CaptureAdapterError(CaptureAdapterRefusal.ABORTED, deviceId);
    if (!served.has(deviceId)) throw new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_UNKNOWN);
    const { profile, sessionId, attempt } = target;
    // C36: the profile is the plan's statement; an open without one is refused, never filled in.
    if (typeof profile !== 'string' || !PROFILE_CODE.test(profile)) throw new CaptureAdapterError(CaptureAdapterRefusal.PROFILE_UNKNOWN, deviceId);
    if (typeof sessionId !== 'string' || sessionId === '' || typeof attempt !== 'number' || !Number.isSafeInteger(attempt) || attempt < 1 || attempt > RELAY_ATTEMPT_MAX) throw new CameraOpenError(CameraOpenRefusal.SESSION_UNKNOWN, deviceId);
    if (relayProgram === null) throw new CameraOpenError(CameraOpenRefusal.RELAY_NOT_CONFIGURED, deviceId);
    const key = keyOf(deviceId, profile);
    if (live.has(key)) throw new CameraOpenError(CameraOpenRefusal.ALREADY_OPEN, deviceId);
    const slot: Slot = { deviceId, profile, sessionId, attempt, process: null, ending: false, closed: null, established: false, lastLoss: 0, lossOpen: null };
    live.set(key, slot);
    if ((attemptInForce.get(sessionId) ?? 0) < attempt) attemptInForce.set(sessionId, attempt);

    // The bound and the signal, as ONE stop of this open. The inner signal is the ONVIF read's.
    const inner = new AbortController();
    let stopNow: (why: Stop) => void = () => {};
    const stopped = new Promise<Stop>((resolve) => {
      stopNow = resolve;
    });
    const stop = (why: Stop): void => {
      inner.abort();
      stopNow(why);
    };
    const onAbort = (): void => stop('ABORTED');
    signal.addEventListener('abort', onAbort, { once: true });
    const cancelBound = timers.after(CAMERA_OPEN_BOUND_MS, () => stop('BOUND'));
    const stopError = (why: Stop): Error => (why === 'ABORTED' ? new CaptureAdapterError(CaptureAdapterRefusal.ABORTED, deviceId) : new CameraOpenError(CameraOpenRefusal.OPEN_TIMEOUT, deviceId));
    /** A step of the open, given up at the stop. What a given-up step answers later is dropped. */
    const until = <Value>(step: Promise<Value>): Promise<Value> =>
      Promise.race([
        step,
        stopped.then((why): never => {
          throw stopError(why);
        }),
      ]);

    try {
      // 1. The stored facts of the stream.
      let stored: StoredCameraStream | null;
      try {
        stored = await until(stream(deviceId, profile));
      } catch (error) {
        if (error instanceof CaptureAdapterError || error instanceof CameraOpenError) throw error;
        throw new CameraOpenError(CameraOpenRefusal.STREAM_FACTS_NOT_READ, deviceId);
      }
      if (stored === null) throw new CaptureAdapterError(CaptureAdapterRefusal.PROFILE_UNKNOWN, deviceId);

      // 1b. AD-02 (1): the STORED address under the destination rule. Before the reveal, before any request, before any process.
      const judged = judgeStoredCamera(stored.candidate, dependencies.storedAddress);
      if (!judged.allowed) throw new CameraOpenError(CameraOpenRefusal.ADDRESS_REFUSED, deviceId, judged.refusal);
      // Row 143b (S13-11 point 2): the camera-interface address every dial of this open leaves FROM - the locator read and the
      // relay. An admission that names none is a refusal here, before the reveal: nothing is dialled as the host happens to route.
      const from = storedCameraSourceOf(judged);
      if ('refusal' in from) throw new CameraOpenError(CameraOpenRefusal.ADDRESS_REFUSED, deviceId, from.refusal);

      // 2. The credential: one read, one audit entry (the reader's). Outside any unit of work.
      let sealed: SealedCredential;
      try {
        sealed = await until(credentials.sessionOpen(deviceId, sessionId));
      } catch (error) {
        if (error instanceof CaptureAdapterError || error instanceof CameraOpenError) throw error;
        throw new CameraOpenError(CameraOpenRefusal.CREDENTIAL_NOT_READ, deviceId, reasonOf((error as { code?: unknown } | null)?.code));
      }

      // 3. ONE authenticated read of the stream address, now.
      const located = await until(locator.locate(stored.candidate, sealed, stored.onvifProfileToken, inner.signal, from.sourceAddress));
      if (located.outcome !== ConnectionTestOutcome.REACHABLE || located.locator === null) {
        const refusal =
          located.outcome === ConnectionTestOutcome.AUTHENTICATION_FAILED
            ? CameraOpenRefusal.AUTHENTICATION_REFUSED
            : located.outcome === ConnectionTestOutcome.UNREACHABLE
              ? CameraOpenRefusal.UNREACHABLE
              : CameraOpenRefusal.LOCATOR_REFUSED;
        throw new CameraOpenError(refusal, deviceId, located.reason);
      }

      // 4. The relay: the injection point, the start message, the door. The address of the target goes there and nowhere else.
      let established: (report: RelayReport) => void = () => {};
      const pushEstablished = new Promise<'ESTABLISHED'>((resolve) => {
        established = (report) => {
          if (report.kind === RelayReportKind.PUSH_ESTABLISHED && reported(slot, report)) resolve('ESTABLISHED');
        };
      });
      // The established push settles the open; the two lines of the camera leg (row 43) are told as they come, for as long as the relay lives.
      const reader = createRelayReportReader((report) => (report.kind === RelayReportKind.PUSH_ESTABLISHED ? established(report) : legReported(slot, report)));
      const process = startCameraRelay({ door, program: relayProgram, timers, locator: located.locator, sealed, ingest: target.ingestUrl, attempt, source: from.sourceAddress, onOutput: (chunk) => reader.push(chunk) });
      slot.process = process;
      try {
        await until(process.started);
      } catch (error) {
        if (error instanceof CaptureAdapterError || error instanceof CameraOpenError) throw error;
        throw new CameraOpenError(CameraOpenRefusal.RELAY_NOT_STARTED, deviceId, reasonOf((error as { code?: unknown } | null)?.code));
      }

      // 5. The relay's word that the worker took its push, or its end.
      const first = await until(Promise.race([pushEstablished, process.ended]));
      if (first !== 'ESTABLISHED') {
        const end = relayEndOf(first);
        throw new CameraOpenError(end.refusal, deviceId, end.reason);
      }
    } catch (error) {
      cancelBound();
      signal.removeEventListener('abort', onAbort);
      // Whatever stopped the open: a started relay is killed and waited for before the open rejects (AD-09 (3)).
      await killAndReap(key, slot);
      throw error;
    }
    cancelBound();
    signal.removeEventListener('abort', onAbort);

    const process = slot.process;
    // A relay that ends by itself after its open is said once; one that was asked to end is not.
    void process?.ended.then((exit) => {
      const byItself = !slot.ending;
      forget(key, slot);
      if (!byItself) return;
      slot.ending = true;
      const end = relayEndOf(exit);
      try {
        dependencies.relayEnded?.({ ...facts(slot), profile, code: end.refusal, reason: end.reason });
      } catch {
        // A listener never stops the adapter.
      }
    });
    // The signal of the open stays the relay's (row 47): aborted later, the source is closed.
    const onLateAbort = (): void => void close(key, slot).catch(() => {});
    if (signal.aborted) onLateAbort();
    else signal.addEventListener('abort', onLateAbort, { once: true });

    return Object.freeze({
      deviceId,
      close: (): Promise<void> => {
        signal.removeEventListener('abort', onLateAbort);
        return close(key, slot);
      },
    });
  }

  return Object.freeze({
    seam: 'CAMERA' as const,
    kind: CaptureAdapterKind.ONVIF_RTSP,
    devices: Object.freeze([...devices]),
    hasOpener: true,
    // The search and the connection test are the adapters of rows 131 and 142; presence is the camera watch of row 49 (`camera-watch.ts`).
    discover: async () => classC(),
    testConnection: async () => classC(),
    openSource,
    profiles: async (deviceId: string) => classC(deviceId),
    pullUrl: (deviceId: string): never => {
      throw new CameraOpenError(CameraOpenRefusal.LOCATOR_RESOLVED_AT_OPEN, deviceId);
    },
    // Row 49: a read through the dependency handed in. No credential is in reach of it, and nothing is kept.
    ntpOffsetMs: async (deviceId: string): Promise<number> => {
      const clock = dependencies.clock;
      if (clock === undefined) return classC(deviceId);
      if (!served.has(deviceId)) throw new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_UNKNOWN);
      return clock(deviceId);
    },
    relayReports: Object.freeze({
      subscribe(listener: (report: CameraRelayReport) => void): () => void {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
    }),
    counts: () => ({ live: live.size, droppedReports, outOfOrderReports }),
    admitDevice,
    admittedDevices: () => Object.freeze([...admittedLater]),
  });
}
