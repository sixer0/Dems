// Stand-ins for the two engines. No real engine, model, port or server is used by the automated
// suite: the `cpu-local` backend starts a small executable written here (a REAL process, so the
// argument list is the one the operating system delivered), and the `omlx-server` backend talks to
// an in-process answerer at the `fetch` seam that speaks the server's HTTP API.
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { getPriority, tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import type { FetchLike } from '../backends/omlx-http';
import type { CpuLocalRuntime, EnginePriorityMode } from '../config';
import type { LogRecord, MemoryLog } from '../log';
import type { TranscriberChunk } from '../types';
import { encodeWavPcm16 } from '../wav';

/** The error records of a log. A host that refuses to lower a priority adds a `warn`; that is not an error. */
export function errorRecords(log: MemoryLog): LogRecord[] {
  return log.records().filter((record) => record.level === 'error');
}

/**
 * Whether THIS host lowers the priority of a process started through `nice`: asked of the operating
 * system by a process that reports its own niceness, and judged against the niceness of THIS
 * process (`nice -n` is relative). False inside a sandbox that forbids the call.
 */
export const OWN_NICE: number = getPriority();
/** What `nice -n 10` gives a child of THIS process: relative to its own niceness, clamped at the floor. */
export const EXPECTED_ENGINE_NICE: number = Math.min(OWN_NICE + 10, 19);
export const HOST_LOWERS_PRIORITY: boolean = (() => {
  const probe = spawnSync('/usr/bin/nice', ['-n', '10', process.execPath, '-e', "require('node:fs').writeSync(1, String(require('node:os').getPriority()))"], { encoding: 'utf8' });
  return probe.status === 0 && /^-?[0-9]+$/.test(probe.stdout.trim()) && Number(probe.stdout.trim()) >= EXPECTED_ENGINE_NICE;
})();

/**
 * The priority mode the functional tests run the stand-in engine with. `required` wherever the host
 * can lower a priority (every real host); `best-effort` only where a sandbox forbids the system
 * call, so that the other 100 tests still run there. The priority test itself covers both modes.
 */
export const TEST_PRIORITY_MODE: EnginePriorityMode = HOST_LOWERS_PRIORITY ? 'required' : 'best-effort';

export function scratchDir(label: string): string {
  return mkdtempSync(join(tmpdir(), `dems-transcriber-${label}-`));
}

/** One second of a quiet tone as chunk PCM. */
export function pcmChunk(): TranscriberChunk {
  const samples = new Int16Array(16_000);
  for (let index = 0; index < samples.length; index += 1) samples[index] = Math.round(800 * Math.sin(index / 9));
  return { audio: { kind: 'pcm16', samples }, sampleRateHz: 16_000, offsetMs: 0, durationMs: 1_000 };
}

export function wavFileChunk(dir: string): TranscriberChunk {
  const path = join(dir, 'chunk.wav');
  const chunk = pcmChunk();
  if (chunk.audio.kind !== 'pcm16') throw new Error('unreachable');
  writeFileSync(path, encodeWavPcm16(chunk.audio.samples, 16_000));
  return { audio: { kind: 'file', path }, sampleRateHz: 16_000, offsetMs: 0, durationMs: 1_000 };
}

const FAKE_ENGINE = `#!${process.execPath}
// A stand-in for whisper-cli. It behaves by the NAME of the model file it is given.
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const value = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
const out = value('-of');
const model = path.basename(value('-m') || '');
fs.writeFileSync(path.join(path.dirname(out), 'last-argv.json'), JSON.stringify(args));
// What this process observes about ITSELF: the niceness it runs at and the variables it was given.
fs.writeFileSync(path.join(path.dirname(out), 'last-nice.json'), JSON.stringify(require('node:os').getPriority()));
fs.writeFileSync(path.join(path.dirname(out), 'last-env.json'), JSON.stringify(process.env));
if (!args.includes('-ng')) { process.stderr.write('refusing to run without -ng'); process.exit(9); }
if (!fs.existsSync(value('-f'))) { process.stderr.write('no audio'); process.exit(8); }
if (model.includes('exit3')) { process.stderr.write('engine fault Authorization: Bearer leaked-in-stderr-0001'); process.exit(3); }
if (model.includes('hang')) { setInterval(() => {}, 1000); return; }
if (model.includes('nofile')) process.exit(0);
if (model.includes('nojson')) { fs.writeFileSync(out + '.json', 'not json'); process.exit(0); }
if (model.includes('badform')) { fs.writeFileSync(out + '.json', JSON.stringify({ result: {}, transcription: 'none' })); process.exit(0); }
const language = model.includes('lang-en') ? 'en' : value('-l');
fs.writeFileSync(out + '.json', JSON.stringify({
  systeminfo: 'stand-in', params: { model: value('-m'), language }, result: { language },
  transcription: [
    { timestamps: { from: '00:00:00,000', to: '00:00:04,240' }, offsets: { from: 0, to: 4240 }, text: ' Selamat pagi.' },
    { timestamps: { from: '00:00:04,960', to: '00:00:07,840' }, offsets: { from: 4960, to: 7840 }, text: ' Terima kasih atas undangannya.' },
  ],
}, null, 2));
`;

export interface FakeEngine {
  readonly binaryPath: string;
  readonly modelDir: string;
  readonly workDir: string;
  /** Creates the (empty) model FILE of this identifier, `<id>.bin`, and returns the identifier. */
  model(id: string): string;
  /** The host configuration of the `cpu-local` backend for this stand-in. */
  cpuLocal(overrides?: Partial<CpuLocalRuntime>): CpuLocalRuntime;
  /** The environment the stand-in process found, or null when it never ran. */
  lastEnv(): Record<string, string> | null;
  /** The argument list the stand-in process received last, or null when it never ran. */
  lastArgv(): string[] | null;
  /** The niceness a `nice` model run observed for itself, or null. */
  lastNice(): number | null;
}

export function createFakeEngine(): FakeEngine {
  const root = scratchDir('engine');
  const binaryPath = join(root, 'fake-whisper-cli');
  const modelDir = join(root, 'models');
  const workDir = join(root, 'work');
  mkdirSync(modelDir);
  mkdirSync(workDir);
  writeFileSync(binaryPath, FAKE_ENGINE);
  chmodSync(binaryPath, 0o755);
  return {
    binaryPath,
    modelDir,
    workDir,
    model(id) {
      writeFileSync(join(modelDir, `${id}.bin`), '');
      return id;
    },
    cpuLocal(overrides = {}) {
      return { binaryPath, modelDir, workDir, priority: TEST_PRIORITY_MODE, ...overrides };
    },
    lastEnv() {
      try {
        return JSON.parse(readFileSync(join(workDir, 'last-env.json'), 'utf8')) as Record<string, string>;
      } catch {
        return null;
      }
    },
    lastArgv() {
      try {
        return JSON.parse(readFileSync(join(workDir, 'last-argv.json'), 'utf8')) as string[];
      } catch {
        return null;
      }
    },
    lastNice() {
      try {
        return JSON.parse(readFileSync(join(workDir, 'last-nice.json'), 'utf8')) as number;
      } catch {
        return null;
      }
    },
  };
}

export interface FakeOmlxCall {
  readonly method: string;
  readonly path: string;
  readonly host: string;
  /** The `Host` header the client set itself, or null. */
  readonly hostHeader: string | null;
  readonly authorization: string | null;
  readonly redirect: string | undefined;
  readonly fields: Record<string, string>;
  readonly fileBytes: number;
  readonly json: unknown;
}

export interface FakeOmlx {
  readonly fetchImpl: FetchLike;
  readonly calls: FakeOmlxCall[];
  /** The highest number of requests that were in flight at once. */
  maxInFlight(): number;
}

export const WHISPER_LIKE_ANSWER = {
  text: ' Selamat pagi. Terima kasih atas undangannya.',
  language: 'id',
  duration: 0.0,
  segments: [
    { id: 0, seek: 0, start: 0.0, end: 4.26, text: ' Selamat pagi.', tokens: [50365, 10736], temperature: 0.0, avg_logprob: -0.09, compression_ratio: 1.67, no_speech_prob: 1.4e-11 },
    { id: 1, seek: 0, start: 4.98, end: 7.84, text: ' Terima kasih atas undangannya.', tokens: [50614, 10736], temperature: 0.0, avg_logprob: -0.11, compression_ratio: 1.67, no_speech_prob: 2.1e-11 },
  ],
};

/** The second engine of the server: one segment, no QA member (row 12 §4.3). */
export const QWEN_LIKE_ANSWER = {
  text: 'Selamat pagi. Terima kasih atas undangannya.',
  language: 'id',
  duration: 10.67,
  segments: [{ start: 0.0, end: 7.84, text: 'Selamat pagi. Terima kasih atas undangannya.' }],
};

export interface FakeOmlxOptions {
  /** The key the server accepts. Null: the server asks for none. */
  readonly key: string | null;
  readonly models: readonly string[];
  readonly answer?: unknown;
  /** Answers a transcription or a speech request with this status instead of 200. */
  readonly status?: number;
  /** Rejects every request as a refused connection. */
  readonly refuse?: boolean;
  readonly rawBody?: string;
  readonly speechWav?: Uint8Array;
}

export function createFakeOmlx(options: FakeOmlxOptions): FakeOmlx {
  const calls: FakeOmlxCall[] = [];
  let inFlight = 0;
  let highest = 0;
  const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

  const fetchImpl: FetchLike = async (input, init) => {
    const url = new URL(input);
    const headers = new Headers(init.headers);
    const fields: Record<string, string> = {};
    let fileBytes = 0;
    let body: unknown = null;
    if (init.body instanceof FormData) {
      for (const [name, value] of init.body.entries()) {
        if (typeof value === 'string') fields[name] = value;
        else fileBytes = value.size;
      }
    } else if (typeof init.body === 'string') {
      body = JSON.parse(init.body);
    }
    calls.push({ method: init.method ?? 'GET', path: url.pathname, host: url.host, hostHeader: headers.get('host'), authorization: headers.get('authorization'), redirect: init.redirect, fields, fileBytes, json: body });
    if (options.refuse === true) throw new TypeError('fetch failed', { cause: Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }) });

    inFlight += 1;
    highest = Math.max(highest, inFlight);
    try {
      await wait(5);
      if (options.key !== null && headers.get('authorization') !== `Bearer ${options.key}`) return json(401, { error: { message: 'invalid api key' } });
      if (url.pathname === '/v1/models') return json(200, { object: 'list', data: options.models.map((id) => ({ id, object: 'model' })) });
      if (url.pathname === '/v1/audio/transcriptions') {
        if (options.status !== undefined) return json(options.status, { error: { message: 'engine error' } });
        if (!options.models.includes(fields['model'] ?? '')) return json(404, { error: { message: 'model not found' } });
        if (options.rawBody !== undefined) return new Response(options.rawBody, { status: 200 });
        return json(200, options.answer ?? WHISPER_LIKE_ANSWER);
      }
      if (url.pathname === '/v1/audio/speech') {
        return new Response(Buffer.from(options.speechWav ?? new Uint8Array()), { status: options.status ?? 200, headers: { 'content-type': 'audio/wav' } });
      }
      return json(404, { error: { message: 'no such path' } });
    } finally {
      inFlight -= 1;
    }
  };
  return { fetchImpl, calls, maxInFlight: () => highest };
}

/** A settings file of the server's form, holding `key`, in a scratch directory. */
export function writeSettingsFile(key: string | null): string {
  const path = join(scratchDir('store'), 'store.json');
  writeFileSync(path, JSON.stringify({ version: 1, auth: { api_key: key ?? '', secret_key: 'another-secret-never-read-0002', skip_api_key_verification: key === null } }));
  return path;
}
