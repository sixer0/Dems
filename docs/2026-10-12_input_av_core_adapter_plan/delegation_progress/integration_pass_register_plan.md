---
task_id: 2026-10-12_input_av_core_adapter_plan
agent: pm-planner
subject: Integration pass of the decision register (row 9) and the phased plan (row 10)
date: 2026-10-12
status: complete
---

# Progress: integration pass, register and plan

## Status

complete. Two files updated in place by targeted edits, one file created (this one). No source file, `masterplan/01_specs.md`, `masterplan/03_db_schema_extension.md`, `test/01_hevc_experiment.md` or `decisions/decisions.md` was modified. Nothing was run; only reads and searches inside the task folder. Nothing under `apps/input-av/data/` and no `.env` was opened. Nothing was written outside the task folder.

The run was interrupted once (network error) and resumed from the files' state; no edit was repeated.

## Inputs, in the order they arrived

| Input | Source | Applied |
|---|---|---|
| First brief: U4 to U10, P7, P8; Amendment 1; schema design; HEVC status | `decisions/decisions.md:14-22`; `masterplan/01_specs.md` (F-4, section 9); `masterplan/03_db_schema_extension.md`; `delegation_progress/amendment_1_network_tools.md` | yes |
| U11: OQ-1 to OQ-5 accepted | `decisions/decisions.md:23`, read in the file | yes |
| U12, U13, P9: every open entry answered; two tracks; a test-package work package | `decisions/decisions.md:24-26`, read in the file | yes |
| HEVC result | `test/01_hevc_experiment.md`, re-read in full after it changed from `blocked` / "NOT RUN" to `complete` | yes |

## Files

| File | Action |
|---|---|
| `decisions/01_decision_register.md` | updated, version 1.0 to 1.1 |
| `masterplan/02_plan.md` | updated, version 1.0 to 1.1 |
| `delegation_progress/integration_pass_register_plan.md` | created |

## What changed in the register

- Head (Bahasa Indonesia): "Sudah diputuskan", 31 lines each with its U-row; "Yang masih tersisa": 3 small items, 2 pending outcomes plus the real-camera H.265 check, 7 user actions tied to the hardware test package, 1 later ruling.
- Q10 answered in 5 of 5 parts (U6, U7, U9, U10, U12 A10).
- New entries AM-4 to AM-8 (D75, D80(1), D80(10) for commissioning, D81 with D80(7), D76 (3)), each with what changes, what does not, when, who; all accepted by U12 A6.
- New entries OQ-1 to OQ-5, all answered by U11.
- Q8, Q3, Q6, Q7, Q9, NEW-1, F-1, F-2, AM-1 to AM-3 each carry an "ANSWERED" or "RULED" line with the U-row; the option tables are kept as the record.
- F-2 carries the experiment's result in the report's own figures and its unproven list.
- Section 6 is now the list of user actions of the hardware test package (X-1, X-2, UA-1 to UA-6).
- Counts: 16 answered entries, 0 open, 2 forks ruled, 8 amendments accepted, 2 external items plus 6 user actions.

## What changed in the plan

- 27 work packages in 12 phases (0 to 11), two tracks. Track D (development Mac, doubles): phases 0 to 8 and 10. Track H (hardware acceptance): phases 9 and 11.
- New work package **WP-27**: the hardware acceptance test package (procedure document plus scripts), phase 7, size M by this plan's sizing. WP-15 is its run, phase 11.
- Phase 0 re-defined: plan verified, task 3 baseline commit, branch.
- WP-24 first in phase 2; WP-25, WP-23, WP-19, WP-22, WP-26 in the new phase 10; WP-12 in scope in phase 8; WP-16 and WP-17 not planned; WP-18 deferred.
- Section 8: per package the double used in track D and what stays unproven until track H.
- Section 9A: checks H-01 to H-20, each with precondition, steps, expected result, pass criterion, user actions.
- Sections 6, 11, 12, 13, 14, 15, 16, 17, 18, 19 updated; section 21 (time estimate) and section 22 (consistency check) added.
- WP-01 marked partly done: E-1 and E-2 pass; E-8, E-10, E-11 and the verdict remain.

## Consistency check, with numbers

| Check | Result |
|---|---|
| WP rows in `masterplan/01_specs.md` section 9 | 23 (WP-01 to WP-23), by search of the table rows |
| WP rows in `masterplan/03_db_schema_extension.md` section 3.2 | 3 (WP-24 to WP-26) |
| New in the plan | 1 (WP-27) |
| Union | 27 |
| Rows of the plan's tracking table (section 10) | 27, by search; each number once |
| Missing from the plan / extra in the plan | 0 / 0 |
| Packages per phase | 2, 4, 4, 2, 2, 1, 1, 4, 1, 5, 1 for phases 1 to 11; sum 27 |
| Packages per class | D 20, C 2, N 3, H 2; sum 27 |
| WP numbers outside 01 to 27 in the register or the plan | 0, by search |
| Register entries still marked open that a U-row answered | 0. The word "open" remains only in counts ("0 open entries") and in the version 1.0 check table, which is marked as superseded |
| Indonesian head against the body, register | 31 decided lines match section 1; the remaining items match sections 5.1, 5A and 6 |
| Indonesian head against the body, plan | 27 packages, 12 phases, two tracks, H-01 to H-20, R-22, the estimate figures: each matches its section |

## Decisions and open points for the controller to record

1. **WP-27 is new** and its size M is this plan's. Accept or re-size.
2. **Reading of P8 (log item I-14).** P8 does not say which packages its "6-9 working days" count and predates U12 and U13. Section 21 reads it as the 11 development-host packages on the recording path (17 units) and re-derives track D at the same rate: about 11 to 16.5 working days before the +40 to 50 %, about 15 to 25 with it; track H 4.5 to 7.5, about 6 to 11 with it. P8's "2-3 calendar weeks" is not restated as a total, because the wait for the devices now lies inside it.
3. **Choice inside AM-7 (I-12):** credential typed again for adoption, or alive for one commissioning job. The design gives no recommendation, so U12 does not answer it. Needed before WP-22.
4. **Writer of the installation acceptance record (I-11):** set C has a table and no package that writes it. If the function adds a gate that refuses recording, that is a scope question for the user.
5. **WP-23 and WP-25 (I-9):** the plan adopts the schema design's split; `masterplan/01_specs.md` still words WP-23 as including the persistent data.
6. **WP-14 and WP-19 (I-10):** the design's dependency "WP-14, build: helper installed" is an installation, which is the user's act in track H; in track D WP-19 is built on a helper double.
7. **P3 (I-16)** is not named in U12's A1 to A10; listed as a small remaining item.
8. **Approval of the schema design as a document:** read from U8, U11 and U12 B4 together; no row says it in so many words.
9. **Amending decision rows** for AM-2 to AM-8 are the controller's to write under U12 A6 (phase 0); AM-1 at the lift.
10. **Not available to this row:** row 13's findings; the controller's A and B list of the conversation (only its summary in `decisions/decisions.md:24`); whether a Linux container or VM can run on the development Mac.
11. The controller's statement that it re-probed the HEVC files independently is recorded in the register as the controller's statement; it is not in the report file.
12. Line references into `masterplan/01_specs.md` written by version 1.0 of both files point into the file before Amendment 1 and were not re-numbered.

## Not done, by limit

- `masterplan/01_specs.md` and `masterplan/03_db_schema_extension.md` were not edited: they still show WP-19, WP-22, WP-08 and WP-14 with a Linux host as their place of verification, and name OQ-1 to OQ-5 as questions.
- `README.md`, `status_tasks.md` and `delegation_progress_report.md` were not touched.
