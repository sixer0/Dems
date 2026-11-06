---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: coder-execution
blueprint_row: 52
plan_row: W30 (Live socket client; no lock)
date: 2026-10-04
status: complete
output_document: implementation/30_live_socket_client.md
---

# Progress: step 52 (W30, Live socket client)

Status: **complete**. Every verification command of the row exits 0. No blocker and no
CONTRACT-GAP. One hypothesis of the specification stays unmeasured (F-2 below); it does not block
the rows that consume this client, because the client is correct for both outcomes.

## Milestones (WIB; from the logs and the file timestamps)

| Time | Milestone |
|---|---|
| 09:49 | P23 pre-image saved before the first edit: `.cache/rollback/W30.pre.patch` (0 bytes: `realtime/index.ts` was equal to `acaff20`) |
| 09:49 | Baseline: shared 977 tests in 46 files, typecheck and lint exit 0 (`implementation/assets/30_baseline.log`) |
| 09:50-10:05 | Inputs read: blueprint row 52 and P1-P25, plan row W30 and §3.4, client specification §2, §3.5, §6.5, AC-C-02/15/16, server specification §9, contract B, the light Live API, the emulator-proof document, the heartbeat client and its test |
| 10:06 | `live-socket-client.ts` written; one export line added to `realtime/index.ts`; shared typecheck and lint exit 0 |
| 10:10 | The behaviour test and the static scan green beside `heartbeat-client.test.ts` |
| 10:13 | First mutation run on an isolated copy: it showed that a bare 4403 was covered by the static scan only; three tests added |
| 10:14 | Typecheck of core-web and mobile exit 0 |
| 10:16 | Scratch run of the client on the fake transport of W31: 2 tests passed |
| 10:17 | First full gate green (shared 1,231 tests in 50 files) |
| 10:22-10:23 | Final mutation run: 43 of 44 detected, 1 equivalent |
| 10:23 | Final gate on the finished tree: shared 1,351 tests in 55 files, all five commands exit 0 (`implementation/assets/30_gate_final.log`) |
| 10:26 | `implementation/30_live_socket_client.md` written |

## Files created or updated

Code, new:
- `packages/shared/src/realtime/live-socket-client.ts`
- `packages/shared/test/realtime-live-socket.test.ts` (117 tests)
- `packages/shared/test/realtime-live-platform-neutral.test.ts` (13 tests)

Code, changed:
- `packages/shared/src/realtime/index.ts` (one line added: `export * from './live-socket-client';`)

Documents:
- `implementation/30_live_socket_client.md`
- `delegation_progress/coder_execution_step_52.md` (this file)
- `implementation/assets/30_baseline.log`, `30_gate_final.log`, `30_realtime_tests_verbose.log`,
  `30_mutations.log`, `30_mutate.py`, `30_scratch_fake_transport.log`

Git-ignored: `.cache/rollback/W30.pre.patch`, `.cache/rollback/W30.post.patch`; `.cache/W30/` (the
isolated copy for the mutation runs and the working logs).

Not written: `heartbeat-client.ts`, `heartbeat-context.tsx`, `use-heartbeat.ts`,
`heartbeat-client.test.ts` (`git diff --stat acaff20` prints nothing for the client and its test);
anything under `packages/shared/src/api`, `src/live`, `src/client`, `src/sim`; any `package.json`;
anything in `apps/`; `status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md`,
`masterplan/02_plan.md`, `implementation/99_implementation_report.md` (parallel run, P8).

## Verification (quoted in full in `implementation/30_live_socket_client.md` §6)

| Command | Result |
|---|---|
| `npm run test -w @dems/shared -- --maxWorkers=2` | exit 0: 55 files, 1,351 tests passed (10:23) |
| `npm run typecheck -w @dems/shared` | exit 0 |
| `npm run lint -w @dems/shared` | exit 0, no warning |
| `npm run typecheck -w @dems/core-web` | exit 0 |
| `npm run typecheck -w @dems/mobile` | exit 0 |
| `git diff --stat acaff20 -- packages/shared/test/heartbeat-client.test.ts` | prints nothing |
| The row's own items | 4401 (9 tests), 4403 (5 tests), reconnect on 1001, 1013 and 4408 with `RECONNECT_BACKOFF_MS` and `RECONNECT_JITTER_MS` (8 tests), at most one `resync` in 2 s on a revision gap (3 tests): all green, each named in §4 and §5 of the document |

Test ledger (P24): `@dems/shared` before 977 tests in 46 files (09:49); after 1,351 in 55 files
(10:23). This row: **+130 tests in 2 new files**, `realtime-live-socket.test.ts` (117) and
`realtime-live-platform-neutral.test.ts` (13). The other +244 tests and +7 files are the rows
running in parallel. No existing test file was edited by this row.

## Processes

None started, none left running. No port was bound, no database used, no emulator touched, no npm
install, no git write.

## Blockers

None.

## Findings (P22; numbers are this row's, for the controller to record as F-n)

| ID | Finding |
|---|---|
| F-1 | The delegation words 4403 as "forbidden (origin or revoked device)" and 4408 as "idle / heartbeat timeout". The specification and the contract say 4403 = device revoked or unpaired and 4408 = slow consumer. The client follows the specification. **An Origin refusal never arrives as a close code**: it is HTTP 403 at the handshake (so are 401 and 429 there), which a client sees as a failed connect; it retries with the backoff and the link stays OFFLINE. The page learns the cause from REST (403 `ORIGIN_NOT_ALLOWED`) |
| F-2 | The hypothesis "a React Native client can read a close code" (server specification §9.2, "row 59 (W30) confirms") is **not confirmed by this row**: it has no device lock, and the emulator proof of W12 (probe steps P9, P10) is still open. The client does not depend on it: an end is also recognised from `session.ended`, `device.revoked` or a `hello` that refused a bearer value, whatever the close code. Unmeasured on a device: that the `headers` option reaches the upgrade, and the code itself |
| F-3 | `@dems/shared/realtime` now re-exports the Live client. Loading the file does nothing, and only `createLiveSocketClient(...).start()` opens a socket. Metro does not drop unused exports by default, so the file is expected inside the mobile bundles, release included, as code nothing calls (not measured: no build in this row). Marker string for a bundle search: `live-socket-client` |
| F-4 | `src/realtime` now takes one type (`LiveLinkState`) from `src/live/mode` with `import type`; nothing of `src/live` is loaded at run time with the client (asserted by the static test) |
| F-5 | A server that sends no `hello` (mock-core) is not a Core server for this client: after 4 s it gives the socket up and retries. Live mode never addresses mock-core |
| F-6 | The fake transport of W31 and this client fit together. A scratch run of this row passed (2 tests, 10:16), and W31's own `packages/shared/test/live-testing-live-socket.test.ts` (4 tests) imports this client and is part of the green final gate. A rollback of this row therefore breaks that test of W31 |
| F-7 | One change of the 44 cannot be detected (M18, both principal checks before a send removed): the contract's `hello` schema already keeps the `meters` and `state` topics from a connection that is not OPERATOR, so the checks are a second barrier that a valid `hello` cannot reach |

## Deviations from the plan

| ID | Deviation | Why |
|---|---|---|
| DR-1 | Two test files, not one per topic: all behaviour tests are in `realtime-live-socket.test.ts` (1,767 lines) | The row may write only `realtime-live-*.test.ts`, so the harness could not be a helper file shared by several test files |
| DR-2 | The handler names differ from the delegation's proposals: `onMeters` (not `onMeter`), `onControl` (not `onSessionEvent`; the specification's name, CL-15), no `onAppend` (an append is an operation inside a delta and keeps its order there), `setMetersWanted` and `requestResync` for the two sends (`subscribe` is already the listener registration of `HeartbeatClient`), no `ack` (the contract has none) | Document §2.3 |
| DR-3 | `masterplan/02_plan.md`, `status_tasks.md` and `implementation/99_implementation_report.md` were not written | The parallel-run contract of this delegation (P8) |
| DR-4 | The mutation runs changed a copy under `.cache/W30/mut`, not the tree | So that a row running at the same time never compiles a changed file |
| DR-5 | No emulator run, although the server specification expects this row to confirm the close-code hypothesis | The row has no device lock and its verification is the shared test run; see F-2 |

## Decisions for the controller to record

| ID | Decision | This row's choice |
|---|---|---|
| DN-1 | Three client constants beyond the six pinned in plan §3.4 | `LIVE_SOCKET_SYNC_TIMEOUT_MS` 4,000, `LIVE_SOCKET_RESYNC_GUARD_MS` 250, `LIVE_SOCKET_SEND_BUDGET` 15; exported from the client file |
| DN-2 | A sync deadline: no `hello`, no snapshot after an OPERATOR `hello`, or no answer to `resync` within 4 s closes the socket and starts the backoff | Chosen, so that a link cannot stay CONNECTING or RESYNCING for ever |
| DN-3 | An end is recognised without its close code (after `session.ended`, `device.revoked`, or a refused bearer `hello`) | Chosen, because F-2 is unmeasured |
| DN-4 | "At most one `resync` in 2 s" is kept on the client clock with 250 ms added, and across connections | Chosen |
| DN-5 | The headers function is synchronous and asked at every connect | Chosen; CL-8 says "a function returning" |
| DN-6 | The `meters` subscription is wanted by default; `setMetersWanted(false)` when hidden | Chosen; the delegation's flow |
| DN-7 | The backoff ends at the first heartbeat of the new connection, as in the heartbeat client; `reconnect()` keeps the attempt counter, `start()` resets it | Chosen, so that the heartbeat view means what it means today |
| DN-8 | F-3: accept the inert file in the mobile bundles, or give the client its own export subpath (a `package.json` change, not this row's path) | Not this row's to decide |
| DN-9 | F-2: who confirms the close code and the upgrade header on a device | The open probe of W12 (P9, P10) covers both |

The other choices where the specification is silent (a stale delta, a delta before its snapshot, a
snapshot nobody asked for, STALE against RESYNCING, the URL guard, the content of a report) are
listed in document §10.
