// THE ENGINE DOOR OF A RE-ADDRESS, against PostgreSQL as `dems_app` (task 4 blueprint row 196,
// M8 / WP-12; the shared INTERNAL action of row 195; the seam `DeviceReaddresser` of
// `modules/capture-discovery/readdress.ts`; the model is the microphone door of row 190).
//
// `readdressCaptureDeviceIn(scope, { deviceId, address })` runs inside the CALLER's unit
// (`app.engine.run`). What this file holds it to:
//
//   1. TOGETHER: after a unit in which the door ran, the stored row (`capture_devices.address`)
//      and the running engine's `captureDevices` slice hold the new address - for a built-in
//      camera (the whole-row write) and for an adopted camera (the write of the one changed
//      column); nothing else of the row, of another device or of another slice moved; the audit
//      entry the caller wrote in the same unit is stored with it; ONE publication.
//   2. OR NOT AT ALL: a unit that throws AFTER the door leaves the row, the engine's state object
//      and every table as they were, and publishes nothing.
//   3. A refused input (a microphone, an unknown id, an address not of the stored form) rejects
//      with the mapped refusal and changes nothing; the address the camera already holds writes
//      nothing; a scope the host did not build has no door.
//   4. STATIC: no production statement of the Core server sets the `address` of `capture_devices`:
//      the engine's typed writer is the one writer of that column.
//
// No process, no port, no device: the addresses below are texts in a table. The door asks no
// destination rule (the caller does): it stores what it is told, and case 1 says so.
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AuditType, Permission, type CaptureDeviceStatus } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../test/helpers/db';
import { readHead, readTrail, verifyTrail } from '../../../test/support/core';
import { tableChecksums, withoutNegativeZeros } from '../../../test/support/seed';
import { ApiFailure } from '../../plugins/error-envelope';
import { readdressCaptureDeviceIn, registerCaptureDeviceIn, type EngineUnit } from '../index';
import { engineApp, stateChanges, storedSlices, type EngineApp } from './support';

const db = useTestDatabase({ template: 'seed' });

interface Booted extends EngineApp {
  readonly owner: Pool;
}

/** A process start on a fresh clone of the seed. */
async function booted(slug: string): Promise<Booted> {
  const target = await db.another({ template: 'seed', slug });
  const host = await engineApp(target, db.run.dataDir);
  await host.app.readiness.boot();
  return { ...host, owner: target.ownerPool() };
}

async function rejection(work: Promise<unknown>): Promise<unknown> {
  return work.then(
    () => {
      throw new Error('the promise resolved; a rejection was expected');
    },
    (error: unknown) => error,
  );
}

type StoredRow = Record<string, unknown>;
const storedDevice = async (pool: Pool, id: string): Promise<StoredRow> => {
  const { rows } = await pool.query<StoredRow>('SELECT * FROM public.capture_devices WHERE id = $1', [id]);
  if (rows.length !== 1 || rows[0] === undefined) throw new Error(`capture_devices holds ${rows.length} rows of ${id}`);
  return rows[0];
};
const storedDevices = async (pool: Pool): Promise<StoredRow[]> => (await pool.query<StoredRow>('SELECT * FROM public.capture_devices ORDER BY id')).rows;
const deviceOf = (host: Booted, id: string): CaptureDeviceStatus => {
  const found = host.engine.slice('captureDevices').devices.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`the engine holds no device ${id}`);
  return found;
};
const without = (row: StoredRow, ...columns: string[]): StoredRow => Object.fromEntries(Object.entries(row).filter(([column]) => !columns.includes(column)));

const BUILT_IN = 'CAM-01';
const ADOPTED = 'CAM-03';
const ADOPTED_OLD = '192.168.50.20';
const NEW_ADDRESS = '192.168.50.41';
const NEW_ADDRESS_WITH_PORT = '192.168.50.42:8080';

/** An adopted camera, registered through the engine's own door as operation 96 does: the state holds no transport for it. */
async function adopt(host: Booted): Promise<void> {
  await host.engine.run('test.adopt', async (scope) => {
    await registerCaptureDeviceIn(scope, { id: ADOPTED, model: 'Test camera', host: ADOPTED_OLD, adapter: 'ONVIF_RTSP' });
  });
  expect(deviceOf(host, ADOPTED).host).toBe(ADOPTED_OLD);
  expect((await storedDevice(host.owner, ADOPTED))['address']).toBe(ADOPTED_OLD);
}

describe('row 196: the engine door of a re-address', () => {
  it('TOGETHER: after the door ran in a unit, the device row and the slice hold the new address, with the audit entry of that unit; nothing else moved', async () => {
    const host = await booted('r196_together');
    await adopt(host);
    const technician = host.principal('TECHNICIAN');
    const builtInBefore = deviceOf(host, BUILT_IN);
    const fromBuiltIn = builtInBefore.host;
    expect(fromBuiltIn).toBe('127.0.0.1:8554');

    for (const [deviceId, address, from] of [
      [ADOPTED, NEW_ADDRESS, ADOPTED_OLD],
      [BUILT_IN, NEW_ADDRESS_WITH_PORT, fromBuiltIn],
    ] as const) {
      const rowsBefore = await storedDevices(host.owner);
      const stateBefore = host.engine.state();
      const head = await readHead(host.owner);
      const published = stateChanges(host.publications).length;
      const revision = host.engine.revision;

      const outcome = await host.engine.run('test.readdress', async (scope) => {
        const readdressed = await readdressCaptureDeviceIn(scope, { deviceId, address });
        // Inside the unit: the pending state holds it, a reader of the committed state does not yet.
        expect(scope.pending().captureDevices.devices.find((entry) => entry.id === deviceId)?.host).toBe(address);
        expect(deviceOf(host, deviceId).host).toBe(from);
        await scope.unit.audit.append({
          type: AuditType.CAPTURE_DEVICE_ADDRESS_CHANGED,
          message: 'Camera address changed',
          actorId: technician.operatorId,
          deviceId,
          details: { deviceId, fromAddress: String(from).split(':')[0] ?? '', toAddress: address.split(':')[0] ?? '', reason: 'OPERATOR_CONFIRMED', permission: Permission.CAPTURE_CONFIG },
        });
        return readdressed;
      });

      // The door's answer, the slice and the row: one address.
      expect(outcome.value).toMatchObject({ id: deviceId, host: address });
      expect(outcome.revision).toBe(revision + 1);
      expect(deviceOf(host, deviceId).host).toBe(address);
      expect((await storedDevice(host.owner, deviceId))['address']).toBe(address);
      // The stored registry IS the engine's registry (what a restart would read). By id: the tables hold no order
      // of adoption, so the read-back lists an adopted camera among the cameras and the engine lists it last.
      const byId = (devices: readonly CaptureDeviceStatus[]): CaptureDeviceStatus[] => [...devices].sort((a, b) => a.id.localeCompare(b.id));
      const stored = await storedSlices(host.owner);
      expect(byId(stored.captureDevices.devices)).toStrictEqual(byId(withoutNegativeZeros(host.engine.state()).captureDevices.devices));
      expect(stored.captureConfig).toStrictEqual(host.engine.state().captureConfig);

      // Nothing else of the device, no other device.
      const stateAfter = host.engine.state();
      const before = stateBefore.captureDevices.devices.find((entry) => entry.id === deviceId);
      expect(deviceOf(host, deviceId)).toEqual({ ...before, host: address });
      for (const other of stateBefore.captureDevices.devices.filter((entry) => entry.id !== deviceId)) {
        expect(stateAfter.captureDevices.devices.find((entry) => entry.id === other.id), other.id).toBe(other);
      }
      expect(stateAfter.captureConfig).toBe(stateBefore.captureConfig);
      expect(stateAfter.session).toBe(stateBefore.session);
      const rowsAfter = await storedDevices(host.owner);
      expect(rowsAfter.map((row) => (row['id'] === deviceId ? without(row, 'address', 'updated_at') : row))).toEqual(rowsBefore.map((row) => (row['id'] === deviceId ? without(row, 'address', 'updated_at') : row)));

      // ONE audit entry, the caller's, in the same commit; ONE publication; the chain verifies.
      const trail = await readTrail(host.owner);
      expect(trail.filter((row) => row.seq > head.seq).map((row) => row.type)).toEqual(['CAPTURE_DEVICE_ADDRESS_CHANGED']);
      expect(verifyTrail(trail, await readHead(host.owner))).toMatchObject({ ok: true });
      expect(stateChanges(host.publications)).toHaveLength(published + 1);
    }

    // The door asks no destination rule: it stores what the caller hands it (the caller's rule stands in front).
    await host.engine.run('test.readdress.loopback', async (scope) => {
      await readdressCaptureDeviceIn(scope, { deviceId: ADOPTED, address: '127.0.0.1' });
    });
    expect(deviceOf(host, ADOPTED).host).toBe('127.0.0.1');
    expect((await storedDevice(host.owner, ADOPTED))['address']).toBe('127.0.0.1');
  });

  it('OR NOT AT ALL: a unit that fails after the door leaves the row and the slice at the old address, stores no audit entry and publishes nothing', async () => {
    const host = await booted('r196_rollback');
    await adopt(host);
    const technician = host.principal('TECHNICIAN');

    for (const deviceId of [ADOPTED, BUILT_IN]) {
      const committed = host.engine.state();
      const from = deviceOf(host, deviceId).host;
      const head = await readHead(host.owner);
      const checksums = await tableChecksums(host.owner);
      const published = host.publications.length;

      const failure = new ApiFailure(409, 'INVALID_STATE', 'A refusal of the module, after the door.');
      const error = await rejection(
        host.engine.run('test.readdress.failed', async (scope) => {
          await readdressCaptureDeviceIn(scope, { deviceId, address: NEW_ADDRESS });
          expect(scope.pending().captureDevices.devices.find((entry) => entry.id === deviceId)?.host).toBe(NEW_ADDRESS);
          await scope.unit.audit.append({
            type: AuditType.CAPTURE_DEVICE_ADDRESS_CHANGED,
            message: 'Camera address changed',
            actorId: technician.operatorId,
            deviceId,
            details: { deviceId, fromAddress: '192.168.50.20', toAddress: NEW_ADDRESS, reason: 'OPERATOR_CONFIRMED', permission: Permission.CAPTURE_CONFIG },
          });
          throw failure;
        }),
      );
      expect(error).toBe(failure);
      // The engine is set back to the very state object it held; the tables are byte-equal.
      expect(host.engine.state()).toBe(committed);
      expect(deviceOf(host, deviceId).host).toBe(from);
      expect((await storedDevice(host.owner, deviceId))['address']).toBe(from);
      expect(await readHead(host.owner)).toEqual(head);
      expect(await tableChecksums(host.owner)).toEqual(checksums);
      expect(host.publications).toHaveLength(published);
    }

    // The engine is not left broken: the next unit re-addresses.
    await host.engine.run('test.readdress.next', async (scope) => {
      await readdressCaptureDeviceIn(scope, { deviceId: ADOPTED, address: NEW_ADDRESS });
    });
    expect(deviceOf(host, ADOPTED).host).toBe(NEW_ADDRESS);
    expect((await storedDevice(host.owner, ADOPTED))['address']).toBe(NEW_ADDRESS);
  });

  it('a refused input changes nothing; the address the camera holds writes nothing; a scope the host did not build has no door', async () => {
    const host = await booted('r196_refused');
    await adopt(host);
    const committed = host.engine.state();
    const checksums = await tableChecksums(host.owner);
    const published = host.publications.length;

    for (const change of [
      { deviceId: 'MIC-01', address: NEW_ADDRESS },
      { deviceId: 'CAM-99', address: NEW_ADDRESS },
      { deviceId: ADOPTED, address: '' },
      { deviceId: ADOPTED, address: 'http://192.168.50.41/onvif' },
      { deviceId: ADOPTED, address: 'admin:secret@192.168.50.41' },
      { deviceId: ADOPTED, address: '192.168.50.41 ' },
    ]) {
      const error = await rejection(host.engine.run('test.readdress.refused', (scope) => readdressCaptureDeviceIn(scope, change)));
      expect(error, JSON.stringify(change.deviceId)).toBeInstanceOf(ApiFailure);
      expect(error).toMatchObject({ code: 'INVALID_INPUT' });
      expect(host.engine.state()).toBe(committed);
    }
    expect(await tableChecksums(host.owner)).toEqual(checksums);
    expect(host.publications).toHaveLength(published);

    // The same address: the action answers the same state object, so no column is written.
    const row = await storedDevice(host.owner, ADOPTED);
    const same = await host.engine.run('test.readdress.same', (scope) => readdressCaptureDeviceIn(scope, { deviceId: ADOPTED, address: ADOPTED_OLD }));
    expect(same.value).toMatchObject({ id: ADOPTED, host: ADOPTED_OLD });
    expect(host.engine.state().captureDevices).toBe(committed.captureDevices);
    expect(await storedDevice(host.owner, ADOPTED)).toEqual(row);

    // A unit of the pipeline, or a test double: not a unit of the engine host.
    const notHosted = await rejection(readdressCaptureDeviceIn({} as EngineUnit, { deviceId: ADOPTED, address: NEW_ADDRESS }));
    expect(notHosted).toMatchObject({ code: 'ENGINE_ACTION_NOT_HOSTED' });
    expect(deviceOf(host, ADOPTED).host).toBe(ADOPTED_OLD);
  });
});

// ── Static: who writes a device address ────────────────────────────────────────────────────────

const SERVER_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

function productionSources(folder: string): Array<{ path: string; text: string }> {
  const found: Array<{ path: string; text: string }> = [];
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__' && entry.name !== 'node_modules' && entry.name !== 'migrations') walk(full);
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts') && !entry.name.endsWith('.test.ts')) {
        found.push({ path: relative(SERVER_ROOT, full).replaceAll('\\', '/'), text: readFileSync(full, 'utf8') });
      }
    }
  };
  walk(join(SERVER_ROOT, folder));
  return found.sort((a, b) => a.path.localeCompare(b.path));
}

const codeOf = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
/** Every statement text that changes rows of the registry, to its end: the closing quote of its literal or the next statement. */
const DEVICE_WRITE = /\b(?:UPDATE\s+(?:public\.)?capture_devices\s+SET|INSERT\s+INTO\s+(?:public\.)?capture_devices\b)[^;`]*?(?=\bWHERE\b|\bVALUES\b|\bRETURNING\b|;|`|$)/gis;
/** The statements of a source that write the registry AND name the column `address` in what they set or insert. */
function addressWriters(sources: ReadonlyArray<{ path: string; text: string }>): string[] {
  return sources.filter((source) => (codeOf(source.text).match(DEVICE_WRITE) ?? []).some((statement) => /\baddress\b/i.test(statement))).map((source) => source.path);
}
function deviceWriters(sources: ReadonlyArray<{ path: string; text: string }>): string[] {
  return sources.filter((source) => (codeOf(source.text).match(DEVICE_WRITE) ?? []).length > 0).map((source) => source.path);
}

describe('row 196, static: the engine is the one writer of a device address', () => {
  const sources = [...productionSources('src'), ...productionSources('cli')];

  it('the statements that write `capture_devices` outside the engine are the three known ones, and none of them names `address`: 0 new ones', () => {
    expect(sources.length).toBeGreaterThan(200);
    // The adoption's columns (row 132 / 51), the microphone registrar's (row 190), the fence's local-device row (row 136).
    expect(deviceWriters(sources)).toEqual(['src/capture/fence/statements.ts', 'src/modules/capture-discovery/adoption.ts', 'src/modules/capture-inputs/audio-cards/registrar.ts']);
    expect(addressWriters(sources)).toEqual([]);
    // The door itself holds no statement: the column goes through the engine's typed writer (`db/mapping`).
    const door = sources.filter((source) => source.path === 'src/engine/internal-actions.ts' || source.path === 'src/engine/host.ts');
    expect(door).toHaveLength(2);
    expect(deviceWriters(door)).toEqual([]);
  });

  it('CONTROL: a planted statement that sets the address, and one that inserts it, are each found; a comment and another column are not', () => {
    const planted = [
      { path: 'a.ts', text: "const SQL = 'UPDATE public.capture_devices SET address = $2 WHERE id = $1';" },
      { path: 'b.ts', text: "const SQL = 'update capture_devices set model = $2,\\n address = $3 where id = $1';" },
      { path: 'c.ts', text: "const SQL = 'INSERT INTO public.capture_devices (id, kind, address) VALUES ($1, $2, $3)';" },
      { path: 'd.ts', text: "const SQL = 'UPDATE public.capture_devices SET enabled = true WHERE address = $1';" },
      { path: 'e.ts', text: "// UPDATE public.capture_devices SET address = $2\nexport const a = 1;" },
      { path: 'f.ts', text: "const SQL = 'UPDATE public.capture_network_config SET address = $1';" },
    ];
    expect(addressWriters(planted)).toEqual(['a.ts', 'b.ts', 'c.ts']);
    expect(deviceWriters(planted)).toEqual(['a.ts', 'b.ts', 'c.ts', 'd.ts']);
  });
});
