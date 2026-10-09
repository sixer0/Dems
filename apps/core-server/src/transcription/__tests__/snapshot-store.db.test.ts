// The session STT snapshot in PostgreSQL (blueprint row 115, integration pass B; decision D112;
// note 60b section 5; migrations 0011 and 0012), as `dems_app` on a throw-away clone of this run
// (`useTestDatabase`): no live database is touched, schema version 5 / dbc-6.
//
//   1. THE STORE: write-once; "put then get returns the FIRST snapshot, always", also for puts at
//      once (one row, every caller reads the same snapshot); a table CHECK refusing the row (23514)
//      stores nothing, and the store throws; UPDATE, DELETE and TRUNCATE are refused 42501; the
//      table has no credential column.
//   2. `M6-STTCFG-NEXT` ACROSS A RESTART: a snapshot is taken, the stored configuration is changed
//      through operation 91, the Core is torn down and built again on the SAME database (a new app
//      instance, a new composition), and the session still has its snapshot - its backend, its
//      manifest members, its tap - while the next session takes the new row. Two runs.
//      Negative control (done by hand, see the implementation note): with the memory store forced
//      into the mount, the same test is red - the new composition has no snapshot.
import type { SttConfig } from '@dems/shared/api';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SQLSTATE, expectRefused } from '../../../test/db/support';
import { useTestDatabase } from '../../../test/helpers/db';
import type { Headers } from '../../../test/support/identity';
import { webOperator } from '../../../test/support/guard';
import { identityControl } from '../../modules/identity';
import { SUPERVISOR, WEB_ORIGIN, bootedApp, type BootedApp } from '../../modules/storage/__tests__/support';
import { throttleControl } from '../../plugins/throttle';
import { createDatabaseSnapshotStore, transcriptionControl, type SttSessionSnapshot } from '../index';

const db = useTestDatabase({ template: 'seed', slug: 'row115b' });
let owner: Pool;
let runtime: Pool;

const PATH = '/api/v1/transcription/config';
const REFERENCE = 'omlx-settings:auth.api_key';

const snapshotOf = (sessionId: string, more: Partial<SttSessionSnapshot> = {}): SttSessionSnapshot => ({
  sessionId,
  takenAt: Date.UTC(2031, 0, 1),
  enabled: true,
  backend: 'cpu-local',
  endpoint: null,
  model: 'ggml-large-v3-turbo',
  language: 'id',
  diarization: true,
  credentialKind: null,
  revision: 1,
  ...more,
});

const rowCount = async (sessionId: string): Promise<number> =>
  Number((await owner.query<{ n: string }>('SELECT count(*) AS n FROM public.session_stt_config WHERE session_id = $1', [sessionId])).rows[0]?.n);

beforeAll(() => {
  owner = db.ownerPool();
  runtime = db.appPool();
});

describe('the database and the table', () => {
  it('is at schema version 5 / dbc-6, and the table has the ten columns and no credential column', async () => {
    const meta = await owner.query('SELECT schema_version, contract_revision FROM public.schema_meta');
    expect(meta.rows).toEqual([{ schema_version: 5, contract_revision: 'dbc-6' }]);
    const columns = await owner.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'session_stt_config' ORDER BY ordinal_position");
    expect(columns.rows.map((row) => row.column_name)).toEqual(['session_id', 'enabled', 'backend', 'endpoint', 'model', 'language', 'diarization', 'credential_kind', 'config_revision', 'taken_at']);
    expect(columns.rows.some((row) => /credential_ref|secret|nonce/.test(row.column_name))).toBe(false);
  });
});

describe('the store as dems_app', () => {
  it('is write-once: a second put returns the first snapshot and the stored row does not move', async () => {
    const store = createDatabaseSnapshotStore(runtime);
    const id = 'SES-20310101-0201';
    expect(await store.get(id)).toBeNull();
    const first = snapshotOf(id, { backend: 'omlx-server', endpoint: 'http://127.0.0.1:8555', model: 'whisper-large-v3-turbo', credentialKind: 'REFERENCE', revision: 7, takenAt: 1_900_000_000_123 });
    expect(await store.put(first)).toEqual(first);
    const later = snapshotOf(id, { revision: 9, takenAt: 1_900_000_999_999 });
    expect(await store.put(later)).toEqual(first);
    expect(await store.get(id)).toEqual(first);
    expect(await rowCount(id)).toBe(1);
    // The bigint columns are numbers again, not text.
    const read = await store.get(id);
    expect([typeof read?.revision, typeof read?.takenAt]).toEqual(['number', 'number']);
    // The owner sees the same row.
    const stored = await owner.query('SELECT enabled, backend, endpoint, model, language, diarization, credential_kind, config_revision::int AS revision, taken_at::text AS taken_at FROM public.session_stt_config WHERE session_id = $1', [id]);
    expect(stored.rows).toEqual([{ enabled: true, backend: 'omlx-server', endpoint: 'http://127.0.0.1:8555', model: 'whisper-large-v3-turbo', language: 'id', diarization: true, credential_kind: 'REFERENCE', revision: 7, taken_at: '1900000000123' }]);
  });

  it('first wins under puts at once: one row, every caller reads the same snapshot (20 sessions, 3 putters each)', async () => {
    const store = createDatabaseSnapshotStore(runtime);
    for (let index = 0; index < 20; index += 1) {
      const id = `SES-20310101-${String(300 + index).padStart(4, '0')}`;
      const results = await Promise.all([1, 2, 3].map((revision) => store.put(snapshotOf(id, { revision, takenAt: 1_900_000_000_000 + revision }))));
      expect(new Set(results.map((result) => JSON.stringify(result))).size, id).toBe(1);
      expect(await rowCount(id), id).toBe(1);
      expect(await store.get(id), id).toEqual(results[0]);
      // The winner is one of the three, whole: its revision and its instant belong together.
      expect(results[0]?.takenAt, id).toBe(1_900_000_000_000 + (results[0]?.revision ?? 0));
    }
  });

  it('a row the table refuses (23514) stores nothing, and the store throws: no snapshot, never a made-up one', async () => {
    const store = createDatabaseSnapshotStore(runtime);
    const cases: [string, Partial<SttSessionSnapshot>][] = [
      ['SES-20310101-0401', { backend: 'omlx-server', endpoint: 'http://example.com:8555', model: 'whisper-large-v3-turbo' }],
      ['SES-20310101-0402', { backend: 'omlx-server', endpoint: null, model: 'whisper-large-v3-turbo' }],
      ['SES-20310101-0403', { language: 'en' }],
      ['SES-20310101-0404', { revision: 0 }],
    ];
    for (const [id, more] of cases) {
      await expectRefused(() => store.put(snapshotOf(id, more)), SQLSTATE.checkViolation);
      expect(await store.get(id), id).toBeNull();
      expect(await rowCount(id), id).toBe(0);
    }
    await expectRefused(() => store.put(snapshotOf('NOT-A-SESSION')), SQLSTATE.checkViolation);
    // Control: the same call with a row the table accepts stores.
    expect((await store.put(snapshotOf('SES-20310101-0405'))).sessionId).toBe('SES-20310101-0405');
  });

  it('UPDATE, DELETE and TRUNCATE are refused 42501; the row is unchanged afterwards', async () => {
    const store = createDatabaseSnapshotStore(runtime);
    const id = 'SES-20310101-0501';
    await store.put(snapshotOf(id));
    for (const [text, values] of [
      ['UPDATE public.session_stt_config SET enabled = false WHERE session_id = $1', [id]],
      ['UPDATE public.session_stt_config SET config_revision = 99', []],
      ['DELETE FROM public.session_stt_config WHERE session_id = $1', [id]],
      ['TRUNCATE public.session_stt_config', []],
    ] as const) {
      await expectRefused(() => runtime.query(text, [...values]), SQLSTATE.insufficientPrivilege);
    }
    expect(await store.get(id)).toEqual(snapshotOf(id));
    // Control: the owner CAN update (the refusal above is the runtime role's privilege, not a broken statement).
    await owner.query('UPDATE public.session_stt_config SET enabled = enabled WHERE session_id = $1', [id]);
  });
});

describe('M6-STTCFG-NEXT across a restart of the Core on the same database', () => {
  let booted: BootedApp | null = null;
  let supervisor: Headers;

  async function start(): Promise<BootedApp> {
    const app = await bootedApp(db);
    supervisor = await webOperator(app, SUPERVISOR.username);
    await app.app.pipeline.drain();
    booted = app;
    return app;
  }
  const post = (app: BootedApp, payload: unknown): Promise<LightMyRequestResponse> =>
    app.app.inject({ method: 'POST', url: PATH, headers: { ...supervisor, origin: WEB_ORIGIN }, payload: payload as object });
  const revisionNow = async (app: BootedApp): Promise<number> => ((await app.app.inject({ method: 'GET', url: PATH, headers: supervisor })).json() as SttConfig).revision;

  beforeEach(() => {
    if (booted === null) return;
    throttleControl(booted.app).reset();
    identityControl(booted.app).lockout.reset();
  });
  afterAll(async () => {
    await booted?.app.close();
  });

  const runs = [
    { run: 1, session: 'SES-20310101-0601', next: 'SES-20310101-0602', change: (revision: number) => ({ revision, backend: 'omlx-server', endpoint: 'http://127.0.0.1:8555', model: 'whisper-large-v3-turbo', credential: { kind: 'REFERENCE', ref: REFERENCE } }), afterwards: { backend: 'omlx-server', enabled: true } },
    { run: 2, session: 'SES-20310101-0611', next: 'SES-20310101-0612', change: (revision: number) => ({ revision, enabled: false }), afterwards: { backend: 'omlx-server', enabled: false } },
  ] as const;

  for (const scenario of runs) {
    it(`run ${scenario.run}: snapshot, change through operation 91, restart; the session keeps its snapshot, the next session takes the new row`, async () => {
      await booted?.app.close();
      const before = await start();
      const control = transcriptionControl(before.app);
      const revision = await revisionNow(before);
      const taken = await control.snapshotSttConfigForSession(scenario.session);
      await control.settled();
      expect(taken).toMatchObject({ ok: true, taken: true });
      if (!taken.ok) throw new Error('no snapshot');
      const mine = taken.snapshot;
      expect(mine.revision).toBe(revision);

      // The stored configuration moves on while the session is open (operation 91: NEXT_SESSION).
      expect((await post(before, scenario.change(revision))).statusCode).toBe(200);
      expect(await revisionNow(before)).toBe(revision + 1);

      // THE RESTART: the whole app, and with it the composition and everything in its memory.
      await before.app.close();
      const after = await start();
      const reborn = transcriptionControl(after.app);
      expect(reborn).not.toBe(control);

      // The session's backend still comes from its snapshot, not from the row as it is now.
      expect(await reborn.sessionSnapshot(scenario.session)).toEqual(mine);
      expect(await reborn.manifestSnapshot(scenario.session)).toEqual({ enabled: mine.enabled, backend: mine.backend, model: mine.model, diarization: mine.diarization, revision });
      const opened = await reborn.openSession(scenario.session);
      expect(opened.state).not.toBe('NO_SNAPSHOT');
      expect(opened.snapshot).toEqual(mine);
      if (opened.state === 'ENABLED') opened.close();
      expect(await reborn.snapshotSttConfigForSession(scenario.session)).toEqual({ ok: true, snapshot: mine, taken: false });
      expect(await rowCount(scenario.session)).toBe(1);

      // The next session takes the row as it is now.
      const next = await reborn.snapshotSttConfigForSession(scenario.next);
      await reborn.settled();
      expect(next).toMatchObject({ ok: true, taken: true, snapshot: { revision: revision + 1, ...scenario.afterwards } });
      console.info(`[row115b] M6-STTCFG-NEXT across a restart, run ${scenario.run} | ${scenario.session} kept rev ${revision} ${mine.backend}/enabled=${mine.enabled} | ${scenario.next} took rev ${revision + 1} ${next.ok ? next.snapshot.backend : '-'}/enabled=${next.ok ? next.snapshot.enabled : '-'} | opened as ${opened.state}`);
    });
  }
});
