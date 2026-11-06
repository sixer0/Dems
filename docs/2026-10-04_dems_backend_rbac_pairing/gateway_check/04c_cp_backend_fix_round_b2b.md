# CP-B1 Fix Round B2b — items 8a and 9 to 13 of fourteen (structural)

- **Task:** DEMS Backend (Postgres), Integrated RBAC and Portal-Mobile Pairing
- **Controller row:** "CP-B1 fix round B2b" continuation (test step label `b2br2`), decisions D131 (item 8a) and D132 (items 9–13)
- **Date:** 2026-10-05, from 10:05 WIB
- **Agent:** coder-execution-local — single writer of the named `apps/core-server` structural paths for this round
- **Status:** **complete** for items 8a, 9, 10, 11, 12, 13. Items 0–8 landed by the previous holder (see `delegation_progress/coder_execution_fix_round_b2b.md`).
- **End state of THIS round's files:** typecheck exit 0; lint exit 0 with **zero warnings**; whole `unit` **3,911 passed / 1 failed**; whole `db` **1,737 passed / 3 failed**, **0 databases left** with the run prefix `dems_test_step_b2br2_`. Every failure in both projects is in `test/helpers/db/**`, the exclusive write path of the parallel helper-owner row (D134), which was editing that folder live during this round (its own tests cite "decision D134"). No failure is in a file this round wrote. See section 6.

Tier 3 document: each statement names a `file:line`, a test, or a command with its measured output. Evidence in `gateway_check/assets/04c_*`. Pre-images: `.cache/rollback/CPB2b_r2/` (per-file copies) plus the prior round's full-tree `.cache/rollback/CPB2b/`.

---

## 1. Item 8a — the two digest-verdict assertions (decision D131, GRANTED)

**What the finding said.** Round B2b item 8 made `verifyStoredAuditRows` return a structured verdict `{ ok:false, code, seq, reason }` (`src/db/mapping/audit-verify.ts:52-59`). Two older assertions still expected the flat `{ ok:false, reason }`, so `npm run test:db` was red (D130 measured exactly these two). D131 grants the smallest change, assertion only, no production file, both owners (W20 seed, W25 fixture) complete.

**The fix (the two changed lines, stated as D131 requires).**
- `src/db/seed/__tests__/seed.db.test.ts:160` — `{ ok: false, reason: 'HASH_MISMATCH at sequence 30' }` → `{ ok: false, code: 'HASH_MISMATCH', seq: 30, reason: 'HASH_MISMATCH at sequence 30' }`.
- `src/db/fixtures/__tests__/bulk-fixture.db.test.ts:346` — `{ ok: false, reason: 'HASH_MISMATCH at sequence 2501' }` → `{ ok: false, code: 'HASH_MISMATCH', seq: 2501, reason: 'HASH_MISMATCH at sequence 2501' }`.

No other assertion in those two files was touched; no production file changed.

**Test that proves it.** `assets/04c_item8a_db_two_files.log`: those two files under `test:db` → `Test Files 2 passed (2)`, `Tests 51 passed (51)`, exit 0, teardown `0 remain`. The whole `db` project after item 9 (`assets/04c_item9_db.log`, section 5) shows both green among 121 files / 1,727.

---

## 2. Item 9 — shims and neutral test support (CPB1-12 completion)

**What the finding said.** Round B1 moved shared test support to `apps/core-server/test/support/` and left `export *` re-export shims in the module/plugin folders "for one round," to be removed when nothing imports them (report §5 B2-3). The seed-index store-names re-export was the same kind of leftover (CPB1-11).

**Measured importers before the change** (`assets/04c_item9_importers_before.txt`, resolved by an out-of-tree script over every relative import):

| Shim | Importers | Action |
|---|--:|---|
| `src/db/seed/store.ts` | 0 | delete |
| `src/plugins/permission-guard/__tests__/support.ts` | 0 | delete |
| `src/db/reset/__tests__/support.ts` | 0 | delete |
| `src/plugins/config/__tests__/test-config.ts` | 4 | migrate importers, then delete |
| `src/db/seed/__tests__/support.ts` | 8 | migrate importers, then delete |
| `src/modules/identity/__tests__/support.ts` | 3 | migrate importers, then delete |
| `src/modules/pairing/__tests__/support.ts` | 1 | migrate importer, then delete |

The importers were fixtures, sessions and acceptance test files — all rows that have since landed; the three parallel agents this round (D133 mobile, D134 helper, D135 verifier) do not write those files, so the rewrite was collision-free.

**What landed.**
- **18 import specifiers rewritten** across 12 files from the shim path to the canonical `test/support/{config,seed,identity,pairing}` (and, for the store-names, from `'../../seed'` to `'../../store'`): `test/acceptance/restart.test.ts`, `src/db/fixtures/__tests__/{target.test.ts,audit-reference.ts,support.ts,bulk-fixture.db.test.ts}`, `src/modules/sessions/__tests__/{memory-engine,routes,operations.db,concurrency.db,journey.db,pure}.test.ts` and `support.ts`. Each rewrite is a specifier-only change; because every shim was `export * from '<target>'`, the named-import surface is identical by construction. Log: `assets/04c_item9_rewrite.log` (every old specifier matched exactly once).
- **7 shims removed** from the tree (moved out to `$TMPDIR`, never `rm` in the repo, per M12): the four above plus the three zero-importer ones. After the rewrite all four had 0 importers (`assets/04c_item9_importers_after.txt`).
- **`src/db/seed/index.ts`**: the store-names re-export block (`ALL_TABLES … writeRows` + types from `'../store'`) removed; header comment updated. Its two remaining consumers (`fixtures/support.ts`, `bulk-fixture.db.test.ts`) now import `'../../store'` directly.
- **Two static tests updated for the gone store shim**: `src/db/mapping/__tests__/static.test.ts:102` (the seed-folder list loses `'seed/store.ts'`); `src/db/store/__tests__/static.test.ts` (importer list loses `'src/db/seed/store.ts'` **and** `'src/db/seed/index.ts'`, which no longer imports the store once its re-export block is gone; the "old path is a shim" `it` removed; header comment updated; the now-unused `text` helper removed to keep lint at zero warnings).

**Left in place, on purpose.** `src/core/__tests__/support.ts`, `src/engine/__tests__/support.ts`, `src/modules/admin/__tests__/support.ts` are **not** pure shims — they hold row-private helpers (`coreApp`, `seedScenario`, the admin URLs) beside their `export *`; B1 §5 B2-3 says they can never go as files. `src/realtime/__tests__/support.ts` is pinned by its own `support.db.test.ts:142` ("the old path of the support"); removing it means editing the realtime row's test, so it is left and reported (finding F-B2b-1).

**Test that proves it.** Whole `unit` and whole `db` after item 9 (section 5): typecheck 0, lint 0; the only unit red was the foreign helper one. The db run `assets/04c_item9_db.log`: `121 files / 1,727 passed`, exit 0, `0 remain` — this exercises every rewritten sessions/fixtures/acceptance importer against PostgreSQL.

---

## 3. Item 10 — CPB1-18 to CPB1-26 with F-9

The review scheduled these Low/Info findings "before W91" (§8 row 11). Most are owned by other/in-flight rows whose static tests pin the exact values, sit in forbidden paths, or are controller/close-out decisions. This round did the safe subset that is unambiguously core-server structural and not another row's pinned list, and reports the rest precisely (section 4).

**F-9 stale comments fixed (allowed paths):**
- `src/db/mapping/index.ts:12` — "is `../seed/store.ts`" → "is `../store`" (the store moved in B1).
- `src/db/mapping/__tests__/changes.test.ts:7` — counterpart path `../../seed/__tests__/write-through.db.test.ts` → `../../store/__tests__/write-through.db.test.ts`.
- `src/db/mapping/__tests__/round-trip.test.ts:7` — `../../seed/__tests__/*.db.test.ts` → `../../store/__tests__/write-through.db.test.ts`.
- `src/plugins/origin-guard/__tests__/guard-test-app.ts:6-7` — "Stage 4 is the scaffold's stub (every caller ANONYMOUS)" → the real stages 3, 4 and 5; a request with no credential resolves to ANONYMOUS through the real stage 4, and a test replaces it with `authenticateAs` / `authenticateBySpecification`.

**CPB1-23 confirmed already closed, no edit.** `stackFramesOf` at `src/plugins/logger/error-log.ts:111-120` already cuts the error's own message out of the stack before filtering frame lines (`stack.slice(at + message.length)` then `FRAME_LINE.test`), which is exactly the finding's recommended fix; the comment at `:106-110` states it. Closed in an earlier round.

**Verification.** Comment-only changes have no runtime effect; `assets/04c_final_unit.log` confirms no comment-grep static test broke (the only red is the foreign helper one). The `db` behaviour is unchanged from item 9's green run.

---

## 4. CPB1-18..26 not done here, with the exact reason

| ID | Why not in this round | Where it belongs |
|---|---|---|
| CPB1-18 | Operation-ID string lists in `plugins/throttle/limits.ts`, `plugins/readiness/index.ts`, `permission-guard/access-rules.ts`; the two 401 texts in `engine/errors.ts`; `realtime/index.ts` `SessionEndedReason`; `api-failure.ts` `allow` literal. Each is another row's folder whose static test pins the current shape; the authenticate list was already typed in B1 item 6 | W42 / W08 / W24 / W28 (their owners), before W91 |
| CPB1-19 | `boot-checks.ts` `GENESIS_HASH` is under `src/db/schema/` (forbidden this round); the one-statement-three-times fix touches `db/commands/create.ts` and `test/helpers/db/ddl.ts` (D134's live path) | W17 / W21 / W29 / W11 |
| CPB1-20 | A controller decision (record hand-built parts without an HB number) | controller |
| CPB1-21 | Recommendation is to reword NL-6 in the contract/spec, not to change code | close-out W83 |
| CPB1-22 | `process.env` in `reset/routine.ts` / `commands/cli.ts` — passing the environment in is a behaviour change owned by W29 | W29 |
| CPB1-24 | §7.6 rules the route walk stays in the boot step (it fails closed); exposing the table is an edit of frozen `app.ts` | controller ruling, W28 |
| CPB1-25 | Only `db/schema/value-sets.ts:7` remains (forbidden path); the other three were done in B1 item 10 | W17 |
| CPB1-26 | Four files above ~800 lines; §7.7 says no split before the gate | W91 |

---

## 5. Item 11 — the static log-call test must see members through a spread (D123a)

**What the finding said.** D123a: the refusal log key was renamed `cause` → `refusedBy` at `src/plugins/permission-guard/index.ts:287`, but the server-wide guard that refuses a member named `error`/`cause`/`e`/`reason` skipped any member arriving through a spread (`test/static/log-calls.ts:127`, `if (member.startsWith('...')) continue;`), so the forbidden key hidden inside `...(cond ? { cause: … } : {})` slipped past.

**The fix.** `test/static/log-calls.ts`: added `inlineObjectStarts(text, from, to)` (`:123`) which finds every object literal written directly in a spread operand, descending through parentheses and brackets but not into another literal; `membersOf` now recurses into those instead of skipping the spread (`:157-167`). A spread of a variable (`...where`) still yields nothing, as before.

**Test that proves it.** `test/static/log-calls.test.ts` positive control gained a case `log.warn({ ...(flag ? { cause: thrown } : {}), ...{ reason: failure }, ok: true }, …)`; the scanner now reports `cause/keyed,reason/keyed,ok/keyed` and `loggedKeys` flags `cause` and `reason` at that line. `assets/04c_item11_logcalls_test.log`: `7 passed`. The production scan stays clean — the only production log call with inline-object spreads is the permission-guard refusal, whose spread keys are `deviceId`/`refusedBy` (not refused).

**Mutation (M15, outside the tree).** `assets/04c_item11_mutation.log`: on scratch copies of the scanner, the OLD branch (`continue`) returns `[]` for a planted `log.warn({ ...(flag ? { cause: thrown } : {}), ...{ reason: failure } })`; the NEW branch returns `["cause/keyed","reason/keyed"]`. The gap is closed.

---

## 6. Item 12 — `ACTIVITY_EXEMPT_OPERATIONS` still listed `signInWithBiometric` (D126 G-1)

**What the finding said.** D126 GD-2 / G-1: operation 8 `signInWithBiometric` carries the condition `DEVICE_CREDENTIAL`, so stage 6 lets only a DEVICE principal reach it and a DEVICE principal presents no operator session — the activity hook returns at the session check before the exempt list is consulted. The entry had no effect once that condition landed.

**The fix.** `src/plugins/authenticate/index.ts:176` — `['signIn', 'signOut', 'signInWithBiometric']` → `['signIn', 'signOut']`; the doc comment rewritten to say why biometric is no longer listed (D126 GD-2).

**Tests changed by design (granted by D126 GD-2 + D132).** In `src/plugins/authenticate/__tests__/authenticate.test.ts`:
- `:433-434` the pinned list is `['signIn', 'signOut']`; title drops "by biometric token".
- `:440-451` the old test presented a *session* token on operation 8 — a state D126 makes unreachable. Retitled and rewritten to present a device credential (`bearer(PAIRED_CREDENTIAL)` → `{ kind:'DEVICE', deviceId:'DEV-0003' }`, `session` null) and assert the hook touches nothing because there is no session, which is the real reason. Vacuity (the hook does touch when a session is present on a non-exempt POST) is covered by the earlier test at `:425-431`.

**Test that proves it.** `assets/04c_item12_authenticate.log`: `42 passed`. Typecheck 0, lint 0.

**Mutation (M15, outside the tree).** `assets/04c_item12_mutation.log` models the hook's guard order: for every input production can reach (a DEVICE principal with no session on op 8) the outcome is identical with the OLD and NEW lists — the entry was inert; only the unreachable "operator session on op 8" differs, which is exactly why the old unit test had to change.

---

## 7. Item 13 — the npm script for `dropDeadRun` (FU-DN-3)

**What the finding said.** W11b follow-up FU-DN-3: `TestRun.dropDeadRun(prefix)` (`test/helpers/db/run.ts:727`) exists and is tested but has no manifest entry; "worth one line in `apps/core-server/package.json` … calling a small command file."

**What landed.**
- `apps/core-server/test/drop-dead-run.ts` (new) — starts a run of its own as `dems_owner` (creates no database), calls `run.dropDeadRun(process.argv[2])`, prints names/counts/times only (never a credential), catches a `DbTestHelperError` (the base of `DbGuardError`) as a clean `REFUSED (<code>)`, and tears down its own run. Placed directly under `test/` (not in `test/helpers/db/**`, D134's live path); it builds no connection itself, only calls the factory.
- `apps/core-server/package.json:13` — `"test:db:drop-run": "tsx test/drop-dead-run.ts"`. Root manifest untouched (kept out of the tracked npm-slot file).

**Test that proves it.** `assets/04c_item13_smoke_refused.log`: `DEMS_TEST_STEP=b2br2 npm run test:db:drop-run -w @dems/core-server -- dems_demo` printed `REFUSED (GUARD_NOT_A_TEST_DATABASE): refused before any statement: "dems_demo" is not the prefix of a test run …` then `caller's run closed: dropped 0, remaining 0`, exit 1. The wiring reaches the guarded entry, the guard fires before any statement, nothing real is touched, and the caller leaves no database. Typecheck 0, lint 0.

---

## 8. Verification (all from the workspace root, `--maxWorkers=2`, never in a loop; database commands with the per-command sandbox bypass)

```
npm run typecheck -w @dems/core-server            exit 0
npm run lint -w @dems/core-server                 exit 0, zero warnings
```

Baseline before the first edit (10:0x WIB):
```
unit   Test Files 152 passed (152)          Tests 3845 passed (3845)              exit 0
db     Test Files 2 failed | 119 (121)       Tests 2 failed | 1725 passed (1727)   exit 1   [the two = item 8a]
       teardown: dropped 8; 0 remain with prefix dems_test_step_b2br2_…
```

After each landing (whole projects; the only reds throughout are `test/helpers/db/**`, D134's live path):
```
item 8a  targeted db 2 files / 51 passed, exit 0, 0 remain
item 9   unit 3845 passed / 1 failed(helper) ; db 121 files / 1727 passed, exit 0, 0 remain
item 10  typecheck 0, lint 0 (comments only)
item 11  log-calls 7 passed ; mutation old=[] new=[cause,reason]
item 12  authenticate 42 passed ; mutation: reachable inputs identical old vs new
item 13  typecheck 0, lint 0 ; smoke REFUSED(GUARD_NOT_A_TEST_DATABASE), 0 remain
```

Final end state (this round's files):
```
unit   Test Files 1 failed | 152 passed (153)   Tests 1 failed | 3911 passed (3912)
         FAIL test/helpers/db/__tests__/static.test.ts  (D134)
db     Test Files 2 failed | 120 passed (122)    Tests 3 failed | 1737 passed (1740)
         FAIL test/helpers/db/__tests__/{clone-lock,needs}.db.test.ts  (D134)
       forced drops that needed a retry: 0
       teardown: dropped 8 database(s) in 313 ms; 0 remain with the run prefix dems_test_step_b2br2_…
```

Ledger note (P24): the totals rose above the baseline because the parallel helper-owner row (D134) is adding tests to `test/helpers/db/**` during this round; this round itself removed one shim test (item 9) and rewrote one (item 12), deleting none of another row's coverage.

---

## 9. Failures named as another row's in-flight work (P11 / M12)

Every red in both whole projects is inside `test/helpers/db/**`, the exclusive write path of the parallel helper-owner row (D134, "the helper's third follow-up"). Evidence it is not this round:
- The failing static test scans only `test/helpers/db/**` and `test/global-setup.db.ts` (`test/helpers/db/__tests__/static.test.ts:18`); this round's only file near that area is `test/drop-dead-run.ts`, outside the scanned set, and it builds no client/pool.
- `needs.db.test.ts` and `needs.test.ts` titles cite "decision D134"; the count of helper reds grew and shifted across this round's runs (1 → 6 → 1 → 3) tracking that agent's live edits, while this round's own files stayed green in every run.
- This round never wrote under `test/helpers/db/**` except the new `test/drop-dead-run.ts` (item 13), which is outside that folder.

A clean whole-project green requires D134 to finish; per M12 the failures are named rather than edited (this round must not touch another row's write path).

---

## 10. Deviations, findings, decisions for the controller

**Deviations**
- DV-1: item 9 also removed `'src/db/seed/index.ts'` from the store-importer list in `db/store/__tests__/static.test.ts` — dropping the store-names re-export makes the seed index stop importing the store; the list must reflect that.
- DV-2: item 9 deleted shims by moving them out of the tree to `$TMPDIR` (never `rm` in the repo, M12); bytes preserved, recoverable.
- DV-3: item 12 rewrote a test created by B1 item 6 (biometric exemption). Granted by D126 GD-2 + D132; the old test's premise (an operator session on op 8) is unreachable after D126.
- DV-4: item 13 placed the command at `test/drop-dead-run.ts` (not `test/helpers/db/`) to stay clear of D134's live path, and added the script only to the untracked `@dems/core-server` manifest, not the tracked root manifest (keeps out of the npm-slot resource; P1).
- DV-5: three files were edited before their own pre-image was copied to `.cache/rollback/CPB2b_r2/` (`db/mapping/__tests__/static.test.ts`, `db/store/__tests__/static.test.ts`, `db/seed/index.ts`). Rollback is intact via the prior round's `.cache/rollback/CPB2b/` full-tree snapshot, verified to be a true pre-image of all three (still holds `seed/store.ts`, the shim test, and the store-names block).
- DV-6: the P23 `git diff acaff20 -- <paths>` patch is empty because `apps/core-server/` is entirely untracked; pre-images are file copies (M12).

**Findings**
- F-B2b-1: `src/realtime/__tests__/support.ts` is still a back-compat shim, pinned by its own `support.db.test.ts:142` ("the old path of the support"). Removing it means editing the realtime row's test — left for that owner.
- F-B2b-2: `core/engine/admin __tests__/support.ts` keep row-private helpers beside their `export *`; external importers (sessions, acceptance) could switch to `test/support/{core,engine,admin}` to finish decoupling, but those support files cannot be deleted as files. Not done here to avoid touching other rows' pinned lists.
- F-B2b-3: the parallel helper-owner row (D134) currently leaves `test/helpers/db/**` red mid-edit; the backend gate W58 needs that folder green.

**Decisions for the controller**
- DN-1: confirm the granted by-design test changes of item 12 (D126 GD-2) and item 8a (D131) are recorded as such.
- DN-2: who removes the realtime shim (F-B2b-1) and finishes the core/engine/admin decoupling (F-B2b-2) — the realtime/helper owners or a dedicated support row.
- DN-3: confirm `test:db:drop-run` placement (workspace manifest only, no root alias) is acceptable, or grant a root alias in a later slot.

---

*Generated: 2026-10-05 ~11:05 WIB. Runner logs in `gateway_check/assets/04c_*`.*
