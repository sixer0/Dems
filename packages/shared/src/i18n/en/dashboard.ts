/**
 * `dashboard.*`: Dashboard panels A–J (01_specs §14.5.1; research/04 §3.1). Quick actions
 * and the storage legend come from `common`.
 *
 * Step 42 added keys only (the mobile Dashboard reads `statusStrip`, `devices`, `sealedToday`
 * and `systemRing` too, so no existing key was renamed or removed). The one changed value is
 * `hero.paragraph`, which now carries the designer's copy from DEMS-Dashboard1.png.
 */
import type { ResourceTree } from '../resource-tree';

export const dashboard = {
  title: 'Dashboard',

  /** A: SYSTEM READY ring. */
  systemRing: {
    overline: 'SYSTEM',
    flags: 'SECURE • HEALTHY • OPERATIONAL',
    caption: {
      READY: 'All core services are running and the system is ready for recording.',
      ATTENTION: 'One or more checks need attention. Recording is still possible.',
      CRITICAL: 'A critical fault blocks recording. Open System & Maintenance.',
      /** CRITICAL while a session records: recording continues (step 45b, F45-06). */
      CRITICAL_RECORDING: 'Recording continues. A critical fault needs attention.',
      UNKNOWN: 'The system state is not known yet.',
      RECORDING: 'Session in progress',
    },
    ariaLabel: {
      READY: 'System ready',
      ATTENTION: 'System needs attention',
      CRITICAL: 'System critical',
      UNKNOWN: 'System state unknown',
      RECORDING: 'Recording in progress',
    },
    /** The line under the state word when the state is not READY (the flags line is READY's). */
    statusLine: {
      RECORDING: 'SECURE • HEALTHY • RECORDING',
      UNKNOWN: 'AWAITING STATUS',
    },
    issues_one: '{{count}} ISSUE',
    issues_other: '{{count}} ISSUES',
  },

  /** B: hero (photo, overline, tagline, paragraph). Lines come from `common.brand`. */
  hero: {
    paragraph:
      'Secure interview recording, evidence handling and integrity monitoring, built for professional standards.',
    recordingTitle: 'Session in progress',
    recordingParagraph: 'Recording {{sessionId}} • Case {{caseNumber}}',
    /** Accessible name of the vertical RECORD / PRESERVE / PROTECT stack. */
    pillarsLabel: 'Record, preserve, protect',
  },

  /** C: status strip (6 cells). */
  statusStrip: {
    label: 'System status',
    cameras_one: '{{count}} Camera',
    cameras_other: '{{count}} Cameras',
    microphones_one: '{{count}} Microphone',
    microphones_other: '{{count}} Microphones',
    storage: 'Storage',
    storageFree: '{{free}} Free',
    time: 'GNSS / Time',
    security: 'Security',
    network: 'Network',
    /** Cell values (the dot colour carries the tone). */
    value: {
      ready: 'Ready',
      camerasOnline: '{{online}} of {{total}} online',
      micNoSignal: 'No signal',
      micClip: 'Clipping',
      storageFull: 'Full',
      timeGnss: 'Synchronized',
      timeNtp: 'NTP fallback',
      timeRtc: 'RTC holdover',
      posture: {
        SECURE: 'Secure',
        ATTENTION: 'Attention',
        CRITICAL: 'Critical',
        UNKNOWN: 'Unknown',
      },
    },
    /** Accessible name of a cell link: "Storage: 3.2 TB Free. Open Storage". */
    cellLink: '{{label}}: {{value}}. Open {{page}}',
  },

  /** D: Active Session (idle / setup / recording / finalizing / sealed). */
  activeSession: {
    title: 'ACTIVE SESSION',
    idle: {
      title: 'No active session',
      body: 'The system is ready to begin a new recording session when required.',
    },
    startOptions: {
      label: 'More start options',
      lastProfile: 'Start with last profile',
      fromTemplate: 'Start from template…',
    },
    setup: {
      title: 'Session setup in progress',
      progress: 'Pre-check {{done}} of {{total}}',
      continue: 'Continue setup',
    },
    recording: {
      rec: 'REC',
      caseNumber: 'Case Number',
      investigator: 'Investigator',
      subject: 'Subject',
      startTime: 'Start Time',
      openMonitor: 'Open Session Monitor',
      sessionId: 'Session ID',
      thumbnailLabel: 'Camera 1 preview of the recording',
    },
    finalizing: {
      title: 'Finalizing evidence',
      progress: 'Step {{current}} of {{total}}',
      stopping: 'Stopping recording…',
    },
    sealed: {
      title: 'Evidence sealed',
      manifestHash: 'Manifest hash',
      viewEvidence: 'View evidence',
      evidenceId: 'Evidence ID',
      sealedAt: 'Sealed at',
    },
    fault: {
      title: 'Session fault',
      body: 'A fault interrupted the session. Open the Session Monitor to recover it.',
    },
    recovery: {
      title: 'Recovery in progress',
      body: 'The Core is analysing the interrupted session. It will be kept as incomplete.',
    },
  },

  /** E: Devices & Inputs tiles. */
  devices: {
    title: 'DEVICES & INPUTS',
    viewAll: 'View All Devices',
    tileMenu: '{{name}} actions',
    testSignalSent: 'Test signal sent to {{name}} (simulated)',
    restartSent: '{{name}} restart requested (simulated)',
    commandFailed: 'The command could not be sent. Please try again.',
  },

  /** F: Storage & Evidence. */
  storage: {
    title: 'STORAGE & EVIDENCE',
    viewStorage: 'View Storage',
    /** "3.2 TB" + " Free" on the first line, "of 4.0 TB" under it (DEMS-Dashboard1.png). */
    free: 'Free',
    ofTotal: 'of {{total}}',
    /** ProgressCircle value text (AC-75): "20% used, 3.2 TB free of 4.0 TB". */
    ringValue: '{{percent}}% used, {{freeOf}}',
    ringLabel: 'Evidence storage used',
    legendLabel: 'Storage and evidence breakdown',
  },

  /** G: Security, Time & Network. */
  securityTimeNetwork: {
    title: 'SECURITY, TIME & NETWORK',
    allSecure: 'All systems secure',
    attention_one: '{{count}} item needs attention',
    attention_other: '{{count}} items need attention',
    critical_one: '{{count}} critical item',
    critical_other: '{{count}} critical items',
    tpm: {
      title: 'TPM / Secure Boot',
      verified: 'TPM 2.0 Verified',
      secureBoot: 'Secure Boot Enabled',
      chipOk: 'ACTIVE',
      chipFault: 'FAULT',
      failed: 'TPM check failed',
      secureBootOff: 'Secure Boot disabled',
      tooltip: '{{model}} · Secure Boot {{secureBoot}} · {{encryption}} · {{hash}}',
    },
    time: {
      title: 'GNSS / Time Sync',
      chip: {
        GNSS: 'SYNCHRONIZED',
        NTP: 'NTP FALLBACK',
        RTC: 'RTC HOLDOVER',
      },
      tooltip: 'Source {{source}} · stratum {{stratum}} · offset {{offset}} ms · last sync {{time}}',
    },
    network: {
      title: 'Network Status',
      chipUp: 'CONNECTED',
      chipDown: 'OFFLINE',
      tooltip: 'Gateway {{gateway}} · link {{speed}} Mbps · PoE {{active}}/{{total}} ports',
    },
    posture: {
      title: 'Security Posture',
      allControls: 'All controls active',
      noIssues: 'No issues detected',
      controlsOpen_one: '{{count}} control needs attention',
      controlsOpen_other: '{{count}} controls need attention',
      alerts_one: '{{count}} active alert',
      alerts_other: '{{count}} active alerts',
    },
  },

  /** H: Sealed Evidence Today. */
  sealedToday: {
    title: 'SEALED EVIDENCE TODAY',
    viewAll: 'View All',
    caption_one: 'Item sealed today',
    caption_other: 'Items sealed today',
    chartLabel: 'Evidence sealed per hour',
    newSeal: 'Evidence {{evidenceId}} sealed',
    /** Screen-reader summary of the hourly chart. */
    chartSummary: '{{count}} sealed today, most in the {{hour}}:00 hour',
    chartEmpty: 'Nothing sealed yet today',
  },

  /** I: Recent Events (grouped by day, research/04 §9 #34). */
  recentEvents: {
    title: 'RECENT EVENTS',
    viewAll: 'View All Events',
    empty: 'No events yet',
  },

  /** J: Quick Actions use `common.quickActions`. */
  quickActions: {
    label: 'Quick actions',
  },
} as const satisfies ResourceTree;
