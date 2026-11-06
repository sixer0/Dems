# Row 19 - task-architect - install refinement (R2.2)

- Status: complete (proposed classification MINOR; the controller rules)
- Date: 2026-10-22
- File updated: identification/02_structured.md (frontmatter status; new section "R2.2"; section 4 constraints (E-6); table rows 20-79 and 122-128 re-grounded; new rows 139, 140; Execution Profile lines for every touched row; path-evidence count; cost statement; dependency graph; footer)
- No other file written. Nothing executed.

## What was applied
- All of E-1..E-17 (`masterplan/01_specs.md` §6) and R18-1..R18-11 (`masterplan/02_plan.md` §6). Traced in the R2.2 table (R2.2-1..R2.2-10).
- D16 answers: I-13 (row 57 HIL), I-17 (row 123 right after row 21, `123:B` on rows 22/24/33/34/38), I-18 (user at the bench for rows 125-128), I-19 (INSTALL-R-A at row 77), Q96-16 (row 124 N/A).
- G-RF is still pending: row 20 keeps `119:B` and row 26 keeps `121:B`.
- Row 139 was widened per the controller's message: a default `getDeviceHealth` answer in the shared Live bed (`apps/core-web/src/runtime/testing/live-harness.ts`, `createLiveTestBed` :264), then removal of `liveHealth()` from `selector-microphones.test.tsx` (:44). Deps `112:B, 133:B`. Sonnet, size M?.
- Row 140 as briefed: HIL record of the 4 pre-existing `capture/__tests__/static.test.ts` failures. Dep `110:B`. Changes no file.

## For the controller to record / decide
1. Classification of R2.2: MINOR (reasons in R2.2). Install effort +0 % (5.28M), whole blueprint +1.9 % (14.14M). No AC, residual guard, agent type or D-decision changed. Row 124's HIL is gone, but only because the user ruled it N/A (D16 Q96-16 a). HIL is added at 57 (I-13) and 128 (R18-7).
2. Request X-1, not applied (row 97 owns R-FLEX rows): add `139:B` and `140:C` to row 115. Row 100's Depends On also does not yet show D18's `129` wait.
3. Risk on row 139: `live-harness.ts` is imported by about 60 web test files. If the default answer changes any suite outside the devices feature, the row returns `needs-review` and the classification is re-checked.
4. Model changes (8 rows to sonnet: 22, 23, 33, 35, 38, 42, 43, 124) to record in delegation_progress_report.md when delegated.
5. New shared resource name: `passwd-db` (rows 22, 23, 24, 37, 39).
