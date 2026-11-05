/**
 * `common.*`: terms every page and both apps share (brand, actions, statuses, enum labels,
 * subject types, units, errors). English UI; Indonesian domain terms verbatim (D28/Q3).
 * Enum maps are keyed by wire values: book enums from `src/domain/enums.ts`, demo
 * vocabulary (roles, audit types, fault kinds, …) from `src/sim/vocabulary.ts` as read on
 * 2026-10-01 02:36 WIB, so `t('common.auditType.' + row.type)` needs no lookup table.
 */
import { AUDIO_NOT_SAMPLE_CONTINUOUS_WORDS, MIC_SAME_DEVICE_WORDS } from '../../sim/audio-not-continuous';
import { CAPTURE_FAULT_NO_REASON_SENTENCES, CAPTURE_FAULT_SENTENCES, CAPTURE_FAULT_UNKNOWN_SENTENCES, INTERRUPTED_SEAL_SENTENCES } from '../../sim/capture-fault-wording';
import { CORE_NOT_RUNNING_LABEL, CORE_NOT_RUNNING_SENTENCE } from '../../sim/core-not-running';
import { SEAL_UNSEALABLE_SENTENCE } from '../../sim/seal-unsealable';
import type { ResourceTree } from '../resource-tree';

export const common = {
  brand: {
    name: 'DEMS Edge Client',
    wordmark: 'DEMS EDGE CLIENT',
    tagline: 'Digital Evidence Recording Controller',
    overline: 'DIGITAL EVIDENCE RECORDING CONTROLLER',
    heroLine1: 'SECURE BY DESIGN.',
    heroLine2: 'TRUSTED BY LAW.',
    pillars: {
      record: 'RECORD',
      preserve: 'PRESERVE',
      protect: 'PROTECT',
    },
    triplet: 'SECURE RECORDING / TRUSTED EVIDENCE / SAFER COMMUNITIES',
    version: 'v{{version}}',
  },

  actions: {
    startNewSession: 'Start New Session',
    endSession: 'End Session',
    startRecording: 'Start Recording',
    openEvidenceQueue: 'Open Evidence Queue',
    viewAll: 'View All',
    viewDetails: 'View details',
    next: 'Next',
    back: 'Back',
    cancel: 'Cancel',
    close: 'Close',
    confirm: 'Confirm',
    save: 'Save',
    apply: 'Apply',
    reset: 'Reset',
    retry: 'Retry',
    retryIn: 'Retry in {{seconds}}s',
    refresh: 'Refresh',
    search: 'Search',
    clearFilters: 'Clear filters',
    copy: 'Copy',
    copied: 'Copied',
    download: 'Download',
    export: 'Export',
    verify: 'Verify',
    acknowledge: 'Acknowledge',
    done: 'Done',
    play: 'Play',
    more: 'More',
    showMore: 'Show more',
    showLess: 'Show less',
    signIn: 'Sign In',
    signOut: 'Sign out',
  },

  status: {
    ready: 'Ready',
    recording: 'Recording',
    online: 'Online',
    offline: 'Offline',
    connected: 'Connected',
    disconnected: 'Disconnected',
    synchronized: 'Synchronized',
    secure: 'Secure',
    active: 'Active',
    enabled: 'Enabled',
    disabled: 'Disabled',
    verified: 'Verified',
    pending: 'Pending',
    warning: 'Warning',
    info: 'Info',
    attention: 'Attention',
    critical: 'Critical',
    unknown: 'Unknown',
    fault: 'Fault',
    noSignal: 'No signal',
    locked: 'Locked',
    running: 'Running',
    stopped: 'Stopped',
    degraded: 'Degraded',
    simulated: 'Simulated',
    live: 'Live',
  },

  /** Top-level system state (GlowRing, SECURE pill, posture shields). */
  systemState: {
    READY: 'READY',
    ATTENTION: 'ATTENTION',
    CRITICAL: 'CRITICAL',
    UNKNOWN: 'UNKNOWN',
    RECORDING: 'RECORDING',
  },

  posture: {
    SECURE: 'SECURE',
    ATTENTION: 'ATTENTION',
    CRITICAL: 'CRITICAL',
    UNKNOWN: 'UNKNOWN',
  },

  /** Subject types stay Indonesian (D28/Q3). */
  subjectType: {
    TERSANGKA: 'Tersangka',
    SAKSI: 'Saksi',
    LAINNYA: 'Lainnya',
  },
  /** EN glosses for tooltips (web) and accessibility hints (mobile). */
  subjectTypeGloss: {
    TERSANGKA: 'Suspect',
    SAKSI: 'Witness',
    LAINNYA: 'Other',
  },
  subjectTypeLabel: 'Subject Type',

  evidenceStatus: {
    RECORDED: 'Recorded',
    SEALED: 'Sealed',
    EXPORTED: 'Exported',
    UNDER_REVIEW: 'Under Review',
    ARCHIVED: 'Archived',
    PENDING: 'Pending',
  },

  roles: {
    INVESTIGATOR: 'Investigator',
    SUPERVISOR: 'Supervisor',
    TECHNICIAN: 'Technician',
  },

  /** Start Session step 2 per-check status (sim `PrecheckStatus`). */
  precheckStatus: {
    PENDING: 'Pending',
    RUNNING: 'Checking…',
    PASS: 'PASS',
    WARN: 'WARN',
    BLOCK: 'BLOCK',
  },

  severity: {
    INFO: 'Info',
    SUCCESS: 'Success',
    WARNING: 'Warning',
    CRITICAL: 'Critical',
  },

  sessionOutcome: {
    SEALED: 'Sealed',
    INCOMPLETE: 'Incomplete',
  },

  verificationStatus: {
    NOT_RUN: 'Not verified',
    PASS: 'PASS',
    FAIL: 'FAIL',
  },

  authMethod: {
    PASSWORD: 'Password',
    BIOMETRIC: 'Biometric',
    SECURITY_KEY: 'Security key',
  },

  pairingState: {
    UNPAIRED: 'Not paired',
    PAIRED: 'Paired',
    FAILED: 'Pairing failed',
  },

  tabletLinkState: {
    CONNECTED: 'CONNECTED',
    OFFLINE: 'OFFLINE',
  },

  serviceStatus: {
    RUNNING: 'Running',
    DEGRADED: 'Degraded',
    STOPPED: 'Stopped',
  },

  diagnosticStatus: {
    PENDING: 'Pending',
    RUNNING: 'Running',
    PASS: 'PASS',
    WARN: 'WARN',
    FAIL: 'FAIL',
  },

  updateState: {
    IDLE: 'Idle',
    RUNNING: 'Installing',
    PASS: 'Installed',
    FAIL: 'Failed',
  },

  /** Simulator fault kinds (alerts, bell, Demo Control Panel fallbacks). */
  faultKind: {
    CAMERA_LOSS: 'Camera signal lost',
    MIC_NO_SIGNAL: 'Microphone no signal',
    MIC_CLIP: 'Microphone clipping',
    STORAGE_LOW: 'Storage low',
    STORAGE_FULL: 'Storage full',
    GNSS_LOSS: 'GNSS signal lost',
    TAMPER: 'Tamper detected',
    FAN_STALL: 'Fan stalled',
    POWER_FAIL: 'Power failure',
    TPM_FAILURE: 'TPM failure',
    SECURITY_FAULT: 'Security fault',
    AUDIT_TAMPER: 'Audit log tampered',
    // Schema v2 (register SH-03/SH-23): the OD-11 silence warning and the stalled-file fault.
    MIC_SILENT: 'Microphone silent',
    CAPTURE_FAULT: 'Capture fault',
  },

  /** Enum display labels, keyed by `src/domain/enums.ts` wire values. */
  enums: {
    sessionState: {
      CREATE: 'Create',
      PRECHECK: 'Pre-check',
      ARMED: 'Armed',
      RECORDING: 'Recording',
      STOPPING: 'Stopping',
      FINALIZING: 'Finalizing',
      SEALED: 'Sealed',
      FAULT: 'Fault',
      RECOVERY: 'Recovery',
      IDLE: 'No session',
      INCOMPLETE: 'Incomplete',
    },
    coreLinkState: {
      ONLINE: 'ONLINE',
      OFFLINE: 'OFFLINE',
    },
    lensState: {
      READY: 'READY',
      FAULT: 'FAULT',
    },
    micState: {
      READY: 'READY',
      NO_SIGNAL: 'NO SIGNAL',
      CLIP: 'CLIP',
    },
    storageState: {
      READY: 'READY',
      LOW: 'LOW',
      FULL: 'FULL',
    },
    storageRecordingState: {
      READY: 'OK',
      LOW: 'LOW',
      FULL: 'FULL',
    },
    timeSource: {
      GNSS: 'GNSS',
      NTP: 'NTP',
      RTC: 'RTC',
    },
    timeQuality: {
      LOCKED: 'LOCKED',
    },
    securityState: {
      READY: 'READY',
      FAULT: 'FAULT',
    },
    trackRecState: {
      REC: 'REC',
      DEGRADED: 'DEGRADED',
      LOST: 'LOST',
    },
    heartbeatState: {
      CONNECTING: 'Connecting',
      LIVE: 'Live',
      STALE: 'Stale',
      OFFLINE: 'Offline',
    },
    evidenceLifecycleStage: {
      CAPTURE: 'Capture',
      RECORDING: 'Recording',
      FINALIZING: 'Finalizing',
      HASH: 'Hash',
      MANIFEST: 'Manifest',
      ENCRYPT: 'Encrypt',
      SIGN: 'Sign',
      SEALED_LOCAL_EVIDENCE: 'Sealed local evidence',
      AUTHORIZED_REVIEW: 'Authorized review',
      AUTHORIZED_EXPORT_TRANSFER: 'Authorized export / transfer',
      DESTINATION_VERIFICATION: 'Destination verification',
      RETENTION_ARCHIVE_DISPOSITION: 'Retention / archive / disposition',
    },
    finalizationStep: {
      CLOSE_TRACKS: 'Close tracks',
      FINALIZE_HASHES: 'Finalize hashes',
      FINALIZE_TRANSCRIPT: 'Finalize transcript',
      BUILD_MANIFEST: 'Build manifest',
      SIGN_MANIFEST: 'Sign manifest',
      STORE_SEALED_PACKAGE: 'Store sealed evidence package',
      // OD-21 fallback path only; the normal pipeline never shows these two.
      CONCATENATE_SEGMENTS: 'Concatenate segments',
      ENCRYPT_PAYLOAD: 'Encrypt evidence payload',
    },
    updateStep: {
      SIGNATURE_VERIFICATION: 'Signature Verification',
      COMPATIBILITY_CHECK: 'Compatibility / Hardware-Revision Check',
      ANTI_ROLLBACK_POLICY: 'Anti-Rollback Policy',
      INSTALL_INACTIVE_SLOT: 'Install to INACTIVE System Slot',
      REBOOT: 'Reboot',
      POST_BOOT_HEALTH_CHECK: 'Post-Boot Health Check',
    },
    powerFailState: {
      NORMAL: 'Normal',
      POWER_FAIL_DETECTED: 'Power fail detected',
      RECORDING_RECOVERY_MARKER_WRITTEN: 'Recovery marker written',
      FLUSH_MEDIA_AND_METADATA: 'Flushing media and metadata',
      STORAGE_SYNC: 'Storage sync',
      SAFE_SHUTDOWN: 'Safe shutdown',
      POWER_OFF: 'Power off',
    },
    bootRecoveryState: {
      RECOVERY_SCAN: 'Recovery scan',
      INCOMPLETE_SESSION_ANALYSIS: 'Incomplete session analysis',
    },
    networkDomain: {
      CAMERA: 'Camera',
      MANAGEMENT: 'Management',
      SERVICE_UPDATE: 'Service/Update',
      EXPORT_TRANSFER: 'Export/Transfer',
    },
    healthCategory: {
      CPU: 'CPU',
      STORAGE: 'Storage',
      FAN: 'Fan',
      NETWORK: 'Network',
      CAMERA: 'Camera',
      AUDIO: 'Audio',
      TIME: 'Time',
      SECURITY: 'Security',
    },
    auditEventKind: {
      AUTHENTICATION: 'Authentication',
      TRACK_HEALTH: 'Track health',
      AUDIT: 'Audit',
      EXPORT: 'Export',
      TAMPER: 'Tamper',
      AUDIO_CLIP: 'Audio clip',
      SOURCE_FAULT: 'Source fault',
      POWER_FAIL: 'Power fail',
      WATCHDOG_RECOVERY: 'Watchdog recovery',
      UNAUTHORIZED_EXPORT: 'Unauthorized export',
      AUDIT_CHAIN_DISCONTINUITY: 'Audit chain discontinuity',
      GAIN_PHANTOM_CHANGE: 'Gain / phantom change',
      PROVISIONING: 'Provisioning',
      CONFIG_DRIFT: 'Config drift',
    },
  },

  /** Audit row types (sim `AuditType`; 01_specs §14.7, §14.8, AC-50, AC-62, AC-63). */
  auditType: {
    AUTH_SUCCESS: 'Sign-in succeeded',
    AUTH_FAILED: 'Sign-in failed',
    AUTH_LOCKED: 'Sign-in locked',
    AUTH_SIGNED_OUT: 'Signed out',
    AUTH_EXPIRED: 'Sign-in expired',
    SESSION_CREATED: 'Session created',
    PRECHECK_PASSED: 'Pre-check passed',
    PRECHECK_BLOCKED: 'Pre-check blocked',
    RECORDING_STARTED: 'Recording started',
    RECORDING_STOPPED: 'Recording ended',
    SESSION_CANCELLED: 'Session cancelled',
    EVIDENCE_SEALED: 'Evidence sealed',
    SESSION_INCOMPLETE: 'Session marked incomplete',
    SUMMARY_ACKNOWLEDGED: 'Summary acknowledged',
    MARKER_ADDED: 'Marker added',
    NOTE_ADDED: 'Note added',
    SNAPSHOT_TAKEN: 'Snapshot captured',
    FRAME_HASH: 'Video frame hash recorded',
    WRITE_VERIFIED: 'Storage write verified',
    TIMESTAMP_CONFIRMED: 'Secure timestamp confirmed',
    EVIDENCE_VERIFIED: 'Evidence verified',
    EVIDENCE_VERIFY_FAILED: 'Evidence verification failed',
    EVIDENCE_REVIEW_OPENED: 'Evidence review opened',
    EVIDENCE_EXPORTED: 'Evidence exported',
    EXPORT_DENIED: 'Export denied',
    EVIDENCE_ARCHIVED: 'Evidence archived',
    AUDIT_EXPORTED: 'Audit log exported',
    FAULT_RAISED: 'Fault raised',
    FAULT_CLEARED: 'Fault cleared',
    RECOVERY_STARTED: 'Recovery started',
    RECOVERY_COMPLETED: 'Recovery completed',
    AUDIT_CHAIN_DISCONTINUITY: 'Audit chain discontinuity',
    PAIRING_SUCCESS: 'Device paired',
    PAIRING_FAILED: 'Pairing failed',
    PAIRING_LOCKED: 'Pairing locked',
    UNPAIRED: 'Device unpaired',
    TABLET_LINK_CHANGED: 'Device link changed',
    DEVICE_COMMAND: 'Device command sent',
    DIAGNOSTICS_RUN: 'Diagnostics run',
    STORAGE_POLICY_CHANGED: 'Storage policy changed',
    UPDATE_STARTED: 'Update started',
    UPDATE_COMPLETED: 'Update completed',
    SCENARIO_LOADED: 'Demo scenario loaded',
    SYSTEM_BOOT: 'System started',
    // Backend task W16: the nine types the Core server writes (2026-10-04 01_specs §13.1).
    ACCESS_DENIED: 'Access denied',
    PAIRING_CODE_ISSUED: 'Pairing code issued',
    PAIRING_CODE_CLOSED: 'Pairing code closed',
    DEVICE_REVOKED: 'Paired device revoked',
    DEVICE_CREDENTIAL_ROTATED: 'Device credential rotated',
    ROLE_CHANGED: 'Role changed',
    USER_ENABLED: 'User enabled',
    USER_DISABLED: 'User disabled',
    // RB-9 as amended by the principal (PT GSP, 02-11-2026): the three types of the vendor-only
    // user management operations (`createUser`, `updateUser`, `deleteUser`).
    USER_CREATED: 'User created',
    USER_UPDATED: 'User profile updated',
    USER_DELETED: 'User deleted',
    // D57 (2026-11-03, principal): the console module of the pre-delivery panel setup.
    PANEL_SETUP_CHANGED: 'Panel pre-delivery setup changed',
    BIOMETRIC_ENROLLMENT_CHANGED: 'Biometric sign-in changed',
    // Task 3 M2-W7 (blueprint row 48; C3 §5.2): the nine capture-phase types.
    CAPTURE_CONFIG_CHANGED: 'Capture configuration changed',
    AUDIO_SOURCE_SWITCHED: 'Microphone source switched',
    CAMERA_POE_CYCLED: 'Camera power-cycled',
    TRANSCRIPT_REVISED: 'Transcript revised',
    MIC_SILENT: 'Microphone silent',
    EVIDENCE_MEDIA_SERVED: 'Evidence media served',
    EVIDENCE_EXPORT_FAILED: 'Evidence export failed',
    CAPTURE_CREDENTIAL_SET: 'Camera credential set',
    CAPTURE_CREDENTIAL_REVEALED: 'Camera credential revealed',
    // Task 3 M6 (blueprint row 113; C3 §2.5; R-8).
    STT_CONFIG_CHANGED: 'Transcription configuration changed',
    // Task 3 R-9..R-11 (blueprint row 132, decision D106; C3 §5.2; UX spec §14.2 item 3).
    CAPTURE_DISCOVERY_SEARCHED: 'Camera search performed',
    CAPTURE_CONNECTION_TESTED: 'Camera connection tested',
    CAPTURE_CANDIDATE_ADOPTED: 'Camera added',
    CAPTURE_DEVICE_UNREACHABLE: 'Capture device not reachable',
    // Task 4 (blueprint row 19, WP-23a): the ten types of the input-av port.
    CAPTURE_AUDIO_INPUT_CHANGED: 'Microphone input changed',
    CAPTURE_NETWORK_CONFIG_CHANGED: 'Camera network configuration changed',
    HOST_ALIAS_ADDED: 'Temporary host address added',
    HOST_ALIAS_REMOVED: 'Temporary host address removed',
    HOST_ALIAS_REMOVE_FAILED: 'Temporary host address removal failed',
    CAMERA_FACTORY_SCANNED: 'Factory address scan performed',
    CAMERA_NETWORK_SET: 'Camera network address set',
    CAPTURE_DEVICE_ADDRESS_CHANGED: 'Camera address changed',
    INSTALLATION_ACCEPTED: 'Installation accepted',
    INSTALLATION_ACCEPTANCE_REVOKED: 'Installation acceptance revoked',
    OPERATOR_PASSWORD_SET: 'Operator password set from the host',
    // Task 4 (row V3): the four types of the third vocabulary step.
    HOST_ALIAS_REQUESTED: 'Temporary host address change requested',
    HOST_ALIAS_ADD_FAILED: 'Temporary host address could not be added',
    CAPTURE_AUDIO_ABSENT_ON_RESTART: 'Audio not recorded across a capture restart',
    CAPTURE_DEVICE_CONNECTION_TESTED: 'Registered camera connection tested',
    // Task 4 (row R1b): the video twin of the audio gap.
    CAPTURE_VIDEO_ABSENT_IN_SESSION: 'Video not recorded while a camera was absent',
    // Task 4 (row N2): the two types of an audio path that is not sample-continuous.
    CAPTURE_AUDIO_SAMPLES_NOT_RECEIVED: 'Audio samples not received from a microphone',
    CAPTURE_AUDIO_SILENCE_INSERTED: 'Silence inserted into the audio track',
    // Task 4 (row RD2): the retirement of a camera or microphone (operation 111).
    CAPTURE_DEVICE_RETIRED: 'Capture device retired',
    // Decisions D51 / D53: a live camera preview session was opened.
    CAMERA_PREVIEW_OPENED: 'Live camera preview opened',
    // Audit fix row 84 (DF-24, DF-25): the camera network link went down / came back.
    CAMERA_LINK_DOWN: 'Camera link down',
    CAMERA_LINK_UP: 'Camera link up',
  },

  /** Audit filter categories (sim `AuditCategory`). */
  auditCategory: {
    AUTH: 'Authentication',
    SESSION: 'Session',
    EVIDENCE: 'Evidence',
    DEVICE: 'Device',
    SECURITY: 'Security',
    STORAGE: 'Storage',
    PAIRING: 'Pairing',
    SYSTEM: 'System',
  },

  /** Operational events: Recent Events, the bell, timelines (sim `SimEventType`). */
  eventType: {
    SYSTEM_BOOT: 'System started',
    HEALTH_CHECK_OK: 'System health check completed',
    TIME_SYNC: 'Time synchronized',
    AUTH_LOGIN: 'Operator signed in',
    AUTH_LOGOUT: 'Operator signed out',
    AUTH_FAILED: 'Sign-in failed',
    AUTH_LOCKED: 'Sign-in locked',
    AUTH_EXPIRED: 'Sign-in expired',
    SESSION_CREATED: 'Session created',
    PRECHECK_STARTED: 'Pre-check started',
    PRECHECK_PASSED: 'Pre-check passed',
    PRECHECK_BLOCKED: 'Pre-check blocked',
    RECORDING_STARTED: 'Recording session started',
    RECORDING_STOPPED: 'Recording ended',
    SESSION_CANCELLED: 'Session cancelled',
    FINALIZATION_STARTED: 'Finalization started',
    EVIDENCE_SEALED: 'Evidence sealed',
    SESSION_INCOMPLETE: 'Session marked incomplete',
    EVIDENCE_EXPORTED: 'Evidence exported',
    EXPORT_DENIED: 'Export denied',
    EVIDENCE_VERIFIED: 'Evidence verified',
    EVIDENCE_VERIFY_FAILED: 'Evidence verification failed',
    EVIDENCE_REVIEW: 'Evidence opened for review',
    EVIDENCE_ARCHIVED: 'Evidence archived',
    MARKER_ADDED: 'Marker added',
    NOTE_ADDED: 'Note added',
    SNAPSHOT_TAKEN: 'Snapshot captured',
    AUTOSAVE: 'Evidence auto-saved',
    FAULT_RAISED: 'Fault raised',
    FAULT_CLEARED: 'Fault cleared',
    RECOVERY_STARTED: 'Recovery started',
    RECOVERY_COMPLETED: 'Recovery completed',
    STORAGE_WRITE_VERIFIED: 'Storage write verified',
    STORAGE_POLICY_CHANGED: 'Storage policy changed',
    DIAGNOSTICS_STARTED: 'Diagnostics started',
    DIAGNOSTICS_COMPLETED: 'Diagnostics completed',
    UPDATE_AVAILABLE: 'Update available',
    UPDATE_STARTED: 'Update started',
    UPDATE_COMPLETED: 'Update completed',
    PAIRED: 'Device paired',
    UNPAIRED: 'Device unpaired',
    PAIRING_FAILED: 'Pairing failed',
    TABLET_CONNECTED: 'Device connected',
    TABLET_DISCONNECTED: 'Device disconnected',
    SCENARIO_LOADED: 'Demo scenario loaded',
    AUDIT_CHAIN_BROKEN: 'Audit chain broken',
  },

  /** The tracks per medium — four video tracks (D60, 2026-11-04) and FOUR audio channels (D61, 2026-11-04; research/04 §9 #8: MIC 1 is the interviewer). */
  tracks: {
    'VIDEO-01': 'Camera 1',
    'VIDEO-02': 'Camera 2',
    'VIDEO-03': 'Camera 3', // D60 (2026-11-04): four simultaneous video tracks
    'VIDEO-04': 'Camera 4', // D60
    'AUDIO-01': 'MIC 1 - Interviewer',
    'AUDIO-02': 'MIC 2 - Subject',
    'AUDIO-03': 'MIC 3 - Channel 3', // D61 (2026-11-04): four simultaneous audio channels
    'AUDIO-04': 'MIC 4 - Channel 4', // D61
  },
  devices: {
    camera1: 'Camera 1',
    camera2: 'Camera 2',
    camera3: 'Camera 3', // D60 (2026-11-04)
    camera4: 'Camera 4', // D60
    mic1: 'MIC 1',
    mic2: 'MIC 2',
    mic3: 'MIC 3', // D61 (2026-11-04): the third and fourth microphones of the four-channel plane
    mic4: 'MIC 4', // D61
    cameraFormat: '{{resolution}} • {{fps}} fps',
    cameraFormatCodec: '{{resolution}} • {{fps}} fps • {{codec}}',
    // The same two lines for a stream that states no rate (the slice's `fps` is null): no rate is printed.
    cameraFormatNoRate: '{{resolution}}',
    cameraFormatCodecNoRate: '{{resolution}} • {{codec}}',
    // Row V6 (finding S-01; decision C36): a track for which no stream statement is stored - the picture or the codec is null. Never a default in its place.
    cameraFormatNotStated: 'Not stated',
  },
  deviceMenu: {
    label: 'Device actions',
    details: 'Details',
    testSignal: 'Test signal (simulated)',
    identify: 'Identify (blink)',
    restart: 'Restart (simulated)',
    // Task 3 M2-W7 (C3 §0; E-12): the PoE cycle of a lost-stream camera (op 48, OD-22).
    poeCycle: 'Power-cycle (PoE)',
  },

  /** Storage vocabulary shared by Dashboard F, Session Monitor S and the Storage page (D28/Q1). */
  storage: {
    usedLabel: 'USED',
    usedPercent: '{{percent}}% used',
    freeOf: '{{free}} free of {{total}}',
    used: 'Used',
    free: 'Free',
    sealedEvidence: 'Sealed Evidence',
    pending: 'Pending',
    writeSpeed: 'Write Speed',
    sessionSize: 'Session Size',
    estRemaining: 'Est. Remaining',
  },

  /** Quick actions shared by Dashboard J and System & Maintenance. */
  quickActions: {
    title: 'QUICK ACTIONS',
    runDiagnostics: {
      title: 'Run Diagnostics',
      subtitle: 'Full system health check',
    },
    reviewAudit: {
      title: 'Review Audit',
      subtitle: 'View system audit logs',
    },
    exportEvidence: {
      title: 'Export Evidence',
      subtitle: 'Secure export & verify',
    },
    openMaintenance: {
      title: 'Open Maintenance',
      subtitle: 'System configuration & tools',
    },
    softwareUpdate: {
      title: 'Software Update',
      subtitle: 'Signed A/B system update',
    },
  },

  time: {
    zone: 'UTC{{offset}}',
    today: 'Today',
    yesterday: 'Yesterday',
    justNow: 'Just now',
    lastSync: 'Last sync {{time}}',
  },

  units: {
    tb: '{{value}} TB',
    gb: '{{value}} GB',
    mb: '{{value}} MB',
    mbPerSecond: '{{value}} MB/s',
    mbps: '{{value}} Mbps',
    gbPerHour: '{{value}} GB/h',
    dbfs: '{{value}} dBFS',
    percent: '{{value}}%',
    fps: '{{value}} fps',
    ms: '{{value}} ms',
    celsius: '{{value}} °C',
    rpm: '{{value}} RPM',
    hoursMinutes: '{{hours}}h {{minutes}}m',
    days_one: '{{count}} day',
    days_other: '{{count}} days',
  },

  rbac: {
    deniedTitle: 'Not permitted',
    requiresRole: 'Requires the {{role}} role',
    /**
     * Backend task W16: labels of the three permissions added to the sim `Permission` set
     * (2026-10-04 01_specs §4.3). The map the clients read is `securityAudit.rbac.permissions.*`,
     * which holds all twelve, these three included (D37, D41); a label here must read the same
     * there (`test/i18n-vocabulary-sync.test.ts`).
     */
    permissions: {
      PAIRING_MANAGE: 'Manage pairing and paired devices',
      USER_ADMIN: 'Manage users and roles',
      DEMO_CONTROL: 'Use the demo controls',
      // Task 3 M2-W6 (SH-04): the two capture-phase permissions.
      CAPTURE_CONFIG: 'Configure capture devices',
      TRANSCRIPT_REVISE: 'Revise transcripts',
    },
  },

  simulated: {
    chip: 'SIMULATED',
    note: 'Simulated in this demo',
  },

  /**
   * Backend task W50 (2026-10-04 04_client_integration_spec §3.2, §3.3): the data mode of a
   * client. SIMULATED: the in-app simulator is the Core. LIVE: the Core server is the Core. The
   * maps are keyed by the wire values of `CoreMode` (`src/live/mode.ts`).
   */
  coreMode: {
    label: 'Data mode',
    chip: {
      SIMULATED: 'SIMULATED',
      LIVE: 'LIVE',
    },
    chipOffline: 'LIVE · OFFLINE',
    chipReconnecting: 'LIVE · RECONNECTING',
    name: {
      SIMULATED: 'Simulated',
      LIVE: 'Live',
    },
    switchTitle: {
      SIMULATED: 'Switch to Simulated mode?',
      LIVE: 'Switch to Live mode?',
    },
    switchBody: 'You will be signed out and the console reloads. Simulated data and Live data are separate.',
    switchConfirm: {
      SIMULATED: 'Switch to Simulated mode',
      LIVE: 'Switch to Live mode',
    },
    switchFailed: 'The mode could not be saved in this browser. Nothing was changed.',
    useSimulated: 'Use Simulated mode',
  },

  /** Backend task W50 (§3.5): the link between a client in Live mode and the Core server. */
  coreLink: {
    lostTitle: 'Core server unreachable',
    lostBody: 'The screen shows the last state received. Reconnecting…',
    retryNow: 'Retry now',
    restored: 'Reconnected to the Core',
    starting: 'The Core server is starting',
  },

  /**
   * Backend task W50 (§6.2; §8.1 LB-6, LB-7, LB-10): how a Live call that the Core refused, or
   * that got no usable answer, is worded on every page alike. A limit is not an outage: a 429
   * names the seconds of `retry-after` and never uses the "unreachable" sentences.
   */
  coreErrors: {
    offline: 'Core server unreachable. Nothing was changed.',
    starting: 'The Core server is starting. Nothing was changed.',
    /**
     * FXR-W W92-13 (FW76-3): the outage and starting sentences for a read that follows a command the
     * Core already ACCEPTED (an export's paged walk). "Nothing was changed" would contradict the page,
     * which says the Core recorded the export.
     */
    offlineAfterAccepted: 'Core server unreachable.',
    startingAfterAccepted: 'The Core server is starting.',
    timedOut:
      'Core server unreachable. The command may or may not have been applied; the screen updates when the Core is reachable.',
    limited: 'The Core server is limiting requests from this console. Try again in {{seconds}} s.',
    limitedNoTime: 'The Core server is limiting requests from this console. Try again shortly.',
    unavailable: 'The Core server could not complete the request. Try again.',
    notSent: 'The request was not sent: the stored credentials could not be read. Nothing was changed.',
    snapshotTimeout:
      'The sign-in was accepted, but the Core state has not arrived. The console continues when the Core server is reachable.',
    notAvailable: 'This action is not available in Live mode.',
    demoDisabled: 'Demo controls are disabled on this Core server.',
    originNotAllowed: 'The Core server does not accept requests from this address. Open the console at {{address}}.',
  },

  /** Backend task W50 (§4.1 WT-2a): the web console was opened at an address the Core server does not accept. */
  liveHost: {
    title: 'Live mode needs another address',
    body: 'This page was opened at {{current}}. The Core server accepts the web console only from {{expected}}, so a sign-in from here would be refused.',
    open: 'Open {{address}}',
    simulatedNote: 'Simulated mode works at this address: nothing is sent to a server.',
  },

  states: {
    loading: 'Loading…',
    empty: 'Nothing to show yet',
    notAvailable: 'Not available',
  },

  errors: {
    generic: 'Something went wrong. Please try again.',
    network: 'Connection problem. Check the Core link and try again.',
    maxRetries: 'Max retries reached. Reload the page.',
    panelTitle: 'This panel could not be displayed',
    panelBody: 'The rest of the console keeps working.',
    notFoundTitle: 'Page not found',
    notFoundBody: 'The page you asked for does not exist.',
  },

  /**
   * Task 3, R-9 / R-10 / R-11 (blueprint rows 137 web, 138 tablet and phone; `08_client_ux_spec.md`
   * §14.2, flows 9 to 13): the six blocks below are the spec's keys, verbatim. Vocabulary of §14.1:
   * "search", "camera", "connect", "add" — never "discovery", "candidate", "credential", "adopt".
   * A text written "(s)" in the spec is an i18next `_one` / `_other` pair here.
   */
  captureSearch: {
    action: 'Search for cameras',
    again: 'Search again',
    intro: 'Search the network for cameras. Searching connects to nothing.',
    searching: 'Searching the network for cameras…',
    searchingHint: 'This takes up to {{seconds}} seconds.',
    finishing: 'Finishing the search…',
    summary: '{{count}} found · {{newCount}} new · {{registeredCount}} already registered',
    freshness: 'Searched at {{searchedAt}}. Kept until {{keptUntil}}.',
    ownerNote: 'Only you see this list, on this device.',
    trustNote: 'Make, model and name are what each device announced. They are not checked.',
    emptyTitle: 'No camera answered the search',
    emptyBody: 'Check that each camera is powered and on the same network as the Core, then search again.',
    truncated: 'More than {{max}} devices answered. The first {{max}} are listed.',
    failed: 'The search could not be completed. Nothing was changed.',
    unavailable: 'Camera search is not available on this Core.',
    busy: 'Another operator is searching right now. Search again when their search has finished.',
    expired: 'This search result is no longer kept. Search again to see the cameras.',
    developmentGroup: 'Development sources',
    columns: {
      address: 'Address',
      makeModel: 'Make and model',
      name: 'Name',
      status: 'Status',
    },
    makeModelUnknown: 'Make and model not announced',
    status: {
      NEW: 'New',
      REGISTERED: 'Already registered',
    },
    registeredAs: 'Already registered as {{device}}',
    notTestable: 'Cannot be connected',
    notTestableBody: 'This device announced an address that is not its own.',
    viewDevice: 'View device',
    conflict: 'Two devices announce the same identity. Neither can be connected.',
    addressChanged: 'This camera now answers from another address than the registered one.',
    networksSearched_one: 'Searched {{count}} network.',
    networksSearched_other: 'Searched {{count}} networks.',
    recordingLocked: 'Camera search is not available while a session is recording.',
    /**
     * Task 4, blueprint row 98 (WP-12): the optional `address` of operation 93, web console only. The
     * explicit fallback for a camera that does not answer the search. `form` is the rule of the form
     * (a dotted IPv4 literal); `notAllowed` is `422` with `DISCOVERY_ADDRESS_NOT_ALLOWED`; `notProbed`
     * is the `200` with `created: false` (the caller's own search was still running).
     */
    typedAddress: {
      title: 'A camera that does not answer the search',
      intro: 'If a camera is connected but not in the list, type its address. The Core asks that one address and lists the camera if it answers.',
      label: 'Camera address',
      hint: 'An IPv4 address, for example 192.168.10.20. No name, port or link.',
      action: 'Search this address',
      form: 'Type an IPv4 address: four numbers from 0 to 255, separated by dots.',
      notAllowed: 'The Core does not ask this address. It asks only private addresses on a network the Core is connected to. Nothing was sent.',
      searching: 'A search is running. An address can be asked when it has finished.',
      notProbed: 'Your search was still running, so this address was not asked. Search this address again when the search has finished.',
    },
    a11y: {
      progress: 'Camera search in progress',
      done: 'Search finished: {{count}} found, {{newCount}} new.',
    },
  },

  captureConnect: {
    action: 'Connect',
    webOnly: 'Connect this camera from the web console.',
    webOnlyNote: 'Camera passwords are entered on the web console only. Open Devices on the web console and search there.',
    locked: 'A camera cannot be connected while a session is open.',
    title: 'Connect {{name}}',
    reference: 'Device reference',
    unverified: 'This device has not been verified. Its name and model are what it announced.',
    intro: 'Enter the user name and password set on this camera. They are used for this connection only and are never shown again.',
    digestNote:
      'Sent as a digest: not readable in transit, but a device that receives it can test guesses against it. Use a password that is used for this camera only.',
    username: 'Camera user name',
    password: 'Camera password',
    required: 'Enter the camera user name and password.',
    charset: 'Use letters, digits and common symbols only (printable ASCII).',
    reveal: {
      show: 'Show password',
      hide: 'Hide password',
    },
    confirmDevice: 'I have checked that {{address}} is this camera',
    // Closing pass J (ruling of `contract_wave_i_a2.md` section 1, G70b-02): a development source MAY need no password - the Core does not know before a test. The web console's `web.connect.developmentHint` is the same sentence.
    noPasswordNeeded: 'A development source can be tested without a password. If the test asks for one, turn on "Enter a user name and password".',
    enterPassword: 'Enter a user name and password',
    change: 'Change',
    test: 'Test connection',
    testing: 'Testing the connection…',
    testingHint: 'This can take up to {{seconds}} seconds.',
    outcome: {
      REACHABLE: 'Connection works. This camera can be added.',
      UNREACHABLE: 'The camera did not answer. Check its power and network cable, then test again.',
      AUTHENTICATION_FAILED: 'The camera refused this user name or password.',
      WRONG_PROFILE:
        'The camera answered, but it offers no video profile this system can use. Change the video settings on the camera, then test again.',
      // Task 4 (row 38's request; AM-2): the outcome means "no usable profile: the stream is neither H.264 nor HEVC". The key is unchanged.
      NOT_H264: 'The camera answered, but none of its video profiles delivers H.264 or HEVC. Set the camera to one of them, then test again.',
    },
    outcomeShort: {
      REACHABLE: 'Connection works',
      UNREACHABLE: 'No answer',
      AUTHENTICATION_FAILED: 'Password refused',
      WRONG_PROFILE: 'No usable profile',
      NOT_H264: 'Neither H.264 nor HEVC',
    },
    profiles_one: '{{count}} usable video profile',
    profiles_other: '{{count}} usable video profiles',
    attemptsLeft_one: '{{count}} more attempt before testing this camera is paused.',
    attemptsLeft_other: '{{count}} more attempts before testing this camera is paused.',
    lockoutGuard: 'Testing this camera is paused so that the camera does not lock its account. Try again after {{time}}.',
    inProgress: 'A connection test for this camera is already running.',
    add: 'Add as camera',
    adding: 'Adding the camera…',
    added: '{{device}} was added.',
    passwordStored: 'Password stored.',
    noPasswordUsed: 'No password is used for this source.',
    // D60 (2026-11-04): four camera slots, not two.
    addedNext: 'The camera is registered but not yet used. Assign it to Camera 1 through Camera 4.',
    assign: 'Assign to a camera slot',
    storeNotReady: 'This Core cannot store camera passwords yet, so this camera cannot be added. Nothing was saved.',
    testTooOld: 'The connection test is too old. Test the connection again.',
    finalCheckFailed: 'The camera did not pass the final check, so it was not added.',
    alreadyRegistered: 'This camera is already registered as {{device}}.',
    resultGone: 'This search result is no longer kept. Search again.',
    /**
     * Reason `COMMISSIONING_NOT_CONFIGURED` of a connection test (review finding F3-06, the operator's side):
     * no camera network is configured on the Core. Worded by row W4 in the web's own tree and moved here
     * unchanged by pass I-9b (request line of row W4). `{{screen}}` is the client's name of its
     * commissioning screen.
     */
  },

  captureNotice: {
    discoveryEmpty: {
      title: 'No camera found',
      body: 'The last search found no camera on the network.',
    },
    unreachable: {
      precheck: {
        title: '{{device}} is not reachable',
        camera_one: 'It did not answer the pre-check. A search found {{count}} camera.',
        camera_other: 'It did not answer the pre-check. A search found {{count}} cameras.',
        microphone: 'It did not answer the pre-check.',
      },
      sessionStart: {
        title: '{{device}} is not connected',
        // D60 (2026-11-04): four video tracks — an unreachable camera costs one track, not all but one.
        body: 'The session is recording with one camera fewer.',
      },
    },
    noCamera: {
      title: 'No camera connected',
      body: 'Nothing was recorded.',
    },
    cause: {
      UNREACHABLE: 'It did not answer.',
      AUTHENTICATION_FAILED: 'It refused the stored password. Set the camera password again on the web console.',
      NOT_CONNECTED: 'It did not connect in time.',
      PERMISSION_DENIED: 'macOS has not allowed access for the Core.',
      DEVICE_BUSY: 'Another application is using it.',
      DEVICE_NOT_FOUND: 'It was not found.',
    },
    start: {
      noCamera: 'No camera is reachable. A session cannot start.',
      // D60 (2026-11-04): four video tracks — the loss costs one camera, whatever the total.
      oneCamera: '{{device}} is not reachable. The session will record with one camera fewer.',
      noMicrophone: 'No microphone is reachable. A session cannot start.',
      // D61 (2026-11-04): the four channels record SIMULTANEOUSLY — the loss of a channel costs that
      // channel, and the transcribed channel 1 blocks because the transcript would lose its source.
      activeMicrophone:
        '{{device}} is the microphone of the transcribed channel 1 and is not reachable. Cancel this session, assign another microphone to channel 1 on Devices, then start again.',
      activeMicrophoneFallback: 'Cancel this session, assign another microphone to the transcribed channel 1 on Devices, then start again.',
      noStandby: '{{device}} is not reachable. The session will record without that microphone channel.',
      oneMicrophone: '{{device}} is not reachable. The session will record with one microphone channel fewer.',
      notRecordable: '{{device}} cannot be recorded by this version of the system.',
      // Task 4 row 28 (WP-13a; names register N13): the pre-check item of an unassigned selector
      // slot. One sentence for BLOCK and WARN; it promises nothing about the start.
      sourceNotAssigned: '{{slot}} has no source assigned. Assign one on Devices.',
    },
  },

  // Task 4 row 28 (WP-13a; decision C18 (3); names register N14): the EIGHT slots of the device
  // selector (D60, 2026-11-04: four video slots; D61 of 2026-11-04: the two microphone roles became
  // the four numbered channels) and the words of an empty one. Keyed by the values of
  // `CAPTURE_SELECTOR_SLOTS`.
  captureSlot: {
    'VIDEO-01': 'Camera 1',
    'VIDEO-02': 'Camera 2',
    'VIDEO-03': 'Camera 3', // D60 (2026-11-04)
    'VIDEO-04': 'Camera 4', // D60
    'MIC-01': 'Microphone 1', // D61 (2026-11-04): the roles became the numbered channels
    'MIC-02': 'Microphone 2', // D61
    'MIC-03': 'Microphone 3', // D61
    'MIC-04': 'Microphone 4', // D61
    notAssigned: 'Not assigned',
    assign: 'Assign',
    assignLabel: 'Assign a source to {{slot}}',
  },

  // Task 4 row 187 (ruling C36 (1); integration pass I-7): why a Core in real capture refused to
  // assign a production camera to a slot (operations 78 and 79, `422 INVALID_INPUT`). Keyed by the
  // word of `details.reason`, as `captureAudioCards.refusal` is. Both are refusals: nothing changed.
  captureSlotRefusal: {
    CAMERA_PROFILE_NOT_STATED: 'This camera was not assigned: no stream profile was chosen for it, and the Core does not pick one for a camera. Choose one of the profiles stored for this camera, then assign it again.',
    CAMERA_PROFILE_NOT_OF_DEVICE: 'This camera was not assigned: the chosen stream profile is not one of the profiles stored for this camera. Choose one of them, then assign it again.',
    // Task 4 row V7c (decision C130; row S86a, caution C-1 of row 86): the profile is LISTED for the
    // camera, but the Core holds no stored stream row for it (an old raw camera token, or a code no
    // stream stated). The one remedy is a new adoption; a connection test stores nothing on a difference.
    CAMERA_PROFILE_WITHOUT_STREAM:
      'This camera was not assigned: the Core holds no stream facts for this profile, so the camera cannot record it. A connection test does not repair this. Adopt the camera again, then assign one of the profiles it states.',
    // Task 4 row V4 (decision C80; rows 234 and 116): the four refusals of a slot assignment the web
    // console worded in its own tree, MOVED HERE WORD FOR WORD - the web's wording is the wording,
    // and this is its one source. `{{source}}` is the kind of the refused row, one of the two nouns
    // of `captureSlotSource` below: these four are answered for a camera and for a microphone.
    PRODUCTION_SOURCE_NOT_ALLOWED:
      'This {{source}} was not assigned: it is a production device, and this Core runs in development capture operation. This {{source}} can be assigned only on a Core running in production capture operation. Nothing was changed.',
    CAPTURE_DEVICE_NOT_SERVED:
      'This {{source}} was not assigned: it is registered, but no capture adapter of the running Core serves it, so this Core cannot record from it. Nothing was changed.',
    CAPTURE_DEVICE_CLASS_MISMATCH: 'This device was not assigned: the Core does not hold it as a {{source}}. Nothing was changed.',
    SLOT_UNASSIGNED_AND_ASSIGNED: 'This choice was not accepted: one request cleared a slot and filled the same slot. Nothing was changed.',
    // Task 4 row RD2 (design 07 section 4.4; decision C147): the device was retired (operation 111) and is never assigned again.
    CAPTURE_DEVICE_RETIRED: 'This {{source}} was not assigned: it is retired, and a retired device is never assigned again. Nothing was changed.',
  },
  /** The noun `{{source}}` of a `captureSlotRefusal` sentence stands for, by the kind of the refused row (row V4). */
  captureSlotSource: { CAMERA: 'camera', MIC: 'microphone' },

  // Task 4 row RD2 (design 07 sections 4.3-4.5; decision C147, rulings Q1-Q2): operation 111, the
  // retirement of a registered camera or microphone. `refusal` is keyed by the word of
  // `details.reason` (`CAPTURE_CONFIG_LOCKED` by the error code, `NOT_FOUND` by the code of the 404);
  // `{{source}}` is a noun of `captureSlotSource`, `{{slot}}` a name of `captureSlot`. `reason`
  // labels the three closed reasons of the body; `state.retired` is the state a device list shows.
  captureRetire: {
    action: 'Retire',
    state: { retired: 'Retired' },
    reason: {
      REMOVED: 'Removed for good',
      REPLACED: 'Replaced by another unit',
      STATEMENT_CHANGED: 'The camera now states other stream profiles',
    },
    refusal: {
      CAPTURE_CONFIG_LOCKED: 'A session is open. Devices can be retired only while no session is open.',
      CAPTURE_DEVICE_ASSIGNED: 'This {{source}} is assigned to {{slot}}. Unassign it first, then retire it. Nothing was changed.',
      CAPTURE_DEVICE_RETIRED: 'This {{source}} is already retired. Nothing was changed.',
      CAPTURE_DEVICE_BUILT_IN: 'The demo devices of the simulator and the PoE switch cannot be retired. Nothing was changed.',
      CONNECTION_TEST_IN_PROGRESS: 'A connection test of this camera is running. Wait until it ends, then retire it. Nothing was changed.',
      NOT_FOUND: 'This device is not in the registry. Nothing was changed.',
    },
  },

  sourceClass: {
    badge: 'Development source',
    kind: {
      localCamera: "This Mac's camera",
      localMicrophone: "This Mac's microphone",
      test: 'Test source',
    },
    verify: {
      development: 'DEVELOPMENT SOURCES — this package was not recorded from production devices.',
      production: 'Sources: declared as production devices by the Core that sealed this package.',
      untrusted: 'Sources: not trustworthy — the manifest was altered',
      v1: 'Sources: not recorded for this demonstration item',
    },
    microphoneOn: {
      web: "This Mac's microphone is on",
      mobile: "Core Mac's microphone is on",
    },
    cameraOn: {
      web: "This Mac's camera is on",
      mobile: "Core Mac's camera is on",
    },
  },

  localDevice: {
    state: {
      READY: 'Ready',
      PERMISSION_DENIED: 'Permission needed',
      DEVICE_BUSY: 'In use',
      DEVICE_NOT_FOUND: 'Not found',
    },
    permissionCamera:
      'macOS has not allowed camera access for the Core. On the Mac that runs the Core, open System Settings > Privacy & Security > Camera, allow it, then search again.',
    permissionMicrophone:
      'macOS has not allowed microphone access for the Core. On the Mac that runs the Core, open System Settings > Privacy & Security > Microphone, allow it, then search again.',
    busyCamera: 'Another application is using this camera. Close that application, then search again.',
    busyMicrophone: 'Another application is using this microphone. Close that application, then search again.',
    notFoundCamera: "This Mac's camera was not found.",
    notFoundMicrophone: "This Mac's microphone was not found.",
    openFailed: {
      chip: 'Could not be opened',
      body: "This Mac's camera (microphone) could not be opened. Check its permission on the Mac that runs the Core, then search again.",
      /** The same sentence with the one device it is about (row 137: a row names its own kind). */
      camera: "This Mac's camera could not be opened. Check its permission on the Mac that runs the Core, then search again.",
      microphone: "This Mac's microphone could not be opened. Check its permission on the Mac that runs the Core, then search again.",
    },
  },

  captureInputs: {
    againLabel: 'Search again for microphones',
    description: 'Re-reads the microphones connected to the Core. Microphones are not searched on the network.',
    checkedAt: 'Checked at {{time}}',
    unregistered_one: '{{count}} other microphone is connected to the Core but not registered.',
    unregistered_other: '{{count}} other microphones are connected to the Core but not registered.',
  },

  /**
   * Task 4, blueprint row 72 (WP-07d): the list of sound cards and the registration of one input as a
   * microphone (operations 98 and 99; web console only). Every sentence says what an answer of the
   * Core states: a listing, a registration (`result`, by its change code) or a refusal (`refusal`, by
   * its reason). A product name is device text and is never part of a sentence here.
   */
  captureAudioCards: {
    title: 'Sound cards',
    action: 'List sound cards',
    again: 'List again',
    description: 'Lists the sound cards connected to the Core. Listing opens no card and registers nothing.',
    listedAt: 'Listed at {{time}}',
    empty: 'The Core found no sound card.',
    truncated: 'The Core has more sound cards than it lists. The first {{max}} are listed.',
    trustNote: 'Product names are what each sound card announced. They are not checked.',
    card: {
      inputs_one: '{{count}} input',
      inputs_other: '{{count}} inputs',
      sampleBits: 'Sample sizes: {{bits}} bit',
      usbId: 'USB ID {{id}}',
      notUsb: 'Not a USB card',
      device: 'Capture device {{index}}',
      boundTo: 'Bound to {{device}}',
      notTellable: 'Two sound cards of this model state no serial number. The Core cannot tell which one {{device}} uses, so neither is offered.',
    },
    inputsLabel: 'Inputs of sound card {{position}}',
    input: 'Input {{number}}',
    registeredAs: 'Registered as {{device}}',
    release: 'Move {{device}} to another input',
    releaseHint: '{{device}} will move to the input you choose and stop using its present input. Choose the input, then register it.',
    released: '{{released}} now uses input {{number}} of this sound card. Its old input was released.',
    pickHint: 'Choose one input of one sound card. A microphone is one input; inputs are never mixed.',
    pickFirst: 'Choose an input first.',
    register: 'Register as microphone',
    locked: 'Sound cards cannot be listed and no input can be registered while a session is open.',
    busy: 'The Core is listing the sound cards right now. Try again when it has finished.',
    notReady: 'This Core cannot list sound cards or register an input now. Nothing was changed.',
    listFailed: 'The sound cards could not be listed. Nothing was changed.',
    result: {
      REGISTERED: 'Input {{number}} is registered as {{device}}. It is not used until it is assigned as a microphone.',
      REENABLED: 'Input {{number}} already has a microphone, {{device}}. It is enabled again; no second microphone was made.',
      CARD_CHANGED: 'Input {{number}} is {{device}}, which was stored for another sound card. It now names this sound card.',
    },
    refusal: {
      NOT_FOUND: 'The Core no longer finds this sound card. List the sound cards again.',
      AUDIO_INPUT_BEYOND_CARD: 'This sound card has no input of that number. List the sound cards again.',
      AUDIO_INPUT_NOT_REGISTRABLE: 'This Core cannot capture from this sound card, or cannot find it again, so the input was not registered. Nothing was saved.',
      AUDIO_CARD_ALREADY_BOUND: 'This input of the sound card is already used by {{device}}. List the sound cards again, or choose another input. Nothing was saved.',
      FAILED: 'The input could not be registered. Nothing was saved.',
    },
  },

  /**
   * Integration pass D2 (D133 (1)): the name of a microphone beyond the built-in pair, from the number of its `MIC-NN` id.
   * Ruling D137: it reads "MIC 3", the form of the built-in "MIC 1" / "MIC 2" (`devices.mic1` / `devices.mic2`).
   */
  captureDeviceName: {
    microphone: 'MIC {{number}}',
  },

  /**
   * Blueprint row 139 (R-10 situation C; ux §8e.2, §14.2; decisions D84, D91): the session start in real capture.
   * `connectingCameras` is the key of ux §14.2; the others word what that section describes without a key.
   */
  session: {
    connectingCameras: 'Connecting cameras…',
    /** Why End Session is disabled before the first durable fragment (the Core answers `CAPTURE_NOT_DURABLE`). */
    stopWhileConnecting: 'Nothing is recorded yet: the cameras are still connecting. The session ends by itself if no camera connects.',
    /** A camera or a recording row while the cameras connect: never "REC". */
    trackConnecting: 'CONNECTING',
    failedStart: {
      /** A failed start whose cause is not "no camera connected". The body is `captureNotice.noCamera.body`. */
      title: 'Recording did not start',
      /** The pointer to the place where "Search again" is. */
      openDevices: 'Open Devices',
      next: 'Check the cameras on Devices, then close this session and start a new one.',
      /** The close of a session that recorded nothing (the Core's recovery of it: a history entry, no evidence item). */
      close: 'Close session',
    },
  },

  /**
   * Task 3, R-11 (blueprint row 140; rulings D137 (2), D128, D136 (3)): the cards / rows of the
   * devices the Core registered beyond the four built-in ids (this Mac's camera `CAM-03` and
   * microphone `MIC-03`, an added camera), drawn from the Core's device list on Devices of the web
   * console, the tablet and the phone. The names and the badge are the blocks above
   * (`sourceClass`, `localDevice`, `captureSearch.viewDevice`); this block holds what only the
   * roster says. `MIC_RATE_AT_LIMIT` is the code of the capture protocol and stays as it is.
   */
  developmentRoster: {
    cameras: 'Registered cameras',
    microphones: 'Registered microphones',
    kind: {
      CAMERA: 'Camera',
      MIC: 'Microphone',
    },
    name: '{{kind}} {{id}}',
    usedAs: {
      'VIDEO-01': 'Feeds Camera 1',
      'VIDEO-02': 'Feeds Camera 2',
      'VIDEO-03': 'Feeds Camera 3', // D60 (2026-11-04): four video tracks
      'VIDEO-04': 'Feeds Camera 4', // D60
      // D61 (2026-11-04): the roles became the four numbered channels.
      'MIC-01': 'Feeds Microphone 1 (transcribed)',
      'MIC-02': 'Feeds Microphone 2',
      'MIC-03': 'Feeds Microphone 3',
      'MIC-04': 'Feeds Microphone 4',
      NONE: 'Not assigned',
    },
    reachable: 'Reachable',
    notReachable: 'Not reachable',
    rateAtLimit: {
      title: 'Rate correction at its limit (MIC_RATE_AT_LIMIT)',
      body: 'This microphone does not keep the sample rate it declares. The Core is inserting or dropping samples to hold it in step. The recording continues.',
    },
    limits: {
      title: 'Limits of this development source',
      localMicrophone:
        'Not fit for recording yet. In measured runs this microphone delivered about 8/9 of the sample rate it declares; the cause is not proven. Expect the warning MIC_RATE_AT_LIMIT during a session. Use it for development checks only.',
      localCamera: 'Variable frame rate: each frame carries the time it was read. The fixed frame-grid check does not apply to this source.',
      test: 'A generated test picture or tone. It records nothing of the room.',
    },
    field: {
      id: 'Device ID',
      kind: 'Kind',
      model: 'Model',
      source: 'Source',
      address: 'Address',
      usedAs: 'Used as',
      stream: 'Stream',
    },
    modelUnknown: 'Not announced',
    source: {
      LOCAL_DEVICE: 'The Mac that runs the Core',
      FAKE: 'Generated test source',
      ONVIF_RTSP: 'Network camera',
      USB_AUDIO: 'USB audio input',
      OTHER: 'Registered device',
    },
    detailLabel: 'Details of {{name}}',
  },

  /**
   * Fix F-M4 (code review row 69, findings R69-01 and R69-07; decision D178): what a client says
   * BEFORE it asks the Core for a pre-check on a selector that names a camera or a microphone of
   * the Mac that runs the Core (adapter `LOCAL_DEVICE`). The pre-check opens that device, so the
   * operator confirms first; without the confirmation nothing is sent. `web` is the console on the
   * Core Mac itself ("this Mac's", the wording of D83); `mobile` is the tablet and the phone
   * ("the Core Mac's"). `{{camera}}` / `{{microphone}}` are the device ids of the selector lines.
   * `microphoneLimit` is the short form of `developmentRoster.limits.localMicrophone`, shown where
   * the operator chooses or checks that microphone.
   */
  localSourceNotice: {
    title: 'Turn on a local device',
    web: {
      camera: "This will turn on this Mac's camera ({{camera}}).",
      microphone: "This will turn on this Mac's microphone ({{microphone}}).",
      both: "This will turn on this Mac's camera ({{camera}}) and microphone ({{microphone}}).",
    },
    mobile: {
      camera: "This will turn on the Core Mac's camera ({{camera}}).",
      microphone: "This will turn on the Core Mac's microphone ({{microphone}}).",
      both: "This will turn on the Core Mac's camera ({{camera}}) and microphone ({{microphone}}).",
    },
    body: 'The device check opens the device. Nothing is sent to the Core until you confirm.',
    confirm: 'Turn on and run the check',
    cancel: 'Not now',
    notStarted: 'The device check was not started again by itself, because it turns on a local device.',
    runCheck: 'Run the device check',
    microphoneLimit: 'Not fit for recording yet. Use it for development checks only.',
  },

  /**
   * Fix F-M4 (code review row 69, findings R69-12 and R69-13; decision D178), the connect dialog of
   * the web console. `confirm` replaces `captureConnect.confirmDevice` where the Core sent the full
   * target: the operator confirms the scheme, the host, the port and the path the Core will use.
   * `schemeNotAllowed*` word an AUTHENTICATION_FAILED test whose reason is `SCHEME_NOT_ALLOWED`:
   * the credential was not sent, so the sentence never says the camera refused it.
   */
  captureConnectTarget: {
    label: 'The Core will connect to',
    confirm: 'I have checked that {{target}} is this camera',
    schemeNotAllowed: 'This camera only accepts a sign-in method that this system does not use. The password was not sent.',
    schemeNotAllowedDetail: 'A camera with this setting cannot be connected by this version of the system. Typing the password again does not help.',
    schemeNotAllowedShort: 'Sign-in method not supported',
  },

  /**
   * Fix F-M4 follow-up (decision D181, ruling 7): what a client says BEFORE it asks the Core to
   * start a recording on a selector that names a camera or a microphone of the Mac that runs the
   * Core. A recording keeps the device on until it ends, so this notice is shown at every start
   * press - also when the pre-check notice (`localSourceNotice`) was confirmed in the same flow.
   * Without the confirmation nothing is sent. `web` / `mobile` and the interpolations as there.
   */
  localSourceStartNotice: {
    title: 'Turn on a local device for the recording',
    web: {
      camera: "This will turn on this Mac's camera ({{camera}}) and keep it on until the recording ends.",
      microphone: "This will turn on this Mac's microphone ({{microphone}}) and keep it on until the recording ends.",
      both: "This will turn on this Mac's camera ({{camera}}) and microphone ({{microphone}}) and keep them on until the recording ends.",
    },
    mobile: {
      camera: "This will turn on the Core Mac's camera ({{camera}}) and keep it on until the recording ends.",
      microphone: "This will turn on the Core Mac's microphone ({{microphone}}) and keep it on until the recording ends.",
      both: "This will turn on the Core Mac's camera ({{camera}}) and microphone ({{microphone}}) and keep them on until the recording ends.",
    },
    body: 'Nothing is sent to the Core until you confirm.',
    confirm: 'Turn on and start recording',
    cancel: 'Not now',
  },

  /**
   * Fix pass F-M5 (review R74-03): the sentence of a capture fault BY ITS REASON
   * (`params.reason` of a `CAPTURE_FAULT` / `MIC_SILENT` alert and of the capture advisories).
   * This block IS the table of `sim/capture-fault-wording.ts` (imported, never copied): a client
   * that translates `common.captureFault.reason.<REASON>` with `{ device }` and one that calls
   * `captureFaultSentence` read the same words. `unknown`: a reason without a sentence, with its
   * code. `noReason`: no reason at all.
   */
  captureFault: {
    reason: CAPTURE_FAULT_SENTENCES,
    unknown: CAPTURE_FAULT_UNKNOWN_SENTENCES,
    noReason: CAPTURE_FAULT_NO_REASON_SENTENCES,
  },
  /**
   * Task 4 row N2 (design 06 revision 3, sections 6.2, 8.3, 8.6; decisions U25 (3), C110 (2), (4)):
   * the words of an audio path that is NOT SAMPLE-CONTINUOUS (the bench microphone path of a Mac).
   * Both blocks ARE the tables of `sim/audio-not-continuous.ts` (imported, never copied).
   * `audioNotSampleContinuous`: the statement a client shows at the head of a transcript, of an
   * evidence item and of a session summary, with the fixed sentence (`sentence`) - never collapsed.
   * `micSameDevice`: what the operator reads INSTEAD of the plain channel-2 words when the
   * transcribed channel and channel 2 are two channels of one device (D61: the roles became the
   * numbered channels). The five notices of the path are in
   * `captureFault.reason`.
   */
  audioNotSampleContinuous: AUDIO_NOT_SAMPLE_CONTINUOUS_WORDS,
  micSameDevice: MIC_SAME_DEVICE_WORDS,
  /**
   * Fix pass F-M7b (review R88-02 (c)): the STATE of a recording the Core could not seal. This IS
   * the sentence of `sim/seal-unsealable.ts` (imported, never copied): the alert of the Core, the
   * Finalizing view and the Recovery view read the same words. `{{cause}}`: the code of the cause.
   */
  sealUnsealable: {
    notice: SEAL_UNSEALABLE_SENTENCE,
  },
  /**
   * Wave H driver B (G75-03 / G75-08, ruling D197): a SEALED recording that was INTERRUPTED. This
   * IS the table of `sim/capture-fault-wording.ts` (imported, never copied). Every session surface
   * shows `title` in place of the plain sealed state, then the cause sentence
   * (`interruptedSealCauseSentence`) and `kept`.
   */
  interruptedSeal: INTERRUPTED_SEAL_SENTENCES,
  /**
   * Wave H driver B (gate 75, G75-07 (b)): the system status WHILE A SESSION RECORDS and a critical
   * fault is active (a degraded recording: a camera lost (D60: four tracks), the others recording).
   * Nothing is blocked -
   * the Core says the session records - so a status card never reads "Recording Blocked" then.
   */
  criticalWhileRecording: {
    title: 'Recording — critical fault',
    subtitle: 'Recording {{sessionId}} continues. A critical fault needs action',
  },
  /**
   * Closing pass J (G75b-03, ruling D217 (5)): the restart fault of a Core in its own capture. This
   * IS `sim/core-not-running.ts` (imported, never copied). A surface that would name the fault kind
   * (`faultKind.POWER_FAIL`) shows `label` when the fault carries `coreNotRunning: true`
   * (`faultKindLabelKey`).
   */
  coreNotRunning: {
    label: CORE_NOT_RUNNING_LABEL,
    sentence: CORE_NOT_RUNNING_SENTENCE,
  },
  /**
   * Fix wave J (decision D243; `contract_wave_j.md`): ONE wording, for the web console and the mobile
   * app, of the facts the Core states since that wave. Each key names its member.
   */
  truth: {
    /** `hasSealedValues(item)` is false (JA2-01 / JW-01). */
    notSealed: 'Not sealed',
    notSealedDetail: 'This recording was never sealed. It has no sealed hash, no manifest and no signature, and there is nothing to verify.',
    /** `media.reason: DEMONSTRATION_RECORD` (JA2-02). */
    demonstrationRecord: 'Demonstration record of a simulated session: no media was recorded.',
    /** `demonstration: true` on a verdict of operation 41 (JA2-02). */
    demonstrationVerdict: 'Demonstration verdict: the hashes of a demonstration record were compared. No stored media was read.',
    demonstrationChip: 'DEMONSTRATION',
    /** `!isOwnCaptureCoreState(state)` in Live mode (JW-07). */
    simulatedCore: 'Simulated Core',
    simulatedCoreDetail: 'This Core runs in simulated capture: the feeds, the recording state and the integrity statements it shows are a demonstration.',
    /** `verificationOfRecordFailed(item)` (JT-04 / JW-09). */
    sealedVerificationFailed: 'Sealed · verification FAILED',
    /** `exportKinds[].available: false` (JA2-03 / JW-03); the reason sentence is `evidence.exportJob.compositeUnavailable`. */
    exportKindUnavailable: 'Not available in this build',
    /** `exportPhaseOfEvent(event) === 'REQUESTED'` (JW-03). */
    exportRequested: 'Export requested',
    /** "Download manifest" of an item sealed on this Core (JW-02). */
    manifestInExport: 'The signed manifest is part of the export package. Use Export.',
    /** `isLevelNotMeasured(frame)` (JW-08). */
    levelNotMeasured: 'Not measured',
    levelNotMeasuredDetail: 'The Core measures the level while a recording runs.',
    /** `isUpdaterNotAvailable(update)` (JT-06 / JW-06). */
    updaterNotAvailable: 'Software update is not available on this Core.',
    /** `isDiagnosticNotReported(check)` and the pre-check SECURITY note (JW-04 / JT-03). */
    notReportedByCore: 'Not reported by this Core',
    securityNotReported: 'Platform security: not reported. This Core reads no TPM and no Secure Boot state.',
    /** `incompleteSessionFactOf(entry).kind` (JW-22). */
    incompleteSession: {
      QUARANTINED: 'Recorded, could not be sealed. No evidence item exists; the recordings are kept in the quarantine folder of the Core.',
      RECORDED_NOT_SEALED: 'Interrupted. Its recording is kept as a record that was never sealed.',
      NEVER_RECORDED: 'Ended before a recording started.',
    },
    /** `evidenceVerification` of operation getSecurityStatus (GM-02). */
    neverVerified: '{{count}} of {{sealed}} sealed items have no verification of record.',
  },
  /**
   * Closing pass J (G75b-06, ruling D217 (7)): the platform facts of a Core that states
   * `security.platformNotReported`. One wording for the web console and the mobile app.
   */
  platformNotReported: {
    value: 'Not reported',
    tpm: 'TPM: not reported',
    secureBoot: 'Secure Boot: not reported',
    posture: 'Posture: not reported',
    note: 'This Core does not read a TPM or the Secure Boot state.',
  },
  /**
   * Closing pass J (G75b-06, the Network & Time screens): the time of a Core whose `time` slice says
   * `hostClock`. No GNSS, no "holdover", no stratum, no offset, no last synchronisation: nothing was
   * ever synchronised or measured.
   */
  hostClockTime: {
    label: 'Time',
    value: 'Host system clock',
    notice: 'This Core takes its time from the host system clock. GNSS, network time and a hardware clock are not configured, so no lock, stratum, offset or last synchronisation exists.',
  },
  /**
   * Closing pass J (item 7): a start the Core refuses because of the session key
   * (`503 NOT_READY`, `details.reason`; `contract_wave_i.md` section 5). The Core's own two sentences
   * (`sealing-host` `SESSION_KEY_START_TEXT`), word for word.
   */
  startRefused: {
    SESSION_KEY_NOT_OF_SESSION:
      "This session cannot be started: a session key of an earlier session with this session number is in the Core's key store, so its recording could not be sealed. Nothing was recorded. Cancel this session and create a new one.",
    SESSION_KEY_STORE_UNAVAILABLE: "This session cannot be started: the Core's key store cannot be used, so its recording could not be sealed. Nothing was recorded.",
  },
  /**
   * Audit fix row 84 (DF-19; register B1): the wording of a `FAULT_CLEARED` event on a session that is
   * still in FAULT. `{{kind}}` is the cleared fault kind. Row 110 builds the same sentence in
   * `sim/faults.ts` and pins it equal to this key.
   */
  faultCleared: {
    sessionStillInFault: 'Fault cleared · {{kind}}. The session is still in FAULT and needs recovery.',
  },
} as const satisfies ResourceTree;
