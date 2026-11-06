---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-11
agent: coder-execution (documentation errata pass, fix wave K)
scope: documents only - five specifications under masterplan/, the repository README.md, and this note; no code, no test, no script, no lane, no git write
status: needs-review
---

# 147 - Documentation errata for fix wave K (PE-WK-01 .. PE-WK-35)

Documents only. Edited: `masterplan/03_api_contract.md`, `05_capture_architecture_spec.md`, `06_evidence_package_spec.md`,
`07_transcript_spec.md`, `08_client_ux_spec.md`, and the repository `README.md`. Created: this note. One line was appended to
`delegation_progress/file_claims.md`. Nothing under `apps/*`, `packages/*`, `scripts/`, any test, `decisions/decisions.md`,
`status_tasks.md`, the tracking table of `02_plan.md`, `99_implementation_report.md`, `delegation_progress/*` (other than
that one line) or notes 136 / 137 was edited. No command of the product, no suite, no lane was run; no git write (read-only
`git status` / `git diff` only).

Convention continued from notes 136 and 137: numbered errata in place, each naming its decision and its implementation note,
one line in the file's errata index, a mention in the file's `last_updated`. The last id used before this pass was `PE-WI-38`;
this pass opens `PE-WK-01` for wave K. Ids are unique across the specs. No earlier sentence was deleted: a changed table row
(C3 rows 85 and 86, evidence field 36 and V-11) keeps its text and gains the erratum mark; the `last_updated` lines were
prepended to. `07_transcript_spec.md` had no errata index; a small one was added for its single erratum. The README holds
no erratum ids by convention; its block cites them.

Sources read: `delegation_progress/contract_wave_k.md` (S2, S1, KR and Z1 - Z1 exists and was read; see open item 1),
`implementation/139` .. `144` (and a look at `146`), the wave K docs-owner lines of `delegation_progress/file_requests.md`
(00:52:00Z+7 wave K S2; 18:00:10Z wave K S1), decisions D220 .. D224, notes 136 and 137 for the convention, and the code named
in the "Source" column. Every `file:line` below was read in the tree before it was written; where a statement rests on a
driver's note and not on a line read by this pass, the open items say which.

## 1. Errata

### `masterplan/03_api_contract.md` (14)

| Erratum | Document + section | What changed | Source |
|---|---|---|---|
| PE-WK-01 | 03 §2.4 Transcript (84-86); §2.3 row 85; §4 reason table (new row) | Op 85 refuses a `from` that is not the segment's current text: `422 INVALID_INPUT`, `details {in, member, reason: REVISION_FROM_NOT_CURRENT_TEXT, segmentIndex, currentRevision}`; judged after the head check (a stale base stays `409`); nothing signed, no row, no audit row; stored revisions read for `to` only | D221 (2), D224; `modules/transcripts/routes.ts:152`, `:162`, `:173-187`, `:494`, `:513-518`; `packages/shared/src/api/evidence.ts:402`; note 140 row G81b-01 |
| PE-WK-02 | 03 §2.3 rows 85 / 86; §2.4 Transcript | `reason?` on the answer of op 85 and on every entry of op 86 (the author's note, as stored and signed); absent = not stated; access of the revision | D224; `routes.ts:414-416`, `:564`; `evidence.ts:443`; contract KR §2; note 144 item 6 |
| PE-WK-03 | 03 §2.4 Sealing progress (83) | `etaMs` is the measured remaining time of the running step; only CLOSE_TRACKS and FINALIZE_HASHES report one, after a twentieth; `null` for a failed step, no running step, and always the transcript step; `0` when all done; client draws no time-left line for `null` | D220, D224; `sealing-host/progress.ts:48-54`; `sealing/pipeline/pipeline.ts:247`, `:292`, `:531`, `:633-634`, `:936`; contract S1 §5 |
| PE-WK-04 | 03 §2.5 (STT 90-92) | `pendingForNextSession` true only while a session that is not SEALED holds an older snapshot; a change after the seal answers `NOW` | D221 (3), D224; `modules/stt-config/statements.ts:66-77`; note 140 row G81b-05 |
| PE-WK-05 | 03 §3, op 40 (after PE-WH-03) | `EvidenceItem.transcriptModel?` (shape of op 41's member; server backend = name + three nulls + `report`); on op 40, op 39 rows and the `evidence` slice; absent cases; read from the signed manifest | D221 (3), D224; `api/state-slices.ts:712-722`, `:847`; `evidence-facts/sealed-facts.ts:62-72`; `engine/sealed-facts-doors.ts:141-143`; `evidence-facts/index.ts:114` |
| PE-WK-06 | 03 §3, ops 40 / 42 | `exportDestinationDefault?` (op 40; `Case file transfer` real, `... (simulated)` simulated) with the client rule; "empty destination" = the Core's default true to its mode; `archiveOnCore?` on the 202 of op 42 (true = a job writes an archive, false = recorded only, absent = not stated); passed by the Live source | D223, D224; `evidence.ts:164`; `modules/evidence/index.ts:178-180`, `:240`, `:321`; `export-request.ts:57-68`; `sim/evidence-actions.ts:50`, `:56`, `:228-231`; `api/core-api.ts:582`; `live/source/bindings.ts:264`, `:313-317` |
| PE-WK-07 | 03 §3, op 41 | `files[].plainChecked?`: present and `false` when V-05 did not run for the file; never written as `true`; per file, finer than V-05's status; older Core: fall back to the state of V-05 | D222 (6), D224; `evidence-verify/index.ts:221-230`; `evidence.ts:278`; contract S1 §7, KR §1 |
| PE-WK-08 | 03 §5.3 (new row) | `EVIDENCE_VERIFIED` / `_VERIFY_FAILED` carry `details.operationId`; the failed row of a sealed package names `failedFragments` (`<trackId>:<seq>`, comma-joined, at most 8) and `failedFragmentCount`; the device comes by the central rule | D216 (2), D222 (3), D224; `sim/session-machine.ts:1618-1622`, `:1639`, `:1659-1660`; `evidence-verify/index.ts:103`, `:364`; `sealing-host/index.ts:733-738`; `sim/evidence-actions.ts:121`; `evidence.ts:308` |
| PE-WK-09 | 03 §5.3 (new row) | The central rule: every audit row a hosted action writes for the acting operator carries the sending paired device in `deviceId`; the row types the note 140 sweep names; the stated exceptions (rows with a device of their own, e.g. `DEVICE_COMMAND`; actor-less engine rows; web console; in-app simulator) | D216 (2), D222 (3), D224; `sim/events.ts:255`, `:274-281`, `:297`; `engine/actor-scope.ts:27-41`; `sim/maintenance.ts:233`; note 140 §2 |
| PE-WK-10 | 03 §5.3 (new row) | The `ACCESS_DENIED` row of a refused demo reset / scenario load carries the sending device (web: `null`); the lineage row and the `SCENARIO_LOADED` row of a reset that ran carry none (limit) | D216 (2), D224; `modules/demo/host.ts:91-100`, `reset.ts:137`, `:169`, `:332`; `modules/demo/index.ts:133-135`, `:187`, `:220`; `db/reset/kept-tables.ts:185-189`; note 144 item 4 |
| PE-WK-11 | 03 §6 (after PE-WI-21); §5.3 row `FAULT_CLEARED` | The life of the restart fault: active only while its session is open as that faulted session (FAULT / RECOVERY / FINALIZING); ONE `FAULT_CLEARED` when the session is sealed or closed; a start heals a stuck one; `restartFaultEnded: true` in the start line; known limit on the row's `sessionId` | D220, D224; `engine/restart-fault.ts:52-75`; `engine/host.ts:1048`, `:1259`, `:1314`; `engine/rehydrate.ts:381-387`; `sim/faults.ts:524`, `:529-541`; note 139 §2 |
| PE-WK-12 | 03 §6 (after PE-WK-11) | Timeline item of a capture fault that does not end the session carries `params.reason`; the sentence is client-drawn from it; one row per interruption | D220, D224; `sim/faults.ts:429-436`; `sim/capture-session.ts:179`; web `timeline-panel.tsx:84`, `session-monitor/sim-adapter.ts:147`, `:166`; mobile `session-live.math.ts:202` |
| PE-WK-13 | 03 §5.4 (new paragraph) | The notice `STREAM_PROFILE_DIFFERS`: WARNING / SYSTEM alert, written not active, once per session, no audit row, raised when the seal reads the session; client rule for a label of the recording's picture | D222 (2), D224; `engine/sealing-notice-doors.ts:40`, `:160-183`; `sealing-host/index.ts:274-290`; contract S1 §3, KR §4; note 144 decision 3 |
| PE-WK-35 | 03 §2.4 Media (88) | Op 88 gains the optional request / answer name `seekIndex` (indexed view: one `sidx` box from the signed fragment table; sealed package, export, Verify unchanged). CONTRACT NAMED; PRODUCER NOT LIVE when written | D224 (1); contract Z1 §1; `evidence.ts:507-512`, `:533-538`, `:545-557`; `media-stream/seek-index.ts:1-50` (header only) |

### `masterplan/05_capture_architecture_spec.md` (2)

| Erratum | Document + section | What changed | Source |
|---|---|---|---|
| PE-WK-14 | 05 §A.8.1 (end) | THE SEAL RIG: `scripts/lane/lane.sh seal-rig <lane> unsealable\|blocked\|release\|status`; FAKE sources only (binds to one session; `LOCAL_DEVICE` / production never touched); refused outside `REAL_DEVELOPMENT` (script exit 64, launcher `DEV_SEAL_RIG_IN_PRODUCTION`, sealing host `DEV_SEAL_RIG_NOT_DEVELOPMENT`); off by default; what each word does and what release does | D220, D224; `scripts/lane/lane.sh:22`, `:83-108`, `:124`, `:200-231`, `:261`, `:334`; `apps/core-server/test/support/lane-seal-rig.ts:9-35`, `:60-61`, `:99-100`, `:140-152`; `sealing-host/index.ts:139-152`, `:259-265`, `:626`; `test/static/lane-camera-stub.test.ts:159` |
| PE-WK-15 | 05 §A.6.4 (end, before §A.6.5) | At a development start the selector line of a camera whose device is adapter kind `FAKE` takes the profile its generated adapter declares (`H264_720P30`), once, `revision` + 1, no audit row, no migration; never touches other kinds, `capture_devices`, simulated / production Cores, the seed | D222 (2), D224; ruling of 2026-10-11; `capture/fence/fake-profile.ts:32-46`; `capture/fence/boot.ts:260`, `:275`; `capture/fence/generated-sources.ts:47`; `capture/adapters/local/camera-helper-args.ts:30`; note 144 item 2 |

### `masterplan/06_evidence_package_spec.md` (4)

| Erratum | Document + section | What changed | Source |
|---|---|---|---|
| PE-WK-16 | 06 §B.4 field 36 (row + paragraph) | `tracks[].profile` states the STREAM of the camera file (size from the init segment, rate measured over the first <= 8 fragments, vocabulary `H264_720P30` / `H264_1280X960P30`, no rate when none measured); configured profile only where the file states no size; no new field; earlier packages valid; FAKE development camera lines take the adapter's profile (-> PE-WK-15) | D222 (2), D224; `sealing-host/session-reader.ts:180-187`, `:218-236`, `:381-382`, `:405`; `capture/fragments.ts:558`, `:590`; `capture-session/facts.ts:289`; `sealing-host/index.ts:435` |
| PE-WK-17 | 06 new §H.8; pointer in §D row V-11 | A shortened revision list is not caught by the sealed package's own offline checks (`revisionHead` is 0 for ever; no end inside the folder); the Core holds the count against its database (`REVISION_COUNT_MISMATCH`); an export catches it as `X-04 ENTRY_HASH_MISMATCH` | D222 (4), D223, D224; `evidence-verify/verify.ts:660-662`; `evidence-verify/index.ts:344-349`; `sealing-host/index.ts:715`; `sealing/finalize-transcript/handler.ts:258`, `:288`, `:318`; `evidence-export/receiver-verify.ts:267-270`; request line 00:52:00Z+7 (A) |
| PE-WK-18 | 06 §H.8 | The receiver's command names an added file `X-04 UNEXPECTED_ENTRY` (export) or `V-14 UNEXPECTED_FILE` (package); `EXPORT_FOLDER_UNEXPECTED_FILE` is only the op 41 notice | D185 (a), D224; `receiver-verify.ts:265`; `evidence-verify/verify.ts:760-761`, `:769`, `:1098`; `evidence-verify/types.ts:390-410`; request line (C) |
| PE-WK-19 | 06 §H.8 | The download link is not single use inside its 60 s for the same sign-in session; each download is its own audit row; a new link each time op 87 answers a COMPLETE job | D178, D223 (3), D224; `evidence-export/download-token.ts:25-26`; `evidence-export/service.ts:50-54`, `:91`, `:190-195`, `:229`; `api/capture.ts:107` |

### `masterplan/07_transcript_spec.md` (1)

| Erratum | Document + section | What changed | Source |
|---|---|---|---|
| PE-WK-20 | 07 §D.2 row "Durable-part case" (and a new errata index) | The sealed document of an interrupted recording lists `intervals_incomplete` in `qa_flags` when an interval has no end; the end is NOT written into the document; a stopped recording is byte for byte as before; the runner's older use of the same flag noted | D221 (3), D224; `apps/transcriber/src/pipeline/assembly.ts:59`, `:156`; `pipeline/document.ts:161-167`; `pipeline/runner.ts:303-310`; `core-server/src/transcription/index.ts:458-460`; `transcription/session-run.ts:136-139`, `:349`; request line 18:00:10Z (2) |

### `masterplan/08_client_ux_spec.md` (14)

| Erratum | Document + section | What changed | Source |
|---|---|---|---|
| PE-WK-21 | 08 §4.5 (flow 3) | No time-left line without a measured `etaMs` (web and tablet / phone); while an interrupted recording is still being sealed the screens say so ("The recording was interrupted ... sealing" / "Recording was interrupted — sealing what was recorded"), "Sealed —" only at SEALED; the passing FAULT state is not hidden (D224 (5)) | D220, D224; web `finalization-modal.tsx:221`, `i18n-web.ts:142-143`; mobile `session-finalizing-screen.tsx:364`, `session-finalizing/i18n.ts:21`; notes 141 §2.7, 143 |
| PE-WK-22 | 08 §6.6 (flow 5) | Web player: a file with no sign of life is asked about after 4 s; a file that does not authenticate is stopped, the alert names the Core's file and fragment, the stopped tile and "plays on" sentences; the other file leads; not proven in a real browser | D221, D223, D224; `sealed-player.tsx:54`, `:278`, `:306`, `:476`, `:661-678`; `i18n-web.ts:173-182`; `shared/i18n/en/evidence.ts:482`; `media-stream/service.ts:39-52`, `:395-405`; note 141 §2.1 |
| PE-WK-23 | 08 §6.6 (flow 5) | The integrity probe is a range request the Core records: more than one audit row for one tampered file on the web; the tablet's four-row stop (G94b-10) and the once-per-fragment proposal are open | D223 (2), D224; `core-web .../media-session.ts:206-209`, `:265`; `media-stream/service.ts:338-353`, `:397-405`; notes 141 D-6 / D-7, 143 §6; requests 17:51:51Z, 18:20:30Z |
| PE-WK-24 | 08 §6.6 (flow 5) | Tablet / phone scrubber disabled with "A position cannot be chosen: the Core server sent this recording without a seek index. Play and Pause work."; SUPERSEDED when the indexed view lands (D224 (1)) | D224 (1); `mobile .../sealed-playback.ts:109-117`, `sealed-player.tsx:510`, `:526`, `sealed-player-i18n.ts:12`, `media-session.ts:107`; note 142 §1; contract Z1 |
| PE-WK-25 | 08 §6.6 (flow 5) | Tablet / phone export follows the web wizard's rule: Export disabled with "Export requires the Supervisor role." where the Core refused; opening the wizard sends nothing; explicit "Request authorization" press stays (D224 (4)); case-file first, Core default pre-selected; list refresh; archive sentence | D223 (1), D224 (4); `evidence-detail.tsx:213`, `:426-433`, `:500-503`; `export-sheet.tsx:38-59`, `:639-662`; `export-job-status.tsx:71-74`; `evidence/i18n.ts:276-284`; note 143 §1, decision 1 |
| PE-WK-26 | 08 §6.6 (flow 5) / §6.2 step 6 | Verify file row: "decrypted bytes Not run" (not FAIL) for `plainChecked === false`, else V-05 SKIPPED | D222 (6), D224; `core-web .../verify-v2.ts:471`; `mobile .../verify-v2.ts:466`; contract KR §1 |
| PE-WK-27 | 08 §6.6 (flow 5) | Web player before Verify: item's development mark on tiles, legend from the item, the first interval at 0:00 (same-second tolerance), the end sentence of an interrupted recording; tablet legend / end sentence not live | D224; `sealed-player.tsx:581`, `:599`, `:681-684`; `sealed-playback.ts:84-92`; `i18n-web.ts:182`; note 143 (G94b-07, -09) |
| PE-WK-28 | 08 §7.4 (flow 6) | Tablet / phone: every operator-dependent cached read carries the operator in its key; dropped at an operator change or sign-out; web not examined | D221 (3), D224; `mobile lib/operator-query-scope.tsx:26`, `:49`; `providers/app-providers.tsx:117`; `use-evidence-media-ref.ts:55`; note 143 §2 |
| PE-WK-29 | 08 §7.5 (flow 6) | Revision "Reason" line from the revision's own `reason` (web fallback audit row, else "Reason: not reported"); case-scope refusal "You are not assigned to the case of this item ..." on the tablet / phone | D221 (3), D224; web `transcript-model.ts:137-150`, `transcript-pane.tsx:340-341`, `i18n-web.ts:154-155`; mobile `transcript-pane.tsx:101`, `:144`, `:348`, `transcript-model.ts:170` |
| PE-WK-30 | 08 §7.6 (flow 6) | "Transcript model" block on web and tablet / phone; server backend = name + the Core's report only; absent = nothing | D221 (3), D224, D160; web `transcript-pane.tsx:270-312`, `i18n-web.ts:147-153`; mobile `transcript-pane.tsx:240`, `evidence/i18n.ts:266-272` |
| PE-WK-31 | 08 §8.5 (flow 7) | Connecting states on tablet / phone Home: header chip CONNECTING, mic tiles without meters, "Connecting cameras…" on the no-preview tile, fixed slot for the Session Live clock | D220, D224; `home-header.tsx:62-63`, `:83-85`; `device-tiles.tsx:114`, `:171-185`; `camera-preview.tsx:118-130`; `session-live-screen.tsx:699`, `:769`; `shared/i18n/en/common.ts:930`, `:934` |
| PE-WK-32 | 08 §8.5 (flow 7) | The sweep of simulator constants on a Core in its own capture, page by page (web) and on tablet / phone Storage / About / Session Live; the key a page names; configured-profile label; appliance model left as is (D224 (3)) | D220, D222 (1) (2), D224 (3); `core-web lib/own-capture.ts:75`, `:100`; `session-monitor/real-seal-facts.ts:17`; `session-monitor/sim-adapter.ts:128`; `mobile storage-kpis.tsx:36-47`, `about-section.tsx:25`, `:41`, `live-feed.tsx:209-214`; note 141 §3 table |
| PE-WK-33 | 08 §8.5 (flow 7) | Reduced motion = no pane re-flow animation (tablet / phone); the reduced layout transition left a grown pane with its old height and dead taps | D224; `mobile layout/pane-layout.tsx:20-33`, `:107-117`; `motion/builders.ts:252-272`; note 142 §3 |
| PE-WK-34 | 08 §8.5 (flow 7) | The mount-warning limit: B9 counts the app's ERROR lines; the library warning `synchronouslyUpdateUIProps failed` is a documented limit with its cause (svg layout event x Reanimated registry) and the listed cure A / B / C | D224 (2); `NativeProxy.kt:248-262`; `VirtualView.java:608-620`; `ReanimatedModuleProxy.cpp:815-824`; `UpdatesRegistry.cpp:165-175`; `ReanimatedMountHook.cpp:48-53`; note 142 §4 |

### `README.md` (1 block, no erratum id)

| Place | What changed | Source |
|---|---|---|
| New block "Fix wave K: additions and corrections", before "Known limits" | Gate-state line (not yet gate-verified); the seal rig as a FOURTH command of `lane.sh` (four words, FAKE sources only, refused outside development capture - exit 64, off by default - exit 69 without the stub, switch file, what release does); short bullets: the restart fault ends, the manifest states the recorded stream, the limits of the sealed package and the export (shortened list, receiver names, link not single use), the tablet player cannot seek yet | `scripts/lane/lane.sh:22`, `:83-108`, `:200-231`, `:261`, `:334`; PE-WK-11, -14, -15, -16 .. -19, -24, -35 |

### Errata count per document

| Document | Errata | Ids |
|---|--:|---|
| 03_api_contract.md | 14 | PE-WK-01 .. 13, 35 |
| 05_capture_architecture_spec.md | 2 | PE-WK-14, 15 |
| 06_evidence_package_spec.md | 4 | PE-WK-16 .. 19 |
| 07_transcript_spec.md | 1 | PE-WK-20 |
| 08_client_ux_spec.md | 14 | PE-WK-21 .. 34 |
| README.md | 0 (1 block) | cites PE-WK-11, 14 .. 19, 24, 35 |
| Total | 35 | PE-WK-01 .. PE-WK-35 |

## 2. Open items

| # | Item | Why open |
|--:|---|---|
| 1 | Z1 (the indexed view, op 88 `seekIndex`): the contract section of `contract_wave_k.md` exists and the request / answer schemas and examples are in `packages/shared/src/api/evidence.ts`, but the producer (`media-stream/service.ts`, `source.ts`, `token.ts`, new `seek-index.ts`) was still being changed, `contract_wave_k.md` carries no "consistent" line for Z1 and `implementation/145_*` did not exist when this pass ended. PE-WK-35 states the CONTRACT only; PE-WK-24 stays "superseded when the indexed view lands". After Z1 reports: replace PE-WK-24's state, give PE-WK-35 its built behaviour (the refusal reasons of `SeekIndexRefusal`, the lengths of the view), and add a pointer to capture spec §D.4 (streaming playback) | Not verifiable by reading finished code; documenting behaviour no one has run would be a guess |
| 2 | Nothing in this pass is gate-verified. Every client erratum and the rig say "not yet gate-verified": re-gates 70 and 75 have not been re-checked, the targeted re-check of wave K has not run (D224) | The documents cannot hold a PASS that was not given |
| 3 | PE-WK-32 (sweep): the page-by-page sentences of the web (Security & Audit, Devices, Dashboard, Storage, Network & Time, Monitor, System, header checklist) are taken from note 141 section 3, the driver's own table; this pass re-read the rule (`own-capture.ts:75`, `:100`), the seal-dialog reader, `real-seal-facts`, the web profile-label reader, and the mobile Storage / About / Session Live lines, not every page string. The "model" blocks left unchanged are the driver's list under D224 (3) | Re-reading ten pages of web strings was not done; a wording drift on one page would not be seen here |
| 4 | PE-WK-09 (central device rule): the rule and its code were read; the list of row types and exceptions is note 140 section 2's sweep. `DEVICE_COMMAND` was confirmed to set its own device (`sim/maintenance.ts:233`); the other row types were not each traced to a writer | Same reason as 3 |
| 5 | PE-WK-22 / -23 / -27: the strings, handlers and the route's behaviour were read; what a real browser does with a cut stream is not proven (note 141's own statement). G94b-10 (the tablet's four WARNING rows) is a read-in-code hypothesis of M2, not verified on a device | Re-check on lane 2 |
| 6 | PE-WK-28: only the tablet / phone keys were swept by the driver; the web console's query keys were not examined | Not part of any wave K note |
| 7 | G89b-07 (two names of the installation: the stored device record vs the configured identity), the `session.input.profileId` value, the reset lineage row's device, the recovery-screen flash: next task by D224 (5). PE-WK-10 and PE-WK-13 state the lineage / `profileId` limits; G89b-07 and the flash are named in PE-WK-21 only (flash); G89b-07 has no erratum | No behaviour changed |
| 8 | G94b-13 (export stepper badges 2-6 draw no check glyph on the device) and G94b-09's tablet half: M1's items, hypotheses only in note 143 and the request lines; not documented as behaviour | Nothing was built or proven |
| 9 | Line citations were read between about 18:50Z and 19:20Z on 2026-10-11 while Z1 and the web closing pass (note 146) were editing `packages/shared/src/api/evidence.ts`, `media-stream/*` and `apps/core-web/src/features/evidence/*`. The `evidence.ts` and the web player lines were re-read at the end of the pass and held; a later edit by those drivers can move them | Files in flight |
| 10 | Not edited, by the task's rule: `decisions/decisions.md`, `status_tasks.md`, the tracking table of `02_plan.md`, `99_implementation_report.md`, `file_requests.md` (the two wave K docs-owner lines, 00:52:00Z+7 and 18:00:10Z, are not marked done), notes 136 / 137, the older index rows of C3 for `PE-FX-02` | Controller's files |
| 11 | The README has no sentence the new errata contradict except the count in "`scripts/lane/lane.sh`: three options" (it counts start / reset options; the rig is a fourth command, said in the new block); Known limit 2 ("no operator action to give up such a seal") was not re-examined against wave F's way-out and is left as it stands | Outside the wave K sources |

## 3. Checks

No validation command applies to markdown; none was run. Checked by reading and counting: every id `PE-WK-01 .. PE-WK-35` appears
once in an errata index of its file (the new index of `07_transcript_spec.md` included) and once as an erratum paragraph, a table
row of §H.8 (PE-WK-17 .. 19) or a table cell (C3 §4 row for the 422 reason, C3 rows 85 / 86, evidence field 36 and V-11,
C3 §5.3 rows); the lines removed from the working-tree diff by this pass are the rows 85 / 86 of C3, field 36 and V-11 of the
evidence spec and five `last_updated` lines, each reappearing inside an added line. No emoji in the six files (a range scan).
Totals of the registry are unchanged and each C3 erratum says so: 97 operations / 36 GET / 61 POST / 67 audit types, 30 slices,
schema 6 / `dbc-7`. Every erratum names the decision and this note.

---
*Generated: 2026-10-11*
