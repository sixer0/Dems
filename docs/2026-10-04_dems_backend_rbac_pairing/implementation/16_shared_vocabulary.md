---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: coder-execution
blueprint_row: 38
plan_row: W16 (wave B1; contract-owner slot, first holder, P17)
source_plan: /docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
evidence_tier: 3 (mechanical output: statement plus command output)
status: complete (first return 07:40 WIB: needs-review on DN-1; closed by the follow-up of section 11 under decision D37)
---

# 16 Shared vocabulary, additive (blueprint step 38, plan row W16)

Row, verbatim: [W16] Shared vocabulary, additive only: 3 permissions (`PAIRING_MANAGE`,
`USER_ADMIN`, `DEMO_CONTROL`), 3 SUPERVISOR grants, 9 audit types with their categories, English
labels; a test that pins a count is edited by design and named in the log (GP-06). Writes:
`packages/shared/src/sim/vocabulary.ts`, `packages/shared/src/sim/auth.ts`,
`packages/shared/src/i18n/en/common.ts`,
`packages/shared/test/{i18n-vocabulary-sync,auth,sim-contract}.test.ts`. Slot: contract owner
(first holder). Implements AC-B-62; input to AC-B-17. Rollback R-CO.

**Result: every item of the row is written and verified. One point needs a controller ruling
before the row can be called complete** (section 7, finding F-1): the mobile Profile sheet reads
permission labels at `securityAudit.rbac.permissions.*`, a map in a file this row may not write, so
a signed-in SUPERVISOR now sees three raw keys there in Simulated mode. No test covers that screen
for a SUPERVISOR, so every suite is green.

**Update, 07:41 to 07:49 WIB (decision D37, option A): closed.** The controller extended the row's
write paths by `packages/shared/src/i18n/en/security-audit.ts`; the three labels are now in the map
the Profile sheet reads, and the sync test requires every permission to be labelled there.
**Section 11 holds the follow-up and supersedes** the cells of sections 2, 5.2, 7 (F-1), 8 (DN-1)
and 9 that it names. Sections 1 to 10 are kept as written at the first return.

| Field | Value |
|---|---|
| Counts after the row | 12 permissions, 53 audit types (53 category entries, 8 categories), 18 grants: INVESTIGATOR 4, SUPERVISOR 10, TECHNICIAN 4; 46 event types (none added) |
| Simulator diff against `acaff20` | 2 files, 32 lines added, 0 removed: `vocabulary.ts` 27 / 0, `auth.ts` 5 / 0 (section 3) |
| Files written | Five of the six owned paths; `sim-contract.test.ts` needed no change (section 2) |
| Existing assertions edited (GP-06) | **None.** No existing test in the three workspaces pins a count that this row changes (section 5) |
| Tests added | 3, in two existing files of `@dems/shared` (section 5) |
| Final run | shared 587 of 587 in 31 files; core-web 438 of 438 in 39 files; mobile 833 of 833 in 72 suites; typecheck and lint of the three workspaces exit 0 (section 4) |
| Reference-hash files (D25, D31) | Unchanged: the three `git hash-object` values equal the recorded ones (section 4.5) |
| Row window | Pre-image saved 07:23:21 WIB; final gate 07:33:24 to 07:35:30 WIB |
| Sandbox bypass | None. Every command ran inside the sandbox |
| Processes started | Short-lived `node`, `npm`, `vitest`, `jest`, `tsc`, `oxlint`, `eslint` runs only; each ended by itself. No port bound, no database, no network |
| Packages, manifests | None installed; no `package.json` or lockfile touched |
| Shared trackers | Not written (parallel run, P8): `status_tasks.md`, `delegation_progress_report.md`, `decisions/decisions.md`, `masterplan/02_plan.md`, `implementation/99_implementation_report.md` |

## 1. What was added

### 1.1 Permissions and grants

Source: specification §4.3, §4.4, §19.1; decision D11 (ADQ-9), D13.

| # | Permission | State | Holder | Label (English) | Label key |
|--:|---|---|---|---|---|
| 10 | `PAIRING_MANAGE` | new | SUPERVISOR | Manage pairing and paired devices | `common.rbac.permissions.PAIRING_MANAGE` |
| 11 | `USER_ADMIN` | new | SUPERVISOR | Manage users and roles | `common.rbac.permissions.USER_ADMIN` |
| 12 | `DEMO_CONTROL` | new | SUPERVISOR | Use the demo controls | `common.rbac.permissions.DEMO_CONTROL` |

The nine earlier permissions keep their values, their order and their labels
(`securityAudit.rbac.permissions.*`, `packages/shared/src/i18n/en/security-audit.ts:301-311`).

Role table after the row (`packages/shared/src/sim/auth.ts:46-72`), in the simulator's order:

| Role | Grants | Permissions |
|---|--:|---|
| INVESTIGATOR | 4 | `SESSION_START`, `SESSION_NOTE`, `EVIDENCE_VIEW`, `DIAGNOSTICS_RUN` |
| SUPERVISOR | 10 | the four of INVESTIGATOR, `EVIDENCE_REVIEW`, `EVIDENCE_EXPORT`, `AUDIT_EXPORT`, **`PAIRING_MANAGE`, `USER_ADMIN`, `DEMO_CONTROL`** |
| TECHNICIAN | 4 | `EVIDENCE_VIEW`, `DEVICE_MANAGE`, `DIAGNOSTICS_RUN`, `MAINTENANCE` |
| Total | 18 | 15 at `acaff20` plus 3 |

This equals the matrix of specification §4.4 cell by cell; the new test of section 5 pins it.

### 1.2 Audit types

Source: specification §13.1, §19.2. Categories are exactly the ones the specification assigns;
none was left open. All nine use one of the existing eight categories. No event type was added.

| # | Audit type | Category | Label (English), key `common.auditType.<TYPE>` |
|--:|---|---|---|
| 45 | `ACCESS_DENIED` | SECURITY | Access denied |
| 46 | `PAIRING_CODE_ISSUED` | PAIRING | Pairing code issued |
| 47 | `PAIRING_CODE_CLOSED` | PAIRING | Pairing code closed |
| 48 | `DEVICE_REVOKED` | PAIRING | Paired device revoked |
| 49 | `DEVICE_CREDENTIAL_ROTATED` | PAIRING | Device credential rotated |
| 50 | `ROLE_CHANGED` | SECURITY | Role changed |
| 51 | `USER_ENABLED` | SECURITY | User enabled |
| 52 | `USER_DISABLED` | SECURITY | User disabled |
| 53 | `BIOMETRIC_ENROLLMENT_CHANGED` | AUTH | Biometric sign-in changed |

The nine are appended after `SYSTEM_BOOT`, so the first 44 keep their order. "Device paired" stays
`PAIRING_SUCCESS` (specification §19.2).

### 1.3 Choices made where the documents left wording open

| # | Choice | Reason |
|---|---|---|
| C-1 | The three permission labels sit in a new map `common.rbac.permissions`, inside the existing `common.rbac` object | The row's only i18n write path is `common.ts`. The sub-path `rbac.permissions.<WIRE VALUE>` repeats the existing `securityAudit.rbac.permissions.<WIRE VALUE>`, so a client changes only the namespace prefix. See F-1 for what this does not solve |
| C-2 | Only the three new permissions are labelled in `common.ts`; the nine earlier labels are not copied | The row says "labels for the 3 permissions". Copying nine strings would create a second source for existing copy (specification of the clients, TS-7: existing keys and strings do not change) |
| C-3 | Permission wording: "Manage pairing and paired devices", "Manage users and roles", "Use the demo controls" | Tone of the nine neighbours (short verb phrases: "Manage devices", "Run diagnostics", "Export the audit log"). "Manage devices" already means cameras and microphones (`DEVICE_MANAGE`), so the pairing label names pairing. "Users & Roles" and "Paired Devices" are the page names of the client specification §10; "demo controls" is the wording of specification §4.5 |
| C-4 | `DEVICE_REVOKED` reads "Paired device revoked", not "Device revoked" | The audit lists also show camera and microphone rows ("Device command sent"); the registry holds phones and tablets, so "Tablet" (as in "Tablet paired") would be wrong |
| C-5 | `BIOMETRIC_ENROLLMENT_CHANGED` reads "Biometric sign-in changed" | The app's own term is "biometric sign-in" (`apps/mobile/src/i18n/en.mobile.ts:54`), next to "Sign-in succeeded", "Sign-in failed" in the same map. The row's detail `enabled` says which way it changed |
| C-6 | Three tests were added rather than none | No existing test pins the counts (section 5), so without them nothing in the suite would notice a removed grant, a wrong category or a missing permission label. All three are new `it` blocks; no existing test body changed |

## 2. Files written

| Path | Change | Lines added / removed |
|---|---|---|
| `packages/shared/src/sim/vocabulary.ts` | 3 permissions (`:33-37`), 9 audit types (`:348-359`), 9 category entries (`:409-418`) | 27 / 0 |
| `packages/shared/src/sim/auth.ts` | 3 SUPERVISOR grants (`:60-64`) | 5 / 0 |
| `packages/shared/src/i18n/en/common.ts` | 9 audit-type labels (`:401-410`), 3 permission labels in `rbac.permissions` (`:566-574`) | 19 / 0 |
| `packages/shared/test/auth.test.ts` | Import of `Permission` (`:12`); one new test (`:243-289`) | 48 / 0 |
| `packages/shared/test/i18n-vocabulary-sync.test.ts` | Two new tests (`:114-158`) | 45 / 0 |
| `packages/shared/test/sim-contract.test.ts` | **Not changed** (hash equals `acaff20`: `4f1741a2…`). It pins no permission, grant or audit-type count |  0 / 0 |
| `.cache/rollback/W16.pre.patch` (git-ignored) | P23 pre-image, saved before the first edit; 0 bytes, because all six paths equalled `acaff20` | |
| `.cache/rollback/W16.post.patch` (git-ignored) | The row's whole change as one patch (10,065 bytes); `git apply --check -R` passes | |

`git hash-object` after the row:

```
d3236e0631f7130d91ac8685bf8d0a93e8288efb  packages/shared/src/sim/vocabulary.ts
5f89ac94a122d470a578e760da3239fa28f99566  packages/shared/src/sim/auth.ts
5a24a2978eb3440b2b209ebfef9246c05ce4bd18  packages/shared/src/i18n/en/common.ts
76fcca1f176ce6ce8d41830e565a0cebd497a338  packages/shared/test/i18n-vocabulary-sync.test.ts
f2d5271794a1e196259f63d29aa851ee7745a38b  packages/shared/test/auth.test.ts
4f1741a24afb46c636e6e2cd658a7d9a5b0f7260  packages/shared/test/sim-contract.test.ts
```

Before the row all six equalled their blob at `acaff20` (`43354ebe…`, `e62d2942…`, `ab73a0ef…`,
`dec18301…`, `6c0817fc…`, `4f1741a2…`).

## 3. AC-B-62: the simulator diff is additions only, in two files

Command: `git diff acaff20 --numstat -- packages/shared/src/sim`, then the removed lines counted
with `git diff acaff20 -- packages/shared/src/sim | grep -cE '^-[^-]'` (07:35:49 WIB).

```
--- numstat acaff20 -- packages/shared/src/sim
5	0	packages/shared/src/sim/auth.ts
27	0	packages/shared/src/sim/vocabulary.ts
--- removed lines
0
```

`git diff acaff20 --stat -- packages/shared/src/sim`: `2 files changed, 32 insertions(+)`.
No trailing comma had to change: every list already ended with one.

Hunks (`git diff acaff20 -U0`):

```
+++ b/packages/shared/src/sim/auth.ts
@@ -59,0 +60,5 @@ export const ROLE_PERMISSIONS = {
+++ b/packages/shared/src/sim/vocabulary.ts
@@ -32,0 +33,5 @@ export const Permission = {
@@ -342,0 +348,12 @@ export const AuditType = {
@@ -391,0 +409,10 @@ export const AUDIT_TYPE_CATEGORY = {
```

Counts, printed by a read-only script that imports the three modules (`node --import tsx`):

```
permissions 12 PAIRING_MANAGE,USER_ADMIN,DEMO_CONTROL
auditTypes 53 categoryMapKeys 53 categories 8
eventTypes 46
grants {"INVESTIGATOR":4,"SUPERVISOR":10,"TECHNICIAN":4} total 18
new audit types: ACCESS_DENIED=SECURITY PAIRING_CODE_ISSUED=PAIRING PAIRING_CODE_CLOSED=PAIRING DEVICE_REVOKED=PAIRING DEVICE_CREDENTIAL_ROTATED=PAIRING ROLE_CHANGED=SECURITY USER_ENABLED=SECURITY USER_DISABLED=SECURITY BIOMETRIC_ENROLLMENT_CHANGED=AUTH
auditType labels missing now: 0 | missing with the acaff20 common.ts (negative control): 9 ACCESS_DENIED,PAIRING_CODE_ISSUED,PAIRING_CODE_CLOSED,DEVICE_REVOKED,DEVICE_CREDENTIAL_ROTATED,ROLE_CHANGED,USER_ENABLED,USER_DISABLED,BIOMETRIC_ENROLLMENT_CHANGED
permission labels: securityAudit.rbac.permissions 9 + common.rbac.permissions 3 | unlabelled: 0
```

**Simulator behaviour.** No simulator file other than the two names a new value, so no action
checks a new permission and no code path emits a new audit type:

```
--- occurrences per file under packages/shared/src/sim   (grep -rc -E "\b(<the 12 names>)\b")
packages/shared/src/sim/vocabulary.ts:21
packages/shared/src/sim/auth.ts:3
```

21 = 3 permission lines + 9 type lines + 9 category lines; 3 = the three grants. The existing
simulator tests and the 61 simulator-dependent client test files pass with no edit (section 4).
`packages/shared/openapi/openapi.json` is unchanged and `gen-openapi.ts --check` prints
"packages/shared/openapi/openapi.json is up to date" (exit 0).

## 4. Verification (final run on the finished tree, 07:33:24 to 07:35:30 WIB)

### 4.1 Typecheck and lint of the three workspaces

```
typecheck @dems/shared exit=0      (tsc --noEmit)
lint @dems/shared exit=0           (oxlint)
typecheck @dems/core-web exit=0    (tsc -b)
lint @dems/core-web exit=0         (oxlint)
typecheck @dems/mobile exit=0      (tsc --noEmit)
lint @dems/mobile exit=0           (eslint .)
```

The web console types its `t()` keys from the shared resources
(`apps/core-web/src/i18n.ts:10-18`) and prints audit rows as `common.auditType.<row.type>`, so its
typecheck passing with 53 audit types is a second proof that all 53 labels exist.

### 4.2 `npm run test -w @dems/shared -- --maxWorkers=2`

```
 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/packages/shared
 Test Files  31 passed (31)
      Tests  587 passed (587)
   Start at  07:34:12
   Duration  2.44s (tests 50%, import 33%, transform 14%, worker 2%)
```

31 files = the 28 of the baseline plus three `client-*` files of another row (step 34).

### 4.3 `npm run test -w @dems/core-web -- --maxWorkers=2`

```
 Test Files  39 passed (39)
      Tests  438 passed (438)
   Start at  07:34:15
   Duration  36.38s (tests 69%, import 13%, environment 11%, setup 4%, transform 2%)
```

### 4.4 `npm run test -w @dems/mobile -- --maxWorkers=2`

```
Test Suites: 72 passed, 72 total
Tests:       833 passed, 833 total
Snapshots:   0 total
Time:        37.965 s
Ran all test suites.
```

Jest also prints "A worker process has failed to exit gracefully"; the same line is in the run
made before this row's first edit (07:24 WIB), so it is not caused by this row.

### 4.5 The three reference-hash web test files (D25, D31)

```
9e8b97c80da596e0ae6e9b37aa69b64e99e3bbdd  apps/core-web/src/test/sim-fetch.test.ts
71f6f0337f2339d8e8d66ef232d7334dc0b67d1d  apps/core-web/src/features/storage/__tests__/storage-page.test.tsx
1ab07579e928b9b545003899ec3265d4b8b6c762  apps/core-web/src/features/dashboard/__tests__/dashboard.test.tsx
```

Each equals the recorded value (D25: the first two; D31: the third).
`git diff acaff20 --name-only -- apps/core-web apps/mobile | grep '\.test\.'` lists exactly these
three files; `packages/shared/test` differs in `auth.test.ts` and `i18n-vocabulary-sync.test.ts`
only (plus the three untracked `client-*` files of step 34).

### 4.6 Root commands, and noise from a row in flight (P11)

| Run | Time (WIB) | `npm run typecheck` (root) | `npm run lint` (root) |
|---|---|---|---|
| 1 | about 07:31:40 | exit 0, all five workspaces | exit 0 |
| 2 | 07:33:24 | **exit 2**, `@dems/core-server` only | exit 0 |
| 3 | 07:35:49 | **exit 2**, `@dems/core-server` only | not repeated |

Runs 2 and 3 fail with 18 errors, all in one file:
`apps/core-server/src/plugins/response-headers/__tests__/response-headers.test.ts` (modified
07:31 WIB by another row; the whole `apps/core-server/` folder is untracked work in flight). The
file does not import the vocabulary (`grep -n -E "vocabulary|Permission|AuditType|@dems/shared"`
finds nothing) and the errors are about `inject` option types. In the same runs `@dems/shared`,
`@dems/core-web`, `@dems/mobile` and `@dems/mock-core` pass. The cause had not ended when this row
closed, so a later re-run belongs to that file's row. Root lint prints one warning, also in another
row's file: `apps/core-server/src/plugins/logger/__tests__/log-capture.test.ts:214:20`
(`no-unsafe-optional-chaining`).

## 5. Tests: edited assertions (GP-06), added tests, ledger (P24)

### 5.1 Which existing tests pin a count (the answer to GP-06)

Method: the production change was made first and the three suites were run **before any test file
was touched**.

| Workspace | Run with the production change and unedited tests | Failures |
|---|---|---|
| `@dems/shared` | 07:29:01 WIB: 31 files, 584 of 584 | 0 |
| `@dems/core-web` | 07:29:33 WIB: 39 files, 438 of 438 | 0 |
| `@dems/mobile` | 72 suites, 833 of 833 (ended 07:30:45 WIB) | 0 |

**No existing assertion was edited, in any workspace.** Nothing pins "9 permissions", "44 audit
types" or the grants per role:

| Candidate | Why it does not break |
|---|---|
| `packages/shared/test/auth.test.ts:231-242` | Checks nine single `roleHas` facts and the three role names; all still true |
| `packages/shared/test/i18n-vocabulary-sync.test.ts:71,85-87` (`common.auditType`) | Derived from the vocabulary, not a number. It would have failed without the nine new labels (negative control in section 3: 9 missing with the `acaff20` label file) |
| `packages/shared/test/i18n-vocabulary-sync.test.ts:109-113` | Derived: category-map keys equal the audit-type values |
| `packages/shared/test/openapi.test.ts:132` | Compares each operation's role metadata with the holders of its permission; the holders of the nine earlier permissions did not change |
| `apps/core-web/src/features/security-audit/__tests__/security-audit.test.tsx:409` (10 matrix rows) | The web matrix uses its own nine-entry list (`features/security-audit/model.ts:434-444`), as the client specification says (FC-3, TS-8) |
| `apps/mobile/src/features/settings/settings-screen.test.tsx:296-308` (Profile sheet) | Signs in the Investigator, whose grants did not change. See F-1 |

**Pinned outside the row's three files: nothing.** No test in `packages/shared/test/`,
`apps/core-web` or `apps/mobile` fails, so there is nothing to hand to another row.

### 5.2 Tests added (three, all new `it` blocks)

| Test | File:line | What it pins |
|---|---|---|
| `pins 12 permissions and 18 grants: INVESTIGATOR 4, SUPERVISOR 10, TECHNICIAN 4 (W16)` | `packages/shared/test/auth.test.ts:246` (block `:243-289`; import `:12`) | The 12 values in order; key equals wire value; the whole role table as a literal (specification §4.4); 4 / 10 / 4 and 18; no duplicate grant; the three new permissions on SUPERVISOR only |
| `Permission: 12 values, each labelled in securityAudit.rbac.permissions or common.rbac.permissions (W16)` | `packages/shared/test/i18n-vocabulary-sync.test.ts:118` (block `:114-134`) | Every permission has a non-empty label in one of the two maps; a value labelled in both reads the same; neither map has a key that is not a permission. Holds whichever way F-1 is ruled |
| `AuditType: 53 values; the nine server-written types sit in the existing categories (W16)` | `packages/shared/test/i18n-vocabulary-sync.test.ts:138` (block `:136-158`) | 53 types, 8 categories, 46 event types; the nine types with their category; key equals wire value; the nine are the last nine |

### 5.3 Can the tests fail? (ten single changes on a scratch copy)

The shared sources and the two test files were copied to a scratch folder under `$TMPDIR`; each
change was applied to the copy only, the two files were run, and the copy was restored. The
repository files were never mutated. Control before and after: `Test Files 2 passed (2)`,
`Tests 51 passed (51)`.

| # | Single change | Result | Failing test |
|---|---|---|---|
| M1 | Drop the SUPERVISOR grant `DEMO_CONTROL` | 1 failed, 50 passed | `pins 12 permissions and 18 grants …` |
| M2 | Grant `USER_ADMIN` to TECHNICIAN | 1 failed, 50 passed | `pins 12 permissions and 18 grants …` |
| M3 | Category of `ROLE_CHANGED` becomes SYSTEM | 1 failed, 50 passed | `AuditType: 53 values …` |
| M4 | Drop `DEMO_CONTROL` from the permission set | 2 failed, 49 passed | `pins 12 permissions …`; `Permission: 12 values …` |
| M5 | Drop the label `common.rbac.permissions.USER_ADMIN` | 1 failed, 50 passed | `Permission: 12 values …` |
| M6 | Drop the label `common.auditType.ACCESS_DENIED` | 1 failed, 50 passed | the existing `common.auditType labels exactly the vocabulary values` |
| M7 | A key that is no permission in `common.rbac.permissions` | 1 failed, 50 passed | `Permission: 12 values …` |
| M8 | Drop the category of `BIOMETRIC_ENROLLMENT_CHANGED` | 2 failed, 49 passed | `AuditType: 53 values …`; the existing `every audit type has a category …` |
| M9 | `SESSION_START` labelled differently in the two maps | 1 failed, 50 passed | `Permission: 12 values …` |
| M10 | Drop the audit type `USER_DISABLED` | 2 failed, 49 passed | `AuditType: 53 values …`; the existing `common.auditType labels …` |

### 5.4 Test ledger (P24)

| Workspace | Before this row (run 07:23 to 07:24 WIB, before the first edit) | After (final run) | Added by this row |
|---|---|---|---|
| `@dems/shared` | 584 tests in 31 files, all pass (baseline 508 in 28 plus 76 tests in three `client-*` files of step 34) | 587 tests in 31 files, all pass | **3 tests, 0 files**: 1 in `auth.test.ts`, 2 in `i18n-vocabulary-sync.test.ts` |
| `@dems/core-web` | 438 tests in 39 files, all pass | 438 tests in 39 files, all pass | 0 |
| `@dems/mobile` | 833 tests in 72 suites, all pass | 833 tests in 72 suites, all pass | 0 |
| `@dems/core-server`, `@dems/mock-core` | not run by this row | not run | 0 |

Ledger line for `@dems/shared`: expected total = 508 + the additions of step 34 (76 at the time of
this run) + 3.

## 6. Write paths (P6) and what was not touched

Written: the five source and test paths of section 2, the two patch files under `.cache/rollback/`,
this document and the progress file. Not written: `packages/shared/src/api/`, any `package.json`,
`packages/shared/src/i18n/en/security-audit.ts`, anything under `apps/`, and every other file under
`packages/shared/src/sim/`.

The mobile app has no label file of its own for permissions or audit types
(`apps/mobile/src/i18n/en.mobile.ts`, `features.ts`, `resources.ts` hold neither): it reads the
shared `common.auditType.*` and `securityAudit.rbac.permissions.*`. No mobile sync test fails.

## 7. Findings for the controller (P22)

| # | Finding | Evidence | Needs |
|---|---|---|---|
| **F-1** | **The mobile Profile sheet shows three raw keys for a SUPERVISOR in Simulated mode.** It lists every grant of the operator's role from the shared table and prints `t('securityAudit.rbac.permissions.<P>')`. That map has the nine earlier permissions only and lives in a file this row may not write (owner W75, wave C3). The three labels this row wrote are at `common.rbac.permissions.*`, which no screen reads yet. The plan expected the list to grow (FC-3: "the mobile profile sheet does list the three new permissions … Row 26 (W16) adds labels") but names `common.ts` as the label file | `apps/mobile/src/features/settings/profile-sheet.tsx:51-56`; `settings-model.ts:75-77`; `packages/shared/src/i18n/en/security-audit.ts:301-311`. Executed with the real i18next and the app's options (the screen itself was not rendered): see the output below. No test catches it: `settings-screen.test.tsx:296-308` signs in the Investigator | **A ruling** (section 8, DN-1) |
| F-2 | The web console is unchanged in Simulated mode: its matrix keeps nine rows from its own list, and no web screen lists a role's grants | `apps/core-web/src/features/security-audit/model.ts:434-444`; `security-audit.test.tsx:409` passes unedited | Nothing. W75 renders twelve rows in Live mode |
| F-3 | In Live mode the tablet's "last pairing event" line will pick up the four new PAIRING-category types, because it takes the newest audit row whose category is PAIRING. A code issued on the portal for another device, or another device's revocation, would then be shown on this tablet's Pair screen. Simulated mode is unaffected (the simulator never writes them) | `apps/mobile/src/features/pairing/pairing-model.ts:146-153`; `pairing-connection.tsx:62,99` | Input for W57 (mobile pairing flow): filter by type, or by this device |
| F-4 | The web lenses classify by a fixed type list, not by category: the Authentication panel takes five `AUTH_*` types, the custody lens three export types. `BIOMETRIC_ENROLLMENT_CHANGED` (category AUTH) and `ACCESS_DENIED` therefore appear only in the audit log table in Live mode | `apps/core-web/src/features/security-audit/model.ts:381-390` | Input for W75; no change needed for Simulated mode |
| F-5 | `Permission` was not covered by the i18n sync test before this row (known, analysis ADQ-9 evidence). It is now, across both label maps | `i18n-vocabulary-sync.test.ts:118` | Nothing |
| F-6 | The rollback recipe of P23 fails for an empty pre-image: `git apply .cache/rollback/<row>.pre.patch` exits 128 ("No valid patches in input") on git 2.55.0 when the file has 0 bytes. `--allow-empty` makes it exit 0. The pre-images of W01b, W03, W05, W08 and W12 are also 0 bytes | `git apply --check .cache/rollback/W16.pre.patch` exit 128; with `--allow-empty` exit 0 | The controller may add `--allow-empty` to P23, or state that an empty pre-image means "skip the apply" |
| F-7 | Root `npm run typecheck` exits 2 at 07:33 and 07:35 WIB because of another row's new test file in `apps/core-server`; one lint warning in another of its files | Section 4.6 | The owning row (core-server scaffold) |
| F-8 | Host load while this row ran: 1-minute load average 2.8 to 6.0. No test timed out | `uptime` at 07:25, 07:34, 07:35 WIB | Nothing |

Output for F-1 (`node --import tsx`, i18next from the repository, the shared resources, the options
of `apps/mobile/src/i18n/index.ts:47-60`), one line per SUPERVISOR grant in the order of the sheet:

```
SESSION_START    => "Start sessions"
SESSION_NOTE     => "Add notes and markers"
EVIDENCE_VIEW    => "View evidence"
DIAGNOSTICS_RUN  => "Run diagnostics"
EVIDENCE_REVIEW  => "Review and archive evidence"
EVIDENCE_EXPORT  => "Export evidence"
AUDIT_EXPORT     => "Export the audit log"
PAIRING_MANAGE   => "securityAudit.rbac.permissions.PAIRING_MANAGE"
USER_ADMIN       => "securityAudit.rbac.permissions.USER_ADMIN"
DEMO_CONTROL     => "securityAudit.rbac.permissions.DEMO_CONTROL"
missing keys recorded: 3 translation:securityAudit.rbac.permissions.PAIRING_MANAGE translation:securityAudit.rbac.permissions.USER_ADMIN translation:securityAudit.rbac.permissions.DEMO_CONTROL
same three through common.rbac.permissions: Manage pairing and paired devices | Manage users and roles | Use the demo controls
```

Scope of F-1: the development tree only. The released 0.1.0 packages are not rebuilt from it. It
affects one sheet, for one role, and only its last three lines.

## 8. Deviations from the plan and decisions needed

| # | Item | Detail |
|---|---|---|
| DN-1 | **Decision needed: where the three permission labels must live so that the mobile Profile sheet shows them** | Option A (recommended): three added lines in `packages/shared/src/i18n/en/security-audit.ts`, inside `rbac.permissions` after `MAINTENANCE` (line 310), with the wording of section 1.1. That file is W75's and W75 has not started, so nothing collides; it becomes a two-writer path (W16 then W75) and needs a P23 pre-image. All twelve labels are then in the one map that the web matrix, the mobile sheet and the Users & Roles page can read. The three entries in `common.rbac.permissions` may stay (the sync test requires equal wording in both maps) or be removed again before W50 starts. Option B: a one-line change of the lookup in `apps/mobile/src/features/settings/profile-sheet.tsx:55` (W82's folder, wave C4), which needs the nine earlier labels copied into `common.rbac.permissions` first. Option C: accept the three raw keys until W82. This row did not write either file |
| DV-1 | Deviation: permission labels are a new map, not an addition to an existing map of `common.ts` | `common.ts` has no permission labels at `acaff20`; the existing ones are in `security-audit.ts`. Choice C-1 |
| DV-2 | Deviation: no existing assertion was edited, although the row expected count pins | None exists (section 5.1) |
| DV-3 | Deviation: three tests added in two of the row's three test files; the third file is unchanged | Choice C-6. `@dems/shared` ledger +3 |
| DN-2 | To record: label wording choices C-3, C-4, C-5 | Section 1.3 |
| DN-3 | To record: the P23 recipe and an empty pre-image | F-6 |

## 9. Rollback (R-CO)

The row's change is confined to five tracked files, all of which equalled `acaff20` before the row
(the pre-image is empty). From `/Users/gsp-budi/Documents/DEMS`:

```sh
git checkout acaff20 -- \
  packages/shared/src/sim/vocabulary.ts \
  packages/shared/src/sim/auth.ts \
  packages/shared/src/i18n/en/common.ts \
  packages/shared/test/auth.test.ts \
  packages/shared/test/i18n-vocabulary-sync.test.ts
git apply --allow-empty .cache/rollback/W16.pre.patch   # 0 bytes: restores nothing, exits 0
```

Equivalent, and safe once a later row (W50) has also written `common.ts`:
`git apply -R .cache/rollback/W16.post.patch`, which removes only this row's lines
(`git apply --check -R` passed at 07:35 WIB). `git checkout` writes the index as well as the
working tree, so it needs the sandbox bypass for git writes (P10). Not executed.

After a rollback every later consumer of the three permissions or the nine audit types stops
compiling; by plan those are W19 onward and the Core server modules.

## 10. Not done here

- The contract registry (`packages/shared/src/api/`): W19, the next holder of the contract slot.
- Any enforcement of the new permissions and any writer of the new audit types: the Core server.
- The web matrix in Live mode (W75), the Users & Roles page (W77), the mobile Settings row (W82).
- The fix of F-1: it needs DN-1. (Done afterwards: section 11.)

## 11. Follow-up: Profile sheet labels (D37, option A)

Controller rulings received after the first return (recorded by the controller as D37): the row is
accepted; DN-2 the label wording stands as written; DN-3 the P23 recipe uses
`git apply --allow-empty`; **DN-1 option A, executed here.** Window: 07:41:30 to 07:48:55 WIB.

### 11.1 What changed

| Path | Change | Lines added / removed against `acaff20` |
|---|---|---|
| `packages/shared/src/i18n/en/security-audit.ts` | Three labels and one comment line appended to the existing map `rbac.permissions`, after `MAINTENANCE` (`:311-314`). Nothing else in the file changed | 4 / 0 |
| `packages/shared/test/i18n-vocabulary-sync.test.ts` | The row's own `Permission` test made stricter (11.3). The two other tests of the file's W16 block are unchanged | 42 / 0 (was 45 / 0) |
| `.cache/rollback/W16b.pre.patch` (git-ignored) | P23 pre-image of `security-audit.ts`, saved at 07:41:30 WIB before the edit; 0 bytes, because the file equalled its blob at `acaff20` (`ebd9c9f411a6f13f0d0ddfc1cb6a7d857037c4d5`) | |
| `.cache/rollback/W16b.post.patch` (git-ignored) | The follow-up's change to `security-audit.ts` as one patch, 715 bytes | |
| `.cache/rollback/W16.post.patch` (git-ignored) | Regenerated: the five files of the first return with the stricter test, 9,796 bytes. The two post patches cover disjoint files | |

The added lines, verbatim (`git diff acaff20 -U0 -- packages/shared/src/i18n/en/security-audit.ts`):

```
@@ -310,0 +311,4 @@ export const securityAudit = {
+      // Backend task W16 (D37): the three permissions added to the sim `Permission` set.
+      PAIRING_MANAGE: 'Manage pairing and paired devices',
+      USER_ADMIN: 'Manage users and roles',
+      DEMO_CONTROL: 'Use the demo controls',
```

The wording is exactly that of `common.rbac.permissions` (`common.ts:571-573`).

**Not touched**, as instructed: `apps/mobile/**`, `packages/shared/src/api/**`, `common.ts` and every
other file. One consequence: the comment at `packages/shared/src/i18n/en/common.ts:566-569` still
says "The nine earlier ones are `securityAudit.rbac.permissions.*`". That is true but no longer the
whole picture (all twelve are there now). The next writer of `common.ts` (W50) may add four words.

### 11.2 Reference state of `security-audit.ts` for its later owner (W75)

`packages/shared/src/i18n/en/security-audit.ts` is now a two-writer path: W16 (this follow-up),
then W75. `git hash-object` after this edit:

```
e6f7c44fa3aedb655504727e08e95e5d3d727395  packages/shared/src/i18n/en/security-audit.ts
```

Blob at `acaff20`: `ebd9c9f411a6f13f0d0ddfc1cb6a7d857037c4d5`. W75 saves its own pre-image against
`acaff20` before its first edit (P23); that patch will hold exactly the four lines above.

Hashes of the row's files after the follow-up (supersedes the list of section 2 for the one file
that changed again):

```
e6f7c44fa3aedb655504727e08e95e5d3d727395  packages/shared/src/i18n/en/security-audit.ts
fd7e3d3770d12335110242ca45cc68f2f9e76191  packages/shared/test/i18n-vocabulary-sync.test.ts
d3236e0631f7130d91ac8685bf8d0a93e8288efb  packages/shared/src/sim/vocabulary.ts
5f89ac94a122d470a578e760da3239fa28f99566  packages/shared/src/sim/auth.ts
5a24a2978eb3440b2b209ebfef9246c05ce4bd18  packages/shared/src/i18n/en/common.ts
f2d5271794a1e196259f63d29aa851ee7745a38b  packages/shared/test/auth.test.ts
```

### 11.3 The sync test, so that this class of gap cannot return

`packages/shared/test/i18n-vocabulary-sync.test.ts:119` (block `:114-131`), replacing the test that
section 5.2 lists at `:118`:

`Permission: 12 values, each labelled in securityAudit.rbac.permissions; common.rbac.permissions agrees (W16)`

| Assertion | What it guarantees |
|---|---|
| `expectExactKeys('securityAudit.rbac.permissions', values(V.Permission))` | **Every** permission of the vocabulary has a non-empty label in the map the mobile Profile sheet and the web matrix read; the map has no key that is not a permission and no plural fragment. A new permission without a label there fails the suite |
| Every key of `common.rbac.permissions` is a permission | No stray key in the second map |
| Every label of `common.rbac.permissions` equals the label of the same key in `securityAudit.rbac.permissions` | The "equal wording where both maps have it" rule is kept |

The `AuditType` test moved from `:138` to `:135` (block `:133-155`); its body is unchanged. The
test count of the file is unchanged, so the ledger line of section 5.4 stands: this row adds 3
tests to `@dems/shared`.

Can it fail? Eight single changes on a scratch copy under `$TMPDIR` (the repository files were not
mutated). Control before and after: `Test Files 2 passed (2)`, `Tests 51 passed (51)`.

| # | Single change | Result | Failing test |
|---|---|---|---|
| N1 | Drop `securityAudit.rbac.permissions.USER_ADMIN` | 1 failed, 50 passed | `Permission: 12 values …` |
| N2 | Drop all three new labels from `securityAudit` (the state of F-1) | 1 failed, 50 passed | `Permission: 12 values …` |
| N3 | Other wording in `common.rbac.permissions` | 1 failed, 50 passed | `Permission: 12 values …` |
| N4 | Other wording in `securityAudit.rbac.permissions` | 1 failed, 50 passed | `Permission: 12 values …` |
| N5 | A key that is no permission in `securityAudit.rbac.permissions` | 1 failed, 50 passed | `Permission: 12 values …` |
| N6 | A key that is no permission in `common.rbac.permissions` | 1 failed, 50 passed | `Permission: 12 values …` |
| N7 | A 13th permission in the vocabulary without a label | 2 failed, 49 passed | `Permission: 12 values …`; `pins 12 permissions and 18 grants …` |
| N8 | An empty label in `securityAudit.rbac.permissions` | 1 failed, 50 passed | `Permission: 12 values …` |

N2 is the state the first return left: the suite now refuses it.

### 11.4 The lookup of the Profile sheet (07:42:10 WIB)

Same script as in section 7 (the real i18next, the shared resources, the options of
`apps/mobile/src/i18n/index.ts:47-60`; the screen itself is not rendered):

```
SESSION_START    => "Start sessions"
SESSION_NOTE     => "Add notes and markers"
EVIDENCE_VIEW    => "View evidence"
DIAGNOSTICS_RUN  => "Run diagnostics"
EVIDENCE_REVIEW  => "Review and archive evidence"
EVIDENCE_EXPORT  => "Export evidence"
AUDIT_EXPORT     => "Export the audit log"
PAIRING_MANAGE   => "Manage pairing and paired devices"
USER_ADMIN       => "Manage users and roles"
DEMO_CONTROL     => "Use the demo controls"
missing keys recorded: 0
same three through common.rbac.permissions: Manage pairing and paired devices | Manage users and roles | Use the demo controls
```

And the counts script: `permission labels: securityAudit.rbac.permissions 12 + common.rbac.permissions 3 | unlabelled: 0`;
the line "permissions without a label at securityAudit.rbac.permissions" is empty.

F-1 is closed. Limit on the evidence: the sheet was not rendered on a device or in jest as a
SUPERVISOR; `apps/mobile/**` holds no such test and this row may not add one. W82 owns that folder.

### 11.5 Verification (07:42:37 to 07:48:55 WIB)

| Command | Result |
|---|---|
| `npm run typecheck -w @dems/shared` / `-w @dems/core-web` / `-w @dems/mobile` | exit 0 / exit 0 / exit 0 |
| `npm run lint -w @dems/shared` / `-w @dems/core-web` / `-w @dems/mobile` | exit 0 / exit 0 / exit 0 |
| `npm run test -w @dems/shared -- --maxWorkers=2` (07:42:58) | exit 0: `Test Files  31 passed (31)`, `Tests  587 passed (587)` |
| The same, repeated at 07:48:55 | exit 0: `Test Files  37 passed (37)`, `Tests  680 passed (680)`. Another row (the light Live API) added six `live-light-*` files with 93 tests in between; this row's share is still 3 tests |
| `npm run test -w @dems/mobile -- --maxWorkers=2` | exit 0: `Test Suites: 72 passed, 72 total`, `Tests:       833 passed, 833 total` |
| `npm run test -w @dems/core-web -- --maxWorkers=2`, run 1 (07:43:01) | **exit 1**: `Test Files  1 failed \| 38 passed (39)`, `Tests  1 failed \| 437 passed (438)`. See 11.6 |
| The same, runs 2, 3, 4 (07:45:59, 07:46:35, 07:47:13) | exit 0 each: `Test Files  39 passed (39)`, `Tests  438 passed (438)` |
| `security-audit.test.tsx` alone, five times (07:45:02 to 07:45:24) | `Tests  18 passed (18)` each |
| Root `npm run typecheck` (07:44) | exit 0, all five workspaces (the other row's file of section 4.6 compiles now) |
| Root `npm run lint` (07:44) | exit 0; three warnings in another row's new file `packages/shared/test/live-light-settle.test.ts:62:5`, `:268:55`, `:277:21` (`unicorn(no-thenable)`) |
| `node --import tsx packages/shared/scripts/gen-openapi.ts --check` | exit 0: "packages/shared/openapi/openapi.json is up to date" |

`git diff acaff20 --numstat` (07:48:47 WIB):

```
### security-audit.ts
4	0	packages/shared/src/i18n/en/security-audit.ts        (removed lines: 0)
### packages/shared/src/sim
5	0	packages/shared/src/sim/auth.ts
27	0	packages/shared/src/sim/vocabulary.ts                (removed lines: 0)
### the other paths of the row
19	0	packages/shared/src/i18n/en/common.ts
48	0	packages/shared/test/auth.test.ts
42	0	packages/shared/test/i18n-vocabulary-sync.test.ts
```

The three reference-hash web test files are still unchanged:

```
9e8b97c80da596e0ae6e9b37aa69b64e99e3bbdd  apps/core-web/src/test/sim-fetch.test.ts
71f6f0337f2339d8e8d66ef232d7334dc0b67d1d  apps/core-web/src/features/storage/__tests__/storage-page.test.tsx
1ab07579e928b9b545003899ec3265d4b8b6c762  apps/core-web/src/features/dashboard/__tests__/dashboard.test.tsx
```

### 11.6 The one failed web run: the predecessor's known flaky test KI-24, not this change

Run 1 failed in one test:
`src/features/security-audit/__tests__/security-audit.test.tsx > SecurityAuditPage > shows the DEMO Ed25519 certificate, the package verdicts and the three operators`,
at line 409, with `TestingLibraryElementError: Unable to find an accessible element with the role "row"`
and a DOM dump of an empty `<table … data-testid="rbac-matrix" role="grid" />`.

| Fact | Evidence |
|---|---|
| It is recorded as a flaky test of the predecessor task, with the same line and the same empty-table dump, on 2026-10-01 | `docs/2026-09-30_dems_demo_stack_setup/verification/01_verification.md:145` (NF-1) and `:196` (KI-24): the assertion reads the rows synchronously while `mountPage()` waits only for `panel-rbac` (`security-audit.test.tsx:75-87`, comment on line 84: the page mounts in stages) |
| The label map cannot change the row count | The panel builds its rows from its own nine-entry list (`apps/core-web/src/features/security-audit/model.ts:434-444`, `rbac-panel.tsx:88`); the only use of the map in `apps/core-web/src` is the per-key lookup at `rbac-panel.tsx:90`. The dump shows no header row either, which no label can cause |
| The folder equals `acaff20` | `git diff acaff20 --stat -- apps/core-web/src/features/security-audit` is empty |
| It did not repeat | Three further full runs and five runs of the file alone all pass |

So: 1 failure in 4 full web runs after the follow-up, 0 in 3 before it; an A/B under equal load was
not run, and the cause stated in the predecessor record is itself a hypothesis (the React Aria
collection had not committed its second pass). What is certain is that the same failure existed
before this task. **This task's gates accept no failure (D31), and neither the plan nor the
blueprint lists KI-24.** The file belongs to W75 (`apps/core-web/src/features/security-audit/**`);
the predecessor's proposed fix is `await within(…).findAllByRole('row')` at line 409, which is a
change of an existing test and so needs a recorded decision (L-5).

### 11.7 Findings and decisions added by the follow-up

| # | Item | Needs |
|---|---|---|
| F-1 | **Closed** by 11.1 to 11.4 | Nothing |
| F-9 | The predecessor's flaky web test KI-24 (`security-audit.test.tsx:409`) fired once at 07:43 WIB. It can fail any run of the web suite: the gate of every web client row, W89 and W97 (the backend gate W58 runs core-server and shared only) | A ruling: accept it by name at gates with a re-run, or let an early controller row or W75 apply the one-line `findAllByRole` fix as a recorded by-design test change |
| F-10 | The comment at `common.ts:566-569` describes the label maps as they were before D37 (true, incomplete) | W50, the next writer of `common.ts`, or leave |
| F-11 | `packages/shared/src/i18n/en/security-audit.ts` is a two-writer path now (W16, then W75): the plan's table of section 4.3 and the blueprint's multi-writer list do not have it yet | The controller adds the path; W75's reference state is the hash of 11.2 |
| F-12 | Root lint prints three `no-thenable` warnings in another row's new test file (exit 0) | The owning row |

### 11.8 Rollback (supersedes section 9)

The follow-up and the stricter test belong together: without the three labels in
`security-audit.ts` the `Permission` test fails by design. Roll the row back as one unit, from
`/Users/gsp-budi/Documents/DEMS` (git writes need the sandbox bypass, P10; not executed):

```sh
git checkout acaff20 -- \
  packages/shared/src/sim/vocabulary.ts \
  packages/shared/src/sim/auth.ts \
  packages/shared/src/i18n/en/common.ts \
  packages/shared/src/i18n/en/security-audit.ts \
  packages/shared/test/auth.test.ts \
  packages/shared/test/i18n-vocabulary-sync.test.ts
git apply --allow-empty .cache/rollback/W16.pre.patch    # 0 bytes
git apply --allow-empty .cache/rollback/W16b.pre.patch   # 0 bytes
```

Once W50 has written `common.ts` or W75 has written `security-audit.ts`, use the reverse patches
instead, which remove only this row's lines:
`git apply -R .cache/rollback/W16b.post.patch` and `git apply -R .cache/rollback/W16.post.patch`
(both pass `git apply --check -R` at 07:49 WIB; they cover disjoint files).
