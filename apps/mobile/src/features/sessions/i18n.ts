import type { ResourceTree } from '@/i18n/resources';

/**
 * English copy of the `sessions` feature (Sessions hub, 04_mobile_specs §4.9), mounted at
 * `features.sessions.*` through `src/i18n/features.ts` (04 §9). Owner: step 82 (P6).
 *
 * Shared terms come from `@dems/shared/i18n`: `common.enums.sessionState.*` (the status chips),
 * `common.actions.startNewSession`, `common.faultKind.*`, `session.details.*` (key-value labels)
 * and `common.subjectType.*` through `SubjectTypeChip` (MA-21: no Indonesian literal here).
 */
export const sessionsEn = {
  header: {
    title: 'Sessions',
    detailTitle: 'Session Details',
    back: 'Back to Sessions',
  },
  active: {
    label: 'Active session',
    returnToMonitor: 'Return to monitor',
    openFinalizing: 'Open finalization',
    openRecovery: 'Open recovery',
    finalizingBody: 'Sealing the evidence. This takes a few seconds.',
    faultBody: 'A fault interrupted the recording. Open recovery to keep the recorded part as incomplete.',
    timerLabel: 'Recording time {{time}}',
  },
  start: {
    continueSetup: 'Continue session setup',
    busyHint: 'A session is in progress. Finish it before starting a new one.',
  },
  search: {
    // Fix wave Q (JA2-27 / JT-12): the hint fits the field of a phone and of the tablet's list pane (it was cut to
    // "…case number.." and wrapped into a clipped second line); the spoken label says the whole of it.
    placeholder: 'Search ID, subject or case',
    label: 'Search sessions by session ID, subject or case number',
  },
  filters: {
    label: 'Filter sessions',
    ALL: 'All',
    SEALED: 'Sealed',
    INCOMPLETE: 'Incomplete',
    TODAY: 'Today',
    withCount: '{{filter}} · {{count}}',
    countLabel: '{{filter}}, {{count}} sessions',
  },
  list: {
    label: 'Session history',
    count_one: '{{count}} session',
    count_other: '{{count}} sessions',
    updated: 'Updated {{time}}',
    refreshing: 'Refreshing session history',
    empty: 'No sessions match',
    emptyBody: 'Try another search or filter.',
    clearFilters: 'Clear filters',
    noHistory: 'No sessions yet',
    noHistoryBody: 'Recorded interviews appear here once they end.',
    summaryPending: 'Summary pending',
    live: 'Live',
    rowLabel: '{{id}}, {{subject}}, {{status}}, {{date}}, duration {{duration}}',
    hint: {
      live: 'Opens the recording monitor',
      finalizing: 'Opens the finalization progress',
      recovery: 'Opens recovery',
      summary: 'Opens the session summary',
      evidence: 'Opens the evidence details',
      detail: 'Shows the session details',
    },
  },
  // Backend task, plan row W72 follow-up (decision D169): Live mode only. The rows are pushed by the
  // Core server; while the link is down they are what this device last received.
  live: {
    linkDownTitle: 'Core server unreachable',
    linkDownBody: 'This list is what this device last received from the Core server. It updates by itself once the connection is back.',
  },
  /** Round two, ruling (d) (JM-09): the open session was set up by another operator - whose it is, and what this operator can do. */
  foreign: {
    setup: 'This session was set up by {{who}}, not by you. You can continue it or cancel it.',
    summary: 'This session was recorded by {{who}}, not by you. You can read its summary and acknowledge it with Done.',
    nothing: 'This session belongs to {{who}}. Your role ({{role}}) cannot act on it: go to Home.',
    /**
     * Fix wave Q (CT-05): the toast of a session run from another console. This device is not moved to it; the
     * toast says what happened and where it can be read.
     */
    toast: {
      recording: 'Session {{id}} is recording',
      ended: 'Session {{id}} has ended and is being sealed',
      sealed: 'Session {{id}} is sealed',
      interrupted: 'Session {{id}} was interrupted',
      description: 'It is run from another console, so this device stays on this page. Sessions and Home show it.',
    },
  },
  /** Round two (JT-20): the detail pane while the selected session is not in the filtered list. */
  paneFiltered: {
    title: '{{id}} is not in this list',
    body: 'The filter or the search hides the selected session. Clear the filters to see it again, or choose a row.',
    clear: 'Clear filters',
  },
  pane: {
    emptyTitle: 'Select a session',
    emptyBody: 'Pick a session from the list to see its details here.',
  },
  detail: {
    notFound: 'This session is not on this device.',
    endTime: 'End Time',
    size: 'Size',
    outcome: 'Outcome',
    fault: 'Fault',
    timeRange: '{{start}} – {{end}}',
    incompleteTitle: 'Session marked INCOMPLETE',
    incompleteBody: 'It will never be sealed. The recorded part is kept as evidence {{evidenceId}}.',
    incompleteBodyNoEvidence: 'It will never be sealed.',
    // Round two (J2-S 4): why the seal of a quarantined session was given up, as the Core states it.
    unsealableCause: 'Why the seal was given up: {{cause}}.',
    unsealableCauseNotStated: 'The Core states no cause for it here.',
    pendingTitle: 'Summary not yet acknowledged',
    pendingBody: 'Open the session summary to review the seal and acknowledge it.',
    actions: {
      viewEvidence: 'View in Evidence',
      viewRecorded: 'View recorded evidence',
      openSummary: 'Open summary',
      navigateFailed: 'Could not open that screen. Please try again.',
    },
  },
} as const satisfies ResourceTree;
