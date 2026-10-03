import type { ResourceTree } from '@/i18n/resources';

/**
 * English copy of the `session-finalizing` feature, mounted at `features.session-finalizing.*` through
 * `src/i18n/features.ts` (04_mobile_specs §9). Created empty by step 70; step 80 fills it and is its
 * only writer (P6). The step labels, the title, the progress line, the SEALED word and the session
 * field labels come from the shared i18n (`common.enums.finalizationStep`, `session.finalization`,
 * `session.details`); this file holds only what this screen alone says.
 */
export const sessionFinalizingEn = {
  pipelineLabel: 'Finalization steps',
  keepOpen: 'Sealing runs on the Core and takes a few seconds. This screen closes by itself.',
  openingSummary: 'Opening the session summary…',
  openSummary: 'Open summary',
  stampLabel: 'Evidence sealed',
  sessionCard: 'Session',
  evidencePending: 'Assigned when finalizing starts',
  recordingLength: 'Recording length',
  interrupted: {
    title: 'Finalization interrupted',
    body: '{{fault}}. Recovery takes over from here: the session is analysed and marked incomplete, never sealed (SYS-008).',
    unknownFault: 'A critical fault occurred',
    open: 'Open recovery status',
  },
  idle: {
    title: 'No finalization in progress',
    body: 'No session is being finalized right now.',
  },
  notEnded: {
    title: 'This session has not ended yet',
    body: 'Finalization starts after End Session.',
    open: 'Return to the session',
  },
  goHome: 'Go to Home',
  // C-4 Stepper accessibility words ("Step 2 of 6, Calculate hashes, in progress").
  stepper: {
    step: 'Step',
    of: 'of',
    pending: 'waiting',
    active: 'current',
    running: 'in progress',
    done: 'completed',
    warn: 'needs attention',
    error: 'interrupted',
  },
  // Region error boundary (three-layer error handling: message, persistent log, rate-limited retry).
  error: {
    title: 'This part could not be displayed',
    body: 'The evidence is not affected. Try again in a moment.',
    retry: 'Try again',
    retryIn: 'Try again in {{seconds}} s',
    maxRetries: 'Still failing. Reopen the app to reload this screen.',
  },
  actionFailed: 'That did not work. Please try again.',
} as const satisfies ResourceTree;
