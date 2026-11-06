// The database-backed snapshot store, without a database (blueprint row 115, integration pass B;
// decision D112). What PostgreSQL says about the same statements is `snapshot-store.db.test.ts`.
//
//   - the statements: two, constant, bound; INSERT with `ON CONFLICT (session_id) DO NOTHING`,
//     then SELECT; no UPDATE, no DELETE, no TRUNCATE of the table anywhere in the unit (a source
//     scan with a planted positive control), no credential column;
//   - `put` returns what the table HOLDS (the SELECT), not what it was handed;
//   - a failure is thrown, and the composition ends it as "no snapshot": one error line in the log
//     and in the persistent error log, nothing transcribed, never the current configuration;
//   - the mount uses this store when none is passed.
import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { mountTranscription, transcriptionControl, type SttSessionSnapshot } from '../index';
import { INSERT_SNAPSHOT, READ_SNAPSHOT, SnapshotRowError, insertSnapshotValues, snapshotOfRow, type Queryable } from '../statements';
import { createDatabaseSnapshotStore } from '../snapshot';
import { fakeHost, makeDataDir, serverRow } from './support';

const SESSION = 'SES-20310101-0001';
const taken: SttSessionSnapshot = {
  sessionId: SESSION,
  takenAt: 1_900_000_000_000,
  enabled: true,
  backend: 'omlx-server',
  endpoint: 'http://127.0.0.1:8555',
  model: 'whisper-large-v3-turbo',
  language: 'id',
  diarization: true,
  credentialKind: 'REFERENCE',
  revision: 3,
};

/** The row as `pg` answers it: bigint columns as text. */
const rowOf = (snapshot: SttSessionSnapshot, more: Record<string, unknown> = {}): Record<string, unknown> => ({
  session_id: snapshot.sessionId,
  enabled: snapshot.enabled,
  backend: snapshot.backend,
  endpoint: snapshot.endpoint,
  model: snapshot.model,
  language: snapshot.language,
  diarization: snapshot.diarization,
  credential_kind: snapshot.credentialKind,
  config_revision: String(snapshot.revision),
  taken_at: String(snapshot.takenAt),
  ...more,
});

/** A table that holds at most one row per session and answers like the statements say. */
function fakeTable(): Queryable & { readonly sent: { text: string; values: readonly unknown[] | undefined }[] } {
  const rows = new Map<string, Record<string, unknown>>();
  const sent: { text: string; values: readonly unknown[] | undefined }[] = [];
  return {
    sent,
    async query(text, values) {
      sent.push({ text, values });
      if (text === INSERT_SNAPSHOT) {
        const id = values?.[0] as string;
        if (!rows.has(id)) {
          const v = values ?? [];
          rows.set(id, { session_id: v[0], enabled: v[1], backend: v[2], endpoint: v[3], model: v[4], language: v[5], diarization: v[6], credential_kind: v[7], config_revision: String(v[8]), taken_at: String(v[9]) });
        }
        return { rows: [] as never[], rowCount: 0 };
      }
      if (text === READ_SNAPSHOT) {
        const found = rows.get(values?.[0] as string);
        return { rows: (found === undefined ? [] : [found]) as never[], rowCount: found === undefined ? 0 : 1 };
      }
      throw new Error(`unexpected statement: ${text}`);
    },
  };
}

describe('the statements', () => {
  it('are two constant texts with ten and one bind parameter; the insert never updates', () => {
    expect(INSERT_SNAPSHOT).toMatch(/^INSERT INTO public\.session_stt_config \(session_id, enabled, backend, endpoint, model, language, diarization, credential_kind, config_revision, taken_at\) VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9, \$10\) ON CONFLICT \(session_id\) DO NOTHING$/);
    expect(READ_SNAPSHOT).toMatch(/^SELECT session_id, enabled, backend, endpoint, model, language, diarization, credential_kind, config_revision, taken_at FROM public\.session_stt_config WHERE session_id = \$1$/);
    expect(insertSnapshotValues(taken)).toEqual([SESSION, true, 'omlx-server', 'http://127.0.0.1:8555', 'whisper-large-v3-turbo', 'id', true, 'REFERENCE', 3, 1_900_000_000_000]);
    for (const text of [INSERT_SNAPSHOT, READ_SNAPSHOT]) expect(text).not.toMatch(/credential_ref|secret_ciphertext|nonce|\bUPDATE\b|\bDELETE\b|TRUNCATE|DO UPDATE/i);
  });
});

/** The statements in the production sources of this unit that name the table and are not an INSERT or a SELECT. */
const WRITES_OTHER_THAN_INSERT = /(\bUPDATE\b[^;`'"]*session_stt_config|\bDELETE\s+FROM\b[^;`'"]*session_stt_config|\bTRUNCATE\b[^;`'"]*session_stt_config|DO\s+UPDATE)/i;

describe('write-once by construction: no UPDATE and no DELETE of the table in the unit', () => {
  const folder = join(dirname(fileURLToPath(import.meta.url)), '..');
  const sources = readdirSync(folder).filter((name) => name.endsWith('.ts')).map((name) => ({ name, text: readFileSync(join(folder, name), 'utf8') }));

  it('finds the sources, and the table in statements.ts only', () => {
    expect(sources.length).toBeGreaterThanOrEqual(10);
    expect(sources.filter((source) => /FROM public\.session_stt_config|INTO public\.session_stt_config/.test(source.text)).map((source) => source.name)).toEqual(['statements.ts']);
  });

  it('holds no statement that updates, deletes from or truncates it, nor an upsert', () => {
    const offenders = sources.filter((source) => WRITES_OTHER_THAN_INSERT.test(source.text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''))).map((source) => source.name);
    expect(offenders).toEqual([]);
  });

  it('the scan can fail (positive control): a planted UPDATE, DELETE, TRUNCATE and upsert are each found', () => {
    for (const planted of ['UPDATE public.session_stt_config SET enabled = false', 'DELETE FROM public.session_stt_config WHERE true', 'TRUNCATE public.session_stt_config', 'ON CONFLICT (session_id) DO UPDATE SET enabled = true']) {
      expect(WRITES_OTHER_THAN_INSERT.test(planted), planted).toBe(true);
    }
  });
});

describe('createDatabaseSnapshotStore', () => {
  it('put inserts then reads back, and returns what the table holds: the FIRST snapshot, always', async () => {
    const table = fakeTable();
    const store = createDatabaseSnapshotStore(table);
    expect(await store.get(SESSION)).toBeNull();
    const first = await store.put(taken);
    const second = await store.put({ ...taken, backend: 'cpu-local', endpoint: null, model: 'ggml-large-v3-turbo', credentialKind: null, revision: 9, takenAt: taken.takenAt + 1 });
    expect(first).toEqual(taken);
    expect(second).toEqual(taken);
    expect(Object.isFrozen(second)).toBe(true);
    expect(await store.get(SESSION)).toEqual(taken);
    // Per put: one INSERT, then one SELECT. Nothing else is ever sent.
    expect(table.sent.map((entry) => entry.text)).toEqual([READ_SNAPSHOT, INSERT_SNAPSHOT, READ_SNAPSHOT, INSERT_SNAPSHOT, READ_SNAPSHOT, READ_SNAPSHOT]);
  });

  it('puts racing for one session leave one row and every caller reads the same snapshot', async () => {
    const table = fakeTable();
    const store = createDatabaseSnapshotStore(table);
    const results = await Promise.all([0, 1, 2, 3].map((index) => store.put({ ...taken, revision: 3 + index, takenAt: taken.takenAt + index })));
    expect(new Set(results.map((result) => JSON.stringify(result))).size).toBe(1);
    expect(table.sent.filter((entry) => entry.text === INSERT_SNAPSHOT).length).toBe(4);
  });

  it('reads the bigint columns that arrive as text, and refuses a row outside the contract', () => {
    expect(snapshotOfRow(rowOf(taken) as never)).toEqual(taken);
    expect(() => snapshotOfRow(rowOf(taken, { backend: 'openai' }) as never)).toThrow(SnapshotRowError);
    expect(() => snapshotOfRow(rowOf(taken, { credential_kind: 'PLAINTEXT' }) as never)).toThrow(SnapshotRowError);
    expect(() => snapshotOfRow(rowOf(taken, { config_revision: '9007199254740993' }) as never)).toThrow(SnapshotRowError);
    expect(() => snapshotOfRow(rowOf(taken, { enabled: 'true' }) as never)).toThrow(SnapshotRowError);
  });

  it('a failing statement is thrown, with its SQLSTATE, and nothing is made up', async () => {
    const refusal = Object.assign(new Error('new row violates check constraint'), { code: '23514' });
    const store = createDatabaseSnapshotStore({ async query() { throw refusal; } });
    await expect(store.put(taken)).rejects.toBe(refusal);
    await expect(store.get(SESSION)).rejects.toBe(refusal);
  });
});

const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

describe('the mount uses the database store by default', () => {
  it('snapshot and read-back go to the pool as the two statements; a 23514 refusal is NO snapshot, one error line, nothing transcribed', async () => {
    const dir = makeDataDir('store');
    dirs.push(dir.dataDir);
    const host = fakeHost(dir.dataDir);
    const sent: string[] = [];
    const table = fakeTable();
    let refuse = false;
    const pool = host.app.db.pool;
    const base = pool.query.bind(pool);
    // The host's pool, wrapped: the table is a stand-in that keeps one row per session; the INSERT
    // can be refused as the table's CHECK would refuse it.
    (host.app.db as { pool: typeof pool }).pool = {
      async query(text: string, values?: unknown[]) {
        sent.push(text);
        if (refuse && text === INSERT_SNAPSHOT) throw Object.assign(new Error('new row for relation "session_stt_config" violates check constraint'), { code: '23514' });
        if (text === INSERT_SNAPSHOT || text === READ_SNAPSHOT) return table.query(text, values) as never;
        return base(text, values) as never;
      },
    };
    const control = mountTranscription(host.app, { readConfig: async () => serverRow('http://127.0.0.1:8555') });

    refuse = true;
    const outcome = await control.snapshotSttConfigForSession(SESSION);
    expect(outcome).toEqual({ ok: false, code: 'SNAPSHOT_STORE_FAILED' });
    expect(sent).toContain(INSERT_SNAPSHOT);
    const lines = host.persisted.filter((entry) => entry.level === 'error');
    expect(lines.length).toBe(1);
    expect(lines[0]).toMatchObject({ source: 'transcription.snapshot', code: 'SNAPSHOT_STORE_FAILED', context: { correlationId: SESSION, sqlstate: '23514' } });
    // No snapshot: not the current configuration either.
    expect(await transcriptionControl(host.app).sessionSnapshot(SESSION)).toBeNull();
    expect(await control.tapPathFor(SESSION)).toBeNull();
    expect((await control.openSession(SESSION)).state).toBe('NO_SNAPSHOT');
    // Control: with the refusal lifted the same call stores, reads back and adds no error line.
    refuse = false;
    const errorsBefore = host.persisted.filter((entry) => entry.level === 'error').length;
    const next = await control.snapshotSttConfigForSession('SES-20310101-0002');
    expect(next).toMatchObject({ ok: true, taken: true, snapshot: { sessionId: 'SES-20310101-0002', revision: 1 } });
    expect(host.persisted.filter((entry) => entry.level === 'error').length).toBe(errorsBefore);
    expect(await control.sessionSnapshot('SES-20310101-0002')).toMatchObject({ backend: 'omlx-server' });
  });
});
