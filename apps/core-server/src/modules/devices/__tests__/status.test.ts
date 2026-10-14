// The answers of the four device reads, as pure functions over a committed state (plan row W36;
// spec §7.10 operations 44 to 47, §7.1 API-5 and API-6). No app, no database.
//
// Operations 44, 45 and 46 are design-book operations: in Simulated mode the in-app simulator
// answers them (`handleSimApiRequest`). Here each answer of the module is held against that
// handler on the SAME state, member by member, so Live mode cannot drift from Simulated mode in
// what a read says. The one difference is stated and measured: the 20 Hz meter levels, which
// are no part of the committed state (a recorded difference, ruled by D89; formerly gap BE-GAP-W36-1).
import { AUDIO_FRAME_NOT_MEASURED_EXAMPLE, AudioStatusResponseSchema, DeviceHealthResponseSchema, DeviceInventorySchema, VideoStatusResponseSchema, validateCoreApiResponse } from '@dems/shared/api';
import {
  AUDIO_CLIP_BURST_DBFS,
  AUDIO_FLOOR_DBFS,
  AUDIO_NOISE_FLOOR_DBFS,
  FaultKind,
  clearFaultTransition,
  createManualClock,
  handleSimApiRequest,
  injectFaultTransition,
  toWibIso,
  type FaultTarget,
  type SimActions,
  type SimState,
  type SimStore,
  ownCaptureCoreFactsTransition,
} from '@dems/shared/sim';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DURABLE_SLICE_KEYS, UNMAPPED_SLICES } from '../../../db/mapping';
import { SCENARIOS, createHost } from '../../../../test/support/seed';
import { streamProfileOf } from '../../../sealing-host';
import { activeInputOf, audioStatusOf, cameraStreamFactsOf, captureSlotsOf, deviceHealthOf, deviceInventoryOf, stateLevelsOf, storageStatusOf, videoStatusOf, withCameraStreamFacts, type CommittedState } from '../index';
import { AUDIO, FIXED_NOW, HEALTH, VIDEO, committedOf, scenarioState } from './support';

/** The read is a little later than the state: `serverTime` is the clock's, not the state's. */
const NOW = FIXED_NOW + 4_321;

/** What the in-app simulator answers for a GET on this state at `now`: its own handler, called as Simulated mode calls it. */
function simulatorAnswer(state: SimState, path: string, now: number = NOW): unknown {
  const response = handleSimApiRequest(
    // A GET of the simulator's handler reads the state and the clock and calls no action.
    { store: { getState: () => state } as unknown as SimStore, actions: {} as SimActions, clock: createManualClock(now) },
    { method: 'GET', path },
  );
  if (response.status !== 200) throw new Error(`the simulator answered ${response.status} for ${path}`);
  return response.body;
}

/** What each fault is aimed at, where it takes a target. */
const FAULT_TARGETS: Partial<Record<FaultKind, FaultTarget>> = {
  MIC_NO_SIGNAL: { channel: 'AUDIO-01' },
  MIC_CLIP: { channel: 'AUDIO-02' },
  CAMERA_LOSS: { cameraId: 'VIDEO-01' },
  GNSS_LOSS: { fallback: 'RTC' },
};

/** An answer without the two meter levels of each audio channel. */
function withoutLevels<Answer>(answer: Answer): Answer {
  return JSON.parse(JSON.stringify(answer), (key: string, value: unknown) => (key === 'dbfs' || key === 'peak' ? undefined : value)) as Answer;
}

const deepFreeze = <Value>(value: Value): Value => {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const member of Object.values(value)) deepFreeze(member);
  }
  return value;
};

describe('operations 44, 45, 46: the answer is the in-app simulator\'s on the same state', () => {
  it.each(SCENARIOS)('scenario %s: device health, audio status and video status equal the simulator\'s handler, member for member', (name) => {
    const state = scenarioState(name);
    const committed = committedOf(state);

    const health = deviceHealthOf(committed, NOW);
    const audio = audioStatusOf(committed, NOW);
    const video = videoStatusOf(committed);
    expect(health).toEqual(simulatorAnswer(state, HEALTH));
    expect(audio).toEqual(simulatorAnswer(state, AUDIO));
    expect(video).toEqual(simulatorAnswer(state, VIDEO));

    // And each is an answer of the contract, as the route's serializer and a client parse it.
    expect(validateCoreApiResponse('getDeviceHealth', 200, health)).toEqual({ ok: true });
    expect(validateCoreApiResponse('getAudioStatus', 200, audio)).toEqual({ ok: true });
    expect(validateCoreApiResponse('getVideoStatus', 200, video)).toEqual({ ok: true });
    expect(DeviceHealthResponseSchema.parse(health)).toEqual(health);
    expect(AudioStatusResponseSchema.parse(audio)).toEqual(audio);
    expect(VideoStatusResponseSchema.parse(video)).toEqual(video);
  });

  it('the scenarios cover what the answers can say: a ready Core, a recording, a lost camera, a clipping mic, a time fallback', () => {
    const idle = deviceHealthOf(committedOf(scenarioState('idle')), NOW);
    expect(idle.systemState).toBe('READY');
    expect(idle.flags).toEqual([]);
    expect(idle.cameras.map((camera) => [camera.trackId, camera.deviceId, camera.lens, camera.online, camera.recState])).toEqual([
      ['VIDEO-01', 'CAM-01', 'READY', true, null],
      ['VIDEO-02', 'CAM-02', 'READY', true, null],
    ]);
    expect(idle.audio.map((channel) => [channel.inputId, channel.deviceId, channel.role, channel.state, channel.recState, channel.clip, channel.noSignal])).toEqual([
      ['MIC-01', 'MIC-01', 'PRIMARY', 'READY', null, false, false],
      ['MIC-02', 'MIC-02', 'STANDBY', 'READY', null, false, false],
    ]);
    expect(idle.activeInputId).toBe('MIC-01');
    expect(idle.services).toHaveLength(17);

    const recording = deviceHealthOf(committedOf(scenarioState('recording')), NOW);
    expect(recording.systemState).toBe('RECORDING');
    expect(recording.cameras.map((camera) => camera.recState)).toEqual(['REC', 'REC']);
    expect(recording.audio.map((channel) => channel.recState)).toEqual(['REC', 'REC']);

    const faults = deviceHealthOf(committedOf(scenarioState('fault-demo')), NOW);
    expect(faults.systemState).toBe('CRITICAL');
    expect(faults.flags.map((flag) => flag.id)).toEqual(expect.arrayContaining(['CAMERA_VIDEO-02', 'MIC_AUDIO-02_CLIP', 'TIME_FALLBACK']));
    expect(faults.cameras[1]).toMatchObject({ trackId: 'VIDEO-02', lens: 'FAULT', online: false, recState: 'LOST' });
    expect(faults.audio[1]).toMatchObject({ inputId: 'MIC-02', state: 'CLIP', recState: 'DEGRADED', clip: true, noSignal: false });
    expect(faults.time.source).not.toBe('GNSS');
  });

  it('fix wave J (JW-04 / JT-03, JW-08): a Core in its own capture says `platformNotReported` beside the TPM placeholders, and "not measured" for a level it does not measure', () => {
    const own = ownCaptureCoreFactsTransition(scenarioState('idle'));
    const committed = committedOf(own);
    const health = deviceHealthOf(committed, NOW);
    expect(health.security).toMatchObject({ platformNotReported: true });
    expect(health).toEqual(simulatorAnswer(own, HEALTH));
    expect(validateCoreApiResponse('getDeviceHealth', 200, health)).toEqual({ ok: true });
    // The meter frame of a Core at rest: not measured - and the answer says so, never "no signal".
    const frame = { audio: { inputs: { 'MIC-01': { ...AUDIO_FRAME_NOT_MEASURED_EXAMPLE }, 'MIC-02': { ...AUDIO_FRAME_NOT_MEASURED_EXAMPLE } }, activeInputId: 'MIC-01' } } as unknown as Parameters<typeof audioStatusOf>[2];
    const audio = audioStatusOf(committed, NOW, frame);
    expect(audio.channels.map((channel) => [channel.notMeasured, channel.noSignal])).toEqual([[true, false], [true, false]]);
    expect(validateCoreApiResponse('getAudioStatus', 200, audio)).toEqual({ ok: true });
    // CONTROL: the simulated device states neither member.
    const simulated = deviceHealthOf(committedOf(scenarioState('idle')), NOW);
    expect(simulated.security).not.toHaveProperty('platformNotReported');
    expect(audioStatusOf(committedOf(scenarioState('idle')), NOW).channels.every((channel) => !('notMeasured' in channel))).toBe(true);
  });

  it.each(Object.values(FaultKind))('with the fault %s injected into the recording scenario the three answers still equal the simulator\'s', (kind) => {
    const state = injectFaultTransition(scenarioState('recording'), FIXED_NOW, kind, FAULT_TARGETS[kind]);
    expect(state.faults.active.map((fault) => fault.kind), kind).toEqual([kind]);
    const committed = committedOf(state);
    expect(deviceHealthOf(committed, NOW)).toEqual(simulatorAnswer(state, HEALTH));
    expect(audioStatusOf(committed, NOW)).toEqual(simulatorAnswer(state, AUDIO));
    expect(videoStatusOf(committed)).toEqual(simulatorAnswer(state, VIDEO));
    expect(validateCoreApiResponse('getDeviceHealth', 200, deviceHealthOf(committed, NOW))).toEqual({ ok: true });
  });

  it('with every fault at once: a Core in which nothing is healthy is answered as the simulator answers it', () => {
    const state = Object.values(FaultKind).reduce((current, kind) => injectFaultTransition(current, FIXED_NOW, kind, FAULT_TARGETS[kind]), scenarioState('recording'));
    expect(state.faults.active).toHaveLength(Object.values(FaultKind).length);
    const committed = committedOf(state);
    const health = deviceHealthOf(committed, NOW);
    expect(health).toEqual(simulatorAnswer(state, HEALTH));
    expect(audioStatusOf(committed, NOW)).toEqual(simulatorAnswer(state, AUDIO));
    expect(videoStatusOf(committed)).toEqual(simulatorAnswer(state, VIDEO));
    expect(validateCoreApiResponse('getDeviceHealth', 200, health)).toEqual({ ok: true });
    // What the faults did, as the answer says it.
    expect(health.systemState).toBe('CRITICAL');
    expect(health.security).toMatchObject({ tpmOk: false, tamper: true });
    expect(health.cameras[0]).toMatchObject({ trackId: 'VIDEO-01', online: false, lens: 'FAULT' });
    expect(health.cameras[1]).toMatchObject({ trackId: 'VIDEO-02', online: true, lens: 'READY' });
    expect(health.audio.map((channel) => [channel.state, channel.noSignal, channel.clip])).toEqual([
      ['NO_SIGNAL', true, false],
      ['CLIP', false, true],
    ]);
    expect(health.time.source).toBe('RTC');
    expect(health.services.some((service) => service.status !== 'RUNNING')).toBe(true);
    expect(health.flags.length).toBeGreaterThanOrEqual(8);
  });

  it('a mic without signal: both levels are the flat -90 and noSignal is true, exactly as the simulator answers', () => {
    const state = injectFaultTransition(scenarioState('idle'), FIXED_NOW, 'MIC_NO_SIGNAL', { channel: 'AUDIO-01' });
    const audio = audioStatusOf(committedOf(state), NOW);
    expect(audio).toEqual(simulatorAnswer(state, AUDIO));
    expect(audio.channels[0]).toMatchObject({ inputId: 'MIC-01', state: 'NO_SIGNAL', dbfs: AUDIO_FLOOR_DBFS, peak: AUDIO_FLOOR_DBFS, noSignal: true });
    expect(audio.channels[1]).toMatchObject({ inputId: 'MIC-02', state: 'READY', dbfs: AUDIO_NOISE_FLOOR_DBFS, noSignal: false });
    expect(deviceHealthOf(committedOf(state), NOW)).toEqual(simulatorAnswer(state, HEALTH));
  });

  it('times are ISO-8601 at UTC+07:00 (API-5): serverTime is the instant of the read, lastSyncAt the state\'s', () => {
    const state = scenarioState('idle');
    const health = deviceHealthOf(committedOf(state), NOW);
    expect(health.serverTime).toBe(toWibIso(NOW));
    expect(health.serverTime).toMatch(/\+07:00$/);
    expect(Date.parse(health.serverTime)).toBe(NOW);
    expect(health.time.lastSyncAt).toBe(toWibIso(state.time.lastSyncAt));
    expect(Date.parse(health.time.lastSyncAt)).toBe(state.time.lastSyncAt);
  });

  it('the storage part is the evidence volume, the write rate and the retention policy, with whole milliseconds remaining', () => {
    const state = scenarioState('recording');
    const storage = storageStatusOf(committedOf(state));
    expect(storage).toEqual((simulatorAnswer(state, HEALTH) as { storage: unknown }).storage);
    expect(storage).toEqual(simulatorAnswer(state, '/api/v1/storage/status'));
    expect(Number.isInteger(storage.estimatedRemainingMs)).toBe(true);
    expect(storage.totalBytes - storage.usedBytes).toBe(storage.freeBytes);
    expect(storage.volumes.map((volume) => volume.id)).toEqual(['NVME-SYS', 'HDD-EVIDENCE']);
    expect(storage.retention).toEqual({
      policy: state.storagePolicy.retentionPolicy,
      days: state.storagePolicy.retentionDays,
      autoArchive: state.storagePolicy.autoArchive,
    });
  });
});

describe('the recorded difference of D89 (formerly BE-GAP-W36-1): the 20 Hz meter levels are not in the committed state', () => {
  it('the levels follow the state of the mic: READY the noise floor, NO_SIGNAL the flat -90, CLIP the burst level; clip is the latch', () => {
    expect(stateLevelsOf({ state: 'READY', clipLatched: false }, NOW)).toEqual({ dbfs: AUDIO_NOISE_FLOOR_DBFS, peak: AUDIO_NOISE_FLOOR_DBFS, clip: false, noSignal: false });
    expect(stateLevelsOf({ state: 'READY', clipLatched: true }, NOW)).toEqual({ dbfs: AUDIO_NOISE_FLOOR_DBFS, peak: AUDIO_NOISE_FLOOR_DBFS, clip: true, noSignal: false });
    expect(stateLevelsOf({ state: 'NO_SIGNAL', clipLatched: false }, NOW)).toEqual({ dbfs: AUDIO_FLOOR_DBFS, peak: AUDIO_FLOOR_DBFS, clip: false, noSignal: true });
    expect(stateLevelsOf({ state: 'NO_SIGNAL', clipLatched: true }, NOW)).toEqual({ dbfs: AUDIO_FLOOR_DBFS, peak: AUDIO_FLOOR_DBFS, clip: true, noSignal: true });
    expect(stateLevelsOf({ state: 'CLIP', clipLatched: true }, NOW)).toEqual({ dbfs: AUDIO_CLIP_BURST_DBFS, peak: AUDIO_CLIP_BURST_DBFS, clip: true, noSignal: false });
    expect(stateLevelsOf({ state: 'CLIP', clipLatched: false }, NOW)).toEqual({ dbfs: AUDIO_CLIP_BURST_DBFS, peak: AUDIO_CLIP_BURST_DBFS, clip: false, noSignal: false });
    // The contract's bounds of a level.
    expect([AUDIO_FLOOR_DBFS, AUDIO_NOISE_FLOOR_DBFS, AUDIO_CLIP_BURST_DBFS].every((level) => level >= -90 && level <= 0)).toBe(true);
  });

  it('a CLIP latch that outlives its fault: the mic is READY again, clip stays true; the simulator still holds the burst frame, this module the noise floor', () => {
    const clipped = injectFaultTransition(scenarioState('idle'), FIXED_NOW, 'MIC_CLIP', { channel: 'AUDIO-02' });
    const state = clearFaultTransition(clipped, FIXED_NOW + 1_000, 'MIC_CLIP', { channel: 'AUDIO-02' });
    const mine = audioStatusOf(committedOf(state), NOW);
    const simulators = simulatorAnswer(state, AUDIO) as typeof mine;

    expect(mine.channels[1]).toMatchObject({ inputId: 'MIC-02', state: 'READY', clip: true, noSignal: false, dbfs: AUDIO_NOISE_FLOOR_DBFS, peak: AUDIO_NOISE_FLOOR_DBFS });
    expect(simulators.channels[1]).toMatchObject({ state: 'READY', clip: true, dbfs: AUDIO_CLIP_BURST_DBFS, peak: AUDIO_CLIP_BURST_DBFS });
    expect(withoutLevels(mine)).toEqual(withoutLevels(simulators));
  });

  it('with the generator running the simulator\'s levels move and this module\'s do not: every other member of the three answers stays equal', async () => {
    const reference = await createHost({ scenario: 'recording' });
    reference.drive(3_000);
    const state = reference.state();
    const committed = committedOf(state);
    const now = reference.now();

    const mine = audioStatusOf(committed, now);
    const simulators = simulatorAnswer(state, AUDIO, now) as typeof mine;
    // Positive control: the difference this test is about exists.
    const moved = simulators.channels.filter((channel, index) => channel.dbfs !== mine.channels[index]?.dbfs || channel.peak !== mine.channels[index]?.peak);
    expect(moved.length).toBeGreaterThan(0);
    expect(mine.channels.map((channel) => [channel.dbfs, channel.peak])).toEqual([
      [AUDIO_NOISE_FLOOR_DBFS, AUDIO_NOISE_FLOOR_DBFS],
      [AUDIO_NOISE_FLOOR_DBFS, AUDIO_NOISE_FLOOR_DBFS],
    ]);

    expect(withoutLevels(mine)).toEqual(withoutLevels(simulators));
    expect(withoutLevels(deviceHealthOf(committed, now))).toEqual(withoutLevels(simulatorAnswer(state, HEALTH, now)));
    expect(videoStatusOf(committed)).toEqual(simulatorAnswer(state, VIDEO, now));
    console.info(
      `[w36] D89 difference (formerly BE-GAP-W36-1): after 3 s of the recording scenario the simulator answers ${simulators.channels.map((channel) => `${channel.inputId} ${channel.dbfs}/${channel.peak}`).join(', ')} dBFS; ` +
        `the module answers ${mine.channels.map((channel) => `${channel.inputId} ${channel.dbfs}/${channel.peak}`).join(', ')}; every other member is equal`,
    );
  });
});

describe('the newest meter frame of the engine (decisions D89, D122): with it, the levels are the frame\'s', () => {
  it('after 3 s of the recording scenario the answers with audio channels equal the simulator\'s handler, levels included; without a frame they do not', async () => {
    const reference = await createHost({ scenario: 'recording' });
    reference.drive(3_000);
    const state = reference.state();
    const committed = committedOf(state);
    const now = reference.now();
    // The frame as the engine hands it over: the `audio` slice of the tick, by reference.
    const frame = { at: now, seq: 60, audio: state.audio };

    expect(audioStatusOf(committed, now, frame)).toEqual(simulatorAnswer(state, AUDIO, now));
    expect(deviceHealthOf(committed, now, frame)).toEqual(simulatorAnswer(state, HEALTH, now));
    expect(validateCoreApiResponse('getAudioStatus', 200, audioStatusOf(committed, now, frame))).toEqual({ ok: true });
    expect(validateCoreApiResponse('getDeviceHealth', 200, deviceHealthOf(committed, now, frame))).toEqual({ ok: true });
    // Positive control: the levels are what the frame adds.
    expect(audioStatusOf(committed, now)).not.toEqual(simulatorAnswer(state, AUDIO, now));
    // null is "no frame yet" (before the first tick of a start): the levels the committed state decides.
    expect(audioStatusOf(committed, now, null)).toEqual(audioStatusOf(committed, now));
    expect(deviceHealthOf(committed, now, null)).toEqual(deviceHealthOf(committed, now));
  });

  it('dbfs, peak and noSignal of an input are the frame\'s; clip is the latch of the committed state, which a command changes between two frames', () => {
    const state = scenarioState('idle');
    const committed = committedOf(state);
    // Schema v2 (SH-17/SH-25; E-02): the engine's meter frame carries the mic INPUTS and the active input.
    const frame = {
      at: NOW,
      seq: 7,
      audio: {
        inputs: {
          'MIC-01': { seq: 7, at: NOW, dbfs: -18.25, peak: -12.5, clip: true, noSignal: false },
          'MIC-02': { seq: 7, at: NOW, dbfs: -90, peak: -90, clip: false, noSignal: true },
        },
        activeInputId: 'MIC-01',
      },
    } as const;
    const channels = audioStatusOf(committed, NOW, frame).channels;
    expect(channels.map((channel) => [channel.inputId, channel.dbfs, channel.peak, channel.clip, channel.noSignal])).toEqual([
      ['MIC-01', -18.25, -12.5, false, false],
      ['MIC-02', -90, -90, false, true],
    ]);
    // Every other member is the committed state's, with and without a frame.
    expect(withoutLevels(audioStatusOf(committed, NOW, frame)).channels.map(({ noSignal: _noSignal, ...rest }) => rest)).toEqual(
      withoutLevels(audioStatusOf(committed, NOW)).channels.map(({ noSignal: _noSignal, ...rest }) => rest),
    );
    expect(deviceHealthOf(committed, NOW, frame).audio).toEqual(channels);
  });
});

describe('operation 47: the slices in their wire form (API-6), schema v2 with the selector snapshot', () => {
  it.each(SCENARIOS)('scenario %s: each slice under its slice name, by reference, and the answer parses with the contract\'s strict schema', (name) => {
    const state = scenarioState(name);
    const inventory = deviceInventoryOf(committedOf(state), state.captureConfig);

    // Schema v2 (C3 §3 op 47; SH-12; E-04): `captureConfig` joins the answer - the selector in its
    // wire form, its own slice, never the paired-client registry and never a credential (RK-12).
    expect(Object.keys(inventory)).toEqual(['device', 'cameras', 'mics', 'otherDevices', 'ports', 'activeCameraId', 'tabletLink', 'captureConfig']);
    expect(inventory.device).toBe(state.device);
    expect(inventory.cameras).toBe(state.cameras);
    expect(inventory.mics).toBe(state.mics);
    expect(inventory.otherDevices).toBe(state.otherDevices);
    expect(inventory.ports).toBe(state.ports);
    expect(inventory.activeCameraId).toBe(state.activeCameraId);
    expect(inventory.tabletLink).toBe(state.tabletLink);
    expect(inventory.captureConfig).toBe(state.captureConfig);

    const wire: unknown = JSON.parse(JSON.stringify(inventory));
    expect(DeviceInventorySchema.parse(wire)).toEqual(wire);
    expect(validateCoreApiResponse('getDeviceInventory', 200, wire)).toEqual({ ok: true });
  });

  it('the strict schema refuses an eighth slice, a missing captureConfig and a member a slice does not have: nothing else can leave with the answer', () => {
    const state = scenarioState('idle');
    const wire = JSON.parse(JSON.stringify(deviceInventoryOf(committedOf(state), state.captureConfig))) as Record<string, unknown>;
    expect(DeviceInventorySchema.safeParse({ ...wire, audit: state.audit }).success).toBe(false);
    expect(DeviceInventorySchema.safeParse({ ...wire, device: { ...(wire['device'] as object), secret: 'x' } }).success).toBe(false);
    const { captureConfig: _captureConfig, ...withoutSelector } = wire;
    expect(DeviceInventorySchema.safeParse(withoutSelector).success).toBe(false);
  });
});

describe('the reads use the committed state and nothing else', () => {
  /** The state with every slice that is NOT durable made unreadable. */
  const durableOnly = (state: SimState): CommittedState =>
    new Proxy(state, {
      get(target, key, receiver) {
        if (typeof key === 'string' && Object.hasOwn(UNMAPPED_SLICES, key)) throw new Error(`the slice ${key} is not part of the committed state`);
        return Reflect.get(target, key, receiver) as unknown;
      },
    }) as CommittedState;

  it.each(SCENARIOS)('scenario %s: no member of audio, clock, auth, authLockout or pairing is read', (name) => {
    const state = scenarioState(name);
    const guarded = durableOnly(state);
    expect(deviceHealthOf(guarded, NOW)).toEqual(deviceHealthOf(committedOf(state), NOW));
    expect(audioStatusOf(guarded, NOW)).toEqual(audioStatusOf(committedOf(state), NOW));
    expect(videoStatusOf(guarded)).toEqual(videoStatusOf(committedOf(state)));
    expect(deviceInventoryOf(guarded)).toEqual(deviceInventoryOf(committedOf(state)));
  });

  it('positive control: the simulator\'s own handler does read a slice that is not durable (audio), which is why its answer cannot be had from the engine seam', () => {
    const guarded = durableOnly(scenarioState('idle')) as unknown as SimState;
    const response = handleSimApiRequest(
      { store: { getState: () => guarded } as unknown as SimStore, actions: {} as SimActions, clock: createManualClock(NOW) },
      { method: 'GET', path: AUDIO },
    );
    expect(response.status).toBe(500);
    // Schema v2 (D44 R5): the two capture slices are DURABLE stored slices of the engine mapping;
    // the not-durable set is the five of spec §3.1 again.
    expect(Object.keys(UNMAPPED_SLICES).sort()).toEqual(['audio', 'auth', 'authLockout', 'clock', 'pairing']);
    expect(DURABLE_SLICE_KEYS).toHaveLength(30);
  });

  it('nothing is changed: every function works on a deeply frozen state', () => {
    const committed = deepFreeze(committedOf(scenarioState('fault-demo')));
    expect(() => {
      deviceHealthOf(committed, NOW);
      audioStatusOf(committed, NOW);
      videoStatusOf(committed);
      storageStatusOf(committed);
      deviceInventoryOf(committed);
    }).not.toThrow();
  });
});

// ── Task 3 row 140 (R-11; ruling D137 (2)): the reads follow the STORED selector ───────────────────
// The local camera and microphone are NEW devices with their own IDs (`CAM-03`, `MIC-03`, D106 (4)).
// Until this row the module's routes passed no selector slots, so the built-in pair answered
// whatever the selector said. The state below holds a selector as a development Core stores it:
// track 1 = this Mac's camera, primary microphone = this Mac's microphone, slot 2 = the test sources.
describe('row 140: the four reads name the devices of the stored selector (an adopted or local device beyond the built-in pair)', () => {
  const developmentState = (): SimState => {
    const state = scenarioState('idle');
    return {
      ...state,
      captureConfig: {
        ...state.captureConfig,
        cameras: state.captureConfig.cameras.map((camera) => (camera.trackId === 'VIDEO-01' ? { ...camera, deviceId: 'CAM-03' } : camera)),
        mics: [
          { ...state.captureConfig.mics[0]!, inputId: 'MIC-03', deviceId: 'MIC-03', role: 'PRIMARY' },
          { ...state.captureConfig.mics[1]!, inputId: 'MIC-02', deviceId: 'MIC-02', role: 'STANDBY' },
        ],
      },
    } as SimState;
  };

  it('operation 46: track 1 is fed by CAM-03, track 2 by CAM-02 - the simulator\'s own answer on the same state', () => {
    const state = developmentState();
    const video = videoStatusOf(committedOf(state));
    expect(video.tracks.map((track) => [track.trackId, track.sourceDeviceId])).toEqual([['VIDEO-01', 'CAM-03'], ['VIDEO-02', 'CAM-02']]);
    expect(video).toEqual(simulatorAnswer(state, VIDEO));
    expect(VideoStatusResponseSchema.safeParse(video).success).toBe(true);
  });

  it('operations 45 and 44: the microphone lines are MIC-03 (PRIMARY, active) and MIC-02 (STANDBY)', () => {
    const state = developmentState();
    const audio = audioStatusOf(committedOf(state), NOW);
    expect(audio.channels.map((channel) => [channel.inputId, channel.deviceId, channel.role])).toEqual([['MIC-03', 'MIC-03', 'PRIMARY'], ['MIC-02', 'MIC-02', 'STANDBY']]);
    expect(audio.activeInputId).toBe('MIC-03');
    expect(AudioStatusResponseSchema.safeParse(audio).success).toBe(true);
    const health = deviceHealthOf(committedOf(state), NOW);
    expect(health.cameras.map((camera) => camera.sourceDeviceId)).toEqual(['CAM-03', 'CAM-02']);
    expect(health.audio.map((channel) => channel.inputId)).toEqual(['MIC-03', 'MIC-02']);
    expect(health.activeInputId).toBe('MIC-03');
    expect(DeviceHealthResponseSchema.safeParse(health).success).toBe(true);
  });

  it('operation 47: the selector of the answer IS the stored one (by reference), not the built-in baseline', () => {
    const state = developmentState();
    const inventory = deviceInventoryOf(committedOf(state));
    expect(inventory.captureConfig).toBe(state.captureConfig);
    expect(inventory.captureConfig.cameras[0]?.deviceId).toBe('CAM-03');
    expect(DeviceInventorySchema.safeParse(JSON.parse(JSON.stringify(inventory))).success).toBe(true);
  });

  it('CONTROL: with the built-in slots handed in, the same state answers the built-in pair - the default is what changed', () => {
    const state = developmentState();
    const builtin = { cameras: scenarioState('idle').captureConfig.cameras, mics: scenarioState('idle').captureConfig.mics };
    expect(videoStatusOf(committedOf(state), builtin).tracks.map((track) => track.sourceDeviceId)).toEqual(['CAM-01', 'CAM-02']);
    expect(audioStatusOf(committedOf(state), NOW, null, builtin).channels.map((channel) => channel.inputId)).toEqual(['MIC-01', 'MIC-02']);
  });
});

// Task 4 row 150 (AD-04 (2); sites B11, B12, B13 of research/027; names register N4, N5, E39, E40).
// Until this row the three readers answered a selector line that is NOT THERE: the built-in camera
// as the source of a track, a built-in input with the hardware slice's device and role for a meter
// channel, and - for the active input - the hardware slice's PRIMARY microphone, then its first
// microphone, then a constant. The states below are hand-built: the idle seed with selector lines
// taken away. The hardware slices (`cameras`, `mics`) stay complete in every one of them, which is
// what makes a stand-in possible and its absence a finding.
describe('row 150: a selector line that is not there is answered "absent", never a built-in device, a default input or the first microphone', () => {
  type Selector = SimState['captureConfig'];
  const withSelector = (change: (selector: Selector) => Pick<Selector, 'cameras' | 'mics'>): SimState => {
    const state = scenarioState('idle');
    return { ...state, captureConfig: { ...state.captureConfig, ...change(state.captureConfig) } } as SimState;
  };
  const primaryOf = (selector: Selector) => selector.mics.find((line) => line.role === 'PRIMARY')!;
  const standbyOf = (selector: Selector) => selector.mics.find((line) => line.role === 'STANDBY')!;
  /** Every identifier of a microphone the hardware slice or the built-in table could lend. */
  const BUILTIN_INPUTS = ['MIC-01', 'MIC-02'];

  it('CONTROL: the hardware slices of the seed hold what a stand-in would answer - two cameras with a device, a PRIMARY microphone first', () => {
    const state = scenarioState('idle');
    expect(state.cameras.map((camera) => camera.deviceId)).toEqual(['CAM-01', 'CAM-02']);
    expect(state.mics.map((mic) => mic.micRole)).toEqual(['PRIMARY', 'STANDBY']);
    expect(state.mics.every((mic) => mic.deviceId.length > 0)).toBe(true);
  });

  it('B11, the video tracks: a selector with only VIDEO-02 answers two tracks, VIDEO-01 with NO source - not its built-in camera', () => {
    const state = withSelector((selector) => ({ cameras: selector.cameras.filter((line) => line.trackId === 'VIDEO-02'), mics: selector.mics }));
    const video = videoStatusOf(committedOf(state));
    expect(video.tracks.map((track) => [track.trackId, track.sourceDeviceId])).toEqual([['VIDEO-01', null], ['VIDEO-02', 'CAM-02']]);
    // The unit's own port fact is still stated, as a fact of the port: it is not the track's source.
    expect(video.tracks[0]?.deviceId).toBe('CAM-01');
    expect(VideoStatusResponseSchema.safeParse(video).success).toBe(true);
    const health = deviceHealthOf(committedOf(state), NOW);
    expect(health.cameras.map((camera) => camera.sourceDeviceId)).toEqual([null, 'CAM-02']);
    expect(DeviceHealthResponseSchema.safeParse(health).success).toBe(true);
  });

  it('B11: the line is found by its TRACK, not by its place - the one line of VIDEO-02 standing first does not become the source of VIDEO-01; no line at all: no source at all', () => {
    const swapped = withSelector((selector) => ({ cameras: [...selector.cameras].reverse().map((line) => ({ ...line, deviceId: `SRC-OF-${line.trackId}` })), mics: selector.mics }));
    expect(videoStatusOf(committedOf(swapped)).tracks.map((track) => [track.trackId, track.sourceDeviceId])).toEqual([['VIDEO-01', 'SRC-OF-VIDEO-01'], ['VIDEO-02', 'SRC-OF-VIDEO-02']]);
    const none = withSelector((selector) => ({ cameras: [], mics: selector.mics }));
    expect(videoStatusOf(committedOf(none)).tracks.map((track) => track.sourceDeviceId)).toEqual([null, null]);
  });

  it('B12, the audio channels: with only a STANDBY line no meter channel has an input, so there is NO entry - no built-in input, no device and no role of the hardware slice', () => {
    for (const mics of [
      (selector: Selector) => [standbyOf(selector)],
      (selector: Selector) => [primaryOf(selector)],
      () => [],
      // Two lines that are not one of each role are no pair either.
      (selector: Selector) => [primaryOf(selector), { ...standbyOf(selector), role: 'PRIMARY' as const }],
    ]) {
      const state = withSelector((selector) => ({ cameras: selector.cameras, mics: mics(selector) }));
      const audio = audioStatusOf(committedOf(state), NOW);
      expect(audio.channels).toEqual([]);
      expect(AudioStatusResponseSchema.safeParse(audio).success).toBe(true);
      const health = deviceHealthOf(committedOf(state), NOW);
      expect(health.audio).toEqual([]);
      expect(DeviceHealthResponseSchema.safeParse(health).success).toBe(true);
    }
  });

  it('B12: a frame of the engine does not bring an entry back - a level without a selector line belongs to no input of the answer', () => {
    const state = withSelector((selector) => ({ cameras: selector.cameras, mics: [standbyOf(selector)] }));
    const frame = {
      at: NOW,
      seq: 3,
      audio: {
        inputs: { 'MIC-01': { seq: 3, at: NOW, dbfs: -20, peak: -18, clip: false, noSignal: false }, 'MIC-02': { seq: 3, at: NOW, dbfs: -21, peak: -19, clip: false, noSignal: false } },
        activeInputId: null,
      },
    } as const;
    expect(audioStatusOf(committedOf(state), NOW, frame)).toEqual({ channels: [], activeInputId: null });
  });

  it('B12: on a complete pair the device and the role of an entry are its LINE\'s, in both role arrangements - never the hardware slice\'s own', () => {
    const state = withSelector((selector) => ({
      cameras: selector.cameras,
      // The STANDBY line stands first: meter channel 1 is a STANDBY input (D137: input order), while the hardware slice's first microphone calls itself PRIMARY.
      mics: [
        { ...standbyOf(selector), inputId: 'MIC-07', deviceId: 'USB-CARD-B' },
        { ...primaryOf(selector), inputId: 'MIC-04', deviceId: 'USB-CARD-A' },
      ],
    }));
    const audio = audioStatusOf(committedOf(state), NOW);
    expect(audio.channels.map((channel) => [channel.inputId, channel.deviceId, channel.role])).toEqual([['MIC-07', 'USB-CARD-B', 'STANDBY'], ['MIC-04', 'USB-CARD-A', 'PRIMARY']]);
    expect(audio.activeInputId).toBe('MIC-04');
    expect(AudioStatusResponseSchema.safeParse(audio).success).toBe(true);
  });

  it('B13, the active input: without a PRIMARY line the answer is null - not the hardware slice\'s PRIMARY microphone, not its first microphone, not MIC-01', () => {
    for (const mics of [(selector: Selector) => [standbyOf(selector)], () => []]) {
      const state = withSelector((selector) => ({ cameras: selector.cameras, mics: mics(selector) }));
      expect(audioStatusOf(committedOf(state), NOW).activeInputId).toBeNull();
      expect(deviceHealthOf(committedOf(state), NOW).activeInputId).toBeNull();
      expect(activeInputOf(null, { cameras: state.captureConfig.cameras, mics: state.captureConfig.mics })).toBeNull();
    }
  });

  it('B13: the PRIMARY line is found by its ROLE wherever it stands, also alone (a role is assignable alone, C21 (8)); a frame that names an input is the engine\'s word', () => {
    const alone = withSelector((selector) => ({ cameras: selector.cameras, mics: [{ ...primaryOf(selector), inputId: 'MIC-09', deviceId: 'USB-CARD-C' }] }));
    const answer = audioStatusOf(committedOf(alone), NOW);
    expect(answer.activeInputId).toBe('MIC-09');
    // ... and it has no meter channel until the pair is complete (register section 3.2).
    expect(answer.channels).toEqual([]);
    const second = withSelector((selector) => ({ cameras: selector.cameras, mics: [standbyOf(selector), { ...primaryOf(selector), inputId: 'MIC-05' }] }));
    expect(audioStatusOf(committedOf(second), NOW).activeInputId).toBe('MIC-05');
    const slots = { cameras: second.captureConfig.cameras, mics: second.captureConfig.mics };
    const frameOf = (activeInputId: string | null) => ({ at: NOW, seq: 1, audio: { inputs: {}, activeInputId } }) as unknown as Parameters<typeof activeInputOf>[0];
    expect(activeInputOf(frameOf('MIC-02'), slots)).toBe('MIC-02');
    // A frame that names NO input does not hide the PRIMARY line, and with no line either the answer stays null.
    expect(activeInputOf(frameOf(null), slots)).toBe('MIC-05');
    expect(activeInputOf(frameOf(null), { cameras: slots.cameras, mics: [] })).toBeNull();
  });

  it('an input or device answered for a slot without a line: 0 - over every way of taking lines away, no answer names what the selector does not hold', () => {
    const seed = scenarioState('idle').captureConfig;
    let invented = 0;
    let states = 0;
    for (const cameras of [seed.cameras, seed.cameras.slice(0, 1), seed.cameras.slice(1), []]) {
      for (const mics of [seed.mics, [primaryOf(seed)], [standbyOf(seed)], []]) {
        states += 1;
        // The lines carry identifiers no hardware slice and no built-in table holds, so a stand-in shows.
        const state = withSelector(() => ({
          cameras: cameras.map((line) => ({ ...line, deviceId: `LINE-${line.trackId}` })),
          mics: mics.map((line, index) => ({ ...line, inputId: `MIC-${31 + index}` as typeof line.inputId, deviceId: `LINE-${line.role}` })),
        }));
        const health = deviceHealthOf(committedOf(state), NOW);
        expect(DeviceHealthResponseSchema.safeParse(health).success).toBe(true);
        const heldDevices = new Set([...state.captureConfig.cameras.map((line) => line.deviceId), ...state.captureConfig.mics.map((line) => line.deviceId)]);
        const heldInputs = new Set<string>(state.captureConfig.mics.map((line) => line.inputId));
        for (const camera of health.cameras) if (camera.sourceDeviceId !== null && !heldDevices.has(camera.sourceDeviceId)) invented += 1;
        for (const channel of health.audio) if (!heldInputs.has(channel.inputId) || !heldDevices.has(channel.deviceId) || BUILTIN_INPUTS.includes(channel.inputId)) invented += 1;
        if (health.activeInputId !== null && !heldInputs.has(health.activeInputId)) invented += 1;
        // The count of what IS answered follows the lines: a source per camera line, two channels only for the pair, an active input only with a PRIMARY.
        expect(health.cameras.filter((camera) => camera.sourceDeviceId !== null)).toHaveLength(cameras.length);
        expect(health.audio).toHaveLength(mics.length === 2 ? 2 : 0);
        expect(health.activeInputId === null).toBe(!mics.some((line) => line.role === 'PRIMARY'));
      }
    }
    expect(states).toBe(16);
    expect(invented).toBe(0);
  });

  it('names of the positional function left in the file: 0 - and none of the three stand-ins it served (the source of status.ts, read as text)', () => {
    const source = readFileSync(fileURLToPath(new URL('../status.ts', import.meta.url)), 'utf8');
    const count = (pattern: RegExp): number => (source.match(pattern) ?? []).length;
    expect(count(new RegExp(`micInputOf${'Channel'}`, 'g'))).toBe(0);
    // The built-in table of the positional function and a literal built-in input.
    expect(count(/DEFAULT_MIC_INPUT_OF_CHANNEL/g)).toBe(0);
    // A literal built-in input, and the hardware slice's own device, role and first microphone as an answer: in the CODE (the comments name them).
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(code.match(/['"`]MIC-\d+['"`]/g)).toBeNull();
    expect(count(/micInputOfRole\(|meterInputOfChannel\(/g)).toBe(2);
    expect(/\bmic\.deviceId\b|\bmicRole\b|\bmics\[0\]|\?\?\s*camera\.deviceId/.test(code)).toBe(false);
    // POSITIVE CONTROL: the same search finds each of them in the text this row replaced.
    const before = "sourceDeviceId: slot?.deviceId ?? camera.deviceId, deviceId: slotDeviceOf.get(inputId) ?? mic.deviceId, const mic = mics.find((candidate) => candidate.micRole === 'PRIMARY') ?? mics[0];";
    expect(before.match(/\bmic\.deviceId\b|\bmicRole\b|\bmics\[0\]|\?\?\s*camera\.deviceId/g)).toHaveLength(4);
  });
});

// Task 4 row 53 (WP-10b; design addendum 7.2; AD-06 (1), (2); decision C36): in a REAL capture operation the
// picture, the rate and the codec of a video track are the STORED statement of the stream in its selector slot -
// the Core's own code, minted from the stream by the function the seal uses (rows 50, 51). Read back, it is that
// function's inverse. No device, no relay, no database: the double is the committed state of the seed.
describe('row 53: the camera facts of a real capture operation are the stored statement of the stream', () => {
  const state = committedOf(scenarioState(SCENARIOS[0]!));
  /** The committed state with other profile codes on the two video slots. */
  const slotted = (video01: string, video02: string): CommittedState => ({
    ...state,
    captureConfig: { ...state.captureConfig, cameras: state.captureConfig.cameras.map((camera) => ({ ...camera, profile: camera.trackId === 'VIDEO-01' ? video01 : video02 })) },
  });
  const factsOf = (answer: { readonly tracks: readonly { readonly trackId: string; readonly resolution: string | null; readonly fps: number | null; readonly codec: string | null }[] }): unknown[] =>
    answer.tracks.map((track) => [track.trackId, track.resolution, track.fps, track.codec]);

  it('an HEVC camera is stated HEVC with NO rate; an H.264 one as before - on the three reads that name a camera, valid against the contract', () => {
    const real = slotted('HEVC_1080P', 'H264_1080P25');
    const video = videoStatusOf(real, undefined, true);
    expect(factsOf(video)).toEqual([
      ['VIDEO-01', '1080p', null, 'HEVC'],
      ['VIDEO-02', '1080p', 25, 'H.264'],
    ]);
    expect(VideoStatusResponseSchema.safeParse(video).success).toBe(true);
    expect(validateCoreApiResponse('getVideoStatus', 200, video)).toMatchObject({ ok: true });
    const health = deviceHealthOf(real, NOW, null, undefined, true);
    expect(health.cameras.map((camera) => [camera.resolution, camera.fps, camera.codec])).toEqual([['1080p', null, 'HEVC'], ['1080p', 25, 'H.264']]);
    expect(DeviceHealthResponseSchema.safeParse(health).success).toBe(true);
    const inventory = deviceInventoryOf(real, undefined, true);
    expect(inventory.cameras.map((camera) => [camera.id, camera.resolution, camera.fps, camera.codec])).toEqual([['VIDEO-01', '1080p', null, 'HEVC'], ['VIDEO-02', '1080p', 25, 'H.264']]);
    expect(DeviceInventorySchema.safeParse(inventory).success).toBe(true);
    // Every other member of a track is as it was: the three facts are the stream's - and, since row CB (finding R-01),
    // the bitrate is null: no real source states one (this line pinned the simulator's 9 in real capture before).
    const plain = videoStatusOf(real);
    expect(video.tracks.map(({ resolution: _r, fps: _f, codec: _c, bitrateMbps: _b, ...rest }) => rest)).toEqual(plain.tracks.map(({ resolution: _r, fps: _f, codec: _c, bitrateMbps: _b, ...rest }) => rest));
    expect(video.tracks.map((track) => track.bitrateMbps)).toEqual([null, null]);
  });

  it('the H.264 baseline is unchanged, member for member, and the state is not touched: the same slice object when nothing differs', () => {
    // Row CB (finding R-01): the state of a Core in real capture states no bitrate (`engine/camera-bitrate.ts`, at every
    // start). On THAT state nothing differs. (These four lines ran on the simulator's slice, 9, before: the pin of R-01.)
    const stated: CommittedState = { ...state, cameras: state.cameras.map((camera) => ({ ...camera, bitrateMbps: null })) };
    expect(videoStatusOf(stated, undefined, true)).toEqual(videoStatusOf(stated));
    expect(deviceHealthOf(stated, NOW, null, undefined, true)).toEqual(deviceHealthOf(stated, NOW));
    expect(deviceInventoryOf(stated, undefined, true).cameras).toBe(stated.cameras);
    expect(withCameraStreamFacts(stated.cameras, stated.captureConfig)).toBe(stated.cameras);
    // On the simulator's own slice the ONE difference of the baseline is the bitrate.
    const withoutBitrate = (answer: ReturnType<typeof videoStatusOf>): unknown[] => answer.tracks.map(({ bitrateMbps: _b, ...rest }) => rest);
    expect(withoutBitrate(videoStatusOf(state, undefined, true))).toEqual(withoutBitrate(videoStatusOf(state)));
    const frozen = deepFreeze(slotted('HEVC_1080P', 'HEVC_2560X1920P'));
    expect(withCameraStreamFacts(frozen.cameras, frozen.captureConfig).map((camera) => [camera.resolution, camera.fps, camera.codec])).toEqual([['1080p', null, 'HEVC'], ['2560x1920', null, 'HEVC']]);
    expect(frozen.cameras.map((camera) => [camera.resolution, camera.fps, camera.codec])).toEqual(state.cameras.map((camera) => [camera.resolution, camera.fps, camera.codec]));
  });

  it('CONTROL: without the flag (a SIMULATED Core) the answer is the slice\'s own, whatever the slot says - the simulator\'s answer on the same state', () => {
    const simulated = slotted('HEVC_1080P', 'H264_720P30');
    expect(factsOf(videoStatusOf(simulated))).toEqual(factsOf(videoStatusOf(state)));
    expect(deviceInventoryOf(simulated).cameras).toBe(simulated.cameras);
  });

  // Wave 12, row CB (review 060c finding R-01; decision C36). Seen RED on: `bitrateMbps: null` taken out of
  // `withCameraStreamFacts` (`{ ...camera, resolution, fps, codec }` and the `=== null` of its identity test) - the
  // three real answers then read 9. (The flag's wiring, and a Core that is not real, are held in `routes.test.ts`.)
  it('row CB (R-01): a camera\'s bitrate is NULL on the three reads of a real capture operation, whatever the slot holds and whatever number the slice holds; a SIMULATED Core answers the simulator\'s own', () => {
    // The simulator's one writer: its initial 9 on both tracks. It is what a seed, a reset or an older stored state hands in.
    expect(state.cameras.map((camera) => camera.bitrateMbps)).toEqual([9, 9]);
    // An assigned H.264 slot, an assigned HEVC slot, a code that is no statement, and another number in the slice.
    const other: CommittedState = { ...slotted('HEVC_1080P', 'NOT_A_STATEMENT'), cameras: state.cameras.map((camera, at) => ({ ...camera, bitrateMbps: at === 0 ? 4.5 : 0 })) };
    for (const real of [state, slotted('HEVC_1080P', 'H264_720P30'), slotted('NOT_A_STATEMENT', 'H264_1080P25'), other]) {
      const video = videoStatusOf(real, undefined, true);
      expect(video.tracks.map((track) => track.bitrateMbps)).toEqual([null, null]);
      expect(validateCoreApiResponse('getVideoStatus', 200, video)).toMatchObject({ ok: true });
      const health = deviceHealthOf(real, NOW, null, undefined, true);
      expect(health.cameras.map((camera) => camera.bitrateMbps)).toEqual([null, null]);
      expect(DeviceHealthResponseSchema.safeParse(health).success).toBe(true);
      const inventory = deviceInventoryOf(real, undefined, true);
      expect(inventory.cameras.map((camera) => camera.bitrateMbps)).toEqual([null, null]);
      expect(DeviceInventorySchema.safeParse(inventory).success).toBe(true);
      // The state handed in is not written: its own numbers are still there.
      expect(real.cameras.map((camera) => camera.bitrateMbps)).not.toContain(null);
      // CONTROL - a SIMULATED Core (no flag) on the SAME state: the slice's own number, on all three.
      const own = real.cameras.map((camera) => camera.bitrateMbps);
      expect(videoStatusOf(real).tracks.map((track) => track.bitrateMbps)).toEqual(own);
      expect(deviceHealthOf(real, NOW).cameras.map((camera) => camera.bitrateMbps)).toEqual(own);
      expect(deviceInventoryOf(real).cameras).toBe(real.cameras);
    }
    // The storage volume's own bitrate (a figure of the write rate, another member) is not this rule's: unchanged.
    expect(deviceHealthOf(state, NOW, null, undefined, true).storage.bitrateMbps).toBe(deviceHealthOf(state, NOW).storage.bitrateMbps);
  });

  it('the reading is the inverse of the seal\'s own function: every code it makes is read back to the picture, the whole-number rate or none, and the codec', () => {
    const cases: readonly (readonly [string, number, number, number | null, string, number | null, string])[] = [
      ['H264', 1920, 1080, 25, '1080p', 25, 'H.264'],
      ['H264', 1280, 720, 30, '720p', 30, 'H.264'],
      ['H264', 1280, 720, 30000 / 1001, '720p', 30, 'H.264'],
      ['H264', 1920, 1080, null, '1080p', null, 'H.264'],
      // A rate with no whole-number name is not stated by the seal: none is stated here.
      ['H264', 1920, 1080, 27.67, '1080p', null, 'H.264'],
      ['HEVC', 1920, 1080, null, '1080p', null, 'HEVC'],
      ['HEVC', 3840, 2160, null, '2160p', null, 'HEVC'],
      ['HEVC', 2560, 1920, null, '2560x1920', null, 'HEVC'],
      ['H264', 1280, 960, 15, '1280x960', 15, 'H.264'],
      ['H264', 640, 360, 240, '360p', 240, 'H.264'],
    ];
    for (const [codec, width, height, frameRate, resolution, fps, shown] of cases) {
      const code = streamProfileOf(codec, { width, height, frameRate });
      expect([code, cameraStreamFactsOf(code)]).toEqual([code, { resolution, fps, codec: shown }]);
    }
  });

  it('a code that is no stream statement says nothing: a development profile name, an ONVIF token, a codec outside the set, numbers the slice cannot carry - the track keeps what it had, and nothing of the text is repeated', () => {
    const silent: readonly unknown[] = ['MAIN', 'STANDARD_1080P25', 'profile_1', 'h264_1080p25', 'OTHER_1080P25', 'AV1_1080P', 'H265_1080P', 'H264_1080', 'H264_1080P25X', 'H264_1080P0', 'H264_1080P241', 'H264_50P25', 'H264_10000P25', 'HEVC_99X99P', 'H264_1920X1080P25', 'H264_1080P25<script>', '', null, undefined, 7, ['HEVC_1080P']];
    expect(silent.map(cameraStreamFactsOf)).toEqual(silent.map(() => null));
    const kept = videoStatusOf(slotted('profile_1', 'H264_1080P25<script>'), undefined, true);
    // Rows B2 and V6 (S-01): the picture, the rate and the codec are each NOT STATED (null) - never the simulator's `1080p / 25 / H.264`.
    expect(factsOf(kept)).toEqual(factsOf(videoStatusOf(state)).map((track) => [(track as unknown[])[0], null, null, null]));
    expect(state.cameras.map((camera) => camera.fps)).toEqual([25, 25]);
    expect(JSON.stringify(kept.tracks.map(({ resolution, fps, codec }) => [resolution, fps, codec]))).not.toMatch(/script|profile_1/);
  });

  it('a track whose slot is not assigned has no stream statement: it keeps the slice\'s facts and names no source', () => {
    const only02: CommittedState = { ...state, captureConfig: { ...state.captureConfig, cameras: state.captureConfig.cameras.filter((camera) => camera.trackId === 'VIDEO-02').map((camera) => ({ ...camera, profile: 'HEVC_1080P' })) } };
    const answer = videoStatusOf(only02, undefined, true);
    expect(answer.tracks.map((track) => [track.trackId, track.sourceDeviceId === null, track.resolution, track.fps, track.codec])).toEqual([
      // Rows B2 and V6 (S-01): a track without a statement states nothing - null, not the slice's `1080p / 25 / H.264`.
      ['VIDEO-01', true, null, null, null],
      ['VIDEO-02', false, '1080p', null, 'HEVC'],
    ]);
  });

  // Row B2 (review follow-up S-01 of `verification/060b`; decisions C36, C95). The double is the committed state of the
  // seed; no device and no database.
  describe('row B2 (S-01): a track WITHOUT a stream statement - what the contract lets the Core say of it, and what it does not', () => {
    const unassigned: CommittedState = { ...state, captureConfig: { ...state.captureConfig, cameras: [] } };

    it('on the three reads of a real capture operation its rate is NOT STATED (null): the simulator\'s 25 is answered for no track that has no statement - unassigned, a development name, a code of the stored form that is no statement', () => {
      // `HEVC_2160P25_MAIN` is of the form the database admits in a stored list and is no statement (an HEVC code states no rate).
      for (const real of [unassigned, slotted('MAIN', 'STANDARD_1080P25'), slotted('HEVC_2160P25_MAIN', 'H264_1080P25_SUB')]) {
        const video = videoStatusOf(real, captureSlotsOf(real), true);
        const health = deviceHealthOf(real, NOW, null, captureSlotsOf(real), true);
        const inventory = deviceInventoryOf(real, undefined, true);
        expect([video.tracks.map((track) => track.fps), health.cameras.map((camera) => camera.fps), inventory.cameras.map((camera) => camera.fps)]).toEqual([[null, null], [null, null], [null, null]]);
        expect(VideoStatusResponseSchema.safeParse(video).success).toBe(true);
        expect(DeviceHealthResponseSchema.safeParse(health).success).toBe(true);
        expect(DeviceInventorySchema.safeParse(inventory).success).toBe(true);
      }
      // One track with a statement beside one without: each says its own.
      const mixed = videoStatusOf(slotted('H264_720P30', 'MAIN'), undefined, true);
      expect(factsOf(mixed)).toEqual([['VIDEO-01', '720p', 30, 'H.264'], ['VIDEO-02', null, null, null]]);
    });

    it('the state is not written, and a track whose rate is null already is the SAME object (identity kept)', () => {
      const frozen = deepFreeze(unassigned);
      const once = withCameraStreamFacts(frozen.cameras, frozen.captureConfig);
      expect(once).not.toBe(frozen.cameras);
      expect(frozen.cameras.map((camera) => camera.fps)).toEqual([25, 25]);
      expect(withCameraStreamFacts(once, frozen.captureConfig)).toBe(once);
    });

    it('CONTROL: a SIMULATED Core (no flag) answers its slice for the same state - 25 stays, as the simulator answers', () => {
      expect(videoStatusOf(unassigned, captureSlotsOf(unassigned)).tracks.map((track) => track.fps)).toEqual([25, 25]);
      expect(deviceInventoryOf(unassigned).cameras).toBe(unassigned.cameras);
    });

    // THE CASE THAT TURNED (row V6, contract step for S-01): until then the contract had no "not stated" for the picture
    // and the codec, and the slice's `1080p` and `H.264` were still answered for such a track.
    it('THE GAP IS CLOSED (row V6): a track without a stream statement answers the picture, the rate AND the codec as NOT STATED (null) - the slice\'s `1080p / 25 / H.264` is never handed on; the contract takes null for each, and still refuses an absent member, an invented word and an empty text', () => {
      const video = videoStatusOf(unassigned, captureSlotsOf(unassigned), true);
      expect(state.cameras.map((camera) => [camera.resolution, camera.fps, camera.codec])).toEqual([['1080p', 25, 'H.264'], ['1080p', 25, 'H.264']]);
      expect(video.tracks.map((track) => [track.sourceDeviceId, track.resolution, track.fps, track.codec])).toEqual([[null, null, null, null], [null, null, null, null]]);
      expect(VideoStatusResponseSchema.safeParse(video).success).toBe(true);
      expect(withCameraStreamFacts(unassigned.cameras, captureSlotsOf(unassigned)).map((camera) => [camera.resolution, camera.fps, camera.codec])).toEqual([[null, null, null], [null, null, null]]);
      // Said once: a slice that already says "not stated" is the SAME array (nothing to say).
      const stated = withCameraStreamFacts(unassigned.cameras, captureSlotsOf(unassigned));
      expect(withCameraStreamFacts(stated, captureSlotsOf(unassigned))).toBe(stated);
      const track = video.tracks[0]!;
      const { resolution: _resolution, ...withoutResolution } = track;
      const { codec: _codec, ...withoutCodec } = track;
      // "Not stated" is NULL and nothing else: no absent member, no invented word, no empty text, no default.
      for (const candidate of [withoutResolution, withoutCodec, { ...track, codec: 'UNKNOWN' }, { ...track, resolution: '' }, { ...track, resolution: 'unknown' }, { ...track, codec: '' }]) {
        expect(VideoStatusResponseSchema.safeParse({ tracks: [candidate, video.tracks[1]] }).success).toBe(false);
      }
      for (const candidate of [{ ...track, resolution: '1080p', codec: null }, { ...track, resolution: null, codec: 'HEVC' }, { ...track, resolution: '720p', fps: 25, codec: 'H.264' }]) {
        expect(VideoStatusResponseSchema.safeParse({ tracks: [candidate, video.tracks[1]] }).success).toBe(true);
      }
    });
  });
});

// Task 4 row V7d (decisions C126 (b), C141; request line 567 of row V7c): operations 44 and 46 state the stream state of
// the track's selector LINE - null (NOT READ) included - and null for a track without a line. Until this row a null line
// and a missing line fell back to LIVE from the hardware slice's `online` flag: an idle registered camera read LIVE here
// while its line said "not read". Mutations: implementation/v7d_op44_not_read.md.
describe('row V7d: operations 44 and 46 say NOT READ where the line does, and for a track without a line - never LIVE from `online`', () => {
  const stated = (tracks: readonly { readonly trackId: string; readonly sourceDeviceId: string | null; readonly streamState: string | null }[]) =>
    tracks.map((track) => [track.trackId, track.sourceDeviceId, track.streamState]);

  it('a registered camera on VIDEO-02 whose line states null: null on both reads although the hardware slice says online; no line: null; CONTROL: the built-in line LIVE', () => {
    const idle = scenarioState('idle');
    const state = {
      ...idle,
      captureConfig: { ...idle.captureConfig, cameras: idle.captureConfig.cameras.map((line) => (line.trackId === 'VIDEO-02' ? { ...line, deviceId: 'CAM-07', streamState: null } : line)) },
    } as SimState;
    // The flag the old fallback read: both cameras of the hardware slice are online.
    expect(state.cameras.map((camera) => camera.online)).toEqual([true, true]);
    const video = videoStatusOf(committedOf(state));
    const health = deviceHealthOf(committedOf(state), NOW);
    expect(stated(video.tracks)).toEqual([['VIDEO-01', 'CAM-01', 'LIVE'], ['VIDEO-02', 'CAM-07', null]]);
    expect(stated(health.cameras)).toEqual(stated(video.tracks));
    expect(VideoStatusResponseSchema.safeParse(video).success).toBe(true);
    expect(DeviceHealthResponseSchema.safeParse(health).success).toBe(true);

    const none = { ...state, captureConfig: { ...state.captureConfig, cameras: state.captureConfig.cameras.filter((line) => line.trackId === 'VIDEO-02') } } as SimState;
    expect(stated(videoStatusOf(committedOf(none)).tracks)).toEqual([['VIDEO-01', null, null], ['VIDEO-02', 'CAM-07', null]]);
    expect(stated(deviceHealthOf(committedOf(none), NOW).cameras)).toEqual([['VIDEO-01', null, null], ['VIDEO-02', 'CAM-07', null]]);
  });
});
