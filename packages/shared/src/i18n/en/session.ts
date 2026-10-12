/**
 * `session.*`: Session Monitor panels K–T and the finalization overlay (01_specs §14.5.2;
 * research/04 §3.2). The misspelt mockup label is corrected to "Pause Monitoring" (§9 #2);
 * the stop action is "End Session" everywhere (D38, §9 #27).
 * Step 44 added keys only (banner SETUP/SEALED/RECOVERY and CTAs, the idle invitation, the
 * integrity re-verify states, action feedback and errors, timeline and finalization details);
 * no existing key changed, because mobile step 79 reads the same namespace.
 */
import type { ResourceTree } from '../resource-tree';

export const session = {
  /** K: page header and status banner. */
  title: 'SESSION MONITOR',
  subtitle: 'Live interview session supervision, recording control, and evidence integrity tracking.',
  banner: {
    ACTIVE: {
      title: 'SESSION ACTIVE & SECURE',
      detail: 'Recording in progress • All integrity checks passing',
    },
    ATTENTION: {
      title: 'ATTENTION',
      detail: 'Recording continues • {{reason}}',
    },
    FAULT: {
      title: 'FAULT',
      detail: '{{reason}}',
    },
    NO_SESSION: {
      title: 'NO SESSION',
      detail: 'No interview is being recorded.',
    },
    FINALIZING: {
      title: 'FINALIZING',
      detail: 'Sealing evidence • step {{current}} of {{total}}',
      stopping: 'Ending recording • closing tracks',
    },
    SETUP: {
      title: 'SESSION SETUP',
      detail: 'Pre-recording setup • {{state}}',
    },
    SEALED: {
      title: 'SESSION SEALED',
      detail: 'Evidence {{evidenceId}} sealed • Ready for the next session',
    },
    RECOVERY: {
      title: 'RECOVERY',
      detail: 'Recovering the interrupted session • {{stage}}',
    },
    recordingContinues: 'Recording continues • {{reason}}',
    cta: {
      continueSetup: 'Continue setup',
      recover: 'Start recovery',
      viewEvidence: 'View evidence',
    },
  },

  /** NO SESSION state (M-PG-SM): the invitation shown in the feed panel. */
  idle: {
    title: 'No active session',
    body: 'The system is ready to begin a new recording session when required.',
    setupTitle: 'Session setup in progress',
    setupBody: 'Finish the pre-recording checks to start recording.',
    sealedTitle: 'Session sealed',
    sealedBody: 'Evidence {{evidenceId}} is sealed and ready for review.',
    faultTitle: 'Session interrupted',
    faultBody: 'A critical fault stopped the session. Start recovery to keep the recorded part as incomplete.',
  },

  /** L: live feed overlays. */
  feed: {
    title: 'LIVE SESSION FEED',
    /** Live mode: the accessible name of the camera picture, which is the bundled demo loop (MS-1), not the Core's camera (plan row W0, item 7). */
    bundledPicture: 'Bundled demo picture',
    cameraLabel: '{{camera}} - {{room}}',
    rec: 'REC',
    preview: 'PREVIEW',
    noSignal: 'NO SIGNAL',
    reconnecting: 'Reconnecting…',
    cameraSwitch: 'Camera',
    fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit fullscreen',
    monitoringPaused: 'Monitoring paused. Recording continues.',
  },

  /** M: session details (key-values). */
  details: {
    title: 'SESSION DETAILS',
    sessionId: 'Session ID',
    caseNumber: 'Case Number',
    investigator: 'Investigator',
    subjectType: 'Subject Type',
    subject: 'Subject',
    room: 'Interview Room',
    startTime: 'Start Time',
    duration: 'Duration',
    profile: 'Recording Profile',
    evidenceId: 'Evidence ID',
    state: 'State',
  },

  /** N: evidence integrity checks. */
  integrity: {
    title: 'EVIDENCE INTEGRITY',
    encryption: {
      label: 'Encryption Active',
      value: 'AES-256',
    },
    hashChain: {
      label: 'Hash Chain Active',
      value: 'SHA-256',
    },
    timestamp: {
      label: 'Secure Timestamp Synced',
      value: '{{source}} (UTC{{offset}})',
    },
    storageWrite: {
      label: 'Storage Write Verified',
      value: 'Continuous',
      idle: 'Standby',
    },
    hashChainBroken: 'Discontinuity',
    reverify: 'Re-verify',
    verifying: 'Verifying…',
    chainHead: 'Chain head',
    verifiedRows: 'PASS • {{count}} rows',
    brokenAt: 'FAIL • row {{index}}',
    verifyFailed: 'The audit chain could not be verified. Please try again.',
    checkStatus: {
      pass: 'Passing',
      warn: 'Warning',
      fail: 'Failing',
      idle: 'Standby',
    },
  },

  /** O: audio monitor. */
  audio: {
    title: 'AUDIO MONITOR',
    clipReset: 'Reset clip',
    micIcon: '{{mic}} microphone',
  },

  /**
   * O: the mic switch, the silence warning and the audio-source band (task 3 M5, blueprint row 72;
   * 08_client_ux_spec §3 flow 2; operations 81 and 82). One block, added whole; no other key changed.
   */
  audioSource: {
    role: {
      ACTIVE: 'Active',
      STANDBY: 'Standby',
    },
    switchTo: 'Switch to {{mic}}',
    checking: 'Checking your permissions…',
    rolesJoin: 'or',
    block: {
      NOT_RECORDING: 'The microphone can be switched while a session is recording.',
      HOLDER: 'Only the operator who opened this session or a supervisor can switch the microphone.',
    },
    confirm: {
      title: 'Switch the active microphone to {{mic}}?',
      body: 'Recording continues. {{from}} becomes the standby microphone. The switch is written to the audit log.',
      action: 'Switch microphone',
    },
    switched: 'Active microphone: {{mic}}',
    failed: 'The microphone was not switched.',
    refusal: {
      CONFLICT: 'The requested microphone cannot become the active source.',
      NOT_RECORDING: 'The session is not recording. The microphone was not switched.',
      NOT_OPEN: 'That session is not the open session.',
    },
    silent: {
      title: '{{mic}} is silent',
      body: 'Below {{dbfs}} dBFS for {{seconds}} s. Recording continues. The microphone is never switched automatically.',
      action: 'Switch to standby',
    },
    band: {
      label: 'Audio source over time',
      caption: 'Audio source',
      open: '{{mic}} from {{from}}',
      closed: '{{mic}} from {{from}} to {{to}}',
      unavailable: 'The audio source history could not be read.',
    },
    timelineDetail: '{{from}} to {{to}}',
    connecting: {
      title: 'CONNECTING CAMERAS…',
      detail: 'Connecting cameras… Recording has not started.',
    },
  },

  /** P: action bar. */
  actions: {
    label: 'Session actions',
    pauseMonitoring: {
      title: 'Pause Monitoring',
      subtitle: 'Keep recording',
    },
    resumeMonitoring: {
      title: 'Resume Monitoring',
      subtitle: 'Show live preview and meters',
    },
    addMarker: {
      title: 'Add Marker',
      subtitle: 'Important event',
      field: 'Marker label',
      placeholder: 'Describe the moment',
      submit: 'Add marker',
      added: 'Marker added at {{time}}',
      optional: 'Optional. Leave empty for a plain marker.',
    },
    sessionNote: {
      title: 'Session Note',
      /** Neutral, when no role is known; the console shows `subtitleBy` / `drawerTitleBy` of the signed-in role. */
      subtitle: 'Add a session note',
      drawerTitle: 'Session note',
      /**
       * E-fix FX-W2: by the signed-in operator's role, as the timeline titles the note by its author's
       * role (FX-C, E2E-T-5; `noteBy`). A supervisor's drawer said "Investigator note".
       */
      subtitleBy: {
        SUPERVISOR: 'Add supervisor note',
        INVESTIGATOR: 'Add investigator note',
        TECHNICIAN: 'Add technician note',
      },
      drawerTitleBy: {
        SUPERVISOR: 'Supervisor note',
        INVESTIGATOR: 'Investigator note',
        TECHNICIAN: 'Technician note',
      },
      field: 'Note',
      placeholder: 'What happened?',
      submit: 'Save note',
      saved: 'Note added',
      empty: 'Write a note first.',
      tooLong: 'Keep the note under {{max}} characters.',
      counter: '{{count}} / {{max}}',
    },
    snapshot: {
      title: 'Snapshot',
      subtitle: 'Capture image',
      captured: 'Snapshot captured',
      capturedDetail: '{{camera}} at {{time}} • attached to the session timeline',
      failed: 'The snapshot could not be captured. Please try again.',
    },
    evidenceQueue: {
      title: 'Open Evidence Queue',
      subtitle: 'View recorded files',
      snapshots_one: '{{count}} snapshot this session',
      snapshots_other: '{{count}} snapshots this session',
    },
    endSession: {
      title: 'End Session',
      subtitle: 'End recording and seal evidence',
      holdHint: 'Hold to end the session',
      dialogTitle: 'End Session?',
      dialogBody:
        'Recording ends, then the evidence is finalized and sealed. This cannot be undone.',
      reasonLabel: 'Reason',
      reasonPlaceholder: 'Why is the session ending?',
      reasonTooShort: 'Enter a reason of at least {{min}} characters.',
      confirm: 'End Session',
      keepRecording: 'Keep recording',
      failed: 'The session could not be ended. Please try again.',
      notPermitted: 'Your role cannot end sessions.',
      /** Live mode (plan row W65, [CS] §8.3 B-2): a stop answered 409 because the session had already ended (Q16). */
      alreadyEnded: 'The session was already ended.',
    },
    unavailable: 'Available during a recording session',
    failed: 'That action is not available right now. Please try again.',
  },

  /** Q: session timeline. */
  timeline: {
    title: 'SESSION TIMELINE',
    viewAll: 'View All Events',
    kind: {
      START: 'Recording Started',
      /** Neutral: a note whose author's role is not on the item (E2E-T-5); `noteBy` names the role. */
      NOTE: 'Note Added',
      AUDIO_PEAK: 'Audio Peak Detected',
      /** Schema v2 (SH-03, WB-10): the operator switched the active mic input (op 81). */
      AUDIO_SWITCH: 'Microphone Switched',
      HEALTH: 'Device Health Normal',
      AUTOSAVE: 'Evidence Auto-Save',
      CHECK: 'System Check',
      MARKER: 'Marker Added',
      SNAPSHOT: 'Snapshot Captured',
      FAULT: 'Fault Detected',
    },
    /**
     * E-fix FX-C (E2E-T-5): the title of a NOTE row by its author's role (`params.authorRole`),
     * chosen by `timelineTitleKey` of `@dems/shared/sim`. A supervisor's note read "Investigator
     * Note Added".
     */
    noteBy: {
      SUPERVISOR: 'Supervisor Note Added',
      INVESTIGATOR: 'Investigator Note Added',
      TECHNICIAN: 'Technician Note Added',
    },
    audioPeakDetail: '{{mic}} {{value}} dBFS, within threshold',
    autosaveDetail: 'Segment {{segment}} saved ({{size}})',
    empty: 'The timeline starts when recording starts.',
  },

  /** R: camera & input status. */
  inputs: {
    title: 'CAMERA & INPUT STATUS',
    viewAll: 'View All Inputs',
    offline: 'OFFLINE',
  },

  /** S: storage during session (values use `common.storage`). */
  storage: {
    title: 'STORAGE DURING SESSION',
    writeRate: 'Write rate',
    viewStorage: 'View Storage',
    writeRateAria: 'Write rate: {{value}}',
    free: '{{free}} Free',
    ofTotal: 'of {{total}}',
  },

  /** T: live audit events. */
  audit: {
    title: 'LIVE AUDIT EVENTS',
    viewAll: 'View All',
    empty: 'No audit events yet.',
    hash: 'Hash {{hash}}',
  },

  /** Finalization overlay (FINALIZING → SEALED); step labels in `common.enums.finalizationStep`. */
  finalization: {
    title: 'Finalizing evidence',
    sealedTitle: 'Evidence sealed',
    subtitle: 'Session {{sessionId}}',
    progress: '{{percent}}% complete',
    sealed: 'SEALED',
    sealedBody: 'Evidence {{evidenceId}} sealed',
    viewEvidence: 'View in Evidence',
    stopping: 'Ending recording and closing tracks…',
    stepDuration: '{{seconds}} s',
    // Row 87 (UX spec flows 3 and 4; E-13): the Core's own progress, ETA and resume mark, forward-only.
    stepProgress: '{{percent}}%',
    eta: 'About {{seconds}} s left',
    estimating: 'Estimating the time left…',
    resumed: 'Resumed after restart',
    sealedIn: 'Sealed {{seconds}} s after the recording ended',
    packageTitle: 'Evidence package (DEMO)',
    manifestDigest: 'Manifest SHA-256',
    signature: 'Signature',
    signatureValue: 'Ed25519 • {{keyId}}',
    demoNote: 'DEMO data: a synthetic package signed with a published DEMO key. Not real evidence.',
    loadingPackage: 'Loading package details…',
    noPackage: 'No DEMO package exists for this item.',
    close: 'Close',
  },

  /** Recovery path (FAULT → RECOVERY → incomplete; SYS-008). */
  recovery: {
    title: 'Recovery in progress',
    incomplete: 'Session marked INCOMPLETE. It will never be sealed.',
    acknowledge: 'Acknowledge',
    stagesLabel: 'Recovery steps',
    done: 'Recovery complete',
    failed: 'Recovery could not start. Please try again.',
  },

  /**
   * N in a recording of the Core's own capture (fix wave H driver A; finding G75-01, rulings D197 /
   * D199): the panel states what the Core has and nothing else. No "encryption active" while a
   * recording runs - the media is encrypted when the session is sealed.
   */
  integrityFacts: {
    capture: {
      label: 'Capture',
      CONNECTING: 'Connecting cameras. Nothing is recorded yet',
      DURABLE: 'Recording. The first fragment is durable on the evidence volume',
      ENDED: 'The recording has ended',
      NOTHING_RECORDED: 'Nothing was recorded',
    },
    protection: {
      label: 'Media Protection',
      AT_SEAL: 'Not encrypted during recording. The media is encrypted when the session is sealed',
      SEALED: 'Encrypted at seal',
      NOTHING_RECORDED: 'No media to protect',
    },
    auditChain: {
      label: 'Audit Log Hash Chain',
    },
    time: {
      label: 'Time Source',
      value: 'Core system clock (UTC{{offset}})',
    },
    note: 'Fragment hashes and the signature are stated on the evidence item once the session is sealed.',
  },
  /**
   * Wave H driver B (gate 89, G89-11; decision D121): the ETA the finalization views draw is the
   * Core's remaining time OF THE RUNNING STEP (`finalization.steps[].etaMs`), so the line names the
   * step. "About 1 s left" stood for a whole simulated seal of eleven seconds, one short step after
   * the other.
   */
  sealingEta: {
    step: 'This step: about {{seconds}} s left',
  },
  /**
   * Wave H closing pass Z2 (driver A's lines of 10:20:55Z; decisions D203, D207): the Session
   * Monitor beside a recording of the Core's OWN capture. The banner names the capture state (its
   * detail is `integrityFacts.capture.*`), never "secure" or "integrity checks passing"; the
   * checkpoint line states the durable fragments as the Core counts them
   * (`session.captureCheckpoints`). `timeSource.hostClock`: the `time` slice of such a Core says
   * the host system clock (`isHostClockTime`).
   */
  captureFacts: {
    banner: {
      title: 'SESSION ACTIVE',
    },
    checkpoints: {
      label: 'Durable Fragments',
      fragments_one: '{{count}} fragment saved',
      fragments_other: '{{count}} fragments saved',
      lastSeconds: 'last {{seconds}} s ago',
      lastMinutes: 'last {{minutes}} min ago',
    },
    timeSource: {
      hostClock: 'Host system clock',
    },
  },
} as const satisfies ResourceTree;
