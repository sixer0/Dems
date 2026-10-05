// One minute of the recording scenario on the hosted engine, against PostgreSQL as `dems_app`
// (plan row W26; spec ENG-1, ENG-4, §8.7; AC-B-07, AC-B-52, AC-B-53, AC-B-55).
//
// The database is a schema clone seeded with the scenario `recording` at the fixed instant, as
// a scenario load leaves it. The engine is reloaded from it (the epoch as stored, so its random
// streams are the simulator's own) and driven for 60 s with a manual clock and a manual timer:
// 1,200 timer calls, one unit of work each. Every assertion below reads that one run.
import { DeltaOpSchema } from '@dems/shared/api';
import { signedOutAuth, verifyAuditChain, type AuditRow } from '@dems/shared/sim';
import type { Pool } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../test/helpers/db';
import { linkProblems, readHead, readTrail, verifyTrail } from '../../../test/support/core';
import { DURABLE_SLICE_KEYS, SNAPSHOT_SLICE_KEYS, STORED_SLICE_KEYS, pickDurable, type DurableSliceKey, type DurableSlices } from '../../db/mapping';
import { createHost, dumpDatabase, occurrences, sha256Hex, withoutNegativeZeros } from '../../../test/support/seed';
import {
  FIXED_NOW,
  applyChanges,
  countChanges,
  engineApp,
  meterFrames,
  seedScenario,
  stateChanges,
  storedSlices,
  tableCounts,
  type EngineApp,
} from './support';

/** Decision D28, the reference of the headless proof: SHA-256 of the 230 audit types joined by commas. */
const PROOF_TYPE_DIGEST = '4b5d34e1ac7de7f641b33bb74266579ede2f40d6fbb8574a8f3e53abd475252f';
const MINUTE = 60_000;

const db = useTestDatabase({ template: 'schema' });

let host: EngineApp;
let owner: Pool;
/** The state, the counts and the statement position before the first tick. */
let start: { state: DurableSlices; counts: Record<string, number>; statements: number; total: number };
let stored: AuditRow[];
/** Per tick of the minute: how many statements it sent. */
let perTick: number[];
/** Per tick of the minute: its wall time in milliseconds (a measurement, never an assertion). */
let tickMs: number[];
let wallMs: number;
/**
 * ONE CUT (finding F71): per tick after which the committed state had moved, the slices of it
 * that are NOT the engine's own at that instant. Empty when the committed state is one instant.
 */
let cuts: Array<{ tick: number; stale: DurableSliceKey[] }>;
/** Per tick: which class of slices the committed state moved in ('' when it did not move). */
let moved: Array<'' | 'records' | 'snapshot' | 'both'>;

beforeAll(async () => {
  await seedScenario(db, 'recording');
  owner = db.ownerPool();
  host = await engineApp(db, db.run.dataDir);
  await host.engine.reload();
  start = {
    state: host.engine.state(),
    counts: await tableCounts(owner),
    statements: host.database.statements.length,
    total: host.engine.slice('audit').total,
  };

  cuts = [];
  moved = [];
  let committed = host.engine.state();
  perTick = [];
  tickMs = [];
  const began = performance.now();
  for (let tick = 0; tick < MINUTE / 50; tick += 1) {
    const before = host.database.statements.length;
    const tickBegan = performance.now();
    await host.drive(50);
    tickMs.push(performance.now() - tickBegan);
    perTick.push(host.database.statements.length - before);
    // What a reader gets after this tick, against the engine's own state at the same instant.
    const now = host.engine.state();
    const own = pickDurable(host.engine.simulator()?.store.getState() ?? ({} as never));
    if (now === committed) {
      moved.push('');
    } else {
      const records = STORED_SLICE_KEYS.some((key) => now[key] !== committed[key]);
      const snapshot = SNAPSHOT_SLICE_KEYS.some((key) => now[key] !== committed[key]);
      moved.push(records && snapshot ? 'both' : records ? 'records' : 'snapshot');
      cuts.push({ tick, stale: DURABLE_SLICE_KEYS.filter((key) => now[key] !== own[key]) });
      committed = now;
    }
  }
  wallMs = performance.now() - began;
  stored = await readTrail(owner);
});

describe('AC-B-52: with a fixed seed and a manual clock the audit trail of the recording scenario is the shared simulator\'s', () => {
  it('the stored audit-type sequence equals the simulator\'s, row for row, hash for hash; its digest is the proof\'s reference', async () => {
    const reference = await createHost({ scenario: 'recording', startAt: FIXED_NOW });
    reference.drive(MINUTE);
    const expected = reference.state().audit.rows;

    expect(stored.map((row) => row.type)).toEqual(expected.map((row) => row.type));
    expect(stored.map((row) => [row.seq, row.at, row.type, row.actorId, row.hash])).toEqual(
      expected.map((row) => [row.seq, row.at, row.type, row.actorId, row.hash]),
    );
    expect(stored).toHaveLength(230);
    expect(sha256Hex(stored.map((row) => row.type).join(','))).toBe(PROOF_TYPE_DIGEST);

    // The whole durable state is the simulator's, not only the trail.
    expect(await storedSlices(db.appPool())).toStrictEqual(withoutNegativeZeros(reference.state()));
    console.info(
      `[w26] AC-B-52: 230 stored audit rows = the shared simulator's (seq, at, type, actor, hash); type digest ${PROOF_TYPE_DIGEST.slice(0, 12)}…; ` +
        `the 12 rows of the minute: ${stored
          .slice(start.total)
          .map((row) => row.type)
          .join(', ')}`,
    );
  });

  it('the stored chain verifies over all rows and the head is the engine\'s', async () => {
    const head = await readHead(owner);
    expect(linkProblems(stored)).toEqual([]);
    expect(verifyTrail(stored, head)).toEqual({ ok: true, checked: 230, head: head.hash });
    expect(host.engine.slice('audit')).toMatchObject({ total: head.seq, head: head.hash });
    expect(verifyAuditChain(host.engine.slice('audit'))).toMatchObject({ ok: true });
  });

  it('AC-B-53: the rows the engine wrote by itself have no actor, and nobody is signed in on the engine', () => {
    const written = stored.slice(start.total);
    expect(written).toHaveLength(12);
    expect(written.every((row) => row.actorId === null)).toBe(true);
    expect(new Set(written.map((row) => row.type))).toEqual(new Set(['WRITE_VERIFIED', 'FRAME_HASH', 'TIMESTAMP_CONFIRMED']));
    expect(host.engine.simulator()?.store.getState().auth).toEqual(signedOutAuth());
  });
});

describe('AC-B-07: a 60 s recording stores no meter frame, and the tables grow only by what the engine wrote', () => {
  it('the row counts of all 30 tables: 12 audit rows, the events and one health snapshot; nothing else', async () => {
    const counts = await tableCounts(owner);
    const events = host.engine.slice('events').length - start.state.events.length;
    expect(countChanges(start.counts, counts)).toEqual({ audit_log: 12, events, health_snapshots: 1 });
    expect(Object.keys(counts)).toHaveLength(30);
    console.info(`[w26] AC-B-07: 60 s of recording: audit_log +12, events +${events}, health_snapshots +1; the other 27 tables unchanged`);
  });

  it('1,200 meter frames were produced and handed to the realtime seam; not one member of a frame is in any row of any table', async () => {
    const frames = meterFrames(host.publications);
    expect(frames).toHaveLength(1_200);
    expect(frames.map((frame) => frame.seq)).toEqual(Array.from({ length: 1_200 }, (_, index) => index + 1));
    expect(frames.at(-1)?.at).toBe(FIXED_NOW + MINUTE);
    // Positive control: a frame has these members.
    const frame = JSON.stringify(frames.at(-1)?.audio);
    const dump = await dumpDatabase(owner);
    for (const member of ['"channels"', '"noSignal"']) {
      expect(occurrences(frame, member), member).toBeGreaterThan(0);
      expect(occurrences(dump, member), member).toBe(0);
    }
    expect(stateChanges(host.publications).some((change) => JSON.stringify(change.ops.map((op) => op.slice)).includes('audio'))).toBe(false);
  });
});

describe('ENG-1, ENG-4: one unit per tick, and a tick that changed nothing durable sends no statement', () => {
  it('1,200 ticks ran; 72 of them wrote, the other 1,128 sent no statement and took no connection', () => {
    const stats = host.engine.stats();
    expect(stats).toMatchObject({ ticks: 1_200, ticksSkipped: 0, ticksFailed: 0, suspended: false, simErrors: 0 });
    const writing = perTick.filter((sent) => sent > 0).length;
    expect(writing).toBe(stats.ticksWritten);
    expect(writing).toBe(72);
    expect(perTick.filter((sent) => sent === 0)).toHaveLength(1_128);

    const sent = host.database.statements.slice(start.statements);
    // Every statement belongs to a unit that opened a transaction: as many BEGINs as writing ticks.
    expect(sent.filter((text) => text.startsWith('BEGIN'))).toHaveLength(72);
    expect(sent.filter((text) => text === 'COMMIT')).toHaveLength(72);
    expect(sent.filter((text) => text === 'ROLLBACK')).toEqual([]);
    const mean = (values: number[]): string => (values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)).toFixed(3);
    console.info(
      `[w26] 60 s of recording: 1,200 ticks in ${wallMs.toFixed(0)} ms wall time; a tick that wrote ${mean(tickMs.filter((_, tick) => (perTick[tick] ?? 0) > 0))} ms ` +
        `(72 ticks, ${sent.length} statements, ${(sent.length / 72).toFixed(1)} a unit), a tick that wrote nothing ${mean(tickMs.filter((_, tick) => perTick[tick] === 0))} ms (1,128 ticks, no statement)`,
    );
  });

  it('ONE CUT (finding F71, decision D104): after every tick that committed, every durable slice a reader gets is the engine\'s own at that instant', () => {
    // 72 ticks moved the committed state: the 72 that wrote. In none of them is a slice of an earlier instant.
    expect(cuts).toHaveLength(72);
    expect(cuts.filter((cut) => cut.stale.length > 0)).toEqual([]);
    expect(moved.filter((kind) => kind !== '')).toHaveLength(72);
    // A tick that committed a record committed the snapshot slices that had changed with it, in the same unit.
    const sent = host.database.statements;
    let position = start.statements;
    const written = perTick.map((count) => {
      const unit = sent.slice(position, position + count);
      position += count;
      return {
        snapshot: unit.some((text) => text.startsWith('update "hardware_snapshot"')),
        records: unit.some((text) => text.startsWith('update "active_session"') || text.startsWith('insert into "audit_log"') || text.startsWith('INSERT INTO public.audit_log')),
      };
    });
    const kinds = { both: moved.filter((kind) => kind === 'both').length, records: moved.filter((kind) => kind === 'records').length, snapshot: moved.filter((kind) => kind === 'snapshot').length };
    // A unit that committed records alone did so because no snapshot slice had changed since the last write: the
    // first assertion above says that nothing of it was left behind.
    expect(kinds.both + kinds.snapshot + kinds.records).toBe(72);
    expect(kinds.both).toBeGreaterThan(0);
    moved.forEach((kind, tick) => {
      if (kind === 'both' || kind === 'snapshot') expect(written[tick]?.snapshot, `tick ${tick}`).toBe(true);
      if (kind === 'records') expect(written[tick]?.snapshot, `tick ${tick}`).toBe(false);
    });
    console.info(
      `[b2a] ONE CUT over 60 s of recording: 72 committed states, 0 with a slice of an earlier instant; ${kinds.both} units committed records and snapshot slices together, ` +
        `${kinds.snapshot} the snapshot alone, ${kinds.records} records alone; hardware_snapshot updates ${written.filter((unit) => unit.snapshot).length}`,
    );
  });

  it('a change of snapshot slices ALONE waits: no clock second has two ticks that committed only the snapshot', () => {
    const alone = moved.flatMap((kind, tick) => (kind === 'snapshot' ? [Math.floor((FIXED_NOW + (tick + 1) * 50) / 1_000)] : []));
    expect(new Set(alone).size).toBe(alone.length);
    // And the hardware snapshot row is not written by 1,128 of the 1,200 ticks.
    const snapshots = host.database.statements.slice(start.statements).filter((text) => text.startsWith('update "hardware_snapshot"'));
    expect(snapshots.length).toBeLessThanOrEqual(72);
    expect(snapshots.length).toBeGreaterThanOrEqual(60);
  });

  it('no statement names a table of meter frames or a slice that is not durable', () => {
    const sent = host.database.statements.slice(start.statements).join('\n');
    for (const word of ['audio', 'meter', 'auth_sessions', 'pairing']) expect(sent, word).not.toContain(word);
  });
});

describe('AC-B-55: every instant follows the injected clock', () => {
  it('every row written in the minute is stamped inside the minute of the manual clock, never with the wall clock', async () => {
    const from = FIXED_NOW;
    const to = FIXED_NOW + MINUTE;
    expect(host.clock.now()).toBe(to);
    for (const row of stored.slice(start.total)) {
      expect(row.at).toBeGreaterThan(from);
      expect(row.at).toBeLessThanOrEqual(to);
    }
    const instants = await owner.query<{ name: string; at: string }>(
      `SELECT 'hardware_snapshot.written_at' AS name, written_at::text AS at FROM public.hardware_snapshot
       UNION ALL SELECT 'active_session.updated_at', updated_at::text FROM public.active_session
       UNION ALL SELECT 'health_snapshots.at', at::text FROM public.health_snapshots
       UNION ALL SELECT 'events.at (newest)', max(at)::text FROM public.events`,
    );
    expect(instants.rows).toHaveLength(4);
    for (const row of instants.rows) {
      expect(Number(row.at), row.name).toBeGreaterThan(from);
      expect(Number(row.at), row.name).toBeLessThanOrEqual(to);
    }
    // The wall clock of this run is days after the manual clock: a leak would be far outside.
    expect(Date.now() - to).toBeGreaterThan(MINUTE);
  });

  it('the 60 s health snapshot is one row of cause INTERVAL at exactly 60 s after the start', async () => {
    const { rows } = await owner.query<{ at: string; cause: string; fault_kind: string | null; session_state: string | null }>(
      'SELECT at::text AS at, cause, fault_kind, session_state FROM public.health_snapshots ORDER BY at',
    );
    expect(rows).toEqual([{ at: String(FIXED_NOW + MINUTE), cause: 'INTERVAL', fault_kind: null, session_state: 'RECORDING' }]);
    expect(host.engine.stats().healthSnapshots).toBe(1);
  });
});

describe('what the realtime channel is handed (spec §9.3)', () => {
  it('one state change per unit that wrote, in commit order, with revisions 1, 2, 3, … and no gap', () => {
    const changes = stateChanges(host.publications);
    expect(changes[0]).toMatchObject({ cause: 'start', revision: 0, epoch: 0, ops: [] });
    const deltas = changes.slice(1);
    expect(deltas).toHaveLength(72);
    expect(deltas.map((change) => change.revision)).toEqual(Array.from({ length: 72 }, (_, index) => index + 1));
    expect(deltas.every((change) => change.cause === 'tick' && change.epoch === 0 && change.ops.length > 0)).toBe(true);
    expect(deltas.every((change, index) => index === 0 || change.at >= (deltas[index - 1]?.at ?? 0))).toBe(true);
    expect(host.engine.revision).toBe(72);
    expect(host.engine.epoch).toBe(0);
  });

  it('every operation is a DeltaOp of the realtime contract, and the operations applied to the first state give the committed state', async () => {
    const deltas = stateChanges(host.publications).slice(1);
    for (const change of deltas) {
      for (const op of change.ops) expect(DeltaOpSchema.safeParse(op).success, `${op.op} ${op.slice}`).toBe(true);
    }
    const replayed = applyChanges(start.state, deltas);
    expect(replayed).toStrictEqual(host.engine.state());
    // And the committed state is what the tables hold.
    expect(await storedSlices(db.appPool())).toStrictEqual(withoutNegativeZeros(host.engine.state()));
    // Audit rows and events travel as appends; a record change is flagged for the pacing rule.
    const audit = deltas.flatMap((change) => change.ops.filter((op) => op.slice === 'audit'));
    expect(audit).toHaveLength(12);
    expect(audit.every((op) => op.op === 'append')).toBe(true);
    // The first tick wrote the snapshot row alone; every later write held a record.
    expect(deltas.map((change) => change.records)).toEqual([false, ...Array.from({ length: 71 }, () => true)]);
  });

  it('reads come from the committed state: the session of `state()` is the stored one, by reference stable between two writes', () => {
    const session = host.engine.slice('session');
    expect(session).toBe(host.engine.state().session);
    expect(session?.state).toBe('RECORDING');
  });
});
