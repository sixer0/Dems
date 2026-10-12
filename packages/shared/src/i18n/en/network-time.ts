/**
 * `networkTime.*`: Network & Time (01_specs §14.5.6; research/04 §5.4). One display zone,
 * UTC+07:00 (D28/Q2); time sources in priority order GNSS → NTP → RTC.
 *
 * Step 50 (additive): the step-34 keys keep their text; the new groups carry the page as built
 * (banner, clock hero, tier states, network rows, the §21.1 domain policy, charts, events, toasts).
 * The domain policy lines follow the design book §21.1 (research/01_explore.md §21.1).
 */
import type { ResourceTree } from '../resource-tree';

export const networkTime = {
  title: 'NETWORK & TIME',
  subtitle: 'Time sources, synchronization and network segments',
  banner: '{{time}} • {{network}}',

  bannerState: {
    label: 'Network and time status',
    time: {
      LOCKED: 'Synchronized',
      FALLBACK: 'NTP fallback',
      HOLDOVER: 'RTC holdover',
    },
    network: {
      UP: 'Connected',
      DEGRADED: 'Degraded',
      DOWN: 'Disconnected',
    },
    detail: '{{source}} · stratum {{stratum}} · {{ip}}',
  },

  systemTime: {
    title: 'System Time',
    zone: 'UTC{{offset}}',
    zoneName: 'WIB',
    clockLabel: 'System time {{time}}, UTC{{offset}}',
    secondsLabel: 'Second {{second}} of 60',
    source: 'Time source',
    sourceValue: {
      GNSS: 'GPS (GNSS stratum 1)',
      NTP: 'NTP server (stratum {{stratum}})',
      RTC: 'Real-time clock (holdover)',
    },
    chain: 'Recording timestamps',
    chainValue: '{{source}} → System Time Service → recording timestamps',
    avSync: {
      title: 'A/V sync',
      state: {
        HEALTHY: 'Healthy',
        DEGRADED: 'Degraded',
      },
      skew: 'CH1 ↔ CH2',
      skewValue: 'Sample-synchronous',
      trackStart: 'Track start',
      trackStartValue: 'Common timeline',
      sourceMeta: 'Source metadata',
      sourceMetaValue: '{{source}} {{lock}}',
      derived: 'Derived for the demo; the A/V limits are not specified yet.',
    },
  },

  hierarchy: {
    title: 'Time-source hierarchy',
    note: 'GNSS first, NTP as fallback, RTC last.',
    active: 'Active',
    standby: 'Standby',
    lock: 'Lock',
    stratum: 'Stratum',
    lastSync: 'Last sync',
    offset: 'Offset',
    server: 'Server',
    tiers: {
      GNSS: 'GNSS receiver',
      NTP: 'NTP server',
      RTC: 'Real-time clock',
    },
    tierState: {
      ACTIVE: 'Active',
      STANDBY: 'Standby',
      LOST: 'Signal lost',
      UNREACHABLE: 'Unreachable',
    },
    tierDetail: {
      GNSS: '{{satellites}} satellites · PPS',
      GNSS_LOST: 'No fix · GNSS SMA link down',
      NTP: '{{server}} · server stratum {{stratum}}',
      NTP_DOWN: '{{server}} · no reply',
      RTC: 'Drift {{drift}} ppm · battery-backed',
      RTC_ACTIVE: 'Free-running since {{since}}',
    },
    fallback: 'Fallback',
    locked: 'LOCKED',
    unlocked: 'UNLOCKED',
    agoSeconds: '{{time}} · {{seconds}} s ago',
    agoMinutes: '{{time}} · {{minutes}} min ago',
    offsetValue: '{{value}} ms',
    satellites: '{{satellites}} SV',
    orbitLabel: 'GNSS constellation: {{satellites}} satellites in view',
    orbitLost: 'No satellites in view',
    noFix: 'NO FIX',
  },

  network: {
    title: 'Network Status',
    lan: 'LAN',
    poe: 'PoE Network',
    bandwidth: 'Bandwidth',
    bandwidthValue: '{{down}} / {{up}}',
    ipAddress: 'IP address',
    networkName: 'Network',
    lanConnection: 'LAN Connection',
    lanDetail: '{{ip}} · {{name}} · {{speed}} Gbps · gateway {{gateway}}',
    lanState: {
      UP: 'Connected',
      DOWN: 'Disconnected',
    },
    poeState: {
      UP: 'Active',
      DEGRADED: 'Degraded',
    },
    poePorts: '{{active}}/{{total}} ports',
    poeBudget: '{{draw}} W of {{budget}} W budget',
    down: 'Down',
    up: 'Up',
    mbps: '{{value}} Mbps',
    sparklineLabel: 'Bandwidth over the last {{seconds}} seconds: {{down}} Mbps down, {{up}} Mbps up',
    collecting: 'Collecting samples…',
    tablet: 'Operator device link',
    tabletState: {
      CONNECTED: 'Connected',
      OFFLINE: 'Offline',
    },
    tabletDetail: 'Management domain · paired operator device',
    tabletOffline: 'Recording continues on the Core. The device resyncs when it reconnects.',
    ports: {
      POE_CAM_1: 'CAM 1',
      POE_CAM_2_AUX: 'CAM 2 / AUX',
      MGMT_LAN: 'MGMT',
      GNSS_SMA: 'GNSS',
    },
    linkUp: 'link up',
    linkDown: 'link down',
  },

  domains: {
    title: 'Network domains',
    core: 'Core',
    tablet: 'Tablet',
    exportPath: 'Export path (on demand)',
    cameras: 'Cameras',
    service: 'Service',
    export: 'Export',
    cameraNic: 'Camera NIC · PoE',
    mgmtNic: 'MGMT NIC',
    noRoute: 'No direct route',
    diagramLabel: 'Network segmentation: cameras reach only the Core; the tablet reaches the Core over the management domain.',
    vlan: 'VLAN {{vlan}}',
    name: {
      CAMERA: 'Camera Domain',
      MANAGEMENT: 'Management Domain',
      SERVICE_UPDATE: 'Service / Update',
      EXPORT_TRANSFER: 'Export / Transfer',
    },
    access: {
      CAMERA: 'Camera ↔ Core only',
      MANAGEMENT: 'Tablet ↔ Core approved services',
      SERVICE_UPDATE: 'Authorized service workflow only',
      EXPORT_TRANSFER: 'Role-authorized flow only',
    },
    rule: {
      CAMERA: 'No direct tablet routing',
      MANAGEMENT: 'Default deny other services',
      SERVICE_UPDATE: 'Disabled or restricted in normal mode',
      EXPORT_TRANSFER: 'Audited and verified',
    },
    state: {
      ACTIVE: 'Active',
      DEGRADED: 'Degraded',
      DOWN: 'Down',
      RESTRICTED: 'Restricted',
      ON_DEMAND: 'On demand',
      TRANSFER: 'Transfer',
      UPDATING: 'Updating',
    },
  },

  history: {
    title: 'Time-offset history',
    now: '{{value}} ms now',
    band: 'GNSS ±4 ms',
    empty: 'Collecting samples: one point every 10 s.',
    ariaLabel: 'Clock offset over the last {{samples}} samples, now {{value}} ms from {{source}}',
    tooltipAt: '{{time}}',
    tooltipValue: '{{value}} ms · {{source}}',
    unit: 'ms',
  },

  log: {
    title: 'Network and time events',
    columns: {
      time: 'Time',
      event: 'Event',
      source: 'Source',
    },
    empty: 'No network or time events yet.',
    source: {
      TIME: 'Time',
      LAN: 'LAN',
      TABLET: 'Tablet',
      POE: 'PoE / Camera',
      EXPORT: 'Export',
      SERVICE: 'Service',
      SYSTEM: 'System',
    },
    detail: {
      source: '{{source}}',
      fault: '{{kind}}',
      evidence: '{{id}}',
      version: 'v{{version}}',
    },
  },

  toast: {
    gnssLost: 'GNSS signal lost',
    gnssLostDetail: 'Time is now held by NTP ({{server}}). Recording timestamps stay trusted.',
    rtcHoldover: 'No time reference',
    rtcHoldoverDetail: 'The RTC holds time and the offset drifts until GNSS or NTP returns.',
    restored: 'GNSS lock restored',
    restoredDetail: 'The time source is back to GNSS stratum 1.',
    tabletOffline: 'Operator device link lost',
    tabletOfflineDetail: 'Recording continues on the Core.',
  },
} as const satisfies ResourceTree;
