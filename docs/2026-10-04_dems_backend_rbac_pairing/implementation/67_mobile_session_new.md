# W67 — Mobile Start Session in LIVE mode (blueprint step 89)

**Row**: W67 (plan §8.4; prov. 86). Agent: coder-execution. **Time**: 2026-10-05 22:40–23:37 WIB.
**Status**: **complete** (one interface item `needs-review`, no blocker; see §12).
Settle sites S1-4, S2-2, S4-6, S5-6 and the start-recording hand-off [CS:§8.5–§8.7]; AC-C-50, AC-C-57,
AC-C-58, AC-C-62; CA-02. Gate: CLG (plan §8.1) on top of SG.

Assets: `implementation/assets/67_*` (27 files: 14 screencaps, 5 logs, the lock status, 4 device scripts, 3 mutation files; §16).

---

## 1. Result at a glance

| Item | Result |
|---|---|
| One way in | `useCoreActions()` + `settle` at every site; no `useSimActions`, no `.actions` on a `Sim` in the folder's production files (CLG (c): `grep` finds nothing) |
| S1-4 (create, then pre-check) | Nested `settle` in order; a 409 on a CREATE session → cancel and create again; a refused create keeps the inline error by reason and, in LIVE, a 403 also shows the denied toast; an outage / limit / refused pre-check goes to the presenter and leaves no inline error |
| S2-2 (acknowledge, retry, cancel, start) | Each wrapper reports `true`/`false` to a continuation; in LIVE the presenter goes first |
| The start-recording hand-off (CA-02, AC-C-62) | The stack replace runs in the `ok` of `startRecording`, in the CL-16 turn: in both arrival orders the monitor opens and no "session busy" toast shows (jest, and on the phone) |
| Pending (AC-C-57, AC-C-58) | Answer 1 s late: two presses → one request; no spinner at 300 ms; the in-button spinner at 500 ms; no element added outside the control. Answer after 50 ms: no spinner ever |
| S4-6, S5-6 | Unchanged code, proven on the replica: the scan computes from the replicated counters and history and sends nothing; the investigator list follows the replicated roles |
| AC-C-50 | A lost `SESSION_START` (pushed `session.updated`) leaves the wizard for `/home`; the runtime's role toast says why; the setup session stays on the Core |
| Core link (M0's one rule) | `coreLinkViewOf(useCoreLink())` + `offlineNoticeAfter`; while down: a warning, Start disabled, a running 3-2-1 stops |
| Simulated mode | Unchanged: the folder's 5 existing test files and the 72 baseline test files are byte-equal to `acaff20` and green |
| New tests | 3 suites / **36 tests** + one test bed (§5) |
| Mutation check (rule M15, in memory) | **24 of 24 detected** (23 in the first pass; the 24th after one test was added); the mutated files byte-identical before and after |
| Device check (lane 1, phone) | LIVE sign-in 200 → create 201 → pre-check 202 → gate PASS (Core Machine ONLINE over the phone's own socket) → start 200 → monitor RECORDING, no busy toast → End Session with a reason → stop 202 → Summary SEALED → relaunch SIMULATED. Lock status identical before and after |
| `CONTRACT-GAP` | none found (§9) |

## 2. Sources read

`masterplan/02_plan.md` (row W67, §8.1 CLG/SG, §11); `masterplan/04_client_integration_spec.md`
(§2.5 CL-16..CL-26, §3.5, §6.3, §8.1 LB-1..LB-10, §8.5 S1-4, §8.6 S2-2, §8.7 S4-6, S5-6, AC-C-48/50/57/58/62,
CA-02, GC-02); `gateway_check/09_cp_mobile_runtime.md` §4 answer 3 (the ten rules); `gateway_check/09a_m0_link_rule.md`
§10; `implementation/51_mobile_runtime.md` §3–§4; `implementation/60_mobile_pairing_gate.md` §7 (device
procedure); `implementation/34_module_sessions.md` via D94/D108; decisions F59, F69, D124, D125, D143.
Code: the 20 files of `apps/mobile/src/features/session-new/`, `packages/shared/src/live/{settle,core-actions,hooks}.ts`,
`live/source/bindings.ts:303-346` (the session bindings), `apps/mobile/src/runtime/{core-errors,index}.ts`,
`navigation/{session-guards,back-guard}.tsx`, and the parallel web row's `apps/core-web/src/features/session-new/`
(read only, for parity).

## 3. What was built

All paths under `apps/mobile/src/features/session-new/`. Line numbers are those of the finished files.

### 3.1 The sites

| Site | Where | What and why |
|---|---|---|
| S1-4 | `use-session-new.ts:206-255` | `createAndCheck(values, then)`: `settle(createSession)` → in `ok`, a `SESSION_ACTIVE` on a CREATE session (the state seen before the call, as before) runs `settle(cancel)` → `settle(createSession)` (`:243-244`); `judge` (`:217`) runs `settle(beginPrecheck)` (`:226`) and reports `{ ok: true, sessionId }`. A refused result union → `{ ok: false, reason }` (the inline error by reason, [CS:S1-4]); in LIVE a 403 also goes to the presenter as `SimPermissionError('createSession', SESSION_START)` (`:222`, AC-C-48; the web row W64 does the same). A rejection (no union: outage, limit, 500, or a refused pre-check) goes to the presenter first in LIVE and reports `reason: null` (no inline error, the toast says it); in SIMULATED it reports `UNEXPECTED` as before |
| S2-2 | `use-session-new.ts:190-204, 258-278` | `guarded(action, run, message, then)`: `settle(run, { ok: then(true), fail: … then(false) })`. `fail` hands the error to the presenter first in LIVE (`:194`), logging it at `warn`; otherwise the existing toast and an `error` log |
| S2-2 consumers | `session-new-screen.tsx:316-357` | Acknowledge: step 3 in `ok`. Retry: the acknowledgement reset in `ok`. Cancel: leaves in `ok`; on a refusal LIVE keeps the dialog open, SIMULATED leaves as before (`:354`) |
| The hand-off | `session-new-screen.tsx:255-266, 643-654` | `launch` runs `startRecording(then)`; in `ok` it dispatches `StackActions.replace` to the monitor (`handOffToMonitor`, with `router.replace` as the fallback, and a logged fallback if the dispatch throws inside a continuation). By CL-16 the store reaches RECORDING and the replace is dispatched in one synchronous turn, so the wizard route never renders RECORDING (CA-02) |
| S4-6 | `session-new-screen.tsx` `onScan` (unchanged) + `sim-adapter.ts` (unchanged) | No change: the scan reads `sim.store.getState()`, which in LIVE is the replica (`meta.counters`, `session`, `sessionHistory`, the Live clock). Tested on the replica (§5) |
| S5-6 | `session-new-model.ts:61-63` (unchanged) | No change: `eligibleInvestigators` over the replicated `operators`. Tested on the replica |
| Fire-and-forget clip reset (operation 52, [CS:§7.2 table, "the import only"]) | `device-previews.tsx:106-122` | `useCoreActions()` + `settle`; a rejection is logged (`warn`, as before) and, in LIVE, also presented |

### 3.2 What the screen adds in LIVE mode (`session-new-screen.tsx`)

| Item | Lines | Why |
|---|---|---|
| Pending, per control (LB-1) | `:142-148`, footer `:369-401`, `use-pending-press.ts` | Five `usePendingPress()` (Next step 1, Next step 2, Retry, Start, Cancel). From the press until the command settled the control ignores presses and carries `accessibilityState.busy`; after `LIVE_PENDING_REVEAL_MS` on the **store's clock** (rule 7) the kit's `Spinner` replaces the icon inside the button. In SIMULATED `settle` returns before `run` does, so no state is set (busy props are spread only while busy, `busyState` `:656`) |
| The Core link (M0) | `:150-159`, `:203`, `:391`, `:450-459` | `coreLinkViewOf(useCoreLink())` with the render-time adjustment of `offlineNoticeAfter` (M0 §10, verbatim shape). While down: an `Alert` "Core server unreachable", Start disabled, a running 3-2-1 stops. `none` outside LIVE, so SIMULATED and HEARTBEAT never show it. Makes the brief's rule visible: a recording starts only over a connected link — on the phone, the app's own socket |
| AC-C-50 | `:160-170`, `:206-210` | `useCorePermission(SESSION_START)` (false in SIMULATED); a true → false seen while mounted, in LIVE, sets `permissionLost`; an effect event calls `back.guard.leaveTo('/home')` (the guard is switched off first, so the flow prompt does not hold the leave). No second toast: the runtime's `RoleChangeNotice` already shows "Your role is now …" ([CS:§6.3] "it leaves for /home with a toast"). The setup session is not cancelled |
| Back while a command is out | `:212-221`, `:359-362` | Hardware Back is swallowed and the header arrow ignored while `sending`: a request that left the device cannot be taken back (the Pair screen's rule, W57). The effect re-subscribes on every render while sending, so it stays the newest listener (the flow prompt re-subscribes on every render too). Never subscribed in SIMULATED |
| Live CORE-check hint (F69) | `devices-check-step.tsx:77, 114-116` | In LIVE a blocked `CORE` check adds "In Live mode this check is this device's own connection to the Core server …" |
| Copy | `i18n.ts:82-88` | Three keys under `features.session-new.live.*`, English only, no simulation wording |

## 4. The ten mobile rules (CP-M1 §4 answer 3)

| # | Rule | How it holds here |
|---|---|---|
| 1 | One way in | `useCoreActions()` + `settle` only; no `useMobileLive()` call was needed (every operation of the screen has a simulator action). The four static scans pass (§6) |
| 2 | Presenter first; reset in `beforeEach` | Every `fail` in LIVE: `if (live && presentCoreError(error))` before the site's own branch. The bed's `resetLiveSessionNewBed()` calls `resetCoreErrorPresenterForTests()`. A 429 is worded as a limit and shows no link notice (tested) |
| 3 | No Core address, no network API | None in the folder; the device check's requests went through the app's typed client (`[DEMS-LIVE]` lines) |
| 4 | No credential | The folder imports no secure-store module and logs no form value (`logAction` logs state and session ID only) |
| 5 | One LIVE idiom | `useCoreLink().source === 'LIVE'` on the screen and in the two hooks; the mode is never re-derived |
| 6 | React Compiler | Render-time adjustments (`linkViewSeen`, `mayStartSeen`), no ref + effect for state; the in-flight ref is written only in event handlers; lint 0 errors / 0 warnings |
| 7 | Store clock, no new `setTimeout` | The pending reveal reads `s.clock.now` through a boolean `useSim` selector; the existing 3-2-1 `setTimeout` (`session-new-screen.tsx`, step 78) is unchanged |
| 8 | Truthful copy, no `SIM-GAP` | No new marker (KI-07: 13 IDs / 62 markers, as at `acaff20`); the new copy names no simulation. One existing shared string in LIVE is a finding (§10 F-2) |
| 9 | Do-not-touch list | Only `features/session-new/**` was written; the 72 baseline test files and `heartbeat-release-gate.test.tsx` are unchanged (§6) |
| 10 | Ledger and device | §6, §8 |

## 5. Tests

`testing/live-session-new-bed.tsx` (test-only): the app's real Live source (`createMobileLive`) over the
contract-checked fake transport, mounted by the real `AppProviders` around the **real** `/session/new`
route file; the device paired (the fake's placeholder credential in the secure-store mock); the
investigator signed in through the Live source's own sign-in. The Core's engine is a real simulator:
each session command runs the same action there and the replicated slices it changed travel back as
one delta with the revision the answer names, `delta-first` or `answer-first` (held until the test
sends it). `/session/live` is a stand-in with the live route's own policy (RECORDING only), as in the
Simulated harness.

| File | Tests | What it proves |
|---|--:|---|
| `live-session-new-handoff.test.tsx` | 7 | AC-C-62 in both arrival orders (in `answer-first` the wizard waits on Ready with "Starting…" and busy, then the monitor opens in the turn of the delta); start 403 `notPermitted` → denied toast, Start idle, stays on Ready; start outage → "Core server unreachable / Nothing was changed."; Back held while the start is out; AC-C-57/58 (1 s answer: one request for two and three presses, no spinner at 300 ms, spinner inside Next at 500 ms, the element list outside Next unchanged; 50 ms answer: no spinner at any 10 ms step) |
| `live-session-new-sites.test.tsx` | 16 | S1-4: order create → pre-check; the 409 → cancel → create → pre-check order; create 403 → denied toast + inline error, no pre-check; pre-check 403 → denied toast, no inline error, CREATE stays; outage → offline toast, no inline error, a second press succeeds; 429 → limit toast with the seconds, no offline wording, no link notice; 422 → inline INVALID_INPUT (F59). S2-2 acknowledge, retry, cancel: success, 403 `notPermitted`, outage each |
| `live-session-new-replica.test.tsx` | 13 | S4-6: next number from the replica, no request; a Core-moved counter is followed; works with the link down, nothing sent. S5-6: list follows a role change on the replica; keeps the last replica offline; the hint is not the judge (403 → denied toast). AC-C-50: lost permission → `/home` with the role toast, no cancel; a role change that keeps the permission stays. Link: notice + Start disabled while down, kept through reconnect attempts, gone when back; a reconnect attempt that hangs in CONNECTING keeps it (added after the mutation run, §7); 3-2-1 stops when the link drops; LIVE CORE hint; SIMULATED shows neither |

Every 403 is named by its example `notPermitted` (`fake.example(op, 403, 'notPermitted')`), never the
first 403 example.

## 6. Verification

Commands from `/Users/gsp-budi/Documents/DEMS`. `uptime` was read before every whole-suite run (8.64 at
the final one). Raw output: `assets/67_final_gate.log`.

### 6.1 CLG (a) — the folder's existing tests pass and are not in the diff

```
## the folder's existing test files at acaff20
apps/mobile/src/features/session-new/precheck.test.tsx
apps/mobile/src/features/session-new/session-new-model.test.ts
apps/mobile/src/features/session-new/session-new-screen.test.tsx
apps/mobile/src/features/session-new/testing/session-new-harness.tsx
apps/mobile/src/features/session-new/testing/session-new-test-setup.ts
$ git diff --stat acaff20 -- <those 5 files>
(end: 0 lines)
## the 72 baseline test files: git diff --stat acaff20 -- <the 72>: 0 lines
## heartbeat-release-gate.test.tsx vs b90a3c6: 0 lines
```

In the final whole-suite run: `PASS src/features/session-new/session-new-screen.test.tsx`, `PASS …/precheck.test.tsx`,
`PASS …/session-new-model.test.ts` (with the two navigation suites that render this screen,
`guard.test.tsx` and `routes.test.tsx`, also green).

### 6.2 CLG (b) — one Live test per named site: success, refusal (denied toast), outage

| Site | Success | Refusal (403 `notPermitted`, denied toast) | Outage |
|---|---|---|---|
| S1-4 | sites: "success: one create, then one pre-check start …"; "a CREATE session with other details: 409, then cancel and create again …" | sites: "refusal: createSession 403 …", "refusal of the second leg: beginPrecheck 403 …" (also 429 → limit, 422 → inline) | sites: "outage: …" |
| S2-2 | handoff: both arrival orders (start); sites: acknowledge / retry / cancel success | handoff: "a 403 on start …"; sites: acknowledge / retry / cancel refusal | handoff: "an outage on start …"; sites: acknowledge / retry / cancel outage |
| S4-6 | replica: "success: the next number from the replicated counters and history …"; "the Core moved its counter …" | none of its own (no request is sent; the stale-hint refusal is the create 403, S1-4) | replica: "outage: with the Core link down the scan still fills the number … nothing is sent" |
| S5-6 | replica: "success: the list follows the replica …" | replica: "the hint is not the judge … the Core refuses the create (example notPermitted) → the denied toast" | replica: "outage: … the list keeps the last replica …" |

The row's own verification: "in both arrival orders the monitor opens and no 'session busy' toast shows"
(handoff, two tests) and "the pending test of W64 in its mobile form" (handoff, two tests: AC-C-57, AC-C-58).

```
$ npm run test -w @dems/mobile -- --maxWorkers=2 src/features/session-new/live-session-new-replica   (23:29:53, after the last test was added)
Tests:       13 passed, 13 total
$ npm run test -w @dems/mobile -- --maxWorkers=2 src/features/session-new src/runtime/live-no-raw-fetch.test.tsx src/runtime/link-notice-static.test.ts src/auth/live-auth-static.test.ts src/features/pairing/pairing-live-static.test.ts src/features/login/login-live-model.test.ts src/navigation/__tests__/guard.test.tsx src/navigation/__tests__/routes.test.tsx   (23:07:41)
Test Suites: 13 passed, 13 total
Tests:       169 passed, 169 total
```

### 6.3 CLG (c) — no `useSimActions`, no `.actions` on a `Sim` in the folder's production files

```
$ grep -rnE "useSimActions|\.actions\b" apps/mobile/src/features/session-new --include='*.ts' --include='*.tsx' | grep -vE "\.test\.|/testing/" | grep -vE "styles\.actions|common\.actions\."
(exit of the last grep: 1; 1 = nothing found)
```

(The two remaining `.actions` texts are a style key and translation keys, which rule 1 allows.)

### 6.4 CLG (d) and SG

CLG (d): §8 (lane 1, the phone, 6 min 55 s of device time).

```
## 2026-10-05 23:31:01 WIB 23:31  2 users, load averages: 8.64 9.15 8.35
## $ npm run test -w @dems/mobile -- --maxWorkers=2
FAIL src/features/devices/live-devices-sites.test.tsx (9.172 s)
Test Suites: 1 failed, 103 passed, 104 total
Tests:       1 failed, 1344 passed, 1345 total
Time:        105.292 s
exit=1
## 23:32:47 $ npm run typecheck -w @dems/mobile
src/features/devices/testing/live-devices-bed.tsx(64,8): error TS2305: Module '"@dems/shared/sim"' has no exported member 'AudioTrackId'.
exit=2
## 23:32:58 $ npm run lint -w @dems/mobile
> eslint . --max-warnings 0
exit=0
## finished 23:33:20
```

The one red suite and the one type error are **not this row's**: both are in W78's new files under
`features/devices/` (the failing test is "S3-2: Test signal (operation 49) through the device-command
dialog › success: …", with "Cannot log after tests are done"), which W78 was writing at that minute.
All six suites of this folder passed in that run. Re-check: §6.5.

My workspace typecheck earlier, when no other row had a red file, was clean:

```
$ npm run typecheck -w @dems/mobile          (23:07:16)
tsc done        ← no "error TS" line
$ npm exec -w @dems/mobile -- eslint --max-warnings 0 src/features/session-new      (23:30:48, the folder's final state)
folder lint exit=0
```

**Ledger (L-1).** Before this row: 96 suites / 1,257 tests (M0, 22:33). This row adds **3 suites / 36
tests** (`live-session-new-handoff.test.tsx` 7, `live-session-new-sites.test.tsx` 16,
`live-session-new-replica.test.tsx` 13) and no change to an existing test. The other 5 suites and 52 tests
of the 104 / 1,345 above are the parallel rows' (W66, W74, W78).

### 6.5 Re-check of the red file outside this row (once, as the brief asks)

```
23:34  2 users, load averages: 7.46 8.73 8.39
$ npm run test -w @dems/mobile -- --maxWorkers=2 src/features/devices/live-devices-sites.test.tsx      (23:34:39)
PASS src/features/devices/live-devices-sites.test.tsx (11.599 s)
Tests:       20 passed, 20 total
$ npm run typecheck -w @dems/mobile                                                                      (23:34:52)
src/features/devices/testing/live-devices-bed.tsx(64,8): error TS2305: Module '"@dems/shared/sim"' has no exported member 'AudioTrackId'.
typecheck exit=2                                                                                          (23:35:02)
```

W78's suite is green on its own two minutes later (its red in the whole run was a timing failure of a
file being written). The one type error is still in W78's own new test bed (`features/devices/testing/live-devices-bed.tsx:64`),
owner **W78**; no file of this row has a type error (the last clean workspace typecheck, 23:07, and every
file of this folder since). Neither was touched.

## 7. Mutation check (rule M15: nothing in the tree was modified)

Method: M0's (`gateway_check/assets/09a_m0_*`) — a jest transformer outside the tree (`.cache/w67/mut/`,
copied to `assets/67_mutating_transformer.cjs.txt`, `67_jest_mut_config.cjs.txt`, `67_mutate.py.txt`) applies
one mutant's edits **in memory** to one production file; each run executes the folder's six test files
(the three Live files and the three existing ones); detected = jest exit ≠ 0. The SHA-256 of the four
mutated files was compared before and after each batch. Full output: `assets/67_mutations.log`.

```
# W67 mutation check, 2026-10-05 23:23:19; 6 test files per run; the tree is not edited
control (no mutation): exit=0 Tests:       78 passed, 78 total (42 s)
## 8 detected, 0 not detected, 0 not applied, of 8          (batch 1: H1-H3, P1-P5)
## 9 detected, 0 not detected, 0 not applied, of 9          (batch 2: R1-R7, A1-A2)
## 6 detected, 1 not detected, 0 not applied, of 7          (batch 3: L1-L5, B1-B2; L2 survived)
# after the hanging-CONNECTING test was added (23:30:07):
control (no mutation): exit=0 Tests:       79 passed, 79 total (10 s)
L1  detected  … | L2  detected  …
## 2 detected, 0 not detected, 0 not applied, of 2
## the mutated files in the tree, before and after: identical      (every batch)
   a90e13baf60abdfb  src/features/session-new/devices-check-step.tsx
   6762a08e9ed75422  src/features/session-new/session-new-screen.tsx
   a1a38ac8249d7bda  src/features/session-new/use-pending-press.ts
   9e6c3d206d80ceb7  src/features/session-new/use-session-new.ts
```

| Class | Mutants | Detected | A test that fails |
|---|---|--:|---|
| **The hand-off** | H1 `router.replace` only (the queued navigation the step-78 comment warns about); H2 the replace dispatched before the start settled; H3 a refused start leaves `launching` on | 3 / 3 | H1 also fails the existing Simulated hand-off tests; H2 "the delta before the answer …" and "the answer before the delta …" |
| **Pending** | P1 no in-flight guard; P2 spinner at once; P3 spinner never; P4 busy never released; P5 busy never reaches the control | 5 / 5 | "an answer 1 s late: two quick presses send one request …" |
| **Refusals** | R1 LIVE skips the presenter; R2 no denied toast on a create 403; R3 a presented rejection also sets the inline error; R4 the pre-check start skipped; R5 no cancel-and-recreate; R6 success reports false; R7 LIVE leaves on a refused cancel | 7 / 7 | the S1-4 / S2-2 refusal and outage tests; R4 and R6 also fail existing Simulated tests |
| **AC-C-50** | A1 a lost permission ignored; A2 the leave by `router.replace` (the guard holds it) | 2 / 2 | "leaves for /home with the role-change toast …" |
| **The link** | L1 Start enabled while down; L2 an own rule without hysteresis (settling hides); L3 the countdown ignores the link; L4 the CORE hint in SIMULATED; L5 the hint never | 5 / 5 | L2 only after the added test "a reconnect attempt that hangs in CONNECTING keeps the notice" (the fake refused reconnects instantly, so no render saw CONNECTING) |
| **Back while sending** | B1 hardware Back not held; B2 the header arrow not held | 2 / 2 | "while the start is out, hardware Back is held …" |
| **Total** | | **24 / 24** | |

Not mutated (no test claims them): the retry spinner's placement, the clip-reset presenter call, the
LIVE copy strings.

## 8. The device check (lane 1, `dems2_phone` / emulator-5554)

Inside `/usr/bin/lockf -k -t 900 .locks/core-server.lane1.lock`; the lane backend on 4421 (`dems_lane_1`,
`demoControls:false`, started and stopped by the script); device commands inside
`METRO_PORT=8083 DEMS_CORE_HOST_PORT=4421 apps/mobile/scripts/device-session.sh phone '…'`. **No lane
reset** (the phone stays paired as DEV-0001, D143). Scripts: `assets/67_run_w67.sh.txt`,
`67_device_w67.sh.txt`, `67_drive_q.mts.txt` (attempt 2), `67_drive_w67_attempt1.mts.txt`.

**Lock status (read-only, `emulator-user-lock.sh status phone`), `assets/67_lock_status.txt`:**

```
## before (23:09:23)
phone (emulator-5554): AVD dems2_phone, isKeyguardShowing=false, CredentialType=PIN, fingerprint count=1, lock screen disabled=unreadable
## after (23:22:29)
phone (emulator-5554): AVD dems2_phone, isKeyguardShowing=false, CredentialType=PIN, fingerprint count=1, lock screen disabled=unreadable
lock status identical before and after
```

`device-session.sh` reported "screen awake, no keyguard" in both sessions (never exit 77). No PIN was
typed, no fingerprint touched, no keyguard or system prompt answered, no lock or setting changed.

**Attempt 1 (23:12:35–23:15:03, 2 min 28 s; `assets/67_device_attempt1_run.log`)** — aborted by me: the
cold launch `demsdemo:///?core=LIVE&motion=off` showed the Stack Check screen (`67_phone_attempt1_stack_check.png`),
whose live heartbeat counter keeps `uiautomator` from ever idling, so the test-ID driver could not dump.
I stopped only the driver process (23:14:46); the session then ran its own end: relaunch
`core=SIMULATED` (prefs `{"coreLinkSource":"SIMULATED"}`, 0 Core requests after), Metro stopped, backend
`shutdown complete`, `lsof` empty. Server requests in that session: reads only (health, `auth/status`,
`auth/session 401`, `pairing/device 200`).

**Attempt 2 (23:17:44–23:22:11, 4 min 27 s; `assets/67_device_run.log`, every command and its result in
`67_device_driver_steps.log`)** — a queue-driven driver: I wrote each step after reading the previous
screencap; `uiautomator` was used only where the screen idles.

| Step | Evidence | Screencap |
|---|---|---|
| Launch `demsdemo:///login?core=LIVE&motion=off` | `runtime.live.ready` after 5 s; `GET /api/v1/pairing/device 200` | — |
| The username into the app's username field | IME editor `inputType 0x80001` (text); the cursor then in the password field (`0x80081` = text + password variation) | `67_phone_login_username_live.png` (password field empty) |
| The demo password, typed only after the IME confirmed a password field; keypad go | `[DEMS-LIVE] POST /api/v1/auth/sign-in 200` | — |
| The app's biometric offer | declined with the app's own "Not now" (`declineBiometricOffer` = in-memory state, `auth/live-auth-provider.tsx:329`); nothing enrolled | `67_phone_biometric_offer_live.png`, `67_phone_home_live.png` |
| Start Session (`demsdemo:///session/new?step=1`) | step 1 rendered | `67_phone_step1_live.png` |
| S4-6 scan, TERSANGKA, a demo name | the case number `LP/2026/1005-0010` computed from the replica | `67_phone_step1_filled_live.png` |
| S1-4 Next | `POST /api/v1/session 201`, then `POST /api/v1/session/{id}/precheck 202` | — |
| The Core's gate | "All checks passed", 8 of 8; **Core Machine ONLINE PASS** — the CORE check passed over the phone's own socket (F69) | `67_phone_step2_gate_live.png` |
| Ready, Start Recording with the 3-2-1 on | the countdown overlay; `POST /api/v1/session/{id}/start 200` | `67_phone_step3_ready_live.png`, `67_phone_countdown_live.png` |
| **The hand-off** | the monitor "Active Session SES-20261005-0026", Recording 00:00:08; no "A session is already active" toast on screen; `already active` lines in the device JS log: **0** | `67_phone_monitor_after_handoff_live.png` |
| End Session through the app's own controls | a 2.4 s hold did not open the dialog under the motion switch; one tap did (§10 F-4); reason "W67 device check end" typed into the app's field | `67_phone_end_dialog_live.png` |
| Confirm | `POST /api/v1/session/{id}/stop 202`; route sync to the Summary: **SEALED** SES-20261005-0026, LP/2026/1005-0010, start 23:19:54, end 23:21:34, 00:01:39 | `67_phone_after_stop_summary_live.png` |
| Leave as found (D124) | force-stop, `demsdemo:///?core=SIMULATED`: `runtime.sim.hydrated` at once, **0** Core requests after, prefs `{"coreLinkSource":"SIMULATED"}` | `67_phone_after_simulated.png` |

```
-- Core request lines this session (method, path template, status):
      2 DEMS-LIVE] POST /api/v1/auth/touch 200
      1 DEMS-LIVE] POST /api/v1/session/{id}/stop 202
      1 DEMS-LIVE] POST /api/v1/session/{id}/start 200
      1 DEMS-LIVE] POST /api/v1/session/{id}/precheck 202
      1 DEMS-LIVE] POST /api/v1/session 201
      1 DEMS-LIVE] POST /api/v1/auth/sign-in 200
      1 DEMS-LIVE] GET /api/v1/pairing/device 200
      1 DEMS-LIVE] GET /api/v1/auth/status 200
      1 DEMS-LIVE] GET /api/v1/auth/session 401
-- live.misuse lines: 0; credential/token lines (must be 0): 0
-- 'session is already active' lines in the JS log: 0
== 23:22:11 3. backend request log during the session
      1 POST /api/v1/auth/sign-in 200 principal=device
      2 POST /api/v1/auth/touch 200 principal=operator
      1 POST /api/v1/session 201 principal=operator
      1 POST /api/v1/session/:id/precheck 202 principal=operator
      1 POST /api/v1/session/:id/start 200 principal=operator
      1 POST /api/v1/session/:id/stop 202 principal=operator
-- bearer/cookie/credential lines in the server log this run (must be 0): 0
== 23:22:11 4. stop the backend and check nothing is left
-- shutdown complete lines: 1
lsof exit 1 (1 = none)
```

After both sessions (23:22:29, read-only): no reverse rule on emulator-5554 (`adb reverse --list` empty),
no listener on 4421, 8083 or 8081 (only PostgreSQL on 127.0.0.1:4432, untouched), `.locks/core-server.lane1.pid`
0 bytes, the app not running. Secret scan of every `67_*` text asset and both server logs: 0 occurrences of
the demo password, 0 `dvc_`/`ses_`/`bio_` token shapes. Port 5432 and the ports 5173-5175 and 4400 were not
touched; `dems2_tablet` and `dems2_phone2` were not addressed.

## 9. Contract gaps found

**None.** Every operation the screen sends in Live mode has a binding and a contract entry
(`createSession`, `beginPrecheck`, `acknowledgePrecheckWarnings`, `retryPrecheck`, `startSession`,
`cancelSession`, `resetMicClip`; `live/source/bindings.ts:303-346`), and the replica carries what S4-6 and
S5-6 read (`meta` with its counters, `session`, `sessionHistory`, `operators`; `api/realtime-messages.ts:268`).
No `SIM-GAP` and no `CONTRACT-GAP` marker was added (KI-07: 13 IDs / 62 markers, as at `acaff20`).

## 10. Findings

| # | Severity | Finding | Where | Owner / proposal |
|---|---|---|---|---|
| F-1 | Medium | **A second copy of the pending hook already exists**: W78 copied `use-pending-press.ts` into `features/devices/` (its header says so). Ten page rows will each need "busy at once, spinner late" — the KI-08 pattern again | `features/session-new/use-pending-press.ts`, `features/devices/use-pending-press.ts` | A runtime slot (as M0 did for the link rule): `runtime/use-pending-press.ts` exported through `@/runtime`, the two copies re-exporting it. Not done here: `runtime/**` is outside this row |
| F-2 | Low | In LIVE mode step 2 still says **"Speak to test (simulated)"** and the scan button's accessibility label "Scan case number (simulated)" (shared `sessionNew.devices.speakToTest`, `sessionNew.info.caseNumber.scan`; `device-previews.tsx:82`, `session-info-step.tsx:80`). The audio in LIVE is the Core engine's own (the demo Core simulates its devices) and the scan is still a device-side computation, so neither is false, but rule 8 asks a screen with server data to say nothing about a simulation. The web row W64 keeps the same strings | shared copy (`packages/shared`, do-not-touch) | Controller decision: keep (truthful about the demo's devices) or give both clients a LIVE string in `packages/shared` |
| F-3 | Info | A cold launch of `demsdemo:///?core=LIVE&motion=off` on the paired, signed-out phone showed **Stack Check**, not Login; W60 recorded `/?core=LIVE` → `/login` (D143). Not investigated: the second query parameter may be the difference | `navigation/root-navigator.tsx` (not read in depth) | W60's owner / CP: try `/?core=LIVE&motion=off` against the boot route |
| F-4 | Info | The monitor's End Session did not open its reason dialog on a 2.4 s `input swipe` hold under `?motion=off`; a tap did. Consistent with the documented reduced-motion behaviour ("the Dialog opens on press", `session-live/end-session.tsx:13`) if the test switch counts as reduced. The stop itself worked in LIVE although W68 has not converted the monitor yet | `features/session-live/end-session.tsx` | W68: device scripts tap under the switch; the monitor's conversion is W68's |
| F-5 | Info | `uiautomator` never idles on Stack Check (heartbeat counter) nor on the monitor (timer). The queue-driven driver (`assets/67_drive_q.mts.txt`) works on any screen, and its `password` command types only when the IME reports a password-type editor, so a password can never land in a visible field | device method | Reuse in W68 / W72 device checks |
| F-6 | Low | **needs-review (interface):** the cancel site's confirm button is navigation's `BackGuardDialog`, which has no busy prop: the cancel press is guarded (one request; Back held; the dialog stays until the answer) but shows no spinner after 420 ms (LB-1) | `navigation/back-guard.tsx:115-140` | Smallest change (W60's file): `BackGuardDialogProps.busy?: boolean`; on the leave button `accessibilityState={{ busy }}` and `{busy ? <Spinner size="sm" /> : null}` before its label; this row would then pass `busy={cancelPress.pending}` |
| F-7 | Info | CA-02 holds: on the device and in both jest arrival orders the store update and the stack replace land in one commit; the fallback of [CS:S2-2] (a guard change in W60) is not needed | — | Close GC-02 |

## 11. Deviations

| # | Deviation | Why / effect |
|---|---|---|
| DV-1 | The device check took **two sittings** (attempt 1 aborted after 2 min 28 s; attempt 2 4 min 27 s); total device time 6 min 55 s, under the 10 minutes | Attempt 1's driver depended on `uiautomator` idling; attempt 1 changed nothing on the Core but reads, and ended with the app in SIMULATED |
| DV-2 | Process slips: at 22:40 one read-only listing command began with `cd` into the repo root; at 22:41 the checksum of the pre-images ran inside a `( cd … )` subshell | Neither changed anything outside `.cache/rollback/W67/`; no `cd` afterwards |
| DV-3 | "Run checks again" has no icon, so its spinner is added beside the label (the label moves by the spinner's width) instead of replacing an icon | LB-1's "nothing moves" holds for Next and Start (the spinner replaces the arrow and the dot) |
| DV-4 | The fire-and-forget clip reset now also presents a rejection in LIVE (rule 2); [CS] says "results ignored". It still logs as before | One coalesced toast for an outage; a denial says so |
| DV-5 | `handOffToMonitor` catches an exception of the stack dispatch and falls back to `router.replace` in both modes | Only the exception path differs from step 78; in LIVE an exception inside a continuation would otherwise end in a promise nobody reads |
| DV-6 | My progress file's milestone table is split by the slips paragraph (cosmetic) | — |

## 12. Decisions for the controller

| # | Decision | Recommendation |
|---|---|---|
| DN-1 | The presenter runs first **in LIVE only** (`if (live && presentCoreError(error))`, the Pair screen's precedent `pairing-screen.tsx:93`); SIMULATED keeps the step-78 toasts exactly. The web row presents in both modes | Ratify (the brief's "SIMULATED exactly as before") |
| DN-2 | A create 403 in LIVE shows the denied toast **and** the inline error by reason ([CS:S1-4] names the inline error, AC-C-48 the toast); the web shows the toast instead | Ratify, or choose toast-only (one line, `use-session-new.ts:222`) |
| DN-3 | Cancel: LIVE leaves only after the Core cancelled (the dialog stays on a refusal, LB-6); SIMULATED leaves whatever the answer, as before | Ratify |
| DN-4 | **An addition beyond [CS:§3.5]'s mobile column**: on Start Session in LIVE a down link shows a warning, disables Start and stops a running 3-2-1 (M0's one rule). [CS:§3.5] names only the monitor's banner and the CL-22 refusals for mobile | Ratify: it makes "a recording starts only over a connected link" visible, and nothing shows outside LIVE |
| DN-5 | Back (hardware and header) is held while a command of the screen is out (LIVE) | Ratify (the Pair screen's rule) |
| DN-6 | AC-C-50 leaves for `/home` with the runtime's role toast only (no second toast) | Ratify |
| DN-7 | F-1: move the pending hook into `runtime/` in a later slot, with W78's copy | Grant a small runtime slot before more page rows copy it |
| DN-8 | `LIVE_PENDING_REVEAL_MS` is not time-scaled on mobile: the mobile motion layer has no time scale (only the debug `slow` switch) | Accept |
| DN-9 | F-6: the `BackGuardDialog` busy prop | Route to W60's owner, or accept no spinner for the cancel confirm |
| DN-10 | DV-1: two device sittings within the 10 minutes | Accept |

## 13. State left on the phone and in `dems_lane_1`

| Where | State |
|---|---|
| `dems_lane_1` | Not reset. `paired_devices 1` (DEV-0001) and `device_credentials 1`, unchanged. `audit_log` 119 → 121 (attempt 1: sign-in status and session reads) → 152 (attempt 2). One new session **SES-20261005-0026, SEALED** (stopped with the reason "W67 device check end"), with its evidence (the Summary names EV-20261005-0014). Its summary was **not acknowledged** ("Done" not pressed): the next LIVE sign-in on lane 1 may open that summary first — press Done there |
| The phone (`dems2_phone`) | App not running; stored Core-link preference `SIMULATED`; the paired device credential untouched (still paired with lane 1); no session token anywhere (memory only); the biometric offer declined in memory, nothing enrolled; keyguard, PIN and fingerprint as before (status identical); no reverse rule |
| Host | Backend on 4421 stopped (`shutdown complete`), Metro on 8083 stopped, `.locks/core-server.lane1.pid` empty; PostgreSQL on 4432 left running as found |

## 14. Error handling and logging

| Layer | What |
|---|---|
| Persistent log | Every `fail` writes the runtime log (`reportRuntimeIssue`, the persistent, privacy-filtered `dems.mobile.log.v1`) with source `features.sessionNew.<action>`, the error and `{ state, sessionId }` — never a form value. LIVE refusals and outages are `warn` (expected states), unexpected errors `error`; a refused create union is `warn` with its reason. The Live source reports every rejection itself as well (CL-24) |
| User feedback | LIVE: the presenter's toast (denied with the role, offline, limit, failed); otherwise the step-78 toasts and the inline create error |
| Degradation | The control returns to idle (busy released in every path), the step and any dialog stay, a refused start leaves Ready usable, the link notice explains why Start is disabled; the step error boundary of step 78 is unchanged |

## 15. Rollback (R-CO; not executed)

The folder equalled `acaff20` before the first edit (`git diff --stat acaff20 -- apps/mobile/src/features/session-new`
empty at 22:41); pre-images of all 20 files with SHA-256 in `.cache/rollback/W67/` (`pre.sha256`).

1. `git checkout acaff20 -- apps/mobile/src/features/session-new` (restores the five changed files).
2. Remove this row's new files: `apps/mobile/src/features/session-new/use-pending-press.ts`,
   `…/testing/live-session-new-bed.tsx`, `…/live-session-new-handoff.test.tsx`, `…/live-session-new-sites.test.tsx`,
   `…/live-session-new-replica.test.tsx`.
3. The mobile ledger then drops by 3 suites / 36 tests. Note W78's `features/devices/use-pending-press.ts`
   is a copy, not an import: it does not break.

## 16. Assets (`implementation/assets/`)

| File | What |
|---|---|
| `67_phone_login_username_live.png`, `67_phone_biometric_offer_live.png`, `67_phone_home_live.png`, `67_phone_step1_live.png`, `67_phone_step1_filled_live.png`, `67_phone_step2_gate_live.png`, `67_phone_step3_ready_live.png`, `67_phone_countdown_live.png`, `67_phone_monitor_after_handoff_live.png`, `67_phone_end_dialog_live.png`, `67_phone_after_stop_summary_live.png`, `67_phone_after_simulated.png` | Attempt 2, in order (§8) |
| `67_phone_attempt1_stack_check.png`, `67_phone_attempt1_after_simulated.png` | Attempt 1 |
| `67_device_run.log`, `67_device_attempt1_run.log`, `67_device_driver_steps.log`, `67_lock_status.txt` | Run logs, every driver command with its result, the lock status before and after |
| `67_run_w67.sh.txt`, `67_device_w67.sh.txt`, `67_drive_q.mts.txt`, `67_drive_w67_attempt1.mts.txt` | The device scripts |
| `67_mutate.py.txt`, `67_mutating_transformer.cjs.txt`, `67_jest_mut_config.cjs.txt`, `67_mutations.log` | The mutation check |
| `67_final_gate.log` | §6 |
