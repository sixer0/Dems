import type { ResourceTree } from '@/i18n/resources';

/**
 * English copy of the `more` feature (More, phone only; 04_mobile_specs §4.17), mounted at
 * `features.more.*` through `src/i18n/features.ts` (04 §9). Step 89 is its only writer (P6).
 *
 * Shared terms are NOT repeated here; the screen reads them from the shared and mobile trees:
 * `mobile.nav.*` (destination names), `mobile.app.versionFooter`, `mobile.coreLink.source.*`,
 * `mobile.pairing.state.*`, `mobile.idleLock.recording`, `shell.userMenu.*` (Lock console,
 * Sign out, role line), `common.roles.*`, `common.status.*`, `common.enums.timeSource.*` and `common.errors.panel*`.
 */
export const moreEn = {
  title: 'More',

  /** Operator header card (§4.17 "Avatar, name, role"). */
  operator: {
    label: 'Signed-in operator',
    a11y: '{{name}}, {{role}}, operator {{id}}',
    signedInAt: 'Signed in {{time}}',
    lockHint: 'Locks the console; recording continues',
    signOutHint: 'Signs out of DEMS; recording continues on the Core',
  },

  /** The four destinations that are tabs on tablets but live here on phones (H-MB-01, MB 8 / MB 10). */
  console: {
    title: 'Console',
    openHint: 'Opens {{name}}',
    storage: {
      detail: '{{percent}}% used',
      used: 'used',
      state: {
        READY: 'Healthy',
        LOW: 'Low',
        FULL: 'Full',
      },
    },
    networkTime: {
      detail: 'Time {{source}}',
      lanUp: 'LAN connected',
      lanDown: 'LAN down',
      synced: 'Synchronized',
      attention: 'Attention',
    },
    audit: {
      detail_one: '{{count}} event',
      detail_other: '{{count}} events',
      chainOk: 'Chain OK',
      chainBroken: 'Discontinuity',
    },
    settings: {
      detail: 'Preferences, security, about',
      sections_one: '{{count}} section',
      sections_other: '{{count}} sections',
    },
    /** Tablets: the rail already shows these four (04 §2.3 "More dissolves"). */
    inRail: 'Storage, Network & Time, Audit and Settings are in the navigation rail.',
  },

  /** Secondary destinations (§4.17 "About", plus the derived Pairing and Recovery screens). */
  links: {
    title: 'Device & support',
    pairing: {
      title: 'Pairing',
      detail: 'Core: {{core}}',
    },
    recovery: {
      title: 'Recovery status',
      detail: 'The session needs attention',
      FAULT: 'Fault',
      RECOVERY: 'Recovering',
    },
    about: {
      title: 'About DEMS',
      detail: 'Version {{version}}, build and licences',
    },
    devGallery: {
      title: 'Developer gallery',
      detail: 'Component and motion samples',
      chip: 'DEBUG',
    },
  },

  /** Footer (§4.17 "version and the Core link chip"). */
  footer: {
    demo: 'DEMO',
    demoNote: 'Simulated data for demonstration',
    /** Backend task W66 (§3.2): LIVE mode shows the Core server's data, so the note says so. */
    liveNote: 'Data from the Core server',
    coreLink: 'Core {{state}}',
    coreLinkLabel: 'Core link: {{state}} ({{source}})',
  },

  /** Section fallback (error boundary): the shared panel copy is used for title and body. */
  boundary: {
    retryHint: 'Tries to show this section again',
  },
} as const satisfies ResourceTree;
