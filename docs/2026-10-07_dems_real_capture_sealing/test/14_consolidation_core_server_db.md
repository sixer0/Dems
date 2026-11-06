---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-11
agent: test-expert
step: test-suite consolidation, core-server DATABASE tests (owner SV-D)
decision: D233, D238
tree: a5d75ed plus the uncommitted consolidation work of the six owners
status: complete
---

# Test-suite consolidation: core-server database tests

Scope: `apps/core-server` `*.db.test.ts`, `test/db/**`, `test/helpers/db/**`, `test/acceptance/**`.
Brief: `delegation_progress/consolidation_brief.md`. Work list: `test/13_suite_consolidation_audit.md`
sections 3c, 4, 5, 7.1 (SV-D1 to SV-D4). Tests and test support only; no product file is changed
(four product files were mutated for a proof and restored from a copy, each `cmp`-identical:
section 6). No git write. Both lanes were stopped first (`scripts/lane/lane.sh stop 1`, `stop 2`:
"lane 1 stopped (was PID 57048)", "lane 2 stopped (was PID 57092)"); nothing was reset and no
lane was started.

Scratch files of this session (raw reports, logs, scripts): `scratchpad/c14db/`.

## 1. Before / after

Command, both times, as `test/12_precommit_wave_m.md` row 5 ran it, with the JSON reporter added:
`/usr/bin/lockf -k -t 3600 .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=2 --reporter=default --reporter=json --outputFile.json=<scratch>`

| | before | after | change |
|---|---|---|---|
| test files | 196 (193 passed, 3 skipped) | 181 (178 passed, 3 skipped) | -15 |
| tests | 2443 (2436 passed, 7 skipped, 0 failed) | 2430 (2423 passed, 7 skipped, 0 failed) | -13 |
| wall of the run (vitest "Duration") | 345.86 s | 208.41 s | -137 s against this BEFORE (loaded host); -35 s against the 243 s of run 12 |
| sum of per-file times | 466.3 s | 277.2 s | |
| 1-minute load at the start | 0.96 (it rose to 90 during the run: the other owners' suites) | 6.95 at the start (waited from 17.1 until it was below 8), 3.61 at the end | |
| per-wave files (`wave-*`, `integration-*`, `pass-*`, `fix-*`) | 16 files, 44 tests | 0 | |

The BEFORE wall (346 s) is not the 243 s of run 12: the host was shared with five other owners
running their suites (1-minute load 15 to 90 while it ran). The two walls are therefore not a
clean pair; the per-file figure of the one file that was rewritten is measured alone in section 3.
One more caveat of the BEFORE run: the two-line timer edit of SV-D1 (section 2) was already in
`integration-d1b.db.test.ts` and `integration-c1.db.test.ts` when the run reached them (I edited
while it was running); it changes no count. The flake itself is recorded in test/12 R1.

Slowest 10 files, before:

| s | tests | file |
|---|---|---|
| 102.0 | 16 | `src/modules/capture-discovery/__tests__/capture-discovery.db.test.ts` |
| 36.6 | 55 | `src/capture-session/__tests__/session-capture.db.test.ts` |
| 31.5 | 54 | `src/db/reset/__tests__/reset-failures.db.test.ts` |
| 24.6 | 26 | `src/db/fixtures/__tests__/bulk-fixture.db.test.ts` |
| 21.0 | 3 | `src/db/reset/__tests__/wave-i-a1-reset-lane.db.test.ts` |
| 19.1 | 38 | `test/acceptance/contract.test.ts` |
| 15.3 | 39 | `test/acceptance/rbac-matrix.test.ts` |
| 14.0 | 27 | `src/engine/__tests__/restart.db.test.ts` |
| 10.7 | 23 | `src/modules/transcripts/__tests__/transcript-routes.db.test.ts` |
| 9.3 | 6 | `test/acceptance/shared-state.test.ts` |

Slowest 10 files, after:

| s | tests | file |
|---|---|---|
| 37.4 | 16 | `src/modules/capture-discovery/__tests__/capture-discovery.db.test.ts` |
| 25.0 | 54 | `src/db/reset/__tests__/reset-failures.db.test.ts` |
| 22.0 | 8 | `src/db/reset/__tests__/cli.db.test.ts` (holds the three reset-lane cases, 21 s, since the move) |
| 18.2 | 54 | `src/capture-session/__tests__/session-capture.db.test.ts` |
| 10.2 | 38 | `test/acceptance/contract.test.ts` |
| 9.1 | 39 | `test/acceptance/rbac-matrix.test.ts` |
| 7.8 | 26 | `src/db/fixtures/__tests__/bulk-fixture.db.test.ts` |
| 7.5 | 4 | `src/modules/capture-discovery/__tests__/capture-discovery.booted.db.test.ts` |
| 7.3 | 2 | `src/modules/capture-discovery/__tests__/lane-camera-stub.db.test.ts` |
| 6.3 | 32 | `src/engine/__tests__/restart.db.test.ts` |

### The test count, to the single test

2443 - 13 = 2430. The 13 are the schema stamps of section 5, nothing else:

| what | files | tests |
|---|---|---|
| merged or renamed (section 4) | -15 (16 per-wave files gone, 1 new feature-named file) | 0: 44 run tests moved; 3 of the 44 are stamps deleted afterwards |
| schema stamps deleted (section 5) | 0 | -13 |
| flake fix, slow-file fix | 0 | 0 |

Static proof (script `scratchpad/c14db/hashes.mjs`: every `it` / `test` call site of the db
project with the hash of its body, comments removed and white space collapsed, before and
after): 1901 call sites before, 1888 after (-13). 40 call sites are found with the same title and
the same body hash in another file (the moves); 13 hashes left (the stamps); 4 bodies changed and
are the four cases of `capture-discovery.db.test.ts` named in section 3. No other body changed.

Typecheck and lint of the workspace after the work: `npm run typecheck -w @dems/core-server` exit
0, `npm run lint -w @dems/core-server` exit 0 (both on the shared tree, with the unit owner's
uncommitted work in it). The helper's own unit tests (`test/helpers/db/__tests__`, unit project):
11 files, 394 passed.

## 2. SV-D1, the flake (`integration-d1b.db.test.ts`)

Cause as the audit read it (section 5.5), confirmed in the code: `booted()` built the application
without a timer, so the engine ran on its real 50 ms interval and its health sampler could tick
between `await storedSlices(owner)` and `server.app.engine.state()`.

Fix (test only, the mechanism 20 db files already use): `engineControl(app).useTimer(manualTimer().timer)`
between `app.ready()` and `app.readiness.boot()` in `booted()`. Nobody fires that timer, so the
committed state moves only by the commands of the case. The file is now part of
`capture-config.db.test.ts` (section 4); the line is at its `booted` helpers.

The three other files the audit names, read one by one:

| file | what it runs on | action |
|---|---|---|
| `capture-config/__tests__/integration-c1.db.test.ts` | its two state comparisons use `engineApp` (manual timer, `test/support/engine.ts:215`); its second helper `booted()` had no timer but compares no state | the same line added to that `booted()` (no engine tick at a moment no test chooses); now in `capture-config.db.test.ts` |
| `modules/demo/__tests__/reset-failures.db.test.ts` | `demoApp` (`modules/demo/__tests__/support.ts:668-669`: manual timer) | none needed: not exposed. The audit's grep looked for the word "timer" in the test file; the timer is in its support module |
| `modules/evidence/__tests__/immutability.db.test.ts` | `evidenceApp` (`modules/evidence/__tests__/support.ts:122-123`: manual timer) | none needed: not exposed, for the same reason |

Proof: the file alone, 10 runs, the project's command with the file path: 10 of 10 green
(`scratchpad/c14db/d1b10.log`: "run 1 rc=0 Tests 4 passed (4)" ... "run 10 rc=0 Tests 4 passed (4)",
1-minute load 9.8 to 14.4 during the runs); `integration-c1.db.test.ts` once: 5 passed. No
product change. The mutation the audit proposes (drop the `pipeline.drain()`) was not run: one
passing run is the proof depth of D122 for a non-security row, and the race is closed by
construction (no tick can happen).

## 3. SV-D2, the slowest file (`capture-discovery.db.test.ts`)

| | before | after |
|---|---|---|
| the file (per-file time of the whole run) | 102.0 s | 37.4 s |
| the file alone, three runs (vitest "Duration", start-up included) | not measured alone | 39.2 s, 41.6 s, 41.8 s |
| tests | 16 | 16 (the same 16; one stamp deleted and one case moved in afterwards: section 4, 5) |

What was real time: four sleeps of 3.3 to 3.4 s per search on the REAL discovery adapter
(`:445`, `:518`, `:544`, `:684` of the old file), 2 x 3 + 2 + 1 + 2 x 9 = 27 searches.

What changed. The adapter takes its timers from its caller (`createOnvifDiscoveryAdapter({ timers })`,
already so in the product; the unit test `ws-discovery.test.ts:141` drives it the same way). The
file now gives it the manual timer set of the test support (`manualCaptureTimers`) and moves the
two timers of a search itself: `openStubWindow()` waits until the first round of probes has
really reached the stub and both timers are armed (it asserts `[250, 3000]`), moves the 250 ms of
the repeat, waits for the second round and for the answers to cross the loopback (150 ms of real
time), and moves the clock to 2,999 ms; `closeStubWindow()` asserts that exactly 1 ms is left,
moves it and asserts that no timer remains. The datagrams still travel through the real sockets
of the loopback and nothing of the adapter is replaced. The audit's wording was "the clock the
file already advances (`server.clock.advance`)": that clock is the Core's, and the adapter's
window does not run on it; the injectable clock of the window is the adapter's own timer set. No
product change was needed.

ONE real-timer case is kept: "run 1" of M4-DISC-STUB-1 (N = 0, 1 and 3 devices) runs the adapter
on `createSystemTimers()` and waits three whole windows on the wall clock (10.9 s). "run 2" of
the same case is the same assertions on the manual timers.

Assertions: none dropped. Added: the two timer controls above in every manual search; in
`stubSearch` the state is read as `RUNNING` with an empty list one millisecond before the end.

The RECORDING case (M4-DISC-REC-1 (c) / M4-SEC-DISC-3, both runs, nine hostile modes each) needed
more than the clock, and I report it because it is the one place where my first version was
WEAKER than the original:

- The original counted "more than 100 fragment checkpoints while this search was open" over a
  fixed 3.3 s of the wall clock, with the fake worker writing every 5 ms.
- First version: window on the manual timers plus a relative wait of 250 ms. Mutation B (below)
  showed that a search which blocks the event loop still passed: the relative waits that follow
  the block let the writer catch up. Rejected.
- Final version: the writer runs every 1 ms; the count is taken by a timer set BEFORE the search
  starts, 800 ms of the wall clock later (`RECORDING_WINDOW_WALL_MS`), whatever the search did
  with the event loop in between; the original assertion line is kept and a second one asserts
  the fixed-window count (`checkpoints inside the fixed wall-clock window` > 100). Measured in a
  clean run: 478 to 498 checkpoints per window (the original's nominal was about 660), so the
  floor of 100 asks about the same share of the writer's pace as before.

Mutation proofs (product file `src/capture/adapters/camera/ws-discovery.ts`, each time restored
from `scratchpad/c14db/ws-discovery.ts.orig` and `cmp`-identical):

| mutation | result |
|---|---|
| A: `onDatagram` drops every answer | RED, 4 failed of 16: run 1 (system timers) AND run 2 (manual timers) of M4-DISC-STUB-1, "must FAIL when ... a registered identity reads REGISTERED", and the whole flow search -> test -> adopt -> assign. The manual-window cases see what the real-window case sees |
| B: 700 ms of blocked event loop per datagram | first version: GREEN (the weakness above). After the fix the run is red by the test's time limit (120 s) |
| C: 1,000 ms of blocked event loop ONCE per search | version with a relative wait: GREEN. Final version: RED, `WRONG_RELATES_TO: checkpoints inside the fixed wall-clock window: expected 5 to be greater than 100`. (The ORIGINAL test would have passed this mutation: 2.3 s of 3.3 s left about 460 checkpoints. The case is stricter than it was.) |

The file's own negative control ("must FAIL when: a stub that answers nothing gives 0 candidates,
not 1") is unchanged and runs on the manual timers.

Not done: the two other files with one 3.4 s window each
(`wave-i-a2-adopt-assign.db.test.ts`, now `capture-discovery.booted.db.test.ts`, and
`lane-camera-stub.db.test.ts`, 7.4 s each). Their Core is the lane launcher's, whose adapter is
built inside `test/support/lane-camera-stub.ts` on the system timers. That file belongs to the
unit / test-support owner, the first of the two files is a PROTECTED booted-order scenario, and
the launcher is what a lane runs: left as they are.

## 4. SV-D3, the per-wave files

16 files (44 tests) -> 0. 15 are merged into a home file; 1 is the same file under a feature name.

How a file was moved (script `scratchpad/c14db/merge.mjs`, TypeScript compiler API): its imports
are merged into the home file's (specifiers rewritten for the folder, no name of the home file
shadowed by an import: the script stops on a conflict); everything else - constants, helpers,
hooks, `describe` blocks - goes, unchanged and in order, into ONE `describe` at the end of the
home file, titled with the finding id and without the wave / pass word; its header comment is
kept above it; lines inside template literals keep their text exactly. Every `it` body is
unchanged (hashes, section 1).

The database of a moved block. The audit's rule "a home file must not gain a second
`useTestDatabase`" is kept, and the helper says the same ("One database per test file", TI-8):

- **shared**: the moved cases only ever took further clones (`db.another`) and the run
  (`db.run`); they now take them from the home file's handle. The unused base clone of the old
  file is gone.
- **own**: the moved cases write to their file's own database across cases or processes. They keep
  one: `useFurtherDatabase(home, { template, slug })`, a new function of the helper
  (`test/helpers/db/index.ts`, beside `useTestDatabase`): a further clone of the home file's run,
  created before the first test of the block and dropped after its last one, with the same handle
  surface. The number of databases per run is unchanged for these.

| from (deleted) | to | tests | database |
|---|---|---|---|
| `src/capture/__tests__/wave-h-f-boot-clear.db.test.ts` | `src/capture/__tests__/boot.db.test.ts` | 1 | shared |
| `src/db/reset/__tests__/wave-i-a1-reset-lane.db.test.ts` | `src/db/reset/__tests__/cli.db.test.ts` | 3 | own |
| `src/db/reset/__tests__/wave-i-a1-unsealed-fake.db.test.ts` | `src/db/reset/__tests__/real-evidence-m7.db.test.ts` | 3 | own |
| `src/engine/__tests__/pass-j-restart-recording.db.test.ts` | `src/engine/__tests__/restart.db.test.ts` (PROTECTED) | 2 | shared |
| `src/engine/__tests__/wave-i-a2-graceful-restart.db.test.ts` (PROTECTED) | `src/engine/__tests__/restart.db.test.ts` | 2 | shared |
| `src/engine/__tests__/wave-k-s1-restart-fault.db.test.ts` (PROTECTED) | `src/engine/__tests__/restart.db.test.ts` | 1 | shared |
| `src/engine/__tests__/wave-h-a-no-invented-rows.db.test.ts` (PROTECTED) | `src/engine/__tests__/capture-actions.db.test.ts` | 2 | shared |
| `src/modules/alerts/__tests__/wave-l-s-unsealable-ack.db.test.ts` (booted order, three processes) | `src/modules/alerts/__tests__/alerts.db.test.ts` | 1 | own |
| `src/modules/capture-config/__tests__/integration-c1.db.test.ts` | `src/modules/capture-config/__tests__/capture-config.db.test.ts` | 5 | shared |
| `src/modules/capture-config/__tests__/integration-d1b.db.test.ts` | `src/modules/capture-config/__tests__/capture-config.db.test.ts` | 4 | shared |
| `src/modules/capture-discovery/__tests__/wave-i-a2-search-ids.db.test.ts` | `src/modules/capture-discovery/__tests__/capture-discovery.db.test.ts` | 1 | own |
| `src/modules/evidence/__tests__/wave-h-r-seed-sealed.db.test.ts` | `src/modules/evidence/__tests__/detail-facts.db.test.ts` | 5 | own |
| `src/modules/evidence/__tests__/wave-k-s2-sending-device.db.test.ts` | `src/modules/evidence/__tests__/commands.db.test.ts` | 3 | own |
| `src/modules/sessions/__tests__/wave-i-a2-sending-device.db.test.ts` | `src/modules/sessions/__tests__/operations.db.test.ts` | 2 | own |
| `test/db/integration-d4.db.test.ts` | `test/db/device-upsert.db.test.ts` | 5 | own |
| `src/modules/capture-discovery/__tests__/wave-i-a2-adopt-assign.db.test.ts` (PROTECTED: adopt -> assign -> pre-check) | NEW NAME `src/modules/capture-discovery/__tests__/capture-discovery.booted.db.test.ts`: the same file, four comment lines added on top | 4 | its own file |

Where I left the audit's pairing (it was derived from shared imports, and says so):

| file | audit's home | taken | why |
|---|---|---|---|
| `integration-d1b` | `capture/fence/__tests__/fence.db.test.ts` | `capture-config.db.test.ts` | it tests operation 78 of capture-config; `fence.db.test.ts` is a protected file of another unit |
| `wave-i-a1-unsealed-fake` | `m4-sec-reset.db.test.ts` | `real-evidence-m7.db.test.ts` | both hold "the guard's ONE statement on the real tables" |
| `pass-j-restart-recording`, `wave-i-a2-graceful-restart` | `api-headers.outcome.db.test.ts` | `restart.db.test.ts` | restarts of the engine; `restart.db.test.ts` is that file |
| `wave-k-s1-restart-fault` | `sealing-notice-doors.db.test.ts` | `restart.db.test.ts` | the same |
| `wave-h-a-no-invented-rows` | `sealing-host/__tests__/e2e/seal-e2e.db.test.ts` | `engine/__tests__/capture-actions.db.test.ts` | the env-gated e2e is skipped in the default run; the moved cases must run. Same folder, same real boot |
| `wave-l-s-unsealable-ack` | `engine/__tests__/unsealable-doors.db.test.ts` | `alerts.db.test.ts` | the alert and its acknowledgement (operation 70); same folder |
| `wave-k-s2-sending-device` (evidence), `wave-i-a2-sending-device` (sessions) | none by import | `commands.db.test.ts`, `operations.db.test.ts` | the actions whose rows they read |
| `wave-i-a2-adopt-assign` | `lane-camera-stub.db.test.ts` | its own feature-named file | the brief allows a named home for a protected booted-order scenario |

Describe titles changed (the full names of the moved tests gain the wrapping title): `pass J: a
start of the Core ...` -> `a start of the Core ...`; `item 2: the notices ...` -> `the notices ...`.
Every `it` title is unchanged. Three comments that named a deleted file now name its home.

Each home file was run after the moves (15 files, 198 tests, all passed), then the whole suite
(section 1).

Limits of a timeout inside a moved block: a moved file's `vi.setConfig({ testTimeout, hookTimeout })`
is kept inside its `describe` when the home file had none; it applies to the tests registered
after it, which are the moved ones (the blocks are at the end of the file). No limit of an
existing test was raised.

## 5. SV-D4, the schema stamps

The audit's open question, answered YES: the templates of the db project are built by the
migrations the migrate test checks. `test/db/template-hook.schema.ts:18-20` builds `tpl_schema`
with `applyMigrations(pool)` (the function `db:migrate` uses); `tpl_seed` is a copy of it with the
seed (`test/helpers/db/hooks.ts`, `TEMPLATE_BASES`: seed <- schema, bulk <- seed); and
`applyMigrations` itself refuses a database whose stored version is not the code's
(`src/db/commands/migrations.ts:287`).

Mutation, run once: `DB_SCHEMA_VERSION` 6 -> 7 in `src/db/schema/meta.ts`, no migration; command:
the db project on `test/db/migrate.db.test.ts` and `src/engine/__tests__/fact-doors.db.test.ts`.
Result: RED, exit 1, before any test: `DbTestHelperError: Building ..._tpl_schema failed: After
the migration the database is at schema version 6 (dbc-7); this code expects 7 (dbc-7). The last
file of a migration set sets the version (MG-5).` (`code: 'SCHEMA_VERSION_MISMATCH'`). Restored
from `scratchpad/c14db/meta.ts.orig`, `cmp`-identical.

That is not the red the audit predicted (`migrate.db.test.ts:106`), and the difference matters:
the run does not reach a test at all. So a db test can never run on a clone whose version is not
the code's: the global setup of every run is the cover, and it is stronger than one test. The
literal pair `6` / `dbc-7` that a stamp repeats is asserted by `test/db/migrate.db.test.ts:89-90`
and `:105-106`, which remain.

Deleted: 13 tests, each of them only `SELECT schema_version, contract_revision FROM schema_meta`
compared with `[6, 'dbc-7']`:

| # | file (line at a5d75ed) | title |
|---|---|---|
| 1 | `src/engine/__tests__/fact-doors.db.test.ts:27` | schema version 6, contract dbc-7: no migration |
| 2 | `src/db/mapping/__tests__/fault-key.db.test.ts:27` | schema version 6, contract dbc-7: `alerts.reason` exists (the body reads only the version; the column is used by the next test of the file) |
| 3 | `src/capture-session/__tests__/session-capture.db.test.ts:284` | schema version 6, contract dbc-7 |
| 4 | `src/modules/sessions/__tests__/audio-intervals.db.test.ts:48` | schema version 6, contract dbc-7: no migration |
| 5 | `src/modules/storage/__tests__/volume-at-boot.db.test.ts:37` | schema version 6, contract dbc-7 |
| 6 | `src/modules/transcripts/__tests__/transcripts.db.test.ts:164` | is at schema version 4 / dbc-5 (sets 4 and 5), and this row brought no migration (the body asserted `[6, 'dbc-7']`: the title was stale) |
| 7 | `src/modules/transcripts/__tests__/transcript-routes.db.test.ts:220` | schema version 6, contract dbc-7: no migration |
| 8 | `src/modules/transcript-chunks/__tests__/transcript-chunks.db.test.ts:64` | is at schema version 4 / dbc-5 ... (as 6) |
| 9 | `src/modules/capture-discovery/__tests__/capture-discovery.db.test.ts:167` | is at the schema version of the code: [6, 'dbc-7'] |
| 10 | `src/modules/capture-discovery/__tests__/session-expiry.db.test.ts:99` | is at the schema version of the code: [6, 'dbc-7'] |
| 11 | `src/modules/capture-config/__tests__/integration-c1.db.test.ts:55` (in `capture-config.db.test.ts` after the move) | schema version 6, contract dbc-7 |
| 12 | `src/modules/capture-config/__tests__/integration-d1b.db.test.ts:129` (the same) | schema version 6, contract dbc-7 |
| 13 | `test/db/integration-d4.db.test.ts:68` (in `device-upsert.db.test.ts` after the move) | schema version 6 / dbc-7: no migration belongs to this pass |

KEPT, although the audit lists them among its 17: four tests that are not only a stamp.

| file | what else the test asserts |
|---|---|
| `src/modules/recording-fragments/__tests__/recording-fragments.db.test.ts:75` | the ten columns, the primary key, and that PostgreSQL computes the same chain link as Node. It reads no `schema_meta` at all |
| `src/transcription/__tests__/snapshot-store.db.test.ts:58` | the ten columns of `session_stt_config` and that none is a credential column |
| `src/db/reset/__tests__/store-root.db.test.ts:123` | a seeded database stores no media root |
| `src/modules/capture-discovery/connect/__tests__/connect.db.test.ts:213` | the pool of the guard application is `dems_app` |

Three of them still carry one stamp line each beside their real assertion. Removing only that
line is a change of a kept test, not a deletion the audit lists: left for a ruling.

KEPT as the brief orders (protected folders): `src/sealing/__tests__/stt-states.db.test.ts:112`,
`last-resort.db.test.ts:132`, `src/capture/fence/__tests__/fence.db.test.ts:101`,
`development-session.db.test.ts:237`, `src/plugins/permission-guard/__tests__/session-holder.db.test.ts:67`.

## 6. Product files touched for a proof, and restored

| file | mutation | restored |
|---|---|---|
| `src/capture/adapters/camera/ws-discovery.ts` | A, B (twice), C (twice): section 3 | from `ws-discovery.ts.orig`, `cmp` identical after each |
| `src/db/schema/meta.ts` | `DB_SCHEMA_VERSION` 7: section 5 | from `meta.ts.orig`, `cmp` identical |

`git status --short` shows neither file.

## 7. Test support changed

- `test/helpers/db/index.ts`: `useFurtherDatabase(home, options)` added (52 lines, section 4).
  Nothing existing is changed. It has no test file of its own: eight blocks in eight home files
  run on it in every db run, and the helper's unit tests (394) pass with it. A direct test in
  `test/helpers/db/__tests__` (the clone is dropped at the end of its block; `run` and `another`
  are the file's) would be the tidy completion: not written.

## 8. Not done, and why

| item | why |
|---|---|
| SV-D2 for `lane-camera-stub.db.test.ts` and the booted adopt-assign file (7.4 s each) | section 3: the timers are inside `test/support/lane-camera-stub.ts` (another owner), one file is protected |
| the stamp line inside the three kept mixed tests | section 5: needs a ruling |
| a mutation run for SV-D1 | section 2 |
| `capture-discovery.db.test.ts` under 20 s (the audit's estimate) | the one real-timer case is 10.9 s and the RECORDING case needs 800 ms of real wall clock per hostile mode (18 searches) to keep its count meaningful: about 38 s |
| the unit / acceptance pins of section 4 of the audit that sit in db files (`engine/__tests__/commands.db.test.ts:735` allow-list of log keys) | the audit gives it to the unit owner as SV-U5 although the file is a db file; I did not touch it. If it is mine, it is open |
| the other real waits of the db project (`reset-failures.db.test.ts`, `session-capture.db.test.ts`) | not in the audit's table; not analysed |

## 9. For the other owners / the controller

- Two comments in UNIT files still name db files that no longer exist (not my files):
  `src/capture-notices/__tests__/probe-wiring.test.ts:113` (`wave-i-a2-adopt-assign.db.test.ts`,
  now `capture-discovery.booted.db.test.ts`) and `src/modules/evidence/__tests__/export-request.test.ts:169`
  (`wave-k-s2-sending-device.db.test.ts`, now in `modules/evidence/__tests__/commands.db.test.ts`).
- Implementation notes and gate reports name the old file names; I changed no document but this one.
- The audit's section 5.5 list of "four files exposed to the same race" is two files; the other
  two were never exposed (section 2).
- Nothing here needs a product change.

## 10. The run titles, before against after

From the two JSON reports (every test's title): 13 titles are in the BEFORE run and not in the
AFTER run, 0 the other way round. The 13: `schema version 6, contract dbc-7` x 4,
`schema version 6, contract dbc-7: no migration` x 3, `schema version 6, contract dbc-7: \`alerts.reason\` exists` x 1,
`is at the schema version of the code: [6, 'dbc-7']` x 2,
`is at schema version 4 / dbc-5 (sets 4 and 5), and this row brought no migration` x 2,
`schema version 6 / dbc-7: no migration belongs to this pass` x 1.

Skipped, both runs: 7 tests in 3 files, the env-gated runner checks (`seal-e2e`,
`development-session-e2e`, `kill-matrix`), as in run 12. They were not run here: the heavy checks
are the controller's, once per commit.

Closing lines of the AFTER run: `forced drops that needed a retry: 0`; `teardown: dropped 8
database(s) in 187 ms; 0 remain with the run prefix`.

---
*Generated: 2026-10-11*
