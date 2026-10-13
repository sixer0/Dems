/**
 * CAMERA LOSS, PRESENCE AND CLOCK OFFSET of the production camera adapter (task 4 row 49, WP-06c;
 * design addendum 2.5 "presence (the unauthenticated time read) is a pre-check item", 8.3 "G-R2,
 * G-R10 kept: presence uses the ONVIF time read"; plan review, WP-06 verdict: "presence by TCP
 * reachability has no permitted place").
 *
 * REGISTERED NOWHERE, as the adapter beside it (`onvif-relay.ts`): the composition of the
 * production registry (row 85) makes one watch, hands `relayEnded` to the adapter as its
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
 * It does not log (the capture folder logs in one place): what went wrong is told to `report`. No
 * address and no device text is in a report, a change or an error.
 *
 * It reads no clock and names no global timer (static rule G-R8): `now` and `timers` are handed in.
 */
import { CaptureWarningCode, CaptureWarningReason } from '@dems/capture-protocol';
import type { CaptureTimers } from '../../types';
import { CaptureAdapterError, CaptureAdapterRefusal } from '../errors';
import type { CameraCandidate } from '../types';

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
 */
export interface CameraTimeReader {
  read(candidate: CameraCandidate, signal: AbortSignal): Promise<CameraTimeAnswer>;
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
} as const;
export type CameraClockRefusal = (typeof CameraClockRefusal)[keyof typeof CameraClockRefusal];

const CLOCK_SENTENCE: Readonly<Record<CameraClockRefusal, string>> = Object.freeze({
  CAPTURE_CAMERA_CLOCK_NOT_ANSWERED: 'the camera did not answer the time read',
  CAPTURE_CAMERA_CLOCK_NOT_STATED: 'the camera named no usable time',
  CAPTURE_CAMERA_CLOCK_ADDRESS_NOT_READ: 'the stored address of the camera could not be read',
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
}
export interface CameraStreamUp {
  readonly deviceId: string;
}

export interface CameraWatch {
  /** The adapter's `relayEnded`: a relay ended by itself after its open. */
  relayEnded(end: CameraStreamEnd): void;
  /** A listener of the adapter's `relayReports`: a push was established. */
  pushEstablished(report: CameraStreamUp): void;
  /** Starts the heartbeat of a camera. Watching twice is one watch. */
  watch(deviceId: string): void;
  /** Stops it and forgets what was known of the camera's presence. A running read is cut. */
  unwatch(deviceId: string): void;
  presence(deviceId: string): CameraPresence;
  /** The cameras that are lost now (a relay ended by itself and no push returned since). */
  lost(): readonly string[];
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
type Read = { readonly kind: 'ANSWERED'; readonly cameraUtcMs: number | null; readonly coreMs: number } | { readonly kind: 'NO_ANSWER' } | { readonly kind: 'UNDECIDED' };

const usableInstant = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

export function createCameraWatch(dependencies: CameraWatchDependencies): CameraWatch {
  const { timers, now, reader, candidate } = dependencies;
  const hearts = new Map<string, Heartbeat>();
  /** Per camera: how many of its relays ended by themselves with no push established since. */
  const lostStreams = new Map<string, number>();
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
  const toSink = (deviceId: string, act: 'raise' | 'clear'): void => {
    const sink = dependencies.faults;
    if (sink === undefined) return;
    try {
      void Promise.resolve(sink[act](faultOf(deviceId))).catch(() => report(CameraWatchReportCode.SINK_FAILED, deviceId));
    } catch {
      report(CameraWatchReportCode.SINK_FAILED, deviceId);
    }
  };

  /** ONE time read, bounded here and by the caller's signal. It never rejects. */
  const readOnce = async (deviceId: string, target: CameraCandidate, outer: AbortSignal | null): Promise<Read> => {
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
      const answer = await Promise.race([reader.read(target, bound.signal), stopped]);
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
  const targetOf = async (deviceId: string, strict: boolean): Promise<CameraCandidate | null> => {
    let target: CameraCandidate | null;
    try {
      target = await candidate(deviceId);
    } catch {
      report(CameraWatchReportCode.CANDIDATE_NOT_READ, deviceId);
      if (strict) throw new CameraClockError(CameraClockRefusal.ADDRESS_NOT_READ, deviceId);
      return null;
    }
    if (target === null && strict) throw new CaptureAdapterError(CaptureAdapterRefusal.DEVICE_UNKNOWN);
    if (target === null) report(CameraWatchReportCode.CANDIDATE_NOT_READ, deviceId);
    return target;
  };

  const offsetOf = (read: Extract<Read, { kind: 'ANSWERED' }>): number | null => (read.cameraUtcMs === null ? null : Math.round(read.cameraUtcMs - read.coreMs));

  /** One beat of a watched camera; the next is asked for when this one has settled, so two reads of one camera never overlap. */
  const beat = async (deviceId: string, heart: Heartbeat): Promise<void> => {
    heart.cancel = null;
    const reading = new AbortController();
    heart.reading = reading;
    const target = await targetOf(deviceId, false).catch(() => null);
    const read: Read = target === null || reading.signal.aborted ? { kind: 'UNDECIDED' } : await readOnce(deviceId, target, reading.signal);
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
      const count = lostStreams.get(end.deviceId) ?? 0;
      lostStreams.set(end.deviceId, count + 1);
      // One fault per camera: a second stream of a camera that is lost already raises nothing more.
      if (count > 0) return;
      toSink(end.deviceId, 'raise');
      changed(end.deviceId, CameraWatchEvent.STREAM_LOST, typeof end.code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(end.code) ? end.code : null);
    },
    pushEstablished(up: CameraStreamUp): void {
      const count = lostStreams.get(up.deviceId) ?? 0;
      if (count === 0) return;
      if (count > 1) {
        lostStreams.set(up.deviceId, count - 1);
        return;
      }
      lostStreams.delete(up.deviceId);
      toSink(up.deviceId, 'clear');
      changed(up.deviceId, CameraWatchEvent.STREAM_RETURNED);
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
    lost: (): readonly string[] => Object.freeze([...lostStreams.keys()]),
    async check(deviceId: string, signal: AbortSignal): Promise<CameraCheck> {
      if (signal.aborted) throw new CaptureAdapterError(CaptureAdapterRefusal.ABORTED, deviceId);
      const target = await targetOf(deviceId, true);
      const read: Read = target === null ? { kind: 'UNDECIDED' } : await readOnce(deviceId, target, signal);
      if (signal.aborted) throw new CaptureAdapterError(CaptureAdapterRefusal.ABORTED, deviceId);
      if (read.kind !== 'ANSWERED') return Object.freeze({ present: false, clockOffsetMs: null, clockWithinBound: false });
      const clockOffsetMs = offsetOf(read);
      return Object.freeze({ present: true, clockOffsetMs, clockWithinBound: clockOffsetMs !== null && Math.abs(clockOffsetMs) <= CAMERA_CLOCK_BOUND_MS });
    },
    async clockOffsetMs(deviceId: string): Promise<number> {
      const target = await targetOf(deviceId, true);
      const read: Read = target === null ? { kind: 'UNDECIDED' } : await readOnce(deviceId, target, null);
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
