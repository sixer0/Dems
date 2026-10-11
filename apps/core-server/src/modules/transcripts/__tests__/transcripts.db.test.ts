// The sealed-transcript store against PostgreSQL (blueprint row 78 / M6-W3; dbc-3 §B.8, §B.9,
// §B.11 and the privileges of migration 0005), under the RUNTIME ROLE `dems_app` on a throw-away
// clone of this run (`useTestDatabase`): no live database is touched, and schema version 2 / dbc-3
// is used as it is — this row adds no migration.
//
//   1. ONE UNIT OF WORK: the real transcriber of `@dems/transcriber` assembles a `dems.transcript/1`
//      document (runner, diarization post-pass, assembly; engine, VAD and diarizer are in-process
//      stand-ins — no model, no process); then, in one transaction as `dems_app`, the evidence item
//      is inserted with `transcript_sha256` and the store inserts `transcripts`. Both are there
//      after the commit, bound to the hash of the document FILE; a refusal leaves neither.
//   2. PRIVILEGES: what 0005 does not grant cannot be done here (no UPDATE, no DELETE, no row lock,
//      no UPDATE of `evidence_items.transcript_sha256`).
//   3. THE REVISION CHAIN: numbers minted as head + 1, parents chained, a stale or racing writer is
//      a conflict, and the table's own CHECKs judge what arrives.
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  NO_TAP_SIGNAL,
  SerialQueue,
  assembleTranscript,
  createMemoryLog,
  createTranscriptRunner,
  decodedFileTimeline,
  encodeWavPcm16,
  openPcmSource,
  type AssembledTranscript,
  type SpeakerEmbeddingEngine,
  type TranscriberAdapter,
  type VoiceActivityDetector,
} from '@dems/transcriber';
import type { Pool, PoolClient } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { evidenceItem, hex64, insertRow, sessionHistory } from '../../../../test/db/fixtures';
import { SQLSTATE, expectRefused, inTransaction, until, waitingLocks } from '../../../../test/db/support';
import { useTestDatabase } from '../../../../test/helpers/db';
import { TranscriptStoreError, createTranscriptStore, type NewTranscriptRevision, type Queryable, type SealedTranscript } from '../index';

const db = useTestDatabase({ template: 'seed', slug: 'row78' });
let app: Pool;
let owner: Pool;
let operatorId: string;

const queryable = (runner: Pool | PoolClient): Queryable => ({ query: (text, values) => runner.query(text, values === undefined ? [] : [...values]) });
const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

let counter = 0;
/** A fresh pair of identifiers per use: the runtime role cannot delete what a test stored, so no test reuses a key. */
function identifiers(): { sessionId: string; evidenceId: string } {
  counter += 1;
  const tail = String(7800 + counter).padStart(4, '0');
  return { sessionId: `SES-20261009-${tail}`, evidenceId: `EV-20261009-${tail}` };
}

// ── the transcriber, with stand-ins ─────────────────────────────────────────────────────────

const RATE = 16_000;
/** Six runs of "speech", 4 s each, 1 s apart. */
const RUNS = [0, 1, 2, 3, 4, 5].map((index) => ({ fromMs: 1_000 + index * 5_000, toMs: 5_000 + index * 5_000 }));

function audioFile(): { dir: string; path: string } {
  const dir = mkdtempSync(join(tmpdir(), 'dems-row78-db-'));
  const samples = new Int16Array(32 * RATE);
  for (const run of RUNS) for (let index = (run.fromMs * RATE) / 1000; index < (run.toMs * RATE) / 1000; index += 1) samples[index] = 3_000;
  const path = join(dir, 'audio.wav');
  writeFileSync(path, encodeWavPcm16(samples, RATE));
  return { dir, path };
}

const vad: VoiceActivityDetector = { detect: async () => RUNS.map((run) => ({ ...run })) };

function engine(): TranscriberAdapter {
  const queue = new SerialQueue();
  return {
    backend: 'cpu-local',
    model: 'ggml-large-v3-turbo',
    queue,
    transcribe: (chunk) =>
      queue.run(async () => ({
        engine: 'cpu-local' as const,
        model: 'ggml-large-v3-turbo',
        language: 'id' as const,
        text: 'ucapan',
        segments: RUNS.filter((run) => run.fromMs >= chunk.offsetMs && run.toMs <= chunk.offsetMs + chunk.durationMs).map((run, id) => ({ id, start: (run.fromMs - chunk.offsetMs) / 1000, end: (run.toMs - chunk.offsetMs) / 1000, text: `Ucapan "${id}" — saksi.` })),
      })),
  };
}

const FACTS = { engine: 'stand-in-embedder', embeddingModel: 'stand-in-embedding', embeddingModelSha256: hex64('embedding') };
/** Two made-up voices taking turns: one embedding per span, exactly orthogonal, so the rule's confidence is 1. */
const twoSpeakers: SpeakerEmbeddingEngine = { embed: async (_path, _rate, spans) => ({ vectors: spans.map((_, index) => (index % 2 === 0 ? [1, 0] : [0, 1])), facts: FACTS }) };

/** Runs the real pipeline to its end and assembles the document. `tapLost` makes it a PARTIAL one. */
async function assembled(sessionId: string, options: { diarizer?: SpeakerEmbeddingEngine | null; tapLost?: boolean } = {}): Promise<AssembledTranscript> {
  const { dir, path } = audioFile();
  const timeline = decodedFileTimeline(RATE);
  const adapter = engine();
  const source = openPcmSource({ container: 'wav', path, sampleRateHz: RATE });
  const log = createMemoryLog();
  const runner = createTranscriptRunner({ sessionId, adapter, timeline, source, vad, sessionScratchDir: dir, log, tapLost: options.tapLost === true ? () => true : NO_TAP_SIGNAL });
  const report = await runner.step({ final: true });
  expect(report.complete).toBe(true);
  return assembleTranscript({
    sessionScratchDir: dir,
    identity: { sessionId, backend: adapter.backend, model: adapter.model, timeline },
    source,
    diarization: { enabled: true, engine: options.diarizer === undefined ? twoSpeakers : options.diarizer },
    model: { name: 'whisper-large-v3-turbo', version: 'ggml-v1', quantisation: 'none', sha256: hex64('model-file') },
    intervals: [{ source: 'MIC-01', fromMs: 0, toMs: null }],
    log,
  });
}

const sealedOf = (evidenceId: string, transcript: AssembledTranscript, overrides: Partial<SealedTranscript> = {}): SealedTranscript => ({
  evidenceId,
  jsonSha256: transcript.record.jsonSha256,
  srtSha256: transcript.record.srtSha256,
  vttSha256: transcript.record.vttSha256,
  model: transcript.record.model,
  diarization: transcript.record.diarization,
  labelsStatus: transcript.record.labelsStatus,
  createdAt: 1_791_529_000_000,
  ...overrides,
});

/** The item insert of the seal, as the runtime role: the ONLY statement that can write `transcript_sha256`. */
async function insertItem(client: PoolClient, ids: { sessionId: string; evidenceId: string }, transcriptSha256: string | null): Promise<void> {
  await insertRow(client, 'session_history', sessionHistory({ id: ids.sessionId, case_number: `LP/2026/1009-${ids.sessionId.slice(-4)}`, investigator_id: operatorId }));
  await insertRow(client, 'evidence_items', evidenceItem({ id: ids.evidenceId, session_id: ids.sessionId, case_number: `LP/2026/1009-${ids.sessionId.slice(-4)}`, investigator_id: operatorId, manifest_version: transcriptSha256 === null ? 1 : 2, transcript_sha256: transcriptSha256 }));
}

/** The whole unit of work, as `dems_app`: item (with its hash) + transcript, committed together. */
async function sealInOneUnitOfWork(ids: { sessionId: string; evidenceId: string }, transcript: AssembledTranscript, sealed: SealedTranscript = sealedOf(ids.evidenceId, transcript), boundTo: string | null = transcript.record.jsonSha256): Promise<void> {
  await inTransaction(app, async (client) => {
    await insertItem(client, ids, boundTo);
    await createTranscriptStore(queryable(client)).writeSealedTranscript(sealed);
  });
}

const stored = async (evidenceId: string): Promise<{ item: Record<string, unknown> | undefined; transcript: Record<string, unknown> | undefined }> => ({
  item: (await owner.query('SELECT transcript_sha256, labels_status, manifest_version FROM public.evidence_items WHERE id = $1', [evidenceId])).rows[0],
  transcript: (await owner.query('SELECT json_sha256, srt_sha256, vtt_sha256, model, diarization, labels_status, created_at::bigint::text AS created_at FROM public.transcripts WHERE evidence_id = $1', [evidenceId])).rows[0],
});

async function storeRefusal(run: Promise<unknown>): Promise<TranscriptStoreError> {
  let caught: unknown;
  try {
    await run;
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(TranscriptStoreError);
  return caught as TranscriptStoreError;
}

beforeAll(async () => {
  app = db.appPool();
  owner = db.ownerPool();
  operatorId = ((await owner.query('SELECT id FROM public.operators ORDER BY id LIMIT 1')).rows[0] as { id: string }).id;
});

describe('the database this file runs on', () => {
  it('the pools of this file are the runtime role and the owner, never the administrator', async () => {
    expect((await app.query('SELECT current_user AS role')).rows[0]).toEqual({ role: 'dems_app' });
    expect((await owner.query('SELECT current_user AS role')).rows[0]).toEqual({ role: 'dems_owner' });
  });
});

describe('ONE unit of work as dems_app: the item with its transcript hash, and the transcript row', () => {
  it('LABELLED transcript: both rows exist after the commit, bound to the SHA-256 of the document file the transcriber wrote', async () => {
    const ids = identifiers();
    const transcript = await assembled(ids.sessionId);
    expect(transcript.document.speaker_state).toBe('LABELLED');
    await sealInOneUnitOfWork(ids, transcript);

    const fileHash = sha256(readFileSync(transcript.files.json));
    const rows = await stored(ids.evidenceId);
    expect(rows.item).toEqual({ transcript_sha256: fileHash, labels_status: null, manifest_version: 2 });
    expect(rows.transcript).toEqual({
      json_sha256: fileHash,
      srt_sha256: sha256(readFileSync(transcript.files.srt)),
      vtt_sha256: sha256(readFileSync(transcript.files.vtt)),
      model: { name: 'whisper-large-v3-turbo', version: 'ggml-v1', quantisation: 'none', modelSha256: hex64('model-file'), params: { backend: 'cpu-local', modelId: 'ggml-large-v3-turbo', language: 'id' } },
      diarization: { numSpeakers: 2, status: 'LABELLED', confidence: 1, reason: null },
      labels_status: 'LABELLED',
      created_at: '1791529000000',
    });
    // The store reads it back, as the runtime role, in the names of the typed schema.
    expect(await createTranscriptStore(queryable(app)).read(ids.evidenceId)).toEqual(sealedOf(ids.evidenceId, transcript));
  });

  it('UNAVAILABLE transcript (no diarizer): stored the same way, with its reason, labels_status UNAVAILABLE', async () => {
    const ids = identifiers();
    const transcript = await assembled(ids.sessionId, { diarizer: null });
    expect(transcript.document.qa_flags).toContain('speaker labels unavailable');
    await sealInOneUnitOfWork(ids, transcript);
    const rows = await stored(ids.evidenceId);
    expect(rows.transcript).toMatchObject({ labels_status: 'UNAVAILABLE', diarization: { numSpeakers: 0, status: 'UNAVAILABLE', confidence: null, reason: 'ENGINE_NOT_CONFIGURED' } });
    expect(rows.item?.['transcript_sha256']).toBe(transcript.record.jsonSha256);
  });

  it('PARTIAL transcript (the tap was lost): its hash is bound and stored like any other; the state travels in the document and the seal record', async () => {
    const ids = identifiers();
    const transcript = await assembled(ids.sessionId, { tapLost: true });
    expect([transcript.document.header.state, transcript.record.state, transcript.record.partialReason]).toEqual(['PARTIAL', 'PARTIAL', 'TRANSCRIPT_AUDIO_UNAVAILABLE']);
    await sealInOneUnitOfWork(ids, transcript);
    expect((await stored(ids.evidenceId)).transcript?.['json_sha256']).toBe(transcript.record.jsonSha256);
    expect(JSON.parse(readFileSync(transcript.files.json, 'utf8')).header).toMatchObject({ state: 'PARTIAL', partial_reason: 'TRANSCRIPT_AUDIO_UNAVAILABLE' });
  });

  it('the same audio assembled twice gives ONE hash: two items are bound to the same document bytes', async () => {
    const a = identifiers();
    const b = identifiers();
    // The session id is part of the document, so the same session is assembled twice.
    const first = await assembled(a.sessionId);
    const second = await assembled(a.sessionId);
    expect(second.record.jsonSha256).toBe(first.record.jsonSha256);
    expect((await assembled(b.sessionId)).record.jsonSha256).not.toBe(first.record.jsonSha256);
  });
});

describe('NEGATIVE CONTROLS: a refusal leaves NEITHER the item nor the transcript (one unit of work)', () => {
  const absent = async (evidenceId: string): Promise<void> => {
    const rows = await stored(evidenceId);
    expect([rows.item, rows.transcript]).toEqual([undefined, undefined]);
  };

  it('the item is bound to another hash than the document (one character differs): TRANSCRIPT_HASH_NOT_BOUND, everything rolled back', async () => {
    const ids = identifiers();
    const transcript = await assembled(ids.sessionId);
    const other = `${transcript.record.jsonSha256.slice(0, 63)}${transcript.record.jsonSha256.endsWith('0') ? '1' : '0'}`;
    expect((await storeRefusal(sealInOneUnitOfWork(ids, transcript, sealedOf(ids.evidenceId, transcript), other))).code).toBe('TRANSCRIPT_HASH_NOT_BOUND');
    await absent(ids.evidenceId);
    expect((await owner.query('SELECT count(*)::int AS n FROM public.session_history WHERE id = $1', [ids.sessionId])).rows[0]).toEqual({ n: 0 });
  });

  it('the item carries no transcript hash (a v1 item): TRANSCRIPT_HASH_NOT_BOUND, everything rolled back', async () => {
    const ids = identifiers();
    const transcript = await assembled(ids.sessionId);
    expect((await storeRefusal(sealInOneUnitOfWork(ids, transcript, sealedOf(ids.evidenceId, transcript), null))).code).toBe('TRANSCRIPT_HASH_NOT_BOUND');
    await absent(ids.evidenceId);
  });

  it.each([
    ['a rendering hash that is not 64 hex characters', { srtSha256: 'not-a-hash' }, 'transcripts_hashes_check'],
    ['a speaker state outside the two', { labelsStatus: 'PARTLY' as never }, 'transcripts_labels_check'],
    ['a model that is not an object', { model: [] as never }, 'transcripts_json_check'],
  ])('the table refuses %s (23514): the item of the same transaction is rolled back with it', async (_label, change, constraint) => {
    const ids = identifiers();
    const transcript = await assembled(ids.sessionId);
    const error = await storeRefusal(sealInOneUnitOfWork(ids, transcript, sealedOf(ids.evidenceId, transcript, change)));
    expect([error.code, error.sqlState, error.constraint]).toEqual(['WRITE_FAILED', SQLSTATE.checkViolation, constraint]);
    await absent(ids.evidenceId);
  });

  it('a transcript for an item that does not exist: ITEM_NOT_FOUND from the store, and 23503 from the table itself', async () => {
    const ids = identifiers();
    const transcript = await assembled(ids.sessionId);
    expect((await storeRefusal(createTranscriptStore(queryable(app)).writeSealedTranscript(sealedOf(ids.evidenceId, transcript)))).code).toBe('ITEM_NOT_FOUND');
    await expectRefused(
      () => app.query('INSERT INTO public.transcripts (evidence_id, json_sha256, srt_sha256, vtt_sha256, model, diarization, labels_status, created_at) VALUES ($1, $2, $2, $2, $3::jsonb, $3::jsonb, $4, 1)', [ids.evidenceId, hex64('x'), '{}', 'UNAVAILABLE']),
      SQLSTATE.foreignKeyViolation,
    );
    await absent(ids.evidenceId);
  });

  it('the machine transcript is written ONCE: a second one for the same item is TRANSCRIPT_ALREADY_SEALED, the first is unchanged', async () => {
    const ids = identifiers();
    const transcript = await assembled(ids.sessionId);
    await sealInOneUnitOfWork(ids, transcript);
    const before = await stored(ids.evidenceId);
    const again = await storeRefusal(inTransaction(app, (client) => createTranscriptStore(queryable(client)).writeSealedTranscript(sealedOf(ids.evidenceId, transcript, { createdAt: 2 }))));
    expect([again.code, again.sqlState]).toEqual(['TRANSCRIPT_ALREADY_SEALED', SQLSTATE.uniqueViolation]);
    expect(await stored(ids.evidenceId)).toEqual(before);
  });
});

describe('privileges of the runtime role (0005): sealed means sealed', () => {
  let evidenceId: string;
  beforeAll(async () => {
    const ids = identifiers();
    evidenceId = ids.evidenceId;
    await sealInOneUnitOfWork(ids, await assembled(ids.sessionId));
  });

  it.each([
    ['UPDATE of evidence_items.transcript_sha256', 'UPDATE public.evidence_items SET transcript_sha256 = transcript_sha256 WHERE id = $1'],
    ['UPDATE of evidence_items.labels_status', "UPDATE public.evidence_items SET labels_status = 'LABELLED' WHERE id = $1"],
    ['UPDATE of evidence_items.manifest_version', 'UPDATE public.evidence_items SET manifest_version = 1 WHERE id = $1'],
    ['UPDATE of transcripts', 'UPDATE public.transcripts SET json_sha256 = json_sha256 WHERE evidence_id = $1'],
    ['DELETE of transcripts', 'DELETE FROM public.transcripts WHERE evidence_id = $1'],
    ['a row lock on transcripts (it needs UPDATE)', 'SELECT evidence_id FROM public.transcripts WHERE evidence_id = $1 FOR UPDATE'],
    ['UPDATE of transcript_revisions', "UPDATE public.transcript_revisions SET reason = 'changed afterwards' WHERE evidence_id = $1"],
    ['DELETE of transcript_revisions', 'DELETE FROM public.transcript_revisions WHERE evidence_id = $1'],
    ['DELETE of evidence_items', 'DELETE FROM public.evidence_items WHERE id = $1'],
  ])('%s is refused (42501)', async (_label, statement) => {
    await expectRefused(() => app.query(statement, [evidenceId]), SQLSTATE.insufficientPrivilege);
  });

  it('control: the runtime role MAY update a column of the item that 0003 grants (so the refusals above are about the column, not the table)', async () => {
    expect((await app.query('UPDATE public.evidence_items SET updated_at = updated_at WHERE id = $1', [evidenceId])).rowCount).toBe(1);
  });
});

describe('the revision chain as dems_app (dbc-3 §B.9; SEC35-21)', () => {
  let evidenceId: string;
  let machineHash: string;
  const revision = (overrides: Partial<NewTranscriptRevision>): NewTranscriptRevision => ({
    evidenceId,
    baseRevision: 0,
    parentSha256: machineHash,
    sha256: hex64('revision-1'),
    authorId: operatorId,
    reason: 'koreksi ejaan nama saksi',
    // A SIMULATED signature: the Core Ed25519 key and the Signer are row 83's. The table accepts both forms.
    signatureValue: hex64('signature-1'),
    signatureKeyId: 'CORE_KEY_TEST',
    signatureAlgorithm: 'SIMULATED-SHA256',
    signatureSimulated: true,
    signatureCertificateSha256: null,
    createdAt: 1_791_529_100_000,
    ...overrides,
  });
  const append = (value: NewTranscriptRevision) => inTransaction(app, (client) => createTranscriptStore(queryable(client)).appendRevision(value));
  const chain = async (): Promise<unknown[]> => (await owner.query('SELECT revision_no, parent_sha256, sha256 FROM public.transcript_revisions WHERE evidence_id = $1 ORDER BY revision_no', [evidenceId])).rows;

  beforeAll(async () => {
    const ids = identifiers();
    evidenceId = ids.evidenceId;
    const transcript = await assembled(ids.sessionId);
    machineHash = transcript.record.jsonSha256;
    await sealInOneUnitOfWork(ids, transcript);
  });

  it('no revision yet: the head is 0 and the parent is the machine transcript', async () => {
    expect(await createTranscriptStore(queryable(app)).revisionHead(evidenceId)).toEqual({ revisionNo: 0, parentSha256: machineHash });
  });

  it('revisions 1, 2, 3 are numbered head + 1 and chained: parent(1) = machine transcript, parent(n) = sha256(n - 1)', async () => {
    expect((await append(revision({}))).revisionNo).toBe(1);
    expect((await append(revision({ baseRevision: 1, parentSha256: hex64('revision-1'), sha256: hex64('revision-2') }))).revisionNo).toBe(2);
    expect((await append(revision({ baseRevision: 2, parentSha256: hex64('revision-2'), sha256: hex64('revision-3'), signatureAlgorithm: 'Ed25519', signatureSimulated: false, signatureValue: hex64('s3') + hex64('s3b'), signatureCertificateSha256: hex64('certificate') }))).revisionNo).toBe(3);
    expect(await chain()).toEqual([
      { revision_no: 1, parent_sha256: machineHash, sha256: hex64('revision-1') },
      { revision_no: 2, parent_sha256: hex64('revision-1'), sha256: hex64('revision-2') },
      { revision_no: 3, parent_sha256: hex64('revision-2'), sha256: hex64('revision-3') },
    ]);
    const read = await createTranscriptStore(queryable(app)).readRevisions(evidenceId);
    expect(read.map((entry) => [entry.revisionNo, entry.authorId, entry.signatureAlgorithm, entry.signatureSimulated, entry.signatureCertificateSha256])).toEqual([
      [1, operatorId, 'SIMULATED-SHA256', true, null],
      [2, operatorId, 'SIMULATED-SHA256', true, null],
      [3, operatorId, 'Ed25519', false, hex64('certificate')],
    ]);
    // The machine transcript is byte-unchanged by its revisions.
    expect((await stored(evidenceId)).transcript?.['json_sha256']).toBe(machineHash);
  });

  it.each([
    ['a stale base revision', { baseRevision: 2, parentSha256: hex64('revision-2') }],
    ['the right base with another parent than the head (a chain that would not link)', { baseRevision: 3, parentSha256: hex64('revision-1') }],
    ['a base ahead of the head', { baseRevision: 4, parentSha256: hex64('revision-3') }],
  ])('%s is TRANSCRIPT_REVISION_CONFLICT and stores nothing', async (_label, change) => {
    const before = await chain();
    expect((await storeRefusal(append(revision({ sha256: hex64('revision-x'), ...change })))).code).toBe('TRANSCRIPT_REVISION_CONFLICT');
    expect(await chain()).toEqual(before);
  });

  it('two writers on the same head: the second waits for the first, then gets TRANSCRIPT_REVISION_CONFLICT (the primary key decides, no row lock)', async () => {
    const before = (await chain()).length;
    const first = await app.connect();
    try {
      await first.query('BEGIN');
      const stored4 = await createTranscriptStore(queryable(first)).appendRevision(revision({ baseRevision: 3, parentSha256: hex64('revision-3'), sha256: hex64('revision-4a') }));
      expect(stored4.revisionNo).toBe(4);
      // The second writer read the same head (the first has not committed) and now waits on the key.
      const second = storeRefusal(append(revision({ baseRevision: 3, parentSha256: hex64('revision-3'), sha256: hex64('revision-4b') })));
      await until(async () => (await waitingLocks(owner)) > 0, 'the second writer to wait on the key of revision 4');
      await first.query('COMMIT');
      const error = await second;
      expect([error.code, error.sqlState, error.constraint]).toEqual(['TRANSCRIPT_REVISION_CONFLICT', SQLSTATE.uniqueViolation, 'transcript_revisions_pkey']);
    } finally {
      first.release();
    }
    const rows = (await chain()) as { sha256: string }[];
    expect(rows).toHaveLength(before + 1);
    expect(rows.at(-1)?.sha256).toBe(hex64('revision-4a'));
  });

  it.each([
    ['a reason shorter than five characters', { reason: 'typo' }, SQLSTATE.checkViolation, 'transcript_revisions_reason_check'],
    ['an author who is no operator', { authorId: 'OPR-999' }, SQLSTATE.foreignKeyViolation, 'transcript_revisions_author_id_fkey'],
    ['an Ed25519 signature flagged as simulated', { signatureAlgorithm: 'Ed25519' as const, signatureSimulated: true, signatureValue: hex64('a') + hex64('b') }, SQLSTATE.checkViolation, 'transcript_revisions_signature_check'],
    ['an Ed25519 signature of 32 bytes', { signatureAlgorithm: 'Ed25519' as const, signatureSimulated: false }, SQLSTATE.checkViolation, 'transcript_revisions_signature_value_check'],
    ['a key id that is not a CODE', { signatureKeyId: 'core key' }, SQLSTATE.checkViolation, 'transcript_revisions_key_id_check'],
    ['a revision hash that is not 64 hex characters', { sha256: 'abc' }, SQLSTATE.checkViolation, 'transcript_revisions_hashes_check'],
  ])('the table refuses %s: WRITE_FAILED with the SQLSTATE and the constraint, the chain unchanged', async (_label, change, sqlState, constraint) => {
    const before = await chain();
    const head = await createTranscriptStore(queryable(app)).revisionHead(evidenceId);
    const error = await storeRefusal(append(revision({ baseRevision: head.revisionNo, parentSha256: head.parentSha256, sha256: hex64('revision-bad'), ...change })));
    expect([error.code, error.sqlState, error.constraint]).toEqual(['WRITE_FAILED', sqlState, constraint]);
    expect(await chain()).toEqual(before);
  });

  it('an item without a machine transcript has no chain: TRANSCRIPT_NOT_FOUND', async () => {
    const ids = identifiers();
    await inTransaction(app, (client) => insertItem(client, ids, null));
    expect((await storeRefusal(append(revision({ evidenceId: ids.evidenceId })))).code).toBe('TRANSCRIPT_NOT_FOUND');
  });
});
