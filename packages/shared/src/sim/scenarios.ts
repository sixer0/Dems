/**
 * Demo scenarios (masterplan/01_specs.md §14.7 `scenarios.ts`; Demo Control Panel C17).
 *
 * - `idle`: the dataset at `now` (default after login; Dashboard D1).
 * - `recording`: session 0024, case LP/{YYYY}/{MMDD}-0007, Ahmad Fauzi (Tersangka),
 *   AKP Budi Santoso, Interview Room 1, 00:18:42 in (as the SM mockup).
 * - `finalizing`: the same session, stopped 1.6 s ago; finalization step 1 is running.
 * - `fault-demo`: the same session still recording with Camera 2 lost, MIC 2 clipping and
 *   GNSS lost (time from NTP): non-critical faults never stop a recording (§6.4).
 *
 * Each scenario is built by running the real transitions (session machine, generator and
 * faults) from the idle baseline, so its audit chain, events, timeline and storage bytes
 * are exactly what a live run would have produced. The RNG streams are keyed by the seed
 * and the scenario name, so a scenario is deterministic (AC-51).
 */
import { SessionState } from '../domain';
import { advanceCaptureStart } from './capture-session';
import { CAPTURE_CONNECT_MS } from './constants';
import { caseNumberFor, operatorName, RECORDING_SCENARIO, recordingBytes } from './dataset';
import { deriveDeviceState } from './derive';
import { recordActivity } from './events';
import { injectFaultTransition } from './faults';
import { replayRecordingActivity } from './generator';
import { createIdleState } from './initial-state';
import { createRngStreams, deriveSeed, RngStream, type RngStreams } from './rng';
import {
  addMarkerTransition,
  addNoteTransition,
  addTimelineItem,
  beginPrecheckTransition,
  openSession,
  snapshotTransition,
  startRecordingTransition,
  stopRecordingTransition,
  tickMachine,
} from './session-machine';
import type { EpochMs, SimState } from './types';
import { AuthMethod, AuthStatus, ScenarioName } from './vocabulary';

export const SCENARIO_NAMES = Object.values(ScenarioName) as readonly ScenarioName[];

export function isScenarioName(value: unknown): value is ScenarioName {
  return typeof value === 'string' && (SCENARIO_NAMES as readonly string[]).includes(value);
}

/** RNG streams for building a scenario (independent of the engine's live streams). */
export function scenarioRng(seed: number, name: ScenarioName): RngStreams {
  return createRngStreams(deriveSeed(seed, `scenario:${name}`));
}

type Step = [at: EpochMs, apply: (state: SimState, at: EpochMs) => SimState];

/** Plays scripted steps in time order, with the recording integrity stream between them. */
function runScript(state: SimState, rng: RngStreams, from: EpochMs, to: EpochMs, steps: readonly Step[]): SimState {
  const events = rng.get(RngStream.EVENTS);
  let next = state;
  let cursor = from;
  for (const [at, apply] of [...steps].sort((a, b) => a[0] - b[0])) {
    next = replayRecordingActivity(next, cursor, at, events);
    next = apply(next, at);
    cursor = at;
  }
  return replayRecordingActivity(next, cursor, to, events);
}

/** Acts as the scenario's investigator (actor IDs on notes and markers); the caller restores auth. */
function asInvestigator(state: SimState, at: EpochMs): SimState {
  return {
    ...state,
    auth: {
      status: AuthStatus.SIGNED_IN,
      operatorId: RECORDING_SCENARIO.investigatorId,
      method: AuthMethod.PASSWORD,
      issuedAt: at,
      lastActivityAt: at,
    },
  };
}

/** The recording session from its sign-in to `until` (still RECORDING at `until`). */
function buildRecording(base: SimState, rng: RngStreams, until: EpochMs, extra: readonly Step[] = []): SimState {
  const now = base.clock.now;
  const startedAt = now - RECORDING_SCENARIO.elapsedMs;
  const createdAt = startedAt - 80_000;
  const actor = RECORDING_SCENARIO.investigatorId;
  let state = asInvestigator(base, createdAt - 120_000);
  state = {
    ...state,
    ...recordActivity(state, createdAt - 120_000, {
      audit: {
        type: 'AUTH_SUCCESS',
        message: `Operator signed in (${operatorName(actor)}) via password`,
        actorId: actor,
        details: { method: AuthMethod.PASSWORD },
      },
      event: {
        type: 'AUTH_LOGIN',
        message: `${operatorName(actor)} signed in`,
        severity: 'SUCCESS',
        params: { operatorId: actor, method: AuthMethod.PASSWORD },
      },
    }),
  };
  state = openSession(
    state,
    createdAt,
    {
      caseNumber: caseNumberFor(RECORDING_SCENARIO.caseSeq, createdAt),
      subjectType: RECORDING_SCENARIO.subjectType,
      subjectName: RECORDING_SCENARIO.subjectName,
      investigatorId: actor,
      room: RECORDING_SCENARIO.room,
      profileId: RECORDING_SCENARIO.profileId,
      notes: '',
    },
    actor,
  );
  state = beginPrecheckTransition(state, createdAt + 25_000, rng);
  state = tickMachine(state, createdAt + 35_000, rng);
  state = startRecordingTransition(state, startedAt);
  // A pre-built recording is past its start: the cameras connected (pass D10).
  state = advanceCaptureStart(state, startedAt + CAPTURE_CONNECT_MS);
  state = runScript(state, rng, startedAt, until, [
    [startedAt + 190_000, (s, at) => addNoteTransition(s, at, 'Subject identity and rights read and confirmed')],
    [startedAt + 465_000, (s, at) => addMarkerTransition(s, at, 'Key statement')],
    [
      startedAt + 680_000,
      (s, at) =>
        addTimelineItem(s, {
          at,
          kind: 'AUDIO_PEAK',
          label: 'Audio peak -3.1 dBFS',
          detail: 'MIC 2 – Subject',
          channel: 'AUDIO-02',
          params: { dbfs: -3.1, track: 'AUDIO-02' },
        }),
    ],
    [startedAt + 905_000, (s, at) => snapshotTransition(s, at)],
    ...extra,
  ]);
  // Bytes written so far (8.2 GB/h), added to the evidence volume.
  const session = state.session;
  if (session && session.state === SessionState.RECORDING && session.startedAt !== null) {
    const bytesWritten = recordingBytes(until - session.startedAt);
    state = {
      ...state,
      session: { ...session, bytesWritten },
      storage: {
        ...state.storage,
        volumes: state.storage.volumes.map((volume) =>
          volume.kind === 'EVIDENCE' ? { ...volume, usedBytes: volume.usedBytes + bytesWritten } : volume,
        ),
        lastWriteVerifiedAt: state.storage.lastWriteVerifiedAt ?? until,
      },
    };
  }
  return state;
}

/**
 * The starting state of scenario `name` built on the idle baseline `base` (whose
 * `clock.now` is the scenario's "now"). Auth stays as `base` has it.
 */
export function buildScenarioState(name: ScenarioName, base: SimState): SimState {
  if (name === ScenarioName.IDLE) return base;
  if (!isScenarioName(name)) throw new RangeError(`Unknown simulator scenario "${String(name)}".`);
  const now = base.clock.now;
  const rng = scenarioRng(base.meta.seed, name);
  let state: SimState;
  switch (name) {
    case ScenarioName.RECORDING:
      state = buildRecording(base, rng, now);
      break;
    case ScenarioName.FINALIZING: {
      const stopAt = now - 1_600;
      state = buildRecording(base, rng, stopAt);
      state = stopRecordingTransition(state, stopAt, 'Interview completed');
      state = tickMachine(state, now, rng);
      break;
    }
    case ScenarioName.FAULT_DEMO:
      state = buildRecording(base, rng, now, [
        [now - 95_000, (s, at) => injectFaultTransition(s, at, 'CAMERA_LOSS', { cameraId: 'VIDEO-02' })],
        [now - 60_000, (s, at) => injectFaultTransition(s, at, 'MIC_CLIP', { channel: 'AUDIO-02' })],
        [now - 40_000, (s, at) => injectFaultTransition(s, at, 'GNSS_LOSS')],
      ]);
      break;
    default:
      state = base;
  }
  return deriveDeviceState({ ...state, auth: base.auth, meta: { ...state.meta, scenario: name } });
}

/**
 * `loadScenario(name)` (the Demo Control Panel "Reset" and scenario picker): a fresh dataset at
 * `now` with the scenario applied. It keeps the signed-in operator, the lockout, the pairing,
 * the app-driven tablet link and the hydration epoch, then writes SCENARIO_LOADED.
 */
export function loadScenarioState(
  current: SimState,
  name: ScenarioName,
  now: EpochMs,
  options: { reset?: boolean } = {},
): SimState {
  if (!isScenarioName(name)) throw new RangeError(`Unknown simulator scenario "${String(name)}".`);
  const base = createIdleState({ now, seed: current.meta.seed, pairing: current.pairing.state, auth: current.auth });
  const built = buildScenarioState(name, base);
  const next = deriveDeviceState({
    ...built,
    meta: { ...built.meta, epoch: current.meta.epoch },
    authLockout: current.authLockout,
    pairing: current.pairing,
    tabletLink: current.tabletLink,
    // Console preferences survive a scenario load and a demo reset (step 54).
    settings: current.settings ?? built.settings,
  });
  return {
    ...next,
    ...recordActivity(next, now, {
      audit: {
        type: 'SCENARIO_LOADED',
        message: options.reset ? 'Demo reset (fresh dataset)' : `Demo scenario "${name}" loaded`,
        actorId: current.auth.status === AuthStatus.SIGNED_IN ? current.auth.operatorId : null,
        details: options.reset ? { scenario: name, reset: true } : { scenario: name },
      },
      event: {
        type: 'SCENARIO_LOADED',
        message: options.reset ? 'Demo reset' : `Demo scenario loaded · ${name}`,
        params: options.reset ? { scenario: name, reset: true } : { scenario: name },
      },
    }),
  };
}
