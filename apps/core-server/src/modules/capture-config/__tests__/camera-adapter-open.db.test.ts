// The production camera adapter, T-2: ADAPTER LEVEL, on doubles of this Mac (task 4 blueprint row
// 46, WP-06b; design addendum 6.3: "the real relay, the real release worker driven by its own
// harness, the fixture camera, a fake ONVIF device - a decodable file with the expected frames; no
// registry, no fence, no session"). T-1 and T-3 are the unit file of the adapter,
// `src/capture/adapters/camera/__tests__/onvif-relay.test.ts`.
//
// WHY THIS FILE STANDS IN THE FOLDER OF THE CAPTURE-CONFIG MODULE. It builds the credential readers
// through their wiring (`../credential-holders`), and outside production only the tests of THIS
// folder may import the wiring or the reader (static rules R-3 and R-6 of `./static.test.ts`,
// AD-03 (1)). The adapter never imports either: it is handed its reader, here as in the product.
//
// WHAT IS REAL: the adapter and its relay start; the production process door; the relay BINARY
// `apps/capture-worker/build/capture-relay` (not rebuilt here); the ONVIF locator read
// (`createOnvifStreamLocator`); the credential reader through its wiring, on a throw-away clone of
// the seed with the real pipeline, the real audit writer, the owner's reveal function and a real
// Core credential store in the system's temporary folder; the release capture worker.
//
// THE DOUBLES, all on loopback:
//   - the camera: `apps/capture-worker/test-fixtures/rtsp_test_camera.py` on 8565 (C33), started by
//     this file (H.264, HEVC, and its Basic-only mode);
//   - the ONVIF device: the scripted device of `test/support/onvif-odd-device.ts` on 8557, whose
//     `GetStreamUri` answer names the test camera (the fake ONVIF stub answers its own RTSP
//     responder, which is no camera; it is the double of the session file, not of this one);
//   - the listener, TWO KINDS, and why:
//       (a) the REAL WORKER, one session per codec, driven by its own harness through
//           `test-fixtures/row046_adapter_listener.py` (ports 8559, 8561): it is what proves that
//           video reaches the listener at the session's address as a decodable file, and that the
//           worker's announce gate takes the relay's push;
//       (b) a SMALL RTSP SINK of this file on 8563, which answers the push handshake with success
//           and counts what arrives: for the cases that need a listener many times or at a moment
//           the test chooses (20 open/close cycles, a push that is cut, a listener that must stay
//           untouched). A worker session listens once and for 12 s; 20 of them would hold the
//           heavy-host lock for minutes and prove nothing more about the ADAPTER;
//   - the stored facts of a stream (`stream`): a function of this file. The composition that reads
//     `capture_device_streams` is row 85;
//   - the stored-address rule of the reader: the permissive test value of
//     `test/support/stored-camera-address.ts` (AD-02 (2)) for the loopback doubles, and the REAL
//     rule (`decideDestination`, purpose of a stored camera) for the refusal cases.
//
// The account is the test camera's own synthetic constant, read from its file. The ingest address
// of a worker run is built by the harness, of a sink run by this file in the form of
// `capture/ingest-address.ts` on the sink's port (the product's two ports belong to the emulators
// on this Mac, driver rule 8). Comparisons that could print a value are asserted as booleans.
//
// RUN: sandbox off, under both locks, with a core-file limit of 0 (the door refuses otherwise):
//   (ulimit -c 0; /usr/bin/lockf -k -t 1800 ../../.locks/heavy-host.lock /usr/bin/lockf -k -t 1800 ../../.locks/db-migrate.lock \
//     npx vitest run --project db --maxWorkers=2 src/modules/capture-config/__tests__/camera-adapter-open.db.test.ts)
import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type Server, type Socket } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { inspect } from 'node:util';
import type { AuditRow } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { captureLog, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import { readTrail, recordingErrorLog, type RecordingErrorLog } from '../../../../test/support/core';
import { createOddOnvifDevice, dateAnswer, notAuthorizedFault, servicesAnswer, streamAnswer, tokenHolds, type OddDeviceReply, type OddDeviceRequest, type OddOnvifDevice } from '../../../../test/support/onvif-odd-device';
import { loopbackStoredCameraAddress } from '../../../../test/support/stored-camera-address';
import { buildApp } from '../../../app';
import { CaptureAdapterKind } from '../../../capture/adapters/kinds';
import { startProductionProcess, type ProductionDoor } from '../../../capture/adapters/production-door';
import type { CameraCandidate, CameraSourceTarget, CaptureDeviceEntry, SourceHandle } from '../../../capture/adapters/types';
import { CameraOpenRefusal, createOnvifRelayCameraAdapter, type CameraRelayEnd, type CameraRelayNote, type CameraRelayReport, type OnvifRelayCameraAdapter } from '../../../capture/adapters/camera/onvif-relay';
import { createOnvifStreamLocator } from '../../../capture/adapters/camera/onvif-session';
import { DestinationPurpose, decideDestination, type DestinationContext } from '../../../capture/destination-rule';
import { createSystemTimers } from '../../../capture/timers';
import { createCredentialStore, type CoreCredentialStore } from '../../../credential-store';
import { INSERT_CAPTURE_CREDENTIAL } from '../../capture-discovery/connect';
import { wireCaptureCredentialHolders } from '../credential-holders';

const REPOSITORY = resolve(__dirname, '../../../../../..');
const WORKER_APP = join(REPOSITORY, 'apps/capture-worker');
const RELAY = join(WORKER_APP, 'build/capture-relay');
const CAMERA_SCRIPT = join(WORKER_APP, 'test-fixtures/rtsp_test_camera.py');
const LISTENER_SCRIPT = join(WORKER_APP, 'test-fixtures/row046_adapter_listener.py');
const OUT = join(REPOSITORY, '.cache/row046-camera-adapter');

const HOST = '127.0.0.1';
const ONVIF_PORT = 8557;
const CAMERA_PORT = 8565;
const SINK_PORT = 8563;
const WORKER_PORTS = '8559,8561';
const SCHEME = ['rt', 'sp'].join('');

/** The test camera's one synthetic account, read from its own file (its rule: tests do not repeat it). */
const cameraSource = readFileSync(CAMERA_SCRIPT, 'utf8');
const constantOf = (name: string): string => new RegExp(`^${name} = "([^"]+)"$`, 'm').exec(cameraSource)?.[1] ?? '';
const ACCOUNT = { username: constantOf('ACCOUNT_USER'), secret: constantOf('ACCOUNT_PASSWORD') } as const;
const WRONG = { username: ACCOUNT.username, secret: ['row46', 'not', 'the', 'synthetic', 'value'].join('-') } as const;

/** The host facts the REAL destination rule is bound to in the refusal cases (as in the reader's own database test). */
const HOST_FACTS: DestinationContext = {
  cameraSubnet: { network: '192.168.50.0', prefixLength: 24 },
  cameraAddresses: [{ address: '192.168.50.1', alias: false }],
  otherInterfaceSubnets: [{ network: '10.20.0.0', prefixLength: 24 }],
  hostAddresses: ['192.168.50.1', '10.20.0.5'],
};

const SESSION_H264 = 'SES-20261013-4601';
const SESSION_HEVC = 'SES-20261013-4602';
const SESSION_SINK = 'SES-20261013-4603';
const SESSION_REFUSED = 'SES-20261013-4604';
const REVEALED = 'CAPTURE_CREDENTIAL_REVEALED';
const DEVICES: readonly CaptureDeviceEntry[] = [
  { id: 'CAM-01', deviceClass: 'CAMERA', label: 'Camera 1', capabilities: ['VIDEO', 'PULL'], profiles: ['H264_1080P', 'HEVC_1080P'] },
  { id: 'CAM-02', deviceClass: 'CAMERA', label: 'Camera 2', capabilities: ['VIDEO', 'PULL'], profiles: ['H264_1080P'] },
];
const CANDIDATE: CameraCandidate = { adapterKind: CaptureAdapterKind.ONVIF_RTSP, host: HOST, serviceAddress: `http://${HOST}:${ONVIF_PORT}/onvif/device_service`, endpointRef: null, vendor: null, model: null, name: null, testable: true, conflict: false };
const TOKEN = 'main.stream:0-a';

const db = useTestDatabase({ template: 'seed', slug: 'row46' });
const dataDir = mkdtempSync(join(tmpdir(), 'dems-row46-db-'));

// ── What must be nowhere ─────────────────────────────────────────────────────────────────────
/** Every text of this run that must stand in no log line, error, argument list or environment. Filled as the run makes them. */
const needles = new Set<string>([ACCOUNT.username, ACCOUNT.secret, WRONG.secret]);
const occurrencesIn = (text: string): number => [...needles].filter((needle) => needle !== '' && text.includes(needle)).length;
const everything = (value: unknown): string => [String(value), JSON.stringify(value) ?? '', inspect(value, { depth: 8, showHidden: true, getters: true }), value instanceof Error ? `${value.message}\n${value.stack ?? ''}` : ''].join('\n');
/** Everything this file was thrown or told, for the last search. */
const kept: unknown[] = [];
const outcomeOf = async (pending: Promise<unknown>): Promise<unknown> => {
  const outcome = await pending.then((value) => value, (error: unknown) => error);
  if (outcome instanceof Error) kept.push(outcome);
  return outcome;
};

// ── Processes of this file ───────────────────────────────────────────────────────────────────
const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms));
const exists = (pid: number | null): boolean => {
  if (pid === null) return false;
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
  const dir = join(OUT, 'cameras');
  mkdirSync(dir, { recursive: true });
  const log = join(dir, `${name}.jsonl`);
  rmSync(log, { force: true });
  const child = spawn('python3', ['-B', CAMERA_SCRIPT, '--port', String(CAMERA_PORT), '--frames', '0', '--event-log', log, '--exit-on-stdin-eof', '--max-seconds', '240', ...extra], { stdio: ['pipe', 'pipe', 'pipe'] });
  started.push(child);
  child.stderr.resume();
  const ready = await lineReader(child)('ready', 60_000);
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
      return { counters: (exit?.counters ?? {}) as Record<string, number>, requests: events.filter((event) => event.event === 'request').map((event) => `${String(event.method)}:${String(event.auth)}`) };
    },
  };
}

interface WorkerListener {
  /** The ingest address of camera 1 of this worker session, as the harness built it for the plan. */
  readonly ingest: string;
  connected(timeoutS: number): Promise<boolean>;
  finish(): Promise<Record<string, unknown>>;
}
async function startWorkerListener(name: string): Promise<WorkerListener> {
  const child = spawn('python3', ['-B', LISTENER_SCRIPT, name], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, M3_PORTS: WORKER_PORTS, E11_OUT: OUT } });
  started.push(child);
  child.stderr.resume();
  const next = lineReader(child);
  const listening = await next('listening', 30_000);
  const ingest = String(listening.ingest);
  needles.add(ingest);
  needles.add(ingest.slice(ingest.lastIndexOf('/') + 1));
  const tell = (line: Record<string, unknown>): void => void child.stdin.write(`${JSON.stringify(line)}\n`);
  return {
    ingest,
    async connected(timeoutS) {
      tell({ cmd: 'wait_connected', timeout: timeoutS });
      return (await next('connected', (timeoutS + 5) * 1_000)).ok === true;
    },
    async finish() {
      tell({ cmd: 'finish' });
      const result = await next('result', 90_000);
      child.stdin.end();
      return result;
    },
  };
}

/** A listener that takes a push: it answers every request of the handshake with success and counts what follows. */
interface Sink {
  connections: number;
  /** The methods it was asked, in order. */
  readonly methods: string[];
  /** How many `ANNOUNCE` request lines named exactly the address in `expect`, byte for byte (BR-07 (3)). */
  announcedExactly: number;
  mediaBytes: number;
  expect: string;
  cutAll(): void;
  stop(): Promise<void>;
}
async function startSink(): Promise<Sink> {
  const sockets = new Set<Socket>();
  const sink: Sink = {
    connections: 0,
    methods: [],
    announcedExactly: 0,
    mediaBytes: 0,
    expect: '',
    cutAll: () => {
      for (const socket of sockets) socket.destroy();
    },
    stop: () =>
      new Promise<void>((done) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => done());
      }),
  };
  const server: Server = createServer((socket) => {
    sink.connections += 1;
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    let held = Buffer.alloc(0);
    socket.on('data', (chunk: Buffer) => {
      held = Buffer.concat([held, chunk]);
      for (;;) {
        if (held.length === 0) return;
        if (held[0] === 0x24) {
          // A media frame on the same connection: a mark, a channel, two bytes of length.
          if (held.length < 4) return;
          const length = held.readUInt16BE(2);
          if (held.length < 4 + length) return;
          sink.mediaBytes += length;
          held = held.subarray(4 + length);
          continue;
        }
        const end = held.indexOf('\r\n\r\n');
        if (end === -1) return;
        const head = held.subarray(0, end).toString('latin1');
        const body = Number(/^content-length:\s*(\d+)/im.exec(head)?.[1] ?? 0);
        if (held.length < end + 4 + body) return;
        held = held.subarray(end + 4 + body);
        const method = head.slice(0, head.indexOf(' '));
        sink.methods.push(method);
        if (method === 'ANNOUNCE' && sink.expect !== '' && head.startsWith(`ANNOUNCE ${sink.expect} RTSP/1.0\r\n`)) sink.announcedExactly += 1;
        const sequence = /^cseq:\s*(\d+)/im.exec(head)?.[1] ?? '0';
        const transport = /^transport:\s*([^\r\n]+)/im.exec(head)?.[1];
        const more = method === 'OPTIONS' ? 'Public: OPTIONS, ANNOUNCE, SETUP, RECORD, TEARDOWN\r\n' : method === 'SETUP' && transport !== undefined ? `Transport: ${transport}\r\nSession: 46\r\n` : 'Session: 46\r\n';
        socket.write(`RTSP/1.0 200 OK\r\nCSeq: ${sequence}\r\n${more}\r\n`);
      }
    });
  });
  await new Promise<void>((done, fail) => {
    server.once('error', fail);
    server.listen({ host: HOST, port: SINK_PORT, exclusive: true }, () => done());
  });
  return sink;
}

/** An ingest address in the form of `capture/ingest-address.ts`, on the sink's port, with 128 bits of this run. */
function sinkIngest(sessionId: string, track: 'video-01' | 'video-02'): string {
  const address = `${SCHEME}://${HOST}:${SINK_PORT}/${sessionId}/${track}/${randomBytes(16).toString('base64url')}`;
  needles.add(address);
  needles.add(address.slice(address.lastIndexOf('/') + 1));
  return address;
}

/** What `ps` shows of a process: its argument list, and its argument list followed by its environment. */
function processListing(pid: number): { readonly args: string; readonly withEnvironment: string } {
  const args = execFileSync('ps', ['-o', 'args=', '-ww', '-p', String(pid)], { encoding: 'utf8' });
  const withEnvironment = execFileSync('ps', ['eww', '-o', 'command=', '-p', String(pid)], { encoding: 'utf8' });
  return { args, withEnvironment };
}

// ── The Core side ────────────────────────────────────────────────────────────────────────────
let core: { readonly app: ReturnType<typeof buildApp>; readonly log: CapturedLog };
let owner: Pool;
let store: CoreCredentialStore;
let errorLog: RecordingErrorLog;
let onvif: OddOnvifDevice;
let adapter: OnvifRelayCameraAdapter;
/** The same adapter code with a reader whose stored-address rule is the PRODUCT'S. */
let guarded: OnvifRelayCameraAdapter;
/** What the ONVIF double answers for the stream address, and for which account. */
const device = { locator: '', account: ACCOUNT as { readonly username: string; readonly secret: string } };
const relayPids: number[] = [];
const relayExits: (number | string)[] = [];
const reports: CameraRelayReport[] = [];
const ends: CameraRelayEnd[] = [];
const notes: CameraRelayNote[] = [];

const reveals = async (): Promise<AuditRow[]> => (await readTrail(owner)).filter((row) => row.type === REVEALED);
const tokenRequests = (): string[] => onvif.requests().filter((request) => request.token || request.authorization !== '').map((request) => request.operation);
const setLocator = (path: string): void => {
  device.locator = `${SCHEME}://${HOST}:${CAMERA_PORT}${path}`;
  needles.add(device.locator);
  needles.add(path);
};
const targetOf = (ingestUrl: string, profile: string, sessionId: string, attempt = 1): CameraSourceTarget => ({ ingestUrl, profile, sessionId, attempt });
const never = (): AbortSignal => new AbortController().signal;

async function storeCredential(deviceId: string, account: { readonly username: string; readonly secret: string }): Promise<void> {
  const sealed = await store.capture.seal(deviceId, account.secret);
  await core.app.db.pool.query(INSERT_CAPTURE_CREDENTIAL, [deviceId, account.username, Buffer.from(sealed.ciphertext), Buffer.from(sealed.nonce), sealed.keyRef, 1_730_000_000_000]);
}

beforeAll(async () => {
  expect(existsSync(RELAY), 'the relay binary of the worker build').toBe(true);
  expect(ACCOUNT.username.length > 0 && ACCOUNT.secret.length > 0).toBe(true);
  owner = db.ownerPool();
  const log = captureLog();
  const app = buildApp({ config: unitTestConfig({ database: db.runtime, dataDir, logLevel: 'trace' }), logStream: log.stream });
  db.onCleanup(() => app.close());
  await app.ready();
  core = { app, log };
  store = createCredentialStore({ root: join(dataDir, 'credential-store') });
  errorLog = recordingErrorLog();
  /** The readers as the production composition will wire them: the real pipeline, store and pool; only the stored-address rule differs. */
  const wire = (storedAddress: Parameters<typeof wireCaptureCredentialHolders>[0]['storedAddress']): ReturnType<typeof wireCaptureCredentialHolders> =>
    wireCaptureCredentialHolders({
      unit: (label, work) => app.pipeline.run(label, work),
      open: (deviceId, sealed) => store.capture.open(deviceId, sealed),
      errorLog,
      query: (text, values) => app.db.read('row46.credentialDevice', (pool) => pool.query(text, values)),
      storedAddress,
    });
  // The doubles live on loopback: the reader of the working cases gets the test-only rule of `test/support` (AD-02 (2)).
  const holders = wire(loopbackStoredCameraAddress);
  // The refusal cases get the product's rule, bound to the host facts above. No permissive value is involved.
  const real = wire((address, port) => decideDestination({ purpose: DestinationPurpose.STORED_CAMERA, address, ...(port === undefined ? {} : { port }) }, HOST_FACTS));

  await owner.query("UPDATE public.capture_devices SET adapter_kind = 'ONVIF_RTSP', address = $1 WHERE id IN ('CAM-01', 'CAM-02')", [`${HOST}:${ONVIF_PORT}`]);
  await storeCredential('CAM-01', ACCOUNT);
  await storeCredential('CAM-02', WRONG);

  onvif = createOddOnvifDevice(ONVIF_PORT, (request: OddDeviceRequest): OddDeviceReply => {
    if (request.operation === 'GetSystemDateAndTime') return dateAnswer();
    if (request.operation === 'GetServices') return servicesAnswer(`http://${HOST}:${ONVIF_PORT}`);
    if (!tokenHolds(request, device.account)) return notAuthorizedFault(400);
    return streamAnswer(device.locator);
  });
  await onvif.start();
  db.onCleanup(() => onvif.stop());

  const timers = createSystemTimers();
  // The real door, watched: which processes it started. Nothing of its options is kept.
  const door: ProductionDoor = (options) => {
    const child = startProductionProcess(options);
    if (child.pid !== null) relayPids.push(child.pid);
    // How each relay ended: its exit code (0: by its order to stop), or the signal that ended it.
    void child.ended.then((exit) => relayExits.push(exit.exitCode ?? exit.signal ?? 'none'));
    return child;
  };
  const dependencies = {
    door,
    relayProgram: RELAY,
    timers,
    locator: createOnvifStreamLocator({ timers }),
    stream: async (deviceId: string, profile: string) => (DEVICES.some((entry) => entry.id === deviceId && entry.profiles.includes(profile)) ? { candidate: CANDIDATE, onvifProfileToken: TOKEN } : null),
    relayEnded: (end: CameraRelayEnd) => ends.push(end),
    tell: (note: CameraRelayNote) => notes.push(note),
  };
  adapter = createOnvifRelayCameraAdapter(DEVICES, { ...dependencies, credentials: holders.cameraAdapter });
  guarded = createOnvifRelayCameraAdapter(DEVICES, { ...dependencies, credentials: real.cameraAdapter });
  adapter.relayReports.subscribe((report) => reports.push(report));
  guarded.relayReports.subscribe((report) => reports.push(report));
}, 120_000);

afterAll(async () => {
  for (const child of started) if (child.exitCode === null) child.kill('SIGKILL');
  for (const pid of relayPids) {
    if (exists(pid)) process.kill(pid, 'SIGKILL');
  }
  rmSync(dataDir, { recursive: true, force: true });
});

/** One camera through the adapter into a session of the real worker; the facts of the run. */
async function recordedThroughTheWorker(codec: 'h264' | 'hevc', profile: string, sessionId: string): Promise<{ readonly result: Record<string, unknown>; readonly listing: { args: string; withEnvironment: string }; readonly pid: number; readonly camera: Awaited<ReturnType<TestCamera['end']>>; readonly openedInMs: number; readonly closedInMs: number }> {
  const camera = await startCamera(codec, ['--codec', codec]);
  setLocator(camera.path);
  const listener = await startWorkerListener(codec);
  const before = { reveals: (await reveals()).length, tokens: tokenRequests().length, relays: relayPids.length, reports: reports.length };
  const openAt = Date.now();
  const handle = (await adapter.openSource('CAM-01', targetOf(listener.ingest, profile, sessionId), never())) as SourceHandle;
  const openedInMs = Date.now() - openAt;
  expect(handle.deviceId).toBe('CAM-01');
  expect(relayPids.length - before.relays).toBe(1);
  const pid = relayPids.at(-1) as number;
  expect(await listener.connected(10)).toBe(true);
  const listing = processListing(pid);
  // Some seconds of pictures, then the close: the relay ends by its order to stop.
  await sleep(4_000);
  const closeAt = Date.now();
  await handle.close();
  const closedInMs = Date.now() - closeAt;
  expect(exists(pid)).toBe(false);
  // It ended by its order to stop, not by a signal and not by itself.
  await sleep(100);
  expect(relayExits.at(-1)).toBe(0);
  const result = await listener.finish();
  const cameraFacts = await camera.end();
  // One reveal with its entry, for this session; one request to the ONVIF device that carried the credential; one report.
  const revealed = (await reveals()).slice(before.reveals);
  expect(revealed).toHaveLength(1);
  expect(revealed[0]).toMatchObject({ sessionId, deviceId: 'CAM-01', details: { deviceId: 'CAM-01', reason: 'SESSION_OPEN' } });
  expect(Object.keys(revealed[0]?.details ?? {}).sort()).toEqual(['deviceId', 'reason']);
  expect(tokenRequests().slice(before.tokens)).toEqual(['GetStreamUri']);
  expect(reports.slice(before.reports)).toEqual([{ sessionId, deviceId: 'CAM-01', attempt: 1 }]);
  return { result, listing, pid, camera: cameraFacts, openedInMs, closedInMs };
}

describe('T-2: a camera through the adapter, the real relay and the real worker', () => {
  it('H.264: the open resolves, video reaches the worker at the session\'s address as a decodable file; one audited reveal; nothing of the start message in the process listing', async () => {
    const run = await recordedThroughTheWorker('h264', 'H264_1080P', SESSION_H264);
    console.info(`[row46] h264: opened in ${run.openedInMs} ms, closed in ${run.closedInMs} ms, ${JSON.stringify({ ...run.result, run_folder: undefined })}`);
    expect(run.result).toMatchObject({ ingest_connected: 1, worker_codec: 'h264', file_codec: 'h264', file_size: '1920x1080', decode_error_lines: 0, gate_refusals: 0, ingest_elements_in_worker_output: 0, control_recorded: true, leftovers: 0 });
    expect(Number(run.result.file_frames)).toBeGreaterThanOrEqual(50);
    // The relay was started with its program and nothing else: one word, and no text of the start message anywhere in the listing.
    expect(run.listing.args.trim().split(/\s+/)).toHaveLength(1);
    expect(occurrencesIn(run.listing.args)).toBe(0);
    expect(occurrencesIn(run.listing.withEnvironment)).toBe(0);
    // The camera was answered with Digest only.
    expect(run.camera.counters.auth_basic ?? 0).toBe(0);
    expect(run.camera.counters.auth_digest_ok ?? 0).toBeGreaterThanOrEqual(1);
    expect(run.closedInMs).toBeLessThan(3_000);
  }, 180_000);

  it('HEVC: the same path with the second codec', async () => {
    const run = await recordedThroughTheWorker('hevc', 'HEVC_1080P', SESSION_HEVC);
    console.info(`[row46] hevc: opened in ${run.openedInMs} ms, closed in ${run.closedInMs} ms, ${JSON.stringify({ ...run.result, run_folder: undefined })}`);
    expect(run.result).toMatchObject({ ingest_connected: 1, worker_codec: 'hevc', file_codec: 'hevc', file_size: '1920x1080', decode_error_lines: 0, gate_refusals: 0, ingest_elements_in_worker_output: 0, control_recorded: true, leftovers: 0 });
    expect(Number(run.result.file_frames)).toBeGreaterThanOrEqual(50);
    expect(run.listing.args.trim().split(/\s+/)).toHaveLength(1);
    expect(occurrencesIn(run.listing.withEnvironment)).toBe(0);
    expect(run.camera.counters.auth_basic ?? 0).toBe(0);
  }, 180_000);
});

describe('T-2: refusals, the close and the end of a relay, against the sink', () => {
  let sink: Sink;
  let camera: TestCamera;

  beforeAll(async () => {
    sink = await startSink();
    camera = await startCamera('sink-h264', ['--codec', 'h264']);
    setLocator(camera.path);
    device.account = ACCOUNT;
  }, 90_000);

  afterAll(async () => {
    await sink.stop();
  });

  it('20 open/close cycles: every open announces the session\'s address byte for byte, every close ends its relay, no process is left; 20 reveals, each audited', async () => {
    const before = { reveals: (await reveals()).length, relays: relayPids.length, connections: sink.connections, exact: sink.announcedExactly, reports: reports.length, exits: relayExits.length, ends: ends.length, media: sink.mediaBytes };
    const closeMs: number[] = [];
    for (let cycle = 1; cycle <= 20; cycle += 1) {
      const ingest = sinkIngest(SESSION_SINK, 'video-01');
      sink.expect = ingest;
      const handle = (await adapter.openSource('CAM-01', targetOf(ingest, 'H264_1080P', SESSION_SINK, cycle), never())) as SourceHandle;
      const at = Date.now();
      await handle.close();
      closeMs.push(Date.now() - at);
      expect(exists(relayPids.at(-1) ?? null), `cycle ${cycle}`).toBe(false);
    }
    const pids = relayPids.slice(before.relays);
    expect(pids).toHaveLength(20);
    expect(new Set(pids).size).toBe(20);
    expect(pids.filter((pid) => exists(pid))).toEqual([]);
    expect(adapter.counts().live).toBe(0);
    expect(sink.connections - before.connections).toBe(20);
    expect(sink.announcedExactly - before.exact).toBe(20);
    expect((await reveals()).length - before.reveals).toBe(20);
    // Each open reported once, with the attempt it was opened for.
    expect(reports.slice(before.reports).map((report) => report.attempt)).toEqual(Array.from({ length: 20 }, (_unused, index) => index + 1));
    // Each relay ended BY ITS ORDER TO STOP (exit 0), not by itself and not by a signal: none was reported as a loss, none was killed.
    await sleep(200);
    const exits = relayExits.slice(before.exits);
    expect(exits).toEqual(Array.from({ length: 20 }, () => 0));
    expect(ends.length).toBe(before.ends);
    expect(notes).toEqual([]);
    console.info(`[row46] 20 cycles: close times ms min ${Math.min(...closeMs)} max ${Math.max(...closeMs)}; exit codes ${JSON.stringify([...new Set(exits)])}; media bytes at the sink ${sink.mediaBytes - before.media}; relays left 0`);
    expect(Math.max(...closeMs)).toBeLessThan(3_000);
    expect(sink.mediaBytes - before.media).toBeGreaterThan(0);
  }, 240_000);

  it('a relay that dies after its open is reported ONCE, with its named cause; the close after it is quiet', async () => {
    const ingest = sinkIngest(SESSION_SINK, 'video-02');
    sink.expect = ingest;
    const before = ends.length;
    const handle = (await adapter.openSource('CAM-01', targetOf(ingest, 'H264_1080P', SESSION_SINK, 21), never())) as SourceHandle;
    const pid = relayPids.at(-1) as number;
    // The listener goes away under the push.
    sink.cutAll();
    for (let waited = 0; waited < 100 && ends.length === before; waited += 1) await sleep(100);
    expect(ends.slice(before)).toEqual([{ sessionId: SESSION_SINK, deviceId: 'CAM-01', attempt: 21, profile: 'H264_1080P', code: CameraOpenRefusal.INGEST_LOST, reason: 'INGEST_LOST' }]);
    await handle.close();
    await sleep(300);
    expect(ends.length - before).toBe(1);
    expect(exists(pid)).toBe(false);
    expect(adapter.counts().live).toBe(0);
  }, 60_000);

  it('no profile in the target: refused `CAPTURE_PROFILE_UNKNOWN`, 0 reveals, 0 requests, 0 relays; a profile the device has no stream for likewise', async () => {
    const before = { reveals: (await reveals()).length, requests: onvif.requests().length, relays: relayPids.length, connections: sink.connections };
    const ingest = sinkIngest(SESSION_REFUSED, 'video-01');
    expect(await outcomeOf(adapter.openSource('CAM-01', { ingestUrl: ingest, sessionId: SESSION_REFUSED, attempt: 1 }, never()))).toMatchObject({ name: 'CaptureAdapterError', code: 'CAPTURE_PROFILE_UNKNOWN', deviceId: 'CAM-01' });
    expect(await outcomeOf(adapter.openSource('CAM-01', targetOf(ingest, 'H264_720P', SESSION_REFUSED), never()))).toMatchObject({ name: 'CaptureAdapterError', code: 'CAPTURE_PROFILE_UNKNOWN' });
    expect({ reveals: (await reveals()).length, requests: onvif.requests().length, relays: relayPids.length, connections: sink.connections }).toEqual(before);
  }, 30_000);

  it('a stored loopback address and a stored public address: refused by the reader\'s gate BEFORE any reveal - 0 entries, 0 requests, 0 relays', async () => {
    const before = { reveals: (await reveals()).length, requests: onvif.requests().length, relays: relayPids.length, connections: sink.connections };
    const ingest = sinkIngest(SESSION_REFUSED, 'video-01');
    // CAM-01 is stored at the loopback address of the doubles: the product's rule refuses it.
    const loopback = await outcomeOf(guarded.openSource('CAM-01', targetOf(ingest, 'H264_1080P', SESSION_REFUSED), never()));
    expect(loopback).toMatchObject({ name: 'CameraOpenError', code: CameraOpenRefusal.CREDENTIAL_NOT_READ, deviceId: 'CAM-01', reason: 'CAPTURE_CREDENTIAL_ADDRESS_REFUSED' });
    // A public address, an address of the host itself and a link-local one, each stored for the camera on this clone.
    for (const address of ['8.8.8.8', '192.168.50.1', '169.254.10.20:80']) {
      await owner.query("UPDATE public.capture_devices SET address = $1 WHERE id = 'CAM-01'", [address]);
      const refused = await outcomeOf(guarded.openSource('CAM-01', targetOf(ingest, 'H264_1080P', SESSION_REFUSED), never()));
      expect(refused, address).toMatchObject({ code: CameraOpenRefusal.CREDENTIAL_NOT_READ, reason: 'CAPTURE_CREDENTIAL_ADDRESS_REFUSED' });
    }
    await owner.query("UPDATE public.capture_devices SET address = $1 WHERE id = 'CAM-01'", [`${HOST}:${ONVIF_PORT}`]);
    expect({ reveals: (await reveals()).length, requests: onvif.requests().length, relays: relayPids.length, connections: sink.connections }).toEqual(before);
    expect(guarded.counts().live).toBe(0);
    // Control: the same rule admits an address of the camera subnet (the reveal then happens; the camera there does not exist).
    await owner.query("UPDATE public.capture_devices SET address = '192.168.50.21' WHERE id = 'CAM-02'");
    const admitted = await outcomeOf(guarded.openSource('CAM-02', targetOf(ingest, 'H264_1080P', SESSION_REFUSED), never()));
    await owner.query("UPDATE public.capture_devices SET address = $1 WHERE id = 'CAM-02'", [`${HOST}:${ONVIF_PORT}`]);
    expect((admitted as { reason?: string }).reason).not.toBe('CAPTURE_CREDENTIAL_ADDRESS_REFUSED');
    expect((await reveals()).length - before.reveals).toBe(1);
  }, 60_000);

  it('the read is OUTSIDE any unit of work: an open called from inside one is refused by the reader, with no reveal, no entry and no relay', async () => {
    const before = { reveals: (await reveals()).length, relays: relayPids.length, errors: errorLog.entries.length };
    const ingest = sinkIngest(SESSION_REFUSED, 'video-01');
    // What a caller that moved the open inside the unit of the session start would do.
    const inside = await core.app.pipeline.run('row46.openInsideAUnit', async () => outcomeOf(adapter.openSource('CAM-01', targetOf(ingest, 'H264_1080P', SESSION_REFUSED), never())));
    expect(inside).toMatchObject({ name: 'CameraOpenError', code: CameraOpenRefusal.CREDENTIAL_NOT_READ, reason: 'CAPTURE_CREDENTIAL_REVEAL_FAILED' });
    expect((await reveals()).length).toBe(before.reveals);
    expect(relayPids.length).toBe(before.relays);
    expect(errorLog.entries.slice(before.errors).map((entry) => (entry.context as { causeCode?: string } | undefined)?.causeCode)).toEqual(['PIPELINE_REENTRANT']);
    // Control: the same open outside a unit comes up.
    sink.expect = ingest;
    const handle = (await adapter.openSource('CAM-01', targetOf(ingest, 'H264_1080P', SESSION_REFUSED), never())) as SourceHandle;
    await handle.close();
    expect((await reveals()).length - before.reveals).toBe(1);
  }, 60_000);

  it('a wrong password: refused by the ONVIF read with 0 relays; and, where the ONVIF device takes it, refused by the camera through the relay - nothing is pushed', async () => {
    const stats = await (async () => {
      const before = { relays: relayPids.length, connections: sink.connections, tokens: tokenRequests().length };
      const ingest = sinkIngest(SESSION_REFUSED, 'video-02');
      // (1) CAM-02 holds the wrong secret; the ONVIF device asks for the right one: one refused request, final.
      const atOnvif = await outcomeOf(adapter.openSource('CAM-02', targetOf(ingest, 'H264_1080P', SESSION_REFUSED), never()));
      expect(atOnvif).toMatchObject({ name: 'CameraOpenError', code: CameraOpenRefusal.AUTHENTICATION_REFUSED, deviceId: 'CAM-02' });
      expect(relayPids.length).toBe(before.relays);
      expect(tokenRequests().length - before.tokens).toBe(1);
      // (2) The ONVIF device takes the stored account; the camera's stream does not: the relay ends with its code.
      device.account = WRONG;
      const atCamera = await outcomeOf(adapter.openSource('CAM-02', targetOf(ingest, 'H264_1080P', SESSION_REFUSED), never()));
      device.account = ACCOUNT;
      expect(atCamera).toMatchObject({ name: 'CameraOpenError', code: CameraOpenRefusal.AUTHENTICATION_REFUSED, deviceId: 'CAM-02', reason: 'AUTH_REFUSED' });
      expect(relayPids.length - before.relays).toBe(1);
      expect(exists(relayPids.at(-1) ?? null)).toBe(false);
      // Nothing was pushed: the listener saw no connection.
      expect(sink.connections).toBe(before.connections);
      return camera.end();
    })();
    // The camera counted ONE refused Digest answer and no Basic one.
    expect(stats.counters.auth_digest_refused ?? 0).toBe(1);
    expect(stats.counters.auth_basic ?? 0).toBe(0);
    expect(adapter.counts().live).toBe(0);
  }, 90_000);

  it('a Basic-only camera: refused `CAPTURE_CAMERA_AUTH_SCHEME_REFUSED`; the camera\'s `auth_basic` counter is 0 and nothing is pushed', async () => {
    const basic = await startCamera('basic-only', ['--codec', 'h264', '--challenge', 'basic']);
    setLocator(basic.path);
    const before = { relays: relayPids.length, connections: sink.connections };
    const ingest = sinkIngest(SESSION_REFUSED, 'video-01');
    const refused = await outcomeOf(adapter.openSource('CAM-01', targetOf(ingest, 'H264_1080P', SESSION_REFUSED), never()));
    expect(refused).toMatchObject({ name: 'CameraOpenError', code: CameraOpenRefusal.AUTH_SCHEME_REFUSED, deviceId: 'CAM-01', reason: 'AUTH_SCHEME_NOT_ALLOWED' });
    expect(relayPids.length - before.relays).toBe(1);
    expect(exists(relayPids.at(-1) ?? null)).toBe(false);
    expect(sink.connections).toBe(before.connections);
    const stats = await basic.end();
    expect(stats.counters.auth_basic ?? 0).toBe(0);
    expect(stats.counters.auth_basic_account_match ?? 0).toBe(0);
    // Every request the camera received was without any authorization.
    expect(stats.requests.length).toBeGreaterThanOrEqual(1);
    expect(stats.requests.every((request) => request.endsWith(':none'))).toBe(true);
  }, 90_000);
});

describe('T-2: nothing of a credential, a locator or an ingest address is written anywhere', () => {
  it('the log sink, the persistent error log, the audit trail, every error, report, note and end of this file: 0 occurrences; no relay of this file is left', async () => {
    expect(needles.size).toBeGreaterThan(40);
    const trail = await readTrail(owner);
    const places: Record<string, string> = {
      log: core.log.text(),
      errorLog: JSON.stringify(errorLog.entries),
      audit: JSON.stringify(trail),
      thrown: kept.map(everything).join('\n'),
      told: everything({ reports, ends, notes }),
    };
    const found = Object.fromEntries(Object.entries(places).map(([place, text]) => [place, occurrencesIn(text)]));
    console.info(`[row46] occurrences of ${needles.size} texts (account, secret, locators, paths, ingest addresses and their last elements): ${JSON.stringify(found)}; relays started ${relayPids.length}, alive ${relayPids.filter((pid) => exists(pid)).length}`);
    expect(found).toEqual({ log: 0, errorLog: 0, audit: 0, thrown: 0, told: 0 });
    // Control: the search does find a text that is there.
    expect([...needles].some((needle) => `x ${needle} y`.includes(needle))).toBe(true);
    expect(JSON.stringify(trail).includes(REVEALED)).toBe(true);
    expect(relayPids.filter((pid) => exists(pid))).toEqual([]);
    expect(adapter.counts().live + guarded.counts().live).toBe(0);
    // Reports dropped as superseded in this file: none was expected, none happened.
    expect(notes.filter((note) => note.code !== 'CAPTURE_RELAY_REPORT_SUPERSEDED')).toEqual([]);
  }, 30_000);
});
