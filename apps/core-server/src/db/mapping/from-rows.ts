/**
 * `fromRows`: table rows back to the durable slices (plan row W20; database contract MR-1 to
 * MR-5; spec §8.6 "Restored from PostgreSQL").
 *
 * Pure. It takes the rows as a reader fetched them, in any order, and rebuilds the 28 durable
 * slices exactly as the engine held them:
 *
 *   order (MR-3)   operators by `id`; session history by `ended_at DESC, id DESC`; evidence by
 *                  `recorded_at, id`; tracks by `position`; custody by `seq`; alerts by `at, id`;
 *                  audit rows and events by `seq`. The rows are sorted here, so the result does
 *                  not depend on the order of the input.
 *   rings (MR-4)   the engine keeps the newest 1,000 audit rows, 500 events and 100 alerts; the
 *                  tables keep everything. A reader may pass more rows than a ring holds; the
 *                  newest are kept. `audit.total` and `audit.head` are the chain head's two
 *                  columns, and `audit.dropped` is `total` minus the rows kept.
 *   join (MR-5)    a history entry's `evidenceId` is the item whose `session_id` is its ID.
 *
 * A reader that wants the rings without reading whole tables passes the newest rows only
 * (`ORDER BY seq DESC LIMIT 1000` and so on); `RING_LIMITS` names the three limits.
 */
import { ALERT_RING_SIZE, AUDIT_RING_SIZE, EVENT_RING_SIZE } from '@dems/shared/sim';
import type { EvidenceCustodyRow, EvidenceTrackRow } from '../schema';
import { MappingError } from './guards';
import {
  activeSessionFromRow,
  alertFromRow,
  auditRowFromRow,
  captureConfigFromRow,
  captureDevicesFromRows,
  selectorDeviceIds,
  type CaptureDeviceListing,
  coreDeviceFromRow,
  eventFromRow,
  evidenceItemFromRows,
  metaFromRows,
  operatorFromRow,
  sessionHistoryFromRow,
  settingsFromRow,
  snapshotSlicesFromRow,
  storagePolicyFromRow,
} from './rows';
import type { DurableSlices } from './slices';
import type { MappedRows } from './to-rows';

/**
 * What `fromRows` reads: the rows of the 15 tables that hold slices, and the chain head.
 * `exportRecords` is not needed (no slice holds an export record). A `MappedRows` satisfies it,
 * so `fromRows(toRows(state, context))` is the round trip.
 */
export type StoredRows = Omit<MappedRows, 'exportRecords'>;

/** How many of the newest rows a reader needs for each ring (MR-4). */
export const RING_LIMITS = {
  auditLog: AUDIT_RING_SIZE,
  events: EVENT_RING_SIZE,
  alerts: ALERT_RING_SIZE,
} as const;

function single<T>(rows: readonly T[], table: string): T {
  const row = rows[0];
  if (rows.length !== 1 || row === undefined) {
    throw new MappingError('ROW_SHAPE', table, `the table holds ${rows.length} row(s); it must hold exactly one.`);
  }
  return row;
}

/** Text order by UTF-16 code unit: for the ASCII identifiers of this schema, the byte order of locale C. */
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function newest<T>(sorted: readonly T[], limit: number): T[] {
  return sorted.length > limit ? sorted.slice(sorted.length - limit) : [...sorted];
}

function groupBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    const group = groups.get(id);
    if (group === undefined) groups.set(id, [row]);
    else group.push(row);
  }
  return groups;
}

const NO_TRACKS: readonly EvidenceTrackRow[] = [];
const NO_CUSTODY: readonly EvidenceCustodyRow[] = [];

/** What a caller may say about the Core that reads the rows. Absent: the rows are mapped as stored. */
export interface FromRowsOptions {
  /**
   * The device-list rule of the running capture operation (finding R69-03): a registry row it
   * refuses is not in slice `captureDevices`. The selector is still read against EVERY stored row.
   */
  readonly captureDeviceListing?: CaptureDeviceListing;
}

/** The durable slices that `rows` hold. */
export function fromRows(rows: StoredRows, options: FromRowsOptions = {}): DurableSlices {
  const coreState = single(rows.coreState, 'core_state');
  const head = single(rows.auditChainHead, 'audit_chain_head');
  if (rows.activeSession.length > 1) {
    throw new MappingError('ROW_SHAPE', 'active_session', `the table holds ${rows.activeSession.length} rows; it holds at most one.`);
  }
  const activeSession = rows.activeSession[0];

  // Evidence, with its tracks and custody entries, and the join of MR-5.
  const tracksByItem = groupBy(rows.evidenceTracks, (track) => track.evidenceId);
  const custodyByItem = groupBy(rows.evidenceCustody, (entry) => entry.evidenceId);
  const evidence = [...rows.evidenceItems]
    .sort((a, b) => a.recordedAt - b.recordedAt || compareText(a.id, b.id))
    .map((item) => evidenceItemFromRows(item, tracksByItem.get(item.id) ?? NO_TRACKS, custodyByItem.get(item.id) ?? NO_CUSTODY));
  const evidenceBySession = new Map(rows.evidenceItems.map((item) => [item.sessionId, item.id] as const));

  // The audit ring and the chain head (MR-4).
  const auditRows = newest(
    [...rows.auditLog].sort((a, b) => a.seq - b.seq),
    AUDIT_RING_SIZE,
  ).map(auditRowFromRow);
  const lastAudit = auditRows[auditRows.length - 1];
  if (lastAudit === undefined ? head.seq !== 0 : lastAudit.seq !== head.seq || lastAudit.hash !== head.hash) {
    throw new MappingError(
      'ROW_SHAPE',
      'audit_chain_head',
      `the chain head is at sequence ${head.seq}, the newest audit row read is ${lastAudit === undefined ? 'none' : `sequence ${lastAudit.seq}`}.`,
    );
  }

  return {
    // Stored slices.
    meta: metaFromRows(coreState, rows.engineCounters),
    device: coreDeviceFromRow(single(rows.coreDevice, 'core_device')),
    operators: [...rows.operators].sort((a, b) => compareText(a.id, b.id)).map(operatorFromRow),
    session: activeSession === undefined ? null : activeSessionFromRow(activeSession),
    lastSealedSessionId: coreState.lastSealedSessionId,
    lastSealedAcknowledged: coreState.lastSealedAcknowledged,
    sessionHistory: [...rows.sessionHistory]
      .sort((a, b) => b.endedAt - a.endedAt || compareText(b.id, a.id))
      .map((entry) => sessionHistoryFromRow(entry, evidenceBySession.get(entry.id) ?? null)),
    storagePolicy: storagePolicyFromRow(single(rows.storagePolicy, 'storage_policy')),
    evidence,
    events: newest(
      [...rows.events].sort((a, b) => a.seq - b.seq),
      EVENT_RING_SIZE,
    ).map(eventFromRow),
    alerts: newest(
      [...rows.alerts].sort((a, b) => a.at - b.at || compareText(a.id, b.id)),
      ALERT_RING_SIZE,
    ).map(alertFromRow),
    audit: { rows: auditRows, head: head.hash, total: head.seq, dropped: head.seq - auditRows.length },
    settings: settingsFromRow(single(rows.consoleSettings, 'console_settings')),
    // Register SH-16 (D44 R5): the selector is the one row of its KEPT table and the registry at
    // least one row; a database that holds neither was never seeded (the boot refuses it the same
    // way it refuses a missing core_device). The derivations are rows.ts's, mirroring the
    // capture-config module's builders.
    captureConfig: captureConfigFromRow(single(rows.captureConfig, 'capture_config'), rows.captureDevices),
    captureDevices: captureDevicesFromRows(rows.captureDevices, options.captureDeviceListing, selectorDeviceIds(single(rows.captureConfig, 'capture_config'))),
    // Snapshot slices.
    ...snapshotSlicesFromRow(single(rows.hardwareSnapshot, 'hardware_snapshot')),
  };
}
