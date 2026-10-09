// The STT configuration module against PostgreSQL (blueprint row 113; requirement R-8; C3 §2.5;
// dbc-3 §B.13 and migration 0007): what the unit tests of this folder state about a stand-in, said
// by the real database.
//
// The real app factory on a clone of the seed, as `dems_app`, with EVERY stage as the server has
// it, booted as the entry point boots it; the operators sign in through the real routes. The clone
// is a throw-away database of this run (`useTestDatabase`): no live database is touched.
//
//   - the statements run under the runtime role's column grants: the read names no credential
//     column, the lock works on a column-level UPDATE grant, the update is compare-and-set;
//   - the runtime role itself cannot read back what operation 91 wrote (42501);
//   - the stored audit row is STT_CONFIG_CHANGED, category DEVICE, with the five keys;
//   - a planted credential is in NO stored audit row and NO stored event (a dump of both tables,
//     searched as text), with a negative control that the search does find a stored value;
//   - a change made while a session is open answers `appliesFrom: NEXT_SESSION`.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { CORE_API_EXAMPLES, validateCoreApiResponse, type SttConfig, type SttConfigUpdateResult } from '@dems/shared/api';
import type { OperatorRole } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { readHead, readTrail, verifyTrail } from '../../../../test/support/core';
import { webOperator } from '../../../../test/support/guard';
import type { Headers } from '../../../../test/support/identity';
import { throttleControl } from '../../../plugins/throttle';
import { identityControl } from '../../identity';
import { INVESTIGATOR, SUPERVISOR, TECHNICIAN, WEB_ORIGIN, bootedApp, type BootedApp } from '../../storage/__tests__/support';
import { sttConfigControl, type SealedSttCredential } from '../index';

const db = useTestDatabase({ template: 'seed', slug: 'row113' });
let booted: BootedApp;
let owner: Pool;
let sessions: Record<OperatorRole, Headers>;

const PATH = '/api/v1/transcription/config';
/** Planted in requests only. Built from parts, so that no other file of the repository holds them. */
const SECRET = ['stt', 'PLANTED', 'k3y', 'Hd5Kp9Vx3Nq7'].join('-');
const REFERENCE = ['omlx-settings', ['auth', 'planted_ref_Hd5Kp9'].join('.')].join(':');

const KEY = randomBytes(32);
const sealed: SealedSttCredential[] = [];
const open = (ciphertext: Buffer, nonce: Buffer): string => {
  const decipher = createDecipheriv('aes-256-gcm', KEY, nonce);
  decipher.setAuthTag(ciphertext.subarray(ciphertext.byteLength - 16));
  return Buffer.concat([decipher.update(ciphertext.subarray(0, ciphertext.byteLength - 16)), decipher.final()]).toString('utf8');
};

const get = (session: Headers): Promise<LightMyRequestResponse> => booted.app.inject({ method: 'GET', url: PATH, headers: session });
const post = (session: Headers, payload: unknown, url = PATH): Promise<LightMyRequestResponse> =>
  booted.app.inject({ method: 'POST', url, headers: { ...session, origin: WEB_ORIGIN }, payload: payload as object });
const outcome = (response: LightMyRequestResponse): [number, string | null, string | null] => {
  const error = (response.json() as { error?: { code?: string; details?: { reason?: string } } }).error;
  return [response.statusCode, error?.code ?? null, error?.details?.reason ?? null];
};
const revisionNow = async (): Promise<number> => ((await get(sessions.SUPERVISOR)).json() as SttConfig).revision;
/** The whole stored row, the credential columns included: only the owner can read it. */
const storedRow = async (): Promise<Record<string, unknown>> =>
  (await owner.query('SELECT enabled, backend, endpoint, model, language, diarization, credential_kind, credential_ref, secret_ciphertext, nonce, revision::int AS revision, updated_by FROM public.stt_config')).rows[0] as Record<string, unknown>;

beforeAll(async () => {
  owner = db.ownerPool();
  booted = await bootedApp(db);
  sttConfigControl(booted.app).provideCredentialSealer({
    async seal(plaintext) {
      const nonce = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', KEY, nonce);
      const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      const envelope = { keyRef: 'ROW113_TEST_KEY', ciphertext: new Uint8Array(Buffer.concat([body, cipher.getAuthTag()])), nonce: new Uint8Array(nonce) };
      sealed.push(envelope);
      return envelope;
    },
  });
  sessions = {
    INVESTIGATOR: await webOperator(booted, INVESTIGATOR.username),
    SUPERVISOR: await webOperator(booted, SUPERVISOR.username),
    TECHNICIAN: await webOperator(booted, TECHNICIAN.username),
  };
  await booted.app.pipeline.drain();
});

beforeEach(() => {
  throttleControl(booted.app).reset();
  identityControl(booted.app).lockout.reset();
});

describe('operation 90 on the seeded row, under the column grants of migration 0007', () => {
  it('every role reads the seeded configuration: enabled, cpu-local, no credential (Q-STT-CFG item 11)', async () => {
    for (const role of ['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN'] as const) {
      const response = await get(sessions[role]);
      expect(response.statusCode, role).toBe(200);
      expect(validateCoreApiResponse('getSttConfig', 200, response.json()), role).toEqual({ ok: true });
      expect(response.json()).toMatchObject({ enabled: true, backend: 'cpu-local', model: 'ggml-large-v3-turbo', language: 'id', diarization: true, credentialSet: false, revision: 1, pendingForNextSession: false });
    }
  });

  it('the runtime role cannot select a credential column, nor the whole row: 42501', async () => {
    const runtime = booted.app.db.pool;
    for (const text of ['SELECT credential_ref FROM public.stt_config', 'SELECT secret_ciphertext FROM public.stt_config', 'SELECT nonce FROM public.stt_config', 'SELECT * FROM public.stt_config']) {
      const refusal = await runtime.query(text).then(
        () => 'answered',
        (error: { code?: string }) => error.code,
      );
      expect(refusal, text).toBe('42501');
    }
  });
});

describe('operation 91 against the table', () => {
  it('INVESTIGATOR is refused 403 with one ACCESS_DENIED row; the row of the table does not move', async () => {
    const before = await storedRow();
    const trail = (await readTrail(owner)).length;
    const response = await post(sessions.INVESTIGATOR, { revision: 1, enabled: false, credential: { kind: 'SECRET', value: SECRET } });
    expect(outcome(response)).toEqual([403, 'NOT_PERMITTED', null]);
    expect(outcome(await post(sessions.INVESTIGATOR, undefined, `${PATH}/test`))).toEqual([403, 'NOT_PERMITTED', null]);
    await booted.app.pipeline.drain();
    expect(await storedRow()).toEqual(before);
    const written = (await readTrail(owner)).slice(trail);
    expect(written.map((row) => [row.type, row.details])).toEqual([
      ['ACCESS_DENIED', { operationId: 'updateSttConfig', permission: 'CAPTURE_CONFIG', role: 'INVESTIGATOR' }],
      ['ACCESS_DENIED', { operationId: 'testSttConnection', permission: 'CAPTURE_CONFIG', role: 'INVESTIGATOR' }],
    ]);
  });

  it('a non-loopback endpoint: 422 INVALID_INPUT (ENDPOINT_NOT_LOOPBACK); nothing stored, no row', async () => {
    const before = await storedRow();
    const trail = (await readTrail(owner)).length;
    const response = await post(sessions.TECHNICIAN, { revision: await revisionNow(), backend: 'omlx-server', endpoint: 'http://192.168.1.20:8000' });
    expect(outcome(response)).toEqual([422, 'INVALID_INPUT', 'ENDPOINT_NOT_LOOPBACK']);
    expect(await storedRow()).toEqual(before);
    expect((await readTrail(owner)).length).toBe(trail);
  });

  it('TECHNICIAN stores a change with a REFERENCE: the row, the answer and ONE STT_CONFIG_CHANGED row of category DEVICE; the chain verifies', async () => {
    const trail = (await readTrail(owner)).length;
    const revision = await revisionNow();
    const response = await post(sessions.TECHNICIAN, { revision, backend: 'omlx-server', endpoint: 'http://127.0.0.1:9000', model: 'whisper-large-v3-turbo', credential: { kind: 'REFERENCE', ref: REFERENCE } });
    expect(response.statusCode).toBe(200);
    const body = response.json() as SttConfigUpdateResult;
    expect(validateCoreApiResponse('updateSttConfig', 200, body)).toEqual({ ok: true });
    expect(body).toMatchObject({ backend: 'omlx-server', endpoint: 'http://127.0.0.1:9000', credentialSet: true, credentialKind: 'REFERENCE', revision: revision + 1, updatedBy: TECHNICIAN.id, appliesFrom: 'NOW', pendingForNextSession: false });
    expect(response.body).not.toContain(REFERENCE);
    expect(await storedRow()).toMatchObject({ backend: 'omlx-server', endpoint: 'http://127.0.0.1:9000', credential_kind: 'REFERENCE', credential_ref: REFERENCE, secret_ciphertext: null, nonce: null, revision: revision + 1, updated_by: TECHNICIAN.id });
    const rows = (await readTrail(owner)).slice(trail);
    expect(rows.map((row) => [row.type, row.category, row.actorId, row.details])).toEqual([
      ['STT_CONFIG_CHANGED', 'DEVICE', TECHNICIAN.id, { changedFields: 'backend,endpoint,model,credential', enabled: true, backend: 'omlx-server', credentialChanged: true, revision: revision + 1 }],
    ]);
    expect(verifyTrail(await readTrail(owner), await readHead(owner))).toMatchObject({ ok: true });
  });

  it('SUPERVISOR stores a SECRET: the table holds AES-256-GCM ciphertext the key holder opens; a stale revision is refused 409', async () => {
    const revision = await revisionNow();
    const response = await post(sessions.SUPERVISOR, { revision, credential: { kind: 'SECRET', value: SECRET } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ credentialSet: true, credentialKind: 'ENCRYPTED', revision: revision + 1 });
    const row = await storedRow();
    expect(row).toMatchObject({ credential_kind: 'ENCRYPTED', credential_ref: 'ROW113_TEST_KEY' });
    const ciphertext = row['secret_ciphertext'] as Buffer;
    const nonce = row['nonce'] as Buffer;
    expect([nonce.byteLength, ciphertext.byteLength]).toEqual([12, Buffer.byteLength(SECRET) + 16]);
    expect(ciphertext.includes(Buffer.from(SECRET))).toBe(false);
    expect(open(ciphertext, nonce)).toBe(SECRET);
    expect(sealed).toHaveLength(1);
    expect(outcome(await post(sessions.SUPERVISOR, { revision, enabled: false }))).toEqual([409, 'INVALID_STATE', 'REVISION_CONFLICT']);
    // And the runtime role still cannot read back what it just wrote.
    await expect(booted.app.db.pool.query('SELECT secret_ciphertext, nonce FROM public.stt_config')).rejects.toMatchObject({ code: '42501' });
  });
});

describe('next session: a change stored while a session is open', () => {
  it('the write is accepted with appliesFrom NEXT_SESSION, and operation 90 says pendingForNextSession', async () => {
    booted.clock.advance(60_000);
    const created = await post(sessions.SUPERVISOR, CORE_API_EXAMPLES.createSession!.request!.recordingScenario!.value, '/api/v1/session');
    expect([200, 201]).toContain(created.statusCode);
    expect((await owner.query('SELECT count(*)::int AS open FROM public.active_session')).rows[0]).toEqual({ open: 1 });
    expect(((await get(sessions.INVESTIGATOR)).json() as SttConfig).pendingForNextSession).toBe(false);

    booted.clock.advance(5_000);
    const revision = await revisionNow();
    const response = await post(sessions.TECHNICIAN, { revision, enabled: false });
    const body = response.json() as SttConfigUpdateResult;
    console.info(`[row113] M6-STTCFG-API next-session (PostgreSQL) | status=${response.statusCode} appliesFrom=${body.appliesFrom} pendingForNextSession=${body.pendingForNextSession} revision=${body.revision}`);
    expect(response.statusCode).toBe(200);
    expect([body.appliesFrom, body.pendingForNextSession, body.enabled, body.revision]).toEqual(['NEXT_SESSION', true, false, revision + 1]);
    expect(((await get(sessions.INVESTIGATOR)).json() as SttConfig).pendingForNextSession).toBe(true);
    expect((await storedRow())['enabled']).toBe(false);
  });
});

describe('secrecy in the stored trail: a dump of audit_log and events, searched as text', () => {
  it('the planted secret and the planted reference are in no stored audit row and no stored event; the search finds a value that IS stored (negative control)', async () => {
    await booted.app.pipeline.drain();
    const dump = async (table: 'audit_log' | 'events'): Promise<string> => ((await owner.query<{ text: string }>(`SELECT t::text AS text FROM public.${table} t ORDER BY seq`)).rows.map((row) => row.text)).join('\n');
    const audit = await dump('audit_log');
    const events = await dump('events');
    const hits = (haystack: string, needle: string): number => haystack.split(needle).length - 1;
    const sttRows = hits(audit, 'STT_CONFIG_CHANGED');
    console.info(`[row113] M6-STTCFG-API credential grep (PostgreSQL) | audit_log=${audit.length} bytes events=${events.length} bytes sttRows=${sttRows} | secret: audit=${hits(audit, SECRET)} events=${hits(events, SECRET)} | reference: audit=${hits(audit, REFERENCE)} events=${hits(events, REFERENCE)}`);
    expect(sttRows).toBeGreaterThanOrEqual(3);
    expect([hits(audit, SECRET), hits(events, SECRET), hits(audit, REFERENCE), hits(events, REFERENCE)]).toEqual([0, 0, 0, 0]);
    expect([hits(audit, 'planted_ref'), hits(audit, '127.0.0.1:9000'), hits(audit, 'whisper-large')]).toEqual([0, 0, 0]);
    // Negative control: the same search over a dump of the table that DOES hold a stored value finds it.
    const control = ((await owner.query<{ text: string }>('SELECT t::text AS text FROM public.stt_config t')).rows[0]?.text ?? '') + audit;
    const controlHits = hits(control, 'ROW113_TEST_KEY');
    console.info(`[row113] M6-STTCFG-API credential grep negative control (PostgreSQL) | storedKeyRefHits=${controlHits}`);
    expect(controlHits).toBe(1);
  });
});
