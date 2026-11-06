---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: test-expert (tier R)
blueprint_row: 75 (plan W53, acceptance test "restart and recovery")
date: 2026-10-04
status: complete
evidence_tier: 2
---

# test-expert progress: step 75 (W53, restart and recovery)

Status: **complete** (17:41). Full record: `test/06_restart_recovery.md`; runner output and the
other evidence: `test/assets/06_*` (eleven files). All times WIB. No credential, token, credential
hash, password or pairing code is in this file.

## What exists now

- `apps/core-server/test/acceptance/restart.test.ts`: the one test file of the row, 1,372 lines,
  16 tests, in the `db` project (the row's file name runs as written: the project takes
  `test/acceptance/**/*.test.ts`). SHA-256 `24124795…1237d52f`, last written 17:24:28.
- A restart in it is `app.close()`, a poll until PostgreSQL lists no backend of `dems_app` on the
  clone, and a new app from the real factory on the same database, booted through
  `app.readiness.boot()`. Every request is `app.inject` through the real stages and handlers; the
  test's own are only the manual server clock and the engine's manual timer.
- The journey (one clone of the seed, five processes, four restarts): a policy change, a paired
  tablet, a pairing code left active, a role change, a session recorded to SEALED and verified
  evidence; then the per-table checksums of contract §9.6 of all 30 tables, the answers of 13 read
  operations, the epoch, the audit chain, the operators' sessions (SR-17) and the idle and
  absolute limits.
- Three sessions in flight at a stop, each on its own clone: RECORDING, FINALIZING, ARMED, with a
  second stop while in FAULT, a stop during the recovery, and a restart after the recovery.
- A control (a row changed in the stopped database is reported and served) and a long history
  (two restarts on a clone of the bulk fixture: 5,000 audit rows against a view of 1,000).

## Verification

| Check | Result |
|---|---|
| Row command, `DEMS_TEST_STEP=75 npm run test:db -w @dems/core-server -- test/acceptance` | 17:32:16: **1 file, 16 tests, exit 0**, 5.81 s; 0 databases remain with the run prefix |
| AC-B-04 | 30 of 30 tables compared in each of twelve restarts. After a restart with a tablet connected at the stop: 24 equal, 6 moved and named (`core_state`, `audit_log`, `audit_chain_head`, `events`, `engine_counters`, `hardware_snapshot`: the epoch and the start's own `TABLET_LINK_CHANGED` row). After a restart with a session in flight: 21 equal, 9 moved and named. After every other restart: 29 equal, `core_state` alone moved |
| AC-B-05, AC-B-06 | RECORDING and FINALIZING at the stop: FAULT after the start, `FAULT_RAISED` with no actor at the last committed instant, the recorded size and time without the stop; `recoverSession` 202, rows `SYSTEM_BOOT`, `RECOVERY_STARTED` (the caller), `FAULT_CLEARED`, then `SESSION_INCOMPLETE`, `RECOVERY_COMPLETED`; history INCOMPLETE; evidence RECORDED, never sealed. ARMED at the stop: INCOMPLETE and no evidence item |
| SR-17 | The SUPERVISOR session of the first process answers in four later processes without a sign-in; a signed-out session stays ended with its reason; idle expiry at exactly 15 minutes after the last activity, absolute expiry at exactly 8 hours after the issue in the first process |
| The epoch | Previous plus 1 at every start, in the engine, in `core_state` and in `x-dems-epoch`: 1 to 5 in the journey |
| The chain | Verifies over all stored rows after every restart; the three seams of the journey are asserted row by row |
| Typecheck, lint | 17:39:35 and 17:39:40: exit 0, exit 0, no warning |
| Whole `db` project, `--maxWorkers=2` | 17:25: exit 1, 107 of 108 files, one 5 s time-out in the helper row's `test/helpers/db/__tests__/templates.db.test.ts`; that file alone at 17:29: 12 of 12. **17:35: exit 0, 108 files, 1,540 passed, 1 skipped (not this row's)** |
| Can the test fail | 11 of 11 mutations of the test's INPUT detected (17:32:36), through a load-time transform in a scratch configuration; no file of the tree changed |
| End state, 17:39:48 | 0 databases with the prefix `dems_test_step_75_`; `.locks/postgres.pid` 19121, the project's `postgres`, started 07:14:26; no port bound; no process left |

## Test ledger

`db` project: +1 file, +16 tests (`test/acceptance/restart.test.ts`). `unit` project: nothing
(the file is not in it).

## Findings (severity is the row's proposal)

| ID | Severity | Finding |
|---|---|---|
| W53-F1 | Medium (security) | After a start whose server clock is behind the issue instant of an open session, nothing can end that session: `signOut`, `disableUser`, `revokeDevice` and a `signIn` that presents it answer 500 and change nothing (SQLSTATE 23514, `auth_sessions_times_check`, at `src/modules/identity/session-store.ts:205`, `:219`, `:223`), until the clock has passed the issue instant. Reproduction: `test/assets/06_repro_clock_behind.ts.txt` and its log |
| W53-F2 | Medium (audit trail) | After such a start a row of a server-native module is stamped before its predecessor, while a row of a hosted action in the same process is stamped at the instant the engine holds (measured: rows 89, 90, 91 at `+600 s`, `+490 s`, `+610 s`). The chain's hashes verify |
| W53-F3 | Low (by the specification) | A recovery under way at a stop is completed with rows stamped at the stored deadline, inside the time the server was down; when the start itself writes a row first, the same rows are stamped at the start instant |
| W53-F4 | Info | AC-B-05 names four recovery rows; the server writes five (`FAULT_CLEARED` too), as spec §8.6 lists them. The test asserts the five |
| W53-F5 | Info (known `SIM-GAP-W34-1`) | `elapsedMs` of a session faulted while RECORDING counts the stop (102,450 ms for 12,000 ms). Printed, not asserted |
| W53-F6, F7 | Info | The restart fault's audit row and alert carry the last committed instant, its health snapshot the start instant; a clean stop wrote nothing in twelve stops, so a recording's fault is stamped up to one second before the stop |
| W53-F8, F9 | Noise (P11) | The time-out in the helper row's file at 17:25; one lint warning in the bulk fixture follow-up's file at 17:24, gone at 17:39 |

No defect was found in SC2, AC-B-04 to AC-B-06 or SR-17 on a clock that moves forward.

## Deviations

- The journey has four restarts, not two; three tests more than the row names (ARMED at the stop,
  a long history, the control).
- `pairDevice` is not called (its parameter is the pairing row's app object); `portalPost` and
  `redeem`, which it is made of, are. The file builds its app itself, because `engineApp` and
  `sessionsApp` replace the seam `publish`.
- The checksum of four tables and of the "untouched parts" is the file's own statement after
  contract §9.6: no exported helper covers all 30 tables.
- Between 16:53 and 17:10 the row's file held exploration drafts; the acceptance test replaced
  them at 17:10.
- `masterplan/02_plan.md`, `status_tasks.md`, `implementation/99_implementation_report.md` and
  `test/01_test_report.md` were not written (parallel run: the controller's).
- Process notes: several read-only commands at the start began with `cd` into the workspace root
  itself, and one read-only search of this row's own log copies began with `cd` into the scratch
  folder under the temp directory. None changed into a subfolder of the workspace.

## Decisions for the controller

1. W53-F1 and W53-F2: severity and routing (the owner of the core clock and of the identity
   module). Proposal: one time base per process, held at or above the last committed instant at a
   start, as the engine holds its own. Until then a recorded residual.
2. W53-F3: accept as specified, or stamp a timed transition whose deadline lies inside a stop at
   the start instant.
3. W53-F4: correct the wording of AC-B-05 at the close-out.
4. The exact lists "which tables a start may write" are assertions of this file: a later row that
   changes what a start writes changes `moversOf` there, by design.
5. Accept the extra restarts and tests.
6. For the gate W58 and the clean-state row W90: a restart with a tablet connected adds one
   `TABLET_LINK_CHANGED` row and one event; one with a session in flight adds `FAULT_RAISED`, an
   alert and a health snapshot; every other restart changes `core_state` only.
7. The 5 s time-out of `test/helpers/db/__tests__/templates.db.test.ts` in a two-worker whole run:
   for the helper row's owner.

## Files created or updated

- `apps/core-server/test/acceptance/restart.test.ts` (new)
- `docs/2026-10-04_dems_backend_rbac_pairing/test/06_restart_recovery.md` (new)
- `docs/2026-10-04_dems_backend_rbac_pairing/test/assets/`: `06_row_command.log`,
  `06_row_command_verbose.log`, `06_mutations.json`, `06_mutation_harness.vitest.config.mjs.txt`,
  `06_mutation_harness.run.sh.txt`, `06_mutations.log`, `06_repro_clock_behind.ts.txt`,
  `06_repro_clock_behind.log`, `06_whole_db_1725.log`, `06_whole_db_1735.log`,
  `06_end_state.mts.txt` (new)
- `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/test_expert_step_75.md` (this file)

---
*Generated: 2026-10-04 17:41 WIB*
