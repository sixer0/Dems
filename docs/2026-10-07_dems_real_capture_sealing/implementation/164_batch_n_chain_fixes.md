---
task_id: 2026-10-07_dems_real_capture_sealing
task_slug: dems_real_capture_sealing
date: 2026-10-11
agent: coder-execution (batch N driver)
base_commit: 713d83f
decision: D241
status: complete (two points need the controller's ruling: section 11)
---

# 164 — Batch N: the small, clear fixes of the final chain

One driver, on `713d83f`. No commit, no install, no dev lane, no device, no browser. No
LOCAL_DEVICE source was selected, pre-checked or started. `.data/pg*.env` was not read.
Contract totals did not move: 97 operations / 36 GET / 61 POST / 67 audit types; schema 6 / dbc-7.
The exact names, examples and errata sentences for the docs agent are in
`delegation_progress/contract_batch_n.md` (sections 1 to 3).

Every test went INTO an existing test file. One new source module (`@dems/shared/evidence-rules`)
has its tests in the shared package's existing `test/evidence-verify.test.ts`, as briefed. Two new
script files (`scripts/test/*.sh`) are not tests.

## 1. S99-01 (HIGH) — the published demo password is refused in production

- **Cause.** `apps/core-server/src/db/seed/seed.ts:239` derives every operator's hash from
  `DEMO_OPERATOR_PASSWORD` (`packages/shared/src/sim/dataset.ts:153`) in every capture operation;
  the boot checks (`capture/boot/checks.ts`) asked nothing about operators.
- **Change.** `capture/boot/checks.ts:410` — check **4c**, `REAL_PRODUCTION` only, after the signing
  key checks and BEFORE the worker is started: `deps.demoPasswordOperators()` returns a count or
  null. Count > 0: refusal `CAPTURE_DEMO_OPERATOR_PASSWORD_IN_PRODUCTION` (`checks.ts:73`), reason
  `operators=<n>`, log / error-log context `{ code, operation, reason, operators: n }`. Null, a
  throw or a non-count: the same code, reason `OPERATORS_UNREADABLE` (fail closed).
  `capture/boot/index.ts:183` `storedDemoPasswordOperators`: one read of the stored hash sets on the
  pool (`capture.boot.operators`), each verified with the product's verifier (`verifyPassword` of
  `modules/identity/password-hash`; the hashes are salted, nothing is compared as text), one after
  another. It returns the count only; its errors are not passed on. Wired at `index.ts:225`
  (`CaptureBootMount.demoPasswordOperators` is the test seam). `SIMULATED` and `REAL_DEVELOPMENT`
  never ask.
- **Static guard.** `capture/__tests__/static.test.ts`, rule G-R16 "the boot checks take the
  decision of the one function ...": the list of calls that must stand after the fence's refusal
  now holds `deps.signingKeyIsDevelopment()` and `await deps.demoPasswordOperators()`; both
  production refusals are pinned as "asked in REAL_PRODUCTION only, before the handshake"; the
  constant is NAMED by one file of the capture folder (`boot/index.ts`, import + the verifier
  call) and its value is in no file of the folder.
- **Tests (existing files).** `capture/boot/__tests__/checks.test.ts` (3 tests),
  `capture/boot/__tests__/boot.test.ts` (4 tests: the default counter on REAL hash sets derived by
  the product hasher — 2 of 3; fail closed; the mounted step with a marker that proves the worker
  was never started; nothing replaced and no database = `OPERATORS_UNREADABLE`), and on the BOOTED
  path `modules/devices/__tests__/source-class.db.test.ts:194` (real app factory, PostgreSQL as
  `dems_app`, the default counter: a production Core on the seed's operators does not boot,
  `operators=3`).
- **Red first.** `checks.test.ts` before the change: `62 tests | 3 failed` (the three S99-01
  tests). On the booted path the red was the product's own: the first whole db run failed 2
  EXISTING tests of `source-class.db.test.ts` with `CaptureBootError ... reason: 'operators=3'` —
  a production Core on a seeded database, which those tests booted. They now give every operator a
  credential of their own first (`ownCredentials`, the product hasher) and are the control.
- **Clients.** Not changed. `demoControls` reaches a client in the SIGN-IN answer only
  (`packages/shared/src/api/identity.ts:159`); the health answer states no capture operation. No
  Core-stated fact exists for a signed-out client, so both login cards still print the password
  (`auth-card.tsx:499`, `login-card.tsx:549,567`). Stating the capture operation is R101-01 (next task).
- **Not done.** S99-01 (b) `db:seed` / `db:reset` do not refuse a production environment;
  (c) no provisioning / password-change path (ruled a task of its own).

## 2. S99-04 — credential-bearing URLs in the log-blanking rule

- **Cause.** `packages/shared/src/api/redaction.ts` had token-prefix and scheme rules, no userinfo rule.
- **Change.** `redaction.ts:83` `URL_USERINFO`, applied at `:249` before the token rule:
  `scheme://user:password@` becomes `scheme://***@`, any scheme; the password may hold `@` and `:`;
  a userinfo without a password stays. Limit stated in the file: a password with a raw `/`.
  `mts_` / `exs_` blanking unchanged (a test holds them beside a URL).
- **Test.** `packages/shared/test/redaction.test.ts`, describe "S99-04" (9 vectors, an object walk,
  a control of 6 texts that must stay). **Red first:** `10 failed | 58 passed (68)`; after: `85 passed`
  over the three redaction files.

## 3. S99-09 — a credential in the body of operation 91 is web console only

- **Cause.** Registry: op 91 `access: CAPTURE_CONFIG`, no condition
  (`packages/shared/src/api/transcription.ts`); siblings 89 / 95 / 96 carry `WEB_CONSOLE_SESSION`.
- **Change.** The condition cannot stand on the access member: stage 6 decides before the body is
  parsed, and it would close the operation to the tablet's save WITHOUT a credential (gate 81).
  So: `plugins/permission-guard/index.ts:359` `requireWebConsoleSession(request)` — the guard's own
  refusal (same denial budget, `ACCESS_DENIED` row, log line, `403 NOT_PERMITTED` with
  `details.reason: WEB_CONSOLE_ONLY`; one implementation, `refuseRequest`, shared with stage 6) —
  called by `modules/stt-config/index.ts:309` as the handler's first statement when the body has
  `credential` (any kind: SECRET, REFERENCE, CLEAR). Registry: description sentence, 403 text, 403
  example `webConsoleOnly`; `packages/shared/openapi/openapi.json` regenerated (`openapi:gen`:
  97 operations). Simulator of a tablet / phone app: `packages/shared/src/sim/api.ts:1080`.
- **Mobile.** Sends nothing to operation 91 (`rg updateSttConfig apps/mobile/src`: 0); it only
  reads operation 90. Nothing to change.
- **Tests (existing files).** `modules/stt-config/__tests__/routes.test.ts` (describe "S99-09", 6
  tests incl. the control: the same tablet session saves without a credential);
  `modules/stt-config/__tests__/static.test.ts` (the body is read in two pinned statements);
  `packages/shared/test/api-stt-config.test.ts` (simulator + contract example); and with a REAL
  paired-tablet session on PostgreSQL:
  `modules/capture-discovery/connect/__tests__/connect.db.test.ts:250`.
  The acceptance matrix (`test/acceptance/rbac-matrix.test.ts`) is unchanged and green: the access
  member did not change, so its "three operations carry the condition" still holds.
- **Red first.** `routes.test.ts -t S99-09`: `4 failed | 2 passed` (the two controls passed);
  simulator: `3 failed | 46 passed`.

## 4. V98-13 — a probe source that throws fails closed

- **Cause.** `capture-notices/index.ts:163-173` (at `713d83f`) turned a throwing source into
  `null`; `precheck.ts` then returned `NOT_ASKED`: the pre-check judged no reachability.
- **Change.** `capture-notices/index.ts:164` `probeOrThrow` is what the gate reads (`:194`);
  `precheck.ts:155` catches the throw and runs with `UNCHECKED_PROBE` (`:126`), whose reads reject.
  Each configured source then takes the path a failed read already has: camera `UNREACHABLE`,
  microphone `OPEN_FAILED` (the vocabulary of `08` §8f; no cause and no sentence was invented — the
  specs hold no "could not be checked" cause), stored not online, notified, and the start rule
  blocks. One report `CAPTURE_PRECHECK_PROBE_SOURCE_FAILED` with the cause; the per-source lines
  carry a fixed error. Operation 97 (`probe()`) is unchanged: null, 503 by name.
- **Test.** `capture-notices/__tests__/notices.test.ts`, two tests "V98-13" (the gate; the mounted
  unit with `provideProbeSource`). **Red first:** `2 failed` (`expected false to be true` on
  `outcome.asked`); after: `46 passed` over the folder.

## 5. R101-03 — ONE rule for a verify part, in the shared package

- **Cause.** `apps/core-web/src/features/evidence/verify-v2.ts:471-477` answered FAIL for a stored
  or chain part whose check was SKIPPED; `apps/mobile/.../verify-v2.ts:475-481` answered SKIPPED.
  `transcriptModel` bounds: web 256 / 256 / 64 / 1,024, mobile 200 / 200 / 64 / 1,000. Revision
  reason: web untrimmed, mobile trimmed.
- **Change.** NEW `packages/shared/src/evidence-rules/index.ts` (no import at all; export
  `./evidence-rules`): `v2FilePartOutcome` (`PASS` / `FAIL` / `NOT_RUN`; a part is `NOT_RUN` only
  when the answer says so — `plainChecked === false`, read by name, or the part's check `SKIPPED`;
  never a guess), `readTranscriptModel` (the contract's bound, 256, for the four text members),
  `readRevisionReason` (trimmed, 1..500). Both clients re-export / call them and keep their
  rendering: web `verify-v2.ts`, `item-v2.ts`, `transcript-model.ts`, `verify-v2-report.tsx` (adds
  `data-stored`; the dead "row without a file reads FAIL" branch is gone); mobile `verify-v2.ts`,
  `item-v2.ts`, `transcript-model.ts`, `verify-v2-report.tsx`.
- **Tests.** Shared rule: `packages/shared/test/evidence-verify.test.ts`, describe "R101-03" (13
  tests, contract examples `VERIFY_FILE_PLAIN_NOT_CHECKED_EXAMPLE`, `EVIDENCE_TRANSCRIPT_MODEL_*`,
  the registry examples of operations 85 / 86; the bounds are held against
  `EvidenceTranscriptModelSchema`). Web: `features/evidence/__tests__/item-v2.test.tsx` renders
  `ResultRow` and asserts each drawn word follows the shared outcome. Mobile:
  `features/evidence/verify-v2.test.tsx` renders `VerifyV2Report` the same way.
  **Deleted as obsolete duplicates:** web `item-v2.test.tsx` "a Core that answers no such member
  ..." and the rule lines of two others; mobile `transcript-states.test.tsx` describe "the file row
  of a verify result (G89b-06)" (3 tests) and 3 rule tests of `verify-v2-plain-checked.test.ts`
  (its reader tests stay).
- **Red first.** The module was written before its test file ran, so there is no red run of the
  shared test. The divergence itself is on record at `713d83f`: web `item-v2.test.tsx:264` asserted
  `v2FilePartOutcome(file, 'chain', [check('V-06', 'SKIPPED')])` to be `'FAIL'`, mobile
  `verify-v2-plain-checked.test.ts:47` the same shape to be `'SKIPPED'`.
- **Not done (not in the brief).** The other three duplicated files (`sealed-playback`, the
  checkpoint reader, the rest of `verify-v2` / `item-v2`) stay per client; the web's fill of a
  missing reason from the audit ring (`revisionReasons`) stays web-only; `sourceClass` absent
  (web) against null (mobile) is untouched. Whether a real answer can have V-04 / V-06 SKIPPED
  beside a file row was not determined (the review's open question stands).

## 6. R101-05 + T100-03 — package scripts

Root `package.json` (scripts only; `npm test` unchanged): `test:seal-e2e`, `test:dev-session-e2e`
(unsets `DEMS_LOCAL_SESSION_ATTENDED` / `DEMS_USER_ATTENDED`), `test:kill-matrix`
(`scripts/test/kill-matrix.sh`: the active cells from `run.sh --list`, one call),
`test:capture-worker` (`make -C apps/capture-worker`), `test:capture-worker-e2e`,
`test:regression` (`scripts/test/regression.sh`: 16 steps, the commands of test/17 Part A, strictly
sequential, stops at the first failure). Names and purposes were written to
`contract_batch_n.md` at 21:25 (start 21:22); the README paragraph is the docs agent's and is in.

`npm run test:capture-worker`, ONCE, load 1.86: **rc 0** — `check.sh: src: static rules OK`, 76
self-test lines "refused / accepted as required", `anchor_test`, `micwatch_test`,
`sink_kill_test` (200 kills), `writer_test`, `start_checks`, `log_test`: "all checks hold" with
their negative controls. The worker binary was up to date and was not relinked
(`build/capture-worker` still of 2026-10-10 10:46). Nothing was installed.

NOT run by the driver: `test:seal-e2e`, `test:dev-session-e2e`, `test:kill-matrix`,
`test:capture-worker-e2e`, `test:regression`. Checked without starting anything:
`sh -n` on both script files; the id list of the kill matrix (35 active, 10 parked).

## 7. V98-09 and V98-08

- **V98-09.** `packages/shared/src/api/state-slices.ts:276` `SESSION_CAPTURE_CHECKPOINTS_EXAMPLE`.
  Imported by `apps/core-web/src/features/session-monitor/__tests__/integrity-facts.test.tsx`,
  `apps/core-web/src/test/real-core-facts.test.tsx` (two places; the session-size case now reads
  the example's 34 MB instead of a hand-built 18 MB) and
  `apps/mobile/src/features/session-live/situation-c.test.tsx`. Held against the schema in
  `packages/shared/test/sim-own-capture.test.ts`.
- **V98-08.** No defect. `params` and `reasonCode` are members of the STATE SLICE
  (`PrecheckItemStateSchema`, `state-slices.ts:210-218`); operation 27 answers the design-book item
  (`PrecheckItemSchema`, `core-api.ts:285-292`: id, status, value, reason — API-1 keeps that
  schema). Both clients read the slice. Nothing was added to the read; the erratum for
  `contract_wave_m.md` is E-BN-6. A test pins both shapes (same shared file).

## 8. T100-02 and S99-07

- **T100-02 `M5-SEC-SRC-1`.** The suite part is now a test that cites the id:
  `capture-session/__tests__/session-capture.db.test.ts:432` — production-kind devices (ONVIF_RTSP,
  USB_AUDIO, no opener) in a registry of the production class: 409 `SOURCE_KIND_NOT_RECORDABLE`,
  0 workers started, 0 sources asked to open, 0 source rows, nothing added to the evidence volume;
  control in the same test: the development registry starts one worker and opens sources.
  **Live-only, left:** the socket snapshot "0 listeners in 8554-8564" and the push that finds the
  port closed. They need a STARTED `REAL_PRODUCTION` Core with the BUILT worker. That cannot boot at
  HEAD: no command provisions a production signing key (S99-13) and, since this batch, the seed's
  operators are refused. In this file the worker is a stand-in that binds no port, so a port check
  there could not fail. Its negative control is `npm run test:dev-session-e2e`.
- **S99-07.** `.gitignore`: `*.p8`, `*.wrap`, `*.blob`. `git ls-files -ci --exclude-standard`:
  0 lines. No tracked file has one of the extensions, so no re-include was needed.
  `git check-ignore -v`: the three forms match the new lines; `/.data/`, `/release/`, `.vitest/`
  and the `device-certificate.pem` re-include (14 tracked) answer as before.

## 9. Proof

Typecheck x 7 workspaces: rc 0, 0 `error TS` each. Lint x 7: rc 0, 0 warnings (two warnings of my
own new test lines were found by the first lint run and fixed).

| suite | command | result | at `713d83f` (test/17) |
|---|---|---|---|
| shared | `npm run test -w @dems/shared` | 101 files; **2646 passed**, 0 failed | 2614 |
| core-server unit | `npx vitest run --root apps/core-server --project unit --maxWorkers=4` | 324 files; **6717 passed**, 0 failed | 6702 |
| core-server db, run 1 | `lockf db-migrate ... --project db --maxWorkers=2` | **3 failed** / 2422 passed / 7 skipped | - |
| core-server db, run 2 | the same | 181 files (178 passed, 3 skipped); **2426 passed**, 7 skipped, 0 failed; "0 remain" | 2423 |
| core-web | `npm run test -w @dems/core-web` | 164 files; **2225 passed** | 2224 |
| mobile | `npx -w apps/mobile jest --maxWorkers=2` | 273 suites; **2913 passed** | 2917 (-4: 6 duplicate rule tests deleted, 2 added) |
| worker checks | `npm run test:capture-worker` | rc 0 | not run there |

db run 1, the three failures and what they were: two EXISTING tests of
`source-class.db.test.ts` booted a production Core on the seed (the S99-01 refusal doing its job;
the tests now provision credentials); one was my new `M5-SEC-SRC-1` test (it filtered the shared
fixture volume by a session id that repeats across the file's clones, and it shifted the file's
case counter). Both fixed, the two files re-run green, then the whole suite once more (run 2).
After the whole shared and core unit runs I changed test lines only (two lint fixes, one type
fix); those files were re-run alone: green.

Load: below 4 before the db, web and mobile runs. NOT held for the core-server unit run: it
started at 1-minute load 5.83, right after the shared suite; it passed. Not repeated (D122).

## 10. Checks for the test runner

| command | lock | expected |
|---|---|---|
| `npm run test:seal-e2e` | takes heavy-host + db-migrate itself; sandbox off | 1 file, 3 passed |
| `npm run test:dev-session-e2e` | the same | 1 file, 2 passed, 2 skipped |
| `npm run test:kill-matrix` | the same (through `run.sh`) | 35 passed, 0 failed |
| `npm run test:capture-worker-e2e` | heavy-host (itself) | exit 0 |
| `npm run test:regression` | as its steps | last line "== test:regression GREEN: 16 steps" |
| `npx vitest run --root packages/shared test/api-registry.test.ts test/api-openapi-scope.test.ts` | none | 66 passed (inside the shared run above: green) |

`M5-SEC-SRC-1` live part: not runnable (section 8).

## 11. Decisions taken, for the controller

1. **S99-09 is a handler rule, not an access condition** (section 3). The brief said "add the
   condition"; adding it to the access member would have refused the tablet's save without a
   secret. Answer, row and reason are the condition's own.
2. **S99-09 covers all three credential kinds** (SECRET, REFERENCE, CLEAR), not SECRET alone: each
   changes the credential. Narrowing it to SECRET is a one-line change.
3. **R101-03 bounds are the contract's (256)**, which is STRICTER than both clients for
   `transcriptModel.report` (1,024 / 1,000). A report line longer than 256 characters would now be
   "not stated" on both clients; the Core's own response schema already refuses one.
4. **`test:regression` includes the 35-minute worker e2e series** as its last step, with
   `DEMS_REGRESSION_SKIP_WORKER_E2E=1` to leave it out.
5. **S99-01 fails closed on unreadable operators**, and the check stands BEFORE the worker
   handshake. Any lane or test that boots `REAL_PRODUCTION` on a seeded database now stops at boot.
6. **V98-08 is an erratum, not a code change.**

## 12. Seen, not changed

- The contract's own 403 example of operations 95 / 96 (`capture-discovery.ts:825`) carries the
  text "Your role does not allow this action", while the server answers "This action is available
  on the web console only" (`permission-guard/denial.ts:47`). The new example of operation 91 uses
  the server's text.
- `T100-07` (the two renamed transcriber children) was in the reading list and in no item: untouched.
- `README.md` and `masterplan/**` are the docs agent's; not edited.
