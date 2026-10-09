/**
 * FILE time of the audio source intervals (spec §B.12 "Media-time origin", erratum PE-128-68,
 * decision D81).
 *
 * `audio.sourceIntervals[].fromMs` / `toMs` (fields 58-59) count in FILE (media) time of the
 * sealed file, the origin of the fragment fields 66-67. File time 0 = T0 - 1024/48000 s, so a
 * value measured from T0 (the host instant of audio sample 0) is converted by ADDING the origin:
 *
 *   file time of tap sample n = (n + CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES) / 48000 s
 *
 * The manifest holds whole milliseconds; this helper takes the millisecond that contains the
 * sample (floor). It uses the one shared constant and no other.
 */
import { CAPTURE_AUDIO_SAMPLE_RATE_HZ, CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES } from '../api/capture';

/** FILE-time milliseconds of sample `n` of the PCM tap (n counts from T0). */
export function fileTimeMsOfTapSample(sample: number): number {
  if (!Number.isSafeInteger(sample) || sample < 0) throw new RangeError('sample is a whole number >= 0');
  return Math.floor(((sample + CAPTURE_MEDIA_TIME_ORIGIN_SAMPLES) * 1000) / CAPTURE_AUDIO_SAMPLE_RATE_HZ);
}
