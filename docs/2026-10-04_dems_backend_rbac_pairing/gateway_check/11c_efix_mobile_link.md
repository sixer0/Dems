# FX-M1 — mobile pairing hand-off, sign-in routing, the Core link and the debug warnings (E-fix, D201)

| Field | Value |
|---|---|
| Row | FX-M1 of the end-of-round fix pass E-fix (decision D201; rulings R5, R6) |
| Defects | E2E-S-1 (Medium), E2E-S-3 (Low), E2E-S-4 (Low), E2E-T-1 (Medium, R5), F80 (R6) |
| Agent | coder-execution |
| Time | 2026-10-06 11:14–12:05 WIB |
| Status | **complete**: 5 of 5 defects fixed with tests. Typecheck, lint and the whole mobile suite are green. The mutation check detected 27 of 28 mutants; the one it missed is the layout check, which reads the file and so cannot see an in-memory change (§7) |
| Narrative tier | 2: what was found, why it matters, how it was checked, and where it comes from |
| Rollback | `.cache/rollback/FX-M1/`: 14 files copied before their first edit, with `SHA256SUMS.txt` |
| Assets | `assets/11c_fx_m1_mutations.log`, `assets/11c_fx_m1_mutations_final_control.log`, `assets/11c_fx_m1_mutate.py.txt`, `assets/11c_fx_m1_mutating_transformer.cjs.txt`, `assets/11c_fx_m1_jest_mut_config.cjs.txt`, `assets/11c_fx_m1_metro_warnings.txt`, `assets/11c_fx_m1_suite_summary.txt`, `assets/11c_fx_m1_typecheck_lint.log` |

Paths: `apps/mobile/src/…` is written `src/…`. Line numbers marked "was" point to the copy taken before the edit, `.cache/rollback/FX-M1/apps/mobile/src/…`. The other line numbers point to the tree as it is now.

---

## 1. Result at a glance

| Defect | Root cause, in short | Change | Proof | Mutants |
|---|---|---|---|---|
| **E2E-S-1**: after a redeem the app landed on Stack Check | The Pair screen's hand-off went "back" to whatever lay underneath. Deep links had pushed Stack Check there | The signed-out hand-off resets the stack to the boot router, which opens Login | Route test reproducing the phone's journey, which ends on `/login` with nothing to go back to | 4 / 4 |
| **E2E-S-1**: after Sign Out the app landed on the paired Pair view | When the guard drops `(app)`, React Navigation keeps every public route that is still allowed. Nothing sent the app on to `/` | New `SignedOutLanding`, mounted beside the root navigator, resets to the boot router | Route tests. A control test shows the bare navigator stays on `/pair` | 3 / 4 (the 4th is §7) |
| **E2E-S-3**: "Core server unreachable" for about 1 s after a revoke | A 4403 puts the socket client into ENDED (link and heartbeat OFFLINE) until the app has deleted its credential and reopened the socket. The notice shows OFFLINE at once | While the Core has ended the run on purpose, OFFLINE reads as CONNECTING. This covers the Pair screen, the Core link, the banner and every notice | Pair-screen test with the deletion held; runtime test with banner and notice; control test showing a lost socket still raises the notice at once | 5 / 5 |
| **E2E-S-4**: a warm guarded link while unpaired stayed put | `+native-intent` turned it into `/login`. While the gate holds, `(auth)` is not in the root navigator, and Expo Router drops a warm link to a route it does not have | While the gate holds, `+native-intent` sends such a link to `/pair`. The gate is read from a snapshot the Live source writes | Route tests with the real system-URL listener; a control test shows the old drop | 5 / 5 |
| **E2E-T-1 / R5**: a red CORE_OFFLINE error while online | The client's 8 s budget is a wall-clock timer, and a starved JS thread let it expire. The Live source reports "no answer" as `error`, and the app's log sent that to `console.error` | Probes and the keep-alive are asked once more on a time-out. An unanswered call is judged by the link (`coreLinkViewOf`) with a consecutive count, and is never an `error` | Real Live source with Jest fake timers standing in for the starved thread | 8 / 8 |
| **F80 / R6**: the warnings toast | The app's log mirrored every `warn` record (operational states) to `console.warn`, which LogBox turns into the toast | `warn` records go to `console.info`; only `error` records (app faults) go to `console.error` | Console-policy tests; the E2E-T-1 tests assert no `console.warn` and no `console.error` | 2 / 2 |

## 2. E2E-S-1: Login after a redeem and after a sign-out, whatever was visited before

### 2.1 Root cause (two causes, both confirmed by test)

**(a) Redeem, twice** (step 3 at 09:49:16, step 6 at 10:12:15; captures `test/assets/e2e/s_pairing/03_phone_paired_login.png` and `06_phone_paired_login.png`):

- The hand-off after a success calls `leave()` (was `features/pairing/use-pairing-flow.ts:272`). `leave()` called `router.back()` whenever `router.canGoBack()` (was `use-pairing-flow.ts:182-187`, rule was `pairing-model.ts:183-185`).
- In step 1 of E2E-S the phone had received the deep links `demsdemo:///stack-check`, `/home`, `/pair`, then `/home`, `/stack-check`, `/login`, `/sessions`, `/pair` (`01_step1_unpaired.log` steps 1b to 1d; `01e_guarded_link_repro.log`). So Stack Check sat under the Pair screen.
- "Back" therefore landed on Stack Check. After the revoke the same stack was still there, so the re-pair did the same.
- The route test `pairing-handoff-routes.test.tsx` "the phone of E2E-S-1" replays this sequence (launch `/login?core=LIVE&motion=off`, push Stack Check, push Pair, pair). Without the fix it ends on `/stack-check`: mutant S1-a, §7.

**Second hypothesis rejected (`/` keeping `motion=off`):**

- The cold launch `demsdemo:///login?core=LIVE&motion=off` landed on Pair (`01_unpaired_pair.png`, `01_step1_unpaired.log` 1a). Had `/` kept the query, the boot route would have drawn Stack Check (`app/index.tsx:15`), and it did not.
- The new reset replaces with `/` and no query. The test "the launch link keeps its meaning" shows `/?motion=off` still opens the proof screen, and after the reset the path is `/login` with no search parameters.

**(b) Sign-out** (10:16:22, `07c_phone_sign_out.log`; `07_phone_signed_out_login.png` shows the paired Pair view):

- `RootNavigator` puts `(app)` behind `Stack.Protected guard={isAuthenticated && !blocked}` (`navigation/root-navigator.tsx:74`). Its comment counts on "Expo Router falls back to the anchor `/`" (`root-navigator.tsx:23-26`).
- React Navigation keeps every route that is still allowed. The Pair screen pushed earlier became the top screen, and nothing sent the app to `/`.
- The navigator handles only the mirror case, after a sign-in (`root-navigator.tsx:42-55`).
- The control test "the cause, shown on the navigator alone" renders the shell's own harness without the new landing. Sign-out ends on `/pair`.

### 2.2 Change

| File | Change |
|---|---|
| `src/features/pairing/pairing-model.ts:180-201` | `leaveTargetFor(canGoBack, reason, signedIn)`. The hand-off when signed out always goes to `'boot'`. Cancel, and the hand-off when signed in (Settings → Security → Pair), still follow the stack |
| `src/features/pairing/use-pairing-flow.ts:192-203, 288` | `leave(reason)`. The automatic hand-off passes `'handoff'`. A `'boot'` hand-off calls `resetToBootRouter(router)`. A Cancel with nothing underneath still replaces the screen with `/` |
| `src/features/pairing/pairing-code-panel.tsx:348-349` | The "Continue to sign-in" / "Done" button calls `flow.leave('handoff')`. Before, it handed the press event to `leave()` as an argument |
| `src/runtime/signed-out-landing.tsx` (new) | `signedOutLandingFor(top, gateHeld)` (table in the header), `resetToBootRouter(router)` (if possible `dismissAll()`, then `replace('/')`, both through Expo Router's routing queue), and the `SignedOutLanding` component. It mirrors the navigator's sign-in effect: wait while `(app)` is still on top; do nothing on `/`, `(auth)`, or `/pair` while the gate holds; otherwise reset |
| `src/app/_layout.tsx:25, 38-43, 66-71` | Mounts `<SignedOutLanding />` beside `<RootNavigator />` inside `BootGate` |
| `src/runtime/index.ts` | Exports and module-table rows for the four new runtime modules |

### 2.3 Tests

`src/features/pairing/pairing-handoff-routes.test.tsx` is new: 20 tests on the real route tree, the real Pair screen and the real `+native-intent`, with the root layout's composition.

- E2E-S-1 redeem: the phone's journey; the re-pair after a revocation; "Continue to sign-in"; the launch query.
- E2E-S-1 sign-out: the control test; Pair underneath; Stack Check underneath; nothing underneath; a revocation over Stack Check (lands on `/pair`); a sign-in after it (lands on `/home`).
- A static check that `_layout.tsx` mounts the landing, with two negative controls.

`src/runtime/signed-out-landing.test.ts` is new: the table and the reset order.

`pairing-model.test.ts` gains the eight-case `leaveTargetFor` table. Existing expectations changed in `pairing-screen.test.tsx` (the signed-out hand-off now expects `dismissAll` then `replace('/')`, never `back`; a new case: signed in, with Settings underneath, goes back) and in `pairing-live.test.tsx` (the case "with a screen underneath … goes back to it" now expects a reset, never back).

```
$ npx jest src/features/pairing/pairing-handoff-routes.test.tsx        (11:40)
  ✓ the phone of E2E-S-1: launched at /login?core=LIVE&motion=off, Stack Check and Pair pushed, then paired → Login, nothing to go back to
  ✓ the re-pair after a revocation (step 6): the same hand-off reaches Login
  ✓ "Continue to sign-in" is the same hand-off: Login, never back to Stack Check
  ✓ the cause, shown on the navigator alone: without SignedOutLanding the sign-out uncovers the paired Pair view
  ✓ with the root layout as the app has it: the sign-out lands on Login and nothing is left underneath
  … Tests: 19 passed, 19 total   (20 after the negative control was added; 11:56: 33 passed with probe-failure)
```

## 3. E2E-S-3: a revoke is not drawn as an outage

### 3.1 Root cause

- **The socket client.** On close 4403 or 4401 it goes to ENDED: `phase = 'ENDED'`, heartbeat OFFLINE, `publishLink()` (`packages/shared/src/realtime/live-socket-client.ts:819-837`). ENDED computes to OFFLINE (`:651-653`).
- **The gap.** The Live source reopens the socket only after the app's `deviceUnpaired` port (the secure-store deletion) has returned (`packages/shared/src/live/source/live-sim.ts:1053-1060`, `afterEnd`).
- **The screen.** The Pair screen read the raw link (`useLiveLink()`, was `use-pairing-flow.ts:134`). The one rule shows the notice at the first OFFLINE (`runtime/link-notice.ts:127-137`, hold 0 ms, DN-2).
- **Evidence.**
  - Server log: `socket closed code=4403 closedBy=server` at 10:08:24.591, the anonymous socket opened at 10:08:27.668 (`s_pairing/09_server_log_excerpt.txt` lines 25 and 30).
  - Frames: "Core server unreachable" and Link "Unreachable" at device 10:08:26.425 to 26.816, "Connected" at 27.730 (`05_phone_frames_contact_sheet.png`).
- **Why the rule needs no change.** The socket status tells the two OFFLINEs apart: `socketStatus().end` is set by close 4401 or 4403 and cleared by the next `start()` or `reconnect()` (`live-socket-client.ts:362-363`, `connect()` sets `end = null`).

### 3.2 Change

| File | Change |
|---|---|
| `src/runtime/ended-link.ts` (new) | `isRunEndedByCore(live)`, `liveLinkWhileEnded`, `heartbeatWhileEnded`: OFFLINE becomes CONNECTING only while the run was ended on purpose. `useNoticeLiveLink()` gives the Pair screen the Live link mapped this way |
| `src/runtime/sim-runtime-provider.tsx:413-422` | `LiveBridge` maps the heartbeat the same way (`useSyncExternalStore` on the socket's subscribe, reading `socketStatus().end`). The Core link, the banner, the Login notice and every page notice therefore read "settling" in that window |
| `src/features/pairing/use-pairing-flow.ts:140-143` | The Pair screen reads `useNoticeLiveLink()` instead of `useLiveLink()` |

M0's rule (`link-notice.ts`) is not touched. A lost socket still shows the notice at once. When the reopened socket cannot connect, `end` is already cleared, so the next OFFLINE shows the notice.

### 3.3 Tests

- **`src/features/pairing/pairing-live.test.tsx`, new case** "row FX-M1, E2E-S-3": the real Pair screen on the real Live source. Every secure-store delete is held, as the device's Keystore held it for about 3 s.
  - After `device.revoked` and 4403: link OFFLINE, `socketStatus().end` set, "Pairing revoked" shown, no "unreachable", Link reads "Connecting…".
  - After the release: Connected, and the store is empty.
- **`src/runtime/ended-link.test.tsx`, new**: the pure mapping, plus the real `AppProviders`.
  - Inside the window the probe reads `link=OFFLINE/CONNECTING banner=hidden offline=false view=settling pair=CONNECTING pairing=UNPAIRED/revoked`.
  - Control: a lost socket (close 1001) reads `link=OFFLINE/OFFLINE banner=offline offline=true view=down`.
  - The reopened socket fails: the notice shows.

```
$ npx jest src/runtime/ended-link.test.tsx   (11:45)  Tests: 5 passed, 5 total
$ npx jest src/features/pairing/pairing-live.test.tsx src/features/pairing/pairing-screen.test.tsx src/features/pairing/pairing-model.test.ts src/features/pairing/live-gap-sites.test.tsx
  PASS ×4   Tests: 51 passed, 51 total
```

## 4. E2E-S-4: a guarded deep link while unpaired opens Pair

### 4.1 Root cause

- **The intent.** `+native-intent` handed every link to `recordIncomingLink` (was `app/+native-intent.tsx:13`). For a guarded path while signed out, that keeps the pending href and returns `/login` (`navigation/pending-href.ts:48-50`).
- **The gate.** While it holds, `(auth)` is protected out (`root-navigator.tsx:71`: `guard={!isAuthenticated && !blocked}`).
- **Expo Router.** For a warm link it ignores any state whose route is not in the root navigator's `routeNames`: `node_modules/expo-router/build/fork/useLinking.native.js:159`, `if (state.routes.some((r) => !rootState?.routeNames.includes(r.name))) return;`. So the link was dropped without a word.
- **Why launch links worked.** A cold launch builds the initial state differently and falls back to `/`, which opens `/pair` (E2E-S step 1a).
- **Evidence:** `s_pairing/01e_guarded_link_repro.log` and `01e_from_stack_login.png` / `01e_from_stack_sessions.png` / `01e_from_pair_home.png`. The comment at `root-navigator.tsx:30` ("such a link falls through `/` to `/pair`") is true only at a cold launch.

### 4.2 Change

| File | Change |
|---|---|
| `src/runtime/pairing-gate-snapshot.ts` (new) | The gate outside React: `notePairingGate(source, pairing)`, `releasePairingGate(source)` (releases only its own entry), `isPairingGateHeld()` |
| `src/runtime/sim-adapters.ts:354-358, 661, 674` | `createMobileLive` writes the gate at `start()` (CHECKING counts as held), at every change while running, and releases it at `stop()`. SIMULATED and HEARTBEAT never write it (AC-C-74) |
| `src/app/+native-intent.tsx` | After `recordIncomingLink`, while the gate holds, `/login`, `/dev-gallery` or any `(app)` path opens `/pair`. The pending href is still recorded and opens after pairing and sign-in (MP-12). Public links and foreign URLs pass unchanged. At a cold launch the gate reads "not held", so the behaviour is as before |

### 4.3 Tests

- **`pairing-handoff-routes.test.tsx`, E2E-S-4 block, 8 tests.** Warm links go through Expo Router's real system-URL listener: the test captures the `expo-linking` listener and delivers the URL.
  - The control (gate not written: `/home` becomes `/login` and the app stays on `/stack-check`).
  - Five links from Stack Check that now open `/pair`.
  - The pending href that survives the gate (`/audit` opens after pairing and sign-in).
  - Public and foreign links unchanged, and everything unchanged after release.
- **`src/runtime/pairing-gate-snapshot.test.ts`, new, 4 tests:** pure ownership, and the real Live source (held from `start()`, released by a redeem answered 201, cleared by `stop()`, a new source not cleared by an old one).

## 5. E2E-T-1 / R5: one slow probe is never the offline error

### 5.1 Root cause

**What the tablet logged at 09:52** (`t_tablet/11_logbox_touch_core_offline_logcat.txt`):

- 09:52:29.700 `POST /api/v1/auth/touch - -` (no answer);
- 09:52:29.709 `live.client` warn "No answer within 8000 ms…";
- 09:52:29.729 `live.action.touch` **error** "The Core server is unreachable (CORE_OFFLINE).", with `link: 'ONLINE'` and `errorCode: 'TIMEOUT'`.

The Core logged that touch answered at 09:52:25.468 (`t_tablet/core_log_lane2_window.txt:21`; 28 ms per D200).

**Chain:**

1. The typed client's budget is a wall-clock `setTimeout` (`packages/shared/src/client/core-client.ts:656`). A JS thread starved past 8 s turns an answered request into `TIMEOUT` (`:718`).
2. The keep-alive rejects through `reportRejection('touch', …)` (`live-sim.ts:1964`), which reports anything that is not a refusal as `error` (`live-sim.ts:571`).
3. The app's `logLiveReport` passed the level through (was `runtime/sim-adapters.ts:272-276`).
4. The log mirrored `error` to `console.error` (was `runtime/log.ts:167`). LogBox showed that as the red bar in `11_logbox_touch_core_offline_error.png`.

The in-app notices follow the link and did not change (the link stayed ONLINE). The "offline error" the operator saw is the LogBox bar.

**The same path on the phone:** `getServiceHealth` timed out at 10:13:18 under load (`s_pairing/05_device_js_stream.log`; Metro `assets/11c_fx_m1_metro_warnings.txt` line 251).

### 5.2 Change

| File | Change |
|---|---|
| `src/runtime/probe-failure.ts` (new) | Rule 1, `isRecheckable`: only the five probe operations (`getServiceHealth`, `touchSession`, `getAuthSession`, `getSignInStatus`, `getDeviceRegistration`) on `TIMEOUT`; a command is never sent twice. Rule 2, `judgeLiveRejection`: only a `live.action.*` rejection with `LiveTransportError` is judged. Through `coreLinkViewOf(context.link)`: link `down` → `warn` with the original words (the notice already shows); `up` or `settling` and a probe → `info` until `PROBE_FAILURES_BEFORE_WARN` (2) failures in a row, then `warn`, with "…not an outage (R5)"; a command → `warn`. Never `error` |
| `src/runtime/sim-adapters.ts:418-454` | The app's client re-checks once: a probe whose first attempt timed out is asked again, and the second answer is handed on. It keeps the per-operation count of failures in a row and writes `live.client.recheck` (`info` when answered, `warn` when not) |
| `src/runtime/sim-adapters.ts:380-402` | The client's report of a probe's first `TIMEOUT` is `info` (`probe: true`); the re-check decides |
| `src/runtime/sim-adapters.ts:275-286, 562` | `logLiveReport(report, judged)` writes the judgement. The Live source's `onError` judges every report |

**How the timeout now measures network time:** the re-check runs after the starved thread has caught up, so its answer is the network's. A Core that is really down fails the re-check too, and the socket link (heartbeat, `STALE` after 2.5 s) has said so already.

### 5.3 Tests

`src/runtime/probe-failure.test.ts` is new: 13 tests. Eight are pure, including the exact E2E-T-1 record (→ `info`, "not an outage", `linkView: 'up'`). Five use the real Live source, signed in, operator socket ONLINE; Jest fake timers stand in for the starved thread:

- The first touch hangs and the re-check is answered → two touch requests, no `live.action.touch` record, no `error` record, no `console.error` or `console.warn`, link still ONLINE.
- Both attempts hang → one `info` record "…not an outage (R5)" with `failuresInARow: 1`, and `live.client.recheck` `warn`.
- The service health is re-checked and its answer handed on.
- A command (`archiveEvidence`) that times out is sent once and the `TIMEOUT` is handed on.
- An action refused while the link is not up is judged `warn`, not `error` (the `onError` wiring).

```
$ npx jest src/runtime/probe-failure.test.ts   (11:43)
  ✓ is re-checked once and answered: no rejection, no error record, nothing on console.error or console.warn
  ✓ no answer to the attempt nor to the re-check, link still ONLINE: the rejection is info ("not an outage"), never an error
  … Tests: 13 passed, 13 total
```

## 6. F80 / R6: the warnings toast, traced source by source

The source is the Metro log of the whole round, which carries every device's console (`.cache/manual/metro.log`; extract in `assets/11c_fx_m1_metro_warnings.txt`), together with the device JS logs named in the brief.

| # | Source (what printed) | Fired in the round | Where it comes from | Status |
|---|---|---|---|---|
| 1 | `[runtime]` warn `live.client` "No answer within 8000 ms…" | 4 (touchSession ×2, getServiceHealth ×2) | `sim-adapters.ts` `reportClientFailure` → `log.ts` mirror (was `log.ts:168` `console.warn`) | **Fixed.** A probe's first time-out is re-checked and recorded as `info`. No `warn` record reaches `console.warn` any more (`log.ts:175-178`) |
| 2 | `[runtime]` error `live.action.touch` "The Core server is unreachable (CORE_OFFLINE)." (red bar) | 2 | `live-sim.ts:571` `error` level → `logLiveReport` → was `log.ts:167` | **Fixed** (§5): judged by the link, never `error` |
| 3 | `[runtime]` warn `live.socket` SYNC_TIMEOUT (waiting for `hello`) | 1 (phone2, 10:12:11) | The socket client's report → Live source → `logLiveReport` | **Routed**: an operational state; it stays a `warn` in the app log and is mirrored as `console.info` |
| 4 | `[runtime]` warn `features.sessionNew.create` "createSession refused: NOT_PERMITTED" | 2 (TECHNICIAN's refused start) | FX-M2's feature, through `reportRuntimeIssue('warn', …)` | **Routed** by the log writer. No edit in FX-M2's paths was needed |
| 5 | `[Reanimated] Reduced motion setting is overwritten with mode 'never'/'always'` | 8 (every launch or reload with `motion=`) | `ReducedMotionConfig` at `src/motion/motion-policy-provider.tsx:117` (outside this row's paths) | **No change needed.** Already kept out of LogBox by `LogBox.ignoreLogs` at `motion-policy-provider.tsx:37-40`; the override is intended (VM-05). Metro still prints it |
| 6 | HeroUI "Styling Principles" | Every bundle load | `heroui-native` `use-dev-info.ts:25` | **Not a warning** (`console.info`, never LogBox). Optional: `config.devInfo.stylingPrinciples = false` in `heroUIConfig` (`src/providers/…`, outside this row's paths) |
| 7 | `ReferenceError: Property 'OperatorRole' doesn't exist` ×3 | 11:26–11:34 WIB, during Fast Refresh | Not from FX-M1: no FX-M1 file names `OperatorRole`, and typecheck is clean. It matches a parallel row editing role-gate files at the time (`features/rbac/`, FX-M2) | **For the controller**: it stopped after 11:34; the three devices reloaded "Live source ready" |
| 8 | Could fire, not seen in the round: `[navigation]`, `[motion]` default console sinks | 0 | `navigation/log.ts:26-27`, `motion/log.ts:27-28` (outside this row's paths): only before `installRuntimeLogSinks`; afterwards they go through the runtime log, so no `console.warn` either | Listed |
| 9 | Could fire, not in LIVE: `packages/shared/src/realtime/heartbeat-client.ts:85` `console.warn` (dropped mock-core message) | 0 | HEARTBEAT mode only | Listed |
| 10 | Kept on purpose: `runtime/log.ts:158` `console.warn` when the log cannot write AsyncStorage | 0 | A failing storage is a fault, not an operational state | Kept |

**After the change, on the running stack.** Metro fast-refreshed the edits onto the three devices. After the 11:34 reload the Metro log holds 15 "Live source ready" lines (checked at 11:58) and no `[runtime]` WARN or ERROR line. The only WARN lines are the Reanimated one (#5), which LogBox already ignores. This shows the build loads and runs on the devices. It does not replace the device re-test round, which this row did not drive.

**Tests:** `src/runtime/log-console.test.ts` is new, 4 tests: the five operational records of the round never reach `console.warn`; outside Jest a `warn` record is mirrored as `console.info` (fresh module copy without the Jest marker); an `error` record reaches `console.error`; the mirror switch still silences everything.

## 7. Mutation check (in memory; the tree was not edited)

**Method** (09a's method): a Jest transformer outside the tree (`.cache/fx-m1/mut/`, copied to `assets/11c_fx_m1_*`) applies one mutant's edits in memory to one production file and hands the result to the app's own babel-jest. Detected = Jest exits non-zero. Each `from` text was checked to occur exactly once before the run. The SHA-256 of the 11 mutated files was the same before and after.

```
# FX-M1 mutation check, 2026-10-06 11:49:58; the tree is not edited
control (no mutation): exit=0 Tests:       93 passed, 93 total (31 s)
…
## 27 detected, 1 not detected, 0 not applied
## the mutated files in the tree, before and after: identical
# finished 11:54:46
# re-run with the final test files, 11:59:37: control exit=0 94 passed; S1-h NOT DETECTED (as expected)
```

| Fix | Mutants (what each puts back) | Detected |
|---|---|--:|
| E2E-S-1 hand-off | S1-a back to the stack; S1-b replace without the reset; S1-c "Continue" hands the press event on; S1-d the automatic hand-off as a Cancel | 4 / 4 |
| E2E-S-1 landing | S1-e sign-out not noticed; S1-f a public top screen accepted; S1-g no pop to the first screen; **S1-h `<SignedOutLanding />` removed from `_layout.tsx`** | 3 / 4 |
| E2E-S-3 | S3-a Live link not mapped; S3-b heartbeat not mapped; S3-c end never seen; S3-d the Pair hook hands the raw link on; S3-e `LiveBridge` ignores the end | 5 / 5 |
| E2E-S-4 | S4-a intent ignores the gate; S4-b `/login` not gated; S4-c change of the gate not written; S4-d `stop()` does not release; S4-e `start()` does not write | 5 / 5 |
| E2E-T-1 / R5 | T1-a no re-check; T1-b reports not judged; T1-c first failure already `warn`; T1-d link down → `info`; T1-e commands re-sent; T1-f first time-out `warn`; T1-g "unreachable" kept while up; T1-h count never grows | 8 / 8 |
| F80 / R6 | F-a `warn` → `console.warn` again; F-b `error` no longer `console.error` | 2 / 2 |

**S1-h, the one not detected.** `_layout.tsx` cannot be loaded in Jest: it imports `global.css`, and Jest has no transform for it. So the layout check reads the file, and an in-memory mutant cannot reach a file read (09a §8 has the same limit). Its strength is shown by two negative controls in the same test: the check fails for the layout text without `<SignedOutLanding />`, and for the landing placed outside `BootGate`. Every behaviour of the landing itself is covered by S1-e, S1-f and S1-g, which were detected.

The full list of failing test names per mutant is in `assets/11c_fx_m1_mutations.log`.

## 8. D191: does this path explain the user's "error messages"?

- **Not the launch D191 describes.** The controller's diagnosis at 09:18–09:20 found nothing listening on 8081 (Metro) or 4420 (Core). The debug app could not load its JavaScript, and the screen was black. That is not this path.
- **Hypothesis (H), not verified on the user's device:** whenever the stack is up, this path does put error-looking bars on the screen.
  - The "Open debugger to view warnings" bar comes from any operational `warn` record. It is visible in nearly every capture of the round (for example `s_pairing/05_phone_frames_contact_sheet.png`, frame 1, before the revoke).
  - The red `[runtime] {…"The Core server is unreachable (CORE_OFFLINE)"…}` bar comes from one starved keep-alive (`t_tablet/11_logbox_touch_core_offline_error.png`).
  - With the Core down and Metro up, the same mirror would print a `live.client` / `live.socket` warning at every reconnect.
  - After FX-M1 none of these reach LogBox; only a fault of the app (`error`) does.

## 9. Suite ledger

| Run | Command (in `apps/mobile`) | Result |
|---|---|---|
| Targeted, pairing / login / runtime / navigation (11:48) | `npx jest --maxWorkers=2 src/runtime src/features/pairing src/features/login src/navigation` | 51 suites / 659 tests, all PASS |
| Typecheck (11:56) | `npm run typecheck` | `tsc --noEmit`, exit 0 (`assets/11c_fx_m1_typecheck_lint.log`) |
| Lint (11:56) | `npm run lint` | `eslint .`, exit 0, no output |
| **Whole mobile suite, once (11:56–11:59)** | `npm run test -- --maxWorkers=2` | **Test Suites: 158 passed, 158 total; Tests: 1829 passed, 1829 total; 161.6 s; exit 0** (`assets/11c_fx_m1_suite_summary.txt`; load 5.78 at the start, 11.19 at the end) |
| Mutation check (11:49–11:54, 11:59) | `python3 .cache/fx-m1/mut/mutate.py` | 27 / 28 detected (§7); tree byte-identical |

- **FX-M1 adds 52 tests:** 6 new files with 49 tests (`pairing-handoff-routes` 20, `probe-failure` 13, `ended-link` 5, `pairing-gate-snapshot` 4, `log-console` 4, `signed-out-landing` 3), and 3 new cases in existing files (`pairing-model`, `pairing-screen`, `pairing-live`).
- **Existing expectations changed** (they encoded the old rule): `pairing-screen.test.tsx` (signed-out hand-off), `pairing-live.test.tsx` (hand-off with a screen underneath), and the router mocks of `pairing-screen`, `pairing-live` and `live-gap-sites`, which gain `canDismiss` and `dismissAll`.
- **The run includes parallel rows.** The suite ran on the shared tree, so FX-M2's work in progress is in it. One earlier `tsc` run (11:36) reported an error in `src/features/rbac/role-gate-r2.test.tsx:173` (FX-M2's file). It was gone at 11:47 and in the final typecheck.

## 10. Files

**Created (11):**

- `src/runtime/ended-link.ts`, `src/runtime/probe-failure.ts`, `src/runtime/pairing-gate-snapshot.ts`, `src/runtime/signed-out-landing.tsx`;
- the tests `src/features/pairing/pairing-handoff-routes.test.tsx`, `src/runtime/ended-link.test.tsx`, `src/runtime/probe-failure.test.ts`, `src/runtime/pairing-gate-snapshot.test.ts`, `src/runtime/log-console.test.ts`, `src/runtime/signed-out-landing.test.ts`;
- this report.

**Modified (14):**

- `src/app/_layout.tsx`, `src/app/+native-intent.tsx`;
- `src/features/pairing/pairing-model.ts`, `use-pairing-flow.ts`, `pairing-code-panel.tsx`;
- `src/runtime/sim-adapters.ts`, `sim-runtime-provider.tsx`, `log.ts`, `index.ts`;
- tests: `src/features/pairing/pairing-model.test.ts`, `pairing-screen.test.tsx`, `pairing-live.test.tsx`, `live-gap-sites.test.tsx` (router mock only).

**Not touched (in this row's paths):** `app/index.tsx`, `app/pair.tsx`, `app/stack-check.tsx`, `app/+not-found.tsx`, `app/(auth)/**`, `features/login/**`, `packages/shared/src/i18n/en/login.ts`.

**Evidence files:** the `assets/11c_fx_m1_*` files listed in the header; progress file `delegation_progress/fx_m1_mobile_link.md`.

## 11. For the controller

| # | Item | Where | Suggestion |
|---|---|---|---|
| C-1 | **E2E-P-2** ("wired to the local mock-core" while Live) is in D201's FX-M1 partition, but it was not in this brief and the text is in FX-M2's path | `src/features/home/home-screen.tsx:159` | Route to FX-M2 or a follow-up |
| C-2 | Two comments of the root navigator now describe the old behaviour: "Expo Router falls back to the anchor `/`" is true only with nothing left underneath, and "such a link falls through `/` to `/pair`" is true only at a cold launch | `src/navigation/root-navigator.tsx:23-30` (no row owns it) | One comment edit by the navigation owner, pointing to `SignedOutLanding` and `+native-intent` |
| C-3 | Observation, not observed as a defect: the secret-store budgets are wall-clock too (`MOBILE_SECRETS_BUDGET_MS` 4 s, `withinBudget`). A thread starved past 4 s during a redeem could declare the credential write late and abandon the registration | `src/runtime/sim-adapters.ts` `withinBudget`, `devicePaired` | W98 or a follow-up: the same "re-check once before declaring" (one extra macrotask before `late`) |
| C-4 | Observation (hypothesis): under starvation the socket client's housekeeping can mark the link STALE before queued messages run, which would flash the notice (M0's hold is 0 ms, DN-2) | `packages/shared/src/realtime/live-socket-client.ts:1074-1079` | Keep under W98 performance; a change belongs to the shared socket client |
| C-5 | The client's budget itself is wall-clock (the root of E2E-T-1). The app now re-checks probes, but a command that times out on a starved thread still reports `TIMEOUT` (by design it is never re-sent) | `packages/shared/src/client/core-client.ts:652-660` | A lag-aware budget in the shared client (FX-C's or a later row) would fix commands too |
| C-6 | The OperatorRole ReferenceError in Metro, 11:26–11:34 (§6 #7) | Metro lines 643-645 | Confirm with FX-M2 that it was a transient edit |
| C-7 | The device re-test of E2E-S-1, -3, -4, E2E-T-1 and F80 is still to run (no emulator was driven here) | — | In the planned re-test round: a revoke while recording the Pair screen, a sign-out over a deep-linked Pair, a warm `demsdemo:///home` while unpaired, and a check that the warnings bar does not come back after a fresh launch |

## 12. Rule compliance

- **Paths.** Only files in the row's paths were written. Outside them, files were only read: `navigation/**`, `motion/**`, `packages/shared/**`, `node_modules/expo-router/**`, the Metro log and the evidence folders.
- **Live stack.** No server, Metro or emulator was started, stopped or restarted. No device was driven, and no `adb` command was run. Metro fast-refreshed the edits onto the devices, as expected.
- **Rollback.** Copies of all 14 modified files were taken before their first edit, with `SHA256SUMS.txt` (sha256 of the list `9cf231a9…`).
- **Device security.** No lock, PIN or fingerprint was touched.
- **Secrets.** None printed or written. The tests use the fake transport's placeholders, a constructed marker code and "not-a-real-password". This report holds no code, token or credential.
- **No commits.** Nothing was deleted or renamed.
- **Load guard.** The mutation driver waits while the 1-minute load is above 14 (it waited once at 14.3). The probe-failure test ran at load 14.68 (11:43), then the row paused before the next run.

---
*Generated: 2026-10-06 12:05*
*Last Updated: 2026-10-06 12:05*
