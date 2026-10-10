/**
 * The forwarder: from the supervisor's events to the engine's INTERNAL actions (blueprint row 58
 * / M3-W2, row 71 / M5-W1; register SH-18, CS-04, telemetry part; capture spec §B.1, §E.1).
 *
 *   telemetry  ->  engine.applyCaptureTelemetry   (levels, ingest state, fragment counters)
 *   warning    ->  engine.raiseCaptureWarning     (state ACTIVE: the worker's and the supervisor's own)
 *                  engine.clearCaptureWarning     (state CLEARED)
 *   phase      ->  engine.clearCaptureFaults      (a NEW session reached RECORDING)
 *   record     ->  `notice`                       (a keyframe interval above the bound: the number)
 *
 * A FAULT A CAPTURE WARNING RAISED IS CLEARED BY THE CAPTURE SIDE (decision D72(h), finding A-2),
 * never by a demo operation, so that a later occurrence is a NEW fault with its own audit row.
 * HYSTERESIS: a `CLEARED` is applied only once the condition stayed cleared for
 * `CAPTURE_WARNING_CLEAR_HOLD_MS` (2 s), looked at when the next event arrives (telemetry comes
 * twenty times a second while recording). An `ACTIVE` inside that time cancels the clear and
 * writes nothing: a condition that flaps writes one audit row, not one per flap.
 *
 * ONE FAULT PER REASON (protocol 4; ruling D146, migration 0013). The engine knows a fault by its
 * kind, its REASON and its device; a worker warning says WHICH cause it is (`reason`). A camera
 * whose stream ended and whose clock is out of bound has two `CAPTURE_FAULT`s: each is raised with
 * its reason when it begins and cleared (after the hold) when IT ended, with its own alert and
 * audit rows. The table below holds one entry per (code, device, reason). `MIC_SILENT` has one
 * cause and is raised without one, as before; a supervisor's own fault has none either, except
 * the reason of a failed start (below).
 *
 * THE FAULT LIFE CYCLE (decision D84, findings R-1 to R-4 of the row-58 re-check):
 *   R-1  `MIC_SILENT` without a subject is no frame of protocol 4; should one arrive from the
 *        supervisor's side it raises nothing and is reported once per session. There is no
 *        "clear every silent microphone" rule;
 *   R-2  one subject form per microphone: the device ID (protocol 4). One microphone, one entry;
 *   R-3  the supervisor's own `CAPTURE_FAULT` of ANOTHER session than the one held is a new
 *        occurrence: the held fault is cleared, then the new one is raised - two sessions that
 *        fail in a row write two FAULT_RAISED rows;
 *   R-4  the table lives in memory and the faults are stored: when a session reaches `RECORDING`
 *        for the first time, EVERY active capture fault of the engine is cleared
 *        (`clearCaptureFaults`), not only what this table holds - a fault left by a Core that
 *        went down is over, and its next occurrence is recorded. The capture unit makes the same
 *        call once at boot.
 *
 * THE TWO KEYS OF A FAILED START (integration pass D8; contract C3 §5.3, §5.4 row C; D156). The
 * `params` of a stored alert cannot be changed, so the alert of a start that failed must hold
 * `reason` and `evidenceFiles` WHEN IT IS RAISED - and this forwarder raises it. The supervisor
 * says `workerDown` before its own `CAPTURE_FAULT`: when that down is the END of the session (no
 * restart follows), the worker's `CRASH` code is one of the protocol's final codes
 * (`FINAL_CRASH_CODES`: `NO_CAMERA_CONNECTED`) and NO durable-fragment record of the session was
 * seen, the raise carries `reason: <that code>` and `evidenceFiles: 0`. Both are facts of the
 * worker's own frames: an enumerated code and the count of a session without a durable fragment.
 * Any other end of a worker raises the fault without the keys, as before. The shared raise
 * (`raiseCaptureWarningTransition`) writes the two members into the alert's params and the
 * FAULT_RAISED details once it takes them; until then it reads `code` and `subject` only.
 *
 * A WORKER THE SUPERVISOR ENDED FOR WHAT IT SAID IS NAMED (tidy pass F-Y; review R63-05, ruling D179).
 * Since fix pass F-M3 the supervisor ends a worker whose TELEMETRY names a device outside the
 * session's plan (`PROTOCOL_VIOLATION` / `TELEMETRY_SUBJECT_UNKNOWN`) and one that says it switched
 * the microphone although no command asked for it (`SWITCH_NOT_COMMANDED`). When that down is the END
 * of the session's worker, the supervisor's own `CAPTURE_FAULT` that follows is raised with
 * `reason: <that code>` (`SUPERVISOR_REFUSAL_REASONS`, each with its sentence in the shared wording
 * source): the operator reads WHY the capture was stopped, not "stopped unexpectedly". Only the
 * reason: `evidenceFiles` belongs to a failed start, and such a session may hold durable media.
 * The codes are the supervisor's own literals, never text of the worker.
 *
 * ADVISORY REASONS ARE NOT FAULTS (decision D127 (2)). `KEYFRAME_INTERVAL_ABOVE_BOUND` says the
 * camera RECORDS and a crash would lose more than the fragment target: it raises no fault (the
 * camera is not shown as faulted for the session). THE OPERATOR IS TOLD BY A NAMED ADVISORY ALERT
 * (review row 63 R63-03, decision D179; the shared advisory notices of ruling D144 (4)), raised the
 * way pass D9 raises `MIC_RATE_AT_LIMIT`:
 *
 *   advisory                          raised at                                   resolved at
 *   KEYFRAME_INTERVAL_ABOVE_BOUND     the worker's ACTIVE warning of that reason,  the end of the session's capture
 *                                     or the record `KEYFRAME_INTERVAL` above      (the worker never clears it)
 *                                     the bound - whichever comes first, once
 *   FRAGMENT_SIZE_BOUND_REACHED       the worker's ACTIVE warning of that reason   the end of the session's capture
 *                                     (once per camera; closing pass F-X)          (the worker never clears it)
 *   AV_OFFSET_NEAR_BOUND              `clocks[].nearBound` true in the telemetry   `nearBound` false, or the end
 *   MIC_RATE_AT_LIMIT                 the worker's ACTIVE warning of that reason   its CLEARED, or the end
 *
 * Each is one `SYSTEM` alert (INFO) on the device, with `params.reason`; none is a fault, writes an
 * audit row, moves a device state, fails a start or switches a source. "The end" is the supervisor
 * leaving the session (IDLE, FAULTED, CLOSED) or another session reaching RECORDING. The `notice`
 * of the record still carries the number to the log.
 *
 * A CAMERA THAT DID NOT CONNECT IS NOT A CRITICAL FAULT OF THE CAPTURE (review row 74 R74-03; ux
 * §8e.2, §8g.3). The worker's `CAMERA_NOT_CONNECTED` names a camera of the plan that did not
 * connect within the ingest-open window. When another camera records, that is a DEGRADED start: a
 * WARNING naming the camera, raised by the notices unit from the capture session's event
 * (`src/capture-notices/session-start.ts`). When none connects the session is a failed start with
 * ONE critical alert, the capture-wide one. So this reason raises no fault here in either case.
 *
 * NOTICES (level `warn`, written by the capture unit to the log and the persistent error log):
 *   the keyframe interval above the bound (the record), a camera clock near the AV bound (the
 *   `nearBound` flag of the telemetry, decision D58-7: a flag, never a warning code), and a
 *   microphone whose rate controller is at its limit (`ratePpm` at +-5,000: said beside the fault
 *   the worker raises for it, with the number). Each is said once per episode.
 *
 * NOT here: `progress` -> `applySealingProgress` and the seal-completion record -> `completeSeal`
 * are the sealing row's (82); the session itself (start, stop, the first durable fragment, the
 * end of a capture, the audio-source intervals) is the unit `src/capture-session`.
 *
 * IT NEVER HOLDS THE QUEUE. The supervisor delivers the worker's events one at a time and waits
 * for a listener that returns a promise. These listeners return nothing: the engine's answer is
 * awaited apart, so a slow engine delays no heartbeat, no command and no later event.
 *
 * FAILURES. An engine that refuses is reported through `report`, which the capture unit writes to
 * the log and to the persistent error log. Telemetry arrives twenty times a second, so a failure
 * is reported ONCE per session until it succeeds again.
 *
 * This file names no process, no file, no timer and no clock, and it logs nothing itself.
 */
import { ADVISORY_WARNING_REASONS, CaptureRecordKind, CaptureWarningCode, CaptureWarningReason, CaptureWarningState, DURABLE_RECORD_KINDS, FINAL_CRASH_CODES } from '@dems/capture-protocol';
import { CaptureAdvisoryReason, type CaptureAdvisoryNotice, type CaptureFaultWarningInput, type CaptureTelemetryInput } from '@dems/shared/sim';
import type { CaptureReport, CaptureSupervisor } from './types';

/**
 * The two keys of a failed start on the raise of its fault (C3 §5.3, §5.4 row C): the worker's
 * final crash code, and the number of evidence files of a session without a durable fragment.
 */
export interface FailedStartKeys {
  readonly reason: string;
  readonly evidenceFiles: 0;
}
/**
 * The refusals of the supervisor that end a worker and are said to the operator by name (tidy pass
 * F-Y): `WorkerDown.detail` of a `PROTOCOL_VIOLATION`. Each has a sentence in
 * `@dems/shared/sim` `capture-fault-wording.ts`.
 */
export const SUPERVISOR_REFUSAL_REASONS: readonly string[] = Object.freeze(['TELEMETRY_SUBJECT_UNKNOWN', 'SWITCH_NOT_COMMANDED']);

/** What the forwarder raises: the fault of a warning, with the keys of a failed start when it is one. */
export type ForwardedFaultWarning = CaptureFaultWarningInput & Partial<FailedStartKeys>;

/** What the forwarder needs of the engine host: its INTERNAL capture actions. */
export interface CaptureEngine {
  applyCaptureTelemetry(telemetry: CaptureTelemetryInput): Promise<unknown>;
  /** A fault of a warning, or the advisory notice of a microphone whose rate correction is at its limit (pass D9). */
  raiseCaptureWarning(warning: ForwardedFaultWarning | CaptureAdvisoryNotice): Promise<unknown>;
  /** A fault is cleared by what it was raised under: code, device and - when it has one - its reason (ruling D146). */
  clearCaptureWarning(warning: ForwardedFaultWarning | CaptureAdvisoryNotice): Promise<unknown>;
  /** Every active capture fault of the engine, whoever raised it (decision D84 R-4). */
  clearCaptureFaults(): Promise<unknown>;
}

export const CaptureNoticeCode = {
  /** The record `KEYFRAME_INTERVAL` with `aboveBound`: `value` is the observed interval in ms, `bound` the target. */
  KEYFRAME_INTERVAL_ABOVE_BOUND: 'CAPTURE_KEYFRAME_INTERVAL_ABOVE_BOUND',
  /** `clocks[].nearBound` became true: `value` is the lag in ms. */
  CLOCK_NEAR_BOUND: 'CAPTURE_CLOCK_NEAR_BOUND',
  /** `levels[].ratePpm` is at the limit of the rate controller: `value` is the rate in ppm, `bound` the limit. */
  MIC_RATE_AT_LIMIT: 'CAPTURE_MIC_RATE_AT_LIMIT',
} as const;
export type CaptureNoticeCode = (typeof CaptureNoticeCode)[keyof typeof CaptureNoticeCode];

/** Something the operator should know that is no failure of the forwarding. Identifiers and numbers only. */
export interface CaptureNotice {
  readonly code: CaptureNoticeCode;
  readonly sessionId: string;
  readonly correlationId: string;
  readonly deviceId: string;
  readonly value: number;
  readonly bound: number | null;
}

/** The limit of the worker's rate controller, in parts per million (decision D85; protocol 4 `levels[].ratePpm`). */
export const CAPTURE_MIC_RATE_LIMIT_PPM = 5_000;

export interface CaptureForwarderOptions {
  readonly capture: Pick<CaptureSupervisor, 'on'>;
  /** Read at every event: the engine is a seam, and a test replaces it after `ready()`. Null: no engine, nothing is forwarded. */
  readonly engine: () => CaptureEngine | null;
  readonly report: (report: CaptureReport) => void;
  /** Where a notice goes. Default: nowhere. */
  readonly notice?: (notice: CaptureNotice) => void;
  /** Milliseconds that never move backwards: the server clock. */
  readonly now: () => number;
}

export const ForwarderReportCode = {
  TELEMETRY_FAILED: 'CAPTURE_TELEMETRY_NOT_APPLIED',
  WARNING_FAILED: 'CAPTURE_WARNING_NOT_RAISED',
  /** The advisory notice of a microphone at its rate limit could not be raised / resolved (pass D9). */
  ADVISORY_FAILED: 'CAPTURE_ADVISORY_NOT_RAISED',
  ADVISORY_CLEAR_FAILED: 'CAPTURE_ADVISORY_NOT_RESOLVED',
  CLEAR_FAILED: 'CAPTURE_WARNING_NOT_CLEARED',
  TELEMETRY_RECOVERED: 'CAPTURE_TELEMETRY_APPLIED_AGAIN',
  /** `MIC_SILENT` without a subject (D84 R-1): not raised. */
  SUBJECT_MISSING: 'CAPTURE_WARNING_SUBJECT_MISSING',
  STALE_CLEAR_FAILED: 'CAPTURE_STALE_FAULTS_NOT_CLEARED',
} as const;

/** A cleared condition must stay cleared this long before its fault is cleared (see the header). */
export const CAPTURE_WARNING_CLEAR_HOLD_MS = 2_000;

interface Raised {
  /** What the engine was told at the raise, without the file count: the clear says the same fault (code, device, reason). */
  readonly warning: ForwardedFaultWarning;
  /** The cause the worker named (`''`: none - a supervisor's fault, or `MIC_SILENT`): the third part of the table's key. */
  readonly reason: string;
  readonly sessionId: string;
  readonly correlationId: string;
  /** When the cause was said to be over, or null while it is active. */
  clearedAt: number | null;
}

/** Subscribes to the supervisor. Returns the function that ends the forwarding. */
export function forwardCaptureEvents(options: CaptureForwarderOptions): () => void {
  const { capture, engine, now } = options;
  /** A report never throws back into a promise of the forwarder (finding A-13). */
  const report = (entry: CaptureReport): void => {
    try {
      options.report(entry);
    } catch {
      // Nowhere left to say it.
    }
  };
  const notice = (entry: CaptureNotice): void => {
    try {
      options.notice?.(entry);
    } catch {
      // A notice never throws back into the supervisor's paths.
    }
  };
  /** The session whose telemetry is failing, or null: one report per episode. */
  let telemetryFailing: string | null = null;
  /** The faults this forwarder raised and has not cleared, by code and device. */
  const raised = new Map<string, Raised>();
  const keyOf = (warning: CaptureFaultWarningInput, reason: string): string => `${warning.code}:${warning.subject ?? ''}:${reason}`;
  /** The session whose subject-less `MIC_SILENT` was reported: one report per session (R-1). */
  let subjectMissingSaid: string | null = null;
  /** The session that last reached `RECORDING`: the stale faults are cleared once per session (R-4). */
  let recording: string | null = null;
  /** The advice this forwarder raised and has not resolved, by reason and device: the session it was raised in. */
  const advised = new Map<string, { readonly advice: CaptureAdvisoryNotice; readonly sessionId: string; readonly correlationId: string }>();
  const adviceKey = (reason: CaptureAdvisoryReason, subject: string): string => `${reason}|${subject}`;
  /** `code|correlationId|deviceId` of the level notices whose condition holds now: one notice per episode. */
  const noticed = new Set<string>();
  /** The session (by correlation ID) of which a durable-fragment record was seen: it holds evidence. */
  let durable: string | null = null;
  /** The session whose worker ended for good with a final crash code while nothing was durable, and that code. */
  let failedStart: { readonly correlationId: string; readonly reason: string } | null = null;
  /** The session whose worker the supervisor ended for good for a NAMED refusal (`SUPERVISOR_REFUSAL_REASONS`), and that name. */
  let refused: { readonly correlationId: string; readonly reason: string } | null = null;

  function clear(host: CaptureEngine, entry: Raised): void {
    if (raised.get(keyOf(entry.warning, entry.reason)) === entry) raised.delete(keyOf(entry.warning, entry.reason));
    Promise.resolve()
      .then(() => host.clearCaptureWarning(entry.warning))
      .catch((err: unknown) => report({ source: 'capture.forwarder', code: ForwarderReportCode.CLEAR_FAILED, sessionId: entry.sessionId, correlationId: entry.correlationId, err }));
  }

  function raise(host: CaptureEngine, warning: CaptureFaultWarningInput, reason: string, ids: { readonly sessionId: string; readonly correlationId: string }, keys: FailedStartKeys | null = null, named: string | null = null): void {
    // The engine's key is (kind, reason, device): a `CAPTURE_FAULT` is raised with the worker's reason,
    // or with the final crash code of a failed start; `MIC_SILENT` has one cause and names none.
    // ... or with the name of what the supervisor refused (tidy pass F-Y).
    const engineReason = keys !== null ? keys.reason : named !== null ? named : warning.code === CaptureWarningCode.CAPTURE_FAULT && reason !== '' ? reason : null;
    const known: ForwardedFaultWarning = engineReason === null ? warning : { ...warning, reason: engineReason };
    // The file count belongs to the raise alone: a later clear names the fault, not its facts.
    const entry: Raised = { warning: known, reason, sessionId: ids.sessionId, correlationId: ids.correlationId, clearedAt: null };
    raised.set(keyOf(warning, reason), entry);
    const said: ForwardedFaultWarning = keys === null ? known : { ...known, evidenceFiles: keys.evidenceFiles };
    Promise.resolve()
      .then(() => host.raiseCaptureWarning(said))
      .catch((err: unknown) => {
        // A warning is rare and each one matters: every failure is reported. What the engine did not raise is not ours to clear.
        if (raised.get(keyOf(warning, reason)) === entry) raised.delete(keyOf(warning, reason));
        report({ source: 'capture.forwarder', code: ForwarderReportCode.WARNING_FAILED, sessionId: ids.sessionId, correlationId: ids.correlationId, err });
      });
  }

  /** Clears what stayed cleared long enough. */
  function settle(host: CaptureEngine): void {
    const at = now();
    for (const entry of raised.values()) {
      if (entry.clearedAt !== null && at - entry.clearedAt >= CAPTURE_WARNING_CLEAR_HOLD_MS) clear(host, entry);
    }
  }

  type Ids = { readonly sessionId: string; readonly correlationId: string };

  /** Raises the named advisory alert of (reason, device) once per session: while it is held, a repeated statement writes nothing. */
  function adviseOn(host: CaptureEngine, reason: CaptureAdvisoryReason, subject: string, ids: Ids): void {
    const key = adviceKey(reason, subject);
    // Still advised for this session: the engine holds one alert per (reason, device); nothing is written.
    if (advised.get(key)?.correlationId === ids.correlationId) return;
    const entry = { advice: { code: reason, subject } satisfies CaptureAdvisoryNotice, sessionId: ids.sessionId, correlationId: ids.correlationId };
    advised.set(key, entry);
    Promise.resolve()
      .then(() => host.raiseCaptureWarning({ ...entry.advice, sessionId: ids.sessionId }))
      .catch((err: unknown) => {
        // What the engine did not raise is not held: the next statement of the condition asks again.
        if (advised.get(key) === entry) advised.delete(key);
        report({ source: 'capture.forwarder', code: ForwarderReportCode.ADVISORY_FAILED, sessionId: ids.sessionId, correlationId: ids.correlationId, err });
      });
  }

  /** Resolves the advice of (reason, device) when this session raised it. */
  function adviseOff(host: CaptureEngine, reason: CaptureAdvisoryReason, subject: string, ids: Ids): void {
    const key = adviceKey(reason, subject);
    const entry = advised.get(key);
    if (entry === undefined || entry.correlationId !== ids.correlationId) return;
    advised.delete(key);
    resolveAdvice(host, entry.advice, ids);
  }

  /** The capture of the advised session is over: every advice of it is resolved (it is no fault, so `clearCaptureFaults` does not). */
  function resolveEveryAdvice(host: CaptureEngine): void {
    for (const entry of advised.values()) resolveAdvice(host, entry.advice, entry);
    advised.clear();
  }

  /**
   * THE WORKER'S WARNING `MIC_RATE_AT_LIMIT` IS ADVICE, NOT A FAULT (integration pass D9, item 6;
   * ruling D144 (4); the advisory notice of `@dems/shared/sim` `capture-notices.ts`), and so is
   * `KEYFRAME_INTERVAL_ABOVE_BOUND` (decision D127 (2); review R63-03). The worker says each as a
   * protocol-4 WARNING whose reason names the condition and whose subject is the device. Here it
   * becomes the NAMED advisory alert (`SYSTEM`, INFO, `params.reason`, target = the device ID):
   * raised at ACTIVE, resolved at CLEARED and when the capture of the session ends. It raises no
   * fault, writes no audit row, moves no device state - and it NEVER switches the source (OD-11):
   * this unit has no door that could.
   */
  function advise(host: CaptureEngine, reason: CaptureAdvisoryReason, event: { readonly subject: string | null; readonly state: CaptureWarningState; readonly sessionId: string; readonly correlationId: string }): void {
    const ids = { sessionId: event.sessionId, correlationId: event.correlationId };
    if (event.subject === null) {
      // No device is named: there is nothing to put the advice on. Said once per session.
      if (subjectMissingSaid !== event.correlationId) {
        subjectMissingSaid = event.correlationId;
        report({ source: 'capture.forwarder', code: ForwarderReportCode.SUBJECT_MISSING, ...ids, err: new Error(`a ${reason} warning names no device: no advice is raised`) });
      }
      return;
    }
    if (event.state === CaptureWarningState.CLEARED) adviseOff(host, reason, event.subject, ids);
    else adviseOn(host, reason, event.subject, ids);
  }

  function resolveAdvice(host: CaptureEngine, advice: CaptureAdvisoryNotice, ids: Ids): void {
    Promise.resolve()
      .then(() => host.clearCaptureWarning(advice))
      .catch((err: unknown) => report({ source: 'capture.forwarder', code: ForwarderReportCode.ADVISORY_CLEAR_FAILED, ...ids, err }));
  }

  /** One notice per episode of a level condition: said when it begins, forgotten when it ended. */
  function level(code: CaptureNoticeCode, holds: boolean, ids: { readonly sessionId: string; readonly correlationId: string }, deviceId: string, value: number, bound: number | null): void {
    const key = `${code}|${ids.correlationId}|${deviceId}`;
    if (!holds) {
      noticed.delete(key);
      return;
    }
    if (noticed.has(key)) return;
    noticed.add(key);
    notice({ code, sessionId: ids.sessionId, correlationId: ids.correlationId, deviceId, value, bound });
  }

  const offTelemetry = capture.on('telemetry', (event) => {
    const { levels, ingest, fragments, clocks } = event.frame;
    const ids = { sessionId: event.sessionId, correlationId: event.correlationId };
    // What the operator should know and no slice holds (D58-7, D85): said even while no engine runs.
    for (const clock of clocks) level(CaptureNoticeCode.CLOCK_NEAR_BOUND, clock.nearBound, ids, clock.deviceId, clock.lagMs, null);
    for (const mic of levels) level(CaptureNoticeCode.MIC_RATE_AT_LIMIT, mic.ratePpm !== null && Math.abs(mic.ratePpm) >= CAPTURE_MIC_RATE_LIMIT_PPM, ids, mic.deviceId, mic.ratePpm ?? 0, CAPTURE_MIC_RATE_LIMIT_PPM);
    const host = engine();
    if (host === null) return;
    settle(host);
    // R63-03: a camera clock near the audio / video bound is ADVICE the operator sees, raised once per episode.
    for (const clock of clocks) {
      if (clock.nearBound) adviseOn(host, CaptureAdvisoryReason.AV_OFFSET_NEAR_BOUND, clock.deviceId, ids);
      else adviseOff(host, CaptureAdvisoryReason.AV_OFFSET_NEAR_BOUND, clock.deviceId, ids);
    }
    // Not returned: the supervisor's queue does not wait for the engine.
    Promise.resolve()
      .then(() => host.applyCaptureTelemetry({ levels, ingest, fragments }))
      .then(
        () => {
          if (telemetryFailing !== event.correlationId) return;
          telemetryFailing = null;
          report({ source: 'capture.forwarder', code: ForwarderReportCode.TELEMETRY_RECOVERED, ...ids, err: null });
        },
        (err: unknown) => {
          if (telemetryFailing === event.correlationId) return;
          telemetryFailing = event.correlationId;
          report({ source: 'capture.forwarder', code: ForwarderReportCode.TELEMETRY_FAILED, ...ids, err });
        },
      );
  });

  const offWarning = capture.on('warning', (event) => {
    const host = engine();
    // D127 (2): an advisory reason is not a fault. R63-03: it is the named advisory alert of the camera.
    if (event.reason !== null && (ADVISORY_WARNING_REASONS as readonly CaptureWarningReason[]).includes(event.reason)) {
      // The advisory reasons with a shared notice; another one (a later protocol) is said by its record or by its own row.
      if (host !== null && event.reason === CaptureWarningReason.KEYFRAME_INTERVAL_ABOVE_BOUND) advise(host, CaptureAdvisoryReason.KEYFRAME_INTERVAL_ABOVE_BOUND, event);
      // Ruling D179 (a), closing pass F-X: a fragment closed at the size bound is told the same way. Matched by the reason's
      // NAME, so a worker of a protocol that does not know the reason simply never says it.
      else if (host !== null && (event.reason as string) === CaptureAdvisoryReason.FRAGMENT_SIZE_BOUND_REACHED) advise(host, CaptureAdvisoryReason.FRAGMENT_SIZE_BOUND_REACHED, event);
      return;
    }
    // R74-03: a camera that did not connect is the WARNING of a degraded start (the notices unit), never a critical fault of the camera.
    if (event.reason === CaptureWarningReason.CAMERA_NOT_CONNECTED) return;
    if (host === null) return;
    // Pass D9: the rate-limit condition of a microphone is advice with its own named alert, never a fault.
    if (event.reason === CaptureWarningReason.MIC_RATE_AT_LIMIT) {
      advise(host, CaptureAdvisoryReason.MIC_RATE_AT_LIMIT, event);
      return;
    }
    if (event.code === CaptureWarningCode.MIC_SILENT && event.subject === null) {
      // R-1: forbidden. Nothing is raised and nothing is cleared for it.
      if (subjectMissingSaid !== event.correlationId) {
        subjectMissingSaid = event.correlationId;
        report({ source: 'capture.forwarder', code: ForwarderReportCode.SUBJECT_MISSING, sessionId: event.sessionId, correlationId: event.correlationId, err: new Error('a MIC_SILENT warning names no microphone: it is not raised') });
      }
      return;
    }
    const warning: CaptureFaultWarningInput = { code: event.code, subject: event.subject };
    const reason = event.reason ?? '';
    const known = raised.get(keyOf(warning, reason));
    // The supervisor's own fault of the session whose worker just ended a start that recorded nothing.
    const keys: FailedStartKeys | null =
      event.source === 'supervisor' && event.code === CaptureWarningCode.CAPTURE_FAULT && event.subject === null && failedStart !== null && failedStart.correlationId === event.correlationId && durable !== event.correlationId
        ? { reason: failedStart.reason, evidenceFiles: 0 }
        : null;
    // The supervisor's own fault of the session whose worker it just ended for a named refusal (tidy pass F-Y).
    const named: string | null = keys === null && event.source === 'supervisor' && event.code === CaptureWarningCode.CAPTURE_FAULT && event.subject === null && refused !== null && refused.correlationId === event.correlationId ? refused.reason : null;
    if (event.state === CaptureWarningState.CLEARED) {
      // Another cause on the same device is another entry and another fault of the engine: it stays.
      if (known === undefined || known.correlationId !== event.correlationId) return;
      // The supervisor's own fault ends with a new recording, at once; a worker's must stay cleared for the hold.
      if (event.source === 'supervisor') clear(host, known);
      else known.clearedAt = now();
      return;
    }
    if (known !== undefined && known.correlationId !== event.correlationId) {
      // R-3: the same fault of ANOTHER session is a new occurrence: the held one ends, then this one is raised.
      clear(host, known);
      raise(host, warning, reason, event, keys, named);
      return;
    }
    if (known !== undefined) {
      // Still raised in the engine: the condition came back inside the hold. Nothing is written.
      known.clearedAt = null;
      return;
    }
    raise(host, warning, reason, event, keys, named);
  });

  const offDown = capture.on('workerDown', (event) => {
    // The END of a session's worker (no restart follows) with a code a new worker would repeat.
    const code = event.down.detail;
    failedStart = event.restartInMs === null && code !== null && FINAL_CRASH_CODES.includes(code) ? { correlationId: event.correlationId, reason: code } : null;
    // The END of a session's worker because the supervisor refused what it said, by the supervisor's own name for it.
    refused = event.restartInMs === null && event.down.code === 'PROTOCOL_VIOLATION' && code !== null && SUPERVISOR_REFUSAL_REASONS.includes(code) ? { correlationId: event.correlationId, reason: code } : null;
  });

  const offRecord = capture.on('record', (event) => {
    const { record } = event;
    if ((DURABLE_RECORD_KINDS as readonly string[]).includes(record.kind)) durable = event.correlationId;
    if (record.kind !== CaptureRecordKind.KEYFRAME_INTERVAL || !record.aboveBound) return;
    notice({ code: CaptureNoticeCode.KEYFRAME_INTERVAL_ABOVE_BOUND, sessionId: event.sessionId, correlationId: event.correlationId, deviceId: record.deviceId, value: record.observedMs, bound: record.boundMs });
    // R63-03: the record of an interval that completed above the bound raises the same advice when no warning did.
    const host = engine();
    if (host !== null) adviseOn(host, CaptureAdvisoryReason.KEYFRAME_INTERVAL_ABOVE_BOUND, record.deviceId, event);
  });

  const offPhase = capture.on('phase', (event) => {
    // The supervisor left the session (a stop, a fault for good, a shutdown): its advice is over.
    if (event.phase === 'IDLE' || event.phase === 'FAULTED' || event.phase === 'CLOSED') {
      const ended = engine();
      if (ended !== null) resolveEveryAdvice(ended);
      return;
    }
    if (event.phase !== 'RECORDING' || recording === event.correlationId) return;
    // A NEW session records (R-4): every capture fault of the sessions before it is over - what
    // this table holds and what a Core that went down left raised in the engine. One call clears
    // them all, each with its own FAULT_CLEARED row; the table starts empty for this session.
    recording = event.correlationId;
    noticed.clear();
    const host = engine();
    if (host === null) return;
    // The advice of the sessions before it is over as well: it is no fault, so the call below does not resolve it.
    resolveEveryAdvice(host);
    raised.clear();
    Promise.resolve()
      .then(() => host.clearCaptureFaults())
      .catch((err: unknown) => report({ source: 'capture.forwarder', code: ForwarderReportCode.STALE_CLEAR_FAILED, sessionId: event.sessionId, correlationId: event.correlationId, err }));
  });

  return () => {
    offTelemetry();
    offWarning();
    offDown();
    offRecord();
    offPhase();
  };
}
