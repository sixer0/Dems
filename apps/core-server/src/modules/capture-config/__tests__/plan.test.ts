// The `CapturePlan` builder (blueprint row 66 / M4-W2; capture spec §A.3, §B.2, §A.1.1; decisions
// D72(g), D82, D86 C-5; check M4-LOCAL-PLAN-1, plan-builder half; row 66 verification "the plan
// builder's unit test yields device-ID subjects only (0 `VIDEO-0x` subjects) for the seeded
// configuration").
//
// Pure: the fake registry of row 65 holds the seeded devices behind in-memory adapters; nothing is
// opened except the fakes' own stream handles (a pipe NAME under a directory that does not exist).
//
// D61 (2026-11-04): the microphone plane of the selector and the plan is the FOUR numbered channels
// `MIC-01`..`MIC-04` (the PRIMARY/STANDBY roles are superseded, and the caller now names each
// channel's OWN audio file - the `outputPath` of the protocol's D61 wave).
import { CAPTURE_MIC_CHANNELS, CapturePlanSchema, LOOPBACK_RTSP_URL, StartMessageSchema, CAPTURE_PROTOCOL_VERSION } from '@dems/capture-protocol';
import { CAPTURE_PAIRS, CAPTURE_START_REQUIRED_SLOTS, DEFAULT_CAPTURE_CONFIG, DEFAULT_SEED, PRECHECK_ORDER, createIdleState, evaluatePrecheck, micChannelOfVideoTrack, unassignedSlotOfPrecheckItem, unassignedSlotsOf, type SimState } from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import {
  CaptureAdapterKind,
  CaptureOperation,
  FakeTopology,
  createCaptureDeviceRegistry,
  createFakeAudioInputAdapter,
  createFakeCameraAdapter,
  createFakeRegistry,
  sourceClassOf,
  type AudioInputAdapter,
  type CameraAdapter,
  type CaptureDeviceDescriptor,
} from '../../../capture/adapters';
import {
  CapturePlanError,
  assertRecordableSelector,
  buildCapturePlan,
  capturePlanConstants,
  capturePlanPairWarnings,
  capturePlanSubjects,
  type CapturePlanInput,
  type CapturePlanMicSource,
  type CapturePlanRegistry,
  type CapturePlanSelector,
} from '../plan';

/** The builder's mic member, in its MUTABLE form: the helper below fills it channel by channel. */
type MicSources = { [K in (typeof CAPTURE_MIC_CHANNELS)[number]]?: CapturePlanMicSource };

const RUN_DIR = '/nonexistent/dems-run/capture';
const MEDIA = '/nonexistent/dems-media/SES-000123';
const SESSION = 'SES-000123';

/** The seeded selector: CAM-0n -> VIDEO-0n (D60) and MIC-01..MIC-04 on their own numbered CHANNELS (D61, 2026-11-04). */
const SEEDED: CapturePlanSelector = DEFAULT_CAPTURE_CONFIG;

const CAMERA_SOURCES: CapturePlanInput['cameras'] = {
  'VIDEO-01': { ingestUrl: 'rtsp://127.0.0.1:8554/cam1', outputPath: `${MEDIA}/VIDEO-01.mp4` },
  'VIDEO-02': { ingestUrl: 'rtsp://127.0.0.1:8555/cam2', outputPath: `${MEDIA}/VIDEO-02.mp4` },
  // D60 (2026-11-04): the seeded selector plans FOUR tracks, so the caller must bring four sources.
  'VIDEO-03': { ingestUrl: 'rtsp://127.0.0.1:8556/cam3', outputPath: `${MEDIA}/VIDEO-03.mp4` },
  'VIDEO-04': { ingestUrl: 'rtsp://127.0.0.1:8557/cam4', outputPath: `${MEDIA}/VIDEO-04.mp4` },
};

/** One microphone source of the test: an opened input and the file the caller names for its channel (D61). */
function micSource(channel: (typeof CAPTURE_MIC_CHANNELS)[number], input: CapturePlanMicSource['input']): CapturePlanMicSource {
  return { input, outputPath: `${MEDIA}/${channel}.m4a` }; // D61 (2026-11-04): the twin of a camera's outputPath, named per channel
}

/**
 * The inputs of the fake microphones BY DEVICE ID, taken from their opened handles and from nowhere
 * else (D72(e)). The builder's member is keyed by CHANNEL - `sourcesOf` puts them there.
 */
async function micInputs(mics: readonly AudioInputAdapter[]): Promise<Record<string, CapturePlanMicSource['input']>> {
  const inputs: Record<string, CapturePlanMicSource['input']> = {};
  for (const adapter of mics) {
    for (const device of adapter.devices) {
      const handle = await adapter.open(device.id, { sessionId: SESSION, signal: new AbortController().signal });
      inputs[device.id] = handle.input;
    }
  }
  return inputs;
}

/**
 * The builder's mic member for a SELECTOR (D61, 2026-11-04): one entry per numbered channel, each
 * with the opened input of the device assigned to it - or a pipe name of its own where the device is
 * one the fake registry does not hold (a stale or candidate ID: the test asks the REFUSAL of that
 * selector, never its plan).
 */
function sourcesOf(selector: CapturePlanSelector, byDevice: Readonly<Record<string, CapturePlanMicSource['input']>>): MicSources {
  const sources: MicSources = {};
  for (const mic of selector.mics) {
    const channel = mic.channel as (typeof CAPTURE_MIC_CHANNELS)[number];
    sources[channel] = micSource(channel, byDevice[mic.deviceId] ?? { kind: 'PCM_FIFO', path: `${RUN_DIR}/${SESSION}/${mic.deviceId.toLowerCase()}.pcm` });
  }
  return sources;
}

async function seededInput(over: Partial<CapturePlanInput> = {}): Promise<CapturePlanInput> {
  const fake = createFakeRegistry({ runDir: RUN_DIR });
  const byDevice = await micInputs(fake.mics);
  return { selector: SEEDED, registry: fake.registry, cameras: CAMERA_SOURCES, mics: sourcesOf(over.selector ?? SEEDED, byDevice), pcmTapPath: `${RUN_DIR}/${SESSION}/tap.pcm`, ...over };
}

function refusalOf(run: () => unknown): { code: string; reason: string; deviceId: string | null } | 'no refusal' {
  try {
    run();
  } catch (error) {
    if (error instanceof CapturePlanError) return { code: error.code, reason: error.reason, deviceId: error.deviceId };
    throw error;
  }
  return 'no refusal';
}

/** A registry stand-in that answers from a table: for the rules the real registry cannot be brought to break. */
function tableRegistry(operation: CaptureOperation, kinds: Readonly<Record<string, CaptureAdapterKind>>): CapturePlanRegistry {
  return {
    operation,
    assertRecordable(deviceId): CaptureDeviceDescriptor {
      const adapterKind = kinds[deviceId];
      if (adapterKind === undefined) throw new Error(`the test table has no ${deviceId}`);
      return { id: deviceId, deviceClass: deviceId.startsWith('CAM') ? 'CAMERA' : 'MIC', label: deviceId, capabilities: [], profiles: [], adapterKind, sourceClass: sourceClassOf(adapterKind), hasOpener: true };
    },
  };
}

describe('the plan of the seeded configuration', () => {
  it('names device IDs as its subjects: 0 `VIDEO-0x` subjects; a track is the output name only (D72(g))', async () => {
    const plan = buildCapturePlan(await seededInput());
    expect(plan.cameras.map((camera) => [camera.deviceId, camera.trackId])).toEqual([
      ['CAM-01', 'VIDEO-01'],
      ['CAM-02', 'VIDEO-02'],
      ['CAM-03', 'VIDEO-03'], // D60 (2026-11-04): four tracks at once
      ['CAM-04', 'VIDEO-04'],
    ]);
    // D61 (2026-11-04): the four numbered channels, each on its built-in device of the same number.
    expect(plan.mics.map((mic) => [mic.deviceId, mic.channel])).toEqual([
      ['MIC-01', 'MIC-01'],
      ['MIC-02', 'MIC-02'],
      ['MIC-03', 'MIC-03'],
      ['MIC-04', 'MIC-04'],
    ]);
    const subjects = capturePlanSubjects(plan);
    // D61: the microphone half of the subject list is the four device IDs and the four channel words - the same
    // words for the built-ins (the role words PRIMARY/STANDBY left the plan with the two-role lane).
    expect(subjects).toEqual(['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']);
    expect(subjects.filter((subject) => subject.startsWith('VIDEO-'))).toEqual([]);
    // Every `VIDEO-0x` of the whole plan is the value of a `trackId` or part of an output path the
    // caller chose: no other member of the plan holds one.
    const elsewhere = JSON.stringify({ ...plan, cameras: plan.cameras.map(({ trackId: _track, outputPath: _path, ...rest }) => rest) });
    expect(elsewhere).not.toMatch(/VIDEO-0/);
    // Control: the check can fail. A plan that named the track as its subject is found.
    const wrong = { ...plan, cameras: plan.cameras.map((camera) => ({ ...camera, deviceId: camera.trackId })) };
    expect(capturePlanSubjects(wrong).filter((subject) => subject.startsWith('VIDEO-'))).toEqual(['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04']); // D60
  });

  it('is a plan of the protocol: it is the payload of START, with the contract constants and the transcribed channel active (D61)', async () => {
    const input = await seededInput();
    const plan = buildCapturePlan(input);
    expect(CapturePlanSchema.safeParse(plan).success).toBe(true);
    expect(StartMessageSchema.safeParse({ v: CAPTURE_PROTOCOL_VERSION, type: 'START', sessionId: SESSION, correlationId: 'c-1', attempt: 1, plan }).success).toBe(true);
    expect(plan.activeMic).toBe('MIC-01'); // D61 (2026-11-04): the transcribed channel of AUDIO-01
    expect(plan.constants).toEqual(capturePlanConstants());
    expect(plan.pcmTapPath).toBe(`${RUN_DIR}/${SESSION}/tap.pcm`);
    for (const camera of plan.cameras) expect(camera.ingestUrl).toMatch(LOOPBACK_RTSP_URL);
    // A microphone's input is its opened handle's, unchanged, and its file is the one the caller named
    // (D61, 2026-11-04: the per-channel `outputPath` the session start gives the builder).
    expect(plan.mics.map((mic) => mic.input)).toEqual(CAPTURE_MIC_CHANNELS.map((channel) => input.mics[channel]!.input));
    expect(plan.mics.map((mic) => mic.outputPath)).toEqual(CAPTURE_MIC_CHANNELS.map((channel) => `${MEDIA}/${channel}.m4a`));
    expect(plan.cameras.map((camera) => camera.profile)).toEqual(SEEDED.cameras.map((camera) => camera.profile));
  });

  it('follows the selector, not the seed: a swapped pair of cameras and a swapped transcription pair', async () => {
    const swapped: CapturePlanSelector = {
      cameras: [
        { trackId: 'VIDEO-01', deviceId: 'CAM-02', profile: 'H264_1080P25' },
        { trackId: 'VIDEO-02', deviceId: 'CAM-01', profile: 'H264_1080P25' },
        // D60 (2026-11-04): the selector names four tracks; only the first pair is swapped.
        { trackId: 'VIDEO-03', deviceId: 'CAM-03', profile: 'H264_1080P25' },
        { trackId: 'VIDEO-04', deviceId: 'CAM-04', profile: 'H264_1080P25' },
      ],
      // D61 (2026-11-04): the swap is of the DEVICES on the channels: channel 1 (the transcribed one) gets MIC-02.
      mics: [
        { channel: 'MIC-01', deviceId: 'MIC-02' },
        { channel: 'MIC-02', deviceId: 'MIC-01' },
        { channel: 'MIC-03', deviceId: 'MIC-03' },
        { channel: 'MIC-04', deviceId: 'MIC-04' },
      ],
    };
    const plan = buildCapturePlan(await seededInput({ selector: swapped }));
    expect(plan.cameras.map((camera) => [camera.deviceId, camera.trackId, camera.outputPath])).toEqual([
      ['CAM-02', 'VIDEO-01', `${MEDIA}/VIDEO-01.mp4`],
      ['CAM-01', 'VIDEO-02', `${MEDIA}/VIDEO-02.mp4`],
      ['CAM-03', 'VIDEO-03', `${MEDIA}/VIDEO-03.mp4`], // D60
      ['CAM-04', 'VIDEO-04', `${MEDIA}/VIDEO-04.mp4`],
    ]);
    expect(plan.mics.map((mic) => [mic.deviceId, mic.channel])).toEqual([
      ['MIC-02', 'MIC-01'],
      ['MIC-01', 'MIC-02'],
      ['MIC-03', 'MIC-03'],
      ['MIC-04', 'MIC-04'],
    ]);
  });

  it("one camera of four is the caller's decision (D72(k)); a source set that leaves a channel out - the transcribed one included - is a plan with the absence STATED (row 147, D30 K-3)", async () => {
    const base = await seededInput();
    const oneCamera = buildCapturePlan({ ...base, cameras: { 'VIDEO-02': CAMERA_SOURCES['VIDEO-02']! } });
    expect(oneCamera.cameras.map((camera) => camera.deviceId)).toEqual(['CAM-02']);
    // Row 147 (D30 K-3 beats S5 N-37; D117 R144-1). Until row 147 a source set that left a numbered channel out was refused
    // (PROTOCOL_SHAPE under v5's four rows, then the v6 bridge), and one without channel 1 was SOURCE_MISSING (D83 carried by D61).
    // Now: the plan records, each camera whose paired channel is absent says NOT_OPENED, and the caller is handed the WARN.
    const onlyChannelOne = buildCapturePlan({ ...base, mics: { 'MIC-01': base.mics['MIC-01']! } });
    expect(onlyChannelOne.cameras.map((camera) => [camera.trackId, camera.micChannel, camera.micMissing])).toEqual([
      ['VIDEO-01', 'MIC-01', null],
      ['VIDEO-02', 'MIC-02', 'NOT_OPENED'],
      ['VIDEO-03', 'MIC-03', 'NOT_OPENED'],
      ['VIDEO-04', 'MIC-04', 'NOT_OPENED'],
    ]);
    expect(capturePlanPairWarnings(onlyChannelOne).map((warning) => [warning.code, warning.trackId, warning.micChannel, warning.reason])).toEqual([
      ['PAIRED_MIC_MISSING', 'VIDEO-02', 'MIC-02', 'NOT_OPENED'],
      ['PAIRED_MIC_MISSING', 'VIDEO-03', 'MIC-03', 'NOT_OPENED'],
      ['PAIRED_MIC_MISSING', 'VIDEO-04', 'MIC-04', 'NOT_OPENED'],
    ]);
    const noTranscribedChannel: MicSources = { ...base.mics } as MicSources;
    delete noTranscribedChannel['MIC-01'];
    const untranscribed = buildCapturePlan({ ...base, mics: noTranscribedChannel });
    expect(untranscribed.cameras[0]).toMatchObject({ trackId: 'VIDEO-01', micChannel: 'MIC-01', micMissing: 'NOT_OPENED' });
    expect(untranscribed.activeMic).toBe('MIC-01'); // DF-09 R-T1: the transcribed channel does not move to another microphone
    expect(untranscribed.pcmTapPath).toBeNull(); // nothing to transcribe: the tap the caller asked for is dropped, not refused
    expect(capturePlanPairWarnings(untranscribed)).toEqual([{ code: 'PAIRED_MIC_MISSING', trackId: 'VIDEO-01', deviceId: 'CAM-01', micChannel: 'MIC-01', reason: 'NOT_OPENED', transcribed: true }]);
    // No camera at all is still no plan.
    expect(refusalOf(() => buildCapturePlan({ ...base, cameras: {} }))).toEqual({ code: 'CAPTURE_PLAN_INVALID', reason: 'SOURCE_MISSING', deviceId: null });
    // A source keyed by an inherited name is no source.
    expect(refusalOf(() => buildCapturePlan({ ...base, cameras: Object.create({ 'VIDEO-01': CAMERA_SOURCES['VIDEO-01'] }) as CapturePlanInput['cameras'] }))).toMatchObject({ reason: 'SOURCE_MISSING' });
    const inheritedMic = buildCapturePlan({ ...base, mics: Object.create({ 'MIC-01': base.mics['MIC-01'] }) as CapturePlanInput['mics'] });
    expect(inheritedMic.mics).toEqual([]);
    expect(inheritedMic.cameras.every((camera) => camera.micMissing === 'NOT_OPENED')).toBe(true);
  });
});

describe('camera-microphone pairs (row 147; D5 S5 §2.3-2.4, D27, D30 K-3, DF-09)', () => {
  it('the seeded plan: each camera line carries its same-number channel, the shared pair table agrees, nothing is missing and there is no WARN', async () => {
    const plan = buildCapturePlan(await seededInput());
    expect(plan.cameras.map((camera) => [camera.trackId, camera.micChannel, camera.micMissing])).toEqual([
      ['VIDEO-01', 'MIC-01', null],
      ['VIDEO-02', 'MIC-02', null],
      ['VIDEO-03', 'MIC-03', null],
      ['VIDEO-04', 'MIC-04', null],
    ]);
    // Row 143's shared contract (N-05, N-06) and the protocol's restatement name the same pair for every camera line.
    for (const camera of plan.cameras) {
      expect(camera.micChannel).toBe(micChannelOfVideoTrack(camera.trackId as (typeof CAPTURE_PAIRS)[number]['videoTrackId']));
      expect(camera.micChannel).toBe(CAPTURE_PAIRS.find((pair) => pair.videoTrackId === camera.trackId)?.micChannel);
    }
    expect(capturePlanPairWarnings(plan)).toEqual([]);
  });

  it('all 256 source sets (which of the 4 cameras and 4 channels the start could open): paired channel per camera; a missing paired mic -> micMissing NOT_OPENED + one WARN, never a refusal; activeMic MIC-01; tap only with channel 1', async () => {
    const base = await seededInput();
    const TRACKS = ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04'] as const;
    const TAP = `${RUN_DIR}/${SESSION}/tap.pcm`;
    let plans = 0;
    let refusals = 0;
    let warnings = 0;
    for (let bits = 0; bits < 256; bits += 1) {
      const cameraGiven = TRACKS.filter((_track, index) => (bits & (1 << index)) !== 0);
      const micGiven = CAPTURE_MIC_CHANNELS.filter((_channel, index) => (bits & (1 << (index + 4))) !== 0);
      const cameras: Partial<Record<(typeof TRACKS)[number], NonNullable<CapturePlanInput['cameras']['VIDEO-01']>>> = {};
      for (const track of cameraGiven) cameras[track] = CAMERA_SOURCES[track]!;
      const mics: MicSources = {};
      for (const channel of micGiven) mics[channel] = base.mics[channel]!;
      const label = `cameras ${cameraGiven.join('+') || '-'} mics ${micGiven.join('+') || '-'}`;
      const refusal = refusalOf(() => buildCapturePlan({ ...base, cameras, mics, pcmTapPath: TAP }));
      if (cameraGiven.length === 0) {
        expect(refusal, label).toEqual({ code: 'CAPTURE_PLAN_INVALID', reason: 'SOURCE_MISSING', deviceId: null });
        refusals += 1;
        continue;
      }
      expect(refusal, label).toBe('no refusal');
      const plan = buildCapturePlan({ ...base, cameras, mics, pcmTapPath: TAP });
      plans += 1;
      expect(CapturePlanSchema.safeParse(plan).success, label).toBe(true);
      expect(StartMessageSchema.safeParse({ v: CAPTURE_PROTOCOL_VERSION, type: 'START', sessionId: SESSION, correlationId: 'c-1', attempt: 1, plan }).success, label).toBe(true);
      expect(plan.cameras.map((camera) => camera.trackId), label).toEqual(cameraGiven);
      expect(plan.mics.map((mic) => mic.channel), label).toEqual(micGiven); // a channel without a camera of the plan is still recorded
      for (const camera of plan.cameras) {
        const paired = micChannelOfVideoTrack(camera.trackId as (typeof TRACKS)[number]);
        expect(camera.micChannel, label).toBe(paired);
        expect(camera.micMissing, label).toBe(micGiven.includes(paired) ? null : 'NOT_OPENED');
      }
      const expected = plan.cameras.filter((camera) => camera.micMissing !== null).map((camera) => ({ code: 'PAIRED_MIC_MISSING', trackId: camera.trackId, deviceId: camera.deviceId, micChannel: camera.micChannel, reason: 'NOT_OPENED', transcribed: camera.trackId === 'VIDEO-01' }));
      expect(capturePlanPairWarnings(plan), label).toEqual(expected);
      warnings += expected.length;
      // DF-09 R-T1 pin: the transcribed channel is MIC-01 in every plan; the tap exists exactly when MIC-01 is recorded.
      expect(plan.activeMic, label).toBe('MIC-01');
      expect(plan.pcmTapPath, label).toBe(micGiven.includes('MIC-01') ? TAP : null);
    }
    expect([plans, refusals]).toEqual([240, 16]);
    // Each of the four pairs has its camera given and its channel absent in a quarter of the 256 sets: 4 x 64 WARNs.
    expect(warnings).toBe(256);
  });

  it('NOT_ASSIGNED: the start still refuses an unassigned slot (SELECTOR_SHAPE, AD-10 (4)), so the builder only ever states NOT_OPENED; the protocol and the WARN carry the other word unchanged', async () => {
    const plan = buildCapturePlan({ ...(await seededInput()), mics: {} });
    expect(plan.cameras.map((camera) => camera.micMissing)).toEqual(['NOT_OPENED', 'NOT_OPENED', 'NOT_OPENED', 'NOT_OPENED']);
    expect(plan.pcmTapPath).toBeNull();
    const unassigned = CapturePlanSchema.parse({ ...plan, cameras: plan.cameras.map((camera) => ({ ...camera, micMissing: 'NOT_ASSIGNED' })) });
    expect(capturePlanPairWarnings(unassigned).map((warning) => warning.reason)).toEqual(['NOT_ASSIGNED', 'NOT_ASSIGNED', 'NOT_ASSIGNED', 'NOT_ASSIGNED']);
    // Controls: a camera that states no absence while its channel is missing, or names another pair's channel, is no plan of the protocol.
    expect(CapturePlanSchema.safeParse({ ...plan, cameras: plan.cameras.map((camera) => ({ ...camera, micMissing: null })) }).success).toBe(false);
    expect(CapturePlanSchema.safeParse({ ...plan, cameras: [{ ...plan.cameras[0]!, micChannel: 'MIC-02' }] }).success).toBe(false);
    expect(CapturePlanSchema.safeParse({ ...plan, activeMic: 'MIC-02' }).success).toBe(false); // DF-09: no other transcribed channel
  });

  it('the swap pins (D22(3), op 78/80 swap): the pair follows the CHANNEL, not the device - Camera 1 records the microphone that now sits on MIC-01, and a swapped-in microphone that fails to open is stated on Camera 1', async () => {
    // The selector after a two-line swap of the devices on channels 1 and 2 (AC-4.4's body form, on the seeded devices).
    const swapped: CapturePlanSelector = { ...SEEDED, mics: [{ channel: 'MIC-01', deviceId: 'MIC-02' }, { channel: 'MIC-02', deviceId: 'MIC-01' }, SEEDED.mics[2]!, SEEDED.mics[3]!] };
    const base = await seededInput({ selector: swapped });
    const plan = buildCapturePlan(base);
    const deviceOnChannel = new Map(plan.mics.map((mic) => [mic.channel, mic.deviceId]));
    expect(plan.cameras.map((camera) => [camera.trackId, camera.micChannel, deviceOnChannel.get(camera.micChannel), camera.micMissing])).toEqual([
      ['VIDEO-01', 'MIC-01', 'MIC-02', null],
      ['VIDEO-02', 'MIC-02', 'MIC-01', null],
      ['VIDEO-03', 'MIC-03', 'MIC-03', null],
      ['VIDEO-04', 'MIC-04', 'MIC-04', null],
    ]);
    expect(plan.activeMic).toBe('MIC-01'); // the transcribed CHANNEL stays; the device MIC-02 is now the transcribed microphone
    expect(plan.pcmTapPath).toBe(`${RUN_DIR}/${SESSION}/tap.pcm`);
    // The swapped-in device on channel 1 could not be opened: Camera 1 records silence and the session has no tap; Camera 2 keeps MIC-01.
    const withoutChannelOne: MicSources = { ...base.mics } as MicSources;
    delete withoutChannelOne['MIC-01'];
    const failed = buildCapturePlan({ ...base, mics: withoutChannelOne });
    expect(failed.cameras.map((camera) => camera.micMissing)).toEqual(['NOT_OPENED', null, null, null]);
    expect(failed.mics.find((mic) => mic.channel === 'MIC-02')?.deviceId).toBe('MIC-01');
    expect(failed.pcmTapPath).toBeNull();
    expect(capturePlanPairWarnings(failed)).toEqual([{ code: 'PAIRED_MIC_MISSING', trackId: 'VIDEO-01', deviceId: 'CAM-01', micChannel: 'MIC-01', reason: 'NOT_OPENED', transcribed: true }]);
  });
});

describe('what is refused before anything is opened (D86 C-5, D82): SOURCE_KIND_NOT_RECORDABLE', () => {
  const productionCamera = (id: string): CameraAdapter => ({ ...createFakeCameraAdapter({ id }), kind: CaptureAdapterKind.ONVIF_RTSP, hasOpener: false });

  it('a source kind without an opener: a production camera in the selector, in either real operation', async () => {
    const base = await seededInput();
    // REAL_DEVELOPMENT registers the production camera kind for its search and test half only. D60 (2026-11-04): the fake registry now holds CAM-03/04 too - the candidate is CAM-07.
    const development = createFakeRegistry({ runDir: RUN_DIR });
    development.registry.register(productionCamera('CAM-07'));
    const selector: CapturePlanSelector = { ...SEEDED, cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-07', profile: 'H264_1080P25' }, SEEDED.cameras[1]!, SEEDED.cameras[2]!, SEEDED.cameras[3]!] };
    const refused = { code: 'SOURCE_KIND_NOT_RECORDABLE', reason: 'NO_OPENER', deviceId: 'CAM-07' };
    expect(refusalOf(() => assertRecordableSelector(selector, development.registry))).toEqual(refused);
    expect(refusalOf(() => buildCapturePlan({ ...base, selector, registry: development.registry }))).toEqual(refused);

    // REAL_PRODUCTION (task 4 row 88, THE LIFT; specification 6.3 "Test: plan builder ... rewritten"): a production source whose
    // adapter states NO opener is still refused by name - the adapter's word decides (on `darwin` the microphone's, AM-1 (3)(h)).
    const production = createCaptureDeviceRegistry({ operation: CaptureOperation.REAL_PRODUCTION });
    for (const id of ['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04']) production.register(productionCamera(id)); // D60: four camera lines
    expect(refusalOf(() => buildCapturePlan({ ...base, registry: production }))).toEqual({ code: 'SOURCE_KIND_NOT_RECORDABLE', reason: 'NO_OPENER', deviceId: 'CAM-01' });
    // ... and the six production sources that state their opener ARE a plan since the lift (before it: refused at registration).
    const lifted = createCaptureDeviceRegistry({ operation: CaptureOperation.REAL_PRODUCTION });
    for (const id of ['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04']) lifted.register({ ...createFakeCameraAdapter({ id }), kind: CaptureAdapterKind.ONVIF_RTSP }); // D60
    for (const id of ['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']) lifted.register({ ...createFakeAudioInputAdapter({ id, runDir: RUN_DIR }), kind: CaptureAdapterKind.USB_AUDIO }); // D61 (2026-11-04): the four channels of the numbered plane
    expect(assertRecordableSelector(SEEDED, lifted).sourceClass).toBe('PRODUCTION');
    expect(capturePlanSubjects(buildCapturePlan({ ...base, registry: lifted }))).toEqual(['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']); // D60, D61
    // ... unless ONE of the eight states none (the darwin microphone): refused by that device.
    const darwin = createCaptureDeviceRegistry({ operation: CaptureOperation.REAL_PRODUCTION });
    for (const id of ['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04']) darwin.register({ ...createFakeCameraAdapter({ id }), kind: CaptureAdapterKind.ONVIF_RTSP }); // D60
    for (const id of ['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']) darwin.register({ ...createFakeAudioInputAdapter({ id, runDir: RUN_DIR }), kind: CaptureAdapterKind.USB_AUDIO, hasOpener: false }); // D61: four channels
    expect(refusalOf(() => buildCapturePlan({ ...base, registry: darwin }))).toEqual({ code: 'SOURCE_KIND_NOT_RECORDABLE', reason: 'NO_OPENER', deviceId: 'MIC-01' });
    // Control: the same selector over the fake registry is a plan.
    expect(refusalOf(() => buildCapturePlan(base))).toBe('no refusal');
  });

  it('a device no registered adapter serves: every device in SIMULATED, a stale or candidate ID anywhere', async () => {
    const base = await seededInput();
    const simulated = createCaptureDeviceRegistry({ operation: CaptureOperation.SIMULATED });
    expect(refusalOf(() => buildCapturePlan({ ...base, registry: simulated }))).toEqual({ code: 'SOURCE_KIND_NOT_RECORDABLE', reason: 'NO_ADAPTER', deviceId: 'CAM-01' });
    const stale: CapturePlanSelector = { ...SEEDED, mics: [{ channel: 'MIC-01', deviceId: 'MIC-01' }, { channel: 'MIC-02', deviceId: 'MIC-07' }, { channel: 'MIC-03', deviceId: 'MIC-03' }, { channel: 'MIC-04', deviceId: 'MIC-04' }] };
    expect(refusalOf(() => assertRecordableSelector(stale, base.registry))).toEqual({ code: 'SOURCE_KIND_NOT_RECORDABLE', reason: 'NO_ADAPTER', deviceId: 'MIC-07' });
    // A LATER channel's device is refused although it feeds no transcription: all eight slots are looked at (D61).
    expect(refusalOf(() => buildCapturePlan({ ...base, selector: stale, mics: sourcesOf(stale, { 'MIC-01': base.mics['MIC-01']!.input }) }))).toMatchObject({ reason: 'NO_ADAPTER', deviceId: 'MIC-07' });
  });

  it('a mixed selector, one production and one development source, is refused (D82), and so is a class the operation does not record', async () => {
    const base = await seededInput();
    const allFake = { 'CAM-01': CaptureAdapterKind.FAKE, 'CAM-02': CaptureAdapterKind.FAKE, 'CAM-03': CaptureAdapterKind.FAKE, 'CAM-04': CaptureAdapterKind.FAKE, 'MIC-01': CaptureAdapterKind.FAKE, 'MIC-02': CaptureAdapterKind.FAKE, 'MIC-03': CaptureAdapterKind.FAKE, 'MIC-04': CaptureAdapterKind.FAKE }; // D60 (2026-11-04): four cameras; D61 (2026-11-04): four channels - the selector names eight devices
    // Control: the table registry is no refusal by itself.
    expect(refusalOf(() => buildCapturePlan({ ...base, registry: tableRegistry(CaptureOperation.REAL_DEVELOPMENT, allFake) }))).toBe('no refusal');
    for (const [deviceId, kind] of [
      ['CAM-01', CaptureAdapterKind.ONVIF_RTSP],
      ['CAM-02', CaptureAdapterKind.ONVIF_RTSP],
      ['CAM-03', CaptureAdapterKind.ONVIF_RTSP],
      ['MIC-01', CaptureAdapterKind.USB_AUDIO],
      ['MIC-02', CaptureAdapterKind.USB_AUDIO],
      ['MIC-03', CaptureAdapterKind.USB_AUDIO], // D61 (2026-11-04): a mixed class on any of the four channels
      ['MIC-04', CaptureAdapterKind.USB_AUDIO],
    ] as const) {
      const mixed = tableRegistry(CaptureOperation.REAL_DEVELOPMENT, { ...allFake, [deviceId]: kind });
      expect(refusalOf(() => buildCapturePlan({ ...base, registry: mixed })), deviceId).toEqual({ code: 'SOURCE_KIND_NOT_RECORDABLE', reason: 'MIXED_SOURCE_CLASSES', deviceId: null });
    }
    // The local camera beside the fakes is ONE class (development): the eight slots of spec §A.1.1 (D60 four video, D61 four numbered channels).
    const local = tableRegistry(CaptureOperation.REAL_DEVELOPMENT, { 'CAM-03': CaptureAdapterKind.LOCAL_DEVICE, 'CAM-02': CaptureAdapterKind.FAKE, 'CAM-04': CaptureAdapterKind.LOCAL_DEVICE, 'CAM-05': CaptureAdapterKind.FAKE, 'MIC-03': CaptureAdapterKind.LOCAL_DEVICE, 'MIC-02': CaptureAdapterKind.FAKE, 'MIC-04': CaptureAdapterKind.FAKE, 'MIC-05': CaptureAdapterKind.LOCAL_DEVICE }); // D60, D61
    const eightSlots: CapturePlanSelector = {
      cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-03', profile: 'H264_1080P25' }, SEEDED.cameras[1]!, { trackId: 'VIDEO-03', deviceId: 'CAM-04', profile: 'H264_1080P25' }, { trackId: 'VIDEO-04', deviceId: 'CAM-05', profile: 'H264_1080P25' }],
      mics: [{ channel: 'MIC-01', deviceId: 'MIC-03' }, { channel: 'MIC-02', deviceId: 'MIC-02' }, { channel: 'MIC-03', deviceId: 'MIC-04' }, { channel: 'MIC-04', deviceId: 'MIC-05' }],
    };
    const plan = buildCapturePlan({ ...base, selector: eightSlots, registry: local, mics: sourcesOf(eightSlots, { 'MIC-02': base.mics['MIC-02']!.input }) });
    expect(capturePlanSubjects(plan)).toEqual(['CAM-03', 'CAM-02', 'CAM-04', 'CAM-05', 'MIC-03', 'MIC-02', 'MIC-04', 'MIC-05', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']); // D60, D61
    // D61 (2026-11-04): each channel carries the caller's own audio file - the wiring this test pins for a selector that is not the seed's.
    expect(plan.mics.map((mic) => [mic.channel, mic.outputPath])).toEqual(CAPTURE_MIC_CHANNELS.map((channel) => [channel, `${MEDIA}/${channel}.m4a`]));
    expect(assertRecordableSelector(eightSlots, local).sourceClass).toBe('DEVELOPMENT');
    // All four of one class, but not the class of the operation.
    expect(refusalOf(() => buildCapturePlan({ ...base, registry: tableRegistry(CaptureOperation.REAL_PRODUCTION, allFake) }))).toEqual({ code: 'SOURCE_KIND_NOT_RECORDABLE', reason: 'CLASS_NOT_OF_OPERATION', deviceId: null });
    expect(refusalOf(() => buildCapturePlan({ ...base, registry: tableRegistry(CaptureOperation.SIMULATED, allFake) }))).toMatchObject({ reason: 'CLASS_NOT_OF_OPERATION' });
  });
});

describe('what is no plan: CAPTURE_PLAN_INVALID', () => {
  it('a selector that is not four tracks and the four numbered microphone channels (D60, D61)', async () => {
    const base = await seededInput();
    const shapes: CapturePlanSelector[] = [
      { ...SEEDED, cameras: [SEEDED.cameras[0]!] },
      { ...SEEDED, cameras: [SEEDED.cameras[1]!, SEEDED.cameras[0]!] },
      // D61: one channel named twice (and the plane short of four) is no selector.
      { ...SEEDED, mics: [SEEDED.mics[0]!, { ...SEEDED.mics[1]!, channel: 'MIC-01' }] },
      { ...SEEDED, mics: [SEEDED.mics[0]!, SEEDED.mics[1]!, SEEDED.mics[2]!] },
      { cameras: [], mics: [] },
    ];
    for (const selector of shapes) expect(refusalOf(() => buildCapturePlan({ ...base, selector }))).toEqual({ code: 'CAPTURE_PLAN_INVALID', reason: 'SELECTOR_SHAPE', deviceId: null });
  });

  // Task 4 row 29 (decisions C14, C18 (1), C25; security requirement AD-10 (4); addendum 1.5).
  // `plan.ts` is NOT edited by that row: this case states what it already says about an unassigned
  // slot (an ABSENT line of the selector), and holds it equal to the shared pre-check. C25: in real
  // capture ALL EIGHT slots must be assigned - every numbered channel included (state S-5 of the security
  // check) - so the pre-check and the plan builder never disagree. D60 (2026-11-04): four video slots and two mic roles;
  // D61 (2026-11-04): four video slots and FOUR NUMBERED CHANNELS - eight slots, 2^8 selectors.
  it('AD-10 (4), C25: any unassigned slot - each of the eight alone, and every one of the 255 incomplete selectors - is refused SELECTOR_SHAPE before the registry is asked; the shared pre-check names the same selectors', async () => {
    const base = await seededInput();
    const SLOTS = ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04'] as const; // D60, D61
    const without = (unassigned: readonly string[]): CapturePlanSelector => ({
      cameras: SEEDED.cameras.filter((camera) => !unassigned.includes(camera.trackId)),
      mics: SEEDED.mics.filter((mic) => !unassigned.includes(mic.channel)), // D61 (2026-11-04): the channel is the slot
    });
    /** A registry that fails the case when it is asked: the shape rule answers first, for a selector with a hole. */
    const asked: string[] = [];
    const untouched: CapturePlanRegistry = { operation: CaptureOperation.REAL_PRODUCTION, assertRecordable: (deviceId) => (asked.push(deviceId), base.registry.assertRecordable(deviceId)) };
    expect([...CAPTURE_START_REQUIRED_SLOTS]).toEqual([...SLOTS]);
    // Audit fix rows 83/90 (DF-03): a Core in its own capture (`isOwnCaptureCoreState`: the host clock) holding the seeded
    // selector minus the unassigned slots - the state the twelve-check pre-check reads.
    const idle = createIdleState({ now: Date.UTC(2026, 10, 5), seed: DEFAULT_SEED });
    const ownCaptureOn = (unassigned: readonly string[]): SimState => ({
      ...idle,
      time: { ...idle.time, hostClock: true },
      captureConfig: {
        ...idle.captureConfig,
        cameras: idle.captureConfig.cameras.filter((camera) => !unassigned.includes(camera.trackId)),
        mics: idle.captureConfig.mics.filter((mic) => !unassigned.includes(mic.channel)),
      },
    });
    expect(PRECHECK_ORDER).toHaveLength(12);

    const outcomes: [string, boolean, boolean][] = [];
    for (let bits = 0; bits < 256; bits += 1) { // D60, D61: 2^8 selectors
      const unassigned = SLOTS.filter((_slot, index) => (bits & (1 << index)) !== 0);
      const selector = without(unassigned);
      // The shared rule (`startRecordingTransition`, `evaluatePrecheck`): a required slot that no line names.
      expect(unassignedSlotsOf(selector)).toEqual(unassigned);
      // Audit fix rows 83/90 (DF-03): the twelve-check pre-check names the SAME slots - one "source not assigned" item per slot,
      // in the order of the checks - so every track and every channel the plan refuses has an item of its own.
      const precheckNames = PRECHECK_ORDER.flatMap((id) => {
        const slot = unassignedSlotOfPrecheckItem(evaluatePrecheck(ownCaptureOn(unassigned), id));
        return slot === null ? [] : [slot];
      });
      expect(precheckNames, unassigned.join('+')).toEqual(unassigned);
      const sharedRefuses = unassignedSlotsOf(selector).some((slot) => CAPTURE_START_REQUIRED_SLOTS.includes(slot));
      const refusal = refusalOf(() => assertRecordableSelector(selector, untouched));
      const planRefusesByShape = refusal !== 'no refusal' && refusal.reason === 'SELECTOR_SHAPE';
      if (unassigned.length > 0) {
        expect(refusal, unassigned.join('+')).toEqual({ code: 'CAPTURE_PLAN_INVALID', reason: 'SELECTOR_SHAPE', deviceId: null });
        // And the builder itself, in each real operation and in SIMULATED: no plan, whatever sources were given.
        for (const operation of [CaptureOperation.REAL_PRODUCTION, CaptureOperation.REAL_DEVELOPMENT, CaptureOperation.SIMULATED]) {
          expect(refusalOf(() => buildCapturePlan({ ...base, selector, registry: { ...untouched, operation } })), `${unassigned.join('+')} ${operation}`).toEqual({ code: 'CAPTURE_PLAN_INVALID', reason: 'SELECTOR_SHAPE', deviceId: null });
        }
      }
      outcomes.push([unassigned.join('+'), sharedRefuses, planRefusesByShape]);
    }
    // The two rules agree on all 256: 255 refused, the complete selector not.
    expect(outcomes.filter(([, shared, plan]) => shared !== plan)).toEqual([]);
    expect(outcomes.filter(([, shared]) => shared)).toHaveLength(255);
    expect(outcomes[0]).toEqual(['', false, false]);
    // Each slot alone, by name (S-5 is the last): eight refusals.
    expect(SLOTS.map((slot) => refusalOf(() => assertRecordableSelector(without([slot]), untouched))).map((refusal) => (refusal === 'no refusal' ? refusal : refusal.reason))).toEqual(SLOTS.map(() => 'SELECTOR_SHAPE')); // D60, D61
    // No device was asked for an incomplete selector: only the complete one reached the registry (its eight devices, once).
    expect(asked).toEqual(['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04', 'MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']); // D60, D61
  });

  it('sources the protocol refuses: an address outside loopback, one path twice; and the text of a refusal holds none of them', async () => {
    const base = await seededInput();
    const lan = { ...base, cameras: { ...CAMERA_SOURCES, 'VIDEO-01': { ...CAMERA_SOURCES['VIDEO-01']!, ingestUrl: 'rtsp://192.168.1.20:8554/cam1' } } };
    const twice = { ...base, cameras: { ...CAMERA_SOURCES, 'VIDEO-02': { ...CAMERA_SOURCES['VIDEO-02']!, outputPath: CAMERA_SOURCES['VIDEO-01']!.outputPath } } };
    for (const input of [lan, twice]) {
      expect(refusalOf(() => buildCapturePlan(input))).toEqual({ code: 'CAPTURE_PLAN_INVALID', reason: 'PROTOCOL_SHAPE', deviceId: null });
      try {
        buildCapturePlan(input);
      } catch (error) {
        expect((error as Error).message).not.toMatch(/192\.168|nonexistent|rtsp:|\.mp4/);
      }
    }
  });

  it('a dual-lens camera (one device on both tracks, OD-05) is not expressible in protocol v2: refused, never recorded as one camera', async () => {
    const fake = createFakeRegistry({ runDir: RUN_DIR, topology: FakeTopology.DUAL_LENS });
    const selector: CapturePlanSelector = {
      cameras: [
        { trackId: 'VIDEO-01', deviceId: 'CAM-01', profile: 'H264_1080P25' },
        { trackId: 'VIDEO-02', deviceId: 'CAM-01', profile: 'H264_720P25' },
        // D60 (2026-11-04): the shape rule answers first, so the selector names its four tracks; the refusal is still the device on BOTH of two lines -
        // the dual-lens fake serves CAM-01 alone, so the third and fourth lines repeat it and the first SAME-profile pair is what the pairwise rule names.
        { trackId: 'VIDEO-03', deviceId: 'CAM-01', profile: 'H264_1080P25' },
        { trackId: 'VIDEO-04', deviceId: 'CAM-01', profile: 'H264_720P25' },
      ],
      mics: SEEDED.mics,
    };
    // Row R2 (ruling C93 on review finding F3-11): THE TWO EXPECTATIONS OF THIS CASE MOVED. Until that row the start rule admitted the
    // selector ('no refusal') and only the built plan was refused, after the sources were opened, with no device named (`deviceId: null`).
    // Now the start rule itself refuses it, under the same existing reason, naming the device - the second line of defence behind the
    // selector's own refusal (`routes.ts`, `CAMERA_ON_BOTH_TRACKS`).
    const refused = { code: 'CAPTURE_PLAN_INVALID', reason: 'PROTOCOL_SHAPE', deviceId: 'CAM-01' };
    expect(refusalOf(() => assertRecordableSelector(selector, fake.registry))).toEqual(refused);
    expect(refusalOf(() => buildCapturePlan({ selector, registry: fake.registry, cameras: CAMERA_SOURCES, mics: pipeInputs(fake.mics), pcmTapPath: null }))).toEqual(refused);
    // Before the registry is asked, in every capture operation, and whatever the two profiles are.
    const asked: string[] = [];
    for (const operation of [CaptureOperation.SIMULATED, CaptureOperation.REAL_DEVELOPMENT, CaptureOperation.REAL_PRODUCTION]) {
      const untouched: CapturePlanRegistry = { operation, assertRecordable: (deviceId) => (asked.push(deviceId), fake.registry.assertRecordable(deviceId)) };
      for (const profile of ['H264_720P25', 'H264_1080P25']) {
        const cameras = [selector.cameras[0]!, { ...selector.cameras[1]!, profile }, selector.cameras[2]!, selector.cameras[3]!]; // D60 (2026-11-04): the shape names four tracks; the colliding pair is still the first two
        expect(refusalOf(() => assertRecordableSelector({ ...selector, cameras }, untouched)), `${operation} ${profile}`).toEqual(refused);
      }
    }
    expect(asked).toEqual([]);
    // CONTROL: two cameras on the two tracks are not refused by this rule (the seeded selector on the standard topology).
    expect(refusalOf(() => assertRecordableSelector(SEEDED, createFakeRegistry({ runDir: RUN_DIR }).registry))).toBe('no refusal');
  });
});

/**
 * The pipe names of the fake microphones without opening them: the same form `open` gives (used where a test
 * is not async). D61 (2026-11-04): keyed by CHANNEL, each with its own audio file.
 */
function pipeInputs(mics: readonly AudioInputAdapter[]): MicSources {
  const sources: MicSources = {};
  let index = 0;
  for (const adapter of mics) {
    for (const device of adapter.devices) {
      const channel = CAPTURE_MIC_CHANNELS[index];
      if (channel === undefined) throw new Error('the fake registry holds more microphones than the plan has channels');
      sources[channel] = { input: { kind: 'PCM_FIFO', path: `${RUN_DIR}/${SESSION}/${device.id.toLowerCase()}.pcm` }, outputPath: `${MEDIA}/${channel}.m4a` };
      index += 1;
    }
  }
  return sources;
}
