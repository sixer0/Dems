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
  },

  /** H2: System Status card (MB 2 (352–592, 88–160)); the ring states follow `selectSystemState`. */
  status: {
    title: 'System Status',
    READY: {
      title: 'Ready for Recording',
      subtitle: 'All systems operational',
    },
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
    TABLET_OFFLINE: 'Tablet link offline',
    RECOVERY: 'Recovery in progress',
    cameraOffline: '{{name}} offline',
    micNoSignal: '{{name}}: no signal',
    micClip: '{{name}}: clipping',
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
    },
    used: 'used',
    a11y: {
      camera: 'Cameras: {{online}} of {{total}} online. {{state}}',
      microphone: 'Microphones: {{ready}} of {{total}} ready. {{state}}',
      storage: 'Storage: {{percent}}% used. {{state}}',
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
    finalizing: 'View finalization',
    recovery: 'Open recovery',
    summary: 'View session summary',
    viewEvidence: 'View Evidence',
  },

  /** H5: Recent Sessions (MB 2 (352–592, 335–488)). */
  recent: {
    title: 'Recent Sessions',
    seeAll: 'See All',
    empty: 'No sessions yet',
    today: 'Today {{time}}',
    yesterday: 'Yesterday {{time}}',
    earlier: '{{date}} {{time}}',
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
  },
} as const satisfies ResourceTree;
