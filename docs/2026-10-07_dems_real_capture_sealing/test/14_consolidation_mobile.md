---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-11
agent: test-expert
step: test-suite consolidation, mobile workspace (owner M of test/13 section 7.3)
decisions: D233, D238
tree: a5d75ed + the working-tree edits of this note (no commit, no git write)
status: complete, with open items (section 9)
---

# 14 - Test-suite consolidation: `apps/mobile`

Scope: test files and test support of `apps/mobile` only. No product file changed (`git status --short
apps/mobile` lists test files and files under `testing/` folders only: 49 modified, 58 deleted, 21
new). No git write, no install, no lane, no emulator, no Gradle, no adb. Product files were edited
three times for a mutation proof and restored from a copy each time (`cmp` identical; section 6).

## 1. Before / after

Command of both whole runs, the one of `test/12_precommit_wave_m.md` row 7 with its JSON report:
`npx -w apps/mobile jest --maxWorkers=2 --json --outputFile=<scratchpad>/x.json`.

| | suites | tests | Jest "Time" | wall | 1-minute load, start -> end | "A worker process has failed to exit gracefully" |
|---|---|---|---|---|---|---|
| run 12 (same tree `a5d75ed`, the reference without load) | 311 | 2924 | 194.2 s | 195 s | 4.6 -> 5.9 | PRESENT |
| BEFORE (this session, 17:09) | 311 passed | 2924 passed | 357.1 s | 358 s | 1.3 -> 102.9 (the other owners' suites started under it) | PRESENT |
| AFTER (this session, 18:44) | 272 passed | 2915 passed | 201.0 s | 202 s | 3.2 -> 5.1 | ABSENT (0 lines) |

- Test FILES: 311 -> 272 (-39). Static `it` / `test` call sites: 2524 -> 2515. Run tests: 2924 -> 2915.
- The count delta is -9, and it is the 9 tests of section 5 (M6), one each in 9 files. Every other
  file has the same number of run tests as before, or the sum of what was merged into it (section 3;
  checked per file from the two JSON reports: 0 mismatches).
- Wall time: NOT shown to be shorter. My BEFORE run cannot be compared (load 100). Against run 12 the
  AFTER run is 201 s to 194 s; three more whole runs after the changes gave 178.5 s (load 2.8 -> 7.1),
  174.1 s and 172.0 s (the two diagnostic runs of section 2, `--silent`). The host was shared with the
  other owners the whole time. What is measured: the countdown file went from 18.8 s (run 12) to
  about 2 s; the sum of the per-file times is 376 s in run 12 and 345 to 391 s after.
- Typecheck `npm run typecheck -w @dems/mobile`: exit 0, 0 `error TS`. Lint `npm run lint -w
  @dems/mobile`: exit 0, 0 errors, the 1 known warning (`src/runtime/log.test.ts:160:19
  @typescript-eslint/array-type`).

Slowest 10 suites, run 12 (the unloaded reference before):

| # | file | tests | s |
|---|---|---|---|
| 1 | `src/features/session-new/wave-h-z2-countdown-sources.test.tsx` | 2 | 18.8 |
| 2 | `src/features/evidence/evidence-detail.test.tsx` | 9 | 11.0 |
| 3 | `src/features/storage/live-storage-sites.test.tsx` | 15 | 9.2 |
| 4 | `src/features/pairing/pairing-live.test.tsx` | 28 | 8.2 |
| 5 | `src/features/capture-selector/local-source-start-notice.test.tsx` | 8 | 5.6 |
| 6 | `src/runtime/connection-banner-live.test.tsx` | 9 | 5.5 |
| 7 | `src/features/devices/devices-states.test.tsx` | 4 | 4.5 |
| 8 | `src/features/devices/live-devices-sites.test.tsx` | 22 | 4.5 |
| 9 | `src/features/capture-selector/wave-h-mic-lines.test.tsx` | 23 | 4.5 |
| 10 | `src/features/devices/wave-l-z-one-rule.test.tsx` | 29 | 4.3 |

Slowest 10 suites, BEFORE of this session (under load; the times are not the files' own):

| # | file | tests | s |
|---|---|---|---|
| 1 | `src/features/pairing/pairing-live.test.tsx` | 28 | 29.3 |
| 2 | `src/features/evidence/live-evidence-export.test.tsx` | 15 | 26.3 |
| 3 | `src/features/capture-selector/local-source-start-notice.test.tsx` | 8 | 24.0 |
| 4 | `src/features/evidence/wave-k-z1-player.test.tsx` | 15 | 23.7 |
| 5 | `src/features/session-new/live-session-new-sites.test.tsx` | 16 | 23.7 |
| 6 | `src/features/session-new/wave-h-z2-countdown-sources.test.tsx` | 2 | 23.5 |
| 7 | `src/features/evidence/wave-h-c2-media.test.tsx` | 24 | 22.6 |
| 8 | `src/features/evidence/media-session-canary.test.tsx` | 16 | 22.4 |
| 9 | `src/features/capture-selector/wave-h-mic-lines.test.tsx` | 23 | 21.6 |
| 10 | `src/features/session-new/live-session-new-followups.test.tsx` | 13 | 19.6 |

Slowest 10 suites, AFTER:

| # | file | tests | s |
|---|---|---|---|
| 1 | `src/features/evidence/evidence-detail.test.tsx` | 74 | 20.5 |
| 2 | `src/features/storage/live-storage-sites.test.tsx` | 15 | 9.1 |
| 3 | `src/features/pairing/pairing-live.test.tsx` | 28 | 8.4 |
| 4 | `src/features/evidence/sealed-player.test.tsx` | 42 | 6.9 |
| 5 | `src/features/evidence/live-evidence-export.test.tsx` | 31 | 6.4 |
| 6 | `src/features/capture-selector/local-source-start-notice.test.tsx` | 8 | 5.6 |
| 7 | `src/features/session-new/precheck.test.tsx` | 11 | 5.4 |
| 8 | `src/features/capture-selector/selector-lines.test.tsx` | 32 | 5.3 |
| 9 | `src/features/capture-selector/camera-search.test.tsx` | 22 | 5.3 |
| 10 | `src/features/session-new/live-session-new-sites.test.tsx` | 29 | 5.2 |

`evidence-detail.test.tsx` is now the long pole (74 tests in one file: its own 9 and the 65 of five
merged files, which were 3.6 to 3.9 s each as files). It still runs inside the 2-worker wall.

## 2. M1 - the leak, and what the worker-exit line really was

**Finding: the garbage-collection timer of TanStack Query was a real open handle, but it was NOT what
printed "A worker process has failed to exit gracefully".** After the `gcTime` fix alone the whole
run printed the line again (two whole runs). The cause was found by measurement:

| step | what was run | result |
|---|---|---|
| 1 | `gcTime` fix (below); `jest --detectOpenHandles` on `transcript-follows-revision.test.tsx` and the 12 files that mount `AppProviders` without a client or build one themselves | 13 suites, 146 tests, 0 open handles (test/12 row 13: 6, all from that file) |
| 2 | whole run | the line is still printed |
| 3 | `jest --silent --detectOpenHandles` over the WHOLE suite (in band, 487 s) | 272 suites, 2915 tests, 0 open handles reported - Jest looks 100 ms after the LAST file only |
| 4 | a temporary diagnostic (an extra `setupFilesAfterEnv` file with `async_hooks`, in a temporary Jest config; both removed): per test file, the referenced timers of 500 ms or more still pending when the file ends, with the stack that set them | 54 files left 180 timers of 1000 ms from `packages/shared/src/sim/platform.ts:246` (the simulator store's snapshot write, throttled to 1 s, on the global `setTimeout`); `runtime/live-stall-link.test.ts` 2 of 8000 ms (`core-client.ts:656`, the call budget of calls the test never answers); 2 files a haptics timer of 3.5 s / 6.8 s (`motion/haptics.ts:126`) |
| 5 | fixes (below), diagnostic again, twice | 3 files, then 3 files with only haptic windows of 329 to 400 ms; the second diagnostic run did not print the line |
| 6 | the AFTER run | the line is absent |

Why those timers print the line: Jest gives a worker half a second to exit after its last file. A
worker whose last file leaves a referenced timer of 1 s is force-exited. Jest runs the slow files
first, so the last files are the fast model tests (`devices-model.test.ts`, `session-new-model.test.ts`,
`pairing-model.test.ts` ...), and those are among the 54. That is why every whole run printed it.

Fixes (test support and tests only):

| file | change |
|---|---|
| `src/runtime/testing/test-sim.tsx` | `createTestQueryClient()` (`gcTime: Infinity` for queries and mutations; retries and stale times stay the app's defaults) and `RuntimeTestProviders` hands `AppProviders` one such client per mounted tree. No test asserts a removal by the gc timer (`grep gcTime` over `src`: every use is `Infinity`; no finite value anywhere), so no test needed an explicit client |
| `src/features/home/home-screen.test.tsx:51`, `stack-proof-source.test.tsx:44`, `src/navigation/__tests__/back-guard.test.tsx:35`, `back-guard-busy.test.tsx:50` | the 4 direct constructions get `gcTime: Number.POSITIVE_INFINITY` |
| `src/runtime/testing/test-sim.tsx` | `createTestSim` gives the simulator `timers` that are the global ones, unreferenced (`TEST_SIM_TIMERS`): the 1 s snapshot timer still fires while the process lives, it no longer keeps a worker alive. A test that passes its own `timers` keeps them |
| `src/runtime/sim-adapters.test.ts` | the app's own simulators this file builds (`createMobileSim`, global timers on purpose) are stopped in an `afterEach` (`stop()` writes the pending snapshot and clears the timer); one test body gained two `built.push(...)` lines |
| `src/runtime/live-stall-link.test.ts` | the global `setTimeout` is spied for the file's cases and the handles unreferenced (the only global timers there are the typed client's call budgets) |
| `src/features/session-new/testing/live-session-new-bed.tsx`, `src/navigation/__tests__/pairing-gate.test.tsx` | `haptics.reset()` when the bed stops / after each case |

Not changed: 7 test files mount `AppProviders` with the app's default client (`auth/live-auth`,
`login/live-login`, `login/live-login-link-visuals`, `runtime/live-runtime`, `runtime/ended-link`,
`runtime/live-device`, `session-summary/sealed-members`) and `providers/app-providers.test.tsx`
tests that default. Step 1 shows none of them leaves a handle.

Required proof: `npx -w apps/mobile jest --maxWorkers=2 --detectOpenHandles --silent
src/features/evidence` at the end: 25 suites, 332 tests, 0 open handles.

## 3. Per-wave files merged into their homes (M3)

57 family files (472 run tests) are gone; 0 files with a wave / pass / fix / followups name are left
(`find ... | grep -cE '/(wave-|pass-|fix-)|followups'` = 0). 39 were merged into another file
(35 into an existing file, 4 into one of the new ones), 18 were moved under a feature name. Destinations: 25 existing files and 18 new ones, so 311 - 57 + 18 = 272 files.

Proof that it is a move: `collect.mjs` logic (TypeScript AST, body with comments and white space
normalised, sha1) before and after: of the 374 static `it` sites of the 57 files, 373 are found with
the same title and the same body hash in the destination; the one that differs is the operator-export
case whose helper call became `b.observersTold()` (section 4). Per destination, run tests after =
run tests before + moved (table). All 43 destinations pass.

How a file was merged (scripted, `scratchpad/c14m/merge.mjs`):
- Only into a file with the SAME test environment: the same side-effect imports in the same order
  and the same `jest.mock` calls. 26 of the audit's 51 homes differ from their family file in that
  (section 3 c picked them by a shared import); merging there would have run tests under mocks they
  did not have. For those the home is another feature file of the folder with the same environment,
  or the file moved under a feature name (column "how").
- The moved cases sit in one `describe` with their own helpers and hooks; the home file's own cases
  got one too wherever the file has hooks at its top level (22 files), so no case runs under another
  file's hooks. `describe` titles carried no wave prefix (they name the finding: `G94b-01 - ...`);
  the finding ids in the titles are unchanged. The bodies are not re-indented (a multi-line template
  literal would change).
- `src/runtime/testing/scoped-cleanup.ts` (`unmountBeforeTheHooksOfThisGroup`): the testing library
  unmounts in an `afterEach` at the ROOT of a file, before the file's own top-level `afterEach`. Inside
  a `describe` the order turns round and a group's `afterEach` (`jest.restoreAllMocks()`,
  `jest.useRealTimers()`, `bed.stop()`) ran on a mounted tree: 70 cases failed in 6 files in the first
  pass. Each group with hooks unmounts first, as the library does it. This is the one thing a merged
  file needs that a file of its own did not.
- A `jest.setTimeout(N)` of a family file is file-wide, so it became the third argument of that
  file's own `it` calls where the home states no timeout (43 calls in 4 files); no existing test got
  a longer timeout.
- Variables a module mock's factory reads stay at module scope, once (`mockLive`, `mockLink` in two
  files).

| family file (removed) | tests | destination | how | run tests: before + moved = after |
|---|---|---|---|---|
| `components/composed/wave-k-z1-stepper-badge.test.tsx` | 4 | `components/composed/stepper.test.tsx` | merged | 7 + 4 = 11 |
| `features/capture-selector/wave-h-mic-lines.test.tsx` | 23 | `features/capture-selector/selector-lines.test.tsx` | new file under a feature name | 0 + 32 = 32 |
| `features/capture-selector/wave-i-c-row-labels.test.tsx` | 9 | `features/capture-selector/selector-lines.test.tsx` | merged | 0 + 32 = 32 |
| `features/capture-selector/wave-h-no-preview-home.test.tsx` | 2 | `features/capture-selector/source-on-home.test.tsx` | merged | 1 + 2 = 3 |
| `features/capture-selector/wave-h-no-preview-session-live.test.tsx` | 4 | `features/capture-selector/source-on-session-live.test.tsx` | merged | 1 + 4 = 5 |
| `features/capture-selector/wave-h-no-preview-session-new.test.tsx` | 4 | `features/capture-selector/source-on-session-new.test.tsx` | new file under a feature name | 0 + 4 = 4 |
| `features/capture-selector/wave-h-sources-known.test.tsx` | 9 | `features/capture-selector/sources-known.test.tsx` | new file under a feature name | 0 + 9 = 9 |
| `features/capture-selector/wave-h-sources-known-gate.test.tsx` | 18 | `features/capture-selector/sources-known-gate.test.tsx` | new file under a feature name | 0 + 35 = 35 |
| `features/capture-selector/wave-i-c-sources-stale.test.tsx` | 17 | `features/capture-selector/sources-known-gate.test.tsx` | merged | 0 + 35 = 35 |
| `features/capture-selector/wave-i-c-source-state.test.ts` | 8 | `features/capture-selector/source-state.test.ts` | new file under a feature name | 0 + 8 = 8 |
| `features/capture-selector/wave-k-m2-phone-discovery.test.tsx` | 3 | `features/capture-selector/camera-search.test.tsx` | merged | 19 + 3 = 22 |
| `features/capture-selector/wave-l-m-selector-in-force.test.ts` | 11 | `features/capture-selector/selector-in-force.test.ts` | new file under a feature name | 0 + 11 = 11 |
| `features/capture-selector/wave-l-m-source-sheet.test.tsx` | 10 | `features/capture-selector/mic-limit-option.test.tsx` | merged | 3 + 10 = 13 |
| `features/dashboard/pass-j-home.test.tsx` | 7 | `features/dashboard/session-start-home.test.tsx` | merged | 5 + 16 = 21 |
| `features/dashboard/wave-i-c-seal-blocked-home.test.tsx` | 4 | `features/dashboard/session-start-home.test.tsx` | merged | 5 + 16 = 21 |
| `features/dashboard/wave-k-m2-connecting-home.test.tsx` | 5 | `features/dashboard/session-start-home.test.tsx` | merged | 5 + 16 = 21 |
| `features/dashboard/wave-i-c-home-real-capture.test.tsx` | 11 | `features/dashboard/home-mic-tiles-live.test.tsx` | merged | 5 + 11 = 16 |
| `features/dashboard/wave-k-z1-status-card-layout.test.tsx` | 8 | `features/dashboard/status-card-layout.test.tsx` | new file under a feature name | 0 + 8 = 8 |
| `features/dashboard/wave-l-m-home-notice-tiles.test.tsx` | 16 | `features/dashboard/home-notice-tiles.test.tsx` | new file under a feature name | 0 + 16 = 16 |
| `features/devices/wave-h-busy-settled.test.tsx` | 4 | `features/devices/devices-screen.test.tsx` | merged | 11 + 4 = 15 |
| `features/devices/wave-h-no-preview.test.tsx` | 16 | `features/devices/camera-no-preview.test.tsx` | new file under a feature name | 0 + 16 = 16 |
| `features/devices/wave-l-z-one-rule.test.tsx` | 29 | `features/devices/real-capture-one-rule.test.tsx` | new file under a feature name | 0 + 29 = 29 |
| `features/evidence/wave-h-c2-exports-playback.test.tsx` | 8 | `features/evidence/evidence-detail.test.tsx` | merged | 9 + 65 = 74 |
| `features/evidence/wave-h-c2-item-lines.test.tsx` | 18 | `features/evidence/evidence-detail.test.tsx` | merged | 9 + 65 = 74 |
| `features/evidence/wave-h-c2-media.test.tsx` | 24 | `features/evidence/evidence-detail.test.tsx` | merged | 9 + 65 = 74 |
| `features/evidence/wave-k-m2-phone-layout.test.tsx` | 9 | `features/evidence/evidence-detail.test.tsx` | merged | 9 + 65 = 74 |
| `features/evidence/wave-l-m-sealed-format.test.tsx` | 6 | `features/evidence/evidence-detail.test.tsx` | merged | 9 + 65 = 74 |
| `features/evidence/wave-h-c2-transcript-access.test.tsx` | 7 | `features/evidence/transcript-access.test.tsx` | new file under a feature name | 0 + 7 = 7 |
| `features/evidence/wave-k-final-plain-checked.test.ts` | 6 | `features/evidence/verify-v2-plain-checked.test.ts` | new file under a feature name | 0 + 6 = 6 |
| `features/evidence/wave-k-z1-player.test.tsx` | 15 | `features/evidence/sealed-player.test.tsx` | new file under a feature name | 0 + 42 = 42 |
| `features/evidence/wave-k-m1-seek.test.tsx` | 17 | `features/evidence/sealed-player.test.tsx` | merged | 0 + 42 = 42 |
| `features/evidence/wave-l-m-player.test.tsx` | 10 | `features/evidence/sealed-player.test.tsx` | merged | 0 + 42 = 42 |
| `features/evidence/wave-k-m2-item-facts.test.tsx` | 14 | `features/evidence/transcript-states.test.tsx` | merged | 6 + 14 = 20 |
| `features/evidence/wave-k-m2-operator-export.test.tsx` | 16 | `features/evidence/live-evidence-export.test.tsx` | merged | 15 + 16 = 31 |
| `features/network-time/pass-j-host-clock.test.tsx` | 3 | `features/network-time/network-time-screen.test.tsx` | merged | 6 + 3 = 9 |
| `features/session-finalizing/wave-i-c-seal-blocked.test.tsx` | 8 | `features/session-finalizing/session-finalizing-screen.test.tsx` | merged | 8 + 15 = 23 |
| `features/session-finalizing/wave-l-m-blocked-who-where.test.tsx` | 7 | `features/session-finalizing/session-finalizing-screen.test.tsx` | merged | 8 + 15 = 23 |
| `features/session-live/fix-157-audio-pair-in-force.test.tsx` | 2 | `features/session-live/audio-pair-in-force.test.tsx` | new file under a feature name | 0 + 2 = 2 |
| `features/session-live/wave-h-z2-mic-lines.test.tsx` | 2 | `features/session-live/development-source-mounts.test.tsx` | merged | 1 + 2 = 3 |
| `features/session-live/wave-h-z2-own-capture.test.tsx` | 5 | `features/session-live/situation-c.test.tsx` | merged | 11 + 5 = 16 |
| `features/session-live/wave-i-c-timeline-connecting.test.ts` | 3 | `features/session-live/session-live.math.test.ts` | merged | 19 + 3 = 22 |
| `features/session-live/wave-k-m2-clock-slot.test.tsx` | 9 | `features/session-live/connecting-meters.test.tsx` | merged | 2 + 9 = 11 |
| `features/session-new/live-session-new-followups.test.tsx` | 13 | `features/session-new/live-session-new-sites.test.tsx` | merged | 16 + 13 = 29 |
| `features/session-new/wave-h-z2-footer-labels.test.tsx` | 1 | `features/session-new/idle-control-state.test.tsx` | merged | 1 + 1 = 2 |
| `features/session-new/wave-h-z2-precheck-note.test.tsx` | 2 | `features/session-new/precheck.test.tsx` | merged | 4 + 7 = 11 |
| `features/session-new/wave-i-c-no-removed-spinner.test.tsx` | 5 | `features/session-new/precheck.test.tsx` | merged | 4 + 7 = 11 |
| `features/session-new/wave-l-m-live-checks.test.ts` | 3 | `features/session-new/precheck-mic-roles.test.ts` | merged | 6 + 3 = 9 |
| `features/session-recovery/wave-l-m-core-sealing.test.ts` | 2 | `features/session-recovery/recovery.model.test.ts` | merged | 14 + 2 = 16 |
| `features/session-summary/wave-h-c2-signature.test.tsx` | 4 | `features/session-summary/session-summary-screen.test.tsx` | merged | 9 + 11 = 20 |
| `features/session-summary/wave-h-z2-time-source.test.tsx` | 3 | `features/session-summary/session-summary-screen.test.tsx` | merged | 9 + 11 = 20 |
| `features/session-summary/wave-k-m1-tablet-taps.test.tsx` | 4 | `features/session-summary/session-summary-screen.test.tsx` | merged | 9 + 11 = 20 |
| `features/sessions/wave-h-z2-row-no-preview.test.tsx` | 2 | `features/sessions/row-no-preview.test.tsx` | new file under a feature name | 0 + 2 = 2 |
| `features/sessions/wave-i-c-seal-blocked-hub.test.tsx` | 6 | `features/sessions/interrupted-seal-hub.test.tsx` | merged | 1 + 6 = 7 |
| `features/settings/wave-k-m2-about-facts.test.tsx` | 2 | `features/settings/about-facts.test.tsx` | new file under a feature name | 0 + 2 = 2 |
| `layout/wave-k-m1-pane-reduced.test.tsx` | 10 | `layout/layout.test.tsx` | merged | 9 + 10 = 19 |
| `navigation/wave-i-c-new-session-blocked.test.tsx` | 2 | `navigation/new-session-blocked.test.tsx` | new file under a feature name | 0 + 2 = 2 |
| `features/session-new/wave-h-z2-countdown-sources.test.tsx` | 2 | `features/session-new/countdown-sources.test.tsx` | new file under a feature name | 0 + 2 = 2 |
Also renamed (test support): `features/evidence/testing/wave-h-c2-kit.tsx` -> `testing/real-item-kit.tsx`
(4 importers updated).

PROTECTED cases, every one kept, by hash: the player seek / renewal / player-error / action-bar /
band cases (`sealed-player.test.tsx`, 42 = 15 + 17 + 10), the per-operator cache and export cases
(`live-evidence-export.test.tsx`, 16 moved), `verify-v2-plain-checked.test.ts` (6),
`selector-in-force.test.ts` (11, with its "ONE reader of the rule" static case and control),
`sources-known*.test.tsx` and the local-source files (moved or untouched).

## 4. M2 - real waits

| what | before | after | proof |
|---|---|---|---|
| the 3-2-1 countdown (`session-new/wave-h-z2-countdown-sources.test.tsx` -> `countdown-sources.test.tsx`) | slept through the countdown on the real clock: 18.8 s for 2 cases (run 12) | Jest fake timers from the moment step 3 stands, the way `capture-selector/local-source-start-notice.test.tsx` drives the same countdown; the two `it` bodies are unchanged (same hash), only the `wait` / `until` helpers and `openReady` changed; about 2.1 s of test time | mutation in `session-new-screen.tsx:236` (`if (false && stopCountdown) setRemaining(null)`): "lost: ..." RED (`Expected: true / Received: false`), the CONTROL case green; file restored, `cmp` identical |
| the query library's zero timer (`implementation/150`: `observersTold`) | a helper of ONE test file (`wave-k-m2-operator-export.test.tsx`) | in the Live evidence bed (`features/evidence/testing/live-evidence-bed.tsx`): `bed.elapse()` ends with it (lenient: a read a test holds open stays open), and `bed.observersTold()` is the strict form (throws when the client does not come to rest in 20 turns). The per-file copy is removed; its two calls are `b.observersTold()`. Skipped under Jest's fake timers (the timer is then the test's) | `src/features/evidence`: 34 suites, 333 tests green right after the change |

Why the evidence bed only: a screen is drawn by a query observer in `features/evidence` only
(`export-job.ts`, `transcript.ts`, `use-evidence-media-ref.ts`; the two others are `home/use-health.ts`
and `transcription/use-stt-config.ts`, whose tests are not bed tests and already wait for the zero
timer in their own `flush`: `runtime/live-health.test.tsx:80`, `runtime/live-screens.test.tsx:67`,
`transcription/stt-status-section.test.tsx:66`). The other ten Live beds have no observer to tell.

## 5. M6 - the 9 tests deleted (controller's ruling, brief rule 8)

No covering test and no mutation: they asserted history ("as it was at `acaff20`"), by the ruling.

| file | test |
|---|---|
| `features/session-recovery/recovery-live-static.test.ts` | the copy of Simulated mode is what it was at acaff20 (90 texts; digest computed independently from `git show acaff20:…/i18n.ts`) |
| `features/pairing/pairing-live-static.test.ts` | the copy of Simulated mode is as it was at `acaff20`: 51 texts, every key and every text (one digest) |
| `features/evidence/live-evidence-static.test.ts` | the copy of Simulated mode is the copy of `acaff20` (185 texts, the same digest) |
| `features/storage/storage-live-static.test.ts` | the copy of Simulated mode is as it was at `acaff20`: 26 texts, one digest |
| `features/dashboard/home-more-live-static.test.ts` | the copy of Simulated mode is as it was at `acaff20`: Home 79 texts, More 43 texts plus the one LIVE note (one digest each) |
| `features/audit/audit-live-static.test.ts` | the copy of Simulated mode is as it was at `acaff20`: 55 texts, one digest |
| `features/devices/devices-live-static.test.ts` | the copy of Simulated mode is as it was at `acaff20`: 44 texts, one digest |
| `features/network-time/live-network-time.test.tsx` | the production files are the 14 of `acaff20` (this row adds tests only) |
| `features/settings/settings-live-static.test.ts` | the copy of Simulated mode is unchanged: the step-88 leaves, byte for byte (the LIVE leaves are additive) |

The audit counted "8 in 7 files and `live-network-time.test.tsx:190`"; by reading there are 8 pure
copy-digest tests in 8 files (the settings one is worded "the step-88 leaves, byte for byte" and its
digest is "of `i18n.ts` at acaff20") plus the file list: the 9 above.

Two more tests held such a pin TOGETHER with a rule. They are kept and narrowed to the rule (count
unchanged):

| file | before | after |
|---|---|---|
| `features/network-time/live-network-time.test.tsx` | "the copy is that of `acaff20` (35 texts, one digest), says nothing about a simulation, and the folder holds no `SIM-GAP` marker" | "the copy says nothing about a simulation, and the folder holds no `SIM-GAP` marker" (the count and the digest are gone, the two rules stay) |
| `features/session-summary/summary-live-static.test.ts` | "the Summary's LIVE text says nothing about a simulation; the Simulated copy is the step-80 copy" (a list of two keys and a digest) | "the Summary's LIVE text says nothing about a simulation" (the Live leaves are not empty and none speaks of a simulation) |

NOT deleted: the six `SIM-GAP` marker tests that name `acaff20` (devices, storage, audit, evidence,
settings, recovery). They pin marker counts (KI-07), neither copy nor a file list; the ruling does
not name them. They are change-detectors of the same kind: a question for the controller (section 9).

## 6. M4 - list pins turned into rules

`src/runtime/testing/static-scan.ts` (new, test support): `expectScanIsTheFolder` (rule R1: what the
test's scan read equals a second, independently written walk of the folder - one recursive listing
by the platform and a predicate on path segments -, is not empty and holds no test or harness file).

| test | was | is now |
|---|---|---|
| 11 "reads the folder / both folders / all three folders / the whole folder / are the ones this test reads" tests: `audit-live-static`, `home-more-live-static`, `devices-live-static`, `live-evidence-static`, `pairing-live-static`, `recovery-live-static`, `summary-live-static`, `settings-live-static`, `storage-live-static`, `stt-status-static`, `auth/live-auth-static` | `toEqual([...file names...])` | `expectScanIsTheFolder(scanned, FOLDER)`; two titles lost "(no new production file)" / "(one new file: the mode switch)" |
| `runtime/pending-control.test.tsx` "every caller takes the helpers from the barrel" | a list of 5 files in 2 folders | every production file under `features/` whose code names `busyState` / `PendingSpinner` takes THAT helper from `@/runtime` (per helper; with a control of the matcher; both caller folders of row M1 must be among the users). Stricter than the list: the old matcher accepted a file that took one helper from the barrel and the other from elsewhere |
| `navigation/__tests__/navigation-units.test.ts` "registers one i18n tree per feature folder with a screen, plus the shell copy" | the screens' folders plus three named extras | the registry's keys equal the feature folders that hold an `i18n.ts`, plus `navigation`; every folder with a screen is among them |
| `live-evidence-static.test.ts` "the Live copy says nothing about a simulation" | `LIVE_KEYS`, a list of 37 Live keys that grew every wave | "the copy speaks of a simulation only in the sentences of Simulated mode": the leaves that say "simulat" are within the 7 sentences of Simulated mode, so a NEW sentence is held to the rule without being listed |
| copy counts: `devices-live-static` `live` `toHaveLength(8)`, `settings-live-static` `live.length` `toBe(7)`, `summary-live-static` the two Live keys by name | exact counts / names | not empty |

Kept as they are: every rule of the form "no file does X" and its control; the four tests that
already were rules (`live-no-raw-fetch`, `live-static-ac-c-53`, `link-notice-static`,
`no-credential-inputs.static`); the privacy rules for local devices; the selector-in-force "ONE
reader" rule; the allow-lists that name the ONE file allowed to do a thing.

Mutation proofs, each run once, the file restored from a copy and `cmp` identical:

| rule | mutation | result |
|---|---|---|
| R1 | the scan of `devices-live-static.test.ts` narrowed (files starting with `device-row` skipped) | RED: `- "device-row.tsx"` |
| R1 | a new production file `features/devices/zz-c14-probe.ts` (removed after) | GREEN (before the change: red) |
| pending-control | `features/storage/manage-storage-sheet.tsx` takes `PendingSpinner` from `@/runtime/pending-control` | RED: `+ "storage/manage-storage-sheet.tsx: PendingSpinner"`. (The first form of the new rule, with the old matcher, stayed GREEN on this mutation: that is how the weakness of the old matcher was found) |
| navigation-units | a folder `features/zz-c14/i18n.ts` that is not registered (removed after) | RED: `- "zz-c14"` |

## 7. M5 - the identical static rule from one place

The hook half of AC-C-53 ("no production file calls the simulator's action hook", control + rule,
the same two lines in 7 files: audit, home-more, devices, recovery, summary, settings, storage) is
`expectNoSimActionsHook(matching)` of `static-scan.ts`; each file keeps its own case (count
unchanged). Not parametrised: "the folder names no network API ..." (3 files) and "the LIVE wording
is picked from `useCoreLink().source`" (2): they are near-identical, not identical - each names its
folder's own exceptions (which file may set a timer, which file reads the link).

Not done from M5: removing the per-folder hook cases in favour of
`lib/live-static-ac-c-53.test.ts`, which already holds the same rule over every folder of
`src/features` and `src/auth` (so the 7 cases plus the pairing and evidence variants are covered).
That is a deletion of 7 to 9 tests the brief does not rule on; listed in section 9.

## 8. What I did NOT do from the audit's table, and why

| item | why |
|---|---|
| M2, `features/evidence/evidence-detail.test.tsx` (11.0 s) on fake timers | read: its waits are the product's pacing constants (0.4 to 1.5 s, 7 waits, about 6 s in all) and its header says the real timers are deliberate ("Reanimated in Jest, S72-12"). Not converted. It is now the home of five merged files and the slowest file |
| M3 "into the audit's home" for 26 files | their environment differs from the home's (section 3) |
| the other real waits (`live-storage-sites` 9.2 s, `pairing-live` 8.2 s, `devices-states` 3.3 s in one case, `connection-banner-live` 3.3 s, `login-entrance-rest` 2.2 s) | not in the brief's list; each needs its own reading |
| W6-style helper for every test client | not needed: no handle left (section 2, step 1) |

## 9. Open items

1. **Two product comments name removed test files** (not edited: no product change):
   `src/features/capture-selector/source-state.ts:140` (`wave-i-c-source-state.test.ts`, now
   `source-state.test.ts`) and `src/features/capture-selector/selector-in-force.ts:23`
   (`wave-l-m-selector-in-force.test.ts`, now `selector-in-force.test.ts`).
2. **Product, for a later row**: the typed client's call budget (`packages/shared/src/client/core-client.ts:656`)
   and the simulator's snapshot throttle default (`sim/platform.ts:188`) use referenced global timers;
   a stopped Live source does not abort its pending calls. Worked round in tests (section 2).
3. Three files still end with a haptic coalescing timer of 329 to 400 ms pending (`login/login.test.tsx`,
   `pairing/pairing-handoff-routes.test.tsx`, `session-summary/live-summary-sites.test.tsx`): under
   Jest's half second, so no force exit, but with little margin. A reset of the haptics service after
   every test in `jest.setup.ts` would end it; not done (it would load `@/motion` in every file).
4. For the controller to rule: the six `SIM-GAP` marker-count tests "as at `acaff20`" (section 5),
   and the 7 to 9 per-folder hook cases covered by the app-wide AC-C-53 test (section 7).
5. The wall time of the suite is not shown to be shorter (section 1). One unloaded run decides it.
6. Implementation notes and the audit name the old file names (`docs/**`); not rewritten.

## 10. How to re-check

```bash
# whole suite (the command of test/12)
npx -w apps/mobile jest --maxWorkers=2
# typecheck, lint
npm run typecheck -w @dems/mobile && npm run lint -w @dems/mobile
# the leak proof of M1
npx -w apps/mobile jest --maxWorkers=2 --detectOpenHandles --silent src/features/evidence
```

Scratchpad (not in git), `scratchpad/c14m/`: `before.json`, `after2.json` (the two reports),
`sites.before.json` / `sites.after.json` and `verify.mjs` (titles and body hashes), `map.txt` and
`merge.mjs` (the moves), `removed/` (a copy of every removed file), `m6_removed.json` (the text of
the 9 deleted tests), `handles2.jsonl` / `handles4.jsonl` (pending timers per file, before and after
the fixes), `doh_all.log`, `doh_evidence.log`.

---
*Generated: 2026-10-11 18:50 WIB*
