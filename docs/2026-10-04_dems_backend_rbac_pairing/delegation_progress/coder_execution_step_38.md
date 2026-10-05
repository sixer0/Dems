# coder-execution, step 38 (plan row W16): shared vocabulary, additive

| Field | Value |
|---|---|
| Step / row | 38 / W16 (wave B1; contract-owner slot, first holder, P17) |
| Agent | coder-execution (tier R) |
| Status | **complete** (first return 07:40 WIB: needs-review on DN-1; the controller ruled option A in D37 and the follow-up closed it, 07:41 to 07:49 WIB) |
| Result line | 12 permissions, 53 audit types, 18 grants (INVESTIGATOR 4, SUPERVISOR 10, TECHNICIAN 4); simulator diff against `acaff20`: 2 files, 32 lines added, 0 removed; all twelve permission labels at `securityAudit.rbac.permissions`, the map the clients read |
| First recorded timestamp | 2026-10-04 07:23:21 WIB (P23 pre-image saved, before the first edit) |
| Verification runs | First return: 07:33:24 to 07:35:49 WIB. Follow-up: 07:42:37 to 07:48:55 WIB |
| Write paths used | `packages/shared/src/sim/vocabulary.ts`, `packages/shared/src/sim/auth.ts`, `packages/shared/src/i18n/en/common.ts`, `packages/shared/test/auth.test.ts`, `packages/shared/test/i18n-vocabulary-sync.test.ts`; by D37 also `packages/shared/src/i18n/en/security-audit.ts`; `.cache/rollback/W16.{pre,post}.patch`, `.cache/rollback/W16b.{pre,post}.patch`; the output document; this file |
| Owned but not changed | `packages/shared/test/sim-contract.test.ts` (it pins no count this row changes) |
| Shared trackers | Not written (parallel run, P8): `status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md`, `masterplan/02_plan.md`, `implementation/99_implementation_report.md`. The controller records the status of row W16 from this file |
| Sandbox bypass | None |
| Packages installed | None. No `package.json` or lockfile touched |
| Processes left running | None |
| Contract-owner slot | Released to W19. This row wrote nothing under `packages/shared/src/api/` |

## Files created or updated

| Path | Change (lines against `acaff20`) |
|---|---|
| `packages/shared/src/sim/vocabulary.ts` | Updated: +27 / -0 (3 permissions, 9 audit types, 9 category entries) |
| `packages/shared/src/sim/auth.ts` | Updated: +5 / -0 (3 SUPERVISOR grants) |
| `packages/shared/src/i18n/en/common.ts` | Updated: +19 / -0 (9 labels in `auditType`, 3 labels in the new map `rbac.permissions`) |
| `packages/shared/src/i18n/en/security-audit.ts` | Updated in the follow-up (D37): +4 / -0 (3 labels and one comment line in `rbac.permissions`, `:311-314`) |
| `packages/shared/test/auth.test.ts` | Updated: +48 / -0 (one new test, one import name) |
| `packages/shared/test/i18n-vocabulary-sync.test.ts` | Updated: +42 / -0 (two new tests; the `Permission` test was made stricter in the follow-up) |
| `.cache/rollback/W16.pre.patch`, `.cache/rollback/W16b.pre.patch` | Created (git-ignored): P23 pre-images, 0 bytes each |
| `.cache/rollback/W16.post.patch` (9,796 bytes), `.cache/rollback/W16b.post.patch` (715 bytes) | Created (git-ignored): the row's change as two reverse-appliable patches over disjoint files |
| `docs/2026-10-04_dems_backend_rbac_pairing/implementation/16_shared_vocabulary.md` | Created; section 11 "Follow-up: Profile sheet labels (D37, option A)" appended |
| `docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/coder_execution_step_38.md` | Created; rewritten after the follow-up (this file) |

Scratch files of this row (evidence scripts, logs) are under `$TMPDIR/w16/`, outside the
repository. The scratch copy used for the mutation checks was removed.

Reference state for the later owner of `security-audit.ts` (W75), `git hash-object`:
`e6f7c44fa3aedb655504727e08e95e5d3d727395` (blob at `acaff20`: `ebd9c9f411a6f13f0d0ddfc1cb6a7d857037c4d5`).

## Milestones

| # | What | State |
|---|---|---|
| 1 | Inputs read: blueprint row 38 and P1 to P25; plan W16, §4.3, §11, §16; specification §4.3, §4.4, §13, §19.1, §19.2, AC-B-17, AC-B-62; client specification (FC-3, TS-7, TS-8, PG-10, GC-03, GC-15); analysis ADQ-9; decisions D11, D13, D25, D31; the three source files and the three tests | done |
| 2 | P23 pre-image saved before the first edit (07:23:21 WIB) | done |
| 3 | "Before" runs for the ledger: shared 584 / 31, core-web 438 / 39, mobile 833 / 72 | done |
| 4 | Additive values in `vocabulary.ts` and `auth.ts`; labels in `common.ts` | done |
| 5 | GP-06: the three suites run with the production change and unedited tests: 0 failures, so no existing assertion pins a changed count | done |
| 6 | Three new tests; ten single-change mutations on a scratch copy, each detected | done |
| 7 | Verification of the first return; AC-B-62 diff check; reference hashes | done |
| 8 | Output document; first return with `needs-review` on DN-1 (07:40 WIB) | done |
| 9 | D37 option A: pre-image of `security-audit.ts` (07:41:30 WIB), three labels added, the `Permission` sync test made stricter, eight more mutations each detected | done |
| 10 | Verification of the follow-up; section 11 of the output document | done |

## Verification (follow-up run, 07:42:37 to 07:48:55 WIB)

| Command | Result |
|---|---|
| Profile sheet lookup (real i18next, shared resources, the app's options; screen not rendered) | `PAIRING_MANAGE => "Manage pairing and paired devices"`, `USER_ADMIN => "Manage users and roles"`, `DEMO_CONTROL => "Use the demo controls"`, `missing keys recorded: 0` |
| `git diff acaff20 --numstat -- packages/shared/src/i18n/en/security-audit.ts` | `4 0`; removed lines: 0 |
| `git diff acaff20 --numstat -- packages/shared/src/sim` | `5 0 …/auth.ts`, `27 0 …/vocabulary.ts`; removed lines: 0 |
| Counts (read-only script over the modules) | `permissions 12`, `auditTypes 53 categoryMapKeys 53 categories 8`, `grants {"INVESTIGATOR":4,"SUPERVISOR":10,"TECHNICIAN":4} total 18`, `permission labels: securityAudit.rbac.permissions 12 + common.rbac.permissions 3 \| unlabelled: 0` |
| `npm run typecheck -w @dems/shared`, `-w @dems/core-web`, `-w @dems/mobile` | exit 0, exit 0, exit 0 |
| `npm run lint -w @dems/shared`, `-w @dems/core-web`, `-w @dems/mobile` | exit 0, exit 0, exit 0 |
| `npm run test -w @dems/shared -- --maxWorkers=2` | 07:42:58: exit 0, `Test Files  31 passed (31)`, `Tests  587 passed (587)`. 07:48:55: exit 0, `Test Files  37 passed (37)`, `Tests  680 passed (680)` (another row added six `live-light-*` files with 93 tests in between) |
| `npm run test -w @dems/core-web -- --maxWorkers=2` | Run 1 (07:43:01): **exit 1**, 437 of 438, the predecessor's known flaky test KI-24 at `security-audit.test.tsx:409` (F-9). Runs 2, 3, 4 (07:45:59, 07:46:35, 07:47:13): exit 0, `Test Files  39 passed (39)`, `Tests  438 passed (438)` each. The file alone, five times: `Tests  18 passed (18)` each |
| `npm run test -w @dems/mobile -- --maxWorkers=2` | exit 0: `Test Suites: 72 passed, 72 total`, `Tests:       833 passed, 833 total` |
| `node --import tsx packages/shared/scripts/gen-openapi.ts --check` | exit 0: "packages/shared/openapi/openapi.json is up to date" |
| `git hash-object` of the three reference-hash web tests | `9e8b97c8…e3bbdd`, `71f6f033…b67d1d`, `1ab07579…b6c762`: equal to D25 and D31 (full values in the output document §11.5) |
| Root `npm run typecheck` (07:44) | exit 0, all five workspaces. (In the first return, 07:33 and 07:35, it exited 2 in another row's new core-server test file; that file compiles now) |
| Root `npm run lint` (07:44) | exit 0; three `no-thenable` warnings in another row's new file `packages/shared/test/live-light-settle.test.ts` |

The runner output is quoted in sections 3, 4 and 11 of the output document.

## Test ledger (P24)

| Workspace | Before this row | After | Added by this row |
|---|---|---|---|
| `@dems/shared` | 584 tests in 31 files | 587 tests in 31 files at 07:42:58 (680 in 37 at 07:48:55 with another row's six new files) | 3 tests, 0 files (`auth.test.ts` 1, `i18n-vocabulary-sync.test.ts` 2) |
| `@dems/core-web` | 438 tests in 39 files | 438 tests in 39 files | 0 |
| `@dems/mobile` | 833 tests in 72 suites | 833 tests in 72 suites | 0 |

"Before" for `@dems/shared` already holds 76 tests in three `client-*` files of step 34 (baseline
508 in 28 files).

Edited existing assertions (GP-06): **none**. New tests, by name:

| Test | File:line |
|---|---|
| `pins 12 permissions and 18 grants: INVESTIGATOR 4, SUPERVISOR 10, TECHNICIAN 4 (W16)` | `packages/shared/test/auth.test.ts:246` |
| `Permission: 12 values, each labelled in securityAudit.rbac.permissions; common.rbac.permissions agrees (W16)` | `packages/shared/test/i18n-vocabulary-sync.test.ts:119` |
| `AuditType: 53 values; the nine server-written types sit in the existing categories (W16)` | `packages/shared/test/i18n-vocabulary-sync.test.ts:135` |

Pinned outside the row's three files: nothing (no test of any workspace failed with the production
change and unedited tests).

## Findings (for F-n)

| # | Finding | Where in the output document |
|---|---|---|
| F-1 | **Closed (D37, option A).** The mobile Profile sheet printed three raw keys for a SUPERVISOR in Simulated mode, because it reads `securityAudit.rbac.permissions.<P>` (`apps/mobile/src/features/settings/profile-sheet.tsx:55`). The three labels are in that map now and the sync test requires every permission there. Limit: the sheet was not rendered as a SUPERVISOR (no such test exists under `apps/mobile/**`, W82's folder) | §7 F-1, §11.1 to §11.4 |
| F-2 | The web console is unchanged in Simulated mode (its matrix keeps its own nine-entry list) | §7 F-2 |
| F-3 | In Live mode the tablet's "last pairing event" line takes the newest PAIRING-category audit row, so it would show the four new server-written pairing types, including another device's (`apps/mobile/src/features/pairing/pairing-model.ts:146-153`). Input for W57 | §7 F-3 |
| F-4 | The web Authentication and custody lenses use fixed type lists, so `BIOMETRIC_ENROLLMENT_CHANGED` and `ACCESS_DENIED` appear only in the audit log table in Live mode (`apps/core-web/src/features/security-audit/model.ts:381-390`). Input for W75 | §7 F-4 |
| F-5 | `Permission` is now covered by the i18n sync test | §7 F-5, §11.3 |
| F-6 | P23's `git apply <row>.pre.patch` exits 128 for a 0-byte pre-image on git 2.55.0; `--allow-empty` exits 0 (ruled: D37, DN-3) | §7 F-6 |
| F-7 | Root typecheck failed at 07:33 and 07:35 WIB in another row's new core-server test file; exit 0 again at 07:44 WIB | §4.6, §11.5 |
| F-8 | Load average 2.8 to 6.0 during the row; no test timed out | §7 F-8 |
| **F-9** | **The predecessor's known flaky web test KI-24 fired once (07:43 WIB):** `apps/core-web/src/features/security-audit/__tests__/security-audit.test.tsx:409` reads the matrix rows synchronously while `mountPage()` waits only for `panel-rbac`; the dump shows an empty table. Recorded on 2026-10-01 in `docs/2026-09-30_dems_demo_stack_setup/verification/01_verification.md:145` (NF-1) and `:196` (KI-24). 1 failure in 4 full web runs after the follow-up, 0 in 3 before; 5 of 5 alone. This task's gates accept no failure (D31) and neither the plan nor the blueprint lists KI-24. An A/B under equal load was not run | §11.6 |
| F-10 | The comment at `packages/shared/src/i18n/en/common.ts:566-569` describes the label maps as before D37 (true, incomplete). Not edited: the follow-up allowed no other file | §11.1 |
| F-11 | `packages/shared/src/i18n/en/security-audit.ts` is a two-writer path now (W16, then W75); the plan's §4.3 table and the blueprint's multi-writer list do not have it yet | §11.2, §11.7 |
| F-12 | Three lint warnings (exit 0) in another row's new file `packages/shared/test/live-light-settle.test.ts` | §11.5 |

## Deviations (for DR-n)

| # | Planned | Actual | Reason |
|---|---|---|---|
| DV-1 | Labels for the three permissions "in `common.ts`, following the existing key pattern" | A new map `common.rbac.permissions` with the three new values; by D37 the same three also in `securityAudit.rbac.permissions` | `common.ts` holds no permission labels at `acaff20`; the clients read `securityAudit.rbac.permissions.*` |
| DV-2 | A test that pins a count is edited by design | No existing assertion edited | No test pins a changed count |
| DV-3 | Three test files written | Two written (three tests added), `sim-contract.test.ts` untouched | Nothing to change there; the added tests make the counts and the label coverage machine-checked |
| DV-4 | Write paths of the plan row W16 | One more path, `packages/shared/src/i18n/en/security-audit.ts`, by the controller's ruling D37 | Closes F-1 at the path the clients read |

## Decisions

| # | Decision | State |
|---|---|---|
| DN-1 | Where the three permission labels must live so that the mobile Profile sheet shows them | **Ruled: option A (D37); executed** |
| DN-2 | Label wording: "Paired device revoked", "Biometric sign-in changed", "Manage pairing and paired devices", "Manage users and roles", "Use the demo controls" | **Ruled: accepted (D37)** |
| DN-3 | P23 recipe for an empty pre-image | **Ruled: `git apply --allow-empty` (D37)** |
| DN-4 | KI-24 (F-9): how this task's gates treat the known flaky web test | **Open, controller.** Options: accept it by name at gates with one re-run; or have a controller row or W75 change line 409 to `await within(…).findAllByRole('row')` as a recorded by-design test change (L-5) |
| DN-5 | Add `packages/shared/src/i18n/en/security-audit.ts` to the multi-writer paths (F-11) | **Open, controller** (text only) |

## Rollback (R-CO)

The row is one unit (the stricter `Permission` test needs the labels of the follow-up):
`git checkout acaff20 -- <the six files>` followed by `git apply --allow-empty` of the two 0-byte
pre-images; or, once a later row has written `common.ts` or `security-audit.ts`,
`git apply -R .cache/rollback/W16b.post.patch` and `git apply -R .cache/rollback/W16.post.patch`
(both checked with `--check`, not executed). Commands in full: output document §11.8.
