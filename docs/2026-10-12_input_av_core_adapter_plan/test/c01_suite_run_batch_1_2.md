# c01 - suite run, batch 1-2 (uncommitted tree on task4/input-av-core-port)

Tier 3. Run from the repository root, no file changed. Base for comparison: cf2f8008 (green on these checks).
Logs: scratchpad `tc.log`, `lint.log`, `test.log`, `cs_rerun.log`, `mock_rerun.log`, `db.log`.

## Commands

| # | Command | Sandbox | 1-min load before | Time | Exit | Summary |
|---|---|---|---|---|---|---|
| 1 | `npm run typecheck` | on | 4.59 | 36.9 s | 0 | all 7 workspace `tsc` runs clean |
| 2 | `npm run lint` | on | 5.09 | 18.2 s | 0 | oxlint x6 + eslint (mobile), no findings |
| 3 | `npm test` | on | 5.16 | 10 min 34 s | 1 | see below |
| 3a | re-run of the 12 failed core-server files | off | 8.44 | 20 s | 1 | 11 files pass, 1 fails (genuine) |
| 3b | re-run of mock-core (`npx vitest run`) | off | - | 4 s | 0 | 4 files, 19 tests passed |
| 4 | `npm run test:db -- --maxWorkers=2` under `/usr/bin/lockf -k -t 1800 .locks/db-migrate.lock` | off | 6.81 | 3 min 50 s | 0 | 178 files passed, 3 skipped; 2429 tests passed, 7 skipped |

`npm run pg:status`: "OK, running" (PostgreSQL was already running; not started or touched).

## `npm test` per workspace (first run, sandbox on)

| Workspace | Result |
|---|---|
| capture-protocol | 1 file, 31 passed |
| shared | 102 files, 2687 passed |
| core-server (unit) | 12 failed, 313 passed (325 files); 121 tests failed, 6797 passed, 1 skipped |
| core-web | 172 files, 2367 passed |
| mobile | 281 suites, 3166 tests passed |
| mock-core | 3 failed, 1 passed; 4 failed, 5 passed, 10 skipped - all `listen EPERM` (sandbox) |
| transcriber | 18 files, 563 passed, 4 skipped |

## Failures of the first run, classified

Sandbox loopback bind (`listen/bind EPERM 127.0.0.1`), 120 of the 121 core-server failures plus the 4 mock-core ones. Re-run with the sandbox off and all pass (3a: 252 of 253 passed; 3b: 19 of 19):
- core-server: `capture/adapters/camera/__tests__/{discovery-recording,loopback-guard,onvif-session,ws-discovery}.test.ts`, `capture/adapters/local/__tests__/mic-helper.generated.test.ts`, `modules/media-stream/__tests__/routes.test.ts`, `modules/stt-config/__tests__/routes.test.ts`, `transcription/__tests__/{encrypted-credential,probe}.test.ts`, `test/support/{fake-onvif-stub,lane-camera-stub}.test.ts`
- mock-core: `standalone-launcher.test.ts`, `ws-origin.test.ts`, `heartbeat.test.ts`

## Genuine failure (1)

- Workspace: `@dems/core-server`, project unit
- File: `apps/core-server/test/static/search-path.test.ts:94`
- Test: `finding F53: nothing but the places that pin the path names a temporary object or the path > the list of places is exact`
- Assertion: `expect(filesOf(places(production))).toEqual(Object.keys(ALLOWED).sort())`. Received list has one extra file, `src/db/fixtures/operations.ts`.
- Points at: `apps/core-server/src/db/fixtures/operations.ts:669, 696, 706` (uncommitted change) - the message strings "Temporary host address added / could not be removed / removed" contain the word "Temporary", which the scan's `TEMP_WORD` pattern (`\bTEMP(ORARY)?\b`, case-insensitive, test file line 25) forbids in production sources outside the `ALLOWED` list. Not a sandbox failure; reproduces with the sandbox off. Fix is the owner row's: reword the three messages (e.g. "Host address added for the session") or, if the test's exact list is meant to change, add the file to `ALLOWED` in the test (owner of `operations.ts` to decide). Not fixed here.

## Not run

Capture worker e2e, scenario suites, emulators, Gradle (as instructed).

## Result

Against base cf2f8008 (green): one regression, the search-path static test, caused by the new message strings in `src/db/fixtures/operations.ts`. All else green.
