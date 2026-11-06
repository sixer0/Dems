---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: W63 (plan step 85, provisional row 66)
agent: coder-execution
date: 2026-10-05
source_plan: masterplan/02_plan.md (row W63; gate CLG of section 11)
status: complete
---

# W63 — the web Dashboard in Live mode (settle site B-7)

Tier 2 record: what was built, why, and how it was verified. Code is cited as `path:line` relative to the
repository root; `[CS:…]` is `masterplan/04_client_integration_spec.md`, `[CP:§8 rule n]` is
`gateway_check/08_cp_web_runtime.md` section 8 with the amendments of its section 30. No credential value
appears in this file or in the assets: the lane driver reads the demo password from the seed source and
never prints it (a scan of every `63_*` asset for it found nothing, section 6.4).

The run was interrupted by a stream stall at about 20:40 and resumed at 22:23 on the controller's message;
the tree was checked first (section 9, "Resume").

## 1. Result

| Gate item | Result | Evidence |
|---|---|---|
| SG: typecheck and lint of `@dems/core-web` | exit 0, exit 0 (22:41) | section 6.1 |
| SG: typecheck and lint of `@dems/shared` (i18n file) | exit 0, exit 0 (22:34) | section 6.1 |
| SG: `@dems/core-web` suite | **62 files / 849 tests, exit 0** (22:39:46), above the ledger 55 / 760 | section 6.1 |
| SG: `@dems/shared` suite | **68 files / 1,814 tests, exit 0** (22:34:00), at the ledger | section 6.1 |
| CLG (a) the folder's existing tests pass and are unchanged | `dashboard-model.test.tsx` absent from `git diff --stat acaff20`; `dashboard.test.tsx` holds W01b's state `1ab07579…` and is byte-equal to `b90a3c6`; both pass (15 + 16) | section 6.2 |
| CLG (b) one Live test per settle site: success, refusal with the denied toast, outage | site B-7: 2 success, 4 refusal (403 by the named `notPermitted` example, a 403 of operation 49, two 409), 3 outage/limit, 1 pending; plus 3 Simulated control tests | section 4 |
| CLG (c) no `useSimActions`, no `.actions` read on a `Sim` in the folder's production files | `grep` finds nothing; a static test holds it | section 6.3 |
| CLG (d) one live check on lane 3, at most 10 minutes, with screenshots | about 100 s of lane time over three runs; 6 screenshots; ports free afterwards | section 5 |
| M15 mutation check (in memory, no tree file changed) | 21 mutations: 20 detected, 1 survived (an equivalent one, explained) | section 7 |

## 2. What was built

### 2.1 Site B-7: the tile kebab of panel E (`apps/core-web/src/features/dashboard/devices-panel.tsx`)

| Part | Where | What and why |
|---|---|---|
| Words by mode | `devices-panel.tsx:50-63` (`COMMAND_WORDS`) | Simulated mode keeps its words, which say "simulated" (`common.deviceMenu.*`, `dashboard.devices.*Sent`); Live mode uses `dashboard.devices.live.*`, which do not: the Core server carries the command out ([CS:§3.2] "a screen that says live shows server data") |
| LB-1, spinner late | `devices-panel.tsx:73-84` (`usePendingReveal`) | The pending look appears only after `LIVE_PENDING_REVEAL_MS` × the motion policy's time scale ([CS:§8.1 LB-1]; `packages/shared/src/live/constants.ts:19`) |
| The command | `devices-panel.tsx:110-150` (`useDeviceCommand`) | Actions from `useCoreActions()` (`:113`); the call inside `settle` (`:132`) [CP:§8 rule 1]; success toast in `ok`, so it shows after the Core's answer (in the turn of CL-16, so the tile already shows the Core's state); `fail` hands the error to the presenter first (`:137`) [CP:§8 rule 2]; what the presenter leaves to the page (409 `RECORDING_ACTIVE`, 409 `COMMAND_UNSUPPORTED`, rebuilt as `SimTransitionError`) keeps the predecessor's friendly toast `dashboard.devices.commandFailed` and writes one record (`:138`) ([CS:§8.3 B-7]) |
| LB-1, busy at once | `devices-panel.tsx:128-131`, `:181`, `:213` | A ref answers a second press at once (`:128`); the two command items are disabled while a command is out (`:181`); the tile head carries `aria-busy` (`:213`, see finding F63-2) |
| The menu | `devices-panel.tsx:157-205` (`DeviceMenu`) | The kit's `Dropdown` and `Button` as before; `isPending` with the kit's `Spinner` in place of the icon after the reveal time (`:173-176`), as `features/login/auth-card.tsx:365-370` does. The DEVICE_MANAGE gate (S20) is unchanged |

In Simulated mode `settle` runs `ok` or `fail` and `done` before it returns ([CS:§2.5 CL-25]), so `busy`
goes true and false inside one press: the look never changes, and the outcome (toast, words, synchronous
audit row) is the predecessor's. Three control tests pin that (section 4.2).

### 2.2 The page's own record (`apps/core-web/src/features/dashboard/report.ts`, new)

`reportDashboardError(source, error, message, context)` (`report.ts:39-58`) writes one record of level
`error` to `webErrorSink` of `@/runtime`: in memory in every build, printed to the console in a dev build,
never sent and never stored ([CS] runtime decisions D3, D4, D41(g): the console has no client-log endpoint).
Discipline of CPW1-8 / D144(1), as `components/shell/shell-report.ts`: the message is the caller's fixed
sentence; the cause is named by `errorName`, `code` and `status`; a correlation ID `dash-<time>-<n>`
(`report.ts:30-33`, `:55`). No secret can reach it: the context holds a device ID and a command name.

### 2.3 The sealed hash (`sim-adapter.ts`, `active-session-panel.tsx`)

`manifestSuffixKey(source, mode)` (`apps/core-web/src/features/dashboard/sim-adapter.ts:66-71`) decides the
suffix after "Manifest hash": none for a package digest in either mode; "SIMULATED" in Simulated mode (as
before); **"NO MEDIA PACKAGE"** in Live mode, because a session recorded on the Core server has no media and
joins no package (01_specs §11, the last row of the media table) and a Live screen never says "simulated"
([CS:§3.2]). Used at `active-session-panel.tsx:338` and `:365`.

### 2.4 The panel error boundary (`panel-boundary.tsx`)

`componentDidCatch` (`apps/core-web/src/features/dashboard/panel-boundary.tsx:45-52`) now writes its record
through `reportDashboardError` instead of a dev-only `console.error` with the error's text and stack. Why:
the mandatory error-logging rule (every error path to the persistent log) and CPW1-8 (no error text in a
record). The fallback UI and its rate-limited retry are untouched.

### 2.5 Words (`packages/shared/src/i18n/en/dashboard.ts`, additive)

`dashboard.devices.live.{testSignal, restart, testSignalSent, restartSent}` (`dashboard.ts:158-163`) and
`dashboard.activeSession.sealed.noPackage` (`dashboard.ts:133`). No key was changed or removed:
`git diff acaff20 -- packages/shared/src/i18n/en/dashboard.ts | grep -c "^-[^-]"` prints `0`.

### 2.6 Tests (new)

| File | Tests | What |
|---|---:|---|
| `apps/core-web/src/test/live-dashboard-devices.test.tsx` | 13 | Site B-7 on the fake transport (section 4.1) and the Simulated control group (section 4.2) |
| `apps/core-web/src/test/live-dashboard-page.test.tsx` | 11 | The page on the Core's data, a delta, the sealed hash (both cases), the words, the static rules of the folder, the boundary's record |

Both carry the page address `http://127.0.0.1:5178/` in the docblock, call `clearToasts()` after each test and
query toasts inside `[data-slot="toast"]` [CP:§8 rule 5]. Health comes from the bed (no global-`fetch` stub,
rule 5 as amended in section 30). The 403 of operation 48 is named by its example:
`bed.fake.example('restartDevice', 403, 'notPermitted')` (`live-dashboard-devices.test.tsx:178`).

## 3. What the Dashboard reads in Live mode, panel by panel

Every panel reads through `useSim(selector)` on the source in `SimContext`, which in Live mode is the Live
source's replica ([CS:§2.3]; group G5 of [CS:§7.3] lists the slices). Each panel was read for a value the
Core does not provide:

| Panel | Source in Live mode | Gap? |
|---|---|---|
| A ring, B hero copy, C status strip | `session`, `services`, `health`, `faults`, `cameras`, `mics`, `storage`, `time`, `security`, `network` (replicated) | None |
| D active session | `session`, `operators`, `evidence` (replicated); the manifest suffix by mode (2.3) | None |
| E devices | `cameras`, `mics` (replicated), `meters` (streamed); the camera picture is the bundled loop | Not a gap: 01_specs §11 MS-1 decides that the clients keep the bundled camera loops and the server supplies the camera state only; the loop's frames carry a burnt-in DEMO line (`devices-panel.tsx:258` comment). Listed as F63-5 for the controller |
| F storage, G security/time/network, H sealed today, I recent events | `storage`, `evidence`, `security`, `time`, `network`, `alerts`, `events`, the Live clock | None |
| J quick actions | the role of the replica's operator | None |
| B hero photo | a bundled still image, decoration | None (no data) |

## 4. Live tests of site B-7 (CLG (b))

### 4.1 On the fake transport (`live-dashboard-devices.test.tsx`)

| Test (line) | Covers | Asserted |
|---|---|---|
| `:136` Restart success | B-7 success, LB-3, CL-16, §3.2 | one `POST /api/v1/device/CAM-01/restart`; menu closed at the press; toast "Camera 1 restart requested" after the answer; the delta of the answer's revision already on the tile ("No signal"); Live menu words without "(simulated)"; no missing i18n key |
| `:163` Test signal success | B-7 success | one `POST /api/v1/device/MIC-01/test-signal`; toast "Test signal sent to MIC 1" |
| `:176` 403 `notPermitted` | AC-C-48, LB-5 | denied toast "Not permitted" + "Requires the Technician role"; one danger toast; no success or friendly toast; idle again; the menu offers the command again; no page record (the presenter worded it) |
| `:196` 403 of operation 49 | AC-C-48 | "Requires the Investigator role" (the first role holding DIAGNOSTICS_RUN); envelope written by hand (CONTRACT-GAP-W63-1) |
| `:207` 409 `RECORDING_ACTIVE` | B-7 | friendly toast; no denied or outage toast; one record: fixed message, `deviceId`, `command`, `errorName: SimTransitionError`, `code: RECORDING_ACTIVE`, correlation ID |
| `:223` 409 `COMMAND_UNSUPPORTED` | B-7 | friendly toast; record code `COMMAND_UNSUPPORTED` |
| `:234` outage of the request | LB-6 | "Core server unreachable. Nothing was changed."; no success toast; idle; no page record |
| `:246` link down | CL-22, AC-C-59 shape | five presses, one toast, **no request** |
| `:261` 429 | LB-10 | "…Try again in 12 s."; no outage sentence; link ONLINE; indicator without OFFLINE |
| `:274` pending | LB-1 | `aria-busy` at once and no spinner; both commands disabled; a second press sends nothing; spinner (`data-pending`, icon gone) after the reveal time; toast only after `held.release()`; idle and no element added afterwards |

### 4.2 Simulated control group (same file)

| Test (line) | Asserted |
|---|---|
| `:361` TECHNICIAN restart | menu words "Restart (simulated)", "Test signal (simulated)"; the simulator's `DEVICE_COMMAND` audit row exists right after the press (synchronous); toast "Camera 1 restart requested (simulated)"; never busy, never pending |
| `:376` INVESTIGATOR | both commands disabled with "Requires the Technician role" |
| `:386` restart while recording | the friendly toast, no success toast |

## 5. Live check on lane 3 (CLG (d))

W50's lane, lock and ports, through W55's script with three changes (paths, step 4, two log greps):
`/usr/bin/lockf -k -t 60 .locks/core-server.lane3.lock /bin/sh .cache/w63/lane/run_lane.sh` (sandbox bypass for
port binding and the browser). Backend `127.0.0.1:4423` on `dems_lane_3` (not reset; demo flag off), Vite
`127.0.0.1:5178`, HeadlessChrome/153.0.8010.12 over CDP at 1920×1080. Scripts: `assets/63_lane_run_lane.sh.txt`,
`assets/63_lane_cdp_driver.mjs.txt`. Logs: `assets/63_lane_run_1.log`, `assets/63_lane_run_2_simulated.log`;
browser records `assets/63_lane_browser_1.json`, `assets/63_lane_browser_2_simulated.json`.

| Run | Time (WIB) | What |
|---|---|---|
| 1 | 22:28:52 – 22:30:11 (79 s) | Live: SUPERVISOR and TECHNICIAN, site B-7 through the UI |
| 2 | 22:31:07 – 22:31:10 (3 s) | aborted at its first page script (the tab was at `about:blank`; driver fixed); nothing in `dems_lane_3` changed (run 1's "after" equals run 3's "before", `diff` empty) |
| 3 | 22:31:35 – 22:31:55 (20 s) | Simulated only (`W63_STEPS=simulated`) |

What the browser did (from the records):

| Step | Observed | Screenshot |
|---|---|---|
| Login page | `data-core-mode="LIVE"` | |
| Seeded SUPERVISOR through the form | `POST /api/v1/auth/sign-in` 200; ONE socket `ws://127.0.0.1:5178/ws` 101 with the cookie; frames `hello`, `snapshot`, `delta`, `heartbeat`, `meters`; all ten panels; indicator `LIVE`; strip "2 Cameras: Ready", "Storage: 3.2 TB Free", …; four tiles READY; six recent events; sealed today `0` (the Core's day); **no word of the page says "simulated"** (`saysSimulated: false`); no console error or warning | `63_dashboard_live_supervisor.png` |
| Camera 1 kebab as SUPERVISOR | "Details"; "Test signal" and "Restart" disabled, each with "Requires the Technician role" (Live words) | `63_dashboard_live_menu_supervisor.png` |
| The Core's answer to this SUPERVISOR for operation 48 (a page request, the UI does not offer it) | `403`, `NOT_PERMITTED`, `details.permission: DEVICE_MANAGE` — the shape the test's `notPermitted` example carries | |
| Sign-out (204), seeded TECHNICIAN through the form | sign-in 200; new socket with the cookie; "Account menu: Rina Wijaya" | |
| B-7: MIC 1 → Test signal | items enabled with Live words; `POST /api/v1/device/MIC-01/test-signal` **204**; toast "Test signal sent to MIC 1" | `63_dashboard_live_test_signal.png` |
| B-7: Camera 2 → Restart | `POST /api/v1/device/CAM-02/restart` **204**; toast "Camera 2 restart requested"; the tile READY at +0.6 s and +4 s (the engine's RESTART writes an audit row and changes no device state, `packages/shared/src/sim/maintenance.ts:191-225`); no console error, so no `live.misuse` report ([44_live_source §17.4 row 18]) | `63_dashboard_live_restart.png` |
| Simulated (stored `SIMULATED`) | login `data-core-mode="SIMULATED"`; Sign In disabled because mock-core 4400 is offline (F63-3), so the simulator's own stored sign-in `dems.auth` (operator ID and time, no credential) was used; Dashboard with indicator `SIMULATED`, the simulator's dataset (sealed today `7`), menu "Test signal (simulated)", "Restart (simulated)"; **0 requests to `/api/v1`, 0 sockets to `ws://127.0.0.1:5178/ws`** (only mock-core attempts at 4400, as W50 recorded) | `63_dashboard_simulated.png`, `63_dashboard_simulated_menu.png`; run 1's login page: `63_simulated_login_mock_core_offline.png` |

The lane database, before and after run 1 (`npm run db:status -w @dems/core-server -- --database dems_lane_3`):
audit head seq 108 → 115 (two sign-ins, two sign-outs, one ACCESS_DENIED, two DEVICE_COMMAND), `auth_sessions`
10 → 12 (both ended), `events` 81 → 86, `health_snapshots` 0 → 1. Run 3 changed nothing. The backend's log had
0 lines of level error or fatal in each run; its route lines: `/api/v1/device/:id/restart` 204 ×1 and 403 ×1,
`/api/v1/device/:id/test-signal` 204 ×1.

Stop, quoted from `63_lane_run_2_simulated.log` (the same in run 1):

```
== 22:31:54 stop what this check started
chrome stopped
vite: npm exit status 143
backend: npm exit status 0
== 22:31:55 listeners left on 4423, 5178, 9398 (expect none):
lsof exit 1 (1 with no output: no listener)
```

At 22:41 `lsof -nP -iTCP:4423 -iTCP:5178 -iTCP:9398 -sTCP:LISTEN` printed nothing (`lsof exit 1`). Ports
4432 (used by the backend only), 5432, 5173 to 5175, 4400, 4421/5176 and 4422/5177 were not touched.

## 6. Verification (commands and the last lines of their output)

### 6.1 Suites, typecheck, lint

`uptime` before each whole suite: 22:32 load 4.25; 22:34 load 6.03; 22:39 load 3.37 (all below 10).

```
$ npm run test -w @dems/core-web -- --maxWorkers=2       (22:32:26 WIB, first run)
 FAIL  src/test/live-session-new-create.test.tsx > A3 createSession (awaited, CL-26) > success: …
 FAIL  src/test/live-session-new-create.test.tsx > D-2 cancel, then createSession … (3 more)
 Test Files  1 failed | 58 passed (59)
      Tests  4 failed | 810 passed (814)
```
The red file is W64's (new, untracked, under construction at that time; owner W64, lane 1) — not this row's.
Re-run once, as the brief asks:

```
$ npm run test -w @dems/core-web -- --maxWorkers=2       (22:39:46 WIB, final run)
 Test Files  62 passed (62)
      Tests  849 passed (849)
   Duration  87.40s
core-web suite exit=0
  per file (JSON report): live-dashboard-devices 13/13, live-dashboard-page 11/11,
  features/dashboard/__tests__/dashboard-model 15/15, features/dashboard/__tests__/dashboard 16/16

$ npm run test -w @dems/shared -- --maxWorkers=2         (22:34:00 WIB)
 Test Files  68 passed (68)
      Tests  1814 passed (1814)
shared suite exit=0

$ npm run typecheck -w @dems/core-web    > tsc -b     exit=0   (22:41:23)
$ npm run lint -w @dems/core-web         > oxlint     exit=0   (no warning printed)
$ npm run typecheck -w @dems/shared      exit=0
$ npm run lint -w @dems/shared           exit=0
```
The whole gate output is `assets/63_gate.log`.

### 6.2 CLG (a)

```
$ git diff --stat acaff20 -- apps/core-web/src/features/dashboard/__tests__
 .../src/features/dashboard/__tests__/dashboard.test.tsx     | 13 ++++++++++++-
 1 file changed, 12 insertions(+), 1 deletion(-)
$ git diff --stat acaff20 -- apps/core-web/src/features/dashboard/__tests__/dashboard-model.test.tsx | wc -l
       0
$ git hash-object apps/core-web/src/features/dashboard/__tests__/dashboard.test.tsx
1ab07579e928b9b545003899ec3265d4b8b6c762          (W01b's state, decision D31)
$ git diff --stat b90a3c6 -- apps/core-web/src/features/dashboard/__tests__ | wc -l
       0
```
The one file in the diff is the W01b file, compared with its recorded hash as the plan's "W01's state" rule
directs (D31 adds this file to that rule). Both files pass before (20:28:34, `2 passed`, `31 passed`) and
after (final run above).

### 6.3 CLG (c)

```
$ grep -rn --include='*.ts' --include='*.tsx' -e useSimActions -e '\.actions\b' apps/core-web/src/features/dashboard --exclude-dir=__tests__ | grep -v 'common\.actions\.'
grep exit=1 (1 = nothing found)
$ grep -n 'useCoreActions()\|settle(() => actions.deviceCommand' apps/core-web/src/features/dashboard/devices-panel.tsx
113:  const actions = useCoreActions()
132:      settle(() => actions.deviceCommand(deviceId, command), {
```
The static test `live-dashboard-page.test.tsx:205` holds the same rule, plus: exactly one
`actions.deviceCommand(` and it stands in `settle(() => …)`; the presenter speaks first; no `SimContext`, no
`live.source`; `:221` no typed client, Live source, socket or test double; `:229` no `console.*` in the folder.

### 6.4 Write paths and protected paths

```
$ git status --short -- apps/core-web/src/features/dashboard packages/shared/src/i18n/en/dashboard.ts 'apps/core-web/src/test/live-dashboard-*'
 M apps/core-web/src/features/dashboard/active-session-panel.tsx
 M apps/core-web/src/features/dashboard/devices-panel.tsx
 M apps/core-web/src/features/dashboard/panel-boundary.tsx
 M apps/core-web/src/features/dashboard/sim-adapter.ts
 M packages/shared/src/i18n/en/dashboard.ts
?? apps/core-web/src/features/dashboard/report.ts
?? apps/core-web/src/test/live-dashboard-devices.test.tsx
?? apps/core-web/src/test/live-dashboard-page.test.tsx
$ git status --short -- apps/core-web/src/runtime apps/core-web/src/lib apps/core-web/src/components/shell apps/core-web/src/routes apps/core-web/vite.config.ts apps/core-web/src/test/routes.test.tsx apps/core-web/src/test/sim-fetch.test.ts apps/core-web/src/features/storage/__tests__/storage-page.test.tsx
(no output)
```
A `grep -l` of the demo password over every `63_*` asset and the lane's output files found none (exit 1).

## 7. Mutation check (M15)

W55's pattern (`implementation/assets/55_mutations*`): one text replacement in one module, applied in memory by a
Vite transform plugin; a marker under `$TMPDIR` proves it ran. Runner `assets/63_mutations_runner.py.txt`,
config `assets/63_mutations_config.mts.txt`, log `assets/63_mutations.log`.

```
## 2026-10-05 22:35:59 WIB baseline: the two test files of the row, no mutation
baseline exit=0 Test Files  2 passed (2) | Tests  24 passed (24) (4.7 s)
…
P14 SURVIVED    exit=0 devices-panel.tsx: the in-flight flag is dropped (the disabled items still block a second press)
…
## 2026-10-05 22:39:29 WIB 21 mutations: 20 detected, 1 survived ['P14'], 0 not applied []
```

Detected: the presenter skipped (P01), an optimistic success toast (P02), commands enabled while out (P03),
Simulated words in Live toasts or menu (P04, P05), never busy (P06), spinner never or at once (P07, P08), no
return to idle (P09), no page record (P10), the DEVICE_MANAGE gate dropped (P11), no `aria-busy` (P12), the
commands swapped (P13), the Live hash suffix (S01, S02, A01), the record's correlation ID, text and code (R01
to R03), the boundary's record (B01). **P14 is equivalent**: with the items disabled while busy (`:181`) a
second `onAction` cannot arrive; the ref (`:128`) is a second line for a press that might land before the
re-render, which jsdom cannot produce. Kept on purpose.

The tree was not changed by the run: the snapshot of `git status --porcelain` plus the SHA-256 of the
folder's files, the two test files and `apps/core-web/src/routeTree.gen.ts`, taken before and after, differ
only by `?? docs/…/gateway_check/09a_m0_link_rule.md`, a file another agent created meanwhile.

## 8. Contract gaps found

| ID | Where | What | Effect here |
|---|---|---|---|
| **CONTRACT-GAP-W63-1** | `packages/shared/src/api/devices.ts:327-328` (examples of `testDeviceSignal`) | Operation 49 declares `403: notPermitted(DIAGNOSTICS_RUN)` (`devices.ts:176`) but has no `notPermitted` example — only `deviceRevoked` and `originNotAllowed`, because every seeded role holds DIAGNOSTICS_RUN. A test cannot name the refusal by its example as rule 5 asks | The test builds the envelope with the fake's `refusal(403, 'NOT_PERMITTED', …, { permission: 'DIAGNOSTICS_RUN' })` (`live-dashboard-devices.test.tsx:199`). Behaviour is defined; only the example is missing. For W83 |

No data gap: every value the Dashboard shows in Live mode comes from the replica (section 3). The bundled
camera loops are a decision of the specification, not a gap (F63-5).

## 9. Findings

| # | Finding | Evidence | For |
|---|---|---|---|
| F63-1 | The Dashboard gates **Test signal** on DEVICE_MANAGE (S20), while operation 49 and the simulator's own transition need DIAGNOSTICS_RUN, which every role holds. The UI is stricter than the Core in both modes; the seeded SUPERVISOR cannot press Test signal on the Dashboard although the Core would accept it (the lane's 204 for the TECHNICIAN; ROLE_PERMISSIONS in `packages/shared/src/sim/auth.ts:53-71`; `maintenance.ts:205-207`) | `devices-panel.tsx:43`, `:181` | controller (decision 1) |
| F63-2 | The kit's `Button` does not pass `aria-busy` on (a scratch render showed only `data-*` and labelling attributes reaching the `<button>`; the scratch file was removed). LB-1's "the control is marked `aria-busy`" is met on the tile head, the region the command changes (`devices-panel.tsx:213`). Every later row with LB-1 will meet the same | probe output in this session | page rows W64 to W82 |
| F63-3 | On a lane, Simulated mode cannot sign in through the form: Sign In needs mock-core (4400), which lanes must not start (`apps/core-web/src/features/login/login-model.ts:61`). A Simulated screenshot of a signed-in page needs the simulator's stored sign-in `dems.auth` | run 1 and run 3 records | later rows' live checks |
| F63-4 | The Core's audit message of a restart says "(simulated)" (`packages/shared/src/sim/maintenance.ts:225`, "`${name} restarted (simulated)`"). The Dashboard does not show audit messages, but the Security & Audit page in Live mode may, which would put "simulated" on a Live screen | source | W75 / W83 |
| F63-5 | Panel E's camera picture in Live mode is the bundled loop by decision MS-1 (01_specs §11: "Live camera loops — bundled — the server's part: camera state only"); the frames carry a burnt-in DEMO line. Nothing on the page claims a live picture, but nothing says in words that the picture is not the Core's either | 01_specs §11; `devices-panel.tsx:258` | controller (decision 2) |
| F63-6 | On the lane the ring said ATTENTION (1 issue) while panel G said "All systems secure"; this is the Core's state, shown as the Simulated page shows the same slices. Cause not examined (hypothesis: a flag from the tablet link, which is offline on a lane) | screenshots `63_dashboard_live_*` | none (stated) |
| F63-7 | W64's `apps/core-web/src/test/live-session-new-create.test.tsx` was red at 22:33:48 (4 tests); green in the final run at 22:41:14 | section 6.1 | W64 (stated) |

## 10. Deviations

| # | Deviation | Why |
|---|---|---|
| DV-1 | The lane check signed in as the seeded **TECHNICIAN** too (the brief names the SUPERVISOR), by the same seed constants and the same form | The SUPERVISOR lacks DEVICE_MANAGE, so neither B-7 command can be pressed through the UI as that role; without the TECHNICIAN the site would not have run against the real Core. One page request as the SUPERVISOR (`POST …/CAM-01/restart` → 403) shows the Core's refusal; it wrote one ACCESS_DENIED row |
| DV-2 | The Simulated screenshot used the simulator's stored sign-in `dems.auth`, not the form | F63-3 |
| DV-3 | `aria-busy` is on the tile head, not on the trigger | F63-2 |
| DV-4 | Files beyond the one call-site file of [CS:§7.3] G5 (`devices-panel.tsx`): `active-session-panel.tsx` and `sim-adapter.ts` (the "SIMULATED" suffix, [CS:§3.2]), `panel-boundary.tsx` (error logging), `report.ts` (new) | All inside the row's write path; none changes the Simulated look |
| DV-5 | In Simulated mode a `SimPermissionError` from the kebab would now show the denied toast instead of "The command could not be sent" (presenter first, [CP:§8 rule 2]) | Unreachable: the items are disabled without DEVICE_MANAGE, and Test signal's DIAGNOSTICS_RUN is held by every role |
| DV-6 | The panel boundary's dev-console entry changed shape (now the sink's record: fixed sentence, error class, panel, attempt, component stack; no error text, no stack) | Error-logging rule and CPW1-8 |
| DV-7 | Lane run 2 aborted after 3 s (driver bug); run 3 repeated only the Simulated step | Nothing changed in `dems_lane_3` (section 5) |
| Resume | The stream stalled at about 20:40; at 22:23 the tree was checked: the four edited files were complete (no half edit), typecheck exit 0, the protected test byte-equal to `b90a3c6` | controller's message |

## 11. Decisions for the controller

1. **F63-1**: keep Test signal behind DEVICE_MANAGE on the Dashboard (S20, unchanged in both modes, the default
   of this row), or open it to DIAGNOSTICS_RUN in both modes (a predecessor behaviour change; it would also
   apply to `features/devices`, W70).
2. **F63-5**: accept the bundled camera loops on the Live Dashboard as MS-1 decides (default), or ask for a
   plain caption in Live mode (a change to the shared `CameraFeed` or to the tile, not done here).
3. Record **CONTRACT-GAP-W63-1** for W83 (a `notPermitted` example for operation 49, or a stated exemption).
4. Record DV-1 (the TECHNICIAN sign-in on the lane) as accepted for page rows whose commands the SUPERVISOR
   cannot press.
5. Note F63-2 and F63-3 for the briefs of the remaining page rows.

## 12. Rollback (not executed)

Class R-CO for the tracked files and R-NEW for the new ones (plan section 11):

```
git checkout acaff20 -- apps/core-web/src/features/dashboard/active-session-panel.tsx \
  apps/core-web/src/features/dashboard/devices-panel.tsx apps/core-web/src/features/dashboard/sim-adapter.ts \
  apps/core-web/src/features/dashboard/panel-boundary.tsx packages/shared/src/i18n/en/dashboard.ts
git clean -f -- apps/core-web/src/features/dashboard/report.ts \
  apps/core-web/src/test/live-dashboard-devices.test.tsx apps/core-web/src/test/live-dashboard-page.test.tsx
```

Pre-images of the five edited files are in `.cache/rollback/W63/` (SHA-256: `devices-panel.tsx` `bf067819…`,
`active-session-panel.tsx` `0b4ba579…`, `sim-adapter.ts` `b1871690…`, `panel-boundary.tsx` `a9333528…`,
`dashboard.ts` `2b77e489…`); each equals its blob at `acaff20`/`b90a3c6` (none was changed by an earlier row).
`dashboard.test.tsx` is not part of the rollback: it was never touched and keeps W01b's state. The lane rows
the check added (section 5) are not rolled back (the lane database is not reset by rows).

## 13. Files of this row

| File | Change |
|---|---|
| `apps/core-web/src/features/dashboard/devices-panel.tsx` | modified (site B-7) |
| `apps/core-web/src/features/dashboard/active-session-panel.tsx` | modified (hash suffix) |
| `apps/core-web/src/features/dashboard/sim-adapter.ts` | modified (`manifestSuffixKey`) |
| `apps/core-web/src/features/dashboard/panel-boundary.tsx` | modified (record to the sink) |
| `apps/core-web/src/features/dashboard/report.ts` | new |
| `packages/shared/src/i18n/en/dashboard.ts` | modified, additive |
| `apps/core-web/src/test/live-dashboard-devices.test.tsx` | new |
| `apps/core-web/src/test/live-dashboard-page.test.tsx` | new |
| `docs/…/implementation/63_web_dashboard.md` | this file |
| `docs/…/implementation/assets/63_*` (6 screenshots + `63_simulated_login_mock_core_offline.png`, 2 run logs, 2 browser records, lane script and driver, gate log, mutation log, runner, config) | new |
| `docs/…/delegation_progress/coder_execution_step_85.md` | progress file |

---
*Generated: 2026-10-05 22:45 WIB*
