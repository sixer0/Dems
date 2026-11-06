---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: W78 (step 100)
agent: coder-execution
date: 2026-10-06
status: complete
source_plan: masterplan/02_plan.md (row W78, gates SG and CLG)
---

# W78 — Mobile Devices in LIVE mode (settle sites S2-8, S3-2, S5-4)

## 1. Result at a glance

| Item | Result | Evidence |
|---|---|---|
| S2-8 `startDiagnostics` (operation 65) | Through `useCoreActions()` + `settle`; the sheet opens in `ok`; LB-1 busy/spinner on "Diagnostics" and "Run again" | `device-detail.tsx:161-181, 277-283, 312-316`; 4 Live tests |
| S3-2 `DeviceCommandDialog` (operations 48, 49) | Busy until the settle, success toast in `ok`, danger toast in `fail`, closed in `done` (AC-C-63); 409 `RECORDING_ACTIVE` / `COMMAND_UNSUPPORTED` worded (D89) | `device-command-dialog.tsx:49-104`; 13 Live tests |
| S5-4 Restart hint | Kept as a hint (replicated role); the Core's 403 shows the denied toast (AC-C-48) | `use-devices-data.ts:26-33`, `device-detail.tsx:196-197`; 3 Live tests |
| Clip reset (operation 52), not a named site | Through `settle` too (else an unhandled rejection in LIVE) | `device-detail.tsx:183-194`; 2 Live tests |
| LIVE copy (rule 8, MD-8) | No "simulated" in LIVE; Simulated copy byte-identical to `acaff20` (digest pinned) | `i18n.ts:87-108`; static test |
| CLG (a) existing tests | 4 files of `acaff20` unchanged, green | §5.1 |
| CLG (b) one Live test per site | 22 Live tests + 9 static tests on the fake transport | §5.2, `assets/78_live_tests_verbose.txt` |
| CLG (c) no `useSimActions` / `.actions` on a Sim | 0 (two `styles.actions` only) | §5.1, `assets/78_clg_a_c.log` |
| CLG (d) device check | Phone, lane 1, one sitting 23:53:11–23:56:51: LIVE Test signal → Core 204 → toast; SIMULATED screen; ends `core=SIMULATED` | §6, `assets/78_device_run.log`, 11 screencaps |
| Gate | `@dems/mobile` 110 suites / 1,396 tests exit 0; typecheck 0; lint 0 errors 0 warnings | §5.3, `assets/78_gate.log` |
| Mutation check (M15, in memory) | 28 detected of 28; tree unchanged | §5.4, `assets/78_mutations.log` |
| Controller notes of 23:4x | StrictMode test added (F69-1, D158); hook byte-equal to Start Session's | §3.5, §5.2 |

## 2. Sources read (binding)

`masterplan/02_plan.md` row W78 (line 752), §8.1 (SG, CLG), §11; `masterplan/04_client_integration_spec.md`
§8.1 (LB-1 to LB-10), §8.6 S2-8, §8.7 S3-1/S3-2/S5-4, §3.2 (MD-8), §6.1–6.2, AC-C-48, AC-C-63;
`gateway_check/09_cp_mobile_runtime.md` §4 answer 3 (the ten rules); `gateway_check/09a_m0_link_rule.md` §10;
`implementation/51_mobile_runtime.md` §3.4, §4; `implementation/60_mobile_pairing_gate.md` §7–8;
`implementation/36_module_devices.md` §4, F-6 and decision D89; `implementation/63_web_dashboard.md` F63-1;
`implementation/44_live_source.md` F66-8 (test rules, decision F59); W67's `use-session-new.ts` and test bed
(the same idioms on the same runtime).

## 3. What was built (all under `apps/mobile/src/features/devices/`)

### 3.1 The detail (`device-detail.tsx`)

| Change | Where | Why |
|---|---|---|
| `useSimActions()` → `useCoreActions()` (rule 1) | `:146` | One way in; `coreActionsOf(sim)` returns `sim.actions` itself, so Simulated timing is unchanged (CL-12) |
| `live = useCoreLink().source === 'LIVE'` (rule 5), handed to the dialog, sheet and tabs as a plain value | `:147`, `:244-246`, `:314`, `:322` | One LIVE idiom in one file; the dialog and sheet content is portalled, so it reads no runtime hook |
| S2-8: `startDiagnostics(started?)` = `diagnosticsPress.run` + `settle(() => actions.runDiagnostics(), { ok: started, fail, done: release })`; the button calls `startDiagnostics(() => setDiagnosticsOpen(true))` | `:161-181`, `:277` | "The sheet opens in `ok`" [CS:§8.6 S2-8]; the consumer's `if` moved into `ok` |
| `fail`: Live → presenter first, log `warn`; else log `error` (and, Live only, the existing `failedToStart` toast) | `:166-175` | Rule 2; Simulated keeps its old branch exactly (log only) |
| LB-1 on "Diagnostics": `busyState(busy)`; `Spinner` replaces the icon when `pending` | `:281-282` | Busy at once, spinner late |
| "Run again" gets `runAgainBusy`/`runAgainPending` | `:312-316` | Same command, same in-flight flag |
| Clip reset through `settle`; Live → presenter; always logged `warn` | `:183-194` | `actions.resetClip` returns a promise in LIVE: the old `try/catch` would not catch its rejection |
| Log: in LIVE a DEVICE_COMMAND row is named by `features.devices.live.command.*` (TEST_SIGNAL, RESTART, IDENTIFY) | `:569-588` | No "(simulated)" in LIVE; IDENTIFY rows come from the web console on a shared Core |

### 3.2 The dialog (`device-command-dialog.tsx`) — S3-2

`press.run(release => settle(() => onConfirm(command), { ok: success toast, fail, done: release + onClose }))`
(`:69-97`). `onConfirm` is typed `CoreResult<void>` (`:46`). While the command is out: a second confirm is
ignored (in-flight ref), Cancel and the overlay do not close (`:99-103`), the confirm button is marked busy
with no visual change, and after `LIVE_PENDING_REVEAL_MS` a `Spinner` shows in it and Cancel is disabled
(`:122-127`). In LIVE the `fail` branch hands the error to the presenter first (`:85-88`); what it leaves is
worded by `liveRefusalLabel` (`:49-55`): 409 `RECORDING_ACTIVE` → "Not available while recording", 409
`COMMAND_UNSUPPORTED` → "{{name}} does not accept this command.", 404 → "This device is not part of this
room.", else the existing generic text; a 409 is logged as `warn` (`:57-59`). Simulated: generic toast and
`error` log, as before.

### 3.3 Sheet, chart, copy, hint

| File | Change |
|---|---|
| `diagnostics-sheet.tsx:63, 103-112` | `live` → subtitle `features.devices.live.diagnosticsSubtitle`; "Run again" busy/spinner props |
| `health-chart.tsx:90` | `live` → caption `features.devices.live.samples` ("Last N samples") |
| `i18n.ts:87-108` | `live.*`, 11 texts, additive; the 44 earlier texts unchanged (digest `46379c83…` equals `acaff20`'s) |
| `use-devices-data.ts:26-33` | S5-4 doc only (the hint is kept; the SIM-GAP-M84-3 marker untouched) |

### 3.4 New files

| File | What |
|---|---|
| `use-pending-press.ts` | **Byte-equal** copy of `features/session-new/use-pending-press.ts` (sha256 `a1a38ac8249d7bda…`, both files, `assets/78_clg_a_c.log`) |
| `busy-state.ts` | `busyState(busy, disabled)` (kept out of the hook file so the hook stays byte-equal) |
| `testing/live-devices-bed.tsx` | The app's real Live source over the fake transport, real devices routes, an engine simulator per test; operator choice; delta/answer order; answer delay; `strict` (StrictMode inside the providers) |
| `live-devices-sites.test.tsx` | 22 tests (§5.2) |
| `devices-live-static.test.ts` | 9 static tests (CLG c, rules 1–5, 7, 8; copy digest; marker count) |

### 3.5 Controller notes (received mid-row)

1. **F69-1 / D158 (StrictMode).** No component of the folder starts a Core command from an effect (the three
   effects animate: `device-row.tsx:238`, `device-status-chip.tsx:24`, `use-sheet-presence.tsx:51,70`). New
   test: list + three details mount under `<StrictMode>`, Health and Log tabs opened → **0** command requests;
   then one press of Diagnostics → exactly ONE `runDiagnostics`, one Test signal → exactly ONE
   `testDeviceSignal`. Mutant SM1 (a mount effect that calls `runDiagnostics`) is detected.
2. **Hook duplicate.** Made byte-equal to Start Session's copy (above); `busyState` moved to `busy-state.ts`.
   Start Session has its own local `busyState` in `session-new-screen.tsx:656` — a second item for M1.
3. **Typecheck red at 23:34** (`testing/live-devices-bed.tsx:64`, `AudioTrackId` imported from the wrong
   module) — fixed 23:44; green since.
4. **Pending summary on lane 1.** It opened first after the LIVE sign-in (`assets/78_phone_after_sign_in.png`)
   but did not block the deep link to the Devices detail, so it was **not** acknowledged (§8).

## 4. Contract gaps found (no SIM-GAP marker added)

| ID | What the Live screen lacks | Where | Status |
|---|---|---|---|
| CONTRACT-GAP-W78-1 | The Core serves no camera picture: the contract has status reads only (operation 46 `getVideoStatus`) and no stream. In LIVE the camera hero keeps the bundled demo loop, gated by the Core's camera status (NO SIGNAL on a fault) | `apps/mobile/src/features/devices/device-detail.tsx:344-366` (`CameraFeed mode='live'` at `:358`) | Unchanged; for W83 (the same holds for the monitor screen, W68) |
| CONTRACT-GAP-W78-2 | The Core serves no per-device health history: in LIVE the line of a camera, the PoE switch, the relay and the tablet is derived on the tablet from the replicated `network.bandwidth.history` and fault state (the Live twin of SIM-GAP-M84-2); the microphone line is the 1 s peak of the Core's meter frames | `apps/mobile/src/features/devices/sim-adapter.ts:117-167`; caption `health-chart.tsx:90` | Unchanged; DN-4 asks whether the LIVE caption should say "derived" |

## 5. Verification (commands from the repo root; outputs quoted)

### 5.1 CLG (a) and (c) — `assets/78_clg_a_c.log`

```
## 2026-10-05 23:57:48 WIB CLG (a): the folder's existing test files are absent from git diff --stat acaff20
apps/mobile/src/features/devices/devices-model.test.ts
apps/mobile/src/features/devices/devices-screen.test.tsx
apps/mobile/src/features/devices/testing/devices-harness.tsx
apps/mobile/src/features/devices/testing/devices-test-setup.ts
$ git diff --stat acaff20 -- <those files>   (empty = unchanged)
exit=0
$ git diff --stat acaff20 -- apps/mobile/src/features/devices
 6 files changed, 270 insertions(+), 76 deletions(-)      (the six production files of §3)
## CLG (c), corrected: the same scan with quoted text (i18n keys) removed first, comments kept
apps/mobile/src/features/devices/device-command-dialog.tsx:121: styles.actions
apps/mobile/src/features/devices/device-detail.tsx:270: styles.actions
2 hits: only style objects
## KI-07 (no new SIM-GAP): IDs / markers in apps/mobile/src
13 IDs / 62 markers
```

(The first, plain `grep -E "useSimActions|\.actions\b"` of the log also lists `t('…devices.actions.…')` keys:
quoted i18n keys, not reads; the corrected scan strips quotes first. The static test does the same.)

### 5.2 CLG (b) — the Live tests (`assets/78_live_tests_verbose.txt`, 31 names)

| Site | Success | Refusal (403) | Outage | 409 / other |
|---|---|---|---|---|
| S3-2 Test signal (49) | toast only after the 204 (answer delayed 2 s; delta first is HELD by the Live source, so row and toast land together, CL-16); answer-first variant; busy, no spinner, spinner after 420 ms; second press and Cancel ignored | built guard answer (operation 49 has no `notPermitted` example; its first 403 example is `deviceRevoked`) → "Not permitted" / "Requires the Investigator role" | "Core server unreachable" / "Nothing was changed."; retry sends again | 409 `commandUnsupported` example → own wording; 429 → limit toast "Try again in 30 s." |
| S3-2 Restart (48) | toast after the 204, audit row | example `notPermitted` → "Requires the Technician role" | offline toast | 409 `recordingActive` example → "Not available while recording"; 409 `commandUnsupported` example |
| S5-4 hint | INVESTIGATOR: Restart disabled, "Requires the Technician role", Test signal open; Core recording → "Not available while recording" | (the Restart 403 above) | | |
| S2-8 Diagnostics (65) | sheet only after the 202 (answer delayed); busy/spinner; checks resolve on the Core; LIVE subtitle; Run again busy/spinner | built guard answer → denied toast, sheet closed, button idle | offline toast, sheet closed, retry opens it | |
| Clip reset (52) | the Core clears the latch | | offline toast, latch stays | |
| StrictMode | 0 commands at mount, ONE per press | | | |
| Simulated pin | the same sites in SIMULATED: "(simulated)" toast, Simulated body, Log, subtitle; nothing marked busy | | | |

Each test ends with `mobile.stop()` and `fake.assertNoViolations()`; `resetCoreErrorPresenterForTests()` runs in
`beforeEach` (rule 2); `getMissingKeys()` is empty after each.

### 5.3 SG — the gate (`assets/78_gate.log`)

```
## 2026-10-05 23:58:08 WIB 23:58  2 users, load averages: 5.04 5.36 6.16
## $ npm run test -w @dems/mobile -- --maxWorkers=2
exit=0
Test Suites: 110 passed, 110 total
Tests:       1396 passed, 1396 total
Time:        59.929 s
## 23:59:17 $ npm run typecheck -w @dems/mobile
> tsc --noEmit
exit=0
## 23:59:22 $ npm run lint -w @dems/mobile
> eslint .
exit=0
## 23:59:33 $ npm run test -w @dems/mobile -- --maxWorkers=2 src/features/devices
Test Suites: 4 passed, 4 total
Tests:       51 passed, 51 total
exit=0
```

No red file of another row at 23:58 (the floor was 96 suites / 1,257 at 22:38; other rows landed on top). The
known "A worker process has failed to exit gracefully" line appears once, as in every whole-suite run before
this row. **Ledger (L-1):** W78 adds 2 suites and 31 tests to `@dems/mobile`
(`live-devices-sites.test.tsx` 22, `devices-live-static.test.ts` 9); no existing test changed.

### 5.4 Mutation check (rule M15) — `assets/78_mutations.log`

Method of M0/W56: a jest transformer outside the tree (`.cache/w78/mut/`, copied as `assets/78_mutat*`,
`78_jest_mut_config.cjs.txt`) applies one mutant in memory to one production file; the four test files of the
folder run; detected = jest exit ≠ 0.

```
# W78 mutation check, 2026-10-05 23:45:20; 4 test files per run; the tree is not edited
control (no mutation): exit=0 Tests:       51 passed, 51 total (7 s)
DC1  detected … the success toast shows at the press, before the answer (AC-C-63)
…
SM1  detected … a Core command starts from a mount effect (F69-1: twice under StrictMode)
…
## 28 detected, 0 not detected, 0 not applied, of 28
## the mutated files in the tree, before and after: identical
```

Mutants cover: toast/close timing (DC1, DC2, DC10), presenter (DC3, DD2, DD3), 409 wording (DC4), LIVE copy
(DC5, DC6, DD7, DS1, HC1, I1), LB-1 (DC7, DC8, DD5, DD6, DD8, PP1–PP5), Cancel while busy (DC9), sheet in `ok`
(DD1), double press (DD9), LIVE branch (DD4), StrictMode (SM1). The static test reads files from disk, so its
own checks are covered by the positive controls inside it, not by this runner.

## 6. Device check (CLG d) — phone `dems2_phone`, lane 1, `assets/78_device_run.log`

Run as `/usr/bin/lockf -k -t 600 .locks/core-server.lane1.lock /bin/sh .cache/w78/run_w78.sh` (scripts
`assets/78_run_w78.sh.txt`, `78_device_w78.sh.txt`, `78_sign_in_w78.mts.txt` — W66's sign-in typing into the
app's own fields; steps `78_device_steps.txt`). One device session, 23:53:11 → 23:56:51 (3 min 40 s), exit 0.
Lock status (read-only `emulator-user-lock.sh status all`), `assets/78_lock_status_start_end.txt`:

```
# before (23:50:51)
phone (emulator-5554): AVD dems2_phone, isKeyguardShowing=false, CredentialType=PIN, fingerprint count=1, lock screen disabled=unreadable
tablet (emulator-5556): AVD dems2_tablet, isKeyguardShowing=false, CredentialType=PIN, fingerprint count=1, lock screen disabled=unreadable
# after (23:57:01)   identical (diff -q: "lock status identical")
```

| Step | Evidence | Screencap |
|---|---|---|
| LIVE cold start `demsdemo:///?core=LIVE`, paired | `runtime.live.ready`; `GET /api/v1/pairing/device 200` | `78_phone_login_live.png` |
| Scripted sign-in, seeded SUPERVISOR (holds DIAGNOSTICS_RUN) | `the app's sign-in request: status 200`; credential/token lines: device JS log 0, backend log 0 | `78_phone_after_sign_in.png` (the pending summary + the app's biometric offer, declined "Not now") |
| Devices detail in LIVE (`demsdemo:///devices/POE-SWITCH`) | Restart disabled, "Requires the Technician role" (S5-4 hint) | `78_phone_detail_live.png` |
| Test signal dialog, LIVE words | uiautomator: "A short test tone or pattern is sent and the Core writes the command to its audit log." | `78_phone_dialog_live.png` |
| Confirm → **settled command** | app: `DEMS-LIVE] POST /api/v1/device/{id}/test-signal 204`; server: `1 POST /api/v1/device/:id/test-signal 204 principal=operator` | `78_phone_test_signal_toast_live.png` ("Test signal sent to PoE Switch") |
| The Core's row in the Log | "Device command sent · Test signal" 23:54:54 | `78_phone_log_live.png` |
| SIMULATED launch `demsdemo:///?core=SIMULATED` (stored, D124) | prefs `{"coreLinkSource":"SIMULATED"}`; `Core requests after the SIMULATED launch (must be 0): 0`; `live.misuse 0`, token lines 0 | `78_phone_simulated_start.png` |
| Same screen in SIMULATED (simulator sign-in, offer declined) | "Simulated. A short test tone…" body; toast "Test signal sent to PoE Switch (simulated)" | `78_phone_detail_simulated.png`, `78_phone_dialog_simulated.png`, `78_phone_test_signal_toast_simulated.png` |
| Left as found | Sign out from More; app at its Login screen in SIMULATED | `78_phone_simulated_after_sign_out.png` |
| Teardown | `shutdown complete`; `lsof exit 1 (1 = none)` for 4421/8083; `adb reverse --list` empty; lane pid file emptied | log §3–4 |

Backend requests of the session: `GET auth/session 401`, `GET auth/status 200`, `GET health 200`, `GET
pairing/device 200`, `POST auth/sign-in 200`, `POST auth/touch 200`, `POST device/:id/test-signal 204`; sockets
2 opened, 2 closed; bearer/cookie/credential lines in the server log 0. The demo password appears in no asset
(counted 0 by a script that never prints it); the only `dvc_`/`bio_` strings in the assets are the scripts' own
detection patterns. The Core's 403/409 were not provoked on the device (SUPERVISOR cannot press Restart); they
are covered by jest (§5.2).

## 7. Findings

| ID | Finding | Evidence | For |
|---|---|---|---|
| F78-1 | The Live source HOLDS a delta that arrives before the command's answer (command gate, CL-16): the audit row and the success toast land in the same turn. A test that expects the row before the answer is wrong; the suite pins the held state | `packages/shared/src/live/source/command-gate.ts:9-16`; test "success: the success toast only after the Core's 204" | client rows' test authors |
| F78-2 | Permissions — mobile vs the Core (F63-1's question): Test signal open to every role in the app, the Core asks DIAGNOSTICS_RUN which every seeded role holds; Diagnostics the same; Restart: app DEVICE_MANAGE + not recording, Core DEVICE_MANAGE + 409 `RECORDING_ACTIVE`. **No difference on mobile**; the app's rules are unchanged | operations 48 and 49 `packages/shared/src/api/devices.ts:131-180`, operation 65 `packages/shared/src/api/system.ts:128-150`; `device-detail.tsx:196-197` | controller |
| F78-3 | The SIM-GAP-M84-3 text ("`deviceCommand` checks no permission") is stale: the simulator now checks DEVICE_MANAGE / DIAGNOSTICS_RUN. Not edited (the marker count of KI-07 must stay) | `sim-adapter.ts:17`; `packages/shared/src/sim/maintenance.ts:204-207` | W83 / W100 close-out |
| F78-4 | In LIVE the Log can hold IDENTIFY rows sent from the web console; the Simulated mapping names every non-TEST_SIGNAL command "Restart (simulated)". LIVE now names IDENTIFY; Simulated unchanged (its simulator never sends IDENTIFY) | `device-detail.tsx:569-588` | info |
| F78-5 | Second copy of the pending-press hook (byte-equal) and a second `busyState` (`session-new-screen.tsx:656` vs `busy-state.ts`) | §3.4 | M1 |
| F78-6 | W70 (web, in flight, uncommitted) added shared `devices.live.*` keys; mobile uses its own `features.devices.live.*` so it does not depend on an uncommitted file | `packages/shared/src/i18n/en/devices.ts` (working tree) | DN-1 |
| F78-7 | Pre-existing noise in every devices suite: HeroUI's `[colorKit.RGB]` console error (36 times in the Simulated suite alone) | `.cache/w78/run3.log` | info |

## 8. Deviations

| ID | Deviation | Reason |
|---|---|---|
| DV-1 | The clip reset (operation 52) went through `settle` although it is no named site | In LIVE its rejection would be unhandled; result still ignored |
| DV-2 | Device sign-in as SUPERVISOR, not TECHNICIAN | Test signal needs DIAGNOSTICS_RUN (SUPERVISOR holds it); SUPERVISOR could have acknowledged the pending summary had it blocked; Restart shown disabled (S5-4) instead of pressed |
| DV-3 | The pending summary SES-20261005-0026 was NOT acknowledged | It did not block the Devices deep link (controller note 4) |
| DV-4 | Two read-only shell commands early in the row contained a `cd` (a no-op `cd …DEMS` before a listing at 23:14, and a `(cd …; true)` subshell in the pre-image command at 23:20) | Mistakes against the letter of "never cd"; no state changed. Every later command used absolute paths; the device scripts use `npm --prefix` |
| DV-5 | The mutation runner gives its jest subprocess `cwd=apps/mobile` | As M0's runner: the app's babel resolves `@/` from its folder; no shell `cd` |
| DV-6 | An empty scratch file `.cache/w78_probe.mts` was created by mistake outside `.cache/w78/` and deleted at once | My own new file; nothing else touched |
| DV-7 | My progress line of 23:38 said "typecheck 0" before the bed's import error was found | Corrected in the 23:44 line |
| DV-8 | The dialog closes in `done` also after an outage | S3-1/S3-2 literally; LB-6's "stays open" is about what was typed, and this dialog holds nothing typed (DN-2) |

## 9. Decisions for the controller

| # | Decision | Recommendation |
|---|---|---|
| DN-1 | LIVE copy lives in `features.devices.live.*` (mobile) while W70 adds `devices.live.*` (shared, uncommitted) | Keep; unify in the close-out once W70 is committed |
| DN-2 | Dialog closes on an outage (DV-8) | Keep S3-1's rule; the toast says nothing changed |
| DN-3 | CONTRACT-GAP-W78-1 (no camera picture) and -2 (no per-device health history) | Route to W83 with W68 |
| DN-4 | The LIVE health caption reads "Last N samples" (as the web, W70) although the line is derived on the client | Decide for both clients; a change is one i18n value each |
| DN-5 | Lane 1 keeps the unacknowledged summary of SES-20261005-0026 | The row that owns it, or W94, acknowledges it |
| DN-6 | Ledger `@dems/mobile` +2 suites / +31 tests (W78) | Record |

## 10. Error handling and logging

Every failure path writes the persistent runtime log (`reportRuntimeIssue`, privacy-filtered by key name):
`devices.diagnostics` (warn when presented, else error), `devices.command` (warn for a presented refusal or a
409, else error), `devices.resetClip` (warn). Context holds `deviceId`, `command`, `channel` only — no
credential, no operator data. User feedback: the presenter's toast in LIVE, the site's own toast otherwise;
graceful degradation: the control returns to idle, the sheet stays closed, the dialog closes with a toast.

## 11. State left on the device and its lane

| What | State |
|---|---|
| Phone app | Force-stopped by `device-session.sh` at the end; prefs `{"coreLinkSource":"SIMULATED"}`; simulator signed out (Login screen) |
| Pairing | Untouched: DEV-0001 on `dems_lane_1`, secure-store item kept; nothing unpaired, no lane reset |
| `dems_lane_1` | `audit_log` 152 → 158 (the sign-in's rows and one `DEVICE_COMMAND` TEST_SIGNAL); `paired_devices 1`, `device_credentials 1` before and after; the SEALED summary still unacknowledged |
| Ports, rules | 4421 and 8083 free and no reverse rule at 23:56:51; at 23:56:52 W74 took lane 1 (its own PIDs 30010/30112, `lockf … run_w74.sh`) — not touched |
| Locks / security | Lock status identical before and after; no PIN, fingerprint, keyguard, system prompt or setting touched; the app's biometric offer declined twice ("Not now") |
| Not touched | 5432, 5173–5175, 4400, lane 3, `dems2_phone2`, the tablet |

## 12. Rollback (R-CO; not executed)

```sh
git checkout acaff20 -- apps/mobile/src/features/devices/device-command-dialog.tsx \
  apps/mobile/src/features/devices/device-detail.tsx apps/mobile/src/features/devices/diagnostics-sheet.tsx \
  apps/mobile/src/features/devices/health-chart.tsx apps/mobile/src/features/devices/i18n.ts \
  apps/mobile/src/features/devices/use-devices-data.ts
rm -f apps/mobile/src/features/devices/busy-state.ts apps/mobile/src/features/devices/use-pending-press.ts \
  apps/mobile/src/features/devices/devices-live-static.test.ts apps/mobile/src/features/devices/live-devices-sites.test.tsx \
  apps/mobile/src/features/devices/testing/live-devices-bed.tsx
```

The folder equalled `acaff20` before this row (`.cache/rollback/W78/diff_vs_acaff20_before.txt` is empty);
pre-images and `pre.sha256` / `post.sha256` are in `.cache/rollback/W78/`.

## 13. Assets (`implementation/assets/78_*`)

`78_gate.log`, `78_clg_a_c.log`, `78_live_tests_verbose.txt`, `78_mutations.log`, `78_mutate.py.txt`,
`78_mutating_transformer.cjs.txt`, `78_jest_mut_config.cjs.txt`, `78_device_run.log`, `78_run_w78.sh.txt`,
`78_device_w78.sh.txt`, `78_sign_in_w78.mts.txt`, `78_device_steps.txt`, `78_lock_status_start_end.txt`, and 11
screencaps `78_phone_{login_live, after_sign_in, detail_live, dialog_live, test_signal_toast_live, log_live,
simulated_start, detail_simulated, dialog_simulated, test_signal_toast_simulated, simulated_after_sign_out}.png`.

---
*Generated: 2026-10-06 00:05 WIB*
