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
  },
} as const satisfies ResourceTree
