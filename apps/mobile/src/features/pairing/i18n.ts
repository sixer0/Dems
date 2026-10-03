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
    subtitle: 'Certificate-bound control link to the Core (book §20.1), simulated in this demo.',
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
    title: 'Tablet paired',
    body: 'This tablet now controls {{device}}. Unpairing removes the control link; recording on the Core is not affected.',
    continueToSignIn: 'Continue to sign-in',
    done: 'Done',
    handoff: 'Returning automatically…',
  },
  unpair: {
    title: 'Unpair this tablet?',
    body: 'The tablet will no longer be bound to {{device}}. You can pair it again with a new code. The action is written to the audit log.',
    confirm: 'Unpair',
    cancel: 'Keep paired',
    done: 'Tablet unpaired',
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
} as const satisfies ResourceTree;
