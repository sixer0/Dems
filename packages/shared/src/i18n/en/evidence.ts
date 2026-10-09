/**
 * `evidence.*`: Evidence list and detail, export wizard (01_specs §14.5.3; research/04 §5.1).
 * Status labels are in `common.evidenceStatus`.
 *
 * Step 47 extended this namespace additively (every step-34 key and value is kept, because the
 * mobile Evidence screens reuse the web namespaces): real DEMO integrity verification (D50, D67),
 * the DEMO media excerpt labels, the §19.3 export wizard steps and the package views.
 */
import type { ResourceTree } from '../resource-tree';

export const evidence = {
  title: 'EVIDENCE',
  subtitle: 'Recorded, sealed and exported interview evidence',
  banner: '{{sealed}} sealed today • {{pending}} pending',

  kpi: {
    label: 'Evidence summary',
    total: 'Total',
    sealed: 'Sealed',
    recorded: 'Recorded',
    exported: 'Exported',
    pending: 'Pending',
  },

  toolbar: {
    search: 'Search session, case, or subject...',
    searchLabel: 'Search evidence by ID, case number or subject',
    status: 'Status',
    all: 'All',
    caseType: 'Case Type',
    caseTypePlaceholder: 'Select Case Type',
    subjectType: 'Subject type',
    subjectTypePlaceholder: 'Subject type',
    allSubjectTypes: 'All subject types',
    investigator: 'Investigator',
    investigatorPlaceholder: 'Select Investigator',
    allInvestigators: 'All investigators',
    dateRange: 'Date range',
    dateFrom: 'Recorded from',
    dateTo: 'Recorded to',
  },

  table: {
    label: 'Evidence items',
    columns: {
      thumbnail: 'Preview',
      evidenceId: 'Evidence ID',
      recorded: 'Recorded',
      subject: 'Subject',
      caseNumber: 'Case Number',
      investigator: 'Investigator',
      duration: 'Duration',
      size: 'Size',
      status: 'Status',
      actions: 'Actions',
    },
    sortColumns: {
      evidence: 'Evidence ID · Recorded',
      subject: 'Subject',
      case: 'Case · Investigator',
      duration: 'Duration · Size',
      status: 'Status',
    },
    selectAll: 'Select all rows',
    selectRow: 'Select {{id}}',
    rowActions: {
      label: 'Actions for {{id}}',
      view: 'View',
      verify: 'Verify',
      export: 'Export',
      archive: 'Archive',
    },
    bulkExport_one: 'Export {{count}} item',
    bulkExport_other: 'Export {{count}} items',
    selected_one: '{{count}} item selected',
    selected_other: '{{count}} items selected',
    clearSelection: 'Clear selection',
    empty: {
      title: 'No evidence matches these filters',
      body: 'Clear or change the filters to see more evidence.',
    },
    pagination: 'Page {{page}} of {{pages}}',
    paginationLabel: 'Evidence pages',
    range: '{{first}}–{{last}} of {{total}}',
    pageLabel: 'Page {{page}}',
    previousPage: 'Previous page',
    nextPage: 'Next page',
  },

  preview: {
    title: 'Preview',
    empty: 'Select a row to preview it.',
    open: 'Open details',
    posterAlt: 'Camera 1 still of {{id}}',
    lastVerification: 'Last verification',
    packageLine: 'DEMO package · manifest digest {{digest}}',
    noPackage: 'No DEMO package for this item: simulated data only.',
  },

  demo: {
    chip: 'DEMO',
    package: 'DEMO package',
  },

  detail: {
    title: 'EVIDENCE DETAILS',
    back: 'Back to Evidence',
    notFound: 'Evidence {{id}} was not found.',
    timeRange: '{{start}} – {{end}}',
    tabsLabel: 'Evidence details',
    idCopied: 'Evidence ID copied',
    manifestDownloaded: 'Manifest downloaded (DEMO)',
    manifestDownloadFailed: 'The manifest could not be downloaded. Please try again.',
    fields: {
      caseNumber: 'Case Number',
      subject: 'Subject',
      investigator: 'Investigator',
      location: 'Location',
      duration: 'Duration',
      fileSize: 'File Size',
      status: 'Status',
      session: 'Session',
    },
    tabs: {
      media: 'Media',
      metadata: 'Metadata',
      integrity: 'Hash & Integrity',
    },
    media: {
      tracks: 'Tracks',
      playerTitle: 'Evidence player',
      markers: 'Session markers',
    },
    metadata: {
      manifest: 'Manifest',
      notes: 'Session notes',
      markers: 'Markers',
      json: 'Raw manifest (JSON)',
    },
    integrity: {
      trackHash: '{{track}} SHA-256',
      manifestHash: 'Manifest hash',
      signature: 'Manifest signature (simulated)',
      signatureNote: 'A simulated signature for this demo, not a real cryptographic signature.',
      copyHash: 'Copy hash',
      hashCopied: 'Hash copied',
      verify: 'Verify',
      verifying: 'Verifying…',
      pass: 'PASS',
      fail: 'FAIL',
      failDetail: 'Integrity check failed at entry #{{index}}.',
      lifecycle: 'Evidence lifecycle',
      custody: 'Chain of custody',
      custodyColumns: {
        time: 'Time',
        action: 'Action',
        actor: 'Actor',
        detail: 'Detail',
      },
    },
    actions: {
      play: 'Play',
      export: 'Export',
      more: 'More',
      archive: 'Archive',
      copyId: 'Copy ID',
      downloadManifest: 'Download manifest',
    },
  },

  media: {
    camera: 'Camera',
    audio: 'Audio track',
    play: 'Play',
    pause: 'Pause',
    scrub: 'Position in the recording',
    videoLabel: 'Video of {{track}}',
    excerptChip: 'DEMO excerpt',
    excerptNote: 'DEMO excerpt: each track is a {{excerpt}} clip that repeats across the {{total}} recording.',
    excerptLength: '{{length}} excerpt',
    noMedia: 'No DEMO media',
    noMediaBody: 'This item has no DEMO package, so there is nothing to play. Its record comes from the simulator.',
  },

  metadata: {
    manifestTitle: 'Manifest fields (design book §11.3)',
    packageTitle: 'Package contents · {{folder}}',
    kb: '{{value}} KB',
    stopReason: 'Reason for ending',
    noStopReason: 'No reason recorded (session incomplete)',
    noMarkers: 'Stored evidence keeps no session markers in this demo.',
    document: 'Document',
    documents: {
      manifest: 'manifest.json',
      metadata: 'metadata.json',
      signature: 'signature.sig',
      audit: 'audit extract',
    },
    loadingAudit: 'Loading the audit extract…',
    auditError: 'The audit extract could not be loaded.',
    exactBytes: 'Shown exactly as stored: hashing manifest.json gives the signed digest.',
    noPackage: 'No DEMO package for this item',
    simulatedRecord: 'Simulated evidence record',
    /**
     * E-fix FX-W (E2E-W1-4), Live mode only (ruling of row FX-W2): the joined DEMO package is another
     * record than the Core server's (its evidence ID, session or case number differ), so its documents
     * are not that record's metadata. `record` is the record's label ("Core record").
     */
    foreign: {
      title: 'The bundled DEMO package is another record',
      body: 'This item plays the demo media of the bundled package {{id}} (session {{session}}, recorded {{date}}). Its documents describe that package, not this item. This item\'s metadata is the {{record}}.',
      recordTitle: 'Record of this item',
      packageTitle: 'Bundled DEMO package · {{id}}',
    },
  },

  verify: {
    running: 'Verifying',
    error: 'Not verified',
    again: 'Verify again',
    found: 'Found',
    sealed: 'Sealed',
    progress: '{{done}} of {{total}} checks',
    packageMode: 'Re-verified in this browser from the DEMO package',
    simulatedMode: 'Simulated verification (no DEMO package)',
    trustNote: 'Hashes are recomputed with SHA-256; the Ed25519 signature and the DEMO certificate are checked with WebCrypto.',
    simulatedNote: 'The simulator compares its own synthetic hashes. Not a cryptographic check.',
    retryExhausted: 'Reload to retry',
    /**
     * E-fix FX-W (E2E-W1-3): the record's last verification (the Core server's in Live mode), shown when
     * the tab opens and kept current after every run. `at` carries its zone.
     */
    last: {
      full: 'Last verification {{result}} · {{at}} · {{actor}}',
      noActor: 'Last verification {{result}} · {{at}}',
      resultOnly: 'Last verification {{result}}',
    },
    /** Instead of "0 of 6 checks" while the card shows the stored verdict: the per-check list is a run's. */
    storedHint: 'Verify again to see each check.',
    toastPass: 'Integrity verified: {{id}} PASS',
    toastFail: 'Integrity FAILED for {{id}}: {{checks}}',
    errorToast: 'Verification could not run. Please try again.',
    phase: {
      pending: 'Pending',
      running: 'Checking',
      pass: 'PASS',
      fail: 'FAIL',
    },
    checks: {
      track: '{{id}} · {{track}} SHA-256',
      manifest: 'Manifest digest',
      signature: 'Ed25519 signature',
      certificate: 'Device certificate (DEMO)',
      auditChain: 'Audit chain extract',
      exportPackage: 'Export package hash',
      exportSignature: 'Export manifest signature',
    },
  },

  /**
   * Verify v2 (blueprint row 87; evidence package spec §D, §F.3; row 119's transcript states): the
   * Core server's result for a schema-v2 item, on the web console and the mobile app. The check
   * names are V-01 to V-14 of the spec; the transcript-state lines are the fixed lines of
   * `TRANSCRIPT_STATE_REPORT` (`@dems/shared/evidence-verify`), held equal by a test.
   */
  verifyV2: {
    waiting: 'Waiting for the verdict of the Core server…',
    resultTitle: 'Result of this run',
    file: '{{track}} file',
    fileParts: 'Stored bytes {{stored}} · decrypted bytes {{plain}} · fragment chain {{chain}}',
    fragments_one: '{{count}} fragment',
    fragments_other: '{{count}} fragments',
    rows: {
      transcript: 'Transcript hash',
      manifest: 'Manifest and package',
      signature: 'Signature and certificate',
    },
    outcome: {
      PASS: 'PASS',
      FAIL: 'FAIL',
      SKIPPED: 'Not run',
    },
    skipped: {
      BLOCKED: 'Not run: an earlier check failed',
      KEY_UNAVAILABLE: 'Not run: no session key',
    },
    failureClass: {
      TAMPERED: 'Tampered',
      CORRUPT: 'Corrupt',
      MISSING: 'Missing',
      UNREADABLE: 'Unreadable',
    },
    fragment: {
      title: 'Where it failed',
      tampered: '{{track}} fragment {{seq}} tampered (stored-bytes hash mismatch; chain broken from fragment {{from}})',
      tamperedNoChain: '{{track}} fragment {{seq}} tampered (stored-bytes hash mismatch)',
      tamperedOther: '{{track}} fragment {{seq}} tampered',
      failed: '{{track}} fragment {{seq}} did not verify ({{reason}})',
      chainOnly: '{{track}}: fragment chain broken from fragment {{from}}',
      notNamed: 'This answer does not name the fragment. The chain of custody entry of this run names it.',
    },
    checksTitle: 'Checks of this run',
    checksSummary: '{{passed}} of {{total}} checks passed',
    checks: {
      'V-01': 'Manifest structure',
      'V-02': 'Manifest internal consistency',
      'V-03': 'Manifest hash',
      'V-04': 'Per-fragment stored-bytes hash',
      'V-05': 'Plaintext hash after decryption',
      'V-06': 'Chain-hash continuity',
      'V-07': 'Sequence contiguity',
      'V-08': 'One-fragment tamper expectation',
      'V-09': 'Signature verification',
      'V-10': 'Transcript hash match',
      'V-11': 'Revision signatures',
      'V-12': 'Interrupted-seal flag',
      'V-13': 'Certificate validity',
      'V-14': 'File completeness',
    },
    transcriptState: {
      READY: 'Transcript sealed',
      PARTIAL: 'Transcript partial',
      PARTIAL_BACKEND_UNREACHABLE: 'Transcript partial — backend unreachable',
      DISABLED_BY_CONFIGURATION: 'Transcript disabled by configuration',
      UNAVAILABLE_AT_SEAL: 'Transcript unavailable at seal',
      NOT_TRUSTWORTHY: 'Transcript state: not trustworthy — the manifest was altered',
      UNKNOWN: 'Transcript state: unknown — the manifest cannot be read',
    },
    interrupted: 'Interrupted recording: the durable part is sealed and was verified.',
  },

  integrity: {
    sealedValues: 'Sealed values',
    signatureDemo: 'Manifest signature (Ed25519, DEMO key {{key}})',
    signatureNoteDemo: 'Signed {{at}} with the published DEMO key. It demonstrates the mechanism and proves nothing about real evidence.',
    certificate: 'Device certificate (DEMO, self-signed)',
    certificateMeta: 'serial {{serial}} · SHA-256 {{fingerprint}} · valid until {{until}}',
    auditExtract: 'Audit extract',
    auditMeta: '{{rows}} rows · seq {{first}}–{{last}} · head {{head}}',
    system: 'System',
    copyFailed: 'Copy failed. Select the text instead.',
  },

  archive: {
    success: '{{id}} archived',
    denied: 'Archiving requires the Supervisor role.',
    notSealed: 'Only sealed evidence can be archived.',
    failed: 'The evidence could not be archived. Please try again.',
  },

  exportWizard: {
    title: 'Export evidence',
    steps: {
      reason: 'Reason',
      destination: 'Destination',
      confirm: 'Confirm',
      authorise: 'Authorise',
      verify: 'Verify source',
      export: 'Export',
    },
    itemCount_one: '{{count}} item',
    itemCount_other: '{{count}} items',
    reasonLead: 'Why is {{id}} being exported? The reason is written to the audit trail.',
    reasonLabel: 'Export reason',
    reasonPlaceholder: 'Why is this evidence being exported?',
    reasonHint: 'Required, at least {{min}} characters.',
    reasonTooShort: 'Enter a reason of at least {{min}} characters.',
    destinationLabel: 'Destination',
    destinationUsb: 'Encrypted USB drive (simulated)',
    destinationNetwork: 'Export/Transfer network (simulated)',
    destinations: {
      CASE_FILE: 'Case file transfer (simulated)',
      USB: 'Encrypted USB drive (simulated)',
      NETWORK: 'Export/Transfer network (simulated)',
    },
    requiredPermission: 'Export requires EVIDENCE_EXPORT (Supervisor)',
    requestAuthorisation: 'Request authorisation',
    authoriseHint: 'Authorisation is checked against your role. Every attempt is recorded in the audit log.',
    authorised: 'Authorised',
    verifyLead: 'The sealed source is verified before export (design book §19.3).',
    blockedTitle: 'Export blocked',
    blockedBody: 'Source verification failed for {{ids}}. Tampered evidence cannot be exported.',
    summary: 'Export {{id}} to {{destination}}',
    custodyNote: 'Exporting writes a chain-of-custody entry and an audit event. The sealed source is not modified.',
    submit: 'Export',
    exporting: 'Exporting…',
    success: 'Export of {{id}} accepted (simulated)',
    successToast: 'Export of {{id}} recorded in the chain of custody',
    partialToast: '{{ok}} of {{total}} exports accepted',
    accepted: 'Accepted · {{exportId}}',
    auditRecorded: 'Audit event {{audit}} · hash {{hash}}',
    zipLabel: 'DEMO prebuilt export package {{exportId}} · {{size}}',
    manifestLabel: 'DEMO export manifest (JSON). No archive exists for this item.',
    zipHashOk: 'SHA-256 matches export-manifest.json · {{hash}}',
    zipHashBad: 'SHA-256 does not match the export manifest. Download blocked.',
    downloadAgain: 'Download again',
    downloadError: 'The download could not be prepared. Please try again.',
    failure: {
      NOT_SIGNED_IN: 'You are signed out. Sign in again to export.',
      FORBIDDEN: 'Your role may not export evidence.',
      NOT_FOUND: 'This evidence no longer exists.',
      NOT_SEALED: 'Only sealed evidence can be exported.',
      SECURITY_FAULT: 'Export is blocked while a security fault is active.',
      INVALID_REASON: 'The export reason is too short.',
    },
    deniedTitle: 'Export not permitted',
    deniedBody: 'Exporting evidence requires the {{role}} role. This attempt was recorded in the audit log.',
  },

  loading: 'Loading evidence…',

  /**
   * Backend task, plan row W69: the words of the page in Live mode (04_client_integration_spec
   * §8.2 A5, A6; §14 point 7; §3.2: a screen that shows server data never says "simulated").
   */
  live: {
    /** An item's values as the Core server holds them (no bundled demo package belongs to it). */
    coreRecord: 'Core record',
    /** The preview card's package line for an item without a bundled demo package (plan row W0, item 9; decision D158). */
    noPackage: "No DEMO package for this item: the Core server's record only.",
    /** Operation 40 did not answer: whether a bundled package belongs to the item is unknown, so none is shown. */
    mediaUnavailable: 'Media reference unavailable',
    verify: {
      mode: 'Verdict of the Core server',
      note: "The Core server's verdict is the record: it is written to the audit trail and to the chain of custody.",
      sourceCaption: 'Verified by the Core server',
      bundledTitle: 'Bundled demo package',
      bundledNote: 'Recomputed in this browser for display only. It writes nothing and is not the record.',
      bundledRunning: 'Checking the bundled demo package…',
      bundledError: 'The bundled demo package could not be checked.',
      differsTitle: 'Two results',
      differs: "The bundled demo package differs from the Core's record. The Core's verdict is the record.",
    },
    export: {
      reasonRefused: 'The Core server did not accept this reason. Change it and try again.',
      notCompleted: 'The Core server could not complete this export.',
      /**
       * The Live twin of `exportWizard.success`, which says "(simulated)" (closing copy round, decision
       * D162 DN-5, W83 ledger #93; first written as the mobile app's own key in row W74). The
       * destination labels keep "(simulated)" in both modes (D158 DC-4).
       */
      success: 'Export of {{id}} accepted by the Core',
    },
  },
} as const satisfies ResourceTree;
