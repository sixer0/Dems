---
task_id: 2026-10-07_dems_real_capture_sealing
row: 137
title: Web Devices delta — camera search, candidate list, connect flow, no-device notifications, development label (R-9 / R-10 / R-11)
date: 2026-10-09
agent: coder-execution
status: needs-review
tier: 3
---

# Row 137 — web Devices delta (flows 9 to 13 on the web console)

Workspace `apps/core-web`. Built against the shared contract of operations 93-97 (row 132), the
simulator and the contract-checked fake transport. **Nothing here ran against a real Core, a
browser or the fake ONVIF stub** (D94 / D122: the browser flows are section 6). No commit, no
dependency, no lockfile write.

## 1. What was built (file:line)

| Item | Where |
|---|---|
| Op 94 factory `captureDiscoveryQueryOptions` (gate inside; polls 1 s only while `RUNNING`; read on mount and on focus), read states, panel states S1-S13, G13 `searchGate`, G14 `connectGate`, forward-only `searchProgress`, list grouping (order of the answer kept), op 93 command, controller `useCameraSearch` | `features/devices/camera-search.ts:137,160,176,210,235,249,265,333,385` |
| One search + one mic re-read per page (provider), the gated buttons "Search for cameras" / "Search again" (G13) and "Search again" for microphones (G17), reason as visible text tied with `aria-describedby` | `features/devices/camera-search-context.tsx:15,42,100` |
| Page wiring: provider, header action, panel | `features/devices/index.tsx:218,267` |
| Panel "Camera Search": idle, bounded progress (kit `ProgressBar`, fixed-number sentence, "Finishing the search…"), results (summary, networks, truncated warning, trust note, freshness + owner note), empty, "could not run", "no longer kept", unavailable / busy notices, table rows (New / Already registered / Cannot be connected / conflict / address changed / last-test chip), development group, Connect with the op 94 re-read before the dialog | `features/devices/camera-search-panel.tsx:49,88,123,161,217,273,402` |
| Connect model: neutral field names + attributes (SEC35-37), form check without values, credential as typed (D117), ops 95 / 96, refusal map of ux §8d.5, outcome tones | `features/devices/camera-connect.ts:45,86,105,173,182,215,242` |
| Connect dialog: target address + reference + "not verified" (SEC35-31), two empty fields, reveal control (off; hidden again on blur / submit / close), confirmation tick gating Test, one request per press, five outcomes, every refusal as an explained state, Add as camera, result with the FACT only, Assign / Done; no `<form>`; `value` attribute stripped from both inputs; own error boundary | `features/devices/camera-connect-dialog.tsx:77,103,127,171,220,300,334,451,472,495,561` |
| Development-source rule (Core's `sourceClass` only; Live mode only; optional members) and the one badge; 'is on' line behind the optional `sourceOpen` | `features/devices/source-class.ts:33,38,57`, `features/devices/source-badge.tsx:30,47,85` |
| Badge + "Not reachable" / local-state mark on camera tiles, audio cards, drawer header, selector lines and options, search rows, pre-check rows | `camera-tile.tsx:83`, `audio-input-card.tsx:112`, `device-drawer.tsx:128`, `capture-selector-panel.tsx:128,188,315`, `session-new/devices-step.tsx:302` |
| Op 97: gate, command, local-device states (ready / permission needed / in use / not found / could not be opened), result block in the Audio panel | `features/devices/capture-inputs.ts:38,72,97,171`, `features/devices/mic-rescan.tsx:16,43`; mounted `features/devices/index.tsx:259` |
| Notices A and B read from `alerts` by `params.reason` (labels + ids + counts only), strip on Devices with "Search again", row marks, alert-centre line | `lib/capture-notices.ts:60,83,143,161`, `features/devices/capture-notices.tsx:23,59` (mounted `index.tsx:233`), `components/shell/notifications-bell.tsx:82` |
| Pre-check: `UNREACHABLE` item drawn from `params.rule` (D114), count of the pre-check's one search, "Search again" (G13 / G17) beside Retry; no mic toggle (D83) | `lib/capture-notices.ts:188,200`, `session-new/model.ts:131`, `session-new/devices-step.tsx:77,107,217`, `features/devices/precheck-search.tsx:23` |
| Selector empty-state slot filled (row 67's `data-slot="camera-search-entry"`) | `capture-selector-panel.tsx:406` |
| D100 (2): camera Restart in Live mode = confirmation dialog, then device command `POE_CYCLE`, sent as op 48 with `{ confirm: true }` | `features/devices/index.tsx:130,189,285`; `packages/shared/src/live/source/bindings.ts:484` |
| Strings: six blocks of ux §14.2 in `common` (verbatim; plural pairs), web-only block `devices.search` | `packages/shared/src/i18n/en/common.ts:709`, `en/devices.ts:360` |
| Try-it deny list: confirmed, unchanged — 10 entries, 95 and 96 among them | `features/api-reference/try-it.ts:42-53` |

## 2. Real vs stand-in

- Real: the console's reads, gates, commands and UI in both data modes. In Simulated mode the whole flow runs on the simulator's own ops 93-97 (search → test → add `CAM-03` → the selector offers it).
- Stand-in: Live mode is proven on the fake transport only (registry-checked requests and answers).
- Simulated mode shows no badge (D83 / D91); the development GROUP of the search list is still drawn there, because the simulator's new candidate is a development source and the dialog needs that fact ("needs no password").

## 3. Commands and results (2026-10-09, each once; repeats only after a fail)

| Command | Result |
|---|---|
| `npm run typecheck -w @dems/core-web` | 1 error, not this row's: `src/features/evidence/__tests__/verify-v2.test.tsx(246,50)` (`V-15`, rows 87 / 141). 0 errors in this row's files |
| `npm run lint -w @dems/core-web` | exit 0, 0 warnings |
| `npm run test -w @dems/core-web -- --maxWorkers=2 src/features/devices src/features/session-new src/test/live-devices-{capture-selector,commands,drawer,clip}.test.tsx src/test/live-session-new-precheck.test.tsx src/test/live-shell-notices.test.tsx src/test/live-static-ac-c-53.test.ts src/test/live-runtime-static.test.tsx src/test/fxr-w-nits.test.tsx src/test/fxr-w-dev-console-logging.test.tsx src/test/live-w0-page-logs.test.tsx src/test/live-api-reference-page.test.tsx src/test/scalar-config.test.ts` | 24 files, 227 tests passed |
| after two type fixes in the new tests: `camera-connect-canary.test.tsx`, `camera-connect.test.tsx` | 13 passed |
| `npx vitest run --root packages/shared test/i18n.test.ts test/i18n-vocabulary-sync.test.ts test/live-source-bindings.test.ts` | first run: 1 failed (the binding pin of `POE_CYCLE`, expected by the D100 change); assertion followed; `live-source-bindings.test.ts` re-run: 108 passed. The two i18n files passed in the first run |
| `npm run typecheck -w @dems/shared` | no error |
| Negative control 1 — role rule removed from `searchGate` | red: 2 tests of `camera-search.test.tsx` (model G13, `M4-DISC-RBAC-W`); file restored |
| Negative control 2 — confirmation tick removed from `canTest` | red: 1 test of `camera-connect.test.tsx` ("enables Test only after the tick"); file restored |

New test files: `features/devices/__tests__/camera-search.test.tsx` (10), `camera-connect.test.tsx` (11),
`camera-connect-canary.test.tsx` (2, Live), `capture-notices.test.tsx` (11), `session-new/__tests__/precheck-unreachable.test.tsx` (2).

Canary (`camera-connect-canary.test.tsx`): the typed user name AND password are in the bodies of
ops 95 / 96 exactly as typed (password with its spaces) and in none of: web error sink, page sink,
console calls, toasts, markup (also while typed: no attribute of either input), query keys, query
data and errors, mutation cache, request URLs, location, local / session storage. Control: the same
search finds both in the sent bodies.

## 4. Checks for the test runner

| Command | Lock | Expected |
|---|---|---|
| `npm run test -w @dems/core-web -- --maxWorkers=2` (whole workspace, `M4-RG-WEB`) | none | green except what other rows hold open; this row expects no red of its own. Watch `src/test/live-shell-notices.test.tsx` "Lock console with the Core unreachable": failed once in a mid-work run, passed in the final run — not explained |
| `npx vitest run --root packages/shared` | none | green (this row touched `i18n/en/common.ts`, `i18n/en/devices.ts`, `live/source/bindings.ts`) |
| `npm run typecheck -w @dems/mobile` and mobile i18n missing-key check | none | unchanged: `common` gained keys only |
| Browser flows of section 6 | lane web + fake ONVIF stub | per flow |

## 5. To wire / open

1. **System entry link (WB-07)** — `features/system/settings-panel.tsx` is not this row's: request filed (`file_requests.md`, row 137). The key `devices.search.openFromSystem` and the `#camera-search` scroll exist.
2. **`sourceOpen`** ('is on' indicator) is not in the shared slice schema: `LocalSourceOn` reads it as an optional member and draws nothing until it exists.
3. **Built-in devices carry no `adapter` / `sourceClass`** until rows 136 / 139 send them: no badge on them today. `M4-DEVSRC-LABEL-W` needs that data.
4. **Monitor and Dashboard tiles (WB-01, WB-02), evidence surfaces (WB-04)**: the badge component is ready (`TrackSourceMarks`, `MicSourceMarks`); the mounts are in folders of rows 87 / 139 / 141. 'Connecting cameras…' needs `captureDurable` (C1) and is row 139's surface.
5. **Dashboard kebab Restart of a camera** (`features/dashboard/devices-panel.tsx`) still sends plain `RESTART`; the Core refuses it for a camera. Same two-line follow as `features/devices/index.tsx`; not this row's folder.
6. **A registered `CAM-NN` has no drawer**: "View device" opens the drawer for CAM-01 / CAM-02 and scrolls to the selector for an added camera.
7. Local camera cause on Devices reaches the console only through the situation-B alert (accepted limit OP-125-4).

## 6. Browser checks left for the M4 gate (scripted flows; lane web, fixture credentials on the fake stub; 1 run each, D122)

| Flow | Steps | Asserts |
|---|---|---|
| **W-DISC** (SUPERVISOR; stub N = 3: one registered, one new, one development) | open Devices → controls pass "Checking your permissions…" → Search for cameras → progress → list → Search again | `M4-DISC-W` (S1→S3→S4, N rows, New / Already registered, development group, freshness line, list replaced) |
| **W-DISC-EMPTY** (stub empty) | search ×5 → strip + bell → stub with one responder → search | `M4-DISC-EMPTY-W` (empty state, ONE strip item, ONE bell item; after the responder 0 items) |
| **W-DISC-ROLES** (INVESTIGATOR, then a second SUPERVISOR session in another browser context) | open Devices; request log | `M4-DISC-RBAC-W` (disabled + role sentence, 0 calls of op 94), `M4-DISC-OWNER-W` (second session: no list, the alert only) |
| **W-CONN** (stub modes: reachable, unreachable, auth-failed, wrong-profile, not-H.264; one development source) | Connect → fields empty at open, after 1 s, after focus (saved console login in the profile) → attributes → tick → each outcome → development source added without a password → Assign in the selector → add WITH a password | `M4-CONN-W`, `M4-SEC-UI-1` (address + reference shown, Test disabled until the tick, reveal off at start and after blur / submit / close, Try-it refuses 95 / 96, deny list 10), `M4-CONN-NOCRED-1` UI half ("This Core cannot store camera passwords yet…" before row 84); after each run 0 occurrences of the fixture password in page text, DOM snapshot, field values, storage, URL, console. **No capture while the reveal control is on** (`data-reveal="off"` on `camera-connect-password` is asserted before every screenshot) |
| **W-CONN-ABANDON** | each exit of ux §8d.7 (close before a test, after a failed test, after a passing test; reload mid-flow; sign-out) + row counts | `M4-CONN-ABANDON-W` (0 new rows in `capture_devices` / `capture_device_credentials`) |
| **W-CONN-LOCK** (session open from the tablet) | Devices → search → Connect; then open a session while the dialog is open | `M4-CONN-LOCK-W` (Connect disabled with its sentence, 0 toasts, search works; in the dialog the accent alert, Test / Add disabled) |
| **W-CONN-GUARD** (fake clock on the Core) | two refused passwords → third press | `M4-CONN-GUARD-W` (attempts-left text = the server's value, then the lock-out sentence with a clock time, Test disabled, no countdown) |
| **W-PRECHECK** | Session New with one fake camera stopped → acknowledge → start; both stopped; active mic removed → cancel → Make primary on Devices → start again; standby removed; a later reachable run | `M4-NODEV-B-W`, `M4-MIC-ACTIVE-W` (blocked sentence, no toggle control, then warning + degraded start), 0 stale strip items |
| **W-MIC** | Devices → Search again in the microphone panel; request log | `M4-MIC-RESCAN-W` (one op 97, per-microphone result, 0 network probes) |
| **W-DEVSRC** (development configuration, then the flag off) | Devices rows, selector, search list, pre-check | `M4-DEVSRC-LABEL-W` (badge on each surface; flag off: 0 badges, 0 local rows, no group header). Needs item 3 of section 5 |
| re-run at M7 | W-CONN "add WITH a password" | `M7-CONN-W-CRED` |

Component-level checks already run here: `M4-DEVSRC-LOCAL`, `M4-UX-UNIT`, the UI half of `M4-CONN-NOCRED-1`. `M4-UX-VOC-1` / `M4-UX-A11Y-1`: the keys are §14.2 verbatim and the a11y points of §14.3 are built (roles, live regions, `aria-describedby`, focus to the outcome); no automated vocabulary or axe check was added by this row.

## 7. Decisions and deviations (for the controller)

| # | Decision | Why |
|---|---|---|
| D-137-1 | The op 94 factory lives in `features/devices/camera-search.ts`, not in `lib/core-queries.ts` | D95: that file is another row's; precedent `stt-config-queries.ts` |
| D-137-2 | Badge rule "only in real capture" = Live client mode + the Core's `sourceClass`. Op 71 is NOT read | op 71 needs `DEMO_CONTROL`; most roles cannot read it. A Core in simulated capture is told apart by sending no `sourceClass` for its built-ins — this must stay true in rows 136 / 139 |
| D-137-3 | Notices A / B are a strip of kit `Alert`s under the page header, not new kinds of `DevicesBanner` | the banner is one line over nine fixed devices; each notice needs its own action |
| D-137-4 | The search panel stands directly above the selector, not first under the banner | Add as camera → Assign continues downward into the selector |
| D-137-5 | D100 fixed in two places: the shared Live binding sends `{ confirm: true }` for `POE_CYCLE` only; the Devices page asks for the confirmation and then sends `POE_CYCLE` | keeps LB-1 / CL-22 / presenter behaviour of the command path; `RESTART` of a camera stays refused by the Core. Seven Live tests of `live-devices-commands.test.tsx` and one shared binding assertion follow the new behaviour (same assertions, one confirmation step, `command: 'POE_CYCLE'`, body `{ confirm: true }`) |
| D-137-6 | The `value` attribute of both camera fields is removed by a mutation observer | React mirrors a controlled input's text into the attribute; ux §14.3 forbids a value in any attribute. Removal is in the same task, not the same instant |
| D-137-7 | `{ field: 'credential.password', value: X }` is NOT blanked by `@dems/shared/redaction` (measured; the member names say nothing). The dialog never builds such a record; the canary test holds that as a first-line rule and records the gap as a negative control | finding for the redaction owner, not changed here |
| D-137-8 | `common.rbac.checking` and `common.session.connectingCameras` were not added (135 of the 137 keys, + 2 `openFailed.camera` / `.microphone` leaves so a row names one device) | D100 (4): the checking sentence stays per namespace; the session key is row 139's |
| D-137-9 | At `failedAttemptsRemaining: 0` (a 200 answer, no `retry-after`) the dialog says the lock-out sentence without a time (`devices.search.lockoutNoTime`) | the §14.2 sentence needs a time the answer does not carry |
| D-137-10 | Pre-check "Search again" shows only the counts of the search; the list stays on Devices | the list belongs to the searching session and its surface is the Devices panel |

Process notes: edits in files outside this row's new files were exact-string replacements with an
assertion that the anchor exists (`session-new/devices-step.tsx`, `session-new/model.ts`,
`notifications-bell.tsx`, the devices page files, `live-devices-commands.test.tsx`); the shared i18n
files, `bindings.ts`, its test and `live-harness.ts` were edited with the Edit tool. An existing
assertion of row 67 ("the slot is empty, no button") was replaced by "the slot holds the one search
button", because this row fills that slot. `masterplan/02_plan.md` and `status_tasks.md` not written (D94).
