# W72 — Mobile Finalization, Session Summary and Sessions hub in LIVE mode (blueprint step 94)

**Row**: W72 (plan §8.4; prov. 88, 89, 91 merged). Agent: coder-execution. **Time**: 2026-10-06 00:30–01:20 WIB.
**Status**: **needs-review** — the code, the tests, the gate and the device check are done and green; two
findings need a decision outside this row's write paths (F-1: the hub's "Updated" stamp during an outage,
a production change in `features/sessions/`, which this row may not make; F-2: a stale session read by
the runtime's route sync on a Live reconnect, `runtime/**`). Details in §9–§11.

Settle sites S2-4, S4-4, S4-5 [CS:§8.6, §8.7]; AC-C-48, AC-C-57, AC-C-58; LB-1, LB-6, LB-10 [CS:§8.1];
decision D158 / F69-1 (StrictMode); D164 DN-7 (device rules); D166 (the pending control from `@/runtime`).
Gate: CLG (plan §11) on top of SG. Assets: `implementation/assets/72_*` (34 files, §16).

Note on the file name: the plan's documentation table names this file `72_mobile_finalizing_summary_sessions.md`
[PL: row W72 in the artifact table]; the brief names `72_mobile_finalization_summary_sessions.md`. The brief's
name is used (DV-5).

---

## 1. Result at a glance

| Item | Result |
|---|---|
| S2-4 (the acknowledgement) | `useAcknowledgeSummary` sends operation **37** `acknowledgeSessionSummary` through `useCoreActions()` + `settle` in both modes; Done, View in Evidence and Back navigate only in `ok`; a refusal keeps the Summary and returns the control to idle |
| S4-4 | Unchanged rule, proven on the replica: whether a request is needed is read from the store before the call; a summary another console acknowledged, or a past session, sends nothing |
| S4-5 | Unchanged code, proven on the Live source: the refresh stamp is the Live clock; the refresh sends nothing. Finding F-1: it also stamps "Updated" while the Core link is down |
| Pending control (LB-1, D166) | Three `usePendingPress()` of `@/runtime` (Back, Done, View in Evidence) with `busyState` and `PendingSpinner`; ONE request at a time across the three |
| Core link (M1, 09b §8) | `useCoreLinkNotice()` in one call: while the summary waits and the link is down, a warning says why the buttons cannot finish |
| StrictMode (D158) | Nothing starts on mount: tests under `<StrictMode>` count 0 requests on mount and exactly 1 per press, for the Summary, Finalization and the hub |
| Finalization and the hub | **No production file changed** (`git diff --stat acaff20` of both folders: 0 lines; the new files there are two test files). Live tests show both read the Core's replica and claim no simulation |
| Simulated mode | Unchanged: the three folders' 10 existing test files are byte-equal to `acaff20` and green; the Summary's copy outside `live.*` is pinned to the `acaff20` digest |
| New tests | 4 suites / **39 tests** + one test bed (§5) |
| Mutation check (M15, in memory) | **16 of 16 detected**, behaviour tests only (the static scan left out); the mutated files byte-identical before and after (§7) |
| Device check (lane 1, phone) | LIVE: sign-in 200 → Sessions hub with the lane's sessions → Start Session (create 201, pre-check 202, start 200) → monitor RECORDING → End Session → stop 202 → **Finalization** (5 screencaps, the Core's evidence ID EV-20261006-0015) → Summary SEALED, pending → the app's own **Done → acknowledge 204** → Home → hub (new row, no pending chip) → the acknowledged Summary → relaunch SIMULATED (prefs `SIMULATED`, 0 Core requests). Two sittings (the phone went offline in the first, DV-1), 7 min 11 s in all. Lock status identical before and after |
| Gate | Whole `@dems/mobile` **128 suites / 1,580 tests, exit 0**; typecheck exit 0; lint exit 0, 0 warnings; KI-07 13 IDs / 62 markers (as at `acaff20`) |
| `CONTRACT-GAP` | none new (§9); the brief's "operation 70" for the Summary is operation 37 (F-4) |

## 2. Sources read

`masterplan/02_plan.md` (row W72; citation convention; §11 SG and CLG); `masterplan/04_client_integration_spec.md`
(§7.3 table rows `features/session-finalizing`, `features/session-summary`, `features/sessions`; §8.1 LB-1..LB-10;
§8.6 S2-4; §8.7 S4-4, S4-5; AC-C-48; §17.4 Row 21 #3); `gateway_check/09_cp_mobile_runtime.md` §4 answer 3
(the ten rules); `gateway_check/09b_m1_mobile_consolidation.md` §8; `implementation/51_mobile_runtime.md` §4;
`implementation/67_mobile_session_new.md` (bed, device procedure, D157 state); `implementation/66_mobile_home_more.md`
§4 (CONTRACT-GAP-W66-1/2); `implementation/34_module_sessions.md` (operation 37: 204 for a repeat or another ID;
F-7: the SEALED session stays current until the next create); decisions D124, D125, D157, D158, D163, D164, F59, F69.
Code: the 36 files of the three folders; `packages/shared/src/api/sessions.ts:22,387-409,569-575` (operation 37,
its `notPermitted` 403 example); `packages/shared/src/api/state-slices.ts:752-790` (the replicated slices),
`:590-597` (the signature is "a simulated signature" in the contract); `packages/shared/src/live/{settle,core-actions}.ts`;
`apps/mobile/src/runtime/{index,use-pending-press,pending-control,use-core-link-notice,core-errors,session-route-sync,route-sync}.ts(x)`.

## 3. What was built

### 3.1 S2-4 and S4-4 — `apps/mobile/src/features/session-summary/use-summary.ts`

| Lines | What and why |
|---|---|
| `:10-15` (header) | States the Live reading: every read is the Core's replica; the one command goes through `useCoreActions()` + `settle` in both modes (in Simulated mode `settle` runs the continuation before it returns, exactly as the earlier synchronous call) |
| `:127-133` | `AcknowledgeHandlers { ok, done? }`: what followed the old `if` becomes `ok`; `done` is the pending control's `release` |
| `:147-196` | `useAcknowledgeSummary(sessionId)` returns `(handlers) => void`. `:158` one request at a time, whichever control asked (a second call while one is out is released at once and sends nothing). `:162` S4-4: `selectPendingSummaryId(sim.store.getState())` before the call — the replica in LIVE — so a summary that is not pending (a past session, or one another console acknowledged) navigates without a request. `:172` `settle(() => actions.acknowledgeSummary(sessionId), …)`. `:178` in LIVE a rejection goes to the runtime's presenter first (denied toast with the role, outage, limit) and is logged at `warn`; otherwise the step-80 toast and an `error` record, as before. `:185` `done` clears the in-flight flag and releases the control in every path |
| — | `sim.actions` is no longer read (it was a CLG (c) hit at `acaff20`, `use-summary.ts:135`); `useSimInstance` stays only for the S4-4 read, which the spec keeps ("No change: a read of the replica") |

### 3.2 The screen — `apps/mobile/src/features/session-summary/session-summary-screen.tsx`

| Lines | What and why |
|---|---|
| `:25-36` (header) | The Live reading, the controls, the link notice, nothing on mount, and why the signature keeps SIMULATED (the contract calls it "a simulated signature", `api/state-slices.ts:592-597`; D158 DC-4 ruled the same for the web) |
| `:91-94` | Three `usePendingPress()` from `@/runtime` (Back, Done, View in Evidence) and `useCoreLinkNotice()` — the M1 one-call idiom, no own link rule |
| `:117-127` | `onDone`, `onBack`, `onViewEvidence`: `press.run((release) => acknowledge({ ok: () => navigate(…), done: release }))` — navigation in `ok` (S2-4) |
| `:131-142` | Hardware Back acknowledges through `onBack`; while a command is out it is consumed and sends nothing (the hook's one-request rule) |
| `:194` | `linkDown={linkDown && session.pending}`: the notice only when an acknowledgement is actually needed |
| `:262-275` | The header arrow: `{...busyState(press.busy)}`, the kit spinner in place of the arrow while `press.pending` |
| `:295-331` | Done and View in Evidence: `busyState`, `PendingSpinner` before the label (neither has an icon, DV-3); when `linkDown`, an `Alert` "Core server unreachable" above the buttons |
| `i18n.ts:59-64` | Two LIVE-only keys `live.linkDownTitle`, `live.linkDownBody`, no simulation wording; every other key unchanged (`git diff acaff20 -- …/i18n.ts`: 6 added lines) |

### 3.3 Finalization and the hub — no production change

Both folders read only the store (`use-finalizing.ts`, `use-sessions-data.ts`), which in LIVE is the Live source's
replica of `session` (with `finalization.steps`), `lastSealedSessionId`, `lastSealedAcknowledged`, `sessionHistory`,
`operators`, `time` and the derived `clock` [`api/state-slices.ts:752-790`]. Neither sends a Core command; the
hub's pull-to-refresh is a 700 ms animation on the store's clock (S4-5). Their Live behaviour is proven by tests
(§5) and on the phone (§8); what they cannot do truthfully without a change is reported (F-1, F-3).

## 4. The ten mobile rules (CP-M1 §4 answer 3) and 09b §8

| # | Rule | How it holds here |
|---|---|---|
| 1 | One way in | `useCoreActions()` + `settle`; no `useSimActions`, no `.actions` read on a `Sim` (CLG (c), §6.3; static test) |
| 2 | Presenter first; reset in `beforeEach` | `use-summary.ts:178`; the bed's `resetLiveSummaryBed()` calls `resetCoreErrorPresenterForTests()`; a 429 is a limit and shows no link notice (tested) |
| 3 | No Core address, no network API | static test "the folders name no network API …" |
| 4 | No credential | no secure-store import, nothing secret logged (`reportRuntimeIssue` gets `{ sessionId }` only); device logs scanned: 0 password, 0 token shapes (§8) |
| 5 | One LIVE idiom | `useCoreLink().source === 'LIVE'` in `use-summary.ts` only; `useCoreLinkNotice()` for the link |
| 6 | React Compiler | no state from refs in render; refs written in handlers only; lint 0 errors / 0 warnings |
| 7 | Store clock | the pending reveal is the runtime hook's (store clock); no timer added (static test pins the two step-80 timers) |
| 8 | Truthful copy, no `SIM-GAP` | LIVE copy says nothing about a simulation; KI-07 13 / 62 as at `acaff20`; the one remaining "SIMULATED" is the contract's own word for the signature |
| 9 | Do-not-touch list | written only `features/session-summary/**` and test files in the two other folders; the 72 baseline files and `heartbeat-release-gate.test.tsx` unchanged (§6.1) |
| 10 | Ledger and device | §6, §8 |
| 09b §8 / D166 | `usePendingPress` + `busyState` + `PendingSpinner` from `@/runtime`; imports through `@/runtime` and `@/navigation` only | static test: three `usePendingPress()`, three `busyState`, three `PendingSpinner`, no deep `@/runtime/…` or `@/navigation/…` import in production files |

## 5. Tests

Test bed `apps/mobile/src/features/session-summary/testing/live-summary-bed.tsx` (test-only): the app's real Live
source (`createMobileLive`) over the contract-checked fake transport, the real `AppProviders` with the runtime's real
`SessionRouteSync`, and the REAL route files of `/session/finalizing`, `/session/summary/[sessionId]`, `/sessions`,
`/sessions/[sessionId]`; `/session/live` is a stand-in with the live route's policy (W67's pattern). The Core's engine is
a real simulator whose clock is kept equal to the fake clock; `elapse(ms)` lets time pass on the Core and pushes each
step's changed replicated slices as one delta; `coreDo(run)` runs one engine action another client sent. Operation 37 is
hosted like the Core: a change travels as a delta whose revision the 204 names; a repeat or another ID answers 204 with
no revision. Sessions created in the bed carry details that are not in the bundled dataset (`CORE_ONLY_INPUT`), so a
screen showing them read the Core. `strict: true` renders under `<StrictMode>`.

| File | Tests | What it proves |
|---|--:|---|
| `session-summary/live-summary-sites.test.tsx` | 15 | The Summary shows the Core's data (ID, case, subject, investigator, evidence ID, four track hashes, manifest, the Core's finished pipeline); the only simulation word is the signature row; opening sends nothing; an unknown ID says "not in this Core's history". **S2-4** success via Done (one request with this ID, Home after the 204, replica acknowledged), View in Evidence (the Core's evidence route), hardware Back; **refusal** 403 `notPermitted` on Done and on View in Evidence (denied toast "Not permitted / Requires the Investigator role", stays, idle, a second press sends again); **outage** ("Core server unreachable / Nothing was changed.", stays, second press succeeds); **429** (limit toast with the seconds, no offline wording, no link notice). **S4-4**: acknowledged by another console → nothing sent; a past session → nothing sent. **Pending**: 1 s answer — Done busy at once, no spinner at 300 ms, spinner inside Done at 500 ms, Done+View+Back+arrow send ONE request; 50 ms answer — no spinner at any 10 ms step. **Link**: the notice while the summary waits and the link is down, a press stays, notice gone and Done finishes when the link is back. **StrictMode**: 0 requests on mount, 1 per press |
| `session-finalizing/live-finalizing.test.tsx` | 5 | The session followed from the Core's stop to the acknowledged summary: STOPPING (the Core's case and subject, "Assigned when finalizing starts"), FINALIZING with the evidence ID the Core assigned, steps advancing, no simulation wording, the route sync opens the Summary at SEALED, nothing sent until the operator's Done, then exactly one operation 37. Back while finalizing is consumed and sends nothing. The link drops mid-pipeline: the last replicated step stays, nothing is sent, the Core seals meanwhile, the reconnect's snapshot brings SEALED and the Summary opens. StrictMode: nothing sent, the Summary opens once. No session on the Core: "No finalization in progress" |
| `sessions/live-sessions.test.tsx` | 9 | Phone and tablet: the Core's history newest first, the Core-only session on top with "Summary pending", count, no simulation wording, nothing sent. The pending row hands off to the Summary; only its Done acknowledges. Tablet detail pane shows the Core's case, subject, investigator, evidence ID. Posters: a session recorded on the Core shows the room still; a seeded package keeps its own poster (CONTRACT-GAP-W66-1 context). The active card follows the Core (recording time on the Live clock; the Core's stop turns it to finalization; the route sync opens Finalization at FINALIZING). **S4-5** success: the stamp is the press time on the Live clock + `REFRESH_MS`, nothing sent; **outage**: the refresh still stamps "Updated" (F-1), rows keep the last replica, the Core's newer session arrives with the link without a refresh. StrictMode: hub + detail + refresh send nothing |
| `session-summary/summary-live-static.test.ts` | 10 | CLG (c) and rules 1, 3, 4, 5, 8, 9 over the three folders' 26 production files; the one Core call's shape; three pending controls from `@/runtime`; no command inside an effect; the Summary's non-`live` copy pinned to its `acaff20` digest; no `SIM-GAP` marker added (the marker text is built from parts, decision D167) |

Every 403 is named by its example `notPermitted` (`fake.example('acknowledgeSessionSummary', 403, 'notPermitted')`):
operation 37 has one (TECHNICIAN lacks SESSION_START, `api/sessions.ts:441,573`).

## 6. Verification

Commands from `/Users/gsp-budi/Documents/DEMS`; raw output `assets/72_final_gate.log`.

### 6.1 CLG (a) — the existing tests pass and are not in the diff; Finalization and the hub change test files only

```
## 2026-10-06 01:12:40 WIB CLG (a): the three folders' test files at acaff20
apps/mobile/src/features/session-finalizing/finalizing.model.test.ts
apps/mobile/src/features/session-finalizing/session-finalizing-screen.test.tsx
apps/mobile/src/features/session-finalizing/testing/flow-harness.tsx
apps/mobile/src/features/session-finalizing/testing/flow-test-setup.ts
apps/mobile/src/features/session-summary/session-summary-screen.test.tsx
apps/mobile/src/features/session-summary/summary.model.test.ts
apps/mobile/src/features/sessions/sessions-model.test.ts
apps/mobile/src/features/sessions/sessions-screen.test.tsx
apps/mobile/src/features/sessions/testing/sessions-harness.tsx
apps/mobile/src/features/sessions/testing/sessions-test-setup.ts
$ git diff --stat acaff20 -- <those 10 files>
(end: 0 lines)
$ git diff --stat acaff20 -- apps/mobile/src/features/session-finalizing apps/mobile/src/features/sessions
(end: 0 lines)
$ git status --short --untracked-files=all -- the three folders
 M apps/mobile/src/features/session-summary/i18n.ts
 M apps/mobile/src/features/session-summary/session-summary-screen.tsx
 M apps/mobile/src/features/session-summary/use-summary.ts
?? apps/mobile/src/features/session-finalizing/live-finalizing.test.tsx
?? apps/mobile/src/features/session-summary/live-summary-sites.test.tsx
?? apps/mobile/src/features/session-summary/summary-live-static.test.ts
?? apps/mobile/src/features/session-summary/testing/live-summary-bed.tsx
?? apps/mobile/src/features/sessions/live-sessions.test.tsx
## KI-07: 13 IDs / 62 markers (acaff20: 13 / 62)
## apps/mobile/src/features/settings/heartbeat-release-gate.test.tsx vs b90a3c6: 0 lines
```

The two folders without a production change hold only new test files (`??` lines). In the final whole-suite run all
10 suites of the three folders pass (`PASS …/finalizing.model.test.ts`, `…/session-finalizing-screen.test.tsx`,
`…/session-summary-screen.test.tsx`, `…/summary.model.test.ts`, `…/sessions-model.test.ts`, `…/sessions-screen.test.tsx`
and the four new ones). The 72 baseline test files are not in any write path of this row.

### 6.2 CLG (b) — one Live test per named site: success, refusal (denied toast), outage

| Site | Success | Refusal | Outage |
|---|---|---|---|
| S2-4 | sites: "success: Done …", "success: View in Evidence …", "success: hardware Back …"; finalizing: "stop → … → Done" | sites: "refusal: a 403 (example notPermitted) …", "refusal on View in Evidence …" (and the 429 limit) | sites: "outage: …"; "while the summary waits and the link is down …" |
| S4-4 | sites: the success tests (pending → one request) | sites: the 403 tests (the read says "needed", the Core refuses) | sites: the link-down test (the read needs no link; the command reports the outage) |
| S4-5 | sessions: "success: pull-to-refresh … Live clock …" | none of its own: no request is sent (as W67's S4-6) | sessions: "outage: with the link down …" |
| Finalization / hub show the server's data, claim no simulation | finalizing: test 1 (`wordsUnder('screen-session-finalizing')` matches none); sessions: the two layout tests (`wordsUnder('screen-sessions')`), the tablet detail (`wordsUnder('pane-detail')`) | — | finalizing: "the link drops …"; sessions: "outage …" |

```
$ npm run test -w @dems/mobile -- --maxWorkers=2 src/features/session-summary/live-summary-sites   (00:45:51)
Tests:       15 passed, 15 total
$ … src/features/session-finalizing/live-finalizing   (00:46:56)
Tests:       5 passed, 5 total
$ … src/features/sessions/live-sessions   (final run in the whole suite, 01:13–01:15)
PASS src/features/sessions/live-sessions.test.tsx
```

### 6.3 CLG (c) — no `useSimActions`, no `.actions` read on a `Sim`

```
## 01:13:02 CLG (c), the filter also drops back-quoted translation keys in comments
$ grep -rnE "useSimActions|\.actions\b" <the three folders> --include='*.ts' --include='*.tsx' | grep -vE '\.test\.|/testing/' | grep -vE "styles\.actions|['`][a-z.-]*\.actions\.[A-Za-z]+['`]"
(exit of the last grep: 1 ; 1 = nothing found)
```

The lines the filter removes are listed in `assets/72_final_gate.log` (translation keys `….actions.…`, `styles.actions`,
one comment in `sessions/i18n.ts:8`). At `acaff20` the folder had one real hit, `use-summary.ts:135`
`sim.actions.acknowledgeSummary(sessionId)`, now gone.

### 6.4 SG — the whole workspace

```
## 2026-10-06 01:13:17 WIB  1:13  2 users, load averages: 4.14 5.71 5.95
## $ npm run test -w @dems/mobile -- --maxWorkers=2
exit=0
Test Suites: 128 passed, 128 total
Tests:       1580 passed, 1580 total
Time:        114.66 s, estimated 190 s
## 01:15:12 $ npm run typecheck -w @dems/mobile
exit=0
## 01:15:18 $ npm run lint -w @dems/mobile
exit=0
> @dems/mobile@0.1.0 lint
> eslint .
## finished 01:15:31
```

Lint output holds no warning line (`grep -ciE "warning|problem"` on it: 0). Ledger: 114 / 1,431 at 00:28 (the brief's
floor); this row adds **4 suites / 39 tests**; the rest of 128 / 1,580 is the parallel rows'.

Earlier run, for the record (00:56:50, load 6.45): 127 of 128 suites, 1,574 of 1,575 tests — the one red file was
`src/features/session-live/live-session-live-link.test.tsx`, owner **W68** (being written then); green in the final run.
At 00:40 the workspace typecheck had four errors in W68's `session-live-screen.tsx` and at 00:55 one in this row's bed
(`ReactTestInstance` imported from the wrong module) — fixed at 00:55 (`react-test-renderer`), typecheck clean since.

## 7. Mutation check (rule M15: nothing in the tree was modified)

Method: W67's (`assets/67_mutating_transformer.cjs.txt`) — a jest transformer outside the tree (`.cache/w72/mut/`, copied
to `assets/72_mutating_transformer.cjs.txt`, `72_jest_mut_config.cjs.txt`, `72_mutate.py.txt`) applies one mutant's edits
**in memory**; each run executes the four behaviour files (the three Live files and the existing Simulated Summary
test). The static scan is left out on purpose, so a mutant must be caught by behaviour, not by a text pin.

```
# W72 mutation check, 2026-10-06 01:09:32; 4 test files per run; the tree is not edited
control (no mutation): exit=0 Tests:       38 passed, 38 total (28 s)
## 6 detected, 0 not detected, 0 not applied, of 6        (U1-U6)
# W72 mutation check, 2026-10-06 01:10:45
## 10 detected, 0 not detected, 0 not applied, of 10      (S1-S8, X1, X2)
## the mutated files in the tree, before and after: identical
   96a65de742fbbc2d  src/features/session-finalizing/session-finalizing-screen.tsx
   622463989c24dc49  src/features/session-summary/session-summary-screen.tsx
   da1bda0facd076fe  src/features/session-summary/use-summary.ts
   1dc09edfe5d818bd  src/features/sessions/sessions-screen.tsx
```

| Class | Mutants | Detected |
|---|---|--:|
| The hook | U1 LIVE skips the presenter; U2 a refusal still navigates; U3 the S4-4 read dropped; U4 no one-request guard; U5 in-flight never cleared; U6 control never released | 6 / 6 |
| The screen | S1 Done navigates before the answer; S2 Done never busy; S3 no spinner; S4 notice never; S5 notice always (no link rule); S6 **the acknowledgement on mount** (the D158 class: 15 tests fail across all four files); S7 Back leaves without acknowledging; S8 View in Evidence goes Home | 8 / 8 |
| The unchanged screens in LIVE | X1 S4-5 stamp on the wall clock; X2 Finalization never shows the Core's evidence ID | 2 / 2 |
| **Total** | | **16 / 16** |

## 8. The device check (lane 1, `dems2_phone` / emulator-5554)

Inside `/usr/bin/lockf -k -t 900 .locks/core-server.lane1.lock`; the lane backend on 4421 (`dems_lane_1`,
`demoControls:false`, started and stopped by the script); device commands inside
`METRO_PORT=8087 DEMS_CORE_HOST_PORT=4421 apps/mobile/scripts/device-session.sh phone '…'`. **No lane reset, no unpair**
(DEV-0001 kept). Launch `demsdemo:///login?core=LIVE&motion=off` (never `/` with `motion=`); `uiautomator` only on the hub
and on Start Session (the driver refuses `ids` for any other screen); Login, Summary and Home by fixed coordinates
(W60's / W67's / W74's measured centres). The demo password was typed only into a field the IME reported as a password
field, never printed, logged or written. Scripts: `assets/72_run_w72.sh.txt`, `72_run_w72b.sh.txt`, `72_device_w72.sh.txt`,
`72_drive_q.mts.txt`.

**Lock status (read-only `emulator-user-lock.sh status`), `assets/72_lock_status.txt`:**

```
## before (00:58:35)
phone (emulator-5554): AVD dems2_phone, isKeyguardShowing=false, CredentialType=PIN, fingerprint count=1, lock screen disabled=unreadable
tablet (emulator-5556): AVD dems2_tablet, isKeyguardShowing=false, CredentialType=PIN, fingerprint count=1, lock screen disabled=unreadable
## after (01:07:18)
phone (emulator-5554): AVD dems2_phone, isKeyguardShowing=false, CredentialType=PIN, fingerprint count=1, lock screen disabled=unreadable
tablet (emulator-5556): AVD dems2_tablet, isKeyguardShowing=false, CredentialType=PIN, fingerprint count=1, lock screen disabled=unreadable
lock status identical before and after
```

`device-session.sh` reported "screen awake, no keyguard" both times (never 77). No PIN typed, no fingerprint touched, no
keyguard or system prompt answered, no lock or setting changed. The app's biometric offer was answered "Not now".

**Sitting 1 (00:58:46–01:01:37, 2 min 51 s; `assets/72_device_sitting1_run.log`)** — sign-in 200, the biometric offer on
Home; then at 00:59:43 `adb` reported **`error: device offline`** for emulator-5554 during a screencap. The transport came
back (`adb devices` at 01:01:37: `emulator-5554 device`, a new transport ID), but the session's reverse rules were gone,
so the closing SIMULATED launch could not load its bundle ("Unable to load script", `72_phone_sitting1_unable_to_load.png`)
and the stored preference stayed `LIVE`. Server requests: reads and the sign-in only (`auth/session 401`, `auth/status`,
`pairing/device`, `sign-in 200`); `audit_log` 178 → 181. Cause not established (another session's `adb` server restart is
the likeliest; `ps` is not available in this sandbox).

**Sitting 2 (01:02:45–01:07:05, 4 min 20 s; `assets/72_device_sitting2_run.log`, every command and result in
`72_device_sitting2_driver_steps.log`)** — the closing step re-adds the session's own Metro reverse rule if it is missing
(DV-2). Total device time 7 min 11 s.

| Step | Evidence | Screencap |
|---|---|---|
| LIVE Login, "Core online", paired | `runtime.live.ready`, `GET /api/v1/pairing/device 200` | `72_phone_login_live.png` |
| Sign-in (username, then the password only into the IME-confirmed password field) | `POST /api/v1/auth/sign-in 200` | `72_phone_home_offer_live.png` |
| Biometric offer → "Not now"; **Sessions hub in LIVE** | the lane's sessions newest first: SES-20261005-0026 (recorded in Live mode, room still), 0023, 0022 … with the dataset posters | `72_phone_hub_live_before.png` |
| Start Session step 1 (fill-in number, TERSANGKA, "W72 Device Check") → Next | `POST /api/v1/session 201`, `POST …/precheck 202` | `72_phone_step1_filled_live.png`, `72_phone_gate_live.png` ("All checks passed", Core Machine ONLINE) |
| Ready → Start | `POST …/start 200`; monitor "Active Session SES-20261006-0027", Recording | `72_phone_ready_live.png`, `72_phone_monitor_live.png` |
| End Session with a reason (the monitor's own dialog) | `POST …/stop 202` | `72_phone_end_dialog_live.png` |
| **Finalization in LIVE** | "Ending recording and closing tracks…", the Core's case LP/2026/1006-0011 and subject; then "83% complete", five steps with the Core's durations (1.1 / 0.8 / 0.7 / 0.7 / 1.1 s), **Evidence ID EV-20261006-0015** | `72_phone_finalizing_live_1.png` … `_5.png` |
| The route sync opens the **Summary**, pending | SEALED SES-20261006-0027, sealed 01:05:11, start 01:04:22 / end 01:05:05 with the Core's GNSS badges, 00:00:42, 96.4 MB, investigator AKP Budi Santoso | `72_phone_summary_pending_live.png` |
| The app's own **Done** (this row's S2-4) | `POST …/summary/acknowledge 204`, then Home ("Core Live", EV-20261006-0015 first in Recent Sessions) — **a real state change on the lane** | `72_phone_home_after_done_live.png` |
| Hub after | SES-20261006-0027 on top, Sealed, no "Summary pending" chip | `72_phone_hub_live_after.png` |
| The acknowledged Summary (deep link) | the same Core data, no stamp replay | `72_phone_summary_acknowledged_live.png` |
| Leave as found (D124) | `demsdemo:///?core=SIMULATED`: `runtime.sim.hydrated` after 16 s, **0** Core requests after, prefs `{"coreLinkSource":"SIMULATED"}`; the SIMULATED Login | `72_phone_after_simulated.png` |

```
-- Core request lines this session (method, path template, status):
      1 DEMS-LIVE] POST /api/v1/session/{id}/summary/acknowledge 204
      1 DEMS-LIVE] POST /api/v1/session/{id}/stop 202
      1 DEMS-LIVE] POST /api/v1/session/{id}/start 200
      1 DEMS-LIVE] POST /api/v1/session/{id}/precheck 202
      1 DEMS-LIVE] POST /api/v1/session 201
      1 DEMS-LIVE] POST /api/v1/auth/touch 200
      1 DEMS-LIVE] POST /api/v1/auth/sign-in 200
      1 DEMS-LIVE] GET /api/v1/pairing/device 200
      1 DEMS-LIVE] GET /api/v1/auth/status 200
      1 DEMS-LIVE] GET /api/v1/auth/session 401
-- live.misuse lines: 0; credential/token lines (must be 0): 0
-- routeSync lines:    1 runtime.routeSync.transition
== 01:07:05 3. backend request log during the session
      1 POST /api/v1/session 201 principal=operator
      1 POST /api/v1/session/:id/precheck 202 principal=operator
      1 POST /api/v1/session/:id/start 200 principal=operator
      1 POST /api/v1/session/:id/stop 202 principal=operator
      1 POST /api/v1/session/:id/summary/acknowledge 204 principal=operator
-- bearer/cookie/credential lines in the server log this run (must be 0): 0
-- shutdown complete lines: 1
lsof exit 1 (1 = none)
-- reverse rules listed above (none expected)
```

After both sittings (01:07:18, read-only): no listener on 4421, 8087 or 8081; PostgreSQL on 127.0.0.1:4432 left running as
found; `.locks/core-server.lane1.pid` 0 bytes; `adb -s emulator-5554 reverse --list` empty. Secret scan of every `72_*`
text asset, both server logs and both driver event logs (`node --import tsx .cache/w72/secret_scan.mts …`, counts only):
`files 14; demo password occurrences 0; dvc_/ses_/bio_ token shapes 0`. Ports 5432, 5173-5175, 4400 and lane 3 untouched;
`dems2_phone2` not addressed; the tablet only read by `status`.

## 9. Contract gaps found

**None new.** Operation 37 has a binding (`live/source/bindings.ts:365-368`), a contract entry with a `notPermitted` 403
example (`api/sessions.ts:387-409, 569-575`), and the replica carries everything the three screens read
(`api/state-slices.ts:752-790`). The hub's posters meet the known CONTRACT-GAP-W66-1 (no media reference in the replicated
history): the hub joins a poster by the evidence number, which is truthful in practice because the Core's evidence counter
continues after the seeded 13 packages (a Live recording never matches a bundled package; tested, and seen on the phone);
no marker added. No `SIM-GAP` marker added (KI-07 13 / 62).

## 10. Findings

| # | Severity | Finding | Where | Owner / proposal |
|---|---|---|---|---|
| F-1 | Low (truthfulness; **needs-review**) | **The hub stamps "Updated hh:mm:ss" after a pull-to-refresh while the Core link is down**, although nothing was fetched and the replica may be stale since the outage began (in LIVE the data is pushed, so the stamp is only true while the link is up). Proven by `live-sessions.test.tsx` "outage …" | `features/sessions/sessions-screen.tsx:123-140` (`useHubRefresh`, `setUpdatedAt(from + REFRESH_MS)` at `:133`), footer `:240-247` | A production change in a folder this row may not change: in `SessionsListColumn` take `const { offline } = useCoreLinkNotice();` (from `@/runtime`), and (a) stamp only when `!offline` (in `useHubRefresh` pass `offline` and skip `setUpdatedAt` when it is true), (b) show the runtime's link notice above the rows while `offline` (one `Alert`, the copy of the Summary's `live.linkDownTitle` pattern). Then flip the assertion of the outage test from "stamps" to "does not stamp". Alternative: accept as is (the stamp names a time, the global monitor banner is not on this screen) |
| F-2 | Medium (runtime, `needs-review`) | **On a Live reconnect the route sync resyncs with the session from BEFORE the snapshot.** `SessionRouteSync` reads `latest.current`, which an effect updates after the commit (`runtime/session-route-sync.tsx:37-39`), while the Live source emits `RESYNCED` right after it applied the snapshot (`runtime/sim-runtime-provider.tsx:429`), before React re-rendered. Reproduced in jest on the hub: summary of SES-…-0024 pending, link down, the Core acknowledges it and seals SES-…-0025 (pending); on reconnect the app jumped from `/sessions` to `/session/summary/SES-20261001-0024` — a summary the Core had already acknowledged — while 0025's waited (`assets/72_f2_reproduction.txt`: replica history `0025, 0024`, path `/session/summary/SES-20261001-0024`). Harmless for data (Done sends nothing for a non-pending summary) but it opens the wrong screen | `apps/mobile/src/runtime/session-route-sync.tsx:72` | Runtime owner (M1 follow-up / W60): in the bus callback read the session from the store at emit time, e.g. `const internals = useRuntimeInternals();` and `resync('heartbeat', { session: selectActiveSessionInfo(internals.sim.store.getState()), pathname: latest.current.pathname })` (`selectActiveSessionInfo` is exported, `sim-runtime-provider.tsx:102`); plus a test on the Live source like this row's. Not done here: `runtime/**` is outside this row. This row's hub test avoids the trigger (no pending summary across the outage) so it does not pin the defect |
| F-3 | Low | Finalization and the hub show **no link notice** in LIVE when the Core link is down (the app-wide banner is drawn by the monitor and Recovery only). Finalization keeps the last replicated step with its running spinner — true in the sense that the Core keeps sealing (tested: the seal arrives with the reconnect), but the operator is not told the view is frozen | `features/session-finalizing/session-finalizing-screen.tsx` (no `useCoreLinkNotice`); `features/sessions/sessions-screen.tsx` | Optional, with F-1: one `useCoreLinkNotice()` + `Alert` per screen. Not needed for truthfulness of what is shown, so not `needs-review` on its own |
| F-4 | Info (brief erratum) | The brief calls the Summary's acknowledgement "operation 70" with no `notPermitted` example. It is **operation 37 `acknowledgeSessionSummary`** (SESSION_START; `notPermitted` example present, `api/sessions.ts:22, 441, 569-575`); operation 70 is `acknowledgeAlert` (W66's CONTRACT-GAP-W66-2). The tests use operation 37's own example | — | Correct the brief template for later rows |
| F-5 | Info | The hub detail of an ID the replica does not hold says "This session is not on this device." In LIVE the history is the Core's, so "not in this Core's history" (the Summary's wording) would be more precise. Not false: the replica on the device does not hold it | `features/sessions/i18n.ts:71` | W83 / copy pass: optional LIVE string |
| F-6 | Info | On the phone the monitor showed a **"Resynced"** banner right after the hand-off to the monitor in sitting 2 (`72_phone_monitor_live.png`), although no outage was visible to the operator; probably the banner's 3 s "link back" after the first heartbeat of the new operator socket at sign-in | `features/session-live/connection-banner.tsx` (W68's) | Note for W68 |
| F-7 | Info | A stylus "handwriting" toolbar of the emulator's IME overlays the left edge of Start Session's form after text entry (`72_phone_step1_filled_live.png`); it did not block the taps | device | Device-script note |

## 11. Deviations

| # | Deviation | Why / effect |
|---|---|---|
| DV-1 | **Two device sittings** (2 min 51 s + 4 min 20 s = 7 min 11 s, under the 10 minutes; the brief asks for ONE sitting) | The phone's adb transport went offline in sitting 1 (00:59:43); its closing SIMULATED launch then failed and the preference stayed `LIVE` for 1 min until sitting 2 (01:02:45) ended with `SIMULATED`. Sitting 1 changed nothing but reads and one sign-in |
| DV-2 | Sitting 2's closing step re-adds the session's own Metro reverse rule (`tcp:8081 → tcp:8087`) if it is missing, and the driver no longer ends on a failed screencap | Both are the lesson of sitting 1; the rule is the one `device-session.sh` set and removes at its end (`reverse --list` empty after) |
| DV-3 | Done and View in Evidence have no icon, so their spinner sits before the label (the label moves by the spinner's width while pending), as W67's "Run checks again" (W67 DV-3) | LB-1's "nothing moves" holds for the header arrow (the spinner replaces the arrow) |
| DV-4 | The Summary shows a link notice in LIVE (not named in [CS:§3.5]'s mobile column) | The same kind of addition as W67's DN-4 (accepted as an erratum, D157): it explains why the acknowledgement cannot finish while the link is down. Nothing shows outside LIVE |
| DV-5 | Report file name `72_mobile_finalization_summary_sessions.md` (the brief) instead of `72_mobile_finalizing_summary_sessions.md` (the plan's artifact table) | The brief is the later instruction |
| DV-6 | My progress file's 00:45 line was written at about 00:36 (wrong clock reading); a later line says so | Cosmetic |

## 12. Decisions for the controller

| # | Decision | Recommendation |
|---|---|---|
| DN-1 | The presenter runs first **in LIVE only**; Simulated keeps the step-80 toast (W67's DN-1, D157) | Ratify |
| DN-2 | A refused or failed acknowledgement keeps the operator on the Summary (S2-4: navigation only in `ok`), also while the link is down; an alternative would be "Back leaves without acknowledging when the link is down" (the boot router reopens a pending summary at the next sign-in, D157) | Ratify the spec's rule; the link notice says why |
| DN-3 | One acknowledgement at a time across Done, View in Evidence, Back and the header arrow; each control shows its own pending state | Ratify |
| DN-4 | DV-4: the Summary's LIVE link notice (only while the summary waits) | Ratify as an erratum, like D157 DN-4 |
| DN-5 | **F-1**: grant the two-part change in `features/sessions/sessions-screen.tsx` (no stamp and a link notice while `useCoreLinkNotice().offline`) to a small slot, or accept the stamp | Grant (it is the only text in the three screens that states something untrue in LIVE) |
| DN-6 | **F-2**: route the stale-session resync to the runtime owner with the exact change in §10 | Grant before W82/W94, which test reconnects |
| DN-7 | The signature keeps "SIMULATED" in LIVE (the contract calls it simulated; D158 DC-4) | Accept |
| DN-8 | DV-1: two sittings caused by the adb transport drop | Accept |
| DN-9 | F-4: the brief's operation number | Note for the brief template |

## 13. State left on the device and its lane

| Where | State |
|---|---|
| `dems_lane_1` | Not reset; `paired_devices 1` (DEV-0001) and `device_credentials 1` unchanged. **One new session SES-20261006-0027, SEALED** (case LP/2026/1006-0011, subject "W72 Device Check", stopped with the reason "W72 device check end"), its evidence **EV-20261006-0015** (`evidence_items` 14 → 15, `evidence_tracks` 56 → 60, `evidence_custody` 32 → 35), and **its summary acknowledged** through the app's Done (operation 37, 204). `audit_log` 178 → 181 (sitting 1) → 197 (sitting 2). No session left running; no pending summary on lane 1 |
| The phone (`dems2_phone`) | App not running; stored Core-link preference `SIMULATED` (read back); still paired with lane 1; no session token anywhere (memory only); the biometric offer declined in memory, nothing enrolled; keyguard, PIN and fingerprint as before (status identical); no reverse rule; this row's dump file `/sdcard/w72.xml` removed |
| Host | Backend on 4421 stopped twice (`shutdown complete`), Metro on 8087 stopped, `.locks/core-server.lane1.pid` empty, PostgreSQL on 4432 as found |

## 14. Error handling and logging

| Layer | What |
|---|---|
| Persistent log | Every failed acknowledgement writes the runtime log (`reportRuntimeIssue` → `dems.mobile.log.v1`, privacy-filtered) with source `features.sessionSummary.acknowledge` and `{ sessionId }`: `warn` for a refusal the presenter showed (LIVE), `error` otherwise; navigation failures keep step 80's `features.sessionSummary.navigate.*` records. The Live source reports every rejection itself as well (CL-24) |
| User feedback | LIVE: the presenter's toast (denied with the role, offline, limit, failed); Simulated: the step-80 toast; the link notice while the summary waits and the link is down |
| Degradation | The control returns to idle in every path, the Summary stays usable, a second press sends again; the region error boundaries of step 80 are unchanged |

## 15. Rollback (R-CO; not executed)

The three folders equalled `acaff20` before the first edit (`git diff --stat acaff20` empty at 00:31); pre-images of all 36
files with SHA-256 in `.cache/rollback/W72/` (`pre.sha256`).

1. `git checkout acaff20 -- apps/mobile/src/features/session-summary` (restores `use-summary.ts`, `session-summary-screen.tsx`, `i18n.ts`).
2. Remove this row's new files: `apps/mobile/src/features/session-summary/testing/live-summary-bed.tsx`,
   `…/session-summary/live-summary-sites.test.tsx`, `…/session-summary/summary-live-static.test.ts`,
   `apps/mobile/src/features/session-finalizing/live-finalizing.test.tsx`, `apps/mobile/src/features/sessions/live-sessions.test.tsx`.
3. The ledger drops by 4 suites / 39 tests. The lane's new session and acknowledgement are data; they are removed only by a
   `db:reset` of lane 1, which would also remove the pairing (not recommended).

## 16. Assets (`implementation/assets/`)

| File | What |
|---|---|
| `72_phone_login_live.png`, `72_phone_home_offer_live.png`, `72_phone_hub_live_before.png`, `72_phone_step1_filled_live.png`, `72_phone_gate_live.png`, `72_phone_ready_live.png`, `72_phone_monitor_live.png`, `72_phone_end_dialog_live.png`, `72_phone_finalizing_live_1.png` … `_5.png`, `72_phone_summary_pending_live.png`, `72_phone_home_after_done_live.png`, `72_phone_hub_live_after.png`, `72_phone_summary_acknowledged_live.png`, `72_phone_after_simulated.png` | Sitting 2, in order (§8) |
| `72_phone_sitting1_unable_to_load.png` | Sitting 1's failed SIMULATED launch after the adb drop |
| `72_device_sitting1_run.log`, `72_device_sitting2_run.log`, `72_device_sitting1_driver_steps.log`, `72_device_sitting2_driver_steps.log`, `72_lock_status.txt` | Run logs, every driver command with its result, the lock status before and after |
| `72_run_w72.sh.txt`, `72_run_w72b.sh.txt`, `72_device_w72.sh.txt`, `72_drive_q.mts.txt` | The device scripts |
| `72_mutate.py.txt`, `72_mutating_transformer.cjs.txt`, `72_jest_mut_config.cjs.txt`, `72_mutations.log` | The mutation check |
| `72_f2_reproduction.txt` | The debug line of F-2 (replica history and path after the reconnect) |
| `72_final_gate.log` | §6 (CLG (a), (c), the whole suite, typecheck, lint) |

---

## Follow-up: the hub's stamp and link notice (decision D169)

**Time**: 2026-10-06 01:22–01:32 WIB. **Status of the follow-up**: complete. Grant: D169 DN-5 (finding F-1) — a
production change in `apps/mobile/src/features/sessions/sessions-screen.tsx` for exactly the stamp and the notice.
Optional F-3 (Finalization) **left to W100**: it would need new copy keys in `session-finalizing/i18n.ts` and a new
mount point beside the pipeline card, i.e. more than "the same one call + `Alert` and nothing else". Pre-images (with
SHA-256) in `.cache/rollback/W72b/` (`sessions-screen.tsx`, `i18n.ts`, `live-sessions.test.tsx`,
`summary-live-static.test.ts`). No device check (as granted).

### F1.1 What changed (before / after)

`apps/mobile/src/features/sessions/sessions-screen.tsx`

| Line (after) | Before | After |
|---|---|---|
| `:28-33` | — | Header paragraph: in LIVE, while the Core link is down a refresh records no "Updated" time and a notice above the rows says the list is what this device last received; outside LIVE `offline` is false |
| `:35` | `import { Button, SearchField, SkeletonGroup, TagGroup } from 'heroui-native';` | `import { Alert, Button, SearchField, SkeletonGroup, TagGroup } from 'heroui-native';` |
| `:47` | `import { useRuntimeStatus } from '@/runtime';` | `import { useCoreLinkNotice, useRuntimeStatus } from '@/runtime';` |
| `:132` | `function useHubRefresh(): HubRefresh {` | `function useHubRefresh(offline: boolean): HubRefresh {` (doc comment `:128-131`) |
| `:142` | `    setUpdatedAt(from + REFRESH_MS);` | `    if (!offline) setUpdatedAt(from + REFRESH_MS);` — **condition 1**: a refresh that ends while the link is down records no time (the stamp from before the outage stays, which is still true) |
| `:169-170` | `  const { refreshing, refresh, seq, updatedAt } = useHubRefresh();` | `  const { offline } = useCoreLinkNotice();` / `  const { refreshing, refresh, seq, updatedAt } = useHubRefresh(offline);` |
| `:220-230` | — | **Condition 2**: `{offline ? (<View style={styles.linkDown}><Alert status="warning" testID="sessions-link-down">…</Alert></View>) : null}` between the "Sessions" header and the rows, in every layout class |
| `:415` | — | `linkDown: { paddingHorizontal: spacing[3], paddingBottom: spacing[2] },` |

`apps/mobile/src/features/sessions/i18n.ts:66-71` (new, LIVE only): `live.linkDownTitle` "Core server unreachable",
`live.linkDownBody` "This list is what this device last received from the Core server. It updates by itself once the
connection is back." No simulation wording.

Tests: `sessions/live-sessions.test.tsx` — the layout tests also assert no notice while the link is up (`:93`); the outage
test is flipped from "stamps" to "**does not stamp**": a refresh while online stamps T1, then with the link down a refresh
leaves exactly T1 and not the press time (`:188`); a new test for the notice — shown at the first OFFLINE, kept through
the reconnect attempts, gone when the link is back, then a refresh stamps again (`:230`); a new Simulated test (the
step-82 harness): no notice, the refresh stamps as before (`:259`). `session-summary/summary-live-static.test.ts`:
`useCoreLinkNotice()` is now expected in `session-summary-screen.tsx` and `sessions/sessions-screen.tsx`. Ledger: the
row's new tests go from 39 to **41** (live-sessions 9 → 11).

### F1.2 Verification

```
$ npm run test -w @dems/mobile -- --maxWorkers=2 src/features/sessions src/features/session-summary src/features/session-finalizing   (01:24:46)
PASS src/features/sessions/sessions-screen.test.tsx
PASS src/features/sessions/live-sessions.test.tsx (5.298 s)
PASS src/features/session-summary/session-summary-screen.test.tsx
PASS src/features/session-summary/live-summary-sites.test.tsx
PASS src/features/session-finalizing/live-finalizing.test.tsx
PASS src/features/session-finalizing/session-finalizing-screen.test.tsx
PASS src/features/session-summary/summary-live-static.test.ts
PASS src/features/session-summary/summary.model.test.ts
PASS src/features/session-finalizing/finalizing.model.test.ts
PASS src/features/sessions/sessions-model.test.ts
Test Suites: 10 passed, 10 total
Tests:       93 passed, 93 total
```

```
## 2026-10-06 01:27:17 WIB  1:27  2 users, load averages: 4.81 4.55 4.92
## $ npm run test -w @dems/mobile -- --maxWorkers=2
exit=1
FAIL src/runtime/session-route-sync-live.test.tsx
Test Suites: 1 failed, 128 passed, 129 total
Tests:       1 failed, 1583 passed, 1584 total
Time:        120.775 s
## 01:29:18 $ npm run typecheck -w @dems/mobile
exit=0
## 01:29:26 $ npm run lint -w @dems/mobile
exit=0
lint lines with warning/problem: 0
## 01:29:43 $ git diff --stat acaff20 -- apps/mobile/src/features/sessions
 apps/mobile/src/features/sessions/i18n.ts          |  6 ++++
 .../src/features/sessions/sessions-screen.tsx      | 34 ++++++++++++++++++----
 2 files changed, 34 insertions(+), 6 deletions(-)
$ git status --short --untracked-files=all -- apps/mobile/src/features/sessions apps/mobile/src/features/session-finalizing
 M apps/mobile/src/features/sessions/i18n.ts
 M apps/mobile/src/features/sessions/sessions-screen.tsx
?? apps/mobile/src/features/session-finalizing/live-finalizing.test.tsx
?? apps/mobile/src/features/sessions/live-sessions.test.tsx
$ git diff --stat acaff20 -- apps/mobile/src/features/session-finalizing
(end)
$ git diff --stat acaff20 -- <the 10 existing test files>: 0 lines
## KI-07: 13 IDs / 62 markers
```

All 10 suites of the three folders pass in that whole run. **The one red suite is not this row's**:
`src/runtime/session-route-sync-live.test.tsx`, a new file of the **runtime owner's F-2 fix (D169 DN-6)**, written while
the suite ran (file time 01:29:04, the companion `runtime/session-route-sync.tsx` 01:26:12). Re-checked once at 01:30:23:
the file had changed again (01:30:20) and was still red on its own (`Tests: 1 failed, 1 passed, 2 total`) — in flight;
not touched. The whole suite is otherwise 128 / 1,583, above the floor 128 / 1,580.

`git diff --stat acaff20 -- apps/mobile/src/features/sessions` lists `sessions-screen.tsx` **and `i18n.ts`** (DV-7 below);
the rest of the folder's changes are the new test file; `session-finalizing` is still unchanged against `acaff20`.

**Mutation over the two new conditions** (in memory, rule M15; `assets/72b_mutations_followup.log`; the run adds the
existing step-82 hub test so the Simulated half is checked too):

```
# W72 mutation check (follow-up D169 adds H1-H4 and the Simulated hub test), 2026-10-06 01:25:06; 5 test files per run; the tree is not edited
control (no mutation): exit=0 Tests:       50 passed, 50 total (11 s)
X1  detected       9s  S4-5: the refresh stamp on the wall clock instead of the Live clock  | Tests:       5 failed, 45 passed, 50 total
H1  detected       8s  the stamp is recorded while the link is down (the skip dropped)  | Tests:       1 failed, 49 passed, 50 total  | live-sessions.test.tsx
H2  detected       7s  the stamp is never recorded  | Tests:       5 failed, 45 passed, 50 total  | live-sessions.test.tsx, sessions-screen.test.tsx
H3  detected       7s  the link notice never shows  | Tests:       1 failed, 49 passed, 50 total  | live-sessions.test.tsx
H4  detected       9s  the link notice always shows (also online and in Simulated mode)  | Tests:       4 failed, 46 passed, 50 total  | live-sessions.test.tsx
## 5 detected, 0 not detected, 0 not applied, of 5
## the mutated files in the tree, before and after: identical
   b96dfa9447e3a239  src/features/sessions/sessions-screen.tsx
```

### F1.3 Deviations, findings, rollback

| # | Item |
|---|---|
| DV-7 | `sessions/i18n.ts` also changed (6 added lines: the two LIVE keys of the notice). The brief's check expected `sessions-screen.tsx` and tests only; the notice's copy follows the Summary's `live.*` pattern (D169 asked for "the copy of the Summary's `live.linkDownTitle` pattern"), and the Summary's own body text names the acknowledgement, so it could not be reused. Every existing key of the hub is unchanged (`git diff acaff20 -- …/sessions/i18n.ts`: additions only) |
| F-8 (Info) | The worker-exit warning "A worker process has failed to exit gracefully" seen in some runs comes from the step-80 suites `session-summary-screen.test.tsx` and `session-finalizing-screen.test.tsx` (byte-equal to `acaff20`): each alone prints it, while this row's Live suites alone do not (`.cache/w72/leak.log` checks, 01:26). Pre-existing; not changed (baseline test files) |
| F-1 | Closed by this follow-up. F-3 (Finalization's notice) stays open for W100 |
| Rollback | Restore the four files from `.cache/rollback/W72b/` (`pre.sha256` lists their hashes): `apps/mobile/src/features/sessions/sessions-screen.tsx` and `…/sessions/i18n.ts` return to `acaff20` (`git checkout acaff20 -- …` gives the same), `live-sessions.test.tsx` and `summary-live-static.test.ts` to their W72 state |

Assets added: `72b_followup_gate.log`, `72b_mutations_followup.log`; `72_mutate.py.txt` updated with H1-H4.
