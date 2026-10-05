---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: coder-execution (tier R)
blueprint_row: 48 (plan W26, engine host)
date: 2026-10-04
status: needs-review (follow-up of fix round B2a: one decision open, DN-F-1; step 48 and round B2a gated, D77 and D122)
evidence_tier: 3
---

# coder-execution progress: step 48 (W26, engine host)

Status: **complete** (12:42 WIB). The shared simulator core runs headless inside the backend,
with PostgreSQL as its store: `apps/core-server/src/engine/` holds the host, its command pipeline
(one unit of work per command and per tick), the actor scope cleared in a `finally`, the
write-through by reference inequality, the rehydration at start, the restart fault, the scheduler
and the health snapshots. The row's command exits 0 (4 files, 53 tests); the whole `unit` project
(70 files, 1,848 tests) and the whole `db` project (45 files, 623 tests) of `@dems/core-server`
exit 0; workspace typecheck and lint exit 0. The controller's three notes of this run (decisions
D72 and D74) are applied.

Full record: `implementation/26_engine_host.md` (25 sections). No credential appears in either
document.

## Milestones (WIB)

| Time | What |
|---|---|
| 11:22 | Inputs read: the row and P1 to P25, spec §3, §7.2, §7.17, §8, §9.3, §12.4, §13.2; the database contract (§4.24 to §4.28, §6.4, §7.4); the logs of W04, W08, W17, W20, W21, W27, W29; decisions D11, D14, D28, D40, D52, D62, D64, D67 |
| 11:23 | Baselines: `unit` 41 files / 1,281 tests; `db` 29 files / 436 tests; workspace typecheck exit 0. A database command inside the sandbox fails with `POSTGRES_UNREACHABLE`, as P10 says |
| 11:40 | The host boots on a seeded clone and runs the recording scenario; typecheck and lint of the folder clean |
| 11:41 | Finding F-4: the simulator's 1 Hz hardware step falls on whole clock seconds; the snapshot rule became "once per clock second" (72 writing ticks a minute instead of 131) |
| 11:42 | Controller's note (D72): two tests of `core-plugin.test.ts` are red since the boot step is registered. Judged BY DESIGN (the stand-in pool holds no state; the nine checks passed first). The step's own failure was tightened first: a database that does not answer is the pipeline's 503, not a failed read |
| 11:44 | The two tests adapted (lines 249, 260); the stub assertion of D52 deleted from `readiness.test.ts` (two lines). Whole `unit` green: 51 files, 1,541 tests |
| 11:44 | Whole `db`: four more tests of other rows red, all by design, in three files. Not edited: outside the authorisation at that time |
| 11:53 | Controller's second note: the same rule for the three database files. Each judged by design; edited at 11:55; the three files 33 of 33 |
| 11:55 | Controller's third note (D74): two entries, the boot and the reload after a reset. `engine.reload()` added as the named entry of `start('reset')`; the reset cycle tested with the real routine |
| 12:00 | 128 database-free tests and 53 database tests of the folder green |
| 12:13 | Mutation check on a copy outside the repository: 28 of 28 detected (12:17) |
| 12:19 | One file-level failure of this row's own `restart.db.test.ts` in a whole `db` run: the helper's forced drop of the database a reset had built was refused (finding F-3). The test now drops that one database with the plain form |
| 12:32 | Last source edit (one comment line). Row command exit 0 (12:32:35) |
| 12:32 to 12:35 | Whole `db` red twice in ONE file of the reset row under load (finding F-15); the file alone passed three times at 12:36 to 12:37 |
| 12:37 | Whole `db` exit 0: 45 files, 623 tests. Whole `unit` exit 0: 70 files, 1,848 tests (12:38). Typecheck and lint exit 0 |
| 12:38 | End state: no database of this row, PostgreSQL PID 19121 and start time unchanged |

## Files created or updated

Created, all under `apps/core-server/src/engine/`:

- `types.ts`, `host.ts`, `write-plan.ts`, `rehydrate.ts`, `delta.ts`, `ring.ts`, `scheduler.ts`,
  `headless-sim.ts`, `actor-scope.ts`, `hosted-actions.ts`, `errors.ts`, `timer.ts`, `limits.ts`
- `__tests__/support.ts` (test support, not a test file)
- project `unit`: `__tests__/actor-scope.test.ts` (8), `delta.test.ts` (11), `errors.test.ts` (23),
  `hosted-actions.test.ts` (17), `plugin.test.ts` (8), `rehydrate.test.ts` (24), `ring.test.ts` (6),
  `scheduler.test.ts` (7), `static.test.ts` (15), `write-plan.test.ts` (9)
- project `db`: `__tests__/commands.db.test.ts` (20), `recording.db.test.ts` (13),
  `restart.db.test.ts` (14), `ticks.db.test.ts` (6)

Replaced: `apps/core-server/src/engine/index.ts` (the scaffold's stub; its four exports are kept).

Updated, by-design changes to existing tests (every line, with the case and the failure text, in
`26_engine_host.md` section 15):

- `apps/core-server/src/plugins/readiness/__tests__/readiness.test.ts`: two assertion lines deleted
  (old lines 252, 253). Standing rule of D52.
- `apps/core-server/src/core/__tests__/core-plugin.test.ts`: old lines 249 and 260. Controller's
  note of 11:42 (D72).
- `apps/core-server/test/db/boot-checks.db.test.ts`: old line 348. Controller's note of 11:53.
- `apps/core-server/src/core/__tests__/boot-checks.db.test.ts`: old lines 91, 102 (a comment), 193.
  The same note.
- `apps/core-server/src/core/__tests__/seeded.db.test.ts`: one entry added after old line 37. The
  same note.

Documents:

- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/26_engine_host.md`
- `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/coder_execution_step_48.md`

Outside the repository's tracked tree (git-ignored): `.cache/rollback/W26.pre.patch` (empty: the
paths are untracked at `acaff20`), `.cache/rollback/W26.engine-index.ts.pre` (the stub) and the
pre-images of the five test files.

Not written (parallel run, P8): `masterplan/02_plan.md`, `status_tasks.md`,
`delegation_progress_report.md`, `decisions/decisions.md`, `implementation/99_implementation_report.md`.

## Verification (final state)

| Command | Time | Result |
|---|---|---|
| `DEMS_TEST_STEP=48 npm run test:db -w @dems/core-server -- src/engine` | 12:32:35 | exit 0; 4 files, 53 tests; `0 remain with the run prefix dems_test_step_48_tmdbeb2g_` |
| `DEMS_TEST_STEP=48 npm run test:db -w @dems/core-server -- --maxWorkers=2` | 12:37:38 | exit 0; 45 files, 623 tests; `0 remain with the run prefix dems_test_step_48_tmdbmqkh_` |
| `npm run test -w @dems/core-server -- --maxWorkers=2` | 12:38:31 | exit 0; 70 files, 1,848 tests |
| `npm run typecheck -w @dems/core-server` | 12:38 | exit 0 |
| `npm run lint -w @dems/core-server` | 12:38 | exit 0; two warnings in `readiness.test.ts` (finding F-2), none in `src/engine/` |
| Databases with this row's prefix; `.locks/postgres.pid` | 12:38:25 | 0; 19121 |

Whole `db` runs that were NOT green, with the cause (P11):

| Time | Result | Cause |
|---|---|---|
| 11:44:54 | 4 failed | By design, three files of other rows; adapted at 11:55 under D72 |
| 12:19:46 | 616 passed, one file failed in its teardown | This row's `restart.db.test.ts`: finding F-3; fixed in the test |
| 12:32:51 | 1 failed | `src/db/reset/__tests__/reset-failures.db.test.ts` (the reset row's), under load: finding F-15 |
| 12:34:46 | 2 failed | The same file, two other tests, the same assertion |

## Test ledger (P24)

`@dems/core-server` only. No other workspace was written.

| Project | Before (11:23) | After (final) | This row |
|---|---|---|---|
| `unit` | 41 files, 1,281 tests | 70 files, 1,848 tests, 0 failed | **+10 files, +128 tests**. The other 19 files and 439 tests were added by rows that ran at the same time |
| `db` | 29 files, 436 tests | 45 files, 623 tests, 0 failed | **+4 files, +53 tests**. The other 12 files and 134 tests are other rows' |

| Project | File (`apps/core-server/src/engine/__tests__/`) | Tests |
|---|---|--:|
| `unit` | `actor-scope.test.ts` | 8 |
| `unit` | `delta.test.ts` | 11 |
| `unit` | `errors.test.ts` | 23 |
| `unit` | `hosted-actions.test.ts` | 17 |
| `unit` | `plugin.test.ts` | 8 |
| `unit` | `rehydrate.test.ts` | 24 |
| `unit` | `ring.test.ts` | 6 |
| `unit` | `scheduler.test.ts` | 7 |
| `unit` | `static.test.ts` | 15 |
| `unit` | `write-plan.test.ts` | 9 |
| `db` | `commands.db.test.ts` | 20 |
| `db` | `recording.db.test.ts` | 13 |
| `db` | `restart.db.test.ts` | 14 |
| `db` | `ticks.db.test.ts` | 6 |

The five adapted test files of other rows keep their test counts: no test was added or removed.

## Findings (details: `26_engine_host.md` section 18)

| ID | Finding |
|---|---|
| F-1 | Six tests in four files of other rows pinned "the boot is B-1 to B-9 and nothing else"; adapted under D72 |
| F-2 | The scaffold's test "the stubs that are not implemented say which row fills them" is now empty (two unused locals, two lint warnings, exit 0) |
| F-3 | The helper's forced drop is refused for a database a reset has just built; this row's reset test drops it with the plain form |
| F-4 | The simulator's 1 Hz hardware step falls on whole clock seconds: the snapshot rule is "once per clock second" |
| F-5 | A level in dBFS is stored by design (a timeline item); the markers of a meter frame are `channels` and `noSignal` |
| F-6 | The engine refuses nothing for the 23 actions the simulator does not check; the access rule is the only check |
| F-7 | `acknowledgeSummary` leaves the SEALED session in place until the next session replaces it |
| F-8 | `verify` on a tampered item appends one custody entry; the sealed columns and tracks stay byte-equal |
| F-9 | A database test of any row that boots the app on a seeded clone now gets a running engine on the system timer |
| F-10 | The first process start on a fresh seed writes one `TABLET_LINK_CHANGED` row (the seed's link is CONNECTED): 83 audit rows, not 82 |
| F-11 | 13 of the 31 hosted actions were not run against PostgreSQL by this row |
| F-12 | A unit whose write the mapping refuses fails again at every resumed tick (one error line a second); not produced |
| F-13 | Every operation of a real run is a valid `DeltaOp` of the contract; the durable slices are the contract's 28 replicated names |
| F-14 | No `SIM-GAP`, no `SCHEMA-GAP`, no `CONTRACT-GAP` |
| F-15 | `reset-failures.db.test.ts` of the reset row is sensitive to load (its 3 s wait for the routine's sessions) |

## Deviations (details: section 19)

DV-1 five test files of other rows edited (D52, D72). DV-2 the last committed instant also takes
`at` of the newest stored audit row and event. DV-3 the host reloads by itself after a diverged
head. DV-4 `EngineHost` has more members than the sketch, and an `EngineControl` for tests. DV-5 a
third start mode `resync`. DV-6 the store stays in `src/db/seed/store.ts`. DV-7 the shared tracker
files were not written. DV-8 the test support imports the test support of three other rows. DV-9
one test database is dropped with the plain form by the test.

## Decisions for the controller (details: section 20)

| ID | Question | Recommendation |
|---|---|---|
| DN-1 | The API of `app.engine` (`command`, `run`, `setTabletLink`, `mirrorOperators`, `state`, `slice`, `start`, `reload`, `stop`, `stats`) | Accept |
| DN-2 | The snapshot row once per clock second for ticks | Accept |
| DN-3 | The reload with a new epoch after a diverged head | Accept |
| DN-4 | The empty stub test of `readiness.test.ts` | Have it deleted by the scaffold's owner or the next row that touches the file |
| DN-5 | The last committed instant with the newest audit row and event | Accept |
| DN-6 | A failed rehydration stops the boot | Accept |
| DN-7 | Pass to W42 | `26_engine_host.md` section 9 |
| DN-8 | Pass to W43 | Section 10; the info-level log line of D28 D-3 is the module's |
| DN-9 | Pass to W28, W34 to W40 | Section 3 and F-6 |
| DN-10 | Pass to W33 | `await app.engine.mirrorOperators()` after the commit |
| DN-11 | Pass to rows whose database tests boot the app | F-9: `engineControl(app).useTimer(...)` before the boot |
| DN-12 | Pass to W53 | The engine half of AC-B-04 to AC-B-06 is proven here; F-10 for the counts |
| DN-13 | The location of the store (D62 DN-10) | Leave it; W38 may move it |

## Blockers

None.

---

# Fix round B2a (decisions D89, D101, D104, D106, D110)

Status: **needs-review** (2026-10-04 20:00 WIB). The six items are implemented, tested and landed,
one item per step. One assertion of the demo row pins the outcome that item 2 changed by ruling
and is red; it is not this row's to edit (`reset-failures.db.test.ts:391`, decision DN-B2a-1).
Everything else is green. Full record: `implementation/26_engine_host.md` section 26. No
credential, token, pairing code or device credential appears in either document.

## Milestones (WIB)

| Time | What |
|---|---|
| 18:06 to 18:09 | Baselines in the tree: `unit` 141 files / 3,609 tests; `db` 108 files / 1,540 passed and 1 skipped; typecheck and lint exit 0. Pre-images of 34 files saved under `.cache/rollback/CPB2a/` |
| 18:09 | Scratch copy of `apps/core-server` outside the source tree, with a tool that lands a set of files in one step only when each target still equals the base the copy was built on |
| about 18:20 | Controller's addition to item 1 (security finding CPS1-1, guarantees G1 to G8): the clock must run on from the floor, and the floor must cover the sessions, the pairing codes, the paired devices and the biometric tokens. Item 1 rebuilt |
| 18:37 | The static test "no production file replaces a stage or a seam" (D82) refused the first wiring on the scratch copy. A clock without a floor that is behind is now refused, not wrapped |
| 18:45:29 | Item 1 landed. `unit` 143 / 3,709 exit 0. `db` 113 files passed; 2 tests red in another row's new file `test/acceptance/shared-state.test.ts` (the same two fail on the code of before item 1) |
| 18:54:17 | Item 2 landed, with the one un-skip line of the demo folder. `unit` 143 / 3,710 exit 0. One demo assertion (`:391`) red by design |
| 19:04:54 | Item 3 landed. `unit` 145 / 3,744 exit 0. `db`: `:391`, and five tests of rows that were changing `src/realtime/**` and `src/modules/identity/**` at that time |
| 19:12:57 | Item 4 landed. Typecheck exit 0. `unit`: one test of the identity row red (its files changed after 19:00) |
| 19:32:13 | Item 5 landed. `unit` 146 / 3,775 exit 0. `db`: `:391` and one test of the permission-guard row (its files changed after 19:28) |
| 19:41:24 | Item 6 landed. `unit` 147 / 3,795 exit 0; typecheck and lint exit 0 |
| 19:44 to 19:53 | Mutation check on a copy outside the repository: 58 mutations, 57 detected on the first pass, 58 after one assertion was added |
| 19:53 to 19:55 | Final: `unit` 147 / 3,795 exit 0; `db` 119 files, 1,707 passed, 1 failed (`:391`), 0 skipped; typecheck exit 0; lint exit 0 without a warning |
| 19:55 | End state: no database of the prefix `dems_test_step_48b_`; PostgreSQL PID 19121, start time unchanged |

## Files created or updated

All paths under `apps/core-server/`.

| File | Change | Item |
|---|---|--:|
| `src/core/clock.ts` | modified: `FloorClock`, `createSystemClock(source?, timer?)`, `raiseClockFloor` | 1 |
| `src/core/index.ts` | modified: lines 66 and 67 (two exports added) | 1, 6 |
| `src/core/boot-checks.ts` | modified: two import lines and `runDatabaseBootChecks` added | 6 |
| `src/engine/api-headers.ts` | created | 5 |
| `src/engine/host.ts` | modified | 1 to 5 |
| `src/engine/rehydrate.ts` | modified: the floor statement, `clockFloor`, `clearTamperOverlay` | 1, 2 |
| `src/engine/index.ts` | modified: the floor and the header hook wired; exports | 1, 5 |
| `src/engine/headless-sim.ts`, `src/engine/errors.ts` | modified | 1 |
| `src/engine/write-plan.ts`, `src/engine/limits.ts` | modified: `storedOnly` removed; a comment | 3 |
| `src/engine/types.ts` | modified: `meters?()`; the start modes described | 2, 3, 4 |
| `src/engine/__tests__/clock-floor.test.ts`, `clock-floor.db.test.ts` | created | 1 |
| `src/engine/__tests__/api-headers.test.ts`, `api-headers.db.test.ts`, `api-headers.outcome.db.test.ts` | created | 5 |
| `src/engine/__tests__/boot-checks-runner.test.ts`, `boot-checks-runner.db.test.ts` | created | 6 |
| `src/engine/__tests__/rehydrate.test.ts`, `restart.db.test.ts`, `recording.db.test.ts`, `ticks.db.test.ts`, `write-plan.test.ts`, `plugin.test.ts`, `static.test.ts` | modified | 1 to 5 |
| `src/modules/demo/__tests__/reset-failures.db.test.ts` | modified: line 421 only (`it.skip(` to `it(`) | 2 |
| `docs/.../implementation/26_engine_host.md` | section 26 appended | — |
| `docs/.../delegation_progress/coder_execution_step_48.md` | this part appended | — |

Not written: `app.ts`, any module's production code, `src/realtime/**`, `src/plugins/**`,
`packages/shared`, `test/acceptance/restart.test.ts` (no list of `moversOf` moved), and the
controller's files.

## Per-item outcome

| # | Item | Outcome |
|--:|---|---|
| 1 | One time base, with a floor (F74, CPS1-1) | Done; G1 to G8 met, each with a test |
| 2 | The fault list after a resync or a reload (F73) | Done in all three start modes; the pending demo test passes; `:391` of the same file is red by design |
| 3 | One consistent cut (F71) | Done; 72 writing ticks a minute as before, 434 statements (was 429), no stale slice |
| 4 | `EngineHost.meters()` (F66) | Done; optional in the type only |
| 5 | API-7 headers in one place | Done, for the POST operations of the contract registry |
| 6 | One runner of the boot checks | Done |

## Findings, deviations, decisions

Section 26.10 (nine findings), 26.11 (six deviations), 26.12 (six decisions). The ones that need
an answer:

| ID | Decision |
|---|---|
| DN-B2a-1 | Authorise `demo/__tests__/reset-failures.db.test.ts:391`: `stored.length + 1` to `stored.length + 2` |
| DN-B2a-2 | `EngineHost.meters`: keep optional, or make it required with one line in five test doubles of other rows |
| DN-B2a-3 | A start with the system time behind: the server runs ahead of the system time with a warning (built), or refuses beyond a threshold |
| DN-B2a-4 | Three follow-on changes outside this row: the devices module reads `meters()`, the demo module calls `runDatabaseBootChecks`, the modules drop their own header lines |
| DN-B2a-6 | A test that starts a server behind the stored state must put a clock with a floor behind the seam (two lines, section 26.1) |

Deviation to note: until 18:44 several read-only commands and test runs of this round began with
`cd` (DV-B2a-1).

## Blockers

None for this row. The `db` project stays red in one test until DN-B2a-1 is answered.

---

# Follow-up of fix round B2a: the granted line, `meters` required, F78 (decisions D119, D122)

Status: **needs-review** (2026-10-04 21:00 WIB). The three items are landed, one landing each,
with a type check of the tree after each (exit 0). Item 3 is the fix D119 asks for; one
comparison of the demo row pins the state it replaces and is red, and it is not this row's to
edit (`src/modules/demo/__tests__/reset.db.test.ts:357-361`, decision DN-F-1). Full record:
`implementation/26_engine_host.md` section 27. No credential appears in either document.

## Milestones (WIB)

| Time | What |
|---|---|
| 20:31 | Scratch copy refreshed; pre-images of 43 files under `.cache/rollback/CPB2a_followup/` |
| 20:32:10 | Item 1 landed: the granted line of `reset-failures.db.test.ts`, with the assertion of what the two rows are. Typecheck exit 0; the demo folder's database tests 4 files / 43 tests exit 0 |
| 20:33:32 | Item 2 landed: `meters` required; one line in each of the five engine doubles. Typecheck exit 0; whole `unit` 147 / 3,795 exit 0 |
| 20:40 | `test/acceptance/shared-state.test.ts` on the tree before item 3: 6 tests pass; it prints `CONNECTED in the snapshot of the new epoch` and `snapshot 2/0; delta 2/1 (...)` |
| 20:44 to 20:47 | Item 3 on the scratch copy: whole `unit` 147 / 3,797 exit 0; whole `db` red in ONE file, `demo/__tests__/reset.db.test.ts` (a pinned comparison; four later tests of the file depend on the first) |
| 20:48 | The smallest change of that comparison, on a copy outside the tree: the demo folder 4 files / 43 tests exit 0 |
| 20:49 to 20:52 | Mutation check of item 3 on a copy outside the tree: 10 mutations, 9 detected on the first pass, 10 after two reset tests were continued |
| 20:52:16 | Item 3 landed. Typecheck exit 0; lint exit 0 |
| 20:52 to 20:53 | The engine folder: `unit` 13 files / 201 tests, `db` 8 files / 90 tests, both exit 0. The two acceptance files: 22 tests exit 0; the demo-reset test prints `OFFLINE in the snapshot of the new epoch` and `snapshot 2/0` |
| 20:53 to 20:55 | Whole `unit` 148 files / 3,814 tests exit 0. Whole `db` 121 files: 118 passed; red: `demo/__tests__/reset.db.test.ts` (by design, 5 tests) and two files of the database helper that were being written during the run |
| 20:56 | The two helper files alone: 11 tests exit 0. No database of the prefix `dems_test_step_48c_`; no listener of this row; PostgreSQL PID 19121 |

## Files created or updated

All paths under `apps/core-server/`.

| File | Change | Item |
|---|---|--:|
| `src/modules/demo/__tests__/reset-failures.db.test.ts` | granted: lines 388 to 399 (the comment, `+ 2`, the assertion of the two rows) | 1 |
| `src/modules/sessions/__tests__/memory-engine.ts:161`, `src/modules/demo/__tests__/support.ts:431`, `src/modules/devices/__tests__/support.ts:154`, `src/modules/storage/__tests__/support.ts:239`, `src/modules/system/__tests__/support.ts:327` | granted: one line each, `meters: () => null,` | 2 |
| `src/engine/types.ts` | `meters()` required; the tablet link per start mode | 2, 3 |
| `src/engine/host.ts`, `src/engine/rehydrate.ts` | the link the engine held is carried into the next start (`heldLink`, `carryTabletLink`) | 3 |
| `src/engine/__tests__/plugin.test.ts`, `ticks.db.test.ts` | `meters()` without `?.` | 2 |
| `src/engine/__tests__/restart.db.test.ts`, `rehydrate.test.ts`, `commands.db.test.ts` | 8 and 2 new tests; the log test knows the new member | 3 |
| `docs/.../implementation/26_engine_host.md` | section 27 appended | — |
| `docs/.../delegation_progress/coder_execution_step_48.md` | this part appended | — |

Not written: `src/realtime/**` (no change is needed there), any module's production code,
`test/acceptance/**`, `src/modules/demo/__tests__/reset.db.test.ts`, the controller's files.

## Decisions for the controller

| ID | Decision |
|---|---|
| DN-F-1 | Grant the change of `src/modules/demo/__tests__/reset.db.test.ts:357-358` (six lines, section 27.3): the comparison with the dataset leaves out `tablet_link` and `other_devices` of `hardware_snapshot`, and the link is asserted. Until then that file is red in the `db` project |
| DN-F-2 | A socket that opens or closes while the engine is stopped is applied one pace step after the start, with truthful rows: accept, or ask for a change of the realtime channel |
| DN-F-3 | Two texts of `test/acceptance/shared-state.test.ts` (`:706-707`, `:711`) still say "at the channel's pace step": wording, for the acceptance row |

## Blockers

None for this row. The `db` project stays red in one file until DN-F-1 is answered.
