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
import { ModelProvenanceCode, READ_SESSION_INTERVALS_FOR_TRANSCRIPT, SessionRunCode, createMemorySnapshotStore, mountTranscription, sessionScratchDir, sessionTapPath, transcriptIntervalsOf, type StoredSttSelection, type SttSnapshotStore, type TranscriptionControl } from '../index';
import { CPU_MODEL, SERVER_MODEL, answerer, cpuRow, fakeHost, fullHost, ggmlBytes, makeDataDir, serverRow, writeTap, type Answerer, type DataDir, type FakeHost, mediaOf } from './support';

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
  writeTap(sessionTapPath(mediaOf(m.dir.dataDir), sessionId), seconds);
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
    expect(existsSync(sessionScratchDir(mediaOf(m.dir.dataDir), id))).toBe(false);
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

/** The checkpoint and the sealed document of a session, as they are on the disk. */
const checkpointOf = (m: Mounted, id: string): { chunks: { startMs: number; audioSource: string | null; status: string }[]; qaFlags: string[] } => JSON.parse(readFileSync(join(sessionScratchDir(mediaOf(m.dir.dataDir), id), 'transcript-checkpoint.json'), 'utf8'));
const documentOf = (path: string): { qa_flags: string[]; intervals: unknown[] } => JSON.parse(readFileSync(path, 'utf8'));

describe('R80-02 (code review row 80): the production runner is given the audio-source intervals of its session', () => {
  it('a switch inside the session: every chunk names the source of its start, and the sealed document does NOT carry `intervals_incomplete`', async () => {
    const m = mount('fm6-intervals', serverRow(ENDPOINT));
    const id = 'SES-20310101-0201';
    // START on MIC-01, a switch to MIC-02 at 15 s of media time: the rows row 71b writes.
    m.host.intervalRows = [
      { mic_device_id: 'MIC-01', from_media_ms: 0, to_media_ms: 15_000 },
      { mic_device_id: 'MIC-02', from_media_ms: 15_000, to_media_ms: null },
    ];
    await recording(m, id, 70);
    await m.control.runs.begin(id);
    m.control.runs.end(id, { recorded: true });
    await m.control.runs.idle();
    const answer = await m.control.runs.assemble(id);
    if (answer.kind !== 'ASSEMBLED') throw new Error(`the seal was answered ${answer.kind}`);
    const { chunks, qaFlags } = checkpointOf(m, id);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.map((chunk) => chunk.audioSource)).toEqual(chunks.map((chunk) => (chunk.startMs < 15_000 ? 'MIC-01' : 'MIC-02')));
    expect(new Set(chunks.map((chunk) => chunk.audioSource))).toEqual(new Set(['MIC-01', 'MIC-02']));
    expect(qaFlags).not.toContain('intervals_incomplete');
    expect(documentOf(answer.files.json).qa_flags).not.toContain('intervals_incomplete');
    expect(answer.record.state).toBe('ASSEMBLED');
  });

  it('CONTROL: intervals that really are incomplete (no row covers the later audio) raise the flag, and that chunk names no source', async () => {
    const m = mount('fm6-intervals-gap', serverRow(ENDPOINT));
    const id = 'SES-20310101-0202';
    m.host.intervalRows = [{ mic_device_id: 'MIC-01', from_media_ms: 0, to_media_ms: 15_000 }];
    await recording(m, id, 70);
    await m.control.runs.begin(id);
    m.control.runs.end(id, { recorded: true });
    await m.control.runs.idle();
    const answer = await m.control.runs.assemble(id);
    if (answer.kind !== 'ASSEMBLED') throw new Error(`the seal was answered ${answer.kind}`);
    const { chunks } = checkpointOf(m, id);
    expect(chunks.map((chunk) => chunk.audioSource)).toEqual(chunks.map((chunk) => (chunk.startMs < 15_000 ? 'MIC-01' : null)));
    expect(documentOf(answer.files.json).qa_flags).toContain('intervals_incomplete');
  });

  // Task 4 row 191c (decision C73; row 191b's second remainder): the rows of a capture worker that was replaced.
  it('a worker restart after a microphone switch: no chunk is attributed to a superseded row - every chunk names the LATER worker\'s source, the superseded rows are in the document with the span 0..0, and no `intervals_incomplete`', async () => {
    const m = mount('row191c-restart', serverRow(ENDPOINT));
    const id = 'SES-20310101-0203';
    // What row 191b stores: the earlier worker's START row kept its span up to the switch, the row of the switch was
    // closed where it began when its worker went down, and the later worker's audio is a NEW row of reason START.
    const stored = [
      { mic_device_id: 'MIC-02', from_media_ms: 0, to_media_ms: 15_000, reason: 'START' },
      { mic_device_id: 'MIC-01', from_media_ms: 15_000, to_media_ms: 15_000, reason: 'MANUAL' },
      { mic_device_id: 'MIC-01', from_media_ms: 0, to_media_ms: null, reason: 'START' },
    ];
    m.host.intervalRows = stored;
    // The rule alone, and its two controls: as stored when no row says START (a double of before), and when the only START row is the first.
    expect(transcriptIntervalsOf(stored)).toEqual([
      { source: 'MIC-02', fromMs: 0, toMs: 0 },
      { source: 'MIC-01', fromMs: 0, toMs: 0 },
      { source: 'MIC-01', fromMs: 0, toMs: null },
    ]);
    expect(transcriptIntervalsOf(stored.map(({ reason: _reason, ...row }) => row))).toEqual([
      { source: 'MIC-02', fromMs: 0, toMs: 15_000 },
      { source: 'MIC-01', fromMs: 15_000, toMs: 15_000 },
      { source: 'MIC-01', fromMs: 0, toMs: null },
    ]);
    expect(transcriptIntervalsOf([{ mic_device_id: 'MIC-01', from_media_ms: '21', to_media_ms: '4021', reason: 'START' }, { mic_device_id: 'MIC-02', from_media_ms: '4021', to_media_ms: null, reason: 'MANUAL' }])).toEqual([
      { source: 'MIC-01', fromMs: 21, toMs: 4_021 },
      { source: 'MIC-02', fromMs: 4_021, toMs: null },
    ]);

    await recording(m, id, 70);
    await m.control.runs.begin(id);
    m.control.runs.end(id, { recorded: true });
    await m.control.runs.idle();
    const answer = await m.control.runs.assemble(id);
    if (answer.kind !== 'ASSEMBLED') throw new Error(`the seal was answered ${answer.kind}`);
    const { chunks, qaFlags } = checkpointOf(m, id);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.some((chunk) => chunk.startMs < 15_000)).toBe(true);
    // Read as stored, a chunk below 15 s was covered by MIC-02's superseded row AND the later row: no source, and the flag.
    expect(chunks.map((chunk) => chunk.audioSource)).toEqual(chunks.map(() => 'MIC-01'));
    expect(qaFlags).not.toContain('intervals_incomplete');
    const document = documentOf(answer.files.json);
    expect(document.qa_flags).not.toContain('intervals_incomplete');
    expect(document.intervals).toEqual([
      { source: 'MIC-02', from_ms: 0, to_ms: 0 },
      { source: 'MIC-01', from_ms: 0, to_ms: 0 },
      { source: 'MIC-01', from_ms: 0, to_ms: null },
    ]);
    expect(m.host.statements.some((text) => text === READ_SESSION_INTERVALS_FOR_TRANSCRIPT && text.includes('reason'))).toBe(true);
  });
});

/** A transport whose transcription answers wait at a gate the test opens: a SLOW engine that then answers with text. */
function gated(): { fetchImpl: FetchLike; asked: () => number; open: () => void } {
  let asked = 0;
  let open: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    open = resolve;
  });
  const fetchImpl: FetchLike = async (input) => {
    if (input.endsWith('/v1/models')) return new Response(JSON.stringify({ data: [{ id: SERVER_MODEL }] }), { status: 200 });
    asked += 1;
    await gate;
    return new Response(JSON.stringify({ text: 'terlambat', language: 'id', segments: [{ start: 0.2, end: 1.4, text: 'terlambat' }] }), { status: 200 });
  };
  return { fetchImpl, asked: () => asked, open };
}
const turns = async (count = 40): Promise<void> => {
  for (let index = 0; index < count; index += 1) await new Promise<void>((resolve) => setImmediate(resolve));
};
const until = async (holds: () => boolean): Promise<void> => {
  for (let index = 0; index < 400 && !holds(); index += 1) await new Promise<void>((resolve) => setTimeout(resolve, 5));
  if (!holds()) throw new Error('the awaited state of the test was not reached');
};
/** Every statement that WRITES a chunk row. */
const chunkWrites = (m: Mounted): string[] => m.host.statements.filter((text) => text.includes('transcript_chunks') && /^\s*(INSERT|UPDATE)/i.test(text));
const scratchBytes = (m: Mounted, id: string): Record<string, string> => {
  const dir = sessionScratchDir(mediaOf(m.dir.dataDir), id);
  return Object.fromEntries(['transcript-checkpoint.json', 'transcript.json', 'transcript.srt', 'transcript.vtt'].map((name) => [name, createHash('sha256').update(readFileSync(join(dir, name))).digest('hex')]));
};

describe('R80-03 (code review row 80): after the close-out of the seal nothing of the session\'s own runner writes any more', () => {
  it('a slow chunk that finishes AFTER the close-out changes no chunk row and no file, and no further chunk is asked of the backend', async () => {
    const slow = gated();
    const m = mount('fm6-closeout-stop', serverRow(ENDPOINT), { fetchImpl: slow.fetchImpl });
    const id = 'SES-20310101-0301';
    await recording(m, id, 70);
    await m.control.runs.begin(id);
    m.control.runs.end(id, { recorded: true });
    // The session's own runner is inside its engine call for the first chunk.
    await until(() => slow.asked() >= 1);

    const closed = await m.control.runs.closeOut(id, 'TIMEOUT');
    if (closed.kind !== 'ASSEMBLED') throw new Error(`the close-out answered ${closed.kind}`);
    expect(closed.record.state).toBe('PARTIAL');
    const failed = closed.record.failedChunks;
    expect(failed).toBeGreaterThanOrEqual(2);
    const files = scratchBytes(m, id);
    const writes = chunkWrites(m).length;
    const asked = slow.asked();

    // THE ENGINE ANSWERS NOW, with text, for the chunk the seal already signed as FAILED.
    slow.open();
    await turns();
    await m.control.runs.idle();
    await turns();

    expect(scratchBytes(m, id)).toEqual(files);
    expect(chunkWrites(m).length).toBe(writes);
    expect(slow.asked()).toBe(asked);
    const { chunks } = checkpointOf(m, id);
    expect(chunks.filter((chunk) => chunk.status === 'FAILED').length).toBe(failed);
    expect(chunks.some((chunk) => chunk.status === 'DONE')).toBe(false);
    expect(m.control.runs.status(id)).toMatchObject({ phase: 'CLOSED_OUT', closed: true });
  });

  it('CONTROL: without a close-out the same slow answer IS committed - the checkpoint, the rows and the next request all move', async () => {
    const slow = gated();
    const m = mount('fm6-closeout-control', serverRow(ENDPOINT), { fetchImpl: slow.fetchImpl });
    const id = 'SES-20310101-0302';
    await recording(m, id, 70);
    await m.control.runs.begin(id);
    m.control.runs.end(id, { recorded: true });
    await until(() => slow.asked() >= 1);
    const writes = chunkWrites(m).length;
    slow.open();
    await m.control.runs.idle();
    expect(slow.asked()).toBeGreaterThanOrEqual(2);
    expect(chunkWrites(m).length).toBeGreaterThan(writes);
    expect(checkpointOf(m, id).chunks.every((chunk) => chunk.status === 'DONE')).toBe(true);
  });

  it('a failed start (end recorded: false) and a shutdown stop a step in flight the same way: its late answer writes nothing', async () => {
    for (const how of ['failed-start', 'shutdown'] as const) {
      const slow = gated();
      const m = mount(`fm6-stop-${how}`, serverRow(ENDPOINT), { fetchImpl: slow.fetchImpl });
      const id = how === 'failed-start' ? 'SES-20310101-0303' : 'SES-20310101-0304';
      await recording(m, id, 70);
      await m.control.runs.begin(id);
      await until(() => slow.asked() >= 1);
      const before = createHash('sha256').update(readFileSync(join(sessionScratchDir(mediaOf(m.dir.dataDir), id), 'transcript-checkpoint.json'))).digest('hex');
      const writes = chunkWrites(m).length;
      if (how === 'failed-start') m.control.runs.end(id, { recorded: false });
      else m.control.runs.shutdown();
      slow.open();
      await turns();
      expect(slow.asked(), how).toBe(1);
      expect(chunkWrites(m).length, how).toBe(writes);
      if (how === 'shutdown') expect(createHash('sha256').update(readFileSync(join(sessionScratchDir(mediaOf(m.dir.dataDir), id), 'transcript-checkpoint.json'))).digest('hex'), how).toBe(before);
    }
  });
});

// Fix wave K, driver S1 (appended; nothing above was changed).
describe('G81b-04 (re-gate 81): the document of an INTERRUPTED recording records `intervals_incomplete`; a stopped one is as before', () => {
  /** The committed state of an engine whose session ended at a fault while RECORDING and is being sealed. */
  const interruptedState = (sessionId: string) => ({ evidence: [], session: { id: sessionId, state: 'FINALIZING', startedAt: 1, stoppedAt: 2, fault: { kind: 'CAPTURE_FAULT', at: 2, fromState: 'RECORDING' } } });
  const stoppedState = (sessionId: string) => ({ evidence: [], session: { id: sessionId, state: 'FINALIZING', startedAt: 1, stoppedAt: 2, fault: null } });

  async function assembledWith(slug: string, id: string, state: unknown) {
    const m = mount(slug, serverRow(ENDPOINT));
    Object.assign(m.host.app, { engine: { state: () => state } });
    // What the Core stores for a recording that ended at a fault: the interval was never closed.
    m.host.intervalRows = [{ mic_device_id: 'MIC-01', from_media_ms: 21, to_media_ms: null }];
    await recording(m, id, 40);
    await m.control.runs.begin(id);
    m.control.runs.end(id, { recorded: true });
    await m.control.runs.idle();
    const answer = await m.control.runs.assemble(id);
    if (answer.kind !== 'ASSEMBLED') throw new Error(`the seal was answered ${answer.kind}`);
    return documentOf(answer.files.json);
  }

  it('interrupted (the session ended at a fault while RECORDING): the interval keeps `to_ms: null` and the document says `intervals_incomplete`', async () => {
    const document = await assembledWith('wavek-s1-interrupted', 'SES-20310101-0401', interruptedState('SES-20310101-0401'));
    expect(document.intervals).toEqual([{ source: 'MIC-01', from_ms: 21, to_ms: null }]);
    expect(document.qa_flags).toContain('intervals_incomplete');
  });

  it('CONTROL - the same rows of a session that was STOPPED, and of an app without an engine behind the seam: no flag (the document of before)', async () => {
    const stopped = await assembledWith('wavek-s1-stopped', 'SES-20310101-0402', stoppedState('SES-20310101-0402'));
    expect(stopped.intervals).toEqual([{ source: 'MIC-01', from_ms: 21, to_ms: null }]);
    expect(stopped.qa_flags).not.toContain('intervals_incomplete');
    // The engine names ANOTHER session: nothing is said about this one.
    const other = await assembledWith('wavek-s1-other', 'SES-20310101-0403', interruptedState('SES-20310101-0999'));
    expect(other.qa_flags).not.toContain('intervals_incomplete');
  });
});

describe('G75c-08 (re-gate 75): no statement of the chunk mirror after the server began to close', () => {
  function mountWithHooks(slug: string) {
    const dir = makeDataDir(slug);
    dirs.push(dir.dataDir);
    dir.writeHost(fullHost(dir));
    const host = fakeHost(dir.dataDir, 'real');
    const hooks: { name: string; hook: () => Promise<void> }[] = [];
    Object.assign(host.app, { addHook: (name: string, hook: () => Promise<void>) => void hooks.push({ name, hook }) });
    const transport = answerer();
    const control = mountTranscription(host.app, { readConfig: async () => serverRow(ENDPOINT), snapshots: createMemorySnapshotStore(), fetchImpl: transport.fetchImpl, sessionStepIntervalMs: 5, modelProvenance: async () => PROVENANCE });
    return { m: { host, control, transport, dir, snapshots: createMemorySnapshotStore() } as Mounted, hooks };
  }
  const mirrorStatements = (host: FakeHost): string[] => host.statements.filter((text) => text.includes('transcript_chunks'));

  it('the unit asks for the BEGINNING of the close; after it a session that goes on writes its checkpoint and sends NO mirror statement and no error line', async () => {
    const { m, hooks } = mountWithHooks('wavek-s1-mirror-closed');
    expect(hooks.map((entry) => entry.name)).toEqual(['preClose']);
    const id = 'SES-20310101-0411';
    await recording(m, id, 40);
    // The close begins BEFORE the runner writes anything.
    await hooks[0]?.hook();
    await m.control.runs.begin(id);
    m.control.runs.end(id, { recorded: true });
    await m.control.runs.idle();
    expect(checkpointOf(m, id).chunks.length).toBeGreaterThanOrEqual(1);
    expect(mirrorStatements(m.host)).toEqual([]);
    expect(m.host.everything()).not.toContain('MIRROR_WRITE_FAILED');
  });

  it('CONTROL - the same session on a server that is not closing sends its mirror statements', async () => {
    const { m } = mountWithHooks('wavek-s1-mirror-open');
    const id = 'SES-20310101-0412';
    await recording(m, id, 40);
    await m.control.runs.begin(id);
    m.control.runs.end(id, { recorded: true });
    await m.control.runs.idle();
    expect(mirrorStatements(m.host).length).toBeGreaterThan(0);
  });
});
