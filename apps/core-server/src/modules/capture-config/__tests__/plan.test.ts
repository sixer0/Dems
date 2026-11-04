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
import { CAPTURE_START_REQUIRED_SLOTS, DEFAULT_CAPTURE_CONFIG, unassignedSlotsOf } from '@dems/shared/sim';
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

  it("one camera of four is the caller's decision (D72(k)); a source set that leaves the transcribed channel out is no plan (D61, 2026-11-04)", async () => {
    const base = await seededInput();
    const oneCamera = buildCapturePlan({ ...base, cameras: { 'VIDEO-02': CAMERA_SOURCES['VIDEO-02']! } });
    expect(oneCamera.cameras.map((camera) => camera.deviceId)).toEqual(['CAM-02']);
    // D61 (2026-11-04): the microphone plane has no "caller leaves a channel out" case any more - the protocol
    // holds FOUR rows (min = max = 4), so a source set that leaves a numbered channel out is refused as a plan
    // of no protocol, and the rule that still guards the start is the TRANSCRIBED channel: without channel 1
    // (the input of `AUDIO-01`) there is no plan (D83's rule carried onto the numbered plane).
    expect(refusalOf(() => buildCapturePlan({ ...base, mics: { 'MIC-01': base.mics['MIC-01']! } }))).toEqual({ code: 'CAPTURE_PLAN_INVALID', reason: 'PROTOCOL_SHAPE', deviceId: null });
    // No camera at all, and no transcribed channel, are no plan.
    expect(refusalOf(() => buildCapturePlan({ ...base, cameras: {} }))).toEqual({ code: 'CAPTURE_PLAN_INVALID', reason: 'SOURCE_MISSING', deviceId: null });
    const noTranscribedChannel: MicSources = { ...base.mics } as MicSources;
    delete noTranscribedChannel['MIC-01'];
    expect(refusalOf(() => buildCapturePlan({ ...base, mics: noTranscribedChannel }))).toEqual({ code: 'CAPTURE_PLAN_INVALID', reason: 'SOURCE_MISSING', deviceId: null });
    // A source keyed by an inherited name is no source.
    expect(refusalOf(() => buildCapturePlan({ ...base, cameras: Object.create({ 'VIDEO-01': CAMERA_SOURCES['VIDEO-01'] }) as CapturePlanInput['cameras'] }))).toMatchObject({ reason: 'SOURCE_MISSING' });
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

    const outcomes: [string, boolean, boolean][] = [];
    for (let bits = 0; bits < 256; bits += 1) { // D60, D61: 2^8 selectors
      const unassigned = SLOTS.filter((_slot, index) => (bits & (1 << index)) !== 0);
      const selector = without(unassigned);
      // The shared rule (`startRecordingTransition`, `evaluatePrecheck`): a required slot that no line names.
      expect(unassignedSlotsOf(selector)).toEqual(unassigned);
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
