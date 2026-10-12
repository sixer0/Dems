---
task_id: 2026-10-12_input_av_core_adapter_plan
agent: task-architect
type: blueprint refinement, WP-13a only (targeted edits in place)
date: 2026-10-12
status: complete
basis: research/027_selector_assumptions.md (row 27); decisions/decisions.md C18; verification/04_security_addendum.md AD-04, AD-10; masterplan/04_design_addendum.md section 1
---

# Refinement of the WP-13a rows of the implementation blueprint

File changed: `identification/03_implementation_blueprint.md`. No application file was touched; no shell was used. No step number was changed. Rows 2, 3, 4, 13, 19, 20, 27, 38, 52, 87, 95, 103, 147, 160 were not edited.

## Changed rows (cells only)

| Step | What changed |
|---|---|
| 28 | Narrowed to the shared contract (the `unassign` member, the change type, the domain type A9, the strings); depends on 161:B; size M to S |
| 29 | Narrowed to the capture-config module (A1, A2, `unassign` through operation 78); the row mapping moved to 166; depends on 162:B and 166:B |
| 30 | Re-owned: a test-only row in the Core's capture-notices tests (the item is decided in shared code, row 163); `precheck.ts` not edited |
| 31 | Sites W1, W2 named; the microphone command; ownership narrowed to two verified files |
| 32 | Sites M1, M2 named; the assign offer added (C18 (3)); ownership corrected from `features/devices/` to `features/capture-selector/` |
| 33 | Dependencies only: 29:B, 30:B, 163:B, 166:B |
| 35 | Dependencies and scope: rows 162 to 173 added |
| 36 | Gate condition AD-04: rows 166 and 172 added, with the count check 5, 31, 24 |
| 149 | Marked as the row that closes the package; carries the gate "full reader inventory; nothing by position" and the count check against row 27; dependencies widened |
| 150 | Narrowed to the three not-safe server readers in `modules/devices/status.ts` (B11 to B13); UNKNOWN replaced by a verified path; depends on 164:B |

## Added rows

| Step | Subject | Size | Model |
|---|---|---|---|
| 161 | Names register of the package (lookup by role, 24 call sites, names, two rules drafted) | S | opus |
| 162 | Shared: hosted action rewritten (C9 to C12) | M | opus |
| 163 | Shared: session machine, start refusal and pre-check item (C1, C2, C4, C5, C7) | M | opus |
| 164 | Shared: lookup by role lands (C16, C18) | S | opus |
| 165 | Shared: simulator answers and remaining callers (C17, C23, C24, C25) | S | opus |
| 166 | Server: selector row mapping (A3, A4, A5) | S | opus |
| 167 | Web: pre-check screen (W3) | S | opus |
| 168 | Web: meter readers (W4 to W6) | S | opus |
| 169 | Mobile: pre-check screen (M3) | S | opus |
| 170 | Mobile: live-session microphone readers (M4) | S | opus |
| 171 | Mobile: meter readers outside the live session (M5, M6) | S | opus |
| 172 | Shared: `micInputOfChannel` deleted, static test (C15) | S | opus |
| 173 | Conditional: profile correction per video slot (A8) | S | opus |

## Other places edited in the same file

Section 0 (row counts), section 4 (package table, WP-13a line), the Execution Profile (lines 28 to 33, 35, 149, 150; new lines 161 to 173; the honesty paragraph), section 7 (two tokens: `sel-map`, `sh-hot`), section 8 (cost table, duration note, new subsection 8.1 with the carrier table, the 24 files, the doubles, the waves and the critical path), section 9 (gate M2), section 11.1 (P12-B1, P12-F02), 11.2 (AD-04, AD-10), 11.3 (two lines), section 13 (finding 5, one recommendation, decisions 6 to 9), section 14 (42 verified paths), section 16 (self-check counts).

## Totals after the refinement (estimates where sizes are concerned)

- Rows 173: 162 unconditional, 10 conditional, 1 not delegated (before: 160 / 150 / 9 / 1).
- Size S 105, M 68, L 0. Model opus 155, sonnet 17.
- Waves 19; level 0 unchanged at 39; widest wave of the package is its level 3 with 11 rows.
- Critical path not moved; gate M2 two levels later (level 8).
- Duration: about 0.7 to 1 working day more.
- Row 27 sites carried by exactly one row: 5 of 5, 31 of 31; fallback files 24 of 24.
- `EXISTS:` paths added 42, all verified by Glob in this pass.

## For the controller to decide (section 13, decisions 6 to 9)

6. Simulated mode with an incomplete selector: start refused (drawn, as addendum 1.5) or starts as today (the literal reading of C18 (1)).
7. The meter channel of a microphone line: ruling D137 kept for a complete pair, or amended (row 161 drafts both).
8. One microphone role assigned alone, or only the pair in one body (row 161 drafts).
9. Row 27 OPEN 3: accepted (row 173 skipped) or fixed.

## Limits

- Levels were recomputed by hand for the rows of the package only; the totals of the levels other than 0 were not recomputed for the whole table.
- Sizes, models, budget and duration are estimates.
- A search in this pass found 23 non-test files that name the positional function or its inverse; row 27 counts 24, the 24th (`use-mic-source.ts`) reaching it through `mic-source-model.ts`.
