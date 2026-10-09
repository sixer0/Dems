/**
 * The bulk fixture as rows: a pure function of an instant, a seed and the seeded database it
 * stands on (plan row W25; database contract §11, BF-2, BF-3, BF-6).
 *
 * `buildBulkFixture(options, base)` reads no clock, no random source and no database. The same
 * options on the same base give the same rows, byte for byte: `digest` is the SHA-256 of a
 * stable dump of every row, and two builds have equal digests.
 *
 * THE AUDIT CHAIN (BF-6, AP-3). The fixture continues the seeded chain. Every audit row is made
 * by the shared `appendAudit`, the one place that computes `seq`, `id`, `prevHash` and `hash`
 * (`chainHash`), from the head the base holds; the rows are then mapped with `auditRowToRow`.
 * Nothing here hashes a row itself. The loader writes them one INSERT per row in ascending
 * sequence, under the chain lock, through the guard trigger (AP-2, AP-4).
 *
 * THE ORDER OF THE ROWS. The first fixture row is the `SCENARIO_LOADED` row of the reset that
 * built the database (the row the newest lineage entry agrees with, LN-3), stamped with the seed
 * instant. The fixture's history follows in the order it happened. Its rows carry the instant of
 * what they describe, so in sequence order `at` never decreases, with ONE exception: the step
 * from the reset marker back to the start of the fixture's history. The database checks no time
 * order (contract §6.3), and the engine's ring (the newest 1,000 rows) is in time order.
 */
import { createHash } from 'node:crypto';
import {
  DATASET_EXPORT_SEQ,
  appendAudit,
  appendEvent,
  canonicalJSON,
  exportIdFor,
  type AuditLogSlice,
  type AuditRow,
  type EventInput,
  type SimEvent,
} from '@dems/shared/sim';
import { auditRowToRow, countersToRows, eventToRow, exportRowsFromAudit } from '../mapping';
import { buildIdentity } from './identity';
import { minimumOf } from './minimums';
import { buildLineage, buildOperations, padAuditLog, padEvents } from './operations';
import { buildPipeline } from './pipeline';
import { buildActiveSession, buildRecordings } from './recordings';
import { FIXTURE_TABLES, type BulkFixtureRows, type BulkFixtureUpdates } from './rows';
import { BulkFixtureError } from './target';
import { validateBulkFixture } from './validate';
import { World, type Activity, type BulkBase, type BulkFixtureOptions } from './world';

export interface BulkFixture {
  readonly now: number;
  readonly seed: number;
  readonly activeSession: boolean;
  readonly rows: BulkFixtureRows;
  readonly updates: BulkFixtureUpdates;
  /** The chain head after the fixture's last audit row. */
  readonly expectedHead: { readonly seq: number; readonly hash: string };
  /** Rows inserted per table, by SQL name. */
  readonly added: Readonly<Record<string, number>>;
  /** The row count of each of the 42 tables after the load, by SQL name. */
  readonly expectedCounts: Readonly<Record<string, number>>;
  /** SHA-256 of a stable dump of `rows` and `updates`. */
  readonly digest: string;
}

/** Tables that must be empty in the base: the fixture loads once, on a database fresh from the seed. */
const EMPTY_IN_BASE = [
  'pairing_codes',
  'paired_devices',
  'device_credentials',
  'auth_sessions',
  'biometric_tokens',
  'alerts',
  'health_snapshots',
  'audit_chain_history',
  'active_session',
  // Schema v2 (dbc-3 §G): the seed writes no credential and no pipeline row; the fixture does.
  'capture_device_credentials',
  // Schema v3 (dbc-4 §N.10, rule S-1): the seed writes no source row while it writes no interval.
  'session_capture_sources',
  'session_audio_intervals',
  'recording_fragments',
  'transcript_chunks',
  'transcripts',
  'transcript_revisions',
  'sealing_jobs',
] as const;

const need = (minimum: number, have: number): number => Math.max(0, minimum - have);

/** A value with every byte string written as hexadecimal text, so that the dump is plain JSON. */
function plain(value: unknown): unknown {
  if (Buffer.isBuffer(value)) return `\\x${value.toString('hex')}`;
  if (Array.isArray(value)) return value.map(plain);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, member] of Object.entries(value)) out[key] = plain(member);
    return out;
  }
  return value;
}

/** The SHA-256 of a stable dump: canonical JSON (sorted keys), byte strings as hexadecimal text. */
export function fixtureDigest(rows: BulkFixtureRows, updates: BulkFixtureUpdates): string {
  return createHash('sha256').update(canonicalJSON(plain({ rows, updates })), 'utf8').digest('hex');
}

function assertBase(options: BulkFixtureOptions, base: BulkBase): void {
  const { slices, counts } = base;
  if (slices.operators.some((operator) => operator.username.startsWith('fixture.operator.'))) {
    throw new BulkFixtureError('BASE_UNEXPECTED', 'the database already holds the bulk fixture. It is loaded once, on a database fresh from the seed.');
  }
  const filled = EMPTY_IN_BASE.filter((table) => (counts[table] ?? 0) !== 0);
  if (filled.length > 0 || slices.session !== null) {
    throw new BulkFixtureError(
      'BASE_UNEXPECTED',
      `the bulk fixture stands on a database fresh from the seed of scenario idle; this one already holds rows in ${filled.join(', ') || 'active_session'}.`,
    );
  }
  const newestAudit = slices.audit.rows[slices.audit.rows.length - 1];
  const newestEvent = slices.events[slices.events.length - 1];
  const newest = Math.max(base.seededAt, newestAudit?.at ?? 0, newestEvent?.at ?? 0);
  if (!Number.isSafeInteger(options.now) || options.now < newest) {
    throw new BulkFixtureError('OPTION_INVALID', 'now must not be earlier than the seed instant and the newest seeded row: nothing the fixture writes may lie in the future of its clock.');
  }
}

export function buildBulkFixture(options: BulkFixtureOptions, base: BulkBase): BulkFixture {
  assertBase(options, base);
  const world = new World(options, base, DATASET_EXPORT_SEQ + 1);
  const { counts } = base;

  const identity = buildIdentity(world);
  const recordings = buildRecordings(world, identity.directory);
  const operations = buildOperations(world, identity.directory, recordings.recordings);
  const activeSession = options.activeSession === true ? buildActiveSession(world) : [];
  // The v2 rows of dbc-3 §G (CS-20): built on the recordings it patches with the fragment chain
  // heads of the 40 newest sessions, and on the sealed items and sessions of the base and the fixture.
  const pipeline = buildPipeline(world, identity, { ...recordings, activeSession });
  const lineage = buildLineage(world, identity.directory);
  world.mintExports(exportIdFor);

  // Bring the audit log and the events up to their minimums.
  const marker = lineage.marker === null ? 0 : 1;
  padAuditLog(world, recordings.recordings, need(minimumOf('audit_log'), base.slices.audit.total + marker + world.auditActivities));
  padEvents(world, need(minimumOf('events'), (counts['events'] ?? 0) + marker + world.eventActivities));

  // Append: the shared functions continue the chain and the event sequence of the base.
  let log: AuditLogSlice = { rows: [], head: base.slices.audit.head, total: base.slices.audit.total, dropped: 0 };
  let eventSeq = base.slices.meta.counters.event;
  const auditRows: AuditRow[] = [];
  const events: SimEvent[] = [];
  const append = (activity: Activity): void => {
    if (activity.audit !== undefined) {
      const appended = appendAudit(log, activity.audit, activity.at, 1);
      log = { rows: [], head: appended.log.head, total: appended.log.total, dropped: 0 };
      auditRows.push(appended.row);
    }
    if (activity.event !== undefined) {
      events.push(appendEvent([], activity.event, activity.at, eventSeq, 1).event);
      eventSeq += 1;
    }
  };
  if (lineage.marker !== null) {
    const reset = lineage.marker.details?.['reset'] === true;
    const scenario = String(lineage.marker.details?.['scenario'] ?? base.slices.meta.scenario);
    const event: EventInput = {
      type: 'SCENARIO_LOADED',
      message: reset ? 'Demo reset' : `Demo scenario loaded · ${scenario}`,
      // The event of the reset routine: `reset` is always there, as in the row's details.
      params: { scenario, reset },
    };
    append({ at: base.seededAt, audit: lineage.marker, event });
  }
  for (const activity of world.activities()) append(activity);

  const rows: BulkFixtureRows = {
    operators: identity.operators,
    operatorCredentials: identity.operatorCredentials,
    pairingCodes: identity.pairingCodes,
    pairedDevices: identity.pairedDevices,
    deviceCredentials: identity.deviceCredentials,
    authSessions: identity.authSessions,
    biometricTokens: identity.biometricTokens,
    sessionHistory: recordings.sessionHistory,
    evidenceItems: recordings.evidenceItems,
    evidenceTracks: recordings.evidenceTracks,
    evidenceCustody: recordings.evidenceCustody,
    // No slice holds an export record: each one is derived from its audit row (SD-7).
    exportRecords: exportRowsFromAudit(auditRows),
    activeSession,
    alerts: operations.alerts,
    healthSnapshots: operations.healthSnapshots,
    auditChainHistory: lineage.rows,
    auditLog: auditRows.map(auditRowToRow),
    events: events.map(eventToRow),
    // Schema v2 (dbc-3 §G): the capture variants and the six pipeline tables (CS-20).
    captureDevices: pipeline.captureDevices,
    captureDeviceCredentials: pipeline.captureDeviceCredentials,
    sessionCaptureSources: pipeline.sessionCaptureSources,
    sessionAudioIntervals: pipeline.sessionAudioIntervals,
    recordingFragments: pipeline.recordingFragments,
    transcriptChunks: pipeline.transcriptChunks,
    transcripts: pipeline.transcripts,
    transcriptRevisions: pipeline.transcriptRevisions,
    sealingJobs: pipeline.sealingJobs,
  };
  const updates: BulkFixtureUpdates = {
    operatorSignIns: identity.operatorSignIns,
    engineCounters: countersToRows({
      event: eventSeq,
      session: world.counters.session,
      caseNumber: world.counters.caseNumber,
      evidence: world.counters.evidence,
      item: world.counters.item,
      export: world.counters.export,
    }),
    registryCounters: [
      { name: 'device', nextValue: world.counters.device },
      { name: 'pairingCode', nextValue: world.counters.pairingCode },
    ],
    coreState: lineage.rows.length === 0 ? null : { epoch: lineage.epoch, lastResetAt: lineage.lastResetAt, updatedAt: world.now },
  };
  const expectedHead = { seq: log.total, hash: log.head };

  validateBulkFixture(rows, updates, base, world.now);

  const added: Record<string, number> = {};
  for (const key of Object.keys(FIXTURE_TABLES) as (keyof BulkFixtureRows)[]) added[FIXTURE_TABLES[key]] = rows[key].length;
  const expectedCounts: Record<string, number> = { ...counts };
  for (const [table, count] of Object.entries(added)) expectedCounts[table] = (expectedCounts[table] ?? 0) + count;
  // The `export` counter is a new row when the base has none: the one counter the fixture inserts.
  added['engine_counters'] = Math.max(0, updates.engineCounters.length - (counts['engine_counters'] ?? 0));
  expectedCounts['engine_counters'] = updates.engineCounters.length;

  return {
    now: world.now,
    seed: world.seed,
    activeSession: options.activeSession === true,
    rows,
    updates,
    expectedHead,
    added,
    expectedCounts,
    digest: fixtureDigest(rows, updates),
  };
}

export { FIXTURE_TABLES, type BulkFixtureRows, type BulkFixtureUpdates } from './rows';
