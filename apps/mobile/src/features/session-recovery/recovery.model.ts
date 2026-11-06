/**
 * Recovery Status maths (04_mobile_specs §4.8; book §6.4 item 5, §18.1; 03_motion_spec M-C-09, P7).
 * Pure: no React, no simulator instance. `use-recovery.ts` reads the simulator into the flat
 * `RecoveryInputs`, `sim-adapter.ts` bridges what the simulator does not model (SIM-GAP-M81-*), and
 * the screen turns these values into the Alert, the C-4 pipeline, the track rows and the outcome.
 *
 * The simulator's recovery is 3 s on its clock: RECOVERY_SCAN for 1.5 s, then
 * INCOMPLETE_SESSION_ANALYSIS for 1.5 s, then the session is kept INCOMPLETE (never sealed, SYS-008)
 * and the active session clears. The pipeline paces its five checks inside those two stages
 * (`RECOVERY_MILESTONES_MS`, SIM-GAP-M81-3), so the Stepper animates with the simulator's own timing.
 */
import type { AudioTrackId, SessionState, TimeSource, VideoTrackId } from '@dems/shared/domain';
import { RECOVERY_MS, RECOVERY_SCAN_MS, type FaultKind, type SessionOutcome } from '@dems/shared/sim';
import type { StepStatus } from '@/components/composed/stepper';

// ---------------------------------------------------------------------------------------------
// Phase
// ---------------------------------------------------------------------------------------------

/**
 * What the screen shows:
 * - `fault`: FAULT, waiting for "Start recovery";
 * - `analysing`: RECOVERY, the 3 s analysis on the simulator clock;
 * - `complete`: the session this screen followed has left the store and its history entry exists;
 * - `other`: a session in any other state (a deep link while recording, for example);
 * - `idle`: no session and nothing followed here.
 */
export type RecoveryPhase = 'fault' | 'analysing' | 'complete' | 'other' | 'idle';

export function recoveryPhase(liveState: SessionState | null, followedId: string | null, outcomeKnown: boolean): RecoveryPhase {
  if (liveState === 'FAULT') return 'fault';
  if (liveState === 'RECOVERY') return 'analysing';
  if (liveState !== null) return 'other';
  return followedId !== null && outcomeKnown ? 'complete' : 'idle';
}

/**
 * Fix wave L (G75d-08): THE CORE IS SEALING THE INTERRUPTED PREFIX BY ITSELF - known from the session
 * payload alone, so the screen says that instead of offering "Start recovery".
 *
 * | Member of the session | What it says |
 * |---|---|
 * | `state: 'FAULT'`, `fault.fromState: 'RECORDING'`, `startedAt` set | a recording was interrupted |
 * | `captureDurable: true` | the Core ran ITS OWN capture for this session and holds durable media of it. The member exists only on a Core in its own capture (the simulator's session has none); `false` is a failed start (nothing was recorded) |
 *
 * A Core in its own capture hands EVERY interrupted recording with durable media to its seal
 * (capture architecture: "durable media is always handed over"): the session goes FAULT ->
 * FINALIZING -> SEALED without an operator. So with all of the above the true statement is "the Core
 * is sealing the recording up to the interruption", and the recovery prompt ("Recovery closes the
 * session as incomplete. It never seals it.") would be false. False for every other session: the
 * simulator's fault, a failed start, a fault before the recording started.
 */
/* The caller adds "this is a Core server in its own capture" (`realCaptureSources`): the simulator's session may carry the member too. */
export function coreSealsInterruptedPrefix(session: { readonly state?: string | null; readonly startedAt?: number | null; readonly fault?: { readonly fromState?: string | null } | null; readonly captureDurable?: unknown } | null | undefined): boolean {
  if (session === null || session === undefined) return false;
  return session.state === 'FAULT' && session.fault?.fromState === 'RECORDING' && session.startedAt !== null && session.startedAt !== undefined && session.captureDurable === true;
}

/** Back is consumed with a toast while the analysis runs (like Finalization, 04 §3.6). */
export function isRecoveryBusy(phase: RecoveryPhase): boolean {
  return phase === 'analysing';
}

// ---------------------------------------------------------------------------------------------
// Pipeline (C-4 Stepper, vertical)
// ---------------------------------------------------------------------------------------------

export const RECOVERY_STEPS = ['scan', 'tracks', 'segment', 'time', 'analysis'] as const;
export type RecoveryStepKey = (typeof RECOVERY_STEPS)[number];

/** The §18.1 stage each pipeline step belongs to. */
export const STEP_STAGE: Readonly<Record<RecoveryStepKey, 'RECOVERY_SCAN' | 'INCOMPLETE_SESSION_ANALYSIS'>> = {
  scan: 'RECOVERY_SCAN',
  tracks: 'RECOVERY_SCAN',
  segment: 'INCOMPLETE_SESSION_ANALYSIS',
  time: 'INCOMPLETE_SESSION_ANALYSIS',
  analysis: 'INCOMPLETE_SESSION_ANALYSIS',
};

/** The §4.2 tracks in display order (D61, 2026-11-04: the eight sealed files — four video tracks and four microphone channels; mirrors `EVIDENCE_FILE_TRACKS`). */
export const RECOVERY_TRACKS = ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'AUDIO-01', 'AUDIO-02', 'AUDIO-03', 'AUDIO-04'] as const satisfies readonly (VideoTrackId | AudioTrackId)[];
export type RecoveryTrackId = (typeof RECOVERY_TRACKS)[number];

/**
 * Milestones on the simulator clock, ms after `recover()` (SIM-GAP-M81-3): the scan closes at 0.5 s,
 * the eight tracks (D61, 2026-11-04) resolve 0.25 s apart from 0.75 s to 2.5 s, then the time source
 * (2.75 s) and the analysis itself at RECOVERY_MS (3.0 s).
 */
export const RECOVERY_MILESTONES_MS: readonly number[] = [
  500,
  750,
  1_000,
  1_250,
  RECOVERY_SCAN_MS,
  1_750,
  2_000,
  2_250,
  2_500,
  2_750,
  RECOVERY_MS,
];
export const MILESTONE_COUNT = RECOVERY_MILESTONES_MS.length;

/** Milestone index at which each step is finished (index into the passed-milestone count). */
const STEP_DONE_AT: Readonly<Record<RecoveryStepKey, number>> = { scan: 1, tracks: 9, segment: 9, time: 10, analysis: 11 };
/** Milestones passed when each track is resolved (D61, 2026-11-04: eight tracks). */
const TRACK_DONE_AT: Readonly<Record<RecoveryTrackId, number>> = { 'VIDEO-01': 2, 'VIDEO-02': 3, 'VIDEO-03': 4, 'VIDEO-04': 5, 'AUDIO-01': 6, 'AUDIO-02': 7, 'AUDIO-03': 8, 'AUDIO-04': 9 };

export interface RecoveryProgressInput {
  stage: 'RECOVERY_SCAN' | 'INCOMPLETE_SESSION_ANALYSIS';
  startedAt: number;
  completesAt: number;
}

/**
 * How many milestones have passed at simulator time `now` (0 … 11). Never behind the simulator's own
 * stage: once it reports INCOMPLETE_SESSION_ANALYSIS, every RECOVERY_SCAN milestone counts as passed.
 * A primitive, so a `useSim` selector over it re-renders 11 times in 3 s, not per tick.
 */
export function recoveryMilestone(recovery: RecoveryProgressInput | null, now: number): number {
  if (!recovery) return 0;
  const elapsed = Math.max(0, now - recovery.startedAt);
  let passed = RECOVERY_MILESTONES_MS.filter((at) => elapsed >= at).length;
  if (recovery.stage === 'INCOMPLETE_SESSION_ANALYSIS') passed = Math.max(passed, STEP_DONE_AT.tracks);
  if (now >= recovery.completesAt) passed = MILESTONE_COUNT;
  return Math.min(passed, MILESTONE_COUNT);
}

/** The §18.1 stage shown in the status line for a milestone count. */
export function stageFor(milestone: number): 'RECOVERY_SCAN' | 'INCOMPLETE_SESSION_ANALYSIS' {
  return milestone >= STEP_DONE_AT.tracks ? 'INCOMPLETE_SESSION_ANALYSIS' : 'RECOVERY_SCAN';
}

export function trackResolved(track: RecoveryTrackId, milestone: number): boolean {
  return milestone >= TRACK_DONE_AT[track];
}

/** The track being checked right now (Spinner), or null. */
export function trackChecking(track: RecoveryTrackId, milestone: number, phase: RecoveryPhase): boolean {
  if (phase !== 'analysing' || trackResolved(track, milestone)) return false;
  const before = RECOVERY_TRACKS[RECOVERY_TRACKS.indexOf(track) - 1];
  const firstStart = STEP_DONE_AT.scan;
  return before === undefined ? milestone >= firstStart : trackResolved(before, milestone);
}

/**
 * Stepper statuses. FAULT: every step waits. RECOVERY: finished steps are `done` (or `warn` when
 * their finding needs attention: a track gap or flag, a time-source fallback), the current one is
 * `running` (Spinner), later ones wait. Complete: every step finished. A warning gets the Stepper's
 * one halo pulse and then holds its amber colour (03M P7, R8).
 */
export function pipelineStatuses(phase: RecoveryPhase, milestone: number, findings: PipelineFindings): StepStatus[] {
  const passed = phase === 'complete' ? MILESTONE_COUNT : phase === 'analysing' ? milestone : 0;
  let runningAssigned = phase !== 'analysing';
  return RECOVERY_STEPS.map((key) => {
    if (passed >= STEP_DONE_AT[key]) return findings[key] ? 'warn' : 'done';
    if (!runningAssigned) {
      runningAssigned = true;
      return 'running';
    }
    return 'pending';
  });
}

/** Which finished steps carry a finding that needs attention. */
export type PipelineFindings = Readonly<Record<RecoveryStepKey, boolean>>;

// ---------------------------------------------------------------------------------------------
// Analysis (derived from the simulator state at the interruption; SIM-GAP-M81-3)
// ---------------------------------------------------------------------------------------------

export type TrackIntegrity = 'intact' | 'gap' | 'degraded' | 'noMedia';

export interface TrackFinding {
  readonly track: RecoveryTrackId;
  readonly integrity: TrackIntegrity;
  /** When the gap or the flag began (the fault's `since`), else null. */
  readonly since: number | null;
}

/** One active fault flag, as `faults.active` holds it. */
export interface ActiveFaultFlag {
  readonly kind: FaultKind;
  readonly since: number;
  readonly target: string | null;
}

/**
 * Per-track integrity from the fault flags active at the interruption (book §6.4 item 3: a lost
 * source is never silent). A camera loss or a MIC with no signal leaves a GAP from the fault's
 * start; a clipping MIC is FLAGGED (recorded, with clipped segments marked); everything else is
 * INTACT up to the interruption. Before recording started there is NO MEDIA. Flags raised after
 * the interruption do not count.
 */
export function trackFindings(recorded: boolean, faultAt: number | null, flags: readonly ActiveFaultFlag[]): TrackFinding[] {
  return RECOVERY_TRACKS.map((track) => {
    if (!recorded) return { track, integrity: 'noMedia', since: null };
    const relevant = flags.filter((flag) => flag.target === track && (faultAt === null || flag.since <= faultAt));
    const lost = relevant.find((flag) => flag.kind === 'CAMERA_LOSS' || flag.kind === 'MIC_NO_SIGNAL');
    if (lost) return { track, integrity: 'gap', since: lost.since };
    const clipped = relevant.find((flag) => flag.kind === 'MIC_CLIP');
    if (clipped) return { track, integrity: 'degraded', since: clipped.since };
    return { track, integrity: 'intact', since: null };
  });
}

export function trackIssueCount(findings: readonly TrackFinding[]): number {
  return findings.filter((finding) => finding.integrity === 'gap' || finding.integrity === 'degraded').length;
}

export type SegmentBasis = 'autosave' | 'start';

export interface SegmentFinding {
  /** End of the last committed segment, or null when nothing was recorded. */
  readonly endsAt: number | null;
  readonly basis: SegmentBasis | null;
  /** Media length up to that end, ms (0 without media). */
  readonly lengthMs: number;
}

/**
 * The last good segment: the newest AUTOSAVE on the session timeline at or before the interruption
 * (the simulator autosaves at most once a minute), else the recording start.
 */
export function segmentFinding(startedAt: number | null, lastAutosaveAt: number | null): SegmentFinding {
  if (startedAt === null) return { endsAt: null, basis: null, lengthMs: 0 };
  if (lastAutosaveAt !== null && lastAutosaveAt >= startedAt) {
    return { endsAt: lastAutosaveAt, basis: 'autosave', lengthMs: lastAutosaveAt - startedAt };
  }
  return { endsAt: startedAt, basis: 'start', lengthMs: 0 };
}

export interface TimeFinding {
  /** The source at the start of the analysed window (GNSS unless it was already lost). */
  readonly from: TimeSource;
  /** The fallback source, or null when the start source held throughout. */
  readonly to: TimeSource | null;
  /** When the fallback began, or null. */
  readonly at: number | null;
}

/**
 * Time-source continuity over the session: a GNSS_LOSS flag raised before the interruption means
 * the Core fell back to NTP (or the RTC, its `target`); otherwise GNSS held throughout. The window
 * is continuous either way (the Core never stops its clock), so a fallback is a finding to note,
 * not a failure.
 */
export function timeFinding(faultAt: number | null, flags: readonly ActiveFaultFlag[]): TimeFinding {
  const loss = flags.find((flag) => flag.kind === 'GNSS_LOSS' && (faultAt === null || flag.since <= faultAt));
  if (!loss) return { from: 'GNSS', to: null, at: null };
  const to: TimeSource = loss.target === 'RTC' ? 'RTC' : 'NTP';
  return { from: 'GNSS', to, at: loss.since };
}

export function findingsFor(tracks: readonly TrackFinding[], time: TimeFinding): PipelineFindings {
  return { scan: false, tracks: trackIssueCount(tracks) > 0, segment: false, time: time.to !== null, analysis: false };
}

// ---------------------------------------------------------------------------------------------
// Outcome
// ---------------------------------------------------------------------------------------------

export type RecoveryOutcomeKind = 'incomplete' | 'recovered';

/** Simulator outcome → screen outcome (`recovered` only through SIM-GAP-M81-1). */
export function outcomeKind(outcome: SessionOutcome | null): RecoveryOutcomeKind | null {
  if (outcome === 'INCOMPLETE') return 'incomplete';
  if (outcome === 'SEALED') return 'recovered';
  return null;
}

/** The mini GlowRing's state (03M §7): critical while faulted, attention while recovering and for an incomplete outcome, ready once recovered or acknowledged. */
export function ringStateFor(phase: RecoveryPhase, outcome: RecoveryOutcomeKind | null, acknowledged: boolean): 'critical' | 'attention' | 'ready' {
  if (acknowledged || outcome === 'recovered') return 'ready';
  if (phase === 'fault') return 'critical';
  return 'attention';
}

/** How long the ring takes to settle on READY after Acknowledge before Home opens (its 600 ms colour morph). */
export const ACK_SETTLE_MS = 600;

/** Whether the Acknowledge beat is over at simulator time `now`. */
export function ackSettled(acknowledgedAt: number | null, now: number): boolean {
  return acknowledgedAt !== null && now - acknowledgedAt >= ACK_SETTLE_MS;
}

// ---------------------------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------------------------

export interface SizeParts {
  /** The `common.units.*` key. */
  unit: 'tb' | 'gb' | 'mb';
  value: string;
}

/** Decimal units, one decimal place, as the simulator counts storage. */
export function sizeParts(bytes: number): SizeParts {
  const safe = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
  if (safe >= 1e12) return { unit: 'tb', value: (safe / 1e12).toFixed(1) };
  if (safe >= 1e9) return { unit: 'gb', value: (safe / 1e9).toFixed(1) };
  return { unit: 'mb', value: (safe / 1e6).toFixed(1) };
}

/** `a1b2c3d4…e5f6a7b8`: shortened for a row, both ends kept (the full value stays selectable). */
export function shortValue(value: string | null | undefined, keep = 8): string {
  if (!value) return '—';
  return value.length <= keep * 2 + 1 ? value : `${value.slice(0, keep)}…${value.slice(-keep)}`;
}
