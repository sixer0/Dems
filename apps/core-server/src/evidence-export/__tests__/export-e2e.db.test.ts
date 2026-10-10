// FIX PASS F-M8, END TO END on a throw-away database and a scratch Core data directory (review
// findings R93-01, R93-03, R93-04, R93-05, R93-06; controller ruling D178).
//
//   seal      an app in capture operation SIMULATED drives a session to STOPPING; a v2 package of
//             that session is built by the verify-v2 builder - every fragment sealed by the PRODUCT
//             cipher under a session key of the scratch credential store, the manifest signed by
//             the scratch Core's evidence signing key - placed in the media store, and the item is
//             committed by the engine's seal door with the digest of that manifest: a REAL sealed
//             v2 item, as the product seal leaves one;
//   control   on THAT app (no sealing composition, so no export jobs): operation 42 of the REAL
//             item is refused by name and nothing is marked, in the state and in the database;
//   export    the real app in capture operation REAL_DEVELOPMENT on the same database and data
//             directory: the sealing composition PROVIDES the export jobs (the one line of
//             `sealing-host`). A COMPOSITE request fails (licence gate) and leaves the item as it
//             was with one failure row; a PACKAGE request -> poll operation 87 -> COMPLETE -> the
//             archive exists, its manifest hash and signature are the EXPORT's own (not the
//             seal's), the item is EXPORTED with its custody entry only NOW, the signed download
//             hands out the archive, and what was downloaded VERIFIES AT THE DESTINATION without
//             any key of the Core;
//   restart   a `.partial` planted as a dead process leaves it is removed by the boot sweep and
//             recorded once; the finished export is still COMPLETE, from the package folder.
//
// WHAT IS REAL: PostgreSQL (`dems_app` for the Core, `dems_owner` to read what is stored), the app
// with every stage, real sign-in sessions, the engine and its doors, the pipeline and the audit
// writer, the credential store, the cipher, the signer, the verifier, the export, the archive.
// WHAT IS NOT: the media (random bytes, not video), the seal (the builder, not the product
// pipeline: the pipeline's own end-to-end proof is row 82's), the capture worker (a stand-in that
// says HELLO and is never asked to record). No local device is selected, pre-checked or started.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { validateCoreApiResponse, type EvidenceExportJobBody } from '@dems/shared/api';
import type { CompleteSealInput, EvidenceItem } from '@dems/shared/sim';
import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../test/helpers/db';
import { captureLog, unitTestConfig, type CapturedLog } from '../../../test/support/config';
import { engineApp } from '../../../test/support/engine';
import { WEB_ORIGIN, cookieValue, webSignIn } from '../../../test/support/identity';
import { buildApp } from '../../app';
import { realBootFixture } from '../../capture/boot/__tests__/support';
import { captureFenceControl } from '../../capture/fence';
import { coreCredentialStore, createFragmentSealer } from '../../credential-store';
import { sealDoorsOf } from '../../engine/seal-doors';
import { sessionPackageDir } from '../../evidence-verify';
import { buildPackage, removeScratch, scratch, type BuiltPackage } from '../../evidence-verify/__tests__/support';
import { SEALING_STEP_ORDER, loadSealingSigner } from '../../sealing';
import { EXPORT_MANIFEST_FILE, EXPORT_SIGNATURE_FILE, evidenceExport, parseExportManifest, parseExportSignature, verifyExportAtDestination } from '../index';
import { UNZIP } from './support';

vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

const db = useTestDatabase({ template: 'seed', slug: 'fm8exp' });
const core = realBootFixture('fm8exp');
afterAll(() => {
  removeScratch();
  core.remove();
});

const SESSION_INPUT = { caseNumber: 'LP/2026/1001-0093', subjectType: 'SAKSI', subjectName: 'Test Subject', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' } as const;

interface Sealed {
  readonly evidenceId: string;
  readonly sessionId: string;
  readonly built: BuiltPackage;
  readonly packageDir: string;
}

const itemOf = (app: FastifyInstance, evidenceId: string): EvidenceItem => {
  const item = app.engine.state().evidence.find((candidate) => candidate.id === evidenceId);
  if (item === undefined) throw new Error('the engine holds no such item');
  return item;
};
const storedItem = async (evidenceId: string): Promise<{ status: string; custody: string[] }> => {
  const owner = db.ownerPool();
  const status = (await owner.query<{ status: string }>('SELECT status FROM public.evidence_items WHERE id = $1', [evidenceId])).rows[0]?.status ?? '';
  const custody = (await owner.query<{ action: string }>('SELECT action FROM public.evidence_custody WHERE evidence_id = $1 ORDER BY seq', [evidenceId])).rows.map((row) => row.action);
  return { status, custody };
};
const auditOf = async (evidenceId: string, type: string): Promise<Record<string, unknown>[]> =>
  (await db.ownerPool().query<{ details: Record<string, unknown> }>('SELECT details FROM public.audit_log WHERE evidence_id = $1 AND type = $2 ORDER BY seq', [evidenceId, type])).rows.map((row) => row.details);

async function signedIn(app: FastifyInstance, username: string): Promise<Record<string, string>> {
  const answer = await webSignIn(app, username);
  expect(answer.statusCode).toBe(200);
  const token = cookieValue(answer, app.config.sessionCookieName);
  if (token === null) throw new Error('the web sign-in set no session cookie');
  return { cookie: `${app.config.sessionCookieName}=${token}`, origin: WEB_ORIGIN };
}
const errorOf = (response: LightMyRequestResponse): { code?: string; details?: Record<string, unknown> } => (response.json() as { error?: { code?: string; details?: Record<string, unknown> } }).error ?? {};

/** The seal, and the control on the app that has no export jobs. */
async function sealAndControl(): Promise<Sealed> {
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

  // The package: the product cipher under a session key of the scratch store, the scratch Core's signing key.
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
  expect(itemOf(host.app, evidenceId)).toMatchObject({ status: 'SEALED', integritySource: 'REAL', manifestVersion: 2 });

  // CONTROL (the provider absent): this app composed no sealing host, so no export jobs.
  expect(evidenceExport(host.app).current()).toBeNull();
  const supervisor = await signedIn(host.app, 'andi.pratama');
  const before = await storedItem(evidenceId);
  const refused = await host.app.inject({ method: 'POST', url: `/api/v1/evidence/${evidenceId}/export`, headers: supervisor, payload: { reason: 'Prosecutor request' } });
  expect([refused.statusCode, errorOf(refused).code, errorOf(refused).details]).toEqual([503, 'NOT_READY', { reason: 'EXPORT_JOBS_NOT_AVAILABLE' }]);
  await host.app.pipeline.drain();
  expect(await storedItem(evidenceId)).toEqual(before);
  expect(before.status).toBe('SEALED');
  expect(await auditOf(evidenceId, 'EVIDENCE_EXPORTED')).toEqual([]);
  await host.app.close();
  return { evidenceId, sessionId, built, packageDir };
}

/** The real app in REAL_DEVELOPMENT on the database and the scratch data directory. */
async function bootCore(): Promise<{ app: FastifyInstance; log: CapturedLog }> {
  await db.ownerPool().query('UPDATE public.stt_config SET enabled = false');
  const log = captureLog();
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
    logStream: log.stream,
  });
  await app.ready();
  await app.readiness.boot();
  expect(captureFenceControl(app).operation).toBe('REAL_DEVELOPMENT');
  return { app, log };
}

describe('fix F-M8: a real sealed item is exported by a job, recorded when it completes, and downloadable', () => {
  it('seal -> control -> COMPOSITE fails cleanly -> PACKAGE completes -> download verifies at the destination -> restart sweeps a partial', async () => {
    const sealed = await sealAndControl();
    const { evidenceId, packageDir } = sealed;
    const exportUrl = `/api/v1/evidence/${evidenceId}/export`;
    const jobUrl = (jobId: string): string => `/api/v1/evidence/exports/${jobId}`;

    const { app, log } = await bootCore();
    // R93-01: the composition provides the export jobs in a real capture operation.
    const jobs = evidenceExport(app).current();
    expect(jobs).not.toBeNull();
    const supervisor = await signedIn(app, 'andi.pratama');
    const poll = async (jobId: string): Promise<EvidenceExportJobBody & { download?: { path: string; expiresAt: number } }> => {
      const answer = await app.inject({ method: 'GET', url: jobUrl(jobId), headers: supervisor });
      expect(answer.statusCode).toBe(200);
      expect(validateCoreApiResponse('getEvidenceExportJob', 200, answer.json())).toEqual({ ok: true });
      return answer.json();
    };

    // ── R93-03, the failing half: a COMPOSITE (the licence gate is closed) ──────────────────────
    const composite = await app.inject({ method: 'POST', url: exportUrl, headers: supervisor, payload: { reason: 'Prosecutor request', kind: 'COMPOSITE' } });
    expect(composite.statusCode).toBe(202);
    const compositeBody = composite.json() as { exportId: string; jobId: string };
    expect(validateCoreApiResponse('exportEvidence', 202, compositeBody)).toEqual({ ok: true });
    await jobs?.idle();
    await app.pipeline.drain();
    expect(await poll(compositeBody.jobId)).toMatchObject({ status: 'FAILED', kind: 'COMPOSITE', failureReason: 'COMPOSITE_ENCODER_NOT_SELECTED' });
    // The item is as it was: no status EXPORTED, no custody entry of an export - one failure row.
    expect(await storedItem(evidenceId)).toMatchObject({ status: 'SEALED' });
    expect((await storedItem(evidenceId)).custody).not.toContain('EXPORTED');
    expect(itemOf(app, evidenceId).status).toBe('SEALED');
    expect(await auditOf(evidenceId, 'EVIDENCE_EXPORT_FAILED')).toEqual([{ jobId: compositeBody.jobId, kind: 'COMPOSITE', reason: 'COMPOSITE_ENCODER_NOT_SELECTED' }]);
    // R93-06: the kind the request named is on its request row.
    expect((await auditOf(evidenceId, 'EVIDENCE_EXPORTED'))[0]).toMatchObject({ exportId: compositeBody.exportId, kind: 'COMPOSITE' });
    expect(existsSync(join(packageDir, 'export'))).toBe(false);

    // ── R93-01 / R93-03, the completing half: a PACKAGE ─────────────────────────────────────────
    const accepted = await app.inject({ method: 'POST', url: exportUrl, headers: supervisor, payload: { reason: 'Prosecutor request', destination: 'Case file transfer' } });
    expect(accepted.statusCode).toBe(202);
    const { exportId, jobId } = accepted.json() as { exportId: string; jobId: string };
    expect(jobId).toBe(`EXPJ-${exportId.slice(4)}`);
    await jobs?.idle();
    await app.pipeline.drain();
    const done = await poll(jobId);
    expect(done).toMatchObject({ status: 'COMPLETE', kind: 'PACKAGE', progressPct: 100, derived: false });

    // The archive exists, and the manifest hash and the signature are the EXPORT's own.
    const archive = join(packageDir, 'export', `${exportId}.zip`);
    expect(existsSync(archive)).toBe(true);
    const exportManifest = parseExportManifest(readFileSync(join(packageDir, 'export', `${exportId}.manifest.json`), 'utf8'));
    const exportSignature = parseExportSignature(readFileSync(join(packageDir, 'export', `${exportId}.manifest.sig`), 'utf8'));
    expect(done.manifestHash).toBe(exportManifest.export.manifestSha256);
    expect(done.signature).toBe(exportSignature.signature);
    const seal = itemOf(app, evidenceId);
    expect(done.manifestHash).not.toBe(seal.manifestHash);
    expect(done.signature).not.toBe(seal.signature.value);
    expect(exportManifest.export.exportId).toBe(exportId);
    expect(exportManifest.destination.id).toBe('Case file transfer');

    // Only now is the item EXPORTED, with ONE custody entry of the export.
    const after = await storedItem(evidenceId);
    expect(after.status).toBe('EXPORTED');
    expect(after.custody.filter((action) => action === 'EXPORTED')).toHaveLength(1);
    expect(seal.status).toBe('EXPORTED');
    expect(seal.custody.at(-1)).toMatchObject({ action: 'EXPORTED', detail: 'Case file transfer' });

    // ── R93-05: the signed download ─────────────────────────────────────────────────────────────
    const path = done.download?.path ?? '';
    expect(path).toMatch(/^\/exports\/exs_/);
    const download = await app.inject({ method: 'GET', url: path, headers: supervisor });
    expect(download.statusCode).toBe(200);
    expect(download.headers['content-disposition']).toBe(`attachment; filename="DEMS-export-${exportId}.zip"`);
    expect(download.headers['cache-control']).toBe('no-store');
    expect(download.rawPayload.equals(readFileSync(archive))).toBe(true);
    await app.pipeline.drain();
    // Audited with the export's own type and a reason; never read as a second request.
    const exportedRows = await auditOf(evidenceId, 'EVIDENCE_EXPORTED');
    expect(exportedRows.at(-1)).toMatchObject({ jobId, reason: 'EXPORT_DOWNLOADED', bytes: download.rawPayload.byteLength });
    expect(exportedRows.at(-1)).not.toHaveProperty('exportId');
    expect((await db.ownerPool().query('SELECT id FROM public.exports WHERE evidence_id = $1 ORDER BY id', [evidenceId])).rows.map((row: { id: string }) => row.id)).toEqual([compositeBody.exportId, exportId]);
    expect((await storedItem(evidenceId)).custody.at(-1)).toBe('EXPORT_DOWNLOADED');
    // NEGATIVE CONTROLS of the route with real sessions: nobody, an investigator (no EVIDENCE_EXPORT), another supervisor session.
    expect((await app.inject({ method: 'GET', url: path })).statusCode).toBe(401);
    const investigator = await signedIn(app, 'budi.santoso');
    expect((await app.inject({ method: 'GET', url: path, headers: investigator })).statusCode).toBe(403);
    const again = await signedIn(app, 'andi.pratama');
    const foreign = await app.inject({ method: 'GET', url: path, headers: again });
    expect([foreign.statusCode, errorOf(foreign).details?.['reason']]).toEqual([403, 'EXPORT_DOWNLOAD_INVALID']);
    // The token is in no log line and no stored audit row.
    const token = path.slice('/exports/'.length);
    await app.pipeline.drain();
    const trail = JSON.stringify((await db.ownerPool().query('SELECT message, details FROM public.audit_log')).rows);
    for (const text of [log.text(), trail]) {
      expect(text).not.toContain(token);
      expect(text).not.toContain('exs_');
    }

    // ── "the export verifies at the destination": what was DOWNLOADED, without any key of the Core ──
    const destination = scratch('fm8-destination');
    writeFileSync(join(destination, `${exportId}.zip`), download.rawPayload);
    writeFileSync(join(destination, EXPORT_MANIFEST_FILE), readFileSync(join(packageDir, 'export', `${exportId}.manifest.json`)));
    writeFileSync(join(destination, EXPORT_SIGNATURE_FILE), readFileSync(join(packageDir, 'export', `${exportId}.manifest.sig`)));
    const unpacked = join(destination, 'unpacked');
    mkdirSync(unpacked);
    execFileSync(UNZIP, ['-q', join(destination, `${exportId}.zip`), '-d', unpacked]);
    const received = await verifyExportAtDestination({ exportDir: destination, unpackedDir: unpacked, trustedCertificateSha256: [sealed.built.signer.certificate.sha256] });
    expect(received.checks.filter((check) => !check.ok).map((check) => check.id)).toEqual([]);
    expect(received.ok).toBe(true);
    // NEGATIVE CONTROL of the receiver: one flipped byte of the downloaded camera file fails it.
    const camera = join(unpacked, 'fragments', 'VIDEO-01.mp4');
    const bytes = readFileSync(camera);
    bytes[bytes.byteLength - 20] = (bytes[bytes.byteLength - 20] ?? 0) ^ 0xff;
    writeFileSync(camera, bytes);
    expect((await verifyExportAtDestination({ exportDir: destination, unpackedDir: unpacked, trustedCertificateSha256: [sealed.built.signer.certificate.sha256] })).ok).toBe(false);
    await app.close();

    // ── R93-04: a process that died during a later export left a partial; the next start removes it ──
    writeFileSync(join(packageDir, 'export', 'EXP-000900.zip.partial'), 'decrypted evidence a dead process left', { mode: 0o600 });
    const failuresBefore = (await auditOf(evidenceId, 'EVIDENCE_EXPORT_FAILED')).length;
    const second = await bootCore();
    await second.app.pipeline.drain();
    expect(readdirSync(join(packageDir, 'export')).filter((name) => name.endsWith('.partial'))).toEqual([]);
    expect(existsSync(archive)).toBe(true);
    expect((await auditOf(evidenceId, 'EVIDENCE_EXPORT_FAILED')).slice(failuresBefore)).toEqual([{ jobId: 'EXPJ-000900', kind: 'PACKAGE', reason: 'EXPORT_INTERRUPTED' }]);
    // The finished export is still COMPLETE after the restart, from the package folder, with a fresh download path.
    const supervisorAgain = await signedIn(second.app, 'andi.pratama');
    const afterRestart = await second.app.inject({ method: 'GET', url: jobUrl(jobId), headers: supervisorAgain });
    expect(afterRestart.json()).toMatchObject({ status: 'COMPLETE', manifestHash: exportManifest.export.manifestSha256, signature: exportSignature.signature });
    expect((afterRestart.json() as { download?: { path: string } }).download?.path).toMatch(/^\/exports\/exs_/);
    await second.app.close();
    // A third start records nothing more.
    const third = await bootCore();
    await third.app.pipeline.drain();
    expect((await auditOf(evidenceId, 'EVIDENCE_EXPORT_FAILED')).length).toBe(failuresBefore + 1);
    await third.app.close();
  });
});
