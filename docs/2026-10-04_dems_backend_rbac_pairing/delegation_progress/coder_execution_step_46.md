---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: coder-execution (tier R)
blueprint_row: 46 (plan W24, identity core)
date: 2026-10-04
status: complete
evidence_tier: 3
---

# coder-execution progress: step 46 (W24, identity core)

Status: **complete** (12:52). Every check of the row is met at the final runs: the row command
exits 0 with 93 tests in 8 files, the whole `unit` project (70 files, 1,847 tests) and the whole
`db` project (45 files, 623 tests) exit 0, typecheck and lint exit 0 with no warning, no database
with this row's prefix remains, and `.locks/postgres.pid` is 19121 as before.

Full record: `implementation/24_identity_core.md`. All times WIB. No credential, token, hash or
password is in this file.

## What exists now

- Stage 4 `authenticate` (HB-5), complete for both credential kinds: at most one credential per
  request, resolved before the throttle; the cookie resolves only a session without a device, a
  bearer value only a session with a device; this instance's cookie AND an `Authorization` header
  answer 401 `NOT_SIGNED_IN` with `details.reason: CREDENTIAL_CONFLICT`.
- Server-side sessions in `auth_sessions`: 256-bit tokens from the platform's CSPRNG, only their
  SHA-256 stored; idle limit 15 min, absolute limit 8 h, by `app.clock`; ended by compare-and-set
  statements; activity by a `preHandler` hook for every POST of an operator.
- The cookie `dems_session_<listen port>` with exactly `HttpOnly; SameSite=Strict; Path=/`.
- The console lockout on `rate-limiter-flexible`: 5 attempts per 300 s, 60 s lock, the attempt
  taken before the verification; Argon2id always runs for a verified attempt.
- The sweeper (5 s; started in `onListen`, stopped in `preClose`).
- Operations 2 to 6: `signIn`, `getSignInStatus`, `getAuthSession`, `signOut`, `touchSession`.

## Verification (runner output quoted in `24_identity_core.md`, section 11)

| Check | Result | Time |
|---|---|---|
| `DEMS_TEST_STEP=46 npm run test:db -w @dems/core-server -- src/modules/identity src/plugins/authenticate` | exit 0: 8 files, 93 tests; "0 remain with the run prefix dems_test_step_46_tmdc2ce2_" | 12:47:00 |
| Whole `unit` project | exit 0: 70 files, 1,847 tests | 12:46:33 |
| Whole `db` project | exit 0: 45 files, 623 tests | 12:47:05 |
| `npm run typecheck -w @dems/core-server` | exit 0 | 12:46:44 |
| `npm run lint -w @dems/core-server` | exit 0, no warning | 12:46:47 |
| MODG: route list equals registry operations 2 to 6 | equal; both lists quoted | section 11.3 |
| Mutation check | 68 planted defects, 68 detected | 12:07 to 12:18 |
| Databases with this row's prefix | 0 | 12:48:03 |
| `.locks/postgres.pid` | 19121, postmaster start 07:14:26, unchanged | 12:48:03 |

Runs that were red and not this row's (P11), all recorded in section 11.7:

- 11:39:36, `unit`: 2 tests of `src/core/__tests__/core-plugin.test.ts` (the engine row in flight).
- 11:42:12, `unit`: the engine row's own two stub assertions in `readiness.test.ts`.
- 12:01:13, typecheck: `src/engine/__tests__/commands.db.test.ts(540,68)` (the engine row in flight).
- 12:33:03, 12:34:17, 12:34:56, `db`: `src/db/reset/__tests__/reset-failures.db.test.ts`, one or
  two tests per run and not the same ones, always the assertion at its line 100. Green at
  12:19:04 and again at 12:47:05, when no other database run was in flight (finding F-20).

## Milestones

| Time | Milestone |
|---|---|
| 11:19 | Baselines: `unit` 41 files / 1,281 tests, `db` 28 files / 388 tests; pre-images saved under `.cache/rollback/W24.*` |
| 11:39 | Production files in place; whole `unit` run shows the four by-design reds in the request-guards row's test and this row's own stub assertion |
| 11:40 | Question to the controller about `origin-guard.test.ts`, with a proof on a scratch copy (151 / 151) |
| 11:41 | D52: this row's two stub assertions deleted from `readiness.test.ts` |
| 11:42 | Ruling D72 applied: two lines inserted in `origin-guard.test.ts` |
| 11:4x | Note D69 (what the mobile app sends) worked in: own-cookie-name rule, no `Set-Cookie` to a device, tests for each point |
| 12:07 to 12:18 | Mutation check: 62 of 64, two tests strengthened, a fail-closed line and a test file added; then 68 of 68 |
| 12:19 | Whole `db` project green: 44 files, 616 tests |
| 12:21 | One leftover template database of the scratch mutation runner removed with the helper's guarded drop |
| 12:32 to 12:36 | Runs after the last edits; the reset row's red file found and re-run |
| 12:44 to 12:46 | Note D77 applied: the emptied test removed from `readiness.test.ts`; the engine test of this row on a manual timer |
| 12:46 to 12:48 | Final runs, all exit 0; end state checked |
| 12:52 | Documents written; scratch files removed |

## Files created

Production, under `apps/core-server/src/`:

- `plugins/authenticate/credentials.ts`
- `modules/identity/activity.ts`, `console.ts`, `cookie.ts`, `limits.ts`, `lockout.ts`,
  `routes.ts`, `session-store.ts`, `sessions.ts`, `sign-in.ts`, `sweeper.ts`, `tokens.ts`

Tests, under `apps/core-server/src/`:

- `plugins/authenticate/__tests__/credentials.test.ts`, `authenticate.test.ts`,
  `authenticate.db.test.ts`
- `modules/identity/__tests__/lockout.test.ts`, `tokens-cookie.test.ts`, `sessions.test.ts`,
  `sweeper.test.ts`, `routes.test.ts`, `static.test.ts`, `sign-in.db.test.ts`,
  `sessions.db.test.ts`, `concurrency.db.test.ts`, `sequence.db.test.ts`, `secrets.db.test.ts`,
  `two-instances.db.test.ts`, `engine.db.test.ts`, and the test support `support.ts`

Documents, under `docs/2026-10-04_dems_backend_rbac_pairing/`:

- `implementation/24_identity_core.md`
- `implementation/assets/24_mutations.log`, `24_mutations.json`,
  `24_mutation_harness.vitest.config.mjs.txt`, `24_mutation_harness.run.sh.txt`,
  `24_test_db_verbose.txt`, `24_test_unit_verbose.txt`
- `delegation_progress/coder_execution_step_46.md` (this file)

Git-ignored pre-images: `.cache/rollback/W24.pre.patch` (empty: everything is untracked),
`W24.authenticate-index.ts.pre`, `W24.identity-index.ts.pre`, `W24.readiness.test.ts.pre`,
`W24.readiness.test.ts.pre-d77`, `W24.origin-guard.test.ts.pre`.

## Files updated

- `apps/core-server/src/plugins/authenticate/index.ts` (the scaffold's stub replaced; `Principal`,
  `ANONYMOUS_PRINCIPAL` and `authenticatePlugin` keep their names and shapes)
- `apps/core-server/src/modules/identity/index.ts` (the scaffold's stub replaced; `identityModule`
  and `SessionRegistry` keep their names)
- `apps/core-server/src/plugins/readiness/__tests__/readiness.test.ts` (changes 1 and 3 below)
- `apps/core-server/src/plugins/origin-guard/__tests__/origin-guard.test.ts` (change 2 below)

## Existing tests changed by design

1. `apps/core-server/src/plugins/readiness/__tests__/readiness.test.ts` (standing rule of D52,
   11:41). Deleted, nothing else: lines 252 and 253 of the file as it was (SHA-256 `b2771daf…`),
   the two assertions `expect(() => app.sessionRegistry.endForOperator(…)).toThrow('plan row W24')`
   and `expect(() => app.sessionRegistry.endForDevice(…)).toThrow('plan row W24')`. Reason: the
   seam is filled.
2. `apps/core-server/src/plugins/origin-guard/__tests__/origin-guard.test.ts` (ruling D72, 11:42).
   Inserted, nothing else, the line `app.stages.replace('authenticate', () => {});` twice:
   - after line 343 of the file as it was (`app.stages.replace('throttle', () => {});`, followed
     by `});`), in the `beforeAll` of "stage 3 alone, with the scaffold's stub at stage 4"; it is
     line 344 now;
   - after line 470 of the file as it was (the same `throttle` line, followed by
     `return { app, seen };`), in `factsApp()` of "the seam originDecision"; it is line 472 now.
   Before: 645 lines, SHA-256 `69ea6bb6…`. After: 647 lines, `bd01543e…`. Reason: four tests of
   those two blocks pinned the stub of stage 4 and sent this instance's cookie together with a
   bearer value, which the real stage refuses with 401 `CREDENTIAL_CONFLICT`. The file passes
   151 / 151 (12:32:34, and in the whole run of 12:46:33).
3. `apps/core-server/src/plugins/readiness/__tests__/readiness.test.ts`, a second time (note D77,
   point 1, 12:44). Deleted, nothing else: lines 247 to 253 of the file as it was (SHA-256
   `bce1fa68…`, 354 lines): the two comment lines "Standing rule (decision D52) …", the test
   `it('the stubs that are not implemented say which row fills them', …)` with its two unused
   locals and no assertion, and the blank line after it. After: `5906d754…`, 347 lines. Reason:
   the test named only stubs that throw with their row (`originDecision` W23, `sessionRegistry`
   W24, `engine` W26), all three are filled, and the stubs that remain (`deviceResolver` W32,
   `publish` W42) do not throw and are asserted by the test above it, "the seams that answer as
   they are …" (lines 236 to 245). Lint: no warning left.

Which tests of this row cover what the cells of change 2 covered, through the REAL stage 4
(condition 2 of D72), for the three request shapes "no Origin, GET", "a web console origin, GET"
and "a web console origin, POST":

- `plugins/authenticate/__tests__/authenticate.test.ts`, block "ID-12: this instance's cookie AND
  an Authorization header (D72: through the real stage 4)": the three tests named after the three
  shapes, each "401 NOT_SIGNED_IN with details.reason CREDENTIAL_CONFLICT; nothing is resolved,
  no row, no place in the denial budget, no Set-Cookie"; and "the conflict is by presence …",
  "it comes before the throttle … and before the body is read", "one log line names the reason …".
- `plugins/authenticate/__tests__/authenticate.db.test.ts`, block "ID-12 through the real stage 4
  (decision D72): this instance's cookie AND a bearer value": "answers 401 CREDENTIAL_CONFLICT on
  every request shape; no audit row, no place in the denial budget, no Set-Cookie, and both
  sessions stay as they are", against real sessions of both kinds.

## Note D77 (the engine host has landed): the three points

1. The emptied test: deleted, change 3 above.
2. The one database test of this row that boots the engine,
   `modules/identity/__tests__/engine.db.test.ts`, now calls
   `engineControl(app).useTimer(manualTimer().timer)` before `app.readiness.boot()`, takes the
   length of the trail after the boot, asserts its three rows relative to that, then fires one
   tick and verifies the chain again. Three runs: 3 / 3 each. No other test of this row boots
   the engine.
3. Sign-in, sign-out and the engine's `operators` slice: **the specification asks for no
   publication of the slice for operations 2 to 6**, and this module does not call
   `app.engine.mirrorOperators()`. The slice is `SimOperator` (`id`, `username`, `rank`, `name`,
   `displayName`, `initials`, `role`); the only operator columns this row writes are
   `last_sign_in_at` and `updated_at`, at a successful sign-in; spec §4.7 names the mirror for
   `assignUserRole` only, asks for `session.ended` at a sign-out and an expiry (published here
   after the commit) and has no row for a sign-in; `lastSignInAt` is a member of `AdminUser`,
   read through REST.

## The resolver for the realtime row (note D69)

`authenticationOf(request: FastifyRequest): Authentication`, exported by
`apps/core-server/src/plugins/authenticate/index.ts`:

```ts
interface Authentication {
  readonly presented: 'NONE' | 'COOKIE' | 'BEARER';
  readonly failure: 'MALFORMED' | 'UNKNOWN' | 'ENDED' | 'OPERATOR_DISABLED' | 'DEVICE_UNKNOWN' | 'DEVICE_RETIRED' | null;
  readonly session: OpenSession | null;
}
```

It reads what stage 4 decided for this request; it resolves nothing a second time, and so applies
the same rule: only `app.config.sessionCookieName` is a credential. The upgrade request passes
the stages like any request; two credentials are answered with HTTP 401 at the handshake.

## The seam for the pairing row

`app.deviceResolver` (the scaffold's `DeviceResolver`: `resolveCredential(credential)` and
`resolveDevice(deviceId)`, each `Promise<{ status: 'PAIRED' | 'RETIRED'; deviceId } | null>`).
Default while unfilled: null for everything, which stage 4 reads as **deny** (tested).

## Blockers

None.

## Findings (numbers of `24_identity_core.md`, section 17)

- F-2: the lockout window is fixed (as the throttle's), the simulator's is rolling.
- F-3: a burst above the denial budget decides by arrival which refusals are audited; verified
  failures may answer 429 without an `AUTH_FAILED` row. For the security review.
- F-4: the brief says the derivation runs for a "locked account" too; the specification (ID-5,
  AC-B-80) says attempts during the lock are not verified. Built as the specification says.
- F-5: 403 `DEVICE_REVOKED` on the PUBLIC operations 2 and 3 is answered by this module without
  an audit row until the guard row decides who audits it.
- F-6: the biometric row needs one registration line in `modules/identity/index.ts`.
- F-7: the three POST answers read `app.engine.epoch` and `.revision`: a dependency on the
  engine row's seam.
- F-8: the emptied stub test in `readiness.test.ts`: closed under D77.
- F-9: `lockout.ts:40` imports the window helper from `plugins/throttle/windows.ts` directly.
- F-11: one leftover template database of the scratch mutation runner, removed.
- F-13: an attempt whose derivation fails with a server error keeps its taken attempt and writes
  no audit row.
- F-15: the sweeper's timer was not run on a listening server (this row binds no port).
- F-20: `src/db/reset/__tests__/reset-failures.db.test.ts` of the database-reset row is red
  while other database runs are in flight or the load is high (three red runs, two green ones).

## Deviations

- DV-1: no derivation during the lock (F-4).
- DV-2: other rows' test files changed beyond rule 1 of the brief: two lines in
  `origin-guard.test.ts` (D72), the emptied test in `readiness.test.ts` (D77).
- DV-3: `masterplan/02_plan.md`, `status_tasks.md` and
  `implementation/99_implementation_report.md` not written (parallel run).
- DV-5: `SessionRegistry` has `resolve`, `touch`, `endBiometricSessions` and `sweep` beyond the
  scaffold's sketch; the `reason` parameters are narrowed to the allowed values.
- DV-6: a `preHandler` hook of the `authenticate` plugin for activity.
- DV-7: route-level `onRequest` identity checks on operations 2, 4, 5 and 6.
- DV-8: the API-7 headers of the three POSTs are set by this module from the engine seam.

## Decisions for the controller to record (section 19 of the document)

DN-1 fixed lockout window; DN-2 the lock starts when the fifth attempt is taken; DN-3 the locking
failure answers 423; DN-4 no derivation during the lock, and the brief's wording; DN-5 events
beside the five audit rows; DN-6 one registration line for the biometric row; DN-7 a sign-in that
presents a device session token; DN-8 who sets the API-7 headers of server-native POSTs; DN-9 who
answers and audits 403 `DEVICE_REVOKED` on PUBLIC operations; DN-10 the empty stub test (done
under D77); DN-11 re-export of the window helper; DN-12 F-3 to the security review; DN-13 and
DN-14 what to pass to the later rows; DN-15 the reset row's test that is red under parallel runs;
DN-16 no `mirrorOperators()` call in this module.
