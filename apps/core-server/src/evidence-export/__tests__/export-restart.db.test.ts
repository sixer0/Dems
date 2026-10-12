// CLOSING PASS F-X, review finding R93-11 (second half), on a throw-away database and a scratch Core
// data directory: THE ANSWER OF OPERATION 87 DOES NOT DEPEND ON THE IN-MEMORY AUDIT RING.
//
//   first run   the real app in capture operation REAL_DEVELOPMENT (the sealing composition provides
//               the export jobs) on a REAL sealed v2 item: a COMPOSITE request FAILS (licence gate),
//               a PACKAGE request COMPLETES and its archive is downloaded (which writes a DOWNLOAD
//               row: `EVIDENCE_EXPORTED` without an `exportId`). Then MORE audit rows than the ring
//               holds are committed, so both request rows and the failure row are older than the ring.
//   restart     a second app instance on the same database and data directory. PRECONDITION, shown:
//               its ring holds neither request and not the failure row. Then operation 87 answers
//                 (a) the completed export  -> COMPLETE with the export's own hash and signature,
//                                              and the download of it works;
//                 (b) the failed export     -> FAILED with its STORED reason and kind;
//                 (c) CONTROLS              -> an export ID that never existed is 404; the stored
//                                              request of the completed export is its REQUEST row,
//                                              not the newer download row of the same type and item.
//
// WHAT IS REAL: PostgreSQL, the app with every stage, real sign-in sessions, the engine, the
// pipeline and the audit writer, the credential store, the cipher, the signer, the export.
// WHAT IS NOT: the media (random bytes), the seal (the verify-v2 builder, as in `export-e2e`), the
// capture worker (a stand-in that says HELLO and is never asked to record). No local device is
// selected, pre-checked or started. The set-up is the one of `export-e2e.db.test.ts`.
import { mkdirSync, readFileSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { validateCoreApiResponse } from '@dems/shared/api';
import { AUDIT_RING_SIZE, AuditType, Severity, type CompleteSealInput } from '@dems/shared/sim';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../test/helpers/db';
import { captureLog, unitTestConfig } from '../../../test/support/config';
import { engineApp } from '../../../test/support/engine';
import { WEB_ORIGIN, cookieValue, webSignIn } from '../../../test/support/identity';
import { buildApp } from '../../app';
import { realBootFixture } from '../../capture/boot/__tests__/support';
import { captureFenceControl } from '../../capture/fence';
import { coreCredentialStore, createFragmentSealer } from '../../credential-store';
import { sealDoorsOf } from '../../engine/seal-doors';
import { sessionPackageDir } from '../../evidence-verify';
import { buildPackage, removeScratch } from '../../evidence-verify/__tests__/support';
import { SEALING_STEP_ORDER, loadSealingSigner } from '../../sealing';
import { coreExportDirectory, evidenceExport, parseExportManifest, parseExportSignature, replaceExportServicePartsForTest } from '../index';
import { readStoredExportFailure, readStoredExportRequest } from '../stored-trail';

vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

const db = useTestDatabase({ template: 'seed', slug: 'fxexprst' });
const core = realBootFixture('fxexprst');
afterAll(() => {
  removeScratch();
  core.remove();
});

const SESSION_INPUT = { caseNumber: 'LP/2026/1001-0094', subjectType: 'SAKSI', subjectName: 'Test Subject', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' } as const;

async function signedIn(app: FastifyInstance, username: string): Promise<Record<string, string>> {
  const answer = await webSignIn(app, username);
  expect(answer.statusCode).toBe(200);
  const token = cookieValue(answer, app.config.sessionCookieName);
  if (token === null) throw new Error('the web sign-in set no session cookie');
  return { cookie: `${app.config.sessionCookieName}=${token}`, origin: WEB_ORIGIN };
}
const errorCodeOf = (response: LightMyRequestResponse): string | undefined => (response.json() as { error?: { code?: string } }).error?.code;

/** A REAL sealed v2 item, as the product seal leaves one (the builder of verify v2; see `export-e2e`). */
async function seal(): Promise<{ evidenceId: string; packageDir: string }> {
  core.provisionKey();
  const host = await engineApp(db, core.dataDir, { config: { mediaStoreDir: core.mediaStoreDir } });
  await host.app.readiness.boot();
  const investigator = host.principal('INVESTIGATOR');
  await host.engine.setTabletLink('CONNECTED');
  await host.engine.command(investigator, 'createSession', { ...SESSION_INPUT, investigatorId: investigator.operatorId });
  await host.engine.command(investigator, 'beginPrecheck');
  await host.drive(5_000);
  if (host.engine.slice('session')?.state === 'PRECHECK') await host.engine.command(investigator, 'acknowledgePrecheckWarnings');
  await host.engine.command(investigator, 'startRecording');
  await host.drive(3_000);
  await host.engine.command(investigator, 'stopRecording', 'Interview complete');
  const sessionId = host.engine.slice('session')?.id ?? '';
  await sealDoorsOf(host.engine).applySealingProgress({ sessionId, steps: SEALING_STEP_ORDER.map((id, index) => ({ id, status: index < 5 ? 'DONE' : index === 5 ? 'RUNNING' : 'PENDING', progress: index < 5 ? 100 : index === 5 ? 90 : 0, etaMs: index === 5 ? 700 : null, attempt: 1 })) });
  const evidenceId = host.engine.slice('session')?.evidenceId ?? '';
  expect(evidenceId).toMatch(/^EV-/);

  const store = coreCredentialStore({ stages: {}, config: { dataDir: core.dataDir } });
  if (store.status !== 'READY') throw new Error(`the scratch credential store is ${store.status}`);
  const key = store.store.sessionKeys.create(sessionId);
  const sealer = createFragmentSealer(key);
  const at = host.clock.now();
  const built = await buildPackage({ evidenceId, sessionId, signer: loadSealingSigner({ dataDir: core.dataDir, now: at }), signedAt: at, transcript: 'DISABLED', sealer: (position, plaintext) => sealer.seal(position, plaintext) });
  store.store.sessionKeys.release(key);
  const packageDir = sessionPackageDir(core.mediaStoreDir, sessionId);
  mkdirSync(dirname(packageDir), { recursive: true, mode: 0o700 });
  renameSync(built.dir, packageDir);

  const input: CompleteSealInput = {
    sessionId,
    sealedAt: at,
    manifestSha256: built.manifest.manifestSha256,
    signature: { value: built.manifest.signature.value, keyId: built.manifest.signature.keyId, algorithm: 'Ed25519' },
    tracks: built.manifest.tracks.map((track) => ({ trackId: track.trackId, sizeBytes: track.bytes, sha256: track.sha256 })),
    interrupted: false,
    durableEndAt: at - 1_000,
    transcriptSha256: null,
    labelsStatus: null,
    developmentSources: true,
  };
  expect((await sealDoorsOf(host.engine).completeSeal(input)).value.evidenceId).toBe(evidenceId);
  await host.app.pipeline.drain();
  await host.app.close();
  return { evidenceId, packageDir };
}

/** The real app in REAL_DEVELOPMENT on the database and the scratch data directory. */
async function bootCore(): Promise<FastifyInstance> {
  await db.ownerPool().query('UPDATE public.stt_config SET enabled = false');
  const app = buildApp({
    config: unitTestConfig({
      database: db.runtime,
      dataDir: core.dataDir,
      mediaStoreDir: core.mediaStoreDir,
      logLevel: 'info',
      captureMode: 'real',
      demoControls: false,
      captureDevSources: true,
      captureHelperFfmpegPath: '/bin/echo',
      captureWorkerPath: core.worker('capture-worker', 'capture-worker/0.3.0'),
    }),
    logStream: captureLog().stream,
  });
  await app.ready();
  await app.readiness.boot();
  expect(captureFenceControl(app).operation).toBe('REAL_DEVELOPMENT');
  return app;
}

/** Commits `count` audit rows that have nothing to do with an export (the busy trail of R93-11). */
async function busyTrail(app: FastifyInstance, count: number): Promise<void> {
  const batch = 100;
  for (let done = 0; done < count; done += batch) {
    await app.pipeline.run('test.busyTrail', async (unit) => {
      for (let index = 0; index < Math.min(batch, count - done); index += 1) {
        await unit.audit.append({
          type: AuditType.ACCESS_DENIED,
          severity: Severity.WARNING,
          message: 'Access denied: TEST_BUSY_TRAIL (getEvidenceExportJob)',
          actorId: null,
          deviceId: null,
          details: { operationId: 'getEvidenceExportJob', permission: 'EVIDENCE_EXPORT', role: 'INVESTIGATOR', reason: 'TEST_BUSY_TRAIL' },
        });
      }
    });
  }
  await app.pipeline.drain();
}

describe('R93-11: operation 87 after a restart answers from the STORED rows, not from the audit ring', () => {
  it('a completed export is COMPLETE, a failed export is FAILED with its stored reason, an unknown export is 404', async () => {
    const { evidenceId, packageDir } = await seal();
    const exportUrl = `/api/v1/evidence/${evidenceId}/export`;
    const jobUrl = (jobId: string): string => `/api/v1/evidence/exports/${jobId}`;

    // ── The first run: one failed export, one completed and downloaded export, then a busy trail ──
    const first = await bootCore();
    const jobs = evidenceExport(first).current();
    expect(jobs).not.toBeNull();
    const supervisor = await signedIn(first, 'andi.pratama');
    // Fix wave J: a COMPOSITE is refused before any job by this build; the FAILED job this test needs is admitted through a test part
    // ("this Core says it can") and then fails in the job, which still finds no encoder.
    replaceExportServicePartsForTest(first, { compositeAvailable: () => true });
    const failed = (await first.inject({ method: 'POST', url: exportUrl, headers: supervisor, payload: { reason: 'Prosecutor request', kind: 'COMPOSITE' } })).json() as { exportId: string; jobId: string };
    await jobs?.idle();
    await first.pipeline.drain();
    const completed = (await first.inject({ method: 'POST', url: exportUrl, headers: supervisor, payload: { reason: 'Prosecutor request', destination: 'Case file transfer' } })).json() as { exportId: string; jobId: string };
    await jobs?.idle();
    await first.pipeline.drain();
    const before = (await first.inject({ method: 'GET', url: jobUrl(completed.jobId), headers: supervisor })).json() as { status: string; createdAt: number; download?: { path: string } };
    expect(before.status).toBe('COMPLETE');
    expect((await first.inject({ method: 'GET', url: jobUrl(failed.jobId), headers: supervisor })).json()).toMatchObject({ status: 'FAILED', failureReason: 'COMPOSITE_ENCODER_NOT_SELECTED' });
    expect((await first.inject({ method: 'GET', url: before.download?.path ?? '', headers: supervisor })).statusCode).toBe(200);
    await first.pipeline.drain();

    await busyTrail(first, AUDIT_RING_SIZE + 100);
    await first.close();

    // What the database holds of the two requests (read as the owner: the test's own look).
    const owner = db.ownerPool();
    const requestRows = (await owner.query<{ id: string; export_id: string }>("SELECT id, details->>'exportId' AS export_id FROM public.audit_log WHERE type = 'EVIDENCE_EXPORTED' AND details ? 'exportId' AND evidence_id = $1 ORDER BY seq", [evidenceId])).rows;
    expect(requestRows.map((row) => row.export_id)).toEqual([failed.exportId, completed.exportId]);
    const downloadRows = (await owner.query<{ id: string; seq: string }>("SELECT id, seq FROM public.audit_log WHERE type = 'EVIDENCE_EXPORTED' AND NOT (details ? 'exportId') AND evidence_id = $1", [evidenceId])).rows;
    expect(downloadRows).toHaveLength(1);

    // ── The restart ─────────────────────────────────────────────────────────────────────────────
    const second = await bootCore();
    await second.pipeline.drain();
    // PRECONDITION: the ring of this run holds none of the three rows the answers are about.
    const ring = coreExportDirectory(second);
    expect(second.engine.state().audit.rows.length).toBeLessThanOrEqual(AUDIT_RING_SIZE);
    expect([ring.requestOf(completed.exportId), ring.requestOf(failed.exportId), ring.failureOf(failed.jobId)]).toEqual([null, null, null]);

    const again = await signedIn(second, 'andi.pratama');
    const poll = (jobId: string): Promise<LightMyRequestResponse> => second.inject({ method: 'GET', url: jobUrl(jobId), headers: again });

    // (a) the completed export: COMPLETE, with the export's own hash and signature, and downloadable.
    const exportManifest = parseExportManifest(readFileSync(join(packageDir, 'export', `${completed.exportId}.manifest.json`), 'utf8'));
    const exportSignature = parseExportSignature(readFileSync(join(packageDir, 'export', `${completed.exportId}.manifest.sig`), 'utf8'));
    const complete = await poll(completed.jobId);
    expect(complete.statusCode).toBe(200);
    expect(validateCoreApiResponse('getEvidenceExportJob', 200, complete.json())).toEqual({ ok: true });
    expect(complete.json()).toMatchObject({ jobId: completed.jobId, evidenceId, kind: 'PACKAGE', status: 'COMPLETE', progressPct: 100, manifestHash: exportManifest.export.manifestSha256, signature: exportSignature.signature, createdAt: before.createdAt });
    const path = (complete.json() as { download?: { path: string } }).download?.path ?? '';
    expect(path).toMatch(/^\/exports\/exs_/);
    const download = await second.inject({ method: 'GET', url: path, headers: again });
    expect(download.statusCode).toBe(200);
    expect(download.rawPayload.equals(readFileSync(join(packageDir, 'export', `${completed.exportId}.zip`)))).toBe(true);

    // (b) the failed export: FAILED with the reason and the kind of its STORED rows - not EXPORT_INTERRUPTED.
    const failure = await poll(failed.jobId);
    expect(failure.statusCode).toBe(200);
    expect(validateCoreApiResponse('getEvidenceExportJob', 200, failure.json())).toEqual({ ok: true });
    expect(failure.json()).toMatchObject({ jobId: failed.jobId, evidenceId, kind: 'COMPOSITE', derived: true, status: 'FAILED', failureReason: 'COMPOSITE_ENCODER_NOT_SELECTED', completedAt: null });

    // (c) CONTROLS. An export ID that never existed: 404, for the route and for both stored reads.
    const unknown = await poll('EXPJ-000999');
    expect([unknown.statusCode, errorCodeOf(unknown)]).toEqual([404, 'NOT_FOUND']);
    expect(await readStoredExportRequest(second.db.pool, 'EXP-000999')).toBeNull();
    expect(await readStoredExportFailure(second.db.pool, 'EXPJ-000999')).toBeNull();
    expect(await readStoredExportFailure(second.db.pool, completed.jobId)).toBeNull();
    // The stored request of the completed export is its REQUEST row; the download row (newer, the
    // same type, the same item, no `exportId`) is never read as one.
    const stored = await readStoredExportRequest(second.db.pool, completed.exportId);
    expect(stored).toMatchObject({ exportId: completed.exportId, evidenceId, operatorId: 'OPR-002', destination: 'Case file transfer', reason: 'Prosecutor request', at: before.createdAt });
    expect(stored?.auditId).toBe(requestRows[1]?.id);
    expect(stored?.auditId).not.toBe(downloadRows[0]?.id);
    expect((await readStoredExportRequest(second.db.pool, failed.exportId))?.kind).toBe('COMPOSITE');
    expect((await owner.query('SELECT id FROM public.exports WHERE evidence_id = $1 ORDER BY id', [evidenceId])).rows.map((row: { id: string }) => row.id)).toEqual([failed.exportId, completed.exportId]);
    await second.pipeline.drain();
    await second.close();
  });
});
