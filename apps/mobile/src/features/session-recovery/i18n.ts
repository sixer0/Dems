import type { ResourceTree } from '@/i18n/resources';

/**
 * English copy of the `session-recovery` feature, mounted at `features.session-recovery.*` through
 * `src/i18n/features.ts` (04_mobile_specs §9). Created empty by step 70; step 81 fills it and is its
 * only writer (P6). The fault names, the §18.1 stage names, the track names, the roles, the units and
 * the INCOMPLETE line come from the shared i18n (`common.faultKind`, `common.enums.bootRecoveryState`,
 * `common.tracks`, `common.roles`, `common.units`, `session.recovery`); this file holds only what this
 * screen alone says.
 */
export const sessionRecoveryEn = {
  title: 'Session recovery',
  sessionId: 'Session {{id}}',
  // The calm escalation Alert (03M P7: one pulse, then a steady colour).
  fault: {
    title: 'Session interrupted: {{fault}}',
    body: 'Recording stopped at {{time}}. The evidence stays unsealed until a controlled recovery analysis has run.',
    unknownFault: 'Critical fault',
    noRecording: 'The session stopped before recording started. Nothing was recorded.',
  },
  analysing: {
    title: 'Recovery analysis running',
    body: 'The Core is checking the interrupted session. This takes a few seconds.',
  },
  stage: '{{stage}} · stage {{current}} of {{total}}',
  // C-4 Stepper pipeline (book §18.1 RECOVERY_SCAN → INCOMPLETE_SESSION_ANALYSIS, §6.4).
  steps: {
    scan: 'Recovery marker and journal',
    tracks: 'Track integrity',
    segment: 'Last good segment',
    time: 'Time-source continuity',
    analysis: 'Incomplete session analysis',
  },
  stepDetail: {
    scan: 'Recovery marker found',
    tracksAllIntact: 'All 4 tracks intact',
    tracksIssues_one: '{{count}} track needs attention',
    tracksIssues_other: '{{count}} tracks need attention',
    tracksNoMedia: 'No media to check',
    segment: 'Ends {{time}} · {{length}} of media',
    segmentNone: 'No media recorded',
    timeLocked: '{{source}} locked throughout',
    timeFallback: '{{from}} → {{to}} at {{time}}',
    analysis: 'Sealing rule checked (SYS-008)',
  },
  // Per-track result chips and lines.
  track: {
    intact: 'INTACT',
    gap: 'GAP',
    degraded: 'FLAGGED',
    noMedia: 'NO MEDIA',
    checking: 'Checking…',
    waiting: 'Waiting',
    intactDetail: 'Continuous to the interruption',
    gapDetail: 'Signal lost at {{time}}',
    degradedDetail: 'Clipped segments flagged from {{time}}',
    noMediaDetail: 'Recording never started',
  },
  details: {
    title: 'Analysis details',
    tracksTitle: 'Tracks',
    caseNumber: 'Case',
    subject: 'Subject',
    room: 'Room',
    interruptedAt: 'Interrupted at',
    fromState: 'Interrupted during',
    lastSegment: 'Last good segment',
    lastSegmentBasisAutosave: '{{time}} (autosave)',
    lastSegmentBasisStart: '{{time}} (recording start)',
    timeSource: 'Time source',
    timeLocked: '{{source}}, continuous',
    timeFallback: '{{to}} from {{time}}',
    recorded: 'Recorded',
    pending: 'Pending',
  },
  // Outcome card.
  outcome: {
    title: 'Recovery outcome',
    incompleteChip: 'INCOMPLETE',
    recoveredChip: 'RECOVERED · SEALED',
    recoveredBody: 'Every check passed. The session was sealed with a recovery signature.',
    signature: 'Recovery signature',
    evidence: 'Evidence item',
    evidenceUnsealed: '{{id}} (recorded, unsealed)',
    noEvidence: 'None: nothing was recorded',
    duration: 'Recorded length',
    size: 'Size',
    acknowledge: 'Acknowledge',
    viewEvidence: 'View evidence item',
    acknowledged: 'Recovery acknowledged',
  },
  // Role gating (SimPermissionError → toast).
  actions: {
    start: 'Start recovery',
    startHint: 'Recovery closes the session as incomplete. It never seals it.',
    needsRole: 'Needs an Investigator or Supervisor. You are signed in as {{role}}.',
    deniedStart: 'Your role cannot start recovery. Ask an Investigator or Supervisor.',
    deniedView: 'Your role cannot open evidence items.',
    readOnly: 'Recovery is paused while the Core link is offline.',
    notInFault: 'The session is no longer waiting for recovery.',
    failed: 'That did not work. Please try again.',
    goHome: 'Go to Home',
    returnToSession: 'Return to the session',
    busy: 'Recovery analysis running — please wait',
  },
  idle: {
    title: 'No recovery in progress',
    body: 'There is no interrupted session to recover.',
  },
  notInterrupted: {
    title: 'This session is not interrupted',
    body: 'Recovery runs only after a critical fault stops a session.',
  },
  // C-4 Stepper accessibility words ("Step 2 of 5, Track integrity, in progress").
  stepper: {
    step: 'Step',
    of: 'of',
    pending: 'waiting',
    active: 'current',
    running: 'in progress',
    done: 'completed',
    warn: 'needs attention',
    error: 'failed',
  },
  // LIVE mode only (plan row W73): the runtime's link notice and the truthful source of the findings.
  live: {
    linkDownTitle: 'Core server unreachable',
    linkDownBody: 'This device is not connected to the Core server. The screen shows the last state received; recovery can start once the connection is back.',
    derived: "The Core reports the recovery stage and the outcome. The check results shown here are derived on this device from the Core's data.",
  },
  // Region error boundary (three-layer error handling: message, persistent log, rate-limited retry).
  error: {
    title: 'This part could not be displayed',
    body: 'The session and its evidence are not affected. Try again in a moment.',
    retry: 'Try again',
    retryIn: 'Try again in {{seconds}} s',
    maxRetries: 'Still failing. Reopen the app to reload this screen.',
  },
} as const satisfies ResourceTree;
