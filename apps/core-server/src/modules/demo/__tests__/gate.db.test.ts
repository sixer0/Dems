// The gate of the demo controls against PostgreSQL and the real pipeline (plan row W43; spec
// §12.1 DC-1 to DC-3, SR-57, SR-68; AC-B-56 and the last sentence of AC-B-72; database contract
// HC-2, HC-3).
//
// Two servers on two clones of the seed, as `dems_app`, with EVERY stage as the server has it.
// Both are configured with a data directory of this test: a scratch directory that holds a file
// with the NAME of the owner connection file, empty and unreadable (mode 000). The real
// connection files of the project are not touched: the runtime connection of each app comes
// from the test helper, and the name of the owner file comes from the database commands.
//
//   flag OFF   the server starts and runs; the five operations answer 403 `DEMO_DISABLED` for the
//              SUPERVISOR and 403 `NOT_PERMITTED` with one `ACCESS_DENIED` row for the two other
//              roles; no handler runs, so nothing could have opened the owner file;
//   flag ON    a reset reaches the routine, which cannot read the owner file at R-0: 503, nothing
//              of the server was stopped, the next command works. And the routine as the SERVER
//              calls it refuses a database that is no project database, before any file is read.
//
// Every count is relative to the trail after the boot and the three sign-ins. No credential is
// printed.
import { accessSync, chmodSync, constants, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateCoreApiResponse } from '@dems/shared/api';
import type { AuditRow, OperatorRole } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { OWNER_FILE_NAME } from '../../../db/commands/owner-connection';
import { catalogOf, dropOwn, maintenancePool, resetApplicationName } from '../../../../test/support/reset';
import { demoControl } from '../index';
import { CALLS, FAULTS, RESET, SCENARIO, STATUS, demoApp, errorOf, outcome, testRoutine, trailOf, useRoutine, type DemoApp } from './support';

const db = useTestDatabase({ template: 'seed', slug: 'w43g' });

vi.setConfig({ testTimeout: 120_000, hookTimeout: 180_000 });

let scratch: string;
let ownerFile: string;
let maintenance: Pool;
let off: DemoApp;
let on: DemoApp;
let onName: string;
let routineAsked = 0;

beforeAll(async () => {
  // A data directory of this test: a file with the owner file's name that nobody can read.
  scratch = mkdtempSync(join(tmpdir(), 'dems-w43-data-'));
  ownerFile = join(scratch, OWNER_FILE_NAME);
  writeFileSync(ownerFile, '', { mode: 0o000 });
  chmodSync(ownerFile, 0o000);
  maintenance = maintenancePool(db.run.dataDir);

  off = await demoApp(db, { demoControls: false, dataDir: scratch });
  // Whatever reached the routine would be counted here: nothing must.
  useRoutine(off.app, async () => {
    routineAsked += 1;
    throw new Error('the routine must not be reached while the demo flag is off');
  });

  const second = await db.another({ slug: 'w43gon' });
  onName = second.name;
  on = await demoApp(second, { demoControls: true, dataDir: scratch });
});

afterAll(async () => {
  await off?.app.close();
  await on?.app.close();
  await db.database.closeResources();
  // A plain removal of this file's own databases, before the helper's forced one.
  for (const name of [db.name, onName].filter((name): name is string => typeof name === 'string')) await dropOwn(maintenance, name, db.run.identity.prefix);
  await maintenance?.end();
  if (scratch !== undefined) {
    chmodSync(ownerFile, 0o600);
    rmSync(scratch, { recursive: true, force: true });
  }
});

const denials = (rows: readonly AuditRow[]): AuditRow[] => rows.filter((row) => row.type === 'ACCESS_DENIED');

describe('AC-B-72: with the demo flag off the server starts and runs while the owner connection file is unreadable', () => {
  it('the file of the configured data directory exists and cannot be read; the server booted, is ready and serves', async () => {
    expect(off.app.config.dataDir).toBe(scratch);
    expect(off.app.config.demoControls).toBe(false);
    expect(statSync(ownerFile).mode & 0o777).toBe(0);
    expect(() => accessSync(ownerFile, constants.R_OK)).toThrow();

    expect(off.app.readiness.snapshot()).toEqual({ database: true, engine: true });
    expect(off.app.readiness.isReady()).toBe(true);
    expect(off.engine.running).toBe(true);
    const health = await off.get(null, '/api/v1/health');
    expect(health.statusCode).toBe(200);
    expect(health.json()).toMatchObject({ ready: { database: true, engine: true } });

    // It runs: a session answer (which tells the client that the flag is off, DC-3), ticks, a hosted command.
    const session = await off.get('SUPERVISOR', '/api/v1/auth/session');
    expect(session.statusCode).toBe(200);
    expect(session.json()).toMatchObject({ demoControls: false });
    await off.drive(1_000);
    const before = (await trailOf(db.ownerPool())).length;
    await off.app.engine.command(off.principal('TECHNICIAN'), 'runDiagnostics');
    expect((await trailOf(db.ownerPool())).length).toBeGreaterThan(before);
  });

  it('the pool of the running server is the runtime role, and so is every session it holds on its database', async () => {
    const who = await off.app.db.pool.query<{ role: string; superuser: boolean }>('SELECT current_user::text AS role, (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS superuser');
    expect(who.rows).toEqual([{ role: 'dems_app', superuser: false }]);
    const sessions = await maintenance.query<{ role: string; application: string }>(
      'SELECT DISTINCT usename::text AS role, application_name AS application FROM pg_stat_activity WHERE datname = $1 AND application_name = $2',
      [db.name, 'dems-core-server'],
    );
    expect(sessions.rows).toEqual([{ role: 'dems_app', application: 'dems-core-server' }]);
  });
});

describe('AC-B-56: with the demo flag off', () => {
  it('a SUPERVISOR gets 403 DEMO_DISABLED on all five: no audit row, one log line each, and no handler ran', async () => {
    const before = await trailOf(db.ownerPool());
    const linesBefore = off.log.lines().length;
    for (const entry of CALLS) {
      const response = await off.call('SUPERVISOR', entry);
      expect(outcome(response), entry.operationId).toEqual([403, 'DEMO_DISABLED']);
      expect(validateCoreApiResponse(entry.operationId, 403, response.json()), entry.operationId).toEqual({ ok: true });
      expect(response.headers['x-dems-epoch']).toBeUndefined();
    }
    await off.app.pipeline.drain();
    expect(await trailOf(db.ownerPool())).toHaveLength(before.length);
    const refused = off.log.lines().slice(linesBefore).filter((line) => line['msg'] === 'request refused by the access rule');
    expect(refused.map((line) => [line['operationId'], line['code'], line['audited'], line['principal']])).toEqual(CALLS.map((entry) => [entry.operationId, 'DEMO_DISABLED', false, 'operator:OPR-002']));
  });

  it.each(['INVESTIGATOR', 'TECHNICIAN'] as const satisfies readonly OperatorRole[])(
    'a %s gets 403 NOT_PERMITTED on all five, with exactly one ACCESS_DENIED row per call that names the operation, the permission and the role',
    async (role) => {
      const operatorId = off.principal(role).operatorId;
      for (const entry of CALLS) {
        const before = (await trailOf(db.ownerPool())).length;
        const response = await off.call(role, entry);
        expect(outcome(response), entry.operationId).toEqual([403, 'NOT_PERMITTED']);
        expect(errorOf(response).details).toMatchObject({ operationId: entry.operationId, permission: 'DEMO_CONTROL', role });
        expect(validateCoreApiResponse(entry.operationId, 403, response.json()), entry.operationId).toEqual({ ok: true });
        await off.app.pipeline.drain();
        const added = (await trailOf(db.ownerPool())).slice(before);
        expect(added.map((row) => row.type), entry.operationId).toEqual(['ACCESS_DENIED']);
        expect(denials(added)[0]).toMatchObject({ actorId: operatorId, details: { operationId: entry.operationId, permission: 'DEMO_CONTROL', role } });
      }
    },
  );

  it('nobody signed in: 401 NOT_SIGNED_IN on all five, and no row', async () => {
    const before = (await trailOf(db.ownerPool())).length;
    for (const entry of CALLS) {
      const response = await off.call(null, entry);
      expect(outcome(response), entry.operationId).toEqual([401, 'NOT_SIGNED_IN']);
      expect(validateCoreApiResponse(entry.operationId, 401, response.json())).toEqual({ ok: true });
    }
    await off.app.pipeline.drain();
    expect(await trailOf(db.ownerPool())).toHaveLength(before);
  });

  it('HC-2: the routine was never asked, nothing was held, the pool was never closed, the epoch did not move, and the server still serves', async () => {
    expect(routineAsked).toBe(0);
    expect(demoControl(off.app).resetInFlight).toBe(false);
    expect(off.log.lines().filter((line) => line['msg'] === 'readiness hold')).toEqual([]);
    expect(off.app.db.generation).toBe(1);
    expect(off.database.connections.pools).toBe(1);
    expect(off.engine.epoch).toBe(1);
    expect(off.app.readiness.isReady()).toBe(true);
    expect((await off.get('SUPERVISOR', '/api/v1/auth/session')).statusCode).toBe(200);
    // The unreadable file is as it was: nothing changed its mode, nothing wrote to the directory.
    expect(statSync(ownerFile).mode & 0o777).toBe(0);
    expect(statSync(ownerFile).size).toBe(0);
  });
});

describe('with the demo flag ON and the owner connection file unreadable', () => {
  it('the five operations are reachable for the SUPERVISOR; the read and the two faults work without the owner file', async () => {
    expect(on.app.config.demoControls).toBe(true);
    expect((await on.get('SUPERVISOR', '/api/v1/auth/session')).json()).toMatchObject({ demoControls: true });
    const status = await on.get('SUPERVISOR', STATUS);
    expect(status.statusCode).toBe(200);
    expect(validateCoreApiResponse('getDemoStatus', 200, status.json())).toEqual({ ok: true });
    expect(outcome(await on.post('SUPERVISOR', FAULTS, { kind: 'FAN_STALL' }))).toEqual([204, null]);
  });

  it('the routine as the SERVER calls it refuses a database that is no project database before it reads any file: 503, nothing stopped', async () => {
    // No routine was put in place for this app: this is the call of production, on a test clone.
    const catalog = await catalogOf(maintenance, [onName]);
    const linesBefore = on.log.lines().length;
    for (const [url, payload] of [
      [RESET, undefined],
      [SCENARIO, { name: 'recording' }],
    ] as const) {
      const response = await on.post('SUPERVISOR', url, payload);
      expect(outcome(response), url).toEqual([503, 'NOT_READY']);
      expect(errorOf(response).details).toEqual({ reason: 'RESET_FAILED' });
    }
    const lines = on.log.lines().slice(linesBefore);
    expect(lines.filter((line) => line['routineCode'] !== undefined).map((line) => [line['routineCode'], line['routineStep'], line['targetUntouched'], line['level']])).toEqual([
      ['RESET_TARGET_REFUSED', 'R-0', true, 40],
      ['RESET_TARGET_REFUSED', 'R-0', true, 40],
    ]);
    expect(lines.filter((line) => line['msg'] === 'readiness hold')).toEqual([]);
    expect(on.app.db.generation).toBe(1);
    expect(on.engine.running).toBe(true);
    expect(on.engine.epoch).toBe(1);
    // The database is the one it was.
    expect(await catalogOf(maintenance, [onName, `${onName}_next`, `${onName}_prev`])).toEqual(catalog);
  });

  it('a reset that reaches R-0 cannot read the owner file: 503, the routine\'s code is RESET_OWNER_CREDENTIALS, nothing was stopped, the next command works', async () => {
    const second = { name: onName, closeResources: async () => undefined };
    useRoutine(
      on.app,
      testRoutine(second, { runPrefix: db.run.identity.prefix, applicationName: resetApplicationName(db.run.identity.stamp, 'w43g'), maintenance }),
    );
    const catalog = await catalogOf(maintenance, [onName]);
    const linesBefore = on.log.lines().length;

    const response = await on.post('SUPERVISOR', RESET);
    expect(outcome(response)).toEqual([503, 'NOT_READY']);
    expect(errorOf(response).details).toEqual({ reason: 'RESET_FAILED' });
    expect(validateCoreApiResponse('resetDemo', 503, response.json())).toEqual({ ok: true });

    const lines = on.log.lines().slice(linesBefore);
    expect(lines.find((line) => line['routineCode'] !== undefined)).toMatchObject({ level: 40, msg: 'demo reset refused by the routine; nothing was stopped', routineCode: 'RESET_OWNER_CREDENTIALS', routineStep: 'R-0', targetUntouched: true, operatorId: 'OPR-002' });
    expect(lines.filter((line) => line['msg'] === 'readiness hold')).toEqual([]);
    expect(lines.filter((line) => line['msg'] === 'engine stopped')).toEqual([]);
    // Neither the answer nor the log names the file or its directory.
    expect(response.body).not.toContain(scratch);
    expect(on.log.text()).not.toContain(scratch);
    expect(on.log.text()).not.toContain(OWNER_FILE_NAME);

    expect(on.app.db.generation).toBe(1);
    expect(on.engine.running).toBe(true);
    expect(on.engine.epoch).toBe(1);
    expect(on.app.readiness.isReady()).toBe(true);
    expect(await catalogOf(maintenance, [onName, `${onName}_next`, `${onName}_prev`])).toEqual(catalog);
    expect(outcome(await on.post('SUPERVISOR', FAULTS, { kind: 'GNSS_LOSS' }))).toEqual([204, null]);
    expect((await on.get('SUPERVISOR', STATUS)).json()).toMatchObject({ epoch: 1, lastResetAt: null });
    // The server's own routine is back in place for whoever uses this app next.
    demoControl(on.app).replace();
  });
});
