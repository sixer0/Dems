// What a device command does OVER TIME, on the booted server against PostgreSQL (plan row W36,
// rule 3 of the row; spec §7.10, §8.1, §8.7).
//
// A command's effect over time is the simulator's, on the engine's ticks: the module answers
// 204 and nothing more. Here the engine is driven with a manual clock and a manual timer, and
// each effect is held against the shared simulator in two ways:
//
//   the reference simulator   a headless `Sim` of the shared core on a manual clock, given the
//                             SAME sequence of commands and ticks: what its meters and its
//                             audit trail do is what the server's must do;
//   the pure transition       the shared `deviceCommandTransition` applied to the server's own
//                             committed state before each command: the row it builds is the row
//                             the server stored, field for field and hash for hash.
//
// The preparation of a clipping microphone runs the hosted actions `inject` and `clearFault`
// through `app.engine.command`: the demo-control routes are another row's.
import {
  AUDIO_CLIP_BURST_DBFS,
  AUDIO_FRAME_MS,
  AUDIO_NOISE_FLOOR_DBFS,
  AUDIO_NOISE_FLOOR_SPREAD_DB,
  AUDIO_RELEASE_DB_PER_S,
  AUDIO_TEST_TONE_DBFS,
  AUDIO_TEST_TONE_MS,
  createAudioRuntime,
  deviceCommandTransition,
  type AudioFrame,
  type AuditRow,
  type DeviceCommand,
  type OperatorRole,
  type SimState,
} from '@dems/shared/sim';
import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { linkProblems, readHead, readTrail, verifyTrail } from '../../../../test/support/core';
import { createHost, type Host } from '../../../../test/support/seed';
import { actorAuth } from '../../../engine';
import { DEVICE_COMMAND_OF_OPERATION, type DeviceCommandOperation } from '../index';
import { AUDIO, CLIP_RESET, devicesApp, identify, restart, testSignal, type DevicesApp } from './support';

const db = useTestDatabase({ template: 'seed' });
let server: DevicesApp;

const NOISE_LOW = AUDIO_NOISE_FLOOR_DBFS - AUDIO_NOISE_FLOOR_SPREAD_DB;
const NOISE_HIGH = AUDIO_NOISE_FLOOR_DBFS + AUDIO_NOISE_FLOOR_SPREAD_DB;
/** One frame of release, in dB: 20 dB/s at 20 Hz. */
const RELEASE_PER_FRAME_DB = (AUDIO_RELEASE_DB_PER_S * AUDIO_FRAME_MS) / 1_000;
const atNoiseFloor = (level: number): boolean => level >= NOISE_LOW - 0.01 && level <= NOISE_HIGH + 0.01;

const URL_OF: Readonly<Record<DeviceCommand, (id: string) => string>> = { RESTART: restart, TEST_SIGNAL: testSignal, IDENTIFY: identify };

beforeAll(async () => {
  server = await devicesApp(db);
  // One second of ticks first: the meters have left their initial frame.
  await server.drive(1_000);
});

/** A reference simulator at the server's instant, one second into its run, as the server is. */
async function referenceAt(now: number): Promise<Host> {
  const reference = await createHost({ scenario: 'idle', startAt: now - 1_000 });
  reference.drive(1_000);
  expect(reference.now()).toBe(now);
  return reference;
}

/** The devices of the Core in the committed state: the four slices a device command could touch. */
const devicesOf = (state: Pick<SimState, 'cameras' | 'mics' | 'otherDevices' | 'ports' | 'activeCameraId'>) => ({
  cameras: state.cameras,
  mics: state.mics,
  otherDevices: state.otherDevices,
  ports: state.ports,
  activeCameraId: state.activeCameraId,
});

/** An audit row without its place in a chain: what two trails of different length can share. */
const content = (row: AuditRow) => ({
  at: row.at,
  type: row.type,
  category: row.category,
  severity: row.severity,
  actorId: row.actorId,
  message: row.message,
  sessionId: row.sessionId ?? null,
  evidenceId: row.evidenceId ?? null,
  deviceId: row.deviceId ?? null,
  details: row.details,
});

/** The whole row, as stored and as the simulator builds it. */
const whole = (row: AuditRow) => ({ seq: row.seq, id: row.id, ...content(row), prevHash: row.prevHash, hash: row.hash });

describe('testDeviceSignal: the two seconds of the tone are the simulator\'s', () => {
  it('the meter of AUDIO-01 holds -18 dBFS for 2 s and falls back to the noise floor at 20 dB/s, frame for frame as the reference simulator; AUDIO-02 never moves', async () => {
    const t0 = server.clock.now();
    const reference = await referenceAt(t0);
    const devicesBefore = devicesOf(server.engine.state());
    const rowsBefore = await server.trailLength();
    const framesBefore = server.meterFrames().length;

    const response = await server.post('INVESTIGATOR', testSignal('MIC-01'));
    expect(response.statusCode).toBe(204);
    reference.runAs(reference.operator('INVESTIGATOR'), () => reference.sim.actions.deviceCommand('MIC-01', 'TEST_SIGNAL'));

    // While the tone plays, half a second in: the newest meter frame holds it, and the read of
    // operation 45 answers the levels of that frame (`app.engine.meters()`; BE-GAP-W36-1 is closed).
    await server.drive(500);
    const live = server.meterFrames().at(-1)?.audio.channels['AUDIO-01'];
    const read = (await server.get('INVESTIGATOR', AUDIO)).json() as { channels: Array<{ trackId: string; dbfs: number; peak: number }> };
    expect(Math.abs((live?.dbfs ?? 0) - AUDIO_TEST_TONE_DBFS)).toBeLessThanOrEqual(1);
    expect(server.engine.meters()).toBe(server.meterFrames().at(-1));
    expect(live).toBeDefined();
    expect(read.channels[0]).toMatchObject({ trackId: 'AUDIO-01', dbfs: live?.dbfs, peak: live?.peak });
    expect(read.channels[0]?.dbfs).not.toBe(AUDIO_NOISE_FLOOR_DBFS);

    const TOTAL_MS = 4_500;
    await server.drive(TOTAL_MS - 500);
    const frames = server.meterFrames().slice(framesBefore);
    const referenceFrames: Array<Record<'AUDIO-01' | 'AUDIO-02', AudioFrame>> = [];
    for (let elapsed = 0; elapsed < TOTAL_MS; elapsed += AUDIO_FRAME_MS) {
      reference.drive(AUDIO_FRAME_MS);
      referenceFrames.push(reference.state().audio.channels);
    }

    // One frame per tick, gap-free, stamped on the 50 ms grid of the server clock.
    expect(frames).toHaveLength(TOTAL_MS / AUDIO_FRAME_MS);
    expect(frames.map((frame) => frame.audio.channels['AUDIO-01'].at)).toEqual(frames.map((_, index) => t0 + (index + 1) * AUDIO_FRAME_MS));
    expect(referenceFrames.map((channels) => channels['AUDIO-01'].at)).toEqual(frames.map((frame) => frame.audio.channels['AUDIO-01'].at));

    const mic1 = frames.map((frame) => frame.audio.channels['AUDIO-01']);
    const mic2 = frames.map((frame) => frame.audio.channels['AUDIO-02']);
    const tone = mic1.filter((frame) => frame.at < t0 + AUDIO_TEST_TONE_MS);
    const after = mic1.filter((frame) => frame.at >= t0 + AUDIO_TEST_TONE_MS);

    // 1. The tone: every frame before t0 + 2 s is at the tone level.
    expect(tone).toHaveLength(AUDIO_TEST_TONE_MS / AUDIO_FRAME_MS - 1);
    for (const frame of tone) expect(Math.abs(frame.dbfs - AUDIO_TEST_TONE_DBFS), `tone frame at +${frame.at - t0} ms`).toBeLessThanOrEqual(1);
    // 2. The release: one dB per frame, never upwards, until the noise floor; then it stays there.
    const lastTone = tone.at(-1)?.dbfs ?? 0;
    after.forEach((frame, index) => {
      const released = lastTone - (index + 1) * RELEASE_PER_FRAME_DB;
      if (released > NOISE_HIGH) expect(frame.dbfs, `release frame ${index}`).toBeCloseTo(released, 1);
      else expect(atNoiseFloor(frame.dbfs), `frame at +${frame.at - t0} ms: ${frame.dbfs}`).toBe(true);
    });
    const releaseMs = ((AUDIO_TEST_TONE_DBFS - NOISE_LOW) / AUDIO_RELEASE_DB_PER_S) * 1_000;
    const settled = mic1.filter((frame) => frame.at >= t0 + AUDIO_TEST_TONE_MS + releaseMs + 200);
    expect(settled.length).toBeGreaterThanOrEqual(10);
    expect(settled.every((frame) => atNoiseFloor(frame.dbfs))).toBe(true);
    // 3. The other channel, and both latches, never move.
    expect(mic2.every((frame) => atNoiseFloor(frame.dbfs))).toBe(true);
    expect([...mic1, ...mic2].some((frame) => frame.clip || frame.noSignal)).toBe(false);

    // 4. As the simulator: the same frames carry the tone, the same frames have settled, and no
    //    frame differs by more than the two draws of noise can (the streams of the two engines
    //    are seeded apart: the server's by its epoch).
    const referenceMic1 = referenceFrames.map((channels) => channels['AUDIO-01']);
    const loud = (frame: AudioFrame): boolean => frame.dbfs > AUDIO_TEST_TONE_DBFS - 1;
    const loudFrames = mic1.filter(loud).length;
    expect(Math.abs(loudFrames - referenceMic1.filter(loud).length)).toBeLessThanOrEqual(1);
    mic1.forEach((frame, index) => {
      const expected = referenceMic1[index];
      if (expected === undefined) throw new Error(`the reference has no frame ${index}`);
      const tolerance = frame.at < t0 + AUDIO_TEST_TONE_MS + releaseMs ? 1.5 : NOISE_HIGH - NOISE_LOW + 0.01;
      expect(Math.abs(frame.dbfs - expected.dbfs), `dbfs of the frame at +${frame.at - t0} ms`).toBeLessThanOrEqual(tolerance);
    });
    // Both have settled by the same frame: the first frame from which every later one is at the noise floor.
    const settledFrom = (list: readonly AudioFrame[]): number => list.length - [...list].reverse().findIndex((frame) => !atNoiseFloor(frame.dbfs));
    expect(Math.abs(settledFrom(mic1) - settledFrom(referenceMic1))).toBeLessThanOrEqual(2);
    expect(atNoiseFloor(referenceMic1.at(-1)?.dbfs ?? 0)).toBe(true);
    expect(atNoiseFloor(mic1.at(-1)?.dbfs ?? 0)).toBe(true);

    // 5. Durable: one audit row, and no slice of the devices changed, at the command or after it.
    const rows = await server.since(rowsBefore);
    expect(rows.map((row) => [row.type, row.deviceId, row.details, row.at])).toEqual([['DEVICE_COMMAND', 'MIC-01', { command: 'TEST_SIGNAL' }, t0]]);
    expect(devicesOf(server.engine.state())).toStrictEqual(devicesBefore);
    expect(reference.state().audit.rows.slice(-1).map((row) => [row.type, row.deviceId, row.details, row.at])).toEqual([['DEVICE_COMMAND', 'MIC-01', { command: 'TEST_SIGNAL' }, t0]]);

    const sample = (list: readonly AudioFrame[], ms: number): number | undefined => list.find((frame) => frame.at === t0 + ms)?.dbfs;
    const marks = [50, 1_000, 1_950, 2_000, 2_500, 3_000, 3_750, 4_500];
    console.info(
      `[w36] test tone on MIC-01, dBFS of AUDIO-01 at +ms ${marks.join(', ')}: server ${marks.map((ms) => sample(mic1, ms)).join(', ')}; ` +
        `reference simulator ${marks.map((ms) => sample(referenceMic1, ms)).join(', ')}; frames above ${AUDIO_TEST_TONE_DBFS - 1} dBFS: ${loudFrames} and ${referenceMic1.filter(loud).length}; ` +
        `GET /audio/status during the tone: ${read.channels[0]?.dbfs} (the newest meter frame)`,
    );
  });
});

describe('the audit rows of a sequence of device commands equal the simulator\'s for the same sequence', () => {
  const SEQUENCE: ReadonlyArray<readonly [role: OperatorRole, deviceId: string, operationId: DeviceCommandOperation, thenMs: number]> = [
    ['INVESTIGATOR', 'MIC-01', 'testDeviceSignal', 500],
    ['SUPERVISOR', 'GNSS', 'identifyDevice', 250],
    ['TECHNICIAN', 'CAM-02', 'restartDevice', 1_000],
    ['TECHNICIAN', 'POE-SWITCH', 'restartDevice', 50],
    ['SUPERVISOR', 'FRONT-PANEL', 'identifyDevice', 300],
    ['INVESTIGATOR', 'MIC-02', 'identifyDevice', 100],
    ['TECHNICIAN', 'CAM-01', 'testDeviceSignal', 2_000],
    ['SUPERVISOR', 'TPM', 'identifyDevice', 150],
    ['TECHNICIAN', 'TABLET', 'restartDevice', 3_000],
  ];

  it('nine commands of three operators with ticks in between: each stored row is the row the shared transition builds on the committed state, hash for hash; the trail equals the reference simulator\'s, row for row', async () => {
    const start = server.clock.now();
    const reference = await referenceAt(start);
    const referenceRowsBefore = reference.state().audit.total;
    const rowsBefore = await server.trailLength();
    const devicesBefore = devicesOf(server.engine.state());
    const referenceDevicesBefore = devicesOf(reference.state());

    const expectedRows: AuditRow[] = [];
    for (const [role, deviceId, operationId, thenMs] of SEQUENCE) {
      const command = DEVICE_COMMAND_OF_OPERATION[operationId];
      const principal = server.principal(role);
      const at = server.clock.now();
      // The simulator's own transition on what the server holds, with this caller as the actor.
      const committed = server.engine.state();
      const built = deviceCommandTransition({ ...committed, auth: actorAuth(principal.operatorId, at) } as SimState, at, deviceId, command, createAudioRuntime());
      const expected = built.audit.rows.at(-1);
      if (expected === undefined) throw new Error('the transition appended no row');
      expectedRows.push(expected);

      const before = await server.trailLength();
      const response = await server.post(role, URL_OF[command](deviceId));
      expect(response.statusCode, `${operationId} ${deviceId}`).toBe(204);
      const stored = await server.since(before);
      expect(stored.map(whole), `${operationId} ${deviceId}`).toEqual([whole(expected)]);
      // And the committed state moved exactly as the transition says: the audit slice, nothing else.
      expect(server.engine.slice('audit')).toMatchObject({ head: built.audit.head, total: built.audit.total });
      expect(devicesOf(server.engine.state())).toStrictEqual(devicesOf(committed));

      reference.runAs(reference.operator(role), () => reference.sim.actions.deviceCommand(deviceId, command));
      await server.drive(thenMs);
      reference.drive(thenMs);
    }

    await server.app.pipeline.drain();
    const stored = await server.since(rowsBefore);
    const referenceRows = reference.state().audit.rows.slice(referenceRowsBefore - reference.state().audit.dropped);
    // The same rows in the same order, the ticks in between included: nothing else was written by either.
    expect(stored.map(content)).toEqual(referenceRows.map(content));
    expect(stored.map(whole)).toEqual(expectedRows.map(whole));
    expect(stored).toHaveLength(SEQUENCE.length);
    expect(stored.map((row) => row.message)).toEqual([
      'Test signal sent to MIC 1 – Interviewer (simulated)',
      'Identify sent to GNSS Receiver (indicator blinks 3×, simulated)',
      'Camera 2 restarted (simulated)',
      'PoE Switch restarted (simulated)',
      'Identify sent to Front Panel (LCD and LEDs) (indicator blinks 3×, simulated)',
      'Identify sent to MIC 2 – Subject (indicator blinks 3×, simulated)',
      'Test signal sent to Camera 1 (simulated)',
      'Identify sent to TPM 2.0 / Secure Element (indicator blinks 3×, simulated)',
      'Tablet Control restarted (simulated)',
    ]);
    expect(stored.map((row) => row.actorId)).toEqual(SEQUENCE.map(([role]) => server.principal(role).operatorId));

    // A restart, a test signal and an identify leave the devices as they were, after every tick,
    // on the server as on the simulator (the simulated restart is complete with its row).
    expect(devicesOf(server.engine.state())).toStrictEqual(devicesBefore);
    expect(devicesOf(reference.state())).toStrictEqual(referenceDevicesBefore);

    const rows = await readTrail(server.owner);
    const head = await readHead(server.owner);
    expect(linkProblems(rows)).toEqual([]);
    expect(verifyTrail(rows, head)).toEqual({ ok: true, checked: rows.length, head: head.hash });
    console.info(
      `[w36] ${SEQUENCE.length} device commands over ${(server.clock.now() - start) / 1_000} s of ticks: ${stored.length} stored audit rows = the shared transition's (seq, id, at, type, actor, device, message, details, prevHash, hash) ` +
        `= the reference simulator's ${referenceRows.length} rows (at, type, category, severity, actor, device, message, details); chain ok over ${rows.length} rows`,
    );
  });
});

describe('resetMicClip: the latch over time is the simulator\'s', () => {
  it('a reset clears the latch; while the microphone still clips the next burst sets it again; once the fault is cleared a reset holds', async () => {
    const start = server.clock.now();
    const reference = await referenceAt(start);
    const supervisor = server.principal('SUPERVISOR');
    const latch = (): boolean | undefined => server.engine.slice('mics').find((mic) => mic.id === 'AUDIO-01')?.clipLatched;
    const referenceLatch = (): boolean | undefined => reference.state().mics.find((mic) => mic.id === 'AUDIO-01')?.clipLatched;
    const channel = async (): Promise<{ state: string; clip: boolean; dbfs: number; peak: number }> =>
      ((await server.get('TECHNICIAN', AUDIO)).json() as { channels: Array<{ state: string; clip: boolean; dbfs: number; peak: number }> }).channels[0]!;
    // The two levels of a read are those of the newest meter frame (`app.engine.meters()`): the frame the socket sent last.
    const frameLevels = (): { dbfs: number; peak: number } => {
      const frame = server.engine.meters()?.audio.channels['AUDIO-01'];
      if (frame === undefined) throw new Error('the engine has produced no meter frame');
      return { dbfs: frame.dbfs, peak: frame.peak };
    };
    const rowsBefore = await server.trailLength();
    const referenceRowsBefore = reference.state().audit.total;

    // Preparation: the microphone clips (the hosted `inject`; the demo routes are another row's).
    await server.engine.command(supervisor, 'inject', 'MIC_CLIP', { channel: 'AUDIO-01' });
    reference.runAs(reference.operator('SUPERVISOR'), () => reference.sim.actions.inject('MIC_CLIP', { channel: 'AUDIO-01' }));
    expect([latch(), referenceLatch()]).toEqual([true, true]);
    // The state and the latch are the committed ones, at once; the levels are still those of the frame before the
    // command, and the burst is in the first frame after it.
    expect(await channel()).toEqual({ ...(await channel()), state: 'CLIP', clip: true, ...frameLevels() });
    expect(atNoiseFloor((await channel()).dbfs)).toBe(true);

    // 1. The reset clears the latch at once, for every console, and writes no audit row (NONE-P).
    const trail = await server.trailLength();
    const reset = await server.post('INVESTIGATOR', CLIP_RESET, { channel: 'AUDIO-01' });
    expect(reset.statusCode).toBe(204);
    reference.sim.actions.resetClip('AUDIO-01');
    expect([latch(), referenceLatch()]).toEqual([false, false]);
    const change = server.stateChanges().at(-1);
    expect(change?.ops.map((op) => [op.op, op.slice])).toEqual([['replace', 'mics']]);
    expect(Number(reset.headers['x-dems-revision'])).toBe(change?.revision);
    expect(await server.trailLength()).toBe(trail);
    expect(await channel()).toMatchObject({ state: 'CLIP', clip: false });
    // The other channel was not touched.
    expect(server.engine.slice('mics')[1]).toMatchObject({ id: 'AUDIO-02', clipLatched: false, state: 'READY' });

    // 2. The fault is still active: the next burst (at most 1.2 s away) latches again, on both.
    await server.drive(2_500);
    reference.drive(2_500);
    expect([latch(), referenceLatch()]).toEqual([true, true]);
    expect(await channel()).toMatchObject({ state: 'CLIP', clip: true, ...frameLevels() });
    // A burst was read from a frame: within 2.5 s of the fault at least one frame held the burst level.
    expect(server.meterFrames().some((frame) => frame.audio.channels['AUDIO-01'].dbfs === AUDIO_CLIP_BURST_DBFS)).toBe(true);

    // 3. The fault is cleared: the latch stays until someone resets it; then it stays clear.
    await server.engine.command(supervisor, 'clearFault', 'MIC_CLIP', { channel: 'AUDIO-01' });
    reference.runAs(reference.operator('SUPERVISOR'), () => reference.sim.actions.clearFault('MIC_CLIP', { channel: 'AUDIO-01' }));
    expect([latch(), referenceLatch()]).toEqual([true, true]);
    expect(await channel()).toMatchObject({ state: 'READY', clip: true, ...frameLevels() });

    expect((await server.post('TECHNICIAN', CLIP_RESET, { channel: 'AUDIO-01' })).statusCode).toBe(204);
    reference.sim.actions.resetClip('AUDIO-01');
    await server.drive(3_000);
    reference.drive(3_000);
    expect([latch(), referenceLatch()]).toEqual([false, false]);
    expect(await channel()).toMatchObject({ state: 'READY', clip: false, ...frameLevels() });
    expect(atNoiseFloor((await channel()).dbfs)).toBe(true);
    expect(server.engine.slice('mics')).toStrictEqual(reference.state().mics);

    // The two resets wrote no row: the trail holds what the fault wrote, as the simulator's does.
    await server.app.pipeline.drain();
    const stored = await server.since(rowsBefore);
    const referenceRows = reference.state().audit.rows.slice(referenceRowsBefore - reference.state().audit.dropped);
    expect(stored.map((row) => row.type)).toEqual(referenceRows.map((row) => row.type));
    expect(stored.map(content)).toEqual(referenceRows.map(content));
    expect(stored.some((row) => row.type === 'DEVICE_COMMAND')).toBe(false);
    const rows = await readTrail(server.owner);
    expect(verifyTrail(rows, await readHead(server.owner))).toMatchObject({ ok: true });
    expect(server.log.lines().filter((line) => Number(line['level']) >= 50)).toEqual([]);
    console.info(`[w36] resetMicClip over ${(server.clock.now() - start) / 1_000} s: latch true, reset false, next burst true, fault cleared true, reset false and stays; audit types since: ${stored.map((row) => row.type).join(', ')} (the simulator's)`);
  });
});
