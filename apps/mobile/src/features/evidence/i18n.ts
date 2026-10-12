import type { ResourceTree } from '@/i18n/resources';
import { sealedPlayerEn } from './sealed-player-i18n';

/**
 * English copy of the `evidence` feature, mounted at `features.evidence.*` through
 * `src/i18n/features.ts` (04_mobile_specs §9). Owner: step 83 (P6). Shared terms come from
 * `@dems/shared/i18n` (`evidence.*`, `common.evidenceStatus`, `common.subjectType`, `common.tracks`)
 * and the `mobile.*` namespace; this tree holds only what the mobile Evidence screens alone say.
 * Indonesian domain terms (Tersangka, Saksi, Lainnya) never appear here: they come from the shared
 * keys through `SubjectTypeChip` (MA-21).
 */
export const evidenceEn = {
  header: {
    title: 'Evidence',
    detailTitle: 'Evidence Details',
    back: 'Back to Evidence',
    viewOptions: 'List options',
  },
  menu: {
    sortTitle: 'Sort',
    newest: 'Newest first',
    oldest: 'Oldest first',
    densityTitle: 'Density',
    comfortable: 'Comfortable',
    compact: 'Compact',
  },
  search: {
    placeholder: 'Search session ID, subject, or case number…',
    label: 'Search evidence',
  },
  filters: {
    label: 'Filter by status',
    ALL: 'All',
    RECORDED: 'Recorded',
    SEALED: 'Sealed',
    EXPORTED: 'Exported',
    UNDER_REVIEW: 'Under Review',
  },
  list: {
    label: 'Evidence items',
    count_one: '{{count}} item',
    count_other: '{{count}} items',
    empty: 'No evidence matches',
    emptyBody: 'Clear or change the filters to see more evidence.',
    clearFilters: 'Clear filters',
    rowLabel: '{{id}}, {{subject}}, {{status}}, recorded {{date}}, duration {{duration}}',
    rowActions: 'Actions for {{id}}',
    thumbnail: 'Poster of {{id}}',
  },
  /** Round two (JT-11 / JA2-08; contract J2-S 1): the markers and notes the item carries. */
  annotations: {
    title: 'Markers and notes of the session',
    marker: 'Marker {{index}}',
    markerSeek: 'Marker {{index}} at {{time}}: play from there',
    noLabel: 'no label',
    note: 'Note',
    formNote: 'Note from the session form',
  },
  /** Round two (JT-10): the transcript and the sealed player of one item know each other. */
  transcriptLink: {
    seek: 'Play from {{start}}',
    now: 'At the playhead',
    noPlayer: 'Press Play first: the recording is not open in the player.',
  },
  /** Round two (JA2-07): the item of an interrupted session that was never sealed (`sealedAt === null`). */
  neverSealed: {
    status: 'Incomplete session — not sealed',
  },
  /** Round two (JT-20): the detail pane while the selected item is not in the filtered list. */
  paneFiltered: {
    title: '{{id}} is not in this list',
    body: 'The filter or the search hides the selected item. Clear the filters to see it again, or choose a row.',
    clear: 'Clear filters',
  },
  pane: {
    emptyTitle: 'Select an evidence item',
    emptyBody: 'Its details, media and integrity appear here.',
  },
  detail: {
    notFound: 'This evidence item is not on this device.',
    notFoundBack: 'Back to the list',
    gnss: 'GNSS',
    timeSource: 'Time source {{source}}',
    locationValue: '{{room}}',
    sealedHero: 'Poster of {{id}}',
  },
  media: {
    title: 'Tracks',
    playTrack: 'Play {{track}}',
    audioTitle: 'Audio tracks',
    audioHint: 'MIC 1 and MIC 2 are separate tracks and are never mixed.',
    duration: '{{duration}}',
    noMedia: 'No DEMO media for this item on this device.',
    excerptNote: 'DEMO excerpt of {{clip}} s, repeated over the recorded {{duration}}.',
    // Live mode (backend task W74; 01_specs MS-2): the Core says which bundled media belongs to an item.
    checking: 'Asking the Core which media belongs to this item…',
    unavailable: 'The Core did not say which media belongs to this item, so no bundled media is shown.',
  },
  metadata: {
    manifestTitle: 'Manifest',
    jsonTitle: 'manifest.json (DEMO)',
    notAvailable: 'No DEMO package for this item: the manifest is not on this device.',
    fields: {
      sessionId: 'Session ID',
      device: 'Device',
      operator: 'Operator',
      subject: 'Subject',
      caseReference: 'Case reference',
      timestamps: 'Start / stop',
      timeSource: 'Time source',
      cameras: 'Cameras',
      microphones: 'Microphones',
      tracks: 'Track hashes',
      encryption: 'Encryption',
      signature: 'Signature',
      finalizationStatus: 'Finalization',
    },
    tracksValue_one: '{{count}} SHA-256',
    tracksValue_other: '{{count}} SHA-256',
    certShort: 'cert {{serial}}',
    encryptionDemo: 'DEMO: not applied',
    exportTitle: 'Export package',
    exportId: 'Export ID',
    exportZip: 'Package SHA-256 ({{file}})',
    exportBy: 'Exported by',
    exportReason: 'Reason',
    // Wave H C2 (G94-14 / G81-10): the Metadata tab of a recording of this Core names no DEMO package.
    coreRecordOnly: 'The Core server\u2019s record of this item.',
  },
  custodyAction: {
    RECORDING_STARTED: 'Recording started',
    RECORDING_STOPPED: 'Recording stopped',
    SESSION_INCOMPLETE: 'Session incomplete',
    SEALED: 'Sealed',
    REVIEW_OPENED: 'Review opened',
    EXPORTED: 'Exported',
    ARCHIVED: 'Archived',
    VERIFIED: 'Verified by the Core',
    VERIFY_FAILED: 'Verification failed',
  },
  integrity: {
    verifiedByCore: 'Verified by the Core',
    verifiedByCoreNote: 'Integrity is checked on the Core against the sealed package; this device shows the Core’s result.',
    demoLabel: 'DEMO - precomputed',
    simulatedLabel: 'SIMULATED',
    notVerified: 'Not verified on this screen yet',
    verify: 'Verify',
    verifyAgain: 'Verify again',
    verifying: 'Asking the Core…',
    resultPass: 'PASS: every hash matches the sealed manifest',
    resultFail: 'FAIL: {{checks}} does not match the sealed manifest',
    trackTitle: 'Per-track SHA-256',
    expected: 'Sealed',
    actual: 'Stored',
    manifestHash: 'Manifest SHA-256',
    signature: 'Signature (Ed25519, DEMO key)',
    signatureSimulated: 'Signature (simulated)',
    keyId: 'Key',
    certificate: 'Device certificate (DEMO)',
    certificateSha: 'Certificate SHA-256',
    auditChain: 'Audit extract',
    auditChainValue: '{{rows}} rows, seq {{first}}–{{last}}',
    checks: {
      manifest: 'Manifest',
      signature: 'Signature',
      certificate: 'Certificate',
      auditChain: 'Audit chain',
      exportPackage: 'Export package',
      exportSignature: 'Export signature',
    },
    noPackage: 'No DEMO package for this item. The values below are the simulator’s own, labelled SIMULATED.',
    lifecycle: 'Evidence lifecycle',
    custody: 'Chain of custody',
    custodyEmpty: 'No custody entries yet.',
    custodyRow: '{{time}} · {{action}} · {{actor}}',
    system: 'System',
    copied: 'Copied',
    passToast: 'Evidence {{id}} verified by the Core',
    failToast: 'Integrity check FAILED for {{id}}',
    verifyError: 'The Core could not verify this item. Try again.',
    // Live mode (backend task W74; 04_client_integration_spec §14 point 7): the Core's verdict is the record.
    coreLabel: 'Core record',
    coreNote: 'The Core runs the verification and returns the verdict of record; this device shows it as it is.',
    // Closing-fix CF-M2 (R-T-2): the Live card's heading follows the verification the Core holds.
    failedOnCore: 'Verification failed on the Core',
    notVerifiedYet: 'Not verified yet',
    coreNotRun: 'The Core holds no verification of this item yet. Verify asks the Core now.',
    bundledResult: 'Bundled demo package: {{verdict}} ({{label}})',
    bundledDiffers: 'The bundled demo package differs from the Core’s record. The Core’s verdict is the record.',
  },
  actions: {
    play: 'Play',
    export: 'Export',
    more: 'More',
    view: 'View',
    verify: 'Verify',
    archive: 'Archive',
    downloadManifest: 'Download manifest',
    manifestToast: 'Manifest download is simulated in this demo',
    manifestToastLive: 'Manifest download is not available on this device.',
    exportDisabled: 'Only sealed evidence can be exported',
    archiveDisabled: 'Archiving needs the Supervisor role',
    archiveTitle: 'Archive {{id}}?',
    archiveBody: 'The item moves to retention. This is recorded in the audit log.',
    archiveConfirm: 'Archive',
    archiveCancel: 'Cancel',
    archived: 'Evidence {{id}} archived',
    actionFailed: 'That action could not be completed. Try again.',
  },
  play: {
    title: 'Evidence player',
    simulated: 'Simulated playback',
    bundled: 'Bundled demo package',
    excerpt: 'DEMO excerpt',
    camera: 'Camera',
    cameraShort: 'CAM {{index}}',
    audio: 'Listen to',
    mic1: 'MIC 1',
    mic2: 'MIC 2',
    micHint: 'One microphone track at a time; the tracks are never mixed.',
    play: 'Play',
    pause: 'Pause',
    position: '{{position}} / {{total}}',
    scrubber: 'Playback position',
    close: 'Close player',
    noMedia: 'No DEMO media for this item on this device.',
    error: 'Playback failed. The Core copy is unaffected.',
  },
  /** The sealed player's own words (`sealed-player-i18n.ts`), read as `features.evidence.player.*`. */
  player: sealedPlayerEn,
  /**
   * Fix wave L (G89c-04; ruling D229 (3)): the format the SIGNED manifest states per camera file, and the
   * session's notice when the recorded stream was not the configured profile. The codes are the manifest's.
   */
  sealedFormat: {
    title: 'Sealed format (signed manifest)',
    track: '{{track}}: {{profile}}',
    noticeTitle: 'The recorded stream was not the configured profile',
    noticeTrack: '{{track}}: recorded {{stream}}, configured {{configured}}',
  },
  export: {
    title: 'Export {{id}}',
    close: 'Close export',
    steps: {
      authorize: 'Authorize',
      verify: 'Verify source',
      // A soft hyphen: the six-step wizard label wraps as "Desti-nation" on a phone.
      destination: 'Desti\u00ADnation',
      reason: 'Reason',
      build: 'Build and hash',
      done: 'Done',
    },
    authorizing: 'Checking your role on the Core…',
    authorizedAs: 'Authorized as {{name}} ({{role}})',
    deniedTitle: 'Your role cannot export',
    deniedBody: 'Exporting evidence requires the Supervisor role. This attempt was recorded in the audit log.',
    deniedBodyUnrecorded: 'Exporting evidence requires the Supervisor role. The Core could not be reached, so this attempt was not recorded.',
    sourcePass: 'Source verified by the Core: PASS',
    sourceFail: 'Source failed verification ({{checks}}). Export is blocked.',
    sourceSimulated: 'No DEMO package: the simulator’s own record is used.',
    destinationLabel: 'Destination',
    reasonLabel: 'Reason for export',
    reasonPlaceholder: 'Why is this evidence being exported?',
    reasonTooShort: 'Enter a reason of at least {{min}} characters.',
    reasonCount: '{{count}} / {{max}}',
    building: 'Building the package on the Core…',
    exportId: 'Export ID',
    manifestSha: 'Session manifest SHA-256',
    zipSha: 'Package SHA-256 ({{file}})',
    zipNote: 'Package built on the Core (simulated); its hash is recorded in the export manifest.',
    zipNoteLive: 'The Core recorded this export. No file is sent to this device.',
    // The LIVE success toast is the shared `evidence.live.export.success`: row W74's own `successLive` was
    // merged into it in the closing copy round (decision D162 DN-5, W83 ledger #93).
    destinationValue: 'Destination',
    reasonValue: 'Reason',
    doneTitle: 'Export accepted',
    doneBody: '{{id}} is now EXPORTED. The export event is in the audit log.',
    next: 'Next',
    back: 'Back',
    submit: 'Export',
    finish: 'Done',
    failed: {
      NOT_SIGNED_IN: 'Sign in again to export.',
      FORBIDDEN: 'Your role cannot export evidence.',
      NOT_FOUND: 'This evidence item no longer exists.',
      NOT_SEALED: 'Only sealed evidence can be exported.',
      SECURITY_FAULT: 'A security fault on the Core blocks export.',
      INVALID_REASON: 'Enter a reason of at least 5 characters.',
      UNKNOWN: 'The export could not be completed. Try again.',
    },
  },
  /**
   * Fix wave K, driver M2 (gate findings of re-gates 75 / 81 / 89 / 94). The sentences live here
   * because `packages/shared` is closed to this driver in the wave; each states what the Core knows.
   */
  waveK: {
    transcript: {
      /** G81b-07: a refusal with `details.reason: EVIDENCE_CASE_SCOPE` is about the case, never the role. */
      deniedCaseScope: 'You are not assigned to the case of this item, so its transcript is not shown.',
      /** G81b-09: the label of a revision's reason in the revision list. */
      revisionReason: 'Reason',
      /** G81b-06: which model made the transcript (the item's `transcriptModel`). */
      model: {
        title: 'Transcript model',
        name: 'Name: {{name}}',
        version: 'Version (declared by the installation): {{version}}',
        quantisation: 'Quantisation: {{quantisation}}',
        hash: 'Model file SHA-256: {{hash}}',
        notStated: 'not stated',
      },
    },
    export: {
      /** D223 (1): stated before anything is sent. */
      requiresRole: 'Exporting evidence requires the {{role}} role.',
      nothingSent: 'Nothing has been sent to the Core server.',
      requestNote: 'A request sent with your role is refused by the Core server and recorded in the audit log.',
      request: 'Request authorization',
      /** The disabled Export control of the item (operation 40 `access.export: false`). */
      controlRequiresRole: 'Export requires the {{role}} role.',
      /** G94b-06: an export the Core only recorded (`archiveOnCore: false`, or a finished job that states no archive). */
      noArchive: 'Demonstration: no archive is written.',
      archiveNotStated: 'The Core server states no archive for this export.',
    },
  },
} as const satisfies ResourceTree;
