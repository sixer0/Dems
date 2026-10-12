import type { ResourceTree } from '@/i18n/resources';

/**
 * English copy of the `pairing` feature, mounted at `features.pairing.*` through
 * `src/i18n/features.ts` (04_mobile_specs §9). Created empty by step 70; step 76 fills it and is its
 * only writer (P6). Shared terms come from `@dems/shared/i18n` (`common.pairingState.*`,
 * `common.auditType.*`, `login.errors.*`) and the `mobile.pairing.*` namespace (title, step labels,
 * Pair / Cancel / Unpair, SIMULATED); this tree holds only what the Pairing screen alone says.
 */
export const pairingEn = {
  header: {
    back: 'Back',
    subtitle: 'Certificate-bound control link to the Core, simulated in this demo.',
  },
  connection: {
    title: 'Core connection',
    ringLabel: 'Pairing status: {{state}}',
    // Vertical stepper descriptions (tablet); the labels are `mobile.pairing.steps.*`.
    steps: {
      discover: 'Find {{device}} on the management network',
      verify: 'Check the code and the Core certificate (DEMO)',
      paired: 'Certificate-bound control link established',
    },
    status: {
      idle: 'Ready to pair with {{device}}.',
      discovering: 'Discovering {{device}} on the management network…',
      verifying: 'Verifying the code and the Core certificate (DEMO)…',
      paired: 'Paired with {{device}}. The control link is certificate-bound (simulated).',
      failed: 'The Core did not accept that code.',
      locked: 'Pairing is locked after repeated failures.',
    },
  },
  identity: {
    title: 'Core identity',
    device: 'Device',
    room: 'Room',
    status: 'Status',
    pairedAt: 'Paired at',
    notPaired: 'Not paired',
    fingerprint: 'Certificate fingerprint · SHA-256 (DEMO)',
    lastAudit: 'Last pairing audit',
    lastAuditValue: '#{{seq}} {{event}} · {{time}}',
    noAudit: 'No pairing event yet',
  },
  code: {
    title: 'Pairing code',
    description: 'Enter the 6-digit pairing code issued by the Core.',
    a11y: 'Pairing code, 6 digits',
    invalidTitle: 'Code not accepted',
    lockedTitle: 'Pairing locked',
    lockedA11y: 'Pairing locked. Try again in {{seconds}} seconds.',
    errorTitle: 'Pairing could not be completed',
    errorBody: 'Something went wrong. Please try again.',
    pairing: 'Pairing…',
  },
  paired: {
    title: 'Device paired',
    body: 'This device now controls {{device}}. Unpairing removes the control link; recording on the Core is not affected.',
    continueToSignIn: 'Continue to sign-in',
    done: 'Done',
    handoff: 'Returning automatically…',
  },
  unpair: {
    title: 'Unpair this device?',
    body: 'This device will no longer be bound to {{device}}. You can pair it again with a new code. The action is written to the audit log.',
    confirm: 'Unpair',
    cancel: 'Keep paired',
    done: 'Device unpaired',
    failed: 'Could not unpair. Please try again.',
  },
  stepper: {
    step: 'Step',
    of: 'of',
    pending: 'not started',
    active: 'current',
    running: 'in progress',
    done: 'complete',
    warn: 'needs attention',
    error: 'failed',
  },
  // Backend task W57 (04_client_integration_spec §9.4, §6.6, §3.2): what the screen says in LIVE
  // mode, where the Core server is the Core. Every key above is the Simulated wording and is not
  // changed. Rule of §3.2: a screen that says "simulated" shows simulator data; nothing here does.
  live: {
    header: {
      subtitle: 'Pairs this device with the Core server. A supervisor issues the code in the web console.',
    },
    connection: {
      steps: {
        discover: 'Reach the Core server',
        verify: 'The Core checks the pairing code',
        paired: 'The Core registers this device and issues its credential',
      },
      status: {
        // An unpaired tablet gets no Core data: no name, no ID, no fingerprint to show.
        idle: 'Not paired. The Core identity is shown after pairing.',
        connecting: 'Connecting to the Core server…',
        offline: 'Core server unreachable.',
        discovering: 'Checking the link to the Core server…',
        verifying: 'About to send the code. Cancel now and nothing is sent.',
        sent: 'The Core is checking the code…',
        paired: 'Paired with {{device}} as {{tablet}}.',
        failed: 'The Core did not accept that code.',
        // The lock is global on the Core: it can come from another device's attempts.
        locked: 'Pairing is locked on the Core for a short time.',
        unavailable: 'Pairing is not available right now.',
      },
    },
    identity: {
      server: 'Core server',
      serverValue: 'Local connection',
      link: 'Link',
      linkState: {
        online: 'Connected',
        connecting: 'Connecting…',
        offline: 'Unreachable',
      },
      coreDevice: 'Core device',
      coreName: 'Core name',
      tablet: 'This device',
      fingerprintUnknown: 'Shown after pairing',
    },
    code: {
      description: 'Enter the 6-digit pairing code that a supervisor issued for this device in the web console.',
      // `attemptsRemaining` of the Core is the count before the LOCK, not the attempts left of a code.
      attemptsBeforeLock_one: '{{count}} more attempt before pairing is locked for a short time.',
      attemptsBeforeLock_other: '{{count}} more attempts before pairing is locked for a short time.',
      invalidBody: 'Check the code with the supervisor and try again.',
      unavailableTitle: 'Pairing is not available right now.',
      unavailable: {
        OFFLINE: 'The Core server could not be reached. The code was not checked.',
        NO_ANSWER: 'The Core server did not answer. If this code is refused now, ask a supervisor for a new one.',
        FAILED: 'The Core server could not complete the request.',
        STORAGE: 'This device could not store its credential and asked the Core to remove the registration. Ask a supervisor for a new pairing code.',
      },
      // A 429 is a limit, never a wrong code (decision D116): no attempt was counted.
      limited: 'The Core server is limiting requests. The code was not checked and no attempt was counted.',
      wait_one: 'Try again in {{count}} second.',
      wait_other: 'Try again in {{count}} seconds.',
      retryExhausted: 'Still not available. Check the Core server, then press Pair to try again.',
      offlineTitle: 'Core server unreachable',
      offlineBody: 'Pairing needs the Core server. Nothing is sent while it cannot be reached.',
      retryLimit: 'Still unreachable. Restart the app to try again.',
      useSimulated: 'Use Simulated mode',
    },
    notice: {
      revokedTitle: 'Pairing revoked',
      revoked: "This device's pairing was revoked on the Core. Ask a supervisor for a new pairing code.",
      revokedRecording: 'The recording continues on the Core.',
      unknownTitle: 'Device not registered',
      unknown: 'This device is not registered with this Core. Ask a supervisor for a new pairing code.',
      unpairedTitle: 'Device unpaired',
      unpaired: 'This device was unpaired.',
    },
    paired: {
      body: 'This device is registered with {{device}} as {{tablet}}. An operator can now sign in on it.',
    },
    unpair: {
      body: 'You will be signed out. It needs a new pairing code from a supervisor to be used again. A recording in progress continues on the Core.',
    },
  },
} as const satisfies ResourceTree;
