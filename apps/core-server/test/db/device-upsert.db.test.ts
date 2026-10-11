// M4-MT-12 and the A-11 rule on a throw-away database, AS THE RUNTIME ROLE (blueprint row 129;
// database contract dbc-4 §N.2, §N.12 MT-12; D72(f), D83 (D-DB-13); pair-58 finding A-11; D95).
//
// The D72(f) class is a missing grant that stays invisible until the code path runs, so the path
// runs here as `dems_app`, never as the owner: the engine's write-through UPSERT of
// `capture_devices` (`diffSlices` -> `applyChanges`) on ids that already exist.
//
//   rule 1  the UPSERT succeeds and leaves `adapter_kind` (and `kind`) unchanged;
//   rule 2  an ingest-state change of a camera leaves `mac`, `onvif_uuid`, `profiles` and
//           `last_seen_at` exactly as discovery and adoption stored them.
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { MappingError, diffSlices, fromRows, type DurableSlices } from '../../src/db/mapping';
import { applyChanges, readStoredRows } from '../../src/db/store';
import { useFurtherDatabase, useTestDatabase } from '../helpers/db';
import { SQLSTATE, expectRefused } from './support';
import { existsSync } from 'node:fs';
import { EvidenceItemSchema } from '@dems/shared/api';
import type { CompleteSealInput, SealingStepReport } from '@dems/shared/sim';
import { sealDoorsOf } from '../../src/engine/seal-doors';
import { sessionPackageDir } from '../../src/evidence-verify';
import { SEALING_STEP_ORDER } from '../../src/sealing';
import { engineApp, storedSlices, type EngineApp } from '../support/engine';

const db = useTestDatabase({ template: 'seed', slug: 'm4ups' });
/** This file's database under a second name: a describe that keeps a further clone of its own calls that one `db`. */
const home = db;

const DISCOVERY = { mac: 'AA:BB:CC:DD:EE:07', onvif_uuid: 'urn:uuid:m4ups-cam-07', profiles: ['H264_1080P25', 'H264_720P30'], last_seen_at: '1790823600123' };
const STORED = 'SELECT id, kind, adapter_kind, enabled, mac, onvif_uuid, profiles, last_seen_at::text AS last_seen_at FROM public.capture_devices WHERE id = $1';

async function rehydrate(pool: Pool): Promise<DurableSlices> {
  return drizzle(pool).transaction(async (transaction) => fromRows(await readStoredRows(transaction)));
}

function withDevice(base: DurableSlices, id: string, change: Record<string, unknown>): DurableSlices {
  return {
    ...base,
    captureDevices: { devices: base.captureDevices.devices.map((device) => (device.id === id ? ({ ...device, ...change } as typeof device) : device)) },
  };
}

/** One write-through step as dems_app: the diff of two states, applied in one transaction. */
async function writeThrough(previous: DurableSlices, next: DurableSlices): Promise<number> {
  const changes = diffSlices(previous, next, Date.now()).filter((change) => change.table === 'captureDevices');
  await drizzle(db.appPool()).transaction(async (transaction) => applyChanges(transaction, changes));
  return changes.length;
}

beforeAll(async () => {
  // An adopted network camera and this Mac's camera, as adoption and row 136 will write them: rows
  // of their own, with what discovery stored. Planted by the owner; everything after is dems_app.
  await db.ownerPool().query(
    `INSERT INTO public.capture_devices (id, kind, transport, model, address, mac, onvif_uuid, profiles, enabled, last_seen_at, adapter_kind) VALUES
       ('CAM-07', 'CAMERA', 'ONVIF', 'Adopted camera', '192.0.2.7', $1, $2, $3::jsonb, true, $4, 'ONVIF_RTSP'),
       ('CAM-08', 'CAMERA', 'LOCAL', 'Core Mac camera', NULL, NULL, NULL, '["H264_1080P25"]'::jsonb, true, $4, 'LOCAL_DEVICE')`,
    [DISCOVERY.mac, DISCOVERY.onvif_uuid, JSON.stringify(DISCOVERY.profiles), DISCOVERY.last_seen_at],
  );
});

describe('M4-MT-12: the device UPSERT as dems_app on an existing id', () => {
  it('an ingest-state change of an adopted camera succeeds; adapter_kind, kind and the four discovery columns are unchanged', async () => {
    const before = await rehydrate(db.appPool());
    // An adopted camera reads back as operation 96 registered it (the INTERNAL action
    // `registerCaptureDevice`, row 132; `captureDeviceOf` of the shared registry; C3 §2.6 "Adoption is
    // not assignment"): online, NO stream state until a track is assigned, with its adapter and the
    // class derived from it. The mapping must give exactly that shape back, or the stored state
    // would differ from the committed one after every adoption. (Until row 132 this line expected
    // the built-in cameras' `streamState: 'LIVE'`, which only CAM-01 / CAM-02 carry.)
    expect(before.captureDevices.devices.find((device) => device.id === 'CAM-07')).toMatchObject({ online: true, streamState: null, adapter: 'ONVIF_RTSP', sourceClass: 'PRODUCTION' });
    // CONTROL: a built-in camera still reads LIVE while it is enabled.
    expect(before.captureDevices.devices.find((device) => device.id === 'CAM-01')).toMatchObject({ online: true, streamState: 'LIVE' });
    // The camera's ingest stops: the supervisor's telemetry turns the device offline.
    const applied = await writeThrough(before, withDevice(before, 'CAM-07', { online: false, streamState: 'LOST' }));
    expect(applied).toBe(1);
    expect((await db.ownerPool().query(STORED, ['CAM-07'])).rows).toEqual([
      { id: 'CAM-07', kind: 'CAMERA', adapter_kind: 'ONVIF_RTSP', enabled: false, ...DISCOVERY },
    ]);
    // And back: the second update of the same row is as good as the first.
    const offline = await rehydrate(db.appPool());
    await writeThrough(offline, withDevice(offline, 'CAM-07', { online: true, streamState: 'LIVE' }));
    expect((await db.ownerPool().query(STORED, ['CAM-07'])).rows).toEqual([
      { id: 'CAM-07', kind: 'CAMERA', adapter_kind: 'ONVIF_RTSP', enabled: true, ...DISCOVERY },
    ]);
  });

  it('the same for a LOCAL_DEVICE row and for a seeded built-in: the kind each was inserted with stays', async () => {
    const before = await rehydrate(db.appPool());
    const next = withDevice(withDevice(before, 'CAM-08', { online: false, streamState: 'LOST' }), 'MIC-01', { online: false });
    // TWO changes, by the planner's own rule (pass D4, `diffCapture` in db/mapping/changes.ts; pass
    // E3 item 1 moved this expectation from 1): a device whose transport the state HOLDS (a
    // built-in such as MIC-01) goes into the ONE batched UPSERT of whole rows; a device whose
    // transport the state does NOT hold (this Mac's camera, an adopted camera) is ONE UPDATE of its
    // own, of exactly the modelled columns that moved - so that the registry's transport is never
    // overwritten. Each shape is asserted, not only the count.
    const planned = diffSlices(before, next, Date.now()).filter((change) => change.table === 'captureDevices');
    expect(planned.map((change) => change.op)).toEqual(['insert', 'update']);
    expect(planned[0]).toMatchObject({ op: 'insert', rows: [expect.objectContaining({ id: 'MIC-01', enabled: false })] });
    expect(planned[1]).toEqual({ op: 'update', table: 'captureDevices', key: { id: 'CAM-08' }, set: { enabled: false } });
    expect(await writeThrough(before, next)).toBe(2);
    const { rows } = await db.ownerPool().query("SELECT id, adapter_kind, enabled FROM public.capture_devices WHERE id IN ('CAM-08', 'MIC-01') ORDER BY id");
    expect(rows).toEqual([
      { id: 'CAM-08', adapter_kind: 'LOCAL_DEVICE', enabled: false },
      { id: 'MIC-01', adapter_kind: 'FAKE', enabled: false },
    ]);
  });

  it('a new device through the same path is an INSERT that names its adapter kind', async () => {
    const before = await rehydrate(db.appPool());
    const template = before.captureDevices.devices.find((device) => device.id === 'MIC-02');
    if (template === undefined) throw new Error('the seed has no MIC-02');
    const added = { ...before, captureDevices: { devices: [...before.captureDevices.devices, { ...template, id: 'MIC-09', adapter: 'LOCAL_DEVICE' } as typeof template] } };
    expect(await writeThrough(before, added)).toBe(1);
    expect((await db.ownerPool().query("SELECT kind, adapter_kind FROM public.capture_devices WHERE id = 'MIC-09'")).rows).toEqual([{ kind: 'MIC', adapter_kind: 'LOCAL_DEVICE' }]);
  });

  it('the mapping refuses a slice that changes the adapter of an existing id, and nothing is written', async () => {
    const before = withDevice(await rehydrate(db.appPool()), 'CAM-08', { adapter: 'LOCAL_DEVICE' });
    expect(() => diffSlices(before, withDevice(before, 'CAM-08', { adapter: 'FAKE' }), Date.now())).toThrow(MappingError);
    expect((await db.ownerPool().query("SELECT adapter_kind FROM public.capture_devices WHERE id = 'CAM-08'")).rows).toEqual([{ adapter_kind: 'LOCAL_DEVICE' }]);
  });

  it('NEGATIVE CONTROL: the same UPSERT with adapter_kind or kind in its SET list fails 42501 as dems_app', async () => {
    const upsert = (column: string): string =>
      `INSERT INTO public.capture_devices (id, kind, transport, enabled, adapter_kind) VALUES ('CAM-07', 'CAMERA', 'ONVIF', true, 'ONVIF_RTSP')
       ON CONFLICT (id) DO UPDATE SET enabled = EXCLUDED.enabled, ${column} = EXCLUDED.${column}`;
    await expectRefused(() => db.appPool().query(upsert('adapter_kind')), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => db.appPool().query(upsert('kind')), SQLSTATE.insufficientPrivilege);
    await expectRefused(() => db.appPool().query("UPDATE public.capture_devices SET adapter_kind = 'FAKE' WHERE id = 'CAM-07'"), SQLSTATE.insufficientPrivilege);
    // Positive control: without the two columns the same statement is allowed.
    await db.appPool().query(
      `INSERT INTO public.capture_devices (id, kind, transport, enabled, adapter_kind) VALUES ('CAM-07', 'CAMERA', 'ONVIF', true, 'ONVIF_RTSP')
       ON CONFLICT (id) DO UPDATE SET enabled = EXCLUDED.enabled`,
    );
  });
});

// ═══ Moved here from `integration-d4.db.test.ts` (test-suite consolidation, D233): the cases as they were, under one describe. ═══
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
describe('F-82-3, F-82-4 (integration D4): a real seal, then a restart; the transport of a device the state holds none for', () => {
  const db = useFurtherDatabase(home, { template: 'seed', slug: 'd4map' });

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
        // Pass H-Y (wave H R, `sealedPackage`): this rig seals through the engine's door with a made-up manifest digest and writes
        // NO package, so the start reads the store, finds none, and says so on the item - the one member the restart adds. A
        // client then shows "no playable media" with the reason; the item states no sealed fact. CONTROL: no folder is there.
        expect(existsSync(sessionPackageDir(second.app.config.mediaStoreDir, sessionId))).toBe(false);
        expect(sealed !== undefined && 'sealedPackage' in sealed).toBe(false);
        expect(rehydrated).toEqual({ ...sealed, sealedPackage: 'NOT_READABLE' });
        // It replicates: the strict slice schema of the realtime channel and of ops 39 / 40 admits it.
        expect(EvidenceItemSchema.safeParse(rehydrated).success).toBe(true);
        // What is stored is what is committed - less the ONE member no column holds: `sealedPackage` is a sealed fact the
        // start puts on the REPLICATED item (`src/evidence-facts`, boot step `evidence.sealedFacts`), never a row's value.
        const committed = (): unknown[] => second.engine.slice('evidence').map((item) => (item.id === evidenceId ? Object.fromEntries(Object.entries(item).filter(([member]) => member !== 'sealedPackage')) : item));
        expect(second.engine.slice('evidence').filter((item) => 'sealedPackage' in item).map((item) => item.id)).toEqual([evidenceId]);
        expect((await storedSlices(owner)).evidence).toEqual(committed());
        // And the restarted engine still writes: a hosted command on the rehydrated state commits.
        await second.engine.setTabletLink('CONNECTED');
        expect((await storedSlices(owner)).evidence).toEqual(committed());
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
});
