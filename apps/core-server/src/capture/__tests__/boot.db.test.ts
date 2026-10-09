// The two units blueprint row 57 registered, on a SEEDED database as `dems_app` (capture spec §I
// edits 1 and 5): the capture-config boot step `capture.config` (row 52's, never run against
// PostgreSQL before this row mounted it) and the capture seam after a whole boot.
//
// WHY THIS FILE EXISTS. The first database run with the module mounted stopped EVERY boot at
// `capture.config` with `integer out of range`: the statement of the store cast the row's
// `updated_at` (epoch milliseconds) to a 32-bit integer. The cast is gone
// (`modules/capture-config/store.ts`); this test is that failing scenario, kept.
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../test/helpers/db';
import { captureLog, unitTestConfig, type CapturedLog } from '../../../test/support/config';
import { buildApp } from '../../app';
import { CAPTURE_CONFIG_BOOT_STEP, READ_CAPTURE_STATE, captureConfigControl } from '../../modules/capture-config';
import { CapturePhase } from '../index';

const db = useTestDatabase({ template: 'seed' });
let core: { app: ReturnType<typeof buildApp>; log: CapturedLog };
let owner: Pool;

beforeAll(async () => {
  owner = db.ownerPool();
  // The real app factory on the clone, as `dems_app`, with every unit registered.
  const log = captureLog();
  const app = buildApp({ config: unitTestConfig({ database: db.runtime, dataDir: db.run.dataDir, logLevel: 'info' }), logStream: log.stream });
  db.onCleanup(() => app.close());
  await app.ready();
  core = { app, log };
});

describe('the boot of a seeded database with the capture units registered', () => {
  it('CONTROL: the seeded selector row holds an instant no 32-bit integer holds, so the old cast must fail on it', async () => {
    const { rows } = await owner.query<{ updated_at: string }>('SELECT updated_at::text FROM public.capture_config');
    expect(rows).toHaveLength(1);
    expect(Number(rows[0]?.updated_at)).toBeGreaterThan(2 ** 31);
    // The statement as it was, on the same row: the very failure of the first run.
    const before = READ_CAPTURE_STATE.replace("'updatedAt', c.updated_at)", "'updatedAt', c.updated_at::int)");
    expect(before).not.toBe(READ_CAPTURE_STATE);
    await expect(owner.query(before)).rejects.toThrow('integer out of range');
  });

  it('the whole boot passes, the step capture.config among the steps, and the store holds the stored selector', async () => {
    await core.app.readiness.boot();
    const lines = core.log.lines();
    const passed = lines.filter((line) => line['msg'] === 'boot step passed').map((line) => line['step']);
    expect(passed).toContain(CAPTURE_CONFIG_BOOT_STEP);
    expect(lines.some((line) => line['msg'] === 'boot check failed')).toBe(false);
    expect(lines.find((line) => line['msg'] === 'capture-config store loaded')).toMatchObject({ code: 'CAPTURE_CONFIG_LOADED', locked: false });

    const snapshot = captureConfigControl(core.app).snapshot();
    const stored = (await owner.query<{ revision: string; updated_at: string; devices: string }>(
      'SELECT c.revision::text, c.updated_at::text, (SELECT count(*)::text FROM public.capture_devices) AS devices FROM public.capture_config c',
    )).rows[0];
    expect(snapshot.builtInBaseline).toBe(false);
    expect(snapshot.revision).toBe(Number(stored?.revision));
    expect(snapshot.captureDevices.devices).toHaveLength(Number(stored?.devices));
    // The instant arrives whole: the number the row holds, not a truncated one.
    expect(snapshot.captureConfig.updatedAt).toBe(Number(stored?.updated_at));
  });

  it('after the boot the capture seam is there and boots idle, with no worker', async () => {
    await core.app.capture.boot();
    expect(core.app.capture.status()).toMatchObject({ phase: CapturePhase.IDLE, sessionId: null, workerPid: null });
  });
});
