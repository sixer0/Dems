/**
 * Sentences of the WEB CONSOLE ONLY (fix wave I, driver B; findings G75b-02, -06, -07, G70b-02, -05).
 *
 * The shared resources (`@dems/shared/i18n`) were closed to this driver in wave I, so the sentences
 * these fixes need live here, under the one namespace `web`, and are merged over the shared tree by
 * `i18n.ts` (`mergeResources(en, enWeb)` - the pattern the mobile app uses for its `mobile` tree).
 * Nothing of the shared tree is overridden: `web` is a new top-level key.
 *
 * Wording rule (fix brief): a sentence states what the Core knows. Nothing here says simulated,
 * verified, encrypted, GNSS, live or complete.
 */
import type { ResourceTree } from '@dems/shared/i18n'

export const enWeb = {
  web: {
    /** G75b-07: the header pill names the critical fault; the integrity sentence stays in the shared tree. */
    securePill: {
      criticalKind: 'Critical fault: {{kind}}',
      criticalCount_one: '{{count}} critical fault',
      criticalCount_other: '{{count}} critical faults',
      /** G75b-06: checklist rows of a Core in its own capture. */
      checkStatus: {
        NOT_REPORTED: 'Not reported',
        HOST_CLOCK: 'Host system clock',
      },
    },
    /**
     * G75b-06: the chips of a Core in its own capture (`time.hostClock`). The time is the host
     * system clock; a TPM / Secure Boot state is not reported by such a Core.
     */
    ownCore: {
      time: {
        label: 'Time',
        value: 'Host system clock',
        chip: 'HOST CLOCK',
        tooltip: 'Time source: the host system clock of this Core. No GNSS receiver and no network time service are configured. No offset is measured.',
        bannerDetail: 'Host system clock · no time service configured · {{ip}}',
        notConfigured: 'Not configured',
        notMeasured: 'Not measured',
        hierarchyNotice: 'This Core takes its time from the host system clock. GNSS, network time and a hardware clock are not configured, so no lock, stratum, offset or last synchronisation exists.',
        offsetEmpty: 'No offset is measured: this Core has no time service to compare its clock with.',
        chain: 'Host system clock → recording timestamps',
      },
      /** Closing pass J: the Storage page's session size beside a session whose checkpoints state no durable bytes yet. */
      sessionSizeNotStated: 'No durable recording data yet',
      platform: {
        chip: 'NOT REPORTED',
        tpm: 'TPM: not reported',
        secureBoot: 'Secure Boot: not reported',
        tooltip: 'This Core does not report a TPM or a Secure Boot state.',
      },
    },
    /**
     * G75b-02: a seal that is blocked or retried, on the session surfaces. The reason, the detail and
     * "The recording is kept on the Core." are the Core's own sentences (`sealAttentionOf`,
     * `SEAL_BLOCKED_DETAIL_SENTENCE`, `SEAL_RECORDING_KEPT_SENTENCE` of `@dems/shared/sim`); only the
     * headline, the operator's next step and the note on closing are worded here.
     */
    sealBlocked: {
      title: 'Sealing is blocked',
      bannerTitle: 'SEALING BLOCKED',
      rowState: 'Sealing blocked',
      stoppedAt: 'Stopped at step: {{step}}',
      action: 'What you can do: tell the administrator of this Core. No new session can be recorded until this one is sealed.',
      closeNote: 'You can close this window. The session stays open on the Core.',
      retryTitle: 'Sealing is being retried',
      retryBannerTitle: 'SEALING RETRIED',
      retryRowState: 'Sealing is being retried',
      retryNoSentence: 'A sealing step failed. The Core runs the seal again by itself.',
    },
    /**
     * G70b-02 / G70b-05: the connect dialog, as ruled in `delegation_progress/contract_wave_i_a2.md`
     * sections 1 and 2 (the sentences are driver A2's, word for word).
     */
    connect: {
      developmentHint: 'A development source can be tested without a password. If the test asks for one, turn on "Enter a user name and password".',
      noCredentialSent: 'This camera asks for a user name and a password. None was sent.',
      noCredentialNext: 'Turn on "Enter a user name and password", type them, then test again.',
    },
    /**
     * G70b-06: the state of a source on a Core in real capture (`contract_wave_i_a2.md` section 4).
     * "Reachable" / "Not reachable" are the shared words (`common.developmentRoster.*`).
     */
    source: {
      notChecked: 'Not checked',
      /**
       * Task 4 row W6 (request lines 566, 569; decisions C141, C143): the Core states `streamState: null` -
       * nobody reads the camera's stream now (an idle registered camera). Never "Live", "Lost" or "Online".
       */
      streamNotRead: 'Stream not read',
      /** Task 4 row W4 (review 060c R-03): the stored stream statement of a track on the "No preview" tile of a Core in real capture. */
      format: 'Format: {{format}}',
    },
    /**
     * Fix wave K, driver W (C-2 / G75c-04, ruling D222 (1)): a Core in its OWN capture
     * (`security.platformNotReported` or `time.hostClock`). The simulator's device model is not a
     * reading there: a surface shows the Core's own fact or "Not reported".
     */
    realCore: {
      developmentKey: 'The Core says this is a DEVELOPMENT key - not a production signature.',
      controls: {
        summary: '{{ok}} of {{total}} active · {{notReported}} not reported',
        bannerSummary: '{{ok}} of {{total}} controls active, {{notReported}} not reported',
        signingKey: '{{algorithm}}, Core key {{keyId}} - the key the sealed items of this Core are signed with.',
        noSigningKey: 'No sealed item of this Core names a signing key yet.',
        hostClock: 'Host system clock. No time service is configured: nothing is locked and nothing is in holdover.',
        notRead: {
          ENCRYPTION: 'This Core reports no encryption status here. Each sealed item states how it is encrypted.',
          TAMPER: 'This Core has no enclosure switch to read.',
          SIGNED_FIRMWARE: 'This Core reports no firmware signature.',
        },
      },
      devices: {
        gnssNotConfigured: 'No GNSS receiver is configured. The time is the host system clock.',
        lcdRemaining: 'REMAINING TIME NOT REPORTED',
        lcdPlatform: 'TPM NOT REPORTED · SECURE BOOT NOT REPORTED',
        camerasSubtitle: 'The camera sources of the two video tracks',
      },
      networkTime: {
        avSync: 'This Core reports no A/V sync figure here. Source metadata: host system clock. A capture that nears its A/V bound raises a capture notice.',
      },
      dashboard: {
        securityHeader: 'Platform security: not reported',
        ringFlags: 'OPERATIONAL • NO FAULT REPORTED',
        notReportedChip: 'NOT REPORTED',
      },
      storage: {
        bannerFree: '{{free}} free',
        writeSpeed: 'This Core does not measure a write speed.',
        estRemaining: 'No estimate: this Core does not measure a write speed to compute one from.',
      },
      keys: {
        developmentChip: 'DEVELOPMENT KEY',
        signedWith: 'The key the sealed items of this Core are signed with (newest: {{evidenceId}}).',
        note: 'As this Core reports them. It reports no device certificate, no TLS certificate and no hardware root key.',
        notReported: {
          DEVICE_CERT: 'This Core reports no device certificate.',
          EVIDENCE_SIGNING_KEY: 'No sealed item of this Core names a signing key yet.',
          TLS_SERVER: 'This Core reports no TLS server certificate.',
          HARDWARE_ROOT: 'This Core reports no hardware root key. It does not read a TPM.',
        },
      },
    },
    /** Fix wave K, driver W (ruling D222 (2)): the profile of a session whose recorded stream is not the configured one. */
    profile: {
      configuredLabel: 'Configured profile',
    },
    /** Fix wave K, driver W (G75c-10): an interrupted recording WHILE its seal still runs - nothing is sealed yet. */
    interrupted: {
      sealingTitle: 'The recording was interrupted',
      sealingKept: 'The Core is sealing the recording up to the interruption.',
    },
    /** Fix wave K, driver W (G81b-06, G81b-09): the transcript pane of an evidence item. */
    transcript: {
      model: {
        title: 'Transcript model',
        name: 'Model',
        version: 'Version (declared by the installation)',
        quantisation: 'Quantisation',
        hash: 'Model file SHA-256',
      },
      reason: 'Reason: {{reason}}',
      reasonNotReported: 'Reason: not reported',
    },
    /**
     * Fix wave K, Z2 (G94b-06): what an export job says about its archive, from `archiveOnCore` of the 202 of
     * operation 42. "Stored on the Core" stays the shared sentence (`evidence.exportJob.onCore`).
     */
    exportJob: {
      noArchive: 'Demonstration: no archive is written.',
      archiveNotStated: 'The Core server states no archive for this export.',
    },
    /** Fix wave K, driver W (G89b-05): the "Evidence sealed" dialog of a REAL item. */
    sealDialog: {
      developmentSources: 'Recorded from development sources - not from production devices.',
    },
    /**
     * Fix wave K, driver W (G94b-02, -09): the sealed player. "This recording failed its integrity
     * check at {{file}} fragment {{seq}}." is the shared sentence (`evidence.playback.integrity`);
     * the file and the fragment in it are the ones the Core's media route named in its refusal.
     */
    player: {
      fileStopped: 'Stopped: this file failed its integrity check at fragment {{seq}}.',
      fileStoppedNoPlace: 'Stopped: this file failed its integrity check.',
      refusedByCore: 'The Core server refused the fragment: it does not match the sealed package, and none of its bytes was sent.',
      otherPlays: '{{stopped}} is stopped. {{playing}} plays on.',
      nothingPlays: 'Playback is stopped.',
      runVerify: 'Run Verify for the full result.',
      notLoaded: 'This file has not loaded.',
      interruptedEnd: 'End of the sealed recording at {{at}}: the recording was interrupted, so it ends here.',
    },
    /** Fix wave L, driver L-W (G89c-01): the Dashboard's sealed item whose package the Core cannot read. */
    dashboard: {
      packageNotReadable: 'PACKAGE NOT READABLE',
    },
    /**
     * Fix wave L, driver L-W. ONE RULE of a Core in its own capture: a screen states the Core's own
     * fact, or "Not reported", or nothing - never a constant of the simulator, of a bundled
     * demonstration index or of an adapter default. A block that still shows model values carries
     * the chip `syntheticChip`.
     */
    waveL: {
      syntheticChip: 'Synthetic demo values',
      syntheticHint: 'This block shows values of the appliance model. This Core does not report them.',
      notReported: 'Not reported',
      /** G89c-02: Security & Audit, Tamper & Integrity - the Core's own verify rows instead of the bundled index. */
      tamper: {
        verifyLabel: 'Last verify run per item',
        noVerifyRows: 'Not reported',
        failedAt: '{{id}}: {{place}} failed verification',
        failedNoPlace: '{{id}}: failed verification',
        place: '{{track}} fragment {{seq}}',
        fromRows: 'From the verify rows of this Core in the audit view',
        noVerifyRowsHint: 'No verify run of this Core is in the audit view.',
      },
      /** G89c-03: the Monitor's integrity card beside a session of the Core's own capture that is not recording. */
      integrity: {
        sealedState: 'Sealed',
        sealedDetail: 'Evidence {{evidenceId}} is sealed. Verify it on its Evidence page.',
        sealedNoItem: 'This session is sealed.',
        idleDetail: 'No recording is running.',
        protectionSealed: 'Each sealed item states how it is encrypted.',
        moreBelow: 'More below - scroll',
      },
      /** G75d-05 / G89c-04: the format of a track is what the selector line or the signed manifest says. */
      profile: {
        configuredLabel: 'Configured profile',
        configuredValue: '{{track}}: {{profile}}',
        notStated: 'Not reported',
        sealedLabel: 'Sealed format (signed manifest)',
        notice: 'The Core noted for this session that the recorded stream differs from the configured profile: {{parts}}.',
        noticePart: '{{track}} recorded {{stream}}, configured {{configured}}',
      },
      /** G75d-06: a generated source is named as generated, never by a product name of the dataset. */
      source: {
        generatedCamera: 'Generated test source',
        generatedMic: 'Generated test source',
        localCamera: 'Camera of this computer',
        localMic: 'Microphone of this computer',
        cameraOf: '{{name}} · {{id}}',
      },
      /** G70c-02: states of a source nobody opened are not checked facts. */
      state: {
        notChecked: 'Not checked',
        assigned: 'Assigned',
        registered: 'Registered',
        notCheckedHint: 'The Core has not opened this source: it states no reachability for it.',
      },
      /** G75d-02: the retry of a blocked seal (operation 33). */
      sealRetry: {
        stopped: 'Sealing stopped after {{count}} automatic retries.',
        whoCan: 'An investigator or a supervisor can retry.',
        youCan: 'When the cause is resolved, retry the seal here.',
        action: 'Retry sealing',
        pending: 'Retrying…',
        sent: 'Sealing is run again.',
        refused: 'The retry was not accepted. The seal is still blocked.',
      },
      /** G75d-01 / -03: an open notice that does not block recording, and a blocked seal on the status surfaces. */
      notice: {
        pillLabel: 'OPEN NOTICE',
        pillSub_one: '{{count}} recording could not be sealed',
        pillSub_other: '{{count}} recordings could not be sealed',
        ringSub: 'OPEN NOTICE • RECORDING NOT BLOCKED',
        ringDetail_one: 'A recording could not be sealed ({{sessionId}}). Its files were kept in quarantine on the Core. Recording is not blocked.',
        ringDetail_other: '{{count}} recordings could not be sealed. Their files were kept in quarantine on the Core. Recording is not blocked.',
        plain: 'This recording could not be sealed. Its files were kept in quarantine on the Core.',
        ofSession: 'Session {{sessionId}}',
        cause: 'Cause code: {{cause}}',
        closeBySupervisor: 'A supervisor acknowledges this notice to close it.',
        closeByYou: 'Acknowledge this notice to close it.',
        acknowledge: 'Acknowledge and close',
        blockedRing: 'SEALING BLOCKED',
        blockedRingSub: 'NO NEW SESSION UNTIL IT IS SEALED',
        blockedRingDetail: 'Sealing of session {{sessionId}} is blocked. The Core records no new session until it is sealed. The recording is kept on the Core.',
      },
      /** G75d-04: the terminal sentence of a session that ended unsealable. */
      unsealableEnd: {
        title: 'Recording not sealed',
        retrying: 'Sealing failed and is tried again',
      },
      /** G75d-06 / -07: the Devices summary and audio block of a Core in its own capture. */
      summary: {
        cameras: 'The sources on the two video tracks',
        microphones: 'The sources on the two microphone lines',
        other: 'PoE · relay · tablet link',
        audioSubtitle: 'The microphone sources of the primary and the standby line',
      },
      dashboardNetwork: 'This Core reports no network status here.',
      networkBannerDetail: 'Host system clock · no time service configured',
      ringReadyCaption: 'No fault is reported. A new session can be started.',
      /** G70c-08: a registered camera that is on no track. */
      roster: {
        unassigned: 'On no track',
      },
    },
    /** Fix wave M, driver M-W (final re-checks 70, 75, 89; rulings D234, D235). */
    waveM: {
      /** G75e-04 / G75e-06: the Dashboard ring while a session records beside an open notice, and while a seal is retried. */
      ring: {
        noticeRecording: 'OPEN NOTICE • RECORDING',
        recordingFlags: 'RECORDING • NO FAULT REPORTED',
        retrySub: 'SEALING IS BEING RETRIED',
        retryDetail: 'The seal of session {{sessionId}} did not complete. The Core runs it again by itself. The recording is kept on the Core.',
      },
      /** G75e-06: the header pill while the Core retries a seal by itself. */
      pill: {
        retryLabel: 'SEALING RETRIED',
        retrySub: 'The Core is running the seal again',
      },
      /** G75e-05: a recording of the Core's own capture was interrupted and the Core is sealing what was recorded. */
      coreSealing: {
        title: 'Recording interrupted',
        detail: '{{reason}}. The Core is sealing the recording up to the interruption. Nothing has to be started here.',
        detailNoReason: 'The Core is sealing the recording up to the interruption. Nothing has to be started here.',
      },
      /** G75e-02: the microphone meters of the device check on a Core in its own capture. */
      micLine: {
        PRIMARY: 'Primary microphone',
        STANDBY: 'Standby microphone',
      },
      /** G89d-02: the items of this Core no verify row names. */
      tamper: {
        notVerified_one: '{{count}} of the {{total}} items of this Core has no verify run in these rows.',
        notVerified_other: '{{count}} of the {{total}} items of this Core have no verify run in these rows.',
        allVerified: 'Every one of the {{total}} items of this Core has a verify run in these rows.',
      },
      /** G89d-06: the closing sentence of the integrity card of a session that IS sealed. */
      integrity: {
        sealedNote: 'Fragment hashes and the signature are stated on the evidence item:',
        sealedNoteNoItem: 'Fragment hashes and the signature are stated on the evidence item of this session.',
      },
    },
    /** Fix wave J, driver J-W (the UI judging session, report/judging_b1_web.md; decision D243). */
    waveJ: {
      /** JW-04 / JW-05: the header pill's words for the statements the kit's four states do not hold. */
      pill: {
        alertLabel: 'ALERT ACTIVE',
        alertSub_one: '{{count}} active alert',
        alertSub_other: '{{count}} active alerts',
        offlineLabel: 'CORE OFFLINE',
        offlineSub: 'State unknown',
        offlineDetail: 'The link to the Core is lost. Nothing below is known until it is back.',
        noFaultLabel: 'NO FAULT REPORTED',
        noFaultSub: 'Platform security: not reported',
      },
      /** JW-04 / JW-05 / JT-01: the Dashboard ring's words for the same statements. */
      ring: {
        offlineSub: 'CORE OFFLINE • STATE UNKNOWN',
        offlineDetail: 'The link to the Core is lost. The state shown on this page is the last one received.',
        alertSub_one: '{{count}} ACTIVE ALERT',
        alertSub_other: '{{count}} ACTIVE ALERTS',
        alertRecording_one: 'RECORDING • {{count}} ACTIVE ALERT',
        alertRecording_other: 'RECORDING • {{count}} ACTIVE ALERTS',
      },
      /** JW-07 (truth rule 3f): the mark of a feed, a recording state or an integrity statement of the demonstration. */
      demo: {
        chip: 'DEMO · SIMULATED',
        short: 'DEMO',
        hint: 'This Core is the demonstration: pictures, recording state, integrity checks and platform values are simulated.',
        modeChip: 'LIVE · DEMO CORE',
        modeTooltip: 'This console shows the data of a Core server that runs the demonstration: its recordings and device values are simulated.',
        feedNote: 'Simulated picture',
      },
      /** JW-14: ONE rule for "the role may not" - a disabled control with its visible reason, a page that says so. */
      rbac: {
        or: 'or',
        pageTitle: '{{page}}: not available to your role',
        signedInAs: 'You are signed in as {{role}}.',
        toDashboard: 'Go to the Dashboard',
        exportStep: 'Exporting evidence needs the Supervisor role.',
      },
      /** JW-01 / JW-02 / JW-09 / JW-27: what an evidence item states about its own seal and verification. */
      evidence: {
        verificationFailedStatus: '{{status}} · verification FAILED',
        lifecycleFailed: 'The verification of record FAILED',
        notSealedChip: 'Not sealed',
        notSealedTitle: 'This item was never sealed',
        notSealedBody: 'The recording ended before it could be sealed. There are no sealed values, no manifest and no signature, and there is nothing to verify.',
        notSealedVerify: 'This item was never sealed: there is nothing sealed to verify.',
        manifestInExport: 'The signed manifest is part of the export package. Use Export.',
        manifestDemo: 'Download DEMO manifest summary',
        manifestDemoToast: 'DEMO manifest summary downloaded',
        demonstrationRecord: 'Demonstration record of a simulated session: no media was recorded.',
        demonstrationVerdict: 'Demonstration: the hashes of a demonstration record were compared. No stored media was read.',
      },
      /** JW-03: the activity lists tell a requested export from a completed one. */
      events: {
        exportRequested: 'Export requested',
      },
      /** JW-08: a microphone level the Core did not measure (no capture is open). */
      meter: {
        notMeasured: 'Not measured',
        notMeasuredHint: 'The Core measures a level only while a capture is open.',
      },
      /** JT-06 / JW-06 (truth rule 3e): "Install update" asks first; a Core without an updater offers none. */
      update: {
        confirmTitle: 'Install v{{version}}?',
        confirmBody: 'The signed bundle is checked and installed to the inactive slot {{slot}}. The running version v{{current}} stays in its slot as the rollback target.',
        confirmRestart: 'The Core then restarts into the new slot. The console and every paired device lose the Core for the length of the restart. No session can be recorded meanwhile.',
        confirmAction: 'Install and restart',
        notAvailable: 'Software update is not available on this Core. It has no updater: nothing can be installed from here.',
        notAvailableChip: 'Not available',
      },
      /** GM-02: the tamper tile reads the Core's own count over every sealed item (`evidenceVerification`). */
      tamper: {
        neverVerified_one: '{{count}} of the {{total}} sealed items of this Core has no verification of record.',
        neverVerified_other: '{{count}} of the {{total}} sealed items of this Core have no verification of record.',
        allVerified: 'Every one of the {{total}} sealed items of this Core has a verification of record.',
        fromItems: 'Counted by the Core over every sealed item',
      },
      /** JW-22: the Sessions page - every finished session with its state, quarantined and INCOMPLETE ones included. */
      sessions: {
        title: 'SESSIONS',
        subtitle: 'Every finished session of this Core, with what became of its recording.',
        link: 'All sessions',
        summary: '{{total}} sessions · {{incomplete}} not sealed',
        search: 'Search session, evidence, case or subject',
        filterLabel: 'Session state',
        filter: { ALL: 'All', SEALED: 'Sealed', INCOMPLETE: 'Not sealed' },
        columns: { session: 'Session', case: 'Case and subject', time: 'Started', state: 'State' },
        notStarted: 'No recording started',
        none: 'This Core lists no finished session.',
        noMatch: 'No session matches.',
        state: {
          SEALED: 'Sealed',
          QUARANTINED: 'Not sealed · recording kept in quarantine',
          RECORDED_NOT_SEALED: 'Not sealed · recording interrupted',
          NEVER_RECORDED: 'Ended before a recording started',
        },
        detail: {
          QUARANTINED: 'The session recorded, but it could not be sealed. It has no evidence item. Its recording is kept in the quarantine folder of the Core and is not evidence. What to do: tell the administrator of this installation, who recovers the files from the Core; record the interview again if it is needed as evidence.',
          RECORDED_NOT_SEALED: 'The recording was interrupted and was never sealed. Its item is a record without sealed values: it cannot be verified or exported.',
          NEVER_RECORDED: 'Nothing was recorded.',
        },
        quarantineTitle_one: '{{count}} recording is kept in quarantine',
        quarantineTitle_other: '{{count}} recordings are kept in quarantine',
        quarantineBody: 'A recording in quarantine was not sealed and is not evidence. The administrator of this installation recovers the files from the quarantine folder of the Core. Each such session is listed below with its cause.',
        evidenceHint_one: '{{count}} session matches this search and has no evidence item (not sealed).',
        evidenceHint_other: '{{count}} sessions match this search and have no evidence item (not sealed).',
        evidenceHintLink: 'Show in Sessions',
      },
      /** JW-28: the Dashboard's words for a session that is over, and for a count of today. */
      dashboard: {
        lastSession: 'LAST SESSION',
        sealedToday: 'Sealed today',
      },
      /** JW-23: the four facts of a Core in its own capture that carried no mark. */
      devices: {
        bannerTitle: 'NO DEVICE FAULT REPORTED',
        bannerDetail: 'A capture source is checked when a pre-check or a recording opens it. PoE, relay and tablet-link values are synthetic demo values.',
      },
      network: {
        notReported: 'Network not reported',
      },
      /** JW-20: the developer diagnostic says what it is. */
      stackCheck: {
        subtitle: 'Developer diagnostic of this console build. It is not an operator page and shows no evidence.',
      },
      /** JW-24: the audit export states what its file holds. */
      auditExport: {
        hashStep: 'Add the chain head',
        notSigned: 'The file holds the audit rows and the head of the hash chain. It is not signed and not sealed: its proof is the chain itself, which the Core can verify.',
      },
      /** JW-17: New Session copy that contradicted the state. */
      sessionNew: {
        startHintCountdown: 'Recording starts after the 3-2-1 countdown and is sealed when you end the session.',
        armedBody: 'The pre-recording checks are done. Start the recording from the session setup.',
        nextForm: 'Fill in the required fields to continue.',
        nextChecking: 'The capture sources are being read.',
        nextBlocked: 'A check blocks recording. Resolve it and re-run the checks.',
        nextAck: 'Acknowledge the warnings to continue.',
        nextRunning: 'The checks are running.',
        required: 'Required',
        nameLimit: 'The name is limited to {{max}} characters.',
        policyBlockOwn: 'Core offline, storage full, security fault, no camera reachable',
        policyWarnOwn: 'A camera or a microphone that does not answer (the session then records without it), storage low',
      },
      /** JW-21: the Alerts page. */
      alerts: {
        title: 'ALERTS',
        subtitle: 'Every alert this Core holds, active and cleared, with its acknowledgement.',
        link: 'All alerts',
        summary: '{{total}} alerts · {{open}} not acknowledged',
        none: 'This Core holds no alert.',
        active: 'Active',
        cleared: 'Cleared',
        ackDone: 'Acknowledged',
        ackOpen: 'Not acknowledged',
        acknowledge: 'Acknowledge',
        acknowledged: 'Alert {{id}} acknowledged',
        resolvedOpen: 'Resolved, not acknowledged',
      },
      /** JT-10 / JW-12: the transcript follows the playback, and a segment's time seeks. */
      transcript: {
        seek: 'Play from {{start}}',
        noPlayer: 'This item has no playback on this console.',
      },
      /** JT-11 / JW-13: the markers and notes of the session, on the item. */
      annotations: {
        title: 'Markers and notes of the session',
        marker: 'Marker {{index}}',
        noLabel: '(no label)',
        note: 'Note',
      },
      /** JW-04: the pre-check's SECURITY row on a Core that reports no platform posture. */
      precheck: {
        securityNotReported: 'This Core reads no TPM, Secure Boot or enclosure state. Nothing was checked.',
      },
    },
    /** Fix wave J, round three (driver J3-W): the sentences of the remaining web findings. */
    waveJ3: {
      /** JW-26: one version per component, each by its name. */
      versions: {
        title: 'Software components',
        source: 'Each version is stated by its own component: the three of the Core by this Core, the console by this build. They are not demo values.',
        component: { core: 'Core server', captureWorker: 'Capture worker', apiContract: 'API contract', webConsole: 'Web console' },
        line: '{{component}} {{version}}',
        pairedApps: 'Each paired device states its own app version: see Paired Devices',
        lcdFirmware: 'FW NOT REPORTED',
      },
      /** JW-13 / JT-11: the form's note is named for what it is; an un-annotated session says so. */
      annotations: {
        formNote: 'Note from the session form',
        none: 'No markers or notes were recorded in this session.',
      },
      /** N-07: the export wizard's second step checks the operator's own role; it is not an approval by somebody else. */
      exportRole: {
        step: 'Role check',
        check: 'Check my role',
        permits: 'Your role may export',
      },
      /** N-19: the transcript ends well before the recording does. Two facts of the item, no cause. */
      transcript: {
        tail: 'The last transcribed segment ends at {{last}}. The recording runs {{duration}}: this transcript has no text after {{last}}.',
      },
      /** A table that is wider than its card says on which side its other columns are. */
      sideways: {
        right: 'More columns to the right: scroll the table sideways',
        left: 'More columns to the left: scroll the table sideways',
        both: 'More columns on both sides: scroll the table sideways',
      },
      /** The bell's backlog: "Acknowledge all" - one press, a confirmation that names the count, one request per alert. */
      ackAll: {
        action_one: 'Acknowledge all ({{count}})',
        action_other: 'Acknowledge all ({{count}})',
        progress: 'Acknowledging {{done}} of {{total}}',
        confirmTitle_one: 'Acknowledge {{count}} alert?',
        confirmTitle_other: 'Acknowledge {{count}} alerts?',
        confirmBody_one: '{{count}} alert is marked as acknowledged for every console of this Core. The fault behind it is not cleared by this.',
        confirmBody_other: '{{count}} alerts are marked as acknowledged for every console of this Core, one after the other. The faults behind them are not cleared by this.',
        confirmLeft_one: '{{count}} notice of a recording that could not be sealed (kept in quarantine) is not included. It is left for individual acknowledgement on its own row.',
        confirmLeft_other: '{{count}} notices of recordings that could not be sealed (kept in quarantine) are not included. They are left for individual acknowledgement, each on its own row.',
        confirmAction_one: 'Acknowledge {{count}} alert',
        confirmAction_other: 'Acknowledge {{count}} alerts',
        done_one: '{{count}} alert acknowledged',
        done_other: '{{count}} alerts acknowledged',
        partial: '{{done}} of {{total}} alerts acknowledged. The rest is unchanged.',
        partialBody: 'An acknowledgement was not accepted. Try again for the alerts that are left.',
      },
      /** JW-22 remainder (contract J2-S 4): why the seal of a quarantined session was given up. */
      sessions: {
        unsealableCause: 'Why it could not be sealed (the code the Core recorded): {{cause}}',
        unsealableCauseUnknown: 'The Core states no cause code for this session.',
      },
    },
    /**
     * Fix wave Q, driver Q-W (the confirmation of fix wave J: JW-13 in its custody part, CW-04, CT-08).
     */
    waveQ: {
      /** JW-13: the two custody actions that have no audit twin (the others read the audit vocabulary; `lib/event-words.ts`). */
      custody: {
        RECORDING_INTERRUPTED: 'Recording interrupted',
        EXPORT_DOWNLOADED: 'Export downloaded',
      },
      /** JW-13: a cause is said in words; the code the Core recorded follows as the reference. */
      cause: {
        line: 'Cause: {{words}} (code {{cause}})',
      },
      sessions: {
        unsealableCause: 'Why it could not be sealed: {{words}} (the code the Core recorded: {{cause}})',
      },
      /** CP-05 (the web's side): a demonstration record is named so on its list row and its header. */
      evidence: {
        demonstrationRecord: 'Demonstration record',
        demonstrationHint: 'A demonstration record: its seal and its values are simulated. It is not evidence.',
      },
      /** CT-08 (the web's side): the New Session form of a Core in its own capture states the selector's profile; it offers no choice. */
      profile: {
        hint: 'Set per camera on Devices & Inputs. The session records with it.',
      },
      /** CW-04 (truth rule 3f): the seal dialog of the demonstration Core says what it is. */
      sealDialog: {
        demonstration: 'Demonstration: this seal is simulated. The item is a demonstration record, not evidence.',
      },
    },
    /**
     * Task 4 row 234 (the finding of the user's run on real cameras; decision C60): why the Core
     * refused to assign a source to a selector slot (operations 78, 79, 80; `422 INVALID_INPUT`),
     * keyed by the word of `details.reason`.
     *
     * ROW V4 (decision C80): THE SENTENCES ARE THE SHARED TREE'S (`common.captureSlotRefusal`, and
     * the two nouns `common.captureSlotSource`) - they were moved there word for word and this
     * console's copies are gone. The two members this tree still held "by reference" (`source`,
     * `reason`) were removed by the clean-up after row V4: the selector panel reads the shared
     * group as its ONE source (`features/devices/slot-refusal.ts`). What stands here is the one
     * text the shared tree has no member for.
     */
    captureSlotRefusal: {
      /** A word nobody has a sentence for follows the general sentence as a code. */
      code: 'Reason code: {{code}}.',
    },
    /**
     * Task 4 row W5 (review 060d Q-02; decision C36): the stream profile of a production camera's
     * assignment (`features/devices/camera-profile.ts`). A profile is said by what its stream stated;
     * nothing here names a default.
     */
    cameraProfile: {
      label: 'Stream profile for {{track}}',
      placeholder: 'Choose a stream profile',
      /** What a stored profile is: codec, picture, rate. */
      facts: '{{codec}} • {{resolution}} • {{rate}}',
      rate: '{{fps}} fps',
      codecNotStated: 'Codec not stated',
      resolutionNotStated: 'Picture not stated',
      rateNotStated: 'Rate not stated',
      /** A stored code that is no stream statement. */
      notStated: 'Not stated ({{code}})',
      choose: 'This camera has {{count}} stored stream profiles. Choose the one this track records, then save.',
      one: 'This camera has one stored stream profile. It is the one this track records.',
      /**
       * Row W6 (decisions C117, C126 (d)): the remedy is named. Since rows PR and V7 the connection test of a
       * registered camera (operation 108) stores what the stream states when the camera holds no profile;
       * the control "Test connection" is drawn under this sentence (`adopted-camera-test.tsx`).
       */
      none: 'This camera cannot be assigned yet: the Core holds no stream profile for it, and it does not pick one for a camera. Press "Test connection": when the test reads the camera\'s stream, the Core stores the profiles it states and they are offered here. Nothing was changed.',
    },
    /**
     * Task 4 row W6 (operation 108; decisions C117, C126 (d)): "Test connection" of an ADOPTED camera
     * (`features/devices/adopted-camera-test.tsx`). The button and its pending words are the shared
     * `common.captureConnect.test` / `.testing`; the three `409` reasons and the not-ready answer read the
     * contract's own sentences (`CAPTURE_DEVICE_TEST_REFUSAL_SENTENCES`, `CAPTURE_DEVICE_TEST_NOT_READY_SENTENCE`);
     * UNREACHABLE, WRONG_PROFILE and NOT_H264 read `common.captureConnect.outcome`. Nothing here asks for a password.
     */
    adoptedTest: {
      hint: 'The Core tests this camera with the password it stored when the camera was added. Nothing is typed here, and no setting of the camera is changed.',
      locked: 'A camera cannot be tested while a session is open.',
      nothingStored: 'No stream profile was stored.',
      /** The device entry's fact (line 526 (1)): the stored profiles, each by what its stream stated. */
      profilesLabel: 'Stored stream profiles',
      profilesNone: 'None stored yet',
      result: {
        PROFILES_STORED: 'The connection works. The Core stored the stream profiles this camera states: it can now be assigned to Camera 1 or Camera 2.',
        STREAM_PROFILE_DIFFERS:
          'The camera now states other stream profiles than the ones stored for it. Nothing was stored: the stored profiles stand, and a connection test does not replace them. To use what the camera states now, adopt the camera again.',
        REACHABLE: 'The connection works with the stored password. No stream profile was stored.',
        PASSWORD_REFUSED: 'The camera refused the stored password. No stream profile was stored.',
      },
      refusal: {
        LOCKED: 'A camera cannot be tested while a session is open. Nothing was sent to the camera.',
        NOT_FOUND: 'The Core has no such registered camera. Nothing was sent.',
        STORE_NOT_READY: 'The Core cannot read the stored camera password now. Nothing was sent to the camera.',
        ROLE: 'Your role may not test a camera, or this is not a web console session. Nothing was sent.',
        OTHER: 'The Core did not carry out the test. Nothing was stored.',
      },
    },
    /**
     * Task 4 row 198 (operation 100): the confirmation dialog of a camera re-address. The sentences
     * of the six `409` reasons are the contract's own (`CAPTURE_READDRESS_REFUSAL_SENTENCES`).
     */
    readdress: {
      action: 'Confirm new address',
      title: 'Confirm the new address of {{device}}',
      intro: 'The search found a device that answers as this registered camera from another address. The Core never follows a camera to a new address by itself.',
      registered: 'Registered address',
      found: 'Found address',
      registeredUnknown: 'Not shown by the Core',
      consequence:
        'Confirm only if this is the same camera. The Core then stores the found address for this camera and will use the stored credential of the camera there. This confirmation sends nothing to the camera.',
      confirm: 'Store the found address',
      close: 'Close',
      searchAgain: 'Search again',
      done: 'The address of {{device}} is now {{address}}.',
      nothingChanged: 'Nothing was changed.',
      refusal: {
        LOCKED: 'The address of a camera cannot be changed while a session is open. Nothing was changed.',
        RESULT_GONE: 'The Core no longer keeps this camera or this search result. Search again. Nothing was changed.',
        SEARCH_NOT_READY: 'The camera search of this Core is not available now. Nothing was changed.',
        ROLE: 'Your role may not change the address of a camera. Nothing was changed.',
        INVALID_INPUT: 'The confirmation was not accepted as it was written. Search again. Nothing was changed.',
        OTHER: 'The Core did not confirm the change. Search again to read the address it holds for this camera.',
      },
    },
    /**
     * Task 4 row 112 (operations 101 to 105; decision U10: TECHNICIAN only): the commissioning
     * screen of the camera network - settings, the factory address scan, the temporary host
     * address. The sentence of each contract reason is the contract's own
     * (`CAPTURE_COMMISSIONING_REFUSAL_SENTENCES`). The set-IP screens (row 113) are the member
     * `setIp`, the installation acceptance (row 118) the member `acceptance`.
     */
    commissioning: {
      nav: 'Camera network',
      title: 'Camera network setup',
      subtitle: 'Commissioning: the camera interface, the camera subnet, the factory addresses and the scan.',
      checking: 'Checking your permissions...',
      productionOnly:
        'Saving these settings, a scan and removing a temporary address need a Core running in production capture operation. On any other Core they are refused and nothing changes.',
      notProduction: 'This Core is not running in production capture operation: the camera network cannot be set up or changed here. Nothing was changed.',
      simulated:
        'Simulated mode: the configuration, the scan result and the address state on this screen are synthetic answers of the in-app simulator. No network is read, no address is asked and nothing is stored.',
      readFailed: 'The camera network configuration could not be read.',
      settings: {
        title: 'Network settings',
        notConfigured:
          'No camera interface or no camera subnet is chosen. The camera search and the connection of cameras do not need them; until both are set, a factory address scan and a camera address change are refused.',
        interfaceName: {
          label: 'Camera interface',
          // Row W6 (request line 557 (3), row V7b): the form admits capitals (`CAPTURE_INTERFACE_NAME_PATTERN` widened, e.g. `enP3s0`).
          hint: 'The network interface the factory address scan and the camera address change use, for example eth1 or enP3s0: letters of either case, digits, "_", "." and "-", the first a letter or a digit, at most 15 characters. Cameras on other interfaces are still found and connected. Leave it empty for "not chosen".',
          error: 'Type an interface name: 1 to 15 letters of either case, digits, ".", "_" or "-", starting with a letter or a digit.',
        },
        cameraSubnet: {
          label: 'Camera subnet',
          hint: 'The private IPv4 network a camera address change gives cameras, as a.b.c.d/n with a prefix length of 16 to 30, for example 192.168.10.0/24. Leave it empty for "not chosen".',
          error: 'Type a private IPv4 network as a.b.c.d/n with a prefix length of 16 to 30.',
        },
        factoryAddresses: {
          label: 'Factory addresses',
          hint: 'The addresses a scan asks, one per line, at most {{max}}. A camera at an address outside this list is found only by a typed address.',
          error: 'Type at most {{max}} private IPv4 host addresses, one per line, each only once.',
        },
        aliasHost: { label: 'Temporary address: host part', hint: 'The last number of the temporary address the Core takes in a factory network, {{min}} to {{max}}.' },
        aliasMinutes: { label: 'Temporary address: lifetime in minutes', hint: 'The host removes the temporary address by itself after this time, {{min}} to {{max}} minutes.' },
        cameraIpStart: { label: 'First camera address: host part', hint: 'The last number of the first address offered to a camera in the camera subnet, {{min}} to {{max}}.' },
        /** Row W6 (request line 557, row V7b; F-4, S2-02, C116): the seventh setting, the allowed ONVIF ports in their stored order. */
        onvifPorts: {
          label: 'Allowed ONVIF ports',
          hint: "The ports a stored camera's ONVIF service may be reached on, in order, {{min}} to {{max}} ports, separated by commas or lines. A camera stored without a port is reached on port 80, so keep 80 in the list for such cameras.",
          error: '1 to 8 whole numbers from 1 to 65535, each once',
        },
        numberError: 'Type a whole number from {{min}} to {{max}}.',
        save: 'Save settings',
        saved: 'The camera network settings were saved.',
        unchanged: 'Nothing in the form differs from the stored settings. Nothing was sent.',
        revision: 'Revision {{revision}}',
        lastWritten: 'Last written at {{time}} by {{operator}}.',
        neverWritten: 'Nobody has written this configuration yet: the values shown are the defaults.',
      },
      scan: {
        title: 'Factory address scan',
        intro: 'A scan asks the stored factory addresses, and one typed address if you give one. It runs only when you start it, and its result is not stored.',
        outsideList: 'A camera at an address that is not in the factory address list is found only by a typed address.',
        address: {
          label: 'One more address (optional)',
          hint: 'One private IPv4 host address, for example 192.168.1.64.',
          error: 'Type one private IPv4 host address, or leave the field empty. Nothing was sent.',
        },
        action: 'Scan factory addresses',
        summary_one: 'Asked {{count}} address at {{time}}.',
        summary_other: 'Asked {{count}} addresses at {{time}}.',
        none: 'No device answered.',
        synthetic: 'Synthetic answer of the simulator: nothing was scanned and the listed device does not exist.',
        table: 'Devices that answered the scan',
        columns: { address: 'Address', mac: 'Hardware address', device: 'Announced', onvif: 'ONVIF', registered: 'Registered' },
        macUnknown: 'Not in the neighbour table',
        deviceUnknown: 'Nothing announced',
        onvifYes: 'Answers',
        onvifNo: 'No answer. The camera may need activation in its own web page first.',
        conflict: 'More than one device answers at this address. Unplug all but one and scan again.',
        countNotKnown: 'Number of devices at this address: not known - connect one factory-address camera at a time.',
        registered: 'Registered as {{device}}',
        notRegistered: 'Not registered',
      },
      alias: {
        title: 'Temporary host address',
        intro: 'To reach a camera at a factory address the Core can take one temporary address on the camera interface. One at a time; the host removes it by itself when its lifetime ends.',
        none: 'No temporary address is in place.',
        address: 'Address',
        reason: 'Added for',
        addedAt: 'Added at',
        expiresAt: 'Removed by the host at',
        reasons: { FACTORY_SCAN: 'A factory address scan', SET_CAMERA_ADDRESS: 'A camera address change' },
        removeError: 'The last removal failed (code {{code}}). The address is still in place.',
        remove: 'Remove now',
        removed: 'The temporary address was removed.',
        refresh: 'Read again',
        readFailed: 'The state of the temporary address could not be read.',
      },
      refusal: {
        LOCKED: 'The camera network cannot be changed while a session is open. Nothing was changed.',
        REVISION_CONFLICT: 'Someone else changed the configuration meanwhile. The form now shows the stored values: make your change again. Nothing was changed.',
        ROLE: 'Your role may not set up the camera network. Nothing was changed.',
        INVALID_INPUT: 'The request was not accepted as it was written. Nothing was changed.',
        OTHER: 'The Core did not answer this request. Nothing is known to have changed.',
        cause: 'Helper code: {{code}}.',
      },
      /**
       * Task 4 row 113 (operations 106 and 107; decisions C1, C7): the set-IP screens. The camera
       * is recognised by its hardware address, so every state names the addresses side by side.
       * No sentence quotes an account, and none says more than the Core answered.
       */
      setIp: {
        title: 'Camera address change',
        intro:
          'Gives ONE camera a fixed address in the camera subnet. The camera is recognised by its hardware address: the one in the neighbour table of the Core host must equal the one the camera states after sign-in, or nothing is set.',
        simulated: 'Simulated mode: the simulator changes no camera and starts no job. A start is answered as refused, and the typed account is dropped unread.',
        needScan: 'Scan first, then choose "Change address" in the row of the camera. The present address must be one the last scan listed.',
        column: 'Address change',
        pick: 'Change address',
        pickLabel: 'Change the address of the camera at {{address}}',
        pickConflict: 'Not offered: more than one device answers here.',
        pickNoMac: 'Not offered: the scan showed no hardware address for this device. Scan again.',
        picked: {
          from: 'Present address',
          mac: 'Hardware address at the scan (neighbour table)',
          macUnknown: 'Not in the neighbour table at the scan. Without it an address change cannot be started: scan again.',
          device: 'Announced',
          registeredNote:
            'This camera is registered as {{device}}. The job changes the camera only: the registered camera keeps its stored address until you confirm the new one on the Devices page.',
        },
        toAddress: {
          label: 'New address (optional)',
          hint: 'One private IPv4 host address inside the camera subnet. Leave it empty and the Core takes the next free address from the configured first one.',
        },
        gateway: {
          label: 'Gateway (optional)',
          hint: 'One private IPv4 host address inside the camera subnet. It is set on the camera only when you give one.',
        },
        addressError: {
          form: 'Type one private IPv4 host address, or leave the field empty. Nothing was sent.',
          same: 'This is the present address of the camera. Nothing was sent.',
        },
        accountNote:
          'The camera account is typed for this one job. The console does not keep it: both fields are emptied when the job is started, on Cancel and when you leave this page. The Core does not store it either.',
        confirm: 'This is the camera I mean: the device at {{address}} with the hardware address {{mac}}. I compared it with the label on the camera. The Core changes no device that states another.',
        confirmNoMac: 'The scan showed no hardware address for the device at {{address}}: an address change cannot be started. Scan again.',
        start: 'Start address change',
        cancel: 'Cancel',
        refusal: {
          NOT_AVAILABLE:
            'This Core cannot change a camera address: it is not running in production capture operation, or its host does not provide what an address change needs. Nothing was sent to the camera and nothing was changed.',
          ADDRESS_NOT_ALLOWED:
            'The present address must be one the last scan of this Core listed; the new address and the gateway must lie inside the camera subnet and belong to no other device. Scan again, then try again. Nothing was sent to the camera.',
          LOCKOUT_GUARD: 'Address changes and connection tests for this camera are paused so that the camera does not lock its account. Try again later. Nothing was sent to the camera.',
          RATE_LIMITED: 'Too soon after the last attempt on this camera. Try again shortly. Nothing was sent to the camera.',
          OTHER: 'The Core did not answer this request. Whether a job started is not known: read the temporary host address and scan again before another attempt.',
          nothingSent: 'Nothing was sent to the camera.',
        },
        job: {
          title: 'Job {{job}}',
          step: {
            REACHING: 'Reaching the camera at its present address',
            IDENTIFYING: 'Reading the hardware address from the neighbour table',
            SETTING: 'Signing in and setting the new address',
            WAITING: 'Waiting for the same camera at the new address (at most {{seconds}} seconds)',
            DONE: 'Ended',
          },
          from: 'Present address',
          target: 'Target address',
          targetUnknown: 'Not known yet: the Core takes the next free address',
          macNeighbour: 'Hardware address: neighbour table',
          macAuthenticated: 'Hardware address: stated by the camera after sign-in',
          macConfirmed: 'Hardware address: answering at the target address',
          macPending: 'Not read yet',
          macNone: 'None',
          verdictLabel: 'Neighbour table and camera',
          verdict: { PENDING: 'Not compared yet', SAME: 'Same device', DIFFERENT: 'Not the same device' },
          running: 'The address change is running. Stay on this page: the job is shown here only, and the console asks the Core for it every few seconds.',
          completed: 'The camera now answers at {{address}} with the same hardware address. Scan again before the next address change.',
          completedRegistered: 'This camera is registered as {{device}}: confirm its new address on the Devices page. Until then the registered camera keeps its old stored address.',
          failure: {
            CAMERA_UNREACHABLE: 'Nothing answered at the present address. Nothing was set on the camera.',
            ONVIF_NOT_ENABLED: 'The device answers, but not as an ONVIF camera. Activate ONVIF in the camera\'s own web page first. Nothing was set on the camera.',
            AUTHENTICATION_FAILED:
              'The camera refused this user name or password. Nothing was set on the camera. Repeated refusals pause further attempts so that the camera does not lock its account.',
            MAC_MISMATCH:
              'Stopped: the hardware address the camera stated is not the one in the neighbour table, or the neighbour table holds none for this address. This may not be the camera you mean. Nothing was set on the camera.',
            SET_REFUSED: 'The camera did not accept the new network setting, its answer could not be read, or a session was opened meanwhile. Scan again to see where the camera answers.',
            NOT_FOUND_AT_NEW_ADDRESS: 'The setting was sent, but the same hardware address did not answer at the target address in time. Scan again to see where the camera answers.',
            HOST_ALIAS_FAILED: 'The temporary host address needed to reach the camera could not be added. Nothing was set on the camera.',
            CORE_RESTARTED: 'The Core stopped while the job ran. Nothing more is known: scan again to see where the camera answers.',
            UNKNOWN: 'The job failed and the Core named no reason. Scan again to see where the camera answers.',
          },
          lost: 'The Core no longer holds this job: it restarted, or the job belongs to another sign-in. Nothing more is known: scan again to see where the camera answers.',
          unread: 'The job could not be read. It keeps running on the Core.',
          readNow: 'Read now',
          close: 'Close',
          accountGone: 'The typed user name and password were emptied from this page when the job was started.',
        },
      },
      /**
       * Task 4 row 118 (operations 109 and 110; decisions U11, C2, C80): the installation
       * acceptance and its revocation. The sentence of each contract reason is the contract's own
       * (`INSTALLATION_ACCEPTANCE_REFUSAL_SENTENCES`). The step names are this console's
       * (`features/commissioning/acceptance-model.ts`, driver decision of row 118).
       */
      acceptance: {
        title: 'Installation acceptance',
        notGated:
          'Recording is not gated on an acceptance: a session starts whether or not an acceptance is in force, and revoking one stops nothing. An acceptance is a record, not a switch.',
        intro: 'At most one acceptance is in force. What was accepted is never rewritten: a revoked acceptance is kept, and a new one is recorded beside it.',
        noRead: 'The console cannot read whether an acceptance is in force. The Core says so when you record or revoke one: a second acceptance is refused while one is in force, and a revocation is refused when none is.',
        simulated: 'Simulated mode: the simulator keeps no installation record. Recording and revoking are both answered as refused, and nothing is stored.',
        accept: {
          title: 'Record an acceptance',
          coreFacts:
            'The Core records by itself who accepts and when, its software version, its own ID, name and room, and its last completed diagnostics run. Run the diagnostics and wait until they end first.',
          siteAddress: {
            label: 'Site address (optional)',
            hint: 'At most {{max}} characters; several lines are allowed.',
            error: 'Type at most {{max}} characters. Nothing was sent.',
          },
          stepsLegend:
            'The checks of the hardware acceptance package, in the order of its run. Tick each check that passed. A check that was not run is ticked "Not run"; a check with neither tick is recorded as failed. Every check is recorded, and a check that failed or was not run needs a note that says why.',
          notRun: 'Not run',
          detail: {
            label: 'Note for: {{step}}',
            placeholder: 'Note (one line; required unless the check passed)',
            error: 'Type a note of at most {{max}} characters on one line. A check that failed or was not run needs one. Nothing was sent.',
          },
          action: 'Record acceptance',
          stored: 'The installation acceptance was recorded.',
        },
        revoke: {
          title: 'Revoke the acceptance in force',
          intro: 'Revokes the one acceptance in force. The record is kept with your reason, and recording goes on as before.',
          reason: {
            label: 'Reason',
            hint: '{{min}} to {{max}} characters, for example that the Core was moved to another room.',
            error: 'Type a reason of {{min}} to {{max}} characters. Nothing was sent.',
          },
          action: 'Revoke acceptance',
          stored: 'The installation acceptance was revoked.',
        },
        record: {
          inForce: 'The Core answered: this acceptance is in force.',
          revoked: 'The Core answered: this acceptance is revoked. No acceptance is in force.',
          acceptedAt: 'Accepted at',
          acceptedBy: 'Accepted by',
          softwareVersion: 'Software version',
          core: 'Core at acceptance',
          steps: 'Steps',
          stepsPassed: '{{passed}} of {{count}} met',
          diagnostics: 'Diagnostics run',
          siteAddress: 'Site address',
          revokedAt: 'Revoked at',
          revokedBy: 'Revoked by',
          revokeReason: 'Reason',
        },
        refusal: {
          LOCKED: 'An installation acceptance cannot be recorded or revoked while a session is open. Nothing was changed.',
          ROLE: 'Your role may not record or revoke an installation acceptance. Nothing was changed.',
          INVALID_INPUT: 'The request was not accepted as it was written. Nothing was changed.',
          OTHER:
            'The Core did not answer this request. Whether the record changed is not known. Send it again: a second acceptance is refused while one is in force, and a revocation is refused when none is, so the answer tells you which.',
        },
      },
    },
    /** Decision C67 (1): the Try-it refusal of an operation that makes the Core use a STORED credential (operation 108). It carries no secret itself. */
    tryIt: {
      storedCredentialDenied: 'This operation makes the Core use a stored camera credential against a device on the network and cannot be tried from the reference page.',
      /** Task 4 row 116 (request of agent A5): operations 109 and 110, the installation acceptance and its revocation. */
      storedRecordDenied: 'This operation changes the installation record of the Core. It is not offered for Try-it.',
    },
  },
} as const satisfies ResourceTree
