// Audio generator (AC-53; masterplan/01_specs.md §14.7 `audio.ts`): 20 frames per second,
// levels in [−90, 0], peak hold 1.5 s then 20 dB/s decay, CLIP latched until reset,
// NO SIGNAL flat at −90, frames of plain numbers and booleans (SCR-01).
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
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
  stepMeter,
  type AudioFrame,
  type ChannelMicLine,
  type ScenarioName,
  type SimState,
} from '../src/sim';

const START = Date.UTC(2026, 9, 1, 3, 0, 0); // 10:00 WIB

function harness(scenario: ScenarioName = 'idle') {
  const clock = createManualClock(START);
  const sim = createSim({ clock, storage: null, authStorage: null, scenario });
  // D61 (2026-11-04): four simultaneous channels; the harness subscribes to all four.
  const frames: Record<AudioTrackId, AudioFrame[]> = { 'AUDIO-01': [], 'AUDIO-02': [], 'AUDIO-03': [], 'AUDIO-04': [] };
  for (const channel of ['AUDIO-01', 'AUDIO-02', 'AUDIO-03', 'AUDIO-04'] as const) {
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
describe('the lookup of a microphone input by channel (task 4 row 164; D61 of 2026-11-04: the roles became the numbered channels)', () => {
  const line = (inputId: string, channel: 'MIC-01' | 'MIC-02' | 'MIC-03' | 'MIC-04'): ChannelMicLine => ({ inputId, channel });
  type Answers = {
    primary: string | null;
    standby: string | null;
    meter: readonly [string | null, string | null];
    // D61 (2026-11-04): four channels, so the answers name AUDIO-03/04 too.
    channelOf: Readonly<Record<string, 'AUDIO-01' | 'AUDIO-02' | 'AUDIO-03' | 'AUDIO-04' | null>>;
  };
  const table: readonly { name: string; lines: readonly ChannelMicLine[]; answers: Answers }[] = [
    {
      name: 'channels 1 and 2 held, MIC-01 on channel 1 (the seeded arrangement)',
      lines: [line('MIC-01', 'MIC-01'), line('MIC-02', 'MIC-02')],
      answers: { primary: 'MIC-01', standby: 'MIC-02', meter: ['MIC-01', 'MIC-02'], channelOf: { 'MIC-01': 'AUDIO-01', 'MIC-02': 'AUDIO-02', 'MIC-03': null } },
    },
    {
      name: 'channels traded: MIC-02 on channel 1 (the transcription toggle\'s other side)',
      lines: [line('MIC-01', 'MIC-02'), line('MIC-02', 'MIC-01')],
      answers: { primary: 'MIC-02', standby: 'MIC-01', meter: ['MIC-02', 'MIC-01'], channelOf: { 'MIC-01': 'AUDIO-02', 'MIC-02': 'AUDIO-01', 'MIC-03': null } },
    },
    {
      name: 'channels 1 and 2 held by inputs beyond the built-in pair',
      lines: [line('MIC-03', 'MIC-01'), line('MIC-04', 'MIC-02')],
      answers: { primary: 'MIC-03', standby: 'MIC-04', meter: ['MIC-03', 'MIC-04'], channelOf: { 'MIC-03': 'AUDIO-01', 'MIC-04': 'AUDIO-02', 'MIC-01': null, 'MIC-02': null } },
    },
    {
      name: 'a lone channel-2 line: it has its OWN meter now (D61 per-channel, no pair rule)',
      lines: [line('MIC-02', 'MIC-02')],
      answers: { primary: null, standby: 'MIC-02', meter: [null, 'MIC-02'], channelOf: { 'MIC-01': null, 'MIC-02': 'AUDIO-02' } },
    },
    {
      name: 'a lone channel-3 line: channel 3 has its input, channels 1 and 2 do not',
      lines: [line('MIC-03', 'MIC-03')],
      // D61 (2026-11-04): the lookup answers by STATED channel - channel 1 has no line (primary
      // null), and the lone line states channel 3, so its channel is AUDIO-03, not "no channel".
      answers: { primary: null, standby: null, meter: [null, null], channelOf: { 'MIC-03': 'AUDIO-03', 'MIC-01': null } },
    },
    {
      name: 'no microphone line',
      lines: [],
      answers: { primary: null, standby: null, meter: [null, null], channelOf: { 'MIC-01': null, 'MIC-02': null } },
    },
    {
      name: 'two lines of one channel (a state put in place otherwise): the first line answers',
      lines: [line('MIC-01', 'MIC-01'), line('MIC-02', 'MIC-01')],
      answers: { primary: 'MIC-01', standby: null, meter: ['MIC-01', null], channelOf: { 'MIC-01': 'AUDIO-01', 'MIC-02': 'AUDIO-01' } },
    },
  ];

  it.each(table)('$name: each reader answers as the register states', ({ lines, answers }) => {
    expect(micInputOfChannel(lines, 'MIC-01')).toBe(answers.primary);
    expect(micInputOfChannel(lines, 'MIC-02')).toBe(answers.standby);
    expect([meterInputOfChannel(lines, 'AUDIO-01'), meterInputOfChannel(lines, 'AUDIO-02')]).toEqual(answers.meter);
    for (const [inputId, channel] of Object.entries(answers.channelOf)) expect(channelOfMicLine(lines, inputId)).toBe(channel);
    // The pair of `selector-in-force.ts` is the same rule (it imports nothing, so it spells it itself).
    expect(audioPairOfSelector(lines)).toEqual({ activeInputId: answers.primary, standbyInputId: answers.standby });
  });

  it('D61 per-channel: every named channel has its input, independently of the others', () => {
    const four = [line('MIC-05', 'MIC-01'), line('MIC-06', 'MIC-02'), line('MIC-07', 'MIC-03'), line('MIC-08', 'MIC-04')];
    expect([meterInputOfChannel(four, 'AUDIO-01'), meterInputOfChannel(four, 'AUDIO-02'), meterInputOfChannel(four, 'AUDIO-03'), meterInputOfChannel(four, 'AUDIO-04')]).toEqual(['MIC-05', 'MIC-06', 'MIC-07', 'MIC-08']);
    expect(channelOfMicLine(four, 'MIC-07')).toBe('AUDIO-03');
  });

  it('a lone channel-2 line is never the active input; without lines the answer is absent, neither MIC-01 nor MIC-02', () => {
    const lone = [line('MIC-02', 'MIC-02')];
    expect(micInputOfChannel(lone, 'MIC-01')).toBeNull();
    expect(audioPairOfSelector(lone).activeInputId).toBeNull();
    const answers = [
      micInputOfChannel([], 'MIC-01'),
      micInputOfChannel([], 'MIC-02'),
      meterInputOfChannel([], 'AUDIO-01'),
      meterInputOfChannel([], 'AUDIO-02'),
      audioPairOfSelector([]).activeInputId,
      audioPairOfSelector([]).standbyInputId,
    ];
    // Absent is `null`: never undefined, an empty text or a built-in input.
    expect(answers).toEqual([null, null, null, null, null, null]);
    // `channelOfMicLine` takes lines that STATE their channel (register E20; D61): a list without
    // channels is a compile error, not an answer by position.
    // @ts-expect-error a line without a channel is not a `ChannelMicLine`
    const unstated: readonly ChannelMicLine[] = [{ inputId: 'MIC-01' }, { inputId: 'MIC-02' }];
    // Whatever reaches it untyped: no line names the input, so no channel - not channel 1 and 2 by place.
    expect([channelOfMicLine(unstated, 'MIC-01'), channelOfMicLine([], 'MIC-01')]).toEqual([null, null]);
  });

  const withSelector = (h: ReturnType<typeof harness>, mics: SimState['captureConfig']['mics']) =>
    h.sim.store.setState({ captureConfig: { ...h.state().captureConfig, mics } });
  const seeded = (h: ReturnType<typeof harness>) => h.state().captureConfig.mics;

  it('`activeMeterChannel`: the active input among the lines; the channel LABEL 1 when it has no channel or none is active', () => {
    const h = harness('idle');
    expect(activeMeterChannel(h.state())).toBe('AUDIO-01');
    expect(activeMeterChannel({ ...h.state(), audio: { ...h.state().audio, activeInputId: 'MIC-02' } })).toBe('AUDIO-02');
    // No active input (what the slice holds without a channel-1 line): no lookup, the label.
    const noneActive: SimState = { ...h.state(), audio: { ...h.state().audio, activeInputId: null } };
    expect(activeMeterChannel(noneActive)).toBe('AUDIO-01');
    // An active input that no line carries: no channel, the label (D61: the input of a lone
    // channel-3 line reads its OWN channel, AUDIO-03 — not the label).
    const lone = { ...h.state(), captureConfig: { ...h.state().captureConfig, mics: [seeded(h)[2]!] }, audio: { ...h.state().audio, activeInputId: 'MIC-02' } };
    expect(activeMeterChannel(lone)).toBe('AUDIO-01');
    expect(meterInputOfChannel(lone.captureConfig.mics, activeMeterChannel(lone))).toBeNull();
    const ownChannel = { ...h.state(), captureConfig: { ...h.state().captureConfig, mics: [seeded(h)[2]!] }, audio: { ...h.state().audio, activeInputId: 'MIC-03' } };
    expect(activeMeterChannel(ownChannel)).toBe('AUDIO-03');
  });

  it('the subsystem: no frame for a channel without a line, and no frame under a built-in name', () => {
    const h = harness('idle');
    h.run(200);
    expect(Object.keys(h.state().audio.inputs).sort()).toEqual(['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']); // D61: four seeded lines
    expect(h.state().audio.activeInputId).toBe('MIC-01');

    // A selector that keeps ONLY channel 2: D61 per-channel — channel 2 has its frame, the others none.
    withSelector(h, seeded(h).filter((mic) => mic.channel === 'MIC-02'));
    h.run(200);
    expect(Object.keys(h.state().audio.inputs)).toEqual(['MIC-02']);
    // The register's answer (no channel-1 line): the state holds NO active input. It is not the
    // input it held, not the lone channel-2 line and not a line by position (task 4 row 149).
    expect(h.state().audio.activeInputId).toBeNull();

    // No microphone line: no frame either.
    withSelector(h, []);
    h.run(200);
    expect(h.state().audio.inputs).toEqual({});
  });

  it('the subsystem: a selector that no longer holds the active input reads its channel-1 line, by channel', () => {
    const h = harness('idle');
    h.run(100);
    // MIC-03 / MIC-04 with channel 1 on the SECOND line: position 0 is channel 2.
    withSelector(h, [
      { ...seeded(h)[0]!, channel: 'MIC-02', inputId: 'MIC-04', deviceId: 'MIC-04' },
      { ...seeded(h)[1]!, channel: 'MIC-01', inputId: 'MIC-03', deviceId: 'MIC-03' },
    ]);
    h.run(100);
    expect(Object.keys(h.state().audio.inputs).sort()).toEqual(['MIC-03', 'MIC-04']);
    expect(h.state().audio.activeInputId).toBe('MIC-03');
  });

  it('Simulated mode on the seeded selector: the lookup answers the table of the four built-in channels, as before', () => {
    const h = harness('recording');
    const lines = seeded(h);
    expect(lines.map((mic) => [mic.inputId, mic.channel])).toEqual([['MIC-01', 'MIC-01'], ['MIC-02', 'MIC-02'], ['MIC-03', 'MIC-03'], ['MIC-04', 'MIC-04']]); // D61
    for (const channel of ['AUDIO-01', 'AUDIO-02', 'AUDIO-03', 'AUDIO-04'] as const) {
      expect(meterInputOfChannel(lines, channel)).toBe(DEFAULT_MIC_INPUT_OF_CHANNEL[channel]);
    }
    h.run(1_000);
    expect(h.frames['AUDIO-01']).toHaveLength(20);
    expect(h.frames['AUDIO-02']).toHaveLength(20);
    expect(h.frames['AUDIO-03']).toHaveLength(20); // D61
    expect(h.frames['AUDIO-04']).toHaveLength(20); // D61
    expect(h.state().audio.activeInputId).toBe(micInputOfChannel(lines, 'MIC-01'));
  });
});

// Task 4 row 172 (WP-13a; decisions C18 (2); row 27 site C15), re-pinned by D61 (2026-11-04): what
// stays out is the POSITIONAL FALLBACK call shape - the by-channel lookup applied to a meter TRACK
// as its second argument ("the input of a meter channel is the line at that place, else a built-in
// input"). The NAME of the lookup stays: D61 renamed the roles to the numbered channels and the
// apps lane reads through it. So the scan reads every source and test file of the four workspaces
// that resolved a microphone through the old function (24 non-test files at row 27's measurement)
// and holds them to 0 calls of that shape, comments included: a planted call is how it comes back.
describe('the positional microphone lookup stays deleted (static; task 4 row 172; re-pinned by D61 of 2026-11-04)', () => {
  /** The lookup's name, built from parts so no line of this file spells the banned call shape. */
  const LOOKUP_NAME = ['mic', 'Input', 'Of', 'Channel'].join('');
  /** The banned shape: the lookup applied with an `AUDIO` track as its second argument. */
  const FORBIDDEN_SHAPE = new RegExp(`\\b${LOOKUP_NAME}\\b\\s*\\([^)]*['"]AUDIO-0`);
  const REPOSITORY = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  /** The four source trees of row 27: each workspace's sources AND its tests. */
  const TREES = ['apps/core-server', 'apps/core-web', 'apps/mobile', 'packages/shared'] as const;
  const SKIPPED = new Set(['node_modules', 'dist', 'build', 'coverage', '.expo', '.turbo', '.cache', 'android', 'ios']);

  const sourcesOf = (tree: string): string[] => {
    const found: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        if (SKIPPED.has(name)) continue;
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(?:[cm]?[jt]sx?)$/.test(name)) found.push(path);
      }
    };
    walk(join(REPOSITORY, tree));
    return found;
  };
  /** `file:line` of every place a text calls the lookup with a meter-track argument. */
  const namesIn = (file: string, text: string): string[] =>
    text
      .split('\n')
      .flatMap((line, index) => (FORBIDDEN_SHAPE.test(line) ? [`${file}:${index + 1}`] : []));

  const scanned = TREES.map((tree) => ({ tree, files: sourcesOf(tree) }));

  it('the scan reads the four trees: hundreds of files each, the definition\'s home and its three client readers among them', () => {
    for (const { tree, files } of scanned) expect(files.length, tree).toBeGreaterThan(200);
    for (const path of [
      'packages/shared/src/sim/audio.ts',
      'apps/core-server/src/modules/devices/status.ts',
      'apps/core-web/src/features/session-monitor/audio-source.ts',
      'apps/mobile/src/features/session-live/mic-source-model.ts',
    ]) {
      expect(existsSync(join(REPOSITORY, path)), path).toBe(true);
      expect(scanned.some(({ files }) => files.includes(join(REPOSITORY, path))), path).toBe(true);
    }
  });

  it('0 files of the four source trees spell the banned call shape (24 non-test files went through it at row 27; D61: the name may stand, the track argument may not)', () => {
    const places = scanned.flatMap(({ files }) => files.flatMap((path) => namesIn(relative(REPOSITORY, path), readFileSync(path, 'utf8'))));
    expect(places).toEqual([]);
  });

  it('the shared sim barrel exports the by-channel lookup under its name (D61: the name stays) and the track-side reader beside it', async () => {
    const sim: Record<string, unknown> = await import('../src/sim');
    // D61 (2026-11-04): the apps lane reads through this name; only the positional call shape is out.
    expect(typeof sim[LOOKUP_NAME]).toBe('function');
    expect(typeof sim['micInputOfRole']).toBe('function');
    expect(typeof sim['meterInputOfChannel']).toBe('function');
  });

  it('CONTROL: a planted banned call is found; the bare name, a comment, a longer identifier and a by-channel call are not', () => {
    const planted = [
      `const input = ${LOOKUP_NAME}(lines, 'AUDIO-01');`,
      `import { ${LOOKUP_NAME} } from '@dems/shared/sim';`,
      `// the input is what ${LOOKUP_NAME} answers`,
      `const other = ${LOOKUP_NAME}Legacy(lines, 'AUDIO-01');`,
      `const right = ${LOOKUP_NAME}(lines, 'MIC-01');`,
    ].join('\n');
    expect(namesIn('planted.ts', planted)).toEqual(['planted.ts:1']);
  });
});
