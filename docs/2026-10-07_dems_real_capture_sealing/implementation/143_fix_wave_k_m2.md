---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-11
agent: coder-execution (fix wave K, driver M2 - apps/mobile, NO device)
source_plan: docs/2026-10-07_dems_real_capture_sealing/delegation_progress/fix_brief_wave_k.md
status: needs-review
---

# 143 - Fix wave K, driver M2 (mobile, no device)

Tree: `57b80a9` + the wave K working tree. No git write, no device, no emulator, no Gradle, no lane.
Paths below are under `apps/mobile/src/` unless they start with another root. "red" = how the test
was seen to fail without the fix (a mutation run, a moved pin of an existing test, or the control
case kept in the same file - rule 5 of the brief).

Status **needs-review**, for three items only (section 4): G81b-09 (the member did not appear),
G94b-13 and G94b-10 (cause not in a file of M2; requests filed). Everything else is built and tested.

## 1. Findings

| Finding | Cause (file:line at the start of the wave) | Change | Test (file - case) | Status |
|---|---|---|---|---|
| **G81b-02** two `ACCESS_DENIED` rows after an operator change | operation 40's answer cached under `['core-server','evidence-media', id]` with no operator (`features/evidence/use-evidence-media-ref.ts:50-52`), used while it refetches (`:71`); so the next operator's page view asked ops 84 / 86 with the previous operator's `access` | NEW `lib/operator-query-scope.tsx`: `operatorScope(id)` is the LAST element of every per-operator key; `OperatorQueryScope` (`:49`, mounted once in `providers/app-providers.tsx:117`) removes every operator-scoped query when the operator changes or signs out. Keys: section 2 | `features/evidence/wave-k-m2-operator-export.test.tsx` - "an operator change…", "sign-out…", "every per-operator key…"; CONTROL "the same operator…" | done. red: mutation run (scope made constant, clearing removed) -> 3 of 16 failed, restored |
| **G81b-07** "Your role cannot read this transcript." on a case-scope refusal | `features/evidence/transcript-pane.tsx` drew `evidence.transcript.notPermitted` for every 403, and drew it BESIDE "You are not permitted…" when operation 40 had already refused | `transcript-model.ts:170` `deniedReadKindOf(details.reason)`: `EVIDENCE_CASE_SCOPE` -> "You are not assigned to the case of this item, so its transcript is not shown."; no reason -> the role sentence; another reason -> the neutral sentence. A caller operation 40 refused gets ONE sentence (`transcript-pane.tsx:101`) | same file - "a case-scope refusal": 403 with the reason, CONTROL 403 without | done |
| **G89b-09 / D223 (1)** a press that only produces a refusal | `features/evidence/export-sheet.tsx:171-216`: opening the wizard sent the probe `{reason:'',destination:''}` by itself after 400 ms | (a) `evidence-detail.tsx:213` `exportRefused` = `access.export === false`: the Export control is disabled, a caption above the action bar reads "Export requires the Supervisor role."; no press reaches the Core. (b) the wizard (`export-sheet.tsx:232`, `RequiredRole` `:639`): opening sends NOTHING; a denied caller sees "Exporting evidence requires the Supervisor role. / Nothing has been sent to the Core server." Where the Core already refused (`access.export: false`) there is no send control at all; where only the role hint says so, the explicit "Request authorization" press sends the audited attempt (the web wizard's own step). `access.export: true` wins over the hint. The wizard waits for operation 40's answer | same file - "the export control" (3 cases incl. CONTROL). Moved by delta: `evidence-detail.test.tsx`, `live-evidence-export.test.tsx` (3 cases), `live-evidence-strict.test.tsx` - each now asserts 0 requests / 0 `EXPORT_DENIED` rows BEFORE the explicit press | done. The five pinned cases asserted the automatic probe (1 request / 1 row after `EXPORT_AUTH_MS` with no press); they were moved together with the fix and were NOT run red first - the control is the new assertion of 0 requests / 0 rows before the press in each |
| **G94b-05** "Exported" beside "No finished export…" | nothing read operation 40 again when the job ended | `export-job-status.tsx:71`: when the job is COMPLETE / FAILED the item's own query (`evidenceMediaRefKey(job.evidenceId, operator)`) is invalidated once | same file - "the job reaches COMPLETE…" (the list holds `EXP-000041` when the sheet is closed) | done |
| **G94b-06** "The export is stored on the Core" on a simulated item (contract S2 §3) | `export-job-status.tsx` drew `evidence.exportJob.onCore` for every COMPLETE job | `export-job-model.ts` `ExportJob.archiveOnCore` = the COMPLETE job states `archive {bytes, sha256}`; `answeredArchiveOnCoreOf` reads `archiveOnCore` of the 202 BY NAME. `onCore` only when the job states its archive and the 202 did not say `false`; else "Demonstration: no archive is written." (`archiveOnCore: false`) or "The Core server states no archive for this export." | same file - "G94b-06…", "the job model…"; `wave-k-m2-item-facts.test.tsx` imports `EXPORT_ACCEPTED_NO_ARCHIVE_EXAMPLE` | done, with seam S-1 (section 5) |
| **G94b-12** default destination differs (contract S2 §2) | mobile had two options, first = USB (`evidence-model.ts:506`) | `EXPORT_DESTINATIONS = caseFile, usb, network` (the web's order); `initialExportDestination` (`:524`): the option whose RECORDED text equals `exportDestinationDefault` of operation 40 (`item-facts.ts` `MEMBER.detail.exportDestinationDefault`); none stated -> the first; one stated that this app has no option for -> NOTHING pre-selected, Next disabled | "the default destination…" (both files; imports `EVIDENCE_EXPORT_DESTINATION_DEFAULT_EXAMPLE`, reads the `productSealed` example unmodified). Pin moved: `wave-h-c2-exports-playback.test.tsx` (the request now names "Case file transfer") | done |
| **G75c-07** RECORDING chip / meters / "Not reachable" while connecting | `dashboard/home-header.tsx:76-83` drew `common.systemState.RECORDING`; `dashboard/device-tiles.tsx` always mounted `MicMeter`; `devices/camera-preview.tsx` `NoPreviewTile` drew the roster word of an `online: false` camera | header chip CONNECTING in the neutral tone (`home-header.tsx:63`); microphone tile: `MicConnecting` (`device-tiles.tsx:172`) - no meter, no dBFS, no Active / Standby; no-preview tile: "Connecting cameras…" for a camera with no named cause and not "On" (`camera-preview.tsx:125`) | `features/dashboard/wave-k-m2-connecting-home.test.tsx` - three cases, each with its durable CONTROL | done |
| **G81b-08** clock half covered | `session-live/session-live-screen.tsx:656-663`: `RecTimer` returns null while connecting and mounts later; on the tablet the card kept the connecting height (cause in the layout engine NOT established - no device) | the clock's place is a slot of fixed height `MONITOR_TIMER_SLOT_HEIGHT` = the `display` line height, present from the first layout (`:666`) | `features/session-live/wave-k-m2-clock-slot.test.tsx` - the layout rule: same slot height connecting / recording, timer inside it; CONTROL phone | done as a rule; the pixels are a re-drive |
| **G75c-10** passing states at an interruption | (a) "Sealed — recording was interrupted" at 0 % is CLIENT-DRAWN: `session-finalizing/interrupted-seal.tsx` used the sealed title while the seal runs. (b) the recovery screen for a moment is NOT client-drawn: the Core's own `FAULT` state, routed by `runtime/session-route-sync.tsx` ("any -> FAULT") | (a) `InterruptedSealNotice sealing` (`:50`): "Recording was interrupted — sealing what was recorded" until SEALED. (b) not changed (section 4, decision 3) | same file - "G75c-10…" + CONTROL | (a) done, (b) not changed |
| **G81b-06** transcript model on no client (contract S2 §1) | no reader of `transcriptModel` | `evidence/item-v2.ts:189` `readTranscriptModel` (member name `TRANSCRIPT_MODEL_MEMBER`), `ItemV2.transcriptModel`; `transcript-pane.tsx:240` `TranscriptModelLines`: local = name, "Version (declared by the installation)", quantisation, file SHA-256; server = name + the Core's own `report` sentence (D160), no version / hash line; absent = nothing | `features/evidence/wave-k-m2-item-facts.test.tsx` - 4 cases, imports `EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE` and `…_SERVER_EXAMPLE` | done |
| **G81b-05** "the session that is open keeps…" with no session open | server fact (S2: `pendingForNextSession` true only while a session not yet ended holds an older snapshot; name unchanged) | none needed: `transcription/stt-status-section.tsx:101` draws the note only from `view.pendingForNextSession`, read by name (`stt-status-model.ts:47`) | existing `transcription/stt-status-section.test.tsx` (true / false), run green | done by the server; re-drive |
| **G81b-09 (b)** revision reason not shown | operation 86 answers no reason (`TranscriptRevisionSchema` is strict without it) | client ready: `transcript-model.ts` `REVISION_REASON_MEMBER = 'reason'`, `readRevisionReason`; the list draws "Reason: …" when the answer states one | `wave-k-m2-item-facts.test.tsx` - "the revision list" + CONTROL | **needs-review**: the member did not appear in 20 min (request 17:37Z to S2) |
| **G75c-05** ETA "about 1678 s left" (contract S1 §5) | server (the wait bound as `etaMs`); the client also promised "Estimating the time left…" for `null` | `session-finalizing/session-finalizing-screen.tsx:365`: a time-left line ONLY for `etaMs !== null`; null draws no line | pin moved: `finalizing-forward-only.test.tsx` "no ETA from the Core: no time-left line…" + CONTROL | done |
| **G75c-06** timeline words every capture fault "interrupted" (contract S1 §6) | tablet rows drew the row's stored text | `session-live/session-live.math.ts:202` `captureFaultRowDetail`: `captureFaultSentence(params.reason, null)` from the row's OWN `params.reason`; the no-reason sentence only without one | `wave-k-m2-clock-slot.test.tsx` - "G75c-06…" (2 cases) | done |
| **G89b-06** "decrypted bytes FAIL" beside V-05 "Not run" (contract S1 §7) | `verify-v2-report.tsx:203` worded the three parts from `storedOk / plainOk / chainOk` alone | `verify-v2.ts:466` `v2FilePartOutcome`: a failed part whose check (V-04 / V-05 / V-06) of the SAME result is SKIPPED reads "Not run" | `wave-k-m2-item-facts.test.tsx` "the file row…" (3); pin moved in `live-evidence-verify-v2.test.tsx` - the RECORDED tamper answer now reads "decrypted bytes Not run" (this existing test failed with the fix in = the red) | done |
| **G89b-01 mobile half** (contract S1 §3) "1080p • 25 fps" beside a real recording | `session-live/live-feed.tsx:209-213` draws the simulated camera's configured format | the chip is not drawn beside a session of the Core's own capture (`:214`, `useOwnCapture`) | `wave-k-m2-clock-slot.test.tsx` - phone + tablet, SIMULATED pinned | done |
| **G94b-07** development mark | marks are drawn from a VERIFY RESULT only (`sealed-player.tsx:419`, `audio-source-band.tsx:60`) | band legend: `item-v2.ts` keeps `audioSourceIntervals[].sourceClass`; `audio-source-band.tsx:35` `legendDevelopmentClass` + optional prop `itemIntervals`. The ONE line that passes the prop is in `sealed-player.tsx` (M1): request filed. Camera tiles: the item states no per-file class - no truthful mark before Verify (section 4, decision 4) | `wave-k-m2-item-facts.test.tsx` "the band legend" | built in M2's files; **not live until M1's line** |
| **G94b-10** four WARNING rows | in the player: `onPlayerError` renews once and re-opens at the same place, and / or the native player's own retries of a failed load (read, not verified) | none by M2; requests to M1 and to the owner of `core-server/src/media-stream` | - | **needs-review** (M1 / Core) |
| **G94b-13** stepper badges | the wizard hands over six `done` statuses; the glyph is not painted on the device | none by M2 (cause not in jest; hypothesis in the request to M1) | CONTROL `wave-k-m2-item-facts.test.tsx` "the stepper at Complete" | **needs-review** (M1) |
| **G94b-09** interrupted recording ends early in the player without a word | the sealed player (M1) | none | - | not M2's file; said here so it is not lost |
| Phone layout (gates 70, 94) | not provable on lane 1 | tests only | `features/evidence/wave-k-m2-phone-layout.test.tsx` (8 states of the sealed player in `phonePortrait` + the window CONTROL); `features/capture-selector/wave-k-m2-phone-discovery.test.tsx` (M4-DISC-P, M4-DISC-EMPTY-P, M4-CONN-PTR-P: the sentence, 0 text inputs, 0 password fields) | done |

## 2. Sweep of the query keys (item 1)

The app holds SIX cached reads (`grep queryKey` over `apps/mobile/src`, no test files). Module-level
maps were read too: none holds an answer of the Core.

| Read | Operation | Depends on the operator? | Key now |
|---|---|---|---|
| item answer (`access`, `exports`, media) | 40 | yes: role + case scope | `['core-server','evidence-media', evidenceId, 'operator:<id>']` (`use-evidence-media-ref.ts:55`) |
| transcript document | 84 | yes: case scope | `['core-server','evidence-transcript', mode, evidenceId, 'operator:<id>']` (`transcript.ts:122`) |
| transcript revisions | 86 | yes: case scope | `['core-server','evidence-transcript-revisions', mode, evidenceId, 'operator:<id>']` |
| export job | 87 | yes: role (`download`), case scope | `['core-server','evidence-export-job', jobId, 'operator:<id>']` (`export-job.ts:41`) |
| STT configuration | 90 | read needs a signed-in operator | `['stt-config', 'core-server' or 'simulated', 'operator:<id>']` (`use-stt-config.ts:54`) |
| health | health | no | unchanged (`HEALTH_QUERY_KEY`) |

Every invalidation site passes the operator (`transcript.ts`, `transcript-pane.tsx`, `export-job-status.tsx`).

## 3. Real-capture facts sweep (item 5) - every sentence checked, with its source member

Core stating `security.platformNotReported`; "ok" = already true at the wave's start.

| Screen | Sentence / figure | Source member | Result |
|---|---|---|---|
| Home chips | "Security: Not reported" | `security.platformNotReported` (`dashboard/home-model.ts:397`; a posture that names a fault keeps its words, D217 (7)) | ok, pinned |
| Home chips | "Time: Host system clock" | `time.hostClock` | ok, pinned |
| Home header | CONNECTING / RECORDING | `session.captureDurable` | fixed (G75c-07) |
| Home tiles | microphone state, level | `captureDevices`, `audio.inputs`, `session.captureDurable` | fixed (G75c-07) |
| Devices / previews | "No preview", device name, Reachable / Not reachable / Connecting cameras… | `captureDevices.devices[]`, `alerts`, `session.captureDurable` | fixed (G75c-07) |
| Devices | no TPM / GNSS / attestation entry is listed by the mobile Devices screen (`grep -i 'tpm|attest|gnss' features/devices`: 0 hits); `firmware` appears only in the simulated camera's detail (`device-detail.tsx:462`) | dataset | checked; not reached for a registered device (`registered-device-detail.tsx` has no such row) |
| Security | the mobile app has no Security page; its only readers of the `security` slice are the Home chip and About | - | checked |
| Network & Time | "Host system clock" in header, System Time, Time Synchronization; no RTC holdover toast | `time.hostClock` (`network-time/*`, pass J) | ok (gate 75c PASS); not changed |
| Settings > About | "TPM model / firmware: Not reported" | `security.platformNotReported` (`settings/about-section.tsx:41`) | ok; NOW TESTED on phone and tablet (`settings/wave-k-m2-about-facts.test.tsx`). It is the fifth row of the identity card: the re-check scrolls to `settings-about-tpm` |
| Settings > About | serial, BSP, provisioning record, release | `device.identity.*`, under the card's own "DEMO" chip and "synthetic" description | true as labelled; not changed |
| Storage | "WRITE SPEED 2.3 MB/s · Recording · 8.2 GB/h", "Est. remaining … at 8.2 GB/h" | simulator constants (`storage.writeBytesPerSec`, `RATE_GB_PER_HOUR`) | **fixed**: both read "—" / "Not reported" (`storage/storage-kpis.tsx:39`); the session size stays (the Core's count) |
| Session Live | "1080p • 25 fps" | simulated camera | **fixed** (G89b-01 mobile half) |
| Session Live / Summary | "TIME Host system clock" | `time.hostClock` | ok |
| Signing key | the only key ids drawn are the item's / verify result's own `signature.keyId` (`evidence/*`, `session-summary/sealed-members.tsx`); no `DEMO-KEY-…` constant exists in `apps/mobile/src` (`grep 'KEY-'`: test kit only) | `evidence[].signature.keyId`, op 41 `signingKey` | ok |

SIMULATED unchanged, pinned: Storage figures, Home chips ("Secure", "Synchronized"), About TPM model,
the live feed's format chip - each in the test of its row.

## 4. Decisions for the controller

1. **Export on tablet / phone.** No request leaves on opening the wizard, in both data modes. Where
   the Core has refused the caller there is no send control. Where the Core stated nothing the explicit
   "Request authorization" press stays (the web's design that D223 (1) says stands; EVT-26 stays
   reachable). If the ruling is to be read as "no refusal-only press at all", remove that one button
   (`RequiredRole`, `coreRefused` always true).
2. **Destinations.** The mobile wizard gained the case-file option and it is first. A Core default
   that matches no option pre-selects nothing.
3. **G75c-10 (b)**, the recovery screen for a moment: it is the Core's `FAULT` state on its way to
   `FINALIZING`, not a client state. Hiding it needs a Core fact "this fault is being sealed by the
   Core" (none exists) or a delay in the router; neither was built.
4. **G94b-07 camera tiles**: the item states `developmentSources` for the whole item only. A per-file
   mark before Verify needs an additive member on `files[]`, or the ruling that the header's mark is
   the player's mark until Verify.
5. **G89b-01**: the format chip is removed beside a real recording rather than relabelled
   "configured"; the session-level notice `STREAM_PROFILE_DIFFERS` is not read by the mobile app (no
   mobile surface states a profile of a sealed item).
6. **"Estimating the time left…"** is no longer drawn (S1's client rule: null = no line).

## 5. Seams

- **S-1** `archiveOnCore` of operation 42 reaches the wizard only if the Live source passes it through
  (`packages/shared/src/live/source/bindings.ts` `evidenceExported` copies `exportId` / `jobId` only -
  not a file of M2 or of a wave K driver). Until then the job's own `archive` member decides, which is
  sufficient for G94b-06.
- **S-2** `reason` of a revision: one constant (`REVISION_REASON_MEMBER`).
- **S-3** `itemIntervals` on `AudioSourceBand`: one line in `sealed-player.tsx`.

## 6. Request lines filed (`delegation_progress/file_requests.md`)

17:37:07Z to S2 (revision `reason` on op 85 / 86). 17:51:51Z x4: to M1 (G94b-10 cause in the player),
to the controller / owner of `media-stream` (one row per session + file + fragment), to M1 (G94b-07
one line + camera tiles), to M1 (G94b-13 hypothesis).

## 7. Commands run and results

| What | Command | Result |
|---|---|---|
| New tests | `npm test -w @dems/mobile -- <the seven wave-k-m2 files>` (each once after its last change) | operator-export 16, item-facts 14, phone-layout 9, connecting-home 5, clock-slot 9, about-facts 2, phone-discovery 3: all passed |
| Folders whose components changed | `npm test -w @dems/mobile -- src/features/evidence src/features/dashboard src/features/storage src/features/transcription src/features/session-finalizing src/providers src/lib src/features/devices` | 73 suites: 69 passed, 4 failed (5 tests) = four pins of M2 (moved, re-run green) + one of M1 (below) |
| Second run of the failed files + static guards + session-live, settings, camera-search | one run | 50 suites, 404 tests: 403 passed, **1 failed, not M2's**: `live-evidence-static.test.ts` "reads the folder" lists M1's new `features/evidence/sealed-player-i18n.ts` |
| Typecheck | `npx tsc --noEmit -p apps/mobile` | M2's files clean; 3 errors in M1's in-flight `wave-k-m1-seek.test.tsx` |
| Lint | `npm run lint -w @dems/mobile` | M2's files clean; 1 error in M1's in-flight `sealed-player.tsx:238`, the 1 known warning (`runtime/log.test.ts`) |
| Mutation proof (G81b-02) | scope made constant + clearing removed, same test file | 3 failed; file restored byte for byte |

## 8. Checks for the test runner

| Command | Lock | Expected |
|---|---|---|
| `npm test -w @dems/mobile` (whole suite, after M1 has landed) | none (no db, no port) | 0 failed; the folder pin of `live-evidence-static.test.ts` is M1's to move |
| `npm run typecheck -w @dems/mobile` and `npm run lint -w @dems/mobile` | none | 0 errors once M1's two in-flight files are finished |
| `npm test -w @dems/shared -- <the examples' own tests>` | none | S2's (the examples M2 imports) |

## 9. Re-drive list for the re-check (device)

1. Tablet, lane 2: investigator opens a REAL item with a transcript, signs out; technician signs in
   and opens the SAME item first: 0 new `ACCESS_DENIED` rows; one sentence in the transcript pane.
2. Tablet / phone, technician or investigator on a REAL item: Export is disabled with "Export
   requires the Supervisor role."; 0 `EXPORT_DENIED` rows from pressing. From the LIST's row menu the
   wizard states the role and sends nothing.
3. Tablet, supervisor: export a clean item; "Case file transfer" is pre-selected; after Complete close
   the sheet: "Finished exports" lists it at once. Lane 1 demo item: no "stored on the Core".
4. Tablet while "Connecting cameras…": Home header chip CONNECTING, no meters on the Home microphone
   tiles, feed tile "Connecting cameras…"; Session Live clock fully visible above AUDIO MONITOR.
5. Worker kill during a recording: the Finalizing notice reads "Recording was interrupted — sealing…"
   until SEALED; the timeline row reads "The capture worker process was killed."; no time-left line
   during "Finalize transcript".
6. Item with a transcript: "Transcript model" lines (after M1's restart of lane 2 - S2's note).
7. Tamper demo: file row "Stored bytes FAIL · decrypted bytes Not run · fragment chain FAIL".
8. Storage and Settings > About (scroll to the TPM row) on lane 2; the same two on lane 1 unchanged.
9. Phone on lane 2 (D223 (4)): the sealed player's states and the camera search, as the two phone
   test files list them.

## 10. Files

NEW: `lib/operator-query-scope.tsx`; tests `features/evidence/wave-k-m2-{operator-export,item-facts,phone-layout}.test.tsx`,
`features/dashboard/wave-k-m2-connecting-home.test.tsx`, `features/session-live/wave-k-m2-clock-slot.test.tsx`,
`features/settings/wave-k-m2-about-facts.test.tsx`, `features/capture-selector/wave-k-m2-phone-discovery.test.tsx`.

CHANGED: `providers/app-providers.tsx`; `features/evidence/{use-evidence-media-ref.ts, transcript.ts, transcript-model.ts, transcript-pane.tsx, export-job.ts, export-job-model.ts, export-job-status.tsx, export-sheet.tsx, evidence-model.ts, item-facts.ts, item-v2.ts, audio-source-band.tsx, verify-v2.ts, verify-v2-report.tsx, i18n.ts}`;
`features/evidence/evidence-detail.tsx` (the Export control block only); `features/transcription/use-stt-config.ts`;
`features/dashboard/{home-header.tsx, device-tiles.tsx}`; `features/devices/camera-preview.tsx`;
`features/session-live/{session-live-screen.tsx, session-live.math.ts, live-feed.tsx}`;
`features/session-finalizing/{interrupted-seal.tsx, session-finalizing-screen.tsx, i18n.ts}`; `features/storage/storage-kpis.tsx`.

PINS MOVED BY DELTA: `features/evidence/{evidence-detail.test.tsx, live-evidence-export.test.tsx, live-evidence-strict.test.tsx, wave-h-c2-exports-playback.test.tsx, live-evidence-static.test.ts, export-job.test.ts, item-v2.test.ts, live-evidence-verify-v2.test.tsx}`; `features/session-finalizing/finalizing-forward-only.test.tsx`.

NOT touched: `sealed-player.tsx`, `sealed-playback.ts`, `media-session.ts`, `play-sheet.tsx`, `session-summary/**`, `components/**`, `runtime/**`, `motion/**`, `packages/shared`, `apps/core-server`, `apps/core-web`.

---
*Generated: 2026-10-11 01:15 WIB*
