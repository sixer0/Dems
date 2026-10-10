# 138 Pin moves, fix wave I

Scope: three stale test pins from `test/09_precommit_wave_i.md` (4 reds, 3 files). The product change is the ruled one in each case (decisions D216 (2), D216 (3), D217 (2)); only test files changed, no product code, no git write.

## 1. `apps/core-server/test/acceptance/pairing-lifecycle.test.ts` (2 tests)

Why: since fix G75b-04 (D216 (2)) the rows SESSION_CREATED, PRECHECK_PASSED, RECORDING_STARTED sent from the paired tablet carry that device's id (`DEV-0001`) instead of `null`.

Sender check, from the file's own scenario:

| Place | Sender | Action |
|-------|--------|--------|
| `:729-730` SESSION_CREATED, PRECHECK_BLOCKED (control) | web (portal) | unchanged, `null` |
| `:990-992` (test "the investigator starts a recording from the tablet") | `mobilePost(first, ...)`, the tablet | moved |
| `:1317-1318` journey, SESSION_CREATED, PRECHECK_BLOCKED | web (control) | unchanged, `null` |
| `:1342-1344` journey, SESSION_CREATED, PRECHECK_PASSED, RECORDING_STARTED | the tablet, between `BIOMETRIC_ENROLLMENT_CHANGED ... one` and `DEVICE_REVOKED` | moved to `one` |

Lines changed (9 insertions, 8 deletions in the file together with the comment):
- test at `:989`: added `const tablet = first.deviceId ?? '';` and a one-line comment; the three tuples now end in `tablet` instead of `null`.
- journey at `:1342-1344`: the three tuples now end in `one` (already defined as `first.deviceId` in the same test) instead of `null`.

Result: `Test Files  2 passed (2)`, `Tests  51 passed (51)` (run together with file 2).

## 2. `apps/core-server/src/engine/__tests__/commands.db.test.ts` (1 test)

Why: the `engine started` log line gained the key `tabletLinkOfflineUnwritten` (`apps/core-server/src/engine/host.ts:1044`). Checked: the value is `effects.tabletLinkOfflineUnwritten === true`, a boolean; the source member is `readonly tabletLinkOfflineUnwritten?: boolean` (`rehydrate.ts:245`), set to the literal `true` at `rehydrate.ts:384`. Not a secret, not free text, not a count of rows or an argument; the SR-48 guard is not weakened in meaning.

Line changed: `:735`, the allow-list `engineKeys` gains `'tabletLinkOfflineUnwritten'` after `'behindMs'`. The test's other two checks (nothing of a slice, the deny-list for other lines) are untouched.

Result: same run as file 1, `Tests  51 passed (51)`.

## 3. `apps/mobile/src/runtime/pending-control.test.tsx` (1 test)

Why: `session-new/session-new-screen.tsx` no longer uses `busyState` / `PendingSpinner` (G75b-05; the screen keeps its loader).

Line changed: `:119`, removed `'session-new/session-new-screen.tsx',` from the expected list in "every caller takes the helpers from the barrel". The list still names the five other callers, and the loop below it still requires each listed file to import from `@/runtime`; the rule is not weakened for them.

Result: `PASS src/runtime/pending-control.test.tsx`, `Tests: 10 passed, 10 total`, `Test Suites: 1 passed, 1 total`.

## Commands run (once each)

| Check | Command | Result |
|-------|---------|--------|
| db (2 files) | `/usr/bin/lockf -k -t 3600 .locks/db-migrate.lock npx vitest run --root apps/core-server --project db --maxWorkers=1 test/acceptance/pairing-lifecycle.test.ts src/engine/__tests__/commands.db.test.ts` (sandbox off for PostgreSQL) | 2 files passed, 51 tests passed; teardown `0 remain` |
| mobile (1 file) | `npx -w apps/mobile jest src/runtime/pending-control.test.tsx` | 1 suite, 10 tests passed |
| typecheck core-server | `npm run typecheck -w @dems/core-server` | no error output |
| typecheck mobile | `npm run typecheck -w @dems/mobile` | no error output |
| lint core-server | `npm run lint -w @dems/core-server` | silent, no error |
| lint mobile | `npm run lint -w @dems/mobile` | 0 errors, 1 warning (the known `log.test.ts:160:19 array-type`) |

Not run: the full suites (not asked). No lane started, `.data/pg*.env` not read, no formatter write.

---
*Generated: 2026-10-10*
