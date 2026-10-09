/**
 * The forwarder: from the supervisor's events to the engine's INTERNAL actions (blueprint row 58
 * / M3-W2; register SH-18, CS-04, telemetry part; capture spec §B.1 "Closure status").
 *
 *   telemetry  ->  engine.applyCaptureTelemetry   (levels, ingest state, fragment counters)
 *   warning    ->  engine.raiseCaptureWarning     (state ACTIVE: the worker's and the supervisor's own)
 *                  engine.clearCaptureWarning     (state CLEARED, and at the next recording)
 *
 * A FAULT A CAPTURE WARNING RAISED IS CLEARED BY THE CAPTURE SIDE (decision D72, finding A-2),
 * never by a demo operation, so that a later occurrence is a NEW fault with its own audit row:
 *   - the worker (or the supervisor, for its own `CAPTURE_FAULT`) says `CLEARED`;
 *   - when a later session reaches `RECORDING`, every fault this forwarder raised before and
 *     that nobody cleared is cleared: a new recording starts with no fault of an old one.
 * HYSTERESIS: a `CLEARED` is applied only once the condition stayed cleared for
 * `CAPTURE_WARNING_CLEAR_HOLD_MS` (2 s), looked at when the next event arrives (telemetry comes
 * twenty times a second while recording). An `ACTIVE` inside that time cancels the clear and
 * writes nothing: a condition that flaps writes one audit row, not one per flap.
 *
 * NOT here: `progress` -> `applySealingProgress` and the seal-completion record -> `completeSeal`
 * are the sealing row's (82); the hosted pair `switchAudioSource` / `setCaptureConfig` is the
 * selector row's (66). SH-18 and CS-04 close with those rows, not with this file.
 *
 * IT NEVER HOLDS THE QUEUE. The supervisor delivers the worker's events one at a time and waits
 * for a listener that returns a promise. These listeners return nothing: the engine's answer is
 * awaited apart, so a slow engine delays no heartbeat, no command and no later event. The engine
 * joins telemetry that arrives while a unit waits (the newest frame wins), so nothing piles up.
 *
 * FAILURES. An engine that refuses (not running, a subject it does not know) is reported through
 * `report`, which the capture unit writes to the log and to the persistent error log. Telemetry
 * arrives twenty times a second, so a failure is reported ONCE per session and action until that
 * action succeeds again: the error log is told that it broke and when it healed, not every frame.
 *
 * This file names no process, no file, no timer and no clock, and it logs nothing itself.
 */
import type { CaptureTelemetryInput, CaptureWarningInput } from '@dems/shared/sim';
import type { CaptureReport, CaptureSupervisor } from './types';

/** What the forwarder needs of the engine host: its three INTERNAL capture actions. */
export interface CaptureEngine {
  applyCaptureTelemetry(telemetry: CaptureTelemetryInput): Promise<unknown>;
  raiseCaptureWarning(warning: CaptureWarningInput): Promise<unknown>;
  clearCaptureWarning(warning: CaptureWarningInput): Promise<unknown>;
}

export interface CaptureForwarderOptions {
  readonly capture: Pick<CaptureSupervisor, 'on'>;
  /** Read at every event: the engine is a seam, and a test replaces it after `ready()`. Null: no engine, nothing is forwarded. */
  readonly engine: () => CaptureEngine | null;
  readonly report: (report: CaptureReport) => void;
  /** Milliseconds that never move backwards: the server clock. */
  readonly now: () => number;
}

export const ForwarderReportCode = {
  TELEMETRY_FAILED: 'CAPTURE_TELEMETRY_NOT_APPLIED',
  WARNING_FAILED: 'CAPTURE_WARNING_NOT_RAISED',
  CLEAR_FAILED: 'CAPTURE_WARNING_NOT_CLEARED',
  TELEMETRY_RECOVERED: 'CAPTURE_TELEMETRY_APPLIED_AGAIN',
} as const;

/** A cleared condition must stay cleared this long before its fault is cleared (see the header). */
export const CAPTURE_WARNING_CLEAR_HOLD_MS = 2_000;

interface Raised {
  readonly warning: CaptureWarningInput;
  readonly sessionId: string;
  readonly correlationId: string;
  /** When the condition was said to be over, or null while it is active. */
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
  /** The session whose telemetry is failing, or null: one report per episode. */
  let telemetryFailing: string | null = null;
  /** The faults this forwarder raised and has not cleared, by code and subject. */
  const raised = new Map<string, Raised>();
  const keyOf = (warning: CaptureWarningInput): string => `${warning.code}:${warning.subject ?? ''}`;

  function clear(host: CaptureEngine, entry: Raised): void {
    raised.delete(keyOf(entry.warning));
    Promise.resolve()
      .then(() => host.clearCaptureWarning(entry.warning))
      .catch((err: unknown) => report({ source: 'capture.forwarder', code: ForwarderReportCode.CLEAR_FAILED, sessionId: entry.sessionId, correlationId: entry.correlationId, err }));
  }

  /** Clears what stayed cleared long enough; with `all`, everything (a new recording began). */
  function settle(host: CaptureEngine, all: boolean): void {
    const at = now();
    for (const entry of raised.values()) {
      if (all || (entry.clearedAt !== null && at - entry.clearedAt >= CAPTURE_WARNING_CLEAR_HOLD_MS)) clear(host, entry);
    }
  }

  const offTelemetry = capture.on('telemetry', (event) => {
    const host = engine();
    if (host === null) return;
    settle(host, false);
    const { levels, ingest, fragments } = event.frame;
    const ids = { sessionId: event.sessionId, correlationId: event.correlationId };
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
    if (host === null) return;
    const warning: CaptureWarningInput = { code: event.code, subject: event.subject };
    const known = raised.get(keyOf(warning));
    if (event.state === 'CLEARED') {
      // Not cleared yet: it has to stay cleared for the hold (the supervisor's own fault ends with a new recording, at once).
      if (known === undefined) return;
      if (event.source === 'supervisor') clear(host, known);
      else known.clearedAt = known.clearedAt ?? now();
      return;
    }
    if (known !== undefined) {
      // Still raised in the engine: a condition that came back inside the hold writes nothing.
      known.clearedAt = null;
      return;
    }
    raised.set(keyOf(warning), { warning, sessionId: event.sessionId, correlationId: event.correlationId, clearedAt: null });
    Promise.resolve()
      .then(() => host.raiseCaptureWarning(warning))
      .catch((err: unknown) => {
        // A warning is rare and each one matters: every failure is reported. What the engine did not raise is not ours to clear.
        raised.delete(keyOf(warning));
        report({ source: 'capture.forwarder', code: ForwarderReportCode.WARNING_FAILED, sessionId: event.sessionId, correlationId: event.correlationId, err });
      });
  });

  const offPhase = capture.on('phase', (event) => {
    if (event.phase !== 'RECORDING') return;
    const host = engine();
    if (host === null) return;
    // A recording (re)started: the faults of sessions before this one are over.
    for (const entry of raised.values()) if (entry.correlationId !== event.correlationId) clear(host, entry);
  });

  return () => {
    offTelemetry();
    offWarning();
    offPhase();
  };
}
