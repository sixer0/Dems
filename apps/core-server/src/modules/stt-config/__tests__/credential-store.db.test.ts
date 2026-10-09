// The Core credential store against PostgreSQL (blueprint row 84; D68(c), D80(7), D83 F-122-2;
// SEC35-03; checks M6-STTCFG-API "200 half" and the sealer part of M7-CONN-CRED-1).
//
// The real app factory on a clone of the seed, as `dems_app`, booted as the entry point boots it,
// with a data directory in the system's temporary folder: the app has a Core credential store of
// its own there, and NO key is ever written to the data directory of this repository. The clone is
// a throw-away database of this run (`useTestDatabase`): no live database is touched.
//
//   - a `SECRET` write of operation 91 answers 200 with `credentialKind: ENCRYPTED` on a booted
//     server; the table's CHECKs accept the envelope; the store's opener opens what the table holds;
//   - the runtime role still cannot read back either credential table (42501);
//   - the sealer of a camera credential frames a ONE-CHARACTER secret so that
//     `capture_device_credentials_secret_check` (>= 33 bytes) holds, with a negative control that
//     the bare AES-256-GCM of the same secret is refused by that CHECK (23514);
//   - both canaries are in no stored audit row, no stored event and no log line.
//
// NOT HERE (stated, not faked): operations 89 and 96 themselves. Their routes are rows 142 and 66;
// this file writes the camera row with the statement those routes will send, as the runtime role.
import { createCipheriv, randomBytes } from 'node:crypto';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { OperatorRole } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { webOperator } from '../../../../test/support/guard';
import type { Headers } from '../../../../test/support/identity';
import { coreCredentialStore, type CoreCredentialStore } from '../../../credential-store';
import { throttleControl } from '../../../plugins/throttle';
import { identityControl } from '../../identity';
import { SUPERVISOR, WEB_ORIGIN, bootedApp, type BootedApp } from '../../storage/__tests__/support';
import { sttConfigControl } from '../index';

const db = useTestDatabase({ template: 'seed', slug: 'row84' });
const dataDir = mkdtempSync(join(tmpdir(), 'dems-row84-db-'));
let booted: BootedApp;
let owner: Pool;
let store: CoreCredentialStore;
let sessions: Partial<Record<OperatorRole, Headers>>;

const PATH = '/api/v1/transcription/config';
/** Planted in requests only. Built from parts, so that no other file of the repository holds them. */
const STT_CANARY = ['stt', 'CANARY', 'db84', 'Lp4Wq8Zs2Fh6'].join('-');
const CAMERA_CANARY = ['cam', 'CANARY', 'db84', 'Tg7Mx1Nc5Rk9'].join('-');
const INSERT_CREDENTIAL =
  'INSERT INTO public.capture_device_credentials (device_id, username, secret_ciphertext, nonce, key_ref, rotated_at) VALUES ($1, $2, $3, $4, $5, $6)';

const UPSERT_SET = 'username = EXCLUDED.username, secret_ciphertext = EXCLUDED.secret_ciphertext, nonce = EXCLUDED.nonce, key_ref = EXCLUDED.key_ref, rotated_at = EXCLUDED.rotated_at';

const post = (payload: unknown): Promise<LightMyRequestResponse> =>
  booted.app.inject({ method: 'POST', url: PATH, headers: { ...sessions.SUPERVISOR, origin: WEB_ORIGIN }, payload: payload as object });
const revisionNow = async (): Promise<number> => ((await booted.app.inject({ method: 'GET', url: PATH, headers: sessions.SUPERVISOR ?? {} })).json() as { revision: number }).revision;
const sqlstate = (pending: Promise<unknown>): Promise<string | undefined> =>
  pending.then(
    () => 'answered',
    (error: { code?: string }) => error.code,
  );

beforeAll(async () => {
  owner = db.ownerPool();
  booted = await bootedApp({ runtime: db.runtime, run: { dataDir }, onCleanup: (close) => db.onCleanup(close) });
  const opened = coreCredentialStore(booted.app);
  if (opened.status !== 'READY') throw new Error(`the store is ${opened.status}`);
  store = opened.store;
  sessions = { SUPERVISOR: await webOperator(booted, SUPERVISOR.username) };
  await booted.app.pipeline.drain();
});

afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

beforeEach(() => {
  throttleControl(booted.app).reset();
  identityControl(booted.app).lockout.reset();
});

describe('operation 91 on a booted server with the Core credential store', () => {
  it('a SECRET write answers 200 ENCRYPTED; the table holds the envelope and the store opens it; the runtime role cannot read it back', async () => {
    expect(sttConfigControl(booted.app).hasCredentialSealer()).toBe(true);
    const revision = await revisionNow();
    const response = await post({ revision, credential: { kind: 'SECRET', value: STT_CANARY } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ credentialSet: true, credentialKind: 'ENCRYPTED', revision: revision + 1 });
    expect(response.body).not.toContain(STT_CANARY);
    const row = (await owner.query('SELECT credential_kind, credential_ref, secret_ciphertext, nonce FROM public.stt_config')).rows[0] as { credential_kind: string; credential_ref: string; secret_ciphertext: Buffer; nonce: Buffer };
    expect(row.credential_kind).toBe('ENCRYPTED');
    expect(row.credential_ref).toMatch(/^STT_API_KEY_K_[0-9A-F]{20}$/);
    expect([row.nonce.byteLength, row.secret_ciphertext.byteLength]).toEqual([12, 80]);
    expect(row.secret_ciphertext.includes(Buffer.from(STT_CANARY))).toBe(false);
    // The opener (row 115 hands it to the transcriber's key-loader) on exactly what the table holds.
    expect(store.stt.open({ keyRef: row.credential_ref, ciphertext: new Uint8Array(row.secret_ciphertext), nonce: new Uint8Array(row.nonce) })).toBe(STT_CANARY);
    expect(readdirSync(join(dataDir, 'credential-store', 'keys'))).toEqual([`${row.credential_ref}.key`]);
    for (const text of ['SELECT secret_ciphertext FROM public.stt_config', 'SELECT credential_ref FROM public.stt_config', 'SELECT nonce FROM public.stt_config', 'SELECT * FROM public.stt_config']) {
      expect(await sqlstate(booted.app.db.pool.query(text)), text).toBe('42501');
    }
    console.info(`[row84] M6-STTCFG-API 200 half (PostgreSQL) | status=${response.statusCode} credentialKind=ENCRYPTED ciphertextBytes=${row.secret_ciphertext.byteLength} nonceBytes=${row.nonce.byteLength} opened=${store.stt.open({ keyRef: row.credential_ref, ciphertext: new Uint8Array(row.secret_ciphertext), nonce: new Uint8Array(row.nonce) }) === STT_CANARY}`);
  });

  it('a one-character STT secret is stored and opens', async () => {
    const revision = await revisionNow();
    expect((await post({ revision, credential: { kind: 'SECRET', value: 'k' } })).statusCode).toBe(200);
    const row = (await owner.query('SELECT credential_ref, secret_ciphertext, nonce FROM public.stt_config')).rows[0] as { credential_ref: string; secret_ciphertext: Buffer; nonce: Buffer };
    expect(store.stt.open({ keyRef: row.credential_ref, ciphertext: new Uint8Array(row.secret_ciphertext), nonce: new Uint8Array(row.nonce) })).toBe('k');
  });
});

describe('the camera credential (the sealer part of M7-CONN-CRED-1; the routes are rows 142 and 66)', () => {
  it('a one-character secret is framed past the 33-byte CHECK; the bare cipher of it is refused 23514 (negative control)', async () => {
    const runtime = booted.app.db.pool;
    // Negative control first: AES-256-GCM of one character without a frame is 17 bytes.
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', randomBytes(32), nonce);
    const bare = Buffer.concat([cipher.update('x', 'utf8'), cipher.final(), cipher.getAuthTag()]);
    expect(bare.byteLength).toBe(17);
    expect(await sqlstate(runtime.query(INSERT_CREDENTIAL, ['CAM-01', 'operator', bare, nonce, 'CAPTURE_DEVICE_K_BARE', 1_730_000_000_000]))).toBe('23514');

    const sealed = await store.capture.seal('CAM-01', 'x');
    expect(sealed.ciphertext.byteLength).toBe(80);
    const inserted = await runtime.query(INSERT_CREDENTIAL, ['CAM-01', 'operator', Buffer.from(sealed.ciphertext), Buffer.from(sealed.nonce), sealed.keyRef, 1_730_000_000_000]);
    expect(inserted.rowCount).toBe(1);
    const row = (await owner.query('SELECT encryption, secret_ciphertext, nonce, key_ref FROM public.capture_device_credentials WHERE device_id = $1', ['CAM-01'])).rows[0] as { encryption: string; secret_ciphertext: Buffer; nonce: Buffer; key_ref: string };
    expect([row.encryption, row.secret_ciphertext.byteLength, row.nonce.byteLength]).toEqual(['AES-256-GCM', 80, 12]);
    expect(store.capture.open('CAM-01', { keyRef: row.key_ref, ciphertext: new Uint8Array(row.secret_ciphertext), nonce: new Uint8Array(row.nonce) })).toBe('x');
    console.info(`[row84] M7-CONN-CRED-1 sealer part (PostgreSQL) | bare 17 bytes -> 23514 | framed one-character secret: ciphertextBytes=${row.secret_ciphertext.byteLength} stored=1 opened=true`);
  });

  it('the runtime role still cannot select the credential table: 42501, for the column and for the row', async () => {
    // Row 129a (0010): `count(*)` left this list - with SELECT on `device_id` the role may count the
    // rows (which cameras have a credential is the `credentialSet` fact). Every column that carries
    // the credential is listed instead.
    for (const text of ['SELECT secret_ciphertext FROM public.capture_device_credentials', 'SELECT key_ref FROM public.capture_device_credentials', 'SELECT * FROM public.capture_device_credentials', 'SELECT username FROM public.capture_device_credentials', 'SELECT nonce FROM public.capture_device_credentials', 'SELECT encryption, rotated_at FROM public.capture_device_credentials']) {
      expect(await sqlstate(booted.app.db.pool.query(text)), text).toBe('42501');
    }
    expect(await sqlstate(booted.app.db.pool.query('SELECT count(*) FROM public.capture_device_credentials'))).toBe('answered');
    // Positive control: the owner reads it, so the refusal above is the privilege and not an empty table.
    expect((await owner.query('SELECT count(*)::int AS rows FROM public.capture_device_credentials')).rows[0]).toEqual({ rows: 1 });
  });

  it('a credential of another camera does not open under this one, and a rotated credential needs its new key', async () => {
    const sealed = await store.capture.seal('CAM-02', CAMERA_CANARY);
    expect(() => store.capture.open('CAM-01', sealed)).toThrow(expect.objectContaining({ code: 'CREDENTIAL_OPEN_FAILED' }));
    const rotated = await store.capture.seal('CAM-02', CAMERA_CANARY);
    expect(rotated.keyRef).not.toBe(sealed.keyRef);
    await booted.app.db.pool.query(INSERT_CREDENTIAL, ['CAM-02', 'operator', Buffer.from(sealed.ciphertext), Buffer.from(sealed.nonce), sealed.keyRef, 1_730_000_000_000]);
    // F-84-1, CLOSED BY ROW 129a (migration `0010_credential_replace_privileges.sql`, schema version
    // 4 / dbc-5, erratum PE-129a-01): the runtime role now holds SELECT on `device_id` and on no
    // other column, so a statement that reads only the key replaces a stored credential. Measured
    // by row 129a, and held here: the UPDATE with a WHERE on `device_id` answers; the two upserts
    // whose SET list reads `EXCLUDED.<column>` are STILL refused 42501, because PostgreSQL asks for
    // SELECT on the target column behind each EXCLUDED reference and those columns are the secret.
    // The store of operation 89 therefore sends bind parameters in SET (`REPLACE_CREDENTIAL`).
    const values = ['CAM-02', 'operator', Buffer.from(rotated.ciphertext), Buffer.from(rotated.nonce), rotated.keyRef, 1_730_000_100_000];
    const refusals = [
      await sqlstate(booted.app.db.pool.query('UPDATE public.capture_device_credentials SET rotated_at = $2 WHERE device_id = $1', ['CAM-02', 1_730_000_050_000])),
      await sqlstate(booted.app.db.pool.query(`${INSERT_CREDENTIAL} ON CONFLICT (device_id) DO UPDATE SET ${UPSERT_SET}`, values)),
      await sqlstate(booted.app.db.pool.query(`${INSERT_CREDENTIAL} ON CONFLICT ON CONSTRAINT capture_device_credentials_pkey DO UPDATE SET ${UPSERT_SET}`, values)),
    ];
    console.info(`[row84] F-84-1 replacing a stored camera credential as dems_app | update-where=${refusals[0]} upsert-excluded-by-column=${refusals[1]} upsert-excluded-by-constraint=${refusals[2]}`);
    expect(refusals).toEqual(['answered', '42501', '42501']);
    // THE REPLACE CASE (row 129a): the second write for the same camera, as the RUNTIME role, in one
    // statement. It replaces the first envelope; one row for the camera; the secret stays unreadable.
    expect((await owner.query('SELECT key_ref FROM public.capture_device_credentials WHERE device_id = $1', ['CAM-02'])).rows).toEqual([{ key_ref: sealed.keyRef }]);
    const REPLACE_CREDENTIAL = `${INSERT_CREDENTIAL} ON CONFLICT (device_id) DO UPDATE SET username = $2, secret_ciphertext = $3, nonce = $4, key_ref = $5, rotated_at = $6`;
    const updated = await booted.app.db.pool.query(REPLACE_CREDENTIAL, values);
    expect(updated.rowCount).toBe(1);
    expect((await owner.query('SELECT count(*)::int AS rows FROM public.capture_device_credentials WHERE device_id = $1', ['CAM-02'])).rows).toEqual([{ rows: 1 }]);
    for (const text of ['SELECT secret_ciphertext FROM public.capture_device_credentials', 'SELECT key_ref FROM public.capture_device_credentials WHERE device_id = \'CAM-02\'', `${REPLACE_CREDENTIAL} RETURNING secret_ciphertext`]) {
      expect(await sqlstate(booted.app.db.pool.query(text, text.includes('$1') ? values : [])), text).toBe('42501');
    }
    expect((await owner.query('SELECT key_ref, rotated_at::text AS rotated_at FROM public.capture_device_credentials WHERE device_id = $1', ['CAM-02'])).rows[0]).toEqual({ key_ref: rotated.keyRef, rotated_at: '1730000100000' });
    const stored = (await owner.query<{ key_ref: string }>('SELECT key_ref FROM public.capture_device_credentials')).rows.map((row) => row.key_ref);
    // THE ROTATION HOOK: the key of the replaced envelope is destroyed, the stored ones stay.
    expect(store.credentialKeys.retainOnly('CAPTURE_DEVICE', stored)).toEqual([sealed.keyRef]);
    expect(store.capture.open('CAM-02', rotated)).toBe(CAMERA_CANARY);
  });
});

describe('secrecy: both canaries, searched in a dump of audit_log and events and in the log', () => {
  it('0 hits everywhere; the same search finds a value that IS stored (negative control)', async () => {
    await booted.app.pipeline.drain();
    const dump = async (table: string): Promise<string> => (await owner.query<{ text: string }>(`SELECT t::text AS text FROM public.${table} t`)).rows.map((row) => row.text).join('\n');
    const audit = await dump('audit_log');
    const events = await dump('events');
    const log = booted.log.text();
    const tables = `${await dump('stt_config')}\n${await dump('capture_device_credentials')}`;
    const hits = (haystack: string, needle: string): number => haystack.split(needle).length - 1;
    const found = [STT_CANARY, CAMERA_CANARY].map((needle) => [hits(audit, needle), hits(events, needle), hits(log, needle), hits(tables, needle)]);
    console.info(`[row84] canary sweep (PostgreSQL) | audit_log=${audit.length} bytes events=${events.length} bytes log=${log.length} bytes | stt: ${found[0]?.join('/')} camera: ${found[1]?.join('/')} (audit/events/log/tables) | keyRefs in audit=${hits(audit, '_K_')} in log=${hits(log, 'STT_API_KEY_K_') + hits(log, 'CAPTURE_DEVICE_K_')}`);
    expect(found).toEqual([[0, 0, 0, 0], [0, 0, 0, 0]]);
    expect(hits(audit, 'STT_CONFIG_CHANGED')).toBeGreaterThanOrEqual(2);
    expect(hits(audit, 'STT_API_KEY_K_') + hits(audit, 'CAPTURE_DEVICE_K_') + hits(log, 'STT_API_KEY_K_') + hits(log, 'CAPTURE_DEVICE_K_')).toBe(0);
    // Negative control: the dump of the credential tables does hold the key references.
    expect(hits(tables, 'STT_API_KEY_K_')).toBe(1);
    expect(hits(tables, 'CAPTURE_DEVICE_K_')).toBe(2);
  });
});
