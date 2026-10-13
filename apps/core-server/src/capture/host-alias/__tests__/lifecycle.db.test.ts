// The alias lifecycle on a booted Core, as `dems_app`, against PostgreSQL (task 4 row 106, WP-19b;
// schema set B `host_network_aliases`; audit types of rows 19 and V3; security item S13-10 (c)).
//
// WHAT IS REAL: the app factory with every stage, booted on a throw-away clone of the seed; the
// statements of `store.ts` as the runtime role (the grants of migration 0018, the two partial
// unique indexes, the CHECKs of the table); the engine's unit of work; THE AUDIT WRITER with its
// closed detail lists (`core/audit-details.ts`) and the chain.
//
// WHAT IS A STAND-IN, AND WHY (stated, not hidden):
//   the helper       A DOUBLE: a transport of this file that answers from a script. No socket, no
//                    process, no `ip` or other network command; no address of any host is read or
//                    changed. Proven on hardware: `9A/H-05`, `9A/H-06`.
//   the host's facts fixed values of this file (the interface `eth1`, a table of addresses).
//   the binding      `hostOf(app)` below is the binding the composition is ASKED to mount (request
//                    of row 106): this file builds it itself, because no production file does yet.
//   an open session  a flag of this file beside the engine's own state: no session is started here.
//   the timer        never fired here (`lifecycle.test.ts` fires it by hand).
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OPERATORS, isSessionActive, type AuditRow } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import { readTrail } from '../../../../test/support/core';
import { manualTimer } from '../../../../test/support/engine';
import { buildGuardApp, type GuardApp } from '../../../../test/support/guard';
import { engineControl } from '../../../engine';
import type { DestinationContext } from '../../destination-rule';
import {
  HELPER_CODES,
  createHostAliasLifecycle,
  createHostAliasStore,
  type HelperCodeName,
  type HostAliasActor,
  type HostAliasExchange,
  type HostAliasHost,
  type HostAliasLifecycle,
  type HostAliasStore,
  type HostAliasTransport,
} from '../index';

const db = useTestDatabase({ template: 'seed', slug: 'row106' });
const dataDir = mkdtempSync(join(tmpdir(), 'dems-row106-db-'));
const logDir = mkdtempSync(join(tmpdir(), 'dems-row106-log-'));

const TECHNICIAN = OPERATORS[2]!;
const ALIAS = '192.168.1.253';
const OTHER = '192.168.0.253';
const INTERFACE = 'eth1';
const ACTOR: HostAliasActor = { operatorId: TECHNICIAN.id, deviceId: null, operationId: 'scanFactoryCameras', permission: 'CAPTURE_COMMISSION' };
const NETWORK: DestinationContext = {
  cameraSubnet: { network: '192.168.100.0', prefixLength: 24 },
  cameraAddresses: [{ address: '192.168.100.1', alias: false }],
  otherInterfaceSubnets: [{ network: '10.20.0.0', prefixLength: 16 }],
  hostAddresses: ['10.20.0.5', '192.168.100.1'],
};
const pair = (name: HelperCodeName): HostAliasExchange => ({ kind: 'ANSWER', text: `${HELPER_CODES[name]} ${name}\n` });

let guard: GuardApp;
let owner: Pool;
let sessionFlag = false;
let network: DestinationContext = NETWORK;
const lines: string[] = [];
const answers: (HostAliasExchange | 'never')[] = [];
const reports: { code: string; facts: Record<string, unknown> }[] = [];

const transport: HostAliasTransport = {
  preflight: async () => null,
  exchange: async (line) => {
    lines.push(line);
    const next = answers.shift();
    if (next === undefined || next === 'never') return new Promise<HostAliasExchange>(() => undefined);
    return next;
  },
};

/** THE BINDING the composition is asked to mount: the Core's clock, engine, pool and audit chain as the lifecycle's host. */
function hostOf(app: GuardApp['app']): HostAliasHost {
  return {
    now: () => app.clock.now(),
    sessionOpen: () => sessionFlag || isSessionActive(app.engine.state().session),
    read: (label, work) => app.db.read(label, (pool) => work({ query: (text, values) => pool.query(text, values) })),
    async unit(label, work) {
      const outcome = await app.engine.run(label, (scope) =>
        work({
          db: { query: (text, values) => scope.unit.query(text, values) },
          sessionOpen: () => sessionFlag || isSessionActive(scope.pending().session),
          audit: async (entry) => {
            await scope.unit.audit.append(entry);
          },
        }),
      );
      return outcome.value;
    },
    report: (code, facts) => {
      reports.push({ code, facts: { ...facts } });
    },
  };
}

function lifecycle(store?: HostAliasStore): HostAliasLifecycle {
  return createHostAliasLifecycle({
    transport,
    host: hostOf(guard.app),
    sources: { network: () => network, storedInterface: () => INTERFACE, fileInterface: () => INTERFACE },
    timers: { after: () => () => undefined },
    ...(store === undefined ? {} : { store }),
  });
}

const trail = (): Promise<AuditRow[]> => readTrail(owner);
const since = async (from: number): Promise<AuditRow[]> => (await trail()).slice(from);
const typesOf = (rows: readonly AuditRow[]): string[] => rows.map((row) => `${row.type}${row.details['action'] === undefined ? '' : `:${String(row.details['action'])}`}`);
async function stored(): Promise<Record<string, unknown>[]> {
  const { rows } = await owner.query(
    'SELECT id, interface_name, address, reason, added_by, (expires_at - added_at)::int AS lifetime_ms, removed_at IS NULL AS open, remove_reason, removed_by, remove_error FROM public.host_network_aliases ORDER BY added_at, id',
  );
  return rows as Record<string, unknown>[];
}
const add = (life: HostAliasLifecycle, address = ALIAS) => life.acquire({ address, minutes: 30, reason: 'FACTORY_SCAN', actor: ACTOR });

beforeAll(async () => {
  owner = db.ownerPool();
  guard = buildGuardApp({ runtime: db.runtime, run: { dataDir }, onCleanup: (close) => db.onCleanup(close) }, { errorLogFile: join(logDir, 'errors.log'), logLevel: 'trace' });
  await guard.app.ready();
  engineControl(guard.app).useTimer(manualTimer().timer);
  await guard.app.readiness.boot();
  await engineControl(guard.app).idle();
});

afterAll(() => {
  rmSync(dataDir, { recursive: true, force: true });
  rmSync(logDir, { recursive: true, force: true });
});

describe('the alias lifecycle as the runtime role, on the real table and the real audit writer', () => {
  it('the Core of this file: the runtime role, an empty table, no alias in place', async () => {
    expect(((await guard.app.db.pool.query('SELECT current_user AS role')).rows[0] as { role: string }).role).toBe('dems_app');
    expect(await stored()).toEqual([]);
    await expect(lifecycle().state()).resolves.toBeNull();
  });

  it('acquire then release: the row is opened, dated and closed; exactly one intent and one result entry per action, each accepted by the audit writer', async () => {
    const from = (await trail()).length;
    answers.push(pair('OK'), pair('OK'));
    const life = lifecycle();
    const got = await add(life);
    expect(got).toMatchObject({ ok: true, alias: { address: ALIAS, reason: 'FACTORY_SCAN', removeError: null } });
    const aliasId = got.ok ? got.alias.aliasId : '';
    expect(await stored()).toEqual([{ id: aliasId, interface_name: INTERFACE, address: `${ALIAS}/24`, reason: 'FACTORY_SCAN', added_by: TECHNICIAN.id, lifetime_ms: 30 * 60_000, open: true, remove_reason: null, removed_by: null, remove_error: null }]);
    await expect(life.state()).resolves.toEqual(got.ok ? got.alias : null);

    await expect(life.release({ removeReason: 'JOB_DONE', actor: ACTOR })).resolves.toEqual({ ok: true, removed: true });
    expect(await stored()).toMatchObject([{ id: aliasId, open: false, remove_reason: 'JOB_DONE', removed_by: TECHNICIAN.id, remove_error: null }]);
    const rows = await since(from);
    expect(typesOf(rows)).toEqual(['HOST_ALIAS_REQUESTED:ADD', 'HOST_ALIAS_ADDED', 'HOST_ALIAS_REQUESTED:REMOVE', 'HOST_ALIAS_REMOVED']);
    expect(rows.map((row) => row.details)).toMatchObject([
      { action: 'ADD', address: ALIAS, reason: 'FACTORY_SCAN', minutes: 30, aliasId, operationId: 'scanFactoryCameras', permission: 'CAPTURE_COMMISSION' },
      { aliasId, address: ALIAS, reason: 'FACTORY_SCAN' },
      { action: 'REMOVE', address: ALIAS, removeReason: 'JOB_DONE', aliasId },
      { aliasId, address: ALIAS, removeReason: 'JOB_DONE' },
    ]);
    expect(rows.every((row) => row.actorId === TECHNICIAN.id)).toBe(true);
    // The interface is in the row and nowhere in the chain (SEC35-30).
    expect(JSON.stringify(rows)).not.toContain(INTERFACE);
    expect(lines).toEqual([`add ${ALIAS}/24 30\n`, `del ${ALIAS}/24\n`]);
  });

  it('an add the helper refuses: HOST_ALIAS_ADD_FAILED with the Core\'s code, the row closed; a removal that fails: the code on the open row, HOST_ALIAS_REMOVE_FAILED; then the removal that works', async () => {
    const from = (await trail()).length;
    // The clock of this Core stands still, so rows are told apart by their ids, not by their order.
    const known = new Set((await stored()).map((row) => row['id']));
    const fresh = async (): Promise<Record<string, unknown>[]> => (await stored()).filter((row) => !known.has(row['id']));
    answers.push(pair('ADDRESS_IN_USE'));
    const life = lifecycle();
    await expect(add(life)).resolves.toEqual({ ok: false, refusal: 'HELPER_ADDRESS_IN_USE', stillInPlace: false });
    expect(await fresh()).toMatchObject([{ address: `${ALIAS}/24`, open: false, remove_reason: 'NOT_ADDED', removed_by: null }]);
    for (const row of await fresh()) known.add(row['id']);

    answers.push(pair('OK'), pair('DEL_FAILED'), pair('OK'));
    await add(life, OTHER);
    await expect(life.release({ removeReason: 'MANUAL', actor: ACTOR })).resolves.toEqual({ ok: false, refusal: 'HELPER_DEL_FAILED', stillInPlace: true });
    expect(await fresh()).toMatchObject([{ address: `${OTHER}/24`, open: true, remove_error: 'HELPER_DEL_FAILED' }]);
    await expect(life.state()).resolves.toMatchObject({ address: OTHER, removeError: 'HELPER_DEL_FAILED' });
    await expect(life.release({ removeReason: 'MANUAL', actor: ACTOR })).resolves.toEqual({ ok: true, removed: true });
    expect(await fresh()).toMatchObject([{ open: false, remove_reason: 'MANUAL', removed_by: TECHNICIAN.id, remove_error: null }]);
    expect(typesOf(await since(from))).toEqual([
      'HOST_ALIAS_REQUESTED:ADD',
      'HOST_ALIAS_ADD_FAILED',
      'HOST_ALIAS_REQUESTED:ADD',
      'HOST_ALIAS_ADDED',
      'HOST_ALIAS_REQUESTED:REMOVE',
      'HOST_ALIAS_REMOVE_FAILED',
      'HOST_ALIAS_REQUESTED:REMOVE',
      'HOST_ALIAS_REMOVED',
    ]);
  });

  it('an add of UNKNOWN effect (an answer not of the table): the removal at once closes the row ADD_UNCONFIRMED with no operator, and the audit writer takes that reason (caution R119-05; schema version 13)', async () => {
    const from = (await trail()).length;
    const known = new Set((await stored()).map((row) => row['id']));
    answers.push({ kind: 'ANSWER', text: '0 OK and more\n' }, pair('OK'));
    await expect(add(lifecycle())).resolves.toEqual({ ok: false, refusal: 'HELPER_ANSWER_NOT_UNDERSTOOD', stillInPlace: false });
    expect((await stored()).filter((row) => !known.has(row['id']))).toMatchObject([{ address: `${ALIAS}/24`, open: false, remove_reason: 'ADD_UNCONFIRMED', removed_by: null, remove_error: null }]);
    const rows = await since(from);
    expect(typesOf(rows)).toEqual(['HOST_ALIAS_REQUESTED:ADD', 'HOST_ALIAS_ADD_FAILED', 'HOST_ALIAS_REQUESTED:REMOVE', 'HOST_ALIAS_REMOVED']);
    expect(rows.slice(2).map((row) => [row.actorId, row.details['removeReason']])).toEqual([[null, 'ADD_UNCONFIRMED'], [null, 'ADD_UNCONFIRMED']]);
  });

  it('with a session open every action of the technician is refused and writes 0: no row, no audit entry, no line', async () => {
    const before = [(await trail()).length, (await stored()).length, lines.length];
    sessionFlag = true;
    try {
      const life = lifecycle();
      await expect(add(life)).resolves.toEqual({ ok: false, refusal: 'SESSION_IS_OPEN', stillInPlace: false });
      await expect(life.release({ removeReason: 'MANUAL', actor: ACTOR })).resolves.toMatchObject({ ok: false, refusal: 'SESSION_IS_OPEN' });
    } finally {
      sessionFlag = false;
    }
    expect([(await trail()).length, (await stored()).length, lines.length]).toEqual(before);
  });

  it('one alias at a time BY THE TABLE: an intent that meets an open row commits nothing (the unit is rolled back) and nothing is sent', async () => {
    answers.push(pair('OK'));
    const life = lifecycle();
    await add(life);
    const before = [(await trail()).length, (await stored()).length, lines.length];
    // A lifecycle whose read sees none: only the index `host_network_aliases_one_open_key` stands.
    const real = createHostAliasStore();
    const blind = lifecycle({ ...real, readOpen: async () => [] });
    await expect(add(blind, OTHER)).resolves.toEqual({ ok: false, refusal: 'ALIAS_ALREADY_OPEN', stillInPlace: false });
    expect([(await trail()).length, (await stored()).length, lines.length]).toEqual(before);
    // Seen normally: refused before the intent.
    await expect(add(life, OTHER)).resolves.toEqual({ ok: false, refusal: 'ALIAS_ALREADY_OPEN', stillInPlace: true });
    answers.push(pair('OK'));
    await expect(life.release({ removeReason: 'JOB_DONE', actor: ACTOR })).resolves.toEqual({ ok: true, removed: true });
  });

  it('A CRASH BETWEEN INTENT AND RESULT: the intent and the open row are committed before the line; the next boot sweeps the row with BOOT_SWEEP and closes it', async () => {
    const from = (await trail()).length;
    const sent = lines.length;
    // The helper never answers and this lifecycle is dropped: the Core "died" after the line left.
    void add(lifecycle());
    await expect.poll(() => lines.length, { timeout: 5_000 }).toBe(sent + 1);
    expect(typesOf(await since(from))).toEqual(['HOST_ALIAS_REQUESTED:ADD']);
    const open = (await stored()).filter((row) => row['open'] === true);
    expect(open).toMatchObject([{ address: `${ALIAS}/24` }]);

    answers.push(pair('OK'));
    const report = await lifecycle().boot();
    expect(report).toEqual({ stateRead: true, interfaceTableRead: true, stillOpen: false, swept: [{ address: ALIAS, hadRow: true, attempted: true, effect: 'DONE', refusal: null, resultRecorded: true }] });
    expect(lines.slice(sent)).toEqual([`add ${ALIAS}/24 30\n`, `del ${ALIAS}/24\n`]);
    const rows = await since(from);
    expect(typesOf(rows)).toEqual(['HOST_ALIAS_REQUESTED:ADD', 'HOST_ALIAS_REQUESTED:REMOVE', 'HOST_ALIAS_REMOVED']);
    expect(rows.slice(1).map((row) => [row.actorId, row.details['removeReason'], row.details['aliasId']])).toEqual([
      [null, 'BOOT_SWEEP', open[0]?.['id']],
      [null, 'BOOT_SWEEP', open[0]?.['id']],
    ]);
    expect((await stored()).filter((row) => row['id'] === open[0]?.['id'])).toMatchObject([{ open: false, remove_reason: 'BOOT_SWEEP', removed_by: null }]);
  });

  // The gap row 106 pinned here is CLOSED (contract step V4, decision C74; request line `row V4 | agent 106b`): `aliasId` is
  // OPTIONAL on HOST_ALIAS_REMOVED and HOST_ALIAS_REMOVE_FAILED, so the audit writer admits the result of a row-less sweep.
  it('A MARKED ADDRESS WITHOUT A ROW is swept with a BOOT_SWEEP pair: the intent, then its result - neither names a row (step V4: `aliasId` is optional on the two removal results); nothing is reported', async () => {
    const from = (await trail()).length;
    const sent = lines.length;
    reports.length = 0;
    network = { ...NETWORK, cameraAddresses: [...NETWORK.cameraAddresses, { address: OTHER, alias: true }], hostAddresses: [...NETWORK.hostAddresses, OTHER] };
    try {
      answers.push(pair('OK'));
      const report = await lifecycle().boot();
      expect(lines.slice(sent)).toEqual([`del ${OTHER}/24\n`]);
      const rows = await since(from);
      expect(rows[0]).toMatchObject({ type: 'HOST_ALIAS_REQUESTED', actorId: null, details: { action: 'REMOVE', address: OTHER, removeReason: 'BOOT_SWEEP' } });
      expect('aliasId' in (rows[0]?.details ?? {})).toBe(false);
      // One result entry per action, also without a row: recorded, two entries, no report.
      expect(report.swept).toEqual([{ address: OTHER, hadRow: false, attempted: true, effect: 'DONE', refusal: null, resultRecorded: true }]);
      expect(typesOf(rows)).toEqual(['HOST_ALIAS_REQUESTED:REMOVE', 'HOST_ALIAS_REMOVED']);
      expect(rows[1]).toMatchObject({ type: 'HOST_ALIAS_REMOVED', actorId: null, details: { address: OTHER, removeReason: 'BOOT_SWEEP' } });
      expect('aliasId' in (rows[1]?.details ?? {})).toBe(false);
      expect(reports).toEqual([]);
    } finally {
      network = NETWORK;
    }
    expect((await stored()).filter((row) => row['open'] === true)).toEqual([]);
  });
});
