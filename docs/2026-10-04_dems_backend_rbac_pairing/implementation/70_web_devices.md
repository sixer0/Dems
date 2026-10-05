---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: W70 (plan step 92, provisional row 70)
agent: coder-execution
date: 2026-10-05
source_plan: masterplan/02_plan.md (row W70; gate CLG of section 11)
status: complete
---

# W70 — Web Devices & Inputs in Live mode (settle sites B-7, B-8, D-5; the "Paired devices" row of note G6)

Tier 2 record: what was built, why, and how it was verified. Code is cited as `path:line` relative to the
repository root; `[CS:…]` is `masterplan/04_client_integration_spec.md`; `[CP:§8 rule n]` is
`gateway_check/08_cp_web_runtime.md` section 8 with the amendments of its section 30; `[D152]` is the
controller note of the gated Dashboard row W63 received during this run. No credential value appears in
this file or in the assets: the lane driver reads the demo password from the seed source and never prints
it (a byte scan of every `70_*` asset and the lane's output files for it found none, section 5.4).

## 1. Result

| Gate item | Result | Evidence |
|---|---|---|
| SG: typecheck and lint of `@dems/core-web` | exit 0, exit 0 (23:26:55) | section 6.1 |
| SG: typecheck and lint of `@dems/shared` (the additive i18n file) | exit 0, exit 0 (23:03) | section 6.1 |
| SG: `@dems/core-web` suite | **71 files / 958 tests, exit 0** (23:27:40 – 23:29:40), above the floor 62 / 853 of [D152] | section 6.1 |
| SG: `@dems/shared` suite | **68 files / 1,814 tests, exit 0** (23:02:44 – 23:03:01), at the ledger | section 6.1 |
| CLG (a) the folder's existing tests pass and are unchanged | `features/devices/__tests__/devices-page.test.tsx` absent from `git diff --stat acaff20` (blob `9c7a7552…` equals `acaff20`'s), 17 / 17 pass | section 6.2 |
| CLG (b) one Live test per named settle site: success, the site's refusal with the denied toast, an outage, the 409 answers | B-7: 2 success, 4 refusal (403 by the named `notPermitted` example, a 403 of operation 49, 409 `RECORDING_ACTIVE`, 409 `COMMAND_UNSUPPORTED`), 3 outage/limit, 2 pending. D-5: success, 403, outage. B-8: 2 success, 3 refusal, 3 outage/limit, 1 pending. G6: 5 with `PAIRING_MANAGE`, 2 without, 4 refused/failed reads, 1 words. Simulated control groups: 3 + 1 + 1 | section 4 |
| CLG (c) no `useSimActions`, no `.actions` read on a `Sim` in the folder's production files | grep finds none | section 6.3 |
| CLG (d) one live check of at most 10 minutes | lane 3, 23:06:58 – 23:08:07 (69 s), 8 screenshots, ports free afterwards | section 5 |
| Mutation check (M15, scratch copy under `$TMPDIR`) | 25 mutations: 24 detected, 1 survived (G1, equivalent through the UI) | section 7 |

## 2. What was built

### 2.1 Sites B-7 and D-5: the kebab commands (`apps/core-web/src/features/devices/index.tsx`)

* The page takes its actions from `useCoreActions()` (`index.tsx:79`) and settles every command with
  `settle` (`index.tsx:120`) [CP:§8 rule 1]; `useSimActions` is gone from the folder.
* `details` opens the drawer and sends nothing (`index.tsx:110-113`). The three commands map through
  `DEVICE_COMMAND_OF` (`features/devices/live.ts:49-53`).
* **LB-1, busy at once.** A ref set of in-flight devices refuses a second command for the same device
  before anything is sent (`index.tsx:115-118`); the state set `pending` drives the look and is set only
  when the command did not settle in the press (`index.tsx:150`), so Simulated mode never changes state
  for it. `done` clears both (`index.tsx:143-147`). The set travels in `DeviceActionsContext`
  (`context.ts:12-30`, `useDevicePending`).
* **Outcome in `ok`** (`index.tsx:121-134`): the Identify blink and its info toast (D-5: "the local state
  is set in `ok`" [CS:§8.4 D-5]), the Test signal and Restart toasts. In Live mode `ok` runs after the
  delta of the answer's revision has been applied (CL-16), so the page already shows the Core's state.
* **Failure** (`index.tsx:136-142`): the refusal presenter first [CP:§8 rule 2] — a 403 names the role, an
  outage, a time-out and a 429 have the presenter's words (LB-6, LB-7, LB-10). What it leaves to the page
  (409 `RECORDING_ACTIVE` / `COMMAND_UNSUPPORTED`, rebuilt as `SimTransitionError` [CS:§8.3 B-7]) keeps
  the predecessor's friendly toast `devices.actions.failed` and writes one record (section 2.4).
* **The menu** (`device-menu.tsx`): while its device is pending the three command items are disabled and
  Details stays (`device-menu.tsx:51`); after `LIVE_PENDING_REVEAL_MS`, scaled by the motion policy, the
  kit's `Spinner` replaces the kebab icon (`device-menu.tsx:40`, `:55-72`; `live.ts:61-74`). The pending
  props are passed only while the spinner shows (`device-menu.tsx:63`), so the Simulated trigger renders
  exactly as before.
* **The busy mark** sits on the nearest container, the tile head (`camera-tile.tsx:56`,
  `audio-input-card.tsx:100`), because the kit's `Button` drops `aria-busy` (F63-2 [D152]). It is
  `undefined` (absent) whenever nothing is pending.

### 2.2 Site B-8: the clip-latch reset (`apps/core-web/src/features/devices/audio-input-card.tsx`)

`useCoreActions()` (`:51`) and `settle` (`:73`). The CLIP latch and the reset button leave when the Core's
delta arrives — before `ok`, by CL-16 — and the success toast follows (`:74-76`) [CS:§8.3 B-8]. LB-1: a
ref refuses a second press (`:70-71`), the clip fact carries `aria-busy` while the reset is out (`:160`),
and the spinner replaces the button's icon after the reveal time (`:58`, `:170-172`). Failure: presenter
first, then the existing toast and one record (`:77-81`).

### 2.3 The "Paired devices" row of the drawer (note G6; `apps/core-web/src/features/devices/device-drawer.tsx`)

* In Simulated mode the tablet's Overview keeps its "Pairing" row from `s.pairing.state`; in Live mode the
  row is titled "Paired devices" (`device-drawer.tsx:295-316`) [CS:§7.3 note G6].
* A holder of `PAIRING_MANAGE` (the server's hint, `useCorePermission`, which follows `session.updated`)
  sees `PairedDevicesSummary` (`:341-344`, `:368-444`): operation 19 through `useWebLive().client.call`
  (`:381`), held under `CORE_QUERY_KEYS.pairedDevices` as the operation's own `PairedDeviceList` answer
  (`:377`) [CP:§8 rule 3], so the query bridge refetches it on `admin.changed` DEVICES and on a resync
  and removes it on a session end or a lost permission. "n paired, m online" counts PAIRED devices and,
  of them, the online ones (`:404-405`), with a router `Link` to `/admin/devices` (`:409-412`). The
  Paired Devices page itself is row W81's and was not built.
* Every other operator sees "A paired device is connected" / "No paired device is connected" from the
  replicated `tabletLink` (`:346-353`); no request is sent.
* The registry is read only while the link is ONLINE (`:378`): with the link down the row shows the
  tablet sentence, and the shell says that the Core is unreachable [CP:§8 rule 6].
* A failed read goes to the presenter with `PAIRING_MANAGE` as the operation's permission (`:384`); what
  it leaves to the page writes one `warn` record. The row then falls back to the tablet sentence, names
  the registry's absence and offers a Retry on the shared cooldown (`useRetryCooldown`, 3 s → 6 s → 12 s,
  at most 3; `:399-401`, `:416-427`).
* CONTRACT-GAP-W70-1 (section 8): a change of the replicated tablet link invalidates the query
  (`:392-397`), because the Core publishes no `admin.changed` DEVICES when a paired device comes or goes.

### 2.4 The page's own record (`apps/core-web/src/features/devices/report.ts`, new)

`reportDevicesError(source, error, message, context, level)` writes one record to `webErrorSink` (in memory,
printed in a dev build, never sent anywhere — the console has no client-log endpoint, D3/D4/D41(g)).
The discipline of `components/shell/shell-report.ts` and `features/login/report.ts` (CPW1-8, D144(1)):
the message is the caller's fixed sentence, the cause is named by class, code and status, `context` holds
device IDs, command names, a channel or an operation ID, and every record carries a correlation ID
`dev-<time>-<n>`. It replaces the dev-console `logDevicesError` on the two command paths;
`logDevicesError` stays for the panel error boundary (`panel.tsx:93`), which this row did not touch.

### 2.5 Words (§3.2) and `live.ts`

`features/devices/live.ts` (new) holds `DEVICE_WORDS`: the six keys that say "simulated" in Simulated mode
(`common.deviceMenu.testSignal`, `.restart`, `devices.actions.testSignalSent`, `.restarted`,
`devices.front.lcdLabel`, `devices.drawer.health.samples`) and their Live twins (`live.ts:22-39`). They
are read by the menu (`device-menu.tsx:86-99`), the toasts (`index.tsx:129`, `:132`), the drawer's Log
(`device-drawer.tsx:526`), the Health caption (`health-chart.tsx:134`) and the display's label
(`lcd-display.tsx:233`). Rule [CS:§3.2]: a Live screen shows the Core's data and never says "simulated";
W63 applied the same rule to the same commands on the Dashboard [D152].

`packages/shared/src/i18n/en/devices.ts:318-340` (additive, +34 lines, no existing key changed):
`devices.live.menu.*`, `devices.live.actions.*`, `lcdLabel`, `samples_one` / `samples_other`, and
`devices.live.pairedDevices.{label, summary, open, connected, none, loading, unavailable}`.
`devices.css` gains `.dev-facts-paired` and `.dev-facts-link` (focus ring on `--focus`).

### 2.6 Tests (new; `apps/core-web/src/test/`)

| File | Tests | What |
|---|--:|---|
| `live-devices-commands.test.tsx` | 17 | B-7, D-5, LB-1 on the fake transport; Simulated control group |
| `live-devices-clip.test.tsx` | 10 | B-8 on the fake transport; Simulated control group |
| `live-devices-drawer.test.tsx` | 13 | Note G6, the drawer's Live words; Simulated control group |

Each file has the page address `http://127.0.0.1:5178/` in its docblock, empties the kit's toast queue
between tests (`clearToasts()`), queries toasts under `[data-slot="toast"]`, and names a 403 by its
example where the contract has one [CP:§8 rule 5]. Health comes from the bed; no file stubs the global
`fetch` in Live mode (the Simulated control groups stub it, as the predecessor's tests do).

## 3. What the page reads in Live mode

Every panel reads the replica through the unchanged `useSim` selectors (cameras, mics, otherDevices,
ports, tabletLink, network, time, security, health, audit, faults, session, device) and the meters
through `useAudioChannel` [CS:§7.3 G6]. On the lane (section 5) the six panels rendered on the Core's
data: both cameras and microphones READY, the tablet OFFLINE (no paired device connected — F69), the
display label without "simulated", and no word of the page saying "simulated" (`saysSimulated: false`
in every Live step of `70_lane_browser_live.json`).

## 4. Live tests (CLG (b))

### 4.1 Sites B-7 and D-5 (`live-devices-commands.test.tsx`)

| Criterion | Test |
|---|---|
| B-7 success: one POST to operation 48 for the tile's device, the menu closed at the press, the toast after the delta (CL-16), no "simulated" | "Restart: one POST to operation 48 …" (asserts the tile's `data-status` moved to FAULT before the toast) |
| B-7 success: operation 49 | "Test signal: one POST to operation 49 …" |
| AC-C-48: 403 by the contract's `notPermitted` example names the Technician; idle again; no page record | "AC-C-48: a 403 NOT_PERMITTED …" |
| 403 of operation 49 names the Investigator (CONTRACT-GAP-W70-2: no example) | "a 403 NOT_PERMITTED of operation 49 …" |
| 409 `RECORDING_ACTIVE`: friendly toast, one record with code and class, no server text, no stack | "409 RECORDING_ACTIVE …" |
| 409 `COMMAND_UNSUPPORTED` | "409 COMMAND_UNSUPPORTED of operation 49 …" |
| Outage: presenter sentence, no success toast, idle, no page record | "a request that gets no answer …" |
| Link down: no request, five presses one toast (CL-22, coalescing) | "with the link down …" |
| LB-10: a 429 is a limit; the link stays ONLINE; the indicator does not say OFFLINE | "LB-10: a 429 …" |
| D-5: the ring and the info toast only after the answer of operation 50 | "the ring blinks only after the Core answered …" (held answer) |
| D-5: a 403 (permission from the access rule) shows the denied toast, no blink | "a 403 NOT_PERMITTED of operation 50 …" |
| D-5: an outage, no blink | "an outage shows the presenter's sentence and no blink" |
| LB-1: three commands disabled, Details enabled, second press sends nothing, head busy, only that device busy, spinner after the reveal, nothing added to the tile | "while a command is out …" |
| LB-1: an answer within the reveal time never shows the spinner | "a command answered within LIVE_PENDING_REVEAL_MS …" |
| Simulated: "(simulated)" words, synchronous audit row, no busy mark, no record | "a TECHNICIAN sees the simulated words …" |
| Simulated: Identify blinks in the press | "Identify blinks in the press, as before" |
| Simulated: Restart disabled while recording, with its reason | "while recording, Restart stays disabled …" |

### 4.2 Site B-8 (`live-devices-clip.test.tsx`)

| Criterion | Test |
|---|---|
| Success: one POST with `{ channel: 'AUDIO-01' }`, latch and button gone, card READY, toast | "one POST to operation 52 with the channel …" |
| CL-16: answer first, delta later — the button stays busy and no toast until the delta | "when the answer comes first …" |
| Refusal: 403 `FORBIDDEN` (operation 52 needs a session only) → the presenter's denied toast; latch stays; idle (a second press sends a second request) | "a 403 FORBIDDEN is worded by the presenter …" |
| Refusal: the contract's `originNotAllowed` 403 names the address to open (WT-2a) | "the contract's own 403 of a web console …" |
| A refusal the presenter leaves to the page (422): friendly toast, one record | "a refusal the presenter leaves to the page …" |
| Outage; link down (no request); LB-10 | three tests of "B-8 outage" |
| LB-1: second press sends nothing, fact busy, spinner late | "a second press while the reset is out …" |
| Simulated: cleared in the press, no busy mark | "the reset clears the latch in the press …" |

### 4.3 Note G6 and the drawer's words (`live-devices-drawer.test.tsx`)

| Criterion | Test |
|---|---|
| SUPERVISOR: "Paired devices", "1 paired, 1 online" from the contract's example, the link to `/admin/devices`, no "Pairing" row, one GET, the answer under `['core','paired-devices']` | "the row is titled …" |
| Counting: PAIRED only, online among them ("2 paired, 1 online" of three) | "counts only PAIRED devices …" |
| The link opens the Paired Devices page | "the link opens the Paired Devices page" |
| PG-6: `admin.changed` DEVICES refetches; the count follows | "PG-6: an `admin.changed` DEVICES …" |
| CONTRACT-GAP-W70-1: a tablet-link delta refetches | "CONTRACT-GAP-W70-1: …" |
| INVESTIGATOR: the connected / not connected sentence, no request | two tests |
| AC-C-48: 403 by the named example names the Supervisor; fallback with the tablet sentence and Retry; no page record | "AC-C-48: a 403 NOT_PERMITTED …" |
| Outage, then Retry reads again | "an outage shows the presenter's sentence; Retry …" |
| LB-10 | "LB-10: a 429 …" |
| Link down: no read, tablet sentence | "with the link down …" |
| §3.2: Health caption, display label and Log words without "simulated" in Live mode | "the Health caption, the display's label …" |
| Simulated: the "Pairing" row, the "(simulated)" display label, no registry request | "the tablet drawer shows the "Pairing" row …" |

## 5. Live check on lane 3 (CLG (d))

### 5.1 How

Lane 3 was free first (`try_lanes.sh` tries lane 3, then lane 1, each with `lockf -t 0` — it never waits on
a held lock and never starts a second backend; `70_lane_try_lanes.log`: "round 1: try the lock of lane 3 …
run_lane.sh exit 0"). The script is W63's copy of W50/W55's lane script with the lane number as its only
parameter (`70_lane_run_lane.sh.txt`); the driver is W63's helpers unchanged plus this row's steps, with
real mouse events for clicks (`70_lane_cdp_driver.mjs.txt`). Backend `127.0.0.1:4423` on `dems_lane_3`
(not reset; demo flag off), Vite `127.0.0.1:5178`, HeadlessChrome/153.0.8010.12 over CDP (devtools
`127.0.0.1:9373`) at 1920×1080. Sign-ins through the form with the project's seed constants. The
SUPERVISOR (Andi Pratama) for the page, the drawer and Identify; the TECHNICIAN (Rina Wijaya) for Test
signal and Restart, which only that role holds ([D152] ruling 4). Run with the per-command sandbox bypass
(port binding and the browser).

### 5.2 What it showed (`70_lane_browser_live.json`, `70_lane_browser_offline_simulated.json`)

| Step | Screenshot | Facts |
|---|---|---|
| Live, SUPERVISOR, Devices & Inputs | `70_devices_live_supervisor.png` | `shellMode: LIVE`; six panels; CAM/MIC READY, TABLET OFFLINE; `lcdLabel: "Local status display, page STATUS"`; `saysSimulated: false`; one socket `101`, 165 frames |
| Drawer of the tablet as SUPERVISOR | `70_drawer_paired_devices_supervisor.png` | row "Paired devices": "0 paired, 0 online", link `/admin/devices` "Open Paired Devices"; `GET /api/v1/pairing/devices 200` |
| D-5 Identify on Camera 1 (SUPERVISOR) | `70_devices_live_identify.png` | menu: Restart disabled "Requires the Technician role"; `POST /api/v1/device/CAM-01/identify 204`; ring `identify-CAM-01`; toast "Camera 1 is blinking its indicator" |
| The Core's answer to a SUPERVISOR restart (a page request; the UI does not offer it) | — | `403 NOT_PERMITTED`, `permission: DEVICE_MANAGE` |
| B-7 as TECHNICIAN: Test signal on MIC 1, Restart of Camera 2 | `70_devices_live_technician_restart.png` | `POST …/MIC-01/test-signal 204`, toast "Test signal sent to MIC 1"; `POST …/CAM-02/restart 204`, toast "Camera 2 restarted"; no "simulated" |
| Drawer of the tablet as TECHNICIAN (no `PAIRING_MANAGE`) | `70_drawer_paired_devices_technician.png` | "No paired device is connected"; no API request |
| The check stopped its own backend; Identify on Camera 1 | `70_devices_live_offline_command.png` | shell `LIVE · OFFLINE`; no request sent (CL-22); the presenter's toast "Core server unreachable. Nothing was changed." beside the shell's link toast; the Live source's own record `live.action.deviceCommand` … `CORE_OFFLINE` in the console |
| Simulated mode (stored choice; stored sign-in, F63-3) | `70_devices_simulated.png`, `70_drawer_pairing_simulated.png` | `shellMode: SIMULATED`; menu "Test signal (simulated)", "Restart (simulated)"; display label "(simulated)"; drawer row "Pairing: Paired"; **0 API requests and 0 sockets to the dev server** |

### 5.3 Stop and the lane database (quoted from `70_lane_run.log`)

```
== 23:08:05 6. lane database after the check
-- row counts that differ (before / after):
< audit head       seq 115; hash 16e5c25f27e2fafc...
> audit head       seq 122; hash c0be75227506191d...
<   audit_log                115
<   auth_sessions            12
>   audit_log                122
>   auth_sessions            14
<   events                   86
>   events                   89
-- the backend's log: lines       53; lines with level error or fatal: 0
   1 "route":"/api/v1/device/:id/identify","status":204
   1 "route":"/api/v1/device/:id/restart","status":204
   1 "route":"/api/v1/device/:id/restart","status":403
   1 "route":"/api/v1/device/:id/test-signal","status":204
   1 "route":"/api/v1/pairing/devices","status":200
== 23:08:06 stop what this check started
chrome stopped
vite: npm exit status 143
== 23:08:07 listeners left on 4423, 5178, 9373 (expect none):
lsof exit 1 (1 with no output: no listener)
```

Seven audit rows; by the request log (the rows themselves were not read): two sign-ins, one sign-out, three
`DEVICE_COMMAND`, one `ACCESS_DENIED` (the SUPERVISOR's page request). A later `lsof -nP -iTCP:4423 -iTCP:5178 -iTCP:9373 -sTCP:LISTEN` printed nothing (exit 1).

### 5.4 Secret scan

A Node scan that loads the seed's demo password and searches the bytes of every `70_*` asset and every file
of `.cache/w70/lane/out/`: `files scanned 22 files holding the demo password 0`.

## 6. Verification (commands and the last lines of their output)

### 6.1 Suites, typecheck, lint

Quoted from `assets/70_gate_final.log` (load average 8 to 9 at the start of each whole suite, below 10).

```
== 2026-10-05 23:26:55 WIB uptime: 23:26  2 users, load averages: 8.12 8.99 8.01
$ npm run typecheck -w @dems/core-web
> tsc -b
typecheck exit 0
$ npm run lint -w @dems/core-web
> oxlint
lint exit 0

$ npm run test -w @dems/core-web -- --maxWorkers=2
== start 23:27:40 23:27  2 users, load averages: 9.02 9.18 8.13
 Test Files  71 passed (71)
      Tests  958 passed (958)
   Start at  23:27:40
   Duration  119.10s (tests 73%, import 13%, environment 9%, setup 3%, transform 2%)
suite exit 0

$ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  68 passed (68)
      Tests  1814 passed (1814)
shared exit 0; npm run typecheck -w @dems/shared exit 0; npm run lint -w @dems/shared exit 0

$ npx vitest run src/test/live-devices-commands.test.tsx src/test/live-devices-clip.test.tsx src/test/live-devices-drawer.test.tsx src/features/devices --maxWorkers=2 --reporter=verbose
 Test Files  4 passed (4)
      Tests  57 passed (57)
```

Ledger (L-1): `@dems/core-web` +3 files / +40 tests from this row; 71 / 958 also holds the other rows in
flight (W63 to W65, W69, W71). The first whole-suite run (23:00:26 – 23:02:12) was 66 of 68 files and 915
of 916 tests; its two red files were not this row's: `src/test/live-evidence-probe.test.tsx` (a transient
parse error in a probe file of the Evidence row W69, deleted by its owner within minutes) and
`src/test/live-storage-page.test.tsx` (the Storage row W71, in flight, modified 23:00). Both were green
or gone in the final run. The probe file also made one lint run exit 1 at 23:00; the next lint exited 0.

### 6.2 CLG (a)

```
$ git diff --stat acaff20 -- apps/core-web/src/features/devices/__tests__ (expect empty)
exit 0
$ git hash-object apps/core-web/src/features/devices/__tests__/devices-page.test.tsx
9c7a7552d0a2b53855d2845fbb364c2b94fc3947
$ git rev-parse acaff20:apps/core-web/src/features/devices/__tests__/devices-page.test.tsx
9c7a7552d0a2b53855d2845fbb364c2b94fc3947
$ npx vitest run src/features/devices --maxWorkers=2
 Test Files  1 passed (1)
      Tests  17 passed (17)
```

The folder's changed files are production files only (`git diff --stat acaff20 -- apps/core-web/src/features/devices packages/shared/src/i18n/en/devices.ts`:
nine modified files and `devices.ts`, 420 insertions, 72 deletions; `live.ts` and `report.ts` new).

### 6.3 CLG (c)

```
$ grep -rn "useSimActions" apps/core-web/src/features/devices --include="*.ts" --include="*.tsx" | grep -v __tests__
exit 1
$ (string literals removed) grep ".actions" on the production files of the folder   # pattern \.actions\b|\buseSimActions\b|\bSimContext\b|\.source\b
apps/core-web/src/features/devices/lcd-display.tsx:63:     timeSource: state.time.source,
apps/core-web/src/features/devices/model.ts:103:       return state.time.gnss.locked && state.time.source ===  ?  : 
apps/core-web/src/features/devices/other-devices.tsx:38:     timeSource: state.time.source,
(end of matches)
```

No `.actions` read, no `useSimActions`, no `SimContext`; the three `.source` matches are the `time.source`
slice field, not a Live source. (Without removing literals, `.actions.` matches only i18n keys such as
`'devices.actions.failed'`.) `health-chart.tsx:41` keeps the predecessor's `useSimInstance()` for
`store.getState()` (a read, the replica in Live mode).

### 6.4 Write paths and protected paths

Written: `apps/core-web/src/features/devices/**`, `packages/shared/src/i18n/en/devices.ts` (additive),
three `apps/core-web/src/test/live-devices-*.test.tsx`, and this row's documents and `assets/70_*`. Not
written: `runtime/**`, `lib/**`, `components/shell/**`, `routes/**`, `vite.config.ts`, `routeTree.gen.ts`,
the six protected test files, `features/dashboard/**` (nothing imported from it). Scratch files under
`.cache/w70/`; pre-image `.cache/rollback/W70/pre-image.tar`.

## 7. Mutation check (M15)

Each mutation changes one file of a scratch copy (`$TMPDIR/w70-mut`: `apps/core-web` copied, the
workspace's `node_modules` and `packages/` linked read-only), runs the files named for it, compares the
failed count with the baseline of the same file set, and puts the file back
(`assets/70_mutations_runner.py.txt`; record `assets/70_mutations.log`). The workspace was never written;
after the run `diff -r` of the folder and the scratch copy differed only in a comment corrected in the
workspace after the copy was made (the cited line range of `hub.ts`).

| # | Mutation | Verdict |
|---|---|---|
| D1 | Identify blinks before the answer (D-5) | DETECTED +3 |
| P1 | the page command skips the presenter | DETECTED +7 |
| G1 | the page's in-flight guard is gone | SURVIVED |
| T1 | the Restart toast is dropped from `ok` | DETECTED +3 |
| B1 | a Live command never marks its device pending | DETECTED +1 |
| R1 | no page record on a 409 | DETECTED +2 |
| M1 | the menu keeps the commands enabled while one is out | DETECTED +1 |
| M2 | the spinner shows at once | DETECTED +2 |
| W1 | the Live menu keeps the simulated words | DETECTED +1 |
| A1 | the tile head is never busy | DETECTED +1 |
| C1 | the clip reset has no in-flight guard | DETECTED +2 |
| C2 | the clip toast runs at the press | DETECTED +4 |
| C3 | the clip reset skips the presenter | DETECTED +5 |
| C4 | the clip fact is never busy | DETECTED +3 |
| G6a | every role gets the registry summary | DETECTED +2 |
| G6b | the registry is read with the link down | DETECTED +1 |
| G6c | every device counts as paired | DETECTED +1 |
| G6d | the tablet-link change no longer refreshes the count | DETECTED +1 |
| G6e | the registry read skips the presenter | DETECTED +3 |
| G6f | the Live row keeps the Simulated "Pairing" row | DETECTED +11 |
| W2 | the Health caption keeps "Simulated" in Live mode | DETECTED +1 |
| W3 | the display label keeps "simulated" in Live mode | DETECTED +1 |
| S1 | the Live words leak into Simulated mode | DETECTED +4 |
| S2 | the Live row shows in Simulated mode | DETECTED +1 |
| K1 | the record quotes the error text (M14) | DETECTED +2 |

**24 of 25 detected.** G1 is equivalent through the UI: `run` is called only by the menu's `onAction`;
the press sets `pending` in the same discrete event, React flushes it before the next event, and from then
on the three command keys are disabled (mutation M1 proves that guard is pinned). The ref stays as the
defence for a caller that is not the menu.

## 8. Contract gaps found

| ID | What | Where | Effect here |
|---|---|---|---|
| CONTRACT-GAP-W70-1 | A paired device's socket opening or closing publishes no `admin.changed` DEVICES; only a redeem, a revoke/unpair and a rotation do. So a held `listPairedDevices` answer keeps a stale `online` | `apps/core-server/src/realtime/hub.ts:219-224` (`depart`), `:697-700` (open); publishers `apps/core-server/src/modules/pairing/devices.ts:114`, `:184`, `redeem.ts:155` | The drawer refetches on a change of the replicated `tabletLink` (`device-drawer.tsx:392-397`). Residual: with two paired devices, one leaving while the other stays keeps the aggregate link CONNECTED, so that change is not seen until the next refetch (drawer reopened, `admin.changed`, resync). The Paired Devices page (W81) has the same gap for its online column |
| CONTRACT-GAP-W70-2 | Operations 49 `testDeviceSignal` and 50 `identifyDevice` have no `notPermitted` 403 example (only `deviceRevoked`, `originNotAllowed`), because every seeded role holds `DIAGNOSTICS_RUN`. 49 was named by W63 (CONTRACT-GAP-W63-1); 50 is new here | `packages/shared/src/api/devices.ts:329`, `:339` | The tests write the envelope (`refusal(403, 'NOT_PERMITTED', …)`) |

No `SIM-GAP` marker was added.

## 9. Findings

| # | Finding | Evidence | Owner |
|---|---|---|---|
| F70-1 | The drawer's Log words every `DEVICE_COMMAND` that is not a test signal as Restart, so an Identify row reads "Restart (simulated)" in Simulated mode (and "Restart" in Live mode). Predecessor defect, both modes; the Identify command has been audited since step 54. Not fixed: the fix changes a Simulated screen | `device-drawer.tsx:526` (predecessor line 378); `packages/shared/src/sim/maintenance.ts:234-237` | controller (decision 4) |
| F70-2 | On a lane a 403 or 409 of a device command cannot be caused through the page without a race: Restart is disabled for roles without `DEVICE_MANAGE` and while recording, `COMMAND_UNSUPPORTED` only exists for the platform devices, which have no kebab, and a recording needs a connected paired tablet (F69). The lane therefore shows the presenter on a command refused during an outage; the 403 and 409 paths are proven on the fake transport | `device-menu.tsx:36-51`; `packages/shared/src/sim/maintenance.ts:204-216` | none (stated) |
| F70-3 | A Restart changes no state on the Core: the engine's RESTART writes the audit row only, so the camera stays READY (lane: `statusFourSecondsLater` all READY). As in Simulated mode | `maintenance.ts:197-240`; `70_lane_browser_live.json` step `restart` | none (stated) |
| F70-4 | The camera feed's overlay reads "… LIVE \| DEMO" in Live mode (visible in the Live screenshots). It is `components/media`, which has no writer in this task ([CS:§7.3 G2]) | `70_devices_live_supervisor.png` | controller (for W97/W88) |
| F70-5 | `report.ts` repeats `features/dashboard/report.ts` (the brief forbids importing from the Dashboard) and `.dev-facts-link` repeats the Dashboard's link style. A shared reporter home would end the copies (cf. CPW1-9) | `features/devices/report.ts`; `features/dashboard/report.ts` | W87 / W88 |
| F70-6 | In Simulated mode on a lane the page tries `ws://127.0.0.1:4400/ws` (mock-core heartbeat, off by rule) 12 times in about 6 s. Predecessor behaviour, unchanged | `70_lane_browser_offline_simulated.json` step `simulated` | none (stated) |
| F70-7 | The Devices page offers Test signal to every role (`DIAGNOSTICS_RUN`, as the Core), while the Dashboard gates it on `DEVICE_MANAGE` (F63-1). The two pages disagree in both modes; the Devices page matches the Core | `device-menu.tsx:35`; F63-1 | controller (with F63-1) |

## 10. Deviations

| # | Deviation | Why |
|---|---|---|
| DV-1 | Live words in four files outside the spec's C/D list for G6: `device-menu.tsx`, `health-chart.tsx`, `lcd-display.tsx` (words), `camera-tile.tsx` (busy mark) | [CS:§3.2] and W63's gated precedent [D152]; F63-2 for the container mark. Each is one key map or one attribute, absent in Simulated mode |
| DV-2 | The lane's "refused command shown by the presenter" is a command refused during an outage (LiveTransportError, CL-22), not a 403 or 409 | F70-2. The Core's 403 to a SUPERVISOR's restart was read by one page request (one `ACCESS_DENIED` row), as W63's DV-1 did |
| DV-3 | The lane check stopped its own backend in mid-check to show the outage, so the TECHNICIAN's session row stays open in `dems_lane_3` until its idle expiry (the browser profile with the cookie was deleted) | Shows LB-6 / CL-22 in a real browser; nothing else of the lane changed |
| DV-4 | The Simulated screenshots used the simulator's stored sign-in `dems.auth` (operator ID and time, no credential) | F63-3 [D152]; Sign In needs mock-core on 4400, which lanes may not start |
| DV-5 | Mutation rig: the first scratch launch failed every test (Vite refused `packages/` outside the scratch root; the scratch `vite.config.ts` got `server.fs.allow`), and two launches briefly overlapped on the scratch copy; both were stopped, their output discarded, the scratch folder re-synced from the workspace (`diff -r` equal) before the recorded run | M15: the workspace was never written |

## 11. Decisions for the controller

1. Accept DV-1: the Devices page in Live mode carries no "simulated" word, as the Dashboard does (D152).
2. CONTRACT-GAP-W70-1: either the realtime hub publishes `admin.changed` DEVICES on a presence change
   (debounced like the tablet link), or W81 refetches on the tablet link as this row does. Put it in W81's
   brief either way.
3. Binding brief line for W81: keep operation 19's answer under `CORE_QUERY_KEYS.pairedDevices` as the raw
   `PairedDeviceList` (`{ devices }`): the drawer and the page share that cache entry.
4. F70-1: rule whether the one-line fix of the Identify log word (a third branch to
   `common.deviceMenu.identify`) may change the Simulated drawer (W87/W88 or the post-demo pass).
5. Ledger: `@dems/core-web` +40 tests in 3 new files (`live-devices-commands` 17, `live-devices-clip` 10,
   `live-devices-drawer` 13); no existing test changed.
6. CONTRACT-GAP-W70-2 to the contract close-out (W83) with CONTRACT-GAP-W63-1.

## 12. Rollback (not executed)

The row's paths were clean at `b90a3c6` before the first edit (`git diff --quiet` held), and their pre-image
is `.cache/rollback/W70/pre-image.tar` (24 entries: the folder and `devices.ts`). R-CO:

```sh
cd /Users/gsp-budi/Documents/DEMS
git checkout b90a3c6 -- apps/core-web/src/features/devices packages/shared/src/i18n/en/devices.ts
mkdir -p .cache/rollback/W70/removed
mv apps/core-web/src/features/devices/live.ts apps/core-web/src/features/devices/report.ts \
   apps/core-web/src/test/live-devices-commands.test.tsx apps/core-web/src/test/live-devices-clip.test.tsx \
   apps/core-web/src/test/live-devices-drawer.test.tsx .cache/rollback/W70/removed/
```

The lane rows the check added (section 5.3) are not rolled back (lane databases are not reset by rows).

## 13. Files of this row

| File | Change |
|---|---|
| `apps/core-web/src/features/devices/index.tsx` | modified (B-7, D-5) |
| `apps/core-web/src/features/devices/audio-input-card.tsx` | modified (B-8; busy mark) |
| `apps/core-web/src/features/devices/device-menu.tsx` | modified (LB-1 look; words) |
| `apps/core-web/src/features/devices/device-drawer.tsx` | modified (note G6; Log words) |
| `apps/core-web/src/features/devices/camera-tile.tsx` | modified (busy mark) |
| `apps/core-web/src/features/devices/context.ts` | modified (`pending`, `useDevicePending`) |
| `apps/core-web/src/features/devices/health-chart.tsx`, `lcd-display.tsx` | modified (words) |
| `apps/core-web/src/features/devices/devices.css` | modified (drawer link styles) |
| `apps/core-web/src/features/devices/live.ts`, `report.ts` | new |
| `packages/shared/src/i18n/en/devices.ts` | modified, additive |
| `apps/core-web/src/test/live-devices-{commands,clip,drawer}.test.tsx` | new |
| `docs/…/implementation/70_web_devices.md` | new (this file) |
| `docs/…/implementation/assets/70_*` (8 screenshots, 2 browser records, lane log, try log, 3 scripts, gate and mutation logs) | new |
| `docs/…/delegation_progress/coder_execution_step_92.md` | new |
