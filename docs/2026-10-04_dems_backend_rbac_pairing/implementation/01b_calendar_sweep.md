---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: coder-execution
blueprint_row: W01b (controller row added by decision D25; follows step 23 / W01)
source_plan: /docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
evidence_tier: 3 (mechanical output: statement plus command output)
status: complete
---

# 01b Calendar sweep of the three test suites (controller row W01b)

Row, as delegated: a calendar-robustness sweep of the three existing test suites (`@dems/core-web`,
`@dems/shared`, `@dems/mobile`) under a shifted clock, and the fix of every test that depends on the
wall-clock date or hour. Test files only. Time box 75 minutes.

| Field | Value |
|---|---|
| Result | After this row the three suites pass at the real clock and at every instant tried: the six required instants, five extra instants and a 20-point hour scan. Real clock: core-web **438 of 438 in 39 files**, shared **508 of 508 in 28 files**, mobile **833 of 833 in 72 suites** |
| Tests that failed under a shifted clock | **One**, the dashboard test already named by F26. Nothing in shared, nothing in mobile |
| Files changed | **1 test file**: `apps/core-web/src/features/dashboard/__tests__/dashboard.test.tsx` (12 lines added, 1 replaced). No production file, no helper, no manifest, no runner config |
| Production defect found | None |
| Row window | 2026-10-04 06:40:19 to 07:22 WIB (first command to last check); about 42 minutes of the 75-minute box |
| Sandbox bypass | None. Every command ran inside the sandbox |
| Processes started | Test runners, `tsc` and `oxlint` only, in the foreground or as background shell jobs; every job reported its exit (section 12). `ps` and `pgrep` are not permitted inside the sandbox, so no process listing could be made (P7) |
| Scratch files | `.cache/w01b/` (git-ignored by `.gitignore:47`): the preloads, the runner scripts and the logs (6 MB; the 41 logs above 1 MB are gzip-compressed). `.cache/rollback/W01b.pre.patch` and `W01b.post.patch` |

---

## 1. W01b's state (the value later rows compare with)

Command: `git hash-object <file>`, run at 06:49:00 (right after the edit) and at 07:14:32 WIB (after
the last test run); same output both times.

| File | `git hash-object` after W01b | Blob at `acaff20` (before) |
|---|---|---|
| `apps/core-web/src/features/dashboard/__tests__/dashboard.test.tsx` | `1ab07579e928b9b545003899ec3265d4b8b6c762` | `c2d264bcd8ab2637b895e1e5aa3afa3ae29e835d` |

- The "before" value is `git rev-parse acaff20:<path>`; `git hash-object` of the working file gave the
  same value before the edit (06:44 WIB), so the file was untouched until this row.
- The two files of W01 are unchanged by this row: `sim-fetch.test.ts` = `9e8b97c80da596e0ae6e9b37aa69b64e99e3bbdd`,
  `storage-page.test.tsx` = `71f6f0337f2339d8e8d66ef232d7334dc0b67d1d` (07:14 WIB; the values of D25).
- `git diff --stat acaff20 -- 'apps/**/*.test.ts' 'apps/**/*.test.tsx' 'packages/**/*.test.ts'` at 07:14 WIB:
  `3 files changed, 36 insertions(+), 3 deletions(-)`: the two files of W01 and this one.

---

## 2. Method

### 2.1 The six required instants and the labels used below

All times are WIB (UTC+07:00). The host time zone is WIB and was not changed.

| Label | Instant | Why |
|---|---|---|
| (i) | `2026-10-06T00:05:00+07:00` | 00:05 on an ordinary day |
| (ii) | `2026-10-06T02:00:00+07:00` | 02:00 |
| (iii) | `2026-10-06T23:58:00+07:00` | 23:58 |
| (iv) | `2026-11-15T12:00:00+07:00` | 12:00 in another month |
| (v) | `2027-03-01T12:00:00+07:00` | 12:00 in another year |
| (vi) | `2026-11-01T00:05:00+07:00` | Month boundary, 00:05 on the 1st |

### 2.2 Vitest workspaces (`@dems/core-web`, `@dems/shared`)

W01's approach: a Node preload replaces `Date` so that `Date.now()` and `new Date()` start at
`DEMS_FAKE_NOW` and keep running. This row uses `.cache/w01b/fake-clock.mjs`: the same Proxy as
`.cache/w01/fake-clock.mjs`, with one addition. The offset is computed once, by the first process that
loads the file (npm), and handed to every child process through `DEMS_FAKE_OFFSET_MS`. The whole run
then sees one clock that starts at the instant and keeps running, like a real run at that time.

```
DEMS_FAKE_NOW=<T> NODE_OPTIONS="--import /Users/gsp-budi/Documents/DEMS/.cache/w01b/fake-clock.mjs" \
  npm run test -w @dems/core-web -- --maxWorkers=2
```

Proof that the shift reaches the test workers:

- The runner prints `Start at  00:05:00` (and so on) in every shifted run.
- The dashboard test fails at (i), (v), (vi) and passes at (ii), (iii), (iv) (section 3).
- A scratch test (`.cache/w01b/vitest-probe/probe.test.ts`) asserts that `new Date()` starts with
  `2027-03-01T05:00` before `vi.useFakeTimers()`, under it and after `vi.useRealTimers()`. With the
  preload: `Tests  1 passed (1)`, `Start at  12:00:00`, with the vitest of `@dems/shared` and with
  the vitest of `@dems/core-web`. Without the preload: `Tests  1 failed (1)` (control).

### 2.3 Jest workspace (`@dems/mobile`, jest 29 with jest-expo)

Jest runs each test file in its own `vm` context, and that context has its own `Date`. Two parts are
needed, and neither edits a tracked file:

1. The same Node preload through `NODE_OPTIONS` (the jest workers are child processes and inherit it).
2. A scratch setup file on the command line: `--setupFiles /Users/gsp-budi/Documents/DEMS/.cache/w01b/fake-clock-jest-setup.js`.
   Jest appends it to the preset's own `setupFiles` and runs it inside every test context; it installs
   the same Proxy there, with the offset taken from `DEMS_FAKE_OFFSET_MS`.

```
DEMS_FAKE_NOW=<T> NODE_OPTIONS="--import /Users/gsp-budi/Documents/DEMS/.cache/w01b/fake-clock.mjs" \
  npm run test -w @dems/mobile -- --maxWorkers=2 \
  --setupFiles /Users/gsp-budi/Documents/DEMS/.cache/w01b/fake-clock-jest-setup.js
```

`--setupFiles` must be the **last** option: it takes a list, so anything after it is read as a setup
file (two void launches, section 10).

Proof, measured with a probe that the setup file writes when `DEMS_FAKE_PROBE` names a file
(`DEMS_FAKE_NOW=2027-03-01T12:00:00+07:00`, real time 06:42 to 06:55 WIB):

| Set-up | Clock inside the test context | After `jest.useFakeTimers()` |
|---|---|---|
| `NODE_OPTIONS` alone (control; a setup file that only logs) | `2026-10-03T23:43:00.758Z` (the real clock) | not measured |
| Setup file alone | `2027-03-01T05:00:00.000Z` | `2026-10-03T23:54:48.293Z` (**the real clock**) |
| Both (the sweep) | `2027-03-01T05:00:01.484Z` | `2027-03-01T05:00:01.488Z`; after `jest.useRealTimers()` `2027-03-01T05:00:01.488Z` |

So the preload alone does not reach the tests, and the setup file alone leaves every test that uses
fake timers on the real clock. Both together shift all three.

Every mobile run of the "after", "extra" and "final" phases wrote one probe line per test file. Each
reports 72 test contexts, the first at the instant and the last 38 to 64 seconds later (section 5 and 6).
The "before" runs used the same command without the probe.

### 2.4 Scratch files

```
626ae4f5d0a121b4c911955329a2337c1510140f5c34aa5fb5033e45b57c9386  .cache/w01b/fake-clock.mjs
b59d6fc57a8237fc20e2fc39e83878771cfd15e6892cfa04b5846924c8993812  .cache/w01b/fake-clock-jest-setup.js
e03e903349b9c0363d3c8d17699bbfec603cd6757c615458678c78e1a8c561e3  .cache/w01b/fake-clock.w01.mjs   (copy of W01's preload, reference only)
121784a351ba0f4c11b1dee9c0b09b732fa283cf50947ad0ddaab01fdc541c11  .cache/w01b/sweep2.sh            (one run: suite, instant, log, summary)
e3dad4878ecfdfaabe0cc08e60ef6eb7e3e100f6929ae53d6c008bf7ead85bab  .cache/w01b/lane2.sh             (a list of instants for a list of suites)
7c2366f45f543e3b708c2c5f969982de62d455226fdccb62ce190749a23c82e5  .cache/w01b/scan.sh              (the hour scan of section 6.2)
```

`sweep.sh` and `lane.sh` are the first form of the two runners (no probe); the "before" phase used them.

---

## 3. Sweep matrix before the fix (06:43 to 06:47 WIB; test files as at `acaff20` plus W01's two files)

Runner summary lines, quoted from `.cache/w01b/logs/before_<suite>_<label>.log`. Every command ran
with `--maxWorkers=2` (npm echoed `vitest run --maxWorkers=2` and `jest --maxWorkers=2 --setupFiles …`).

| Instant | `@dems/core-web` | `@dems/shared` | `@dems/mobile` |
|---|---|---|---|
| (i) 2026-10-06 00:05 | **exit 1**: `Test Files  1 failed \| 38 passed (39)`, `Tests  1 failed \| 437 passed (438)`, `Start at  00:05:00` | exit 0: `Test Files  28 passed (28)`, `Tests  508 passed (508)`, `Start at  00:05:00` | exit 0: `Test Suites: 72 passed, 72 total`, `Tests:       833 passed, 833 total` |
| (ii) 2026-10-06 02:00 | exit 0: `Test Files  39 passed (39)`, `Tests  438 passed (438)`, `Start at  02:00:00` | exit 0: `28 passed (28)`, `508 passed (508)`, `Start at  02:00:00` | exit 0: `72 passed, 72 total`, `833 passed, 833 total` |
| (iii) 2026-10-06 23:58 | exit 0: `Test Files  39 passed (39)`, `Tests  438 passed (438)`, `Start at  23:58:00` | exit 0: `28 passed (28)`, `508 passed (508)`, `Start at  23:58:00` | exit 0: `72 passed, 72 total`, `833 passed, 833 total` |
| (iv) 2026-11-15 12:00 | exit 0: `Test Files  39 passed (39)`, `Tests  438 passed (438)`, `Start at  12:00:00` | exit 0: `28 passed (28)`, `508 passed (508)`, `Start at  12:00:00` | exit 0: `72 passed, 72 total`, `833 passed, 833 total` |
| (v) 2027-03-01 12:00 | **exit 1**: `Test Files  1 failed \| 38 passed (39)`, `Tests  1 failed \| 437 passed (438)`, `Start at  12:00:00` | exit 0: `28 passed (28)`, `508 passed (508)`, `Start at  12:00:00` | exit 0: `72 passed, 72 total`, `833 passed, 833 total` |
| (vi) 2026-11-01 00:05 | **exit 1**: `Test Files  1 failed \| 38 passed (39)`, `Tests  1 failed \| 437 passed (438)`, `Start at  00:05:00` | exit 0: `28 passed (28)`, `508 passed (508)`, `Start at  00:05:00` | exit 0: `72 passed, 72 total`, `833 passed, 833 total` |

Failing test, the same one in the three failing runs:

```
 FAIL  src/features/dashboard/__tests__/dashboard.test.tsx > Dashboard, idle scenario (row 42; AC-60 panel IDs; AC-75) > shows today's sealed count and six recent events grouped by day at UTC+07:00
```

| Instant | Assertion |
|---|---|
| (i) and (vi) | `AssertionError: expected '0' not to be '0' // Object.is equality` (the on-screen "sealed today" count, line 221 of the `acaff20` file) |
| (v) | `AssertionError: expected 0 to be greater than 0` at `src/features/dashboard/__tests__/dashboard.test.tsx:220:25` (the count of sealed evidence whose ID contains `-2026`) |

No other test failed in any of the 18 runs.

---

## 4. The fix

### 4.1 `apps/core-web/src/features/dashboard/__tests__/dashboard.test.tsx`

Test: `Dashboard, idle scenario (row 42; AC-60 panel IDs; AC-75) > shows today's sealed count and six recent events grouped by day at UTC+07:00`
(lines 216-226 at `acaff20`; lines 227-237 now).

**Cause.** The file's helper `mount` (lines 79-88 at `acaff20`) built the simulator without a clock,
so `createSim` fell back to the wall clock (`packages/shared/src/sim/engine.ts:168`) and the seeded
dataset followed the date and the hour of the run:

- **Hour.** The newest of today's seeded sessions ends 25 minutes before now
  (`packages/shared/src/sim/dataset.ts:431, 456`). From 00:00 to about 00:25 WIB none of them is
  sealed "today", the panel shows `0`, and line 221 expects a value other than `0`.
- **Year.** Line 219 counts sealed evidence whose ID contains `-2026` and line 220 expects more than
  zero. Evidence IDs are built from the simulator date (`dataset.ts:202-203`), so in 2027 the count is 0.

**Change (the recipe of W01).** The helper passes a manual clock at the dataset instant, and the
stored sign-in record carries the same instant instead of `Date.now()`. No assertion was changed,
added or removed; line 219's `-2026` now matches the fixed clock's year by construction.

Before (`acaff20`, lines 79-88):

```tsx
function mount({ scenario = 'idle', operatorId = OPERATOR_IDS.BUDI }: { scenario?: ScenarioName; operatorId?: string } = {}) {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId, issuedAt: Date.now() })
  const sim = createSim({
    scenario,
    storage: null,
    authStorage,
    visibility: ALWAYS_VISIBLE,
    scheduler: () => () => undefined,
  })
```

After (lines 81 and 89-99):

```tsx
const DEMO_NOW = Date.parse('2026-10-01T10:00:00+07:00')
...
function mount({ scenario = 'idle', operatorId = OPERATOR_IDS.BUDI }: { scenario?: ScenarioName; operatorId?: string } = {}) {
  const authStorage = createMemoryAuthStorage()
  authStorage.save({ operatorId, issuedAt: DEMO_NOW })
  const sim = createSim({
    clock: createManualClock(DEMO_NOW),
    scenario,
    storage: null,
    authStorage,
    visibility: ALWAYS_VISIBLE,
    scheduler: () => () => undefined,
  })
```

- Also added: `createManualClock` in the import from `@dems/shared/sim` (line 14), a two-line note in
  the file header (lines 5-6) and a comment on the constant (lines 76-80).
- Same pattern and same instant as W01's `storage-page.test.tsx` and as
  `apps/core-web/src/features/security-audit/__tests__/security-audit.test.tsx:36`.
- All 16 tests of the file use `mount`, so all 16 now run on the fixed clock. They pass (section 5.1).
- The file is a test file (`*.test.tsx` under `__tests__/`). No helper or harness was edited, so no
  import check of a helper was needed.

`git diff --numstat acaff20 -- <file>`: `12	1`.

| File | Hash after | Blob at `acaff20` |
|---|---|---|
| `apps/core-web/src/features/dashboard/__tests__/dashboard.test.tsx` | `1ab07579e928b9b545003899ec3265d4b8b6c762` | `c2d264bcd8ab2637b895e1e5aa3afa3ae29e835d` |

### 4.2 Nothing else was changed

The sweep showed no other failing test, so no other file was pinned (rule of the row). The tests that
still seed from the wall clock are listed in section 8.

---

## 5. Re-verification after the fix

### 5.1 The fixed file alone (06:48 WIB)

`… npm run test -w @dems/core-web -- src/features/dashboard/__tests__/dashboard.test.tsx --maxWorkers=2`

| Clock | Exit | Runner lines |
|---|---|---|
| Real (06:48:09 WIB) | 0 | `Test Files  1 passed (1)`, `Tests  16 passed (16)`, `Start at  06:48:09` |
| (i) | 0 | `Test Files  1 passed (1)`, `Tests  16 passed (16)`, `Start at  00:05:00` |
| (v) | 0 | `Test Files  1 passed (1)`, `Tests  16 passed (16)`, `Start at  12:00:00` |
| (vi) | 0 | `Test Files  1 passed (1)`, `Tests  16 passed (16)`, `Start at  00:05:00` |

### 5.2 The three suites at the real clock and at (i), (iii), (v): first pass, 06:49 to 06:52 WIB

Quoted from `.cache/w01b/logs/after_<suite>_<label>.log` (the mobile logs are `.log.gz`). All exit 0.

`@dems/core-web`: `npm run test -w @dems/core-web -- --maxWorkers=2`

```
> vitest run --maxWorkers=2
 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/apps/core-web
```

| Clock | Runner lines |
|---|---|
| Real | `Test Files  39 passed (39)`, `Tests  438 passed (438)`, `Start at  06:49:03`, `Duration  40.15s (tests 68%, import 14%, environment 12%, setup 4%, transform 2%)` |
| (i) | `Test Files  39 passed (39)`, `Tests  438 passed (438)`, `Start at  00:05:00`, `Duration  40.56s (…)` |
| (iii) | `Test Files  39 passed (39)`, `Tests  438 passed (438)`, `Start at  23:58:00`, `Duration  40.23s (…)` |
| (v) | `Test Files  39 passed (39)`, `Tests  438 passed (438)`, `Start at  12:00:00`, `Duration  39.99s (…)` |

`@dems/shared`: `npm run test -w @dems/shared -- --maxWorkers=2`

```
> vitest run --maxWorkers=2
 RUN  v5.0.3 /Users/gsp-budi/Documents/DEMS/packages/shared
```

| Clock | Runner lines |
|---|---|
| Real | `Test Files  28 passed (28)`, `Tests  508 passed (508)`, `Start at  06:49:44`, `Duration  2.27s (tests 51%, import 32%, transform 16%, worker 1%)` |
| (i) | `Test Files  28 passed (28)`, `Tests  508 passed (508)`, `Start at  00:05:00`, `Duration  2.41s (…)` |
| (iii) | `Test Files  28 passed (28)`, `Tests  508 passed (508)`, `Start at  23:58:00`, `Duration  2.29s (…)` |
| (v) | `Test Files  28 passed (28)`, `Tests  508 passed (508)`, `Start at  12:00:00`, `Duration  2.60s (…)` |

`@dems/mobile`: `npm run test -w @dems/mobile -- --maxWorkers=2` (shifted runs: plus `--setupFiles …`)

```
> jest --maxWorkers=2 --setupFiles /Users/gsp-budi/Documents/DEMS/.cache/w01b/fake-clock-jest-setup.js
```

| Clock | Runner lines | Clock seen in the test contexts (probe) |
|---|---|---|
| Real | `Test Suites: 72 passed, 72 total`, `Tests:       833 passed, 833 total`, `Snapshots:   0 total`, `Time:        39.021 s`, `Ran all test suites.` | not shifted |
| (i) | `Test Suites: 72 passed, 72 total`, `Tests:       833 passed, 833 total`, `Time:        38.718 s` | 72 contexts, `2026-10-05T17:05:00.678Z` to `17:05:38.275Z` |
| (iii) | `Test Suites: 72 passed, 72 total`, `Tests:       833 passed, 833 total`, `Time:        38.218 s` | 72 contexts, `2026-10-06T16:58:00.725Z` to `16:58:38.073Z` |
| (v) | `Test Suites: 72 passed, 72 total`, `Tests:       833 passed, 833 total`, `Time:        38.293 s` | 72 contexts, `2027-03-01T05:00:00.743Z` to `05:00:38.144Z` |

### 5.3 The other three required instants after the fix (06:51 to 06:54 WIB), all exit 0

| Instant | `@dems/core-web` | `@dems/shared` | `@dems/mobile` (probe) |
|---|---|---|---|
| (ii) | `39 passed (39)`, `438 passed (438)`, `Start at  02:00:00` | `28 passed (28)`, `508 passed (508)` | `72 passed, 72 total`, `833 passed, 833 total` (72 contexts from `2026-10-05T19:00:00.736Z`) |
| (iv) | `39 passed (39)`, `438 passed (438)`, `Start at  12:00:00` | `28 passed (28)`, `508 passed (508)` | `72 passed, 72 total`, `833 passed, 833 total` (72 contexts from `2026-11-15T05:00:00.749Z`) |
| (vi) | `39 passed (39)`, `438 passed (438)`, `Start at  00:05:00` | `28 passed (28)`, `508 passed (508)` | `72 passed, 72 total`, `833 passed, 833 total` (72 contexts from `2026-10-31T17:05:00.717Z`) |

### 5.4 Typecheck and lint of the touched workspace (`@dems/core-web`)

| Command | Run 1 (06:48:49 and 06:48:57 WIB) | Run 2 (07:14:24 and 07:14:32 WIB, other rows in flight) | Output |
|---|---|---|---|
| `npm run typecheck -w @dems/core-web` | exit 0 | exit 0 | `> tsc -b`, nothing else |
| `npm run lint -w @dems/core-web` | exit 0 | exit 0 | `> oxlint`, nothing else |

The file is inside both checks: `npm exec -w @dems/core-web -- tsc -p tsconfig.app.json --listFilesOnly`
lists `…/src/features/dashboard/__tests__/dashboard.test.tsx`; `npm exec -w @dems/core-web -- oxlint -f json`
reports 0 diagnostics, `number_of_files: 343`, `number_of_rules: 116` (the baseline's 343 files).

`@dems/shared` and `@dems/mobile` were not touched, so their typecheck and lint were not run by this row.

### 5.5 Tree state

`git status --porcelain --untracked-files=all` at 07:14:32 WIB, without the `docs/` lines and without
the 10 untracked entries under `apps/core-server/`:

```
 M .gitignore
 M apps/core-web/src/features/dashboard/__tests__/dashboard.test.tsx
 M apps/core-web/src/features/storage/__tests__/storage-page.test.tsx
 M apps/core-web/src/test/sim-fetch.test.ts
 M apps/core-web/vite.config.ts
 M apps/mobile/package.json
 M apps/mobile/scripts/device-session.sh
 M apps/mobile/src/runtime/debug.ts
 M package-lock.json
 M package.json
 M packages/shared/package.json
?? apps/mobile/src/runtime/dev-probes.ts
?? packages/shared/src/client/core-client.ts
?? packages/shared/src/client/index.ts
?? packages/shared/src/live/index.ts
?? packages/shared/src/live/source/index.ts
?? packages/shared/src/live/testing/index.ts
?? packages/shared/test/client-core.test.ts
?? packages/shared/test/client-platform-neutral.test.ts
?? packages/shared/test/client-types.test.ts
?? scripts/pg/…  (22 files)
```

This row wrote exactly one of these paths: `apps/core-web/src/features/dashboard/__tests__/dashboard.test.tsx`.
The two other modified test files are W01's. Every other line is a path of another row (npm slots,
`vite.config.ts`, the mobile device rows, the shared client row, `scripts/pg/`, `apps/core-server/`).
In `docs/`, this row wrote `implementation/01b_calendar_sweep.md` and
`delegation_progress/coder_execution_step_w01b.md`.

---

## 6. Extra coverage (outside the row's required checks)

### 6.1 Five more instants, full suites, after the fix (06:54 to 06:58 WIB), all exit 0

| Label | Instant | Why | `@dems/core-web` | `@dems/shared` | `@dems/mobile` (probe) |
|---|---|---|---|---|---|
| (vii) | `2026-10-06T23:59:40+07:00` | The run crosses midnight | `39 passed (39)`, `438 passed (438)`, `Start at  23:59:40`, `Duration  45.27s` | `28 passed (28)`, `508 passed (508)` | `72 passed`, `833 passed` (72 contexts, `2026-10-06T16:59:40.525Z` to `17:00:23.159Z`) |
| (viii) | `2027-01-01T00:05:00+07:00` | Year boundary, first minutes | `39 passed (39)`, `438 passed (438)`, `Start at  00:05:00` | `28 passed (28)`, `508 passed (508)` | `72 passed`, `833 passed` (from `2026-12-31T17:05:00.546Z`) |
| (ix) | `2027-01-01T12:00:00+07:00` | New Year's Day, noon | `39 passed (39)`, `438 passed (438)`, `Start at  12:00:00` | `28 passed (28)`, `508 passed (508)` | `72 passed`, `833 passed` (from `2027-01-01T05:00:00.996Z`) |
| (x) | `2028-02-29T12:00:00+07:00` | Leap day | `39 passed (39)`, `438 passed (438)`, `Start at  12:00:00` | `28 passed (28)`, `508 passed (508)` | `72 passed`, `833 passed` (from `2028-02-29T05:00:00.681Z`) |
| (xi) | `2026-10-06T00:30:00+07:00` | Just after the 00:25 threshold | `39 passed (39)`, `438 passed (438)`, `Start at  00:30:00` | `28 passed (28)`, `508 passed (508)` | `72 passed`, `833 passed` (from `2026-10-05T17:30:00.597Z`) |

### 6.2 Hour scan of the files that touch the wall clock (06:58 to 07:10 WIB)

The seeding rule has hour thresholds: 00:25 (newest session of today), 00:30 (early-morning spread),
about 02:25 (seven sealed today) and 09:45 (office-hours slots), `dataset.ts:445-468`. The scan runs
only the files that read the wall clock (the residual list of section 8 plus the three fixed files)
at 20 times of 2026-10-06: 00:00:01, 00:10, 00:24, 00:26, 00:40, 00:50, 01:30, 02:20, 02:30, 02:55,
04:00, 06:59, 07:05, 08:30, 09:40, 09:44, 09:50, 16:00, 20:00, 23:59:55. Command: `.cache/w01b/scan.sh <web|mobile> 2026-10-06 <times>`.

| Suite | Files | Result |
|---|---|---|
| `@dems/core-web` | 21 files, 270 tests | `Test Files  21 passed (21)`, `Tests  270 passed (270)` at all 20 times. The first run at 09:40 had one failure that is load noise (section 10); the repeat passed |
| `@dems/mobile` | 11 suites, 179 tests | `Test Suites: 11 passed, 11 total`, `Tests:       179 passed, 179 total` at 19 times (09:44 was not run for mobile); the probe shows 11 contexts at the instant each time |

### 6.3 Final pass on the current tree (07:10 to 07:14 WIB), all exit 0

Between the first pass and this one, other rows changed the tree: an npm slot rewrote
`apps/mobile/package.json` and the lockfile at 06:58:03 to 06:58:06 WIB (`stat`), and three shared
test files appeared at 07:02 to 07:12 WIB.

| Clock | `@dems/core-web` | `@dems/shared` | `@dems/mobile` (probe) |
|---|---|---|---|
| Real | `39 passed (39)`, `438 passed (438)`, `Start at  07:10:27` | `Test Files  31 passed (31)`, `Tests  583 passed (583)`, `Start at  07:11:14` | `72 passed, 72 total`, `833 passed, 833 total`, `Time: 45.598 s` |
| (i) | `39 passed (39)`, `438 passed (438)`, `Start at  00:05:00` | `31 passed (31)`, `583 passed (583)` | `72 passed`, `833 passed` (72 contexts from `2026-10-05T17:05:00.779Z`) |
| (iii) | `39 passed (39)`, `438 passed (438)`, `Start at  23:58:00` | `31 passed (31)`, `584 passed (584)` | `72 passed`, `833 passed` (72 contexts from `2026-10-06T16:58:00.770Z`) |
| (v) | `39 passed (39)`, `438 passed (438)`, `Start at  12:00:00` | `31 passed (31)`, `584 passed (584)` | `72 passed`, `833 passed` (72 contexts from `2027-03-01T05:00:00.774Z`) |

The shared totals above 508 are another row's additions (section 9), not this row's.

---

## 7. Production defects

**None found.** The one failure is a defect of the test's set-up, not of the application:

- The dashboard shows `0` sealed today from 00:00 to about 00:25 WIB because the simulator's seeded
  sessions of "today" all end on the previous day at that hour. The source documents this as an edge
  case of the seed (`packages/shared/src/sim/dataset.ts:451-452`, "Before about 02:50 WIB the oldest
  slots fall on the previous day, so Sealed Today is lower than 7 there (documented edge case)"; logged
  by the predecessor as H-32-1). The page displays the count that the data holds.
- Evidence IDs carry the simulator's date by design (`dataset.ts:202-203`).

No test of the three suites failed for any other reason at any instant.

---

## 8. Residual list: tests that still read the wall clock and passed at every instant tried

Not changed (the row's rule: fix only what the sweep shows failing). Each passed in all full-suite
runs of sections 3, 5 and 6 and in the hour scan.

**`@dems/core-web`** (paths under `apps/core-web/src/`)

| File | Line | Wall-clock read |
|---|---|---|
| `test/routes.test.tsx` | 70, 71 | `issuedAt: Date.now()`; `createSim` without a clock. Uses the literal IDs `EV-20260930-0001` and `EV-20260930-0003` (lines 30, 219, 222) for route rendering only |
| `test/shell-motion.test.tsx` | 62, 63 | `issuedAt: Date.now()`; `createSim` without a clock |
| `features/storage/__tests__/storage-model.test.tsx` | 31 | `createSim` without a clock |
| `features/network-time/__tests__/network-time-model.test.tsx` | 14 | `createSim` without a clock |
| `features/network-time/__tests__/network-time-page.test.tsx` | 63, 64 | `issuedAt: Date.now()`; `createSim` without a clock |
| `features/session-monitor/__tests__/session-monitor.test.tsx` | 52, 53-60, 425, 429, 431 | The helper `mountSession` takes an optional clock: a test that passes none gets `issuedAt: Date.now()` and a simulator on the wall clock. Three more `createSim` calls without a clock. **Not in W01's list** (the file uses a manual clock elsewhere, so W01's file-level search skipped it) |
| `features/devices/__tests__/devices-page.test.tsx` | 53, 54 | `issuedAt: Date.now()`; `createSim` without a clock |
| `components/composed/__tests__/test-utils.ts` (helper) | 17 | `createSim` without a clock. Imported by 8 test files: `test/visual-audit-45b.test.tsx`, `features/devices/__tests__/devices-page.test.tsx`, `components/composed/__tests__/glow-ring.test.tsx`, `dbfs-meter.test.tsx`, `session-timeline.test.tsx`, `stepper.test.tsx`, `components/media/__tests__/camera-feed.test.tsx`, `live-decode-budget.test.tsx` |
| `lib/__tests__/core-endpoint.test.tsx` | 202, 263, 264 | Two `createSim` calls without a clock; `issuedAt: Date.now()` |
| `features/system/__tests__/system-model.test.tsx` | 87 | `createManualClock(Date.now())` |
| `features/system/__tests__/system-page.test.tsx` | 56 | `createManualClock(Date.now())` |
| `features/login/__tests__/login-page.test.tsx` | 51, 105, 108-115 | `serverTime: new Date().toISOString()`; the helper `mount` takes an optional clock: a test that passes none gets `issuedAt: Date.now()` and a simulator on the wall clock. **Not in W01's list** (same reason) |
| `components/composed/__tests__/glow-ring.test.tsx` | 114 | `recordingSince={Date.now() - 1_122_000}` (a relative duration) |

**`@dems/mobile`** (paths under `apps/mobile/src/`). Most mobile suites build their simulator through
`runtime/testing/test-sim.tsx` (`createTestSim`, a manual clock at `TEST_START` = 2026-10-01 10:00 WIB,
line 29), which is why the suite is stable.

| File | Line | Wall-clock read |
|---|---|---|
| `features/storage/storage-model.test.ts` | 34 | `createSim` without a clock |
| `providers/app-providers.test.tsx` | 82, 91, 104, 145 | `<AppProviders>` without a simulator: the provider creates one on the wall clock (`runtime/sim-runtime-provider.tsx:88`) |
| `navigation/__tests__/back-guard.test.tsx` | 33 | The same |
| `features/evidence/evidence-model.test.ts` | 153, 166, 185, 189 | `Date.now()` passed as "now" to the integrity model |
| `navigation/__tests__/guard.test.tsx`, `routes.test.tsx`, `chrome.test.tsx` | 75, 185; 113; 224, 236 | A session start time of `Date.now()` (or 65 s earlier) |
| `motion/haptics.test.ts` | 120, 129, 142 | Elapsed-time measurement |

**`@dems/shared`**: none. Every `createSim` call under `packages/shared/test/` passes a clock, and
`grep -rn "Date.now()\|new Date()" packages/shared/test` finds nothing (06:44 WIB with the 28 baseline
files; again at 07:13 WIB with the three new files of another row).

The search behind the tables: every `createSim(`, `createMobileSim(` call in test code whose argument
text holds no `clock`, plus `grep` for `Date.now()`, `new Date()` and `clock?.now()` in test files and
harnesses. It is a text search, not a proof: a wall-clock read behind another helper would not show.

---

## 9. Test ledger (P24)

| Workspace | Before this row | After this row | New test files by this row |
|---|---|---|---|
| `@dems/core-web` | 438 tests in 39 files; 438 passed at the real clock (W01), 437 passed and 1 failed at (i), (v), (vi) | **438 passed of 438 in 39 files** at the real clock and at every instant tried | none (one test repaired, none added) |
| `@dems/shared` | 508 in 28 files, all passed at the six instants | 508 of 508 in 28 files (06:49 to 06:58 WIB). **At 07:11 WIB the workspace held 31 files and 583 tests, at 07:13 WIB 584**: another row added `packages/shared/test/client-core.test.ts`, `client-platform-neutral.test.ts` and `client-types.test.ts` (07:02 to 07:12 WIB). All passed, at the real clock and at (i), (iii), (v) | none |
| `@dems/mobile` | 833 in 72 suites, all passed at the six instants | 833 of 833 in 72 suites | none |
| `@dems/core-server`, `@dems/mock-core`, `scripts/pg` tests | not part of this sweep | not run | none |

---

## 10. Noise and void runs (P11)

| When (WIB) | What | Ruling |
|---|---|---|
| 06:42 | Two launches of the jest probe ended with `Validation Error: Module src/features/dashboard/use-held-value.test.tsx in the setupFiles option was not found`: `--setupFiles` was placed before the file arguments and took them as setup files | Void. No test ran. Repeated with the option last (exit 0) |
| 06:43 | The first launch of the two "before" lanes passed the label and the instant as one word (zsh does not split an unquoted variable); the runner script received no suite and no test ran | Void. Its 6 empty logs are in `.cache/w01b/logs/void/`. Repeated through a POSIX `sh` script |
| 07:06 | Hour scan, web, 09:40: `Tests  1 failed \| 269 passed (270)`; `src/test/routes.test.tsx > routes (AC-48 at stub level) > /session renders page-session-monitor inside the shell for a signed-in operator`, `TestingLibraryElementError: Unable to find an element by: [data-testid="page-session-monitor"]` after 1010 ms (the default 1 s wait for a lazily loaded page). The run took 57.65 s instead of about 20 s; `uptime` at 07:08 WIB: load averages 14.10 (1 min) and 20.22 (5 min) on 10 cores | **Load noise** (P9 load guard, P11). `routes.test.tsx` alone at 09:40, three times at 07:09 WIB: `Tests  31 passed (31)` each (3.8 to 4.0 s). The whole scan subset at 09:40 and 09:44 again at 07:09 WIB (load 8.85): `Tests  270 passed (270)` both. First log kept as `scan_web_20261006_094000.run1_load_noise.log` |

No run failed at start-up on `vite.config.ts` and no run hit an install window: the npm slot of
06:58:03 to 06:58:06 WIB fell between two of this row's mobile runs (the last "extra" run ended at
06:58:04 with 833 passed; the hour scan started at 06:58:30).

---

## 11. Rollback

Pre-image (P23, as the row asked): `.cache/rollback/W01b.pre.patch`, written before the first edit with
`git diff acaff20 -- apps/core-web/src/features/dashboard/__tests__/dashboard.test.tsx`. It is
**empty (0 bytes)**: the file was at its `acaff20` state (blob `c2d264bcd8ab2637b895e1e5aa3afa3ae29e835d`).

To undo this row (not executed):

```
git checkout acaff20 -- apps/core-web/src/features/dashboard/__tests__/dashboard.test.tsx
```

- After it, `git hash-object` of the file prints `c2d264bc…` and the failure of F26 returns.
- There is nothing to apply afterwards: `git apply` refuses an empty patch, so a script that follows
  P23 literally needs `git apply --allow-empty .cache/rollback/W01b.pre.patch`.
- The command also puts the path into the index, as `git checkout <commit> -- <path>` always does.

For a later row that owns the dashboard folder and rolls its own change back: this row's fix is saved
as `.cache/rollback/W01b.post.patch` (2,379 bytes, sha256 `54e5b542285f5d49bfc313d88f3ba808e228ef9a51f3d4e5dbd4abdc675d4721`,
`git diff acaff20 -- <file>` after the edit; `git apply --check -R` passed at 07:15 WIB). To return
to W01b's state from `acaff20`:

```
git checkout acaff20 -- apps/core-web/src/features/dashboard/__tests__/dashboard.test.tsx
git apply .cache/rollback/W01b.post.patch
git hash-object apps/core-web/src/features/dashboard/__tests__/dashboard.test.tsx   # 1ab07579e928b9b545003899ec3265d4b8b6c762
```

That later row's own pre-image (`git diff acaff20 -- <path>`, P23) will already contain this fix,
because it is taken against `acaff20`.

---

## 12. Commands to repeat the sweep

From `/Users/gsp-budi/Documents/DEMS`, no `cd` into a subfolder. `.cache/` is git-ignored: if the
scratch folder is gone, the two helper files are described in section 2 (the Proxy of
`.cache/w01/fake-clock.mjs` plus the shared offset; the same Proxy as a jest setup file).

One run, by hand (`<T>` is an instant such as `2026-10-06T00:05:00+07:00`):

```
W=/Users/gsp-budi/Documents/DEMS/.cache/w01b
DEMS_FAKE_NOW=<T> NODE_OPTIONS="--import $W/fake-clock.mjs" npm run test -w @dems/core-web -- --maxWorkers=2
DEMS_FAKE_NOW=<T> NODE_OPTIONS="--import $W/fake-clock.mjs" npm run test -w @dems/shared   -- --maxWorkers=2
DEMS_FAKE_NOW=<T> NODE_OPTIONS="--import $W/fake-clock.mjs" npm run test -w @dems/mobile   -- --maxWorkers=2 --setupFiles $W/fake-clock-jest-setup.js
```

The whole sweep, as this row ran it (two lanes side by side; each prints one block per run):

```
INSTANTS="i=2026-10-06T00:05:00+07:00 iii=2026-10-06T23:58:00+07:00 v=2027-03-01T12:00:00+07:00 ii=2026-10-06T02:00:00+07:00 iv=2026-11-15T12:00:00+07:00 vi=2026-11-01T00:05:00+07:00"
/bin/sh -c "$W/lane2.sh <phase> 'web shared' real=real $INSTANTS" > $W/logs/lane_a_<phase>.out 2>&1
/bin/sh -c "$W/lane2.sh <phase> 'mobile'     real=real $INSTANTS" > $W/logs/lane_b_<phase>.out 2>&1
```

- `lane2.sh <phase> "<suites>" <label>=<instant> …` calls `sweep2.sh <phase> <label> <instant|real> <web|shared|mobile> [test files]`
  for each pair; the log is `.cache/w01b/logs/<phase>_<suite>_<label>.log`, and a mobile run also
  writes `<phase>_mobile_<label>.probe` (one line per test context).
- Hour scan: `$W/scan.sh web 2026-10-06 00:10 00:24 …` and `$W/scan.sh mobile 2026-10-06 …`.
- Under zsh, pass the list through `/bin/sh -c` as shown, or write the pairs out: zsh does not split `$INSTANTS`.
- Duration measured here: about 45 s per instant for web plus shared, about 40 s for mobile.

---

## 13. Limits and what was not checked

- **Instants tried, not all instants.** 11 instants on the full suites and 20 times of day on the
  wall-clock files. A test that fails only in a window none of them hits would not show.
- **Tests added after this row are not covered**, except the three new shared files, which passed
  at the real clock and at (i), (iii), (v) in the final pass.
- **What the shift does not move**: `performance.now()`, an argument-less `Intl.DateTimeFormat().format()`,
  file timestamps and the host time zone (WIB throughout). No test was seen to depend on them; this
  was not searched for.
- **The mobile "before" runs carry no probe.** The probe was added for the later phases; the command
  was otherwise the same, and no mobile file changed in between.
- `@dems/core-server`, `@dems/mock-core` and the `scripts/pg` tests are outside this sweep.
- Whether "the clock alone is enough" without the `issuedAt` change was not measured (the same open
  point as W01, section 2.4 of `01_baseline_test_fix.md`).

---

## 14. Commands run (in order)

| # | When (WIB) | Command | Exit |
|---|---|---|---|
| 1 | 06:40 | Read the inputs; `git check-ignore -v .cache/w01b/x`; write the preload, the jest setup file and the runner scripts | 0 |
| 2 | 06:42 | Jest probe, two launches with `--setupFiles` before the file arguments | 1, 1 (void) |
| 3 | 06:42 to 06:43 | Jest probe with the option last; control with a log-only setup file | 0, 0 |
| 4 | 06:43 | First launch of the "before" lanes (shell-variable mistake) | void |
| 5 | 06:43 to 06:47 | "Before" sweep: 6 instants × 3 suites (two lanes) | web 1, 0, 1, 0, 0, 1 for (i), (iii), (v), (ii), (iv), (vi); shared 0 × 6; mobile 0 × 6 |
| 6 | 06:44 | `git diff acaff20 -- <file> >> .cache/rollback/W01b.pre.patch`; `git rev-parse acaff20:<file>`; `git hash-object <file>` | 0 |
| 7 | 06:48 | Edit of `dashboard.test.tsx`; the file alone at the real clock, (i), (v), (vi) | 0 × 4 |
| 8 | 06:48 | `npm run typecheck -w @dems/core-web`; `npm run lint -w @dems/core-web` (run 1); `git hash-object` | 0, 0 |
| 9 | 06:49 to 06:54 | "After" sweep: real clock and 6 instants × 3 suites | 0 × 21 |
| 10 | 06:49 to 06:55 | Vitest probe (shared and core-web binaries, with and without the preload); jest fake-timer probe (both parts; setup file alone) | 0, 1 (control), 0; 0, 0 |
| 11 | 06:54 to 06:58 | "Extra" sweep: 5 instants × 3 suites | 0 × 15 |
| 12 | 06:58 to 07:08 | Hour scan: web 19 times, mobile 19 times | web 0 × 18 and 1 (load noise at 09:40); mobile 0 × 19 |
| 13 | 06:58 | `tsc -p tsconfig.app.json --listFilesOnly`; `oxlint -f json` | 0, 0 |
| 14 | 07:09 | `routes.test.tsx` alone at 09:40, three times; scan subset at 09:40 and 09:44 | 0 × 5 |
| 15 | 07:10 to 07:14 | "Final" pass: real clock, (i), (iii), (v) × 3 suites | 0 × 12 |
| 16 | 07:14 | Typecheck and lint (run 2); `git hash-object`; `git status --porcelain`; `git diff --stat acaff20` | 0 each |
| 17 | 07:15 | `git diff acaff20 -- <file> > .cache/rollback/W01b.post.patch`; `git apply --check -R`; `gzip` of this row's logs above 1 MB | 0 |
| n/a | 07:09, 07:15 | `ps`, `pgrep`: refused by the sandbox (`operation not permitted`, `Cannot get process list`) | not run |

Logs: `.cache/w01b/logs/` (git-ignored; the lines that matter are quoted above).

---
*Generated: 2026-10-04 07:20 WIB by coder-execution (controller row W01b)*
