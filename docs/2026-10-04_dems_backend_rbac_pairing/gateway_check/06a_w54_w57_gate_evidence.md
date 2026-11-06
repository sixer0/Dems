---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-05
agent: verifier-local
subject: gate evidence for W54 (blueprint step 76) and W57 (step 79)
decision_ref: D135
mode: read-only on the tree; nothing ruled here
source_plan: /docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
status: evidence-complete
---

# 06a. Gate evidence for the two ungated returns — W54 and W57

Measured by `verifier-local` on 2026-10-05, 10:06 to 10:24 WIB, from `/Users/gsp-budi/Documents/DEMS`.
Read-only: no source, test or document file outside this report and my own progress file was created,
changed or deleted; no `git` write; no `test:db` run (owned elsewhere per D131/D132).

This file **measures and reports**. It does not rule on F76-1..12, decisions 1..14 of W54, or DN-1..8 of
W57 — those belong to the controller under D135. Section I lists what is still open.

| Row | Document | Progress file | Base commit | Tree state |
|---|---|---|---|---|
| W54 (step 76) | `implementation/54_web_shell_admin_routes.md` | `delegation_progress/coder_execution_step_76.md` | `acaff20` (`git diff`/`hash-object` comparisons use it) | HEAD `4b708c8`; the row's files are untracked (nothing is committed since the docs commit) |
| W57 (step 79) | `implementation/57_mobile_pairing_flow.md` | `delegation_progress/coder_execution_step_79.md` | same | same |

**Two facts that shape every measurement below.**

1. **Neither row's gate block was ever written.** W54's result cells hold the unfilled tokens
   `GATE_WEB_LINE`, `GATE_MINE`, `GATE_SHARED_LINE`, `MUT_LINE`, and its sections 16 and 17 hold
   `GATE_BLOCK` and `MUT_BLOCK` (`54_web_shell_admin_routes.md:28-33`, `:485`, `:489`); its progress
   file holds `MUT_END` and `GATE_TIME`/`GATE_SUMMARY` (`coder_execution_step_76.md:22`, `:24`).
   W57's hold `@@MUT_SUMMARY@@`, `@@GATE_SUMMARY@@`, `@@RUN2@@`, `@@GATE_BODY@@`, `@@GENERATED@@`
   (`57_mobile_pairing_flow.md:41`, `:42`, `:345`, `:358`, `:622`) and its progress file `@@LATER@@`
   (`coder_execution_step_79.md:44`). **No runner total of either row is quotable from its own document**;
   sections A to F here are the substitute evidence.
2. **Three other rows are in the tree at the same time.** Per P11, a red outside both rows' paths is
   recorded with both runs and attributed by path and mtime, not absorbed. The one such red found is
   `@dems/mobile` typecheck and lint, in `apps/mobile/src/features/login/**` (W59, D133) — see A.4/A.5.

Load: `uptime` at 10:07 was `load averages: 4.33 4.09 3.04` (P9 guard not fired); every suite ran with
`--maxWorkers=2`, one workspace at a time. Node `v26.8.2`, npm `11.19.1`.

---

## A. Workspace totals now (P24 ledger: shared 508/28, core-web 438/39, mobile 833/72, mock-core 19/4)

### A.1 `npm run test -w @dems/core-web -- --maxWorkers=2` — 10:07:48, 59.88 s

```
> @dems/core-web@0.1.0 test
> vitest run --maxWorkers=2

 Test Files  55 passed (55)
      Tests  759 passed (759)
   Start at  10:07:48
   Duration  59.88s (tests 68%, import 15%, environment 11%, setup 4%, transform 2%)
CORE_WEB_EXIT=0
```

**55 files / 759 tests / 0 failed / exit 0 → meets "at or above 759 / 55".** No `dems.shell.intro`
failure is present in this run (finding F76-1 — see D).

### A.2 `npm run test -w @dems/mobile -- --maxWorkers=2` — started 10:09, 48.891 s

```
Test Suites: 90 passed, 90 total
Tests:       1187 passed, 1187 total
Time:        48.891 s, estimated 156 s
MOBILE_EXIT=0
```

**90 suites / 1,187 tests / 0 failed / exit 0 → meets "at or above 1,187 / 90".** Timing note that
keeps this number clean for the ledger: W59's new file `apps/mobile/src/features/login/live-login.test.tsx`
was **born 10:14:33**, after this run started, so it is not one of the 90 suites.

### A.3 `npm run test -w @dems/shared -- --maxWorkers=2` — 10:11:12, and a second run 10:15:13 for the exit code

```
 Test Files  68 passed (68)
      Tests  1814 passed (1814)
   Start at  10:11:12
   Duration  8.49s
```

The first run's exit code was lost through a pipe (`SHARED_EXIT=` empty), so the suite was run a second
time with the code captured directly:

```
SHARED_TEST_EXIT=0
   Start at  10:15:13
   Duration  8.63s
```

**68 files / 1,814 tests / 0 failed / exit 0 → meets "at or above 1,814 / 68".** The D126 grant
(`packages/shared/test/i18n.test.ts`, two namespaces) is green: the pinned list is closed at 15 files.

`@dems/mock-core` (ledger 19/4) was **not** run: P5 reserves that suite for W89 and W97.

### A.4 Typecheck, per workspace

| Workspace | Command | Exit | Output |
|---|---|--:|---|
| `@dems/shared` | `npm run typecheck -w @dems/shared` (10:15:2x) | **0** | `> tsc --noEmit` (no output) |
| `@dems/core-web` | `npm run typecheck -w @dems/core-web` (10:15:3x) | **0** | `> tsc -b` (no output) |
| `@dems/mobile` | `npm run typecheck -w @dems/mobile` (run 1 10:15:41, run 2 10:17:17) | **2** | run 1 and run 2, identical single error: `src/features/login/live-login.test.tsx(151,9): error TS2367: This comparison appears to be unintentional because the types '"CONNECTING"' and '"OPEN"' have no overlap.` |

The failing file is **not** of either row: untracked, birth `Oct 5 10:14:33`, inside
`apps/mobile/src/features/login/` — W59's folder under D133, whose owner is writing it now. Nothing under
`apps/mobile/src/features/pairing/` or the granted line of `features/home/home-screen.tsx` is named by
the error. Both runs are recorded per P11.

### A.5 Lint, per workspace

| Workspace | Command | Exit | Output |
|---|---|--:|---|
| `@dems/shared` | `npm run lint -w @dems/shared` (10:16:08) | **0** | `> oxlint` (no finding) |
| `@dems/core-web` | `npm run lint -w @dems/core-web` (10:16:08) | **0** | `> oxlint` (no finding) |
| `@dems/mobile` | `npm run lint -w @dems/mobile` (run 1 10:16:20, run 2 10:17:30) | **1** | run 1: `✖ 5 problems (2 errors, 3 warnings)`; run 2: `✖ 4 problems (2 errors, 2 warnings)`. Every finding is in `src/features/login/live-login.test.tsx` (unused `FakeConnection`, `wire`, `elapse`) or `src/features/login/use-login-controller.ts:154:41` "Calling setState synchronously within an effect" and `:157:36` "Cannot access refs during render" |

Run 1 and run 2 differ only because W59's file changed between them (another row writing) — P11 noise,
attributed, not absorbed. **No lint finding names any file of W54 or W57.** `@dems/core-web` lint (which
covers all three W54 shell test files and every shell file) exits 0.

---

## B. W54 claims (web shell, navigation, admin routes)

### B.1 The three new shell test files exist and pass

```
$ ls apps/core-web/src/test/live-shell-*.test.tsx
apps/core-web/src/test/live-shell-admin.test.tsx
apps/core-web/src/test/live-shell-indicator.test.tsx
apps/core-web/src/test/live-shell-notices.test.tsx
```

```
$ npm run test -w @dems/core-web -- src/test/live-shell-indicator.test.tsx \
    src/test/live-shell-notices.test.tsx src/test/live-shell-admin.test.tsx --maxWorkers=2
SHELL3_EXIT=0
 Test Files  3 passed (3)
      Tests  84 passed (84)
   Duration  14.26s
```

**3 files / 84 tests, exit 0.** (The document's `GATE_MINE` token was never filled; 84 is the measured
number, and the whole-workspace run of A.1 includes them.)

### B.2 The indicator, the ADMINISTRATION group, the two routes and their guard exist as described

| Claim | Where measured | Quoted |
|---|---|---|
| Mode indicator, four states, chip + `data-state` | `components/shell/mode-indicator-state.ts:3`, `:21-26`; `mode-indicator.tsx:42-43` | `export type ModeIndicatorState = 'SIMULATED' \| 'LIVE' \| 'OFFLINE' \| 'RECONNECTING'`; `if (link === LiveLinkState.CONNECTING \|\| link === LiveLinkState.RESYNCING) return 'RECONNECTING'`; `'data-state': state`, `'data-testid': 'shell-mode'` |
| Indicator mounted between the device block and the bell | `top-bar.tsx:76` | `<ModeIndicator />` (a `Separator` at `:75` and `:77`) |
| ADMINISTRATION group, two items, both `liveOnly` + permission | `nav-items.ts:75-76`, `:81` | `{ id: 'users-roles', to: '/admin/users', … group: 'admin', permission: Permission.USER_ADMIN, liveOnly: true }` and the `paired-devices` twin; `export const ADMIN_NAV_ITEMS = NAV_ITEMS.filter((item) => item.group === 'admin')` |
| The group is rendered as its own section | `sidebar.tsx:84`, `:126`, `:71` | `<AdminNavGroup items={adminItems} … />`, `function AdminNavGroup(…)`, `data-admin={adminItems.length > 0 ? 'true' : undefined}` |
| Two admin routes + one guard | `routes/_app/admin/users.tsx:12-13`, `devices.tsx:12-13`, `-guard.ts:19-23` | `beforeLoad: ({ context }) => requireCorePermission(context.sim, Permission.USER_ADMIN)` (resp. `PAIRING_MANAGE`); guard body `if (coreModeOf(sim) === CoreMode.LIVE && !corePermissionOf(sim, permission)) { throw redirect({ to: '/dashboard', replace: true }) }` |
| Guard map of three routes exists (the notice reads it) | `components/shell/route-permissions.ts:14-18` | `'/session/new': Permission.SESSION_START`, `'/admin/users': Permission.USER_ADMIN`, `'/admin/devices': Permission.PAIRING_MANAGE` |
| Both routes are in the generated tree | `src/routeTree.gen.ts:22-23`, `:80-86` | `import { Route as AppAdminDevicesRouteImport } from './routes/_app/admin/devices'`, `id: '/admin/users'`, `path: '/admin/users'` |
| The two page stubs are stubs | `features/users-roles/index.tsx`, `features/paired-devices/index.tsx` (1,698 and 1,746 bytes) | each: docblock "STUB of plan row W54: the page contract only", then `PageHeader` + Live branch `EmptyState data-testid="ur-stub"` / `"pd-stub"` with `t('common.states.empty')`, Simulated branch `LiveOnlyState … testId="ur-live-only"` / `"pd-live-only"`. No panel, no query, no form, no button of its own |
| The two namespaces are registered and the shell words exist | `packages/shared/src/i18n/index.ts:48`, `:55`, `:72-73`; `en/shell.ts:28`, `:34`, `:41`, `:47`, `:117-119`; files `en/users-roles.ts`, `en/paired-devices.ts` exist | `import { pairedDevices } from './en/paired-devices';`, `usersRoles,`/`pairedDevices,` in the registration; `tooltip: {`, `switchHint: {`, `roleNotice: {`, `liveOnly: {`, `adminGroup: 'ADMINISTRATION'`, `usersRoles: 'Users & Roles'`, `pairedDevices: 'Paired Devices'` |

### B.3 Protected existing test files absent from `git diff --stat acaff20`

```
$ git diff --stat acaff20 -- apps/core-web/src/test/routes.test.tsx \
    apps/core-web/src/test/core-endpoint.test.tsx \
    apps/core-web/src/lib/packaged-csp.ts \
    apps/core-web/src/test/packaged-csp.test.ts \
    apps/core-web/src/lib/packaged-csp.test.ts
(no output; exit=0)
```

Stronger check, blob equality (worktree vs `acaff20`):

```
apps/core-web/src/test/routes.test.tsx        acaff20=7a04c97d66fef15ed36f753a87a91c400f7b9500  worktree=7a04c97d…  SAME
apps/core-web/src/lib/packaged-csp.ts         acaff20=78c8898ecb89206beda222030c918958143316c3  worktree=78c8898e…  SAME
apps/core-web/src/test/shell-motion.test.tsx  acaff20=4d82e08e6bc5417e388dcda98682e7789f96b80c  worktree=4d82e08e…  SAME
```

* `shell-motion.test.tsx` is the **only** pre-existing shell test in the tree at `acaff20` — unchanged,
  and green inside the A.1 run. This is the "existing shell tests absent" clause of the row's cell.
* `apps/core-web/src/test/core-endpoint.test.tsx` and `packaged-csp.test.ts` **do not exist**, at
  `acaff20` or now (verified with `git cat-file -e` and the filesystem). Their absence from the diff is
  therefore vacuous. The plan text that names them is `02_plan.md:717` (row W50) and the same wording is
  inherited by W54's cell; the real protected artefacts are `lib/packaged-csp.ts` (read-only per P6 —
  verified unchanged by hash) and `lib/core-endpoint.ts`, which **is** modified in the tree (+72/−…, by
  W50, the row that owns it per `02_plan.md:717`), not by W54 — W54's own document lists `lib/**` among
  "Not written" (`54_web_shell_admin_routes.md:71-73`).

Full list of existing (i.e. `acaff20`-tracked) web **test** files that do differ from `acaff20`, with the
recorded owner of each change — none is W54's:

```
 .../dashboard/__tests__/dashboard.test.tsx     |  13 +-   (W01b, mtime Oct 4 06:48, hash 1ab07579…, recorded in coder_execution_step_w01b.md:19)
 .../__tests__/security-audit.test.tsx          |   2 +-   (W01c, mtime Oct 4 07:53, hash 5470ce3f…, coder_execution_step_w01c.md:41)
 .../storage/__tests__/storage-page.test.tsx    |  13 +-   (W01, section 8.1 "W01's state")
 apps/core-web/src/test/sim-fetch.test.ts       |  13 +-   (W01, section 8.1 "W01's state")
```

### B.4 The granted lines of D121 and D126 are exactly as granted

```
$ git diff --numstat acaff20 -- apps/core-web/src/features/home/home-page.tsx
1       1       apps/core-web/src/features/home/home-page.tsx
-            mock-core v{health.data.version} · api {health.data.apiVersion}
+            {health.data.service.replace(/^dems-/, '')} v{health.data.version} · api {health.data.apiVersion}
```
at `home-page.tsx:178` (sed of lines 176-180 confirms the position). One line, as D121 F72-3 grants.

```
$ git diff --numstat acaff20 -- packages/shared/test/i18n.test.ts
3       1       packages/shared/test/i18n.test.ts
+  'users-roles.ts': 'usersRoles',        (line 58)
+  'paired-devices.ts': 'pairedDevices',  (line 59)
-  it('has exactly 13 namespace files and one en key per file', () => {
+  it('has exactly 15 namespace files and one en key per file', () => {   (line 93)
```
Exactly the three lines of D126's grant ("the namespace list and count … kept a closed list"); the
comment at `i18n.test.ts:2` was left saying "13 namespaces", as the row states (its decision 14).

### B.5 W54's mutation check (M15) — evidence exists, but not in `assets/` and unresolved at the break

* No `54_*` asset mentions a gate or mutation run: `ls assets | grep '^54_' | grep -i "gate\|mut"` prints
  nothing, although the progress file promises "the baseline, gate and mutation logs"
  (`coder_execution_step_76.md:50`). Only `54_baseline_web_test.log` is there.
* The record lives in git-ignored scratch `.cache/w54/mut/` (list: `mutations_run1.log` 21:31,
  `mutations_run1b.log` 21:51, `mutations_run1c.log` 22:01, `mutations_run1d.log` 22:02,
  `mutations_run1e.log` 22:05, `mutations.json` = 137 entries):

```
## 2026-10-04 21:51:11 WIB 57 mutations: 55 detected, 2 survived ['T02', 'G05'], 0 not applied []
## 2026-10-04 22:01:15 WIB 59 mutations: 55 detected, 4 survived ['W11', 'N36', 'N39', 'N40'], 0 not applied []
## 2026-10-04 22:02:50 WIB 2 mutations: 2 detected, 0 survived [], 0 not applied []
## 2026-10-04 22:05:15 WIB 9 mutations: 9 detected, 0 survived [], 0 not applied []
```

  Re-tests after a survival are recorded only for T02 and N36 (run 1d). These four survived their **last**
  recorded run and have no re-test on the record:

```
G05 SURVIVED  routes/_app/admin/-guard.ts: the redirect leaves a history entry
W11 SURVIVED  components/shell/mode-switch.tsx: a second press while switching sends a second switch
N39 SURVIVED  components/shell/live-notices.tsx: the first comparison after a sign-in reports a change
N40 SURVIVED  components/shell/live-notices.tsx: the notices are rendered in Simulated mode
```

  Last edit times around that: `mode-switch.tsx` and `live-shell-indicator.test.tsx` 21:30,
  `live-notices.tsx` 21:17, `-guard.ts` 20:52, `live-shell-notices.test.tsx` 21:41,
  `live-shell-admin.test.tsx` 22:02; last mutation activity 22:05:15 — the session break (D130).
  Whether these four were fixed afterwards cannot be seen from the tree; only from a re-run of M15.

---

## C. W57 claims (mobile pairing flow)

### C.1 The four new test files exist and the folder's totals match the row's claim (6 suites / 66 tests)

```
$ ls apps/mobile/src/features/pairing/
i18n.ts                    pairing-live-model.ts        pairing-screen.test.tsx
pairing-code-panel.tsx     pairing-live-static.test.ts  pairing-screen.tsx
pairing-live-model.test.ts pairing-live.test.tsx        stack-check-service-name.test.tsx
pairing-live-model.ts      pairing-model.test.ts        unpair-dialog.tsx
pairing-live.test.tsx      pairing-model.ts             use-dialog-presence.ts
                           pairing-screen.test.tsx      use-pairing-flow.ts
```

```
$ npm run test -w @dems/mobile -- src/features/pairing --maxWorkers=2 --json --outputFile=/tmp/kilo_pairing.json
PAIRING_EXIT=0
Test Suites: 6 passed, 6 total
Tests:       66 passed, 66 total
Time:        13.302 s
```

Per file, from the same JSON (the claim in `57_mobile_pairing_flow.md:60-63` and
`coder_execution_step_79.md:60-62`):

```
features/pairing/pairing-live-model.test.ts    tests=12  passed
features/pairing/pairing-live-static.test.ts   tests=10  passed
features/pairing/pairing-live.test.tsx         tests=27  passed
features/pairing/pairing-model.test.ts         tests= 7  passed
features/pairing/pairing-screen.test.tsx       tests= 8  passed
features/pairing/stack-check-service-name.test.tsx tests=2 passed
total tests=66  suites=6
```

Four new files (27 + 12 + 10 + 2 = 51) and the two existing ones (7 + 8 = 15, matching the row's
"the existing tests … (8) and … (7) pass, unchanged"). **The row's claim "the folder: 6 suites, 66 tests"
is exact.**

### C.2 The one granted line of `features/home/home-screen.tsx:217` is present

```
$ git diff --numstat acaff20 -- apps/mobile/src/features/home/home-screen.tsx
1       1       apps/mobile/src/features/home/home-screen.tsx
-            {health.data ? `mock-core v${health.data.version} · api ${health.data.apiVersion}` : 'mock-core'}
+            {health.data ? `${health.data.service.replace(/^dems-/, '')} v${health.data.version} · api ${health.data.apiVersion}` : 'mock-core'}
```
`sed -n '215,219p'` places the changed text at line 217. This matches D124 ruling 2 and the pre/post
quote at `57_mobile_pairing_flow.md:73-77`. It is also pinned by a test of the row
(`stack-check-service-name.test.tsx`, 2 tests, green in C.1).

### C.3 The two existing pairing test files are unchanged against `acaff20`

```
$ git ls-tree -r acaff20 -- …/pairing-model.test.ts …/pairing-screen.test.tsx
100644 blob c882a126fef98eb34dc1165052af5cc328057111  apps/mobile/src/features/pairing/pairing-model.test.ts
100644 blob 6d14036c098f1c4f626c201b2b52e2ccd3e45705  apps/mobile/src/features/pairing/pairing-screen.test.tsx
$ git hash-object …/pairing-model.test.ts …/pairing-screen.test.tsx
c882a126fef98eb34dc1165052af5cc328057111
6d14036c098f1c4f626c201b2b52e2ccd3e45705
$ git diff --stat acaff20 -- <both files>
(no output; exit=0)
```
The two hashes equal the ones quoted in the row's CLG log (`57_clg_evidence.log`, quoted at
`57_mobile_pairing_flow.md:204-205`). **CLG (a) holds for this folder.**

### C.4 The screencaps named by the row exist; two of the named logs do not

All nine tablet screencaps named in section 4.7 are present in `implementation/assets/`:

```
57_tablet_landscape_unpaired.png          57_tablet_portrait_simulated_after_turn.png
57_tablet_landscape_paired.png            57_tablet_portrait_simulated_coldstart.png
57_tablet_landscape_simulated.png         57_tablet_portrait_paired_coldstart.png
57_tablet_portrait_unpaired_after_turn.png 57_tablet_landscape_paired_after_turn.png
57_tablet_portrait_paired_after_turn.png
```
28 `57_*` assets in all (the folder holds 43 `54_*`). But two files named in section 13 are **absent**:

```
$ ls assets | grep '^57_' | grep -iE "gate|verbose"
(none)
```
`57_gate_final.log` (§4.6's evidence line, "Final gate") and `57_live_tests_verbose.txt` do not exist.
Together with `@@GATE_SUMMARY@@`/`@@GATE_BODY@@` this means **the row's own final mobile totals are not
recorded anywhere in the task folder** — A.2 and C.1 are their substitute.

The mutation evidence of this row *is* in `assets/`, and its run-2 summary (the unfilled `@@RUN2@@` cell)
can be read from the log itself:

```
$ tail -12 assets/57_mutations_run2.log
## 27 detected, 0 not detected, 0 errors, of 27
## the mutated files in the tree, before and after: identical
   … nine files listed with "same" …
exit=0
```
So W57's M15 record reads 82/89 (run 1, six survivors + one not applied, section 4.5) plus 27/27 (run 2),
with the tree provably untouched by the harness.

---

## D. F76-1 check — is `live-runtime-startup.test.tsx` green now?

The file is untracked (created by W50), so `git diff acaff20` on it prints nothing; the content itself is
the evidence. Lines 396-399 today:

```
    expect(window.sessionStorage.getItem('dems.sim.v1')).toBe(SNAPSHOT)
    expect(window.sessionStorage.getItem('dems.auth')).toBe(AUTH)
    // The Login page hands off a session it did not submit (§5.4, W55), so the shell is really mounted here and writes its own intro marker: nothing about the session.
    expect({ ...window.sessionStorage }).toEqual({ ...before.session, 'dems.shell.intro': '1' })
```

The assertion at **:399** (the granted comment at :398) is exactly D128 ruling 1's "closed comparison with
the one shell key". Runs:

```
$ npm run test -w @dems/core-web -- src/test/live-runtime-startup.test.tsx --maxWorkers=2
STARTUP_EXIT=0
 Test Files  1 passed (1)
      Tests  22 passed (22)
   Start at  10:18:09
```
and the whole workspace run of A.1 (55 files / 759 tests, exit 0) contains it. **F76-1 no longer reproduces**:
the granted change is in the tree and the test is green, consistent with D128's "closed at 21:58".

---

## E. Duplicate-confirm check for D128 point 4

Two implementations of the confirmed mode change, with identical test IDs:

| Copy | File:hook | Mounted by | Test IDs it renders |
|---|---|---|---|
| shell | `apps/core-web/src/components/shell/mode-switch.tsx:30` `export function useModeSwitch()` | `mode-indicator.tsx:29`, `live-notices.tsx:56`, `live-only-state.tsx:25`; exported for other rows at `components/shell/index.ts:18` | `data-testid="mode-switch-dialog"` (`:69`), `"mode-switch-cancel"` (`:78`), `"mode-switch-confirm"` (`:81`) |
| login | `apps/core-web/src/features/login/use-mode-switch.tsx:34` `export function useLoginModeSwitch()` | `features/login/index.tsx:61` | the same three strings (`:80`, `:89`, `:92`) |

Do tests pin either? Yes, both — and **by the same identifiers**, so the two cannot be told apart by test
ID alone:

```
apps/core-web/src/test/live-shell-indicator.test.tsx: dialog=11 confirm=4 cancel=1   (W54, shell surfaces)
apps/core-web/src/test/live-shell-notices.test.tsx:   dialog=1  confirm=1 cancel=0   (W54)
apps/core-web/src/test/live-shell-admin.test.tsx:     dialog=1  confirm=1 cancel=0   (W54)
apps/core-web/src/test/live-login-page.test.tsx:      dialog=7  confirm=4 cancel=1   (W55, the Login page)
```

Each test reaches the copy its own surface mounts, so all four files are green today (A.1). What this
measurement does **not** settle, and D128 point 4 asks to rule: which file survives the unification, and
whether the two can ever be in one tree at once (Login hands off to the shell in the very test of section D).
Noted for the ruling, not judged here.

---

## F. Secret scan over both rows' documents and assets

Scan set: 75 files = the two implementation documents, the two progress files, and every
`implementation/assets/54_*` (43) and `57_*` (28). Script:
`/var/folders/…/T/kilo/w54_w57_secret_scan.mts`, run under `node --import tsx`; it imports the two seeded
constants from `packages/shared/src/sim/dataset.ts` and **prints counts only — never a value**. Passwords
and pairing codes are compared as literals; runs of digits are reported as counts, and their kind was
checked with a second script that masks every digit (`masked_context.mts`).

```
files scanned: 75
TOTALS: seeded-password-literal=0  pairing-code-literal=0
        constant-name-DEMO_OPERATOR_PASSWORD=15  constant-name-DEMO_PAIRING_CODE=0
        credential-prefix-values(ses_|dvc_|bio_)=0  Authorization-Bearer-value=0
        cookie-name-dems_session_=0  set-cookie-header=3  six-digit-runs=52
```

| Pattern | Count | Reading |
|---|--:|---|
| seeded password literal (`DEMO_OPERATOR_PASSWORD`'s value) | **0** | no credential in any document, log, JSON, script or PNG of either row |
| pairing-code literal (`DEMO_PAIRING_CODE`'s value) | **0** | ditto for the code |
| positive control: the constant **name** `DEMO_OPERATOR_PASSWORD` | **15** | the search works. Distribution: `54_web_shell_admin_routes.md` 2, `coder_execution_step_76.md` 1, `54_lane_cdp_driver.mjs.txt` 6, `54_lane_layout_driver.mjs.txt` 4, `57_issue_and_type.mts.txt` 2 — all name references (D-13's statement that the value was never written holds) |
| `ses_` / `dvc_` / `bio_` values, `Bearer <value>`, cookie name `dems_session_<port>` | 0 / 0 / 0 | no credential-shaped value |
| the word `set-cookie` (case-insensitive) | 3 | one per lane script, a header-name filter, masked quote: `#:grep -i -E '^(HTTP\|cache-control\|set-cookie)' "$OUT/health_headers.txt" \| tr -d '\r'` — a filter, not a value |
| runs of exactly six digits | 52 | 26 are inside PNG bytes; the 26 in text were characterised digit-masked, each is a git-hash fragment, a byte count, a stored-value length, a log-line count, a run id, `PCD-######`, an epoch-millis, or an audit-head hash. Examples: `...obile.log.v#\|###`, `dems.sim.v#\|######`, `codeId PCD-######`, `###### device log lines`, `"time":#############`, `audit head seq ##; hash ######f#ba####e#`. **None is a bare six-digit candidate code.** |

A limitation of the scan, stated plainly: it tests the **simulator's** demo code and the seeded password.
The lane-issued code of session 1 was generated at runtime and is not recoverable for comparison; the
digit-masked characterisation above, plus the row's own scans quoted in `57_mobile_pairing_flow.md:409-413`,
are what stands behind "no issued code in an asset".

---

## G. State left behind (read-only)

### G.1 Device security, unchanged from D125

```
$ bash apps/mobile/scripts/emulator-user-lock.sh status
phone (emulator-5554): AVD dems2_phone, isKeyguardShowing=false, CredentialType=PIN, fingerprint count=1, lock screen disabled=unreadable
phone2 (emulator-5558): AVD dems2_phone2, isKeyguardShowing=false, CredentialType=NONE, fingerprint count=0, lock screen disabled=true
tablet (emulator-5556): AVD dems2_tablet, isKeyguardShowing=false, CredentialType=PIN, fingerprint count=1, lock screen disabled=unreadable
STATUS_EXIT=0   (2026-10-05 10:11:35 WIB)
```
Matches D125 exactly (phone and tablet: PIN + one fingerprint, no keyguard; phone2 lock-free) and the two
lock files of W57 (`57_lock_status_start.txt` 20:34:33, `57_lock_status_end.txt` 22:00:53). `status` is the
script's read-only action; no agent touched `setup`/`unlock`/`remove`.

### G.2 Listeners

```
$ lsof -nP -iTCP:4421-4423 -sTCP:LISTEN ; exit 1   (no output)
$ lsof -nP -iTCP:5176-5178 -sTCP:LISTEN ; exit 1   (no output)
$ lsof -nP -iTCP:8081-8086 -sTCP:LISTEN ; exit 1   (no output)
```
Context, same instant: 4400 (mock-core), 4420 (main instance), 5173-5175 — all free; 4432 holds
`postgres pid=19121`, the instance W07 leaves running. **Nothing of either row is listening.**

### G.3 `.locks/` leftovers

```
$ wc -c .locks/core-server.lane*.pid
       0 .locks/core-server.lane1.pid
       0 .locks/core-server.lane2.pid
       0 .locks/core-server.lane3.pid
       0 .locks/core-server.lane3.vite.pid
       0 total
```
**Four empty pid-file leftovers**, exactly as both rows state (W54 §22 "the two emptied pid files"; W57
DV-13 "emptied, not removed"). Around them: three empty lane locks (`lane1/2/3.lock`, created by `lockf`)
and two non-empty lane-3 logs (`core-server.lane3.log` 21,948 B, `core-server.lane3.vite.log` 1,433 B).
`.locks/mock-core.users/` and `.locks/vite.users/` are empty directories — no stale service registrations.
Leftover count for this report: **4 empty pid files** (the item asked); **9 files** if the three lane locks
and the two lane-3 logs are counted too. All are git-ignored scratch, none is a running process.

### G.4 One extra read-only measurement the controller will want for DN-6

```
$ npm run db:status -w @dems/core-server -- --database dems_lane_2
  audit_log                95
  paired_devices            1
  device_credentials        1
  pairing_codes             1
  biometric_tokens          0
db:status: OK: dems_lane_2 is at the schema version this code expects and the ledger matches the files.
DB_STATUS_EXIT=0
```
The lane-2 pairing state W57 left is still there, byte-for-byte the counts its section 8 claims
(`paired_devices 1`, `device_credentials 1`, `pairing_codes 1`, `audit_log 95`). Whether the tablet stays
paired (DN-6) remains the controller's call; this only says the state has not been disturbed since.

---

## H. Claim → measured → verdict

| # | Claim (row · source) | Measured now | Verdict |
|---|---|---|---|
| 1 | W54 · web suite exits 0 at the ledger (`02_plan.md:721` verification cell) | 55 files / 759 tests / 0 failed / exit 0 (A.1) | **PASS** |
| 2 | W54 · shared suite exit 0 with the granted i18n list | 68 / 1,814 / exit 0 (A.3) | **PASS** |
| 3 | W54 · typecheck and lint exit 0 | `@dems/core-web` 0 and 0; `@dems/shared` 0 and 0 (A.4, A.5) | **PASS** |
| 4 | W54 · three new shell test files exist and pass | 3 files, 84 tests, exit 0 (B.1) | **PASS** |
| 5 | W54 · indicator, ADMINISTRATION group, two routes + guard, two stubs, two namespaces "as described" | all present and as described, quoted per part (B.2) | **PASS** |
| 6 | W54 · `routes.test.tsx` and the pre-existing shell tests absent from `git diff --stat acaff20` | absent; blob-equal (`routes.test.tsx`, `shell-motion.test.tsx`) | **PASS** |
| 7 | W54 · `packaged-csp.ts` untouched (P6 read-only) | blob-equal `78c8898e…` | **PASS** |
| 8 | W54 · `core-endpoint.test.tsx` / `packaged-csp.test.ts` absent from the diff | **no file with either name exists**, at `acaff20` or in the tree | **CANNOT VERIFY** (vacuous gate clause; the plan names files that do not exist) |
| 9 | W54 · D121 grant = one line of `home-page.tsx` | `1 1`, the exact after-text at :178 | **PASS** |
| 10 | W54 · D126 grant = three lines of `packages/shared/test/i18n.test.ts` | `3 1`, exactly the two entries + the 13→15 title | **PASS** |
| 11 | W54 · F76-1 (the W50 test red) resolved by D128 ruling 1 | assertion at :399 as granted; file alone 22/22 exit 0; whole suite green | **PASS** |
| 12 | W54 · M15 mutation check complete (result cell, and "mutation logs" in `assets/54_*`) | no `54_*` gate/mutation asset; the record is `.cache/w54/mut/` only; 4 survivors (G05, W11, N39, N40) with no recorded re-test; last entry 22:05:15 | **FAIL** (documentation) / **CANNOT VERIFY** (the final M15 result without a re-run) |
| 13 | W54 · its document records the gate and mutation results (sections 16, 17, result cells) | tokens `GATE_WEB_LINE`, `GATE_MINE`, `GATE_SHARED_LINE`, `MUT_LINE`, `GATE_BLOCK`, `MUT_BLOCK`, `GATE_TIME`, `GATE_SUMMARY` unfilled | **FAIL** |
| 14 | W57 · mobile suite exit 0 at the ledger | 90 suites / 1,187 tests / exit 0 (A.2) | **PASS** |
| 15 | W57 · mobile typecheck and lint exit 0 | typecheck exit 2, lint exit 1 — **all findings in `apps/mobile/src/features/login/**` (W59)**; none in `features/pairing` or `home-screen.tsx`; both runs recorded | **FAIL on the tree now**, not attributable to W57 (see A.4/A.5) |
| 16 | W57 · four new test files, folder = 6 suites / 66 tests | 6/66 exit 0, per-file 27/12/10/2/7/8 (C.1) | **PASS** |
| 17 | W57 · CLG (a): the two existing pairing test files are `acaff20`'s | blob hashes equal `c882a126…`, `6d14036c…`; diff empty | **PASS** |
| 18 | W57 · D124 ruling 2 grant = one line, `home-screen.tsx:217` | `1 1`, the exact after-text at :217; pinned by 2 tests | **PASS** |
| 19 | W57 · the nine named screencaps exist | all nine present in `assets/` | **PASS** |
| 20 | W57 · the assets named in its section 13 exist | `57_gate_final.log` and `57_live_tests_verbose.txt` **absent** | **FAIL** |
| 21 | W57 · its document records the gate and mutation results | `@@GATE_SUMMARY@@`, `@@GATE_BODY@@`, `@@MUT_SUMMARY@@`, `@@GENERATED@@` unfilled; run-2 numbers readable from the log only (27/27, tree identical) | **FAIL** (documentation) / **PASS** for the mutation fact itself |
| 22 | both · no credential, token, cookie value or pairing code in their documents or assets | 0 password / 0 code / 0 credential-prefix / 0 bearer / 0 cookie name over 75 files; positive control 15 name-hits (F) | **PASS** |
| 23 | W57 · device security left as the user set it (D125) | `status` line-by-line equal to D125 for all three emulators (G.1) | **PASS** |
| 24 | both · nothing of them left listening | no listener on 4421-4423, 5176-5178, 8081-8086 (also 4400, 4420, 5173-5175 free); PostgreSQL on 4432 is the standing instance (G.2) | **PASS** |
| 25 | both · lane leftovers | 4 empty `.locks/core-server.lane*.pid` files (+3 empty lane locks, 2 lane-3 logs) (G.3) | **PASS** (as both rows disclosed) |
| 26 | W57 · DN-6 factual state: lane 2 keeps the pairing | `paired_devices 1`, `device_credentials 1`, `pairing_codes 1`, `audit_log 95` (G.4) | **PASS** |

---

## I. What the controller still must rule (not ruled here)

1. **W54 decisions 1, 2, 3** — what yields to the never-hidden indicator in the top bar (the date below
   1520 px / 1664 px Live), the clock below 432/496 px, and the `danger` tone of `LIVE · RECONNECTING`.
   The measured layout figures are in `54_web_shell_admin_routes.md` §10 and `54_lane_measure_*.log`.
2. **W54 decision 9 / F76-4 with D128 point 4** — which copy of the confirmed mode change survives.
   Section E gives both locations, their mount points, and the fact that **four test files pin one shared
   set of test IDs** (three of W54, one of W55), so whichever copy is retired, its tests move with it.
3. **W54 decision 12 is closed by evidence**: F76-1 is green on the tree (section D); D128 ruling 1 landed.
   The remaining question is whether the row may now be counted complete on that basis.
4. **W54 M15** — decide whether to accept `.cache/w54/mut/` as the record and close the four survivors
   (G05, W11, N39, N40 — descriptions in B.5), or to order a bounded re-run of the mutation harness before
   the row is gated. Its assets and gate blocks are missing either way (claim 12, 13).
5. **W57 DN-1** — the landscape→portrait turn clips the connection pane to 144 dp (F-1, predecessor's
   defect, present in Simulated mode at `acaff20`): accept as KI-01's recorded state, or grant the
   one-line fix plus a repeat of the tablet session.
6. **W57 DN-2, DN-3, DN-4, DN-5** — no Core address in the identity list (DV-1), service name printed
   without the `dems-` prefix (DV-2, keeps W51's test green), the 429 limit wording (DV-3), the three
   notice titles (DV-4).
7. **W57 DN-6** — the tablet stays paired with `dems_lane_2` as `DEV-0001`; G.4 shows that state intact.
   Needs the "do not drop `paired_devices` / `device_credentials`" sentence into the later briefs.
8. **W57 DN-7, DN-8** — the W60 seams (report §9) into W60's brief; the typed-client time-out that no fake
   clock can drive (F-4) — accept, or pass `timers` to `createCoreClient`.
9. **Ledger corrections (L-4)** — W54's new web tests are **84** in 3 files and W57's are **51** in 4 files;
   neither number appears in the rows' documents (claims 4, 16). The ledger should take these measured
   values, and the missing assets (claim 12, 20) should be either restored from `.cache/` or written off.
10. **Attribution note for W59 (not this pair's problem)** — `@dems/mobile` typecheck and lint are red on
    the current tree solely in `apps/mobile/src/features/login/**` (`live-login.test.tsx` born 10:14 today,
    `use-login-controller.ts:154`, `:157`). The mobile **suite** is green (90/1,187) because jest does not
    typecheck. Whoever gates W57 must not read these two reds as W57's; whoever gates W59 must clear them.

---

*Generated: 2026-10-05 10:24 WIB*
*Last Updated: 2026-10-05 10:24 WIB*
*Verifier: `verifier-local`, request D135. Read-only throughout; nothing in the tree was modified.*
