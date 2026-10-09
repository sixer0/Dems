/**
 * VAD CHUNKING (transcript spec §A.2): from the speech runs of a window of audio to the ordered
 * chunks the engine decodes. Pure: no file, no process, no clock.
 *
 *   - a chunk is one or more speech runs that follow each other, joined while the whole stays
 *     within `VAD_MAX_CHUNK_MS`; the silence between joined runs stays INSIDE the chunk, so a time
 *     the engine reports maps to the timeline with one addition;
 *   - a single run longer than the maximum (the VAD already splits at silences) is cut into
 *     windows that share `VAD_OVERLAP_MS`;
 *   - every boundary snaps OUTWARDS to the frame grid of the file (`media-time.ts`);
 *   - when the VAD gave no answer, the window is cut into fixed windows of the maximum length that
 *     share the same overlap (the `vad_fallback` path).
 *
 * WHILE THE AUDIO STILL GROWS (`final: false`) nothing is decided about what may still change: a
 * run that reaches into the last `VAD_TAIL_GUARD_MS` may go on, and the LAST chunk may still take
 * the next run. Both are left for the next pass, which starts at `nextCursor`. What IS returned is
 * written to the checkpoint before it is decoded and is never re-planned (§D.1).
 */
import { VAD_MAX_CHUNK_MS, VAD_OVERLAP_MS, VAD_TAIL_GUARD_MS } from './constants';
import { msToSamples, snapToGrid, type AudioTimeline, type SampleRange } from './media-time';
import type { SpeechSpan } from './silero-vad';

export interface ChunkPlanInput {
  readonly timeline: AudioTimeline;
  /** The window the VAD looked at, in source samples: `[from, to)`. `to` is everything that exists. */
  readonly window: SampleRange;
  /** The speech runs of the window (milliseconds from `window.from`), or null: the VAD gave no answer. */
  readonly spans: readonly SpeechSpan[] | null;
  /** True when no more audio will come. */
  readonly final: boolean;
}

export interface ChunkPlan {
  /** Closed chunks, in order, snapped, in source samples. */
  readonly chunks: readonly SampleRange[];
  /** Where the next pass starts. Equal to `window.to` when `final`. */
  readonly nextCursor: number;
}

function hardSplit(range: SampleRange, max: number, overlap: number): SampleRange[] {
  const pieces: SampleRange[] = [];
  let from = range.from;
  while (range.to - from > max) {
    pieces.push({ from, to: from + max });
    from = from + max - overlap;
  }
  pieces.push({ from, to: range.to });
  return pieces;
}

export function planChunks(input: ChunkPlanInput): ChunkPlan {
  const { timeline, window, final } = input;
  const max = msToSamples(timeline, VAD_MAX_CHUNK_MS);
  const overlap = msToSamples(timeline, VAD_OVERLAP_MS);
  const horizon = final ? window.to : Math.max(window.from, window.to - msToSamples(timeline, VAD_TAIL_GUARD_MS));
  const snap = (range: SampleRange): SampleRange => snapToGrid(timeline, range, window.to);
  const usable = (range: SampleRange): boolean => range.to > range.from;

  if (input.spans === null) {
    // Fixed windows. While the audio grows only FULL windows are closed.
    const pieces = hardSplit({ from: window.from, to: horizon }, max, overlap);
    const last = pieces[pieces.length - 1];
    if (final || last === undefined) return { chunks: pieces.filter(usable).map(snap).filter(usable), nextCursor: window.to };
    const closed = pieces.slice(0, -1);
    return { chunks: closed.map(snap).filter(usable), nextCursor: last.from };
  }

  const runs: SampleRange[] = [];
  let cutAtOpenRun: number | null = null;
  for (const span of input.spans) {
    const run = { from: window.from + msToSamples(timeline, span.fromMs), to: Math.min(window.to, window.from + msToSamples(timeline, span.toMs)) };
    if (!usable(run)) continue;
    if (run.to > horizon) {
      cutAtOpenRun = run.from;
      break;
    }
    runs.push(run);
  }

  const merged: SampleRange[] = [];
  for (const piece of runs.flatMap((run) => hardSplit(run, max, overlap))) {
    const current = merged[merged.length - 1];
    // Pieces of one split run overlap and are never joined again; runs that follow each other are.
    if (current !== undefined && piece.from >= current.to && piece.to - current.from <= max) merged[merged.length - 1] = { from: current.from, to: piece.to };
    else merged.push(piece);
  }

  if (final) return { chunks: merged.map(snap).filter(usable), nextCursor: window.to };
  const open = merged.pop();
  // The last chunk stays open; with no chunk at all, the pass resumes at the open run or skips the silence.
  const nextCursor = open?.from ?? cutAtOpenRun ?? horizon;
  return { chunks: merged.map(snap).filter(usable), nextCursor };
}
