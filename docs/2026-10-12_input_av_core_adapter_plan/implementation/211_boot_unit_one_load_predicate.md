---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 211
package: M11 | X1-3, X2-3
date: 2026-10-13
agent: coder-execution (wave 10, agent X1)
tier: T3
requirements: GATE SX-17; SX-16 second half; R-X2-11
status: complete
---

# Row 211 - the boot unit: one load for checks 4 and 4b, the count of check 4c exported

## Gate condition SX-17, before the first line

- The baseline exists: `gateway_check/205_boot_checks_baseline.md` (HEAD `0f5d2a8e`).
- This record cites code by SYMBOL. Line numbers are given only as "today", in `apps/core-server/src/capture/boot/index.ts` after this row (453 lines, sha256 `47946c29...2f3d`).
- Stated: between the baseline and this row, row 85 (decision C46) edited `boot/index.ts` and `__tests__/boot.test.ts` (the host-facts door). Those edits are not this row's; the comparison below is by symbol against the baseline's quoted text.

## What changed (one file: `apps/core-server/src/capture/boot/index.ts`)

| Symbol | Change |
|---|---|
| `loadedOnce` (new, local) | wraps the store's loader: the FIRST call loads; its outcome (the signer, or the thrown error) is what every later call gets |
| `storedSigningKeyReaders(load = loadSoftwareSigner)` (new, exported) | the two readers over ONE `loadedOnce`: `problem` (check 4) and `isDevelopment` (check 4b). A test hands in a counting loader |
| `signingKeyQuestionsOf(mount, directory, now)` (new, local) | the two members `signingKeyProblem`, `signingKeyIsDevelopment` of ONE run of the boot step: the mount's test seam where it has one, else the readers over one load. Called inside the object the step hands to `runCaptureBootChecks`, so the load never outlives its run (a boot step that ran again would load again) |
| `storedSigningKeyProblem`, `storedSigningKeyIsDevelopment` | ONE token each: a third parameter `load` (default `loadSoftwareSigner`) is called where `loadSoftwareSigner` was. Both `try` bodies and both `catch` blocks are otherwise as the baseline quotes them: the `SignerError` code or `UNREADABLE`; `false` |
| `SELECT_STORED_HASH_SETS` | untouched |
| `StoredHashSetRow` | now exported (the type of the rows the count takes) |
| `demoPasswordHashSetsAmong(rows, verify)` (new, exported) | the loop of the baseline's `storedDemoPasswordOperators`, moved out whole: `let count = 0; for (const row of rows) { if (await verify(DEMO_OPERATOR_PASSWORD, {...})) count += 1; } return count;` - the verifying statement is byte-identical |
| `storedHashSetIsDemoPassword(row, verify)` (new, exported) | THE PER-ROW PREDICATE: `(await demoPasswordHashSetsAmong([row], verify)) === 1` |
| `storedDemoPasswordOperators` | reads the rows as before, then `return await demoPasswordHashSetsAmong(rows, verify);` inside the same `try`; the fail-closed `catch { return null; }` and its comment are untouched |
| the wiring in the boot step | the two lines `signingKeyProblem: ...` / `signingKeyIsDevelopment: ...` became one spread of `signingKeyQuestionsOf(...)` at the same place; directory and clock expressions unchanged |

`boot/checks.ts` was NOT edited (no need arose).

## Why the predicate is a count of one

The static rule G-R16 (`src/capture/__tests__/static.test.ts`, owned by row 85c in this wave) pins that the published password is named on exactly two lines of `boot/index.ts`: the import and the verifying statement, by its exact text. A predicate with its own `verify(DEMO_OPERATOR_PASSWORD, ...)` would be a second place where the constant meets the verifier. So the constant stays in ONE statement (the loop, moved into `demoPasswordHashSetsAmong`), and the predicate asks that function about one row. The rule's meaning ("handed to the verifier and to nothing else") and its letter both hold; no pin was edited.

The second pin (C46, same file) fixes the first three lines of the step's `run()`; that is why the one load is made inside the dependency object and not as a statement before it.

## Diff statement against the row-205 baseline

```
$ git hash-object apps/core-server/src/capture/boot/checks.ts
1697e4b9dec975226974ae9f2053e2145166a0f2            (baseline blob: 1697e4b9...; identical)
$ shasum -a 256 apps/core-server/src/capture/boot/checks.ts
d201004b6710458674ad0fc861d872e4355fa05b607a03f313aec53ba510dd94   (baseline: identical)
$ shasum -a 256 .../boot/__tests__/checks.test.ts
04a3dd6984ff9bf8371fc452304e0de49f5cfd8311da77e5ca5f27726e83a8aa   (baseline: identical)
$ shasum -a 256 .../boot/__tests__/boot.test.ts      before and after this row
12f1d4c39addf143237273a4ddf3a4b65df100bff94a04407f6356632f2b582f   (not the baseline's 8790531e...: row 85 edited it; this row did not)
$ sed -n '<line of SELECT_STORED_HASH_SETS>p' .../boot/index.ts | shasum -a 256
5cddf11b39c6ff0edda4c96b4f93444ca7eb6a0137be93bd6cf7abc812d484e1   (baseline: identical)
```

| Baseline item | State |
|---|---|
| The three conditions of checks 4, 4b, 4c (`checks.ts`) | byte-identical: the file's blob is the baseline's |
| `SELECT_STORED_HASH_SETS` | byte-identical (digest above) |
| Fail-closed catch of the count (`catch { return null; }` in `storedDemoPasswordOperators`; `.catch(() => null)` in `checks.ts`) | kept, both |
| `catch` of `storedSigningKeyProblem` and of `storedSigningKeyIsDevelopment` | kept, text unchanged |
| The baseline digest of `storedDemoPasswordOperators` lines 239-254 (`946a58b4...`) | NO LONGER EQUAL, by design: its loop moved into the exported function. Statement by statement: the read, the verifying `if`, `count += 1`, `return count`, the catch - all present, none altered |

## Behaviour that could differ, stated

- Before: check 4b read the store a second time, with a second reading of the clock. Now it judges the certificate check 4 loaded. A store that changed between the two asks is no longer seen twice - the purpose of SX-16.
- `storedSigningKeyIsDevelopment` still answers `false` when the load threw; check 4 has refused before it is asked (unchanged, tested).
- A mount with one of the two test seams and not the other: the default reader loads once at its first ask, as before.

## Checks

| Check | Command | Result |
|---|---|---|
| Existing boot tests, unedited, plus the new one-load test and the static rules | `npx vitest run --project unit src/capture/boot/__tests__ src/capture/__tests__/static.test.ts test/static --maxWorkers=2` | `Test Files  1 failed | 24 passed (25)`, `Tests  3 failed | 437 passed (440)`. The 3 reds are in `static.test.ts` and are NOT this row's (see below). Second run: the first had 5 reds, 2 of them mine (the two pins above); the code was reshaped, no pin edited |
| Counting double | `src/capture/boot/__tests__/one-load.test.ts` (new, 4 tests): a REAL store provisioned into a temporary directory, driven through the real `runCaptureBootChecks` for `REAL_PRODUCTION` - passes 4 and 4b with `loads() === 1`; a development-marked certificate is refused by 4b with one load; a store that does not load is refused by 4 with the signer's code, `isDevelopment` answers false, still one load; control: two sets of readers are two loads | pass |
| The count on a seeded throw-away database | `/usr/bin/lockf -k -t 1800 .locks/db-migrate.lock sh -c 'cd apps/core-server && npx vitest run --project db test/cli/operator-set-password.db.test.ts --maxWorkers=2'` | `Tests  1 passed (1)`; `0 remain with the run prefix`. Every seeded row answers true, the count is 3, `storedDemoPasswordOperators` on the same pool answers 3; a verifier that throws: the predicate rejects, the reader answers null |
| Typecheck | `npx tsc --noEmit` in `apps/core-server` | no error in this row's files. Errors of other rows in flight: `src/capture/__tests__/static.test.ts(1141, 1164)`, `test/support/fake-onvif-stub.ts(910, 1259)` |

Reds not this row's (file a controller should route): `static.test.ts` G-R9 / SR-2 (four files state the third destination; likely row 143b), G-R10 / G-R11 (ONVIF facade export; likely row 146 / N-rows), G-R14 (adapter layer; likely row 143b or 85c). None names `boot/`.

## Doubles and what stays unproven

- The mount itself (`mountCaptureBootChecks` with a real app) was not driven with a counting loader: the mount has no loader seam and none was added (smallest change). What is proven is the readers the mount uses, through the real decision function; the wiring is one spread line, covered by the unedited `boot.test.ts` (its real-key cases pass through it).
- A whole `REAL_PRODUCTION` start: row 208 / X-G.

## DRIVER DECISIONS

1. New test file `boot/__tests__/one-load.test.ts` instead of extending `boot.test.ts`: the cell asks that the existing tests run UNEDITED, and their hashes are the proof.
2. The predicate is expressed through the exported count (reason above), instead of asking for an edit of the G-R16 pin.
3. The database half of the proof lives in `test/cli/operator-set-password.db.test.ts` (row 215's file), first `describe`.

## Files

- Changed: `apps/core-server/src/capture/boot/index.ts` (Edit tool only).
- New: `apps/core-server/src/capture/boot/__tests__/one-load.test.ts`, `apps/core-server/test/cli/operator-set-password.db.test.ts`.
- New: this record, `delegation_progress/row_211.md`. Changed: `delegation_progress/file_claims.md` (one appended line - by shell append; see row 215's record, Edit-only statement).
