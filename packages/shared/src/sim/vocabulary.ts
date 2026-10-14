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
  // Task 3 M2-W6 (register SH-03/SH-04; D4 OD-10 and OD-15; `C3 §0`/`§2.1`): additive. The Core
  // server enforces both; the simulator grants them the same way (`auth.ts` ROLE_PERMISSIONS).
  // `CAPTURE_CONFIG` is SUPERVISOR + TECHNICIAN and is editable only while idle (OD-10);
  // `TRANSCRIPT_REVISE` is INVESTIGATOR + SUPERVISOR (OD-15).
  CAPTURE_CONFIG: 'CAPTURE_CONFIG',
  TRANSCRIPT_REVISE: 'TRANSCRIPT_REVISE',
  // Task 4 row 100 (WP-23c; decision U10; plan review P12-F07): additive, declared LAST - its
  // place here (15) is the `sort_order` the seed and migration `0018` store. The commissioning
  // functions of the camera network (the alias address, the factory-address scan, setting a
  // camera's address, the network settings): TECHNICIAN ONLY, not SUPERVISOR, not INVESTIGATOR.
  // A permission is stored data: the Core's boot compares the stored grants with `ROLE_PERMISSIONS`,
  // so this member and the two rows of `0018` land in one commit. No operation names it yet (the
  // contract package of the commissioning operations is a later row), and no simulator action does.
  CAPTURE_COMMISSION: 'CAPTURE_COMMISSION',
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

/**
 * The 8 §5.3 gate checks, in display order, plus the role-keyed mic pair of the v2 track model
 * (register SH-03; OD-01 T1). `MIC_PRIMARY`/`MIC_STANDBY` check the input that holds each role
 * rather than a fixed channel. Since blueprint row 133 (decision D101(2)) `PRECHECK_ORDER` — still
 * eight checks — holds the role-keyed pair; `MIC_1`/`MIC_2` stay in the ID set because stored
 * pre-check items and older clients name them, and `evaluatePrecheck` still answers them.
 */
export const PrecheckCheckId = {
  CORE: 'CORE',
  LENS_1: 'LENS_1',
  LENS_2: 'LENS_2',
  MIC_1: 'MIC_1',
  MIC_2: 'MIC_2',
  MIC_PRIMARY: 'MIC_PRIMARY',
  MIC_STANDBY: 'MIC_STANDBY',
  STORAGE: 'STORAGE',
  TIME: 'TIME',
  SECURITY: 'SECURITY',
} as const;
export type PrecheckCheckId = ValueOf<typeof PrecheckCheckId>;
export const PRECHECK_ORDER = [
  PrecheckCheckId.CORE,
  PrecheckCheckId.LENS_1,
  PrecheckCheckId.LENS_2,
  // Role-keyed since task 3 row 133 (decision D101(2)): web and mobile moved together. `MIC_1` / `MIC_2` stay valid IDs of stored items.
  PrecheckCheckId.MIC_PRIMARY,
  PrecheckCheckId.MIC_STANDBY,
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
  /** Task 3 (register SH-03, WB-10): the operator switched the active mic input (op 81; OD-09). */
  AUDIO_SWITCH: 'AUDIO_SWITCH',
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
/**
 * The fourteen fault kinds of schema v2. The first twelve are the book's set; `MIC_SILENT` and
 * `CAPTURE_FAULT` are appended **in the order `dbc-3 §C.1` writes them** (decision D-b, binding),
 * so the vocabulary pin CL-12 / M2-MT-8 compares two equal ordered lists: this enum and
 * `apps/core-server/src/db/schema/value-sets.ts` `FAULT_KIND`. Do not reorder either side.
 *
 * `MIC_SILENT` is the OD-11 warning (below −50 dBFS for 10 s, never an automatic switch);
 * `CAPTURE_FAULT` is the file-stopped-growing fault surfaced by sealing (`register NM-07`).
 */
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
  // Appended in contract order (D-b). The book's EVT table stops at EVT-30, so these two carry
  // their gate/register authority instead of an invented EVT ID (see `FaultEvt`).
  MIC_SILENT: 'MIC_SILENT',
  CAPTURE_FAULT: 'CAPTURE_FAULT',
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
  // No book EVT ID exists for the two v2 kinds (the table stops at EVT-30): they are keyed to the
  // gate answer and the register row that created them.
  MIC_SILENT: 'OD-11',
  CAPTURE_FAULT: 'NM-07',
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
export const DeviceCommand = { TEST_SIGNAL: 'TEST_SIGNAL', RESTART: 'RESTART', IDENTIFY: 'IDENTIFY', POE_CYCLE: 'POE_CYCLE' } as const;
export type DeviceCommand = ValueOf<typeof DeviceCommand>;

/**
 * Kind of a row of the capture-device registry (`dbc-3 §B.2` `capture_devices.kind`, the value
 * set the DB CHECK enforces; register SH-03). The IDs are tied to the kind by the same table's
 * id CHECK (`CAM-nn`, `MIC-nn`, `POE-…`). `C3 §6` writes the mic kind as "MICROPHONE" in its shape
 * summary; the DB set is normative, so this enum says `MIC`.
 */
export const CaptureDeviceKind = { CAMERA: 'CAMERA', MIC: 'MIC', POE: 'POE' } as const;
export type CaptureDeviceKind = ValueOf<typeof CaptureDeviceKind>;

/**
 * Stream state of a capture device (register SH-16; op 44 `cameras[].streamState`). A lost stream
 * is what makes a PoE cycle legal at all (OD-22), so it is a contract value, not a UI detail.
 */
export const CaptureStreamState = { LIVE: 'LIVE', LOST: 'LOST' } as const;
export type CaptureStreamState = ValueOf<typeof CaptureStreamState>;

/**
 * The most stored stream profiles one device entry carries (task 4 row V7; `capture-profile.ts`).
 * The Core's own bound of a stored list (`STORED_PROFILES_MAX` of
 * `apps/core-server/src/capture/fence/production-parts.ts`): a longer list is no list of a camera
 * this Core records. Here, with the code form, because the API contract reads its constants from
 * this file and loads no engine file.
 */
export const CAPTURE_DEVICE_PROFILES_MAX = 16;
/** The form of a profile code (`capture_devices_profiles_code_check`; the contract's machine code). */
export const CAPTURE_PROFILE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;

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
  // Task 3 M2-W7 (blueprint row 48; `C3 §5.2`; SEC35-01/02/16/17/22): the nine capture-phase
  // types, in the order of `C3 §5.2`. Written by Core-server modules only (the simulator emits
  // none of them); every one has an exact detail-key list in `apps/core-server/src/core/
  // audit-details.ts`, and no key of any list may hold a secret (`C3 §5.1`; E-30/E-31).
  CAPTURE_CONFIG_CHANGED: 'CAPTURE_CONFIG_CHANGED',
  AUDIO_SOURCE_SWITCHED: 'AUDIO_SOURCE_SWITCHED',
  CAMERA_POE_CYCLED: 'CAMERA_POE_CYCLED',
  TRANSCRIPT_REVISED: 'TRANSCRIPT_REVISED',
  MIC_SILENT: 'MIC_SILENT',
  EVIDENCE_MEDIA_SERVED: 'EVIDENCE_MEDIA_SERVED',
  EVIDENCE_EXPORT_FAILED: 'EVIDENCE_EXPORT_FAILED',
  CAPTURE_CREDENTIAL_SET: 'CAPTURE_CREDENTIAL_SET',
  CAPTURE_CREDENTIAL_REVEALED: 'CAPTURE_CREDENTIAL_REVEALED',
  // Task 3 M6 (blueprint row 113; `C3 §2.5`; R-8, D20/D24): written by operation 91 on success
  // only. Its exact detail keys name the changed FIELDS plus `credentialChanged` — never a value of
  // the endpoint, the model path, the credential or its reference target (E-30/E-31; SEC35-14).
  STT_CONFIG_CHANGED: 'STT_CONFIG_CHANGED',
  // Task 3 R-9..R-11 (blueprint rows 132 / 133 / 142; `C3 §5.2` "the four audit types of the row-121
  // delta", decision D106): camera search, connection test, adoption, and the no-device warning.
  // Written by Core-server modules; each has an exact detail-key list in `apps/core-server/src/core/
  // audit-details.ts`. Never a username, a secret or a URL in any of them (C-N9; D86 C-3, C-6).
  CAPTURE_DISCOVERY_SEARCHED: 'CAPTURE_DISCOVERY_SEARCHED',
  CAPTURE_CONNECTION_TESTED: 'CAPTURE_CONNECTION_TESTED',
  CAPTURE_CANDIDATE_ADOPTED: 'CAPTURE_CANDIDATE_ADOPTED',
  CAPTURE_DEVICE_UNREACHABLE: 'CAPTURE_DEVICE_UNREACHABLE',
  // Task 4 (blueprint row 19, WP-23a; design addendum 04 sections 4.2 and 8.2; schema extension 03
  // sections 2.2, 2.4, 2.5, 2.6): the ten types of the hardware-input port, in ONE change set ahead
  // of their writers (67 -> 77). Written by Core-server modules only; the simulator emits none.
  // Each has an exact detail-key list in `apps/core-server/src/core/audit-details.ts`: ids, codes,
  // counts and IP literals - never device text, an interface name, a username or a secret.
  CAPTURE_AUDIO_INPUT_CHANGED: 'CAPTURE_AUDIO_INPUT_CHANGED',
  CAPTURE_NETWORK_CONFIG_CHANGED: 'CAPTURE_NETWORK_CONFIG_CHANGED',
  HOST_ALIAS_ADDED: 'HOST_ALIAS_ADDED',
  HOST_ALIAS_REMOVED: 'HOST_ALIAS_REMOVED',
  HOST_ALIAS_REMOVE_FAILED: 'HOST_ALIAS_REMOVE_FAILED',
  CAMERA_FACTORY_SCANNED: 'CAMERA_FACTORY_SCANNED',
  CAMERA_NETWORK_SET: 'CAMERA_NETWORK_SET',
  CAPTURE_DEVICE_ADDRESS_CHANGED: 'CAPTURE_DEVICE_ADDRESS_CHANGED',
  INSTALLATION_ACCEPTED: 'INSTALLATION_ACCEPTED',
  INSTALLATION_ACCEPTANCE_REVOKED: 'INSTALLATION_ACCEPTANCE_REVOKED',
  // Task 4 (blueprint row 201, X-C; design 05 section 3.7; security review 07, SX-14): the ONE type
  // of the host command that sets an operator's password (77 -> 78). Written by that command only,
  // with a null actor and severity WARNING; the simulator emits none. Its closed detail-key list is
  // in `apps/core-server/src/core/audit-details.ts`: never the password, its length, a salt, a tag
  // or a hash parameter. The name is fixed here.
  OPERATOR_PASSWORD_SET: 'OPERATOR_PASSWORD_SET',
  // Task 4 (row V3, the third contract-and-vocabulary step; decisions C53 (4d), C57, C58, C62): four
  // types in ONE change set ahead of their writers (78 -> 82). Written by Core-server modules only;
  // the simulator emits none. Each has an exact detail-key list in `apps/core-server/src/core/
  // audit-details.ts`: ids, closed codes, counts and one IPv4 literal - never a credential, a
  // locator, an interface name or text a device chose.
  //   HOST_ALIAS_REQUESTED             the INTENT of a change of the host's own addresses, written
  //                                    BEFORE the line is sent to the address helper (S13-10 (c));
  //   HOST_ALIAS_ADD_FAILED            an `add` the helper refused or failed (the result that had no type);
  //   CAPTURE_AUDIO_ABSENT_ON_RESTART  the capture worker was replaced inside a session and no audio
  //                                    was recorded between the two workers: the measured bounds in ms;
  //   CAPTURE_DEVICE_CONNECTION_TESTED the OUTCOME of a connection test of a REGISTERED camera made
  //                                    with its STORED credential (operation 108). A type of its own:
  //                                    `CAPTURE_CONNECTION_TESTED` names a candidate and a search.
  HOST_ALIAS_REQUESTED: 'HOST_ALIAS_REQUESTED',
  HOST_ALIAS_ADD_FAILED: 'HOST_ALIAS_ADD_FAILED',
  CAPTURE_AUDIO_ABSENT_ON_RESTART: 'CAPTURE_AUDIO_ABSENT_ON_RESTART',
  CAPTURE_DEVICE_CONNECTION_TESTED: 'CAPTURE_DEVICE_CONNECTION_TESTED',
  // Task 4 (row R1b; decision C99, the video twin of `CAPTURE_AUDIO_ABSENT_ON_RESTART`): one type
  // (82 -> 83). A camera of a session stopped delivering video INSIDE the session while its relay
  // kept the push to the capture worker: the recording of that camera has a step in time as long
  // as the absence. Written by the Core's capture session when the absence ENDS - the relay opened
  // the camera again (`RE_OPENED`) or the capture ended with the camera still away
  // (`NOT_RE_OPENED`); the simulator emits none. Its closed detail-key list is in
  // `apps/core-server/src/core/audit-details.ts`: ids, numbers, the two measured bounds in ms and
  // one closed word - never a locator, a credential or text a device chose.
  CAPTURE_VIDEO_ABSENT_IN_SESSION: 'CAPTURE_VIDEO_ABSENT_IN_SESSION',
  // Task 4 (row N2; design 06 revision 3, section 8.4; decisions U25 (3), C110, C112 (3)): two
  // types in ONE change set ahead of their writer (83 -> 85), for a microphone whose capture path
  // is NOT SAMPLE-CONTINUOUS (the bench path of a Mac). Written by the Core's capture session only;
  // the simulator emits none. Two types, because an audit detail list is flat and cannot hold a list:
  //   CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED  THE ACCOUNT, once per such microphone and capture attempt
  //                                       when that attempt's audio ends: the recorder's own counts
  //                                       in whole samples - expected, received, inserted, discarded
  //                                       - or that nothing was measured. SINCE ROW V7 (decision
  //                                       C119 (1)) ONE ACCOUNT IS TWO ENTRIES of this type, `part` 1
  //                                       (the source's six numbers, the open run) and `part` 2 (the
  //                                       track's seven), each within the audit writer's bound of 16
  //                                       details, both stating the session, the attempt and the path,
  //                                       joined on session, microphone and attempt. One part alone
  //                                       is no account;
  //   CAPTURE_AUDIO_SILENCE_INSERTED     ONE LISTED RUN of inserted silence of 100 ms or more, written
  //                                       when the worker reports it: where it starts on the track's
  //                                       own timeline and how long it is.
  // Each has an exact detail-key list in `apps/core-server/src/core/audit-details.ts`: ids, whole
  // numbers and closed words - never device text, card text, a file name or a percentage.
  CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED: 'CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED',
  CAPTURE_AUDIO_SILENCE_INSERTED: 'CAPTURE_AUDIO_SILENCE_INSERTED',
  // Task 4 (row RD2; design 07 section 4.2; decision C147): one type (85 -> 86). A camera or a
  // microphone was RETIRED by operation 111 (`retireCaptureDevice`): its stored credential destroyed,
  // its registry row kept and never assignable again. Written by the Core in the retire unit and by
  // the in-app simulator's operation 111. Its closed detail-key list is in
  // `apps/core-server/src/core/audit-details.ts`: the device id, its kind, a closed reason, one flag
  // and one count - never an address, a hardware id, a serial, a credential or text a device chose.
  CAPTURE_DEVICE_RETIRED: 'CAPTURE_DEVICE_RETIRED',
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
  // Task 3 M2-W7 (`C3 §5.3`): exactly nine entries, each in an EXISTING category.
  CAPTURE_CONFIG_CHANGED: 'DEVICE',
  AUDIO_SOURCE_SWITCHED: 'SESSION',
  CAMERA_POE_CYCLED: 'DEVICE',
  TRANSCRIPT_REVISED: 'EVIDENCE',
  MIC_SILENT: 'DEVICE',
  EVIDENCE_MEDIA_SERVED: 'EVIDENCE',
  EVIDENCE_EXPORT_FAILED: 'EVIDENCE',
  CAPTURE_CREDENTIAL_SET: 'SECURITY',
  CAPTURE_CREDENTIAL_REVEALED: 'SECURITY',
  // Task 3 M6 (row 113; `C3 §2.5`): one entry, in an EXISTING category.
  STT_CONFIG_CHANGED: 'DEVICE',
  // Task 3 R-9..R-11 (`C3 §5.3`, erratum PE-121-09): exactly four entries, no new category.
  CAPTURE_DISCOVERY_SEARCHED: 'DEVICE',
  CAPTURE_CONNECTION_TESTED: 'SECURITY',
  CAPTURE_CANDIDATE_ADOPTED: 'DEVICE',
  CAPTURE_DEVICE_UNREACHABLE: 'DEVICE',
  // Task 4 (blueprint row 19, WP-23a): exactly ten entries, each in an EXISTING category. The three
  // alias types record a change of the HOST's own addresses, made through a privileged helper:
  // SECURITY (there is no network category among the eight; schema extension 03 section 2.5).
  CAPTURE_AUDIO_INPUT_CHANGED: 'DEVICE',
  CAPTURE_NETWORK_CONFIG_CHANGED: 'DEVICE',
  HOST_ALIAS_ADDED: 'SECURITY',
  HOST_ALIAS_REMOVED: 'SECURITY',
  HOST_ALIAS_REMOVE_FAILED: 'SECURITY',
  CAMERA_FACTORY_SCANNED: 'DEVICE',
  CAMERA_NETWORK_SET: 'DEVICE',
  CAPTURE_DEVICE_ADDRESS_CHANGED: 'DEVICE',
  INSTALLATION_ACCEPTED: 'SYSTEM',
  INSTALLATION_ACCEPTANCE_REVOKED: 'SYSTEM',
  // Task 4 (blueprint row 201, X-C): one entry, in an EXISTING category - SECURITY, as `USER_ENABLED`.
  OPERATOR_PASSWORD_SET: 'SECURITY',
  // Task 4 (row V3): four entries, each in an EXISTING category. The two alias types as the three
  // of row 19 (SECURITY); the audio gap as the capture-fault types `MIC_SILENT` and
  // `CAPTURE_DEVICE_UNREACHABLE` (DEVICE); the stored-credential test as `CAPTURE_CONNECTION_TESTED`
  // and `CAPTURE_CREDENTIAL_REVEALED` (SECURITY).
  HOST_ALIAS_REQUESTED: 'SECURITY',
  HOST_ALIAS_ADD_FAILED: 'SECURITY',
  CAPTURE_AUDIO_ABSENT_ON_RESTART: 'DEVICE',
  CAPTURE_DEVICE_CONNECTION_TESTED: 'SECURITY',
  // Task 4 (row R1b): one entry, in an EXISTING category - DEVICE, as the audio gap and the capture
  // device faults (`MIC_SILENT`, `CAPTURE_DEVICE_UNREACHABLE`).
  CAPTURE_VIDEO_ABSENT_IN_SESSION: 'DEVICE',
  // Task 4 (row N2): two entries, each in an EXISTING category - DEVICE, as the audio gap and the
  // video absence.
  CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED: 'DEVICE',
  CAPTURE_AUDIO_SILENCE_INSERTED: 'DEVICE',
  // Task 4 (row RD2; decision C147): one entry, in an EXISTING category - SECURITY, as
  // `CAPTURE_CREDENTIAL_SET` and `CAPTURE_CREDENTIAL_REVEALED`: a stored credential is destroyed.
  CAPTURE_DEVICE_RETIRED: 'SECURITY',
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
  // Both are capture-path faults of a device (register SH-03; `dbc-3 §C.2`).
  MIC_SILENT: 'DEVICE',
  CAPTURE_FAULT: 'DEVICE',
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

/**
 * Where an evidence item's displayed hashes come from (review 40 §5.c; SIM-GAP-W1). `REAL` is the
 * third value of schema v2 (`dbc-3 §B.11`, INTEGRITY_SOURCE value set; OD-02): the item was
 * captured and sealed from real media. The DB CHECK and this enum hold the same three values.
 */
export const IntegritySource = {
  DEMO_PACKAGE: 'DEMO_PACKAGE',
  SIMULATED: 'SIMULATED',
  REAL: 'REAL',
} as const;
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
