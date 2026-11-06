import type { ResourceTree } from '@/i18n/resources';

/**
 * English copy of the `login` feature, mounted at `features.login.*` through
 * `src/i18n/features.ts` (04_mobile_specs §9). Step 75 is its only writer (P6).
 *
 * The Login screen reuses shared copy first: `login.*` (fields, Sign In, errors, notices, demo
 * operators, all from `@dems/shared/i18n`, 01_specs §14.8), `common.brand.*`, `common.roles.*`,
 * and the mobile namespace `mobile.biometric.*` / `mobile.pairing.*` (§6.3, §4.1 L11). This tree
 * holds only what the mobile Login alone says.
 */
export const loginEn = {
  // L3 (MB 1): the wordmark on two lines.
  wordmark: {
    top: 'DEMS',
    bottom: 'EDGE CLIENT',
  },
  // Accessible name of the brand block (the ring + emblem is one image).
  brandLabel: 'DEMS Edge Client emblem',
  // L9: the countdown line of the lockout Alert, for screen readers (the visual uses C-6).
  lockout: {
    a11y: 'Too many attempts. Try again in {{seconds}} seconds.',
  },
  // L9: a sign-in the runtime could not complete (not a credential error).
  unavailable: {
    title: 'Sign-in unavailable',
    body: 'Sign-in could not be completed. Try again in a moment.',
  },
  // L9 Core offline: the Retry control after its three rate-limited attempts (3 s, 6 s, 12 s).
  retryExhausted: 'Still unreachable. Restart the app to try again.',
  // L7 (§6.3): biometric states beyond the shared `mobile.biometric.*` copy.
  biometric: {
    notBound: 'Sign in with your password once to enable biometric sign-in on this device.',
    boundTo: 'Biometric sign-in for {{name}}',
    failedTitle: 'Fingerprint not recognised',
    error: 'Biometric sign-in is not available right now. Use your password.',
  },
  // L10: the pairing code shown with the demo operators (04 §4.2), hidden in presentation mode.
  demo: {
    pairingCode: 'Demo pairing code: {{code}}',
    // Fix wave J (JA2-N6): the accessible name of a demo operator row, with the role.
    rowLabel: '{{name}}, user name {{username}}, {{role}}',
    // LIVE (condition C2): no role chip is drawn, because the Core may have changed the role.
    rowLabelLive: '{{name}}, user name {{username}}, demo account created as {{role}}',
  },
  // L11: the Core link chip.
  coreChip: {
    ONLINE: 'Core online',
    STALE: 'Core link stale',
    OFFLINE: 'Core offline',
    // LIVE only (row M2 follow-up, D180): the link to the Core server is still connecting.
    SETTLING: 'Connecting to Core…',
  },
  // Backend task W59 (04_client_integration_spec §9.2, §3.5; additive): what the Login alone says
  // while the Core server is the Core (LIVE mode, debug builds). No key above is read differently.
  // A screen that shows server data says nothing about a simulation (§3.2): no text here does.
  // The web console's Login sentences are not read here: neither the disclosure (`login.live.demoNotice`,
  // condition C1) nor, since row 171 (D174: LIVE offline alert = Retry only), "Use Simulated mode" (`common.coreMode.useSimulated`).
  live: {
    // L11 (§9.2): the Core, and the Core's ID of this tablet.
    trust: {
      paired: 'Core: {{device}} • paired as {{tablet}}',
      // The Core identity has not reached the replica yet.
      pairedUnnamed: 'Core server • paired as {{tablet}}',
      unpaired: 'Core server • not paired',
      details: 'Pairing details',
    },
    // L9, Core offline (§3.5, §9.2). No address: the runtime's adapters alone name it.
    offlineBody: 'Sign-in needs the Core server. Nothing is sent while it cannot be reached.',
  },
} as const satisfies ResourceTree;
