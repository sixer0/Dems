// The INTERNAL sealing actions of the engine host, against PostgreSQL as `dems_app` (task 3
// blueprint row 82; register SH-18 / CS-04; evidence package spec §E.1, §E.2; decisions D67,
// D107 (1)): `engine.applySealingProgress`, `engine.completeSeal`, `engine.recordEvidenceVerification`,
// (the journal on the real `sealing_jobs` is row 79's db test).
//
// The three doors stand beside the seam (`sealDoorsOf`), like the capture doors of row 71.
// The apps here run in the default capture mode: the three doors do not depend on the mode, and a
// real-mode boot needs the boot fixture of row 71b (`realBootFixture`), listed in the row's note.
//
// What is held: the session is FINALIZING for as long as the pipeline says so and no tick seals
// it; the item of the REAL package is stored with what it was handed; a row that hangs on the item
// commits with it or the seal does not commit; a verdict is recorded with the keys of the hosted
// verify; and - MEASURED, NOT WANTED - what the closed database mapping does with a real item
// (the two findings F-82-3 and F-82-4 of the row's note; each such assertion says so).
import type { CompleteSealInput, SealingStepReport } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../test/helpers/db';
import { readHead, readTrail, verifyTrail } from '../../../test/support/core';
import { REAL_SEALED_EVIDENCE_STATEMENT } from '../../db/reset/real-evidence';
import { SEALING_STEP_ORDER } from '../../sealing';
import { sealDoorsOf } from '../seal-doors';
import { engineApp, storedSlices, type EngineApp } from './support';

const db = useTestDatabase({ template: 'seed' });

interface Booted extends EngineApp {
  readonly owner: Pool;
  readonly target: Awaited<ReturnType<typeof db.another>>;
}

async function booted(slug: string): Promise<Booted> {
  const target = await db.another({ template: 'seed', slug });
  const host = await engineApp(target, db.run.dataDir);
  await host.app.readiness.boot();
  return { ...host, owner: target.ownerPool(), target };
}

const SESSION_INPUT = { caseNumber: 'LP/2026/1001-0082', subjectType: 'SAKSI', subjectName: 'Test Subject', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' } as const;
const hex = (seed: string, length = 64): string => seed.repeat(length).slice(0, length);

/** From idle to STOPPING, through hosted commands only. Resolves with the session ID. */
async function stopped(host: Booted): Promise<string> {
  const investigator = host.principal('INVESTIGATOR');
  await host.engine.setTabletLink('CONNECTED');
  await host.engine.command(investigator, 'createSession', { ...SESSION_INPUT, investigatorId: investigator.operatorId });
  await host.engine.command(investigator, 'beginPrecheck');
  await host.drive(5_000);
  if (host.engine.slice('session')?.state === 'PRECHECK') await host.engine.command(investigator, 'acknowledgePrecheckWarnings');
  await host.engine.command(investigator, 'startRecording');
  await host.drive(3_000);
  await host.engine.command(investigator, 'stopRecording', 'Interview complete');
  expect(host.engine.slice('session')?.state).toBe('STOPPING');
  return host.engine.slice('session')?.id ?? '';
}

const report = (running: number, progress: number, attempt = 1): SealingStepReport[] =>
  SEALING_STEP_ORDER.map((id, index) => ({ id, status: index < running ? 'DONE' : index === running ? 'RUNNING' : 'PENDING', progress: index < running ? 100 : index === running ? progress : 0, etaMs: index === running ? 700 : null, attempt }));

const sealInput = (sessionId: string, at: number): CompleteSealInput => ({
  sessionId,
  sealedAt: at,
  manifestSha256: hex('ab'),
  signature: { value: hex('cd', 128), keyId: 'CORE-KEY-EVSIGN-01', algorithm: 'Ed25519' },
  tracks: [
    { trackId: 'VIDEO-01', sizeBytes: 4_000, sha256: hex('01') },
    { trackId: 'VIDEO-02', sizeBytes: 5_000, sha256: hex('02') },
  ],
  interrupted: false,
  durableEndAt: at - 1_000,
  transcriptSha256: null,
  labelsStatus: null,
  developmentSources: true,
});

describe('engine.applySealingProgress (SH-18, CS-04)', () => {
  it('moves the stopped session to FINALIZING; no tick seals it; what is stored is what is committed; the same report again sends no statement', async () => {
    const host = await booted('r82_progress');
    const sessionId = await stopped(host);
    const items = host.engine.slice('evidence').length;
    await sealDoorsOf(host.engine).applySealingProgress({ sessionId, steps: report(0, 10) });
    expect(host.engine.slice('session')).toMatchObject({ state: 'FINALIZING' });
    await host.drive(30_000);
    // CONTROL of the claim is `commands.db.test.ts`: without the pipeline the simulator seals within about 9 s.
    expect(host.engine.slice('session')?.state).toBe('FINALIZING');
    expect(host.engine.slice('evidence')).toHaveLength(items);
    expect(host.engine.slice('session')?.finalization.steps[0]).toMatchObject({ id: 'CLOSE_TRACKS', status: 'active', progress: 10, etaMs: 700, durationMs: null, attempt: 1 });
    expect((await storedSlices(host.owner)).session).toEqual(host.engine.slice('session'));

    const sent = host.database.statements.length;
    const revision = host.engine.revision;
    await sealDoorsOf(host.engine).applySealingProgress({ sessionId, steps: report(0, 10) });
    expect([host.database.statements.length, host.engine.revision]).toEqual([sent, revision]);

    await sealDoorsOf(host.engine).applySealingProgress({ sessionId, steps: report(2, 40) });
    expect(host.engine.slice('session')?.finalization.steps.map((step) => step.status)).toEqual(['done', 'done', 'active', 'pending', 'pending', 'pending']);
    expect((await storedSlices(host.owner)).session).toEqual(host.engine.slice('session'));
  });

  it('refuses another session with the mapped refusal and stores nothing', async () => {
    const host = await booted('r82_progress_refused');
    await stopped(host);
    const sent = host.database.statements.length;
    await expect(sealDoorsOf(host.engine).applySealingProgress({ sessionId: 'SES-20990101-0001', steps: report(0, 1) })).rejects.toMatchObject({ statusCode: 409 });
    expect(host.engine.slice('session')?.state).toBe('STOPPING');
    expect(host.database.statements.slice(sent).filter((text) => /^\s*(insert|update|delete)/i.test(text))).toEqual([]);
  });
});

describe('engine.completeSeal: the item of the real package', () => {
  it('stores the item with what it was handed, writes EVIDENCE_SEALED once, keeps the chain whole, and the reset guard sees a REAL sealed item', async () => {
    const host = await booted('r82_complete');
    const sessionId = await stopped(host);
    await sealDoorsOf(host.engine).applySealingProgress({ sessionId, steps: report(5, 90) });
    const at = host.clock.now();
    const alsoSaw: string[] = [];
    const outcome = await sealDoorsOf(host.engine).completeSeal(sealInput(sessionId, at), async (unit, evidenceId) => {
      // The item's row is there INSIDE the unit, before the commit: a row that hangs on it can be written.
      const found = await unit.query<{ id: string }>('SELECT id FROM public.evidence_items WHERE id = $1', [evidenceId]);
      alsoSaw.push(...found.rows.map((row) => row.id));
    });
    const evidenceId = outcome.value.evidenceId;
    expect(alsoSaw).toEqual([evidenceId]);
    expect(host.engine.slice('session')).toMatchObject({ state: 'SEALED', sealedAt: at, evidenceId });

    const row = (await host.owner.query('SELECT integrity_source, status, sealed_at, manifest_hash, manifest_version, signature_value, signature_key_id, signature_algorithm, signature_simulated, transcript_sha256, labels_status, development_sources FROM public.evidence_items WHERE id = $1', [evidenceId])).rows[0];
    expect(row).toMatchObject({ integrity_source: 'REAL', status: 'SEALED', manifest_hash: hex('ab'), manifest_version: 2, signature_value: hex('cd', 128), signature_key_id: 'CORE-KEY-EVSIGN-01', signature_algorithm: 'Ed25519', signature_simulated: false, transcript_sha256: null, labels_status: null });
    expect(Number(row?.sealed_at)).toBe(at);
    // F-82-3, CLOSED by integration pass D4: the mapping writes the seal's development mark (it wrote
    // NULL whatever the item said; that measured expectation was flipped by row 82b).
    expect(row?.development_sources).toBe(true);
    expect(host.engine.slice('evidence').at(-1)).toMatchObject({ id: evidenceId, developmentSources: true });

    const tracks = (await host.owner.query('SELECT track_id, size_bytes, sha256 FROM public.evidence_tracks WHERE evidence_id = $1 ORDER BY position', [evidenceId])).rows;
    expect(tracks.map((track) => [track.track_id, Number(track.size_bytes), track.sha256])).toEqual([['VIDEO-01', 4_000, hex('01')], ['VIDEO-02', 5_000, hex('02')]]);

    const trail = await readTrail(host.owner);
    expect(verifyTrail(trail, await readHead(host.owner)).ok).toBe(true);
    expect(trail.filter((entry) => entry.type === 'EVIDENCE_SEALED' && entry.evidenceId === evidenceId)).toHaveLength(1);

    // THE RESET FENCE AT R-0 (CS-21; dbc §E.2): the guard's own statement finds the item.
    const fenced = await host.owner.query(REAL_SEALED_EVIDENCE_STATEMENT);
    expect(fenced.rows.some((entry) => Object.values(entry).includes(evidenceId))).toBe(true);
  });

  it('a row that hangs on the item commits with it or the seal does not commit at all', async () => {
    const host = await booted('r82_complete_rollback');
    const sessionId = await stopped(host);
    await sealDoorsOf(host.engine).applySealingProgress({ sessionId, steps: report(5, 90) });
    const items = host.engine.slice('evidence').length;
    await expect(
      sealDoorsOf(host.engine).completeSeal(sealInput(sessionId, host.clock.now()), async () => {
        throw new Error('the transcript row was refused');
      }),
    ).rejects.toThrow('the transcript row was refused');
    expect(host.engine.slice('session')?.state).toBe('FINALIZING');
    expect(host.engine.slice('evidence')).toHaveLength(items);
    expect((await host.owner.query("SELECT count(*)::int AS n FROM public.evidence_items WHERE integrity_source = 'REAL'")).rows[0]?.n).toBe(0);
    expect(verifyTrail(await readTrail(host.owner), await readHead(host.owner)).ok).toBe(true);
    // The pipeline's next attempt seals.
    await sealDoorsOf(host.engine).completeSeal(sealInput(sessionId, host.clock.now()));
    expect(host.engine.slice('session')?.state).toBe('SEALED');
  });

  it('refuses a digest that is none and a session that is not finalizing; nothing is stored', async () => {
    const host = await booted('r82_complete_refused');
    const sessionId = await stopped(host);
    await expect(sealDoorsOf(host.engine).completeSeal(sealInput(sessionId, host.clock.now()))).rejects.toMatchObject({ statusCode: 409 });
    await sealDoorsOf(host.engine).applySealingProgress({ sessionId, steps: report(5, 90) });
    await expect(sealDoorsOf(host.engine).completeSeal({ ...sealInput(sessionId, host.clock.now()), manifestSha256: 'abc' })).rejects.toMatchObject({ statusCode: 409 });
    expect((await host.owner.query("SELECT count(*)::int AS n FROM public.evidence_items WHERE integrity_source = 'REAL'")).rows[0]?.n).toBe(0);
  });
});

describe('engine.recordEvidenceVerification (D107 (1))', () => {
  it('records a pass and a failure of a REAL item with the keys of the hosted verify, and refuses a dataset item', async () => {
    const host = await booted('r82_verdict');
    const sessionId = await stopped(host);
    await sealDoorsOf(host.engine).applySealingProgress({ sessionId, steps: report(5, 90) });
    const evidenceId = (await sealDoorsOf(host.engine).completeSeal(sealInput(sessionId, host.clock.now()))).value.evidenceId;
    const actorId = host.principal('SUPERVISOR').operatorId;
    const at = host.clock.now();
    await sealDoorsOf(host.engine).recordEvidenceVerification({ evidenceId, ok: true, at, manifestOk: true, signatureOk: true, failedTracks: [], detail: null, actorId });
    await sealDoorsOf(host.engine).recordEvidenceVerification({ evidenceId, ok: false, at: at + 1, manifestOk: true, signatureOk: true, failedTracks: ['VIDEO-02'], detail: 'Mismatch: VIDEO-02 fragment 3', actorId });
    const trail = (await readTrail(host.owner)).filter((entry) => entry.evidenceId === evidenceId);
    expect(trail.map((entry) => entry.type)).toEqual(['EVIDENCE_SEALED', 'EVIDENCE_VERIFIED', 'EVIDENCE_VERIFY_FAILED']);
    expect(trail.at(-1)).toMatchObject({ actorId, details: { manifestOk: true, signatureOk: true, failedTracks: 'VIDEO-02', eventKind: 'TAMPER' } });
    expect((await host.owner.query('SELECT verification_status FROM public.evidence_items WHERE id = $1', [evidenceId])).rows[0]?.verification_status).toBe('FAIL');
    expect((await host.owner.query('SELECT action, detail FROM public.evidence_custody WHERE evidence_id = $1 ORDER BY seq DESC LIMIT 1', [evidenceId])).rows[0]).toEqual({ action: 'VERIFY_FAILED', detail: 'Mismatch: VIDEO-02 fragment 3' });
    expect(verifyTrail(await readTrail(host.owner), await readHead(host.owner)).ok).toBe(true);

    const dataset = host.engine.slice('evidence').find((item) => item.integritySource !== 'REAL');
    await expect(sealDoorsOf(host.engine).recordEvidenceVerification({ evidenceId: dataset?.id ?? '', ok: true, at, manifestOk: true, signatureOk: true, failedTracks: [], detail: null, actorId })).rejects.toMatchObject({ statusCode: 409 });
  });

  // FIX WAVE K, driver S2 (re-gate findings G89b-04, G94b-03; rulings D216 (2), D222 (3)).
  it('G89b-04 - a verification a PAIRED DEVICE asked for: the STORED rows name the device and the operation, and the failed row names the FRAGMENT; a web request keeps no device (control)', async () => {
    const host = await booted('wk_s2_verdict');
    const sessionId = await stopped(host);
    await sealDoorsOf(host.engine).applySealingProgress({ sessionId, steps: report(5, 90) });
    const evidenceId = (await sealDoorsOf(host.engine).completeSeal(sealInput(sessionId, host.clock.now()))).value.evidenceId;
    const actorId = host.principal('INVESTIGATOR').operatorId;
    const at = host.clock.now();
    const asked = { evidenceId, manifestOk: true, signatureOk: true, actorId, operationId: 'verifyEvidence' };
    await sealDoorsOf(host.engine).recordEvidenceVerification({ ...asked, ok: true, at, failedTracks: [], detail: null, failedFragments: [], deviceId: 'DEV-0001' });
    await sealDoorsOf(host.engine).recordEvidenceVerification({ ...asked, ok: false, at: at + 1, failedTracks: ['VIDEO-02'], detail: 'Mismatch: VIDEO-02 fragment 3', failedFragments: ['VIDEO-02:3'], deviceId: 'DEV-0001' });
    await sealDoorsOf(host.engine).recordEvidenceVerification({ ...asked, ok: false, at: at + 2, failedTracks: ['VIDEO-02'], detail: 'Mismatch: VIDEO-02 fragment 3', failedFragments: ['VIDEO-02:3'], deviceId: null });
    const rows = (await readTrail(host.owner)).filter((entry) => entry.evidenceId === evidenceId && entry.type !== 'EVIDENCE_SEALED');
    expect(rows.map((entry) => [entry.type, entry.deviceId ?? null, entry.details['operationId'], entry.details['failedFragments'] ?? null])).toEqual([
      ['EVIDENCE_VERIFIED', 'DEV-0001', 'verifyEvidence', null],
      ['EVIDENCE_VERIFY_FAILED', 'DEV-0001', 'verifyEvidence', 'VIDEO-02:3'],
      ['EVIDENCE_VERIFY_FAILED', null, 'verifyEvidence', 'VIDEO-02:3'],
    ]);
    expect(rows[1]).toMatchObject({ actorId, details: { failedTracks: 'VIDEO-02', failedFragmentCount: 1, eventKind: 'TAMPER' } });
    expect(verifyTrail(await readTrail(host.owner), await readHead(host.owner)).ok).toBe(true);
  });
});

// The journal on the real `sealing_jobs` is held by row 79's `finalize-transcript.db.test.ts` (the same journal).
describe('a restart while the pipeline holds the session', () => {
  it('a process start while the pipeline held the session: the session is faulted from FINALIZING and the pipeline takes it back to FINALIZING, attempt 2', async () => {
    const target = await db.another({ template: 'seed', slug: 'r82_restart' });
    const first = { ...(await engineApp(target, db.run.dataDir)), owner: target.ownerPool(), target };
    await first.app.readiness.boot();
    const sessionId = await stopped(first);
    await sealDoorsOf(first.engine).applySealingProgress({ sessionId, steps: report(2, 40) });
    const stoppedAt = first.clock.now();
    await first.app.close();

    const second = await engineApp(target, db.run.dataDir, { startAt: stoppedAt + 60_000 });
    await second.app.readiness.boot();
    expect(second.engine.slice('session')).toMatchObject({ id: sessionId, state: 'FAULT', fault: { fromState: 'FINALIZING' } });
    await sealDoorsOf(second.engine).applySealingProgress({ sessionId, steps: report(2, 5, 2) });
    const session = second.engine.slice('session');
    expect(session?.state).toBe('FINALIZING');
    expect(session?.finalization.steps[2]).toMatchObject({ status: 'active', attempt: 2, progress: 5 });
    await sealDoorsOf(second.engine).completeSeal(sealInput(sessionId, second.clock.now()));
    expect(second.engine.slice('session')?.state).toBe('SEALED');
    expect((await readTrail(target.ownerPool())).filter((entry) => entry.sessionId === sessionId && entry.type === 'RECOVERY_COMPLETED')).toHaveLength(1);
  });

  it('F-82-4, closed by integration pass D4: after a real item is stored the next process start holds it (the Core boots after its first real seal)', async () => {
    const target = await db.another({ template: 'seed', slug: 'r82_restart_real_item' });
    const first = { ...(await engineApp(target, db.run.dataDir)), owner: target.ownerPool(), target };
    await first.app.readiness.boot();
    const sessionId = await stopped(first);
    await sealDoorsOf(first.engine).applySealingProgress({ sessionId, steps: report(5, 90) });
    await sealDoorsOf(first.engine).completeSeal(sealInput(sessionId, first.clock.now()));
    const at = first.clock.now();
    await first.app.close();

    // The mapping's way back admits the REAL Ed25519 signature (it refused it with `ROW_SHAPE`, and
    // the engine did not start: the measured expectation row 82b flipped).
    const second = await engineApp(target, db.run.dataDir, { startAt: at + 60_000 });
    await second.app.readiness.boot();
    expect(second.engine.running).toBe(true);
    const held = second.engine.slice('evidence').find((item) => item.sessionId === sessionId);
    expect(held).toMatchObject({ integritySource: 'REAL', manifestHash: hex('ab'), manifestVersion: 2, developmentSources: true, signature: { value: hex('cd', 128), keyId: 'CORE-KEY-EVSIGN-01', algorithm: 'Ed25519', simulated: false } });
  });
});
