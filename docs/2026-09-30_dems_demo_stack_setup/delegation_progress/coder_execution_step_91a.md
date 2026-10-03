# coder-execution - step 91a (mobile tests after the simulator changes; D115)

- **Status:** complete
- **Report:** `implementation/75_mobile_tests_after_sim.md`
- **Before:** mobile jest had 7 of 72 suites failing (22 failed, 811 passed of 833 tests).
- **After:** `npx jest --maxWorkers=2` passes all 72 suites and all 833 tests (exit 0). `npx tsc --noEmit` and `npx eslint .` both exit 0 with no findings.
- **Fixes (tests only):**
  - 18 step-70 `stub-param-*` assertions now check the real screens' testIDs.
  - The keep-awake test signs in a permitted operator before `stopRecording`.
  - The EV 0005 test now expects one `EVIDENCE_VERIFY_FAILED` row (AUDIO-02).
  - `storage-screen.test.tsx` uses named haptics imports, so the MA-20 check passes.
  - The plugin-list pin in `brand-media.test.ts` was already fixed by step 94.
- **Harness:** `router-harness.tsx` gains an optional `sim` argument and `routeTestSim(state)`: a deterministic simulator at `TEST_START`, signed in and driven to CREATE, PRECHECK or ARMED.
- **Runtime fixes:** none. Every privileged call site was checked and each one is guarded (try/catch, toast, persistent log).
- **Files:** `apps/mobile/src/navigation/testing/router-harness.tsx`, `apps/mobile/src/navigation/__tests__/{routes,guard,chrome}.test.tsx`, `apps/mobile/src/runtime/runtime.test.tsx`, `apps/mobile/src/features/evidence/evidence-detail.test.tsx`, `apps/mobile/src/features/storage/storage-screen.test.tsx`.
- **For the controller:** set row 91a to done in `masterplan/02_plan.md` and `status_tasks.md`. I did not edit those files because this was a parallel run. One known issue, comment only: the header of `features/evidence/sim-adapter.ts` still describes SIM-GAP-M83-1 as open. Nothing was committed.
