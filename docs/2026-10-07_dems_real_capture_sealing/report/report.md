# DEMS task 3 — real capture, sealing v2, transcript: FINAL REPORT

**Prepared by:** the Claude Code master controller, 2026-10-14 · **Completion line:** "DONE ON THIS MAC WITH FAKE DEVICES" (blueprint rows through 101; rows 102-105 are outside the line) · **Final commit:** `64a4858` on `main` (the code; this report and the closing notes follow in one documentation commit) (local; no remote, nothing pushed) · **Source of detail:** `decisions/decisions.md` D1-D248, `status_tasks.md`, the reports named below.

## 1. Highlight

Real capture on generated test sources works end to end on this Mac — record on two cameras with one switchable microphone, seal an encrypted, signed package with the transcript inside, verify it, play it, revise its transcript, export it and check the export as a receiver — from the web console, the tablet and the phone. All milestone gates stand at PASS WITH CONDITIONS, the final chain reported (verification PASS WITH CONDITIONS, security CAUTION with 0 critical, tests GREEN, code review YES WITH CONDITIONS), the UI was judged by four judges and re-judged by three in the normal launch form ("yes, with reservations" on every surface), and the last whole regression is green: 16 steps, 17,993 tests, kill matrix 35 of 35, capture-worker series 122 as expected / 0 unexpected.

It is NOT a product ready for a real installation: one requirement is not met (composite export), real cameras and microphones were never driven by an agent, a production Core cannot be brought up from the seed, and several decisions are the user's and still open (section 6).

## 2. What was built (and where it is proven)

| Area | Built | Proven by |
|---|---|---|
| Capture | capture worker 0.5.0 (C + FFmpeg), protocol 4, supervisor, fragmented MP4 per camera with hash chains, one active microphone with a manual switch and standby, modes SIMULATED / REAL_DEVELOPMENT / REAL_PRODUCTION with a fence | gates `08` (M3), `10e` (M5); kill matrix; worker e2e series |
| Selector, discovery, connect | capture selector on web / tablet / phone; camera search; the credential workflow (credentials typed only on the web console, never stored in the clear); adoption; no-device notifications A and B; local-device privacy notices | `09d` (M4), `14`; notification B driven with the source rig on web, tablet (camera and microphone), phone |
| Sealing v2 | encryption at seal time (AES-256-GCM per fragment), signed manifest stating only facts, bounded retry, blocked seal with "Retry sealing" on web and devices, unsealable -> quarantine with a notice closed by a reviewer's acknowledgement, session keys bound to session and store | `10e`, `12d` (M7); seal rig; seal e2e |
| Transcript | STT configuration in the database with a menu, snapshot at start, cpu-local engine through a real sealed session (synthetic speech), transcript inside the package, revisions (signed, `from` must be the current text) | `11b` + `10d` (M6) |
| Evidence consumption | verify V-01..V-15 with notices, sealed player on three surfaces (indexed view for seeking on Android), tamper stop, export archive with signed download, receiver's check command | `13d` (M8), `14`, `report/confirm_c*.md` |
| Truth of the surfaces | one statement of system state per surface; "not reported" instead of simulator constants on a real-capture Core; DEMO marks on the simulated lane; an unsealed item never shows sealed values | `report/judging_*.md` -> `report/confirm_c*.md` |
| Dev tools | lanes (`scripts/lane/lane.sh`), camera stub, speech microphone, seal rig, source rig, `npm run test:regression` and five more scripts | README; `test/19_final_regression.md` |

Contract and schema at the end: 97 operations (36 GET / 61 POST), 67 audit types, schema 6 / `dbc-7` — unchanged since the milestone reviews; every later member is additive and optional.

## 3. Verification evidence

| Check | Result | Report |
|---|---|---|
| Milestone gates M3..M8 | PASS WITH CONDITIONS each (first round: 2 pass, 4 fail; five fix waves) | `gateway_check/08`, `09d`, `10e`, `11b` + `10d`, `12d`, `13d`, `14` |
| Row 98 final verification | PASS WITH CONDITIONS — 32 requirements: 20 met, 11 met with a limit, 1 not met | `verification/01_verification.md` |
| Row 99 security review | CAUTION — 0 critical, 1 high (fixed: production refuses the demo operator password), 3 medium (open, section 6) | `verification/02_security.md` |
| Row 100 final test report | YES WITH LISTED GAPS — 235 check ids: 140 by suite, 53 live at a gate, 5 by test only, 3 not proven, 5 user-attended, 1 hardware | `test/17_row100_final_test_report.md` |
| Row 101 senior code review | YES WITH CONDITIONS — 0 blocker, 5 major (2 fixed, 3 carried as structural debt) | `gateway_check/22_final_code_review.md` |
| UI judging (D150), four judges | 3 BLOCKER, 21 MAJOR, about 76 MINOR found | `report/judging_a1_tablet.md`, `judging_a2_phone.md`, `judging_b1_web.md`, `judging_b2_motion_on.md` |
| Confirmation, three judges, normal launch form | every BLOCKER and MAJOR confirmed fixed; "yes, with reservations" x3; 2 new MAJOR, fixed in wave Q | `report/confirm_c1_tablet.md`, `confirm_c2_phone.md`, `confirm_c3_web.md` |
| Final regression | GREEN, 16 steps, one run: shared 2685, capture-protocol 31, core unit 6732, core db 2429 (+7 skipped), web 2367, mobile 3166, transcriber 564 (+3 skipped), mock-core 19, pg-scripts 57, worker checks, seal e2e 3, development e2e 2, kill matrix 35 of 35, worker e2e series 122 as expected | `test/19_final_regression.md` |

Wave Q (the last fixes) was proven by its drivers on the devices and in the browser and by the final regression; it was NOT re-judged by an independent judge (the user closed the task: "selesaikan dulu task ini").

## 4. Not met, not proven, skipped

- **NOT MET:** composite export (`M8-CMP-1`) — refused with its reason; blocked on the FFmpeg licence decision.
- **Not proven:** `M5-SEC-SRC-1` (live part needs a production Core that cannot boot today); `M4-LOCAL-MIC-1` (the user's only run failed on sample rate); the user-attended local-device checks; class-C hardware (real ONVIF / RTSP cameras, real external microphones); the server STT backend live; a release build of the mobile app.
- **Skipped by the user's instruction:** biometric scenarios (D151) — skipped, not passed.
- **Not built by decision:** the phone is not locked to portrait (D17).

## 5. Known limits (stated, not hidden)

1. Recorded media is plaintext on the media root until the seal completes (D147).
2. The audit extract inside a package is not covered by the package signature (notice `AUDIT_EXTRACT_NOT_SIGNED`); note text and the session form's note are in the item's row, not under the signature.
3. The manifest has no member for delivered / dropped frames; its profile is the stream's declared format.
4. An acknowledgement that closes nothing writes no audit row (needs a 68th audit type).
5. Mobile, debug build on the emulator: the recording timer can stand still for 5-8 s in the first 45 s of a recording; the Audio Monitor sheet can take about 7 s. Cause not established. The hour-old-process slowdown (CT-01) was traced to react-native-reanimated 4.5.1 and patched (`apps/mobile/patches/`), but that aged state was not reproduced after the patch. Advice: start a demonstration from a freshly launched app.
6. Every gate before the judging session launched the mobile apps with the test switch `motion=off`; the normal launch form was first judged in `judging_b2_motion_on.md` and is the form of record since.
7. A production Core cannot be brought up from the seed (it refuses the demo operator password; there is no operator provisioning or password change yet).
8. Structural debt named by the code review: the Core does not state its capture operation to every role (clients infer it); the real Core's engine state is the simulator's; the players' stall watch is not an explicit state machine.
9. About 12 mobile MINOR findings and 10 web NOTES of the judging are not fixed, each with its reason in `implementation/171`, `173`, `176`, `177`.
10. The test suite (about 18,000 tests after consolidation: `test/13`..`15`) did not catch the defects found on devices and in the browser; `test/17` Part C lists the cheapest automated checks that would.

## 6. Decisions that are the user's (none taken by the controller)

| Decision | Why it matters | Source |
|---|---|---|
| FFmpeg licence for a distributed Core (the worker links the host's GPL Homebrew build) | blocks composite export and any installation package of the real-capture Core | D139, `verification/02_security.md` |
| Server-side confirmation before a local camera / microphone opens (S99-02) | today the confirmation is client-only | `verification/02_security.md` |
| Retention of decrypted export archives (S99-03) | they stay on disk until a reset | same |
| SEC35-26: legal basis, retention, erasure, DPIA | open — the README no longer calls it accepted | same |
| Key escrow (SEC35-09) | losing the credential store makes sealed footage unreadable | same |
| Quarantine policy; a tool for unsealed LOCAL_DEVICE recordings | there is no path back from quarantine | D216, D217 |
| Sealing note text; narrowing markers / notes by case scope | evidence-format rulings | `implementation/172` |
| Portrait lock on the phone (overrules D17) | landscape works but is flawed | `report/confirm_c2_phone.md` |
| Data clean-up: `.cache/gates` and `.cache/judging` (several GB), `.data/test-row61-row140e2e-*` 1.3 GB, lane 2 quarantine folders, `.data/capture-local/runs` 10 MB | nothing was deleted | `implementation/162` |
| Microphone `--diagnose` run on this Mac | the local microphone delivers 8/9 of 48 kHz | D128 |

## 7. What comes next (not part of this task)

1. The release-build session the user asked about: an APK release build and refreshed Simulated web packages from the final commit; a JS / UI profile of the recording start; the Reanimated patch through a real `npm install`.
2. Operator provisioning and a password change path, so that a production Core can start.
3. The structural cuts of section 5 item 8 (the Core states its capture operation; simulator separated from the real Core).
4. Real cameras and microphones on the LAN (blueprint row 105's activation).

## 8. How this task was run

Orchestrated by one controller with delegated agents (coder-execution drivers, verifier gates and judges, test-expert runners, security-review, senior-code-reviewer, git-specialist). Controller lapses are recorded where they happened: D219 (a fixture account quoted in a note, redacted before commit), D240 (a hygiene brief that ignored the blueprint's own list; overlapping suites), D241 (the letter of the local-device rule D163 broken by "select only" in three gate briefs; stale trackers), D243 (gating with `motion=off`), D247 (a limit ruled harmless that was a real defect). The user's standing instructions that shaped the run: maximum parallelism with mediation, pair programming off, autonomy with a decision log, one-run proof depth with a separate test runner, gates kept separate, the UI judging session, biometrics skipped, the test-suite consolidation.

---

# (History) Handoff to Kilo — DEMS task 3: real capture, sealing v2 and transcript


**Prepared by:** Claude Code master-controller session, 2026-10-07 · **Receiver:** the Kilo agentic workflow (`~/.config/kilo`, agent `master-controller` and the same worker roster) · **Repository:** `/Users/gsp-budi/Documents/DEMS`, branch `main`, HEAD `85c0fb5` (no git remote) · **Task folder:** `docs/2026-10-07_dems_real_capture_sealing/`

---

## 0. UPDATE 2026-10-08 — read this first (supersedes §1, §2 and §5 where they differ)

**What happened since the first handoff.** Kilo completed rev-1 rows 1-40 (rows 11, 13, 14 skipped/deferred) and proposed blueprint rev 2.0. The Claude Code controller then audited Kilo's work hands-on at the user's request (D16): code and tests re-run from scratch (AU-1, `verification/20_audit_code_tests.md`), spikes and STT re-executed with independent scripts (AU-2, `verification/21_audit_spikes_stt.md`), specs and rev 2.0 audited against the approved plan (AU-3, `verification/22_audit_docs_decisions.md`). Confirmed mismatches were revised: RV-CODE (`implementation/09_rv_code_audit_fixes.md`, D21), RV-SPEC (84 errata + R-8 sections, `masterplan/11_audit_errata.md`, D22), RV-BP (blueprint **rev 2.1**, rows 41-119, V1-V7 PASS, D23). The user added requirement **R-8** (D20: STT server configurable, active/deactivate via a configuration menu, configuration stored in the database) and gave the **second BLUEPRINT_APPROVAL with all recommended answers** (D24: Q-SEC-1 a, Q-SEC-2 a, Q-INST-1 c, Q-D7 a, Q-STT-ROUTE a, Q-WORKER a, Q-GOP a, Q-CLICK a, Q-STT-CFG a). A local checkpoint commit holds rows 1-40 + the audit revisions.

**Where Kilo resumes.** Phase C (IMPLEMENTATION) with blueprint **rev 2.1 rows 41-119**, in the order of the rebuilt wave table (`identification/02_structured.md` §10; rows 41 = gate-file renumber, 42 done, 106 spec-coverage check before M2 opens; 107-110 CPU-only STT proof on this Mac; 111 worker proofs first; 112-119 R-8). The class-C pack (§9) stays deferred until hardware arrives (Q-HW). Every milestone ends at its verification gate; stop and ask the user only at the points in §10 below.

**Current ledger (D21):** shared 71/1,851; core-web 117/1,495; mobile 194 suites/1,997; core-server unit 160/3,954; db 124/1,751.

**Rules added by the audit (binding for Kilo):**
1. **Never drop or re-scope an approved row silently.** A user instruction that changes an approved row (like D7) is recorded, and the parts of the approved plan it does not cancel (D7(b): the CPU path) must stay as concrete rows with tests — not "a later wave".
2. **Record every deviation in the Drift Log** of `decisions/decisions.md` when it happens (tiering variants, skips, deferrals, re-scopes).
3. **Measurements must be able to fail.** Validate every metric with a negative control (e.g. a copy with samples removed must fail the gap check; a known offset must be measured as that offset with sample-exact analysis). Keep product tolerances (±40 ms) separate from regression tolerances (2 ms on deterministic fixtures).
4. **Never claim code exists before it does** ("both backends already coded" was wrong); quote file paths for every "done".
5. **Fix the recorded failure site**, not a nearby line (AU1-1); re-run the original failing scenario as the proof.
6. **The Core's recorded duration wins once the stop is known** (D19(b)); forward-only display applies only while the Core reports RECORDING.
7. **No Homebrew installs that upgrade shared libraries** (GStreamer, whisper.cpp via Homebrew both would — openssl@3, ffmpeg, omlx, openjdk); build from source under `.cache/` as approved (Q-STT-ROUTE a). oMLX is a shared host service (SMART WMS): never upgrade it, never bind port 8000, serialise use, log start/stop, never print its API key.
8. **Dependency risk is measured by unique root advisories**, not npm's package count (AU1-3).

---

## 1. Status in one paragraph (original handoff of 2026-10-07)

Planning is complete and **approved**: the blueprint `identification/02_structured.md` (40 rows, milestones M0-M9) passed the pre-approval checks V1-V7 (D3) and the user gave **BLUEPRINT_APPROVAL with output format A (Markdown) and "all defaults"** for every gate question (D4). **Nothing has been executed** for this task: no research row, spike, install or code change. The user asked that implementation be delegated to Kilo. Kilo resumes the master-controller protocol at **phase B (RESEARCH), step B.7**, with rows 1-40 of the blueprint, and stops at the **second approval gate after row 40** (blueprint rev 2 adds the M2-M9 implementation rows; that is a MAJOR change by definition, RF-9).

## 2. How Kilo resumes (do this first)

1. Read, in order: this file; `decisions/decisions.md` (D1-D4); `identification/01_translated.md`; `identification/02_structured.md` (the approved blueprint — the table, §6 milestones, §9 class-C pack, §10 parallel plan, Gate Questions); `status_tasks.md`; `delegation_progress_report.md`.
2. Read the predecessor's inputs the blueprint consumes: `docs/2026-10-04_dems_backend_rbac_pairing/research/10_next_phase_impact_map.md` **together with** `research/11_next_phase_drift_check.md` (31 errata E-01..E-31; the map alone is outdated), the predecessor's `decisions/decisions.md` rows D219-D233 and D260, and its `report/01_report_inputs.md` §4 (backlog B2-B17, A1-A6).
3. Update `status_tasks.md`: A.5 = APPROVED (D4); B.7 started.
4. Run the first wave (§5) through the master-controller delegation template: every delegation carries the Documentation Contract; parallel rows write `delegation_progress/<agent>.md`; the controller gates every row by reading its artifact and re-running its key check before advancing; decisions, drift and findings are appended to `decisions/decisions.md` the moment they happen.
5. After row 39 (M0 spec gate) and row 38 (M1 spike gate), row 40 (task-architect) writes blueprint rev 2 — present it to the user as the second BLUEPRINT_APPROVAL gate. Do not start M2 before that approval.

**Agent variants.** Kilo has `*-local` variants of most agents. The predecessor recorded that a resumed Kilo run resolved every step to its `*-local` variant (predecessor D130, DR-13). The blueprint's agents are the reasoning-tier (non-local) roles; pick variants deliberately per row and record any substitution in `delegation_progress_report.md`.

## 3. Approved decisions (all defaults, D4)

| ID | Decision in force |
|---|---|
| OD-01 | `AUDIO-01` is the one session audio track; `AUDIO-02` only on legacy v1 items; microphone inputs are `MIC-01` / `MIC-02` |
| OD-02 | Regenerate all demo evidence as v2; reseed `dems_demo` only; `release/` 0.1.0 untouched |
| OD-03 | Per-fragment AES-256-GCM in the camera file; record both the stored-bytes hash and the plaintext hash; confirm at the M0 spec gate |
| OD-04 | Software Ed25519 behind a `Signer` interface; TPM/PKCS#11 adapter is class C (C-8) |
| OD-05 | Support both camera topologies (two PoE cameras or one dual-lens camera); fakes emulate two cameras |
| OD-06 | AAC-LC 48 kHz mono; transport behind `AudioInputAdapter`; USB as the working assumption |
| OD-07 | `PoeController` interface with an SNMP adapter and a fake; real adapter class C |
| OD-08 | A crash during RECORDING seals the durable part, flagged "interrupted" |
| OD-09 | Hot standby microphone; the switch toggle is for the session holder with `SESSION_START` plus SUPERVISOR; web-only recording stays "no" |
| OD-10 | New permission `CAPTURE_CONFIG` for SUPERVISOR and TECHNICIAN; selector editable only while idle |
| OD-11 | Below -50 dBFS for 10 s raises `MIC_SILENT` (warning only, never an automatic switch); disconnect debounce 2 s; contract constants |
| OD-12 | No live preview of real cameras in this phase (the demo loop stays) |
| OD-13 | Keep loopback (emulators only); LAN listener is class C (C-5, needs the demo password replaced and B3 first) |
| OD-14 | P25 waiver for `apps/core-server/src/app.ts`, `config.ts`, `src/index.ts`, limited to module registration, the `capture` seam, capture config keys and supervisor start/stop; each edit reviewed |
| OD-15 | `TRANSCRIPT_REVISE` for INVESTIGATOR and SUPERVISOR; the Core key signs revisions, author recorded; no approval flow; the sealed machine transcript never changes |
| OD-16 | Export = decrypted copy + manifest + signature, audited; composite side-by-side only on demand, marked derived; encoder chosen after a licence check (M8) |
| OD-17 | The in-app simulator emulates v2 (single audio, switch, new sealing steps, transcript stub); `offline` OpenAPI scope 0.2.0 |
| OD-18 | In real-capture mode, hardware-fault injection and scenario load are disabled; Simulated unchanged |
| OD-19 | Demo reset is blocked while real sealed packages exist; capture config, devices and camera credentials become kept tables |
| OD-20 | Indonesian only; downloading the diarization and VAD models is allowed after the row-4 licence check; licences go into DOC-05 |
| OD-21 | Fragmented MP4 per camera ("one whole file"); the fallback (segments + one lossless concatenation at sealing) stays designed; legal confirmation before handover |
| OD-22 | PoE-cycle during RECORDING only for a camera whose stream is lost (`CAMERA_LOSS`), confirmed and audited, gap marked in the manifest |
| OD-23 | Task 2's "simulator untouched" rule (SC8, AC-B-59..62, DR-14) is retired; simulator changes only through blueprint rows; Simulated-mode regression against `c2c983b` at M2 and M9 |
| OD-24 | CPU STT runtime whisper.cpp (Homebrew); model conversion in an isolated venv under `.cache/`, removed afterwards |
| OD-25 | All media in git-ignored paths; `docs/` carries text evidence and small stills only |
| OD-26 | Minimal targeted edits now; the `live-sim.ts` split, the static-scanner-to-lint conversion and the W91-10 splits after M9 or in a separate task |
| Q-AUTO | Full autonomy inside the approved scope with every decision logged; stop only at approval gates (the second blueprint gate after row 40, any MAJOR change), host installs per Q-INSTALL, hardware arrival, handover |
| Q-INSTALL | Blanket approval for: (1) whisper.cpp via Homebrew, (2) a Python venv for model conversion, (3) GStreamer + gst-plugins-rs via Homebrew, (4) MediaMTX RTSP test server, (5) sherpa-onnx + diarization/VAD model files, (6) an ONVIF client npm package after B2. Each install is logged with version, size and its uninstall command; no sudo |
| Q-HW | Hardware unknown: class C stays deferred; the task completes at the "done on this Mac with fake devices" line; class-C rows activate on arrival without re-planning |

The scope requirements behind these (R-1..R-7) are traced in `identification/02_structured.md` §7 from the user's decisions D219-D233: device selector controllable from web/tablet/phone; capture and media processing in a worker behind the API; one active microphone with a manual UI toggle (the second is failover); one whole file per camera with the single audio track on one timeline and synchronous playback; local CPU+RAM transcript with speaker labels when possible, inside the sealed package; a new session blocked until the previous one is sealed (rooms may wait); no STT benchmark on this Mac — just make it work; benchmark on the real Core device. Superseded items stay superseded: the multitrack master (D223 -> D224), the benchmark plan (D226 -> D230), the MIC 1/2 interviewer/subject mapping (D219 -> D220/D221), the MLX model copy (Apple GPU only).

## 4. Work plan (from the approved blueprint)

| Class | Rows | Meaning |
|---|---|---|
| A | 1-9, 16-27 | Starts right after approval — research consumption and verification, host check, fact collection (generic web queries only, no project data), dependency triage, spikes S1 (fMP4 + running hash + crash truncation from an FFmpeg-pushed synthetic RTSP source), S2 (mic switch on one audio timeline), S4 (flash+beep AV-sync fixture), backlog B10 (tests independent of wall-clock time), RC-1 (monotonic Sessions hub duration), B2 (dependency refresh) with reviews and a wave-A regression |
| B | 10-15, 28-37 | Now unblocked by D4 — STT install, model conversion, functional STT check on a synthetic two-voice Indonesian sample; GStreamer install and prototype; engine pick memo; the specs (phase spec, API contract C3 operations 76-88, database contract `dbc-3` with migrations 0004/0005, capture architecture, evidence package, transcript, client UX), security design review, test strategy, implementation plan |
| Gates | 38, 39, 40 | M1 spike gate, M0 spec gate, blueprint rev 2 (second user approval) |
| C | §9 C-1..C-9 | Hardware-dependent: ONVIF on the target camera, real camera/PoE/microphone adapters, physical devices on the LAN, real-camera preview, STT benchmark on the Core device, TPM signer, long AV-drift and kill loops (pre-handover only) |

Milestones (blueprint §6): M0 specs and plan · M1 spikes + working STT · M2 contract, database and Simulated parity (first row: recreate lane databases and re-pair devices) · M3 capture worker + supervisor + IPC with fake devices · M4 device selector (fake adapters; real = class C) · M5 manual microphone failover · M6 transcript pipeline (functional check, no benchmark) · M7 sealing v2 + package + signer + encryption + RECOVERY · M8 playback, export, on-demand composite · **done-on-this-Mac line** · M9 hardening (and the Core-device benchmark when hardware exists).

Parallelism: at most 8 agents in flight (global rule; the blueprint's own plan keeps ≤ 6). Single-writer resources (the lockfile, Homebrew installs, mobile test runs, web test runs) run one at a time (§10).

## 5. First wave Kilo can launch immediately

Rows with no dependency other than the gate answers: **1** (explore: re-verify repository facts), **2** (explore: host readiness, read-only), **3** (data-collector: capture/media facts), **4** (data-collector: STT/diarization facts), **5** (security-review: `npm audit` triage). Then **6** after 1; **7/8** after 2; **16**/**20** after 1; **10** after 2 and 4. The full dependency graph is the blueprint table's "Depends On" column (verified acyclic, D3).

## 6. Standing rules Kilo must carry (from the user and the predecessor tasks)

**Red lines (global rules):** never delete or rename a file the user did not ask for; never claim completion without fresh verification evidence; never fabricate; never skip an approval gate; never send private documents, credentials or user data to external services (including web search queries — generic queries only); no emoji in deliverables; hard-to-reverse or outward-facing actions need explicit confirmation (no git remote, no push, no publishing, no deploys, no accounts, no cloud). Commits are local only; the design book `.docx` is confidential and never staged.

**Testing depth (user, standing — predecessor D232/D233):** each device or browser check runs **2 times + 1 verification run**; long or repeated campaigns (≥ 10 loops, 1-2 h AV drift, kill loops) only when the user asks or announces the handover phase.

**Credentials and secrets:** project PostgreSQL only on `127.0.0.1:4432` through the repo's `scripts/pg` commands; never touch the host's own PostgreSQL on `*:5432`; never print, stage or pass as arguments `.data/pg.pwfile`, `.data/pg.owner.env`, `.data/pg.env`; never connect as `dems_admin` after provisioning; never grep `README.md` or `packages/shared/src/sim/dataset.ts` for credential lines (read them inside a script without echoing). Evidence captures: web pairing codes are CSS-blurred before any capture; no capture within 2 s of typing into a password field (Android echoes the last character); start pairing hand-off recordings only after the redeem call returns (the mobile "Pairing..." card still shows the typed code); scan outputs count-only before finishing.

**Emulators (user rule, never broken):** no agent types a PIN on a lock screen or sets, changes or clears a lock, PIN, fingerprint or any device security setting (`locksettings`, `adb emu finger`, settings changes) — a locked device is reported and the user gets the one-click command `apps/mobile/scripts/emulator-user-lock.sh unlock`. The user's test PIN is 9999 on `dems2_phone` and `dems2_tablet`; `dems2_phone2` is lock-free. The biometric device test is skipped (predecessor D231).

**Devices and ports:** never launch the app at `/` with `motion=`; launch with `demsdemo:///login?core=LIVE&motion=off` (single-quoted for the device shell); no `uiautomator dump` while Login, Summary or Home is showing; web console only at `http://127.0.0.1:<port>`, never `localhost` (mock-core accepts only the `127.0.0.1:5173` origin, so Simulated web sign-in works only on the main console). Do not use `apps/mobile/scripts/device-session.sh` while a manual stack runs (it starts its own Metro and rewrites reverse rules). `apps/mock-core/**` and `release/**` are read-only. Never stop the other project's processes on this Mac (SMART WMS `tsx watch`).

**Process lessons:** stop dev stacks by process tree (mock-core runs under `tsx watch`, whose parent respawns the child); loop over pids (zsh does not split `$pids`); device rows leave orphaned `adb logcat` readers — check `ps` at the end; never share scratch helper scripts between parallel agents; agents that cannot write report files return their text and the controller saves it verbatim.

## 7. Environment as handed over (checked 2026-10-07)

| Item | State |
|---|---|
| Git | `main` at `85c0fb5` (task 2 closing commits `0a9e317`, `c2c983b`, drift check `85c0fb5`); no remote; `.git` 1.5 GB |
| PostgreSQL | project-local PostgreSQL 18 running on `127.0.0.1:4432` (`pg:status: OK, running`); cluster rebuilt in W90 with the CPS1-9 log settings (terse, collector, mode 600); only database `dems_demo` exists — lane databases `dems_lane_1/2/3` are gone and must be recreated (`db:create`/`migrate`/`seed` per lane) before parallel device work |
| Core / web / Metro / mock-core | not running (ports 4420-4423, 5173, 5176-5178, 8081, 4400 free); start the Live stack with the README's "Live mode" commands |
| Emulators | `dems2_phone` (emulator-5554), `dems2_tablet` (emulator-5556), `dems2_phone2` (emulator-5558) booted; paired to the main instance (`dems_demo`) as DEV-0003, DEV-0004, DEV-0005; apps signed out on Login; adb reverse `tcp:8081 -> 8081` and `tcp:4420 -> 4420` on each |
| Tools on the host | ffmpeg (`/opt/homebrew/bin/ffmpeg`), Playwright headless shell (`~/Library/Caches/ms-playwright/chromium_headless_shell-1243`), Whisper large-v3-turbo in Hugging Face format at `~/.omlx/models/whisper-large-v3-turbo/` (the MLX copy in `~/.cache/huggingface` is Apple-GPU only and excluded); no whisper.cpp, GStreamer, MediaMTX or sherpa-onnx yet (Q-INSTALL) |
| Hardware baseline | Apple M5 (4 performance + 6 efficiency cores), 24 GiB RAM, macOS 27.0.1 — CPU-only for STT |
| Test ledger (task 2 final) | shared 71 files / 1,851; core-web 117 / 1,495; mobile 192 suites / 1,988; core-server unit 160 / 3,954; core-server db 124 / 1,751; mock-core 19; pg-scripts 57. Per-workspace runs with `--maxWorkers=2` are the reliable evidence; the all-cores root `npm test` with three idle emulators shows load flakes (rows 16-21 fix them) |

## 8. Key facts the next phase depends on (from the drift check)

- No real ingest exists yet (no RTSP/ONVIF/audio capture in `apps/core-server/src`); media are the clients' bundled demo files; evidence hashes and the signature are synthetic. The Core hosts the shared simulator as its only state machine — the capture worker plugs in **under** it through new server-only actions (pattern: `setTabletLink`, `apps/core-server/src/engine/types.ts:205-209`).
- Database blockers: `evidence_items_signature_check` (`apps/core-server/src/db/migrations/0001_tables.sql:336`) accepts only `SIMULATED-SHA256`; **three** fault-kind CHECKs (incl. `health_snapshots`) must change in migration 0004; demo reset rebuilds evidence rows.
- Contract: 75 operations, OpenAPI 0.2.1; capture devices must not reuse `AdminResource.DEVICES` (it means paired tablets/phones).
- Reuse these patterns: mobile timers from `apps/mobile/src/runtime/recording-elapsed.ts` on `runtime/core-clock.ts` (forward-only); server values imported from `@dems/shared/api`; web queries through `apps/core-web/src/lib/core-queries.ts`; list rows with `components/composed/selection-glow.tsx` (constant card border — a changing border width blanks Android cards); final UI state drawn by React, Reanimated only for removable overlays (the device drops Reanimated updates under load); gated controls show "Checking your permissions...".
- Known risks: STT on CPU may starve capture (provable only on the Core device); the tablet sometimes learns of a web stop seconds late under load (data points to an overloaded app thread); `.git` growth (real recordings ~8 GB/h → OD-25 keeps media out of git); lost Reanimated updates cluster in the finalizing screen.

## 9. Open items carried over (non-blocking)

- **Backlog placement** (blueprint §8): B2, B10, RC-1 in wave A; B4, B11, B15, B16 in M2-M5; B5/B6/B7/B8/B12/B13 at M9 per OD-26; B14 (QR scanning) deferred scope.
- **Pre-handover session (only when the user announces handover):** release-build revoke-to-Pair under 1 s, monitor timer lag and stale monitor under load, frame statistics, the late tablet stop, the biometric test if the user wants it, long campaigns (C-9).
- **User decisions from task 2 still at their defaults** (predecessor report §4): keep the unused realtime test-support shim; keep the old `dems_*` AVDs (15.4 GB) and the `dems2_*` AVDs; keep the project-local PostgreSQL; leave `.git/refs/.DS_Store`; no host clean-up until instructed.

## 10. What needs the user (escalate, do not decide)

The second blueprint approval after row 40; any MAJOR change (new scope, different agents, effort > 30 %, contradicting D4); hardware arrival (Q-HW) and the class-C rows it activates; any install outside the Q-INSTALL list or needing sudo; anything outward-facing (remote, push, publish, network exposure beyond loopback); the legal confirmation of fragmented MP4 before handover (OD-21); the handover announcement that unlocks long test campaigns.
