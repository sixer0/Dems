// Change detection (plan row W20; database contract MR-6, MR-7, MR-8; spec ENG-4, ENG-10).
//
// A model check, without a database: an in-memory copy of the tables starts as the rows of a
// state, every change list of `diffSlices` is applied to it step by step along a driven journey,
// and at the end the model must hold exactly the state the engine holds: `fromRows(model)` equals
// the durable slices. The same journey against PostgreSQL, as the runtime role, is
// `../../store/__tests__/write-through.db.test.ts`.
import {
  DEFAULT_SEED,
  buildScenarioState,
  createIdleState,
  type SimState,
} from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { FIXED_NOW, asStored, createHost, withoutNegativeZeros, type Host } from '../../../../test/support/seed';
import {
  MappingError,
  RUNTIME_UPDATABLE_COLUMNS,
  TABLE_SQL_NAMES,
  diffSlices,
  diffSnapshot,
  diffStored,
  exportRowsFromAudit,
  newAuditRows,
  newEvents,
  fromRows,
  summariseChanges,
  toRows,
  verifyStoredAuditRows,
  type MappedRows,
  type RowChange,
  type RowContext,
} from '..';

const contextAt = (at: number): RowContext => ({ at, seededAt: FIXED_NOW, lastResetAt: null });
const idle = (): SimState => createIdleState({ now: FIXED_NOW, seed: DEFAULT_SEED });

/** The primary key columns of each table, by the property names of the typed schema. */
const PRIMARY_KEYS: { readonly [K in keyof MappedRows]: readonly string[] } = {
  operators: ['id'],
  coreDevice: ['singleton'],
  coreState: ['singleton'],
  storagePolicy: ['singleton'],
  consoleSettings: ['singleton'],
  captureDevices: ['id'],
  captureConfig: ['singleton'],
  engineCounters: ['name'],
  hardwareSnapshot: ['singleton'],
  sessionHistory: ['id'],
  evidenceItems: ['id'],
  evidenceTracks: ['evidenceId', 'trackId'],
  evidenceCustody: ['evidenceId', 'seq'],
  exportRecords: ['id'],
  activeSession: ['singleton'],
  alerts: ['id'],
  auditLog: ['seq'],
  auditChainHead: ['singleton'],
  events: ['seq'],
};

/** An in-memory stand-in for the tables: it enforces primary keys, the chain guard and "one row per update". */
class TableModel {
  readonly rows: MappedRows;

  constructor(initial: MappedRows) {
    this.rows = Object.fromEntries(Object.entries(initial).map(([table, rows]) => [table, rows.map((row: object) => ({ ...row }))])) as unknown as MappedRows;
  }

  private keyOf(table: keyof MappedRows, row: Record<string, unknown>): string {
    return PRIMARY_KEYS[table].map((column) => String(row[column])).join('|');
  }

  apply(changes: readonly RowChange[]): void {
    for (const change of changes) {
      const rows = this.rows[change.table] as Record<string, unknown>[];
      if (change.op === 'delete') {
        expect(rows.length, 'a DELETE removes the one session row').toBe(1);
        rows.length = 0;
      } else if (change.op === 'insert') {
        for (const row of change.rows as Record<string, unknown>[]) {
          const key = this.keyOf(change.table, row);
          expect(rows.some((existing) => this.keyOf(change.table, existing) === key), `${TABLE_SQL_NAMES[change.table]} ${key} inserted twice`).toBe(false);
          if (change.table === 'auditLog') {
            // The guard trigger: the row must continue the head, which then moves.
            const head = this.rows.auditChainHead[0];
            expect(row['seq']).toBe((head?.seq ?? 0) + 1);
            expect(row['prevHash']).toBe(head?.hash);
            this.rows.auditChainHead[0] = { singleton: true, seq: row['seq'] as number, hash: row['hash'] as string };
          }
          rows.push({ ...row });
        }
      } else {
        const matches = rows.filter((row) => Object.entries(change.key).every(([column, value]) => row[column] === value));
        expect(matches, `an UPDATE of ${TABLE_SQL_NAMES[change.table]} must hit exactly one row`).toHaveLength(1);
        Object.assign(matches[0] as object, change.set);
      }
    }
  }
}

/** MR-8: an UPDATE names only columns the runtime role may update (any column of `active_session`). */
function expectWritable(changes: readonly RowChange[]): void {
  for (const change of changes) {
    if (change.op !== 'update') continue;
    expect(Object.keys(change.set).length).toBeGreaterThan(0);
    if (change.table === 'activeSession') continue;
    const allowed: readonly string[] = RUNTIME_UPDATABLE_COLUMNS[change.table];
    for (const column of Object.keys(change.set)) expect(allowed, `${TABLE_SQL_NAMES[change.table]}.${column}`).toContain(column);
  }
}

function caught(work: () => unknown): MappingError {
  try {
    work();
  } catch (error) {
    if (error instanceof MappingError) return error;
    throw error;
  }
  throw new Error('expected a MappingError, and nothing was thrown');
}

/** A journey harness: after every step the difference to the last written state goes into the model. */
async function journey(scenario: 'idle' | 'recording'): Promise<{ host: Host; model: TableModel; step: (label: string) => RowChange[]; log: string[] }> {
  const host = await createHost({ scenario });
  let written = host.state();
  const model = new TableModel(toRows(written, contextAt(host.now())));
  const log: string[] = [];
  const step = (label: string): RowChange[] => {
    const next = host.state();
    const changes = diffSlices(written, next, host.now());
    expectWritable(changes);
    // The two halves together are the whole, whatever the order.
    expect([...diffStored(written, next, host.now()), ...diffSnapshot(written, next, host.now())]).toHaveLength(changes.length);
    model.apply(changes);
    written = next;
    log.push(`${label}: ${JSON.stringify(summariseChanges(changes))}`);
    return changes;
  };
  return { host, model, step, log };
}

/** The model must now be the engine's state: every slice, through the one way back. */
function expectModelIsState(model: TableModel, state: SimState): void {
  expect(fromRows(asStored(model.rows))).toStrictEqual(withoutNegativeZeros(state));
  // The tables keep every audit row and event, and the chain they hold verifies as a whole.
  expect(model.rows.auditLog).toHaveLength(state.audit.total);
  expect(model.rows.events).toHaveLength(state.meta.counters.event - 1);
  expect(model.rows.auditChainHead).toEqual([{ singleton: true, seq: state.audit.total, hash: state.audit.head }]);
  const ordered = [...model.rows.auditLog].sort((a, b) => a.seq - b.seq);
  expect(verifyStoredAuditRows(ordered, { dropped: 0, head: state.audit.head })).toEqual({ ok: true });
  // One export record per audit row that records an accepted export.
  expect(model.rows.exportRecords.map((row) => row.id).sort()).toEqual(
    exportRowsFromAudit(ordered.map((row) => ({ ...row, type: row.type as never })))
      .map((row) => row.id)
      .sort(),
  );
}

describe('write-through along a driven journey (model check)', () => {
  it('recording, stopping, finalizing, sealed, export, verify, archive: the tables follow the engine exactly', async () => {
    const { host, model, step, log } = await journey('recording');
    const investigator = host.operator('INVESTIGATOR');
    const supervisor = host.operator('SUPERVISOR');
    const { actions } = host.sim;

    // 1 Hz progress while recording: the session row's progress columns, never its large JSON.
    host.drive(1_000);
    const progress = step('1 s of recording');
    const sessionWrite = progress.find((change) => change.op === 'update' && change.table === 'activeSession');
    expect(sessionWrite?.op === 'update' ? Object.keys(sessionWrite.set).sort() : null).toEqual(['bytesWritten', 'updatedAt']);
    const snapshotWrite = progress.find((change) => change.op === 'update' && change.table === 'hardwareSnapshot');
    expect(snapshotWrite?.op === 'update' ? Object.keys(snapshotWrite.set) : []).toEqual(expect.arrayContaining(['health', 'storage', 'writtenAt']));
    expect(snapshotWrite?.op === 'update' ? Object.keys(snapshotWrite.set) : []).not.toContain('cameras');

    host.drive(60_000);
    const minute = step('one minute of recording');
    const appended = minute.find((change) => change.op === 'insert' && change.table === 'auditLog');
    expect(appended?.op === 'insert' ? appended.rows.length : 0).toBeGreaterThan(0);
    expectModelIsState(model, host.state());

    host.runAs(investigator, () => actions.addMarker('Key statement B'));
    const marker = step('marker');
    expect(summariseChanges(marker)).toMatchObject({ auditLog: { inserted: 1 }, activeSession: { updated: 1 } });
    host.runAs(investigator, () => actions.addNote('Subject asked for a break'));
    step('note');
    host.runAs(investigator, () => actions.snapshot());
    step('snapshot');

    host.runAs(investigator, () => actions.stopRecording('Interview completed'));
    step('stop');
    host.drive(1_600);
    step('finalizing');
    expect(host.state().session?.state).toBe('FINALIZING');
    host.drive(15_000);
    const sealedChanges = step('sealed');
    expect(host.state().session?.state).toBe('SEALED');
    // MR-6: the history entry before the evidence item, before its tracks and custody entries.
    const order = sealedChanges.map((change) => change.table);
    expect(order.indexOf('sessionHistory')).toBeLessThan(order.indexOf('evidenceItems'));
    expect(order.indexOf('evidenceItems')).toBeLessThan(order.indexOf('evidenceTracks'));
    expect(order.indexOf('evidenceTracks')).toBeLessThan(order.indexOf('evidenceCustody'));
    expect(order.indexOf('evidenceCustody')).toBeLessThan(order.indexOf('auditLog'));
    expect(order.indexOf('auditLog')).toBeLessThan(order.indexOf('events'));
    expect(summariseChanges(sealedChanges)).toMatchObject({
      sessionHistory: { inserted: 1 },
      evidenceItems: { inserted: 1 },
      // D61 (2026-11-04): the live v2 seal names four camera files AND four audio channel files -
      // four `TRACK_ORDER` rows plus four file-only rows (six under D60, four before).
      evidenceTracks: { inserted: 8 },
      coreState: { updated: 1 },
    });
    expectModelIsState(model, host.state());

    const evidenceId = host.state().evidence[13]?.id ?? '';
    host.runAs(supervisor, () => actions.exportEvidence(evidenceId, { reason: 'Prosecutor request', destination: 'Case file transfer' }));
    const exported = step('export');
    expect(summariseChanges(exported)).toMatchObject({
      engineCounters: { inserted: 1 },
      evidenceItems: { updated: 1 },
      evidenceCustody: { inserted: 1 },
      exportRecords: { inserted: 1 },
      auditLog: { inserted: 1 },
      events: { inserted: 1 },
    });
    const itemUpdate = exported.find((change) => change.op === 'update' && change.table === 'evidenceItems');
    expect(itemUpdate?.op === 'update' ? Object.keys(itemUpdate.set).sort() : null).toEqual(['lifecycleStage', 'status', 'updatedAt']);
    expect(model.rows.exportRecords.map((row) => row.id)).toEqual(['EXP-000031', 'EXP-000032']);

    host.runAs(supervisor, () => actions.exportAudit({ reason: 'Internal review', destination: 'Audit export' }));
    expect(summariseChanges(step('audit export'))).toMatchObject({ engineCounters: { updated: 1 }, exportRecords: { inserted: 1 } });
    host.runAs(supervisor, () => actions.verify(evidenceId));
    const verified = step('verify');
    const verifyUpdate = verified.find((change) => change.op === 'update' && change.table === 'evidenceItems');
    expect(verifyUpdate?.op === 'update' ? Object.keys(verifyUpdate.set).sort() : null).toEqual(['updatedAt', 'verificationAt', 'verificationStatus']);
    host.runAs(supervisor, () => actions.archiveEvidence(evidenceId));
    step('archive');
    host.runAs(investigator, () => actions.acknowledgeSummary(host.state().session?.id ?? ''));
    step('summary acknowledged');
    host.runAs(host.operator('TECHNICIAN'), () => actions.setStoragePolicy({ retentionPolicy: 'DAYS_30', retentionDays: 30, autoArchive: false }));
    actions.updateSettings({ timeFormat: '12' });
    const preferences = step('policy and settings');
    expect(summariseChanges(preferences)).toMatchObject({ storagePolicy: { updated: 1 }, consoleSettings: { updated: 1 } });
    const settingsUpdate = preferences.find((change) => change.op === 'update' && change.table === 'consoleSettings');
    expect(settingsUpdate?.op === 'update' ? Object.keys(settingsUpdate.set).sort() : null).toEqual(['timeFormat', 'updatedAt']);

    expectModelIsState(model, host.state());
    expect(model.rows.exportRecords.map((row) => [row.id, row.scope])).toEqual([
      ['EXP-000031', 'EVIDENCE'],
      ['EXP-000032', 'EVIDENCE'],
      ['EXP-000033', 'AUDIT'],
    ]);
    expect(host.errors).toEqual([]);
    expect(log.length).toBeGreaterThan(10);
  });

  it('a fault, its alert, the recovery, the incomplete close, then a new session: insert, update, delete of the session row', async () => {
    const { host, model, step } = await journey('recording');
    const investigator = host.operator('INVESTIGATOR');
    const { actions } = host.sim;

    actions.inject('POWER_FAIL');
    expect(summariseChanges(step('power fail'))).toMatchObject({ alerts: { inserted: 1 }, activeSession: { updated: 1 }, auditLog: { inserted: 1 } });
    const alertId = host.state().alerts[0]?.id ?? '';
    actions.acknowledgeAlert(alertId);
    const acknowledged = step('alert acknowledged');
    expect(acknowledged).toEqual([{ op: 'update', table: 'alerts', key: { id: alertId }, set: { acknowledged: true } }]);

    host.runAs(investigator, () => actions.recover());
    step('recover');
    host.drive(4_000);
    const closed = step('incomplete close');
    expect(host.state().session).toBeNull();
    expect(closed.filter((change) => change.table === 'activeSession')).toEqual([{ op: 'delete', table: 'activeSession' }]);
    expect(summariseChanges(closed)).toMatchObject({ sessionHistory: { inserted: 1 }, evidenceItems: { inserted: 1 } });
    expect(model.rows.activeSession).toEqual([]);
    expectModelIsState(model, host.state());

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
    const created = step('new session');
    expect(created.filter((change) => change.table === 'activeSession').map((change) => change.op)).toEqual(['insert']);
    expectModelIsState(model, host.state());
    expect(host.errors).toEqual([]);
  });

  it('a finished session is replaced by the next one: DELETE, then INSERT', () => {
    const first = buildScenarioState('recording', idle());
    const session = first.session;
    if (session === null) throw new Error('the recording scenario has a session');
    const second: SimState = { ...first, session: { ...session, id: 'SES-20261001-0025' } };
    const changes = diffSlices(first, second, FIXED_NOW);
    expect(changes.map((change) => `${change.op} ${change.table}`)).toEqual(['delete activeSession', 'insert activeSession']);
  });

  it('MR-7: an altered ring row is never written; only rows above the stored head are', async () => {
    const { host, model, step } = await journey('recording');
    host.drive(5_000);
    step('5 s');
    const before = host.state().audit;
    host.sim.actions.inject('AUDIT_TAMPER');
    const after = host.state().audit;
    const altered = after.rows.filter((row, index) => row.seq <= before.total && row.message !== before.rows[index]?.message);
    expect(altered).toHaveLength(1);

    const changes = step('audit tamper');
    const inserted = changes.flatMap((change) => (change.op === 'insert' && change.table === 'auditLog' ? change.rows : []));
    expect(inserted.length).toBe(after.total - before.total);
    expect(inserted.every((row) => row.seq > before.total)).toBe(true);
    // The stored copy of the altered row is the original, and the stored chain still verifies.
    const stored = model.rows.auditLog.find((row) => row.seq === altered[0]?.seq);
    expect(stored?.message).toBe(before.rows.find((row) => row.seq === altered[0]?.seq)?.message);
    const ordered = [...model.rows.auditLog].sort((a, b) => a.seq - b.seq);
    expect(verifyStoredAuditRows(ordered, { dropped: 0, head: after.head })).toEqual({ ok: true });

    host.drive(20_000);
    step('20 s more');
    expect(model.rows.auditLog).toHaveLength(host.state().audit.total);
  });

  it('the diff is against the last WRITTEN state: one write a second sees the same rows as one per tick', async () => {
    const { host } = await journey('recording');
    const start = host.state();
    host.drive(10_000);
    const end = host.state();
    const once = diffSlices(start, end, host.now());
    const fresh = once.flatMap((change) => (change.op === 'insert' && change.table === 'auditLog' ? change.rows.map((row) => row.seq) : []));
    expect(fresh).toEqual(end.audit.rows.filter((row) => row.seq > start.audit.total).map((row) => row.seq));
    const model = new TableModel(toRows(start, contextAt(FIXED_NOW)));
    model.apply(once);
    expectModelIsState(model, end);
  });
});

describe('the new audit rows and events, in the shared shape (for a writer that takes shared rows)', () => {
  it('are exactly the rows the diff inserts, and nothing when the slices did not change', async () => {
    const host = await createHost({ scenario: 'recording' });
    const before = host.state();
    host.drive(40_000);
    host.runAs(host.operator('INVESTIGATOR'), () => host.sim.actions.addMarker('Key statement B'));
    const after = host.state();

    const rows = newAuditRows(before, after);
    const events = newEvents(before, after);
    expect(rows.length).toBe(after.audit.total - before.audit.total);
    expect(rows.length).toBeGreaterThan(2);
    expect(rows.map((row) => row.seq)).toEqual(Array.from({ length: rows.length }, (_, index) => before.audit.total + 1 + index));
    expect(events.length).toBe(after.meta.counters.event - before.meta.counters.event);
    expect(events.length).toBeGreaterThan(0);
    // The same objects the engine holds: nothing is copied or re-hashed.
    expect(rows.every((row) => after.audit.rows.includes(row))).toBe(true);
    expect(events.every((event) => after.events.includes(event))).toBe(true);
    // And they are what the diff inserts.
    const changes = diffSlices(before, after, host.now());
    const inserted = changes.flatMap((change) => (change.op === 'insert' && change.table === 'auditLog' ? change.rows.map((row) => row.seq) : []));
    expect(inserted).toEqual(rows.map((row) => row.seq));
    const insertedEvents = changes.flatMap((change) => (change.op === 'insert' && change.table === 'events' ? change.rows.map((row) => row.seq) : []));
    expect(insertedEvents).toEqual(events.map((event) => event.seq));

    expect(newAuditRows(before, before)).toEqual([]);
    expect(newEvents(before, before)).toEqual([]);
  });
});

describe('what the write-through never writes', () => {
  const state = idle();

  it('the operators table: the engine slice is a mirror of it, not its source', () => {
    const changed: SimState = { ...state, operators: state.operators.map((operator) => ({ ...operator, role: 'TECHNICIAN' as const })) };
    expect(diffSlices(state, changed, FIXED_NOW)).toEqual([]);
  });

  it('the unmapped slices', () => {
    const changed: SimState = {
      ...state,
      clock: { ...state.clock, now: FIXED_NOW + 50 },
      auth: { status: 'SIGNED_IN', operatorId: 'OPR-001', method: null, issuedAt: FIXED_NOW, lastActivityAt: FIXED_NOW },
      authLockout: { failures: [1], lockedUntil: 2 },
      pairing: { ...state.pairing, state: 'UNPAIRED' },
    };
    expect(diffSlices(state, changed, FIXED_NOW)).toEqual([]);
  });

  it('a software update is the one change of the device record: two columns and the row time', () => {
    const updated: SimState = {
      ...state,
      device: { ...state.device, softwareVersion: '2.5.0', identity: { ...state.device.identity, coreSoftwareVersion: '2.5.0' } },
    };
    expect(diffSlices(state, updated, FIXED_NOW + 1)).toEqual([
      {
        op: 'update',
        table: 'coreDevice',
        key: { singleton: true },
        set: { softwareVersion: '2.5.0', coreSoftwareVersion: '2.5.0', updatedAt: FIXED_NOW + 1 },
      },
    ]);
  });
});

describe('a change the runtime role cannot write is refused, not skipped', () => {
  const state = idle();
  const first = state.evidence[0];
  if (first === undefined) throw new Error('the dataset has evidence');

  it.each([
    ['a sealed column of an evidence item', { ...state, evidence: [{ ...first, manifestHash: 'f'.repeat(64) }, ...state.evidence.slice(1)] }, 'IMMUTABLE_CHANGED'],
    ['a sealed track hash', { ...state, evidence: [{ ...first, tracks: first.tracks.map((track) => ({ ...track, sha256: 'e'.repeat(64) })) }, ...state.evidence.slice(1)] }, 'IMMUTABLE_CHANGED'],
    ['a custody entry that changed', { ...state, evidence: [{ ...first, custody: first.custody.map((entry) => ({ ...entry, detail: 'x' })) }, ...state.evidence.slice(1)] }, 'IMMUTABLE_CHANGED'],
    ['a custody entry that disappeared', { ...state, evidence: [{ ...first, custody: first.custody.slice(1) }, ...state.evidence.slice(1)] }, 'IMMUTABLE_CHANGED'],
    ['an evidence item that disappeared', { ...state, evidence: state.evidence.slice(1) }, 'NOT_WRITABLE'],
    ['a history entry that changed', { ...state, sessionHistory: state.sessionHistory.map((entry) => ({ ...entry, durationMs: 1 })) }, 'IMMUTABLE_CHANGED'],
    ['a history entry that disappeared', { ...state, sessionHistory: state.sessionHistory.slice(1) }, 'NOT_WRITABLE'],
    ['the seed of the state', { ...state, meta: { ...state.meta, seed: 7 } }, 'NOT_WRITABLE'],
    ['the loaded scenario (that is a reset)', { ...state, meta: { ...state.meta, scenario: 'recording' as const } }, 'NOT_WRITABLE'],
    ['the name of the device', { ...state, device: { ...state.device, name: 'Room 2' } }, 'NOT_WRITABLE'],
    ['a counter that disappeared', { ...state, meta: { ...state.meta, counters: { event: 60, session: 24, caseNumber: 8, evidence: 14 } as never } }, 'NOT_WRITABLE'],
    ['a chain that lost rows', { ...state, audit: { ...state.audit, total: 81 } }, 'RING_INCOMPLETE'],
    ['more new audit rows than the ring holds', { ...state, audit: { ...state.audit, total: 90 } }, 'RING_INCOMPLETE'],
    ['more new events than the ring holds', { ...state, events: [...state.events], meta: { ...state.meta, counters: { ...state.meta.counters, event: 70 } } }, 'RING_INCOMPLETE'],
  ] as const)('%s', (_label, next, code) => {
    expect(caught(() => diffSlices(state, next as SimState, FIXED_NOW)).code).toBe(code);
  });

  it('the message names the place and never a value of the row', () => {
    const error = caught(() => diffSlices(state, { ...state, evidence: [{ ...first, subjectName: 'Nama Lain' }, ...state.evidence.slice(1)] }, FIXED_NOW));
    expect(error.place).toBe(`evidence_items (${first.id})`);
    expect(error.message).toContain('subjectName');
    expect(error.message).not.toContain('Nama Lain');
  });

  it('the seven columns of an evidence item that may change do change, and only they are named', () => {
    const next: SimState = {
      ...state,
      evidence: [
        { ...first, status: 'ARCHIVED', lifecycleStage: 'RETENTION_ARCHIVE_DISPOSITION', verification: { status: 'PASS', at: FIXED_NOW }, tampered: true, tamperedTrackId: 'VIDEO-01' },
        ...state.evidence.slice(1),
      ],
    };
    const changes = diffSlices(state, next, FIXED_NOW + 9);
    expect(changes).toEqual([
      {
        op: 'update',
        table: 'evidenceItems',
        key: { id: first.id },
        set: {
          status: 'ARCHIVED',
          lifecycleStage: 'RETENTION_ARCHIVE_DISPOSITION',
          verificationStatus: 'PASS',
          verificationAt: FIXED_NOW,
          tampered: true,
          tamperedTrackId: 'VIDEO-01',
          updatedAt: FIXED_NOW + 9,
        },
      },
    ]);
  });
});

// D62c (2026-11-05): the boot-load exception on the adapter guard. The stored registry of the
// bench adopted cameras under ids that D60 / D61 later made built-ins; the state's placeholder
// names no adapter and the loaded fact names the real one. That move is a LOAD, not a runtime
// mutation of an immutable column; every runtime move on a NAMED adapter keeps throwing.
describe('the adapter guard of the capture diff (D62c)', () => {
  type SliceDevice = SimState['captureDevices']['devices'][number] & { adapter?: string };
  const withAdapter = (state: SimState, id: string, adapter: string | undefined): SimState => ({
    ...state,
    captureDevices: {
      ...state.captureDevices,
      devices: state.captureDevices.devices.map((device) => {
        if (device.id !== id) return device;
        const copy: SliceDevice = { ...(device as SliceDevice) };
        if (adapter === undefined) delete copy.adapter; else copy.adapter = adapter;
        return copy as SimState['captureDevices']['devices'][number];
      }),
    },
  });

  it('lets the stored registry REPLACE a placeholder built-in (D62c)', () => {
    const state = idle();
    const placeholder = state.captureDevices.devices.find((device) => device.id === 'CAM-03');
    expect(placeholder).toBeDefined();
    expect((placeholder as SliceDevice).adapter).toBeUndefined();
    const loaded = withAdapter(state, 'CAM-03', 'ONVIF_RTSP');
    // The loaded fact is the stored row: it also names the camera the registry holds (the
    // bench's real model and address), which is what the whole boot-load writes back.
    const stored: SimState = {
      ...loaded,
      captureDevices: {
        ...loaded.captureDevices,
        devices: loaded.captureDevices.devices.map((device) =>
          device.id === 'CAM-03'
            ? { ...device, model: 'TC-C320N SPEC:I3/E/Y/2.8mm', host: '192.168.100.101' }
            : device,
        ),
      },
    };
    const changes = diffSlices(state, stored, FIXED_NOW).filter((c) => c.table === 'captureDevices');
    expect(changes.length).toBeGreaterThan(0); // the row is written, not refused
    for (const change of changes) {
      const set = (change as { set?: Record<string, unknown> }).set ?? {};
      expect(Object.keys(set)).not.toContain('adapterKind'); // and the immutable column is never in it
    }
  });

  it('still refuses a NAMED adapter that changes mid-run (M4-MT-12 keeps its teeth)', () => {
    const named = withAdapter(idle(), 'CAM-03', 'ONVIF_RTSP');
    const moved = withAdapter(named, 'CAM-03', 'LOCAL_DEVICE');
    expect(() => diffSlices(named, moved, FIXED_NOW)).toThrow(/adapter kind of CAM-03/);
    const dropped = withAdapter(named, 'CAM-03', undefined); // a device that lost its member
    expect(() => diffSlices(named, dropped, FIXED_NOW)).toThrow(/adapter kind of CAM-03/);
  });
});
