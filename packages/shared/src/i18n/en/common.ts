/**
 * `common.*`: terms every page and both apps share (brand, actions, statuses, enum labels,
 * subject types, units, errors). English UI; Indonesian domain terms verbatim (D28/Q3).
 * Enum maps are keyed by wire values: book enums from `src/domain/enums.ts`, demo
 * vocabulary (roles, audit types, fault kinds, …) from `src/sim/vocabulary.ts` as read on
 * 2026-10-01 02:36 WIB, so `t('common.auditType.' + row.type)` needs no lookup table.
 */
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
      FINALIZE_TRACKS: 'Finalize tracks',
      CALCULATE_HASHES: 'Calculate hashes',
      BUILD_MANIFEST: 'Build manifest',
      ENCRYPT_PAYLOAD: 'Encrypt evidence payload',
      SIGN_MANIFEST: 'Sign manifest',
      STORE_SEALED_PACKAGE: 'Store sealed evidence package',
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
} as const satisfies ResourceTree;
