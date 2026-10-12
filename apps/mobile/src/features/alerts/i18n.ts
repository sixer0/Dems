import type { ResourceTree } from '@/i18n/resources';

/**
 * English copy of the alert toasts (fix wave J, JA2-05), mounted at `features.alerts.*`. The alert's
 * own words are the bell's (`alertLabel`): shared `common.faultKind.*` and the capture notices.
 */
export const alertsEn = {
  toast: {
    /**
     * Under a CRITICAL alert's words: the life of this toast. Fix wave Q (CT-04, CP-06; ruling of D246): it said
     * "It stays until it is acknowledged" and left when the Core resolved the alert. The toast leaves when the
     * alert is acknowledged OR resolved by the Core; the alert itself stays in the bell until it is acknowledged.
     */
    criticalDescription: 'Critical alert at {{time}}. It stays until it is acknowledged or the Core reports it resolved. The bell keeps it until it is acknowledged.',
    warningDescription: 'Alert at {{time}}. The bell lists it.',
    acknowledge: 'Acknowledge',
    /** The accessible announcement of a toast (the kit shows label + description). */
    announceCritical: 'Critical alert: {{label}}',
    announceWarning: 'Alert: {{label}}',
  },
} as const satisfies ResourceTree;
