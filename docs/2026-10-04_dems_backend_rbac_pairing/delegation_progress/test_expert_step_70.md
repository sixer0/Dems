---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: test-expert (tier R)
blueprint_row: 70 (plan W48, acceptance test "pairing lifecycle")
date: 2026-10-04
status: complete
evidence_tier: 2
---

# test-expert progress: step 70 (W48, pairing lifecycle)

Status: **complete** (18:47). Full record: `test/04_pairing_lifecycle.md`; runner output and the
other evidence: `test/assets/04_*` (19 files). All times WIB. No pairing code, device credential,
session token, cookie value, biometric token, hash or password is in this file.

## What exists now

- `apps/core-server/test/acceptance/pairing-lifecycle.test.ts`: the one test file of the row,
  1,563 lines, 31 tests in five blocks, in the `db` project. SHA-256 `b59b9283…0d554005`, last
  written 18:37:35. No support file beside it.
- The server in it is the real factory on the file's own clone of the seed, booted, LISTENING on
  `127.0.0.1` at port 0. REST is `app.inject` through the real stages and handlers; every socket
  is a real WebSocket to that listener. The test's own are the manual server clock and the two
  manual timers. The Core link is never set by the test: it comes from the paired tablet's socket.
- One journey on one server, 695 s of the server clock: an unpaired caller; a control (no device
  connected: the pre-check blocks on the Core link alone); code A issued and left to expire; code
  B guessed at (lock after three, closed at five); code C redeemed; the registry (online with the
  socket, offline without); a password sign-in and an enrolment on the tablet; a recording
  started from the tablet; the revoke while it records; six refused calls; the recording goes on
  and is stopped by the supervisor from the web and sealed; code D and a new device; then the
  biometric reuse on the re-paired tablet with a PASSWORD and a BIOMETRIC session, each on its
  own socket; then the scan of the dump, the rows, the frames, the refusals and the log.

## Verification

| Check | Result |
|---|---|
| Row command, `DEMS_TEST_STEP=70 npm run test:db -w @dems/core-server -- test/acceptance/pairing-lifecycle.test.ts` | 18:37:56: **1 file, 31 tests, exit 0** at 18:38:01, 3.72 s; 0 databases remain with the run prefix |
| Each step asserts its audit type | Every step asserts `[type, actor, device]` of the rows it wrote; one test asserts the whole trail as ONE sequence of 47 rows (seq 84 to 130), that no row was written outside a step, and that the chain verifies |
| A revoked device: REST 403, socket 4403 | Six calls (session token and device credential): 403 `DEVICE_REVOKED`, one `ACCESS_DENIED` row each. Socket: `device.revoked`, close 4403, 5.1 ms after the revoke was sent (3.9 to 8.8 ms over seven runs; bound 1,000 ms, the test's real clock) |
| Revoked while recording | RECORDING before and after; elapsed 2,000 to 4,000 ms, bytes grow, the Core link OFFLINE; the supervisor's stop: 202, `RECORDING_STOPPED` names `OPR-002`, the session SEALED |
| A dump holds no code and no credential | 30 tables, 421 rows: 0 of 4 codes, 5 guesses, 2 device credentials, 5 session tokens, 3 biometric tokens, the demo password; each code and token there once as its SHA-256. Also 0 in 47 audit rows, 45 events, 254 realtime frames, 29 refusals, 973 log lines at level `trace` |
| A used biometric token closes that session's socket with 4401 within 1 s | 401; `session.ended` `TOKEN_REUSE`; close 4401, 3.4 ms after the request (2.9 to 6.0 ms over seven runs); the PASSWORD session and its socket stay open |
| An unpaired caller on `getSignInStatus` | 200; its sign-in 403 `DEVICE_NOT_PAIRED` (no attempt counted, no password verified); its socket: `hello` and `heartbeat` only, 40 frames over the whole journey |
| Typecheck, lint | 18:37:35 with the file as it is now: exit 0 (0 errors), exit 0 (no warning), whole workspace. 18:45:06: lint exit 0; typecheck exit 2 with two errors, both in `test/acceptance/shared-state.support.ts` (written 18:40 by another row, in flight), 0 in this file |
| Whole `db` project, `--maxWorkers=2` | 18:34:23 to 18:37:26: exit 0, 112 files, 1,646 passed, 1 skipped. **18:39:08 to 18:42:26 (the file as it is now): exit 0, 112 files, 1,646 passed, 1 skipped.** No failure to attribute; the skipped test is the demo row's pending one |
| Can the test fail | 9 of 9 changes of the test's INPUT or of the CLONE detected (18:38:05), through a load-time transform in a scratch configuration; no file of the tree changed. M1 the revoke skipped: the 403 and the 4403 assertions red. M2 a fresh biometric token: the reuse assertions red. M3 a code planted into a column as the owner: the scan finds it, by label |
| End state, 18:45:23 | 0 databases with the prefix `dems_test_step_70_`; `.locks/postgres.pid` 19121, the project's `postgres`, started 07:14:26; no listener of a `node` process; no process of this row |

## Test ledger

`db` project: +1 file, +31 tests (`test/acceptance/pairing-lifecycle.test.ts`). `unit` project:
nothing (the file is not in it).

## Findings (severity is the row's proposal)

| ID | Severity | Finding |
|---|---|---|
| W48-F1 | Low (availability of pairing; as specified by RB-6 and ID-P13) | Refused calls of a revoked device use up the budget that the redeem of a NEW device needs: after 20 `ACCESS_DENIED` rows of a retired credential within 60 s (bucket `class:local`), a new device's redeem of the RIGHT code answers 429 `RATE_LIMITED` (`retry-after: 60`), `getSignInStatus` of an unpaired caller too; the code is not consumed and pairs 60 s later; operators and paired devices are not affected. Reproduction: `test/assets/04_repro_F1_revoked_device_blocks_pairing.ts.txt` and its log |
| W48-F2 | Info | `TABLET_LINK_CHANGED` names the Core's tablet slot `TABLET`, not the registry ID of the device that connected or went away (`packages/shared/src/sim/actions.ts:222`): the trail cannot say which paired tablet it was |
| W48-F3 | Info | Rows of session commands sent from a tablet (`SESSION_CREATED`, `PRECHECK_PASSED`, `RECORDING_STARTED`) carry no device ID; an `ACCESS_DENIED` row of a revoked device names the device and no operator. Both as specified |
| W48-F4 | Info (the lifecycle side of F69) | After a revoke with no other paired device connected the Core link is OFFLINE at once: the running recording goes on and can be stopped and sealed, but no NEW recording can start, from the web either, until a paired device connects |
| W48-F5 | Info (test support, for W49) | The realtime row's `TestSocket.closed` (and `opened`, `refused`) carries a 5 s guard that starts when the socket is created (`src/realtime/__tests__/support.ts:235-241, 301-303`): a socket that lives longer cannot be awaited through it. This file attaches its own close listener |

## Deviations

- REST is `app.inject`; only the socket goes over TCP (the pattern of the landed acceptance test).
- The socket client is `ws` through the realtime row's `openSocket`, not Node's global `WebSocket`.
- The biometric scenario runs on the re-paired tablet on the same server as the lifecycle, so one
  dump and one log capture cover every secret.
- Beyond the row's list: AC-B-36 inside the journey, the control of the Core link, the biometric
  token of a revoked device (SR-34), "each secret handed out in exactly one answer".
- The halves of a six-digit code are not searched; a bare JSON number of the same digits is
  counted (0) and not judged.
- The file imports the realtime row's test support from `src/realtime/__tests__/support` (it is
  not in `test/support/` yet).
- The file was changed once after the first whole-project run (a hardening of 7 added, 1 changed
  and 3 reordered lines, so that no failing assertion can print a secret), validated on a scratch copy first, then by the row
  command, the nine changes and a second whole-project run.
- `masterplan/02_plan.md`, `implementation/99_implementation_report.md`, `test/01_test_report.md`,
  `status_tasks.md`, `delegation_progress_report.md` and `decisions/decisions.md` were not written
  (parallel run, P8).

## Decisions for the controller

| ID | Decision asked | Proposal |
|---|---|---|
| DN-1 | W48-F1 | Accept as specified; tell the mobile pairing rows (W57, W60) that a redeem answered 429 is not a wrong code (wait `retry-after`), the mobile runtime (W51) that no call follows a 403 `DEVICE_REVOKED` with that credential, and W94 to send no burst of refused calls before the re-pairing. A budget of its own for the redeem would be a change of the specification; not proposed |
| DN-2 | W48-F2, W48-F3 | Accept (the simulator's hosted actions; parity is ruled). If the attribution is wanted later: an additive detail written by the server |
| DN-3 | The realtime row's test support | Move it to `test/support/realtime.ts` in fix round B2, with `closed` guarded from the moment it is awaited; or tell W49 to attach its own close listener |
| DN-4 | W48-F4 | One sentence into the README row W86 and the end-to-end rows, beside F69 |
| DN-5 | Test ledger | `db`: +1 file, +31 tests |

## Files created or updated

- `apps/core-server/test/acceptance/pairing-lifecycle.test.ts` (new)
- `docs/2026-10-04_dems_backend_rbac_pairing/test/04_pairing_lifecycle.md` (new)
- `docs/2026-10-04_dems_backend_rbac_pairing/test/assets/04_*` (new, 19 files)
- `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/test_expert_step_70.md` (this file)

No other path was written. Scratch files (the harness, the logs) are outside the repository.

---
*Generated: 2026-10-04 18:47 WIB*
