/**
 * `toRows`: the durable slices of a simulator state as table rows (plan row W20; database
 * contract MR-1, MR-6, §9.3, §9.5).
 *
 * Pure and total: it reads the 28 durable slices and one member of `pairing`, touches no clock
 * and no database, changes nothing in the state, and gives the same rows for the same input.
 * The seed and the reset write its whole result; the engine host writes what `diffSlices`
 * (`changes.ts`) finds between two states, built from the same row builders.
 *
 * The keys of the result are the table bindings of the typed schema, in the write order of the
 * contract (§9.5: parents before children, the audit log and the events last).
 */
import type { AuditChainHeadRow } from '../schema';
import { exportRowsFromAudit } from './exports';
import { MappingError } from './guards';
import {
  activeSessionToRow,
  alertToRow,
  auditRowToRow,
  coreDeviceToRow,
  coreStateToRow,
  countersToRows,
  eventToRow,
  evidenceCustodyToRows,
  evidenceItemToRow,
  evidenceTracksToRows,
  hardwareSnapshotToRow,
  operatorToRow,
  sessionHistoryToRow,
  settingsToRow,
  storagePolicyToRow,
  type RowContext,
} from './rows';
import type { MappableState } from './slices';
import type {
  ActiveSessionRow,
  AlertRow,
  AuditLogRow,
  ConsoleSettingsRow,
  CoreDeviceRow,
  CoreStateRow,
  EngineCounterRow,
  EventRow,
  EvidenceCustodyRow,
  EvidenceItemRow,
  EvidenceTrackRow,
  ExportRow,
  HardwareSnapshotRow,
  OperatorRow,
  SessionHistoryRow,
  StoragePolicyRow,
} from '../schema';

/**
 * The rows of the 16 tables that hold engine state, and the chain head they imply.
 *
 * `auditChainHead` is DERIVED and never written by a program: the guard trigger moves the head
 * with every appended audit row. It is here so that a writer can check, after its inserts, that
 * the stored head is the one the state expects, and so that `fromRows(toRows(state))` composes.
 *
 * `exportRecords` has no slice: its rows are derived from the audit rows (`exports.ts`).
 */
export interface MappedRows {
  operators: OperatorRow[];
  coreDevice: CoreDeviceRow[];
  coreState: CoreStateRow[];
  storagePolicy: StoragePolicyRow[];
  consoleSettings: ConsoleSettingsRow[];
  engineCounters: EngineCounterRow[];
  hardwareSnapshot: HardwareSnapshotRow[];
  sessionHistory: SessionHistoryRow[];
  evidenceItems: EvidenceItemRow[];
  evidenceTracks: EvidenceTrackRow[];
  evidenceCustody: EvidenceCustodyRow[];
  exportRecords: ExportRow[];
  activeSession: ActiveSessionRow[];
  alerts: AlertRow[];
  auditLog: AuditLogRow[];
  auditChainHead: AuditChainHeadRow[];
  events: EventRow[];
}

export type MappedTable = keyof MappedRows;
export type MappedRow<K extends MappedTable> = MappedRows[K][number];

/**
 * The tables in the order a writer inserts them (contract §9.5, MR-6). `auditChainHead` is not
 * in the list: no program writes it.
 */
export const WRITE_ORDER = [
  'operators',
  'coreDevice',
  'coreState',
  'storagePolicy',
  'consoleSettings',
  'engineCounters',
  'hardwareSnapshot',
  'sessionHistory',
  'evidenceItems',
  'evidenceTracks',
  'evidenceCustody',
  'exportRecords',
  'activeSession',
  'alerts',
  'auditLog',
  'events',
] as const satisfies readonly Exclude<MappedTable, 'auditChainHead'>[];

export type WrittenTable = (typeof WRITE_ORDER)[number];

/** The SQL name of each table, for messages and for the documentation of the mapping. */
export const TABLE_SQL_NAMES = {
  operators: 'operators',
  coreDevice: 'core_device',
  coreState: 'core_state',
  storagePolicy: 'storage_policy',
  consoleSettings: 'console_settings',
  engineCounters: 'engine_counters',
  hardwareSnapshot: 'hardware_snapshot',
  sessionHistory: 'session_history',
  evidenceItems: 'evidence_items',
  evidenceTracks: 'evidence_tracks',
  evidenceCustody: 'evidence_custody',
  exportRecords: 'exports',
  activeSession: 'active_session',
  alerts: 'alerts',
  auditLog: 'audit_log',
  auditChainHead: 'audit_chain_head',
  events: 'events',
} as const satisfies Record<MappedTable, string>;

/** The durable slices of `state` as rows. `context` supplies the bookkeeping instants. */
export function toRows(state: MappableState, context: RowContext): MappedRows {
  return {
    operators: state.operators.map((operator) => operatorToRow(operator, context)),
    coreDevice: [coreDeviceToRow(state.device, state.pairing.certificateFingerprint, context)],
    coreState: [coreStateToRow(state, context)],
    storagePolicy: [storagePolicyToRow(state.storagePolicy, context)],
    consoleSettings: [settingsToRow(state.settings, context)],
    engineCounters: countersToRows(state.meta.counters),
    hardwareSnapshot: [hardwareSnapshotToRow(state, context)],
    sessionHistory: state.sessionHistory.map(sessionHistoryToRow),
    evidenceItems: state.evidence.map((item) => evidenceItemToRow(item, context)),
    evidenceTracks: state.evidence.flatMap((item) => evidenceTracksToRows(item)),
    evidenceCustody: state.evidence.flatMap((item) => evidenceCustodyToRows(item)),
    exportRecords: exportRowsFromAudit(state.audit.rows),
    activeSession: state.session === null ? [] : [activeSessionToRow(state.session, context)],
    alerts: state.alerts.map(alertToRow),
    auditLog: state.audit.rows.map(auditRowToRow),
    auditChainHead: [{ singleton: true, seq: state.audit.total, hash: state.audit.head }],
    events: state.events.map(eventToRow),
  };
}

/**
 * A whole-state write (the seed, the reset) needs the WHOLE audit chain and every event: the
 * tables keep every row, while the engine's rings keep the newest 1,000 and 500. This throws
 * when a ring has already dropped rows, before a writer sends a statement. For the datasets the
 * shared builders make it never does (82 to 231 audit rows).
 */
export function assertCompleteRings(state: Pick<MappableState, 'audit' | 'events' | 'meta'>): void {
  const { audit, events, meta } = state;
  const firstAudit = audit.rows[0];
  if (audit.dropped !== 0 || audit.rows.length !== audit.total || (firstAudit !== undefined && firstAudit.seq !== 1)) {
    throw new MappingError(
      'RING_INCOMPLETE',
      'audit',
      `the ring holds ${audit.rows.length} of ${audit.total} rows; a whole-state write needs the chain from its first row.`,
    );
  }
  const firstEvent = events[0];
  const written = meta.counters.event - 1;
  if (events.length !== written || (firstEvent !== undefined && firstEvent.seq !== 1)) {
    throw new MappingError(
      'RING_INCOMPLETE',
      'events',
      `the ring holds ${events.length} of ${written} events; a whole-state write needs every event.`,
    );
  }
}

/** How many rows `rows` holds per table, by SQL table name. */
export function countRows(rows: MappedRows): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const table of Object.keys(TABLE_SQL_NAMES) as MappedTable[]) counts[TABLE_SQL_NAMES[table]] = rows[table].length;
  return counts;
}
