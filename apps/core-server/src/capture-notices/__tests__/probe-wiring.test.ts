// THE REACHABILITY PROBE IS WIRED (integration pass D9, item 5; row 140's finding F-3): the boot
// registration of the notices unit reads the adapters of the running capture operation from the
// capture fence (`probeAdapters()`), so operation 97 in REAL_DEVELOPMENT answers the state of each
// microphone from its adapter instead of 503.
//
// WHAT IS REAL: the app factory in capture mode `real` (no database), its own registration of the
// notices unit, the route of operation 97, the fence's registry builder with the LOCAL and the
// generated adapters and the helpers' own logic (device list, exact-name rule).
// WHAT STANDS IN: the engine (the stand-in on a real simulator of the capture-inputs support), and
// THE PROCESS DOOR - scripted: the "device list" is a text of this file. NO DEVICE IS LISTED,
// OPENED OR ASKED FOR, and no helper program is started. The fence of this app has not run its
// boot step (no database), so what it offers is put in its place: the registry the boot would build.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { LIVING_PROGRESS, deviceListText, scriptedDoor } from '../../capture/adapters/local/__tests__/mic-support';
import { buildDevelopmentRegistry, captureFenceControl, type BuiltCaptureRegistry } from '../../capture/fence';
import type { CaptureTimers } from '../../capture/types';
import { inputsUnitApp } from '../../modules/capture-inputs/__tests__/support';
import { errorOf, operatorOf, outcome } from '../../modules/devices/__tests__/support';
import { captureNotices } from '../index';

const apps: FastifyInstance[] = [];
const dirs: string[] = [];
const registries: BuiltCaptureRegistry[] = [];
afterEach(async () => {
  for (const registry of registries.splice(0)) await registry.closeAll();
  for (const app of apps.splice(0)) await app.close();
});
afterAll(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const timers: CaptureTimers = {
  after(delayMs, callback) {
    const timer = setTimeout(callback, Math.min(delayMs, 5));
    timer.unref();
    return () => clearTimeout(timer);
  },
};
const STORED = [
  { id: 'CAM-01', kind: 'CAMERA', adapterKind: 'FAKE', model: 'test camera 1' },
  { id: 'CAM-02', kind: 'CAMERA', adapterKind: 'FAKE', model: 'test camera 2' },
  { id: 'MIC-01', kind: 'MIC', adapterKind: 'FAKE', model: 'test microphone 1' },
  { id: 'MIC-02', kind: 'MIC', adapterKind: 'FAKE', model: 'test microphone 2' },
  { id: 'CAM-03', kind: 'CAMERA', adapterKind: 'LOCAL_DEVICE', model: 'MacBook Air Camera' },
  { id: 'MIC-03', kind: 'MIC', adapterKind: 'LOCAL_DEVICE', model: 'MacBook Air Microphone' },
] as const;

/** An app in real capture whose fence offers the development registry on a scripted door that lists `audioDevices`. */
async function build(audioDevices: readonly string[]) {
  const built = await inputsUnitApp({ captureMode: 'real' });
  apps.push(built.app);
  const dir = mkdtempSync(join(tmpdir(), 'dems-d9-probe-'));
  dirs.push(dir);
  const scripted = scriptedDoor(deviceListText(audioDevices, ['MacBook Air Camera']), () => ({ lives: true, reports: LIVING_PROGRESS }));
  const registry = buildDevelopmentRegistry({ devices: STORED, local: { cameraId: 'CAM-03', micId: 'MIC-03' }, program: '/bin/echo', runDir: join(dir, 'run'), now: () => built.clock.now(), timers, door: scripted.door });
  registries.push(registry);
  const fence = captureFenceControl(built.app);
  const offered = vi.spyOn(fence, 'probeAdapters');
  return { built, scripted, registry, offered };
}

describe('pass D9, item 5: the notices unit reads the probe from the capture fence', () => {
  it('CONTROL: while the fence offers no adapters (before its boot step) operation 97 answers 503 CAPTURE_NOT_READY; it is asked again at the next use, and from then on operation 97 answers 200', async () => {
    const { built, registry, offered } = await build(['MacBook Air Microphone']);
    built.actAs(operatorOf('SUPERVISOR'));
    // This app's fence has not booted: it offers null.
    expect(captureNotices(built.app).probe()).toBeNull();
    const refused = await built.post();
    expect(outcome(refused)).toEqual([503, 'NOT_READY']);
    expect(errorOf(refused).details).toEqual({ reason: 'CAPTURE_NOT_READY' });
    expect(offered).toHaveBeenCalled();
    offered.mockImplementation(() => registry.probeAdapters());
    expect((await built.post()).statusCode).toBe(200);
  });

  it('REAL_DEVELOPMENT: operation 97 answers each registered microphone from its adapter through the probe - and a LISTING is all the door was asked for: no device is opened, no helper is started', async () => {
    const { built, scripted, registry, offered } = await build(['MacBook Air Microphone']);
    offered.mockImplementation(() => registry.probeAdapters());
    built.actAs(operatorOf('TECHNICIAN'));
    const response = await built.post();
    expect(response.statusCode).toBe(200);
    const scan = response.json() as { inputs: { deviceId: string; present: boolean; adapter: string; sourceClass: string; errorCode: string | null }[] };
    // The registered microphones of this engine are the two test sources: each is read from ITS adapter of the running operation.
    expect(scan.inputs.map((input) => [input.deviceId, input.present, input.sourceClass, input.errorCode])).toEqual([['MIC-01', true, 'DEVELOPMENT', null], ['MIC-02', true, 'DEVELOPMENT', null]]);
    expect(new Set(scan.inputs.map((input) => input.adapter))).not.toContain('STATE');
    // The probe as wired also reads this Mac's microphone (registered on a development Core as MIC-03): present, by the listing alone.
    const reading = await captureNotices(built.app).probe()?.microphones();
    expect(reading?.microphones.find((entry) => entry.deviceId === 'MIC-03')).toMatchObject({ present: true, errorCode: null, adapterKind: 'LOCAL_DEVICE' });
    // The door: device-list calls only. Nothing was pushed to a pipe, no pipe was made, no camera was read.
    expect(scripted.calls.length).toBeGreaterThan(0);
    expect(scripted.calls.every((call) => call.args.includes('-list_devices'))).toBe(true);
    expect(scripted.pushes()).toEqual([]);
    expect(registry.openSources()).toEqual([]);
  });

  it('CONTROL of "from the probe": the same call when the list no longer names this Mac\'s microphone reads it absent with its named cause - the answer follows the adapter, not a constant', async () => {
    const { built, scripted, registry, offered } = await build(['Another Microphone']);
    offered.mockImplementation(() => registry.probeAdapters());
    const reading = await captureNotices(built.app).probe()?.microphones();
    const local = reading?.microphones.find((entry) => entry.deviceId === 'MIC-03');
    expect(local).toMatchObject({ present: false, adapterKind: 'LOCAL_DEVICE' });
    expect(local?.errorCode).not.toBeNull();
    expect(scripted.pushes()).toEqual([]);
  });

  // Fix wave M, follow-up M-S2. This file used to pin "the probe is kept once it was read: the fence
  // is not asked for a second adapter set" - the very snapshot that made a camera adopted during a
  // run read UNREACHABLE at its pre-check until the Core restarted. The booted path of the finding:
  // `modules/capture-discovery/__tests__/capture-discovery.booted.db.test.ts` (case "M-S2").
  it('M-S2: the fence is asked at EVERY use and no answer is kept - a camera the registry admits AFTER the first read (operation 96) is read through its own adapter at the next one; CONTROL: before its admission no adapter serves it', async () => {
    const { built, scripted, registry, offered } = await build(['MacBook Air Microphone']);
    offered.mockImplementation(() => registry.probeAdapters());
    const notices = captureNotices(built.app);
    const signal = new AbortController().signal;
    // The first use of the run. CONTROL: `CAM-04` is no device yet - nothing stands in for it.
    expect(await notices.probe()?.camera('CAM-02', signal)).toEqual({ reachable: true });
    expect(await notices.probe()?.camera('CAM-04', signal)).toEqual({ reachable: false, cause: 'UNREACHABLE' });
    const asked = offered.mock.calls.length;

    expect(registry.admit({ id: 'CAM-04', kind: 'CAMERA', adapterKind: 'FAKE', model: 'adopted test camera' })).toBe('ADMITTED');
    expect(await notices.probe()?.camera('CAM-04', signal)).toEqual({ reachable: true });
    expect(offered.mock.calls.length).toBe(asked + 1);
    // The cameras that were there before read as before; nothing was opened and no helper started for any of it.
    expect(await notices.probe()?.camera('CAM-02', signal)).toEqual({ reachable: true });
    expect(scripted.pushes()).toEqual([]);
    expect(registry.openSources()).toEqual([]);
  });
});
