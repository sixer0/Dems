// What `toRows` produces and what the mapping refuses (plan row W20; database contract §9.3,
// §9.4, MR-2, MR-9, SD-5, SD-7). Pure: no database.
import {
  DEFAULT_SEED,
  DEVICE_CERT_FINGERPRINT,
  OperatorRole,
  Permission,
  ROLE_PERMISSIONS,
  SimEventType,
  appendAudit,
  buildScenarioState,
  createIdleState,
  eventCategory,
  type AuditRow,
  type EvidenceItem,
  type SimState,
} from '@dems/shared/sim';
import { describe, expect, it } from 'vitest';
import { EVENT_CATEGORY } from '../../schema';
import { EXPECTED_SEED_COUNTS, FIXED_NOW, asStored } from '../../../../test/support/seed';
import {
  DURABLE_SLICE_KEYS,
  MappingError,
  SNAPSHOT_SLICE_KEYS,
  STORED_SLICE_KEYS,
  STORED_SLICE_TABLES,
  UNMAPPED_SLICES,
  WRITE_ORDER,
  assertCompleteRings,
  auditRowToRow,
  countRows,
  diffSlices,
  evidenceItemFromRows,
  evidenceItemToRow,
  evidenceCustodyToRows,
  evidenceTracksToRows,
  exportRowFromAudit,
  fromRows,
  healthSnapshotToRow,
  matrixFromRows,
  rbacRows,
  toRows,
  verifyStoredAuditRows,
  type DurableSliceKey,
  type RowContext,
  type SealedEvidenceItem,
} from '..';

const idle = (): SimState => createIdleState({ now: FIXED_NOW, seed: DEFAULT_SEED });
const context: RowContext = { at: FIXED_NOW, seededAt: FIXED_NOW, lastResetAt: null };

function caught(work: () => unknown): MappingError {
  try {
    work();
  } catch (error) {
    if (error instanceof MappingError) return error;
    throw error;
  }
  throw new Error('expected a MappingError, and nothing was thrown');
}

describe('the slices', () => {
  it('35 slices: 15 stored, 15 in the snapshot row, 5 not mapped, and no slice twice', () => {
    const state = idle();
    expect(Object.keys(state)).toHaveLength(35);
    expect(STORED_SLICE_KEYS).toHaveLength(15);
    expect(SNAPSHOT_SLICE_KEYS).toHaveLength(15);
    expect(DURABLE_SLICE_KEYS).toHaveLength(30);
    expect(Object.keys(UNMAPPED_SLICES).sort()).toEqual(['audio', 'auth', 'authLockout', 'clock', 'pairing']);
    const all = [...DURABLE_SLICE_KEYS, ...Object.keys(UNMAPPED_SLICES)];
    expect(new Set(all).size).toBe(35);
    expect([...all].sort()).toEqual(Object.keys(state).sort());
    expect(Object.keys(STORED_SLICE_TABLES).sort()).toEqual([...STORED_SLICE_KEYS].sort());
  });

  it('the result of fromRows has exactly the 30 durable slices', () => {
    const state = idle();
    expect(Object.keys(fromRows(asStored(toRows(state, context)))).sort()).toEqual([...DURABLE_SLICE_KEYS].sort());
  });

  it.each(DURABLE_SLICE_KEYS)('the slice %s reaches the rows: a state that differs only there maps to other rows', (key) => {
    const before = idle();
    const variants: { [K in DurableSliceKey]: (state: SimState) => SimState[K] } = {
      meta: (s) => ({ ...s.meta, counters: { ...s.meta.counters, item: s.meta.counters.item + 1 } }),
      device: (s) => ({ ...s.device, softwareVersion: '9.9.9' }),
      operators: (s) => s.operators.map((operator, index) => (index === 0 ? { ...operator, initials: 'ZZ' } : operator)),
      session: (s) => buildScenarioState('recording', s).session,
      lastSealedSessionId: () => 'SES-20261001-0023',
      lastSealedAcknowledged: (s) => !s.lastSealedAcknowledged,
      sessionHistory: (s) => s.sessionHistory.slice(1),
      storagePolicy: (s) => ({ ...s.storagePolicy, retentionDays: 30 }),
      evidence: (s) => s.evidence.map((item, index) => (index === 0 ? { ...item, status: 'ARCHIVED' as const } : item)),
      events: (s) => s.events.slice(0, -1),
      alerts: () => [
        { id: 'ALR-000001', at: FIXED_NOW, severity: 'WARNING', kind: 'SYSTEM', message: 'x', active: true, acknowledged: false, resolvedAt: null, target: null, params: { kind: 'SYSTEM' } },
      ],
      audit: (s) => appendAudit(s.audit, { type: 'SYSTEM_BOOT', message: 'again' }, FIXED_NOW).log,
      settings: (s) => ({ ...s.settings, notifySound: !s.settings.notifySound }),
      tabletLink: (s) => ({ ...s.tabletLink, state: 'OFFLINE' as const }),
      activeCameraId: () => 'VIDEO-02',
      cameras: (s) => s.cameras.slice(0, 1),
      mics: (s) => s.mics.slice(0, 1),
      storage: (s) => ({ ...s.storage, writeBytesPerSec: 1 }),
      time: (s) => ({ ...s.time, stratum: 2 }),
      network: (s) => ({ ...s.network, linkUp: false }),
      security: (s) => ({ ...s.security, tamper: true }),
      services: (s) => s.services.slice(1),
      health: (s) => ({ ...s.health, fanRpm: 1 }),
      otherDevices: (s) => s.otherDevices.slice(1),
      ports: (s) => s.ports.slice(1),
      faults: () => ({ active: [{ kind: 'GNSS_LOSS', since: FIXED_NOW, target: null }] }),
      diagnostics: () => ({ id: 'DGN-000001', startedAt: FIXED_NOW, completedAt: null, checks: [] }),
      update: (s) => ({ ...s.update, activeSlot: 'B' as const }),
      // Register SH-16 (D44 R5): the two capture slices reach their own KEPT tables. The selector
      // varies by a media profile (the column the DB CHECK bounds with the CODE format - the unit
      // mapping enforces no CHECK and the value round-trips whole); the registry varies a device
      // the selector does not name, so every FK of the round trip holds.
      captureConfig: (s) => ({ ...s.captureConfig, cameras: s.captureConfig.cameras.map((camera) => ({ ...camera, profile: 'H264_720P50' })) }),
      captureDevices: (s) => ({ devices: s.captureDevices.devices.map((device) => (device.id === 'POE-SWITCH' ? { ...device, model: 'PoE+ switch PS-9' } : device)) }),
    };
    const after: SimState = { ...before, [key]: variants[key](before) };
    expect(toRows(after, context)).not.toEqual(toRows(before, context));
    // And it comes back: the changed slice is what the round trip returns.
    expect(fromRows(asStored(toRows(after, context)))[key]).toStrictEqual(after[key]);
  });

  it.each(['clock', 'auth', 'authLockout', 'audio'] as const)('the slice %s is not mapped: it changes no row', (key) => {
    const before = idle();
    const changed: Partial<SimState> = {
      clock: { ...before.clock, now: FIXED_NOW + 5_000 },
      auth: { status: 'SIGNED_IN', operatorId: 'OPR-001', method: 'PASSWORD', issuedAt: FIXED_NOW, lastActivityAt: FIXED_NOW },
      authLockout: { failures: [FIXED_NOW], lockedUntil: FIXED_NOW + 60_000 },
      audio: { ...before.audio, inputs: { ...before.audio.inputs, 'MIC-01': { ...before.audio.inputs['MIC-01']!, dbfs: -1 } } },
    };
    const after: SimState = { ...before, [key]: changed[key] };
    expect(toRows(after, context)).toStrictEqual(toRows(before, context));
  });

  it('of the pairing slice only the certificate fingerprint is stored, in core_device', () => {
    const before = idle();
    const unpaired: SimState = { ...before, pairing: { ...before.pairing, state: 'UNPAIRED', pairedAt: null, failures: [FIXED_NOW] } };
    expect(toRows(unpaired, context)).toStrictEqual(toRows(before, context));
    expect(toRows(before, context).coreDevice[0]?.certificateFingerprint).toBe(DEVICE_CERT_FINGERPRINT);
    const other: SimState = { ...before, pairing: { ...before.pairing, certificateFingerprint: 'AA:BB' } };
    expect(toRows(other, context).coreDevice[0]?.certificateFingerprint).toBe('AA:BB');
  });
});

describe('the rows of the idle dataset at the fixed instant (contract §9.4)', () => {
  const rows = toRows(idle(), context);

  it('has the row counts of the contract for the 19 mapped tables', () => {
    const counts = countRows(rows);
    for (const [table, count] of Object.entries(counts)) expect(`${table} ${count}`).toBe(`${table} ${EXPECTED_SEED_COUNTS[table]}`);
    expect(Object.keys(counts)).toHaveLength(19);
    expect(WRITE_ORDER).toHaveLength(18);
  });

  it('the chain head it implies is the last audit row: sequence 82', () => {
    const last = rows.auditLog[rows.auditLog.length - 1];
    expect(rows.auditChainHead).toEqual([{ singleton: true, seq: 82, hash: last?.hash }]);
    expect(rows.auditLog.map((row) => row.seq)).toEqual(Array.from({ length: 82 }, (_, index) => index + 1));
  });

  it('the five counters: event 60, session 24, caseNumber 8, evidence 14, item 1; no export row', () => {
    expect(rows.engineCounters).toEqual([
      { name: 'event', nextValue: 60 },
      { name: 'session', nextValue: 24 },
      { name: 'caseNumber', nextValue: 8 },
      { name: 'evidence', nextValue: 14 },
      { name: 'item', nextValue: 1 },
    ]);
  });

  it('the bookkeeping columns come from the context, never from a clock', () => {
    const other = toRows(idle(), { at: 111, seededAt: 222, lastResetAt: 333 });
    expect(other.coreState[0]).toMatchObject({ seededAt: 222, lastResetAt: 333, updatedAt: 111, createdAt: FIXED_NOW, epoch: 0, scenario: 'idle' });
    expect(other.hardwareSnapshot[0]?.writtenAt).toBe(111);
    expect(other.operators.every((row) => row.createdAt === 111 && row.updatedAt === 111 && row.enabled && row.lastSignInAt === null)).toBe(true);
    expect(other.evidenceItems.every((row) => row.createdAt === 111 && row.updatedAt === 111)).toBe(true);
    // Everything else is the same.
    expect(other.auditLog).toStrictEqual(rows.auditLog);
    expect(other.sessionHistory).toStrictEqual(rows.sessionHistory);
  });

  it('tracks are numbered 1 to 4 and custody entries 1 to n, per item', () => {
    for (const item of rows.evidenceItems) {
      // Fix wave J (truth rule 3a): the one never-sealed item of the dataset has no track row at all.
      expect(rows.evidenceTracks.filter((track) => track.evidenceId === item.id).map((track) => track.position)).toEqual(item.sealedAt === null ? [] : [1, 2, 3, 4]);
      const custody = rows.evidenceCustody.filter((entry) => entry.evidenceId === item.id).map((entry) => entry.seq);
      expect(custody).toEqual(custody.map((_, index) => index + 1));
      expect(custody.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('the tampered item is evidence 0005 on AUDIO-02, and all 13 items are DEMO_PACKAGE', () => {
    const tampered = rows.evidenceItems.filter((item) => item.tampered);
    expect(tampered.map((item) => [item.id.slice(-4), item.tamperedTrackId])).toEqual([['0005', 'AUDIO-02']]);
    expect(rows.evidenceItems.map((item) => item.integritySource)).toEqual(Array.from({ length: 13 }, () => 'DEMO_PACKAGE'));
  });

  it('every event row carries the category of the shared eventCategory, and each is a value of the CHECK', () => {
    const state = buildScenarioState('fault-demo', idle());
    const eventRows = toRows(state, context).events;
    expect(eventRows.map((row) => row.category)).toEqual(state.events.map((event) => eventCategory(event)));
    for (const row of eventRows) expect(EVENT_CATEGORY).toContain(row.category);
    // The whole event vocabulary maps into the closed set of the table.
    for (const type of Object.values(SimEventType)) {
      expect(EVENT_CATEGORY).toContain(eventCategory({ type, params: {} }));
    }
  });
});

describe('an absent optional member (MR-2)', () => {
  const state = idle();
  const item = state.evidence[0] as EvidenceItem;

  it('of an evidence item is stored as NULL or the empty list, and read back in the empty form of the shared code', () => {
    const { tamperedTrackId: _a, caseType: _b, markers: _c, notes: _d, integritySource: _e, startTimeSource: _f, endTimeSource: _g, ...legacy } = item;
    const row = evidenceItemToRow(legacy, context);
    expect(row).toMatchObject({
      tamperedTrackId: null,
      caseType: null,
      markers: [],
      notes: [],
      integritySource: null,
      startTimeSource: null,
      endTimeSource: null,
    });
    const back = evidenceItemFromRows(row, evidenceTracksToRows(legacy), evidenceCustodyToRows(legacy));
    expect(back.tamperedTrackId).toBeNull();
    expect(back.startTimeSource).toBeNull();
    expect(back.endTimeSource).toBeNull();
    expect(back.markers).toEqual([]);
    expect(back.notes).toEqual([]);
    expect('caseType' in back).toBe(false);
    expect('integritySource' in back).toBe(false);
  });

  it('of the active session (the two time sources) stays absent', () => {
    const recording = buildScenarioState('recording', state);
    expect('stopTimeSource' in (recording.session ?? {})).toBe(false);
    const rows = toRows(recording, context);
    expect(rows.activeSession[0]?.stopTimeSource).toBeNull();
    expect(rows.activeSession[0]?.startTimeSource).toBe('GNSS');
    const back = fromRows(asStored(rows)).session;
    expect('stopTimeSource' in (back ?? {})).toBe(false);
    expect(back?.startTimeSource).toBe('GNSS');
  });

  it('of an alert: an absent target reads back as null, an absent params stays absent', () => {
    const legacy: SimState = {
      ...state,
      alerts: [{ id: 'ALR-000001', at: FIXED_NOW, severity: 'WARNING', kind: 'SYSTEM', message: 'x', active: true, acknowledged: false, resolvedAt: null }],
    };
    const rows = toRows(legacy, context);
    expect(rows.alerts[0]).toMatchObject({ target: null, params: null });
    const back = fromRows(asStored(rows)).alerts[0];
    expect(back?.target).toBeNull();
    expect('params' in (back ?? {})).toBe(false);
  });

  it('of an alert (dbc-7, migration 0013): the cause in params is the column `reason`; none, or one that is no code, is NULL', () => {
    const alert = (id: string, params?: SimState['alerts'][number]['params']): SimState['alerts'][number] => ({
      id, at: FIXED_NOW, severity: 'CRITICAL', kind: 'CAPTURE_FAULT', message: 'x', active: true, acknowledged: false, resolvedAt: null, target: 'CAM-01', ...(params === undefined ? {} : { params }),
    });
    const keyed: SimState = {
      ...state,
      alerts: [
        alert('ALR-000001', { kind: 'CAPTURE_FAULT', target: 'CAM-01', reason: 'CAMERA_STREAM_ENDED' }),
        alert('ALR-000002', { kind: 'CAPTURE_FAULT', target: 'CAM-01', reason: 'CAMERA_CLOCK_OUT_OF_BOUND' }),
        alert('ALR-000003', { kind: 'CAPTURE_FAULT', target: 'CAM-01' }),
        alert('ALR-000004'),
        alert('ALR-000005', { reason: 'free text is no key' }),
      ],
    };
    const rows = toRows(keyed, context);
    expect(rows.alerts.map((row) => row.reason)).toEqual(['CAMERA_STREAM_ENDED', 'CAMERA_CLOCK_OUT_OF_BOUND', null, null, null]);
    // The way back gives the alerts as they were, each with its own cause in params.
    expect(fromRows(asStored(rows)).alerts).toEqual(keyed.alerts);
    // A row older than 0013: NULL in the column whatever params say. It reads back as the alert it was.
    const old = asStored(rows);
    old.alerts = old.alerts.map((row) => ({ ...row, reason: null }));
    expect(fromRows(old).alerts).toEqual(keyed.alerts);
    // A row whose column and params differ was written by nobody: it is refused, not read under one of two keys.
    const broken = asStored(rows);
    broken.alerts = broken.alerts.map((row) => (row.id === 'ALR-000001' ? { ...row, reason: 'CAMERA_NOT_CONNECTED' } : row));
    expect(() => fromRows(broken)).toThrow(/alerts\.reason \(ALR-000001\)/);
    const orphan = asStored(rows);
    orphan.alerts = orphan.alerts.map((row) => (row.id === 'ALR-000004' ? { ...row, reason: 'CAMERA_NOT_CONNECTED' } : row));
    expect(() => fromRows(orphan)).toThrow(/alerts\.reason \(ALR-000004\)/);
  });

  it('the export counter has no row until the first export, and comes back absent', () => {
    expect(toRows(state, context).engineCounters.map((row) => row.name)).not.toContain('export');
    expect('export' in fromRows(asStored(toRows(state, context))).meta.counters).toBe(false);
    const exported: SimState = { ...state, meta: { ...state.meta, counters: { ...state.meta.counters, export: 32 } } };
    expect(toRows(exported, context).engineCounters).toContainEqual({ name: 'export', nextValue: 32 });
    expect(fromRows(asStored(toRows(exported, context))).meta.counters.export).toBe(32);
  });
});

describe('what the mapping refuses', () => {
  const state = idle();
  const item = state.evidence[0] as EvidenceItem;
  const auditRow = state.audit.rows[0] as AuditRow;

  it('MR-9: a number that is not a safe integer, before it reaches an integer column', () => {
    const tooLarge = caught(() => evidenceItemToRow({ ...item, sizeBytes: 2 ** 53 }, context));
    expect(tooLarge.code).toBe('NOT_SAFE_INTEGER');
    expect(tooLarge.place).toContain('evidence_items.size_bytes');
    expect(caught(() => evidenceItemToRow({ ...item, durationMs: 1.5 }, context)).code).toBe('NOT_SAFE_INTEGER');
    expect(caught(() => auditRowToRow({ ...auditRow, at: Number.NaN })).code).toBe('NOT_SAFE_INTEGER');
    expect(caught(() => toRows({ ...state, meta: { ...state.meta, seed: 2 ** 60 } }, context)).place).toBe('core_state.seed');
    expect(caught(() => toRows(state, { ...context, at: 1.25 })).code).toBe('NOT_SAFE_INTEGER');
    // The largest safe integer itself is accepted.
    expect(evidenceItemToRow({ ...item, sizeBytes: Number.MAX_SAFE_INTEGER }, context).sizeBytes).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('a number that is not finite inside a JSON value (JSON would write null)', () => {
    const error = caught(() => toRows({ ...state, health: { ...state.health, cpuPercent: Number.POSITIVE_INFINITY } }, context));
    expect(error.code).toBe('NOT_FINITE');
    expect(error.place).toBe('hardware_snapshot.health.cpuPercent');
    expect(caught(() => auditRowToRow({ ...auditRow, details: { value: Number.NaN } })).code).toBe('NOT_FINITE');
  });

  it('a text PostgreSQL cannot store exactly: U+0000 or a lone surrogate. Nothing is sanitised', () => {
    const lone = `Catatan ${'\uD83D'}`;
    const error = caught(() => auditRowToRow({ ...auditRow, message: lone }));
    expect(error.code).toBe('TEXT_NOT_STORABLE');
    expect(error.place).toContain('audit_log.message');
    // The message of the error names the place and never repeats the text.
    expect(error.message).not.toContain('Catatan');
    expect(caught(() => auditRowToRow({ ...auditRow, message: 'a\u0000b' })).code).toBe('TEXT_NOT_STORABLE');
    expect(caught(() => auditRowToRow({ ...auditRow, details: { note: `x${'\uDC00'}` } })).code).toBe('TEXT_NOT_STORABLE');
    expect(caught(() => toRows({ ...state, device: { ...state.device, name: 'a\u0000' } }, context)).place).toBe('core_device.name');
    // A well-formed astral character is stored as it is.
    const emoji = 'Selesai \u{1F600}';
    expect(auditRowToRow({ ...auditRow, message: emoji }).message).toBe(emoji);
  });

  it('a whole-state write of a ring that has already dropped rows', () => {
    expect(() => assertCompleteRings(state)).not.toThrow();
    const dropped = { ...state, audit: { ...state.audit, rows: state.audit.rows.slice(1), dropped: 1 } };
    expect(caught(() => assertCompleteRings(dropped)).code).toBe('RING_INCOMPLETE');
    expect(caught(() => assertCompleteRings({ ...state, events: state.events.slice(1) })).code).toBe('RING_INCOMPLETE');
  });

  it('rows that do not form a state: two core_state rows, a head that disagrees with the newest row', () => {
    const rows = asStored(toRows(state, context));
    expect(caught(() => fromRows({ ...rows, coreState: [] })).code).toBe('ROW_SHAPE');
    expect(caught(() => fromRows({ ...rows, hardwareSnapshot: [...rows.hardwareSnapshot, ...rows.hardwareSnapshot] })).code).toBe('ROW_SHAPE');
    expect(caught(() => fromRows({ ...rows, auditChainHead: [{ singleton: true, seq: 81, hash: state.audit.head }] })).place).toBe('audit_chain_head');
    expect(caught(() => fromRows({ ...rows, engineCounters: rows.engineCounters.filter((row) => row.name !== 'item') })).place).toBe('engine_counters');
    // SH-10 moved the accepted version to 2, so the wrong-value injections are 1 (the version this
    // mapping no longer reads) and 3 (a version it has never heard of), on BOTH version columns.
    const staleVersion = rows.coreState.map((row) => ({ ...row, simSchemaVersion: 1 }));
    expect(caught(() => fromRows({ ...rows, coreState: staleVersion })).place).toBe('core_state.sim_schema_version');
    const futureVersion = rows.coreState.map((row) => ({ ...row, simSchemaVersion: 3 }));
    expect(caught(() => fromRows({ ...rows, coreState: futureVersion })).place).toBe('core_state.sim_schema_version');
    const futureSnapshot = rows.hardwareSnapshot.map((row) => ({ ...row, simSchemaVersion: 3 }));
    expect(caught(() => fromRows({ ...rows, hardwareSnapshot: futureSnapshot })).place).toBe('hardware_snapshot.sim_schema_version');
  });

  it('SH-10: the boot check ACCEPTS the stored version 2 and reads it back as the meta schema version', () => {
    const rows = asStored(toRows(state, context));
    expect(rows.coreState[0]?.simSchemaVersion).toBe(2);
    expect(rows.hardwareSnapshot[0]?.simSchemaVersion).toBe(2);
    expect(fromRows(rows).meta.schemaVersion).toBe(2);
  });
});

describe('export records are derived from audit rows (SD-7)', () => {
  const state = idle();

  it('the dataset has one: EXP-000031 of evidence 0004, by the supervisor', () => {
    const rows = toRows(state, context).exportRecords;
    const exported = state.evidence.find((item) => item.status === 'EXPORTED');
    const audit = state.audit.rows.find((row) => row.type === 'EVIDENCE_EXPORTED');
    expect(rows).toEqual([
      {
        id: 'EXP-000031',
        scope: 'EVIDENCE',
        evidenceId: exported?.id,
        operatorId: 'OPR-002',
        reason: 'Prosecutor request',
        destination: 'Case file transfer (simulated)',
        at: audit?.at,
      },
    ]);
    expect(exported?.id.slice(-4)).toBe('0004');
  });

  it('an audit-log export and a log-bundle export give the scopes AUDIT and LOGS, with no evidence item', () => {
    const base: AuditRow = { ...(state.audit.rows[0] as AuditRow), type: 'AUDIT_EXPORTED', actorId: 'OPR-002', evidenceId: null };
    const details = { exportId: 'EXP-000040', reason: 'Internal review', destination: 'Audit export (simulated)', rows: 82 };
    expect(exportRowFromAudit({ ...base, details })).toMatchObject({ id: 'EXP-000040', scope: 'AUDIT', evidenceId: null, operatorId: 'OPR-002' });
    expect(exportRowFromAudit({ ...base, details: { ...details, scope: 'LOGS' } })?.scope).toBe('LOGS');
  });

  it('any other audit row gives none; an export the table cannot hold is refused, not dropped', () => {
    expect(exportRowFromAudit(state.audit.rows[0] as AuditRow)).toBeNull();
    const base: AuditRow = { ...(state.audit.rows[0] as AuditRow), type: 'AUDIT_EXPORTED', actorId: 'OPR-002' };
    expect(caught(() => exportRowFromAudit({ ...base, details: { exportId: 'EXP-000041' } })).code).toBe('EXPORT_NOT_STORABLE');
    expect(caught(() => exportRowFromAudit({ ...base, actorId: null, details: { exportId: 'EXP-000041', reason: 'Because', destination: 'x' } })).code).toBe(
      'EXPORT_NOT_STORABLE',
    );
    // A history export without an export ID is not a record of this table.
    expect(exportRowFromAudit({ ...base, type: 'EVIDENCE_EXPORTED', details: { reason: 'Prosecutor request', destination: 'x' } })).toBeNull();
  });
});

describe('roles, permissions and grants come from the shared vocabulary (SD-5, AC-B-17)', () => {
  const rows = rbacRows();

  it('3 roles, 15 permissions and 22 grants (5, 11, 6), in declaration order', () => {
    expect(rows.roles).toEqual([
      { id: 'INVESTIGATOR', sortOrder: 1 },
      { id: 'SUPERVISOR', sortOrder: 2 },
      { id: 'TECHNICIAN', sortOrder: 3 },
    ]);
    expect(rows.permissions.map((row) => row.id)).toEqual(Object.values(Permission));
    expect(rows.permissions.map((row) => row.sortOrder)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    // The seed and migration `0018` must write the SAME row for the commissioning permission: a
    // database seeded before set 9 gets it from the migration, a new one from here (P12-F07).
    expect(rows.permissions.at(-1)).toEqual({ id: 'CAPTURE_COMMISSION', sortOrder: 15 });
    expect(rows.rolePermissions.filter((grant) => grant.permissionId === 'CAPTURE_COMMISSION')).toEqual([{ roleId: 'TECHNICIAN', permissionId: 'CAPTURE_COMMISSION' }]);
    expect(rows.rolePermissions).toHaveLength(22);
    const perRole = (role: string): number => rows.rolePermissions.filter((grant) => grant.roleId === role).length;
    expect([perRole('INVESTIGATOR'), perRole('SUPERVISOR'), perRole('TECHNICIAN')]).toEqual([5, 11, 6]);
  });

  it('the grants are exactly ROLE_PERMISSIONS, role by role', () => {
    for (const role of Object.values(OperatorRole)) {
      const granted = rows.rolePermissions.filter((grant) => grant.roleId === role).map((grant) => grant.permissionId);
      expect([...granted].sort()).toEqual([...ROLE_PERMISSIONS[role]].sort());
      expect(new Set(granted).size).toBe(granted.length);
    }
    const order = Object.values(Permission) as string[];
    const expected = Object.fromEntries(
      Object.values(OperatorRole).map((role) => [role, [...ROLE_PERMISSIONS[role]].sort((a, b) => order.indexOf(a) - order.indexOf(b))]),
    );
    expect(matrixFromRows(rows)).toEqual(expected);
  });
});

describe('the health snapshot row', () => {
  it('is a projection of six slices; fault_kind is set exactly when the cause is a fault', () => {
    const state = buildScenarioState('fault-demo', idle());
    const interval = healthSnapshotToRow(state, FIXED_NOW, { cause: 'INTERVAL' });
    expect(interval).toEqual({
      at: FIXED_NOW,
      cause: 'INTERVAL',
      faultKind: null,
      cpuPercent: state.health.cpuPercent,
      cpuTempC: state.health.cpuTempC,
      storageTempC: state.health.storageTempC,
      ambientTempC: state.health.ambientTempC,
      fanRpm: state.health.fanRpm,
      fanOk: state.health.fanOk,
      storageState: state.storage.state,
      evidenceUsedBytes: state.storage.volumes.find((volume) => volume.kind === 'EVIDENCE')?.usedBytes,
      timeSource: 'NTP',
      timeOffsetMs: state.time.offsetMs,
      securityState: state.security.state,
      sessionState: 'RECORDING',
      activeFaults: 3,
    });
    expect(healthSnapshotToRow(state, FIXED_NOW, { cause: 'FAULT_RAISED', faultKind: 'GNSS_LOSS' }).faultKind).toBe('GNSS_LOSS');
    expect(healthSnapshotToRow(idle(), FIXED_NOW, { cause: 'INTERVAL' })).toMatchObject({ sessionState: null, activeFaults: 0, timeSource: 'GNSS' });
    expect(caught(() => healthSnapshotToRow({ ...state, health: { ...state.health, fanRpm: 0.5 } }, FIXED_NOW, { cause: 'INTERVAL' })).code).toBe(
      'NOT_SAFE_INTEGER',
    );
  });
});

describe('the digest check of stored audit rows (boot check B-8, ST-2)', () => {
  const state = idle();
  const stored = toRows(state, context).auditLog;

  it('accepts the dataset chain, over all rows and over the newest rows only', () => {
    expect(verifyStoredAuditRows(stored, { dropped: 0, head: state.audit.head })).toEqual({ ok: true });
    expect(verifyStoredAuditRows(stored.slice(-10), { dropped: 72, head: state.audit.head })).toEqual({ ok: true });
  });

  it('names the first row whose digest is wrong, and a head that does not match', () => {
    const forged = stored.map((row) => (row.seq === 17 ? { ...row, message: `${row.message}.` } : row));
    // The verdict is typed (finding F-2 of the security-audit row): the reason code and the sequence are members
    // of their own, and `reason` is both as one text for a log line.
    expect(verifyStoredAuditRows(forged, { dropped: 0, head: state.audit.head })).toEqual({ ok: false, code: 'HASH_MISMATCH', seq: 17, reason: 'HASH_MISMATCH at sequence 17' });
    expect(verifyStoredAuditRows(stored, { dropped: 0, head: '0'.repeat(64) }).ok).toBe(false);
    const gap = stored.filter((row) => row.seq !== 40);
    const broken = verifyStoredAuditRows(gap, { dropped: 0, head: state.audit.head });
    expect(broken).toMatchObject({ ok: false, seq: 41 });
    expect(broken.ok ? '' : broken.reason).toBe(`${broken.ok ? '' : broken.code} at sequence 41`);
  });
});

describe('diffSlices sees nothing between a state and itself', () => {
  it('returns no change when no slice reference changed, and none for an equal copy of a singleton', () => {
    const state = idle();
    expect(diffSlices(state, state, FIXED_NOW)).toEqual([]);
    expect(diffSlices(state, { ...state, settings: { ...state.settings } }, FIXED_NOW)).toEqual([]);
  });
});

// Blueprint row 129b (request of row 79): the three sealed columns of `evidence_items` come from
// the seal's item columns (`FinalizedTranscript.itemColumns` of src/sealing), not from the hash.
describe('the sealed columns of a v2 item: manifest_version and labels_status (dbc-3 §B.11)', () => {
  const HASH = 'ab'.repeat(32);
  const base = (): EvidenceItem => {
    const { transcriptSha256: _hash, ...item } = idle().evidence[0] as EvidenceItem;
    return item;
  };
  const sealed = (members: Partial<SealedEvidenceItem>): SealedEvidenceItem => ({ ...base(), ...members });
  const columns = (item: EvidenceItem) => {
    const row = evidenceItemToRow(item, context);
    return [row.manifestVersion, row.transcriptSha256, row.labelsStatus];
  };

  it('a v1 item stores (1, NULL, NULL)', () => {
    expect(columns(base())).toEqual([1, null, null]);
  });

  it.each([
    ['a labelled transcript', { manifestVersion: 2, transcriptSha256: HASH, labelsStatus: 'LABELLED' }, [2, HASH, 'LABELLED']],
    ['a transcript whose speakers are not labelled', { manifestVersion: 2, transcriptSha256: HASH, labelsStatus: 'UNAVAILABLE' }, [2, HASH, 'UNAVAILABLE']],
    ['STT DISABLED: no hash, and still version 2', { manifestVersion: 2, transcriptSha256: null, labelsStatus: null }, [2, null, null]],
  ] as const)('the seal\'s item columns, %s', (_label, members, stored) => {
    expect(columns(sealed(members))).toEqual(stored);
  });

  it('NEGATIVE CONTROL: the old derivation stored the DISABLED item as version 1', () => {
    const item = sealed({ manifestVersion: 2, transcriptSha256: null, labelsStatus: null });
    expect(item.transcriptSha256 != null ? 2 : 1).toBe(1);
    expect(evidenceItemToRow(item, context).manifestVersion).toBe(2);
  });

  it('an item that states neither member keeps the old reading: 2 with a bound hash, NULL labels', () => {
    expect(columns({ ...base(), transcriptSha256: HASH })).toEqual([2, HASH, null]);
    expect(columns({ ...base(), transcriptSha256: null })).toEqual([1, null, null]);
  });

  it('refuses what no seal produces: version 1 with a hash or a speaker state, an unknown version, an unknown speaker state', () => {
    for (const [members, column] of [
      [{ manifestVersion: 1, transcriptSha256: HASH }, 'manifest_version'],
      [{ manifestVersion: 1, labelsStatus: 'LABELLED' }, 'labels_status'],
      [{ labelsStatus: 'LABELLED' }, 'labels_status'],
      [{ manifestVersion: 3 as never }, 'manifest_version'],
      [{ manifestVersion: 2, transcriptSha256: HASH, labelsStatus: 'PARTIAL' as never }, 'labels_status'],
    ] as const) {
      const error = caught(() => evidenceItemToRow(sealed(members), context));
      expect(error.code).toBe('ROW_SHAPE');
      expect(error.message).toContain(`evidence_items.${column}`);
    }
  });
});
