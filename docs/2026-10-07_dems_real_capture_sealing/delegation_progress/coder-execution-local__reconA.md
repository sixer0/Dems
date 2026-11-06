# RECON-A progress - coder-execution-local (packages/shared reconciliation)

Row: RECON-A (controller-added reconciliation row for the DEMS task-3 M2 gate).
Scope: make `packages/shared` FULLY green. Sole `packages/shared` writer this turn.
Fixes: openapi.test.ts #17 (stale EXPORTED->QUEUED + coverage-loop scope), add services marker to 6 capture 403s, forbidden-key 25->28 shared pins, sim/api.ts:770 TS6133.
Rules: never delete/weaken an assertion to force green; correct expectation to landed M2 contract or add missing marker. No apps/**, no openapi.json, no lockfile, no trackers. Edit only packages/shared/{src,test}/**.

## Status: COMPLETE

`packages/shared` fully green: suite 72 files / 1875 tests exit 0; tsc exit 0; oxlint exit 0. The single residual red (#17) is closed with no assertion weakened/deleted/skipped/timed-out. Artifact: `implementation/63_recon_shared.md`.

## Steps

| # | Step | Status |
|---|---|---|
| 0 | Read rows 48/50/51a/112 + D38/D41/D42; set up timeout shim | done |
| 1 | Enumerate shared suite | done - 1 failed/1874 passed, only #17 :457 EXPORTED vs QUEUED |
| 2 | Item 1: openapi.test.ts:457 EXPORTED->QUEUED + coverage loop | done - literal fixed; flow extended (flows 3..10) to drive all 13 capture ops; loop kept over all 22; coreServerOnly 11->22 |
| 3 | Item 2: services:['dems-core-server'] markers | done - 6x403 (brief) + 5x422 (same class, discovered by probe); spread CORE_SERVER_ONLY, descriptions/schemas/examples unchanged |
| 4 | Item 3: forbidden-key 25->28 shared-side pin(s) | verified ABSENT in packages/shared (constant lives only in apps/core-server -> RECON-B); no-op, not fabricated |
| 5 | Item 4: sim/api.ts:770 unused state TS6133 | done - renamed to _state (matches _params convention) |
| 6 | Full shared suite exit 0 | done - 72 files / 1875 tests, SUITE_EXIT=0 |
| 7 | tsc --noEmit -p packages/shared exit 0 | done - TSC_EXIT=0 |
| 8 | shared lint exit 0 | done - LINT_EXIT=0 |
| 9 | Write implementation/63_recon_shared.md + this progress | done |

## Files changed (5, all under packages/shared/{src,test})
- test/openapi.test.ts; src/api/devices.ts; src/api/sessions.ts; src/api/evidence.ts; src/sim/api.ts.
- NOT touched: openapi.json (mtime 13:17 row 50), package-lock.json (Oct 7), apps/**, trackers. Drift test passing proves openapi.json still matches builder with new markers.

## Constraints kept
Sole shared writer; edit only src/test; no git write/push; no sudo; no DB; CI/--run, </dev/null, bounded timeout; no assertion weakened/skipped/timeout-raised; no fabrication (item 3 reported as genuine no-op).

## Findings (empirical, measured via probe.mts/probe2.mts)

- Reachable-per-op status sets measured directly from the simulator. After marking, every simulated op's offline set == its reachable set.
- Unreachable-by-simulator statuses (correctly Core-server-only, mirroring the already-marked startSession 422 and the five baseline reads):
  - 403 (Origin/revoked-device guard the sim does not implement): getCaptureConfig, getCaptureDevices, listAudioSourceIntervals, getSealingProgress, getTranscript, listTranscriptRevisions (the brief's six).
  - 422 (path-param/query format check the sim deliberately skips, D-51a-6): setPrimaryMic, listAudioSourceIntervals, getSealingProgress, getTranscript, listTranscriptRevisions (five; row 51a analyzed only the 403s and missed these).
- Marking per-response services does NOT change committed openapi.json (ALL scope lists every status; builder never serializes per-response services). Drift test stays green without regen.
- coreServerOnly pin: 11 baseline + 6 capture-403 + 5 capture-422 = 22.

## Notes

- macOS host has no `timeout`; using perl shim at `.cache/reconA/bin/timeout` (row-46/112 precedent). PATH does not persist across tool calls, so it is prepended inline on every command.
