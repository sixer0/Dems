// The `CapturePlan` builder (blueprint row 66 / M4-W2; capture spec §A.3, §B.2, §A.1.1; decisions
// D72(g), D82, D86 C-5; check M4-LOCAL-PLAN-1, plan-builder half; row 66 verification "the plan
// builder's unit test yields device-ID subjects only (0 `VIDEO-0x` subjects) for the seeded
// configuration").
//
// Pure: the fake registry of row 65 holds the seeded devices behind in-memory adapters; nothing is
// opened except the fakes' own stream handles (a pipe NAME under a directory that does not exist).
import { CapturePlanSchema, LOOPBACK_RTSP_URL, StartMessageSchema, CAPTURE_PROTOCOL_VERSION, type CapturePlanMic } from '@dems/capture-protocol';
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
  type CapturePlanRegistry,
  type CapturePlanSelector,
} from '../plan';

const RUN_DIR = '/nonexistent/dems-run/capture';
const MEDIA = '/nonexistent/dems-media/SES-000123';
const SESSION = 'SES-000123';

/** The seeded selector: CAM-01 -> VIDEO-01, CAM-02 -> VIDEO-02, MIC-01 PRIMARY, MIC-02 STANDBY. */
const SEEDED: CapturePlanSelector = DEFAULT_CAPTURE_CONFIG;

const CAMERA_SOURCES: CapturePlanInput['cameras'] = {
  'VIDEO-01': { ingestUrl: 'rtsp://127.0.0.1:8554/cam1', outputPath: `${MEDIA}/VIDEO-01.mp4` },
  'VIDEO-02': { ingestUrl: 'rtsp://127.0.0.1:8555/cam2', outputPath: `${MEDIA}/VIDEO-02.mp4` },
  // D60 (2026-11-04): the seeded selector plans FOUR tracks, so the caller must bring four sources.
  'VIDEO-03': { ingestUrl: 'rtsp://127.0.0.1:8556/cam3', outputPath: `${MEDIA}/VIDEO-03.mp4` },
  'VIDEO-04': { ingestUrl: 'rtsp://127.0.0.1:8557/cam4', outputPath: `${MEDIA}/VIDEO-04.mp4` },
};

/** The inputs of the two fake microphones, taken from their opened handles and from nowhere else (D72(e)). */
async function micInputs(mics: readonly AudioInputAdapter[]): Promise<Record<string, CapturePlanMic['input']>> {
  const inputs: Record<string, CapturePlanMic['input']> = {};
  for (const adapter of mics) {
    for (const device of adapter.devices) {
      const handle = await adapter.open(device.id, { sessionId: SESSION, signal: new AbortController().signal });
      inputs[device.id] = handle.input;
    }
  }
  return inputs;
}

async function seededInput(over: Partial<CapturePlanInput> = {}): Promise<CapturePlanInput> {
  const fake = createFakeRegistry({ runDir: RUN_DIR });
  return { selector: SEEDED, registry: fake.registry, cameras: CAMERA_SOURCES, mics: await micInputs(fake.mics), pcmTapPath: `${RUN_DIR}/${SESSION}/tap.pcm`, ...over };
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
    expect(plan.mics.map((mic) => [mic.deviceId, mic.role])).toEqual([
      ['MIC-01', 'PRIMARY'],
      ['MIC-02', 'STANDBY'],
    ]);
    const subjects = capturePlanSubjects(plan);
    expect(subjects).toEqual(['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04', 'MIC-01', 'MIC-02', 'PRIMARY', 'STANDBY']); // D60
    expect(subjects.filter((subject) => subject.startsWith('VIDEO-'))).toEqual([]);
    // Every `VIDEO-0x` of the whole plan is the value of a `trackId` or part of an output path the
    // caller chose: no other member of the plan holds one.
    const elsewhere = JSON.stringify({ ...plan, cameras: plan.cameras.map(({ trackId: _track, outputPath: _path, ...rest }) => rest) });
    expect(elsewhere).not.toMatch(/VIDEO-0/);
    // Control: the check can fail. A plan that named the track as its subject is found.
    const wrong = { ...plan, cameras: plan.cameras.map((camera) => ({ ...camera, deviceId: camera.trackId })) };
    expect(capturePlanSubjects(wrong).filter((subject) => subject.startsWith('VIDEO-'))).toEqual(['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04']); // D60
  });

  it('is a plan of the protocol: it is the payload of START, with the contract constants and the PRIMARY input active', async () => {
    const input = await seededInput();
    const plan = buildCapturePlan(input);
    expect(CapturePlanSchema.safeParse(plan).success).toBe(true);
    expect(StartMessageSchema.safeParse({ v: CAPTURE_PROTOCOL_VERSION, type: 'START', sessionId: SESSION, correlationId: 'c-1', attempt: 1, plan }).success).toBe(true);
    expect(plan.activeMic).toBe('PRIMARY');
    expect(plan.constants).toEqual(capturePlanConstants());
    expect(plan.pcmTapPath).toBe(`${RUN_DIR}/${SESSION}/tap.pcm`);
    for (const camera of plan.cameras) expect(camera.ingestUrl).toMatch(LOOPBACK_RTSP_URL);
    // A microphone's input is its opened handle's, unchanged.
    expect(plan.mics.map((mic) => mic.input)).toEqual([input.mics['MIC-01'], input.mics['MIC-02']]);
    expect(plan.cameras.map((camera) => camera.profile)).toEqual(SEEDED.cameras.map((camera) => camera.profile));
  });

  it('follows the selector, not the seed: a swapped pair of cameras and a swapped primary', async () => {
    const swapped: CapturePlanSelector = {
      cameras: [
        { trackId: 'VIDEO-01', deviceId: 'CAM-02', profile: 'H264_1080P25' },
        { trackId: 'VIDEO-02', deviceId: 'CAM-01', profile: 'H264_1080P25' },
        // D60 (2026-11-04): the selector names four tracks; only the first pair is swapped.
        { trackId: 'VIDEO-03', deviceId: 'CAM-03', profile: 'H264_1080P25' },
        { trackId: 'VIDEO-04', deviceId: 'CAM-04', profile: 'H264_1080P25' },
      ],
      mics: [
        { deviceId: 'MIC-02', role: 'PRIMARY' },
        { deviceId: 'MIC-01', role: 'STANDBY' },
      ],
    };
    const plan = buildCapturePlan(await seededInput({ selector: swapped }));
    expect(plan.cameras.map((camera) => [camera.deviceId, camera.trackId, camera.outputPath])).toEqual([
      ['CAM-02', 'VIDEO-01', `${MEDIA}/VIDEO-01.mp4`],
      ['CAM-01', 'VIDEO-02', `${MEDIA}/VIDEO-02.mp4`],
      ['CAM-03', 'VIDEO-03', `${MEDIA}/VIDEO-03.mp4`], // D60
      ['CAM-04', 'VIDEO-04', `${MEDIA}/VIDEO-04.mp4`],
    ]);
    expect(plan.mics.map((mic) => [mic.deviceId, mic.role])).toEqual([
      ['MIC-02', 'PRIMARY'],
      ['MIC-01', 'STANDBY'],
    ]);
  });

  it('one camera of two, or no standby microphone, is the caller\'s decision (D72(k)): the plan holds what it was given a source for', async () => {
    const base = await seededInput();
    const oneCamera = buildCapturePlan({ ...base, cameras: { 'VIDEO-02': CAMERA_SOURCES['VIDEO-02']! } });
    expect(oneCamera.cameras.map((camera) => camera.deviceId)).toEqual(['CAM-02']);
    const primaryOnly = buildCapturePlan({ ...base, mics: { 'MIC-01': base.mics['MIC-01']! } });
    expect(primaryOnly.mics.map((mic) => [mic.deviceId, mic.role])).toEqual([['MIC-01', 'PRIMARY']]);
    // No camera at all, and no PRIMARY microphone, are no plan (D83: an unreachable active microphone blocks).
    expect(refusalOf(() => buildCapturePlan({ ...base, cameras: {} }))).toEqual({ code: 'CAPTURE_PLAN_INVALID', reason: 'SOURCE_MISSING', deviceId: null });
    expect(refusalOf(() => buildCapturePlan({ ...base, mics: { 'MIC-02': base.mics['MIC-02']! } }))).toEqual({ code: 'CAPTURE_PLAN_INVALID', reason: 'SOURCE_MISSING', deviceId: null });
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
    for (const id of ['MIC-01', 'MIC-02']) lifted.register({ ...createFakeAudioInputAdapter({ id, runDir: RUN_DIR }), kind: CaptureAdapterKind.USB_AUDIO });
    expect(assertRecordableSelector(SEEDED, lifted).sourceClass).toBe('PRODUCTION');
    expect(capturePlanSubjects(buildCapturePlan({ ...base, registry: lifted }))).toEqual(['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04', 'MIC-01', 'MIC-02', 'PRIMARY', 'STANDBY']); // D60
    // ... unless ONE of the six states none (the darwin microphone): refused by that device.
    const darwin = createCaptureDeviceRegistry({ operation: CaptureOperation.REAL_PRODUCTION });
    for (const id of ['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04']) darwin.register({ ...createFakeCameraAdapter({ id }), kind: CaptureAdapterKind.ONVIF_RTSP }); // D60
    darwin.register({ ...createFakeAudioInputAdapter({ id: 'MIC-01', runDir: RUN_DIR }), kind: CaptureAdapterKind.USB_AUDIO, hasOpener: false });
    darwin.register({ ...createFakeAudioInputAdapter({ id: 'MIC-02', runDir: RUN_DIR }), kind: CaptureAdapterKind.USB_AUDIO, hasOpener: false });
    expect(refusalOf(() => buildCapturePlan({ ...base, registry: darwin }))).toEqual({ code: 'SOURCE_KIND_NOT_RECORDABLE', reason: 'NO_OPENER', deviceId: 'MIC-01' });
    // Control: the same selector over the fake registry is a plan.
    expect(refusalOf(() => buildCapturePlan(base))).toBe('no refusal');
  });

  it('a device no registered adapter serves: every device in SIMULATED, a stale or candidate ID anywhere', async () => {
    const base = await seededInput();
    const simulated = createCaptureDeviceRegistry({ operation: CaptureOperation.SIMULATED });
    expect(refusalOf(() => buildCapturePlan({ ...base, registry: simulated }))).toEqual({ code: 'SOURCE_KIND_NOT_RECORDABLE', reason: 'NO_ADAPTER', deviceId: 'CAM-01' });
    const stale: CapturePlanSelector = { ...SEEDED, mics: [SEEDED.mics[0]!, { deviceId: 'MIC-07', role: 'STANDBY' }] };
    expect(refusalOf(() => assertRecordableSelector(stale, base.registry))).toEqual({ code: 'SOURCE_KIND_NOT_RECORDABLE', reason: 'NO_ADAPTER', deviceId: 'MIC-07' });
    // The STANDBY microphone is refused although the caller would not record it: all four slots are looked at.
    expect(refusalOf(() => buildCapturePlan({ ...base, selector: stale, mics: { 'MIC-01': base.mics['MIC-01']! } }))).toMatchObject({ reason: 'NO_ADAPTER', deviceId: 'MIC-07' });
  });

  it('a mixed selector, one production and one development source, is refused (D82), and so is a class the operation does not record', async () => {
    const base = await seededInput();
    const allFake = { 'CAM-01': CaptureAdapterKind.FAKE, 'CAM-02': CaptureAdapterKind.FAKE, 'CAM-03': CaptureAdapterKind.FAKE, 'CAM-04': CaptureAdapterKind.FAKE, 'MIC-01': CaptureAdapterKind.FAKE, 'MIC-02': CaptureAdapterKind.FAKE }; // D60 (2026-11-04): the selector names six devices
    // Control: the table registry is no refusal by itself.
    expect(refusalOf(() => buildCapturePlan({ ...base, registry: tableRegistry(CaptureOperation.REAL_DEVELOPMENT, allFake) }))).toBe('no refusal');
    for (const [deviceId, kind] of [
      ['CAM-01', CaptureAdapterKind.ONVIF_RTSP],
      ['CAM-02', CaptureAdapterKind.ONVIF_RTSP],
      ['CAM-03', CaptureAdapterKind.ONVIF_RTSP],
      ['MIC-01', CaptureAdapterKind.USB_AUDIO],
      ['MIC-02', CaptureAdapterKind.USB_AUDIO],
    ] as const) {
      const mixed = tableRegistry(CaptureOperation.REAL_DEVELOPMENT, { ...allFake, [deviceId]: kind });
      expect(refusalOf(() => buildCapturePlan({ ...base, registry: mixed })), deviceId).toEqual({ code: 'SOURCE_KIND_NOT_RECORDABLE', reason: 'MIXED_SOURCE_CLASSES', deviceId: null });
    }
    // The local camera beside the fakes is ONE class (development): the six slots of spec §A.1.1 (D60).
    const local = tableRegistry(CaptureOperation.REAL_DEVELOPMENT, { 'CAM-03': CaptureAdapterKind.LOCAL_DEVICE, 'CAM-02': CaptureAdapterKind.FAKE, 'CAM-04': CaptureAdapterKind.LOCAL_DEVICE, 'CAM-05': CaptureAdapterKind.FAKE, 'MIC-03': CaptureAdapterKind.LOCAL_DEVICE, 'MIC-02': CaptureAdapterKind.FAKE }); // D60
    const fourSlots: CapturePlanSelector = {
      cameras: [{ trackId: 'VIDEO-01', deviceId: 'CAM-03', profile: 'H264_1080P25' }, SEEDED.cameras[1]!, { trackId: 'VIDEO-03', deviceId: 'CAM-04', profile: 'H264_1080P25' }, { trackId: 'VIDEO-04', deviceId: 'CAM-05', profile: 'H264_1080P25' }],
      mics: [{ deviceId: 'MIC-03', role: 'PRIMARY' }, { deviceId: 'MIC-02', role: 'STANDBY' }],
    };
    const plan = buildCapturePlan({ ...base, selector: fourSlots, registry: local, mics: { 'MIC-03': { kind: 'PCM_FIFO', path: `${RUN_DIR}/${SESSION}/mic-03.pcm` }, 'MIC-02': base.mics['MIC-02']! } });
    expect(capturePlanSubjects(plan)).toEqual(['CAM-03', 'CAM-02', 'CAM-04', 'CAM-05', 'MIC-03', 'MIC-02', 'PRIMARY', 'STANDBY']); // D60
    expect(assertRecordableSelector(fourSlots, local).sourceClass).toBe('DEVELOPMENT');
    // All four of one class, but not the class of the operation.
    expect(refusalOf(() => buildCapturePlan({ ...base, registry: tableRegistry(CaptureOperation.REAL_PRODUCTION, allFake) }))).toEqual({ code: 'SOURCE_KIND_NOT_RECORDABLE', reason: 'CLASS_NOT_OF_OPERATION', deviceId: null });
    expect(refusalOf(() => buildCapturePlan({ ...base, registry: tableRegistry(CaptureOperation.SIMULATED, allFake) }))).toMatchObject({ reason: 'CLASS_NOT_OF_OPERATION' });
  });
});

describe('what is no plan: CAPTURE_PLAN_INVALID', () => {
  it('a selector that is not two tracks and a primary and a standby microphone', async () => {
    const base = await seededInput();
    const shapes: CapturePlanSelector[] = [
      { ...SEEDED, cameras: [SEEDED.cameras[0]!] },
      { ...SEEDED, cameras: [SEEDED.cameras[1]!, SEEDED.cameras[0]!] },
      { ...SEEDED, mics: [SEEDED.mics[0]!, { ...SEEDED.mics[1]!, role: 'PRIMARY' }] },
      { cameras: [], mics: [] },
    ];
    for (const selector of shapes) expect(refusalOf(() => buildCapturePlan({ ...base, selector }))).toEqual({ code: 'CAPTURE_PLAN_INVALID', reason: 'SELECTOR_SHAPE', deviceId: null });
  });

  // Task 4 row 29 (decisions C14, C18 (1), C25; security requirement AD-10 (4); addendum 1.5).
  // `plan.ts` is NOT edited by that row: this case states what it already says about an unassigned
  // slot (an ABSENT line of the selector), and holds it equal to the shared pre-check. C25: in real
  // capture ALL SIX slots must be assigned - the STANDBY included (state S-5 of the security
  // check) - so the pre-check and the plan builder never disagree. D60 (2026-11-04): four video slots and two mic roles (was two and two).
  it('AD-10 (4), C25: any unassigned slot - each of the six alone, and every one of the 63 incomplete selectors - is refused SELECTOR_SHAPE before the registry is asked; the shared pre-check names the same selectors', async () => {
    const base = await seededInput();
    const SLOTS = ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'PRIMARY', 'STANDBY'] as const; // D60
    const without = (unassigned: readonly string[]): CapturePlanSelector => ({
      cameras: SEEDED.cameras.filter((camera) => !unassigned.includes(camera.trackId)),
      mics: SEEDED.mics.filter((mic) => !unassigned.includes(mic.role)),
    });
    /** A registry that fails the case when it is asked: the shape rule answers first, for a selector with a hole. */
    const asked: string[] = [];
    const untouched: CapturePlanRegistry = { operation: CaptureOperation.REAL_PRODUCTION, assertRecordable: (deviceId) => (asked.push(deviceId), base.registry.assertRecordable(deviceId)) };
    expect([...CAPTURE_START_REQUIRED_SLOTS]).toEqual([...SLOTS]);

    const outcomes: [string, boolean, boolean][] = [];
    for (let bits = 0; bits < 64; bits += 1) { // D60: 2^6 selectors
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
    // The two rules agree on all 64: 63 refused, the complete selector not.
    expect(outcomes.filter(([, shared, plan]) => shared !== plan)).toEqual([]);
    expect(outcomes.filter(([, shared]) => shared)).toHaveLength(63);
    expect(outcomes[0]).toEqual(['', false, false]);
    // Each slot alone, by name (S-5 is the last): six refusals.
    expect(SLOTS.map((slot) => refusalOf(() => assertRecordableSelector(without([slot]), untouched))).map((refusal) => (refusal === 'no refusal' ? refusal : refusal.reason))).toEqual(['SELECTOR_SHAPE', 'SELECTOR_SHAPE', 'SELECTOR_SHAPE', 'SELECTOR_SHAPE', 'SELECTOR_SHAPE', 'SELECTOR_SHAPE']); // D60
    // No device was asked for an incomplete selector: only the complete one reached the registry (its six devices, once).
    expect(asked).toEqual(['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04', 'MIC-01', 'MIC-02']); // D60
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

/** The pipe names of the fake microphones without opening them: the same form `open` gives (used where a test is not async). */
function pipeInputs(mics: readonly AudioInputAdapter[]): Record<string, CapturePlanMic['input']> {
  return Object.fromEntries(mics.flatMap((adapter) => adapter.devices.map((device) => [device.id, { kind: 'PCM_FIFO', path: `${RUN_DIR}/${SESSION}/${device.id.toLowerCase()}.pcm` }] as const)));
}
