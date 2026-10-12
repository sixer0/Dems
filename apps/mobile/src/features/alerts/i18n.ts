import type { ResourceTree } from '@/i18n/resources';

/**
 * English copy of the alert toasts (fix wave J, JA2-05), mounted at `features.alerts.*`. The alert's
 * own words are the bell's (`alertLabel`): shared `common.faultKind.*` and the capture notices.
 */
export const alertsEn = {
  toast: {
    /** Under a CRITICAL alert's words: why this toast does not go away. */
    criticalDescription: 'Critical alert at {{time}}. It stays until it is acknowledged.',
    warningDescription: 'Alert at {{time}}. The bell lists it.',
    acknowledge: 'Acknowledge',
    /** The accessible announcement of a toast (the kit shows label + description). */
    announceCritical: 'Critical alert: {{label}}',
    announceWarning: 'Alert: {{label}}',
  },
} as const satisfies ResourceTree;
