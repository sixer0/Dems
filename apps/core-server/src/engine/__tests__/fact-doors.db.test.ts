// The fact doors of the engine host on PostgreSQL as `dems_app` (integration pass D6, CS-09):
// `applyStorageVolume` carries measured figures of the evidence volume into slice `storage`.
// The transcript door is proven where operation 85 calls it (`modules/transcripts/__tests__/
// transcript-routes.db.test.ts`).
//
// WHAT IS REAL: the app factory, the engine host and its unit, the tables. WHAT STANDS IN: the
// figures are handed to the door by this file. The Core's boot check (row 61) that measures them is
// not called here - the one line that hands its outcome to this door is a request of pass D6.
import { StorageSliceSchema } from '@dems/shared/api';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../test/helpers/db';
import { sessionsApp } from '../../modules/sessions/__tests__/support';
import { factDoorsOf } from '../index';

const db = useTestDatabase({ template: 'seed', slug: 'd6facts' });
const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

const GB = 1_000_000_000;

describe('CS-09: the measured evidence volume in slice `storage`', () => {
  it('a boot that calls nothing shows the simulator\'s volume; the door sets total and used (= total - free) and the state; the system volume and the history stay; the figures survive a restart', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'dems-d6-facts-'));
    roots.push(dataDir);
    const target = await db.another({ template: 'seed', slug: 'd6facts_volume' });
    const server = await sessionsApp(target, dataDir);
    const evidenceOf = () => server.engine.slice('storage').volumes.find((volume) => volume.kind === 'EVIDENCE');
    const simulated = structuredClone(server.engine.slice('storage'));
    const simulatedEvidence = simulated.volumes.find((volume) => volume.kind === 'EVIDENCE');
    // CONTROL: capture operation SIMULATED, no call - the simulator's own 4 TB volume.
    expect(simulatedEvidence?.totalBytes).toBe(4_000 * GB);

    const doors = factDoorsOf(server.engine);
    const before = server.engine.revision;
    // Figures that are no measurement change nothing and write nothing.
    for (const bad of [{ totalBytes: 0, freeBytes: 0 }, { totalBytes: 100, freeBytes: 101 }, { totalBytes: -1, freeBytes: 0 }, { totalBytes: 1.5, freeBytes: 1 }, { totalBytes: Number.NaN, freeBytes: 1 }]) {
      expect((await doors.applyStorageVolume(bad)).value, JSON.stringify(bad)).toBe(false);
    }
    expect(server.engine.revision).toBe(before);
    expect(server.engine.slice('storage')).toEqual(simulated);

    // A 500 GB volume with 40 GB free: 92 % used.
    expect((await doors.applyStorageVolume({ totalBytes: 500 * GB, freeBytes: 40 * GB })).value).toBe(true);
    expect(evidenceOf()).toEqual({ ...simulatedEvidence, totalBytes: 500 * GB, usedBytes: 460 * GB });
    const measured = server.engine.slice('storage');
    expect(measured.state).not.toBe(simulated.state);
    expect(measured.volumes.find((volume) => volume.kind === 'SYSTEM')).toEqual(simulated.volumes.find((volume) => volume.kind === 'SYSTEM'));
    expect(measured.history).toEqual(simulated.history);
    expect(StorageSliceSchema.safeParse(measured).success).toBe(true);
    expect(server.engine.revision).toBeGreaterThan(before);
    // The same figures again: nothing to write.
    const after = server.engine.revision;
    expect((await doors.applyStorageVolume({ totalBytes: 500 * GB, freeBytes: 40 * GB })).value).toBe(false);
    expect(server.engine.revision).toBe(after);

    // A process start reads the figures back from the tables.
    await server.app.close();
    const again = await sessionsApp(target, dataDir);
    expect(again.engine.slice('storage').volumes.find((volume) => volume.kind === 'EVIDENCE')).toMatchObject({ totalBytes: 500 * GB, usedBytes: 460 * GB });
  });
});
