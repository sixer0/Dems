/**
 * Playback of the sealed camera files: the pure rules (blueprint row 92, M8-W3; UX spec flow 5;
 * R-3, R-4; capture spec §D.4, §E). No React, no clock, no request.
 *
 * | Export | Rule |
 * |--------|------|
 * | `bandSegments` | The audio-source band is a STATIC overlay of the item's intervals (media pts) over the recorded duration. It is never driven by a timer (flow 5 §6.7) |
 * | `segmentAt` | Which interval holds a playhead position |
 * | `needsResync` | The second camera file follows the first: beyond the tolerance it is set to the first one's time |
 * | `clampSeek` | A seek stays inside the recording |
 * | `fileIsDevelopment`, `intervalIsDevelopment` | The class of a source, from a VERIFY RESULT only (`sources` of operation 41); never from the current device list |
 * | `permissionGate` | G6 / G7: Checking, then allowed or refused |
 *
 * One whole file per camera, each carrying the single session audio track (R-4): the two players
 * share one timeline, and only the first one is audible.
 */
import type { ItemAudioInterval } from './item-v2';

/** Drift of the following player beyond this (seconds) re-aligns it to the leading one. */
export const PLAYER_SYNC_TOLERANCE_S = 0.25;

export interface BandSegment {
  readonly seq: number;
  readonly inputId: string;
  readonly fromMs: number;
  readonly toMs: number;
  /** Position and width as percent of the recorded duration, 0 to 100. */
  readonly startPct: number;
  readonly widthPct: number;
  readonly reason: ItemAudioInterval['reason'];
  /** 0 for the first microphone that appears, 1 for the second, …: the tone of the segment. */
  readonly tone: number;
}

const round = (value: number): number => Math.round(value * 1000) / 1000;

/** The recorded span the band covers: the item's duration, or the end of the last interval when that is longer. */
export function bandDurationMs(intervals: readonly ItemAudioInterval[], durationMs: number): number {
  const base = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0;
  return intervals.reduce((longest, interval) => Math.max(longest, interval.toMs ?? interval.fromMs), base);
}

/**
 * The segments of the band, in media order. An open interval (`toMs: null`) runs to the end of the
 * recording. A segment without width is dropped; every other one is clamped to the recording.
 */
export function bandSegments(intervals: readonly ItemAudioInterval[], durationMs: number): BandSegment[] {
  const total = bandDurationMs(intervals, durationMs);
  if (total <= 0) return [];
  const tones = new Map<string, number>();
  const ordered = [...intervals].sort((a, b) => (a.fromMs === b.fromMs ? a.seq - b.seq : a.fromMs - b.fromMs));
  const segments: BandSegment[] = [];
  for (const interval of ordered) {
    const fromMs = Math.min(Math.max(interval.fromMs, 0), total);
    const toMs = Math.min(Math.max(interval.toMs ?? total, fromMs), total);
    if (toMs <= fromMs) continue;
    if (!tones.has(interval.inputId)) tones.set(interval.inputId, tones.size);
    segments.push({
      seq: interval.seq,
      inputId: interval.inputId,
      fromMs,
      toMs,
      startPct: round((fromMs / total) * 100),
      widthPct: round(((toMs - fromMs) / total) * 100),
      reason: interval.reason,
      tone: tones.get(interval.inputId) ?? 0,
    });
  }
  return segments;
}

/** The segment that holds `positionMs` (its end is exclusive, except at the very end of the recording), or null. */
export function segmentAt(segments: readonly BandSegment[], positionMs: number): BandSegment | null {
  const last = segments[segments.length - 1];
  for (const segment of segments) {
    if (positionMs >= segment.fromMs && (positionMs < segment.toMs || (segment === last && positionMs === segment.toMs))) return segment;
  }
  return null;
}

/** The microphones of the band, in the order they first appear (the legend). */
export function bandInputs(segments: readonly BandSegment[]): { readonly inputId: string; readonly tone: number }[] {
  const seen = new Map<string, number>();
  for (const segment of segments) if (!seen.has(segment.inputId)) seen.set(segment.inputId, segment.tone);
  return [...seen.entries()].map(([inputId, tone]) => ({ inputId, tone }));
}

/** Whether the following player has drifted from the leading one beyond the tolerance. */
export function needsResync(leadingSeconds: number, followingSeconds: number, toleranceSeconds: number = PLAYER_SYNC_TOLERANCE_S): boolean {
  if (!Number.isFinite(leadingSeconds) || !Number.isFinite(followingSeconds)) return false;
  return Math.abs(leadingSeconds - followingSeconds) > toleranceSeconds;
}

/** A seek target inside the recording, in seconds. */
export function clampSeek(seconds: number, totalSeconds: number): number {
  if (!Number.isFinite(seconds)) return 0;
  return Math.min(Math.max(seconds, 0), Math.max(totalSeconds, 0));
}

/** `m:ss` or `h:mm:ss` of a media position. */
export function formatMediaTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`;
}

/** The source classes a verify result states (the `sources` block of operation 41, as the verify reader returns it). */
export interface VerifiedSources {
  readonly state: 'DEVELOPMENT' | 'DECLARED_PRODUCTION' | 'NOT_TRUSTWORTHY';
  readonly tracks: readonly { readonly trackId: string; readonly sourceClass: string }[];
  readonly audioIntervals: readonly { readonly seq: number; readonly micDeviceId: string; readonly sourceClass: string }[];
}

/** Whether a camera file was recorded from a development source, by a verify result; false when none says so. */
export function fileIsDevelopment(sources: VerifiedSources | null, trackId: string): boolean {
  if (sources === null || sources.state !== 'DEVELOPMENT') return false;
  const track = sources.tracks.find((entry) => entry.trackId === trackId);
  return track !== undefined && track.sourceClass !== 'PRODUCTION';
}

/** Whether an audio interval was recorded from a development microphone, by a verify result; false when none says so. */
export function intervalIsDevelopment(sources: VerifiedSources | null, seq: number): boolean {
  if (sources === null || sources.state !== 'DEVELOPMENT') return false;
  const interval = sources.audioIntervals.find((entry) => entry.seq === seq);
  return interval !== undefined && interval.sourceClass !== 'PRODUCTION';
}

export type GateState = 'CHECKING' | 'ALLOWED' | 'REFUSED';

/**
 * A gated control (G6 revise, G7 playback; UX §6.4, §7.4): "Checking your permissions..." until the
 * operator's role is known, then allowed or refused. The Core is the judge of the request itself.
 */
export function permissionGate(input: { readonly operatorKnown: boolean; readonly permitted: boolean }): GateState {
  if (!input.operatorKnown) return 'CHECKING';
  return input.permitted ? 'ALLOWED' : 'REFUSED';
}
