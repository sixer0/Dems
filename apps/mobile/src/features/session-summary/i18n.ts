import type { ResourceTree } from '@/i18n/resources';

/**
 * English copy of the `session-summary` feature, mounted at `features.session-summary.*` through
 * `src/i18n/features.ts` (04_mobile_specs §9). Created empty by step 70; step 80 fills it and is its
 * only writer (P6). Field labels, the SEALED word, the step and lifecycle labels, track names, units
 * and "SIMULATED" come from the shared i18n (`session.details`, `session.finalization`,
 * `common.enums`, `common.tracks`, `common.units`, `common.simulated`, `evidence.detail.integrity`).
 */
export const sessionSummaryEn = {
  title: 'Session Summary',
  back: 'Back to Home',
  stampLabel: 'Evidence sealed',
  sealedAt: 'Sealed {{time}}',
  sections: {
    details: 'Details',
    hashes: 'Hashes (SHA-256)',
    finalization: 'Finalization',
    lifecycle: 'Evidence lifecycle',
  },
  fields: {
    endTime: 'End Time',
    size: 'Size',
    timeSource: 'Time source {{source}}',
  },
  hashes: {
    hint: 'Tap a hash to see the full value.',
    track: '{{track}} · {{name}}',
    signature: 'Signature',
    open: 'Show the full {{label}} value',
    sheetTitle: '{{label}}',
    sheetBody: 'SHA-256, hex. Long-press the value to select and copy it.',
    signatureNote: 'A simulated signature for this demo, not a real cryptographic signature.',
    close: 'Close',
    noEvidence: 'No evidence item exists for this session, so there are no hashes.',
  },
  finalization: {
    notKept: 'Step timings are kept only for the session that was just sealed.',
  },
  actions: {
    acknowledgeHint: 'Acknowledges this summary',
    failed: 'The summary could not be acknowledged. Please try again.',
    navigateFailed: 'That did not open. Please try again.',
  },
  incomplete: {
    chip: 'INCOMPLETE',
    body: 'This session ended with a fault and was never sealed.',
  },
  notFound: {
    title: 'Session not found',
    body: 'Session {{sessionId}} is not in this Core’s history.',
  },
  stillFinalizing: {
    title: 'This session is still being finalized',
    body: 'The summary opens by itself once the evidence is sealed.',
    open: 'Open finalization',
  },
  goHome: 'Go to Home',
  // Backend task, plan row W72: Live mode only. The acknowledgement is recorded by the Core server
  // (operation 37); while the link is down the buttons cannot finish, and the screen says why.
  live: {
    linkDownTitle: 'Core server unreachable',
    linkDownBody: 'Your acknowledgement of this summary is recorded on the Core server. Done and View in Evidence finish once the connection is back.',
  },
  // C-4 Stepper accessibility words for the lifecycle strip.
  stepper: {
    step: 'Stage',
    of: 'of',
    pending: 'not reached',
    active: 'current',
    running: 'in progress',
    done: 'completed',
    warn: 'needs attention',
    error: 'failed',
  },
  // Region error boundary (three-layer error handling: message, persistent log, rate-limited retry).
  error: {
    title: 'This part could not be displayed',
    body: 'The sealed evidence is not affected. Try again in a moment.',
    retry: 'Try again',
    retryIn: 'Try again in {{seconds}} s',
    maxRetries: 'Still failing. Reopen the app to reload this screen.',
  },
} as const satisfies ResourceTree;
