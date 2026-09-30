---
task_id: 2026-09-30_dems_demo_stack_setup
blueprint_row: 26
agent: verifier
status: complete
verdict: PASS (7/7; 2 CAUTIONs on AC-13/AC-14 command wording; 0 FAIL)
started: 2026-10-01 01:50 WIB
finished: 2026-10-01 02:00 WIB
---

# verifier, step 26: pre-baseline gate (read-only)

## Inputs read
- identification/02_structured.md: row 26, Parallel Execution Protocol P1-P12, row 25 exclusion list
- masterplan/01_specs.md §1.2, §1.4, §1.8, §9 (AC-12..AC-18, AC-27, AC-46)
- research/03_analysis.md SD-04 (RA-1..RA-6)
- implementation/01..05 logs; decisions D29, D30, D35, D41

## Mode
- Read-only. No dev server, emulator, Metro or Gradle was started, and no process was stopped (step 19 owns them).
- My only workspace write: Vitest's result cache, packages/shared/node_modules/.vite/vitest/.../results.json (git-ignored).
- Shared files (masterplan/02_plan.md, status_tasks.md, delegation_progress_report.md, implementation/99_implementation_report.md) were NOT written (P6, P8, parallel-run contract). The controller updates them.

## Result per check
| # | Check | Result |
|---|---|---|
| 1 | AC-12 | PASS: exit 0; 112/112 §1.4 rows; 4 extras approved (D30, D41 a) |
| 2 | AC-13 | PASS in intent (one react and one react-dom, 19.2.3, at root); CAUTION: the literal grep over-matches lucide-react@, @heroui/react@, @testing-library/react@ |
| 3 | AC-14 | PASS in intent (react-native 0.86.3 x1; typescript 6.0.3 x1, literal PASS); CAUTION: same grep defect for react-native |
| 4 | AC-15 | PASS: no output, exit 1 |
| 5 | AC-17 | PASS: 2; no shadcn |
| 6 | AC-46 | PASS: exit 0 |
| 7 | AC-18 pre-commit (S-1 no-drift) | PASS: 5/5; in-memory equal; hashes unchanged |
| Supp. | overrides, scripts, allowScripts, .npmrc, AC-27 static, .gitignore, secrets, single copies | PASS (probe:ws `--` is the recorded S16-1 deviation) |

## For the controller
- F-1: D29-style wording ruling needed for the AC-13 and AC-14 greps (left boundary). Affects step 27's verification cell, step 67 and step 61. The corrected commands are in the report.
- F-2: `.locks/` exists (step 19) and is not ignored yet. Step 25 must append `.locks/` before staging (already in its task text).
- F-5: the row 14 log says "16 root scripts"; the actual count is 14 (doc only).
- Informational: F-3 (@hookform/resolvers not hoisted, same version), F-4 (Skia's react-reconciler nests scheduler 0.25.0), F-6 (a template filename with a space), F-7 (ui_design PNGs, about 9.5 MB, in the baseline per D41 h).

## Artifacts
- verification/05_pre_baseline_gate.md
- delegation_progress/verifier_step_26.md
