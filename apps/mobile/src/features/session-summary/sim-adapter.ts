/**
 * Local simulator adapter of the Session Summary (P6 / P12: screen steps never edit
 * `packages/shared/src/sim`; a missing selector is logged as a SIM-GAP and bridged here).
 *
 * **SIM-GAP-M80-1: no time source per session instant.** 04_mobile_specs §4.7 shows Start and End
 * "each with its time-source badge 'GNSS' (S29)". `SessionHistoryEntry` and `EvidenceItem` keep the
 * instants but not the trusted time source that stamped them, and the live `time.source` may have
 * changed since (a GNSS loss falls back to NTP or RTC). The simulator does keep a ring of time
 * samples (`time.history`: one point every 10 s, 120 points, each with its `source`), so this
 * adapter reads the source of the newest sample at or before the instant. An instant older than
 * the ring (or before the first sample after a reload) gets `null`, and the screen shows no badge
 * rather than guess.
 *
 * Proposed closure for the simulator owner (step 91): record `startTimeSource` and `endTimeSource`
 * on `SessionHistoryEntry` (or on `EvidenceItem`) when the session starts and stops, and export a
 * selector for them. Swapping this file for it changes no screen.
 */
import type { TimeSource } from '@dems/shared/domain';
import type { TimeHistoryPoint } from '@dems/shared/sim';

export function timeSourceAt(history: readonly TimeHistoryPoint[], at: number | null): TimeSource | null {
  if (at === null || !Number.isFinite(at)) return null;
  let best: TimeHistoryPoint | null = null;
  for (const point of history) {
    if (point.at <= at && (best === null || point.at >= best.at)) best = point;
  }
  return best?.source ?? null;
}
