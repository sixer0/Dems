---
task_id: 2026-10-12_input_av_core_adapter_plan
row: 228b
package: X1-5 (M11) follow-up; the test-hygiene row of C71 C-4 (i)
date: 2026-10-13
agent: coder-execution (K4, track D)
requirements: review 230 R-4 and answer (e); review 221 C-4 and section 5.1; decisions C71 (C-4), C79, C84; SX-19, R-X1-8 (letter); AD-08
status: complete
tier: T3
---

# Row 228b - reserved test installation ids, and no fixture key below the repository's data directory

Branch `task4/input-av-core-port`, working tree over `0f5d2a8e` with the uncommitted work of the waves. Nothing
committed. Existing files changed with the Edit tool only; new files with Write. **Nothing under `.data/` was
read, written or deleted: the 322 folders `test-row61-*` are as they were (names counted only).**

## Subject, stakeholders, scope

- **Subject.** (1) A production Core must not start under an installation id that the repository's own tests,
  demonstration data or documentation use, so that a key a fixture made can never be the key of a real
  installation. (2) The fixture that made `.data/test-row61-*` must stop writing keys below the repository.
- **Stakeholders.** The user (owner of the 322 folders and of the decision on the documented example id); the
  installer (sees one new refusal); every agent that runs a suite built on row 61's fixture (34 callers); K5 (key
  commands), the document row of R-9, rows 139 and 231.
- **Scope.** `src/capture/boot/checks.ts`, `boot/index.ts` (added lines), the fixture
  `src/capture/boot/__tests__/support.ts`, `test/support/config.ts`, one new test file, and the fixture lines of
  16 callers. Not in scope: the key commands (K5), the existing folders (the user's word), the documents.

## Item 1 - boot check 4b-3: DONE

A `REAL_PRODUCTION` start is refused by **`CAPTURE_INSTALLATION_ID_RESERVED_FOR_TESTS`** (member
`CaptureBootRefusal.INSTALLATION_ID_RESERVED`), reason the fixed word `RESERVED_INSTALLATION_ID`, when the
configured installation id is in the ONE closed list `ReservedInstallationId` of `checks.ts`:

| Member | Id | Who uses it (grep of `apps/`, `packages/`, `.cache/task4-row2*`) |
|---|---|---|
| `TEST_CONFIGURATION` | `DEMS-TEST-01` | `test/support/config.ts` (every test Core), the default key of row 61's fixture |
| `DEMONSTRATION` | `DEMS-IR-01` | `packages/shared/src/sim/dataset.ts` `DEVICE_ID`, the seed, the published demonstration packages, the contract examples |
| `DOCUMENTED_EXAMPLE` | `DEMS-JKT-07` | the prompt of `cli/production-key-command.ts:407`, `sealing-host/installation-identity.ts`, `test/db/fixtures.ts:819`, many tests as "another installation" |

Not reserved, by design: the synthetic ids a TEST states for itself (`DEMS-TEST-206`, `-208`, `-215C`, `-216`,
`-220`, `-226`, `-226C`, `-227`, `-227B`, `-228`, `-228B`, `-229`, `-229B`, `-BOOT`, `-D131`, `-FENCE`, `-I9A`,
`-R106B`, `-ROW29`). Their keys are made in temporary directories that the test removes (item 2).

**Where it sits.** After 4b-2 and before 4c: a key of another installation keeps the code and the reason it had
(4b-2 answers first); a reserved id is refused even when the key NAMES it; no operator is read and no worker is
started. `REAL_DEVELOPMENT` and `SIMULATED` never ask. The id is said in no log line, no error-log entry and no
sentence of the refusal.

**How the id reaches the check.** `CaptureBootDeps.installationId?: () => string | null` - optional for the reason
of row 228's decision 2 (`one-load.test.ts` builds a decision without it and must pass unedited); THE MOUNT ALWAYS
HANDS IT IN (`boot/index.ts`: `installationId: () => installation ?? null`, the same value 4b-2 compares with -
the seam of a bare mount or the door `provideInstallationId`). No new seam, no new mount member, no bypass.

**AD-08: both hold.** "Tests can still boot production" and "fixture ids are refused in production" hold together
without a seam under `src/`: a test states a synthetic id of its own, configures its Core with it
(`installationDeviceId`) and makes its key for it through test support (`realBootFixture(label, id)`, or the
key command typed that id).

### Diff of `checks.ts` against the blob this row started from (`3dfea759`)

Proof of the base: the current file with the six blocks below removed hashes to
`3dfea759bb85768f2ef812fe5919f201508839e5` (`git hash-object`). `diff -U0`: **6 hunks, 50 insertions, 0 deletions.**

| Hunk | Place | Content |
|---|---|---|
| 1 | `@@ -36,0 +37,6` header comment | 6 comment lines: the description of 4b-3 |
| 2 | `@@ -96,0 +103,5` `CaptureBootRefusal` | the member `INSTALLATION_ID_RESERVED` with its comment |
| 3 | `@@ -126,0 +138,2` `TEXT` | the sentence of the code (names `<data directory>/signer` and the rotation command) |
| 4 | `@@ -342,0 +356,27` before "the step" | the list `ReservedInstallationId`, `RESERVED_INSTALLATION_ID_REASON`, `isReservedInstallationId` |
| 5 | `@@ -377,0 +418,6` `CaptureBootDeps` | the optional member `installationId` with its comment |
| 6 | `@@ -470,0 +517,4` `runCaptureBootChecks` | the 4 lines of 4b-3, directly after the block of 4b-2 and before the comment of 4c |

No condition, statement or catch of checks 4, 4b, 4b-2, 4c changed (insertions only; `checks.test.ts` and
`one-load.test.ts` unedited and green).

**NEW BASELINE**

| File | git blob | sha256 |
|---|---|---|
| `capture/boot/checks.ts` | `694846fab448387222564801944e60e277c5d235` | `3f672c927ef3b628d5c6dcb3f78215680e6dd8c59def3209e5fb7847d8aa079d` |
| `capture/boot/index.ts` | `2d9b9345e2ea333368e19433a9ed37c304b01074` | `ca2b87be929ca8280bc25931249cdd8205bc2ad984f3cd44ed68970cbc6e4e6c` |

`boot/index.ts`: measured `7a2a2e6a` when this row started (row 226c's state, as review 230 states). Before this
row's edit landed, ANOTHER row changed one line of it without changing the line count (line 123, the export of
`captureHostRunnerOf` from `./host-facts` - row 106c's decision D-1, file_requests): the file without this row's two
lines hashes to `8b6cb6e2`. This row: `@@ -649,0 +650,2` - one comment line and
`installationId: () => installation ?? null,` in the argument of `runCaptureBootChecks`. Nothing else.

## Item 2 - the fixture: DONE

`realBootFixture` (`src/capture/boot/__tests__/support.ts`, the ONE maker of `test-row61-*`) now has two directories:

| Member | Where | Holds |
|---|---|---|
| `dataDir` | `mkdtemp(<real path of the OS temporary root>/dems-test-row61-<label>-<pid>-<n>-XXXXXX)`, mode 0700 | the key store, the media root, logs |
| `programsDir` (new, made at the first ask) | `<repository>/.cache/test-row61-programs/<label>-<pid>-<n>`, mode 0700 | the stand-in programs only - never a key |

Why two: the path rule of a program refuses a directory chain others can write, and the temporary root is one
under this session's sandbox (`/private/tmp`, 1777) and on Linux (`/tmp`). The KEY needs no such chain; the
stand-ins hold nothing secret.

Removal: `remove()` removes both (and the shared parent with its last fixture). Every test file that makes a
fixture now calls it in a teardown (`afterAll`, or `onTestFinished` where the fixture is made inside a case) - a
static rule holds that. A fixture no teardown removed is removed when the test process ENDS: measured here, a
Vitest worker ends by `SIGTERM` and the `exit` event is not raised, so the fixture watches `exit`, `SIGTERM`,
`SIGINT`, `SIGHUP`, removes, and raises the signal again. Probed with a throw-away test file (a fixture with a
key, no teardown, one failing case): both directories gone after the run; the probe file is removed.

`provisionKey()` names the fixture's own id: `realBootFixture(label, id)`; default the RESERVED test id, so a
default fixture key never starts a production Core.

### Suites touched (16 files; fixture lines only)

| File | Edit |
|---|---|
| `src/capture/boot/__tests__/boot.test.ts` | own id `DEMS-TEST-BOOT` for both fixtures and every mount seam (the former import `TEST_INSTALLATION` is a local constant); programs in `programsDir`; one expectation restated (the test configuration carries the reserved id); two comments |
| `src/__tests__/capture-composition.db.test.ts` (row 85) | two fixtures with ids `DEMS-TEST-I9A`, `DEMS-TEST-R106B`; `installationDeviceId`, `programsDir` in the two production configurations |
| `src/capture/fence/__tests__/fence.db.test.ts` (rows 85, 209) | id `DEMS-TEST-FENCE`; `installationDeviceId`, `programsDir`; row 209's cases use `programsDir` for the host programs; one comment |
| `src/modules/capture-config/__tests__/capture-config.db.test.ts` | id `DEMS-TEST-ROW29` for the production block; `installationDeviceId`, `programsDir`; two comments |
| `src/modules/devices/__tests__/source-class.db.test.ts` | id `DEMS-TEST-D131`; `installationDeviceId`, `programsDir`; teardown ADDED |
| `test/cli/operator-set-password.db.test.ts` (row 216) | the id typed at the key command and configured: `DEMS-TEST-216` (was the reserved one); `programsDir` |
| `src/sealing/__tests__/production-key-proof.db.test.ts` (rows 208, 228) | `programsDir` only (its id `DEMS-TEST-208` was already its own) |
| `src/capture/fence/__tests__/development-session.db.test.ts` | teardown ADDED; comment |
| `src/capture/fence/__tests__/e2e/development-session-e2e.db.test.ts` | teardown ADDED (`onTestFinished`); the printed line and two comments no longer say "left" |
| `src/engine/__tests__/restart.db.test.ts` | teardown ADDED, three fixtures |
| `src/modules/capture-discovery/__tests__/capture-discovery.booted.db.test.ts`, `lane-camera-stub.db.test.ts` | teardown ADDED |
| `src/modules/storage/__tests__/volume-at-boot.db.test.ts` | teardown ADDED |
| `src/engine/__tests__/capture-actions.db.test.ts` | one comment |
| `test/support/config.ts` | the id by import from the list |
| NEW `src/capture/boot/__tests__/reserved-ids.test.ts` | 22 cases (below) |

The seven files with "teardown ADDED" carry exactly the nine labels of the leftovers review 221 counted (`row140`,
`row140d131`, `waveia2_adopt`, `d10volume`, `wavehd_stub`, `waveia2_restart`, `passj_restart`, `wavek_s1_restart`,
`row140e2e`): they never removed their fixture.

NOT edited and still working: `sign-time-guard.test.ts` (226c, `DEMS-TEST-226C`), `one-load-mount.test.ts`
(`DEMS-TEST-215C`), `export-trust-list.db.test.ts`, and both scenario drivers (`DEMS-TEST-229`, `DEMS-TEST-220`:
their own ids, the fixture for programs only).

### The new tests (`reserved-ids.test.ts`, 22 cases)

- Decision: the list is exactly the three ids and each is an id the configuration takes; each reserved id is
  refused by the code and the fixed word, after the binding was asked and before operators or the worker; the id
  is in no line; controls (own id, no id, member absent); a key of another installation is named first;
  development and simulated never ask (a reader that throws).
- Mounted, real key store: the DEFAULT fixture with the id of the test configuration handed in through the door
  is refused in production and boots in development; a key that names each reserved id is refused by 4b-3; a
  fixture with an id of its own boots `REAL_PRODUCTION`.
- Fixture: data directory below the temporary root, 0700, outside the repository; key below it; programs apart;
  `remove()` removes both.
- Static: the fixture and the test configuration take the id from the list by import and name none; NO test
  support names an installation id that is not reserved (closed list of two serial-number texts); the seed's
  `DEVICE_ID` and the prompt's example are in the list; no key-writer call of a test file or support
  (`provisionSigningKey`, `provisionDevelopmentSigningKey`, `activateSigningKey`, `markSigningKeyCompromised`, the
  three key commands) is handed the repository's data directory, by name or through a name made from it; every
  maker of a fixture has a teardown. Each static rule has planted controls.

## Checks run (from `apps/core-server`, `--maxWorkers=2`)

| Check | Result line |
|---|---|
| `tsc --noEmit` | exit 0 |
| Boot unit tests, static set, signer, fence, sealing, sealing-host, export, verify, `test/cli`, `test/static`, config (final run) | `Test Files 87 passed (87)`, `Tests 1591 passed (1591)` |
| Wider unit run (earlier, sandboxed) | 13 files red, none of this row: 11 bind a socket (`listen EPERM` under the sandbox); `capture/__tests__/static.test.ts` SR-2 named `capture-config/camera-network/service.ts` (row 111, green in the final run); `engine/__tests__/boot-checks-runner.test.ts:81` (the export list of the core - not this row's files; owner: the engine row in flight) |
| Swept database suites, throw-away clones, `.locks/db-migrate.lock`, sandbox off (22 files: capture-composition, precheck-unassigned, session-start, session-capture, capture boot, development-session, fence, capture-actions, restart, export-restart, export-trust-list, export-e2e, capture-config, discovery booted, lane-camera-stub, readdress, source-class, audio-intervals, recover-failed-seal, volume-at-boot, production-key-proof, operator-set-password) | run 1 and the final run after the last edit: `Test Files 22 passed (22)`, `Tests 301 passed (301)`; `dropped 2 database(s) ... 0 remain` |
| Scenario driver `.cache/task4-row229/rotation-session.mts`, UNEDITED | `RESULT: every expectation of the session held (46 held, 1 recorded as observations, 0 difference(s) from the design)`, exit 0 |
| Secret scan of the new file and the fixture | `TOTAL: 0 in 0 file(s)` |

### The count

| Moment | `.data/test-row61-*` | entries of `.data/` | temp `dems-test-row61-*` | `.cache/test-row61-programs` |
|---|---|---|---|---|
| start of the row | 322 | - | - | - |
| before the final database run | 322 | 344 | 0 | 0 |
| after it (22 suites) | **322** | 344 | **0** | **0** |
| before / after the rotation driver | 322 / 322 | - | 0 / 0 | 0 / 0 |

## DRIVER DECISIONS (for the controller)

1. `DEMS-JKT-07` is reserved: it is the example the installer's prompt prints and an id of the database fixtures. It
   is also a plausible real name. If an installation must carry it, the documentation gets another example and
   the list loses the member (one line, and the static test follows the prompt).
2. The check stands AFTER 4b-2, so a wrong key is still named first; a reserved id with a foreign key is refused
   by 4b-2 and only after a rotation by 4b-3.
3. The stand-in programs lie in `.cache/test-row61-programs/` and not in the temporary root (the path rule).
4. The fixture watches termination signals in the test process (measured need). It re-raises the signal.
5. The attended e2e of row 140 no longer leaves its folder: the result file and the sealed recording of that run
   go with the case; its numbers are still printed.
6. FOUR LEFTOVERS REMOVED BY THIS ROW, outside `.data/`: while the fixture had moved and the teardown of
   `development-session.db.test.ts` was not yet added (14:55 to 15:01), two runs of other sessions (process ids
   5647 and 7796, both ended) left `dems-test-row61-row140-*` in the temporary root and their programs folders in
   `.cache/`. They were this row's fixture in its intermediate state; they are gone.

## Not proven here / remainder

- NOT RUN (they start the worker, a media process or a Core process): `development-session-e2e`, `seal-e2e`,
  `kill-matrix`, `test/acceptance/demo-seed-v2.test.ts`, `.cache/task4-row220/bench-session.mts`. They are
  typechecked (the drivers are outside the project and are not). The e2e's new teardown is unexercised.
- Linux: a test that keeps a program or the speech fixture below `fixture.dataDir` meets a world-writable `/tmp`
  there. The callers this row could run were moved to `programsDir`; the e2e files were not (file_requests).
- The key commands still make a key for a reserved id (K5's files; file_requests).
- The static rule on key writers reads text: a function parameter is not followed. The count above is the measure.
- A test process that is killed outright (`SIGKILL`) runs no removal; what it leaves is in the temporary root.
- The 322 existing folders: untouched; their removal is the user's word (C71). Their keys are refused by a
  production Core in code - by 4b-2 (default unit, another id) or by 4b-3 (`DEMS-TEST-01`).

## Requests left

Three lines in `delegation_progress/file_requests.md`, none blocking: the key commands (K5); the installer note
and README; the suites not run.
