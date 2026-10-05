# CP-B1 Fix Round B1 — the structural fixes at module level

- **Task:** DEMS Backend (Postgres), Integrated RBAC and Portal-Mobile Pairing
- **Controller row:** "CP-B1 fix round B1" (test step label `60b`), after the review `gateway_check/04_cp_backend_foundation.md` and round A (`04a_cp_backend_fix_round_a.md`)
- **Date:** 2026-10-04, 17:03 to 17:52 WIB
- **Agent:** coder-execution (single writer of the listed folders for this round)
- **Status:** **complete**
- **Result:** the 10 items of the brief landed in 10 atomic steps (181 paths: 162 changed, 19 new; 2 old paths left the tree). No behaviour of the server changed except what items 4, 6 and 8 ask for by their own text (a log line, one unit of work less, a log key); each is listed in section 4.
- **End state (17:47:46 to 17:48:18):** whole `unit` project 141 files / 3,609 tests exit 0; whole `db` project 108 files / 1,540 passed + 1 skipped exit 0 (17:45:10); typecheck exit 0; lint exit 0 without a warning. No red of another row at the end.

Tier 3 document: each statement names a file and line, a test, or a command with its output. Evidence is in `gateway_check/assets/04b_*` (38 files). "Before" lines are those of the pre-images of 17:04:21 (`.cache/rollback/CPB1b1/`); "after" lines are of the tree as landed.

---

## 1. Outcome per item

| # | Item | What landed | Landed | Whole `unit` right after | Proof that behaviour did not change |
|---|---|---|---|---|---|
| 2 | CPB1-16 / D78 DN-11: the window helper | `plugins/throttle/windows.ts` is `core/windows.ts`, exported by the core's index; three units import the index | 17:11:29 (11) | 139 files, 3,569 of 3,570; 1 red of the sessions row (P11) | its 7 tests moved unchanged; throttle, lockout, redeem-lock tests green |
| 3 | CPB1-11 / D62 DN-10 / D77 DN-13: the store | `db/seed/store.ts` is `db/store/store.ts` with an index; seed, reset, fixture, engine import `db/store`; the old path is a one-line shim | 17:15:47 (19) | 140 / 3,583, exit 0 | scratch `db`: store, seed, engine 8 files / 111; whole `db` at 17:24:46 |
| 4 | Round A §4: the read block | identity, rbac and pairing call `app.db.read`; the three copies are gone | 17:20:12 (9) | 140 files, 3,596 of 3,599; 3 red of the fixture row (P11) | scratch `db` 8 files / 129; the 503, the probe and the entry asserted as before |
| 5 | D105: one revoke function | pairing (revoke, unpair) and administration (disable) call `revokeBiometricTokens`; their own statements are gone | 17:23:55 (8) | 140 / 3,602, exit 0 | scratch `db` 21 files / 237 (among them `revocation.db.test.ts`, both sequence tests) |
| — | whole `db` after items 3 to 5 | — | 17:24:46 | — | **108 files, 1,540 passed + 1 skipped, exit 0** |
| 1 | CPB1-17 / D83 DN-8: the identity routes | the `onRequest` hooks of operations 2, 4, 5, 6 and the retired-device check of operation 3 are gone; identity and health use `routeOfOperation` | 17:29:08 (4) | 141 / 3,604, exit 0 | the denials through the real stages: scratch `db` 11 files / 208; mutation M-1 |
| 6 | Biometric row F-4, CPB1-18 | `signInWithBiometric` is activity-exempt; the list is typed by the contract's operation IDs | 17:34:23 (2) | 141 / 3,605, exit 0 | mutations M-6a, M-6b; scratch `db` 16 files / 191 |
| 7 | D93 follow-up | the test block is RETITLED (not deleted) | 17:34:59 (1) | 141 / 3,605, exit 0 | mutation M-7 shows what it proves |
| 8 | D96 ruling 2: the readiness log key | `reason` is `hold`; the allow-list of the log static test is empty | 17:35:36 (5) | 141 / 3,606, exit 0 | scratch `db` demo 4 files / 42 + 1 skipped |
| 10 | CPB1-25 stale comments, CPB1-21 report | three comments reworded; CPB1-21 in section 6 | 17:36:10 (2) | 141 / 3,606, exit 0 | comments only |
| 9 | CPB1-12: neutral test support | `test/support/` (10 files); the old paths re-export; 122 test files changed in import specifiers only; the cycle guard ↔ identity is gone | 17:44:25 (143) | 141 / 3,609, exit 0 | scratch whole `unit` 141 / 3,606; scratch `db` 52 files / 676 |

The landing order was 2, 3, 4, 5, 1, 6, 7, 8, 10, 9 (the moves first, the test support last, because it touches the tests of every earlier item). Numbers in brackets are the entries of each landing list (`assets/04b_landed_lists.txt`). The summary lines of every whole `unit` run are in `assets/04b_unit_runs_after_each_landing.txt`.

---

## 2. Per item: what changed, the evidence

### 2.1 Item 2 — the window helper (CPB1-16, D78 DN-11)

| Before | After |
|---|---|
| `src/plugins/throttle/windows.ts` (78 lines) | `src/core/windows.ts` (the same code; the header says why it lives in the core) |
| — | `src/core/index.ts:93` exports `counterName`, `createFixedWindows`, `retryAfterSeconds`, `type FixedWindows`, `type OpenWindow` |
| `src/plugins/throttle/index.ts:61` `from './windows'` | `:61` `from '../../core'` |
| `src/plugins/throttle/denial-budget.ts:20` `from './windows'` | `:20` `from '../../core'` |
| `src/modules/identity/lockout.ts:40` `from '../../plugins/throttle/windows'` | `:40` `from '../../core'` |
| `src/modules/pairing/redeem-lock.ts:43` `from '../../plugins/throttle/windows'` | `:43` `from '../../core'` |
| `src/plugins/throttle/__tests__/windows-limits.test.ts:109-183` (the block "fixed windows by the server clock", 7 tests) | `src/core/__tests__/windows.test.ts` (the same 7 tests, unchanged) |

**Removed path:** `src/plugins/throttle/windows.ts` (nothing imports it; searched over `src/` and `test/` at 17:11).

**New static test** `test/static/imports.test.ts` with its reader `test/static/imports.ts` (no static test for imports existed under `test/static/`). Server-wide, for production sources: (1) no import of test code (`__tests__`, `test/`, `*.test.ts`); (2) a CLOSED unit is imported through its index. Closed: `src/core`, `src/engine`, `src/realtime`, every `src/plugins/<name>`, `src/db/mapping`, `src/db/store`. Not closed, with the reason in the file's header: `src/modules/*`, `src/db/schema`, `src/db/commands`, `src/db/{seed,reset,fixtures}` (section 5).

**Existing test changed:** `src/core/__tests__/static.test.ts:53` (the list of the folder's production files gains `'src/core/windows.ts'`); `windows-limits.test.ts:1-2` (header), `:25` (the import of `../windows` goes with the block).

**Evidence.** Scratch: 8 files / 126 tests green (the static test, the moved tests, the throttle, the lockout, the redeem lock). Planted P-1: `from '../../core/windows'` in `lockout.ts` turns the static test red (`assets/04b_10_planted_static_violations.log`).

### 2.2 Item 3 — the store (CPB1-11)

| Before | After |
|---|---|
| `src/db/seed/store.ts` (404 lines) | `src/db/store/store.ts` (the same code; header gains the reason) and `src/db/store/index.ts` (the 15 names) |
| — | `src/db/seed/store.ts`: 3 lines, `export * from '../store';` with "Remove with fix round B2" |
| `src/db/seed/seed.ts:58` `from './store'` | `:58` `from '../store'` |
| `src/db/seed/index.ts:43` `} from './store';` | `:47` `} from '../store';` (kept for one round, section 5) |
| `src/db/reset/routine.ts:67` one import of 7 names from `'../seed'` | `:67` the 4 seed names from `'../seed'`, `:68` `StoreError, applyChanges, countAllTables` from `'../store'` |
| `src/db/fixtures/load.ts:41` `from '../seed'` | `:41` `from '../store'` (landed in the same step as the move; the fixture row's file was unchanged since 17:04) |
| `src/engine/rehydrate.ts:30`, `src/engine/write-plan.ts:42` `from '../db/seed/store'` | `from '../db/store'` |
| `src/db/seed/__tests__/write-through.db.test.ts` | `src/db/store/__tests__/write-through.db.test.ts` (lines 26 to 28: three import paths) |

In `src/engine/**` and `src/db/{reset,fixtures}/**` only import lines changed.

**Removed path:** `src/db/seed/__tests__/write-through.db.test.ts` (a test file; nothing imports it).

**New test** `src/db/store/__tests__/static.test.ts` (9 tests): the store was read by the mapping row's static test as part of the seed folder; these are that test's rules for it, plus the direction `db/schema` ← `db/mapping` ← `db/store` ← seed, reset, fixtures, engine, the exact list of importers, and "the old path is one re-export".

**Existing tests changed** (a pinned import text, or an import line): `src/engine/__tests__/static.test.ts:116`, `:117` (the two regular expressions that pin the import); `src/engine/__tests__/support.ts:28`; `src/db/seed/__tests__/{seed.db.test.ts:33, seed-order.test.ts:8, cli.db.test.ts:12, seed-clock.db.test.ts:15, support.ts:22}`; `src/db/reset/__tests__/support.ts:18`. **Not changed:** `src/db/mapping/__tests__/static.test.ts:102` still lists `seed/store.ts`, which is true while the shim stays.

**Evidence.** `assets/04b_03_item3_scratch_db_store_seed_engine.log`: `Test Files 8 passed (8)`, `Tests 111 passed (111)`. Planted P-3 (the engine imports the old path) and P-9 (the shim grows a statement): detected.

### 2.3 Item 4 — one read helper (round A §4, CPB1-8)

| Before | After |
|---|---|
| `src/modules/identity/sessions.ts:134-152` (`READ_FAILED`, the try / catch block) | `:139-141` `readDatabase` is `return app.db.read(source, (pool) => work(onPool(pool)));` — the adapter that hands the module's statements a `Queryable`; imports of `ApiFailure`, `notReady`, `describeError` gone |
| `src/modules/pairing/database.ts:22-38` (the same block) | `:25-27` the same adapter |
| `src/modules/rbac/index.ts:46`, `:66-84` (the block written out) | `:67` `const stored = await app.db.read('rbac.getRoleMatrix', (pool) => readStoredMatrix(pool));` |

**What a reader of the log sees differently** (the helper's one line and one entry; decision D96 ruling 4):

| | Before | After |
|---|---|---|
| message | "the identity module could not read the database" / "the pairing module could not read the database" / "the role matrix could not be read" | "a read on the pool failed" |
| persistent entry | `{ level, source, message, errorName, code, … }` | the same plus `context: { database, generation }` |
| rbac line only | `request.log`, `{ code }` (with the request ID) | `app.log`, `{ err, source: 'rbac.getRoleMatrix' }` (no request ID; finding F-3) |

Unchanged: 503 `NOT_READY`, the fresh probe, an `ApiFailure` thrown by the work passes as it is, nothing of a statement in the log.

**Existing tests changed by design** (the text or the shape of that one line; not an import path):

| File:line (before) | Change |
|---|---|
| `src/modules/identity/__tests__/sessions.test.ts:86`, `:89` | the message text |
| `src/modules/identity/__tests__/sessions.test.ts:62` and a new helper `poolPluginDatabase` (17 lines) with 3 import lines | the harness's stand-in for `app.db` had no `read`. It is now the object the pool plugin itself builds over the stand-in pool (the plugin function called on a host that has what it asks for), so the three tests "a read that fails" keep every assertion and run the REAL helper (deviation DV-2) |
| `src/modules/identity/__tests__/static.test.ts:148` | "at least 4 log calls" is "at least 3": the module's own call is gone |
| `src/modules/pairing/__tests__/routes.test.ts:312`, `secrets.db.test.ts:318` | the message text |
| `src/modules/pairing/__tests__/static.test.ts:252` | the list of the module's log calls loses `database.ts` |
| `src/modules/rbac/__tests__/routes.test.ts:168`, `:169` | the message text; `{ level: 50, code: '42P01' }` is `{ level: 50, source: 'rbac.getRoleMatrix', err: { code: '42P01' } }` |

**Evidence.** Scratch unit 28 files / 425; `assets/04b_04_item4_scratch_db.log`: 8 files / 129 (among them `pairing/secrets.db.test.ts` with a real failing statement, `rbac/matrix.db.test.ts`, `authenticate.db.test.ts`).

### 2.4 Item 5 — one revoke function (decision D105; biometric row §9, applied as listed)

| Before | After |
|---|---|
| `src/modules/pairing/devices.ts:46` import of `revokeBiometricTokensOfDevice` from `./store` | `:36` `import { revokeBiometricTokens } from '../identity/biometric';` |
| `:132`, `:148` `revokeBiometricTokensOfDevice(unit, deviceId, now, '…')` | `:132` `await revokeBiometricTokens(unit, { scope: 'DEVICE', deviceId, reason: 'DEVICE_REVOKED' }, now);`, `:148` the same with `'DEVICE_UNPAIRED'` |
| `src/modules/pairing/store.ts:336-349` (`DeviceBiometricRevokeReason`, `REVOKE_BIOMETRIC_TOKENS_OF_DEVICE`, the function) | gone; `:336-340` a comment that names the one function |
| `src/modules/admin/changes.ts:52` import from `./statements` | `:42` `import { revokeBiometricTokens } from '../identity/biometric';` |
| `:160` `revokeBiometricTokens(unit, operatorId, now)` | `:160` `await revokeBiometricTokens(unit, { scope: 'OPERATOR', operatorId, reason: 'USER_DISABLED' }, now);` |
| `src/modules/admin/statements.ts:143-146`, `:163-165` (`REVOKE_BIOMETRIC_TOKENS`, its function) | gone; the header (`:9-14`) says who writes the table |

The statement that runs is now `REVOKE_TOKENS.DEVICE` / `REVOKE_TOKENS.OPERATOR` of `identity/biometric/store.ts:179-184`: the same predicate (`… AND used_at IS NULL AND revoked_at IS NULL RETURNING id`), the parameters in another order. One writer of every UPDATE of `biometric_tokens`.

**Import direction.** Two imports between modules: `pairing/devices.ts:36` → `identity/biometric`, `admin/changes.ts:42` → `identity/biometric`. Each use is inside a function of a unit of work. The cycle identity → biometric → pairing → identity (biometric row F-5) has one more edge; the modules were NOT restructured (section 5, B2-1).

**Existing tests changed** (§9 of the biometric row, and what follows from it):

| File:line (before) | Change |
|---|---|
| `src/modules/pairing/__tests__/static.test.ts:298`, `:331` | the statement's name leaves the list of the store's statements and the list of transitions |
| `src/modules/pairing/__tests__/sequence.db.test.ts:19` (+1 import), `:51-53` (the name table gains the biometric store), `:389`, `:402` | `'unit  REVOKE_BIOMETRIC_TOKENS_OF_DEVICE'` is `'unit  REVOKE_TOKENS.DEVICE'` |
| `src/modules/admin/__tests__/static.test.ts:235`, `:253`, `:260`, `:267`, `:289` | the name leaves the lists; `biometric_tokens` leaves the tables the module names; `:258` title |
| `src/modules/admin/__tests__/static.test.ts:350`, `:357` | rule 7 "no other module": the title and the import list gain `'../identity/biometric'` (deviation DV-3) |
| `src/modules/admin/__tests__/sequence.db.test.ts:17` (+1 import), `:50-52` (the name table gains the biometric store), `:218` | `'unit  admin REVOKE_BIOMETRIC_TOKENS'` is `'unit  biometric REVOKE_TOKENS.OPERATOR'` |

**New tests** (2): one `it` in each static test pins "no statement on `biometric_tokens` in the module; one import of that folder, of one name; the call(s) with the scope and the reason".

**Evidence.** `assets/04b_05_item5_scratch_db.log`: 21 files / 237 (the two sequence tests with the new names, `pairing/devices.db.test.ts`, `admin/status.db.test.ts`, `admin/failures.db.test.ts`, the biometric row's `revocation.db.test.ts`). Planted P-8 (an unpair that revokes with the reason of a revoke) and P-10 (a statement on `biometric_tokens` back in the administration module): detected.

### 2.5 Item 1 — the identity routes' duplicate checks (CPB1-17, D83 DN-8)

`src/modules/identity/routes.ts`:

| Before | After |
|---|---|
| `:57-61` local `routeOf` | `:62-66` `operationOf` (the registry entry); every route is `...routeOfOperation(operationOf('…'))` (`:84`, `:102`, `:113`, `:123`, `:137`), imported at `:48` from `plugins/permission-guard` |
| `:78-81` `operatorOnly` | gone |
| `:89-91` `onRequest` of `signIn` | gone |
| `:93` `requireConsoleIdentity(app, request)` in the handler | **stays** (`:90`): it returns the console |
| `:108` `refuseRetiredDevice(request)` in `getSignInStatus` | gone |
| `:119`, `:130`, `:145` `onRequest: operatorOnly` | gone |
| `:121`, `:132`, `:149` `operatorSessionOf(request)` | **stay** (`:116`, `:126`, `:142`): they return the session |
| `:16-20` header: "Each route here also carries its own `onRequest` hook …" (CPB1-25) | `:16-24`: who may call is stage 6, alone; why two handler calls remain |

`src/modules/health/index.ts`: before `:56-79` `.get(HEALTH_PATH, { config: { operationId }, schema }, handler)`; after `:60-65` the registry entry (`findCoreApiOperation`) and `.route({ ...routeOfOperation(operation), schema, handler })`.

**Proof that nothing was lost.**

1. *The guard's real-app test and the identity tests are green:* `src/plugins/permission-guard/__tests__/registered-routes.test.ts`, `src/modules/identity/__tests__/*` (scratch unit run of `src/modules/identity src/modules/health src/plugins test/static`: 47 files, 1,104 of 1,105; the one red was the test that pinned the hooks, below).
2. *The denials of operations 2 to 6 through the real stages, against PostgreSQL* (`assets/04b_01_item1_scratch_db_denials_real_stages.log`): `Test Files 11 passed (11)`, `Tests 208 passed (208)` — `permission-guard/__tests__/pipeline.db.test.ts` (the 40 cells of spec §14.2), `denial.db.test.ts`, `authenticate.db.test.ts`, the six database files of the identity core, `rbac/matrix.db.test.ts`.
3. *The hooks did hide a defect of stage 6* (`assets/04b_01_item1_mutation_stage6_hidden.log`; scratch copies only). Mutation M-1, "stage 6 lets every caller through", on the tree before item 1 and with item 1:

```
M-1 stage 6 allows every caller [before item 1: the route hooks in place]: Tests  7 passed (7);
M-1 stage 6 allows every caller [after item 1: no route hook]: × operations 4 to 6 without a session answer 401 NOT_SIGNED_IN, also with a body that breaks its schema or is no JSON; × signIn without a console identity answers 403 DEVICE_NOT_PAIRED, also with a body that is no JSON; Tests  2 failed | 5 passed (7);
```

**The ONE test for the shape.** The shape of a registered route (the registry's method and path, `config.operationId`) is already enforced at run time: the guard's `onRoute` hook resolves every route against the registry and `app.ready()` stops otherwise (`plugins/permission-guard/index.ts:235-242`, tested in its `boot-registry.test.ts`). What the guard cannot see is how the module wrote the route, so the new test is static: `test/static/routes.test.ts` (2 tests: a positive control, and the rule). For `src/modules/identity/routes.ts` (5 routes) and `src/modules/health/index.ts` (1 route): every `.route({` starts with `...routeOfOperation(`, the helper is imported from the guard, no method shorthand, no hook of the module's own, no method or path written by the module. Planted P-5 (the health route written by hand) and P-6 (a hook back on `getAuthSession`): detected.

**Existing test changed by design:** `src/modules/identity/__tests__/routes.test.ts:63` (title: "each route carries its own identity check in onRequest …" is "no route carries an identity check of its own in onRequest: who may call is stage 6, alone") and `:72-76` (the counts 1, 0, 1, 1, 1 are 0, 0, 0, 0, 0).

### 2.6 Item 6 — `signInWithBiometric` is activity-exempt; the list is typed (biometric row F-4, CPB1-18)

`src/plugins/authenticate/index.ts`: before `:153` `export const ACTIVITY_EXEMPT_OPERATIONS: readonly string[] = ['signIn', 'signOut'];` and `:265` `.includes(operationId)`. After `:150` `type RegistryOperationId = CoreApiOperationTable[number]['operationId'];`, `:161` `readonly RegistryOperationId[] = ['signIn', 'signOut', 'signInWithBiometric']`, `:164` a `ReadonlySet<string>` of it for the lookup, `:276` `ACTIVITY_EXEMPT.has(operationId)`. Only that list was typed.

This is the one intended behaviour change of the item: a biometric sign-in that presents a session no longer runs the unit `identity.touch` a moment before its own unit ends that session.

**Tests.** `src/plugins/authenticate/__tests__/authenticate.test.ts:425-426` (existing: the title, and the pinned list gains the third name). New test (+1) with a stand-in route for the operation: the request reaches its handler and `touch` is not called; the same session on a POST that is not exempt is activity. Mutations on the scratch copy (`assets/04b_06_item6_mutations.log`):

```
M-6a 'signInWithBiometric' taken out of the list: × a sign-in, by password or by biometric token, and a sign-out settle their session themselves; × a biometric sign-in that presents a session reaches its handler without a unit for the activity … ; AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times; Tests  2 failed | 40 passed (42)
M-6b a name that is no operation of the registry: src/plugins/authenticate/index.ts(161,97): error TS2820: Type '"signInWithBiometrics"' is not assignable to type '"scanCaseNumber" | … | "reportBiometricFailure"'. Did you mean '"signInWithBiometric"'?
```

`assets/04b_06_item6_scratch_db.log`: `src/plugins/authenticate src/modules/identity` (the biometric folder included) 16 files / 191: no sequence test pinned the removed unit.

### 2.7 Item 7 — the test block of D93: RETITLED, not deleted

`src/plugins/authenticate/__tests__/authenticate.db.test.ts:171-187` (now `:172-197`). No assertion changed; the titles, a comment block, one comment line and the name of a local (`unfilled` is `real`, 4 places) did; the file header `:5-6` too.

- **Before:** `describe('the seam deviceResolver while the pairing module has not filled it')` / `it('denies: a device credential and a device session resolve to nothing')`.
- **After:** `describe('the pairing module's own resolver behind the seam deviceResolver: a device row without its credential row')` / `it('is no device: a credential the registry does not store and an open session of that device resolve to nothing, and it cannot sign in')`.

**Why not deleted.** `modules/pairing/__tests__/devices.db.test.ts:611` ("a device row without its credential row is no device of the registry: it resolves to nothing") covers the RESOLVER's answer (`resolveDevice` is null). It does not cover what this block asserts: that stage 4 turns that answer into `ANONYMOUS` with `DEVICE_UNKNOWN` for a real, open session of that device, and that the device's sign-in is refused with 403 `DEVICE_NOT_PAIRED`. The unit test of that cell (`authenticate.test.ts:227`, C11) uses a stand-in resolver.

**What the block proves, shown** (`assets/04b_07_item7_mutation.log`; scratch copy only): with a `device_credentials` row inserted for the test's device before its session is presented, the block fails: `- "failure": "DEVICE_UNKNOWN"` / `+ "failure": null`, `- "kind": "ANONYMOUS"` / `+ "kind": "OPERATOR"`. So it passes because the device has no credential row (`FIND_DEVICE` joins `device_credentials`, `pairing/store.ts:267-269`), which is what the new title says.

### 2.8 Item 8 — the readiness plugin's log key (D96 ruling 2)

`src/plugins/readiness/index.ts`: before `:83`, `:85` `log.info({ reason, held: … }, 'readiness hold')`; after `:86`, `:88` `log.info({ hold: name, held: … }, 'readiness hold')` (the parameter is `name` now, `:64`, `:83`).

**Tests that read the key, updated:** `src/modules/demo/__tests__/reset.db.test.ts:121` and `routes.test.ts:441` (`line['reason']` is `line['hold']`). Round A found no reader at 15:50; the demo-control row landed after that and reads the two lines. No test of the readiness folder read them: one new test there pins the two lines (level, `hold`, `held`, the exact key set).

**The allow-list is empty.** It lives in `test/static/log-calls.test.ts` (`ALLOWED`), not in `log-calls.ts`: before `:43-45` one entry; after `const ALLOWED: readonly Allowed[] = [];`. The test at `:148-152` asserted "its foundation part is the one hold name"; it now asserts that the list is empty and that the two log calls of the plugin carry `hold` and `held`. Planted P-7 (the key `reason` back): 3 tests red.

### 2.9 Item 10 — stale comments (CPB1-25); CPB1-21 is in section 6

| Where | Before | After |
|---|---|---|
| `src/plugins/throttle/__tests__/throttle.test.ts:120` | "the scaffold's stub resolves nothing at all" | the real stage 4: a bearer value that has not the form of a credential resolves to nothing, without a lookup |
| `src/plugins/db/index.ts:9-10` | "the pool keeps no copy of it in its options" | the options hold no copy; each connected client of the driver stores what the function returned, as members that are not enumerable (`_getPassword` in `node_modules/pg/lib/client.js:272-286`; `connection-parameters.js:75`) |
| `src/modules/identity/routes.ts:16-20` | — | done with item 1 |

### 2.10 Item 9 — neutral test support (CPB1-12)

**The folder `apps/core-server/test/support/`** (10 files, 2,505 lines; none is a test file):

| File | From | What |
|---|---|---|
| `config.ts` | `src/plugins/config/__tests__/test-config.ts`, whole | `unitTestConfig`, `captureLog`, `createFakePool`, `credentialLeaks`, `CLOSED_PORT` |
| `core.ts` | `src/core/__tests__/support.ts` without `coreApp` | `standInDatabase`, `answersBootStepOne`, `BOOT_CHECKS`, `passedAmong`, `readTrail`, `readHead`, `readEvents`, `verifyTrail`, `linkProblems`, `recordingErrorLog`, `testLogger`, `sleep` |
| `seed.ts` | `src/db/seed/__tests__/support.ts`, whole | `createHost`, `dumpDatabase`, `tableChecksums`, `withoutNegativeZeros`, `asStored`, … |
| `engine.ts` | `src/engine/__tests__/support.ts` without 4 helpers | `manualTimer`, `countingPool`, `engineApp`, `storedSlices`, `tableCounts`, `countChanges`, `stateChanges`, `FIXED_NOW`, `TICK_MS` |
| `identity.ts` | `src/modules/identity/__tests__/support.ts`, whole | a signed-in operator of each role (`webSignIn`, `deviceSignIn`, `signInOnWeb`), `identityApp`, `bearer`, `cookieValue`, `deviceRegistryDouble`, `insertPairedDevice`, … |
| `scratch-routes.ts` | cut out of the guard's support | `passScratchRoutes` |
| `guard.ts` | `src/plugins/permission-guard/__tests__/support.ts`, the rest | `buildGuardApp`, `guardApp`, `webOperator`, `deviceOperator`, `outcome`, `registryRoutes`, `recordPassed`, … (re-exports `passScratchRoutes`) |
| `pairing.ts` | `src/modules/pairing/__tests__/support.ts`, whole | `pairDevice`, `pairingApp`, `redeem`, `portalPost`, `devicePost`, `deviceGet`, … |
| `reset.ts` | `src/db/reset/__tests__/support.ts`, whole | `maintenancePool`, `discard`, `dropOwn`, `contractChecksum`, `digestAll`, `dumpKept`, `chainFacts`, `lineageRows`, `untilNoSession`, … |
| `admin.ts` | 4 names of `src/modules/admin/__tests__/support.ts` | `USERS`, `roleUrl`, `enableUrl`, `disableUrl` |

**The old paths.** Each keeps what is private to its row and re-exports the moved names, so every existing import of it compiles unchanged:

| Old path | Now |
|---|---|
| `src/core/__tests__/support.ts` | `coreApp`, `CoreApp`, `CoreAppTarget` (private to the core's database tests) + `export * from` the neutral file |
| `src/engine/__tests__/support.ts` | `seedScenario`, `SeedTarget`, `meterFrames`, `applyChanges` (private to the engine's tests) + `export *` |
| `src/modules/admin/__tests__/support.ts` | everything but the 4 URL names, which it re-exports |
| `test-config.ts`, the seed's, the identity core's, the guard's, the pairing module's, the reset routine's `support.ts` | a shim of one `export *` (moved whole: deviation DV-6) |

**Imports of landed rows' tests.** 122 test files, 247 lines, each a change of the specifier of one import or re-export line and nothing else (checked line by line against the tree before the landing; 108 of the files changed in nothing else in the whole round, 14 were also changed by an earlier item; the full list `file:line 'old' -> 'new'` is `assets/04b_09_item9_import_lines_changed.txt`). Not touched: `src/realtime/**`, `test/acceptance/**`, `src/modules/sessions/**`, `src/db/fixtures/**` (in flight; they use the old paths).

**The cycle guard ↔ identity is gone.** Test-support import graph, the files other rows import:

```
BEFORE                                                   AFTER (test/support/)
plugins/permission-guard/__tests__/support.ts            guard.ts ─→ identity.ts, config.ts, scratch-routes.ts
   ─→ modules/identity/__tests__/support.ts  (:45-54)    identity.ts ─→ config.ts, scratch-routes.ts
modules/identity/__tests__/support.ts                    pairing.ts ─→ identity.ts
   ─→ plugins/permission-guard/__tests__/support.ts (:21) core.ts, engine.ts ─→ config.ts
        (for passScratchRoutes)            ← a cycle      scratch-routes.ts, config.ts, seed.ts, reset.ts, admin.ts ─→ production only
```

`passScratchRoutes` depends on the guard plugin alone and has a file of its own; `identity.ts` imports it there and no longer imports the guard's support. Three new tests in `test/static/imports.test.ts` keep it so: no file of `test/support/` imports a `__tests__` folder; the files of the folder import each other without a cycle (with a positive control); `guard.ts` → `identity.ts` exists and `identity.ts` → `guard.ts` does not. Planted P-4 (the old import back): detected.

**"No production file imports test code" covers `test/support/`:** rule 1 of `test/static/imports.test.ts` (any import of `__tests__`, of `test/`, of a test file; positive control with `'../../../test/support'`). Planted P-2: detected.

**One static test adapted:** `test/static/audit-protection.test.ts:42` allows `DROP DATABASE` under `src/db/reset/`, where the reset routine's test support was. The list gains the one file `test/support/reset.ts` (`:12` header, `:84` title). Found by the scratch whole `unit` run at 17:41:08, before the landing.

**Evidence.** Scratch: typecheck exit 0, lint without a warning; whole `unit` at 17:42:09 `Test Files 141 passed (141)`, `Tests 3606 passed (3606)` (`assets/04b_09_item9_scratch_unit_whole.log`); `db` for every folder whose support moved and for the in-flight users of the shims (`src/realtime/__tests__/first-contact.db.test.ts`, `test/acceptance`) at 17:42:46: `Test Files 52 passed (52)`, `Tests 676 passed (676)` (`assets/04b_09_item9_scratch_db.log`).

---

## 3. Verification

### 3.1 Whole projects, typecheck, lint (the tree, at the end)

```
$ npm run test -w @dems/core-server -- --maxWorkers=2                           (17:47:46)
 Test Files  141 passed (141)
      Tests  3609 passed (3609)
   Duration  26.43s                                                                          exit 0
$ DEMS_TEST_STEP=60b npm run test:db -w @dems/core-server -- --maxWorkers=2     (17:45:10 to 17:46:28)
[test:db] PostgreSQL 18.4 on 127.0.0.1:4432; helper role dems_owner, code under test dems_app; run prefix dems_test_step_60b_tmdpvajl_
 Test Files  108 passed (108)
      Tests  1540 passed | 1 skipped (1541)
   Duration  77.30s
[test:db] forced drops that needed a retry: 0
[test:db] teardown: dropped 8 database(s) in 216 ms; 0 remain with the run prefix dems_test_step_60b_tmdpvajl_   exit 0
$ npm run typecheck -w @dems/core-server                                         (17:48:18)   exit 0
$ npm run lint -w @dems/core-server                                              (17:48:18)   exit 0, no warning
```

The whole `db` project once more, after items 3 to 5 (17:24:46 to 17:27:58): `Test Files 108 passed (108)`, `Tests 1540 passed | 1 skipped (1541)`, exit 0; one forced drop needed a retry (an autovacuum worker, decision D76), 0 databases remained.

### 3.2 Failures of other rows (P11), each seen once, none at the end

| Time | Run | Red | Whose |
|---|---|---|---|
| 17:11:34 | whole `unit` after item 2 | `src/modules/sessions/__tests__/static.test.ts` "reads the six production sources of the module" (the list lacked `text-body.ts`) | the sessions follow-up, in flight; green from 17:15:53 |
| 17:20:12 | whole `unit` after item 4 | `src/db/fixtures/__tests__/audit-details.test.ts`, 3 tests | the fixture follow-up, in flight (its test and its reference file changed at that minute); green from 17:23:55 |

No red in a folder of this round in any run on the tree. On the scratch copy: typecheck showed `test/acceptance/restart.test.ts(1107,12) TS18048` at 17:14 (the acceptance test in flight, as copied at 17:12); gone at the next sync.

### 3.3 Mutations and planted violations (scratch copies only, rule M15)

| ID | What | Result |
|---|---|---|
| M-1 | stage 6 lets every caller through | hidden before item 1 (7 of 7 green), detected after (2 red) |
| M-6a, M-6b | the exemption removed; a name that is no operation | 2 tests red; a compile error |
| M-7 | the test's device gets a credential row | the retitled block red: it proves what its title says |
| P-1 to P-10 | ten planted violations of the new and changed static tests | 10 of 10 detected (`assets/04b_10_planted_static_violations.log`) |

### 3.4 Test ledger (P24)

| Project | Baseline (controller) | Measured at the end | This round | Others in flight |
|---|---|---|---|---|
| `unit` | 137 files / 3,536 (16:52; the same on the scratch copy at 17:04:35) | 141 / 3,609 | **+4 files, +25 tests** | +48 tests in existing files |
| `db` | 107 files / 1,522 + 1 skipped (16:57) | 108 / 1,540 + 1 skipped | **0 files, 0 tests** (one file moved) | +1 file (`src/realtime/__tests__/shutdown.db.test.ts`), +18 tests |

This round, `unit`: new files `test/static/imports.test.ts` (10), `test/static/routes.test.ts` (2), `src/db/store/__tests__/static.test.ts` (9), `src/core/__tests__/windows.test.ts` (7, moved from `windows-limits.test.ts`, which went from 35 to 28); in existing files +1 each in `pairing/__tests__/static.test.ts` (26 to 27), `admin/__tests__/static.test.ts` (31 to 32), `authenticate/__tests__/authenticate.test.ts` (41 to 42), `readiness/__tests__/readiness.test.ts` (29 to 30). No count dropped. **No test was deleted** (item 7 was retitled, so the exception the brief allows was not used).

---

## 4. Deviations, findings, decisions

### 4.1 Deviations from the brief

| ID | Deviation | Reason |
|---|---|---|
| DV-1 | Item 4 changes one log line and so 7 test lines that are neither an import path nor a title (section 2.3) | "Switch to `app.db.read`" replaces each module's own line by the helper's: another message, and for the RBAC route `err` and `source` in place of `code` and the request ID. Round A's S-1 and S-2 said so |
| DV-2 | The harness of `identity/__tests__/sessions.test.ts` builds its stand-in `app.db` with the pool plugin's own function (`poolPluginDatabase`, 17 lines of test code) | The plain stand-in had no `read`. The alternatives were a fourth copy of the block in a test, or dropping the assertions on the line, the entry and the probe. This keeps every assertion and tests the module against the real helper |
| DV-3 | Item 5 changed two lines of the administration row's static rule 7 ("no other module") beyond the lines the biometric row lists | The decision makes that module import `identity/biometric`; the rule's list and title say so now, and a new `it` pins that it is one import of one name |
| DV-4 | Item 6 changes behaviour (one unit of work less) and one pinned list | It is the item's own text |
| DV-5 | Item 8: two lines in `src/modules/demo/__tests__/` were changed, and the allow-list was emptied in `log-calls.test.ts`, not `log-calls.ts` | "Update the tests that read it": the readers are the demo row's tests. The list is in the test file |
| DV-6 | Item 9: six support files moved WHOLE (config, seed, identity, guard, pairing, reset); only core, engine and admin keep row-private helpers at the old path | In those six nearly every export is imported by another row, and what is not builds on what is (the guard's `buildGuardApp` needs its `registryRoutes` and `recordPassed`; the reset's `plantKeptRows` needs its fixtures). A split would have cut through working helpers for no importer's benefit. What only the own row uses in them: `standaloneOccurrences`, `durableKeys` (seed); `createLeftover`, `renameOwn`, `appendAuditRows`, `failAt`, `RECORDED_SESSION_ROWS` and the reset instants (reset); `operationOf`, `registryRoutes`, `channelRoute`, `recordPassed`, `MALFORMED_JSON` (guard) |
| DV-7 | Item 9: `test/static/audit-protection.test.ts` gained one allowed file | The reset support holds `DROP DATABASE` for databases of the test's own run; it was allowed by its folder |
| DV-8 | Item 10: `src/plugins/db/index.ts` (a comment) is outside the write list of the rules | The item names the file and the lines |
| DV-9 | The static rule for deep imports is a list of CLOSED units, not "every unit" | 35 imports by file name remain across units that have no index or are B2's (section 5); a rule for all would need them as exceptions, and would turn a row in flight red for a form the tree uses everywhere |
| DV-10 | Two whole `unit` runs on the scratch copy (the baseline at 17:04:35; with item 9 at 17:41 and 17:42) and `db` subsets on the scratch copy per item | Each landing was proven before it reached a tree that five other writers test against; item 9 alone is 143 files |
| DV-11 | A file that moved was landed as "the new path appears, the importers change, the old path leaves the tree", not as one `mv` | With a rename first, importers would have pointed at nothing for an instant. The two old files are kept (`…/scratchpad/cpb1b1/removed/` and the pre-images); no `rm` was used in the repository |
| DV-12 | `masterplan/02_plan.md`, `status_tasks.md`, `implementation/99_implementation_report.md` were not written | Parallel run: the controller writes them (P8) |
| DV-13 | **A rule of the brief was not kept to the letter:** a number of READ-ONLY inspection commands of this row (`grep`, `sed -n`, `wc`, `ls`) were written as `cd <workspace>/apps/core-server && …` | A slip of habit, noticed at the end. No test, typecheck, lint, npm, database or landing command ran from a subfolder: those ran from the workspace root (`npm run … -w @dems/core-server`) or named the scratch copy with `--root` / `-p`. Each command of this row starts in the workspace root again, so nothing carried over |

### 4.2 Findings

| ID | Finding | Evidence | For |
|---|---|---|---|
| F-1 | **Three more copies of the read block exist**, none in the brief's list of three: `src/modules/admin/index.ts:150-162` (`listUsers`; in this round's folders), `src/modules/evidence/index.ts:172-190`, `src/modules/sessions/history.ts:81-100`. The demo and the security-audit modules already use `app.db.read` | search at 17:50 | DN-2 |
| F-2 | The identity routes' hooks hid a stage 6 that allows everything from the module's HTTP tests | M-1, section 2.5 | closed |
| F-3 | `app.db.read` logs with the app's logger: its line has no request ID, and its entry no `context.requestId`. The RBAC route's line had both | section 2.3; round A S-2 | DN-3 |
| F-4 | The unit-level cycle {`modules/identity`, `modules/pairing`, `plugins/authenticate`, `plugins/permission-guard`} has the same four members as before; two file edges were added inside it: `identity/routes.ts:48` → the guard (item 1; `biometric/routes.ts:42` had the same edge), `pairing/devices.ts:36` → `identity/biometric` (item 5). Every use across it is inside a function; both whole projects load it in many orders | `assets/04b_b2_unit_cycles_{before,after}.txt` | B2-1 |
| F-5 | Round A's statement "no test reads the key `reason` of the hold lines" was true at 15:50 and not at 17:30: the demo row's tests read it | section 2.8 | record |
| F-6 | `test/support/reset.ts` is the one file under `test/support/` that may hold `DROP DATABASE`; the static guard names it | section 2.10 | W45 may want to know |
| F-7 | The guard row's own static rule "no production file imports from a `__tests__` folder" (`plugins/permission-guard/__tests__/static.test.ts:167`) is now also asserted server-wide, with `test/` included | `test/static/imports.test.ts` | B2: keep or drop |
| F-8 | `operationOf` (the lookup of a registry entry in `IDENTITY_OPERATIONS`) exists twice in one module: `identity/routes.ts:62-66`, `identity/biometric/routes.ts:54-58` | reading | B2, small |
| F-9 | Stale comments outside this round's write paths: `src/db/mapping/index.ts:12` ("`../seed/store.ts`"); `src/db/mapping/__tests__/changes.test.ts:7`, `round-trip.test.ts:7` (the old path of the write-through test); `src/plugins/origin-guard/__tests__/guard-test-app.ts:6-7` ("stage 4 is the scaffold's stub"); `src/db/schema/value-sets.ts:7` (CPB1-25, a test file that does not exist) | reading | owners |

### 4.3 Decisions for the controller

| ID | Question | Recommendation |
|---|---|---|
| DN-1 | The closed-unit list of `test/static/imports.test.ts` (DV-9) | Accept; B2 adds a unit to `CLOSED_UNITS` when it has cleaned it |
| DN-2 | F-1: the admin copy is in this round's folders but was not named | One follow-up of the same form as the RBAC change: `return { users: await app.db.read('admin.listUsers', (pool) => listUsers(onPool(pool))) };`, and `admin/__tests__/routes.test.ts:281`, `:286` (the message; `code` under `err`). Evidence and sessions by their owners |
| DN-3 | F-3: a request ID on the helper's line | If wanted: an optional third argument of `read` (a context object) in `plugins/db`; one line per caller |
| DN-4 | CPB1-21 (section 6) | Reword NL-6 to "an explicit column list that leaves out the hash columns" |
| DN-5 | DV-6: whole-file moves | Accept. The shims of the guard's and the reset routine's support have no importer and can go at once (section 5) |
| DN-6 | Item 7: retitled | Record as closed for D93 |
| DN-7 | DV-2: the harness that runs the pool plugin's function on a minimal host | Accept, or let B2 export a small factory of `read` from `plugins/db` that a database-free test can call |

---

## 5. For fix round B2, with exact lines

**B2-1. Imports between plugins and modules (CPB1-10), value imports only** (`assets/04b_b2_unit_cycles_after.txt`):

```
modules/identity -> modules/pairing          biometric/sign-in.ts:67
modules/identity -> plugins/authenticate     routes.ts:47; sign-in.ts:43; biometric/routes.ts:41; biometric/enrolment.ts:34; biometric/sign-in.ts:65
modules/identity -> plugins/permission-guard routes.ts:48; biometric/routes.ts:42
modules/pairing -> modules/identity          routes.ts:57; devices.ts:35; devices.ts:36; index.ts:48; redeem.ts:51
modules/pairing -> plugins/authenticate      routes.ts:54; redeem.ts:49
modules/pairing -> plugins/permission-guard  routes.ts:56
plugins/authenticate -> modules/identity     index.ts:59
plugins/permission-guard -> modules/identity denial.ts:30; index.ts:72
plugins/permission-guard -> plugins/authenticate denial.ts:31
```

Outside the cycle, a module importing a module beside the seams: `modules/admin/changes.ts:42` → `identity/biometric` (D105).

**B2-2. Imports by file name across units that the static test does not yet forbid** (`assets/04b_b2_deep_imports_after.txt`, 35 lines). By target: `plugins/authenticate/index.ts:59`, `:60` → `modules/identity/{limits,sessions}`; `db/seed/seed.ts:44`, `db/fixtures/identity.ts:46` → `modules/identity/password-hash`; `pairing/devices.ts:36`, `admin/changes.ts:42` → `modules/identity/biometric`; `core/boot-checks.ts:36`, `core/payload-rules.ts:41`, `db/reset/routine.ts:65-66`, `modules/demo/host.ts:33`, `modules/security-audit/stored-chain.ts:58`, four files of `modules/identity` (types) and others → `db/schema/{boot-checks,value-sets,meta}`; the owner programs → `db/commands/*` (no index).

**B2-3. Shims, and when each can go:**

| Shim | Importers in the tree at 17:48 | Can go |
|---|---|---|
| `src/db/seed/store.ts` (`export * from '../store'`) | 0 | now. Then `src/db/mapping/__tests__/static.test.ts:102` loses `'seed/store.ts'`, and `src/db/store/__tests__/static.test.ts` its shim test and the entry `'src/db/seed/store.ts'` of its importer list |
| the store's names in `src/db/seed/index.ts:31-47` | `src/db/fixtures/__tests__/bulk-fixture.db.test.ts:23`, `src/db/fixtures/__tests__/support.ts:8` | when the fixture follow-up has landed: two import lines to `'../../store'` |
| `src/plugins/permission-guard/__tests__/support.ts` | 0 | now |
| `src/db/reset/__tests__/support.ts` | 0 | now |
| `src/plugins/config/__tests__/test-config.ts` | 6: fixtures 1, sessions 2, realtime 2, acceptance 1 | when those four have landed |
| `src/db/seed/__tests__/support.ts` | 10: fixtures 1, sessions 6, realtime 2, acceptance 1 | the same |
| `src/modules/identity/__tests__/support.ts` | 7: sessions 2, realtime 4, acceptance 1 | the same |
| `src/modules/pairing/__tests__/support.ts` | 5: realtime 4, acceptance 1 | the same |
| `export *` in `src/core/__tests__/support.ts` | 18: its own folder 12 (they also use `coreApp`), sessions 5, acceptance 1 | never as a file (it keeps `coreApp`); the re-export when sessions and acceptance import `test/support/core` |
| `export *` in `src/engine/__tests__/support.ts` | 12: its own folder 6, sessions 4, realtime 1, acceptance 1 | the same |
| the 4 names re-exported by `src/modules/admin/__tests__/support.ts` | realtime 1, acceptance 1 (its own folder uses them through the file) | when those two import `test/support/admin` |

The switch for a file in flight is the same mechanical rewrite (`assets/04b_tool_rewrite_imports.py.txt`): the specifier of an import line.

**B2-4. Left as they are, noticed here** (not started): `app.ts` and `stages.replace` (CPB1-5; `identity/__tests__/tokens-cookie.test.ts:78`, `authenticate.test.ts:139`, `readiness.test.ts:21`, `:83` still replace the access rule); `ApiFailure.code` (CPB1-9); round A's S-4 (the cause-walking copies: `src/db/store/store.ts:70-83` is the store's, at its new path), S-5, S-7; F-1, F-7, F-8, F-9 above.

---

## 6. CPB1-21 — the public column sets, for the contract close-out

`src/db/schema/public-columns.ts` exports five sets for the query builder (`db.select(set)`); only `test/db/contract-inventory.test.ts:185-189` uses them. No statement was changed. Every module statement is a constant SQL text with its columns written out (each module's static test keeps the hash columns out of every `SELECT` and `RETURNING`). The statements that read a row of one of the five tables for an answer, and so COULD take a set if they were written with the query builder:

| Set | Statements |
|---|---|
| `authSessionPublicColumns` | `FIND_SESSION_BY_TRANSPORT.COOKIE` / `.BEARER`, `READ_SESSION_STATE` (`identity/session-store.ts:270`) |
| `operatorPublicColumns` | `MARK_SIGNED_IN` (`session-store.ts:339`, RETURNING the profile); `LIST_USERS`, `READ_USER` (`admin/statements.ts:75`, `:77`, through `USER_COLUMNS`) |
| `pairingCodePublicColumns` | `READ_ACTIVE_CODE` (`pairing/store.ts:92`) |
| `pairedDevicePublicColumns` | `READ_REGISTRY`, `READ_REGISTRY_DEVICE`, `READ_REGISTRATION` (`pairing/store.ts:438`), `FIND_DEVICE` (`:267`) |
| `biometricTokenPublicColumns` | `READ_TOKEN_STATE` (`identity/biometric/store.ts:112`) |

Not candidates: `CONSUME_REDEEM_ATTEMPT` (`pairing/store.ts:163`) returns `code_hash` on purpose, for the comparison inside its unit; `FIND_SIGN_IN_CANDIDATE` (`session-store.ts:304`) reads the hash set for the hash wrapper. **Recommendation:** reword NL-6 rather than rewrite the statements: a set of the query builder cannot be put into a constant text without building the text from values, which SR-67 and every module's static rule forbid.

---

## 7. How it was applied, end state, rollback

**Applied atomically, one item at a time.** Each item was developed and proven on a copy outside the repository (`$TMPDIR/…/scratchpad/cpb1b1/tree`, with links to `node_modules`, `packages`, `docs`, and to `.data/` for the database runs; the link was removed at 17:48). Before each landing `tools/sync.py` brought the other writers' changes into the copy and reported conflicts (none in the whole round); `land.sh` then checked that every target was still what this round last knew, copied the files beside their targets under a name no tool reads, and renamed them within one second, new paths before their importers and old paths last (`assets/04b_land.sh.txt`, `04b_landed_lists.txt`). After every landing the tree equalled the scratch copy for the landed files and no temporary file was left.

**End state (17:48:42).** PostgreSQL 18.4 on 127.0.0.1:4432, PID 19121, postmaster started 07:14:26, never stopped. Databases with the prefix `dems_test_step_60b_`: 0 (read from the catalog through the helper's owner session, `assets/04b_99_own_databases.log`). No process of this row is running (a `test:db` run of another row was, at that moment); no port was bound; `dems_demo` and the lanes were not touched; no credential file was printed or copied.

**Files (181 paths in `apps/core-server`; the list is `.cache/rollback/CPB1b1.landed.txt`, the diff of the 69 that changed in more than an import specifier is `assets/04b_changes.diff.txt`).**

- New (19): `src/core/windows.ts`, `src/core/__tests__/windows.test.ts`; `src/db/store/{index,store}.ts`, `src/db/store/__tests__/{static.test,write-through.db.test}.ts`; `test/static/{imports.ts,imports.test.ts,routes.test.ts}`; `test/support/{admin,config,core,engine,guard,identity,pairing,reset,scratch-routes,seed}.ts`.
- Removed (2, both moved): `src/plugins/throttle/windows.ts`, `src/db/seed/__tests__/write-through.db.test.ts`.
- Changed, production (24): `src/core/index.ts`; `src/plugins/throttle/{index,denial-budget}.ts`; `src/plugins/authenticate/index.ts`; `src/plugins/readiness/index.ts`; `src/plugins/db/index.ts` (a comment); `src/modules/identity/{lockout,routes,sessions}.ts`; `src/modules/pairing/{redeem-lock,database,devices,store}.ts`; `src/modules/admin/{changes,statements}.ts`; `src/modules/rbac/index.ts`; `src/modules/health/index.ts`; `src/db/seed/{index,seed,store}.ts`; import lines only: `src/db/reset/routine.ts`, `src/db/fixtures/load.ts`, `src/engine/{rehydrate,write-plan}.ts`.
- Changed, test support (9): the old paths of section 2.10.
- Changed, tests (129): 21 files with more than an import specifier (named in section 2), 108 files in import specifiers only.

Not written: `app.ts`, `index.ts`, `config.ts`; production code of `src/modules/{sessions,evidence,devices,storage,network-time,security-audit,system,alerts,demo}/`; `src/realtime/**`; `test/acceptance/**`; `src/db/{mapping,schema,commands}/**`; `src/plugins/{permission-guard,origin-guard,logger,error-envelope,response-headers,config}/` production files; `packages/shared`.

**Rollback (not executed).** `apps/core-server/` is untracked, so the pre-images are file copies (P23): `.cache/rollback/CPB1b1/` holds `src/`, `test/` and the four configuration files as they were at 17:04:21, with `.cache/rollback/CPB1b1.pre.sha256`; `.cache/rollback/CPB1b1.post.sha256` holds the hashes of the 181 paths as landed; `.cache/rollback/CPB1b1.new.txt` lists the 19 new files.

The whole round:

1. Check that the 181 paths still have the hashes of `CPB1b1.post.sha256` (a later writer may have changed one: merge that file by hand).
2. For each of the 162 changed paths: `cp -p .cache/rollback/CPB1b1/<path> apps/core-server/<path>`.
3. Bring the two moved files back: `cp -p .cache/rollback/CPB1b1/src/plugins/throttle/windows.ts` and `…/src/db/seed/__tests__/write-through.db.test.ts` to their old paths.
4. Remove the 19 new files.
5. A file of another row that was written after this round and imports `test/support/…`, `src/db/store` or the core's `createFixedWindows` must be changed back first.

One item alone, in reverse landing order (9, 10, 8, 7, 6, 1, 5, 4, 3, 2): its paths are in `assets/04b_landed_lists.txt`. 23 files were written by more than one item (item 9 rewrote import specifiers in test files that items 1, 3, 4, 5, 6, 7, 8 and 10 had changed; `pairing/__tests__/static.test.ts` by items 4 and 5; `test/static/imports.test.ts` by items 2, 3 and 9), so a single item is rolled back by reverting its hunks of `assets/04b_changes.diff.txt`, not by copying the pre-image. Items 6, 7, 8 and 10 share no production file with another item.
