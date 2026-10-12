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
    // Fix wave J (JM-05): the card's state line, drawn by React from the first second of a recording.
    levelState: {
      WAITING: 'Waiting for the first level reading',
      OK: 'Receiving audio',
      NO_SIGNAL: 'No signal',
      NOT_MEASURED: 'Not measured',
      // Task 4 row 170 (site M4): the meter channel of the card has no input - the selector in force holds no complete pair.
      ABSENT: 'No microphone input',
    },
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
    // Fix wave J (JT-07): what a Core in its own capture records - ONE audio track, fed by the active microphone;
    // the standby is recorded only from a switch on (the sealed item lists the intervals). The sentence above and
    // the names "Interviewer" / "Subject" describe the simulated lane's two tracks and stay there only.
    audioDescriptionOwnCapture: 'This Core records one audio track, from the active microphone. The standby microphone is recorded only after you switch to it; the sealed item lists which microphone fed the track, and when. The two are never mixed.',
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

  // S6 End Session (M-C-19; fix wave Q, JT-09): a tap or a hold opens the reason dialog - the dialog is the guard.
  endSession: {
    holdA11yHint: 'Opens the End Session dialog. A reason is required.',
    hint: 'Tap or hold. A reason is asked before anything ends.',
    linkLost: 'Core link lost. The session can be ended from this device when the link is back.',
    holding: 'Keep holding…',
    reasonCount: '{{count}} / {{max}}',
    reasonRule: 'At least {{min}} characters.',
    ending: 'Ending…',
  },

  // S7 connection banner (the banner copy itself is `mobile.coreLink.*`).
  banner: {
    readOnly: 'Session actions are paused until the Core link is back.',
  },

  // Round two (JT-11): what a snapshot IS - a mark on the session's timeline; the contract stores no image for it.
  snapshotMarked: 'Snapshot marked on the timeline. No image is stored.',

  // Round two (JA2-19): the monitor's last picture while it leaves for a screen other than Finalizing.
  leaving: {
    recoveryTitle: 'The recording was interrupted',
    recoveryBody: 'Opening session recovery…',
    endedTitle: 'This session is no longer recording',
    endedBody: 'Opening the next screen…',
  },

  // Round two (JA2-06): a microphone the Core reports without a signal, said above the switch.
  micNoSignal: {
    title: '{{mic}}: no signal',
    activeBody: 'The active microphone delivers no audio. The recording continues without sound from it until the signal returns or you switch.',
    standbyBody: 'The standby microphone delivers no audio. The active microphone is not affected.',
  },

  // Task 4 row 170 (site M4): the selector in force holds no complete microphone pair, so there is nothing to
  // switch from or to. Said where the toggle would be; reachable only in Simulated mode (a Core in its own
  // capture refuses the start of a session while a slot is unassigned, decision C25).
  micPairIncomplete: 'The microphone pair is not complete. There is nothing to switch.',

  // Toasts for refused simulator actions (SimTransitionError, D61).
  errors: {
    notRecording: 'The session is no longer recording.',
    actionFailed: 'That action could not be completed. Please try again.',
    readOnly: 'Session actions are paused while the Core link is offline.',
  },
} as const satisfies ResourceTree;
