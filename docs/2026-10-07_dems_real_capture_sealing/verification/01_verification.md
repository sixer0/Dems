---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-11
agent: verifier
row: 98 (M9 final chain, step 1 of 4)
tree: commit 713d83f (main, local); working tree = that commit plus two uncommitted docs files (decisions.md with D240, one untracked progress note)
source_plan: docs/2026-10-07_dems_real_capture_sealing/identification/02_structured.md (rev 2.4), masterplan/02_plan.md
status: needs-review
verdict: PASS WITH CONDITIONS
---

# 01 - Final verification of task 3 (blueprint row 98)

Verifier only. No product file, no test file and no other file under `docs/` was changed; this is
the one file written. No git write, no install, no lane, no device, no browser, no port of the
forbidden list, no `.data/pg*.env`, no local-device recording opened, no local-device selector
touched. No credential, token, fixture account or key material is in this file.

## 0. What this verification is, and what it is not

| Done by me | How |
|---|---|
| Read: `identification/01_original.md`, `01_translated.md` (both parts), section 1-3 of `01_translated_resume_2026_10_09.md`, row 98 and section 5 of `02_structured.md`, the row table 41-142 (owner, output, dependencies), `status_tasks.md` (whole), decisions D1-D30 (D4, D20, D24 whole; the others their first 650 characters), D72-D80, D88-D90 (first 500 characters), **D120-D240 whole**, the driver rules | file reads |
| Read: the verdict, conditions, findings and not-proven sections of gate reports `08`, `09d`, `10e`, `11b`, `10d`, `12d`, `13d`, `14`; the head, pin sweep, not-run list and findings of `test/16`; the head and red list of `test/12`, the head of `test/11`; the structure and proof section of `implementation/163` | file reads |
| Read in code: the ten places of section 5 (and three extra) | file reads, `grep` |
| Counted from sources: OpenAPI operations, schema version, migration files | one `node -e`, `sed`, `ls` |
| Ran: ONE test file, `packages/shared/test/api-registry.test.ts` | `uptime` 20:45 load 1.55; `npx vitest run --root packages/shared test/api-registry.test.ts` -> `Test Files 1 passed (1)`, `Tests 42 passed (42)` |

| NOT done by me (stated so that nothing is taken as checked) |
|---|
| No whole suite, no heavy run, no device or browser flow. The whole suites and heavy runs on `713d83f` belong to the parallel final test agent (row 100) |
| Decisions D31-D71 and D81-D119 were not read (the brief asked for D1-D30 and D120 on). Rows whose rulings sit there are traced by artifact and commit, not by decision text |
| The implementation notes were not opened one by one (164 files); a row's "done" is judged by: its artifact exists and is non-empty, a decision or commit names it, and a later gate or run exercised it |
| **M9-CH-1 as the blueprint row words it ("the whole check catalogue n/n per milestone", about 330 active checks, D89) was NOT reconciled check by check.** The brief of this row replaced it by the seven sections below. The check-by-check reconciliation is row 100's (M9-CH-3) |
| `masterplan/02_plan.md` tracking table and `implementation/99_implementation_report.md` were not written: the brief allows this one file under `docs/` |

Words used below: **LIVE-FAKE** = driven through the product on a running lane (web console, tablet
or phone emulator, or the lane's API) with generated sources, by an independent gate verifier.
**TEST** = proven by an automated test or an e2e run with the built worker, not by a gate session.
**NOT PROVEN** = neither.

---

## 1. Intent alignment

Sources of the requirements: `identification/01_translated.md:103-113` (R-1..R-7), decision D20
(R-8), D73-D78 (R-9..R-11), `masterplan/01_specs.md:140-216` and `:281-341`; the later user
instructions are cited by decision.

| # | Requirement | Specified | Built (module) | Proven | Status |
|---|---|---|---|---|---|
| 1 | R-1 selector in the Core (camera per video track, primary / standby microphone), editable from web, tablet, phone, RBAC + audit | specs `:140`; C3 ops 76-80 | `modules/capture-config`, web Devices, mobile capture-selector; shared `sim/selector-in-force.ts` | LIVE-FAKE: `M4-SEL-W/-T/-P`, `M4-LOCK-1` (gate 09, D196); every registered microphone on both lines (09b, 09c); naming after a change (09d item 1, D232) | MET |
| 2 | R-2 capture worker behind the API, supervised separate process, IPC, adapters under the device contract | specs `:150`; spec 05 | `apps/capture-worker` (C, 0.5.0), `packages/capture-protocol` (4), `src/capture/**`, `src/capture-session/**` | TEST: worker e2e series 122 of 122 (D188, on the tree of `f293221` worker); LIVE-FAKE: sessions on lane 2 (10c, 10d, 10e) | MET |
| 3 | R-3 one active microphone, the second a failover, MANUAL toggle; every switch audited and written as source intervals in the manifest | specs `:160` | worker filter thread switch (row 71a), op 81 / 82 (71b, D4), web / mobile toggle | TEST: `M5-GAP-1`, switch delay 5.4 / 4.8 ms against 21.3 ms (D170); LIVE-FAKE: switches from web and tablet, one `AUDIO_SOURCE_SWITCHED` row each with the sending device, intervals 1-based (gate 10, D197; 10c) | MET |
| 4 | R-3 the Core warns and never switches by itself | specs `:160`; D4 OD-11 | pure warning unit; advisory alerts `MIC_SILENT`, disconnect, `MIC_RATE_AT_LIMIT` | TEST: "silent / disconnect never switch 8 of 8" (D170); structural pin proposed in D142 (5). LIVE: the active-microphone BLOCK seen once with the source rig (report 14 item 3); a silent live microphone NOT PROVEN live | MET WITH LIMIT: `M4-MIC-ACTIVE-*` live only in the one rigged case (D227 (3), D239) |
| 5 | R-4 one WHOLE file per camera (video + the single session audio), no re-encode, append-only fragmented MP4, running SHA-256, per-fragment checkpoints in the manifest | specs `:171`; spec 06 B.6 | worker writer (row 59), `capture/fragments.ts`, `evidence-package/fragments.ts:81-86` (chain), manifest fragment table | TEST: writer checks, 100 + 200 kills 0 violations (D127); kill matrix 35 of 35 (`test/16` check 12). LIVE-FAKE + outside the product: the gate verifier's own script recomputed every fragment hash and both chains on two product-sealed packages (gate 12, D199); one flipped bit named exactly `(VIDEO-01, 5)` | MET |
| 6 | Encryption at rest per fragment (OD-03, D4) | spec 06 A.3; SEC35-10 | `sealing-host/session-key.ts`, seal-time AES-256-GCM (ruling D147) | LIVE-FAKE: init segment clear, fragments ciphertext, no plaintext after the seal, 0700 / 0600 (12b, D222; 12d) | MET WITH LIMIT: the recording is PLAINTEXT on the media root from recording until the seal completes (D147, a controller ruling "flagged to the user as revisable") |
| 7 | R-5 machine transcript INSIDE the sealed package | specs `:183`; spec 07 | `apps/transcriber`, `sealing/finalize-transcript`, `transcript-package` | LIVE-FAKE: tablet-driven session with the synthetic speech microphone sealed `ASSEMBLED`, 4 chunks, 19 segments word for word, verify 15 of 15 (11b section 4, D221) | MET |
| 8 | R-5 / R-7 STT on CPU + RAM only, no benchmark on this Mac, working STT first | specs `:183`, `:206`; D230 of task 2 | whisper.cpp source build, Metal off (rows 107-110) | TEST + gate: `gateway_check/26_m1_cpu_stt_addendum.md` (row 110); LIVE-FAKE: `cpu-local` in the session of row 7 above. No speed figure anywhere I read | MET |
| 9 | R-5 two speakers labelled when possible, otherwise sealed with the flag "speaker labels unavailable" | specs `:183` | diarization unit (row 78), no embedding engine composed (D157) | TEST only for `LABELLED`; every sealed transcript says UNAVAILABLE (D157, D195) | MET WITH LIMIT: the "when possible" half never occurs on this build; `LABELLED` NOT PROVEN live (11b R3) |
| 10 | R-5 corrections only as signed revisions; the original never changed | specs `:183`; ops 84-86 | `modules/transcripts`, V-11 binding (D162) | LIVE-FAKE: revisions on a clean and an interrupted item, original hash unchanged, V-11 PASS, heads survive a restart (11b 5.4-5.6); op 85 refuses a `from` that is not the current text (10d, D228) | MET |
| 11 | R-6 one active session per Core; a NEW SESSION IS BLOCKED UNTIL THE PREVIOUS ONE IS SEALED | specs `:195`; D219 | session machine; blocked-seal state, retry, terminal UNSEALABLE with quarantine (D186) | LIVE-FAKE with the seal rig: blocked seal blocks New Session with its reason; release + "Retry sealing" -> sealed; unsealable -> INCOMPLETE + quarantine, a new session possible (10d A2, 10e items 1-2) | MET |
| 12 | R-6 per-step sealing progress with an estimate on all clients | specs `:195`; op 83 | `sealing-host/progress.ts`, web seal dialog, mobile Finalizing | LIVE-FAKE (10d, 10e); `etaMs` null for the transcript step by rule (D224 S1) | MET |
| 13 | R-6 checkpointed and resumable through RECOVERY | specs `:195`; spec 06 E | `sealing/step-journal.ts`, `pipeline.ts`, controller | TEST: kill matrix 35 of 35, seal e2e 3 of 3 (`test/16` checks 10, 12); LIVE-FAKE: worker killed -> interrupted seal; Core stopped while recording -> seal resumes (10c, 10d A1) | MET (10 S7 / S8 cells parked on OD-21, by design) |
| 14 | R-6 / OD-16 composite video only on demand at export | specs `:195`; D4 OD-16 | `evidence-export`, composite job | LIVE-FAKE: the job ends FAILED `COMPOSITE_ENCODER_NOT_SELECTED` (gate 13, D200); `M8-CMP-1` is NOT PASSED (13d C-3) | **NOT MET - blocked on the user's FFmpeg licence decision (D139, D195 R96-3)** |
| 15 | OD-16 export = decrypted copy + manifest + signature, audited | spec 06 G; ops 42, 87 | `evidence-export`, signed download, `npm run evidence:verify-export` | LIVE-FAKE: export of a clean and a revised item, download verified by the receiver command, 14 of 14 tampered copies fail on a named check (13b, D223; 13c, 13d) | MET |
| 16 | Playback has one synchronous audio source; sealed player on web, tablet, phone | D220; ux flow 5 | `media-stream` (signed session, Range decryption, seek index), `sealed-player` | LIVE-FAKE: web (13b), tablet seek (13c), phone layout (13c), tamper stop in a browser (13d, report 14) | MET |
| 17 | Verify v2 and the tamper demonstration | spec 06 D | `packages/shared/src/evidence-verify`, `src/evidence-verify` | LIVE-FAKE: op 41 PASS 15 of 15 from web / tablet / phone; tamper demo names `(VIDEO-02, 3)`; 19 of 23 tampered copies fail on the named check, the other four explained (12b, D222) | MET WITH LIMIT: the audit extract is not covered by the signature (notice `AUDIT_EXTRACT_NOT_SIGNED`, D183); without the Core's certificate hash from outside, a re-signed copy verifies (D199) |
| 18 | R-8 STT configuration in the DATABASE, editable from a CONFIGURATION MENU, activate / deactivate | specs `:216`; D20, D24 Q-STT-CFG | table `stt_config` (kept), ops 90-92, web System section, read-only on devices | LIVE-FAKE: web settings, role rules, 409 `REVISION_CONFLICT`, read-only status on tablet and phone (gate 11, D198) | MET |
| 19 | R-8 deactivated: sealed with "transcript disabled by configuration" | D20 | snapshot at start, `DISABLED` state | LIVE-FAKE: DISABLED on web, tablet, manifest, op 84 (gate 11, D198) | MET |
| 20 | R-8 server backend (`omlx-server`) with a write-only credential reference, test connection | D20 | adapter, provenance-by-backend rule (D160, D163) | TEST only. Not run live by the user's rule (11b R1) | MET WITH LIMIT: server backend NOT PROVEN live |
| 21 | R-9 camera search on the network yields a candidate LIST only; nothing connected by the search | specs `:281`; D73, D76 | `capture-discovery` (ops 93, 94), ONVIF WS-Discovery probe | LIVE-FAKE on the loopback stub: web (09b), tablet, phone (09c: `M4-DISC-P`, `-EMPTY-P`) | MET WITH LIMIT: `M4-DISC-LAN-1` (the real-LAN probe D75 / D78 (1) allowed) is NOT PROVEN - listed "not run" in 09d section 4 |
| 22 | R-9 every connectivity action is forwarded to the operator for the credential (web console only); no default, reused or guessed credential; agents never handle a real one | D76; D80 (3) | connect flow ops 95, 96, 89; uncontrolled inputs (D181); disabled pointer on devices | LIVE-FAKE: five outcomes, security checks of the fields, adopt, lock, tablet pointer (09b, D215); adopted camera assignable and probed without a restart (09c, report 14 item 2). Only the stub's fixture account was ever typed by an agent | MET |
| 23 | R-10 A: an empty search raises a notification | specs `:304` | `capture-notices/notifier.ts` | LIVE-FAKE: notice A (09b); phone empty search (09c) | MET |
| 24 | R-10 B: a configured camera or microphone unreachable at pre-check is named to the operator | specs `:304`; ux 8g | `capture-notices/precheck.ts`, `probe.ts`; source rig (D232) | LIVE-FAKE with the source rig: tablet and phone (driver, D237), web camera + tablet microphone (report 14 item 3) | MET WITH LIMIT: on the web the consequence sentence is cut at 1440 x 900 (GM-01); both cameras unreachable, "Search again", a start after acknowledgement NOT PROVEN live |
| 25 | R-10 C: no camera connects at session start -> the session faults and the operator is told | specs `:304`; D72 (k) | `capture-notices/session-start.ts`, simulator situation C (D164) | LIVE-FAKE on the simulated lane: failed start, degraded start, two failed starts = two alerts (gate 10, D197). On REAL capture: TEST only (10d section 9 item 4) | MET WITH LIMIT: situation C on real capture NOT PROVEN live |
| 26 | R-11 development fallback to this Mac's camera and microphone | specs `:318`; D73, D74 | `capture/adapters/local/**`, `LOCAL_DEVICE` kind, fence | Product path: TEST on generated sources (D161). Real devices are the user's runs: camera PASS 10 of 10 (D130); **microphone FAIL on rate, 8/9 of the declared rate (D128)**; the attended end-to-end session was prepared and not run (D161) | MET WITH LIMIT: the local microphone is "not fit for recording yet" (D128, D136); no real local-device session has been sealed |
| 27 | R-11 privacy rule: no agent opens the Mac's camera or microphone; a notice + confirm before any client action turns a local device on | D74 (3), D163, D178 (10), D184 | client notice (fail closed, D196 G70-08), fence | LIVE-FAKE: nothing sent before the notice / after "Not now" / on reload (gate 09, D196); fail closed on the tablet (09c item 7). The confirm path itself is user-attended and was never run | MET (see V98-10 for the letter of D163) |
| 28 | R-11 a development-source package may be sealed and verifies PASS with the development mark | D78 (2); spec 06 D.1 | V-15, `sources` block, `developmentKey` from the certificate (D183) | LIVE-FAKE: marks on API, web, tablet; an edited source class fails V-03 / V-09 (gate 12, D199) | MET |
| 29 | A real-capture Core states only facts (no simulator value in evidence or on its surfaces) | rulings D197, D199, D222, D229 | generator condition `generator.ts:222-239`, `sim/core-facts.ts`, manifest reader | LIVE-FAKE: 0 invented rows in five packages (12b); Security & Audit (12c); Monitor card, Dashboard, tamper panel (12d) | MET WITH LIMIT: engine words "READY" beside "Not checked", New Session profile label, `RTC` bare enum, two installation names (section 7) |
| 30 | OD-19 reset blocked while real sealed packages exist | D4 | `db/reset/**` | TEST (db); LIVE-FAKE incidentally (lane reset refused, D216) | MET |
| 31 | Process: gates kept separate (D125); one-run proof (D122); pairing off (D88); autonomy with a decision log (D4 Q-AUTO) | decisions | - | six first gates, five re-gates, four re-checks, four final re-checks, each its own report; 240 decisions | MET (see V98-03, V98-06 for the trackers and one log gap) |
| 32 | Test-suite consolidation after the re-checks (D233) | D233, D238 | `test/13`..`15` | `test/16` section 6: 1,191 -> 1,065 files, 17,511 -> 17,498 tests, no per-wave file left | MET |
| 33 | Biometric device test | D231 of task 2, D151 | - | skipped at every gate, listed as skipped, never as passed | OUT OF SCOPE BY DECISION (D151) |
| 34 | Class-C hardware pack (real ONVIF / PoE / microphone adapters, LAN devices, Core-device benchmark, TPM signer, long campaigns) | blueprint section 9, row 105 | - | - | OUT OF SCOPE BY DECISION (D4 Q-HW; completion line) |
| 35 | GStreamer rows 102-104 | D24 Q-INST-1 (c) | - | - | OUT OF SCOPE BY DECISION (D24) |
| 36 | Full-feature UI judging session (D150) | D150 | - | not started | LATER STEP - after row 101, not part of the completion line |

Count: 32 judged requirements (rows 1-32): **20 MET, 11 MET WITH LIMIT, 1 NOT MET** (row 14,
blocked on a user decision). Rows 33-35 are out of scope by decision; row 36 is a later step.

---

## 2. The gates

### 2.1 Final state per milestone

| Milestone | Latest report | Verdict | Conditions as written | Closed later by | Still open |
|---|---|---|---|---|---|
| M0 | `05_m0_spec_gate.md`, `25_rv_spec_reconciliation.md`, `27_r9_r11_spec_gate.md` | PASS (D15, D27; spec gate row 128) | routed pickups G-1..G-6 | D64 | none read |
| M1 | `04_m1_spike_gate.md`, `26_m1_cpu_stt_addendum.md` | PASS 25 of 25; CPU addendum closed | - | - | none |
| M2 | `07_m2_gate.md`, `08_m2_gate_device.md`, `27_m2_claude_audit.md` | signed off with carry-overs A-1, A-2, lane-1 live clause (`status_tasks.md:147`) | A-1 root typecheck; A-2 `contract.test.ts`; lane 1 device | typecheck clean x7 and `contract.test.ts` 38 of 38 (`test/16` checks 1, 13b); the phone ran on lane 1 from D193 | none |
| M3 | `08_m3_gate.md` | PASS WITH CONDITIONS (C1-C7) | C1 docs; C2 field 40; C3 clock-floor mark; C4 stale notice + reason-less refusals; C5 quote; C6 pg-scripts + mobile; C7 old worker passes boot | C1: `README.md:473-482`; C2: D199 / D211 (value 0 = measured 0); C3: D203; C4, C7: D202; C5: D197; C6: `test/16` checks 7, 9 | C2 remainder: field 40 cannot tell "measured 0" from "not measured" (D203, limit) |
| M4 | `09d_m4_final.md` | PASS WITH CONDITIONS (C1-C6) | C1 `M4-NODEV-B-*`; C2 `M4-MIC-ACTIVE-*`; C3 G70d-02; C4 G70d-03; C5 audio pair on devices; C6 biometric + local-device confirm | C1, C3, C4: wave M + report 14 items 3, 4, 5; C2: one rigged live view (report 14) | GM-01; `M4-DISC-LAN-1`; both cameras unreachable / "Search again" / start after acknowledgement; C5 accepted; C6 user |
| M5 | `10e_m5_final.md` | PASS WITH CONDITIONS (C1-C6) | C1 G75e-01; C2 G75e-02; C3 G75e-03; C4 G75e-04; C5 not-proven list; C6 known | C1, C2: report 14 items 5, 7; C3: driver M-S (D237), 0 error lines in report 14 item 8 (not provoked); C4: driver M-W (D237), NOT re-driven in report 14 | C4 on driver evidence only; C5: start-refusal sentence live, G75c-06 on lane 1, tablet About TPM row, phone recovery screen during an interrupted seal; G75e-07 (no audit row for a non-reviewer acknowledgement, D237) |
| M6 | `11b_m6_regate.md` + `10d_m5_m6_recheck.md` | PASS WITH CONDITIONS (R1-R5) | R1 server backend live; R2 `M6-KR-1` form (a); R3 `PARTIAL`, `LABELLED`, no-speech live; R4 minors; R5 G81b-03 | R4, R5: wave K, 10d section 5 | **R1 (user), R2, R3 - unchanged at `713d83f`**; G81-11 (step durations on the Summary against the no-figure rule) has no ruling in D221-D240 |
| M7 | `12d_m7_final.md` | PASS WITH CONDITIONS (F-1..F-4), nothing above NOTE | F-1 card after a restart; F-2 tests-only list; F-3 suites; F-4 notes | F-1: driver M-W, note 159 section 3.8 (see V98-07); F-3: `test/11`, `test/16` | F-2: one-camera seal, truncated tail, kept-plaintext alert, boot sweep, every REAL_PRODUCTION refusal, unreachable-PARTIAL package, server-backend model line - TEST only; G89d-01 |
| M8 | `13d_m8_final.md` | PASS WITH CONDITIONS (C-1..C-3) | C-1 G94d-01; C-2 G94d-02; C-3 `M8-CMP-1` | C-1, C-2: wave M, report 14 item 1 | **C-3 `M8-CMP-1` NOT PASSED (user: licence)**; late-tamper watch, headed browser, production web origin NOT PROVEN |
| wave M | `14_wave_m_confirmation.md` | status needs-review: all items CONFIRMED but one count | GM-01, GM-02 (MINOR), GM-03..05 (NOTE) | ruled for the batch after the judging session (D239) | GM-01, GM-02 |

Every milestone gate M3-M8 stands at PASS WITH CONDITIONS; none is a plain PASS. The completion
line says "green": I read PASS WITH CONDITIONS as green only together with the list of 2.2.

### 2.2 What is STILL OPEN at `713d83f` (one list)

| # | Item | Class | Severity | Source |
|---|---|---|---|---|
| O-1 | `M8-CMP-1` composite export: not passed, blocked on the licence decision | requirement not met | MAJOR for the requirement; outside the agents' power | 13d C-3; D139; D195 |
| O-2 | The audit extract of a package is not covered by its signature; evidence of lost audio lives only there | ruled limit, evidence integrity | MAJOR-class limit, accepted by ruling, shown on every verify result | D182, D183; `evidence-verify/types.ts:379-431` |
| O-3 | Recorded media is plaintext on the Core's media root until the seal completes | ruled limit | MAJOR-class limit, accepted by ruling "flagged to the user as revisable" | D147 |
| O-4 | Development marks are worth as much as the out-of-band certificate hash | stated limit | MINOR (development key only) | D199 |
| O-5 | Server STT backend never run live | not proven | MINOR | 11b R1 |
| O-6 | `M6-KR-1` form (a): Core killed while the engine decodes | not proven live | MINOR | 11b R2 |
| O-7 | `PARTIAL` (both forms), `LABELLED`, a no-speech session | not proven live | MINOR | 11b R3 |
| O-8 | Tests-only list of M7 (one-camera seal, truncated tail, kept-plaintext alert, boot sweep, REAL_PRODUCTION refusals, unreachable-PARTIAL, server model line) | not proven live | MINOR | 12d F-2 |
| O-9 | `M4-DISC-LAN-1` real-LAN search | not proven | MINOR | 09d section 4 |
| O-10 | Notification B: both cameras, "Search again", a start after acknowledgement, the standby microphone | not proven live | MINOR | report 14 section 3 |
| O-11 | Situation C and the degraded start on REAL capture; `M5-SEC-SRC-1`; the start-refusal sentence | not proven live | MINOR | 10d section 9; 10e C5 |
| O-12 | GM-01 web: the consequence of notification B unreadable at 1440 x 900 | finding | MINOR (an operator acknowledges a warning whose effect is not shown) | report 14; D239 |
| O-13 | GM-02 tamper tile counts over the newest 1,000 audit rows | finding | MINOR | report 14; D239 |
| O-14 | G75e-07 a non-reviewer's acknowledgement writes no audit row (needs a 68th audit type) | ruled, next task | MINOR | D237 |
| O-15 | G75e-04 Dashboard ring beside an open notice while recording: fixed by the driver, not re-driven independently | driver evidence only | NOTE | D237; report 14 item 7 last row |
| O-16 | 12d F-1 the integrity card of a sealed session after a Core restart: driver's read only | driver evidence only | NOTE | note 159 section 3.8; V98-07 |
| O-17 | Tamper stop for a file that loaded and is altered in its last seconds; a headed browser; a production web origin without the dev proxy | not proven | NOTE | 13d section 6 |
| O-18 | G81-11 step durations shown on the tablet Summary against the no-figure rule | no ruling found | NOTE | 11b section 9 |
| O-19 | Local microphone delivers 8/9 of its rate; `--diagnose` not run | user-attended | MINOR | D128, D136 |
| O-20 | Attended local-device session end to end | user-attended, not run | MINOR | D161 |
| O-21 | 10 kill cells S7 / S8 parked on OD-21; power loss, real ENOSPC, a volume without hard links | by design / class C | NOTE | D155; `README.md:482` |
| O-22 | Rows 99, 100, 101 of the final chain | in flight, parallel | blocks the line until they report | D240 |

By severity: MAJOR 1 (O-1) + 2 MAJOR-class limits accepted by ruling (O-2, O-3); MINOR 12;
NOTE 6; O-22 is a process condition.

### 2.3 The controller's claims D231-D240 against the reports

| Decision | Claim | Report | Result |
|---|---|---|---|
| D231 | wave L committed `7b1aded`; pre-commit GREEN in one run with the counts given | `test/11` head: "GREEN overall, 0 reds"; `git log` | supported |
| D232 | final re-check 70 PASS WITH CONDITIONS; G70c-01 closed; `CAM-03` "select only, 39 s" | `09d` sections 1, 5 | supported; see V98-10 |
| D233 | user directive on the test suite | user text | - |
| D234 | final re-check 75 PASS WITH CONDITIONS; both must-fix items closed live | `10e` section 1 | supported |
| D235 | final re-check 89 PASS WITH CONDITIONS, nothing above NOTE; G75e-08 judged NOTE | `12d` sections 1, 5 | supported |
| D236 | final re-check 94 PASS WITH CONDITIONS; "all five milestone gates now stand at PASS WITH CONDITIONS" | `13d` section 1; `09d`, `10e`, `11b` + `10d`, `12d` | supported. `13d` rated G94d-01 MINOR and said the row is FAIL if every sub-check counts; the controller made it a must-fix, which is the stricter reading |
| D237 | wave M reported, not committed yet | notes 158-161 exist | supported; **no later decision records the commit `a5d75ed` or the pre-commit run** (V98-06) |
| D238 | suite audit numbers | `test/13` (not re-read by me) | not checked |
| D239 | "every item CONFIRMED independently except one count" | report 14: status needs-review, 2 MINOR + 3 NOTE, one row "not re-driven (by the task)", the `params` observation of its section 3 | mostly supported; two points not carried (V98-07, V98-08) |
| D240 | consolidation committed `951c80e`; row 95 GREEN with the counts; row 97 in 20 commits `951c80e..713d83f`; chain launched | `test/16` head and table: counts equal (2612 / 31 / 6700 / 2423 + 7 / 2224 / 2915 / 564 + 3 / 19 / 57 / 35 / 3 / 2; 97 / 67 / schema 6); `git log`: 20 commits after `951c80e` | supported, with three remarks: `test/16` says status needs-review for the literal M9-PIN-1 grep (34 stale prose lines), closed afterwards by `c0be906` and an erratum (V98-11); the decision is dated 2026-10-12 while every commit is 2026-10-11; row 95 ran BEFORE row 97's product fix (V98-04) |

---

## 3. Row coverage

Owner as in the blueprint. Evidence = artifact present and non-empty (`test -s`, run at 20:47) plus
the decision or commit that names the row. "Gate" columns are in section 2.

| Row | Owner | Artifact | Named by | State |
|---|---|---|---|---|
| 57 | coder-execution | `implementation/19_m3_supervisor_ipc.md` | `status_tasks.md:155`; commit `101ce62` | done |
| 58 | coder-execution | `implementation/20_m3_worker_engine.md` | `status_tasks.md:160`; commit `4b62350` | done |
| 59 | coder-execution | `implementation/21_m3_fmp4_writer.md` | D127 | done |
| 60 | coder-execution | `implementation/22_m3_fixtures.md` | `status_tasks.md:174` (landed list); commit `e296ce7` | done |
| 61 | coder-execution | `implementation/23_m3_static_boot.md` | D138 | done |
| 62 | coder-execution | `implementation/24_m3_b11_instrumentation.md` | landed list; `e296ce7` | done |
| 63 | senior-code-reviewer | `gateway_check/16_m3_code_review.md` | D179; fixes D188 | done (acceptance met only after fix F-M3) |
| 64 | verifier | `gateway_check/08_m3_gate.md` | D194 | done, PASS WITH CONDITIONS |
| 65-68 | coder-execution | `implementation/25`..`28_m4_*.md` | landed list; `e296ce7` | done |
| 69 | senior-code-reviewer | `gateway_check/17_m4_code_review.md` | D178; fixes D181, D184 | done |
| 70 | verifier | `gateway_check/09_m4_gate.md`, `09b`, `09c`, `09d` | D196, D215, D227, D232 | done, PASS WITH CONDITIONS |
| 71 | coder-execution (split 71a / 71b / 71c) | `implementation/30_m5_mic_switch.md`, `30b`, `30c` | D142, D144, D157 | done |
| 72, 73 | coder-execution | `implementation/31_m5_web_mic.md`, `32_m5_mobile_mic.md` | landed list; `e296ce7` | done |
| 74 | senior-code-reviewer | `gateway_check/18_m5_code_review.md` | D177; fixes D182 | done |
| 75 | verifier | `gateway_check/10_m5_gate.md`, `10b`, `10c`, `10d`, `10e` | D197, D216, D220, D228, D234 | done, PASS WITH CONDITIONS |
| 76-79 | coder-execution | `implementation/33`..`36_m6_*.md` | `status_tasks.md:158`; landed list | done |
| 80 | senior-code-reviewer | `gateway_check/19_m6_code_review.md` | D176; fixes D180 | done |
| 81 | verifier | `gateway_check/11_m6_gate.md`, `11b`, `10d` | D198, D221, D228 | done, PASS WITH CONDITIONS |
| 82 | coder-execution (82, 82b, 82c) | `implementation/37_m7_sealing_pipeline.md`, `37b`, `37c` | D147, D148, D153, D167 | done |
| 83-85 | coder-execution | `implementation/38`..`40_m7_*.md` | landed list; `e296ce7` | done |
| 86 | coder-execution | `implementation/41_m7_kill_matrix.md` | D155; run D172 | done |
| 87 | coder-execution | `implementation/42_m7_clients_verify.md` | D121 | done |
| 88 | senior-code-reviewer | `gateway_check/20_m7_code_review.md` | D178; fixes D183, D186, D189 | done |
| 89 | verifier | `gateway_check/12_m7_gate.md`, `12b`, `12c`, `12d` | D199, D222, D229, D235 | done, PASS WITH CONDITIONS |
| 90-92 | coder-execution | `implementation/43`..`45_m8_*.md` | D140 / D143, D139 / D141, D149 | done; composite blocked (O-1) |
| 93 | senior-code-reviewer | `gateway_check/21_m8_code_review.md` | D178; fixes D185 | done |
| 94 | verifier | `gateway_check/13_m8_gate.md`, `13b`, `13c`, `13d` | D200, D223, D230b, D236 | done, PASS WITH CONDITIONS |
| 95 | test-expert | **`test/16_row95_full_regression.md`** (blueprint: `test/02_m9_regression.md`, absent) | D240 | done on `a5d75ed` + the consolidation; other name (V98-12) |
| 96 | data-analyst | `implementation/47_m9_docs.md` | D195 | **partial: written at `f293221`, corrections for waves H, I, K; nothing for L, M (V98-02)** |
| 97 | coder-execution | **`implementation/162_row97_hygiene.md`, `163_row97_blueprint_list.md`** (blueprint: `implementation/48_m9_hygiene.md`, absent) | D240; 20 commits | done, with a carried list (note 163 section 6; D240) |
| 98 | verifier | this file (blueprint: `gateway_check/14_m9_gate.md`; that number is the wave M confirmation) | D240 | this report |
| 99-101 | security-review, test-expert, senior-code-reviewer | `gateway_check/22`, `23`, `24` - absent at 20:47 | D240 "launched" | **NOT DONE (in flight, parallel)** |
| 126 | security-review | `masterplan/09_security_design_review.md` (refreshed); `delegation_progress/security_review_row126.md` | commit `23c8f0b` | done |
| 127 | test-expert | `masterplan/10_test_strategy.md` section A.4a; `delegation_progress/test_expert_row127.md` | D89 | done |
| 128 | verifier | `gateway_check/27_r9_r11_spec_gate.md` | commit `23c8f0b` | done |
| 129, 130 | database-specialist, coder-execution | `implementation/60_r9_migration_0008.md`, `61_r9_lane_migration.md` | landed list | done |
| 131-136 | coder-execution | `implementation/62`..`67_r*.md` | D120 (132); landed list | done |
| 137, 138 | coder-execution | `implementation/68_r9_web_devices.md`, `69_r9_mobile_devices.md` | D131, D129 | done |
| 139 | coder-execution | **`implementation/70_r10_session_start_situation_c.md`** (blueprint name `70_r10_session_start_alert.md`) | D156 | done; other name |
| 140 | coder-execution | **`implementation/71_r11_local_sources_in_sessions.md`** (blueprint name `71_r11_local_device_session.md`) | D161 | **partial against the row text**: the row says "with this Mac's camera and microphone"; it was proven on generated sources; the attended run is the user's and was not run (O-20) |
| 141 | coder-execution | `implementation/72_r11_manifest_dev_mark.md` | D124 | done |
| 142 | coder-execution | `implementation/73_r9_connect_flow.md` | landed list | done |
| fix waves | - | notes `implementation/111`..`161` (F, H, I, K, L, M and their closing passes): every number present | D180-D237 | done |

Rows marked done with NO artifact: **0**. Rows whose artifact has another name than the blueprint
states: 5 (95, 97, 98, 139, 140). Rows not done: 99, 100, 101. Rows partial: 96, 140.

---

## 4. Contract and schema integrity

### 4.1 Totals at HEAD (read from the sources)

| Total | Value | Evidence |
|---|---|---|
| Operations | 97 | `node -e` over `packages/shared/openapi/openapi.json`: `openapi 0.3.0 paths 91 GET 36 POST 61 other 0 opIds 97` |
| GET / POST | 36 / 61 | same line; `packages/shared/test/api-registry.test.ts:299`, `:330`, `:331` |
| Audit types | 67 | `api-registry.test.ts:492` `expect(AUDIT_TYPES).toHaveLength(67)` |
| Guard run | green | `npx vitest run --root packages/shared test/api-registry.test.ts` -> `Test Files 1 passed (1) / Tests 42 passed (42)` (20:45, load 1.55) |
| Schema | 6 / `dbc-7` | `apps/core-server/src/db/schema/meta.ts:38`, `:40` |
| Migrations | 15 files `0000`..`0014` | `ls apps/core-server/src/db/migrations/*.sql`; the last pair is `0013_key_id_fault_reason_media_root.sql` + `0014_..._privileges.sql` (D169) |
| Product tree | equals the commit | `git status --short`: two entries, both under `docs/` |

### 4.2 Fifteen additive members of waves H-M (optional + exported example)

Each schema line was read; "optional" means `.optional()` on the member or on the object that
holds it.

| # | Member | Wave | Schema (`packages/shared/src/api/`) | Optional | Exported example |
|---|---|---|---|---|---|
| 1 | op 40 `media.fileIds` | H C1 | `evidence.ts:106-110` | yes | inside `EVIDENCE_EXAMPLES` (`evidence.ts:1095`) |
| 2 | op 40 `access.readTranscript` | H C1 | `evidence.ts:150-157` | yes (the `access` object) | `EVIDENCE_EXAMPLES` |
| 3 | item `sealedPackage` | H C1 | `state-slices.ts:837` | yes | `EVIDENCE_EXAMPLES` |
| 4 | item `interruptedCause` | H C1 | `state-slices.ts:845` | yes | `EVIDENCE_EXAMPLES` |
| 5 | `session.captureCheckpoints` | H Z1 | `state-slices.ts:383-390` | yes | **none found** (V98-09) |
| 6 | `time.hostClock` | H Z1 | `state-slices.ts:567-569` | yes | `HOST_CLOCK_TIME` in `sim/core-facts.ts:133` (exported constant, not a contract example) |
| 7 | `session.precheck.sendingDeviceId` | I A2 | `state-slices.ts:291-294` | yes | `SESSION_PRECHECK_SENDING_DEVICE_EXAMPLE` (`:255`) |
| 8 | `security.platformNotReported` | I J | `state-slices.ts:617` | yes | `SECURITY_PLATFORM_NOT_REPORTED_EXAMPLE` (`:265`) |
| 9 | fault `coreNotRunning` | I J | `state-slices.ts:342`, `:979` | yes | `CORE_NOT_RUNNING_FAULT_EXAMPLE` (`:266`) |
| 10 | item `transcriptModel` | K S2 | `state-slices.ts:869` | yes | `EVIDENCE_TRANSCRIPT_MODEL_EXAMPLE`, `..._SERVER_EXAMPLE` (`evidence.ts:1055`, `:1065`) |
| 11 | op 42 `archiveOnCore` | K | `core-api.ts:582` | yes | `EXPORT_ACCEPTED_NO_ARCHIVE_EXAMPLE` |
| 12 | op 41 `files[].plainChecked` | K KR | `evidence.ts:278` | yes | `VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE` (`:1081`) |
| 13 | op 88 `seekIndex` | K Z1 | `evidence.ts:507`, `:533` | yes | `EVIDENCE_MEDIA_SESSION_INDEXED_EXAMPLE`, `..._REQUEST_EXAMPLE` (`:548`, `:557`) |
| 14 | item `files[].profile` | L S | `state-slices.ts:804` | yes | `EVIDENCE_SEALED_PROFILE_EXAMPLE` (`evidence.ts:1011`) |
| 15 | item `streamProfileNotice` | L S | `state-slices.ts:852` | yes | `EVIDENCE_STREAM_PROFILE_NOTICE_EXAMPLE` (`:1020`) |

Result: 15 of 15 optional; 13 of 15 with an exported contract example; 1 with an exported
constant outside `api/` (6); 1 with none (5).

Wave M added no contract member by its own statement (`contract_wave_m.md`: pre-check item
`params`, which the schema already had as optional, `state-slices.ts:216`). See V98-08.

### 4.3 Spec errata

| Series | Ids found in `masterplan/*.md` | Covers |
|---|---|---|
| `PE-WH-` | 01..13 | wave H |
| `PE-WI-` | 01..38 | wave I and pass J (D218 named 01..18; the follow-up note 137 added the rest) |
| `PE-WK-` | 01..47 | wave K, closing passes, fix 151 (`PE-WK-47`) |
| `PE-WL-`, `PE-WM-` | **none** | - |
| row 97 | one erratum, `10_test_strategy.md:647` (M9-PIN-1) | the pin sweep's rule |

`grep -n "wave L\|wave M\|D23[1-9]\|D240\|implementation/15[3-9]\|implementation/16[0-3]" masterplan/*.md`
returns no line that belongs to waves L or M (the D232 / D233 hits are task 2's decisions). So
**nothing built in waves L and M has a spec erratum**. What I could name, with a `grep -c -i` of
its own word over the eight spec files:

| # | Built change (wave, decision) | Hits in the specs |
|---|---|---|
| 1 | Source rig `lane.sh source-rig` (M, D232, D237) | 0; also 0 in the root `README.md` (the seal rig is there, `README.md:627-638`) |
| 2 | "Retry sealing" control on web dialog and Monitor; who may press it; devices say who can (L, D231) | 0 |
| 3 | Op 33 as the retry of a BLOCKED seal for `SESSION_START` holders, no self-retry when the cause heals, op 83 `resumed` true only for a Core start (L, D231) | the retry of a FAILED seal by op 33 is in `PE-FX-02` / `PE-WI-19` (`03_api_contract.md:34`, `:52`); the three rules of wave L are not (0 for "self-retry") |
| 4 | UNSEALABLE notice stays active until a holder of `EVIDENCE_REVIEW` acknowledges it; `UNSEALABLE_ACKNOWLEDGE_PERMISSION` (L, D228 (2), D231) | 0 |
| 5 | "OPEN NOTICE" pill / ring, "OPEN NOTICE - RECORDING" (L, M) | 0 |
| 6 | Item members `files[].profile` and `streamProfileNotice` on op 40 (L) | 0 in C3; one client sentence under `PE-WK-13` in the UX spec (`08:884`) |
| 7 | "Cancel session" in the device header + the third dialog choice; "Choose another source" not offered (M; D237 says "spec erratum owed") | 0 |
| 8 | "Not checked" for a source at rest on both clients; one status wording rule on Devices (L, M) | only the deferred `checkedAt` line (`08:1340`) |
| 9 | The selector IN FORCE and the audio pair in force, one shared helper (L, fix 157) | 0 |
| 10 | `SEAL_BLOCKED_MESSAGE_MAX` 400 -> 600 (L) | 0 |
| 11 | Boot `locked` uses the route's rule; search rows name a session only while one is open (L) | 0 (two phrasings tried) |
| 12 | Tamper stop: the stall watch rests on data received; three bounded probe requests (L, M) | 0 for "stall watch" |
| 13 | One WARNING row per stop also under concurrent requests; the 60 s key (M, report 14 O-1) | the one-row rule is in K's errata; the concurrency rule is not |
| 14 | Tamper tile: the count of items without a verify run (M) | 0 |
| 15 | "SEALING RETRIED" pill / ring during the automatic retries (M) | the Monitor banner of K is at `08:402`; the pill and ring are not |
| 16 | The reachability probe is asked at every use (M-S2) | 0 |
| 17 | Generated sources named as generated on Devices, Dashboard, Monitor and the device lists; Session New meters named from the selector (L, M) | only the manifest's model / firmware words for a `FAKE` source (`06_evidence_package_spec.md:396`, wave H); the client naming rule is not |

17 built changes without an erratum (V98-01).

---

## 5. Logic spot-checks (by reading)

| # | Place | File:line | What I checked | Result |
|---|---|---|---|---|
| 1 | Seal ordering | `apps/core-server/src/sealing/pipeline/pipeline.ts:764-791`, `:793-807`, `:810-885` | BUILD_MANIFEST freezes every live input into its RUNNING row before the first digest (`:767-778`); SIGN_MANIFEST refuses when the rebuilt digest is not the checkpoint's (`:797`) and when a development key would sign all-production sources (`:799-801`), then writes certificate, signature, manifest in that order (`:803-805`); STORE checks declared against present files (`:833-837`), syncs files and directories (`:838-840`), commits the item (`:857`), and only then deals with plaintext (`:872-883`) | holds |
| 2 | Atomicity of package files and of the commit | `sealing/pipeline/package-writer.ts:31-45`; `pipeline.ts:825-830` | each file is written under a staging name, synced, renamed, the directory synced; a process that died after the commit finds `isSealed(sessionId, manifestSha256)` and commits nothing a second time | holds |
| 3 | Hash chain over fragments | `packages/shared/src/evidence-package/fragments.ts:81-86`; `packages/shared/src/evidence-verify/verify.ts:390-397`, `:428`, `:464-465` | `chain_0 = SHA-256("")`, `chain_n = SHA-256(chain_{n-1} || frag_sha_n)` in ONE shared function used by the pipeline and the verifier; the verifier checks the RECORDED chain against its rule and, separately, a chain over the bytes it read (`actual`, not the recorded hash) | holds |
| 4 | Verify is independent of the Core's database | `packages/shared/src/evidence-verify/verify.ts:39-103` (imports: `@noble/hashes`, `../evidence-package`, own files); `apps/core-server/src/evidence-verify/index.ts:31-41`, `package-reader.ts:15-18` | no import of `../db` or the engine in the verify units; the Core side adds a file reader, the fragment opener of the credential store and the certificate reader. `trusted` = V-01, V-03, V-09, V-13 pass (`verify.ts:1071`); the certificate anchor is an OPTION (`:282-283`, `:665`): without it a self-consistent re-signed copy passes - the stated limit of D199 | holds, with the stated limit |
| 5 | Session key lifecycle | `apps/core-server/src/sealing-host/session-key.ts:53-76`, `:112-124` | the key is made by the first sealed fragment with the session's binding; an existing key is opened only when its binding is this session's, else `SESSION_KEY_NOT_OF_SESSION` (`:64`); a nonce drawn twice in one process is refused (`:71`); a start is refused when a key of that id already exists (`:120`). The seed-time sealer has no binding and renews its key before every seal (`:88-92`) | holds; the IV uniqueness is probabilistic and says so (`:28-34`) |
| 6 | Reset destroys session keys | `apps/core-server/src/db/reset/session-artefacts.ts:229-259` | the sessions the database named plus every other key in the folder (`everyKey`); a key is KEPT when its package folder is still there (`:239-248`); key and binding blob go together (`:250-255`) | holds |
| 7 | Interrupted-prefix seal | `pipeline.ts:337-394`, `:459`, `:507`, `:511-520`, `:718` | the first fragment that fails ends the prefix; zero valid fragments throws; the last sealed fragment says `truncated`; no camera file sealable -> `NOTHING_SEALABLE`; `interrupted` is true for an interrupted cause, a dropped tail, a partial file or an omitted file; the manifest's `stoppedAt` is null when interrupted | holds |
| 8 | Profile from the DECLARED format | `apps/core-server/src/sealing-host/session-reader.ts:225-250`; `capture/fragments.ts:655-671` | field 36 = codec + picture of the sample entry + the whole-number nominal rate the SPS declares (29.97 -> 30); no rate when none is declared or it has no whole-number name; never a measured average. The rate is `timeScale / (2 * unitsInTick)` | holds. NOTE: `fixed_frame_rate_flag` is not read, so the factor 2 is assumed |
| 9 | Selector in force | `packages/shared/src/sim/selector-in-force.ts` (rule comment `:1-27`; `sessionIsOpen`, `selectorOfSession`, `audioPairInForce`) | a session's snapshot names the sources only while its state is stated and is not `SEALED`; otherwise the current selector; the audio pair follows the same rule and an open session without a pair gives no pair | holds |
| 10 | Life of the restart fault | `apps/core-server/src/engine/restart-fault.ts:52-73`; `engine/host.ts:1259`, `:1314`; `engine/rehydrate.ts:381-387` | active only while the session it was raised for is still open in FAULT / RECOVERY / FINALIZING; cleared in the same unit as `completeSeal` and `endSessionUnsealable`, and at every process start for a stored one | holds |
| 11 | Stall watch of the web player | `apps/core-web/src/features/evidence/sealed-player.tsx:54`, `:103-106`, `:355-362`, `:379-393` | "alive" rests on `readyState >= HAVE_METADATA` or a buffered range, never on the clock; a running watch keeps its time; one question per file and session | holds for the driven cases; a loaded file altered in its last seconds stays NOT PROVEN (13d section 6) |
| 12 | Probe at every use | `apps/core-server/src/capture-notices/index.ts:152-173`; `precheck.ts:123-125` | the probe source is asked at each pre-check and each input re-read; no answer is kept | holds. Observation V98-13: a probe source that THROWS is reported and returns null, and the gate then asks nothing |
| 13 | No simulator integrity rows in real capture | `packages/shared/src/sim/generator.ts:222`, `:235-239`, `:270` | with the Core's own capture the generator writes no recording activity and no idle health-check event | holds |

13 places read; 0 defects found; 2 observations (rows 8 and 12).

---

## 6. Regression

| Run | Tree | What ran | Result | Source |
|---|---|---|---|---|
| Wave L pre-commit | `b05106b` + wave L | 8 suites, typecheck / lint x7, kill matrix, seal e2e, development e2e | GREEN in one run | `test/11` |
| Wave M pre-commit | `7b1aded` + wave M | the same | **"RED overall by the letter"**: one db test (`integration-d1b.db.test.ts`) red in run 1, green alone and in run 2; one Jest "worker failed to exit" line | `test/12:11-24`, `:304` |
| Row 95 | `a5d75ed` + the uncommitted consolidation (later `951c80e`) | typecheck / lint x7 + root; shared 2612, capture-protocol 31, core unit 6700, core db 2423 (+7 skipped), web 2224, mobile 2915, transcriber 564 (+3 skipped), mock-core 19, pg-scripts 57; seal e2e 3; development e2e 2 (+2 skipped: speech, attended); kill matrix 35; contract guards 66 + 38; stability 15 of 15 | GREEN; status needs-review for the literal M9-PIN-1 grep | `test/16` |
| Row 97, pass 2 | `951c80e` + both hygiene passes, before the 20 commits | shared 2614, core unit 6702, core db 2423 (+7), web 2224, mobile 2917 | 0 failed | `implementation/163` section 8 (`:294-298`) |
| Mine | `713d83f` | one guard file, 42 tests | passed | section 0 |

Stated plainly:

- **No whole suite and no heavy run has been reported on `713d83f` itself.** Row 95 ran before row
  97. Row 97 changed product code: `c946cb5` (the error log keeps the entry written after its
  folder was removed), `830f891` (unused exports and three i18n keys removed), `1379cf3` (one
  hand-off mark on mobile). Row 97's own five suites ran on its working tree before the commits
  were cut; transcriber, mock-core, capture-protocol, pg-scripts, the seal e2e, the kill matrix
  and the development e2e were not run after those changes (`implementation/163:305`).
- The whole suites and heavy runs after row 97 are the parallel final test agent's (row 100).
  They are not mine and I claim nothing about them.
- Not in any run since the wave-H checkpoint that I read: the worker's whole e2e series (122
  checks, last at D188 on worker 0.5.0; the worker's sources are unchanged since by the gate's
  section-hash comparison in `08` section 1 and by no later worker change in D192-D240 - I did
  not re-compare), and the speech case of the development e2e (2 skipped in `test/16` check 11;
  last green at D211).
- The `integration-d1b` race: "not shown to be gone, only not seen" (`test/16` section 8 item 4).

---

## 7. Known limits and open decisions (for the final report)

### 7.1 Limits the controller ruled

| Limit | Source |
|---|---|
| Recorded media is plaintext on the media root until the seal completes | D147 (A) |
| The audit extract is not covered by the package signature; the field is for the next manifest revision; lost-audio evidence in it is therefore not signed | D182, D183 |
| A development mark is trustworthy only with the Core's certificate hash from outside the package | D199 |
| Library mount warnings (react-native-svg layout events x Reanimated): no native patch now; the three-line patch is listed for the release-build session | D224 (2) |
| No manifest member for the DELIVERED frame rate; `tracks[].profile` is the declared format | D226; `PE-WK-47` |
| `EV-20261011-0025` keeps its fractional profile label and alert for ever (sealed) | D226 |
| `RTC` is a bare enum on the audit row and op 40; only the manifest pairs it with `HOST_SYSTEM_CLOCK` | G89d-01; D235 |
| An acknowledgement by a non-reviewer writes no audit row: needs a 68th audit type | D237 |
| `session.input.profileId` and the New Session label "Standard (1080p / 25 fps)"; engine "READY" words beside "Not checked"; no `checkedAt` from the Core | D224 (5), D231, D217 (6) |
| G89b-07: a package names its Core twice (`NOT_CONFIGURED` in the manifest, the stored device id in the extract and on the clients) | `12b:219`; D224 (5) |
| Field 40 cannot tell "measured 0" from "not measured" | D203 |
| The manifest does not state resumed / cause / worker version | D222 (6) |
| No `CORE_STOPPED` cause; `coreNotRunning` is a member | D217 (5), D218 (3) |
| An UNSEALABLE session has no way back into a seal; a cause that never clears keeps the Core blocked until someone presses "Retry sealing" | D186 (1), (2); D231 |
| A camera more than 2 s behind may leave up to 1 s of wrongly timed video before it is given up | D188 (2); `README.md:476` |
| No speaker label on any sealed transcript | D157 |
| Server STT backend not run live; for it the model version / quantisation / hash are null by rule | D160, D163; 11b R1 |
| R80-05, R74-14 (2), R80-06 second half, the R80-08 residual (a committed revision whose staged file is lost) | D180, D187 |
| A blocked alert, the kept-plaintext notice and the boot sweep inside a running Core; every REAL_PRODUCTION refusal | tests only: 12d F-2 |
| `M4-MIC-ACTIVE-*`: one rigged live view | D227 (3), D239 |
| Fake ONVIF stub N = 1 | D126 |
| The download link is not single use inside its 60 s; no automatic renewal of a live media session | D223 (3), D225 (1) |
| Class-C hardware items; power loss, real ENOSPC, a volume without hard links | blueprint section 9; D127 |
| Biometric scenarios skipped, never passed | D151 |

### 7.2 Findings carried

GM-01 (MINOR), GM-02 (MINOR), GM-03..05 (NOTE): report 14 section 2; ruled for the batch after the
judging session, D239.

### 7.3 Decisions that are the user's

| Decision | Source |
|---|---|
| FFmpeg licence: the composite encoder AND how any real-capture Core is shipped (the worker links a GPL-3.0-or-later FFmpeg) | D139 (1), D195 (R96-3) |
| A procedure for keeping / releasing / destroying a quarantine folder | D195 (R96-6) |
| Acceptance of the SEC35-26 privacy / DPIA carry | D195 (R96-6) |
| Run the microphone `--diagnose` mode (at most 23 s of microphone); then the choice if no argument fixes the 8/9 rate | D136 |
| An unsealed LOCAL_DEVICE recording has no reset tool | D217 (8) |
| A server-side acknowledgement member for local-device pre-check / start (`localSourceAcknowledged`): proposal, not built | D206 (4) |
| Seal-time encryption (plaintext until the seal) and provenance-by-backend: rulings flagged as revisable | D147, D160 |
| OD-21 legal confirmation of fragmented MP4 (before handover) | `01_translated.md:339`; D4 |
| Data clean-up: `.data/capture-local/runs/l134_cam_t1`, `l134_cam_t2` (local-device recordings, kept until the user says); about 1.3 GB under `.data/test-row61-row140*`; raw-audio scratch of the earlier build under `<dataDir>/transcriber/sessions/`; `.data/gate-75b-set-aside/`; lane 2's quarantine folders and its about 51 items; the planted revision 4 of `EV-20261010-0020` | D130, D161, D189, D216, note 159 section 6, 11b lapses |
| The tablet's media volume stays at 4 of 15 | D225 (3) |

---

## 8. Findings of this verification

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| V98-01 | MEDIUM | Nothing built in fix waves L and M has a spec erratum: 17 built changes named in 4.3. D237 itself says one is "owed" | 4.3 |
| V98-02 | MEDIUM | The root `README.md` real-capture section "describes the tree at commit `f293221`" with corrections for waves H and I (and the seal rig of K); it has nothing of waves L and M, and its "Read this first" still says "no real speech engine has been through a recorded, sealed session", which D211 and report `11b` section 4 contradict. `grep -c -i` in the README = 0 for: the source rig, "Reanimated" / mount warnings, `profileId`, the acknowledgement without an audit row, the out-of-band certificate hash, `diagnose` | `README.md:393-397`; section 4.3 row 1 |
| V98-03 | MEDIUM | `status_tasks.md` and `delegation_progress_report.md` have not been kept since the pause point: the first ends at "PAUSE POINT - 2026-10-09" and the D150 / D151 note, the second at "Wave C (2026-10-09)"; `git log -1` for both: 2026-10-10 09:51. Row states after row 59 exist only as prose in `decisions.md`; model overrides (the Sonnet test runners of D122) are not recorded where CLAUDE.md section 11 rule 3 puts them. `report/report.md` is still the hand-off to Kilo | file reads; `git log -1 --format=%ad` |
| V98-04 | MEDIUM (until row 100 reports) | No whole suite or heavy run is reported on `713d83f`; row 97 changed product code after row 95 | section 6 |
| V98-05 | LOW | The final chain was launched in parallel (D240), while rows 99, 100, 101 each depend on the row before (`02_structured.md:430` and the three rows after it; `01_translated.md:384` "final chain 98 -> 99 -> 100 -> 101 strictly sequential"). No ruling records the change. Effect: this report cannot take in the results of rows 99-101, and "failures routed" of row 98 cannot feed them | D240; blueprint rows 98-101 |
| V98-06 | LOW | Decision-log gap: no decision records the wave M commit `a5d75ed` (`grep -c a5d75ed decisions.md` = 0) or its pre-commit run `test/12`, whose own headline is "RED overall by the letter" (one flaky db test). D240 is dated 2026-10-12 while its commits are dated 2026-10-11, and is itself uncommitted | `test/12:11`; `git status` |
| V98-07 | LOW | D236 announced "the integrity card after a restart" for the confirmation session and D239 lists the card as confirmed. Report 14 read the card of a session sealed in the same Core process ("never restarted", `14:113`). Condition F-1 of `12d` rests on the driver's own run (note 159 section 3.8) | `14:16`, `:113`; `159:211-215` |
| V98-08 | LOW | Report 14 section 3: `GET session/current` showed the pre-check item without `params` while `contract_wave_m.md:39-45` lists `params { deviceId, rule }`; where the clients read it "was not checked". D239 does not carry it. The schema has the member as optional (`state-slices.ts:216`) | report 14 section 3 |
| V98-09 | LOW | `session.captureCheckpoints` has no exported contract example; client tests therefore build the object themselves - the pattern D208 ruled out ("the consumer's tests must import the contract's examples") | 4.2 row 5 |
| V98-10 | LOW | The letter of D163 ("no agent run ... SELECTS, pre-checks or starts such a selector") was not kept at re-gate 09b and re-checks 09c, 09d: `MIC-03` and `CAM-03` were put on a selector line "select only" (39 s in 09d) under the environment note's wording (`initialization/06:283`). No pre-check, no start, no confirm; the reports state `pgrep` found no capture process. No decision amends D163 for it | `09d:66`, `:125`; `09c:64`, `:71`; `09b:104` |
| V98-11 | LOW | The acceptance rule of M9-PIN-1 was amended by the row that had to meet it (erratum of row 97 in `10_test_strategy.md:647`, commit `713d83f`: dated-history lines are exempt). It is written openly; the stale lines were corrected in `c0be906`. I did not re-run the grep | `git show 713d83f -- masterplan/10_test_strategy.md` |
| V98-12 | LOW | Five rows delivered their artifact under another name than the blueprint states (95, 97, 98, 139, 140) and the blueprint has no erratum for it; row 98's catalogue reconciliation n/n (M9-CH-1) was not asked of this row and is not done here | section 3; section 0 |
| V98-13 | LOW (for row 101 to judge) | `capture-notices/index.ts:163-173`: when the probe source throws, the failure is reported and the gate gets null; `precheck.ts:125` then returns "not asked", so that pre-check judges no reachability. A session start without a camera still faults by name | code read |
| V98-14 | NOTE | `capture/fragments.ts:667-671`: the declared frame rate assumes two ticks per frame without reading `fixed_frame_rate_flag` | code read |
| V98-15 | NOTE | Row 140's text ("with this Mac's camera and microphone") is met on generated sources only; row 96 is partial (V98-02) | section 3 |

Count: MEDIUM 4, LOW 9, NOTE 2. No BLOCKER and no HIGH finding of my own.

---

## 9. Verdict

**PASS WITH CONDITIONS** for "DONE ON THIS MAC WITH FAKE DEVICES", as far as row 98 can say it.

Why not FAIL: every scheduled implementation, review and gate row 41-97 and 106-142 has its
artifact; the six milestone gates M3-M8 each end at PASS WITH CONDITIONS with no BLOCKER or MAJOR
finding open in their last report; the contract totals and the schema are what the documents say;
the thirteen places read on the evidence-integrity path hold; the byte-level core was re-proven
outside the product by a gate verifier (D199).

Why not a plain PASS - the conditions:

| # | Condition | Owner |
|---|---|---|
| K-1 | Rows 99, 100 and 101 report green. The completion line names the whole chain 98-101; this row is one of four | controller |
| K-2 | Row 100 (or a runner) reports the whole suites and the heavy runs green on `713d83f` (V98-04) | final test agent |
| K-3 | `M8-CMP-1` (composite export) is stated in the final report as NOT MET, blocked on the licence decision, and not as part of a green M8 (O-1) | controller -> user |
| K-4 | Errata for the 17 built changes of waves L and M, and the README refresh (V98-01, V98-02) | docs owner |
| K-5 | `status_tasks.md` and `delegation_progress_report.md` brought to the present; the decision log completed for `a5d75ed` / `test/12`; D240's date (V98-03, V98-06) | controller |
| K-6 | The final report carries sections 2.2 and 7 as they are: the two MAJOR-class limits (O-2, O-3), the not-proven list (O-5..O-11, O-17), the user's decisions (7.3) | controller |
| K-7 | GM-01 and GM-02 fixed and re-checked in the batch after the judging session, as ruled (D239) | controller |

What must still happen before the task may be called complete: K-1 to K-6, then memory
persistence and the final report. The full-feature UI judging session on the emulators (D150) is
a SEPARATE, LATER step: it starts after row 101, is not part of the completion line, and its
findings (with GM-01 / GM-02) get their own fix batch and re-check. The class-C pack (row 105)
and the handover items stay outside this line.

---
*Generated: 2026-10-11 21:05 WIB*
