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
import { useTestDatabase } from '../helpers/db';
import { SQLSTATE, expectRefused } from './support';

const db = useTestDatabase({ template: 'seed', slug: 'm4ups' });

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
    expect(before.captureDevices.devices.find((device) => device.id === 'CAM-07')).toMatchObject({ online: true, streamState: 'LIVE' });
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
    expect(await writeThrough(before, next)).toBe(1);
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
