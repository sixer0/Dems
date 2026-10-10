// The transcriber session of a recording, from capture start to the seal (blueprint row 71c,
// decision D153; transcript spec §B.7, §D.3; evidence spec §E.5).
//
// The composition is mounted on the in-process host of this folder (`support.ts`): the pipeline is
// the REAL one of `@dems/transcriber`; only the engine's answer is a stand-in (an in-process
// transport), and the tap is synthetic. Nothing starts a process, a model or a server, and no
// figure of how long anything took is asserted or printed (D230).
import { createHash } from 'node:crypto';
import { chmodSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { getPriority } from 'node:os';
import { join } from 'node:path';
import type { FetchLike, TranscriptModelProvenance } from '@dems/transcriber';
import { afterAll, describe, expect, it } from 'vitest';
import { ModelProvenanceCode, SessionRunCode, createMemorySnapshotStore, mountTranscription, sessionScratchDir, sessionTapPath, type StoredSttSelection, type SttSnapshotStore, type TranscriptionControl } from '../index';
import { CPU_MODEL, SERVER_MODEL, answerer, cpuRow, fakeHost, fullHost, ggmlBytes, makeDataDir, serverRow, writeTap, type Answerer, type DataDir, type FakeHost } from './support';

const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

const ENDPOINT = 'http://127.0.0.1:18911';
/** Fields 84 to 87 of a SERVER session (D160): the name, and nothing the Core cannot know. The mounts of this file are server sessions unless they say `cpuRow()`. */
const PROVENANCE: TranscriptModelProvenance = { name: SERVER_MODEL, version: null, quantisation: null, sha256: null };
/** What a careless provider would state: values nobody verified. */
const INVENTED: TranscriptModelProvenance = { name: SERVER_MODEL, version: 'test-version', quantisation: 'none', sha256: 'c0de'.padEnd(64, '0') };

interface Mounted {
  readonly host: FakeHost;
  readonly control: TranscriptionControl;
  readonly transport: Answerer;
  readonly dir: DataDir;
  readonly snapshots: SttSnapshotStore;
}

function mount(slug: string, stored: StoredSttSelection | null, more: { provenance?: TranscriptModelProvenance | null | 'PRODUCTION'; fetchImpl?: FetchLike; dir?: DataDir; snapshots?: SttSnapshotStore } = {}): Mounted {
  const dir = more.dir ?? makeDataDir(slug);
  if (more.dir === undefined) {
    dirs.push(dir.dataDir);
    dir.writeHost(fullHost(dir));
  }
  const host = fakeHost(dir.dataDir, 'real');
  const transport = answerer();
  const snapshots = more.snapshots ?? createMemorySnapshotStore();
  const provenance = more.provenance === undefined ? PROVENANCE : more.provenance;
  const control = mountTranscription(host.app, {
    readConfig: async () => stored,
    snapshots,
    fetchImpl: more.fetchImpl ?? transport.fetchImpl,
    sessionStepIntervalMs: 5,
    // 'PRODUCTION': no port is handed in - the mount's own provider answers (integration pass D8).
    ...(provenance === 'PRODUCTION' ? {} : { modelProvenance: async () => provenance }),
  });
  return { host, control, transport, dir, snapshots };
}

/** A session whose snapshot is taken and whose capture "records": the tap is written, the supervisor says RECORDING. */
async function recording(m: Mounted, sessionId: string, seconds: number): Promise<void> {
  expect(await m.control.snapshotSttConfigForSession(sessionId)).toMatchObject({ ok: true, taken: true });
  await m.control.settled();
  writeTap(sessionTapPath(m.dir.dataDir, sessionId), seconds);
  m.host.capture.state = { sessionId, workerPid: process.pid, phase: 'RECORDING' };
}

const codes = (m: Mounted): (string | undefined)[] => m.host.persisted.map((entry) => entry.code);

describe('an STT-enabled session: opened at capture start, run to its end at the stop, assembled for the seal', () => {
  it('begin opens and steps the runner; end(recorded) takes the final steps and closes; the seal then gets the ASSEMBLED transcript of the real pipeline', async () => {
    const m = mount('run-ok', serverRow(ENDPOINT));
    const id = 'SES-20310101-0101';
    await recording(m, id, 40);
    expect(m.control.runs.status(id)).toBeNull();

    const begun = await m.control.runs.begin(id);
    expect(begun).toMatchObject({ sessionId: id, phase: 'RUNNING', opened: 'ENABLED', code: null, closed: false });
    // Asked twice (a retried call): the same run, not a second session.
    expect((await m.control.runs.begin(id)).opened).toBe('ENABLED');

    m.control.runs.end(id, { recorded: true });
    await m.control.runs.idle();
    expect(m.control.runs.status(id)).toMatchObject({ phase: 'COMPLETE', closed: true });
    expect(m.transport.calls.filter((call) => call.includes('/v1/audio/transcriptions')).length).toBeGreaterThanOrEqual(1);

    expect(await m.control.runs.availability(id)).toEqual({ kind: 'AVAILABLE' });
    const answer = await m.control.runs.assemble(id);
    if (answer.kind !== 'ASSEMBLED') throw new Error(`the seal was answered ${answer.kind}`);
    expect(answer.record).toMatchObject({ docVersion: 'dems.transcript/1', state: 'ASSEMBLED', failedChunks: 0, model: { name: PROVENANCE.name, version: PROVENANCE.version, quantisation: PROVENANCE.quantisation, modelSha256: PROVENANCE.sha256, params: { backend: 'omlx-server', modelId: SERVER_MODEL } } });
    expect(answer.failedChunkCodes).toEqual([]);
    expect(answer.files).toEqual(m.control.runs.locate(id));
    expect([existsSync(answer.files.json), existsSync(answer.files.srt), existsSync(answer.files.vtt)]).toEqual([true, true, true]);
    // No speaker engine in this Core: the labels are UNAVAILABLE with the transcriber's reason, never made up.
    expect(answer.record.labelsStatus).toBe('UNAVAILABLE');
    // Asked again: the same record, nothing decoded again.
    const decoded = m.transport.calls.length;
    const again = await m.control.runs.assemble(id);
    expect(again.kind === 'ASSEMBLED' ? again.record.jsonSha256 : null).toBe(answer.record.jsonSha256);
    expect(m.transport.calls.length).toBe(decoded);
    expect(codes(m)).not.toContain(SessionRunCode.STEP_FAILED);
  });

  it('CONTROL of the provenance port: a port that states nothing - the session transcribes while it records and hands the seal NO document - UNAVAILABLE by name, said in the error log', async () => {
    const m = mount('run-noprov', serverRow(ENDPOINT), { provenance: null });
    const id = 'SES-20310101-0102';
    await recording(m, id, 10);
    expect(await m.control.runs.begin(id)).toMatchObject({ phase: 'RUNNING', opened: 'ENABLED', code: SessionRunCode.MODEL_PROVENANCE_UNKNOWN });
    m.control.runs.end(id, { recorded: true });
    await m.control.runs.idle();
    expect(await m.control.runs.availability(id)).toEqual({ kind: 'UNAVAILABLE', code: SessionRunCode.MODEL_PROVENANCE_UNKNOWN });
    expect(await m.control.runs.assemble(id)).toEqual({ kind: 'NOT_READY' });
    expect(existsSync(m.control.runs.locate(id).json)).toBe(false);
    expect(codes(m)).toContain(SessionRunCode.MODEL_PROVENANCE_UNKNOWN);
  });

  it('a transcriber that never answers: the close-out of the seal gives every chunk up without text and the transcript is assembled PARTIAL', async () => {
    let release: () => void = () => {};
    const held = new Promise<never>((_resolve, reject) => {
      release = () => reject(new Error('the test is over'));
    });
    held.catch(() => {});
    const silent: FetchLike = async (input) => {
      if (input.endsWith('/v1/models')) return new Response(JSON.stringify({ data: [{ id: SERVER_MODEL }] }), { status: 200 });
      return held;
    };
    const m = mount('run-silent', serverRow(ENDPOINT), { fetchImpl: silent });
    const id = 'SES-20310101-0103';
    await recording(m, id, 20);
    await m.control.runs.begin(id);
    m.control.runs.end(id, { recorded: true });
    // The runner hangs in its engine: nothing is assembled, and the seal is told so.
    expect(await m.control.runs.availability(id)).toEqual({ kind: 'AVAILABLE' });
    expect(await m.control.runs.assemble(id)).toEqual({ kind: 'NOT_READY' });

    const closed = await m.control.runs.closeOut(id, 'TIMEOUT');
    if (closed.kind !== 'ASSEMBLED') throw new Error(`the close-out answered ${closed.kind}`);
    expect(closed.record.state).toBe('PARTIAL');
    expect(closed.record.failedChunks).toBeGreaterThanOrEqual(1);
    expect(closed.failedChunkCodes.length).toBe(closed.record.failedChunks);
    expect(new Set(closed.failedChunkCodes)).toEqual(new Set(['TIMEOUT']));
    expect(m.control.runs.status(id)).toMatchObject({ phase: 'CLOSED_OUT', closed: true });
    release();
  });
});

/**
 * A stand-in for `whisper-cli` (the form of `apps/transcriber`'s own test engine): it reads no
 * model, writes one segment per run in the engine's JSON form and exits. THE ENGINE DOUBLE of the
 * production provider's proof: everything else of the cpu-local path is the product's.
 */
const ENGINE_DOUBLE = `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
const value = (flag) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
if (!args.includes('-ng') || !fs.existsSync(value('-f'))) process.exit(9);
fs.writeFileSync(value('-of') + '.json', JSON.stringify({ systeminfo: 'stand-in', params: { model: value('-m'), language: value('-l') }, result: { language: value('-l') }, transcription: [{ timestamps: { from: '00:00:00,200', to: '00:00:01,400' }, offsets: { from: 200, to: 1400 }, text: ' Selamat pagi.' }] }));
`;

/**
 * The product runs a cpu-local engine ONLY at a lowered priority (`priority: 'required'`, D91). A
 * sandbox that forbids the system call cannot run the engine double at all: the case that needs it
 * is then SKIPPED BY NAME (never green without having run) - run this file outside the sandbox.
 */
const HOST_LOWERS_PRIORITY = ((): boolean => {
  const probe = spawnSync('/usr/bin/nice', ['-n', '10', process.execPath, '-e', "process.stdout.write(String(require('node:os').getPriority()))"], { encoding: 'utf8' });
  return probe.status === 0 && /^-?[0-9]+$/.test(probe.stdout.trim()) && Number(probe.stdout.trim()) >= Math.min(getPriority() + 10, 19);
})();

/** A data directory whose cpu-local engine is the double and whose model file is `bytes`; `versions` is what the host states. */
function cpuMount(slug: string, bytes: Buffer, versions: Record<string, string> | null): Mounted {
  const dir = makeDataDir(slug);
  dirs.push(dir.dataDir);
  writeFileSync(dir.binaryPath, ENGINE_DOUBLE);
  chmodSync(dir.binaryPath, 0o755);
  writeFileSync(join(dir.modelDir, `${CPU_MODEL}.bin`), bytes);
  dir.writeHost({ version: 1, cpuLocal: { binaryPath: dir.binaryPath, modelDir: dir.modelDir, ...(versions === null ? {} : { modelVersions: versions }) } });
  return mount(slug, cpuRow(), { dir, provenance: 'PRODUCTION' });
}

describe('THE PRODUCTION PROVIDER behind the provenance port (integration pass D8; manifest fields 84 to 87)', () => {
  it.runIf(HOST_LOWERS_PRIORITY)('cpu-local, every member has its source: the seal gets ASSEMBLED with name = the adapter identifier, version = the host statement, quantisation = the model file header, SHA-256 = the hash of the model file', async () => {
    const bytes = ggmlBytes(8, 'the weights of this test');
    const m = cpuMount('run-prov-ok', bytes, { [CPU_MODEL]: 'v3-turbo' });
    const id = 'SES-20310101-0110';
    await recording(m, id, 40);
    expect(await m.control.runs.begin(id)).toMatchObject({ phase: 'RUNNING', opened: 'ENABLED', code: null });
    m.control.runs.end(id, { recorded: true });
    await m.control.runs.idle();
    expect(m.control.runs.status(id)).toMatchObject({ phase: 'COMPLETE', code: null });
    expect(await m.control.runs.availability(id)).toEqual({ kind: 'AVAILABLE' });
    const answer = await m.control.runs.assemble(id);
    if (answer.kind !== 'ASSEMBLED') throw new Error(`the seal was answered ${answer.kind}`);
    expect([answer.record.state, answer.failedChunkCodes]).toEqual(['ASSEMBLED', []]);
    expect(answer.record.model).toMatchObject({ name: CPU_MODEL, version: 'v3-turbo', quantisation: 'q5_0', modelSha256: createHash('sha256').update(bytes).digest('hex'), params: { backend: 'cpu-local', modelId: CPU_MODEL } });
    expect(m.transport.calls).toEqual([]);
  });

  it('cpu-local, the host states no version for the model: transcribed while it records, NO document, UNAVAILABLE named MODEL_VERSION_NOT_STATED in the answer and in the error log', async () => {
    const m = cpuMount('run-prov-nover', ggmlBytes(8), null);
    const id = 'SES-20310101-0111';
    await recording(m, id, 10);
    expect(await m.control.runs.begin(id)).toMatchObject({ phase: 'RUNNING', opened: 'ENABLED', code: ModelProvenanceCode.VERSION_NOT_STATED });
    m.control.runs.end(id, { recorded: true });
    await m.control.runs.idle();
    expect(await m.control.runs.availability(id)).toEqual({ kind: 'UNAVAILABLE', code: ModelProvenanceCode.VERSION_NOT_STATED });
    expect(await m.control.runs.assemble(id)).toEqual({ kind: 'NOT_READY' });
    expect(existsSync(m.control.runs.locate(id).json)).toBe(false);
    expect(codes(m)).toContain(ModelProvenanceCode.VERSION_NOT_STATED);
  });

  it('omlx-server (D160): the seal gets ASSEMBLED with name = the identifier of the snapshot and version, quantisation and file hash NULL; the document says the same', async () => {
    const m = mount('run-prov-omlx', serverRow(ENDPOINT), { provenance: 'PRODUCTION' });
    const id = 'SES-20310101-0112';
    await recording(m, id, 40);
    expect(await m.control.runs.begin(id)).toMatchObject({ phase: 'RUNNING', opened: 'ENABLED', code: null });
    m.control.runs.end(id, { recorded: true });
    await m.control.runs.idle();
    expect(await m.control.runs.availability(id)).toEqual({ kind: 'AVAILABLE' });
    const answer = await m.control.runs.assemble(id);
    if (answer.kind !== 'ASSEMBLED') throw new Error(`the seal was answered ${answer.kind}`);
    expect([answer.record.state, answer.failedChunkCodes]).toEqual(['ASSEMBLED', []]);
    expect(answer.record.model).toEqual({ name: SERVER_MODEL, version: null, quantisation: null, modelSha256: null, params: { backend: 'omlx-server', modelId: SERVER_MODEL, language: 'id' } });
    const header = (JSON.parse(readFileSync(answer.files.json, 'utf8')) as { header: { backend: string; model: unknown } }).header;
    expect([header.backend, header.model]).toEqual(['omlx-server', { id: SERVER_MODEL, name: SERVER_MODEL, version: null, quantisation: null, sha256: null }]);
    expect(codes(m)).not.toContain(ModelProvenanceCode.NOT_FOR_BACKEND);
  });

  it('CONTROL (D160): a careless provider that states a version, a quantisation and a hash for a SERVER session is refused at the port - NO document, UNAVAILABLE named MODEL_PROVENANCE_NOT_FOR_BACKEND; only the hash invented: the same', async () => {
    for (const [slug, id, stated] of [
      ['run-prov-invented', 'SES-20310101-0113', INVENTED],
      ['run-prov-invhash', 'SES-20310101-0114', { ...PROVENANCE, sha256: INVENTED.sha256 }],
    ] as const) {
      const m = mount(slug, serverRow(ENDPOINT), { provenance: stated });
      await recording(m, id, 10);
      expect(await m.control.runs.begin(id)).toMatchObject({ phase: 'RUNNING', opened: 'ENABLED', code: ModelProvenanceCode.NOT_FOR_BACKEND });
      m.control.runs.end(id, { recorded: true });
      await m.control.runs.idle();
      expect(await m.control.runs.availability(id)).toEqual({ kind: 'UNAVAILABLE', code: ModelProvenanceCode.NOT_FOR_BACKEND });
      expect(await m.control.runs.assemble(id)).toEqual({ kind: 'NOT_READY' });
      expect(existsSync(m.control.runs.locate(id).json)).toBe(false);
      expect(codes(m)).toContain(ModelProvenanceCode.NOT_FOR_BACKEND);
    }
  });

  it('CONTROL (D160): nothing is loosened for cpu-local - a provider that leaves the file hash null for a cpu-local session is refused at the port, NO document', async () => {
    const dir = makeDataDir('run-prov-cpunull');
    dirs.push(dir.dataDir);
    writeFileSync(dir.binaryPath, ENGINE_DOUBLE);
    chmodSync(dir.binaryPath, 0o755);
    writeFileSync(join(dir.modelDir, `${CPU_MODEL}.bin`), ggmlBytes(8));
    dir.writeHost({ version: 1, cpuLocal: { binaryPath: dir.binaryPath, modelDir: dir.modelDir } });
    const m = mount('run-prov-cpunull', cpuRow(), { dir, provenance: { name: CPU_MODEL, version: 'v3-turbo', quantisation: 'q5_0', sha256: null } });
    const id = 'SES-20310101-0115';
    await recording(m, id, 10);
    expect(await m.control.runs.begin(id)).toMatchObject({ phase: 'RUNNING', opened: 'ENABLED', code: ModelProvenanceCode.NOT_FOR_BACKEND });
    m.control.runs.end(id, { recorded: true });
    await m.control.runs.idle();
    expect(await m.control.runs.availability(id)).toEqual({ kind: 'UNAVAILABLE', code: ModelProvenanceCode.NOT_FOR_BACKEND });
    expect(await m.control.runs.assemble(id)).toEqual({ kind: 'NOT_READY' });
  });
});

describe('nothing is opened for a session that is not to be transcribed', () => {
  it('STT disabled in the snapshot: no session, no request, no directory; the seal is told DISABLED', async () => {
    const m = mount('run-off', serverRow(ENDPOINT, { enabled: false }));
    const id = 'SES-20310101-0104';
    expect(await m.control.snapshotSttConfigForSession(id)).toMatchObject({ ok: true, snapshot: { enabled: false } });
    expect(await m.control.runs.begin(id)).toMatchObject({ phase: 'NOT_OPENED', opened: 'DISABLED', closed: false });
    m.control.runs.end(id, { recorded: true });
    await m.control.runs.idle();
    expect(await m.control.runs.availability(id)).toEqual({ kind: 'DISABLED' });
    expect(m.transport.calls).toEqual([]);
    expect(existsSync(sessionScratchDir(m.dir.dataDir, id))).toBe(false);
  });

  it('no snapshot: nothing is opened and the configuration as it is NOW is never used; the seal is told NO_SNAPSHOT', async () => {
    const m = mount('run-none', serverRow(ENDPOINT));
    const id = 'SES-20310101-0105';
    expect(await m.control.runs.availability(id)).toEqual({ kind: 'NO_SNAPSHOT' });
    expect(m.control.runs.status(id)).toMatchObject({ phase: 'NOT_OPENED', opened: 'NO_SNAPSHOT' });
    expect(m.transport.calls).toEqual([]);
  });

  it('a failed start: end(recorded: false) closes the session and nothing more runs; the seal would be told that nothing was recorded', async () => {
    const m = mount('run-failed', serverRow(ENDPOINT));
    const id = 'SES-20310101-0106';
    await recording(m, id, 5);
    await m.control.runs.begin(id);
    m.control.runs.end(id, { recorded: false });
    await m.control.runs.idle();
    expect(m.control.runs.status(id)).toMatchObject({ phase: 'ABANDONED', closed: true });
    expect(await m.control.runs.availability(id)).toEqual({ kind: 'UNAVAILABLE', code: 'NOTHING_RECORDED' });
  });
});

describe('after a restart of the Core the seal reads the same seam', () => {
  it('a run that is not in memory is opened again from the snapshot and the checkpoint, finished, and assembled', async () => {
    const first = mount('run-restart', serverRow(ENDPOINT));
    const id = 'SES-20310101-0107';
    await recording(first, id, 40);
    await first.control.runs.begin(id);
    // The Core goes down while the session records: its runs are gone with it.
    first.control.runs.shutdown();

    const second = mount('run-restart', serverRow(ENDPOINT), { dir: first.dir, snapshots: first.snapshots });
    expect(second.control.runs.status(id)).toBeNull();
    expect(await second.control.runs.availability(id)).toEqual({ kind: 'AVAILABLE' });
    await second.control.runs.idle();
    expect(second.control.runs.status(id)).toMatchObject({ phase: 'COMPLETE', opened: 'ENABLED', closed: true });
    const answer = await second.control.runs.assemble(id);
    expect(answer.kind === 'ASSEMBLED' ? answer.record.state : answer.kind).toBe('ASSEMBLED');
  });
});
