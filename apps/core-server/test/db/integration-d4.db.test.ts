// Integration pass D4 (controller decisions D146, D147): the three `db/mapping` seams, on throw-away
// databases, with the writes AS THE RUNTIME ROLE.
//
//   F-82-4  a REAL v2 item (Ed25519 signature, two camera files as tracks, no `files`) is stored by
//           the engine's seal door, and the NEXT process start rehydrates it: the Core boots, holds
//           the same item, and the item is one the replicated slice schema admits;
//   F-82-3  `evidence_items.development_sources` holds what the seal put on the item;
//   D1b     a registered device the state holds no transport for (an adopted camera, a local
//           device outside the selector) keeps the transport of its registry row through the
//           engine's write-through.
//
// Row 82's own file (`src/engine/__tests__/seal-actions.db.test.ts`) holds two expectations marked
// MEASURED, NOT WANTED that state the behaviour BEFORE this pass; they flip with it (not edited here).
import { EvidenceItemSchema } from '@dems/shared/api';
import type { CompleteSealInput, SealingStepReport } from '@dems/shared/sim';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { diffSlices, fromRows, type DurableSlices } from '../../src/db/mapping';
import { applyChanges, readStoredRows } from '../../src/db/store';
import { sealDoorsOf } from '../../src/engine/seal-doors';
import { SEALING_STEP_ORDER } from '../../src/sealing';
import { useTestDatabase } from '../helpers/db';
import { engineApp, storedSlices, type EngineApp } from '../support/engine';

const db = useTestDatabase({ template: 'seed', slug: 'd4map' });

const SESSION_INPUT = { caseNumber: 'LP/2026/1001-0404', subjectType: 'SAKSI', subjectName: 'Test Subject', room: 'Interview Room 1', profileId: 'STANDARD_1080P25' } as const;
const hex = (seed: string, length = 64): string => seed.repeat(length).slice(0, length);

/** From idle to STOPPING, through hosted commands only. Resolves with the session ID. */
async function stopped(host: EngineApp): Promise<string> {
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

const lastStepRunning = (): SealingStepReport[] =>
  SEALING_STEP_ORDER.map((id, index) => ({ id, status: index < 5 ? 'DONE' : index === 5 ? 'RUNNING' : 'PENDING', progress: index < 5 ? 100 : index === 5 ? 90 : 0, etaMs: index === 5 ? 700 : null, attempt: 1 }));

const sealInput = (sessionId: string, at: number, developmentSources: boolean): CompleteSealInput => ({
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
  developmentSources,
});

describe('F-82-4 and F-82-3: a real seal, then a restart', () => {
  it('schema version 6 / dbc-7: no migration belongs to this pass', async () => {
    const meta = (await db.ownerPool().query('SELECT schema_version, contract_revision FROM public.schema_meta')).rows[0];
    expect([Number(meta.schema_version), meta.contract_revision]).toEqual([6, 'dbc-7']);
  });

  for (const developmentSources of [true, false]) {
    it(`seal (developmentSources ${developmentSources}) -> restart: the Core boots, holds the same REAL item, and what is stored is what is committed`, async () => {
      const target = await db.another({ template: 'seed', slug: `d4_real_${developmentSources ? 'dev' : 'prod'}` });
      const first = await engineApp(target, db.run.dataDir);
      await first.app.readiness.boot();
      const sessionId = await stopped(first);
      await sealDoorsOf(first.engine).applySealingProgress({ sessionId, steps: lastStepRunning() });
      const at = first.clock.now();
      const outcome = await sealDoorsOf(first.engine).completeSeal(sealInput(sessionId, at, developmentSources));
      const evidenceId = outcome.value.evidenceId;
      const sealed = first.engine.slice('evidence').find((item) => item.id === evidenceId);
      expect(sealed).toMatchObject({ integritySource: 'REAL', developmentSources, signature: { algorithm: 'Ed25519', simulated: false, value: hex('cd', 128) } });
      expect(sealed?.tracks.map((track) => track.trackId)).toEqual(['VIDEO-01', 'VIDEO-02']);
      expect(sealed !== undefined && 'files' in sealed).toBe(false);

      // F-82-3: the column holds the item's value (it was NULL whatever the item said).
      const owner = target.ownerPool();
      const row = (await owner.query('SELECT development_sources, signature_algorithm, signature_simulated, manifest_version, integrity_source FROM public.evidence_items WHERE id = $1', [evidenceId])).rows[0];
      expect(row).toEqual({ development_sources: developmentSources, signature_algorithm: 'Ed25519', signature_simulated: false, manifest_version: 2, integrity_source: 'REAL' });
      // CONTROL: the 13 seeded v1 items are "not recorded", never false.
      expect((await owner.query('SELECT count(*)::int AS n FROM public.evidence_items WHERE id <> $1 AND development_sources IS NOT NULL', [evidenceId])).rows[0]?.n).toBe(0);
      await first.app.close();

      // F-82-4: the next process start (it was refused with ROW_SHAPE).
      const second = await engineApp(target, db.run.dataDir, { startAt: at + 60_000 });
      await second.app.readiness.boot();
      expect(second.engine.running).toBe(true);
      const rehydrated = second.engine.slice('evidence').find((item) => item.id === evidenceId);
      expect(rehydrated).toEqual(sealed);
      // It replicates: the strict slice schema of the realtime channel and of ops 39 / 40 admits it.
      expect(EvidenceItemSchema.safeParse(rehydrated).success).toBe(true);
      expect((await storedSlices(owner)).evidence).toEqual(second.engine.slice('evidence'));
      // And the restarted engine still writes: a hosted command on the rehydrated state commits.
      await second.engine.setTabletLink('CONNECTED');
      expect((await storedSlices(owner)).evidence).toEqual(second.engine.slice('evidence'));
      await second.app.close();
    });
  }
});

describe('a device the state holds no transport for keeps the transport of its registry row', () => {
  const TRANSPORT = 'SELECT id, transport, enabled, adapter_kind FROM public.capture_devices WHERE id = ANY($1) ORDER BY id';
  const rehydrate = (pool: Pool): Promise<DurableSlices> => drizzle(pool).transaction(async (transaction) => fromRows(await readStoredRows(transaction)));
  const withDevice = (base: DurableSlices, id: string, change: Record<string, unknown>): DurableSlices => ({
    ...base,
    captureDevices: { devices: base.captureDevices.devices.map((device) => (device.id === id ? ({ ...device, ...change } as typeof device) : device)) },
  });
  const writeThrough = async (previous: DurableSlices, next: DurableSlices): Promise<number> => {
    const changes = diffSlices(previous, next, Date.now()).filter((change) => change.table === 'captureDevices');
    await drizzle(db.appPool()).transaction(async (transaction) => applyChanges(transaction, changes));
    return changes.length;
  };

  it('an adopted camera and a local microphone outside the selector go offline and come back: transport unchanged, as dems_app', async () => {
    await db.ownerPool().query(
      `INSERT INTO public.capture_devices (id, kind, transport, model, address, profiles, enabled, adapter_kind) VALUES
         ('CAM-07', 'CAMERA', 'ONVIF', 'Adopted camera', '192.0.2.7', '[]'::jsonb, true, 'ONVIF_RTSP'),
         ('MIC-07', 'MIC', 'AVFOUNDATION', 'Core Mac microphone', NULL, '[]'::jsonb, true, 'LOCAL_DEVICE')`,
    );
    const before = await rehydrate(db.appPool());
    const offline = withDevice(withDevice(before, 'CAM-07', { online: false }), 'MIC-07', { online: false });
    expect(await writeThrough(before, offline)).toBe(2);
    expect((await db.ownerPool().query(TRANSPORT, [['CAM-07', 'MIC-07']])).rows).toEqual([
      { id: 'CAM-07', transport: 'ONVIF', enabled: false, adapter_kind: 'ONVIF_RTSP' },
      { id: 'MIC-07', transport: 'AVFOUNDATION', enabled: false, adapter_kind: 'LOCAL_DEVICE' },
    ]);
    // What the runtime role reads back is the state that was written.
    const stored = await rehydrate(db.appPool());
    expect(stored.captureDevices).toEqual(offline.captureDevices);
    expect(await writeThrough(stored, withDevice(stored, 'MIC-07', { online: true }))).toBe(1);
    expect((await db.ownerPool().query(TRANSPORT, [['MIC-07']])).rows).toEqual([{ id: 'MIC-07', transport: 'AVFOUNDATION', enabled: true, adapter_kind: 'LOCAL_DEVICE' }]);
  });

  it('CONTROL: a built-in camera is still written whole and keeps its seeded transport', async () => {
    const before = await rehydrate(db.appPool());
    expect(await writeThrough(before, withDevice(before, 'CAM-01', { online: false, streamState: 'LOST' }))).toBe(1);
    expect((await db.ownerPool().query(TRANSPORT, [['CAM-01']])).rows).toEqual([{ id: 'CAM-01', transport: 'RTSP', enabled: false, adapter_kind: 'FAKE' }]);
  });
});
