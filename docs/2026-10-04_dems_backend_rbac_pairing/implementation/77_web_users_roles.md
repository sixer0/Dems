---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: W77 (plan step 99)
agent: coder-execution
date: 2026-10-06
status: needs-review
source_plan: docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md (row `| W77 |`, line 751)
tier: 2
---

# 77. Web Users & Roles (plan row W77, step 99)

The Users & Roles page, `/admin/users` [CS:§10.2], replaces the Live body of W54's stub. Live mode reads
operations 11 (`listUsers`) and 10 (`getRoleMatrix`) into TanStack Query under `CORE_QUERY_KEYS`; the three
commands (12 `assignUserRole`, 14 `disableUser`, 13 `enableUser`) go through `useWebLive()?.client.call(…)` on
`usePendingControl()`, every failure through the presenter first. Simulated mode keeps W54's shared "Live mode
only" state, now centred in the page's own grid (F76-12).

## 1. Result

| Check | Result | Evidence |
|---|---|---|
| The row's own tests (AC-C-86 to AC-C-91, PG-6a, StrictMode, LB-1, CLG (b), CLG (c)) | **3 files / 50 tests, exit 0** | §5.1 |
| Typecheck and lint of `@dems/core-web` | **exit 0 / exit 0** (oxlint: 0 warnings, 0 errors on 464 files) | §5.3 |
| `@dems/shared` tests, typecheck, lint | **68 files / 1,814 tests exit 0; exit 0; exit 0** | §5.3 |
| Whole `@dems/core-web` suite | **exit 1: 91 files / 1,203 tests, 3 files / 19 tests red** (above the ledger of 78 / 1,012) | §5.2 |
| CLG (a) existing tests pass, none changed | **NOT MET**: two existing test files pin facts that this row cannot keep without editing files closed to it (F77-1, F77-2); no existing test file was changed | §5.2, §7 |
| CLG (d) one live role change on lane 3 | **done**: OPR-003 TECHNICIAN to INVESTIGATOR and back through the UI, both 200, the Core's own list shows TECHNICIAN again; screenshots | §6 |
| Mutation check (M15, in memory) | **25 / 25 detected** (one survivor, C07, closed by a new test) | §5.4 |

Status **needs-review** because of CLG (a) only. Both causes are outside this row's write paths, both are also
caused by the parallel rows W75, W76 and W81, and both have a measured one-place fix (PROBE2, PROBE3 in §5.4).

## 2. What was built (file:line)

All paths under `apps/core-web/src/features/users-roles/` unless named.

| File | What | Why |
|---|---|---|
| `index.tsx:51-73` | `UsersRolesPage`: Simulated branch = `PageHeader` + `LiveOnlyState` (`ur-live-only`) inside `.ur-state-wrap` (`:61`); Live branch = `UsersRolesLive` | W54 §21.1: keep the export name and root `page-users-roles`, replace the Live body; rule 7 / F76-12: the card does not centre itself |
| `index.tsx:82-147` | `UsersRolesLive`: both queries, the self ID from the session (`:85`, `useLiveSelector`), the Forbidden state on a 403 read (`:94-113`, `ur-forbidden` with a Dashboard link), the two panels in `.ur-grid` (`:120`), the three dialogs keyed per opening (`:133`) | §10.1 states table; §10.2 regions |
| `index.tsx:120` | The panel wrapper carries the **compatibility test ID `ur-stub`** | `test/live-shell-admin.test.tsx:385` (W54's) finds `ur-stub` inside the page in Live mode and no existing test may change (DV-1) |
| `index.tsx:150-162` | Summary chip `ur-summary` "n users · m enabled", numbers by `AnimatedNumber`, an `sr-only` sentence | §10.2 Header |
| `queries.ts:62-107` | `useUsersQuery` (`CORE_QUERY_KEYS.users`), `useRoleMatrixQuery` (`CORE_QUERY_KEYS.roleMatrix`); enabled only in Live mode with `USER_ADMIN` and the link ONLINE (`:62-67`); presenter first, a record only for what it leaves (`:80-82`, `:100-102`); `AdminReadError` keeps status and code, never text (`:41-52`) | PG-6, rule 2, rule 3, rule 6; W0 §15 (reads in `useQuery`, one fetch under StrictMode) |
| `commands.ts:93-104` | `sendAdminCommand`: the three operations; reason trimmed, bounded to `ADMIN_REASON_MAX_LENGTH`, left out when empty (`:87-90`) | F59 (the client keeps the bound, the server's 422 judges) |
| `commands.ts:106-115` | `applyUserToCache`: replaces the row only in an entry that EXISTS (`:108`) | PG-6a: a self-demotion or self-disable makes the bridge remove the cache; `session.updated` / `session.ended` can precede the HTTP 200 (`implementation/33_user_role_admin.md` §9). Proven by test "PG-6a … self-disable" and mutation C04 |
| `commands.ts:125-183` | `useAdminCommand`: `control.run((release) => settle(() => …, { ok, fail, done: release }))`; 200 → row, refetch, toast; presenter first, a 403 closes the dialog (`:151`), any other notice keeps it; 409 `LAST_ADMIN` → inline (`:156`); 400/422 → inline (`:160`); 404 → toast, refetch, close, record (`:165-171`); anything else → toast + record | §10.2 dialog rows; PG-11; AC-C-48; LB-6; LB-10 |
| `model.ts:24-120` | Shape guards `usersOf` / `matrixOf`; `summaryOf`; `roleTone` (the Login list's tones, `features/login/auth-card.tsx:538-542`); `permissionsOfRole`, `roleDiff` by the STORED matrix; `administratorsOf`, `isLastAdministrator`, `blockedRolesFor` (the hint; nothing blocked without the matrix); `changedRowIds` | §10.2; [SP:RB-8] (a hint only), [SP:RB-9] |
| `users-panel.tsx:45-150` | Panel "Operators" (hero): Loading (`ur-loading`, 3 skeleton rows), Empty (`ur-empty`), Error (`ur-error` / `ur-retry` on `useRetryCooldown`), the kit `Table` with every §10.2 test ID; the row menu disabled while the link is down (`:162`), "Disable user…" disabled by the hint (`:168`) | §10.1, §10.2; Offline state |
| `users-panel.tsx:192-235` | Role chip cross-fade (M-C-10); status chip with one halo on Disabled only (the pattern of `features/devices/status-chip.tsx`) | PG-9 |
| `users-panel.tsx:258-279` | `useRowHighlights`: new or changed rows get `data-highlight` for `HIGHLIGHT_FADE_MS`; the effect starts no Core call; the fade has its own timer | §10.2 "Live update"; W0 §15 static guard |
| `matrix-panel.tsx:24-89` | Panel "Roles and permissions": the server's roles and permissions in its order, `ur-grant-<ROLE>-<PERMISSION>` with `data-granted`, "Read-only" chip; its own states `ur-matrix-loading`, `ur-matrix-error`, `ur-matrix-retry` | §10.2; §10.1 suffix rule |
| `role-dialog.tsx:36-199` | Kit `Modal` (`md`): target, own-row warning (`ur-role-own`), `RadioGroup` with the blocked options and the hint sentence, "Gains"/"Loses", optional reason, inline `ur-role-error`; confirm disabled until another role is chosen (`:175`); `ref={ref}` busy mark; not dismissable while busy (`:45`) | AC-C-87, AC-C-88; LB-1; W0 §15 |
| `status-dialogs.tsx:25-160` | `DisableDialog` (kit `AlertDialog` danger, own-row "You will be signed out.", reason, inline 409) and `EnableDialog` (neutral, no reason) | AC-C-89 |
| `panel.tsx`, `choreography.ts` | Feature-local `Panel` with its own error boundary (fallback with the cooled-down retry; one record with a fixed sentence) and the enter beats (users 0 ms hero, matrix 120 ms) | PG-7, PG-9 |
| `report.ts:10-15` | `createPageReporter('usr')` bound once | W0 §15 |
| `users-roles.css` | Feature-scoped `ur-*` classes; the "Live mode only" grid; the gold highlight keyframe | PG-8 |
| `packages/shared/src/i18n/en/users-roles.ts` | Additive: `summary`, `users.*`, `actions.*`, `roleDialog.*`, `disableDialog.*`, `enableDialog.*`, `lastAdmin`, `matrix.*`, `toasts.*`, `states.*`; W54's three keys unchanged | PG-10; rule 8 |
| `__tests__/users-roles-bed.tsx` | Test bed on W50's harness; scripts `getRoleMatrix` (the harness does not) | tests only |
| `src/test/live-users-roles-page.test.tsx` | AC-C-86, AC-C-90, AC-C-91, PG-6a, StrictMode (19 tests) | CLG (b) |
| `src/test/live-users-roles-commands.test.tsx` | AC-C-87, AC-C-88, AC-C-89 per command: success, 403 `notPermitted`, 409, outage, 429, 422, 404; LB-1; PG-6a race (19 tests) | CLG (b) |
| `src/test/live-users-roles-model.test.tsx` | The model; `applyUserToCache`; the folder's static rules (CLG (c), rules 1 and 3, W0 §15) (12 tests) | CLG (c) |

Nothing outside the row's write paths was edited. The route file, `ROUTE_PERMISSIONS` and the guard were already
W54's (`routes/_app/admin/users.tsx:12-15`, `components/shell/route-permissions.ts:14-18`) and need no change.

## 3. Contract gaps found

| ID | Gap | Where | What the page does |
|---|---|---|---|
| CONTRACT-GAP-W77-1 | §10.2 "Live update" expects "a sign-in elsewhere (active sessions, last sign-in)" to appear without a reload; the Core publishes no `admin.changed` for a sign-in, a sign-out or an expiry | `apps/core-server/src/modules/identity/sign-in.ts:241`, `apps/core-server/src/modules/identity/sessions.ts:191`, `:310` publish `session.ended` only; `admin.changed USERS` only at `apps/core-server/src/modules/admin/changes.ts:138, :172, :196` and `modules/demo/reset.ts:380`; decision D78 DN-16; D91 routed it to this row | Nothing invented: those two columns are as of the last read. They are read again on any `admin.changed USERS` (a role change, enable or disable by anyone; DR-12), after the page's own command, after a socket resync and, by TanStack Query's default `refetchOnWindowFocus` (`main.tsx:36`, `new QueryClient()` with no options), when the tab regains focus — the last one is the library default and **was not tested here** |

No other gap: the five operations, their examples (`seeded`, `notPermitted`, `lastAdmin`, `notFound`,
`invalidInput`) and `ADMIN_REASON_MAX_LENGTH` are in `@dems/shared/api` (`administration.ts`).

## 4. Requirement to test

| Criterion | Test (file › describe › it) |
|---|---|
| AC-C-86 test IDs, three operators, twelve matrix rows from the fake transport | page › "AC-C-86" › "three operators, twelve matrix rows, the summary, the own row and the row menus" (also: one GET each of `/api/v1/admin/users` and `/api/v1/rbac/matrix`; the cache holds the operations' own answers under `CORE_QUERY_KEYS`; 18 grants) |
| AC-C-87 role change | commands › "AC-C-87" (6 tests: preselected role, confirm disabled while unchanged, Gains/Loses; 200 with body `{ role, reason }` trimmed, dialog closes, toast, row, refetch; empty reason left out; 403; outage with a second press that succeeds; 429; 422; 404 with record) |
| AC-C-88 409 `LAST_ADMIN` inline, nothing changed; the hint | commands › "AC-C-88" (hint: blocked options with the sentence, own-row warning; 409: inline Alert, dialog open, same cache object, no refetch, no toast) |
| AC-C-89 disable / enable, chip morph, own account warns first | commands › "AC-C-89" (disable 200 / own warning before any request / 409 / 403 / outage; enable 200 without a body / 403 / outage) |
| AC-C-90 `admin.changed USERS` refetches without a reload | page › "AC-C-90" (role change elsewhere + highlight; a disable elsewhere; one socket, no new sign-in; DEVICES and PAIRING_CODE do not read the list) |
| AC-C-91 the five states; nav entry absent in Simulated mode | page › "AC-C-91" (Loading, Empty, Error + Retry + cooldown, 429, matrix error, Forbidden, Offline, "Live mode only" with no nav group) |
| PG-6a / SD-20 queries removed on sign-out and on loss of `USER_ADMIN` | page › "PG-6a / SD-20" (sign-out; loss of USER_ADMIN, both entries gone BEFORE the redirect; another operator; resync reads both) and commands › "PG-6a" (a 200 after `session.ended` creates nothing) |
| AC-C-48 the denied toast, 403 by its `notPermitted` example | every command block and page › Forbidden |
| W0 §15 effect starts, StrictMode | page › "StrictMode" (one read each); the folder starts nothing from an effect (W0's static guard reads it; `live-strict-mode-starts.test.tsx` green) |
| LB-1 busy mark | commands › "LB-1" (`aria-busy` on the pressed confirm at once, `data-pending` only after the reveal, one request for two presses) |
| CLG (c) | model › "the folder's production files" |

## 5. Verification (commands from the repository root)

### 5.1 The row's tests

```
$ npm run test -w @dems/core-web -- --maxWorkers=2 src/test/live-users-roles-commands.test.tsx src/test/live-users-roles-page.test.tsx
 Test Files  2 passed (2)
      Tests  38 passed (38)
$ npm run test -w @dems/core-web -- --maxWorkers=2 src/test/live-users-roles-model.test.tsx
 Test Files  1 passed (1)
      Tests  12 passed (12)
```
(The commands file grew to 19 tests after C07; its re-run: `Test Files 1 passed (1) / Tests 19 passed (19)`.) In
the whole-suite runs below all three files are green.

### 5.2 Whole web suite (P11: two runs; `assets/77_gate_web_run1.log`, `assets/77_gate_web_run2.log`)

```
## run 1, 2026-10-06 01:37:19 WIB  load averages: 5.81 4.61 4.72
 ❯ src/test/live-pending-control.test.tsx (20 tests | 1 failed)
 ❯ src/test/live-shell-admin.test.tsx (40 tests | 17 failed)
 ❯ src/test/live-devices-drawer.test.tsx (13 tests | 1 failed)
 Test Files  3 failed | 86 passed (89)
      Tests  19 failed | 1158 passed (1177)
exit=1
## run 2, 2026-10-06 01:43:42 WIB  load averages: 5.45 5.49 5.25
 Test Files  3 failed | 88 passed (91)
      Tests  19 failed | 1184 passed (1203)
exit=1
FakeTransportUnscriptedError: … GET /api/v1/pairing/code (getPairingCodeStatus) [NO_ANSWER_SCRIPTED]   (x2)
FakeTransportUnscriptedError: … GET /api/v1/rbac/matrix (getRoleMatrix) [NO_ANSWER_SCRIPTED]          (x2)
AssertionError: expected [ Array(22) ] to deeply equal [ 'dashboard/devices-panel.tsx', …(9) ]
```

| Red file | Owner of the file | Cause | Share of this row |
|---|---|---|---|
| `src/test/live-shell-admin.test.tsx` (17) | W54 | W50's harness answers no `getRoleMatrix` (this page, W75's Security & Audit) and no `getPairingCodeStatus` (W81) | **9 of 17**: with W54's stub body put back in memory (BASELINE-STUB) the file has 8 red, all W75/W81 and their cascades (F77-1). With the three reads answered in memory (PROBE2) the file is **40 / 40 green** with this row's page and the file unchanged |
| `src/test/live-pending-control.test.tsx` (1) | W0 | Line 421 pins the EXACT list of `usePendingControl()` callers; W0 §15 obliges every page row to call it; the list now also holds W75, W76, W81 and this row's `role-dialog.tsx`, `status-dialogs.tsx` | yes, with W75/W76/W81 (F77-2). With the list made a floor in memory (PROBE3): **20 / 20 green** |
| `src/test/live-devices-drawer.test.tsx` (1) | W70 | "the link opens the Paired Devices page": `getPairingCodeStatus` unscripted (W81's page) | none |

Protected files unchanged: `git hash-object` gives `71f6f033…` (storage) and `1ab07579…` (dashboard), W0's
records; `git diff --stat` over `test/routes.test.tsx`, `test/sim-fetch.test.ts`, `lib/__tests__/core-endpoint.test.tsx`,
`lib/__tests__/packaged-csp.test.ts`, `test/live-shell-admin.test.tsx`, `test/live-pending-control.test.tsx` is empty.

### 5.3 Typecheck, lint, shared (`assets/77_gate_tc_lint_shared.log`)

```
## 01:41:13 $ npm run typecheck -w @dems/core-web
exit=0
## 01:41:30 $ npm run lint -w @dems/core-web
exit=0
$ npx oxlint --format=default        (apps/core-web)
Found 0 warnings and 0 errors.
Finished in 56ms on 464 files with 116 rules using 10 threads.
## 01:42:13 $ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  68 passed (68)
      Tests  1814 passed (1814)
exit=0
## 01:42:21 $ npm run typecheck -w @dems/shared
exit=0
## 01:42:25 $ npm run lint -w @dems/shared
exit=0
```
(At 01:14 the web typecheck was red only in `src/features/paired-devices/live-data.ts:38-39`, W81's file in progress;
it was green at 01:41.)

CLG (c), the plain greps over the folder's production files (the static test strips strings and comments):
```
$ grep -rn "useSimActions" apps/core-web/src/features/users-roles --exclude-dir=__tests__
exit=1 (1 = no match)
$ grep -rnoE "\.actions\.[a-zA-Z]+" … | sort | uniq -c   → only translation keys:
   3 .actions.cancel  2 .actions.changeRole  2 .actions.disable  2 .actions.enable  1 .actions.menu
   1 .actions.menuLabel  2 .actions.retry  2 .actions.retryIn   (plus `usersRoles.users.columns.actions`)
```

### 5.4 Mutation check (M15: in memory; `assets/77_mutations.log`, runner `assets/77_mutation_runner.py.txt`, config `assets/77_mutation_config.mts.txt`)

W0's method: one text replacement in one module, applied by a Vite transform plugin; a marker under `$TMPDIR`
proves it ran; SHA-256 of every mutated file before and after each batch ("identical" every time).

```
## 2026-10-06 01:28:38 WIB 13 entries: 12 detected, 1 survived ['C07'], others []
## 2026-10-06 01:29:18 WIB 1 entries: 1 detected, 0 survived []        (C07 after the new test)
## 2026-10-06 01:32:04 WIB 12 entries: 12 detected, 0 survived []
```

| Class | Mutants | Detected |
|---|---|--:|
| Commands: presenter skipped, 403 keeps the dialog, 409 not recognised, PG-6a re-creation, no refetch, reason untrimmed, control never released, 404 keeps the dialog | C01-C08 | 8 / 8 |
| Model: hint off, disabled holder counted, Gains/Loses swapped, no highlight, foreign array taken as rows | M01-M05 | 5 / 5 |
| Queries: 403 not Forbidden, key outside `CORE_QUERY_KEYS`, presenter skipped | Q01-Q03 | 3 / 3 |
| Panel / dialogs / page: "You" everywhere, menu enabled offline, hint not disabling "Disable", confirm enabled unchanged, busy mark not attached, own warnings missing (role, disable), enable sends disable, live-only not wrapped | U01-U03, R01-R03, S01-S02, I01 | 9 / 9 |
| **Total** | | **25 / 25** |

C07 first SURVIVED (each opening gets a fresh control, so a never-released control was invisible); the outage test
now presses again and expects the second request to be sent and to succeed; C07 re-run: detected.

Probes (not mutations; expected green): PROBE2 = F77-1's harness lines in memory → `live-shell-admin.test.tsx`
`Tests 40 passed (40)`; PROBE3 = F77-2's floor in memory → `live-pending-control.test.tsx` `Tests 20 passed (20)`;
BASELINE-STUB = W54's stub in memory → `Tests 8 failed | 32 passed (40)` (the other rows' share).

## 6. The lane check (lane 3; CLG (d); `assets/77_lane_run.log`, `assets/77_lane_browser.json`)

`/usr/bin/lockf -k -t 240 .locks/core-server.lane3.lock /bin/sh .cache/w77/lane/run_lane.sh` (sandbox bypass for
that one command), 01:34:54 to 01:35:31, `lockf exit=0`. Script and driver: W71's, with this row's steps
(`assets/77_lane_run_lane.sh.txt`, `assets/77_lane_cdp_driver.mjs.txt`). Headless Chrome 153.0.8010.12, 1600x1000.
The demo flag was off; the lane database was not reset; port 5432 was never named; 5173-5175, 4400, lanes 1 and 2
were not touched. Sign-in through the form from the seed constants; the driver's output check: "the output held the
seeded password before redaction: false"; a count-only scan of every `77_*` asset, the run's output and the lane
logs found the password nowhere.

```
== 01:34:54 0. … free: 4423 5178 9398
== 01:34:55 2. start the lane backend … backend up after 3 quarter seconds
== 01:34:56 3. start Vite for lane 3 … -- health through the dev server: 200
cdp-driver exit 0
-- the backend's log: lines 51; lines with level error or fatal: 0
   8 "route":"/api/v1/admin/users","status":200
   2 "route":"/api/v1/admin/users/:id/role","status":200
== 01:35:31 listeners left on 4423, 5178, 9398 (expect none):
lsof exit 1 (1 with no output: no listener)
lockf exit=0
```

| Step | Observed | Screenshot |
|---|---|---|
| Live, the seeded SUPERVISOR (OPR-002), `/admin/users` | `LIVE`; summary "3 users, 3 enabled"; rows OPR-001 INVESTIGATOR, OPR-002 SUPERVISOR ("You"), OPR-003 TECHNICIAN, all enabled; matrix 12 rows, 18 grants, "Read-only"; requests: one `GET /admin/users`, one `GET /rbac/matrix` from the page (StrictMode in the dev build sent each once); no console error | `77_users_roles_live.png` |
| The hint for the only administrator | Own dialog: INVESTIGATOR and TECHNICIAN blocked and disabled with "At least one enabled user must keep user administration.", own-row warning, confirm disabled; cancelled | `77_last_admin_hint_live.png` |
| **The role change**: OPR-003 TECHNICIAN → INVESTIGATOR through the row menu and the dialog | Gains "Start sessions, Add notes and markers", Loses "Manage devices, Maintenance and updates"; `POST /admin/users/OPR-003/role` 200; toast "Role of Rina Wijaya is now Investigator"; the row reads Investigator and is highlighted; the page read the list again (own refetch + `admin.changed`); the Core's list: OPR-003 INVESTIGATOR | `77_role_changed_live_dialog.png`, `77_role_changed_live.png` |
| **Set back**: OPR-003 → TECHNICIAN through the UI | 200; toast "… is now Technician"; the Core's own list after: OPR-001 INVESTIGATOR, OPR-002 SUPERVISOR, **OPR-003 TECHNICIAN**, all enabled (`backAtSeededRole: true`; the request fallback was not needed) | `77_role_restored_live_dialog.png`, `77_role_restored_live.png` |
| Simulated (stored choice; the simulator's stored sign-in, F63-3) | `SIMULATED`; `ur-live-only` inside `.ur-state-wrap`, the "Switch to Live mode" button; no ADMINISTRATION group; **0 requests to `/api/v1`, 0 sockets to the dev server's `/ws`** | `77_users_roles_simulated.png` |

**409 `LAST_ADMIN` live: not shown, on purpose.** The UI closes that path for the only administrator by design (the
hint, shown above). Reaching the 409 needs a direct request that tries to demote or disable the only enabled
SUPERVISOR; if the server answered it wrongly, lane 3 would be left without any administrator, and putting one back
would need a demo reset or a database write, both closed to this row. The 409 is proven by AC-C-88's render test
and by the server's own proof (W33 §7: 77 concurrent rounds, single-request cases in §6).

## 7. Findings

| ID | Finding | Evidence | For |
|---|---|---|---|
| **F77-1** | W50's harness (`runtime/testing/live-harness.ts:368`) answers `listUsers` for the administration pages but not `getRoleMatrix` (this page and W75's Security & Audit page in Live mode) nor W81's `listPairedDevices` / `getPairingCodeStatus`. Any existing test that renders those pages in Live mode on the harness without scripting them records a `FakeTransportUnscriptedError` and fails at `dispose()`: W54's `live-shell-admin.test.tsx` (17 red, 9 of them this row's) and W70's `live-devices-drawer.test.tsx` (W81's) | §5.2; BASELINE-STUB; PROBE2 (40/40 green) | controller / W50's owner. W50's comment (`live-harness.ts:367`) leaves every other read to "a page row scripts its own", which cannot reach W54's and W70's existing tests that render these pages. Add next to line 368: `answered('getRoleMatrix', () => (core.alive() ? fake.example('getRoleMatrix', 200, 'seeded') : fake.example('getRoleMatrix', 401, 'notSignedIn')))` and the same for `listPairedDevices` and `getPairingCodeStatus` (W81's call) |
| **F77-2** | W0's `live-pending-control.test.tsx:421-432` pins the EXACT list of `usePendingControl()` callers, while W0 §15 (binding) orders every page row to call it: every page row that obeys goes red there (now W75, W76, W81 and this row) | §5.2 run 1 diff; PROBE3 (20/20 green) | controller / W0's owner: make the list a floor (`expect(callers).toEqual(expect.arrayContaining([...]))`) or add the new callers; line 433's import rule then still holds for every caller, which is the real rule |
| F77-3 | The Core answers a self-demotion and a self-disable before or after `session.updated` / `session.ended` arrive on the socket, so an answer's cache write could re-create an entry the bridge removed; guarded (`commands.ts:108`) and tested | test "PG-6a … self-disable"; mutation C04 | W81 (same shape for a pairing code), reviewers |
| F77-4 | A 403 `deviceRevoked` on a web read makes the Live source sign the console out (the page is left before a test can find it), so for this page's reads every contractual failure is worded by the presenter; the page's own record branch is reachable through the commands (404) | page test run at 01:19 (the removed case) | — |
| F77-5 | `ROLE_PERMISSIONS` of the simulator equals the Core's seeded matrix role by role (asserted: model › "the stored matrix gives each role its permissions…") | model test | W75 (its twelve-row matrix) |
| F77-6 | `admin.changed USERS` arrives together with the page's own refetch after its own command, so a 200 reads the list twice (own `invalidateQueries`, then the bridge's); harmless, visible in the lane log (8 list reads in all, 3 of them the driver's) | `77_lane_browser.json` network | — |

## 8. Deviations

| ID | Deviation | Why |
|---|---|---|
| DV-1 | The panel wrapper keeps the test ID `ur-stub` (`index.tsx:120`) though the stub is gone | W54's existing test `live-shell-admin.test.tsx:385` asserts it in Live mode; CLG (a) forbids changing it. Retire it with a by-design change of that line (D126's precedent) when the controller rules |
| DV-2 | The list's error, loading and empty IDs are `ur-error` / `ur-loading` / `ur-empty`; the matrix panel's are `ur-matrix-error`, `ur-matrix-loading`, `ur-matrix-retry` | §10.2 lists one set of state IDs while §10.1 says every panel has the states; the matrix uses §10.1's suffix rule on its own prefix |
| DV-3 | Motion: the table rows are not staggered and the M-C-07 highlight is a CSS keyframe on the row, not the copied-in `animated-list` component | The kit's `Table` rows are React Aria rows, not motion elements; the highlight keeps `HIGHLIGHT_FADE_MS` and the gold of M-C-07; the role chip cross-fade and the halo follow M-C-10 |
| DV-4 | Permission labels are read from `securityAudit.rbac.permissions.*` (all twelve), not split between that and `common.rbac.permissions.*` | One key family holds all twelve; nothing is written to another namespace |
| DV-5 | The confirm buttons are not disabled while busy (only Cancel and dismissal are) | LB-1: busy at once without a visual change; a second press is refused by `usePendingControl` (test LB-1) |
| DV-6 | A process slip during the lane preparation: a `grep` for the seed constants printed the demo password's source line into this agent's own console output (not into any file, log, asset or this document) | Disclosed; every artifact was then scanned by count only (§6) |
| DV-7 | 409 `LAST_ADMIN` not shown on the lane | §6: reaching it would risk leaving lane 3 without an administrator |

## 9. Decisions for the controller

| # | Decision | Default proposed |
|---|---|---|
| 1 | F77-1: add the three reads to W50's harness model Core (one line each, next to `listUsers`) | Yes; it turns W54's file green with this page (PROBE2) and also clears W75's and W81's share |
| 2 | F77-2: make W0's caller list a floor | Yes (PROBE3) |
| 3 | DV-1: retire `ur-stub` later with a by-design change of `live-shell-admin.test.tsx:385`, or keep it | Keep until W54's file is next touched by a ruling |
| 4 | CONTRACT-GAP-W77-1: accept "as of the last read" for active sessions and last sign-in, or ask the Core to publish `admin.changed USERS` on sign-in / sign-out / expiry | Accept (D78 DN-16 stands); the focus refetch covers the common case |
| 5 | Record DV-6 | — |

## 10. State left in `dems_lane_3`

| Item | Before | After |
|---|---|---|
| `audit_log` | 142 (head seq 142) | 146 (head seq 146): one sign-in, two `ROLE_CHANGED`, one sign-out |
| `auth_sessions` | 19 | 20 (this check's one sign-in, signed out) |
| `events` | 108 | 110 |
| Roles | OPR-001 INVESTIGATOR, OPR-002 SUPERVISOR, OPR-003 TECHNICIAN, all enabled | **the same** (the Core's own list read after the set-back) |
| OPR-003 `roleChangedAt` | null ("Not changed" on the page) | 2026-10-06 01:35 WIB: a role change and its reversal leave the date set; no other column of the operator changed |
| Nobody was disabled; the demo flag was off; no reset; nothing else ran on the lane in this row | | |

`assets/77_lane_db_status_before.txt`, `assets/77_lane_db_status_after.txt`.

## 11. Rollback (not executed)

1. `cp -p .cache/rollback/W77/apps/core-web/src/features/users-roles/index.tsx apps/core-web/src/features/users-roles/index.tsx`
   and `cp -p .cache/rollback/W77/packages/shared/src/i18n/en/users-roles.ts packages/shared/src/i18n/en/users-roles.ts`
   (SHA-256 in `.cache/rollback/W77/SHA256SUMS`; both equal their committed versions at `b90a3c6`).
2. Delete the row's new files: `features/users-roles/{model.ts, queries.ts, commands.ts, report.ts, panel.tsx,
   choreography.ts, users-panel.tsx, matrix-panel.tsx, role-dialog.tsx, status-dialogs.tsx, users-roles.css}`,
   `features/users-roles/__tests__/users-roles-bed.tsx`, `src/test/live-users-roles-{page,commands,model}.test.tsx`.
3. Lane 3: nothing to undo (roles as found).
4. Re-run the web suite, typecheck and lint.

## 12. Files

Created: `apps/core-web/src/features/users-roles/{model.ts, queries.ts, commands.ts, report.ts, panel.tsx,
choreography.ts, users-panel.tsx, matrix-panel.tsx, role-dialog.tsx, status-dialogs.tsx, users-roles.css}`,
`apps/core-web/src/features/users-roles/__tests__/users-roles-bed.tsx`,
`apps/core-web/src/test/live-users-roles-page.test.tsx`, `apps/core-web/src/test/live-users-roles-commands.test.tsx`,
`apps/core-web/src/test/live-users-roles-model.test.tsx`; this document; `delegation_progress/coder_execution_step_99.md`;
assets `77_users_roles_live.png`, `77_last_admin_hint_live.png`, `77_role_changed_live.png`,
`77_role_changed_live_dialog.png`, `77_role_restored_live.png`, `77_role_restored_live_dialog.png`,
`77_users_roles_simulated.png`, `77_lane_run.log`, `77_lane_browser.json`, `77_lane_run_lane.sh.txt`,
`77_lane_cdp_driver.mjs.txt`, `77_lane_db_status_before.txt`, `77_lane_db_status_after.txt`, `77_mutations.log`,
`77_mutation_runner.py.txt`, `77_mutation_config.mts.txt`, `77_gate_web_run1.log`, `77_gate_web_run2.log`,
`77_gate_tc_lint_shared.log`.

Updated: `apps/core-web/src/features/users-roles/index.tsx` (W54's stub → the page),
`packages/shared/src/i18n/en/users-roles.ts` (additive).

Scratch (not deliverables): `.cache/w77/**`, `.cache/rollback/W77/**`. No git write, no Docker; nothing deleted or
renamed outside this row's own new files.
