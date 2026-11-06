---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-11
agent: coder-execution (documentation pass of batch N)
scope: documents only - four specifications under masterplan/, the repository README.md, and this note; no code, no test, no script, no package.json, no lane, no git write
tree: commit 713d83f plus the uncommitted working tree of batch N (the code driver works in apps/, packages/, package.json, scripts/test/ in parallel)
status: needs-review
---

# 165 - Batch N, documents: errata for fix waves L and M, the strategy errata, the README refresh

Documents only. Edited: `masterplan/03_api_contract.md`, `05_capture_architecture_spec.md`, `08_client_ux_spec.md`,
`10_test_strategy.md`, and the repository `README.md`. Created: this note. One line was appended to
`delegation_progress/file_claims.md`. NOT edited: `06_evidence_package_spec.md` and `07_transcript_spec.md` (nothing in
section 4 of the verification names a change of theirs - see open item 9), `decisions/decisions.md`, `status_tasks.md`,
`delegation_progress_report.md`, the tracking table of `02_plan.md`, `99_implementation_report.md`, anything under `apps/`,
`packages/`, `scripts/`. No command of the product, no suite, no lane was run; no git write (read-only `git status`,
`git diff`, `git log`).

Convention continued from notes 147, 148 and 152: numbered errata in place, each naming its decision and its implementation
note, one row in the file's errata index, a mention prepended to the file's `last_updated`. The last id used before this
pass was `PE-WK-47`. This pass opens **`PE-WL-01` .. `PE-WL-15`** for fix wave L and **`PE-WM-01` .. `PE-WM-11`** for fix
wave M; ids are unique across the specs. No earlier sentence was deleted: a superseded sentence keeps its text and gains a
bracketed mark (PE-WK-45, its index row and its paragraph). The test strategy has no errata index and no `last_updated`;
its six errata are a new section N with the series **`PE-BN-01` .. `PE-BN-06`** (batch N; they belong to no wave), a
bracketed pointer on each row or heading they correct, and one `*Last Updated*` line at the end, as that file does. The
README holds no erratum ids of its own; its blocks cite them.

Sources read: `verification/01_verification.md` sections 2, 4, 7, 8; `test/17_row100_final_test_report.md` sections 0, A,
D.4 and the findings table; `verification/02_security.md` in full; `gateway_check/22_final_code_review.md` (R101-01 .. -09,
-23); `delegation_progress/contract_wave_l.md`, `contract_wave_m.md`, `contract_batch_n.md` (section 1, "FINAL");
`implementation/153` .. `161` (the findings and per-finding sections); decisions D237, D239, D240, D241; notes 147 and 152
for the convention; and the code named in the "Source" column. Every `file:line` below was read in the tree before it was
written. Where a statement rests on a driver's note or a gate report and not on a line read by this pass, the open items
say which.

## 1. Errata

### `masterplan/03_api_contract.md` (12)

| Erratum | Document + section | What changed | Source |
|---|---|---|---|
| PE-WL-01 | 03 §5.4 Alerts (after PE-WK-13) | The life of the UNSEALABLE notice: active through later sessions and restarts until a holder of `EVIDENCE_REVIEW` acknowledges it through op 70; that resolves it and writes ONE `FAULT_CLEARED` (session of the notice, operator, sending device, `details { reason, cause, alertId, operationId }`), no timeline event; another role's acknowledgement leaves it active and writes NO audit row - the known gap that needs a 68th type; client rule `openUnsealableNoticesOf` / `alertBlocksRecording` / `canResolveUnsealable` | D228 (2), D231, D237; `packages/shared/src/sim/seal-unsealable.ts:102`, `:123-127`, `:130`, `:133`; `sim/faults.ts:575-600`; `api/alerts.ts:89`, `:101`; contract L section 1, contract M "M-S 4"; note 153 rows 1a-1c |
| PE-WL-02 | 03 §2.4 (after PE-WI-19) | Op 33 as the retry of a BLOCKED seal: `SEAL_RETRY_PERMISSION` = `SESSION_START` (investigator, supervisor; technician 403); `SEAL_AUTOMATIC_RETRIES = 3`, runs at 0 / +5 / +35 / +155 s; then the Core waits - no self-retry when the cause heals | D228 (1), D231; `sim/seal-blocked.ts:44`, `:47`, `:50`; `apps/core-server/src/sealing/pipeline/way-out.ts:61`; contract L section 2; note 153 row 2 |
| PE-WL-03 | 03 §2.4 Sealing progress (after PE-WK-03) | Op 83 `resumed` true only for a seal a START of the Core ran again (narrows PE-WI-06); 404 for a session that is not open, so for an ended one | D228, D231; `sealing-host/index.ts:650`, `:697`; `sealing-host/progress.ts:18-25`, `:66`; `api/sessions.ts:233`; `modules/sealing/index.ts:56`; contract L section 3 |
| PE-WL-04 | 03 §3 (after PE-WK-07) | `evidence.files[].profile?` (field 36 as signed; item, ops 39 / 40) and `evidence.streamProfileNotice?` (op 40 only), read from the newest 100 alerts: absent is not "equal" | D229 (3), D231; `api/state-slices.ts:802-806`, `:851-862`; `evidence-facts/index.ts:115`, `:218-219`; `sim/constants.ts:50`; `api/evidence.ts:1011`, `:1020`; contract L section 4 |
| PE-WL-05 | 03 §2.6 (after PE-WI-08) | Camera-search rows carry `details.sessionId` only while a session is open; the boot line `CAPTURE_CONFIG_LOADED ... locked` uses the rule of op 76 | D231; `modules/capture-discovery/search.ts:76`, `index.ts:148-149`; `modules/capture-config/store.ts:58-61`; contract L section 6 |
| PE-WL-06 | 03 §5.2 (after PE-WK-36) | The media route's cut: `206`, the bytes before the fragment, the socket destroyed; `409 FRAGMENT_NOT_AUTHENTIC` at the byte of the cut; the exported example `MEDIA_FRAGMENT_NOT_AUTHENTIC_EXAMPLE` and `_REASON`; what the Core cannot do | D230b, D231, D236; `api/evidence.ts:1037-1044`; `modules/media-stream/__tests__/routes.test.ts:608-614`; contract L section 7; note 153 section 2 |
| PE-WL-07 | 03 §5.4 (after PE-WL-01) | The sentences of a retried / blocked seal (cause without the conclusion while retried; `sealStoppedSentence`; `SEAL_RETRY_HOW_SENTENCE` in the alert); `SEAL_BLOCKED_MESSAGE_MAX` 400 -> 600; `SEAL_UNSEALABLE_PLAIN_SENTENCE` | D228 (1), D231; `way-out.ts:92`, `:408`, `:121-141`; `sim/seal-blocked.ts:62`, `:65`, `:72`; `engine/sealing-notice-doors.ts:123`; `sim/seal-unsealable.ts:46`; contract L sections 2, 3 and its L-Z table |
| PE-WM-01 | 03 §5.4 (after PE-WL-07) | What a client receives when a generated source fails its pre-check: the device, the check row, the notice / alert, the audit rows; the other cases of the start rule; after a later reachable run 0 banners and the alert resolved with no audit row; V98-08 stated as open | D232, D237; contract M "M-S 1"; `capture-notices/__tests__/notices.test.ts:410`, `:469`; `sim/capture-notices.ts:29-33`; `api/state-slices.ts:216` (by the verification's cite) |
| PE-WM-02 | 03 §5.2 (after PE-WL-06) | ONE WARNING row per stop also for range requests cut at the same moment; the key and the 60 s window unchanged | D236, D237; `media-stream/service.ts:377-409`; `modules/media-stream/__tests__/indexed-view.test.ts:281`; contract M "M-S 2" |
| PE-WM-03 | 03 §5.4 (after PE-WM-01) | The reachability probe is asked at every use: an adopted camera passes its pre-check without a restart; V98-13 stated as open at `713d83f` | D237; `capture-notices/index.ts:152-173`; `capture-notices/precheck.ts:123-125`; note 161; contract M "MS2" |
| PE-WM-04 | 03 §6 (after PE-WK-12) | `CAPTURE_SUPERVISOR_FAULT_OVER`: one info log line with `faultOfSessionId`, not a fault, no state, no row | D234, D237; `capture/index.ts:135`; contract M "M-S 3"; note 158 section 3 |
| PE-WM-05 | 03 §3 (after PE-WL-04) | Op 31 `cancelSession` takes no body: "Cancel session" sends no reason | D237; `api/sessions.ts:353-372`; note 160 decision 1 |

### `masterplan/05_capture_architecture_spec.md` (1)

| Erratum | Document + section | What changed | Source |
|---|---|---|---|
| PE-WM-06 | 05 §A.8.1 (after PE-WK-14, the seal rig) | THE SOURCE RIG: `scripts/lane/lane.sh source-rig <lane> unreachable <CAM-NN\|MIC-NN> \| release \| status`; six rules, each read in the code - generated sources only (cameras and microphones), up to four devices, refused outside `REAL_DEVELOPMENT` three times, off by default and only with the camera stub, live on a running lane, does not end an open source; its effect; what was driven and what is by test | D232, D237; `scripts/lane/lane.sh:27-28`, `:120-147`, `:241-276`, `:337`, `:348`, `:422`; `apps/core-server/test/support/lane-source-rig.ts:57-62`, `:132`, `:136`, `:160-161`; `capture/fence/generated-sources.ts:40-48`, `:60`; `capture/fence/index.ts:451-454`; contract M "M-S 1" |

### `masterplan/08_client_ux_spec.md` (13)

| Erratum | Document + section | What changed | Source |
|---|---|---|---|
| PE-WL-08 | 08 §6.6 (after PE-WK-46) | Web: the integrity probe is small bounded range requests (2 MiB, 4 s for headers, idle 1.5 s; bounds 12 requests / 16 MiB / 15 s; three requests measured); silence alone is never an integrity failure | D230b, D231, D236; `apps/core-web/src/features/evidence/media-session.ts:212-221`; note 154 section 2.1 |
| PE-WL-09 | 08 §4.5 (after PE-WK-21) | "Retry sealing" on the Monitor banner and in the seal dialog; who sees the button; the two sentences every role reads; the devices have no retry control | D228 (1), D231; `features/session-monitor/seal-retry.tsx:28`, `:35`; `status-banner.tsx:230`; `seal-attention.tsx:60`; `i18n-web.ts:243-251`; mobile `features/session-finalizing/i18n.ts:95`; notes 154 section 2.2, 155, 156 section 2 |
| PE-WL-10 | 08 §4.5 | The open notice: pill / chip "OPEN NOTICE", ring "OPEN NOTICE • RECORDING NOT BLOCKED", the bell row with "Acknowledge and close" for the supervisor, never another session's fault, the terminal dialog "Recording not sealed" | D228 (2), D231; web `components/shell/secure-pill.tsx:103-105`, `features/dashboard/system-ring-panel.tsx:55`, `components/shell/notifications-bell.tsx:123`, `features/session-monitor/model.ts:540`, `finalization-modal.tsx:194`; mobile `features/dashboard/home-header.tsx:88`, `:252-287`, `features/session-finalizing/i18n.ts:32-44` |
| PE-WL-11 | 08 §5 (after PE-WI-11) | No "Start recovery" for a fault whose payload says the Core is sealing: tablet / phone (wave L) and web (wave M) | D231, D234, D237; mobile `features/session-recovery/recovery.model.ts:54`, `session-recovery-screen.tsx:132`; web `features/session-monitor/model.ts:183`, `status-banner.tsx:57-58`, `:151`; notes 155 "G75d-08", 159 section 2.2 |
| PE-WL-12 | 08 §8.5 (after PE-WK-34) | THE ONE RULE for real-capture screens and the "Synthetic demo values" chip; the web blocks under the chip; the device rule `detailFactsOf`; the structural debt R101-01 / -02 named | D228, D229, D231, D241; web `i18n-web.ts:190-197`, `lib/own-capture.ts:75-80`, `components/synthetic-values-chip.tsx`; mobile `features/devices/devices-model.ts:144`, `device-status-chip.tsx:73`; notes 154 sections 2.4, 3; 156 section 3 |
| PE-WL-13 | 08 §8f (after PE-WI-15) | "Not checked" for a source at rest on both clients; "Live" only while recording; generated sources named "Generated test source"; microphone rows named from the selector in force on the devices (wave M) | D231, D232, D237; web `features/devices/source-state.ts:13-14`, `own-core-words.ts:23`, `:38`, `:48`, `i18n-web.ts:229-230`; shared `i18n/en/common.ts:993`; mobile `features/devices/registered-devices-model.ts:127`, `:140`, `use-devices-data.ts:43`, `:79`; notes 154, 155 "G70c-02", 160 "G70d-02" |
| PE-WL-14 | 08 §8f | Sources and the audio pair named from the selector IN FORCE; what is not under the rule; web Session New meters and the session id | D227, D231, D234, D237; `packages/shared/src/sim/selector-in-force.ts:47`, `:63`, `:68`, `:73`, `:136`; web `features/session-new/devices-step.tsx:303-312`, `index.tsx:115`; notes 155 "G70c-01", 156 section 1, 157, 159 section 2.3 |
| PE-WL-15 | 08 §6.6 | Tablet / phone player: the interrupted-end sentence is built (PE-WK-45's last sentence marked superseded), 0:00 inside the first interval, one press resumes after the background, the short item | D230b, D231; mobile `features/evidence/sealed-player-i18n.ts:18`, `sealed-player.tsx:449`, `:611`, `sealed-playback.ts:78`; note 155 "Player" |
| PE-WM-07 | 08 §6.6 | Web tamper stop: the stall watch rests on data received, never on the clock; a file with no data when the leading file ends is asked at once; R101-04 named | D236, D237; web `features/evidence/sealed-player.tsx:54`, `:103`, `:406`; note 159 section 2.1 |
| PE-WM-08 | 08 §4.5 | Web pill / ring: "OPEN NOTICE • RECORDING", "RECORDING • NO FAULT REPORTED", "SEALING RETRIED"; the blocked dialog states the cause once; R101-08 named | D234, D237; web `features/dashboard/system-ring-panel.tsx:58`, `:66-67`, `:79`; `components/shell/secure-pill.tsx:106-109`; `lib/seal-attention.ts:39`, `:55`; `i18n-web.ts:290-303`; note 159 section 2.2 |
| PE-WM-09 | 08 §8e (after the last paragraph of §8e.6) | Session New on tablet and phone: header "Cancel session", the three-choice dialog, the stale form cleared; "Choose another source" NOT offered at a pre-check (D237); KNOWN DEFECT GM-01 | D232, D237, D239; mobile `features/session-new/session-new-header.tsx:48`, `session-new-model.ts:42`, `i18n.ts:87-89`, `navigation/back-guard.tsx:129-147`, `i18n/en.mobile.ts:47-52`; note 160; report 14 |
| PE-WM-10 | 08 §6.6 | Tablet: the item page's tab strip is pinned outside the scroll view | D235, D237; mobile `features/evidence/evidence-detail.tsx:536`; note 160 "G89d-03" |
| PE-WM-11 | 08 §8.5 | Web tamper tile: "n of the m items of this Core have no verify run in these rows."; KNOWN DEFECT GM-02 (the newest 1,000 audit rows) | D235, D237, D239; web `features/security-audit/core-verify-rows.ts:59`, `tamper-panel.tsx:44`, `i18n-web.ts:317-319`; `sim/constants.ts:48`; report 14 item 7 |

### `masterplan/10_test_strategy.md` (6, new section N)

| Erratum | Document + section | What changed | Source |
|---|---|---|---|
| PE-BN-01 | 10 §N; pointer on the heading of §I | Per-test ceilings: 50 remain in four mobile files (the record said 58); the rule stands for new tests; none removed | T100-04; `test/17` section D.4; `apps/mobile/jest.config.js:10`; D240 |
| PE-BN-02 | 10 §N; pointers on §B.4 and row X-MAX-1 | `--maxWorkers`: the regression of record uses 4 for the core-server unit project, 2 for db and mobile, the runner's default in five workspaces; recorded, not justified | T100-05; `test/17` Part A; `scripts/test/regression.sh` |
| PE-BN-03 | 10 §N; pointers on four rows | `M4-UX-VOC-1`, `M4-UX-A11Y-1` recorded PASS at the first M4 gate without a named run; `M4-PIN-2`, `M7-FF-UNIT` cited by no test; 49 of 157 ids cited only in comments | T100-01; `gateway_check/09_m4_gate.md:85`; `implementation/68_r9_web_devices.md:101`, `69_r9_mobile_devices.md:79` |
| PE-BN-04 | 10 §N; pointer on the row | `M4-LOCAL-MIC-1`: the only recorded run FAILED on rate (42,666 against 48,000); NOT PROVEN | T100-08; D128, D136 |
| PE-BN-05 | 10 §N | The per-wave test files no longer exist: the map old name -> new home is `test/14_consolidation_*.md` (five reports), closed by `test/15` | D233, D238, D240 |
| PE-BN-06 | 10 §N; pointer on row `M9-RG-*` | The regression scripts and what `npm test` does not run; their state (not yet run through the scripts) | R101-05, T100-03; D241; `delegation_progress/contract_batch_n.md` section 1 "FINAL"; root `package.json:53-58`; `scripts/test/regression.sh`, `kill-matrix.sh` |

### Errata count per document

| Document | Errata | Ids |
|---|--:|---|
| 03_api_contract.md | 12 | PE-WL-01 .. 07, PE-WM-01 .. 05 |
| 05_capture_architecture_spec.md | 1 | PE-WM-06 |
| 06_evidence_package_spec.md | 0 | - |
| 07_transcript_spec.md | 0 | - |
| 08_client_ux_spec.md | 13 | PE-WL-08 .. 15, PE-WM-07 .. 11 |
| 10_test_strategy.md | 6 | PE-BN-01 .. 06 |
| README.md | 0 (blocks; cites the ids) | - |
| Total | 32 | PE-WL-01 .. 15, PE-WM-01 .. 11, PE-BN-01 .. 06 |

### The 17 built changes of verification section 4.3, each with its erratum

| # | Built change | Erratum |
|--:|---|---|
| 1 | Source rig | PE-WM-06 (05); PE-WM-01 (03); README |
| 2 | "Retry sealing" on web dialog and Monitor; who may press | PE-WL-09 |
| 3 | Op 33 as the retry of a BLOCKED seal; no self-retry; op 83 `resumed` | PE-WL-02, PE-WL-03 |
| 4 | UNSEALABLE notice until a holder of `EVIDENCE_REVIEW` acknowledges | PE-WL-01, PE-WL-10 |
| 5 | "OPEN NOTICE" pill / ring, "OPEN NOTICE • RECORDING" | PE-WL-10, PE-WM-08 |
| 6 | `files[].profile`, `streamProfileNotice` | PE-WL-04 |
| 7 | "Cancel session" in the device header, the third choice, "Choose another source" not offered | PE-WM-09, PE-WM-05 |
| 8 | "Not checked" for a source at rest; one status wording on Devices | PE-WL-13 |
| 9 | The selector in force and the audio pair in force | PE-WL-14 |
| 10 | `SEAL_BLOCKED_MESSAGE_MAX` 400 -> 600 | PE-WL-07 |
| 11 | Boot `locked`; search rows name a session only while one is open | PE-WL-05 |
| 12 | Tamper stop: stall watch on data received; three bounded probe requests | PE-WM-07, PE-WL-08 |
| 13 | One WARNING row per stop under concurrent requests; the 60 s key | PE-WM-02 |
| 14 | Tamper tile: items without a verify run | PE-WM-11 |
| 15 | "SEALING RETRIED" pill / ring | PE-WM-08 |
| 16 | The reachability probe asked at every use | PE-WM-03 |
| 17 | Generated sources named as generated; Session New meters from the selector | PE-WL-13, PE-WL-14 |

## 2. README sections changed

| Place | What changed |
|---|---|
| Head of "Real capture, sealing and transcript" | The section describes commit `713d83f`, corrected by three blocks; "Read this first" rewritten: done ON THIS MAC WITH FAKE DEVICES; a real speech engine HAS been through a sealed session (D211, `11b_m6_regate.md`), no real voice; the old correction line replaced by the rule "the later block is right" |
| NEW "State at commit `713d83f`" (after the head) | Built and proven on fake devices (table with the gate per line); the milestone verdicts M3 .. M8, wave M and the final chain - none a plain PASS, each with its report name; NOT met: `M8-CMP-1`; not proven (user-attended local device, class C, biometrics skipped, server speech backend, tests-only lists, notification B remainders, tamper remainders, power loss / parked cells); the user's open decisions (FFmpeg licence, quarantine policy, SEC35-26 open - not accepted, S99-02, S99-03, key escrow, data clean-up, three smaller); structural debt R101-01 / -02 / -04 in three sentences |
| "Privacy, personal data and custody" | "accepted risk of this phase" -> "OPEN and it is the user's decision" with the reason; one new bullet: the confirmation before the Mac's camera or microphone is a rule of the clients, not of the Core (S99-02) |
| "Fix waves H and I" | "Gate state, said once" rewritten; four marks replaced by the covering report (speech microphone `11b`; the blocked seal `10e`; the receiver's command `13b` / `13c` / `13d`; the real-capture words `09d` / report 14, with the correction to "Not checked"); three kept and narrowed, each with its reason (the installation identity: the `NOT_CONFIGURED` values were read at `12b`, setting the keys and the production refusal are tests only; the three lane options: the camera stub `09b` and the speech microphone `11b` were used at gates, the discard option has no gate run on record; the start refusal `SESSION_KEY_NOT_OF_SESSION`, `10e` C5) |
| "Fix wave K" | Committed as `b05106b`; the gate-state paragraph rewritten with the re-check and final reports; the seal rig "driven live by a gate verifier" (`10e`); per-item gate state for the restart fault (`10d`), the profile (`12d`; the one package that keeps its fractional label, D226), the three stated limits, the tablet AND phone seek (`13d`) |
| NEW "Fix waves L and M: additions and corrections" (before Known limits) | Commits `7b1aded`, `a5d75ed`; the development tools at a glance (lanes, camera stub, speech microphone, BOTH rigs, the reset option); the source rig (three commands, four rules, gate state); "Retry sealing" and no self-retry; the open notice and its audit-row gap; the one rule / "Synthetic demo values" / "Not checked" / "Generated test source" / the selector in force; the sealed format on the item; Session New on the devices and "choose another source" not offered; the web tamper demonstration and what is not proven; the open findings GM-01, GM-02 |
| "Known limits" | Rows 2, 15 and 26 corrected in place (each says so, with the date); rows 34 .. 45 added: the demo password and S99-01 (ruled, in progress, NOT in the tree at `713d83f`), S99-02, S99-03, no key escrow, no manifest member for delivered frames, `RTC` bare enum, library mount warnings, the acknowledgement without an audit row, GM-01 / GM-02, the stored dataset values and the engine's "READY", the smaller security limits S99-04 .. -09 with which are ruled for this batch, what `npm test` does not run |
| "Tests" | The counts at `713d83f` (final test report), the note that per-wave test files no longer exist, and "What `npm test` does not run" with the six root scripts of `contract_batch_n.md` and their state |

"Not yet gate-verified" marks: 12 before this pass, 4 after. Eight were removed, each with the covering report named
in its sentence (the speech microphone, the blocked seal, the receiver's command, the real-capture words, the wave K
gate-state paragraph, the seal rig, the heading of the other wave K changes, the tablet's seek). Four remain, each
narrowed to what is still unverified and with its reason: the rule sentence of the wave H / I gate-state paragraph;
setting the installation keys and the `REAL_PRODUCTION` refusal (tests only, `12d` F-2); the discard option of the lane
reset (no gate run on record); the start refusal `SESSION_KEY_NOT_OF_SESSION` (`10e` condition C5).

Commands and options in the README were checked against the files in the working tree: `scripts/lane/lane.sh` (header
lines 6-28, `cmd_source_rig` lines 246-276, the dispatcher lines 405-424), root `package.json:35-60`,
`scripts/test/regression.sh`, `scripts/test/kill-matrix.sh`, `apps/core-server/package.json:9-23`.

## 3. Open items

| # | Item | Why open |
|--:|---|---|
| 1 | **S99-01 is worded "ruled, in progress, NOT in the tree at `713d83f`"** in the README (State block, Known limit 34) and nowhere as built. `implementation/164_batch_n_chain_fixes.md` did not exist when this pass ended (checked at 21:37 and at 21:39 WIB). The working tree already holds uncommitted changes of the code driver under `apps/core-server/src/capture/boot/` - not read, not described. When note 164 exists and says the refusal is done: reword Known limit 34 and the sentence of the State block, and name the boot code. The same holds for S99-04, -07, -09 (Known limit 44), V98-13 (PE-WM-03 states the behaviour at `713d83f`), V98-09 and R101-03 | The brief's rule: as built only when note 164 says so |
| 2 | The regression scripts are documented from `contract_batch_n.md` section 1 ("FINAL") and from the scripts read in the working tree. By the driver's own statement only `test:capture-worker` was run; the three scenario scripts, `test:capture-worker-e2e` and `test:regression` were not run through the scripts. README and PE-BN-06 say so. If a script name or step changes before the commit, both places change with it | Uncommitted, in flight |
| 3 | Gate state in the errata: taken from the gate reports by their finding ids and rows (`09d`, `10d`, `10e`, `11b`, `12b`, `12d`, `13b`, `13c`, `13d`, report 14) and from D232 .. D239. The reports were read by `grep` for the rows cited, not in full | A wording drift between a report and my one-line gate state would not be seen |
| 4 | PE-WL-12 (the one rule): the rule, the chip and the device rule were read; the page-by-page lists of blocks are the drivers' tables (notes 154 section 3, 156 section 3). Not every page string was re-read | Same limit as note 147 open item 3 |
| 5 | PE-WL-09, -10, -11, -13: client sentences are quoted from the i18n files where a line is cited; sentences without a line cite (the device Recovery screen's "Recording was interrupted — sealing what was recorded", the phone Home tile words, "Sealing blocked: view") are quoted from notes 155 and 160, not from a string file read by this pass | Reading every mobile string file was not done |
| 6 | V98-08 (the pre-check row seen without `params` at the confirmation session): stated as open in PE-WM-01; not investigated. The schema line `state-slices.ts:216` is the verification's cite, not re-read here | Needs a lane or a code trace of the replicated slice against `GET session/current` |
| 7 | PE-BN-01 .. -04 restate the final test report's numbers (50 ceilings; the worker counts; 49 of 157 ids; the D128 figures). Nothing was re-counted and no test file was opened | Runner's evidence, by the brief |
| 8 | Wave M changes with no behaviour for a spec and therefore no erratum: the phone Home camera tile that stayed empty when a recording started on a hidden tab (G75e-01; the platform mechanism is not established), the Monitor layout at 1440 x 900 (G89d-05), the integrity card's closing sentence on a sealed session (G89d-06). Wave L likewise: the scroll cue and the wrapped strip values (G89c-07, -08), the phone's option-row chip (G70c-03), "Core server unreachable" beside "Core Machine ONLINE" (G70c-06), the registered card of an unassigned built-in source (G70c-08), the export list refresh (G94c-02), the signing-key control (G89c-05). They are in notes 154, 155, 159, 160 | Not named in verification section 4.3; a defect fix, not a rule |
| 9 | `06_evidence_package_spec.md`: no erratum. Section 4.3 row 17 points at `06:396` only as the place of the manifest's words for a `FAKE` source; the client naming rule is PE-WL-13. `tracks[].profile` on the item is PE-WL-04 (C3) and cites the evidence spec's PE-WK-16 / PE-WK-47 | By the brief: nothing new unless section 4 names it |
| 10 | The README body written at `f293221` was not re-verified sentence by sentence against HEAD; this pass corrected the head, the gate-state marks, the privacy sentence, three limit rows and added blocks. Sentences of the body that waves L and M contradict are named in the new block ("no operator action", "Reachable"); others were not searched for beyond the `grep` of "not yet gate-verified", "accepted risk", "no real speech engine" and "three options" | A full re-read of 840 lines against the code is a task of its own |
| 11 | Not edited, by the task's rule: `decisions/decisions.md`, `status_tasks.md`, `delegation_progress_report.md`, the tracking table of `02_plan.md` (it has no row for batch N), `99_implementation_report.md` | Controller's files |
| 12 | The headings "### B.4 ..." and "## I. Flake handling" of the test strategy gained a bracketed pointer; a link or a grep that matches the exact old heading text (section L of that file lists greps of 2026-10-07 / -09) would no longer match | Pointer in place, by the convention; not re-run |

## 4. Checks

No validation command applies to markdown; none was run (no test, build, lint or typecheck exists for these files).
Checked by reading and counting: every id `PE-WL-01 .. 15` and `PE-WM-01 .. 11` appears once in an errata index of its
file and once as an erratum paragraph (`grep -o 'PE-W[LM]-[0-9]*' | sort | uniq -c` per file); `PE-BN-01 .. 06` each once
in the table of section N and once as a paragraph. The lines removed from the working-tree diff by this pass are: the
`last_updated` lines of 03, 05 and 08, the index row and the paragraph of PE-WK-45 (08), six catalogue rows, two headings
and the X-MAX-1 row of 10 - each reappears inside an added line with its text intact; the README replacements are listed
in section 2. No emoji in the five files (a scan of the ranges U+1F300-1FAFF and U+2600-27BF: 0). Registry totals are
unchanged and the C3 errata say so: 97 operations / 36 GET / 61 POST / 67 audit types, 30 slices, schema 6 / `dbc-7`.

---
*Generated: 2026-10-11 21:40 WIB*
