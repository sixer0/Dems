// The connection test of an ADOPTED camera with its STORED credential, on PostgreSQL with the REAL
// relay (task 4 blueprint row 146; security addendum 04 W-6, AD-03 (5), AD-12 "S13-04 (d)": "the
// fixture refuses the RTSP credential twice: the guard's count for that host rises by 2 and a
// third attempt is not sent"; AD-02 (1) for the stored address). The unit file, on doubles, is
// `src/modules/capture-discovery/__tests__/adopted-test.test.ts`.
//
// WHY THIS FILE IS IN THIS FOLDER. The test function is the capture-discovery module's
// (`adopted-test.ts`); its READER is built through the wiring of the credential holders, which
// only the tests of this folder may import (static rule R-6 of this folder, as for row 46's T-2).
//
// WHAT IS REAL:
//   - the test function `testAdoptedCamera` with the seams the module's plugin gives it;
//   - the stored facts: the `capture_devices` rows of a throw-away clone of the seed, read by the
//     file's own statement as the runtime role;
//   - the credential reader THROUGH ITS WIRING (`wireCaptureCredentialHolders`): the reader bound
//     to the reason `CONNECTION_TEST`, the app's own pipeline (the reveal function, the audit
//     writer, the commit) and the Core credential store in a temporary data directory;
//   - the limits of the connect flow (`createConnectionTestLimits`), on a clock of this file so
//     that the spacing of two tests need not be waited for;
//   - the tester as the module composes it: the ONVIF half, the locator read, the relay start, the
//     production process door and the relay BINARY `apps/capture-worker/build/capture-relay` in
//     probe mode (not rebuilt here), with the seal's own two functions.
//
// THE DOUBLES, all on loopback:
//   - the camera: `apps/capture-worker/test-fixtures/rtsp_test_camera.py` on 8569;
//   - the ONVIF device: the scripted device of `test/support/onvif-odd-device.ts` on 8555;
//   - the replicated state (no open session, two cameras): an object of this file. The registry
//     rows themselves are the clone's;
//   - the destination rule of the working cases: the test-only rule of `test/support` (AD-02 (2):
//     every double lives on loopback, which the product's rule refuses). The refusal case binds
//     the PRODUCT'S rule to hand-written host facts.
//
// The account is the test camera's own synthetic constant, read from its file; the wrong secret is
// a value of this file. Comparisons that could print a value are asserted as booleans.
//
// ROW 146b (the route of operation 108 and the OUTCOME entry). Two things changed in this file:
//   - "exactly one audit entry per test" is now EXACTLY TWO per test the camera answered: the
//     reader's `CAPTURE_CREDENTIAL_REVEALED`, committed before the credential is returned, then
//     `CAPTURE_DEVICE_CONNECTION_TESTED` in one unit of the app's own pipeline (the seam `record`,
//     here the real `app.pipeline.run` with `unit.audit.append`, as the module's plugin gives it);
//   - the last-but-one block runs the test OVER HTTP: `POST /api/v1/capture/devices/{id}/test` on
//     this file's app, BOOTED (simulated capture, a manual clock, no tick), with a web-console
//     session of the seeded technician. There the control is the APP'S OWN (its tester composed by
//     the module's plugin with the relay binary of the worker build as `captureRelayPath`, its
//     limits the connect flow's), and the reader is handed in as the production composition does:
//     `adoptedCameraTestControl(app).provide({ reader, storedAddress })`.
// ROW 146c (decision C75 (1): a reveal never stands without a result). The outcome entry is written for EVERY test
// that reached the reader, and states the count of usable profiles when the tester answered:
//   - nothing stored: [reveal, outcome UNREACHABLE / CREDENTIAL_NOT_READ] - was [reveal];
//   - the reader's own gate refused the stored address: [outcome UNREACHABLE / CREDENTIAL_NOT_READ] (that gate
//     stands before the reveal function: the reader writes no entry of its own);
//   - the camera does not answer at the stream (no camera double is running; the REAL relay is started and reports
//     it): 200 UNREACHABLE, [reveal, outcome UNREACHABLE, count 0, no `unreachableReason`];
//   - the relay program cannot be started (a path that names no file): the same two entries;
//   - a test called from inside a unit of work: the reader refuses AND the outcome unit cannot be opened - the
//     fault of the unrecorded outcome travels on (was `503`), 0 entries.
// Refused before the reader (the address rule, 401 / 403 / 422 / 404, the guard): 0 entries, unchanged.
// The ONVIF double moved from 8557 to 8555: the scripted device of `test/support` binds only the ports of its own
// closed list (8561, 8560, 8559, 8557, 8555), none of which lies in 8565-8574 (decision C33); 8557 is not used by
// this row's brief, 8559 to 8561 are the worker's ingest listeners. The test camera stays on 8565.
// ROW T3 (review 060c T-01, T-03, T-04, T-09; C61 (4), C98). The ports are THIS FILE'S OWN now: camera 8569 (was 8565,
// which three more files named), ONVIF device 8555 (the fixed list of the device no longer holds the worker's three).
// Every case that starts the camera or the relay holds `.locks/heavy-host.lock` while it runs
// (`itUnderHeavyHostLock`). The tester of `bounds()` hands the SOURCE ADDRESS on (it dropped it) and one case proves it
// on the wire; the camera's `end()` throws without its exit line; the last block's control plants what it searches.
//
// ROW PR (wave 12; decision C117; rulings C36, C61 (1)). Two cases in the HTTP block, before the guard's: what a passed
// test STORES for the camera - (a) no stored profile: the list and one stream row, in the unit of the outcome entry
// (`host.settle`: one unit of the app's ENGINE), then (c) the same test again: nothing; (b) a stored statement the
// stream no longer makes: nothing stored, `STREAM_PROFILE_DIFFERS` in counts; and the fixture's hostile description at
// a camera with no stored profile. Their test camera binds 8571 (`PROFILE_CAMERA_PORT`), a port no other test file
// names; the ONVIF device stays this file's 8555. `bounds()` hands the function the same engine unit as the plugin.
//
// RUN: sandbox off, under the database lock (a case takes the heavy-host lock itself; a run started under it is not
// asked again), with a core-file limit of 0 (the door refuses otherwise):
//   (ulimit -c 0; /usr/bin/lockf -k -t 1800 ../../.locks/db-migrate.lock \
//     npx vitest run --project db --maxWorkers=2 src/modules/capture-config/__tests__/adopted-camera-test.db.test.ts)
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { inspect } from 'node:util';
import { CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS } from '@dems/shared/api';
import { OPERATORS, createManualClock, type AuditRow } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { captureLog, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import { readTrail, recordingErrorLog, type RecordingErrorLog } from '../../../../test/support/core';
import { FIXED_NOW, manualTimer } from '../../../../test/support/engine';
import { itUnderHeavyHostLock } from '../../../../test/support/heavy-host-lock';
import { WEB_ORIGIN, signInOnWeb, type IdentityApp } from '../../../../test/support/identity';
import { createOddOnvifDevice, dateAnswer, notAuthorizedFault, profilesAnswer, servicesAnswer, streamAnswer, tokenHolds, type OddDeviceReply, type OddDeviceRequest, type OddOnvifDevice } from '../../../../test/support/onvif-odd-device';
import { loopbackStoredCameraAddress } from '../../../../test/support/stored-camera-address';
import { buildApp } from '../../../app';
import { avcDeclaredFrameRate, createSystemTimers } from '../../../capture';
import { createOnvifConnectionTester, createOnvifStreamLocator, createStreamConnectionTester, startProductionProcess, type ProductionDoor, type StoredCameraAddressRule, type StreamConnectionTester, type StreamTestNote } from '../../../capture/adapters';
import { DestinationPurpose, decideDestination, type DestinationContext } from '../../../capture/destination-rule';
import { createCredentialStore, type CoreCredentialStore } from '../../../credential-store';
import { engineControl, storeCaptureDeviceProfilesIn } from '../../../engine';
import type { Principal } from '../../../plugins/authenticate';
import { ApiFailure } from '../../../plugins/error-envelope';
import { streamProfileOf } from '../../../sealing-host';
import { adoptedCameraTestControl, testAdoptedCamera, type AdoptedCameraTestCaller, type AdoptedCameraTestSeams, type StoredCredentialReader } from '../../capture-discovery/adopted-test';
import { INSERT_CAPTURE_CREDENTIAL, createConnectionTestLimits, type ConnectionTestLimits } from '../../capture-discovery/connect';
import { wireCaptureCredentialHolders } from '../credential-holders';
import { readCameraProfiles } from '../store';

const REPOSITORY = resolve(__dirname, '../../../../../..');
const WORKER_APP = join(REPOSITORY, 'apps/capture-worker');
const RELAY = join(WORKER_APP, 'build/capture-relay');
const CAMERA_SCRIPT = join(WORKER_APP, 'test-fixtures/rtsp_test_camera.py');
const OUT = join(REPOSITORY, '.cache/task4-row146');

const HOST = '127.0.0.1';
// Row T3: this file's own ports (see the header). No other test file of the Core names 8555 or 8569.
const ONVIF_PORT = 8555;
const CAMERA_PORT = 8569;
/** Row PR (wave 12; decision C117): the test camera of the three cases of that row - a port of 8571-8574 no other test file binds. */
const PROFILE_CAMERA_PORT = 8571;
const SCHEME = ['rt', 'sp'].join('');
const TOKEN = 'profile_1';
const REVEALED = 'CAPTURE_CREDENTIAL_REVEALED';
/** Row 146b: the OUTCOME entry of a test the camera answered. */
const TESTED = 'CAPTURE_DEVICE_CONNECTION_TESTED';
/** Row 146c: an entry of a test the tester answered states the count of usable profiles. */
const TESTED_KEYS = ['adapter', 'deviceId', 'operationId', 'outcome', 'permission', 'sourceClass', 'usableProfileCount'];
/** Row V7 (request of row PR): the four keys an entry gains when the test stored the profiles or found them differing. */
const STORED_STATEMENT_KEYS = ['differingProfileCount', 'profiles', 'statedProfileCount', 'storedProfileCount'];
/** Row 146c: an entry of a test in which no camera was asked states why, and no count. */
const NOT_ASKED_KEYS = ['adapter', 'deviceId', 'operationId', 'outcome', 'permission', 'sourceClass', 'unreachableReason'];
const TEST_URL = (deviceId: string): string => `/api/v1/capture/devices/${deviceId}/test`;

const cameraSource = readFileSync(CAMERA_SCRIPT, 'utf8');
const constantOf = (name: string): string => new RegExp(`^${name} = "([^"]+)"$`, 'm').exec(cameraSource)?.[1] ?? '';
const ACCOUNT = { username: constantOf('ACCOUNT_USER'), secret: constantOf('ACCOUNT_PASSWORD') } as const;
const WRONG = { username: ACCOUNT.username, secret: ['row146', 'not', 'the', 'synthetic', 'value'].join('-') } as const;

/** The host facts the PRODUCT'S rule is bound to in the refusal case (as in the reader's own database test). */
const HOST_FACTS: DestinationContext = {
  cameraSubnet: { network: '192.168.50.0', prefixLength: 24 },
  cameraAddresses: [{ address: '192.168.50.1', alias: false }],
  otherInterfaceSubnets: [{ network: '10.20.0.0', prefixLength: 24 }],
  // R-FLEX NW-C1 (row 136): the eligible interfaces the global STORED_CAMERA rule reads; without them it is NOT_CONFIGURED (RF-N7, RM-N4).
  interfaceSubnets: [
    { name: 'eth1', address: '192.168.50.1', network: '192.168.50.0', prefixLength: 24 },
    { name: 'eth0', address: '10.20.0.5', network: '10.20.0.0', prefixLength: 24 },
  ],
  hostAddresses: ['10.20.0.5'],
};
const PRODUCT_RULE: StoredCameraAddressRule = (host, port) => decideDestination({ purpose: DestinationPurpose.STORED_CAMERA, address: host, ...(port === undefined ? {} : { port }) }, HOST_FACTS);

const TECHNICIAN = OPERATORS[2]!;
const operator = (sessionId: string): AdoptedCameraTestCaller => ({ principal: { kind: 'OPERATOR', operatorId: TECHNICIAN.id, sessionId, deviceId: null, role: TECHNICIAN.role } as Extract<Principal, { kind: 'OPERATOR' }> });

const db = useTestDatabase({ template: 'seed', slug: 'row146' });
const dataDir = mkdtempSync(join(tmpdir(), 'dems-row146-db-'));

// ── What must be nowhere ─────────────────────────────────────────────────────────────────────
const needles = new Set<string>([ACCOUNT.username, ACCOUNT.secret, WRONG.secret]);
const everything = (value: unknown): string => [String(value), JSON.stringify(value) ?? '', inspect(value, { depth: 8, showHidden: true, getters: true }), value instanceof Error ? `${value.message}\n${value.stack ?? ''}` : ''].join('\n');
const occurrencesIn = (text: string): number => [...needles].filter((needle) => needle !== '' && text.includes(needle)).length;
/** Every answer and every error of this file, for the last search. */
const kept: unknown[] = [];
const outcomeOf = async (pending: Promise<unknown>): Promise<unknown> => {
  const outcome = await pending.then((value) => value, (error: unknown) => error);
  kept.push(outcome);
  return outcome;
};
const failureOf = (value: unknown): { statusCode: number; code: string; reason: unknown } | null => (value instanceof ApiFailure ? { statusCode: value.statusCode, code: value.code, reason: (value.details as { reason?: unknown } | undefined)?.reason } : null);
/** A fact of a run - outcomes, codes, counts, never a value of the account or an address: to the run's own file. */
const say = (line: string): void => {
  mkdirSync(OUT, { recursive: true });
  appendFileSync(join(OUT, 'facts.log'), `${new Date().toISOString()} ${line}\n`);
};

// ── Processes of this file ───────────────────────────────────────────────────────────────────
const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));
const exists = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const started: ChildProcessWithoutNullStreams[] = [];

/** A child that speaks one JSON object per line: the next line that holds `event`. */
function lineReader(child: ChildProcessWithoutNullStreams): (event: string, withinMs: number) => Promise<Record<string, unknown>> {
  const lines: Record<string, unknown>[] = [];
  let pending = '';
  let wake: () => void = () => {};
  child.stdout.on('data', (chunk: Buffer) => {
    pending += chunk.toString('utf8');
    for (;;) {
      const end = pending.indexOf('\n');
      if (end === -1) break;
      const text = pending.slice(0, end);
      pending = pending.slice(end + 1);
      try {
        lines.push(JSON.parse(text) as Record<string, unknown>);
      } catch {
        // Not a line of the dialogue.
      }
    }
    wake();
  });
  child.on('close', () => wake());
  return async (event, withinMs) => {
    const until = Date.now() + withinMs;
    for (;;) {
      const at = lines.findIndex((line) => line.event === event);
      if (at !== -1) return lines.splice(at, 1)[0] as Record<string, unknown>;
      if (Date.now() >= until || child.exitCode !== null) throw new Error(`no "${event}" line from the double`);
      await Promise.race([new Promise<void>((done) => (wake = done)), sleep(200)]);
    }
  };
}

interface TestCamera {
  readonly path: string;
  /** Ends the camera and answers the counters of its `exit` line and its requests by authentication class. */
  end(): Promise<{ readonly counters: Readonly<Record<string, number>>; readonly requests: readonly string[] }>;
}
async function startCamera(name: string, extra: readonly string[] = [], port: number = CAMERA_PORT): Promise<TestCamera> {
  mkdirSync(OUT, { recursive: true });
  const log = join(OUT, `${name}.jsonl`);
  rmSync(log, { force: true });
  const child = spawn('python3', ['-B', CAMERA_SCRIPT, '--port', String(port), '--frames', '0', '--event-log', log, '--exit-on-stdin-eof', '--max-seconds', '120', ...extra], { stdio: ['pipe', 'pipe', 'pipe'] });
  started.push(child);
  child.stderr.resume();
  const ready = await lineReader(child)('ready', 90_000);
  const path = String(ready.path);
  return {
    path,
    async end() {
      const closed = new Promise<void>((done) => child.once('close', () => done()));
      child.stdin.end();
      await Promise.race([closed, sleep(10_000)]);
      if (child.exitCode === null) child.kill('SIGKILL');
      const events = existsSync(log) ? readFileSync(log, 'utf8').split('\n').filter((line) => line !== '').map((line) => JSON.parse(line) as Record<string, unknown>) : [];
      const exit = events.findLast((event) => event.event === 'exit');
      // Row T3 (review 060c T-04): a counter that is absent reads as 0 below ("no Basic request at the camera"). That is
      // only true of a camera that WROTE its counters: without its `exit` line nothing was counted.
      if (exit === undefined || typeof exit.counters !== 'object' || exit.counters === null) throw new Error(`the test camera "${name}" left no exit line with its counters: nothing it did not do is proven`);
      return { counters: exit.counters as Record<string, number>, requests: events.filter((event) => event.event === 'request').map((event) => `${String(event.method)}:${String(event.auth)}`) };
    },
  };
}

// ── The Core side ────────────────────────────────────────────────────────────────────────────
let core: { readonly app: ReturnType<typeof buildApp>; readonly log: CapturedLog };
/** Row 146b: the clock of the booted app (its limits and its sessions read it) and two web-console sessions. */
let clock: ReturnType<typeof createManualClock>;
let technician: Record<string, string>;
let investigator: Record<string, string>;
let owner: Pool;
let store: CoreCredentialStore;
let errorLog: RecordingErrorLog;
let onvif: OddOnvifDevice;
let tester: StreamConnectionTester;
let reader: StoredCredentialReader;
/** What the ONVIF double answers for the stream address, and for which account. */
const device = { locator: '', account: ACCOUNT as { readonly username: string; readonly secret: string } };
const relayPids: number[] = [];
const relayExits: (number | string)[] = [];
/** What every relay of this file was started with beside its message: the argument list and the environment. */
const relayStarts: { readonly args: readonly string[]; readonly env: Readonly<Record<string, string>> }[] = [];
const streamNotes: StreamTestNote[] = [];
const notes: Record<string, unknown>[] = [];
const persisted: Record<string, unknown>[] = [];
/** How often the tester of this file was called: one per test that reached the camera. */
let testerCalls = 0;
/** Row T3 (review 060c T-09): the source address each of those calls was handed by `testAdoptedCamera` - the FOURTH argument. */
const testerSources: (string | undefined)[] = [];

const reveals = async (): Promise<AuditRow[]> => (await readTrail(owner)).filter((row) => row.type === REVEALED);
const tokenRequests = (): number => onvif.requests().filter((request) => request.token || request.authorization !== '').length;
const setLocator = (path: string, port: number = CAMERA_PORT): void => {
  device.locator = `${SCHEME}://${HOST}:${port}${path}`;
  needles.add(device.locator);
  needles.add(path);
};
const noRelayLeft = (): boolean => relayPids.every((pid) => !exists(pid));

/** One world of bounds: fresh limits on a clock of the case, the real reader, tester and stored facts. */
function bounds(storedAddress: StoredCameraAddressRule = loopbackStoredCameraAddress, using: { readonly tester?: StreamConnectionTester; readonly reader?: StoredCredentialReader } = {}): { readonly seams: AdoptedCameraTestSeams; readonly limits: ConnectionTestLimits; next(): void } {
  let now = 1_800_000_000_000;
  const limits = createConnectionTestLimits({ now: () => now });
  const timers = createSystemTimers();
  const seams: AdoptedCameraTestSeams = {
    host: {
      now: () => now,
      state: () => ({ session: null, captureDevices: { devices: [{ id: 'CAM-01', kind: 'CAMERA' }, { id: 'CAM-02', kind: 'CAMERA' }] } as never }),
      query: (text, values) => core.app.db.read('row146.adoptedCamera', (pool) => pool.query(text, values)),
      after: (delayMs, callback) => timers.after(delayMs, callback),
      note: (fields) => void notes.push({ ...fields }),
      persist: (entry) => void persisted.push({ ...entry }),
      // Row 146b: the outcome entry in ONE unit of the app's own pipeline - what the module's plugin hands the function.
      record: (entry) => core.app.pipeline.run('row146b.adoptedTested', async (unit) => void (await unit.audit.append(entry))),
      // Row PR (C117): the unit of a test that judged a stream - ONE unit of the app's engine, as the module's plugin hands it.
      // Row V7: with the engine's door for the camera's stored profile list bound to that unit, as the plugin binds it.
      settle: async (work) =>
        void (await core.app.engine.run('rowPR.adoptedSettled', async (scope) => {
          const entry = await work({ unit: scope.unit, pending: () => scope.pending(), storeProfiles: (change) => storeCaptureDeviceProfilesIn(scope, change) });
          await scope.unit.audit.append(entry);
        })),
    },
    limits,
    // Row T3 (review 060c T-09): the wrapper took three arguments and dropped the FOURTH - the source address the
    // judgement of the stored address named - so the function-level cases never carried it to the real tester and
    // passed with `testAdoptedCamera` handing none. It is handed on as the module's own tester receives it, and kept.
    tester: () => ({
      test: (camera, credential, signal, sourceAddress) => {
        testerCalls += 1;
        testerSources.push(sourceAddress);
        return (using.tester ?? tester).test(camera, credential, signal, sourceAddress);
      },
    }),
    parts: () => ({ reader: using.reader ?? reader, storedAddress }),
  };
  return {
    seams,
    limits,
    next: () => {
      now += CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS;
    },
  };
}

async function storeCredential(deviceId: string, account: { readonly username: string; readonly secret: string }): Promise<void> {
  const sealed = await store.capture.seal(deviceId, account.secret);
  await core.app.db.pool.query(INSERT_CAPTURE_CREDENTIAL, [deviceId, account.username, Buffer.from(sealed.ciphertext), Buffer.from(sealed.nonce), sealed.keyRef, 1_730_000_000_000]);
}

beforeAll(async () => {
  expect(existsSync(RELAY), 'the relay binary of the worker build').toBe(true);
  expect(ACCOUNT.username.length > 0 && ACCOUNT.secret.length > 0).toBe(true);
  owner = db.ownerPool();
  const log = captureLog();
  // Row 146b: the relay of the worker build is this app's relay program, so the tester the MODULE composes (the one the
  // route reaches) probes the stream as the function-level cases' tester does.
  const app = buildApp({ config: unitTestConfig({ database: db.runtime, dataDir, logLevel: 'trace', captureRelayPath: RELAY }), logStream: log.stream });
  db.onCleanup(() => app.close());
  await app.ready();
  core = { app, log };
  // Row 146b: BOOTED, for the route cases - simulated capture, a manual clock (the spacing of two tests over HTTP is
  // not waited for) and a timer that never fires (no tick writes into a count of this file).
  clock = createManualClock(FIXED_NOW);
  app.seams.replace('clock', clock);
  app.seams.replace('publish', () => {});
  engineControl(app).useTimer(manualTimer().timer);
  await app.readiness.boot();
  await engineControl(app).idle();
  await app.pipeline.drain();
  const identity = { app, cookieName: app.config.sessionCookieName } as unknown as IdentityApp;
  technician = (await signInOnWeb(identity, 'rina.wijaya')).cookie;
  investigator = (await signInOnWeb(identity, 'budi.santoso')).cookie;
  await app.pipeline.drain();
  store = createCredentialStore({ root: join(dataDir, 'credential-store') });
  errorLog = recordingErrorLog();
  // The reader as the production composition will wire it: the real pipeline, store and pool. Its own gate gets the
  // test rule too (the doubles live on loopback); the refusal case of this file shows the test's OWN judgement first.
  reader = wireCaptureCredentialHolders({
    unit: (label, work) => app.pipeline.run(label, work),
    open: (deviceId, sealed) => store.capture.open(deviceId, sealed),
    errorLog,
    query: (text, values) => app.db.read('row146.credentialDevice', (pool) => pool.query(text, values)),
    storedAddress: loopbackStoredCameraAddress,
  }).connectionTest;

  // Two adopted production cameras at the loopback address of the ONVIF double: one with the camera's account, one with a wrong secret.
  await owner.query("UPDATE public.capture_devices SET adapter_kind = 'ONVIF_RTSP', address = $1 WHERE id IN ('CAM-01', 'CAM-02')", [`${HOST}:${ONVIF_PORT}`]);
  await storeCredential('CAM-01', ACCOUNT);
  await storeCredential('CAM-02', WRONG);

  onvif = createOddOnvifDevice(ONVIF_PORT, (request: OddDeviceRequest): OddDeviceReply => {
    if (request.operation === 'GetSystemDateAndTime') return dateAnswer();
    if (request.operation === 'GetServices') return servicesAnswer(`http://${HOST}:${ONVIF_PORT}`);
    if (!tokenHolds(request, device.account)) return notAuthorizedFault(400);
    if (request.operation === 'GetProfiles') return profilesAnswer([{ token: TOKEN, encoding: 'H264' }]);
    return streamAnswer(device.locator);
  });
  await onvif.start();
  db.onCleanup(() => onvif.stop());

  const timers = createSystemTimers();
  // The real door, watched: which processes it started, and with which argument list and environment.
  const door: ProductionDoor = (options) => {
    relayStarts.push({ args: [...options.args], env: { ...options.env } });
    const child = startProductionProcess(options);
    if (child.pid !== null) relayPids.push(child.pid);
    void child.ended.then((exit) => relayExits.push(exit.exitCode ?? exit.signal ?? 'none'));
    return child;
  };
  // The composition of `modules/capture-discovery/index.ts`, with this file's watched door and the relay of the worker build.
  tester = createStreamConnectionTester({
    onvif: createOnvifConnectionTester({ timers }),
    locator: createOnvifStreamLocator({ timers }),
    door,
    relayProgram: RELAY,
    timers,
    statement: { profileOf: streamProfileOf, declaredRate: avcDeclaredFrameRate },
    tell: (note) => streamNotes.push(note),
  });
}, 120_000);

afterAll(async () => {
  for (const child of started) if (child.exitCode === null) child.kill('SIGKILL');
  for (const pid of relayPids) if (exists(pid)) process.kill(pid, 'SIGKILL');
  rmSync(dataDir, { recursive: true, force: true });
});

describe('row 146: a passed test - the stored address, the reader with its bound reason, both halves, exactly TWO audit entries (row 146b)', () => {
  itUnderHeavyHostLock('REACHABLE through the real relay; the entry `CAPTURE_CREDENTIAL_REVEALED` with the reason CONNECTION_TEST and the operator as its actor, no session, THEN the outcome entry `CAPTURE_DEVICE_CONNECTION_TESTED`; the relay got no argument and an empty environment', async () => {
    const camera = await startCamera('passed', ['--codec', 'hevc']);
    setLocator(camera.path);
    device.account = ACCOUNT;
    const { seams, limits } = bounds();
    const before = { trail: (await readTrail(owner)).length, relays: relayPids.length, tester: testerCalls, errors: errorLog.entries.length };
    const result = await outcomeOf(testAdoptedCamera(seams, operator('SESSION-146-A'), 'CAM-01'));
    const facts = await camera.end();
    say(`[row146] passed: ${JSON.stringify(result)}; relay exits ${JSON.stringify(relayExits.slice(-1))}; camera ${JSON.stringify(facts.counters)}`);
    // Row V7 (request of row PR): the seeded CAM-01 holds no stored profile, so this first test STORES what the stream states
    // (row PR) and the answer says so in the contract's closed word; the entry's details carry the word and its three counts.
    expect(result).toMatchObject({ deviceId: 'CAM-01', outcome: 'REACHABLE', authenticated: true, usableProfileCount: 1, failedAttemptsRemaining: 2, profiles: 'PROFILES_STORED' });
    expect(Object.keys(result as object).sort()).toEqual(['authenticated', 'deviceId', 'failedAttemptsRemaining', 'outcome', 'profiles', 'testedAt', 'usableProfileCount']);
    // Row 146b: EXACTLY TWO audit entries for the test, in this order. First the reveal: the device, the bound reason, the operator, no session.
    const trail = await readTrail(owner);
    const added = trail.slice(before.trail);
    expect(added).toHaveLength(2);
    expect(added[0]).toMatchObject({ type: REVEALED, actorId: TECHNICIAN.id, deviceId: 'CAM-01', details: { deviceId: 'CAM-01', reason: 'CONNECTION_TEST' } });
    expect(Object.keys(added[0]?.details ?? {}).sort()).toEqual(['deviceId', 'reason']);
    expect(added[0]?.sessionId ?? null).toBeNull();
    // Then the outcome: the registry id, the outcome code, the adapter kind and its class, the operation, the permission - and no other key.
    expect(added[1]).toMatchObject({ type: TESTED, actorId: TECHNICIAN.id, details: { deviceId: 'CAM-01', outcome: 'REACHABLE', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION', operationId: 'testCaptureDeviceConnection', usableProfileCount: 1, permission: 'CAPTURE_CONFIG' } });
    expect(Object.keys(added[1]?.details ?? {}).sort()).toEqual([...TESTED_KEYS, ...STORED_STATEMENT_KEYS].sort());
    expect(added[1]?.sessionId ?? null).toBeNull();
    // The reveal was committed in a unit of its own BEFORE the camera was asked; the outcome in a later one.
    expect((added[0]?.seq ?? 0) < (added[1]?.seq ?? 0)).toBe(true);
    expect(errorLog.entries.length).toBe(before.errors);
    // One relay, in probe mode, ended by itself; Digest only at the camera.
    expect(relayPids.length - before.relays).toBe(1);
    expect(relayExits.at(-1)).toBe(0);
    expect(testerCalls - before.tester).toBe(1);
    // Row T3 (T-09): the tester was handed the source address the judgement of the stored address named.
    expect(testerSources.at(-1)).toBe(HOST);
    expect(facts.counters['auth_basic'] ?? 0).toBe(0);
    expect(limits.busy()).toBe(false);
    expect(noRelayLeft()).toBe(true);
  }, 150_000);

  // Row T3 (review 060c T-09; survivor 14 of its section 6). ON THE WIRE: the stored-address rule of this case admits
  // the camera and names, as the address to connect FROM, one this host does not hold (192.0.2.1, a documentation
  // address). The real tester, handed it, can open no connection: 0 requests at the ONVIF device, no relay. A
  // `testAdoptedCamera` that does not hand the source on connects from wherever the system chooses - the ONVIF device
  // answers and a relay is started. No camera double and no relay are started by this case as the product stands.
  it('row T3: the source address the stored-address rule names is the one the connection is made FROM - an address this host does not hold reaches NOTHING: UNREACHABLE, 0 requests at the ONVIF device, 0 relays; the same camera from 127.0.0.1 is asked', async () => {
    setLocator('/row-t3-source');
    device.account = ACCOUNT;
    const fromElsewhere: StoredCameraAddressRule = (host) => (host === HOST ? { allowed: true, destination: { address: host, sourceAddress: '192.0.2.1' } } : { allowed: false, refusal: 'TEST_RULE_LOOPBACK_ONLY' });
    const { seams, limits } = bounds(fromElsewhere);
    const before = { trail: (await readTrail(owner)).length, relays: relayPids.length, tester: testerCalls, onvif: onvif.requests().length };
    const result = await outcomeOf(testAdoptedCamera(seams, operator('SESSION-146-T3'), 'CAM-01'));
    expect(testerCalls - before.tester).toBe(1);
    // ON THE WIRE first: nothing reached the ONVIF device and no relay was started.
    expect({ onvif: onvif.requests().length - before.onvif, relays: relayPids.length - before.relays }).toEqual({ onvif: 0, relays: 0 });
    expect(testerSources.at(-1)).toBe('192.0.2.1');
    expect(result).toMatchObject({ deviceId: 'CAM-01', outcome: 'UNREACHABLE', usableProfileCount: 0 });
    // The reader was asked and the outcome was written: the test did run, and ended where the connection could not be made.
    expect((await readTrail(owner)).slice(before.trail).map((row) => row.type)).toEqual([REVEALED, TESTED]);
    expect(limits.busy()).toBe(false);
    say(`[rowT3] source address not held: ${JSON.stringify(result)}; ONVIF requests +${onvif.requests().length - before.onvif}; relays +${relayPids.length - before.relays}`);
  }, 60_000);
});

describe('row 146: THE CELL - the camera refuses the stored RTSP credential twice (AD-12, S13-04 (d); AD-03 (5))', () => {
  itUnderHeavyHostLock('the guard\'s count for that host rises by 2; a third attempt is not sent; a fourth is not sent - no reveal, no ONVIF request, no relay, no RTSP request for either', async () => {
    const camera = await startCamera('refused-twice', ['--codec', 'hevc']);
    setLocator(camera.path);
    // The ONVIF device takes the stored (wrong) account of CAM-02; the camera's stream does not: the refusal is the RTSP one.
    device.account = WRONG;
    const { seams, limits, next } = bounds();
    const caller = operator('SESSION-146-B');
    const before = { reveals: (await reveals()).length, trail: (await readTrail(owner)).length, relays: relayPids.length, tester: testerCalls };
    expect(limits.remaining(HOST)).toBe(2);

    const first = await outcomeOf(testAdoptedCamera(seams, caller, 'CAM-02'));
    expect(first).toMatchObject({ deviceId: 'CAM-02', outcome: 'AUTHENTICATION_FAILED', authenticated: true, usableProfileCount: 0, failedAttemptsRemaining: 1 });
    expect(relayExits.at(-1)).toBe(23);
    expect(limits.remaining(HOST)).toBe(1);
    next();
    const second = await outcomeOf(testAdoptedCamera(seams, caller, 'CAM-02'));
    expect(second).toMatchObject({ outcome: 'AUTHENTICATION_FAILED', failedAttemptsRemaining: 0 });
    expect(relayExits.at(-1)).toBe(23);
    expect(limits.remaining(HOST)).toBe(0);
    const afterTwo = { reveals: (await reveals()).length, trail: (await readTrail(owner)).length, relays: relayPids.length, tester: testerCalls, tokens: tokenRequests(), onvif: onvif.requests().length };
    expect(afterTwo.reveals - before.reveals).toBe(2);
    // Row 146b: two entries per test that was sent - its reveal and its outcome.
    expect(afterTwo.trail - before.trail).toBe(4);
    expect(afterTwo.relays - before.relays).toBe(2);
    expect(afterTwo.tester - before.tester).toBe(2);

    // The third and the fourth attempt, by the same operator and by another session; and the right camera of the SAME host.
    next();
    const third = await outcomeOf(testAdoptedCamera(seams, caller, 'CAM-02'));
    next();
    const fourth = await outcomeOf(testAdoptedCamera(seams, operator('SESSION-146-C'), 'CAM-02'));
    next();
    const sameHost = await outcomeOf(testAdoptedCamera(seams, caller, 'CAM-01'));
    for (const refused of [third, fourth, sameHost]) expect(failureOf(refused)).toMatchObject({ statusCode: 429, code: 'RATE_LIMITED', reason: 'CONNECTION_TEST_LOCKOUT_GUARD' });
    const facts = await camera.end();
    device.account = ACCOUNT;
    say(`[row146] refused twice: guard 2 -> ${limits.remaining(HOST)}; relay exits ${JSON.stringify(relayExits.slice(-2))}; camera ${JSON.stringify(facts.counters)}; reveals +${afterTwo.reveals - before.reveals}`);
    // Nothing was read, asked or started for them: every count stands where the second attempt left it.
    expect({ reveals: (await reveals()).length, trail: (await readTrail(owner)).length, relays: relayPids.length, tester: testerCalls, tokens: tokenRequests(), onvif: onvif.requests().length }).toEqual(afterTwo);
    // The camera saw exactly the two refused answers, by Digest, and no Basic one.
    expect(facts.counters['auth_digest_refused'] ?? 0).toBe(2);
    expect(facts.counters['auth_basic'] ?? 0).toBe(0);
    expect(facts.counters['auth_digest_ok'] ?? 0).toBe(0);
    // Row 146b: the FOUR entries are the reveal and the outcome of each of the two tests that were sent, each with the
    // operator; the outcome of the refusal that closed the host carries `guardTripped`, the first carries no mark. The
    // refused third and fourth attempt and the test of the right camera of the closed host wrote none.
    const added = (await readTrail(owner)).slice(before.trail);
    const told = (row: AuditRow): unknown => {
      const details = row.details as { deviceId?: string; reason?: string; outcome?: string; guardTripped?: boolean };
      return row.type === REVEALED ? [row.type, row.actorId, details.deviceId, details.reason] : [row.type, row.actorId, details.deviceId, details.outcome, details.guardTripped ?? null, details.reason ?? null];
    };
    expect(added.map(told)).toEqual([
      [REVEALED, TECHNICIAN.id, 'CAM-02', 'CONNECTION_TEST'],
      [TESTED, TECHNICIAN.id, 'CAM-02', 'AUTHENTICATION_FAILED', null, null],
      [REVEALED, TECHNICIAN.id, 'CAM-02', 'CONNECTION_TEST'],
      [TESTED, TECHNICIAN.id, 'CAM-02', 'AUTHENTICATION_FAILED', true, null],
    ]);
    expect(limits.busy()).toBe(false);
    expect(noRelayLeft()).toBe(true);
  }, 200_000);
});

describe('row 146: refusals on PostgreSQL - before the reveal, and outside any unit of work', () => {
  it('AD-02 (1): a stored address the PRODUCT\'S rule refuses - 409, 0 entries of any type, 0 reader error-log codes, 0 requests, 0 relays; the bounds are not spent', async () => {
    const { seams, limits } = bounds(PRODUCT_RULE);
    const before = { trail: (await readTrail(owner)).length, relays: relayPids.length, tester: testerCalls, onvif: onvif.requests().length, errors: errorLog.entries.length, persisted: persisted.length };
    const refusals: string[] = [];
    // CAM-01 as stored (loopback), then moved by the RUNTIME role - what the security check found it may do.
    for (const address of [null, '169.254.10.20', '8.8.8.8', '192.168.60.20:80', '10.20.0.5']) {
      if (address !== null) await core.app.db.pool.query("UPDATE public.capture_devices SET address = $1 WHERE id = 'CAM-01'", [address]);
      expect(failureOf(await outcomeOf(testAdoptedCamera(seams, operator('SESSION-146-D'), 'CAM-01'))), String(address)).toMatchObject({ statusCode: 409, code: 'INVALID_STATE', reason: 'CANDIDATE_NOT_TESTABLE' });
      refusals.push(String((persisted.at(-1)?.context as { refusal?: string } | undefined)?.refusal));
    }
    await owner.query("UPDATE public.capture_devices SET address = $1 WHERE id = 'CAM-01'", [`${HOST}:${ONVIF_PORT}`]);
    say(`[row146] stored-address refusals: ${refusals.join(', ')}`);
    // R-FLEX (row 136): 192.168.60.20 is off-link: NW-R1 NO_SOURCE_INTERFACE, no longer OUTSIDE_CAMERA_SUBNET (RM-N2).
    expect(refusals).toEqual(['LOOPBACK', 'LINK_LOCAL', 'PUBLIC_ADDRESS', 'NO_SOURCE_INTERFACE', 'HOST_ADDRESS']);
    expect({ trail: (await readTrail(owner)).length, relays: relayPids.length, tester: testerCalls, onvif: onvif.requests().length, errors: errorLog.entries.length }).toEqual({ trail: before.trail, relays: before.relays, tester: before.tester, onvif: before.onvif, errors: before.errors });
    expect(persisted.length - before.persisted).toBe(5);
    expect(limits.busy()).toBe(false);
    expect(limits.refusal(HOST, 'SESSION-146-D')).toBeNull();
  }, 60_000);

  it('the read is OUTSIDE any unit of work: a test called from inside one is refused by the reader - no credential, nothing sent; row 146c: the outcome unit cannot be opened there either, so the UNRECORDED OUTCOME travels on as a fault (not a 503) - 0 entries; the turn is given back', async () => {
    const { seams, limits } = bounds();
    const before = { trail: (await readTrail(owner)).length, relays: relayPids.length, tester: testerCalls, errors: errorLog.entries.length, persisted: persisted.length };
    // What a caller that moved the test inside a unit would do.
    const inside = await core.app.pipeline.run('row146.testInsideAUnit', async () => outcomeOf(testAdoptedCamera(seams, operator('SESSION-146-E'), 'CAM-01')));
    expect(inside).toBeInstanceOf(Error);
    expect(failureOf(inside)).toBeNull();
    expect((await readTrail(owner)).length).toBe(before.trail);
    expect(testerCalls).toBe(before.tester);
    expect(relayPids.length).toBe(before.relays);
    expect(errorLog.entries.slice(before.errors).map((entry) => (entry.context as { causeCode?: string } | undefined)?.causeCode)).toEqual(['PIPELINE_REENTRANT']);
    // Two codes, in this order: the read that failed, then the outcome that could not be recorded.
    expect(persisted.slice(before.persisted)).toMatchObject([
      { code: 'CAPTURE_STORED_TEST_CREDENTIAL_NOT_READ', context: { deviceId: 'CAM-01', cause: 'CAPTURE_CREDENTIAL_REVEAL_FAILED' } },
      { code: 'CAPTURE_STORED_TEST_OUTCOME_NOT_RECORDED', context: { deviceId: 'CAM-01', outcome: 'UNREACHABLE' } },
    ]);
    say(`[row146c] inside a unit: fault ${String((inside as { code?: unknown }).code ?? 'no code')}; entries +0`);
    expect(limits.busy()).toBe(false);
  }, 60_000);

  it('no credential is stored for the camera: 409 CREDENTIAL_REQUIRED and nothing is sent; the reveal CALL is audited once, as the reader audits every call - and (row 146c) the OUTCOME entry follows it: UNREACHABLE, `CREDENTIAL_NOT_READ`, no count. EXACTLY TWO entries', async () => {
    await owner.query("DELETE FROM public.capture_device_credentials WHERE device_id = 'CAM-02'");
    const { seams, limits } = bounds();
    const before = { trail: (await readTrail(owner)).length, tester: testerCalls, relays: relayPids.length, onvif: onvif.requests().length };
    expect(failureOf(await outcomeOf(testAdoptedCamera(seams, operator('SESSION-146-F'), 'CAM-02')))).toMatchObject({ statusCode: 409, code: 'INVALID_STATE', reason: 'CREDENTIAL_REQUIRED' });
    const added = (await readTrail(owner)).slice(before.trail);
    expect(added.map((row) => row.type)).toEqual([REVEALED, TESTED]);
    expect(added[1]).toMatchObject({ actorId: TECHNICIAN.id, details: { deviceId: 'CAM-02', outcome: 'UNREACHABLE', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION', operationId: 'testCaptureDeviceConnection', unreachableReason: 'CREDENTIAL_NOT_READ', permission: 'CAPTURE_CONFIG' } });
    expect(Object.keys(added[1]?.details ?? {}).sort()).toEqual(NOT_ASKED_KEYS);
    expect((added[0]?.seq ?? 0) < (added[1]?.seq ?? 0)).toBe(true);
    expect({ tester: testerCalls, relays: relayPids.length, onvif: onvif.requests().length }).toEqual({ tester: before.tester, relays: before.relays, onvif: before.onvif });
    expect(limits.busy()).toBe(false);
    say('[row146c] nothing stored: 409 CREDENTIAL_REQUIRED; entries [CAPTURE_CREDENTIAL_REVEALED, CAPTURE_DEVICE_CONNECTION_TESTED UNREACHABLE CREDENTIAL_NOT_READ]');
  }, 60_000);

  it('row 146c: REFUSED BY THE DESTINATION RULE AFTER THE READER WAS CALLED - the reader\'s own gate (the PRODUCT\'S rule) refuses the stored loopback address: 409 CANDIDATE_NOT_TESTABLE, nothing sent; EXACTLY ONE entry, the outcome with `CREDENTIAL_NOT_READ` (that gate stands before the reveal function: no reveal entry)', async () => {
    // The test's own judgement admits the address (the test rule); the reader is wired with the product's rule, which refuses loopback.
    const strictReader = wireCaptureCredentialHolders({
      unit: (label, work) => core.app.pipeline.run(label, work),
      open: (deviceId, sealed) => store.capture.open(deviceId, sealed),
      errorLog,
      query: (text, values) => core.app.db.read('row146c.credentialDevice', (pool) => pool.query(text, values)),
      storedAddress: PRODUCT_RULE,
    }).connectionTest;
    const { seams, limits } = bounds(loopbackStoredCameraAddress, { reader: strictReader });
    const before = { trail: (await readTrail(owner)).length, tester: testerCalls, relays: relayPids.length, onvif: onvif.requests().length };
    expect(failureOf(await outcomeOf(testAdoptedCamera(seams, operator('SESSION-146-G'), 'CAM-01')))).toMatchObject({ statusCode: 409, code: 'INVALID_STATE', reason: 'CANDIDATE_NOT_TESTABLE' });
    const added = (await readTrail(owner)).slice(before.trail);
    expect(added.map((row) => [row.type, (row.details as { unreachableReason?: string }).unreachableReason ?? null])).toEqual([[TESTED, 'CREDENTIAL_NOT_READ']]);
    expect(Object.keys(added[0]?.details ?? {}).sort()).toEqual(NOT_ASKED_KEYS);
    expect(persisted.at(-1)).toMatchObject({ code: 'CAPTURE_STORED_TEST_CREDENTIAL_NOT_READ', context: { deviceId: 'CAM-01', cause: 'CAPTURE_CREDENTIAL_ADDRESS_REFUSED' } });
    expect({ tester: testerCalls, relays: relayPids.length, onvif: onvif.requests().length }).toEqual({ tester: before.tester, relays: before.relays, onvif: before.onvif });
    expect(limits.busy()).toBe(false);
    say('[row146c] reader gate (destination rule): 409 CANDIDATE_NOT_TESTABLE; entries [CAPTURE_DEVICE_CONNECTION_TESTED UNREACHABLE CREDENTIAL_NOT_READ], reveals +0');
  }, 60_000);

  // Row T3: "nothing listens on the camera's port" is true only while this file is the one user of that port - its
  // own port, and the lock against a fixture of the worker that would put a camera there. The real relay is started.
  itUnderHeavyHostLock('row 146c: UNREACHABLE AFTER THE REVEAL - the ONVIF half answers and no camera serves the stream: the REAL relay is started and reports it; 200 UNREACHABLE and EXACTLY TWO entries - the reveal, then the outcome UNREACHABLE with count 0 and NO `unreachableReason`', async () => {
    // No camera double is running: the locator names the camera's port, where nothing listens.
    setLocator('/row146c-nobody');
    device.account = ACCOUNT;
    const { seams, limits } = bounds();
    const before = { trail: (await readTrail(owner)).length, relays: relayPids.length, tester: testerCalls };
    const result = await outcomeOf(testAdoptedCamera(seams, operator('SESSION-146-H'), 'CAM-01'));
    expect(result).toMatchObject({ deviceId: 'CAM-01', outcome: 'UNREACHABLE', authenticated: true, usableProfileCount: 0, failedAttemptsRemaining: 2 });
    const added = (await readTrail(owner)).slice(before.trail);
    expect(added.map((row) => row.type)).toEqual([REVEALED, TESTED]);
    expect(added[0]).toMatchObject({ actorId: TECHNICIAN.id, deviceId: 'CAM-01', details: { deviceId: 'CAM-01', reason: 'CONNECTION_TEST' } });
    expect(added[1]).toMatchObject({ actorId: TECHNICIAN.id, details: { deviceId: 'CAM-01', outcome: 'UNREACHABLE', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION', operationId: 'testCaptureDeviceConnection', usableProfileCount: 0, permission: 'CAPTURE_CONFIG' } });
    expect(Object.keys(added[1]?.details ?? {}).sort()).toEqual(TESTED_KEYS);
    // The relay WAS started, once, and ended by itself with a word that is not success.
    expect(relayPids.length - before.relays).toBe(1);
    expect(relayExits.at(-1)).not.toBe(0);
    expect(testerCalls - before.tester).toBe(1);
    expect(limits.busy()).toBe(false);
    expect(noRelayLeft()).toBe(true);
    say(`[row146c] unreachable after the reveal: ${JSON.stringify(result)}; relay exit ${JSON.stringify(relayExits.at(-1))}; entries [CAPTURE_CREDENTIAL_REVEALED, CAPTURE_DEVICE_CONNECTION_TESTED UNREACHABLE count 0]`);
  }, 90_000);

  it('row 146c: THE RELAY CANNOT BE STARTED - the relay program is a path that names no file: 200 UNREACHABLE, said by the stream test\'s own code; EXACTLY TWO entries - the reveal, then the outcome UNREACHABLE with count 0 and NO `unreachableReason` (the ONVIF half WAS asked)', async () => {
    setLocator('/row146c-no-relay');
    device.account = ACCOUNT;
    const timers = createSystemTimers();
    const told: StreamTestNote[] = [];
    // The module's composition with a relay program that does not exist; the real door, not this file's watched one.
    const noRelay = createStreamConnectionTester({
      onvif: createOnvifConnectionTester({ timers }),
      locator: createOnvifStreamLocator({ timers }),
      door: startProductionProcess,
      relayProgram: join(dataDir, 'row146c-no-such-relay'),
      timers,
      statement: { profileOf: streamProfileOf, declaredRate: avcDeclaredFrameRate },
      tell: (note) => told.push(note),
    });
    const { seams, limits } = bounds(loopbackStoredCameraAddress, { tester: noRelay });
    const before = { trail: (await readTrail(owner)).length, relays: relayPids.length, onvif: onvif.requests().length };
    const result = await outcomeOf(testAdoptedCamera(seams, operator('SESSION-146-I'), 'CAM-01'));
    expect(result).toMatchObject({ deviceId: 'CAM-01', outcome: 'UNREACHABLE', authenticated: true, usableProfileCount: 0, failedAttemptsRemaining: 2 });
    expect(told.map((note) => note.code)).toEqual(['CAPTURE_STREAM_TEST_RELAY_FAILED']);
    const added = (await readTrail(owner)).slice(before.trail);
    expect(added.map((row) => row.type)).toEqual([REVEALED, TESTED]);
    expect(added[1]).toMatchObject({ actorId: TECHNICIAN.id, details: { deviceId: 'CAM-01', outcome: 'UNREACHABLE', usableProfileCount: 0 } });
    expect(Object.keys(added[1]?.details ?? {}).sort()).toEqual(TESTED_KEYS);
    // The ONVIF half asked the device; no relay of this file's watched door was started.
    expect(onvif.requests().length).toBeGreaterThan(before.onvif);
    expect(relayPids.length).toBe(before.relays);
    expect(limits.busy()).toBe(false);
    say(`[row146c] relay not startable: ${JSON.stringify(result)}; told ${JSON.stringify(told.map((note) => [note.code, note.reason]))}; entries [CAPTURE_CREDENTIAL_REVEALED, CAPTURE_DEVICE_CONNECTION_TESTED UNREACHABLE count 0]`);
  }, 90_000);

  it('the app\'s own control exists and is NOT ready: `buildApp` hands no reader in (the production composition does, row 85b)', () => {
    const control = adoptedCameraTestControl(core.app);
    expect(control.ready()).toBe(false);
    expect(typeof control.test).toBe('function');
  });
});

// ── Row 146b: the route ──────────────────────────────────────────────────────────────────────
const post = (cookie: Record<string, string> | null, deviceId: string, payload?: Record<string, unknown>): Promise<LightMyRequestResponse> =>
  core.app.inject({ method: 'POST', url: TEST_URL(deviceId), headers: { ...cookie, origin: WEB_ORIGIN }, ...(payload === undefined ? {} : { payload }) });
const refusalOf = (response: LightMyRequestResponse): { status: number; code: string; reason: string | null } => {
  kept.push(response.body);
  const body = response.json<{ error?: { code?: string; details?: { reason?: string } } }>();
  return { status: response.statusCode, code: body.error?.code ?? '', reason: body.error?.details?.reason ?? null };
};
/** The counts a refusal over HTTP must leave as they were. */
const httpCounts = async (): Promise<{ trail: number; reveals: number; tested: number; onvif: number }> => {
  await core.app.pipeline.drain();
  const trail = await readTrail(owner);
  return { trail: trail.length, reveals: trail.filter((row) => row.type === REVEALED).length, tested: trail.filter((row) => row.type === TESTED).length, onvif: onvif.requests().length };
};
/** Past the spacing and the per-minute bound of the app's own limits (the manual clock decides). */
const nextMinute = (): void => clock.advance(60_000 + CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS);

describe('row 146b: operation 108 over HTTP - POST /api/v1/capture/devices/{id}/test on the booted app', () => {
  it('BEFORE the reader is handed in: 503 DISCOVERY_NOT_READY for a registered camera - nothing read, nothing sent, no entry', async () => {
    const before = await httpCounts();
    expect(refusalOf(await post(technician, 'CAM-01'))).toEqual({ status: 503, code: 'NOT_READY', reason: 'DISCOVERY_NOT_READY' });
    expect(await httpCounts()).toEqual(before);
  }, 60_000);

  it('the reader handed in as the production composition does; then every refusal of the contract that needs no camera: 401, 403 (one ACCESS_DENIED row), 422, 404 (unknown id, a microphone), 409 CANDIDATE_NOT_TESTABLE (a stored address the rule refuses) - 0 reveals, 0 outcome entries, 0 requests', async () => {
    adoptedCameraTestControl(core.app).provide({ reader, storedAddress: loopbackStoredCameraAddress });
    expect(adoptedCameraTestControl(core.app).ready()).toBe(true);
    const microphone = core.app.engine.state().captureDevices.devices.find((entry) => entry.kind !== 'CAMERA')?.id ?? '';
    expect(microphone).not.toBe('');
    expect(core.app.engine.state().captureDevices.devices.filter((entry) => entry.kind === 'CAMERA').map((entry) => entry.id)).toEqual(expect.arrayContaining(['CAM-01', 'CAM-02']));
    const before = await httpCounts();
    const denialsBefore = (await readTrail(owner)).filter((row) => row.type === 'ACCESS_DENIED').length;

    expect(refusalOf(await post(null, 'CAM-01'))).toMatchObject({ status: 401, code: 'NOT_SIGNED_IN' });
    expect(refusalOf(await post(investigator, 'CAM-01'))).toMatchObject({ status: 403, code: 'NOT_PERMITTED' });
    expect(refusalOf(await post(technician, 'cam%2001'))).toMatchObject({ status: 422, code: 'INVALID_INPUT' });
    expect(refusalOf(await post(technician, 'CAM-99'))).toMatchObject({ status: 404, code: 'NOT_FOUND' });
    // WRONG KIND: a registered device that is no camera is the same 404 - the id is not told apart from an unknown one.
    expect(refusalOf(await post(technician, microphone))).toMatchObject({ status: 404, code: 'NOT_FOUND' });
    // DESTINATION REFUSED: the stored address moved to one the rule refuses (here the test rule: anything but loopback).
    await owner.query("UPDATE public.capture_devices SET address = '192.168.50.20' WHERE id = 'CAM-01'");
    const saidBefore = core.log.text().split('CAPTURE_STORED_TEST_ADDRESS_REFUSED').length;
    expect(refusalOf(await post(technician, 'CAM-01'))).toEqual({ status: 409, code: 'INVALID_STATE', reason: 'CANDIDATE_NOT_TESTABLE' });
    await owner.query("UPDATE public.capture_devices SET address = $1 WHERE id = 'CAM-01'", [`${HOST}:${ONVIF_PORT}`]);
    // Said once in the app's log by the rule's own code, never by the address.
    expect(core.log.text().split('CAPTURE_STORED_TEST_ADDRESS_REFUSED').length - saidBefore).toBe(1);
    expect(core.log.text().includes('192.168.50.20')).toBe(false);

    const after = await httpCounts();
    expect({ reveals: after.reveals, tested: after.tested, onvif: after.onvif }).toEqual({ reveals: before.reveals, tested: before.tested, onvif: before.onvif });
    // The one entry of the whole block is stage 6's row of the role refusal.
    expect(after.trail - before.trail).toBe(1);
    expect((await readTrail(owner)).filter((row) => row.type === 'ACCESS_DENIED').length - denialsBefore).toBe(1);
    say(`[row146b] refusals over HTTP: 401, 403, 422, 404, 404 (not a camera), 409 CANDIDATE_NOT_TESTABLE; audit entries +${after.trail - before.trail} (ACCESS_DENIED), reveals +0, outcome entries +0, ONVIF requests +0`);
  }, 60_000);

  it('row 146c over HTTP: a camera with NO stored credential - 409 CREDENTIAL_REQUIRED after the reader was called: EXACTLY TWO entries, the reader\'s and the outcome UNREACHABLE / `CREDENTIAL_NOT_READ`; no request to the device; the answer holds no member of the entry', async () => {
    // CAM-02 has no stored credential at this point of the file (the function-level case removed it).
    nextMinute();
    const before = await httpCounts();
    const response = await post(technician, 'CAM-02');
    expect(refusalOf(response)).toEqual({ status: 409, code: 'INVALID_STATE', reason: 'CREDENTIAL_REQUIRED' });
    expect(response.body.includes('unreachableReason') || response.body.includes('CREDENTIAL_NOT_READ')).toBe(false);
    const after = await httpCounts();
    expect({ trail: after.trail - before.trail, reveals: after.reveals - before.reveals, tested: after.tested - before.tested, onvif: after.onvif - before.onvif }).toEqual({ trail: 2, reveals: 1, tested: 1, onvif: 0 });
    const added = (await readTrail(owner)).slice(before.trail);
    expect(added.map((row) => row.type)).toEqual([REVEALED, TESTED]);
    expect(added[1]).toMatchObject({ actorId: TECHNICIAN.id, details: { deviceId: 'CAM-02', outcome: 'UNREACHABLE', unreachableReason: 'CREDENTIAL_NOT_READ' } });
    expect(Object.keys(added[1]?.details ?? {}).sort()).toEqual(NOT_ASKED_KEYS);
    say('[row146c] 409 CREDENTIAL_REQUIRED over HTTP: entries +2 (reveal, outcome UNREACHABLE CREDENTIAL_NOT_READ), ONVIF requests +0');
  }, 60_000);

  itUnderHeavyHostLock('200 REACHABLE through the app\'s own tester and the real relay: EXACTLY TWO entries - the reveal, then the outcome; a body is not read (a decoy account and a decoy address in it change nothing)', async () => {
    const camera = await startCamera('route-passed', ['--codec', 'hevc']);
    setLocator(camera.path);
    device.account = ACCOUNT;
    nextMinute();
    const before = await httpCounts();
    const decoy = { credential: { username: ['row146b', 'decoy', 'user'].join('-'), secret: ['row146b', 'decoy', 'value'].join('-') }, address: '192.168.50.99', port: 554, profile: 'HEVC_2160P' };
    needles.add(decoy.credential.username);
    needles.add(decoy.credential.secret);
    const response = await post(technician, 'CAM-01', decoy);
    kept.push(response.body);
    const facts = await camera.end();
    expect(response.statusCode, response.body).toBe(200);
    const body = response.json<Record<string, unknown>>();
    say(`[row146b] 200 over HTTP: ${JSON.stringify({ ...body, testedAt: 'n' })}; camera ${JSON.stringify(facts.counters)}`);
    expect(body).toMatchObject({ deviceId: 'CAM-01', outcome: 'REACHABLE', authenticated: true, usableProfileCount: 1, failedAttemptsRemaining: 2 });
    expect(Object.keys(body).sort()).toEqual(['authenticated', 'deviceId', 'failedAttemptsRemaining', 'outcome', 'testedAt', 'usableProfileCount']);
    // The stream WAS probed by the relay the app's own tester started: the camera answered one Digest exchange, no Basic one.
    expect(facts.counters['auth_digest_ok'] ?? 0).toBeGreaterThanOrEqual(1);
    expect(facts.counters['auth_basic'] ?? 0).toBe(0);
    await core.app.pipeline.drain();
    const added = (await readTrail(owner)).slice(before.trail);
    expect(added.map((row) => row.type)).toEqual([REVEALED, TESTED]);
    expect(added[0]).toMatchObject({ actorId: TECHNICIAN.id, deviceId: 'CAM-01', details: { deviceId: 'CAM-01', reason: 'CONNECTION_TEST' } });
    expect(added[1]).toMatchObject({ actorId: TECHNICIAN.id, details: { deviceId: 'CAM-01', outcome: 'REACHABLE', adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION', operationId: 'testCaptureDeviceConnection', usableProfileCount: 1, permission: 'CAPTURE_CONFIG' } });
    expect(Object.keys(added[1]?.details ?? {}).sort()).toEqual(TESTED_KEYS);
    // Nothing of the decoy body reached the camera's side or the trail: the ONVIF double took the STORED account only.
    expect(JSON.stringify(added).includes('192.168.50.99')).toBe(false);
  }, 150_000);

  // ── Row PR (wave 12; decision C117; rulings C36, C61 (1)) ─────────────────────────────────────────
  // Operation 108 on PostgreSQL, through the route, the app's own tester, the built relay and the test camera on
  // 8571: what a passed test STORES for a camera. The stored state of CAM-01 is set by each case (the owner role: the
  // runtime role may not delete a stream row), so no case rests on what an earlier one left.
  const storedOfCam01 = async (): Promise<{ profiles: unknown; lastSeenAt: unknown; onvifUuid: unknown; transport: unknown; streams: Record<string, unknown>[] }> => {
    const device = (await owner.query("SELECT profiles, last_seen_at, onvif_uuid, transport FROM public.capture_devices WHERE id = 'CAM-01'")).rows[0] as { profiles: unknown; last_seen_at: unknown; onvif_uuid: unknown; transport: unknown };
    const streams = (await owner.query("SELECT profile, onvif_profile_token, video_source_token, lens, stream_role, codec, width, height, read_at FROM public.capture_device_streams WHERE device_id = 'CAM-01' ORDER BY profile")).rows as Record<string, unknown>[];
    return { profiles: device.profiles, lastSeenAt: device.last_seen_at, onvifUuid: device.onvif_uuid, transport: device.transport, streams };
  };
  const storeForCam01 = async (profiles: readonly string[], streams: readonly { profile: string; codec: string; width: number; height: number }[]): Promise<void> => {
    await owner.query("DELETE FROM public.capture_device_streams WHERE device_id = 'CAM-01'");
    await owner.query("UPDATE public.capture_devices SET profiles = $1::jsonb WHERE id = 'CAM-01'", [JSON.stringify(profiles)]);
    for (const stream of streams) await owner.query("INSERT INTO public.capture_device_streams (device_id, profile, onvif_profile_token, lens, stream_role, codec, width, height, read_at) VALUES ('CAM-01', $1, $2, 1, 'MAIN', $3, $4, $5, 1730000000000)", [stream.profile, TOKEN, stream.codec, stream.width, stream.height]);
  };
  const lastOutcome = async (): Promise<AuditRow | undefined> => (await readTrail(owner)).findLast((row) => row.type === TESTED);

  itUnderHeavyHostLock('row PR (a) then (c): a camera with NO stored profile - the test stores what the stream states (the list and one stream row, by the adoption\'s statements, as the runtime role) in the unit of its outcome entry, which says "profiles stored: 1"; the assignment rule\'s own reader then finds the code; the SAME test again stores nothing', async () => {
    await storeForCam01([], []);
    const camera = await startCamera('row-pr-stored', ['--codec', 'hevc'], PROFILE_CAMERA_PORT);
    setLocator(camera.path, PROFILE_CAMERA_PORT);
    device.account = ACCOUNT;
    nextMinute();
    const kindBefore = (await owner.query("SELECT adapter_kind, address, model, enabled FROM public.capture_devices WHERE id = 'CAM-01'")).rows[0];
    const before = await httpCounts();
    const first = await post(technician, 'CAM-01');
    kept.push(first.body);
    expect(first.statusCode, first.body).toBe(200);
    // The answer is the contract's: the outcome, a count and - since row V7 (request of row PR) - the closed word that says "stored".
    expect(first.json<Record<string, unknown>>()).toMatchObject({ deviceId: 'CAM-01', outcome: 'REACHABLE', usableProfileCount: 1, profiles: 'PROFILES_STORED' });
    expect(Object.keys(first.json<Record<string, unknown>>()).sort()).toEqual(['authenticated', 'deviceId', 'failedAttemptsRemaining', 'outcome', 'profiles', 'testedAt', 'usableProfileCount']);
    await core.app.pipeline.drain();
    const stored = await storedOfCam01();
    say(`[rowPR] (a) stored for CAM-01: ${JSON.stringify(stored)}`);
    // ONE code, minted from the stream (the camera serves HEVC), and its stream row with the token the camera names it by.
    expect(stored.profiles).toEqual([expect.stringMatching(/^HEVC_[A-Z0-9_]+$/)]);
    const code = (stored.profiles as string[])[0] ?? '';
    expect(stored.streams).toHaveLength(1);
    expect(stored.streams[0]).toMatchObject({ profile: code, onvif_profile_token: TOKEN, lens: 1, stream_role: 'MAIN', codec: 'HEVC', width: 1920, height: 1080 });
    expect(stored.transport).toBe('RTSP');
    // Nothing else of the row moved: the adapter kind, the address, the model, the enabled flag.
    expect((await owner.query("SELECT adapter_kind, address, model, enabled FROM public.capture_devices WHERE id = 'CAM-01'")).rows[0]).toEqual(kindBefore);
    // THE GAP IS CLOSED where it was open: the reader the assignment rule judges a production camera by (row 187) finds the code.
    expect((await readCameraProfiles({ query: (text: string) => owner.query(text) } as never)).get('CAM-01')).toEqual([code]);
    // ROW V7: THE ENGINE'S DEVICE ENTRY - what the `captureDevices` slice and operation 77 hand every client - states the SAME
    // code, with what it states of its stream, WITHOUT a restart: the door ran in the unit that wrote the row.
    expect(core.app.engine.state().captureDevices.devices.find((entry) => entry.id === 'CAM-01')?.profiles).toEqual([{ code, codec: 'HEVC', resolution: '1080p', fps: null }]);
    // EXACTLY TWO entries, the reveal then the outcome - whose message says what was stored, in a count; its details are the contract's.
    const added = (await readTrail(owner)).slice(before.trail);
    expect(added.map((row) => row.type)).toEqual([REVEALED, TESTED]);
    expect(added[1]).toMatchObject({ message: 'Registered camera connection tested (REACHABLE); profiles stored: 1', actorId: TECHNICIAN.id, details: { deviceId: 'CAM-01', outcome: 'REACHABLE', usableProfileCount: 1, profiles: 'PROFILES_STORED', storedProfileCount: 0, statedProfileCount: 1, differingProfileCount: 0 } });
    expect(Object.keys(added[1]?.details ?? {}).sort()).toEqual([...TESTED_KEYS, ...STORED_STATEMENT_KEYS].sort());
    expect(JSON.stringify(added).includes(code)).toBe(false);

    // (c) THE SAME CAMERA AGAIN: stored and stated agree - nothing is written (the row read at the first test stands), the plain entry.
    nextMinute();
    const second = await post(technician, 'CAM-01');
    kept.push(second.body);
    const facts = await camera.end();
    expect(second.statusCode, second.body).toBe(200);
    expect(second.json<Record<string, unknown>>()).toMatchObject({ outcome: 'REACHABLE', usableProfileCount: 1 });
    await core.app.pipeline.drain();
    expect(await storedOfCam01()).toEqual(stored);
    expect((await lastOutcome())?.message).toBe('Registered camera connection tested (REACHABLE)');
    expect((await httpCounts()).trail - before.trail).toBe(4);
    expect(facts.counters['auth_basic'] ?? 0).toBe(0);
    say(`[rowPR] (a) 200, stored 1 code and 1 stream row, entries +2; (c) 200, nothing stored, entries +2; camera ${JSON.stringify(facts.counters)}`);
  }, 200_000);

  itUnderHeavyHostLock('row PR (b): a STORED statement and a stream that states something else (H.264 where HEVC is stored) - 200 REACHABLE, NOTHING stored, the entry says `STREAM_PROFILE_DIFFERS` in counts, the app\'s log says it by a code; then a HOSTILE description (row 154) at a camera with no stored profile: nothing stored, no text of it anywhere', async () => {
    await storeForCam01(['HEVC_1080P'], [{ profile: 'HEVC_1080P', codec: 'HEVC', width: 1920, height: 1080 }]);
    const kept01 = await storedOfCam01();
    const camera = await startCamera('row-pr-differs', ['--codec', 'h264'], PROFILE_CAMERA_PORT);
    setLocator(camera.path, PROFILE_CAMERA_PORT);
    device.account = ACCOUNT;
    nextMinute();
    const before = await httpCounts();
    const saidBefore = core.log.text().split('STREAM_PROFILE_DIFFERS').length;
    const response = await post(technician, 'CAM-01');
    kept.push(response.body);
    await camera.end();
    expect(response.statusCode, response.body).toBe(200);
    // Row V7 (request of row PR): the answer SAYS the difference, in the contract's closed word (it could not before).
    expect(response.json<Record<string, unknown>>()).toMatchObject({ deviceId: 'CAM-01', outcome: 'REACHABLE', usableProfileCount: 1, profiles: 'STREAM_PROFILE_DIFFERS' });
    await core.app.pipeline.drain();
    // The stored statement stands, to the row.
    expect(await storedOfCam01()).toEqual(kept01);
    const added = (await readTrail(owner)).slice(before.trail);
    expect(added.map((row) => row.type)).toEqual([REVEALED, TESTED]);
    expect(added[1]?.message).toBe('Registered camera connection tested (REACHABLE); STREAM_PROFILE_DIFFERS: stored 1, stated 1, differing 2; nothing stored');
    expect(added[1]?.details).toMatchObject({ profiles: 'STREAM_PROFILE_DIFFERS', storedProfileCount: 1, statedProfileCount: 1, differingProfileCount: 2 });
    expect(Object.keys(added[1]?.details ?? {}).sort()).toEqual([...TESTED_KEYS, ...STORED_STATEMENT_KEYS].sort());
    expect(JSON.stringify(added)).not.toMatch(/HEVC_|H264_/);
    // Said once in the app's log line of the test, by the word and counts.
    expect(core.log.text().split('STREAM_PROFILE_DIFFERS').length - saidBefore).toBe(1);

    // THE HOSTILE DESCRIPTION (the fixture's own: markup, 300 characters) at a camera WITHOUT a stored profile.
    await storeForCam01([], []);
    const hostile = await startCamera('row-pr-hostile', ['--sdp-codec', 'hostile', '--codec', 'hevc'], PROFILE_CAMERA_PORT);
    setLocator(hostile.path, PROFILE_CAMERA_PORT);
    const markup = (/^HOSTILE_CODEC_MARKUP = "((?:[^"\\]|\\.)*)"$/m.exec(cameraSource)?.[1] ?? '').replace(/\\(.)/g, '$1');
    expect(markup.length).toBeGreaterThan(3);
    needles.add(markup);
    nextMinute();
    const beforeHostile = await httpCounts();
    const refused = await post(technician, 'CAM-01');
    kept.push(refused.body);
    const hostileFacts = await hostile.end();
    expect(refused.statusCode, refused.body).toBe(200);
    const outcome = refused.json<{ outcome: string; usableProfileCount: number }>();
    say(`[rowPR] (b) 200 REACHABLE, nothing stored, STREAM_PROFILE_DIFFERS 1/1/2; hostile description: ${outcome.outcome}, usable ${String(outcome.usableProfileCount)}, camera ${JSON.stringify(hostileFacts.counters)}`);
    expect(hostileFacts.counters['hostile_codec_descriptions'] ?? 0).toBeGreaterThanOrEqual(1);
    await core.app.pipeline.drain();
    const after = await storedOfCam01();
    // Whatever the test answered, what is stored is nothing, or a code the Core minted - never a text of the description.
    expect(JSON.stringify(after).includes(markup)).toBe(false);
    for (const code of after.profiles as string[]) expect(code).toMatch(/^(?:H264|HEVC)_[A-Z0-9_]+$/);
    if (outcome.outcome !== 'REACHABLE') expect(after).toMatchObject({ profiles: [], streams: [] });
    const hostileAdded = (await readTrail(owner)).slice(beforeHostile.trail);
    expect(hostileAdded.map((row) => row.type)).toEqual([REVEALED, TESTED]);
    expect(JSON.stringify(hostileAdded).includes(markup)).toBe(false);
  }, 240_000);

  itUnderHeavyHostLock('THE GUARD over HTTP: two refused authentications (each 200, a result) - then 429 CONNECTION_TEST_LOCKOUT_GUARD with `retry-after`, for this camera and for the right camera of the same host: no reveal, no relay, no request, no entry', async () => {
    await storeCredential('CAM-02', WRONG);
    const camera = await startCamera('route-refused-twice', ['--codec', 'hevc']);
    setLocator(camera.path);
    device.account = WRONG;
    const before = await httpCounts();
    const outcomes: unknown[] = [];
    for (const remaining of [1, 0]) {
      nextMinute();
      const response = await post(technician, 'CAM-02');
      kept.push(response.body);
      expect(response.statusCode, response.body).toBe(200);
      expect(response.json<Record<string, unknown>>()).toMatchObject({ deviceId: 'CAM-02', outcome: 'AUTHENTICATION_FAILED', authenticated: true, usableProfileCount: 0, failedAttemptsRemaining: remaining });
      outcomes.push(response.json<{ outcome: string }>().outcome);
    }
    const afterTwo = await httpCounts();
    expect({ trail: afterTwo.trail - before.trail, reveals: afterTwo.reveals - before.reveals, tested: afterTwo.tested - before.tested }).toEqual({ trail: 4, reveals: 2, tested: 2 });
    const tokensAfterTwo = tokenRequests();

    nextMinute();
    const third = await post(technician, 'CAM-02');
    nextMinute();
    const sameHost = await post(technician, 'CAM-01');
    for (const refused of [third, sameHost]) {
      expect(refusalOf(refused)).toEqual({ status: 429, code: 'RATE_LIMITED', reason: 'CONNECTION_TEST_LOCKOUT_GUARD' });
      expect(String(refused.headers['retry-after'])).toMatch(/^[1-9][0-9]*$/);
    }
    const facts = await camera.end();
    device.account = ACCOUNT;
    // Every count stands where the second attempt left it; the camera saw exactly the two refused answers.
    expect(await httpCounts()).toEqual(afterTwo);
    expect(tokenRequests()).toBe(tokensAfterTwo);
    expect(facts.counters['auth_digest_refused'] ?? 0).toBe(2);
    expect(facts.counters['auth_digest_ok'] ?? 0).toBe(0);
    const added = (await readTrail(owner)).slice(before.trail);
    expect(added.map((row) => [row.type, (row.details as { guardTripped?: boolean }).guardTripped ?? null])).toEqual([[REVEALED, null], [TESTED, null], [REVEALED, null], [TESTED, true]]);
    say(`[row146b] guard over HTTP: ${JSON.stringify(outcomes)} then 429, 429 (same host); entries +${afterTwo.trail - before.trail}, then +0; camera ${JSON.stringify(facts.counters)}`);
  }, 200_000);
});

describe('row 146: no value in any log, answer, argument list or environment', () => {
  it('the log sink, the reader\'s error log, the audit trail, every answer, error, note and persisted entry of this file: 0 occurrences; every relay ended', async () => {
    expect(needles.size).toBeGreaterThanOrEqual(5);
    /** THE SWEEP: every place read anew, and how many of the texts stand in each. The control below uses THIS function. */
    const sweep = async (): Promise<Record<string, number>> => {
      await core.app.pipeline.drain();
      const places: Record<string, string> = {
        log: core.log.text(),
        errorLog: JSON.stringify(errorLog.entries),
        audit: JSON.stringify(await readTrail(owner)),
        // Row T3: the registry rows too - where a device's own text, or an address with an account in it, would come to rest.
        devices: ((await owner.query("SELECT coalesce(json_agg(row_to_json(t))::text, '[]') AS rows FROM public.capture_devices t")).rows[0] as { rows: string }).rows,
        answers: kept.map(everything).join('\n'),
        told: everything({ notes, persisted, streamNotes }),
        relayArguments: JSON.stringify(relayStarts),
      };
      return Object.fromEntries(Object.entries(places).map(([place, text]) => [place, occurrencesIn(text)]));
    };
    const NOTHING = { log: 0, errorLog: 0, audit: 0, devices: 0, answers: 0, told: 0, relayArguments: 0 };
    const found = await sweep();
    say(`[row146] occurrences of ${needles.size} texts: ${JSON.stringify(found)}; relays started ${relayPids.length}, exits ${JSON.stringify(relayExits)}`);
    expect(found).toEqual(NOTHING);
    // Every relay was started with no argument and an empty environment: the start message is the one carrier.
    expect(relayStarts.length).toBeGreaterThanOrEqual(3);
    expect(relayStarts.every((start) => start.args.length === 0 && Object.keys(start.env).length === 0)).toBe(true);
    expect(streamNotes).toEqual([]);
    expect(noRelayLeft()).toBe(true);

    // ── CONTROL (row T3; review 060c T-03, survivor 3). The control that stood here was
    // `[...needles].some((needle) => \`x ${needle} y\`.includes(needle))`: true for any set, and it never called the
    // search - a sweep that always answered 0 passed with it. Now the account's SECRET is put where the product could
    // really leave it, through the product's own sinks, AFTER the sweep above found nothing, and THE SAME SWEEP must
    // find each: a line of the app's own logger, an entry of the reader's error log, the message of an audit entry
    // written through the app's own pipeline (the form of the outcome entry `adopted-test.ts` writes), a column of a
    // registry row, an answer, a note, a relay's argument list. This is the file's last case: nothing reads these after it.
    const planted = ACCOUNT.secret;
    core.app.log.info({ rowT3Control: planted }, `row T3 control of the sweep: ${planted}`);
    errorLog.append({ ...errorLog.entries[0], code: 'ROW_T3_CONTROL', message: `row T3 control ${planted}` } as never);
    const outcomeRow = (await readTrail(owner)).findLast((row) => row.type === TESTED);
    expect(outcomeRow, 'an outcome entry of this file, as the form of the planted one').toBeDefined();
    await core.app.pipeline.run('rowT3.sweepControl', async (unit) => void (await unit.audit.append({ type: TESTED, message: `Registered camera connection tested (${planted})`, actorId: TECHNICIAN.id, deviceId: null, details: outcomeRow?.details ?? {} } as never)));
    await owner.query("UPDATE public.capture_devices SET model = $1 WHERE id = 'CAM-02'", [`model ${planted}`]);
    kept.push({ answer: planted });
    notes.push({ code: 'ROW_T3_CONTROL', text: planted });
    relayStarts.push({ args: [planted], env: {} });
    const control = await sweep();
    say(`[rowT3] control of the sweep, the secret planted in every place: ${JSON.stringify(control)}`);
    expect(control).toEqual({ log: 1, errorLog: 1, audit: 1, devices: 1, answers: 1, told: 1, relayArguments: 1 });
    expect(JSON.stringify(await readTrail(owner)).includes(REVEALED)).toBe(true);
  }, 30_000);
});
