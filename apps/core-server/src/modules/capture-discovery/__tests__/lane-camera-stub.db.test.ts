// A BOOTED DEVELOPMENT CORE WITH THE LANE'S CAMERA STUB (fix wave H, driver D; gate 70 finding B-1;
// decision D196; test strategy CR-5; contract C3 §2.6 operations 93 to 96).
//
// What `scripts/lane/lane.sh start 2 --with-camera-stub` starts, without the process: the real app
// factory on PostgreSQL as `dems_app`, booted in capture operation REAL_DEVELOPMENT (row 61's boot
// fixture: a stand-in worker script, a test signing key, `/bin/echo` as the helper program - no
// camera and no microphone is listed, opened or asked for), with `prepareLaneCameraStub` and
// `announce` called exactly as the launcher calls them (`test/support/lane-camera-stub-cli.ts`).
//
//   93 / 94   a search lists the stub's ONE candidate, on 127.0.0.1, as FAKE / DEVELOPMENT
//   95        the outcomes a gate must be able to drive, each by a preset or by the account typed:
//             a wrong account          AUTHENTICATION_FAILED (the camera refused it)
//             preset AUTH_SCHEME       AUTHENTICATION_FAILED, reason SCHEME_NOT_ALLOWED
//             preset UNREACHABLE       UNREACHABLE
//             the fixture account      REACHABLE
//   96        "Add as camera" registers the camera with its credential
//   EMPTY     a search no device answers is an empty COMPLETE search
//
// NO SOCKET OUTSIDE LOOPBACK: the loopback guard of the camera tests is on for the whole file. It
// refuses - and records - any datagram and any connection whose destination is not 127.0.0.1.
// Every datagram and every connection of this file went to 127.0.0.1, and none was refused.
import type { LightMyRequestResponse } from 'fastify';
import type { CaptureDiscoveryStateBody } from '@dems/shared/api';
import { createManualClock } from '@dems/shared/sim';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { captureLog, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import { FIXED_NOW, manualTimer } from '../../../../test/support/engine';
import { WEB_ORIGIN, signInOnWeb, type IdentityApp } from '../../../../test/support/identity';
import { LaneCameraStubPreset, prepareLaneCameraStub, type LaneCameraStub } from '../../../../test/support/lane-camera-stub';
import { buildApp } from '../../../app';
import { installLoopbackGuard, type LoopbackGuard } from '../../../capture/adapters/camera/__tests__/support';
import { realBootFixture } from '../../../capture/boot/__tests__/support';
import { captureFenceControl } from '../../../capture/fence';
import { engineControl } from '../../../engine';
import { captureDiscoveryControl } from '../index';

const db = useTestDatabase({ template: 'seed' });
const fixture = realBootFixture('wavehd_stub');
fixture.provisionKey();
// Task 4 row 228b: the fixture is a temporary directory and goes with the file, passed or failed.
afterAll(() => fixture.remove());
vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

const DISCOVERY = '/api/v1/capture/discovery';
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

let app: ReturnType<typeof buildApp>;
let log: CapturedLog;
let stub: LaneCameraStub;
let guard: LoopbackGuard;
let clock: ReturnType<typeof createManualClock>;
let cookie: Record<string, string>;

const get = (url: string): Promise<LightMyRequestResponse> => app.inject({ method: 'GET', url, headers: cookie });
const post = (url: string, payload?: Record<string, unknown>): Promise<LightMyRequestResponse> => app.inject({ method: 'POST', url, headers: { ...cookie, origin: WEB_ORIGIN }, ...(payload === undefined ? {} : { payload }) });
const read = async (): Promise<CaptureDiscoveryStateBody> => (await get(DISCOVERY)).json<CaptureDiscoveryStateBody>();
/** One whole search: the start, the real 3 s window, the audit row. */
async function search(): Promise<CaptureDiscoveryStateBody> {
  // Far enough from the search before for no bound of the search to hold.
  clock.advance(130_000);
  const started = await post(DISCOVERY);
  expect(started.statusCode, started.body).toBe(202);
  await delay(3_400);
  for (let turn = 0; turn < 20; turn += 1) {
    await delay(10);
    await app.pipeline.drain();
  }
  return read();
}
/** One connection test, clear of the spacing between two tests. */
async function test(credential: { username: string; secret: string }, candidateId: string): Promise<Record<string, unknown>> {
  clock.advance(30_000);
  const response = await post(`${DISCOVERY}/candidates/${candidateId}/test`, { credential });
  expect(response.statusCode, response.body).toBe(200);
  return response.json<Record<string, unknown>>();
}

beforeAll(async () => {
  guard = installLoopbackGuard();
  const target = await db.another({ template: 'seed', slug: 'wavehd_stub' });
  // No speech runtime on a test host (a real-capture boot resolves the stored selection first).
  await target.ownerPool().query('UPDATE public.stt_config SET enabled = false');
  log = captureLog();
  app = buildApp({
    config: unitTestConfig({ database: target.runtime, dataDir: fixture.dataDir, mediaStoreDir: fixture.mediaStoreDir, logLevel: 'info', captureMode: 'real', demoControls: false, captureDevSources: true, captureHelperFfmpegPath: '/bin/echo', captureWorkerPath: fixture.worker('worker-wavehd-stub', 'capture-worker/0.4.0') }),
    logStream: log.stream,
  });
  target.onCleanup(() => app.close());
  // THE LAUNCHER'S ORDER: the fence and the stub first, then ready, then the factory, then the boot.
  stub = await prepareLaneCameraStub(app);
  await app.ready();
  stub.announce();
  clock = createManualClock(FIXED_NOW);
  app.seams.replace('clock', clock);
  app.seams.replace('publish', () => {});
  engineControl(app).useTimer(manualTimer().timer);
  await app.readiness.boot();
  await app.pipeline.drain();
  cookie = (await signInOnWeb({ app, cookieName: app.config.sessionCookieName } as unknown as IdentityApp, 'rina.wijaya')).cookie;
});
afterAll(() => {
  guard.restore();
});

describe('B-1: a booted development Core with the camera stub', () => {
  it('runs REAL_DEVELOPMENT, the stub was admitted, and a search is ready before any was sent', async () => {
    expect(captureFenceControl(app).operation).toBe('REAL_DEVELOPMENT');
    expect(stub.admission).toEqual({ admitted: true, operation: 'REAL_DEVELOPMENT' });
    expect(captureDiscoveryControl(app).ready()).toBe(true);
    expect(captureDiscoveryControl(app).searchesStarted()).toBe(0);
    expect(guard.datagrams()).toEqual([]);
    expect(await read()).toEqual({ search: null, candidates: [], truncated: false });
  });

  it('operations 93 / 94 answer the stub\'s candidate; 95 gives the four outcomes a gate drives; 96 adds the camera; an EMPTY stub is an empty search - all on 127.0.0.1', async () => {
    const account = stub.account;
    if (account === null || stub.stub === null) throw new Error('the stub was not admitted');

    // SEARCH (93, 94).
    const state = await search();
    expect(state.search).toMatchObject({ state: 'COMPLETE', responderCount: 1, newCount: 1 });
    expect(state.candidates.map((candidate) => [candidate.status, candidate.testable, candidate.adapter, candidate.sourceClass, candidate.host, candidate.conflict])).toEqual([['NEW', true, 'FAKE', 'DEVELOPMENT', '127.0.0.1', false]]);
    const candidate = state.candidates[0];
    if (candidate === undefined) throw new Error('the search listed no candidate');
    const sent = guard.datagrams().length;
    expect(sent).toBeGreaterThan(0);
    expect(new Set(guard.datagrams())).toEqual(new Set(['127.0.0.1']));
    expect(stub.stub.requestLog().every((entry) => entry.channel === 'discovery')).toBe(true);

    // TEST (95). A wrong account: the camera refuses it, and the answer carries no reason.
    const wrong = await test({ username: account.username, secret: `${account.secret}x` }, candidate.candidateId);
    expect(wrong).toMatchObject({ outcome: 'AUTHENTICATION_FAILED', authenticated: true });
    expect(wrong).not.toHaveProperty('reason');
    // A camera that accepts only a sign-in the Core does not answer: the credential is NOT sent.
    await stub.apply(LaneCameraStubPreset.AUTH_SCHEME);
    expect(await test(account, candidate.candidateId)).toMatchObject({ outcome: 'AUTHENTICATION_FAILED', reason: 'SCHEME_NOT_ALLOWED' });
    expect(stub.stub.violations().filter((violation) => violation.code === 'PASSWORD_IN_CLEAR')).toEqual([]);
    // The service port is closed.
    await stub.apply(LaneCameraStubPreset.UNREACHABLE);
    expect(await test(account, candidate.candidateId)).toMatchObject({ outcome: 'UNREACHABLE' });
    // The fixture account on a camera that answers.
    await stub.apply(LaneCameraStubPreset.NORMAL);
    expect(await test(account, candidate.candidateId)).toMatchObject({ outcome: 'REACHABLE', authenticated: true });
    expect((await read()).candidates[0]).toMatchObject({ adoptable: true, lastTest: { outcome: 'REACHABLE' } });

    // ADD AS CAMERA (96).
    clock.advance(30_000);
    const before = app.engine.slice('captureDevices').devices.map((device) => device.id);
    const adopted = await post(`${DISCOVERY}/candidates/${candidate.candidateId}/adopt`, { credential: account });
    expect(adopted.statusCode, adopted.body).toBe(201);
    const adoption = adopted.json<{ deviceId: string; device: Record<string, unknown>; credentialSet: boolean }>();
    expect(adoption).toMatchObject({ credentialSet: true, device: { kind: 'CAMERA', adapter: 'FAKE', sourceClass: 'DEVELOPMENT', host: expect.stringMatching(/^127\.0\.0\.1(:\d+)?$/) } });
    expect(adoption.deviceId).toMatch(/^CAM-\d\d$/);
    expect(before).not.toContain(adoption.deviceId);
    await app.pipeline.drain();
    expect(app.engine.slice('captureDevices').devices.map((device) => device.id)).toContain(adoption.deviceId);
    expect((await read()).candidates[0]).toMatchObject({ status: 'REGISTERED', deviceId: adoption.deviceId });

    // EMPTY: no device answers. A COMPLETE search with nobody in it, never a failed one.
    await stub.apply(LaneCameraStubPreset.EMPTY);
    const empty = await search();
    expect(empty.search).toMatchObject({ state: 'COMPLETE', responderCount: 0 });
    expect(empty.candidates).toEqual([]);

    // THE LOOPBACK GUARD saw the whole flow: two searches and five connection attempts, all to 127.0.0.1, none refused.
    expect(guard.datagrams().length).toBeGreaterThan(sent);
    expect(new Set(guard.datagrams())).toEqual(new Set(['127.0.0.1']));
    expect(guard.connections().length).toBeGreaterThan(0);
    expect(guard.connections().filter((host) => host !== '127.0.0.1')).toEqual([]);
    expect(guard.refused()).toEqual([]);
    // The fixture account is in no log line of the Core.
    expect(log.text()).not.toContain(account.secret);
    expect(log.text()).not.toContain(account.username);
  });
});
