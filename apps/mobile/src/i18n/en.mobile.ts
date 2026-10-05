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
      // Backend task W51 (04_client_integration_spec §3.2): the chip of the Pair screen in LIVE mode.
      live: 'LIVE',
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
        // Backend task W51 (04_client_integration_spec §9.5): the third source, debug builds only.
        LIVE: 'Live',
      },
      lost: 'Core link lost — recording continues on the Core. Reconnecting…',
      resynced: 'Resynced',
    },
    // Backend task W51 (04_client_integration_spec §6.2, §6.3, §8.1): Live mode, the Core server is
    // the Core. `refusal.*` is the copy of the refusal presenter (`runtime/core-errors.ts`); a denied
    // call uses the shared `common.rbac.*` sentences, as the web console does.
    live: {
      // §6.3: one notice after the Core changed the signed-in operator's role (`session.updated`).
      roleChanged: 'Your role is now {{role}}. The available actions have changed.',
      refusal: {
        // 401: the session is over; the guard opens the Login screen.
        signedOut: 'You are signed out',
        signedOutHint: 'Sign in to continue.',
        // LB-6: no answer, or the link is down. One toast per 3 s.
        offline: 'Core server unreachable',
        offlineHint: 'Nothing was changed.',
        // LB-7: no answer within 8 s.
        timeoutHint: 'The command may or may not have been applied; the screen updates when the Core is reachable.',
        // §5.2 step 6: the sign-in was answered, its data did not arrive in time.
        snapshotHint: 'The Core did not send its data in time. Try again.',
        // LB-10: a limit is not an outage.
        limit: 'The Core server is limiting requests from this tablet',
        limitHint: 'Try again in {{seconds}} s.',
        limitHintSoon: 'Try again in a moment.',
        // 500, or an answer outside the contract.
        failed: 'The Core server could not complete the request',
        failedHint: 'Try again. If it happens again, check the Core server.',
        // The tablet could not read its own credential: nothing was sent.
        credentials: 'This tablet could not read its credential',
        credentialsHint: 'Nothing was sent. Try again.',
        // The action has no operation in Live mode, or the tablet's own storage failed.
        notAvailable: 'Not available right now',
        notAvailableHint: 'This action cannot be done on this tablet at the moment.',
        // Envelope codes without a simulator class.
        demoDisabled: 'Demo controls are turned off on the Core server',
        refused: 'The Core refused this action',
      },
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
