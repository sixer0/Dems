---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-12
agent: task-architect
status: structured
revision: 2 (narrowed to porting by U1; input-av input scheme as default by U2/P3)
scale_category: Migration (port of logic, plan only, with a Research gap analysis)
task_size: Medium
tiering: paid
professional_document: false
review_mode: gate
source_translated: identification/01_translated.md
source_original: identification/01_original.md
source_decisions: decisions/decisions.md (U1, U2, P3, P4, P5, P6)
---

# Structured Task Blueprint: Rencana porting logika input-av ke adapter Core (tanpa pencatatan ganda)

> **Ringkasan (Bahasa Indonesia).** Revisi 2 mengikuti putusan pengguna di gerbang blueprint: "ok kalau di persempit ke porting, default inputnya pakai skema yang dari input-av karena ini yang sudah tested". Tugas ini tetap hanya menghasilkan **rencana**, tidak ada kode yang diubah. Perbandingan tiga opsi dihapus: yang direncanakan hanya **porting** logika perangkat keras input-av ke adapter Core (U1). **Skema input input-av menjadi default** adapter produksi (U2, dibaca sebagai P3): kamera lewat ONVIF main stream, RTSP di atas TCP, stream copy, codec apa adanya dari kamera termasuk H.265; audio lewat USB Audio Class dengan ALSA shared capture, semua kanal perangkat dibuka lalu input dipilih, 24-bit / 48 kHz. Blueprint tetap 13 baris: lima inventaris fakta paralel, dua analisis (peta kepemilikan catatan; analisis kesenjangan per parameter), spesifikasi target porting dengan paket kerja WP-nn, daftar keputusan, rencana bertahap, dan tiga pemeriksaan. Yang masih terbuka untuk pengguna: bentuk bukti yang DISIMPAN (MPEG-TS + audio lossless terpisah, atau fMP4 + AAC mono milik Core), data lama di `apps/input-av/data/` (Q3), jumlah ruangan per Core (Q6), host produksi Linux (Q7), kapan aturan kelas C dicabut, dan nasib alat non-perekaman input-av. Tidak ada baris yang terhenti menunggu jawaban itu; rinciannya di bagian "Decision Gating of Rows".

## Prior Task Continuity

No formal prior-task context was passed with this delegation, so the stateless workflow applies. Two earlier tasks are history references in `identification/01_translated.md:106-111`; their content is brought in by row 5 of the table, not assumed here.

## Revision Record

| Revision | Trigger | What changed |
|---|---|---|
| 1 | Initial blueprint | 13 rows; three options compared (port, helper-driven input-av, REST bridge); Q1-Q7 open. |
| 2 | User ruling at the blueprint gate, recorded as U1 and U2 (`decisions/decisions.md:7-8`); controller readings P3, P4 (`decisions/decisions.md:9-10`) | Option comparison removed, row 8 is the target design of the port. The input-av input scheme is a design constraint (C10 below). Row 1 gains a "tested input scheme" section; row 2 gains the worker's codec handling; row 7 gains a per-parameter acceptance table; row 6 gains the non-recording tools. Decision register re-cut: Q1, Q2 closed; Q4, Q5 answered on the input side; three new entries (Q8, Q9, Q10). Row count unchanged at 13: no row became empty, none had to be added. |

## Memory Screening

Read: the memory index `MEMORY.md` (10 entries). The individual memory files were not opened; the statements below rest on the index lines only.

| Memory entry | Bearing on this blueprint |
|---|---|
| `project-dems-demo-state` | Task 3 is on hold with work in flight. A plan-only task writes only under its own `/docs` folder, so it cannot collide. No build, test or emulator row exists here. |
| `feedback-ready-made-frameworks` | The target design must name, per work package, the ready-made library it relies on (for example the FFmpeg libraries the worker already links) and must justify any hand-built part (constraint C8). |
| `feedback-pair-programming-rows` | Pair programming is off in DEMS unless the user opts in. Review mode is `gate` on every row. |
| `feedback-parallelism-push-to-limit` | The five fact-inventory rows are one wave with one output file each. |
| `feedback-autonomy-with-decision-log` | The autonomy grant belonged to the demo task. It is not assumed here; the open decisions stay with the user. |

## Design Constraints Added by the User's Ruling

| Id | Constraint | Source | Status |
|---|---|---|---|
| C10 | **Porting only.** The hardware input logic of input-av is re-implemented inside the Core's adapter layer and capture worker. No bridge to the input-av API and no helper-driven input-av process is planned. | U1 (`decisions/decisions.md:7`) | In force |
| C11 | **The input-av input scheme is the default of the production adapters.** Camera: ONVIF main stream, RTSP over TCP, stream copy, the codec the camera delivers (H.265 on the four bench cameras). Audio: a USB Audio Class card through ALSA shared capture, all device channels opened then inputs selected, 24-bit / 48 kHz. | U2 (`decisions/decisions.md:8`) as read by P3 (`decisions/decisions.md:9`) | In force; P3 is the controller's reading and is confirmed in the decision register |
| C12 | **The stored evidence form is not fixed by C11.** Whether evidence is stored as input-av stores it (MPEG-TS plus separate lossless audio) or as the Core stores it (fMP4 plus AAC mono) is a decision. The design states the cost of each and recommends one. | P3 (`decisions/decisions.md:9`) | Open, entry Q8 |
| C13 | **input-av keeps no recording role.** There is no second system of record. Whatever part of input-av remains is an installation tool that writes no record the Core also owns. | P4 (`decisions/decisions.md:10`), derived from U1 | In force; what remains is entry Q10 |

The parameter values in C11 are the controller's wording in P3. They are **not** taken as evidence: row 1 extracts the exact values from the input-av source with `file:line`, and where the source differs from P3 the source governs and the difference is reported.

## Architecture Challenge & Refinement

| Dimension | Challenge | Refinement |
|---|---|---|
| Intent | "Adapt the logic" left the method open (A3). | Closed by U1: port. The method is an input now, not an output. |
| Scale Category | Migration, delivered as a plan, containing Research. | Confirmed. Posture: source-to-target transition design with a mapping table. The task still behaves like a Research task in one respect: its rows are analytical deliverables that run to completion. See "Deviation from the standard pattern". |
| Source | The facts in `01_original.md` are the controller's reading (`01_translated.md:157-159`); the parameter list in P3 likewise. | Rows 1-5 re-derive every fact from the files with `file:line`. No analysis row may cite `01_original.md` or P3 as evidence for a code fact. |
| Spec | "No double recording" and "use the tested scheme" are not testable as written. | Two testable forms: (1) a record map in which every kind of record has exactly one owner, double-owner count 0; (2) a parameter table in which every parameter of the tested input scheme has a verdict "accepted by the Core today" or "needs change" with the Core `file:line` and the work package that changes it. |
| Impact | What does the port affect if later executed? | The class-C rule and its pins (`apps/core-server/src/capture/adapters/registry.ts:36,82`; `__tests__/registry.test.ts:89-90`), the H.264-only connection test, the capture contract in `packages/shared`, the worker's ingest, mux and audio path, the mic transport, the one-open-session rule, credential sealing. The design names each as a change item with its rollback. |
| Goals | G1-G7 stand. G5 (fate of input-av) is narrowed by C13. | Each goal is assigned to one row (traceability table). |
| Scope | The translation lists 14 Python files. | A Glob on 2026-10-12 (repeated for this revision) returns 31 `.py` files under `apps/input-av/nvr/` (23 at the top level, 8 under `routers/`). Row 1 covers all of them. Present by that Glob and relevant to entry Q10: `factory.py`, `netalias.py`, `commissioning.py`, `doctor.py`. Where the gain calibration lives was not established; row 1 locates it. |
| Constraints | C3 says reading `apps/input-av/data/` is permitted. | Tightened as before: no row opens anything under `apps/input-av/data/`. Reason: a database tool can create journal or WAL side files beside a SQLite file. A precaution, not an observed incident. |
| Constraints | C4: no real camera credential. | No row runs input-av, connects to a camera or reads `.env`. `.env.example` may be read. |
| Assumptions | A1 (meaning of "pencatatan ganda") was unconfirmed. | Closed by U1 as read in P4: no second system of record. The Q1 variant marking of revision 1 is removed. |
| Assumptions | P3 is a reading of U2, not the user's own wording. | Carried as a confirmation line in the decision register beside Q4 and Q5. If the user corrects it, rows 7 and 8 are reworked on the changed parameters only. |
| History | Are the task 3 rulings (D76, D86 C-5, OD-06, classes C-2 and C-4) still in force? | Not assumed. Row 5 collects them with their current status. OD-06 matters more now: it fixed AAC-LC 48 kHz mono, which C11 touches. |
| Multi-Document | Are the cited paths reachable? | Verified by Glob or Grep on 2026-10-12: the adapter files, `apps/capture-worker/src/ingest.c`, `audio.c`, `worker.h`, `capture_worker.c`, the two task 3 documents, the input-av `nvr/` and `docs/` files. Not verified: where the Core's database schema is declared. Row 4 locates it. |

### Observations that change the design

1. **The Core's connection test refuses a camera that offers no H.264 profile.** `apps/core-server/src/capture/adapters/camera/onvif-session.ts:491` returns the outcome `NOT_H264`. Under C11 the default camera codec is the one delivered, H.265 on the bench cameras, so this line is a change item, not a constraint.
2. **The worker's audio path is fixed to mono 48 kHz AAC.** `apps/capture-worker/src/audio.c:233-237` builds a filter chain with `channel_layouts=mono` and `sample_rates=48000`; `worker.h:75` and `capture_worker.c:148` state "AAC-LC 48 kHz mono (OD-06); the worker records nothing else"; `ingest.c:163` looks up the `aac` encoder. A 24-bit multi-input capture can feed this path (capture side) without changing what is stored, or the stored form can change too. That fork is exactly C12.
3. **No HEVC-specific code was found in the worker.** A Grep for `hevc|HEVC|h265|H265` over `apps/capture-worker/src/*.c` and `*.h` on 2026-10-12 returned no match. Hypothesis, not a finding: the ingest may copy any codec without naming it, or may reject non-H.264 by another test; whether the fMP4 mux carries HEVC correctly is unknown. Row 2 reports the code facts, row 7 gives the verdict.
4. **The class-C rule is pinned in three places.** `registry.ts:36` (the list), `registry.ts:82` (the refusal), `__tests__/registry.test.ts:89-90` (the test). The design lists every pin with the condition under which it is lifted.
5. **The Core may already contain a built opener to copy the shape from.** `LOCAL_DEVICE` is one of the two opener-capable kinds (`registry.ts:36`) and a test exists at `apps/core-server/src/capture/adapters/local/__tests__/camera-helper.test.ts:532`. The file was not read. In revision 1 this was evidence for an option that is now rejected; it is kept only as a possible structural model for the `ONVIF_RTSP` opener. Row 2 confirms or refutes.

### Deviation from the standard pattern

The standard for a non-research task is: the initial blueprint holds research rows only, and its last row re-delegates to `task-architect` to add the implementation breakdown. This blueprint has no such row. Reason: the deliverable of the whole task is the plan document set; there is no implementation breakdown to add. If the user later orders the plan to be executed, that is a new task with its own blueprint, and `masterplan/02_plan.md` of this task is its input.

## Scale Category Design

| Item | Value |
|---|---|
| Scale category | Migration (port), plan only |
| Design posture | Source-to-target transition design |
| Research focus | Source system (input-av hardware logic with its tested parameters), target system (Core adapter seams, capture worker), mapping, data contracts |
| Specification output | Port design: logic-to-seam mapping table, contract, schema and protocol changes, class-C lift conditions, work packages, a rollback statement per phase |
| Impact validation | Record-ownership check (zero double owners), parameter acceptance check (C11), guarantee check (C6 not weakened), plan verification by three reviewers |
| Research depth | Medium: source evidence, spec analysis, impact matrix |

## Source -> Spec -> Impact Research Design

| Track | Question | Rows | Evidence rule |
|---|---|---|---|
| Source | What does input-av do with the hardware and with which exact parameters, what does it write, what does the Core offer, own and forbid? | 1, 2, 3, 4, 5 | Tier 2. Every statement carries `file:line` or a document section. No statement from memory, from `01_original.md` or from P3. |
| Spec | Which system owns each record; which input-av logic lands in which Core seam; which parameter the Core accepts today; which work packages; which phases? | 6, 7, 8, 9, 10 | Tier 1. Full 5W1H, assumptions, gaps. Each requirement traces to a Source row. |
| Impact | What breaks or weakens if the port is executed; is the plan complete and executable? | 8 (impact section), 11, 12, 13 | Tier 1 for the impact section and the security assessment; Tier 2 for review findings. |

### Goal traceability

| Goal | Owning row | Supporting rows |
|---|---|---|
| G1 logic inventory with verdicts | 7 | 1 |
| G2 single-record statement | 6 | 3, 4 |
| G3 mapping onto the adapter contract | 8 | 2, 7 |
| G4 nine mismatches resolved or put to the user | 7 | 9 |
| G5 fate of input-av (narrowed by C13) | 8 | 6, 9 |
| G6 work sorted by what it needs | 10 | 8 |
| G7 risks and verification per milestone | 10 | 11, 12, 13 |
| C11 tested input scheme as default | 7 (acceptance), 8 (design) | 1, 2 |

### Core seams the port lands in

The six seams named by the controller for row 8. They are target labels; their exact contract members are established by row 2.

| Seam | Label used in rows 2, 7, 8 |
|---|---|
| ONVIF_RTSP camera adapter: opener plus stream-URI resolution | S1 |
| Camera discovery with its fallbacks | S2 |
| USB_AUDIO adapter: enumerate, open, level | S3 |
| Mic transport | S4 |
| Capture plan (shared contract) | S5 |
| Capture worker (ingest, mux, audio) | S6 |

## Structured Task Breakdown

> **PRIMARY OUTPUT — Controller-Executable Table.** Each row is one delegation unit with one output file. All output paths are relative to `/Users/gsp-budi/Documents/DEMS/docs/2026-10-12_input_av_core_adapter_plan/`. Limits that apply to every row: read-only on everything outside this task folder; nothing under `apps/input-av/data/` is opened; `.env` files are not read; input-av is not started; no camera is contacted.

| Step | Task Description | Agent_to_Invoke | Expected Output | Depends On | Verification | Phase |
|------|------------------|-----------------|-----------------|------------|--------------|-------|
| 1 | Inventory the hardware input logic of input-av per module: for every `.py` file under `apps/input-av/nvr/` (routers included) state what it does, which external program or protocol it drives, which hardware behaviour or workaround it encodes, which records it writes; label each file HARDWARE_LOGIC, RECORD_KEEPING, API_UI or SUPPORT. Include a section "Tested input scheme" quoting the exact values from the source: the FFmpeg argument lists for camera recording, the ONVIF profile choice with stream-URI resolution, the RTSP transport, the timeouts, the reconnect rule, the keyframe note, the ALSA configuration generation, the channel-open then input-select logic, the sample format with rate; name the bench device each value was observed on per `README.md` plus the files in `apps/input-av/docs/`. Include a section "Non-recording tools" covering the factory-IP scan, set camera IP, gain calibration, doctor. Facts only, no verdicts. | explore | `research/01_explore_input_av.md` (Tier 2: finding, why it matters, how verified, `file:line`) | - | Every `.py` file found appears exactly once with one label plus at least one `file:line` (31 files by the architect's Glob; the row reports its own count); the "Tested input scheme" section holds all nine named parameter groups, each quoted with `file:line` or reported "not found" with the search used; the "Non-recording tools" section holds the four named tools, each with its module plus what it writes | research |
| 2 | Inventory the Core capture target as built, one section per item: the adapter contract members in `capture/adapters/types.ts`; the kinds; the opener rule `OPENER_CAPABLE_KINDS` with every place that enforces or tests it; what the two stubs refuse; WS-Discovery with ONVIF discovery; the ONVIF connection test with its H.264-only outcome plus stream-URI handling; the `local/` adapter as a built opener; credential sealing; the mic transport; the capture plan shape in `packages/shared/src/api/capture.ts`; the worker's ingest with fMP4 mux, quoting every codec test, codec tag, mux option; the worker's audio path in `audio.c` (channels, rate, sample format, encoder); the one-open-session rule. Tag each section with the seam S1-S6 it belongs to. Facts only, no verdict on H.265 or 24-bit. | explore | `research/01_explore_core.md` (Tier 2) | - | Each of the 13 named items has its own section with at least one `file:line`; the opener-rule section lists every match of `OPENER_CAPABLE_KINDS` in `apps/core-server/src`; every seam S1-S6 is tagged on at least one section | research |
| 3 | List every record input-av writes, from its source code only: each SQLite table with its columns as declared in `nvr/db.py`, the audit log format in `nvr/audit.py`, user or token material in `nvr/security.py`, every file type written to disk (recordings, audio, hashes, exports, settings, logs, generated ALSA configuration) with the module that writes it. | data-collector | `research/02_collection_input_av_records.md` (Tier 2) | - | Every `CREATE TABLE` statement found in `apps/input-av/nvr/` is listed (count stated beside the Grep count); every written file type names its writer with `file:line`; the document states that nothing under `apps/input-av/data/` was opened | research |
| 4 | List what the Core holds for each of the eight record kinds of goal G2 (session, recording or evidence file, audit entry, user or role, device registry entry, camera credential, setting, marker): the table or type, where it is declared, which module writes it; include the `capture_devices` schema, the audit event types, the sealed-credential storage. Where the Core has nothing for a kind, state "none found" with the search used. | database-specialist | `research/02_collection_core_records.md` (Tier 2) | - | All eight record kinds have a row holding either a declaration `file:line` or "none found" with the search pattern used | research |
| 5 | Collect the rulings of task 3 that bind this plan, each with its identifier, text, current status, source line: D76, D86 (C-5), OD-06, classes A, B, C with C-2 and C-4, sections A.1 and A.7 of the capture architecture spec, plus any later decision that amends one of them. | data-collector | `research/02_collection_rulings.md` (Tier 2) | - | Each named identifier has an entry with a `file:line` in `docs/2026-10-07_dems_real_capture_sealing/`, or is reported "not found" with the search used | research |
| 6 | Build the record-keeping map: for every record listed in step 3, assign exactly one outcome among OWNED_BY_CORE (naming the Core record from step 4), DROPPED, GAP_IN_CORE (naming what the Core lacks); for each non-recording tool of step 1 list what it writes with a statement whether the Core owns that record kind; state the fate of the existing input-av data as an item tied to Q3. | data-analyst | `research/03_analysis_record_map.md` (Tier 1, full 5W1H) | 1, 3, 4, 5 | Every record of step 3 appears once with one outcome; the closing count "record kinds with two owners after the port" equals 0; each of the four tools has a line stating "writes no record the Core owns" or naming the record that must move or go | research |
| 7 | Write the gap analysis: one verdict per HARDWARE_LOGIC item of step 1 among ADOPT, ALREADY_IN_CORE, NOT_NEEDED, BLOCKED_BY_DECISION, each ADOPT naming the seam S1-S6 with the contract member or worker part it fills; a parameter table giving, for every parameter of the "Tested input scheme", whether the Core or the worker accepts it today, with the Core `file:line` that accepts or refuses it (H.264-only test, HEVC through ingest plus fMP4 mux, mono 48 kHz AAC against 24-bit multi-input); for each of the nine mismatches of `01_original.md` a planned resolution or a pointer to an open entry, re-proved from steps 1-2. | data-analyst | `research/03_analysis.md` (Tier 1) | 1, 2, 5 | Every HARDWARE_LOGIC item has one verdict, every ADOPT a seam plus member; every tested-scheme parameter of step 1 has ACCEPTED_TODAY, NEEDS_CHANGE or UNPROVEN with a Core `file:line`; all nine mismatches have a resolution or an entry reference | research |
| 8 | Write the target design of the port: a mapping table placing each ADOPT item of step 7 in its seam S1-S6; the contract, schema, protocol changes each seam needs; the default parameters of the production adapters per C11 with the change that makes the Core accept each; the stored evidence form as two costed variants (as input-av stores, as the Core stores) with a recommendation; how plus when the class-C opener rule is lifted, pin by pin; the fate of `apps/input-av` under C13; work packages with stable identifiers WP-nn; an impact section with rollback per change item; one short "rejected alternatives" paragraph (bridge, helper-driven input-av: rejected by U1). Indonesian summary at the top. | data-analyst | `masterplan/01_specs.md` (Tier 1) | 6, 7 | Each ADOPT item plus each NEEDS_CHANGE parameter of step 7 belongs to exactly one WP-nn that names a seam; every pin of the opener rule reported by step 2 has a lift condition; both stored-form variants carry a cost line per affected seam with one recommendation | masterplan |
| 9 | Write the decision register in two parts. Answered: Q1, Q2 (by U1, as read in P4); Q4, Q5 input side (by U2, as read in P3, with a one-line confirmation request for P3). Open: Q8 stored evidence form; Q3 legacy data in `apps/input-av/data/`; Q6 rooms per Core; Q7 Linux production host; Q9 lifting class C; Q10 fate of the non-recording tools (port, keep as an installation tool that writes no session record, drop). Per open entry: the options, the consequence of each on the design of step 8, the recommended default with its reason, the WP-nn it blocks, what proceeds without an answer. Indonesian wording of each open question. | pm-planner | `decisions/01_decision_register.md` (Tier 1) | 8 | Four answered entries, each citing its row in `decisions/decisions.md`; six open entries, each with at least two options plus one recommendation; every blocked WP-nn exists in step 8 | decisions |
| 10 | Write the phased port plan: order the WP-nn of step 8 into phases; per phase its entry condition, tracking checkbox list, completion check, rollback, blocking entries from step 9; sort every work package into "development host with fake devices", "waits for a user decision", "needs real hardware or a Linux host"; state risks with mitigations, among them whether `apps/input-av/` is tracked by git. Indonesian summary at the top. | pm-planner | `masterplan/02_plan.md` (Tier 1) | 8, 9 | Every WP-nn of step 8 sits in exactly one phase plus exactly one of the three need-classes; every phase has a completion check plus a rollback line; the blocking list of each phase matches step 9 | masterplan |
| 11 | Verify the plan set against the goals: check G1-G7 plus constraints C10-C13 one by one against steps 6-10, sample-check 20 `file:line` citations across steps 1-8 by opening them (at least 6 of them from the "Tested input scheme"), confirm no file outside the task folder was written. Review of the plan, not of code. | verifier | `verification/01_verification.md` (Tier 2) | 10 | A pass or fail line per goal G1-G7 plus per constraint C10-C13 with the evidence location; 20 citations checked with the result of each; findings listed with the row that must rework them | verification |
| 12 | Review the technical soundness of the port design plus plan against the Core's code: is each claimed contract or worker change sufficient (HEVC through ingest plus mux, 24-bit multi-input into the audio path, the mic transport), is any dependency or blast-radius item missing, is the phase order buildable, is the effort class of each WP-nn credible. Review of the plan, not of code. | senior-code-reviewer | `verification/03_plan_review.md` (Tier 2) | 10 | Each WP-nn has a verdict among SOUND, NEEDS_CHANGE, UNPROVEN with a `file:line` reason; findings ranked by severity with the row that must rework them | verification |
| 13 | Assess the security impact of the port design: camera credential path against sealed write-only storage, evidence sealing under each stored-form variant, the network-changing installation tools (factory-IP scan, set camera IP) with who may run them, the single audit chain, handling of the existing input-av evidence data. | security-review | `verification/02_security.md` (Tier 1) | 10 | Each of the five named areas has a finding rated with a severity, a statement whether a Core guarantee of C6 is weakened, the row that must rework it if so | verification |

## Execution Profile

All sizes, models and budget figures in this section are **estimates** made from the row scope before any research has run. Ownership areas are output documents only; no row owns source code.

Path evidence: the parent `EXISTS: /Users/gsp-budi/Documents/DEMS/docs/2026-10-12_input_av_core_adapter_plan/` was verified by reading files in it on 2026-10-12 (`identification/02_structured.md`, `identification/01_translated.md`, `decisions/decisions.md`, `delegation_progress_report.md`). `decisions/` exists (it holds `decisions.md`); whether `research/`, `masterplan/`, `verification/` exist was not checked, and the first row that writes into each creates it if needed. In the table, "TF" stands for that verified parent.

| Step | Ownership Area | Deps (kind) | Size | Model | Shared Resources | Checks | Review |
|------|----------------|-------------|------|-------|------------------|--------|--------|
| 1 | docs only — NEW under TF: `research/01_explore_input_av.md` | - | M | opus (override of the explore default: recognising a hardware workaround is interpretation) | - | one label plus `file:line` per file; nine parameter groups quoted; four tools listed | gate |
| 2 | docs only — NEW under TF: `research/01_explore_core.md` | - | M? | sonnet (inventory, source-checkable, deterministic) | - | 13 sections with `file:line`; opener-rule matches complete; seams S1-S6 tagged | gate |
| 3 | docs only — NEW under TF: `research/02_collection_input_av_records.md` | - | S | sonnet (extraction, source-checkable, deterministic) | - | table count equals Grep count; writer per file type; data-folder statement present | gate |
| 4 | docs only — NEW under TF: `research/02_collection_core_records.md` | - | S | sonnet (inventory, eight fixed kinds; downgrade of the database-specialist default) | - | eight kinds covered; declaration line or search pattern per kind | gate |
| 5 | docs only — NEW under TF: `research/02_collection_rulings.md` | - | S | sonnet (extraction, source-checkable, deterministic) | - | each identifier found or reported; status stated; `file:line` per entry | gate |
| 6 | docs only — NEW under TF: `research/03_analysis_record_map.md` | 3:B, 4:B, 1:B, 5:C | M | opus | - | one outcome per record; double-owner count is 0; one line per tool | gate |
| 7 | docs only — NEW under TF: `research/03_analysis.md` | 1:B, 2:B, 5:C | M | opus | - | one verdict per item with seam; one status per tested parameter; nine mismatches closed | gate |
| 8 | docs only — NEW under TF: `masterplan/01_specs.md` | 6:B, 7:B | M | opus | - | every ADOPT plus NEEDS_CHANGE in one WP; lift condition per pin; two stored-form variants costed | gate |
| 9 | docs only — NEW under TF: `decisions/01_decision_register.md` | 8:B | S | opus | - | four answered entries cited; six open entries with recommendation; blocked WP identifiers exist | gate |
| 10 | docs only — NEW under TF: `masterplan/02_plan.md` | 8:B, 9:B | M | opus | - | every WP in one phase plus one need-class; check plus rollback per phase; blocking lists match step 9 | gate |
| 11 | docs only — NEW under TF: `verification/01_verification.md` | 10:B | M | opus (verification agent, never downgraded) | - | G1-G7 plus C10-C13 lines; 20 citations checked; no write outside the task folder | gate |
| 12 | docs only — NEW under TF: `verification/03_plan_review.md` | 10:B | M | opus (verification agent, never downgraded) | - | verdict per WP; reason with `file:line`; findings ranked | gate |
| 13 | docs only — NEW under TF: `verification/02_security.md` | 10:B | S | opus (verification agent, never downgraded) | - | five areas rated; C6 statement per area; rework row named | gate |

Path count: marked EXISTS = 1 (the task folder); NEW-under = 13; UNKNOWN = 0.

Notes on the profile:

- Dependency 5:C on rows 6 and 7: the ruling identifiers are known from `01_translated.md`; rows 6 and 7 need the collected text for citation, not for starting.
- Row 1 grew in this revision (two added sections). It stays one row because it is one reading pass over one folder for one file, and the added sections quote from files the pass opens anyway. If it returns `needs-review`, the split is: (1a) per-file inventory with labels, (1b) "Tested input scheme" plus "Non-recording tools".
- Row 2 is marked `M?`: it reads three workspaces for one document. If it returns `needs-review`, the split is: (2a) core-server adapter layer, (2b) capture-worker plus shared capture contract. Its worker sections are the factual base of the H.265 and 24-bit verdicts; it stays on the mechanical tier because it quotes code and gives no verdict, and rows 7 and 12 open the quoted lines themselves. Escalate once to the reasoning tier if it returns incomplete.
- No row needs a single-writer resource: no database runner, lockfile, build, port, device or emulator is used anywhere in this blueprint.
- Three rows write into `verification/` in the same wave, each to its own file name.
- The controller's own files (`status_tasks.md`, `delegation_progress_report.md`, `README.md`, `decisions/decisions.md`) are not owned by any row. Row 9 writes `decisions/01_decision_register.md`, a different file.

### Cost statement (estimate)

| Measure | Value |
|---|---|
| Rows by size | S = 5 (rows 3, 4, 5, 9, 13); M = 8 (rows 1, 2, 6, 7, 8, 10, 11, 12); L = 0 |
| Rows by model | opus = 9 (rows 1, 6, 7, 8, 9, 10, 11, 12, 13); sonnet = 4 (rows 2, 3, 4, 5) |
| Waves from build dependencies | 6 |
| Wave contents | W1: 1, 2, 3, 4, 5 — W2: 6, 7 — W3: 8 — W4: 9 — W5: 10 — W6: 11, 12, 13 |
| Widest wave | W1, five rows |
| Critical path | 1 -> 7 -> 8 -> 9 -> 10 -> 12 (four M rows, one S row, then an M review) |
| Rough budget, upper bound | 5 x S (about 150k tokens each) + 8 x M (about 350k each) = about 3.5M tokens if every row used its full size class |
| Three most expensive rows | 7 (verdict per logic item plus the parameter table), 8 (mapping, changes per seam, two stored-form variants, work packages), 1 (31 files plus exact parameter extraction) |
| Effect of the narrowing | Row 8 lost the three-option comparison and row 6 lost the Q1 variant; rows 1, 2, 7 gained the tested-scheme work. Net change in budget: judged roughly neutral, not measured |

What would shorten the critical path: row 9 could run beside row 10 if row 8 published its WP-nn list as a short first section that both read (a contract dependency in place of a build dependency). That saves one wave at the risk of the register and the plan disagreeing on which entry blocks which work package. The default keeps them sequential because the saving is one S row.

## Decision Gating of Rows

Entry identifiers used from here on, fixed for rows 8, 9, 10:

| Entry | Subject | State | Source |
|---|---|---|---|
| Q1 | Meaning of "pencatatan ganda" | Answered: no second system of record | U1, P4 |
| Q2 | Fate of input-av | Answered: no recording role; what remains is Q10 | U1, P4 |
| Q4 | H.265 or H.264, input side | Answered: the codec the camera delivers, H.265 included | U2, P3 (P3 to be confirmed) |
| Q5 | Audio, input side | Answered: USB Audio Class through ALSA shared capture, 24-bit / 48 kHz, all channels opened then inputs selected | U2, P3 (P3 to be confirmed) |
| Q8 | Stored evidence form (the storage side of Q4 and Q5): MPEG-TS plus separate lossless audio, or fMP4 plus AAC mono | Open | P3 |
| Q3 | Legacy data in `apps/input-av/data/` | Open | `01_translated.md:147` |
| Q6 | Rooms per Core | Open | `01_translated.md:134` |
| Q7 | Production Core host is Linux | Open | `01_translated.md:135` |
| Q9 | Lifting class C: under which condition, by whose ruling | Open | C7, D86 C-5 |
| Q10 | Fate of the non-recording tools (factory-IP scan, set camera IP, gain calibration, doctor) | Open | C13 |

**No row of this task is blocked from starting.** The open entries hold back the status "final" of named parts of three documents, and phases of the later implementation.

| Row | May run now | What stays provisional | Entry that lifts it |
|---|---|---|---|
| 1, 2, 3, 4, 5 | Yes, without reservation: facts about the code do not depend on any answer | Nothing | - |
| 6 | Yes | The line for the existing input-av data; the lines of the four tools (each carries its outcome under "port", "keep as tool", "drop") | Q3; Q10 |
| 7 | Yes | Items with verdict BLOCKED_BY_DECISION; the parameter table stands as fact, but its target column changes if P3 is corrected | Q6, Q7, Q8 (each for its own items); confirmation of P3 |
| 8 | Yes, as one port design | The stored-form section stays "two costed variants plus recommendation"; the lift conditions of the opener rule stay "proposed"; the section on what remains of input-av stays "proposed" | Q8; Q9; Q10 |
| 9 | Yes: this row is the vehicle for the open entries | Nothing | - |
| 10 | Yes, with phases carrying their blocking entries | The phases listed in the next table; the status "final" | Q3, Q6, Q7, Q8, Q9, Q10 |
| 11, 12, 13 | Yes, on the provisional plan | Sign-off reads "verified with open decisions" until Q8, Q9, Q10 are answered; row 13 rates both stored-form variants | Q8, Q9, Q10 |

Phases of the later implementation that wait (to be confirmed and given WP-nn by rows 8 and 10; this list is the architect's expectation, not a finding):

| Open entry | Expected to block | Expected not to block |
|---|---|---|
| Q8 stored evidence form | Worker mux plus audio storage work in S6; the capture plan fields in S5 that describe the stored tracks; sealing manifest changes | S1 opener, S2 discovery, S3 enumerate/open/level, S4 transport on the capture side |
| Q9 lifting class C | The work package that edits the three pins; any registration of a real opener outside a test double | All design work; adapters built behind the rule with fake devices |
| Q7 Linux production host | The ALSA-dependent part of S3 plus S4; the hardware phase | Camera side S1, S2 |
| Q6 rooms per Core | Any work on the one-open-session rule; multi-room capture plan | Single-room port |
| Q3 legacy data | The legacy-data phase only | Everything else |
| Q10 non-recording tools | The work packages that port or package those tools | The recording path |

If the user corrects P3 (U2 meant something other than the capture-side defaults): rows 7 and 8 are reworked on the changed parameters, row 10 on the affected phases, then rows 11-13 re-run on the changed parts; rows 1-6 and 9's structure stand.

## Dependencies

- `identification/01_original.md`, `identification/01_translated.md`, `decisions/decisions.md` (exist).
- Read access to `apps/input-av/` (excluding `data/` and `.env`), `apps/core-server/`, `apps/capture-worker/`, `packages/shared/`, `docs/2026-10-07_dems_real_capture_sealing/`, `docs/2026-10-04_dems_backend_rbac_pairing/`.
- Blueprint approval: recorded by the controller as given for the narrowed blueprint (P6, `decisions/decisions.md:12`), subject to PRE-HIL validation of this re-written table.
- No hardware, no Linux host, no running service.

## Verification & Testing Strategy

- **Unit / Integration / Functional / UAT testing**: not applicable. No code is produced, so no test suite is run and `test-expert` has no row. The plan (row 10) states, per phase, which tests the later implementation needs.
- **Per-row check**: the Verification criterion of each row, confirmed by the controller reading the artifact before the next wave.
- **Plan verification**: row 11 (goals, constraints C10-C13, citation sampling), row 12 (technical soundness against the code), row 13 (security impact). These three replace the code-level chain of a build task.
- **Security**: row 13, focused on credentials, evidence sealing under both stored-form variants, the network-changing installation tools, audit chain, existing evidence data.
- **Performance / risk**: inside row 8 (cost lines per variant, effort per work package) and row 10 (risks with mitigations). No benchmark is run.
- **Rollback / recovery**: this task changes nothing outside its folder. For the planned work, row 8 states a rollback per change item and row 10 a rollback line per phase.
- **Bulk data seeding**: not applicable.
- **Feedback loop**: a finding from rows 11-13 names the row that produced the faulty artifact; that row is re-delegated with the finding, the artifact to rework and the expected correction; the reviewing row then re-checks the changed part only.
- **Acceptance criteria**: `masterplan/01_specs.md` and `masterplan/02_plan.md` exist; rows 11-13 report no open finding of high severity; the double-owner count of row 6 is 0; every tested-scheme parameter has a status in row 7 and a work package in row 8 where it needs change; the user has the six open entries in a form they can answer in one sitting.

## Risk Assessment

| Risk | Mitigation |
|---|---|
| A row writes into, or creates side files in, `apps/input-av/data/` | Blanket limit above the table; row 3 works from source code; row 11 checks that no file outside the task folder changed. |
| An agent reads a real camera credential from `.env` or from the input-av database | `.env` excluded; the database is under `data/` and excluded; input-av is not started. |
| The tested parameters are paraphrased instead of quoted, so the port silently differs from what was tested | Row 1 quotes argument lists verbatim with `file:line`; row 11 opens at least 6 of those citations; P3 is declared non-evidence. |
| "Tested" is read more widely than the bench supports | Row 1 names the device each value was observed on. Known limits from the translation: the soundcard was swapped during the day (`01_translated.md:154`); the 8-room result used virtual cameras (`01_translated.md:155`). |
| The H.265 default turns out to need more than removing the connection-test refusal (ingest, mux tag, players, sealing) | Row 2 quotes the worker's codec handling; row 7 marks UNPROVEN where the code does not settle it; row 12 reviews sufficiency. UNPROVEN items become "needs real hardware" work packages, not assumptions. |
| C11 collides with OD-06 (AAC-LC 48 kHz mono) | Row 5 reports OD-06 with its status; row 8 treats the capture side and the stored side separately; the stored side is Q8. |
| Hardware know-how that lives only in a comment or a workaround is lost | Row 1 runs on the reasoning tier, covers every file, and is cross-checked against the hand-over documents. |
| An installation tool kept from input-av keeps a database or log the Core also owns | Row 6 has one line per tool; row 13 assesses the network-changing tools. |
| The inventory rows on the mechanical tier miss or misread items | Counts are built into their checks; row 11 samples 20 citations; a `needs-review` return is escalated once. |
| Row 1 or row 8 grows beyond size M | Split points are named in the profile notes (1a/1b); for row 8 the impact section becomes its own row if it returns unfinished. |

**Assumptions and caveats.** Sizes and budget are estimates. The count of 31 Python files comes from a Glob and may differ if ignore rules hid files. The "no HEVC code in the worker" observation is one Grep over `*.c` and `*.h` in `apps/capture-worker/src`, not a reading of the code. Whether `apps/input-av/` is tracked by git, and whether its `data/` folder here is the live evidence or a copy, was not checked (`01_translated.md:152-153`); the blanket limit makes it irrelevant for this task, and row 10 carries it as a risk for the later implementation. The frontmatter of `01_translated.md` has no `tiering` field; `paid` is written here because the global rules state that there is no local-model tier. P6 records the user's approval of the narrowed blueprint as described by the controller before this re-write; this agent does not treat that record as approval of the re-written text and leaves the gate to the controller.

## Recommendation & Next-Plan Summary

### Key Findings Summary

| # | Finding | Confidence | Evidence Source | Implication |
|---|---------|------------|-----------------|-------------|
| 1 | The Core's ONVIF connection test ends with `NOT_H264` when no H.264 profile is offered | High (line read by Grep) | `apps/core-server/src/capture/adapters/camera/onvif-session.ts:491` | Under C11 this is a change item of seam S1. |
| 2 | The worker stores audio as AAC-LC 48 kHz mono by ruling OD-06 | High (lines read by Grep) | `apps/capture-worker/src/audio.c:233-237`; `worker.h:75`; `capture_worker.c:148`; `ingest.c:163` | 24-bit multi-input capture either feeds this path or the stored form changes: entry Q8. |
| 3 | The worker source contains no string naming HEVC or H.265 | Medium (one Grep, no code read) | Grep `hevc\|HEVC\|h265\|H265` in `apps/capture-worker/src/*.c,*.h`, zero matches, 2026-10-12 | Whether H.265 passes ingest and the fMP4 mux is unknown; rows 2, 7, 12 settle it or mark it UNPROVEN. |
| 4 | The opener rule is pinned by a list, a refusal and a test | High | `apps/core-server/src/capture/adapters/registry.ts:36,82`; `__tests__/registry.test.ts:89-90` | Row 8 gives a lift condition per pin; entry Q9. |
| 5 | input-av holds 31 Python files against 14 named in the scope; `factory.py`, `netalias.py`, `commissioning.py`, `doctor.py` exist | High for the count, none for the contents (not read) | Glob of `apps/input-av/nvr/` on 2026-10-12 | Row 1 covers all files and the four tools of entry Q10. |
| 6 | No open entry blocks a row of this task from starting | High | "Decision Gating of Rows" | Research can start after PRE-HIL validation. |

### Priority Recommendations

| Priority | Recommendation | Rationale | Risk if Ignored | Target Phase/Task |
|----------|---------------|-----------|-----------------|-------------------|
| P0 | Enforce the blanket limit (no `data/`, no `.env`, no start of input-av, no camera contact) in every delegation prompt | Evidence folder and credential rule | Evidence altered or a credential exposed | all rows |
| P0 | Tell rows 1 and 2 to quote, not paraphrase, argument lists and codec handling | C11 is only as good as the extracted values | A port that differs from what was tested | research |
| P1 | Launch rows 1-5 in one message | No dependency between them, one output file each | A slower first wave for no gain | research |
| P1 | Present the six open entries plus the P3 confirmation in one sitting, in Bahasa Indonesia, from the register of row 9 | The user prefers one consolidated decision package | Piecemeal questions, plan stays provisional | decisions |
| P1 | Put Q8 first in that package | It decides the largest share of worker work in S6 | The costliest part of the plan stays as two variants | decisions |
| P2 | Check whether `apps/input-av/` is tracked by git before any later implementation task | Evidence data inside a repository where agents commit | Evidence committed or cleaned by accident | follow-up task |

### Pending Decisions for Human-in-Loop

| # | Decision Required | Options | Recommended Option | Impact |
|---|-------------------|---------|-------------------|--------|
| 1 | Confirm P3 as the reading of U2 | Confirm / correct the parameter list | Confirm | Fixes the target column of row 7 and the defaults in row 8 |
| 2 | Q8 stored evidence form | As input-av stores (MPEG-TS plus separate lossless audio) / as the Core stores (fMP4 plus AAC mono) / a mix stated by row 8 | Deferred to row 8, which costs both; no recommendation is made before the research | Worker and sealing work packages |
| 3 | Q3, Q6, Q7, Q9, Q10 | See row 9 once written | Deferred to the decision register, each with a recommendation grounded in the research | Each blocks named work packages of the later implementation, not this task's rows |

### Next-Plan Recommendations

- **Immediate next step**: PRE-HIL validation of the two tables of this revision, then wave 1.
- **Subsequent tasks**: wave 1 (rows 1-5), wave 2 (rows 6, 7), row 8, row 9, row 10, wave 6 (rows 11-13), rework loop if needed, final report with the decision register presented to the user.
- **Parallelizable work**: rows 1-5 together; rows 6 and 7 together; rows 11-13 together.
- **Cross-task continuity notes**: the seam labels S1-S6, the entry identifiers Q1-Q10 and the WP-nn identifiers of row 8 are the shared vocabulary of rows 7-13 and of any later implementation task; `masterplan/02_plan.md` is the input of that later task; task 3 work in flight is untouched by this task.

## Agent Mapping Rationale

- **explore** (rows 1, 2): source inspection of the two code bases with `file:line` evidence. Row 1 is raised to the reasoning tier because recognising a hardware workaround is interpretation.
- **data-collector** (rows 3, 5): extraction of declared records and of rulings from documents; checkable against the source.
- **database-specialist** (row 4): locating and reading the Core's schema, audit types and credential storage.
- **data-analyst** (rows 6, 7, 8): synthesis of the inventories into the record map, the gap analysis with its parameter table, and the port design; this is where the judgment of the task sits.
- **pm-planner** (rows 9, 10): decision package and phased, trackable plan with entry conditions, checks and rollback.
- **verifier** (row 11): goal-by-goal and constraint-by-constraint check with citation sampling.
- **senior-code-reviewer** (row 12): sufficiency of the proposed contract and worker changes, phase order, against the actual code.
- **security-review** (row 13): credential, sealing, installation-tool and audit-chain impact of the port design.
- Not used: `coder-execution`, `git-specialist`, `test-expert`, `document-writer` — no code, no commit by a row, no test run, and the deliverables are Markdown written by the analysing agents themselves.

---
*Generated: 2026-10-12 (clock time not available to this agent)*
*Last Updated: 2026-10-12 (revision 2)*
