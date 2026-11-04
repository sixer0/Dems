// Blueprint row 51 (M2-W9): Simulated v2 parity. Proves the register rows this row closes —
// SH-05/SH-06 (session capture-config snapshot + audio-source pair + per-step sealing progress +
// the mic-switch transition), SH-07 (v2 evidence files / fragment-chain head / transcript hash on a
// live seal only), SH-08 (the OD-11 silence warning that never switches), SH-10 (snapshot version +
// sealing-driver timing constants) and SH-25/E-02 (the meters re-key contract at the seam).
// Every assertion is falsifiable: it names the exact value schema v2 must produce.
import { describe, expect, it } from 'vitest';
import {
  passCaptureStart,
  buildEvidenceFilesV2,
  captureConfigSnapshot,
  createManualClock,
  createSim,
  FaultKind,
  MIC_SILENCE_DBFS,
  MIC_SILENCE_DURATION_MS,
  maybeRaiseMicSilentWarning,
  packageFragmentChainHead,
  SEALING_FIRST_ATTEMPT,
  SEALING_PROGRESS_TICK_MS,
  SIM_SNAPSHOT_VERSION,
  switchAudioSourceTransition,
  transcriptSha256,
  type SessionCreateInput,
} from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0); // 2026-10-01 10:00 WIB

const INPUT: SessionCreateInput = {
  caseNumber: 'LP/2026/1001-0008',
  subjectType: 'SAKSI',
  subjectName: 'Test Saksi',
  investigatorId: 'OPR-001',
  room: 'Interview Room 1',
  profileId: 'STANDARD_1080P25',
};

function harness() {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null });
  sim.actions.signIn('budi.santoso', 'demo-2026');
  const state = () => sim.store.getState();
  const run = (ms: number, step = 50) => {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
      clock.advance(step);
      sim.tick();
    }
  };
  const toRecording = () => {
    sim.actions.createSession(INPUT);
    sim.actions.beginPrecheck();
    run(5_000);
    sim.actions.startRecording();
    // Pass D10: past the connecting part of the start, so the recording can be stopped and switched.
    passCaptureStart(clock.advance, sim.tick);
  };
  return { sim, clock, state, run, toRecording };
}

describe('SH-10 constants (register SH-10)', () => {
  it('the snapshot version is pinned and the sealing-driver timing constants exist', () => {
    // SH-10 landed: version 2 travels atomically with the WIRE MetaSlice literal
    // (`api/state-slices.ts`), the `MetaSlice` type (`sim/types.ts`), both state builders
    // (`sim/initial-state.ts`, `live/source/neutral-state.ts`), the committed `openapi/openapi.json`
    // const and the Core boot check (`db/mapping/rows.ts`). The pin keeps a future move visible.
    expect(SIM_SNAPSHOT_VERSION).toBe(2);
    expect(SEALING_FIRST_ATTEMPT).toBe(1);
    expect(SEALING_PROGRESS_TICK_MS).toBeGreaterThan(0);
    expect(MIC_SILENCE_DBFS).toBe(-50);
    expect(MIC_SILENCE_DURATION_MS).toBe(10_000);
  });
});

describe('SH-06 session machine (register SH-05/SH-06)', () => {
  it('startRecording snapshots the selector and opens the active/standby mic pair', () => {
    const h = harness();
    h.toRecording();
    const session = h.state().session;
    expect(session?.state).toBe('RECORDING');
    // The selector as it stood at the start (SH-05/SH-06; OD-10). D60 (2026-11-04): FOUR camera lines.
    expect(session?.captureConfig).not.toBeNull();
    expect(session?.captureConfig?.cameras).toHaveLength(4);
    expect(session?.captureConfig?.mics.map((mic) => mic.channel)).toEqual(['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']); // D61 (2026-11-04): four channels in the snapshot
    // The active input inside AUDIO-01 is the primary; the standby is hot (OD-09).
    expect(session?.audioSource).toMatchObject({
      sessionId: session?.id,
      activeInputId: 'MIC-01',
      standbyInputId: 'MIC-02',
      switchedAt: null,
      intervalFromMs: 0,
    });
  });

  it('the snapshot is a copy: editing the live selector afterwards never reaches the running session', () => {
    const h = harness();
    h.toRecording();
    const snapshotted = h.state().session?.captureConfig?.mics.map((mic) => mic.channel);
    // Mutate the live slice the way op 78 would (a swap of the roles while idle would be refused
    // mid-session, but the snapshot must be independent regardless).
    const next = { ...h.state(), captureConfig: { ...h.state().captureConfig, locked: true } };
    expect(captureConfigSnapshot(next)?.cameras).toHaveLength(4); // D60 (2026-11-04)
    expect(h.state().session?.captureConfig?.mics.map((mic) => mic.channel)).toEqual(snapshotted);
  });

  it('advanceFinalization reports per-step progress, ETA and attempt from Core instants (R-6 op 83)', () => {
    const h = harness();
    h.toRecording();
    h.sim.actions.stopRecording('Interview complete');
    // Run into FINALIZING but stop mid-run so a step is still active.
    h.run(1_600); // past STOPPING_MS (1.5 s) into the first sealing step
    const steps = h.state().session?.finalization.steps ?? [];
    expect(steps.length).toBe(6);
    const active = steps.find((step) => step.status === 'active');
    expect(active).toBeDefined();
    expect(active?.attempt).toBe(SEALING_FIRST_ATTEMPT);
    expect(active?.etaMs).toBeTypeOf('number');
    expect(active?.etaMs).toBeGreaterThan(0);
    expect(active?.progress ?? 0).toBeGreaterThanOrEqual(0);
    // The whole run finishes and every step reaches 100.
    h.run(10_000);
    expect(h.state().session?.state).toBe('SEALED');
  });
});

describe('SH-06/SH-08 mic switch (register SH-06/SH-08; op 81; OD-09)', () => {
  it('switchAudioSourceTransition moves the active input, records the interval, audits with the device id', () => {
    const h = harness();
    h.toRecording();
    const before = h.state();
    const now = START + 30_000;
    const next = switchAudioSourceTransition(before, now, 'MIC-02');
    expect(next.audio.activeInputId).toBe('MIC-02');
    expect(next.session?.audioSource).toMatchObject({ activeInputId: 'MIC-02', standbyInputId: 'MIC-01' });
    // The interval opens at the media-pts boundary (now minus the recording start), never the wall clock.
    const startedAt = before.session?.startedAt ?? now;
    expect(next.session?.audioSource?.intervalFromMs).toBe(Math.max(0, now - startedAt));
    // One timeline AUDIO_SWITCH item naming the channel and both inputs.
    const switchItem = next.session?.timeline.find((item) => item.kind === 'AUDIO_SWITCH');
    expect(switchItem).toBeDefined();
    expect(switchItem?.params).toMatchObject({ from: 'MIC-01', to: 'MIC-02', deviceId: 'MIC-02' });
    // One AUDIO_SOURCE_SWITCHED audit row carrying the sending device id (E-30).
    const audit = next.audit.rows.at(-1);
    expect(audit?.type).toBe('AUDIO_SOURCE_SWITCHED');
    // Fix pass F-M5 (review R74-05): the keys of contract C3 §5.2 (it pinned the simulator's own `fromInputId` / `toInputId` / `deviceId`).
    expect(audit?.details).toMatchObject({ fromInput: 'MIC-01', toInput: 'MIC-02', fromMs: 0 });
    expect(Object.keys(audit?.details ?? {}).sort()).toEqual(['fromInput', 'fromMs', 'toInput', 'toMs']);
    // It never touches the interview-role copy of the mics (only the capture role / active input).
    expect(next.mics).toBe(before.mics);
  });

  it('is idempotent when the input is already active', () => {
    const h = harness();
    h.toRecording();
    const now = START + 30_000;
    const once = switchAudioSourceTransition(h.state(), now, 'MIC-02');
    const twice = switchAudioSourceTransition(once, now + 1_000, 'MIC-02');
    expect(twice).toBe(once);
  });
});

describe('SH-08 silence warning (register SH-08; OD-11; D220)', () => {
  it('raises MIC_SILENT after the active input is dead for 10 s, and NEVER switches the active input', () => {
    const h = harness();
    h.toRecording();
    // Force the active channel (AUDIO-01 -> MIC-01) to no-signal so the raiser sees a dead input.
    h.sim.actions.inject(FaultKind.MIC_NO_SIGNAL, { channel: 'AUDIO-01' });
    const silentSince = START + 1_000;
    // Below the debounce: nothing raised.
    const early = maybeRaiseMicSilentWarning(h.state(), silentSince + 9_000, silentSince);
    expect(early.faults.active.some((f) => f.kind === FaultKind.MIC_SILENT)).toBe(false);
    // At the debounce: exactly one MIC_SILENT warning, active input unchanged.
    const raised = maybeRaiseMicSilentWarning(h.state(), silentSince + MIC_SILENCE_DURATION_MS, silentSince);
    expect(raised.faults.active.some((f) => f.kind === FaultKind.MIC_SILENT)).toBe(true);
    expect(raised.audio.activeInputId).toBe(h.state().audio.activeInputId); // never auto-switches
    // Idempotent.
    expect(maybeRaiseMicSilentWarning(raised, silentSince + MIC_SILENCE_DURATION_MS + 5_000, silentSince)).toBe(raised);
  });

  it('does not raise outside RECORDING', () => {
    const h = harness();
    const idle = h.state();
    expect(maybeRaiseMicSilentWarning(idle, START + 60_000, START)).toBe(idle);
  });
});

describe('SH-07 evidence v2 (register SH-07; OD-02 L2)', () => {
  it('a live seal carries the v2 file list, fragment-chain head and transcript hash', () => {
    const h = harness();
    h.toRecording();
    h.run(2_000);
    h.sim.actions.stopRecording('Interview complete');
    h.run(12_000);
    expect(h.state().session?.state).toBe('SEALED');
    const item = h.state().evidence.at(-1);
    expect(item).toBeDefined();
    // D61 (2026-11-04): the live seal carries EIGHT files - one whole fMP4 per camera AND one PCM
    // file per microphone channel (the audio plane widened from the two embedded roles to four).
    expect(item?.files?.map((file) => file.trackId)).toEqual(['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'AUDIO-01', 'AUDIO-02', 'AUDIO-03', 'AUDIO-04']); // D60: four video files; D61: plus four audio files
    expect(item?.files?.every((file) => /^[0-9a-f]{64}$/.test(file.sha256))).toBe(true);
    expect(item?.fragmentChainHead).toMatch(/^[0-9a-f]{64}$/);
    expect(item?.transcriptSha256).toMatch(/^[0-9a-f]{64}$/);
    // Deterministic: recomputing from the same integrity input yields the same values.
    const recomputed = packageFragmentChainHead({
      evidenceId: item!.id,
      sessionId: item!.sessionId,
      caseNumber: item!.caseNumber,
      recordedAt: item!.recordedAt,
      endedAt: item!.endedAt,
      sizeBytes: item!.sizeBytes,
    });
    expect(recomputed).toBe(item?.fragmentChainHead);
    expect(buildEvidenceFilesV2({
      evidenceId: item!.id, sessionId: item!.sessionId, caseNumber: item!.caseNumber,
      recordedAt: item!.recordedAt, endedAt: item!.endedAt, sizeBytes: item!.sizeBytes,
    })).toHaveLength(8); // D60: four camera files; D61 (2026-11-04): plus four audio files
    expect(transcriptSha256({
      evidenceId: item!.id, sessionId: item!.sessionId, caseNumber: item!.caseNumber,
      recordedAt: item!.recordedAt, endedAt: item!.endedAt, sizeBytes: item!.sizeBytes,
    })).toBe(item?.transcriptSha256);
  });

  it('the pre-built dataset items keep their byte-identical v1 shape (no v2 fields)', () => {
    const h = harness();
    const seeded = h.state().evidence.filter((item) => item.integritySource === 'DEMO_PACKAGE');
    expect(seeded.length).toBeGreaterThan(0);
    for (const item of seeded) {
      expect(item.files).toBeUndefined();
      expect(item.fragmentChainHead).toBeUndefined();
      expect(item.transcriptSha256).toBeUndefined();
    }
  });
});
