// The development camera stub of a lane Core, without a database (fix wave H, driver D; gate 70
// finding B-1; decision D196; test strategy CR-5). The real app factory in each capture operation;
// what a booted development Core answers through it is the database test's
// (`src/modules/capture-discovery/__tests__/lane-camera-stub.db.test.ts`).
//
// Every listener here is the stub's own, on 127.0.0.1 and ephemeral ports. No search is sent in
// this file at all. The account is made per test and opens nothing but the stub.
import { mkdtempSync, readFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app';
import { DEV_CAMERA_STUB_IN_PRODUCTION, DevelopmentDiscoveryError } from '../../src/capture/fence';
import type { ConfigInput } from '../../src/config';
import { captureDiscoveryControl } from '../../src/modules/capture-discovery';
import { captureLog, unitTestConfig, type CapturedLog } from './config';
import { LANE_CAMERA_STUB_DEVICES, LANE_CAMERA_STUB_MODE_POLL_MS, LaneCameraStubPreset, laneCameraStubPresetOf, newLaneFixtureAccount, prepareLaneCameraStub, type LaneCameraStub } from './lane-camera-stub';

const DEVELOPMENT: Partial<ConfigInput> = { captureMode: 'real', demoControls: false, captureDevSources: true };
const PRODUCTION: Partial<ConfigInput> = { captureMode: 'real', demoControls: false };

const apps: FastifyInstance[] = [];
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});

function core(overrides: Partial<ConfigInput>): { app: FastifyInstance; log: CapturedLog; files: { fixtureFile: string; modeFile: string } } {
  const log = captureLog();
  const app = buildApp({ config: unitTestConfig({ logLevel: 'info', ...overrides }), logStream: log.stream });
  apps.push(app);
  const directory = mkdtempSync(join(tmpdir(), 'lane-camera-stub-'));
  return { app, log, files: { fixtureFile: join(directory, 'fixture'), modeFile: join(directory, 'mode') } };
}
const boundOf = (stub: LaneCameraStub): string[] => (stub.stub?.addresses().bound ?? []).map((entry) => entry.listener).sort();
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('the presets of the mode file', () => {
  it('the first word names the preset, in any case; anything else is no preset', () => {
    expect(Object.values(LaneCameraStubPreset)).toEqual(['NORMAL', 'AUTH_SCHEME', 'UNREACHABLE', 'NO_PROFILE', 'NOT_H264', 'EMPTY']);
    expect(laneCameraStubPresetOf('AUTH_SCHEME\n')).toBe('AUTH_SCHEME');
    expect(laneCameraStubPresetOf('  unreachable   # the port is closed\n')).toBe('UNREACHABLE');
    for (const text of ['', '\n', 'BASIC_ONLY', 'NORMAL;rm', '127.0.0.1']) expect(laneCameraStubPresetOf(text), text).toBeNull();
  });

  it('a fixture account is two typeable words, another one at each start', () => {
    const [first, second] = [newLaneFixtureAccount(), newLaneFixtureAccount()];
    expect(first.username).toMatch(/^stub[0-9a-f]{6}$/);
    expect(first.secret).toMatch(/^fx[0-9a-f]{12}$/);
    expect(first.secret).not.toBe(second.secret);
  });
});

describe('who gets the stub: the capture fence decides', () => {
  it('REAL_PRODUCTION: refused by name BEFORE anything is started - no stub, no fixture file, no mode file, and the Core has no development source', async () => {
    const { app, files } = core(PRODUCTION);
    // A fixture file of an earlier (development) run must not survive a refused start.
    writeFileSync(files.fixtureFile, 'username=old\nsecret=old\n');
    await expect(prepareLaneCameraStub(app, files)).rejects.toMatchObject({ name: 'DevelopmentDiscoveryError', code: DEV_CAMERA_STUB_IN_PRODUCTION });
    await expect(prepareLaneCameraStub(app, files)).rejects.toBeInstanceOf(DevelopmentDiscoveryError);
    expect(existsSync(files.fixtureFile)).toBe(false);
    expect(existsSync(files.modeFile)).toBe(false);
  });

  it('SIMULATED: ignored and said so - nothing is started, no file is written, and the Core still has no camera search', async () => {
    const { app, log, files } = core({ demoControls: true });
    const stub = await prepareLaneCameraStub(app, files);
    expect(stub.admission).toEqual({ admitted: false, operation: 'SIMULATED', ignored: 'SIMULATED_HAS_NO_SEARCH' });
    expect([stub.stub, stub.account]).toEqual([null, null]);
    expect(existsSync(files.fixtureFile)).toBe(false);
    expect(existsSync(files.modeFile)).toBe(false);
    await app.ready();
    stub.announce();
    // No adapter was handed in: operation 93 of this Core answers 503 DISCOVERY_NOT_READY, as without the launcher.
    expect(captureDiscoveryControl(app).ready()).toBe(false);
    const said = log.lines().filter((line) => line['code'] === 'LANE_CAMERA_STUB_IGNORED');
    expect(said).toHaveLength(1);
    expect(said[0]).toMatchObject({ level: 40, operation: 'SIMULATED', reason: 'SIMULATED_HAS_NO_SEARCH' });
    expect(String(said[0]?.['msg'])).toMatch(/ignored.*SIMULATED/);
  });

  it('REAL_DEVELOPMENT: admitted - ONE device on 127.0.0.1 and ephemeral ports, the account in an owner-only file and in no log line, and the factory is handed in once', async () => {
    const { app, log, files } = core(DEVELOPMENT);
    const stub = await prepareLaneCameraStub(app, files);
    expect(stub.admission).toEqual({ admitted: true, operation: 'REAL_DEVELOPMENT' });
    expect(stub.stub?.devices()).toHaveLength(LANE_CAMERA_STUB_DEVICES);
    expect(LANE_CAMERA_STUB_DEVICES).toBe(1);
    const bound = stub.stub?.addresses().bound ?? [];
    expect(bound.map((entry) => entry.listener).sort()).toEqual(['device', 'discovery', 'rtsp']);
    expect(new Set(bound.map((entry) => entry.address))).toEqual(new Set(['127.0.0.1']));
    expect(bound.every((entry) => entry.port >= 32_768)).toBe(true);

    const account = stub.account;
    if (account === null) throw new Error('an admitted stub has an account');
    expect(readFileSync(files.fixtureFile, 'utf8')).toBe(`username=${account.username}\nsecret=${account.secret}\n`);
    expect(statSync(files.fixtureFile).mode & 0o777).toBe(0o600);
    expect(readFileSync(files.modeFile, 'utf8')).toBe('NORMAL\n');
    expect(log.text()).not.toContain(account.secret);
    expect(log.text()).not.toContain(account.username);
    expect(log.lines().filter((line) => line['code'] === 'LANE_CAMERA_STUB_STARTED')).toHaveLength(1);

    await app.ready();
    stub.announce();
    expect(captureDiscoveryControl(app).ready()).toBe(true);
    expect(() => stub.announce()).toThrow(/twice/);
    // The Core takes ONE factory: the product's own (the WS-Discovery group) can no longer be chosen on this process.
    expect(() => captureDiscoveryControl(app).provideAdapter(() => { throw new Error('never built'); })).toThrow(/provided twice/);

    // The app's close stops the stub and removes the account's file.
    await app.close();
    expect(boundOf(stub)).toEqual([]);
    expect(existsSync(files.fixtureFile)).toBe(false);
  });
});

describe('the presets switch a running stub', () => {
  it('UNREACHABLE closes the camera\'s service port and NORMAL opens it again on the SAME port; the mode file switches it too; an unknown word changes nothing', async () => {
    const { app, log, files } = core(DEVELOPMENT);
    const stub = await prepareLaneCameraStub(app, files);
    const devicePort = stub.stub?.addresses().bound.find((entry) => entry.listener === 'device')?.port;
    expect(stub.preset()).toBe('NORMAL');

    await stub.apply(LaneCameraStubPreset.UNREACHABLE);
    expect(stub.preset()).toBe('UNREACHABLE');
    expect(boundOf(stub)).toEqual(['discovery', 'rtsp']);
    await stub.apply(LaneCameraStubPreset.NORMAL);
    expect(boundOf(stub)).toEqual(['device', 'discovery', 'rtsp']);
    expect(stub.stub?.addresses().bound.find((entry) => entry.listener === 'device')?.port).toBe(devicePort);
    for (const preset of [LaneCameraStubPreset.AUTH_SCHEME, LaneCameraStubPreset.NO_PROFILE, LaneCameraStubPreset.NOT_H264, LaneCameraStubPreset.EMPTY]) {
      await stub.apply(preset);
      expect(stub.preset()).toBe(preset);
      expect(boundOf(stub)).toEqual(['device', 'discovery', 'rtsp']);
    }

    // The mode file: one word, read at most LANE_CAMERA_STUB_MODE_POLL_MS later.
    const waitFor = async (wanted: string): Promise<string> => {
      for (let turn = 0; turn < 40 && stub.preset() !== wanted; turn += 1) await delay(LANE_CAMERA_STUB_MODE_POLL_MS / 2);
      return stub.preset();
    };
    writeFileSync(files.modeFile, 'unreachable\n');
    expect(await waitFor('UNREACHABLE')).toBe('UNREACHABLE');
    expect(boundOf(stub)).toEqual(['discovery', 'rtsp']);
    writeFileSync(files.modeFile, 'OPEN_EVERYTHING\n');
    for (let turn = 0; turn < 40 && !log.text().includes('LANE_CAMERA_STUB_MODE_UNKNOWN'); turn += 1) await delay(LANE_CAMERA_STUB_MODE_POLL_MS / 2);
    expect(log.text()).toContain('LANE_CAMERA_STUB_MODE_UNKNOWN');
    expect(stub.preset()).toBe('UNREACHABLE');
    writeFileSync(files.modeFile, 'NORMAL\n');
    expect(await waitFor('NORMAL')).toBe('NORMAL');
    expect(boundOf(stub)).toEqual(['device', 'discovery', 'rtsp']);

    await stub.stop();
    expect(boundOf(stub)).toEqual([]);
    // After the stop a word in the file switches nothing.
    await stub.apply(LaneCameraStubPreset.EMPTY);
    expect(stub.preset()).toBe('NORMAL');
  });
});
