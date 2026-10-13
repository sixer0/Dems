// The selector in force: which capture sources a reader names once a session is sealed and the
// selector changes afterwards. Home file of these cases (suite consolidation, 2026-10-11); the
// finding and fix ids stay in the titles.
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SessionState } from '../src/domain';
import {
  activeMeterChannel,
  audioPairInForce,
  audioPairOfSelector,
  audioSourceAtStart,
  audioSourceIntervalsOf,
  cameraLinesInForce,
  camerasNotConnecting,
  captureMicLines,
  captureReachabilityOf,
  createIdleState,
  DEFAULT_SEED,
  FaultKind,
  isSessionActive,
  meterInputOfChannel,
  micLinesInForce,
  openSessionAudioSource,
  openSessionSnapshot,
  selectorInForce,
  selectorOfSession,
  sessionIsOpen,
  type SimState,
} from '../src/sim';

// Fix wave L, closing pass L-Z - the selector-snapshot defect in the SHARED readers (cause of G70c-01;
// decision 1 of implementation/155): `captureMicLines`, the capture notices' `selectorOf` and
// `sessionCameras` preferred the selector snapshot of the session in the `session` slice also when
// that session was SEALED - and the slice keeps the last session after its seal.
//
// Rule (ONE helper, `src/sim/selector-in-force.ts`): a session's snapshot names the sources only
// while that session is OPEN; otherwise the current selector.
//
// The order held here is the one of the defect: a session is SEALED with MIC-01 / MIC-02 and
// CAM-01 / CAM-02, THEN the selector is changed. The control of every case is the same state with
// the session still OPEN (the snapshot is the truth then, OD-10).
const idle = (): SimState => createIdleState({ now: 1_791_636_968_000, seed: DEFAULT_SEED });
type Session = NonNullable<SimState['session']>;
/**
 * The session recorded with CAM-01 / CAM-02 and MIC-01 / MIC-02 (its snapshot). AFTER it the selector
 * was changed: `CAM-05` on VIDEO-02, and the first microphone line is `MIC-04` now.
 */
function afterSelectorChange(sessionState: Session['state'] | null): SimState {
  const base = idle();
  const snapshot = { cameras: base.captureConfig.cameras, mics: base.captureConfig.mics, revision: 2, updatedAt: base.captureConfig.updatedAt };
  const camera = base.captureDevices.devices.find((device) => device.kind === 'CAMERA')!;
  const mic = base.captureDevices.devices.find((device) => device.kind === 'MIC')!;
  const changed = {
    ...base.captureConfig,
    cameras: base.captureConfig.cameras.map((line) => (line.trackId === 'VIDEO-02' ? { ...line, deviceId: 'CAM-05' } : line)),
    mics: base.captureConfig.mics.map((line, index) => (index === 0 ? { ...line, inputId: 'MIC-04', deviceId: 'MIC-04' } : line)),
    updatedAt: base.captureConfig.updatedAt + 60_000,
  };
  const session = sessionState === null ? null : ({ id: 'SES-20261011-0043', state: sessionState, startedAt: 1, captureConfig: snapshot } as unknown as Session);
  return {
    ...base,
    captureConfig: changed as SimState['captureConfig'],
    captureDevices: {
      ...base.captureDevices,
      // CAM-05 is registered and NOT reachable; MIC-04 is registered and reachable.
      devices: [...base.captureDevices.devices, { ...camera, id: 'CAM-05', online: false } as typeof camera, { ...mic, id: 'MIC-04', online: true } as typeof mic],
    },
    session,
  };
}

describe('the ONE shared helper (L-Z item 1)', () => {
  it('OPEN = a session whose state is stated and is not SEALED; it agrees with `isSessionActive` for every state of the machine', () => {
    for (const state of Object.values(SessionState)) {
      expect(sessionIsOpen({ state })).toBe(state !== SessionState.SEALED);
      expect(sessionIsOpen({ state })).toBe(isSessionActive({ state } as unknown as Session));
    }
    expect(sessionIsOpen(null)).toBe(false);
    expect(sessionIsOpen(undefined)).toBe(false);
    expect(isSessionActive(null)).toBe(false);
    // A holder that states no state is not known to be open: its snapshot is not taken as the selector.
    expect(sessionIsOpen({})).toBe(false);
  });

  it('a SEALED session\'s snapshot is not the selector; an OPEN session\'s is (control); no session: the selector', () => {
    const sealed = afterSelectorChange(SessionState.SEALED);
    // The slice still HOLDS the snapshot - that is the state the defect needs.
    expect(sealed.session?.captureConfig?.cameras.find((line) => line.trackId === 'VIDEO-02')?.deviceId).toBe('CAM-02');
    expect(openSessionSnapshot(sealed.session)).toBeNull();
    expect(selectorInForce(sealed)).toBe(sealed.captureConfig);
    expect(selectorOfSession(sealed.session, sealed.captureConfig)).toBe(sealed.captureConfig);
    expect(cameraLinesInForce(sealed).find((line) => line.trackId === 'VIDEO-02')?.deviceId).toBe('CAM-05');
    expect(micLinesInForce(sealed)[0]?.inputId).toBe('MIC-04');

    const open = afterSelectorChange(SessionState.RECORDING);
    expect(selectorInForce(open)).toBe(open.session?.captureConfig);
    expect(cameraLinesInForce(open).find((line) => line.trackId === 'VIDEO-02')?.deviceId).toBe('CAM-02');
    expect(micLinesInForce(open)[0]?.inputId).toBe('MIC-01');

    const none = afterSelectorChange(null);
    expect(selectorInForce(none)).toBe(none.captureConfig);
  });
});

describe('the shared readers, sealed session THEN the selector changed (L-Z item 1)', () => {
  it('`captureMicLines` (meters, health, the API read, `useAudioChannel`) names the lines of the current selector', () => {
    const sealed = afterSelectorChange(SessionState.SEALED);
    expect(captureMicLines(sealed).map((line) => line.inputId)).toEqual(['MIC-04', 'MIC-02']);
    // What `useAudioChannel('AUDIO-01')` subscribes to: the frame of the input that channel is NOW.
    expect(meterInputOfChannel(captureMicLines(sealed), 'AUDIO-01')).toBe('MIC-04');
    // CONTROL: the same state with the session still open keeps the session's lines.
    const open = afterSelectorChange(SessionState.RECORDING);
    expect(captureMicLines(open).map((line) => line.inputId)).toEqual(['MIC-01', 'MIC-02']);
    expect(meterInputOfChannel(captureMicLines(open), 'AUDIO-01')).toBe('MIC-01');
  });

  it('`activeMeterChannel`: the active input is looked up among the lines in force', () => {
    const sealed = { ...afterSelectorChange(SessionState.SEALED) };
    const withActive = { ...sealed, audio: { ...sealed.audio, activeInputId: 'MIC-02' as const } };
    expect(activeMeterChannel(withActive)).toBe('AUDIO-02');
    // MIC-01 left the pair with the change: it is no line any more, so the answer is the fallback channel 1
    // (before the fix the SEALED snapshot still found it as line 1 - the same value by accident; the
    // discriminating half is the line above and `captureMicLines`).
    expect(activeMeterChannel({ ...sealed, audio: { ...sealed.audio, activeInputId: 'MIC-01' as const } })).toBe('AUDIO-01');
  });

  it('`captureReachabilityOf` (the start rule, `selectorOf`): rows are those of the current selector', () => {
    const sealed = afterSelectorChange(SessionState.SEALED);
    const rows = captureReachabilityOf(sealed);
    const ids = rows.map((row) => row.deviceId);
    expect(ids).toContain('CAM-05');
    expect(ids).toContain('MIC-04');
    expect(ids).not.toContain('CAM-02');
    expect(ids).not.toContain('MIC-01');
    // The fact of the NEW camera is read: CAM-05 is not reachable (the snapshot's CAM-02 was).
    expect(rows.find((row) => row.deviceId === 'CAM-05')?.reachable).toBe(false);
    // CONTROL: open session - the rows of its snapshot.
    const open = captureReachabilityOf(afterSelectorChange(SessionState.RECORDING)).map((row) => row.deviceId);
    expect(open).toContain('CAM-02');
    expect(open).not.toContain('CAM-05');
  });

  it('`camerasNotConnecting` (`sessionCameras`): a sealed session\'s snapshot is not read', () => {
    const lossOn = (state: SimState): SimState => ({
      ...state,
      faults: { ...state.faults, active: [...state.faults.active, { kind: FaultKind.CAMERA_LOSS, target: 'VIDEO-02', since: 1 } as unknown as SimState['faults']['active'][number]] },
    });
    const sealed = camerasNotConnecting(lossOn(afterSelectorChange(SessionState.SEALED)));
    expect(sealed.map((camera) => camera.deviceId)).toEqual(['CAM-05']);
    const open = camerasNotConnecting(lossOn(afterSelectorChange(SessionState.RECORDING)));
    expect(open.map((camera) => camera.deviceId)).toEqual(['CAM-02']);
  });
});

// Fix 157 - the same class, another member: `session.audioSource` (the active / standby pair). The slice keeps
// the pair of the last SEALED session; a reader that took it whatever the session's state named the OLD inputs
// after the selector's microphones were changed. Order of the defect: a session records MIC-01 / MIC-02 and is
// switched to MIC-02 (pair: active MIC-02, standby MIC-01), is SEALED, THEN the first line becomes MIC-04.
describe('the audio pair in force (sealed session THEN the microphone changed; fix 157)', () => {
  const PAIR = { sessionId: 'SES-20261011-0043', activeInputId: 'MIC-02', standbyInputId: 'MIC-01', switchedAt: 5_000, intervalFromMs: 4_000 };
  const withPair = (sessionState: Session['state']): SimState => {
    const state = afterSelectorChange(sessionState);
    return { ...state, session: { ...state.session!, timeline: [], audioSource: PAIR } as unknown as Session };
  };

  it('a SEALED session\'s pair is not the pair: the current selector gives it (PRIMARY = active, STANDBY = standby)', () => {
    const sealed = withPair(SessionState.SEALED);
    // The slice still HOLDS the old pair - that is the state the defect needs.
    expect(sealed.session?.audioSource).toMatchObject({ activeInputId: 'MIC-02', standbyInputId: 'MIC-01' });
    expect(openSessionAudioSource(sealed.session)).toBeNull();
    expect(audioPairInForce(sealed)).toEqual({ activeInputId: 'MIC-04', standbyInputId: 'MIC-02' });
    // It is the pair the NEXT recording starts with.
    // (`audioSourceAtStart` answers null for a selector without a complete pair since task 4 row 163; this one is complete.)
    const next = audioSourceAtStart(sealed, 'SES-NEXT');
    expect(next).not.toBeNull();
    expect(audioPairInForce(sealed)).toMatchObject({ activeInputId: next?.activeInputId, standbyInputId: next?.standbyInputId });
  });

  it('CONTROL - the same state with the session still OPEN: its own pair, in every open state', () => {
    for (const state of Object.values(SessionState)) {
      if (state === SessionState.SEALED) continue;
      const open = withPair(state);
      expect(openSessionAudioSource(open.session)).toBe(PAIR);
      expect(audioPairInForce(open)).toEqual({ activeInputId: 'MIC-02', standbyInputId: 'MIC-01' });
    }
  });

  it('no session: the selector\'s pair; an OPEN session that states no pair: not named here (the reader keeps the meters\' member)', () => {
    expect(audioPairInForce(afterSelectorChange(null))).toEqual({ activeInputId: 'MIC-04', standbyInputId: 'MIC-02' });
    expect(audioPairInForce(afterSelectorChange(SessionState.PRECHECK))).toEqual({ activeInputId: null, standbyInputId: null });
    // A hand-built holder without a selector names nothing, and does not throw.
    expect(audioPairInForce({ session: null })).toEqual({ activeInputId: null, standbyInputId: null });
  });

  it('`audioPairOfSelector`: by role only; nothing by position (task 4 row 164, site C18); one line has no standby', () => {
    expect(audioPairOfSelector([{ inputId: 'MIC-03', role: 'STANDBY' }, { inputId: 'MIC-01', role: 'PRIMARY' }])).toEqual({ activeInputId: 'MIC-01', standbyInputId: 'MIC-03' });
    // Lines without a role name no pair: before row 164 the first line stood in as the active input.
    expect(audioPairOfSelector([{ inputId: 'MIC-03' }, { inputId: 'MIC-01' }])).toEqual({ activeInputId: null, standbyInputId: null });
    expect(audioPairOfSelector([{ inputId: 'MIC-03', role: 'PRIMARY' }])).toEqual({ activeInputId: 'MIC-03', standbyInputId: null });
    // A lone STANDBY line is never the active input.
    expect(audioPairOfSelector([{ inputId: 'MIC-03', role: 'STANDBY' }])).toEqual({ activeInputId: null, standbyInputId: 'MIC-03' });
    expect(audioPairOfSelector(undefined)).toEqual({ activeInputId: null, standbyInputId: null });
  });

  it('LEFT, a fact OF the session: the audio intervals of a SEALED session still name the inputs it recorded', () => {
    const sealed = withPair(SessionState.SEALED);
    const inputs = audioSourceIntervalsOf(sealed, sealed.session!).map((interval) => interval.inputId);
    expect(inputs).toContain('MIC-02');
    expect(inputs).toContain('MIC-01');
    expect(inputs).not.toContain('MIC-04');
  });
});

describe('no second spelling in packages/shared/src (static; L-Z item 1)', () => {
  const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) files.push(path);
    }
  };
  walk(SRC);
  /** Code lines only, with their file: a comment may name the expression. */
  const codeLines = (path: string): string[] =>
    readFileSync(path, 'utf8')
      .split('\n')
      .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line));

  /**
   * The one reader that states a fact OF a given session (the audio intervals of a session summary, also of
   * a SEALED one): it reads that session's own snapshot and falls back to NO selector.
   */
  const OWN_FACT_OF_A_SESSION = ["const lines = session.captureConfig?.mics ?? [];"];

  it('no file spells "the session\'s snapshot, else the selector" itself', () => {
    const offenders: string[] = [];
    for (const path of files) {
      if (path.endsWith(join('sim', 'selector-in-force.ts'))) continue;
      for (const line of codeLines(path)) {
        if (!/session\??\.captureConfig\s*(\?\?|\?\.)/.test(line) && !/session\?\.captureConfig\s*[,\]]/.test(line)) continue;
        if (OWN_FACT_OF_A_SESSION.includes(line.trim())) continue;
        offenders.push(`${relative(SRC, path)}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
    expect(files.length).toBeGreaterThan(100);
  });

  it('CONTROL: the pattern finds the expression of the defect', () => {
    expect(/session\??\.captureConfig\s*(\?\?|\?\.)/.test('return state.session?.captureConfig?.mics ?? state.captureConfig.mics;')).toBe(true);
    expect(/session\??\.captureConfig\s*(\?\?|\?\.)/.test('const config = state.session?.captureConfig ?? state.captureConfig')).toBe(true);
  });

  /**
   * Fix 157. Readers of `session.audioSource` that are NOT under the rule, each with its reason:
   * the interval list is a fact OF the given session (also a sealed one); the switch transition and the
   * answer of operation 81 run under a RECORDING session only (the transition requires it) and read the
   * pair they are about to move / have just moved.
   */
  const AUDIO_PAIR_OF_A_GIVEN_SESSION = ['const source = session.audioSource ?? null;', 'const source = next.session?.audioSource;'];
  const PAIR_SPELLING = /(?<!['"`])\bsession\??\.audioSource\b/;

  it('fix 157: no file reads `session.audioSource` itself, except the readers of a fact OF a given session', () => {
    const offenders: string[] = [];
    const left: string[] = [];
    for (const path of files) {
      if (path.endsWith(join('sim', 'selector-in-force.ts'))) continue;
      for (const line of codeLines(path)) {
        if (!PAIR_SPELLING.test(line)) continue;
        if (AUDIO_PAIR_OF_A_GIVEN_SESSION.includes(line.trim())) left.push(`${relative(SRC, path)}: ${line.trim()}`);
        else offenders.push(`${relative(SRC, path)}: ${line.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
    // Exactly the three known readers: the intervals (api.ts), the switch (session-machine.ts), the answer of operation 81 (api.ts).
    expect(left.sort()).toEqual([
      'sim/api.ts: const source = next.session?.audioSource;',
      'sim/api.ts: const source = session.audioSource ?? null;',
      'sim/session-machine.ts: const source = session.audioSource ?? null;',
    ]);
  });

  it('fix 157 CONTROL: the pattern finds the expression of the defect', () => {
    expect(PAIR_SPELLING.test('s.session?.audioSource?.activeInputId ?? s.audio.activeInputId')).toBe(true);
    expect(PAIR_SPELLING.test('const named = s.session?.audioSource?.standbyInputId')).toBe(true);
    expect(PAIR_SPELLING.test('const intervals = session.audioSourceIntervals')).toBe(false);
  });

  it('`captureMicLines` IS the helper (one rule, not two that agree today)', () => {
    const audio = readFileSync(join(SRC, 'sim', 'audio.ts'), 'utf8');
    expect(audio).toMatch(/export function captureMicLines\([^)]*\)[^{]*\{\s*return micLinesInForce\(state\);\s*\}/);
  });
});
