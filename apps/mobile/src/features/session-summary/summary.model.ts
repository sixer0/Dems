/**
 * Session Summary maths (04_mobile_specs §4.7; book §11.3 manifest fields, §19.1 lifecycle). Pure:
 * no React, no simulator instance. `use-summary.ts` reads the simulator and these functions shape
 * what the screen shows; the tests check them directly.
 */
import { EvidenceLifecycleStage, TrackId } from '@dems/shared/domain';
import type { EvidenceTrack } from '@dems/shared/sim';
import type { StepStatus } from '@/components/composed/stepper';

/** The four tracks in the order the book lists them (VIDEO-01/02, then AUDIO-01/02; SYS-003). */
export const TRACK_ORDER: readonly TrackId[] = [TrackId.VIDEO_01, TrackId.VIDEO_02, TrackId.AUDIO_01, TrackId.AUDIO_02];

/** Tracks sorted into `TRACK_ORDER`; unknown track IDs keep their order after the known ones. */
export function orderedTracks(tracks: readonly EvidenceTrack[]): EvidenceTrack[] {
  const rank = (id: string) => {
    const index = TRACK_ORDER.indexOf(id as TrackId);
    return index < 0 ? TRACK_ORDER.length : index;
  };
  return tracks
    .map((track, index) => ({ track, index }))
    .sort((a, b) => rank(a.track.trackId) - rank(b.track.trackId) || a.index - b.index)
    .map((entry) => entry.track);
}

/** `a1b2c3d4…e5f6a7b8`: a hash shortened for a row, both ends kept (the full value is one tap away). */
export function shortHash(hash: string | null | undefined, keep = 8): string {
  if (!hash) return '—';
  return hash.length <= keep * 2 + 1 ? hash : `${hash.slice(0, keep)}…${hash.slice(-keep)}`;
}

export interface SizeParts {
  unit: 'tb' | 'gb' | 'mb';
  value: string;
}

/** Decimal units, one decimal place, as the simulator counts storage (`common.units.<unit>`). */
export function sizeParts(bytes: number): SizeParts {
  const safe = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  if (safe >= 1e12) return { unit: 'tb', value: (safe / 1e12).toFixed(1) };
  if (safe >= 1e9) return { unit: 'gb', value: (safe / 1e9).toFixed(1) };
  return { unit: 'mb', value: (safe / 1e6).toFixed(1) };
}

/**
 * THE TIME SOURCE A SUMMARY CHIP REPEATS (wave H closing pass Z2; driver A's line of 10:20:55Z item 3,
 * ruling D203 (1)). `member`: `startTimeSource` / `endTimeSource` of the session's own history entry -
 * what the Core stated for THAT session; `ring`: the source the live `time` slice's ring held at that
 * instant, the fallback of an entry without the member (the step-80 rule); `hostClock`: the Core's
 * time is the host system clock (`isHostClockTime`).
 *
 * The member wins. On a host-clock Core the ring is never read (that Core keeps none, and a ring left
 * from before would be the dataset's GNSS), and an `RTC` member is the host clock (`host: true`: the
 * chip names it, neutral). Null: nothing is known, no chip.
 */
export function summaryTimeSource(input: { member: string | null | undefined; ring: string | null; hostClock: boolean }): { source: string; host: boolean } | null {
  const source = input.member ?? (input.hostClock ? null : input.ring);
  if (source === null || source === undefined) return null;
  return { source, host: input.hostClock && source === 'RTC' };
}

/** The twelve §19.1 lifecycle stages in order (C-4 horizontal). */
export const LIFECYCLE_STAGES: readonly EvidenceLifecycleStage[] = Object.values(EvidenceLifecycleStage);

/** Stages before the current one are done, the current one is active, later ones pending. */
export function lifecycleStatuses(stage: string | null): StepStatus[] {
  const index = stage === null ? -1 : LIFECYCLE_STAGES.indexOf(stage as EvidenceLifecycleStage);
  return LIFECYCLE_STAGES.map((_, i) => (index < 0 ? 'pending' : i < index ? 'done' : i === index ? 'active' : 'pending'));
}

/**
 * What the route shows for a session ID:
 * - `summary`: a finished session (SEALED or INCOMPLETE) found in the history;
 * - `finalizing`: the current session has that ID and is not finished yet (deep link during STOPPING
 *   or FINALIZING);
 * - `missing`: no such session.
 */
export type SummaryAvailability = 'summary' | 'finalizing' | 'missing';

export function summaryAvailability(inHistory: boolean, activeId: string | null, activeState: string | null, sessionId: string): SummaryAvailability {
  if (inHistory) return 'summary';
  if (activeId === sessionId && activeState !== null && activeState !== 'SEALED') return 'finalizing';
  return 'missing';
}
