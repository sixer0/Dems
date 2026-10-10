// The answers of the four device reads, as pure functions over a committed state (plan row W36;
// spec §7.10 operations 44 to 47, §7.1 API-5 and API-6). No app, no database.
//
// Operations 44, 45 and 46 are design-book operations: in Simulated mode the in-app simulator
// answers them (`handleSimApiRequest`). Here each answer of the module is held against that
// handler on the SAME state, member by member, so Live mode cannot drift from Simulated mode in
// what a read says. The one difference is stated and measured: the 20 Hz meter levels, which
// are no part of the committed state (a recorded difference, ruled by D89; formerly gap BE-GAP-W36-1).
import { AudioStatusResponseSchema, DeviceHealthResponseSchema, DeviceInventorySchema, VideoStatusResponseSchema, validateCoreApiResponse } from '@dems/shared/api';
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
} from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { DURABLE_SLICE_KEYS, UNMAPPED_SLICES } from '../../../db/mapping';
import { SCENARIOS, createHost } from '../../../../test/support/seed';
import { audioStatusOf, deviceHealthOf, deviceInventoryOf, stateLevelsOf, storageStatusOf, videoStatusOf, type CommittedState } from '../index';
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
