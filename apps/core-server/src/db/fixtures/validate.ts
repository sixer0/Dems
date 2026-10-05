/**
 * The constraints of the schema, checked on the fixture's rows BEFORE a statement is sent (plan
 * row W25; database contract §4; finding F-1 of the migration row).
 *
 * Why before: a CHECK or NOT NULL violation makes PostgreSQL write the whole failing row into
 * its log, hash columns included. A fixture row must never get that far. This file states, in
 * plain TypeScript, the CHECK, UNIQUE and FOREIGN KEY rules of the tables the fixture writes, and
 * the rules of the contract's §11 that no constraint states (a counter above the highest minted
 * number, nothing dated after the clock, a chain that verifies). The database remains the
 * judge: the load itself proves the constraints; this is the guard in front of it.
 *
 * A failure is a `BulkFixtureError` with the code `BUILD_INVALID`. Its message names the table
 * and the rule, never a value of a row.
 */
import { GENESIS_HASH, verifyAuditChain } from '@dems/shared/sim';
import { auditRowFromRow, isStorableText } from '../mapping';
import {
  AUDIT_CATEGORY,
  AUDIT_DETAIL_FORBIDDEN_KEYS,
  BIO_REVOKE_REASON,
  CHAIN_DISCARD_REASON,
  CODE_STATE,
  DEVICE_STATE,
  EVENT_CATEGORY,
  EVIDENCE_STATUS,
  FAULT_KIND,
  LIFECYCLE_STAGE,
  ROLE,
  SCENARIO,
  SESSION_END_REASON,
  SESSION_OUTCOME,
  SEVERITY,
  SNAPSHOT_CAUSE,
  SUBJECT_TYPE,
  TRACK_ID,
  VERIFICATION,
} from '../schema';
import { FIXTURE_TABLES, type BulkFixtureRows, type BulkFixtureUpdates } from './rows';
import { BulkFixtureError } from './target';
import type { BulkBase } from './world';

const HEX64 = /^[0-9a-f]{64}$/;
const CODE = /^[A-Z][A-Z0-9_]{0,63}$/;
const SESSION_ID = /^SES-[0-9]{8}-[0-9]{4}$/;
const EVIDENCE_ID = /^EV-[0-9]{8}-[0-9]{4}$/;
const OPERATOR_ID = /^OPR-[0-9]{3}$/;
const EXPORT_ID = /^EXP-[0-9]{6}$/;
const CASE_NUMBER = /^LP\/[0-9]{4}\/[0-9]{4}-[0-9]{4}$/;
const USERNAME = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const DEVICE_ID = /^DEV-[0-9]{4,}$/;
const CODE_ID = /^PCD-[0-9]{6,}$/;
const ALERT_ID = /^ALR-[0-9]{6,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(AUDIT_DETAIL_FORBIDDEN_KEYS);

/** Columns that hold an instant which may lie after the clock: the end of a lifetime. */
const FUTURE_INSTANTS: ReadonlySet<string> = new Set(['expiresAt', 'absoluteExpiresAt']);

function fail(table: string, rule: string): never {
  throw new BulkFixtureError('BUILD_INVALID', `${table}: ${rule}`);
}

function must(condition: boolean, table: string, rule: string): void {
  if (!condition) fail(table, rule);
}

/** The number of characters as PostgreSQL's `char_length` counts them: code points. */
const length = (text: string): number => [...text].length;
const isIn = (set: readonly string[], value: unknown): boolean => typeof value === 'string' && set.includes(value);
const hash32 = (value: unknown): boolean => Buffer.isBuffer(value) && value.length === 32;

function unique(values: readonly string[], table: string, rule: string): void {
  must(new Set(values).size === values.length, table, rule);
}

/** A payload map: flat values, no key that may name a secret. */
function flatMap(value: unknown, table: string, column: string): void {
  must(typeof value === 'object' && value !== null && !Array.isArray(value), table, `${column} is not a JSON object`);
  for (const [key, member] of Object.entries(value as Record<string, unknown>)) {
    must(!FORBIDDEN_KEYS.has(key), table, `${column} holds a key that may name a secret`);
    must(member === null || ['string', 'number', 'boolean'].includes(typeof member), table, `${column} is not flat`);
    must(typeof member !== 'number' || Number.isFinite(member), table, `${column} holds a number that is not finite`);
  }
}

/** Every text can be stored exactly, every integer is safe, and no instant lies after the clock. */
function walk(value: unknown, table: string, now: number, key = ''): void {
  if (typeof value === 'string') return must(isStorableText(value), table, 'a text holds U+0000 or a lone surrogate');
  if (typeof value === 'number') {
    must(Number.isFinite(value), table, 'a number is not finite');
    const instant = key === 'at' || key.endsWith('At');
    if (instant) {
      must(Number.isSafeInteger(value) && value > 0, table, `${key} is not a positive whole number of milliseconds`);
      must(FUTURE_INSTANTS.has(key) || value <= now, table, `${key} lies after the clock of the fixture`);
    }
    return;
  }
  if (value === null || typeof value !== 'object' || Buffer.isBuffer(value)) return;
  if (Array.isArray(value)) return value.forEach((item) => walk(item, table, now, key));
  for (const [name, member] of Object.entries(value)) walk(member, table, now, name);
}

export function validateBulkFixture(rows: BulkFixtureRows, updates: BulkFixtureUpdates, base: BulkBase, now: number): void {
  for (const key of Object.keys(FIXTURE_TABLES) as (keyof BulkFixtureRows)[]) walk(rows[key], FIXTURE_TABLES[key], now);

  // ── operators, operator_credentials ──────────────────────────────────────────────────────────
  const baseOperators = base.slices.operators;
  const operatorIds = new Set([...baseOperators.map((operator) => operator.id), ...rows.operators.map((operator) => operator.id)]);
  const operator = (id: string | null, table: string): void => must(id === null || operatorIds.has(id), table, 'names an operator that does not exist');
  unique([...baseOperators.map((entry) => entry.id), ...rows.operators.map((entry) => entry.id)], 'operators', 'an identifier occurs twice');
  unique([...baseOperators.map((entry) => entry.username), ...rows.operators.map((entry) => entry.username)], 'operators', 'a username occurs twice');
  for (const row of rows.operators) {
    must(OPERATOR_ID.test(row.id), 'operators', 'operators_id_check');
    must(USERNAME.test(row.username), 'operators', 'operators_username_check');
    must(length(row.name) >= 1 && length(row.name) <= 120 && length(row.initials) >= 1 && length(row.initials) <= 4, 'operators', 'operators_name_check');
    must(isIn(ROLE, row.roleId), 'operators', 'operators_role_id_fkey');
  }
  must(rows.operatorCredentials.length === rows.operators.length, 'operator_credentials', 'not one row per fixture operator');
  for (const row of rows.operatorCredentials) {
    must(rows.operators.some((entry) => entry.id === row.operatorId), 'operator_credentials', 'operator_credentials_operator_id_fkey');
    must(row.algorithm === 'argon2id', 'operator_credentials', 'operator_credentials_algorithm_check');
    must(row.memoryKib >= 19_456 && row.passes >= 2 && row.parallelism >= 1, 'operator_credentials', 'operator_credentials_params_check');
    must(Buffer.isBuffer(row.salt) && row.salt.length >= 16 && hash32(row.hash), 'operator_credentials', 'operator_credentials_lengths_check');
  }
  for (const entry of updates.operatorSignIns) must(baseOperators.some((candidate) => candidate.id === entry.id), 'operators', 'a sign-in names an operator the seed does not hold');

  // ── pairing_codes, paired_devices, device_credentials ────────────────────────────────────────
  unique(rows.pairingCodes.map((row) => row.id), 'pairing_codes', 'pairing_codes_pkey');
  must(rows.pairingCodes.filter((row) => row.state === 'ACTIVE').length <= 1, 'pairing_codes', 'pairing_codes_one_active_key');
  for (const row of rows.pairingCodes) {
    must(CODE_ID.test(row.id), 'pairing_codes', 'pairing_codes_id_check');
    must(hash32(row.codeHash), 'pairing_codes', 'pairing_codes_code_hash_check');
    must(isIn(CODE_STATE, row.state), 'pairing_codes', 'pairing_codes_state_check');
    must(row.expiresAt > row.issuedAt && (row.closedAt === null || row.closedAt >= row.issuedAt), 'pairing_codes', 'pairing_codes_times_check');
    must(row.failedAttempts >= 0 && row.failedAttempts <= 5, 'pairing_codes', 'pairing_codes_attempts_check');
    must((row.state === 'ACTIVE') === (row.closedAt === null) && (row.closedByOperatorId === null || row.state === 'CANCELLED'), 'pairing_codes', 'pairing_codes_closed_check');
    operator(row.issuedByOperatorId, 'pairing_codes');
    operator(row.closedByOperatorId, 'pairing_codes');
  }
  const codeIds = new Set(rows.pairingCodes.map((row) => row.id));
  const deviceIds = new Set(rows.pairedDevices.map((row) => row.id));
  unique(rows.pairedDevices.map((row) => row.id), 'paired_devices', 'paired_devices_pkey');
  unique(rows.pairedDevices.map((row) => row.pairedWithCodeId), 'paired_devices', 'paired_devices_paired_with_code_id_key');
  for (const row of rows.pairedDevices) {
    must(DEVICE_ID.test(row.id), 'paired_devices', 'paired_devices_id_check');
    must([row.name, row.platform, row.appVersion].every((text, index) => length(text) >= 1 && length(text) <= (index === 0 ? 60 : 32)), 'paired_devices', 'paired_devices_text_check');
    must(isIn(DEVICE_STATE, row.state), 'paired_devices', 'paired_devices_state_check');
    must(codeIds.has(row.pairedWithCodeId), 'paired_devices', 'paired_devices_paired_with_code_id_fkey');
    const none = row.revokedAt === null && row.revokedByOperatorId === null && row.revokeReason === null;
    const lifecycle =
      (row.state === 'PAIRED' && none && row.unpairedAt === null) ||
      (row.state === 'REVOKED' &&
        row.revokedAt !== null &&
        row.revokedByOperatorId !== null &&
        row.revokeReason !== null &&
        length(row.revokeReason) >= 5 &&
        length(row.revokeReason) <= 500 &&
        row.unpairedAt === null) ||
      (row.state === 'UNPAIRED' && row.unpairedAt !== null && none);
    must(lifecycle, 'paired_devices', 'paired_devices_lifecycle_check');
    operator(row.revokedByOperatorId, 'paired_devices');
  }
  must(rows.deviceCredentials.length === rows.pairedDevices.length, 'device_credentials', 'not one row per device');
  unique(rows.deviceCredentials.map((row) => row.deviceId), 'device_credentials', 'device_credentials_pkey');
  unique(rows.deviceCredentials.map((row) => row.currentHash.toString('hex')), 'device_credentials', 'device_credentials_current_hash_key');
  unique(rows.deviceCredentials.flatMap((row) => (row.nextHash === null ? [] : [row.nextHash.toString('hex')])), 'device_credentials', 'device_credentials_next_hash_key');
  for (const row of rows.deviceCredentials) {
    must(deviceIds.has(row.deviceId), 'device_credentials', 'device_credentials_device_id_fkey');
    must(hash32(row.currentHash) && (row.nextHash === null || (hash32(row.nextHash) && !row.nextHash.equals(row.currentHash))), 'device_credentials', 'device_credentials_lengths_check');
  }

  // ── auth_sessions, biometric_tokens ──────────────────────────────────────────────────────────
  unique(rows.authSessions.map((row) => row.id), 'auth_sessions', 'auth_sessions_pkey');
  unique(rows.authSessions.map((row) => row.tokenHash.toString('hex')), 'auth_sessions', 'auth_sessions_token_hash_key');
  for (const row of rows.authSessions) {
    must(UUID.test(row.id), 'auth_sessions', 'the identifier is not a UUID');
    must(hash32(row.tokenHash), 'auth_sessions', 'auth_sessions_token_hash_check');
    must(row.method === 'PASSWORD' || row.method === 'BIOMETRIC', 'auth_sessions', 'auth_sessions_method_check');
    must(row.method !== 'BIOMETRIC' || row.deviceId !== null, 'auth_sessions', 'auth_sessions_biometric_device_check');
    must(
      row.lastSeenAt >= row.issuedAt && row.absoluteExpiresAt > row.issuedAt && (row.endedAt === null || row.endedAt >= row.issuedAt),
      'auth_sessions',
      'auth_sessions_times_check',
    );
    must((row.endedAt === null) === (row.endReason === null), 'auth_sessions', 'auth_sessions_end_check');
    must(row.endReason === null || isIn(SESSION_END_REASON, row.endReason), 'auth_sessions', 'auth_sessions_end_reason_check');
    must(row.endReason !== 'TOKEN_REUSE' || row.method === 'BIOMETRIC', 'auth_sessions', 'auth_sessions_token_reuse_check');
    must(row.deviceId === null || deviceIds.has(row.deviceId), 'auth_sessions', 'auth_sessions_device_id_fkey');
    operator(row.operatorId, 'auth_sessions');
  }
  unique(rows.biometricTokens.map((row) => row.id), 'biometric_tokens', 'biometric_tokens_pkey');
  unique(rows.biometricTokens.map((row) => row.tokenHash.toString('hex')), 'biometric_tokens', 'biometric_tokens_token_hash_key');
  unique(
    rows.biometricTokens.filter((row) => row.usedAt === null && row.revokedAt === null).map((row) => `${row.deviceId}|${row.operatorId}`),
    'biometric_tokens',
    'biometric_tokens_one_live_key',
  );
  for (const row of rows.biometricTokens) {
    must(UUID.test(row.id) && UUID.test(row.familyId), 'biometric_tokens', 'an identifier is not a UUID');
    must(hash32(row.tokenHash), 'biometric_tokens', 'biometric_tokens_token_hash_check');
    must(row.expiresAt > row.issuedAt && (row.usedAt === null || row.usedAt >= row.issuedAt), 'biometric_tokens', 'biometric_tokens_times_check');
    must(
      (row.revokedAt === null) === (row.revokeReason === null) && (row.revokeReason === null || isIn(BIO_REVOKE_REASON, row.revokeReason)),
      'biometric_tokens',
      'biometric_tokens_revoke_check',
    );
    must(deviceIds.has(row.deviceId), 'biometric_tokens', 'biometric_tokens_device_id_fkey');
    operator(row.operatorId, 'biometric_tokens');
  }

  // ── session_history, evidence_items, evidence_tracks, evidence_custody, exports ──────────────
  const sessionIds = [...base.slices.sessionHistory.map((entry) => entry.id), ...rows.sessionHistory.map((row) => row.id)];
  unique(sessionIds, 'session_history', 'session_history_pkey');
  for (const row of rows.sessionHistory) {
    must(SESSION_ID.test(row.id) && CASE_NUMBER.test(row.caseNumber), 'session_history', 'session_history_id_check');
    must(
      isIn(SESSION_OUTCOME, row.outcome) && (row.faultKind === null || (row.outcome === 'INCOMPLETE' && isIn(FAULT_KIND, row.faultKind))),
      'session_history',
      'session_history_outcome_check',
    );
    must(isIn(SUBJECT_TYPE, row.subjectType) && row.profileId === 'STANDARD_1080P25', 'session_history', 'session_history_input_check');
    must(row.durationMs >= 0 && row.sizeBytes >= 0 && row.endedAt >= row.createdAt, 'session_history', 'session_history_values_check');
    operator(row.investigatorId, 'session_history');
  }
  const evidenceIds = [...base.slices.evidence.map((item) => item.id), ...rows.evidenceItems.map((row) => row.id)];
  unique(evidenceIds, 'evidence_items', 'evidence_items_pkey');
  unique([...base.slices.evidence.map((item) => item.sessionId), ...rows.evidenceItems.map((row) => row.sessionId)], 'evidence_items', 'evidence_items_session_id_key');
  const knownSessions = new Set(sessionIds);
  for (const row of rows.evidenceItems) {
    must(EVIDENCE_ID.test(row.id) && CASE_NUMBER.test(row.caseNumber), 'evidence_items', 'evidence_items_id_check');
    must(knownSessions.has(row.sessionId), 'evidence_items', 'evidence_items_session_id_fkey');
    must(isIn(EVIDENCE_STATUS, row.status) && isIn(LIFECYCLE_STAGE, row.lifecycleStage), 'evidence_items', 'evidence_items_status_check');
    must(
      isIn(SUBJECT_TYPE, row.subjectType) && row.profileId === 'STANDARD_1080P25' && (row.caseType === null || isIn(SUBJECT_TYPE, row.caseType)),
      'evidence_items',
      'evidence_items_input_check',
    );
    must(HEX64.test(row.manifestHash) && HEX64.test(row.signatureValue), 'evidence_items', 'evidence_items_hashes_check');
    must(row.signatureAlgorithm === 'SIMULATED-SHA256' && row.signatureSimulated === true, 'evidence_items', 'evidence_items_signature_check');
    must(
      isIn(VERIFICATION, row.verificationStatus) && (row.verificationStatus === 'NOT_RUN') === (row.verificationAt === null),
      'evidence_items',
      'evidence_items_verification_check',
    );
    must(row.tamperedTrackId === null || isIn(TRACK_ID, row.tamperedTrackId), 'evidence_items', 'evidence_items_tamper_check');
    must(
      row.durationMs >= 0 && row.sizeBytes >= 0 && row.endedAt >= row.recordedAt && (row.sealedAt === null || row.sealedAt >= row.endedAt),
      'evidence_items',
      'evidence_items_values_check',
    );
    must(Array.isArray(row.markers) && Array.isArray(row.notes), 'evidence_items', 'evidence_items_json_check');
    operator(row.investigatorId, 'evidence_items');
  }
  const fixtureEvidence = new Set(rows.evidenceItems.map((row) => row.id));
  const tracksOf = new Map<string, number[]>();
  for (const row of rows.evidenceTracks) {
    must(fixtureEvidence.has(row.evidenceId), 'evidence_tracks', 'evidence_tracks_evidence_id_fkey');
    must(isIn(TRACK_ID, row.trackId) && row.position >= 1 && row.position <= 4, 'evidence_tracks', 'evidence_tracks_track_check');
    must(row.sizeBytes >= 0 && HEX64.test(row.sha256), 'evidence_tracks', 'evidence_tracks_values_check');
    tracksOf.set(row.evidenceId, [...(tracksOf.get(row.evidenceId) ?? []), row.position]);
  }
  for (const id of fixtureEvidence) {
    must((tracksOf.get(id) ?? []).sort().join(',') === '1,2,3,4', 'evidence_tracks', 'an item does not have exactly four tracks at positions 1 to 4');
  }
  unique(rows.evidenceTracks.map((row) => `${row.evidenceId}|${row.trackId}`), 'evidence_tracks', 'evidence_tracks_pkey');
  const custodyOf = new Map<string, number>();
  for (const row of rows.evidenceCustody) {
    must(fixtureEvidence.has(row.evidenceId), 'evidence_custody', 'evidence_custody_evidence_id_fkey');
    must(row.seq === (custodyOf.get(row.evidenceId) ?? 0) + 1 && CODE.test(row.action), 'evidence_custody', 'evidence_custody_values_check');
    custodyOf.set(row.evidenceId, row.seq);
    operator(row.actorId, 'evidence_custody');
  }
  for (const id of fixtureEvidence) must((custodyOf.get(id) ?? 0) >= 2, 'evidence_custody', 'an item has fewer than two custody entries');
  const knownEvidence = new Set(evidenceIds);
  unique(rows.exportRecords.map((row) => row.id), 'exports', 'exports_pkey');
  for (const row of rows.exportRecords) {
    must(EXPORT_ID.test(row.id), 'exports', 'exports_id_check');
    must(['EVIDENCE', 'AUDIT', 'LOGS'].includes(row.scope) && (row.scope === 'EVIDENCE') === (row.evidenceId !== null), 'exports', 'exports_scope_check');
    must(length(row.reason.trim()) >= 5 && length(row.destination) >= 1 && length(row.destination) <= 120, 'exports', 'exports_text_check');
    must(row.evidenceId === null || knownEvidence.has(row.evidenceId), 'exports', 'exports_evidence_id_fkey');
    operator(row.operatorId, 'exports');
  }

  // ── active_session, alerts, health_snapshots ─────────────────────────────────────────────────
  must(rows.activeSession.length <= 1, 'active_session', 'active_session_pkey');
  for (const row of rows.activeSession) {
    must(SESSION_ID.test(row.id) && CASE_NUMBER.test(row.caseNumber) && !knownSessions.has(row.id), 'active_session', 'active_session_id_check');
    must(Array.isArray(row.timeline) && row.timeline.length <= 200 && Array.isArray(row.notes), 'active_session', 'active_session_json_check');
    must(row.markerCount >= 0 && row.snapshotCount >= 0 && row.bytesWritten >= 0, 'active_session', 'active_session_counts_check');
    operator(row.investigatorId, 'active_session');
    operator(row.createdBy, 'active_session');
  }
  unique(rows.alerts.map((row) => row.id), 'alerts', 'alerts_pkey');
  for (const row of rows.alerts) {
    must(ALERT_ID.test(row.id), 'alerts', 'alerts_id_check');
    must(isIn(SEVERITY, row.severity) && (row.kind === 'SYSTEM' || isIn(FAULT_KIND, row.kind)), 'alerts', 'alerts_kind_check');
    if (row.params !== null) flatMap(row.params, 'alerts', 'params');
    // An alert of a fault kind is resolved: the seeded hardware snapshot holds no active fault.
    must(row.kind === 'SYSTEM' || (!row.active && row.resolvedAt !== null), 'alerts', 'an alert of a fault kind is active, but the seeded snapshot has no active fault');
  }
  unique(rows.healthSnapshots.map((row) => row.id), 'health_snapshots', 'health_snapshots_pkey');
  for (const row of rows.healthSnapshots) {
    must(
      isIn(SNAPSHOT_CAUSE, row.cause) && (row.cause === 'INTERVAL') === (row.faultKind === null) && (row.faultKind === null || isIn(FAULT_KIND, row.faultKind)),
      'health_snapshots',
      'health_snapshots_cause_check',
    );
    must(
      ['READY', 'LOW', 'FULL'].includes(row.storageState) &&
        ['GNSS', 'NTP', 'RTC'].includes(row.timeSource) &&
        ['READY', 'FAULT'].includes(row.securityState) &&
        row.activeFaults >= 0 &&
        Number.isInteger(row.fanRpm),
      'health_snapshots',
      'health_snapshots_states_check',
    );
  }

  // ── audit_chain_history ──────────────────────────────────────────────────────────────────────
  unique(rows.auditChainHistory.map((row) => String(row.epoch)), 'audit_chain_history', 'audit_chain_history_epoch_key');
  rows.auditChainHistory.forEach((row, index) => {
    const previous = rows.auditChainHistory[index - 1];
    must(row.resetNo === index + 1, 'audit_chain_history', 'reset_no does not run from 1 without a gap');
    must(previous === undefined || (row.epoch > previous.epoch && row.resetAt >= previous.resetAt), 'audit_chain_history', 'epoch or reset_at does not rise with reset_no');
    must(row.resetNo >= 1 && row.epoch >= 0, 'audit_chain_history', 'audit_chain_history_numbers_check');
    must(HEX64.test(row.headHash), 'audit_chain_history', 'audit_chain_history_head_hash_check');
    must(row.rowCount >= 1 && row.firstSeq >= 1 && row.lastSeq >= row.firstSeq, 'audit_chain_history', 'audit_chain_history_values_check');
    must(isIn(CHAIN_DISCARD_REASON, row.reason) && isIn(SCENARIO, row.scenario), 'audit_chain_history', 'audit_chain_history_reason_check');
    operator(row.actorId, 'audit_chain_history');
  });
  const newestLineage = rows.auditChainHistory[rows.auditChainHistory.length - 1];
  if (newestLineage !== undefined) {
    must(updates.coreState !== null && updates.coreState.epoch > newestLineage.epoch, 'core_state', 'the epoch is not above the highest lineage epoch');
    const agreeing = rows.auditLog.filter((row) => row.type === 'SCENARIO_LOADED' && row.details['previousHead'] === newestLineage.headHash);
    must(agreeing.length === 1 && agreeing[0]?.details['previousRows'] === newestLineage.rowCount, 'audit_chain_history', 'the newest row does not agree with exactly one SCENARIO_LOADED row (LN-3)');
  }

  // ── audit_log: the rules of the table, and the chain itself ──────────────────────────────────
  const { head, total } = base.slices.audit;
  rows.auditLog.forEach((row, index) => {
    const previous = rows.auditLog[index - 1];
    must(row.seq === total + index + 1, 'audit_log', 'the sequence does not continue the head without a gap');
    must(row.id === `AUD-${String(row.seq).padStart(6, '0')}`, 'audit_log', 'audit_log_id_check');
    must(CODE.test(row.type), 'audit_log', 'audit_log_type_check');
    must(isIn(AUDIT_CATEGORY, row.category), 'audit_log', 'audit_log_category_check');
    must(isIn(SEVERITY, row.severity), 'audit_log', 'audit_log_severity_check');
    must(HEX64.test(row.prevHash) && HEX64.test(row.hash) && row.prevHash !== row.hash, 'audit_log', 'audit_log_hashes_check');
    must(row.prevHash === (previous?.hash ?? head), 'audit_log', 'a row does not link to its predecessor');
    flatMap(row.details, 'audit_log', 'details');
    operator(row.actorId, 'audit_log');
  });
  unique(rows.auditLog.map((row) => row.hash), 'audit_log', 'audit_log_hash_key');
  const newestAudit = rows.auditLog[rows.auditLog.length - 1];
  if (newestAudit !== undefined) {
    // The digests, with the shared check: the base's head anchors the first fixture row.
    const verdict = verifyAuditChain({ rows: rows.auditLog.map(auditRowFromRow), head: newestAudit.hash, total: newestAudit.seq, dropped: total });
    must(verdict.ok, 'audit_log', 'the chain of the fixture does not verify');
    must(total > 0 || rows.auditLog[0]?.prevHash === GENESIS_HASH, 'audit_log', 'the first row of an empty log does not link to the genesis hash');
  }

  // ── events ───────────────────────────────────────────────────────────────────────────────────
  const firstEvent = base.slices.meta.counters.event;
  rows.events.forEach((row, index) => {
    must(row.seq === firstEvent + index, 'events', 'the sequence does not continue the event counter without a gap');
    must(row.id === `LOG-${String(row.seq).padStart(6, '0')}`, 'events', 'events_id_check');
    must(CODE.test(row.type), 'events', 'events_type_check');
    must(isIn(EVENT_CATEGORY, row.category), 'events', 'events_category_check');
    must(isIn(SEVERITY, row.severity), 'events', 'events_severity_check');
    flatMap(row.params, 'events', 'params');
  });

  // ── counters: above the highest minted number ────────────────────────────────────────────────
  const counter = (name: string): number => updates.engineCounters.find((row) => row.name === name)?.nextValue ?? 0;
  const suffix = (id: string): number => Number(id.slice(id.lastIndexOf('-') + 1));
  const highest = (ids: readonly string[]): number => Math.max(0, ...ids.map(suffix));
  must(updates.engineCounters.length === 6 && updates.engineCounters.every((row) => row.nextValue >= 1), 'engine_counters', 'not six counters of at least 1');
  must(counter('event') === firstEvent + rows.events.length, 'engine_counters', 'the event counter is not the next event sequence');
  must(counter('session') > highest([...sessionIds, ...rows.activeSession.map((row) => row.id)]), 'engine_counters', 'the session counter is not above the highest session number');
  must(counter('evidence') > highest(evidenceIds), 'engine_counters', 'the evidence counter is not above the highest evidence number');
  must(
    counter('caseNumber') > highest([...rows.sessionHistory.map((row) => row.caseNumber), ...base.slices.sessionHistory.map((entry) => entry.caseNumber)]),
    'engine_counters',
    'the case counter is not above the highest case number',
  );
  must(counter('item') > highest(rows.alerts.map((row) => row.id)), 'engine_counters', 'the item counter is not above the highest alert number');
  must(counter('export') > highest(rows.exportRecords.map((row) => row.id)), 'engine_counters', 'the export counter is not above the highest export number');
  const registry = (name: string): number => updates.registryCounters.find((row) => row.name === name)?.nextValue ?? 0;
  must(registry('device') > highest(rows.pairedDevices.map((row) => row.id)), 'registry_counters', 'the device counter is not above the highest device number');
  must(registry('pairingCode') > highest(rows.pairingCodes.map((row) => row.id)), 'registry_counters', 'the code counter is not above the highest code number');
}
