/**
 * The closed value sets of the database contract (§2.4): the text of every CHECK list.
 *
 * Each list is written out here as a literal, in the order of the contract, and is NOT derived
 * from the shared vocabulary at run time: a change of a closed set needs a migration (MG-11), so
 * it must be a visible edit of this file followed by `db:generate`, never a side effect of a
 * change elsewhere. The vocabulary test (CL-12, `test/db/contract-inventory.test.ts`) compares the
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
export const TRACK_ID = ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'AUDIO-01', 'AUDIO-02'] as const; // D60 (2026-11-04)
export const VIDEO_TRACK_ID = ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04'] as const; // D60
/**
 * Fourteen kinds in schema v2 (dbc-3 §C.1-§C.3). `MIC_SILENT` and `CAPTURE_FAULT` are appended in
 * the order the contract writes them, and the shared enum `FaultKind` grows in the same order so
 * the vocabulary pin (CL-12, M2-MT-8) compares two equal lists. The three CHECK sites that read
 * this list — `session_history_outcome_check`, `alerts_kind_check` and
 * `health_snapshots_cause_check` — are swapped by this edit alone (E-01).
 */
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
  'MIC_SILENT',
  'CAPTURE_FAULT',
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
/** `REAL` is added in v2 (dbc-3 §B.11, §C.6): the OD-19 reset guard keys on it (D-DB-04). */
export const INTEGRITY_SOURCE = ['DEMO_PACKAGE', 'SIMULATED', 'REAL'] as const;
export const RETENTION = ['DAYS_30', 'DAYS_90', 'YEAR_1', 'CASE_CLOSURE'] as const;
export const SCENARIO = ['idle', 'recording', 'finalizing', 'fault-demo'] as const;
export const STORAGE_STATE = ['READY', 'LOW', 'FULL'] as const;
export const SECURITY_STATE = ['READY', 'FAULT'] as const;
/** The shared set also has `SECURITY_KEY`; no Live session can have it (spec §7.17 X-1). */
export const AUTH_METHOD = ['PASSWORD', 'BIOMETRIC'] as const;
/**
 * Nine values. `TOKEN_REUSE` is part of schema version 1 (SD-10, D16).
 *
 * `CREDENTIAL_REPLACED` since schema version 9 (migration set 10, `0019` + `0020`; task 4 package
 * X-C, design `docs/2026-10-12_input_av_core_adapter_plan/masterplan/05_design_x1_x2.md` section
 * 3.6; security review SX-12): the password of the operator was replaced from the host, so every
 * open session of that operator is ended. No earlier member says that: `SIGNED_OUT` would be a
 * false statement in the session history. Added LAST, so that the order of the eight is kept.
 */
export const SESSION_END_REASON = [
  'SIGNED_OUT',
  'IDLE_EXPIRED',
  'ABSOLUTE_EXPIRED',
  'ROTATED',
  'USER_DISABLED',
  'DEVICE_REVOKED',
  'DEVICE_UNPAIRED',
  'TOKEN_REUSE',
  'CREDENTIAL_REPLACED',
] as const;
export const DEVICE_STATE = ['PAIRED', 'REVOKED', 'UNPAIRED'] as const;
export const CODE_STATE = ['ACTIVE', 'REDEEMED', 'CANCELLED', 'EXPIRED', 'EXHAUSTED'] as const;
/**
 * Seven values. `CREDENTIAL_REPLACED` since schema version 9 (the same step as the session-end
 * reason above): the biometric tokens of an operator whose password was replaced from the host
 * are revoked with it. Added LAST.
 */
export const BIO_REVOKE_REASON = [
  'DISABLED',
  'REENROLLED',
  'TOKEN_REUSE',
  'DEVICE_REVOKED',
  'DEVICE_UNPAIRED',
  'USER_DISABLED',
  'CREDENTIAL_REPLACED',
] as const;
export const EXPORT_SCOPE = ['EVIDENCE', 'AUDIT', 'LOGS'] as const;
export const SNAPSHOT_CAUSE = ['INTERVAL', 'FAULT_RAISED', 'FAULT_CLEARED'] as const;
export const CHAIN_DISCARD_REASON = ['RESET', 'SCENARIO_LOAD'] as const;

// ─── Schema v2 (dbc-3 §B): the nine capture, sealing and transcript tables ─────────────────────
// The sets below are new with schema version 2. Media profiles and transports stay OPEN sets
// checked by the `CODE` format only (OD-06/OD-07, MG-11), and the sealing step names are an open
// set pinned by the shared vocabulary test, never by a DB CHECK (dbc-3 §B.4).

/** The registry kind of `capture_devices` (T-32); the id prefix is tied to it by its own CHECK. */
export const CAPTURE_DEVICE_KIND = ['CAMERA', 'MIC', 'POE'] as const;
/**
 * The adapter kind of a capture device (`capture_devices.adapter_kind`, dbc-4 §N.2, D-DB-11) and of
 * one slot of a recorded session (`session_capture_sources.adapter_kind`, §N.3). A CLOSED set: the
 * value decides whether a sealed package says "production", so an unknown kind is refused by the
 * database. Written at INSERT and never updated (no UPDATE grant; D83). The source class is derived
 * from it by one function of the Core and is not stored. Server-native until row 136 adds the
 * shared constant (the CL-12 equality then pins this list to it).
 */
export const CAPTURE_ADAPTER_KIND = ['ONVIF_RTSP', 'USB_AUDIO', 'SNMP_POE', 'FAKE', 'LOCAL_DEVICE'] as const;
/** The adapter kinds a device class may carry (`capture_devices_adapter_pairing_check`, §N.2). */
export const CAPTURE_ADAPTER_KINDS_BY_DEVICE_KIND = {
  CAMERA: ['ONVIF_RTSP', 'FAKE', 'LOCAL_DEVICE'],
  MIC: ['USB_AUDIO', 'FAKE', 'LOCAL_DEVICE'],
  POE: ['SNMP_POE', 'FAKE'],
} as const;
/** The six source slots of a session (`session_capture_sources.slot`, T-41; dbc-4 §N.3; D60 of 2026-11-04). */
export const CAPTURE_SOURCE_SLOT = ['VIDEO-01', 'VIDEO-02', 'VIDEO-03', 'VIDEO-04', 'MIC-PRIMARY', 'MIC-STANDBY'] as const;
/** The production adapter kinds: what the reset-guard cross-check refuses to exempt (§N.10). */
export const CAPTURE_PRODUCTION_ADAPTER_KINDS = ['ONVIF_RTSP', 'USB_AUDIO', 'SNMP_POE'] as const;
/**
 * Whether a stream of a camera is its main stream or its sub-stream
 * (`capture_device_streams.stream_role`, T-44; schema v7, set A of task 4). A CLOSED set.
 */
export const CAPTURE_STREAM_ROLE = ['MAIN', 'SUB'] as const;
/**
 * The video codec a stream delivers, as the Core read it from the stream itself
 * (`capture_device_streams.codec`, T-44; requirement AD-06 (1)). A CLOSED set in the words of
 * `MediaProfile.codec` (`capture/adapters/types.ts`) and of manifest field 43: no text a camera
 * chose is ever a member, so an unknown codec is `OTHER` and never its name.
 */
export const CAPTURE_STREAM_CODEC = ['H264', 'HEVC', 'OTHER'] as const;
/**
 * Why the Core put a temporary address on the camera interface (`host_network_aliases.reason`,
 * T-47; schema v8, set B of task 4). A CLOSED set: input-av writes free text here, the Core a code.
 */
export const HOST_ALIAS_REASON = ['FACTORY_SCAN', 'SET_CAMERA_ADDRESS'] as const;
/**
 * How a temporary address ended (`host_network_aliases.remove_reason`, T-47). A CLOSED set:
 * its lifetime ran out, an operator removed it, the job that needed it finished, or the start-up
 * sweep found the row of an address that is no longer on the interface.
 *
 * Since schema v12 (decision C74 D-2 / D-3 of task 4) two more, LAST in the stored order:
 * `SHUTDOWN` - the Core took the address away because it was shutting down, no job had finished;
 * `NOT_ADDED` - the row was opened with the intent and the helper certainly added nothing, so the
 * row closes without an address ever having been on the interface. Until then both were written
 * `JOB_DONE`, which said a job was done when none was.
 *
 * Since schema v13 (caution R119-05 of the commissioning security review, decision C94 (d)) one
 * more, LAST: `ADD_UNCONFIRMED` - the Core took the address away at once because the effect of its
 * `add` was not known (the helper's answer was lost, its result is not on record, or the row could
 * not be read back): the address may or may not have been on the interface, and no job ran.
 */
export const HOST_ALIAS_REMOVE_REASON = ['EXPIRED', 'MANUAL', 'JOB_DONE', 'BOOT_SWEEP', 'SHUTDOWN', 'NOT_ADDED', 'ADD_UNCONFIRMED'] as const;
/** The role of one mic inside `AUDIO-01` (T-34; OD-01/OD-09). */
export const MIC_ROLE = ['PRIMARY', 'STANDBY'] as const;
/** Why a `session_audio_intervals` row opened or closed (T-34; R-3). */
export const AUDIO_INTERVAL_REASON = ['START', 'MANUAL', 'STOP'] as const;
/** The state of one sealing step (T-39; NM-07). */
export const SEALING_JOB_STATUS = ['RUNNING', 'DONE', 'FAILED'] as const;
/** The processing state of one transcript chunk (T-36; NM-06). */
export const TRANSCRIPT_CHUNK_STATUS = ['PENDING', 'RUNNING', 'DONE', 'FAILED'] as const;
/** Whether diarisation produced speaker labels (T-37/B.8; OD-15/OD-20). */
export const LABELS_STATUS = ['LABELLED', 'UNAVAILABLE'] as const;
/** The kind of an `evidence_tracks` row: one row per FILE in v2 (B.12; OD-01/OD-03). */
export const TRACK_KIND = ['FILE'] as const;
/**
 * The signature algorithms `evidence_items` may carry (C.4). `Ed25519` is what v2 seals sign with
 * now (OD-04/D4); `ECDSA-P256-SHA256` is the class-C TPM pre-declaration (C-8) so a hardware key
 * needs no further migration. The names are mixed-case by the contract, so this set is checked by
 * membership, never by the `CODE` format.
 */
export const SIGNATURE_ALGORITHM = ['SIMULATED-SHA256', 'Ed25519', 'ECDSA-P256-SHA256'] as const;
/** The algorithms a `transcript_revisions` row may carry: C.4 without the class-C pre-declaration (B.9). */
export const TRANSCRIPT_SIGNATURE_ALGORITHM = ['Ed25519', 'SIMULATED-SHA256'] as const;

// ─── Schema v2, R-8 (dbc-3 §B.13, D20; Q-STT-CFG confirmed at D24): the STT configuration sets ──

/**
 * The STT backends `stt_config` may name (T-40; §B.13, OD-24/D7). `omlx-server` is the development
 * engine on loopback HTTP, `cpu-local` the shipped whisper.cpp path. The names are lower-case with
 * a hyphen, so this set is checked by membership, never by the `CODE` format.
 */
export const STT_BACKEND = ['omlx-server', 'cpu-local'] as const;
/** How `stt_config` holds a server credential (§B.13): a pointer, or ciphertext + key reference. */
export const STT_CREDENTIAL_KIND = ['REFERENCE', 'ENCRYPTED'] as const;

/** The two counters of `registry_counters` (T-11) and the six of `engine_counters` (T-24). */
export const REGISTRY_COUNTER = ['device', 'pairingCode'] as const;
export const ENGINE_COUNTER = ['event', 'session', 'caseNumber', 'evidence', 'item', 'export'] as const;
export const TIME_FORMAT = ['24', '12'] as const;

/**
 * The 28 key names a payload map must not hold (contract §2.4 `NO_SECRET_KEYS`, §5.5; extended to
 * 25 by `dbc-3` §C.6 for the capture vocabulary: SEC35-22 closes the reserved hardening, RK-12 and
 * E-30 need it; extended to 28 by R-8/D20 for the STT credential names — §B.13 keeps `credential_ref`
 * out of the runtime SELECT, op 91's `credential.value` is write-only, and SEC35-14 keeps the server
 * API key out of the database entirely, so none of the three may ever name an audit or event key).
 * `credentialKind` is deliberately NOT on the list: op 90 returns it and `STT_CONFIG_CHANGED` may
 * carry `credentialChanged` — both are flags, never values. The list exists twice: in the CHECK
 * constraints built from this constant (the two sites `0001_tables.sql:199` and `:220`), and here as
 * the server constant the audit writer checks before it sends a row. The catalog test compares the two.
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
  'secret',
  'secretCiphertext',
  'ciphertext',
  'nonce',
  'keyRef',
  'onvifUuid',
  'signedUrl',
  'mediaUrl',
  // R-8 (D20): the STT credential names — ref target (§B.13), write-only value (C3 §2.5), API key (SEC35-14).
  'credentialRef',
  'credentialValue',
  'apiKey',
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
export type CaptureDeviceKindValue = (typeof CAPTURE_DEVICE_KIND)[number];
export type CaptureAdapterKindValue = (typeof CAPTURE_ADAPTER_KIND)[number];
export type CaptureSourceSlotValue = (typeof CAPTURE_SOURCE_SLOT)[number];
export type CaptureStreamRoleValue = (typeof CAPTURE_STREAM_ROLE)[number];
export type CaptureStreamCodecValue = (typeof CAPTURE_STREAM_CODEC)[number];
export type HostAliasReasonValue = (typeof HOST_ALIAS_REASON)[number];
export type HostAliasRemoveReasonValue = (typeof HOST_ALIAS_REMOVE_REASON)[number];
export type MicRoleValue = (typeof MIC_ROLE)[number];
export type AudioIntervalReasonValue = (typeof AUDIO_INTERVAL_REASON)[number];
export type SealingJobStatusValue = (typeof SEALING_JOB_STATUS)[number];
export type TranscriptChunkStatusValue = (typeof TRANSCRIPT_CHUNK_STATUS)[number];
export type LabelsStatusValue = (typeof LABELS_STATUS)[number];
export type TrackKindValue = (typeof TRACK_KIND)[number];
export type SignatureAlgorithmValue = (typeof SIGNATURE_ALGORITHM)[number];
export type TranscriptSignatureAlgorithmValue = (typeof TRANSCRIPT_SIGNATURE_ALGORITHM)[number];
export type SttBackendValue = (typeof STT_BACKEND)[number];
export type SttCredentialKindValue = (typeof STT_CREDENTIAL_KIND)[number];
export type RegistryCounterName = (typeof REGISTRY_COUNTER)[number];
export type EngineCounterName = (typeof ENGINE_COUNTER)[number];
export type TimeFormatValue = (typeof TIME_FORMAT)[number];

/** A flat detail map: the values are strings, numbers, booleans or null (`types.ts:68-69`). */
export type FlatJson = Record<string, string | number | boolean | null>;
