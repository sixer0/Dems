---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: coder-execution
blueprint_step: 76
plan_row: W54
source_plan: /docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
status: needs-review
tier: 2
---

# 54. Web shell, navigation, admin routes (plan row W54, blueprint step 76)

Sources, cited by short name: [CS] `masterplan/04_client_integration_spec.md` rev 2.2; [LS]
`implementation/44_live_source.md` §17.4 (the brief list); [W50] `implementation/50_web_runtime_mode.md`.
All paths are relative to `/Users/gsp-budi/Documents/DEMS`. Times are WIB on 2026-10-04. No
credential, token, cookie value or password appears in this file or in its assets; the seeded demo
password is named by its constant only (`DEMO_OPERATOR_PASSWORD`). Operators are named by ID and role.

## 1. Result

| Item | Value |
|---|---|
| Status | **needs-review**. Everything the row names is built, tested and checked on the lane. One test of ANOTHER row is red in the web suite since 21:00 and is not this row's to edit (finding F76-1); the web suite therefore does not exit 0. Three choices of this row change what Simulated mode shows and need the controller's ruling (section 20, decisions 1, 2, 11) |
| What was built | The mode indicator of the top bar (three states and a fourth for a resynchronising socket; every width); the shell's mode switch (step 1 of §3.3); the link notice; the role notice; the leave of a page whose permission was taken away; the ADMINISTRATION group; the two administration routes with one guard and two page stubs; the "Live mode only" state; two i18n namespaces and the shell's new words; the granted Stack Check line |
| Simulated mode | The 39 test files that exist at `acaff20` are untouched by this row and pass (438 tests). What an operator SEES changes in three places, all stated in section 10: the chip `SIMULATED` in the top bar (the row's subject), the date of the top bar below 1520 px, and the clock below 432 px |
| Web tests | `npm run test -w @dems/core-web -- --maxWorkers=2`: **exit 0, 55 files / 759 tests** (fresh run 2026-10-05 11:34:21, 59.07 s, `assets/54_gate_web_test.log`; the run of 2026-10-04 was closed by the session break and never written here — section 16.2) |
| New tests of this row | 3 files, **84 tests**: `src/test/live-shell-{indicator,notices,admin}.test.tsx` (fresh run of the three alone 2026-10-05 11:35:32, exit 0, 9.52 s, `assets/54_gate_shell3_test.log`; included in the 55 / 759 above) |
| Shared tests | `npm run test -w @dems/shared -- --maxWorkers=2`: exit 0, **68 files / 1,814 tests** (fresh run 2026-10-05 11:35:48, 9.82 s, `assets/54_gate_shared_test.log`). One existing test file changed by the grant of decision D126 (section 13) |
| Typecheck, lint | `@dems/core-web` typecheck and lint exit 0 (no warning); `@dems/shared` typecheck and lint exit 0; `@dems/mobile` typecheck exit 0 |
| Lane check (lane 3: backend 4423, `dems_lane_3`, Vite 5178) | Five runs inside the lane lock between 21:10 and 21:28, 4 min 51 s in all, each `lockf` exit 0: a first full pass, a measurement of the top bar, a layout pass, **the final full pass on the finished code (21:24:40 to 21:26:41)**, and a measurement at phone widths. In a real browser (HeadlessChrome/153.0.8010.12): the indicator `LIVE` at 1440, 900, 600 and 390 px; the ADMINISTRATION group for the seeded SUPERVISOR and its absence for the seeded INVESTIGATOR; the guard; a role change made by the real server while signed in (both directions); the link notice with the backend stopped and "Reconnected to the Core" after its restart; the same shell in Simulated mode. 23 screenshots. Everything started was stopped; 4423, 5178 and 9398 are free (section 14) |
| Mutation check (M15) | **Complete on this tree: 137 mutations in 18 modules → 133 detected, 4 survived, 0 not applied** (fresh full pass 2026-10-05 12:02:41→12:46:26, `assets/54_mut_full_run.log`; the static check passes too — every find-text occurs exactly once). The four survivors (`W11`, `N39`, `N40`, `G05`) are each closed as an **equivalent mutant proved by measurement**, not by argument: section 17.4, `assets/54_mut_probe_evidence.log`. History: the 2026-10-04 record reached only 57 then 59 entries (55 detected; T02/G05, then W11/N36/N39/N40 survived), its re-tests killed T02 and N36 (2/2) and nine indicator/switch mutations (9/9), and it lived only in git-ignored `.cache/w54/mut/` — now copied to `assets/54_mutation_record.txt` |
| CA-03 | **Holds** on TanStack Router 1.170.40: `router.invalidate()` runs `beforeLoad` of the matched routes again and follows the redirect a guard throws. The fallback of RC-1 (the shell navigates itself) is not built |
| New dependency | None |
| Gaps | No `CONTRACT-GAP`, no `SIM-GAP`, no `BE-GAP` |

## 2. What was written

All inside the row's write paths, plus the two grants (the Stack Check line, D121; the pinned list of
`packages/shared/test/i18n.test.ts`, D126).

| File | New / changed | What it holds |
|---|---|---|
| `apps/core-web/src/components/shell/mode-indicator.tsx` | new | `ModeIndicator`: the chip in a tooltip; a kit `Button` where the build offers the mode switch |
| `apps/core-web/src/components/shell/mode-indicator-state.ts` | new | `modeIndicatorState`, `isLinkLost`, `isLinkUp` (pure) |
| `apps/core-web/src/components/shell/mode-switch.tsx` | new | `useModeSwitch()`: the confirmation dialog of §3.3 step 1, then the runtime's `switchTo` |
| `apps/core-web/src/components/shell/live-notices.tsx` | new | `LiveNotices`: the link notice (§3.5) and the reaction to a changed session (§6.3, RC-1) |
| `apps/core-web/src/components/shell/route-permissions.ts` | new | `ROUTE_PERMISSIONS` (three entries), `routePermission(pathname)` |
| `apps/core-web/src/components/shell/use-visible-nav-items.ts` | new | `useVisibleNavItems(items)`: PG-4 |
| `apps/core-web/src/components/shell/live-only-state.tsx` | new | `LiveOnlyState`: the "Live mode only" state of §10.1 |
| `apps/core-web/src/components/shell/shell-report.ts` | new | `reportShellError`: a shell error to the page's own log |
| `apps/core-web/src/components/shell/nav-items.ts` | changed | `NavItem.permission`, `NavItem.liveOnly`, the group `admin`, two items, `ADMIN_NAV_ITEMS` |
| `apps/core-web/src/components/shell/sidebar.tsx` | changed | `AdminNavGroup`; DEVELOPER wrapped in one Motion layout node; `data-admin` on the list |
| `apps/core-web/src/components/shell/top-bar.tsx` | changed | `<ModeIndicator />` and one separator between the device block and the bell (`:76-77`) |
| `apps/core-web/src/components/shell/app-shell.tsx` | changed | `<LiveNotices />` (`:102`); `data-core-mode` (`:72`); the activity call site on `useCoreActions()` and `settle` (`:116`) |
| `apps/core-web/src/components/shell/user-menu.tsx` | changed | Lock and Sign out on `useCoreActions()` and `settle` (`:37`); the role line cross-fades |
| `apps/core-web/src/components/shell/index.ts` | changed | Exports for the page rows (section 21) |
| `apps/core-web/src/components/shell/shell.css` | changed, additive | The indicator, the navigation section, the "Live mode only" state, the link notice's second action, the four yield rules of section 10, the footer rule for the ADMINISTRATION case. 117 added lines, none removed |
| `apps/core-web/src/routes/_app/admin/users.tsx`, `devices.tsx` | new | `createFileRoute` and the guard, nothing else (PG-1) |
| `apps/core-web/src/routes/_app/admin/-guard.ts` | new | `requireCorePermission(sim, permission)` (PG-3); the `-` prefix keeps it out of the route tree |
| `apps/core-web/src/routeTree.gen.ts` | regenerated | By the router plugin itself (a Vitest start): 42 added lines, the two routes; not edited by hand |
| `apps/core-web/src/features/users-roles/index.tsx`, `features/paired-devices/index.tsx` | new | The page stubs (PG-2): `UsersRolesPage`, `PairedDevicesPage` |
| `packages/shared/src/i18n/en/users-roles.ts`, `en/paired-devices.ts` | new | The namespaces `usersRoles`, `pairedDevices` (PG-10): what the stubs need |
| `packages/shared/src/i18n/en/shell.ts` | changed, additive | `shell.mode.*`, `shell.roleNotice.*`, `shell.liveOnly.title`, `shell.nav.{adminGroup,usersRoles,pairedDevices}` (31 added lines) |
| `packages/shared/src/i18n/index.ts` | changed, additive | The two namespaces registered (8 added lines) |
| `apps/core-web/src/features/home/home-page.tsx` | changed, ONE line | The granted Stack Check line (section 11) |
| `packages/shared/test/i18n.test.ts` | changed, 3 lines | The granted change of the pinned namespace list (section 13) |
| `apps/core-web/src/test/live-shell-indicator.test.tsx`, `live-shell-notices.test.tsx`, `live-shell-admin.test.tsx` | new | The row's tests |

Not written: `apps/core-web/src/runtime/**`, `lib/**`, `main.tsx`, `router.tsx`, `routes/__root.tsx`, the three
guard files of AC-C-41, any other feature folder, `packages/shared/src/{api,live,client,realtime,sim}/**`,
`apps/core-server/**`, `apps/mock-core/**`, any package manifest. No git write of any kind.

## 3. The mode indicator ([CS] §3.2; AC-C-24; CA-09)

`components/shell/mode-indicator.tsx:25-70`, state in `mode-indicator-state.ts:21-26`. A kit
`Chip size="sm" variant="soft"` inside a kit `Tooltip`, between the device block and the bell
(`top-bar.tsx:76`), with `data-testid="shell-mode"` and `data-state`.

| Data source | Live link | `data-state` | Chip | Tone | Tooltip |
|---|---|---|---|---|---|
| The simulator | (none) | `SIMULATED` | `SIMULATED` | `warning` | "The Core is simulated in this browser. Nothing is sent to a server." |
| The Live source | ONLINE | `LIVE` | `LIVE` | `success` | "Data comes from the Core server on this computer." |
| The Live source | OFFLINE, STALE | `OFFLINE` | `LIVE · OFFLINE` | `danger` | "The Core server is unreachable. The screen shows the last state received." |
| The Live source | CONNECTING, RESYNCING | `RECONNECTING` | `LIVE · RECONNECTING` | `danger` | "The link to the Core server is being restored." |

- The mode comes from the data source in the context (`useCoreMode()`), the link from `useLiveLink()`;
  no setting is read. **Only the link moves the indicator**: a call the Core refused (a 403, a 429) does
  not change the link, so it cannot change the chip (LB-10; test "a limit is not an outage").
- The chip's own words are W50's (`common.coreMode.chip*`); the tooltips are new (`shell.mode.tooltip.*`,
  `packages/shared/src/i18n/en/shell.ts:27-39`). The accessible name is "Data mode: " and the chip's text.
- **Never hidden**: the element carries none of the `dems-hide-below-*` classes and no rule of
  `shell.css` hides it (test "never hidden"); in the browser it lay inside the window at 1440, 900,
  600 and 390 px (section 14). What yields to it is in section 10.
- MD-4: where the router context carries `coreMode.selectable === true` (the app in a dev build) the
  chip is a kit `Button` and opens the confirmation of section 4 for the OTHER mode. Without it (a
  production build, the packaged build, every test that builds its router without `coreMode`) it is a
  plain `Tooltip.Trigger` and switches nothing. So no existing test sees a new control (CA-09).

## 4. The shell's mode switch ([CS] §3.3 step 1)

`components/shell/mode-switch.tsx:29-81`, `useModeSwitch()`. One kit `AlertDialog` (the pattern of
`features/session-new/cancel-dialog.tsx`): the title `common.coreMode.switchTitle[next]`, the
specification's sentence (`switchBody`), Cancel, and the confirm button, which calls the runtime's
`coreMode.switchTo(next)` (W50: sign out of the current mode, store the choice, load the page again
at `/login`). The shell signs nobody out by itself.

| Outcome of `switchTo` | What the operator sees | Log |
|---|---|---|
| `true` | The dialog stays pending until the page is loaded again | |
| `false` (the browser could not store the choice) | The dialog closes; danger toast `common.coreMode.switchFailed` | W50's own record `runtime.modeSwitch` |
| It rejects (no path of the runtime does) | The same toast | One `error` record `shell.modeSwitch` in the page's log (`shell-report.ts`) |

Used in three places: the indicator, the link notice ("Switch to Simulated mode") and the "Live mode
only" state ("Switch to Live mode"). A second press while the switch runs sends nothing.

## 5. The link notice ([CS] §3.5; AC-C-26, AC-C-59; LB-6, LB-10)

`components/shell/live-notices.tsx:53-153`, mounted once by `AppShell` (`app-shell.tsx:102`); in
Simulated mode `LiveNotices` renders nothing and subscribes to nothing (`:33-36`).

| Event | What the operator sees | Code |
|---|---|---|
| The link is lost while signed in (OFFLINE or STALE, and the socket was NOT ended by the Core) | ONE persistent danger toast (`timeout: 0`): "Core server unreachable" / "The screen shows the last state received. Reconnecting…", with the action "Retry now" and, where the build offers the choice, a second kit `Button` "Switch to Simulated mode". The indicator reads `LIVE · OFFLINE`. No element is inserted into the page | `:58-64`, `:93-153` |
| The socket retries (OFFLINE, CONNECTING, OFFLINE …) | Still that one toast: the link counts as down until it is up again (`isLinkUp`: ONLINE or RESYNCING) | `:60-62` |
| "Retry now" | `live.reconnect('RETRY')` at once (CL-11a), on the existing cooldown `useRetryCooldown` (3 s, 6 s, 12 s, at most three): the label reads "Retry in 3s" and the control is disabled meanwhile; the toast is updated in place (`toast.update`) | `:95-103`, `:121-140` |
| The operator closes the toast | It stays closed for this outage (also while the cooldown ticks) | `:133-137` |
| The link is back | The toast is closed and "Reconnected to the Core" shows for `LIVE_RESYNCED_NOTICE_MS` (3,000 ms) | `:66-69`, `:142-151` |
| The session ended (sign-out, Lock, `session.ended`, a close with 4401) | NO link notice and no "Reconnected": the notice is shown only while signed in, and a socket the Core itself ended (`live.socketStatus().end !== null`) is not a lost link | `:58`, `:64`, `:67` |
| A command while the link is down | Refused by the Live source at once, no request (CL-22); the presenter of W50 shows ONE "Core server unreachable. Nothing was changed." for five presses | W50's `lib/core-errors.ts`; test "AC-C-59" |
| A 429 | The limit toast of LB-10 with the seconds of `retry-after`. The link did not move: no link notice, the indicator unchanged | Test "a limit is not an outage" |

Why a socket the Core ended is excluded (finding F76-5): when another tab signs in with this browser,
the Core ends this tab's session as ROTATED and closes its socket with 4401, while this tab stays
signed in until it has asked who owns the credential ([LS] row 7 a). Without the rule the tab showed
"Core server unreachable" and "Reconnected to the Core" for a reachable Core (first run of the test
"another operator takes the session").

The shell's own `touch` (pointer and key activity, `app-shell.tsx:113-124`) shows nothing in any case:
the Live source throttles it to one `touchSession` a minute and reports a failed one itself, so an
outage is worded once, by this notice (test "operator activity").

## 6. The role notice, and leaving a page ([CS] §6.3, §6.5; RC-1, RC-2, RC-3; CA-03; AC-C-49, AC-C-50)

`components/shell/live-notices.tsx:161-220`, `useSessionChangeNotice()`: the one place where the
shell reacts to a change of the signed-in session.

The Core tells a role change twice: `session.updated` replaces the session of the Live source (role
and permission list), and a delta replaces the operator's row in the replicated `operators` slice.
Either can arrive first. The guards of the two administration routes read the first; the guard of
`/session/new` (`routes/_app/session/new.tsx:15-19`, unchanged, AC-C-41) reads the second. So both
are watched, each by comparing what was known with what is known now. That also finds a change the
Live source learned without `session.updated` (a permission refresh after a refusal, the session
read at a reconnect), as W50's query bridge does.

| What changed | What the shell does |
|---|---|
| The role of the signed-in operator, by whichever of the two messages says it first | ONE info toast: "Your role is now {{role}}. The available actions have changed." The second message of the same change says nothing |
| … and the page that is open needs a permission the new role does not have (`ROUTE_PERMISSIONS`: `/session/new`, `/admin/users`, `/admin/devices`) | The same toast carries a second sentence: "The page you were on is not part of this role. You are back on the Dashboard." |
| The role, the permission list, or who the operator is | `router.invalidate()` (`:218`): the guards of the matched routes run again and the one whose permission is gone redirects to `/dashboard` with `replace` |
| Every other page | Stays: the same page element (nothing is mounted again, so nothing typed is discarded) |
| A permission gained | Entries appear, controls become enabled; no navigation |
| Another operator took the session of this browser (a sign-in in another tab, [LS] row 7 a) | The guards run for them; no role notice |

- **CA-03 holds.** `router.invalidate()` loads the matched routes again, `beforeLoad` included, and
  follows the redirect; the test "CA-03" shows that `router.navigate` is never called and that the
  shell's file names no destination. The three-entry map is read only for the second sentence.
- **RC-3**: the query bridge empties the `['core', …]` cache in the turn of the store update; this
  hook runs in an effect, after the render. The test subscribes to the router's `onBeforeNavigate`
  and finds both administration lists gone from the cache when the redirect starts.
- RC-2: a change back to the seed role is the same event and gets the same notice (test).
- The role line of the user menu follows the role of the replicated `operators` row and cross-fades
  over 120 ms (M-C-10, the pattern of `features/devices/status-chip.tsx`; `user-menu.tsx:72-84`).
- A session that ENDS is not this hook's: `AppLayout` (unchanged) leaves for `/login`, with
  `?redirect=<href>` when `auth.status` is EXPIRED (IDLE_EXPIRED, ABSOLUTE_EXPIRED) and without it
  otherwise (USER_DISABLED, SIGNED_OUT, a close with 4401). The Login page's notices are W55's.

## 7. The ADMINISTRATION group ([CS] §10.1 PG-4, PG-5; AC-C-51)

| Part | Where | What |
|---|---|---|
| The items | `nav-items.ts:75-76` | "Users & Roles" (`UsersRound`, `/admin/users`, `USER_ADMIN`) and "Paired Devices" (`TabletSmartphone`, `/admin/devices`, `PAIRING_MANAGE`), group `admin`, both `liveOnly` |
| Which are rendered | `use-visible-nav-items.ts:15-25` | A `liveOnly` item needs Live mode; an item with a `permission` needs it in the Core's list of the session (`live.session.permissions`, the hint `useCorePermission` reads). The nine earlier items carry neither |
| The group | `sidebar.tsx:126-164` | Between the product pages and DEVELOPER, with the same separator and micro label; rendered only when it has an item. `SidebarNav` is also what the Drawer (below 1024 px) and the "More" sheet (below 768 px) render, so they show the same groups |
| Appear and disappear (PG-5) | `sidebar.tsx:135-146` | `AnimatePresence`: enter opacity 0 → 1 with `x -8 → 0`, `fast`; exit opacity only, the kit's `transitions.exit` (R2); reduced motion: opacity only. DEVELOPER below is one Motion layout node (`:86`) and moves by `transitions.layout`. At the first render the group is at rest and its items take the shell entrance like every other item |

Not built: an item of the group that appears or disappears ALONE is not animated by itself (the
seeded matrix gives both permissions to the same role, and the matrix is read-only, RB-9); the group
and its neighbours still move.

## 8. The two routes, their guard and the page stubs ([CS] §10.1 PG-1, PG-2, PG-3)

| Route | File | Guard | Page |
|---|---|---|---|
| `/admin/users` | `routes/_app/admin/users.tsx` | `requireCorePermission(context.sim, Permission.USER_ADMIN)` | `UsersRolesPage`, root `page-users-roles` |
| `/admin/devices` | `routes/_app/admin/devices.tsx` | `requireCorePermission(context.sim, Permission.PAIRING_MANAGE)` | `PairedDevicesPage`, root `page-paired-devices` |

The guard (`routes/_app/admin/-guard.ts:19-23`):

| Mode | The operator | Result |
|---|---|---|
| Live | Holds the permission in the Core's list of the session | The page |
| Live | Does not hold it | `/dashboard`, with `replace` |
| Simulated | Anybody | The page, which shows its "Live mode only" state |
| Both | Nobody signed in | `/login?redirect=<the page>` (the `_app` guard, unchanged) |

The stubs hold the page contract and nothing of the pages (those are W77 and W81):

| Mode | What a stub shows | Test ID |
|---|---|---|
| Simulated | `PageHeader` (the page's icon, title, subtitle) and `LiveOnlyState`: "This page needs the Core server", the page's sentence, and "Switch to Live mode" where the build offers the choice | `ur-live-only`, `pd-live-only`, and `…-switch` for the button |
| Live | `PageHeader` and an empty kit `EmptyState` with the existing words `common.states.empty` ("Nothing to show yet") | `ur-stub`, `pd-stub` |

## 9. Words (PG-10)

| Namespace | File | Keys written by this row |
|---|---|---|
| `usersRoles` | `packages/shared/src/i18n/en/users-roles.ts` | `title`, `subtitle`, `states.liveOnly` |
| `pairedDevices` | `packages/shared/src/i18n/en/paired-devices.ts` | `title`, `subtitle`, `states.liveOnly` |
| `shell` | `packages/shared/src/i18n/en/shell.ts:27-49`, `:117-119` | `mode.tooltip.{SIMULATED,LIVE,OFFLINE,RECONNECTING}`, `mode.switchHint.{SIMULATED,LIVE}`, `roleNotice.{changed,pageLeft}`, `liveOnly.title`, `nav.{adminGroup,usersRoles,pairedDevices}` |

Titles and subtitles are the specification's (§10.2, §10.3). No existing key or string changed. The
words of the chip, of the switch and of the link notice are W50's (`common.coreMode`, `common.coreLink`).

## 10. Layout: what yields to the indicator, and the sidebar with two more entries

Both were found by the first lane pass (the screenshots `54_pass1_crowded_live_1440.png` and
`54_pass1_crowded_simulated_1440.png`) and measured in the browser before they were corrected.

### 10.1 The top bar had no room

Measured at `/storage`, Simulated mode (`assets/54_lane_measure_m1.log`): how far the lockup's text
(wordmark, tagline) reaches into the cluster, in px. Positive: they collide (the wordmark is cut and
the tagline runs under the date).

| Width | Before this row (no chip) | With the chip `SIMULATED`, the date kept | With the longest label `LIVE · RECONNECTING`, the date kept |
|--:|--:|--:|--:|
| 1280 | +94 | +216 | +280 |
| 1366 | +17 | +139 | +202 |
| 1440 | -57 | **+65** | +128 |
| 1536 | -153 | -31 | +32 |
| 1600 | -155 | -34 | +30 |
| 1680 | -235 | -114 | -50 |
| 1920 | -475 | -354 | -290 |

The bar was full at 1440 px before this row (57 px to spare) and already collided below 1383 px. The
chip costs 122 px (`SIMULATED`) to 185 px (`LIVE · RECONNECTING`). The indicator must never be
hidden, so something else yields (`shell.css:1229-1259`):

| Rule | Applies to | Why this threshold |
|---|---|---|
| Below 1520 px the date and its separator are not shown | Both modes | With the date, `SIMULATED` collides below 1506 px |
| Below 1664 px the same, in Live mode (`.dems-shell[data-core-mode='LIVE']`) | Live | With the date, `LIVE · RECONNECTING` collides below 1657 px |
| Below 432 px the clock is not shown | Both modes | With the clock the bar needs 423 px for `SIMULATED` |
| Below 496 px the same, in Live mode | Live | With the clock the bar needs 486 px for `LIVE · RECONNECTING` |

After the rules (final lane pass, `assets/54_lane_run.log`, `54_lane_layout.json`; the same measure):

| Window | Simulated | Live, `LIVE` | Live, longest label | Date shown (Simulated / Live) |
|---|--:|--:|--:|---|
| 1280x800 | +58 (before: +94) | +42 | +149 | no / no |
| 1366x768 | -19 (before: +17) | -35 | +71 | no / no |
| 1440x900 | -93 | -109 | -3 | no / no |
| 1519x900 | -172 | -188 | -82 | no / no |
| 1520x900 | -15 | -189 | -83 | yes / no |
| 1600x900 | -34 | -207 | -101 | yes / no |
| 1663x900 | -97 | -270 | -164 | yes / no |
| 1664x900 | -98 | -114 | -7 | yes / yes |
| 1920x1080 | -354 | -370 | -263 | yes / yes |

Reading: in Simulated mode the bar is at no width tighter than it was before this row. In Live mode it
is tighter only below 1440 px and only while the chip carries its two longer labels (`LIVE · OFFLINE`:
8 px more than before; `LIVE · RECONNECTING`: up to 55 px more), where the wordmark was cut before too.
At phone widths (`assets/54_lane_measure_xs.log`): from 360 px the SECURE pill lies inside the window
in every state but `LIVE · RECONNECTING` (from 378 px); at 320 px it is cut in every state.

### 10.2 The sidebar with ADMINISTRATION

Two more entries, a separator and a label are 154 px (lg) more. The brand footer is a flex item that
may shrink to nothing (`.dems-sidebar-foot`, `min-height: 0`), and its text then draws over what
stands above it; at 1440x900 it reached the rail toggle. Rule (`shell.css:902-911`, only when the
list holds the group, `data-admin="true"`): the footer keeps its own height and the sidebar scrolls
(it has `overflow-y: auto`); the texture takes whatever height is left.

| Window | Live, SUPERVISOR (11 entries) | Simulated (9 entries), unchanged |
|---|---|---|
| 1366x768 | Footer does not overlap (0 px); the sidebar scrolls; screenshot scrolled to its end | Footer over the toggle by 10 px, as before this row |
| 1440x900 | 0 px; scrolls | Texture 122 px, no scroll |
| 1600x900 | 0 px; scrolls | Texture 24 px |
| 1680x1050 | Texture 7 px, no scroll | Texture 174 px |
| 1920x1080 | Texture 37 px, no scroll | Texture 204 px |

## 11. The Stack Check line (decision D121, finding F72-3)

`apps/core-web/src/features/home/home-page.tsx:178`, one line:

| | Text |
|---|---|
| Before | `mock-core v{health.data.version} · api {health.data.apiVersion}` |
| After | `{health.data.service.replace(/^dems-/, '')} v{health.data.version} · api {health.data.apiVersion}` |

| The service that answers | The page prints |
|---|---|
| mock-core (`service: dems-mock-core`), Simulated mode | `mock-core v0.1.0 · api v1`: exactly as before |
| The Core server (`service: dems-core-server`), Live mode | `core-server v0.2.0 · api v1` (seen on the lane) |

The prefix is dropped so that Simulated mode reads as before; printing the name unchanged is the
alternative (decision 5). `home-page.test.tsx` is unchanged and passes.

## 12. Decision D120: what a displaced tab shows

The Core closes the OLDEST socket of a session that opens a fifth, with 1013 `replaced by a newer
connection`. For the live socket client 1013 is "any other close": the reconnect timer runs and the
link is OFFLINE; the session is untouched. Nothing was built for it. On the fake transport (test "a
socket the Core replaced"):

| Moment | The displaced tab shows |
|---|---|
| The close | The indicator `LIVE · OFFLINE` and the link notice "Core server unreachable. The screen shows the last state received. Reconnecting…" |
| After the first reconnect delay (500 ms and up to 250 ms of jitter) | A new socket, `LIVE`, the notice closed, "Reconnected to the Core" for 3 s. The operator stays signed in; no sign-out is sent |

**For the web checkpoint**: the wording says "unreachable" for a Core that is reachable, and with five
tabs or more the tab that reconnects displaces the next oldest, so the notice would pass from tab to
tab about once a second. The second statement follows from the two rules and was not run (no check
here opened five sockets): a **hypothesis**.

## 13. By-design changes in existing tests (decision D126)

`packages/shared/test/i18n.test.ts` pins the list of namespace files; the row adds two namespaces by
design (PG-10). The controller granted the smallest change at 20:52. Pre-image:
`.cache/rollback/W54/pre/shared_test_i18n.test.ts` (equal to `acaff20`, `git hash-object`
`7bdf12695e6a1bcf00d6907d6aa5bcbaf4da2f0e`).

| Line (after) | Before | After |
|--:|---|---|
| 58 | (no line) | `  'users-roles.ts': 'usersRoles',` |
| 59 | (no line) | `  'paired-devices.ts': 'pairedDevices',` |
| 93 | `  it('has exactly 13 namespace files and one en key per file', () => {` | `  it('has exactly 15 namespace files and one en key per file', () => {` |

`git diff --numstat acaff20 -- packages/shared/test/i18n.test.ts`: `3 1`. The list stays closed; no
assertion was weakened; the file has no per-namespace key check. Not changed, because the grant names
the title and the list only: the comment at `packages/shared/test/i18n.test.ts:2` still says "13
namespaces" (smallest change: `13` → `15`).

No other test pins the list: `apps/mobile/src/i18n/i18n.test.ts:67` builds its expectation from
`SHARED_NAMESPACES`, and no web test names the namespaces.

**CLG (a), stated plainly**: this one shared test file differs from `acaff20` by this grant. The
existing test files of the web workspace do not differ by this row (section 16).

## 14. The lane check (lane 3; CLG (d))

Every run inside `/usr/bin/lockf -k -t … .locks/core-server.lane3.lock /bin/sh <script>` (sandbox
bypass for that one command; `lockf exit=0` each time). Built on W50's lane script and driver. The
demo flag was off. The lane database was not reset. Port 5432 was never named; 5173 to 5175 and 4400
were neither used nor touched (`lsof` showed nothing listening on 4400 before each Simulated page).

| # | Run | Time | Script | Log |
|--:|---|---|---|---|
| 1 | First full pass | 21:10:16 to 21:11:29 | `assets/54_lane_run_lane.sh.txt` (without step 6b) | `assets/54_lane_run_pass1.log` |
| 2 | The top bar's budget (Simulated; no backend) | 21:16:00 to 21:16:27 | `assets/54_lane_run_measure.sh.txt` | `assets/54_lane_measure_m1.log` |
| 3 | Layout pass (first thresholds) | 21:22:27 to 21:23:14 | `assets/54_lane_run_layout.sh.txt` | `assets/54_lane_run_layout_pass2.log` |
| 4 | **Final full pass, on the finished code** | 21:24:40 to 21:26:41 | `assets/54_lane_run_lane.sh.txt` | `assets/54_lane_run.log` |
| 5 | Phone widths (Simulated; no backend) | 21:27:57 to 21:28:20 | `assets/54_lane_run_measure.sh.txt` with the driver `54_lane_measure_xs_driver.mjs.txt` | `assets/54_lane_measure_xs.log` |

4 min 51 s in all. Run 1 found the two layout problems of section 10; runs 2 and 3 measured and
corrected them; run 4 repeated everything on the finished code and is the evidence below. The CSS
rule for the clock (below 432 / 496 px) and the centring of the "Live mode only" state were written
after run 4 and are covered by run 5 and by its screenshot only (section 23).

### 14.1 Start and stop (run 4)

```
== 21:24:40 0. the three ports must be free before anything is started (nothing is stopped that this check did not start)
free: 4423 5178 9398
2026-10-04 21:24:40 WIB
== 21:24:41 2. start the lane backend: DEMS_CORE_PORT=4423 npm run start -w @dems/core-server (demo flag OFF)
backend up after 5 quarter seconds, npm pid 32302
node    32325 gsp-budi   18u  IPv4 0x50e91d401c38928f      0t0  TCP 127.0.0.1:4423 (LISTEN)
== 21:24:43 3. start Vite for lane 3: DEMS_CORE_PROXY_PORT=4423 VITE_DEMS_CORE_MODE=live npm run dev -w @dems/core-web -- --host 127.0.0.1 --port 5178 --strictPort
node    32410 gsp-budi   14u  IPv4 0x66272e67d330d2d      0t0  TCP 127.0.0.1:5178 (LISTEN)
-- health through the dev server: "service":"dems-core-server"
[...]
== 21:26:40 stop what this check started
chrome stopped
vite: npm exit status 143
backend: npm exit status 0

== 21:26:41 listeners left on 4423, 5178, 9398 (expect none):
lsof exit 1 (1 with no output: no listener)
2026-10-04 21:26:41 WIB
lockf exit=0
```

### 14.2 What the browser showed (run 4; `assets/54_lane_browser_{live,down,up,simulated}.json`)

The sign-ins were made by page script (`fetch('/api/v1/auth/sign-in')`) with the seeded operators
read from the project's seed source by the driver; the password was never printed (each phase ends
with "the output held the seeded password before redaction: false"). No phase recorded a console
error or warning.

| Step | What was observed | Screenshot |
|---|---|---|
| Live, nobody signed in | `/login`; `GET /auth/session` 401, `GET /auth/status` 200; one `/ws` socket | |
| The seeded SUPERVISOR (OPR-002), 1440x900 | `shell-mode`: text `LIVE`, `data-state="LIVE"`, a `BUTTON` (the lane's build offers the switch), inside the window. The sidebar: 11 links, the group `ADMINISTRATION` with `/admin/users` and `/admin/devices` | `54_shell_live_supervisor_1440.png` |
| 900x900 (the Drawer tier) | The chip `LIVE`, inside the window; the opened Drawer lists the same 11 links with the group | `54_shell_live_900.png`, `54_drawer_live_900.png` |
| 600x900 and 390x844 (the tab-bar tier) | The chip `LIVE`, inside the window; the top bar does not overflow | `54_shell_live_600.png`, `54_shell_live_390.png` |
| `/admin/users`, `/admin/devices` | `page-users-roles` with `ur-stub`; `page-paired-devices` with `pd-stub` | `54_admin_users_live.png`, `54_admin_devices_live.png` |
| `/stack-check` | `health-version`: `core-server v0.2.0 · api v1` | |
| Sign-out by page script | 204; the shell left for `/login` by itself | |
| The seeded INVESTIGATOR (OPR-001), 1440x900 | The chip `LIVE`; 9 links; **no ADMINISTRATION group** | `54_shell_live_investigator_1440.png` |
| The same operator opens `/admin/users` and `/admin/devices` by URL | Both land on `/dashboard` | |
| **A role change by the real server** (section 14.3): OPR-001 becomes SUPERVISOR | Within 2.5 s, without a reload: the toast "Your role is now Supervisor. The available actions have changed."; the group appears (11 links) | `54_role_gained_live.png` |
| In-app click on "Users & Roles" | `/admin/users`, `page-users-roles` | |
| OPR-001 becomes INVESTIGATOR again while on `/admin/users` | `/dashboard`; the group gone; the toast "Your role is now Investigator. …" with "The page you were on is not part of this role. You are back on the Dashboard." | `54_role_lost_live.png` |
| The lane backend stopped (the link is lost while signed in) | The chip `LIVE · OFFLINE`; ONE toast "Core server unreachable" with the buttons "Switch to Simulated mode" and "Retry now"; the meters read NO SIGNAL; no request to `/api/v1`; three refused socket attempts | `54_link_lost_live.png` |
| The backend started again | After 1 s: the chip `LIVE`; `GET /auth/session` 200 (the session outlived the restart); a new socket; "Reconnected to the Core"; the lost notice gone | `54_link_back_live.png` |
| Eleven window sizes, Live and Simulated | Section 10 | `54_layout_live_supervisor_1440x900.png`, `…_1366x768.png`, `…_1366x768_scrolled.png`, `54_layout_simulated_1440x900.png`, `…_1600x900.png` |
| Simulated (the stored choice wins over the lane's `live`), 1440 and 600 | The chip `SIMULATED`; 9 links, no group; **no request to `/api/v1`, no socket to the dev server's `/ws`** (the page tried `ws://127.0.0.1:4400/ws`, mock-core, as before; nothing listens there) | `54_shell_simulated_1440.png`, `54_shell_simulated_600.png` |
| Simulated, `/admin/users` by URL | Not redirected: `page-users-roles` with `ur-live-only` and its button | `54_admin_users_simulated.png` |

The screenshots show the seeded operators' display names in the top bar and in the event list
(synthetic demo data of the seed, as in W50's screenshots); no credential is on any of them (no
screenshot is of the Login page). `54_admin_users_simulated.png` and the five `54_shell_live_*`
are of run 4, taken before the centring of the "Live mode only" state.

### 14.3 What the check changed in `dems_lane_3`

The role change needs a second client: the driver signed the seeded SUPERVISOR in a second time from
Node (its cookie never printed), called `assignUserRole` for OPR-001 twice (SUPERVISOR, then
INVESTIGATOR again, the second call in a `finally`), and signed that client out. Both calls were
answered 200 in both full passes; OPR-001 is an INVESTIGATOR again, as seeded.

| Run | `audit_log` | `auth_sessions` | `events` |
|---|---|---|---|
| 1 | 86 → 94 | 1 → 4 | 63 → 69 |
| 3 | 97 → 99 | 5 → 6 | 72 → 74 |
| 4 | 99 → 108 | 6 → 10 | 74 → 81 |

(Between runs 1 and 3 another row used the lane: 94 → 97.) This row added 19 audit rows, 8 session
rows and 15 events: backend starts, sign-ins and sign-outs, and four ROLE_CHANGED pairs' worth of
role changes that leave the roles as seeded. The backend's log held no line of level error or fatal
in any run.

## 15. Requirement to test

Test files: I = `src/test/live-shell-indicator`, N = `live-shell-notices`, A = `live-shell-admin`
(all `.test.tsx`). Every Live test runs the real Live start-up and the real router on W50's harness
(the contract-checked fake transport and its clock).

| Criterion | The row's part | Proven by |
|---|---|---|
| AC-C-24 the indicator reads SIMULATED, LIVE, LIVE · OFFLINE; rendered at every shell width | all | I "AC-C-24: the indicator at three widths" (1920, 900, 600 px; nine tests); I "never hidden"; lane (four widths, both modes) |
| §3.2 LIVE · RECONNECTING | all | I "while the socket resynchronises" (a delta with a gap, on the real socket client); I "the indicator state" |
| MD-4, §3.3 step 1 | The shell's switch | I "the mode switch of the shell" (six tests: no control without a selectable mode, in both modes and for `selectable: false`; both directions; a second press; a refused write; a switch that throws) |
| AC-C-26 link lost while signed in | all | N "the link notice" (seven tests; the two named AC-C-26: one persistent toast, the indicator, meters at "no signal", a command rejected without a request; the replica equal to a fresh snapshot after the return, "Reconnected", a second outage a second notice); lane |
| AC-C-59 offline: five presses, one toast, no request | The web's test | N "AC-C-59" |
| LB-10, SD-03, AC-C-110 (the shell's part) | all | N "a limit is not an outage" (two tests: the limit toast with 7 s, no link notice, `toast.danger` never called, the indicator `LIVE`; five limited presses, one toast) |
| AC-C-49 `session.updated` changes the gated controls and shows the role notice | all | N "the role notice" (three tests); A "AC-C-51"; lane |
| AC-C-50 losing the permission of the current route leaves the three routes; every other route stays | The web's part | A "leaving the page whose permission was taken away" (eleven tests: `/admin/users`, `/admin/devices`, `/session/new` in both message orders, a permission lost without a role change, the other page's permission, three other routes, CA-03, another operator); lane |
| AC-C-51 the ADMINISTRATION entries only in Live mode and only with their permission; they appear and disappear | all | A "the ADMINISTRATION group" (eight tests: Simulated as SUPERVISOR, Live with and without, one permission, the rail, the Drawer at 900 px, the "More" sheet at 600 px, `session.updated` both ways); A "which items are rendered"; lane |
| AC-C-45 (the shell's part) | The leave path | N "a session that ended is not an outage" (eight tests: IDLE_EXPIRED and ABSOLUTE_EXPIRED leave for `/login?redirect=/evidence`; USER_DISABLED and SIGNED_OUT for `/login`; a close with 4401) |
| PG-1, PG-2, PG-3 | all | A "the two routes" (eleven tests) |
| PG-4, PG-5 | PG-5's motion is not observable in jsdom | A; the lane's screenshots show the result, not the motion |
| PG-10 | all | A "the words"; the shared suite (`i18n.test.ts`); no missing key in any render test (`getMissingI18nKeys()`) |
| CA-03 | all | A "CA-03" |
| CA-09 | all | The 39 existing files pass unchanged; I "never hidden" |
| [LS] row 16 Lock and Sign out never do nothing and never fail | The shell's two menu items | N "Sign out and Lock console from the user menu", "Lock console with the Core unreachable", "Sign out that the Core refuses" |
| [LS] row 18 the actions come from `useCoreActions()`, results through `settle` | The shell's two call sites | A "the shell's call sites"; N "operator activity" |
| [LS] row 30 no new state for the unconfirmed window | Nothing was built | |
| D120 | The note | N "a socket the Core replaced"; section 12 |
| D121 | The line | A "the Stack Check page names the service that answered"; lane |

CLG (b), "one Live test per settle site named in the row": the row names none. The shell has two
call sites of actions (`touch`, `signOut`); success, an outage and a refusal of `signOut` are in N
(a refused sign-out still ends the session here, so no denied toast applies), and `touch` is in N
"operator activity".

## 16. Verification

Baseline before the first edit (20:34, `assets/54_baseline_web_test.log`):
`npm run test -w @dems/core-web -- --maxWorkers=2` exit 0, 48 files / 598 tests.

### 16.1 Why this section stood empty

The session break (D130) came before the gate was written down: the result cells of section 1 held the
tokens `GATE_WEB_LINE`, `GATE_MINE`, `GATE_SHARED_LINE` and `MUT_LINE`, this section held `GATE_BLOCK`
and section 17 held `MUT_BLOCK`. No runner total of this row was quotable from its own document — the
verifier's claim 13 (FAIL) and the reason the row could not be gated. The runs below were performed
again on 2026-10-05 by `coder-execution-local`, on the current tree, and are quoted from that run. The
baseline above (20:34 on 2026-10-04) is the row's own and stands unchanged.

### 16.2 The gate, fresh on 2026-10-05 (`assets/54_gate_*.log`)

Load at 11:34 was `3.92 4.36 4.78`; Node `v26.8.2`, npm `11.19.1`; one workspace at a time, every suite
with `--maxWorkers=2`.

`npm run test -w @dems/core-web -- --maxWorkers=2` — 11:34:21, exit 0:

```
 Test Files  55 passed (55)
      Tests  759 passed (759)
   Start at  11:34:21
   Duration  59.07s (tests 68%, import 15%, environment 11%, setup 4%, transform 2%)
CORE_WEB_EXIT=0
```

The three files of this row alone — 11:35:32, exit 0:

```
 Test Files  3 passed (3)
      Tests  84 passed (84)
   Start at  11:35:32
   Duration  9.52s (tests 82%, import 7%, transform 6%, environment 3%, setup 1%)
SHELL3_EXIT=0
```

`npm run test -w @dems/shared -- --maxWorkers=2` — 11:35:48, exit 0:

```
 Test Files  68 passed (68)
      Tests  1814 passed (1814)
   Start at  11:35:48
   Duration  9.82s (tests 59%, import 30%, transform 10%, worker 1%)
SHARED_EXIT=0
```

`npm run typecheck -w @dems/core-web` → `> tsc -b`, no output, `TYPECHECK_EXIT=0`.
`npm run lint -w @dems/core-web` → `> oxlint`, no finding, `LINT_EXIT=0`.

**F76-1 is not present in this run.** The web suite exits 0 at 55 files / 759 tests, which contains
`live-runtime-startup.test.tsx`; D128 ruling 1 landed in that file (the closed comparison with the one
shell key at `:399`), so the finding that kept this row from exiting 0 is closed on the tree. Section 1
now reads exit 0 where it read "does not exit 0".

**Ledger note for the controller (the measured numbers the row never recorded):** this row's new tests
are **84 in 3 files**; the plan's ledger and the row's own cells held no number at all.

## 17. Mutation check (M15)

### 17.1 The record, and where it lived

The check ran on 2026-10-04 between 21:20 and 22:05 with the row's own runner (`.cache/w54/mut/run_mutations.py`
with `vitest.mutation.config.mts`): each mutation is ONE text replacement in ONE module applied **in memory**
by a Vite transform plugin, so M15 holds — no file of `apps/**` is ever written, and the plugin leaves a
marker under `$TMPDIR` that the runner checks, which is what makes "detected" mean "the tests named for
that module failed while the mutation was really applied". The record was left in git-ignored scratch only
(`.cache/w54/mut/`), which is why the verifier found no `54_*` asset naming a gate or a mutation run
(claim 12). It is now part of this row's evidence: **`assets/54_mutation_record.txt`**, provenance line
included. Its summary lines read:

```
## 2026-10-04 21:51:11 WIB 57 mutations: 55 detected, 2 survived ['T02', 'G05'], 0 not applied []
## 2026-10-04 22:01:15 WIB 59 mutations: 55 detected, 4 survived ['W11', 'N36', 'N39', 'N40'], 0 not applied []
## 2026-10-04 22:02:50 WIB 2 mutations: 2 detected, 0 survived [], 0 not applied []
## 2026-10-04 22:05:15 WIB 9 mutations: 9 detected, 0 survived [], 0 not applied []
```

T02 and N36 were re-tested after their survival and are DETECTED (run 1d). The table grew between the
runs — 57 entries at 21:51, 59 at 22:01, **137** by 22:02 — so **no recorded run ever covered the final
table**; the last full pass was over 59 entries. That gap is stated here rather than papered over.

### 17.2 Fresh static check and fresh re-test of the four untested survivors (2026-10-05)

`python3 .cache/w54/mut/run_mutations.py check` on the current tree: `137 mutations in 18 modules; texts
that do not occur exactly once: 0`. Re-running only the four that had no re-test
(`run G05 W11 N39 N40`, `assets/54_mut_retest_survivors.log`):

```
## 2026-10-05 11:36:23 WIB baseline: the three test files of the row, no mutation
baseline exit=0 Test Files  3 passed (3) | Tests  84 passed (84) (21.9 s)
W11 SURVIVED    exit=0 components/shell/mode-switch.tsx: a second press while switching sends a second switch
N39 SURVIVED    exit=0 components/shell/live-notices.tsx: the first comparison after a sign-in reports a change
N40 SURVIVED    exit=0 components/shell/live-notices.tsx: the notices are rendered in Simulated mode
G05 SURVIVED    exit=0 routes/_app/admin/-guard.ts: the redirect leaves a history entry
## 2026-10-05 11:37:38 WIB 4 mutations: 0 detected, 4 survived ['W11', 'N39', 'N40', 'G05'], 0 not applied []
```

All four still survive the current tree. None of the three test files could be edited by this repair
(the Documentation Contract of the repair forbids any write under `apps/**`), so each was instead taken
apart with candidate tests injected **in memory** — the same method as the harness, config and snippets
under `/var/folders/…/T/kilo/w54_repair/`, nothing in the repository touched, `mutations.json` keeping its
md5 `98b88e1b2fa51d849bf8623bbfc3ff2f`. The measurements are in **`assets/54_mut_probe_evidence.log`**.

### 17.3 Result of the four, in one line each

| ID | Site | Outcome | Why |
|---|---|---|---|
| G05 | `-guard.ts` redirect without `replace` | **equivalent** | identical on three surfaces, including a real `window.history` |
| W11 | `mode-switch.tsx` without `\|\| switching` | **equivalent by redundancy** | the kit's `isPending` already blocks the press; removing both guards fails an existing test |
| N39 | `live-notices.tsx` without `previous.session === null` | **equivalent, unreachable** | the shell is never mounted while the Live source holds no session |
| N40 | `live-notices.tsx` without the `live === null` guard | **equivalent** | the branch is a type narrowing; Simulated-mode observables are byte-identical |

### 17.4 The four, measured (the detail behind 17.3)

* **G05.** Candidate tests were appended to `live-shell-admin.test.tsx` and run at baseline and under
  G05. Memory history around a client-side navigation to the refused page gave `lengthBefore=1
  lengthAfter=2` **in both**; a six-observable traversal (`mounted`, after the refused navigation,
  `afterBack`, `afterForward`, direct mount, mount+back) was **byte-identical**; and a third candidate
  rebuilt the router on `createBrowserHistory` — production's own implementation, so the result does not
  rest on a quirk of `createMemoryHistory` — reading `mountedLen=1 afterRefusedNavLen=2
  afterBackPath=/dashboard backLen=2` **in both**. The candidate's own expectation (`after === before`)
  failed at baseline as well, which is the finding: the extra entry comes from the navigation attempt,
  not from the flag. What `replace` decides is how many dead entries a browser keeps between
  `/dashboard` and the page before it — invisible in jsdom (measured) and masked in a real browser,
  because Back over the refused page runs the same guard again and lands on `/dashboard` either way.
  Killing it would mean pinning the source text (a text pin, not a behaviour) or a lane Back-press check
  in a real browser, which is outside M15's reach.
* **W11.** The row's own test already presses Confirm twice while the switch runs
  (`live-shell-indicator.test.tsx:326-347`, with a `switchTo` that never settles) and cannot see the
  mutation. Measured why: after the first press the button carries `aria-disabled="true"` and
  `data-pending="true"` and `switchTo` has been called once — **identically at baseline and under W11** —
  so the second press never reaches `confirm`. To show the invariant is genuinely pinned rather than
  untested, a synthetic probe mutation `K01` (not one of the 137: it removes the *other* guard,
  `isPending={switching}`, from the same button) was applied beside it. K01 alone: `22 passed` — the
  `switching` clause alone holds the invariant. W11 + K01 together: `× Live: the chip opens the
  confirmation for Simulated and hands the choice to the runtime once … 1 failed | 21 passed`. Two
  independent guards protect one invariant; removing either alone is unobservable, removing both fails a
  test the row already owns. No test can kill W11 without first deleting the guard that makes it
  equivalent, and that guard is this row's own code.
* **N39.** The mutant needs a mounted `LiveNoticesBody` whose previously known session was `null` and
  whose session is now set (it would then dereference a null `before` and throw). Mounting the console
  signed out is the only way to make the past empty, and it measures the same at baseline and under N39:
  `path=/login appShellAbsent=true noticesMounted=false roleNoticeCalls=0`. `AppShell` — the only mount
  point of `LiveNotices` — is never mounted, because the `_app` guard sends the signed-out console to
  `/login`, and because W50's runtime makes `SIGNED_IN` and a known session arrive in **one** store update
  (`packages/shared/src/live/source/live-sim.ts:33`). The clause is defensive against a state the
  runtime's own contract forbids. A test could kill it only by rendering the hook outside the router on a
  hand-made source that breaks that invariant — offered as optional hardening for whoever next owns the
  file, not as a gap of this row.
* **N40.** The branches differ only where `useWebLive()` returns `null`, i.e. only in Simulated mode.
  There the measurement is identical at baseline and under N40 — `path=/admin/users toastSlots=0
  lostTitles=0 chip=SIMULATED dialogs=1 switchToCalls=1` — including the strongest observable that mode
  offers: pressing the page's own "Switch to Live mode" yields **exactly one** dialog, so the body the
  mutant mounts contributes no second copy of anything. The reason is structural: with no Live source
  `useLiveLink()` and `readSession(null)` give null, `isLinkLost(null)` is false and short-circuits the
  only dereference of `live` (`live.socketStatus()`, `live-notices.tsx:58`, right of `&&`), `down` stays
  false, `showing = active && down` is false, `LinkLostToast` is never mounted (`:74`) and `dialog` is
  null while `target === null`. The ternary narrows a type; it does not branch behaviour.

**Accounting.** Of the 59 mutations of the last recorded full pass: 55 are killed by the row's tests, and
the remaining 4 are now shown by measurement to be equivalent — no assertion over observable behaviour
separates them from the code as written. Before this repair the four were simply "survived, no re-test";
after it they are closed with evidence. A fresh pass over the whole 137-entry table is reported in 17.5.

### 17.5 A fresh pass over the whole table (2026-10-05)

The gap stated in 17.1 was closed by running the **whole 137-entry table** once more on the current
tree, with the row's own runner and the same in-memory method, `--maxWorkers=1`, from 12:02:41 to
12:46:26 WIB (`assets/54_mut_full_run.log`):

```
## 2026-10-05 12:02:41 WIB baseline: the three test files of the row, no mutation
baseline exit=0 Test Files  3 passed (3) | Tests  84 passed (84) (18.2 s)
## 2026-10-05 12:46:26 WIB 137 mutations: 133 detected, 4 survived ['W11', 'N39', 'N40', 'G05'], 0 not applied []
```

* **133 of 137 killed.** The four survivors are exactly the four of 17.2–17.4 — no new survivor appeared
  among the 78 entries that had never stood in a full pass (the last one covered 59).
* **T02 and N36 are DETECTED inside a full pass** now, which confirms the tests added for them on
  2026-10-04 at 22:02 rather than only the two-file re-run that recorded them.
* `0 not applied`: every mutation really replaced its text, so no entry silently no-oped.
* M15 held: nothing under `apps/**` or `packages/**` was written by the pass — every source file of this
  row still carries its 2026-10-04 mtime, and no file in those two trees changed after 11:58.

**M15 reads complete on this tree: 133 killed by the row's three test files, 4 equivalent by measurement
(17.4), 0 not applied.**

## 18. Findings

| ID | Finding | Evidence | For |
|---|---|---|---|
| F76-1 | **One test of W50 is red since 21:00, by a change of the Login row.** `apps/core-web/src/test/live-runtime-startup.test.tsx:398` compares the whole `sessionStorage` after a Live session and now finds one more key, `dems.shell.intro`. The Login page (W55, `features/login/use-login-controller.ts`, written 21:00:06) now hands over to the shell when the store becomes SIGNED_IN, so the shell mounts in that test; the shell has written that session flag since `acaff20` (`components/shell/shell-entrance.ts:56-58`, called at `app-shell.tsx:62`, both unchanged by this row), and [CS] §3.4 lists the key as "as today" in Live mode. The same test passed at 20:53 with this row's shell changes in place and failed at 21:05; no final gate was ever recorded (the break, D130), so nothing later than 21:05 is quotable from this row — and the file is **green** in the fresh run of section 16.2 (D128 ruling 1 landed in it). Smallest change (not this row's file): line 398 expects `{ ...before.session, 'dems.shell.intro': '1' }`, or the line is dropped (lines 396-397 already hold the two simulator keys byte-equal) | Section 16 | Controller |
| F76-2 | The top bar had no room for the indicator: full at 1440 px before this row, and the chip costs 122 to 185 px | Section 10.1 | Decision 1 |
| F76-3 | With two more entries the sidebar's brand footer drew over the rail toggle at 1440x900. Before this row the same footer already overlaps the toggle by 10 px at 1366x768 in Simulated mode (9 entries); that is left as it is | Section 10.2 | Decision 11; the Simulated case for the controller |
| F76-4 | The Login row wrote a second copy of the confirmed mode change, `features/login/use-mode-switch.tsx` (`useLoginModeSwitch`), beside the shell's `components/shell/mode-switch.tsx` (`useModeSwitch`): the same dialog, the same test IDs (`mode-switch-dialog`, `-confirm`, `-cancel`). Both work; the two are never mounted together | Read at 21:29 | Controller, decision 9 |
| F76-5 | A session the Core rotates (a sign-in in another tab) closes this tab's socket with 4401 while the tab stays signed in: a "lost link" that is none | Section 5 | Built; residual in section 23 |
| F76-6 | The kit's toast has ONE action slot (`actionProps`). The second action of §3.5 ("Switch to Simulated mode") is a kit `Button` inside the toast's description | `live-notices.tsx:104-117`; `54_link_lost_live.png` | Controller: stated |
| F76-7 | A Live session outlives a restart of the Core server: the tab reconnected in 1 s and was still signed in | Section 14.2 | Controller: stated (the sessions are rows of the database) |
| F76-8 | The first 403 example of every operation is `deviceRevoked`: `fake.example('signOut', 403)` makes a web test end the PAIRING, not refuse the call. A test that means "refused" names the example (`'originNotAllowed'`) | N "Sign out that the Core refuses" | The page rows' tests |
| F76-9 | The kit's toast queue is one per page and outlives a test; a toast that a test closed stays in the DOM for its 300 ms exit. A Live test of a page must empty it between tests (`clearToasts` in the three files) and must scope a toast query to `[data-slot="toast"]`: the Login page now has an offline state with the same words | The first runs of I and N | The page rows' tests |
| F76-10 | Below 360 px the SECURE pill is partly outside the window in every mode (the indicator takes its room). Not measured before this row | `assets/54_lane_measure_xs.log` | Controller: the phone UI is the native app |
| F76-11 | The mobile Stack Check screen still prints the literal (`apps/mobile/src/features/home/home-screen.tsx:217`); the grant of D121 names the web page | Read | Controller |
| F76-12 | `router.invalidate()` also runs for a change that needs no guard (a gained permission): the matched routes load again; no page was mounted again in any test | A "every other route stays" | Stated |

## 19. Deviations

| ID | Deviation | Why |
|---|---|---|
| D-1 | The date and, at phone widths, the clock yield to the indicator (section 10). The row's text names no such rule | The indicator is "never hidden at any width" and the bar was full; decision 1 |
| D-2 | RC-1 says the shell reacts to `session.updated`. The shell compares the session and the operator's row before and after instead | It finds the change whatever told the Live source, in both message orders, and for the guard of `/session/new`, which reads the row (section 6) |
| D-3 | One toast for a role change, with a second sentence when a page was left; §6.3 reads as a notice and "a toast says why" | One event, one notice |
| D-4 | The link notice is not shown for a socket the Core ended with 4401 (F76-5) | §3.5 does not name the case |
| D-5 | "Retry now" is on the retry cooldown (three presses at most, then "Max retries reached. Reload the page."); §3.5 names the action only | The existing rule of every Retry control of the console; the socket goes on retrying by itself |
| D-6 | `LIVE · RECONNECTING` and the two tooltips of the link-down states have this row's wording and the `danger` tone; §3.2 gives the label and no tone of its own | Decision 3 |
| D-7 | DEVELOPER is wrapped in one Motion layout node in BOTH modes (`sidebar.tsx:86`), one more `div` in the Simulated DOM. Its position inside the list does not change in Simulated mode, so nothing moves; no existing test pins the markup | PG-5: the neighbours move by `layout` |
| D-8 | The shell root carries `data-core-mode` and the navigation list `data-admin` | The two CSS rules of section 10 |
| D-9 | New files in `components/shell/` beyond the ones the row lists by name (the path is `components/shell/**`): eight | A pure function and a hook may not share a file with a component (the lint rule `react/only-export-components`) |
| D-10 | The shell's two `fail` branches write to the page's own log (`reportShellError`), not to a network endpoint | The project's standing decision for the web (W50 §10) |
| D-11 | Five lane runs instead of one (4 min 51 s of the 10 minutes) | The first found two layout problems; the last is on the finished code |
| D-12 | The lane check changed data: OPR-001's role twice per full pass, restored each time | The only way to see `session.updated` from the real server; section 14.3 |
| D-13 | **A command of this row printed the line of the seed constant `DEMO_OPERATOR_PASSWORD` to this agent's own tool output** (a `grep -n` over `packages/shared/src/sim/dataset.ts` at 21:09, cut too late). Nothing was written: no file, log, document, asset or message of this row holds the value (checked, section 16) | Stated for the record |
| D-14 | `masterplan/02_plan.md`, `status_tasks.md`, `decisions/decisions.md` and `implementation/99_implementation_report.md` were not written | Parallel run: the controller's files |

## 20. Decisions for the controller

| # | Decision | This row's choice | Alternative |
|--:|---|---|---|
| 1 | What yields to the indicator in the top bar | The date below 1520 px (1664 px in Live mode). **In Simulated mode the date is therefore no longer shown at 1280 to 1519 px**, where it was shown before | Keep the date and drop the tagline and the device block's captions; or a shorter chip |
| 2 | Phone widths | The clock yields below 432 px (496 px in Live mode) | Leave the SECURE pill to be cut, as below 360 px now |
| 3 | The tone and the meaning of `LIVE · RECONNECTING` | `danger`; shown for CONNECTING and RESYNCING | `warning`; or RESYNCING only |
| 4 | The role notice | One toast; a second sentence when a page was left | Two toasts |
| 5 | The Stack Check line | The service name without its `dems-` prefix, so mock-core reads as before | The name as the health answer gives it (`dems-mock-core`, `dems-core-server`) |
| 6 | The link notice and a socket the Core ended | No notice | A notice for every OFFLINE while signed in |
| 7 | "Retry now" | On the cooldown, three presses | No cap |
| 8 | A notice the operator closed | Stays closed for that outage; the indicator still says `LIVE · OFFLINE` | Comes back |
| 9 | The second copy of the mode switch (F76-4) | Left: not this row's file | The Login page imports `useModeSwitch` from `@/components/shell`; or the hook moves to `@/runtime` |
| 10 | The Live stub of the two pages | "Nothing to show yet" (existing words) | A sentence of its own |
| 11 | The brand footer with ADMINISTRATION | The sidebar scrolls on a short window | A shorter footer; smaller entries |
| 12 | F76-1 | Reported | The controller's slot edits `live-runtime-startup.test.tsx:398` |
| 13 | D120 (section 12) | Nothing built | A wording of its own for a replaced socket; a cap that refuses the NEW socket instead |
| 14 | `packages/shared/test/i18n.test.ts:2` | Not touched | `13` → `15` in the comment |

## 21. Seams for the page rows

### 21.1 For W77 (Users & Roles) and W81 (Paired Devices)

| A page row wants to | It finds |
|---|---|
| Replace the stub | `features/users-roles/index.tsx` exports `UsersRolesPage`; `features/paired-devices/index.tsx` exports `PairedDevicesPage`. Keep the export name and the root `data-testid`; the route files need no change. Replace the Live branch (`ur-stub`, `pd-stub`); keep the Simulated branch |
| The "Live mode only" state | `LiveOnlyState` from `@/components/shell` (`icon`, `body`, `testId`): already rendered by the stub in Simulated mode, with `ur-live-only` / `pd-live-only` |
| Words | `usersRoles.*`, `pairedDevices.*`: `title`, `subtitle`, `states.liveOnly` exist; add the key families of §10.2 / §10.3 to the same files |
| The guard | Already on the route. It runs again when the session's permissions change; the page needs no handling of its own for a lost permission ([LS] row 22) |
| The "Forbidden" state of §10.1 | Not built here (a stale hint: the fetch answered 403). The shell leaves the page when the push arrives |
| A link to the page | `NAV_ITEMS` holds the two items; the sidebar shows them by itself |
| Search parameters | Add `validateSearch` to the route file, as `routes/_app/session/new.tsx` does |

### 21.2 For every page row (W63 and after)

| Topic | What the shell does, and what a page must not do |
|---|---|
| An outage | The shell shows the link notice and the indicator. A page shows no "unreachable" notice of its own; it disables its commands by `useLiveLink()` if it wants CL-22 for calls through `live.client` ([LS] row 23) |
| A refused or limited call | The page hands the error to `useCoreErrorPresenter()` first (W50). The shell adds nothing |
| A role change | The shell shows the notice and runs the guards again. A page's gates follow by themselves (`selectCan` on the replicated row; `useCorePermission` on the session) |
| A route that needs a permission | Add it to `ROUTE_PERMISSIONS` (`components/shell/route-permissions.ts`) so that the notice can say that the page was left, and give the route a `beforeLoad` guard |
| The mode switch | `useModeSwitch()` from `@/components/shell`: `{ selectable, mode, request(next), dialog }`; render `dialog` once |
| The mode in CSS | `.dems-shell[data-core-mode='LIVE']` |
| A Live test | W50's harness; the docblock with the page address; `clearToasts()` between tests and toast queries scoped to `[data-slot="toast"]` (F76-9); a 403 by its named example (F76-8) |
| The top bar | Full again: another item needs another yield rule (section 10) |

### 21.3 For W55 (Login)

| Topic | Seam |
|---|---|
| The notice after a session end | The shell only leaves for `/login` (with `redirect` after an expiry). `live.lastSessionEnd` says why ([LS] row 16); the shell shows nothing for it |
| The link notice | Closed when the shell leaves, without "Reconnected": the Login page's own offline state takes over |
| The mode switch | F76-4 |
| Signed in again without a submit | The Login page now hands over to the shell; the shell's entrance is `handoff` then. See F76-1 for the one test this touches |

## 22. Rollback (not executed)

| Kind | Command or action |
|---|---|
| R-CO (the tracked files this row changed; their pre-image against `acaff20` was empty, `.cache/rollback/W54/W54.pre.patch` is 0 bytes; copies in `.cache/rollback/W54/pre/`) | `git checkout acaff20 -- apps/core-web/src/components/shell apps/core-web/src/routeTree.gen.ts apps/core-web/src/features/home/home-page.tsx packages/shared/src/i18n/index.ts packages/shared/src/i18n/en/shell.ts packages/shared/test/i18n.test.ts` |
| R-NEW | Remove: `apps/core-web/src/components/shell/{live-notices.tsx,live-only-state.tsx,mode-indicator.tsx,mode-indicator-state.ts,mode-switch.tsx,route-permissions.ts,shell-report.ts,use-visible-nav-items.ts}`; `apps/core-web/src/routes/_app/admin/`; `apps/core-web/src/features/users-roles/`, `features/paired-devices/`; `packages/shared/src/i18n/en/{users-roles,paired-devices}.ts`; `apps/core-web/src/test/live-shell-{indicator,notices,admin}.test.tsx`; this document, its `assets/54_*` and the progress file |
| Order | Both together: the changed files import the new ones, and the shared test pins the namespace files. After it `npm run test -w @dems/core-web -- --maxWorkers=2` and `npm run test -w @dems/shared -- --maxWorkers=2` give the totals of before this row, less whatever the rows after it added |
| Scratch | `.cache/w54/` (lane scripts and records, the mutation runner, the gate), `.cache/rollback/W54/`, `.locks/core-server.lane3.{log,vite.log}` and the two emptied pid files. All git-ignored |
| The lane database | Nothing to undo: the roles are as seeded; the audit rows are append-only by design |

## 23. Limits of this evidence, and what was not done

- One browser (headless Chromium 153), one tab. The two-tab cases (another operator takes the session;
  a Lock in another tab) are proven on the fake transport only.
- The sign-ins on the lane were requests made by page script, not presses on the Login page (W55).
- PG-5's motion (enter, exit, the neighbours' move) was not observed: jsdom has no layout, and the
  lane's screenshots are stills taken 2.5 s after the event.
- The tooltip of the indicator was not opened in any test or on the lane; its words are asserted as
  resources, its accessible name on the element.
- No 429 was produced on the lane (it needs the throttle or the denial budget); LB-10 is proven on
  the fake transport.
- The longest Live label was measured by replacing the chip's text in the page for the measurement
  (the layout driver), not by bringing a real socket into RESYNCING on the lane.
- The clock rule (432 / 496 px) and the centring of the "Live mode only" state were written after
  the final full pass: the clock rule is covered by run 5 (Simulated; the Live variant by setting the
  shell's attribute in the page), the centring by no screenshot.
- F76-5's residual: after a rotated session, if the Core cannot be asked who owns the credential, the
  tab shows `LIVE · OFFLINE` and no link notice until a socket is asked for again.
- The mutation check covers the row's production files with the row's three test files; not mutated:
  `shell.css`, `routeTree.gen.ts`, the two i18n files, `shell-report.ts`, `components/shell/index.ts`.
- `STALE` (a socket silent for 2,500 ms) reaches the notice through `isLinkLost` and is asserted on
  the pure function only: the harness's sockets cannot be made silent.

## 24. Documentation repair of 2026-10-05 (`coder-execution-local`)

The verifier measured this row's code sound and its own records incomplete (claims 8, 12, 13 of
`gateway_check/06a_w54_w57_gate_evidence.md`). This section records what was closed then, and two
findings for the controller. No source file, test file or plan file was written by it; the gate cells of
section 1 and sections 16.2 and 17 were filled from runs performed on 2026-10-05, quoted there.

### 24.1 F76-13 — a clause of the plan names test files that do not exist (finding for the plan's wording; the plan was not edited)

The verification cell that carries this clause reads: *"`npm run test -w @dems/core-web --
--maxWorkers=2` exits 0 with `routes.test.tsx`, `core-endpoint.test.tsx` and `packaged-csp.test.ts`
absent from `git diff --stat acaff20`"*. Measured on 2026-10-05:

| Named artefact | Exists at `acaff20`? | Exists now? | State against `acaff20` |
|---|---|---|---|
| `apps/core-web/src/test/routes.test.tsx` | yes | yes | blob-equal `7a04c97d…` — genuinely untouched |
| `apps/core-web/src/test/core-endpoint.test.tsx` | **no** (`git cat-file -e`: no) | **no** | the clause about it is **vacuous**: it can never fail |
| `apps/core-web/src/test/packaged-csp.test.ts` | **no** | **no** | vacuous likewise (`apps/core-web/src/lib/packaged-csp.test.ts` does not exist either) |

Two of the three named files have never existed in this repository, so "absent from the diff" proves
nothing for them. The real protected artefacts behind that clause are:

| Real artefact | Protection | Measured 2026-10-05 |
|---|---|---|
| `apps/core-web/src/lib/packaged-csp.ts` | never written by any row — the plan lists it under "Never written" (`02_plan.md:255`, restated at `:411`) | exists at `acaff20` and now; blob-equal `78c8898ecb89206beda222030c918958143316c3`; no line in `git diff --numstat acaff20` → untouched by W50, W54 and everyone else |
| `apps/core-web/src/lib/core-endpoint.ts` | **W50's own write path** (`02_plan.md:717` names it among W50's paths; W50 owns the Live row of that file) | modified `58 14` against `acaff20` — by **W50**, not by W54. This row lists `lib/**` among "Not written" (section 2) and has no line in it |

Two further points of fact, so the clause can be rewritten precisely rather than dropped:

* The clause sits in **W50's** verification cell (`02_plan.md:717`). **W54's own cell** (`02_plan.md:721`)
  says something different and checkable — "the existing shell tests absent from `git diff --stat
  acaff20`" — and that one **holds**: `apps/core-web/src/test/shell-motion.test.tsx`, the only
  pre-existing shell test at `acaff20`, is blob-equal `4d82e08e…`, and it is green inside the 55 / 759
  run of section 16.2. Nothing of this row's gating depends on the two non-existent files.
* Where a test for those modules does exist, it is named differently: the packaged CSP and the core
  endpoint are covered by files under other names, and the row neither owns nor touched them.

**Asks the controller:** re-word the clause of `02_plan.md:717` to name artefacts that exist — e.g. "`lib/packaged-csp.ts` blob-equal to `acaff20` (never-written) and `test/routes.test.tsx` unchanged" — or drop the two names. Recorded here as a finding; **the plan was not edited** (D-14 still holds).

### 24.2 F76-14 — the two confirmed-mode-change copies are pinned through one identical set of test IDs (for the controller's ruling, D128 point 4)

F76-4 recorded the duplication. What the unification turns on is measured here, freshly, on 2026-10-05:
both implementations render **the same three test IDs**, and four test files pin the dialog through those
IDs alone — so the two copies cannot be told apart by test ID, and whichever copy is retired, the tests
that reach it must move with it.

| Copy | Hook | Renders |
|---|---|---|
| shell | `components/shell/mode-switch.tsx:30` `useModeSwitch()` | `mode-switch-dialog`, `-confirm`, `-cancel` |
| login | `features/login/use-mode-switch.tsx:34` `useLoginModeSwitch()` | the same three strings |

Occurrences of each ID per test file (counted, not quoted from elsewhere):

| Test file | Row | `mode-switch-dialog` | `-confirm` | `-cancel` |
|---|---|--:|--:|--:|
| `src/test/live-shell-indicator.test.tsx` | **W54** | 11 | 4 | 1 |
| `src/test/live-shell-notices.test.tsx` | **W54** | 1 | 1 | 0 |
| `src/test/live-shell-admin.test.tsx` | **W54** | 1 | 1 | 0 |
| `src/test/live-login-page.test.tsx` | W55 | 7 | 4 | 1 |

Each test reaches the copy its own surface mounts, so all four files are green today (section 16.2).
What this does **not** settle, and D128 point 4 asks to rule: which file survives the unification, and
whether the two can ever stand in one tree at once — the Login page hands off to the shell inside a
single test (`live-runtime-startup.test.tsx`, the file of F76-1). Noted for the ruling, not judged here.

### 24.3 One statement of section 1 that the fresh runs overtake (left verbatim on purpose)

The **Status** cell of section 1 still reads *"One test of ANOTHER row is red in the web suite since
21:00 … the web suite therefore does not exit 0"*. That was true at 21:05 on 2026-10-04 and is **no longer
true**: D128 ruling 1 landed in `live-runtime-startup.test.tsx`, and the fresh gate of 16.2 exits 0 at
55 files / 759 tests with that file inside it. The cell is part of the row's own record of what it saw
that evening, so this repair leaves it worded as it was and states the correction here instead — the
controller may want the cell itself updated when gating. The Web tests / New tests / Shared tests /
Mutation check cells beside it were empty tokens and have been filled from the fresh runs.

### 24.4 What this repair wrote, and what it left alone

Wrote: this document (the cells of section 1, sections 16.2, 17 and 24), `assets/54_mutation_record.txt`,
`assets/54_gate_web_test.log`, `assets/54_gate_shell3_test.log`, `assets/54_gate_shared_test.log`,
`assets/54_gate_typecheck_lint.log`, `assets/54_mut_retest_survivors.log`, `assets/54_mut_full_run.log`,
`assets/54_mut_probe_evidence.log`, and `delegation_progress/coder_execution_local_step_76_repair.md`.
Filled the two remaining tokens of `delegation_progress/coder_execution_step_76.md`.

Left alone: every file under `apps/**` and `packages/**` (the mutation probes ran by in-memory transform
only, outside the repository); `masterplan/02_plan.md` including the wording of 24.1; `status_tasks.md`;
the controller's shared files; every other row's document. No credential, token, cookie value or password
appears in anything written here.
