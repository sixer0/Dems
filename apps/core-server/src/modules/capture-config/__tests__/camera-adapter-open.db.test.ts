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
//   - the camera: `apps/capture-worker/test-fixtures/rtsp_test_camera.py` on 8570 (C33; row T3: this
//     file's own port), started by this file (H.264, HEVC, and its Basic-only mode);
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
// RUN: sandbox off, under the database lock (a case takes the heavy-host lock itself - row T3; a run started under it
// is not asked again), with a core-file limit of 0 (the door refuses otherwise):
//   (ulimit -c 0; /usr/bin/lockf -k -t 1800 ../../.locks/db-migrate.lock \
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
import { HEAVY_HOST_LOCK_WAIT_MS, HEAVY_HOST_LOCK_WAIT_S as HEAVY_LOCK_WAIT_S, takeHeavyHostLock, underHeavyHostLock } from '../../../../test/support/heavy-host-lock';
import { createOddOnvifDevice, dateAnswer, notAuthorizedFault, servicesAnswer, streamAnswer, tokenHolds, type OddDeviceReply, type OddDeviceRequest, type OddOnvifDevice } from '../../../../test/support/onvif-odd-device';
import { loopbackStoredCameraAddress } from '../../../../test/support/stored-camera-address';
import { buildApp } from '../../../app';
import { CaptureAdapterKind } from '../../../capture/adapters/kinds';
import { startProductionProcess, type ProductionDoor } from '../../../capture/adapters/production-door';
import type { CameraCandidate, CameraSourceTarget, CaptureDeviceEntry, SourceHandle } from '../../../capture/adapters/types';
import { CameraOpenRefusal, createOnvifRelayCameraAdapter, type CameraRelayEnd, type CameraRelayNote, type CameraRelayReport, type OnvifRelayCameraAdapter } from '../../../capture/adapters/camera/onvif-relay';
import { createCameraWatch } from '../../../capture/adapters/camera/camera-watch';
import { createOnvifStreamLocator } from '../../../capture/adapters/camera/onvif-session';
import { watchFaultSinkOf } from '../../../capture/fence/production-parts';
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
// Row T3 (review 060c T-01; C61 (4)): THIS FILE'S OWN PORTS. The ONVIF device keeps 8557 and is its only user now
// (`stream-test.db.test.ts` moved to 8575, `minted-code.db.test.ts` to 8576, `adopted-camera-test.db.test.ts` is on
// 8555; the list of `test/support/onvif-odd-device.ts` holds one port per file). The camera moved from 8565, which
// three more files named, to 8570. The sink stays on 8563 and the worker of `row046_adapter_listener.py` on 8559 and
// 8561: ports of the worker's range, used under the heavy-host lock only.
const ONVIF_PORT = 8557;
const CAMERA_PORT = 8570;
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
  // R-FLEX NW-C1 (row 136): the eligible interfaces the global STORED_CAMERA rule reads; without them it is NOT_CONFIGURED (RF-N7, RM-N4).
  interfaceSubnets: [
    { name: 'eth1', address: '192.168.50.1', network: '192.168.50.0', prefixLength: 24 },
    { name: 'eth0', address: '10.20.0.5', network: '10.20.0.0', prefixLength: 24 },
  ],
  hostAddresses: ['192.168.50.1', '10.20.0.5'],
};

const SESSION_H264 = 'SES-20261013-4601';
const SESSION_HEVC = 'SES-20261013-4602';
const SESSION_SINK = 'SES-20261013-4603';
const SESSION_REFUSED = 'SES-20261013-4604';
/** Finding F3-01: the session of the scripted loss inside a session. */
const SESSION_LOSS = 'SES-20261013-4605';
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

// ── The heavy-host lock (integration pass I-9a; row T3) ──────────────────────────────────────
// The helper that stood here is `test/support/heavy-host-lock.ts` now, one copy for the four database files that start
// a camera double. Pass I-9a put the two cases that start the REAL WORKER under the lock; row T3 (review 060c T-01)
// puts EVERY case that starts the relay or the test camera under it: the sink block holds it from its `beforeAll` to
// its `afterAll` (its sink is on 8563, a port of the worker's range, and its camera stands for the whole block).

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
      // Row T3 (review 060c T-04): a counter that is absent reads as 0 below ("no Basic request at the camera"). That is
      // only true of a camera that WROTE its counters: without its `exit` line nothing was counted.
      if (exit === undefined || typeof exit.counters !== 'object' || exit.counters === null) throw new Error(`the test camera "${name}" left no exit line with its counters: nothing it did not do is proven`);
      return { counters: exit.counters as Record<string, number>, requests: events.filter((event) => event.event === 'request').map((event) => `${String(event.method)}:${String(event.auth)}`) };
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

/**
 * Row T3 (review 060c X-07; survivor 17 of its section 6). "Nothing of the session in the relay's environment" is read
 * from `processListing(pid).withEnvironment`. The relay's environment is EMPTY by design, so that listing never
 * differs from the argument list - and nothing showed that this `ps` displays an environment at all: on a host where
 * it does not, a session text in the relay's environment would pass. THE CONTROL: a process of this file with ONE
 * marker variable, read by the same function; the marker must be in the environment listing and not in the arguments.
 *
 * MEASURED ON THIS MAC (macOS 27.0.1, row T3): `ps eww` shows NO environment for a program of the SYSTEM (`/bin/sleep`
 * with a marker variable: the listing is its arguments and nothing else) and DOES show it for a program that is not
 * the system's (Node, Python). The relay is a program of this repository's build, so the control is one of that
 * class: the Node program that runs this test. A control of `/bin/sleep` fails here - the reviewer's doubt was right
 * for that class of program.
 */
function listingShowsAnEnvironment(): { readonly inEnvironmentListing: boolean; readonly inArguments: boolean } {
  const marker = `ROW_T3_MARKER_${randomBytes(8).toString('hex')}`;
  const control = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 20000)'], { stdio: ['pipe', 'pipe', 'pipe'], env: { ROW_T3_CONTROL: marker } });
  started.push(control);
  try {
    if (control.pid === undefined) return { inEnvironmentListing: false, inArguments: false };
    const listing = processListing(control.pid);
    return { inEnvironmentListing: listing.withEnvironment.includes(marker), inArguments: listing.args.includes(marker) };
  } finally {
    control.kill('SIGKILL');
  }
}

// ── The Core side ────────────────────────────────────────────────────────────────────────────
let core: { readonly app: ReturnType<typeof buildApp>; readonly log: CapturedLog };
let owner: Pool;
let store: CoreCredentialStore;
let errorLog: RecordingErrorLog;
let onvif: OddOnvifDevice;
let adapter: OnvifRelayCameraAdapter;
/** Finding F3-01: one more adapter over the SAME dependencies as `adapter`, with the loss callback of the case that asks for it. */
let adapterWith: (relayEnded: (end: CameraRelayEnd) => void) => OnvifRelayCameraAdapter;
/** The same adapter code with a reader whose stored-address rule is the PRODUCT'S. */
let guarded: OnvifRelayCameraAdapter;
/**
 * Task 4 row 143 (AD-02 (1)): the adapter with the PRODUCT'S rule as ITS OWN dependency, the product's reader behind
 * it, and the stored address read from the clone's row for each open, as the production composition reads it.
 */
let ruled: OnvifRelayCameraAdapter;
/** How often the locator double of `ruled` was asked: 0 for every refused address. */
let ruledLocates = 0;
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
    // Row 143: the adapter's own judgement of the stored address. The doubles live on loopback, so these two adapters
    // get the test-only rule of `test/support` (AD-02 (2)); `guarded` keeps showing the READER'S gate behind it.
    storedAddress: loopbackStoredCameraAddress,
    relayEnded: (end: CameraRelayEnd) => ends.push(end),
    tell: (note: CameraRelayNote) => notes.push(note),
  };
  adapter = createOnvifRelayCameraAdapter(DEVICES, { ...dependencies, credentials: holders.cameraAdapter });
  adapterWith = (relayEnded) => createOnvifRelayCameraAdapter(DEVICES, { ...dependencies, credentials: holders.cameraAdapter, relayEnded });
  guarded = createOnvifRelayCameraAdapter(DEVICES, { ...dependencies, credentials: real.cameraAdapter });
  ruled = createOnvifRelayCameraAdapter(DEVICES, {
    ...dependencies,
    credentials: real.cameraAdapter,
    storedAddress: (address, port) => decideDestination({ purpose: DestinationPurpose.STORED_CAMERA, address, ...(port === undefined ? {} : { port }) }, HOST_FACTS),
    // NOTHING OF THIS ADAPTER DIALS: its control case stores an address of a camera subnet that is not this Mac's, and
    // no request may leave for it. The locator read is a double that counts and answers "no camera there".
    locator: {
      locate: async () => {
        ruledLocates += 1;
        return { outcome: 'UNREACHABLE', reason: null, locator: null, reads: [], credentialRequests: 0, rejectedCredentialRequests: 0 } as unknown as Awaited<ReturnType<ReturnType<typeof createOnvifStreamLocator>['locate']>>;
      },
    },
    // The stored address of the row, now: `host` or `host:port`, the two forms adoption stores.
    stream: async (deviceId: string, profile: string) => {
      if (!DEVICES.some((entry) => entry.id === deviceId && entry.profiles.includes(profile))) return null;
      const { rows } = await app.db.read('row143.storedAddress', (pool) => pool.query<{ address: string | null }>('SELECT address FROM public.capture_devices WHERE id = $1', [deviceId]));
      const stored = rows[0]?.address ?? '';
      const host = stored.replace(/:[0-9]+$/, '');
      return { candidate: { ...CANDIDATE, host, serviceAddress: `http://${stored}/onvif/device_service` }, onvifProfileToken: TOKEN };
    },
  });
  adapter.relayReports.subscribe((report) => reports.push(report));
  guarded.relayReports.subscribe((report) => reports.push(report));
  ruled.relayReports.subscribe((report) => reports.push(report));
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
    const run = await underHeavyHostLock(() => recordedThroughTheWorker('h264', 'H264_1080P', SESSION_H264));
    console.info(`[row46] h264: opened in ${run.openedInMs} ms, closed in ${run.closedInMs} ms, ${JSON.stringify({ ...run.result, run_folder: undefined })}`);
    expect(run.result).toMatchObject({ ingest_connected: 1, worker_codec: 'h264', file_codec: 'h264', file_size: '1920x1080', decode_error_lines: 0, gate_refusals: 0, ingest_elements_in_worker_output: 0, control_recorded: true, leftovers: 0 });
    expect(Number(run.result.file_frames)).toBeGreaterThanOrEqual(50);
    // The relay was started with its program and nothing else: one word, and no text of the start message anywhere in the listing.
    expect(run.listing.args.trim().split(/\s+/)).toHaveLength(1);
    expect(occurrencesIn(run.listing.args)).toBe(0);
    expect(occurrencesIn(run.listing.withEnvironment)).toBe(0);
    // Row T3 (X-07): the listing the line above read DOES show an environment on this host - a control process's one
    // marker variable is in it (and not in its arguments). And the relay's listing is its program and NOTHING else: no
    // `NAME=value` follows it, so its environment is empty as the door promises.
    expect(listingShowsAnEnvironment()).toEqual({ inEnvironmentListing: true, inArguments: false });
    expect(run.listing.withEnvironment.trim()).toBe(run.listing.args.trim());
    // The camera was answered with Digest only.
    expect(run.camera.counters.auth_basic ?? 0).toBe(0);
    expect(run.camera.counters.auth_digest_ok ?? 0).toBeGreaterThanOrEqual(1);
    expect(run.closedInMs).toBeLessThan(3_000);
  }, 180_000 + HEAVY_LOCK_WAIT_S * 1_000);

  it('HEVC: the same path with the second codec', async () => {
    const run = await underHeavyHostLock(() => recordedThroughTheWorker('hevc', 'HEVC_1080P', SESSION_HEVC));
    console.info(`[row46] hevc: opened in ${run.openedInMs} ms, closed in ${run.closedInMs} ms, ${JSON.stringify({ ...run.result, run_folder: undefined })}`);
    expect(run.result).toMatchObject({ ingest_connected: 1, worker_codec: 'hevc', file_codec: 'hevc', file_size: '1920x1080', decode_error_lines: 0, gate_refusals: 0, ingest_elements_in_worker_output: 0, control_recorded: true, leftovers: 0 });
    expect(Number(run.result.file_frames)).toBeGreaterThanOrEqual(50);
    expect(run.listing.args.trim().split(/\s+/)).toHaveLength(1);
    expect(occurrencesIn(run.listing.withEnvironment)).toBe(0);
    // Row T3 (X-07): as in the H.264 case - the listing shows an environment on this host, and the relay has none.
    expect(listingShowsAnEnvironment()).toEqual({ inEnvironmentListing: true, inArguments: false });
    expect(run.listing.withEnvironment.trim()).toBe(run.listing.args.trim());
    expect(run.camera.counters.auth_basic ?? 0).toBe(0);
  }, 180_000 + HEAVY_LOCK_WAIT_S * 1_000);
});

describe('T-2: refusals, the close and the end of a relay, against the sink', () => {
  let sink: Sink;
  let camera: TestCamera;
  /** Row T3: the block holds the heavy-host lock while its sink (8563) and its camera (8570) stand. */
  let releaseHeavyHost: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    releaseHeavyHost = await takeHeavyHostLock();
    sink = await startSink();
    camera = await startCamera('sink-h264', ['--codec', 'h264']);
    setLocator(camera.path);
    device.account = ACCOUNT;
  }, 90_000 + HEAVY_HOST_LOCK_WAIT_MS);

  afterAll(async () => {
    try {
      // (Not set when the lock or the sink's port was not obtained.)
      await (sink as Sink | undefined)?.stop();
      // A camera of this block that a failed case left: ended here, before the lock is let go.
      for (const child of started) if (child.exitCode === null) child.kill('SIGKILL');
    } finally {
      await releaseHeavyHost?.();
    }
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

  // Task 4 row 143 (GATE CONDITION AD-02): the adapter ITSELF holds the stored address to the rule, at every open,
  // BEFORE the reader is called. The reader's gate above writes one error-log code per refusal; here the reader is
  // not reached at all, so the error log does not move either.
  it('row 143: the adapter\'s own rule on the STORED address - the five refused classes and three more, on PostgreSQL: the named code, 0 reveal entries, 0 reader calls, 0 requests, 0 relay starts', async () => {
    const before = { reveals: (await reveals()).length, requests: onvif.requests().length, relays: relayPids.length, connections: sink.connections, errors: errorLog.entries.length, trail: (await readTrail(owner)).length };
    const ingest = sinkIngest(SESSION_REFUSED, 'video-01');
    const classes: readonly (readonly [string, string])[] = [
      // CAM-01 as the clone stores it: the loopback address of the doubles.
      [`${HOST}:${ONVIF_PORT}`, 'LOOPBACK'],
      ['127.0.0.1', 'LOOPBACK'],
      ['0.0.0.0', 'UNSPECIFIED'],
      ['169.254.10.20:80', 'LINK_LOCAL'],
      ['224.0.0.251', 'MULTICAST'],
      ['192.168.50.1', 'HOST_ADDRESS'],
      ['8.8.8.8', 'PUBLIC_ADDRESS'],
      // R-FLEX (row 136): off-link is NW-R1 NO_SOURCE_INTERFACE, no longer OUTSIDE_CAMERA_SUBNET (RM-N2); 10.20.0.77 on the
      // office interface is no longer refused OTHER_INTERFACE_SUBNET for STORED_CAMERA (RM-N1) and left this refusal list.
      ['192.168.60.20', 'NO_SOURCE_INTERFACE'],
    ];
    const seen: string[] = [];
    for (const [address, refusal] of classes) {
      // What the runtime role may do (the finding of the security check): UPDATE the address of an adopted camera.
      await core.app.db.pool.query("UPDATE public.capture_devices SET address = $1 WHERE id = 'CAM-01'", [address]);
      const refused = await outcomeOf(ruled.openSource('CAM-01', targetOf(ingest, 'H264_1080P', SESSION_REFUSED), never()));
      expect(refused, address).toMatchObject({ name: 'CameraOpenError', code: CameraOpenRefusal.ADDRESS_REFUSED, deviceId: 'CAM-01', reason: refusal });
      seen.push(`${refusal}`);
    }
    await owner.query("UPDATE public.capture_devices SET address = $1 WHERE id = 'CAM-01'", [`${HOST}:${ONVIF_PORT}`]);
    console.info(`[row143] stored-address refusals of the adapter, in order: ${seen.join(', ')}`);
    expect({ reveals: (await reveals()).length, requests: onvif.requests().length, relays: relayPids.length, connections: sink.connections, errors: errorLog.entries.length, trail: (await readTrail(owner)).length }).toEqual(before);
    expect(ruled.counts().live).toBe(0);
    expect(ruledLocates).toBe(0);
    // Control: the same adapter with the same rule goes on to the reader for an address of the camera subnet - 1 reveal,
    // then the locator read (this adapter's double: nothing is dialled), which answers that no camera is there.
    await owner.query("UPDATE public.capture_devices SET address = '192.168.50.21' WHERE id = 'CAM-02'");
    const admitted = await outcomeOf(ruled.openSource('CAM-02', targetOf(ingest, 'H264_1080P', SESSION_REFUSED), never()));
    await owner.query("UPDATE public.capture_devices SET address = $1 WHERE id = 'CAM-02'", [`${HOST}:${ONVIF_PORT}`]);
    expect(admitted).toMatchObject({ code: CameraOpenRefusal.UNREACHABLE });
    expect(ruledLocates).toBe(1);
    expect((await reveals()).length - before.reveals).toBe(1);
    expect(relayPids.length).toBe(before.relays);
  }, 90_000);

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

// Finding F3-01 of the M3 review (verification/060_m3_review.md): ONE scripted scenario. The fixture of row 43
// (`test-fixtures/row043_reopen.py`, its `drop` case) as this file can drive it: the test camera ends its connection
// after 60 pictures, in the middle of a group, and begins the next connection with 10 pictures of another group that are
// no keyframes; the REAL relay keeps its push to the REAL worker and opens the camera again after its first wait (2 s).
// The Core's side is everything this row built, wired as the composition wires it: the adapter's report source into the
// camera watch, the watch into the fence's own fault sink (`watchFaultSinkOf`), the sink on the REAL engine of this
// file's app - so a raise is a row of the audit trail on PostgreSQL.
// BEFORE this row the reader dropped both lines: the first word the Core had of such a loss was the relay's end, and in
// this scenario - the camera comes back - there was NEVER one: 0 faults, 0 rows. With a camera that stays away the end
// came 62.14 s after the loss line (implementation/043, section 5: the six waits sum to 62 s).
describe('finding F3-01 (T-2): a camera lost INSIDE a session - the real relay, the test camera\'s drop switch, the real worker, the camera watch and the fence\'s fault sink on the real engine', () => {
  it('the fault of THAT camera is raised by the relay\'s first line of the loss and cleared at its re-open; the relay is not ended, the worker keeps its ONE connection and refuses nothing, the file decodes', async () => {
    const run = await underHeavyHostLock(async () => {
      const app = core.app;
      const startedEngine = !app.engine.running;
      if (startedEngine) await app.engine.start('resync');
      const KEY = 'CAMERA_STREAM_ENDED@CAM-01';
      const activeFaults = (): string[] => app.engine.state().faults.active.filter((fault) => fault.kind === 'CAPTURE_FAULT').map((fault) => `${String(fault.reason)}@${String(fault.target)}`);
      const sinkNotes: string[] = [];
      // The fence's sink over the engine, in the words of the composition's port `faultEngine`.
      const sink = watchFaultSinkOf(
        () => ({
          active: (fault) => app.engine.state().faults.active.some((held) => held.kind === fault.code && held.target === fault.subject && (held.reason ?? null) === fault.reason),
          raise: (fault) => app.engine.raiseCaptureWarning(fault),
          clear: (fault) => app.engine.clearCaptureWarning(fault),
        }),
        (note) => void sinkNotes.push(note),
      );
      const asked: { raise: number[]; clear: number[] } = { raise: [], clear: [] };
      const watchReports: string[] = [];
      const watch = createCameraWatch({
        timers: createSystemTimers(),
        now: () => Date.now(),
        // No heartbeat is started in this case: the time reader is never asked.
        reader: { read: async () => ({ answered: false, cameraUtcMs: null }) },
        candidate: async () => CANDIDATE,
        storedAddress: loopbackStoredCameraAddress,
        faults: {
          raise: (fault) => {
            asked.raise.push(Date.now());
            return sink.raise(fault);
          },
          clear: (fault) => {
            asked.clear.push(Date.now());
            return sink.clear(fault);
          },
        },
        report: (report) => void watchReports.push(report.code),
      });
      const endsHere: CameraRelayEnd[] = [];
      const told: { at: number; report: CameraRelayReport }[] = [];
      const watched = adapterWith((end) => {
        endsHere.push(end);
        watch.relayEnded(end);
      });
      watched.relayReports.subscribe((report) => {
        told.push({ at: Date.now(), report });
        reports.push(report);
        watch.pushEstablished(report);
      });
      const within = async (what: string, ms: number, met: () => boolean): Promise<void> => {
        const until = Date.now() + ms;
        while (!met()) {
          if (Date.now() >= until) throw new Error(`not within ${ms} ms: ${what}`);
          await sleep(10);
        }
      };
      const auditBefore = (await readTrail(owner)).length;

      // The `drop` case of row 43, H.264 with the sets in the description, an orderly end of the connection.
      const camera = await startCamera('f301-drop', ['--codec', 'h264', '--drop-after-frames', '60', '--drop-count', '1', '--drop-style', 'fin', '--first-keyframe-delay-ms', '400', '--first-keyframe-fill', 'inter']);
      setLocator(camera.path);
      device.account = ACCOUNT;
      const listener = await startWorkerListener('f301_drop');
      const relaysBefore = relayPids.length;
      const exitsBefore = relayExits.length;
      const handle = (await watched.openSource('CAM-01', targetOf(listener.ingest, 'H264_1080P', SESSION_LOSS), never())) as SourceHandle;
      const pid = relayPids.at(-1) as number;
      expect(relayPids.length - relaysBefore).toBe(1);
      expect(await listener.connected(10)).toBe(true);
      expect(activeFaults()).toEqual([]);

      // THE LOSS. The relay's first line of it reaches the watch, and the fault stands on the engine.
      await within('the relay says the loss of its camera leg', 20_000, () => told.some((entry) => entry.report.leg?.event === 'LOST'));
      const lost = told.find((entry) => entry.report.leg?.event === 'LOST') as { at: number; report: CameraRelayReport };
      await within('the fault of the camera stands on the engine', 5_000, () => activeFaults().includes(KEY));
      const faultAt = Date.now();
      // The relay lives and has NOT ended: this is not the end the Core used to wait for.
      expect([exists(pid), endsHere.length, watched.counts().live]).toEqual([true, 0, 1]);
      expect(sink.owned()).toEqual(['CAMERA_STREAM_ENDED:CAM-01']);

      // THE RE-OPEN. The relay's line clears the watch's own fault.
      await within('the relay says the re-open', 30_000, () => told.some((entry) => entry.report.leg?.event === 'REOPENED'));
      const reopened = told.find((entry) => entry.report.leg?.event === 'REOPENED') as { at: number; report: CameraRelayReport };
      await within('the fault of the camera is cleared', 5_000, () => !activeFaults().includes(KEY));
      const clearedAt = Date.now();
      // Pictures of the new leg for two seconds; the relay is still the same process and nothing ended.
      await sleep(2_000);
      expect([exists(pid), endsHere.length, activeFaults(), sink.owned()]).toEqual([true, 0, [], []]);
      await handle.close();
      await sleep(100);
      expect(exists(pid)).toBe(false);
      const result = await listener.finish();
      await camera.end();
      // The instant the CAMERA ended the stream, from its own event log (wall clock of this host, ms).
      const cameraLog = readFileSync(join(OUT, 'cameras', 'f301-drop.jsonl'), 'utf8').split('\n').filter((line) => line !== '').map((line) => JSON.parse(line) as Record<string, unknown>);
      const dropped = cameraLog.filter((event) => event.event === 'stream_end').map((event) => ({ at: Date.parse(String(event.t)), reason: String(event.reason), frames: Number(event.frames_sent) }));
      const trail = (await readTrail(owner)).slice(auditBefore);
      if (startedEngine) await app.engine.stop();
      return { told, lost, reopened, faultAt, clearedAt, asked, sinkNotes, watchReports, endsHere, result, dropped, trail, exits: relayExits.slice(exitsBefore), counts: watched.counts() };
    });

    // What the adapter told, in order: the established push ONCE, the loss, the re-open. Numbers and code words only.
    expect(run.told.map((entry) => entry.report.leg?.event ?? 'ESTABLISHED')).toEqual(['ESTABLISHED', 'LOST', 'REOPENED']);
    expect(run.lost.report).toEqual({ sessionId: SESSION_LOSS, deviceId: 'CAM-01', attempt: 1, leg: { event: 'LOST', profile: 'H264_1080P', loss: 1, cause: 'CAMERA_LOST' } });
    expect(run.reopened.report).toMatchObject({ sessionId: SESSION_LOSS, deviceId: 'CAM-01', attempt: 1, leg: { event: 'REOPENED', profile: 'H264_1080P', loss: 1, tries: 1, heldBack: 25 } });
    const leg = run.reopened.report.leg as { gapMs: number };
    expect(leg.gapMs).toBeGreaterThanOrEqual(2_000);
    expect(leg.gapMs).toBeLessThan(6_000);
    // ONE raise and ONE clear were asked of the sink, in the turn of each line; nothing was dropped or out of order; the watch and the sink had nothing to say.
    expect([run.asked.raise.length, run.asked.clear.length]).toEqual([1, 1]);
    expect([run.asked.raise[0], run.asked.clear[0]]).toEqual([run.lost.at, run.reopened.at].map((at) => expect.closeTo(at, -1)));
    expect([run.counts, run.sinkNotes, run.watchReports, run.endsHere]).toEqual([{ live: 0, droppedReports: 0, outOfOrderReports: 0 }, [], [], []]);
    // The relay ended by its order to stop at the close: exit 0, never by itself.
    expect(run.exits).toEqual([0]);

    // THE SESSION'S RECORD IN THE FORMS THAT EXIST: one FAULT_RAISED and one FAULT_CLEARED row about that camera, in this order - the two bounds of the absence.
    const faultRows = run.trail.filter((row) => row.type === 'FAULT_RAISED' || row.type === 'FAULT_CLEARED');
    // (The engine's FAULT_CLEARED row names the device in `details.target` and leaves the row's device column empty: the existing form, read as it is.)
    expect(faultRows.map((row) => [row.type, row.deviceId, (row.details as Record<string, unknown>).target, (row.details as Record<string, unknown>).kind, (row.details as Record<string, unknown>).reason])).toEqual([
      ['FAULT_RAISED', 'CAM-01', 'CAM-01', 'CAPTURE_FAULT', 'CAMERA_STREAM_ENDED'],
      ['FAULT_CLEARED', null, 'CAM-01', 'CAPTURE_FAULT', 'CAMERA_STREAM_ENDED'],
    ]);
    const [raisedRow, clearedRow] = faultRows as [AuditRow, AuditRow];
    expect(clearedRow.at - raisedRow.at).toBeGreaterThanOrEqual(2_000);

    // THE WORKER'S SIDE OF THE RE-OPEN: one connection, one connect report, no refusal of its gate, a file that decodes.
    expect(run.result).toMatchObject({ ingest_connected: 1, worker_codec: 'h264', file_codec: 'h264', decode_error_lines: 0, gate_refusals: 0, ingest_elements_in_worker_output: 0, control_recorded: true, leftovers: 0 });

    // THE MEASURE: from the instant the camera ended the stream (its own event log) to the Core's fault.
    // The dropped stream: 60 pictures of the clip after the 10 that led up to its first keyframe.
    const drop = run.dropped.find((end) => end.reason === 'fault_drop');
    expect(drop).toMatchObject({ reason: 'fault_drop', frames: 70 });
    const dropAt = (drop as { at: number }).at;
    const toLine = run.lost.at - dropAt;
    const toFault = run.faultAt - dropAt;
    console.info(
      `[r1 F3-01] camera ended the stream (${String(drop?.reason)}, in mid group) -> the relay's loss line read by the Core: ${toLine} ms; -> the fault active on the engine: ${toFault} ms (polled every 10 ms); raise asked ${(run.asked.raise[0] ?? Number.NaN) - run.lost.at} ms after the line; ` +
        `absence: FAULT_RAISED to FAULT_CLEARED ${clearedRow.at - raisedRow.at} ms on the audit rows, the relay's own gap ${leg.gapMs} ms, held back ${String((run.reopened.report.leg as { heldBack: number }).heldBack)}; cleared ${run.clearedAt - run.reopened.at} ms after the re-open line; ` +
        `worker ${JSON.stringify({ ingest_connected: run.result.ingest_connected, gate_refusals: run.result.gate_refusals, file_frames: run.result.file_frames, decode_error_lines: run.result.decode_error_lines })}`,
    );
    // Within the first report: well inside the relay's first wait (2 s), against "never" (this scenario) and 62 s (a camera that stays away) before.
    expect(toFault).toBeLessThan(1_500);
    expect(toFault).toBeGreaterThanOrEqual(-5);
  }, 240_000 + HEAVY_LOCK_WAIT_S * 1_000);
});

describe('T-2: nothing of a credential, a locator or an ingest address is written anywhere', () => {
  it('the log sink, the persistent error log, the audit trail, every error, report, note and end of this file: 0 occurrences; no relay of this file is left', async () => {
    expect(needles.size).toBeGreaterThan(40);
    /** THE SWEEP: every place read anew, and how many of the texts stand in each. The control below uses THIS function. */
    const sweep = async (): Promise<Record<string, number>> => {
      await core.app.pipeline.drain();
      const places: Record<string, string> = {
        log: core.log.text(),
        errorLog: JSON.stringify(errorLog.entries),
        audit: JSON.stringify(await readTrail(owner)),
        // Row T3: the registry rows too - where a locator, or an address with an account in it, would come to rest.
        devices: ((await owner.query("SELECT coalesce(json_agg(row_to_json(t))::text, '[]') AS rows FROM public.capture_devices t")).rows[0] as { rows: string }).rows,
        thrown: kept.map(everything).join('\n'),
        told: everything({ reports, ends, notes }),
      };
      return Object.fromEntries(Object.entries(places).map(([place, text]) => [place, occurrencesIn(text)]));
    };
    const found = await sweep();
    console.info(`[row46] occurrences of ${needles.size} texts (account, secret, locators, paths, ingest addresses and their last elements): ${JSON.stringify(found)}; relays started ${relayPids.length}, alive ${relayPids.filter((pid) => exists(pid)).length}`);
    expect(found).toEqual({ log: 0, errorLog: 0, audit: 0, devices: 0, thrown: 0, told: 0 });
    expect(relayPids.filter((pid) => exists(pid))).toEqual([]);
    expect(adapter.counts().live + guarded.counts().live).toBe(0);
    // Reports dropped as superseded in this file: none was expected, none happened.
    expect(notes.filter((note) => note.code !== 'CAPTURE_RELAY_REPORT_SUPERSEDED')).toEqual([]);

    // ── CONTROL (row T3; review 060c T-03, survivor 4). The control that stood here was
    // `[...needles].some((needle) => \`x ${needle} y\`.includes(needle))`: true for any set, and it never called the
    // search - a sweep that always answered 0 passed with it. Now the account's SECRET is put where the product could
    // really leave it, through the product's own sinks, AFTER the sweep above found nothing, and THE SAME SWEEP must
    // find each: a line of the app's own logger, an entry of the reader's error log, the message of an audit entry
    // written through the app's own pipeline (the form of the reveal entry the reader writes), a column of a registry
    // row, an error this file was thrown, a relay end it was told. This is the file's last case: nothing reads these after it.
    const planted = ACCOUNT.secret;
    core.app.log.info({ rowT3Control: planted }, `row T3 control of the sweep: ${planted}`);
    errorLog.append({ ...errorLog.entries[0], code: 'ROW_T3_CONTROL', message: `row T3 control ${planted}` } as never);
    const revealRow = (await readTrail(owner)).findLast((row) => row.type === REVEALED);
    expect(revealRow, 'a reveal entry of this file, as the form of the planted one').toBeDefined();
    await core.app.pipeline.run('rowT3.sweepControl', async (unit) => void (await unit.audit.append({ type: REVEALED, message: `Capture credential revealed (${planted})`, actorId: null, deviceId: 'CAM-01', details: revealRow?.details ?? {} } as never)));
    await owner.query("UPDATE public.capture_devices SET model = $1 WHERE id = 'CAM-02'", [`model ${planted}`]);
    kept.push(new Error(`row T3 control ${planted}`));
    ends.push({ sessionId: SESSION_REFUSED, deviceId: 'CAM-01', attempt: 99, profile: 'H264_1080P', code: CameraOpenRefusal.INGEST_LOST, reason: planted } as never);
    const control = await sweep();
    console.info(`[rowT3] control of the sweep, the secret planted in every place: ${JSON.stringify(control)}`);
    expect(control).toEqual({ log: 1, errorLog: 1, audit: 1, devices: 1, thrown: 1, told: 1 });
    expect(JSON.stringify(await readTrail(owner)).includes(REVEALED)).toBe(true);
  }, 30_000);
});
