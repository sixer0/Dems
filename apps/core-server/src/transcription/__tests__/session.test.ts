// STT configuration at runtime (blueprint row 115; R-8 AC-4; transcript spec §B.4, §B.7, §D;
// checks `M6-STTCFG-NEXT`, the runtime half of `M6-STTCFG-OFF`, pair-77 N-10 / N-17).
//
// The composition is mounted on an in-process host (`support.ts`): a controllable clock (no wall
// waits), a stored row the test changes as operation 91 would, an in-process transport that
// records every request, the memory mirror of `transcript_chunks` (it refuses what the table
// refuses) and a synthetic tap. The pipeline is the REAL one of `@dems/transcriber`; only the
// engine's answer is a stand-in.
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMemoryChunkMirror, SerialQueue, TRANSCRIPT_CHECKPOINT_FILE, type MemoryChunkMirror } from '@dems/transcriber';
import { afterAll, describe, expect, it } from 'vitest';
import {
  CHECKPOINT_RECOVERY_LIMIT,
  MEMORY_SNAPSHOT_SESSIONS,
  createCoreTranscriberLog,
  createMemorySnapshotStore,
  mountTranscription,
  openSessionTranscription,
  readTranscriberHost,
  revealSttCredential,
  sessionScratchDir,
  sessionTapPath,
  transcriptionControl,
  type SessionCompositionDeps,
  type SttSessionWarning,
  type StoredSttSelection,
  type TranscriptionControl,
} from '../index';
import { KEY_CANARY, SERVER_MODEL, answerer, cpuRow, fakeHost, fullHost, makeDataDir, serverRow, writeTap, type Answerer, type FakeHost } from './support';

const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

const ENDPOINT_A = 'http://127.0.0.1:18901';
const ENDPOINT_B = 'http://127.0.0.1:18902';

interface Mounted {
  readonly host: FakeHost;
  readonly control: TranscriptionControl;
  readonly transport: Answerer;
  readonly dataDir: string;
  /** The stored row: the test replaces it, as operation 91 does. */
  stored: StoredSttSelection | null;
}

function mount(slug: string, stored: StoredSttSelection | null, more: { fetchImpl?: Answerer['fetchImpl']; availabilityTimeoutMs?: number } = {}): Mounted {
  const dir = makeDataDir(slug);
  dirs.push(dir.dataDir);
  dir.writeHost(fullHost(dir));
  const host = fakeHost(dir.dataDir);
  const transport = answerer();
  const mounted: Mounted = {
    host,
    transport,
    dataDir: dir.dataDir,
    stored,
    control: mountTranscription(host.app, { readConfig: async () => mounted.stored, snapshots: createMemorySnapshotStore(), fetchImpl: more.fetchImpl ?? transport.fetchImpl, ...(more.availabilityTimeoutMs === undefined ? {} : { availabilityTimeoutMs: more.availabilityTimeoutMs }) }),
  };
  return mounted;
}

describe('M6-STTCFG-NEXT: a change while a session is open applies to the NEXT session (fake clock)', () => {
  it('the open session keeps the snapshot of its start: backend, endpoint and model are the old ones, in the adapter and on the wire', async () => {
    const m = mount('next', serverRow(ENDPOINT_A));
    const t0 = m.host.now;
    const first = await m.control.snapshotSttConfigForSession('SES-20310101-0001');
    expect(first).toMatchObject({ ok: true, taken: true, snapshot: { sessionId: 'SES-20310101-0001', takenAt: t0, revision: 1, backend: 'omlx-server', endpoint: ENDPOINT_A, model: SERVER_MODEL } });
    await m.control.settled();

    // Operation 91 while the session is open: every member changes, the revision moves on.
    m.host.now += 90_000;
    m.stored = serverRow(ENDPOINT_B, { model: 'qwen3-asr-1.7b-8bit', diarization: false, revision: 2 });
    m.control.noteConfigChange(true);

    // Asked again for the same session (a retried start, a resume): the FIRST snapshot, not a new one.
    const again = await m.control.snapshotSttConfigForSession('SES-20310101-0001');
    expect(again).toMatchObject({ ok: true, taken: false, snapshot: { takenAt: t0, revision: 1, endpoint: ENDPOINT_A, model: SERVER_MODEL, diarization: true } });
    expect(await m.control.manifestSnapshot('SES-20310101-0001')).toEqual({ enabled: true, backend: 'omlx-server', model: SERVER_MODEL, diarization: true, revision: 1 });

    writeTap(sessionTapPath(m.dataDir, 'SES-20310101-0001'), 40);
    m.transport.calls.length = 0;
    const open = await m.control.openSession('SES-20310101-0001');
    if (open.state !== 'ENABLED') throw new Error(`the open session is ${open.state}`);
    expect([open.config.backend, open.config.model, open.adapter.backend, open.adapter.model]).toEqual(['omlx-server', SERVER_MODEL, 'omlx-server', SERVER_MODEL]);
    expect(open.config.backend === 'omlx-server' ? open.config.endpoint : null).toBe(ENDPOINT_A);
    const report = await open.step({ final: true });
    expect(report.complete).toBe(true);
    expect(report.decoded).toBeGreaterThanOrEqual(1);
    // On the wire: every transcription of the open session went to the endpoint of ITS snapshot.
    expect(m.transport.calls.length).toBe(report.decoded);
    expect(m.transport.calls.every((call) => call.startsWith(`POST ${ENDPOINT_A}/v1/audio/transcriptions`))).toBe(true);
    expect(m.transport.calls.some((call) => call.includes(ENDPOINT_B))).toBe(false);
    expect(open.runner.checkpoint()).toMatchObject({ backend: 'omlx-server', model: SERVER_MODEL });
    open.close();

    // THE NEXT SESSION takes the stored row as it is now.
    const next = await m.control.snapshotSttConfigForSession('SES-20310101-0002');
    expect(next).toMatchObject({ ok: true, taken: true, snapshot: { takenAt: t0 + 90_000, revision: 2, endpoint: ENDPOINT_B, model: 'qwen3-asr-1.7b-8bit', diarization: false } });
    await m.control.settled();
    writeTap(sessionTapPath(m.dataDir, 'SES-20310101-0002'), 10);
    m.transport.calls.length = 0;
    const second = await m.control.openSession('SES-20310101-0002');
    if (second.state !== 'ENABLED') throw new Error(`the next session is ${second.state}`);
    await second.step({ final: true });
    expect(m.transport.calls.length).toBeGreaterThanOrEqual(1);
    expect(m.transport.calls.every((call) => call.startsWith(`POST ${ENDPOINT_B}/`))).toBe(true);
    second.close();
    console.info(`[row115] M6-STTCFG-NEXT | open session: snapshot rev 1 -> ${report.decoded} chunk(s) to the endpoint of its start, 0 to the new one | next session: snapshot rev 2 -> the new endpoint | clock moved by the test only`);
  });

  it('switched OFF while a session is open: the open session goes on transcribing; switched ON while a disabled session is open: it stays without any transcriber work', async () => {
    const m = mount('next-off', serverRow(ENDPOINT_A));
    await m.control.snapshotSttConfigForSession('SES-20310101-0003');
    await m.control.settled();
    m.stored = serverRow(ENDPOINT_A, { enabled: false, revision: 2 });
    writeTap(sessionTapPath(m.dataDir, 'SES-20310101-0003'), 5);
    expect((await m.control.openSession('SES-20310101-0003')).state).toBe('ENABLED');

    await m.control.snapshotSttConfigForSession('SES-20310101-0004');
    m.stored = serverRow(ENDPOINT_B, { enabled: true, revision: 3 });
    m.transport.calls.length = 0;
    const disabled = await m.control.openSession('SES-20310101-0004');
    expect(disabled).toMatchObject({ state: 'DISABLED', snapshot: { enabled: false, revision: 2 } });
    expect(await m.control.tapPathFor('SES-20310101-0004')).toBeNull();
    expect(await m.control.manifestSnapshot('SES-20310101-0004')).toMatchObject({ enabled: false, revision: 2 });
  });
});

describe('the snapshot store (the stand-in of the session record)', () => {
  it('is write-once per session: a second `put` returns the first snapshot and stores nothing; it remembers a bounded number of sessions', async () => {
    const store = createMemorySnapshotStore();
    const first = await store.put({ ...serverRow(ENDPOINT_A), sessionId: 'SES-20310101-0100', takenAt: 1 });
    const second = await store.put({ ...serverRow(ENDPOINT_B, { revision: 9, enabled: false }), sessionId: 'SES-20310101-0100', takenAt: 2 });
    expect(second).toBe(first);
    expect(await store.get('SES-20310101-0100')).toMatchObject({ takenAt: 1, revision: 1, endpoint: ENDPOINT_A, enabled: true });
    expect(Object.isFrozen(first)).toBe(true);
    for (let index = 101; index <= 100 + MEMORY_SNAPSHOT_SESSIONS; index += 1) await store.put({ ...serverRow(ENDPOINT_A), sessionId: `SES-20310101-0${index}`, takenAt: index });
    expect(await store.get('SES-20310101-0100')).toBeNull();
    expect(await store.get(`SES-20310101-0${100 + MEMORY_SNAPSHOT_SESSIONS}`)).not.toBeNull();
  });
});

describe('STT disabled in the snapshot: no VAD, no STT, nothing built (the runtime half of M6-STTCFG-OFF)', () => {
  it('no request, no reveal, no directory, no tap path, no background check', async () => {
    const m = mount('off', cpuRow({ enabled: false }));
    const outcome = await m.control.snapshotSttConfigForSession('SES-20310101-0010');
    expect(outcome).toMatchObject({ ok: true, snapshot: { enabled: false } });
    await m.control.settled();
    const open = await m.control.openSession('SES-20310101-0010');
    expect(Object.keys(open).sort()).toEqual(['snapshot', 'state']);
    expect(open.state).toBe('DISABLED');
    expect(m.transport.calls).toEqual([]);
    expect(m.host.statements).toEqual([]);
    expect(existsSync(sessionScratchDir(m.dataDir, 'SES-20310101-0010'))).toBe(false);
    expect(await m.control.tapPathFor('SES-20310101-0010')).toBeNull();
    expect(m.host.lines.filter((line) => line.level !== 'info')).toEqual([]);
    // Control: the same host with STT enabled does make the directory and asks the backend once.
    m.stored = serverRow(ENDPOINT_A, { revision: 2 });
    await m.control.snapshotSttConfigForSession('SES-20310101-0011');
    await m.control.settled();
    expect(existsSync(sessionScratchDir(m.dataDir, 'SES-20310101-0011'))).toBe(true);
    expect(m.transport.calls).toEqual([`GET ${ENDPOINT_A}/v1/models`]);
    expect(await m.control.tapPathFor('SES-20310101-0011')).toBe(sessionTapPath(m.dataDir, 'SES-20310101-0011'));
  });

  it('a session without a snapshot is never transcribed with the configuration as it is now', async () => {
    const m = mount('nosnap', serverRow(ENDPOINT_A));
    const open = await m.control.openSession('SES-20310101-0020');
    expect(open).toEqual({ state: 'NO_SNAPSHOT', snapshot: null });
    expect(m.transport.calls).toEqual([]);
    expect(m.host.persisted.map((entry) => entry.context?.['reason'])).toEqual(['NO_SNAPSHOT']);
  });
});

describe('enabled but unreachable at session start: a warning, and the start never waits (RK-1)', () => {
  it('the snapshot call returns while the backend has not answered; the refusal then raises ONE warning in the log, the persistent log and to the listener', async () => {
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => (release = resolve));
    const calls: string[] = [];
    const m = mount('unreach', serverRow(ENDPOINT_A), {
      fetchImpl: async (input) => {
        calls.push(input);
        await held;
        throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
      },
    });
    const warnings: SttSessionWarning[] = [];
    m.control.onSessionWarning((warning) => void warnings.push(warning));

    const outcome = await m.control.snapshotSttConfigForSession('SES-20310101-0030');
    // The session start has its answer; the backend has been asked and has NOT answered yet.
    expect(outcome).toMatchObject({ ok: true, taken: true });
    await new Promise((resolve) => setImmediate(resolve));
    expect(calls).toEqual([`${ENDPOINT_A}/v1/models`]);
    expect(warnings).toEqual([]);

    release?.();
    await m.control.settled();
    expect(warnings).toEqual([{ sessionId: 'SES-20310101-0030', code: 'STT_BACKEND_UNAVAILABLE_AT_SESSION_START', detailCode: 'UNREACHABLE', backend: 'omlx-server', at: m.host.now }]);
    expect(m.host.persisted.filter((entry) => entry.code === 'STT_BACKEND_UNAVAILABLE_AT_SESSION_START')).toEqual([
      expect.objectContaining({ level: 'warn', source: 'transcription.sessionStart', context: { correlationId: 'SES-20310101-0030', backend: 'omlx-server', detailCode: 'UNREACHABLE' } }),
    ]);
    expect(m.host.lines.filter((line) => line.fields['code'] === 'STT_BACKEND_UNAVAILABLE_AT_SESSION_START')).toHaveLength(1);
    // The key of the settings file was loaded for the request: it is in nothing the host wrote.
    expect(m.host.everything()).not.toContain(KEY_CANARY);
    // The snapshot is there and the session can still be opened: an unreachable backend ends in FAILED chunks, not in a refusal.
    expect(await m.control.sessionSnapshot('SES-20310101-0030')).toMatchObject({ enabled: true });
  });

  it('a backend that never answers: the check gives up at its time limit (TIMEOUT); a reachable backend raises nothing', async () => {
    const never = mount('timeout', serverRow(ENDPOINT_A), { availabilityTimeoutMs: 25, fetchImpl: (_input, init) => new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))) });
    const warnings: SttSessionWarning[] = [];
    never.control.onSessionWarning((warning) => void warnings.push(warning));
    await never.control.snapshotSttConfigForSession('SES-20310101-0031');
    await never.control.settled();
    expect(warnings.map((warning) => warning.detailCode)).toEqual(['TIMEOUT']);

    const fine = mount('reach', serverRow(ENDPOINT_A));
    const none: SttSessionWarning[] = [];
    fine.control.onSessionWarning((warning) => void none.push(warning));
    await fine.control.snapshotSttConfigForSession('SES-20310101-0032');
    await fine.control.settled();
    expect(none).toEqual([]);
    expect(fine.host.persisted).toEqual([]);
  });

  it('the stored row cannot be read, or is not seeded: an outcome with a code, logged and persisted, never an exception', async () => {
    const m = mount('noread', null);
    expect(await m.control.snapshotSttConfigForSession('SES-20310101-0033')).toEqual({ ok: false, code: 'STT_CONFIG_NOT_SEEDED' });
    const dir = makeDataDir('noread2');
    dirs.push(dir.dataDir);
    const host = fakeHost(dir.dataDir);
    const control = mountTranscription(host.app, { readConfig: () => Promise.reject(Object.assign(new Error(`password ${KEY_CANARY} refused`), { code: '57P01' })) });
    expect(await control.snapshotSttConfigForSession('SES-20310101-0034')).toEqual({ ok: false, code: 'STT_CONFIG_READ_FAILED' });
    expect(host.persisted).toEqual([expect.objectContaining({ level: 'error', code: 'STT_CONFIG_READ_FAILED', context: { correlationId: 'SES-20310101-0034', errorName: 'Error', sqlstate: '57P01' } })]);
    // The message of the failure is not passed on: it could quote anything.
    expect(host.everything()).not.toContain(KEY_CANARY);
    expect(transcriptionControl(host.app)).toBe(control);
  });
});

// ── the session composition itself, with a mirror the test reads ────────────────────────────────

interface Composed {
  readonly deps: SessionCompositionDeps;
  readonly host: FakeHost;
  readonly mirror: MemoryChunkMirror;
  readonly transport: Answerer;
  readonly dataDir: string;
}

async function compose(slug: string, sessionId: string, seconds: number): Promise<Composed> {
  const dir = makeDataDir(slug);
  dirs.push(dir.dataDir);
  dir.writeHost(fullHost(dir));
  const host = fakeHost(dir.dataDir);
  const transport = answerer();
  const mirror = createMemoryChunkMirror();
  const snapshots = createMemorySnapshotStore();
  await snapshots.put({ ...serverRow(ENDPOINT_A), sessionId, takenAt: host.now });
  writeTap(sessionTapPath(dir.dataDir, sessionId), seconds);
  const deps: SessionCompositionDeps = {
    dataDir: dir.dataDir,
    host: () => readTranscriberHost(dir.dataDir, () => 8),
    snapshots,
    reveal: () => revealSttCredential({ query: (text) => host.app.db.pool.query(text) }),
    capture: host.capture,
    mirror,
    transcriberLog: createCoreTranscriberLog({ log: host.app.log, errorLog: host.app.errorLog, now: () => host.now }),
    queue: new SerialQueue(),
    now: () => host.now,
    fetchImpl: transport.fetchImpl,
  };
  return { deps, host, mirror, transport, dataDir: dir.dataDir };
}

describe('a torn or foreign checkpoint (pair-77 N-17): moved aside, logged, the session transcribed again in NEW rows', () => {
  const SESSION = 'SES-20310101-0040';

  it('control: an intact checkpoint is resumed - committed chunks are reused, nothing is decoded again', async () => {
    const c = await compose('cp-control', SESSION, 70);
    const first = await openSessionTranscription(c.deps, SESSION);
    if (first.state !== 'ENABLED') throw new Error(first.state);
    const report = await first.step({ final: true });
    expect(report.decoded).toBeGreaterThanOrEqual(2);
    first.close();
    const decodedOnce = c.transport.calls.length;
    const again = await openSessionTranscription(c.deps, SESSION);
    if (again.state !== 'ENABLED') throw new Error(again.state);
    expect(again.checkpointsMovedAside).toBe(0);
    const resumed = await again.step({ final: true });
    expect([resumed.decoded, resumed.reused]).toEqual([0, report.decoded]);
    expect(c.transport.calls.length).toBe(decodedOnce);
    again.close();
  });

  it('a torn file: kept under another name byte for byte, one persisted error with the reason, old rows untouched, new rows above them, text only from the engine', async () => {
    const c = await compose('cp-torn', SESSION, 70);
    const scratch = sessionScratchDir(c.dataDir, SESSION);
    const file = join(scratch, TRANSCRIPT_CHECKPOINT_FILE);
    const first = await openSessionTranscription(c.deps, SESSION);
    if (first.state !== 'ENABLED') throw new Error(first.state);
    const before = await first.step({ final: true });
    first.close();
    const oldRows = structuredClone(c.mirror.rows());
    expect(oldRows.length).toBe(before.decoded);
    expect(oldRows.every((row) => row.status === 'DONE')).toBe(true);

    // A writer died half-way: the first half of the file.
    const whole = readFileSync(file);
    const torn = whole.subarray(0, Math.floor(whole.length / 2));
    writeFileSync(file, torn);
    const callsBefore = c.transport.calls.length;
    c.host.persisted.length = 0;

    const reopened = await openSessionTranscription(c.deps, SESSION);
    if (reopened.state !== 'ENABLED') throw new Error(reopened.state);
    expect(reopened.checkpointsMovedAside).toBe(1);
    expect(readFileSync(`${file}.invalid-1`).equals(torn)).toBe(true);
    expect(c.host.persisted.filter((entry) => entry.context?.['code'] === 'CHECKPOINT_MOVED_ASIDE')).toEqual([
      expect.objectContaining({ level: 'error', source: 'transcription.session.checkpoint', code: 'CHECKPOINT_INVALID', context: expect.objectContaining({ reason: 'CHECKPOINT_NOT_JSON', aside: `${TRANSCRIPT_CHECKPOINT_FILE}.invalid-1`, correlationId: SESSION }) }),
    ]);

    const after = await reopened.step({ final: true });
    reopened.close();
    expect(after).toMatchObject({ complete: true, decoded: before.decoded, reused: 0 });
    const rows = c.mirror.rows();
    // The committed rows are exactly what they were; the new attempt is numbered above them.
    expect(rows.slice(0, oldRows.length)).toEqual(oldRows);
    const fresh = rows.slice(oldRows.length);
    expect(fresh.map((row) => row.seq)).toEqual(oldRows.map((_row, index) => oldRows.length + 1 + index));
    expect(fresh.map((row) => [row.audioFromMs, row.audioToMs])).toEqual(oldRows.map((row) => [row.audioFromMs, row.audioToMs]));
    // Never fabricated: every new segment is an answer the engine gave AFTER the recovery.
    const newTexts = fresh.flatMap((row) => (row.segments ?? []).map((segment) => segment.text));
    const oldTexts = oldRows.flatMap((row) => (row.segments ?? []).map((segment) => segment.text));
    expect(c.transport.calls.length - callsBefore).toBe(before.decoded);
    expect(newTexts.some((text) => oldTexts.includes(text))).toBe(false);
    expect(newTexts).toEqual(fresh.map((_row, index) => `kalimat ${before.decoded + 1 + index}`));
    expect(c.host.lines.some((line) => line.fields['reason'] === 'CHECKPOINT_REBUILT')).toBe(true);
    console.info(`[row115] N-17 torn checkpoint | reason=CHECKPOINT_NOT_JSON aside=.invalid-1 oldRows=${oldRows.length} (unchanged) newRows=${fresh.length} seq ${fresh[0]?.seq}..${fresh.at(-1)?.seq} decodedAgain=${after.decoded}`);
  });

  it('a checkpoint of another session is foreign: the same rule; at the limit the session is UNAVAILABLE instead of looping', async () => {
    const c = await compose('cp-foreign', SESSION, 12);
    const scratch = sessionScratchDir(c.dataDir, SESSION);
    const file = join(scratch, TRANSCRIPT_CHECKPOINT_FILE);
    const first = await openSessionTranscription(c.deps, SESSION);
    if (first.state !== 'ENABLED') throw new Error(first.state);
    await first.step({ final: true });
    first.close();
    const foreign = JSON.stringify({ ...JSON.parse(readFileSync(file, 'utf8')), sessionId: 'SES-20310101-9999' });

    for (let round = 1; round <= CHECKPOINT_RECOVERY_LIMIT; round += 1) {
      writeFileSync(file, foreign);
      const opened = await openSessionTranscription(c.deps, SESSION);
      expect(opened).toMatchObject({ state: 'ENABLED', checkpointsMovedAside: 1 });
      if (opened.state === 'ENABLED') opened.close();
    }
    expect(readdirSync(scratch).filter((name) => name.includes('.invalid-')).sort()).toEqual([1, 2, 3].map((index) => `${TRANSCRIPT_CHECKPOINT_FILE}.invalid-${index}`));
    expect(c.host.persisted.filter((entry) => entry.context?.['code'] === 'CHECKPOINT_MOVED_ASIDE').map((entry) => entry.context?.['reason'])).toEqual(Array(CHECKPOINT_RECOVERY_LIMIT).fill('CHECKPOINT_OF_ANOTHER_SESSION'));

    writeFileSync(file, foreign);
    const exhausted = await openSessionTranscription(c.deps, SESSION);
    expect(exhausted).toMatchObject({ state: 'UNAVAILABLE', code: 'CHECKPOINT_RECOVERY_EXHAUSTED' });
    // The file that could not be moved is still there, untouched.
    expect(readFileSync(file, 'utf8')).toBe(foreign);
    expect(c.host.persisted.at(-1)).toMatchObject({ level: 'error', context: expect.objectContaining({ reason: 'CHECKPOINT_RECOVERY_EXHAUSTED' }) });
  });
});

describe('the values a live session must state (pair-77 N-10, "What row 115 must pass")', () => {
  const SESSION = 'SES-20310101-0050';

  it('the tap signal is sticky and belongs to THIS session while it records', async () => {
    const c = await compose('tap', SESSION, 5);
    const open = await openSessionTranscription(c.deps, SESSION);
    if (open.state !== 'ENABLED') throw new Error(open.state);
    c.host.capture.state = { sessionId: SESSION, workerPid: 4242, phase: 'RECORDING' };
    c.host.capture.emitTelemetry(SESSION, true);
    c.host.capture.emitTelemetry('SES-20310101-0051', false);
    expect(open.tapLost()).toBe(false);
    // The tap of a session that is stopping ends: that is not a lost tap.
    c.host.capture.state = { sessionId: SESSION, workerPid: 4242, phase: 'STOPPING' };
    c.host.capture.emitTelemetry(SESSION, false);
    expect(open.tapLost()).toBe(false);
    c.host.capture.state = { sessionId: SESSION, workerPid: 4242, phase: 'RECORDING' };
    c.host.capture.emitTelemetry(SESSION, false);
    expect(open.tapLost()).toBe(true);
    c.host.capture.emitTelemetry(SESSION, true);
    expect(open.tapLost()).toBe(true);
    // The pipeline is told at its next step: PARTIAL, with the reason of the contract, no text made up.
    const report = await open.step({ final: true });
    expect(report).toMatchObject({ transcriptState: 'PARTIAL', partialReason: 'TRANSCRIPT_AUDIO_UNAVAILABLE' });
    expect(c.host.persisted.some((entry) => entry.context?.['reason'] === 'TAP_LOST')).toBe(true);
    open.close();
  });

  it('`hold` keeps the runner back between chunks and lets it go on; the caller`s own hold is asked too', async () => {
    const c = await compose('hold', SESSION, 70);
    let callerHolds = false;
    const open = await openSessionTranscription(c.deps, SESSION, { shouldPause: () => callerHolds });
    if (open.state !== 'ENABLED') throw new Error(open.state);
    open.hold(true);
    expect(await open.step({ final: true })).toMatchObject({ paused: true, decoded: 0 });
    open.hold(false);
    callerHolds = true;
    expect(await open.step({ final: true })).toMatchObject({ paused: true, decoded: 0 });
    callerHolds = false;
    const done = await open.step({ final: true });
    expect(done.complete).toBe(true);
    expect(done.decoded).toBeGreaterThanOrEqual(2);
    // One chunk at a time, through the one queue of the composition (§C).
    expect(c.deps.queue.maxObserved).toBe(1);
    open.close();
  });

  it('`cpu-local` in the snapshot: the adapter is the cpu-local one and it states the capture worker; a host without the engine is UNAVAILABLE, never a throw', async () => {
    const dir = makeDataDir('cpu');
    dirs.push(dir.dataDir);
    dir.writeHost(fullHost(dir));
    const host = fakeHost(dir.dataDir);
    const snapshots = createMemorySnapshotStore();
    await snapshots.put({ ...cpuRow(), sessionId: SESSION, takenAt: host.now });
    writeTap(sessionTapPath(dir.dataDir, SESSION), 2);
    const base = { dataDir: dir.dataDir, snapshots, reveal: async () => ({ kind: 'NONE' as const }), capture: host.capture, mirror: createMemoryChunkMirror(), log: createCoreTranscriberLog({ log: host.app.log, errorLog: host.app.errorLog, now: () => host.now }), queue: new SerialQueue(), now: () => host.now };
    const open = await openSessionTranscription({ ...base, host: () => readTranscriberHost(dir.dataDir, () => 8) }, SESSION);
    if (open.state !== 'ENABLED') throw new Error(open.state);
    expect([open.adapter.backend, open.adapter.captureWorkerStated, open.config.backend === 'cpu-local' ? open.config.priority : null]).toEqual(['cpu-local', true, 'required']);
    open.close();

    const bare = makeDataDir('cpu-bare');
    dirs.push(bare.dataDir);
    const none = await openSessionTranscription({ ...base, dataDir: bare.dataDir, host: () => readTranscriberHost(bare.dataDir, () => 8) }, SESSION);
    expect(none).toMatchObject({ state: 'UNAVAILABLE', code: 'CONFIG_INVALID' });
  });
});
