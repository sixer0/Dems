---
task_id: 2026-10-04_dems_backend_rbac_pairing
agent: coder-execution (tier R)
blueprint_row: 46b (identity security lows; follow-up of rows 46 / W24 and 63 / W41)
findings: CPS1-6, CPS1-7, CPS1-8 of gateway_check/05_cp_access_control_security.md
date: 2026-10-04
status: complete (the three findings 19:38; the follow-up of decision D118 step 2 20:50)
evidence_tier: 3
---

# coder-execution progress: identity security lows (CPS1-6, CPS1-7, CPS1-8)

Status: **complete** (19:38 WIB). The three Low findings of the security checkpoint CP-S1 that
live in `apps/core-server/src/modules/identity/**` are closed in the code, each with a test that
fails without its change (8 load-time mutations outside the repository, 8 detected). Nothing
outside that folder was written except this file and the row's document. No contract value was
missing; one description of the contract needs a clause (`CONTRACT-GAP-W41-5`).

Full record: `implementation/24b_identity_security_lows.md` (11 sections and an appendix). No
token, credential, hash or password appears in either document.

## What changed

| Finding | Change | Source |
|---|---|---|
| CPS1-6 | A verified failed sign-in writes its `AUTH_FAILED` row whatever the denial budget says; the answer stays the budget's 429 with `retry-after`; one derivation and the same statements as inside the budget | `sign-in.ts:170-209` |
| CPS1-7 | A LIVE biometric token presented by another paired device is handled as a reuse, through the existing reuse path of the one unit: family revoked (`TOKEN_REUSE`), the BIOMETRIC sessions of the token's device and operator ended (`TOKEN_REUSE`), `session.ended` after the commit, the `AUTH_FAILED` row with `reason: TOKEN_REUSE` and `sessionsEnded`. A dead token of another device stays `OTHER_DEVICE` | `biometric/sign-in.ts:118-139` |
| CPS1-8 | Remedy (1): `FIND_ENROLMENT` joins `operators` and asks `enabled`. Chosen because the rule then lives in the one statement that decides, holds however the operator came to be disabled, and changes no statement that another module sends (remedy (2) would change `src/modules/admin/__tests__/status.db.test.ts:176` by design) | `biometric/store.ts:291-293` |

## Milestones (WIB)

| Time | What |
|---|---|
| 18:55 | Inputs read: the three findings and rulings 2 (1) and 8; the logs of W24 and W41; rules M1 to M16; the cited spec rules; `coder_execution_step_48.md` (it names no file of the identity folder) |
| 19:02 | Baseline typecheck exit 0. Pre-images of the 13 files copied to `.cache/rollback/identity_security_lows/` (19:02:48) |
| 19:04 to 19:06 | The three source changes (five files; two of them comments only) |
| 19:06 to 19:17 | Tests: 9 new, 7 rewritten or edited in place, in 8 test files of the folder |
| 19:18 | Changed files green: `unit` 3 files, `db` 2 + 4 files |
| 19:20 | Mutation harness outside the repository: baseline 8 files, 140 tests; MA1, MA2, MB1 to MB4, MC1, MC2 all detected |
| 19:21 | The identity folder green (`unit` 12 files, 206 tests; `db` 15 files, 187 tests). The three acceptance files of the brief green (3 files, 99 tests) |
| 19:22 to 19:23 | Whole `unit`: exit 0, 145 files, 3,748 tests |
| 19:23 to 19:25 | Whole `db`: exit 1, 114 of 115 files, 1,691 of 1,692 tests. The red test is `src/modules/demo/__tests__/reset-failures.db.test.ts:391` (another row's) |
| 19:25 to 19:27 | That file alone: red again, the same assertion. With each of the three changes reverted in memory: red the same three times. Not this row's |
| 19:29:37 | Last edit: the title and the comment of one test (`__tests__/concurrency.db.test.ts`) |
| 19:29 to 19:31 | Typecheck exit 0, lint exit 0; MA1 and MA2 again (detected); the changed files and the identity folder green again |
| 19:31:39 | End state: 0 databases with the prefix `dems_test_step_46b_`, 0 sessions on them, no listener of this row, PostgreSQL PID 19121 and start time unchanged |

## Files created or updated

Updated, all under `apps/core-server/src/modules/identity/` (first 16 characters of the SHA-256 of each after the last edit):

| File | Kind | SHA-256 (16) |
|---|---|---|
| `sign-in.ts` | source (CPS1-6) | `2bb73dd3d570811b` |
| `biometric/sign-in.ts` | source (CPS1-7) | `c66f521ac2de21c6` |
| `biometric/store.ts` | source (CPS1-8) | `9314976865e6b0c3` |
| `biometric/failure.ts` | comments only | `d2e9e738bc2d6dfe` |
| `biometric/activity.ts` | comments only | `7c5c17208cddcb46` |
| `__tests__/concurrency.db.test.ts` | test, `db` | `eb686bf2977ebbec` |
| `__tests__/sequence.db.test.ts` | test, `db` | `da3e2e7a18064794` |
| `biometric/__tests__/sign-in.db.test.ts` | test, `db` | `a34cdb44cc3aa474` |
| `biometric/__tests__/sequence.db.test.ts` | test, `db` | `aa1e312b51f2ac9d` |
| `biometric/__tests__/failure.db.test.ts` | test, `db` | `75baeb8c2ccf3f46` |
| `biometric/__tests__/secrets.db.test.ts` | test, `db` | `ee17d1ed9a29c580` |
| `biometric/__tests__/tokens.test.ts` | test, `unit` | `da848696d2bbe132` |
| `biometric/__tests__/static.test.ts` | test, `unit` | `860fc5f449d7a9a3` |

Created:

- `docs/2026-10-04_dems_backend_rbac_pairing/implementation/24b_identity_security_lows.md`
- `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/coder_execution_identity_security_lows.md`

Outside the tracked tree (git-ignored): `.cache/rollback/identity_security_lows/` (the 13
pre-images and `PRE_IMAGE_SHA256.txt`).

Not written (parallel run): `delegation_progress_report.md`, `status_tasks.md`,
`decisions/decisions.md`, `gateway_check/01_gate_report.md`, `masterplan/02_plan.md`,
`implementation/99_implementation_report.md`. No file of another row, no migration, no schema, no
file of `packages/shared/**`, `src/plugins/**`, `src/core/**` or `test/**`. No git write.

## Verification (final state)

| Command | Time | Result |
|---|---|---|
| `npm run test -w @dems/core-server -- --maxWorkers=2 <the 2 changed unit files>` | 19:30:48 | exit 0; 2 files, 55 tests |
| `DEMS_TEST_STEP=46b npm run test:db -w @dems/core-server -- --maxWorkers=2 <the 6 changed db files>` | 19:30:51 | exit 0; 6 files, 85 tests; `0 remain with the run prefix dems_test_step_46b_tmdurfn4_` |
| The same two commands for the folder `src/modules/identity` | 19:31:06 to 19:31:32 | exit 0 and exit 0; 12 files, 206 tests; 15 files, 187 tests |
| `npm run typecheck -w @dems/core-server` | 19:29:57 | exit 0 |
| `npm run lint -w @dems/core-server` | 19:30:16 | exit 0; no diagnostic |
| `npm run test -w @dems/core-server -- --maxWorkers=2` (whole `unit`, once) | 19:22:27 to 19:23:18 | exit 0; 145 files, 3,748 tests |
| `DEMS_TEST_STEP=46b npm run test:db -w @dems/core-server -- --maxWorkers=2` (whole `db`, once) | 19:23:24 to 19:25:38 | exit 1; 1 failed, 1,691 passed; `0 remain with the run prefix dems_test_step_46b_tmduf16s_` |
| `… test/acceptance/pairing-lifecycle.test.ts test/acceptance/rbac-matrix.test.ts test/acceptance/contract.test.ts` | 19:21:41 to 19:21:56 | exit 0; 3 files, 99 tests |
| 8 mutations through a scratch configuration outside the repository | 19:20 to 19:21; MA1, MA2 again 19:30 | 8 of 8 detected; baseline 140 of 140 |
| Databases with this row's prefix; `.locks/postgres.pid` | 19:31:39 | 0; 19121 |

Red outside the folder (P11, M12):

| Time | File | Result | Cause |
|---|---|---|---|
| 19:23 to 19:25 (whole `db`) | `src/modules/demo/__tests__/reset-failures.db.test.ts:391` | `expected [ …(87) ] to have a length of 86 but got 87` | Not this row's: red the same alone (19:25:54) and with each of the three changes reverted in memory (19:26:26 to 19:27:01). The file is the demo module's (W43), last written 18:54:17 with `src/engine/rehydrate.ts`; engine sources were written after it (19:04:54, 19:12:57) by the engine and clock fix round. Hypothesis: that round's in-flight work |

## Test ledger

`@dems/core-server` only: `db` +8 tests (concurrency 8 to 9, sequence 9 to 10, biometric sign-in 23
to 27, biometric sequence 12 to 13, failure 13 to 14, secrets 12), `unit` +1 test (tokens 19 to
20, static 35). No test of another row was added, removed or edited.

## By-design changes needed in other rows' tests

None.

## Findings (details: `24b_identity_security_lows.md` section 10.1)

| ID | Finding |
|---|---|
| F-1 | The bound "five rows beyond the budget per key and window" (25 in all) is asserted for a caller who cannot sign in. A caller who holds a valid password opens a new lock cycle with each success (CPS1-10, Info); the request throttle of the key then caps the rows. Reasoned, not tested |
| F-2 | An attempt during the lock that finds the budget full still writes no row (nothing was verified): inside the ruling |
| F-3 | The row of a live token presented by another device names the token's OPERATOR and the PRESENTING device, as every reuse row does; the token's device is on the ended session and the revoked token rows, not on the audit row |
| F-4 | That row's reason is `TOKEN_REUSE`; `OTHER_DEVICE` now means a dead token of another device |
| F-5 | After a disable and an enable the operator is named again where only used rows of the pair remain ("live or last used", for an enabled operator) |
| F-6 | A device retired between stage 4 and the unit could still write one report row that names an enrolled, enabled operator. Hypothesis, not produced; outside CPS1-8 |
| F-7 | With TWO server processes on one database, a presentation by another device that races the token's own use can leave the rotated token live while its session is ended. Reasoning, not produced; not the specified deployment |
| F-8 | The unit label `identity.signIn.unaudited` is gone from the pipeline's log lines |
| F-9 | One red test of another row in the whole `db` run (above) |

`CONTRACT-GAP-W41-5` (text only): `packages/shared/src/api/realtime-messages.ts:136-138` and
`realtime-examples.ts:178` describe `TOKEN_REUSE` as "a used biometric token … presented again";
add "or a live one presented by another paired device". Section 9 of the row's document lists it
with the lines of the specification, the database contract and the two row logs that say the old
behaviour.

## Deviations (details: section 10.2)

DV-1 `secrets.db.test.ts` got one more presentation, so that a row with `OTHER_DEVICE` stays under
the secret scan. DV-2 the B test asserts the presenting device on the row (finding F-3). DV-3 one
read-only command (the baseline typecheck of 19:02) used `cd` to the repository root. DV-4 the
shared tracker files were not written. DV-5 no log file was saved under `docs/`: the outputs are
quoted in the row's document.

## Decisions for the controller (details: section 10.3)

| ID | Question | Recommendation |
|---|---|---|
| DN-1 | `details.reason` of the row of a live token presented by another device: `TOKEN_REUSE` (taken) or `OTHER_DEVICE` with `sessionsEnded` | Keep `TOKEN_REUSE`: spec §5.4 ties a session ended with `TOKEN_REUSE` to a row with that reason |
| DN-2 | Should the audit row also name the TOKEN's device | No; if yes, it is a new detail key on every reuse row |
| DN-3 | CPS1-8 by remedy (1) alone, or remedy (2) as well | (1) alone; (2) changes another row's test and AT-C5 |
| DN-4 | The bound for a caller who can sign in (F-1) | Accept |
| DN-5 | The texts of section 9 (specification, database contract, row logs, the checkpoint's table) | Pass to the close-out rows |
| DN-6 | `CONTRACT-GAP-W41-5` | Pass to the contract follow-up |

## Blockers

None.

---

## Follow-up: the condition `DEVICE_CREDENTIAL` on operation 8 (F77, decision D118 step 2)

Status: **complete** (20:50 WIB). Operation 8 `signInWithBiometric` carries the registry's
condition `DEVICE_CREDENTIAL`: the session token of an operator on the device is refused by
stage 6 with 403 `DEVICE_NOT_PAIRED`, `details.reason: DEVICE_CREDENTIAL_REQUIRED`, without a
row, an attempt or a place in the denial budget. Landed in ONE step at 20:39:13 (the contract
add-on by `git apply`, three lines of the specification, the handler and this folder's tests);
the server typechecked at 20:39:20. The guard was not changed. Both whole runs exit 0.

The controller's gate on the first part: PASS (decision D123); rulings on DN-1 to DN-6 recorded in
the row's document, section "Follow-up".

Full record: `implementation/24b_identity_security_lows.md`, sections H.1 to H.10.

### Milestones (WIB)

| Time | What |
|---|---|
| 20:31 | Inputs read: `27_contract_c.md` section 15 (15.4, 15.8 FU-2), `28_rbac_guard_pipeline.md` G.1 to G.10, `test/02_rbac_matrix.md` F-W47-4 |
| 20:34:16 | `git apply --check` of `27c_condition_op8_addon.patch`: exit 0 |
| 20:39:07 | 18 pre-images in `.cache/rollback/condition_op8/` |
| 20:39:13 | The landing: `git apply` (plain), then 10 files written by exact-text replacement (27 texts, each found once) |
| 20:39:20 | `npm run typecheck -w @dems/core-server`: exit 0 |
| 20:39:28 to 20:40:04 | Shared suite 68 files / 1,814; `gen-openapi --check` exit 0; typecheck and lint of `@dems/shared`; typecheck of `@dems/core-web` and `@dems/mobile`; lint of `@dems/core-server`: all exit 0 |
| 20:40:04 to 20:40:48 | The identity folder: `unit` 12 files / 206, `db` 15 files / 187; the five acceptance files: 124 tests; all exit 0 |
| 20:41:19 | Out of the tree: the condition taken off operation 8 in memory: 4 of 51 changed tests red (baseline 51 of 51) |
| 20:41:41 to 20:45:36 | Whole `unit`: exit 0, 147 files, 3,795 tests. Whole `db`: exit 0, 119 files, 1,708 tests |
| 20:46:43 | End state: 0 databases with the prefix `dems_test_step_46c_`, no listener of this step, PostgreSQL PID 19121 unchanged |

### Files created or updated

By `git apply` of the contract owner's add-on patch (not edited by hand):

- `packages/shared/src/api/operation-parts.ts`, `pairing.ts`, `identity.ts`
- `packages/shared/test/api-registry.test.ts`, `api-openapi-scope.test.ts`
- `packages/shared/openapi/openapi.json`

Specification: `docs/2026-10-04_dems_backend_rbac_pairing/masterplan/01_specs.md`, lines 64 (the
revision line names operation 8), 552 (ID-6, one sentence), 831 (row 8, the access cell
`` `DEVICE`; needs the device's own credential ``).

Under `apps/core-server/src/modules/identity/biometric/` (first 16 characters of the SHA-256):

| File | Kind | SHA-256 (16) |
|---|---|---|
| `sign-in.ts` | source: the unreachable branch removed | `46bd7dc1ed2b9848` |
| `activity.ts` | source: `TokenSignedIn` without `replaced` | `728acdd076bc14d3` |
| `index.ts`, `routes.ts` | comments only | `1fdbdb9853eadca3`, `bcdfcc0a759bf419` |
| `__tests__/routes.test.ts` | test, `unit`, by design | `e88049f27ed6de74` |
| `__tests__/static.test.ts` | test, `unit`, by design | `a6058bc2de832a0b` |
| `__tests__/tokens.test.ts` | test, `unit`, by design | `34d842838296de11` |
| `__tests__/sign-in.db.test.ts` | test, `db`, by design | `10a13a53531e9abe` |
| `__tests__/sequence.db.test.ts` | test, `db`, by design | `70b11f642de33c29` |

Documents: the section "Follow-up" of `implementation/24b_identity_security_lows.md`; this
section. Pre-images: `.cache/rollback/condition_op8/` (18 files). Not written: the shared tracker
files, the guard, the acceptance files, any file of another row.

### The handler branch

**Removed.** The branch that ended a presented session as `ROTATED` in the unit of a biometric
success is dead by construction: stage 6 lets only a DEVICE principal reach operation 8 (the
registry's condition), and a DEVICE principal has no session (stage 4 resolves one credential to
one principal). `sign-in.ts` reads no session of the request any more; the builder takes no
`replaced`. The alternative (kept with a comment) is a restore from the pre-image.

### Red tests of other rows

None: both whole runs exit 0, and the five acceptance files are green without a change.

### Findings and decisions for the controller (details: H.9)

| ID | Content |
|---|---|
| G-1 | `src/plugins/authenticate/index.ts:161` still lists `signInWithBiometric` in `ACTIVITY_EXEMPT_OPERATIONS` and its comment speaks of a session presented with a biometric sign-in; the entry has no effect now. Smallest change: `['signIn', 'signOut']`, the comment, and `__tests__/authenticate.test.ts:432-433`. Outside this step's write paths |
| G-2 | Texts for the close-out: `masterplan/01_specs.md:405` (the marker `DEVICE` names credential rotation only); `implementation/41_biometric_token.md:119, 322-326, 346, 423, 759, 798` describe the removed branch |
| G-3 | `test/acceptance/contract.test.ts:1458` keeps `signInWithBiometric 403 DEVICE_NOT_PAIRED` as the known gap `CONTRACT-GAP-W52-1`; the 403 text now names the code for a session of the device, not yet for a web console session. Green; its owner's call |
| G-4 | The refusal leaves no row and takes no place, as ruled for operation 23: with the final security review |
| G-5 | A client must send the device credential on operation 8 also while a session is in memory; the mobile runtime's state is the controller's report, not checked here |
| GD-1 | The branch was removed, not kept: for the controller to accept |
| GD-2 | Pass G-1 to the owner of the authenticate plugin, G-2 to the document close-out, G-3 to the acceptance row |

### Blockers

None.
