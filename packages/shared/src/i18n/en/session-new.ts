/**
 * `sessionNew.*`: Start New Session, steps Session Info → Devices Check → Ready
 * (01_specs §14.5.11; research/04 §5.7). Subject-type labels and glosses are in
 * `common.subjectType` and `common.subjectTypeGloss`.
 *
 * Step 46 (additive): the five `sessionCreateSchema` messages that were marked "(add)" in
 * `api/session-schema.ts` (D62: `info.subjectName.tooLong`, `info.room.required`,
 * `info.room.tooLong`, `info.profile.required`, `info.notes.tooLong`), plus the page's own copy
 * (preview, gate progress and reasons, countdown, error toasts). Copy that names a limit spells
 * the number out because the schema emits the bare key (no interpolation values); the numbers
 * match `SESSION_INPUT_LIMITS`.
 */
import type { ResourceTree } from '../resource-tree';

export const sessionNew = {
  title: 'START NEW SESSION',
  subtitle: 'Prepare, check and start a recorded interview.',

  steps: {
    label: 'Session setup progress',
    info: 'Session Info',
    devices: 'Devices Check',
    ready: 'Ready',
    position: 'Step {{current}} of {{total}}',
  },

  info: {
    title: 'Session Information',
    caseNumber: {
      label: 'Case Number',
      placeholder: 'LP/YYYY/MMDD-NNNN',
      scan: 'Scan case number (simulated)',
      required: 'Enter the case number.',
      invalid: 'Use the case format LP/YYYY/MMDD-NNNN.',
    },
    subjectType: {
      label: 'Subject Type',
      required: 'Choose a subject type.',
    },
    subjectName: {
      label: 'Subject Name',
      placeholder: 'Full name',
      required: 'Enter the subject name.',
      tooLong: 'Use at most 120 characters for the name.',
    },
    investigator: {
      label: 'Investigator',
      placeholder: 'Search investigators',
      required: 'Choose the investigator.',
      hint: 'Defaults to the signed-in operator.',
    },
    room: {
      label: 'Room / Location',
      required: 'Choose the room.',
      tooLong: 'Use at most 80 characters for the room.',
    },
    profile: {
      label: 'Recording Profile',
      standard: 'Standard (1080p / 25 fps)',
      required: 'Choose a recording profile.',
    },
    notes: {
      label: 'Notes (Optional)',
      placeholder: 'Context for this interview',
      tooLong: 'Keep the notes under 2,000 characters.',
      count: '{{count}} / {{max}}',
    },
  },

  /** Step 1 side column: what the session will look like, and a live readiness glance. */
  preview: {
    title: 'Session Preview',
    empty: 'Not set',
    readiness: 'Device Readiness',
    readinessHint: 'Live state of the eight pre-recording checks. The gate runs them again on the next step.',
    readyCount: '{{ready}} of {{total}} ready',
  },

  /** Step 2: the §5.3 pre-recording gate. Checks keyed by sim `PrecheckCheckId`. */
  devices: {
    title: 'Devices Check',
    intro: 'Every device is checked before recording can start.',
    checks: {
      CORE: 'Core Machine',
      LENS_1: 'Video Lens 1',
      LENS_2: 'Video Lens 2',
      MIC_1: 'MIC 1',
      MIC_2: 'MIC 2',
      // Schema v2 (SH-03): the role-keyed pair — the input that is PRIMARY / STANDBY right now.
      MIC_PRIMARY: 'MIC (primary)',
      MIC_STANDBY: 'MIC (standby)',
      STORAGE: 'Storage',
      TIME: 'Time Sync',
      SECURITY: 'Security',
    },
    resolving: 'Checking…',
    speakToTest: 'Speak to test (simulated)',
    acknowledge: 'Acknowledge warnings',
    warnBody: 'Review the warnings and acknowledge them to continue.',
    blockedTitle: 'Recording is blocked',
    blockedBody: 'Resolve these checks before continuing: {{reasons}}.',
    progress: '{{done}} of {{total}} checks complete',
    listLabel: 'Pre-recording checks',
    previews: 'Camera Previews',
    meters: 'Microphone Levels',
    retry: 'Re-run checks',
    policy: {
      title: 'Gate Policy',
      block: 'Blocks recording',
      blockList: 'Core offline, lens fault, storage full, security fault',
      warn: 'Needs acknowledgement',
      warnList: 'MIC no signal or clipping, storage low, time on RTC, enclosure tamper',
    },
    resolveHint: 'Clear the fault, then re-run the checks.',
    outcome: {
      running: 'Checking devices…',
      pass: 'All checks passed',
      warn_one: '{{count}} warning needs acknowledgement',
      warn_other: '{{count}} warnings need acknowledgement',
      acknowledged_one: '{{count}} warning acknowledged',
      acknowledged_other: '{{count}} warnings acknowledged',
      block: 'Recording is blocked',
    },
    /** Why a check warns or blocks (mapped from the check and its value, SIM-GAP-W46-2). */
    reasons: {
      coreOffline: 'Core link offline',
      lensFault: '{{device}} lens fault',
      micNoSignal: '{{device}}: no signal',
      micClip: '{{device}}: clipping',
      storageFull: 'Evidence storage full',
      storageLow: 'Evidence storage low',
      timeRtc: 'Time from the RTC (GNSS and NTP unavailable)',
      securityFault: 'Critical security fault',
      securityTamper: 'Enclosure tamper detected',
    },
  },

  ready: {
    title: 'Ready to record',
    summary: {
      caseNumber: 'Case',
      subject: 'Subject',
      investigator: 'Investigator',
      room: 'Room',
      profile: 'Profile',
      devices: 'Devices',
      allReady: 'All devices ready',
      sessionId: 'Session ID',
    },
    ringLabel: 'System ready to record',
    ringAttention: 'Ready with acknowledged warnings',
    countdown: '3-2-1 countdown',
    countdownHint: 'A short countdown gives everyone in the room a moment before recording.',
    countdownValue: 'Recording starts in {{seconds}}',
    cancelCountdown: 'Cancel countdown',
    start: 'Start Recording',
    starting: 'Starting…',
    startHint: 'Recording starts at once and is sealed when you end the session.',
    startedToast: 'Recording started · {{sessionId}}',
  },

  cancelDialog: {
    title: 'Discard this session?',
    body: 'The details you entered will be lost and the session is cancelled.',
    confirm: 'Discard session',
    keep: 'Keep editing',
  },

  /** Toasts (generic copy; simulator error text never reaches the UI, review 40 m8). */
  errors: {
    create: {
      NOT_SIGNED_IN: 'Your sign-in has expired. Sign in again to start a session.',
      NOT_PERMITTED: 'Your role cannot start sessions.',
      INVALID_INPUT: 'Some details are not valid. Check the form and try again.',
      SESSION_ACTIVE: 'A session is already active. End it before starting a new one.',
    },
    precheck: 'The device check could not start. Please try again.',
    acknowledge: 'The warnings could not be acknowledged. Please try again.',
    start: 'Recording could not start. Check the devices and try again.',
    cancel: 'The session could not be cancelled. Please try again.',
  },
  discarded: 'Session discarded.',

  creating: 'Creating session…',
  alreadyActive: 'A session is already active. End it before starting a new one.',

  /**
   * Backend task, plan row W64 (additive): Live mode only. In Live mode the Core link of the
   * pre-check is set by a real connection of a paired tablet (decision F69), so a blocked `CORE`
   * check means "no paired tablet is connected", not a fault the console can clear.
   */
  live: {
    coreLinkHint:
      'No paired device is connected to the Core server. Open the DEMS app on the paired tablet or phone so that it connects, then re-run the checks.',
    /**
     * Closing copy round (decision D164 DN-5; W83 ledger #89): one pair of Live words for both
     * clients, in place of `devices.speakToTest` and `info.caseNumber.scan`, which say "(simulated)"
     * and stay the Simulated words. The step 2 meters are the Core server's `meters` frames; the
     * case-number button fills in the next number the Core server reserves (operation 32).
     */
    speakToTest: 'Microphone levels from the Core server',
    scanCaseNumber: 'Fill in the next case number',
  },

  /**
   * Wave H closing pass Z2 (closing pass Z1's line of 10:30:00Z; ruling D203 (1)): the pre-check TIME
   * item of a Core in its own capture is a NOTE (`isPrecheckNote`): the time is the host system
   * clock. It asks nothing of the operator and is not a warning.
   */
  precheckNote: {
    chip: 'NOTE',
    timeHostClock: 'Time source: host system clock (no GNSS)',
  },
} as const satisfies ResourceTree;
