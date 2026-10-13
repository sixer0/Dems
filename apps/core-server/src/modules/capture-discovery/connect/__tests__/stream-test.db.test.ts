// The stream-level half of the connection test with the REAL relay (task 4 blueprint row 50, WP-05;
// amendment AM-2; security AD-06 (1) to (3) and (5), S13-01 (b), S13-04 (d); and the part of row
// 51's check that needs a stream: "the minted code equals the statement of the recorded file").
// The unit file, on a door double, is `src/capture/adapters/camera/__tests__/stream-probe.test.ts`.
//
// WHY THIS FILE IS IN THE DATABASE PROJECT. It uses no table. It binds loopback ports and starts
// processes, which the unit suite (`npm test`) must never do; the database project is the one the
// controller runs with the sandbox off and under the locks (as row 46's T-2 file).
//
// WHAT IS REAL: the tester as the connect flow composes it - the ONVIF half
// (`createOnvifConnectionTester`), the locator read, the relay start, the production process door,
// the relay BINARY `apps/capture-worker/build/capture-relay` in probe mode (not rebuilt here), and
// the seal's own two functions (`streamProfileOf`, `avcDeclaredFrameRate`).
//
// THE DOUBLES, all on loopback:
//   - the camera: `apps/capture-worker/test-fixtures/rtsp_test_camera.py` on 8565 (its second
//     listener on 8566), started by this file per case with the switches of rows 39, 40 and 152;
//   - the ONVIF device: the scripted device of `test/support/onvif-odd-device.ts` on 8575. It
//     ANNOUNCES ONE PROFILE WITH THE ENCODING H264, whatever the camera sends - the bench cameras'
//     behaviour - with the lower-case token `profile_1`, and names the test camera as its stream.
//
// The account is the test camera's own synthetic constant, read from its file. Comparisons that
// could print a value are asserted as booleans.
//
// PORTS AND THE LOCK (row T3; review 060c T-01; C61 (4)). The ports are THIS FILE'S OWN: camera 8565 and 8566, ONVIF
// device 8575 - no other test file of the Core names them (the table is in `test/support/onvif-odd-device.ts` and in
// `docs/.../test/t3_mutation_and_ports.md`). Every case that starts the camera or the relay holds
// `.locks/heavy-host.lock` while it runs (`itUnderHeavyHostLock`): the worker's fixtures use the camera range too.
//
// RUN: sandbox off, under the database lock (a case takes the heavy-host lock itself; a run started under it is not
// asked again), with a core-file limit of 0 (the door refuses otherwise):
//   (ulimit -c 0; /usr/bin/lockf -k -t 1800 ../../.locks/db-migrate.lock \
//     npx vitest run --project db --maxWorkers=2 src/modules/capture-discovery/connect/__tests__/stream-test.db.test.ts)
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { inspect } from 'node:util';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { itUnderHeavyHostLock } from '../../../../../test/support/heavy-host-lock';
import { createOddOnvifDevice, dateAnswer, notAuthorizedFault, profilesAnswer, servicesAnswer, streamAnswer, tokenHolds, type OddDeviceReply, type OddDeviceRequest, type OddOnvifDevice } from '../../../../../test/support/onvif-odd-device';
import { avcDeclaredFrameRate, createSystemTimers, videoSampleEntryOf, videoStreamFormatOf, type ByteSource } from '../../../../capture';
import {
  CaptureAdapterKind,
  StreamTestReason,
  createOnvifConnectionTester,
  createOnvifStreamLocator,
  createStreamConnectionTester,
  sealCredential,
  startProductionProcess,
  type CameraCandidate,
  type ProductionDoor,
  type StreamConnectionTester,
  type StreamTestNote,
  type StreamTestResult,
} from '../../../../capture/adapters';
import { streamProfileOf } from '../../../../sealing-host';

const REPOSITORY = resolve(__dirname, '../../../../../../..');
const WORKER_APP = join(REPOSITORY, 'apps/capture-worker');
const RELAY = join(WORKER_APP, 'build/capture-relay');
const CAMERA_SCRIPT = join(WORKER_APP, 'test-fixtures/rtsp_test_camera.py');
const OUT = join(REPOSITORY, '.cache/row050-stream-test');
/** The files row 46's T-2 recorded from this same test camera through the relay and the release worker. */
const RECORDED = join(REPOSITORY, '.cache/row046-camera-adapter/runs');

const HOST = '127.0.0.1';
// Row T3: this file's own ports (see the header). No other test file of the Core names 8575, 8565 or 8566.
const ONVIF_PORT = 8575;
const CAMERA_PORT = 8565;
const SECOND_PORT = 8566;
const SCHEME = ['rt', 'sp'].join('');
const TOKEN = 'profile_1';
/**
 * Row T3 (review 060c T-05): the comparison with the file row 46's T-2 recorded is its OWN case, skipped BY NAME on a
 * host that has no such file - never in silence inside a case that passes. With this set, its absence is a failure.
 */
const RECORDED_REQUIRED = process.env['DEMS_REQUIRE_RECORDED_FILES'] === '1';
/** The codes this run's stream tests minted, for that case. */
const minted: { hevc?: readonly string[]; h264?: readonly string[] } = {};

const cameraSource = readFileSync(CAMERA_SCRIPT, 'utf8');
const constantOf = (name: string): string => new RegExp(`^${name} = "([^"]+)"$`, 'm').exec(cameraSource)?.[1] ?? '';
const ACCOUNT = { username: constantOf('ACCOUNT_USER'), secret: constantOf('ACCOUNT_PASSWORD') } as const;
const WRONG = { username: ACCOUNT.username, secret: ['row50', 'not', 'the', 'synthetic', 'value'].join('-') } as const;
const CANDIDATE: CameraCandidate = { adapterKind: CaptureAdapterKind.ONVIF_RTSP, host: HOST, serviceAddress: `http://${HOST}:${ONVIF_PORT}/onvif/device_service`, endpointRef: null, vendor: null, model: null, name: null, testable: true, conflict: false };

// ── What must be nowhere ─────────────────────────────────────────────────────────────────────
const needles = new Set<string>([ACCOUNT.username, ACCOUNT.secret, WRONG.secret, '<script', 'javascript']);
const everything = (value: unknown): string => [String(value), JSON.stringify(value) ?? '', inspect(value, { depth: 8, showHidden: true, getters: true })].join('\n');
const occurrencesIn = (value: unknown): number => [...needles].filter((needle) => needle !== '' && everything(value).includes(needle)).length;
/** A fact of a run - outcomes, codes, counts, never a value of the account or an address: to the run's own file (the reporter shows a passed test's output to nobody). */
const say = (line: string): void => {
  mkdirSync(OUT, { recursive: true });
  appendFileSync(join(OUT, 'facts.log'), `${new Date().toISOString()} ${line}\n`);
};
/** Every result and note of this file, for the last search. */
const kept: unknown[] = [];

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
  /** The stream path a client must name. */
  readonly path: string;
  /** Ends the camera and answers the counters of its `exit` line and its requests by authentication class. */
  end(): Promise<{ readonly counters: Readonly<Record<string, number>>; readonly requests: readonly string[] }>;
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
      const exit = events.findLast((event) => event.event === 'exit');
      // Row T3 (review 060c T-04): a counter that is absent reads as 0 below ("no Basic request", "the other port never
      // visited"). That is only true of a camera that WROTE its counters: without its `exit` line nothing was counted.
      if (exit === undefined || typeof exit.counters !== 'object' || exit.counters === null) throw new Error(`the test camera "${name}" left no exit line with its counters: nothing it did not do is proven`);
      return { counters: exit.counters as Record<string, number>, requests: events.filter((event) => event.event === 'request').map((event) => `${String(event.method)}:${String(event.auth)}`) };
    },
  };
}

// ── The Core side ────────────────────────────────────────────────────────────────────────
let onvif: OddOnvifDevice;
let tester: StreamConnectionTester;
/** What the ONVIF double answers: the stream address it names, the account it takes, and the encoding it ANNOUNCES. */
const device = { locator: '', account: ACCOUNT as { readonly username: string; readonly secret: string }, announced: 'H264' };
const relayPids: number[] = [];
const relayExits: (number | string)[] = [];
const notes: StreamTestNote[] = [];
const never = (): AbortSignal => new AbortController().signal;
const setLocator = (path: string, port = CAMERA_PORT): void => {
  device.locator = `${SCHEME}://${HOST}:${port}${path}`;
  needles.add(device.locator);
  needles.add(path);
};
const test = async (account: { readonly username: string; readonly secret: string } = ACCOUNT): Promise<StreamTestResult> => {
  const result = await tester.test(CANDIDATE, sealCredential(account), never());
  kept.push(result);
  return result;
};
/** No relay of this file is left when a test has answered. */
const noRelayLeft = (): boolean => relayPids.every((pid) => !exists(pid));

beforeAll(async () => {
  expect(existsSync(RELAY), 'the relay binary of the worker build').toBe(true);
  expect(ACCOUNT.username.length > 0 && ACCOUNT.secret.length > 0).toBe(true);
  onvif = createOddOnvifDevice(ONVIF_PORT, (request: OddDeviceRequest): OddDeviceReply => {
    if (request.operation === 'GetSystemDateAndTime') return dateAnswer();
    if (request.operation === 'GetServices') return servicesAnswer(`http://${HOST}:${ONVIF_PORT}`);
    if (!tokenHolds(request, device.account)) return notAuthorizedFault(400);
    if (request.operation === 'GetProfiles') return profilesAnswer([{ token: TOKEN, encoding: device.announced }]);
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
  // The composition of `modules/capture-discovery/index.ts`, with this file's watched door and the relay of the worker build.
  tester = createStreamConnectionTester({
    onvif: createOnvifConnectionTester({ timers }),
    locator: createOnvifStreamLocator({ timers }),
    door,
    relayProgram: RELAY,
    timers,
    statement: { profileOf: streamProfileOf, declaredRate: avcDeclaredFrameRate },
    tell: (note) => {
      notes.push(note);
      kept.push(note);
    },
  });
}, 60_000);

afterAll(async () => {
  for (const child of started) if (child.exitCode === null) child.kill('SIGKILL');
  for (const pid of relayPids) if (exists(pid)) process.kill(pid, 'SIGKILL');
  await onvif?.stop();
});

/** A file on disk as the byte source the capture unit's readers take. */
function fileSource(path: string): ByteSource {
  const size = statSync(path).size;
  return {
    size,
    read: async (offset, length) => {
      const out = Buffer.alloc(Math.max(0, Math.min(length, size - offset)));
      const handle = openSync(path, 'r');
      try {
        readSync(handle, out, 0, out.length, offset);
      } finally {
        closeSync(handle);
      }
      return out;
    },
  };
}
/** The statement the SEAL would make of a recorded camera file: its sample entry's codec, its picture, its declared rate. Null: no such file here. */
async function recordedStatement(codec: 'h264' | 'hevc'): Promise<string | null> {
  const path = join(RECORDED, codec, 'media/VIDEO-01.mp4');
  if (!existsSync(path)) return null;
  const entry = await videoSampleEntryOf(fileSource(path));
  const format = await videoStreamFormatOf(fileSource(path));
  return entry.codec === null || format === null ? null : streamProfileOf(entry.codec, format);
}

describe('the codec is judged from the STREAM (amendment AM-2): ONVIF announces H264, the camera sends what it sends', () => {
  itUnderHeavyHostLock('HEVC: REACHABLE with the usable profile HEVC_1080P - not NOT_H264; Digest only (the statement of the recorded file: the block below)', async () => {
    device.announced = 'H264';
    device.account = ACCOUNT;
    const camera = await startCamera('hevc', ['--codec', 'hevc']);
    setLocator(camera.path);
    const before = relayPids.length;
    const at = Date.now();
    const result = await test();
    const tookMs = Date.now() - at;
    const facts = await camera.end();
    say(`[row50] hevc: ${result.outcome} ${JSON.stringify(result.usableProfiles)} in ${tookMs} ms; relay exits ${JSON.stringify(relayExits.slice(-1))}; camera ${JSON.stringify(facts.counters)}`);
    // Kept for the block below before anything is judged here: that block then states the difference by itself.
    minted.hevc = result.usableProfiles;
    expect(result).toEqual({
      outcome: 'REACHABLE',
      authenticated: true,
      usableProfiles: ['HEVC_1080P'],
      streams: [{ code: 'HEVC_1080P', codec: 'HEVC', width: 1920, height: 1080, onvifProfileToken: TOKEN, videoSourceToken: 'vs_0', lens: 1 }],
      streamTested: true,
      reason: null,
      rejectedCredentialRequests: 0,
      duplicateCodes: 0,
    });
    expect(relayPids.length - before).toBe(1);
    expect(relayExits.at(-1)).toBe(0);
    expect(noRelayLeft()).toBe(true);
    expect(tookMs).toBeLessThan(15_000);
    // The camera was answered with Digest only, and got its TEARDOWN: nothing was pushed anywhere.
    expect(facts.counters['auth_basic'] ?? 0).toBe(0);
    expect(facts.requests.some((request) => request.endsWith(':basic'))).toBe(false);
    expect(facts.counters['auth_digest_ok']).toBe(4);
    expect(facts.requests.filter((request) => !request.endsWith(':none')).every((request) => request.endsWith(':digest_ok'))).toBe(true);
  }, 150_000);

  itUnderHeavyHostLock('H.264: REACHABLE likewise; the code states the rate of the parameter set - H264_1080P25, the test camera\'s 25 pictures a second (the statement of the recorded file: the block below)', async () => {
    device.announced = 'H264';
    const camera = await startCamera('h264', ['--codec', 'h264']);
    setLocator(camera.path);
    const result = await test();
    const facts = await camera.end();
    say(`[row50] h264: ${result.outcome} ${JSON.stringify(result.usableProfiles)}; camera ${JSON.stringify(facts.counters)}`);
    // Kept for the block below before anything is judged here: that block then states the difference by itself.
    minted.h264 = result.usableProfiles;
    expect(result).toMatchObject({ outcome: 'REACHABLE', streamTested: true, reason: null, rejectedCredentialRequests: 0, streams: [{ codec: 'H264', width: 1920, height: 1080, onvifProfileToken: TOKEN, lens: 1 }] });
    // Row T3 (review 060c T-05): the ONE code, with the rate the camera's parameter set declares (`rtsp_test_camera.py`:
    // 25 pictures a second). The form `H264_1080P` followed by any digits took a code without the rate, or with another.
    expect(result.usableProfiles).toEqual(['H264_1080P25']);
    expect(result.streams[0]?.code).toBe('H264_1080P25');
    expect(facts.counters['auth_basic'] ?? 0).toBe(0);
    expect(noRelayLeft()).toBe(true);
  }, 150_000);

  itUnderHeavyHostLock('a camera that ANNOUNCES H265 only and sends HEVC is REACHABLE too: the announcement is advice in both directions', async () => {
    device.announced = 'H265';
    const camera = await startCamera('hevc-announced', ['--codec', 'hevc', '--param-sets', 'inband']);
    setLocator(camera.path);
    const result = await test();
    await camera.end();
    device.announced = 'H264';
    expect(result).toMatchObject({ outcome: 'REACHABLE', usableProfiles: ['HEVC_1080P'], streamTested: true });
  }, 150_000);
});

// Row T3 (review 060c T-05; survivors 6 and 7 of its section 6). The comparison stood inside the two cases above as
// `if (recorded !== null) expect(...)`: on a host without `.cache/row046-camera-adapter/runs` it was not made and
// nothing said so. It is a case of its own now: MADE when the file is there, SKIPPED BY NAME when it is not (the
// reporter counts it as skipped), and a FAILURE when it is not there and `DEMS_REQUIRE_RECORDED_FILES=1` asks for it.
// The file is written by `camera-adapter-open.db.test.ts` (row 46's T-2), from the same test camera.
describe('row 51: the minted code equals the statement the SEAL makes of the file recorded from this camera (row 46\'s T-2)', () => {
  for (const codec of ['hevc', 'h264'] as const) {
    const present = existsSync(join(RECORDED, codec, 'media/VIDEO-01.mp4'));
    it.skipIf(!present && !RECORDED_REQUIRED)(`${codec}: the code of this run's stream test is the statement of .cache/row046-camera-adapter/runs/${codec}/media/VIDEO-01.mp4 (skipped by name without that file; a failure with DEMS_REQUIRE_RECORDED_FILES=1)`, async () => {
      expect(present, 'the file row 46\'s T-2 recorded is on this host').toBe(true);
      const recorded = await recordedStatement(codec);
      say(`[row50] ${codec}: the recorded file of row 46 states ${String(recorded)}; this run minted ${JSON.stringify(minted[codec] ?? null)}`);
      expect(recorded, 'the recorded file has a sample entry and a format the seal states').not.toBeNull();
      expect(minted[codec], 'the stream test of this codec ran in this file and was REACHABLE').toBeDefined();
      expect(minted[codec]).toEqual([recorded]);
    });
  }
});

describe('the ends of the stream half that are not REACHABLE: an outcome of the contract, nothing judged, no relay left', () => {
  itUnderHeavyHostLock('a Basic-only camera: AUTHENTICATION_FAILED with SCHEME_NOT_ALLOWED; the camera\'s auth_basic counter is 0', async () => {
    const camera = await startCamera('basic-only', ['--challenge', 'basic']);
    setLocator(camera.path);
    const result = await test();
    const facts = await camera.end();
    say(`[row50] basic-only: ${result.outcome} ${String(result.reason)}; relay exits ${JSON.stringify(relayExits.slice(-1))}; camera ${JSON.stringify(facts.counters)} ${JSON.stringify(facts.requests)}`);
    expect(result).toMatchObject({ outcome: 'AUTHENTICATION_FAILED', reason: 'SCHEME_NOT_ALLOWED', rejectedCredentialRequests: 0, usableProfiles: [], streams: [], streamTested: true });
    expect(relayExits.at(-1)).toBe(22);
    expect(facts.counters['auth_basic'] ?? 0).toBe(0);
    expect(facts.requests.every((request) => request.endsWith(':none'))).toBe(true);
    expect(noRelayLeft()).toBe(true);
  }, 150_000);

  itUnderHeavyHostLock('a wrong password: refused by the ONVIF half, no relay; refused AT THE STREAM (an ONVIF device that takes it), one rejected request counted', async () => {
    const camera = await startCamera('wrong-password');
    setLocator(camera.path);
    const before = relayPids.length;
    const atOnvif = await test(WRONG);
    expect(atOnvif).toMatchObject({ outcome: 'AUTHENTICATION_FAILED', streams: [], streamTested: false, rejectedCredentialRequests: 1 });
    expect(relayPids.length - before).toBe(0);
    // The ONVIF device takes the other account; the camera does not.
    device.account = WRONG;
    const atStream = await test(WRONG);
    device.account = ACCOUNT;
    const facts = await camera.end();
    say(`[row50] wrong password at the stream: ${atStream.outcome} ${String(atStream.reason)} rejected ${atStream.rejectedCredentialRequests}; camera ${JSON.stringify(facts.counters)}`);
    expect(atStream).toMatchObject({ outcome: 'AUTHENTICATION_FAILED', reason: StreamTestReason.STREAM_CREDENTIAL_REFUSED, rejectedCredentialRequests: 1, usableProfiles: [], streams: [], streamTested: true });
    expect(relayExits.at(-1)).toBe(23);
    expect(facts.counters['auth_basic'] ?? 0).toBe(0);
    expect(noRelayLeft()).toBe(true);
  }, 150_000);

  // Row T3: "nothing listens on 8565" is true only while this file is the one user of that port - its own port, and
  // the lock against a fixture of the worker that would put a camera there.
  itUnderHeavyHostLock('no camera at the stream address: UNREACHABLE', async () => {
    setLocator('/stream/nobody-listens');
    const result = await test();
    expect(result).toMatchObject({ outcome: 'UNREACHABLE', reason: StreamTestReason.STREAM_UNREACHABLE, usableProfiles: [], streams: [], streamTested: true });
    expect(relayExits.at(-1)).toBe(20);
    expect(noRelayLeft()).toBe(true);
  }, 60_000);

  itUnderHeavyHostLock('a hostile description - a codec name of 300 characters with markup: refused, no code, 0 occurrences of its text (AD-06 (5))', async () => {
    const camera = await startCamera('sdp-codec-hostile', ['--sdp-codec', 'hostile']);
    setLocator(camera.path);
    const result = await test();
    const facts = await camera.end();
    say(`[row50] hostile codec name: ${result.outcome} ${String(result.reason)}; relay exits ${JSON.stringify(relayExits.slice(-1))}; camera ${JSON.stringify(facts.counters)}`);
    expect(result.outcome).not.toBe('REACHABLE');
    expect(result).toMatchObject({ usableProfiles: [], streams: [], streamTested: true });
    expect(['NOT_H264', 'WRONG_PROFILE']).toContain(result.outcome);
    expect(occurrencesIn(result)).toBe(0);
    expect(noRelayLeft()).toBe(true);
  }, 150_000);

  itUnderHeavyHostLock('a codec name in lower case: REACHABLE with the code of the closed set, formed by the Core from the BYTES - HEVC_1080P; the camera\'s spelling decides nothing', async () => {
    const camera = await startCamera('sdp-codec-lower', ['--sdp-codec', 'lower', '--codec', 'hevc']);
    setLocator(camera.path);
    const result = await test();
    const facts = await camera.end();
    say(`[row50] lower-case codec name: ${result.outcome} ${String(result.reason)} ${JSON.stringify(result.usableProfiles)}`);
    // Row T3 (review 060c T-05, survivor 8): ONE answer. This case took REACHABLE and every refusal with a code word,
    // so a Core that refused the stream, or judged it by the name, passed. The name is lower case; the bytes are HEVC.
    expect(result).toMatchObject({ outcome: 'REACHABLE', reason: null, streamTested: true, usableProfiles: ['HEVC_1080P'], streams: [{ code: 'HEVC_1080P', codec: 'HEVC', width: 1920, height: 1080 }] });
    expect(relayExits.at(-1)).toBe(0);
    // The camera did serve the lower-case description to an authorized client (its own count), so the case is the one its title names.
    expect(facts.counters['auth_digest_ok']).toBe(4);
    expect(noRelayLeft()).toBe(true);
  }, 150_000);

  itUnderHeavyHostLock('a description that names its control address on another port, and a redirect: refused, nothing judged, the other port never visited', async () => {
    const control = await startCamera('sdp-control-other-port', ['--second-port', String(SECOND_PORT), '--sdp-control', 'other-port']);
    setLocator(control.path);
    const first = await test();
    const controlFacts = await control.end();
    say(`[row50] foreign control address: ${first.outcome} ${String(first.reason)}; relay exits ${JSON.stringify(relayExits.slice(-1))}; camera ${JSON.stringify(controlFacts.counters)}`);
    expect(first).toMatchObject({ outcome: 'WRONG_PROFILE', reason: StreamTestReason.STREAM_REFUSED, usableProfiles: [], streams: [], streamTested: true });
    expect(relayExits.at(-1)).toBe(26);

    const redirect = await startCamera('redirect', ['--second-port', String(SECOND_PORT), '--redirect', 'authenticated']);
    setLocator(redirect.path);
    const second = await test();
    const redirectFacts = await redirect.end();
    say(`[row50] redirect: ${second.outcome} ${String(second.reason)}; relay exits ${JSON.stringify(relayExits.slice(-1))}; camera ${JSON.stringify(redirectFacts.counters)}`);
    expect(second).toMatchObject({ outcome: 'WRONG_PROFILE', reason: StreamTestReason.STREAM_REFUSED, usableProfiles: [], streams: [], streamTested: true });
    expect(relayExits.at(-1)).toBe(25);
    for (const counters of [controlFacts.counters, redirectFacts.counters]) {
      const second_port = Object.entries(counters).filter(([name]) => name.includes('second'));
      expect(second_port.every(([, count]) => count === 0), JSON.stringify(second_port)).toBe(true);
    }
    // Row T3 (review 060c T-04, survivor 9): the camera counts only what happened, so "never visited" is the ABSENCE of
    // three names in counters that were written (`end()` throws without the exit line) - and each camera did make the
    // answer that pointed at the other port, by its own count: the temptation was there.
    for (const name of ['second_port_connections', 'second_port_requests', 'second_port_authorized']) expect([controlFacts.counters[name] ?? 0, redirectFacts.counters[name] ?? 0], name).toEqual([0, 0]);
    expect([controlFacts.counters['foreign_control_descriptions'], redirectFacts.counters['redirects_sent']]).toEqual([1, 1]);
    expect(noRelayLeft()).toBe(true);
  }, 200_000);
});

// Task 4 row 143c (decision C65): on a production Core the test of a candidate that is not stored yet is made by the
// tester BOUND to the camera-interface address (`boundTo`). On loopback: the address this host holds reaches both
// doubles; an address it does not hold (192.0.2.1, a documentation address) reaches NEITHER - the ONVIF device's own
// request record and the camera's own counters are the proof - and no relay is started.
describe('task 4 row 143c (C65): the bound test of a candidate, both halves on the wire', () => {
  itUnderHeavyHostLock('bound to the address this host holds: REACHABLE as the unbound test; bound to an address it does not hold: UNREACHABLE, 0 requests at the ONVIF device, 0 at the camera, no relay', async () => {
    device.announced = 'H264';
    device.account = ACCOUNT;
    const camera = await startCamera('bound', ['--codec', 'h264']);
    setLocator(camera.path);
    const held = await tester.boundTo(HOST).test(CANDIDATE, sealCredential(ACCOUNT), never());
    kept.push(held);
    expect(held).toMatchObject({ outcome: 'REACHABLE', streamTested: true, reason: null, rejectedCredentialRequests: 0, streams: [{ codec: 'H264', onvifProfileToken: TOKEN, lens: 1 }] });
    expect(relayExits.at(-1)).toBe(0);
    const asked = onvif.requests().length;
    const relays = relayPids.length;
    expect(asked).toBeGreaterThan(0);
    const at = Date.now();
    const notHeld = await tester.boundTo('192.0.2.1').test(CANDIDATE, sealCredential(ACCOUNT), never());
    kept.push(notHeld);
    const facts = await camera.end();
    say(`[row143c] bound: held ${held.outcome}; not held ${notHeld.outcome} (${String(notHeld.reason)}) in ${Date.now() - at} ms; ONVIF requests after it ${onvif.requests().length - asked}; relays after it ${relayPids.length - relays}; camera ${JSON.stringify(facts.counters)}`);
    expect(notHeld).toMatchObject({ outcome: 'UNREACHABLE', streamTested: false, streams: [], usableProfiles: [], rejectedCredentialRequests: 0 });
    expect(onvif.requests().length).toBe(asked);
    expect(relayPids.length).toBe(relays);
    // The camera saw the ONE test that was bound to the held address, answered with Digest only, and nothing of the second.
    expect(facts.counters['auth_basic'] ?? 0).toBe(0);
    expect(facts.counters['auth_digest_ok']).toBe(4);
    expect(noRelayLeft()).toBe(true);
    // A text that is no source address binds nothing and contacts nothing.
    expect(() => tester.boundTo('0.0.0.0')).toThrow();
    expect(onvif.requests().length).toBe(asked);
  }, 150_000);
});

describe('what the whole run left', () => {
  it('no account, address or camera text in any result or note; no fault of the host was told; every relay ended', () => {
    expect(kept.length).toBeGreaterThanOrEqual(10);
    expect(kept.map(occurrencesIn).reduce((sum, count) => sum + count, 0)).toBe(0);
    expect(notes).toEqual([]);
    expect(noRelayLeft()).toBe(true);
    say(`[row50] relays started ${relayPids.length}, exits ${JSON.stringify(relayExits)}`);
  });
});
