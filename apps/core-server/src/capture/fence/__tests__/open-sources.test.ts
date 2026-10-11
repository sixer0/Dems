// What the fence says of the OPEN local sources and what it hands the reachability probe (blueprint
// row 140, R-11; ux spec §8f.3 "'Is on' indicator", SEC35-44 (4), erratum PE-128-78; capture spec
// §A.6.4 HL-10 / HL-12; contract C3 §2.6 "Microphones").
//
// NO DEVICE IS OPENED, LISTED OR ASKED FOR: every registry here is built with the scripted process
// door of the microphone tests. That door starts a real process for ONE command only, `mkfifo` (the
// pipe of a microphone must exist); the helper program is played from a script and its path
// (`/opt/dems/helpers/ffmpeg`) is never started.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { createLaneSourceRig } from '../../../../test/support/lane-source-rig';
import { probeOfAdapters } from '../../../capture-notices/probe';
import type { CaptureTimers } from '../../types';
import { LIVING_PROGRESS, deviceListText, exitOf, scriptedDoor, temporaryRoot, trustedInspector, type ScriptedDoor } from '../../adapters/local/__tests__/mic-support';
import { GENERATED_SOURCE_SWITCHED_UNREACHABLE, GeneratedSourceUnreachableError, buildDevelopmentRegistry, buildProductionRegistry } from '../index';
import { HELPER, LOCAL, SEEDED } from './support';

/**
 * The settle time of a helper (1.5 s) fires at the next turn, so a helper "settles" at once; every
 * longer delay is a BOUND (a list call, `mkfifo`, the first frame) and keeps its real length - the
 * one real process of these tests, `mkfifo`, must be allowed to end before its bound.
 */
const soon: CaptureTimers = {
  after(delayMs, callback) {
    if (delayMs > 1_500) {
      const timer = setTimeout(callback, delayMs);
      timer.unref();
      return () => clearTimeout(timer);
    }
    const handle = setImmediate(callback);
    return () => clearImmediate(handle);
  },
};
const LIST = deviceListText(['MacBook Air Microphone'], ['MacBook Air Camera', 'Capture screen 0']);
const LIVING = { lives: true, reports: LIVING_PROGRESS } as const;
const root = temporaryRoot();
afterAll(() => root.remove());

function development(scripted: ScriptedDoor) {
  /** What `openSources()` answered at each change, in order. */
  const seen: string[][] = [];
  const built = buildDevelopmentRegistry({
    devices: [...SEEDED, ...LOCAL],
    local: { cameraId: 'CAM-03', micId: 'MIC-03' },
    program: HELPER,
    runDir: root.runDir,
    now: () => 1_760_000_000_000,
    timers: soon,
    door: scripted.door,
    inspect: trustedInspector(),
    onOpenSourcesChanged: () => void seen.push([...built.openSources()]),
  });
  return { built, seen };
}
const to = (port: number) => ({ ingestUrl: `rtsp://127.0.0.1:${port}/live/x`, profile: 'H264_720P30' }) as never;

describe('M5-SEC-PRIV-2 (Core half): the listeners are told at every open, close and loss of a LOCAL source', () => {
  it('the local camera: on after the open, off after the close - told both times with the list of that moment', async () => {
    const { built, seen } = development(scriptedDoor(LIST, () => LIVING));
    const handle = await built.registry.resolve('CAMERA', 'CAM-03').openSource('CAM-03', to(8555), new AbortController().signal);
    expect(seen).toEqual([['CAM-03']]);
    await handle.close();
    expect(seen).toEqual([['CAM-03'], []]);
    expect(built.openSources()).toEqual([]);
  });

  it('the local microphone: on from the prepared pipe (before any helper), off after the close; the stream keeps its `start`', async () => {
    const scripted = scriptedDoor(LIST, () => LIVING);
    const { built, seen } = development(scripted);
    const stream = await built.registry.resolve('MIC', 'MIC-03').open('MIC-03', { sessionId: 'SES-20261009-0140', signal: new AbortController().signal });
    expect(seen).toEqual([['MIC-03']]);
    // The wrapped stream is still the helper's: the session wiring starts the helper through it (ML-5).
    expect(typeof (stream as unknown as { start?: unknown }).start).toBe('function');
    expect(stream.input).toMatchObject({ kind: 'PCM_FIFO' });
    // Only the device list was read: no helper was started by `open`.
    expect(scripted.pushes()).toEqual([]);
    await stream.close();
    expect(seen).toEqual([['MIC-03'], []]);
  });

  it('a camera helper that ends by itself: the listeners are told, and the camera is no longer on', async () => {
    const scripted = scriptedDoor(LIST, () => LIVING);
    const { built, seen } = development(scripted);
    await built.registry.resolve('CAMERA', 'CAM-03').openSource('CAM-03', to(8555), new AbortController().signal);
    // ffmpeg[0] is the list call; ffmpeg[1] the push.
    scripted.ffmpeg[1]?.endNow(exitOf({ exitCode: 1 }));
    await vi.waitFor(() => expect(seen).toEqual([['CAM-03'], []]));
  });

  it('CONTROL: a TEST source (kind FAKE) is never "on": opening and closing it tells nobody', async () => {
    const { built, seen } = development(scriptedDoor(LIST, () => LIVING));
    const handle = await built.registry.resolve('CAMERA', 'CAM-02').openSource('CAM-02', to(8556), new AbortController().signal);
    expect(built.openSources()).toEqual([]);
    await handle.close();
    expect(seen).toEqual([]);
  });
});

describe('what the reachability probe is handed (`probeAdapters`)', () => {
  it('every camera and microphone adapter of REAL_DEVELOPMENT, the local device first', () => {
    const { built } = development(scriptedDoor(LIST, () => LIVING));
    const input = built.probeAdapters();
    expect(input?.cameras.map((adapter) => `${adapter.devices[0]?.id} ${adapter.kind}`)).toEqual(['CAM-03 LOCAL_DEVICE', 'CAM-01 FAKE', 'CAM-02 FAKE']);
    expect(input?.microphones.map((adapter) => `${adapter.devices[0]?.id} ${adapter.kind}`)).toEqual(['MIC-03 LOCAL_DEVICE', 'MIC-01 FAKE', 'MIC-02 FAKE']);
  });

  it('a test source is asked through its profiles: 0 processes, nothing opened', async () => {
    const scripted = scriptedDoor(LIST, () => LIVING);
    const { built, seen } = development(scripted);
    const input = built.probeAdapters();
    const fake = input?.cameras.find((adapter) => adapter.devices[0]?.id === 'CAM-02');
    await expect(input?.readCamera(fake!, 'CAM-02', new AbortController().signal)).resolves.toEqual([{ code: 'H264_720P30', codec: 'H264' }]);
    expect(scripted.calls).toEqual([]);
    expect(seen).toEqual([]);
  });

  it('the LOCAL camera is asked through ONE short open: it is "on" for that moment and off after it', async () => {
    // The pre-check process ends at once with status 0: the short open worked.
    const scripted = scriptedDoor(LIST, () => ({ ends: exitOf({ exitCode: 0 }) }));
    const { built, seen } = development(scripted);
    const input = built.probeAdapters();
    await expect(input?.readCamera(input.cameras[0]!, 'CAM-03', new AbortController().signal)).resolves.toBeNull();
    expect(seen).toEqual([['CAM-03'], []]);
    // The list, then one process that is not a push toward a listener: nothing was pushed anywhere.
    expect(scripted.calls.map((call) => call.args.includes('-list_devices'))).toEqual([true, false]);
    expect(scripted.calls[1]?.args.join(' ')).not.toMatch(/rtsp:/);
  });

  it('a local camera that is not in the device list: the read REJECTS with the named cause, 0 opens, and the camera is off again', async () => {
    const scripted = scriptedDoor(deviceListText(['MacBook Air Microphone'], ['Capture screen 0']), () => ({ ends: exitOf({ exitCode: 0 }) }));
    const { built, seen } = development(scripted);
    const input = built.probeAdapters();
    await expect(input?.readCamera(input.cameras[0]!, 'CAM-03', new AbortController().signal)).rejects.toMatchObject({ code: 'DEVICE_NOT_FOUND', deviceId: 'CAM-03' });
    expect(scripted.pushes()).toEqual([]);
    expect(seen).toEqual([['CAM-03'], []]);
    // Nothing stands in for it: the registry still answers the local device for its id.
    expect(built.registry.describe('CAM-03').adapterKind).toBe('LOCAL_DEVICE');
  });

  it('REAL_PRODUCTION of this phase registers no adapter: there is nothing to ask', () => {
    expect(buildProductionRegistry().probeAdapters()).toBeNull();
  });
});

// Fix wave M (final re-check 70 finding G70d-01, ruling D232): a generated source dials nothing, so nothing could make it
// "not there". The development source switch does, through the adapter's OWN read and open - driven here by the REAL lane rig
// (`test/support/lane-source-rig.ts`) on a REAL switch file, as `lane.sh source-rig` writes it.
describe('the development source switch: a GENERATED source answers as unreachable through its own doors', () => {
  const switchFile = join(root.root, 'source-rig.switch');
  const setSwitch = (text: string): void => writeFileSync(switchFile, text, { mode: 0o600 });
  /** The registry with the lane rig as its switch; `asked` holds every device the switch was asked for. */
  function rigged(scripted: ScriptedDoor) {
    const asked: string[] = [];
    const said: string[] = [];
    let serves: readonly string[] | null = null;
    const rig = createLaneSourceRig({
      read: () => (existsSync(switchFile) ? readFileSync(switchFile, 'utf8') : null),
      generated: () => serves,
      report: (_level, code, _message, context) => void said.push(`${code} ${String(context['deviceId'])}`),
    });
    const built = buildDevelopmentRegistry({
      devices: [...SEEDED, ...LOCAL],
      local: { cameraId: 'CAM-03', micId: 'MIC-03' },
      program: HELPER,
      runDir: root.runDir,
      now: () => 1_760_000_000_000,
      timers: soon,
      door: scripted.door,
      inspect: trustedInspector(),
      sourceUnreachable: (deviceId) => {
        asked.push(deviceId);
        return rig.unreachable(deviceId);
      },
    });
    serves = built.registry.list().filter((device) => device.adapterKind === 'FAKE' && device.deviceClass !== 'POE').map((device) => device.id);
    return { built, asked, said, probe: probeOfAdapters(built.probeAdapters()!) };
  }
  const signal = (): AbortSignal => new AbortController().signal;

  it('CONTROL (the finding): with the switch OFF every generated source answers - also after the file was written and released', async () => {
    const scripted = scriptedDoor(LIST, () => LIVING);
    const { probe, said } = rigged(scripted);
    setSwitch('OFF\n');
    expect(await probe.camera('CAM-02', signal())).toEqual({ reachable: true });
    expect((await probe.microphones()).microphones.filter((entry) => entry.adapterKind === 'FAKE').map((entry) => [entry.deviceId, entry.present])).toEqual([['MIC-01', true], ['MIC-02', true]]);
    expect(said).toEqual([]);
  });

  it('a switched CAMERA: the product\'s probe reads it unreachable with the cause UNREACHABLE; the other camera answers; 0 processes; released, it answers again - no restart', async () => {
    const scripted = scriptedDoor(LIST, () => LIVING);
    const { built, probe, said } = rigged(scripted);
    setSwitch('UNREACHABLE CAM-02\n');
    expect(await probe.camera('CAM-02', signal())).toEqual({ reachable: false, cause: 'UNREACHABLE' });
    expect(await probe.camera('CAM-01', signal())).toEqual({ reachable: true });
    // The adapter's own read is what failed, by name.
    const fake = built.probeAdapters()!.cameras.find((adapter) => adapter.devices[0]?.id === 'CAM-02')!;
    await expect(fake.profiles('CAM-02')).rejects.toBeInstanceOf(GeneratedSourceUnreachableError);
    await expect(fake.profiles('CAM-02')).rejects.toMatchObject({ code: GENERATED_SOURCE_SWITCHED_UNREACHABLE, deviceId: 'CAM-02' });
    expect(scripted.calls).toEqual([]);
    expect(said).toEqual(['LANE_SOURCE_RIG_ON CAM-02']);
    setSwitch('OFF\n');
    expect(await probe.camera('CAM-02', signal())).toEqual({ reachable: true });
  });

  it('a switched camera is refused at its OPEN as well: no helper is started for it, the other camera opens; a source that is OPEN ALREADY is not ended by the switch', async () => {
    const scripted = scriptedDoor(LIST, () => LIVING);
    const { built } = rigged(scripted);
    setSwitch('OFF\n');
    const running = await built.registry.resolve('CAMERA', 'CAM-01').openSource('CAM-01', to(8555), signal());
    setSwitch('UNREACHABLE CAM-01 CAM-02\n');
    await expect(built.registry.resolve('CAMERA', 'CAM-02').openSource('CAM-02', to(8557), signal())).rejects.toBeInstanceOf(GeneratedSourceUnreachableError);
    // ONE push: the one that was started before the switch; it still runs.
    expect(scripted.pushes()).toHaveLength(1);
    await running.close();
    setSwitch('OFF\n');
  });

  it('a switched MICROPHONE: absent in the input list with DEVICE_NOT_FOUND and refused at its open (no pipe, no helper); the other microphone is present', async () => {
    const scripted = scriptedDoor(LIST, () => LIVING);
    const { built, probe } = rigged(scripted);
    setSwitch('UNREACHABLE MIC-02\n');
    const fakes = (await probe.microphones()).microphones.filter((entry) => entry.adapterKind === 'FAKE');
    expect(fakes.map((entry) => [entry.deviceId, entry.present, entry.errorCode])).toEqual([['MIC-01', true, null], ['MIC-02', false, 'DEVICE_NOT_FOUND']]);
    const before = scripted.calls.length;
    await expect(built.registry.resolve('MIC', 'MIC-02').open('MIC-02', { sessionId: 'SES-20261011-0001', signal: signal() })).rejects.toBeInstanceOf(GeneratedSourceUnreachableError);
    expect(scripted.calls.length).toBe(before);
    setSwitch('OFF\n');
    expect((await probe.microphones()).microphones.find((entry) => entry.deviceId === 'MIC-02')).toMatchObject({ present: true, errorCode: null });
  });

  it('NEVER A LOCAL DEVICE: a switch that names this computer\'s camera and microphone is never even ASKED for them - their adapters answer as without the switch, and the rig says it touches neither', async () => {
    // The short open of the local camera ends at once with status 0, and the list names both local devices.
    const scripted = scriptedDoor(LIST, () => ({ ends: exitOf({ exitCode: 0 }) }));
    const { built, asked, said } = rigged(scripted);
    setSwitch('UNREACHABLE CAM-03 MIC-03 CAM-02\n');
    const input = built.probeAdapters()!;
    await expect(input.readCamera(input.cameras[0]!, 'CAM-03', signal())).resolves.toBeNull();
    const probe = probeOfAdapters(input);
    expect((await probe.microphones()).microphones.find((entry) => entry.deviceId === 'MIC-03')).toMatchObject({ present: true, adapterKind: 'LOCAL_DEVICE' });
    expect(await probe.camera('CAM-02', signal())).toEqual({ reachable: false, cause: 'UNREACHABLE' });
    expect(asked.filter((deviceId) => deviceId === 'CAM-03' || deviceId === 'MIC-03')).toEqual([]);
    expect([...new Set(asked)].sort()).toEqual(['CAM-02', 'MIC-01', 'MIC-02']);
    expect(said).toContain('LANE_SOURCE_RIG_NOT_A_FAKE_DEVICE CAM-03');
    expect(said).toContain('LANE_SOURCE_RIG_NOT_A_FAKE_DEVICE MIC-03');
    setSwitch('OFF\n');
  });

  it('a switch that throws switches nothing: the source answers', async () => {
    const built = buildDevelopmentRegistry({
      devices: [...SEEDED, ...LOCAL],
      local: { cameraId: 'CAM-03', micId: 'MIC-03' },
      program: HELPER,
      runDir: root.runDir,
      now: () => 1_760_000_000_000,
      timers: soon,
      door: scriptedDoor(LIST, () => LIVING).door,
      inspect: trustedInspector(),
      sourceUnreachable: () => {
        throw new Error('the switch failed');
      },
    });
    expect(await probeOfAdapters(built.probeAdapters()!).camera('CAM-02', signal())).toEqual({ reachable: true });
  });
});
