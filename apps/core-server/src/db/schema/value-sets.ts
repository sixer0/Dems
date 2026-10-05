/**
 * The closed value sets of the database contract (§2.4): the text of every CHECK list.
 *
 * Each list is written out here as a literal, in the order of the contract, and is NOT derived
 * from the shared vocabulary at run time: a change of a closed set needs a migration (MG-11), so
 * it must be a visible edit of this file followed by `db:generate`, never a side effect of a
 * change elsewhere. The vocabulary test (CL-12, `test/db/vocabulary.db.test.ts`) compares the
 * catalog text of each CHECK with the shared constant it cites and fails the gate when the two
 * differ (GD-05).
 *
 * Open sets (audit type, event type, permission, custody action) are checked by format only
 * (`CODE`), so additive vocabulary needs no migration.
 */

export const ROLE = ['INVESTIGATOR', 'SUPERVISOR', 'TECHNICIAN'] as const;
export const SEVERITY = ['INFO', 'SUCCESS', 'WARNING', 'CRITICAL'] as const;
export const AUDIT_CATEGORY = [
  'AUTH',
  'SESSION',
  'EVIDENCE',
  'DEVICE',
  'SECURITY',
  'STORAGE',
  'PAIRING',
  'SYSTEM',
] as const;
export const EVENT_CATEGORY = [
  'AUTH',
  'SESSION',
  'EVIDENCE',
  'EXPORT',
  'STORAGE',
  'TIME',
  'NETWORK',
  'DEVICE',
  'SECURITY',
  'SYSTEM',
] as const;
export const SESSION_STATE = [
  'CREATE',
  'PRECHECK',
  'ARMED',
  'RECORDING',
  'STOPPING',
  'FINALIZING',
  'SEALED',
  'FAULT',
  'RECOVERY',
] as const;
export const SESSION_OUTCOME = ['SEALED', 'INCOMPLETE'] as const;
export const SUBJECT_TYPE = ['TERSANGKA', 'SAKSI', 'LAINNYA'] as const;
export const PROFILE = ['STANDARD_1080P25'] as const;
export const TIME_SOURCE = ['GNSS', 'NTP', 'RTC'] as const;
export const TRACK_ID = ['VIDEO-01', 'VIDEO-02', 'AUDIO-01', 'AUDIO-02'] as const;
export const VIDEO_TRACK_ID = ['VIDEO-01', 'VIDEO-02'] as const;
export const FAULT_KIND = [
  'CAMERA_LOSS',
  'MIC_NO_SIGNAL',
  'MIC_CLIP',
  'STORAGE_LOW',
  'STORAGE_FULL',
  'GNSS_LOSS',
  'TAMPER',
  'FAN_STALL',
  'POWER_FAIL',
  'TPM_FAILURE',
  'SECURITY_FAULT',
  'AUDIT_TAMPER',
] as const;
export const EVIDENCE_STATUS = ['RECORDED', 'SEALED', 'EXPORTED', 'UNDER_REVIEW', 'ARCHIVED'] as const;
export const LIFECYCLE_STAGE = [
  'CAPTURE',
  'RECORDING',
  'FINALIZING',
  'HASH',
  'MANIFEST',
  'ENCRYPT',
  'SIGN',
  'SEALED_LOCAL_EVIDENCE',
  'AUTHORIZED_REVIEW',
  'AUTHORIZED_EXPORT_TRANSFER',
  'DESTINATION_VERIFICATION',
  'RETENTION_ARCHIVE_DISPOSITION',
] as const;
export const VERIFICATION = ['NOT_RUN', 'PASS', 'FAIL'] as const;
export const INTEGRITY_SOURCE = ['DEMO_PACKAGE', 'SIMULATED'] as const;
export const RETENTION = ['DAYS_30', 'DAYS_90', 'YEAR_1', 'CASE_CLOSURE'] as const;
export const SCENARIO = ['idle', 'recording', 'finalizing', 'fault-demo'] as const;
export const STORAGE_STATE = ['READY', 'LOW', 'FULL'] as const;
export const SECURITY_STATE = ['READY', 'FAULT'] as const;
/** The shared set also has `SECURITY_KEY`; no Live session can have it (spec §7.17 X-1). */
export const AUTH_METHOD = ['PASSWORD', 'BIOMETRIC'] as const;
/** Eight values. `TOKEN_REUSE` is part of schema version 1 (SD-10, D16). */
export const SESSION_END_REASON = [
  'SIGNED_OUT',
  'IDLE_EXPIRED',
  'ABSOLUTE_EXPIRED',
  'ROTATED',
  'USER_DISABLED',
  'DEVICE_REVOKED',
  'DEVICE_UNPAIRED',
  'TOKEN_REUSE',
] as const;
export const DEVICE_STATE = ['PAIRED', 'REVOKED', 'UNPAIRED'] as const;
export const CODE_STATE = ['ACTIVE', 'REDEEMED', 'CANCELLED', 'EXPIRED', 'EXHAUSTED'] as const;
export const BIO_REVOKE_REASON = [
  'DISABLED',
  'REENROLLED',
  'TOKEN_REUSE',
  'DEVICE_REVOKED',
  'DEVICE_UNPAIRED',
  'USER_DISABLED',
] as const;
export const EXPORT_SCOPE = ['EVIDENCE', 'AUDIT', 'LOGS'] as const;
export const SNAPSHOT_CAUSE = ['INTERVAL', 'FAULT_RAISED', 'FAULT_CLEARED'] as const;
export const CHAIN_DISCARD_REASON = ['RESET', 'SCENARIO_LOAD'] as const;

/** The two counters of `registry_counters` (T-11) and the six of `engine_counters` (T-24). */
export const REGISTRY_COUNTER = ['device', 'pairingCode'] as const;
export const ENGINE_COUNTER = ['event', 'session', 'caseNumber', 'evidence', 'item', 'export'] as const;
export const TIME_FORMAT = ['24', '12'] as const;

/**
 * The 17 key names a payload map must not hold (contract §2.4 `NO_SECRET_KEYS`, §5.5). The list
 * exists twice: in the CHECK constraints built from this constant, and here as the server
 * constant the audit writer checks before it sends a row. The catalog test compares the two.
 */
export const AUDIT_DETAIL_FORBIDDEN_KEYS = [
  'password',
  'passwordHash',
  'salt',
  'token',
  'tokenHash',
  'sessionToken',
  'deviceCredential',
  'credential',
  'credentialHash',
  'biometricToken',
  'code',
  'codeHash',
  'pairingCode',
  'qrPayload',
  'username',
  'cookie',
  'authorization',
] as const;

export type RoleId = (typeof ROLE)[number];
export type SeverityValue = (typeof SEVERITY)[number];
export type AuditCategoryValue = (typeof AUDIT_CATEGORY)[number];
export type EventCategoryValue = (typeof EVENT_CATEGORY)[number];
export type SessionStateValue = (typeof SESSION_STATE)[number];
export type SessionOutcomeValue = (typeof SESSION_OUTCOME)[number];
export type SubjectTypeValue = (typeof SUBJECT_TYPE)[number];
export type ProfileId = (typeof PROFILE)[number];
export type TimeSourceValue = (typeof TIME_SOURCE)[number];
export type TrackIdValue = (typeof TRACK_ID)[number];
export type VideoTrackIdValue = (typeof VIDEO_TRACK_ID)[number];
export type FaultKindValue = (typeof FAULT_KIND)[number];
export type EvidenceStatusValue = (typeof EVIDENCE_STATUS)[number];
export type LifecycleStageValue = (typeof LIFECYCLE_STAGE)[number];
export type VerificationValue = (typeof VERIFICATION)[number];
export type IntegritySourceValue = (typeof INTEGRITY_SOURCE)[number];
export type RetentionValue = (typeof RETENTION)[number];
export type ScenarioValue = (typeof SCENARIO)[number];
export type StorageStateValue = (typeof STORAGE_STATE)[number];
export type SecurityStateValue = (typeof SECURITY_STATE)[number];
export type AuthMethodValue = (typeof AUTH_METHOD)[number];
export type SessionEndReason = (typeof SESSION_END_REASON)[number];
export type DeviceStateValue = (typeof DEVICE_STATE)[number];
export type CodeStateValue = (typeof CODE_STATE)[number];
export type BioRevokeReason = (typeof BIO_REVOKE_REASON)[number];
export type ExportScopeValue = (typeof EXPORT_SCOPE)[number];
export type SnapshotCauseValue = (typeof SNAPSHOT_CAUSE)[number];
export type ChainDiscardReason = (typeof CHAIN_DISCARD_REASON)[number];
export type RegistryCounterName = (typeof REGISTRY_COUNTER)[number];
export type EngineCounterName = (typeof ENGINE_COUNTER)[number];
export type TimeFormatValue = (typeof TIME_FORMAT)[number];

/** A flat detail map: the values are strings, numbers, booleans or null (`types.ts:68-69`). */
export type FlatJson = Record<string, string | number | boolean | null>;
