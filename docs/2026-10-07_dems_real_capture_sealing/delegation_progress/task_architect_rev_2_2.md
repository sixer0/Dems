---
task_id: 2026-10-07_dems_real_capture_sealing
agent: task-architect
date: 2026-10-09
row: blueprint maintenance, rev 2.1 -> rev 2.2 (incl. the coordinator's addition for the test catalogue)
status: complete
proposed_class: MINOR (controller confirms)
---

# Task-architect record: blueprint rev 2.2

## 1. Result

`identification/02_structured.md` was edited in place as rev 2.2. Eight rows were reworded
(57, 58, 64, 66, 82, 84, 115, 117), one dependency was added (58 <- 113), and three narrative places
were updated for the new catalogue check and totals. No row was added, removed or renumbered; no
Agent_to_Invoke and no Expected Output path changed. Section 10 (wave table) is unchanged. Proposed
classification: MINOR.

## 2. Inputs read

| Input | Used for |
|---|---|
| `identification/02_structured.md` (rev 2.1, 623 lines) | the file edited |
| `masterplan/11_audit_errata.md` §5 (lines 190-329), §5.4 and §5.5 | exact sentences for rows 57, 58, 84; test-catalogue list |
| `decisions/decisions.md` D63-D68 (lines 76-81) | source decision of each change; pairing protocol |
| `delegation_progress/data_analyst_pair_errata_2026_10_09.md` §5 (lines 109-115) | same three sentences; identical to errata §5.4 |
| `masterplan/05_capture_architecture_spec.md:369-373,388-390` | action names and their owners (rows 58, 66, 82) |
| `apps/core-server/src/modules/stt-config/index.ts:111,137,151` | `sttConfigControl(app).provideProbe` exists as named |
| `masterplan/10_test_strategy.md:169,602,622` | `M3-REC-1` exists; totals 219 active + 10 conditional |
| `delegation_progress/test_expert_pair_catalogue_t1_t10.md:30-39,61-65,104-106` | T-8, T-9, T-10; M3 = 22; open points O-2 and O-4 |

## 3. What changed (line numbers of the file after the last edit)

| # | Where | Line | Change | Source |
|---|---|---|---|---|
| H | front matter | 6-10 | `revision` 2.1 -> 2.2; `revision_row` and `status` extended; new `revision_2_2_note` | this pass |
| 0 | §0 heading | 22 | "(rev 2.1, maintained as rev 2.2 — see 0.2)" | this pass |
| L | new §0.2 | 63 onward | change log table (12 changes), the section-10 statement, the D63 pairing protocol as an execution note | D63, D65-D68 |
| 1 | row 57, Task Description | 246 | closes list replaced by the errata §5.4 sentence | D65(b), D65(c), D67 |
| 2 | row 58, Task Description + Depends On + Verification | 247 | errata §5.4 sentence added; Depends On `57, 111` -> `57, 111, 113`; Verification extended | D66, D67, D65(c), D65(g) |
| 3 | row 66, Task Description | 255 | one clause: the hosted pair `switchAudioSource` / `setCaptureConfig` of SH-18 | D65(b) |
| 4 | row 82, Task Description | 271 | existing "CS-04 engine host INTERNAL actions" clause now names `applySealingProgress` / `completeSeal` | D65(b), D67 |
| 5 | row 84, Task Description + Verification | 273 | errata §5.4 ownership sentence; its "Verification adds" part placed in the Verification cell | D68(c) |
| 6 | row 115, Task Description | 304 | one clause with the probe rules | D68(d), D68(c) |
| 7 | row 117, Task Description | 306 | one clause: reference form only until row 84; shared client-side blanking rule set | D68(c), D68(a) |
| 8 | row 58, Verification | 247 | `M3-REC-1` named (lossless record path, run once) | catalogue change T-8 |
| 9 | row 64, Task Description + Verification | 253 | `M3-REC-1` in the M3 gate list; the gate owns the T-10 log-line note | T-8, T-10; test-expert O-2 |
| 10 | row 84, Verification | 273 | the `SECRET`-write 200 clause labelled as the 200 half of `M6-STTCFG-API` | T-9; test-expert O-4 |
| 11 | row 115, Verification | 304 | one clause: operation 92 answers 200 on a booted server once the probe is provided | T-9; O-4; D68(d) |
| 12 | §4.1 Impact row; §6 M3 line; Verification & Testing Strategy, integration bullet | 165, 321, 555 | totals 207 + 18 -> 219 active + 10 conditional (M3 = 22); `M3-REC-1` and the T-10 note in the M3 line; `M3-REC-1` in the integration list | `10_test_strategy.md:622` |
| S | self-check | 625, 642 onward | heading extended; new block "Rev 2.2 re-check" | this pass |
| C | change classification | 662 onward | new block "Rev 2.2 — proposed classification: MINOR" with the seven MAJOR criteria | this pass |
| F | footer | 680 | Last Updated 2026-10-09 | this pass |

Check totals: section 4.1 (line 165) was the only place in the file that quoted catalogue totals; it
now reads 219 + 10 with M3 = 22 and keeps the rev-2.1 figure as history.

Not changed: Step numbers, Agent_to_Invoke, Expected Output and Phase of every row; the Verification
cells of rows 57, 66, 82 and 117; sections 1-3, 5, 7-9, the Gate Questions, the Dependencies table,
section 10, the risk and recommendation sections, the agent mapping.

## 4. Checks run after the edit

| Check | How | Result |
|---|---|---|
| 7 cells in every row, row count | Grep, pattern accepting exactly 8 unescaped pipes on a row line, steps 41-119, re-run after the last edit | 79 of 79 lines match |
| Dependency 58 <- 113 | row 113 exists; it depends on 56 and 112 | no cycle |
| Wave levels | 57 = L10, 111 = L10, 113 = L10 (all in W11), so 58 = L11 as before | nothing shifts; section 10 untouched |
| `M3-REC-1` exists | Grep in `masterplan/10_test_strategy.md` | found at `:169`, `:602`, `:622` |

## 5. Wording decisions made in this pass

| # | Decision | Reason |
|---|---|---|
| A-1 | Row 66 says "the hosted pair ... of SH-18", not "INTERNAL actions" | The capture spec lists `switchAudioSource` / `setCaptureConfig` as hosted and the other four as INTERNAL (`05_capture_architecture_spec.md:369-373`). The delegation prompt called both groups INTERNAL |
| A-2 | Row 82 was already half-implied ("CS-04 engine host INTERNAL actions"); the clause was sharpened in place rather than added | The row did not name the two actions or SH-18. The trigger rule for `completeSeal` (lossless record, never `PROGRESS`) comes from `05_capture_architecture_spec.md:389` |
| A-3 | Row 84: the "Verification adds" half of the §5.4 sentence went into the Verification cell, the rest into the Task Description | Keeps one verification statement per row |
| A-4 | Row 64 carries the T-10 line as a gate note, in both its Task Description (ownership) and its Verification (the two quoted strings) | The catalogue states it is "not a named check"; the row therefore quotes the strings instead of an ID |
| A-5 | `status` in the front matter was changed from "draft-for-second-approval" | Rev 2.1 was approved at D24; the old value beside "rev 2.2" would mislead a reader. The controller may reword it |

## 6. Classification

Proposed MINOR. No new scope or feature, no agent change, no new module, no intent change, no flow
restructuring (one edge, no level shift), no contradiction of an approved decision (D24 stands; SH-18
and CS-04 still close, at rows 58, 66 and 82). Effort: under 30 % for the blueprint as a whole, as an
estimate and not a measurement; row 58 alone grows materially. The catalogue additions (changes 8-12)
add one check and one log line to the M3 gate and restate two answers that the catalogue already holds.

## 7. Items for the controller

| # | Item | Suggested owner |
|---|---|---|
| C-1 | Row 58 is now the broadest row: 13 inherited items, of which (3) and (4) are supervisor-side and engine-side, not worker code. It stays one row by instruction. If the driver or the navigator cannot close it as one unit, a split is a new revision with its own classification | controller |
| C-2 | Section 5.6 (register closure map) lists the SH family without rows 58 and 66, although SH-18 now lands there. Not edited (outside the allowed changes) | controller, next maintenance pass |
| C-3 | Executed row 48 still names SH-18 in its closes list; D65(b) ruled that claim false. Not edited | controller |
| C-4 | Row 57's Verification cell still reads "a killed worker respawns under the supervisor" without the D67 scope; the scope is now in its Task Description. Not edited (the instruction limited row 57 to the Task Description) | controller |
| C-5 | Section 10 quotes the D5(c) ceiling (4 per type); D63(d) sets 8 in flight with a pair counting as two. Not edited | controller |
| C-6 | Unedited rev-2.1 text still speaks of the second approval as pending (Summary "Next approval", Dependencies DP-2, P0 recommendation). The front matter note says so | controller, optional |
| C-7 | The errata file and the data-analyst record cite pre-edit line numbers of `10_test_strategy.md` (`:231`, `:406`, `:407`; test-expert O-3). The blueprint cites check IDs, not those lines, so nothing here depends on them | controller, note only |

## 8. Files

| File | Action |
|---|---|
| `identification/02_structured.md` | updated in place (rev 2.2) |
| `delegation_progress/task_architect_rev_2_2.md` | created (this file) |

Not written, by the parallel-run rule: `delegation_progress_report.md`, `status_tasks.md`.
