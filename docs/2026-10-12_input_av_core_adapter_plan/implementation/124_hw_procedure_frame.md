---
task_id: 2026-10-12_input_av_core_adapter_plan
task_slug: input_av_core_adapter_plan
date: 2026-10-12
agent: document-writer
blueprint_row: 124
milestone: M7
work_package: WP-27
type: record of a product document (hardware acceptance test package, chapter 1: the frame)
narrative_tier: 1
source_plan: identification/03_implementation_blueprint.md (row 124, profile line 427, sections 6, 9, 9.2, 12); masterplan/02_plan.md (phases 7, 9, 11; sections 9A, 13, 21.4)
source_analysis: masterplan/04_design_addendum.md (1.4, 9.6, 10); verification/03_plan_review.md (P12-F14); verification/02_security.md (S13-03, S13-15, S13-16, 5.4); verification/04_security_addendum.md (AD-01, AD-13); verification/01_verification.md (F-06, F-08, N-02); decisions/decisions.md (U12, U13, C8, C19); scripts/host/HOST-PROFILE-UBUNTU-24.04.md; README.md ("Real capture, sealing and transcript")
status: complete
confidence: MEDIUM for the order, the user actions and the record form (each follows a named source); LOW for every command and expected output (none was run; no Linux host, no device)
closes_requirements: document half of P12-F14 (order, capture operation per check), AD-13, F-06 (as a user action and a first check), F-08 with C8 (the migration step), S13-15 and S13-03 (c) (rule and sheet), the frame part of WP-27. None is proven on hardware
last_updated: 2026-10-12 23:20 (host clock)
---

# Row 124: hardware acceptance test package, the frame chapter - record

**The document is UNVERIFIED on real hardware, by definition.** It was written on the development Mac. No command of it was run, no source file was changed, nothing was installed, no `sudo`, no device, no credential. `apps/input-av/data/` and every `.env` were not opened.

## 0. Frame (5W1H)

| Question | Answer |
|---|---|
| What | One product document, `scripts/hardware-acceptance/HW-ACCEPTANCE-1-FRAME.md` (465 lines): the order of the 27 checks with the capture operation of each, 14 preparation steps (`PREP-01` to `PREP-14`), 15 user-only actions, the values to set before the run, the six-part form for chapters 2 and 3, the result record with three sheets, the failure rule, the stage 2 rule, what doubles support and what they cannot, 9 open points |
| Who | Written by row 124 (document-writer). Read by the installer and the user who run the acceptance. Consumed by rows 125, 126 (by contract `124:C`), 127, 128, 129 (record line form), 130, 131 |
| When | 2026-10-12, before the development track is complete; the document therefore claims no result of the development and refers the reader to its closing report |
| Where | The document is in the product tree; this record and `delegation_progress/row_124.md` are in the task folder |
| Why | Under U13 no hardware exists during development. Everything closed "on doubles" is confirmed, or not, by this package; stage 2 of the class-C lift is ruled only on its record (blueprint 9.2) |
| How | Every statement of the frame was taken from a named source (section 2). Where the sources leave a matter open, the document says so in its section 13 instead of inventing a step. Counts were taken by script over the written file (section 3) |

## 1. Path chosen (the profile line said "executor declares")

`scripts/hardware-acceptance/`, a new folder, one file per chapter.

| File | Row | Identifiers |
|---|---|---|
| `HW-ACCEPTANCE-1-FRAME.md` | 124 (written) | `PREP-01` to `PREP-14`, `UA-1` to `UA-13`, `X-1`, `X-2`, `B-1` to `B-6`, sessions `S1` to `S4` |
| `HW-ACCEPTANCE-2-HOST-HELPER-AUDIO.md` | 125 (name proposed, not written) | `9A/H-27`, `9A/H-01` to `9A/H-08`, `9A/H-16`, `9A/H-24`, `9A/H-25` (12) |
| `HW-ACCEPTANCE-3-NETWORK-CAMERAS-SESSION.md` | 126 (name proposed, not written) | `9A/H-09` to `9A/H-15`, `9A/H-17` to `9A/H-23`, `9A/H-26` (15) |
| `HW-ACCEPTANCE-4-HELPER-INSTALLATION.md` | 127 (name proposed, not written) | `HI-01` to `HI-10` |

Why here: it lies beside `scripts/host/HOST-PROFILE-UBUNTU-24.04.md`, which check `9A/H-01` applies; the profile lines of rows 128 and 129 put the package's scripts under `scripts/`, so document and scripts share one folder; `release/` is git-ignored (row 76's finding), so a file there would never be committed. `git check-ignore` on the chosen path exits 1 (not ignored).

**The six-part form** every check of rows 125 and 126 must have (frame section 8): a header line (capture operation, database, recording, user actions), then 1 What it proves (with one line on what doubles showed), 2 Precondition, 3 Steps numbered `9A/H-nn.k` each with one performer of `USER`, `TECH`, `OPER`, `BENCH`, `SCRIPT`, 4 Expected result, 5 Pass criterion (count, value against a bound, or named outcome), 6 What to record.

## 2. Content against its sources

| Part of the row's cell | Where in the document | Source |
|---|---|---|
| The new order of the checks | section 6, 35 sequence lines | addendum 9.6; plan 9A "Order" |
| The capture operation each check needs | section 6 columns "Capture operation", "Database", "Recording"; section 3 | review P12-F14; README "Capture operation" |
| First boot in `SIMULATED` on a loopback listener, before the room network, no session | `PREP-03` step 2, `PREP-08`, `PREP-09` step 4, `PREP-11` | AD-13; addendum 1.4 "First production boot" |
| UA-1 to UA-6, X-1, X-2 | section 4 | plan section 13 |
| The user migrates the acceptance host's database | `PREP-07` (UA-8) | C8; verification F-08 |
| The password rule; the per-camera record | section 5 (B-5), `PREP-13`, section 9.3 | S13-03 (c); S13-15 |
| The bounds to be set before the run | section 5 | plan phase 7 tracking list; I-5; R-16 |
| The result record form | section 9.1 to 9.4 | plan phases 7 and 11 |
| The stage 2 rule | section 11 | blueprint 9.2; plan phase 11; addendum 10 items 2, 3, 8 |
| input-av absent from the acceptance host | UA-7, `PREP-03` step 3, `9A/H-27` first in the order | verification F-06 |
| The Linux repeat of the E-11 observations | section 6 line of `9A/H-01` (content is row 125's) | AD-01 (6) |
| What doubles support and what they cannot | section 12 | blueprint section 12 |

## 3. Verification cell

| Criterion of the row | Result | How counted |
|---|---|---|
| 27 checks placed in the order with their capture operation | 27 distinct identifiers in the order table, each once; rows with an empty operation cell: 0 | `awk` over the table of section 6, `sort \| uniq -c` |
| Steps an agent would perform with a credential, `sudo` or a real camera | 0. 14 preparation steps, performers: `USER` 10, `USER` with `BENCH` 3, `TECH` or `OPER` 1; "agent" as a performer: 0 | `grep` over the `Performer:` lines |
| A pass criterion that only says "works" | 0. The word occurs once, in the rule that forbids it (section 8, part 5) | `grep -i -w` |

Also checked: non-ASCII characters 0 (no emoji); addresses in the text: `127.0.0.1` only; no name, no credential; the recording sheet of 9.2 holds 27 checks.

## 4. Driver decisions (to confirm)

| # | Decision | Why the conservative one |
|---|---|---|
| D-1 | Folder `scripts/hardware-acceptance/`, file names as in section 1 | section 1 |
| D-2 | The host checks that need a recording before a production boot (`9A/H-02`, `H-03`, `H-04`, `H-24`) run in `REAL_DEVELOPMENT` on a **throw-away database** (`dems_lane_2`) with its own media store on the same disk, never on the acceptance database | The plan says "a session on fakes"; a development key and development sessions do not belong in the database under acceptance, and a production Core refuses a selector with a generated source |
| D-3 | `9A/H-15` before `9A/H-14` | It needs two cameras still on one factory address; `9A/H-14` changes one |
| D-4 | `9A/H-11` and `9A/H-22` after `9A/H-17` (addendum 9.6 lists H-11 with the cameras) | Each needs a session of four sources; the first production session is kept free of an injected fault |
| D-5 | `9A/H-25` before `9A/H-06`; `9A/H-24` directly after `9A/H-02` | Dependency of the conflict case; one kill read twice |
| D-6 | Four sessions S1 to S4; `9A/H-09`, `H-21`, `H-26`, `H-18`, `H-20` read from S1 | No extra recording where a reading suffices |
| D-7 | The room network is joined only after `9A/H-16` passed (`PREP-11`) | `9A/H-16` is the mechanical proof that no operator has the published password; stricter than AD-13 asks |
| D-8 | Password rule B-5: 16 random characters or the model's maximum, one per camera, as a proposal the user confirms | S13-03 (c) asks for a length rule and gives none |
| D-9 | Every camera gets a new password before adoption, not only those known from input-av; "not known" counts as "yes" | One rule covers S13-15 and S13-03 (c); no reliance on memory of what was registered |
| D-10 | Identifiers UA-7 to UA-13 for user actions the sources name without one; B-1 to B-6 for the values | So that a "not run" line can name its reason |
| D-11 | Result values are `PASS`, `FAIL`, `NOT RUN` only; "partial" is a word of the summary | Plan phase 11 |
| D-12 | The claims line was appended with one shell append, not the Edit tool | The file was being appended by other rows at that moment; an append cannot overwrite their lines |

## 5. Open points found while writing (for the controller)

These are gaps of the sources, not of the row; the document lists them in its section 13 and routes each step around them without inventing a procedure.

1. **X-2 has no tool** (README known limit 34: no operator provisioning, no password-change path). Without a means, the run stops at `9A/H-16`. The addendum knows it (section 10 item 7); the installer must be told before the day.
2. **No procedure exists for PostgreSQL on the Ubuntu host.** `npm run pg:init` has run on macOS only and writes its cluster and credential files under the product tree, which `HOST-05` makes root-owned. Row 76 reported the same gap.
3. **The database commands accept only `dems_demo` and the lane names** (`apps/core-server/src/db/commands/database-names.ts:18`). The acceptance database is therefore `dems_demo`, seeded with the demonstration data set. Whether an installation goes into service on it is a question for the stage 2 ruling.
4. How clients reach a Core on `127.0.0.1`, and the production start command (row 76, D-7 and its note): `9A/H-20` on the tablet depends on it.
5. `HOST-32` (the unit waits for a synchronised clock) against a first boot off the room network.
6. Whether a production boot refuses for a missing helper (row 81 is not built yet): decides whether chapter 4 must precede `9A/H-16`.
7. Whether `REAL_DEVELOPMENT` with generated sources starts on Linux (`capture:dev-setup`, the development key command).
8. Whether `9A/H-08` can be read without a session.
9. The argument form of `db:migrate` and `db:seed`; the collectors' exact texts (rows 128 to 130).

## 6. What stays unproven

Everything in the document. It is the instrument; it has no result. In particular nothing in it was tried against a container or a double: the dry run of the package is row 130.

## 7. Requests

None in `file_requests.md`. Rows 125, 126 and 127 take their file names, identifiers and the form from section 1 of this record.

---
*Generated: 2026-10-12 23:20 (host clock)*
