// The `recording_fragments` store and its recorder without a database (blueprint row 59; dbc-3
// §B.6; capture spec §B.2 "Delivery contract"): what the statements may name, how a checkpoint
// becomes a row, and how the recorder behaves when the database refuses, fails or is slow. The
// same store against PostgreSQL, under the runtime role, is `recording-fragments.db.test.ts`.
import { createHash } from 'node:crypto';
import { CAPTURE_CHAIN_GENESIS_SHA256, CaptureRecordSchema, type CaptureRecord } from '@dems/capture-protocol';
import { describe, expect, it } from 'vitest';
import { VIDEO_TRACK_ID } from '../../../db/schema/value-sets';
import {
  CHAIN_GENESIS_SHA256,
  FragmentInsertOutcome,
  RecordingFragmentStoreError,
  VIDEO_TRACK_IDS,
  createFragmentRecorder,
  createRecordingFragmentStore,
  fragmentRowOf,
  invalidMember,
  type FragmentRecorderReport,
  type Queryable,
  type RecordingFragment,
  type VideoTrackId,
} from '../index';
import { INSERT_RECORDING_FRAGMENT, READ_RECORDING_FRAGMENT, READ_RECORDING_FRAGMENTS, READ_RECORDING_FRAGMENT_HEAD } from '../statements';

const SESSION = 'SES-20261009-0591';
const TRACKS = new Map<string, VideoTrackId>([['CAM-01', 'VIDEO-01'], ['CAM-02', 'VIDEO-02']]);
const sha = (text: string): string => createHash('sha256').update(text).digest('hex');
const link = (before: string, frag: string): string => createHash('sha256').update(Buffer.from(before, 'hex')).update(Buffer.from(frag, 'hex')).digest('hex');

/** The checkpoint records of one camera file as the worker writes them: a real chain over made-up fragment digests. */
function checkpoints(deviceId: string, count: number): Array<Extract<CaptureRecord, { kind: 'FRAGMENT_CHECKPOINT' }>> {
  const out: Array<Extract<CaptureRecord, { kind: 'FRAGMENT_CHECKPOINT' }>> = [];
  let chain = CAPTURE_CHAIN_GENESIS_SHA256;
  let start = 1_231;
  for (let index = 1; index <= count; index += 1) {
    const fragSha256 = sha(`${deviceId}:${index}`);
    chain = link(chain, fragSha256);
    const len = 40_000 + index;
    out.push({ kind: 'FRAGMENT_CHECKPOINT', deviceId, index, start, len, fragSha256, chainSha256: chain, prefixSha256: sha(`prefix:${deviceId}:${index}`), plaintextSha256: fragSha256, plaintextChainSha256: chain, mediaStartMs: (index - 1) * 2_000, mediaDurationMs: 2_000, keyframe: true, durableAt: 1_791_529_000_000 + index, gcmIv: null, gcmTag: null, keyId: null });
    start += len;
  }
  return out;
}

/** A store that keeps the zero-gap rule in memory: what the database does, as far as the recorder can tell. */
function memoryStore(options: { failAt?: number; slow?: boolean } = {}) {
  const rows: RecordingFragment[] = [];
  const attempts: string[] = [];
  let release: Array<() => void> = [];
  return {
    rows,
    attempts,
    release: () => {
      const waiting = release;
      release = [];
      for (const go of waiting) go();
    },
    async insert(row: RecordingFragment) {
      attempts.push(`${row.trackId}:${row.seq}`);
      if (options.slow === true) await new Promise<void>((resolve) => release.push(resolve));
      if (options.failAt === attempts.length) throw new RecordingFragmentStoreError('WRITE_FAILED', 'the database is away', { cause: { code: '57P01' } });
      const before = rows.filter((stored) => stored.trackId === row.trackId && stored.sessionId === row.sessionId).at(-1);
      if (rows.some((stored) => stored.trackId === row.trackId && stored.seq === row.seq)) return FragmentInsertOutcome.ALREADY_STORED;
      if (row.seq !== (before?.seq ?? 0) + 1) throw new RecordingFragmentStoreError('FRAGMENT_GAP', 'gap');
      rows.push(row);
      return FragmentInsertOutcome.INSERTED;
    },
  };
}

describe('recording_fragments store: the statements', () => {
  const all = [INSERT_RECORDING_FRAGMENT, READ_RECORDING_FRAGMENT, READ_RECORDING_FRAGMENTS, READ_RECORDING_FRAGMENT_HEAD];

  it('are constant texts with bind parameters, name the table with its schema, and none updates, deletes or truncates', () => {
    for (const text of all) {
      expect(text).toContain('public.recording_fragments');
      expect(text).not.toMatch(/\bUPDATE\b|\bDELETE\b|\bTRUNCATE\b|\bDROP\b|;/i);
      expect(text).not.toMatch(/SELECT \*/i);
    }
  });

  it('the insert leaves a stored row alone, and holds the zero-gap rule itself: the row before, its end, its chain', () => {
    expect(INSERT_RECORDING_FRAGMENT).toMatch(/ON CONFLICT \(session_id, track_id, seq\) DO NOTHING\nRETURNING seq$/);
    expect(INSERT_RECORDING_FRAGMENT).toContain('before.seq = $3::integer - 1');
    expect(INSERT_RECORDING_FRAGMENT).toContain('before.byte_offset + before.byte_length = $4::bigint');
    expect(INSERT_RECORDING_FRAGMENT).toContain("encode(sha256(decode(before.chain_hash, 'hex') || decode($8::text, 'hex')), 'hex')");
  });

  it("the module's own lists ARE the schema's track set and the protocol's chain anchor (the module imports neither)", () => {
    expect([...VIDEO_TRACK_IDS]).toEqual([...VIDEO_TRACK_ID]);
    expect(CHAIN_GENESIS_SHA256).toBe(CAPTURE_CHAIN_GENESIS_SHA256);
    expect(CHAIN_GENESIS_SHA256).toBe(createHash('sha256').update('').digest('hex'));
  });
});

describe('recording_fragments store: what it sends and how it answers', () => {
  const row = fragmentRowOf(SESSION, 'VIDEO-01', checkpoints('CAM-01', 1)[0]!);
  function connection(answers: Array<{ rows: unknown[]; rowCount: number | null } | Error>): { connection: Queryable; calls: { text: string; values: readonly unknown[] }[] } {
    const calls: { text: string; values: readonly unknown[] }[] = [];
    return {
      calls,
      connection: {
        async query(text: string, values: readonly unknown[] = []) {
          calls.push({ text, values });
          const answer = answers.shift() ?? { rows: [], rowCount: 0 };
          if (answer instanceof Error) throw answer;
          return answer as never;
        },
      },
    };
  }
  const stored = { session_id: SESSION, track_id: 'VIDEO-01', seq: 1, byte_offset: String(row.byteOffset), byte_length: String(row.byteLength), media_start_ms: '0', media_duration_ms: '2000', sha256: row.sha256, chain_hash: row.chainHash, durable_at: String(row.durableAt) };

  it('a checkpoint becomes a row: index -> seq, start/len -> the byte range, the stored-bytes digest and its chain, the durable instant', () => {
    const record = checkpoints('CAM-02', 3)[2]!;
    // A record that the protocol accepts is what is turned into the row.
    expect(CaptureRecordSchema.safeParse(record).success).toBe(true);
    expect(fragmentRowOf(SESSION, 'VIDEO-02', record)).toEqual({ sessionId: SESSION, trackId: 'VIDEO-02', seq: 3, byteOffset: record.start, byteLength: record.len, mediaStartMs: 4_000, mediaDurationMs: 2_000, sha256: record.fragSha256, chainHash: record.chainSha256, durableAt: record.durableAt });
  });

  it('an insert sends the ten columns and the chain anchor as parameters and answers INSERTED on one row', async () => {
    const { connection: pool, calls } = connection([{ rows: [{ seq: 1 }], rowCount: 1 }]);
    expect(await createRecordingFragmentStore(pool).insert(row)).toBe('INSERTED');
    expect(calls).toEqual([{ text: INSERT_RECORDING_FRAGMENT, values: [SESSION, 'VIDEO-01', 1, row.byteOffset, row.byteLength, 0, 2_000, row.sha256, row.chainHash, row.durableAt, CHAIN_GENESIS_SHA256] }]);
  });

  it('nothing inserted and the SAME fragment stored: ALREADY_STORED (a later durable instant of the replay is no difference)', async () => {
    const { connection: pool } = connection([{ rows: [], rowCount: 0 }, { rows: [stored], rowCount: 1 }]);
    expect(await createRecordingFragmentStore(pool).insert({ ...row, durableAt: row.durableAt + 5_000 })).toBe('ALREADY_STORED');
  });

  it('nothing inserted and nothing stored under the key: FRAGMENT_GAP', async () => {
    const { connection: pool } = connection([{ rows: [], rowCount: 0 }, { rows: [], rowCount: 0 }]);
    await expect(createRecordingFragmentStore(pool).insert(row)).rejects.toMatchObject({ code: 'FRAGMENT_GAP' });
  });

  it.each(['sha256', 'chain_hash', 'byte_offset', 'byte_length', 'media_start_ms', 'media_duration_ms'] as const)('nothing inserted and ANOTHER fragment stored under the key (%s differs): FRAGMENT_CONFLICT, the member is named, no value is in the message', async (column) => {
    const other = { ...stored, [column]: column === 'sha256' || column === 'chain_hash' ? 'f'.repeat(64) : '999999' };
    const { connection: pool, calls } = connection([{ rows: [], rowCount: 0 }, { rows: [other], rowCount: 1 }]);
    const error = await createRecordingFragmentStore(pool).insert(row).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(RecordingFragmentStoreError);
    expect(error).toMatchObject({ code: 'FRAGMENT_CONFLICT', member: column.replace(/_([a-z])/g, (_all, letter: string) => letter.toUpperCase()).replace('chainHash', 'chainHash') });
    expect((error as Error).message).not.toMatch(/[0-9a-f]{64}|999999/);
    // Two statements: the insert and the read. Nothing was written over the stored row.
    expect(calls.map((call) => call.text)).toEqual([INSERT_RECORDING_FRAGMENT, READ_RECORDING_FRAGMENT]);
  });

  it('a statement that fails is WRITE_FAILED with the SQLSTATE and the constraint the database named', async () => {
    const refused = Object.assign(new Error('violates check constraint'), { code: '23514', constraint: 'recording_fragments_session_check' });
    const { connection: pool } = connection([refused]);
    await expect(createRecordingFragmentStore(pool).insert(row)).rejects.toMatchObject({ code: 'WRITE_FAILED', sqlState: '23514', constraint: 'recording_fragments_session_check' });
  });

  it.each([
    ['trackId', { trackId: 'AUDIO-01' as VideoTrackId }],
    ['seq', { seq: 0 }],
    ['seq', { seq: 1.5 }],
    ['byteOffset', { byteOffset: -1 }],
    ['byteLength', { byteLength: 0 }],
    ['mediaStartMs', { mediaStartMs: -1 }],
    ['mediaDurationMs', { mediaDurationMs: 0 }],
    ['sha256', { sha256: 'A'.repeat(64) }],
    ['chainHash', { chainHash: 'zz' }],
    ['durableAt', { durableAt: Number.NaN }],
  ] as const)('a value that is no fragment row (%s) is ROW_INVALID before any statement is sent', async (member, change) => {
    const { connection: pool, calls } = connection([]);
    expect(invalidMember({ ...row, ...change })).toBe(member);
    await expect(createRecordingFragmentStore(pool).insert({ ...row, ...change })).rejects.toMatchObject({ code: 'ROW_INVALID', member });
    expect(calls).toEqual([]);
    // CONTROL: the unchanged row is a fragment row.
    expect(invalidMember(row)).toBeNull();
  });
});

describe('the recorder: checkpoint records in, rows out, in order', () => {
  const event = (record: CaptureRecord, sessionId = SESSION) => ({ sessionId, record });
  const setup = (store: ReturnType<typeof memoryStore>, backlogLimit?: number) => {
    const reports: FragmentRecorderReport[] = [];
    const recorder = createFragmentRecorder({ sessionId: SESSION, tracks: TRACKS, store, report: (entry) => void reports.push(entry), ...(backlogLimit === undefined ? {} : { backlogLimit }) });
    return { recorder, reports };
  };

  it('the checkpoints of two cameras, interleaved as the worker writes them, become one row each, each camera in its own order', async () => {
    const store = memoryStore();
    const { recorder, reports } = setup(store);
    const a = checkpoints('CAM-01', 4);
    const b = checkpoints('CAM-02', 4);
    for (let n = 0; n < 4; n += 1) {
      expect(recorder.take(event(a[n]!))).toBe(true);
      expect(recorder.take(event(b[n]!))).toBe(true);
    }
    await recorder.idle();
    expect(store.rows.map((row) => `${row.trackId}:${row.seq}`)).toEqual(['VIDEO-01:1', 'VIDEO-02:1', 'VIDEO-01:2', 'VIDEO-02:2', 'VIDEO-01:3', 'VIDEO-02:3', 'VIDEO-01:4', 'VIDEO-02:4']);
    expect(store.rows[2]).toEqual(fragmentRowOf(SESSION, 'VIDEO-01', a[1]!));
    expect(recorder.status()).toEqual({ pending: 0, inserted: 8, alreadyStored: 0, notStored: 0, behind: [] });
    expect(reports).toEqual([]);
  });

  it('every other record, and a checkpoint of another session, is not its own: nothing is written', async () => {
    const store = memoryStore();
    const { recorder } = setup(store);
    expect(recorder.take(event({ kind: 'FIRST_DURABLE_FRAGMENT', deviceId: 'CAM-01', bytes: 5_131 }))).toBe(false);
    expect(recorder.take(event({ kind: 'KEYFRAME_INTERVAL', deviceId: 'CAM-01', observedMs: 1_000, boundMs: 2_000, intervals: 3, complete: true, aboveBound: false }))).toBe(false);
    expect(recorder.take(event({ kind: 'SEAL_COMPLETE' }))).toBe(false);
    expect(recorder.take(event(checkpoints('CAM-01', 1)[0]!, 'SES-20261009-0999'))).toBe(false);
    await recorder.idle();
    expect(store.attempts).toEqual([]);
  });

  it('a replay of the same records is harmless: every row is ALREADY_STORED and the table is unchanged', async () => {
    const store = memoryStore();
    const first = setup(store);
    for (const record of checkpoints('CAM-01', 3)) first.recorder.take(event(record));
    await first.recorder.idle();
    const before = JSON.stringify(store.rows);
    const again = setup(store);
    for (const record of checkpoints('CAM-01', 3)) again.recorder.take(event(record));
    await again.recorder.idle();
    expect(again.recorder.status()).toMatchObject({ inserted: 0, alreadyStored: 3, notStored: 0, behind: [] });
    expect(JSON.stringify(store.rows)).toBe(before);
  });

  it('a write that fails puts THAT camera file behind: its later checkpoints are not attempted (they would be gaps), the other camera goes on, and the failure is reported once with identifiers only', async () => {
    const store = memoryStore({ failAt: 3 }); // the third attempt: VIDEO-01 fragment 2
    const { recorder, reports } = setup(store);
    const a = checkpoints('CAM-01', 4);
    const b = checkpoints('CAM-02', 4);
    for (let n = 0; n < 4; n += 1) {
      recorder.take(event(a[n]!));
      recorder.take(event(b[n]!));
    }
    await recorder.idle();
    expect(store.rows.map((row) => `${row.trackId}:${row.seq}`)).toEqual(['VIDEO-01:1', 'VIDEO-02:1', 'VIDEO-02:2', 'VIDEO-02:3', 'VIDEO-02:4']);
    expect(store.attempts).toEqual(['VIDEO-01:1', 'VIDEO-02:1', 'VIDEO-01:2', 'VIDEO-02:2', 'VIDEO-02:3', 'VIDEO-02:4']);
    expect(recorder.status()).toEqual({ pending: 0, inserted: 5, alreadyStored: 0, notStored: 3, behind: ['VIDEO-01'] });
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ source: 'recording-fragments.recorder', code: 'FRAGMENT_ROW_NOT_STORED', sessionId: SESSION, trackId: 'VIDEO-01', seq: 2 });
    expect(reports[0]?.err).toMatchObject({ code: 'WRITE_FAILED', sqlState: '57P01' });
    expect(JSON.stringify(reports)).not.toMatch(/[0-9a-f]{64}/);
    // A checkpoint that arrives later for the camera that is behind is turned away at once.
    expect(recorder.take(event(checkpoints('CAM-01', 5)[4]!))).toBe(false);
    expect(recorder.status().notStored).toBe(4);
  });

  it('CONTROL: the same eight records with no failure leave nothing behind', async () => {
    const store = memoryStore();
    const { recorder } = setup(store);
    const a = checkpoints('CAM-01', 4);
    const b = checkpoints('CAM-02', 4);
    for (let n = 0; n < 4; n += 1) {
      recorder.take(event(a[n]!));
      recorder.take(event(b[n]!));
    }
    await recorder.idle();
    expect(recorder.status()).toMatchObject({ inserted: 8, notStored: 0, behind: [] });
  });

  it('the backlog is bounded: with a database that does not answer, at most `backlogLimit` rows wait; one more is turned away, reported once, and its camera is behind', async () => {
    const store = memoryStore({ slow: true });
    const { recorder, reports } = setup(store, 4);
    const records = checkpoints('CAM-01', 10);
    const taken = records.map((record) => recorder.take(event(record)));
    expect(taken).toEqual([true, true, true, true, false, false, false, false, false, false]);
    expect(recorder.status()).toMatchObject({ pending: 4, notStored: 6, behind: ['VIDEO-01'] });
    expect(reports.map((entry) => `${entry.code}:${entry.seq}`)).toEqual(['FRAGMENT_BACKLOG_FULL:5']);
    // The database answers again: what waited is settled; nothing of the camera that fell behind is written after the mark.
    for (let turn = 0; turn < 8; turn += 1) {
      store.release();
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    await recorder.idle();
    expect(recorder.status().pending).toBe(0);
    expect(store.rows.length).toBeLessThanOrEqual(4);
  });

  it('a checkpoint of a camera the plan does not have is not written and is said once; a report port that throws stops nothing', async () => {
    const store = memoryStore({ failAt: 1 });
    const reports: string[] = [];
    const recorder = createFragmentRecorder({
      sessionId: SESSION,
      tracks: new Map<string, VideoTrackId>([['CAM-01', 'VIDEO-01']]),
      store,
      report: (entry) => {
        reports.push(entry.code);
        throw new Error('the error log is away');
      },
    });
    expect(recorder.take(event(checkpoints('CAM-02', 2)[0]!))).toBe(false);
    expect(recorder.take(event(checkpoints('CAM-02', 2)[1]!))).toBe(false);
    expect(recorder.take(event(checkpoints('CAM-01', 1)[0]!))).toBe(true);
    await recorder.idle();
    expect(reports).toEqual(['FRAGMENT_CAMERA_UNKNOWN', 'FRAGMENT_ROW_NOT_STORED']);
    expect(recorder.status()).toMatchObject({ pending: 0, notStored: 3, behind: ['VIDEO-01'] });
  });
});
