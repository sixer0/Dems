// The two units blueprint row 57 registered, on a SEEDED database as `dems_app` (capture spec §I
// edits 1 and 5): the capture-config boot step `capture.config` (row 52's, never run against
// PostgreSQL before this row mounted it) and the capture seam after a whole boot.
//
// WHY THIS FILE EXISTS. The first database run with the module mounted stopped EVERY boot at
// `capture.config` with `integer out of range`: the statement of the store cast the row's
// `updated_at` (epoch milliseconds) to a 32-bit integer. The cast is gone
// (`modules/capture-config/store.ts`); this test is that failing scenario, kept.
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it, afterAll } from 'vitest';
import { useTestDatabase } from '../../../test/helpers/db';
import { captureLog, unitTestConfig, type CapturedLog } from '../../../test/support/config';
import { buildApp } from '../../app';
import { CAPTURE_CONFIG_BOOT_STEP, READ_CAPTURE_STATE, captureConfigControl } from '../../modules/capture-config';
import { CapturePhase } from '../index';
import { existsSync, readFileSync } from 'node:fs';
import { realBootFixture } from '../boot/__tests__/support';
import { BOOT_RESOLVED_NOTICE_REASONS, staleCaptureNoticesOf } from '../stale-notices';

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

// ═══ Moved here from `wave-h-f-boot-clear.db.test.ts` (test-suite consolidation, D233): the cases as they were, under one describe. ═══
// Wave H, driver F, item 2 (gate 64 condition C4; tidy pass F-Y decision 8), on PostgreSQL as
// `dems_app`, capture mode `real`: a RESTART on a throw-away database.
//
// A Core raises the notices of a running capture (advice about a camera clock, a microphone at its
// rate limit, the volume that did not take the full sync - the last one CRITICAL) and then DIES:
// nothing resolves them. The next Core on the same database finds them ACTIVE after its boot steps
// (that is the finding) and resolves them when the capture unit boots - before a client connects -
// and writes what it did. A notice that is no fact of a running capture (a camera a pre-check found
// unreachable) is NOT touched: the control.
//
// WHAT IS REAL: the app factory, its boot in REAL_DEVELOPMENT, the engine host and its store, the
// capture unit's own `boot()` (the seam the entry point calls). WHAT STANDS IN: the worker program
// (a script that says HELLO; no session is started here, so no worker is ever started for one).
describe('gate 64 C4: the notices of a capture that a dead Core left active, at the next boot (capture mode real)', () => {
  const fixture = realBootFixture('wave-h-f-clear');
  fixture.provisionKey();
  afterAll(() => fixture.remove());

  type Target = Awaited<ReturnType<typeof db.another>>;

  /** One Core on the target database: built, ready, its boot steps passed. The capture unit is NOT booted yet. */
  async function core(target: Target, name: string): Promise<{ app: ReturnType<typeof buildApp>; log: CapturedLog; errorLogFile: string }> {
    const log = captureLog();
    const errorLogFile = `${fixture.dataDir}/errors-${name}.log`;
    const app = buildApp({
      config: unitTestConfig({
        database: target.runtime,
        dataDir: fixture.dataDir,
        mediaStoreDir: fixture.mediaStoreDir,
        logLevel: 'info',
        captureMode: 'real',
        demoControls: false,
        captureDevSources: true,
        captureHelperFfmpegPath: '/bin/echo',
        captureWorkerPath: fixture.worker(`worker-${name}`),
      }),
      logStream: log.stream,
      errorLogFile,
    });
    await app.ready();
    app.seams.replace('publish', () => {});
    await app.readiness.boot();
    return { app, log, errorLogFile };
  }

  const activeNotices = (app: ReturnType<typeof buildApp>): string[] =>
    app.engine
      .state()
      .alerts.filter((alert) => alert.active && alert.kind === 'SYSTEM')
      .map((alert) => `${String(alert.params?.['reason'])}|${alert.target ?? ''}|${alert.severity}`)
      .sort();

  describe('the notices of a capture that a dead Core left active are resolved at boot', () => {
    it('a restart: three stale notices are active after the boot steps, and resolved by the boot of the capture unit; the pre-check notice stays', async () => {
      const target = await db.another({ template: 'seed', slug: 'whf_clear' });
      const owner: Pool = target.ownerPool();
      await owner.query('UPDATE public.stt_config SET enabled = false');

      // ── The first Core: it raises, then it dies (no session ends, nothing resolves) ──
      const first = await core(target, 'first');
      target.onCleanup(() => first.app.close());
      await first.app.capture.boot();
      const sessionId = 'SES-20261010-0901';
      await first.app.engine.raiseCaptureWarning({ code: 'CAMERA_CLOCK_OFFSET', subject: 'CAM-01', sessionId, offsetMs: 312 });
      await first.app.engine.raiseCaptureWarning({ code: 'MIC_RATE_AT_LIMIT', subject: 'MIC-01', sessionId });
      await first.app.engine.raiseCaptureWarning({ code: 'EVIDENCE_VOLUME_SYNC_NOT_FULL', subject: null, critical: true, syncLevel: 'FSYNC', sessionId });
      await first.app.engine.raiseCaptureWarning({ code: 'CAPTURE_DEVICE_UNREACHABLE', subject: 'CAM-02', phase: 'PRECHECK', cause: 'UNREACHABLE', degraded: true, sessionId });
      const raised = ['CAMERA_CLOCK_OFFSET|CAM-01|INFO', 'CAPTURE_DEVICE_UNREACHABLE|CAM-02|WARNING', 'EVIDENCE_VOLUME_SYNC_NOT_FULL|EVIDENCE_VOLUME|CRITICAL', 'MIC_RATE_AT_LIMIT|MIC-01|INFO'];
      expect(activeNotices(first.app)).toEqual(raised);
      await first.app.close();

      // ── The next Core on the same database ──
      const second = await core(target, 'second');
      target.onCleanup(() => second.app.close());
      // THE FINDING: after every boot step the notices of the dead Core are still active (one of them CRITICAL).
      expect(activeNotices(second.app)).toEqual(raised);
      expect(staleCaptureNoticesOf(second.app.engine.state().alerts).map((notice) => notice.code).sort()).toEqual(['CAMERA_CLOCK_OFFSET', 'EVIDENCE_VOLUME_SYNC_NOT_FULL', 'MIC_RATE_AT_LIMIT']);

      await second.app.capture.boot();

      // Resolved at boot, before a client connects. CONTROL: what a pre-check found is not a fact of a running capture - it stays.
      expect(activeNotices(second.app)).toEqual(['CAPTURE_DEVICE_UNREACHABLE|CAM-02|WARNING']);
      const stored = await owner.query<{ reason: string; active: boolean }>("SELECT reason, active FROM public.alerts WHERE kind = 'SYSTEM' ORDER BY reason");
      expect(stored.rows.filter((row) => BOOT_RESOLVED_NOTICE_REASONS.includes(row.reason)).map((row) => `${row.reason}:${row.active}`)).toEqual(['CAMERA_CLOCK_OFFSET:false', 'EVIDENCE_VOLUME_SYNC_NOT_FULL:false', 'MIC_RATE_AT_LIMIT:false']);
      expect(stored.rows.filter((row) => row.reason === 'CAPTURE_DEVICE_UNREACHABLE').map((row) => row.active)).toEqual([true]);

      // Said: one line of the log and one row of the persistent error log, with the count and the reasons (codes only).
      const line = second.log.lines().find((entry) => entry['code'] === 'CAPTURE_STALE_NOTICES_CLEARED');
      expect(line).toMatchObject({ cleared: 3, reasons: 'CAMERA_CLOCK_OFFSET,EVIDENCE_VOLUME_SYNC_NOT_FULL,MIC_RATE_AT_LIMIT' });
      const persisted = (existsSync(second.errorLogFile) ? readFileSync(second.errorLogFile, 'utf8') : '')
        .split('\n')
        .filter((text) => text !== '')
        .map((text) => JSON.parse(text) as { level: string; source: string; code?: string; context?: Record<string, unknown> })
        .filter((entry) => entry.code === 'CAPTURE_STALE_NOTICES_CLEARED');
      expect(persisted).toHaveLength(1);
      expect(persisted[0]).toMatchObject({ level: 'warn', source: 'capture.supervisor', context: { cleared: 3, reasons: 'CAMERA_CLOCK_OFFSET,EVIDENCE_VOLUME_SYNC_NOT_FULL,MIC_RATE_AT_LIMIT' } });

      // A condition that is still true is said AGAIN by the next reading: a NEW alert, not swallowed by the stale one.
      await second.app.engine.raiseCaptureWarning({ code: 'EVIDENCE_VOLUME_SYNC_NOT_FULL', subject: null, critical: true, syncLevel: 'FSYNC', sessionId: 'SES-20261010-0902' });
      const again = second.app.engine.state().alerts.filter((alert) => alert.params?.['reason'] === 'EVIDENCE_VOLUME_SYNC_NOT_FULL');
      expect(again.map((alert) => alert.active)).toEqual([false, true]);
      expect(new Set(again.map((alert) => alert.id)).size).toBe(2);
    });
  });
});
