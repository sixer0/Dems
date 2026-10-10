// The fault key (kind, reason, device) on PostgreSQL as `dems_app` (controller ruling D146;
// database contract erratum PE-0013-01; migration 0013): what the engine stores of two causes on
// one device, what a process start reads back, and what a clear resolves afterwards.
//
// WHAT IS REAL: the app factory, the engine host, its write-through and its rehydrate, the tables.
// WHAT STANDS IN: the warnings are handed to the engine's INTERNAL doors by this file, as the
// capture forwarder hands them (`src/capture/__tests__/forwarder-engine.test.ts` proves that side
// from worker frames to the simulator).
import { FaultsSliceSchema } from '@dems/shared/api';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { SQLSTATE, expectRefused } from '../../../../test/db/support';
import { sessionsApp } from '../../../modules/sessions/__tests__/support';

const db = useTestDatabase({ template: 'seed', slug: 'faultkey' });
const roots: string[] = [];
afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

const STORED = `SELECT kind, target, reason, params->>'reason' AS params_reason, active FROM public.alerts WHERE target IN ('CAM-01', 'CAM-02', 'MIC-01') ORDER BY id`;

describe('the schema this test needs', () => {
  it('schema version 6, contract dbc-7: `alerts.reason` exists', async () => {
    const meta = (await db.ownerPool().query('SELECT schema_version, contract_revision FROM public.schema_meta')).rows[0] as { schema_version: number; contract_revision: string };
    expect([Number(meta.schema_version), meta.contract_revision]).toEqual([6, 'dbc-7']);
  });
});

describe('two causes on one device are two stored alerts, across a restart', () => {
  it('raise -> stored rows with the cause in its column -> restart reads both back -> a clear of one cause resolves that row alone', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'dems-fault-key-'));
    roots.push(dataDir);
    const target = await db.another({ template: 'seed', slug: 'faultkey_restart' });
    const server = await sessionsApp(target, dataDir);
    const owner = target.ownerPool();

    // One camera, two causes; a microphone with one cause and the rate advice; a fault without a cause.
    await server.engine.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-01', reason: 'CAMERA_STREAM_ENDED' } as never);
    await server.engine.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-01', reason: 'CAMERA_CLOCK_OUT_OF_BOUND' } as never);
    await server.engine.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'MIC-01', reason: 'MIC_DISCONNECTED' } as never);
    await server.engine.raiseCaptureWarning({ code: 'MIC_RATE_AT_LIMIT', subject: 'MIC-01' } as never);
    await server.engine.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-02' });
    // The same cause again: nothing is written.
    const revision = server.engine.revision;
    await server.engine.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-01', reason: 'CAMERA_STREAM_ENDED' } as never);
    expect(server.engine.revision).toBe(revision);

    const expected = [
      { kind: 'CAPTURE_FAULT', target: 'CAM-01', reason: 'CAMERA_STREAM_ENDED', params_reason: 'CAMERA_STREAM_ENDED', active: true },
      { kind: 'CAPTURE_FAULT', target: 'CAM-01', reason: 'CAMERA_CLOCK_OUT_OF_BOUND', params_reason: 'CAMERA_CLOCK_OUT_OF_BOUND', active: true },
      { kind: 'CAPTURE_FAULT', target: 'MIC-01', reason: 'MIC_DISCONNECTED', params_reason: 'MIC_DISCONNECTED', active: true },
      { kind: 'SYSTEM', target: 'MIC-01', reason: 'MIC_RATE_AT_LIMIT', params_reason: 'MIC_RATE_AT_LIMIT', active: true },
      { kind: 'CAPTURE_FAULT', target: 'CAM-02', reason: null, params_reason: null, active: true },
    ];
    expect((await owner.query(STORED)).rows).toEqual(expected);

    const faults = structuredClone(server.engine.slice('faults'));
    expect(faults.active.filter((fault) => fault.kind === 'CAPTURE_FAULT').map((fault) => [fault.target, fault.reason ?? null])).toEqual([
      ['CAM-01', 'CAMERA_STREAM_ENDED'],
      ['CAM-01', 'CAMERA_CLOCK_OUT_OF_BOUND'],
      ['MIC-01', 'MIC_DISCONNECTED'],
      ['CAM-02', null],
    ]);
    expect(FaultsSliceSchema.safeParse(faults).success).toBe(true);
    // The stored snapshot holds the same list, member for member.
    expect((await owner.query('SELECT faults FROM public.hardware_snapshot')).rows).toEqual([{ faults }]);
    const alerts = structuredClone(server.engine.slice('alerts'));

    // The cause of a stored alert is never changed: the runtime role holds no UPDATE on the column.
    await expectRefused(() => target.appPool().query("UPDATE public.alerts SET reason = 'CAMERA_NOT_CONNECTED' WHERE target = 'CAM-01'"), SQLSTATE.insufficientPrivilege);
    // CONTROL: the three life-cycle columns are writable (the grant of 0003), so the refusal above is the column's.
    expect((await target.appPool().query("UPDATE public.alerts SET acknowledged = acknowledged WHERE target = 'CAM-01'")).rowCount).toBe(2);

    // A process start: the faults and the alerts read back as they were, each cause its own.
    await server.app.close();
    const again = await sessionsApp(target, dataDir);
    expect(again.engine.slice('faults')).toEqual(faults);
    expect(again.engine.slice('alerts')).toEqual(alerts);

    // After the restart a clear that names its cause resolves that alert alone.
    await again.engine.clearCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-01', reason: 'CAMERA_STREAM_ENDED' } as never);
    expect((await owner.query(STORED)).rows).toEqual(expected.map((row) => (row.reason === 'CAMERA_STREAM_ENDED' ? { ...row, active: false } : row)));
    expect(again.engine.slice('faults').active.filter((fault) => fault.target === 'CAM-01').map((fault) => fault.reason)).toEqual(['CAMERA_CLOCK_OUT_OF_BOUND']);
    // The same cause on the same device is a NEW fault with a new row.
    await again.engine.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-01', reason: 'CAMERA_STREAM_ENDED' } as never);
    expect((await owner.query("SELECT count(*)::int AS rows FROM public.alerts WHERE target = 'CAM-01' AND reason = 'CAMERA_STREAM_ENDED'")).rows).toEqual([{ rows: 2 }]);
    // A clear without a cause resolves every cause on that device, and no other device's.
    await again.engine.clearCaptureWarning({ code: 'CAPTURE_FAULT', subject: 'CAM-01' });
    expect((await owner.query("SELECT target, count(*) FILTER (WHERE active)::int AS active FROM public.alerts WHERE kind = 'CAPTURE_FAULT' GROUP BY 1 ORDER BY 1")).rows).toEqual([
      { target: 'CAM-01', active: 0 },
      { target: 'CAM-02', active: 1 },
      { target: 'MIC-01', active: 1 },
    ]);
    await again.app.close();
  });

  it('a row older than migration 0013 (NULL in the column, the cause in params) is read at a process start as the alert it was', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'dems-fault-key-old-'));
    roots.push(dataDir);
    const target = await db.another({ template: 'seed', slug: 'faultkey_old' });
    const server = await sessionsApp(target, dataDir);
    await server.engine.raiseCaptureWarning({ code: 'CAPTURE_FAULT', subject: null, reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 } as never);
    const alerts = structuredClone(server.engine.slice('alerts'));
    const faults = structuredClone(server.engine.slice('faults'));
    await server.app.close();
    // What the row looked like before the column existed: the owner blanks it (the runtime role cannot).
    expect((await target.ownerPool().query("UPDATE public.alerts SET reason = NULL WHERE reason = 'NO_CAMERA_CONNECTED'")).rowCount).toBe(1);
    const again = await sessionsApp(target, dataDir);
    expect(again.engine.slice('alerts')).toEqual(alerts);
    expect(again.engine.slice('faults')).toEqual(faults);
    expect(again.engine.slice('alerts').at(-1)?.params).toMatchObject({ reason: 'NO_CAMERA_CONNECTED', evidenceFiles: 0 });
    await again.app.close();
  });
});
