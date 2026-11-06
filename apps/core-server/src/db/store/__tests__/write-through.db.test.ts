// The mapping against PostgreSQL, in both directions and as the two roles (plan row W20;
// database contract MR-1 to MR-9, §6.4, §7.3; spec ENG-4, ENG-10, §8.6):
//
//   - the three other scenarios seeded as `dems_owner` and read back as `dems_app`;
//   - a driven journey (recording, stopping, finalizing, sealed, export, fault, new session)
//     whose row changes are applied AS THE RUNTIME ROLE, one transaction per step, with the
//     chain lock: what the engine host will do. Every statement must be one `dems_app` may
//     issue, and at the end the rows read back must be the engine's state (rehydration).
import { DEFAULT_SEED, buildScenarioState, createIdleState, type ScenarioName, type SimState } from '@dems/shared/sim';
import { drizzle } from 'drizzle-orm/node-postgres';
import type { Pool } from 'pg';
import { describe, expect, it } from 'vitest';
import { useTestDatabase } from '../../../../test/helpers/db';
import {
  diffSlices,
  fromRows,
  healthSnapshotToRow,
  pickDurable,
  summariseChanges,
  verifyStoredAuditRows,
  type DurableSlices,
  type RowChange,
} from '../../mapping';
import { healthSnapshots } from '../../schema';
import { BLOCKING_BOOT_CHECKS, checkStoredChain } from '../../schema/boot-checks';
import { seedDatabase } from '../../seed';
import { FIXED_NOW, createHost, tableChecksums, withoutNegativeZeros, type Host } from '../../../../test/support/seed';
import { StoreError, applyChanges, countAllTables, readStoredRows } from '../store';

const db = useTestDatabase({ template: 'schema' });

const scenarioState = (scenario: ScenarioName): SimState => buildScenarioState(scenario, createIdleState({ now: FIXED_NOW, seed: DEFAULT_SEED }));

/** The durable slices the runtime role reads back: what a rehydration at start would hold. */
async function rehydrate(pool: Pool): Promise<DurableSlices> {
  return drizzle(pool).transaction(async (transaction) => fromRows(await readStoredRows(transaction)));
}

describe('a scenario seed: written by the owner role, read back by the runtime role', () => {
  it.each([
    ['recording', { active_session: 1, alerts: 0 }],
    ['finalizing', { active_session: 1, alerts: 0 }],
    ['fault-demo', { active_session: 1, alerts: 3 }],
  ] as const)('%s: the rows read back are the scenario state, and the boot checks pass', async (scenario, extra) => {
    const target = await db.another({ template: 'schema', slug: `w20_sc_${scenario.replace('-', '_')}` });
    const report = await seedDatabase(target.ownerPool(), { now: FIXED_NOW, scenario, target: 'test' });
    const state = scenarioState(scenario);

    expect(report.counts).toMatchObject({
      ...extra,
      audit_log: state.audit.total,
      events: state.events.length,
      audit_chain_history: 0,
      evidence_items: 13,
      session_history: 13,
      exports: 1,
      engine_counters: 5,
    });
    expect(report).toMatchObject({ scenario, auditHead: { seq: state.audit.total, hash: state.audit.head } });
    console.log(
      `[w20] scenario ${scenario}: audit ${state.audit.total} rows, events ${state.events.length}, session ${state.session?.state}; seed ${report.totalMs.toFixed(0)} ms (transaction ${report.writeMs.toFixed(0)} ms)`,
    );

    expect(await rehydrate(target.appPool())).toStrictEqual(pickDurable(state));
    for (const check of BLOCKING_BOOT_CHECKS) await expect(check.run(target.appPool()), check.id).resolves.toBeUndefined();
    const chain = await checkStoredChain(target.appPool(), { verifyDigests: verifyStoredAuditRows });
    expect(chain).toMatchObject({ ok: true, rowsChecked: state.audit.total, digests: 'ok', linkBreaks: 0 });
    const scenarioRow = await target.ownerPool().query('SELECT scenario, epoch FROM core_state');
    expect(scenarioRow.rows).toEqual([{ scenario, epoch: '0' }]);
  });

  it('a seed with an epoch and a reset instant writes both (what the reset routine passes)', async () => {
    const target = await db.another({ template: 'schema', slug: 'w20_sc_epoch' });
    await seedDatabase(target.ownerPool(), { now: FIXED_NOW, epoch: 7, lastResetAt: FIXED_NOW, target: 'test' });
    const { rows } = await target.ownerPool().query('SELECT epoch, last_reset_at, seeded_at FROM core_state');
    expect(rows).toEqual([{ epoch: '7', last_reset_at: String(FIXED_NOW), seeded_at: String(FIXED_NOW) }]);
    expect((await rehydrate(target.appPool())).meta.epoch).toBe(7);
  });
});

describe('write-through as the runtime role, and rehydration', () => {
  /** One unit of work: the changes since the last write, in one transaction of `dems_app`. */
  async function harness(): Promise<{ host: Host; pool: Pool; commit: (label: string) => Promise<RowChange[]>; log: string[] }> {
    await seedDatabase(db.ownerPool(), { now: FIXED_NOW, scenario: 'recording', target: 'test' });
    const host = await createHost({ scenario: 'recording' });
    const pool = db.appPool();
    let written = host.state();
    const log: string[] = [];
    const commit = async (label: string): Promise<RowChange[]> => {
      const next = host.state();
      const changes = diffSlices(written, next, host.now());
      const expectedHead = { seq: written.audit.total, hash: written.audit.head };
      await drizzle(pool).transaction((transaction) => applyChanges(transaction, changes, { expectedHead }));
      written = next;
      log.push(`${label}: ${JSON.stringify(summariseChanges(changes))}`);
      return changes;
    };
    return { host, pool, commit, log };
  }

  it('the whole journey: every change is a statement dems_app may issue, and the rows read back are the engine state', async () => {
    const { host, pool, commit, log } = await harness();
    const investigator = host.operator('INVESTIGATOR');
    const supervisor = host.operator('SUPERVISOR');
    const { actions } = host.sim;
    const expectStored = async (): Promise<void> => {
      expect(await rehydrate(pool)).toStrictEqual(withoutNegativeZeros(host.state()));
    };

    // The seeded database IS the engine's start state for this scenario and instant.
    await expectStored();

    host.drive(1_000);
    await commit('1 s of recording');
    host.drive(30_000);
    await commit('30 s of recording');
    await expectStored();

    host.runAs(investigator, () => actions.addMarker('Key statement B'));
    await commit('marker');
    host.runAs(investigator, () => actions.addNote('Subject asked for a break'));
    await commit('note');
    host.runAs(investigator, () => actions.stopRecording('Interview completed'));
    await commit('stop');
    expect(host.state().session?.state).toBe('STOPPING');
    await expectStored();
    host.drive(1_600);
    await commit('finalizing');
    expect(host.state().session?.state).toBe('FINALIZING');
    await expectStored();
    host.drive(15_000);
    await commit('sealed');
    expect(host.state().session?.state).toBe('SEALED');
    await expectStored();

    const sealedId = host.state().evidence[13]?.id ?? '';
    host.runAs(supervisor, () => actions.exportEvidence(sealedId, { reason: 'Prosecutor request', destination: 'Case file transfer' }));
    await commit('evidence export');
    host.runAs(supervisor, () => actions.exportAudit({ reason: 'Internal review', destination: 'Audit export' }));
    await commit('audit export');
    host.runAs(supervisor, () => actions.exportLogs({ reason: 'Service request', destination: 'Log bundle' }));
    await commit('log bundle export');
    host.runAs(supervisor, () => actions.verify(sealedId));
    await commit('verify');
    host.runAs(supervisor, () => actions.archiveEvidence(sealedId));
    await commit('archive');
    host.runAs(investigator, () => actions.acknowledgeSummary(host.state().session?.id ?? ''));
    await commit('summary acknowledged');
    await expectStored();

    // A new session replaces the sealed one (DELETE and INSERT), then a fault and its alert.
    const caseNumber = host.runAs(investigator, () => actions.scanCaseNumber());
    host.runAs(investigator, () =>
      actions.createSession({
        caseNumber,
        subjectType: 'SAKSI',
        subjectName: 'Saksi Uji',
        investigatorId: investigator.id,
        room: host.state().device.room,
        profileId: 'STANDARD_1080P25',
      }),
    );
    const replaced = await commit('new session');
    expect(replaced.filter((change) => change.table === 'activeSession').map((change) => change.op)).toEqual(['delete', 'insert']);
    host.runAs(investigator, () => actions.beginPrecheck());
    await commit('precheck started');
    host.drive(6_000);
    await commit('precheck done');
    actions.inject('GNSS_LOSS');
    await commit('fault raised');
    actions.acknowledgeAlert(host.state().alerts[0]?.id ?? '');
    await commit('alert acknowledged');
    actions.clearFault('GNSS_LOSS');
    await commit('fault cleared');
    host.runAs(host.operator('TECHNICIAN'), () => actions.setStoragePolicy({ retentionPolicy: 'DAYS_30', retentionDays: 30, autoArchive: false }));
    actions.updateSettings({ timeFormat: '12', notifySound: true });
    await commit('policy and settings');
    host.runAs(investigator, () => actions.cancel());
    const cancelled = await commit('session cancelled');
    expect(host.state().session).toBeNull();
    expect(cancelled.filter((change) => change.table === 'activeSession')).toEqual([{ op: 'delete', table: 'activeSession' }]);
    await expectStored();

    // The end state, table by table.
    const state = host.state();
    const counts = await countAllTables(drizzle(db.ownerPool()));
    expect(counts).toMatchObject({
      audit_log: state.audit.total,
      events: state.meta.counters.event - 1,
      session_history: 14,
      evidence_items: 14,
      // Fix wave J: 48 of the seed (its never-sealed item has none) + the EIGHT of the session this
      // journey seals (D60 / D61, 2026-11-04: a v2 seal carries four video tracks and four audio
      // channels, was four in the two-track / two-role shape).
      evidence_tracks: 56,
      exports: 4,
      engine_counters: 6,
      active_session: 0,
      alerts: 1,
      audit_chain_history: 0,
    });
    const exported = await db.ownerPool().query('SELECT id, scope, evidence_id IS NOT NULL AS has_evidence, operator_id FROM exports ORDER BY id');
    expect(exported.rows).toEqual([
      { id: 'EXP-000031', scope: 'EVIDENCE', has_evidence: true, operator_id: 'OPR-002' },
      { id: 'EXP-000032', scope: 'EVIDENCE', has_evidence: true, operator_id: supervisor.id },
      { id: 'EXP-000033', scope: 'AUDIT', has_evidence: false, operator_id: supervisor.id },
      { id: 'EXP-000034', scope: 'LOGS', has_evidence: false, operator_id: supervisor.id },
    ]);
    // The stored chain, all rows: head equal to the engine's, digests verified by the shared code.
    const chain = await checkStoredChain(pool, { limit: 100_000, verifyDigests: verifyStoredAuditRows });
    expect(chain).toMatchObject({ ok: true, rowsChecked: state.audit.total, lastSeq: state.audit.total, digests: 'ok', linkBreaks: 0 });
    for (const check of BLOCKING_BOOT_CHECKS) await expect(check.run(pool), check.id).resolves.toBeUndefined();
    expect(host.errors).toEqual([]);
    console.log(`[w20] write-through journey as dems_app: ${log.length} units of work, ${state.audit.total} audit rows, ${state.meta.counters.event - 1} events\n  ${log.join('\n  ')}`);
  });

  it('MR-7 against the table: the demo fault alters a ring row, and the stored row stays as it was', async () => {
    const pool = db.appPool();
    const host = await createHost({ scenario: 'recording' });
    // The engine restarts from the stored state of the journey above.
    host.sim.store.setState(await rehydrate(pool));
    let written = host.state();
    const before = await tableChecksums(db.ownerPool());

    host.sim.actions.inject('AUDIT_TAMPER');
    const next = host.state();
    const altered = next.audit.rows.find((row, index) => row.seq <= written.audit.total && row.message !== written.audit.rows[index]?.message);
    expect(altered).toBeDefined();
    const changes = diffSlices(written, next, host.now());
    await drizzle(pool).transaction((transaction) => applyChanges(transaction, changes, { expectedHead: { seq: written.audit.total, hash: written.audit.head } }));
    written = next;

    const stored = await db.ownerPool().query<{ message: string }>('SELECT message FROM audit_log WHERE seq = $1', [altered?.seq]);
    expect(stored.rows[0]?.message).not.toBe(altered?.message);
    expect(`${stored.rows[0]?.message} [altered]`).toBe(altered?.message);
    const chain = await checkStoredChain(pool, { limit: 100_000, verifyDigests: verifyStoredAuditRows });
    expect(chain).toMatchObject({ ok: true, digests: 'ok', lastSeq: next.audit.total });
    expect((await tableChecksums(db.ownerPool()))['audit_log']).not.toBe(before['audit_log']);
    // A rehydrated ring has no altered row: the overlay does not survive a restart.
    const rehydrated = await rehydrate(pool);
    expect(rehydrated.audit.rows.find((row) => row.seq === altered?.seq)?.message).toBe(stored.rows[0]?.message);
  });

  it('AP-6: a head that is not the one the engine committed last stops the unit of work; nothing is written', async () => {
    const pool = db.appPool();
    const host = await createHost({ scenario: 'recording' });
    host.sim.store.setState(await rehydrate(pool));
    const written = host.state();
    host.sim.actions.inject('GNSS_LOSS');
    const changes = diffSlices(written, host.state(), host.now());
    expect(changes.some((change) => change.table === 'auditLog')).toBe(true);
    const before = await tableChecksums(db.ownerPool());
    const attempt = drizzle(pool).transaction((transaction) =>
      applyChanges(transaction, changes, { expectedHead: { seq: written.audit.total - 1, hash: written.audit.head } }),
    );
    await expect(attempt).rejects.toBeInstanceOf(StoreError);
    await expect(attempt).rejects.toMatchObject({ code: 'AUDIT_HEAD_DIVERGED', table: 'audit_chain_head' });
    expect(await tableChecksums(db.ownerPool())).toEqual(before);
  });

  it('a refused statement rolls the whole unit of work back, and its error names table, SQLSTATE and constraint only', async () => {
    const pool = db.appPool();
    const before = await tableChecksums(db.ownerPool());
    const head = await db.ownerPool().query<{ seq: string; hash: string }>('SELECT seq, hash FROM audit_chain_head');
    const seq = Number(head.rows[0]?.seq);
    const forged: RowChange[] = [
      { op: 'update', table: 'storagePolicy', key: { singleton: true }, set: { retentionDays: 90, updatedAt: FIXED_NOW } },
      // A column the runtime role may not update: the sealed manifest hash of an evidence item.
      { op: 'update', table: 'evidenceItems', key: { id: 'EV-20261001-0013' }, set: { manifestHash: 'a'.repeat(64) } },
    ];
    const refused = drizzle(pool).transaction((transaction) => applyChanges(transaction, forged));
    await expect(refused).rejects.toMatchObject({ code: 'WRITE_FAILED', table: 'evidence_items', sqlState: '42501' });
    await expect(refused).rejects.toThrow(/^WRITE_FAILED: evidence_items: the server answered 42501\.$/);

    // A row that does not continue the chain is refused by the guard trigger (ZA001).
    const gap: RowChange[] = [
      {
        op: 'insert',
        table: 'auditLog',
        rows: [
          {
            seq: seq + 2,
            id: `AUD-${String(seq + 2).padStart(6, '0')}`,
            at: FIXED_NOW,
            type: 'SYSTEM_BOOT',
            category: 'SYSTEM',
            severity: 'INFO',
            actorId: null,
            message: 'gap',
            sessionId: null,
            evidenceId: null,
            deviceId: null,
            details: {},
            prevHash: head.rows[0]?.hash ?? '',
            hash: 'b'.repeat(64),
          },
        ],
      },
    ];
    await expect(drizzle(pool).transaction((transaction) => applyChanges(transaction, gap))).rejects.toMatchObject({
      code: 'WRITE_FAILED',
      table: 'audit_log',
      sqlState: 'ZA001',
    });
    // An update that hits no row is an error, not a silent no-op.
    const missing: RowChange[] = [{ op: 'update', table: 'alerts', key: { id: 'ALR-999999' }, set: { acknowledged: true } }];
    await expect(drizzle(pool).transaction((transaction) => applyChanges(transaction, missing))).rejects.toMatchObject({ code: 'ROW_NOT_FOUND', table: 'alerts' });
    expect(await tableChecksums(db.ownerPool())).toEqual(before);
  });

  it('the health snapshot row is one dems_app may insert, at an interval and at a fault', async () => {
    const pool = db.appPool();
    const state = scenarioState('fault-demo');
    const database = drizzle(pool);
    await database.insert(healthSnapshots).values(healthSnapshotToRow(state, FIXED_NOW, { cause: 'INTERVAL' }));
    await database.insert(healthSnapshots).values(healthSnapshotToRow(state, FIXED_NOW + 1, { cause: 'FAULT_RAISED', faultKind: 'GNSS_LOSS' }));
    const { rows } = await db.ownerPool().query('SELECT cause, fault_kind, session_state, active_faults, time_source, fan_ok FROM health_snapshots ORDER BY at');
    expect(rows).toEqual([
      { cause: 'INTERVAL', fault_kind: null, session_state: 'RECORDING', active_faults: 3, time_source: 'NTP', fan_ok: true },
      { cause: 'FAULT_RAISED', fault_kind: 'GNSS_LOSS', session_state: 'RECORDING', active_faults: 3, time_source: 'NTP', fan_ok: true },
    ]);
  });
});
