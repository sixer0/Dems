/**
 * Part C enumerations (research/01_explore.md L641-L666; masterplan/01_specs.md §2.3).
 *
 * Rules:
 * - Wire values are SCREAMING_SNAKE_CASE; spaces, slashes and hyphens become `_`.
 * - Each `…Label` map holds the design book's exact display text.
 * - IDs the book defines verbatim (`TrackId`) keep their exact form.
 * - Written as `const` objects plus union types (no TS `enum`; erasable syntax only).
 */

type ValueOf<T> = T[keyof T];

// §6.2 (FAULT and RECOVERY are demo assumptions, 01 G4)
export const SessionState = {
  CREATE: 'CREATE',
  PRECHECK: 'PRECHECK',
  ARMED: 'ARMED',
  RECORDING: 'RECORDING',
  STOPPING: 'STOPPING',
  FINALIZING: 'FINALIZING',
  SEALED: 'SEALED',
  FAULT: 'FAULT',
  RECOVERY: 'RECOVERY',
} as const;
export type SessionState = ValueOf<typeof SessionState>;
export const SessionStateLabel = {
  CREATE: 'CREATE',
  PRECHECK: 'PRECHECK',
  ARMED: 'ARMED',
  RECORDING: 'RECORDING',
  STOPPING: 'STOPPING',
  FINALIZING: 'FINALIZING',
  SEALED: 'SEALED',
  FAULT: 'FAULT',
  RECOVERY: 'RECOVERY',
} as const satisfies Record<SessionState, string>;

// §5.2
export const TabletScreen = {
  LOGIN: 'LOGIN',
  DASHBOARD: 'DASHBOARD',
  NEW_SESSION: 'NEW_SESSION',
  METADATA: 'METADATA',
  PRE_CHECK: 'PRE_CHECK',
  START: 'START',
  RECORDING_MONITOR: 'RECORDING_MONITOR',
  STOP: 'STOP',
  FINALIZATION: 'FINALIZATION',
  SESSION_SUMMARY: 'SESSION_SUMMARY',
} as const;
export type TabletScreen = ValueOf<typeof TabletScreen>;
export const TabletScreenLabel = {
  LOGIN: 'LOGIN',
  DASHBOARD: 'DASHBOARD',
  NEW_SESSION: 'NEW SESSION',
  METADATA: 'METADATA',
  PRE_CHECK: 'PRE-CHECK',
  START: 'START',
  RECORDING_MONITOR: 'RECORDING MONITOR',
  STOP: 'STOP',
  FINALIZATION: 'FINALIZATION',
  SESSION_SUMMARY: 'SESSION SUMMARY',
} as const satisfies Record<TabletScreen, string>;

// §5.3
export const CoreLinkState = { ONLINE: 'ONLINE', OFFLINE: 'OFFLINE' } as const;
export type CoreLinkState = ValueOf<typeof CoreLinkState>;
export const CoreLinkStateLabel = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
} as const satisfies Record<CoreLinkState, string>;

// §5.3
export const LensState = { READY: 'READY', FAULT: 'FAULT' } as const;
export type LensState = ValueOf<typeof LensState>;
export const LensStateLabel = { READY: 'READY', FAULT: 'FAULT' } as const satisfies Record<
  LensState,
  string
>;

// §5.3
export const MicState = { READY: 'READY', NO_SIGNAL: 'NO_SIGNAL', CLIP: 'CLIP' } as const;
export type MicState = ValueOf<typeof MicState>;
export const MicStateLabel = {
  READY: 'READY',
  NO_SIGNAL: 'NO SIGNAL',
  CLIP: 'CLIP',
} as const satisfies Record<MicState, string>;

// §5.3, §5.4
export const StorageState = { READY: 'READY', LOW: 'LOW', FULL: 'FULL' } as const;
export type StorageState = ValueOf<typeof StorageState>;
export const StorageStateLabel = {
  READY: 'READY',
  LOW: 'LOW',
  FULL: 'FULL',
} as const satisfies Record<StorageState, string>;
/** The recording screen (§5.4) shows storage READY as "OK". */
export const StorageRecordingLabel = {
  READY: 'OK',
  LOW: 'LOW',
  FULL: 'FULL',
} as const satisfies Record<StorageState, string>;

// §2.2, §5.3 (priority order GNSS > NTP > RTC)
export const TimeSource = { GNSS: 'GNSS', NTP: 'NTP', RTC: 'RTC' } as const;
export type TimeSource = ValueOf<typeof TimeSource>;
export const TimeSourceLabel = { GNSS: 'GNSS', NTP: 'NTP', RTC: 'RTC' } as const satisfies Record<
  TimeSource,
  string
>;
export const TIME_SOURCE_PRIORITY = [
  TimeSource.GNSS,
  TimeSource.NTP,
  TimeSource.RTC,
] as const satisfies readonly TimeSource[];

// §5.4 (the only value the book names, 01 G9)
export const TimeQuality = { LOCKED: 'LOCKED' } as const;
export type TimeQuality = ValueOf<typeof TimeQuality>;
export const TimeQualityLabel = { LOCKED: 'LOCKED' } as const satisfies Record<TimeQuality, string>;

// §5.3
export const SecurityState = { READY: 'READY', FAULT: 'FAULT' } as const;
export type SecurityState = ValueOf<typeof SecurityState>;
export const SecurityStateLabel = { READY: 'READY', FAULT: 'FAULT' } as const satisfies Record<
  SecurityState,
  string
>;

// §6.3, §11.1 (verbatim IDs)
export const TrackId = {
  VIDEO_01: 'VIDEO-01',
  VIDEO_02: 'VIDEO-02',
  AUDIO_01: 'AUDIO-01',
  AUDIO_02: 'AUDIO-02',
} as const;
export type TrackId = ValueOf<typeof TrackId>;
export type VideoTrackId = typeof TrackId.VIDEO_01 | typeof TrackId.VIDEO_02;
export type AudioTrackId = typeof TrackId.AUDIO_01 | typeof TrackId.AUDIO_02;

// §5.4, §23.1
export const TrackRecState = { REC: 'REC', DEGRADED: 'DEGRADED', LOST: 'LOST' } as const;
export type TrackRecState = ValueOf<typeof TrackRecState>;
export const TrackRecStateLabel = {
  REC: 'REC',
  DEGRADED: 'DEGRADED',
  LOST: 'LOST',
} as const satisfies Record<TrackRecState, string>;

// EVT-01
export const DeviceReadiness = { READY: 'READY' } as const;
export type DeviceReadiness = ValueOf<typeof DeviceReadiness>;
export const DeviceReadinessLabel = { READY: 'READY' } as const satisfies Record<
  DeviceReadiness,
  string
>;

// §18.1
export const PowerFailState = {
  NORMAL: 'NORMAL',
  POWER_FAIL_DETECTED: 'POWER_FAIL_DETECTED',
  RECORDING_RECOVERY_MARKER_WRITTEN: 'RECORDING_RECOVERY_MARKER_WRITTEN',
  FLUSH_MEDIA_AND_METADATA: 'FLUSH_MEDIA_AND_METADATA',
  STORAGE_SYNC: 'STORAGE_SYNC',
  SAFE_SHUTDOWN: 'SAFE_SHUTDOWN',
  POWER_OFF: 'POWER_OFF',
} as const;
export type PowerFailState = ValueOf<typeof PowerFailState>;
export const PowerFailStateLabel = {
  NORMAL: 'NORMAL',
  POWER_FAIL_DETECTED: 'POWER_FAIL_DETECTED',
  RECORDING_RECOVERY_MARKER_WRITTEN: 'RECORDING_RECOVERY_MARKER_WRITTEN',
  FLUSH_MEDIA_AND_METADATA: 'FLUSH_MEDIA_AND_METADATA',
  STORAGE_SYNC: 'STORAGE_SYNC',
  SAFE_SHUTDOWN: 'SAFE_SHUTDOWN',
  POWER_OFF: 'POWER_OFF',
} as const satisfies Record<PowerFailState, string>;

// §18.1
export const BootRecoveryState = {
  RECOVERY_SCAN: 'RECOVERY_SCAN',
  INCOMPLETE_SESSION_ANALYSIS: 'INCOMPLETE_SESSION_ANALYSIS',
} as const;
export type BootRecoveryState = ValueOf<typeof BootRecoveryState>;
export const BootRecoveryStateLabel = {
  RECOVERY_SCAN: 'RECOVERY_SCAN',
  INCOMPLETE_SESSION_ANALYSIS: 'INCOMPLETE_SESSION_ANALYSIS',
} as const satisfies Record<BootRecoveryState, string>;

// §19.1
export const EvidenceLifecycleStage = {
  CAPTURE: 'CAPTURE',
  RECORDING: 'RECORDING',
  FINALIZING: 'FINALIZING',
  HASH: 'HASH',
  MANIFEST: 'MANIFEST',
  ENCRYPT: 'ENCRYPT',
  SIGN: 'SIGN',
  SEALED_LOCAL_EVIDENCE: 'SEALED_LOCAL_EVIDENCE',
  AUTHORIZED_REVIEW: 'AUTHORIZED_REVIEW',
  AUTHORIZED_EXPORT_TRANSFER: 'AUTHORIZED_EXPORT_TRANSFER',
  DESTINATION_VERIFICATION: 'DESTINATION_VERIFICATION',
  RETENTION_ARCHIVE_DISPOSITION: 'RETENTION_ARCHIVE_DISPOSITION',
} as const;
export type EvidenceLifecycleStage = ValueOf<typeof EvidenceLifecycleStage>;
export const EvidenceLifecycleStageLabel = {
  CAPTURE: 'CAPTURE',
  RECORDING: 'RECORDING',
  FINALIZING: 'FINALIZING',
  HASH: 'HASH',
  MANIFEST: 'MANIFEST',
  ENCRYPT: 'ENCRYPT',
  SIGN: 'SIGN',
  SEALED_LOCAL_EVIDENCE: 'SEALED LOCAL EVIDENCE',
  AUTHORIZED_REVIEW: 'AUTHORIZED REVIEW',
  AUTHORIZED_EXPORT_TRANSFER: 'AUTHORIZED EXPORT / TRANSFER',
  DESTINATION_VERIFICATION: 'DESTINATION VERIFICATION',
  RETENTION_ARCHIVE_DISPOSITION: 'RETENTION / ARCHIVE / DISPOSITION',
} as const satisfies Record<EvidenceLifecycleStage, string>;

// §12.2
export const FinalizationStep = {
  FINALIZE_TRACKS: 'FINALIZE_TRACKS',
  CALCULATE_HASHES: 'CALCULATE_HASHES',
  BUILD_MANIFEST: 'BUILD_MANIFEST',
  ENCRYPT_PAYLOAD: 'ENCRYPT_PAYLOAD',
  SIGN_MANIFEST: 'SIGN_MANIFEST',
  STORE_SEALED_PACKAGE: 'STORE_SEALED_PACKAGE',
} as const;
export type FinalizationStep = ValueOf<typeof FinalizationStep>;
export const FinalizationStepLabel = {
  FINALIZE_TRACKS: 'Finalize tracks',
  CALCULATE_HASHES: 'Calculate hashes',
  BUILD_MANIFEST: 'Build manifest',
  ENCRYPT_PAYLOAD: 'Encrypt evidence payload',
  SIGN_MANIFEST: 'Sign manifest',
  STORE_SEALED_PACKAGE: 'Store sealed evidence package',
} as const satisfies Record<FinalizationStep, string>;

// §20.2 (labels: 01 L659)
export const UpdateStep = {
  SIGNATURE_VERIFICATION: 'SIGNATURE_VERIFICATION',
  COMPATIBILITY_CHECK: 'COMPATIBILITY_CHECK',
  ANTI_ROLLBACK_POLICY: 'ANTI_ROLLBACK_POLICY',
  INSTALL_INACTIVE_SLOT: 'INSTALL_INACTIVE_SLOT',
  REBOOT: 'REBOOT',
  POST_BOOT_HEALTH_CHECK: 'POST_BOOT_HEALTH_CHECK',
} as const;
export type UpdateStep = ValueOf<typeof UpdateStep>;
export const UpdateStepLabel = {
  SIGNATURE_VERIFICATION: 'Signature Verification',
  COMPATIBILITY_CHECK: 'Compatibility / Hardware-Revision Check',
  ANTI_ROLLBACK_POLICY: 'Anti-Rollback Policy',
  INSTALL_INACTIVE_SLOT: 'Install to INACTIVE System Slot',
  REBOOT: 'Reboot',
  POST_BOOT_HEALTH_CHECK: 'Post-Boot Health Check',
} as const satisfies Record<UpdateStep, string>;

// §20.2
export const UpdateOutcome = { PASS: 'PASS', FAIL: 'FAIL' } as const;
export type UpdateOutcome = ValueOf<typeof UpdateOutcome>;
export const UpdateOutcomeLabel = { PASS: 'PASS', FAIL: 'FAIL' } as const satisfies Record<
  UpdateOutcome,
  string
>;

// §20.3
export const SystemSlot = { A: 'A', B: 'B' } as const;
export type SystemSlot = ValueOf<typeof SystemSlot>;
export const SystemSlotLabel = { A: 'A', B: 'B' } as const satisfies Record<SystemSlot, string>;

// §3 A.34, §4.2
export const Led = {
  POWER: 'POWER',
  REC: 'REC',
  NET: 'NET',
  STORAGE: 'STORAGE',
  FAULT: 'FAULT',
} as const;
export type Led = ValueOf<typeof Led>;
export const LedLabel = {
  POWER: 'POWER',
  REC: 'REC',
  NET: 'NET',
  STORAGE: 'STORAGE',
  FAULT: 'FAULT',
} as const satisfies Record<Led, string>;
/** Long labels the book also uses (REC/RECORD, NET/NETWORK). */
export const LedLongLabel = {
  POWER: 'POWER',
  REC: 'RECORD',
  NET: 'NETWORK',
  STORAGE: 'STORAGE',
  FAULT: 'FAULT',
} as const satisfies Record<Led, string>;

// §3 A.33
export const LcdButton = { UP: 'UP', DOWN: 'DOWN', ENTER: 'ENTER', BACK: 'BACK' } as const;
export type LcdButton = ValueOf<typeof LcdButton>;
export const LcdButtonLabel = {
  UP: 'UP',
  DOWN: 'DOWN',
  ENTER: 'ENTER',
  BACK: 'BACK',
} as const satisfies Record<LcdButton, string>;

// §21.1
export const NetworkDomain = {
  CAMERA: 'CAMERA',
  MANAGEMENT: 'MANAGEMENT',
  SERVICE_UPDATE: 'SERVICE_UPDATE',
  EXPORT_TRANSFER: 'EXPORT_TRANSFER',
} as const;
export type NetworkDomain = ValueOf<typeof NetworkDomain>;
export const NetworkDomainLabel = {
  CAMERA: 'Camera',
  MANAGEMENT: 'Management',
  SERVICE_UPDATE: 'Service/Update',
  EXPORT_TRANSFER: 'Export/Transfer',
} as const satisfies Record<NetworkDomain, string>;

// §6.1, §21.2
export const HealthCategory = {
  CPU: 'CPU',
  STORAGE: 'STORAGE',
  FAN: 'FAN',
  NETWORK: 'NETWORK',
  CAMERA: 'CAMERA',
  AUDIO: 'AUDIO',
  TIME: 'TIME',
  SECURITY: 'SECURITY',
} as const;
export type HealthCategory = ValueOf<typeof HealthCategory>;
export const HealthCategoryLabel = {
  CPU: 'CPU',
  STORAGE: 'STORAGE',
  FAN: 'FAN',
  NETWORK: 'NETWORK',
  CAMERA: 'CAMERA',
  AUDIO: 'AUDIO',
  TIME: 'TIME',
  SECURITY: 'SECURITY',
} as const satisfies Record<HealthCategory, string>;

// 01 L665
export const AuditEventKind = {
  AUTHENTICATION: 'AUTHENTICATION',
  TRACK_HEALTH: 'TRACK_HEALTH',
  AUDIT: 'AUDIT',
  EXPORT: 'EXPORT',
  TAMPER: 'TAMPER',
  AUDIO_CLIP: 'AUDIO_CLIP',
  SOURCE_FAULT: 'SOURCE_FAULT',
  POWER_FAIL: 'POWER_FAIL',
  WATCHDOG_RECOVERY: 'WATCHDOG_RECOVERY',
  UNAUTHORIZED_EXPORT: 'UNAUTHORIZED_EXPORT',
  AUDIT_CHAIN_DISCONTINUITY: 'AUDIT_CHAIN_DISCONTINUITY',
  GAIN_PHANTOM_CHANGE: 'GAIN_PHANTOM_CHANGE',
  PROVISIONING: 'PROVISIONING',
  CONFIG_DRIFT: 'CONFIG_DRIFT',
} as const;
export type AuditEventKind = ValueOf<typeof AuditEventKind>;
export const AuditEventKindLabel = {
  AUTHENTICATION: 'AUTHENTICATION',
  TRACK_HEALTH: 'TRACK_HEALTH',
  AUDIT: 'AUDIT',
  EXPORT: 'EXPORT',
  TAMPER: 'TAMPER',
  AUDIO_CLIP: 'AUDIO_CLIP',
  SOURCE_FAULT: 'SOURCE_FAULT',
  POWER_FAIL: 'POWER_FAIL',
  WATCHDOG_RECOVERY: 'WATCHDOG_RECOVERY',
  UNAUTHORIZED_EXPORT: 'UNAUTHORIZED_EXPORT',
  AUDIT_CHAIN_DISCONTINUITY: 'AUDIT_CHAIN_DISCONTINUITY',
  GAIN_PHANTOM_CHANGE: 'GAIN_PHANTOM_CHANGE',
  PROVISIONING: 'PROVISIONING',
  CONFIG_DRIFT: 'CONFIG_DRIFT',
} as const satisfies Record<AuditEventKind, string>;

// Client-side connection state (not from the book; §2.6)
export const HeartbeatState = {
  CONNECTING: 'CONNECTING',
  LIVE: 'LIVE',
  STALE: 'STALE',
  OFFLINE: 'OFFLINE',
} as const;
export type HeartbeatState = ValueOf<typeof HeartbeatState>;
export const HeartbeatStateLabel = {
  CONNECTING: 'Connecting',
  LIVE: 'Live',
  STALE: 'Stale',
  OFFLINE: 'Offline',
} as const satisfies Record<HeartbeatState, string>;
