/**
 * `shell.*`: AppShell copy (01_specs §14.3–§14.4; research/04 §2). Brand strings live in
 * `common.brand`.
 */
import type { ResourceTree } from '../resource-tree';

export const shell = {
  skipToContent: 'Skip to main content',

  topBar: {
    homeLink: 'DEMS Edge Client, go to Dashboard',
    date: 'Date',
    clock: 'Current time, UTC{{offset}}',
    deviceId: 'Device ID',
    deviceTooltip: 'Serial {{serial}} • Firmware {{firmware}} • Build {{build}}',
    loggedInAs: 'Logged in as',
    userMenu: 'Account menu',
    openNavigation: 'Open navigation',
    closeNavigation: 'Close navigation',
    toggleRail: 'Collapse or expand the sidebar ([)',
  },

  notifications: {
    button: 'Notifications',
    count_one: '{{count}} new alert',
    count_other: '{{count}} new alerts',
    title: 'Latest alerts',
    empty: 'No new alerts',
    viewAll: 'View all events',
  },

  userMenu: {
    profile: 'Profile',
    role: 'Role: {{role}}',
    lockConsole: 'Lock console',
    signOut: 'Sign out',
  },

  /** SECURE pill (research/04 §2.1 #11); states follow the AssetSample shield set. */
  securePill: {
    popoverTitle: 'Integrity checks',
    SECURE: {
      title: 'SECURE',
      subtitle: 'All systems operational',
    },
    ATTENTION: {
      title: 'ATTENTION',
      subtitle: 'Some checks need attention',
    },
    CRITICAL: {
      title: 'CRITICAL',
      subtitle: 'An integrity check failed',
    },
    UNKNOWN: {
      title: 'UNKNOWN',
      subtitle: 'Integrity state not yet known',
    },
    /** Popover checklist rows (step 38); each row resolves to one `checkStatus`. */
    checks: {
      encryption: 'Evidence encryption (AES-256-GCM)',
      hashChain: 'Audit hash chain (SHA-256)',
      platform: 'TPM 2.0 and Secure Boot',
      tamper: 'Enclosure tamper seal',
      timeSource: 'Trusted time source',
      storage: 'Evidence storage',
      inputs: 'Cameras and microphones',
      recording: 'Recording pipeline',
      tablet: 'Operator tablet link',
    },
    checkStatus: {
      OK: 'OK',
      ATTENTION: 'Needs attention',
      CRITICAL: 'Failed',
      UNKNOWN: 'Not yet known',
    },
    openDetails: 'Open Security & Audit',
  },

  nav: {
    label: 'Primary',
    dashboard: 'Dashboard',
    session: 'Session Monitor',
    evidence: 'Evidence',
    devices: 'Devices & Inputs',
    storage: 'Storage',
    networkTime: 'Network & Time',
    securityAudit: 'Security & Audit',
    system: 'System & Maintenance',
    developerGroup: 'DEVELOPER',
    apiReference: 'API Reference',
    devChip: 'DEV',
    stackCheck: 'Stack Check',
  },

  /** Bottom tab bar below 768 px (research/04 §2.5); mobile uses the same words. */
  bottomTabs: {
    label: 'Sections',
    home: 'Home',
    sessions: 'Sessions',
    evidence: 'Evidence',
    devices: 'Devices',
    more: 'More',
  },

  breadcrumbs: {
    label: 'Breadcrumb',
    home: 'Home',
  },

  footer: {
    product: 'DEMS EDGE CLIENT',
    version: 'v{{version}}',
  },
} as const satisfies ResourceTree;
