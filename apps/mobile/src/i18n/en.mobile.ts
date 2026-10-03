import type { ResourceTree } from './resources';

/**
 * The mobile namespace `mobile.*` (04_mobile_specs §9): copy that only the app has. Common terms
 * (statuses, enums, page copy) come from the shared `@dems/shared/i18n` resources, which step 73
 * deep-merges underneath this tree (`buildEnResources` in `index.ts`). Copy is quoted from the spec section named on each group.
 *
 * Language rule (D28/Q3): English UI; Indonesian domain terms stay verbatim (Tersangka, Saksi,
 * Lainnya) with their English gloss for `accessibilityHint` and the long-press popover.
 */
export const enMobile = {
  mobile: {
    app: {
      name: 'DEMS Edge Client',
      // §2.3: the rail foot, web parity (01S §14.4).
      versionFooter: 'DEMS EDGE CLIENT · v{{version}}',
    },
    // §2.3: bottom bar (5) and rail (8) destinations.
    nav: {
      home: 'Home',
      sessions: 'Sessions',
      evidence: 'Evidence',
      devices: 'Devices',
      more: 'More',
      storage: 'Storage',
      networkTime: 'Network & Time',
      audit: 'Audit',
      settings: 'Settings',
      collapseRail: 'Collapse navigation',
      expandRail: 'Expand navigation',
    },
    // §3.8: live mini-bar.
    miniBar: {
      recording: 'Recording',
      openMonitor: 'Open the live session monitor',
    },
    // §3.6: back behaviour and the RECORDING guard.
    backGuard: {
      leaveMonitor: 'Recording continues on the Core. Leave the monitor?',
      stayOnMonitor: 'Stay on monitor',
      goHome: 'Go to Home',
      cancelSession: 'Cancel this session?',
      confirmCancel: 'Cancel session',
      keepSession: 'Keep session',
      finalizing: 'Finalizing — please wait',
    },
    // §6.3: biometric sign-in.
    biometric: {
      button: 'Use biometric login',
      promptMessage: 'Sign in to DEMS',
      cancelLabel: 'Use password',
      notEnrolled: 'Biometrics not set up on this device',
      lockout: 'Biometrics locked — use your password',
      enableOffer: 'Enable biometric sign-in on this tablet?',
      enable: 'Enable',
      notNow: 'Not now',
      identityNote: 'Simulated identity binding',
    },
    // §4.2 and §4.1 L11: pairing (derived screen) and the Core trust line.
    pairing: {
      title: 'Pair this tablet',
      steps: {
        discover: 'Discover',
        verifyCode: 'Verify code',
        paired: 'Paired',
      },
      simulated: 'SIMULATED',
      pair: 'Pair',
      cancel: 'Cancel',
      unpair: 'Unpair',
      state: {
        UNPAIRED: 'Not paired',
        PAIRING: 'Pairing…',
        PAIRED: 'Paired',
        FAILED: 'Pairing failed',
      },
      trustLinePaired: 'Core: {{device}} • paired (simulated)',
      trustLineUnpaired: 'Core: {{device}} • not paired',
      link: 'Pair this tablet',
    },
    // §4.4 step 2 and §4.5 S7: Core link source and the connection banner (M-MB-04).
    coreLink: {
      sourceLabel: 'Core link source',
      source: {
        SIMULATED: 'Simulated',
        HEARTBEAT: 'mock-core heartbeat',
      },
      lost: 'Core link lost — recording continues on the Core. Reconnecting…',
      resynced: 'Resynced',
    },
    // §7.6: the in-app haptics preference.
    haptics: {
      label: 'Haptics',
      description: 'Vibration feedback for selections, confirmations and alerts',
    },
    // D28/Q3: verbatim Indonesian subject types with their English gloss.
    subjectType: {
      Tersangka: { label: 'Tersangka', gloss: 'Suspect' },
      Saksi: { label: 'Saksi', gloss: 'Witness' },
      Lainnya: { label: 'Lainnya', gloss: 'Other' },
    },
    // §4.19 idle lock (step 73): shown with the shared `login.notices.sessionExpired` sentence.
    idleLock: {
      title: 'Session expired',
      recording: 'Recording on the Core is not affected.',
      confirm: 'OK',
    },
    // §3.2: boot screen shown when hydration exceeds the 2 s splash hold.
    boot: {
      loading: 'Starting DEMS Edge Client',
    },
    // Root error boundary (row 18 copy, moved to keys).
    errorBoundary: {
      title: 'Something went wrong',
      description: 'This screen could not be displayed. Try again in a moment.',
      retry: 'Try again',
      retryIn: 'Retry in {{seconds}}s',
      restart: 'Restart the app',
    },
  },
} as const satisfies ResourceTree;
