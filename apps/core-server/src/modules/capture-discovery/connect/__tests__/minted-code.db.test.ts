// THE MINTED PROFILE CODE AGAINST A HOSTILE DESCRIPTION, end to end (task 4 blueprint row 154; M3;
// security addendum 04 item 6, requirement AD-06 point 5: "a fixture camera whose description names
// a codec with lower-case letters, markup characters and 300 characters: the minted code is of the
// closed set or the test fails by name; 0 occurrences of the fixture text in the log sink, the
// audit table and the device rows").
//
// Row 50's file (`stream-test.db.test.ts`) holds the TESTER to this: its results carry no camera
// text. THIS file follows the text further, to where a camera's words could come to rest: through
// operations 95 and 96 of a booted Core on PostgreSQL, into the registry row, the stream rows, the
// replicated slice, the audit table, the persistent error log and the log sink.
//
// WHAT IS REAL: the app factory with every stage and the module's own routes, booted on a
// throw-away clone of the seed; the connect flow (`connect/service.ts`); the tester of both halves
// as the module composes it, with the production process door and the relay BINARY
// `apps/capture-worker/build/capture-relay` in probe mode (not rebuilt here); the seal's own two
// functions; the module's own registrar (`registerAdoptedCamera`: the engine action, the device
// row, the stream rows) and the Core credential store.
//
// THE DOUBLES, all on loopback:
//   - the camera: `apps/capture-worker/test-fixtures/rtsp_test_camera.py` on 8567 (its second
//     listener on 8568) with the hostile switches of rows 152 and 186: `--sdp-codec hostile|lower`,
//     `--sdp-control other-port`, `--redirect authenticated`, `--adversary flood-answer`;
//   - the ONVIF device: the scripted device of `test/support/onvif-odd-device.ts` on 8576. In this
//     file IT IS HOSTILE TOO: it can announce an encoding, a profile name and a profile token of
//     markup, lower-case letters and 300 characters;
//   - the candidate list: a list of this file (as `connect.db.test.ts`). The candidate is of the
//     adapter kind `FAKE`: a loopback address is never a production candidate (`assertTestable`),
//     and the mint, the adoption and the rows are the same code for both classes.
//
// The account is the test camera's own synthetic constant, read from its file.
//
// PORTS AND THE LOCK (row T3; review 060c T-01; C61 (4)). The ports are THIS FILE'S OWN: camera 8567 and 8568, ONVIF
// device 8576 (before row T3: 8565, 8566 and 8557, which `stream-test.db.test.ts` and two more files named too). Every
// case that starts the camera or the relay holds `.locks/heavy-host.lock` while it runs (`itUnderHeavyHostLock`).
//
// RUN: sandbox off, under the database lock (a case takes the heavy-host lock itself; a run started under it is not
// asked again), with a core-file limit of 0 (the door refuses otherwise):
//   (ulimit -c 0; /usr/bin/lockf -k -t 1800 ../../.locks/db-migrate.lock \
//     npx vitest run --project db --maxWorkers=2 src/modules/capture-discovery/connect/__tests__/minted-code.db.test.ts)
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS } from '@dems/shared/api';
import { OPERATORS } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../../test/helpers/db';
import { manualTimer } from '../../../../../test/support/engine';
import { buildGuardApp, webOperator, type GuardApp } from '../../../../../test/support/guard';
import { itUnderHeavyHostLock } from '../../../../../test/support/heavy-host-lock';
import { WEB_ORIGIN, type Headers } from '../../../../../test/support/identity';
import { createOddOnvifDevice, dateAnswer, notAuthorizedFault, profilesAnswer, servicesAnswer, streamAnswer, tokenHolds, type OddDeviceReply, type OddDeviceRequest, type OddOnvifDevice } from '../../../../../test/support/onvif-odd-device';
import { avcDeclaredFrameRate, createSystemTimers } from '../../../../capture';
import { CaptureAdapterKind, STREAM_CODECS, STREAM_PROFILE_CODE, createOnvifConnectionTester, createOnvifStreamLocator, createStreamConnectionTester, startProductionProcess, type CameraCandidate, type ProductionDoor, type StreamTestNote } from '../../../../capture/adapters';
import { engineControl } from '../../../../engine';
import { streamProfileOf } from '../../../../sealing-host';
import { registerAdoptedCamera } from '../../adoption';
import { captureConnectControl, createConnectionTestLimits, type CandidateDirectory, type CandidateTestRecord, type ConnectCandidate } from '../index';

const REPOSITORY = resolve(__dirname, '../../../../../../..');
const WORKER_APP = join(REPOSITORY, 'apps/capture-worker');
const RELAY = join(WORKER_APP, 'build/capture-relay');
const CAMERA_SCRIPT = join(WORKER_APP, 'test-fixtures/rtsp_test_camera.py');
const OUT = join(REPOSITORY, '.cache/task4-row154');

const HOST = '127.0.0.1';
// Row T3: this file's own ports (see the header). No other test file of the Core names 8576, 8567 or 8568.
const ONVIF_PORT = 8576;
const CAMERA_PORT = 8567;
const SECOND_PORT = 8568;
const SCHEME = ['rt', 'sp'].join('');

const cameraSource = readFileSync(CAMERA_SCRIPT, 'utf8');
const constantOf = (name: string): string => new RegExp(`^${name} = "([^"]+)"$`, 'm').exec(cameraSource)?.[1] ?? '';
const ACCOUNT = { username: constantOf('ACCOUNT_USER'), secret: constantOf('ACCOUNT_PASSWORD') } as const;
/** The markup of the camera's hostile codec name, read from the fixture itself (its Python literal, unescaped). */
const CAMERA_MARKUP = (/^HOSTILE_CODEC_MARKUP = "((?:[^"\\]|\\.)*)"$/m.exec(cameraSource)?.[1] ?? '').replace(/\\(.)/g, '$1');
const CAMERA_HOSTILE_LENGTH = Number(/^HOSTILE_CODEC_LENGTH = (\d+)$/m.exec(cameraSource)?.[1] ?? 0);

// ── The hostile texts of the ONVIF device (this file's): markup, lower-case letters, 300 characters ──
const xml = (text: string): string => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const ONVIF_MARK = '<script>alert(154)</script>';
const hostileText = (head: string): string => `${head}${ONVIF_MARK}${'q'.repeat(300 - head.length - ONVIF_MARK.length)}`;
const HOSTILE_ENCODING = hostileText('h265');
const HOSTILE_TOKEN = hostileText('profile');
const SANE_TOKEN = 'profile_1';

/**
 * THE FIXTURE TEXT, as pieces a store or a line would hold if any of it got through: the markup of
 * both doubles, a run of the padding of each, the lower-case codec names of a description, and the
 * place a hostile description points to. None is a word the Core itself writes.
 */
const needles = new Set<string>(['<script', 'script>', 'alert(1)', 'alert(154)', '<b>', 'x'.repeat(24), 'q'.repeat(24), 'h265', 'h264', `${HOST}:${SECOND_PORT}`, ACCOUNT.username, ACCOUNT.secret]);
const occurrencesIn = (text: string): string[] => [...needles].filter((needle) => needle !== '' && text.includes(needle));

const db = useTestDatabase({ template: 'seed', slug: 'row154' });
const dataDir = mkdtempSync(join(tmpdir(), 'dems-row154-db-'));
const logDir = mkdtempSync(join(tmpdir(), 'dems-row154-log-'));
const errorLogFile = join(logDir, 'errors.log');
const TECHNICIAN = OPERATORS[2]!;

/** A fact of a run - outcomes, codes, counts, never a text of a double: to the run's own file. */
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
  end(): Promise<Readonly<Record<string, number>>>;
}
async function startCamera(name: string, extra: readonly string[] = []): Promise<TestCamera> {
  mkdirSync(OUT, { recursive: true });
  const log = join(OUT, `${name}.jsonl`);
  rmSync(log, { force: true });
  const child = spawn('python3', ['-B', CAMERA_SCRIPT, '--port', String(CAMERA_PORT), '--frames', '0', '--event-log', log, '--exit-on-stdin-eof', '--max-seconds', '120', ...extra], { stdio: ['pipe', 'pipe', 'pipe'] });
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
      // Row T3 (review 060c T-04): a counter that is absent reads as 0 below ("the other port never authorized"). That is
      // only true of a camera that WROTE its counters: without its `exit` line nothing was counted.
      const exit = events.findLast((event) => event.event === 'exit');
      if (exit === undefined || typeof exit.counters !== 'object' || exit.counters === null) throw new Error(`the test camera "${name}" left no exit line with its counters: nothing it did not do is proven`);
      return exit.counters as Record<string, number>;
    },
  };
}

// ── The Core side ────────────────────────────────────────────────────────────────────────────
let guard: GuardApp;
let owner: Pool;
let onvif: OddOnvifDevice;
let technician: Headers;
let limitsClock = 1_900_000_000_000;
/** What the ONVIF double announces: the stream address, and the texts of its one profile. */
const device = { locator: '', token: SANE_TOKEN, encoding: 'H264' };
const relayPids: number[] = [];
const relayExits: (number | string)[] = [];
const streamNotes: StreamTestNote[] = [];
/** Every response body of this file, for the last search. */
const answers: string[] = [];
const setLocator = (path: string): void => {
  device.locator = `${SCHEME}://${HOST}:${CAMERA_PORT}${path}`;
  needles.add(device.locator);
  needles.add(path);
};
const noRelayLeft = (): boolean => relayPids.every((pid) => !exists(pid));

// ── The stand-in candidate state: one session owns each candidate (the first that asks for it) ──
interface Held {
  owner: string | null;
  candidate: { candidateId: string; searchId: string; camera: CameraCandidate; registeredDeviceId: string | null; lastTest: CandidateTestRecord | null };
}
const held = new Map<string, Held>();
const directory: CandidateDirectory = {
  find(sessionId, candidateId): ConnectCandidate | null {
    const entry = held.get(candidateId);
    if (entry === undefined) return null;
    entry.owner ??= sessionId;
    return entry.owner === sessionId ? { ...entry.candidate } : null;
  },
  recordTest(_sessionId, candidateId, test) {
    const entry = held.get(candidateId);
    if (entry !== undefined) entry.candidate.lastTest = test;
  },
  markRegistered(_sessionId, candidateId, deviceId) {
    const entry = held.get(candidateId);
    if (entry !== undefined) entry.candidate.registeredDeviceId = deviceId;
  },
};
let minted = 0;
function candidate(): string {
  const candidateId = `CND-${(minted += 1).toString(16).toUpperCase().padStart(12, '0')}`;
  held.set(candidateId, {
    owner: null,
    candidate: {
      candidateId,
      searchId: 'DSC-000154',
      camera: { adapterKind: CaptureAdapterKind.FAKE, host: HOST, serviceAddress: `http://${HOST}:${ONVIF_PORT}/onvif/device_service`, endpointRef: `urn:uuid:${randomUUID()}`, vendor: null, model: 'TEST-CAM-154', name: 'Test camera 154', testable: true, conflict: false },
      registeredDeviceId: null,
      lastTest: null,
    },
  });
  return candidateId;
}

const testPath = (id: string): string => `/api/v1/capture/discovery/candidates/${id}/test`;
const adoptPath = (id: string): string => `/api/v1/capture/discovery/candidates/${id}/adopt`;
async function post(url: string): Promise<LightMyRequestResponse> {
  // Past the spacing of the limits for every call: only what a case is about can refuse.
  limitsClock += CAPTURE_CONNECTION_TEST_MIN_INTERVAL_MS + 6_000;
  const response = await guard.app.inject({ method: 'POST', url, headers: { ...technician, origin: WEB_ORIGIN }, payload: { credential: ACCOUNT } });
  answers.push(response.body);
  await guard.app.pipeline.drain();
  return response;
}
const reasonOf = (response: LightMyRequestResponse): unknown => (response.json() as { error?: { details?: { reason?: unknown } } }).error?.details?.reason;
const dump = async (table: string): Promise<string> => ((await owner.query(`SELECT coalesce(json_agg(row_to_json(t))::text, '[]') AS rows FROM public.${table} t`)).rows[0] as { rows: string }).rows;
const deviceCount = async (): Promise<number> => ((await owner.query('SELECT count(*)::int AS rows FROM public.capture_devices')).rows[0] as { rows: number }).rows;

/** The closed set of a minted code (AD-06 (1), (2)): one of the two codecs, a picture, at most a declared rate. */
const CLOSED_CODE = new RegExp(`^(?:${STREAM_CODECS.join('|')})_[0-9]{3,5}P[0-9]{0,3}$`);
/** THE NAMED FAILURE of the row: a stored code that is not of the closed set. The message says its length, never its text. */
function assertOfTheClosedSet(codes: readonly unknown[], where: string): void {
  for (const code of codes) {
    const text = typeof code === 'string' ? code : '';
    if (!CLOSED_CODE.test(text) || !STREAM_PROFILE_CODE.test(text)) throw new Error(`MINTED_CODE_NOT_OF_THE_CLOSED_SET in ${where}: a value of ${text.length} characters`);
  }
}

/** One hostile camera: the test, and the adoption that must not follow. Answers the outcome, the camera's counters and the relay's exit. */
async function refusedCamera(name: string, switches: readonly string[], announce: { token?: string; encoding?: string } = {}): Promise<{ readonly outcome: string; readonly usable: number; readonly adoption: readonly [number, unknown]; readonly counters: Readonly<Record<string, number>>; readonly relayExit: number | string | null }> {
  const camera = await startCamera(name, switches);
  setLocator(camera.path);
  device.token = announce.token ?? SANE_TOKEN;
  device.encoding = announce.encoding ?? 'H264';
  const devicesBefore = await deviceCount();
  const relaysBefore = relayPids.length;
  const id = candidate();
  const tested = await post(testPath(id));
  expect(tested.statusCode, name).toBe(200);
  const result = tested.json() as { outcome: string; usableProfileCount: number };
  const adopted = await post(adoptPath(id));
  const counters = await camera.end();
  device.token = SANE_TOKEN;
  device.encoding = 'H264';
  // No code exists for it, and nothing was registered.
  expect(held.get(id)?.candidate.lastTest?.profiles, name).toEqual([]);
  expect(await deviceCount(), name).toBe(devicesBefore);
  expect(noRelayLeft(), name).toBe(true);
  return { outcome: result.outcome, usable: result.usableProfileCount, adoption: [adopted.statusCode, reasonOf(adopted)], counters, relayExit: relayPids.length > relaysBefore ? (relayExits.at(-1) ?? null) : null };
}

beforeAll(async () => {
  expect(existsSync(RELAY), 'the relay binary of the worker build').toBe(true);
  expect(ACCOUNT.username.length > 0 && ACCOUNT.secret.length > 0).toBe(true);
  // The fixture's own hostile name is what AD-06 (5) describes: markup, and 300 characters.
  expect(CAMERA_MARKUP.includes('<script>') && CAMERA_MARKUP.includes('<b>')).toBe(true);
  expect(CAMERA_HOSTILE_LENGTH).toBe(300);
  expect([HOSTILE_ENCODING.length, HOSTILE_TOKEN.length]).toEqual([300, 300]);
  owner = db.ownerPool();
  guard = buildGuardApp({ runtime: db.runtime, run: { dataDir }, onCleanup: (close) => db.onCleanup(close) }, { errorLogFile, logLevel: 'trace' });
  await guard.app.ready();
  guard.app.seams.replace('publish', () => {});
  engineControl(guard.app).useTimer(manualTimer().timer);
  await guard.app.readiness.boot();
  await engineControl(guard.app).idle();

  onvif = createOddOnvifDevice(ONVIF_PORT, (request: OddDeviceRequest): OddDeviceReply => {
    if (request.operation === 'GetSystemDateAndTime') return dateAnswer();
    if (request.operation === 'GetServices') return servicesAnswer(`http://${HOST}:${ONVIF_PORT}`);
    if (!tokenHolds(request, ACCOUNT)) return notAuthorizedFault(400);
    // Well-formed XML whose TEXT is the hostile one: the device's words reach the Core's parser whole.
    if (request.operation === 'GetProfiles') return profilesAnswer([{ token: xml(device.token), encoding: xml(device.encoding) }]);
    return streamAnswer(device.locator);
  });
  await onvif.start();

  const timers = createSystemTimers();
  const door: ProductionDoor = (options) => {
    const child = startProductionProcess(options);
    if (child.pid !== null) relayPids.push(child.pid);
    void child.ended.then((exit) => relayExits.push(exit.exitCode ?? exit.signal ?? 'none'));
    return child;
  };
  // The module's own composition of the tester (`capture-discovery/index.ts`) with the relay of the worker build,
  // this file's candidates, limits on a clock of their own, and the module's registrar without the fence hand-over.
  captureConnectControl(guard.app).replaceForTest({
    candidates: directory,
    limits: createConnectionTestLimits({ now: () => limitsClock }),
    registrar: (scope, _principal, adopted) => registerAdoptedCamera(scope, adopted),
    tester: createStreamConnectionTester({
      onvif: createOnvifConnectionTester({ timers }),
      locator: createOnvifStreamLocator({ timers }),
      door,
      relayProgram: RELAY,
      timers,
      statement: { profileOf: streamProfileOf, declaredRate: avcDeclaredFrameRate },
      tell: (note) => streamNotes.push(note),
    }),
  });
  technician = await webOperator(guard, TECHNICIAN.username);
  await guard.app.pipeline.drain();
}, 120_000);

afterAll(async () => {
  for (const child of started) if (child.exitCode === null) child.kill('SIGKILL');
  for (const pid of relayPids) if (exists(pid)) process.kill(pid, 'SIGKILL');
  await onvif?.stop();
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(logDir, { recursive: true, force: true });
});

describe('row 154: a description the Core refuses - no code is minted, nothing is registered (AD-06 (1), (5))', () => {
  itUnderHeavyHostLock('the codec name of 300 characters with markup and lower-case letters: the test is not REACHABLE, the adoption is refused, no device row is added', async () => {
    const run = await refusedCamera('sdp-codec-hostile', ['--sdp-codec', 'hostile', '--codec', 'hevc']);
    say(`[row154] hostile codec name: ${run.outcome}, usable ${run.usable}, relay exit ${String(run.relayExit)}, adoption ${JSON.stringify(run.adoption)}, camera ${JSON.stringify(run.counters)}`);
    expect(['NOT_H264', 'WRONG_PROFILE']).toContain(run.outcome);
    expect(run.usable).toBe(0);
    expect(run.adoption).toEqual([409, 'CANDIDATE_NOT_TESTED']);
    // The camera did give the hostile description: the refusal is the relay's and the Core's, not a camera that never said it.
    expect(run.counters['hostile_codec_descriptions'] ?? 0).toBeGreaterThanOrEqual(1);
  }, 150_000);

  itUnderHeavyHostLock('a control address on another port, a redirect after the Digest answer and a flood in the place of the description: refused, nothing registered, the other port never authorized', async () => {
    const control = await refusedCamera('sdp-control-other-port', ['--second-port', String(SECOND_PORT), '--sdp-control', 'other-port']);
    const redirect = await refusedCamera('redirect', ['--second-port', String(SECOND_PORT), '--redirect', 'authenticated']);
    const flood = await refusedCamera('adversary-flood-answer', ['--adversary', 'flood-answer']);
    say(`[row154] control ${control.outcome} exit ${String(control.relayExit)}; redirect ${redirect.outcome} exit ${String(redirect.relayExit)}; flood ${flood.outcome} exit ${String(flood.relayExit)} ${JSON.stringify(flood.counters)}`);
    for (const run of [control, redirect, flood]) {
      expect(run.outcome).not.toBe('REACHABLE');
      expect(run.usable).toBe(0);
      expect(run.adoption).toEqual([409, 'CANDIDATE_NOT_TESTED']);
    }
    for (const run of [control, redirect]) expect(run.counters['second_port_authorized'] ?? 0).toBe(0);
    // Row T3 (review 060c T-04, survivor 10): the camera counts only what happened, so the 0 above is the ABSENCE of a
    // name in counters that were written (`end()` throws without the exit line) - and each camera did make the answer
    // that pointed at the other port, by its own count: the temptation was there.
    expect([control.counters['foreign_control_descriptions'], redirect.counters['redirects_sent']]).toEqual([1, 1]);
  }, 300_000);

  itUnderHeavyHostLock('an ONVIF profile TOKEN of markup and 300 characters: the profile is not named at all - not REACHABLE, no relay is started for it, nothing registered', async () => {
    const relaysBefore = relayPids.length;
    const run = await refusedCamera('onvif-token-hostile', ['--codec', 'hevc'], { token: HOSTILE_TOKEN });
    say(`[row154] hostile ONVIF token: ${run.outcome}, adoption ${JSON.stringify(run.adoption)}`);
    expect(run.outcome).not.toBe('REACHABLE');
    expect(run.adoption).toEqual([409, 'CANDIDATE_NOT_TESTED']);
    expect(relayPids.length).toBe(relaysBefore);
  }, 150_000);
});

describe('row 154: a description the Core takes - the stored code is the CORE\'S, of the closed set, whatever the camera calls its stream', () => {
  itUnderHeavyHostLock('a lower-case codec name in the description AND a hostile ENCODING announced over ONVIF: REACHABLE; adopted; the device row, the stream row and the slice hold HEVC_1080P and nothing of either text', async () => {
    const camera = await startCamera('lower-and-hostile-encoding', ['--sdp-codec', 'lower', '--codec', 'hevc']);
    setLocator(camera.path);
    device.encoding = HOSTILE_ENCODING;
    const id = candidate();
    const tested = await post(testPath(id));
    expect(tested.json()).toMatchObject({ outcome: 'REACHABLE', usableProfileCount: 1 });
    // What the candidate keeps of the test is the Core's code.
    const kept = held.get(id)?.candidate.lastTest?.profiles ?? [];
    assertOfTheClosedSet(kept, 'the candidate record');
    expect(kept).toEqual(['HEVC_1080P']);
    const adopted = await post(adoptPath(id));
    const counters = await camera.end();
    device.encoding = 'H264';
    expect(adopted.statusCode, guard.log.lines().filter((line) => Number(line['level']) >= 50).map((line) => JSON.stringify(line)).join('\n')).toBe(201);
    const adoption = adopted.json() as { deviceId: string; device: Record<string, unknown> };
    say(`[row154] lower-case name and hostile ONVIF encoding: REACHABLE, adopted ${adoption.deviceId}, relay exits ${JSON.stringify(relayExits.slice(-2))}, camera ${JSON.stringify(counters)}`);

    // THE DEVICE ROWS. Every stored code is of the closed set, or the test fails BY NAME.
    const row = (await owner.query('SELECT adapter_kind, profiles FROM public.capture_devices WHERE id = $1', [adoption.deviceId])).rows[0] as { adapter_kind: string; profiles: unknown[] };
    const streams = (await owner.query('SELECT profile, codec, width, height, onvif_profile_token, video_source_token, lens FROM public.capture_device_streams WHERE device_id = $1 ORDER BY lens', [adoption.deviceId])).rows as Record<string, unknown>[];
    assertOfTheClosedSet(row.profiles, 'capture_devices.profiles');
    assertOfTheClosedSet(streams.map((stream) => stream['profile']), 'capture_device_streams.profile');
    expect(row.profiles).toEqual(['HEVC_1080P']);
    expect(streams).toEqual([{ profile: 'HEVC_1080P', codec: 'HEVC', width: 1920, height: 1080, onvif_profile_token: SANE_TOKEN, video_source_token: 'vs_0', lens: 1 }]);
    expect(streams.every((stream) => (STREAM_CODECS as readonly unknown[]).includes(stream['codec']))).toBe(true);
    // THE SLICE: the answer of the adoption and the replicated registry.
    expect(occurrencesIn(JSON.stringify(adoption))).toEqual([]);
    expect(occurrencesIn(JSON.stringify(guard.app.engine.state().captureDevices))).toEqual([]);
    expect(noRelayLeft()).toBe(true);
  }, 200_000);

  it('CONTROL of the named failure: a code a camera could have chosen is refused by the same check, by name and without its text', () => {
    expect(() => assertOfTheClosedSet(['HEVC_1080P', 'H264_1080P25', 'H264_720P'], 'control')).not.toThrow();
    for (const chosen of [HOSTILE_ENCODING, 'h265_1080P', 'HEVC_1080P<b>', 'AV1_1080P', 'HEVC', '', 'HEVC_1080P '.repeat(30), 42, null]) {
      expect(() => assertOfTheClosedSet([chosen], 'control'), JSON.stringify(chosen).slice(0, 40)).toThrow(/^MINTED_CODE_NOT_OF_THE_CLOSED_SET in control: a value of \d+ characters$/);
    }
  });
});

describe('row 154: where the fixture text is after the whole run', () => {
  // The credential table is not searched: it holds the account name by design (and the sealed secret), which is no device text.
  it('the log sink, the persistent error log, the audit table, the device rows, the stream rows, the slice and every answer: 0 occurrences', async () => {
    await guard.app.pipeline.drain();
    const places: Record<string, string> = {
      log: guard.log.text(),
      errorLog: existsSync(errorLogFile) ? readFileSync(errorLogFile, 'utf8') : '',
      audit: await dump('audit_log'),
      devices: await dump('capture_devices'),
      streams: await dump('capture_device_streams'),
      slice: JSON.stringify([guard.app.engine.state().captureDevices, guard.app.engine.state().captureConfig]),
      answers: answers.join('\n'),
      notes: JSON.stringify(streamNotes),
    };
    const found = Object.fromEntries(Object.entries(places).map(([place, text]) => [place, occurrencesIn(text).length]));
    say(`[row154] occurrences of ${needles.size} texts: ${JSON.stringify(found)}; sizes ${JSON.stringify(Object.fromEntries(Object.entries(places).map(([place, text]) => [place, text.length])))}; relays started ${relayPids.length}, exits ${JSON.stringify(relayExits)}`);
    expect(found).toEqual({ log: 0, errorLog: 0, audit: 0, devices: 0, streams: 0, slice: 0, answers: 0, notes: 0 });
    // The places were not empty: the tests and the adoption are in the audit table, the adopted camera in the rows, the tests in the log.
    expect(places['audit']).toMatch(/CAPTURE_CONNECTION_TESTED/);
    expect(places['audit']).toMatch(/CAPTURE_CANDIDATE_ADOPTED/);
    expect(places['devices']).toMatch(/HEVC_1080P/);
    expect(places['streams']).toMatch(/HEVC_1080P/);
    expect(places['log']).toMatch(/camera connection tested/);
    expect(noRelayLeft()).toBe(true);
  }, 60_000);

  it('CONTROL: the same search finds a planted line of each kind of fixture text', () => {
    const planted = [`codec ${'h265'}${CAMERA_MARKUP}${'x'.repeat(40)}`, `encoding ${HOSTILE_ENCODING}`, `token ${HOSTILE_TOKEN}`, `moved to ${SCHEME}://${HOST}:${SECOND_PORT}/stream`];
    for (const line of planted) expect(occurrencesIn(line).length, line.slice(0, 24)).toBeGreaterThanOrEqual(1);
    expect(occurrencesIn('{"code":"CAPTURE_CONNECTION_TESTED","outcome":"REACHABLE","profile":"HEVC_1080P"}')).toEqual([]);
  });
});
