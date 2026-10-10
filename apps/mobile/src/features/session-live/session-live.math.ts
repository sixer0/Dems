/**
 * Session Monitor maths (04_mobile_specs §4.5; 03_motion_spec M-C-05, M-C-17, M-C-18, M-C-19).
 * Pure, React-free and simulator-free, so the rules are tested directly (T-M08 covers the screen).
 *
 * - Layout: which §2.4 arrangement a layout class gets.
 * - Timer: whole seconds since the recording started, on the simulator clock (S4).
 * - Status strip (S2b): the §5.4 book elements MB 4 omits, as label, value and tone.
 * - Timeline rows (C-3 items) from the simulator's timeline events.
 * - End Session: the S21 reason rule, the hold timing and its haptic beats.
 */
import type { StatusTone } from '@dems/shared/tokens';
import { STOP_REASON_MIN_LENGTH } from '@dems/shared/sim';

// ---------------------------------------------------------------------------------------------
// Layout (04 §2.4 row "Session Monitor")
// ---------------------------------------------------------------------------------------------

export type MonitorLayoutClass = 'compact' | 'compact-landscape' | 'medium' | 'expanded';

/**
 * - `stack` (compact, MB 4): REC row, feed 16:9, MIC cards 2-up, 4 tiles, End Session.
 * - `split` (compact-landscape): feed left (height-bound) | timer, meters, 2x2 actions, End Session.
 * - `tablet-portrait` (medium): feed full width, then meters | status + timeline; End Session pinned.
 * - `tablet-landscape` (expanded): feed 58% | timer + meters + status | timeline + actions.
 */
export type MonitorArrangement = 'stack' | 'split' | 'tablet-portrait' | 'tablet-landscape';

export function monitorArrangement(layoutClass: MonitorLayoutClass): MonitorArrangement {
  switch (layoutClass) {
    case 'compact-landscape':
      return 'split';
    case 'medium':
      return 'tablet-portrait';
    case 'expanded':
      return 'tablet-landscape';
    case 'compact':
    default:
      return 'stack';
  }
}

/** Header heights by arrangement (04 §2.3: condensed 48 dp on a landscape phone, else 64 dp). */
export const MONITOR_HEADER_DP = { condensed: 48, regular: 64 } as const;

export interface MonitorColumnWidths {
  /** Feed column width in dp (0 = full width, the stacked arrangements). */
  readonly feed: number;
  /** Each side column in the three-column tablet arrangement, dp. */
  readonly side: number;
}

/**
 * Column widths for the side-by-side arrangements, from the safe window (dp):
 * - `split` (phone landscape): the feed is height-bound 16:9 (04 §2.4), capped at 58% of the width,
 *   so the controls column keeps at least 42%. Padding 8 dp each side, 12 dp gap, 48 dp header.
 * - `tablet-landscape`: 58% | 21% | 21% of the width left after 12 dp padding and two 12 dp gaps.
 */
export function monitorColumnWidths(arrangement: MonitorArrangement, safe: { width: number; height: number }): MonitorColumnWidths {
  if (arrangement === 'split') {
    const innerW = Math.max(0, safe.width - 2 * 8 - 12);
    const innerH = Math.max(0, safe.height - MONITOR_HEADER_DP.condensed - 2 * 8);
    return { feed: Math.floor(Math.min(innerW * 0.58, (innerH * 16) / 9)), side: 0 };
  }
  if (arrangement === 'tablet-landscape') {
    const innerW = Math.max(0, safe.width - 2 * 12 - 2 * 12);
    return { feed: Math.floor(innerW * 0.58), side: Math.floor(innerW * 0.21) };
  }
  return { feed: 0, side: 0 };
}

/** Tablet arrangements show the timeline inline; phones open it from the History icon (S1). */
export function showsInlineTimeline(arrangement: MonitorArrangement): boolean {
  return arrangement === 'tablet-portrait' || arrangement === 'tablet-landscape';
}

/** Tablets switch cameras with kit Tabs; phones tap the feed (S3). */
export function usesCameraTabs(arrangement: MonitorArrangement): boolean {
  return arrangement === 'tablet-portrait' || arrangement === 'tablet-landscape';
}

// ---------------------------------------------------------------------------------------------
// Timer (S2; S4: clock-derived, so it survives a reconnect or relaunch without resetting)
// ---------------------------------------------------------------------------------------------

// The timer's maths moved to the runtime with the recording time itself (post-review fix FXR-M, W93-1):
// `runtime/recording-elapsed.ts` is the one rule. Re-exported here for the feature's tests.
export { SECOND_TICK_MARGIN_MS, SECOND_TICK_MIN_MS, elapsedSecondsAt, msToNextSecond } from '@/runtime';

// ---------------------------------------------------------------------------------------------
// Camera identity
// ---------------------------------------------------------------------------------------------

/** `VIDEO-01` → 1, `VIDEO-02` → 2 (the CameraFeed framing reads the same trailing digit). */
export function cameraIndexOf(cameraId: string): 1 | 2 {
  return /2\s*$/.test(cameraId) ? 2 : 1;
}

/** The other camera of the pair (phone tap-to-switch). */
export function otherCameraId(cameraId: string, cameraIds: readonly string[]): string {
  const other = cameraIds.find((id) => id !== cameraId);
  return other ?? cameraId;
}

// ---------------------------------------------------------------------------------------------
// Status strip (S2b)
// ---------------------------------------------------------------------------------------------

export type TrackRecState = 'REC' | 'DEGRADED' | 'LOST';
export type StorageStateName = 'READY' | 'LOW' | 'FULL';
export type TimeSourceName = 'GNSS' | 'NTP' | 'RTC';

export interface StripTrackInput {
  index: 1 | 2;
  online: boolean;
  recState: TrackRecState | null;
  /** Row 139: the Core named this camera as not connected at the session start. */
  notConnected?: boolean;
}

export interface StripInput {
  cameras: readonly StripTrackInput[];
  /** Row 139 (D84): RECORDING before the first durable fragment. Absent: the recording is durable. */
  connecting?: boolean;
  storage: StorageStateName;
  timeSource: TimeSourceName;
  timeLocked: boolean;
  /**
   * Wave H closing pass Z2 (ruling D203 (1); `isHostClockTime`): the Core's `time` slice says the host
   * system clock. It is that Core's ONLY time, not a fallback: no warning tone, never "locked".
   */
  hostClock?: boolean;
}

/** One chip of the strip; `value` is a key into the shared enum labels (the screen translates it). */
export type StripChip =
  | { kind: 'video'; id: string; index: 1 | 2; value: TrackRecState | 'OFFLINE' | 'CONNECTING'; tone: StatusTone }
  | { kind: 'storage'; id: 'storage'; value: StorageStateName; tone: StatusTone }
  | { kind: 'time'; id: 'time'; value: TimeSourceName; locked: boolean; host: boolean; tone: StatusTone };

const TRACK_TONE: Record<TrackRecState, StatusTone> = { REC: 'success', DEGRADED: 'warning', LOST: 'danger' };
const STORAGE_TONE: Record<StorageStateName, StatusTone> = { READY: 'success', LOW: 'warning', FULL: 'danger' };
const TIME_TONE: Record<TimeSourceName, StatusTone> = { GNSS: 'success', NTP: 'info', RTC: 'warning' };

/**
 * The strip in book order: VIDEO 1, VIDEO 2, STORAGE, TIME (research 01 §5.4; the MIC rows are the
 * meter cards). The track's own state wins (REC, DEGRADED, LOST: the simulator derives LOST from a
 * camera loss); without one, an online camera reads REC (the monitor opens only during RECORDING)
 * and an offline one OFFLINE. An unlocked clock keeps its source and turns amber.
 */
export function statusStrip(input: StripInput): StripChip[] {
  const chips: StripChip[] = input.cameras.map((camera) => {
    // Row 139 (ux §8e.2; D84): a camera the session start named as not connected is OFFLINE whatever its
    // track state says; and before the first durable fragment no camera reads REC - it is CONNECTING.
    const value: TrackRecState | 'OFFLINE' | 'CONNECTING' =
      camera.notConnected === true ? 'OFFLINE' : input.connecting === true ? 'CONNECTING' : (camera.recState ?? (camera.online ? 'REC' : 'OFFLINE'));
    return {
      kind: 'video' as const,
      id: `video-${camera.index}`,
      index: camera.index,
      value,
      tone: value === 'OFFLINE' ? 'danger' : value === 'CONNECTING' ? 'info' : TRACK_TONE[value],
    };
  });
  chips.push({ kind: 'storage', id: 'storage', value: input.storage, tone: STORAGE_TONE[input.storage] });
  const host = input.hostClock === true;
  chips.push({
    kind: 'time',
    id: 'time',
    value: input.timeSource,
    locked: host ? false : input.timeLocked,
    host,
    tone: host ? 'info' : input.timeLocked ? TIME_TONE[input.timeSource] : 'warning',
  });
  return chips;
}

// ---------------------------------------------------------------------------------------------
// Timeline (C-3 items from the simulator's timeline, S1)
// ---------------------------------------------------------------------------------------------

// Mirrors the shared `TimelineKind`. SH-03/WB-10 (row 47) added AUDIO_SWITCH (the operator switched
// the active mic input, op 81); the client's exhaustive KIND_TONE below must carry it too.
export type TimelineKindName = 'START' | 'NOTE' | 'AUDIO_PEAK' | 'AUDIO_SWITCH' | 'HEALTH' | 'AUTOSAVE' | 'CHECK' | 'MARKER' | 'SNAPSHOT' | 'FAULT';

export interface TimelineEventInput {
  id: string;
  at: number;
  kind: TimelineKindName;
  label: string;
  detail: string | null;
}

export interface MonitorTimelineItem {
  id: string;
  at: number;
  kind: TimelineKindName;
  detail?: string;
  tone: StatusTone;
}

const KIND_TONE: Record<TimelineKindName, StatusTone> = {
  START: 'success',
  NOTE: 'accent',
  AUDIO_PEAK: 'warning',
  // A mic-input switch is a neutral operator action (op 81); informational tone, like SNAPSHOT.
  AUDIO_SWITCH: 'info',
  HEALTH: 'success',
  AUTOSAVE: 'success',
  CHECK: 'success',
  MARKER: 'accent',
  SNAPSHOT: 'info',
  FAULT: 'danger',
};

/**
 * The row title is the shared kind label (`session.timeline.kind.*`, translated by the screen);
 * the simulator's own label and detail become the row detail ("Key statement", "Snapshot 2 ·
 * Camera 1"). At most `limit` newest events are kept (the sheet and the pane are not archives).
 */
export function timelineItems(events: readonly TimelineEventInput[], limit = 50): MonitorTimelineItem[] {
  const slice = events.length > limit ? events.slice(events.length - limit) : events;
  return slice.map((event) => {
    const parts = [event.label, event.detail].filter((part): part is string => typeof part === 'string' && part.trim().length > 0);
    const detail = parts.join(' · ');
    return {
      id: event.id,
      at: event.at,
      kind: event.kind,
      ...(detail ? { detail } : {}),
      tone: KIND_TONE[event.kind] ?? 'default',
    };
  });
}

/**
 * THE TIMELINE OF A RECORDING OF THE CORE'S OWN CAPTURE (fix wave H driver A; finding G75-01, gate
 * 81 G81-04: the tablet showed "Evidence Auto-Save - Autosave segment 1" and "System Check -
 * Integrity check passed" beside a real recording; rulings D197, D199).
 *
 * Three kinds of rows are written only by the simulator's generator (`@dems/shared/sim`
 * `generator.ts`): AUTOSAVE, HEALTH, and the CHECK "Integrity check passed". Beside a real recording
 * each would be a claim nobody measured. The generator no longer runs there; this is the second
 * guard on the surface itself, for a session whose stored timeline still holds such a row (written
 * before the fix, or by a Core that does not have it).
 *
 * A CHECK the seal side wrote (`params.source: 'TAIL_VALIDATION'`, the recovery of an interrupted
 * recording) is a fact of the Core and stays. `ownCapture` is the rule of the state
 * (`captureFactsOf`): the session carries the member `captureDurable`. A session of the
 * simulator's own capture keeps every row.
 *
 * Fix wave I (re-gate 75, NOTE G75b-08): `connecting` = the session is RECORDING and the Core has not
 * reported its first durable fragment (`selectConnectingCameras`). The Core writes the START row when
 * the start is ACCEPTED; the surface says "Recording Started" only once the Core says it records, so
 * the row is held back while the screen reads "Connecting cameras…". It appears, with the Core's own
 * instant, with the first durable fragment.
 */
export function timelineOfCaptureFacts<Event extends { kind: string; params?: Readonly<Record<string, unknown>> | null }>(events: readonly Event[], ownCapture: boolean, connecting = false): readonly Event[] {
  if (!ownCapture && !connecting) return events;
  const kept = events.filter(
    (event) =>
      !(connecting && event.kind === 'START') &&
      (!ownCapture || (event.kind !== 'AUTOSAVE' && event.kind !== 'HEALTH' && (event.kind !== 'CHECK' || event.params?.source === 'TAIL_VALIDATION'))),
  );
  return kept.length === events.length ? events : kept;
}

/** Unseen timeline events for the History badge (phone): events added since the sheet was last opened. */
export function unseenCount(total: number, seenAtOpen: number): number {
  return Math.max(0, total - Math.max(0, seenAtOpen));
}

// ---------------------------------------------------------------------------------------------
// Markers (S5 Bookmark → addMarker, M-C-17)
// ---------------------------------------------------------------------------------------------

/** The simulator keeps 80 characters of a marker label (D61 input limits). */
export const MARKER_LABEL_MAX = 80;
/** M-C-17: the chip flies on the `gentle` spring in about 520 ms. */
export const MARKER_FLIGHT_MS = 520;

/** The label passed to `addMarker`: trimmed, capped, or `undefined` for the numbered default. */
export function markerLabel(input: string): string | undefined {
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed.slice(0, MARKER_LABEL_MAX) : undefined;
}

// ---------------------------------------------------------------------------------------------
// Snapshot (M-C-18)
// ---------------------------------------------------------------------------------------------

/** One white shutter flash: 0 → 0.85 → 0 in 180 ms (P8: a single flash). */
export const SHUTTER_MS = 180;
export const SHUTTER_PEAK = 0.85;

// ---------------------------------------------------------------------------------------------
// End Session (S6, M-C-19, S21)
// ---------------------------------------------------------------------------------------------

/** The fill runs `scaleX 0 → 1` over 1,500 ms, linear. */
export const HOLD_TO_CONFIRM_MS = 1500;
/** Light haptics at 0 % and 50 % of the hold; heavy at 100 % (`endSessionHold`). */
export const HOLD_HAPTIC_BEATS_MS = [0, HOLD_TO_CONFIRM_MS / 2] as const;
/** The shared minimum (S21), 5 characters after trimming. */
export const STOP_REASON_MIN = STOP_REASON_MIN_LENGTH;
/** A UI cap on the typed reason (the Core API sets no maximum; the audit row keeps it whole). */
export const STOP_REASON_MAX = 500;

export interface ReasonCheck {
  /** The trimmed reason `stopRecording` receives. */
  readonly value: string;
  readonly valid: boolean;
  /** Characters counted by the rule (trimmed). */
  readonly length: number;
}

/** S21: at least 5 characters after trimming (the simulator enforces the same rule). */
export function checkStopReason(input: string): ReasonCheck {
  const value = input.trim().slice(0, STOP_REASON_MAX);
  return { value, valid: value.length >= STOP_REASON_MIN, length: value.length };
}

/** Where a released hold ends: completed holds stay full until the dialog opens; early releases spring back. */
export function holdOutcome(heldMs: number): 'complete' | 'released-early' {
  return heldMs >= HOLD_TO_CONFIRM_MS ? 'complete' : 'released-early';
}
