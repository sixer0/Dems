---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-08
agent: verifier
audit_row: AU-3 (independent audit, decision D16)
tier: 1
scope: Kilo planning artifacts (specs rows 28-36, plan row 37, gates rows 38-39, remediation, blueprint rev 2.0 rows 41-105) against D4, predecessor D219-D233/D260, the 31 errata and the code at c2c983b
status: needs-review
verdict: REV 2 NOT READY for the second approval as written; ready after revisions REV-1..REV-4 (document-only, small)
---

# AU-3 — Audit of planning documents and decisions (task 3)

## 0. Summary

| Item | Result |
|---|---|
| Requirement conformance (predecessor D219-D233, D260, 29 D4 answers) | 27 of 29 D4 answers and every predecessor requirement except D222's CPU-only STT are carried correctly, with spec-line evidence. No spec reintroduces a multitrack master, a second audio track, an automatic mic switch, a benchmark on this Mac, media in git, reuse of `AdminResource.DEVICES` or a LAN listener. |
| The one material deviation | **The CPU-only STT path (D222 / D230 / OD-24 / Q-INSTALL item 1) has been dropped from execution.** It was approved as rev-1 rows 10-12. D7 re-scoped it to the Metal-based oMLX server and promised it would move to "a later wave", but rev 2 contains no such wave. One spec acceptance criterion (R-5 AC-1) can no longer be met on this Mac, and the Q-D7 gate question presents the choice without the option that D7(b) itself recorded. |
| Quantitative claims | All verified against the code: 75 ops today (27 GET / 48 POST) -> 89 (34/55); 30 -> 39 tables (9 new / 5 changed + 1 CHECK-only); 3 fault-kind CHECK sites; 17 forbidden keys; kept set 8 + 3 = 11; permissions 12 -> 14, grants 18 -> 22; P25 = 12 edits over 36 line anchors, all resolving; errata 31/31; register 94/94; plan 44 W-rows; rev 2 = 65 rows. 70+ `file:line` citations resolved, 0 wrong. |
| Rev 2 PRE-HIL V1-V7 | V1, V2, V3, V4 and V6 PASS. V5 PASS for the DAG (acyclic, 0 forward references), but the §10 wave table contradicts the dependency column in 3 places, and 2 rows can start before their milestone gate. V7 PASS with findings: rows 41-42 repeat work already done, and two rows are very broad. |
| The 6 new questions | Genuinely open: Q-SEC-1, Q-SEC-2, Q-INST-1. Mis-framed: Q-D7. Not user-level (technical, covered by Q-AUTO): Q-SP-4, Q-SEC-3. Missing: how the capture worker is implemented (it must be native code, because the libavfilter API is required). |
| Process integrity | Decisions D1-D16 run without gaps. No commit since `2a4f4ea`, no remote, no stash, no extra branch. No rev-2 artifact or rev-2 source exists. Of the row artifacts listed in `status_tasks.md`, 2 are absent: row 11's skip record (which rev 2 §5.5 cites) and row 14 (deferred, expected). The Drift Log is empty, although D5/D9 require it to be used. Tracker notes are stale for rows 16 and 29. |
| Findings | **0 Blocker, 4 Major, 9 Minor, 5 Nit** (section 6) |

---

## 1. Context (5W1H)

| Dimension | Content |
|---|---|
| **What** | Independent audit of every Kilo planning artifact for task 3. Each claim is tested against the approved plan (D4 plus the rev-1 blueprint at `2a4f4ea`), the predecessor requirements (D219-D233, D260 plus the drift check's 31 errata), and the code baseline `c2c983b`. |
| **Who** | Auditor: verifier (Claude Code, row AU-3 of D16). Audited producers: the Kilo master-controller and its agents (data-analyst, database-specialist, security-review, test-expert, verifier, task-architect). Stakeholder: the user, who must decide the second BLUEPRINT_APPROVAL. |
| **When** | 2026-10-08 05:00-05:30 (+0700). Artifacts dated 2026-10-07 13:22-22:37; decisions log last modified 2026-10-08 05:16 (D16). |
| **Where** | `docs/2026-10-07_dems_real_capture_sealing/` (all phase folders); code under `packages/shared`, `apps/core-server`, `apps/core-web`, `apps/mobile` at HEAD `2a4f4ea` (code identical to `c2c983b` except the rev-1 wave-A test files and `recording-elapsed.ts`). |
| **Why** | The user asked (D16, verbatim): "jangan percaya buta hanya dari laporannya, tapi uji langsung" — do not trust the reports blindly; test them directly. The second gate is MAJOR, so the user needs a correct picture of what rev 2 commits to. |
| **How** | Read-only. Requirement-by-requirement trace with spec-line quotes (§2). Each Kilo deviation classified MINOR/MAJOR against the handoff's own definition (§3). Every count re-derived from the code with grep/sed (§4). V1-V7 re-run with a parser script plus a DAG-vs-wave comparison script (§5). Tracker and artifact existence check, git log/reflog/remote/worktree check (§7). No server started, no test suite run, no install, no secret printed. |
| **Alternatives considered** | (a) Trust the M0 gate (row 39) and the rev-2 self-check. Rejected, because D16 forbids it, and the M0 gate checked internal consistency, not whether D7 dropped approved scope. (b) Run the suites. Out of scope for AU-3 (AU-1 covers code and tests). |
| **Assumptions** | A-1: the rev-1 blueprint at `2a4f4ea` is the approved text (D4). A-2: the `-local` agent labels in artifact front-matter come from the template (§6 AU3-17), not from unlogged fallbacks. A-3: the "MLX uses the Apple GPU" fact is taken from D229 and `07_transcript_spec.md:208`; it is not re-measured here (AU-2's scope). |
| **Gaps** | The test-strategy totals (205 checks, 82 run 2+1, 63 pin files) and the plan's "123/123 spec sections" were sampled, not recounted in full. Whether a whisper.cpp Homebrew install would upgrade shared libraries (as GStreamer would, per D12(d)) is untested, because a dry run was out of scope. This is labelled HYPOTHESIS in REV-1. |

---

## 2. Conformance matrix

### 2.1 Predecessor requirements (D219-D233, D260)

| Req | Requirement (source) | Carried into | Evidence (quote, file:line) | Result |
|---|---|---|---|---|
| D219(1) | Device selector in the Core, editable from web/tablet/phone | R-1; rows 47, 52, 66-68 | "The Core persists which camera feeds `VIDEO-01`/`VIDEO-02` and which microphone is primary/standby. The selector is editable from all three clients" `01_specs.md:139` | PASS |
| D219(2) | Video/audio processing in a worker behind the API | R-2; rows 57-61 | "A separate supervised worker does real capture/processing; the Core controls it over IPC" `01_specs.md:149` (R-2 narrative) | PASS (but see AU3-04: how the worker is implemented is undecided) |
| D219(3) | Block a new session until SEALED | R-6; row 82 | "a new session is blocked until the previous reaches `SEALED`" `01_specs.md` R-6; code today `sim/session-machine.ts:109-111`, `:378-385` (verified) | PASS |
| D220/D221 | One active mic + manual toggle; warn, never auto-switch; hot standby | R-3; rows 71-73 | "The operator toggles the mic manually during recording; each switch is audited" `01_specs.md:159`; "**WARNING only**; the Core warns, the **operator decides**; no automatic switch" `05_capture_architecture_spec.md:506` | PASS |
| D220 | One audio source at playback | R-3/R-4; ux | "One whole file per camera with the single audio track (R-4; OD-21)" `08_client_ux_spec.md:398` | PASS |
| D222 | Transcript inside the sealed package | R-5; rows 78, 79, 83 | "placed inside the sealed package" `01_specs.md:182`; M6-TF-1 "transcript **sealed and verified inside** the package" `10_test_strategy.md:208` | PASS |
| **D222** | **STT on CPU + RAM only** | R-5 AC-1, R-7, C-N1; row 76 | Spec keeps it: "returns a non-empty JSON transcript ... **on CPU**, and the quoted command proves GPU/Metal disabled" `01_specs.md:186`. But the only engine rev 2 runs is "`omlx-server` ... **uses the Apple GPU (Metal) by design**" `07_transcript_spec.md:208`. Rev 2 has no CPU install, conversion or CPU check (`02_structured.md:349`) | **FAIL — AU3-01** |
| D222/D226 | Speaker labels when possible, else flagged | R-5 AC-2; row 78 | "2-speaker labels are either present or the `LABELLED/UNAVAILABLE` flag is set" `01_specs.md:187` | PASS |
| D222/OD-15 | Corrections only as a signed revision | R-5 AC-3; rows 78, 92 | "the original sealed transcript is byte-unchanged" `01_specs.md:188` | PASS |
| D223 | Sealing waits for the transcript; per-step progress; checkpointed; composite on demand | R-6; ev §E; OD-16 | R-6 AC-2/AC-3 `01_specs.md` R-6; "composite side-by-side on demand, marked derived" `01_specs.md:272` | PASS |
| D224/D225 | One WHOLE file per camera with the single audio track; running hash; no multitrack master | R-4; rows 59, 83-85 | "R-4 — One whole fMP4 file per camera with the single audio track" `01_specs.md:168`; superseded list "D223 'master multi-track remux' -> D224, D225" `01_specs.md:293` | PASS |
| D226 | Hardware >= this Mac | R-7 | "The production hardware baseline is at least this Mac (Apple M5 4P+6E, 24 GiB)" `01_specs.md:205` | PASS |
| D229 | Use the on-disk Whisper large-v3-turbo; MLX copy excluded (Apple GPU, conflicts with D222) | E-21; specs superseded table | "MLX fp16 copy of the model -> D229 (Apple GPU only; conflicts with D222 and an x86 Core)" `01_specs.md:297` — but rev 2 adds "the oMLX *server* of D7 is a different artifact and stands" `02_structured.md:54`, although the same objection (Apple GPU) applies to it | PARTIAL — AU3-01 |
| D230 | No benchmark on this Mac; working STT path through a CPU runtime first | R-7 AC-2; N-7 | "No benchmark and no RTF/WER figure anywhere in this contract (D230)" `03_api_contract.md:671`. The "working STT path through a CPU runtime" half is lost (AU3-01) | PARTIAL |
| D231 | Biometric device test skipped | standing invariant | "no biometric steps (D231)" `02_structured.md:159` | PASS |
| D232/D233 | Test depth 2+1; long loops only at handover | test §B.1; rows 44, 53, 64-94 | "2+1 depth for device/browser/spike/DB-gate checks" `02_structured.md:159`; kill matrix "never a loop" row 86 | PASS |
| D260 / E-01 | Three fault-kind CHECKs incl. `health_snapshots` | row 45 | "3 FAULT_KIND sites :281/:382/:488" `02_structured.md:168`; code: all three list the 7 fault kinds (verified, §4) | PASS |
| D260 / E-04 | Capture devices never reuse `AdminResource.DEVICES` | R-1 AC-3; row 47 | "0 uses of `AdminResource.DEVICE[S]` for capture (E-04)" `02_structured.md:170`; code `realtime-messages.ts:156` = paired-client resource (verified) | PASS |
| D260 / E-19/E-24 | Lanes recreated + re-paired per lane | rows 44, 53 | "First M2 row ... lane infrastructure + per-lane pairing" `02_structured.md:167` | PASS |
| D260 reuse patterns | `recording-elapsed.ts` + `core-clock.ts`, `core-queries.ts`, `selection-glow.tsx`, "Checking your permissions..." | rows 67, 68, 72; R-6 AC-2 | "`lib/core-queries.ts` factories WB-11" row 67; "`SelectionGlow` rows (E-15/E-16)" row 68; "derived from Core instants (`coreClockOf`)" R-6 AC-2 | PASS |

### 2.2 D4 gate answers (29) — spec line and rev-2 landing

| ID | D4 default | Spec quote (file:line) | Rev-2 row | Result |
|---|---|---|---|---|
| OD-01 | `AUDIO-01` = session track; `AUDIO-02` legacy; `MIC-01/02` inputs | `01_specs.md:257`; `05_capture_architecture_spec.md:520` | 45, 47, 48 | PASS |
| OD-02 | Regenerate demo v2; reseed `dems_demo` only; `release/` untouched | `01_specs.md:258` | 49, 87 | PASS |
| OD-03 | Per-fragment AES-256-GCM; both hashes | `01_specs.md:259` | 59, 84 | PASS |
| OD-04 | Software Ed25519 behind `Signer`; TPM class C | `01_specs.md:260` | 83 | PASS |
| OD-05 | Both topologies; fakes emulate 2 cameras | `01_specs.md:261` | 65 | PASS |
| OD-06 | AAC-LC 48 kHz mono; `AudioInputAdapter`; USB assumption | `01_specs.md:262` | 58, 65 | PASS |
| OD-07 | `PoeController` + SNMP adapter + fake | `01_specs.md:263` | 65 | PASS |
| OD-08 | Seal the durable part, flagged interrupted | `01_specs.md:264` | 79, 82 | PASS |
| OD-09 | Hot standby; toggle for session holder + SUPERVISOR; web-only recording "no" | `01_specs.md:265`; op 81 "the operator who created the open session, or any SUPERVISOR" `03_api_contract.md:179-180`; SUPERVISOR holds `SESSION_START` (`sim/auth.ts:47,55-57`, verified) | 48, 71, 72 | PASS |
| OD-10 | `CAPTURE_CONFIG` for SUPERVISOR + TECHNICIAN; idle only | `01_specs.md:266`; `03_api_contract.md:144` | 47, 66 | PASS |
| OD-11 | -50 dBFS / 10 s -> `MIC_SILENT`; 2 s debounce; never auto-switch | `05_capture_architecture_spec.md:506-507` | 48, 71 | PASS |
| OD-12 | No live preview of real cameras | `01_specs.md:268` | 67, 68 | PASS |
| OD-13 | Keep loopback; LAN class C | `01_specs.md:222` (C-N4); RTSP ingest pinned `127.0.0.1` `05_capture_architecture_spec.md:165` | invariant; 60 | PASS |
| OD-14 | P25 waiver limited to 4 categories, each edit reviewed | `05_capture_architecture_spec.md` §I (12 edits, all anchors verified §4) | 57, 58, 63 | PASS |
| OD-15 | `TRANSCRIPT_REVISE` INVESTIGATOR + SUPERVISOR; Core key signs | `01_specs.md:271`; `03_api_contract.md:181` | 47, 78, 92 | PASS |
| OD-16 | Decrypted copy + manifest + signature; composite derived; encoder after a licence check | `01_specs.md:272`; "chosen **after a licence check in M8**" `06_evidence_package_spec.md:631` | 91 | PARTIAL — row 91 omits the licence check (AU3-13) |
| OD-17 | Simulator emulates v2; offline 0.2.0 | `03_api_contract.md:64` | 50, 51 | PASS |
| OD-18 | Fault injection + scenario load disabled in real mode | `01_specs.md:274` | 52 | PASS |
| OD-19 | Block reset with real packages; capture tables kept | `04_database_contract.md` §E.1/E.2 | 54 | PASS |
| OD-20 | Indonesian only; diarization + VAD downloads after licence check | `01_specs.md:276`; sherpa-onnx route `01_specs.md:337` | 77, 78 | PASS |
| OD-21 | fMP4; fallback designed; legal confirmation before handover | `01_specs.md:277` | 59, 86 | PASS (legal still open, correctly carried) |
| OD-22 | PoE-cycle only a lost-stream camera | `03_api_contract.md:65` | 48, 65 | PASS |
| OD-23 | Retire SC8; Simulated regression vs `c2c983b` at M2 + M9 | `01_specs.md:279` | 51, 56, 95 | PASS |
| **OD-24** | whisper.cpp (Homebrew); conversion venv under `.cache/` | `01_specs.md:280` (with the D7 amendment); "Install: Q-INSTALL item 1 (Homebrew `whisper.cpp` ...)" `07_transcript_spec.md:225` | **none** — row 76 codes the backend but no row installs, converts or runs it | **FAIL — AU3-01** |
| OD-25 | All media in git-ignored paths | G-R6 `05_capture_architecture_spec.md:542`; `.gitignore:47` `.cache/`, `:70` `/.data/` (verified with `git check-ignore`) | invariant | PASS |
| OD-26 | Minimal edits now; big refactors after M9 | `01_specs.md:282`; B5/B6/B7 "not scheduled" `02_structured.md:274-276` | 51, 97 | PASS |
| Q-AUTO | Autonomy; stop at gates / MAJOR / installs / hardware / handover | `01_specs.md:283` | process | PASS — Kilo stopped at the second gate; no rev-2 row executed (§7) |
| **Q-INSTALL** | Blanket items 1-6, uninstall logged | `01_specs.md:284` | "item 1 -> D7 reuse (row 10 done, no install)" `02_structured.md:349` | **FAIL — AU3-01** (item 1 silently retired; contradicts D7(b) and `07_transcript_spec.md:225`) |
| Q-HW | Unknown; class C deferred | `01_specs.md:285` | section 9, row 105 | PASS |

### 2.3 Forbidden patterns (each searched across all ten masterplan files)

| Pattern | Hits | Verdict |
|---|---|---|
| Multitrack master / two audio tracks | Only in the superseded table (`01_specs.md:293`), the N-8 negation (`03_api_contract.md:672`), legacy v1 `AUDIO-02` (tamper demo, 4-value CHECK unchanged `04_database_contract.md:548`) | None live |
| Automatic mic switch | Every hit is a negation ("never auto-switch") | None |
| Benchmark on this Mac | Only negations and class-C C-7 | None |
| Media in git | Only the G-R6 prohibition | None |
| Reuse of `AdminResource.DEVICES` | Only prohibitions (`01_specs.md:145`, `05_capture_architecture_spec.md:541`, `08_client_ux_spec.md:590`) | None |
| LAN listener | Only class C-5 and the SEC35-23 pin to `127.0.0.1` | None |

---

## 3. Kilo deviations — recorded? MINOR or MAJOR?

The handoff defines MAJOR as "new scope, different agents, effort > 30 %, contradicting D4" (`report/report.md:116`).

| Decision | What changed | Recorded | Classification by Kilo | Audit classification | Note |
|---|---|---|---|---|---|
| D5(b) local-first tiering | Every row resolved to a `*-local` agent variant, including verification-phase agents | D5 | none stated | **MAJOR by the handoff's own rule ("different agents"), taken without asking** — closed because the user's own D9 reversed it | Affected rows 3-5 only (row 5's B2 triage was re-reviewed by the paid row 24). Drift Log entry missing (AU3-11). |
| D5(c) 4 per type / 8 total | Concurrency below the global 8 per type | D5 | — | Within approval (a ceiling, not a target) | OK |
| D7 STT reuse | Rows 10-12 re-scoped from "install whisper.cpp + convert + CPU-only check" (rev 1 `2a4f4ea` rows 10-12) to oMLX on Metal; row 11 skipped; `TranscriberAdapter` with two backends | D7, D10(d) | MINOR, "flagged for confirmation at the second blueprint gate" | **Reuse = authorised by the user (D7 is the user's instruction). Dropping the CPU path = MAJOR (contradicts D4 OD-24/Q-INSTALL and D222/D230), and it was never put to the user as such** | D7(b) itself kept the CPU path ("NOT cancelled ... install moves to a later wave"). Rev 2 then removed it (`02_structured.md:349`). See AU3-01. |
| D9 paid-first | Agent tier | D9 | user instruction | Within approval | OK |
| D10(c) GStreamer becomes comparison-only | Row 14's purpose changed after spike S2 | D10(c) | implicit MINOR | MINOR — evidence-driven; R-3 is satisfied through the libavfilter API | OK |
| D10(e) row 16 "no change required" | Approved row closed without an edit | D10(e) | — | MINOR, well evidenced | Not in the Drift Log (AU3-11) |
| D12(d) GStreamer install deferred | Approved Q-INSTALL item 3 not executed (would have upgraded 11 shared libraries under oMLX/ffmpeg/openjdk) | D12(d) | controller decision, surfaced to the gate | Correct application of the red line (hard-to-reverse change needs confirmation); asked as Q-INST-1 | OK |
| D14(c) op 89 added; SEC35-16 applied provisionally | Registry 88 -> 89; REAL-evidence scope narrowed in spec text | D14(c)/(d) | MINOR + flagged | MINOR for the count. The scope narrowing correctly goes to the user as Q-SEC-1; spec-only, no code | OK |
| Rev 2 itself | 65 implementation rows | D15(d) | MAJOR | Agree — MAJOR, and the stop was honoured | OK |

**Answer to the D7 question in the brief.** Is the `cpu-local` / whisper.cpp path for the Core still concretely planned, with rows, tests and an install step? **No.**

- **Rows:** row 76 only says "cpu-local backend code-complete behind the interface" (`02_structured.md:199`). No row installs whisper.cpp, converts the model, or runs the backend.
- **Tests:** M6-AD-1 is a one-run contract unit test of the document shape (`10_test_strategy.md:212`). M6-TF-1 dropped the "on CPU / GPU disabled" clause of R-5 AC-1 (`10_test_strategy.md:208` vs `01_specs.md:186`). M6-DF-1, the "no dropped fragment while STT runs" check, would run against the GPU engine (`10_test_strategy.md:209`). That gives no evidence about the risk it exists for: CPU STT starving capture, RK-1, which `report/report.md:106` names.
- **Install step:** retired at `02_structured.md:349`. That contradicts `07_transcript_spec.md:225` and `research/10_spike_stt_functional_check.md:58-61` ("remains the deferred Q-INSTALL item 1 wave").
- **Consequence:** whisper.cpp would first run on the real Core device (class C-7), after the "done on this Mac" line.

---

## 4. Quantitative claims checked against the code (all read-only)

| Claim (source) | Command / evidence | Measured | Result |
|---|---|---|---|
| Registry 75 ops today (`03_api_contract.md:650`) | 13 `*_OPERATIONS` arrays + 10 entries in `core-api.ts:599-881`. 76 `operationId:` lines, of which `storage.ts:180` is inside a 403 error example. Tests pin 75 (`permission-guard/__tests__/guard.test.ts:251`, `matrix.test.ts:35`, `access-rules.test.ts:57,59`) | **75** | PASS |
| 27 GET / 48 POST today -> 34 / 55 (`03_api_contract.md:650`) | `grep -hE "^\s+method: '"` -> 27 get / 48 post. New ops 76-89: GET 76, 77, 82, 83, 84, 86, 87 (7); POST 78-81, 85, 88, 89 (7) | 34 / 55 | PASS |
| 75 -> 89 (brief said 88) | 14 new ops listed at `03_api_contract.md` §1; op 89 added by SEC35-01 (D14(c)) | 89 | PASS — 88 is superseded; rev 2 uses 89 throughout |
| OpenAPI `all` 0.2.1 at `openapi.ts:106`; `offline` 0.1.0; offline = 10 ops | `openapi.ts:102`, `:106`; "the ten operations a client can call without the Core server" `openapi.ts:224` | 0.2.1 / 0.1.0 / 10 | PASS |
| 30 tables today -> 39 | `grep -c '^CREATE TABLE' 0001_tables.sql` | 30 | PASS |
| 9 new / 5 changed tables (+1 CHECK-only) | `04_database_contract.md:60-69` reconciliation; the 5 changed tables (`active_session`, `evidence_items`, `evidence_tracks`, `alerts`, `session_history`) all exist in 0001 | 9 / 5 (+`health_snapshots`) | PASS |
| 3 fault-kind CHECK sites `:281/:382/:488` | sed of each line: all three list `CAMERA_LOSS, MIC_CLIP, MIC_NO_SIGNAL, POWER_FAIL, STORAGE_FULL, STORAGE_LOW, TPM_FAILURE` (`session_history_outcome_check`, `alerts_kind_check`, `health_snapshots_cause_check`) | 3 | PASS |
| Other CHECK citations `:199, :220, :260, :335, :336, :338, :340, :354` | Each line is the named constraint (`audit_log_details_no_secret_keys_check`, `events_params_no_secret_keys_check`, `active_session_json_check`, `evidence_items_hashes_check`, `evidence_items_signature_check` = `SIMULATED-SHA256`, `evidence_items_tamper_check`, `evidence_items_sources_check`, `evidence_tracks_values_check`) | 8/8 | PASS |
| Forbidden keys 17 -> 25 | `ARRAY[...]` at `:199` has 17 entries | 17 | PASS |
| Kept set 11 = 8 + 3 | `apps/core-server/src/db/reset/kept-tables.ts:62-71` lists 8 | 8 + 3 | PASS |
| v2 seed 14 permissions / 22 grants | `packages/shared/src/sim/auth.ts:45-71`: 12 permissions, 4 + 10 + 4 = 18 grants; + `CAPTURE_CONFIG` x2 + `TRANSCRIPT_REVISE` x2 | 14 / 22 | PASS |
| P25 = 12 edits by file:line | 36 anchors resolved (header `app.ts:6`, `config.ts:8`, `index.ts:16`; `app.ts:81/93/94/122/129/132/136/145/146/238/245/246/289/310/311/347/354/355`; `config.ts:36/38/147/162/163/216/227/228/237/268/270`; `index.ts:82/83/106/107`). Each is the described construct (e.g. `app.ts:289` `const UNITS`, `index.ts:106` `await app.readiness.boot()`, `:107` `await app.listen`). Frozen files unchanged vs `c2c983b` | 12 edits / 36 anchors / 0 wrong | PASS |
| Errata 31/31 (`research/03_analysis.md` §A) | unique `^\| E-nn \|` = 31 (E-01..E-31); drift check also 31 `E-` rows | 31 | PASS |
| Register 94/94 | unique ids: SH 25, CS 25, WB 11, MB 13, DOC 6, NM 14 | 94 | PASS |
| Plan 44 W-rows (40 A/B + 3 C + 1 cond) | M2 10, M3 6, M4 5, M5 3, M6 4, M7 6, M8 4, M9 5, G 1; class C = M4-W5, M8-W4, M9-W5; plan §C has 19 waves, max 4 | 44 | PASS |
| Rev 2 = 65 rows, split 3+13+8+6+5+6+8+5+7+3+1 | parser: steps 41-105 contiguous, 65 rows; sum = 65 | 65 | PASS |
| Spec citations sampled | `realtime-messages.ts:156` (`AdminResource`), `enums.ts:132-140` (`TrackId` 4 values), `live-sim.ts:902-905` (`onMeters`), `error-sink.ts:52` and mobile `runtime/log.ts:46` (credential blanking regex), `recording-elapsed.ts:129` (resolves at `c2c983b`; file changed by row 22), `examples.ts:268`, `devices.ts:126`, `sim/evidence.ts:4-9`, `:304`, `demo-alignment.ts:39-41`, `demo-evidence/README.md:44`, `session-machine.ts:109-111`, `:378-385`, `:705`, `modules/devices/operations.ts:42-52`, `navigation/stacks.tsx:59`, `audit-details.ts:140` (file is 140 lines), `use-monitor.ts:165/:244`, `session-live-screen.tsx:236`, `dashboard/devices-panel.tsx:24/:258`, `evidence/integrity-tab.tsx:52/:295`, `.gitignore:47/:70` | 25 sampled + the 36 P25 anchors + 11 SQL lines | 0 wrong | PASS |

---

## 5. Rev 2 PRE-HIL V1-V7 (re-run by this audit)

Method: a parser over `identification/02_structured.md:164-228` that splits on unescaped `|`, plus a DAG-level script comparing the Depends On column with the §10 wave table. Scripts are in the session scratchpad and read-only.

| Check | Result | Evidence |
|---|---|---|
| **V1** 7 columns, escaped pipes | **PASS** | 65/65 rows parse to exactly 7 cells; `[M2\|B]` prefixes are escaped |
| **V2** Step/Task/Agent/Output/Depends/Verification/Phase populated | **PASS** | 0 empty cells |
| **V3** Agents exist in `~/.claude/agents/` | **PASS** | {coder-execution 38, senior-code-reviewer 8, verifier 8, data-analyst 4, test-expert 3, database-specialist 2, security-review 1, task-architect 1}; all 8 files exist |
| **V4** Standard phases | **PASS (1 Nit)** | Phases used: masterplan, implementation, gateway_check, test, initialization, research. Row 105's phase `masterplan` does not match its output `identification/02_structured.md` (AU3-18) |
| **V5** Dependencies exist and are acyclic | **PASS for the DAG; findings on scheduling** | 0 forward or self references. Non-row tokens: `R1` (rows 41-43, 45), `Q-INST-1 = approve` (102), `Q-HW arrival OR handover announcement` (105) — acceptable gate tokens. **But** the §10 wave table contradicts the dependency column: row 65 in W11 depends on row 64 in W16; row 71 in W13 depends on row 70 in W17; row 76 sits in the same wave (W8) as its dependency row 57 (AU3-05). Rows 84 (M7, depends only on 59) and 91 (M8, depends only on 83) are released by the DAG before the M3 gate (64) and the M7 gate (89) respectively (AU3-06). |
| **V6** One distinct output per row | **PASS** | 0 duplicate output paths; the reserved paths `implementation/29/46/49` are unused |
| **V7** Atomicity | **PASS with findings** | Rows 41/42 describe work already applied in W12 (AU3-07). Row 46's Verification adds "B16 code-side message fix included", which is not in its Task (AU3-14). Rows 48 and 58 bundle many concerns (row 48: 14 ops + 24 modified + 9 codes + 9 audit types + constants + `SESSION_HOLDER` + the credential path) — single owner, but very large (AU3-14) |
| Test depth 2+1 | **PASS** | Device/browser/spike/DB-gate checks state 2 runs + 1 at the gate (rows 44, 53, 56, 64, 70, 72, 73, 75, 81, 86, 87, 89, 92, 94); suites run once per workspace per checkpoint; kill matrix = distinct cells, no loop |
| 8-agent ceiling | **PASS** | Max 4 rows per wave, 4 same-type (W5). The real DAG levels also peak at 4 coder-execution (levels 3, 4, 16) |
| No biometric / PIN / push / sudo rows | **PASS** | Standing invariant `02_structured.md:159`; sweep clean |

---

## 6. Findings

Severity: **Blocker** = must not proceed; **Major** = fix before presenting rev 2 for approval; **Minor** = fix in the rev-2 text or tracker, does not change the decision; **Nit** = cosmetic.

| ID | Sev | Finding | Evidence (quote, file:line) | Proposed revision |
|---|---|---|---|---|
| **AU3-01** | **Major** | **The approved CPU-only STT path has disappeared from execution.** Rev-1 rows 10-12, approved under D4, installed whisper.cpp, converted the model and ran a "CPU only ... GPU/Metal disabled" check (`git show 2a4f4ea:.../02_structured.md` rows 10-12). D7 re-scoped them to oMLX (Metal) and promised the CPU path would "move to a later wave". Rev 2 has no such wave and retires Q-INSTALL item 1. R-5 AC-1 ("on CPU, ... GPU/Metal disabled") therefore cannot be met on this Mac. The M6 checks were weakened to fit: M6-TF-1 without the CPU clause, and M6-DF-1 measured against the GPU engine. D222 ("STT full compute di cpu + ram") is never shown working before the "done on this Mac" line. | "item 1 -> D7 reuse (row 10 done, no install)" `02_structured.md:349`; "cpu-local backend code-complete behind the interface" `:199`; D7(b) "is NOT cancelled ... the install moves to a later wave" `decisions.md:13`; "Install: Q-INSTALL item 1" `07_transcript_spec.md:225`; R-5 AC-1 `01_specs.md:186`; "uses the Apple GPU (Metal) by design" `07_transcript_spec.md:208`; M6-TF-1/M6-DF-1 `10_test_strategy.md:208-209` | **REV-1:** (a) Add an M6 row before 77: whisper.cpp install (Q-INSTALL 1). First run `brew install --dry-run whisper-cpp` and apply the D12(d) guard — stop if shared libraries would be upgraded. Whether that happens is a HYPOTHESIS, not tested. (b) Add the model conversion into the isolated `.cache/` venv (Q-INSTALL 2), or record the ggml download alternative. (c) Add a `cpu-local` functional check, 2+1, with `-ng` quoted. (d) Restore the CPU clause in M6-TF-1, and run M6-DF-1 on `cpu-local`. (e) Fix `02_structured.md:349`, §1.2 D222 and §1.3 line 54. (f) Reframe Q-D7 (AU3-02). |
| **AU3-02** | **Major** | **Q-D7 is mis-framed for the user.** It offers (a) reuse oMLX, nothing more, or (b) "reject reuse ... (needs the whisper.cpp install now)". It leaves out the option D7(b) already recorded: oMLX for development plus a proven CPU path on this Mac. It also says "both backends already coded" while nothing has been coded. A user choosing the default (a) would unknowingly push the first CPU run to class C. | Q-D7 row `02_structured.md:361`; "(both backends already coded behind one interface)" ibid.; plan F-6 `02_plan.md:418` | **REV-2:** Rewrite Q-D7 with three options: (a) reuse oMLX only, CPU path first proven on the Core device (state plainly that D222 stays unproven on this Mac); (b) **recommended, consistent with D7(b):** oMLX for development **plus** whisper.cpp `cpu-local` installed and functionally checked on this Mac (REV-1 rows; installs already blanket-approved); (c) `cpu-local` only. Remove "already coded". |
| **AU3-03** | **Major** | **Internal contradiction across the spec suite about the CPU path.** Specs R-5 AC-1 and C-N1 require CPU proof. The transcript spec keeps the Q-INSTALL item 1 install. Row 12's report says "deferred Q-INSTALL item 1 wave". Rev 2 says no install. The M0 gate (row 39) passed this as "STT-5 CPU/GPU clause handled", meaning the deferral was documented — not that a later row exists. | `01_specs.md:186`, `:219`; `07_transcript_spec.md:225`; `research/10_spike_stt_functional_check.md:58-61`; `gateway_check/04_m1_spike_gate.md:83`; `02_structured.md:349` | Resolved by REV-1/REV-2. Additionally, the M6 gate (row 81) must quote the CPU-run command. |
| **AU3-04** | **Major** | **How the capture worker is implemented is undecided, and it is not on the gate list.** S2 showed the bare FFmpeg CLI cannot switch the mic; the libavfilter API can. So `apps/capture-worker` must be native code or use a binding. The engine pick leaves it as "C or a thin FFI binding". Row 58 says only "FFmpeg embedded". Each choice carries a standing-rule consequence: a hand-built C component needs a recorded decision under the user's ready-made-frameworks rule; an npm native binding is a new dependency under `allowScripts` and B2 that is not on the Q-INSTALL list. In both cases the GPL FFmpeg build must be linked or shipped (`research/12:74`). H-4 (one encoder feeding both files) is also unspiked. | "Embedded **libavfilter** process (C or a thin FFI binding)" `research/12_spike_s3_media_engine_pick.md:101`; row 58 `02_structured.md:181`; H-4 `05_capture_architecture_spec.md:611`; memory rule "Hand-write a component only when no kit covers it, and record that as a decision" | **REV-3:** Add to G-2 a question (or a design row before 58, recorded as a decision) "Q-WORKER: worker form": (a) a small C program linking libav* (the S2 `opswitch.c` precedent); (b) a maintained Node binding (name the package, licence and native-build/`allowScripts` impact). Make row 58's first deliverable a 2+1 proof of H-4 (two fake RTSP + switched AAC into two files) before the rest of M3. |
| AU3-05 | Minor | §10 wave table contradicts Depends On: M4 rows 65-69 are placed before the M3 gate (64), M5 rows 71-74 before the M4 gate (70), and row 76 in the same wave as its dependency 57. The claimed per-wave single-writer analysis is therefore built on a schedule that cannot happen. | `02_structured.md:406-417` vs rows 65 (deps 64, 58), 71 (deps 70, 59), 76 (dep 57) | Recompute §10 from the DAG levels (this audit's script gives 30 levels, max 4 coder-execution), or state that the Depends On column overrides the wave table and drop the per-wave resource claims. |
| AU3-06 | Minor | Rows 84 (M7 encryption) and 91 (M8 export) can launch before their milestone gates. Row 84 depends only on 59, so it can start before the M3 gate. Row 91 depends only on 83, so it can start before the M7 gate. This contradicts "Each milestone ends in a verification gate". | rows 84, 91 `02_structured.md:207,214`; §6 `:234` | Add dependency 64 (or 81) to row 84 and 89 to row 91, or record the early start as an intended CF-7-style exception. |
| AU3-07 | Minor | Rows 41 and 42 describe work already applied in W12. Row 42's path is already singular at `05_capture_architecture_spec.md:499`. Row 41's count lines are already 89/55/13/62/40 (`10_test_strategy.md:137-143`). Only the P-4 gate-file renumber remains (`10_test_strategy.md:56,120,262` still read `06_m2_gate`/`13_m9_gate`). | D15(c); W12 row in `delegation_progress_report.md` | Re-scope row 41 to the P-4 renumber only. Mark row 42 done (W12) or remove it, and drop it from row 44's dependencies. Row 43 (C-N4 clause, still absent at `01_specs.md:222`) stays. |
| AU3-08 | Minor | The "DONE ON THIS MAC" line is defined three ways: "rows 41-101" `:114`, "rows 41-94 gates green" `:247`, "rows 41-101 green" `:448`. | `02_structured.md:114, 247, 448` | Use one definition (41-101, which includes the M9 chain). |
| AU3-09 | Minor | Rev 2 §5.5 cites a row-11 skip record `research/09` that does not exist. The skip is recorded only in D7/D10(d). | `02_structured.md:125`; `ls research/` (no 09) | Point to D7/D10(d), or have the controller write a short skip record. |
| AU3-10 | Minor | The status tracker is stale. Row 16 still reads "W2 launched (paid)" although D10(e) closed it "no change required". Row 29 still reads "13 new ops (75+13=88) ... 7 audit types". | `status_tasks.md:31`, `:44` | Controller update: row 16 = done, no change required (D10(e)); row 29 = 89 ops, 14 new, 9 audit types (D14(c)). |
| AU3-11 | Minor | The Drift Log is empty although D5(b)/D9 require fallbacks to be logged there, and the planned-vs-actual deviations are real: D5(b) local-first, row 10-12 re-scope (D7), row 11 skip, row 16 premise false, rows 13/14 deferral, the SEC35-16 provisional scope. | `decisions.md:30-33` | Add one Drift Log row for each. |
| AU3-12 | Minor | D5(b) changed the agent of every row to `*-local`, including verification-phase agents, without asking. By the handoff's own definition, "different agents" is MAJOR. It was reversed by the user's D9; it only affected rows 3-5. | D5 `decisions.md:10`; `report/report.md:116`; global rules §11 rule 1 | Record as a closed MAJOR deviation in the Drift Log. No re-run needed: row 5's output was re-reviewed by the paid row 24. |
| AU3-13 | Minor | OD-16's "encoder after a licence check" is missing from row 91. The installed FFmpeg is a GPL build. | row 91 `02_structured.md:214`; `06_evidence_package_spec.md:631`; `research/12:74` | Add "composite encoder chosen only after the M8 licence check recorded in DOC-05" to row 91's Task and Verification. |
| AU3-14 | Minor | Atomicity. Row 46's Verification mentions "B16 code-side message fix included", which its Task does not contain. Rows 48 and 58 are very broad for one delegation. | rows 46, 48, 58 | Move B16 into row 46's Task. Consider splitting row 48 (registry/ops vs audit/errors/constants) and row 58 (after REV-3). |
| AU3-15 | Nit | Q-SP-4 is a technical constant, not a user decision. Plan F-5 assigned its confirmation to the M0 gate, which confirmed it (`05_m0_spec_gate.md:190`). It is tunable by a one-constant edit and sits inside OD-21 and Q-AUTO. | `02_plan.md:417`; `02_structured.md:360` | Move to G-3 as a controller decision recorded in the decisions log, or keep it with the plain note "technical; default needs no action". |
| AU3-16 | Nit | Q-SEC-3 asks the user to approve a deviation from D-DB-07, but D-DB-07 is the row-30 agent's own design rule ("no new DB roles"), not a user decision. | `04_database_contract.md:818`, `:281` | Keep as information, or decide under Q-AUTO with security-review sign-off and record it. |
| AU3-17 | Nit | Artifact front-matter says `agent: data-analyst-local` (rows 6, 28, 29, 31, 32, 37, remediation) while the delegation report says the paid `data-analyst` ran them. The paid template hard-codes that label. | `~/.config/kilo/agent/data-analyst.md:106,173`; `delegation_progress_report.md` W2-W9 | Correct the provenance label in the template or the artifacts. No re-run needed. |
| AU3-18 | Nit | Row 105's phase `masterplan` does not match its output `identification/02_structured.md`. | `02_structured.md:228` | Phase `identification`, or keep it and note the exception. |
| AU3-19 | Nit | Blank lines inside the decisions table (between D4/D5, D6/D7, D8/D9, D9/D10, D12/D13, D13/D14, D14/D15) split it into header-less tables in most renderers. | `decisions.md:9,12,15,17,20,22,24,26` | Remove the blank lines. |

No Blocker: the structure, counts, citations and gate discipline are sound, and nothing outside rev 1 has been executed.

---

## 7. Process integrity

| Check | Result | Evidence |
|---|---|---|
| Decisions log continuity | PASS | D1-D16 sequential, none missing. D16 is this audit's mandate. Drift Log empty (AU3-11). |
| Every row artifact in `status_tasks.md` exists and is non-empty | 38/40 PASS | Absent: `research/09_spike_stt_model_conversion.md` (row 11 SKIPPED; rev 2 §5.5 still cites it, AU3-09) and `research/11_spike_gstreamer_prototype.md` (row 14 DEFERRED, expected). `find . -type f -empty` = none. Delegation records: 42 files, matching the report's counter. |
| Delegation report rows | PASS with note | W1-W12 rows match the decisions; the provenance label differs (AU3-17). Folder counts match (identification 3, research 10, masterplan 10, initialization 3, implementation 8, gateway_check 6, test 1). |
| Nothing committed or pushed | PASS | `git log` HEAD = `2a4f4ea`; reflog shows no entry after 2026-10-07 13:22; `git remote` = 0; `git stash list` empty; one branch `main`; worktree `.kilo/worktrees/immense-slime` at `2a4f4ea` (detached, idle, per D6). |
| No rev-2 row executed | PASS | No `implementation/09..50`, no `gateway_check/07..24`; `apps/` = core-server, core-web, mobile, mock-core (no `capture-worker`, no `transcriber`). Non-test source change = `apps/mobile/src/runtime/recording-elapsed.ts` only (row 22). |
| Secrets | PASS | Sweep of the task docs for API-key, bearer and `sk-` value patterns: 0 files. No value printed. |
| Media in git | PASS | `.gitignore:47`/`:70` cover `.cache/` and `/.data/` (`git check-ignore -v` confirmed). |

---

## 8. The six new questions — genuinely open or already answered?

| ID | Status per this audit | Reason |
|---|---|---|
| Q-SEC-1 (SEC35-16 narrowed REAL-evidence view) | **Genuinely open** | Changes effective role power; OD-10/OD-15 do not cover it. Keep. |
| Q-SEC-2 (no key escrow) | **Genuinely open** | A custody policy with irreversible consequences (lost key = unreadable evidence); no D4 answer covers it. Keep. |
| Q-SEC-3 (reveal mitigation vs D-DB-07) | **Technical, not user-level** | D-DB-07 is the row-30 agent's own rule (`04_database_contract.md:818`). Can be decided under Q-AUTO with security-review sign-off (AU3-16). |
| Q-INST-1 (GStreamer 11 shared-library upgrades) | **Genuinely open** | D4's blanket approval did not foresee upgrading another project's libraries (D12(d) correct). Default (c) "keep deferred" is sound, since R-3 is met through libavfilter. |
| Q-SP-4 (fragment quantum GOP 50 / 2000 ms) | **Answered** (OD-21 + Q-AUTO; M0 gate confirmed) | Technical, tunable constant (AU3-15). |
| Q-D7 (TranscriberAdapter split) | **Partly answered by D7 itself; the open part is mis-asked** | The user's D7 already settles "use what is installed on this Mac for development". What remains open is whether the CPU-only path must be proven on this Mac before the Mac-complete line — and the question leaves out that option (AU3-02). |
| (missing) Q-WORKER | **Should be added** | Whether the capture worker is a C program or uses a binding; affects install/dependency and licence rules (AU3-04). |

---

## 9. Verdict

**Rev 2 is not ready for the user's second approval as written.** The structure is sound: V1-V4 and V6 pass, the DAG is acyclic, every count and citation checks out, and the gate discipline was honoured. But at the decision point the user would approve a plan that quietly removes the CPU-only STT path they asked for (D222/D230) and approved (D4 rows 10-12), with a gate question whose default hides that consequence.

**Revisions before presenting rev 2** (document-only; owner task-architect for the blueprint and data-analyst/test-expert for the spec lines; nothing executes):

1. **REV-1** (AU3-01/03): add the whisper.cpp install (with dry-run guard), the conversion and a `cpu-local` functional check 2+1 to M6; restore the CPU clause in M6-TF-1; run M6-DF-1 on `cpu-local`; fix `02_structured.md:349`, `:54`, §1.2.
2. **REV-2** (AU3-02): rewrite Q-D7 with three options; recommended default = oMLX for development + proven `cpu-local` on this Mac.
3. **REV-3** (AU3-04): add Q-WORKER (or a recorded design row) and make an H-4 proof the first deliverable of row 58.
4. **REV-4** (AU3-05/06/07): recompute §10 from the DAG; add gate dependencies to rows 84/91; re-scope row 41 to P-4 only and mark row 42 done.

The Minor/Nit items (AU3-08..19) can be fixed in the same pass, or by the controller in the trackers and decisions log. After REV-1..REV-4, rev 2 can be put to the user with seven questions: Q-SEC-1, Q-SEC-2, Q-INST-1, the reframed Q-D7, Q-WORKER, plus Q-SP-4 and Q-SEC-3 as informational defaults.

---

## 10. Evidence log (commands run, all read-only)

| # | Command (abridged) | Key output |
|---|---|---|
| 1 | `git log --oneline -8; git remote -v; git reflog; git worktree list; git stash list` | HEAD `2a4f4ea`; 0 remotes; no reflog after 2026-10-07 13:22; 1 idle Kilo worktree |
| 2 | `git diff --quiet c2c983b -- packages/shared/src/api apps/core-server/src/db/migrations apps/core-server/src/{app,config,index}.ts` | unchanged |
| 3 | `grep -hoE "^\s+operationId: '" packages/shared/src/api/*.ts \| wc -l` -> 76; `sed -n 180p storage.ts` -> inside a 403 example; tests pin 75 | 75 ops |
| 4 | `grep -hE "^\s+method: '" *.ts \| sort \| uniq -c` | 27 get / 48 post |
| 5 | `grep -cE '^CREATE TABLE' 0001_tables.sql`; `sed -n {199,220,260,281,335,336,338,340,354,382,488}p` | 30 tables; all named constraints present |
| 6 | P25 anchor loop over 36 `file:line` | all resolve to the described construct |
| 7 | `grep -oE "^\| (SH\|CS\|WB\|MB\|DOC\|NM)-[0-9]+ \|" research/03_analysis.md \| sort -u` | 25/25/11/13/6/14 = 94; E-01..E-31 = 31 |
| 8 | `python3 -I v17.py 02_structured.md` (V1-V7 parser) | 65 rows, 7 cols, 0 empty, agents valid, 0 forward refs, 0 dup outputs, 1 phase/output mismatch (105) |
| 9 | `python3 -I waves.py 02_structured.md` (DAG vs wave table) | conflicts: 65->64, 71->70, 76->57; DAG max 4 coder-execution per level |
| 10 | `git show 2a4f4ea:.../02_structured.md \| grep '^\| (10\|11\|12) \|'` | rev-1 rows 10-12 = install whisper.cpp / convert / CPU-only check |
| 11 | `git check-ignore -v .data/x.mp4 .cache/spikes/s1/a.mp4` | `.gitignore:70`, `:47` |
| 12 | Existence loop over the 41 tracker artifacts; `find . -type f -empty` | 2 absent (row 11, row 14); 0 empty |
| 13 | `grep -n agent: ~/.config/kilo/agent/data-analyst.md` | template lines 106/173 carry `agent: data-analyst-local` |

---
*Generated: 2026-10-08 05:27*
*Last Updated: 2026-10-08 05:40*
