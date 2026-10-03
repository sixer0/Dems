/**
 * C-3 SessionTimeline maths (04_mobile_specs §4.0, §4.5 S1; 03_motion_spec M-C-08): ordering, time
 * labels at UTC+07:00 through the shared arithmetic formatter (no `Intl`, H-MB-08), insertion
 * detection and the insertion beat. Pure.
 */
import { formatClock } from '@dems/shared/realtime';
import type { StatusTone } from '@dems/shared/tokens';

export interface TimelineItem {
  id: string;
  /** ISO-8601 instant or epoch milliseconds. */
  at: string | number;
  title: string;
  detail?: string;
  tone?: StatusTone;
}

export type TimelineOrder = 'oldest-first' | 'newest-first';

/** 03M M-C-08 beats (ms from the insertion). */
export const INSERT_BEATS = {
  line: { delay: 0, duration: 320 },
  node: { delay: 180 },
  text: { delay: 240, duration: 240, rise: 8 },
  halo: { delay: 420, period: 1200, pulses: 2 },
} as const;

export function toEpochMs(at: string | number): number {
  if (typeof at === 'number') return at;
  const ms = Date.parse(at);
  return Number.isNaN(ms) ? 0 : ms;
}

/** Stable sort by time; ties keep their input order. */
export function orderTimeline(items: readonly TimelineItem[], order: TimelineOrder = 'oldest-first'): TimelineItem[] {
  const indexed = items.map((item, index) => ({ item, index, t: toEpochMs(item.at) }));
  indexed.sort((a, b) => (a.t === b.t ? a.index - b.index : order === 'oldest-first' ? a.t - b.t : b.t - a.t));
  return indexed.map((x) => x.item);
}

/** `HH:mm:ss` at the demo offset (UTC+07:00, D28/Q2). */
export function timelineTime(at: string | number): string {
  return formatClock(typeof at === 'number' ? new Date(at).toISOString() : at);
}

/** Id of the newest item, or null. */
export function newestId(items: readonly TimelineItem[]): string | null {
  let best: TimelineItem | null = null;
  for (const item of items) {
    if (best === null || toEpochMs(item.at) >= toEpochMs(best.at)) best = item;
  }
  return best ? best.id : null;
}

/** Items that were not present on first render: these play the insertion beat, the rest stagger in. */
export function isInsertion(initialIds: ReadonlySet<string>, id: string): boolean {
  return !initialIds.has(id);
}
