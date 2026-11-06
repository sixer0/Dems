---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-10
agent: coder-execution (documentation errata pass)
scope: documents only - no code, no test, no script, no lane, no git write
status: needs-review
---

# 136 - Documentation errata for fix waves H and I

Documents only. Nothing under `apps/*/src`, `packages/*/src`, `scripts/` or any test was edited; no
command of the product, no lane and no suite was run; no git write. Every command, option and
member written into a document was read in the tree first (the "Source" column gives `file:line`).
`decisions/decisions.md`, `status_tasks.md` and the tracking table of `masterplan/02_plan.md` were
not edited (controller's files). One line was appended to `delegation_progress/file_claims.md`.

Convention continued: the wave H erratum `PE-WH-01` existed (C3 §2.6). This pass continues that
series as `PE-WH-02..13` and opens `PE-WI-01..18` for fix wave I. Ids are unique across the four
specifications. Each erratum stands in place, names its decision and its implementation note, and
is listed in the "Errata index (fix passes of 2026-10-10)" of its file (03, 05, 06, 08). No earlier
sentence was deleted: a changed table row keeps its text and gains the erratum.

Sources read: `delegation_progress/file_requests.md` lines to "docs owner" of 10:04:00Z (wave H E),
10:20:00Z (wave H C1), 10:42:50Z (wave H R), 10:58:00Z (wave H Z1), 13:45:00Z (wave I A2);
`delegation_progress/contract_wave_i.md`, `contract_wave_i_a2.md`; implementation notes 123-134;
decisions D196-D217. The lines of 10:04:00Z and 10:20:00Z are older than the range the task named;
they were found NOT applied (no `verify-export`, no speech microphone in the README; no export or
media-row erratum in the specs) and the task's own list names their subjects, so they are covered.

## 1. Errata

### `masterplan/03_api_contract.md` (14)

| Erratum | Section | What changed | Source |
|---|---|---|---|
| PE-WH-02 | §2.4 Per-area notes | Op 88 and `GET /media/{token}` open a REAL item or a seed-sealed demonstration item; case scope for REAL only; v1 demo item `409`; the tamper item refused per fragment | D205, D208; note 127 §3; `media-stream/items.ts:54`, `media-stream/service.ts:195`, `:263` |
| PE-WH-03 | §3, op 40 (row pointer + paragraph below the table) | `media.fileIds`, `media.reason`, `access { play, readTranscript, export }`, `exports[]`, op 87 `archive`, the item's sealed facts, `interrupted` = the manifest's fact, five more examples; names not in the contract | D205, D207, D208; note 127 §2-3; `packages/shared/src/api/evidence.ts:106`, `:124`, `:139-142`, `:153`, `:162`, `:318`, `:457-460`, `:1000-1062`; `modules/evidence/media.ts:31` |
| PE-WH-04 | §5.2 `EVIDENCE_MEDIA_SERVED` | One row per media-session issue + one WARNING row when serving stops on the package; a range is a log line | D205 (G94-06); `media-stream/service.ts:314-323`, `:341`, `:344-353`; `core/audit-details.ts:280-287` |
| PE-WH-05 | §6 Realtime slices | `session.captureCheckpoints`, `time.hostClock` (optional); the pre-check TIME note | D203 (1), D209; note 128 items 1, 4; `api/state-slices.ts:364-372`, `:548-551`; `sim/core-facts.ts:159-163` |
| PE-WH-06 | §2.4 Per-area notes | The installation identity is Core configuration (two environment keys); no API member | D209; note 128 item 3; `config.ts:60-61`, `:294`, `:301`; `sealing-host/installation-identity.ts:59` |
| PE-WI-01 | §4, row `DEVELOPMENT_SOURCE_NOT_ALLOWED` | Four `details.reason` values on the selector's 422 | D215, D217 (pin of D115 (3) moved); note 132 §1, decision 1; `modules/capture-config/routes.ts:79-90` |
| PE-WI-02 | §4, row `NOT_READY` (503) | `SESSION_KEY_NOT_OF_SESSION`, `SESSION_KEY_STORE_UNAVAILABLE` on `startSession` | D216 (4), D217; note 131 §3.1 row 2b; `sealing-host/index.ts:183-186`, `:582-586`; `sealing-host/session-key.ts:115-123`; `modules/sessions/routes.ts:221` |
| PE-WI-03 | §5.2 `CAPTURE_CONNECTION_TESTED` (paragraph + one table row) | Optional detail key `reason: SCHEME_NOT_ALLOWED`; a scheme refusal is not counted by the guard; when the remaining-attempts line is drawn | D181 (3), D217; note 132 §1, decision 2; `core/audit-details.ts:347`; `connect/service.ts:112-119`; `connect/limits.ts:185-188` |
| PE-WI-04 | §5.3 Changed audit rows (new row) | Six session rows carry the sending device in the row's `deviceId` | D216 (2), D217; note 132 §1, decisions 3, 5; `sim/session-machine.ts:344`, `:621`, `:683`, `:809`, `:855`, `:909`, `:998` |
| PE-WI-05 | §6 Realtime slices | `session.precheck.sendingDeviceId`; note that `checkedAt` is NOT built | D216 (2), D217 (6); `api/state-slices.ts:249`, `:255`, `:280-284` |
| PE-WI-06 | §2.4 Sealing progress (83); pointer in §5.3 | The meaning of `resumed` on a Core in real capture | D217; note 131 §3.1, decision 6; `modules/sealing/index.ts:61`; `sealing-host/index.ts:575`, `:588`, `:635` |
| PE-WI-07 | §2.4 Sealing progress (83) | The blocked / retried seal reading: existing members, `sealAttentionOf`, `sealBlockedNoticeOf`, the detail list, the terminal cause; no contract member | D216, D217; `contract_wave_i.md` §1-3; `sim/seal-blocked.ts:35`, `:41-53`, `:60-70`, `:97`, `:141`; `sealing/pipeline/way-out.ts:61` |
| PE-WI-08 | §2.6 (last paragraph) and §7 `CAPTURE_SEARCH_ID_PATTERN` | Search ids go on across restarts | D217; note 132 §1, decision 7; `modules/capture-discovery/search-ids.ts:21-22`, `:36` |
| PE-WI-09 | §5.3 Changed audit rows (new row) | Start after a stop on a real-capture Core: no power-fail row for FINALIZING, no tablet row; the limit for the other four states | D216 (3), D217 (5); note 132 §1, §4; `engine/rehydrate.ts:255`, `:269`, `:345-357`, `:375` |

Already present, not repeated: PE-WH-01 (op 97 in simulated capture, incl. the in-app simulator).

### `masterplan/05_capture_architecture_spec.md` (1)

| Erratum | Section | What changed | Source |
|---|---|---|---|
| PE-WH-10 | §A.7.1, after "Fake microphone of slot 2" | `DEMS_CAPTURE_DEV_FAKE_MIC=tone\|speech`, the speech fixture, its format rule, three refusals | D198, D201, D209; notes 125, 128 item 8; `capture/fence/fake-mic.ts:9-33`, `:50-73`, `:114-161`; `config.ts:59`, `:287`; `scripts/capture/dev-setup.mjs:6-7`; `scripts/capture/speech-fixture.mjs:17-19`, `:32-34`; `scripts/lane/lane.sh:11-13`, `:128` |

### `masterplan/06_evidence_package_spec.md` (3)

| Erratum | Section | What changed | Source |
|---|---|---|---|
| PE-WH-07 | §F.2 | Seed-sealed demonstration packages are sealed on the Core: playable; the tamper item refused per fragment | D205, D208; note 127 §3, §5; `media-stream/items.ts:54`, `service.ts:195` |
| PE-WH-08 | §B.3 fields 20 / 21 (row pointers + paragraph) | Source = Core configuration (installation identity); `NOT_CONFIGURED` when unset; boot rule per capture operation | D209; note 128 item 3; `config.ts:60-61`, `:294`, `:301`; `sealing-host/session-reader.ts:107`, `:382` |
| PE-WH-09 | §G.1 | Self-contained export archive; `package` block without `bytes` / `sha256`; the receiver command; retention as built | D205; `evidence-export/export-manifest.ts:96-109`, `:133-134`; `package.json:54`; `apps/core-server/package.json:23`; `cli/verify-export.ts:5`, `:18` |

### `masterplan/08_client_ux_spec.md` (12)

| Erratum | Section | What changed | Source |
|---|---|---|---|
| PE-WI-10 | §4.5 (flow 3) | Blocked / retried seal: web dialog, Monitor banner, Dashboard panel; tablet / phone Finalizing; Home and Sessions "Sealing blocked"; leavable; no percentage | D216, D217; `contract_wave_i.md` §3.3; notes 133 §2.1, 134 §1; `core-web/src/i18n-web.ts:57-68`; `mobile/src/features/session-finalizing/i18n.ts:61-71` |
| PE-WI-14 | §4.5 (flow 3) | Header alert sentence names the fault kind; the stated limit of the pill | D217; note 133 §2.4; `components/shell/integrity-checks.ts:70`, `:87`; `i18n-web.ts:17-20` |
| PE-WI-11 | §5.5 (flow 4) | "Resumed after restart" not derived from `attempt`; not shown beside own capture | D217; `contract_wave_i.md` §4; notes 133 D-2, 134 decision 2 |
| PE-WH-13 | §6.6 (flow 5) | Finished exports on the web item page; one player-source rule per app | D204, D205, D208; notes 123, 127; `features/evidence/finished-exports.tsx:22-23`, `detail-page.tsx:358`; `i18n/en/evidence.ts:645` |
| PE-WH-11 | §8.5 (flow 7) | Pre-check TIME note with its NOTE chip; TIME / Summary chips "Host system clock"; "SESSION ACTIVE" and checkpoint facts in own capture | D203 (1), D209, D210; notes 128 item 1, 129; `i18n/en/session-new.ts:210-213`, `i18n/en/session.ts:413`, `:423` |
| PE-WI-16 | §8.5 (flow 7) | Host-clock and "not reported" wording on web Dashboard / Network & Time / header and the mobile Home chip; what stays open | D217; notes 133 §2.3, 134 §1; `i18n-web.ts:21-48`; `mobile/.../dashboard/home-model.ts:432-433`, `use-home-data.ts:183` |
| PE-WI-18 | §8.5 (flow 7) | Still loaders on pre-check rows, pending buttons, Stepper badge | D207, D217 (2); note 134 §1 row G75b-05, decision 1 |
| PE-WI-12 | §8d.3 row "Development source" (:827); §14.2 key (:1418) | The development-source sentence of the connect dialog | D215, D217; `contract_wave_i_a2.md` §1; note 133 §2.2; `i18n-web.ts:74` |
| PE-WI-13 | §8d.4 row `AUTHENTICATION_FAILED` | No-credential result; attempts line only for a refused credential | D181 (3), D217; `contract_wave_i_a2.md` §1-2; `features/devices/camera-connect.ts:270`; `i18n-web.ts:75-76` |
| PE-WH-12 | §8f.2 | "No preview" on camera tiles and session rows in real capture | D196, D206, D210; notes 124, 129 item 6; `core-web/.../camera-tile.tsx:101`; `mobile/.../device-detail.tsx:373`; `mobile/.../capture-selector/i18n.ts:252-257` |
| PE-WI-17 | §8f.2 | "No preview" on Home "Recent Sessions" | D217; note 134 §1 row G70b-04 |
| PE-WI-15 | §8f.2 | Source state words on a real-capture Core; "Stream live" only while RECORDING; `checkedAt` not built | D217 (6); `contract_wave_i_a2.md` §4; notes 133 §2.7, 134 §1 |

### `README.md` (one subsection, 11 blocks, plus one pointer line; not numbered)

New subsection "Fix waves H and I: additions and corrections", placed before "Known limits"; one
"Correction (2026-10-10 ...)" pointer after "Read this first". The older text was not rewritten:
where a block supersedes an earlier sentence it says which.

| Block | Source |
|---|---|
| Gate state, said once (70 and 75 not passed; 81, 89, 94 not run on this tree) | D215, D216, D217 |
| `DEMS_INSTALLATION_DEVICE_ID`, `DEMS_INSTALLATION_NAME`; boot rule; lanes say `NOT_CONFIGURED` | D209, D214; `config.ts:60-61`, `:294`, `:301` |
| Refusals `CAPTURE_DEV_FAKE_MIC_INVALID`, `DEV_FAKE_MIC_NEEDS_DEV_SOURCES`, `DEV_SPEECH_FIXTURE_UNUSABLE`, `DEV_CAMERA_STUB_IN_PRODUCTION`; `CAPTURE_WORKER_VERSION_MISMATCH` (corrects limit 21) | D201, D202, D206, D209; `capture/fence/fake-mic.ts:50-73`; `config.ts:287`; `capture/fence/development-discovery.ts:39`; `capture/types.ts:71` |
| Speech microphone, `DEMS_CAPTURE_DEV_FAKE_MIC=tone\|speech`, the fixture, set-up options (corrects "no real speech engine ..." and limit 15 for synthetic speech only) | D201, D211; `scripts/capture/speech-fixture.mjs:9-19`; `scripts/capture/dev-setup.mjs:6-7`, `:85`; `adapters/local/mic-helper-args.ts:69` |
| Limits of the transcript step as named settings | D201 (3); `sealing/finalize-transcript/bounds.ts:58`, `:64-68` |
| `lane.sh start <lane> --with-camera-stub`, `start 2 --speech-mic`, `reset 2 --discard-unsealed-fake-recordings` | D196, D206, D216, D217; `scripts/lane/lane.sh:6-21`, `:49-60`, `:88`, `:128`, `:166-167`, `:232-234`, `:255-263`; `apps/core-server/package.json:9` |
| The FAKE-only rule of the reset option (corrects the row of "Reset rules" and limit 29) | D216 (4), D217 (8); `db/reset/real-evidence.ts:120-121`, `:384`; `lane.sh:62-76` |
| Session keys and a reset; the refused start (corrects limits 23, 29) | D217 (1); `db/reset/session-artefacts.ts:128`, `:232`; `sealing-host/index.ts:582-586` |
| A seal that is retried or blocked (limit 2 stands) | D216, D217; `sealing/pipeline/way-out.ts:61` |
| Export: self-contained archive, `npm run evidence:verify-export -- <archive>`, its two printed limits, archives kept | D205; `package.json:54`; `apps/core-server/package.json:23`; `cli/verify-export.ts`; `evidence-export/receiver-cli.ts:1-28` |
| What the clients show in real capture | D196, D210, D217 |

**"Not yet gate-verified" marks.** The README held NO sentence with that mark before this pass
(searched: "gate", "not yet", "not proven", "verified"). So none was removed. The mark was ADDED
to every new block whose subject no gate has passed; nothing was marked verified on behalf of gates
70 or 75.

### `apps/capture-worker/README.md` (0)

Read; not changed. The worker was not changed in waves H or I (D202), and no request line names a
sentence of this file: the speech microphone is a source of the Core's fence and helper program,
not one of the worker's fixtures.

### Asset READMEs (1 line each)

`packages/shared/assets/demo-evidence/README.md` and `packages/shared/assets/demo-media/README.md`:
one dated "Correction" line appended to the existing hand-written note of each (the `export/` row
since the self-contained archive; "the demo loop in Live mode" since "No preview"). Sources:
PE-WH-09, PE-WH-12, PE-WI-17.

## 2. Open items

| # | Item | Why open |
|--:|---|---|
| 1 | **R96-1** (`implementation/47_m9_docs.md:181`): the asset READMEs are generator outputs; the hand-written notes (and the two lines of this pass) are removed by a regeneration | NEEDS CODE: the text must go into `readmeText` of `packages/shared/scripts/gen-demo-evidence.ts` (`:1452`) and `gen-demo-media.ts`. Not a documentation edit |
| 2 | Evidence spec fields 17-19, 22 / 23, 38-40, 13, 53, 73 + §B.8 (request line 10:20:55Z, wave H driver A, to "spec owner") | Not in the lines to "docs owner"; the task limits the evidence spec to what those lines name. Fields 22 / 23 are mentioned only inside PE-WH-08 (their row text is unchanged) |
| 3 | C3 erratum PE-FX-02 says op 33 on a failed seal "writes no `RECOVERY_STARTED`"; the code and `contract_wave_i.md` §3.3 name an audit row `RECOVERY_STARTED` with `details.reason: SEAL_RETRY` (`sealing-host/index.ts:154`, `modules/sessions/routes.ts:306`; ruling D186 (8), tidy pass F-Y) | Older than waves H / I; which sentence is right needs the F-Y owner or the controller. Left unchanged, not asserted in PE-WI-07 |
| 4 | C3 §2.6, the paragraph before §3: "The simulator's devices carry `adapter: FAKE`, `sourceClass: DEVELOPMENT`" against D206 (a SIMULATED Core states no adapter / source class on any operation) | Not verified by this pass for the in-app simulator's device shapes; PE-WH-01 covers op 97 only. Left unchanged |
| 5 | Shared key `common.captureConnect.noPasswordNeeded` still holds the old sentence (`packages/shared/src/i18n/en/common.ts`) | Code; notice already filed 13:45:00Z. Stated in PE-WI-12 |
| 6 | `captureDevices.devices[].checkedAt` | Not built (D217 (6)); documented as NOT a contract member |
| 7 | G75b-03 for PRECHECK / ARMED / RECORDING / STOPPING; a `CORE_STOPPED` cause | Not built (D217 (5)); documented as a limit in PE-WI-09 |
| 8 | Mobile Network & Time "RTC (holdover)"; web Storage KPI "session size"; web Security Posture column; a real-capture Core still sending `security.tpm.ok: true` (D217 (7)) | Not built or not landed when read; named as open in PE-WI-16 |
| 9 | README Known-limits table rows 2, 15, 21, 23, 29 and the first bullet of "Export" | Corrected by reference from the new subsection; the rows themselves were not rewritten. A later docs row may fold them in once the re-gates pass |
| 10 | README "Tests" counts | Not touched: the wave H / I counts are in D212 and the wave I tree is not committed |
| 11 | `masterplan/02_plan.md` tracking table, `status_tasks.md`, `99_implementation_report.md` | Controller's files by the task's rule; this note is the report of the pass |

## 3. Checks

No validation command applies to markdown here; none was run. What was checked by reading:
every removed diff line reappears inside an added line (14 changed lines: 5 front-matter /
authority-cell extensions, 9 table rows that gained an erratum); no test of the repository reads
the edited documents from disk (searched `*.test.*` for `masterplan/` and `README.md` paths).

---
*Generated: 2026-10-10*
