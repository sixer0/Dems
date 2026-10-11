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
  },
} as const satisfies ResourceTree
