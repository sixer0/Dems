---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-13
agent: document-writer
blueprint_row: 125
milestone: M7
work_package: WP-27
type: record of a product document (hardware acceptance test package, chapter 2: host, helper and audio)
narrative_tier: 1
source_plan: identification/03_implementation_blueprint.md (row 125, profile line 436, sections 6, 9.1, 11.4, 12); masterplan/02_plan.md (section 9A, phases 7, 10, 11)
source_analysis: scripts/hardware-acceptance/HW-ACCEPTANCE-1-FRAME.md; implementation/124_hw_procedure_frame.md; scripts/host/HOST-PROFILE-UBUNTU-24.04.md; implementation/104_alias_helper.md with scripts/host/netalias/; test/006_e11_listener_path.md; test/007_e11b_announced_path.md; verification/05_security_branch_b.md (BR-10, BR-12, section 9); verification/02_security.md (5.3, 5.4, RC-5); research/01_explore_input_av.md (4.12, TS-7 to TS-10); masterplan/04_design_addendum.md (1.4, 4.2, 9.6); decisions/decisions.md (U2, U9, U10, C19, C25, C26, C27)
status: complete
confidence: MEDIUM for the content of each check against its sources; LOW for every command and expected output (none was run; no Linux host, no device; several product parts the checks observe are not built yet)
closes_requirements: the chapter half of P12-F14; the host checks of AD-01 (6), BR-10 and BR-12 as procedure (`9A/H-01`); F-06 (`9A/H-27`); F-07 (`9A/H-05`); P12-F12 (`9A/H-24`, `9A/H-25`). None is proven on hardware
last_updated: 2026-10-13 00:53 (host clock)
---

# Row 125: hardware acceptance test package, chapter 2 (host, helper and audio) - record

**The document is UNVERIFIED on real hardware, by definition.** It was written on the development Mac. No command of it was run, no source file was changed, nothing was installed, no `sudo`, no device, no credential. `apps/input-av/data/` and every `.env` were not opened. Two read-only searches of product source were made for code names (boot refusal codes, the sync-level codes, the audit type names, the helper's answer codes).

## 0. Frame (5W1H)

| Question | Answer |
|---|---|
| What | One product document, `scripts/hardware-acceptance/HW-ACCEPTANCE-2-HOST-HELPER-AUDIO.md` (544 lines): 12 checks in the six-part form of the frame chapter, a coverage table against blueprint section 12, eight open points, an Indonesian summary of about 255 words at the top |
| Who | Written by row 125 (document-writer). Run by the user with a person at the bench. Consumed by rows 127 (the request form of the helper proofs), 128 (the collectors it names and what each must collect), 130, 131 |
| When | 2026-10-13, before rows 41 to 48, 58, 64 to 72, 80, 81, 105 to 113, 141 have landed. The chapter therefore states outcomes from the design and marks texts and codes of unbuilt parts "to confirm" |
| Where | The document is in the product tree beside the frame chapter; this record and `delegation_progress/row_125.md` are in the task folder |
| Why | Under U13 every package was closed on doubles. Blueprint section 12 lists what that leaves unproven; this chapter is the procedure that settles the host, helper and audio lines of it |
| How | Each check was built from the plan's line in section 9A, the frame's order and operation, and the source that defines its expected result (section 2). Counts were taken by script over the written file (section 3) |

## 1. The checks

Order as the frame fixes it. All 12 carry the header line (capture operation, database, recording, user actions) and the six parts.

| Check | Operation | Steps | Pass criterion, in short |
|---|---|---|---|
| `9A/H-27` | none | 6 | findings 0 in 6 of 6 probes |
| `9A/H-01` | none | 11 | profile items not met 0; loopback counter rises for a foreign account and not for the service user; 3 programs built on libavformat 63.1.102; announce line at level 56 in 6 of 6 probe runs; near misses refused 7 of 7 with controls recording |
| `9A/H-02` | `REAL_DEVELOPMENT` | 4 | survivors 0 and listeners 0 at 10 s, Core started outside the unit |
| `9A/H-24` | `REAL_DEVELOPMENT` | 5 | named 0 after the kill, 1 of 1 planted, 0 after removal |
| `9A/H-03` | `REAL_DEVELOPMENT` | 3 | observation: one of three named outcomes recorded; two of them need the user's decision |
| `9A/H-04` | `REAL_DEVELOPMENT` | 5 | named 1 of 1 per case, 0 after restoring; case 2 has two named outcomes |
| `9A/H-16` | `REAL_PRODUCTION` | 10 | operation printed; 4 slots unassigned and 4 blocking items; start refused with 0 rows and 0 files; demonstration sign-in refused n of n; missing loopback rule named 1 of 1 |
| `9A/H-05` | none, then `REAL_PRODUCTION` | 8 | installed state 6 of 6 with hashes equal; refusals 5 of 5 plus the socket's own; journal lines 5 of 5; addresses changed 0 |
| `9A/H-25` | `REAL_PRODUCTION` | 4 | iputils tool at its path; in-use address refused 1 of 1; free control added and removed |
| `9A/H-06` | `REAL_PRODUCTION` | 9 | added 2 of 2, removed 1, conflict refused 1, absent at 330 s with the Core killed, open rows 0 |
| `9A/H-07` | `REAL_PRODUCTION` | 8 | 3 equal channel figures; automatic registrations 0; 2 devices after 3 registrations; beyond-card refused; identity 3 of 3 after re-plug |
| `9A/H-08` | `REAL_PRODUCTION` | 8 | 2 of 2 opens, 0 busy; 48,000 Hz; level meets B-7 on 2 of 2 with separation; first-second figures recorded; speech heard |

## 2. Content against its sources

| Part of the row's cell | Where in the document | Source |
|---|---|---|
| The Linux repeat of the E-11 observations (AD-01 (6)) | `9A/H-01` steps `.9` to `.11`, criteria 4 and 5 | `test/006` (18 of 21 accepted on the Mac library), `test/007` (the level-56 line, 18 of 18; the probe) |
| The announce line of BR-10; branch C if it differs | `9A/H-01` step `.10`, "If not met" of criterion 4 | `verification/05` section 8 (BR-10), section 9 items 3 and 5; decisions C26, C27 |
| The loopback rule of BR-12 in effect | `9A/H-01` steps `.3`, `.4`; `9A/H-04` case 2; `9A/H-16` steps `.8` to `.10` | `verification/05` BR-12; host profile `HOST-25`, `HOST-41`, open point 9 |
| The helper as delivered: one address at a time, request line `add <address>/24 <minutes>`, the group, the hash | `9A/H-05`, `9A/H-25`, `9A/H-06` | `implementation/104` sections 1, 3, 4, 7; `scripts/host/netalias/` (codes read from the file) |
| What the helper's 58 tests do not prove | `9A/H-05` part 1; `9A/H-25` part 1; `9A/H-06` criterion 4 | `implementation/104` section 7, items 1 to 7 |
| Shared capture on the real interface; silence is a fail; input separation; the first-second sample | `9A/H-08` | `research/01_explore_input_av.md` TS-7, TS-8, TS-10, 4.12; plan 9A line H-08 |
| A swapped card must not be matched silently; 8-input and loopback channels | `9A/H-07` step `.8` and the note under part 5 | `research/01` TS-8, TS-10 item 3; blueprint row 156 |
| All four slots must be assigned to start (C25) | `9A/H-16` steps `.4`, `.5`, criterion 3 | decisions C18, C21, C25 |
| TECHNICIAN only (U10); the helper's privilege form (C19) | `9A/H-05` steps `.6`, `.8`; chapter 3 holds the role test | decisions U10, C19 |

## 3. Verification cell

| Criterion of the row | Result | How counted |
|---|---|---|
| Checks 12 of 12, each with all six parts | 12 headings `### 9A/H-nn`; each of the six part labels occurs 12 times; header lines 12 | `grep -c` per label over the file |
| Missing parts | 0 | the same counts |

Also counted: a failure paragraph in every check (11 "If not met", 1 "If `FAIL`" in the observation check); steps 81, every one with a performer of `USER`, `TECH`, `OPER`, `BENCH`, `SCRIPT` (one step is marked "Observation"); steps performed by an agent 0; the word "works" 0; non-ASCII characters 0; addresses in the text: `127.0.0.1` and the documentation address `203.0.113.10` only; no name, no credential. `git check-ignore` on the file exits 1 (not ignored).

**Blueprint section 12, lines that name a check of this chapter:** Linux host (`9A/H-01` to `H-04`, `H-24`), ALSA (`H-07`, `H-08`), helper (`H-05`, `H-06`, `H-25`), production boot (`H-16`), no input-av (`H-27`), branch B on Linux (`H-01`). Each has its check; the table is section 3 of the document. Lines without a check: 0.

## 4. Driver decisions (to confirm)

| # | Decision | Why the conservative one |
|---|---|---|
| D-1 | The failure meaning and the reopened row are the closing paragraph of part 5, not a seventh part | The frame fixes six parts and their names; the gate counts six |
| D-2 | Collector names `collect-hNN.sh`, one per check, output `hNN-run<k>.txt`, dry mode `--dry` | The frame names the performer `SCRIPT` and no file; a name is needed to say what each must collect |
| D-3 | `9A/H-02` kills a Core started from a terminal, not the unit | Under the unit the service manager ends the children and hides the product's rule (host profile, open point 7) |
| D-4 | Reading instants: 10 s and 60 s after the kill (`9A/H-02`); lifetime 300 s plus 30 s (`9A/H-06`) | No source states one; fixed before the run, not after the reading |
| D-5 | `9A/H-04` uses two cases and names two outcomes for the second; the production reading of the loopback rule is added to `9A/H-16` (steps `.8` to `.10`) | Whether the host checks run in `REAL_DEVELOPMENT` is not designed; BR-12 speaks of a production boot |
| D-6 | The pid-bound halves of `HOST-35` to `HOST-42` are read in `9A/H-16`, `HOST-08` in `9A/H-17` | They need a running Core; `9A/H-01` has none |
| D-7 | `9A/H-05` sends five requests (public address, wrong prefix, an interface named by the caller, an unmarked delete, root as caller) | The plan's "another interface" cannot be sent: the delivered helper takes no interface from the caller |
| D-8 | `9A/H-25` calls the helper directly as the service user, with a free-address control that is added and removed | The console does not let a technician choose the address; without a control a refusal proves nothing |
| D-9 | A level threshold is proposed as B-7 (peak at or above -40 dBFS and 20 dB above silence); without a set value `9A/H-08` is `NOT RUN` | The plan says "the level check passes" and gives no bound; the frame forbids a bound set after the reading |
| D-10 | Input separation is tested with the other microphone unplugged, not by speaking toward one of two | Two microphones in one room both hear a voice |
| D-11 | The first-second reading compares the first 1,000 ms with the next 4,000 ms; a finding, not a fail | The stored audio is AAC; an exact full-scale test is not possible on it |
| D-12 | The claims line was appended with one shell append | The file is appended by other rows at the same time |

## 5. Points for the controller

1. **Frame, `PREP-03`:** the room network stays unplugged from `PREP-03`, while the profile of `9A/H-01` needs packages and source archives. Chapter 2 states a conservative reading; the frame should say it.
2. **Frame order against unit file G:** the unit names the helper's group in `SupplementaryGroups`, and the group exists only after chapter 4, which the frame places after `9A/H-16`. A unit with an unknown group does not start. Either the group is created before `9A/H-16` or the unit carries it only after chapter 4.
3. **The pusher on the host:** the configure line of `HOST-12` enables no H.264 or H.265 encoder. The pushers of `test/006` used `libx264`. What the worker's series and the announce-line probe push with on Ubuntu must be settled by rows 78 and 128, or steps `.9` to `.11` of `9A/H-01` cannot run.
4. **Row 128 must carry the E-11b probe source into the package:** it lives under the git-ignored `.cache/` and in the appendix of `test/007` only.
5. **B-7** needs a line in the frame's section 5.
6. Row 127 should give the request form of `HI-06`; `9A/H-05.3` proposes `nc -N -U` and marks it to confirm.
7. Codes of unbuilt parts are marked "to confirm" in the checks (document section 4, point H); row 130's dry run is where they are fixed.

## 6. What stays unproven

Everything in the document. It is a procedure; it has no result. Nothing in it was tried against a container or a double.

## 7. Requests

None in `file_requests.md`.

---
*Generated: 2026-10-13 00:53 (host clock)*
