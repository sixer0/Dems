---
task_id: 2026-10-12_input_av_core_adapter_plan
row: integration pass I-2 (track D)
date: 2026-10-13
agent: coder-execution
tier: T3
status: needs-review (every check green; five driver decisions to confirm, DD-1 first)
branch: task4/input-av-core-port (nothing committed, nothing staged)
---

# Integration pass I-2 - the remainders of rows 17, 24, 26, 63, 104

Paths are relative to the repository root. `CS` = `apps/core-server`. Every edit was made with the Edit tool after reading the lines; no scripted replace. Claims line: `delegation_progress/file_claims.md` (last line).

## 1. What was done, by item of the fixed list

| # | Item | Change | Where |
|--:|---|---|---|
| 1a | `rbac-matrix.test.ts`: 97 -> 99 | registry and composed-document pins 97 -> 99 (`:974-984`); one-permission rules 57 -> 59 (`:1011`, `:1022`); C3 delta rows 22 -> 24 (`:1152`); the web-console-only list gains `[98, searchCaptureAudioCards]`, `[99, registerCaptureAudioInput]` (`:1071-1072`); `DEFERRED_ROUTE` names both with row 70 (`:174-177`); routed stays 97 (`:1213`) | `CS/test/acceptance/rbac-matrix.test.ts` |
| 1b | Identity rows of 98-99 in the SAME table as 93-97 | two rows appended to the identity table of C3 section 2.6, in the columns of its five rows: POST, path, Device, simulated, `PERMISSION CAPTURE_CONFIG` + `WEB_CONSOLE_SESSION`, audit `CAPTURE_DISCOVERY_SEARCHED` / `CAPTURE_AUDIO_INPUT_CHANGED`, denial `ACCESS_DENIED` - the values of `packages/shared/src/api/capture-audio-cards.ts:212,223-284`. The reader's expected row count of that table 5 -> 7. No new table, no new permission, no new entry of `API_CONTRACT_SECTIONS` | `docs/2026-10-07_dems_real_capture_sealing/masterplan/03_api_contract.md:597-598`; `CS/test/acceptance/rbac-matrix.support.ts:294-296` |
| 1c | `contract.test.ts`: 97 -> 99 | counts 97 -> 99, POST 61 -> 63, guarded 93 -> 95, document 97 -> 99; `LANDED_UNROUTED` names the two routes (sorted, as `compareRoutes` reports); the walks that CALL every operation call the routed ones (`ROUTED_OPERATIONS`: 401, 403, 400/413, 405, success ledger); `NOT_PRODUCED` is derived from the same list; router length stays 100 | `CS/test/acceptance/contract.test.ts:169-183, 461-476, 499-507, 534, 537, 552-553, 1279-1283, 1304, 1334, 1348, 1401, 1950-1954, 2076-2077` |
| 2 | The two 43-table lists -> 45 | `ALL_TABLES` gains `capture_device_streams`, `capture_audio_inputs` (appended; the list sorts itself); `BULK_MINIMUMS` gains both with minimum 0 (appended, the list's own order). Pins moved by +2, section 2 | `CS/src/db/store/store.ts:406, 459-462, 467`; `CS/src/db/fixtures/minimums.ts:34, 102-105` |
| 3 | Stale comment | wording only: the shared scope carries `AUDIO_CARDS` since I-1 | `CS/src/core/audit-details.ts:185-189` |
| 4 | Export row 24 asked for | the line of the request, as written | `CS/src/capture/adapters/local/index.ts:28` |
| 5 | npm script for the helper test | `"test:host-helper": "python3 -I -B scripts/host/netalias/test_dems_core_netalias.py"` beside `test:pg-scripts`. It does not enter `npm test`: the root `test` script is `npm run test --workspaces --if-present` (`package.json:38`), which runs each workspace's `test`, never a root script | `package.json:54` |
| 6 | Stub mode for row 26 | new option `profileSet: 'TWO_SOURCES'` (absent = unchanged): `GetProfiles` lists `FAKE_ONVIF_TWO_SOURCE_PROFILES` (5 profiles, 2 video sources, areas differ per source, the largest never first, one token `Main.Stream:0-a`, one source token `Video.Source:0-b`); `GetStreamUri` answers per profile token and faults `ter:NoProfile` for any other. Exports: `FakeOnvifProfile`, `FakeOnvifProfileSet`, `FAKE_ONVIF_ODD_PROFILE_TOKEN`, `FAKE_ONVIF_TWO_SOURCE_PROFILES`, `fakeOnvifProfileStreamUri`. One test in the stub's test file, one complementing case in `onvif-session.test.ts` | `CS/test/support/fake-onvif-stub.ts` (types after `FakeOnvifRtspMode`, option, `profilesXml`, `onHttp`); `CS/test/support/fake-onvif-stub.test.ts` (last `describe`); `CS/src/capture/adapters/camera/__tests__/onvif-session.test.ts` (last case of the row-26 block, one import line) |

## 2. Count pins the two lists moved (item 2)

| Pin | From -> to | File:line |
|---|---|---|
| Tables counted by the seed | 43 -> 45; empty 19 -> 21; with rows 24 (unchanged) | `CS/src/db/seed/__tests__/seed.db.test.ts:54,58,60` |
| Seed report line | "24 of 43" -> "24 of 45"; "43 table(s)" -> "45" | `CS/src/db/seed/__tests__/cli.db.test.ts:43`; `cli.test.ts:85-86` |
| Expected seed counts (the map the seed tests compare with) | two keys with 0 | `CS/test/support/seed.ts:91-94` |
| Bulk minimums | 43 -> 45 (four lines), two `minimumOf(...) = 0` lines | `CS/src/db/fixtures/__tests__/build.test.ts:66-68,73,93-95,103` |
| Bulk fixture | 43 -> 45 (`:58,61,575,589,597,599,709`); report lines 46 -> 48 (`:588`) | `CS/src/db/fixtures/__tests__/bulk-fixture.db.test.ts` |
| Dump order of the digest helper (throws for a table it does not know) | two keys | `CS/src/db/fixtures/__tests__/support.ts:92-94` |
| Recording walk | 43 -> 45 | `CS/src/engine/__tests__/recording.db.test.ts:141-142` |
| Reset report line | "24 of 43" -> "24 of 45" | `CS/src/db/reset/__tests__/cli.db.test.ts:123` |
| Tables a reset rebuilds to the seed's shape | 24 -> 26 (found by the first run, not on row 17's list) | `CS/src/db/reset/__tests__/reset.db.test.ts:242-245`; `CS/src/modules/demo/__tests__/reset.db.test.ts:368` |

Not touched, as instructed: the CHECK on `capture_devices.profiles`; `CS/src/db/reset/kept-tables.ts` and its tests (kept set still 13); every selector reader; no schema, migration or fence file; nothing under `apps/input-av/`.

## 3. Checks (one run each; a second only after a failure)

Database and loopback commands ran with the command sandbox off; database commands under `/usr/bin/lockf -k .locks/db-migrate.lock`, on throw-away databases of the test helper. No `db:migrate` was run against any database.

| Check | Command (from `CS` unless said) | Result |
|---|---|---|
| Typecheck, five workspaces | `npm run -s typecheck` in `packages/shared`, `apps/core-server`, `apps/core-web`, `apps/mobile`, `apps/mock-core` | exit 0, five of five |
| The two acceptance files | `npx vitest run --project db --maxWorkers=2 test/acceptance/contract.test.ts test/acceptance/rbac-matrix.test.ts` | `Test Files 2 passed (2)`, `Tests 77 passed (77)` |
| Database tests that read the two lists (14 files) | `npx vitest run --project db --maxWorkers=2` on bulk-fixture, reset (cli, reset-failures, reset), seed (cli, seed-clock, seed), store write-through, engine (commands, recording), demo reset, the three `secrets.db.test.ts` | run 1: `2 failed, 12 passed (14)`, `7 failed, 216 passed (223)` - the "rebuilt 24" pin in two reset files, the other five failures followed from it in the same files; run 2 of the two files after the move: `Test Files 2 passed (2)`, `Tests 13 passed (13)` |
| Unit tests of the touched files (first run) | `npx vitest run --project unit --maxWorkers=2` on the stub test, `onvif-session.test.ts`, the launcher test, `camera-helper.test.ts`, the two static tests, seed `cli.test.ts`, fixtures `build.test.ts`, `src/core/__tests__`, `to-rows.test.ts` | `Test Files 17 passed (17)`, `Tests 601 passed (601)` |
| Unit tests around them (final state) | the same on `src/db/{fixtures,seed,reset,store,mapping}`, `test/support`, `test/static`, `src/capture/adapters/{camera,local}`, `src/capture/fence`, `src/plugins/permission-guard` | `Test Files 76 passed (76)`, `Tests 1457 passed (1457)` |
| Shared pin tests | in `packages/shared`: `npx vitest run --maxWorkers=2` on api-registry, openapi, api-openapi-scope, api-capture-discovery, api-text-rule, api-state-examples, api-examples, api-domain-operations, api-stt-config, sim-api, sim-capture-discovery, i18n-vocabulary-sync, api-verify-report | `Test Files 13 passed (13)`, `Tests 314 passed (314)` |
| Helper test through the new script | repository root: `npm run -s test:host-helper` | `Ran 58 tests in 18.407s`, `OK` |
| Static rules over the root scripts | repository root: `node --test scripts/pg/static.test.mjs` | `tests 6`, `pass 6`, `fail 0` |
| Lint of the touched TypeScript files | `npx oxlint` on 11 files | exit 0 |

NOT run: `npm test`, `npm run test:db`, any heavy-host job.

## 4. Remaining reds

None in the runs above. Not re-run and therefore not known: the rest of the database project (the controller's suite run c02).

## 5. Driver decisions (for the controller to confirm)

| # | Decision | Why | Undo |
|---|---|---|---|
| DD-1 | The two identity rows were written into a document of task 3, `docs/2026-10-07_dems_real_capture_sealing/masterplan/03_api_contract.md` section 2.6, and `rbac-matrix.support.ts` (the reader's row count 5 -> 7) was edited although the list names the two test files only | "The SAME table the operations 93-97 use" is that table: the test composes it from the document (`rbac-matrix.support.ts:289-296, 350-377`); there is no table in a test file. Each row says in its last cell that task 4 added it. The document's prose was left: section 10.1 still states the total 97, the access notes and the section 4 row still name "89, 95, 96" (none of them is read for a number by the test) | delete the two rows, 7 -> 5 |
| DD-2 | `contract.test.ts` got the named deferral, not only count moves: `UNROUTED_OPERATIONS` / `ROUTED_OPERATIONS` derived from `LANDED_UNROUTED`, five calling walks on the routed set, `NOT_PRODUCED` derived from the same list | the routes of 98-99 land with row 70; an unrouted path answers the router's 404, and 404 is a documented status of operation 99, so a call would be recorded as an answer of the operation. The split is guarded: `:476` pins the two ids, `:500-501`, `:552` and `:2103-2108` the route list | row 70 empties `LANDED_UNROUTED`; every derived value follows without another edit |
| DD-3 | Pins beyond row 17's list were moved because the two lists move them: `test/support/seed.ts`, `fixtures/__tests__/support.ts`, `reset/__tests__/cli.db.test.ts`, and "rebuilt 24 -> 26" in two reset tests | each is a count or a key list over `ALL_TABLES`. 26 states what a reset does today: it empties T-44 and T-45 (not carried). The reset row that keeps them returns the pin to 24 with its `NOT_COMPARED_WITH_SEED` entries | per line |
| DD-4 | Stub: a construction option (`profileSet`), not a device mode; the session test complements row 26's local fixture, which stays | a mode switch would change `setDeviceMode`'s closed list for every user; replacing the local fixture is no pure simplification - its controls (reversed list, one source, no source, plain-number tokens, hostile sizes) need a scripted answer a fixed set cannot give | remove the option |
| DD-5 | Root script name `test:host-helper`, as row 104 proposed | - | one line |

## 6. Left as found (outside the list)

- `README.md:827` names the root test scripts as `package.json:53-58` and "the six"; with the new line they are `:53-59` and the helper script is a seventh that `npm test` does not run. `scripts/test/regression.sh` does not run it either.
- `file_requests.md` line 36 (comments and titles saying 31 / 97 operations in `apps/core-web/src/features/api-reference/`, `matrix.db.test.ts:139`, `api-verify-report.test.ts:130`) and the second half of line 35 (`CAPTURE_AUDIO_INPUT_CHANGES` from the shared values): not in the fixed list.
- Comments that still say "43 tables": `CS/src/db/fixtures/report.ts:17,21`, `build.ts:55`, `world.ts:71`, `load.ts:276`, `minimums.ts:158`; `contract.test.ts:2089-2092` still says "the 6 registry routes".
- Requests of `file_requests.md` closed by this pass: lines 24, 28, 30, 33, 34, 35 (comment half), 42. The file itself was not edited.

## 7. The double, and what stays unproven

The stub's profile set is a fixed answer on 127.0.0.1; it proves the selection and the per-token locator of row 26 against a second independent double. What a real dual-lens camera lists stays with `9A/H-17`. The acceptance files prove the contract identity of operations 98-99 and that neither is routed; their behaviour is row 70's.

---
*Generated: 2026-10-13 00:15*
*Last Updated: 2026-10-13 00:15*
