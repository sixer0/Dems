# Rows 9 and 10 progress: decision register and phased plan (pm-planner)

| Field | Value |
|---|---|
| Rows | 9, then 10 |
| Agent | pm-planner (reasoning tier, per the Execution Profile) |
| Date | 2026-10-12 |
| Status | complete; both artifacts are provisional on the open entries, as the blueprint allows |
| Artifacts | `decisions/01_decision_register.md`; `masterplan/02_plan.md` |

## Verification criteria

| Row | Criterion | Result |
|---|---|---|
| 9 | Four answered entries, each citing its row in `decisions/decisions.md` | 4 of 4 (Q1, Q2, Q4, Q5) |
| 9 | Six open entries with two or more options and one recommendation | 7, not 6: NEW-1 added, deviation stated at the top of the register |
| 9 | Every blocked WP exists in step 8 | yes, 15 packages named, all in `masterplan/01_specs.md:374-396` |
| 10 | Every WP in exactly one phase and one need-class | 21 of 21; phases sum to 21; D 6, W 9, H 6 |
| 10 | Completion check and rollback per phase | 10 of 10 phases |
| 10 | Blocking list of each phase matches step 9 | matrix in plan section 11 repeats the register's direct-block column |

## Limits observed

- No source file opened or modified. Nothing run. Nothing under `apps/input-av/data/` and no `.env` opened. `decisions/decisions.md` not written.
- Files written: the two artifacts and this file, all inside the task folder.
- Inputs read: `identification/02_structured.md`, `decisions/decisions.md`, `masterplan/01_specs.md` (in full), parts of `research/03_analysis.md` (sections 7 to 15) and `research/03_analysis_record_map.md` (sections 6 to 11), `status_tasks.md`, `delegation_progress/row_08_port_design.md`; searches in `research/02_collection_rulings.md`, `initialization/01_env_check.md`, `identification/01_translated.md`.

## Milestones

- Register: 4 answered, 7 open, 2 forks needing a ruling (F-1, F-2), 3 amendments (AM-1 D86 C-5, AM-2 D82, AM-3 D80(10)), 2 external dependencies (X-1, X-2); Bahasa Indonesia answer table of 13 lines at the top.
- Plan: 10 phases (0 to 9); standing rules SR-1 to SR-8; system of record per phase; critical path; 18 risks; decisions-to-phase matrix.

## Points for the controller to record or decide

1. NEW-1 is carried as a seventh open entry; the blueprint's check counts six.
2. `decisions/decisions.md:5` (P1) still reads "UNCONFIRMED" for the assumption that P4 closes.
3. Rows 7 and 8 name different "five P3 differences" (overlap on two). The register lists row 8's five as departures D-1 to D-5 and row 7's other three as wording notes N-1 to N-3. The controller chooses the confirmation wording.
4. WP-08: the design gives it a Linux host, while WP-13 depends on it and L-5 asks for completion on doubles. The plan closes it on doubles in phase 4 and on the interface (E-5) in phase 7. For row 12.
5. Measure SA-2 has no work package if E-11 shows it must be a worker change. For row 12.
6. No ruling covers what the bench installation of input-av may record before the Core can record production sources. A rule is proposed in plan section 6; it needs the user.
7. No tolerance exists for the drift measured by E-9.
8. WP-21 against "nothing under data/ is modified": resolved as a user-only guard that changes no file content, with a form that touches nothing. For row 13.
9. Task 3 baseline is made an entry condition of phase 1. This row could not establish whether files under `apps/core-server/` or `apps/capture-worker/` are modified: the status snapshot it saw was truncated and it runs no command.
10. Hypothesis H-K (sync level on Linux) may add an amendment of D189; noted under Q7, not made an entry.

## Blockers

None.

## Note on instructions

The agent's base instructions say not to write report files; the delegation and the Documentation Contract require these artifacts. The delegation was followed.
