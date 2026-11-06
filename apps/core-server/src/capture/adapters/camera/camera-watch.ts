/**
 * CAMERA LOSS, PRESENCE AND CLOCK OFFSET of the production camera adapter (task 4 row 49, WP-06c;
 * design addendum 2.5 "presence (the unauthenticated time read) is a pre-check item", 8.3 "G-R2,
 * G-R10 kept: presence uses the ONVIF time read"; plan review, WP-06 verdict: "presence by TCP
 * reachability has no permitted place").
 *
 * BUILT BY THE BOOT STEP OF THE FENCE since the lift (task 4 row 88; `wireProductionRegistry`),
 * attached to the composition before the registry exists, and told `captureEnded` at every end of
 * a capture (finding E-03). The composition of the production registry makes one watch, hands `relayEnded` to the adapter as its
 * dependency of that name, subscribes `pushEstablished` to the adapter's `relayReports`, and hands
 * `clockOffsetMs` to the adapter as its dependency `clock` (the adapter's `ntpOffsetMs`).
 *
 * THE ONE QUESTION IT ASKS A CAMERA is the ONVIF time read (`GetSystemDateAndTime`), WITHOUT A
 * CREDENTIAL, through the seam `CameraTimeReader`. This file opens no socket, imports neither the
 * ONVIF package nor any module of the host, and has no credential in its reach: no type of it, no
 * reader of it, no parameter that could carry one. A presence read therefore reveals nothing and
 * writes no reveal entry, by construction. It does NOT ping, connect to a stream port or sweep.
 *
 * WHAT IT DOES.
 *
 *   1. LOSS. The adapter tells once when a relay ends BY ITSELF after its open (`relayEnded`). The
 *      watch raises ONE fault per camera through the sink handed in and clears it when a later
 *      push of that camera is established (`pushEstablished`). The fault is the EXISTING one of a
 *      camera that stopped delivering: `CAPTURE_FAULT` with the reason `CAMERA_STREAM_ENDED` about
 *      the camera's registry id - the key the capture worker uses for the same event. Because the
 *      key of a fault is (kind, reason, device), the worker's word and this watch's word about one
 *      camera are ONE fault, one alert and one audit entry (`FAULT_RAISED`), never two (C40). The
 *      audit entry is written by the engine action behind the sink; this file writes no row.
 *      SINCE FINDING F3-01 (M3 review) the same fault is raised EARLIER, by the relay's own word
 *      that its camera leg was lost inside a session (a report of `relayReports` with the member
 *      `leg`, event `LOST`: row 43), and cleared by the relay's `REOPENED` of that stream. Before,
 *      such a loss raised nothing until the relay had used up its six tries and ended (62 s of
 *      waits). The end of that relay then adds no second fault; a re-open clears only what this
 *      watch raised (decision C60 (2)), and only for the stream and relay whose loss it was told.
 *   2. PRESENCE. A watched camera is asked the time every `CAMERA_PRESENCE_INTERVAL_MS`. After
 *      `CAMERA_PRESENCE_FAILURES` reads in a row without an answer it is `ABSENT`; the first answer
 *      after that makes it `PRESENT` again. Each change is told ONCE (`onChange`). `check` is one
 *      read for the pre-check item, apart from the watch.
 *   3. CLOCK OFFSET. `clockOffsetMs`: the camera's clock minus the Core's, in milliseconds, from
 *      one time read; the Core's instant is the middle of the read. A read; a camera clock is
 *      never set here. The worker needs the camera within `CAMERA_CLOCK_BOUND_MS`; `check` says
 *      whether it is.
 *
 * WHAT PRESENCE DOES NOT DO: it raises no fault. An absent camera at a start is the degraded start
 * of rulings C35 and C40 (ONE notice, the session's); a fault of this watch beside it would be the
 * second. Who needs the fact gets it from `onChange`, `presence` and `check`.
 *
 * WHAT IS NOT AN ABSENCE. A stored address that could not be read, a reader that refused before it
 * asked anything, a read cut by the caller: none of them says the camera is gone. Each is reported
 * by its code and counts neither as an answer nor as a failure.
 *
 * THE DESTINATION RULE STANDS BEFORE EVERY READ (task 4 row 143; AD-02 (1)). The stored address is
 * untrusted (the runtime database role can write it), and a time read is a request the Core sends
 * to it. So each read - a heartbeat, `check`, `clockOffsetMs` - first asks `judgeStoredCamera`
 * with the rule handed in (`storedAddress`), about the candidate read for THAT read. A refused
 * address is never asked the time: `check` and `clockOffsetMs` refuse by
 * `CAPTURE_CAMERA_CLOCK_ADDRESS_REFUSED`; a heartbeat reports `CAMERA_WATCH_ADDRESS_REFUSED` and
 * counts the beat as one without an answer (no camera the Core may use is at that address), so a
 * camera whose row was moved to a refused address stops being `PRESENT`. Without a rule handed in
 * every read is refused the same way: this file holds no permissive value.
 *
 * THE SOURCE HALF (task 4 row 143c; S13-11 point 2; decision C65): the time read is the THIRD dial
 * of a stored camera, beside the locator read and the relay. The rule that admits the address also
 * names the camera-interface address the request must be made FROM; the watch takes it from the
 * judgement of THAT read (`storedCameraSourceOf`) and hands it to the seam with the candidate. An
 * admission that names no source address is a refused address here - the same two named refusals,
 * no read, nothing sent: there is no read "as the host routes".
 *
 * It does not log (the capture folder logs in one place): what went wrong is told to `report`. No
 * address and no device text is in a report, a change or an error.
 *
 * It reads no clock and names no global timer (static rule G-R8): `now` and `timers` are handed in.
 */
import { CaptureWarningCode, CaptureWarningReason } from '@dems/capture-protocol';
import type { CaptureTimers } from '../../types';
import { CaptureAdapterError, CaptureAdapterRefusal } from '../errors';
import type { CameraCandidate } from '../types';
import { judgeStoredCamera, storedCameraSourceOf, type StoredCameraAddressRule } from './stored-address';

/** The heartbeat of the tested scheme: one read this often per watched camera. */
export const CAMERA_PRESENCE_INTERVAL_MS = 3_000;
/** Reads in a row without an answer before a camera is absent. */
export const CAMERA_PRESENCE_FAILURES = 2;
/** The bound of one time read. A read that has not answered by then is no answer. */
export const CAMERA_TIME_READ_BOUND_MS = 2_000;
/** How far a camera's wall clock may stand from the Core's for the worker to take its stream. */
export const CAMERA_CLOCK_BOUND_MS = 2_000;

/**
 * What one unauthenticated time read answers. `answered`: the device answered the ONVIF read
 * itself (not merely something at that address). `cameraUtcMs`: the device's clock as milliseconds
 * of UTC, or null when the answer names no usable instant.
 */
export interface CameraTimeAnswer {
  readonly answered: boolean;
  readonly cameraUtcMs: number | null;
}

/**
 * THE SEAM: one `GetSystemDateAndTime` without a credential, bounded by the signal. It resolves
 * whatever the device does; it rejects only before any request (a candidate that may not be
 * contacted, a signal already aborted). Its production value is a facade of the ONE file that
 * imports the ONVIF package (static rules G-R10 and G-R11).
 *
 * `fromAddress` (row 143c): the address of THIS host the request is made from - the source address
 * the destination rule named for this camera. REQUIRED: the watch has no read without one.
 */
export interface CameraTimeReader {
  read(candidate: CameraCandidate, signal: AbortSignal, fromAddress: string): Promise<CameraTimeAnswer>;
}

/** The fault of a lost camera: the existing key of a camera that stopped delivering video. */
export interface CameraLossFault {
  readonly code: typeof CaptureWarningCode.CAPTURE_FAULT;
  /** The registry id of the camera (`CAM-NN`). */
  readonly subject: string;
  readonly reason: typeof CaptureWarningReason.CAMERA_STREAM_ENDED;
}

/**
 * Where a fault goes. The composition hands in the engine's two internal actions
 * (`raiseCaptureWarning`, `clearCaptureWarning`): each raise is one alert and one `FAULT_RAISED`
 * audit entry, each clear one `FAULT_CLEARED`.
 */
export interface CameraFaultSink {
  raise(fault: CameraLossFault): Promise<void> | void;
  clear(fault: CameraLossFault): Promise<void> | void;
}

export const CameraPresence = { UNKNOWN: 'UNKNOWN', PRESENT: 'PRESENT', ABSENT: 'ABSENT' } as const;
export type CameraPresence = (typeof CameraPresence)[keyof typeof CameraPresence];

export const CameraWatchEvent = {
  /** A relay of the camera ended by itself after its open. */
  STREAM_LOST: 'STREAM_LOST',
  /** A later push of a camera that was lost is established. */
  STREAM_RETURNED: 'STREAM_RETURNED',
  /** The camera answered no time read `CAMERA_PRESENCE_FAILURES` times in a row. */
  UNREACHABLE: 'UNREACHABLE',
  /** A camera that was absent answers again. */
  REACHABLE: 'REACHABLE',
} as const;
export type CameraWatchEvent = (typeof CameraWatchEvent)[keyof typeof CameraWatchEvent];

/** THE LOSS CALLBACK: told once per change. Identifiers and code words only. */
export interface CameraWatchChange {
  readonly deviceId: string;
  readonly event: CameraWatchEvent;
  /** For `STREAM_LOST`: the adapter's code of the relay's end (`CAPTURE_CAMERA_...`). Null otherwise. */
  readonly cause: string | null;
}

export const CameraWatchReportCode = {
  /** The stored address of a camera could not be read: nothing is concluded from that read. */
  CANDIDATE_NOT_READ: 'CAMERA_WATCH_CANDIDATE_NOT_READ',
  /** The reader refused before it asked anything: nothing is concluded. */
  READ_REFUSED: 'CAMERA_WATCH_READ_REFUSED',
  /** The stored address is refused by the destination rule, or no rule was handed in: no read was made (row 143; AD-02). */
  ADDRESS_REFUSED: 'CAMERA_WATCH_ADDRESS_REFUSED',
  /** The sink refused a raise or a clear. */
  SINK_FAILED: 'CAMERA_WATCH_SINK_FAILED',
  /** The loss callback threw. */
  OBSERVER_FAILED: 'CAMERA_WATCH_OBSERVER_FAILED',
} as const;
export type CameraWatchReportCode = (typeof CameraWatchReportCode)[keyof typeof CameraWatchReportCode];

export interface CameraWatchReport {
  readonly code: CameraWatchReportCode;
  readonly deviceId: string;
}

/** The refusals of a clock read. Codes only; each has one fixed sentence. */
export const CameraClockRefusal = {
  /** The camera did not answer the time read inside its bound. */
  NOT_ANSWERED: 'CAPTURE_CAMERA_CLOCK_NOT_ANSWERED',
  /** The camera answered and named no usable instant. */
  NOT_STATED: 'CAPTURE_CAMERA_CLOCK_NOT_STATED',
  /** The stored address of the camera could not be read: no read was made. */
  ADDRESS_NOT_READ: 'CAPTURE_CAMERA_CLOCK_ADDRESS_NOT_READ',
  /** The stored address of the camera is refused by the destination rule: no read was made (row 143; AD-02). */
  ADDRESS_REFUSED: 'CAPTURE_CAMERA_CLOCK_ADDRESS_REFUSED',
} as const;
export type CameraClockRefusal = (typeof CameraClockRefusal)[keyof typeof CameraClockRefusal];

const CLOCK_SENTENCE: Readonly<Record<CameraClockRefusal, string>> = Object.freeze({
  CAPTURE_CAMERA_CLOCK_NOT_ANSWERED: 'the camera did not answer the time read',
  CAPTURE_CAMERA_CLOCK_NOT_STATED: 'the camera named no usable time',
  CAPTURE_CAMERA_CLOCK_ADDRESS_NOT_READ: 'the stored address of the camera could not be read',
  CAPTURE_CAMERA_CLOCK_ADDRESS_REFUSED: 'the stored address of the camera is not one the Core connects to',
});

export class CameraClockError extends Error {
  readonly code: CameraClockRefusal;
  readonly deviceId: string;
  constructor(code: CameraClockRefusal, deviceId: string) {
    super(CLOCK_SENTENCE[code]);
    this.name = 'CameraClockError';
    this.code = code;
    this.deviceId = deviceId;
  }
}

/** What one read for the pre-check answers. */
export interface CameraCheck {
  readonly present: boolean;
  /** The camera's clock minus the Core's, whole milliseconds. Null when absent or when the answer names no usable instant. */
  readonly clockOffsetMs: number | null;
  /** True only when the offset is known and inside `CAMERA_CLOCK_BOUND_MS`. */
  readonly clockWithinBound: boolean;
}

export interface CameraWatchDependencies {
  readonly timers: CaptureTimers;
  /** The server clock, in milliseconds. */
  readonly now: () => number;
  readonly reader: CameraTimeReader;
  /**
   * The camera at its STORED address, in the form the ONVIF session takes, or null for a device
   * that is not a stored camera. The destination rule on that address stands in front of this
   * function (row 143): what it answers is what is contacted.
   */
  readonly candidate: (deviceId: string) => Promise<CameraCandidate | null>;
  /**
   * THE DESTINATION RULE ON A STORED CAMERA ADDRESS (row 143; AD-02): the same binding the adapter
   * and the credential wiring are given. Asked before every read. Optional in the type only:
   * WITHOUT IT NO READ IS MADE (every read is refused). There is no permissive value under `src/`.
   */
  readonly storedAddress?: StoredCameraAddressRule;
  /** Where the fault of a lost camera goes. Without one, losses are told to `onChange` only. */
  readonly faults?: CameraFaultSink;
  /** Told once per change. Must not throw (a throw is reported). */
  readonly onChange?: (change: CameraWatchChange) => void;
  /** Told what went wrong. Must not throw. */
  readonly report?: (report: CameraWatchReport) => void;
}

/** The members of the adapter's own tells that the watch reads (`CameraRelayEnd`, `CameraRelayReport`, by shape). */
export interface CameraStreamEnd {
  readonly deviceId: string;
  readonly code: string;
  /** The session of the relay that ended (`CameraRelayEnd.sessionId`): whose loss this is (finding E-03). */
  readonly sessionId?: string;
  /** The profile of the stream whose relay ended (`CameraRelayEnd.profile`): a loss of that stream's leg ends with its relay. */
  readonly profile?: string;
}
/** The adapter's word about a camera leg inside a session (`CameraLegReport`, by shape): what the watch reads of it. */
export interface CameraStreamLeg {
  readonly event: string;
  readonly profile: string;
  /** For `LOST`: the relay's own word for the end of the leg. */
  readonly cause?: string;
}
export interface CameraStreamUp {
  readonly deviceId: string;
  /** The session and the attempt of the relay that speaks (`CameraRelayReport`): which relay a lost leg belongs to. */
  readonly sessionId?: string;
  readonly attempt?: number;
  /** PRESENT: this is no established push but the relay's word about its camera leg (finding F3-01). */
  readonly leg?: CameraStreamLeg;
}

export interface CameraWatch {
  /** The adapter's `relayEnded`: a relay ended by itself after its open. */
  relayEnded(end: CameraStreamEnd): void;
  /**
   * A listener of the adapter's `relayReports`. A report WITHOUT the member `leg`: a push was
   * established. A report WITH it (finding F3-01): the camera leg of an established push was LOST
   * inside a session - the fault of that camera is raised at once - or REOPENED - the fault this
   * watch raised for it is cleared. One listener for both, because one source carries both.
   */
  pushEstablished(report: CameraStreamUp): void;
  /** Starts the heartbeat of a camera. Watching twice is one watch. */
  watch(deviceId: string): void;
  /** Stops it and forgets what was known of the camera's presence. A running read is cut. */
  unwatch(deviceId: string): void;
  presence(deviceId: string): CameraPresence;
  /** The cameras that are lost now, IN THE CAPTURE THAT RUNS (a relay ended by itself and no push returned since, or a leg said lost). Empty once that capture ended (`captureEnded`). */
  lost(): readonly string[];
  /**
   * THE SESSION BOUNDARY (finding E-03 of the fifth review pass): the capture ended. A loss belongs
   * to the capture it happened in - its relay is gone with it - so the watch forgets every loss it
   * holds, and asks the sink ONCE to end each fault it raised itself (decision C60 (2): its own
   * only; the sink ends one that still stands and only drops its mark of one the session's end
   * cleared already, so nothing is ended twice). After it `lost()` is empty and the next capture
   * starts clean: a camera lost at the end of one session is not "lost" in the next, raises its
   * fault there anew, and gets no clear for a loss of the session before.
   * No change is told for it (`onChange`): no camera came back. The heartbeats are not touched.
   * THE SAME happens by itself at the first established push that names ANOTHER session than the
   * one whose reports the watch last read (one capture runs at a time): the boundary holds also
   * where nobody called this function.
   */
  captureEnded(): void;
  /** ONE read, apart from the heartbeat: the pre-check item. Rejects `CAPTURE_DEVICE_UNKNOWN` for a device that is no stored camera. */
  check(deviceId: string, signal: AbortSignal): Promise<CameraCheck>;
  /** The camera's clock minus the Core's, whole milliseconds, from ONE read. Rejects with `CameraClockError`, or `CAPTURE_DEVICE_UNKNOWN`. */
  clockOffsetMs(deviceId: string): Promise<number>;
  /** Stops every heartbeat. Faults that are raised stay raised: the session's end clears them. */
  close(): void;
}

interface Heartbeat {
  state: CameraPresence;
  failures: number;
  cancel: (() => void) | null;
  reading: AbortController | null;
}

/** A read as the watch sees it: an answer with the Core's instant at its middle, no answer, or nothing to conclude. */
/** What the lookup of a stored camera answers for an address the destination rule refuses (row 143). */
const ADDRESS_REFUSED = 'ADDRESS_REFUSED';
/** A stored camera that may be read: the candidate that was judged, and the address the read is made FROM (row 143c). */
interface ReadTarget {
  readonly camera: CameraCandidate;
  readonly from: string;
}
type Read = { readonly kind: 'ANSWERED'; readonly cameraUtcMs: number | null; readonly coreMs: number } | { readonly kind: 'NO_ANSWER' } | { readonly kind: 'UNDECIDED' };

const usableInstant = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

export function createCameraWatch(dependencies: CameraWatchDependencies): CameraWatch {
  const { timers, now, reader, candidate } = dependencies;
  const hearts = new Map<string, Heartbeat>();
  /** Per camera: how many of its relays ended by themselves with no push established since. */
  const lostStreams = new Map<string, number>();
  /**
   * Finding F3-01. Per camera: the streams (by profile) whose camera leg a LIVE relay said it lost and has not
   * said it re-opened, each with the relay it belongs to (session and attempt). A camera is LOST while it has an
   * ended relay with no push since, OR a leg in this list: ONE fault for both, raised by the first and cleared when
   * neither is left.
   */
  const lostLegs = new Map<string, Map<string, string>>();
  const isLost = (deviceId: string): boolean => (lostStreams.get(deviceId) ?? 0) > 0 || (lostLegs.get(deviceId)?.size ?? 0) > 0;
  const relayOf = (up: CameraStreamUp): string | null => (typeof up.sessionId === 'string' && typeof up.attempt === 'number' ? `${up.sessionId} ${up.attempt}` : null);
  const dropLegs = (deviceId: string, drop: (profile: string, relay: string) => boolean): void => {
    const legs = lostLegs.get(deviceId);
    if (legs === undefined) return;
    // A Map may lose the entry it is at while it is walked.
    for (const [profile, relay] of legs) if (drop(profile, relay)) legs.delete(profile);
    if (legs.size === 0) lostLegs.delete(deviceId);
  };
  const CODE_WORD = /^[A-Z][A-Z0-9_]{0,63}$/;
  let closed = false;

  const report = (code: CameraWatchReportCode, deviceId: string): void => {
    try {
      dependencies.report?.({ code, deviceId });
    } catch {
      // A sink never stops the watch.
    }
  };
  const changed = (deviceId: string, event: CameraWatchEvent, cause: string | null = null): void => {
    try {
      dependencies.onChange?.({ deviceId, event, cause });
    } catch {
      report(CameraWatchReportCode.OBSERVER_FAILED, deviceId);
    }
  };
  const faultOf = (deviceId: string): CameraLossFault => ({ code: CaptureWarningCode.CAPTURE_FAULT, subject: deviceId, reason: CaptureWarningReason.CAMERA_STREAM_ENDED });
  /**
   * DECISION C60 (2) (task 4 row 85c): the cameras whose fault THIS watch asked the sink to raise, and whose raise did
   * not fail. A clear goes to the sink for such a camera ONLY: the watch never asks for the end of a fault it did not
   * raise itself. (That the key was not active before the raise - raised by another part - is the sink's to hold:
   * `watchFaultSinkOf` of the fence.)
   */
  const raisedHere = new Set<string>();
  const toSink = (deviceId: string, act: 'raise' | 'clear'): void => {
    const sink = dependencies.faults;
    if (sink === undefined) return;
    if (act === 'clear') {
      if (!raisedHere.has(deviceId)) return;
      raisedHere.delete(deviceId);
    } else {
      raisedHere.add(deviceId);
    }
    // A raise that failed raised nothing: its camera is not one whose fault this watch may end.
    const failed = (): void => {
      if (act === 'raise') raisedHere.delete(deviceId);
      report(CameraWatchReportCode.SINK_FAILED, deviceId);
    };
    try {
      void Promise.resolve(sink[act](faultOf(deviceId))).catch(failed);
    } catch {
      failed();
    }
  };

  /** Finding E-03: the session whose reports the watch last read. Null: none yet, or its capture ended. */
  let session: string | null = null;
  /** Finding E-03: see `CameraWatch.captureEnded`. Its own faults asked away once each, then every loss forgotten. */
  const forgetLosses = (): void => {
    for (const deviceId of [...raisedHere]) toSink(deviceId, 'clear');
    lostStreams.clear();
    lostLegs.clear();
    session = null;
  };

  /** ONE time read, bounded here and by the caller's signal. It never rejects. */
  const readOnce = async (deviceId: string, target: ReadTarget, outer: AbortSignal | null): Promise<Read> => {
    if (outer?.aborted === true) return { kind: 'UNDECIDED' };
    const bound = new AbortController();
    let cut: 'BOUND' | 'CALLER' | null = null;
    let stop: (why: 'BOUND' | 'CALLER') => void = () => {};
    const stopped = new Promise<null>((resolve) => {
      stop = (why) => {
        cut ??= why;
        bound.abort();
        resolve(null);
      };
    });
    const onOuter = (): void => stop('CALLER');
    outer?.addEventListener('abort', onOuter, { once: true });
    const cancel = timers.after(CAMERA_TIME_READ_BOUND_MS, () => stop('BOUND'));
    const before = now();
    try {
      const answer = await Promise.race([reader.read(target.camera, bound.signal, target.from), stopped]);
      const after = now();
      if (answer === null) return cut === 'CALLER' ? { kind: 'UNDECIDED' } : { kind: 'NO_ANSWER' };
      if (answer.answered !== true) return { kind: 'NO_ANSWER' };
      return { kind: 'ANSWERED', cameraUtcMs: usableInstant(answer.cameraUtcMs) ? answer.cameraUtcMs : null, coreMs: before + (after - before) / 2 };
    } catch {
      // The reader refused before any request: that says nothing about the camera.
      report(CameraWatchReportCode.READ_REFUSED, deviceId);
      return { kind: 'UNDECIDED' };
    } finally {
      cancel();
      outer?.removeEventListener('abort', onOuter);
    }
  };

  /** The stored camera, or null when it could not be read (reported). When `strict`: throws `CAPTURE_DEVICE_UNKNOWN` when there is none, and the named clock refusal when the read failed. */
  const targetOf = async (deviceId: string, strict: boolean): Promise<ReadTarget | typeof ADDRESS_REFUSED | null> => {
    let target: CameraCandidate | null;
    try {
      target = await candidate(deviceId);
    } catch {
      report(CameraWatchReportCode.CANDIDATE_NOT_READ, deviceId);
      if (strict) throw new CameraClockError(CameraClockRefusal.ADDRESS_NOT_READ, deviceId);
      return null;
    }
    if (target === null && strict) throw new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_UNKNOWN);
    if (target === null) {
      report(CameraWatchReportCode.CANDIDATE_NOT_READ, deviceId);
      return null;
    }
    // Row 143 (AD-02 (1)): the stored address under the destination rule, before the read. A refused address is never asked the time.
    const judged = judgeStoredCamera(target, dependencies.storedAddress);
    // Row 143c (S13-11 point 2): the address the read is made FROM, of the same judgement. An admission that names none is a refused address.
    const from = storedCameraSourceOf(judged);
    if ('refusal' in from) {
      report(CameraWatchReportCode.ADDRESS_REFUSED, deviceId);
      if (strict) throw new CameraClockError(CameraClockRefusal.ADDRESS_REFUSED, deviceId);
      return ADDRESS_REFUSED;
    }
    return Object.freeze({ camera: target, from: from.sourceAddress });
  };

  const offsetOf = (read: Extract<Read, { kind: 'ANSWERED' }>): number | null => (read.cameraUtcMs === null ? null : Math.round(read.cameraUtcMs - read.coreMs));

  /** One beat of a watched camera; the next is asked for when this one has settled, so two reads of one camera never overlap. */
  const beat = async (deviceId: string, heart: Heartbeat): Promise<void> => {
    heart.cancel = null;
    const reading = new AbortController();
    heart.reading = reading;
    const target = await targetOf(deviceId, false).catch(() => null);
    // A refused stored address is a beat without an answer, and without a read: no camera the Core may use is there.
    const read: Read = target === ADDRESS_REFUSED ? { kind: 'NO_ANSWER' } : target === null || reading.signal.aborted ? { kind: 'UNDECIDED' } : await readOnce(deviceId, target, reading.signal);
    heart.reading = null;
    if (closed || hearts.get(deviceId) !== heart) return;
    if (read.kind === 'ANSWERED') {
      heart.failures = 0;
      const was = heart.state;
      heart.state = CameraPresence.PRESENT;
      if (was === CameraPresence.ABSENT) changed(deviceId, CameraWatchEvent.REACHABLE);
    } else if (read.kind === 'NO_ANSWER') {
      heart.failures += 1;
      if (heart.failures >= CAMERA_PRESENCE_FAILURES && heart.state !== CameraPresence.ABSENT) {
        heart.state = CameraPresence.ABSENT;
        changed(deviceId, CameraWatchEvent.UNREACHABLE);
      }
    }
    heart.cancel = timers.after(CAMERA_PRESENCE_INTERVAL_MS, () => void beat(deviceId, heart));
  };

  const stopHeart = (heart: Heartbeat): void => {
    heart.cancel?.();
    heart.cancel = null;
    heart.reading?.abort();
  };

  return Object.freeze({
    relayEnded(end: CameraStreamEnd): void {
      if (typeof end.sessionId === 'string') session ??= end.sessionId;
      const was = isLost(end.deviceId);
      // The relay of a leg that was lost is gone (its tries are used up): from here on the loss is the ended relay's.
      if (typeof end.profile === 'string') dropLegs(end.deviceId, (profile) => profile === end.profile);
      lostStreams.set(end.deviceId, (lostStreams.get(end.deviceId) ?? 0) + 1);
      // One fault per camera: a second stream of a camera that is lost already - or the end of a relay whose leg loss was said - raises nothing more.
      if (was) return;
      toSink(end.deviceId, 'raise');
      changed(end.deviceId, CameraWatchEvent.STREAM_LOST, typeof end.code === 'string' && CODE_WORD.test(end.code) ? end.code : null);
    },
    pushEstablished(up: CameraStreamUp): void {
      const deviceId = up.deviceId;
      const leg = up.leg;
      if (leg !== undefined && leg !== null) {
        // THE CAMERA LEG INSIDE A SESSION (finding F3-01). Never an established push: nothing below is touched by it.
        if (typeof leg.profile !== 'string') return;
        if (typeof up.sessionId === 'string') session ??= up.sessionId;
        const relay = relayOf(up) ?? '';
        if (leg.event === 'LOST') {
          const was = isLost(deviceId);
          const legs = lostLegs.get(deviceId) ?? new Map<string, string>();
          legs.set(leg.profile, relay);
          lostLegs.set(deviceId, legs);
          if (was) return;
          // AT ONCE: the first line of a loss, not the relay's end after its tries.
          toSink(deviceId, 'raise');
          changed(deviceId, CameraWatchEvent.STREAM_LOST, typeof leg.cause === 'string' && CODE_WORD.test(leg.cause) ? leg.cause : null);
        } else if (leg.event === 'REOPENED') {
          // Only the loss this watch was told of, of THAT relay: a re-open of anything else ends nothing.
          if (lostLegs.get(deviceId)?.get(leg.profile) !== relay) return;
          dropLegs(deviceId, (profile) => profile === leg.profile);
          if (isLost(deviceId)) return;
          toSink(deviceId, 'clear');
          changed(deviceId, CameraWatchEvent.STREAM_RETURNED);
        }
        return;
      }
      // Finding E-03: the first established push of ANOTHER session - the capture whose losses are held is over (one runs at a time).
      if (typeof up.sessionId === 'string') {
        if (session !== null && session !== up.sessionId) forgetLosses();
        session = up.sessionId;
      }
      const was = isLost(deviceId);
      // A push of ANOTHER relay than the one a lost leg belongs to (a later worker, a later session): that relay is gone, and the camera is back.
      const relay = relayOf(up);
      if (relay !== null) dropLegs(deviceId, (_profile, of) => of !== relay);
      const count = lostStreams.get(deviceId) ?? 0;
      if (count > 1) lostStreams.set(deviceId, count - 1);
      else lostStreams.delete(deviceId);
      if (!was || isLost(deviceId)) return;
      toSink(deviceId, 'clear');
      changed(deviceId, CameraWatchEvent.STREAM_RETURNED);
    },
    watch(deviceId: string): void {
      if (closed || hearts.has(deviceId)) return;
      const heart: Heartbeat = { state: CameraPresence.UNKNOWN, failures: 0, cancel: null, reading: null };
      hearts.set(deviceId, heart);
      void beat(deviceId, heart);
    },
    unwatch(deviceId: string): void {
      const heart = hearts.get(deviceId);
      if (heart === undefined) return;
      hearts.delete(deviceId);
      stopHeart(heart);
    },
    presence: (deviceId: string): CameraPresence => hearts.get(deviceId)?.state ?? CameraPresence.UNKNOWN,
    lost: (): readonly string[] => Object.freeze([...new Set([...lostStreams.keys(), ...lostLegs.keys()])]),
    captureEnded: forgetLosses,
    async check(deviceId: string, signal: AbortSignal): Promise<CameraCheck> {
      if (signal.aborted) throw new CaptureAdapterError(CaptureAdapterRefusal.ABORTED, deviceId);
      const target = await targetOf(deviceId, true);
      const read: Read = target === null || target === ADDRESS_REFUSED ? { kind: 'UNDECIDED' } : await readOnce(deviceId, target, signal);
      if (signal.aborted) throw new CaptureAdapterError(CaptureAdapterRefusal.ABORTED, deviceId);
      if (read.kind !== 'ANSWERED') return Object.freeze({ present: false, clockOffsetMs: null, clockWithinBound: false });
      const clockOffsetMs = offsetOf(read);
      return Object.freeze({ present: true, clockOffsetMs, clockWithinBound: clockOffsetMs !== null && Math.abs(clockOffsetMs) <= CAMERA_CLOCK_BOUND_MS });
    },
    async clockOffsetMs(deviceId: string): Promise<number> {
      const target = await targetOf(deviceId, true);
      const read: Read = target === null || target === ADDRESS_REFUSED ? { kind: 'UNDECIDED' } : await readOnce(deviceId, target, null);
      if (read.kind !== 'ANSWERED') throw new CameraClockError(CameraClockRefusal.NOT_ANSWERED, deviceId);
      const offset = offsetOf(read);
      if (offset === null) throw new CameraClockError(CameraClockRefusal.NOT_STATED, deviceId);
      return offset;
    },
    close(): void {
      closed = true;
      for (const heart of hearts.values()) stopHeart(heart);
      hearts.clear();
    },
  });
}
