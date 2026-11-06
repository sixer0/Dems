// The sealed-transcript store without a database (blueprint row 78; dbc-3 §B.8, §B.9, §B.11): what
// its statements may name, what it sends, in which order, and how it refuses. The same store
// against PostgreSQL, under the runtime role, is `transcripts.db.test.ts`.
import { describe, expect, it } from 'vitest';
import { LABELS_STATUS, TRANSCRIPT_SIGNATURE_ALGORITHM } from '../../../db/schema/value-sets';
import { TranscriptStoreError, createTranscriptStore, type NewTranscriptRevision, type Queryable, type SealedTranscript } from '../index';
import {
  INSERT_TRANSCRIPT,
  INSERT_TRANSCRIPT_REVISION,
  READ_ITEM_TRANSCRIPT_BINDING,
  READ_REVISION_HEAD,
  READ_TRANSCRIPT,
  READ_TRANSCRIPT_REVISIONS,
  TRANSCRIPT_LABELS_STATES,
  TRANSCRIPT_REVISION_ALGORITHMS,
} from '../statements';

const EVIDENCE = 'EV-20261009-0078';
const h = (letter: string): string => letter.repeat(64);
const transcript = (overrides: Partial<SealedTranscript> = {}): SealedTranscript => ({
  evidenceId: EVIDENCE,
  jsonSha256: h('a'),
  srtSha256: h('b'),
  vttSha256: h('c'),
  model: { name: 'whisper-large-v3-turbo', version: 'ggml', quantisation: 'none', modelSha256: h('d'), params: { backend: 'cpu-local' } },
  diarization: { numSpeakers: 0, status: 'UNAVAILABLE', confidence: null, reason: 'ENGINE_NOT_CONFIGURED' },
  labelsStatus: 'UNAVAILABLE',
  createdAt: 1_791_529_000_000,
  ...overrides,
});
const revision = (overrides: Partial<NewTranscriptRevision> = {}): NewTranscriptRevision => ({
  evidenceId: EVIDENCE,
  baseRevision: 0,
  parentSha256: h('a'),
  sha256: h('e'),
  authorId: 'OPR-001',
  reason: 'koreksi ejaan nama',
  signatureValue: h('f'),
  signatureKeyId: 'CORE_KEY_TEST',
  signatureAlgorithm: 'SIMULATED-SHA256',
  signatureSimulated: true,
  signatureCertificateSha256: null,
  createdAt: 1_791_529_100_000,
  ...overrides,
});

type Answer = { rows: unknown[]; rowCount: number | null };
function recorder(answer: (text: string, values: readonly unknown[]) => Answer): { connection: Queryable; calls: { text: string; values: readonly unknown[] }[] } {
  const calls: { text: string; values: readonly unknown[] }[] = [];
  return {
    calls,
    connection: {
      async query(text: string, values: readonly unknown[] = []) {
        calls.push({ text, values });
        return answer(text, values) as never;
      },
    },
  };
}
const transcriptRow = { evidence_id: EVIDENCE, json_sha256: h('a'), srt_sha256: h('b'), vtt_sha256: h('c'), model: {}, diarization: {}, labels_status: 'UNAVAILABLE', created_at: '1791529000000' };

async function refusal(run: Promise<unknown>): Promise<TranscriptStoreError> {
  let caught: unknown;
  try {
    await run;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(TranscriptStoreError);
  return caught as TranscriptStoreError;
}

describe('sealed-transcript store: the statements', () => {
  const all = [READ_ITEM_TRANSCRIPT_BINDING, INSERT_TRANSCRIPT, READ_TRANSCRIPT, READ_REVISION_HEAD, INSERT_TRANSCRIPT_REVISION, READ_TRANSCRIPT_REVISIONS];

  it('are constant texts with bind parameters; every table carries its schema; none updates, deletes, truncates or locks a row', () => {
    for (const text of all) {
      expect(text).toMatch(/public\.(transcripts|transcript_revisions|evidence_items)\b/);
      expect(text).not.toMatch(/\bUPDATE\b|\bDELETE\b|\bTRUNCATE\b|\bDROP\b|\bFOR (UPDATE|SHARE)\b|;|SELECT \*/i);
    }
  });

  it('no statement WRITES evidence_items: the binding is the item insert\'s, this module only reads it back', () => {
    expect(all.filter((text) => /evidence_items/.test(text))).toEqual([READ_ITEM_TRANSCRIPT_BINDING]);
    expect(READ_ITEM_TRANSCRIPT_BINDING).toMatch(/^SELECT transcript_sha256 FROM public\.evidence_items WHERE id = \$1$/);
  });

  it('the two inserts have NO conflict clause: a second transcript of an item, or a taken revision number, must fail', () => {
    expect(INSERT_TRANSCRIPT).not.toMatch(/ON CONFLICT/i);
    expect(INSERT_TRANSCRIPT_REVISION).not.toMatch(/ON CONFLICT/i);
    expect(INSERT_TRANSCRIPT.match(/\$\d+/g)).toHaveLength(8);
    expect(INSERT_TRANSCRIPT_REVISION.match(/\$\d+/g)).toHaveLength(12);
  });

  it("the module's own value lists ARE the value sets of the typed schema (the module does not import the schema)", () => {
    expect([...TRANSCRIPT_LABELS_STATES]).toEqual([...LABELS_STATUS]);
    expect([...TRANSCRIPT_REVISION_ALGORITHMS]).toEqual([...TRANSCRIPT_SIGNATURE_ALGORITHM]);
  });
});

describe('writeSealedTranscript: the item is read back first, and the transcript is refused unless the item is bound to it', () => {
  it('bound item: one read of the binding, then one insert with the objects as JSON text', async () => {
    const { connection, calls } = recorder((text) => (text === READ_ITEM_TRANSCRIPT_BINDING ? { rows: [{ transcript_sha256: h('a') }], rowCount: 1 } : { rows: [], rowCount: 1 }));
    const value = transcript();
    await createTranscriptStore(connection).writeSealedTranscript(value);
    expect(calls.map((call) => call.text)).toEqual([READ_ITEM_TRANSCRIPT_BINDING, INSERT_TRANSCRIPT]);
    expect(calls[0]?.values).toEqual([EVIDENCE]);
    expect(calls[1]?.values).toEqual([EVIDENCE, h('a'), h('b'), h('c'), JSON.stringify(value.model), JSON.stringify(value.diarization), 'UNAVAILABLE', 1_791_529_000_000]);
  });

  it.each([
    ['no such item in this unit of work', 'ITEM_NOT_FOUND', []],
    ['an item bound to ANOTHER hash', 'TRANSCRIPT_HASH_NOT_BOUND', [{ transcript_sha256: h('9') }]],
    ['an item bound to no transcript (a v1 item)', 'TRANSCRIPT_HASH_NOT_BOUND', [{ transcript_sha256: null }]],
  ])('%s: refused with %s, and NO insert is sent', async (_label, code, rows) => {
    const { connection, calls } = recorder(() => ({ rows, rowCount: rows.length }));
    const error = await refusal(createTranscriptStore(connection).writeSealedTranscript(transcript()));
    expect(error.code).toBe(code);
    expect(calls.map((call) => call.text)).toEqual([READ_ITEM_TRANSCRIPT_BINDING]);
  });

  it('a second transcript for the item (23505) is TRANSCRIPT_ALREADY_SEALED; any other failure is WRITE_FAILED with SQLSTATE and constraint, never a row value', async () => {
    const failing = (code: string, constraint: string) =>
      recorder((text) => {
        if (text === READ_ITEM_TRANSCRIPT_BINDING) return { rows: [{ transcript_sha256: h('a') }], rowCount: 1 };
        throw Object.assign(new Error(`row (${h('a')}) violates`), { code, constraint });
      }).connection;
    const twice = await refusal(createTranscriptStore(failing('23505', 'transcripts_pkey')).writeSealedTranscript(transcript()));
    expect([twice.code, twice.sqlState, twice.constraint]).toEqual(['TRANSCRIPT_ALREADY_SEALED', '23505', 'transcripts_pkey']);
    const check = await refusal(createTranscriptStore(failing('23514', 'transcripts_labels_check')).writeSealedTranscript(transcript()));
    expect([check.code, check.sqlState, check.constraint]).toEqual(['WRITE_FAILED', '23514', 'transcripts_labels_check']);
    expect(check.message).not.toContain(h('a'));
  });
});

describe('the revision chain (dbc-3 §B.9; SEC35-21)', () => {
  const chain = (revisions: { revision_no: number; sha256: string }[], hasTranscript = true) =>
    recorder((text) => {
      if (text === READ_TRANSCRIPT) return { rows: hasTranscript ? [transcriptRow] : [], rowCount: hasTranscript ? 1 : 0 };
      if (text === READ_REVISION_HEAD) return { rows: revisions.slice(-1), rowCount: Math.min(1, revisions.length) };
      return { rows: [], rowCount: 1 };
    });

  it('no revision yet: the head is 0 and the parent is the machine transcript hash', async () => {
    expect(await createTranscriptStore(chain([]).connection).revisionHead(EVIDENCE)).toEqual({ revisionNo: 0, parentSha256: h('a') });
  });

  it('with revisions: the head is the newest number and its hash is the next parent', async () => {
    expect(await createTranscriptStore(chain([{ revision_no: 1, sha256: h('e') }, { revision_no: 2, sha256: h('7') }]).connection).revisionHead(EVIDENCE)).toEqual({ revisionNo: 2, parentSha256: h('7') });
  });

  it('the first revision gets number 1 with the machine transcript as its parent; the insert sends the twelve columns', async () => {
    const { connection, calls } = chain([]);
    const stored = await createTranscriptStore(connection).appendRevision(revision());
    expect(stored).toMatchObject({ revisionNo: 1, parentSha256: h('a'), sha256: h('e') });
    expect(stored).not.toHaveProperty('baseRevision');
    const insert = calls.find((call) => call.text === INSERT_TRANSCRIPT_REVISION);
    expect(insert?.values).toEqual([EVIDENCE, 1, h('a'), h('e'), 'OPR-001', 'koreksi ejaan nama', h('f'), 'CORE_KEY_TEST', 'SIMULATED-SHA256', true, null, 1_791_529_100_000]);
  });

  it('the next revision gets head + 1 and the hash of the revision before it as its parent', async () => {
    const { connection, calls } = chain([{ revision_no: 1, sha256: h('e') }]);
    const stored = await createTranscriptStore(connection).appendRevision(revision({ baseRevision: 1, parentSha256: h('e'), sha256: h('7') }));
    expect(stored.revisionNo).toBe(2);
    expect(calls.find((call) => call.text === INSERT_TRANSCRIPT_REVISION)?.values.slice(1, 4)).toEqual([2, h('e'), h('7')]);
  });

  it.each([
    ['a stale base revision (built on 0 while the head is 1)', revision({ baseRevision: 0, parentSha256: h('e') })],
    ['a base revision ahead of the head', revision({ baseRevision: 2, parentSha256: h('e') })],
    ['the right number but another parent hash than the head (a broken chain)', revision({ baseRevision: 1, parentSha256: h('a') })],
  ])('%s is TRANSCRIPT_REVISION_CONFLICT, and NO insert is sent', async (_label, value) => {
    const { connection, calls } = chain([{ revision_no: 1, sha256: h('e') }]);
    expect((await refusal(createTranscriptStore(connection).appendRevision(value))).code).toBe('TRANSCRIPT_REVISION_CONFLICT');
    expect(calls.some((call) => call.text === INSERT_TRANSCRIPT_REVISION)).toBe(false);
  });

  it('losing the race for the number (23505 on the primary key) is the same conflict', async () => {
    const { connection } = recorder((text) => {
      if (text === READ_TRANSCRIPT) return { rows: [transcriptRow], rowCount: 1 };
      if (text === READ_REVISION_HEAD) return { rows: [], rowCount: 0 };
      throw Object.assign(new Error('duplicate key'), { code: '23505', constraint: 'transcript_revisions_pkey' });
    });
    const error = await refusal(createTranscriptStore(connection).appendRevision(revision()));
    expect([error.code, error.constraint]).toEqual(['TRANSCRIPT_REVISION_CONFLICT', 'transcript_revisions_pkey']);
  });

  it('an item without a machine transcript has no chain: TRANSCRIPT_NOT_FOUND, nothing inserted', async () => {
    const { connection, calls } = chain([], false);
    expect((await refusal(createTranscriptStore(connection).appendRevision(revision()))).code).toBe('TRANSCRIPT_NOT_FOUND');
    expect(calls.map((call) => call.text)).toEqual([READ_TRANSCRIPT]);
  });
});

describe('reads', () => {
  it('rows come back in the member names of the typed schema; a database failure is READ_FAILED', async () => {
    const { connection } = recorder((text) => (text === READ_TRANSCRIPT ? { rows: [transcriptRow], rowCount: 1 } : { rows: [], rowCount: 0 }));
    const store = createTranscriptStore(connection);
    expect(await store.read(EVIDENCE)).toEqual({ evidenceId: EVIDENCE, jsonSha256: h('a'), srtSha256: h('b'), vttSha256: h('c'), model: {}, diarization: {}, labelsStatus: 'UNAVAILABLE', createdAt: 1_791_529_000_000 });
    expect(await store.readRevisions(EVIDENCE)).toEqual([]);
    const broken = createTranscriptStore(recorder(() => { throw Object.assign(new Error('gone'), { code: '57P01' }); }).connection);
    expect((await refusal(broken.read(EVIDENCE))).code).toBe('READ_FAILED');
    expect((await refusal(broken.readRevisions(EVIDENCE))).sqlState).toBe('57P01');
  });

  it('the store is frozen and has exactly its five members', () => {
    const store = createTranscriptStore(recorder(() => ({ rows: [], rowCount: 0 })).connection);
    expect(Object.isFrozen(store)).toBe(true);
    expect(Object.keys(store).sort()).toEqual(['appendRevision', 'read', 'readRevisions', 'revisionHead', 'writeSealedTranscript']);
  });
});
