// The scheduler of the hosted engine against PostgreSQL as `dems_app` (plan row W26; spec ENG-1,
// ENG-5, §8.7): one unit per tick and never two in flight, the suspension after a write that
// failed, the 60 s health snapshot, and the write budget of an idle Core.
import type { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { useTestDatabase, type TestDatabase } from '../../../test/helpers/db';
import { PipelineFailure } from '../../core';
import { readHead, readTrail, verifyTrail } from '../../../test/support/core';
import { DURABLE_SLICE_KEYS, STORED_SLICE_KEYS, pickDurable, type DurableSliceKey } from '../../db/mapping';
import { tableChecksums, withoutNegativeZeros } from '../../../test/support/seed';
import { FIXED_NOW, engineApp, meterFrames, seedScenario, stateChanges, storedSlices, type EngineApp } from './support';

const db = useTestDatabase({ template: 'seed' });

async function recording(slug: string): Promise<{ host: EngineApp; owner: Pool; target: TestDatabase }> {
  const target = await db.another({ template: 'schema', slug });
  await seedScenario(target, 'recording');
  const host = await engineApp(target, db.run.dataDir);
  await host.engine.reload();
  return { host, owner: target.ownerPool(), target };
}

describe('ENG-1: at most one unit of the engine between "changed" and "committed"', () => {
  it('timer calls that arrive while a tick is queued or running submit nothing; the next tick carries the elapsed time', async () => {
    const { host } = await recording('w26_tick_queue');
    await host.drive(900);
    const before = host.engine.stats();
    const sent = host.database.statements.length;

    // Three calls of the timer in one turn, as a timer does after the event loop was busy.
    host.clock.advance(50);
    host.timer.fire();
    host.timer.fire();
    host.timer.fire();
    expect(host.app.pipeline.snapshot().pending + (host.app.pipeline.snapshot().running === null ? 0 : 1)).toBeLessThanOrEqual(1);
    await host.engine.idle();
    expect(host.engine.stats()).toMatchObject({ ticks: before.ticks + 1, ticksSkipped: before.ticksSkipped + 2 });
    expect(host.database.statements).toHaveLength(sent);

    // The clock moves on by a second while timer calls are skipped behind a queued tick: the one
    // tick that then runs carries the whole second (the 1 Hz step happens once, not twenty times).
    const progressBefore = host.engine.slice('session')?.bytesWritten ?? 0;
    host.timer.fire();
    for (let step = 0; step < 20; step += 1) {
      host.clock.advance(50);
      host.timer.fire();
    }
    await host.engine.idle();
    host.timer.fire();
    await host.engine.idle();
    const after = host.engine.stats();
    expect(after.ticks).toBe(before.ticks + 3);
    expect(after.ticksSkipped).toBe(before.ticksSkipped + 22);
    expect(host.engine.slice('session')?.bytesWritten).toBeGreaterThan(progressBefore);
    expect(after).toMatchObject({ ticksFailed: 0, suspended: false });
  });

  it('a tick waits its turn behind a command that was submitted first, and both commit in that order', async () => {
    const { host, owner } = await recording('w26_tick_order');
    await host.drive(950);
    const investigator = host.principal('INVESTIGATOR');
    const published = stateChanges(host.publications).length;

    const command = host.engine.command(investigator, 'addMarker', 'Before the tick');
    host.clock.advance(50);
    host.timer.fire();
    host.timer.fire();
    const outcome = await command;
    await host.engine.idle();

    const changes = stateChanges(host.publications).slice(published);
    expect(changes.map((change) => change.cause)).toEqual(['command', 'tick']);
    expect(changes.map((change) => change.revision)).toEqual([outcome.revision, outcome.revision + 1]);
    expect(host.engine.stats().ticksSkipped).toBe(1);
    expect(verifyTrail(await readTrail(owner), await readHead(owner))).toMatchObject({ ok: true });
  });
});

describe('ENG-5: a tick whose unit is not committed', () => {
  it('sets the engine back, suspends the ticks, probes at most once a second, and resumes with the elapsed time when a unit commits again', async () => {
    const { host, owner } = await recording('w26_tick_suspend');
    await host.drive(950);
    const sim = host.engine.simulator();
    if (sim === null) throw new Error('the engine is not running');
    const working = sim.store.getState();
    const committed = host.engine.state();
    const head = await readHead(owner);
    const checksums = await tableChecksums(owner);
    const revision = host.engine.revision;

    // The tick at the next whole second writes the session progress; its COMMIT fails.
    const left = host.database.failNext(/^COMMIT$/);
    await host.drive(50);
    expect(left()).toBe(0);
    expect(host.engine.stats()).toMatchObject({ ticksFailed: 1, suspended: true });

    // Set back: every durable slice is the object it was, a reader sees what was committed, nothing is stored.
    for (const key of DURABLE_SLICE_KEYS) expect(sim.store.getState()[key], key).toBe(working[key]);
    expect(host.engine.state()).toBe(committed);
    expect(await readHead(owner)).toEqual(head);
    expect(await tableChecksums(owner)).toEqual(checksums);
    expect(host.engine.revision).toBe(revision);
    const suspended = host.log.lines().filter((line) => line['msg'] === 'engine ticks suspended: a tick was not committed');
    expect(suspended).toHaveLength(1);
    expect(suspended[0]).toMatchObject({ level: 50, code: 'COMMIT_FAILED' });

    // Suspended: 950 ms of timer calls run no tick and send no statement.
    const ticks = host.engine.stats().ticks;
    const sent = host.database.statements.length;
    await host.drive(950);
    expect(host.engine.stats()).toMatchObject({ ticks, probes: 0, suspended: true });
    expect(host.database.statements).toHaveLength(sent);

    // One second after the failure: one probe, a unit that reads the head and commits.
    await host.drive(50);
    expect(host.engine.stats()).toMatchObject({ ticks, probes: 1, suspended: false });
    expect(host.database.statements.slice(sent)).toEqual([
      'BEGIN ISOLATION LEVEL READ COMMITTED',
      'SELECT seq, hash FROM public.audit_chain_lock()',
      expect.stringContaining('statement_timeout'),
      'COMMIT',
    ]);
    expect(host.log.lines().filter((line) => line['msg'] === 'engine ticks resumed')).toHaveLength(1);

    // Ticks go on, carry the two seconds that passed, and the trail continues the stored head.
    await host.drive(30_000);
    expect(host.engine.stats()).toMatchObject({ ticksFailed: 1, suspended: false, resyncs: 0 });
    const session = host.engine.slice('session');
    expect(session?.state).toBe('RECORDING');
    const trail = await readTrail(owner);
    expect(trail.length).toBeGreaterThan(head.seq);
    expect(trail[head.seq]?.prevHash).toBe(head.hash);
    expect(verifyTrail(trail, await readHead(owner))).toMatchObject({ ok: true, checked: trail.length });
    expect(await storedSlices(owner)).toStrictEqual(withoutNegativeZeros(host.engine.state()));
  });

  it('a command that commits while the ticks are suspended resumes them at once', async () => {
    const { host } = await recording('w26_tick_resume');
    await host.drive(950);
    host.database.failNext(/^COMMIT$/);
    await host.drive(50);
    expect(host.engine.stats().suspended).toBe(true);

    await host.engine.command(host.principal('INVESTIGATOR'), 'addMarker', 'While suspended');
    expect(host.engine.stats()).toMatchObject({ suspended: false, probes: 0 });
    const ticks = host.engine.stats().ticks;
    await host.drive(50);
    expect(host.engine.stats().ticks).toBe(ticks + 1);
  });

  it('a database that does not answer: the command is 503, the engine is set back, and readiness follows the pool', async () => {
    const { host } = await recording('w26_tick_outage');
    await host.drive(500);
    const committed = host.engine.state();
    host.database.failNext(/^BEGIN/, '57P01');
    const error = await host.engine.command(host.principal('INVESTIGATOR'), 'addMarker', 'During the outage').then(
      () => undefined,
      (thrown: unknown) => thrown,
    );
    expect(error).toBeInstanceOf(PipelineFailure);
    expect(error).toMatchObject({ statusCode: 503, code: 'NOT_READY', reason: 'DATABASE_UNAVAILABLE' });
    expect(host.engine.state()).toBe(committed);
    // The engine itself stays started: the next command, with the database back, is stored.
    expect(host.engine.running).toBe(true);
    await host.engine.command(host.principal('INVESTIGATOR'), 'addMarker', 'After the outage');
    expect(host.engine.slice('audit').rows.at(-1)?.type).toBe('MARKER_ADDED');
  });
});

describe('the write budget of an idle Core and the health snapshots (spec §8.7)', () => {
  it('three idle minutes: one snapshot write a second, one health snapshot row every 60 s, and a row at each fault raise and clear', async () => {
    const target = await db.another({ slug: 'w26_tick_idle' });
    const owner = target.ownerPool();
    const host = await engineApp(target, db.run.dataDir);
    await host.app.readiness.boot();
    const started = host.clock.now();
    const head = await readHead(owner);
    const sentBefore = host.database.statements.length;

    const began = performance.now();
    await host.drive(60_000);
    const minuteMs = performance.now() - began;
    const minute = host.database.statements.slice(sentBefore);
    const snapshots = minute.filter((text) => text.startsWith('update "hardware_snapshot"'));
    expect(snapshots.length).toBeGreaterThanOrEqual(60);
    expect(snapshots.length).toBeLessThanOrEqual(61);
    expect(host.engine.stats().ticks).toBe(1_200);
    expect(host.engine.stats().ticksWritten).toBeLessThanOrEqual(62);
    // No audit row is written by a tick of an idle Core without a session.
    expect((await readTrail(owner)).filter((row) => row.seq > head.seq).every((row) => row.actorId === null)).toBe(true);

    const supervisor = host.principal('SUPERVISOR');
    await host.drive(10_000);
    await host.engine.command(supervisor, 'inject', 'FAN_STALL');
    await host.drive(10_000);
    await host.engine.command(supervisor, 'clearFault', 'FAN_STALL');
    await host.drive(100_000);

    const { rows } = await owner.query<{ at: string; cause: string; fault_kind: string | null; active_faults: number }>(
      'SELECT at::text AS at, cause, fault_kind, active_faults FROM public.health_snapshots ORDER BY at, cause',
    );
    expect(rows).toEqual([
      { at: String(started + 60_000), cause: 'INTERVAL', fault_kind: null, active_faults: 0 },
      { at: String(started + 70_000), cause: 'FAULT_RAISED', fault_kind: 'FAN_STALL', active_faults: 1 },
      { at: String(started + 80_000), cause: 'FAULT_CLEARED', fault_kind: 'FAN_STALL', active_faults: 0 },
      { at: String(started + 120_000), cause: 'INTERVAL', fault_kind: null, active_faults: 0 },
      { at: String(started + 180_000), cause: 'INTERVAL', fault_kind: null, active_faults: 0 },
    ]);
    expect(host.engine.stats().healthSnapshots).toBe(5);
    expect(host.clock.now()).toBe(FIXED_NOW + 180_000);
    expect(await storedSlices(owner)).toStrictEqual(withoutNegativeZeros(host.engine.state()));
    console.info(
      `[w26] idle minute: 1,200 ticks in ${minuteMs.toFixed(0)} ms wall time; ${host.engine.stats().ticksWritten} writing ticks in three minutes; ` +
        `${snapshots.length} snapshot writes in the first minute; health snapshots at +60 s, +70 s (raise), +80 s (clear), +120 s, +180 s`,
    );
  });
});

describe('ONE CUT: what a unit commits is the whole durable state at one instant (finding F71 = F-W40-1; decision D104)', () => {
  it('a software update, tick by tick: the committed state never names the new version beside a running update, and never holds a slice of an earlier instant', async () => {
    const target = await db.another({ slug: 'b2a_cut_update' });
    const owner = target.ownerPool();
    const host = await engineApp(target, db.run.dataDir);
    await host.app.readiness.boot();
    const sim = host.engine.simulator();
    if (sim === null) throw new Error('the engine is not started');
    const from = host.engine.slice('device').softwareVersion;

    await host.engine.command(host.principal('TECHNICIAN'), 'startSoftwareUpdate');
    expect(host.engine.slice('update')).toMatchObject({ state: 'RUNNING', currentVersion: from });
    const t0 = host.clock.now();
    const published = stateChanges(host.publications).length;

    let committed = host.engine.state();
    let moved = 0;
    /** Ticks after which the committed state named the new version while its update still ran: the finding. */
    const mixed: number[] = [];
    /** Ticks after which the committed state had moved and a slice of it was not the engine's own. */
    const stale: Array<{ at: number; slices: DurableSliceKey[] }> = [];
    /** Ticks after which a slice of the committed state was behind the engine's own (it had NOT moved): the pacing. */
    let waiting = 0;
    let waitingNow = 0;
    let longestWaitMs = 0;
    /** The clock second of every tick that committed snapshot slices ALONE. */
    const alone: number[] = [];
    for (let tick = 0; tick < 300; tick += 1) {
      await host.drive(50);
      const now = host.engine.state();
      const own = pickDurable(sim.store.getState());
      const behind = DURABLE_SLICE_KEYS.filter((key) => now[key] !== own[key]);
      if (now.device.softwareVersion !== from && now.update.state === 'RUNNING') mixed.push(host.clock.now() - t0);
      if (now !== committed) {
        moved += 1;
        if (behind.length > 0) stale.push({ at: host.clock.now() - t0, slices: behind });
        if (!STORED_SLICE_KEYS.some((key) => now[key] !== committed[key])) alone.push(Math.floor(host.clock.now() / 1_000));
        committed = now;
        waitingNow = 0;
      } else if (behind.length > 0) {
        waiting += 1;
        waitingNow += 1;
        longestWaitMs = Math.max(longestWaitMs, waitingNow * 50);
      }
    }

    // The update ran to its end inside the fifteen seconds.
    expect(host.engine.slice('update')).toMatchObject({ state: 'PASS', availableVersion: null });
    expect(host.engine.slice('device').softwareVersion).not.toBe(from);
    expect(host.engine.slice('update').currentVersion).toBe(host.engine.slice('device').softwareVersion);
    // The finding: 18 ticks of such a state before the fix. And, in general, no mixed cut at all.
    expect(mixed).toEqual([]);
    expect(stale).toEqual([]);
    expect(moved).toBeGreaterThan(10);
    // The pacing that stays (the cost of an idle Core): a change of snapshot slices ALONE is not written by the tick
    // that made it. It waits for the next second of the server clock, less than a second, and until then a reader
    // gets the earlier cut, whole. No second has two such writes.
    expect(waiting).toBeGreaterThan(0);
    expect(longestWaitMs).toBeLessThan(1_000);
    expect(alone.length).toBeGreaterThan(0);
    expect(new Set(alone).size).toBe(alone.length);

    // The change that carries the UPDATE_COMPLETED row carries the update that completed and the device that names the version.
    const changes = stateChanges(host.publications).slice(published);
    const completing = changes.filter((change) => change.ops.some((op) => op.op === 'append' && op.slice === 'audit' && op.rows.some((row) => row.type === 'UPDATE_COMPLETED')));
    expect(completing).toHaveLength(1);
    expect(completing[0]?.records).toBe(true);
    const replaced = new Map(completing[0]?.ops.flatMap((op) => (op.op === 'replace' ? [[op.slice, op.value] as const] : [])));
    expect(replaced.get('update')).toMatchObject({ state: 'PASS' });
    expect(replaced.get('device')).toMatchObject({ softwareVersion: host.engine.slice('device').softwareVersion });
    // One publication per committed unit, the revisions without a gap.
    expect(changes).toHaveLength(moved);
    expect(changes.map((change) => change.revision)).toEqual(changes.map((_, index) => (changes[0]?.revision ?? 0) + index));

    await host.engine.stop();
    expect(await storedSlices(owner)).toStrictEqual(withoutNegativeZeros(pickDurable(sim.store.getState())));
    console.info(`[b2a] ONE CUT over a software update (300 ticks): ${moved} committed states, ${mixed.length} with the new version beside a running update, ${stale.length} with a slice of an earlier instant; a change of snapshot slices alone waited on ${waiting} ticks, at most ${longestWaitMs} ms; ${alone.length} units committed the snapshot alone`);
  });
});

describe('meters(): the newest meter frame, by reference, never stored (decision D89; finding F66)', () => {
  it('null before the first tick of a start; then the very object that was published; a stop refuses it and the next start begins at null', async () => {
    const { host, owner } = await recording('b2a_meters');
    const sim = host.engine.simulator();
    if (sim === null) throw new Error('the engine is not running');
    const meters = () => host.engine.meters();

    // Started, no tick yet: there is no frame of this start.
    expect(meters()).toBeNull();

    await host.drive(50);
    const first = meterFrames(host.publications);
    expect(first).toHaveLength(1);
    // By reference: the object that went to the realtime seam, holding the engine's own audio slice.
    expect(meters()).toBe(first[0]);
    expect(meters()).toMatchObject({ seq: 1, at: host.clock.now() });
    expect(meters()?.audio).toBe(sim.store.getState().audio);
    const firstLevels = JSON.stringify(first[0]?.audio);

    // A second of a recording: 20 frames, the newest one is served, and the levels moved (they are live).
    await host.drive(950);
    const frames = meterFrames(host.publications);
    expect(frames).toHaveLength(20);
    expect(meters()).toBe(frames.at(-1));
    expect(meters()).toMatchObject({ seq: 20, at: FIXED_NOW + 1_000 });
    expect(JSON.stringify(meters()?.audio)).not.toBe(firstLevels);
    // An earlier frame is not changed by a later one: each is its own object.
    expect(JSON.stringify(first[0]?.audio)).toBe(firstLevels);
    // SH-17 (C3 §3, ops 44/45): the meter frame's audio is keyed by INPUT - the FOUR numbered
    // channels MIC-01..MIC-04 since D61 (2026-11-04); the session tracks AUDIO-01..04 are the other
    // axis (sim/audio.ts maps one onto the other).
    expect(Object.keys(meters()?.audio.inputs ?? {}).sort()).toEqual(['MIC-01', 'MIC-02', 'MIC-03', 'MIC-04']); // D61 (2026-11-04): four numbered channels, was the two-role pair

    // Never stored: the committed state has no such slice, and reading the frame sends no statement.
    expect(Object.keys(host.engine.state())).not.toContain('audio');
    const sent = host.database.statements.length;
    for (let read = 0; read < 100; read += 1) meters();
    expect(host.database.statements).toHaveLength(sent);
    const dump = await owner.query<{ line: string }>('SELECT to_jsonb(t)::text AS line FROM public.hardware_snapshot AS t');
    for (const member of ['"inputs"', '"noSignal"']) expect(dump.rows[0]?.line, member).not.toContain(member);

    // A tick whose unit is not committed produces no frame: the newest one stays the committed tick's.
    const before = meters();
    const left = host.database.failNext(/^COMMIT$/);
    await host.drive(1_000);
    expect(left()).toBe(0);
    expect(host.engine.stats()).toMatchObject({ ticksFailed: 1, suspended: true });
    expect(meters()?.seq).toBeLessThan(20 + 20);
    const held = meters();
    expect(held).toBe(meterFrames(host.publications).at(-1));
    expect(held?.seq).toBeGreaterThanOrEqual(before?.seq ?? 0);

    // Stopped: 503, as for a read of the state. No frame of an earlier start is served afterwards.
    await host.engine.stop();
    expect(() => host.engine.meters()).toThrow(expect.objectContaining({ statusCode: 503, code: 'NOT_READY' }));
    await host.engine.start('resync');
    expect(meters()).toBeNull();
    await host.drive(50);
    expect(meters()).toMatchObject({ seq: 1 });
    expect(meters()).toBe(meterFrames(host.publications).at(-1));
    expect(meters()).not.toBe(held);
  });

  it('at the moment a frame is published, meters() already returns that frame: a reader that the publication wakes is not one frame late', async () => {
    const { host } = await recording('b2a_meters_order');
    const atPublication: boolean[] = [];
    host.app.seams.replace('publish', (publication) => {
      if (publication.kind === 'meters') atPublication.push(host.engine.meters() === publication.frame);
    });
    await host.drive(500);
    expect(atPublication).toEqual(Array.from({ length: 10 }, () => true));
  });
});
