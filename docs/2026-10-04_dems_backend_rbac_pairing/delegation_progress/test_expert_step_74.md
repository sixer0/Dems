---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: test-expert (tier R)
blueprint_row: 74 (plan W52, acceptance test "contract conformance")
date: 2026-10-04
status: complete
evidence_tier: 2
---

# test-expert progress: step 74 (W52, contract conformance)

Status: **complete** (18:40). Full record: `test/03_contract_conformance.md`; runner output and the
other evidence: `test/assets/03_*` (nine files). All times WIB. No credential, token, credential
hash, password or pairing code is in this file or in any asset (the assets were searched for the
three token forms and the cookie name: none).

## What exists now

- `apps/core-server/test/acceptance/contract.test.ts`: the one test file of the row, 1,658 lines,
  34 tests in 9 blocks, in the `db` project. SHA-256 `ef723db6…4f3b747c`, last written 18:27:36.
- `apps/core-server/test/acceptance/contract.support.ts`: its support, 491 lines (the route
  comparison, the ledger every answer passes through, the code table derived from the registry,
  the walker for free-text members, the digest of every table). SHA-256 `61b350d1…6c40a1de`.
- No production file, no contract file, no configuration and no other row's test was written.

## Verification

| Check | Result |
|---|---|
| Row command, `DEMS_TEST_STEP=74 npm run test:db -w @dems/core-server -- test/acceptance/contract.test.ts` | 18:32:30: **1 file, 34 tests, exit 0**, 6.52 s; 0 databases remain with the run prefix |
| Undocumented routes; unregistered operations | Both `[]`, in four comparisons each (router and guard against the registry; router against the committed `openapi.json`); `GET /ws` is the one named exception; router 76 routes, guard 76 rules, registry 75 |
| `gen-openapi --check` (read-only, 18:25:09) | exit 0: "openapi.json is up to date (all (committed): 75 operations, 2 security schemes, version 0.2.0 …)"; the test also compares the file byte for byte |
| Every response validates | 1,297 answers received, 1,290 judged by `validateCoreApiResponse` (the other 7 show known gaps W36-1 and W40-1), 0 problems; 1,258 bodies also compared member by member with their schema |
| Coverage | 337 of 337 documented operation-by-status cells produced over 75 operations; the "not producible" table is empty; asset `03_contract_coverage.md` |
| 401, 403, 404, 405, 409, 413, 422, 423, 429 | 125, 118, 30, 444, 28, 25, 104, 4, 3 answers, each an `ApiError` with the code the specification names; no 500 |
| No GET handler writes | 45 reads of the 27 GET operations; all 30 tables (place, writer and content of every row) equal before and after each; the one write of stage 4 on a GET (`paired_devices.last_seen_at`, once a minute) measured and named |
| The five headers of OR-9 | On 1,297 of 1,297 answers, with their exact values; `application/json; charset=utf-8` on 1,265 bodies; never `Strict-Transport-Security` or `x-dems-simulated` |
| API-7; decision D69 | Both revision headers on 103 of 103 2xx POST answers (each equal to the engine's revision); `Set-Cookie` only on 9 web sign-ins and 1 web sign-out, absent on 1,287 answers |
| API-13 | 25 free-text members found mechanically in 15 operations; 49 refused requests (U+0000 and an unpaired surrogate), each 422 `INVALID_INPUT`, no table moved; `addSessionNote`, `revokeDevice`, `redeemPairingCode` first, each on a request that would otherwise have written |
| AC-B-70 | 823 lists of audio in the answers (seed and bulk), each exactly AUDIO-01, AUDIO-02 |
| Typecheck, lint | 18:27:58 exit 0; 18:28:04 exit 0, no warning. Earlier, P11 noise of the matrix row: typecheck 18:24:35 exit 2 with two errors in `test/acceptance/rbac-matrix.test.ts`; lint 18:17:34 one warning in `rbac-matrix.support.ts` |
| Whole `db` project, `--maxWorkers=2` | 18:25:24: exit 0, 112 files, 1,644 passed, 1 skipped. **18:28:24, with the final file: exit 0, 112 files, 1,644 passed, 1 skipped.** No failure to name |
| Whole `unit` project | 18:31:04: exit 0, 142 files, 3,678 passed |
| Can the test fail | By changed INPUT only, kept as three tests of the file (an extra route on a scratch app, an operation more and one less in the expectation, an answer with a member more, a made-up answer, a rewritten row, an empty ledger); two real reds while the file was written are kept as assets |
| Duration | 6.3 to 9.0 s on a quiet host over 16 green runs, 11 to 17 s under load, once 66 s (observation O-2); caps 120 s per test, 180 s per hook |
| End state, 18:32:37 | 0 databases with the prefix `dems_test_step_74_`; `.locks/postgres.pid` 19121, started 07:14:26; no port bound; no process left |

## Test ledger

`db` project: +1 file, +34 tests (`test/acceptance/contract.test.ts`). `unit` project: nothing.

## Findings (severity is the row's proposal)

| ID | Severity | Departing side | Finding |
|---|---|---|---|
| W52-F1 | Low | Contract (text) | `CONTRACT-GAP-W52-1`: `identity.ts:429` and `:455`, the 403 of `signInWithBiometric` and `reportBiometricFailure`, does not name `DEVICE_NOT_PAIRED`; the server answers it to a web session, as spec §7.2 says. The gap W32-3 on two more operations |
| W52-F2 | Low | Contract (validator) | `validateCoreApiResponse` accepts a body with an unknown top-level member for 26 response schemas (the ten existing operations' and contract A's; 38 success cells and `ApiError`): "answers strict" (D64 DN-9) holds for contract C only. The server sends no such member (1,258 bodies checked by this test's own comparison) |

Observations, no side departs (document section 11): O-1 a cursor on a seed row survives a
rebuild; O-2 one run of 66 s, place not known; O-3 `GET /ws` without an upgrade answers 404;
O-4 a body that is not JSON answers 400 `INVALID_JSON` whatever its content type; O-5
`acknowledgeSessionSummary` for a session that is not open answers 204; O-6 the lock thresholds
5, 3, 5. Known gaps and differences with the observed behaviour: document section 10 (25 rows);
finding F66 is still open (−52 dBFS in every state).

## Deviations

DV-1 no write to `masterplan/02_plan.md`, `99_implementation_report.md`, `test/01_test_report.md`
(shared files, parallel run). DV-2 401 and 403 produced for every operation, not a sample. DV-3
the reset block lets the server's routine create `<clone>_next` and `<clone>_prev` under this
run's prefix. DV-4 the server's own test controls and three fixture statements as `dems_owner` on
this file's clones. DV-5 a probe file `test/acceptance/w52probe.test.ts` was in the tree from
18:18 to 18:19 and was moved out of it (not removed with `rm`).

## Decisions for the controller

DN-1 `CONTRACT-GAP-W52-1` to W83. DN-2 W83 decides whether the 26 response schemas become strict
(`HealthResponse` is shared with mock-core and the 0.1.0 launcher). DN-3 finding F66 stays open.
DN-4 the gate quotes this file with `--silent=false`: Vitest 5 hides the console lines of passing
tests. DN-5 nothing for O-2 unless it recurs.

## Files written

- `apps/core-server/test/acceptance/contract.test.ts`
- `apps/core-server/test/acceptance/contract.support.ts`
- `docs/2026-10-04_dems_backend_rbac_pairing/test/03_contract_conformance.md`
- `docs/2026-10-04_dems_backend_rbac_pairing/test/assets/03_contract_coverage.md`,
  `03_row_command.log`, `03_row_command_console.log`, `03_row_command_tests.log`,
  `03_whole_db_1825.log`, `03_whole_db_1828.log`, `03_red_run_1815.log`, `03_red_run_1819.log`,
  `03_end_state.mts.txt`
- `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/test_expert_step_74.md`
