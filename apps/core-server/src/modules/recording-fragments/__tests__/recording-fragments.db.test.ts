// The `recording_fragments` INSERT path against PostgreSQL (blueprint row 59 / M3-W3; dbc-3 §B.6
// and the privileges of migration 0005), under the RUNTIME ROLE `dems_app` on a throw-away clone
// of this run (`useTestDatabase`): no live database is touched, and this row adds no migration -
// the table is used exactly as the applied schema has it.
//
//   1. the zero-gap rule held BY THE DATABASE: one row per fragment per camera, in order, the
//      byte ranges touching, the chain continuing; every nearest wrong row is refused and leaves
//      the table as it was;
//   2. idempotent on a replay: the same rows again change nothing, a different row under a stored
//      key is refused and the stored row stays;
//   3. what the runtime role may not do it cannot do here (no UPDATE, no DELETE);
//   4. FED BY CHECKPOINT RECORDS: the recorder, on records that pass the protocol's schema, with
//      the real table behind it; a database failure in the middle; the repair from the full list.
import { createHash } from 'node:crypto';
import { CAPTURE_CHAIN_GENESIS_SHA256, CaptureRecordSchema, type CaptureRecord } from '@dems/capture-protocol';
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { expectRefused, SQLSTATE } from '../../../../test/db/support';
import { useTestDatabase } from '../../../../test/helpers/db';
import { AUDIO_FRAGMENT_TRACK_IDS, CHAIN_GENESIS_SHA256, RecordingFragmentStoreError, createFragmentRecorder, createRecordingFragmentStore, fragmentRowOf, type FragmentRecorderReport, type FragmentTrackId, type Queryable, type RecordingFragment, type RecordingFragmentStore, type VideoTrackId } from '../index';
import { INSERT_RECORDING_FRAGMENT } from '../statements';

const db = useTestDatabase({ template: 'seed', slug: 'row59' });
let app: Pool;
let owner: Pool;
let store: RecordingFragmentStore;

const SESSION = 'SES-20261009-0591';
const OTHER = 'SES-20261009-0592';
const sha = (text: string): string => createHash('sha256').update(text).digest('hex');
const link = (before: string, frag: string): string => createHash('sha256').update(Buffer.from(before, 'hex')).update(Buffer.from(frag, 'hex')).digest('hex');
const queryable = (pool: Pool): Queryable => ({ query: (text, values) => pool.query(text, values === undefined ? [] : [...values]) });

type Checkpoint = Extract<CaptureRecord, { kind: 'FRAGMENT_CHECKPOINT' }>;
/** The checkpoint records of one camera file: a real chain (SHA-256 by Node, not by the database) over made-up fragment digests. */
function checkpoints(deviceId: string, count: number, salt = ''): Checkpoint[] {
  const out: Checkpoint[] = [];
  let chain = CAPTURE_CHAIN_GENESIS_SHA256;
  let start = 1_231;
  for (let index = 1; index <= count; index += 1) {
    const fragSha256 = sha(`${salt}${deviceId}:${index}`);
    chain = link(chain, fragSha256);
    const len = 400_000 + index * 13;
    out.push({ kind: 'FRAGMENT_CHECKPOINT', deviceId, index, start, len, fragSha256, chainSha256: chain, prefixSha256: sha(`prefix:${deviceId}:${index}`), plaintextSha256: fragSha256, plaintextChainSha256: chain, mediaStartMs: (index - 1) * 2_000, mediaDurationMs: 2_000, keyframe: true, durableAt: 1_791_529_000_000 + index * 2_000, gcmIv: null, gcmTag: null, keyId: null });
    start += len;
  }
  return out;
}
const rowsOf = <Track extends FragmentTrackId>(trackId: Track, deviceId: string, count: number, sessionId = SESSION, salt = ''): RecordingFragment<Track>[] => checkpoints(deviceId, count, salt).map((record) => fragmentRowOf(sessionId, trackId, record));
const stored = async (sessionId = SESSION): Promise<string[]> =>
  (await owner.query('SELECT track_id, seq, byte_offset::text AS byte_offset, byte_length::text AS byte_length, sha256, chain_hash, durable_at::text AS durable_at FROM public.recording_fragments WHERE session_id = $1 ORDER BY track_id, seq', [sessionId])).rows.map(
    (row: Record<string, string | number>) => `${row.track_id}:${row.seq}:${row.byte_offset}+${row.byte_length}:${String(row.sha256).slice(0, 8)}:${String(row.chain_hash).slice(0, 8)}:${row.durable_at}`,
  );
const line = (row: RecordingFragment<FragmentTrackId>): string => `${row.trackId}:${row.seq}:${row.byteOffset}+${row.byteLength}:${row.sha256.slice(0, 8)}:${row.chainHash.slice(0, 8)}:${row.durableAt}`;
const codeOf = async (work: Promise<unknown>): Promise<string> => {
  try {
    await work;
    return 'no refusal';
  } catch (error) {
    return error instanceof RecordingFragmentStoreError ? error.code : `not typed: ${String(error)}`;
  }
};

beforeAll(() => {
  app = db.appPool();
  owner = db.ownerPool();
  store = createRecordingFragmentStore(queryable(app));
});

beforeEach(async () => {
  // Owner-side clean-up of this file's two sessions only (the runtime role has no DELETE here).
  await owner.query('DELETE FROM public.recording_fragments WHERE session_id = ANY($1)', [[SESSION, OTHER]]);
});

describe('the table this file runs on', () => {
  it('is the applied one: ten columns, the key (session_id, track_id, seq); this row brought no migration and no column', async () => {
    const columns = (await owner.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'recording_fragments' ORDER BY ordinal_position")).rows.map((row: { column_name: string }) => row.column_name);
    expect(columns).toEqual(['session_id', 'track_id', 'seq', 'byte_offset', 'byte_length', 'media_start_ms', 'media_duration_ms', 'sha256', 'chain_hash', 'durable_at']);
    const key = (await owner.query("SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'recording_fragments_pkey'")).rows[0] as { def: string };
    expect(key.def).toBe('PRIMARY KEY (session_id, track_id, seq)');
    // The database computes the same chain as Node does: the rule in the statement and the worker's rule are one rule.
    const computed = (await app.query("SELECT encode(sha256(decode($1, 'hex') || decode($2, 'hex')), 'hex') AS chain", [CAPTURE_CHAIN_GENESIS_SHA256, sha('x')])).rows[0] as { chain: string };
    expect(computed.chain).toBe(link(CAPTURE_CHAIN_GENESIS_SHA256, sha('x')));
  });
});

describe('recording_fragments as dems_app: one row per fragment per camera, in order', () => {
  it('five fragments of one camera file are stored as given and read back equal; the head is the fifth', async () => {
    const rows = rowsOf('VIDEO-01', 'CAM-01', 5);
    for (const row of rows) expect(await store.insert(row)).toBe('INSERTED');
    expect(await store.read(SESSION, 'VIDEO-01')).toEqual(rows);
    expect(await store.head(SESSION, 'VIDEO-01')).toEqual(rows[4]);
    expect(await store.read(SESSION, 'VIDEO-02')).toEqual([]);
    expect(await store.head(SESSION, 'VIDEO-02')).toBeNull();
    expect(await stored()).toEqual(rows.map(line));
  });

  it('the two camera files of a session, and two sessions, are chains of their own', async () => {
    const one = rowsOf('VIDEO-01', 'CAM-01', 3);
    const two = rowsOf('VIDEO-02', 'CAM-02', 3);
    const other = rowsOf('VIDEO-01', 'CAM-01', 2, OTHER, 'other:');
    // Interleaved, as two cameras write them.
    for (let n = 0; n < 3; n += 1) {
      expect(await store.insert(one[n]!)).toBe('INSERTED');
      expect(await store.insert(two[n]!)).toBe('INSERTED');
    }
    expect(await store.insertMissing(other)).toEqual({ inserted: 2, alreadyStored: 0 });
    expect(await stored()).toEqual([...one, ...two].map(line));
    expect(await stored(OTHER)).toEqual(other.map(line));
  });
});

// D28 (DQ-1 = S1; migration 0044, row 146; AC-4.8 db half): the files of the four microphone
// channels take fragment rows like the camera files, under the same zero-gap rule; every other
// track name is still refused by the database itself (recording_fragments_track_check).
describe('D28: the microphone channel files AUDIO-01..04 are fragment tracks (migration 0044)', () => {
  it('three fragments of each AUDIO-0N are stored as dems_app beside a camera file, each its own chain, and read back equal', async () => {
    const video = rowsOf('VIDEO-01', 'CAM-01', 3);
    const audio = AUDIO_FRAGMENT_TRACK_IDS.map((trackId, index) => rowsOf(trackId, `MIC-0${index + 1}`, 3));
    for (let n = 0; n < 3; n += 1) {
      expect(await store.insert(video[n]!)).toBe('INSERTED');
      for (const rows of audio) expect(await store.insert(rows[n]!)).toBe('INSERTED');
    }
    for (const [index, trackId] of AUDIO_FRAGMENT_TRACK_IDS.entries()) {
      expect(await store.read(SESSION, trackId)).toEqual(audio[index]);
      expect(await store.head(SESSION, trackId)).toEqual(audio[index]![2]);
    }
    expect(await store.read(SESSION, 'VIDEO-01')).toEqual(video);
    expect(await stored()).toEqual([...audio.flat(), ...video].map(line));
  });

  it('the zero-gap rule holds on a channel file: fragment 2 of AUDIO-03 with no fragment 1 is FRAGMENT_GAP and nothing is stored', async () => {
    const rows = rowsOf('AUDIO-03', 'MIC-03', 2);
    expect(await codeOf(store.insert(rows[1]!))).toBe('FRAGMENT_GAP');
    expect(await stored()).toEqual([]);
  });

  it.each(['AUDIO-05', 'AUDIO-00', 'MIC-01', 'VIDEO-05', 'audio-01'])('the database refuses the track %s (the module guard bypassed): check violation of recording_fragments_track_check', async (trackId) => {
    const row = rowsOf('AUDIO-01', 'MIC-01', 1)[0]!;
    await expectRefused(
      () => app.query(INSERT_RECORDING_FRAGMENT, [row.sessionId, trackId, row.seq, row.byteOffset, row.byteLength, row.mediaStartMs, row.mediaDurationMs, row.sha256, row.chainHash, row.durableAt, CHAIN_GENESIS_SHA256]),
      SQLSTATE.checkViolation,
      'recording_fragments_track_check',
    );
    expect(await stored()).toEqual([]);
    // CONTROL: the same statement with AUDIO-01 stores the row.
    expect((await app.query(INSERT_RECORDING_FRAGMENT, [row.sessionId, row.trackId, row.seq, row.byteOffset, row.byteLength, row.mediaStartMs, row.mediaDurationMs, row.sha256, row.chainHash, row.durableAt, CHAIN_GENESIS_SHA256])).rowCount).toBe(1);
  });
});

describe('the zero-gap rule is held by the database', () => {
  const rows = rowsOf('VIDEO-01', 'CAM-01', 4);

  it.each([
    ['fragment 2 with no fragment 1', async () => store.insert(rows[1]!)],
    ['fragment 3 after fragment 1 (2 is missing)', async () => { await store.insert(rows[0]!); return store.insert(rows[2]!); }],
    ['fragment 2 that does not start where fragment 1 ends (one byte later)', async () => { await store.insert(rows[0]!); return store.insert({ ...rows[1]!, byteOffset: rows[1]!.byteOffset + 1 }); }],
    ['fragment 2 that overlaps fragment 1 (one byte earlier)', async () => { await store.insert(rows[0]!); return store.insert({ ...rows[1]!, byteOffset: rows[1]!.byteOffset - 1 }); }],
    ['fragment 2 whose chain value does not continue fragment 1', async () => { await store.insert(rows[0]!); return store.insert({ ...rows[1]!, chainHash: sha('another chain') }); }],
    ['fragment 2 whose digest was changed (its chain value no longer fits it)', async () => { await store.insert(rows[0]!); return store.insert({ ...rows[1]!, sha256: sha('another fragment') }); }],
    ['fragment 1 whose chain value is not built on the empty digest', async () => store.insert({ ...rows[0]!, chainHash: rows[1]!.chainHash })],
    ['fragment 2 of the OTHER camera, whose fragment 1 is not stored', async () => { await store.insert(rows[0]!); return store.insert({ ...rows[1]!, trackId: 'VIDEO-02' }); }],
    ['fragment 2 of ANOTHER session, whose fragment 1 is not stored', async () => { await store.insert(rows[0]!); return store.insert({ ...rows[1]!, sessionId: OTHER }); }],
  ] as const)('%s is refused (FRAGMENT_GAP) and nothing of it is stored', async (_label, attempt) => {
    expect(await codeOf(attempt())).toBe('FRAGMENT_GAP');
    const now = [...(await stored()), ...(await stored(OTHER))];
    expect(now.every((text) => text.startsWith('VIDEO-01:1:'))).toBe(true);
    expect(now.length).toBeLessThanOrEqual(1);
  });

  it('CONTROL: the same four rows unchanged, in order, are all taken', async () => {
    expect(await store.insertMissing(rows)).toEqual({ inserted: 4, alreadyStored: 0 });
    expect(await stored()).toEqual(rows.map(line));
  });

  it('after a refused row the chain goes on from where it stood: the right row is taken next', async () => {
    await store.insert(rows[0]!);
    expect(await codeOf(store.insert(rows[2]!))).toBe('FRAGMENT_GAP');
    expect(await store.insert(rows[1]!)).toBe('INSERTED');
    expect(await store.insert(rows[2]!)).toBe('INSERTED');
    expect((await stored()).map((text) => text.split(':')[1])).toEqual(['1', '2', '3']);
  });
});

describe('idempotent on a replay; a stored fragment is never rewritten', () => {
  const rows = rowsOf('VIDEO-02', 'CAM-02', 5);

  it('the same five rows three times: stored once, unchanged; a replay with a LATER durable instant does not move the stored one', async () => {
    expect(await store.insertMissing(rows)).toEqual({ inserted: 5, alreadyStored: 0 });
    const before = await stored();
    expect(await store.insertMissing(rows)).toEqual({ inserted: 0, alreadyStored: 5 });
    expect(await store.insertMissing(rows.map((row) => ({ ...row, durableAt: row.durableAt + 60_000 })))).toEqual({ inserted: 0, alreadyStored: 5 });
    expect(await stored()).toEqual(before);
    expect(Number(((await owner.query('SELECT count(*)::int AS n FROM public.recording_fragments WHERE session_id = $1', [SESSION])).rows[0] as { n: number }).n)).toBe(5);
  });

  it('a replay that starts in the middle, and one that runs past the end, both leave exactly one row per fragment', async () => {
    await store.insertMissing(rows.slice(0, 3));
    expect(await store.insertMissing(rows.slice(1))).toEqual({ inserted: 2, alreadyStored: 2 });
    expect(await stored()).toEqual(rows.map(line));
  });

  it('two writers with the same row at the same time: one inserts, the other finds it stored, one row', async () => {
    await store.insert(rows[0]!);
    const second = createRecordingFragmentStore(queryable(db.appPool()));
    const outcomes = await Promise.all([store.insert(rows[1]!), second.insert(rows[1]!), store.insert(rows[1]!), second.insert(rows[1]!)]);
    expect([...outcomes].sort()).toEqual(['ALREADY_STORED', 'ALREADY_STORED', 'ALREADY_STORED', 'INSERTED']);
    expect((await stored()).map((text) => text.split(':')[1])).toEqual(['1', '2']);
  });

  it.each([
    ['another digest (with a chain value that fits it)', (row: RecordingFragment, first: RecordingFragment) => ({ ...row, sha256: sha('forged'), chainHash: link(first.chainHash, sha('forged')) }), 'sha256'],
    ['another length', (row: RecordingFragment) => ({ ...row, byteLength: row.byteLength + 1 }), 'byteLength'],
    ['another media time', (row: RecordingFragment) => ({ ...row, mediaStartMs: row.mediaStartMs + 40 }), 'mediaStartMs'],
  ] as const)('a DIFFERENT fragment under a stored key (%s) is refused as FRAGMENT_CONFLICT and the stored row is kept', async (_label, forge, member) => {
    await store.insertMissing(rows.slice(0, 3));
    const before = await stored();
    const error = await store.insert(forge(rows[1]!, rows[0]!)).catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: 'FRAGMENT_CONFLICT', member });
    expect(await stored()).toEqual(before);
  });
});

describe('what the table and the role refuse', () => {
  const row = rowsOf('VIDEO-01', 'CAM-01', 1)[0]!;

  it('a session ID that is no session ID is refused by the table (23514, recording_fragments_session_check), through the store', async () => {
    const error = await store.insert({ ...row, sessionId: 'S-M3W-RUN' }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(RecordingFragmentStoreError);
    expect(error).toMatchObject({ code: 'WRITE_FAILED', sqlState: SQLSTATE.checkViolation, constraint: 'recording_fragments_session_check' });
  });

  it('the runtime role can neither change nor remove a stored fragment (42501); CONTROL: it can read it, and the owner can remove it', async () => {
    await store.insert(row);
    await expectRefused(() => app.query('UPDATE public.recording_fragments SET sha256 = $2 WHERE session_id = $1', [SESSION, sha('forged')]), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query('UPDATE public.recording_fragments SET durable_at = 0 WHERE session_id = $1', [SESSION]), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query('DELETE FROM public.recording_fragments WHERE session_id = $1', [SESSION]), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => app.query('TRUNCATE public.recording_fragments'), SQLSTATE.insufficientPrivilege);
    expect(await stored()).toEqual([line(row)]);
    expect((await app.query('SELECT seq FROM public.recording_fragments WHERE session_id = $1', [SESSION])).rowCount).toBe(1);
    expect((await owner.query('DELETE FROM public.recording_fragments WHERE session_id = $1', [SESSION])).rowCount).toBe(1);
  });
});

describe('fed by checkpoint records: the recorder on the real table', () => {
  const tracks = new Map<string, VideoTrackId>([['CAM-01', 'VIDEO-01'], ['CAM-02', 'VIDEO-02']]);
  const event = (record: CaptureRecord) => ({ sessionId: SESSION, record });
  const a = checkpoints('CAM-01', 6);
  const b = checkpoints('CAM-02', 6);
  const interleaved: CaptureRecord[] = [
    { kind: 'FIRST_VIDEO_SAMPLE', deviceId: 'CAM-01', pts: 2_520, timescale: 90_000, skipped: { noTimestamp: 0, beforeAudioStart: 0, noCameraClock: 0, beforeKeyframe: 0 }, skippedSpanMs: 0 },
    { kind: 'FIRST_VIDEO_SAMPLE', deviceId: 'CAM-02', pts: 1_800, timescale: 90_000, skipped: { noTimestamp: 0, beforeAudioStart: 0, noCameraClock: 0, beforeKeyframe: 0 }, skippedSpanMs: 0 },
    { kind: 'FIRST_DURABLE_FRAGMENT', deviceId: 'CAM-01', bytes: a[0]!.start + a[0]!.len },
    a[0]!,
    { kind: 'FIRST_DURABLE_FRAGMENT', deviceId: 'CAM-02', bytes: b[0]!.start + b[0]!.len },
    b[0]!,
    { kind: 'KEYFRAME_INTERVAL', deviceId: 'CAM-01', observedMs: 1_000, boundMs: 2_000, intervals: 3, complete: true, aboveBound: false },
    ...[1, 2, 3, 4, 5].flatMap((n) => [a[n]!, b[n]!]),
    { kind: 'KEYFRAME_INTERVAL', deviceId: 'CAM-02', observedMs: 1_000, boundMs: 2_000, intervals: 3, complete: true, aboveBound: false },
  ];
  const expected = [...a.map((record) => fragmentRowOf(SESSION, 'VIDEO-01', record)), ...b.map((record) => fragmentRowOf(SESSION, 'VIDEO-02', record))].map(line);

  it('the records of a two-camera session, each one a frame the protocol accepts, give one row per fragment per camera and nothing else', async () => {
    for (const record of interleaved) expect(CaptureRecordSchema.safeParse(record).success, record.kind).toBe(true);
    const reports: FragmentRecorderReport[] = [];
    const recorder = createFragmentRecorder({ sessionId: SESSION, tracks, store, report: (entry) => void reports.push(entry) });
    const queued = interleaved.map((record) => recorder.take(event(record)));
    await recorder.idle();
    expect(queued.filter(Boolean)).toHaveLength(12);
    expect(reports).toEqual([]);
    expect(recorder.status()).toEqual({ pending: 0, inserted: 12, alreadyStored: 0, notStored: 0, behind: [] });
    expect(await stored()).toEqual(expected);
    // Replayed in full by a second recorder (a Core that restarted and was handed the records again): nothing changes.
    const again = createFragmentRecorder({ sessionId: SESSION, tracks, store, report: (entry) => void reports.push(entry) });
    for (const record of interleaved) again.take(event(record));
    await again.idle();
    expect(again.status()).toMatchObject({ inserted: 0, alreadyStored: 12, notStored: 0 });
    expect(await stored()).toEqual(expected);
  });

  it('a checkpoint that never arrived (a gap in what the recorder was given) stops THAT camera at the gap; the rows already there stay; the full list from the file repairs it', async () => {
    const reports: FragmentRecorderReport[] = [];
    const recorder = createFragmentRecorder({ sessionId: SESSION, tracks, store, report: (entry) => void reports.push(entry) });
    // Fragment 3 of camera 1 is not handed over (the Core was away for that frame).
    for (const record of interleaved) if (record !== a[2]) recorder.take(event(record));
    await recorder.idle();
    expect((await stored()).filter((text) => text.startsWith('VIDEO-01')).map((text) => text.split(':')[1])).toEqual(['1', '2']);
    expect((await stored()).filter((text) => text.startsWith('VIDEO-02'))).toHaveLength(6);
    expect(recorder.status()).toMatchObject({ inserted: 8, notStored: 3, behind: ['VIDEO-01'] });
    expect(reports.map((entry) => `${entry.code}:${entry.trackId}:${entry.seq}`)).toEqual(['FRAGMENT_ROW_NOT_STORED:VIDEO-01:4']);
    expect(reports[0]?.err).toMatchObject({ code: 'FRAGMENT_GAP' });
    // RECOVERY: the camera file is walked, and its whole list of fragments is offered to the table.
    expect(await store.insertMissing(a.map((record) => fragmentRowOf(SESSION, 'VIDEO-01', record)))).toEqual({ inserted: 4, alreadyStored: 2 });
    expect(await stored()).toEqual(expected);
  });

  it('a database that fails in the middle: the row is reported with its SQLSTATE, nothing after it is attempted for that camera, the other camera is whole', async () => {
    let calls = 0;
    const flaky: Queryable = {
      query: (text, values) => {
        calls += 1;
        // The 5th statement of the run (the insert of camera 1, fragment 3) is sent to a table that does not exist.
        return calls === 5 ? app.query(text.replace('INSERT INTO public.recording_fragments', 'INSERT INTO public.recording_fragments_gone'), values === undefined ? [] : [...values]) : app.query(text, values === undefined ? [] : [...values]);
      },
    };
    const reports: FragmentRecorderReport[] = [];
    const recorder = createFragmentRecorder({ sessionId: SESSION, tracks, store: createRecordingFragmentStore(flaky), report: (entry) => void reports.push(entry) });
    for (let n = 0; n < 6; n += 1) {
      recorder.take(event(a[n]!));
      recorder.take(event(b[n]!));
    }
    await recorder.idle();
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ code: 'FRAGMENT_ROW_NOT_STORED', trackId: 'VIDEO-01', seq: 3 });
    expect(reports[0]?.err).toMatchObject({ code: 'WRITE_FAILED', sqlState: '42P01' });
    expect((await stored()).filter((text) => text.startsWith('VIDEO-01')).map((text) => text.split(':')[1])).toEqual(['1', '2']);
    expect((await stored()).filter((text) => text.startsWith('VIDEO-02'))).toHaveLength(6);
  });
});
