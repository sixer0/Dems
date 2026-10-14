// Task 4 row 106 (WP-19b): the alias lifecycle on doubles.
//
// THE HELPER IS A DOUBLE: a transport of this file that answers from a script and records the
// lines it was handed. No socket, no process, no `ip` or other network command, no host address
// read or changed. The database is a table of this file with a unit of work that rolls back; the
// real statements and the real audit writer are in `lifecycle.db.test.ts`. The timer is fired by
// hand beside a clock of this file.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { DestinationContext } from '../../destination-rule';
import {
  HELPER_CODES,
  HOST_ALIAS_REMOVE_RETRIES,
  HOST_ALIAS_REMOVE_RETRY_MS,
  HOST_ALIAS_SWEEP_CANDIDATES_MAX,
  REFUSED_WHILE_A_SESSION_IS_OPEN,
  aliasAddressesHeld,
  aliasCandidatesOfConfiguration,
  createHostAliasLifecycle,
  hostAliasFactsReaderOf,
  hostAliasInterfaceFileSourceOf,
  hostAliasJobPortOf,
  interfaceFileNameOf,
  type HelperCodeName,
  type HostAliasActor,
  type HostAliasAuditEntry,
  type HostAliasExchange,
  type HostAliasHost,
  type HostAliasLifecycle,
  type HostAliasQueryable,
  type HostAliasStore,
  type HostAliasTransport,
  type HostAliasTransportFailure,
} from '../index';
import { HOST_ALIAS_NOT_CONFIRMED_MESSAGES } from '../journal';

const HERE = dirname(fileURLToPath(import.meta.url));
const T0 = 1_760_000_000_000;
const ALIAS = '192.168.1.253';
const OTHER = '192.168.0.253';
const MINUTES = 30;
/** A text no entry, report or answer of the lifecycle may ever carry. */
const CANARY = 'eth9 /home/dems/.ssh hunter2';
const ACTOR: HostAliasActor = { operatorId: 'OP-0003', deviceId: null, operationId: 'scanFactoryCameras', permission: 'CAPTURE_COMMISSION' };
const NETWORK: DestinationContext = {
  cameraSubnet: { network: '192.168.100.0', prefixLength: 24 },
  cameraAddresses: [{ address: '192.168.100.1', alias: false }],
  otherInterfaceSubnets: [{ network: '10.20.0.0', prefixLength: 16 }],
  hostAddresses: ['10.20.0.5', '192.168.100.1'],
};

interface Row {
  id: string;
  interfaceName: string;
  address: string;
  reason: 'FACTORY_SCAN' | 'SET_CAMERA_ADDRESS';
  addedAt: number;
  addedBy: string;
  expiresAt: number;
  removedAt: number | null;
  removeReason: string | null;
  removedBy: string | null;
  removeError: string | null;
}
type Script = HostAliasExchange | 'throw' | 'never';
const pair = (name: HelperCodeName): HostAliasExchange => ({ kind: 'ANSWER', text: `${HELPER_CODES[name]} ${name}\n` });
const failed = (failure: HostAliasTransportFailure): HostAliasExchange => ({ kind: 'FAILED', failure });
const settle = async (): Promise<void> => {
  for (let turn = 0; turn < 20; turn += 1) await new Promise<void>((resolve) => setImmediate(resolve));
};

/** The database, the audit chain, the clock and the helper of one Core: they outlive a lifecycle (a restart makes a new one on them). */
function world() {
  const rows: Row[] = [];
  const audit: HostAliasAuditEntry[] = [];
  const events: string[] = [];
  const reports: { code: string; facts: Record<string, unknown> }[] = [];
  const lines: string[] = [];
  const answers: Script[] = [];
  const timers: { delayMs: number; callback: () => void; cancelled: boolean; fired: boolean }[] = [];
  const knobs = {
    now: T0,
    session: false,
    /** What a unit sees; null: the same as outside. */
    sessionInUnit: null as boolean | null,
    preflight: null as HostAliasTransportFailure | null,
    network: NETWORK as DestinationContext | null,
    storedInterface: 'eth1' as unknown,
    fileInterface: 'eth1' as unknown,
    readFails: false,
    /** A unit of this label fails after its work: nothing of it stays. */
    unitFails: null as string | null,
    /** The audit writer refuses an entry (the real writer's closed lists). */
    auditRefuses: null as ((entry: HostAliasAuditEntry) => boolean) | null,
    /** The lifecycle's read says "none open" although one is: only the table's index stands. */
    readSeesNone: false,
  };
  let made = 0;
  const open = (row: Row): boolean => row.removedAt === null;
  const db: HostAliasQueryable = { query: async () => ({ rows: [], rowCount: 0 }) };
  const store: HostAliasStore = {
    readOpen: async () => (knobs.readSeesNone ? [] : rows.filter(open).map((row) => ({ id: row.id, address: row.address, reason: row.reason, addedAt: row.addedAt, addedBy: row.addedBy, expiresAt: row.expiresAt, removeError: row.removeError }))),
    open: async (_db, opening) => {
      if (rows.some(open)) return null;
      made += 1;
      const id = `00000000-0000-4000-8000-${String(made).padStart(12, '0')}`;
      rows.push({ id, interfaceName: opening.interfaceName, address: opening.address, reason: opening.reason, addedAt: opening.now, addedBy: opening.operatorId, expiresAt: opening.expiresAt, removedAt: null, removeReason: null, removedBy: null, removeError: null });
      return id;
    },
    setExpiry: async (_db, id, expiresAt) => {
      const row = rows.find((entry) => entry.id === id && open(entry));
      if (row !== undefined) row.expiresAt = expiresAt;
      return row !== undefined;
    },
    close: async (_db, id, now, removeReason, removedBy) => {
      const row = rows.find((entry) => entry.id === id && open(entry));
      if (row !== undefined) Object.assign(row, { removedAt: now, removeReason, removedBy, removeError: null });
      return row !== undefined;
    },
    noteRemoveError: async (_db, id, code) => {
      const row = rows.find((entry) => entry.id === id && open(entry));
      if (row !== undefined) row.removeError = code;
      return row !== undefined;
    },
  };
  const host: HostAliasHost = {
    now: () => knobs.now,
    sessionOpen: () => knobs.session,
    read: async (_label, work) => {
      if (knobs.readFails) throw new Error(CANARY);
      return work(db);
    },
    unit: async (label, work) => {
      const rowsBefore = rows.map((row) => ({ ...row }));
      const auditBefore = audit.length;
      try {
        const value = await work({
          db,
          sessionOpen: () => knobs.sessionInUnit ?? knobs.session,
          audit: async (entry) => {
            if (knobs.auditRefuses?.(entry) === true) throw new Error(CANARY);
            audit.push(entry);
          },
        });
        if (knobs.unitFails === label) throw new Error(CANARY);
        events.push(`commit ${label} ${String(audit[audit.length - 1]?.type)}`);
        return value;
      } catch (error) {
        rows.splice(0, rows.length, ...rowsBefore);
        audit.length = auditBefore;
        throw error;
      }
    },
    report: (code, facts) => {
      reports.push({ code, facts: { ...facts } });
    },
  };
  const transport: HostAliasTransport = {
    preflight: async () => knobs.preflight,
    exchange: async (line) => {
      events.push(`line ${line.trim()}`);
      lines.push(line);
      const next = answers.shift();
      if (next === 'throw') throw new Error(CANARY);
      if (next === 'never' || next === undefined) return new Promise<HostAliasExchange>(() => undefined);
      return next;
    },
  };
  function lifecycle(configured?: readonly unknown[]): HostAliasLifecycle {
    return createHostAliasLifecycle({
      transport,
      host,
      store,
      sources: { network: () => knobs.network, storedInterface: () => knobs.storedInterface, fileInterface: async () => knobs.fileInterface },
      timers: {
        after(delayMs, callback) {
          const timer = { delayMs, callback, cancelled: false, fired: false };
          timers.push(timer);
          return () => {
            timer.cancelled = true;
          };
        },
      },
      ...(configured === undefined ? {} : { configuredCandidates: () => configured }),
    });
  }
  const armed = () => timers.filter((timer) => !timer.cancelled && !timer.fired);
  async function fire(): Promise<void> {
    const timer = armed()[0];
    if (timer === undefined) throw new Error('no timer is armed');
    timer.fired = true;
    timer.callback();
    await settle();
  }
  const types = (): string[] => audit.map((entry) => `${entry.type}${entry.details['action'] === undefined ? '' : `:${String(entry.details['action'])}`}`);
  const openRows = (): Row[] => rows.filter(open);
  const add = (life: HostAliasLifecycle, address: unknown = ALIAS, minutes: unknown = MINUTES) => life.acquire({ address, minutes, reason: 'FACTORY_SCAN', actor: ACTOR });
  return { rows, audit, events, reports, lines, answers, knobs, lifecycle, armed, fire, types, openRows, add };
}

describe('one alias, from the request to its removal', () => {
  it('acquire: the row is opened and the intent committed BEFORE the line is sent; one intent and one result entry; the lifetime timer is armed', async () => {
    const w = world();
    w.answers.push(pair('OK'));
    const life = w.lifecycle();
    const got = await w.add(life);
    expect(got).toEqual({ ok: true, alias: { aliasId: w.rows[0]?.id, address: ALIAS, reason: 'FACTORY_SCAN', addedAt: T0, expiresAt: T0 + MINUTES * 60_000, removeError: null } });
    expect(w.events).toEqual(['commit hostAlias.intent HOST_ALIAS_REQUESTED', `line add ${ALIAS}/24 ${String(MINUTES)}`, 'commit hostAlias.result HOST_ALIAS_ADDED']);
    expect(w.audit).toEqual([
      { type: 'HOST_ALIAS_REQUESTED', message: 'Alias address requested', actorId: 'OP-0003', deviceId: null, details: { action: 'ADD', address: ALIAS, reason: 'FACTORY_SCAN', minutes: MINUTES, aliasId: w.rows[0]?.id, operationId: 'scanFactoryCameras', permission: 'CAPTURE_COMMISSION' } },
      { type: 'HOST_ALIAS_ADDED', message: 'Alias address added', actorId: 'OP-0003', deviceId: null, details: { aliasId: w.rows[0]?.id, address: ALIAS, reason: 'FACTORY_SCAN', expiresAt: T0 + MINUTES * 60_000, operationId: 'scanFactoryCameras', permission: 'CAPTURE_COMMISSION' } },
    ]);
    expect(w.rows).toMatchObject([{ interfaceName: 'eth1', address: `${ALIAS}/24`, addedBy: 'OP-0003', removedAt: null }]);
    expect(w.armed().map((timer) => timer.delayMs)).toEqual([MINUTES * 60_000]);
    await expect(life.state()).resolves.toEqual(got.ok ? got.alias : null);
  });

  it('release at the end of a job: one intent, one result, the row closed with JOB_DONE, the timer dropped; a second release finds none and writes nothing', async () => {
    const w = world();
    w.answers.push(pair('OK'), pair('OK'));
    const life = w.lifecycle();
    await w.add(life);
    w.knobs.now = T0 + 5_000;
    await expect(life.release({ removeReason: 'JOB_DONE', actor: ACTOR })).resolves.toEqual({ ok: true, removed: true });
    expect(w.lines).toEqual([`add ${ALIAS}/24 ${String(MINUTES)}\n`, `del ${ALIAS}/24\n`]);
    expect(w.types()).toEqual(['HOST_ALIAS_REQUESTED:ADD', 'HOST_ALIAS_ADDED', 'HOST_ALIAS_REQUESTED:REMOVE', 'HOST_ALIAS_REMOVED']);
    expect(w.audit[2]?.details).toEqual({ action: 'REMOVE', address: ALIAS, removeReason: 'JOB_DONE', aliasId: w.rows[0]?.id, operationId: 'scanFactoryCameras', permission: 'CAPTURE_COMMISSION' });
    expect(w.audit[3]?.details).toEqual({ aliasId: w.rows[0]?.id, address: ALIAS, removeReason: 'JOB_DONE', operationId: 'scanFactoryCameras', permission: 'CAPTURE_COMMISSION' });
    expect(w.rows).toMatchObject([{ removedAt: T0 + 5_000, removeReason: 'JOB_DONE', removedBy: 'OP-0003', removeError: null }]);
    expect(w.armed()).toEqual([]);
    await expect(life.state()).resolves.toBeNull();
    await expect(life.release({ removeReason: 'MANUAL', actor: ACTOR })).resolves.toEqual({ ok: true, removed: false });
    expect([w.lines.length, w.audit.length]).toEqual([2, 4]);
  });

  it('the lifetime timer: at the stored end the helper is asked to remove, with EXPIRED and no operator', async () => {
    const w = world();
    w.answers.push(pair('OK'), pair('OK'));
    const life = w.lifecycle();
    await w.add(life);
    w.knobs.now = T0 + MINUTES * 60_000;
    await w.fire();
    expect(w.lines[1]).toBe(`del ${ALIAS}/24\n`);
    expect(w.audit.slice(2)).toMatchObject([
      { type: 'HOST_ALIAS_REQUESTED', actorId: null, details: { action: 'REMOVE', address: ALIAS, removeReason: 'EXPIRED', aliasId: w.rows[0]?.id } },
      { type: 'HOST_ALIAS_REMOVED', actorId: null, details: { aliasId: w.rows[0]?.id, address: ALIAS, removeReason: 'EXPIRED' } },
    ]);
    expect(w.rows).toMatchObject([{ removeReason: 'EXPIRED', removedBy: null }]);
    expect(w.armed()).toEqual([]);
  });

  it('the lifetime timer on a clock that reads EARLIER than the stored end (it went back): still EXPIRED, never a job done (caution R119-05)', async () => {
    const w = world();
    w.answers.push(pair('OK'), pair('OK'));
    const life = w.lifecycle();
    await w.add(life);
    w.knobs.now = T0 - 60_000;
    await w.fire();
    expect(w.audit.slice(2).map((entry) => [entry.type, entry.actorId, entry.details['removeReason']])).toEqual([
      ['HOST_ALIAS_REQUESTED', null, 'EXPIRED'],
      ['HOST_ALIAS_REMOVED', null, 'EXPIRED'],
    ]);
    expect(w.rows).toMatchObject([{ removeReason: 'EXPIRED', removedBy: null }]);
  });

  it('the retry of a FAILED removal keeps the reason and the actor of the removal it repeats: a technician\'s MANUAL stays MANUAL (caution R119-05)', async () => {
    const w = world();
    w.answers.push(pair('OK'), pair('DEL_FAILED'), pair('OK'));
    const life = w.lifecycle();
    await w.add(life);
    await expect(life.release({ removeReason: 'MANUAL', actor: ACTOR })).resolves.toEqual({ ok: false, refusal: 'HELPER_DEL_FAILED', stillInPlace: true });
    await w.fire();
    expect(w.audit.slice(2).map((entry) => [entry.type, entry.actorId, entry.details['removeReason']])).toEqual([
      ['HOST_ALIAS_REQUESTED', 'OP-0003', 'MANUAL'],
      ['HOST_ALIAS_REMOVE_FAILED', 'OP-0003', 'MANUAL'],
      ['HOST_ALIAS_REQUESTED', 'OP-0003', 'MANUAL'],
      ['HOST_ALIAS_REMOVED', 'OP-0003', 'MANUAL'],
    ]);
    expect(w.rows).toMatchObject([{ removeReason: 'MANUAL', removedBy: 'OP-0003', removeError: null }]);
    expect(w.armed()).toEqual([]);
  });

  // Row HA (caution R119c-01; decision C122): this case pinned `HOST_ALIAS_REMOVED` for a `NOT_MARKED` answer. The helper
  // removed nothing and does not say the address is gone, so the result entry is HOST_ALIAS_REMOVE_FAILED and the answer
  // carries `confirmed: false`. What row NF pinned below (the row closed with the reason of the call, by nobody) stands.
  it('a removal the helper answers NOT_MARKED: the row is closed, and the entry is NOT "removed"', async () => {
    const w = world();
    w.answers.push(pair('OK'), pair('NOT_MARKED'));
    const life = w.lifecycle();
    await w.add(life);
    await expect(life.release({ removeReason: 'JOB_DONE', actor: null })).resolves.toEqual({ ok: true, removed: true, confirmed: false });
    expect(w.types().slice(2)).toEqual(['HOST_ALIAS_REQUESTED:REMOVE', 'HOST_ALIAS_REMOVE_FAILED']);
    expect(w.openRows()).toEqual([]);
    // Row NF (review 120b T-7): the row is closed WITH THE REASON OF THE CALL and by nobody (no actor), and both entries
    // name that reason - "the row is closed" alone held the two entry types and nothing of what was written. SEEN RED on
    // the mutation `subject.removeReason` -> `'EXPIRED'` in the close of the row (journal.ts, `store.close(...)`).
    expect(w.rows).toMatchObject([{ removeReason: 'JOB_DONE', removedBy: null, removeError: null }]);
    expect(w.rows[0]?.removedAt).not.toBeNull();
    expect(w.audit.slice(2).map((entry) => [entry.type, entry.details['removeReason'], entry.details['aliasId']])).toEqual([
      ['HOST_ALIAS_REQUESTED', 'JOB_DONE', w.rows[0]?.id],
      ['HOST_ALIAS_REMOVE_FAILED', 'JOB_DONE', w.rows[0]?.id],
    ]);
  });

  it('a removal that fails: the code on the row, which stays open; one REMOVE_FAILED; a retry is armed, bounded, then reported', async () => {
    const w = world();
    w.answers.push(pair('OK'), pair('DEL_FAILED'));
    const life = w.lifecycle();
    await w.add(life);
    await expect(life.release({ removeReason: 'JOB_DONE', actor: ACTOR })).resolves.toEqual({ ok: false, refusal: 'HELPER_DEL_FAILED', stillInPlace: true });
    expect(w.types().slice(2)).toEqual(['HOST_ALIAS_REQUESTED:REMOVE', 'HOST_ALIAS_REMOVE_FAILED']);
    expect(w.audit[3]).toMatchObject({ severity: 'WARNING', details: { aliasId: w.rows[0]?.id, address: ALIAS, removeReason: 'JOB_DONE', failureReason: 'HELPER_DEL_FAILED' } });
    expect(w.openRows()).toMatchObject([{ removeError: 'HELPER_DEL_FAILED' }]);
    await expect(life.state()).resolves.toMatchObject({ removeError: 'HELPER_DEL_FAILED' });
    expect(w.armed().map((timer) => timer.delayMs)).toEqual([HOST_ALIAS_REMOVE_RETRY_MS]);
    // Every retry fails the same way: after the last one nothing is armed and the fact is reported once.
    for (let retry = 0; retry < HOST_ALIAS_REMOVE_RETRIES; retry += 1) {
      w.answers.push(failed('TIMED_OUT'));
      await w.fire();
    }
    expect(w.armed()).toEqual([]);
    expect(w.reports).toEqual([{ code: 'HOST_ALIAS_REMOVAL_GIVEN_UP', facts: { failureReason: 'HELPER_TIMED_OUT' } }]);
    expect(w.types().filter((type) => type === 'HOST_ALIAS_REMOVE_FAILED')).toHaveLength(1 + HOST_ALIAS_REMOVE_RETRIES);
    // A later release still works and clears the code.
    w.answers.push(pair('OK'));
    await expect(life.release({ removeReason: 'MANUAL', actor: ACTOR })).resolves.toEqual({ ok: true, removed: true });
    expect(w.rows).toMatchObject([{ removeReason: 'MANUAL', removeError: null }]);
  });
});

// Row HA (wave 12; caution R119c-01 of statement 119c; decisions C114 F-1 / F-9, C122). Since its row H5 the helper answers
// `NOT_MARKED` to a `del` when it cannot say the address is gone (no standing mark of its own while some interface may
// still hold the address). The Core's record must not say "removed" for that answer. THE HELPER IS THE DOUBLE of this file.
describe('a removal the helper answers NOT_MARKED is settled and NOT CONFIRMED: never recorded as removed (caution R119c-01)', () => {
  type Way = 'JOB_DONE' | 'MANUAL' | 'EXPIRED' | 'SHUTDOWN' | 'BOOT_SWEEP';
  type Held = 'not shown' | 'on another interface' | 'on the camera interface' | 'table unreadable';
  const WAYS: readonly Way[] = ['JOB_DONE', 'MANUAL', 'EXPIRED', 'SHUTDOWN', 'BOOT_SWEEP'];
  const HELD: Record<Held, { network: DestinationContext | null; held: boolean | null; severity: 'INFO' | 'WARNING'; message: string }> = {
    'not shown': { network: NETWORK, held: false, severity: 'INFO', message: HOST_ALIAS_NOT_CONFIRMED_MESSAGES.NOT_SHOWN },
    // THE CASE OF FINDING F-1: the address stays on an interface that is not the camera's.
    'on another interface': { network: { ...NETWORK, hostAddresses: [...NETWORK.hostAddresses, ALIAS] }, held: true, severity: 'WARNING', message: HOST_ALIAS_NOT_CONFIRMED_MESSAGES.HELD },
    'on the camera interface': { network: { ...NETWORK, cameraAddresses: [...NETWORK.cameraAddresses, { address: ALIAS, alias: true }] }, held: true, severity: 'WARNING', message: HOST_ALIAS_NOT_CONFIRMED_MESSAGES.HELD },
    'table unreadable': { network: null, held: null, severity: 'WARNING', message: HOST_ALIAS_NOT_CONFIRMED_MESSAGES.NOT_KNOWN },
  };
  /** An alias added and recorded as done, then taken away one of the five ways; the helper's answer to the `del` is `answer`. */
  async function removed(way: Way, answer: 'OK' | 'NOT_MARKED', network: DestinationContext | null) {
    const w = world();
    w.answers.push(pair('OK'));
    let life = w.lifecycle();
    await w.add(life);
    w.knobs.network = network;
    w.answers.push(pair(answer));
    let answered: unknown;
    if (way === 'JOB_DONE') answered = await life.release({ removeReason: 'JOB_DONE', actor: null });
    else if (way === 'MANUAL') answered = await life.release({ removeReason: 'MANUAL', actor: ACTOR });
    else if (way === 'SHUTDOWN') answered = await life.shutdown();
    else if (way === 'EXPIRED') await w.fire();
    else {
      // A restart: a new lifecycle on the same database and the same helper. Its sweep meets the open row.
      life = w.lifecycle();
      answered = await life.boot();
    }
    return { w, life, answered };
  }

  it.each(WAYS)('control, %s: answered `0 OK` the entry is HOST_ALIAS_REMOVED as before, the row closed, nothing reported, no `confirmed` in the answer', async (way) => {
    const { w, answered } = await removed(way, 'OK', HELD['on another interface'].network);
    expect(w.types()).toEqual(['HOST_ALIAS_REQUESTED:ADD', 'HOST_ALIAS_ADDED', 'HOST_ALIAS_REQUESTED:REMOVE', 'HOST_ALIAS_REMOVED']);
    expect(w.audit[3]).toMatchObject({ message: 'Alias address removed', details: { aliasId: w.rows[0]?.id, address: ALIAS, removeReason: way } });
    expect(w.audit[3]?.severity).toBeUndefined();
    expect(w.rows).toMatchObject([{ removeReason: way, removeError: null }]);
    expect(w.openRows()).toEqual([]);
    expect(w.reports).toEqual([]);
    if (way === 'JOB_DONE' || way === 'MANUAL' || way === 'SHUTDOWN') expect(answered).toEqual({ ok: true, removed: true });
  });

  // 5 ways x 4 readings of the Core's own table. SEEN RED (each mutation planted in the source, then taken out again):
  // The counts are failing tests of this FILE (99 tests), measured, one run per mutant.
  //   M1 journal.ts - `NOT_MARKED` with a row counted as removed again (the behaviour before row HA): 23 red - all 20 here.
  //   M2 journal.ts - the row NOT closed for `NOT_MARKED` (the code noted on the open row instead): 23 red - all 20 here.
  //   M3 lifecycle.ts - `settled` without `notMarked` (a retry armed, the caller refused): 23 red - all 20 here.
  //   M4 journal.ts - severity always INFO: 16 red (the 15 "held" and "unreadable" rows); always WARNING: 8 red (the 5 "not shown" rows).
  //   M5 lifecycle.ts - the report `HOST_ALIAS_REMOVAL_NOT_CONFIRMED` dropped: 16 red (the same 15 rows).
  //   M6 lifecycle.ts - `confirmed: false` left out of the answer: 13 red (the 12 rows of release and shutdown).
  //   M7 lifecycle.ts - `hostHolds` reading the camera interface only: 5 red, the "on another interface" rows (finding F-1's case).
  it.each(WAYS.flatMap((way) => (Object.keys(HELD) as Held[]).map((held) => [way, held] as const)))(
    '%s, the address %s: ONE intent and ONE result HOST_ALIAS_REMOVE_FAILED { HELPER_NOT_MARKED }; the row closed; no retry; the next add not held back',
    async (way, heldAs) => {
      const expected = HELD[heldAs];
      const { w, life, answered } = await removed(way, 'NOT_MARKED', expected.network);
      const aliasId = w.rows[0]?.id;
      const actor = way === 'MANUAL' ? { operationId: ACTOR.operationId, permission: ACTOR.permission } : {};

      // Exactly one intent and one result for the action, the intent committed before the line.
      expect(w.types()).toEqual(['HOST_ALIAS_REQUESTED:ADD', 'HOST_ALIAS_ADDED', 'HOST_ALIAS_REQUESTED:REMOVE', 'HOST_ALIAS_REMOVE_FAILED']);
      expect(w.events.slice(3)).toEqual(['commit hostAlias.intent HOST_ALIAS_REQUESTED', `line del ${ALIAS}/24`, 'commit hostAlias.result HOST_ALIAS_REMOVE_FAILED']);
      expect(w.audit[2]?.details).toEqual({ action: 'REMOVE', address: ALIAS, removeReason: way, aliasId, ...actor });
      // THE RESULT, whole: the type, the helper's code under the Core's name, and words that do not say "removed".
      expect(w.audit[3]).toEqual({
        type: 'HOST_ALIAS_REMOVE_FAILED',
        message: expected.message,
        severity: expected.severity,
        actorId: way === 'MANUAL' ? 'OP-0003' : null,
        deviceId: null,
        details: { aliasId, address: ALIAS, removeReason: way, failureReason: 'HELPER_NOT_MARKED', ...actor },
      });
      expect(w.audit.some((entry) => entry.type === 'HOST_ALIAS_REMOVED')).toBe(false);
      expect(w.audit[3]?.message).not.toMatch(/^Alias address removed|\bis gone\b|\bwas removed\b/);

      // The row is CLOSED with the reason the removal was asked with; no code stays on it; nothing is in place by the state.
      expect(w.rows).toMatchObject([{ removedAt: T0, removeReason: way, removedBy: way === 'MANUAL' ? 'OP-0003' : null, removeError: null }]);
      expect(w.openRows()).toEqual([]);
      await expect(life.state()).resolves.toBeNull();

      // No retry is armed and the helper is not asked again. (After a restart the one timer left in this file's list is
      // the lifetime timer of the lifecycle that "died": the new one armed none.)
      expect(w.armed().map((timer) => timer.delayMs)).toEqual(way === 'BOOT_SWEEP' ? [MINUTES * 60_000] : []);
      expect(w.lines).toEqual([`add ${ALIAS}/24 ${String(MINUTES)}\n`, `del ${ALIAS}/24\n`]);

      // What the caller is told: settled, and not confirmed.
      if (way === 'JOB_DONE' || way === 'MANUAL' || way === 'SHUTDOWN') expect(answered).toEqual({ ok: true, removed: true, confirmed: false });
      if (way === 'BOOT_SWEEP') {
        expect(answered).toEqual({ stateRead: true, interfaceTableRead: expected.network !== null, stillOpen: false, swept: [{ address: ALIAS, hadRow: true, attempted: true, effect: 'NOT_DONE', refusal: 'HELPER_NOT_MARKED', resultRecorded: true }] });
      }

      // Said in the persistent log when the Core's own table shows the address or cannot be read: a code, no address.
      expect(w.reports).toEqual(expected.held === false ? [] : [{ code: 'HOST_ALIAS_REMOVAL_NOT_CONFIRMED', facts: { removeReason: way, hadRow: true, heldByHost: expected.held } }]);
      expect(JSON.stringify(w.reports)).not.toContain(ALIAS);

      // THE NEXT ADD IS NOT HELD BACK (after a shutdown every add is refused, whatever the helper said).
      w.knobs.network = NETWORK;
      w.answers.push(pair('OK'));
      const next = await life.acquire({ address: OTHER, minutes: MINUTES, reason: 'FACTORY_SCAN', actor: ACTOR });
      if (way === 'SHUTDOWN') expect(next).toEqual({ ok: false, refusal: 'SHUTTING_DOWN', stillInPlace: false });
      else expect(next).toMatchObject({ ok: true, alias: { address: OTHER } });
    },
  );

  it('the lifetime timer: after NOT_MARKED nothing is armed - there is no timer left to fire', async () => {
    const { w } = await removed('EXPIRED', 'NOT_MARKED', HELD['on another interface'].network);
    await expect(w.fire()).rejects.toThrow('no timer is armed');
    expect(w.lines).toHaveLength(2);
  });

  // SEEN RED on M1 (the type: HOST_ALIAS_REMOVED) and on M3 (`stillInPlace: true`, a retry armed).
  it('after an add of UNKNOWN effect (lifecycle.ts, the removal at once): the row closes ADD_UNCONFIRMED (ruling F-9 of C114 stands) and the entry is not "removed"', async () => {
    const w = world();
    w.answers.push(failed('TIMED_OUT'), pair('NOT_MARKED'));
    const life = w.lifecycle();
    await expect(w.add(life)).resolves.toEqual({ ok: false, refusal: 'HELPER_TIMED_OUT', stillInPlace: false });
    expect(w.types()).toEqual(['HOST_ALIAS_REQUESTED:ADD', 'HOST_ALIAS_ADD_FAILED', 'HOST_ALIAS_REQUESTED:REMOVE', 'HOST_ALIAS_REMOVE_FAILED']);
    expect(w.audit[3]).toMatchObject({ severity: 'INFO', actorId: null, details: { aliasId: w.rows[0]?.id, address: ALIAS, removeReason: 'ADD_UNCONFIRMED', failureReason: 'HELPER_NOT_MARKED' } });
    expect(w.rows).toMatchObject([{ removeReason: 'ADD_UNCONFIRMED', removedBy: null, removeError: null }]);
    expect(w.openRows()).toEqual([]);
    expect(w.armed()).toEqual([]);
    w.answers.push(pair('OK'));
    await expect(w.add(life, OTHER)).resolves.toMatchObject({ ok: true });
  });

  // SEEN RED on M8 (lifecycle.ts: `notMarked` without `recorded`): the row was answered as settled with no result on record.
  it('a NOT_MARKED whose result entry cannot be written is NOT settled: the intent stands alone, the row stays open, it is reported and a retry is armed', async () => {
    const w = world();
    w.answers.push(pair('OK'), pair('NOT_MARKED'));
    const life = w.lifecycle();
    await w.add(life);
    w.knobs.auditRefuses = (entry) => entry.type === 'HOST_ALIAS_REMOVE_FAILED';
    await expect(life.release({ removeReason: 'JOB_DONE', actor: null })).resolves.toEqual({ ok: false, refusal: 'RESULT_NOT_RECORDED', stillInPlace: true });
    expect(w.types().slice(2)).toEqual(['HOST_ALIAS_REQUESTED:REMOVE']);
    expect(w.openRows()).toHaveLength(1);
    expect(w.reports).toEqual([{ code: 'HOST_ALIAS_RESULT_NOT_RECORDED', facts: { action: 'REMOVE', removeReason: 'JOB_DONE', hadRow: true } }]);
    expect(w.armed().map((timer) => timer.delayMs)).toEqual([HOST_ALIAS_REMOVE_RETRY_MS]);
  });

  // THE BOOT SWEEP WITHOUT A ROW follows the same rule. SEEN RED on M1r (journal.ts: a row-less `NOT_MARKED` written as
  // HOST_ALIAS_REMOVED; 2 red: this case and the configuration's candidates below), on M4 (both ways) and on M5.
  it('the boot sweep WITHOUT a row: `0 OK` is HOST_ALIAS_REMOVED; NOT_MARKED of an address the camera interface still holds is HOST_ALIAS_REMOVE_FAILED, a warning, reported; of one the table does not show, INFO and no report', async () => {
    const w = world();
    const THIRD = '192.168.2.253';
    w.knobs.network = { ...NETWORK, cameraAddresses: [...NETWORK.cameraAddresses, { address: ALIAS, alias: true }, { address: THIRD, alias: true }], hostAddresses: [...NETWORK.hostAddresses, ALIAS, THIRD] };
    w.answers.push(pair('NOT_MARKED'), pair('OK'), pair('NOT_MARKED'));
    const report = await w.lifecycle([OTHER]).boot();
    expect(report).toEqual({
      stateRead: true,
      interfaceTableRead: true,
      stillOpen: false,
      swept: [
        { address: ALIAS, hadRow: false, attempted: true, effect: 'NOT_DONE', refusal: 'HELPER_NOT_MARKED', resultRecorded: true },
        { address: THIRD, hadRow: false, attempted: true, effect: 'DONE', refusal: null, resultRecorded: true },
        { address: OTHER, hadRow: false, attempted: true, effect: 'NOT_DONE', refusal: 'HELPER_NOT_MARKED', resultRecorded: true },
      ],
    });
    // One intent and one result per address asked; no entry names a row.
    expect(w.types()).toEqual(['HOST_ALIAS_REQUESTED:REMOVE', 'HOST_ALIAS_REMOVE_FAILED', 'HOST_ALIAS_REQUESTED:REMOVE', 'HOST_ALIAS_REMOVED', 'HOST_ALIAS_REQUESTED:REMOVE', 'HOST_ALIAS_REMOVE_FAILED']);
    expect(w.audit.some((entry) => 'aliasId' in entry.details)).toBe(false);
    expect(w.audit[1]).toEqual({ type: 'HOST_ALIAS_REMOVE_FAILED', message: HOST_ALIAS_NOT_CONFIRMED_MESSAGES.HELD, severity: 'WARNING', actorId: null, deviceId: null, details: { address: ALIAS, removeReason: 'BOOT_SWEEP', failureReason: 'HELPER_NOT_MARKED' } });
    expect(w.audit[3]).toMatchObject({ type: 'HOST_ALIAS_REMOVED', message: 'Alias address removed', details: { address: THIRD, removeReason: 'BOOT_SWEEP' } });
    expect(w.audit[5]).toEqual({ type: 'HOST_ALIAS_REMOVE_FAILED', message: HOST_ALIAS_NOT_CONFIRMED_MESSAGES.NOT_SHOWN, severity: 'INFO', actorId: null, deviceId: null, details: { address: OTHER, removeReason: 'BOOT_SWEEP', failureReason: 'HELPER_NOT_MARKED' } });
    expect(w.reports).toEqual([{ code: 'HOST_ALIAS_REMOVAL_NOT_CONFIRMED', facts: { removeReason: 'BOOT_SWEEP', hadRow: false, heldByHost: true } }]);
    expect(w.rows).toEqual([]);
    expect(w.armed()).toEqual([]);
  });

  it('the words of the three entries: none says the address was removed or is gone; the two warnings name the kernel lifetime', () => {
    const words = Object.values(HOST_ALIAS_NOT_CONFIRMED_MESSAGES);
    expect(words).toHaveLength(3);
    for (const text of words) expect(text).not.toMatch(/^Alias address removed|\bis gone\b|\bwas removed\b|\bremoved the\b/);
    expect([HOST_ALIAS_NOT_CONFIRMED_MESSAGES.HELD, HOST_ALIAS_NOT_CONFIRMED_MESSAGES.NOT_KNOWN].every((text) => text.includes('kernel lifetime'))).toBe(true);
  });
});

describe('an add that did not add, or may have', () => {
  it('NOT_DONE (the helper refused): one ADD_FAILED with the Core\'s code, the row closed at once, no removal asked', async () => {
    const w = world();
    w.answers.push(pair('ADDRESS_IN_USE'));
    const life = w.lifecycle();
    await expect(w.add(life)).resolves.toEqual({ ok: false, refusal: 'HELPER_ADDRESS_IN_USE', stillInPlace: false });
    expect(w.lines).toHaveLength(1);
    expect(w.types()).toEqual(['HOST_ALIAS_REQUESTED:ADD', 'HOST_ALIAS_ADD_FAILED']);
    expect(w.audit[1]).toMatchObject({ severity: 'WARNING', details: { address: ALIAS, reason: 'FACTORY_SCAN', failureReason: 'HELPER_ADDRESS_IN_USE', aliasId: w.rows[0]?.id } });
    // The row says what happened: nothing was added (decision C74 D-3; `JOB_DONE` until schema version 12).
    expect(w.rows).toMatchObject([{ removedAt: T0, removeReason: 'NOT_ADDED', removedBy: null }]);
    expect(w.armed()).toEqual([]);
    // The next add is free to run.
    w.answers.push(pair('OK'));
    await expect(w.add(life)).resolves.toMatchObject({ ok: true });
  });

  it('a helper that already holds a mark the Core has no row of (ALIAS_LIMIT_REACHED) is reported', async () => {
    const w = world();
    w.answers.push(pair('ALIAS_LIMIT_REACHED'));
    await expect(w.add(w.lifecycle())).resolves.toEqual({ ok: false, refusal: 'HELPER_ALIAS_LIMIT_REACHED', stillInPlace: false });
    expect(w.reports).toEqual([{ code: 'HOST_ALIAS_UNRECORDED_MARK_SUSPECTED', facts: {} }]);
  });

  it.each([
    ['no answer inside the bound', failed('TIMED_OUT'), 'HELPER_TIMED_OUT'],
    ['the helper\'s tool did not answer', pair('ADD_FAILED'), 'HELPER_ADD_FAILED'],
    ['an answer that is not of the table', { kind: 'ANSWER', text: `0 OK ${CANARY}\n` } as HostAliasExchange, 'HELPER_ANSWER_NOT_UNDERSTOOD'],
    ['a transport that throws', 'throw' as const, 'HELPER_UNREACHABLE'],
  ])('UNKNOWN (%s) is POSSIBLY IN PLACE: the row stays open, a removal is attempted at once and its result recorded', async (_name, script, refusal) => {
    const w = world();
    w.answers.push(script, pair('OK'));
    await expect(w.add(w.lifecycle())).resolves.toEqual({ ok: false, refusal, stillInPlace: false });
    expect(w.lines).toEqual([`add ${ALIAS}/24 ${String(MINUTES)}\n`, `del ${ALIAS}/24\n`]);
    expect(w.types()).toEqual(['HOST_ALIAS_REQUESTED:ADD', 'HOST_ALIAS_ADD_FAILED', 'HOST_ALIAS_REQUESTED:REMOVE', 'HOST_ALIAS_REMOVED']);
    expect(w.audit[1]?.details).toMatchObject({ failureReason: refusal });
    // No job ran: the row and both entries of the removal say so (caution R119-05; `JOB_DONE` until schema version 13).
    expect(w.audit.slice(2).map((entry) => [entry.actorId, entry.details['removeReason']])).toEqual([[null, 'ADD_UNCONFIRMED'], [null, 'ADD_UNCONFIRMED']]);
    expect(w.rows).toMatchObject([{ removeReason: 'ADD_UNCONFIRMED', removedBy: null }]);
    expect(JSON.stringify([w.audit, w.reports, w.rows])).not.toContain('eth9');
    expect(JSON.stringify([w.audit, w.reports, w.rows])).not.toContain('hunter2');
  });

  it('UNKNOWN whose removal fails too: never recorded as absent - the row stays open with the code, the caller is told, a retry is armed', async () => {
    const w = world();
    w.answers.push(failed('CONNECTION_LOST'), failed('CONNECTION_LOST'));
    const life = w.lifecycle();
    await expect(w.add(life)).resolves.toEqual({ ok: false, refusal: 'HELPER_CONNECTION_LOST', stillInPlace: true });
    expect(w.types()).toEqual(['HOST_ALIAS_REQUESTED:ADD', 'HOST_ALIAS_ADD_FAILED', 'HOST_ALIAS_REQUESTED:REMOVE', 'HOST_ALIAS_REMOVE_FAILED']);
    expect(w.openRows()).toMatchObject([{ removeError: 'HELPER_CONNECTION_LOST' }]);
    expect(w.armed()).toHaveLength(1);
    await expect(w.add(life)).resolves.toEqual({ ok: false, refusal: 'ALIAS_ALREADY_OPEN', stillInPlace: true });
    // The retry repeats THAT removal: the clock has not moved, and the row does not close as a job done or a lifetime run out.
    w.answers.push(pair('OK'));
    await w.fire();
    expect(w.rows).toMatchObject([{ removeReason: 'ADD_UNCONFIRMED', removedBy: null, removeError: null }]);
  });

  it('a result entry that cannot be written: the intent stands alone, it is reported, and the address is taken away', async () => {
    const w = world();
    w.answers.push(pair('OK'), pair('OK'));
    w.knobs.auditRefuses = (entry) => entry.type === 'HOST_ALIAS_ADDED';
    await expect(w.add(w.lifecycle())).resolves.toEqual({ ok: false, refusal: 'RESULT_NOT_RECORDED', stillInPlace: false });
    expect(w.types()).toEqual(['HOST_ALIAS_REQUESTED:ADD', 'HOST_ALIAS_REQUESTED:REMOVE', 'HOST_ALIAS_REMOVED']);
    expect(w.reports).toEqual([{ code: 'HOST_ALIAS_RESULT_NOT_RECORDED', facts: { action: 'ADD' } }]);
    expect(w.openRows()).toEqual([]);
  });
});

describe('refused before anything is sent: 0 lines, 0 entries, 0 rows', () => {
  const nothing = (w: ReturnType<typeof world>): void => {
    expect([w.lines, w.audit, w.rows]).toEqual([[], [], []]);
  };

  it('a session is open: an add and the technician\'s removal are refused', async () => {
    const w = world();
    w.knobs.session = true;
    const life = w.lifecycle();
    await expect(w.add(life)).resolves.toEqual({ ok: false, refusal: 'SESSION_IS_OPEN', stillInPlace: false });
    await expect(life.release({ removeReason: 'MANUAL', actor: ACTOR })).resolves.toEqual({ ok: false, refusal: 'SESSION_IS_OPEN', stillInPlace: true });
    nothing(w);
    expect(REFUSED_WHILE_A_SESSION_IS_OPEN).toEqual(['ADD', 'MANUAL']);
  });

  it('a session that opens between the look and the intent is seen by the unit: nothing committed, nothing sent', async () => {
    const w = world();
    w.knobs.sessionInUnit = true;
    await expect(w.add(w.lifecycle())).resolves.toEqual({ ok: false, refusal: 'SESSION_IS_OPEN', stillInPlace: false });
    nothing(w);
  });

  it('with a session open the technician\'s removal of an alias in place writes nothing and sends nothing; the SYSTEM\'s removals still run (driver decision D-1)', async () => {
    const w = world();
    w.answers.push(pair('OK'), pair('OK'));
    const life = w.lifecycle();
    await w.add(life);
    w.knobs.session = true;
    const before = [w.lines.length, w.audit.length];
    await expect(life.release({ removeReason: 'MANUAL', actor: ACTOR })).resolves.toMatchObject({ ok: false, refusal: 'SESSION_IS_OPEN' });
    expect([w.lines.length, w.audit.length]).toEqual(before);
    expect(w.openRows()).toHaveLength(1);
    await expect(life.release({ removeReason: 'JOB_DONE', actor: ACTOR })).resolves.toEqual({ ok: true, removed: true });
  });

  it('one alias at a time: a second add while one is open; two adds at once - one runs, the other waits and is refused', async () => {
    const w = world();
    w.answers.push(pair('OK'));
    const life = w.lifecycle();
    const both = await Promise.all([w.add(life), w.add(life, OTHER)]);
    expect(both.map((got) => (got.ok ? 'ok' : got.refusal))).toEqual(['ok', 'ALIAS_ALREADY_OPEN']);
    expect(both[1]).toMatchObject({ stillInPlace: true });
    expect([w.lines.length, w.audit.length, w.rows.length]).toEqual([1, 2, 1]);
  });

  it('one alias at a time, by the table alone: when the read saw none, the intent finds the open row and nothing is sent', async () => {
    const w = world();
    w.answers.push(pair('OK'));
    const life = w.lifecycle();
    await w.add(life);
    w.knobs.readSeesNone = true;
    await expect(w.add(life, OTHER)).resolves.toEqual({ ok: false, refusal: 'ALIAS_ALREADY_OPEN', stillInPlace: false });
    expect([w.lines.length, w.audit.length, w.rows.length]).toEqual([1, 2, 1]);
  });

  it.each([
    ['this platform has no helper', { preflight: 'NOT_AVAILABLE_ON_THIS_PLATFORM' as const }, 'NOT_AVAILABLE_ON_THIS_PLATFORM'],
    ['no interface is chosen', { storedInterface: null }, 'NETWORK_NOT_CONFIGURED'],
    ['the interface file names another interface', { fileInterface: 'eth0' }, 'INTERFACE_FILE_DIFFERS_FROM_ROW'],
    ['the interface file cannot be read', { fileInterface: null }, 'INTERFACE_FILE_UNREADABLE'],
    ['the network facts are not known', { network: null }, 'HOST_FACTS_UNREADABLE'],
    ['the stored state cannot be read', { readFails: true }, 'STATE_UNREADABLE'],
    ['the intent cannot be committed', { unitFails: 'hostAlias.intent' }, 'INTENT_NOT_RECORDED'],
  ])('%s', async (_name, knobs, refusal) => {
    const w = world();
    Object.assign(w.knobs, knobs);
    await expect(w.add(w.lifecycle())).resolves.toEqual({ ok: false, refusal, stillInPlace: false });
    nothing(w);
  });

  it('a target /24 another interface holds; a bad address, lifetime, reason or actor', async () => {
    const w = world();
    const life = w.lifecycle();
    await expect(w.add(life, '10.20.9.253')).resolves.toMatchObject({ refusal: 'OTHER_INTERFACE_HOLDS_SUBNET' });
    await expect(w.add(life, '8.8.8.8')).resolves.toMatchObject({ refusal: 'ADDRESS_NOT_PRIVATE' });
    await expect(w.add(life, `${ALIAS}/24`)).resolves.toMatchObject({ refusal: 'ADDRESS_MALFORMED' });
    await expect(w.add(life, ALIAS, 481)).resolves.toMatchObject({ refusal: 'MINUTES_OUT_OF_RANGE' });
    await expect(life.acquire({ address: ALIAS, minutes: MINUTES, reason: 'EXPIRED' as never, actor: ACTOR })).resolves.toMatchObject({ refusal: 'REASON_NOT_OF_SET' });
    await expect(life.acquire({ address: ALIAS, minutes: MINUTES, reason: 'FACTORY_SCAN', actor: null as never })).resolves.toMatchObject({ refusal: 'ACTOR_NOT_STATED' });
    nothing(w);
  });
});

describe('shutdown', () => {
  it('removes the alias in place (no operator), drops the timer, and refuses every later add', async () => {
    const w = world();
    w.answers.push(pair('OK'), pair('OK'));
    const life = w.lifecycle();
    await w.add(life);
    await expect(life.shutdown()).resolves.toEqual({ ok: true, removed: true });
    expect(w.audit.slice(2)).toMatchObject([
      { type: 'HOST_ALIAS_REQUESTED', actorId: null, details: { action: 'REMOVE', removeReason: 'SHUTDOWN' } },
      { type: 'HOST_ALIAS_REMOVED', actorId: null, details: { removeReason: 'SHUTDOWN' } },
    ]);
    // The intent, the result and the row say what happened: the Core shut down, no job finished (decision C74 D-2).
    expect(w.rows).toMatchObject([{ removeReason: 'SHUTDOWN', removedBy: null }]);
    expect(w.openRows()).toEqual([]);
    expect(w.armed()).toEqual([]);
    await expect(w.add(life)).resolves.toEqual({ ok: false, refusal: 'SHUTTING_DOWN', stillInPlace: false });
    expect(w.lines).toHaveLength(2);
  });

  it('a removal that fails at shutdown leaves the row open for the next boot and arms nothing', async () => {
    const w = world();
    w.answers.push(pair('OK'), failed('TIMED_OUT'));
    const life = w.lifecycle();
    await w.add(life);
    await expect(life.shutdown()).resolves.toEqual({ ok: false, refusal: 'HELPER_TIMED_OUT', stillInPlace: true });
    expect(w.openRows()).toHaveLength(1);
    expect(w.armed()).toEqual([]);
  });

  it('with none in place: nothing is asked, nothing written', async () => {
    const w = world();
    await expect(w.lifecycle().shutdown()).resolves.toEqual({ ok: true, removed: false });
    expect([w.lines, w.audit]).toEqual([[], []]);
  });
});

describe('the boot sweep', () => {
  it('A CRASH BETWEEN INTENT AND RESULT: the next boot finds the intent without a result (an open row) and sweeps it', async () => {
    const w = world();
    // The Core "dies" while the helper is asked: the exchange never answers and this lifecycle is dropped.
    w.answers.push('never');
    void w.add(w.lifecycle());
    await settle();
    expect(w.types()).toEqual(['HOST_ALIAS_REQUESTED:ADD']);
    expect(w.openRows()).toHaveLength(1);
    expect(w.lines).toEqual([`add ${ALIAS}/24 ${String(MINUTES)}\n`]);

    // The next boot: a new lifecycle on the same database and the same helper.
    w.knobs.now = T0 + 90_000;
    w.answers.push(pair('OK'));
    const report = await w.lifecycle().boot();
    expect(report).toEqual({ stateRead: true, interfaceTableRead: true, stillOpen: false, swept: [{ address: ALIAS, hadRow: true, attempted: true, effect: 'DONE', refusal: null, resultRecorded: true }] });
    expect(w.lines[1]).toBe(`del ${ALIAS}/24\n`);
    expect(w.types()).toEqual(['HOST_ALIAS_REQUESTED:ADD', 'HOST_ALIAS_REQUESTED:REMOVE', 'HOST_ALIAS_REMOVED']);
    expect(w.audit[1]).toMatchObject({ actorId: null, details: { action: 'REMOVE', address: ALIAS, removeReason: 'BOOT_SWEEP', aliasId: w.rows[0]?.id } });
    expect(w.audit[2]?.details).toEqual({ aliasId: w.rows[0]?.id, address: ALIAS, removeReason: 'BOOT_SWEEP' });
    expect(w.rows).toMatchObject([{ removedAt: T0 + 90_000, removeReason: 'BOOT_SWEEP', removedBy: null }]);
  });

  it('an open row is closed after a restart, also when the kernel already took the address away (NOT_MARKED)', async () => {
    const w = world();
    w.answers.push(pair('OK'));
    await w.add(w.lifecycle());
    w.answers.push(pair('NOT_MARKED'));
    const report = await w.lifecycle().boot();
    expect(report.swept).toMatchObject([{ address: ALIAS, hadRow: true, refusal: 'HELPER_NOT_MARKED' }]);
    expect(w.openRows()).toEqual([]);
    expect(w.rows).toMatchObject([{ removeReason: 'BOOT_SWEEP' }]);
  });

  it('A MARKED ADDRESS WITHOUT A ROW: what the camera interface holds outside the camera subnet is swept with a BOOT_SWEEP entry', async () => {
    const w = world();
    w.knobs.network = { ...NETWORK, cameraAddresses: [...NETWORK.cameraAddresses, { address: ALIAS, alias: true }], hostAddresses: [...NETWORK.hostAddresses, ALIAS] };
    w.answers.push(pair('OK'));
    const report = await w.lifecycle().boot();
    expect(report).toEqual({ stateRead: true, interfaceTableRead: true, stillOpen: false, swept: [{ address: ALIAS, hadRow: false, attempted: true, effect: 'DONE', refusal: null, resultRecorded: true }] });
    expect(w.lines).toEqual([`del ${ALIAS}/24\n`]);
    expect(w.audit).toMatchObject([
      { type: 'HOST_ALIAS_REQUESTED', actorId: null, details: { action: 'REMOVE', address: ALIAS, removeReason: 'BOOT_SWEEP' } },
      { type: 'HOST_ALIAS_REMOVED', actorId: null, details: { address: ALIAS, removeReason: 'BOOT_SWEEP' } },
    ]);
    expect(w.audit.map((entry) => 'aliasId' in entry.details)).toEqual([false, false]);
    expect(w.rows).toEqual([]);
  });

  // Since contract step V4 (decision C74) the REAL writer admits a row-less result (`lifecycle.db.test.ts`). The case stays
  // for what it shows of the lifecycle: a result entry the writer refuses leaves the intent alone, flagged and reported.
  it('an audit writer that refuses the row-less result (as the vocabulary did before step V4): the intent stands alone and is reported', async () => {
    const w = world();
    w.knobs.network = { ...NETWORK, cameraAddresses: [{ address: ALIAS, alias: true }] };
    w.knobs.auditRefuses = (entry) => (entry.type === 'HOST_ALIAS_REMOVED' || entry.type === 'HOST_ALIAS_REMOVE_FAILED') && !('aliasId' in entry.details);
    w.answers.push(pair('OK'));
    const report = await w.lifecycle().boot();
    expect(report.swept).toEqual([{ address: ALIAS, hadRow: false, attempted: true, effect: 'DONE', refusal: null, resultRecorded: false }]);
    expect(w.types()).toEqual(['HOST_ALIAS_REQUESTED:REMOVE']);
    expect(w.reports).toEqual([{ code: 'HOST_ALIAS_RESULT_NOT_RECORDED', facts: { action: 'REMOVE', removeReason: 'BOOT_SWEEP', hadRow: false } }]);
  });

  it('the configuration\'s candidates are asked too, each once, never the address of a row twice; an address that was not ours is a recorded NOT_MARKED', async () => {
    const w = world();
    w.answers.push(pair('OK'));
    await w.add(w.lifecycle());
    w.answers.push(pair('OK'), pair('NOT_MARKED'));
    const candidates = aliasCandidatesOfConfiguration(['192.168.1.64', '192.168.1.108', '192.168.0.90', '192.168.1.13'], 253);
    expect(candidates).toEqual([ALIAS, OTHER]);
    const report = await w.lifecycle(candidates).boot();
    expect(report.swept).toEqual([
      { address: ALIAS, hadRow: true, attempted: true, effect: 'DONE', refusal: null, resultRecorded: true },
      { address: OTHER, hadRow: false, attempted: true, effect: 'NOT_DONE', refusal: 'HELPER_NOT_MARKED', resultRecorded: true },
    ]);
    expect(w.lines.slice(1)).toEqual([`del ${ALIAS}/24\n`, `del ${OTHER}/24\n`]);
    expect(w.audit[w.audit.length - 1]).toMatchObject({ type: 'HOST_ALIAS_REMOVE_FAILED', severity: 'INFO', details: { address: OTHER, removeReason: 'BOOT_SWEEP', failureReason: 'HELPER_NOT_MARKED' } });
  });

  it('a helper that cannot be reached: nothing is written, the row stays open, a retry is armed, and the next candidate is not asked', async () => {
    const w = world();
    w.answers.push(pair('OK'));
    await w.add(w.lifecycle());
    const before = w.audit.length;
    w.knobs.preflight = 'SOCKET_ABSENT';
    const report = await w.lifecycle([OTHER, '10.9.8.253']).boot();
    expect(report).toEqual({
      stateRead: true,
      interfaceTableRead: true,
      stillOpen: true,
      swept: [
        { address: ALIAS, hadRow: true, attempted: false, effect: 'NOT_DONE', refusal: 'HELPER_NOT_INSTALLED', resultRecorded: true },
        { address: OTHER, hadRow: false, attempted: false, effect: 'NOT_DONE', refusal: 'HELPER_NOT_INSTALLED', resultRecorded: true },
      ],
    });
    expect([w.audit.length, w.lines.length]).toEqual([before, 1]);
    expect(w.openRows()).toHaveLength(1);
    expect(w.armed().map((timer) => timer.delayMs)).toContain(HOST_ALIAS_REMOVE_RETRY_MS);
  });

  it('nothing stored, nothing held, nothing configured: the boot asks nothing and writes nothing; unknown facts are said', async () => {
    const w = world();
    await expect(w.lifecycle().boot()).resolves.toEqual({ stateRead: true, interfaceTableRead: true, stillOpen: false, swept: [] });
    w.knobs.network = null;
    await expect(w.lifecycle().boot()).resolves.toEqual({ stateRead: true, interfaceTableRead: false, stillOpen: false, swept: [] });
    w.knobs.readFails = true;
    await expect(w.lifecycle().boot()).resolves.toEqual({ stateRead: false, interfaceTableRead: false, stillOpen: true, swept: [] });
    expect([w.lines, w.audit]).toEqual([[], []]);
    expect(w.reports).toEqual([{ code: 'HOST_ALIAS_STATE_UNREADABLE', facts: {} }]);
  });
});

// Task 4 row 106b (decisions C74, C78 DD-2, DD-3): the adapter between a job's alias port (the scan of row 107, the
// set-IP job of row 111) and the lifecycle. The helper is the same scripted double; every line it was handed is counted.
describe('the port of a job over the lifecycle (row 106b; C78 DD-2: ONE behaviour after an add that did not end "done")', () => {
  const SUBJECT = { operatorId: 'OP-0003', deviceId: null, reason: 'FACTORY_SCAN', operationId: 'scanFactoryCameras', permission: 'CAPTURE_COMMISSION' } as const;
  const portOf = (w: ReturnType<typeof world>) => {
    const life = w.lifecycle();
    return { life, port: hostAliasJobPortOf(life, { preflight: async () => w.knobs.preflight }) };
  };
  const dels = (w: ReturnType<typeof world>): string[] => w.lines.filter((line) => line.startsWith('del '));

  it('done: add is the lifecycle\'s acquire with the subject as the actor; remove is its release with JOB_DONE; the state is the lifecycle\'s', async () => {
    const w = world();
    w.answers.push(pair('OK'), pair('OK'));
    const { port } = portOf(w);
    await expect(port.helper()).resolves.toBeNull();
    await expect(port.add({ address: ALIAS, minutes: MINUTES, subject: SUBJECT })).resolves.toEqual({ refusal: null, effect: 'DONE' });
    await expect(port.state()).resolves.toMatchObject({ address: ALIAS, reason: 'FACTORY_SCAN', removeError: null });
    await expect(port.remove({ address: ALIAS, subject: SUBJECT })).resolves.toEqual({ refusal: null, effect: 'DONE' });
    await expect(port.state()).resolves.toBeNull();
    // The alias audit rows of a job: the intent BEFORE each call, then its result. The job wrote none of them itself.
    expect(w.events).toEqual([
      'commit hostAlias.intent HOST_ALIAS_REQUESTED',
      `line add ${ALIAS}/24 ${String(MINUTES)}`,
      'commit hostAlias.result HOST_ALIAS_ADDED',
      'commit hostAlias.intent HOST_ALIAS_REQUESTED',
      `line del ${ALIAS}/24`,
      'commit hostAlias.result HOST_ALIAS_REMOVED',
    ]);
    expect(w.audit.map((entry) => [entry.actorId, entry.details['operationId'], entry.details['permission']])).toEqual(Array.from({ length: 4 }, () => ['OP-0003', 'scanFactoryCameras', 'CAPTURE_COMMISSION']));
    expect(w.rows).toMatchObject([{ removeReason: 'JOB_DONE', removedBy: 'OP-0003' }]);
    // The helper's own check before dialling is handed on as it is.
    w.knobs.preflight = 'NOT_AVAILABLE_ON_THIS_PLATFORM';
    await expect(port.helper()).resolves.toBe('NOT_AVAILABLE_ON_THIS_PLATFORM');
  });

  it.each([
    ['ADDRESS_IN_USE', 'HELPER_ADDRESS_IN_USE'],
    ['ALIAS_LIMIT_REACHED', 'HELPER_ALIAS_LIMIT_REACHED'],
  ] as const)('DD-2 (a) the helper DEFINITELY refused (%s): NOT_DONE - NO removal is asked, by the lifecycle or by the job', async (code, refusal) => {
    const w = world();
    w.answers.push(pair(code));
    const { port } = portOf(w);
    const added = await port.add({ address: ALIAS, minutes: MINUTES, subject: SUBJECT });
    expect(added).toEqual({ refusal, effect: 'NOT_DONE' });
    // What a job does with NOT_DONE is nothing; and a job that asked anyway would find nothing in place and send nothing.
    await expect(port.remove({ address: ALIAS, subject: SUBJECT })).resolves.toEqual({ refusal: null, effect: 'DONE' });
    expect(w.lines).toEqual([`add ${ALIAS}/24 ${String(MINUTES)}\n`]);
    expect(dels(w)).toEqual([]);
    expect(w.types()).toEqual(['HOST_ALIAS_REQUESTED:ADD', 'HOST_ALIAS_ADD_FAILED']);
    expect(w.openRows()).toEqual([]);
  });

  it.each([
    ['a bound exceeded', failed('TIMED_OUT'), 'HELPER_TIMED_OUT'],
    ['a broken connection', failed('CONNECTION_LOST'), 'HELPER_CONNECTION_LOST'],
    ['effect UNKNOWN by the helper\'s own word', pair('ADD_FAILED'), 'HELPER_ADD_FAILED'],
    ['a transport that throws', 'throw' as const, 'HELPER_UNREACHABLE'],
  ])('DD-2 (b) %s: a removal IS asked, once, and its result is recorded; the job is told nothing is left to take away', async (_name, script, refusal) => {
    const w = world();
    w.answers.push(script, pair('OK'));
    const { port } = portOf(w);
    await expect(port.add({ address: ALIAS, minutes: MINUTES, subject: SUBJECT })).resolves.toEqual({ refusal, effect: 'NOT_DONE' });
    expect(dels(w)).toEqual([`del ${ALIAS}/24\n`]);
    expect(w.types()).toEqual(['HOST_ALIAS_REQUESTED:ADD', 'HOST_ALIAS_ADD_FAILED', 'HOST_ALIAS_REQUESTED:REMOVE', 'HOST_ALIAS_REMOVED']);
    expect(w.audit[3]?.details).toMatchObject({ address: ALIAS, removeReason: 'ADD_UNCONFIRMED' });
    expect(w.openRows()).toEqual([]);
    await expect(port.state()).resolves.toBeNull();
  });

  it('DD-2 (b) the removal after an unknown add fails too: UNKNOWN - the job asks again, the helper is asked again, and that result is recorded too', async () => {
    const w = world();
    w.answers.push(failed('CONNECTION_LOST'), failed('CONNECTION_LOST'), pair('OK'));
    const { port } = portOf(w);
    await expect(port.add({ address: ALIAS, minutes: MINUTES, subject: SUBJECT })).resolves.toEqual({ refusal: 'HELPER_CONNECTION_LOST', effect: 'UNKNOWN' });
    await expect(port.state()).resolves.toMatchObject({ address: ALIAS, removeError: 'HELPER_CONNECTION_LOST' });
    await expect(port.remove({ address: ALIAS, subject: SUBJECT })).resolves.toEqual({ refusal: null, effect: 'DONE' });
    expect(dels(w)).toHaveLength(2);
    expect(w.types()).toEqual(['HOST_ALIAS_REQUESTED:ADD', 'HOST_ALIAS_ADD_FAILED', 'HOST_ALIAS_REQUESTED:REMOVE', 'HOST_ALIAS_REMOVE_FAILED', 'HOST_ALIAS_REQUESTED:REMOVE', 'HOST_ALIAS_REMOVED']);
    expect(w.openRows()).toEqual([]);
  });

  it('a removal the helper fails is UNKNOWN with its code, and the row stays open', async () => {
    const w = world();
    w.answers.push(pair('OK'), failed('TIMED_OUT'));
    const { port } = portOf(w);
    await port.add({ address: ALIAS, minutes: MINUTES, subject: SUBJECT });
    await expect(port.remove({ address: ALIAS, subject: SUBJECT })).resolves.toEqual({ refusal: 'HELPER_TIMED_OUT', effect: 'UNKNOWN' });
    expect(w.openRows()).toMatchObject([{ removeError: 'HELPER_TIMED_OUT' }]);
  });

  it('ANOTHER operation\'s alias is never taken away: an add beside it is NOT_DONE, and a removal that names another address asks nothing', async () => {
    const w = world();
    w.answers.push(pair('OK'));
    const { life, port } = portOf(w);
    await expect(life.acquire({ address: OTHER, minutes: MINUTES, reason: 'SET_CAMERA_ADDRESS', actor: { ...ACTOR, operationId: 'setCameraNetwork' } })).resolves.toMatchObject({ ok: true });
    const before = [w.lines.length, w.audit.length];
    await expect(port.add({ address: ALIAS, minutes: MINUTES, subject: SUBJECT })).resolves.toEqual({ refusal: 'ALIAS_ALREADY_OPEN', effect: 'NOT_DONE' });
    await expect(port.remove({ address: ALIAS, subject: SUBJECT })).resolves.toEqual({ refusal: 'ALIAS_IN_PLACE_IS_NOT_THIS_ADDRESS', effect: 'NOT_DONE' });
    expect([w.lines.length, w.audit.length]).toEqual(before);
    expect(w.openRows()).toMatchObject([{ address: `${OTHER}/24`, reason: 'SET_CAMERA_ADDRESS' }]);
  });

  it('refused before the helper (a session is open; a state that cannot be read): NOT_DONE for an add, 0 lines, 0 entries; an unreadable state on a removal is UNKNOWN', async () => {
    const w = world();
    const { port } = portOf(w);
    w.knobs.session = true;
    await expect(port.add({ address: ALIAS, minutes: MINUTES, subject: SUBJECT })).resolves.toEqual({ refusal: 'SESSION_IS_OPEN', effect: 'NOT_DONE' });
    w.knobs.session = false;
    w.knobs.readFails = true;
    await expect(port.add({ address: ALIAS, minutes: MINUTES, subject: SUBJECT })).resolves.toEqual({ refusal: 'STATE_UNREADABLE', effect: 'NOT_DONE' });
    await expect(port.remove({ address: ALIAS, subject: SUBJECT })).resolves.toEqual({ refusal: 'STATE_UNREADABLE', effect: 'UNKNOWN' });
    expect([w.lines, w.audit, w.rows]).toEqual([[], [], []]);
  });
});

describe('the facts reader and the candidates', () => {
  it('row 106b, the third source: the ONE name of the interface file out of the runner\'s answer; anything else is unreadable, and no runner is "unreadable" too', async () => {
    const ran = (output: string, exitCode = 0) => ({ outcome: 'RAN', exitCode, output });
    expect([interfaceFileNameOf(ran('eth1\n')), interfaceFileNameOf(ran('enp3s0')), interfaceFileNameOf(ran('eth1  \r\n\n'))]).toEqual(['eth1', 'enp3s0', 'eth1']);
    for (const answer of [ran(''), ran('eth1\neth2\n'), ran('eth1; rm'), ran(`${'a'.repeat(16)}\n`), ran('eth1\n', 1), ran('x'.repeat(300)), { outcome: 'NOT_STARTED' }, { outcome: 'TIMED_OUT' }, null, 'eth1', { outcome: 'RAN', exitCode: 0, output: 7 }]) {
      expect(interfaceFileNameOf(answer)).toBeNull();
    }
    const asked: unknown[] = [];
    const QUESTION = { program: 'the-fixed-question', args: [] };
    const source = hostAliasInterfaceFileSourceOf(async (command) => {
      asked.push(command);
      return ran('eth1\n');
    }, QUESTION);
    await expect(source()).resolves.toBe('eth1');
    expect(asked).toEqual([QUESTION]);
    await expect(hostAliasInterfaceFileSourceOf(null, QUESTION)()).resolves.toBeNull();
    await expect(hostAliasInterfaceFileSourceOf(async () => Promise.reject(new Error(CANARY)), QUESTION)()).resolves.toBeNull();
    // Through the facts reader and the caller's own rule: no runner is INTERFACE_FILE_UNREADABLE for an add, never a guess.
    const w = world();
    w.knobs.fileInterface = await hostAliasInterfaceFileSourceOf(null, QUESTION)();
    await expect(w.add(w.lifecycle())).resolves.toEqual({ ok: false, refusal: 'INTERFACE_FILE_UNREADABLE', stillInPlace: false });
    expect([w.lines, w.audit, w.rows]).toEqual([[], [], []]);
  });

  // Task 4 row 106c (decision C82, SR-11): the source over the runner the composition hands in, with the product's fixed
  // question. The runner is a DOUBLE of this file: nothing is started. Whatever the file holds that is not the ONE name
  // of the stored interface on a host that has it, the `add` is refused BEFORE the helper is asked: 0 lines, 0 entries, 0 rows.
  it.each([
    ['unreadable: the program could not be started', { outcome: 'NOT_STARTED' }, {}, 'INTERFACE_FILE_UNREADABLE'],
    ['unreadable: the program did not end', { outcome: 'TIMED_OUT' }, {}, 'INTERFACE_FILE_UNREADABLE'],
    ['unreadable: the file is not there or may not be read (exit code 1)', { outcome: 'RAN', exitCode: 1, output: '' }, {}, 'INTERFACE_FILE_UNREADABLE'],
    ['empty', { outcome: 'RAN', exitCode: 0, output: '' }, {}, 'INTERFACE_FILE_UNREADABLE'],
    ['empty but for a line end', { outcome: 'RAN', exitCode: 0, output: '\n' }, {}, 'INTERFACE_FILE_UNREADABLE'],
    ['two names', { outcome: 'RAN', exitCode: 0, output: 'eth1\neth2\n' }, {}, 'INTERFACE_FILE_UNREADABLE'],
    ['two names on one line', { outcome: 'RAN', exitCode: 0, output: 'eth1 eth2\n' }, {}, 'INTERFACE_FILE_UNREADABLE'],
    ['characters outside the form of an interface name', { outcome: 'RAN', exitCode: 0, output: 'eth1;reboot\n' }, {}, 'INTERFACE_FILE_UNREADABLE'],
    ['a path instead of a name', { outcome: 'RAN', exitCode: 0, output: '../eth1\n' }, {}, 'INTERFACE_FILE_UNREADABLE'],
    ['a name longer than an interface name', { outcome: 'RAN', exitCode: 0, output: `${'e'.repeat(16)}\n` }, {}, 'INTERFACE_FILE_UNREADABLE'],
    ['a well-formed name that is not the stored interface', { outcome: 'RAN', exitCode: 0, output: 'eth9\n' }, {}, 'INTERFACE_FILE_DIFFERS_FROM_ROW'],
    // The file and the row agree on a name the host's interface table does not hold: the network reader then knows no facts.
    ['a name that is not an interface of the host\'s interface table', { outcome: 'RAN', exitCode: 0, output: 'eth9\n' }, { storedInterface: 'eth9', network: null }, 'HOST_FACTS_UNREADABLE'],
  ])('row 106c, fail closed - the interface file is %s: the add is refused before the helper', async (_name, answer, knobs, refusal) => {
    const FIXED = { program: '/usr/bin/cat', args: ['/etc/dems/netalias-interface'] };
    const asked: unknown[] = [];
    const source = hostAliasInterfaceFileSourceOf(async (command) => {
      asked.push(command);
      return answer;
    }, FIXED);
    const w = world();
    Object.assign(w.knobs, knobs);
    w.knobs.fileInterface = await source();
    await expect(w.add(w.lifecycle())).resolves.toEqual({ ok: false, refusal, stillInPlace: false });
    expect([w.lines, w.audit, w.rows]).toEqual([[], [], []]);
    // The question is the row it was handed, unchanged, once: no argument is made of the answer or of a stored value.
    expect(asked).toEqual([FIXED]);
  });

  it('row 106c: the ONE name of the stored interface on a host that has it lets the add through - the only answer that does', async () => {
    const source = hostAliasInterfaceFileSourceOf(async () => ({ outcome: 'RAN', exitCode: 0, output: 'eth1\n' }), { program: '/usr/bin/cat', args: ['/etc/dems/netalias-interface'] });
    const w = world();
    w.answers.push(pair('OK'));
    w.knobs.fileInterface = await source();
    await expect(w.add(w.lifecycle())).resolves.toMatchObject({ ok: true });
    expect(w.lines).toHaveLength(1);
  });

  it('joins the stored interface, the file\'s name and the network facts; a file that cannot be asked is unreadable, never a guess', async () => {
    const read = hostAliasFactsReaderOf({ network: () => NETWORK, storedInterface: () => 'eth1', fileInterface: () => 'eth1' });
    await expect(read()).resolves.toEqual({ storedInterface: 'eth1', fileInterface: 'eth1', cameraSubnet: NETWORK.cameraSubnet, cameraAddresses: NETWORK.cameraAddresses, otherInterfaceSubnets: NETWORK.otherInterfaceSubnets, hostAddresses: NETWORK.hostAddresses });
    const broken = hostAliasFactsReaderOf({
      network: () => NETWORK,
      storedInterface: () => 'eth1',
      fileInterface: () => {
        throw new Error(CANARY);
      },
    });
    await expect(broken()).resolves.toMatchObject({ fileInterface: null });
    await expect(hostAliasFactsReaderOf({ network: () => NETWORK, storedInterface: () => null, fileInterface: () => 'eth1' })()).resolves.toMatchObject({ storedInterface: null });
    await expect(hostAliasFactsReaderOf({ network: () => null, storedInterface: () => 'eth1', fileInterface: () => 'eth1' })()).rejects.toMatchObject({ code: 'HOST_ALIAS_FACTS_UNKNOWN' });
  });

  it('held: only what the reader marks as an alias, as strict private quads, each once; unknown facts are null, not "none"', () => {
    const held = aliasAddressesHeld(() => ({ ...NETWORK, cameraAddresses: [{ address: '192.168.100.1', alias: false }, { address: ALIAS, alias: true }, { address: ALIAS, alias: true }, { address: '169.254.3.4', alias: true }, { address: CANARY, alias: true }] }));
    expect(held).toEqual([ALIAS]);
    expect(aliasAddressesHeld(() => null)).toBeNull();
    expect(
      aliasAddressesHeld(() => {
        throw new Error(CANARY);
      }),
    ).toBeNull();
  });

  it('configured: the /24 of each factory address with the alias host; anything else is dropped; bounded', () => {
    expect(aliasCandidatesOfConfiguration(['192.168.1.64', '10.0.0.5', 'camera.local', '8.8.8.8', 7, null], 253)).toEqual([ALIAS, '10.0.0.253']);
    for (const host of [0, 255, 2.5, '253', null]) expect(aliasCandidatesOfConfiguration(['192.168.1.64'], host)).toEqual([]);
    expect(aliasCandidatesOfConfiguration('192.168.1.64', 253)).toEqual([]);
    const many = Array.from({ length: 100 }, (_unused, index) => `10.1.${String(index)}.9`);
    expect(aliasCandidatesOfConfiguration(many, 253)).toHaveLength(HOST_ALIAS_SWEEP_CANDIDATES_MAX);
  });
});

describe('static: the lifecycle files open nothing themselves', () => {
  const strip = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const sources = ['store.ts', 'facts.ts', 'journal.ts', 'lifecycle.ts', 'job-port.ts'].map((name) => ({ name, text: strip(readFileSync(join(HERE, '..', name), 'utf8')) }));

  it('imports: types of the capture unit, the vocabulary, and the folder itself; no module of the runtime, no database driver', () => {
    expect(sources.map((file) => [file.name, [...file.text.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1])])).toEqual([
      ['store.ts', []],
      ['facts.ts', ['../destination-rule', './caller', './protocol']],
      ['journal.ts', ['@dems/shared/sim', './caller', './protocol', './store']],
      ['lifecycle.ts', ['../types', './caller', './facts', './journal', './protocol', './store']],
      // Row 106b: the port of a job imports its own folder only.
      ['job-port.ts', ['./caller', './journal', './lifecycle', './store']],
    ]);
    const text = (name: string): string => sources.find((file) => file.name === name)?.text ?? '';
    expect(text('facts.ts')).toMatch(/^import type \{ DestinationContext \} from '\.\.\/destination-rule';$/m);
    expect(text('lifecycle.ts')).toMatch(/^import type \{ CaptureTimers \} from '\.\.\/types';$/m);
  });

  it('no socket, file system, process, global timer, system time, environment or log; no program or folder of the host is named', () => {
    const forbidden = new RegExp(
      [
        'node:',
        'require\\(',
        'import\\(',
        `(?<![.\\w$])(?:${['spawn', 'exec', 'execFile', 'fork'].join('|')})\\s*\\(`,
        `\\b(?:set|clear)(?:${['Timeout', 'Interval', 'Immediate'].join('|')})\\b`,
        `\\bDate\\b`,
        `\\bprocess\\b`,
        `\\bconsole\\b`,
        `\\blog(?:ger)?\\s*\\.`,
        `\\berrorLog\\b`,
        `\\b(?:${['sudo', 'arping', 'ifconfig', 'systemctl'].join('|')})\\b`,
        `['"\`/]ip['"\`\\s]`,
        '/run/',
        '/etc/',
        '/usr/',
        'marks',
      ].join('|'),
    );
    for (const file of sources) expect(forbidden.exec(file.text)?.[0], file.name).toBeUndefined();
  });

  it('every statement of the store is a constant text with bind parameters; the table is never deleted from; what an alias IS is never updated', () => {
    const store = sources.find((file) => file.name === 'store.ts')?.text ?? '';
    expect(store).not.toMatch(/\bDELETE\b|\bTRUNCATE\b/);
    // The one interpolation into a statement is the fixed column list.
    expect([...store.matchAll(/`[^`]*\b(?:SELECT|INSERT|UPDATE)\b[^`]*`/g)].flatMap((match) => [...match[0].matchAll(/\$\{([^}]+)\}/g)].map((part) => part[1]))).toEqual(['COLUMNS']);
    const updates = [...store.matchAll(/UPDATE public\.host_network_aliases SET ([^']+?) WHERE/g)].map((match) => [...(match[1] ?? '').matchAll(/(\w+) = /g)].map((column) => column[1]));
    expect(updates).toEqual([['expires_at'], ['removed_at', 'remove_reason', 'removed_by', 'remove_error'], ['remove_error']]);
  });
});
