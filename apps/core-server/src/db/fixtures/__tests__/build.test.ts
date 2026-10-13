// The bulk fixture as rows, without a database (plan row W25; database contract §11, BF-2 to
// BF-6). The base is the shared dataset through the one mapping, there and back: what the loader
// reads from a clone of the seed template. Database-free, so it runs in every later row's gate.
import {
  BIOMETRIC_TOKEN_PATTERN,
  DEVICE_CREDENTIAL_PATTERN,
  PAIRING_QR_PAYLOAD_PATTERN,
  SESSION_TOKEN_PATTERN,
  isWellFormedText,
} from '@dems/shared/api';
import {
  AUDIT_TYPE_CATEGORY,
  AuditType,
  DEMO_OPERATOR_PASSWORD,
  DEMO_PAIRING_CODE,
  EVIDENCE_HISTORY,
  EVIDENCE_NOT_SEALED_DIGEST,
  GENESIS_HASH,
  OPERATORS,
  TODAY_HISTORY,
  verifyAuditChain,
  verifyEvidenceItem,
  type AuditRow,
} from '@dems/shared/sim';
import { beforeAll, describe, expect, it } from 'vitest';
import { FINALIZATION_STEPS_V2 } from '@dems/shared/domain';
import { auditRowFromRow, evidenceItemFromRows } from '../../mapping';
import { FIXTURE_TABLES, buildBulkFixture, fixtureDigest, type BulkFixture } from '../build';
import { BULK_MINIMUMS, BULK_MIX, compareWithMinimums, minimumOf } from '../minimums';
import { BULK_FIXTURE_SEED } from '../rng';
import { BulkFixtureError } from '../target';
import { validateBulkFixture } from '../validate';
import { UNICODE_SAMPLE } from '../world';
import { FIXED_NOW, pureBase } from './support';

const base = pureBase(FIXED_NOW);
let fixture: BulkFixture;

beforeAll(() => {
  fixture = buildBulkFixture({ now: FIXED_NOW }, base);
});

const countBy = <T>(items: readonly T[], key: (item: T) => string | null): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const name = key(item);
    if (name !== null) counts[name] = (counts[name] ?? 0) + 1;
  }
  return counts;
};

/** Every string of a value, JSON members included. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const item of value) strings(item, out);
  else if (value !== null && typeof value === 'object' && !Buffer.isBuffer(value)) {
    for (const [key, member] of Object.entries(value)) {
      out.push(key);
      strings(member, out);
    }
  }
  return out;
}

describe('the minimums of contract §11 as revised by dbc-3 §G', () => {
  it('the table has 47 entries, one per table of the typed schema', () => {
    expect(BULK_MINIMUMS).toHaveLength(47);
    expect(new Set(BULK_MINIMUMS.map((entry) => entry.table)).size).toBe(47);
    // Schema v2 (CS-20 of the row-55 review): §G made the v2 minimums bulk-fixture deliverables.
    // The table now covers every table `base.counts` names - nothing counted is unasserted,
    // nothing asserted is unknown to the schema.
    const counted = Object.keys(base.counts);
    expect(counted).toHaveLength(47);
    for (const entry of BULK_MINIMUMS) expect(counted).toContain(entry.table);
    expect(counted.filter((table) => !BULK_MINIMUMS.some((entry) => entry.table === table))).toEqual([]);
    expect(minimumOf('audit_log')).toBe(5_000);
    expect(minimumOf('events')).toBe(2_500);
    expect(minimumOf('evidence_items')).toBe(505);
    // The §G numbers, pinned as the contract states them.
    expect(minimumOf('session_audio_intervals')).toBe(720);
    expect(minimumOf('recording_fragments')).toBe(6_500);
    expect(minimumOf('transcript_chunks')).toBe(2_000);
    expect(minimumOf('transcripts')).toBe(400);
    expect(minimumOf('transcript_revisions')).toBe(30);
    expect(minimumOf('sealing_jobs')).toBe(3_000);
    // dbc-4 §N.10: capture_devices revised 8 -> 12; T-41 joins with 1,600.
    expect(minimumOf('capture_devices')).toBe(12);
    expect(minimumOf('session_capture_sources')).toBe(1_600);
    // PE-129b-01: T-42 joins with 0 - the fixture builds no STT snapshot (rule S-2 of the erratum).
    expect(minimumOf('session_stt_config')).toBe(0);
    // PE-0013-01: T-43 joins with 0 - the media store root is a fact of a running Core.
    expect(minimumOf('core_media_store')).toBe(0);
    // Task 4 schema set A: T-44 and T-45 join with 0 - a connection test and a registration write them.
    expect(minimumOf('capture_device_streams')).toBe(0);
    expect(minimumOf('capture_audio_inputs')).toBe(0);
    // Task 4 schema set B: T-46 and T-47 join with 0 - facts of an installation, written by a technician's action.
    expect(minimumOf('capture_network_config')).toBe(0);
    expect(minimumOf('host_network_aliases')).toBe(0);
    expect(minimumOf('capture_device_credentials')).toBe(2);
    expect(() => minimumOf('no_such_table')).toThrow(RangeError);
  });

  it('every table holds at least its minimum after the load (entity, minimum, loaded)', () => {
    const comparison = compareWithMinimums(fixture.expectedCounts);
    expect(comparison.filter((entry) => !entry.met)).toEqual([]);
    expect(comparison).toHaveLength(47);
    // The seed alone is far below: the comparison is able to fail.
    expect(compareWithMinimums(base.counts).filter((entry) => !entry.met).map((entry) => entry.table)).toContain('audit_log');
    // What the fixture adds is what its row lists hold.
    for (const [key, table] of Object.entries(FIXTURE_TABLES)) {
      expect(fixture.added[table], table).toBe(fixture.rows[key as keyof typeof FIXTURE_TABLES].length);
      expect(fixture.expectedCounts[table], table).toBe((base.counts[table] ?? 0) + (fixture.added[table] ?? 0));
    }
    // The one row the fixture adds outside its row lists: the `export` counter, which the seed does not write.
    expect(fixture.added['engine_counters']).toBe(1);
    expect(fixture.expectedHead.seq).toBe(fixture.expectedCounts['audit_log']);
  });

  it('operators: synthetic, the mix, one credential row each made of bytes that are no password hash', () => {
    const { operators, operatorCredentials } = fixture.rows;
    expect(operators.map((row) => row.id)).toEqual(['OPR-004', 'OPR-005', 'OPR-006', 'OPR-007', 'OPR-008', 'OPR-009', 'OPR-010', 'OPR-011', 'OPR-012']);
    for (const row of operators) {
      expect(row.username).toBe(`fixture.operator.${row.id.slice(4)}`);
      expect(row.name.startsWith(`Fixture Operator ${row.id.slice(4)}`)).toBe(true);
    }
    const all = [...base.slices.operators.map((operator) => ({ roleId: operator.role, enabled: true })), ...operators];
    expect(all.filter((row) => row.enabled && row.roleId === 'SUPERVISOR').length).toBeGreaterThanOrEqual(BULK_MIX.operators.enabledSupervisors + 1);
    expect(all.filter((row) => !row.enabled).length).toBeGreaterThanOrEqual(BULK_MIX.operators.disabled);
    expect(new Set(all.map((row) => row.roleId)).size).toBe(3);
    expect(operatorCredentials.map((row) => row.operatorId)).toEqual(operators.map((row) => row.id));
    expect(new Set(operatorCredentials.map((row) => row.hash.toString('hex'))).size).toBe(operatorCredentials.length);
    // A disabled operator has no open session and no live token.
    const disabled = new Set(operators.filter((row) => !row.enabled).map((row) => row.id));
    expect(fixture.rows.authSessions.filter((row) => row.endedAt === null && disabled.has(row.operatorId))).toEqual([]);
  });

  it('auth sessions, pairing codes, devices, credentials and biometric tokens: the mix', () => {
    const { authSessions, pairingCodes, pairedDevices, deviceCredentials, biometricTokens } = fixture.rows;
    const open = authSessions.filter((row) => row.endedAt === null);
    expect(open.length).toBeGreaterThanOrEqual(BULK_MIX.authSessions.open);
    expect(open.filter((row) => row.deviceId !== null).length).toBeGreaterThanOrEqual(BULK_MIX.authSessions.openDeviceBound);
    expect(open.filter((row) => row.method === 'BIOMETRIC').length).toBeGreaterThanOrEqual(BULK_MIX.authSessions.openBiometric);
    const reasons = countBy(authSessions, (row) => row.endReason);
    expect(Object.keys(reasons)).toHaveLength(BULK_MIX.authSessions.endReasons);
    for (const [reason, rows] of Object.entries(reasons)) expect(rows, reason).toBeGreaterThanOrEqual(BULK_MIX.authSessions.perEndReason);
    expect(authSessions.filter((row) => row.endReason === 'TOKEN_REUSE').every((row) => row.method === 'BIOMETRIC' && row.deviceId !== null)).toBe(true);
    // An open session is alive at the clock: inside the absolute limit and the idle limit.
    expect(open.every((row) => row.absoluteExpiresAt > FIXED_NOW && row.lastSeenAt >= FIXED_NOW - 15 * 60_000)).toBe(true);
    const paired = new Set(pairedDevices.filter((row) => row.state === 'PAIRED').map((row) => row.id));
    expect(open.every((row) => row.deviceId === null || paired.has(row.deviceId))).toBe(true);
    // A session of a device ends with the device, with its reason.
    for (const device of pairedDevices.filter((row) => row.state !== 'PAIRED')) {
      const end = device.revokedAt ?? device.unpairedAt ?? 0;
      const sessions = authSessions.filter((row) => row.deviceId === device.id);
      expect(sessions.every((row) => row.endedAt !== null && row.endedAt <= end), device.id).toBe(true);
    }

    // A device was seen at least as late as any of its sessions, and never before it was paired.
    for (const device of pairedDevices) {
      const seen = authSessions.filter((row) => row.deviceId === device.id).map((row) => row.lastSeenAt);
      expect(device.lastSeenAt, device.id).toBeGreaterThanOrEqual(Math.max(device.pairedAt, ...seen));
    }

    const codes = countBy(pairingCodes, (row) => row.state);
    expect(codes['ACTIVE']).toBe(BULK_MIX.pairingCodes.activeAtMost);
    expect(codes['REDEEMED']).toBeGreaterThanOrEqual(BULK_MIX.pairingCodes.redeemed);
    for (const state of ['CANCELLED', 'EXPIRED', 'EXHAUSTED']) expect(codes[state], state).toBeGreaterThanOrEqual(5);
    // Identifiers are minted in the order of the issue, as the registry counter does.
    expect(pairingCodes.every((row, index, all) => index === 0 || row.issuedAt >= (all[index - 1]?.issuedAt ?? 0))).toBe(true);
    expect(pairingCodes.map((row) => row.id)).toEqual(pairingCodes.map((_, index) => `PCD-${String(index + 1).padStart(6, '0')}`));
    const devices = countBy(pairedDevices, (row) => row.state);
    expect(devices).toEqual({ PAIRED: 20, REVOKED: 10, UNPAIRED: 10 });
    expect(pairedDevices.map((row) => row.id)).toEqual(pairedDevices.map((_, index) => `DEV-${String(index + 1).padStart(4, '0')}`));
    expect(new Set(pairedDevices.map((row) => row.pairedWithCodeId)).size).toBe(40);
    expect(deviceCredentials.map((row) => row.deviceId)).toEqual(pairedDevices.map((row) => row.id));
    expect(deviceCredentials.filter((row) => row.nextHash !== null).length).toBeGreaterThanOrEqual(BULK_MIX.deviceCredentials.withNextHash);

    const tokens = BULK_MIX.biometricTokens;
    const unused = biometricTokens.filter((row) => row.usedAt === null && row.revokedAt === null);
    expect(unused.filter((row) => row.expiresAt > FIXED_NOW).length).toBeGreaterThanOrEqual(tokens.live);
    expect(unused.filter((row) => row.expiresAt <= FIXED_NOW).length).toBeGreaterThanOrEqual(tokens.pastExpiry);
    expect(biometricTokens.filter((row) => row.usedAt !== null && row.revokedAt === null).length).toBeGreaterThanOrEqual(tokens.used);
    expect(biometricTokens.filter((row) => row.revokedAt !== null).length).toBeGreaterThanOrEqual(tokens.revoked);
    expect(Object.keys(countBy(biometricTokens, (row) => row.revokeReason))).toHaveLength(tokens.revokeReasons);
    // A reuse revokes the family and ends the biometric sessions of that device and operator at the same instant.
    for (const token of biometricTokens.filter((row) => row.revokeReason === 'TOKEN_REUSE')) {
      const ended = authSessions.filter((row) => row.endReason === 'TOKEN_REUSE' && row.deviceId === token.deviceId && row.operatorId === token.operatorId);
      expect(ended).toHaveLength(2);
      expect(ended.every((row) => row.endedAt === token.revokedAt)).toBe(true);
    }
    expect(fixture.updates.registryCounters).toEqual([
      { name: 'device', nextValue: 41 },
      { name: 'pairingCode', nextValue: 61 },
    ]);
  });

  it('the audit log: every one of the 53 types, all 8 categories, one session with more than 200 rows, refusals, actors', () => {
    const { auditLog } = fixture.rows;
    const types = countBy(auditLog, (row) => row.type);
    expect(Object.keys(types).sort()).toEqual(Object.values(AuditType).sort());
    expect(Object.keys(types).length).toBeGreaterThanOrEqual(BULK_MIX.auditLog.types);
    expect(Object.keys(countBy(auditLog, (row) => row.category))).toHaveLength(BULK_MIX.auditLog.categories);
    for (const row of auditLog.slice(0, 500)) expect(row.category).toBe(AUDIT_TYPE_CATEGORY[row.type as AuditType]);
    expect(Math.max(...Object.values(countBy(auditLog, (row) => row.sessionId)))).toBeGreaterThanOrEqual(BULK_MIX.auditLog.rowsOfOneSession);
    expect(types['ACCESS_DENIED']).toBeGreaterThanOrEqual(BULK_MIX.auditLog.accessDenied);
    expect(Object.keys(countBy(auditLog, (row) => row.actorId)).length).toBeGreaterThanOrEqual(BULK_MIX.auditLog.actors);
    expect(Object.keys(countBy(auditLog, (row) => row.actorId))).toHaveLength(12);
    // Each of the five filter columns is filled in many rows, and empty in many.
    for (const column of ['actorId', 'sessionId', 'evidenceId', 'deviceId'] as const) {
      const filled = auditLog.filter((row) => row[column] !== null).length;
      expect(filled, column).toBeGreaterThan(400);
      expect(auditLog.length - filled, column).toBeGreaterThan(400);
    }
    // A refusal names an operation, the missing permission and the role, and the role really lacks it.
    for (const row of auditLog.filter((candidate) => candidate.type === 'ACCESS_DENIED')) {
      expect(Object.keys(row.details).sort()).toEqual(['operationId', 'permission', 'role']);
      expect(row.severity).toBe('WARNING');
    }
  });

  it('the lineage: 25 discarded chains, and the newest agrees with the one SCENARIO_LOADED row', () => {
    const { auditChainHistory, auditLog } = fixture.rows;
    const mix = BULK_MIX.auditChainHistory;
    expect(auditChainHistory.map((row) => row.resetNo)).toEqual(Array.from({ length: 25 }, (_, index) => index + 1));
    expect(auditChainHistory.every((row, index, all) => index === 0 || row.epoch > (all[index - 1]?.epoch ?? 0))).toBe(true);
    const reasons = countBy(auditChainHistory, (row) => row.reason);
    expect(reasons['RESET']).toBeGreaterThanOrEqual(mix.perReason);
    expect(reasons['SCENARIO_LOAD']).toBeGreaterThanOrEqual(mix.perReason);
    expect(auditChainHistory.filter((row) => row.actorId === null).length).toBeGreaterThanOrEqual(mix.withoutActor);
    expect(Object.keys(countBy(auditChainHistory, (row) => row.scenario)).length).toBeGreaterThanOrEqual(mix.scenarios);
    expect(auditChainHistory.filter((row) => row.lastSeq > row.rowCount)).toHaveLength(mix.notIntact);
    expect(auditChainHistory.filter((row) => row.reason === 'RESET').every((row) => row.scenario === 'idle')).toBe(true);
    const newest = auditChainHistory[auditChainHistory.length - 1];
    expect(newest?.resetAt).toBe(base.seededAt);
    expect(fixture.updates.coreState?.epoch).toBeGreaterThan(newest?.epoch ?? Number.MAX_SAFE_INTEGER);
    expect(fixture.updates.coreState?.lastResetAt).toBe(newest?.resetAt);
    // LN-3, and the place of the marker: it is the first row the fixture appends.
    const loaded = auditLog.filter((row) => row.type === 'SCENARIO_LOADED');
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toBe(auditLog[0]);
    expect(loaded[0]?.seq).toBe(base.slices.audit.total + 1);
    expect(loaded[0]?.details).toMatchObject({ previousHead: newest?.headHash, previousRows: newest?.rowCount, scenario: 'idle', reset: true });
    expect(loaded[0]?.actorId).toBe(newest?.actorId);
  });

  it('events: all 10 categories and all 4 severities, numbered without a gap after the seeded ones', () => {
    const { events } = fixture.rows;
    expect(Object.keys(countBy(events, (row) => row.category))).toHaveLength(BULK_MIX.events.categories);
    expect(Object.keys(countBy(events, (row) => row.severity))).toHaveLength(BULK_MIX.events.severities);
    expect(events[0]?.seq).toBe(base.slices.meta.counters.event);
    expect(events[0]?.type).toBe('SCENARIO_LOADED');
    expect(Object.keys(countBy(events, (row) => row.type)).length).toBeGreaterThanOrEqual(35);
  });

  it('sessions, evidence, tracks, custody and exports: the mix', () => {
    const { sessionHistory, evidenceItems, evidenceTracks, evidenceCustody, exportRecords } = fixture.rows;
    const seededSessions = base.slices.sessionHistory;
    const outcomes = countBy([...seededSessions, ...sessionHistory], (row) => row.outcome);
    expect(outcomes['SEALED']).toBeGreaterThanOrEqual(BULK_MIX.sessionHistory.sealed);
    expect(outcomes['INCOMPLETE']).toBeGreaterThanOrEqual(BULK_MIX.sessionHistory.incomplete);
    const withEvidence = new Set(evidenceItems.map((row) => row.sessionId));
    expect(sessionHistory.filter((row) => !withEvidence.has(row.id)).length).toBeGreaterThanOrEqual(BULK_MIX.sessionHistory.withoutEvidence);
    expect(sessionHistory.filter((row) => !withEvidence.has(row.id)).every((row) => row.outcome === 'INCOMPLETE' && row.startedAt === null)).toBe(true);

    const mix = BULK_MIX.evidenceItems;
    const status = countBy([...base.slices.evidence, ...evidenceItems], (row) => row.status);
    expect(status['SEALED']).toBeGreaterThanOrEqual(mix.sealed);
    expect(status['EXPORTED']).toBeGreaterThanOrEqual(mix.exported);
    expect(status['ARCHIVED']).toBeGreaterThanOrEqual(mix.archived);
    expect(status['UNDER_REVIEW']).toBeGreaterThanOrEqual(mix.underReview);
    expect(status['RECORDED']).toBeGreaterThanOrEqual(mix.recorded);
    expect(evidenceItems.filter((row) => row.tampered).length + base.slices.evidence.filter((item) => item.tampered).length).toBeGreaterThanOrEqual(mix.tampered);
    expect(Object.keys(countBy(evidenceItems, (row) => row.caseType))).toHaveLength(mix.caseTypes);
    expect(evidenceItems.every((row) => row.integritySource === 'SIMULATED')).toBe(true);
    // Fix wave J (truth rule 3a): four tracks per SEALED item; an item that was never sealed has none, holds the null digest and no verdict.
    const neverSealed = evidenceItems.filter((row) => row.sealedAt === null);
    expect(neverSealed.length).toBeGreaterThan(0);
    expect(neverSealed.length).toBe(evidenceItems.filter((row) => row.status === 'RECORDED').length);
    expect(neverSealed.every((row) => row.status === 'RECORDED' && row.manifestHash === EVIDENCE_NOT_SEALED_DIGEST && row.signatureValue === EVIDENCE_NOT_SEALED_DIGEST && row.verificationStatus === 'NOT_RUN' && !row.tampered)).toBe(true);
    expect(evidenceTracks.filter((track) => neverSealed.some((row) => row.id === track.evidenceId))).toEqual([]);
    expect(evidenceItems.filter((row) => row.sealedAt !== null).every((row) => row.manifestHash !== EVIDENCE_NOT_SEALED_DIGEST)).toBe(true);
    expect(evidenceTracks).toHaveLength((evidenceItems.length - neverSealed.length) * BULK_MIX.evidenceTracks.perItem);
    const custody = countBy(evidenceCustody, (row) => row.evidenceId);
    expect(Math.min(...Object.values(custody))).toBeGreaterThanOrEqual(BULK_MIX.evidenceCustody.perItem);
    expect(new Set(Object.values(custody)).size).toBeGreaterThanOrEqual(3);
    // Recordings never overlap: one Core, one room.
    const recorded = sessionHistory.filter((row) => row.startedAt !== null).sort((a, b) => a.createdAt - b.createdAt);
    expect(recorded.every((row, index, all) => index === 0 || row.createdAt > (all[index - 1]?.endedAt ?? 0))).toBe(true);
    // And they end before the seeded dataset's own recordings begin.
    const firstSeeded = Math.min(...seededSessions.map((entry) => entry.createdAt));
    expect(Math.max(...sessionHistory.map((row) => row.endedAt))).toBeLessThan(firstSeeded);

    const scopes = countBy(exportRecords, (row) => row.scope);
    expect((scopes['EVIDENCE'] ?? 0) + (base.counts['exports'] ?? 0)).toBeGreaterThanOrEqual(BULK_MIX.exports.evidence);
    expect(scopes['AUDIT']).toBeGreaterThanOrEqual(BULK_MIX.exports.audit);
    expect(scopes['LOGS']).toBeGreaterThanOrEqual(BULK_MIX.exports.logs);
    // Export identifiers continue after the dataset's EXP-000031, in the order of the exports.
    expect(exportRecords.map((row) => row.id)).toEqual(exportRecords.map((_, index) => `EXP-${String(32 + index).padStart(6, '0')}`));
    expect(exportRecords.every((row, index, all) => index === 0 || row.at >= (all[index - 1]?.at ?? 0))).toBe(true);
  });

  it('an untouched item verifies with the shared check, and a tampered one fails on exactly its altered track', () => {
    const { evidenceItems, evidenceTracks, evidenceCustody } = fixture.rows;
    const itemOf = (id: string) => {
      const row = evidenceItems.find((candidate) => candidate.id === id);
      if (row === undefined) throw new Error('no such item');
      return evidenceItemFromRows(row, evidenceTracks.filter((track) => track.evidenceId === id), evidenceCustody.filter((entry) => entry.evidenceId === id));
    };
    const tampered = evidenceItems.filter((row) => row.tampered);
    expect(new Set(tampered.map((row) => row.tamperedTrackId)).size).toBe(4);
    for (const row of tampered) {
      const result = verifyEvidenceItem(itemOf(row.id), FIXED_NOW);
      expect(result.ok).toBe(false);
      expect(result.tracks.filter((track) => !track.ok).map((track) => track.trackId)).toEqual([row.tamperedTrackId]);
      expect(['NOT_RUN', 'FAIL']).toContain(row.verificationStatus);
    }
    expect(tampered.filter((row) => row.verificationStatus === 'FAIL').length).toBeGreaterThanOrEqual(5);
    for (const row of evidenceItems.filter((candidate) => !candidate.tampered && candidate.sealedAt !== null).slice(0, 60)) {
      expect(verifyEvidenceItem(itemOf(row.id), FIXED_NOW).ok, row.id).toBe(true);
      expect(['NOT_RUN', 'PASS']).toContain(row.verificationStatus);
    }
    // Fix wave J (truth rule 3a; JA2-01 / JW-01): a never-sealed item holds nothing a comparison could confirm - the shared check cannot say PASS for it.
    for (const row of evidenceItems.filter((candidate) => candidate.sealedAt === null).slice(0, 20)) {
      expect(verifyEvidenceItem(itemOf(row.id), FIXED_NOW).ok, row.id).toBe(false);
      expect(row.verificationStatus).toBe('NOT_RUN');
    }
    expect(evidenceItems.filter((row) => row.verificationStatus === 'PASS').length).toBeGreaterThanOrEqual(50);
  });

  it('alerts and health snapshots: the mix, and no active alert of a fault kind', () => {
    const { alerts, healthSnapshots } = fixture.rows;
    expect(alerts.filter((row) => row.active).length).toBeGreaterThanOrEqual(BULK_MIX.alerts.active);
    expect(alerts.filter((row) => row.acknowledged).length).toBeGreaterThanOrEqual(BULK_MIX.alerts.acknowledged);
    expect(Object.keys(countBy(alerts, (row) => (row.kind === 'SYSTEM' ? null : row.kind)))).toHaveLength(BULK_MIX.alerts.faultKinds);
    expect(alerts.filter((row) => row.active && row.kind !== 'SYSTEM')).toEqual([]);
    expect(base.slices.faults.active).toEqual([]);
    const causes = countBy(healthSnapshots, (row) => row.cause);
    expect(causes['INTERVAL']).toBe(BULK_MIX.healthSnapshots.interval);
    expect((causes['FAULT_RAISED'] ?? 0) + (causes['FAULT_CLEARED'] ?? 0)).toBeGreaterThanOrEqual(BULK_MIX.healthSnapshots.fault);
    const interval = healthSnapshots.filter((row) => row.cause === 'INTERVAL').map((row) => row.at);
    expect(Math.max(...interval)).toBe(FIXED_NOW);
    expect(interval.every((at, index) => index === 0 || at - (interval[index - 1] ?? 0) === 60_000)).toBe(true);
    // A snapshot of a raise sees that fault active; some snapshot falls inside a seeded recording.
    expect(healthSnapshots.filter((row) => row.cause === 'FAULT_RAISED').every((row) => row.activeFaults >= 1)).toBe(true);
    expect(healthSnapshots.some((row) => row.sessionState === 'RECORDING')).toBe(true);
  });

  it('the counters are above the highest minted number, and the export counter is present', () => {
    const counters = Object.fromEntries(fixture.updates.engineCounters.map((row) => [row.name, row.nextValue]));
    expect(Object.keys(counters)).toEqual(['event', 'session', 'caseNumber', 'evidence', 'item', 'export']);
    const last = <T>(rows: readonly T[]): T | undefined => rows[rows.length - 1];
    expect(counters['event']).toBe((last(fixture.rows.events)?.seq ?? 0) + 1);
    expect(counters['evidence']).toBe(Number(last(fixture.rows.evidenceItems)?.id.slice(-4)) + 1);
    expect(counters['export']).toBe(Number(last(fixture.rows.exportRecords)?.id.slice(-6)) + 1);
    // Six sessions were created and cancelled: they used a number and left no history row.
    expect(counters['session']).toBe(base.slices.meta.counters.session + fixture.rows.sessionHistory.length + 6);
    expect(counters['session']).toBeLessThan(9_999);
    expect(counters['evidence']).toBeLessThan(9_999);
  });
});

describe('the audit chain of the fixture (BF-6)', () => {
  it('continues the seeded chain, and the whole chain verifies from the genesis hash with the shared check', () => {
    const seeded = base.slices.audit;
    const rows: AuditRow[] = [...seeded.rows, ...fixture.rows.auditLog.map(auditRowFromRow)];
    expect(seeded.rows).toHaveLength(seeded.total);
    expect(fixture.rows.auditLog[0]?.prevHash).toBe(seeded.head);
    expect(rows[0]?.prevHash).toBe(GENESIS_HASH);
    const verdict = verifyAuditChain({ rows, head: fixture.expectedHead.hash, total: rows.length, dropped: 0 });
    expect(verdict).toEqual({ ok: true, checked: rows.length, head: fixture.expectedHead.hash });
    expect(rows.length).toBeGreaterThanOrEqual(5_000);
    // One altered row anywhere, and the check fails there.
    const altered = rows.map((row, index) => (index === 3_210 ? { ...row, message: `${row.message}!` } : row));
    expect(verifyAuditChain({ rows: altered, head: fixture.expectedHead.hash, total: rows.length, dropped: 0 })).toMatchObject({ ok: false, seq: 3_211, reason: 'HASH_MISMATCH' });
  });

  it('in sequence order the instant never decreases, except once: after the reset marker', () => {
    const descents = (ats: readonly number[]): number[] => ats.flatMap((at, index) => (index > 0 && at < (ats[index - 1] ?? 0) ? [index] : []));
    const audit = [...base.slices.audit.rows.map((row) => row.at), ...fixture.rows.auditLog.map((row) => row.at)];
    // Index of the first row after the marker, counted from the first row of the chain.
    expect(descents(audit)).toEqual([base.slices.audit.total + 1]);
    const events = [...base.slices.events.map((event) => event.at), ...fixture.rows.events.map((row) => row.at)];
    expect(descents(events)).toEqual([base.slices.events.length + 1]);
    // The engine's ring, the newest 1,000 rows, is in time order, and ends at or before the clock.
    expect(descents(audit.slice(-1_000))).toEqual([]);
    expect(Math.max(...audit)).toBeLessThanOrEqual(FIXED_NOW);
  });
});

describe('determinism (BF-3)', () => {
  it('two builds with the same seed, clock and base give the same rows and the same digest', () => {
    const again = buildBulkFixture({ now: FIXED_NOW, seed: BULK_FIXTURE_SEED }, pureBase(FIXED_NOW));
    expect(again.digest).toBe(fixture.digest);
    expect(again.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(again.rows.auditLog[again.rows.auditLog.length - 1]).toEqual(fixture.rows.auditLog[fixture.rows.auditLog.length - 1]);
    expect(again.rows.authSessions).toEqual(fixture.rows.authSessions);
    expect(again.rows.healthSnapshots).toEqual(fixture.rows.healthSnapshots);
    expect(again.expectedHead).toEqual(fixture.expectedHead);
    expect(fixtureDigest(again.rows, again.updates)).toBe(fixture.digest);
  });

  it('another seed or another clock gives other rows, and still every minimum', () => {
    const otherSeed = buildBulkFixture({ now: FIXED_NOW, seed: BULK_FIXTURE_SEED + 1 }, base);
    expect(otherSeed.digest).not.toBe(fixture.digest);
    expect(compareWithMinimums(otherSeed.expectedCounts).filter((entry) => !entry.met)).toEqual([]);
    const later = FIXED_NOW + 3 * 86_400_000 + 5 * 3_600_000;
    const otherClock = buildBulkFixture({ now: later }, pureBase(later));
    expect(otherClock.digest).not.toBe(fixture.digest);
    expect(compareWithMinimums(otherClock.expectedCounts).filter((entry) => !entry.met)).toEqual([]);
    expect(otherClock.rows.sessionHistory[0]?.id).not.toBe(fixture.rows.sessionHistory[0]?.id);
  });

  it('the digest moves when one value of one row moves', () => {
    const rows = { ...fixture.rows, alerts: fixture.rows.alerts.map((row, index) => (index === 7 ? { ...row, acknowledged: !row.acknowledged } : row)) };
    expect(fixtureDigest(rows, fixture.updates)).not.toBe(fixture.digest);
    const hashes = { ...fixture.rows, pairingCodes: fixture.rows.pairingCodes.map((row, index) => (index === 0 ? { ...row, codeHash: Buffer.alloc(32, 1) } : row)) };
    expect(fixtureDigest(hashes, fixture.updates)).not.toBe(fixture.digest);
  });
});

describe('synthetic data only, and text that exercises the storage path', () => {
  const texts = (): string[] => strings(fixture.rows);

  it('no person name of the shared dataset, no real-looking account, no demo credential', () => {
    const all = texts().join('\n');
    // The seeded operators appear by name only where a row ABOUT them says who signed in.
    const subjects = [...EVIDENCE_HISTORY, ...TODAY_HISTORY].map((entry) => entry.subjectName);
    expect(subjects.length).toBeGreaterThan(5);
    for (const name of subjects) expect(all.includes(name), 'a subject name of the dataset').toBe(false);
    const columns = [
      ...fixture.rows.operators.flatMap((row) => [row.username, row.name, row.displayName]),
      ...fixture.rows.sessionHistory.map((row) => row.subjectName),
      ...fixture.rows.evidenceItems.map((row) => row.subjectName),
      ...fixture.rows.pairedDevices.map((row) => row.name),
    ].join('\n');
    for (const operator of OPERATORS) {
      expect(columns.includes(operator.name)).toBe(false);
      expect(columns.includes(operator.username)).toBe(false);
    }
    expect(fixture.rows.sessionHistory.every((row) => row.subjectName.startsWith('Fixture Subject '))).toBe(true);
    expect(all.includes('@'), 'an e-mail address').toBe(false);
    expect(all.includes(DEMO_OPERATOR_PASSWORD)).toBe(false);
    expect(new RegExp(`(?<![0-9a-f])${DEMO_PAIRING_CODE}(?![0-9a-f])`).test(all)).toBe(false);
  });

  it('every text passes the text rule of the API, and none has the form of a credential', () => {
    const anywhere = (anchored: RegExp): RegExp => new RegExp(anchored.source.slice(1, -1));
    const forms = [SESSION_TOKEN_PATTERN, DEVICE_CREDENTIAL_PATTERN, BIOMETRIC_TOKEN_PATTERN, PAIRING_QR_PAYLOAD_PATTERN].map(anywhere);
    const all = texts();
    expect(all.length).toBeGreaterThan(100_000);
    expect(all.filter((text) => !isWellFormedText(text))).toEqual([]);
    expect(all.filter((text) => forms.some((form) => form.test(text)))).toEqual([]);
  });

  it('text outside ASCII and outside the Basic Multilingual Plane is in several tables', () => {
    expect([...UNICODE_SAMPLE].filter((character) => (character.codePointAt(0) ?? 0) > 0xffff)).toHaveLength(2);
    expect(isWellFormedText(UNICODE_SAMPLE)).toBe(true);
    const holds = (rows: readonly object[]): number => rows.filter((row) => strings(row).some((text) => text.includes(UNICODE_SAMPLE))).length;
    for (const table of ['operators', 'pairedDevices', 'sessionHistory', 'evidenceItems', 'evidenceCustody', 'exportRecords', 'alerts', 'auditLog'] as const) {
      expect(holds(fixture.rows[table]), table).toBeGreaterThanOrEqual(1);
    }
    // A few rows, not most of them.
    expect(holds(fixture.rows.auditLog)).toBeLessThan(fixture.rows.auditLog.length / 10);
  });

  it('no payload map holds a key that may name a secret', () => {
    const keys = new Set<string>();
    for (const row of fixture.rows.auditLog) for (const key of Object.keys(row.details)) keys.add(key);
    for (const row of fixture.rows.events) for (const key of Object.keys(row.params)) keys.add(key);
    expect(matchesNoSecretKey([...keys])).toEqual([]);
    for (const key of keys) expect(key).toMatch(/^[a-z][A-Za-z0-9]{0,47}$/);
  });
});

/** The keys of `keys` that the contract's NO_SECRET_KEYS list names, in any letter case. */
function matchesNoSecretKey(keys: readonly string[]): string[] {
  const forbidden = ['password', 'passwordhash', 'salt', 'token', 'tokenhash', 'sessiontoken', 'devicecredential', 'credential', 'credentialhash', 'biometrictoken', 'code', 'codehash', 'pairingcode', 'qrpayload', 'username', 'cookie', 'authorization'];
  return keys.filter((key) => forbidden.includes(key.toLowerCase()));
}

describe('the v2 pipeline rows of dbc-3 §G (CS-20)', () => {
  const tables = [
    ['session_audio_intervals', 720],
    ['recording_fragments', 6_500],
    ['transcript_chunks', 2_000],
    ['transcripts', 400],
    ['transcript_revisions', 30],
    ['sealing_jobs', 3_000],
    ['capture_devices', 12],
    ['capture_device_credentials', 2],
    ['capture_config', 1],
    ['stt_config', 1],
    ['session_capture_sources', 1_600],
  ] as const;

  it('every §G table reaches its minimum in the pure build, not only in the database', () => {
    for (const [table, minimum] of tables) expect(fixture.expectedCounts[table], table).toBeGreaterThanOrEqual(minimum);
    // The fixture's own additions: seven devices (dbc-4 §N.10: three ONVIF cameras, two USB
    // microphones, the local camera and the local microphone), two camera credentials, and the
    // six pipeline tables from nothing.
    expect(fixture.added['capture_devices']).toBe(7);
    expect(fixture.added['capture_device_credentials']).toBe(2);
    for (const [table] of tables.slice(0, 6)) expect(fixture.added[table], table).toBeGreaterThan(0);
  });

  it('intervals: at least one per sealed session; 50 switched with their MANUAL rows; none open without the variant', () => {
    const { sessionAudioIntervals } = fixture.rows;
    const sealed = new Set([
      ...base.slices.sessionHistory.filter((entry) => entry.outcome === 'SEALED').map((entry) => entry.id),
      ...fixture.rows.sessionHistory.filter((row) => row.outcome === 'SEALED').map((row) => row.id),
    ]);
    const perSession = countBy(sessionAudioIntervals, (row) => row.sessionId);
    for (const id of sealed) expect(perSession[id] ?? 0, id).toBeGreaterThanOrEqual(1);
    const manual = sessionAudioIntervals.filter((row) => row.reason === 'MANUAL');
    expect(manual.length).toBeGreaterThanOrEqual(BULK_MIX.sessionAudioIntervals.manualRows);
    expect(manual.every((row) => row.switchedBy !== null)).toBe(true);
    expect(new Set(manual.map((row) => row.sessionId)).size).toBeGreaterThanOrEqual(BULK_MIX.sessionAudioIntervals.switchedSessions);
    expect(sessionAudioIntervals.filter((row) => row.toMediaMs === null)).toEqual([]);
  });

  it('fragments: gaps in no sequence, the chain recomputes, and the head of the 40 newest sits on their tracks', () => {
    const { recordingFragments, evidenceTracks } = fixture.rows;
    expect(recordingFragments.length).toBeGreaterThanOrEqual(minimumOf('recording_fragments'));
    const byTrack = new Map<string, number>();
    for (const row of recordingFragments) {
      const key = `${row.sessionId}|${row.trackId}`;
      expect(row.seq).toBe((byTrack.get(key) ?? 0) + 1);
      byTrack.set(key, row.seq);
    }
    const patched = evidenceTracks.filter((row) => row.fragmentChainHead !== null);
    expect(patched).toHaveLength(BULK_MIX.recordingFragments.fullChainSessions * BULK_MIX.recordingFragments.tracksPerChain);
    expect(patched.every((row) => row.trackId === 'VIDEO-01' || row.trackId === 'VIDEO-02')).toBe(true);
    // sha256_plain stays NULL: the mapping keeps reading these items in their v1 four-track shape
    // until SH-24 regenerates the dataset (decision logged in 67_recon_cs20_pins.md).
    expect(patched.every((row) => row.sha256Plain === null)).toBe(true);
  });

  it('chunks: contiguous audio with the rerun exception; 24 FAILED->rerun pairs; 95 percent DONE', () => {
    const { transcriptChunks } = fixture.rows;
    expect(transcriptChunks.length).toBeGreaterThanOrEqual(minimumOf('transcript_chunks'));
    expect(transcriptChunks.filter((row) => row.status === 'FAILED').length).toBeGreaterThanOrEqual(BULK_MIX.transcriptChunks.failedRerunPairs);
    expect(transcriptChunks.filter((row) => row.status === 'DONE').length / transcriptChunks.length).toBeGreaterThanOrEqual(BULK_MIX.transcriptChunks.doneSegmentsPercent / 100);
    expect(transcriptChunks.filter((row) => row.status === 'DONE').every((row) => Array.isArray(row.segments) && row.computedAt !== null)).toBe(true);
    expect(transcriptChunks.filter((row) => row.status === 'FAILED').every((row) => row.segments === null)).toBe(true);
    // A rerun re-covers the span of the FAILED row it follows; the timeline then continues.
    const reruns = transcriptChunks.filter((row, index) => {
      const previous = transcriptChunks[index - 1];
      return previous !== undefined && previous.sessionId === row.sessionId && previous.status === 'FAILED' && row.audioFromMs === previous.audioFromMs;
    });
    expect(reruns.length).toBeGreaterThanOrEqual(BULK_MIX.transcriptChunks.failedRerunPairs);
  });

  it('transcripts and revisions: one transcript per SEALED, both labels values, chained Ed25519 revisions', () => {
    const { transcripts, transcriptRevisions } = fixture.rows;
    const sealed = new Set([
      ...base.slices.evidence.filter((item) => item.status === 'SEALED').map((item) => item.id),
      ...fixture.rows.evidenceItems.filter((row) => row.status === 'SEALED').map((row) => row.id),
    ]);
    expect(transcripts).toHaveLength(sealed.size);
    expect(new Set(transcripts.map((row) => row.evidenceId))).toEqual(sealed);
    expect(new Set(transcripts.map((row) => row.labelsStatus))).toEqual(new Set(['LABELLED', 'UNAVAILABLE']));
    expect(transcripts.filter((row) => row.labelsStatus === 'UNAVAILABLE').length).toBeGreaterThanOrEqual(BULK_MIX.transcripts.unavailableLabels);
    expect(transcriptRevisions).toHaveLength(minimumOf('transcript_revisions'));
    expect(transcriptRevisions.every((row) => row.signatureAlgorithm === 'Ed25519' && row.signatureSimulated === false && /^[0-9a-f]{128}$/.test(row.signatureValue))).toBe(true);
    const chained = Object.values(countBy(transcriptRevisions, (row) => row.evidenceId)).filter((count) => count >= 2).length;
    expect(chained).toBeGreaterThanOrEqual(BULK_MIX.transcriptRevisions.chainedItems);
    // Every chain starts at the transcript's own hash.
    for (const evidenceId of new Set(transcriptRevisions.map((row) => row.evidenceId))) {
      const transcript = transcripts.find((row) => row.evidenceId === evidenceId);
      expect(transcriptRevisions.find((row) => row.evidenceId === evidenceId && row.revisionNo === 1)?.parentSha256).toBe(transcript?.jsonSha256);
    }
  });

  it('sealing jobs: all six steps DONE for every sealed session; resumed and checkpointed rows; no RUNNING without the variant', () => {
    const { sealingJobs } = fixture.rows;
    expect(sealingJobs.length).toBeGreaterThanOrEqual(minimumOf('sealing_jobs'));
    const sealed = new Set([
      ...base.slices.sessionHistory.filter((entry) => entry.outcome === 'SEALED').map((entry) => entry.id),
      ...fixture.rows.sessionHistory.filter((row) => row.outcome === 'SEALED').map((row) => row.id),
    ]);
    const stepsOf = new Map<string, Set<string>>();
    for (const row of sealingJobs) stepsOf.set(row.sessionId, new Set([...(stepsOf.get(row.sessionId) ?? []), row.step]));
    for (const id of sealed) expect([...FINALIZATION_STEPS_V2].every((step) => stepsOf.get(id)?.has(step)), id).toBe(true);
    expect(sealingJobs.filter((row) => row.attempt >= 2 && row.status === 'DONE').length).toBeGreaterThanOrEqual(BULK_MIX.sealingJobs.resumedAtLeast);
    expect(sealingJobs.filter((row) => row.checkpoint !== null).length).toBeGreaterThanOrEqual(BULK_MIX.sealingJobs.checkpointedAtLeast);
    expect(sealingJobs.filter((row) => row.status === 'RUNNING')).toEqual([]);
  });

  it('the discovered capture rows: seven devices over the five seeded ones, one dual-profile camera, two camera credentials, one rotated', () => {
    const { captureDevices, captureDeviceCredentials } = fixture.rows;
    expect(captureDevices.map((row) => row.id)).toEqual(['CAM-03', 'CAM-04', 'CAM-05', 'CAM-06', 'MIC-03', 'MIC-04', 'MIC-05']);
    expect(captureDevices.filter((row) => Array.isArray(row.profiles) && (row.profiles as readonly string[]).length >= 2)).toHaveLength(1);
    expect(captureDeviceCredentials.map((row) => row.deviceId).sort()).toEqual(['CAM-03', 'CAM-04']);
    expect(captureDeviceCredentials.every((row) => row.secretCiphertext.length >= 33 && row.nonce.length === 12)).toBe(true);
    const rotated = captureDeviceCredentials.map((row) => row.rotatedAt).sort((a, b) => a - b);
    expect(rotated[1]).toBeGreaterThan(rotated[0] ?? 0);
  });

  it('the variant adds exactly the two §G variant rows', () => {
    const variant = buildBulkFixture({ now: FIXED_NOW, activeSession: true }, base);
    expect(variant.rows.sessionAudioIntervals.filter((row) => row.toMediaMs === null)).toHaveLength(1);
    expect(variant.rows.sealingJobs.filter((row) => row.status === 'RUNNING')).toHaveLength(1);
    expect(compareWithMinimums(variant.expectedCounts).filter((entry) => !entry.met)).toEqual([]);
  });
});

describe('what the builder refuses', () => {
  it('a clock before the seed instant', () => {
    expect(() => buildBulkFixture({ now: FIXED_NOW - 1 }, base)).toThrow(BulkFixtureError);
    expect(() => buildBulkFixture({ now: FIXED_NOW - 1 }, base)).toThrow(/OPTION_INVALID/);
    expect(() => buildBulkFixture({ now: Number.NaN }, base)).toThrow(/OPTION_INVALID/);
    expect(() => buildBulkFixture({ now: FIXED_NOW, seed: 1.5 }, base)).toThrow(/OPTION_INVALID/);
  });

  it('a base that already holds the fixture, or rows in a table the seed leaves empty', () => {
    const loaded = { ...base, slices: { ...base.slices, operators: [...base.slices.operators, { ...OPERATORS[0], id: 'OPR-004', username: 'fixture.operator.004' }] } };
    expect(() => buildBulkFixture({ now: FIXED_NOW }, loaded as typeof base)).toThrow(/BASE_UNEXPECTED/);
    expect(() => buildBulkFixture({ now: FIXED_NOW }, { ...base, counts: { ...base.counts, auth_sessions: 1 } })).toThrow(/BASE_UNEXPECTED.*auth_sessions/);
  });
});

describe('the variant: one session in RECORDING with a full timeline', () => {
  it('adds one active session with 200 timeline items, the next free session number, and its audit rows', () => {
    const variant = buildBulkFixture({ now: FIXED_NOW, activeSession: true }, base);
    expect(variant.activeSession).toBe(true);
    expect(variant.rows.activeSession).toHaveLength(1);
    const session = variant.rows.activeSession[0];
    expect(session?.state).toBe('RECORDING');
    expect(session?.timeline).toHaveLength(BULK_MIX.activeSessionVariant.timelineItems);
    expect(new Set(session?.timeline.map((item) => item.id)).size).toBe(200);
    expect(session?.timeline.every((item, index, all) => index === 0 || item.at >= (all[index - 1]?.at ?? 0))).toBe(true);
    expect(session?.markerCount).toBe(session?.timeline.filter((item) => item.kind === 'MARKER').length);
    expect(session?.notes).toHaveLength(session?.timeline.filter((item) => item.kind === 'NOTE').length ?? -1);
    const known = new Set([...base.slices.sessionHistory.map((entry) => entry.id), ...variant.rows.sessionHistory.map((row) => row.id)]);
    expect(known.has(session?.id ?? '')).toBe(false);
    expect(variant.rows.auditLog.filter((row) => row.sessionId === session?.id).map((row) => row.type)).toEqual(expect.arrayContaining(['SESSION_CREATED', 'PRECHECK_PASSED', 'RECORDING_STARTED']));
    expect(compareWithMinimums(variant.expectedCounts).filter((entry) => !entry.met)).toEqual([]);
    expect(variant.digest).not.toBe(fixture.digest);
    // The plain fixture has none.
    expect(fixture.rows.activeSession).toEqual([]);
  });
});

describe('the constraint guard in front of the database', () => {
  const invalid = (change: (rows: BulkFixture['rows']) => Partial<BulkFixture['rows']>): string => {
    try {
      validateBulkFixture({ ...fixture.rows, ...change(fixture.rows) }, fixture.updates, base, FIXED_NOW);
    } catch (error) {
      expect(error).toBeInstanceOf(BulkFixtureError);
      return (error as BulkFixtureError).message;
    }
    return 'passed';
  };
  const first = <T>(rows: readonly T[], change: (row: T) => T): T[] => rows.map((row, index) => (index === 0 ? change(row) : row));

  it('passes the fixture as built', () => {
    expect(invalid(() => ({}))).toBe('passed');
  });

  it.each<[string, (rows: BulkFixture['rows']) => Partial<BulkFixture['rows']>, RegExp]>([
    ['a token hash of the wrong length', (rows) => ({ authSessions: first(rows.authSessions, (row) => ({ ...row, tokenHash: Buffer.alloc(31) })) }), /auth_sessions: auth_sessions_token_hash_check/],
    ['a token hash twice', (rows) => ({ authSessions: first(rows.authSessions, (row) => ({ ...row, tokenHash: rows.authSessions[1]?.tokenHash ?? row.tokenHash })) }), /auth_sessions_token_hash_key/],
    ['a session that ends before it was issued', (rows) => ({ authSessions: first(rows.authSessions, (row) => ({ ...row, endedAt: row.issuedAt - 1, endReason: 'SIGNED_OUT' as const })) }), /auth_sessions_times_check/],
    ['a biometric session without a device', (rows) => ({ authSessions: first(rows.authSessions, (row) => ({ ...row, method: 'BIOMETRIC' as const, deviceId: null })) }), /auth_sessions_biometric_device_check/],
    ['two active pairing codes', (rows) => ({ pairingCodes: first(rows.pairingCodes, (row) => ({ ...row, state: 'ACTIVE' as const, closedAt: null })) }), /pairing_codes_one_active_key/],
    ['a revoked device without a reason', (rows) => ({ pairedDevices: rows.pairedDevices.map((row) => (row.state === 'REVOKED' ? { ...row, revokeReason: null } : row)) }), /paired_devices_lifecycle_check/],
    ['an audit row that does not link', (rows) => ({ auditLog: rows.auditLog.map((row, index) => (index === 10 ? { ...row, prevHash: '0'.repeat(64) } : row)) }), /audit_log: a row does not link to its predecessor/],
    ['an audit row whose digest is wrong', (rows) => ({ auditLog: rows.auditLog.map((row, index) => (index === 10 ? { ...row, message: 'changed' } : row)) }), /audit_log: the chain of the fixture does not verify/],
    ['a secret key name in a payload', (rows) => ({ auditLog: first(rows.auditLog, (row) => ({ ...row, details: { ...row.details, token: 'x' } })) }), /audit_log: details holds a key that may name a secret/],
    ['a nested payload', (rows) => ({ events: first(rows.events, (row) => ({ ...row, params: { nested: {} } as never })) }), /events: params is not flat/],
    ['an instant after the clock', (rows) => ({ alerts: first(rows.alerts, (row) => ({ ...row, at: FIXED_NOW + 1 })) }), /alerts: at lies after the clock of the fixture/],
    ['a text with U+0000', (rows) => ({ sessionHistory: first(rows.sessionHistory, (row) => ({ ...row, subjectName: 'a\u0000b' })) }), /session_history: a text holds U\+0000 or a lone surrogate/],
    ['a lone surrogate', (rows) => ({ operators: first(rows.operators, (row) => ({ ...row, name: 'a\ud83db' })) }), /operators: a text holds U\+0000 or a lone surrogate/],
    ['an item with three tracks', (rows) => ({ evidenceTracks: rows.evidenceTracks.slice(1) }), /evidence_tracks: an item does not have exactly four tracks/],
    ['an active alert of a fault kind', (rows) => ({ alerts: first(rows.alerts, (row) => ({ ...row, active: true, resolvedAt: null })) }), /alerts: an alert of a fault kind is active/],
    ['a lineage row with a gap', (rows) => ({ auditChainHistory: rows.auditChainHistory.slice(1) }), /audit_chain_history: reset_no does not run from 1 without a gap/],
    ['an export without its evidence item', (rows) => ({ exportRecords: first(rows.exportRecords, (row) => ({ ...row, scope: 'EVIDENCE' as const, evidenceId: 'EV-20200101-9999' })) }), /exports: exports_evidence_id_fkey/],
    ['an operator that does not exist', (rows) => ({ sessionHistory: first(rows.sessionHistory, (row) => ({ ...row, investigatorId: 'OPR-999' })) }), /session_history: names an operator that does not exist/],
    ['a fragment sequence with a gap', (rows) => ({ recordingFragments: rows.recordingFragments.filter((row, index) => !(row.trackId === rows.recordingFragments[1]?.trackId && index === 20)) }), /recording_fragments: seq does not run from 1 without a gap/],
    ['a fragment chain that does not recompute', (rows) => ({ recordingFragments: first(rows.recordingFragments, (row) => ({ ...row, chainHash: 'f'.repeat(64) })) }), /recording_fragments: the chain hash does not recompute/],
    ['a transcript on an item that is not SEALED', (rows) => {
      const index = rows.evidenceItems.findIndex((row) => row.status === 'SEALED');
      return { evidenceItems: rows.evidenceItems.map((row, position) => (position === index ? { ...row, status: 'UNDER_REVIEW' as never } : row)) };
    }, /transcripts: a transcript hangs on an item that is not SEALED/],
    ['a revision that breaks its parent link', (rows) => ({ transcriptRevisions: first(rows.transcriptRevisions, (row) => ({ ...row, parentSha256: 'a'.repeat(64) })) }), /transcript_revisions: parent_sha256 does not link/],
    ['a revision signed in the simulated form', (rows) => ({ transcriptRevisions: first(rows.transcriptRevisions, (row) => ({ ...row, signatureAlgorithm: 'SIMULATED-SHA256' as never, signatureSimulated: true, signatureValue: row.signatureValue.slice(0, 64) })) }), /transcript_revisions: the §G revisions sign in the Ed25519 form/],
    ['a sealed session missing its finalization steps', (rows) => ({ sealingJobs: rows.sealingJobs.filter((row) => row.step !== FINALIZATION_STEPS_V2[0]) }), /sealing_jobs: the sealed session .* does not carry every finalization step/],
    ['a sealed session whose step is not DONE', (rows) => ({ sealingJobs: first(rows.sealingJobs, (row) => ({ ...row, status: 'FAILED' as never, errorCode: 'FIXTURE_STEP_FAILED' })) }), /sealing_jobs: a step of a sealed session is not DONE/],
    ['an interval with an unknown microphone', (rows) => ({ sessionAudioIntervals: first(rows.sessionAudioIntervals, (row) => ({ ...row, micDeviceId: 'MIC-99' })) }), /session_audio_intervals: session_audio_intervals_mic_device_id_fkey/],
    ['a credential on a built-in camera', (rows) => ({ captureDeviceCredentials: first(rows.captureDeviceCredentials, (row) => ({ ...row, deviceId: 'CAM-01' })) }), /capture_device_credentials: capture_device_credentials_device_id_fkey/],
    ['a chunk whose rerun breaks the audio line', (rows) => ({ transcriptChunks: first(rows.transcriptChunks, (row) => ({ ...row, audioToMs: row.audioToMs + 1 })) }), /transcript_chunks: the audio ranges are not contiguous/],
  ])('refuses %s, naming the table and the rule and no value', (_label, change, expected) => {
    const message = invalid(change);
    expect(message).toMatch(/^BUILD_INVALID: /);
    expect(message).toMatch(expected);
    // The message is the code, a table and a rule: no hash, no identifier of a row.
    expect(message).not.toMatch(/[0-9a-f]{32}|OPR-999|EV-2020/);
  });
});
