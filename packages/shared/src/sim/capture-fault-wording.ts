/**
 * THE ONE WORDING SOURCE OF A CAPTURE FAULT (fix pass F-M5, review R74-03; row 63 R63-03).
 *
 * A `CAPTURE_FAULT` / `MIC_SILENT` alert, and the advisory `SYSTEM` alerts of the capture side,
 * carry WHY in `params.reason`: a reason of the capture protocol's `WARNING` frame, the worker's
 * final crash code of a failed start, or a code the Core's capture session ended a capture with.
 * Until this file every one of them read "a recording file stopped growing" - false for a
 * microphone that stopped delivering, for a camera that never connected, for a camera clock.
 *
 * ONE SENTENCE PER REASON, TRUE FOR THAT REASON. `{{device}}` is the device as the reader names
 * it: the simulator's raise fills it with the device's name and id (`Camera 2 (CAM-02)`), a client
 * with its own device name. The English block `common.captureFault` of the i18n resources IS this
 * table (imported, not copied), so `t('common.captureFault.reason.MIC_DISCONNECTED', { device })`
 * and `captureFaultSentence('MIC_DISCONNECTED', device)` cannot say two things.
 *
 * AN UNKNOWN REASON gets the neutral sentence with its code - never a sentence about another
 * cause. A new reason of the protocol without a sentence here fails
 * `apps/core-server/src/capture/__tests__/fault-wording.test.ts`, which enumerates the protocol.
 *
 * This file imports nothing: it is read by the simulator, by the i18n resources and by the clients.
 */

/** How grave the condition of a reason is for the operator (ux §8e.2, §8g.3). */
export type CaptureReasonSeverity = 'CRITICAL' | 'WARNING' | 'INFO';

/** The sentence of every known reason. `{{device}}`: the device it is about. */
export const CAPTURE_FAULT_SENTENCES = {
  // ── Reasons of the capture protocol's WARNING frame (version 4) ──────────────────────────────
  /** `MIC_SILENT`: the microphone DELIVERS samples and they stayed at or below the silence threshold. */
  MIC_LEVEL_BELOW_THRESHOLD: '{{device}} is silent: its level stayed below the silence threshold. The recording continues.',
  /** No sample arrived from the microphone for the disconnect time. The session keeps recording (D163). */
  MIC_DISCONNECTED: '{{device}} stopped delivering audio. The recording continues without it.',
  /** Advisory: the rate controller of the microphone is held at its limit (D85). */
  MIC_RATE_AT_LIMIT: '{{device}} does not keep the sample rate it declares: the correction is at its limit. The recording continues.',
  /** A camera of the plan did not connect within the ingest-open window; another camera records (degraded start). */
  CAMERA_NOT_CONNECTED: '{{device}} did not connect. It is not being recorded.',
  // The three causes the worker names apart since task 4 row 182 (decision C30 (3), ruling C35; integration pass I-6).
  // Each is the worker's fixed word: no address and no path is part of a sentence (BR-04).
  /** Integrity (C35 (b)): a client reached the camera's listener and announced another address than the session's, or announced twice. Refused before any media was read. */
  CAMERA_ANNOUNCE_NOT_MATCHED: '{{device}} is not being recorded: a connection to its recording input did not announce the address of this session and was refused.',
  /** Integrity (C35 (b)): the worker saw no announce line at all (its media library no longer shows one), so it cannot tell whose push it was. Refused the same way. */
  CAMERA_ANNOUNCE_NOT_SEEN: '{{device}} is not being recorded: the capture worker could not read which address the connection to its recording input announced, and refused it.',
  /** A missing camera (C35 (a)): its own push passed the gate and brought no picture before it ended. No file exists for it. */
  CAMERA_NO_PICTURE: '{{device}} connected and sent no picture before its stream ended. It is not being recorded.',
  /** A camera that delivered video stopped delivering. */
  CAMERA_STREAM_ENDED: '{{device}} stopped delivering video. Its recording ended there.',
  /** The wall clock of the camera is beyond the bound against the Core. */
  CAMERA_CLOCK_OUT_OF_BOUND: 'The clock of {{device}} differs from the clock of the Core by more than the allowed bound.',
  /** Advisory (D127 (2)): the camera RECORDS; its keyframe interval is longer than the fragment target. */
  KEYFRAME_INTERVAL_ABOVE_BOUND: '{{device}} sends keyframes less often than the fragment target. It is recording; an interruption would lose more of its last seconds.',
  /** Advisory (D58-7): the camera clock is near, not beyond, the audio / video bound. */
  AV_OFFSET_NEAR_BOUND: 'The clock of {{device}} is close to the allowed audio / video bound. It is recording.',
  /** Advisory (fix pass F-M3): a fragment was closed by its size bound before its duration. */
  FRAGMENT_SIZE_BOUND_REACHED: 'The recording on {{device}} reached the fragment size limit; the fragment was closed early.',
  /**
   * Advisory (tidy pass F-Y; ruling D179): the clock of the camera is off the Core's by more than the
   * advisory threshold and inside the bound. Nothing is corrected. `{{offsetMs}}`: the size of the
   * measured offset in whole ms - filled by `cameraClockOffsetSentence`, or by a client that
   * translates this entry with `params.offsetMs` of the alert.
   */
  CAMERA_CLOCK_OFFSET: "Camera clock differs from the Core by {{offsetMs}} ms; the recording keeps the camera's own timeline and records the offset.",
  // ── Codes the capture of a session ends with ────────────────────────────────────────────────
  /** The worker's final crash code: no camera connected within the ingest-open window (D72(k)). */
  NO_CAMERA_CONNECTED: 'No camera connected. Nothing was recorded.',
  /** A failed start whose cause is no code. */
  CAPTURE_START_FAILED: 'The recording did not start: the capture could not be started. Nothing was recorded.',
  /** The session left RECORDING by another door while its capture ran: the worker was stopped. */
  SESSION_LEFT_RECORDING: 'The session stopped recording because of a fault. The capture was stopped.',
  /** A stop at which the worker did not end cleanly (a crash while closing, a non-zero exit, the kill at the grace). */
  CAPTURE_STOP_NOT_CLEAN: 'The capture did not stop cleanly. The recording is kept and sealed as interrupted.',
  /**
   * Task 4 row 48 (SA-3; rulings C34, C35 (b); integration pass I-6): the capture of a session was
   * ended because a camera did not count as open - the report of its relay and the connect report
   * of the capture worker did not pair, or contradicted each other. About the capture as a whole:
   * the camera and the closed reason are in the Core's error log, never in this sentence.
   */
  CAMERA_INGEST_NOT_PAIRED: 'The capture was stopped: the Core could not confirm that the stream it recorded came from the camera it had connected.',
  /**
   * Task 4 row 48 (ruling C34, fail-closed): `details.cause` of a start a Core in production capture
   * refuses (409 `SOURCE_KIND_NOT_RECORDABLE`) because nothing is set up to report that a camera's
   * relay reached the recorder. Nothing was started and nothing was recorded.
   */
  RELAY_REPORTS_NOT_WIRED: 'This Core is not set up to confirm which camera each recorded stream comes from. It does not record.',
  /**
   * The supervisor ended the worker because its telemetry named a device that is no device of the
   * session's plan (review R63-05; ruling D179; tidy pass F-Y: said by name, not as a bare crash).
   */
  TELEMETRY_SUBJECT_UNKNOWN: 'The capture was stopped: the capture worker reported a device that is not part of this session.',
  /** The supervisor ended the worker because it said it changed the microphone and the Core had commanded no change (R63-05). */
  SWITCH_NOT_COMMANDED: 'The capture was stopped: the capture worker changed the microphone without a command from the Core.',
  // ── The causes the Core's capture supervisor ends or refuses a capture with (`CaptureDownReason`; wave H, request of
  //    driver F; gate 64 C4, finding G75-05). About the capture as a whole: whether the recording was interrupted or
  //    nothing was recorded is the session's fact, said by the surface that shows the session, not by the cause. ─────
  SESSION_MISMATCH: 'The capture was stopped: the capture worker answered for another session than this one.',
  HELLO_TWICE: 'The capture was stopped: the capture worker introduced itself a second time.',
  HELLO_EXPECTED: 'The capture was stopped: the capture worker sent other messages before it introduced itself.',
  WARNING_SUBJECT_UNKNOWN: 'The capture was stopped: the capture worker raised a warning about a device that is not part of this session.',
  RECORD_BEFORE_START: 'The capture was stopped: the capture worker reported recorded media before the recording was started.',
  RECORD_SUBJECT_UNKNOWN: 'The capture was stopped: the capture worker reported recorded media for a device that is not part of this session.',
  RECORD_SEQUENCE_GAP: 'The capture was stopped: a record of the capture worker arrived out of sequence, so the Core cannot account for every fragment.',
  RECORD_AFTER_SEAL: 'The capture was stopped: the capture worker reported recorded media after it had reported its work complete.',
  RECORD_REPEATED: 'The capture was stopped: the capture worker reported a once-only fact of a camera a second time.',
  RECORD_RATE_EXCEEDED: 'The capture was stopped: the capture worker sent records faster than the allowed rate.',
  WORKER_FRAME_INVALID: 'The capture was stopped: the capture worker sent a message the Core could not read.',
  WORKER_SPAWN_FAILED: 'The capture worker program could not be started.',
  WORKER_NOT_CONFIGURED: 'No capture worker program is configured on this Core.',
  WORKER_HELLO_TIMEOUT: 'The capture worker did not answer after it was started.',
  WORKER_PROTOCOL_MISMATCH: 'The capture worker speaks another version of the capture protocol than this Core.',
  WORKER_PROOF_BUILD: 'The capture worker program is a test build. The Core does not record with it.',
  WORKER_VERSION_UNKNOWN: 'The capture worker program does not name a release version. The Core does not record with it.',
  WORKER_VERSION_MISMATCH: 'The capture worker program is another version than the one this Core was built to drive. The Core does not record with it.',
  WORKER_MEDIA_LIBRARY_MISMATCH: 'The capture worker found another media library on this host than the one it was verified with. It does not record.',
  WORKER_OUTPUT_EXISTS: 'The capture worker did not start: a recording file of this session already exists, and it is never overwritten.',
  WORKER_START_REFUSED: 'The capture worker refused to start the recording.',
  WORKER_START_TIMEOUT: 'The capture worker did not confirm the start of the recording in time.',
  WORKER_HEARTBEAT_TIMEOUT: 'The capture worker stopped responding and was ended by the Core.',
  WORKER_CRASHED: 'The capture worker reported a failure and ended.',
  WORKER_KILLED: 'The capture worker process was killed.',
  WORKER_EXIT_NONZERO: 'The capture worker process ended with an error.',
  WORKER_EXIT_UNEXPECTED: 'The capture worker process ended although nobody had stopped the recording.',
  WORKER_STOP_NOT_ACKNOWLEDGED: 'The capture worker ended without confirming the stop.',
  WORKER_TIMELINE_END_MISSING: 'The capture worker ended without closing the audio timeline.',
  STOP_TIMEOUT: 'The capture worker did not stop in time and was ended by the Core. The last seconds of the recording may be missing.',
  /**
   * The fault the DEMO control raised (operation 73 `inject CAPTURE_FAULT`; wave H, G75-09). The
   * simulator's session keeps recording: the sentence says who raised it and claims no interruption.
   */
  DEMO_CAPTURE_FAULT: 'The demo control raised a capture fault. The recording is not affected.',
  // ── A notice of the session's capture that is no fault ───────────────────────────────────────
  /**
   * The first durable fragment of a camera file was NOT synced through the drive cache (the worker's
   * `FIRST_DURABLE_FRAGMENT.syncLevel` is weaker than the full sync; decision D189). The session
   * keeps recording. CRITICAL where the sources are production's, advice in the development operation.
   */
  EVIDENCE_VOLUME_SYNC_NOT_FULL: 'The evidence volume does not confirm full durability; recordings may not survive a power loss.',
} as const;

export type CaptureFaultReason = keyof typeof CAPTURE_FAULT_SENTENCES;

/** A reason without a sentence: the code is shown, nothing is claimed about the cause. */
export const CAPTURE_FAULT_UNKNOWN_SENTENCES = {
  device: 'Capture reported a problem on {{device}} ({{reason}}).',
  capture: 'Capture reported a problem ({{reason}}).',
} as const;

/**
 * No reason at all. About a device: the neutral sentence. About the capture as a whole: the capture
 * ended while the session was recording - an INTERRUPTED recording (the supervisor's own fault; a
 * worker that crashed, exited or was ended at the grace), never worded as a stop.
 */
export const CAPTURE_FAULT_NO_REASON_SENTENCES = {
  device: 'Capture reported a problem on {{device}}.',
  capture: 'The capture stopped unexpectedly before the recording was ended. The recording was interrupted.',
} as const;

/** The reasons that are ADVICE, not a failed device: the subject keeps recording. Raised as a named `SYSTEM` alert, never as a fault. */
export const CAPTURE_ADVISORY_REASONS: readonly CaptureFaultReason[] = ['MIC_RATE_AT_LIMIT', 'KEYFRAME_INTERVAL_ABOVE_BOUND', 'AV_OFFSET_NEAR_BOUND', 'FRAGMENT_SIZE_BOUND_REACHED', 'CAMERA_CLOCK_OFFSET'];

/**
 * The severity the operator is shown a reason with (ux §8e.2 situation C, §8g.3): a degraded start
 * - one camera of two did not connect - is a WARNING naming the camera, never a critical fault.
 */
export const CAPTURE_REASON_SEVERITY: Readonly<Record<CaptureFaultReason, CaptureReasonSeverity>> = {
  MIC_LEVEL_BELOW_THRESHOLD: 'WARNING',
  MIC_DISCONNECTED: 'CRITICAL',
  MIC_RATE_AT_LIMIT: 'INFO',
  CAMERA_NOT_CONNECTED: 'WARNING',
  CAMERA_ANNOUNCE_NOT_MATCHED: 'CRITICAL',
  CAMERA_ANNOUNCE_NOT_SEEN: 'CRITICAL',
  CAMERA_NO_PICTURE: 'WARNING',
  CAMERA_STREAM_ENDED: 'CRITICAL',
  CAMERA_CLOCK_OUT_OF_BOUND: 'CRITICAL',
  KEYFRAME_INTERVAL_ABOVE_BOUND: 'INFO',
  AV_OFFSET_NEAR_BOUND: 'INFO',
  FRAGMENT_SIZE_BOUND_REACHED: 'INFO',
  CAMERA_CLOCK_OFFSET: 'INFO',
  NO_CAMERA_CONNECTED: 'CRITICAL',
  CAPTURE_START_FAILED: 'CRITICAL',
  SESSION_LEFT_RECORDING: 'CRITICAL',
  CAPTURE_STOP_NOT_CLEAN: 'CRITICAL',
  CAMERA_INGEST_NOT_PAIRED: 'CRITICAL',
  RELAY_REPORTS_NOT_WIRED: 'CRITICAL',
  TELEMETRY_SUBJECT_UNKNOWN: 'CRITICAL',
  SWITCH_NOT_COMMANDED: 'CRITICAL',
  SESSION_MISMATCH: 'CRITICAL',
  HELLO_TWICE: 'CRITICAL',
  HELLO_EXPECTED: 'CRITICAL',
  WARNING_SUBJECT_UNKNOWN: 'CRITICAL',
  RECORD_BEFORE_START: 'CRITICAL',
  RECORD_SUBJECT_UNKNOWN: 'CRITICAL',
  RECORD_SEQUENCE_GAP: 'CRITICAL',
  RECORD_AFTER_SEAL: 'CRITICAL',
  RECORD_REPEATED: 'CRITICAL',
  RECORD_RATE_EXCEEDED: 'CRITICAL',
  WORKER_FRAME_INVALID: 'CRITICAL',
  WORKER_SPAWN_FAILED: 'CRITICAL',
  WORKER_NOT_CONFIGURED: 'CRITICAL',
  WORKER_HELLO_TIMEOUT: 'CRITICAL',
  WORKER_PROTOCOL_MISMATCH: 'CRITICAL',
  WORKER_PROOF_BUILD: 'CRITICAL',
  WORKER_VERSION_UNKNOWN: 'CRITICAL',
  WORKER_VERSION_MISMATCH: 'CRITICAL',
  WORKER_MEDIA_LIBRARY_MISMATCH: 'CRITICAL',
  WORKER_OUTPUT_EXISTS: 'CRITICAL',
  WORKER_START_REFUSED: 'CRITICAL',
  WORKER_START_TIMEOUT: 'CRITICAL',
  WORKER_HEARTBEAT_TIMEOUT: 'CRITICAL',
  WORKER_CRASHED: 'CRITICAL',
  WORKER_KILLED: 'CRITICAL',
  WORKER_EXIT_NONZERO: 'CRITICAL',
  WORKER_EXIT_UNEXPECTED: 'CRITICAL',
  WORKER_STOP_NOT_ACKNOWLEDGED: 'CRITICAL',
  WORKER_TIMELINE_END_MISSING: 'CRITICAL',
  STOP_TIMEOUT: 'CRITICAL',
  DEMO_CAPTURE_FAULT: 'CRITICAL',
  // In the development operation the capture side raises it as advice (INFO): `critical: false` of the notice.
  EVIDENCE_VOLUME_SYNC_NOT_FULL: 'CRITICAL',
};

/** A reason code as an alert holds it: letters, digits and underscores. Anything else is not shown. */
const REASON_CODE = /^[A-Z][A-Z0-9_]{1,63}$/;

/** True when `reason` has its own sentence. */
export function isCaptureFaultReason(reason: unknown): reason is CaptureFaultReason {
  return typeof reason === 'string' && Object.prototype.hasOwnProperty.call(CAPTURE_FAULT_SENTENCES, reason);
}

const fill = (template: string, device: string, reason: string): string => template.replaceAll('{{device}}', device).replaceAll('{{reason}}', reason);

/** The clock-offset advice without its number: said when no whole number of ms is known. */
const CAMERA_CLOCK_OFFSET_NO_NUMBER = "Camera clock differs from the Core; the recording keeps the camera's own timeline and records the offset.";

/**
 * The sentence of the advisory `CAMERA_CLOCK_OFFSET` (tidy pass F-Y). `offsetMs`: the measured
 * offset, camera minus Core, in ms; the sentence says its SIZE (the sign is in the alert's params
 * and in the manifest). Anything that is no finite number reads without a number, never as a raw
 * placeholder.
 */
export function cameraClockOffsetSentence(offsetMs: number | null | undefined): string {
  if (typeof offsetMs !== 'number' || !Number.isFinite(offsetMs)) return CAMERA_CLOCK_OFFSET_NO_NUMBER;
  return CAPTURE_FAULT_SENTENCES.CAMERA_CLOCK_OFFSET.replaceAll('{{offsetMs}}', String(Math.abs(Math.round(offsetMs))));
}

/**
 * The sentence of a capture fault. `reason`: `params.reason` of the alert (null / absent: none).
 * `device`: the device as the reader names it, or null for the capture as a whole.
 * A reason that is no code reads as no reason: free text of another process is never shown.
 */
export function captureFaultSentence(reason: string | null | undefined, device: string | null): string {
  const name = device ?? '';
  if (isCaptureFaultReason(reason)) {
    // The one sentence with a number: without the number it reads without one (the caller that has it uses `cameraClockOffsetSentence`).
    if (reason === 'CAMERA_CLOCK_OFFSET') return CAMERA_CLOCK_OFFSET_NO_NUMBER;
    const sentence: string = CAPTURE_FAULT_SENTENCES[reason];
    // A sentence about a device, for a fault that names none: the neutral one with the code.
    if (device === null && sentence.includes('{{device}}')) return fill(CAPTURE_FAULT_UNKNOWN_SENTENCES.capture, name, reason);
    return fill(sentence, name, reason);
  }
  if (typeof reason === 'string' && REASON_CODE.test(reason)) return fill(device === null ? CAPTURE_FAULT_UNKNOWN_SENTENCES.capture : CAPTURE_FAULT_UNKNOWN_SENTENCES.device, name, reason);
  return fill(device === null ? CAPTURE_FAULT_NO_REASON_SENTENCES.capture : CAPTURE_FAULT_NO_REASON_SENTENCES.device, name, '');
}

// ── An INTERRUPTED SEAL (wave H, findings G75-03 / G75-08; ruling D197) ───────────────────────────

/** The reason the demo control's own capture fault carries (`injectFaultTransition`). Never a capture's. */
export const DEMO_CAPTURE_FAULT_REASON = 'DEMO_CAPTURE_FAULT' satisfies CaptureFaultReason;

/**
 * THE WORDS OF A SEALED RECORDING THAT WAS INTERRUPTED. Every session surface of every client names
 * it with `title` - never the plain sealed state - followed by the sentence of its cause
 * (`interruptedSealCauseSentence`) and `kept`. The English block `common.interruptedSeal` of the
 * i18n resources IS this table (imported, not copied).
 *
 * `{{kind}}`: the code of a fault that is no capture fault (the simulator's own critical faults).
 */
export const INTERRUPTED_SEAL_SENTENCES = {
  title: 'Sealed — recording was interrupted',
  /** The short form for a stamp. */
  short: 'Interrupted',
  /** The form for a status chip of a list row (the full `title` is its accessibility label). */
  chip: 'Sealed — interrupted',
  kept: 'The evidence holds the recording up to the interruption.',
  otherCause: 'The recording ended at a fault ({{kind}}) before it was stopped.',
  noCause: 'The recording ended before it was stopped.',
} as const;

/**
 * The cause sentence of an interrupted seal. `faultKind`: the fault that ended the recording, as
 * the custody entry `RECORDING_INTERRUPTED` of the item (or the `fault` of the session) holds it;
 * `reason`: the reason of the capture fault when one is known. A capture fault reads the capture's
 * own sentence (`captureFaultSentence`); another fault is named by its code; none claims no cause.
 */
export function interruptedSealCauseSentence(faultKind: string | null | undefined, reason: string | null = null): string {
  if (faultKind === 'CAPTURE_FAULT') return captureFaultSentence(reason, null);
  if (typeof faultKind === 'string' && REASON_CODE.test(faultKind)) return INTERRUPTED_SEAL_SENTENCES.otherCause.replaceAll('{{kind}}', faultKind);
  return INTERRUPTED_SEAL_SENTENCES.noCause;
}
