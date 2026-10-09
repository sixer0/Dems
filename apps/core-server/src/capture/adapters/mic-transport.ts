/**
 * What a microphone transport promises, stated once (blueprint row 65; capture spec §A.7.1 rules
 * ML-3 and ML-4, §F erratum PE-128 "superseded in part"; decisions D58-6, D58-14, D72(j), D85 R-3).
 *
 * A microphone reaches the worker through a TRANSPORT that an `AudioInputAdapter` opens
 * (`AudioStreamHandle.input`); the plan builder copies it into the plan and never builds one by
 * hand. One transport exists: the named pipe of raw PCM that row 58 introduced for its fixtures
 * (D58-6). The development sources keep it (spec §A.7.1); a transport for a real USB or network
 * microphone is class C-4 and is not built.
 *
 * THE CLOCK STATEMENT. The worker places a microphone by ARRIVAL and passes every microphone
 * through its resampler continuously, asking it to stretch or squeeze by at most
 * `MIC_CLOCK_COMPENSATION_PPM` so that the microphone's clock follows the Core host's
 * (`apps/capture-worker/src/audio.c` `MIC_MAX_PPM`; a test holds this constant to that file).
 * The evidentiary audio is therefore resampled (D85); a source must not correct its own clock.
 *
 *   inside  +-5,000 ppm : followed. Measured by the row-58 pair: a 2,000 ppm slow microphone stays
 *                         within 5 ms; +-100 ppm within 1.5 ms.
 *   outside +-5,000 ppm : NOT followed, and (finding R-3) not reported. A source that is FAST
 *                         beyond the range becomes late by what the worker's buffer holds; a SLOW
 *                         one gets gaps.
 *
 * THE LATENESS BOUND, as it stands. Beyond the range the lateness of a fast source is bounded by
 * the worker's per-microphone buffer, `MIC_WORKER_BUFFER_CAP_MS` (two seconds today; the oldest
 * samples are dropped beyond it). D85 R-3 asks for that buffer to be held near the level the
 * controller keeps (`MIC_LATENESS_TARGET_MS`), not at two seconds, and for a telemetry mark when
 * the controller is pinned at its limit. Both are changes of the C worker
 * (`apps/capture-worker/src/audio.c`), which row 65 does not own: this file states the bound that
 * holds and the bound that is asked for, and `mic-transport.test.ts` holds the first to the
 * worker's source so that it cannot change unnoticed. Until the worker is changed a transport
 * must not be opened for a source whose clock is known to be outside the range.
 */
import { CaptureMicInputKind } from '@dems/capture-protocol';
import { CaptureAdapterError, CaptureAdapterRefusal } from './errors';
import { CAPTURE_AUDIO_CHANNELS, CAPTURE_AUDIO_SAMPLE_RATE_HZ } from '@dems/shared/api';

/** The clock difference, in parts per million either way, the worker compensates for a microphone. */
export const MIC_CLOCK_COMPENSATION_PPM = 5_000;
/** What the worker's per-microphone buffer holds at most: the lateness bound of a source beyond the range, as built. */
export const MIC_WORKER_BUFFER_CAP_MS = 2_000;
/** The lateness bound D85 R-3 asks of the worker for a source beyond the range. Not built (see the header). */
export const MIC_LATENESS_TARGET_MS = 100;

/** The promise of one transport kind. A value object: it holds no path and no device. */
export interface MicTransportStatement {
  readonly kind: CaptureMicInputKind;
  /** What the transport carries. */
  readonly sampleFormat: 'F32LE';
  readonly sampleRateHz: number;
  readonly channels: number;
  /** How the worker places the samples in time: by arrival, so the writer must not buffer (ML-4). */
  readonly placement: 'ARRIVAL';
  /** The clock range the worker follows, in parts per million either way. */
  readonly clockCompensationPpm: number;
  /** The lateness of a source that is fast beyond the range: bounded by this many milliseconds, as built. */
  readonly latenessBeyondRangeMs: number;
  /** True when the worker reports a source that left the range. False today (finding R-3). */
  readonly reportsOutOfRange: boolean;
}

/** The statement of each transport kind the protocol knows. A new kind does not compile without one. */
export const MIC_TRANSPORTS = Object.freeze({
  PCM_FIFO: Object.freeze({
    kind: CaptureMicInputKind.PCM_FIFO,
    sampleFormat: 'F32LE',
    sampleRateHz: CAPTURE_AUDIO_SAMPLE_RATE_HZ,
    channels: CAPTURE_AUDIO_CHANNELS,
    placement: 'ARRIVAL',
    clockCompensationPpm: MIC_CLOCK_COMPENSATION_PPM,
    latenessBeyondRangeMs: MIC_WORKER_BUFFER_CAP_MS,
    reportsOutOfRange: false,
  }),
} as const satisfies Record<CaptureMicInputKind, MicTransportStatement>);

export function micTransportOf(kind: CaptureMicInputKind): MicTransportStatement {
  return MIC_TRANSPORTS[kind];
}

/** True when a clock difference (parts per million, either sign) is one the worker follows. */
export function withinMicClockRange(ppm: number): boolean {
  return Number.isFinite(ppm) && Math.abs(ppm) <= MIC_CLOCK_COMPENSATION_PPM;
}

const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
const MIC_DEVICE_ID = /^MIC-[0-9]{2,}$/;

/**
 * Where the pipe of one microphone of one session lives: `<runDir>/<sessionId>/<deviceId>.pcm`
 * (spec §A.7.1 ML-2). Both IDs are held to their strict patterns BEFORE the path is built, so the
 * result cannot leave `runDir` (D86 SEC35-43). A pure function: it creates nothing.
 */
export function micPipePath(runDir: string, sessionId: string, deviceId: string): string {
  if (!runDir.startsWith('/') || runDir.includes('\0') || runDir.split('/').includes('..')) throw new CaptureAdapterError(CaptureAdapterRefusal.LOCATOR_INVALID);
  if (!SESSION_ID.test(sessionId) || sessionId.includes('..') || !MIC_DEVICE_ID.test(deviceId)) throw new CaptureAdapterError(CaptureAdapterRefusal.LOCATOR_INVALID);
  return `${runDir.replace(/\/+$/, '')}/${sessionId}/${deviceId}.pcm`;
}
