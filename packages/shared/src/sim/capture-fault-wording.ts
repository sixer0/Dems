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
   * The supervisor ended the worker because its telemetry named a device that is no device of the
   * session's plan (review R63-05; ruling D179; tidy pass F-Y: said by name, not as a bare crash).
   */
  TELEMETRY_SUBJECT_UNKNOWN: 'The capture was stopped: the capture worker reported a device that is not part of this session.',
  /** The supervisor ended the worker because it said it changed the microphone and the Core had commanded no change (R63-05). */
  SWITCH_NOT_COMMANDED: 'The capture was stopped: the capture worker changed the microphone without a command from the Core.',
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
  TELEMETRY_SUBJECT_UNKNOWN: 'CRITICAL',
  SWITCH_NOT_COMMANDED: 'CRITICAL',
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
