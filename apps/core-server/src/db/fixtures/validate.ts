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
import { createHash } from 'node:crypto';
import { GENESIS_HASH, verifyAuditChain } from '@dems/shared/sim';
import { FINALIZATION_STEPS_V2 } from '@dems/shared/domain';
import { auditRowFromRow, isStorableText } from '../mapping';
import {
  AUDIO_INTERVAL_REASON,
  AUDIT_CATEGORY,
  AUDIT_DETAIL_FORBIDDEN_KEYS,
  BIO_REVOKE_REASON,
  CAPTURE_DEVICE_KIND,
  CHAIN_DISCARD_REASON,
  CODE_STATE,
  DEVICE_STATE,
  EVENT_CATEGORY,
  EVIDENCE_STATUS,
  FAULT_KIND,
  LABELS_STATUS,
  LIFECYCLE_STAGE,
  MIC_ROLE,
  ROLE,
  SCENARIO,
  SEALING_JOB_STATUS,
  SESSION_END_REASON,
  SESSION_OUTCOME,
  SEVERITY,
  SNAPSHOT_CAUSE,
  SUBJECT_TYPE,
  TRACK_ID,
  TRANSCRIPT_CHUNK_STATUS,
  TRANSCRIPT_SIGNATURE_ALGORITHM,
  VERIFICATION,
  VIDEO_TRACK_ID,
} from '../schema';
import { BULK_MIX } from './minimums';
import { BUILT_IN_CAPTURE_DEVICE_IDS } from './pipeline';
import { FIXTURE_TABLES, type BulkFixtureRows, type BulkFixtureUpdates } from './rows';
import { BulkFixtureError } from './target';
import type { BulkBase } from './world';

const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;
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

  // ── schema v2 (dbc-3 §G): capture variants and the six pipeline tables (CS-20) ───────────────
  const captureDeviceIds = new Set<string>([...BUILT_IN_CAPTURE_DEVICE_IDS, ...rows.captureDevices.map((row) => row.id)]);
  const fixtureDeviceIds = new Set(rows.captureDevices.map((row) => row.id));
  unique(rows.captureDevices.map((row) => row.id), 'capture_devices', 'capture_devices_pkey');
  for (const row of rows.captureDevices) {
    must(fixtureDeviceIds.has(row.id) && !BUILT_IN_CAPTURE_DEVICE_IDS.includes(row.id as (typeof BUILT_IN_CAPTURE_DEVICE_IDS)[number]), 'capture_devices', 'the fixture must only add discovered devices');
    must(isIn(CAPTURE_DEVICE_KIND, row.kind), 'capture_devices', 'capture_devices_kind_check');
    must(
      (row.kind === 'CAMERA' && /^CAM-[0-9]{2,}$/.test(row.id)) || (row.kind === 'MIC' && /^MIC-[0-9]{2,}$/.test(row.id)) || (row.kind === 'POE' && /^POE-[A-Z0-9_]{2,}$/.test(row.id)),
      'capture_devices',
      'capture_devices_id_check',
    );
    must(CODE.test(row.transport), 'capture_devices', 'capture_devices_transport_check');
    const profiles = Array.isArray(row.profiles) ? (row.profiles as readonly unknown[]) : [];
    must(Array.isArray(row.profiles) && profiles.every((profile) => typeof profile === 'string' && CODE.test(profile)), 'capture_devices', 'capture_devices_profiles_check');
    must(row.poePort === null || CODE.test(row.poePort), 'capture_devices', 'capture_devices_poe_port_check');
    must(row.mac === null || /^[0-9A-F:]{17}$/.test(row.mac), 'capture_devices', 'capture_devices_text_check');
    for (const text of [row.model, row.firmware, row.address, row.onvifUuid]) {
      must(text === null || (length(text.trim()) >= 1 && length(text) <= 120), 'capture_devices', 'capture_devices_text_check');
    }
  }
  const discovered = rows.captureDevices.filter((row) => row.kind === 'CAMERA' && Array.isArray(row.profiles) && (row.profiles as readonly unknown[]).length >= 2);
  must(discovered.length >= BULK_MIX.captureDevices.dualProfileCameras, 'capture_devices', 'no discovered camera carries two profiles (OD-05, dbc-3 §G)');

  unique(rows.captureDeviceCredentials.map((row) => row.deviceId), 'capture_device_credentials', 'capture_device_credentials_pkey');
  for (const row of rows.captureDeviceCredentials) {
    // §G: fake devices only - the discovered cameras the fixture added, never a built-in.
    must(fixtureDeviceIds.has(row.deviceId), 'capture_device_credentials', 'capture_device_credentials_device_id_fkey (fake devices only)');
    must(length(row.username) >= 1 && length(row.username) <= 120, 'capture_device_credentials', 'capture_device_credentials_username_check');
    must(row.encryption === 'AES-256-GCM', 'capture_device_credentials', 'capture_device_credentials_encryption_check');
    must(Buffer.isBuffer(row.secretCiphertext) && row.secretCiphertext.length >= 33, 'capture_device_credentials', 'capture_device_credentials_secret_check');
    must(Buffer.isBuffer(row.nonce) && row.nonce.length === 12, 'capture_device_credentials', 'capture_device_credentials_nonce_check');
    must(CODE.test(row.keyRef), 'capture_device_credentials', 'capture_device_credentials_key_ref_check');
  }
  must(
    rows.captureDeviceCredentials.some((row) => rows.captureDeviceCredentials.some((other) => other !== row && other.rotatedAt < row.rotatedAt)),
    'capture_device_credentials',
    'no credential was rotated after another (dbc-3 §G)',
  );

  // The sealed sessions the §G rules count over: the fixture's plans cannot be seen here, so the
  // rule reads the rows: every sealed session (base or fixture) carries at least one interval.
  const sealedSessionIds = new Set([
    ...base.slices.sessionHistory.filter((entry) => entry.outcome === 'SEALED').map((entry) => entry.id),
    ...rows.sessionHistory.filter((row) => row.outcome === 'SEALED').map((row) => row.id),
  ]);
  const sealedEvidenceIds = new Set([
    ...base.slices.evidence.filter((item) => item.status === 'SEALED').map((item) => item.id),
    ...rows.evidenceItems.filter((row) => row.status === 'SEALED').map((row) => row.id),
  ]);
  const variantActive = rows.activeSession.length === 1;

  const intervalSeq = new Map<string, number>();
  const intervalOpen = new Map<string, number>();
  const switchedSessions = new Set<string>();
  let manualRows = 0;
  for (const row of rows.sessionAudioIntervals) {
    must(SESSION_ID.test(row.sessionId), 'session_audio_intervals', 'session_audio_intervals_session_check');
    must(captureDeviceIds.has(row.micDeviceId), 'session_audio_intervals', 'session_audio_intervals_mic_device_id_fkey');
    must(row.switchedBy === null || operatorIds.has(row.switchedBy), 'session_audio_intervals', 'session_audio_intervals_switched_by_fkey');
    must(isIn(MIC_ROLE, row.role) && isIn(AUDIO_INTERVAL_REASON, row.reason), 'session_audio_intervals', 'session_audio_intervals_role_check');
    must(row.fromMediaMs >= 0 && (row.toMediaMs === null || row.toMediaMs >= row.fromMediaMs), 'session_audio_intervals', 'session_audio_intervals_media_check');
    must((row.toMediaMs === null) === (row.toAt === null), 'session_audio_intervals', 'session_audio_intervals_open_check');
    must(row.reason === 'MANUAL' ? row.switchedBy !== null : row.switchedBy === null, 'session_audio_intervals', 'a MANUAL interval needs its switcher and no other reason may name one');
    const previous = intervalSeq.get(row.sessionId) ?? 0;
    must(row.seq === previous + 1, 'session_audio_intervals', 'seq does not run from 1 without a gap');
    intervalSeq.set(row.sessionId, row.seq);
    if (row.toMediaMs === null) intervalOpen.set(row.sessionId, (intervalOpen.get(row.sessionId) ?? 0) + 1);
    if (row.reason === 'MANUAL') {
      manualRows += 1;
      switchedSessions.add(row.sessionId);
    }
  }
  for (const id of sealedSessionIds) must((intervalSeq.get(id) ?? 0) >= 1, 'session_audio_intervals', 'a sealed session carries no interval (dbc-3 §G)');
  must(intervalOpen.size === 0 || (variantActive && intervalOpen.size === 1 && [...intervalOpen.values()].every((n) => n === 1)), 'session_audio_intervals', 'the open interval belongs to the RECORDING variant alone (one per session)');
  must(switchedSessions.size >= BULK_MIX.sessionAudioIntervals.switchedSessions && manualRows >= BULK_MIX.sessionAudioIntervals.manualRows, 'session_audio_intervals', 'fewer switched sessions or MANUAL rows than dbc-3 §G asks');
  for (const sessionId of switchedSessions) {
    const manual = rows.sessionAudioIntervals.filter((row) => row.sessionId === sessionId && row.reason === 'MANUAL').length;
    must(manual >= 2 && manual <= 3, 'session_audio_intervals', 'a switched session carries 2 to 3 MANUAL intervals');
  }

  // Fragments: contiguous sequences, recomputable chains, and the chain head on the tracks (§G).
  const fragmentByTrack = new Map<string, { seq: number; head: string }>();
  for (const row of rows.recordingFragments) {
    must(SESSION_ID.test(row.sessionId), 'recording_fragments', 'recording_fragments_session_check');
    must(isIn(VIDEO_TRACK_ID, row.trackId), 'recording_fragments', 'recording_fragments_track_check');
    must(row.byteOffset >= 0 && row.byteLength >= 1, 'recording_fragments', 'recording_fragments_bytes_check');
    must(row.mediaStartMs >= 0 && row.mediaDurationMs >= 1, 'recording_fragments', 'recording_fragments_media_check');
    must(HEX64.test(row.sha256) && HEX64.test(row.chainHash), 'recording_fragments', 'recording_fragments_hashes_check');
    const key = `${row.sessionId}|${row.trackId}`;
    const last = fragmentByTrack.get(key);
    must(row.seq === (last?.seq ?? 0) + 1, 'recording_fragments', 'seq does not run from 1 without a gap (the gap is the M2-MT-3 negative test)');
    const expectedChain = row.seq === 1 ? createHash('sha256').update('', 'utf8').digest('hex') : createHash('sha256').update(`${last?.head ?? ''}${row.sha256}`, 'utf8').digest('hex');
    must(row.chainHash === expectedChain, 'recording_fragments', 'the chain hash does not recompute (first row SHA-256 of the empty string, then sha256(prev ‖ fragment))');
    fragmentByTrack.set(key, { seq: row.seq, head: row.chainHash });
  }
  const patched = rows.evidenceTracks.filter((row) => row.fragmentChainHead !== null && row.fragmentChainHead !== undefined);
  must(patched.length === BULK_MIX.recordingFragments.fullChainSessions * BULK_MIX.recordingFragments.tracksPerChain, 'evidence_tracks', 'the fragment chain heads must cover exactly the 40 newest sessions times the two camera tracks');
  for (const row of patched) {
    const chain = fragmentByTrack.get(`${rows.evidenceItems.find((item) => item.id === row.evidenceId)?.sessionId}|${row.trackId}`);
    must(
      chain !== undefined && chain.head === row.fragmentChainHead && chain.seq === row.fragmentCount,
      'evidence_tracks',
      'fragment_chain_head or fragment_count does not equal the chain it stands for (dbc-3 §G)',
    );
  }

  // Chunks: contiguous audio ranges (a rerun re-covers the span of the FAILED row before it).
  let previousChunk: { sessionId: string; seq: number; from: number; to: number; status: string } | null = null;
  const chunksBySession = new Map<string, { total: number; done: number; reruns: number }>();
  for (const row of rows.transcriptChunks) {
    must(SESSION_ID.test(row.sessionId), 'transcript_chunks', 'transcript_chunks_session_check');
    must(row.audioFromMs >= 0 && row.audioToMs > row.audioFromMs, 'transcript_chunks', 'transcript_chunks_audio_check');
    must(isIn(TRANSCRIPT_CHUNK_STATUS, row.status), 'transcript_chunks', 'transcript_chunks_status_check');
    must(row.segments === null || Array.isArray(row.segments), 'transcript_chunks', 'transcript_chunks_segments_check');
    must(row.status !== 'DONE' || (Array.isArray(row.segments) && row.computedAt !== null), 'transcript_chunks', 'transcript_chunks_done_check');
    for (const ref of [row.embeddingRef, row.modelId]) must(ref === null || CODE.test(ref), 'transcript_chunks', 'transcript_chunks_ref_check');
    const last = previousChunk;
    const same = last !== null && last.sessionId === row.sessionId;
    const rerun = same && last.status === 'FAILED' && row.audioFromMs === last.from && row.audioToMs === last.to;
    must(last === null || !same || (row.seq === last.seq + 1 && (rerun || row.audioFromMs === last.to)), 'transcript_chunks', 'the audio ranges are not contiguous (a rerun may only re-cover a FAILED span)');
    const counts = chunksBySession.get(row.sessionId) ?? { total: 0, done: 0, reruns: 0 };
    counts.total += 1;
    if (row.status === 'DONE') counts.done += 1;
    if (rerun) counts.reruns += 1;
    chunksBySession.set(row.sessionId, counts);
    previousChunk = { sessionId: row.sessionId, seq: row.seq, from: row.audioFromMs, to: row.audioToMs, status: row.status };
  }
  const chunkTotals = [...chunksBySession.values()].reduce((sum, entry) => ({ total: sum.total + entry.total, done: sum.done + entry.done, reruns: sum.reruns + entry.reruns }), { total: 0, done: 0, reruns: 0 });
  must(chunkTotals.reruns >= BULK_MIX.transcriptChunks.failedRerunPairs, 'transcript_chunks', `fewer than ${BULK_MIX.transcriptChunks.failedRerunPairs} FAILED->rerun pairs`);
  must(chunkTotals.total > 0 && chunkTotals.done / chunkTotals.total >= BULK_MIX.transcriptChunks.doneSegmentsPercent / 100, 'transcript_chunks', 'fewer than 95 percent of the chunks are DONE with segments');

  // Transcripts: exactly one per SEALED item, no transcript on any other item.
  unique(rows.transcripts.map((row) => row.evidenceId), 'transcripts', 'transcripts_pkey');
  const transcriptIds = new Set(rows.transcripts.map((row) => row.evidenceId));
  for (const row of rows.transcripts) {
    must(knownEvidence.has(row.evidenceId), 'transcripts', 'transcripts_evidence_id_fkey');
    must(HEX64.test(row.jsonSha256) && HEX64.test(row.srtSha256) && HEX64.test(row.vttSha256), 'transcripts', 'transcripts_hashes_check');
    must(isIn(LABELS_STATUS, row.labelsStatus), 'transcripts', 'transcripts_labels_check');
    must(typeof row.model === 'object' && row.model !== null && !Array.isArray(row.model), 'transcripts', 'transcripts_json_check (model)');
    must(typeof row.diarization === 'object' && row.diarization !== null && !Array.isArray(row.diarization), 'transcripts', 'transcripts_json_check (diarization)');
    must(row.createdAt > 0, 'transcripts', 'a transcript was created at an unusable instant');
  }
  for (const id of sealedEvidenceIds) must(transcriptIds.has(id), 'transcripts', 'a SEALED item carries no transcript (dbc-3 §G: one per SEALED)');
  for (const id of transcriptIds) must(sealedEvidenceIds.has(id), 'transcripts', 'a transcript hangs on an item that is not SEALED');
  const labelsValues = new Set(rows.transcripts.map((row) => row.labelsStatus));
  must(labelsValues.size === BULK_MIX.transcripts.labelsValues, 'transcripts', 'both labels values must be present');
  must(rows.transcripts.filter((row) => row.labelsStatus === 'UNAVAILABLE').length >= BULK_MIX.transcripts.unavailableLabels, 'transcripts', 'fewer than 30 transcripts are UNAVAILABLE');

  // Revisions: the parent chain from the transcript's json hash, Ed25519-form signatures.
  const revisionsByItem = new Map<string, number>();
  for (const row of rows.transcriptRevisions) {
    must(knownEvidence.has(row.evidenceId), 'transcript_revisions', 'transcript_revisions_evidence_id_fkey');
    operator(row.authorId, 'transcript_revisions');
    must(row.revisionNo === (revisionsByItem.get(row.evidenceId) ?? 0) + 1, 'transcript_revisions', 'revision_no does not run from 1 without a gap');
    must(CODE.test(row.signatureKeyId), 'transcript_revisions', 'transcript_revisions_key_id_check');
    must(row.signatureCertificateSha256 === null || HEX64.test(row.signatureCertificateSha256), 'transcript_revisions', 'transcript_revisions_certificate_check');
    must(length(row.reason) >= 5 && length(row.reason) <= 500, 'transcript_revisions', 'transcript_revisions_reason_check');
    must(isIn(TRANSCRIPT_SIGNATURE_ALGORITHM, row.signatureAlgorithm), 'transcript_revisions', 'transcript_revisions_signature_check');
    must(row.signatureAlgorithm === 'Ed25519' && row.signatureSimulated === false && HEX128.test(row.signatureValue), 'transcript_revisions', 'the §G revisions sign in the Ed25519 form (128 hex, not simulated)');
    const transcript = rows.transcripts.find((candidate) => candidate.evidenceId === row.evidenceId);
    const parent = row.revisionNo === 1 ? transcript?.jsonSha256 : rows.transcriptRevisions.find((candidate) => candidate.evidenceId === row.evidenceId && candidate.revisionNo === row.revisionNo - 1)?.sha256;
    must(parent !== undefined && parent === row.parentSha256, 'transcript_revisions', 'parent_sha256 does not link (revision 1 hangs on the transcript, later ones on their predecessor)');
    must(HEX64.test(row.sha256), 'transcript_revisions', 'transcript_revisions_hashes_check');
    must(transcript !== undefined && row.createdAt >= transcript.createdAt, 'transcript_revisions', 'a revision predates its transcript');
    revisionsByItem.set(row.evidenceId, row.revisionNo);
  }
  const chainedItems = [...revisionsByItem.values()].filter((count) => count >= 2).length;
  must(chainedItems >= BULK_MIX.transcriptRevisions.chainedItems, 'transcript_revisions', 'fewer than 5 items carry chained revisions (dbc-3 §G)');

  // Sealing jobs: all six steps of every sealed session, DONE; the variant's RUNNING row.
  const stepsBySession = new Map<string, Set<string>>();
  const seenSteps = new Set<string>();
  let runningJobs = 0;
  let resumedJobs = 0;
  let checkpointedJobs = 0;
  for (const row of rows.sealingJobs) {
    must(SESSION_ID.test(row.sessionId), 'sealing_jobs', 'sealing_jobs_session_check');
    must(CODE.test(row.step), 'sealing_jobs', 'sealing_jobs_step_check');
    must(isIn(SEALING_JOB_STATUS, row.status), 'sealing_jobs', 'sealing_jobs_status_check');
    must(row.progress >= 0 && row.progress <= 100, 'sealing_jobs', 'sealing_jobs_progress_check');
    must(row.etaMs === null || row.etaMs >= 0, 'sealing_jobs', 'sealing_jobs_eta_check');
    must(row.attempt >= 1, 'sealing_jobs', 'sealing_jobs_attempt_check');
    must(row.checkpoint === null || (typeof row.checkpoint === 'object' && !Array.isArray(row.checkpoint)), 'sealing_jobs', 'sealing_jobs_checkpoint_check');
    must(row.errorCode === null || CODE.test(row.errorCode), 'sealing_jobs', 'sealing_jobs_error_code_check');
    must(row.updatedAt >= row.startedAt, 'sealing_jobs', 'a job was updated before it started');
    const key = `${row.sessionId}|${row.step}`;
    must(!seenSteps.has(key), 'sealing_jobs', 'sealing_jobs_pkey');
    seenSteps.add(key);
    if (row.status === 'RUNNING') runningJobs += 1;
    if (row.attempt >= 2 && row.status === 'DONE') resumedJobs += 1;
    if (row.checkpoint !== null) checkpointedJobs += 1;
    stepsBySession.set(row.sessionId, new Set([...(stepsBySession.get(row.sessionId) ?? []), row.step]));
  }
  for (const sessionId of sealedSessionIds) {
    const steps = stepsBySession.get(sessionId);
    must(steps !== undefined && FINALIZATION_STEPS_V2.every((step) => steps.has(step)), 'sealing_jobs', `the sealed session ${sessionId} does not carry every finalization step (dbc-3 §G)`);
    must(rows.sealingJobs.some((row) => row.sessionId === sessionId && row.status !== 'DONE') === false, 'sealing_jobs', 'a step of a sealed session is not DONE');
  }
  must(runningJobs === (variantActive ? BULK_MIX.sealingJobs.runningInRecoveryVariant : 0), 'sealing_jobs', 'the RUNNING job belongs to the RECOVERY variant alone');
  must(resumedJobs >= BULK_MIX.sealingJobs.resumedAtLeast, 'sealing_jobs', 'fewer than 20 rows resumed from attempt 2');
  must(checkpointedJobs >= BULK_MIX.sealingJobs.checkpointedAtLeast, 'sealing_jobs', 'fewer than 5 jobs carry a checkpoint');

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
