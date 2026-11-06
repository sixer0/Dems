---
step: 91a
plan_row: controller micro step 91a (D115; fast lane per D112)
agent: coder-execution
date: 2026-10-01
status: complete
tier: 3
---

# 75 - Mobile tests after the simulator changes (step 91a)

## 1. Result

| Run (`cd apps/mobile`) | Suites | Tests | Exit |
|---|---|---|---|
| Before: `npx jest --maxWorkers=2` | 7 failed, 65 passed (72) | 22 failed, 811 passed (833) | 1 |
| After: `npx jest --maxWorkers=2` | 72 passed (72) | 833 passed (833) | 0 |
| `npx tsc --noEmit` | - | - | 0, no findings |
| `npx eslint .` | - | - | 0, no findings |

The only other output was the sandbox's `failed to copy trust settings` lines. They come from the environment, not from the code.

## 2. Failures and fixes (every fix is in a test, no assertion weakened)

| # | Failure (before) | Cause | Fix |
|---|---|---|---|
| 1 | 18 `stub-param-*` lookups: `routes.test.tsx` 11, `guard.test.tsx` 5, `chrome.test.tsx` 2 | Step 70 wrote these tests against placeholder stubs. Steps 75-88 replaced the stubs with real screens (D88/D90/D108) | The tests now check the real screens' testIDs. Detail views: `session-detail-id`, `evidence-detail-id`, `device-detail-id` and `summary-session-id`, each with the ID it should show. Lists: `sessions-list`, `evidence-list`, `devices-list` and `settings-list`, with no detail screen open. Settings: `settings-section-about`, and About in the tablet's `pane-section`. Wizard: `session-new-step-N`. A pass-through `jest.mock` records the `step` prop that each route passes to the real `SessionNewScreen`, which is the value the stub used to print. This keeps the zod fallback check and the resync-step check as strict as before |
| 2 | `runtime.test.tsx` keep-awake: `SimPermissionError: stopRecording needs a signed-in operator` | Step 54 RBAC on session commands | The test signs in a permitted operator (`budi.santoso`, who has SESSION_START) before `stopRecording`. It also checks that signing in does not release the keep-awake tag |
| 3 | `evidence-detail.test.tsx` EV 0005 expected 0 `EVIDENCE_VERIFY_FAILED` rows | EV 0005 is now tampered on AUDIO-02 when the simulator loads, which closes SIM-GAP-M83-1 | The test now expects exactly 1 `EVIDENCE_VERIFY_FAILED` row with `failedTracks: 'AUDIO-02'`, 0 `EVIDENCE_VERIFIED` rows, `verification.status` FAIL, a last custody entry of `VERIFY_FAILED`, and no `evidence.verify.simGap` log |
| 4 | `haptics.test.ts` MA-20: `Haptics.*` in `features/storage/storage-screen.test.tsx:105,164,179` | That test file called the haptics API through a namespace import (`Haptics.`) | Switched to named imports (`notificationAsync`, `NotificationFeedbackType`), as `chrome.test.tsx` already does. The same calls are still asserted |
| 5 | `brand-media.test.ts` plugin list | Step 94 added `./plugins/with-dems-release-signing` to `app.json` | No action from this step: step 94 updated the test at 10:34, after this step's first run |

## 3. Harness change (test-only)

`apps/mobile/src/navigation/testing/router-harness.tsx`:

- `renderApp(url, { sim })` is a new, optional argument that is passed through to `AppProviders`. Existing callers do not change.
- `routeTestSim(state)` builds the manual-clock test simulator at `TEST_START`. The D61 dataset IDs (`SES-20261001-0017`, `EV-20261001-0007`) therefore exist on any day. The real-clock simulator only has them on 2026-10-01. For `CREATE`, `PRECHECK` and `ARMED`, the helper signs in the demo investigator and drives the simulator with `createSession`, then `beginPrecheck`, then advancing time by `PRECHECK_TOTAL_MAX_MS`. The real wizard's step then matches the fake runtime's session.

## 4. Runtime code

No app code changed, because no failure exposed a runtime bug. I also checked every non-test call site of a privileged action:

- `use-session-new.ts`, `use-monitor.ts`, `session-new-screen.tsx`
- `storage-screen.tsx` (`setStoragePolicy`)
- `device-detail.tsx` and `device-command-dialog.tsx` (`runDiagnostics`, `deviceCommand`)
- `maintenance-section.tsx`

Each call is wrapped in try/catch, shows a toast and writes to the runtime log. RESTART is limited to operators with DEVICE_MANAGE (`useCanManageDevices`). INVESTIGATOR has DIAGNOSTICS_RUN.

## 5. Files changed

| File | Change |
|---|---|
| `apps/mobile/src/navigation/testing/router-harness.tsx` | modify (adds `sim` and `routeTestSim`) |
| `apps/mobile/src/navigation/__tests__/routes.test.tsx` | modify |
| `apps/mobile/src/navigation/__tests__/guard.test.tsx` | modify |
| `apps/mobile/src/navigation/__tests__/chrome.test.tsx` | modify (2 assertions) |
| `apps/mobile/src/runtime/runtime.test.tsx` | modify (keep-awake sign-in) |
| `apps/mobile/src/features/evidence/evidence-detail.test.tsx` | modify (EV 0005 test) |
| `apps/mobile/src/features/storage/storage-screen.test.tsx` | modify (named haptics imports) |

Not touched: `packages/shared/**`, `package.json`, `app.json`, `signing/**`, `plugins/**`, Settings/runtime app code, `features/more/**`. A temporary probe test (`navigation/__tests__/zz-probe-91a.test.tsx`) was created during the work and then removed.

## 6. Known issue (comment only, deferred)

The header comment of `apps/mobile/src/features/evidence/sim-adapter.ts` still describes SIM-GAP-M83-1 as open. Its code needs no change: the comment itself says the row is written "with no change here" once the simulator agrees. Rewording it is left for the post-demo known-issues list.
