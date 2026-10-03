---
task_id: 2026-10-04_dems_backend_rbac_pairing
step: 13
agent: verifier
status: complete
date: 2026-10-04
---

# Progress: verifier, blueprint row 13 (baseline gate on the unchanged tree)

## Status

complete. Verdict written in the artifact: `PASS-WITH-NOTES`.
The measurement is complete and the tree is untouched. The baseline itself is not all green: `@dems/core-web` tests exit 1 with 2 clock-dependent failures of 438.

## Artifacts

| Path | State |
|---|---|
| `docs/2026-10-04_dems_backend_rbac_pairing/initialization/02_baseline_gate.md` | created |
| `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/verifier_step_13.md` | created (this file) |

No other file was written in the repository. `git status --porcelain` was identical before (01:48:28 WIB) and after (01:55:58 and 01:57:50 WIB); `git status --porcelain --untracked-files=all | grep -v ' docs/'` printed 0 lines both times.

## Results (quoted from the runners; details in the artifact)

| Workspace | Typecheck | Lint | Test exit | Files / suites | Tests |
|---|---|---|---|---|---|
| `@dems/shared` | exit 0 | exit 0 | 0 | `28 passed (28)` | `508 passed (508)` |
| `@dems/mock-core` | exit 0 | exit 0 | 0 with the sandbox bypass (1 inside the sandbox, `listen EPERM`) | `4 passed (4)` | `19 passed (19)` |
| `@dems/core-web` | exit 0 | exit 0 | **1** | `2 failed \| 37 passed (39)` | `2 failed \| 436 passed (438)` |
| `@dems/mobile` | exit 0 | exit 0 | 0 | `72 passed, 72 total` | `833 passed, 833 total` |

Root `npm run typecheck`: exit 0. Root `npm run lint`: exit 0.

## Milestones

1. 01:48 Read row 13 and P7, P9, P10, P11; read the root and workspace `package.json`; saved the before-snapshots.
2. 01:48-01:50 Typecheck and lint per workspace: all exit 0. Confirmed the checks are not empty (file counts from `tsc --extendedDiagnostics` and the JSON reporters).
3. 01:50 shared tests: 508 passed.
4. 01:50 mock-core tests: exit 1 inside the sandbox (`listen EPERM`); re-run with the bypass: 19 passed (both runs recorded).
5. 01:51 core-web tests: 2 failed, 436 passed. Re-ran the two files once: same result (both runs recorded).
6. 01:52-01:56 Read-only diagnosis of the two failures: both depend on the wall clock (seeding probe and a shifted-clock run from the scratchpad).
7. 01:53-01:54 mobile tests: 833 passed, 72 suites.
8. 01:55-01:57 After-snapshots: identical. No process or listener left.

## Blockers

None for this row.

## Decisions and findings for the controller to record

| ID | Finding | What the controller has to decide |
|---|---|---|
| B13-1 | **F-1** `apps/core-web/src/test/sim-fetch.test.ts` > "export as SUPERVISOR: 202 with an EVIDENCE_EXPORTED audit row (the demo-data payload)" fails with `expected 404 to be 202` on every WIB date other than 2026-10-01. The test uses the fixed ID `EV-20260930-0004`; the simulator derives IDs from today's date | Later gate rows (19, 20, 109) will see core-web exit 1 for this test until it is fixed or accepted. Either accept it as a known baseline failure and compare failing tests by name, or schedule a fix slot for the test |
| B13-2 | **F-2** `apps/core-web/src/features/storage/__tests__/storage-page.test.tsx` > "AC-75: the ring shows 20% labelled USED, …" fails with `Sealed Evidence5 today` instead of 7 when the suite runs between 00:00 and about 02:25 WIB (source comment says about 02:50; predecessor hypothesis H-32-1) | A gate run in that window fails for a reason unrelated to the row under test. Either avoid the window, accept the failure by name, or schedule a fix slot |
| B13-3 | The root script does not forward extra arguments: `npm test -- --maxWorkers=2` from the root does not limit the workers (measured for `typecheck`, inferred for `test`) | For P9, gate rows should use `npm run test -w <workspace> -- --maxWorkers=2`, one workspace at a time |
| B13-4 | mock-core tests need the sandbox bypass (loopback port binding, including 4410/4411 when free) | Gate rows need one bypassed command for `@dems/mock-core` |
| B13-5 | Reference numbers hold for the counts: shared 508, mock-core 19, core-web 438 (total), mobile 833 in 72 suites | The baseline for later comparison is: core-web 438 tests with F-1 and F-2 as the only known failures |

## Deviations

- The agent definition names `implementation/99_implementation_report.md` and a tracking update in `masterplan/02_plan.md`. The row asks for exactly one artifact, and `masterplan/02_plan.md` does not exist yet, so neither was written.
- Root `npm test` was not run as one command (it would need the bypass for the whole run). Per-workspace runs were used, as the row instructs.
- Extra read-only diagnostics were run to classify the two failures (section 6.2 of the artifact). They used scratchpad files only.
- Left in place, outside the repository: three temporary folders `/tmp/claude-501/dems-launcher-*` (56 KB each) from the sandboxed mock-core run.
