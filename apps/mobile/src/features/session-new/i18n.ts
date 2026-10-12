import type { ResourceTree } from '@/i18n/resources';

/**
 * English copy of the `session-new` feature, mounted at `features.session-new.*` through
 * `src/i18n/features.ts` (04_mobile_specs §9). Step 78 is its only writer (P6).
 *
 * Most of the flow's copy is shared with the web page and lives in `@dems/shared/i18n`:
 * `sessionNew.*` (titles, field labels, the §5.3 check names, the ready summary, the cancel
 * dialog), `common.subjectType.*` (the verbatim Indonesian subject types with their glosses),
 * `common.precheckStatus.*`, `common.enums.*` (check values) and `mobile.backGuard.*`. This tree
 * holds only what the mobile flow adds.
 */
export const sessionNewEn = {
  header: {
    back: 'Back',
    // 04 §4.4 header: the unexplained right icon is read as "Load last session profile" (hypothesis).
    profileMenu: 'Load last session profile',
    lastProfile: 'Start with last profile',
    lastProfileHint: 'Case, investigator, room and profile of the last session',
    clearForm: 'Clear form',
    profileLoaded: 'Loaded the profile of {{sessionId}}',
    noLastProfile: 'There is no earlier session to copy yet.',
    // Fix wave M (G70d-03): the visible way out of a session that exists (CREATE, PRECHECK, ARMED).
    cancelSession: 'Cancel session',
  },
  info: {
    scanned: 'Case number filled by the simulated scan',
    // D28/Q3: the English gloss of a subject type, shown on long-press (and as accessibilityHint).
    glossLine: '{{term}} means {{gloss}}',
    subjectTypeHint: 'Long-press a type for its English meaning.',
    investigatorEmpty: 'No investigator matches your search.',
    investigatorRole: '{{role}}',
    notesCount: '{{count}} / {{max}}',
  },
  create: {
    failedTitle: 'The session could not be created',
    NOT_SIGNED_IN: 'Your sign-in has ended. Sign in again to start a session.',
    NOT_PERMITTED: 'Your role cannot start sessions. Ask an investigator or a supervisor.',
    INVALID_INPUT: 'Check the session details and try again.',
    SESSION_ACTIVE: 'Another session is already open. Finish or cancel it first.',
    unexpected: 'Something went wrong. Please try again.',
  },
  devices: {
    progress: '{{done}} of {{total}} checked',
    passed: 'All checks passed',
    warnTitle: 'Warnings to review',
    retry: 'Run checks again',
    tamper: 'Enclosure tamper detected',
    reasonItem: '{{check}} ({{value}})',
    previewTitle: 'Camera and audio preview',
    liveTitle: 'Live device status',
    liveHint: 'The same eight checks run when you continue.',
    liveHintAfter: 'The devices check of this session has passed. This is the status the Core reports now.',
    noteTime: 'A note, not a warning: the Core takes its time from the host system clock.',
    noteSecurity: 'A note, not a warning: this Core reads no TPM and no Secure Boot state.',
    // Fix wave L (G70c-06): the card while the Core link is down - one statement of the link per screen.
    liveHintLinkDown: 'Not connected to the Core server. The device status is not known until the connection is back.',
    liveNotKnown: 'Not known',
    makeLive: 'Show {{camera}} live',
  },
  ready: {
    // Chosen in code (no i18next plural suffixes: Hermes' Intl.PluralRules support is not assumed).
    warningAcknowledged: 'Ready, 1 warning acknowledged',
    warningsAcknowledged: 'Ready, {{count}} warnings acknowledged',
    countdownHint: 'Recording starts after a 3-2-1 countdown.',
    countdownOffHint: 'Recording starts at once, without a countdown.',
    cancelCountdown: 'Cancel',
    startFailed: 'Recording could not start. Please try again.',
  },
  // C-4 Stepper accessibility words ("Step 2 of 3, Devices Check, current").
  stepper: {
    step: 'Step',
    of: 'of',
    pending: 'not started',
    active: 'current',
    running: 'in progress',
    done: 'completed',
    warn: 'needs attention',
    error: 'blocked',
  },
  // Step error boundary (three-layer error handling: message, persistent log, rate-limited retry).
  error: {
    title: 'This step could not be displayed',
    body: 'The session is safe. Try again, or go back and reopen Start Session.',
    retry: 'Try again',
    retryIn: 'Try again in {{seconds}} s',
    maxRetries: 'Still failing. Go back and reopen Start Session.',
  },
  actionFailed: 'That action could not be completed. Please try again.',
  // Round two (RC-7): the exit of the "Checking your permissions…" screen.
  checkingBackHome: 'Back to Home',
  // Fix wave M (G70d-03): the session this form belonged to was cancelled on another client.
  cancelledElsewhere: {
    title: 'The session was cancelled',
    body: '{{sessionId}} was cancelled on another client. Nothing was recorded. This form was cleared: enter the details again to start a new session.',
  },
  // Backend task, plan row W67: Live mode only (the Core server is the source of the session).
  live: {
    linkDownTitle: 'Core server unreachable',
    linkDownBody: 'This device is not connected to the Core server. Recording can start once the connection is back.',
    // Decision F69: in Live mode the Core link of the pre-check is set by a paired device's own connection.
    coreCheckHint: "In Live mode this check is this device's own connection to the Core server. Run the checks again once it is connected.",
    // Row M1's two Live words (W67 F-2; §3.2, MD-8), the step 2 hint and the case-number button's label,
    // moved to the shared `sessionNew.live.speakToTest` / `.scanCaseNumber` in the closing copy round
    // (decision D164 DN-5, W83 ledger #89), so the web console says the same.
  },
} as const satisfies ResourceTree;
