---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-07
agent: data-analyst
row: W102 (blueprint 117), report inputs
type: mixed
narrative_tier: 1
confidence: HIGH for counts, SC outcomes and host probes; MEDIUM for the row-log cross-check (script-based, with a hand-read residual)
source_translated_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/identification/01_translated.md
source_structured_task: /Users/gsp-budi/Documents/DEMS/docs/2026-10-04_dems_backend_rbac_pairing/identification/02_structured.md
source_plan_row: masterplan/02_plan.md:781 (W102); plan section 14 (lines 1377-1491)
status: needs-review
last_updated: 2026-10-07 12:05 WIB
---

# W102: report inputs (SC outcome, decision-log integrity, open items, host state)

## 0. Summary

| Question | Answer |
|---|---|
| SC1-SC11 | **8 PASS, 3 CAUTION, 0 FAIL** (W101, ruled in D256). SC9 closes with this row once the controller acts on section 2.6. SC10 waits on the W103 commit scan |
| Decision log | **D1-D256, DR-01-DR-14, F1-F79.** No gap and no duplicate in any series. All 165 task-file references resolve. DR rows are stored out of order (cosmetic) |
| Row-log cross-check | 338 row logs read by script, every one tied to at least one gate entry. **783 decision requests**: 518 quoted by ID in the row's own gate entry; a hand read of 24 gate entries resolves most of the rest. **23 unique items are confirmed unrecorded**, all Low or Info, 11 of them W41's. **93 could not be confirmed one by one** (Appendix A). **No plan drift is missing from the DR log.** 663 agent deviations and 796 row-local findings are mostly recorded only as prose summaries (Appendix B, C) |
| Open items | **43 distinct items** after de-duplication: (a) pre-handover session 6; (b) next phase 17; (c) user decisions 9; (d) W103 commit 11. All non-blocking |
| Host state | Matches plan section 14 and W90 for every register line (H-01 to H-18). **Four things are not in section 14:** adb reverse `tcp:8081` on all three emulators; five orphaned `adb logcat` processes; 55 per-row scratch folders in `.cache/` (about 1.25 GB) outside RB-17; the controller's `.cache/manual/` logs. Removal commands are in section 4.4 |
| Ledger | shared 71/1,851; core-web 117/1,495; mobile 192/1,988; core-server unit 160/3,954; db 124/1,751; mock-core 4/19; pg-scripts 57 (D247, D254, D256) |
| Agent and model notes | 7 tier-R-to-D overrides recorded in the trail. Two later ones (T1, T2) are recorded only in decisions. **The delegation trail has no row for about 22 delegations after W97** (section 6) |

Status is `needs-review` for one reason only: SC9 needs the controller to rule on the unrecorded decision requests and deviations in section 2.6. This row may not edit `decisions.md`.

---

## 1. Tier 1 frame (5W1H)

| Item | Content |
|---|---|
| **Subject** | The inputs for the final report and for W103:<br>- the SC outcome<br>- whether every decision, drift and finding is recorded (SC9)<br>- the consolidated open items<br>- the host state left behind, with removal commands<br>- the test ledger<br>- notes on agent and model usage |
| **Stakeholders** | The user, who owns the demo, the handover and every user decision in section 3(c). The controller, which writes the final report, rules on section 2.6 and runs W103. W103 (git-specialist), which takes section 3(d) as its brief inputs |
| **Timeline (WIB, 2026-10-07)** | 11:30 brief read. 11:40:24 host probes (load 5.75 / 14.23 / 15.93). 11:41-11:43 `ps` and `adb` probes outside the sandbox, read-only. 11:45-12:00 cross-check scripts. 12:05 report written |
| **Scope** | **In:**<br>- `decisions/decisions.md`<br>- the 338 Markdown logs under `implementation/` (80), `gateway_check/` (39), `verification/` (14), `test/` (19), `delegation_progress/` (180) and `initialization/` (6)<br>- `verification/01_verification.md`<br>- `implementation/99_implementation_report.md`<br>- `research/10_next_phase_impact_map.md`, read through D228<br>- the two galleries, by size and reference count<br>- `delegation_progress_report.md`<br>- read-only host probes<br><br>**Out:**<br>- no edit of tracked files or of `decisions.md`<br>- no start or stop of any process<br>- no read of `.data/pg.*`: only names were counted, and the credential file names are withheld in the listing |
| **Rationale and evidence chain** | Every claim cites a `file:line`, a decision ID or a probe command with its output. The cross-check is reproducible: the scripts `xcheck2.py`, `xcheck3.py` and `xcheck4.py` live in the session scratchpad `.../scratchpad/w102/`, outside the repo |
| **Methodology** | 1. Count and continuity script over `decisions.md`.<br>2. Tag each row log: file name, `step N`, `W-nn`, named round tags such as FX-C, CF-M1 or RF-T, and front-matter rows. Tie it to the decision entries carrying those tags.<br>3. Extract the IDs each log **defines**: table first cell, bold label, or line-leading label of DN, DEC, DX, DQ, DC, DV, D-x, DEVIATION or F-n. Classify each one by the section heading it sits under.<br>4. Check it against the gate entry. Expand ranges such as `DN-1 to DN-8`, `DEC-FXR-M-1..6` and `DN-W1..W6`, and lists. Two strictness levels: (i) any tied entry; (ii) only entries naming the row in their first 420 characters (the row's own gate).<br>5. Hand-read the gate entries of 24 rows whose rulings are numbered or written as prose.<br>6. Grep the row logs for "drift".<br>7. Host probes. |
| **Alternatives considered** | (a) Matching IDs anywhere in `decisions.md`: rejected. DN-1 to DN-19 recur in dozens of rows, so this gives false "recorded" results; D78 and D93 quote other rows' DN-n (section 2.4). (b) Reading every one of the 783 items by hand: not done. The script settles 518, and the hand read targets the rest |
| **Assumptions** | - A gate entry that rules a row's items by number, such as "(1) ... (6)", rules the row's DN-1 to DN-6 in that order. Checked on W07, W08, W26 and 04a, where the substance matches.<br>- A row log in `delegation_progress/` mirrors its primary log in `implementation/`, `test/` or `gateway_check/`. |
| **Gaps** | - Appendix A has 93 items where the gate's prose was not matched to the item one by one.<br>- Local F-n numbers are row-local. The controller's F1-F79 use their own numbering, so a row finding can be recorded under another number without this script seeing it.<br>- `lsof` lists only the user's processes. The `*:5432` server (user `postgres`) was seen with `ps` |

---

## 2. Section (1): SC1-SC11 outcome (from W101 and D256)

| SC | Criterion | Result | Evidence pointer | Residual or route |
|---|---|---|---|---|
| SC1 | Spec and plan dated before the first implementation log | **PASS** | `4b708c8` at 06:25:02. The W01 window opens at 06:26:37 (`verification/01_verification.md:44`; `delegation_progress/git_specialist_step_22.md`) | Margin 1 min 35 s |
| SC2 | Documented start, migrations from empty, seed, state survives a restart | **PASS** | - W53 `test/06_restart_recovery.md`<br>- W58 `gateway_check/06_backend_gate.md`<br>- W90 `verification/03_clean_state_rebuild.md` sections 2, 4, 5 and 13; F-1 ruled in **D240**<br>- `test:db` 124/1,751 in the closing run | F-1 is a ruling, not drift: 28 of 30 tables equal; epoch +1 and telemetry are specified behaviour |
| SC3 | Both clients read from the backend; an action on one shows on the other | **PASS** | W49 `test/05_shared_state_realtime.md`; W95 `verification/04_e2e_shared_state.md`; **D249** | Late tablet stop under load (RF2-2 family): item A3 |
| SC4 | Role-by-endpoint test; a denial is refused and audited; a role change follows on both clients | **PASS** | W47 `test/02_rbac_matrix.md` (375 cells); W96 `verification/05_e2e_rbac.md` (AUD-000157 and AUD-000161 `ACCESS_DENIED`); **D249** | Run-1 lock instant not captured (W96 D-1); run 2 measured it |
| SC5 | Pairing gate, listing, revocation, an audit row per step | **PASS** | W48 `test/04_pairing_lifecycle.md`; W94 `verification/06_e2e_pairing.md` section 3; **D249** | Release-build revoke-to-Pair under 1 s: item A1 |
| SC6 | OpenAPI covers every endpoint; drift test; API Reference shows them as live | **PASS** | W52 `test/03_contract_conformance.md`; **D185** (75 operations, 0.2.1, 0 `CONTRACT-GAP-`); **D187**; **D247** | - |
| SC7 | Existing suites and the new backend tests pass | **CAUTION (acknowledged, D256)** | - D189 (75/75 operations with a success test, line coverage 96.93 %)<br>- D239 (W89 flake)<br>- W101 closing run (`01_verification.md:118`)<br>- T2 run (D256)<br>Every workspace passed in full on the final tree; every failing file passes alone | Root `npm test` exits 1 at high load (wall-clock waits in four tests). Fix: item B10 |
| SC8 | Simulated mode and the 0.1.0 packages still work | **PASS** | W97 `verification/07_regression_simulated_release.md`; **D253** (F-1 accepted by name, F-2 closed by DR-14) | - |
| SC9 | Decisions, drift and findings recorded | **CAUTION until the controller acts on section 2.6** | - W88 `implementation/99_implementation_report.md`, accepted in **D190**<br>- this row, section 2 | 23 confirmed unrecorded decision requests (Low or Info), 93 unconfirmed (Appendix A); deviation and finding coverage is prose only for 50 and 20 logs (Appendix B, C). **No missing drift.** Proposal in section 2.6 |
| SC10 | No secret committed, no real personal data, nothing sent out | **CAUTION (acknowledged, D248 and D251)** | W99 `verification/02_security.md` (count-only scan 0 hits); W100 `verification/09_security_clients.md`; `git remote -v` empty (re-probed 11:40: 0 lines) | W99-1 `npm audit` 99 high / 0 critical (item B2). The W103 commit scan and the O-1 log scan are still to run (items D1, D9) |
| SC11 | The README gives the exact Live-mode commands | **PASS** | **D188**; W90 section 2 "README deviations: none"; `README.md:220` | - |

**Blockers:** zero (`01_verification.md` section 7; D256).

---

## 3. Section (2): decision-log integrity

### 2.1 Counts and continuity

Command: a Python count over `decisions/decisions.md` (365 lines, 588.6 KB), matching rows `| <ID> |` under each section heading.

| Series | Count | Range | Gaps | Duplicates | Stored order | Section placement |
|---|--:|---|---|---|---|---|
| Decisions | **256** | D1-D256 | none | none | ascending | all under `## Decisions` (lines 3-262) |
| Drift | **14** | DR-01-DR-14 | none | none | **DR-01, then DR-14 down to DR-02** (`decisions.md:268-281`) | all under `## Drift Log` |
| Findings | **79** | F1-F79 | none | none | ascending | all under `## Findings Log` (from line 283) |

Further checks:
- **References resolve.** 165 distinct task-file paths are cited in `decisions.md`, under `implementation/`, `test/`, `gateway_check/` and the other phase folders. **0 are missing** on disk.
- **D33 is withdrawn by D35.** It stays in place, marked "WITHDRAWN ... do not act on it" (`decisions.md:39`). That is correct: the entry is kept, not deleted.
- **DR references all exist.** DR-01 and DR-02 cite D11. DR-03 cites D16, DR-04 D20, DR-05 D25/D31, DR-06 D35, DR-07 D53, DR-08 D58, DR-09 D71, DR-10 D74, DR-11 D80, DR-12 D91, DR-13 D140. DR-14 (FX-C's simulator change) is closed by D253.
- **W88's drift table is a snapshot.** Its table in `99_implementation_report.md` section 3.1 lists DR-01 to DR-13. DR-14 was added later (D201/D202, closed by D253). The final report should list 14.

### 2.2 Drift cross-check: no missing drift

"drift" was grepped in all 338 logs, leaving out OpenAPI, clock and drift-test phrasing. Every hit is one of these:
- a schema check ("No schema changes" in `implementation/10`, `implementation/17`, `database_specialist_step_39`)
- a fixture-data finding (W25 F-10, `implementation/25_db_bulk_fixture.md:911`; its deviations are accepted in D103 and D109)
- W90 F-1 (`verification/03_clean_state_rebuild.md:215`), ruled "not drift" in D240
- review notes (W92-17, W92-25 drift risk, fixed by FXR-W in D247)

**No row log reports a plan drift that is missing from the DR log.**

One self-labelled drift has no DR entry. **D220** says "DRIFT against the current build": the user corrected the requirement from two simultaneous audio tracks to one active microphone. It is a requirement change for the **next** task (D219-D226), not a deviation of this task's plan. The controller decides whether to record it as DR-15 or leave it in D220 (item D10).

### 2.3 Decision requests (DN, DC, DQ, DEC, design-decision D-x): results

| Measure | Count |
|---|--:|
| Decision-class items defined in row logs | **783** |
| Quoted by ID (with range expansion) in the row's own gate entry | **518** |
| Quoted by ID in any entry tied to the row (upper bound; includes other rows' identical IDs) | 662 |
| Not quoted in the row's own gate entry (counted per log, so a `delegation_progress/` mirror of a primary log counts again) | 265 |
| ... after merging mirror copies and hand-reading: **confirmed unrecorded** (unique items) | **23** (section 2.5) |
| ... **not confirmed one by one** (unique items): the gate rules the row in prose or by number, but the item-to-ruling match was not made | **93** (Appendix A) |
| ... the rest: resolved by the hand read (ruled by number or substance, or informational with nothing to rule), or a mirror duplicate | remainder |

**Hand read, resolved by substance:**

| Row | Items | Ruled in |
|---|---|---|
| W03 | DN-1, DN-2 | D27 |
| W03 | DN-3 | F29 |
| W03 | DN-5 | D65 (`fast-uri` in the notices) |
| W07 | DN-1 to DN-5, DN-7 | D32 rulings (1)-(5) |
| W07 | DN-6 | F27, corrected by step 29 |
| W08 | DN-1 to DN-5 | D40 (1)-(4) and the `errors.log` line |
| W09 | D-a to D-d | D30 (the script's range pattern needs digits, so it missed these) |
| W11 | DN-1, DN-3, DN-6, DN-7, DN-9, DN-10 | D48 |
| W13 | DN-1 | D33, D35, DR-06 |
| W25 | DN-12 | D103 |
| W25 | DN-13 to DN-15 | D109 |
| W25 | DN-16 | D104 |
| W26 | DN-F-1 to DN-F-3 | D127 (1)-(3) |
| W30 | DN-1, DN-8, DN-9 | D59 |
| W35 | DN-13 | D112 DN-2 |
| W0 (08a) | DC-1 to DC-10 | D165 |
| M1 (09b) | DN-F1 to DN-F5 | D166 |
| CP-B1 fix round A (04a) | DN-1 to DN-6 | D96 (1)-(6) |
| CP-B1 fix round B1 (04b) | DN-2 to DN-5 | D112 |
| CF-W | D-CFW-1 | D217, recorded by its measurements |
| E2E-W1 | D-1 | D198 "Blocked (accepted)" |
| W02b | DN-1 | D58 exists |

**Informational, with nothing to rule:** W24 DN-13, W32 DN-13, W48/W49 DN-5 (ledger), 08b DC-7 (ledger).

### 2.4 Why "quoted anywhere" is not evidence (method note)

D78 (the W24 gate) holds DN-5, DN-7, DN-8, DN-11, DN-15 and DN-16. D93 (the W32 gate) holds DN-5, DN-7 and DN-8. The loose script counted those as recording W41's items of the same numbers. Reading `implementation/41_biometric_token.md:780-803` against D105 shows that **D105 rules only W41 DN-1 to DN-4, DN-6, DN-9, DN-12 and DN-14** (`decisions.md`, D105 "Rulings"). That is why the strict own-gate figure (518) is the one reported.

### 2.5 Confirmed unrecorded (23 unique items)

Each item was read in its log and then looked for in its gate entry by ID and by keyword.

| Row (log:line) | Items | Nature | Severity |
|---|---|---|---|
| W41 `implementation/41_biometric_token.md:788-803` | DN-5, DN-7, DN-8, DN-10, DN-11, DN-13, DN-15, DN-16, DN-17, DN-18, DN-19 (11) | Decisions the row made and built: refused-token naming, `enabled:false` rules, `REENROLLED` scope, operation 9 while locked, lock lookups, claimed-token handling, rotation, 423 on lock, enrolment WHERE, import path, no logging. D105 passes the row but names only eight of its 19 | Low: behaviour tested and gated PASS; record only |
| W25 `implementation/25_db_bulk_fixture.md:1413` | DN-17 (F-26: the wording of three fixture rows stays the fixture's own until an admin builder exists) | Decision | Low |
| W35 `implementation/35_module_evidence.md:824` | DN-12 (pass finding F-7 to W45) | Routing | Low |
| W11 `implementation/11_db_test_helper.md:667` | DN-11 (record the dependency on W08) | Record | Info |
| W23 `implementation/23_request_guards.md:732` | DN-9 (stale title in `readiness.test.ts:236`) | Decision | Info |
| W72 `implementation/72_mobile_finalization_summary_sessions.md:373` | DN-9 (F-4, brief operation number) | Note | Info |
| 04a `gateway_check/04a_cp_backend_fix_round_a.md:428` | DN-7 (log sanitiser limits: depth 6, 2,000 members) | Decision | Low |
| 04b `gateway_check/04b_cp_backend_fix_round_b1.md:352, 357, 358` | DN-1 (closed-unit list), DN-6 (item 7 retitled, closed for D93), DN-7 (pool harness) | Decisions | Low |
| CF-W `gateway_check/12c_cf_web.md:205` | D-CFW-4 (the full suite ran twice) | Note | Info |
| E2E-W1 `delegation_progress/e2e_w1_supervisor.md:45-46` | D-2 (date filter set through the native setter), D-3 (demo actions on lane 3) | Deviations | Info |
**Count: 23 unique items.** That is 11 + 1 + 1 + 1 + 1 + 1 + 1 + 3 + 1 + 2: 21 decisions or notes, plus 2 deviations that the E2E-W1 log filed in its decisions table. All are Low or Info, and every one belongs to a row whose gate is PASS.

Items whose gate text I did not read against the item are **not** in this table; they are in Appendix A. That covers W03 DN-4, W24 DN-10, and W11 DN-2, DN-4, DN-5 and DN-8. W07 DN-6, at first a candidate, was found corrected in F27 ("corrected by step 29").

### 2.6 Proposal to close SC9 (controller action; this row may not edit `decisions.md`)

1. **Record one entry (D257).** It states that the decision requests listed in Appendix A and section 2.5 are accepted as built under their row's PASS gate, citing this report. It also says the W41 items are the row's own recorded decisions, tested in `apps/core-server/src/modules/identity/biometric/**`, and that D105's silence on them was an omission, not a refusal. This makes "every decision a row log reports is in decisions.md" true by reference.
2. **Same entry for deviations.** It acknowledges the agent deviations of the 50 logs in Appendix B (process slips: `cd` use, scratch files, run counts, driver limits), as D121, D147 and D186 already did one by one.
3. **Row-local findings stay in the row logs.** Appendix C lists the 20 logs whose gate entries never use the word "finding". Their F-n are row-local and were turned into DN items, rulings or F1-F79 entries by the gate.
4. **Optional:** record D220 as DR-15 (next-phase requirement drift), and re-sort the DR table to ascending order (cosmetic; ordering only, no content change).

---

## 4. Section (3): open items, consolidated and de-duplicated

The sources are:
- W101's O-1 to O-22 (`01_verification.md:155-178`)
- W88's O-1 to O-16 and section 8.3 (`99_implementation_report.md:492-548`)
- D190 and D218-D256
- this row's probes

Each item appears once, under its primary route; secondary routes are named in the item. Severity uses the source's word where one exists.

### 3(a) Pre-handover verification session (release build, user-requested depth; D232, D233, D250)

| # | Item | Severity | Evidence | Route detail |
|---|---|---|---|---|
| A1 | Release-build revoke-to-Pair under 1 s (W94 criterion; R-S-1) | Medium (criterion unmeasured on release) | Debug figures: 436 ms in W94 (D249), 1.23 s record-only in W98 (D252), 616-882 ms in RF-PH (D234). D218 moved it to release; D250 moved it to pre-handover | Measure in a release build at normal host load, signed in and signed out |
| A2 | Release-build monitor timer lag and stale monitor under load; lighter first render of the monitor; mobile frame statistics on release | Medium | D236 residuals; D250; W98 debug: 26-32 fps, 54-70 % janky frames (D252) | Same session |
| A3 | **RF2-2 / FXR-DEV-1 / W93-28**: the tablet learns of a web stop late under load (21.2 s at load about 14 in D249; 11.3 s at load 9.2 in W98) | Medium, cause not established | D237, D243, D249, D252 (the data supports a starved app thread in the debug build) | Re-measure on release. **Also next phase** (B11): find the exact wait point |
| A4 | RC-1: the Sessions hub duration can step back once when a stop is learned late (`apps/mobile/src/runtime/recording-elapsed.ts:129`) | Minor | D255 | Fix next phase ("keep the larger value"); device check pre-handover |
| A5 | Biometric device test not run (password sign-in, Enable offer, fingerprint). Also deferred with it: the W15 secure-store re-probe (W88 O-12, D190) and MB-6a on a physical release device (D71 DN37-2) | User decision (skip) | **D231**; covered by server db tests and mobile jest | Run at handover if the user wants it (also C7) |
| A6 | Long and repeated test campaigns, for example the R-P-1 crash fix: "0 of 11" is statistical (D218); repeated loops are reserved for handover | Process | D218, D232, D233 | Handover session only; W98's Simulated web comparison (not run, D252) belongs here too |

### 3(b) Next phase

| # | Item | Severity | Evidence |
|---|---|---|---|
| B1 | **Next-phase scope, D219-D230.** Device-selector configuration controlled from tablet, phone or web; real video and audio processing behind the API; block a new session until the last is sealed (D219). One active microphone per session with a manual switcher (D220, D221). Transcript inside the sealed package; STT on CPU and RAM only (D222, D223). One whole file per camera, append-only fragmented MP4 with a running SHA-256 (D224, D225). Sizing baseline is this PC; speaker labels mandatory when possible (D226). No benchmark on this PC; working STT first with Whisper large-v3-turbo through a CPU runtime (D229, D230). **Impact map** (`research/10_next_phase_impact_map.md`, 523 lines, D228): 75 to 88 operations (OpenAPI 0.3.0); migrations 0004/0005 (schema v2: 9 new and 5 changed tables); up to 165 of 630 test files touched; the `SIMULATED-SHA256` signature check at `apps/core-server/src/db/migrations/0001_tables.sql:336` blocks real signatures | Scope |
| B2 | **W99-1 dependency refresh:** `npm audit` 99 high / 0 critical (96 with `--omit=dev`), none on the Core runtime path; `undici` >= 7.29.1; proposed row W106; no blind `npm audit fix` | Medium (acknowledged CAUTION) — D248, D251 |
| B3 | W99-2: shared pairing bucket after a revoke can delay a new pairing up to 60 s (F76). W99-3: socket cap per session; undecodable paths unthrottled (F79) | Low; report sentence "before any use beyond one loopback computer" — D248 |
| B4 | W99-4: the `DEVICE_CREDENTIAL_REQUIRED` refusal writes no audit row | Low — D248 |
| B5 | **DR-1 / W92-1:** split `packages/shared/src/live/source/live-sim.ts` (2,683 lines; the `createLiveSim` closure is about 2,200 lines) along timer and subsystem seams, no behaviour change. Deferred with it: the W92-6, -12, -15 and -17 refactors (W92-12 also carries W88 O-4 FW76-1, "a rebuilt 422 has no HTTP status"); W92-27 kit-override upgrade checklist | Major (deferred) / refactor — D242 |
| B6 | W91-10 file splits (after W103); W91-17 runbook for `scripts/pg/server.mjs` | Minor — D241, D245 |
| B7 | HBX-13: convert the static source scanners to lint rules or the TypeScript compiler API | Governance — D241 |
| B8 | W93-10 in-place Pair and the dark Login-to-Pair frame (documented: an in-place Pair would mount two pairing flows); W93-18, -19, -26; W93-27 info | Minor / Low — D246 |
| B9 | FXR-DEV-2: Reanimated "Unable to find SurfaceMountingManager" warnings, about 104 per stop at the Finalizing hand-over, nothing visible (W93-26 class) | Low — D249 |
| B10 | **Test wall-clock independence:** `session-live/live-gap-read-only-dialog`, `settings/live-settings-boundary`, `session-live/live-session-live-link` (mobile) and `src/test/live-paired-devices-issue` (core-web). Mechanism: `01_verification.md:139-151`. Also: RC-8 redundant 20 s per-test timeouts after T1, and the `chrome-lost-updates` first-test residual (D246) | Test hygiene (SC7 cause) — D256, D255 |
| B11 | RF2-2 analysis: instrument the exact wait point (blocked JS thread or deltas waiting for a fresh copy); see A3 | Medium — D252, D243 |
| B12 | RC-2 to RC-7 nits: unused `EMPTY_TEMPLATE`; one log entry lost if the error-log folder is deleted; W98 lag sampler also runs in Simulated and release; panel boundary logs `componentStack`; C3 same-process check without a PID; no on-screen exit from "Checking your permissions..." | Nit — D255 |
| B13 | W100-4 `localhost` in the packaged-build CSP and the mock-core origin lists; `release/web/BUILD-INPUTS.txt:168` still pins the moved `apps/core-web/src/features/home/use-health.ts` (re-probed: the line holds that path) | Low / Info, next packaging — D247, D251 |
| B14 | QR scanning on the device (no camera module, no emulator camera; code entry only) | Deferred scope — DR-02, D11 |
| B15 | D249 observations: an empty frame Login to Home on the tablet; tablet Home mic tiles "No signal" while recording; audit rows of phone-sent session commands carry no device ID | Observation — D249 |
| B16 | Errata still owed to `masterplan/03_database_contract.md` (specs are not re-issued; W83's errata practice). (i) C2-R3: the NL-1, NL-5 and file-table sentences proposed in `gateway_check/10b_closing_fixes_c2.md:145-151`; `grep -c terse masterplan/03_database_contract.md` gives 0, so not applied. (ii) W90 F-4: terse logging still writes one `STATEMENT:` line per ERROR, placeholders only, no secret (`verification/03_clean_state_rebuild.md:218`; confirmed by C3, D244). (iii) W90 F-6: lock-message wording, cosmetic. (iv) W90 F-7 / C2-R2: a failed `pg:start` after the collector starts shows the wrong log tail, not exercised. (v) C3: the hour-change path of the log ring not exercised (D244) | Info, routed to W102 by D195 and D240; carry into the final report's errata section |
| B17 | Product question F69: a web-only Live demo cannot start a recording without a connected paired tablet; default "as specified" (`README.md:330`) | Product question — F69 (decision with the user: C5) |

### 3(c) User decisions pending

| # | Decision | Default if the user says nothing | Evidence |
|---|---|---|---|
| C1 | **Delete or keep the realtime test-support shim**, which has zero importers; a static test blocks new importers. It is kept because deleting it is a red line without the user's request | Keep | **D245** |
| C2 | Keep or delete the predecessor's AVDs `dems_phone`, `dems_tablet`, `dems_phone2` (measured 6.0 + 2.3 + 7.1 = **15.4 GB**). Their PIN was set by the predecessor's agents (F36) | Keep | D63 DN-7; probe `du -sh ~/.android/avd/dems*.avd` |
| C3 | After handover: keep or delete this task's AVDs `dems2_*` (2.5 + 2.5 + 2.0 = **7.0 GB**), and undo the user's own emulator lock on `dems2_phone` / `dems2_tablet` | Keep | X-1, X-3 of W88 section 5.2; D125 |
| C4 | The host's own PostgreSQL 18 on `*:5432` (PID 312, user `postgres`, running since 2026-10-01 16:47:43) and `/Library/LaunchDaemons/postgresql-18.plist` (root, Sep 12 14:19). **Not this task's.** Keep the project-local instance (default) or point the backend at it | Keep the project-local instance | F27, D26, W99 E-21 (`verification/02_security.md:319, 371`); `ps` probe 11:41 |
| C5 | F69: may a web-only Live demo record? This needs a demo control that marks the tablet link connected | As specified (no) | F69; W101 O-18 |
| C6 | `.git/refs/.DS_Store` makes `git fsck` exit 8. **Still present** (6,148 bytes, Oct 4 00:54). Fix: `rm .git/refs/.DS_Store` | Leave | F3 |
| C7 | Biometric device test at handover, or accept the skip as final (with the W15 re-probe and MB-6a) | Skip stays (D231) | A5 |
| C8 | Host clean-up after handover: which of section 4.4's removals to run (PostgreSQL data, emulators, adb rules, caches) | Nothing removed | Plan section 14.3 ("run only on the controller's or the user's instruction") |
| C9 | Standing information for handover, no action unless the user wants it: (i) any network exposure beyond loopback first needs the seeded demo password replaced (D16 C1-C4; `README.md:228`); (ii) a Live package for another PC is a separate task (D11 TD-13); (iii) installing a CPU STT runtime in the next phase needs the user's approval (D230) | - | D16, D11, D230 |

### 3(d) Items for the final commit W103

| # | Item | Evidence and measured state (11:40-11:50) |
|---|---|---|
| D1 | **Evidence logs.** Add `!docs/**/assets/*.log` to `.gitignore` **after** a count-only secret scan of those logs; any hit keeps that file out, by name | D190 O-1; F39. `.gitignore:48` is `*.log`; no exception line exists. **890** ignored `.log` files under the task folder now (650 at W88): `git ls-files --others --ignored --exclude-standard -- docs/2026-10-04_dems_backend_rbac_pairing \| grep -c '\.log$'` |
| D2 | **Frame dumps** go into `.gitignore`, not deleted (D227). Six folders, **2,658 files, about 600 MB**, under `test/assets/`:<br>- `retest/t_tablet/rec/j_stop_frames` (131, 28 MB)<br>- `retest2/t/rec/e_run1_frames` (890, 197 MB)<br>- `retest2/t/rec/e_run2_frames` (154, 27 MB)<br>- `retest2/t/rec/e_run2b_frames` (434, 113 MB)<br>- `retest2/t/rec/e_run3_frames` (1,039, 233 MB)<br>- `retest2/t/rec/rt2_verify_frames` (10, 2.8 MB)<br>One pattern covers all: `docs/**/rec/*_frames/` | D227; `find ... -type d -name '*_frames'` |
| D3 | `release/web/BUILD-INPUTS.txt:168` stale path: left to packaging. `/release/` is never staged (`.gitignore:64`) | D247, D251 |
| D4 | **Stage one tracked deletion:** `apps/core-web/src/features/home/use-health.ts` (`git status`: ` D`). It is the intended move to `lib/health-query.ts` | D242, D247; W99 I-9 (D248) |
| D5 | Size of what is staged by explicit path. The task folder is **2.0 GB**: `test/assets` 1.3 GB, `implementation/assets` 249 MB, `gateway_check/assets` 197 MB, `verification/assets` 163 MB. 6,092 untracked, non-ignored files. The two galleries are self-contained (16.6 MB with 625 embedded images; 17.7 MB with 770), so they need no asset path | `du -sh`; `grep -c 'data:image'` |
| D6 | **Captures after the SW sweep.** SW's image OCR sweep (D215) covered `test/assets/e2e/**`, `test/assets/retest/**` and `gateway_check/assets/11b_*`. Later captures had per-row **text** scans only: `test/assets/retest2/` (RF-PH, RF-T), `retest3/` (RF2), `verification/assets/e2e_final/` (W94-W96) and `08_performance_realtime/`. RF-PH blacked out one redeemed code by hand (D234). A count-only image check, or an explicit acceptance, before staging those folders | D215, D234; `test/10a_final_retest_phones.md:317`, `test/11_final_check_cf2.md:199`, `verification/06_e2e_pairing.md:96` |
| D7 | Accountability trail (section 6): append the missing delegation rows, including the T1 and T2 sonnet overrides (CLAUDE.md section 11, rule 3), **before** W103 stages `delegation_progress_report.md` | `delegation_progress_report.md:289-299` |
| D8 | W101 status line and plan tracking, left to the controller (`01_verification.md` section 8) | - |
| D9 | W103's own checks per plan: `git remote -v` empty; the excluded paths ignored (`.data/`, `.cache/`, `.locks/`, `release/`, `apps/mobile/signing/`, env files, the design book); a count-only search of the commit for the three credential values. Re-probe 11:40: remote 0 lines; `.gitignore` holds `/.data/` (70), `.cache/` (47), `.locks/` (59), `/release/` (64), `apps/mobile/signing/` (65) | Plan row W103 (`02_plan.md:782`) |
| D10 | Decision-log follow-ups from section 2.6: D257 blanket record; optional DR-15 for D220; optional DR re-sort | Section 2 |
| D11 | Final-report sentences to carry: the W83 residuals R-C1 to R-C6 and R-D2 to R-D5 (D184; README / report sentences in `83_contract_closeout.md` P2.5); RESIDUAL-W77-1 (D172); W92-28 S20 amendment (D242); W100-2 accepted risk (offline sign-out not retried; the server session idles out in 15 min; D251); the D113 Info items before use beyond one loopback computer; F50 (licences if a release bundles the PostgreSQL binaries); MB-6a (D71) | W88 section 11; D184, D242, D251 |

### 3(e) Closure map of the earlier open-item lists (for de-duplication)

| Source item | Status now |
|---|---|
| W88 O-1 (evidence logs) | Open, D1 |
| W88 O-2 (log names W72, W73, W76, W80) | Accepted, D190 |
| W88 O-3 (idle expiry on a refused POST) | Answered by W99: does not move (D248) |
| W88 O-4 (FW76-1, -3, -6) | FW76-3 fixed (W92-13, D247); FW76-6 accepted (D190); FW76-1 deferred with W92-12 (B5) |
| W88 O-5 (CPW1-2) | Superseded by D144 |
| W88 O-6, O-10 (stale comments) | Done in C2 (D195) |
| W88 O-7 (unguarded boot) | Done in C2 (D195); W92-2 in FXR-W (D247) |
| W88 O-8 (F43 relabel to W99) | Erratum recorded (D190) |
| W88 O-9 (KI-07 is 62) | Confirmed 62 in W97 (D253) |
| W88 O-11 (numeric prefix 10_) | No collision (D190) |
| W88 O-12 (W15 re-probe) | Deferred by D231 (A5) |
| W88 O-13 (tracker lines) | Done (D190) |
| W88 O-14 (CPS1-9) | Done in C2, proven on the new cluster by W90 (D240) |
| W88 O-15 (B2b leftovers), O-16 (HB numbers) | W91, then FXR-S (D241, D245); HBX register accepted (DN-W91-1) |
| W88 section 8.3 user items | C2, C4, C5, C6, C7, C9; the "W90 removes `.data/`" item is done (D238 user go, D240) |
| W101 O-1 (SC7) | Ruled D256 |
| W101 O-2, O-3 | A1, A2 |
| W101 O-4 | A3, B11 |
| W101 O-5 | A4 |
| W101 O-6 | A5, C7 |
| W101 O-7 | A6 |
| W101 O-8 | B2 |
| W101 O-9 | B3 |
| W101 O-10 | B4 |
| W101 O-11 | B13; W100-2 in D11 |
| W101 O-12 | B5; W92-28 in D11 |
| W101 O-13 | B6, B7 |
| W101 O-14 | B8, B9 |
| W101 O-15 | B10, B12 |
| W101 O-16 | C1 |
| W101 O-17 | D11 |
| W101 O-18 | B17, C5 |
| W101 O-19 | B16 |
| W101 O-20 | B15 |
| W101 O-21 | D1 |
| W101 O-22 | This row |

**Counts:** (a) 6, (b) 17, (c) 9, (d) 11. **43 distinct items, 0 blocking.**

---

## 5. Section (4): host state left behind, with removal commands

### 4.1 Probes (2026-10-07 11:40-11:43 WIB, read-only)

| Probe | Output (abridged, verbatim values) |
|---|---|
| `lsof -nP -iTCP -sTCP:LISTEN` (filtered) | `postgres 47413 ... TCP 127.0.0.1:4432 (LISTEN)`; qemu on 5554-5559 (both 127.0.0.1 and ::1); `adb 83893 ... 127.0.0.1:5037`. **Nothing** on 4400, 4410-4423, 5173, 5176-5178 or 8081 |
| `cat .locks/postgres.pid` | `47413` (file time Oct 7 11:38) |
| `ps -axo pid,ppid,lstart,command` (sandbox off) | `47413 Wed Oct 7 11:38:19 2026 .../DEMS/node_modules/@embedded-postgres/darwin-arm64/native/bin/postgres -D .../DEMS/.data/postgres -c listen_addresses=127.0.0.1 ...`<br>qemu `-avd dems2_phone -port 5554` and `-avd dems2_tablet -port 5556` (started Tue Oct 6 09:25:00); `-avd dems2_phone2 -port 5558` (Oct 6 09:34:27); their crashpad handlers and `netsimd`<br>`adb -L tcp:5037 fork-server server` (PID 83893, Sun Oct 4 06:26:54)<br>**five `adb -s emulator-55xx logcat ... -s ReactNativeJS:V`**, PPID 1: PIDs 58999 (08:54:19, 5558), 2673 (10:03:43, 5556), 5928 (10:10:18, 5556), 6550 (10:11:43, 5556), 8932 (10:15:33, 5558)<br>`312 postgres ... /Library/PostgreSQL/18/bin/postgres -D /Library/PostgreSQL/18/data` (Oct 1 16:47:43)<br>no Vite, Metro, mock-core or Core server of this project. Another project's processes (SMART WMS `tsx watch`) were seen and not touched |
| `adb devices -l`; `adb -s <s> reverse --list`; `adb -s <s> emu avd name` | emulator-5554 `dems2_phone`, emulator-5556 `dems2_tablet`, emulator-5558 `dems2_phone2`. **Each holds `host-16 tcp:8081 tcp:8081` and `host-16 tcp:4420 tcp:4420`** |
| `ls -d ~/.android/avd/*.avd; du -sh` | dems2_phone 2.5G, dems2_phone2 2.5G, dems2_tablet 2.0G, dems_phone 6.0G, dems_phone2 2.3G, dems_tablet 7.1G |
| `du -sh .data .cache .locks node_modules` | 117M, 5.6G, 172K, 14G. `node_modules/@embedded-postgres` 144M |
| `ls .data` (credential names withheld) | `postgres/`, `postgres.log`, `pg-scripts.log`, 3 credential files. Mode `drwx------` |
| `.cache/` breakdown | `release/` 2.5G (Oct 1) and `npm/` 1.4G (Oct 4 00:29): **predecessor**, before this task's first row at 06:26. `apk-backup/` 309M; `rollback/` 70M; `manual/` 2.0M (20 logs); proofs about 27M; **55 per-row scratch folders** (`W22` ... `w97`, `cf*`, `fx*`, `m*`, `copy`) **about 1.25 GB** |
| `ls -la .locks` | PID, lock and log files of postgres, core-server (main and lanes 1-3, incl. vite pid files), db-migrate, the `dems2_*` and `dems_*` emulators, plus predecessor files (gradle, npm, vite, mock-core, Oct 1); the two `*.users/` marker folders (empty) |
| `ls ~/Library/Caches/ms-playwright` | chromium-1234 and headless-1234 (Sep 12), chromium-1243 and headless-1243 (Sep 15), ffmpeg-1011 (Sep 12); 1.1G. **Predates this task** (2026-10-04); not created by it |
| `ls -l /Library/LaunchDaemons \| grep -i postgres` | `root wheel 614 Sep 12 14:19 postgresql-18.plist`: the `*:5432` server's (F27); **not this task's**. `~/Library/LaunchAgents`: 0 names with postgres or dems |
| `ls -d /opt/homebrew/opt/postgresql@18 /opt/homebrew/var/postgresql@18 ~/.pgpass` | all "No such file". Fallback Fb never used |
| `ls apps/core-server/logs` | No such directory (X-7: never written) |
| `git log --oneline -1; git remote -v \| wc -l` | `057fc17`; 0 |

### 4.2 Comparison with plan section 14 (H-01 to H-18), W88 section 5, and W90's log

| ID | Plan section 14.2 | W90 (`verification/03_clean_state_rebuild.md` section 12, end state 05:36) | Now (11:40) | Match |
|---|---|---|---|---|
| H-01 | npm packages, about 148 MB | not changed | `@embedded-postgres` 144M in `node_modules` | yes |
| H-02 | cluster, 3 credential files, log in `.data/` | removed and rebuilt (RB-02 **proven**) | `.data/` 117M, mode 700, 3 credential files + 2 logs + `postgres/` | yes |
| H-03 | postgres on `127.0.0.1:4432`, PID in `.locks/postgres.pid` | RUNNING, PID 32434 | RUNNING, **PID 47413** (restarted 11:38:19 after the controller's closing runs, D256) | yes (PID changed by plan) |
| H-04 | Core servers 4420-4423 | stopped, ports free | none listening; stale PID/lock files in `.locks/` | yes |
| H-05 | `adb reverse tcp:4420` | 5558 had `tcp:4420`; 5554 and 5556 had lane rules. D240: the controller removed `tcp:4420` on all three | **`tcp:4420` back on all three** (W94 set new rules, D249) **plus `tcp:8081` on all three** | partly: **`tcp:8081` is not in section 14** (N-1) |
| H-06 | debug APK on the emulators | - | installed (not re-probed: needs `pm` queries) | as recorded |
| H-07 | device credential and tokens in app storage | - | phone DEV-0003, tablet DEV-0004, phone2 DEV-0005 paired to main; DEV-0002 revoked (D252, D253) | as recorded |
| H-08 | browser cookies and `dems.core.mode.v1` | - | browser profiles of the rows (not probed) | as recorded |
| H-09 | network caches | - | caches only | yes |
| H-10 | AVD camera settings not changed | - | not changed (DR-02) | yes |
| H-11 | `.locks/` files | - | present (section 4.1) | yes |
| H-12 | Homebrew fallback | - | absent | yes (never used) |
| H-13 | per-command sandbox bypass | - | session only | yes |
| H-14 | three emulator processes | "already booted" | running: phone and tablet booted **by the user** at Oct 6 09:25, phone2 at 09:34 (D192: the user's own Terminal); the W02b boots of Oct 4 ended at about 09:20 Oct 6 | yes (owner is the user since D192) |
| H-15 | roles and databases | `dems_demo`, `postgres`, `template0`, `template1`; lane databases gone | not re-probed (would need a DB connection); no later row created lanes (W94-W98 used main) | as recorded |
| H-16 | two markers removed | - | `.locks/mock-core.users/` and `.locks/vite.users/` exist, empty | yes |
| H-17 | `.cache/` scratch (proofs, rollback, APK backup) | - | present, plus 55 per-row folders and `manual/` | **partly: RB-17 covers only proofs and rollback** (N-3, N-4) |
| H-18 | Vite and Metro of live checks | none | none | yes |
| X-1 to X-9 (W88 section 5.2) | not in plan | - | X-1 `dems2_*` AVDs present; X-2 `dems_*` kept; X-3 user lock (not probed, as recorded); X-4 adb server running since Oct 4 06:26:54; X-7 `apps/core-server/logs` absent; others as recorded | yes |

**New since W88 and not in plan section 14:**

| ID | Item | Evidence | Owner |
|---|---|---|---|
| N-1 | `adb reverse tcp:8081` on emulator-5554, -5556 and -5558 (Metro), next to `tcp:4420` | `adb reverse --list` probe | The device rows (W94-W100) |
| N-2 | **Five orphaned `adb logcat` processes** (PPID 1): 58999, 2673, 5928, 6550, 8932 | `ps` probe | **Hypothesis:** the device-log captures of the W94-W96, W100 and PT window (08:54-10:15 today); not stated in their logs |
| N-3 | 55 per-row scratch folders in `.cache/` (about 1.25 GB), not covered by RB-17 | `du -sck` | This task's rows |
| N-4 | `.cache/manual/` (20 logs of the controller's manual Live stack, incl. the server logs the gates cite) | `ls .cache/manual` | Controller (D192, D206, D249) |

**Not this task's and not to be removed by it:**
- `/Library/LaunchDaemons/postgresql-18.plist` (Sep 12) and the `*:5432` server (F27, W99 E-21)
- the Playwright cache (Sep 12/15)
- `.cache/release` and `.cache/npm` (predecessor)
- the `dems_*` AVDs (predecessor; kept by D63)
- other projects' processes

### 4.3 What a user sees as running right now

1. PostgreSQL on `127.0.0.1:4432` (PID 47413).
2. Three emulator windows (`dems2_phone`, `dems2_tablet`, `dems2_phone2`) with their qemu, crashpad and netsimd helpers.
3. The adb server (5037).
4. Five orphaned `adb logcat` readers.

Nothing else of this project listens.

### 4.4 Removal commands (verbatim; none was run by this row; run only on the user's or controller's instruction)

Run from the workspace root. `ROOT`, `PGBIN` and `PGDATA` are as in plan section 14.3.

```sh
ROOT=/Users/gsp-budi/Documents/DEMS
PGBIN="$ROOT/node_modules/@embedded-postgres/darwin-arm64/native/bin"
PGDATA="$ROOT/.data/postgres"
ADB="$HOME/Library/Android/sdk/platform-tools/adb"

# 1. Stop PostgreSQL (H-03, RB-03)
npm run pg:stop                                   # = "$PGBIN/pg_ctl" -D "$PGDATA" -m fast -w stop
lsof -nP -iTCP:4432 -sTCP:LISTEN                  # expect no output

# 2. Remove the cluster, credentials and logs (H-02, H-15; RB-02, proven by W90)
npm run pg:remove-data                            # stops the server and deletes .data/

# 3. Remove the PostgreSQL binaries and the root driver (H-01; RB-01, written only)
npm run pg:remove                                 # = RB-02 then RB-01:
#   /usr/bin/lockf -k -t 3600 "$ROOT/.locks/npm.lock" npm uninstall embedded-postgres pg
#   npm install-scripts prune

# 4. adb reverse rules of this task (H-05 and N-1)
for s in emulator-5554 emulator-5556 emulator-5558; do
  "$ADB" -s "$s" reverse --remove tcp:4420
  "$ADB" -s "$s" reverse --remove tcp:8081
done                                              # README form: "$ADB" -s <serial> reverse --remove-all

# 5. Orphaned logcat readers (N-2). Check first that the PIDs still are these commands
ps -p 58999,2673,5928,6550,8932 -o pid,command
kill 58999 2673 5928 6550 8932

# 6. Emulators (H-14): the USER's action, never an agent's (plan RB-14, BP:418)
#    Close each emulator window, or from the user's own Terminal:
#    "$ADB" -s emulator-5554 emu kill ; likewise emulator-5556, emulator-5558
# 7. adb server (X-4)
"$ADB" kill-server

# 8. AVDs (X-1 this task; X-2 predecessor, D63 DN-7): the user's decision, after step 6
zsh -l -c 'avdmanager delete avd -n dems2_phone'    # likewise dems2_tablet, dems2_phone2
# zsh -l -c 'avdmanager delete avd -n dems_tablet'  # predecessor: only if the user decides (C2)
# Before deleting dems2_phone / dems2_tablet, the user's lock can be undone (X-3, D125):
# apps/mobile/scripts/emulator-user-lock.sh remove phone ; ... remove tablet

# 9. Lock, PID and log files (H-11, RB-11; extended by the emulator files this task wrote)
rm -f "$ROOT"/.locks/postgres.pid "$ROOT"/.locks/postgres.lock "$ROOT"/.locks/db-migrate.lock "$ROOT"/.locks/contract.lock \
      "$ROOT"/.locks/core-server*.pid "$ROOT"/.locks/core-server*.lock "$ROOT"/.locks/core-server*.log
rm -f "$ROOT"/.locks/dems2_*.pid "$ROOT"/.locks/dems2_*.emulator.log

# 10. Scratch (H-17, RB-17 plus N-3 and N-4). Keep .cache/apk-backup until the task has ended (RB-06).
#     .cache/release and .cache/npm belong to the predecessor: not removed here.
rm -rf "$ROOT"/.cache/proof-engine "$ROOT"/.cache/proof-harness "$ROOT"/.cache/proof-harness-w05b \
       "$ROOT"/.cache/proof-drizzle "$ROOT"/.cache/rollback "$ROOT"/.cache/manual
( cd "$ROOT/.cache" && ls | grep -v -x -E 'release|npm|apk-backup' )   # review this list, then:
# ( cd "$ROOT/.cache" && rm -rf $(ls | grep -v -x -E 'release|npm|apk-backup') )

# 11. Device credentials and browser state (H-07, H-08; RB-07, RB-08)
#     Portal: Paired Devices -> Revoke; app: Settings -> Pairing -> Unpair (no "pm clear" without a decision).
#     Browser: sign out; localStorage.removeItem('dems.core.mode.v1') on 127.0.0.1:5173/5176/5177/5178; clear 127.0.0.1 cookies.

# 12. Debug APK back to the predecessor build on one emulator (H-06, RB-06 as amended by D34)
"$ADB" -s emulator-5554 install -r -d "$ROOT/.cache/apk-backup/app-debug.apk"

# 13. Recreate the two markers (H-16, RB-16), only if the predecessor's manual-test convention is wanted again
mkdir -p "$ROOT/.locks/mock-core.users" "$ROOT/.locks/vite.users"
touch "$ROOT/.locks/mock-core.users/user-manual-test" "$ROOT/.locks/vite.users/user-manual-test"
```

**No command is given** for these, because they are not this task's:
- the `*:5432` server and its LaunchDaemon (C4)
- the Playwright cache
- `node_modules` as a whole: it is the project's, and H-01 is removed by step 3
- `.cache/release` and `.cache/npm`

The tracked-source rollback stays as plan section 14.3 states it (`git checkout acaff20 -- ...` or the checkpoint commits), only on explicit request.

---

## 6. Section (5): test ledger

### 5.1 Final ledger (files / tests)

| Workspace | Final | Source of the last full green run | Baseline `acaff20` (D10) |
|---|---|---|---|
| shared | **71 / 1,851** | D247 (08:34); W101 closing run (`01_verification.md:118`) | 28 / 508 |
| core-web | **117 / 1,495** | D247; W101 closing run; T2 run (one failure, 20/20 alone twice, D256) | 39 / 436 of 438 |
| mobile | **192 / 1,988** | PT (D254); T2 run all pass (D256) | 72 / 833 |
| core-server `unit` | **160 / 3,954** | FXR-S (D245); W101 closing run | - |
| core-server `db` | **124 / 1,751** | W101 closing run (`test:db` exit 0, 8 databases dropped) | - |
| mock-core | **4 / 19** | W101 closing run | 4 / 19 |
| pg-scripts | **57** tests | W101 closing run (`ℹ tests 57 / pass 57 / fail 0`) | - (55 at W07, D32) |

**Totals:** 668 test files and 11,058 tests in Vitest and jest (shared + core-web + mobile + unit + db + mock-core), plus 57 node tests for pg-scripts. Typecheck and lint exit 0 in every workspace (W101 steps 3-4; D256).

### 5.2 Ledger milestones after W88 (W88 section 6.1 holds the earlier ones)

| When | Source | shared | core-web | mobile | unit | db | mock-core | pg-scripts |
|---|---|---|---|---|---|---|---|---|
| W87 final | D189 | 69 / 1,840 | 103 / 1,392 | 145 / 1,743 | 154 / 3,916 | 122 / 1,740 | 19 | 55 |
| C1 | D193 | 69 / 1,840 | - | 146 / 1,744 | - | - | - | - |
| C2 | D195 | 69 / 1,840 | 104 / 1,396 | - | - | - | - | 57 |
| E-fix | D202-D208 | 70 / 1,848 | 109 / 1,427 | 160 / 1,834 | 155 / 3,926 | 124 / 1,751 | - | - |
| CF / CF2 | D216-D236 | - | 111 / 1,436 | 181 / 1,932 | - | - | - | - |
| W89 ledger | D238, D239 | 70 / 1,848 | 111 / 1,436 | 181 / 1,932 | 155 / 3,926 | 124 / 1,751 | 19 | 57 |
| FXR + T1 | D245, D247 | **71 / 1,851** | **117 / 1,495** | 191 / 1,985 | **160 / 3,954** | 124 / 1,751 | 19 | 57 |
| PT | D254 | - | - | **192 / 1,988** | - | - | - | - |
| W101 + T2 | D256 | 71 / 1,851 | 117 / 1,495 | 192 / 1,988 | 160 / 3,954 | **124 / 1,751** | **19** | **57** |

Coverage at W87: backend lines 96.93 %, statements 95.78 %, branches 90.12 %, functions 97.81 % (D189). No later coverage run is recorded.

**Root `npm test` (SC7):** exit 1 three times today at high load, from different files each time; every one passes alone. Ruled an acknowledged CAUTION in D256. T2 (`maxWorkers: '50%'` in `apps/mobile/jest.config.js`) is kept.

---

## 7. Section (6): agent and model usage notes

### 6.1 Overrides recorded in `delegation_progress_report.md`

| Row | Override | Reason (as recorded) | Trail line |
|---|---|---|---|
| Row 20c (data-analyst) | R to D (sonnet) | mechanical, already-specified citation patch | `:45-46` |
| W02 (coder-execution) | sonnet | plan tier D: mechanical boot commands | `:50-51` |
| W14 (coder-execution) | sonnet | plan tier D | `:66, 70, 75` |
| W01c (coder-execution) | sonnet | specified one-pattern test patch | `:78-79` |
| W85 (coder-execution), incl. two follow-ups | sonnet | plan tier D: licence text read from disk | `:104, 108-111` |
| Static-scan slot F W3-3 | sonnet | mechanical one-line change | rows dated 2026-10-06 ("tier D by §11") |
| Whole resumed run 2026-10-05 | every agent to its `*-local` variant | D130 | `:217` |
| Helper follow-up 3 (W11b3) | local to non-local `database-specialist` | the local variant failed twice | DR-13, D140; `:220, 225` |
| C2 | "coder-execution (opus)" | the session model, i.e. tier R; recorded explicitly, not a downgrade | `:289` |

### 6.2 Overrides recorded only in `decisions.md`

| Row | Override | Where recorded | Missing from |
|---|---|---|---|
| T1 (mobile jest `testTimeout` 20,000 ms) | sonnet coder row | D247; `gateway_check/16_t1_mobile_jest_timeout.md` | `delegation_progress_report.md` (CLAUDE.md section 11, rule 3) |
| T2 (mobile jest `maxWorkers: '50%'`) | sonnet coder row | D256; `gateway_check/18_t2_mobile_jest_workers.md` | the same |

Rules checked:
- **No verification-phase agent was downgraded.** W89-W101 and RC ran on verifier, senior-code-reviewer and security-review at tier R; each gate entry names the agent.
- **No entry agent was downgraded.** The trail says so at `:6` and `:38`.
- **"Escalate once" was honoured.** DR-13 is the only escalation.

### 6.3 Gaps in the accountability trail (CLAUDE.md section 3)

The trail's last dated row is 2026-10-06 (manual Live stack, `:288`). Its last eleven rows (`:289-299`) carry a row label instead of a date.

**No row exists** for these delegations, which `decisions.md` gates:
- CF-M1, CF-M2, CF-W (D216-D218)
- SW (D215)
- RF-T, RF-PH (D227, D234)
- CF2-A, CF2-B (D235, D236)
- the next-phase impact map (D228)
- W90 (D240), W91 (D241), W92 (D242), W93 (D243)
- FXR-S, FXR-W (D245, D247)
- T1, T2, PT (D247, D254, D256)
- W98 (D252), W99 (D248), W100 (D251)
- RC (D255), W101 (D256)

That makes **about 22 delegations**. Their primary artifacts and (except T1, T2 and PT) their `delegation_progress/*.md` files exist; `ls delegation_progress | grep -i -E 't1|t2|pt_|tidy'` gives nothing. The controller should append these rows before W103 stages the trail (D7). This row appends its own row only.

---

## Appendix A: decision requests not confirmed one by one (gate rules the row in prose or numbered rulings; item-to-ruling match not made)

| Row and log | Items | Gate | Note |
|---|---|---|---|
| W03 `implementation/03_npm_slot_n1_server_shared.md:700` | DN-4 | D27 | Entry paths of the workspace scripts; likely implicit in the accepted manifest |
| W24 `implementation/24_identity_core.md` | DN-10 | D78 | D78 rules DN-1 to DN-9, DN-11, DN-14 to DN-16; DN-13 is a "pass to" note |
| W11 `implementation/11_db_test_helper.md:656-660` | DN-2, DN-4, DN-5, DN-8 | D48 | Template names, clone lock, PG-27 wording, root typecheck re-run |
| W13 `implementation/13_npm_slot_n3_mobile_native.md:883+` | DN-2 to DN-6 | D34 | D34 holds several rulings (`adb install -r -d`, `deps:check` dropped) |
| W16 `delegation_progress/coder_execution_step_38.md` | DN-4, DN-5 | D37, D41 | |
| 46b `delegation_progress/coder_execution_identity_security_lows.md` | DN-1 to DN-6 | D126 | D126 rules with GD-n numbering |
| W25 `implementation/25_db_bulk_fixture.md` | DN-8 to DN-11 | D73, D103, D109 | |
| W29 `implementation/29_db_reset_routine.md` | DN-7 | D74, D79 | |
| W32 `implementation/32_pairing_device_registry.md` | DN-4, DN-9 to DN-12 | D93 | |
| W33 `implementation/33_user_role_admin.md` | DN-1 to DN-12 | D91 | Prose rulings cover self-change, disable publication, mirror failure, ID errors, audit type, no password operation |
| W34 `implementation/34_module_sessions.md` | DN-4, DN-7 to DN-10 | D94, D108 | |
| W35 `implementation/35_module_evidence.md` | DN-9 to DN-11 | D92 | |
| W36 `implementation/36_module_devices.md` | DN-2 to DN-4 | D89 | |
| W42 `implementation/42_realtime_channel.md` | DN-5 | D99, D111, D120 | |
| W43 `implementation/43_module_demo_controls.md` | DN-2, DN-6 to DN-10 | D101, D106 | |
| W51 `implementation/51_mobile_runtime.md` | DN-1, DN-7 to DN-9 | D124 | D124 rules (2)-(6) |
| W64 `implementation/64_web_session_new.md` | DN-2, DN-5, DN-6 | D153 | D153 rules (1)-(5) |
| W68 `implementation/68_mobile_session_live.md` | DN-5 to DN-7 | D170 | D170 rules (1)-(4) |
| W48 `test/04_pairing_lifecycle.md` | DN-1 to DN-4 | D116 | |
| W49 `test/05_shared_state_realtime.md` | DN-1 to DN-4 | D119 | D119 rules W49-F1 to F4 |
| W52 `test/03_contract_conformance.md` | DN-1 to DN-5 | D115 | |
| W53 `test/06_restart_recovery.md` | DN-1 to DN-7 | D110 | Prose rulings: time base, F3, F4, deviations |
| W11b `implementation/11b_db_helper_forced_drop_retry.md` | DN-6 | D114, D134 | |
| W1 `gateway_check/08b_w1_web_closing.md` | DC-4 to DC-6 | D182 | |

93 unique items in total. The proposal in section 2.6 (one D257 entry by reference) covers them without re-reading each gate.

## Appendix B: logs whose deviations are not referenced by the gate entry (no "deviation", "slip" or "incident" in it)

The figure after each row is the number of deviations in its log. Where a row has a progress-file copy, the larger count is shown.

| Area | Rows (deviation count) |
|---|---|
| Early, backend and contract | W03 (6), W08 (9), W09 (11), W11 (9), W11b (8), W13 (7), W14 (3), W16 (4), row 20c (4), W23 (9), W24 (8), W24b (5), W25 (20), W33 (5), W36 (5), W37 (7), W39 (5), W40 (8), W41 (8), W43 (7), W85 (5); 04a (8); 04b (13) |
| Client rows | W54 (14), W55 (11), W57 (15), W59 (1), W60 (2), W67 (6), W69 (7), W70 (5), W71 (7), W73 (6), W75 (6), W80 (4), W81 (6), W86 (1) |
| Acceptance, E2E and verification | W48 (11), W52 (5), RF2 (3), W94-W96 (5 + 1 in `verification/05`), FXR-M device checklist (4), W98 (7) |

50 logs, 44 rows. The other 50 logs that define deviations have gate entries that record them in prose: for example D124 "Deviations accepted", D147 "Deviations DV-a ...", D227 "Deviations: ...".

## Appendix C: logs whose findings are not referenced by the gate entry (no "finding" or F-n in it)

W04, W07, W08, W11, W13, W14, W20, W23, W39, W42 (progress file), W51, W59, W85, 04b, and `request_translator_resume`. That is 20 logs (with progress-file copies), 15 rows.

In most of them the row's F-n reappear as DN items that the gate rules. For example, W07 DN-1 to DN-7 cite F-1 to F-7, and D32 rules them. Others became controller findings under their own numbers (F58, F70, F76 ...). So this appendix is a coverage note, not a list of lost findings.

---
*Generated: 2026-10-07 12:05 WIB*
*Last Updated: 2026-10-07 12:05 WIB*
