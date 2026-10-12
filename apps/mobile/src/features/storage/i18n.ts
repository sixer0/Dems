import type { ResourceTree } from '@/i18n/resources';

/**
 * English copy of the `storage` feature, mounted at `features.storage.*` through
 * `src/i18n/features.ts` (04_mobile_specs §9). Owner: step 85 (P6).
 *
 * The screen reuses the shared terms first, so web and mobile say the same thing: `common.storage.*`
 * (legend and KPI words, USED), `storage.*` (the web Storage page: banner, toast, activity, manage
 * sheet, units) and `common.eventType.*` / `common.faultKind.*` / `common.roles.*`. Only what this
 * screen alone says lives here.
 */
export const storageEn = {
  header: {
    title: 'Storage',
    back: 'Back',
  },
  capacity: {
    label: 'Evidence capacity',
    /** MB 8 headline: "3.2 TB Free". */
    freeHeadline: '{{free}} Free',
    ringA11y: 'Evidence storage {{percent}}% used, {{state}}',
    legendA11y: '{{label}}: {{value}}',
    // Fix wave J (JA2-38 / JT-21): the two counts are named for what they are (not the size of the Evidence list).
    sealedToday: 'Sealed today',
    notSealed: 'Recorded, not sealed',
  },
  kpi: {
    groupLabel: 'Storage indicators',
    idle: 'Idle',
    recording: 'Recording · {{rate}} GB/h',
    recordingShort: 'Recording',
    noSession: 'No session',
    live: 'Live',
    atRate: 'at {{rate}} GB/h',
    remaining: '{{hours}}h {{minutes}}m',
    retention: 'Retention',
    retentionValue: '{{days}} days',
    a11y: '{{label}}: {{value}}, {{caption}}',
  },
  activity: {
    seeAll: 'See All',
    rowA11y: '{{time}}, {{title}}',
  },
  manage: {
    a11yHint: 'Opens the storage policy',
    readOnlyTitle: 'View only',
    readOnlyReason: 'Your role ({{role}}) can view the storage policy. A Supervisor or Technician changes it.',
    signedOutReason: 'Sign in as a Supervisor or Technician to change the storage policy.',
    thresholdsNote: 'Set by the Core. Read-only on this device.',
    close: 'Close',
    current: 'Current: {{policy}} · auto-archive {{autoArchive}}',
  },
  // LIVE mode (backend task, plan row W79; rule 8, MD-8): the toast after the Core applied a policy change
  // reads the shared `storage.manage.live.applied` of row W71, the web console's key. Row W79's own
  // `live.applied` was merged into it in the closing copy round (decision D168 DN-2, W83 ledger #91).
} as const satisfies ResourceTree;
