// Audio generator (AC-53; masterplan/01_specs.md §14.7 `audio.ts`): 20 frames per second,
// levels in [−90, 0], peak hold 1.5 s then 20 dB/s decay, CLIP latched until reset,
// NO SIGNAL flat at −90, frames of plain numbers and booleans (SCR-01).
import { describe, expect, it } from 'vitest';
import type { AudioTrackId } from '../src/domain';
import {
  AUDIO_FRAME_MS,
  AUDIO_PEAK_HOLD_MS,
  DEFAULT_MIC_INPUT_OF_CHANNEL,
  activeMeterChannel,
  audioPairOfSelector,
  channelOfMicLine,
  createManualClock,
  createSim,
  meterAt,
  meterInputOfChannel,
  micInputOfChannel,
  micInputOfRole,
  stepMeter,
  type AudioFrame,
  type RoleMicLine,
  type ScenarioName,
  type SimState,
} from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0); // 10:00 WIB

function harness(scenario: ScenarioName = 'idle') {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, scenario });
  const frames: Record<AudioTrackId, AudioFrame[]> = { 'AUDIO-01': [], 'AUDIO-02': [] };
  for (const channel of ['AUDIO-01', 'AUDIO-02'] as const) {
    sim.store.subscribe(
      (state) => state.audio.inputs[DEFAULT_MIC_INPUT_OF_CHANNEL[channel]]!,
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

// Task 4 row 164 (WP-13a; decisions C18 (2), C21 (7), AD-04; names register 161 sections 3 and 7):
// a microphone input is looked up BY ROLE. The double is a hand-built list of selector lines.
describe('the lookup of a microphone input by role (task 4 row 164)', () => {
  const line = (inputId: string, role: 'PRIMARY' | 'STANDBY'): RoleMicLine => ({ inputId, role });
  type Answers = {
    primary: string | null;
    standby: string | null;
    meter: readonly [string | null, string | null];
    channelOf: Readonly<Record<string, 'AUDIO-01' | 'AUDIO-02' | null>>;
  };
  const table: readonly { name: string; lines: readonly RoleMicLine[]; complete: boolean; answers: Answers }[] = [
    {
      name: 'complete, MIC-01 PRIMARY (the seeded arrangement)',
      lines: [line('MIC-01', 'PRIMARY'), line('MIC-02', 'STANDBY')],
      complete: true,
      answers: { primary: 'MIC-01', standby: 'MIC-02', meter: ['MIC-01', 'MIC-02'], channelOf: { 'MIC-01': 'AUDIO-01', 'MIC-02': 'AUDIO-02', 'MIC-03': null } },
    },
    {
      name: 'complete, MIC-02 PRIMARY (the other arrangement, same input order)',
      lines: [line('MIC-01', 'STANDBY'), line('MIC-02', 'PRIMARY')],
      complete: true,
      answers: { primary: 'MIC-02', standby: 'MIC-01', meter: ['MIC-01', 'MIC-02'], channelOf: { 'MIC-01': 'AUDIO-01', 'MIC-02': 'AUDIO-02', 'MIC-03': null } },
    },
    {
      name: 'complete, inputs beyond the built-in pair',
      lines: [line('MIC-04', 'STANDBY'), line('MIC-03', 'PRIMARY')],
      complete: true,
      answers: { primary: 'MIC-03', standby: 'MIC-04', meter: ['MIC-04', 'MIC-03'], channelOf: { 'MIC-04': 'AUDIO-01', 'MIC-03': 'AUDIO-02', 'MIC-01': null, 'MIC-02': null } },
    },
    {
      name: 'a lone STANDBY line',
      lines: [line('MIC-02', 'STANDBY')],
      complete: false,
      answers: { primary: null, standby: 'MIC-02', meter: [null, null], channelOf: { 'MIC-01': null, 'MIC-02': null } },
    },
    {
      name: 'a lone PRIMARY line',
      lines: [line('MIC-03', 'PRIMARY')],
      complete: false,
      answers: { primary: 'MIC-03', standby: null, meter: [null, null], channelOf: { 'MIC-03': null, 'MIC-01': null } },
    },
    {
      name: 'no microphone line',
      lines: [],
      complete: false,
      answers: { primary: null, standby: null, meter: [null, null], channelOf: { 'MIC-01': null, 'MIC-02': null } },
    },
    {
      name: 'two lines of one role (a state put in place otherwise)',
      lines: [line('MIC-01', 'PRIMARY'), line('MIC-02', 'PRIMARY')],
      complete: false,
      answers: { primary: 'MIC-01', standby: null, meter: [null, null], channelOf: { 'MIC-01': null, 'MIC-02': null } },
    },
  ];

  it.each(table)('$name: each reader answers as the register states', ({ lines, complete, answers }) => {
    expect(micInputOfRole(lines, 'PRIMARY')).toBe(answers.primary);
    expect(micInputOfRole(lines, 'STANDBY')).toBe(answers.standby);
    expect([meterInputOfChannel(lines, 'AUDIO-01'), meterInputOfChannel(lines, 'AUDIO-02')]).toEqual(answers.meter);
    for (const [inputId, channel] of Object.entries(answers.channelOf)) expect(channelOfMicLine(lines, inputId)).toBe(channel);
    // The pair of `selector-in-force.ts` is the same rule (it imports nothing, so it spells it itself).
    expect(audioPairOfSelector(lines)).toEqual({ activeInputId: answers.primary, standbyInputId: answers.standby });
    // D137 is kept for a complete pair: the answer is the positional function's, in both arrangements.
    if (complete) {
      expect(meterInputOfChannel(lines, 'AUDIO-01')).toBe(micInputOfChannel(lines, 'AUDIO-01'));
      expect(meterInputOfChannel(lines, 'AUDIO-02')).toBe(micInputOfChannel(lines, 'AUDIO-02'));
    }
  });

  it('a lone STANDBY line is never the active input; without lines the answer is absent, neither MIC-01 nor MIC-02', () => {
    const lone = [line('MIC-02', 'STANDBY')];
    expect(micInputOfRole(lone, 'PRIMARY')).toBeNull();
    expect(audioPairOfSelector(lone).activeInputId).toBeNull();
    const answers = [
      micInputOfRole([], 'PRIMARY'),
      micInputOfRole([], 'STANDBY'),
      meterInputOfChannel([], 'AUDIO-01'),
      meterInputOfChannel([], 'AUDIO-02'),
      audioPairOfSelector([]).activeInputId,
      audioPairOfSelector([]).standbyInputId,
    ];
    // Absent is `null`: never undefined, an empty text or a built-in input.
    expect(answers).toEqual([null, null, null, null, null, null]);
    // The parameter seam of `channelOfMicLine` (PENDING-ROW-171): lines that state no role are no
    // pair, so they have no channel - not channel 1 and 2 by their position.
    expect([channelOfMicLine([{ inputId: 'MIC-01' }, { inputId: 'MIC-02' }], 'MIC-01'), channelOfMicLine([], 'MIC-01')]).toEqual([null, null]);
    // CONTROL: the positional function, unchanged until row 172, still answers the constants.
    expect([micInputOfChannel([], 'AUDIO-01'), micInputOfChannel([], 'AUDIO-02')]).toEqual(['MIC-01', 'MIC-02']);
  });

  const withSelector = (h: ReturnType<typeof harness>, mics: SimState['captureConfig']['mics']) =>
    h.sim.store.setState({ captureConfig: { ...h.state().captureConfig, mics } });
  const seeded = (h: ReturnType<typeof harness>) => h.state().captureConfig.mics;

  it('`activeMeterChannel`: the active input among the lines; the channel LABEL 1 when it has no channel or none is active', () => {
    const h = harness('idle');
    expect(activeMeterChannel(h.state())).toBe('AUDIO-01');
    expect(activeMeterChannel({ ...h.state(), audio: { ...h.state().audio, activeInputId: 'MIC-02' } })).toBe('AUDIO-02');
    // No active input (what the slice holds once the seam of row 28 is out): no lookup, the label.
    const noneActive = { ...h.state(), audio: { ...h.state().audio, activeInputId: null } } as unknown as SimState;
    expect(activeMeterChannel(noneActive)).toBe('AUDIO-01');
    // A lone line has no channel: the label, and no input behind it.
    const lone = { ...h.state(), captureConfig: { ...h.state().captureConfig, mics: seeded(h).slice(1) }, audio: { ...h.state().audio, activeInputId: 'MIC-02' } };
    expect(activeMeterChannel(lone)).toBe('AUDIO-01');
    expect(meterInputOfChannel(lone.captureConfig.mics, activeMeterChannel(lone))).toBeNull();
  });

  it('the subsystem: no frame for a channel without an input, and no frame under a built-in name', () => {
    const h = harness('idle');
    h.run(200);
    expect(Object.keys(h.state().audio.inputs).sort()).toEqual(['MIC-01', 'MIC-02']);
    expect(h.state().audio.activeInputId).toBe('MIC-01');

    // A lone STANDBY line: no meter channel, hence no frame at all.
    withSelector(h, seeded(h).filter((mic) => mic.role === 'STANDBY'));
    h.run(200);
    expect(h.state().audio.inputs).toEqual({});
    // PENDING-ROW-28-SEAM: the register's answer is `null` (no PRIMARY line). While the state's
    // member is typed as an input the subsystem keeps what it held; it is NOT moved to the lone
    // STANDBY line and not to a line by position. Flip to `toBeNull()` with the seam's removal.
    expect(h.state().audio.activeInputId).toBe('MIC-01');

    // No microphone line: no frame either.
    withSelector(h, []);
    h.run(200);
    expect(h.state().audio.inputs).toEqual({});
  });

  it('the subsystem: a pair that no longer holds the active input reads its PRIMARY line, by role', () => {
    const h = harness('idle');
    h.run(100);
    // MIC-03 / MIC-04 with the PRIMARY role on the SECOND line: position 0 is the STANDBY.
    withSelector(h, [
      { ...seeded(h)[0]!, inputId: 'MIC-04', deviceId: 'MIC-04', role: 'STANDBY' },
      { ...seeded(h)[1]!, inputId: 'MIC-03', deviceId: 'MIC-03', role: 'PRIMARY' },
    ]);
    h.run(100);
    expect(Object.keys(h.state().audio.inputs).sort()).toEqual(['MIC-03', 'MIC-04']);
    expect(h.state().audio.activeInputId).toBe('MIC-03');
  });

  it('Simulated mode on the seeded selector: both lookups answer what the positional function answers', () => {
    const h = harness('recording');
    const lines = seeded(h);
    expect(lines.map((mic) => [mic.inputId, mic.role])).toEqual([['MIC-01', 'PRIMARY'], ['MIC-02', 'STANDBY']]);
    for (const channel of ['AUDIO-01', 'AUDIO-02'] as const) {
      expect(meterInputOfChannel(lines, channel)).toBe(micInputOfChannel(lines, channel));
      expect(meterInputOfChannel(lines, channel)).toBe(DEFAULT_MIC_INPUT_OF_CHANNEL[channel]);
    }
    h.run(1_000);
    expect(h.frames['AUDIO-01']).toHaveLength(20);
    expect(h.frames['AUDIO-02']).toHaveLength(20);
    expect(h.state().audio.activeInputId).toBe(micInputOfRole(lines, 'PRIMARY'));
  });
});
