import type { ResourceTree } from '@/i18n/resources';

/**
 * English copy of the `session-live` feature (the Session Monitor, 04_mobile_specs §4.5, MB 4),
 * mounted at `features.session-live.*` through `src/i18n/features.ts` (04 §9). Step 79 is its only
 * writer (P6).
 *
 * Most of the monitor's words are shared with the web Session Monitor and come from
 * `@dems/shared/i18n` (`session.*`: End Session dialog, marker, snapshot, feed, timeline kinds;
 * `common.*`: enums, devices, units) or from the mobile namespace (`mobile.backGuard.*`,
 * `mobile.coreLink.*`). This tree holds only what the phone and tablet monitor alone says. The
 * stop action is "End Session" everywhere (D38 Q-M5; MB 4 reads "Stop Session").
 */
export const sessionLiveEn = {
  // S1 header (MB 4 "Active Session").
  title: 'Active Session',
  back: 'Back',
  history: 'Session timeline',
  historyHint: 'Opens the timeline of this session',
  historyBadge_one: '{{count}} new event',
  historyBadge_other: '{{count}} new events',

  // S2b §5.4 status strip (research 01 §5.4: "VIDEO 1 REC … STORAGE OK … TIME GNSS LOCKED").
  strip: {
    label: 'Recording status',
    video: 'VIDEO {{index}}',
    storage: 'STORAGE',
    time: 'TIME',
    offline: 'OFFLINE',
  },

  // S3 live feed.
  feed: {
    cameraShort: 'CAM {{index}}',
    switchHint: 'Tap the feed to switch camera',
    switchTo: 'Switch to {{camera}}',
    cameraTabs: 'Camera',
    snapshots_one: '{{count}} snapshot',
    snapshots_other: '{{count}} snapshots',
    a11y: 'Live feed, {{camera}}, {{room}}',
  },

  // S4 MIC cards.
  mic: {
    meterLabel: '{{mic}} level',
  },

  // S2, task 3 M5 (row 73; D84, erratum PE-128-79): RECORDING before the first durable fragment.
  // The mic switch itself speaks the shared words of the web twin (`session.audioSource.*`).
  connecting: 'Connecting cameras…',

  // S5 action tiles (MB 4: Snapshot, Bookmark, Audio Monitor, Settings).
  tiles: {
    label: 'Session actions',
    snapshotHint: 'Captures a still from the active camera',
    bookmark: 'Bookmark',
    bookmarkHint: 'Adds a marker to the session timeline',
    audioMonitor: 'Audio Monitor',
    audioMonitorHint: 'Opens the large MIC meters',
    settings: 'Settings',
    settingsHint: 'Opens the monitor settings',
  },

  // S5 Bookmark = Add Marker popover.
  marker: {
    optional: 'Optional. Empty labels are numbered automatically.',
  },

  // S5 Audio Monitor and Settings sheets.
  sheets: {
    close: 'Close',
    audioTitle: 'Audio Monitor',
    audioDescription: 'MIC 1 and MIC 2 are separate tracks and are never mixed.',
    settingsTitle: 'Monitor settings',
    settingsDescription: 'Display only. Recording on the Core is not affected.',
    pauseDescription: 'Pauses the preview and dims the meters. Recording continues.',
    camera: 'Camera',
    meterScale: 'Meter size',
    meterScaleStandard: 'Standard',
    meterScaleCompact: 'Compact',
    timelineTitle: 'Session timeline',
    timelineEmpty: 'No events yet',
  },

  // S6 End Session (M-C-19): hold 1.5 s, then the reason dialog.
  endSession: {
    holdA11yHint: 'Opens the End Session dialog. A reason is required.',
    holding: 'Keep holding…',
    reasonCount: '{{count}} / {{max}}',
    ending: 'Ending…',
  },

  // S7 connection banner (the banner copy itself is `mobile.coreLink.*`).
  banner: {
    readOnly: 'Session actions are paused until the Core link is back.',
  },

  // Toasts for refused simulator actions (SimTransitionError, D61).
  errors: {
    notRecording: 'The session is no longer recording.',
    actionFailed: 'That action could not be completed. Please try again.',
    readOnly: 'Session actions are paused while the Core link is offline.',
  },
} as const satisfies ResourceTree;
