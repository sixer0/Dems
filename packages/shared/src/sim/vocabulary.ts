/**
 * Simulator vocabulary: the closed value sets the store, the actions and the UI share
 * (masterplan/01_specs.md §14.5-§14.8; 04_mobile_specs.md §4-§6; D28).
 *
 * Same rules as `domain/enums.ts`:
 * - `const` objects plus union types (no TS `enum`; erasable syntax only).
 * - Wire values are SCREAMING_SNAKE_CASE unless the value is a fixed display ID.
 * - Book-sourced enums (SessionState, MicState, …) stay in `domain/enums.ts`; this file only
 *   holds what the demo itself defines (roles, audit types, fault kinds, …), each a demo
 *   assumption where the book is silent (01 G1, G4, G8).
 */

type ValueOf<T> = T[keyof T];

// ── Identity and RBAC (§14.7 dataset "Roles", demo assumption 01 G1) ────────────────────
export const OperatorRole = {
  INVESTIGATOR: 'INVESTIGATOR',
  SUPERVISOR: 'SUPERVISOR',
  TECHNICIAN: 'TECHNICIAN',
} as const;
export type OperatorRole = ValueOf<typeof OperatorRole>;

export const Permission = {
  SESSION_START: 'SESSION_START',
  SESSION_NOTE: 'SESSION_NOTE',
  EVIDENCE_VIEW: 'EVIDENCE_VIEW',
  EVIDENCE_REVIEW: 'EVIDENCE_REVIEW',
  EVIDENCE_EXPORT: 'EVIDENCE_EXPORT',
  AUDIT_EXPORT: 'AUDIT_EXPORT',
  DEVICE_MANAGE: 'DEVICE_MANAGE',
  DIAGNOSTICS_RUN: 'DIAGNOSTICS_RUN',
  MAINTENANCE: 'MAINTENANCE',
  // Backend task W16 (2026-10-04 01_specs §4.3, §19.1; ADQ-9): additive. The Core server enforces
  // these three; no simulator action checks them. SUPERVISOR holds all three (`auth.ts`).
  PAIRING_MANAGE: 'PAIRING_MANAGE',
  USER_ADMIN: 'USER_ADMIN',
  DEMO_CONTROL: 'DEMO_CONTROL',
} as const;
export type Permission = ValueOf<typeof Permission>;

export const AuthMethod = {
  PASSWORD: 'PASSWORD',
  BIOMETRIC: 'BIOMETRIC',
  SECURITY_KEY: 'SECURITY_KEY',
} as const;
export type AuthMethod = ValueOf<typeof AuthMethod>;

export const AuthStatus = {
  SIGNED_OUT: 'SIGNED_OUT',
  SIGNED_IN: 'SIGNED_IN',
  EXPIRED: 'EXPIRED',
} as const;
export type AuthStatus = ValueOf<typeof AuthStatus>;

/** Why a signed-in operator left: the avatar menu (USER), "Lock console" (LOCK). */
export const SignOutReason = { USER: 'USER', LOCK: 'LOCK' } as const;
export type SignOutReason = ValueOf<typeof SignOutReason>;

// ── Session input (§14.5.11 step 1; D28/Q3: Indonesian domain terms verbatim) ──────────
export const SubjectType = {
  TERSANGKA: 'TERSANGKA',
  SAKSI: 'SAKSI',
  LAINNYA: 'LAINNYA',
} as const;
export type SubjectType = ValueOf<typeof SubjectType>;
/** Display text (ID terms verbatim). The UI takes copy from i18n; these are the fallbacks. */
export const SubjectTypeLabel = {
  TERSANGKA: 'Tersangka',
  SAKSI: 'Saksi',
  LAINNYA: 'Lainnya',
} as const satisfies Record<SubjectType, string>;
/** EN gloss for tooltips and accessibility hints. */
export const SubjectTypeGloss = {
  TERSANGKA: 'Suspect',
  SAKSI: 'Witness',
  LAINNYA: 'Other',
} as const satisfies Record<SubjectType, string>;

export const RecordingProfileId = { STANDARD_1080P25: 'STANDARD_1080P25' } as const;
export type RecordingProfileId = ValueOf<typeof RecordingProfileId>;

// ── Session outcomes and precheck (§5.3, §14.5.11 step 2) ───────────────────────────────
/** How a past session ended. INCOMPLETE sessions are never sealed (SYS-008). */
export const SessionOutcome = { SEALED: 'SEALED', INCOMPLETE: 'INCOMPLETE' } as const;
export type SessionOutcome = ValueOf<typeof SessionOutcome>;

/** The 8 §5.3 gate checks, in display order. */
export const PrecheckCheckId = {
  CORE: 'CORE',
  LENS_1: 'LENS_1',
  LENS_2: 'LENS_2',
  MIC_1: 'MIC_1',
  MIC_2: 'MIC_2',
  STORAGE: 'STORAGE',
  TIME: 'TIME',
  SECURITY: 'SECURITY',
} as const;
export type PrecheckCheckId = ValueOf<typeof PrecheckCheckId>;
export const PRECHECK_ORDER = [
  PrecheckCheckId.CORE,
  PrecheckCheckId.LENS_1,
  PrecheckCheckId.LENS_2,
  PrecheckCheckId.MIC_1,
  PrecheckCheckId.MIC_2,
  PrecheckCheckId.STORAGE,
  PrecheckCheckId.TIME,
  PrecheckCheckId.SECURITY,
] as const satisfies readonly PrecheckCheckId[];

/** Per-check status: PENDING and RUNNING while resolving, then PASS, WARN or BLOCK. */
export const PrecheckStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  PASS: 'PASS',
  WARN: 'WARN',
  BLOCK: 'BLOCK',
} as const;
export type PrecheckStatus = ValueOf<typeof PrecheckStatus>;

/** Stepper-compatible status (01_specs §14.6 Stepper contract). */
export const StepStatus = {
  pending: 'pending',
  active: 'active',
  done: 'done',
  warn: 'warn',
  error: 'error',
} as const;
export type StepStatus = ValueOf<typeof StepStatus>;

/** SessionTimeline kinds (01_specs §14.6). */
export const TimelineKind = {
  START: 'START',
  NOTE: 'NOTE',
  AUDIO_PEAK: 'AUDIO_PEAK',
  HEALTH: 'HEALTH',
  AUTOSAVE: 'AUTOSAVE',
  CHECK: 'CHECK',
  MARKER: 'MARKER',
  SNAPSHOT: 'SNAPSHOT',
  FAULT: 'FAULT',
} as const;
export type TimelineKind = ValueOf<typeof TimelineKind>;

// ── Evidence (04 §9 #10, #11, #28; D28/Q4) ───────────────────────────────────────────────
export const EvidenceStatus = {
  RECORDED: 'RECORDED',
  SEALED: 'SEALED',
  EXPORTED: 'EXPORTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  ARCHIVED: 'ARCHIVED',
} as const;
export type EvidenceStatus = ValueOf<typeof EvidenceStatus>;
export const EvidenceStatusLabel = {
  RECORDED: 'Recorded',
  SEALED: 'Sealed',
  EXPORTED: 'Exported',
  UNDER_REVIEW: 'Under Review',
  ARCHIVED: 'Archived',
} as const satisfies Record<EvidenceStatus, string>;

export const VerificationStatus = { NOT_RUN: 'NOT_RUN', PASS: 'PASS', FAIL: 'FAIL' } as const;
export type VerificationStatus = ValueOf<typeof VerificationStatus>;

// ── Severity and alerts ──────────────────────────────────────────────────────────────────
export const Severity = {
  INFO: 'INFO',
  SUCCESS: 'SUCCESS',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
} as const;
export type Severity = ValueOf<typeof Severity>;

/** Dashboard GlowRing states (01_specs §14.6), derived by `selectSystemState`. */
export const SystemState = {
  READY: 'READY',
  ATTENTION: 'ATTENTION',
  CRITICAL: 'CRITICAL',
  UNKNOWN: 'UNKNOWN',
  RECORDING: 'RECORDING',
} as const;
export type SystemState = ValueOf<typeof SystemState>;

/** Security & Audit posture shield (01_specs §14.5.7). */
export const SecurityPosture = {
  SECURE: 'SECURE',
  ATTENTION: 'ATTENTION',
  CRITICAL: 'CRITICAL',
  UNKNOWN: 'UNKNOWN',
} as const;
export type SecurityPosture = ValueOf<typeof SecurityPosture>;

// ── Faults (§14.7 `faults.ts`; EVT and FMEA keyed) ──────────────────────────────────────
export const FaultKind = {
  CAMERA_LOSS: 'CAMERA_LOSS',
  MIC_NO_SIGNAL: 'MIC_NO_SIGNAL',
  MIC_CLIP: 'MIC_CLIP',
  STORAGE_LOW: 'STORAGE_LOW',
  STORAGE_FULL: 'STORAGE_FULL',
  GNSS_LOSS: 'GNSS_LOSS',
  TAMPER: 'TAMPER',
  FAN_STALL: 'FAN_STALL',
  POWER_FAIL: 'POWER_FAIL',
  TPM_FAILURE: 'TPM_FAILURE',
  SECURITY_FAULT: 'SECURITY_FAULT',
  AUDIT_TAMPER: 'AUDIT_TAMPER',
} as const;
export type FaultKind = ValueOf<typeof FaultKind>;
/** Faults that move PRECHECK, ARMED, RECORDING or FINALIZING to FAULT (§14.7 machine table). */
export const CRITICAL_FAULTS = [
  FaultKind.STORAGE_FULL,
  FaultKind.TPM_FAILURE,
  FaultKind.POWER_FAIL,
  FaultKind.SECURITY_FAULT,
] as const satisfies readonly FaultKind[];
/** The EVT test IDs each fault is keyed to (§14.7 `faults.ts`). */
export const FaultEvt = {
  CAMERA_LOSS: 'EVT-04',
  MIC_NO_SIGNAL: 'EVT-05/06',
  MIC_CLIP: 'EVT-07',
  STORAGE_LOW: 'EVT-08',
  STORAGE_FULL: 'EVT-08',
  GNSS_LOSS: 'EVT-10',
  TAMPER: 'EVT-12',
  FAN_STALL: 'EVT-24',
  POWER_FAIL: 'EVT-21',
  TPM_FAILURE: 'EVT-12',
  SECURITY_FAULT: 'EVT-12',
  AUDIT_TAMPER: 'EVT-30',
} as const satisfies Record<FaultKind, string>;

// ── Scenarios (§14.7 `scenarios.ts`) ────────────────────────────────────────────────────
export const ScenarioName = {
  IDLE: 'idle',
  RECORDING: 'recording',
  FINALIZING: 'finalizing',
  FAULT_DEMO: 'fault-demo',
} as const;
export type ScenarioName = ValueOf<typeof ScenarioName>;

// ── Pairing and the tablet link (SCR-02; 04 §4.2, §4.12) ────────────────────────────────
export const PairingState = {
  UNPAIRED: 'UNPAIRED',
  PAIRED: 'PAIRED',
  FAILED: 'FAILED',
} as const;
export type PairingState = ValueOf<typeof PairingState>;

export const TabletLinkState = { CONNECTED: 'CONNECTED', OFFLINE: 'OFFLINE' } as const;
export type TabletLinkState = ValueOf<typeof TabletLinkState>;

// ── Devices, services, maintenance ───────────────────────────────────────────────────────
export const ServiceStatus = { RUNNING: 'RUNNING', DEGRADED: 'DEGRADED', STOPPED: 'STOPPED' } as const;
export type ServiceStatus = ValueOf<typeof ServiceStatus>;

/**
 * Simulated device commands. IDENTIFY (step 54, SIM-GAP-W48-5) blinks the device's indicator and
 * writes a DEVICE_COMMAND audit row; it is accepted by every device, including the derived
 * platform devices (GNSS, TPM, FRONT-PANEL).
 */
export const DeviceCommand = { TEST_SIGNAL: 'TEST_SIGNAL', RESTART: 'RESTART', IDENTIFY: 'IDENTIFY' } as const;
export type DeviceCommand = ValueOf<typeof DeviceCommand>;

export const DiagnosticStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  PASS: 'PASS',
  WARN: 'WARN',
  FAIL: 'FAIL',
} as const;
export type DiagnosticStatus = ValueOf<typeof DiagnosticStatus>;

export const UpdateState = { IDLE: 'IDLE', RUNNING: 'RUNNING', PASS: 'PASS', FAIL: 'FAIL' } as const;
export type UpdateState = ValueOf<typeof UpdateState>;

export const RetentionPolicyId = {
  DAYS_30: 'DAYS_30',
  DAYS_90: 'DAYS_90',
  YEAR_1: 'YEAR_1',
  CASE_CLOSURE: 'CASE_CLOSURE',
} as const;
export type RetentionPolicyId = ValueOf<typeof RetentionPolicyId>;

// ── Audit (§14.7 `events.ts`; §14.8 auth rows; 04 §4.16 categories) ─────────────────────
export const AuditCategory = {
  AUTH: 'AUTH',
  SESSION: 'SESSION',
  EVIDENCE: 'EVIDENCE',
  DEVICE: 'DEVICE',
  SECURITY: 'SECURITY',
  STORAGE: 'STORAGE',
  PAIRING: 'PAIRING',
  SYSTEM: 'SYSTEM',
} as const;
export type AuditCategory = ValueOf<typeof AuditCategory>;

export const AuditType = {
  // Auth (§14.8)
  AUTH_SUCCESS: 'AUTH_SUCCESS',
  AUTH_FAILED: 'AUTH_FAILED',
  AUTH_LOCKED: 'AUTH_LOCKED',
  AUTH_SIGNED_OUT: 'AUTH_SIGNED_OUT',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  // Session machine (§14.7 table)
  SESSION_CREATED: 'SESSION_CREATED',
  PRECHECK_PASSED: 'PRECHECK_PASSED',
  PRECHECK_BLOCKED: 'PRECHECK_BLOCKED',
  RECORDING_STARTED: 'RECORDING_STARTED',
  RECORDING_STOPPED: 'RECORDING_STOPPED',
  SESSION_CANCELLED: 'SESSION_CANCELLED',
  EVIDENCE_SEALED: 'EVIDENCE_SEALED',
  SESSION_INCOMPLETE: 'SESSION_INCOMPLETE',
  SUMMARY_ACKNOWLEDGED: 'SUMMARY_ACKNOWLEDGED',
  MARKER_ADDED: 'MARKER_ADDED',
  NOTE_ADDED: 'NOTE_ADDED',
  SNAPSHOT_TAKEN: 'SNAPSHOT_TAKEN',
  // Recording integrity stream (§14.7 "Rates")
  FRAME_HASH: 'FRAME_HASH',
  WRITE_VERIFIED: 'WRITE_VERIFIED',
  TIMESTAMP_CONFIRMED: 'TIMESTAMP_CONFIRMED',
  // Evidence (§19, EVT-13/14/25/26)
  EVIDENCE_VERIFIED: 'EVIDENCE_VERIFIED',
  EVIDENCE_VERIFY_FAILED: 'EVIDENCE_VERIFY_FAILED',
  EVIDENCE_REVIEW_OPENED: 'EVIDENCE_REVIEW_OPENED',
  EVIDENCE_EXPORTED: 'EVIDENCE_EXPORTED',
  EXPORT_DENIED: 'EXPORT_DENIED',
  EVIDENCE_ARCHIVED: 'EVIDENCE_ARCHIVED',
  AUDIT_EXPORTED: 'AUDIT_EXPORTED',
  // Faults and recovery (§6.4, §18)
  FAULT_RAISED: 'FAULT_RAISED',
  FAULT_CLEARED: 'FAULT_CLEARED',
  RECOVERY_STARTED: 'RECOVERY_STARTED',
  RECOVERY_COMPLETED: 'RECOVERY_COMPLETED',
  AUDIT_CHAIN_DISCONTINUITY: 'AUDIT_CHAIN_DISCONTINUITY',
  // Pairing (SCR-02)
  PAIRING_SUCCESS: 'PAIRING_SUCCESS',
  PAIRING_FAILED: 'PAIRING_FAILED',
  PAIRING_LOCKED: 'PAIRING_LOCKED',
  UNPAIRED: 'UNPAIRED',
  // Devices, storage, maintenance
  TABLET_LINK_CHANGED: 'TABLET_LINK_CHANGED',
  DEVICE_COMMAND: 'DEVICE_COMMAND',
  DIAGNOSTICS_RUN: 'DIAGNOSTICS_RUN',
  STORAGE_POLICY_CHANGED: 'STORAGE_POLICY_CHANGED',
  UPDATE_STARTED: 'UPDATE_STARTED',
  UPDATE_COMPLETED: 'UPDATE_COMPLETED',
  SCENARIO_LOADED: 'SCENARIO_LOADED',
  SYSTEM_BOOT: 'SYSTEM_BOOT',
  // Backend task W16 (2026-10-04 01_specs §13.1, §19.2; ADQ-9): additive. Written by the Core
  // server only (permission guard, pairing, user administration, identity); the simulator never
  // emits them. "Device paired" stays PAIRING_SUCCESS.
  ACCESS_DENIED: 'ACCESS_DENIED',
  PAIRING_CODE_ISSUED: 'PAIRING_CODE_ISSUED',
  PAIRING_CODE_CLOSED: 'PAIRING_CODE_CLOSED',
  DEVICE_REVOKED: 'DEVICE_REVOKED',
  DEVICE_CREDENTIAL_ROTATED: 'DEVICE_CREDENTIAL_ROTATED',
  ROLE_CHANGED: 'ROLE_CHANGED',
  USER_ENABLED: 'USER_ENABLED',
  USER_DISABLED: 'USER_DISABLED',
  BIOMETRIC_ENROLLMENT_CHANGED: 'BIOMETRIC_ENROLLMENT_CHANGED',
} as const;
export type AuditType = ValueOf<typeof AuditType>;

/** Category of every audit type (filters in Security & Audit and the mobile Audit view). */
export const AUDIT_TYPE_CATEGORY = {
  AUTH_SUCCESS: 'AUTH',
  AUTH_FAILED: 'AUTH',
  AUTH_LOCKED: 'AUTH',
  AUTH_SIGNED_OUT: 'AUTH',
  AUTH_EXPIRED: 'AUTH',
  SESSION_CREATED: 'SESSION',
  PRECHECK_PASSED: 'SESSION',
  PRECHECK_BLOCKED: 'SESSION',
  RECORDING_STARTED: 'SESSION',
  RECORDING_STOPPED: 'SESSION',
  SESSION_CANCELLED: 'SESSION',
  EVIDENCE_SEALED: 'EVIDENCE',
  SESSION_INCOMPLETE: 'SESSION',
  SUMMARY_ACKNOWLEDGED: 'SESSION',
  MARKER_ADDED: 'SESSION',
  NOTE_ADDED: 'SESSION',
  SNAPSHOT_TAKEN: 'SESSION',
  FRAME_HASH: 'EVIDENCE',
  WRITE_VERIFIED: 'STORAGE',
  TIMESTAMP_CONFIRMED: 'SECURITY',
  EVIDENCE_VERIFIED: 'EVIDENCE',
  EVIDENCE_VERIFY_FAILED: 'EVIDENCE',
  EVIDENCE_REVIEW_OPENED: 'EVIDENCE',
  EVIDENCE_EXPORTED: 'EVIDENCE',
  EXPORT_DENIED: 'SECURITY',
  EVIDENCE_ARCHIVED: 'EVIDENCE',
  AUDIT_EXPORTED: 'SECURITY',
  FAULT_RAISED: 'DEVICE',
  FAULT_CLEARED: 'DEVICE',
  RECOVERY_STARTED: 'SYSTEM',
  RECOVERY_COMPLETED: 'SYSTEM',
  AUDIT_CHAIN_DISCONTINUITY: 'SECURITY',
  PAIRING_SUCCESS: 'PAIRING',
  PAIRING_FAILED: 'PAIRING',
  PAIRING_LOCKED: 'PAIRING',
  UNPAIRED: 'PAIRING',
  TABLET_LINK_CHANGED: 'DEVICE',
  DEVICE_COMMAND: 'DEVICE',
  DIAGNOSTICS_RUN: 'DEVICE',
  STORAGE_POLICY_CHANGED: 'STORAGE',
  UPDATE_STARTED: 'SYSTEM',
  UPDATE_COMPLETED: 'SYSTEM',
  SCENARIO_LOADED: 'SYSTEM',
  SYSTEM_BOOT: 'SYSTEM',
  // Backend task W16: the nine server-written types, in the existing eight categories (§13.1).
  ACCESS_DENIED: 'SECURITY',
  PAIRING_CODE_ISSUED: 'PAIRING',
  PAIRING_CODE_CLOSED: 'PAIRING',
  DEVICE_REVOKED: 'PAIRING',
  DEVICE_CREDENTIAL_ROTATED: 'PAIRING',
  ROLE_CHANGED: 'SECURITY',
  USER_ENABLED: 'SECURITY',
  USER_DISABLED: 'SECURITY',
  BIOMETRIC_ENROLLMENT_CHANGED: 'AUTH',
} as const satisfies Record<AuditType, AuditCategory>;

// ── Operational events (Recent Events, bell, timeline sources) ──────────────────────────
export const SimEventType = {
  SYSTEM_BOOT: 'SYSTEM_BOOT',
  HEALTH_CHECK_OK: 'HEALTH_CHECK_OK',
  TIME_SYNC: 'TIME_SYNC',
  AUTH_LOGIN: 'AUTH_LOGIN',
  AUTH_LOGOUT: 'AUTH_LOGOUT',
  AUTH_FAILED: 'AUTH_FAILED',
  AUTH_LOCKED: 'AUTH_LOCKED',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  SESSION_CREATED: 'SESSION_CREATED',
  PRECHECK_STARTED: 'PRECHECK_STARTED',
  PRECHECK_PASSED: 'PRECHECK_PASSED',
  PRECHECK_BLOCKED: 'PRECHECK_BLOCKED',
  RECORDING_STARTED: 'RECORDING_STARTED',
  RECORDING_STOPPED: 'RECORDING_STOPPED',
  SESSION_CANCELLED: 'SESSION_CANCELLED',
  FINALIZATION_STARTED: 'FINALIZATION_STARTED',
  EVIDENCE_SEALED: 'EVIDENCE_SEALED',
  SESSION_INCOMPLETE: 'SESSION_INCOMPLETE',
  EVIDENCE_EXPORTED: 'EVIDENCE_EXPORTED',
  EXPORT_DENIED: 'EXPORT_DENIED',
  EVIDENCE_VERIFIED: 'EVIDENCE_VERIFIED',
  EVIDENCE_VERIFY_FAILED: 'EVIDENCE_VERIFY_FAILED',
  EVIDENCE_REVIEW: 'EVIDENCE_REVIEW',
  EVIDENCE_ARCHIVED: 'EVIDENCE_ARCHIVED',
  MARKER_ADDED: 'MARKER_ADDED',
  NOTE_ADDED: 'NOTE_ADDED',
  SNAPSHOT_TAKEN: 'SNAPSHOT_TAKEN',
  AUTOSAVE: 'AUTOSAVE',
  FAULT_RAISED: 'FAULT_RAISED',
  FAULT_CLEARED: 'FAULT_CLEARED',
  RECOVERY_STARTED: 'RECOVERY_STARTED',
  RECOVERY_COMPLETED: 'RECOVERY_COMPLETED',
  STORAGE_WRITE_VERIFIED: 'STORAGE_WRITE_VERIFIED',
  STORAGE_POLICY_CHANGED: 'STORAGE_POLICY_CHANGED',
  DIAGNOSTICS_STARTED: 'DIAGNOSTICS_STARTED',
  DIAGNOSTICS_COMPLETED: 'DIAGNOSTICS_COMPLETED',
  UPDATE_AVAILABLE: 'UPDATE_AVAILABLE',
  UPDATE_STARTED: 'UPDATE_STARTED',
  UPDATE_COMPLETED: 'UPDATE_COMPLETED',
  PAIRED: 'PAIRED',
  UNPAIRED: 'UNPAIRED',
  PAIRING_FAILED: 'PAIRING_FAILED',
  TABLET_CONNECTED: 'TABLET_CONNECTED',
  TABLET_DISCONNECTED: 'TABLET_DISCONNECTED',
  SCENARIO_LOADED: 'SCENARIO_LOADED',
  AUDIT_CHAIN_BROKEN: 'AUDIT_CHAIN_BROKEN',
} as const;
export type SimEventType = ValueOf<typeof SimEventType>;

// ── Step 54 additions (SIM-GAP closure; review 40 m4, W44-2, W46-2, W47-2, W50-1..3) ─────

/**
 * Why a precheck item warns or blocks (SIM-GAP-W46-2): `PrecheckItem.reasonCode` carries one of
 * these next to the English `reason`, so a UI looks up its own copy and never shows the EN text.
 */
export const PrecheckReasonCode = {
  CORE_OFFLINE: 'CORE_OFFLINE',
  LENS_FAULT: 'LENS_FAULT',
  MIC_NO_SIGNAL: 'MIC_NO_SIGNAL',
  MIC_CLIP: 'MIC_CLIP',
  STORAGE_FULL: 'STORAGE_FULL',
  STORAGE_LOW: 'STORAGE_LOW',
  TIME_RTC: 'TIME_RTC',
  SECURITY_FAULT: 'SECURITY_FAULT',
  ENCLOSURE_TAMPER: 'ENCLOSURE_TAMPER',
} as const;
export type PrecheckReasonCode = ValueOf<typeof PrecheckReasonCode>;

/**
 * Case type of an evidence item (SIM-GAP-W47-2): the examination type of the interview, the one
 * categorical attribute of a case in the dataset (the route search `caseType`). The values are
 * the subject types, so the existing `common.subjectType` labels apply.
 */
export const CaseType = SubjectType;
export type CaseType = SubjectType;

/** Primary category of an operational event (SIM-GAP-W50-3, W49-2). */
export const SimEventCategory = {
  AUTH: 'AUTH',
  SESSION: 'SESSION',
  EVIDENCE: 'EVIDENCE',
  EXPORT: 'EXPORT',
  STORAGE: 'STORAGE',
  TIME: 'TIME',
  NETWORK: 'NETWORK',
  DEVICE: 'DEVICE',
  SECURITY: 'SECURITY',
  SYSTEM: 'SYSTEM',
} as const;
export type SimEventCategory = ValueOf<typeof SimEventCategory>;

/** Category of every event type. FAULT_RAISED / FAULT_CLEARED take the category of their fault kind. */
export const SIM_EVENT_CATEGORY = {
  SYSTEM_BOOT: 'SYSTEM',
  HEALTH_CHECK_OK: 'SYSTEM',
  TIME_SYNC: 'TIME',
  AUTH_LOGIN: 'AUTH',
  AUTH_LOGOUT: 'AUTH',
  AUTH_FAILED: 'AUTH',
  AUTH_LOCKED: 'AUTH',
  AUTH_EXPIRED: 'AUTH',
  SESSION_CREATED: 'SESSION',
  PRECHECK_STARTED: 'SESSION',
  PRECHECK_PASSED: 'SESSION',
  PRECHECK_BLOCKED: 'SESSION',
  RECORDING_STARTED: 'SESSION',
  RECORDING_STOPPED: 'SESSION',
  SESSION_CANCELLED: 'SESSION',
  FINALIZATION_STARTED: 'EVIDENCE',
  EVIDENCE_SEALED: 'EVIDENCE',
  SESSION_INCOMPLETE: 'SESSION',
  EVIDENCE_EXPORTED: 'EXPORT',
  EXPORT_DENIED: 'EXPORT',
  EVIDENCE_VERIFIED: 'EVIDENCE',
  EVIDENCE_VERIFY_FAILED: 'EVIDENCE',
  EVIDENCE_REVIEW: 'EVIDENCE',
  EVIDENCE_ARCHIVED: 'EVIDENCE',
  MARKER_ADDED: 'SESSION',
  NOTE_ADDED: 'SESSION',
  SNAPSHOT_TAKEN: 'SESSION',
  AUTOSAVE: 'STORAGE',
  FAULT_RAISED: 'DEVICE',
  FAULT_CLEARED: 'DEVICE',
  RECOVERY_STARTED: 'SYSTEM',
  RECOVERY_COMPLETED: 'SYSTEM',
  STORAGE_WRITE_VERIFIED: 'STORAGE',
  STORAGE_POLICY_CHANGED: 'STORAGE',
  DIAGNOSTICS_STARTED: 'DEVICE',
  DIAGNOSTICS_COMPLETED: 'DEVICE',
  UPDATE_AVAILABLE: 'SYSTEM',
  UPDATE_STARTED: 'SYSTEM',
  UPDATE_COMPLETED: 'SYSTEM',
  PAIRED: 'NETWORK',
  UNPAIRED: 'NETWORK',
  PAIRING_FAILED: 'NETWORK',
  TABLET_CONNECTED: 'NETWORK',
  TABLET_DISCONNECTED: 'NETWORK',
  SCENARIO_LOADED: 'SYSTEM',
  AUDIT_CHAIN_BROKEN: 'SECURITY',
} as const satisfies Record<SimEventType, SimEventCategory>;

/** Category of FAULT_RAISED / FAULT_CLEARED events, by fault kind. */
export const FAULT_EVENT_CATEGORY = {
  CAMERA_LOSS: 'DEVICE',
  MIC_NO_SIGNAL: 'DEVICE',
  MIC_CLIP: 'DEVICE',
  STORAGE_LOW: 'STORAGE',
  STORAGE_FULL: 'STORAGE',
  GNSS_LOSS: 'TIME',
  TAMPER: 'SECURITY',
  FAN_STALL: 'DEVICE',
  POWER_FAIL: 'SYSTEM',
  TPM_FAILURE: 'SECURITY',
  SECURITY_FAULT: 'SECURITY',
  AUDIT_TAMPER: 'SECURITY',
} as const satisfies Record<FaultKind, SimEventCategory>;

/** Live state of a §21.1 network domain (SIM-GAP-W50-1). */
export const NetworkDomainState = {
  ACTIVE: 'ACTIVE',
  DEGRADED: 'DEGRADED',
  DOWN: 'DOWN',
  RESTRICTED: 'RESTRICTED',
  ON_DEMAND: 'ON_DEMAND',
  TRANSFER: 'TRANSFER',
  UPDATING: 'UPDATING',
} as const;
export type NetworkDomainState = ValueOf<typeof NetworkDomainState>;

/** A/V-sync health (§22.2; SIM-GAP-W50-2). */
export const AvSyncState = { HEALTHY: 'HEALTHY', DEGRADED: 'DEGRADED' } as const;
export type AvSyncState = ValueOf<typeof AvSyncState>;

/** Where an evidence item's displayed hashes come from (review 40 §5.c; SIM-GAP-W1). */
export const IntegritySource = { DEMO_PACKAGE: 'DEMO_PACKAGE', SIMULATED: 'SIMULATED' } as const;
export type IntegritySource = ValueOf<typeof IntegritySource>;

/** Front-panel LEDs (book §4.2; SIM-GAP-W48-3) and their states (a demo assumption, 01_explore A.34). */
export const FrontPanelLedId = {
  POWER: 'POWER',
  RECORD: 'RECORD',
  NETWORK: 'NETWORK',
  STORAGE: 'STORAGE',
  FAULT: 'FAULT',
} as const;
export type FrontPanelLedId = ValueOf<typeof FrontPanelLedId>;
/**
 * `on` steady green; `activity` green with a ≤ 2 Hz link blink; `rec` red breathing; `warn`
 * steady amber; `fault` steady red; `off` dark.
 */
export const FrontPanelLedState = {
  ON: 'on',
  ACTIVITY: 'activity',
  REC: 'rec',
  WARN: 'warn',
  FAULT: 'fault',
  OFF: 'off',
} as const;
export type FrontPanelLedState = ValueOf<typeof FrontPanelLedState>;

/** Per-drive SMART summary (SIM-GAP-W49-1). */
export const SmartStatus = { PASSED: 'PASSED', WARNING: 'WARNING', FAILED: 'FAILED' } as const;
export type SmartStatus = ValueOf<typeof SmartStatus>;
