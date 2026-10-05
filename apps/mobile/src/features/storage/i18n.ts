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
    thresholdsNote: 'Set by the Core. Read-only on this tablet.',
    close: 'Close',
    current: 'Current: {{policy}} · auto-archive {{autoArchive}}',
  },
  /**
   * LIVE mode (backend task, plan row W79; rule 8, MD-8): the Core server applied the change, so the
   * words say nothing of a simulation. The web console's twin is the shared `storage.manage.live.*`
   * of row W71 (one shared key for both clients is the contract close-out's, W83).
   */
  live: {
    applied: 'Storage policy updated',
  },
} as const satisfies ResourceTree;
