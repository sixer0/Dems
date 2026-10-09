// The engine's upsert of a capture device never nulls what the engine state does not model
// (blueprint row 65; decisions D72(e), D72(l); pair-58 finding A-11): `mac`, `onvif_uuid`,
// `profiles` and `last_seen_at` are discovery and adoption columns. The mapping gives them their
// empty forms (`db/mapping/rows.ts` `captureDevicesToRows`), so a SET list that named them would
// blank a stored camera at its first ingest-state change.
//
// The rule itself lives in `db/store/store.ts` (row 129 is that file's owner, decision D95); this
// test is the adapter layer's, because adoption (row 142) stores these columns through it.
//
// The path is run AS THE RUNTIME ROLE on a throw-away database: the owner writes what an adoption
// stores, the engine's change of the camera's stream state is applied by `dems_app`, and the row
// is read back.
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { FIXED_NOW } from '../../../../test/support/seed';
import { diffSlices, fromRows, type DurableSlices } from '../../../db/mapping';
import { seedDatabase } from '../../../db/seed';
import { applyChanges, readStoredRows } from '../../../db/store/store';

const db = useTestDatabase({ template: 'schema' });

const DISCOVERED = { mac: 'AA:BB:CC:00:65:01', onvif_uuid: 'urn:uuid:6f1c2a9e-0065-4b7d-9c11-0000000000a1', profiles: ['H264_1080P25', 'H264_720P25'], last_seen_at: String(FIXED_NOW - 5_000) };
const COLUMNS = 'mac, onvif_uuid, profiles, last_seen_at::text AS last_seen_at, enabled, address, model, kind';

async function rehydrate(pool: Pool): Promise<DurableSlices> {
  return drizzle(pool).transaction(async (transaction) => fromRows(await readStoredRows(transaction)));
}
const stored = async (id: string): Promise<Record<string, unknown> | undefined> => (await db.ownerPool().query(`SELECT ${COLUMNS} FROM public.capture_devices WHERE id = $1`, [id])).rows[0];
/** The state with one device changed, as the engine's telemetry action leaves it. */
const withDevice = (state: DurableSlices, id: string, change: Partial<DurableSlices['captureDevices']['devices'][number]>): DurableSlices => ({
  ...state,
  captureDevices: { devices: state.captureDevices.devices.map((device) => (device.id === id ? { ...device, ...change } : device)) },
});

describe('the capture_devices upsert keeps the discovery columns (row 65)', () => {
  it('an ingest-state change of a camera leaves mac, onvif_uuid, profiles and last_seen_at as stored, and still writes what the engine models', async () => {
    await seedDatabase(db.ownerPool(), { now: FIXED_NOW, target: 'test' });
    // What discovery and adoption store (C3 §2.6 "What adoption stores"), written by the owner as a fixture.
    await db.ownerPool().query('UPDATE public.capture_devices SET mac = $1, onvif_uuid = $2, profiles = $3::jsonb, last_seen_at = $4 WHERE id = $5', [
      DISCOVERED.mac,
      DISCOVERED.onvif_uuid,
      JSON.stringify(DISCOVERED.profiles),
      DISCOVERED.last_seen_at,
      'CAM-01',
    ]);
    const before = await stored('CAM-01');
    expect(before).toMatchObject({ ...DISCOVERED, enabled: true });
    const untouched = await stored('CAM-02');

    const pool = db.appPool();
    const written = await rehydrate(pool);
    // The camera's ingest ends: the device goes offline and its stream is lost.
    const lost = withDevice(written, 'CAM-01', { online: false, streamState: 'LOST' });
    const changes = diffSlices(written, lost, FIXED_NOW + 1_000);
    expect(changes.filter((change) => change.table === 'captureDevices').map((change) => [change.op, change.op === 'insert' ? change.rows.map((row) => (row as { id: string }).id) : []])).toEqual([['insert', ['CAM-01']]]);
    await drizzle(pool).transaction((transaction) => applyChanges(transaction, changes));

    const after = await stored('CAM-01');
    // The engine's column moved ...
    expect(after?.['enabled']).toBe(false);
    // ... and the four it does not model are what the fixture stored (negative control: with the
    // four names in the SET list this is `{ mac: null, onvif_uuid: null, profiles: [], last_seen_at: null }`).
    expect({ mac: after?.['mac'], onvif_uuid: after?.['onvif_uuid'], profiles: after?.['profiles'], last_seen_at: after?.['last_seen_at'] }).toEqual(DISCOVERED);
    expect({ ...after, enabled: true }).toEqual(before);
    expect(await stored('CAM-02')).toEqual(untouched);

    // And back: the ingest returns, the same four stay, a second time.
    const back = withDevice(lost, 'CAM-01', { online: true, streamState: 'LIVE' });
    await drizzle(pool).transaction((transaction) => applyChanges(transaction, diffSlices(lost, back, FIXED_NOW + 2_000)));
    expect(await stored('CAM-01')).toEqual(before);
    // What the runtime role reads back is the engine's state.
    expect((await rehydrate(pool)).captureDevices).toEqual(back.captureDevices);
  });

  it('a new device is still inserted whole by the same statement', async () => {
    const pool = db.appPool();
    const written = await rehydrate(pool);
    const added: DurableSlices = {
      ...written,
      captureDevices: { devices: [...written.captureDevices.devices, { id: 'CAM-03', kind: 'CAMERA', model: 'Fixture camera', firmware: null, host: '127.0.0.1:8556', poePort: null, online: true, streamState: 'LIVE', capabilities: [] }] },
    };
    await drizzle(pool).transaction((transaction) => applyChanges(transaction, diffSlices(written, added, FIXED_NOW + 3_000)));
    expect(await stored('CAM-03')).toEqual({ mac: null, onvif_uuid: null, profiles: [], last_seen_at: null, enabled: true, address: '127.0.0.1:8556', model: 'Fixture camera', kind: 'CAMERA' });
  });
});
