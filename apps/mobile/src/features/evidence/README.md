# `apps/mobile/src/features/evidence`

Up: [`src/features/`](../README.md)

## Purpose

The Evidence list at `/evidence` and the evidence detail at `/evidence/[evidenceId]` (a pane on tablets). The detail has Media, Metadata, and Hash & Integrity tabs, the sealed player (signed media sessions of operation 88), the transcript pane with revisions (operations 84, 85, 86), the export wizard and its background job (operations 42 and 87), archive, and the schema-v2 Verify report of operation 41 `verifyEvidence`. `item-v2.ts`, `item-facts.ts` and `verify-v2.ts` read the Core's answers defensively.

## Contents

| Entry | Role |
|---|---|
| [`testing/`](testing/) | Test beds, fakes and fixtures for the tests (no production code). |
| `archive-dialog.tsx` | Archive confirmation. Kit `Dialog`; the Core's `archiveEvidence` needs EVIDENCE_REVIEW (SUPERVISOR) and never archives a RECORDED item, so the callers disable the entry otherwise and this dialog still handles a ... |
| `audio-source-band.tsx` | The audio-source band: which microphone fed the single audio track over the recording, drawn from the item's `audioSourceIntervals` (media pts). |
| `detail-intent.ts` | A one-shot hand-over from the list's kebab menu to the detail: open the item on its Hash & Integrity tab and start a verification. Kept in feature memory rather than the URL, because the route files are step 70's and ... |
| `development-source.tsx` | The development-source marks of the Evidence screens. |
| `evidence-chips.tsx` | Evidence chips: the status chip per D28/Q4 and the subject-type chip. Both are the kit recipes (`StatusChip`, `SubjectTypeChip`). |
| `evidence-detail-screen.tsx` | Evidence detail at `/evidence/[evidenceId]`. |
| `evidence-detail.test.tsx` | Test: Evidence detail: Hash & Integrity shows PASS for a pristine item and FAIL on AUDIO-02 for the tampered one; the simulator records only verifications that agree with the package (SIM-GAP-M83-1); Metadata shows the ... |
| `evidence-detail.tsx` | Evidence detail body, shared by the phone route (`/evidence/[evidenceId]`, `variant="screen"`) and the tablet detail pane (`variant="pane"`). |
| `evidence-list-screen.tsx` | Evidence list at `/evidence`. |
| `evidence-list.test.tsx` | Test: The Evidence list's filters, search and selection, with the detail pane in a mocked expanded window (tablet landscape), plus the single-pane push on a phone. Real route files, real simulator, real providers. |
| `evidence-media.ts` | Media lookup for the Evidence screens. Join by the evidence number suffix: EV 0001–0013 use `DEMO_MEDIA_EVIDENCE`; the recording scenario's item uses the live loops; any later item has no DEMO media. Clip lengths ... |
| `evidence-model.test.ts` | Test: Pure rules of the Evidence screens: filters, search, sort, chips, formatting, the excerpt rule, the package join and the integrity verdicts, plus the scramble frames. |
| `evidence-model.ts` | Evidence view model. Pure TypeScript: no React, no hooks, so every rule here is unit-tested directly (T-M15 companions). |
| `evidence-more-menu-title.test.tsx` | Test: Tests "R-T-1: a disabled menu item keeps its visible title above its reason". |
| `evidence-row-deselect-drawn.test.tsx` | Test: Tests "RF-T-1: the Evidence row that loses the selection is still drawn". |
| `evidence-row.tsx` | One Evidence list row: thumbnail, ID (mono), date and time, subject, subject-type chip, duration (mono), status chip and the kebab `Menu`. |
| `export-job-model.ts` | The background export job of operations 42 and 87: the pure rules. |
| `export-job-status.tsx` | The state of one accepted export, read from the Core until the job is finished: Queued / Running with the Core's percent, Complete with the hash and the signature of the export manifest, or FAILED with the Core's ... |
| `export-job.test.ts` | Test: Blueprint row 92: the pure rules of the background export job (operations 42 and 87) and of the transcript pane (operations 84 to 86). |
| `export-job.ts` | Reading the background export job (operation 87) until it is finished. |
| `export-sheet.tsx` | Export wizard: a kit `BottomSheet` with the C-4 Stepper — Authorize, Verify source, Destination, Reason, Build and hash, Done — driven by the simulator's `exportEvidence` (the Core decides; the UI never fakes an ... |
| `finished-exports.tsx` | The finished exports of an item on the tablet and the phone: what operation 40 lists in `exports`, newest first as the Core answers them. The DOWNLOAD of a finished export is the web console's (the same rule as ... |
| `i18n.ts` | English copy of the `evidence` feature, mounted at `features.evidence.*` through `src/i18n/features.ts`. |
| `integrity-tab.tsx` | Hash & Integrity tab. Shows the DEMO package's integrity data: per-track SHA-256 (sealed vs stored), the manifest hash the signature covers, the Ed25519 signature (DEMO key), the DEMO device certificate and the audit ... |
| `interrupted-line.tsx` | The line of an interrupted recording on the evidence surfaces: "Sealed — recording was interrupted", with its cause where the surface has room. Drawn ONLY when the item itself says `interrupted === true` ... |
| `item-facts.ts` | What the Core server states about ONE evidence item beyond its sealed members. The companion of `item-v2.ts`, in the same defensive style: every reader takes `unknown`, never throws, and a member it cannot read is ... |
| `item-v2.test.ts` | Test: Blueprint row 92: the schema-v2 members of an evidence item, read defensively, and the rule of the item badge "Development source". |
| `item-v2.ts` | The schema-v2 members of an evidence item, read defensively. ONE reader for this app (the other client keeps its own copy of the same rules: one helper per app). |
| `live-evidence-archive.test.tsx` | Test: Site S3-1 — the archive dialog in LIVE mode, from the list's row kebab and from the detail's More menu, on the app's real Live source over the contract-checked fake transport. AC-C-63: the ... |
| `live-evidence-export.test.tsx` | Test: The export wizard in LIVE mode — sites S1-5 (the denied role's probe), S5-1 (the display hint), S1-6 (the export), and the "Verify source" step on the Core's verdict — each with its ... |
| `live-evidence-metadata-record.test.tsx` | Test: Tests "E2E-T-6: the Metadata tab of a Core-only item shows the Core record (web parity)". |
| `live-evidence-static.test.ts` | Test: Tests "Evidence takes the Core through the light Live API (CLG c, AC-C-53)". |
| `live-evidence-stored-verification.test.tsx` | Test: Tests "storedVerification / coreVerificationState (web parity)". |
| `live-evidence-strict.test.tsx` | Test: Under React's StrictMode (a development build) every Core request that the Evidence folder starts without a press is sent ONCE. The three requests that start without a press: the kebab ... |
| `live-evidence-verify-v2.test.tsx` | Test: Blueprint row 87: the v2 verify view in LIVE mode on the app's real Live source over the contract-checked fake transport (the answers of operation 41 are checked against the registry schema, so they carry the ... |
| `live-evidence-verify.test.tsx` | Test: Integrity verification in LIVE mode — the server's verdict is the record, on the app's real Live source over the contract-checked fake transport. AC-C-61: verification calls operation 41 ... |
| `live-integrity-pair-audio.test.tsx` | Test: Audit 2026-11-05 row 207: the Live integrity tab lists the pair audio files AUDIO-0N of a `/2.1` item apart from its camera files, each "in VIDEO-0N" (pair by number, "in" only when that camera file is in the item), ... |
| `live-integrity-tab.tsx` | Hash & Integrity tab in Live mode. **The Core server's verdict is the record.** Verify sends operation 41 `verifyEvidence` (the `verify` action of `useCoreActions()`, through `settle`, in `use-core-verify.ts`) and ... |
| `media-session-canary.test.tsx` | Test: Blueprint row 92: playback of the sealed files through the media session of operation 88 on the tablet and the phone, the transcript pane and the development badge — on the Live bed (the contract-checked fake ... |
| `media-session.ts` | The signed media session of operation 88 `createEvidenceMediaSession` on the tablet and the phone. **The path is a bearer value.** Whoever holds it (with the operator's session) can read the decrypted camera file ... |
| `media-tab.tsx` | Media tab: a horizontal strip of the camera posters the demo item bundles with a play overlay and the duration label, then the demo's microphone tracks. Each opens the Play sheet on that camera or microphone. Posters ... |
| `menu-item-text.tsx` | The title and, when there is one, the description of a kit `Menu.Item`, stacked in one column (closing-fix CF-M2, defect R-T-1). |
| `metadata-tab.tsx` | Metadata tab: the 13 §11.3 manifest fields as a `KeyValueList`, then the package's `manifest.json` in mono `Text selectable` inside a `ScrollShadow` (S19). |
| `pair-audio.tsx` | The audio of the camera-microphone pairs of ONE item, as the item states it. - **One row per sealed AUDIO-0N file**, in pair order: "AUDIO-02 · audio of Pair 2, in VIDEO-02" with the file's own stored-bytes hash ... |
| `play-sheet.test.tsx` | Test: Play sheet: three expo-video players over the bundled subset (the camera clip in a view, MIC 1 and MIC 2 as audio-only players with no view), one MIC audible at a time, the scrubber over the recorded duration with ... |
| `play-sheet.tsx` | Play sheet: kit `BottomSheet` with the camera clip (expo-video `VideoView`), a kit `Slider` scrubber over the RECORDED duration, Play/Pause, a camera switch (kit `Tabs`), the MIC 1 / MIC 2 switch (kit `TagGroup`, one ... |
| `playback-link.test.ts` | Test: Tests "the link between the sealed player and the transcript (JT-10)". |
| `playback-link.ts` | Playback position link between the player and the transcript (mobile copy of the web console's rule). |
| `sealed-format.tsx` | THE SEALED FORMAT OF AN ITEM on the evidence detail (fix wave L, G89c-04; ruling D229 (3); contract `delegation_progress/contract_wave_l.md` section 4). |
| `sealed-playback.test.ts` | Test: Blueprint row 92: the pure rules of sealed playback. The web console holds the same cases for its own copy. |
| `sealed-playback.ts` | Playback of the sealed camera files: the pure rules. No React, no clock, no request. |
| `sealed-player-i18n.ts` | The words of the sealed player that wave K M1 added (G94b-01), mounted under `features.evidence.player` (the `player` entry of `./i18n.ts` |
| `sealed-player.test.tsx` | Test: Tests "the indexed view, a renewal, a player error, the action bar and the legend". |
| `sealed-player.tsx` | Playback of the sealed camera files of a schema-v2 item on the tablet and the phone: one expo-video player per camera file, fed by a signed media session of operation 88 with the operator's `Authorization` header, ... |
| `selection-glow.tsx` | Re-export: the selection glow moved to `components/composed/selection-glow.tsx`. |
| `session-annotations.test.tsx` | Test: Tests "annotationsOf". |
| `session-annotations.tsx` | WHAT THE OPERATOR ADDED DURING THE RECORDING, ON THE ITEM. The markers and the notes the item carries (`EvidenceItem.markers` / `notes`, read BY NAME) appeared on no tab of the item. A marker's time is the control ... |
| `sheet-frame.tsx` | Kit BottomSheet frame for the Evidence sheets. Two device findings of step 79 apply here as well (F-79-2 and its SimContext note), so this feature keeps its own copy of the pattern (P6: another feature's files are ... |
| `sim-adapter.ts` | Local simulator adapter of the Evidence screens: records a Core verification outcome. |
| `transcript-access.test.tsx` | Test: The transcript pane, and what a page VIEW may ask of the Core. |
| `transcript-follows-revision.test.tsx` | Test: Tests "the pane follows transcript.revision of the slice item". |
| `transcript-model.ts` | The transcript pane: the pure rules. No React, no clock, no request. |
| `transcript-pane.tsx` | The transcript pane of a sealed item: states, segments, revise entry. |
| `transcript-revise-sheet.tsx` | The revise form of one transcript segment, in the kit's bottom sheet. The sealed original is shown read-only and is never edited: the form sends the corrected text of this one segment, the text the operator saw, and ... |
| `transcript-states.test.tsx` | Test: Fix pass F-M6: the transcript pane names the state the item's summary REPORTS - what the seal signed - and never assumes one. One case per state. |
| `transcript.ts` | The transcript of a sealed item and its revisions: operations 84, 85 and 86 in both data modes. |
| `use-clock-due.ts` | A wait on the store's clock. `onDue` runs once when the store's clock is `waitMs` past `startedAt`, out of the store's notify loop, and never after the component left or `startedAt` changed. Nothing runs while ... |
| `use-core-verify.ts` | One integrity verification on the Core server, for Live mode. - The ONE way in: the `verify` action of `useCoreActions()` through `settle`. |
| `use-evidence-data.ts` | Simulator reads for the Evidence screens. `useSim` compares results shallowly and the engine publishes a new state every tick, so each selector returns a primitive, a state-held object (kept by reference until it ... |
| `use-evidence-media-ref.ts` | Which bundled media belongs to an evidence item in Live mode. In Live mode the Core server decides whether the demo package this app bundles belongs to an item: operation 40 `getEvidence` answers `EvidenceMediaRef` ... |
| `use-evidence-playback.ts` | Evidence playback. Three expo-video players over the bundled 640 × 360 subset: - the camera clip (VIDEO-01 or VIDEO-02; no audio stream, DR-92-8), shown in a `VideoView`; - MIC 1 (AUDIO-01) and MIC 2 (AUDIO-02), ... |
| `use-scramble.ts` | Hash-verify scramble: the shown hashes scramble for 600 ms, revealing left to right, with at most 20 text updates, then settle on the real values. Reduced motion: the final text at once. |
| `verify-v2-plain-checked.test.ts` | Test: Tests "plainChecked of a file row (PE-WK-46)". |
| `verify-v2-report.tsx` | The schema-v2 result of one Verify run, as the Core server answered it. Top to bottom: FIRST the source line; the transcript state of the package and the interrupted mark, when the answer carries them; one row per ... |
| `verify-v2-signing-key.test.tsx` | Test: Fix pass F-M7, the mobile verify view (tablet and phone) |
| `verify-v2.test.tsx` | Test: Blueprint rows 87 and 92: the v2 verify view of the mobile app — the reader (`verify-v2.ts`) and the report it draws (`verify-v2-report.tsx`). |
| `verify-v2.ts` | The v2 answer of operation 41 `verifyEvidence`, read defensively. ONE reader for this app (the web console has its own copy of the same rules: one helper per app). |

## Main exports

- Screens: `EvidenceDetailScreen` (`evidence-detail-screen.tsx`), `EvidenceListScreen` (`evidence-list-screen.tsx`).
- Hooks: `useDetailIntent`, `useEvidenceStatusLabel`, `useSimulatedCoreLink`, `useExportJob`, `usePlaybackPosition`, `usePlaybackSeekRequests`, `useSheetPresence`, `useConfirmedOpen`, `useTranscript`, `useTranscriptRevisions`, `useTranscriptFollowsRevision`, `useReviseTranscript`, `useClockDue`, `useCoreVerify`, `useEvidenceItems`, `useEvidenceRows`, `useEvidenceItem`, `useSignedInOperator`, `useCanArchive`, `useOperatorNames`, `useEvidenceMediaRef`, `useEvidencePlayback`, `useScramble`.
- Components: `ArchiveDialog`, `AudioSourceBand`, `DevelopmentChip`, `ItemDevelopmentBadge`, `VerifiedSourceBadge`, `DemonstrationChip`, `EvidenceStatusChip`, `EvidenceSubjectChip`, `EvidenceDetail`, `ExportJobStatus`, `ExportSheet`, `FinishedExports`, `IntegrityTab`, `VerdictLine`, `Section`, `HashText`, `TrackHashRow`, `CheckLine`, `LifecycleStrip`, `CustodyLog`, `InterruptedLine`, `NeverSealedLine`, `LiveIntegrityTab`, `MediaTab`, `MenuItemText`, `MetadataTab`, `PairAudio`, `PlaySheet`, `SealedFormat`, `SealedPlayer`, `SessionAnnotations`, `SheetFrame`, `TranscriptPane`, `TranscriptReviseSheet`, `VerifyV2Report`.

## Core operations and state

- Replica state read through `useSim` selectors (`@dems/shared/sim` or local): `selectCan`, `selectEvidence`, `selectEvidenceById`, `selectOperator`.
- Core actions sent (`useCoreActions()` and `settle` of `@dems/shared/live`, or a local actions hook): `archiveEvidence`, `exportEvidence`, `verify`.
- Operations called directly on the Live client (`useMobileLive()?.client.call`): `createEvidenceMediaSession` (`media-session.ts`), `createTranscriptRevision` (`transcript.ts`), `getEvidence` (`use-evidence-media-ref.ts`), `getEvidenceExportJob` (`export-job.ts`), `getTranscript` (`transcript.ts`), `listTranscriptRevisions` (`transcript.ts`).

Core origin: this folder never builds a Core URL. Every call goes through the runtime, whose Live client, socket and media transport are built in `src/runtime/sim-adapters.ts` from `coreOriginOf(getCoreAddress())` of `src/runtime/core-address.ts` (D263, D265).

## Tests

28 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Shared test beds and fixtures of this folder are in [`testing/`](testing/) (no production code).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

From `decisions.md` of the 2026-11-05 team update audit:

- D171: row 206: verify-v2 notices and the D5 fixture.
- D184: row 205: `EVIDENCE_TRACK_ORDER` of 8 tracks.
- D201: row 208: verify-v2 audio findings.
- D209: row 207: `item-v2.ts` pair audio and `pair-audio.tsx`.
