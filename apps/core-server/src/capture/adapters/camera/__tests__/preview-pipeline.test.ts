// The pipeline of one live camera preview (decisions D51 / D53): the steps and the refusal order of
// `openSource` (stored facts, the destination rule with its source, ONE reveal, ONE locator read, the
// start, the first bytes), the bounds of the open, the stop and the reap, and that the credential is
// never in the handle, an error or what the starter is not given. No process: the starter is a double.
import { describe, expect, it } from 'vitest';
import type { CaptureTimers } from '../../../types';
import { sealCredential, type SealedCredential } from '../../credential';
import { CaptureAdapterError, CaptureAdapterRefusal } from '../../errors';
import { ConnectionTestOutcome, type CameraCandidate } from '../../types';
import { CameraOpenError, CameraOpenRefusal, type StoredCameraStream } from '../onvif-relay';
import type { OnvifStreamLocator } from '../onvif-session';
import {
  PREVIEW_OPEN_BOUND_MS,
  PREVIEW_REAP_BOUND_MS,
  PREVIEW_STOP_BOUND_MS,
  createPreviewOpener,
  previewEndOf,
  type PreviewProcessExit,
  type CameraPreviewProcess,
  type PreviewStartRequest,
  type PreviewPipelineDependencies,
} from '../preview-pipeline';
import type { StoredCameraAddressRule } from '../stored-address';
import { loopbackStoredCameraAddress } from '../../../../../test/support/stored-camera-address';

const SECRET = 'S3cr3t-preview-canary';
const USER = 'admin-canary';
const CAMERA: CameraCandidate = { host: '127.0.0.1', serviceAddress: 'http://127.0.0.1/onvif/device_service', adapterKind: 'ONVIF_RTSP' } as unknown as CameraCandidate;
const STREAM: StoredCameraStream = { candidate: CAMERA, onvifProfileToken: 'Profile_2' };
const SOURCE = '127.0.0.1';
/** The rule of a stored camera as the production binding answers an allowed address: the port dialled and the source. */
const ALLOW: StoredCameraAddressRule = loopbackStoredCameraAddress;
const REFUSE: StoredCameraAddressRule = (() => ({ allowed: false, refusal: 'ADDRESS_PUBLIC' })) as unknown as StoredCameraAddressRule;

function manualTimers(): CaptureTimers & { fire(ms: number): void } {
  let at = 0;
  const due: { at: number; callback: () => void; live: boolean }[] = [];
  return {
    after(delayMs, callback) {
      const entry = { at: at + delayMs, callback, live: true };
      due.push(entry);
      return () => {
        entry.live = false;
      };
    },
    fire(ms) {
      at += ms;
      for (const entry of due.filter((candidate) => candidate.live && candidate.at <= at)) {
        entry.live = false;
        entry.callback();
      }
    },
  };
}
const settle = async (): Promise<void> => {
  for (let i = 0; i < 30; i += 1) await Promise.resolve();
};

function fakeProcess(options: { obeysStop?: boolean } = {}) {
  let listener: (bytes: Buffer) => void = () => {};
  let finish: (exit: PreviewProcessExit) => void = () => {};
  const exited = new Promise<PreviewProcessExit>((resolve) => {
    finish = resolve;
  });
  const calls = { stop: 0 };
  const process: CameraPreviewProcess = {
    onChunk(next) {
      listener = next;
    },
    async stop() {
      calls.stop += 1;
      if (options.obeysStop !== false) finish({ code: 0, reason: 'STOPPED' });
    },
    exited,
  };
  return { process, emit: (bytes: Buffer) => listener(bytes), exit: (exit: PreviewProcessExit) => finish(exit), calls };
}

function rig(overrides: Partial<PreviewPipelineDependencies> = {}, processOptions: { obeysStop?: boolean } = {}) {
  const steps: string[] = [];
  const timers = manualTimers();
  const proc = fakeProcess(processOptions);
  const starts: PreviewStartRequest[] = [];
  const locator: OnvifStreamLocator = {
    async locate(candidate, credential, token, _signal, source) {
      steps.push(`locate ${candidate.host} ${token} from ${String(source)}`);
      expect(credential).not.toBeNull();
      return { outcome: ConnectionTestOutcome.REACHABLE, reason: null, locator: 'rtsp://127.0.0.1/Streaming/2', reads: [], credentialRequests: 1 } as never;
    },
  } as OnvifStreamLocator;
  const dependencies: PreviewPipelineDependencies = {
    timers,
    credentials: {
      async previewOpen(deviceId, operatorId) {
        steps.push(`reveal ${deviceId} for ${operatorId}`);
        return sealCredential({ username: USER, secret: SECRET });
      },
    },
    locator,
    stream: async (deviceId) => {
      steps.push(`stream ${deviceId}`);
      return STREAM;
    },
    storedAddress: ALLOW,
    start: (start) => {
      steps.push('start');
      starts.push(start);
      return proc.process;
    },
    ...overrides,
  };
  const chunks: Buffer[] = [];
  const open = createPreviewOpener(dependencies);
  return { open: (signal = new AbortController().signal) => open('CAM-03', 'OPR-001', (bytes) => chunks.push(bytes), signal), steps, timers, proc, starts, chunks };
}

async function refusalOf(promise: Promise<unknown>): Promise<{ name: string; code: string; reason: string | null; text: string }> {
  try {
    await promise;
  } catch (error) {
    const { name, code, reason } = error as { name: string; code: string; reason?: string | null };
    return { name, code, reason: reason ?? null, text: `${String(error)} ${JSON.stringify(error)} ${(error as Error).stack ?? ''}` };
  }
  throw new Error('the open did not refuse');
}

describe('the open: the steps of openSource, in their order', () => {
  it('stored facts, the rule, ONE reveal for the operator, ONE locator read from the source, the start; resolves on the first bytes', async () => {
    const { open, steps, proc, starts, chunks } = rig();
    const opening = open();
    await settle();
    expect(steps).toEqual(['stream CAM-03', 'reveal CAM-03 for OPR-001', `locate 127.0.0.1 Profile_2 from ${SOURCE}`, 'start']);
    let opened = false;
    void opening.then(() => {
      opened = true;
    });
    await settle();
    expect(opened).toBe(false);
    proc.emit(Buffer.from('--ffmpeg\r\n'));
    const pipeline = await opening;
    expect(chunks.map(String)).toEqual(['--ffmpeg\r\n']);
    expect(starts).toHaveLength(1);
    expect(starts[0]).toMatchObject({ deviceId: 'CAM-03', locator: 'rtsp://127.0.0.1/Streaming/2', source: SOURCE });
    // The handle holds the device, its stop and its end: never the credential, the locator or an address.
    expect(Object.keys(pipeline).sort()).toEqual(['deviceId', 'ended', 'stop']);
    const printed = `${JSON.stringify(pipeline)} ${String(pipeline)}`;
    for (const value of [SECRET, USER, 'rtsp://', '127.0.0.1']) expect(printed).not.toContain(value);
  });

  it('refusal order: aborted, no starter, no stored stream, a stream read that fails, an address the rule refuses - each before the reveal', async () => {
    const aborted = new AbortController();
    aborted.abort();
    const cases: [string, Partial<PreviewPipelineDependencies>, AbortSignal | undefined, string][] = [
      ['aborted', {}, aborted.signal, CaptureAdapterRefusal.ABORTED],
      ['no starter', { start: null }, undefined, CameraOpenRefusal.RELAY_NOT_CONFIGURED],
      ['no stream', { stream: async () => null }, undefined, CaptureAdapterRefusal.PROFILE_UNKNOWN],
      [
        'stream read fails',
        {
          stream: async () => {
            throw new Error(`db said ${SECRET}`);
          },
        },
        undefined,
        CameraOpenRefusal.STREAM_FACTS_NOT_READ,
      ],
      ['rule refuses', { storedAddress: REFUSE }, undefined, CameraOpenRefusal.ADDRESS_REFUSED],
      ['no rule', { storedAddress: undefined }, undefined, CameraOpenRefusal.ADDRESS_REFUSED],
    ];
    for (const [name, overrides, signal, code] of cases) {
      const { open, steps } = rig(overrides);
      const refused = await refusalOf(open(signal));
      expect(refused.code, name).toBe(code);
      expect(steps.filter((step) => step.startsWith('reveal') || step === 'start'), name).toEqual([]);
      expect(refused.text, name).not.toContain(SECRET);
    }
    const refused = await refusalOf(rig({ storedAddress: REFUSE }).open());
    expect(refused.reason).toBe('ADDRESS_PUBLIC');
  });

  it('after the reveal: a reader that refuses names its code; a locator that is not reachable names the outcome; a starter that throws; a preview that ends first', async () => {
    const reader = rig({
      credentials: {
        previewOpen: async () => {
          throw Object.assign(new Error('x'), { code: 'CAPTURE_CREDENTIAL_NOT_STORED' });
        },
      },
    });
    expect(await refusalOf(reader.open())).toMatchObject({ code: CameraOpenRefusal.CREDENTIAL_NOT_READ, reason: 'CAPTURE_CREDENTIAL_NOT_STORED' });
    expect(reader.steps).not.toContain('start');

    for (const [outcome, code] of [
      [ConnectionTestOutcome.AUTHENTICATION_FAILED, CameraOpenRefusal.AUTHENTICATION_REFUSED],
      [ConnectionTestOutcome.UNREACHABLE, CameraOpenRefusal.UNREACHABLE],
      [ConnectionTestOutcome.WRONG_PROFILE, CameraOpenRefusal.LOCATOR_REFUSED],
    ] as const) {
      const located = rig({ locator: { locate: async () => ({ outcome, reason: null, locator: null, reads: [], credentialRequests: 1 }) } as unknown as OnvifStreamLocator });
      expect((await refusalOf(located.open())).code, outcome).toBe(code);
      expect(located.steps, outcome).not.toContain('start');
    }

    const throwing = rig({
      start: () => {
        throw Object.assign(new Error('bad'), { code: 'CAPTURE_LOCATOR_INVALID' });
      },
    });
    expect(await refusalOf(throwing.open())).toMatchObject({ code: CameraOpenRefusal.RELAY_NOT_STARTED, reason: 'CAPTURE_LOCATOR_INVALID' });

    const dies = rig();
    const opening = dies.open();
    await settle();
    dies.proc.exit({ code: 23, reason: 'AUTH_REFUSED' });
    expect(await refusalOf(opening)).toMatchObject({ code: CameraOpenRefusal.AUTHENTICATION_REFUSED, reason: 'AUTH_REFUSED' });
    const lost = rig();
    const losing = lost.open();
    await settle();
    lost.proc.exit({ code: 20, reason: 'EXIT_20' });
    expect(await refusalOf(losing)).toMatchObject({ code: CameraOpenRefusal.UNREACHABLE });
  });

  it('the open bound (10 s): a preview that sends nothing is stopped and reaped before the open rejects OPEN_TIMEOUT', async () => {
    expect([PREVIEW_OPEN_BOUND_MS, PREVIEW_STOP_BOUND_MS, PREVIEW_REAP_BOUND_MS]).toEqual([10_000, 3_000, 2_000]);
    const { open, timers, proc } = rig();
    const opening = refusalOf(open());
    await settle();
    timers.fire(PREVIEW_OPEN_BOUND_MS);
    const refused = await opening;
    expect(refused.code).toBe(CameraOpenRefusal.OPEN_TIMEOUT);
    expect(proc.calls.stop).toBe(1);
  });

  it('an abort during the open stops the started preview; a preview that does not end is named NOT_REAPED after 3 s + 2 s', async () => {
    const controller = new AbortController();
    const stubborn = rig({}, { obeysStop: false });
    const opening = refusalOf(stubborn.open(controller.signal));
    await settle();
    controller.abort();
    await settle();
    stubborn.timers.fire(PREVIEW_STOP_BOUND_MS);
    await settle();
    stubborn.timers.fire(PREVIEW_REAP_BOUND_MS);
    expect((await opening).code).toBe(CameraOpenRefusal.RELAY_NOT_REAPED);
    expect(stubborn.proc.calls.stop).toBe(1);
  });
});

describe('the open pipeline: its stop and its end', () => {
  it('stop() is the order to stop, once; the end says it was stopped; twice is safe', async () => {
    const { open, proc } = rig();
    const opening = open();
    await settle();
    proc.emit(Buffer.from('x'));
    const pipeline = await opening;
    await Promise.all([pipeline.stop(), pipeline.stop()]);
    expect(proc.calls.stop).toBe(1);
    expect(await pipeline.ended).toEqual({ stopped: true, code: CameraOpenRefusal.RELAY_STOPPED, reason: 'STOPPED' });
  });

  it('a preview that ends by itself says why; the end of the relay code 31 is a lost stream', async () => {
    const { open, proc } = rig();
    const opening = open();
    await settle();
    proc.emit(Buffer.from('x'));
    const pipeline = await opening;
    proc.exit({ code: 31, reason: 'CAMERA_STALLED' });
    expect(await pipeline.ended).toEqual({ stopped: false, code: CameraOpenRefusal.STREAM_LOST, reason: 'CAMERA_STALLED' });
  });

  it('the codec stored for the stream goes to the starter; a start the door refuses (`started` rejects) is RELAY_NOT_STARTED with the door code, and is stopped', async () => {
    const withCodec = rig({ stream: async () => ({ ...STREAM, codec: 'HEVC' }) });
    const opening = withCodec.open();
    await settle();
    withCodec.proc.emit(Buffer.from('x'));
    await opening;
    expect(withCodec.starts[0]?.codec).toBe('HEVC');
    expect(rig().starts).toEqual([]);

    const refusedProc = fakeProcess();
    const door = rig({ start: () => ({ ...refusedProc.process, started: Promise.reject(Object.assign(new Error('no'), { code: 'PRODUCTION_DOOR_SPAWN_FAILED' })) }) });
    expect(await refusalOf(door.open())).toMatchObject({ code: CameraOpenRefusal.RELAY_NOT_STARTED, reason: 'PRODUCTION_DOOR_SPAWN_FAILED' });
    expect(refusedProc.calls.stop).toBe(1);
  });

  it('previewEndOf: the words of the relay start - STOPPED, START_REFUSED, ENCODER_ENDED (the guard code is never read as the relay code), RELAY_ENDED by the relay exit code', () => {
    expect(previewEndOf({ code: 0, reason: 'STOPPED' })).toEqual({ code: CameraOpenRefusal.RELAY_STOPPED, reason: 'STOPPED' });
    expect(previewEndOf({ code: null, reason: 'START_REFUSED' })).toEqual({ code: CameraOpenRefusal.RELAY_NOT_STARTED, reason: 'START_REFUSED' });
    expect(previewEndOf({ code: 20, reason: 'ENCODER_ENDED' })).toEqual({ code: CameraOpenRefusal.RELAY_FAILED, reason: 'ENCODER_ENDED' });
    expect(previewEndOf({ code: 32, reason: 'RELAY_ENDED' })).toEqual({ code: CameraOpenRefusal.STREAM_LOST, reason: 'CAMERA_LOST' });
    expect(previewEndOf({ code: 23, reason: 'RELAY_ENDED' })).toEqual({ code: CameraOpenRefusal.AUTHENTICATION_REFUSED, reason: 'AUTH_REFUSED' });
    expect(previewEndOf({ code: 20, reason: 'RELAY_ENDED' })).toEqual({ code: CameraOpenRefusal.UNREACHABLE, reason: 'CAMERA_UNREACHABLE' });
  });

  it('previewEndOf: the relay exit codes as the camera adapter reads them, a named AUTH_REFUSED wins, a word that is no code word is not copied', () => {
    expect(previewEndOf({ code: 23, reason: 'whatever is said' })).toEqual({ code: CameraOpenRefusal.AUTHENTICATION_REFUSED, reason: 'AUTH_REFUSED' });
    expect(previewEndOf({ code: 1, reason: 'AUTH_REFUSED' })).toEqual({ code: CameraOpenRefusal.AUTHENTICATION_REFUSED, reason: 'AUTH_REFUSED' });
    expect(previewEndOf({ code: null, reason: `rtsp://${USER}:${SECRET}@x` })).toEqual({ code: CameraOpenRefusal.RELAY_FAILED, reason: 'ENDED_BY_SIGNAL' });
    expect(previewEndOf({ code: 0, reason: 'STOPPED' })).toEqual({ code: CameraOpenRefusal.RELAY_STOPPED, reason: 'STOPPED' });
  });

  it('the credential reaches the starter as the opaque object and nothing else: it prints as the mark', async () => {
    const { open, proc, starts } = rig();
    const opening = open();
    await settle();
    proc.emit(Buffer.from('x'));
    await opening;
    const sealed: SealedCredential = starts[0]!.sealed;
    expect(`${String(sealed)} ${JSON.stringify(starts[0])}`).not.toContain(SECRET);
    expect(CameraOpenError).toBeDefined();
    expect(CaptureAdapterError).toBeDefined();
  });
});
