---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-07
agent: task-architect
revision: 2.2 (maintenance of rev 2.1 from execution findings D65-D68; rev 2.1 = post-audit revision of the implementation blueprint, approved at the SECOND BLUEPRINT_APPROVAL, D24)
revision_row: RV-BP (revision round D19/D20); rev 2.2 = blueprint maintenance pass 2026-10-09
status: rev 2.1 approved (D24); rev 2.2 proposed as MINOR by the task-architect, classification to be confirmed by the controller
revision_2_2_note: 8 rows reworded (57, 58, 64, 66, 82, 84, 115, 117), one dependency added (58 <- 113), no row added or removed, no agent or output path changed, section 10 unchanged. Change log in section 0.2. Text outside sections 0.2, the 8 rows, the three narrative places of change 12, the self-check and the change classification is the rev-2.1 text as approved and still speaks in its tense (for example "pending" in the Dependencies table).
revision_note: rev 2.0 (row 40, Kilo) is revised by row RV-BP after the independent audits AU-1/AU-2/AU-3 (D16-D19) and the new requirement R-8 (D20). Rows 1-40 are executed (audit trail section 5.5). Rows 41-105 keep their rev-2.0 step numbers so that every audit citation stays valid; rows 106-119 are new. Change log in section 0.1.
tiering: default  # 01_translated.md carries no `tiering` field; its `model_tier: default` is copied here (D9 governs paid-first resolution at launch)
scale_category: Enhancement (major, contract-breaking) with embedded Research (technical spikes closed at M1; CPU-STT clause re-opened by rows 107-110)
professional_document: false
source_original: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/identification/01_original.md
source_translated: /Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/identification/01_translated.md
repository_baseline: HEAD 2a4f4ea (docs) on top of c2c983b (last code state); diff baseline for this task c2c983b (D6)
change_class: MAJOR (second approval gate; see "Change Classification")
---

# Structured Task Blueprint: DEMS — real capture devices, sealing v2 and transcript (next phase)

## 0. Summary (rev 2.1, maintained as rev 2.2 — see 0.2)

| Item | Value |
|---|---|
| What rev 2.1 is | The rev-2.0 implementation blueprint (65 rows, steps 41-105) corrected by the confirmed audit findings (AU3 REV-1..REV-4 plus Minors; AU2-01..AU2-11; AU1 references) and extended with the new requirement R-8 (D20). **14 new rows (106-119)**; 25 existing rows amended; nothing else changed |
| What changed most | (1) **The CPU-only STT path is real on this Mac again**: whisper.cpp built from source under `.cache/` with GPU/Metal off and no Homebrew change, the on-disk model converted in an isolated venv, a CPU-only functional check 2 + 1 (rows 107-110); the M6 gate tests both backends and the "no dropped fragment while STT runs" check runs on `cpu-local`. (2) **Capture-worker proofs come first**: row 111 proves "one AAC encoder feeds both camera files" (H-4) and the two-clock case (H-10) before the rest of M3. (3) **R-8 STT configuration**: rows 112-119 (kept table, ops 90-92, web menu, read-only mobile status, next-session rule, sealing when disabled or unreachable). (4) **Scheduling repaired**: the wave table is rebuilt from the Depends On column; rows 84 and 91 wait for their gates |
| Rows in this revision | 79 rows (41-119): 4 M0 pickups (41, 42 done, 43, 106), 4 M1 CPU re-open (107-110), 15 M2, 9 M3, 6 M4, 5 M5, 11 M6, 9 M7, 5 M8, 7 M9, 3 conditional (102-104), 1 close-out (105) |
| Completion line | One definition only, in section 5 ("DONE ON THIS MAC WITH FAKE DEVICES") |
| Registry count note | 89 operations (34 GET / 55 POST) through M5 (D14(c)). If Q-STT-CFG is confirmed, R-8 adds ops 90-92 in M6 (row 113). The pins then come from `03_api_contract.md` §2.5, not from this blueprint (expected 92 = 35 GET / 57 POST; audit types 62 -> 63) |
| Next approval | **SECOND BLUEPRINT_APPROVAL.** One batch of 9 questions plus 2 informational defaults (section "Gate Questions (rev 2.1)"). No rev-2.1 row executes before that approval |

### 0.1 Change log rev 2.0 -> rev 2.1 (source of every change)

| Source finding | Severity | Change in rev 2.1 |
|---|---|---|
| AU3-01 / AU2-01 (REV-1) | Major / High | New rows 107 (CPU build), 108 (model conversion; writes the missing `research/09`), 109 (CPU-only functional check, 2 runs), 110 (+1 addendum gate). Row 76: both backends implemented and exercised; no "already coded" claim. Row 77: `M6-DF-1` on `cpu-local`. Row 81: `M6-TF-1` +1 on both backends with the `-ng` command quoted. G-1 Q-INSTALL line, §1.2 (D222), §1.3 (MLX wording) and §7 (R-5/R-7) corrected. Consistent again with `masterplan/01_specs.md:187` (R-5 AC-1 "on CPU ... GPU/Metal disabled", status "NOT yet met") and the C-N1 row |
| AU2-02 | High | New gate question **Q-STT-ROUTE** (source build under `.cache/`, GPU off, no Homebrew change = recommended; Homebrew in a maintenance window; defer to hardware). Row 107 names the build route: cmake is not installed, so cmake comes from an isolated venv and the compiler is the Xcode command-line clang |
| AU3-02 (REV-2) | Major | **Q-D7 rewritten** with three options: (a) oMLX for development + whisper.cpp proven on this Mac (RECOMMENDED, matches D7(b)); (b) oMLX only on the Mac, CPU path first on the Core; (c) whisper.cpp only. The "both backends already coded" claim is removed (0 repo hits, AU-2 §4.4) |
| AU3-03 | Major | Resolved by REV-1/REV-2. Row 106 checks that the spec suite is consistent after RV-SPEC. Row 81 quotes the CPU command |
| AU3-04 (REV-3) | Major | New gate question **Q-WORKER** (C program against libavfilter vs Node FFI/binding). New row 111 makes the H-4 and H-10 proofs the first M3 worker deliverable. Row 58 starts only after 111 passes and builds on its skeleton |
| AU2-06 | Medium | H-10 two-clock proof in row 111 (first proof) and the separate-clock fake camera in row 60 (`M3-AV-2`) |
| AU2-08 | Medium | New gate question **Q-GOP** (= spec OP-GOP). Rows 59 (RPO = one camera GOP; RECOVERY tail validation by box walk; observed-GOP outcome), 60 (long-GOP fake camera, `M3-KC-4`), 64 (gate) and 82 (RECOVERY flags a truncated tail explicitly) amended. Row 59 now depends on row 60 (fixture needed) |
| AU2-03 / AU2-04 | Medium | Rows 60 and 64 use the sample-exact analyser and the separate regression bound (`M3-AV-1`: measured vs truth within 2 ms for 0 / +80 / -80 ms truths) next to the ±40 ms product bound. The -1.333 ms value is not used anywhere in rev 2.1 |
| AU2-05 | Medium | Rows 71, 72 and 75: gaplessness is proven by the decoded sample count plus per-input continuity; `M5-GAP-1` must FAIL the 1,000-samples-removed negative vector |
| AU2-07 | Low | Row 71: switch bound restated per input chunk (one worker input chunk + IPC latency; at most 21.333 ms with 1024-sample frames); avfilter commands applied on the filtering thread only. New gate question **Q-CLICK** (= spec OP-CLICK) |
| AU2-10 / AU2-11 | Low | Standing invariant: back up the oMLX log before any `start.sh`. §1.3 wording: MLX excluded for the product path; oMLX permitted for development only |
| AU3-05 (REV-4) | Minor | Section 10 rebuilt from the Depends On column (topological levels); the row 65/71/76 conflicts are gone |
| AU3-06 (REV-4) | Minor | Row 84 depends on 64 and 81; row 91 depends on 89 |
| AU3-07 (REV-4) | Minor | Row 41 cut to the P-4 gate-file renumber only. Row 42 marked done (W12, D15(c)) and removed from the dependencies of rows 44 and 102 |
| AU3-08 | Minor | One "done on this Mac" definition (section 5); sections 6, Verification and Recommendation point to it |
| AU3-09 | Minor | §5.5 no longer cites a non-existent row-11 record; the skip is cited as D7/D10(d). Row 108 now writes `research/09_spike_stt_model_conversion.md` for `cpu-local` |
| AU3-13 | Minor | Row 91: the composite encoder is chosen only after the M8 licence check recorded in DOC-05 |
| AU3-14 | Minor | B16 moved into row 46's Task. Row 58 narrowed by row 111. Row 48 stays one row (single owner; noted, not split) |
| AU3-15 / AU3-16 | Nit | Q-SP-4 and Q-SEC-3 shown as "default, no action needed" |
| AU3-18 | Nit | Row 105 phase = `identification` (its output) |
| AU3-10/11/12/17/19, AU1-4 | Minor/Nit | Controller-owned: tracker rows 16/29, Drift Log entries, D5 deviation record, provenance label, decisions-table blank lines, D13(c) erratum. Not part of this file; listed so they are routed |
| AU1-1, AU1-2 (ruling b, D19), AU1-5, AU1-6 | Major/Nit | **Done by revision RV-CODE** (D19/D20). Not duplicated: row 97 only re-checks them and picks up any residual RV-CODE leaves. The A4 device check stays pre-handover |
| AU1-3 | Major | Row 99 and AR-1 measure dependency posture by unique ROOT advisories (D19 ruling), not by npm's propagated package count |
| D20 (R-8) | new requirement | New rows 112 (table), 114 (seed + kept entry), 113 (ops 90-92), 115 (runtime + test connection), 116 (seal-side DISABLED/unreachable), 117 (web menu), 118 (tablet/phone read-only), 119 (manifest + verify). Rows 53, 55, 56, 80, 81, 87, 88 and 89 amended. New gate question **Q-STT-CFG**. Names follow RV-SPEC (`stt_config`, ops 90-92, `M2-STTCFG-DB`, `M6-STTCFG-*`) |
| Revision round itself | — | New row 106: reconcile the specs with RV-SPEC (one verifier pass, gaps routed to the owning author) before M2 opens |

### 0.2 Change log rev 2.1 -> rev 2.2 (2026-10-09, maintenance from execution findings)

Rev 2.2 corrects ownership and wording in eight rows after the pair reviews of rows 57, 111 and 113 and the test-catalogue changes T-1..T-10 that followed them (changes 8-12). No row is added or removed, no Agent_to_Invoke and no Expected Output path changes. The sentences for rows 57, 58 and 84 are the ones placed in `masterplan/11_audit_errata.md` §5.4 (errata PE-57-01..10, PE-111-01..08, PE-113-01..16).

| # | Row | Cell(s) changed | Change in rev 2.2 | Source |
|---|---|---|---|---|
| 1 | 57 | Task Description | Closes list corrected to NM-03, CS-01, CS-03 only. SH-18 and CS-04 are not closed here: telemetry and warning actions plus the forwarder go to row 58, sealing-progress and complete-seal to row 82, the hosted pair to row 66. M3-KC-1 is met for its process half only. The respawn sentence holds before the first durable fragment and between sessions only | D65(b), D65(c), D67 (option C per OD-08); errata §5.4; PE-57-06, PE-57-09 |
| 2 | 58 | Task Description, Depends On, Verification | Inherited-work sentence added (13 items). Depends On gains `113`. Verification extended by the lossless record check, files growing on disk during the session, no UDP socket with all sockets on loopback, non-zero exit on a fatal error, and the file half of M3-KC-1 | D66, D67, D65(c), D65(g); errata §5.4; PE-57-03..06, PE-57-10, PE-111-01..07 |
| 3 | 66 | Task Description | One clause: lands the hosted pair `switchAudioSource` / `setCaptureConfig` of SH-18 (the row text did not say it) | D65(b); cap §B.1 "Closure status" (PE-57-09) |
| 4 | 82 | Task Description | The existing clause "CS-04 engine host INTERNAL actions" now names the pair it means: `applySealingProgress` / `completeSeal` of SH-18 / CS-04, with `completeSeal` triggered by the lossless seal-completion record | D65(b), D67; cap §B.1 (PE-57-09, PE-57-05) |
| 5 | 84 | Task Description, Verification | Ownership sentence added: `provideCredentialSealer` plus the opener for the STT `SECRET` credential, the interim behaviour until the row lands, and one added verification clause | D68(c); errata §5.4; PE-113-08, PE-113-16 |
| 6 | 115 | Task Description | One clause: provides the op-92 probe through `sttConfigControl(app).provideProbe`, proves a 200 on a booted server, follows no redirect, connects `localhost` as 127.0.0.1, never sends the bearer key to an arbitrary loopback port, treats a stored `ENCRYPTED` kind as unavailable until row 84 | D68(d), D68(c); pair-113 N-14 |
| 7 | 117 | Task Description | One clause: offers the credential reference form only until row 84; consumes the shared client-side blanking rule set | D68(c), D68(a) |
| 8 | 58 | Verification | Names the new catalogue check `M3-REC-1` (lossless record path, run once, owning row 58) | test §A.3 (`10_test_strategy.md:169`); catalogue change T-8; PE-57-05 |
| 9 | 64 | Task Description, Verification | `M3-REC-1` added to the M3 gate check list. The gate also owns the T-10 gate note: the log shows `capture supervisor booted` and `capture supervisor stopped` (one line, run once, not a named check) | catalogue changes T-8, T-10; pair-57 F-9; `test_expert_pair_catalogue_t1_t10.md` O-2 |
| 10 | 84 | Verification | The `SECRET`-write 200 clause is labelled as the 200 half of `M6-STTCFG-API` | catalogue change T-9; `test_expert_pair_catalogue_t1_t10.md` O-4 |
| 11 | 115 | Verification | One clause added: operation 92 answers 200 on a booted server once the probe is provided (the op-92 200 half of `M6-STTCFG-API`) | catalogue change T-9; O-4; D68(d) |
| 12 | §4.1, §6 (M3 line), Verification & Testing Strategy | narrative | Catalogue totals 207 active + 18 conditional -> 219 active + 10 conditional (M3 = 22), the only place that quoted totals; `M3-REC-1` and the T-10 note added to the M3 line of §6; `M3-REC-1` added to the integration-testing list | `10_test_strategy.md:622`; `test_expert_pair_catalogue_t1_t10.md:61-65` |

**Section 10 is unchanged.** By the stated method (level = 1 + the highest level among the dependencies), row 58 depended on 57 (L10) and 111 (L10), so it sat at L11. The new dependency 113 also sits at L10 (wave W11, with 57 and 111). Row 58 therefore stays at L11 (W12), and no row downstream of it moves. No wave is renumbered. The graph stays acyclic: row 113 depends on 56 and 112 only, and neither depends on 58.

**Execution note, not a row change (D63(c)) — pairing protocol.** Every implementation row runs as a pair: a driver (the row's Agent_to_Invoke) and an independent navigator (a different agent, `senior-code-reviewer` or `verifier`). The navigator reads the diff, re-runs the row's checks itself and writes `delegation_progress/pair_<row>_navigator.md`. Findings go back to the driver, a dispute is settled by a test, and dependent rows start only after the navigator's verdict. Pairing replaces no review row, gate or final-chain step and adds no device or browser runs beyond 2 + 1. A pair counts as two agents against the ceiling of 8 in flight (D63(d)).

**Rows already executed keep their numbers.** Rows 41-57, 106-114 (incl. 111 and 113) are not re-delegated by rev 2.2; the row-57 edit corrects the record of what that row closed.

---

## 1. Prior Task Continuity

### 1.1 Predecessor (task 2, closed 2026-10-07)

Fastify Core on PostgreSQL 18 (`127.0.0.1:4432`), 75 operations, server-side RBAC, pairing, Live mode on web and mobile; SC 8 PASS / 3 CAUTION / 0 FAIL (`report/report.md` §1). Commits `0a9e317`, `c2c983b`, docs `85c0fb5`/`2a4f4ea`, local only (D6). Ledger: shared 71/1,851; core-server unit 160/3,954; db 124/1,751; core-web 117/1,495; mobile 192/1,988 (post wave-A and re-confirmed by AU-1: 193/1,994). Host: PostgreSQL running, only `dems_demo`; three emulators paired to the main instance; no lanes; no Core/Vite/Metro running.

### 1.2 Inherited decisions (live)

| Decision | Content carried | Where it lands (rev 2.1) |
|---|---|---|
| D219 (1)-(3) | Selector in the Core; capture worker behind the API; no new session until SEALED | rows 47, 57-62, 66, 111 |
| D220, D221 | One active mic, second is failover; manual UI toggle; one audio source at playback | rows 71-73 (+ Q-CLICK) |
| D222, D223 (live part) | Transcript inside the seal; **STT on CPU + RAM**; sealing waits for the transcript | rows 76-79, 82; **CPU path proven on this Mac by rows 107-110 and M6-DF-1 on `cpu-local`** (rev 2.0 had dropped it; AU3-01) |
| D224, D225 | One whole file per camera; append-only fMP4 with a running SHA-256 | rows 59, 83-85, 111 (H-4) |
| D226 (labels), D229, D230 | Labels when possible; Whisper large-v3-turbo on disk; no benchmark on this Mac; **a working STT path through a CPU runtime first** | rows 76-78, 107-110; benchmark class C (section 9) |
| D231 | No biometric device steps | every verification column |
| D232, D233 | 2 runs + 1 verification per check; long campaigns only on announced handover | gates; rows 86, 98-101, 109/110; section 9 |
| This task D1-D15 | D4 all-defaults approval; D5/D9 concurrency + paid-first; D6 baseline; D7 STT reuse (oMLX for Mac-side work; CPU runtime NOT cancelled, D7(b)); D10-D13 wave gates; D12(d) GStreamer deferred (Q-INST-1); D14(c) registry 89 ops; D14(d) three security flags; D15 handoff | process; Gate Questions |
| D16-D19 | Independent audit; AU-3/AU-2/AU-1 gated; controller rulings: AU1-2 ruling (b) (the Core's recorded duration wins at SEALED), AU1-3 root-advisory basis; revision round RV-BP / RV-SPEC / RV-CODE | this revision; rows 97, 99 |
| D20 | **R-8**: STT server configurable, active/deactivate via a config menu, stored in the DB (defaults to be confirmed as Q-STT-CFG) | rows 112-119 |

### 1.3 Superseded (never revived)

D223 "master multi-track remux" (by D224/D225); D226 benchmark plan on this Mac (by D230); D219 "audio feeds MIC 1/2" (by D220/D221); AUDIO-MIX track and channel attribution (withdrawn). **MLX fp16 model copy: excluded for the product path (D229, Apple GPU).** D7 permits the oMLX/MLX server, which also runs on the Apple GPU (`Device(gpu, 0)`, AU-2 §4.3), **for development and functional checks only**. The product STT is `cpu-local` (D222). (Rev 2.0's wording "a different artifact and stands" is withdrawn, AU2-11.)

### 1.4 Open items inherited

B2-B17, A1-A6, C1-C9 placement is concrete in rows (section 8). Still open: OD-21 legal confirmation (no external authority found), Q-HW (unknown), braces/node-forge accepted risk (now measured as root advisories, AU1-3), SEC35-26 privacy/DPIA (documented at row 96, re-surfaced at row 99).

### 1.5 Conflicts and resolutions

CF-1..CF-5 (rev 1) stand as executed history. CF-6..CF-8 (rev 2.0) stand, with CF-8 updated below.

| # | Conflict | Resolution |
|---|---|---|
| CF-6 | M2-W1 (lane re-creation) consumes later M2 artifacts | Split into row 44 (lane infrastructure, first M2 row) and row 53 (v2 completion). Unchanged |
| CF-7 | The plan's wave table placed M6-W1 beside M3-W1 although M6-W1 depends on M3-W1 | **Superseded by section 10 of rev 2.1**: waves are now computed from the Depends On column, so a row never shares a wave with its dependency (AU3-05) |
| CF-8 | Row 36 stale counts, row 31 plural path, C-N4 clause | GAP-01 counts and GAP-02 path were applied in W12 (D15(c)). Row 41 keeps only the P-4 renumber; row 42 is done; row 43 stays (C-N4 clause still absent per AU3-07) |
| CF-9 (new) | Audit citations name rev-2.0 row numbers (row 58, row 76, row 97...), while rev 2.1 must insert rows mid-milestone | **Step numbers are stable identifiers.** Rows 41-105 keep their numbers. New rows are appended as 106-119 and placed by dependency. A row may therefore depend on a higher-numbered row (for example 58 depends on 111). Execution order = Depends On; section 10 gives the topological levels and proves the graph is acyclic |
| CF-10 (new) | RV-SPEC and RV-CODE revise `masterplan/*` and code in parallel with this revision | Dependency token `RV` = the revision round is complete and gated by the controller. Row 106 reconciles every spec item that rev-2.1 rows cite. Items RV-CODE fixes (AU1-1/2/5/6) are cited as done by revision, never re-scheduled |
| CF-11 (new) | R-8 adds API operations, but M2 pins 89 operations | Following RV-SPEC (plan F-9; test §A.6a), the R-8 **table and seed** land in M2 (rows 112, 114) and the R-8 **ops 90-92** land in M6 (row 113), which re-generates OpenAPI and re-pins. M2 pins stay at 89; nothing pinned changes before Q-STT-CFG is confirmed |
| CF-12 (new) | `M6-STTCFG-OFF` (test §A.6a) asks for "v2 verify PASS on server", but verify v2 lands in M7 (row 85) | At M6 (rows 116/81) the check asserts the seal state and manifest field. The verify clause is asserted by row 119 and the M7 gate (row 89). Row 106 routes the split of the check text to test-expert |

---

## 2. Memory Screening

Rev-1 screening stands. Rev-2.1 relevant: `feedback-parallelism-push-to-limit` (ceilings honoured in section 10), `feedback-test-depth-2-plus-1` (verification columns; rows 109/110 follow 2 + 1), `feedback-no-device-security-changes` (no agent sets or types an emulator PIN), `feedback-ready-made-frameworks` (Q-WORKER criteria; row 117 builds the web menu from the existing kit components), `reference-dems-environment-gotchas` (`/usr/bin/lockf -k`, `--maxWorkers=2`, never touch SMART WMS ports `[::1]:5173`, `127.0.0.1:5174`, `[::1]:5175`), D7 standing rule (never restart or upgrade oMLX; serialise STT/TTS calls; oMLX is shared with SMART WMS). `project-dems-demo-state`: task 3 was handed to Kilo at `2a4f4ea`; this revision does not change that baseline.

---

## 3. Architecture Challenge & Refinement (rev 2.1 pass)

| Dimension | Challenge | Result |
|---|---|---|
| Intent | Does rev 2.1 deliver what D222/D230 asked, not only what was convenient? | Yes. The CPU-only STT now runs on this Mac before the completion line (rows 107-110, M6-DF-1 on `cpu-local`). A user who picks Q-D7 (b) gets the plain statement that D222 stays unproven here |
| Scale | Are 14 new rows proportionate? | Yes. 4 restore approved scope (CPU path), 1 front-loads the riskiest unproven mechanism (H-4/H-10), 1 reconciles the parallel spec revision, 8 implement R-8 one concern per row |
| Source | Are the new rows grounded in evidence? | CPU route: `research/04_collection_stt.md` F-01, F-10, F-11, F-14/F-15, F-50..F-55; AU-2 §4.1 (no cmake; clang/make/python3.11 present), §6 AU2-02 (Homebrew dry run upgrades `openssl@3`). Worker: S2 `opswitch.c`, AU-2 `au2_switch.c`, `research/12:101`. R-8: D20, `01_specs.md` R-8, test §A.6a |
| Spec | Is every new check defined somewhere other than here? | Yes. RV-SPEC added `M3-AV-1` (regression bound), `M3-AV-2` (H-10), `M3-KC-2` (tail validation), `M3-KC-4` (long GOP), `M5-GAP-1` negative vector, `M6-TF-1` both backends, `M6-DF-1` `cpu-local`, `M2-STTCFG-DB`, `M6-STTCFG-*`. Rows cite them. Row 106 verifies that they exist before M2 opens |
| Impact | What can the CPU build break? | Nothing outside `.cache/stt/` if route (a) holds: no Homebrew write, statically linked, no `/opt/homebrew` linkage (row 107 proves it with `otool -L` and a before/after formula list). The heavy CPU runs (108 conversion, 109 STT) are host-load sensitive and are kept out of waves with jest suites |
| Impact | What can R-8 break? | Pinned counts (handled in M6 by row 113 per CF-11), the kept set 11 -> 12 (row 114), the reset guard, the manifest schema (row 119), and the secret posture (credential never returned or logged; endpoint loopback only) |
| Assumptions | Risky ones | (1) The pinned whisper.cpp source builds with cmake from PyPI plus the Xcode command-line clang (HYPOTHESIS; fallback = stop and re-ask Q-STT-ROUTE, never a silent Homebrew install). (2) The HF-to-ggml converter accepts the safetensors turbo checkpoint (F-55/F-56 show known issues; the fallback is the official pre-converted ggml download under OD-20, recorded, not silent). (3) `large-v3-turbo` on CPU is slow; only function is checked (D230) |

---

## 4. Scale Category Design

Unchanged: Enhancement plus embedded Research. Research closed at the M1 gate (25/25), **except the CPU-STT clause, which rev 2.1 re-opens as a bounded M1 addendum (rows 107-110)** because the M1 gate passed STT-5 on "adaptation documented", not on a CPU run (AU2-01).

### 4.1 Source -> Spec -> Impact

| Triad leg | State | Rev-2.1 continuation |
|---|---|---|
| Source | Closed (rows 1-5, register row 6); audits D16-D19 re-tested the evidence | Rows 107-109 add the missing CPU source evidence |
| Spec | Closed (rows 28-36) and revised by RV-SPEC (errata + proposed R-8) | Row 106 reconciles; rows 41/43 finish the M0 pickups |
| Impact | Register 94 rows; blast radius pinned; test strategy 219 active + 10 conditional checks (M3 = 22; as of 2026-10-09 after D64 and the pair-review changes T-1..T-10; rev 2.1 quoted 207 + 18 after RV-SPEC) | Each row closes named register rows or audit findings; gates prove the regression surface per milestone |

---

## 5. Work Classes and the Hardware-Independent Completion Line

Class A/B/C definitions unchanged (rev 1 §5).

| Class | Rev-2.1 rows |
|---|---|
| A/B scheduled (this Mac) | 41, 43-101, 106-119 (row 42 done) |
| A/B conditional | 102-104 (only on Q-INST-1 = approve); 107-110 drop out if Q-D7 = (b) or Q-STT-ROUTE = (c); 112-119 drop out if Q-STT-CFG is rejected |
| C (hardware / handover) | NOT scheduled: plan M4-W5 (real adapters, ONVIF incl. camera GOP setting, PoE, real mic), M8-W4 (physical e2e), M9-W5 (Core benchmark, TPM signer, long campaigns, A1-A6 pre-handover). Entry criteria in section 9; activation by row 105 |

**DONE ON THIS MAC WITH FAKE DEVICES — the single definition (every other mention points here).** All scheduled rev-2.1 rows are complete: rows 41, 43-101 and 106-119, with row 42 already done, rows 107-110 included unless Q-D7 = (b) or Q-STT-ROUTE = (c), and rows 112-119 included unless Q-STT-CFG is rejected. In addition, the M2-M8 gates (rows 56, 64, 70, 75, 81, 89, 94), the M1 CPU addendum (row 110) and the M9 final chain (rows 98-101) are green, all on fake RTSP, fake audio, a fake ONVIF stub, the simulated driver and emulators. Outside the line: conditional rows 102-104 and the class-C pack (row 105).

### 5.5 Executed history — rev 1 rows 1-40 (compressed audit trail)

Full per-row ledger: `status_tasks.md`; per-agent records: `delegation_progress/`. Nothing here re-executes.

| Rev-1 rows | Scope | Status | Artifacts (pointer) |
|---|---|---|---|
| 1-5 | Re-verification, env probe, media/STT collection, B2 triage | done | research/01_explore, 02_collection, 04_collection_stt, 05_b2_triage; initialization/01_env_check |
| 6 | Errata-applied register (94 rows, 31/31 errata, 29/29 answers) | done | research/03_analysis.md |
| 7-9 | Spikes S1 fMP4+running hash, S2 mic switch, S4 AV sync | done, PASS (re-executed by AU-2: S1 confirmed; S2 mechanism confirmed, gap metric invalid; S4 pass/fail confirmed, -1.333 ms is an analyser artefact) | research/06, 07, 08; verification/21 |
| 10-12 | STT reuse round trip, conversion, functional check | 10 and 12 done on oMLX (Apple GPU); **11 SKIPPED by reuse — recorded in D7(a) and D10(d) only (no `research/09` file exists)**; the CPU clause is re-opened by rows 107-110, and row 108 writes `research/09` for `cpu-local` | initialization/02; research/10; decisions D7, D10(d) |
| 13-14 | GStreamer install + prototype | **DEFERRED (D12(d))** -> conditional rows 102-104 | initialization/03 (blocked record kept) |
| 15 | Media-engine pick (FFmpeg + embedded libavfilter worker) | done (desk-memo form; worker build form open -> Q-WORKER) | research/12 |
| 16-23 | Backlog B10 a-f, RC-1, B2 refresh | done (16 closed "no change required", D10(e)); AU-1: 8 confirmed / 4 partly; follow-ups AU1-1/2/5/6 in RV-CODE | implementation/01-08; verification/20 |
| 24-26 | B2 / B10 / RC-1 reviews | done, PASS | gateway_check/01, 02, 03 |
| 27 | Wave-A regression | done, 5/5 PASS (reproduced by AU-1) | test/01_wave_a_regression.md |
| 28-36 | Spec suite + security design review + remediation | done (0 Critical; 21 APPLIED / 2 DEFERRED); revised by RV-SPEC (D19/D20) | masterplan/01, 03-10; gateway_check/06 |
| 37 | Implementation plan (44 W-rows) | done; revised by RV-SPEC | masterplan/02_plan.md |
| 38, 39 | M1 spike gate (PASS 25/25, CPU clause only documented), M0 spec gate (PASS) | done | gateway_check/04, 05 |
| 40 | Rev 2.0 refinement | done; superseded by this rev 2.1 (row RV-BP) | identification/02_structured.md |

### 5.6 Register closure map

Coverage inherited from plan §H.5 (94/94). W-row -> step translation: M2-W1 -> 44 + 53; M2-W2 -> 45; M2-W3 -> 46; M2-W4 -> 49; M2-W5 -> 54; M2-W6 -> 47; M2-W7 -> 48; M2-W8 -> 50; M2-W9 -> 51; M2-W10 -> 52; M3-W1..W6 -> 57-62 (H-4/H-10 proofs of M3-W2/M3-W4 front-loaded in 111); M4-W1..W4 -> 65-68; M5-W1..W3 -> 71-73; M6-W1..W4 -> 76-79; M7-W1..W6 -> 82-87; M8-W1..W3 -> 90-92; M9-W1..W4 -> 95-101; G-13/14 -> 102-104; class-C rows -> section 9 (activation row 105). **Rows 106-119 have no register row**: 106-111 trace to audit findings (D17-D19), 112-119 to R-8 (D20; `01_specs.md` R-8 names proposed owners NM-06, NM-09 pattern, CS-21, WB-07, MB-09, E-30/E-31).

| Family | Count | Closed by rev-2.1 rows | Result |
|---|---|---|---|
| SH | 25 | 45, 47, 48, 49, 51, 53, 71, 72, 76-79, 82-87, 90-92 | 25/25 |
| CS | 25 | 44-54, 57-61, 65, 66, 71, 76, 78, 82, 83, 85, 90 | 25/25 |
| WB | 11 | 50 (WB-09), 67, 72, 87, 90, 92 | 11/11 |
| MB | 13 | 68, 73, 87, 90, 92 | 13/13 |
| DOC | 6 | 96 (DOC-01/02/04/05/06), 76 (DOC-05); DOC-03 closed at M0 (row 30) | 6/6 |
| NM | 14 | 65 (NM-01), 57-60 + 111 (NM-02/03/04/14), 82-84 (NM-05/07/08), 76-79 (NM-06), 52+66 (NM-09), 71 (NM-10), 90 (NM-11), 91 (NM-12), 86 (NM-14 kill cells); NM-13 -> class C | 14/14 |

---

## Structured Task Breakdown

> **PRIMARY OUTPUT — Controller-Executable Table.** The master controller reads each row as one delegation unit. If any narrative text conflicts with this table, the table governs.
>
> **Rev-2.1 row conventions:**
> - **Description prefixes.** `[Mx|B]` milestone + class; `[R-8|Mx]` rows of the new requirement (all conditional on Q-STT-CFG); `[cond]` conditional on a named gate answer; `[done]` executed earlier, not delegated; `[close-out]` architect pass. Each implementation row names its plan W-row (or audit finding / D20), the spec sections it implements and what it closes. Check IDs from `masterplan/10_test_strategy.md` are cited, never re-specified.
> - **Step numbers are stable identifiers (CF-9).** A dependency may name a higher number; the execution order is the Depends On column; section 10 lists the topological levels.
> - **Dependency tokens.** `R1` = rev-1 rows 1-39 executed with their artifacts present. `RV` = revision round RV-SPEC + RV-CODE complete and gated by the controller (D19/D20). Gate tokens: `Q-D7 = a or c`, `Q-STT-ROUTE = a or b`, `Q-INST-1 = approve`, trigger tokens for row 105.
> - **Output paths.** Relative to `/Users/gsp-budi/Documents/DEMS/docs/2026-10-07_dems_real_capture_sealing/`. `implementation/29`, `46`, `49` stay RESERVED for class-C activation. New paths: `implementation/51-59`, `gateway_check/25-26`, `initialization/04`, `research/09` (the long-missing row-11 record, now for `cpu-local`), `research/13`. All unique (self-check).
> - **Standing invariants (every row).** No media in git (media only under `.data/` or `.cache/`); loopback-only listeners; RTSP ingest bound `127.0.0.1` (SEC35-23); fake clocks only; `--maxWorkers=2` for all jest/vitest workspaces; 2 + 1 depth for device/browser/spike/DB-gate checks (2 in the producing row, +1 at the gate) and 1 per workspace per checkpoint for suites; no biometric steps (D231); no agent sets or types an emulator PIN; no git push; no sudo; **no Homebrew write unless a gate answer explicitly allows it (Q-INST-1 = approve, Q-STT-ROUTE = b)**; never restart or upgrade oMLX (D7), serialise STT/TTS calls, **back up `~/.omlx/logs/omlx-serve.log` before any `start.sh` and copy quoted log lines into the task folder at use time (AU2-10)**; the oMLX API key is never printed, staged or stored in the DB; check `uptime` before CPU-heavy rows (107-110, 77, 81) and do not run them beside jest suites; single-writer resources per section 10.
> - **Flags.** Rows touched by a gate question state it in Description or Verification. The whole gate is answered in one batch before any row runs; a later change of an answer reroutes per plan §F without re-planning.

| Step | Task Description | Agent_to_Invoke | Expected Output | Depends On | Verification | Phase |
|------|------------------|-----------------|-----------------|------------|--------------|-------|
| 41 | [M0\|pickup P-4] Renumber the gate-artifact names in `masterplan/10_test_strategy.md` from `06_m2_gate`..`13_m9_gate` to `07_m2_gate`..`14_m9_gate` (stale sites at :56, :120, :262 per AU3-07). The count lines (89 / 55 / 13 / 62 / 40) were already applied in W12 (D15(c)) and are not touched; if RV-SPEC already renumbered, the row records grep evidence and edits nothing | test-expert | refreshed masterplan/10_test_strategy.md (Tier 3) | R1, RV | grep: 0 hits for `06_m2_gate` and `13_m9_gate`; `07_m2_gate`..`14_m9_gate` present; diff limited to naming lines | masterplan |
| 42 | [done W12] GAP-02 mic-switch path made singular at `masterplan/05_capture_architecture_spec.md:499`. ALREADY APPLIED in W12 (D15(c); confirmed by AU3-07). Kept for the audit trail; the controller does not delegate this row | data-analyst | masterplan/05_capture_architecture_spec.md — already satisfied, not rewritten by rev 2.1 (Tier 3) | R1 | Status done: :499 reads the singular path (AU3-07 evidence); no row depends on 42 | masterplan |
| 43 | [M0\|pickup GAP-05] Add to `masterplan/01_specs.md` constraint C-N4 the clause "RTSP ingest binds 127.0.0.1 only" citing SEC35-23 (cap §A.4 stays the normative home); if RV-SPEC already added it, record grep evidence and edit nothing | data-analyst | refreshed masterplan/01_specs.md (Tier 3) | R1, RV | C-N4 contains the loopback-ingest clause; constraint count otherwise unchanged | masterplan |
| 44 | [M2\|B] First M2 row (M2-W1 part 1, E-24/RK-10/DP-7): lane infrastructure + per-lane pairing on the current committed schema — `db:create` `dems_lane_1..3`, `db:migrate` (0001-0003) under `/usr/bin/lockf -k .locks/db-migrate.lock`, `db:seed` v1 per lane, lane Cores 4421-4423 + Vite 5176-5178, per-lane `adb reverse` + pairing redeem through the existing flow (no PIN typed); closes CS-17 (procedure), E-19, E-24, RK-10; dbc-3 §F steps 1-3/5-7; test §E | coder-execution | implementation/09_m2_lane_recreation.md (Tier 3) | 106 | M2-LANE-1 infrastructure clause: 3 lane DBs + `dems_demo` reachable, each lane Core+Vite answers, 3 devices paired one-per-lane, recording blocked until redeem returns (D258); SMART WMS ports untouched; 2 runs (gate adds +1 at row 56) | implementation |
| 45 | [M2\|B] Typed schema v2 (M2-W2): `src/db/schema/*` 9 new tables, `value-sets.ts` 14 FAULT_KIND values, CHECK swaps (3 FAULT_KIND sites :281/:382/:488, hashes :335, signature :336, new `signature_value`, sources :340, tracks :354, `active_session` json :260, forbidden-key :199/:220 17 -> 25); closes CS-16, SH-01, SH-02, E-01, W1-C10, SEC35-22; dbc-3 §B, §C.1-§C.6 | database-specialist | implementation/10_m2_schema_check.md (Tier 3) | 106 | M2-MT-3, M2-MT-8, M2-DB-CHK-1 pass; 3/3 CHECK sites swapped with file:line evidence; no migration applied to any live DB by this row | implementation |
| 46 | [M2\|B] Migrations 0004/0005 (M2-W3): generated `0004_capture.sql` (9 CREATE + ALTERs + indexes) + hand-written `0005_capture_privileges.sql` (privilege matrix, credential SELECT revoke, `dems_capture_credential_reveal` SECURITY DEFINER fn, `schema_meta=(2,'dbc-3')`), journal/snapshot; the SEC35-02 applied alternative (write-only API + single-module static rule + audited reveal; Q-SEC-3 default); plus the B16 code-side message fix (dbc-3 §H; moved into this Task per AU3-14); closes CS-17, CS-24, CS-16, RK-12, B16 (code side); dbc-3 §A, §D, §B.1-§B.12 | database-specialist | implementation/11_m2_migrations.md (Tier 3) | 45 | M2-DB-1, M2-DB-2, M2-MT-4 pass on a throw-away copy of `dems_demo` and fresh throw-away lanes; live `dems_demo` never migrated by a test; B16 message fix present with file:line | implementation |
| 47 | [M2\|B] Shared domain/contract foundation (M2-W6): enums SH-01, entities SH-02, vocabulary SH-03, RBAC `auth.ts` + `CAPTURE_CONFIG`/`TRANSCRIPT_REVISE` SH-04, sim types SH-05, replicated slices 28 -> 30 with own capture kinds SH-16 (E-04), realtime messages + `meters.audio` re-key SH-17/SH-25, i18n SH-23; closes CS-15; C3 §0, §2.1, §6; dbc-3 §B; specs §D | coder-execution | implementation/14_m2_shared_contract.md (Tier 3) | 45 | M2-RG-SHARED exit 0 at floors; M2-API-3 slice-count clause; 0 uses of `AdminResource.DEVICE[S]` for capture (E-04) | implementation |
| 48 | [M2\|B] Core API registry + audit + errors + constants (M2-W7): ops 76-89 + 24 modified + 9 error codes (31 -> 40) + 9 audit types (53 -> 62) + exact `audit-details.ts` key lists + credential write-only path (op 89) + `SESSION_HOLDER` condition (deferred SEC35-18) + `@dems/shared/api/capture.ts` constants incl. the SP-4 pair `CAPTURE_GOP_FRAMES=50` / `CAPTURE_FRAGMENT_TARGET_MS=2000` (Q-SP-4 default) and the observed-GOP threshold of the Q-GOP outcome (no new error/audit code under the default); closes SH-12, SH-13, SH-14, SH-15, SH-18, SH-19, SH-20, SH-21, CS-12, CS-14, CS-25, B4 (E-30), SEC35-01/16/17/18/19/21/22; C3 §1-§5, §7, §9 | coder-execution | implementation/15_m2_api_contract.md (Tier 3) | 46, 47 | M2-API-1 drift-free at 89 ops, M2-API-3, M2-AUD-1 (9 new types 53 -> 62), M2-AUD-2, M2-CRD-1 pass; every new audit type has an exact detail-key list with 0 secret keys | implementation |
| 49 | [M2\|B] Mapping + seed + fixture v2 (M2-W4): `db/mapping/*` v2 shapes; v2 seed (14 permissions / 22 grants / 1 config / 5 devices / 0 credentials); bulk fixture per dbc-3 §G minimums; demo evidence regenerated v2 (SH-24, host FFmpeg + TTS fixture); closes CS-18, CS-19, CS-20, SH-09, SH-11, SH-24, E-20 (OD-02 L2); dbc-3 §B, §E.3, §G; C3 §2.4 | coder-execution | implementation/12_m2_seed_fixture.md (Tier 3) | 46 | M2-MT-2, M2-MT-7 pass; seed counts equal the listed values; regenerated media only in git-ignored `.data/`; row counts stated in the artifact | implementation |
| 50 | [M2\|B] OpenAPI versions + pinned counts (M2-W8): `all` 0.2.1 -> 0.3.0, `offline` 0.1.0 -> 0.2.0, regenerate `openapi.json`, re-pin 89 ops / 34 GET / 55 POST / 30 slices / offline 23, section-C pin sweep; sole lockfile writer under `/usr/bin/lockf -k .locks/npm.lock` during `openapi:gen`; R-8 ops 90-92 are NOT pinned here (row 113 re-pins in M6, CF-11); closes SH-19, WB-09, CS-25, E-06, W1-C9; C3 §8; test §C | coder-execution | implementation/16_m2_openapi_pins.md (Tier 3) | 48 | M2-API-1, M2-API-2, M2-PIN-1 pass; stale-pin grep 0 hits at 88/54/22; category-B pin files updated per the test §C list | implementation |
| 51 | [M2\|B] Simulated v2 parity (M2-W9): sim evidence v2 SH-07, sim devices/audio/faults/scenarios SH-08, dataset SH-09, constants SH-10, demo-alignment/verify SH-11, live bindings + `live-sim.ts:902-905` minimal edit SH-21/SH-25 (OD-26 default b); retire the SC8 "simulator untouched" rule (OD-23); closes SH-05, SH-06, E-02, E-03; C3 §6; register §F | coder-execution | implementation/17_m2_simulated_parity.md (Tier 3) | 47 | M2-SIM-1, M2-SIM-2 pass; Simulated behaviour parity vs `c2c983b` recorded; SC8 text replaced by "simulator changes only through blueprint rows" | implementation |
| 52 | [M2\|B] Capture-config module + real-mode fencing (M2-W10): `modules/capture-config/*` store/slices boot NM-09 + `modules/devices` status feed; demo fencing ops 71-75 (`403 DEMO_DISABLED`, `409 RESET_BLOCKED_REAL_EVIDENCE`); `rbac.matrix` boot equality; closes NM-09, CS-23, CS-06 (read), SH-04, E-04 (OD-10, OD-18); C3 §2.4, §3, §6; specs §E.6 | coder-execution | implementation/18_m2_config_demo.md (Tier 3) | 48 | M2-RG-CSU, M2-MT-7, M2-API-3 pass; matrix boot equal to the seeded grants; hardware-fault injection refused in real mode | implementation |
| 53 | [M2\|B] Lane re-creation part 2 (M2-W1 v2 completion): apply migrations 0004/0005 (+ 0006 `stt_config` when Q-STT-CFG is confirmed) + v2 seed (incl. the STT default row) + per-lane bulk fixture (CS-20 at dbc-3 §F step 4) to the three lanes, migrate + v2 reseed `dems_demo` (kept tables intact), assert full M2-LANE-1 — four DBs at schema 2 / `dbc-3`; closes CS-17 (completion), NM-14 (lane clause), CS-02; dbc-3 §F steps 4, 8; test §E | coder-execution | implementation/50_m2_lane_v2_completion.md (Tier 3) | 44, 46, 49, 112, 114 | M2-LANE-1 full assertion passes (2 runs here, +1 at row 56); M2-RG-CSD, M2-RG-PG pass; per-lane pairing still holds | implementation |
| 54 | [M2\|B] Reset keep-set + guard (M2-W5): `kept-tables.ts` 11 kept tables (upsert mode for `capture_config`/`capture_devices`/`capture_device_credentials`); `RESET_BLOCKED_REAL_EVIDENCE` DB+disk guard; op 75 refusal; closes CS-21 (OD-19, RK-16, SEC35-22); dbc-3 §E.1, §E.2 | coder-execution | implementation/13_m2_reset_guard.md (Tier 3) | 49 | M2-MT-5, M2-MT-6 pass; reset with a real sealed package present refuses and is audited; kept tables survive reset | implementation |
| 55 | [M2\|checkpoint] Code review of the M2 diffs (schema, migrations, shared, API, seed, pins, sim parity, config, lanes, reset, STT table, STT seed/kept) — blueprint §6 per-milestone review rule; E-04/E-30/E-31 and forward-only checks included | senior-code-reviewer | gateway_check/15_m2_code_review.md (Tier 2) | 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 112, 114 | Verdict per area (12 areas); every finding routed to its producing row; 0 Blocker/Major open before the M2 gate | gateway_check |
| 56 | [M2\|gate] M2 milestone gate: independent +1 verification of all M2 checks — M2-RG-SHARED/CSU/CSD/WEB/MOB/MOCK/PG, M2-QA-1, M2-LANE-1 (+1), M2-DB-1, M2-DB-2, M2-MT-2..8, M2-API-1..3, M2-PIN-1, M2-SIM-1/2, M2-AUD-1/2, M2-CRD-1, M2-DB-CHK-1, M2-STTCFG-DB (if Q-STT-CFG confirmed) (plan §D) | verifier | gateway_check/07_m2_gate.md (Tier 2) | 55 | Each check PASS/FAIL with command output; 7 workspace suites exit 0 at the re-pinned floors; failures routed to producing rows; verdict recorded | gateway_check |
| 57 | [M3\|B] Supervisor + IPC + seam + P25 edits 1-6/11-12 (M3-W1): `packages/capture-protocol`; `src/capture/*` spawn/heartbeat/back-off/correlation-IDs/back-pressure (G-1 restart-ingest-per-session rule from D10(b)); `capture` seam + `app.ts` module registration; `index.ts` supervisor start/stop; closes NM-03, CS-01, CS-03 (OD-14 waiver); SH-18 and CS-04 are NOT closed by this row (D65, D67): the telemetry and warning INTERNAL actions and the forwarder go to row 58, the sealing-progress and complete-seal actions to row 82, the hosted pair `switchAudioSource` / `setCaptureConfig` to row 66; M3-KC-1 is met for its process half only (the file half is row 58's); the gate sentence 'a killed worker respawns under the supervisor' holds before the first durable fragment and between sessions only (D67, option C per OD-08); cap §A.3, §B.1, §B.2, §I (edits 1-6, 11-12); specs §E.1 | coder-execution | implementation/19_m3_supervisor_ipc.md (Tier 3) | 56, 52 | M3-KC-3, M3-KC-1, M3-SR-1 pass; only the waived P25 edits present, each reviewed; a killed worker respawns under the supervisor | implementation |
| 58 | [M3\|B] Worker + engine seam + config keys, P25 edits 7-10 (M3-W2), built on row 111's skeleton in the Q-WORKER form and started only after row 111's H-4/H-10 proofs PASS: 2 RTSP ingests (stream copy), 2 mic captures, selector -> one AAC encoder -> both files, meters, PCM tap; avfilter commands applied on the filtering thread only (AU2-07); `config.ts` capture keys; closes NM-02, NM-04, CS-02, W1-C1 (D10(b)); cap §A.2, §A.4, §B.2, §F, §I (edits 7-10). Inherited from the row-57 and row-111 pair reviews (D66, D67; cap §A.2 W-1..W-6, §B.2, §C.2, §C.4, §F): (1) lossless record frames with a per-session sequence number for first durable fragment, fragment checkpoint and seal completion - the file is the truth, the frame is a hint; (2) restart rule option C: no respawn into an existing evidence file, 'START acknowledged' counts as 'may be durable' until the durable record exists, F-7 pin renamed and its sibling test added, the init-segment-only file case decided; (3) supervisor N-1 (re-entrant `stop()` from a listener), N-2 (queue cleared at session end), N-3 (warning subjects restricted to device IDs and mic roles); (4) SH-18 / CS-04 part: `applyCaptureTelemetry`, `raiseCaptureWarning` and the forwarder; (5) the C worker speaks `packages/capture-protocol` (nine-point gap list); (6) no datagram socket - RTP over UDP must not open `*:5000` / `*:5001`, and M3-RTSP-BIND-1 covers UDP with a UDP-requesting client as negative control; (7) muxer option `flush_packets=1`, and audio keeps fragmenting after a camera stops; (8) `fatal()` exits non-zero; (9) fake mics fed from a separate process in the AV checks; (10) video anchored on the per-packet PRFT wall clock with a slew limit, arrival-vs-camera trend as telemetry only; (11) `delay_moov` evaluated against the S1 file-shape, running-hash and tail-validation checks, fallback = pinned flags + documented held first frame + true first video pts in the manifest; `use_editlist=1`, `negative_cts_offsets`, `avoid_negative_ts=disabled` forbidden with `empty_moov` by a static rule, one kept as a negative control; (12) file time 0 = T0 minus the AAC priming (21.333 ms) in every file-time to host-time mapping; (13) the file half of M3-KC-1. Starts after row 113 lands. | coder-execution | implementation/20_m3_worker_engine.md (Tier 3) | 57, 111, 113 | M3-WI-1, M3-KC-1 incl. its file half (a fresh playable file, within the D67 option C scope), M3-BC-1, M3-SR-2 pass; two fake RTSP + two fake mics produce two playable files from one encoder whose sizes grow on disk during the session, sampled before close (row-111 packet-equality assertion kept as a regression test); M3-REC-1 passes (lossless record path, run once; test §A.3): a sequence gap is a `PROTOCOL_VIOLATION` and 0 records are dropped under a flooded lossy queue; the worker process owns 0 UDP sockets and every socket is on 127.0.0.1 (all sockets of the worker PID listed, UDP-requesting client as negative control); a fatal error exits non-zero | implementation |
| 59 | [M3\|B] fMP4 writer + running hash chain + checkpoints + truncation (M3-W3): append-only fMP4, stored-bytes + plaintext chains, per-fragment checkpoint records, drop-fragment rule, fsync policy, `recording_fragments` INSERT path; RPO stated = one fragment = one camera GOP on stream copy; RECOVERY tail validation by box walk (declared sizes vs bytes present; ffprobe is not a detector — AU2-08); observed keyframe interval measured from the first fragments with the Q-GOP outcome (default: warning on the existing capture-warning channel); closes NM-04, SH-07 (OD-03, OD-21, OD-25); cap §A.5, §C.1-§C.6; ev §B.6; dbc-3 §B.6 | coder-execution | implementation/21_m3_fmp4_writer.md (Tier 3) | 58, 60 | M3-WI-1, M3-KC-2 (tail validation flags a cut inside an `mdat` that ffprobe accepts), M3-KC-4 (long-GOP loss bounded and reported), M3-SR-3, M3-MG-1 pass, 2 runs each; chain equality holds (S1 pattern) | implementation |
| 60 | [M3\|B] Fixtures + AV analyser (M3-W4): fake RTSP sources, fake mics with reference tones (continuity check, AU2-05), fake ONVIF stub, flash+beep generator + **sample-exact** offset analyser (AU2-03), injected 0 / +80 / -80 ms truths (AU2-04), separate-clock fake camera in its own process (H-10, AU2-06), long-GOP fake camera `-g 250` (AU2-08); ALL fixture listeners bind `127.0.0.1:8554-8564` (SEC35-23); closes NM-14; cap §A.8, §F, §J H-10; S1 §3; S4 evidence | coder-execution | implementation/22_m3_fixtures.md (Tier 3) | 58 | M3-AV-1 (measured vs truth within the 2 ms regression bound for 0/+80/-80 ms, and within the ±40 ms product bound), M3-AV-2, M3-RTSP-BIND-1 pass, 2 runs each; listener snapshot shows `127.0.0.1` only; SMART WMS ports never contacted | implementation |
| 61 | [M3\|B] Static rules + boot checks + storage (M3-W5): G-R1..G-R8 guards for `capture/` and `capture-worker/` (incl. the worker's C sources if Q-WORKER = a), pinned `node:fs`/`child_process` allowlist (SEC35-25), CS-22 boot checks, CS-09 storage real volumes; closes CS-05, CS-22, CS-09, E-05; cap §G, §A.2; specs R-2 AC-3 | coder-execution | implementation/23_m3_static_boot.md (Tier 3) | 57, 58, 59 | M3-SR-1, M3-SR-2, M3-BC-1, M3-MG-1 pass; guard family = 21 baseline + new folder rules; boot refuses missing keys | implementation |
| 62 | [M3\|B] B11 instrumentation (M3-W6): RF2-2 exact late-stop wait point on the tablet; CS-10 system module services (worker, transcriber) surfaced; closes CS-10, B11, RK-5; ux P-12; specs §E.6 | coder-execution | implementation/24_m3_b11_instrumentation.md (Tier 3) | 61 | M3-RG-MOB pass instrumented; late-stop wait point logged with citable timestamps (prepares M5-SW-T) | implementation |
| 63 | [M3\|checkpoint] Code review of the M3 diffs (worker proofs, supervisor, worker, writer, fixtures, static rules, instrumentation); P25 waiver edits re-checked against OD-14; the worker-form decision record checked against the ready-made-frameworks rule | senior-code-reviewer | gateway_check/16_m3_code_review.md (Tier 2) | 57, 58, 59, 60, 61, 62, 111 | Verdict per area (7 areas); P25 edits 12/12 within the waiver; findings routed to producing rows; 0 Blocker/Major open | gateway_check |
| 64 | [M3\|gate] M3 milestone gate: independent +1 verification — M3-RG-*, M3-QA-1, M3-WI-1, M3-AV-1, M3-AV-2, M3-KC-1..4, M3-SR-1..3, M3-MG-1, M3-BC-1, M3-RTSP-BIND-1, M3-REC-1, plus the row-111 H-4 proof (plan §D); this gate also owns the T-10 gate note of test §A.3 (pair-57 F-9; a log line, run once, not a named check) | verifier | gateway_check/08_m3_gate.md (Tier 2) | 63 | Each check PASS with output; AV within the 2 ms regression bound for 0/+80/-80 ms and within ±40 ms product bound; H-4 packet equality re-run; tail validation and long-GOP loss proven; M3-REC-1 PASS; after the lane restart the log shows `capture supervisor booted` after the last boot step and `capture supervisor stopped` on SIGTERM (quoted once); 0 media in git | gateway_check |
| 65 | [M4\|B] Adapter layer (M4-W1): `CameraAdapter`/`PoeController`/`AudioInputAdapter` interfaces + fakes (2 fake cameras per OD-05), selector registry, contract-derived `DEVICE_COMMAND_OF_OPERATION` (E-12), credential-URL handling (SEC35-04); closes NM-01, CS-06, CS-11 (OD-05/06/07/22); cap §A.1, §A.6, §A.7; specs §E.1 | coder-execution | implementation/25_m4_adapters.md (Tier 3) | 64, 58 | M4-FAKE-1, M4-SEL-W pass; real adapters never load in tests; credential values never appear in logs or audit | implementation |
| 66 | [M4\|B] Selector module + API + slices + config lock (M4-W2): `modules/capture-config/*` ops 76-80 live paths, publish `captureConfig`/`captureDevices`, `409 CAPTURE_CONFIG_LOCKED` while a session is open, devices status feed; lands the hosted pair `switchAudioSource` / `setCaptureConfig` of SH-18 left open by row 57 (D65(b); cap §B.1 "Closure status"); closes NM-09, CS-06, SH-16, E-04 (OD-10, OD-12); C3 §2.4, §6; ux §2; specs R-1 | coder-execution | implementation/26_m4_selector.md (Tier 3) | 52, 65 | M4-SEL-W, M4-SEL-T, M4-SEL-P, M4-LOCK-1 pass; edit by SUPERVISOR/TECHNICIAN audited, INVESTIGATOR refused; config locked while a session is open | implementation |
| 67 | [M4\|B] Web selector + query factories (M4-W3): Devices page/drawer WB-05, System entry WB-07, Dashboard tiles WB-02, composed meter/stepper/timeline WB-10, storage WB-06, `lib/core-queries.ts` factories WB-11; closes E-08, E-17 (OD-12); ux flow 1; specs R-1 | coder-execution | implementation/27_m4_web_selector.md (Tier 3) | 66 | M4-SEL-W, M4-PC-1, M4-RG-WEB pass; "Checking your permissions..." state on gated controls; core-web jest `--maxWorkers=2` | implementation |
| 68 | [M4\|B] Tablet/phone selector (M4-W4): Devices MB-08, Settings capture section MB-09, Session New precheck MB-02, Network/Time offset rows MB-10, runtime audio values MB-11, audit labels MB-12, `SelectionGlow` rows (E-15/E-16); closes OD-12 client scope; ux flow 1; specs R-1 | coder-execution | implementation/28_m4_mobile_selector.md (Tier 3) | 66 | M4-SEL-T, M4-SEL-P, M4-PC-1, M4-RG-MOB pass on the lanes created by rows 44/53; mobile jest `--maxWorkers=2`; no PIN typed by an agent | implementation |
| 69 | [M4\|checkpoint] Code review of the M4 diffs (adapters, selector module, web, mobile) | senior-code-reviewer | gateway_check/17_m4_code_review.md (Tier 2) | 65, 66, 67, 68 | Verdict per area (4 areas); findings routed to producing rows; 0 Blocker/Major open | gateway_check |
| 70 | [M4\|gate] M4 milestone gate: independent +1 verification — M4-RG-*, M4-QA-1, M4-SEL-W/T/P, M4-LOCK-1, M4-FAKE-1, M4-PC-1 (plan §D); real-adapter items stay class C (section 9) | verifier | gateway_check/09_m4_gate.md (Tier 2) | 69 | Selector edit + audit row proven from web (agent-browser) and tablet/phone emulators on recreated lanes, 2+1 each; class-C clauses asserted on fakes only and marked as such | gateway_check |
| 71 | [M5\|B] Switch mechanics + warnings (M5-W1): libavfilter `astreamselect`, `avfilter_graph_send_command` applied on the filtering thread only, realised at the next input-chunk boundary (bound = one worker input chunk + IPC latency, at most 21.333 ms with 1024-sample frames — AU2-07), switch edge per the Q-CLICK answer (default: hard cut, documented), `session_audio_intervals` records (media-pts), `AUDIO_SOURCE_SWITCHED` audit with sending device ID, `MIC_SILENT` warning raiser (never auto-switch), CS-07 session route; closes NM-10, SH-03, SH-08, SH-13, SH-17, CS-07, E-30 (OD-09, OD-11); cap §E, §E.1, §F; C3 §2.4, §5.2; specs R-3 | coder-execution | implementation/30_m5_mic_switch.md (Tier 3) | 70, 59 | M5-GAP-1 (must FAIL the 1,000-samples-removed negative vector, AU2-05), M5-WARN-1, M3-AV-1 pass; gaplessness proven by decoded sample count = duration x 48,000 (± priming) plus per-input continuity against the reference tones, never by the packet-grid metric; silence warns, never switches | implementation |
| 72 | [M5\|B] Web mic UI (M5-W2): Session Monitor active/standby + toggle WB-01, Dashboard mic tiles WB-02, composed meter/timeline WB-10, "Checking your permissions..." state; closes SH-22, E-16; ux flow 2; specs R-3 | coder-execution | implementation/31_m5_web_mic.md (Tier 3) | 71 | M5-SW-W (sample-count + continuity metric), M5-WARN-1, M4-PC-1 pass 2 runs; toggle visible only to the session holder / SUPERVISOR (OD-09) | implementation |
| 73 | [M5\|B] Tablet/phone mic UI + B15 (M5-W3): Session Live mic cards MB-03, Home mic tiles "No signal" fix MB-01 (B15), test beds MB-13, B11 result applied (row 62 wait point); closes E-14, E-16; ux flow 2; specs R-3 | coder-execution | implementation/32_m5_mobile_mic.md (Tier 3) | 71, 62 | M5-SW-T, M5-SW-P, M5-WARN-1 pass 2 runs on lanes; phone-sent commands carry the device ID in audit (E-30) | implementation |
| 74 | [M5\|checkpoint] Code review of the M5 diffs (switch mechanics, web UI, mobile UI) | senior-code-reviewer | gateway_check/18_m5_code_review.md (Tier 2) | 71, 72, 73 | Verdict per area (3 areas); findings routed; 0 Blocker/Major open | gateway_check |
| 75 | [M5\|gate] M5 milestone gate: independent +1 verification — M5-RG-*, M5-QA-1, M5-SW-W/T/P, M5-GAP-1, M5-WARN-1 (plan §D) | verifier | gateway_check/10_m5_gate.md (Tier 2) | 74 | Switch from web, tablet, phone during recording 2+1 each; sample-count + continuity PASS; latency within the per-chunk bound; intervals + `AUDIO_SOURCE_SWITCHED` with sending device ID audited; warn-never-switch proven | gateway_check |
| 76 | [M6\|B] Transcriber app + adapter + fixtures (M6-W1): `apps/transcriber/`; `TranscriberAdapter` with `omlx-server` (this Mac, development and functional checks — D7) and `cpu-local` (whisper.cpp built GPU-off by rows 107-109, invoked per tx §B.3 with `-ng`; the product path, D222) — BOTH implemented and exercised in this row (nothing is coded for either backend today: 0 repo hits, AU-2 §4.4); `TtsFixtureProvider`; single key-loader (SEC35-14); static rule; closes NM-06, SH-09, CS-22, DOC-05, W1-C3/C5/C12; tx §B.1-§B.6; specs §E.3 (OD-20, OD-24; Q-D7) | coder-execution | implementation/33_m6_transcriber_adapter.md (Tier 3) | 57, 110 (110 drops out if Q-D7 = b or Q-STT-ROUTE = c) | M6-AD-1, M6-CP-1 pass; both backends return the identical document shape on the fixture (`cpu-local` against the `.cache/stt/` build); oMLX never restarted/upgraded, calls serialised, log backed up first; key never printed. If Q-D7 = b: `cpu-local` contract-tested only and the CPU clause recorded as deferred to C-7; if Q-D7 = c: no `omlx-server` backend | implementation |
| 77 | [M6\|B] VAD + STT + checkpoints (M6-W2): Silero VAD chunking, STT per chunk, CPU-priority rule (capture above STT), chunk checkpoints/resume, `transcript_chunks` writes; VAD + diarization model downloads per OD-20 (Q-INSTALL item 5); closes NM-06, SH-09, E-21, E-22, RK-1; tx §A.1-§A.3, §C, §D; dbc-3 §B.7 | coder-execution | implementation/34_m6_vad_stt.md (Tier 3) | 76, 58 | M6-TF-1 on both backends with the `cpu-local` command quoted (`-ng`), M6-KR-1, M6-CP-1 pass; M6-DF-1 run on `cpu-local` (2 runs, no other heavy row in flight; one functional check, no throughput figure, D230); chunk resume after a kill proven | implementation |
| 78 | [M6\|B] Diarization + assembly (M6-W3): sherpa-onnx + Silero 2-speaker labelling LABELLED/UNAVAILABLE; canonical `dems.transcript/1` document + hash; `transcripts`/`transcript_revisions`/`evidence_items.transcript_sha256` writes; closes NM-06, SH-09, SH-14, DOC-05 (D226, OD-15, OD-20); tx §A.4, §A.5; dbc-3 §B.8, §B.9; ev §B.7 | coder-execution | implementation/35_m6_diarization.md (Tier 3) | 77 | M6-TF-1, M6-LB-1 pass; labels present when possible on the two-voice fixture, UNAVAILABLE marked otherwise | implementation |
| 79 | [M6\|B] Transcript <-> sealing interaction (M6-W4): `FINALIZE_TRANSCRIPT` contract + handler consumes the committed transcript + hash; D-EV-1 (`state='PARTIAL'`, `failedChunks`, no fabricated text); transcript summary in the evidence slice (bound by row 83); closes SH-14, NM-07 (interaction), D-EV-1 (OD-08, OD-15); ev §E.1, §E.5; tx §D.3, §A.5; C3 §2.4 | coder-execution | implementation/36_m6_transcript_seal.md (Tier 3) | 78 | M6-TF-1, M6-KR-1 pass; hard-failure path seals PARTIAL without fabricated text | implementation |
| 80 | [M6\|checkpoint] Code review of the M6 diffs (transcriber app + both backends, VAD/STT, diarization, seal interaction, STT config ops, STT runtime, seal-side states, web STT menu, mobile STT status) | senior-code-reviewer | gateway_check/19_m6_code_review.md (Tier 2) | 76, 77, 78, 79, 113, 115, 116, 117, 118 | Verdict per area (9 areas); credential never returned/logged checked by grep; findings routed; 0 Blocker/Major open | gateway_check |
| 81 | [M6\|gate] M6 milestone gate: independent +1 verification — M6-RG-*, M6-QA-1, M6-TF-1 on BOTH backends (`omlx-server` dev and `cpu-local`), M6-DF-1 on `cpu-local`, M6-KR-1, M6-LB-1, M6-AD-1, M6-CP-1, and (if Q-STT-CFG confirmed) M6-STTCFG-API/NEXT/OFF/UNREACH/WEB/TAB/PHONE (plan §D; test §A.6a) | verifier | gateway_check/11_m6_gate.md (Tier 2) | 80 | Functional check +1 on both backends; the `cpu-local` command quoted with `-ng` plus the Metal-off build evidence (AU3-03); M6-DF-1 +1 on `cpu-local`; R-8 checks +1 where 2+1; chunk resume after kill proven | gateway_check |
| 82 | [M7\|B] Sealing pipeline v2 (M7-W1): `sealing_jobs` per-step checkpoints + resume rules, RECOVERY resume, OD-08 interrupted durable-prefix path, RECOVERY runs the box-walk tail validation of row 59 and flags a truncated tail explicitly in the session record (never trusting ffprobe, AU2-08), `session-machine` v2 seal, CS-04 engine host INTERNAL actions — here the `applySealingProgress` / `completeSeal` pair of SH-18 / CS-04 left open by row 57 (D65(b), D67; `completeSeal` is triggered by the lossless seal-completion record, never read from `PROGRESS`), reset-fence check at R-0; closes NM-07, SH-06, CS-04, CS-21, E-13 (OD-08); ev §E.1-§E.5; dbc-3 §B.4; C3 §2.4 | coder-execution | implementation/37_m7_sealing_pipeline.md (Tier 3) | 81, 59 | M7-REF-1, M7-KM-P1..P4-0, M7-FF-UNIT pass; a killed seal resumes from the last checkpoint and reaches the same final hash; a cut-inside-`mdat` tail is flagged, not sealed as whole | implementation |
| 83 | [M7\|B] Package + manifest v2 + Signer (M7-W2): `packages/shared/src/evidence-package/` (layout, 120-field manifest, `fragments.json` serialization); `core-server/src/capture/signer/` software Ed25519 (`CORE-KEY-EVSIGN-01`), key at rest 0600 / OS keychain, attestation runbook, CS-13 real key record; closes NM-08, SH-07, SH-11, CS-13, SEC35-06/07/11/13 (OD-02/03/04/16); ev §A, §B, §C, §G.4; dbc-3 §C.4, §C.5 | coder-execution | implementation/38_m7_package_signer.md (Tier 3) | 82 | M7-VV-SRV, M7-TP-1, M7-KM-C-S1..S6 pass; real (non-simulated) signatures; TPM stays class C (C-8) | implementation |
| 84 | [M7\|B] Per-fragment AES-256-GCM + key store (M7-W3): GCM outside the muxer over stored ranges, AAD `(trackId, seq, byteOffset, keyId)`, session key in the Core credential store, key-loss policy = no escrow (SEC35-09 — Q-SEC-2 default), Range interaction; closes NM-05, SH-07, SEC35-08/09/10 (OD-03); cap §D.1-§D.4; ev §A.3, §B.6. Also owns `provideCredentialSealer` and the matching opener for the STT `SECRET` credential of operation 91 (D68(c); SEC35-03; same Core credential store, no second store); until this row lands a `SECRET` write answers `503 NOT_READY` (`CREDENTIAL_STORE_NOT_READY`), row 115 treats a stored `ENCRYPTED` kind as unavailable and row 117 offers the reference form only | coder-execution | implementation/39_m7_encryption.md (Tier 3) | 59, 64, 81 | M7-TP-1, M7-VV-SRV pass; tampering one encrypted fragment fails exactly that fragment (H-2 tested); custody-policy note recorded for handover; a `SECRET` write answers 200 with `credentialKind: ENCRYPTED` on a booted server and the key-loader opens it (this is the 200 half of M6-STTCFG-API for a `SECRET` write; the M6 gate sees 503 by design) | implementation |
| 85 | [M7\|B] Verify v2 (M7-W4): op 41 rewrite; 14 checks V-01..V-14; per-fragment stored + plaintext hashes; chain continuity; `fragments.json` equality (V-02); per-revision certificate (V-11); one-fragment tamper V-08; CS-08 evidence reads; closes SH-07, NM-08, CS-08, SH-14, SEC35-11/20/21 (OD-02, OD-04); ev §D; C3 §3 (op 41) | coder-execution | implementation/40_m7_verify_v2.md (Tier 3) | 83, 84 | M7-VV-SRV, M7-TP-1 pass; all 14 checks enumerated with outcomes; V-08 fails exactly the tampered fragment | implementation |
| 86 | [M7\|B] Kill matrix (M7-W5): harness for P1-P4 x S1-S6 (24 cells) + M7-REF-1 + M7-KM-P*-0 as distinct checks, never a loop; S7/S8 fallback cells parked conditional on OD-21 (F-4); closes NM-07, NM-14, E-13 (OD-08, OD-21); ev §E; test §F | coder-execution | implementation/41_m7_kill_matrix.md (Tier 3) | 82, 83, 84, 85 | Every cell 2 runs (+1 at row 89); final hashes equal an uninterrupted run; 0 loop-form executions (test §F.3 respected) | implementation |
| 87 | [M7\|B] Clients + verify + tamper demo + B9 (M7-W6): web/mobile v2 verify (WB-04, WB-08, MB-04/05/06/12), progress forward-only from Core instants, in-place hand-offs, tamper demo EV-0005 re-scripted on one fragment, B9 FXR-DEV-2 Reanimated rest-values with MB-04, transcript-state labels in the verify views ("Transcript disabled by configuration", "Transcript partial — backend unreachable") when R-8 is confirmed; closes WB-01 (modal), E-13, E-15 (OD-02/08/15); ux flows 3, 4, 5, 6; ev §F; C3 §5.3 | coder-execution | implementation/42_m7_clients_verify.md (Tier 3) | 85, 119 | M7-VV-WEB, M7-VV-PHONE, M7-TP-1, M7-FF-WEB/TAB/PHONE pass 2 runs; no Reanimated lost-update warning at the Finalizing hand-over | implementation |
| 88 | [M7\|checkpoint] Code review of the M7 diffs (sealing pipeline, package/signer, encryption, verify, kill harness, clients, transcript-state manifest/verify) | senior-code-reviewer | gateway_check/20_m7_code_review.md (Tier 2) | 82, 83, 84, 85, 86, 87, 119 | Verdict per area (7 areas); findings routed; 0 Blocker/Major open | gateway_check |
| 89 | [M7\|gate] M7 milestone gate: independent +1 verification — M7-RG-*, M7-QA-1, M7-REF-1, M7-KM families, M7-VV-SRV/WEB/PHONE, M7-TP-1, M7-FF-UNIT/WEB/TAB/PHONE, and the verify clause of M6-STTCFG-OFF/UNREACH via row 119 (plan §D; CF-12) | verifier | gateway_check/12_m7_gate.md (Tier 2) | 88 | Kill matrix complete as distinct cells; v2 verify PASS on server, web, mobile; tamper demo exact; progress forward-only proven; DISABLED and unreachable-PARTIAL packages verify PASS with the state reported | gateway_check |
| 90 | [M8\|B] Media streaming (M8-W1): Range-served decrypted playback route, signed media session (SEC35-12 HMAC key/TTL/binding), `mts_` prefix in both log-blanking lists (SEC35-13), own static rule, `EVIDENCE_MEDIA_SERVED` audit, op 88; REAL-evidence case scope (SEC35-16 — Q-SEC-1 default: narrowed, with the audit event); closes NM-11, WB-04, MB-07, E-31; cap §D.4; C3 §2.4, §7; ux flow 5 | coder-execution | implementation/43_m8_media_stream.md (Tier 3) | 89, 84, 85 | M8-PB-W/T/P, M8-RNG-1, M8-BLK-1 pass; `M8-EV-SCOPE-1` asserted for the chosen scope; signed-URL prefix in both blanking lists | implementation |
| 91 | [M8\|B] Export + composite (M8-W2): op 42 background job + op 87 poll; decrypted copy + manifest + signature; export block (9 fields); composite on demand marked `derived` + hashed in the export manifest, its encoder chosen ONLY after the M8 licence check recorded in DOC-05 (OD-16; the installed FFmpeg is a GPL build — AU3-13); export audit + secret sweep; closes NM-12, SH-14, WB-04, MB-07, E-31, SEC35-09 (OD-16); ev §G.1-§G.4; C3 §3 (ops 42/87); ux flow 5 | coder-execution | implementation/44_m8_export_composite.md (Tier 3) | 83, 89 | Licence check record present before the encoder is wired (file:line); M8-EXP-1, M8-CMP-1, M8-XAU-1, M8-BLK-1 pass; export verifies at the destination; composite marked derived | implementation |
| 92 | [M8\|B] Playback UI + revisions (M8-W3): web Evidence page + player + audio-source band + transcript pane (WB-04), mobile evidence sheet (MB-07), transcript revise UI (ops 85/86), verify verdict pinned per run; closes SH-14, E-11, E-31 (OD-15); ux flows 5, 6; specs R-3/R-4/R-5 | coder-execution | implementation/45_m8_playback_ui.md (Tier 3) | 90, 78 | M8-PB-W/T/P, M8-REV-1 pass 2 runs on emulators; revision signed by the Core key with author recorded (OD-15) | implementation |
| 93 | [M8\|checkpoint] Code review of the M8 diffs (media stream, export/composite, playback UI) | senior-code-reviewer | gateway_check/21_m8_code_review.md (Tier 2) | 90, 91, 92 | Verdict per area (3 areas); findings routed; 0 Blocker/Major open | gateway_check |
| 94 | [M8\|gate] M8 milestone gate: independent +1 verification — M8-RG-*, M8-QA-1, M8-PB-W/T/P, M8-RNG-1, M8-EXP-1, M8-CMP-1, M8-BLK-1, M8-XAU-1, M8-REV-1, M8-EV-SCOPE-1 (plan §D); physical-device playback stays class C | verifier | gateway_check/13_m8_gate.md (Tier 2) | 93 | Playback on web/tablet/phone (emulators) 2+1 each with Range support; export verifies at destination; blanking lists proven | gateway_check |
| 95 | [M9\|A/B] Full regression + Simulated regression + final pin sweep (M9-W1): 7 workspaces at re-pinned floors, root typecheck/lint, `M9-SIM-1` vs `c2c983b`, `M9-PIN-1` full-repo stale-pin sweep (at the final C3 count incl. R-8 if confirmed); closes E-06, RK-14 (OD-23); test §A.9 | test-expert | test/02_m9_regression.md (Tier 3) | 94, 75 | 7/7 suites exit 0 at floors; every added test named; stale-pin grep 0; report-only, no source change | test |
| 96 | [M9\|A] Docs (M9-W2): DOC-01 README, DOC-02 specs refresh, DOC-04 asset READMEs, DOC-05 `THIRD_PARTY_NOTICES.md` (all shipped components incl. GPL FFmpeg build note, whisper.cpp + ggml MIT source build, the converted model's licence, the capture-worker's linkage to the FFmpeg build per the Q-WORKER answer, LB-1..LB-5), DOC-06 read-only note; B6 `scripts/pg/server.mjs` runbook; STT runbook (CPU build/uninstall from rows 107-108, STT config menu if R-8 confirmed); SEC35-26 privacy/DPIA carry as an accepted-risk/custody section; closes DOC-01, DOC-02, DOC-04, DOC-05, DOC-06, B6; specs §C.1; tx §F | data-analyst | implementation/47_m9_docs.md (Tier 3) | 95 | M9-DOC-1 pass; every shipped third-party component listed with licence; runbook commands verified read-only | implementation |
| 97 | [M9\|A] Hygiene backlog (M9-W3): B8 mobile minors + B15 empty frame, B12 RC-2..RC-7 nits, row-25 F2 `clearToasts()` 350 ms + F3 `waitForSheetExit` + F4 20 `jest.setTimeout(30_000)` files, row-26 F1-F4 (done-marked if already applied), B5/B6/B7 splits only per OD-26 (not scheduled here), B13 only if a release build is made; AU1-1, AU1-2 (ruling b, D19), AU1-5, AU1-6 are DONE BY REVISION RV-CODE — this row only re-checks them (SEALED-swap fake-clock test green, `:132` scramble deterministic) and fixes a residual only if RV-CODE left one; closes B8, B12, OD-26 placement; ux P-08 | coder-execution | implementation/48_m9_hygiene.md (Tier 3) | 95 | M9-HYG-1, X-FC-1, X-PIN-1 pass; each hygiene edit a separate small commit; RV-CODE items re-checked with test names quoted; suites stay green | implementation |
| 98 | [M9\|chain 1/4] Final verification chain, step 1 (M9-W4a): verifier full-gate re-check incl. the whole check catalogue n/n per milestone (M9-CH-1), incl. the rev-2.1 checks (M3-AV-2, M3-KC-4, CPU addendum, R-8 if confirmed); plan §B.8 | verifier | gateway_check/14_m9_gate.md (Tier 2) | 96, 97 | Catalogue count reconciled; verdict recorded; failures routed | gateway_check |
| 99 | [M9\|chain 2/4] Final verification chain, step 2 (M9-W4b): security-review final (M9-CH-2): 0 Critical open; dependency posture measured by unique ROOT advisories (AU1-3 ruling, D19) — braces/node-forge accepted-risk re-check; STT credential posture (never returned, never logged, reference only); SEC35-26 privacy/DPIA carry re-surfaced | security-review | gateway_check/22_security_final.md (Tier 2) | 98 | Verdict with the open-items list; 0 Critical; root-advisory set stated with GHSA IDs; accepted-risk entries restated | gateway_check |
| 100 | [M9\|chain 3/4] Final verification chain, step 3 (M9-W4c): test-expert reconciliation (M9-CH-3): the test-strategy catalogue vs the closed ledger, every check accounted executed/skipped-conditional | test-expert | gateway_check/23_test_final.md (Tier 2) | 99 | Reconciliation table complete; no unaccounted check | gateway_check |
| 101 | [M9\|chain 4/4] Final verification chain, step 4 (M9-W4d): senior-code-reviewer (M9-CH-4): clean tree, static-rule family intact, no residual waiver edits beyond OD-14 | senior-code-reviewer | gateway_check/24_review_final.md (Tier 2) | 100 | Verdict; tree clean; guard family intact | gateway_check |
| 102 | [cond\|M1] GStreamer install re-run (row 13 retry, G-13/14 part 1) — ONLY if the user approves the 11 shared-library upgrades at Q-INST-1: record the omlx libexec patch state first, quiet maintenance window, `brew install gstreamer` (one Homebrew writer), verify `gst-inspect-1.0 isofmp4mux` before anything else; closes NM-02 comparison gap; specs §H.3; cap §A.4 | coder-execution | refreshed initialization/03_gstreamer_install.md (Tier 3) | Q-INST-1 = approve; 106 | `gst-inspect-1.0 isofmp4mux` + `input-selector` exit 0; uninstall command recorded; omlx/ffmpeg/openjdk dependents verified intact | initialization |
| 103 | [cond\|M1] GStreamer prototype (row 14 retry, G-13/14 part 2): reproduce the S1 fMP4/hash path and the S2 switch with rtspsrc + input-selector + isofmp4mux in `.cache/spikes/s3/`; closes NM-14 comparison clause; same spec refs as row 102 | coder-execution | research/11_spike_gstreamer_prototype.md (Tier 2) | 102 | S1 + S2 criteria measured 2+1 (S2 by sample count + continuity, not packet grid); media only in `.cache/spikes/s3/`; 0 repo source edits | research |
| 104 | [cond\|M1] Engine-pick memo refresh (row 15 follow-on, G-13/14 part 3): fill the 8 not-evaluated GStreamer cells from row 103 evidence into the pick memo | data-analyst | refreshed research/12_spike_s3_media_engine_pick.md (Tier 1) | 103 | 12/12 criteria scored with citations; pick unchanged or a decision memo routed to the controller | research |
| 105 | [close-out] Class-C / pre-handover activation pass: after the M9 chain (row 101) and on a trigger (Q-HW hardware on the LAN, or a handover announcement per D233), expand the section 9 entry pack into atomic rev-3 rows (M4-W5 -> `implementation/29`, M8-W4 -> `implementation/46`, M9-W5 -> `implementation/49`, C-6 only if OD-12 changes, A1-A6 pre-handover block incl. the A4 RC-1 device check) with entry criteria proven | task-architect | identification/02_structured.md rev 3 (activation addendum) (Tier 1) | 101; Q-HW arrival OR handover announcement | Every activation row traces to a class-C W-row + spec section; no rev-3 row scheduled without its trigger | identification |
| 106 | [M0\|pickup rev 2.1] Spec-reconciliation check after the revision round: confirm in `masterplan/*` every spec item that rev-2.1 rows cite — CPU-STT consistency (R-5 AC-1, R-7 AC-3, C-N1, OD-24, tx §B.3; AU3-03), -1.333 ms removed as fact (AU2-03), `M3-AV-1` regression vs product bounds + -80 ms (AU2-04), `M5-GAP-1` negative vector + sample-count/continuity in `M5-SW-W` (AU2-05), per-chunk switch bound + filtering-thread rule (AU2-07), H-10 / `M3-AV-2` (AU2-06), RPO + `M3-KC-2`/`M3-KC-4` (AU2-08), R-8 sections (specs R-8, C3 §2.5 ops 90-92, dbc-3 §B.13, ev §B.7a, tx §B.7, ux §8a, test §A.6a) and the CF-12 split of `M6-STTCFG-OFF`; each gap routed to its owning author (data-analyst or test-expert) and re-checked | verifier | gateway_check/25_rv_spec_reconciliation.md (Tier 2) | 41, 43 | Item-by-item table with file:line; 0 open gaps before rows 44/45 launch; every routed gap re-checked after the fix | gateway_check |
| 107 | [M1\|B re-open] whisper.cpp CPU-only runtime per Q-STT-ROUTE. Route (a, default): fetch the pinned release v1.9.5 source (research/04 F-01) into its own empty directory under `.cache/stt/whisper.cpp/`; cmake from an isolated venv `.cache/stt/venv-build/` (cmake is NOT installed; Xcode command-line clang + make + python3.11 are present, AU-2 §4.1); configure GPU/Metal OFF, BLAS and CoreML OFF, Accelerate OFF where the pinned version exposes it, static libraries; build `whisper-cli`; ZERO Homebrew change (AU2-02: a Homebrew install would upgrade `openssl@3`, used by ffmpeg and omlx). Route (b): Homebrew `whisper.cpp` in a quiet maintenance window with the Q-INST-1 procedure (dry run quoted, omlx patch state recorded first, ffmpeg/omlx re-verified after). Q-INSTALL items 1 + 2; uninstall command recorded | coder-execution | initialization/04_whisper_cpp_cpu_build.md (Tier 3) | R1; Q-D7 = a or c; Q-STT-ROUTE = a or b | Route a: `cmake -LA` output quoted with Metal OFF; `otool -L whisper-cli` lists no Metal framework and no `/opt/homebrew` library; `brew list --formula --versions` identical before/after; `whisper-cli --help` exit 0; nothing written outside `.cache/stt/`; 0 new tracked files | initialization |
| 108 | [M1\|B re-open] Model conversion for `cpu-local` (row 11 un-skipped for the CPU backend): convert the read-only HF-format `~/.omlx/models/whisper-large-v3-turbo` (safetensors) to ggml with `models/convert-h5-to-ggml.py` from the row-107 source tree, in an isolated venv `.cache/stt/venv-convert/` (torch, numpy, transformers + the openai-whisper `mel_filters.npz` asset; research/04 F-50..F-54); output `.cache/stt/models/ggml-large-v3-turbo.bin`; on converter failure (F-55/F-56) the official pre-converted ggml download under OD-20 is the recorded fallback, never a silent switch | coder-execution | research/09_spike_stt_model_conversion.md (Tier 2) | 107 | sha256 of every source model file identical before/after (read-only proven); output size + sha256 recorded; `whisper-cli -m` loads it; venvs only under `.cache/`; uninstall command recorded; host load noted | research |
| 109 | [M1\|B re-open] CPU-only functional STT check: `whisper-cli -ng -t <n> -l id -oj` with the row-108 model on the sealed two-voice Indonesian fixture (row 12, `stt-check/fixture-two-speaker-id.wav`, sha256 `6743181a…c0f4fe71`) and on AU-2's independent fixture; closes the R-5 AC-1 / C-N1 CPU clause (`01_specs.md:187`, C-N1 row) and the CPU clause of gate-04 STT-5; no RTF/WER figure (D230) | coder-execution | research/13_stt_cpu_functional_check.md (Tier 2) | 108 | 2 runs: non-empty JSON, timestamps, >= 1 segment per scripted sentence, language `id`; quoted command shows `-ng`; GPU/Metal off proven (row-107 build evidence + run log without a Metal backend); no throughput number anywhere | research |
| 110 | [M1\|gate addendum] Independent +1 of the CPU-only STT check (row 109) and of the build evidence (row 107): no Metal linkage, Homebrew unchanged, the `-ng` command re-run on the sealed fixture | verifier | gateway_check/26_m1_cpu_stt_addendum.md (Tier 2) | 109 | +1 run PASS with the quoted command; `otool -L` and formula-list evidence re-checked; verdict "STT-5 CPU clause closed" or routed back to 107/108 | gateway_check |
| 111 | [M3\|B proof-first] Capture-worker skeleton in the Q-WORKER form (default: small C program against libavfilter/libavformat of the installed FFmpeg 9.0.2, built with clang + make, no new npm dependency; decision recorded under the ready-made-frameworks rule) with two FIRST proofs before any other M3 worker work: (1) H-4 — one AAC encoder output muxed into BOTH camera fMP4 files from two loopback fake RTSP sources; (2) H-10 (AU2-06) — camera video from a fake camera in a separate process with its own clock (injected +80 ms, -80 ms and a slow drift) vs host-captured audio through the selector, flash/beep measured per camera file; throw-away sources under `.cache/spikes/m3proof/`, all listeners on 127.0.0.1 | coder-execution | implementation/59_m3_worker_proofs.md (Tier 2) | 56 | H-4: audio packets byte-identical across both files and both files playable; H-10: per-file offsets measured sample-exact with injected cases correctly signed and drift reported against the regression bound; each proof 2 runs (+1 at row 64); 0 media in git | implementation |
| 112 | [R-8\|M2\|B] STT config table (D20): new KEPT table `stt_config` per dbc-3 §B.13 (singleton; enabled, backend CHECK in `omlx-server`/`cpu-local`, loopback-only endpoint, model, language default `id`, speaker-labelling flag, credential kind + reference or encrypted secret in a column the runtime role cannot SELECT); generated migration `0006_stt_config.sql` + privileges in the 0005 pattern; forbidden-key list covers the STT credential names | database-specialist | implementation/51_m2_stt_config_schema.md (Tier 3) | 46 | M2-STTCFG-DB schema clause on a throw-away DB: `SELECT secret_*` fails 42501 for `dems_app`; loopback CHECK refuses a LAN host; live `dems_demo` never migrated by a test; 2 runs (+1 at row 56) | implementation |
| 113 | [R-8\|M6\|B] STT config contract + API (D20; CF-11): ops 90 (read — every signed-in role), 91 (update — `CAPTURE_CONFIG`, SUPERVISOR + TECHNICIAN) and 92 (test connection — `CAPTURE_CONFIG`) per C3 §2.5; stored change applies to the NEXT session (`appliesFrom: NEXT_SESSION`); audit `STT_CONFIG_CHANGED` with the changed field names + `credentialChanged` only; responses carry `credentialSet`/`credentialKind`, never the credential; non-loopback endpoint refused `422 INVALID_INPUT` (`ENDPOINT_NOT_LOOPBACK`); both log-blanking lists cover the credential; regenerate OpenAPI and re-pin the C3 total as sole lockfile writer under `/usr/bin/lockf -k .locks/npm.lock` | coder-execution | implementation/52_m6_stt_config_api.md (Tier 3) | 56, 112 | M6-STTCFG-API pass; pins equal the C3 total (expected 92 / 35 GET / 57 POST, audit types 63 — asserted from C3, not from this table); INVESTIGATOR refused on 91/92; credential grep over responses, logs and audit = 0 hits | implementation |
| 114 | [R-8\|M2\|B] STT config seed + kept entry (D20): v2 seed writes the single STT row with the Q-STT-CFG seed default (item 11); `kept-tables.ts` 11 -> 12 with mode `upsert`; reset survival; a secret is never seeded (SD-8 pattern) | coder-execution | implementation/53_m2_stt_config_seed_kept.md (Tier 3) | 49, 54, 112 | M2-STTCFG-DB reset clause: the row is image-equal after `db:reset`; kept set = 12; no credential value in seed, fixture or git; 2 runs (+1 at row 56) | implementation |
| 115 | [R-8\|M6\|B] STT config at runtime (D20): the Core snapshots the STT config at session start into the session record; the transcriber selects the backend from the snapshot; disabled = no VAD/STT work during recording; test-connection probes — `omlx-server`: authenticated model-list request on the loopback endpoint through the single key-loader (SEC35-14), never starts, stops, restarts or upgrades oMLX; `cpu-local`: binary + model present and CPU-only build check, no transcription; enabled-but-unreachable at session start raises a warning and never blocks capture (RK-1); inherited probe rules (D68(d), pair-113 N-14): this row provides the op-92 probe through `sttConfigControl(app).provideProbe` in production wiring and proves a 200 on a booted server, the probe follows no redirect, connects `localhost` as 127.0.0.1, never sends the bearer key to an arbitrary loopback port, and treats a stored `ENCRYPTED` credential kind as unavailable until row 84 lands; tx §B.7 | coder-execution | implementation/54_m6_stt_config_runtime.md (Tier 3) | 79, 113 | M6-STTCFG-NEXT pass (fake clock); operation 92 answers 200 on a booted server once the probe is provided (the op-92 200 half of M6-STTCFG-API; 503 before this row); test connection proven on both backends incl. the unreachable case, 2 runs; a change during an open session does not alter that session; key never printed | implementation |
| 116 | [R-8\|M6\|B] Seal-side transcript states (D20 + D-EV-1): disabled -> `FINALIZE_TRANSCRIPT` records `transcript.state = 'DISABLED'` with reason `DISABLED_BY_CONFIGURATION` ("transcript disabled by configuration"); R-5 "inside the sealed package" applies only when enabled; enabled but unreachable -> bounded retry, then sealed per D-EV-1 (`PARTIAL`, failed chunks counted, `transcript.backendUnreachable = true`, no fabricated text); sealing never waits forever; ev §B.7a, §E.5; tx §B.7 | coder-execution | implementation/55_m6_stt_disabled_seal.md (Tier 3) | 115 | M6-STTCFG-OFF and M6-STTCFG-UNREACH seal clauses pass 2 runs each on fakes (verify clause at row 119, CF-12); session reaches SEALED in both cases; capture fragments contiguous | implementation |
| 117 | [R-8\|M6\|B] Web STT configuration menu (D20; ux §8a): System/Settings section — enable/disable, backend, endpoint (server backend only), model, language, labelling, write-only credential field (never pre-filled), "Test connection" with result, "applies to the next session" note, "Checking your permissions..." gating; built from the existing kit components and `lib/core-queries.ts` factories; the credential field offers the reference form only until row 84 lands (D68(c)) and the page consumes the shared client-side blanking rule set (D68(a)) | coder-execution | implementation/56_m6_stt_config_web.md (Tier 3) | 70, 115 | M6-STTCFG-WEB pass 2 runs via agent-browser on a lane: TECHNICIAN edit writes exactly one `STT_CONFIG_CHANGED`; INVESTIGATOR sees a disabled control; credential never rendered; core-web jest `--maxWorkers=2` | implementation |
| 118 | [R-8\|M6\|B] Tablet/phone STT status, read-only (D20; ux §8a): Settings capture section shows enabled, backend, model and the last test result; no edit control on mobile | coder-execution | implementation/57_m6_stt_status_mobile.md (Tier 3) | 70, 113 | M6-STTCFG-TAB (`dems2_tablet`, lane 2) and M6-STTCFG-PHONE (`dems2_phone`, lane 1) pass 2 runs each; 0 edit affordances; status follows a web edit; no PIN typed | implementation |
| 119 | [R-8\|M7\|B] Manifest + verify v2 for transcript states (D20; CF-12): the manifest records the session's STT config snapshot (non-secret fields) and the transcript state (`DISABLED` with reason, or `PARTIAL` with `backendUnreachable`); verify V-checks treat `DISABLED` as valid and report it; tampering the state field fails verification; ev §B.7a, §D | coder-execution | implementation/58_m7_stt_disabled_verify.md (Tier 3) | 85, 116 | Verify clause of M6-STTCFG-OFF/UNREACH passes 2 runs on the server; a DISABLED package and an unreachable-PARTIAL package verify PASS with the state shown; a tampered state field FAILs | implementation |

---

## 6. Milestone Framework (rev 2.1 row map)

Each milestone ends in a verification gate (rows 56, 64, 70, 75, 81, 89, 94) plus its own code-review checkpoint (rows 55, 63, 69, 74, 80, 88, 93). Gate checks run 2 times in the producing rows + 1 independent run at the gate; suites run once per workspace per checkpoint. Completion: see the single definition in section 5.

| M | Rev-2.1 rows | Gate artifact | Gate proving checks |
|---|---|---|---|
| M0 (executed + pickups) | 1-40 rev 1; pickups 41, 42 (done), 43, 106 | `gateway_check/05_m0_spec_gate.md` (done) + `25_rv_spec_reconciliation.md` | errata 31/31, R 7/7, answers 29/29; rev-2.1 reconciliation 0 open gaps |
| M1 (executed + CPU addendum) | spikes 7-15; CPU re-open 107-110; conditional 102-104 | `gateway_check/04_m1_spike_gate.md` (done) + `26_m1_cpu_stt_addendum.md` | 25/25 PASS + STT-5 CPU clause closed on `cpu-local` |
| M2 | 44-54, 112, 114 impl; 55 review; 56 gate | `gateway_check/07_m2_gate.md` | M2 catalogue + M2-STTCFG-DB (if R-8 confirmed) |
| M3 | 111 (proofs first), 57-62 impl; 63 review; 64 gate | `gateway_check/08_m3_gate.md` | M3-RG-*, M3-QA-1, M3-WI-1, M3-AV-1, M3-AV-2, M3-KC-1..4, M3-SR-1..3, M3-MG-1, M3-BC-1, M3-RTSP-BIND-1, M3-REC-1, H-4 proof; T-10 supervisor log line (gate note) |
| M4 | 65-68; 69; 70 | `gateway_check/09_m4_gate.md` | M4-RG-*, M4-QA-1, M4-SEL-W/T/P, M4-LOCK-1, M4-FAKE-1, M4-PC-1 (real adapters class C) |
| M5 | 71-73; 74; 75 | `gateway_check/10_m5_gate.md` | M5-RG-*, M5-QA-1, M5-SW-W/T/P, M5-GAP-1, M5-WARN-1 |
| M6 | 76-79, 113, 115-118; 80; 81 | `gateway_check/11_m6_gate.md` | M6-TF-1 (both backends), M6-DF-1 (`cpu-local`), M6-KR-1, M6-LB-1, M6-AD-1, M6-CP-1, M6-STTCFG-* (if R-8 confirmed) |
| M7 | 82-87, 119; 88; 89 | `gateway_check/12_m7_gate.md` | M7 catalogue + verify clause of M6-STTCFG-OFF/UNREACH |
| M8 | 90-92; 93; 94 | `gateway_check/13_m8_gate.md` | M8 catalogue (physical playback class C) |
| M9 | 95-97; chain 98-101 | `gateway_check/14_m9_gate.md` + 22-24 | M9-RG-*, M9-QA-1, M9-SIM-1, M9-PIN-1, M9-DOC-1, M9-HYG-1, M9-CH-1..4 |
| After M9 | Row 105 on Q-HW arrival or handover announcement | — | class-C gates (section 9) |

---

## 7. Requirement Trace (G1, rev 2.1)

| Req | Requirement | Rev-1 rows | Rev-2.1 rows | Gate items |
|---|---|---|---|---|
| R-1 | Device-selector config in the Core, editable from web/tablet/phone under RBAC + audit | 6, 28, 29, 30, 34 | 47, 48, 52, 66, 67, 68 | OD-05, OD-10, OD-22 (D4) |
| R-2 | Capture worker behind the API, supervised, IPC, adapters under the device contract | 3, 7, 14, 15, 31 | 111, 57, 58, 59, 61, 65 | OD-06, OD-07, OD-14 (D4); **Q-WORKER, Q-GOP** |
| R-3 | One active mic, manual toggle, audited, intervals in the manifest, warn never auto-switch | 8, 29, 31, 34 | 71, 72, 73 | OD-09, OD-11 (D4); **Q-CLICK** |
| R-4 | One whole fMP4 file per camera with the single audio track, running SHA-256, fragment checkpoints | 7, 9, 31, 32 | 111 (H-4), 59, 82, 83, 84, 85 | OD-03, OD-21 (legal open); **Q-GOP** |
| R-5 | Transcript inside the seal; CPU + RAM STT; incremental; labels when possible; signed revisions | 4, 10, 12, 33 | 76, 77, 78, 79, 87, **107-110** | OD-15, OD-20, OD-24; **Q-D7, Q-STT-ROUTE** |
| R-6 | One session per Core; blocked until SEALED; per-step progress + ETA; resumable via RECOVERY | 28, 32, 34 | 52, 82, 87 | OD-08 (D4) |
| R-7 | Hardware >= this Mac, CPU-only; no benchmark here; working STT first; benchmark on the Core device | 2, 12, 36 | **107-110 (CPU-only proven here)**, 76, 77, 95; benchmark class C-7 | Q-HW (open); Q-D7 |
| **R-8** | STT server configurable, activated/deactivated from a configuration menu, configuration in the DB (D20, proposed) | — | 112, 114, 113, 115, 116, 117, 118, 119 | **Q-STT-CFG** |

---

## 8. Backlog Placement (rev 2.1)

| ID | Item | Route in rev 2.1 |
|---|---|---|
| B2 | Dependency refresh | done (rows 5/23/24/27); gate basis = root advisories (AU1-3); re-checked at row 99 |
| B3 | W99-2 pairing bucket, W99-3 socket cap | class C precondition (OD-13 = LAN) — section 9 C-5 |
| B4 | Credential refusal audit rules | row 48 (`M2-AUD-2`) |
| B5 | DR-1 `live-sim.ts` split | not scheduled (OD-26 default b); minimal edit at `:902-905` in row 51 |
| B6 | W91-10 splits; `scripts/pg/server.mjs` runbook | runbook row 96; splits after M9 (OD-26) |
| B7 | HBX-13 -> lint rules | not scheduled (OD-26); carried |
| B8 | W93 mobile minors + B15 empty frame | row 97 |
| B9 | FXR-DEV-2 Reanimated at Finalizing | row 87 with MB-04 |
| B10 | Wall-clock tests + RC-8 + `chrome-lost-updates` | done (rows 16-21/25/27); AU1-1 residual (`:132` scramble) done by RV-CODE, re-checked at row 97 |
| B11 | RF2-2 late-stop wait point | row 62 instrumented, row 73 applied |
| B12 | RC-1 (done row 22; SEALED-swap residual AU1-2 ruling b by RV-CODE) + RC-2..RC-7 nits | nits row 97; RV-CODE items re-checked at row 97 |
| B13 | Packaged CSP `localhost` | row 97 only if a release build is made |
| B14 | QR scanning | out of scope (DR-02), carried |
| B15 | Tablet mic tiles; phone device ID in audit | device ID row 48 (E-30); tiles row 73 |
| B16 | Database-contract errata | applied/carried by row 30; code-side fix in row 46's Task |
| A1-A3, A6 | Release-build revoke-to-Pair, timer lag, tablet late stop, long campaigns | only on a handover announcement -> row 105 |
| A4 | RC-1 device check | code done (row 22 + RV-CODE); device check pre-handover -> row 105 |
| A5 / C7 | Biometric device test | stays skipped (D231) |
| C1-C4, C6, C8 | Shim, AVDs, host PostgreSQL, `.DS_Store`, host clean-up | not in scope; task-2 defaults stand |
| row-25 F2/F3/F4, row-26 F1-F4 | Review follow-ups | row 97 |

---

## 9. Class-C Entry Pack (not scheduled; activated by row 105)

| # | Item | Entry criteria | W-row on activation | Owner |
|---|---|---|---|---|
| C-1 | ONVIF discovery, NTP set, profile listing, **GovLength (GOP) set per the Q-GOP answer** on the target camera | camera model known (Q-HW), on LAN; OD-05 | M4-W5 (`implementation/29`) | coder-execution |
| C-2 | Real `CameraAdapter` RTSP/TCP pull into the worker; observed-GOP check on real streams | C-1 passed; M3 gate passed | M4-W5 | coder-execution |
| C-3 | Real `PoeController` (SNMP RFC 3621) | switch model + control path known (OD-07); OD-22 | M4-W5 | coder-execution |
| C-4 | Real `AudioInputAdapter` | mic model + transport known (OD-06) | M4-W5 | coder-execution |
| C-5 | Physical tablets/phones on the LAN; STT endpoint beyond loopback only if re-decided | OD-13 = LAN; demo password replaced; B3 applied; TLS/origin rules specified | M8-W4 (`implementation/46`) | coder-execution |
| C-6 | Live preview of real cameras | OD-12 not "none" | new M4 UI row (none planned) | coder-execution |
| C-7 | NM-13 STT benchmark on the real Core device (RTF, peak RAM, WER, labelling) with the `cpu-local` build already proven functionally on this Mac (rows 107-110), unless Q-D7 = b / Q-STT-ROUTE = c, in which case C-7 is also the first CPU run | Core device available (Q-HW) | M9-W5 (`implementation/49`) | coder-execution + verifier |
| C-8 | TPM/PKCS#11 signer adapter | OD-04 hardware option chosen; device with TPM | M9-W5 | coder-execution |
| C-9 | Long AV-drift run (1-2 h, H-10 long form) + repeated kill loops; A1-A6 pre-handover block | user announces handover (D233) | M9-W5 + pre-handover rows | verifier |

Hypotheses: H-1 -> C-9; H-6/H-7/H-8/H-9 -> C-1..C-4; H-2/H-3/H-5 proven on fakes at rows 84/85, 90, 58; **H-4 and H-10 proven first at row 111** and re-run at gate 64; H-10 long drift -> C-9.

---

## Gate Questions (rev 2.1) — SECOND BLUEPRINT_APPROVAL package

### G-1. Answered in force (D4) — shown for closure, not re-asked

| ID | Answer in force (D4) | Rev-2.1 landing |
|---|---|---|
| OD-01 | T1: `AUDIO-01` = the one session audio track, `AUDIO-02` legacy v1 only, mics `MIC-01`/`MIC-02` | rows 45, 47, 48 |
| OD-02 | L2: regenerate demo evidence v2, reseed `dems_demo` only, `release/` untouched | rows 49, 83, 85 |
| OD-03 | (a) per-fragment AES-256-GCM + both hashes | rows 59, 84 |
| OD-04 | software Ed25519 behind `Signer`; TPM class C (C-8) | row 83 |
| OD-05 | both topologies; fakes emulate two cameras | rows 45, 65 |
| OD-06 | AAC-LC 48 kHz mono behind `AudioInputAdapter`; USB working assumption | rows 58, 65 |
| OD-07 | `PoeController` + SNMP adapter + fake; real class C | row 65 |
| OD-08 | seal the durable part flagged "interrupted" | rows 79, 82 |
| OD-09 | (a) hot standby; toggle for session holder + SUPERVISOR | rows 48, 66, 71, 72, 73 |
| OD-10 | `CAPTURE_CONFIG` for SUPERVISOR + TECHNICIAN; idle only | rows 47, 66 (+ R-8 rows 113, 117 reuse it) |
| OD-11 | -50 dBFS for 10 s -> `MIC_SILENT`; debounce 2 s | rows 48, 71 |
| OD-12 | no live preview of real cameras | rows 67, 68 |
| OD-13 | loopback (emulators); LAN class C | all UAT rows; R-8 endpoint loopback only |
| OD-14 | P25 waiver limited to listed edits, each reviewed | rows 57, 58 (+ review 63) |
| OD-15 | `TRANSCRIPT_REVISE` INVESTIGATOR + SUPERVISOR; Core key signs | rows 47, 78, 92 |
| OD-16 | decrypted copy + manifest + signature; composite derived; **encoder after a licence check** | row 91 (licence check now explicit) |
| OD-17 | simulator emulates v2; offline scope 0.2.0 | rows 50, 51 |
| OD-18 | fault injection + scenario load disabled in real mode | row 52 |
| OD-19 | block reset while real sealed packages exist; capture tables kept | rows 52, 54 (+ `stt_config` kept, row 114) |
| OD-20 | Indonesian only; diarization + VAD downloads after the licence check | rows 76, 77, 78; row 108 fallback download |
| OD-21 | fMP4; fallback designed; legal confirmation before handover — STILL OPEN (G-3) | rows 59, 82, 86 |
| OD-22 | PoE-cycle only a lost-stream camera | rows 48, 65 |
| OD-23 | retire SC8; Simulated regression vs `c2c983b` at M2 and M9 | rows 51, 95 |
| OD-24 | whisper.cpp + isolated venv conversion; amended by D7 | rows 76, 77, **107-110**; route and scope re-asked as **Q-D7 + Q-STT-ROUTE** |
| OD-25 | all media in git-ignored paths | standing invariant |
| OD-26 | minimal targeted edits now; large refactors after M9 | rows 51, 97 |
| Q-AUTO | full autonomy inside approved scope with a decision log; stops at gates, installs, hardware, handover | process |
| Q-INSTALL | blanket for items 1-6, user-space only, uninstall logged | **item 1 (whisper.cpp) -> rows 107-110, route per Q-STT-ROUTE (default: source build under `.cache/`, no Homebrew change)**; item 2 (conversion venv) -> row 108 (+ cmake build venv in row 107); item 3 -> Q-INST-1; items 4/5/6 as needed |
| Q-HW | unknown | class C deferred (section 9) |

### G-2. Questions for the user — ONE BATCH (9 questions)

All nine are answered together. Each has a recommended default. "Blocks" names the first rows and milestone that cannot start without the answer.

| # | ID | Question | Options | Recommended default | What the default means (plain) | Blocks |
|---|---|---|---|---|---|---|
| 1 | Q-SEC-1 (SEC35-16) | REAL-evidence case scope narrows INVESTIGATOR/TECHNICIAN `EVIDENCE_VIEW` to evidence of the cases they hold; this goes beyond OD-10/OD-15 and changes effective role power. Confirm the narrowed scope, or keep the blanket view? | (a) narrow, audited / (b) blanket view + accepted residual in specs §A | (a) narrow, with the audit event | Officers see only case-bound evidence; op 88 (decrypted streaming) follows the same scope | M8: row 90 (`M8-EV-SCOPE-1`) |
| 2 | Q-SEC-2 (SEC35-09) | No key escrow for the evidence encryption/signing keys; a documented custody policy instead. Confirm? | (a) no escrow + custody policy / (b) add an escrow module (new M7/M9 row) | (a) no escrow | A lost key means that evidence is permanently unreadable or unsigned; custody is documented at handover | M7: row 84 (policy text); handover |
| 3 | Q-INST-1 (D12(d)) | Installing GStreamer would upgrade 11 shared Homebrew libraries whose dependents include omlx, ffmpeg 9.0.2 and openjdk@17 (AU-2 re-confirmed: 1 + 62 + 11). Approve an install window, decline permanently, or keep deferred? | (a) approve a maintenance window / (b) decline permanently / (c) keep deferred | (c) keep deferred | Nothing is installed; GStreamer stays "not evaluated"; FFmpeg + libavfilter already satisfies R-3 | conditional M1 rows 102-104 only |
| 4 | **Q-D7 (rewritten, AU3-02)** | Your D7 instruction (use the installed oMLX STT/TTS on this Mac) stands. What is still open is whether the CPU-only STT you required (D222/D230) must also be proven on this Mac before the "done on this Mac" line. Note: neither backend has been coded yet | (a) oMLX for development **plus** whisper.cpp CPU path built and functionally proven on this Mac (rows 107-110; M6 tests both backends; "no dropped fragment while STT runs" on CPU) / (b) oMLX only on the Mac; the CPU path runs for the first time on the real Core device (class C-7) — D222/D230 and R-5 AC-1 stay unproven on this Mac / (c) whisper.cpp only, no oMLX use (slower development transcription; no benchmark either way) | **(a)** — matches D7(b) itself ("CPU runtime NOT cancelled") | Development keeps the fast oMLX engine; the shipped CPU engine is built under `.cache/` and proven here first; installs are already covered by Q-INSTALL items 1/2 | M1 re-open rows 107-110; M6 rows 76, 77, 81 |
| 5 | **Q-STT-ROUTE (new, AU2-02)** | How the CPU runtime (whisper.cpp) is installed on this Mac. A Homebrew install would also upgrade `openssl@3`, `ca-certificates`, `sdl3`, `sdl2-compat`; `openssl@3` is used by ffmpeg and omlx. cmake is not installed | (a) source build under `.cache/stt/`, GPU/Metal off, static, cmake from an isolated venv, compiler = Xcode command-line clang, **zero Homebrew change** / (b) Homebrew `whisper.cpp` in a maintenance window with the Q-INST-1 procedure (patch state recorded, ffmpeg/omlx re-verified); HYPOTHESIS: the bottle includes GPU backends, so CPU-only would rest on `-ng` at runtime / (c) defer to the real hardware (class C-7) | **(a)** | Nothing outside `.cache/stt/` changes; removal = delete that folder; the build mirrors the x86 Core's CPU-only build. If the source build fails, the row stops and this question is re-asked (no silent fallback to Homebrew) | M1 re-open row 107 -> 108-110 -> M6 |
| 6 | **Q-WORKER (new, AU3-04)** | How the capture worker is built. The bare FFmpeg CLI cannot switch the mic live; the libavfilter API can (S2, AU-2). Criteria: your ready-made-frameworks rule, licence, new dependencies, crash isolation, build on the x86 Core | (a) a small C program against libavfilter/libavformat of the installed FFmpeg 9.0.2, built with clang + make, spawned and supervised by the Core / (b) a Node FFI or native binding to libav* (a candidate npm package must be named and checked for maintenance, licence and FFmpeg 9 compatibility; not verified here) | **(a)** | Reasons: FFmpeg's own API is the ready-made kit and the C program is thin glue, proven live twice (Kilo `opswitch.c`, AU-2 `au2_switch.c`); no new npm native module, so no `allowScripts`/B2 change and no install outside Q-INSTALL; no binding lagging behind FFmpeg 9; a crash stays in the worker process. Cost: a small C codebase with its own tests and static rules (row 61). Licence: it links the same GPL FFmpeg build already recorded for DOC-05; the handover licence check covers it. The decision is recorded under the ready-made rule | M3: row 111, then 58-64 |
| 7 | **Q-GOP (new, AU2-08; spec OP-GOP)** | Cameras are recorded by stream copy, so the camera sets the keyframe interval (GOP), not DEMS. A crash loses the open fragment = one camera GOP (AU-2: a 10 s GOP killed at 7 s left 0 s of usable video). A truncated tail also passes ffprobe silently | (a) require GOP <= 2 s: fakes at <= 2 s; real cameras set through the selector/ONVIF at session start (class C-1/C-2); the worker measures the observed keyframe interval and raises a warning on the existing capture-warning channel (no new error/audit code); RPO stated; truncated tail detected explicitly at RECOVERY / (b) hard fragment ceiling (`-frag_duration`), bounded loss regardless of the camera, but fragments may start without a keyframe (S1 G-3) / (c) accept the camera GOP and only document the RPO | **(a)** | Loss on a crash is at most about 2 s per camera when the camera is configured; a camera that ignores it is flagged, never silently accepted; RECOVERY always box-walks the tail (all options) | M3: rows 59, 60, 64; M7: row 82; class C-1/C-2 |
| 8 | **Q-CLICK (new, AU2-07; spec OP-CLICK)** | A manual mic switch is a hard cut and is audible as a click (16-24x the normal sample step). How should the switch edge sound? | (a) keep the hard cut: no sample is altered, the boundary is exact, the click is documented for operators / (b) 5 ms fade-out + 5 ms fade-in, no overlap of the two mics (removes the click; alters about 10 ms of audio around each switch, noted in the interval record) / (c) 5-10 ms crossfade (smoothest, but briefly mixes both mics, which conflicts with "one active mic", D220/OD-09) | **(a)** | The evidence audio is unmodified and only one mic is ever on the track; a fade can be added later as a one-filter change | M5: row 71 |
| 9 | **Q-STT-CFG (new, D20 / R-8)** | Confirm the proposed defaults of the new STT configuration menu (items below) | (a) confirm all items as listed / (b) confirm with named changes (item number + new value) / (c) reject R-8 (rows 112-119 removed, no other change) | **(a)** | See the item list below | M2: rows 112, 114; M6: rows 113, 115-118; M7: row 119 |

**Q-STT-CFG items (proposed defaults from D20, aligned with `01_specs.md` R-8):**

| Item | Proposed default |
|---|---|
| 1. Fields | enabled/disabled; backend (`omlx-server` = this Mac, development; `cpu-local` = whisper.cpp, the Core); server endpoint (server backend only); model; language (Indonesian, OD-20); speaker labelling on/off |
| 2. Storage | PostgreSQL, one row in the KEPT table `stt_config`; survives the demo reset (OD-19 pattern) |
| 3. Where it is edited | Web console configuration menu (System/Settings); tablet and phone show a read-only status |
| 4. Who may change it | `CAPTURE_CONFIG` (SUPERVISOR + TECHNICIAN); every signed-in role may read the status; INVESTIGATOR refused on edit and test |
| 5. Audit | `STT_CONFIG_CHANGED`, one row per edit, carrying the changed field names and `credentialChanged: true/false`, never a value |
| 6. When a change applies | the NEXT session; an open session keeps the snapshot taken at its start (never mid-recording) |
| 7. Server credential (e.g. the oMLX API key) | stored only as a secret reference (the key stays in `~/.omlx/settings.json`, read by the single key-loader) or encrypted in the Core credential store; never returned by the API, never in a slice, log or audit row |
| 8. Test connection | a button/action: for `omlx-server` an authenticated check on the loopback endpoint that never starts, stops, restarts or upgrades oMLX; for `cpu-local` a binary + model + CPU-only build check; result shown, credential never echoed |
| 9. STT disabled | no transcript work during recording; the sealed package records "transcript disabled by configuration"; verify passes; "transcript inside the seal" (R-5) applies only when enabled |
| 10. STT enabled but backend unreachable | warning at session start, capture never blocked; sealing proceeds under the transcript failure rule (`PARTIAL`, failed chunks counted, flagged "backend unreachable", nothing fabricated) |
| 11. Initial value on this Mac | enabled, backend `cpu-local` (if Q-D7 = a or c), otherwise `omlx-server` on `http://127.0.0.1:8000`; language `id`; labelling on |
| 12. Endpoint restriction | loopback only (`127.0.0.1`/`localhost`); anything else refused; LAN is class C (OD-13) |
| 13. Contract impact | 3 new operations (ops 90-92), 1 new audit type, 1 new kept table (kept set 11 -> 12); exact counts pinned from the revised API contract |

### G-2b. Defaults that need no action (shown for completeness)

| ID | Default in force | Why no action is needed |
|---|---|---|
| Q-SP-4 | (a) keyframe-aligned fragments: `CAPTURE_GOP_FRAMES=50` / `CAPTURE_FRAGMENT_TARGET_MS=2000` | Technical constant, confirmed at the M0 gate (`05_m0_spec_gate.md:190`), tunable by one constant edit (AU3-15). On camera stream copy the camera's GOP governs; see Q-GOP |
| Q-SEC-3 | (a) the applied credential-reveal control (write-only API + single-module static rule + audited reveal) instead of a 4th DB role | D-DB-07 ("no new DB roles") is the database author's own design rule, not a user decision (AU3-16); decided under Q-AUTO with security-review sign-off; lands in row 46 |

### G-3. Notes and carried-forward items (no vote)

| ID | Item | State | Disposition |
|---|---|---|---|
| Q-COUNT | Registry 89 ops (34 GET / 55 POST, 62 audit types, 40 codes, offline 23) through M5; + R-8 ops 90-92 in M6 if Q-STT-CFG is confirmed | Informational (D14(c), CF-11) | Rows 48/50 pin 89; row 113 re-pins from C3 |
| OD-21-LEGAL | Legal acceptance of fragmented MP4 as "one whole file" — no external authority found | Open; blocks handover only | fMP4 path stands; S7/S8 cells parked (row 86) |
| Q-HW | Hardware arrival/models | Unknown | Class C deferred; activation by row 105 |
| AR-1 | `braces` GHSA-vfj7-8cjw-p6xm, `node-forge` GHSA-86w9-cpqp-85rv — no published fix; dev/build/test only | Accepted risk (D14(a)); measured as root advisories (AU1-3; today's npm package count 98 high is registry drift) | Re-checked at row 99 |
| AR-2 | SEC35-26 privacy/DPIA | Carried | Documented at row 96; re-surfaced at row 99; needs an external authority |
| AU1-2 | Hub row step-back at SEALED | Ruled (b) by the controller (D19); fixed by RV-CODE | Re-checked at row 97; A4 device check pre-handover |
| GAP-03, GAP-04 | Row-35 pre-remediation counts; citation-only errata in the register | Informational | No edit |

---

## Dependencies (rev 2.1)

| # | Dependency | Needed by | State |
|---|---|---|---|
| DP-1 | BLUEPRINT_APPROVAL + gate answers | rev-1 rows | satisfied (D4) |
| DP-2 | SECOND BLUEPRINT_APPROVAL of rev 2.1 with the 9 answers of G-2 | every rev-2.1 row | **pending — the reason this document exists** |
| DP-3 | Install approvals (Q-INSTALL) | rows 77 (VAD/diarization models), 107 (whisper.cpp source + cmake venv), 108 (conversion venv; fallback download), 102 (Q-INST-1 branch) | blanket stands (D4); route per Q-STT-ROUTE; item 3 per Q-INST-1 |
| DP-4 | PostgreSQL on `127.0.0.1:4432` | rows 44, 46, 49, 53, 54, 56, 112, 114 | running per AU-1 |
| DP-5 | FFmpeg 9.0.2 + espeak-ng + oMLX stack (D7) | rows 58-62, 76-78, 86, 90, 111, 115 | present; oMLX start/stop logged, log backed up, never upgraded |
| DP-6 | Hardware (Q-HW) | class C only | unknown |
| DP-7 | Lane re-creation + per-lane pairing | rows 44, 53, every lane-based gate, 117, 118 | scheduled |
| DP-8 | Row-27 wave-A regression green before M2 opens | M2 | satisfied (reproduced by AU-1) |
| DP-9 | Revision round complete (`RV`: RV-SPEC + RV-CODE gated) | rows 41, 43 -> 106 -> M2 | in progress (D19/D20) |
| DP-10 | Xcode command-line tools (clang, make) + python3.11 | rows 107, 108, 111 | present (AU-2 §4.1); cmake absent -> venv |

---

## 10. Parallel Execution Plan (rev 2.1 — rebuilt from the Depends On column)

**Method.** Each row's level = 1 + the highest level among its dependencies; external tokens (`R1`, `RV`, gate answers) count as level -1. A wave = one level. A row is released as soon as its own dependencies are met, within the ceilings (D5(c): at most 4 per agent type, at most 8 in total; global rules allow 8 per type, D5(c) is stricter and stays). Because every dependency sits in a strictly lower level, **the graph is acyclic** and no row shares a wave with one of its dependencies (fixes AU3-05). Higher-numbered dependencies (CF-9) are normal here.

| Wave (level) | Steps | Count | Same-type max | Single-writer / serialised resources in the wave |
|---|---|---|---|---|
| W1 (L0) | 41, 43, 107 | 3 | 1 | three different files; 107 = network fetch + CPU-heavy build, `.cache/stt/` only (uptime check first) |
| W2 (L1) | 106, 108 | 2 | 1 | 108 = venv download + RAM-heavy conversion; never beside a large oMLX session |
| W3 (L2) | 44, 45, 109 [+102 if approved] | 3 | coder-execution x2 | db runner + emulators (44); 109 CPU-heavy STT, run when no jest suite is in flight; 102 = Homebrew sole writer, maintenance window, alone on the host |
| W4 (L3) | 46, 47, 110 [+103] | 3 | 1 | db runner (46); 110 CPU STT re-run |
| W5 (L4) | 48, 49, 51, 112 [+104] | 4 | coder-execution x3 | db runner serialised between 49 and 112 (`lockf`); shared-package files distinct (48 api, 51 sim) |
| W6 (L5) | 50, 52, 54 | 3 | coder-execution x3 | lockfile sole writer (50 `openapi:gen`); db runner (54) |
| W7 (L6) | 114 | 1 | 1 | db runner |
| W8 (L7) | 53 | 1 | 1 | db runner + emulators |
| W9 (L8) | 55 | 1 | 1 | read-only review |
| W10 (L9) | 56 | 1 | 1 | M2 gate (verifier alone) |
| W11 (L10) | 57, 111, 113 | 3 | coder-execution x3 | media ports 8554-8564 serialised between 57 and 111; lockfile sole writer (113 `openapi:gen`) |
| W12 (L11) | 58, 76 | 2 | coder-execution x2 | media ports (58); oMLX serialised / CPU STT (76) |
| W13 (L12) | 60, 77 | 2 | coder-execution x2 | media ports (60); 77's M6-DF-1 runs with no other heavy row in flight |
| W14 (L13) | 59, 78 | 2 | coder-execution x2 | media ports (59 kill checks) |
| W15 (L14) | 61, 79 | 2 | coder-execution x2 | media ports (61 boot checks) |
| W16 (L15) | 62, 115 | 2 | coder-execution x2 | mobile jest (62); oMLX probe serialised (115) |
| W17 (L16) | 63, 116 | 2 | 1 | read-only review (63) |
| W18 (L17) | 64 | 1 | 1 | M3 gate (media ports) |
| W19 (L18) | 65 | 1 | 1 | — |
| W20 (L19) | 66 | 1 | 1 | — |
| W21 (L20) | 67, 68 | 2 | coder-execution x2 | core-web jest (67), mobile jest (68) |
| W22 (L21) | 69 | 1 | 1 | read-only review |
| W23 (L22) | 70 | 1 | 1 | M4 gate (emulators) |
| W24 (L23) | 71, 117, 118 | 3 | coder-execution x3 | media ports (71); core-web jest + agent-browser (117); mobile jest + emulators (118) |
| W25 (L24) | 72, 73, 80 | 3 | coder-execution x2 | core-web jest + browser (72); mobile jest + emulators (73); read-only review (80) |
| W26 (L25) | 74, 81 | 2 | 1 | read-only review (74); M6 gate = oMLX + CPU STT + media, run as the only heavy job |
| W27 (L26) | 75, 82, 84 | 3 | coder-execution x2 | M5 gate (emulators + media) first; media ports serialised for 82 |
| W28 (L27) | 83 | 1 | 1 | — |
| W29 (L28) | 85 | 1 | 1 | — |
| W30 (L29) | 86, 119 | 2 | coder-execution x2 | media ports (86 kill harness) |
| W31 (L30) | 87 | 1 | 1 | core-web + mobile jest |
| W32 (L31) | 88 | 1 | 1 | read-only review |
| W33 (L32) | 89 | 1 | 1 | M7 gate (media ports) |
| W34 (L33) | 90, 91 | 2 | coder-execution x2 | evidence media route; composite encoder only after the licence record |
| W35 (L34) | 92 | 1 | 1 | core-web + mobile jest |
| W36 (L35) | 93 | 1 | 1 | read-only review |
| W37 (L36) | 94 | 1 | 1 | M8 gate (emulators + media) |
| W38 (L37) | 95 | 1 | 1 | all suites serialised (full regression) |
| W39 (L38) | 96, 97 | 2 | 1 | mobile/core-web jest (97) |
| W40-W43 (L39-L42) | 98, then 99, then 100, then 101 | 1 each | 1 | final chain strictly sequential |
| On trigger | 105 | 1 | 1 | after row 101 + Q-HW arrival or handover announcement |

**Planned maxima: 4 rows in one wave (W5; 5 only if conditional row 104 runs), 3 of the same type (coder-execution in W5, W6, W11, W24); well under the 8-total ceiling.** Gates and the final chain run one at a time. Single-writer rules: lockfile one writer (rows 50, 113; any npm work); Homebrew no writer unless Q-INST-1 = approve (102) or Q-STT-ROUTE = b (107); core-server db runner one migration/test at a time (44, 46, 49, 53, 54, 112, 114, gate re-runs); mobile jest sequential (62, 68, 73, 87, 92, 97, 118); core-web jest sequential (67, 72, 87, 92, 117); oMLX serialised and never beside a large VLM session (76, 77, 81, 115); CPU-heavy STT rows (107-110, 77, 81) never beside jest suites; media ports 8554-8564 one capture/fixture at a time (57-62, 111, 71, 82, 86, gates); emulator access one lane/emulator pair at a time (44, 53, 68, 72, 73, 87, 92, 118, gates). No row needs `sudo`, a git push, an emulator PIN or a biometric step.

---

## Verification & Testing Strategy (rev 2.1)

- **Unit testing:** inside every implementation row via the workspace suites (`--maxWorkers=2`, fake clocks); per-milestone checkpoint = review row + gate row. New modules ship with unit tests and a static-rule test for their folder (row 61 family; the C worker sources included if Q-WORKER = a).
- **Integration testing:** M2 contract/DB rows proven by `M2-MT-*`, `M2-DB-*`, `M2-API-*`, `M2-STTCFG-DB`; M3 worker on fakes (`M3-WI-1`, `M3-AV-1`, `M3-AV-2`, `M3-REC-1`) with H-4/H-10 proven first (row 111).
- **Functional testing:** CPU-only STT on this Mac (rows 109/110, `-ng` quoted); transcript on both backends (rows 77/81); "no dropped fragment while STT runs" on `cpu-local` (M6-DF-1); kill matrix as distinct cells (row 86); v2 verify server + clients (rows 85, 87, 119); R-8 disabled/unreachable sealing (rows 116, 119). All against the v2 seed + bulk fixture on recreated lanes.
- **Measurement rules (AU-2):** AV offsets sample-exact, regression bound 2 ms against 0 / +80 / -80 ms truths, product bound ±40 ms reported separately; mic-switch gaplessness by decoded sample count + per-input continuity (the packet-grid metric is not evidence); switch latency bound per input chunk; crash loss bounded by one camera GOP with explicit tail validation.
- **UAT:** selector/mic/playback/STT-menu flows on web (agent-browser) + tablet/phone emulators on lanes, 2 + 1 per check (gates 70, 75, 81, 94); physical devices class C (C-5).
- **Security testing:** SEC35 mitigations in rows 46, 48, 60, 61, 76, 83, 84, 90; R-8 credential secrecy (rows 112, 113, 115; grep of responses, logs, audit); final security step row 99 (0 Critical; root-advisory basis).
- **Performance testing:** none on this Mac beyond the functional M6-DF-1 check on `cpu-local`; no RTF/WER anywhere (D230); benchmark class C-7.
- **Bulk data seeding:** row 49 (fixture per dbc-3 §G minimums), applied per lane at row 53; STT default row by row 114.
- **Trackable checkpoints:** `checkpoint-resume` per milestone; controller keeps `status_tasks.md` current per row.
- **Acceptance criteria:** the single section-5 definition, then each class-C gate on activation (row 105).

## Risk Assessment (rev 2.1 delta; rev-1 RK-1..RK-20 and rev-2.0 RK-21..RK-25 stand)

| # | Risk | Likelihood / Impact | Mitigation | Rows |
|---|---|---|---|---|
| RK-26 | The whisper.cpp source build fails with cmake from PyPI + Xcode clang | Medium / Medium | Stop and re-ask Q-STT-ROUTE; never fall back to Homebrew silently; the pinned version and `cmake -LA` are recorded | 107 |
| RK-27 | HF-to-ggml conversion of the turbo safetensors fails (F-55/F-56) | Medium / Low | Recorded fallback: official pre-converted ggml download under OD-20; the source model stays read-only | 108 |
| RK-28 | `large-v3-turbo` on CPU is slow and starves capture | Medium / High | That is exactly what M6-DF-1 on `cpu-local` tests (capture above STT, RK-1); functional only, no throughput claim | 77, 81 |
| RK-29 | The worker-form choice brings licence or dependency obligations | Low / Medium | Q-WORKER criteria; decision recorded under the ready-made rule; DOC-05 entry (row 96); handover licence check | 111, 96 |
| RK-30 | R-8 changes ripple into pinned counts, the kept set and the manifest | Medium / Medium | Ops 90-92 land only in M6 (CF-11); pins asserted from C3; kept set 12 asserted at row 114; manifest + verify at row 119 | 112-119 |
| RK-31 | RV-SPEC did not land everything the rows cite | Medium / Medium | Row 106 checks item by item before M2 opens; gaps routed to the owning author and re-checked | 106 |
| RK-32 | Stable step numbers with higher-numbered dependencies confuse a reader | Low / Low | CF-9 states the rule; section 10 lists the levels; the Depends On column governs | all |

**Assumptions and caveats.** The Homebrew dry-run figures (4 upgrades incl. `openssl@3`) are AU-2's measurement on 2026-10-08 and may drift. Whether the Homebrew bottle links GPU backends is a hypothesis. Candidate Node bindings for Q-WORKER (b) are not named or verified here.

## Recommendation & Next-Plan Summary (rev 2.1)

### Key Findings Summary

| # | Finding | Confidence | Evidence Source | Implication |
|---|---|---|---|---|
| 1 | Rev 2.0 had silently dropped the CPU-only STT path that D222/D230/OD-24 require | High | `verification/22_audit_docs_decisions.md` AU3-01; `21_audit_spikes_stt.md` AU2-01 | Rows 107-110 restore it on this Mac; Q-D7 now offers the choice honestly |
| 2 | A Homebrew whisper.cpp install would upgrade `openssl@3` used by ffmpeg and omlx | High (dry run) | AU2-02 | Source build under `.cache/` recommended (Q-STT-ROUTE) |
| 3 | The worker form and "one encoder feeds both files" were never decided or spiked; the two-clock case was never tested | High | AU3-04, AU2-06 | Q-WORKER; row 111 proves H-4 and H-10 first |
| 4 | Several spike metrics were artefacts (-1.333 ms, 0.001 ms gap) and the crash-loss window equals one camera GOP | High | AU2-03..AU2-08 | Rows 59, 60, 64, 71, 75, 82 use corrected checks; Q-GOP and Q-CLICK |
| 5 | The new STT configuration requirement (R-8) fits as 8 single-concern rows without changing M2's pinned counts | High | D20; `01_specs.md` R-8; test §A.6a | Q-STT-CFG confirms the defaults |

### Priority Recommendations

| Priority | Recommendation | Rationale | Risk if Ignored | Target |
|---|---|---|---|---|
| P0 | Answer the 9 G-2 questions in one batch (defaults recommended) and approve rev 2.1 | MAJOR gate; nothing executes before it | The whole implementation phase stalls | Gate |
| P0 | Choose Q-D7 (a) + Q-STT-ROUTE (a) | Proves D222 here without touching shared Homebrew libraries | The first CPU transcription happens on the customer device | rows 107-110 |
| P1 | Finish the revision round (RV-SPEC, RV-CODE) and run row 106 before M2 | Rows cite the revised specs | Gates would cite missing checks | W1-W2 |
| P1 | Keep Q-INST-1 deferred | Comparison-only; protects omlx/ffmpeg/openjdk | Host-toolchain breakage | 102-104 |
| P2 | Supply Q-HW info when known | Class-C timing otherwise unknown | Real-device proof stays open | section 9 |

### Pending Decisions for Human-in-Loop

G-2: Q-SEC-1, Q-SEC-2, Q-INST-1, Q-D7, Q-STT-ROUTE, Q-WORKER, Q-GOP, Q-CLICK, Q-STT-CFG (9 questions; Q-STT-CFG carries 13 default items). G-2b defaults without action: Q-SP-4, Q-SEC-3. G-3 carries OD-21-LEGAL and Q-HW (no vote possible now).

### Next-Plan Recommendations

- **Immediate next step:** the controller gates RV-SPEC/RV-CODE, presents this rev 2.1 with the G-2 batch, records the answers in `decisions/decisions.md`, then releases W1 (41, 43, 107) and W2 (106, 108).
- **Subsequent tasks:** M2 (44-56, 112, 114) -> M3 with proofs first (111, 57-64) interleaved with M6 start (76-79) -> M4 (65-70) -> M5 + R-8 UI (71-75, 117, 118) -> M6 gate (80, 81) -> M7 (82-89, 119) -> M8 (90-94) -> M9 (95-101) -> report/handoff.
- **Parallelizable work:** per section 10; never more than 4 same-type / 8 total.
- **Cross-task continuity notes:** diff baseline `c2c983b`; ledger floors incl. mobile 193/1,994; three emulators re-pair per lane at rows 44/53; `release/`, `apps/mock-core`, the design book untouched; the CPU runtime and converted model live only under `.cache/stt/` (removable by deleting the folder).

## Agent Mapping Rationale (rev 2.1)

| Agent | Rows | Why |
|---|---|---|
| coder-execution | 44, 47-54, 57-62, 65-68, 71-73, 76-79, 82-87, 90-92, 97, 102, 103, 107, 108, 109, 111, 113, 114, 115, 116, 117, 118, 119 | Code, build and scripted-run work; the only executor for app code. Rows 107-109 are mechanical with a checkable output (candidates for a per-call `model="sonnet"` downgrade under global rules §11; the controller decides and logs it) |
| database-specialist | 45, 46, 112 | Schema v2, migrations/privileges, the `stt_config` table |
| data-analyst | 42 (done), 43, 96, 104 | Spec text by the owning author; docs; memo refresh |
| test-expert | 41, 95, 100 | Owns the test-strategy text; regression reconciliation |
| senior-code-reviewer | 55, 63, 69, 74, 80, 88, 93, 101 | Per-milestone review checkpoints + chain step 4 |
| verifier | 56, 64, 70, 75, 81, 89, 94, 98, 106, 110 | Independent +1 gate runs and the spec reconciliation; never downgraded |
| security-review | 99 | Final security chain step |
| task-architect | 105 | Design-only activation pass; never executes rows |

## Atomicity and Format Self-Check (rev 2.1 table, plus the rev 2.2 re-check below — manual row-by-row check; this agent has no shell)

| Check | Method | Result |
|---|---|---|
| Exactly 7 columns, escaped pipes, no merged/multi-line cells, no prose between rows | Grep raw-pipe counts per row vs escaped prefix pipes: rows 42 and 105 = 8 raw / 0 escaped; 69 rows = 9 raw / 1 escaped; rows 112-119 = 10 raw / 2 escaped — every row has 8 unescaped pipes = 7 cells | PASS (79/79 rows) |
| Every cell populated | Row-by-row scan | PASS (row 42's output cell names the satisfied file explicitly) |
| Agents only from `~/.claude/agents/` | Set {coder-execution 49, verifier 10, senior-code-reviewer 8, data-analyst 4, test-expert 3, database-specialist 3, security-review 1, task-architect 1} = 79; all 8 files present in `~/.claude/agents/` | PASS |
| Standard phases only | {masterplan, implementation, gateway_check, test, initialization, research, identification}; row 105 = identification (AU3-18) | PASS |
| Depends On exist and acyclic | Every numeric dependency names a row in 41-119; tokens: `R1`, `RV`, `Q-D7 = a or c`, `Q-STT-ROUTE = a or b`, `Q-INST-1 = approve`, trigger (105). Section 10 assigns every row a level strictly above all of its dependencies (43 levels L0-L42) | PASS — acyclic; higher-numbered dependencies are intentional (CF-9): 44/45->106, 53->112/114, 55->112/114, 58->111, 59->60, 76->110, 80->113/115-118, 87/88->119, 102->106 |
| One output path per row, no duplicates | Output column: 78 rows each name one distinct path (new files or single-file refreshes such as rows 41, 43, 102, 104, 105) + row 42 (satisfied file, not rewritten); new paths implementation/51-59, gateway_check/25-26, initialization/04, research/09, research/13 — none used elsewhere; reserved 29/46/49 unused | PASS — 0 collisions |
| Test depth 2 + 1 | Device/browser/spike/DB-gate checks: 2 runs in the producing row + 1 at the gate (rows 44/56, 53/56, 59-60/64, 109/110, 111/64, 112-114/56-81, 116-119/81-89, 71-73/75...); suites once per workspace per checkpoint; kill matrix distinct cells; no loops outside pre-handover | PASS |
| At most 8 agents in flight; at most 4 per type (D5(c)) | Section 10: max 4 rows per wave (W5), max 3 same-type | PASS |
| Rev-2.0 rows preserved | Rows 41-105 keep numbers; 25 amended per the change log; the rest unchanged | PASS |
| Every new row has a named source | 106 (D19 revision round), 107-110 (AU3-01/AU2-01/AU2-02), 111 (AU3-04/AU2-06), 112-119 (D20) | PASS |
| No biometric, emulator-PIN, git-push, sudo row; no Homebrew write without an explicit answer | Sweep of descriptions + standing invariants | PASS |
| Gate package complete and ready in one batch | 9 questions with options, recommended default, plain consequence and blocked rows; 2 no-action defaults; G-3 notes | PASS |

### Rev 2.2 re-check (edited rows 57, 58, 64, 66, 82, 84, 115, 117; the table above is the rev-2.1 record and stands for the other 71 rows)

| Check | Method | Result |
|---|---|---|
| Exactly 7 columns in the edited rows | Grep after the edit with a pattern that accepts only 8 unescaped pipes on a row line, for the eight step numbers and then for all steps 41-119; the added text contains no pipe character | PASS (8/8 edited rows match; 79/79 overall) |
| Row count unchanged | 79 rows, steps 41-119; none added, none removed, none renumbered | PASS |
| Agent_to_Invoke unchanged | Rows 57, 58, 66, 82, 84, 115, 117 stay `coder-execution`, row 64 stays `verifier`; the agent totals of the rev-2.1 check stand | PASS |
| Expected Output unchanged | `implementation/19`, `20`, `26`, `37`, `39`, `54`, `56` and `gateway_check/08_m3_gate.md` as in rev 2.1; still one distinct path per row | PASS |
| Check IDs cited exist in the catalogue | `M3-REC-1` at `masterplan/10_test_strategy.md:169` (owning row 58, run once); `M6-STTCFG-API` carries the 503-then-200 answers (catalogue change T-9); the T-10 line is a gate note, not a named check. Totals quoted once in this file (section 4.1): 219 active + 10 conditional, M3 = 22 | PASS |
| Depends On exist and acyclic | Only change: row 58 = `57, 111, 113`. Row 113 exists (L10) and depends on 56 and 112, neither downstream of 58. Row 58 stays L11; the 43 levels L0-L42 of section 10 are unchanged | PASS — acyclic; 58->113 joins the list of intentional higher-numbered dependencies (CF-9) |
| One measurable Verification statement per edited row | Row 58: one semicolon-joined statement of named checks plus countable outcomes (0 dropped records, 0 UDP sockets, non-zero exit). Row 84: one added clause with an observable answer (200, `credentialKind: ENCRYPTED`). Row 115: one added clause (operation 92 answers 200). Row 64: `M3-REC-1` PASS plus the two quoted log strings. Rows 57, 66, 82, 117: Verification cells not touched | PASS |
| Single output and single owner per edited row | Each edited row still has one owner and one artifact | PASS |
| Atomicity of row 58 | Row 58 now carries 13 inherited items next to its own scope, and items (3) and (4) are supervisor-side and engine-side code, not worker code. It stays one row by the controller's instruction for this pass (no new row) and because D66/D67 assigned the work to row 58 | PASS WITH NOTE — the broadest row of the blueprint; if the driver or navigator reports it cannot be closed as one unit, a split is a separate revision and would need its own classification |
| No new biometric, emulator-PIN, git-push, sudo or Homebrew step | Sweep of the added text | PASS |
| Consistency left open by this pass (not edited, by instruction) | Section 5.6 still lists the SH family without rows 58 and 66; executed row 48 still names SH-18 in its closes list (ruled false by D65(b)); the Verification cell of row 57 still carries the unscoped respawn sentence, now scoped in its Task Description; the D5(c) ceiling text in section 10 predates D63(d) | NOTED for the controller |

## Change Classification (for the controller)

**MAJOR overall** — unchanged from rev 2.0: the blueprint moves from "research + plan" (D4) to implementation, and D3/RF-9 pre-declared the second gate. **The rev-2.1 delta itself** is the D19 revision round (MINOR: it implements confirmed audit mismatches and restores scope the user had already approved — D4 OD-24/Q-INSTALL, D7(b)) **plus R-8**, a user-requested scope addition (D20) that only runs if Q-STT-CFG is confirmed. **No rev-2.1 row executes before the user approves this revision with the G-2 answers.** Changing a single answer later reroutes per plan §F without re-planning.

### Rev 2.2 (2026-10-09) — proposed classification: MINOR

The controller confirms the class. The reasons, criterion by criterion:

| MAJOR criterion | Met? | Reason |
|---|---|---|
| New scope or features | No | Every added item is work the specs already require (errata PE-57, PE-111, PE-113) or a defect found while executing an approved row. The STT credential sealer was already required by R-8 item 7; D68(c) names its owner and classified that as MINOR |
| Different agents | No | Every edited row keeps its agent (seven `coder-execution`, row 64 `verifier`) |
| Effort above 30 % | No, for the blueprint as a whole | 79 rows, 8 reworded; the row-64 change adds one catalogue check and one log line to the M3 gate. This is an estimate, not a measurement. Row 58 on its own grows materially (13 inherited items), and rows 84 and 115 grow by one bounded item each |
| New modules | No | Lossless record frames extend `packages/capture-protocol`; the sealer lives in the same Core credential store ("no second store") |
| Intent changed | No | R-2, R-4 and R-8 are unchanged; the restart rule narrows behaviour to what OD-08 (D4) already decided |
| Flow restructured | No | One dependency edge added (58 <- 113); no level or wave changes in section 10 |
| Contradiction of an approved decision | No | The row-57 closes list is corrected to what the row delivered (D65(b)); the register items SH-18 and CS-04 still close, at rows 58, 66 and 82. D24 stands |

No second approval gate is needed for rev 2.2 if the controller confirms MINOR. One caution: the "No" on effort depends on row 58 staying one unit; see the atomicity note in the rev-2.2 re-check.

---
*Generated: 2026-10-07*
*Last Updated: 2026-10-09 (rev 2.2 — maintenance from D63, D65-D68; rev 2.1 of 2026-10-08, row RV-BP, audits AU-1/AU-2/AU-3 and D20)*
