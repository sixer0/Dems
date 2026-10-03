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
    placeholder: 'Search session ID, subject, or case number…',
    label: 'Search sessions',
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
    incompleteBody: 'It will never be sealed (SYS-008). The recorded part is kept as evidence {{evidenceId}}.',
    incompleteBodyNoEvidence: 'It will never be sealed (SYS-008).',
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
