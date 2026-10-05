import type { ResourceTree } from '@/i18n/resources';

/**
 * English copy of the `devices` feature, mounted at `features.devices.*` through
 * `src/i18n/features.ts` (04_mobile_specs §9). Owner: step 84 (P6).
 *
 * Shared terms come from `@dems/shared/i18n`: section titles and device facts from `devices.*`
 * (the web page's namespace, step 48), device names from `common.devices`, status words from
 * `common.status`, enums from `common.enums`, audit types from `common.auditType`, the diagnostics
 * checks from `system.diagnostics`. This tree holds only what the mobile screens alone say.
 * "SEDANG MEREKAM" stays the shared `devices.other.recordingLamp` (D28/Q3).
 *
 * Backend task W78 added `live.*`, additively: the words the screens show in LIVE mode where the
 * Simulated screens say "simulated". Every earlier key keeps its value.
 */
export const devicesEn = {
  header: {
    title: 'Devices & Inputs',
    back: 'Back to Devices',
    detailTitle: 'Device Details',
  },
  list: {
    label: 'Devices and inputs',
    rowLabel: '{{name}}, {{detail}}, {{status}}',
    rowHint: 'Opens the device details',
    thumbnail: 'Preview of {{name}}',
    micBadge: 'Microphone',
  },
  mic: {
    title1: 'MIC 1 – Interviewer',
    title2: 'MIC 2 – Subject',
    meterLabel: '{{name}} input level',
  },
  status: {
    CLIP: 'Clipping',
  },
  attention: {
    title_one: '{{count}} device needs attention',
    title_other: '{{count}} devices need attention',
    recordingContinues: 'Recording continues on the Core.',
  },
  pane: {
    emptyTitle: 'Select a device',
    emptyBody: 'Its live preview or level meter, health and log appear here.',
  },
  detail: {
    notFound: 'This device is not part of this room.',
    notFoundBack: 'Back to the list',
    lampOff: 'Off',
    linkValue: 'Relay output · room lamp',
    sinceValue: '{{time}} UTC+07:00',
    poePorts: '{{active}} of {{total}} PoE ports in use',
    watts: '{{value}} W',
    mbps: '{{value}} Mbps',
    dbfs: '{{value}} dBFS',
    percent: '{{value}}%',
    readOnlyNote: 'Gain and phantom power are read-only in this demo.',
    clipLatched: 'Latched',
    tabletSelf: 'This tablet · Core link',
  },
  health: {
    unavailable: 'No samples yet. They appear once per second.',
  },
  actions: {
    diagnostics: 'Diagnostics',
    diagnosticsLabel: 'Run diagnostics',
    testSignal: 'Test signal',
    restart: 'Restart',
    restartNeedsTechnician: 'Requires the Technician role',
    testSignalTitle: 'Send a test signal to {{name}}?',
    testSignalBody: 'Simulated. A short test tone or pattern is sent and the command is written to the audit log.',
    restartTitle: 'Restart {{name}}?',
    restartBody: 'Simulated. The device restarts and the command is written to the audit log.',
    confirm: 'Confirm',
    cancel: 'Cancel',
  },
  diagnostics: {
    close: 'Close diagnostics',
    failedToStart: 'Diagnostics could not start. Please try again.',
  },
  /**
   * LIVE mode (backend task W78; 04_client_integration_spec §3.2, MD-8; gateway rule 8): the Core
   * server carries the commands out and answers them, and the screens show its data, so nothing
   * here says "simulated". SIMULATED and HEARTBEAT mode keep the words above and the shared
   * `devices.*` and `common.deviceMenu.*` copy, unchanged.
   */
  live: {
    testSignalBody: 'A short test tone or pattern is sent and the Core writes the command to its audit log.',
    restartBody: 'The Core restarts the device and writes the command to its audit log.',
    testSignalSent: 'Test signal sent to {{name}}',
    restarted: '{{name}} restarted',
    unsupported: '{{name}} does not accept this command.',
    /** The device log's detail cell for a DEVICE_COMMAND row, by `details.command`. */
    command: {
      TEST_SIGNAL: 'Test signal',
      RESTART: 'Restart',
      IDENTIFY: 'Identify',
    },
    // Row M1 follow-up (D160, CONTRACT-GAP-W78-2): the Core serves no per-device health history, so the
    // LIVE line is computed on this device from the Core's data (§3.2: say what is true).
    samples_one: "Derived on this device from the Core's data · {{count}} sample",
    samples_other: "Derived on this device from the Core's data · last {{count}} samples",
    diagnosticsSubtitle: 'Eight health checks on the Core, one after another.',
  },
} as const satisfies ResourceTree;
