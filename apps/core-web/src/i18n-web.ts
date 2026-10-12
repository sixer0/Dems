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
  },
} as const satisfies ResourceTree
