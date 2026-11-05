// Check M4-FAKE-1 (blueprint row 65; test strategy §A.4, erratum PE-127-07): the fake
// `CameraAdapter`, `PoeController` and `AudioInputAdapter` satisfy the device contract, and two
// fakes emulate two cameras (OD-05). The class-C adapters are NOT executed here (static.test.ts
// holds that no test loads them).
//
// The contract is one function per seam that returns what an adapter gets wrong. The negative
// controls run the same function over a broken adapter and require it to object.
import { CapturePlanMicSchema, LOOPBACK_RTSP_URL } from '@dems/capture-protocol';
import { describe, expect, it } from 'vitest';
import {
  CaptureAdapterError,
  CaptureAdapterKind,
  CaptureOperation,
  ConnectionTestOutcome,
  FAKE_CAMERA_PROFILE,
  FAKE_CAMERA_SECOND_PROFILE,
  FAKE_MIC_PRIMARY_DBFS,
  FAKE_MIC_STANDBY_DBFS,
  FakeTopology,
  MIC_CLOCK_COMPENSATION_PPM,
  PoePortStatus,
  createFakeAudioInputAdapter,
  createFakeCameraAdapter,
  createFakePoeController,
  createFakeRegistry,
  credentialFreeLocator,
  sealCredential,
  type AudioInputAdapter,
  type CameraAdapter,
  type CameraCandidate,
  type PoeController,
} from '../index';

const RUN_DIR = '/nonexistent/dems-run/capture';
/** The channel file a session names on the plan line (row W3I; capture-session `micFileName`): an absolute path, never opened here. */
const PLAN_MIC_FILE = '/nonexistent/dems-media/SES-000123/MIC-01.m4a';
const INGEST = { ingestUrl: ['rtsp:', '', '127.0.0.1:8554', 'cam'].join('/') };
const live = (): AbortSignal => new AbortController().signal;
const aborted = (): AbortSignal => AbortSignal.abort();
const codeOf = async (work: () => unknown): Promise<string> => {
  try {
    await work();
    return 'no refusal';
  } catch (error) {
    return error instanceof CaptureAdapterError ? error.code : `not an adapter error: ${String(error)}`;
  }
};
const candidate = (over: Partial<CameraCandidate> = {}): CameraCandidate => ({
  adapterKind: CaptureAdapterKind.FAKE,
  host: '127.0.0.1',
  serviceAddress: null,
  endpointRef: 'urn:uuid:00000000-0000-4000-8000-000000000001',
  vendor: null,
  model: 'Fixture camera',
  name: null,
  testable: true,
  conflict: false,
  ...over,
});

/** The device contract of a camera adapter that has an opener. Returns what is wrong. */
async function cameraContract(adapter: CameraAdapter): Promise<string[]> {
  const wrong: string[] = [];
  if (adapter.seam !== 'CAMERA') wrong.push('seam');
  if (adapter.devices.length === 0) wrong.push('serves no device');
  for (const device of adapter.devices) {
    if (!/^CAM-[0-9]{2,}$/.test(device.id)) wrong.push(`id ${device.id}`);
    if (device.deviceClass !== 'CAMERA') wrong.push(`${device.id}: class`);
    if (device.profiles.length === 0) wrong.push(`${device.id}: no profile`);
    const profiles = await adapter.profiles(device.id);
    if (JSON.stringify(profiles.map((profile) => profile.code)) !== JSON.stringify(device.profiles)) wrong.push(`${device.id}: profiles() differs from the entry`);
    for (const profile of device.profiles) {
      try {
        const locator = adapter.pullUrl(device.id, profile);
        if (credentialFreeLocator(locator) !== locator) wrong.push(`${device.id}: locator changed`);
      } catch {
        wrong.push(`${device.id}: locator of ${profile} is not the host-and-path form`);
      }
    }
    if ((await codeOf(() => adapter.pullUrl(device.id, 'NO_SUCH_PROFILE'))) !== 'CAPTURE_PROFILE_UNKNOWN') wrong.push(`${device.id}: unknown profile accepted`);
    if (!Number.isFinite(await adapter.ntpOffsetMs(device.id))) wrong.push(`${device.id}: clock offset`);
    if (adapter.hasOpener) {
      if ((await codeOf(() => adapter.openSource(device.id, INGEST, aborted()))) !== 'CAPTURE_ADAPTER_ABORTED') wrong.push(`${device.id}: opens after an abort`);
      const handle = await adapter.openSource(device.id, INGEST, live());
      if (handle.deviceId !== device.id) wrong.push(`${device.id}: the handle names another device`);
      if ((await codeOf(() => adapter.openSource(device.id, INGEST, live()))) === 'no refusal') wrong.push(`${device.id}: opened twice`);
      await handle.close();
      await handle.close();
      await (await adapter.openSource(device.id, INGEST, live())).close();
    } else if ((await codeOf(() => adapter.openSource(device.id, INGEST, live()))) !== 'SOURCE_KIND_NOT_RECORDABLE') wrong.push(`${device.id}: no opener, yet it opens`);
  }
  if ((await codeOf(() => adapter.profiles('CAM-99'))) !== 'CAPTURE_DEVICE_UNKNOWN') wrong.push('serves a device it does not name');
  const found = await adapter.discover({ windowMs: 3_000, signal: live() });
  if (found.responderCount < found.candidates.length || found.interfaceCount < 0) wrong.push('discovery counts');
  const tested = await adapter.testConnection(candidate(), null, live());
  if (!(Object.values(ConnectionTestOutcome) as string[]).includes(tested.outcome)) wrong.push('test outcome');
  if (tested.authenticated !== false) wrong.push('authenticated without a credential');
  if (JSON.stringify(Object.keys(tested).sort()) !== JSON.stringify(['authenticated', 'outcome', 'usableProfiles'])) wrong.push('test result members');
  return wrong;
}

async function audioContract(adapter: AudioInputAdapter): Promise<string[]> {
  const wrong: string[] = [];
  if (adapter.seam !== 'AUDIO') wrong.push('seam');
  const listed = await adapter.enumerate();
  for (const device of adapter.devices) {
    if (!/^MIC-[0-9]{2,}$/.test(device.id) || device.deviceClass !== 'MIC') wrong.push(`id or class of ${device.id}`);
    if (!listed.some((input) => input.inputId === device.id)) wrong.push(`${device.id}: not enumerated`);
    const level = await adapter.level(device.id);
    if (level !== null && !(level <= 0)) wrong.push(`${device.id}: level above full scale`);
    if (!adapter.hasOpener) continue;
    const handle = await adapter.open(device.id, { sessionId: 'SES-000123', signal: live() });
    if (handle.deviceId !== device.id) wrong.push(`${device.id}: the handle names another device`);
    // The input goes into the plan unchanged: the protocol's own schema must take it.
    // Protocol v6 (audit row 144, N-13): the plan line also names the channel's own file. That path is the SESSION's
    // (capture-session `${folder}/${micFileName(channel)}`), never the adapter's: the handle carries `input` only, so the
    // line is built here as the session builds it, and the contract still checks that the plan takes `handle.input` unchanged.
    if (!CapturePlanMicSchema.safeParse({ deviceId: handle.deviceId, channel: 'MIC-01', input: handle.input, outputPath: PLAN_MIC_FILE }).success) wrong.push(`${device.id}: the plan refuses the input`); // D61 (2026-11-04): the plan line names its numbered channel
    if (handle.transport.kind !== handle.input.kind) wrong.push(`${device.id}: the statement is of another transport`);
    if (handle.transport.clockCompensationPpm !== MIC_CLOCK_COMPENSATION_PPM) wrong.push(`${device.id}: the clock range is not stated`);
    if (!(handle.transport.latenessBeyondRangeMs > 0)) wrong.push(`${device.id}: no lateness bound stated`);
    await handle.close();
    await handle.close();
    if ((await codeOf(() => adapter.open(device.id, { sessionId: '../escape', signal: live() }))) === 'no refusal') wrong.push(`${device.id}: a session ID that leaves the run directory`);
    if ((await codeOf(() => adapter.open(device.id, { sessionId: 'SES-000123', signal: aborted() }))) !== 'CAPTURE_ADAPTER_ABORTED') wrong.push(`${device.id}: opens after an abort`);
  }
  return wrong;
}

async function poeContract(controller: PoeController, port: string): Promise<string[]> {
  const wrong: string[] = [];
  if (controller.seam !== 'POE') wrong.push('seam');
  for (const device of controller.devices) if (!/^POE-[A-Z0-9_]{2,}$/.test(device.id) || device.deviceClass !== 'POE') wrong.push(`id or class of ${device.id}`);
  if (!(Object.values(PoePortStatus) as string[]).includes(await controller.status(port))) wrong.push('status');
  await controller.cycle(port);
  if ((await controller.status(port)) !== PoePortStatus.POWERED) wrong.push('a cycle does not end powered');
  if ((await codeOf(() => controller.cycle('NO_SUCH_PORT'))) !== 'CAPTURE_POE_PORT_UNKNOWN') wrong.push('cycles a port it does not serve');
  return wrong;
}

describe('M4-FAKE-1: the fakes satisfy the device contract', () => {
  it('the fake camera, the fake microphone and the fake PoE controller pass their contracts', async () => {
    expect(await cameraContract(createFakeCameraAdapter({ id: 'CAM-01', candidates: [candidate()] }))).toEqual([]);
    expect(await audioContract(createFakeAudioInputAdapter({ id: 'MIC-01', runDir: RUN_DIR }))).toEqual([]);
    expect(await poeContract(createFakePoeController({ id: 'POE-SWITCH', ports: ['POE_CAM_1'] }), 'POE_CAM_1')).toEqual([]);
  });

  it('negative control: an adapter that breaks the contract is found out by the same functions', async () => {
    const good = createFakeCameraAdapter({ id: 'CAM-01' });
    const userPart: CameraAdapter = { ...good, pullUrl: (deviceId, profile) => good.pullUrl(deviceId, profile).replace('//', '//admin:pw@') };
    expect(await cameraContract(userPart)).toEqual(['CAM-01: locator of H264_1080P25 is not the host-and-path form']);
    const leaky: CameraAdapter = { ...good, testConnection: async () => ({ outcome: 'REACHABLE', authenticated: true, usableProfiles: [], secret: 'x' }) as never };
    expect(await cameraContract(leaky)).toEqual(['authenticated without a credential', 'test result members']);
    const doubleOpen: CameraAdapter = { ...good, openSource: async (deviceId) => ({ deviceId, close: async () => {} }) };
    expect(await cameraContract(doubleOpen)).toEqual(['CAM-01: opens after an abort', 'CAM-01: opened twice']);

    const mic = createFakeAudioInputAdapter({ id: 'MIC-01', runDir: RUN_DIR });
    const wrongInput: AudioInputAdapter = { ...mic, open: async (inputId, target) => ({ ...(await mic.open(inputId, target)), input: { kind: 'PCM_FIFO', path: 'relative/pipe.pcm' } }) };
    expect(await audioContract(wrongInput)).toContain('MIC-01: the plan refuses the input');
    const loud: AudioInputAdapter = { ...mic, level: async () => 3 };
    expect(await audioContract(loud)).toEqual(['MIC-01: level above full scale']);

    const poe = createFakePoeController({ id: 'POE-SWITCH', ports: ['POE_CAM_1'] });
    const anyPort: PoeController = { ...poe, cycle: async () => {} };
    expect(await poeContract(anyPort, 'POE_CAM_1')).toEqual(['cycles a port it does not serve']);
  });
});

describe('M4-FAKE-1: four fakes emulate four cameras (D60), and one fake a dual-lens camera (OD-05)', () => {
  it('four cameras: four adapters, four devices, one profile each, each with its own locator and its own source', async () => {
    const { registry, cameras } = createFakeRegistry({ runDir: RUN_DIR });
    // D60 (2026-11-04): four video tracks — the seed carries CAM-01..CAM-04.
    expect(cameras.map((camera) => camera.devices.map((device) => device.id))).toEqual([['CAM-01'], ['CAM-02'], ['CAM-03'], ['CAM-04']]);
    expect(registry.list().filter((device) => device.deviceClass === 'CAMERA').map((device) => [device.id, device.adapterKind, device.sourceClass, device.profiles, device.hasOpener])).toEqual([
      ['CAM-01', 'FAKE', 'DEVELOPMENT', [FAKE_CAMERA_PROFILE], true],
      ['CAM-02', 'FAKE', 'DEVELOPMENT', [FAKE_CAMERA_PROFILE], true],
      ['CAM-03', 'FAKE', 'DEVELOPMENT', [FAKE_CAMERA_PROFILE], true],
      ['CAM-04', 'FAKE', 'DEVELOPMENT', [FAKE_CAMERA_PROFILE], true],
    ]);
    const first = registry.resolve('CAMERA', 'CAM-01');
    const second = registry.resolve('CAMERA', 'CAM-02');
    expect(first).not.toBe(second);
    expect(first.pullUrl('CAM-01', FAKE_CAMERA_PROFILE)).not.toBe(second.pullUrl('CAM-02', FAKE_CAMERA_PROFILE));
    // Each camera is its own source: both open at once, and closing one leaves the other.
    const a = await first.openSource('CAM-01', INGEST, live());
    const b = await second.openSource('CAM-02', INGEST, live());
    expect([cameras[0]?.openSources(), cameras[1]?.openSources()]).toEqual([['CAM-01'], ['CAM-02']]);
    await a.close();
    expect([cameras[0]?.openSources(), cameras[1]?.openSources()]).toEqual([[], ['CAM-02']]);
    await b.close();
    // A fake does not serve the other fake's camera.
    expect(await codeOf(() => first.profiles('CAM-02'))).toBe('CAPTURE_DEVICE_UNKNOWN');
    for (const camera of cameras) expect(await cameraContract(camera)).toEqual([]);
  });

  it('dual lens: one camera, two profiles, two locators', async () => {
    const { registry, cameras } = createFakeRegistry({ runDir: RUN_DIR, topology: FakeTopology.DUAL_LENS });
    expect(cameras).toHaveLength(1);
    expect(registry.describe('CAM-01').profiles).toEqual([FAKE_CAMERA_PROFILE, FAKE_CAMERA_SECOND_PROFILE]);
    expect(await codeOf(() => registry.describe('CAM-02'))).toBe('CAPTURE_DEVICE_UNKNOWN');
    const camera = registry.resolve('CAMERA', 'CAM-01');
    expect(new Set(registry.describe('CAM-01').profiles.map((profile) => camera.pullUrl('CAM-01', profile))).size).toBe(2);
    expect(await cameraContract(camera)).toEqual([]);
  });

  it('the fake registry holds the seed\'s nine devices (D61), two microphones 10.5 dB apart and the switch with the cameras\' port', async () => {
    const { registry, mics, poe } = createFakeRegistry({ runDir: RUN_DIR });
    // D60 (2026-11-04): the seed's built-ins are seven — four cameras, two mics, one switch.
    expect(registry.list().map((device) => `${device.id} ${device.deviceClass} ${device.adapterKind}`)).toEqual(['CAM-01 CAMERA FAKE', 'CAM-02 CAMERA FAKE', 'CAM-03 CAMERA FAKE', 'CAM-04 CAMERA FAKE', 'MIC-01 MIC FAKE', 'MIC-02 MIC FAKE', 'MIC-03 MIC FAKE', 'MIC-04 MIC FAKE', 'POE-SWITCH POE FAKE']); // D61 (2026-11-04): nine built-ins
    expect(await Promise.all(mics.map((mic) => mic.level(mic.devices[0]?.id ?? '')))).toEqual([FAKE_MIC_PRIMARY_DBFS, FAKE_MIC_STANDBY_DBFS, FAKE_MIC_STANDBY_DBFS, FAKE_MIC_STANDBY_DBFS]); // D61 (2026-11-04): four channel fakes, the standby level on 3 and 4
    expect(FAKE_MIC_PRIMARY_DBFS - FAKE_MIC_STANDBY_DBFS).toBeCloseTo(10.5);
    expect(await poeContract(poe, 'POE_CAM_1')).toEqual([]);
    expect(poe.cycles).toEqual(['POE_CAM_1']);
    for (const mic of mics) expect(await audioContract(mic)).toEqual([]);
    expect(registry.openerKinds()).toEqual(['FAKE']);
    expect(registry.operation).toBe(CaptureOperation.REAL_DEVELOPMENT);
  });
});

describe('the fake camera: the five outcomes of a connection test, on fixtures', () => {
  const FIXTURE = { username: 'fixture-operator', secret: 'fixture-only-9b1f' };
  const authenticate = (credential: { username: string; secret: string }): boolean => credential.username === FIXTURE.username && credential.secret === FIXTURE.secret;

  it('REACHABLE, AUTHENTICATION_FAILED, and the three scripted outcomes; a candidate that is not testable is never reached', async () => {
    const camera = createFakeCameraAdapter({ id: 'CAM-01', authenticate });
    const test = async (credential: { username: string; secret: string } | null, over: Partial<CameraCandidate> = {}) => camera.testConnection(candidate(over), credential === null ? null : sealCredential(credential), live());
    expect(await test(FIXTURE)).toEqual({ outcome: 'REACHABLE', authenticated: true, usableProfiles: [FAKE_CAMERA_PROFILE] });
    expect(await test({ ...FIXTURE, secret: 'wrong' })).toEqual({ outcome: 'AUTHENTICATION_FAILED', authenticated: true, usableProfiles: [] });
    expect(await test(null)).toEqual({ outcome: 'AUTHENTICATION_FAILED', authenticated: false, usableProfiles: [] });
    for (const outcome of [ConnectionTestOutcome.WRONG_PROFILE, ConnectionTestOutcome.NOT_H264, ConnectionTestOutcome.UNREACHABLE]) {
      camera.script(outcome);
      expect(await test(FIXTURE)).toEqual({ outcome, authenticated: true, usableProfiles: [] });
    }
    camera.script(null);
    expect((await test(FIXTURE, { testable: false })).outcome).toBe('UNREACHABLE');
    expect(camera.calls.tests).toBe(7);
    expect(await codeOf(() => camera.testConnection(candidate(), null, aborted()))).toBe('CAPTURE_ADAPTER_ABORTED');
    // A fake without a fixture credential asks for none.
    expect((await createFakeCameraAdapter({ id: 'CAM-02' }).testConnection(candidate(), null, live())).outcome).toBe('REACHABLE');
  });
});

describe('the fake microphone: a missing input is a named refusal, never a stand-in', () => {
  it('an unplugged input enumerates as absent with its cause, reads no level and does not open', async () => {
    const mic = createFakeAudioInputAdapter({ id: 'MIC-01', runDir: RUN_DIR });
    mic.setPresent(false, 'PERMISSION_DENIED');
    expect(await mic.enumerate()).toEqual([{ inputId: 'MIC-01', present: false, errorCode: 'PERMISSION_DENIED' }]);
    expect(await mic.level('MIC-01')).toBeNull();
    expect(await codeOf(() => mic.open('MIC-01', { sessionId: 'SES-000123', signal: live() }))).toBe('SOURCE_KIND_NOT_RECORDABLE');
    mic.setPresent(true);
    const handle = await mic.open('MIC-01', { sessionId: 'SES-000123', signal: live() });
    expect(handle.input).toEqual({ kind: 'PCM_FIFO', path: `${RUN_DIR}/SES-000123/MIC-01.pcm` });
    expect(mic.openInputs()).toEqual(['MIC-01']);
    await handle.close();
    expect(mic.calls).toEqual({ enumerate: 1, opened: ['MIC-01'], closed: ['MIC-01'] });
  });

  it('the ingest address of the test is one the worker would listen on', () => {
    expect(LOOPBACK_RTSP_URL.test(INGEST.ingestUrl)).toBe(true);
  });
});
