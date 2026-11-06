import type { ResourceTree } from '@/i18n/resources';

/**
 * English copy of the `dashboard` feature (Home, 04_mobile_specs §4.3, MB 2), mounted at
 * `features.dashboard.*` through `src/i18n/features.ts` (04 §9). Step 77 is its only writer (P6).
 *
 * Shared terms are NOT repeated here; the screen reads them from `@dems/shared/i18n`:
 * `shell.notifications.*` (bell), `shell.userMenu.*` (avatar menu), `common.brand.*`,
 * `common.actions.acknowledge`, `common.status.*`, `common.posture.*`, `common.enums.*`,
 * `common.devices.*`, `common.faultKind.*`, `common.roles.*`, `dashboard.statusStrip.*`,
 * `dashboard.devices.*` and `dashboard.sealedToday.*` (web Dashboard parity). Subject types come
 * from `mobile.subjectType.*` through the kit's `SubjectTypeChip` (D28/Q3, MA-21).
 */
export const dashboardEn = {
  title: 'Home',
  /** JT-19: the answer to the first Android Back on Home. */
  leaveApp: 'Press Back again to leave DEMS.',

  /** H1: header (MB 2 (355–590, 40–78)); the tablet variant is the 64 dp content header (04 §2.3). */
  header: {
    wordmarkTop: 'DEMS',
    wordmarkBottom: 'EDGE CLIENT',
    coreLink: 'Core {{state}}',
    coreLinkLabel: 'Core link: {{state}} ({{source}})',
    clockLabel: 'Current time {{time}}, UTC{{offset}}',
    notificationsHint: 'Shows the latest alerts',
    accountLabel: 'Account: {{name}}',
    accountHint: 'Opens the account menu',
    menuSettings: 'Settings and profile',
    lockHint: 'Ends your sign-in on this device. Sign in again to continue.',
  },

  /** H2: System Status card (MB 2 (352–592, 88–160)); the ring states follow `selectSystemState`. */
  status: {
    title: 'System Status',
    READY: {
      title: 'Ready for Recording',
      subtitle: 'All systems operational',
      /** A Core that reports no platform facts states no "all systems": only that it reports no fault. */
      subtitleNotReported: 'No fault is reported by the Core',
      /** A Core that reports no platform security facts (J-S 5): the hero ring never says "SECURE" of it. */
      ringSubNotReported: 'SECURITY NOT REPORTED',
    },
    /** Truth rule 3f: Home on a simulated Core says so once. */
    simulatedCore: 'Simulated Core · demonstration',
    ATTENTION: {
      title: 'Attention Needed',
      subtitle_one: '{{count}} check needs attention',
      subtitle_other: '{{count}} checks need attention',
    },
    CRITICAL: {
      title: 'Recording Blocked',
      subtitle: 'A critical fault needs action',
    },
    RECORDING: {
      title: 'Session in progress',
      subtitle: 'Recording {{sessionId}}',
    },
    UNKNOWN: {
      title: 'Checking the system',
      subtitle: 'The system state is not known yet',
    },
    /** Fix wave J (JA2-04, truth rule 3c): the Core link is down - Home knows nothing of the present state. */
    OFFLINE: {
      chip: 'OFFLINE',
      title: 'Core offline — state unknown',
      subtitle: 'This device has no link to the Core server. What is shown is the last known state.',
      subtitleRecording: 'This device has no link to the Core server. A recording that was running continues on the Core.',
      ringSub: 'STATE UNKNOWN',
    },
    /** An ACTIVE alert of severity CRITICAL that no other line states. */
    CRITICAL_ALERT: {
      title: 'Critical alert',
      subtitle: 'An active critical alert needs action',
    },
    rec: 'REC',
    timerLabel: 'Recording time {{time}}',
    openLive: 'Opens the live session monitor',
    moreFlags: '+{{count}} more',
    ringLabel: 'System status: {{state}}',
  },

  /** ATTENTION / CRITICAL list lines, keyed by the `SystemFlag.id` families of `systemStatus()`. */
  flags: {
    SESSION_FAULT: 'Session fault',
    POWER_FAIL: 'Power failure',
    AUDIT_CHAIN: 'Audit chain discontinuity',
    STORAGE_FULL: 'Evidence storage full',
    SECURITY_FAULT: 'Security fault',
    STORAGE_LOW: 'Evidence storage low',
    TIME_FALLBACK: 'Time source {{source}}',
    FAN_STALL: 'Fan stalled',
    TAMPER: 'Tamper detected',
    TABLET_OFFLINE: 'Device link offline',
    RECOVERY: 'Recovery in progress',
    cameraOffline: '{{name}} offline',
    micNoSignal: '{{name}}: no signal',
    /** JA2-26: the clip mark is LATCHED - it stays after the clipping ends, and the line says what ends it. */
    micClip: '{{name}}: clipping was detected. Reset the clip mark in Devices.',
    /** Fix wave J (JT-01 (b)): a source on a selector line the Core reports not reachable. */
    sourceNotReachable: '{{name}}: not reachable',
    sourceNotReachableDevice: '{{name}} ({{deviceId}}): not reachable',
  },

  /** H3: status tiles ×3 (MB 2 (352–592, 170–232)); D28/Q1 storage shows USED %. */
  tiles: {
    label: 'Device status',
    camera: 'Camera',
    microphone: 'Microphone',
    storage: 'Storage',
    state: {
      online: 'Online',
      offline: '{{count}} offline',
      noSignal: 'No signal',
      clipping: 'Clipping',
      healthy: 'Healthy',
      low: 'Low',
      full: 'Full',
      unknown: 'Not known',
    },
    /** The value of a tile while the Core link is down. */
    noValue: '—',
    used: 'used',
    a11y: {
      camera: 'Cameras: {{online}} of {{total}} online. {{state}}',
      microphone: 'Microphones: {{ready}} of {{total}} ready. {{state}}',
      storage: 'Storage: {{percent}}% used. {{state}}',
      unknown: '{{name}}: state not known. The Core is offline.',
    },
    openDevices: 'Opens Devices',
    openStorage: 'Opens Storage',
  },

  /** H4: Quick Actions (MB 2 (352–592, 245–320)). */
  actions: {
    title: 'Quick Actions',
    start: 'Start Session',
    returnLive: 'Return to live session',
    continueSetup: 'Continue setup',
    openSetup: 'Session {{sessionId}} is being set up by {{who}}. The Core takes no other session until it is started or cancelled.',
    openArmed: 'Session {{sessionId}} is armed by {{who}}: recording starts with one press. The Core takes no other session until it is started or cancelled.',
    openSetupYou: 'you',
    finalizing: 'View finalization',
    recovery: 'Open recovery',
    summary: 'View session summary',
    /**
     * Decision D247 item 6: the unacknowledged Summary of a session this device did not run. After a sign-in the
     * app no longer opens it by itself; Home says it is there, and the button above opens it.
     */
    summaryElsewhere: 'Session {{sessionId}} was sealed on another console. Summary not yet acknowledged.',
    viewEvidence: 'View Evidence',
    /** Fix wave J (JA2-04): why the wizard's entry is disabled while the Core link is down. */
    offlineReason: 'Core offline. A session cannot be started from this device until the link returns.',
    /** JM-N6: Start beside "Recording Blocked". */
    blockedReason: 'Recording is blocked: {{cause}}. The devices check will refuse the start until it is cleared.',
    blockedReasonPlain: 'Recording is blocked by a critical fault. The devices check will refuse the start until it is cleared.',
  },

  /** H5: Recent Sessions (MB 2 (352–592, 335–488)). */
  recent: {
    title: 'Recent Sessions',
    seeAll: 'See All',
    empty: 'No sessions yet',
    today: 'Today {{time}}',
    yesterday: 'Yesterday {{time}}',
    earlier: '{{date}} {{time}}',
    /** JA2-07: an interrupted session that was never sealed. */
    incomplete: '{{when}} · Incomplete, not sealed',
    rowLabel: '{{id}}, {{when}}',
    rowHint: 'Opens the session',
  },

  /** Tablet (expanded): device tiles 2x2 with live feeds and meters (04 §4.3 "Tablet additions"). */
  devices: {
    feedLabel: '{{name}} live feed',
    meterLabel: '{{name}} input level',
    openDevice: 'Opens {{name}}',
  },

  /** Tablet: the Security, Time & Network chip row (04 §4.3; web Dashboard G parity). */
  chips: {
    label: 'Security, time and network',
    value: '{{label}}: {{value}}',
  },

  /** Alerts popover lines (bell). */
  alerts: {
    line: '{{label}} · {{time}}',
    /** JA2-25: an alert the Core resolved that nobody acknowledged stays listed until it is. */
    resolved: 'resolved, not acknowledged',
    more: 'Showing the newest {{shown}} of {{total}}.',
  },
} as const satisfies ResourceTree;
