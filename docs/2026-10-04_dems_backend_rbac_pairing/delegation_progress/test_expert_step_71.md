---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: test-expert (tier R)
blueprint_row: 71 (plan W49, acceptance test "two-client shared state with resync")
date: 2026-10-04
status: complete
evidence_tier: 2
---

# test-expert progress: step 71 (W49, two-client shared state with resync)

Status: **complete** (19:24). Full record: `test/05_shared_state_realtime.md`; runner output and
the other evidence: `test/assets/05_*` (eleven files). All times WIB. No cookie value, session
token, device credential, pairing code or password is in this file.

## What exists now

- `apps/core-server/test/acceptance/shared-state.test.ts`: the one test file of the row, 884
  lines, 6 tests, in the `db` project. SHA-256 `bf629ad2…65a2160`, last written 19:14.
- `apps/core-server/test/acceptance/shared-state.support.ts`: its support, 1,217 lines, not a test
  file. SHA-256 `887a3c9b…2a62a0e34`, last written 19:05.
- Two REAL clients over a real listener (`127.0.0.1`, port 0): the shared Live source with the
  typed client and the Live socket client, unchanged, over Node's `fetch` and `WebSocket`. A is a
  web console (the INVESTIGATOR). B is the SUPERVISOR, once on a second web console and once on a
  paired tablet. A third client C (the TECHNICIAN) is opened as the fresh client.
- The scenario of AC-B-44 to AC-B-47, per kind of B: both take the snapshot; A creates, pre-checks,
  starts, marks and stops a session; after each step the Live store of A, the Live store of B and
  a second replica built from each client's frames equal `app.engine.state()` in all 28 slices at
  the engine's position (16 and 17 comparisons). Then B's socket is dropped (the server destroys
  its stream in (i); the network is cut in (ii)) while A runs two commands; B reconnects by its
  own backoff and equals a fresh client, its snapshot as sent, and the engine; an explicit resync
  gives the same.
- A new epoch with real sockets, twice: the engine stopped and started (`start('resync')`), and a
  REAL demo reset through `POST /api/v1/demo/reset` on a clone of this file.
- Two "can it fail" tests with seven controls, by changes of the test's input only.

## Verification

| Check | Result |
|---|---|
| Row command, `DEMS_TEST_STEP=71 npm run test:db -w @dems/core-server -- test/acceptance/shared-state.test.ts` | 19:14:49: **1 file, 6 tests, exit 0**, 10.45 s; 0 databases remain with the run prefix. With `--reporter=verbose` at 19:15:00: exit 0, every `[w49]` line |
| Client B equals client A after start, marker and stop | Yes, both kinds of B: 28 of 28 slices at every one of the 9 steps of the session, equal digests of A, B and the engine (for example `98534699f110` after `startRecording` in (i)) |
| After a dropped socket B equals a fresh snapshot | Yes. (i) B at 1/53, back 524 ms later with a snapshot at 1/55; (ii) back 1,729 ms later (its first attempt was refused) with a snapshot at 1/60; B = C = engine in 28 slices; one `GET /api/v1/auth/session` after the reconnect |
| Every message validates against the union | Yes: 2,934 frames on 26 sockets, eight kinds, 0 refused; gap-free on every socket |
| A store at revision N shows the command's effect | Yes, 18 commands: in the sender's store when its action settles, and in a replica built from the frames at exactly the named position; never in the position before |
| Nobody is sent what is not theirs | Anonymous: `hello` and 45 / 53 heartbeats with `sessionState: null`, nothing else. No `auth`, `authLockout`, `pairing`, `clock`, `audio` in any state message. No session event or list hint of another operator |
| New epoch | Engine restart: snapshot 2/0 on both sockets, not asked for. Demo reset: 200 `{ epoch: 2 }` after 963 ms; snapshot 2/0 on both; A told `session.updated` twice (TECHNICIAN, then INVESTIGATOR), B never |
| Can it fail | Deltas of one command withheld from B: equality RED (B at 1/2, engine at 1/3; `meta`, `session`, `events`, `audit` differ), GREEN after B met the gap and resynced. A frame with an unknown member: validation RED. Five more controls, all red as they must be |
| Typecheck, lint, static guards | 19:14:29 exit 0; 19:14:21 exit 0, no warning; 19:14:22 9 files / 112 tests exit 0 |
| Whole `db` project, `--maxWorkers=2` | Three runs, all exit 1 with failures ONLY in other rows' files. 18:59: 114 files, 3 failed (`test/acceptance/pairing-lifecycle.test.ts` AC-B-82; `src/realtime/__tests__/upgrade.db.test.ts` AC-B-85; `src/modules/demo/__tests__/reset-failures.db.test.ts` F-5). 19:07: 115 files, 6 failed (`upgrade.db.test.ts` CPS1-5 time-out at load 15; `reset-failures.db.test.ts`; four files of `src/modules/identity/biometric/__tests__/`). 19:15: 115 files, 1,691 tests, 3 failed (`reset-failures.db.test.ts`; biometric `failure` and `secrets`). This row's file passed in all three |
| Runs of this file | 18 green alone (18:52 to 19:24; the last at 19:23:51, after the documents) and 3 green inside the whole project; 1 red at 18:47:41 by a wrong expectation of the test itself (meter frames for the fresh client), corrected |
| End state, 19:24:22 (after the last run) | 0 databases with the prefix `dems_test_step_71_`; 0 sessions on them; no listener of a node process, PostgreSQL's on 4432 only; no runner of this row alive; `.locks/postgres.pid` 19121 (started 07:14:26) |

## Test ledger

`db` project: +1 file, +6 tests (`test/acceptance/shared-state.test.ts`). `unit` project: nothing.

## Findings (severity is the row's proposal)

No departure from the contract in what SC3 and AC-B-44 to AC-B-47 ask: server, shared Live source,
typed client and Live socket client agree at every position compared.

| ID | Severity | Departing side | Finding |
|---|---|---|---|
| W49-F1 | Low | The contract (`packages/shared`) | The union does not refuse an unknown member of a `heartbeat`: `HeartbeatSchema` is `z.object` (`packages/shared/src/api/realtime-messages.ts:74`), the other eight members are strict. AC-B-46 by the union alone cannot show that a heartbeat carries nothing undeclared. The server sends none (member names of 341 heartbeats read). Reproduction: `WsServerMessageSchema.safeParse({ …a heartbeat…, extra: 'x' }).success` is true; the same for `admin.changed` is false |
| W49-F2 | Low | The server (engine reload in mode `reset`, with the channel) | After a demo reset the snapshot of the new epoch (2/0) says the Core link is CONNECTED although no paired device has a socket; one pace step later delta 2/1 sets it OFFLINE and appends `TABLET_LINK_CHANGED` and `TABLET_DISCONNECTED`. Spec §6.8, §12.4 ("recomputed from the open sockets": it is, one step late). Reproduction: the demo-reset test prints both lines |
| W49-F3 | Info | The runner's default reporter | Lines a passing test prints are hidden without `--reporter=verbose` |
| W49-F4 | Info | Test support | `testRoutine` / `useRoutine` of the reset row (imported here) and the channel row's stage with a real listener (not imported; this row built its own) are still in `__tests__` folders, not in `test/support/` |

## Deviations

- The template key is `seed` (M9 writes `tpl_seed`: the database's name).
- B is the SUPERVISOR in both scenarios; C is the TECHNICIAN, signed in beforehand, so that opening
  the fresh client changes nothing on the Core.
- B reaches the Core through a TCP relay of the test (a second listener on `127.0.0.1` port 0 per
  scenario): it holds B out deterministically while A runs two commands; in (ii) it is the
  network that is cut.
- In (ii) the test waits (bounded, 30 s cap; 544 to 752 ms measured) until the tablet's first
  reconnect attempt was refused, and drives 5.25 s of the server clock, so that the Core link goes
  OFFLINE while B is away.
- One import from a row's `__tests__` folder: the reset row's `testRoutine`, `useRoutine`, `RESET`.
- Three whole `db` runs instead of one (the tree moved; the third is on the final file).
- `masterplan/02_plan.md`, `status_tasks.md`, `implementation/99_implementation_report.md` and
  `test/01_test_report.md` were not written: shared files of the controller in a parallel run (P8).
- The first run of the file was inside the command sandbox and could not reach PostgreSQL; every
  later database run used the per-command bypass (P10).
- Three early commands (one that read three files, two that applied an edit script) began with
  `cd` to the workspace ROOT itself; no command entered a subfolder.

## Decisions for the controller

| ID | Question | Recommendation |
|---|---|---|
| DN-1 | W49-F1 | To the contract close-out row W83: a strict heartbeat member in the Core server's union, or one sentence in AC-B-46 |
| DN-2 | W49-F2 | To the owner of the engine (fix round B2) or of the demo-control module; Low, not blocking |
| DN-3 | W49-F4 | Move `testRoutine` / `useRoutine` and a stage with a real listener into `test/support/`; this file then changes two import lines |
| DN-4 | The gate's re-run | Add `--reporter=verbose` to see the positions, digests and counts |
| DN-5 | The realtime fix round that landed during this row (caps per principal, a handshake guard) | Nothing for this file: green before, during and after. Red against it at 18:59 and 19:07: the pairing-lifecycle file (W48) and the channel row's own cap tests |

## Not covered (full list in the document, section 14)

A browser; a phone or a tablet; a listening server on a fixed port with the system timers; more
than two operator clients acting; a process restart with clients connected; `loadScenario` and a
failed reset with real sockets; `device.revoked`, `TOKEN_REUSE`, expiry; the send policy and the
caps; the ring limits (more than 1,000 audit rows); clock drift.

## Rollback (R-NEW; not executed)

`rm apps/core-server/test/acceptance/shared-state.test.ts apps/core-server/test/acceptance/shared-state.support.ts`
(both new, untracked; nothing else refers to them).
