import type { ResourceTree } from '@/i18n/resources';

/**
 * English copy of the `network-time` feature, mounted at `features.network-time.*` through
 * `src/i18n/features.ts` (04_mobile_specs §9). Owner: step 86 (P6). Shared terms come from
 * `@dems/shared/i18n` (`networkTime.*`: network rows, tier names and states, sync states, the
 * fallback toasts; `common.actions.*`, `common.errors.*`), so web and mobile say the same thing.
 * This tree holds only what the mobile screen alone says, in the MB 9 wording (Title Case labels,
 * "GPS (GNSS Stratum-1)").
 */
export const networkTimeEn = {
  header: {
    title: 'Network & Time',
    back: 'Back',
  },
  network: {
    lanDetailHint: 'Opens the LAN connection details',
    bandwidthDown: '{{value}} Mbps',
    bandwidthUp: '↑ {{value}} Mbps',
    bandwidthLabel: 'Bandwidth {{down}} Mbps down, {{up}} Mbps up',
    poeLabel: 'PoE Network, {{state}}, {{active}} of {{total}} ports',
  },
  time: {
    title: 'Time Synchronization',
    gnssNtp: 'GNSS / NTP',
    lastSync: 'Last Sync',
    lastSyncAgo: '{{seconds}} s ago',
    timeSource: 'Time Source',
    server: 'Server',
    sourceValue: {
      GNSS: 'GPS (GNSS Stratum-1)',
      NTP: 'NTP Server (Stratum-{{stratum}})',
      RTC: 'RTC (holdover)',
    },
    hierarchy: 'Time-source hierarchy',
    hierarchyLabel: 'Time-source hierarchy GNSS, then NTP, then RTC. Active: {{tier}}',
    tierLabel: '{{tier}}, {{name}}, {{state}}',
    orbitLabel: 'GNSS locked, {{satellites}} satellites in view',
    orbitLost: 'GNSS: no fix',
  },
  systemTime: {
    clockLabel: 'System time {{time}}, {{zone}}, {{date}}',
    synchronized: 'Synchronized',
    freeRunning: 'Free-running',
  },
  lan: {
    title: 'LAN Connection',
    description: 'Management LAN of the DEMS Core',
    ipAddress: 'IP address',
    network: 'Network',
    linkSpeed: 'Link speed',
    linkSpeedValue: '{{value}} Gbps',
    gateway: 'Gateway',
    poePorts: 'PoE ports',
    poeBudget: 'PoE power',
    tablet: 'Tablet link',
  },
  errors: {
    panel: 'This card could not be displayed. The rest of the screen keeps working.',
  },
} as const satisfies ResourceTree;
