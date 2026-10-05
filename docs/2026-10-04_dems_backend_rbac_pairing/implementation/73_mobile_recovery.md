---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-06
agent: coder-execution
row: W73 (blueprint step 95)
source_plan: docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md (row W73)
status: complete (gate items quoted below; foreign reds named with their owners)
---

# W73 — Mobile Recovery in LIVE mode (settle sites S2-3, S4-8, S5-2; recovery after a server-side fault)

Time: 2026-10-06 01:16–02:07 WIB. Write path: `apps/mobile/src/features/session-recovery/**` only. Pre-images:
`.cache/rollback/W73/` (`pre.sha256`, 11 files; `post.sha256`; `W73.post.patch`, 382 lines). No git write, no Docker,
no lane reset, no scenario load, no fault injection.

## 1. Result at a glance

| Item | Outcome | Evidence |
|---|---|---|
| S2-3 Start recovery (operation 33) | `useCoreActions()` + `settle`; `start(then)` reports a possibly asynchronous boolean; the runtime's pending control (busy at the press, `PendingSpinner` after the reveal delay); the presenter first in LIVE | `use-recovery.ts:244-285`, `session-recovery-screen.tsx:332-335,409-410`; 9 Live tests |
| S4-8 Acknowledge (operation 70, per matching alert) | one `settle` per alert, fired without waiting; a LIVE refusal presented and logged; Home follows on its own clock | `use-recovery.ts:296-323`; 5 Live tests |
| S5-2 role hint | kept on the device (replicated role); the Core enforces SESSION_START; `startRecovery` now returns the action's result so `settle` sees the Live promise | `sim-adapter.ts:46-60`; 2 Live tests |
| Requirement E1 — recovery after a server-side fault | Live tests on the fake transport: the Core restarts during a recording (socket closed 1001, outage, NEW epoch, POWER_FAIL, FAULT), the route sync opens Recovery, the screen recovers truthfully to the Core's INCOMPLETE; a second restart in FAULT changes nothing; a restart during the recovery completes it at its deadline; a fault raised while connected | `live-recovery-restart.test.tsx` (5 tests) |
| Device check (lane 1, phone, one sitting 01:51:26–01:56:36) | a recording started through the app; the lane backend THIS sitting started was stopped (SIGTERM) and started again; the server's start line `"mode":"boot","epoch":28,"session":"FAULT","restartFault":"RECORDING","auditRows":2`; Recovery opened in LIVE, recovered to INCOMPLETE, acknowledged; SIMULATED last | §6; 15 screencaps `assets/73_phone_*.png` |
| SG / CLG | final whole mobile suite **138 suites / 1,695 tests, exit 0** (02:03–02:05; floor 128 / 1,580); **typecheck exit 0, lint exit 0, 532 files 0 errors / 0 warnings** (02:02 re-check); the two foreign reds seen at 01:45–01:46 were gone at the re-check (§5.7) | §5 |
| Mutation check (M15, in memory) | **21 of 22 detected**; the survivor U6 analysed and pinned statically | §5.6 |
| Contract gaps | CONTRACT-GAP-W73-1 (no per-check recovery results from the Core); operation 70's missing `notPermitted` example is the known CONTRACT-GAP-W66-2 | §4 |

## 2. Inputs read

`masterplan/02_plan.md` row W73, the citation convention (line 81), §8.1 gates SG and CLG, §11; `masterplan/04_client_integration_spec.md`
§8.1 (LB-1 to LB-10), §8.6 S2-3, §8.7 S4-8 and S5-2, §3.5 (the read-only rule of "the monitor and recovery screens"), §6.3,
AC-C-48, §7.2 table row `features/session-recovery`; `masterplan/01_specs.md` §8.6 (E1: "A session that was in flight");
`gateway_check/09_cp_mobile_runtime.md` §4 answer 3 (the ten rules); `gateway_check/09b_m1_mobile_consolidation.md` §8 and
F.10 (D166); decisions D158 (F69-1, StrictMode), D164 (DN-7), D166, D106 (the epoch no longer counts resets), F59;
`implementation/51_mobile_runtime.md` §4; `implementation/67_mobile_session_new.md` (beds, device driver); `78_*`, `80_*`
(beds, static tests, mutation tooling, device scripts); `test/06_restart_recovery.md` §6 (the server's restart acceptance
test: RECORDING at the stop → FAULT `POWER_FAIL`, `recoverSession` 202, INCOMPLETE with a RECORDED item). Controller note
D170 (received 01:27): the link is read only through `useCoreLinkNotice()`, no workaround of the banner defect here.

## 3. What was built

### 3.1 S2-3: Start recovery (`use-recovery.ts`, `session-recovery-screen.tsx`)

- `use-recovery.ts:244` — the actions come from `useCoreActions()` (was `useSimActions()`, AC-C-53).
- `:219-228` — `RecoveryActions.start(then?: RecoverySettled)`: `then(true)` once the Core holds RECOVERY (Simulated: before
  `start` returns), `then(false)` after a toast; exactly once in every path, so the pending control can release on it.
- `:252-285` — the read-only refusal stays first (`:254-258`); then `settle(() => startRecovery(actions, role), …)`.
  `fail`: in LIVE the presenter first (`:265`: a denial from the hint or the Core's 403 with the role named, an outage, a
  limit; logged `warn`); otherwise the step-81 branches unchanged (SimPermissionError warning toast, SimTransitionError calm
  toast — the Core's 409 `INVALID_STATE` lands here —, anything else danger), each logged.
- `session-recovery-screen.tsx:332-335` — `const press = usePendingPress(); press.run((release) => onStart(release))`;
  `:409-410` — `{...busyState(press.busy)}` on the button and `{press.pending ? <PendingSpinner color={palette.black}
  testID="recovery-start-spinner" /> : null}` before the label (the button has no icon; W68/W72/W79 place it the same way),
  all from `@/runtime` (D166). In Simulated mode `settle` finishes before `run` returns: no state is set, nothing changes.
- The milestones follow the state: the pipeline reads the replica's `session.recovery` (stage, `startedAt`,
  `completesAt`) against the store clock, which in LIVE follows the Core's clock (`packages/shared/src/live/source/clock.ts`).

### 3.2 S4-8: Acknowledge (`use-recovery.ts:296-323`)

For each alert of the followed fault (same kind, unacknowledged, within 1 s of the fault instant — step 81's match, read
from the replica at press time) one `settle(() => actions.acknowledgeAlert(alert.id), { fail })`: fired without waiting for
each other; the Core treats an acknowledged alert as a no-op (01_specs §7.15). A LIVE refusal is presented and logged
(`warn`), anything else logged (`error`). The outcome acknowledgement itself stays local (the ring settles 600 ms on the
store clock, then Home), so Home never waits for the Core.

### 3.3 S5-2: the role hint (`sim-adapter.ts:46-60`)

`startRecovery` keeps its check (SESSION_START from the replicated role; a Technician's press sends nothing) and now
**returns** `actions.recover()` (`:59`), typed `CoreResult<void>`, so `settle` waits for the Core in LIVE. The parameter
accepts both action shapes (`Pick<CoreActions,'recover'> | Pick<SimActions,'recover'>`, `:57`) because step 81's model test
passes a bare `jest.fn()` and may not change. The seven gap markers of the file are unchanged (§5.4).

### 3.4 The link notice, the LIVE derivation line, Back during an outage

- `use-recovery.ts:210-216` — `useRecoveryReadOnly`: in LIVE `const { offline } = useCoreLinkNotice()` (rows M0, M1);
  SIMULATED and HEARTBEAT keep the step-81 rule byte for byte (W68's shape for the monitor, `session-live/use-monitor.ts:129-135`).
- `session-recovery-screen.tsx:122` — `const { offline: linkDown } = useCoreLinkNotice();` `:363-373` — in LIVE, while the
  link is down, an inline warning Alert "Core server unreachable / This device is not connected to the Core server. The
  screen shows the last state received; recovery can start once the connection is back." (`testID recovery-link-down`).
  Outside LIVE `offline` is always false: the Simulated screen is unchanged.
- `:401-405` — in LIVE one caption under the pipeline: "The Core reports the recovery stage and the outcome. The check
  results shown here are derived on this device from the Core's data." (`recovery-live-derived`; CONTRACT-GAP-W73-1; the
  D160 precedent of W78's health caption). Rule 8: no LIVE text names a simulation.
- `:125` — Back is not held while the Core link is down during the analysis (LIVE only): the analysis runs on the Core,
  not on the device, and a Core outage would otherwise trap the operator on the screen (DN-2).
- `i18n.ts:126-130` — three LIVE texts under `features.session-recovery.live.*`; the 90 Simulated texts are unchanged
  (digest pinned against `git show acaff20:…/i18n.ts`, §5.4).

### 3.5 The ten mobile rules (09 §4 answer 3) and 09b §8 / F.10

| Rule | How this row holds it |
|---|---|
| 1 One way in | `useCoreActions()` + `settle`; no `useSimActions`, no `.actions` read on a `Sim` (§5.4); no `client.call` needed |
| 2 Presenter first | both `fail` branches start with `if (live && presentCoreError(error))`; tests reset the coalescer in `beforeEach` (the bed's reset) |
| 3 No address, no network API | static test (`recovery-live-static.test.ts`) |
| 4 No credential | nothing read or written; the bed uses the fake's placeholders and a marker password |
| 5 One LIVE idiom | `useCoreLink().source === 'LIVE'`; the notice in one call |
| 6 React Compiler | no ref read in render, no setState in an effect added; lint 0 / 0 for the folder |
| 7 Timers on the store clock | no `setTimeout`; the reveal delay is the runtime's; the one `setInterval` is step 81's boundary countdown |
| 8 Copy | LIVE texts say nothing about a simulation; gap markers identical to `acaff20` |
| 9 Do not touch | only `features/session-recovery/**` written |
| 10 Ledger | 138 / 1,695 ≥ 128 / 1,580; lock status identical; lane 1 keeps DEV-0001; `core=SIMULATED` last |
| 09b §8 / F.10 | `usePendingPress` + `busyState` + `PendingSpinner` from `@/runtime`; no own dialog (none in this screen); imports through `@/runtime` and `@/navigation` only |
| D158 StrictMode | the screen starts no Core command or query in an effect; a StrictMode test counts ONE `recoverSession` per press and none at mount |

### 3.6 Tests added (all in the folder)

| File | Tests | What |
|---|--:|---|
| `testing/live-recovery-bed.tsx` | — | The real Live source over the contract-checked fake transport, the real `AppProviders`, the real route and the runtime's real `SessionRouteSync`; an engine (shared simulator) whose clock runs with the fake clock; hosted `recoverSession` and `acknowledgeAlert`; `restartCore` = 01_specs §8.6 (1001 close, outage, new epoch, POWER_FAIL for an in-flight session, RECOVERY completed at its deadline, the operator's session restored); `onCore` for a fault the Core raises by itself; `strict` |
| `live-recovery-sites.test.tsx` | 18 | S2-3 (delta first, answer first, pending, released after success, 403 `notPermitted`, outage, 429, 409, link down), S5-2 (Technician, Investigator), S4-8 (success, two alerts without waiting, 403 written envelope, 403 `originNotAllowed`, outage), StrictMode, the Simulated control |
| `live-recovery-restart.test.tsx` | 5 | E1: restart during a recording → Recovery → INCOMPLETE; a second restart in FAULT; a restart during the recovery; Back while the Core is down; a POWER_FAIL delta while connected |
| `recovery-live-static.test.ts` | 12 | CLG (c) with positive controls; settle/presenter/pending shapes; no network, storage, Live-source module or deep import; timers; one LIVE idiom; LIVE copy; gap markers per file; the Simulated copy digest |

## 4. Contract gaps found

| ID | Where | What | Impact | For |
|---|---|---|---|---|
| CONTRACT-GAP-W73-1 | `packages/shared/src/api/state-slices.ts:279-281` (`session.recovery` = `stage`, `startedAt`, `completesAt` only); used at `session-recovery-screen.tsx:401-405` | The Core reports the recovery stage and the outcome, not per-check results (track integrity, last good segment, time-source continuity). In LIVE the screen derives them on the device from the Core's replicated fault list, timeline and session, exactly as step 81 derives them from the simulator (the derivation is unchanged), and says so in one LIVE line | display; the "Last good segment" of a short recording reads the recording start (step 81's AUTOSAVE rule) although the Core committed data up to the fault instant (F73-4) | W83: a `findings` member on the recovery slice, or accept the derivation; DN-3 |
| (CONTRACT-GAP-W66-2) | `packages/shared/src/api/alerts.ts:79-100,121-128`; test `live-recovery-sites.test.tsx` (S4-8 refusal) | Operation 70 has no `notPermitted` example (every signed-in role may call it); AC-C-48's denied toast is proven with a written envelope, and the contract's own `originNotAllowed` example is tested too | test only | already with W83 |

## 5. Verification

### 5.1 SG: whole suite, typecheck, lint (`assets/73_gate_suite.log`)

```
## 2026-10-06 01:42:42 WIB   1:42  2 users, load averages: 4.25 5.34 5.19
## $ npm run test -w @dems/mobile -- --maxWorkers=2
Test Suites: 136 passed, 136 total
Tests:       1660 passed, 1660 total
exit=0
## finished 01:44:50
```

Typecheck at 01:44:58 found one error in this row's new test (`live-recovery-sites.test.tsx:345`, `operationId` is
`string | null`), fixed at once; the re-run at 01:46 and the final re-check (§5.7) show **no error in this row's files**.
The remaining errors are in W82's in-flight folder:

```
apps/mobile/src/features/settings/live-settings-boundary.test.tsx(268,64): error TS2367: …
apps/mobile/src/features/settings/live-settings-sites.test.tsx(352,82): error TS2345: …
```

Lint (eslint JSON over the workspace, 01:46:45):

```
eslint json: files 530 errors 1 warnings 0
   src/runtime/connection-banner-live.test.tsx 1 0          (the D170 runtime writer's new file, in flight)
features/session-recovery: files 15 errors 0 warnings 0
```

### 5.2 CLG (a): the folder's existing tests (`assets/73_clg_ac.log`)

```
## 01:46:56 $ git diff --stat acaff20 -- apps/mobile/src/features/session-recovery
 apps/mobile/src/features/session-recovery/i18n.ts  |   6 +
 .../session-recovery/session-recovery-screen.tsx   |  56 ++++++++-
 .../src/features/session-recovery/sim-adapter.ts   |  11 +-
 .../src/features/session-recovery/use-recovery.ts  | 127 +++++++++++++++------
 4 files changed, 161 insertions(+), 39 deletions(-)
## existing test files vs acaff20 (git rev-parse acaff20:<file> = git hash-object <file>)
same  da4e1f17f662  session-recovery-screen.test.tsx
same  306e06379d4b  recovery.model.test.ts
same  705fdf7166b3  testing/recovery-harness.tsx
same  12549d9a8ad0  testing/recovery-test-setup.ts
```

The step-81 suites (12 + 14 tests) pass unchanged in every run (§5.3).

### 5.3 CLG (b): the Live tests (`assets/73_folder_tests_verbose.txt`)

| Site | Success | Refusal (AC-C-48) | Outage | Further |
|---|---|---|---|---|
| S2-3 | one POST for the open session; RECOVERY from the Core; the pipeline on the Core's clock; the Core's INCOMPLETE with the RECORDED item; answer-first: the answer alone moves nothing; released after success (a second interrupted session on the same mounted screen gets its own request) | 403 example `notPermitted` → "Not permitted" / "Requires the Investigator role"; FAULT stays; idle; next press sends again | "Core server unreachable" / "Nothing was changed."; idle; next press works | pending: busy at the press, no spinner at 300 ms, spinner after 420 ms, second press ignored; 429 → limit toast with 30 s, no offline wording; 409 → the screen's own calm toast; link down → notice, refused locally (0 requests), notice gone when back |
| S4-8 | one POST per matching alert; two alerts both out before either answer; Home on its own clock | written 403 NOT_PERMITTED (CONTRACT-GAP-W66-2) → "Not permitted"; the contract's `originNotAllowed` → "The Core refused this action"; alert stays unacknowledged | "Core server unreachable"; Home still opens | — |
| S5-2 | Investigator passes the hint, the Core judges | Technician: hint text, 0 requests, denied toast naming the role | — | — |
| E1 | restart during a recording → new epoch, FAULT POWER_FAIL from RECORDING, fault instant ≤ the stop, Recovery opened by the route sync, INCOMPLETE, RECORDED, alert acknowledged, Home; no "simulat" text | — | second restart in FAULT: notice, press refused, then the same fault and instant | restart during the recovery: the last state kept while down, no outcome invented, the Core's outcome after; Back leaves while down; a POWER_FAIL delta while connected opens Recovery |
| StrictMode | 0 commands at mount; one press → ONE `recoverSession` | | | |
| Simulated control | never busy, no link notice, no derived line, FAULT → RECOVERY before the press returns | | | |

```
## 2026-10-06 01:5x $ npm run test -w @dems/mobile -- --maxWorkers=2 --verbose src/features/session-recovery
Test Suites: 5 passed, 5 total
Tests:       61 passed, 61 total
```

Controller note D170: none of these tests is red, in particular not the link-down ones; nothing in this folder works
around the banner (the link is read through `useCoreLinkNotice()` only).

### 5.4 CLG (c) and KI-07 (`assets/73_clg_ac.log`)

```
## CLG (c): useSimActions in production files
grep exit (1 = none): 1
## 01:47:05 CLG (c), re-run with perl (the BSD sed class above also excluded the letter n): .actions reads outside quotes in production files
session-recovery-screen.tsx:408:styles.actions
session-recovery-screen.tsx:547:styles.actions
## the only match is the screen's StyleSheet key (step 81):
715:  actions: { gap: spacing[1] },
## KI-07: SIM-GAP markers in apps/mobile/src
13 IDs / 62 markers
```

Per production file the gap markers are those of `acaff20` (static test: i18n 0, analysis 1, boundary 0, model 4, screen 2,
adapter 7, hook 1); the four new files hold none (their search strings are joined from parts). The Simulated copy: 90 texts,
digest `8e942571…c719`, computed independently from `git show acaff20:…/i18n.ts` (`assets/73_digest.cjs.txt`).

### 5.5 CLG (d): the device check — §6.

### 5.6 Mutation check (rule M15: nothing in the tree was written; `assets/73_mutations.log`)

W80's in-memory transformer (`assets/73_mutating_transformer.cjs.txt`, `73_jest_mut_config.cjs.txt`, `73_mutate.py.txt`);
each mutant runs the four behavioural files (the static test is left out).

```
# W73 mutation check, 2026-10-06 01:37:16; the tree is not edited
control (no mutation, 4 test files): exit=0 Tests:       48 passed, 48 total (30 s)
## 4 detected, 1 not detected, 0 not applied, of 5      (U1-U5)
## 7 detected, 1 not detected, 0 not applied, of 8      (U6-U9, S1-S4)
## 8 detected, 0 not detected, 0 not applied, of 8      (S5-S10, A1, A2)
## 1 detected, 0 not detected, 0 not applied, of 1      (U4 again, after the added test, 01:41:59)
## the mutated files in the tree, before and after: identical      (each batch)
```

Total **21 of 22**. U4 (a success never releases the control) first survived because Start unmounts after RECOVERY; the
test "released after a success" (a second session faults while the same screen is mounted) now detects it. **U6 survives**:
replacing the LIVE read-only rule by step 81's two-valued rule changes nothing in any state the bed reaches, because in LIVE
both read the same heartbeat view except during transients (a cold-start CONNECTING, which this screen never shows in
FAULT) and except under the D170 banner defect being fixed now; pinning a runtime transient here would couple the folder
to code another writer is changing. The rule is pinned statically (`recovery-live-static.test.ts`, the exact three lines).

### 5.7 Re-check of the foreign reds and the final gate (`assets/73_gate_recheck.log`, `73_gate_suite_final.log`)

```
## 2026-10-06 02:02:07 WIB re-check   2:02  2 users, load averages: 9.66 9.23 7.84
## $ npm run typecheck -w @dems/mobile
exit=0
## 02:02:21 $ npm run lint -w @dems/mobile -- --format json -o …
exit=0
eslint json: files 532 errors 0 warnings 0
features/session-recovery: files 15 errors 0 warnings 0

## 2026-10-06 02:03:14 WIB   2:03  2 users, load averages: 17.64 11.83 8.92
## $ npm run test -w @dems/mobile -- --maxWorkers=2
Test Suites: 138 passed, 138 total
Tests:       1695 passed, 1695 total
exit=0
## finished 02:05:57
```

The W82 type errors (01:46) and the D170 runtime lint error (01:45) were fixed by their owners before 02:02; nothing of
theirs was touched here. The final suite's 1-minute load was 9.66 at my check (02:02:07) and 17.64 when the run started
(02:03:14, a spike from the parallel rows between the check and the start); the run passed; the first gate run (01:42) was
at 4.25. The suite grew by the parallel rows' new suites between the two runs (136 → 138).

## 6. Device check (CLG (d)) — phone, lane 1, one sitting

### 6.1 How it was run

| Item | Value |
|---|---|
| Locks | `lockf -k -t 300 .locks/core-server.lane1.lock` (acquired at once), then `device-session.sh phone` (`METRO_PORT=8083`, `DEMS_CORE_HOST_PORT=4421`, `DEVICE_SESSION_MAX_SECONDS=600`): "screen awake, no keyguard" (never 77) |
| Backend | `DEMS_CORE_PORT=4421 npm run start:server` → `"port":4421,"database":"dems_lane_1","demoControls":false`; health ready; **no reset** |
| Driver | queue-driven (W67's method, `assets/73_drive_q.mts.txt`): I wrote each batch after reading the previous result; added `restart` (SIGTERM to the listener of 4421 = the server's graceful stop of §8.6, 6 s down, start again detached on the same database) and `offer` (W66's pixel check; only ever "Not now") |
| Dumps | only on Start Session and Recovery (motion off for the steps that dumped); never on Login, Summary or Home (D164 DN-7); `/sdcard/w73.xml` removed (`ls: … No such file or directory`) |
| Secret | the password typed only into the app's own password field (the IME reported a password editor, `0x80081`), never printed; credential lines: JS log 0, server logs 0; secret scan of the 61 text files of the sitting: password 0, token shapes 0 |
| Scripts, logs | `assets/73_run_w73.sh.txt`, `73_device_w73.sh.txt`, `73_drive_q.mts.txt`; `73_device_run.log`, `73_device_driver_steps.log`, `73_server_sitting.log` |

### 6.2 The run, as logged (`assets/73_device_driver_steps.log`, `73_device_run.log`)

```
ACK 003 | password typed (not shown); editor inputType 0x80081 | key 66 | signin 200 (POST /api/v1/auth/sign-in 200) | … the app's biometric offer declined: "Not now" at 540,1444
ACK 006 | … tapid session-new-next | create 201 (POST /api/v1/session 201) | precheck 202 (…/precheck 202) | … session-new-gate-pass "All checks passed" ; session-new-check-CORE "Core Machine, ONLINE, PASS" …
ACK 008 | tap 540,2257 | start 200 (POST /api/v1/session/{id}/start 200) | slept 9000 ms | screencap 73_phone_monitor_recording_live.png
ACK 009 | stopped PID 18690 in 115 ms (SIGTERM); down 6 s; started again, listener PID 21103 (8067 ms after the stop) | … screencap 73_phone_after_restart_3s.png | … ids: screen-session-recovery ; recovery-session-id "SES-20261006-0029" ; recovery-state-chip "Fault" ; … recovery-live-derived ; recovery-start "Start recovery" …
ACK 010 | tap 540,1682 | recover 202 (POST /api/v1/session/{id}/recover 202) | … recovery-state-chip "INCOMPLETE" ; … recovery-outcome-line "Session marked INCOMPLETE. It will never be sealed (SYS-008)" ; recovery-outcome-evidence "Evidence item, EV-20261006-0017 (recorded, unsealed)" ; recovery-outcome-duration "Recorded length, 00:00:17" …
ACK 011 | tap 540,2239 | ackalert 204 (POST /api/v1/alerts/{id}/acknowledge 204) | … force-stopped the app | deep link 'demsdemo:///login?core=SIMULATED&motion=off' …
ACK 012 | (SIMULATED sign-in) … deep link demsdemo:///session/recovery | … ids: screen-session-recovery ; recovery-idle ; recovery-idle-action "Go to Home"
ACK 013 | signin NOT SEEN in 1 s; the app was force-stopped (fields cleared) before any screencap | deep link 'demsdemo:///login?core=SIMULATED&motion=off' | … | done 0
```

The server's own start line of the second process (`assets/73_server_sitting.log`) — spec §8.6 exactly (FAULT_RAISED and
TABLET_LINK_CHANGED are the two rows):

```
{"level":30,…,"pid":21103,…,"mode":"boot","epoch":28,"auditTotal":230,"session":"FAULT","restartFault":"RECORDING","tamperCleared":false,"tabletLinkReset":true,"tabletLinkCarried":false,"auditRows":2,"msg":"engine started"}
```

Requests of the sitting, both server processes (`73_device_run.log`):

```
      1 GET /api/v1/auth/session 200 principal=operator        (the reconnect after the restart: the operator's session survived)
      1 GET /api/v1/auth/session 401 principal=device
      1 GET /api/v1/auth/status 200 principal=device
      1 GET /api/v1/health 200 principal=null
      1 GET /api/v1/pairing/device 200 principal=device
      1 POST /api/v1/alerts/:id/acknowledge 204 principal=operator
      1 POST /api/v1/auth/sign-in 200 principal=device
      1 POST /api/v1/auth/touch 200 principal=operator
      1 POST /api/v1/session 201 principal=operator
      1 POST /api/v1/session/:id/precheck 202 principal=operator
      1 POST /api/v1/session/:id/recover 202 principal=operator
      1 POST /api/v1/session/:id/start 200 principal=operator
   epoch lines:    2 "epoch":27
   epoch lines:    1 "epoch":28
-- bearer/cookie/credential lines in the server logs (must be 0): 0
```

### 6.3 Screencaps (`assets/73_phone_*.png`, 1080 × 2424)

| File | What it shows |
|---|---|
| `73_phone_live_login_username.png` | LIVE Login with the username typed (password field empty) |
| `73_phone_live_offer_check.png` | the app's biometric offer (declined with "Not now") |
| `73_phone_live_after_signin.png` | the boot route after sign-in: the Session Summary of **another row's** SES-20261006-0028 (sealed 01:15:13), left unacknowledged on lane 1; not touched (F73-1) |
| `73_phone_step1_live.png`, `73_phone_step1_filled_live.png`, `73_phone_step2_gate_live.png`, `73_phone_step3_ready_live.png` | Start Session in LIVE: step 1, filled (LP/2026/1006-0013, Tersangka), the Core's gate "All checks passed" 8 of 8, Ready |
| `73_phone_monitor_recording_live.png` | the monitor, recording on the Core |
| `73_phone_recovery_fault_3s_after_restart_live.png` | **3 s after the lane backend was back: Recovery in LIVE, FAULT** — "Session interrupted: Power failure", "Recording stopped at 01:53:56", the five steps waiting, the LIVE derivation line, Start recovery |
| `73_phone_recovery_fault_live.png` | the same screen 11 s later (unchanged: no flicker) |
| `73_phone_recovery_analysing_live.png` | RECOVERY from the Core: "Recovery analysis running", "Recovery scan · stage 1 of 2", step 1 done, step 2 running, the tracks resolving |
| `73_phone_recovery_outcome_live.png` | **the Core's outcome**: INCOMPLETE, "Session marked INCOMPLETE. It will never be sealed (SYS-008)", EV-20261006-0017 (recorded, unsealed), 00:00:17, 39.9 MB |
| `73_phone_home_after_acknowledge_live.png` | Home in LIVE after Acknowledge: "Core Live", the bell clear (the POWER_FAIL alert acknowledged on the Core), EV-20261006-0017 first in Recent Sessions |
| `73_phone_simulated_login.png`, `73_phone_simulated_relaunch_login.png` | SIMULATED Login (the last launch, D124): "paired (simulated)", Core online |

**What the device check could not show, and why.** (1) The link notice while the Core was down: the 6 s downtime ran
inside the `restart` command and the phone was back 3 s after the start, before the next screencap; the notice is proven in
jest (5 tests). (2) The SIMULATED Recovery screen as a screencap: after the SIMULATED sign-in the driver's credential guard
(no Core sign-in line exists in SIMULATED) refused screencaps; the screen is evidenced by the dump of ACK 012
(`screen-session-recovery`, `recovery-idle`, "Go to Home"); the guard then force-stopped the app by its own rule, the
simulator came back signed out, and the last deep link landed on Login. (3) The FAULT phase in SIMULATED was not provoked
on the device: it would need a fault injected into the phone's simulator through the debug handle and would leave the
phone's simulator state changed for the next rows; the 12 unchanged step-81 tests cover it.

### 6.4 Lock status and ports (`assets/73_lock_status.txt`)

```
## 2026-10-06 01:48:43 WIB / 01:56:58 WIB  emulator-user-lock.sh status (read-only) — identical (diff exit 0)
phone (emulator-5554): AVD dems2_phone, isKeyguardShowing=false, CredentialType=PIN, fingerprint count=1, lock screen disabled=unreadable
phone2 (emulator-5558): AVD dems2_phone2, isKeyguardShowing=false, CredentialType=NONE, fingerprint count=0, lock screen disabled=true
tablet (emulator-5556): AVD dems2_tablet, isKeyguardShowing=false, CredentialType=PIN, fingerprint count=1, lock screen disabled=unreadable
lsof 4421/8083/8081 exit 1 (1 = none)
adb -s emulator-5554 reverse --list: (empty)
.locks/core-server.lane1.pid: 0 bytes
```

## 7. Findings

| ID | Finding | Evidence | For |
|---|---|---|---|
| F73-1 | Lane 1 holds an unacknowledged Summary of SES-20261006-0028 (sealed 01:15:13 by an earlier row's device check); every LIVE sign-in on lane 1 lands on it. Not acknowledged here (not this row's) | `73_phone_live_after_signin.png` | the owner row (W72 or W68) / controller |
| F73-2 | `adb shell am start -d <url>` passes the URL to the device shell unquoted: `&motion=off` was cut, so the first launch was `/login?core=LIVE` (never `/`, so DN-7 held). W67's driver has the same `link` code. Fix: quote the URL for the device shell | ACK 001 error, ACK 004 | device brief template |
| F73-3 | The driver's "no screencap after a password until a sign-in 200" guard cannot be met in SIMULATED (no Core request) and forces a force-stop; a SIMULATED landing condition (a test ID that is not Login) is needed | ACK 012–013 | device brief template |
| F73-4 | In LIVE the "Last good segment" of a 17 s recording reads "Ends 01:53:38 · 00:00:00 of media" (the recording start, by step 81's AUTOSAVE-once-a-minute rule), while the Core committed up to the fault instant 01:53:56 (W53-F7: written once a second). Truthful as labelled ("derived on this device") but weaker than the Core's data | `73_phone_recovery_outcome_live.png` | DN-3 |
| F73-5 | The read-only rule "LIVE → the one notice, else step 79's rule" now exists twice: `session-live/use-monitor.ts:129-135` (W68) and `session-recovery/use-recovery.ts:210-216`; [CS:§3.5] names both screens | code | DN-4 |
| F73-6 | KI-07 unchanged: 13 IDs / 62 markers | §5.4 | — |
| F73-7 | `active_session` rows on lane 1: 1 before, 0 after. Hypothesis (counts only, not read back): the row held the closed SES-20261006-0028 until the next session was created; after this row's INCOMPLETE close the table is empty, so no recording is left running | `73_device_run.log` counts | Info |

## 8. Deviations

| # | Brief / plan | What was done | Why |
|--:|---|---|---|
| DV-1 | Plan §17 names `implementation/73_mobile_session_recovery.md` | `implementation/73_mobile_recovery.md` | The brief is the newer instruction (W80's DV-4 precedent) |
| DV-2 | "Never `cd`" | One read-only subshell `(cd <repo> && find … \| xargs shasum)` at 01:23 to write `pre.sha256` with relative paths; nothing else. The mutation driver runs jest with `cwd=apps/mobile` as a subprocess argument (W80's tool), no shell `cd` | Slip; no file affected |
| DV-3 | Device rule: launch `…/login?core=LIVE&motion=off` | The first launch was `/login?core=LIVE` (F73-2); the second launch carried `&motion=off` | The `&` was cut by the device shell |
| DV-4 | "the screen in SIMULATED; screencaps" | SIMULATED Recovery evidenced by a dump, not a screencap (§6.3) | The driver's own credential guard (F73-3) |
| DV-5 | — | `sim-adapter.ts` changed (the result returned; its markers unchanged) although W79 left its adapter untouched | Without it `settle` would end before the Core answers in LIVE (mutant A1) |
| DV-6 | SIMULATED unchanged | The Acknowledge loop now settles each alert on its own: an exception of one `acknowledgeAlert` no longer stops the loop | Unreachable: the simulator's `acknowledgeAlertTransition` never throws (`packages/shared/src/sim/faults.ts:401-405`); every Simulated test unchanged and green |

## 9. Decisions for the controller

| ID | Decision | Recommendation |
|---|---|---|
| DN-1 | S5-2 reads "the hint that disables the button"; step 81's button is enabled with the hint text and a refusal toast. Kept as step 81 in both modes (a Technician's LIVE press sends nothing and shows the presenter's denied toast naming the role) | Keep: SIMULATED unchanged, one look in both modes; if disabling is wanted it is a one-line LIVE-only `isDisabled` |
| DN-2 | Back is not held during the analysis while the Core link is down (LIVE only) | Ratify: the analysis runs on the Core; otherwise a Core outage traps the operator |
| DN-3 | CONTRACT-GAP-W73-1 and F73-4 | To W83: a recovery `findings` member, or accept the device derivation; for LIVE the last good segment could be the fault instant (the Core's last committed instant) |
| DN-4 | F73-5: one runtime helper for "session actions are read-only while the link is down" | W100 or the next M round |
| DN-5 | F73-1: lane 1's pending Summary of SES-20261006-0028 | The owner row acknowledges it in its next sitting, or it stays (harmless; it changes the boot route of every LIVE sign-in on lane 1) |
| DN-6 | Mutant U6 survives (§5.6) | Accept with the static pin |
| DN-7 | F73-2 and F73-3 | Into the device paragraph of the remaining mobile briefs |

## 10. State left on the device and its lane

| Where | State |
|---|---|
| `dems2_phone` | Last launch `core=SIMULATED&motion=off`; prefs `{"coreLinkSource":"SIMULATED"}`; the app at SIMULATED Login (the simulator signed out after the guard's force-stop); device-session force-stopped the app at the end. The biometric offer declined once ("Not now"); nothing enrolled. `/sdcard/w73.xml` removed. Keyguard, PIN and fingerprint untouched; lock status identical |
| `dems_lane_1` | DEV-0001 kept (`paired_devices 1`, `device_credentials 1` before and after). One graceful restart of the backend this sitting started: epoch 27 → 28 (D106: the epoch no longer counts resets). New session SES-20261006-0029 (LP/2026/1006-0013, 17 s recorded) → POWER_FAIL at the second start (`FAULT_RAISED`, `TABLET_LINK_CHANGED`) → recovered → INCOMPLETE; evidence EV-20261006-0017 RECORDED, never sealed; its POWER_FAIL alert acknowledged (`alerts` 0 → 1 row); `session_history` 16 → 17; `active_session` 1 → 0 rows (F73-7; no recording left running); `audit_log` 220 → 237. The investigator's session was not signed out (force-stop): it ends by the server's idle rule — hypothesis, not read back. The other row's SES-20261006-0028 summary untouched. No reset, no scenario, no fault injection, nothing exported |
| Ports, locks | 4421, 8083 and 8081 free; `adb reverse --list` empty; Metro stopped by device-session; both backend processes stopped ("shutdown complete"); `.locks/core-server.lane1.pid` 0 bytes. Lane 2, lane 3, the tablet, `dems2_phone2`, 5432, 5173–5175 and 4400 untouched; PostgreSQL only through the lane backend on 4432 |

## 11. Rollback (not executed)

R-CO for the four modified files:
`git checkout acaff20 -- apps/mobile/src/features/session-recovery/{use-recovery.ts,session-recovery-screen.tsx,sim-adapter.ts,i18n.ts}`;
R-NEW for the four new files:
`git clean -fd -- apps/mobile/src/features/session-recovery/live-recovery-sites.test.tsx apps/mobile/src/features/session-recovery/live-recovery-restart.test.tsx apps/mobile/src/features/session-recovery/recovery-live-static.test.ts apps/mobile/src/features/session-recovery/testing/live-recovery-bed.tsx`.
Pre-images and hashes: `.cache/rollback/W73/` (`session-recovery.pre/`, `pre.sha256`, `post.sha256`, `W73.post.patch`).
Lane 1: nothing to roll back by script (no reset allowed); the session, the RECORDED item and the audit rows are durable records.

## 12. Error handling and logging

Every refusal and failure of S2-3 and S4-8 writes one record to the persistent runtime log (`reportRuntimeIssue`,
`dems.mobile.log.v1`): `features.sessionRecovery.start` (`info` for the read-only refusal, `warn` for a presented refusal
or a role/transition refusal, `error` otherwise; context: role, permission or `from`) and
`features.sessionRecovery.acknowledgeAlerts` (`warn` presented, `error` otherwise; context: fault kind). No evidence
content, no operator data beyond the role, no credential. The user sees the presenter's wording in LIVE (one toast,
coalesced for outages and limits) or step 81's toasts in SIMULATED; the control returns to idle on every refusal; the region
boundaries of step 81 (rate-limited retry 3/6/12 s) are unchanged.

## 13. Files

Modified: `apps/mobile/src/features/session-recovery/use-recovery.ts`, `session-recovery-screen.tsx`, `sim-adapter.ts`, `i18n.ts`.
New: `apps/mobile/src/features/session-recovery/testing/live-recovery-bed.tsx`, `live-recovery-sites.test.tsx`,
`live-recovery-restart.test.tsx`, `recovery-live-static.test.ts`.
Documents: this file; `delegation_progress/coder_execution_step_95.md`; 33 `implementation/assets/73_*` files (the 30 below plus `73_gate_suite_final.log`, `73_gate_recheck.log`, `73_gate_typecheck_lint_first.log`) (15 screencaps,
`73_device_run.log`, `73_device_driver_steps.log`, `73_server_sitting.log`, `73_lock_status.txt`, `73_run_w73.sh.txt`,
`73_device_w73.sh.txt`, `73_drive_q.mts.txt`, `73_mutate.py.txt`, `73_mutating_transformer.cjs.txt`,
`73_jest_mut_config.cjs.txt`, `73_mutations.log`, `73_digest.cjs.txt`, `73_gate_suite.log`, `73_clg_ac.log`,
`73_folder_tests_verbose.txt`).
