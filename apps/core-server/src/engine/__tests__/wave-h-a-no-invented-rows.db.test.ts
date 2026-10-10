// Fix wave H, driver A, finding G75-01 (gate 75 section 5; gate 81 G81-04; gate 89 B-1; rulings
// D197, D199), against PostgreSQL as `dems_app`: a Core in capture mode `real` writes NO row the
// shared simulator's generator invents - `FRAME_HASH`, `WRITE_VERIFIED`, `TIMESTAMP_CONFIRMED` -
// into its audit chain, and so none can reach the `audit-session-extract.jsonl` of a seal (the
// extract is `SELECT ... FROM audit_log WHERE session_id = $1`, `sealing-host/session-reader.ts`).
//
// CONTROL: the same recording on a Core in capture mode `simulated` holds every one of them.
//
// No capture is started here: the worker of the fixture is a stand-in script that records nothing,
// opens no port and reads no device. The session is RECORDING in the engine's state, which is the
// one condition the generator read.
import type { Pool } from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../test/helpers/db';
import { readHead, readTrail, verifyTrail } from '../../../test/support/core';
import { realBootFixture } from '../../capture/boot/__tests__/support';
import { READ_SEAL_AUDIT_ROWS } from '../../sealing-host/session-reader';
import { engineApp, type EngineApp } from './support';

const db = useTestDatabase({ template: 'seed' });
const realBoot = realBootFixture('wha');
realBoot.provisionKey();
afterAll(() => realBoot.remove());
// As `capture-actions.db.test.ts`: the seed's built-in devices are development sources, so the real boot is REAL_DEVELOPMENT.
const REAL_BOOT = {
  dataDir: realBoot.dataDir,
  mediaStoreDir: realBoot.mediaStoreDir,
  demoControls: false,
  captureDevSources: true,
  captureHelperFfmpegPath: '/bin/echo',
  captureWorkerPath: realBoot.worker('capture-worker', 'capture-worker/0.3.0'),
} as const;

/** The audit types and the event types only the simulator's generator writes. */
const INVENTED_AUDIT = ['FRAME_HASH', 'WRITE_VERIFIED', 'TIMESTAMP_CONFIRMED'] as const;
const INVENTED_EVENTS = ['AUTOSAVE', 'STORAGE_WRITE_VERIFIED', 'TIME_SYNC'] as const;

interface Booted extends EngineApp {
  readonly owner: Pool;
}

async function booted(slug: string, captureMode: 'simulated' | 'real'): Promise<Booted> {
  const target = await db.another({ template: 'seed', slug });
  // The transcriber is not the subject: STT off in a real boot, as the other real-mode fixtures do.
  if (captureMode === 'real') await target.ownerPool().query('UPDATE public.stt_config SET enabled = false');
  const host = await engineApp(target, db.run.dataDir, { captureMode, ...(captureMode === 'real' ? { config: REAL_BOOT } : {}) });
  await host.app.readiness.boot();
  return { ...host, owner: target.ownerPool() };
}

const SESSION_INPUT = { caseNumber: 'LP/2026/1010-0120', subjectType: 'SAKSI', subjectName: 'Test Subject', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' } as const;

/** Idle for two minutes, then a recording of `recordMs` in the engine's state. Returns the session and the audit seq it began after. */
async function idleThenRecord(host: Booted, recordMs: number): Promise<{ sessionId: string; afterSeq: number; afterEventAt: number; recordedMs: number }> {
  const afterSeq = Number((await host.owner.query('SELECT coalesce(max(seq), 0) AS seq FROM public.audit_log')).rows[0]?.seq);
  const afterEventAt = host.clock.now();
  await host.drive(120_000, 1_000);
  const investigator = host.principal('INVESTIGATOR');
  await host.engine.setTabletLink('CONNECTED');
  await host.engine.command(investigator, 'createSession', { ...SESSION_INPUT, investigatorId: investigator.operatorId });
  await host.engine.command(investigator, 'beginPrecheck');
  await host.drive(5_000);
  if (host.engine.slice('session')?.state === 'PRECHECK') await host.engine.command(investigator, 'acknowledgePrecheckWarnings');
  await host.engine.command(investigator, 'startRecording');
  const sessionId = host.engine.slice('session')?.id ?? '';
  let recordedMs = 0;
  while (recordedMs < recordMs && host.engine.slice('session')?.state === 'RECORDING') {
    await host.drive(1_000, 250);
    recordedMs += 1_000;
  }
  return { sessionId, afterSeq, afterEventAt, recordedMs };
}

const auditTypesSince = async (owner: Pool, afterSeq: number): Promise<string[]> => (await owner.query<{ type: string }>('SELECT type FROM public.audit_log WHERE seq > $1 ORDER BY seq', [afterSeq])).rows.map((row) => row.type);
const eventTypesSince = async (owner: Pool, at: number): Promise<string[]> => (await owner.query<{ type: string }>('SELECT type FROM public.events WHERE at >= $1', [at])).rows.map((row) => row.type);
/** The rows the seal would write into `audit-session-extract.jsonl`, by the reader's own statement. */
const extractTypes = async (owner: Pool, sessionId: string): Promise<string[]> => (await owner.query<{ type: string }>(READ_SEAL_AUDIT_ROWS, [sessionId])).rows.map((row) => row.type);
const among = (types: readonly string[], wanted: readonly string[]): string[] => types.filter((type) => wanted.includes(type));

describe('G75-01: the audit chain of a Core in capture mode real', () => {
  it('holds no FRAME_HASH / WRITE_VERIFIED / TIMESTAMP_CONFIRMED row of a recording session, and its extract statement returns none; no AUTOSAVE, storage-integrity or time-sync event; the chain verifies', async () => {
    const host = await booted('wha_real', 'real');
    const run = await idleThenRecord(host, 180_000);
    // The session recorded in the engine's state for the whole time (three minutes: about 22 arrivals of the simulated stream).
    expect(run.recordedMs).toBe(180_000);
    expect(among(await auditTypesSince(host.owner, run.afterSeq), INVENTED_AUDIT)).toEqual([]);
    const extract = await extractTypes(host.owner, run.sessionId);
    expect(among(extract, INVENTED_AUDIT)).toEqual([]);
    // What IS the session's: the rows of the operator's acts.
    expect(extract).toContain('RECORDING_STARTED');
    expect(among(await eventTypesSince(host.owner, run.afterEventAt), INVENTED_EVENTS)).toEqual([]);
    expect((host.engine.slice('session')?.timeline ?? []).map((item) => item.kind).filter((kind) => ['AUTOSAVE', 'CHECK', 'HEALTH'].includes(kind))).toEqual([]);
    expect(verifyTrail(await readTrail(host.owner), await readHead(host.owner))).toMatchObject({ ok: true });
  });

  it('CONTROL - capture mode simulated keeps the demo stream: the same recording holds all three row types in the chain and in the extract statement', async () => {
    const host = await booted('wha_simulated', 'simulated');
    const run = await idleThenRecord(host, 180_000);
    expect(run.recordedMs).toBe(180_000);
    const extract = await extractTypes(host.owner, run.sessionId);
    for (const type of INVENTED_AUDIT) expect(extract, type).toContain(type);
    expect(await eventTypesSince(host.owner, run.afterEventAt)).toContain('AUTOSAVE');
  });
});
