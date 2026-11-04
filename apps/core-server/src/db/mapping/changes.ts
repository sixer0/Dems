/**
 * Change detection: what to write when the engine's state moved from one value to another
 * (plan row W20; database contract MR-6, MR-7, MR-8, §4.15, §7.3; spec ENG-4, ENG-10).
 *
 * `diffSlices(previous, next, at)` is pure. It compares the durable slices of two states and
 * returns the row changes that bring the tables from the first to the second:
 *
 *   - A slice whose REFERENCE did not change costs one comparison and yields nothing. The shared
 *     code never mutates a slice, so reference inequality is the change signal (ENG-4).
 *   - `previous` is the state the tables hold, that is the state at the last successful write,
 *     not the state one tick ago. A host that writes the snapshot row once a second, or the
 *     session's progress once a second, simply diffs against what it wrote last.
 *   - Records are only added: audit rows and events above the last written sequence (MR-7; an
 *     altered ring row is therefore never written), new history entries, new evidence items
 *     with their tracks, new custody entries, new alerts, and one export record per new audit
 *     row that records an accepted export.
 *   - An UPDATE names only the columns that changed, and only columns the runtime role may
 *     update (MR-8). A change that the runtime role cannot write (a sealed column of an
 *     evidence item, a history entry, the seed of the state) is not skipped: it throws, because
 *     the tables would otherwise silently stop matching the engine.
 *   - `operators` is not written: that table belongs to the server (identity and
 *     administration modules) and is mirrored INTO the engine, not out of it.
 *
 * The changes come in the write order of the contract (parents before children, the audit log
 * and the events last). The caller applies them in one transaction; when the list holds audit
 * rows it takes the chain lock first (AP-2, AP-7).
 */
import { isDeepStrictEqual } from 'node:util';
import type { AuditRow, SimEvent, SimState } from '@dems/shared/sim';
import { exportRowsFromAudit } from './exports';
import { MappingError, safeInteger, storableJson } from './guards';
import {
  COUNTER_NAMES,
  activeSessionToRow,
  alertToRow,
  auditRowToRow,
  CAPTURE_TRANSPORT_NOT_IN_STATE,
  captureConfigToRow,
  captureDevicesToRows,
  coreDeviceToRow,
  eventToRow,
  evidenceCustodyToRows,
  evidenceItemToRow,
  evidenceTracksToRows,
  sessionHistoryToRow,
  settingsToRow,
  storagePolicyToRow,
  type RowContext,
} from './rows';
import { SNAPSHOT_SLICE_COLUMNS, SNAPSHOT_SLICE_KEYS, type DurableSlices } from './slices';
import { WRITE_ORDER, type MappedRow, type MappedRows, type WrittenTable } from './to-rows';

/**
 * The columns the runtime role may update, per table (contract §7.3), by the property names of
 * the typed schema. `active_session` is the one table it may update whole (and delete from).
 */
export const RUNTIME_UPDATABLE_COLUMNS = {
  coreDevice: ['softwareVersion', 'coreSoftwareVersion', 'updatedAt'],
  coreState: ['epoch', 'lastSealedSessionId', 'lastSealedAcknowledged', 'updatedAt'],
  storagePolicy: ['retentionPolicy', 'retentionDays', 'autoArchive', 'updatedAt'],
  consoleSettings: ['presentationMode', 'timeFormat', 'notifyWarnings', 'notifySound', 'updatedAt'],
  engineCounters: ['nextValue'],
  hardwareSnapshot: [...SNAPSHOT_SLICE_KEYS.map((key) => SNAPSHOT_SLICE_COLUMNS[key]), 'writtenAt'],
  evidenceItems: ['status', 'lifecycleStage', 'verificationStatus', 'verificationAt', 'tampered', 'tamperedTrackId', 'updatedAt'],
  alerts: ['active', 'acknowledged', 'resolvedAt'],
  // dbc-3 §D (migration 0005): every column of the selector but its PK. The engine's own writes
  // name only the four device/profile columns and `updated_at`; `revision` and `updated_by` belong
  // to operation 77 (the module), which is why the row builder never varies them.
  // D60 (2026-11-04): the two further camera pairs join the writable columns of the selector singleton.
  captureConfig: ['video01DeviceId', 'video01Profile', 'video02DeviceId', 'video02Profile', 'video03DeviceId', 'video03Profile', 'video04DeviceId', 'video04Profile', 'micPrimaryId', 'micStandbyId', 'revision', 'updatedBy', 'updatedAt'],
  // Pass D4: the columns of a registry row the engine state models, for a device whose TRANSPORT
  // the state does not hold (see `diffCapture`). `transport` is deliberately not here: on that
  // path the registry's own value stays. `kind` and `adapter_kind` are never updated (dbc-4 §N.2).
  captureDevices: ['model', 'firmware', 'address', 'poePort', 'enabled'],
} as const satisfies { readonly [K in WrittenTable]?: readonly (keyof MappedRow<K>)[] };

export type UpdatedTable = keyof typeof RUNTIME_UPDATABLE_COLUMNS | 'activeSession';

export type InsertChange = {
  [K in WrittenTable]: { readonly op: 'insert'; readonly table: K; readonly rows: MappedRow<K>[] };
}[WrittenTable];

export type UpdateChange = {
  [K in UpdatedTable]: {
    readonly op: 'update';
    readonly table: K;
    /** The key columns that identify the row. */
    readonly key: Partial<MappedRow<K>>;
    /** The changed columns, and the row's own `updated_at` or `written_at`. */
    readonly set: Partial<MappedRow<K>>;
  };
}[UpdatedTable];

/** The only DELETE the runtime role issues: the session slice became null, or a new session replaced it. */
export interface DeleteChange {
  readonly op: 'delete';
  readonly table: 'activeSession';
}

export type RowChange = InsertChange | UpdateChange | DeleteChange;

type Buckets = { [K in WrittenTable]?: RowChange[] };

function push(buckets: Buckets, change: RowChange): void {
  (buckets[change.table] ??= []).push(change);
}

function immutable(place: string, what: string): MappingError {
  return new MappingError('IMMUTABLE_CHANGED', place, `${what} changed; the runtime role cannot write that, and the engine never does it.`);
}

function notWritable(place: string, what: string): MappingError {
  return new MappingError('NOT_WRITABLE', place, what);
}

/** The columns in which two rows of one table differ. JSON values are compared by reference. */
function differingColumns<R extends object>(before: R, after: R): (keyof R)[] {
  return (Object.keys(after) as (keyof R)[]).filter((column) => !Object.is(before[column], after[column]));
}

function pick<R extends object>(row: R, columns: readonly (keyof R)[]): Partial<R> {
  const part: Partial<R> = {};
  for (const column of columns) part[column] = row[column];
  return part;
}

// The instants of a row built only to be compared: its bookkeeping columns are never read.
const COMPARE_CONTEXT: RowContext = { at: 0, seededAt: 0, lastResetAt: null };

// ── Stored slices (class S) ────────────────────────────────────────────────────────────────────

function diffMeta(previous: DurableSlices, next: DurableSlices, at: number, buckets: Buckets): void {
  const set: Partial<MappedRow<'coreState'>> = {};
  if (previous.meta !== next.meta) {
    for (const member of ['seed', 'schemaVersion', 'scenario', 'createdAt'] as const) {
      if (previous.meta[member] !== next.meta[member]) {
        throw notWritable('core_state', `meta.${member} changed; a running engine never changes it (a scenario load is a reset).`);
      }
    }
    if (previous.meta.epoch !== next.meta.epoch) set.epoch = safeInteger(next.meta.epoch, 'core_state.epoch');

    const inserted: MappedRow<'engineCounters'>[] = [];
    for (const name of COUNTER_NAMES) {
      const before = previous.meta.counters[name];
      const after = next.meta.counters[name];
      if (before === after) continue;
      if (after === undefined) throw notWritable('engine_counters', `the counter ${name} disappeared.`);
      const nextValue = safeInteger(after, `engine_counters.next_value (${name})`);
      if (before === undefined) inserted.push({ name, nextValue });
      else push(buckets, { op: 'update', table: 'engineCounters', key: { name }, set: { nextValue } });
    }
    if (inserted.length > 0) push(buckets, { op: 'insert', table: 'engineCounters', rows: inserted });
  }
  if (previous.lastSealedSessionId !== next.lastSealedSessionId) set.lastSealedSessionId = next.lastSealedSessionId;
  if (previous.lastSealedAcknowledged !== next.lastSealedAcknowledged) set.lastSealedAcknowledged = next.lastSealedAcknowledged;
  if (Object.keys(set).length > 0) {
    push(buckets, { op: 'update', table: 'coreState', key: { singleton: true }, set: { ...set, updatedAt: at } });
  }
}

function diffDevice(previous: DurableSlices, next: DurableSlices, at: number, buckets: Buckets): void {
  if (previous.device === next.device) return;
  const before = coreDeviceToRow(previous.device, '', COMPARE_CONTEXT);
  const after = coreDeviceToRow(next.device, '', COMPARE_CONTEXT);
  const changed = differingColumns(before, after);
  if (changed.length === 0) return;
  const writable: readonly (keyof MappedRow<'coreDevice'>)[] = RUNTIME_UPDATABLE_COLUMNS.coreDevice;
  const refused = changed.filter((column) => !writable.includes(column));
  if (refused.length > 0) throw notWritable('core_device', `the column(s) ${refused.join(', ')} changed; only a software update changes the device record.`);
  push(buckets, { op: 'update', table: 'coreDevice', key: { singleton: true }, set: { ...pick(after, changed), updatedAt: at } });
}

function diffPolicyAndSettings(previous: DurableSlices, next: DurableSlices, at: number, buckets: Buckets): void {
  if (previous.storagePolicy !== next.storagePolicy) {
    const before = storagePolicyToRow(previous.storagePolicy, COMPARE_CONTEXT);
    const after = storagePolicyToRow(next.storagePolicy, COMPARE_CONTEXT);
    const changed = differingColumns(before, after);
    if (changed.length > 0) {
      push(buckets, { op: 'update', table: 'storagePolicy', key: { singleton: true }, set: { ...pick(after, changed), updatedAt: at } });
    }
  }
  if (previous.settings !== next.settings) {
    const before = settingsToRow(previous.settings, COMPARE_CONTEXT);
    const after = settingsToRow(next.settings, COMPARE_CONTEXT);
    const changed = differingColumns(before, after);
    if (changed.length > 0) {
      push(buckets, { op: 'update', table: 'consoleSettings', key: { singleton: true }, set: { ...pick(after, changed), updatedAt: at } });
    }
  }
}

function diffCapture(previous: DurableSlices, next: DurableSlices, buckets: Buckets): void {
  // The registry first (the selector's FKs name it): a changed device is an UPSERT of its row,
  // which is exactly what `dems_app` may do (INSERT + UPDATE, no DELETE, dbc-3 §D). The store
  // applies an insert on this table as `ON CONFLICT (id) DO UPDATE`.
  if (previous.captureDevices !== next.captureDevices) {
    const before = new Map(captureDevicesToRows(previous.captureDevices, previous.captureConfig).map((row) => [row.id, row] as const));
    const fresh: MappedRow<'captureDevices'>[] = [];
    const updates: RowChange[] = [];
    for (const row of captureDevicesToRows(next.captureDevices, next.captureConfig)) {
      const old = before.get(row.id);
      before.delete(row.id);
      // dbc-4 §N.2 / D-DB-13 (D83): a device never changes its adapter kind - a device with
      // another adapter is another device with another id. The database would not store the
      // change anyway (the UPSERT keeps `adapter_kind` out of its SET list and `dems_app` holds no
      // UPDATE on it), so a slice that asks for it is refused here, loudly, instead of being
      // dropped silently (M4-MT-12).
      if (old !== undefined && old.adapterKind !== row.adapterKind) {
        throw notWritable('capture_devices', `the adapter kind of ${row.id} changed; it is written at INSERT and never updated (dbc-4 §N.2).`);
      }
      if (old === undefined) {
        fresh.push(row);
        continue;
      }
      if (isDeepStrictEqual(old, row)) continue;
      // The state holds a transport for this device (a built-in, or a microphone a selector slot
      // names): the UPSERT of the whole row, as before.
      if (row.transport !== CAPTURE_TRANSPORT_NOT_IN_STATE) {
        fresh.push(row);
        continue;
      }
      // THE STATE HOLDS NO TRANSPORT FOR IT (pass D4; request of pass D1b): an adopted camera, a
      // local device, a microphone that LEFT the selector. De-selecting is not un-registering
      // (C3 §2.6 "Adoption is not assignment"; dbc-3 §B.2: the transport is a fact of the registry
      // row), so the registry's transport is never overwritten with the neutral code: the change
      // is an UPDATE of exactly the modelled columns that moved, and `transport` is never one.
      const writable: readonly (keyof MappedRow<'captureDevices'>)[] = RUNTIME_UPDATABLE_COLUMNS.captureDevices;
      const changed = (Object.keys(row) as (keyof MappedRow<'captureDevices'>)[]).filter((column) => column !== 'transport' && !isDeepStrictEqual(old[column], row[column]));
      const refused = changed.filter((column) => !writable.includes(column));
      if (refused.length > 0) throw notWritable('capture_devices', `the column(s) ${refused.join(', ')} of ${row.id} are not the engine's to change.`);
      if (changed.length > 0) updates.push({ op: 'update', table: 'captureDevices', key: { id: row.id }, set: pick(row, changed) });
    }
    if (before.size > 0) throw notWritable('capture_devices', `${before.size} device(s) left the registry; discovery only adds and updates (dbc-3 §B.2).`);
    if (fresh.length > 0) push(buckets, { op: 'insert', table: 'captureDevices', rows: fresh });
    for (const update of updates) push(buckets, update);
  }
  if (previous.captureConfig !== next.captureConfig) {
    const before = captureConfigToRow(previous.captureConfig);
    const after = captureConfigToRow(next.captureConfig);
    const changed = differingColumns(before, after);
    if (changed.length > 0) {
      const writable: readonly (keyof MappedRow<'captureConfig'>)[] = RUNTIME_UPDATABLE_COLUMNS.captureConfig;
      const refused = changed.filter((column) => !writable.includes(column));
      if (refused.length > 0) throw notWritable('capture_config', `the column(s) ${refused.join(', ')} changed; the singleton key is never written.`);
      push(buckets, { op: 'update', table: 'captureConfig', key: { singleton: true }, set: pick(after, changed) });
    }
  }
}

function diffSession(previous: DurableSlices, next: DurableSlices, at: number, buckets: Buckets): void {
  const before = previous.session;
  const after = next.session;
  if (before === after) return;
  const context: RowContext = { ...COMPARE_CONTEXT, at };
  if (after === null) {
    push(buckets, { op: 'delete', table: 'activeSession' });
    return;
  }
  if (before === null || before.id !== after.id) {
    // A new session replaces a finished one: DELETE and INSERT in one transaction (§4.15).
    if (before !== null) push(buckets, { op: 'delete', table: 'activeSession' });
    push(buckets, { op: 'insert', table: 'activeSession', rows: [activeSessionToRow(after, context)] });
    return;
  }
  const beforeRow = activeSessionToRow(before, context);
  const afterRow = activeSessionToRow(after, context);
  const changed = differingColumns(beforeRow, afterRow);
  if (changed.length === 0) return;
  push(buckets, { op: 'update', table: 'activeSession', key: { singleton: true }, set: { ...pick(afterRow, changed), updatedAt: at } });
}

function diffSessionHistory(previous: DurableSlices, next: DurableSlices, buckets: Buckets): void {
  if (previous.sessionHistory === next.sessionHistory) return;
  const known = new Map(previous.sessionHistory.map((entry) => [entry.id, entry] as const));
  const fresh: MappedRow<'sessionHistory'>[] = [];
  for (const entry of next.sessionHistory) {
    const old = known.get(entry.id);
    if (old === undefined) fresh.push(sessionHistoryToRow(entry));
    else if (old !== entry && !isDeepStrictEqual(sessionHistoryToRow(old), sessionHistoryToRow(entry))) {
      throw immutable(`session_history (${entry.id})`, 'a history entry');
    }
    known.delete(entry.id);
  }
  if (known.size > 0) throw notWritable('session_history', `${known.size} history entr(ies) disappeared; a history entry is never removed.`);
  // The slice is newest first; the rows are written oldest first.
  if (fresh.length > 0) push(buckets, { op: 'insert', table: 'sessionHistory', rows: fresh.reverse() });
}

function diffEvidence(previous: DurableSlices, next: DurableSlices, at: number, buckets: Buckets): void {
  if (previous.evidence === next.evidence) return;
  const context: RowContext = { ...COMPARE_CONTEXT, at };
  const known = new Map(previous.evidence.map((item) => [item.id, item] as const));
  const items: MappedRow<'evidenceItems'>[] = [];
  const tracks: MappedRow<'evidenceTracks'>[] = [];
  const custody: MappedRow<'evidenceCustody'>[] = [];
  const writable: readonly (keyof MappedRow<'evidenceItems'>)[] = RUNTIME_UPDATABLE_COLUMNS.evidenceItems;

  for (const item of next.evidence) {
    const old = known.get(item.id);
    known.delete(item.id);
    if (old === undefined) {
      items.push(evidenceItemToRow(item, context));
      tracks.push(...evidenceTracksToRows(item));
      custody.push(...evidenceCustodyToRows(item));
      continue;
    }
    if (old === item) continue;

    const beforeRow = evidenceItemToRow(old, context);
    const afterRow = evidenceItemToRow(item, context);
    const changed = (Object.keys(afterRow) as (keyof MappedRow<'evidenceItems'>)[]).filter(
      (column) => !isDeepStrictEqual(beforeRow[column], afterRow[column]),
    );
    const sealed = changed.filter((column) => !writable.includes(column));
    if (sealed.length > 0) throw immutable(`evidence_items (${item.id})`, `the sealed column(s) ${sealed.join(', ')}`);
    if (changed.length > 0) {
      push(buckets, { op: 'update', table: 'evidenceItems', key: { id: item.id }, set: { ...pick(afterRow, changed), updatedAt: at } });
    }

    if (old.tracks !== item.tracks && !isDeepStrictEqual(evidenceTracksToRows(old), evidenceTracksToRows(item))) {
      throw immutable(`evidence_tracks (${item.id})`, 'a sealed track');
    }
    if (old.custody !== item.custody) {
      const stored = old.custody.length;
      if (item.custody.length < stored || !isDeepStrictEqual(evidenceCustodyToRows(old), evidenceCustodyToRows(item).slice(0, stored))) {
        throw immutable(`evidence_custody (${item.id})`, 'a custody entry');
      }
      custody.push(...evidenceCustodyToRows(item, stored));
    }
  }
  if (known.size > 0) throw notWritable('evidence_items', `${known.size} evidence item(s) disappeared; an item is never removed.`);
  if (items.length > 0) push(buckets, { op: 'insert', table: 'evidenceItems', rows: items });
  if (tracks.length > 0) push(buckets, { op: 'insert', table: 'evidenceTracks', rows: tracks });
  if (custody.length > 0) push(buckets, { op: 'insert', table: 'evidenceCustody', rows: custody });
}

function diffAlerts(previous: DurableSlices, next: DurableSlices, buckets: Buckets): void {
  if (previous.alerts === next.alerts) return;
  const known = new Map(previous.alerts.map((alert) => [alert.id, alert] as const));
  const fresh: MappedRow<'alerts'>[] = [];
  const writable: readonly (keyof MappedRow<'alerts'>)[] = RUNTIME_UPDATABLE_COLUMNS.alerts;
  for (const alert of next.alerts) {
    const old = known.get(alert.id);
    if (old === undefined) {
      fresh.push(alertToRow(alert));
      continue;
    }
    if (old === alert) continue;
    const beforeRow = alertToRow(old);
    const afterRow = alertToRow(alert);
    const changed = (Object.keys(afterRow) as (keyof MappedRow<'alerts'>)[]).filter(
      (column) => !isDeepStrictEqual(beforeRow[column], afterRow[column]),
    );
    const refused = changed.filter((column) => !writable.includes(column));
    if (refused.length > 0) throw immutable(`alerts (${alert.id})`, `the column(s) ${refused.join(', ')}`);
    if (changed.length > 0) push(buckets, { op: 'update', table: 'alerts', key: { id: alert.id }, set: pick(afterRow, changed) });
  }
  // An alert that left the ring of 100 stays in the table: nothing is written for it.
  if (fresh.length > 0) push(buckets, { op: 'insert', table: 'alerts', rows: fresh });
}

/**
 * MR-7: the audit rows of `next` above the last written sequence (`previous.audit.total`), in
 * the shared shape and in ascending sequence. A ring row that the demo fault altered has a
 * sequence at or below it and is never among them. Throws when the ring no longer holds every
 * new row (more than a ring's worth in one unit of work, or a chain that shrank).
 */
export function newAuditRows(previous: Pick<DurableSlices, 'audit'>, next: Pick<DurableSlices, 'audit'>): AuditRow[] {
  if (previous.audit === next.audit) return [];
  const fresh = next.audit.rows.filter((row) => row.seq > previous.audit.total);
  const expected = next.audit.total - previous.audit.total;
  if (expected < 0 || fresh.length !== expected) {
    throw new MappingError(
      'RING_INCOMPLETE',
      'audit',
      `the chain grew from ${previous.audit.total} to ${next.audit.total} rows, and the ring holds ${fresh.length} of the new ones.`,
    );
  }
  return fresh;
}

/** The events of `next` from the last written event counter on, in the shared shape and in ascending sequence. */
export function newEvents(previous: Pick<DurableSlices, 'events' | 'meta'>, next: Pick<DurableSlices, 'events' | 'meta'>): SimEvent[] {
  if (previous.events === next.events) return [];
  const firstNew = previous.meta.counters.event;
  const fresh = next.events.filter((event) => event.seq >= firstNew);
  const expected = next.meta.counters.event - firstNew;
  if (expected < 0 || fresh.length !== expected) {
    throw new MappingError(
      'RING_INCOMPLETE',
      'events',
      `the event counter moved from ${firstNew} to ${next.meta.counters.event}, and the ring holds ${fresh.length} of the new events.`,
    );
  }
  return fresh;
}

function diffAuditAndEvents(previous: DurableSlices, next: DurableSlices, buckets: Buckets): void {
  const audit = newAuditRows(previous, next);
  if (audit.length > 0) {
    push(buckets, { op: 'insert', table: 'auditLog', rows: audit.map(auditRowToRow) });
    const exported = exportRowsFromAudit(audit);
    if (exported.length > 0) push(buckets, { op: 'insert', table: 'exportRecords', rows: exported });
  }
  const events = newEvents(previous, next);
  if (events.length > 0) push(buckets, { op: 'insert', table: 'events', rows: events.map(eventToRow) });
}

// ── Snapshot slices (class SN) ─────────────────────────────────────────────────────────────────

function diffSnapshotInto(previous: DurableSlices, next: DurableSlices, at: number, buckets: Buckets): void {
  const set: Record<string, unknown> = {};
  for (const key of SNAPSHOT_SLICE_KEYS) {
    if (Object.is(previous[key], next[key])) continue;
    const value: SimState[typeof key] = next[key];
    set[SNAPSHOT_SLICE_COLUMNS[key]] = value === null ? null : storableJson(value, `hardware_snapshot (${key})`);
  }
  if (Object.keys(set).length === 0) return;
  push(buckets, {
    op: 'update',
    table: 'hardwareSnapshot',
    key: { singleton: true },
    set: { ...(set as Partial<MappedRow<'hardwareSnapshot'>>), writtenAt: safeInteger(at, 'hardware_snapshot.written_at') },
  });
}

// ── The three entry points ─────────────────────────────────────────────────────────────────────

function ordered(buckets: Buckets): RowChange[] {
  // Within one table: a DELETE before the INSERT that replaces the row.
  const rank = (change: RowChange): number => (change.op === 'delete' ? 0 : 1);
  return WRITE_ORDER.flatMap((table) => [...(buckets[table] ?? [])].sort((a, b) => rank(a) - rank(b)));
}

/** The changes of the 14 stored slices the engine writes (every stored slice except `operators`). */
export function diffStored(previous: DurableSlices, next: DurableSlices, at: number): RowChange[] {
  const buckets: Buckets = {};
  diffMeta(previous, next, at, buckets);
  diffDevice(previous, next, at, buckets);
  diffPolicyAndSettings(previous, next, at, buckets);
  diffCapture(previous, next, buckets);
  diffSessionHistory(previous, next, buckets);
  diffEvidence(previous, next, at, buckets);
  diffSession(previous, next, at, buckets);
  diffAlerts(previous, next, buckets);
  diffAuditAndEvents(previous, next, buckets);
  return ordered(buckets);
}

/** The one UPDATE of `hardware_snapshot` that holds the snapshot slices whose reference changed, or nothing. */
export function diffSnapshot(previous: DurableSlices, next: DurableSlices, at: number): RowChange[] {
  const buckets: Buckets = {};
  diffSnapshotInto(previous, next, at, buckets);
  return ordered(buckets);
}

/** Both: every row change between two states, in write order. `at` is the instant of the write. */
export function diffSlices(previous: DurableSlices, next: DurableSlices, at: number): RowChange[] {
  const buckets: Buckets = {};
  diffMeta(previous, next, at, buckets);
  diffDevice(previous, next, at, buckets);
  diffPolicyAndSettings(previous, next, at, buckets);
  diffCapture(previous, next, buckets);
  diffSnapshotInto(previous, next, at, buckets);
  diffSessionHistory(previous, next, buckets);
  diffEvidence(previous, next, at, buckets);
  diffSession(previous, next, at, buckets);
  diffAlerts(previous, next, buckets);
  diffAuditAndEvents(previous, next, buckets);
  return ordered(buckets);
}

/** How many rows a list of changes inserts, updates and deletes, per SQL-independent table key. */
export function summariseChanges(changes: readonly RowChange[]): Partial<Record<keyof MappedRows, { inserted: number; updated: number; deleted: number }>> {
  const summary: Partial<Record<keyof MappedRows, { inserted: number; updated: number; deleted: number }>> = {};
  for (const change of changes) {
    const entry = (summary[change.table] ??= { inserted: 0, updated: 0, deleted: 0 });
    if (change.op === 'insert') entry.inserted += change.rows.length;
    else if (change.op === 'update') entry.updated += 1;
    else entry.deleted += 1;
  }
  return summary;
}
