---
step: 75b
decision: D111
agent: coder-execution
status: complete
finished: 2026-10-01T10:32+07:00
---

# Step 75b: jest transform for victory-native's d3 ESM deps (progress)

| Event | Detail |
|---|---|
| Inputs | Read `apps/mobile/jest.config.js`. victory-native 42.0.1 depends on d3-scale, d3-shape and d3-zoom. All 17 installed `d3-*` packages and `internmap` are `"type": "module"`. `its-fine` and `react-fast-compare` resolve to CommonJS, and `victory-vendor` belongs to recharts |
| Baseline | Full suite with `--maxWorkers=2`: 6 of 71 suites failed, and 22 failed, 806 passed of 828 tests. There were 4 d3-scale `Unexpected token 'export'` errors, in chrome (1), guard (1) and routes (2) |
| Edit | Added `\|d3-.*\|internmap` to the `transformIgnorePatterns` allowlist after `victory-native`, with a D111 comment. Nothing else changed |
| After | Full suite: 6 of 71 suites failed, and 21 failed, 807 passed of 828 tests. **0 d3/internmap parse errors**. Of the 21 failures, 18 are step 70 `stub-param-*` assertions (routes 11, guard 5, chrome 2), owned by step 57. The other 3 (evidence-detail, runtime keep-awake, haptics MA-20) were failing in the baseline too and still fail in an isolated re-run |
| Gates | Mobile `tsc --noEmit` exit 0, `eslint .` exit 0 |

**Status: complete.**

**Files written:**
- `apps/mobile/jest.config.js`: one allowlist edit plus a comment
- `docs/2026-09-30_dems_demo_stack_setup/implementation/74_jest_d3_transform.md`
- `docs/2026-09-30_dems_demo_stack_setup/delegation_progress/coder_execution_step_75b.md`

**For the controller:** set row 75b to done in `masterplan/02_plan.md` and `status_tasks.md`. I did not edit either file because this is a parallel run. Three failures are not stubs and are not d3-related: evidence-detail (`EVIDENCE_VERIFY_FAILED` row count), runtime keep-awake (`SimPermissionError` on stopRecording), and haptics MA-20 (`Haptics.*` in `storage-screen.test.tsx`). Each needs an owner.
