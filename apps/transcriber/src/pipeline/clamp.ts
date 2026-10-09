/**
 * THE PHANTOM-TAIL CLAMP (transcript spec §A.3 "Failure behaviour"; row 12 §4.1, §8.3; D10(d);
 * decision D-76-5; row 77 owns it).
 *
 * An engine can report a segment that reaches past the audio it was given. Measured on the oMLX
 * server: the sealed 65.72 s fixture answered with a last segment `65.54 .. 95.52` whose text
 * repeats the segment before it, with an ordinary `avg_logprob` and a near-zero `no_speech_prob`,
 * so a QA gate alone does not catch it. The rule, applied to every chunk before it is committed:
 *
 *   1. a segment that STARTS at or after the end of the audio is dropped;
 *   2. a segment that ENDS after the end of the audio ends at the end of the audio;
 *   3. the remainder of a segment clamped by rule 2 is dropped when its text repeats the text of
 *      the segment kept before it, or when its own QA members mark it as no speech;
 *   4. a segment with nothing left (no positive length in whole milliseconds) is dropped.
 *
 * The length of the audio is the length of the CHUNK the pipeline cut, counted in samples; the
 * `duration` member of an engine answer is never read (it is unreliable, row 12 §6).
 *
 * Engine times are floating-point seconds (`95.52000000000001`); the conversion to whole
 * milliseconds of media time rounds (`media-time.ts`). Pure: no file, no process, no clock.
 */
import type { TranscriptSegment } from '../types';
import { chunkSecondsToMediaMs, type AudioTimeline, type SampleRange } from './media-time';

/**
 * An end this close past the audio end is the engine's own time resolution, not a phantom: it is
 * clamped (rule 2) but rule 3 does not apply to it, so a speaker who really says the same short
 * sentence twice at the very end of a chunk keeps both. PROPOSAL (whisper time tokens step by 20 ms).
 */
export const CLAMP_ROUNDING_MS = 20;
/**
 * Rule 3 judges only a REMAINDER SHORTER THAN THIS: what is left of a segment inside the audio
 * after its end was clamped. The phantom tail of the stored engine answer leaves 181 ms; a short
 * answer really said twice at the end of a chunk ("Ya." … "ya") leaves seconds and is kept, however
 * far the engine's end overshoots (navigator finding N-5). PROPOSAL of the row-77 review fixes.
 */
export const CLAMP_MIN_REMAINDER_MS = 500;
/** Rule 3, QA half: whisper's own no-speech and log-probability gates. PROPOSALS. */
export const PHANTOM_NO_SPEECH_PROB = 0.6;
export const PHANTOM_AVG_LOGPROB = -1;

/** One committed segment: media time of the sealed file in whole milliseconds. QA members only where the engine gave them. */
export interface CommittedSegment {
  readonly startMs: number;
  readonly endMs: number;
  readonly text: string;
  readonly avgLogprob?: number;
  readonly noSpeechProb?: number;
  readonly compressionRatio?: number;
}

export const DropReason = {
  STARTS_PAST_AUDIO_END: 'STARTS_PAST_AUDIO_END',
  CLAMPED_TAIL_REPEATS_PREVIOUS: 'CLAMPED_TAIL_REPEATS_PREVIOUS',
  CLAMPED_TAIL_NO_SPEECH: 'CLAMPED_TAIL_NO_SPEECH',
  EMPTY: 'EMPTY',
} as const;
export type DropReason = (typeof DropReason)[keyof typeof DropReason];

export interface ClampResult {
  readonly segments: CommittedSegment[];
  /** How many segments were clamped by rule 2 and kept. */
  readonly clamped: number;
  readonly dropped: { readonly reason: DropReason; readonly index: number }[];
}

/** Text as compared by rule 3: case, white space and punctuation at the rims do not make a difference. */
export function comparableText(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, '');
}

/**
 * Applies the rule to the segments of ONE chunk. `chunk` is the range of source samples the chunk
 * was cut from; segment times are seconds from its first sample.
 */
export function clampSegments(segments: readonly TranscriptSegment[], timeline: AudioTimeline, chunk: SampleRange): ClampResult {
  const audioSeconds = (chunk.to - chunk.from) / timeline.sampleRateHz;
  const kept: CommittedSegment[] = [];
  const dropped: { reason: DropReason; index: number }[] = [];
  let clamped = 0;

  segments.forEach((segment, index) => {
    if (!(segment.start < audioSeconds)) {
      dropped.push({ reason: DropReason.STARTS_PAST_AUDIO_END, index });
      return;
    }
    const overshootMs = (segment.end - audioSeconds) * 1000;
    const end = overshootMs > 0 ? audioSeconds : segment.end;
    const remainderMs = (audioSeconds - segment.start) * 1000;
    if (overshootMs > CLAMP_ROUNDING_MS) {
      const previous = kept[kept.length - 1];
      // The text half judges only a short remainder (N-5); the QA half below is the engine's own verdict and stands for any length.
      if (remainderMs < CLAMP_MIN_REMAINDER_MS && previous !== undefined && comparableText(previous.text) === comparableText(segment.text)) {
        dropped.push({ reason: DropReason.CLAMPED_TAIL_REPEATS_PREVIOUS, index });
        return;
      }
      if ((segment.noSpeechProb ?? 0) > PHANTOM_NO_SPEECH_PROB && (segment.avgLogprob ?? 0) < PHANTOM_AVG_LOGPROB) {
        dropped.push({ reason: DropReason.CLAMPED_TAIL_NO_SPEECH, index });
        return;
      }
    }
    const startMs = chunkSecondsToMediaMs(timeline, chunk.from, segment.start);
    const endMs = Math.min(chunkSecondsToMediaMs(timeline, chunk.from, end), chunkSecondsToMediaMs(timeline, chunk.from, audioSeconds));
    if (!(endMs > startMs) || segment.text.trim() === '') {
      dropped.push({ reason: DropReason.EMPTY, index });
      return;
    }
    if (overshootMs > 0) clamped += 1;
    kept.push({
      startMs,
      endMs,
      text: segment.text.trim(),
      ...(segment.avgLogprob === undefined ? {} : { avgLogprob: segment.avgLogprob }),
      ...(segment.noSpeechProb === undefined ? {} : { noSpeechProb: segment.noSpeechProb }),
      ...(segment.compressionRatio === undefined ? {} : { compressionRatio: segment.compressionRatio }),
    });
  });
  return { segments: kept, clamped, dropped };
}
