import type { ResourceTree } from '@/i18n/resources';

/**
 * English copy of the `audit` feature, mounted at `features.audit.*` through
 * `src/i18n/features.ts` (04_mobile_specs §9). Owner: step 87 (P6). Shared terms come from
 * `@dems/shared/i18n`: event labels from `common.auditType` (keyed by the simulator's code, never
 * its English `message`), categories `common.auditCategory`, severities `common.severity`, fault
 * kinds `common.faultKind`, auth methods `common.authMethod`, and the chain vocabulary of the web
 * Security & Audit page (`securityAudit.chain.*`, `securityAudit.audit.*`), so both apps say the
 * same thing about the same break. This tree holds only what the mobile Audit view alone says.
 */
export const auditEn = {
  header: {
    title: 'Audit',
    subtitle: 'Tamper-evident operator trail',
    back: 'Back to More',
  },
  chain: {
    ok: 'Chain OK',
    broken: 'Discontinuity',
    stripLabel: 'Hash chain: the newest entries, oldest on the left',
    head: 'Head',
    entries_one: '{{count}} entry',
    entries_other: '{{count}} entries',
    olderBreak: 'Break at #{{seq}}, before these entries',
    verifyLabel: 'Verify the audit hash chain',
    verifiedAt: 'Checked {{count}} entries at {{time}}',
    failedAt: 'Breaks at entry #{{seq}}: {{reason}} (checked at {{time}})',
    // Fix wave J (JA2-31): a verdict the chain no longer agrees with is an earlier check, with its time.
    staleChip: 'Earlier check',
    staleVerdict: 'At {{time}} {{found}}. The chain has changed since then. Verify again.',
    staleFoundOk: 'the check passed over {{count}} entries',
    staleFoundBreak: 'the check found a break at entry #{{seq}}',
    showEntry: 'Show entry',
    linkLabel: 'Entry #{{seq}}, {{status}}',
  },
  filters: {
    label: 'Audit filters',
    searchPlaceholder: 'Search events, actors, IDs or hashes…',
    searchLabel: 'Search the audit log',
    categories: 'Filter by category',
    ALL: 'All',
    menu: 'More filters',
    menuActive_one: '{{count}} filter on',
    menuActive_other: '{{count}} filters on',
    severity: 'Severity',
    operator: 'Operator',
    noOperator: 'System or unverified',
    live: 'Live',
    liveHint: 'Show new entries as they are written',
  },
  list: {
    label: 'Audit entries, newest first',
    count: '{{shown}} of {{total}} entries',
    empty: 'No audit entries match',
    emptyBody: 'Change the search or the filters to see more entries.',
    rowLabel: 'Entry {{seq}}: {{event}}, {{actor}}, {{time}}, chain {{chain}}',
    hashLabel: 'Hash {{hash}}',
    paused: 'Live paused',
  },
  detail: {
    entry: 'Entry',
    entryId: 'Entry ID',
    time: 'Time',
    actor: 'Actor',
    category: 'Category',
    severity: 'Severity',
    session: 'Session',
    evidence: 'Evidence',
    device: 'Device',
    method: 'Method',
    fault: 'Fault',
    chain: 'Chain link',
    record: 'Event record',
    recordHint: 'The hashed fields of this entry, as stored',
    brokenNote: 'This entry no longer matches its hash. The chain breaks here.',
    paneEmptyTitle: 'Select an entry',
    paneEmptyBody: 'The entry, its actor, its details and both hashes show here.',
    sheetLabel: 'Audit entry details',
  },
  errors: {
    panel: 'The audit view could not be shown. The log itself is unchanged.',
    verify: 'The chain could not be checked. Try again.',
  },
  // Live mode only (backend task W80): the Core server's own words for its rows and its chain check.
  live: {
    // CPS1-12 (a): AUTH_FAILED / AUTH_LOCKED name the operator whose username was typed; nobody signed in.
    typedActor: 'Username typed: {{name}}',
    // Operation 60 `stored`: the Core's check of its table, which no demo fault breaks (client spec §8.2 A9).
    storedVerified: 'Stored audit log, checked separately: verified through entry #{{seq}}',
    // JA2-31: under a FAIL of the chain the Core holds, the stored log's own result names both things.
    storedVerifiedAfterBreak: 'The break is in the chain the Core is holding. Its stored audit log, checked separately, verifies through entry #{{seq}}',
    storedBroken: 'Stored audit log, checked separately: breaks at entry #{{seq}}',
    // Operation 60 `lineageTotal`: chains a demo reset or a scenario load discarded (SD-19).
    earlierChains_one: 'The audit chain was restarted {{count}} time by a demo reset or a scenario load',
    earlierChains_other: 'The audit chain was restarted {{count}} times by demo resets or scenario loads',
    // The runtime's one link rule (useCoreLinkNotice): the list holds what the Core sent last.
    offlineTitle: 'Core server unreachable',
    offlineBody: 'The entries shown are the last the Core sent.',
  },
} as const satisfies ResourceTree;
