/**
 * `common.*`: terms every page and both apps share (brand, actions, statuses, enum labels,
 * subject types, units, errors). English UI; Indonesian domain terms verbatim (D28/Q3).
 * Enum maps are keyed by wire values: book enums from `src/domain/enums.ts`, demo
 * vocabulary (roles, audit types, fault kinds, …) from `src/sim/vocabulary.ts` as read on
 * 2026-10-01 02:36 WIB, so `t('common.auditType.' + row.type)` needs no lookup table.
 */
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
    PAIRING_SUCCESS: 'Tablet paired',
    PAIRING_FAILED: 'Pairing failed',
    PAIRING_LOCKED: 'Pairing locked',
    UNPAIRED: 'Tablet unpaired',
    TABLET_LINK_CHANGED: 'Tablet link changed',
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
    PAIRED: 'Tablet paired',
    UNPAIRED: 'Tablet unpaired',
    PAIRING_FAILED: 'Pairing failed',
    TABLET_CONNECTED: 'Tablet connected',
    TABLET_DISCONNECTED: 'Tablet disconnected',
    SCENARIO_LOADED: 'Demo scenario loaded',
    AUDIT_CHAIN_BROKEN: 'Audit chain broken',
  },

  /** The two tracks per medium (research/04 §9 #8: MIC 1 is the interviewer). */
  tracks: {
    'VIDEO-01': 'Camera 1',
    'VIDEO-02': 'Camera 2',
    'AUDIO-01': 'MIC 1 - Interviewer',
    'AUDIO-02': 'MIC 2 - Subject',
  },
  devices: {
    camera1: 'Camera 1',
    camera2: 'Camera 2',
    mic1: 'MIC 1',
    mic2: 'MIC 2',
    cameraFormat: '{{resolution}} • {{fps}} fps',
    cameraFormatCodec: '{{resolution}} • {{fps}} fps • {{codec}}',
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
    unavailable: 'Camera search is not available on this Core yet.',
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
      NOT_H264: 'The camera answered, but none of its video profiles is H.264. Set the camera to H.264, then test again.',
    },
    outcomeShort: {
      REACHABLE: 'Connection works',
      UNREACHABLE: 'No answer',
      AUTHENTICATION_FAILED: 'Password refused',
      WRONG_PROFILE: 'No usable profile',
      NOT_H264: 'Not H.264',
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
    addedNext: 'The camera is registered but not yet used. Assign it to Camera 1 or Camera 2.',
    assign: 'Assign to a camera slot',
    storeNotReady: 'This Core cannot store camera passwords yet, so this camera cannot be added. Nothing was saved.',
    testTooOld: 'The connection test is too old. Test the connection again.',
    finalCheckFailed: 'The camera did not pass the final check, so it was not added.',
    alreadyRegistered: 'This camera is already registered as {{device}}.',
    resultGone: 'This search result is no longer kept. Search again.',
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
        body: 'The session is recording one camera only.',
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
      oneCamera: '{{device}} is not reachable. The session will record one camera only.',
      noMicrophone: 'No microphone is reachable. A session cannot start.',
      activeMicrophone:
        '{{device}} is the active microphone and is not reachable. Cancel this session, make {{other}} the primary microphone on Devices, then start again.',
      activeMicrophoneFallback: 'Cancel this session, make {{other}} the primary microphone on Devices, then start again.',
      noStandby: '{{device}} is not reachable. The session will record with no standby microphone.',
      oneMicrophone: '{{device}} is not reachable. The session will record with one microphone and no standby.',
      notRecordable: '{{device}} cannot be recorded by this version of the system.',
    },
  },

  sourceClass: {
    badge: 'Development source',
    kind: {
      localCamera: "This Mac's camera",
      localMicrophone: "This Mac's microphone",
      test: 'Test source',
    },
    notAllowed: 'This source can only be used in the development configuration.',
    verify: {
      development: 'DEVELOPMENT SOURCES — this package was not recorded from production devices.',
      production: 'Sources: declared as production devices by the Core that sealed this package.',
      untrusted: 'Sources: not trustworthy — the manifest was altered',
      v1: 'Sources: not recorded (v1 package)',
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
      PRIMARY: 'Primary microphone',
      STANDBY: 'Standby microphone',
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
   * fault is active (a degraded recording: one camera lost, the other recording). Nothing is blocked -
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
} as const satisfies ResourceTree;
