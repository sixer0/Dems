// THE SIGNED DOWNLOAD of a finished export (fix pass F-M8; review finding R93-05, controller ruling
// D178): operation 87's optional `download` member and the registry-external `GET /exports/:token`.
//
// The real app factory, in process, without a database: the REAL stages 2, 3, 5 and 6 (the guard's
// fixed rule for the download route stands in front of it); stage 4 is a stand-in that gives the
// request the principal a test names; the engine is a stub that keeps what the export door was
// told; the export jobs are a double; the archive is a real file in a throw-away package folder;
// the MAC is HMAC-SHA-256 under a test key (the product key door is exercised by the database test).
import { createHmac } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateCoreApiResponse, type EvidenceExportJobBody } from '@dems/shared/api';
import { ROLE_PERMISSIONS, createManualClock, type OperatorRole } from '@dems/shared/sim';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import type { Pool } from 'pg';
import { afterEach, describe, expect, it } from 'vitest';
import { captureLog, unitTestConfig, type CapturedLog } from '../../../../test/support/config';
import { buildApp } from '../../../app';
import type { EngineHost } from '../../../engine';
import { EXPORT_DOWNLOAD_TTL_MS, evidenceExport, replaceExportServicePartsForTest } from '../../../evidence-export';
import type { Principal } from '../../../plugins/authenticate';
import { permissionGuard } from '../../../plugins/permission-guard';
import { EXPORT_DOWNLOAD_ROUTE_URL } from '../index';

const ID = 'EV-20261009-0001';
const SESSION_ID = 'SES-20261009-0001';
const NOW = 1_791_500_000_000;
const ARCHIVE = Buffer.from(`PK\u0003\u0004 a stand-in archive ${'x'.repeat(4000)}`, 'latin1');
const REQUEST_ROW = { id: 'AUD-000101', seq: 101, at: NOW - 5_000, type: 'EVIDENCE_EXPORTED', actorId: 'OPR-002', evidenceId: ID, details: { exportId: 'EXP-000032', destination: 'Case file transfer', reason: 'Prosecutor request' } };
const REAL_ITEM = { id: ID, sessionId: SESSION_ID, investigatorId: 'OPR-001', integritySource: 'REAL', manifestVersion: 2, manifestHash: 'a'.repeat(64), signature: { value: 'b'.repeat(128), algorithm: 'Ed25519', simulated: false }, custody: [] };
const COMPLETE: EvidenceExportJobBody = { jobId: 'EXPJ-000032', evidenceId: ID, kind: 'PACKAGE', status: 'COMPLETE', progressPct: 100, etaMs: 0, manifestHash: 'c'.repeat(64), signature: 'd'.repeat(128), derived: false, createdAt: NOW - 5_000, completedAt: NOW - 1_000 };

const dirs: string[] = [];
const apps: FastifyInstance[] = [];
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const operator = (role: OperatorRole, sessionId = 'session-a', operatorId = role === 'SUPERVISOR' ? 'OPR-002' : 'OPR-001'): Principal => ({ kind: 'OPERATOR', operatorId, sessionId, deviceId: null, role, permissions: ROLE_PERMISSIONS[role] });

interface Bed {
  readonly app: FastifyInstance;
  readonly log: CapturedLog;
  readonly clock: ReturnType<typeof createManualClock>;
  readonly packageDir: string;
  /** What the export door of the engine was told, in order. */
  readonly notes: Array<Record<string, unknown>>;
  readonly appended: Array<Record<string, unknown>>;
  job: EvidenceExportJobBody | null;
  item: Record<string, unknown>;
  macKey: string | null;
  actAs(principal: Principal): void;
  poll(): Promise<LightMyRequestResponse>;
  get(path: string, headers?: Record<string, string>): Promise<LightMyRequestResponse>;
  /** A fresh download path for the principal in charge. */
  path(): Promise<string>;
}

async function bed(): Promise<Bed> {
  const failure = Object.assign(new Error('connect refused'), { code: 'ECONNREFUSED' });
  const pool = { connect: async () => Promise.reject(failure), query: async () => Promise.reject(failure), on: () => pool, end: async () => {} };
  const log = captureLog();
  const app = buildApp({ config: unitTestConfig({ logLevel: 'info' }), createPool: () => pool as unknown as Pool, logStream: log.stream });
  apps.push(app);
  const packageDir = mkdtempSync(join(tmpdir(), 'dems-fm8-download-'));
  dirs.push(packageDir);
  mkdirSync(join(packageDir, 'export'), { mode: 0o700 });
  writeFileSync(join(packageDir, 'export', 'EXP-000032.zip'), ARCHIVE, { mode: 0o600 });

  let current: Principal = { kind: 'ANONYMOUS', retiredDeviceId: null };
  app.stages.replace('authenticate', (request) => {
    request.principal = current;
  });
  await app.ready();
  app.readiness.set('database', true);
  app.readiness.set('engine', true);
  const clock = createManualClock(NOW);
  app.seams.replace('clock', { now: () => clock.now() });

  const notes: Bed['notes'] = [];
  const appended: Bed['appended'] = [];
  const self: Bed = {
    app,
    log,
    clock,
    packageDir,
    notes,
    appended,
    job: COMPLETE,
    item: REAL_ITEM,
    macKey: 'test key',
    actAs: (principal) => void (current = principal),
    poll: () => app.inject({ method: 'GET', url: '/api/v1/evidence/exports/EXPJ-000032' }),
    get: (path, headers = {}) => app.inject({ method: 'GET', url: path, headers }),
    async path() {
      const body = (await self.poll()).json() as { download?: { path: string } };
      if (body.download === undefined) throw new Error('the job answer carries no download member');
      return body.download.path;
    },
  };
  app.seams.replace('engine', {
    epoch: 7,
    revision: 42,
    running: true,
    state: () => ({ audit: { rows: [REQUEST_ROW] }, evidence: [self.item] }),
    completeEvidenceExport: async () => ({ value: true, epoch: 7, revision: 43 }),
    noteEvidenceExportDownload: async (note: Record<string, unknown>) => {
      notes.push(note);
      return { value: true, epoch: 7, revision: 43 };
    },
  } as unknown as EngineHost);
  app.seams.replace('pipeline', {
    run: async (label: string, work: (unit: unknown) => unknown) => work({ label, audit: { append: async (entry: Record<string, unknown>) => void appended.push({ ...entry, unit: label }) } }),
  } as unknown as FastifyInstance['pipeline']);
  evidenceExport(app).provide({ inProgress: () => false, begin: () => null, job: async (jobId) => (jobId === 'EXPJ-000032' ? self.job : null), idle: async () => undefined });
  replaceExportServicePartsForTest(app, {
    mac: () => (self.macKey === null ? null : (message) => createHmac('sha256', self.macKey as string).update(message).digest()),
    packageDirOf: () => packageDir,
  });
  return self;
}

const outcomeOf = (response: LightMyRequestResponse): [number, string | undefined, unknown] => {
  const error = (response.json() as { error?: { code?: string; details?: Record<string, unknown> } }).error;
  return [response.statusCode, error?.code, error?.details?.['reason']];
};

describe('operation 87: the download member of a COMPLETE job', () => {
  it('a COMPLETE job of a sealed package names a short-lived signed path for the caller; the answer fits the contract; a job that is not COMPLETE names none', async () => {
    const test = await bed();
    test.actAs(operator('SUPERVISOR'));
    const response = await test.poll();
    expect(response.statusCode).toBe(200);
    const body = response.json() as EvidenceExportJobBody & { download?: { path: string; expiresAt: number } };
    expect(validateCoreApiResponse('getEvidenceExportJob', 200, body)).toEqual({ ok: true });
    expect(body.download?.path).toMatch(/^\/exports\/exs_[A-Za-z0-9_-]{60,96}$/);
    expect(body.download?.expiresAt).toBe(NOW + EXPORT_DOWNLOAD_TTL_MS);
    expect(EXPORT_DOWNLOAD_TTL_MS).toBe(60_000);
    // The export's own manifest hash and signature - what the jobs hold, not the seal's.
    expect([body.manifestHash, body.signature]).toEqual(['c'.repeat(64), 'd'.repeat(128)]);
    // Two polls are two paths.
    expect((await test.path()) === body.download?.path).toBe(false);

    for (const status of ['QUEUED', 'RUNNING', 'FAILED'] as const) {
      test.job = { ...COMPLETE, status, ...(status === 'FAILED' ? { failureReason: 'EXPORT_FAILED' } : {}) };
      expect((await test.poll()).json()).not.toHaveProperty('download');
    }
    // Without a signing key store the job is answered without the member.
    test.job = COMPLETE;
    test.macKey = null;
    expect((await test.poll()).json()).not.toHaveProperty('download');
  });
});

describe('GET /exports/:token', () => {
  it('is registered outside the registry with THE RULE OF OPERATION 87: 401 for nobody, refused by the guard without EVIDENCE_EXPORT before the handler', async () => {
    const test = await bed();
    expect(EXPORT_DOWNLOAD_ROUTE_URL).toBe('/exports/:token');
    const rule = permissionGuard(test.app).registeredRules().find((entry) => entry.operationId === 'evidenceExportDownload');
    expect([rule?.method, rule?.url, rule?.permissions]).toEqual(['GET', '/exports/:token', ['EVIDENCE_EXPORT']]);
    test.actAs(operator('SUPERVISOR'));
    const path = await test.path();
    test.actAs({ kind: 'ANONYMOUS', retiredDeviceId: null });
    expect((await test.get(path)).statusCode).toBe(401);
    test.actAs(operator('INVESTIGATOR'));
    // Without a database the guard's denial row cannot be written (503 here, 403 against PostgreSQL).
    expect((await test.get(path)).statusCode).toBeGreaterThanOrEqual(400);
    expect(test.notes).toEqual([]);
  });

  it('serves the finished archive as an attachment, byte for byte, never cached, under a fixed-pattern name; ONE record is written before the bytes', async () => {
    const test = await bed();
    test.actAs(operator('SUPERVISOR'));
    const path = await test.path();
    const response = await test.get(path);
    expect(response.statusCode).toBe(200);
    expect(response.rawPayload.equals(ARCHIVE)).toBe(true);
    expect(response.headers['content-type']).toBe('application/zip');
    expect(response.headers['content-length']).toBe(String(ARCHIVE.byteLength));
    expect(response.headers['content-disposition']).toBe('attachment; filename="DEMS-export-EXP-000032.zip"');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(test.notes).toEqual([{ evidenceId: ID, jobId: 'EXPJ-000032', operatorId: 'OPR-002', deviceId: null, bytes: ARCHIVE.byteLength }]);
    // Range is not answered: the whole archive, 200.
    const ranged = await test.get(path, { range: 'bytes=0-9' });
    expect([ranged.statusCode, ranged.rawPayload.byteLength]).toEqual([200, ARCHIVE.byteLength]);
    expect(test.notes).toHaveLength(2);
  });

  it('NEGATIVE CONTROLS of the binding: another operator, another sign-in session, an altered token, a media token and another key are ONE audited refusal; an expired token is refused without a row', async () => {
    const test = await bed();
    test.actAs(operator('SUPERVISOR'));
    const path = await test.path();
    const flipped = `${path.slice(0, -1)}${path.endsWith('A') ? 'B' : 'A'}`;

    test.actAs(operator('SUPERVISOR', 'session-a', 'OPR-004'));
    expect(outcomeOf(await test.get(path))).toEqual([403, 'NOT_PERMITTED', 'EXPORT_DOWNLOAD_INVALID']);
    test.actAs(operator('SUPERVISOR', 'session-b'));
    expect(outcomeOf(await test.get(path))).toEqual([403, 'NOT_PERMITTED', 'EXPORT_DOWNLOAD_INVALID']);
    test.actAs(operator('SUPERVISOR'));
    expect(outcomeOf(await test.get(flipped))).toEqual([403, 'NOT_PERMITTED', 'EXPORT_DOWNLOAD_INVALID']);
    expect(outcomeOf(await test.get(path.replace('exs_', 'mts_')))).toEqual([403, 'NOT_PERMITTED', 'EXPORT_DOWNLOAD_INVALID']);
    test.macKey = 'another key';
    expect(outcomeOf(await test.get(path))).toEqual([403, 'NOT_PERMITTED', 'EXPORT_DOWNLOAD_INVALID']);
    test.macKey = 'test key';
    expect(test.appended.map((entry) => [entry['type'], (entry['details'] as Record<string, unknown>)['reason']])).toEqual(Array.from({ length: 5 }, () => ['ACCESS_DENIED', 'EXPORT_DOWNLOAD_INVALID']));
    // A refusal of an unverified token names no evidence item: the claim of a token that did not verify is not a fact.
    expect(test.appended.every((entry) => entry['evidenceId'] === undefined)).toBe(true);

    // The last instant before the expiry passes; the expiry itself does not, and writes no row.
    test.clock.advance(EXPORT_DOWNLOAD_TTL_MS - 1);
    expect((await test.get(path)).statusCode).toBe(200);
    test.clock.advance(1);
    expect(outcomeOf(await test.get(path))).toEqual([403, 'NOT_PERMITTED', 'EXPORT_DOWNLOAD_EXPIRED']);
    expect(test.appended).toHaveLength(5);
    expect(test.notes).toHaveLength(1);
    // Without the key store: 503, nothing served.
    test.macKey = null;
    expect((await test.get(path)).statusCode).toBe(503);
  });

  it('the REAL-evidence case scope holds at the route: a holder of EVIDENCE_EXPORT outside the case is refused, audited; the holder of the case is served', async () => {
    const test = await bed();
    const outsider: Principal = { kind: 'OPERATOR', operatorId: 'OPR-009', sessionId: 'session-c', deviceId: null, role: 'INVESTIGATOR', permissions: [...ROLE_PERMISSIONS.INVESTIGATOR, 'EVIDENCE_EXPORT'] };
    // Its own token (issued while the item was not yet REAL evidence to it - the scope is asked again at the route).
    test.item = { ...REAL_ITEM, integritySource: 'DEMO_PACKAGE', developmentSources: true };
    test.actAs(outsider);
    const path = await test.path();
    test.item = REAL_ITEM;
    expect(outcomeOf(await test.get(path))).toEqual([403, 'NOT_PERMITTED', 'EVIDENCE_CASE_SCOPE']);
    expect(test.appended.map((entry) => [entry['type'], entry['actorId'], entry['evidenceId']])).toEqual([['ACCESS_DENIED', 'OPR-009', ID]]);
    expect(test.notes).toEqual([]);
    // And operation 87 names no path to a caller outside the case.
    expect(outcomeOf(await test.poll())).toEqual([403, 'NOT_PERMITTED', 'EVIDENCE_CASE_SCOPE']);

    const holder: Principal = { ...outsider, operatorId: 'OPR-001', sessionId: 'session-d' };
    test.actAs(holder);
    expect((await test.get(await test.path())).statusCode).toBe(200);
  });

  it('only a finished export is handed out: 404 for a job that is not COMPLETE, a missing archive, a link in its place, an item without a package here', async () => {
    const test = await bed();
    test.actAs(operator('SUPERVISOR'));
    const path = await test.path();
    test.job = { ...COMPLETE, status: 'RUNNING' };
    expect(outcomeOf(await test.get(path)).slice(0, 2)).toEqual([404, 'NOT_FOUND']);
    test.job = { ...COMPLETE, evidenceId: 'EV-20261009-0002' };
    expect((await test.get(path)).statusCode).toBe(404);
    test.job = COMPLETE;
    test.item = { ...REAL_ITEM, integritySource: 'DEMO_PACKAGE', manifestVersion: 1 };
    expect((await test.get(path)).statusCode).toBe(404);
    test.item = REAL_ITEM;

    const archive = join(test.packageDir, 'export', 'EXP-000032.zip');
    rmSync(archive);
    expect((await test.get(path)).statusCode).toBe(404);
    const elsewhere = join(test.packageDir, 'secret.txt');
    writeFileSync(elsewhere, 'not an export');
    symlinkSync(elsewhere, archive);
    expect((await test.get(path)).statusCode).toBe(404);
    expect(test.notes).toEqual([]);
  });

  it('CANARY: the token is in no log line, no audit entry and no record of the engine - served, refused or expired', async () => {
    const test = await bed();
    test.actAs(operator('SUPERVISOR'));
    const path = await test.path();
    const token = path.slice('/exports/'.length);
    await test.get(path);
    test.actAs(operator('SUPERVISOR', 'session-b'));
    await test.get(path);
    test.actAs(operator('SUPERVISOR'));
    test.clock.advance(EXPORT_DOWNLOAD_TTL_MS);
    await test.get(path);
    const written = `${test.log.text()}\n${JSON.stringify(test.appended)}\n${JSON.stringify(test.notes)}`;
    // CONTROL of the canary: the log holds the request lines of these calls, by the route pattern.
    expect(written).toContain('/exports/:token');
    expect(written).not.toContain(token);
    expect(written).not.toContain(token.slice(4, 24));
    expect(written).not.toContain('exs_');
  });
});
