---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: W65 (blueprint step 87)
agent: coder-execution
date: 2026-10-05
status: complete
source_plan: docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md (row W65, line 739)
---

# 65. Web Session Monitor in Live mode (plan row W65, blueprint step 87)

Citation convention as in `masterplan/02_plan.md` (about line 81): `[CS:…]` is
`masterplan/04_client_integration_spec.md`, `[LS]` is `implementation/44_live_source.md` §17.4,
code is `path:line` from the workspace root. Every quoted output is from this row's own runs
(`.cache/w65/`, copied as `assets/65_*` where named).

## 1. Result

| Item | Result |
|---|---|
| Settle sites A9, B-2 (four actions), B-3, B-4 and the reads C-1, C-2 | All run through `useCoreActions()` + `settle`; every error goes to `useCoreErrorPresenter()` first (rules 1 and 2 of `gateway_check/08_cp_web_runtime.md` §8) |
| Meters (I8) | They are the socket's `meters` publications written by the Live source into the store's `audio` slice; nothing on the page polls. Lane: 64 `meters` frames and **0** API requests in a 3.2 s window while the MIC 2 meter moved |
| CLG (a) | The folder's existing test file is blob-equal to `acaff20` (`2aeede95…`) and passes 13 / 13 |
| CLG (b) | One Live test per named site: success, the site's refusal, an outage — 25 Live tests plus one Simulated control test in two new files, all green |
| CLG (c) | No `useSimActions`, no `.actions` read on a `Sim` in the folder's production files (0 lines without the i18n words) |
| CLG (d) | Lane 2 with the paired tablet, ONE sitting, 1 min 35 s (22:39:54 to 22:41:29): a recording ran, the meters moved (two screenshots 3 s apart plus the numbers), a stop with a reason through the page sealed the session (screenshot) |
| Gate SG | `@dems/core-web`: final re-run at 23:05 — typecheck exit 0, lint exit 0 (no warning), whole suite **69 files / 933 tests exit 0** (above the floor 62 / 853; section 13); `@dems/shared`: **68 / 1,814 exit 0**, typecheck and lint exit 0 |
| Mutation check (M15, in memory, the tree never touched) | **28 of 28 detected** (P04 after a Simulated control test was added; section 10) |
| Contract gaps | None (`CONTRACT-GAP-W65-n`: none raised) |

## 2. What was written

| File | Change | Why |
|---|---|---|
| `apps/core-web/src/features/session-monitor/use-pending-press.ts` | new (95 lines) | One control's command in both modes: `settle` plus LB-1 "busy at once, spinner late" (`busy` from the press, `revealed` after `LIVE_PENDING_REVEAL_MS` scaled by the motion policy) and an `onWait` hook for the LB-4 optimistic visuals. A simulator answers before `run` returns, so no state of the hook changes in Simulated mode (`use-pending-press.ts:59-91`) |
| `.../session-monitor/index.tsx` | B-3 | `recover` through `usePendingPress`, presenter first, then `session.recovery.failed` (`index.tsx:98-108`); busy state handed to the two Recover buttons |
| `.../session-monitor/action-bar.tsx` | B-2, C-1, C-2 | Marker (`:250-275`), note (`:358-371`), snapshot (`:452-477`), stop (`:656-684`); the slot wrapper carries `aria-busy` (`:153-162`); the Spinner replaces the icon after the reveal (`:165`) |
| `.../session-monitor/live-feed-panel.tsx` | B-4 | Optimistic camera toggle from a local pending value (`:77-78`, `:93-102`); busy mark on the header container (`:126`) |
| `.../session-monitor/integrity-panel.tsx` | A9 | `settle(() => actions.verifyAuditChain(), …)` after the Spinner's 700 ms; presenter first (`:79-90`) |
| `.../session-monitor/status-banner.tsx`, `panel.tsx` | busy props | `aria-busy` on the plain wrapper (`status-banner.tsx:167`, `panel.tsx:47`) because the kit's `Button` does not pass `aria-busy` to the DOM (react-aria `filterDOMProps` passes only `data-*`, ids and four `aria-*` labels; the same finding as W63's F63-2) |
| `.../session-monitor/log.ts` | the page's record | One record in `webErrorSink` (in memory; printed in a dev build; never sent or stored), with a correlation ID; the error is named by class, code, status, transport reason, never by its text (CPW1-8) (`log.ts:20-52`) |
| `.../session-monitor/finalization-modal.tsx` | Live label | The sealed item's digest is labelled `LIVE` in Live mode, `SIMULATED` as before in Simulated mode (`:229-238`; finding F-2) |
| `.../session-monitor/session-monitor.css` | 21 lines | The pending marker chip at the button (`.sm-action-slot-anchored`, `.sm-marker-pending`) |
| `packages/shared/src/i18n/en/session.ts` | additive, 2 lines | `session.actions.endSession.alreadyEnded`: "The session was already ended." ([CS] §8.3 B-2 wording); 0 removed lines |
| `apps/core-web/src/test/live-session-monitor-actions.test.tsx` | new, 16 tests | B-2 with C-1, C-2; one Simulated control test (nothing waits, nothing turns busy) |
| `apps/core-web/src/test/live-session-monitor-panels.test.tsx` | new, 10 tests | A9, B-3, B-4, the meters |

No file outside the row's paths was written (section 9.4). `routeTree.gen.ts` was not touched.

## 3. The sites, as built ([CS] §8.2 to §8.4)

| Site | Live behaviour | Simulated behaviour | Test |
|---|---|---|---|
| **A9** `verifyAuditChain` (`integrity-panel.tsx:79`) | The Spinner (LB-2) holds from the press until the Core answered; the request goes out when the literal 700 ms are over. Result: the check over the audit **view** (`AuditChainStatus.view`, the binding's result) — PASS • n rows, or FAIL • row i during AUDIT_TAMPER. A refusal or an outage → presenter; else `session.integrity.verifyFailed` | Unchanged: the call at 700 ms, the result at once | panels "A9 re-verify" ×3 |
| **B-2 marker** (`action-bar.tsx:250`) | The popover closes at the press; a chip waits at the button (LB-4); a second press sends nothing (LB-1); on the settle the chip leaves, the flight starts at the button, the toast shows the time read in `ok` (C-1). Refusal → the chip leaves, the presenter's toast | Unchanged (the settle runs inside the press; the chip never renders) | actions "B-2 marker" ×3 |
| **B-2 note** (`:358`) | Save is busy (data-busy at once, the kit's pending state after the reveal); the drawer closes on the settle; on a refusal or an outage it stays open with the text | Unchanged | actions "B-2 note" ×3 |
| **B-2 snapshot** (`:452`) | The shutter flashes at the press (LB-4); the thumbnail flight and the toast with the camera name read in `ok` (C-2) on the settle | Unchanged: the shutter in `ok`, none on a refusal | actions "B-2 snapshot" ×3 |
| **B-2 stop** (`:656`) | The confirm is busy; the dialog closes on the settle and the finalization overlay follows the state to SEALED. 422 `INVALID_REASON` → the reason field's error, the dialog stays open (F59); 409 with the session already STOPPING/FINALIZING/SEALED → info toast "The session was already ended." and the dialog closes (Q16); 403 → the denied toast, the dialog closes; an outage, a time-out or a limit → the presenter's toast, the dialog stays open with the reason (LB-6, LB-7, LB-10) | Unchanged on every reachable path (section 7) | actions "B-2 stop" ×5 |
| **B-3** `recover` (`index.tsx:98`) | Settle, then the recovery overlay follows the state; refusal → the denied toast (`SESSION_START`, names INVESTIGATOR); a 409 → `session.recovery.failed`; outage → the presenter | Unchanged | panels "B-3 recover" ×3 |
| **B-4** `setActiveCamera` (`live-feed-panel.tsx:93`) | The toggle shows the pressed camera at once from a pending value; the feed follows the store; the pending value yields on the settle and the toggle reverts on a failure; the presenter words an outage or a refusal; a 422 reverts with the page's log line only (the existing branch) | Unchanged (pending is never set) | panels "B-4 camera" ×3 |
| **C-1**, **C-2** | No change of the read: it runs in `ok`, where the store already holds the effect (CL-16) | — | inside the B-2 success tests |

**The meters (I8).** `components/composed/dbfs-meter.tsx:226` subscribes to `audio.channels` of the
store through `useAudioChannel` (`packages/shared/src/sim/react.ts:97-112`) and writes each frame
straight into Motion values. In Live mode the Live source writes that slice
from each socket `meters` frame (`packages/shared/src/live/source/live-sim.ts:902-905`) and replaces it
with a flat "no signal" frame while the link is down. The page therefore needs no code for the meters,
and has none that polls. The panels test proves it on the fake transport ("the meters": the ARIA value
follows two frames, no request in five quiet seconds, NO SIGNAL after a lost link); the lane proves it on
the real Core (section 8).

## 4. Contract gaps found

None. Every operation the page needs in Live mode exists, with the bindings of `[LS]`
(`packages/shared/src/live/source/bindings.ts:340-364, 401-404, 474-479`). No `SIM-GAP` and no
`CONTRACT-GAP-W65-n` marker was added.

## 5. Findings

| # | Finding | Evidence | For |
|---|---|---|---|
| F-1 | **AC-C-48 cannot occur at A9 and B-4.** Operations 60 `verifyAuditChain` and 51 `setActiveCamera` have access `AUTHENTICATED`: the Core never answers them 403 `NOT_PERMITTED`, and the contract has no `notPermitted` example for them (`fake.example(op, 403, 'notPermitted')` would throw). Their refusal case in the tests is the 403 the contract documents, `ORIGIN_NOT_ALLOWED`, which the presenter words with the address to open | `CORE_API_OPERATIONS` read by `.cache/w65/ex2.mts`: `"access":{"kind":"AUTHENTICATED"}` for both; examples 403 = `deviceRevoked`, `originNotAllowed` only | controller (CLG (b) wording for these two sites) |
| F-2 | **Found by the lane check, fixed after it:** in Live mode the sealed overlay labelled the sealed item's manifest digest "SIMULATED", against [CS] §3.2 ("a screen that says 'live' shows server data"). The digest is the Core server's (the replica). Now `LIVE` and `data-source="core"` in Live mode; Simulated unchanged. The lane screenshot `65_session_sealed_live.png` predates the fix (one sitting, not repeated); the fix is covered by the actions test "B-2 stop success" (no "simulat" in the overlay) and mutation F01 | `assets/65_lane_browser.json` `steps.stop.facts.sealedLine` holds "SIMULATED"; `finalization-modal.tsx:229-238` | controller (accept the label) |
| F-3 | **An unlisted Live call site on this page, outside this row's paths:** the DbfsMeter's CLIP reset button calls `actions.resetClip(channel)` through `useSimActions()` and drops the result (`apps/core-web/src/components/composed/dbfs-meter.tsx:360`). It renders inside panels O and R whenever a CLIP is latched. In Live mode the action is a Live result nobody observes: a `live.misuse` `NOT_OBSERVED` warning ([LS] row 18) and a refusal that is never presented. [CS] §8.3 B-8 names only `features/devices/audio-input-card.tsx:50` for `resetClip`. No row of the plan owns `components/composed/**` | `grep -n "actions\." apps/core-web/src/components/composed/dbfs-meter.tsx` → `360: onPress={() => actions.resetClip(channel)}`; `git log -1` of that file: `acaff20` | controller: route to the B-8 row or a slot |
| F-4 | `am start -W` reported `Status: timeout` for both tablet launches although the app started (the DEVICE socket opened 5 s after the LIVE launch; `runtime.sim.hydrated` 3 s after the SIMULATED one). Cosmetic, from `-W` | `assets/65_lane_run.log` | none |
| F-5 | F59 in practice: a reason of five code units and fewer characters (three emoji) passes the client's bound and is refused by the fake transport before any answer (`INVALID_BODY: reason: too_small`), because the contract's schema counts characters. On the real Core it is the 422 `INVALID_REASON` of D108. The test sends a valid text and scripts the Core's 422; the UI under test is the same | first run of the actions test, 22:31 | none (recorded) |
| F-6 | The busy mark: the kit's `Button` drops `aria-busy` (react-aria `filterDOMProps`), so it is put on the nearest plain container — the action slot, the dialog footer, the drawer's button row, the panel header's action wrapper, the banner's CTA span — and the button carries `data-busy`. Same as W63's F63-2 (controller note D152) | `node_modules/react-aria/dist/private/utils/filterDOMProps.mjs:15-18, 30-36, 73`; `action-bar.tsx:153-162` | none (recorded, as the controller asked) |

## 6. Deviations

| # | Deviation | Why |
|---|---|---|
| DV-1 | In the lane check the session and the recording were **started by page script** (requests of the page itself, with its own cookie, through the dev proxy: case number, create, start from CREATE, start from ARMED). The **stop** was done through the page (End Session, the reason typed, the confirm pressed) | The Start Session page is row W64's and was in flight; this row's site is the stop |
| DV-2 | A9 sends the request when the Spinner's literal 700 ms are over, not at the press | Keeps Simulated mode identical (the chain is checked at the same instant as before); LB-2 holds: the old duration is the minimum and the Spinner spans the real request |
| DV-3 | `log.ts` now writes one record to the page's own log (`webErrorSink`) instead of a raw `console.error` object with the error's message and stack; in a dev build the sink prints it to the console | CPW1-8 discipline (the text of an unknown error is not trusted to be free of input); persistent-as-possible logging of the page (there is no client log endpoint, D3/D4, D41(g)). Not visible to the operator in either mode |
| DV-4 | `finalization-modal.tsx` changed although it is no named site | F-2: a Live-mode statement of this page that broke [CS] §3.2; inside the row's write path; Simulated unchanged |
| DV-5 | No Simulated-mode screenshot on the lane | The brief's lane check is the Live one; Simulated identity is CLG (a) (the existing file unchanged and green) and the mutation P04 (section 10). Controller note D152 (F63-3) applies only if a Simulated lane screenshot is wanted |

## 7. Simulated mode: why it looks and behaves as before

`settle` runs `ok`/`fail`/`done` before it returns for a plain value or a throw
(`packages/shared/src/live/settle.ts:78-88`), and `usePendingPress` changes state only when the outcome
is still unknown after `settle` returned (`use-pending-press.ts:80-88`). So in Simulated mode no busy
flag, no pending chip, no early shutter, no pending camera is ever rendered, and the success paths
run in the same event, in the same order, as before. The refusal branches that changed are the
presenter rows that a simulator can reach only through a permission error (`SimPermissionError`), and
every such control is gated on `selectCan` before it can be pressed (`model.ts:62-72`;
`status-banner.tsx:93-110`); the new 422 and 409 branches of the stop need a reason the client bound
lets through but the simulator refuses (impossible: both count code units) or a session that ended
while the dialog was open. The proof: the folder's file `session-monitor.test.tsx` is blob-equal to
`acaff20` and passes 13 / 13, and the row's Simulated control test ("Simulated mode is unchanged":
after a marker, a snapshot and a note nothing waits, nothing is busy, nothing turns pending past the
reveal time, one shutter, the three success toasts) detects mutation P04 (section 10).

## 8. The lane check (lane 2, the paired tablet; CLG (d))

One run, inside `/usr/bin/lockf -k -t 900 .locks/core-server.lane2.lock /bin/sh .cache/w65/lane/run_lane2.sh`
(sandbox bypass for this one command; `lockf exit=0`): `assets/65_lane_run_lane2.sh.txt`, the device
commands `assets/65_lane_device_w65.sh.txt` (run inside `apps/mobile/scripts/device-session.sh tablet`,
as the mobile pairing rows did), the browser driver `assets/65_lane_cdp_driver.mjs.txt`; output
`assets/65_lane_run.log`, browser record `assets/65_lane_browser.json`. W50's lane pattern adapted to
lane 2 (backend 127.0.0.1:4422 → `dems_lane_2`, Vite 127.0.0.1:5177, devtools 9397, Metro 8083).
The demo flag was off. `dems_lane_2` was not reset. 5432, 5173 to 5176, 5178, 4400, 4420, 4421, 4423
and the two phones were neither used nor touched.

```
== 22:39:54 0. run w65223954; the ports must be free before anything is started
free: 4422 5177 9397 8083
-- emulator-user-lock.sh status tablet (read-only, before):
tablet (emulator-5556): AVD dems2_tablet, isKeyguardShowing=false, CredentialType=PIN, fingerprint count=1, lock screen disabled=unreadable
== 22:39:55 2. start the lane backend: DEMS_CORE_PORT=4422 npm run start:server (demo flag OFF)
"port":4422,"database":"dems_lane_2","demoControls":false
== 22:39:58 5. device session: tablet (emulator-5556), Metro 8083, device tcp:4420 -> host tcp:4422
[device-session tablet 22:39:58] emulator-5556: screen awake, no keyguard
-- dems.mobile.prefs.v1 (before the launch): {"coreLinkSource":"SIMULATED"}
== A. LIVE mode on the PAIRED tablet: demsdemo:///?core=LIVE
-- waited 5 s for the tablet's DEVICE socket in the backend's log
{"level":30,"principal":"device:DEV-0001","kind":"DEVICE","msg":"socket opened"}
-- 'live.misuse' reports on the tablet (must be 0): 0
== B. the web console on 127.0.0.1:5177 while the tablet is connected (the driver)
cdp-driver exit 0
[15:40:33] signed in: true
[15:40:38] session SES-20261005-0024: RECORDING
[15:40:52] meters: ["−51 dBFS","−12 dBFS"] -> ["−51 dBFS","−15 dBFS"]; moved=true
[15:41:03] stop: dialog closed true, overlay true, sealed true, server state SEALED, evidence EV-20261005-0014
== C. the default source again: ... demsdemo:///?core=SIMULATED
-- waited 3 s for: runtime.sim.hydrated
-- request lines to the Core server after the relaunch (must be 0): 0
-- dems.mobile.prefs.v1 (after the launch with core=SIMULATED): {"coreLinkSource":"SIMULATED"}
   entry: name="key_v1-dems.live.device.v1"
[device-session tablet 22:41:28] Metro 70228 stopped
device session exit=0
== 22:41:29 listeners left on 4422, 5177, 9397, 8083 (expect none):
lsof exit 1 (1 with no output: no listener)
-- adb reverse --list on emulator-5556 after the session (expect empty):
adb reverse --list exit 0
-- the backend's log: lines 77; lines with level error or fatal: 0
-- lines with a bearer value, a cookie or a credential in the backend's log (must be 0): 0
lockf exit=0
```

(The driver's bracketed times are UTC; 15:40 UTC = 22:40 WIB.)

| What | Observed | Asset |
|---|---|---|
| The tablet in LIVE mode | "Core online · Core: DEMS-IR-01 · paired as DEV-0001"; the Login form empty | `65_tablet_live_connected.png` |
| Sign-in | Through the Login form, the seeded SUPERVISOR (OPR-002), read from the seed source and never printed; Dashboard shown | — |
| Pre-check | `CORE=PASS(ONLINE)` and the seven other items PASS → ARMED → `POST …/start 200` RECORDING | `65_lane_browser.json` `steps.recording` |
| Meters, reading 1 (22:40:49.3) | MIC 1 −51, MIC 2 −12 (ARIA values); timer 00:00:10; banner ACTIVE; Core mode LIVE; page visible | `65_session_monitor_live_meters_1.png` |
| Meters, reading 2 (22:40:52.5) | MIC 1 −51, MIC 2 −15; timer 00:00:13. Between the two readings: **0** requests to `/api/v1`, **64** `meters` frames on the page's socket (≈20 Hz), 3 deltas, 3 heartbeats | `65_session_monitor_live_meters_2.png` |
| End Session | A virtual press (as assistive technology) opened the dialog; the reason "Interview completed (W65 lane check)" typed; confirm pressed → `POST …/stop 202`; the dialog closed on the settle | `65_end_session_dialog_live.png` |
| Sealed | Overlay `data-state="SEALED"`: six steps done, "Evidence EV-20261005-0014 sealed", "Sealed 7.6 s after the recording ended"; banner SEALED; the server's session SEALED | `65_session_sealed_live.png` |
| Console of the page | No error and no warning in the whole run | `65_lane_browser.json` `consoleAtEnd: []` |
| Backend requests | `POST /api/v1/session 201`, `…/start 202`, `…/start 200`, `…/stop 202`, `GET /session/current 200` ×14, `POST /auth/sign-in 200`, `POST /auth/sign-out 204`; the tablet: `GET /pairing/device 200`, `GET /auth/status 200` | `65_lane_run.log` step 6 |

The screenshots show the seed's synthetic names (AKP Andi Pratama, Ahmad Fauzi), as W50's and W54's
did; no credential, session token or pairing code is on any screenshot or in any log
(`.cache/w65/secret_scan.mts` over the five text assets: `5 text assets scanned; hits: 0`).

## 9. Verification

### 9.1 Gate SG and CLG, fresh (`.cache/w65/*.log`)

```
## 2026-10-05 22:43:57 WIB  load averages: 3.51 4.88 4.38
$ npm run test -w @dems/core-web -- --maxWorkers=2 --reporter=default --reporter=json --outputFile.json=…/web.json
 Test Files  62 passed (62)
      Tests  849 passed (849)
exit=0
   per file (JSON report): src/test/live-session-monitor-actions.test.tsx passed 15 / 15
                           src/test/live-session-monitor-panels.test.tsx passed 10 / 10
                           src/features/session-monitor/__tests__/session-monitor.test.tsx passed 13 / 13
$ npm run typecheck -w @dems/core-web          exit=0
$ npm run lint -w @dems/core-web               exit=0 (no warning)
## 22:45 $ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  68 passed (68)
      Tests  1814 passed (1814)
exit=0
$ npm run typecheck -w @dems/shared            exit=0
$ npm run lint -w @dems/shared                 exit=0
```

### 9.2 CLG (a) to (c) (`.cache/w65/clg.log`)

```
## 2026-10-05 22:45:38 WIB CLG (a)
$ git diff --stat acaff20 -- apps/core-web/src/features/session-monitor/__tests__ | wc -c
       0
$ git status --short apps/core-web/src/features/session-monitor/__tests__ | wc -l
       0
$ git hash-object …/__tests__/session-monitor.test.tsx; git rev-parse acaff20:…/__tests__/session-monitor.test.tsx
2aeede95fbd403c1be118764aae5b3cf226e664d
2aeede95fbd403c1be118764aae5b3cf226e664d
## CLG (c), AC-C-53: $ grep -rnE 'useSimActions|\.actions\b' apps/core-web/src/features/session-monitor --include='*.ts' --include='*.tsx' | grep -v __tests__
   (57 lines, every one an i18n word `t('session.actions.…')` / `t('common.actions.…')`; the same without them:) lines: 0
$ grep -rnE 'sim\.actions|useSimInstance\(\)\.actions' apps/core-web/src/features/session-monitor | grep -v __tests__ | wc -l
       0
## the shared file is additive: $ git diff acaff20 -- packages/shared/src/i18n/en/session.ts | grep -c '^-[^-]'
0
```

CLG (b): the two Live files, by site — A9 3, B-2 marker 3, note 3, snapshot 3, stop 5, B-3 3, B-4 3,
meters 1, page 1 (25), plus one Simulated control test (26). Each Live file has the page address `http://127.0.0.1:5178/` in its docblock,
calls `clearToasts()` after each test, scopes toast queries to `[data-slot="toast"]`, names every 403
by its example (`fake.example(op, 403, 'notPermitted')` or `'originNotAllowed'`), and asserts after
each test that the page's own sink holds no `live.misuse` report ([LS] row 18).

### 9.3 The row's tests alone

```
$ npx vitest run --root apps/core-web src/test/live-session-monitor-panels.test.tsx src/test/live-session-monitor-actions.test.tsx src/features/session-monitor --reporter=verbose
Test Files  3 passed (3)
Tests  38 passed (38)
```

### 9.4 Do-not-touch list (rule 9) and the protected files

```
$ git status --short apps/core-web/src/runtime apps/core-web/src/lib apps/core-web/src/components/shell apps/core-web/src/routes apps/core-web/vite.config.ts
(no output)
7a04c97d… test/routes.test.tsx    9e8b97c8… test/sim-fetch.test.ts    71f6f033… storage-page.test.tsx
89cab371… core-endpoint.test.tsx  6d0db39e… packaged-csp.test.ts      (W01's state and acaff20, unchanged)
$ git diff --stat acaff20 -- apps/core-web/src/features/session-monitor packages/shared/src/i18n/en/session.ts
 10 files changed, 417 insertions(+), 132 deletions(-)
```

### 9.5 Test ledger (P24)

| Workspace | Floor given to this row | Measured after this row | Added by this row |
|---|---|---|---|
| `@dems/core-web` | 55 files / 760 tests (rule 10, §30); 62 / 853 by the controller's note of 22:46 | 62 / 849 at 22:43; 62 / 855 at 22:54 (2 red of another row, section 13); **69 / 933 exit 0 at 23:05** (other rows' files included) | 2 files / 26 tests |
| `@dems/shared` | 68 / 1,814 | 68 / 1,814 | 0 (one i18n key) |

### 9.6 The re-run against the controller's later floor (62 / 853)

See section 13.

## 10. Mutation check (M15)

W55's pattern (`assets/55_mutations_config.mts.txt`): the app's own Vitest configuration plus one
transform plugin that replaces one text in one module in memory; a marker under `TMPDIR` proves the
mutation ran; no file of the tree is changed. Each mutation runs against the row's three test files.
Runner `.cache/w65/mut/run_mutations.py` (copied as `assets/65_mutations_runner.py.txt`), logs
`assets/65_mutations_part1.log`, `assets/65_mutations_part2.log`.

| Run | Mutations | Result |
|---|---|---|
| part 1, 22:46:10 to 22:49:16 (baseline 3 files / 38 tests exit 0) | R01, R02, K01 to K12 | 14 detected |
| part 2, 22:49:33 to 22:52:58 (baseline 38 exit 0) | K13, K14, P01 to P04, B01 to B03, A01 to A03, F01, G01 | 13 detected, **P04 survived** |
| part 3, 22:53:50 to 22:54:14 (baseline 3 files / 39 tests exit 0, after the Simulated control test) | P04, and K02, K07 again | 3 detected |

**P04** ("`onWait` is called although the outcome is known": in Simulated mode the marker chip would
appear and never leave, the shutter would flash twice and the control would stay busy for ever)
survived part 2: the folder's Simulated file asserts the effects of the actions, not the absence of a
waiting state. The row added the test "Simulated mode is unchanged" to its own actions file; part 3
detects P04 with it, and re-runs K02 and K07 (the two LB-4 visuals) against the new baseline. **28 of
28 mutations detected.** A03 (the Live result of `verifyAuditChain` read as a value) is detected by the
`live.misuse` assertion of each test's `afterEach`.

```
## 2026-10-05 22:49:16 WIB 14 mutations: 14 detected, 0 survived [], 0 not applied []
## 2026-10-05 22:52:58 WIB 14 mutations: 13 detected, 1 survived ['P04'], 0 not applied []
## 2026-10-05 22:54:14 WIB 3 mutations: 3 detected, 0 survived [], 0 not applied []
```

## 11. Decisions for the controller

| # | Question | Proposal |
|---|---|---|
| DN-1 | F-1: accept `ORIGIN_NOT_ALLOWED` as the refusal case of CLG (b) for A9 and B-4 (AUTHENTICATED operations, AC-C-48 cannot occur) | Accept |
| DN-2 | F-2 / DV-4: accept the `LIVE` label of the sealed item's digest in Live mode | Accept |
| DN-3 | F-3: route the DbfsMeter's CLIP reset (`components/composed/dbfs-meter.tsx:360`) to the B-8 row or a slot | Route |
| DN-4 | DV-2: A9 asks after the Spinner's 700 ms (Simulated identical) rather than at the press | Accept |
| DN-5 | DV-3: the page log goes to `webErrorSink` with CPW1-8's discipline (no error text, no stack) | Accept |

## 12. State left on the tablet and in `dems_lane_2`

| Where | Before | After |
|---|---|---|
| `dems2_tablet` lock (`emulator-user-lock.sh status tablet`, read-only) | `isKeyguardShowing=false, CredentialType=PIN, fingerprint count=1` | identical |
| App preference `dems.mobile.prefs.v1` | `{"coreLinkSource":"SIMULATED"}` | `{"coreLinkSource":"SIMULATED"}` (relaunched with `core=SIMULATED`; device-session.sh force-stopped the app at its end) |
| Secure-store entry names | `key_v1-dems.live.device.v1` | the same (the pairing stays; not unpaired, not re-paired) |
| Reverse rules, Metro 8083 | none | none (`adb reverse --list` empty; no listener) |
| `dems_lane_2` (not reset) | audit_log 95, events 77, evidence_items 13, paired_devices 1, device_credentials 1 | audit_log 106, events 88, evidence_items 14, paired_devices 1, device_credentials 1; one new session `SES-20261005-0024` SEALED as `EV-20261005-0014` |
| Ports 4422, 5177, 9397, 8083 | free | free |

No agent typed a PIN, touched the fingerprint sensor, answered a keyguard or a system prompt, or
changed a lock, an enrolment or a device setting.

## 13. Final runs, and the red that was not this row's (P11)

| Time | Command | Result | Note |
|---|---|---|---|
| 22:24 | `npm run typecheck -w @dems/core-web` | exit 2 | `src/features/session-new/index.tsx(226,33)`: W64's file in flight; nothing in this folder. Green again at 22:26 |
| 22:54 | `npm run typecheck -w @dems/core-web` | exit 2 | `src/features/evidence/use-verification.ts(226,13)`: another row's folder (`features/evidence/**`) in flight; not touched |
| 22:54 | `npm run test -w @dems/core-web -- --maxWorkers=2` | 62 files / 855 tests, 853 passed, **2 failed**, exit 1 | Both in `src/features/evidence/__tests__/evidence-integrity.test.tsx` (the same folder in flight); this row's three files 16 / 16, 10 / 10, 13 / 13 |
| **23:05** | `npm run typecheck -w @dems/core-web` | **exit 0** | the one re-run, after the evidence row's edits |
| **23:05** | `npm run lint -w @dems/core-web` | **exit 0** | no warning |
| **23:05** (load 5.73) | `npm run test -w @dems/core-web -- --maxWorkers=2` | **Test Files 69 passed (69); Tests 933 passed (933); exit 0** | this row: actions 16 / 16, panels 10 / 10, the folder's file 13 / 13 (`assets/65_gate_final.log`) |

```
## 2026-10-05 23:05:25 WIB (load 7.09)
$ npm run typecheck -w @dems/core-web     typecheck exit=0
$ npm run lint -w @dems/core-web          lint exit=0
## 2026-10-05 23:05:55 WIB
23:05  2 users, load averages: 5.73 6.44 5.56
$ npm run test -w @dems/core-web -- --maxWorkers=2
 Test Files  69 passed (69)
      Tests  933 passed (933)
exit=0
src/test/live-session-monitor-actions.test.tsx passed 16 / 16
src/test/live-session-monitor-panels.test.tsx passed 10 / 10
src/features/session-monitor/__tests__/session-monitor.test.tsx passed 13 / 13
```

Assets of the row (`implementation/assets/65_*`, 19 files): the five lane screenshots
(`65_session_monitor_live_meters_1.png`, `…_2.png`, `65_end_session_dialog_live.png`,
`65_session_sealed_live.png`, `65_tablet_live_connected.png`), the lane log, browser record and three
scripts (`65_lane_run.log`, `65_lane_browser.json`, `65_lane_run_lane2.sh.txt`,
`65_lane_device_w65.sh.txt`, `65_lane_cdp_driver.mjs.txt`), the mutation runner, config and three logs
(`65_mutations_runner.py.txt`, `65_mutations_config.mts.txt`, `65_mutations_part{1,2,3}.log`), and the
gate logs (`65_clg.log`, `65_web_suite_2243.log`, `65_shared_suite.log`, `65_gate_final.log`).

## 14. Rollback (not executed)

R-CO for the tracked files, R-NEW for the new ones (run only on the controller's instruction):

```
git checkout acaff20 -- apps/core-web/src/features/session-monitor packages/shared/src/i18n/en/session.ts
git clean -fd -- apps/core-web/src/features/session-monitor/use-pending-press.ts apps/core-web/src/test/live-session-monitor-actions.test.tsx apps/core-web/src/test/live-session-monitor-panels.test.tsx
```

Pre-images: `.cache/rollback/W65/` (the folder and `session.ts` as they were before the first edit,
blob-equal to `acaff20`; `SHA256SUMS.txt`). The lane added rows to `dems_lane_2` (section 12); they are
ordinary demo history and are not rolled back (no reset of that database, by rule).
