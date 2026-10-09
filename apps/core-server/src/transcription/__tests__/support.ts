// Stand-ins for the tests of the transcription composition (blueprint row 115; not a test file).
//
//   - a data directory in the system's temporary folder, with a host file, an oMLX settings file
//     that holds a CANARY key, and stand-in engine files (an executable that is never started and a
//     model file): nothing is ever written to the data directory of this repository;
//   - a loopback server that speaks the model-list API of the oMLX server (`GET /v1/models`, bearer
//     key required) and records every request it is sent;
//   - an in-process host with the members the composition asks of the app, whose log, persistent
//     error log, clock, capture supervisor and boot steps the test reads and steers;
//   - a synthetic tap (48 kHz mono signed 16-bit) and an answerer for the transcription request.
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { FetchLike } from '@dems/transcriber';
import type { CaptureFacts, StoredSttSelection, TranscriptionHost } from '../index';

export const SERVER_MODEL = 'whisper-large-v3-turbo';
export const CPU_MODEL = 'ggml-large-v3-turbo';
export const REFERENCE = 'omlx-settings:auth.api_key';
/** Planted in the settings file only. Built from parts, so that no other file of the repository holds it. */
export const KEY_CANARY = ['omlx', 'CANARY', 'row115', 'Vb3Kq9Xw7Ld2Hs5'].join('-');

export interface DataDir {
  readonly dataDir: string;
  readonly settingsPath: string;
  readonly binaryPath: string;
  readonly modelDir: string;
  /** Writes `<dataDir>/transcriber/host.json`. */
  writeHost(host: unknown): void;
  writeHostText(text: string): void;
}

export function makeDataDir(slug: string): DataDir {
  const dataDir = mkdtempSync(join(tmpdir(), `dems-row115-${slug}-`));
  const settingsPath = join(dataDir, 'omlx', 'settings.json');
  mkdirSync(dirname(settingsPath), { recursive: true });
  writeFileSync(settingsPath, JSON.stringify({ auth: { api_key: KEY_CANARY } }), { mode: 0o600 });
  const binaryPath = join(dataDir, 'engine', 'whisper-cli');
  const modelDir = join(dataDir, 'engine', 'models');
  mkdirSync(modelDir, { recursive: true });
  // Never started by any test: the probe and the boot step only look at the file.
  writeFileSync(binaryPath, '#!/bin/sh\nexit 0\n');
  chmodSync(binaryPath, 0o755);
  writeFileSync(join(modelDir, `${CPU_MODEL}.bin`), 'stand-in model bytes');
  const hostFile = join(dataDir, 'transcriber', 'host.json');
  const writeHostText = (text: string): void => {
    mkdirSync(dirname(hostFile), { recursive: true });
    writeFileSync(hostFile, text);
  };
  return { dataDir, settingsPath, binaryPath, modelDir, writeHost: (host) => writeHostText(JSON.stringify(host)), writeHostText };
}

/** The host file of a data directory with both backends stated. */
export const fullHost = (dir: DataDir): unknown => ({ version: 1, cpuLocal: { binaryPath: dir.binaryPath, modelDir: dir.modelDir }, omlxServer: { settingsPath: dir.settingsPath } });

export interface SeenRequest {
  readonly method: string;
  readonly url: string;
  readonly host: string | undefined;
  readonly authorization: string | undefined;
}

export interface FakeOmlx {
  readonly port: number;
  readonly endpoint: string;
  readonly requests: SeenRequest[];
  close(): Promise<void>;
}

/** How the fake answers `GET /v1/models`. `redirectTo`: 302 to that address instead. */
export interface FakeOmlxOptions {
  readonly models?: readonly string[];
  readonly key?: string | null;
  readonly redirectTo?: string;
}

/** A loopback server that speaks the model-list API. Bound to 127.0.0.1 only, on an ephemeral port. */
export async function startFakeOmlx(options: FakeOmlxOptions = {}): Promise<FakeOmlx> {
  const requests: SeenRequest[] = [];
  const key = options.key === undefined ? KEY_CANARY : options.key;
  const server: Server = createServer((request: IncomingMessage, response) => {
    requests.push({ method: request.method ?? '', url: request.url ?? '', host: request.headers.host, authorization: request.headers.authorization });
    if (options.redirectTo !== undefined) {
      response.writeHead(302, { location: options.redirectTo }).end();
      return;
    }
    if (key !== null && request.headers.authorization !== `Bearer ${key}`) {
      response.writeHead(401, { 'content-type': 'application/json' }).end('{"error":"unauthorized"}');
      return;
    }
    if (request.method === 'GET' && request.url === '/v1/models') {
      response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ object: 'list', data: (options.models ?? [SERVER_MODEL]).map((id) => ({ id, object: 'model' })) }));
      return;
    }
    response.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    port,
    endpoint: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

/** A loopback port nothing listens on: taken from the system, then given back. */
export async function closedPort(): Promise<number> {
  const fake = await startFakeOmlx();
  await fake.close();
  return fake.port;
}

export interface LogLine {
  readonly level: 'info' | 'warn' | 'error';
  readonly fields: Record<string, unknown>;
  readonly message: string;
}

export interface FakeCapture extends CaptureFacts {
  state: { sessionId: string | null; workerPid: number | null; phase: string };
  emitTelemetry(sessionId: string, tapActive: boolean): void;
}

export function fakeCapture(): FakeCapture {
  const listeners = new Set<(event: { readonly sessionId: string; readonly frame: { readonly tapActive: boolean } }) => void>();
  const capture: FakeCapture = {
    state: { sessionId: null, workerPid: null, phase: 'IDLE' },
    status: () => capture.state,
    on(_event, listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    emitTelemetry(sessionId, tapActive) {
      for (const listener of listeners) listener({ sessionId, frame: { tapActive } });
    },
  };
  return capture;
}

export interface FakeHost {
  readonly app: TranscriptionHost;
  readonly lines: LogLine[];
  readonly persisted: { level: string; source: string; message: string; code?: string; context?: Readonly<Record<string, unknown>> }[];
  readonly capture: FakeCapture;
  readonly bootSteps: { readonly id: string; run(): Promise<void> }[];
  /** What the reveal function answers: the stored credential columns. */
  credential: { credential_kind: string | null; credential_ref: string | null; secret_ciphertext: Uint8Array | null; nonce: Uint8Array | null };
  /** The statements the composition sent to the pool. */
  readonly statements: string[];
  now: number;
  /** Everything the host wrote anywhere, as one text: for a canary sweep. */
  everything(): string;
}

export function fakeHost(dataDir: string, captureMode: 'simulated' | 'real' = 'simulated'): FakeHost {
  const lines: LogLine[] = [];
  const persisted: FakeHost['persisted'] = [];
  const bootSteps: FakeHost['bootSteps'] = [];
  const statements: string[] = [];
  const capture = fakeCapture();
  const write = (level: LogLine['level']) => (fields: Record<string, unknown>, message: string) => void lines.push({ level, fields, message });
  const host: FakeHost = {
    lines,
    persisted,
    capture,
    bootSteps,
    statements,
    credential: { credential_kind: 'REFERENCE', credential_ref: REFERENCE, secret_ciphertext: null, nonce: null },
    now: Date.UTC(2031, 0, 1),
    everything: () => JSON.stringify({ lines, persisted }),
    app: {
      stages: {},
      config: { dataDir, captureMode },
      log: { info: write('info'), warn: write('warn'), error: write('error') },
      errorLog: { append: (entry) => void persisted.push(entry) },
      clock: { now: () => host.now },
      capture,
      db: {
        pool: {
          async query(text: string) {
            statements.push(text);
            // The reveal function answers the credential columns; every other statement (the mirror of `transcript_chunks`) finds no row.
            if (!text.includes('dems_stt_credential_reveal')) return { rows: [], rowCount: 0 };
            return { rows: [host.credential] as never[], rowCount: 1 };
          },
        },
      },
      readiness: { addBootStep: (step) => void bootSteps.push(step) },
    },
  };
  return host;
}

export const serverRow = (endpoint: string, more: Partial<StoredSttSelection> = {}): StoredSttSelection => ({
  enabled: true,
  backend: 'omlx-server',
  endpoint,
  model: SERVER_MODEL,
  language: 'id',
  diarization: true,
  credentialKind: 'REFERENCE',
  revision: 1,
  ...more,
});

export const cpuRow = (more: Partial<StoredSttSelection> = {}): StoredSttSelection => ({
  enabled: true,
  backend: 'cpu-local',
  endpoint: null,
  model: CPU_MODEL,
  language: 'id',
  diarization: true,
  credentialKind: null,
  revision: 1,
  ...more,
});

export const TAP_RATE = 48_000;

/** A raw tap of `seconds` of a quiet tone: 48 kHz mono signed 16-bit little-endian. */
export function writeTap(path: string, seconds: number): void {
  const total = TAP_RATE * seconds;
  const bytes = Buffer.alloc(total * 2);
  for (let index = 0; index < total; index += 1) bytes.writeInt16LE(3_000 + Math.round(1_500 * Math.sin(index / 9)), index * 2);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
}

export interface Answerer {
  readonly fetchImpl: FetchLike;
  /** `METHOD url` of every request, in order. */
  readonly calls: string[];
  /** The `Authorization` values seen, in order (undefined: none sent). */
  readonly authorizations: (string | null)[];
}

/** An in-process transport: the model list and one segment of text per transcription request. */
export function answerer(models: readonly string[] = [SERVER_MODEL]): Answerer {
  const calls: string[] = [];
  const authorizations: (string | null)[] = [];
  let decoded = 0;
  const fetchImpl: FetchLike = async (input, init) => {
    calls.push(`${init.method ?? 'GET'} ${input}`);
    authorizations.push(new Headers(init.headers).get('authorization'));
    if (input.endsWith('/v1/models')) return new Response(JSON.stringify({ data: models.map((id) => ({ id })) }), { status: 200 });
    decoded += 1;
    return new Response(JSON.stringify({ text: `kalimat ${decoded}`, language: 'id', segments: [{ start: 0.2, end: 1.4, text: `kalimat ${decoded}` }] }), { status: 200 });
  };
  return { fetchImpl, calls, authorizations };
}
