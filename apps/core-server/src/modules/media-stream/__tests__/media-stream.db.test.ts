// Media streaming against PostgreSQL (blueprint row 90, follow-up of ruling D140; C3 §2.2 op 88,
// §2.4, §5.2; SEC35-12, SEC35-16; checks M8-EV-SCOPE-1 and the stored rows of EVIDENCE_MEDIA_SERVED).
//
// The real app factory on a clone of the seed, as `dems_app`, with EVERY stage as the server has it
// (the support of the capture-inputs module: the engine booted, real sign-in sessions on the web
// console), the module mounted by `app.ts`, the REAL pipeline and audit writer, and the REAL SQL
// read of the item. What is stored is read as `dems_owner`.
//
// The package is row 85's test builder, every fragment sealed by the product cipher. Its session
// key and the media-session signing key live in a credential store of a THROW-AWAY directory (the
// product functions over it are handed to the unit): the data directory of the test run is not
// written to. The evidence item is a copy of a seeded item's row (and of its session's history
// row) with the four facts of a real sealed package: `integrity_source = REAL`,
// `manifest_version = 2`, the digest of the built manifest, and the investigator who holds the case.
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EPOCH_HEADER_NAME, REVISION_HEADER_NAME, validateCoreApiResponse } from '@dems/shared/api';
import type { AuditRow } from '@dems/shared/sim';
import type { LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { SIGN_OUT, WEB_ORIGIN, signInOnWeb, type Headers } from '../../../../test/support/identity';
import { coreCredentialStore, createFragmentSealer } from '../../../credential-store';
import { coreFragmentOpener } from '../../../evidence-verify';
import { buildPackage, removeScratch, type BuiltPackage } from '../../../evidence-verify/__tests__/support';
import { mediaSessionMacOf, mediaStream, readMediaItem } from '../../../media-stream';
import { noticesApp, type NoticesApp } from '../../capture-inputs/__tests__/support';

const db = useTestDatabase({ template: 'seed' });
vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

const EVIDENCE_ID = 'EV-20261009-0901';
const SESSION_ID = 'SES-20261009-0901';
const SIZE = 129 + 5 * 700 + 17;
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

let server: NoticesApp;
let built: BuiltPackage;
let storeDir = '';
let seededEvidenceId = '';
const cookies: Record<'INVESTIGATOR' | 'SUPERVISOR' | 'TECHNICIAN', Headers> = { INVESTIGATOR: {}, SUPERVISOR: {}, TECHNICIAN: {} };

/** Inserts a copy of `row` into `table`: every column as it was read, JSON columns as JSON text. */
async function insertCopy(owner: Pool, table: string, row: Record<string, unknown>): Promise<void> {
  const columns = Object.keys(row);
  const values = columns.map((column) => {
    const value = row[column];
    return value !== null && typeof value === 'object' ? JSON.stringify(value) : value;
  });
  await owner.query(`INSERT INTO public.${table} (${columns.map((column) => `"${column}"`).join(', ')}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')})`, values);
}

beforeAll(async () => {
  server = await noticesApp(db);
  const { app, owner } = server;

  // A throw-away credential store: the session key of the package and the media-session key.
  storeDir = mkdtempSync(join(tmpdir(), 'dems-row90-db-'));
  const host = { stages: {}, config: { dataDir: storeDir } };
  const opened = coreCredentialStore(host);
  if (opened.status !== 'READY') throw new Error(`the throw-away credential store is ${opened.status}`);
  const key = opened.store.sessionKeys.create(SESSION_ID);
  const sealer = createFragmentSealer(key);
  built = await buildPackage({ evidenceId: EVIDENCE_ID, sessionId: SESSION_ID, sealer: (position, plaintext) => sealer.seal(position, plaintext) });
  opened.store.sessionKeys.release(key);
  mediaStream(app).replaceForTest({
    packageDirOf: (sessionId) => (sessionId === SESSION_ID ? built.dir : null),
    opener: coreFragmentOpener(host),
    mac: () => mediaSessionMacOf(host),
  });

  // The item: a seeded item's row and its session's history row, copied under new IDs.
  const seeded = (await owner.query<Record<string, unknown>>('SELECT * FROM public.evidence_items ORDER BY id LIMIT 1')).rows[0];
  if (seeded === undefined) throw new Error('the seed holds no evidence item');
  seededEvidenceId = String(seeded['id']);
  const history = (await owner.query<Record<string, unknown>>('SELECT * FROM public.session_history WHERE id = $1', [seeded['session_id']])).rows[0];
  if (history !== undefined) await insertCopy(owner, 'session_history', { ...history, id: SESSION_ID });
  await insertCopy(owner, 'evidence_items', {
    ...seeded,
    id: EVIDENCE_ID,
    session_id: SESSION_ID,
    investigator_id: server.operatorId('INVESTIGATOR'),
    integrity_source: 'REAL',
    manifest_version: 2,
    manifest_hash: built.manifest.manifestSha256,
  });

  // Sessions of this file's own: real sign-ins on the web console.
  cookies.INVESTIGATOR = (await signInOnWeb(server.identity, 'budi.santoso')).cookie;
  cookies.SUPERVISOR = (await signInOnWeb(server.identity, 'andi.pratama')).cookie;
  cookies.TECHNICIAN = (await signInOnWeb(server.identity, 'rina.wijaya')).cookie;
  await app.pipeline.drain();
});

afterAll(() => {
  removeScratch();
  if (storeDir !== '') rmSync(storeDir, { recursive: true, force: true });
});

const open = (who: Headers, evidenceId = EVIDENCE_ID, body?: unknown): Promise<LightMyRequestResponse> =>
  server.app.inject({ method: 'POST', url: `/api/v1/evidence/${evidenceId}/media-sessions`, headers: { ...who, origin: WEB_ORIGIN, ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, ...(body === undefined ? {} : { payload: JSON.stringify(body) }) });
const fetch = (who: Headers, url: string, range?: string): Promise<LightMyRequestResponse> =>
  server.app.inject({ method: 'GET', url: new URL(url).pathname, headers: { ...who, ...(range === undefined ? {} : { range }) } });
const errorOf = (response: LightMyRequestResponse): { code: string; details?: Record<string, unknown> } => (response.json() as { error: { code: string; details?: Record<string, unknown> } }).error;
/** The rows the trail gained since `from`, once every unit has committed. */
async function rowsSince(from: number): Promise<AuditRow[]> {
  await server.app.pipeline.drain();
  return server.since(from);
}
const stored = (row: AuditRow | undefined) => (row === undefined ? null : { type: row.type, category: row.category, severity: row.severity, actorId: row.actorId, sessionId: row.sessionId, evidenceId: row.evidenceId, details: row.details });

describe('the SQL read of the item and its case holder', () => {
  it('reads the six columns as `dems_app`: a real sealed item with its session, its digest of record and the investigator who holds the case; null for no item; a seeded item is not real', async () => {
    const pool = server.app.db.pool;
    const reader = { query: (text: string, values: readonly unknown[]) => pool.query(text, [...values]) };
    expect(await readMediaItem(reader, EVIDENCE_ID)).toEqual({ evidenceId: EVIDENCE_ID, sessionId: SESSION_ID, investigatorId: server.operatorId('INVESTIGATOR'), real: true, manifestSha256: built.manifest.manifestSha256 });
    expect(await readMediaItem(reader, 'EV-20261009-0999')).toBeNull();
    expect(await readMediaItem(reader, seededEvidenceId)).toMatchObject({ evidenceId: seededEvidenceId, real: false });
    // Through the route: the seeded item has no stream (a client plays its bundled media), an unknown one is 404.
    const demo = await open(cookies.SUPERVISOR, seededEvidenceId);
    expect([demo.statusCode, errorOf(demo).code, errorOf(demo).details?.['reason']]).toEqual([409, 'MEDIA_NOT_AVAILABLE', 'NOT_A_SEALED_PACKAGE']);
    expect((await open(cookies.SUPERVISOR, 'EV-20261009-0999')).statusCode).toBe(404);
  });
});

describe('EVIDENCE_MEDIA_SERVED as stored', () => {
  it('the issue row is committed before the answer, the range row when the answer has ended - exact keys, the actor, the item and its session, never the token', async () => {
    const before = await server.trailLength();
    const response = await open(cookies.INVESTIGATOR, EVIDENCE_ID, { fileId: 'VIDEO-02' });
    expect(response.statusCode).toBe(201);
    const session = response.json() as { url: string; expiresAt: number; fileId: string };
    expect(validateCoreApiResponse('createEvidenceMediaSession', 201, session)).toEqual({ ok: true });
    // API-7: a 2xx answer of a POST of the registry carries the state position.
    expect(response.headers[EPOCH_HEADER_NAME]).toBeDefined();
    expect(response.headers[REVISION_HEADER_NAME]).toBeDefined();
    // Read WITHOUT waiting for the pipeline: the row was committed before the answer left.
    const issued = await server.since(before);
    expect(issued.map(stored)).toEqual([
      { type: 'EVIDENCE_MEDIA_SERVED', category: 'EVIDENCE', severity: 'INFO', actorId: server.operatorId('INVESTIGATOR'), sessionId: SESSION_ID, evidenceId: EVIDENCE_ID, details: { fileId: 'VIDEO-02', bytesServed: 0, signed: true, expiresAt: session.expiresAt } },
    ]);

    const whole = await fetch(cookies.INVESTIGATOR, session.url);
    expect(whole.statusCode).toBe(200);
    expect(sha256(whole.rawPayload)).toBe(built.manifest.tracks.find((track) => track.trackId === 'VIDEO-02')?.sha256Plain);
    const part = await fetch(cookies.INVESTIGATOR, session.url, 'bytes=829-1528');
    expect([part.statusCode, part.headers['content-range'], part.rawPayload.equals(whole.rawPayload.subarray(829, 1529))]).toEqual([206, `bytes 829-1528/${SIZE}`, true]);
    const served = (await rowsSince(before)).slice(1);
    expect(served.map(stored)).toEqual([
      { type: 'EVIDENCE_MEDIA_SERVED', category: 'EVIDENCE', severity: 'INFO', actorId: server.operatorId('INVESTIGATOR'), sessionId: SESSION_ID, evidenceId: EVIDENCE_ID, details: { fileId: 'VIDEO-02', bytesServed: SIZE, rangeStart: 0, rangeEnd: SIZE - 1, signed: true } },
      { type: 'EVIDENCE_MEDIA_SERVED', category: 'EVIDENCE', severity: 'INFO', actorId: server.operatorId('INVESTIGATOR'), sessionId: SESSION_ID, evidenceId: EVIDENCE_ID, details: { fileId: 'VIDEO-02', bytesServed: 700, rangeStart: 829, rangeEnd: 1528, signed: true } },
    ]);
    // Nothing of the trail or of the log holds the token.
    const token = session.url.split('/').at(-1) ?? '';
    expect(token).toMatch(/^mts_/);
    for (const text of [JSON.stringify(await server.since(0)), server.log.text()]) {
      expect(text).not.toContain(token);
      expect(text).not.toContain('mts_');
    }
  });
});

describe('M8-EV-SCOPE-1 and the session binding, with real sessions', () => {
  it('a technician who does not hold the case is refused 403 with ONE stored ACCESS_DENIED row; the supervisor gets a session', async () => {
    const before = await server.trailLength();
    const refused = await open(cookies.TECHNICIAN);
    expect([refused.statusCode, errorOf(refused).code, errorOf(refused).details]).toEqual([403, 'NOT_PERMITTED', { operationId: 'createEvidenceMediaSession', permission: 'EVIDENCE_VIEW', role: 'TECHNICIAN', reason: 'EVIDENCE_CASE_SCOPE' }]);
    expect((await rowsSince(before)).map(stored)).toEqual([
      { type: 'ACCESS_DENIED', category: 'SECURITY', severity: 'WARNING', actorId: server.operatorId('TECHNICIAN'), sessionId: null, evidenceId: EVIDENCE_ID, details: { operationId: 'createEvidenceMediaSession', permission: 'EVIDENCE_VIEW', role: 'TECHNICIAN', reason: 'EVIDENCE_CASE_SCOPE' } },
    ]);
    expect((await open(cookies.SUPERVISOR)).statusCode).toBe(201);
  });

  it('a token plays only in the sign-in session it was issued to: another operator, and the SAME operator signed in again, are refused with one stored row each', async () => {
    const session = (await open(cookies.INVESTIGATOR)).json() as { url: string };
    expect((await fetch(cookies.INVESTIGATOR, session.url, 'bytes=0-0')).statusCode).toBe(206); // control
    const again = (await signInOnWeb(server.identity, 'budi.santoso')).cookie;
    await server.app.pipeline.drain();
    for (const [who, role] of [[cookies.SUPERVISOR, 'SUPERVISOR'], [again, 'INVESTIGATOR']] as const) {
      const before = await server.trailLength();
      const refused = await fetch(who, session.url, 'bytes=0-0');
      expect([refused.statusCode, errorOf(refused).details]).toEqual([403, { operationId: 'createEvidenceMediaSession', role, reason: 'MEDIA_SESSION_INVALID' }]);
      expect((await rowsSince(before)).map(stored)).toEqual([
        { type: 'ACCESS_DENIED', category: 'SECURITY', severity: 'WARNING', actorId: server.operatorId(role), sessionId: null, evidenceId: null, details: { operationId: 'createEvidenceMediaSession', role, reason: 'MEDIA_SESSION_INVALID' } },
      ]);
    }
    // No credential at all: 401, no row.
    const rows = await server.trailLength();
    expect((await fetch({}, session.url, 'bytes=0-0')).statusCode).toBe(401);
    expect(await server.trailLength()).toBe(rows);
    // Still playable where it belongs.
    expect((await fetch(cookies.INVESTIGATOR, session.url, 'bytes=0-0')).statusCode).toBe(206);
  });
});

// Fix pass F-M8 (review finding R93-08; question 1 of the review, "sign-out while a token is live").
describe('R93-08: sign-out while a media session is live, with a real session', () => {
  it('every NEW media request dies with the session (401, the token unread), and the read an answer in flight makes says the session is closed', async () => {
    const signedIn = await signInOnWeb(server.identity, 'budi.santoso');
    await server.app.pipeline.drain();
    const who = signedIn.cookie;
    const session = (await open(who)).json() as { url: string };
    expect((await fetch(who, session.url, 'bytes=0-0')).statusCode).toBe(206); // control: it plays

    // The open sign-in sessions of this operator before the sign-out: what a stream in flight asks about.
    const openIds = async (): Promise<string[]> =>
      (await server.owner.query<{ id: string }>('SELECT id::text AS id FROM public.auth_sessions WHERE ended_at IS NULL AND operator_id = $1 ORDER BY id', [server.operatorId('INVESTIGATOR')])).rows.map((row) => row.id);
    const before = await openIds();
    const parts = mediaStream(server.app).parts();
    const request = { id: 'r93-08', log: server.app.log } as unknown as Parameters<typeof parts.sessionOpen>[0];
    for (const id of before) expect(await parts.sessionOpen(request, id)).toBe(true);

    const out = await server.app.inject({ method: 'POST', url: SIGN_OUT, headers: { ...who, origin: WEB_ORIGIN }, payload: {} });
    expect(out.statusCode).toBeLessThan(300);
    await server.app.pipeline.drain();

    const rows = await server.trailLength();
    const after = await fetch(who, session.url, 'bytes=0-0');
    expect(after.statusCode).toBe(401);
    // Refused before the token was looked at: no ACCESS_DENIED row of the media route.
    expect(await server.trailLength()).toBe(rows);
    expect((await open(who)).statusCode).toBe(401);
    // What an answer in flight would read now: THE session that signed out is closed, the others stay open.
    const still = await openIds();
    const ended = before.filter((id) => !still.includes(id));
    expect(ended).toHaveLength(1);
    expect(await parts.sessionOpen(request, ended[0] ?? '')).toBe(false);
    for (const id of still) expect(await parts.sessionOpen(request, id)).toBe(true);
    expect(await parts.sessionOpen(request, 'not-a-session')).toBe(false);
  });
});
