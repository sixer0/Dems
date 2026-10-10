/**
 * The capture-checkpoint door of the engine host (task 3 wave H, closing pass Z1; driver A decision
 * 3, gate finding G75-01 "what the Monitor may show instead of invented integrity rows"), reached
 * beside the seam like the fact doors (`captureCheckpointDoorsOf(app.engine)`), and NOT a member of
 * `EngineHost`:
 *
 *   applyCaptureCheckpoints   what the Core HOLDS of a recording of its own capture while it runs:
 *                             the durable fragment checkpoints the capture worker reported - their
 *                             count and stored bytes by camera, and the Core clock at the newest
 *                             one. Called by `src/capture-session` (the one caller: it hears the
 *                             supervisor's `FRAGMENT_CHECKPOINT` records) at most every few
 *                             seconds and once when the capture ends. One unit with no actor, no
 *                             permission and no audit row: a measurement, not an act.
 *
 * NOTHING STORED IS TOUCHED. The member `captureCheckpoints` of the session payload has no column
 * (as `captureDurable` has none), so the write-through of the unit sends NO statement; the fragment
 * rows themselves are `recording_fragments`, written by the recording-fragments unit. A session read
 * back after a restart carries no such member until its capture reports again: absent means "not
 * stated", never 0.
 *
 * WHAT THE TRANSITION REFUSES TO SAY. Figures for another session than the open one, for a session
 * that is not a recording of the Core's own capture (it carries no `captureDurable` member: a
 * simulator's recording), figures that are no whole counts, and figures that go BACKWARDS (a late
 * call never lowers a count the session already states). A call that changes nothing returns the
 * SAME state and sends no statement.
 */
import type { SessionCaptureCheckpoints, SimState } from '@dems/shared/sim';
import { EngineError } from './errors';
import type { EngineHost, EngineOutcome } from './types';

/** What the capture session hands in: the figures of one camera file. */
export interface CaptureCheckpointCamera {
  readonly deviceId: string;
  /** Checkpoints the worker reported durable for this camera's file. */
  readonly fragments: number;
  /** Stored bytes of the file those checkpoints cover (the end of the newest fragment's byte range). */
  readonly bytes: number;
}

export interface CaptureCheckpointFacts {
  /** The Core clock when the newest checkpoint was heard. */
  readonly lastAt: number;
  readonly cameras: readonly CaptureCheckpointCamera[];
}

export interface EngineCaptureCheckpointDoors {
  applyCaptureCheckpoints(sessionId: string, facts: CaptureCheckpointFacts): Promise<EngineOutcome<boolean>>;
}

/** Label of the unit (a label of the host is `engine.<what it does>`). */
export const CAPTURE_CHECKPOINT_DOOR_LABEL = { applied: 'engine.applyCaptureCheckpoints' } as const;

const whole = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

/** The member as the session payload carries it, or null for figures that state nothing or are no counts. */
export function captureCheckpointsOf(facts: CaptureCheckpointFacts): SessionCaptureCheckpoints | null {
  if (facts === null || typeof facts !== 'object' || !whole(facts.lastAt) || !Array.isArray(facts.cameras)) return null;
  const cameras: SessionCaptureCheckpoints['cameras'] = [];
  const seen = new Set<string>();
  for (const camera of facts.cameras) {
    if (typeof camera?.deviceId !== 'string' || camera.deviceId.length === 0 || seen.has(camera.deviceId) || !whole(camera.fragments) || !whole(camera.bytes)) return null;
    seen.add(camera.deviceId);
    // A camera without a checkpoint states nothing: it is not listed with a 0.
    if (camera.fragments > 0) cameras.push({ deviceId: camera.deviceId, fragments: camera.fragments, bytes: camera.bytes });
  }
  if (cameras.length === 0) return null;
  cameras.sort((a, b) => (a.deviceId < b.deviceId ? -1 : a.deviceId > b.deviceId ? 1 : 0));
  return {
    fragments: cameras.reduce((sum, camera) => sum + camera.fragments, 0),
    bytes: cameras.reduce((sum, camera) => sum + camera.bytes, 0),
    lastAt: facts.lastAt,
    cameras,
  };
}

/** The pure transition (the header says what it refuses to say). */
export function applyCaptureCheckpointsTransition(state: SimState, sessionId: string, facts: CaptureCheckpointFacts): SimState {
  const session = state.session;
  if (session === null || session.id !== sessionId || typeof session.captureDurable !== 'boolean') return state;
  const next = captureCheckpointsOf(facts);
  if (next === null) return state;
  const held = session.captureCheckpoints;
  if (held !== undefined) {
    if (next.fragments < held.fragments || next.lastAt < held.lastAt) return state;
    if (JSON.stringify(held) === JSON.stringify(next)) return state;
  }
  return { ...state, session: { ...session, captureCheckpoints: next } };
}

/** Throws `ENGINE_ACTION_NOT_HOSTED` for an engine a test put behind the seam that has no such door. */
export function captureCheckpointDoorsOf(engine: EngineHost): EngineCaptureCheckpointDoors {
  const doors = engine as EngineHost & Partial<EngineCaptureCheckpointDoors>;
  if (typeof doors.applyCaptureCheckpoints !== 'function') {
    throw new EngineError('ENGINE_ACTION_NOT_HOSTED', 'the engine behind the seam is not the host of src/engine: it has no capture-checkpoint door');
  }
  return doors as EngineHost & EngineCaptureCheckpointDoors;
}
