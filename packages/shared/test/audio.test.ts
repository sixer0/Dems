// Audio generator (AC-53; masterplan/01_specs.md §14.7 `audio.ts`): 20 frames per second,
// levels in [−90, 0], peak hold 1.5 s then 20 dB/s decay, CLIP latched until reset,
// NO SIGNAL flat at −90, frames of plain numbers and booleans (SCR-01).
import { describe, expect, it } from 'vitest';
import type { AudioTrackId } from '../src/domain';
import {
  AUDIO_FRAME_MS,
  AUDIO_PEAK_HOLD_MS,
  MIC_INPUT_OF_CHANNEL,
  createManualClock,
  createSim,
  meterAt,
  stepMeter,
  type AudioFrame,
  type ScenarioName,
} from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0); // 10:00 WIB

function harness(scenario: ScenarioName = 'idle') {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, scenario });
  const frames: Record<AudioTrackId, AudioFrame[]> = { 'AUDIO-01': [], 'AUDIO-02': [] };
  for (const channel of ['AUDIO-01', 'AUDIO-02'] as const) {
    sim.store.subscribe(
      (state) => state.audio.inputs[MIC_INPUT_OF_CHANNEL[channel]]!,
      (frame) => frames[channel].push(frame),
    );
  }
  const run = (ms: number, step = 50) => {
    for (let elapsed = 0; elapsed < ms; elapsed += step) {
      clock.advance(step);
      sim.tick();
    }
  };
  return { sim, clock, frames, run, state: () => sim.store.getState() };
}

describe('frame rate (20 Hz = motion.meterFrameMs)', () => {
  it('produces 20 frames per second per channel, 50 ms apart', () => {
    const h = harness('recording');
    h.run(1_000);
    for (const channel of ['AUDIO-01', 'AUDIO-02'] as const) {
      expect(h.frames[channel]).toHaveLength(20);
      const times = h.frames[channel].map((frame) => frame.at);
      expect(times.slice(1).map((at, index) => at - (times[index] ?? 0))).toEqual(Array(19).fill(AUDIO_FRAME_MS));
      const seqs = h.frames[channel].map((frame) => frame.seq);
      expect(seqs.at(-1)! - seqs[0]!).toBe(19);
    }
  });

  it('still produces one frame per 50 ms slot when the scheduler ticks faster', () => {
    const h = harness('recording');
    h.run(1_000, 10);
    // The first 10 ms tick also emits the frame of slot 0 (at START); one second holds 20 slots.
    const window = h.frames['AUDIO-01'].filter((frame) => frame.at > START && frame.at <= START + 1_000);
    expect(window).toHaveLength(20);
    expect(new Set(h.frames['AUDIO-01'].map((frame) => frame.at)).size).toBe(h.frames['AUDIO-01'].length);
  });
});

describe('levels', () => {
  it('stay in [−90, 0] and are plain numbers and booleans (SCR-01)', () => {
    const h = harness('recording');
    h.run(60_000);
    for (const channel of ['AUDIO-01', 'AUDIO-02'] as const) {
      for (const frame of h.frames[channel]) {
        expect(frame.dbfs).toBeGreaterThanOrEqual(-90);
        expect(frame.dbfs).toBeLessThanOrEqual(0);
        expect(frame.peak).toBeGreaterThanOrEqual(frame.dbfs);
        expect(frame.peak).toBeLessThanOrEqual(0);
        for (const value of Object.values(frame)) expect(['number', 'boolean']).toContain(typeof value);
      }
    }
  });

  it('while recording, both speakers talk in turns at −24 to −12 dBFS above a −52 dBFS floor', () => {
    const h = harness('recording');
    h.run(90_000);
    for (const channel of ['AUDIO-01', 'AUDIO-02'] as const) {
      const levels = h.frames[channel].map((frame) => frame.dbfs);
      expect(Math.max(...levels)).toBeGreaterThan(-24);
      expect(Math.min(...levels)).toBeLessThan(-48);
    }
    // Speech alternates: the two channels are rarely loud at the same time.
    const loudTogether = h.frames['AUDIO-01'].filter((frame, index) => frame.dbfs > -30 && (h.frames['AUDIO-02'][index]?.dbfs ?? -90) > -30);
    expect(loudTogether.length).toBeLessThan(h.frames['AUDIO-01'].length * 0.1);
  });

  it('with no session the room is quiet: both channels sit at the −52 ± 2 dBFS floor', () => {
    const h = harness('idle');
    h.run(10_000);
    for (const channel of ['AUDIO-01', 'AUDIO-02'] as const) {
      const late = h.frames[channel].slice(40);
      expect(late.every((frame) => frame.dbfs >= -54.5 && frame.dbfs <= -49.5)).toBe(true);
    }
  });

  it('puts one peak near −3.1 dBFS every 90-180 s on the timeline while recording', () => {
    const h = harness('recording');
    h.run(200_000, 100);
    const peaks = (h.state().session?.timeline ?? []).filter((item) => item.kind === 'AUDIO_PEAK' && item.at > START);
    expect(peaks.length).toBeGreaterThanOrEqual(1);
    expect(peaks.length).toBeLessThanOrEqual(3);
    expect(peaks[0]?.label).toMatch(/^Audio peak -(2|3)\.\d dBFS$/);
  });
});

describe('ballistics (stepMeter)', () => {
  it('attacks instantly and releases at 20 dB/s', () => {
    let meter = meterAt(0, -52);
    meter = stepMeter(meter, -12, 50);
    expect(meter.dbfs).toBe(-12);
    meter = stepMeter(meter, -60, 550);
    expect(meter.dbfs).toBeCloseTo(-22, 6); // 0.5 s × 20 dB/s
  });

  it('holds the peak for 1.5 s, then decays at 20 dB/s (never below the level)', () => {
    let meter = meterAt(0, -52);
    meter = stepMeter(meter, -3, 50);
    const trace: { at: number; peak: number }[] = [];
    for (let at = 100; at <= 4_000; at += AUDIO_FRAME_MS) {
      meter = stepMeter(meter, -52, at);
      trace.push({ at, peak: meter.peak });
    }
    const holdEnd = 50 + AUDIO_PEAK_HOLD_MS;
    for (const point of trace.filter((p) => p.at <= holdEnd)) expect(point.peak).toBe(-3);
    const at2s = trace.find((p) => p.at === holdEnd + 500);
    expect(at2s?.peak).toBeCloseTo(-13, 6); // 0.5 s after the hold: −3 − 10 dB
    const at3s = trace.find((p) => p.at === holdEnd + 1_000);
    expect(at3s?.peak).toBeCloseTo(-23, 6);
    // It never falls under the ballistic level.
    expect(trace.every((p) => p.peak >= -52)).toBe(true);
  });

  it('a new higher level restarts the hold', () => {
    let meter = stepMeter(meterAt(0, -52), -10, 50);
    meter = stepMeter(meter, -52, 1_000);
    meter = stepMeter(meter, -6, 1_050);
    expect(meter).toMatchObject({ peak: -6, holdUntil: 1_050 + AUDIO_PEAK_HOLD_MS });
  });

  it('clamps to [−90, 0]', () => {
    expect(stepMeter(meterAt(0), 12, 50).dbfs).toBe(0);
    expect(stepMeter(meterAt(0, -90), -200, 50).dbfs).toBe(-90);
  });
});

describe('CLIP latch (fault injection only) and NO SIGNAL', () => {
  it('latches at once, persists after the fault clears, and resets only with resetClip', () => {
    const h = harness('recording');
    h.run(1_000);
    expect(h.frames['AUDIO-02'].some((frame) => frame.clip)).toBe(false);

    h.sim.actions.inject('MIC_CLIP', { channel: 'AUDIO-02' });
    expect(h.state().mics.find((mic) => mic.id === 'AUDIO-02')).toMatchObject({ clipLatched: true, state: 'CLIP' });
    expect(h.state().audio.inputs['MIC-02']!).toMatchObject({ clip: true });
    expect(h.state().audio.inputs['MIC-02']!.dbfs).toBeGreaterThanOrEqual(-0.5);
    h.run(3_000);
    expect(h.frames['AUDIO-02'].slice(-60).every((frame) => frame.clip)).toBe(true);
    expect(h.frames['AUDIO-02'].slice(-60).some((frame) => frame.dbfs >= -0.5)).toBe(true);
    // The other channel is never affected (SYS-003: channels are never merged).
    expect(h.frames['AUDIO-01'].every((frame) => !frame.clip)).toBe(true);

    h.sim.actions.clearFault('MIC_CLIP');
    h.run(5_000);
    expect(h.state().mics.find((mic) => mic.id === 'AUDIO-02')).toMatchObject({ clipLatched: true, state: 'READY' });
    expect(h.frames['AUDIO-02'].slice(-20).every((frame) => frame.clip && frame.dbfs < -0.5)).toBe(true);

    h.sim.actions.resetClip('AUDIO-02');
    h.run(5_000);
    expect(h.state().mics.find((mic) => mic.id === 'AUDIO-02')?.clipLatched).toBe(false);
    expect(h.frames['AUDIO-02'].slice(-100).every((frame) => !frame.clip)).toBe(true);
  });

  it('a reset while the fault is still active latches again on the next burst', () => {
    const h = harness('recording');
    h.sim.actions.inject('MIC_CLIP', { channel: 'AUDIO-02' });
    h.sim.actions.resetClip('AUDIO-02');
    expect(h.state().mics.find((mic) => mic.id === 'AUDIO-02')?.clipLatched).toBe(false);
    h.run(1_300);
    expect(h.state().mics.find((mic) => mic.id === 'AUDIO-02')?.clipLatched).toBe(true);
  });

  it('NO SIGNAL is a flat −90 on that channel only, and recovers when cleared', () => {
    const h = harness('recording');
    h.sim.actions.inject('MIC_NO_SIGNAL', { channel: 'AUDIO-01' });
    h.run(2_000);
    const silent = h.frames['AUDIO-01'].slice(-40);
    expect(silent.every((frame) => frame.noSignal && frame.dbfs === -90 && frame.peak === -90)).toBe(true);
    expect(h.frames['AUDIO-02'].slice(-40).every((frame) => !frame.noSignal)).toBe(true);
    expect(h.state().mics.find((mic) => mic.id === 'AUDIO-01')).toMatchObject({ state: 'NO_SIGNAL', recState: 'LOST' });
    h.sim.actions.clearFault('MIC_NO_SIGNAL');
    h.run(1_000);
    expect(h.state().audio.inputs['MIC-01']!.noSignal).toBe(false);
    expect(h.state().audio.inputs['MIC-01']!.dbfs).toBeGreaterThan(-90);
  });

  it('a TEST_SIGNAL device command plays a steady −18 dBFS tone for 2 s', () => {
    const h = harness('idle');
    h.run(500);
    // Step 54 (W52-6): device commands need a signed-in operator (TEST_SIGNAL: DIAGNOSTICS_RUN).
    h.sim.actions.signIn('budi.santoso', 'demo-2026');
    h.sim.actions.deviceCommand('MIC-01', 'TEST_SIGNAL');
    h.run(1_000);
    const tone = h.frames['AUDIO-01'].slice(-10);
    expect(tone.every((frame) => Math.abs(frame.dbfs - -18) < 1.5)).toBe(true);
    h.run(3_000);
    expect(h.state().audio.inputs['MIC-01']!.dbfs).toBeLessThan(-45);
    expect(h.state().audit.rows.at(-1)).toMatchObject({ type: 'DEVICE_COMMAND', deviceId: 'MIC-01', details: { command: 'TEST_SIGNAL' } });
  });
});
