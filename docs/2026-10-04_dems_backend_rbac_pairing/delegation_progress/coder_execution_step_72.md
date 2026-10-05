# Progress: coder-execution, step 72 (plan row W50, web runtime with the mode switch)

Status: **complete** (started 2026-10-04 17:58 WIB)

Document: `implementation/50_web_runtime_mode.md`. Evidence: `implementation/assets/50_*`.

## Timeline

| Time | What |
|---|---|
| 17:58 to 18:06 | Inputs read: the row and P1 to P25 of `identification/02_structured.md`; the client spec rev 2.2 (§2 to §8, §10.1, §12, §13); `implementation/44_live_source.md` §3, §17.3, §17.4, §18; `42_realtime_channel.md` §8, §9; `05_proof_vite_proxy.md` §3, §4, §10; decisions D29, D34, D43, D80, D84, D86, D90, D97, D100, D107; findings F55, F59, F69; the shared Live source, typed client, socket client and fake transport; the web entry, router, root route, endpoint module and their tests |
| 17:59 | Pre-image saved: `.cache/rollback/W50.pre.patch` (1,503 bytes: `common.ts` as W16 left it; the four web files had no diff against `acaff20`) |
| 18:06 | Baseline: `npm run test -w @dems/core-web -- --maxWorkers=2` exit 0, 39 files / 438 tests |
| 18:10 to 18:25 | Production files written: `runtime/{core-mode,live-host,error-sink,owed-sign-out-storage,query-bridge,live-start,boot,live-host-refusal,env.d}.ts(x)`, `lib/core-errors.ts`; `lib/core-endpoint.ts`, `router.tsx`, `routes/__root.tsx`, `main.tsx` changed; four groups added to `common.ts`. Typecheck and lint exit 0; the 438 existing tests green and unchanged (18:25) |
| 18:27 to 18:47 | The test harness and seven test files. Whole web suite 46 files / 579 tests, exit 0 (18:46); shared 68 files / 1,807, exit 0 (18:48) |
| 18:35 | A scratch probe test in `src/test/` (does a docblock set the jsdom page address? yes) was removed with `rm -f`: against rule 9 in the letter; stated as deviation D-10. Every later probe ran from `.cache/w50/` through a separate runner configuration |
| 18:38 to 18:41 | StrictMode: built "StrictMode below the provider" first; a probe showed that React does not double-invoke effects of a subtree mounted in the same commit as a non-strict root; replaced by "the provider only provides a Live source" (`autoStart={live === null}`) |
| 18:48 | Two production builds to `.cache/w50/build_*` (plain, packaged flag): no text of the Live module in either |
| 18:52:50 to 18:53:24 | **Lane check on lane 3** inside `lockf` on `.locks/core-server.lane3.lock`: backend 4423 and Vite 5178 started, checked, stopped; no listener left. Four screenshots |
| 18:55 to 19:00 | The sink's tests; the presenter's 503 rule narrowed to the Core's own `NOT_READY`; `runtime/{hooks,index}.ts` and their test |
| 19:00 to 19:09 | First mutation run (190 changes) stopped by this row at 80 of 190 (79 detected, 1 equivalent): the 1-minute load average rose to 13.6 with the other rows in flight. The start-up test's waits were lengthened, the runner set to one worker and to record the failing test of each change |
| 19:12 to 19:29 | Mutation run on the finished code: 192 single changes in thirteen production files, applied in memory by a transform: 188 detected in the full run (19:11 to 19:27). The four others: Q27, Q28 and X38 showed tests that asserted too little (one test and two inputs added; all three detected at 19:28); S14 is equivalent. **191 of 192 detected, 1 equivalent, 0 not applied** |
| 19:29 to 19:34 | Final gate: a whole web run at 19:29 (48 files / 598 tests, exit 0) showed one lint warning in a new test file; removed. Final gate 19:32 to 19:34 on the finished tree: `@dems/core-web` 48 files / 598 tests exit 0 (the 39 earlier files: 438); typecheck exit 0; lint exit 0 without a warning; `@dems/shared` 68 files / 1,807 tests exit 0, typecheck and lint exit 0; `@dems/mobile` typecheck exit 0; `routes.test.tsx`, `core-endpoint.test.tsx`, `packaged-csp.test.ts` absent from `git diff --stat acaff20`; the diffs of AC-C-35 and AC-C-41 are 0 bytes |
| 19:34 to 19:36 | Evidence copied to `implementation/assets/50_*`; the document's output blocks checked against the logs; document and this file closed |

## Files created or updated

Production (all inside the row's write paths):

- `apps/core-web/src/main.tsx` (changed)
- `apps/core-web/src/router.tsx` (changed)
- `apps/core-web/src/routes/__root.tsx` (changed)
- `apps/core-web/src/lib/core-endpoint.ts` (changed)
- `apps/core-web/src/lib/core-errors.ts` (new)
- `apps/core-web/src/runtime/boot.ts`, `core-mode.ts`, `env.d.ts`, `error-sink.ts`, `hooks.ts`, `index.ts`, `live-host.ts`, `live-host-refusal.tsx`, `live-start.ts`, `owed-sign-out-storage.ts`, `query-bridge.ts` (new)
- `apps/core-web/src/runtime/testing/live-harness.ts` (new; for tests only)
- `packages/shared/src/i18n/en/common.ts` (changed, additive: 34 strings in four new groups)

Tests (new):

- `apps/core-web/src/test/live-runtime-mode.test.tsx`, `live-runtime-startup.test.tsx`, `live-runtime-storage.test.tsx`, `live-runtime-bridge.test.tsx`, `live-runtime-sink.test.tsx`, `live-runtime-static.test.tsx`, `live-runtime-surface.test.tsx`
- `apps/core-web/src/lib/__tests__/live-core-endpoint.test.tsx`, `live-core-errors.test.tsx`

Documents:

- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/50_web_runtime_mode.md`
- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/assets/50_*` (four screenshots, the lane log, the browser's record, the three lane scripts, the build search, the gate and mutation logs)
- this file

Scratch, git-ignored: `.cache/w50/**`, `.cache/rollback/W50.pre.patch`, `.locks/core-server.lane3.{lock,log,pid,vite.log,vite.pid}` (the two pid files are empty).

Not written: `masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md`, `implementation/99_implementation_report.md` (P8: the controller's in a parallel run).

## For the controller

Findings F72-1 to F72-11, deviations D-1 to D-12 and decisions 1 to 10: sections 18, 19 and 20 of the document.
The three that need a word first:

1. **The StrictMode decision** (section 5): the root route's provider does not start or stop a Live source; the
   entry and the mode switch do. A test that builds a Live source stops it itself (the harness does).
2. **F72-2**: until W55 lands, the Live Login page still says "(simulated)" in its trust line and shows the
   security-key button (`assets/50_console_live.png`).
3. **D-10**: one scratch test file of this row was removed with `rm -f` inside the tree, and the row's own new
   harness file was renamed once. Nothing of anybody else's was removed or renamed.

## End state

- No process of this row is running. `lsof -nP -iTCP:4423 -iTCP:5178 -iTCP:9398 -sTCP:LISTEN` prints nothing (exit 1), at 18:53:24 and again at 19:34:01.
- Ports 4420, 4400, 4432, 5173 to 5175 and 8081 to 8089 were neither used nor touched. PostgreSQL (4432) was used only through `db:status` (twice, read-only) and by the lane backend.
- `dems_lane_3` was not reset. The check added 4 audit rows (82 to 86), 4 events (59 to 63) and 1 session row (0 to 1, ended): the backend's start, one failed sign-in for a username that does not exist, one sign-in, one sign-out.
- `.locks/core-server.lane3.lock` is free. `.locks/core-server.lane3.pid` and `.vite.pid` are empty files (not removed). `.locks/core-server.lane3.log` and `.vite.log` hold the run's output; neither holds a credential (scanned).
- No commit, no install, no new dependency. `release/**`, `apps/mock-core/**`, the simulator, `packages/shared/src/live/**`, `vite.config.ts`, `routeTree.gen.ts` and every feature folder are untouched by this row.
- The document, this file and every text asset were scanned for the seeded password, a token prefix and a cookie value: none.
