---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: coder-execution
blueprint_row: 23
plan_row: W01 (early proof a, wave E1)
source_plan: /docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
evidence_tier: 3 (mechanical output: statement plus command output)
status: complete
---

# 01 Baseline test fix (blueprint step 23, plan row W01, early proof a)

Row, verbatim: [W01] Baseline fix slot (early proof a, time box 30 min): give the two
calendar-dependent web tests a fixed simulator clock (`createManualClock` at 2026-10-01 10:00 WIB);
test files only, no production file.

| Field | Value |
|---|---|
| Result | Both tests pass on any date and at any hour that was tried. `@dems/core-web`: 438 passed of 438 in 39 files |
| Files changed | 2 test files (12 lines added, 1 line replaced in each). No production file, no helper, no manifest |
| Row window | 2026-10-04 06:26:37 to 06:36:32 WIB (first command to last check); about 10 minutes of the 30-minute box |
| Fallback of plan section 6 | Not used (the fixed clock was enough) |
| Sandbox bypass | None. Every command ran inside the sandbox |
| Processes started | Foreground runners only; each ended on its own. `ps` shows no vitest process after the last run (P7) |
| Scratch files | `.cache/w01/` (git-ignored by `.gitignore:47`): the preload and the run logs |

---

## 1. W01's state (the two values later rows compare with)

Command: `git hash-object <file>` (run three times: 06:30:54, 06:35:06 and 06:35:54 WIB, same output each time).

| File | `git hash-object` after W01 | At `acaff20` (before) |
|---|---|---|
| `apps/core-web/src/test/sim-fetch.test.ts` | `9e8b97c80da596e0ae6e9b37aa69b64e99e3bbdd` | `9c33898b9324feaf15a3cfa0e24014ccd2693bdb` |
| `apps/core-web/src/features/storage/__tests__/storage-page.test.tsx` | `71f6f0337f2339d8e8d66ef232d7334dc0b67d1d` | `6606806cd714a8911d087a9a09d6d351a7155c7e` |

The "before" column is the output of `git hash-object` on the two files before the first edit; it
equals `git rev-parse acaff20:<path>` for both.

Used by: step 93 (W71, CLG item a), step 106 (W84), steps 111 (W89) and 119 (W97, L-6).

---

## 2. What was changed

Both suites build their simulator through one local helper that passed no clock, so `createSim`
fell back to `createSimClock()` (the wall clock, `packages/shared/src/sim/engine.ts:168`) and the
seeded dataset followed the date and the hour of the run. The helper now passes a manual clock at
the instant the DEMO packages describe, and the stored sign-in record carries the same instant
instead of `Date.now()`. No assertion was changed, added or removed.

### 2.1 `apps/core-web/src/test/sim-fetch.test.ts` (helper `makeSim`)

Before (`acaff20`, lines 25-34):

```ts
async function makeSim(operatorId: string | null, scenario: ScenarioName = 'idle'): Promise<Sim> {
  const authStorage = createMemoryAuthStorage()
  if (operatorId) authStorage.save({ operatorId, issuedAt: Date.now() })
  const sim = createSim({
    storage: null,
    authStorage,
    visibility: ALWAYS_VISIBLE,
    scheduler: () => () => undefined, // no engine ticks: the tests drive state directly
    scenario,
  })
```

After:

```ts
const DATASET_NOW = Date.parse(DEMO_EVIDENCE_INDEX.datasetNow)
...
async function makeSim(operatorId: string | null, scenario: ScenarioName = 'idle'): Promise<Sim> {
  const authStorage = createMemoryAuthStorage()
  if (operatorId) authStorage.save({ operatorId, issuedAt: DATASET_NOW })
  const sim = createSim({
    clock: createManualClock(DATASET_NOW),
    storage: null,
    authStorage,
    visibility: ALWAYS_VISIBLE,
    scheduler: () => () => undefined, // no engine ticks: the tests drive state directly
    scenario,
  })
```

- `DEMO_EVIDENCE_INDEX.datasetNow` is `"2026-10-01T10:00:00.000+07:00"`
  (`packages/shared/src/demo-data/packages.generated.ts:11`), that is 2026-10-01 10:00 WIB.
- The test takes its evidence ID from the same object (`DEMO_EVIDENCE_INDEX.apiExamples.evidenceExport`),
  so the ID and the clock now come from one source. This is D10(a) "an ID derived from the simulator date".
- Same pattern as `apps/core-web/src/features/evidence/__tests__/harness.ts:25, 82, 84`.
- Also added: `createManualClock` in the import from `@dems/shared/sim`, a two-line note in the file
  header and a comment on the constant.

### 2.2 `apps/core-web/src/features/storage/__tests__/storage-page.test.tsx` (helper `mount`)

Before (`acaff20`, lines 55-64):

```tsx
function mount(scenario: ScenarioName = 'idle', operatorId: string = OPERATOR_IDS.BUDI): Sim {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId, issuedAt: Date.now() })
  const sim = createSim({
    storage: null,
    authStorage,
    visibility: ALWAYS_VISIBLE,
    scheduler: () => () => undefined, // no engine ticks: the tests drive state directly
    scenario,
  })
```

After:

```tsx
const DEMO_NOW = Date.parse('2026-10-01T10:00:00+07:00')
...
function mount(scenario: ScenarioName = 'idle', operatorId: string = OPERATOR_IDS.BUDI): Sim {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId, issuedAt: DEMO_NOW })
  const sim = createSim({
    clock: createManualClock(DEMO_NOW),
    storage: null,
    authStorage,
    visibility: ALWAYS_VISIBLE,
    scheduler: () => () => undefined, // no engine ticks: the tests drive state directly
    scenario,
  })
```

- Same pattern as `apps/core-web/src/features/security-audit/__tests__/security-audit.test.tsx:36, 63, 68`.
- Also added: `createManualClock` in the import from `@dems/shared/sim`, a two-line note in the file
  header and a comment on the constant.

### 2.3 Size of the change

`git diff --numstat acaff20 -- apps/core-web/src/test/sim-fetch.test.ts apps/core-web/src/features/storage/__tests__/storage-page.test.tsx`:

```
12	1	apps/core-web/src/features/storage/__tests__/storage-page.test.tsx
12	1	apps/core-web/src/test/sim-fetch.test.ts
```

### 2.4 The stored sign-in record (`issuedAt`)

The plan (section 6) expects that the clock alone is enough (assumption PA-05). The change also
replaces `issuedAt: Date.now()` by the fixed instant, so that no wall-clock value enters the
simulator. By reading, this second edit does not decide the result: `restoreAuth` copies the value
into the auth slice (`packages/shared/src/sim/auth.ts:384`) and no production file under
`packages/shared/src/sim` or `apps/core-web/src` reads it for a decision (`grep -rn issuedAt`: the
storage adapter, the types, `scenarios.ts:72` and `auth.ts` only). A run with the clock line alone
was not made, so "the clock alone is enough" is an inference from the code, not a measurement.

---

## 3. Verification

All commands were run from `/Users/gsp-budi/Documents/DEMS` (no `cd` into a subfolder). npm echoed
`vitest run --maxWorkers=2` in every test run, so the worker limit reached the runner (P9).
Every sandboxed run also prints `ERROR: failed to copy trust settings of system certificate-25291`
(240 lines in a full run); that is the sandbox noise of baseline note N-3 and is left out of the quotes.

### 3.1 Check 1: the full web suite

Command: `npm run test -w @dems/core-web -- --maxWorkers=2`

Run 1, 06:29:47 WIB, **exit 0**. At that moment the two test files were the only non-document
difference from `acaff20` (section 3.4, snapshot A).

```
> @dems/core-web@0.1.0 test
> vitest run --maxWorkers=2

 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/apps/core-web

 Test Files  39 passed (39)
      Tests  438 passed (438)
   Start at  06:29:48
   Duration  33.26s (tests 71%, import 12%, environment 11%, setup 4%, transform 2%)
```

Run 2, 06:34:57 WIB, **exit 1, noise (P11)**. No test ran: the runner could not load
`apps/core-web/vite.config.ts`, a file that row W05 owns and was editing at that second.

```
failed to load config from /Users/gsp-budi/Documents/DEMS/apps/core-web/vite.config.ts
⎯⎯⎯⎯⎯⎯⎯ Startup Error ⎯⎯⎯⎯⎯⎯⎯⎯
Error: Build failed with 1 error:
[PARSE_ERROR] Expected `)` but found `EOF`
    ╭─[ vite.config.ts:66:4 ]
 66 │ })
```

Seconds later `git diff acaff20 -- apps/core-web/vite.config.ts` showed the finished edit (the file
then ended with `}))`).

Run 3, 06:35:17 WIB, **exit 0**, with the changes of W03 and W05 present in the tree:

```
> vitest run --maxWorkers=2
 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/apps/core-web
 Test Files  39 passed (39)
      Tests  438 passed (438)
   Start at  06:35:18
   Duration  36.06s (tests 69%, import 13%, environment 12%, setup 4%, transform 2%)
```

### 3.2 Check 2: the two files under a shifted clock

Method of the baseline gate report section 6.2. The preload is a byte-identical copy of the
verifier's file, placed in the git-ignored scratch folder:

```
e03e903349b9c0363d3c8d17699bbfec603cd6757c615458678c78e1a8c561e3  .cache/w01/fake-clock.mjs
e03e903349b9c0363d3c8d17699bbfec603cd6757c615458678c78e1a8c561e3  <session scratchpad>/row13/fake-clock.mjs
```

It replaces `Date` so that `Date.now()` and `new Date()` start at `DEMS_FAKE_NOW` and keep running.

Command (one line; `<T>` is the instant):

```
DEMS_FAKE_NOW=<T> NODE_OPTIONS="--import /Users/gsp-budi/Documents/DEMS/.cache/w01/fake-clock.mjs" \
  npm run test -w @dems/core-web -- --maxWorkers=2 \
  src/test/sim-fetch.test.ts src/features/storage/__tests__/storage-page.test.tsx
```

**Before the fix** (files at `acaff20`), 06:28 WIB. These runs show that the preload reaches the
test workers and that the failures are the ones of F20:

| Clock | Exit | Runner lines | Failures |
|---|---|---|---|
| Real (2026-10-04 06:28:06 WIB) | 1 | `Test Files  1 failed \| 1 passed (2)`, `Tests  1 failed \| 23 passed (24)`, `Start at  06:28:06` | F-1: `AssertionError: expected 404 to be 202` |
| `2026-10-04T00:10:00+07:00` | 1 | `Test Files  2 failed (2)`, `Tests  2 failed \| 22 passed (24)`, `Start at  00:10:00` | F-1 as above; F-2: expected `Sealed Evidence7 today`, received `Sealed Evidence0 today` |
| `2026-10-02T12:00:00+07:00` | 1 | `Test Files  1 failed \| 1 passed (2)`, `Tests  1 failed \| 23 passed (24)`, `Start at  12:00:00` | F-1 as above |

**After the fix**, 06:29 to 06:30 WIB:

| Clock | Required by the row | Exit | Runner lines |
|---|---|---|---|
| Real (2026-10-04 06:29:31 WIB) | no | 0 | `Test Files  2 passed (2)`, `Tests  24 passed (24)`, `Start at  06:29:31`, `Duration  3.90s` |
| `2026-10-04T00:10:00+07:00` (midnight window) | **yes** | 0 | `Test Files  2 passed (2)`, `Tests  24 passed (24)`, `Start at  00:10:00`, `Duration  3.48s` |
| `2026-10-02T12:00:00+07:00` (another date) | **yes** | 0 | `Test Files  2 passed (2)`, `Tests  24 passed (24)`, `Start at  12:00:00`, `Duration  3.56s` |
| `2026-12-31T23:59:50+07:00` (year boundary) | no | 0 | `Test Files  2 passed (2)`, `Tests  24 passed (24)`, `Start at  23:59:50` |
| `2026-10-01T01:00:00+07:00` (the packages' date, early hour) | no | 0 | `Test Files  2 passed (2)`, `Tests  24 passed (24)`, `Start at  01:00:00` |

### 3.3 Check 3: typecheck and lint

| Command | Run 1 (06:30:25, 06:30:33 WIB) | Run 2 (06:34:57, 06:35:06 WIB, W03 and W05 in flight) | Output |
|---|---|---|---|
| `npm run typecheck -w @dems/core-web` | exit 0 | exit 0 | `> tsc -b`, nothing else |
| `npm run lint -w @dems/core-web` | exit 0 | exit 0 | `> oxlint`, nothing else |

The two files are inside both checks:

- `npm exec -w @dems/core-web -- tsc -p tsconfig.app.json --listFilesOnly` lists
  `…/src/features/storage/__tests__/storage-page.test.tsx` and `…/src/test/sim-fetch.test.ts`.
- `npm exec -w @dems/core-web -- oxlint -f json` reports `"diagnostics": []`, `"number_of_files": 343`,
  `"number_of_rules": 116` (the baseline gate report has the same 343 files).

### 3.4 Check 4: tree state

Snapshot A, `git status --porcelain` at 06:30:54 WIB (after run 1, typecheck, lint and section 3.2):

```
 M apps/core-web/src/features/storage/__tests__/storage-page.test.tsx
 M apps/core-web/src/test/sim-fetch.test.ts
 M docs/2026-10-04_dems_backend_rbac_pairing/decisions/decisions.md
 M docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress_report.md
 M docs/2026-10-04_dems_backend_rbac_pairing/status_tasks.md
?? docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/coder_execution_step_24.md
?? docs/2026-10-04_dems_backend_rbac_pairing/delegation_progress/git_specialist_step_22.md
?? docs/2026-10-04_dems_backend_rbac_pairing/initialization/05_emulator_cold_boot.md
```

Exactly the two test files, plus documents. `git diff --stat acaff20 -- apps packages package.json package-lock.json .gitignore`
at the same moment: `2 files changed, 24 insertions(+), 2 deletions(-)`.

Snapshot B, `git status --porcelain | grep -v ' docs/'` at 06:36:32 WIB (other rows of wave E1 had
started to write by then):

```
 M .gitignore
 M apps/core-web/src/features/storage/__tests__/storage-page.test.tsx
 M apps/core-web/src/test/sim-fetch.test.ts
 M apps/core-web/vite.config.ts
 M package-lock.json
 M package.json
 M packages/shared/package.json
?? apps/core-server/
?? packages/shared/src/client/
?? packages/shared/src/live/
```

The lines other than the two test files are write paths of W03 (`.gitignore`, the manifests, the
lockfile, `apps/core-server/`, the placeholders under `packages/shared/src/`) and of W05
(`apps/core-web/vite.config.ts`), as listed in 02_plan section 10.2 for wave E1. This row wrote none of them.

---

## 4. Test ledger (P24)

| Workspace | Before (baseline at `acaff20`) | After W01 | New test files |
|---|---|---|---|
| `@dems/core-web` | 438 tests in 39 files; 436 passed and 2 failed at 01:51 WIB (baseline gate), 437 passed and 1 failed at 06:28 WIB (derived from section 3.2: the two files gave 23 of 24) | **438 passed of 438 in 39 files** | none (two tests repaired, none added) |
| `@dems/shared`, `@dems/mobile`, `@dems/mock-core` | not run by this row | not run by this row | none |

---

## 5. Extra checks outside the row's verification (findings)

The baseline gate report left one point open: "Not checked: whether other tests become
clock-sensitive at other dates or times." Because D10(a) asks for gates that are green on any date
and at any hour, the full web suite was also run under the preload. Nothing was changed as a result.

| Clock | Exit | Runner lines | Failing test |
|---|---|---|---|
| `2026-10-04T00:10:00+07:00` | 1 | `Test Files  1 failed \| 38 passed (39)`, `Tests  1 failed \| 437 passed (438)`, `Start at  00:10:00` | `src/features/dashboard/__tests__/dashboard.test.tsx` > Dashboard, idle scenario (row 42; AC-60 panel IDs; AC-75) > shows today's sealed count and six recent events grouped by day at UTC+07:00: `AssertionError: expected '0' not to be '0'` |
| `2026-10-04T23:58:00+07:00` | 0 | `Test Files  39 passed (39)`, `Tests  438 passed (438)`, `Start at  23:58:00` | none |
| `2027-02-01T12:00:00+07:00` | 1 | `Test Files  1 failed \| 38 passed (39)`, `Tests  1 failed \| 437 passed (438)`, `Start at  12:00:00` | the same test: `AssertionError: expected 0 to be greater than 0` |

**Finding W01-F1: a third clock-dependent web test.** `apps/core-web/src/features/dashboard/__tests__/dashboard.test.tsx`,
lines 216-226. Its helper `mount` (lines 79-88) saves `issuedAt: Date.now()` and passes no clock,
the same shape the two repaired files had.

- **Hour.** Line 221 expects the on-screen "sealed today" count to differ from `0`. Run alone under
  the preload: fails at 00:10, 00:20 and 00:24 WIB (`16` tests, `1 failed | 15 passed`), passes at
  00:26, 00:35 and 00:50 WIB (`16 passed`). The window is 00:00 to about 00:25 WIB, every day. It
  matches the seeding rule: the newest session of the day ends 25 minutes before now
  (`packages/shared/src/sim/dataset.ts:447, 456`).
- **Year.** Lines 219-220 count evidence whose ID contains `-2026` and expect more than zero. On
  2027-02-01 the IDs carry 2027 and the count is 0.
- It did not show in the baseline gate (01:51 WIB) or in this row's real-clock runs (06:29 and 06:35 WIB).
- Not fixed here: the file is outside the write paths of W01.

**Finding W01-F2: other web tests that seed a simulator from the wall clock.** `grep` for
`createSim(` without `createManualClock` in the same file, under `apps/core-web/src`: `test/routes.test.tsx`,
`test/shell-motion.test.tsx`, `features/storage/__tests__/storage-model.test.tsx`,
`features/dashboard/__tests__/dashboard.test.tsx`, `features/network-time/__tests__/network-time-page.test.tsx`,
`features/network-time/__tests__/network-time-model.test.tsx`, `features/devices/__tests__/devices-page.test.tsx`,
`components/composed/__tests__/test-utils.ts`, `lib/__tests__/core-endpoint.test.tsx`. Two more use a
manual clock that starts at `Date.now()`: `features/system/__tests__/system-model.test.tsx:87` and
`system-page.test.tsx:56`. At the four instants above only the dashboard test fails; other instants
were not tried.

**Not checked:** the shared and mobile suites under a shifted clock (outside this row).

---

## 6. Rollback (R-CO)

```
git checkout acaff20 -- apps/core-web/src/test/sim-fetch.test.ts apps/core-web/src/features/storage/__tests__/storage-page.test.tsx
```

Not executed. After it, `git hash-object` of the two files prints the "before" values of section 1
(`9c33898b…` and `6606806c…`), and the two failures of F20 return. The command also puts the two
paths into the index, as `git checkout <commit> -- <path>` always does.

---

## 7. Commands run (in order)

| # | Command | Exit |
|---|---|---|
| 1 | Read the inputs; `grep` for `createManualClock` and the fixed instants used by other suites | 0 |
| 2 | `mkdir -p .cache/w01`; `cp` of the preload; `shasum -a 256`; `git check-ignore -v`; `git hash-object` and `git rev-parse acaff20:<path>` of the two files | 0 |
| 3 | Three test runs whose file arguments were passed as one word by a shell-variable mistake of this row; vitest printed `No test files found`. Void, repeated correctly as 4 | 1 (void) |
| 4 | The two files before the fix: real clock, `2026-10-04T00:10`, `2026-10-02T12:00` | 1, 1, 1 (expected) |
| 5 | Edits of the two test files | n/a |
| 6 | The two files after the fix: real clock, `2026-10-04T00:10`, `2026-10-02T12:00` | 0, 0, 0 |
| 7 | `npm run test -w @dems/core-web -- --maxWorkers=2` (run 1) | 0 |
| 8 | `npm run typecheck -w @dems/core-web`; `npm run lint -w @dems/core-web`; `oxlint -f json`; `oxlint` on the two files | 0 each |
| 9 | `tsc -p tsconfig.app.json --listFilesOnly`; the two files at `2026-12-31T23:59:50` and `2026-10-01T01:00`; `git hash-object`; `git status --porcelain`; `git diff --stat acaff20` | 0 each |
| 10 | Full suite at `2026-10-04T00:10` (extra) | 1 (finding W01-F1) |
| 11 | `dashboard.test.tsx` alone at 00:20, 00:24, 00:26, 00:35, 00:50 on 2026-10-04 and at `2027-02-01T12:00` (extra) | 1, 1, 0, 0, 0, 1 |
| 12 | Full suite at `2026-10-04T23:58` and at `2027-02-01T12:00` (extra) | 0, 1 |
| 13 | Full suite run 2 (noise, P11), typecheck and lint run 2 | 1, 0, 0 |
| 14 | Full suite run 3; `git hash-object`; `ps` | 0 |

Logs: `.cache/w01/*.log` (git-ignored; the lines that matter are quoted above).

---
*Generated: 2026-10-04 06:40 WIB by coder-execution (step 23, W01)*
