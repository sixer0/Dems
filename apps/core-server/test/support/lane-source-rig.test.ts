// The development source rig of a lane (`lane-source-rig.ts`; fix wave M, ruling D232; final
// re-check 70 finding G70d-01). The rule on its own, the real switch file, and the three answers of
// the fence. What the rig DOES to the product - the generated adapters behind the product's own
// pre-check - is proven where those live: `src/capture/fence/__tests__/open-sources.test.ts` and
// `src/capture-notices/__tests__/notices.test.ts`.
//
// No device, no process, no database: the apps here are never made ready (the one registry of the
// last-but-one block is built on a door that refuses every start).
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app';
import { probeOfAdapters } from '../../src/capture-notices';
import { DevelopmentSourceSwitchRefusedError, buildDevelopmentRegistry, captureFenceControl, type BuiltCaptureRegistry } from '../../src/capture/fence';
import { unitTestConfig } from './config';
import { LANE_SOURCE_RIG_CHECK, LANE_SOURCE_RIG_IN_PRODUCTION, LANE_SOURCE_RIG_MAX_DEVICES, LaneSourceRigError, createLaneSourceRig, laneSourceRigSwitchOf, prepareLaneSourceRig } from './lane-source-rig';

const dir = mkdtempSync(join(tmpdir(), 'dems-source-rig-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

/** A rig on a text the test sets; `generated` is what the running registry serves as FAKE cameras and microphones. */
function rigOn(generated: readonly string[] | null = ['CAM-01', 'CAM-02', 'CAM-05', 'MIC-01', 'MIC-02']) {
  const said: Array<[string, string, Record<string, string | null>]> = [];
  const file: { text: string | null; fails: boolean; reads: number } = { text: null, fails: false, reads: 0 };
  const rig = createLaneSourceRig({
    read: () => {
      file.reads += 1;
      if (file.fails) throw new Error('EACCES');
      return file.text;
    },
    generated: () => generated,
    report: (level, code, _message, context) => void said.push([level, code, context]),
  });
  return { rig, file, said, codes: () => said.map(([, code]) => code) };
}

describe('the source rig: the switch and the rule', () => {
  it('the switch grammar: OFF / empty are off; UNREACHABLE and one to four CAM-NN / MIC-NN name devices (a repeat is one); anything else is OFF and named unknown', () => {
    expect(laneSourceRigSwitchOf('')).toEqual({ devices: [], unknown: false });
    expect(laneSourceRigSwitchOf('OFF\n')).toEqual({ devices: [], unknown: false });
    expect(laneSourceRigSwitchOf('UNREACHABLE CAM-05\n')).toEqual({ devices: ['CAM-05'], unknown: false });
    expect(laneSourceRigSwitchOf('UNREACHABLE CAM-05 MIC-02 CAM-05')).toEqual({ devices: ['CAM-05', 'MIC-02'], unknown: false });
    expect(LANE_SOURCE_RIG_MAX_DEVICES).toBe(4);
    for (const text of ['UNREACHABLE', 'ON CAM-05', 'UNREACHABLE cam-05', 'UNREACHABLE POE-SWITCH', 'UNREACHABLE 127.0.0.1:64850', 'UNREACHABLE CAM-01 CAM-02 CAM-04 CAM-05 MIC-01', 'UNREACHABLE CAM-05; rm -rf', 'OFF CAM-05']) {
      expect(laneSourceRigSwitchOf(text), text).toEqual({ devices: [], unknown: true });
    }
  });

  it('OFF by default: no file, OFF and an unknown word switch nothing; the unknown word is said once', () => {
    const { rig, file, codes } = rigOn();
    expect(rig.unreachable('CAM-05')).toBe(false);
    file.text = 'OFF\n';
    expect(rig.unreachable('CAM-05')).toBe(false);
    expect(codes()).toEqual([]);
    file.text = 'BROKEN CAM-05\n';
    expect([rig.unreachable('CAM-05'), rig.unreachable('CAM-05')]).toEqual([false, false]);
    expect(codes()).toEqual(['LANE_SOURCE_RIG_SWITCH_UNKNOWN']);
  });

  it('the named device is unreachable and no other; the file is read at EVERY call, so a release - and a second arming - take effect without a restart, each arming said once', () => {
    const { rig, file, said } = rigOn();
    file.text = 'UNREACHABLE CAM-05\n';
    expect([rig.unreachable('CAM-05'), rig.unreachable('CAM-02'), rig.unreachable('MIC-02'), rig.unreachable('CAM-05')]).toEqual([true, false, false, true]);
    expect(said).toEqual([['warn', 'LANE_SOURCE_RIG_ON', { deviceId: 'CAM-05' }]]);
    expect(file.reads).toBe(4);
    file.text = 'OFF\n';
    expect(rig.unreachable('CAM-05')).toBe(false);
    file.text = 'UNREACHABLE CAM-05 MIC-02\n';
    expect([rig.unreachable('CAM-05'), rig.unreachable('MIC-02'), rig.unreachable('MIC-01')]).toEqual([true, true, false]);
    expect(said.map(([, code, context]) => `${code} ${context['deviceId']}`)).toEqual(['LANE_SOURCE_RIG_ON CAM-05', 'LANE_SOURCE_RIG_ON CAM-05', 'LANE_SOURCE_RIG_ON MIC-02']);
  });

  it('NEVER a device that is no generated source: a switch that names this computer\'s camera (CAM-03) or an unknown device changes nothing for it and says so once; the generated one beside it is still switched', () => {
    const { rig, file, said } = rigOn(['CAM-01', 'CAM-02', 'MIC-01', 'MIC-02']);
    file.text = 'UNREACHABLE CAM-03 CAM-02 MIC-09\n';
    // The generated adapters ask for THEIR OWN device only; nobody asks for CAM-03 (the fence hands the switch to no local adapter).
    expect([rig.unreachable('CAM-02'), rig.unreachable('CAM-01'), rig.unreachable('CAM-02')]).toEqual([true, false, true]);
    expect(said.map(([level, code, context]) => `${level} ${code} ${context['deviceId']}`)).toEqual(['warn LANE_SOURCE_RIG_NOT_A_FAKE_DEVICE CAM-03', 'warn LANE_SOURCE_RIG_NOT_A_FAKE_DEVICE MIC-09', 'warn LANE_SOURCE_RIG_ON CAM-02']);
  });

  it('a switch file that cannot be read switches nothing, never throws into the adapter, and is said once at level error', () => {
    const { rig, file, said } = rigOn();
    file.fails = true;
    expect([rig.unreachable('CAM-05'), rig.unreachable('CAM-05')]).toEqual([false, false]);
    expect(said.map(([level, code]) => [level, code])).toEqual([['error', 'LANE_SOURCE_RIG_UNREADABLE']]);
  });
});

// Fix wave M, follow-up M-S2: the rig and a camera that was ADOPTED during the run (operation 96 ->
// the fence's `admit`). The rig asks the registry at every call which sources are generated, the
// admitted adapter is built with the same switch as a boot's, and the probe is made per use.
describe('the source rig: a camera adopted during the run', () => {
  it('the adopted camera answers until the switch names it, is UNREACHABLE while it does (said once, never "not a fake device"), and answers again after the release - no restart; the stored camera beside it is never touched', async () => {
    const file: { text: string | null } = { text: null };
    const said: string[] = [];
    const started: string[] = [];
    let built: BuiltCaptureRegistry | null = null;
    const rig = createLaneSourceRig({
      read: () => file.text,
      // As `prepareLaneSourceRig().install()` reads it: the FAKE cameras and microphones the registry serves NOW.
      generated: () => built?.registry.list().filter((device) => device.adapterKind === 'FAKE' && (device.deviceClass === 'CAMERA' || device.deviceClass === 'MIC')).map((device) => device.id) ?? null,
      report: (_level, code, _message, context) => void said.push(`${code} ${String(context['deviceId'] ?? '')}`.trim()),
    });
    built = buildDevelopmentRegistry({
      devices: [
        { id: 'CAM-02', kind: 'CAMERA', adapterKind: 'FAKE', model: 'test camera 2' },
        { id: 'CAM-03', kind: 'CAMERA', adapterKind: 'LOCAL_DEVICE', model: 'this computer' },
        { id: 'MIC-03', kind: 'MIC', adapterKind: 'LOCAL_DEVICE', model: 'this computer' },
      ],
      local: { cameraId: 'CAM-03', micId: 'MIC-03' },
      program: '/bin/echo',
      runDir: join(dir, 'run-adopted'),
      now: () => 0,
      timers: { after: () => () => {} },
      // No helper may be started by a reachability read of a generated source.
      door: ((...args: unknown[]) => {
        started.push(String(args[0]));
        throw new Error('no process in this test');
      }) as never,
      sourceUnreachable: (deviceId) => rig.unreachable(deviceId),
    });
    const read = (deviceId: string): Promise<unknown> => probeOfAdapters(built.probeAdapters()!).camera(deviceId, new AbortController().signal);

    // Armed BEFORE the adoption for a device that does not exist yet: nothing answers for it, and the rig says what it is not.
    file.text = 'UNREACHABLE CAM-06\n';
    expect(await read('CAM-02')).toEqual({ reachable: true });
    expect(said).toEqual(['LANE_SOURCE_RIG_NOT_A_FAKE_DEVICE CAM-06']);
    file.text = 'OFF\n';

    expect(built.admit({ id: 'CAM-06', kind: 'CAMERA', adapterKind: 'FAKE', model: 'adopted test camera' })).toBe('ADMITTED');
    expect(await read('CAM-06')).toEqual({ reachable: true });
    file.text = 'UNREACHABLE CAM-06\n';
    expect([await read('CAM-06'), await read('CAM-06')]).toEqual([{ reachable: false, cause: 'UNREACHABLE' }, { reachable: false, cause: 'UNREACHABLE' }]);
    expect(await read('CAM-02')).toEqual({ reachable: true });
    file.text = 'OFF\n';
    expect(await read('CAM-06')).toEqual({ reachable: true });
    expect(said).toEqual(['LANE_SOURCE_RIG_NOT_A_FAKE_DEVICE CAM-06', 'LANE_SOURCE_RIG_ON CAM-06']);
    expect(started).toEqual([]);
    await built.closeAll();
  });
});

describe('the source rig: refused outside development capture', () => {
  const appOf = (config: Parameters<typeof unitTestConfig>[0]) => buildApp({ config: unitTestConfig(config), logStream: { write: () => {} } });
  const PRODUCTION = { captureMode: 'real', captureDevSources: false, demoControls: false } as const;
  const DEVELOPMENT = { captureMode: 'real', captureDevSources: true, demoControls: false } as const;

  it('REAL_PRODUCTION: the rig throws before anything is started (the launcher ends in the boot\'s final line), with or without a switch file', () => {
    const app = appOf(PRODUCTION);
    let thrown: unknown = null;
    try {
      prepareLaneSourceRig(app, '/nonexistent/switch');
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(LaneSourceRigError);
    expect((thrown as LaneSourceRigError).code).toBe(LANE_SOURCE_RIG_IN_PRODUCTION);
    expect([LANE_SOURCE_RIG_CHECK, LANE_SOURCE_RIG_IN_PRODUCTION]).toEqual(['capture.sourceRig', 'DEV_SOURCE_RIG_IN_PRODUCTION']);
    expect(() => prepareLaneSourceRig(app, null)).toThrow(LaneSourceRigError);
  });

  it('SIMULATED: not admitted, nothing is installed; and without a switch file path the rig is inert', () => {
    expect(prepareLaneSourceRig(appOf({}), '/nonexistent/switch')).toMatchObject({ operation: 'SIMULATED', admitted: false });
    expect(prepareLaneSourceRig(appOf(DEVELOPMENT), null)).toMatchObject({ operation: 'REAL_DEVELOPMENT', admitted: false });
  });

  it('THE FENCE refuses a source switch outside REAL_DEVELOPMENT, by name, and takes it in development capture', async () => {
    for (const config of [PRODUCTION, {}]) {
      const app = appOf(config);
      await app.ready();
      let thrown: unknown = null;
      try {
        captureFenceControl(app).installDevelopmentSourceSwitch(() => true);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(DevelopmentSourceSwitchRefusedError);
      expect((thrown as DevelopmentSourceSwitchRefusedError).code).toBe('DEV_SOURCE_SWITCH_NEEDS_DEV_SOURCES');
      await app.close();
    }
    const development = appOf(DEVELOPMENT);
    await development.ready();
    expect(() => captureFenceControl(development).installDevelopmentSourceSwitch(() => true)).not.toThrow();
    await development.close();
  });

  it('REAL_DEVELOPMENT with a switch file: admitted; installed on the ready app with one info line; a file that does not exist is OFF', async () => {
    const lines: string[] = [];
    const app = buildApp({ config: unitTestConfig({ ...DEVELOPMENT, logLevel: 'info' }), logStream: { write: (line: string) => void lines.push(line) } });
    const path = join(dir, 'source-rig.switch');
    const rig = prepareLaneSourceRig(app, path);
    expect(rig).toMatchObject({ operation: 'REAL_DEVELOPMENT', admitted: true });
    await app.ready();
    rig.install();
    expect(lines.filter((line) => line.includes('LANE_SOURCE_RIG_INSTALLED'))).toHaveLength(1);
    // The fence has not booted here (no database): there is no generated adapter to ask the switch. The file itself is exercised in open-sources.test.ts.
    writeFileSync(path, 'UNREACHABLE CAM-02\n', { mode: 0o600 });
    expect(captureFenceControl(app).registry()).toBeNull();
    await app.close();
  });
});
