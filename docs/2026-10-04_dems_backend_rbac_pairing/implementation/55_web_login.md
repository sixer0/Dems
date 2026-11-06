---
task_id: 2026-10-04_dems_backend_rbac_pairing
task_slug: dems_backend_rbac_pairing
date: 2026-10-04
agent: coder-execution
blueprint_step: 77
plan_row: W55
source_plan: /docs/2026-10-04_dems_backend_rbac_pairing/masterplan/02_plan.md
status: complete
tier: 2
---

# 55. Web Login: server sign-in in Live mode (plan row W55, blueprint step 77)

Sources, cited by short name: [CS] `masterplan/04_client_integration_spec.md` rev 2.2; [RT]
`implementation/50_web_runtime_mode.md` (the web runtime, W50); [LS] `implementation/44_live_source.md`
§17.4 (the brief list); [ID] `implementation/24_identity_core.md` (the server's sign-in). All paths are
relative to `/Users/gsp-budi/Documents/DEMS`. Times are WIB on 2026-10-04. No credential, token, cookie
value or password appears in this file or in its assets: the seeded demo password is named by its
constant only (`DEMO_OPERATOR_PASSWORD`), the marker password of the tests is not quoted, and the files
were scanned for both (section 12.6).

## 1. Result

> **After the follow-up of decision D128 (section 21, 21:47 to 21:55): status complete.** The controller
> accepted the build and granted two changes outside the row's write paths. Both are made: the one
> assertion of section 13 is green, and the presentation follow-up is installed by the root route
> (finding F77-3 is closed). The whole web run is green: 55 files / 758 tests, exit 0. Sections 1 to 20
> below are the row as it was handed in at 21:43 and are kept as written; where the follow-up changed a
> statement, section 21.6 says so.

| Item | Value |
|---|---|
| Status | **needs-review**, for ONE reason: one assertion of a W50 test (`apps/core-web/src/test/live-runtime-startup.test.tsx:398`, not a path of this row) pins the behaviour that [CS] §5.4 tells this row to change, and is red now. Everything else of the row is built and verified. Section 13 has the line, the cause, the one-line change and the run that shows the file green with it |
| What was built | The Login page signs in to the Core server through the Live source. In Live mode: the request goes out at once and the password state is empty while it is out; 401 and 423 are the simulator's own result union (the Alert with the attempts the server names, the lockout with its countdown on the Live clock); a 429 shows the limit toast with the seconds of `retry-after` and puts the form back; no answer shows the offline Alert; a 422 is shown as the server's refusal; no security-key button; the disclosure with the plain sentence of WS-9 and no role chip; the truthful trust line; the device strip with what the Core server makes public; the arrival notices from what the Live source says about the session end; the mode selector and "Use Simulated mode" with the confirmation; the hand-off of a session the page did not submit |
| Simulated mode | As before. The two test files of the folder pass unchanged (31 tests) and are absent from `git diff --stat acaff20`; on the simulator the page asks nothing of a server, renders the security key, the role chips and the two "(simulated)" trust lines, and has no new control unless the build offers the choice of mode |
| The session | The server's cookie. On the lane, in a real browser, after a sign-in through the form: `document.cookie` is empty, the browser holds `dems_session_4423` as `HttpOnly`, `SameSite=Strict`, without an expiry; no web-storage value starts with `ses_`; `dems.auth` and `dems.sim.v1` are not written (section 12) |
| Web tests | `npm run test -w @dems/core-web -- --maxWorkers=2` at 21:37: 54 files / 752 tests, **751 passed, 1 failed** (the assertion of section 13). This row's 3 new files: 71 / 71. The folder's 2 files: 31 / 31. Every other file: 680 of 681 (before: 48 files / 598 tests at 20:34; W54 added files in the same wave) |
| Lane check (lane 3: backend 4423, `dems_lane_3`, Vite 5178) | Ran once inside the lane lock, 21:15:10 to 21:15:32, `lockf` exit 0, browser HeadlessChrome/153.0.8010.12. A wrong password showed the server's refusal ("4 attempts remaining"); the sign-in through the form reached the Dashboard; a reload stayed signed in; the sign-out returned to the Login page with its notice; no console error or warning in any step; no listener left |
| Mutation check | 69 single changes in the twelve production files, applied in memory (no file of the tree changed): the run detected 67. The two survivors were followed up: one test added (S02), one redundant line of code removed (C17). On the final tree 68 of 68 are detected (section 15) |
| Mismatches between the Login page and the real server | **None found** in what the lane check ran (F77-2) |
| New dependency | None. Kit components only: `AlertDialog`, `ToggleButtonGroup`, `Alert`, `Button`, `Tooltip`, `Disclosure` (HeroUI), icons of `lucide-react`, TanStack Query for the health answer |
| Gaps | No `CONTRACT-GAP`, no `SIM-GAP`, no `BE-GAP` |

## 2. What was written

All inside the row's write paths.

| File | New / changed | What it holds |
|---|---|---|
| `apps/core-web/src/features/login/use-login-controller.ts` | changed | The behaviour in both modes. `useCoreActions()` and `settle` replace the direct read of the simulator's actions (AC-C-53). Live: the submit (`:326-342`), a rejected sign-in (`failLive`, `:275-309`), the found session and the hand-off that is taken back (`:231-235`, `:370-389`), the arrival from `live.lastSessionEnd` (`:141-149`), Retry through the Live source (`:424-444`), the starting gate (`:130-132`) |
| `apps/core-web/src/features/login/login-live-model.ts` | new | The pure Live rules: `liveArrivalNoticeFor` (`:50`), `signInFailureFor` (`:87`), `signInFailureFacts` (`:122`), `readinessOf`, `isCoreStarting` |
| `apps/core-web/src/features/login/login-model.ts` | changed, additive | Notice kinds `core-starting`, `input-rejected`, `expired-absolute`, `disabled`; `coreStarting` of `noticeFor` (`:232-234`); `isArrivalNotice` (`:255`). Every function answers for the simulator as it did (its test file is unchanged and green) |
| `apps/core-web/src/features/login/live-adapter.ts` | new | `useLiveCoreHealth` (`:30`), `followServerPresentationMode` (`:52`) |
| `apps/core-web/src/features/login/sim-adapter.ts` | changed | `usePresentationMode`: in Live mode the tab-local flag decides alone (`:25-30`) |
| `apps/core-web/src/features/login/auth-card.tsx` | changed | No security key and no divider in Live mode (`:284`); the disclosure's plain sentence and no chip (`:491`, `:523`); `SimulatedTrustLine` (`:415`) and `LiveTrustLine` (`:438`); the selector (`:314`); "Use Simulated mode" (`:203`) |
| `apps/core-web/src/features/login/login-alert.tsx` | changed | The four new notices; the second action of the offline Alert (`:113-152`, `:174`, `:186-190`) |
| `apps/core-web/src/features/login/device-strip.tsx` | changed | `SimulatedCells` (`:80`, the strip as it was) and `LiveCells` (`:128`) |
| `apps/core-web/src/features/login/use-mode-switch.tsx` | new | `useLoginModeSwitch`: the mode of the page load, the confirmation dialog, the failed-switch toast |
| `apps/core-web/src/features/login/mode-selector.tsx` | new | `ModeSelector`: the kit `ToggleButtonGroup` "Simulated \| Live" |
| `apps/core-web/src/features/login/index.tsx` | changed | The mode switch and its dialog, the presentation follow-up (`:66-70`), the hand-off take-back (`:124-128`, `:134`), `data-core-mode` (`:165`), the ring of a starting Core (`:151`) |
| `apps/core-web/src/features/login/report.ts` | changed, additive | `recordLoginIssue`: one record in the page's own log (`:76`) |
| `apps/core-web/src/features/login/login.css` | changed, additive | Three rule groups: the plain sentence, the two actions of the Alert, the selector row (`:569-600`) |
| `packages/shared/src/i18n/en/login.ts` | changed, additive | The group `login.live` (`:96-130`, 15 strings). No existing key or string changed (`git diff acaff20` of the file removes no line) |
| `apps/core-web/src/test/live-login-signin.test.tsx` | new | 17 tests: the sign-in on the fake transport |
| `apps/core-web/src/test/live-login-page.test.tsx` | new | 30 tests: what the page shows in Live mode, beside the simulator |
| `apps/core-web/src/test/live-login-model.test.tsx` | new | 24 tests: the pure rules, the words, the static rules of the folder |

Not written, as the row requires: the runtime (`src/runtime/**`), `src/lib/**`, the shell
(`src/components/shell/**`), the routes, `packages/shared/src/i18n/index.ts`, anything under
`packages/shared/src/{api,live,client,realtime,sim}`, `apps/core-server/**`, the two test files of the
folder.

## 3. The page in Live mode, element by element ([CS] §5.5)

| ID | Element | Simulated mode (unchanged) | Live mode, as built | Proven by |
|---|---|---|---|---|
| WS-1 | Submit | The simulated beat, then `signIn` | The request is handed over at once (`settle(() => actions.signIn(...))`). The Submitting state stays until the action settled AND `VERIFY_BEAT_MS` has passed since it was sent. The password state is cleared when the request is handed over. No time-out of the page's own; the form cannot be sent twice | S "success": the request body, the state `submitting`, the empty password field, one request after two more presses; lane: `state: submitting`, `passwordFieldChars: 0` while the request was out |
| WS-2 | Wrong credentials | The simulator's union | The same union from 401 `INVALID_CREDENTIALS` and `details.attemptsRemaining`; same Alert, same shake | S "a wrong password"; lane: 401, "4 attempts remaining" |
| WS-3 | Lockout | `selectLockout` on the simulator clock | The same selector on the replica's `authLockout`; the countdown runs on the Live clock to `lockedUntil`; after a reload `getSignInStatus` restores it | S "the lockout" (2 tests) |
| WS-4 | Core offline | Heartbeat OFFLINE disables Sign In | The same gate on the Live socket's heartbeat view. Retry calls `live.reconnect('RETRY')` on the existing cooldown (the query bridge asks for the health answer again when the socket is back). In a build that offers the choice the Alert has a second action, "Use Simulated mode", which opens the confirmation | P "the Core server cannot be reached" (2 tests) |
| WS-5 | Device strip | Device, room, clock, GNSS, Core link, security | Six cells, same component, same layout: Core service and version, time, database, engine, Core link, mode. The first, third and fourth come from the health answer; "Unknown" when there is none | P "the device strip" (3 tests); lane: `dems-core-server 0.2.0`, `ready`, `ready`, `online`, `Live` |
| WS-6 | Arrival notice | The simulator's event ring | `live.lastSessionEnd`, read once at mount; section 5 | P "why the operator is on the page" (6 tests); M (5 tests) |
| WS-7 | Trust line | "Console: … paired (simulated)" | "Core server on this computer • web console, no pairing required", `ShieldCheck`; "Core server unreachable", `ShieldAlert`, while the heartbeat view is offline. The pairing slice is not read | P "the trust line" (3 tests); lane |
| WS-8 | Security key | Rendered | Not rendered, with its divider | P "the security key" (2 tests); M "static rules"; lane: `securityKeyInDom: false` |
| WS-9 | Demo operators | `s.operators`, role chips | The three seeded operators of the shared `OPERATORS` constant; the sentence of C1 first; no role chip, no role word; hidden in presentation mode | P "the demo operators" (2 tests); lane: the sentence, three rows, `chips: 0` |
| WS-10 | Presentation mode before sign-in | The flag or the simulator's setting | The tab-local flag alone. While an operator is signed in the server's `settings.presentationMode` is copied into the flag on every change (`followServerPresentationMode`), and only when it differs | P "presentation mode" (4 tests). Limit: F77-3 |
| WS-11 | Mode selector | — | `ToggleButtonGroup` "Simulated \| Live" above the trust line, in both modes, only when the router context carries a selectable mode (MD-4). Pressing the other segment opens the kit `AlertDialog` with the sentence of §3.3; Confirm calls the runtime's `switchTo` | P "the mode selector" (5 tests); lane: the dialog, cancelled |

(S = `live-login-signin`, P = `live-login-page`, M = `live-login-model`, all `.test.tsx` under `apps/core-web/src/test/`.)

## 4. A sign-in that was rejected ([CS] §8.2 A1, LB-10; decision F59)

A wrong password and a locked console are not rejections: the action resolves with the simulator's own
result union for them (CL-19). For a rejection the page asks the shared presenter what it is
(`describeCoreError`, [RT] §8) and then decides (`signInFailureFor`, `login-live-model.ts:87`). The first
matching row decides.

| # | What the action rejected with | The page shows | The form |
|--:|---|---|---|
| 1 | `STOPPED` (the data source was stopped: a mode switch) | Nothing | — |
| 2 | A 429 | The presenter's limit toast with the seconds of `retry-after`. No Alert, no "unreachable" sentence; the link, the strip, the trust line and the mode stay as they were | **Put back as it was typed**, the password too: the Core server did not look at the attempt |
| 3 | No answer, a time-out, the link not ONLINE | The offline Alert (kind `core-offline`), not "unexpected" | Username kept, password cleared |
| 4 | 503 `NOT_READY` | The same Alert in its "starting" wording (kind `core-starting`) | Same |
| 5 | The sign-in was accepted and the Core state did not arrive in `LIVE_BOOT_TIMEOUT_MS` ([CS] §5.2 step 6) | The presenter's toast; the page hands off when the state arrives (section 6) | Same |
| 6 | A 500, an answer outside the contract, an action that does not exist in Live mode | The presenter's toast | Same |
| 7 | 403 `ORIGIN_NOT_ALLOWED` | The "unexpected" Alert; the presenter names the address to open and writes the record that names the cause (WT-2a) | Same |
| 8 | 422 | The Alert "The Core server did not accept this username or password as entered." (kind `input-rejected`), both fields flagged | Same |
| 9 | Anything else (403 `DEVICE_NOT_PAIRED`, an unknown error; also a "signed out" or "not permitted" answer, which cannot be true of a sign-in) | The "unexpected" Alert, and ONE record of the page: source `login.signIn`, a fixed sentence, the class of the error, its code and status, the correlation ID. Never the text of the error | Same |

- **F59**: the form keeps the bounds it had (both fields required) and adds no second rule set. A username
  of 200 characters passes the form (test M "row 8"); the Core server's 422 is shown (row 8).
- **AC-C-44 and LB-10 together**: the password state is empty from the moment the request is handed over
  (every attempt, also the one that ends in a 429). A 429 then puts back the value that attempt carried.
  The value lives in the closure of that one attempt and nowhere else. Decision 2.
- **Records**. The Live source records every rejected action itself (method, path, status, request ID;
  CL-24). The page adds a record only in row 9, and the presenter in row 7. All go to the page's own log
  (`webErrorSink`: in memory, printed in a dev build, never sent anywhere; [RT] §10).

## 5. Why the operator is on the page ([CS] §6.5, WS-6, WS-14, §6.4; [LS] row 16)

`liveArrivalNoticeFor(live.lastSessionEnd)` (`login-live-model.ts:50`), read once when the page mounts.

| The end the Live source reports | Notice | Tone |
|---|---|---|
| None; or an end while nobody was signed in | none | |
| This console's own sign-out, `signOut: 'LOCK'` | "Console locked. Sign in again to continue." | accent |
| This console's own sign-out, `signOut: 'USER'` | "You have been signed out." | accent |
| `IDLE_EXPIRED`, whatever the source (`CONTROL`, `REST`, `LOCAL`) | "Your session expired after 15 minutes without activity. Sign in again." | accent |
| `ABSOLUTE_EXPIRED` | "Your session reached its 8-hour limit. Sign in again." (new) | accent |
| `USER_DISABLED` | "This account was disabled by an administrator." (new) | danger, `role="alert"` |
| `SIGNED_OUT` or `ROTATED` that this console did not send | "You have been signed out." | accent |
| No reason (an invalid cookie), `TOKEN_REUSE`, a revoked device | none | |

The notice comes from what the Live source says about the end, not from the action's outcome and not
from `auth.status` (which has no value LOCKED). It is in memory only: after a reload the Live source
reports no end and the page shows none (test P "a fresh visit, and a reload").

## 6. A session the page did not submit ([CS] §5.4; [LS] rows 7, 17)

When the store becomes SIGNED_IN while the Login page is on screen and no submit of the page is out, the
page runs its normal hand-off to the redirect target (`acceptFoundSession`, `use-login-controller.ts:231`,
called from the store's own change, `:370-389`, and after an attempt of the page that gave no session).

| Case | How it happens |
|---|---|
| The sign-in was accepted and the Core state arrived late (§5.2 step 6) | The action rejected with `SNAPSHOT_TIMEOUT`; the cookie exists; the link returns; the Live source asks who the cookie names and applies the snapshot |
| "Session expired" was reckoned here and the Core holds the session still ([LS] row 17) | The Live source signs in again by itself |
| A sign-in in another tab ([LS] row 7) | The next socket of this page carries the cookie; the Live source asks and takes the session |

A sign-in of the page itself sets SIGNED_IN before it settles; that one applies its own outcome (the
page keeps "a submit is out" in a ref that the store listener reads).

**The reverse** (not in the specification, built for the same reason): when the session ends between
the sign-in and the moment the hand-off leaves the page (the Core ended it, another tab signed out),
the hand-off is taken back and the form is shown again (`use-login-controller.ts:217`, `:380-385`;
`index.tsx:124-128`, `:134`). Without it the card would stay hidden while the route guard sends the
navigation back to `/login`. Decision 6.

**This rule is what makes one W50 test red: section 13.**

## 7. The health answer and a Core server that is starting (WS-5; [CS] §3.5)

`useLiveCoreHealth` (`live-adapter.ts:30`): TanStack Query under the shared key `['health']`, read by the
console's one health reader `fetchCoreHealth()` (the page's own origin in Live mode), `enabled` only in
Live mode, no retry, asked again every 10 s, and every 2 s while the answer says "not ready". The query
bridge refetches the key after a resync ([RT] §6).

| The answer | Strip | Sign In |
|---|---|---|
| `ready.database` and `ready.engine` true | "Ready", "Ready" | Enabled |
| One of them false | "Not ready" for that one | **Disabled**; the Alert "The Core server is starting. Sign-in is available when its database and its engine are ready." with Retry; the ring CRITICAL. The trust line and the link cell stay "reachable": the Core answers |
| No answer, or an answer that failed | "Unknown" | Not blocked by it: the heartbeat gate decides |

Why `fetchCoreHealth()` and not `live.client.call('getServiceHealth')`: deviation D-5.

## 8. The mode selector and "Use Simulated mode" ([CS] §3.2, §3.3, §3.5; MD-4)

| Step | Who | What |
|--:|---|---|
| 1 | This row: `useLoginModeSwitch` (`use-mode-switch.tsx:34`) | The kit `AlertDialog`: "Switch to Simulated mode?" / "Switch to Live mode?", "You will be signed out and the console reloads. Simulated data and Live data are separate.", Cancel, Confirm (`common.coreMode.*` of W50) |
| 2 to 4 | The runtime's `switchTo` ([RT] §3.3) | Sign out of the current mode, store `dems.core.mode.v1`, stop the data source, `location.assign('/login')` |
| A choice that could not be stored | This row | One danger toast `common.coreMode.switchFailed`; the dialog closes; nothing is loaded again |

The selector shows the mode of this page load; the selection never moves without the reload. It is
disabled while a sign-in is out. Nothing is rendered when `useCoreModeControl()` is `null` or not
selectable: a production build, the packaged build, every test that builds its router without `coreMode`.

W54 wrote the same step 1 for the shell in this wave (`components/shell/mode-switch.tsx`, seen at 20:45).
This row does not depend on W54 (plan: W50, W24), so the Login page has its own copy, with the same
dialog, the same words and the same test IDs (`mode-switch-dialog`, `-cancel`, `-confirm`). Decision 5.

## 9. Error handling of the page (the three layers)

| Layer | Live mode |
|---|---|
| What the operator sees | The one Alert of the card (refusal, lockout, offline, starting, input rejected, unexpected), or one toast of the shared presenter (a limit, an accepted sign-in without state, a failed Core). Never a raw error text |
| The record | The Live source's own record of every rejected action; the page's record for an unexpected rejection (row 9 of section 4), a Retry that could not be asked, a mode switch that threw; the presenter's record for `ORIGIN_NOT_ALLOWED`. All in the page's own log (`webErrorSink`), which the project's standing decision keeps in the page: no client-log endpoint (predecessor D3, D4, D41(g); [RT] §10). Level `error` for a failure, `warn` for a recoverable one. No record holds a credential, a username or the text of an unknown error |
| Degradation | Offline and starting: Sign In disabled, Retry on the existing cooldown (3 s, 6 s, 12 s, at most three; `useRetryCooldown`), "Use Simulated mode" where the build offers it. A health answer that failed: "Unknown" cells, sign-in not blocked. A hand-off the session did not outlive: the form again |

## 10. The session: what the page can and cannot see (SR-16; SD-08, SD-24; AC-C-38)

The page never reads, stores or logs a token: the sign-in answer holds none, the cookie is `HttpOnly`,
and no file of the folder names `document.cookie`, a storage of the browser, or a token prefix (static
test M "SR-16"). The only values the page writes to web storage are the tab's presentation flag
(`dems.presentation.v1`, an existing key; only when the server's setting differs from it) and, through
the runtime's `switchTo`, the mode key. `dems.auth` and `dems.sim.v1` are the simulator's and are not
written in Live mode (lane: both absent after the sign-in, the reload and the sign-out).

## 11. Requirement to test

| Criterion | The row's part | Proven by |
|---|---|---|
| AC-C-23 a switch shows the confirmation, signs out, writes the key, reloads to `/login` | The Login page's selector and its dialog (the steps after it are W50's) | P "the mode selector": both directions with the runtime's own `createCoreModeControl`, Cancel, a choice that could not be stored, MD-4; lane: the dialog |
| AC-C-25 no silent fallback | The Login page: the offline Alert, Retry, "Use Simulated mode", nothing simulated on screen | P "the Core server cannot be reached" |
| AC-C-38 no session cookie in `document.cookie`, no value that starts with `ses_`, `dems.auth` not written | all | S "success"; **the lane check, section 12** |
| AC-C-39 `selectLockout` on the replica equals the server's lock state | The page's part | S "a wrong password" (3, then 2 attempts), "the lockout" (`locked`, `lockedUntil`, 0 attempts; 30 s later `retryInMs` 30,000; open again with 5), "after a reload" |
| AC-C-40 a reload while signed in; a reload after the session ended | The lane check's part | Lane: reload at `/dashboard`, `GET /api/v1/auth/session` 200, the Dashboard again. P "a fresh visit, and a reload" |
| AC-C-42 the trust line in both modes; neither "simulated" nor "paired" in the Live string | all | P "the trust line"; M "WS-7" |
| AC-C-43 `login-security-key` in Simulated mode, absent in Live mode | all | P "the security key"; M "the security key is the simulator's" |
| AC-C-44 wrong password, lockout with a countdown, success; the password state empty once the request is sent | all | S "success", "a wrong password", "the lockout", "a limit is not an outage" |
| AC-C-45 `IDLE_EXPIRED` to `/login?redirect=<href>` with the expired notice; `ABSOLUTE_EXPIRED` the 8-hour sentence; `USER_DISABLED` the disabled Alert | The Login page's part (the leave path is the shell's) | P "why the operator is on the page" |
| AC-C-47 hidden while `dems.presentation.v1` is on; no role chip in Live mode; the server's setting copied into the flag while signed in | all, with the limit F77-3 | P "the demo operators", "presentation mode" |
| AC-C-53 no `useSimActions`, no `.actions` of a `Sim` in the folder | all | M "AC-C-53"; the grep of section 14.3 |
| AC-C-101 the folder's test files pass and are absent from the diff | all | Section 14.3 |
| AC-C-104 the plain sentence, three usernames, no chip, hidden in presentation mode; as before on the simulator | The web's part | P "the demo operators", "presentation mode" |
| AC-C-107 a marker password leaves no trace in the web's error sink | The web Login's part | S "a marker password": six attempts through five outcomes; the page's log, the Live source's log and reports, the console, both storages, the address, the replica and the document hold no marker |
| AC-C-110, LB-10 a 429: the limit toast with the seconds, the form kept, no offline notice, no changed mode | The web Login's part | S "a limit is not an outage" (2 tests) |
| CLG (b) the settle site `signIn`: success, the site's refusals, an outage | all | S: "success", "a wrong password", "the lockout", "a refusal the page words itself", "no answer". The site has no permission, so the denied toast of AC-C-48 does not apply to it (the criterion's rows do not list W55) |
| [LS] row 16 the notice from `lastSessionEnd` | all | P "this console's own Lock and Sign out"; M |
| [LS] row 18 no Live result read as a value | all | S "success" (no `live.misuse` record); lane: no console error |
| [LS] row 31 the pending state bears a long wait and no second submit | The page has no timer for a sign-in (reading: the only timer of the Live path is the rest of the beat, `use-login-controller.ts:329-334`) | S "success": the state after 6 s on the fake clock and two more presses, ONE request |

## 12. The lane check (lane 3)

One run, inside `/usr/bin/lockf -k -t 900 .locks/core-server.lane3.lock /bin/sh .cache/w55/lane/run_lane.sh`
(sandbox bypass for this one command; `lockf exit=0`), W50's lock, ports and start. Script:
`assets/55_lane_run_lane.sh.txt`; browser driver: `assets/55_lane_cdp_driver.mjs.txt`; output:
`assets/55_lane_run.log`; the browser's record: `assets/55_lane_browser.json`. The demo flag was off. The
lane database was not reset. The driver types the fields by script (`Input.insertText`) and presses the
button; it reads the seeded operator from the project's seed source and never prints a request body, a
cookie value or a password.

### 12.1 Start and stop

```
== 21:15:10 0. the three ports must be free before anything is started (nothing is stopped that this check did not start)
free: 4423 5178 9398
2026-10-04 21:15:10 WIB
21:15  up 3 days,  4:28, 1 user, load averages: 4.06 3.36 3.80
[...]
== 21:15:11 2. start the lane backend: DEMS_CORE_PORT=4423 npm run start -w @dems/core-server (demo flag OFF)
backend up after 3 quarter seconds, npm pid 24175
node    24196 gsp-budi   18u  IPv4 0x7884a8345336aa25      0t0  TCP 127.0.0.1:4423 (LISTEN)
[...]
== 21:15:12 3. start Vite for lane 3: DEMS_CORE_PROXY_PORT=4423 VITE_DEMS_CORE_MODE=live npm run dev -w @dems/core-web -- --host 127.0.0.1 --port 5178 --strictPort
node    24240 gsp-budi   14u  IPv4 0x6b19d47d144364e8      0t0  TCP 127.0.0.1:5178 (LISTEN)
-- health through the dev server: 200

== 21:15:12 4. the Login page in a real browser (headless Chromium over CDP): a wrong password, the sign-in through the form, a reload, the sign-out
chrome pid 24259
Google Chrome for Testing 153.0.8010.12
cdp-driver exit 0
[...]
== 21:15:32 stop what this check started
chrome stopped
vite: npm exit status 143
backend: npm exit status 0

== 21:15:32 listeners left on 4423, 5178, 9398 (expect none):
lsof exit 1 (1 with no output: no listener)
lockf exit=0
```

### 12.2 The browser (GC-22)

`HeadlessChrome/153.0.8010.12` (`Google Chrome for Testing 153.0.8010.12`, the headless shell of the
Playwright cache, driven over raw CDP; protocol 1.3; V8 15.3.76.4), with a fresh profile under `$TMPDIR`
that was removed afterwards. The cookie as that browser stored it has no expiry (`session: true`).
Whether a browser that restores its session restores this cookie (the hypothesis of WS-15) was **not
tested**: a headless shell with a throw-away profile has no session restore.

### 12.3 What the browser did (from `assets/55_lane_browser.json`)

| Step | What happened | Screenshot |
|---|---|---|
| 1. `http://127.0.0.1:5178/login`, Live (the lane preselects it; nothing stored) | `GET /api/v1/auth/session` 401, `GET /api/v1/auth/status` 200, `GET /api/v1/health` 200; one socket `ws://127.0.0.1:5178/ws` (101; `hello`, `heartbeat`s; no cookie sent); every request to `http://127.0.0.1:5178`. `data-core-mode: LIVE`, state `idle`. Trust line "Core server on this computer • web console, no pairing required". `login-security-key` not in the DOM, no divider. Selector on `LIVE`. Strip "Core server status", 6 cells: `dems-core-server 0.2.0`, database `ready`, engine `ready`, link `online`, mode `Live`. The word "simulated" nowhere on the page outside the selector and the disclosure. Console: empty | `assets/55_login_live.png` |
| 2. The disclosure, opened and closed again by script | The sentence "Published demo credentials for synthetic accounts on this local demo. They are not a secret."; rows `budi.santoso`, `andi.pratama`, `rina.wijaya`; no role word; 0 chips | (none: the open disclosure shows the demo password) |
| 3. **A wrong password**, typed and submitted (ONE attempt) | `POST /api/v1/auth/sign-in` 401. State `error`; Alert `invalid`: "Invalid username or password." "4 attempts remaining"; the password field empty (0 characters), the username kept (12). Console: empty | `assets/55_login_live_wrong_password.png` |
| 4. **The sign-in**, typed and submitted | While the request was out: state `submitting`, the password field empty. `POST /api/v1/auth/sign-in` 200; a new socket with the cookie: `hello`, `snapshot`, `heartbeat`, `meters`, `delta`; the Dashboard (`page-dashboard`). Console: empty (no `live.misuse`) | `assets/55_live_signed_in_through_the_form.png` |
| 5. A reload at `/dashboard` (AC-C-40) | `GET /api/v1/auth/session` 200; the Dashboard again, without credentials | |
| 6. The sign-out (a request of the page; the console follows its socket) | 204; the Login page, state `signed-out`, Alert "You have been signed out."; no cookie left; a new anonymous socket; `GET /api/v1/auth/status` 200, `GET /api/v1/health` 200 | `assets/55_login_live_signed_out.png` |
| 7. The selector: "Simulated" pressed | The dialog "Switch to Simulated mode?" with the sentence of §3.3; cancelled; nothing stored (`dems.core.mode.v1` absent), the selector still on `LIVE` | `assets/55_login_live_mode_dialog.png` |

### 12.4 AC-C-38 in the real browser: the console output of the page's own script, after the sign-in

A script that ran IN the page read what any script of the page can see, printed it to the page's
console (`console.info('[w55 lane] session facts', …)`) and returned it to the driver. The driver records
the returned value (of the console it keeps errors and warnings only, and there were none); from
`assets/55_lane_browser.json`, step `signIn`:

```
"session": {
  "href": "http://127.0.0.1:5178/dashboard",
  "documentCookieLength": 0,
  "documentCookieNames": [],
  "documentCookieShowsSessionCookie": false,
  "localStorage": {},
  "sessionStorage": { "dems.shell.intro": "1 chars" },
  "anyStoredValueStartsWithSes": false,
  "demsAuthWritten": false,
  "demsSimSnapshotWritten": false,
  "owedSignOutKeyPresent": false,
  "pageTestIds": [ "page-dashboard" ]
},
"cookies": [
  { "name": "dems_session_4423", "value": "(47 chars, not recorded)", "domain": "127.0.0.1", "path": "/",
    "httpOnly": true, "sameSite": "Strict", "secure": false, "session": true, "expires": "none (a browser-session cookie)" }
]
```

So: `document.cookie` does not show `dems_session_4423` (it is the empty string) while the browser holds
that cookie as `HttpOnly`; no web-storage value starts with `ses_`; `dems.auth` is not written. The same
facts hold after the reload and after the sign-out (then `cookieNamesLeft: []`). The one key in web
storage is the shell's own intro marker.

### 12.5 What the check added to `dems_lane_3`

```
== 21:15:10 1. lane database before the check: npm run db:status -w @dems/core-server -- --database dems_lane_3
db:status exit 0
audit head       seq 94; hash b036dc08c3039072...
  audit_log                94
  auth_sessions            4
  operators                3
[...]
== 21:15:32 6. lane database after the check
db:status exit 0
-- row counts that differ (before / after):
< audit head       seq 94; hash b036dc08c3039072...
> audit head       seq 97; hash 258785f4ba2359e0...
<   audit_log                94
<   auth_sessions            4
>   audit_log                97
>   auth_sessions            5
<   events                   69
>   events                   72
-- the backend's log: lines       40; lines with level error or fatal: 0
```

Three audit rows, three events and one session row (ended): the failed sign-in, the sign-in, the
sign-out. One failed attempt was made; the console was not run into its lockout.

### 12.6 No secret in what was written

`node --import tsx .cache/w55/secret_scan.mts <files>` reads the demo password from the seed source and
counts it, the tests' marker and token-shaped values in each file, printing counts only (script:
`assets/55_secret_scan.mts.txt`). Run at 21:16 over the lane's files, and again at 21:42 over this
document, the progress file, every `assets/55_*` file, the row's source and its tests: `RESULT: no file
holds a secret` both times. The first run, with its paths shortened:

```
clean  demo-password=0 marker=0 token-shaped=0  …/assets/55_lane_browser.json
clean  demo-password=0 marker=0 token-shaped=0  …/assets/55_lane_run.log
clean  demo-password=0 marker=0 token-shaped=0  …/assets/55_login_live.png                 (and the four other screenshots)
clean  demo-password=0 marker=0 token-shaped=0  .locks/core-server.lane3.log
clean  demo-password=0 marker=0 token-shaped=0  .locks/core-server.lane3.vite.log
RESULT: no file holds a secret
```

The five screenshots were read by this row: none shows a password field with content or the open
disclosure.

## 13. The one red test, and why it is not this row's to edit

| Item | Value |
|---|---|
| Test | `apps/core-web/src/test/live-runtime-startup.test.tsx`, "the simulator's stored state is not touched in Live mode (MD-5; AC-C-21)" > "`dems.sim.v1` and `dems.auth` are byte-equal after a Live session with the shell mounted, and nothing about the session is stored" |
| Line | `:398`: `expect({ ...window.sessionStorage }).toEqual(before.session)` |
| What the test does | It mounts the Login page in Live mode, then signs in by calling `page.live.actions.signIn(...)` itself (not through the form), signs out the same way, and compares the whole `sessionStorage` with its two keys of before |
| Why it was green | The unmodified Login page ignored a session it did not submit: it stayed on screen, and the shell was never mounted in that test (its title says "with the shell mounted"; with the old page it was not) |
| Why it is red now | [CS] §5.4 gives this row one addition: when the store becomes SIGNED_IN while the Login page is on screen without a submit, the page runs its hand-off. So the shell IS mounted now, and the shell writes its own marker `dems.shell.intro` (`components/shell/app-shell.tsx:62`, one of the console's eight existing keys, MD-1). The comparison finds three keys where it expects two |
| What still holds | The two assertions that ARE the criterion AC-C-21 (`:396-397`: `dems.sim.v1` and `dems.auth` byte-equal) pass. So do the token scan and the debt-key check after it |
| The smallest change | Line 398: `expect({ ...window.sessionStorage }).toEqual({ ...before.session, 'dems.shell.intro': '1' })`. One line, in a file of W50 |
| Why the page was not narrowed instead | The only narrower rule that keeps this assertion green is "hand off only after this page's own `SNAPSHOT_TIMEOUT`". It would leave the Login page on screen, signed in, in the two other real cases of section 6 ([LS] rows 7 and 17), which the specification's sentence and [LS] row 17 ("the shell must follow `auth.status` in both directions") cover. A direct call of `signIn` beside a mounted Login page exists in this one test only: in the app the form is the only caller |

**The one-line change is enough** (shown without changing the file: the line is replaced in memory by
the transform plugin of section 15, id `RELAX-W50`; `python3 .cache/w55/mut/run_mutations.py relax`;
`applied: True` is the plugin's marker that the replacement was made):

```
## 2026-10-04 21:32:11 WIB W50's start-up test file as it is on disk: exit=1 Test Files  1 failed (1) | Tests  1 failed | 21 passed (22) first: × `dems.sim.v1` and `dems.auth` are byte-equal after a Live session with the shell mounted, and nothing about the session is stored 91ms
## 2026-10-04 21:32:14 WIB the same file with line 398 relaxed IN MEMORY (applied: True): exit=0 Test Files  1 passed (1) | Tests  22 passed (22) first:
```

The failure as the whole run prints it:

```
 FAIL  src/test/live-runtime-startup.test.tsx > the simulator's stored state is not touched in Live mode (MD-5; AC-C-21) > `dems.sim.v1` and `dems.auth` are byte-equal after a Live session with the shell mounted, and nothing about the session is stored
AssertionError: expected { …(3) } to deeply equal { …(2) }
  {
    "dems.auth": "{\"operatorId\":\"OPR-001\",\"issuedAt\":1790823000000}",
+   "dems.shell.intro": "1",
    "dems.sim.v1": "{\"state\":{\"marker\":\"a snapshot the simulator wrote earlier\"},\"version\":1}",
  }
 ❯ src/test/live-runtime-startup.test.tsx:398:42
```

(The two values are the test's own fixtures: an operator ID and a marker text, no credential.)

## 14. Verification

### 14.1 Baseline before the first edit

`assets/55_baseline_web_test.log` (20:34:14, before any file of the row was touched; the pre-images were
saved at 20:33):

```
## 2026-10-04 20:34:14 WIB baseline before the first edit of W55
$ npm run test -w @dems/core-web -- --maxWorkers=2
 Test Files  48 passed (48)
      Tests  598 passed (598)
exit=0
```

### 14.2 Final gate on the finished tree

From the workspace root with no `cd` (`.cache/w55/gate_final.sh`; the whole output is
`assets/55_gate_final.log`). No production file of the row changed after 21:36:15 (`use-login-controller.ts`: the redundant call of section 15 was removed); the last test edit
was at 21:36:15. The block below is that output; the runner's timing lines are left out, and so are two lines of passing tests of other suites whose names hold the word "FAIL" (the filter of the script caught them; they are in the log).

```
load: 11.21 9.30 7.69
## 2026-10-04 21:37:56 WIB $ npm run test -w @dems/core-web -- --maxWorkers=2 --reporter=default --reporter=json --outputFile.json=.cache/w55/web_final.json
 FAIL  src/test/live-runtime-startup.test.tsx > the simulator's stored state is not touched in Live mode (MD-5; AC-C-21) > `dems.sim.v1` and `dems.auth` are byte-equal after a Live session with the shell mounted, and nothing about the session is stored
AssertionError: expected { …(3) } to deeply equal { …(2) }
 ❯ src/test/live-runtime-startup.test.tsx:398:42
 Test Files  1 failed | 53 passed (54)
      Tests  1 failed | 751 passed (752)
(the runner's exit status is in the JSON summary below)

## per file, from the JSON report of that run
   54 files, 752 tests, 751 passed, 1 failed; runner success: false
   the new files of this row: 3 files, 71 tests, 71 passed
     src/test/live-login-model.test.tsx: 24 / 24
     src/test/live-login-page.test.tsx: 30 / 30
     src/test/live-login-signin.test.tsx: 17 / 17
   the test files of the folder that existed (CLG a): 2 files, 31 tests, 31 passed
     src/features/login/__tests__/login-model.test.tsx: 14 / 14
     src/features/login/__tests__/login-page.test.tsx: 17 / 17
   every file but the three of this row: 51 files, 681 tests, 680 passed
   FAILED src/test/live-runtime-startup.test.tsx > the simulator's stored state is not touched in Live mode (MD-5; AC-C-21) `dems.sim.v1` and `dems.auth` are byte-equal after a Live session with the shell mounted, and nothing about the session is stored

## 2026-10-04 21:39:29 WIB $ npm run typecheck -w @dems/core-web
> @dems/core-web@0.1.0 typecheck
> tsc -b
exit=0
typecheck exit=0
## 2026-10-04 21:40:07 WIB $ npm run lint -w @dems/core-web
> @dems/core-web@0.1.0 lint
> oxlint
lint exit=0

## 2026-10-04 21:40:08 WIB $ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  68 passed (68)
      Tests  1814 passed (1814)
exit=0
## 2026-10-04 21:40:24 WIB $ npm run typecheck -w @dems/shared
exit=0
## 2026-10-04 21:40:29 WIB $ npm run lint -w @dems/shared
> @dems/shared@0.1.0 lint
> oxlint
exit=0
## 2026-10-04 21:40:30 WIB $ npm run typecheck -w @dems/mobile
exit=0

## 2026-10-04 21:40:39 WIB CLG (a): the folder's existing test files are absent from the diff against acaff20
$ git diff --stat acaff20 -- apps/core-web/src/features/login/__tests__ | wc -c
       0
$ git status --short apps/core-web/src/features/login/__tests__ | wc -l
       0
## CLG (c), AC-C-53: $ grep -rnE 'useSimActions|\.actions' apps/core-web/src/features/login --include='*.ts' --include='*.tsx' | grep -v __tests__
apps/core-web/src/features/login/use-mode-switch.tsx:90:                {t('common.actions.cancel')}
apps/core-web/src/features/login/login-alert.tsx:127:              ? t('common.actions.retryIn', { seconds: coreRetry.cooldown })
apps/core-web/src/features/login/login-alert.tsx:128:              : t('common.actions.retry')}
   (the same without the i18n words `common.actions.*`:) lines: 0
## the shared file of this row is additive: $ git diff acaff20 -- packages/shared/src/i18n/en/login.ts | grep -c '^-[^-]'
0
## AC-C-41, AC-C-35 (not this row's files, shown unchanged): $ git diff acaff20 -- apps/core-web/src/routes/login.tsx apps/core-web/src/routes/_app.tsx apps/core-web/src/lib/packaged-csp.ts apps/mock-core | wc -c
       0
## what this row changed or created (tracked and untracked), by path
 M apps/core-web/src/features/login/auth-card.tsx
 M apps/core-web/src/features/login/device-strip.tsx
 M apps/core-web/src/features/login/index.tsx
 M apps/core-web/src/features/login/login-alert.tsx
 M apps/core-web/src/features/login/login-model.ts
 M apps/core-web/src/features/login/login.css
 M apps/core-web/src/features/login/report.ts
 M apps/core-web/src/features/login/sim-adapter.ts
 M apps/core-web/src/features/login/use-login-controller.ts
 M packages/shared/src/i18n/en/login.ts
?? apps/core-web/src/features/login/live-adapter.ts
?? apps/core-web/src/features/login/login-live-model.ts
?? apps/core-web/src/features/login/mode-selector.tsx
?? apps/core-web/src/features/login/use-mode-switch.tsx
?? apps/core-web/src/test/live-login-model.test.tsx
?? apps/core-web/src/test/live-login-page.test.tsx
?? apps/core-web/src/test/live-login-signin.test.tsx
## $ git diff --stat acaff20 -- apps/core-web/src/features/login packages/shared/src/i18n/en/login.ts
 apps/core-web/src/features/login/auth-card.tsx     | 146 ++++++++---
 apps/core-web/src/features/login/device-strip.tsx  | 141 +++++++---
 apps/core-web/src/features/login/index.tsx         |  41 ++-
 apps/core-web/src/features/login/login-alert.tsx   |  88 +++++--
 apps/core-web/src/features/login/login-model.ts    |  43 +++-
 apps/core-web/src/features/login/login.css         |  37 +++
 apps/core-web/src/features/login/report.ts         |  22 ++
 apps/core-web/src/features/login/sim-adapter.ts    |  15 +-
 .../src/features/login/use-login-controller.ts     | 285 +++++++++++++++++----
 packages/shared/src/i18n/en/login.ts               |  43 ++++
 10 files changed, 705 insertions(+), 156 deletions(-)
## 2026-10-04 21:40:39 WIB listeners on the lane's ports: $ lsof -nP -iTCP:4423 -iTCP:5178 -iTCP:9398 -sTCP:LISTEN
lsof exit 1 (1 with no output: no listener)
```

Reading it:

- **The web run has one failure, and it is the assertion of section 13.** Every other test of the
  workspace passes, the row's own included.
- `typecheck` and `lint` of `@dems/core-web` exit 0, lint without a warning.
- `@dems/shared`: tests, typecheck and lint exit 0 (`login.ts` gained keys only).
- `@dems/mobile`: typecheck exit 0.

### 14.3 The client gate CLG

| Item | Command | Result |
|---|---|---|
| (a) the folder's existing tests pass and their files are absent from `git diff --stat acaff20` | `git diff --stat acaff20 -- apps/core-web/src/features/login/__tests__ \| wc -c`; the per-file lines of the JSON report | `0` bytes; `login-model.test.tsx` 14 / 14, `login-page.test.tsx` 17 / 17 |
| (b) one Live test on the fake transport per settle site: success, the site's refusal, an outage | The settle site is `signIn` ([CS] §8.2 A1); test file S | "success" (2 tests), "a wrong password", "the lockout" (2), "a limit is not an outage" (2), "a refusal the page words itself" (4), "no answer" (2): 17 / 17 with the rest of the file (a found session, the marker scan) |
| (c) no `useSimActions` and no `.actions` read on a `Sim` in the folder's production files | `grep -rnE 'useSimActions\|\.actions\b' apps/core-web/src/features/login --include='*.ts' --include='*.tsx' \| grep -v __tests__` | Three lines, all the i18n words `common.actions.cancel`, `.retryIn`, `.retry` (a text key, not a read of a data source); without them: 0 lines. Static test M "AC-C-53" holds the same |
| (d) one live check of at most 10 minutes on a lane, with a screenshot | Section 12 | 22 s inside the lock; five screenshots |

### 14.4 Test ledger (P24)

| Workspace | Before this row | After this row | Added by this row |
|---|---|---|---|
| `@dems/core-web` | 48 files / 598 tests (20:34, exit 0) | 54 files / 752 tests: **751 passed, 1 failed** (21:37; the runner exits 1 for the assertion of section 13) | 3 files / 71 tests, all passed |
| `@dems/shared` | 68 files (the brief's figure for W50: 1,807 tests; 1,814 at 21:24, other rows) | 68 files / 1,814 tests (21:40, exit 0) | none (`login.ts` gained keys) |
| `@dems/mobile`, `@dems/core-server`, `@dems/mock-core` | not run by this row: no file of theirs was written | typecheck of `@dems/mobile` exit 0 (it reads the shared i18n) | none |

The web total is not 48 + 3 files: W54 added its own test files to the workspace in the same wave (they
are in the run and green). The gate's line "every file but the three of this row" counts them with the
48 that existed.

| New test file | Tests | Holds |
|---|--:|---|
| `src/test/live-login-signin.test.tsx` | 17 | The sign-in on the fake transport: success, the refusals, a limit, an outage, a found session, the marker scan |
| `src/test/live-login-page.test.tsx` | 30 | What the page shows in Live mode beside the simulator: the trust line, the security key, the disclosure, presentation mode, the strip, the offline and starting states, the arrival notices, the mode selector, a hand-off taken back |
| `src/test/live-login-model.test.tsx` | 24 | The pure rules, the words, the static rules of the folder |

Every test that builds a Live source uses W50's harness (`createLiveTestBed`): the fake clock and its
timers are injected, and `dispose()` ends with `fake.assertNoViolations()`.

### 14.5 Runs of this row that were red, and what was not this row's (P11)

| When | Run | Result | Whose |
|---|---|---|---|
| 20:57 | The folder's tests, `routes.test.tsx`, W50's start-up file | 83 passed, 1 failed: the assertion of section 13 | This row's change; section 13 |
| 21:00:30 | `tsc -b` of `@dems/core-web` | TS7031 at `src/test/live-shell-notices.test.tsx(407,39)`, `(408,40)` | W54's file, in flight. Exit 0 at 21:13:14 |
| 21:04 | Test S, first run | 16 passed, 1 failed: the 422 test sent a username the fake transport refuses as outside the contract (F77-5) | This row's test; corrected |
| 21:08 | Test P, first run | 25 passed, 3 failed: three assertions of the test itself (the simulator's pairing state, a link cell read before the first heartbeat, the word "Simulated" of the Alert's own action) | This row's test; corrected |
| 21:10 | The whole web run | 741 passed, 1 failed (section 13) | Section 13 |
| 21:19 | The mutation runner's baseline | One test FILE did not load: the static test read `process.cwd()`, and the runner starts from the workspace root | This row's test; it now reads `import.meta.dirname`, as W50's static test does |
| 21:25:19 | `tsc --noEmit` of `@dems/mobile` | TS2345 at `src/features/pairing/pairing-live-model.test.ts(101,80)` | A mobile row's file, in flight. Exit 0 at 21:32 and in the gate (21:40) |
| 21:37 | The whole web run of the gate | 751 passed, 1 failed (section 13) | Section 13 |

## 15. Mutation check (M15)

No file of the workspace tree was changed: each mutation is one text replacement in one module, applied
in memory by a transform plugin of a separate runner configuration (`assets/55_mutations_config.mts.txt`),
which loads the app's own Vite configuration (W50's method, rule M15). A mutation counts as detected only
when the tests fail AND the plugin left its marker that the replacement was really made (the text must
occur exactly once). Runner: `assets/55_mutations_runner.py.txt`; logs: `assets/55_mutations.log`.

**69 single changes in the twelve production files of the row that hold a rule. The run detected 67.
The two that survived were followed up: S02 is detected after one test was added; C17 showed a redundant
line of code, which was removed. On the final tree: 68 changes, 68 detected, 0 not applied.**

| Module | Changes | Detected in the run | After the follow-up |
|---|--:|--:|--:|
| `use-login-controller.ts` (the behaviour in both modes) | 16 | 15 | 15 of 15 (C17's line of code was removed) |
| `login-live-model.ts` (the two Live tables, the health rules) | 17 | 17 | 17 |
| `login-model.ts` (the new notice kinds) | 5 | 5 | 5 |
| `auth-card.tsx` | 8 | 8 | 8 |
| `login-alert.tsx` | 5 | 5 | 5 |
| `device-strip.tsx` | 4 | 4 | 4 |
| `live-adapter.ts` | 3 | 3 | 3 |
| `sim-adapter.ts` | 1 | 0 | 1 (one test added) |
| `use-mode-switch.tsx` | 4 | 4 | 4 |
| `mode-selector.tsx` | 2 | 2 | 2 |
| `index.tsx` | 3 | 3 | 3 |
| `report.ts` | 1 | 1 | 1 |
| **All** | **69** | **67** | **68 of 68** |

The run had three parts, because the machine was loaded by the other rows (1-minute load average 10 to
11.6) and each run of the five test files took over 20 s: the first fifteen changes ran against all five
test files (the row's three and the folder's two); the run was then stopped by this row and restarted
with, for each change, the test files that hold the rule it breaks (the pure rules against the model
test, where each row of the two tables has its own assertion). Every part started from a green baseline.

```
# part 1: all five test files
## 2026-10-04 21:20:01 WIB baseline: the five test files of the row, no mutation
baseline exit=0 Test Files  5 passed (5) | Tests  101 passed (101) (11.9 s)
C01 … C16: 15 changes, each DETECTED (the run was stopped by this row before its summary line)
# part 2: the test files of each change's rule
## 2026-10-04 21:26:38 WIB baseline: the five test files of the row, no mutation
baseline exit=0 Test Files  5 passed (5) | Tests  101 passed (101) (18.4 s)
C17 SURVIVED    exit=0 use-login-controller.ts: Retry in Live does not ask for the health answer [Test Files  3 passed (3) | Tests  63 passed (63)] first: 
L01 … L06: each DETECTED (stopped by this row before its summary line)
# part 3: the rest
## 2026-10-04 21:29:42 WIB baseline: the five test files of the row, no mutation
baseline exit=0 Test Files  5 passed (5) | Tests  101 passed (101) (18.5 s)
C17 SURVIVED    exit=0 use-login-controller.ts: Retry in Live does not ask for the health answer [Test Files  3 passed (3) | Tests  63 passed (63)] first: 
S02 SURVIVED    exit=0 sim-adapter.ts: Simulated: the simulator setting is not read [Test Files  2 passed (2) | Tests  46 passed (46)] first: 
## 2026-10-04 21:35:52 WIB 48 mutations: 46 detected, 2 survived ['C17', 'S02'], 0 not applied []
# part 4: on the final tree
## 2026-10-04 21:36:56 WIB baseline: the five test files of the row, no mutation
baseline exit=0 Test Files  5 passed (5) | Tests  102 passed (102) (18.2 s)
C08 DETECTED    exit=1 use-login-controller.ts: Live: Retry does not ask for a new socket [Test Files  1 failed | 2 passed (3) | Tests  1 failed | 63 passed (64)] first: × Retry asks the Live source for a new socket now, on the cooldown; when the Cor […]
C09 DETECTED    exit=1 use-login-controller.ts: a starting Core does not block sign-in [Test Files  1 failed | 2 passed (3) | Tests  1 failed | 63 passed (64)] first: × §3.5: a Core server that answers but is not ready blocks sign-in with the "starti […]
S02 DETECTED    exit=1 sim-adapter.ts: Simulated: the simulator setting is not read [Test Files  1 failed | 1 passed (2) | Tests  1 failed | 46 passed (47)] first: × Simulated: the simulator's own setting hides the disclosure as before, without the f […]
## 2026-10-04 21:37:50 WIB 3 mutations: 3 detected, 0 survived [], 0 not applied []
```

(`[…]` marks a cut; the whole lines, with the test totals of each run, are in the log.)

| The two that survived | What it showed | What was done |
|---|---|---|
| S02: on the simulator the simulator's own presentation setting is not read (`useSim(NOT_READ)`) | The folder's existing test sets the tab's flag, never the simulator's setting; this row's tests did not either. The line this row changed in `sim-adapter.ts` was therefore held by no test | One test added to P: "Simulated: the simulator's own setting hides the disclosure as before, without the flag". Detected (part 4) |
| C17: Retry in Live mode without its own call for the health answer | The first run (21:26) had no assertion on it. After one was added to test P "Retry asks the Live source for a new socket" (the health answer is asked for again within 2 s of the press, while its own interval is 10 s away), the change survived again (21:29): the query bridge of the root route already asks for `['health']` when the socket is back (`runtime/query-bridge.ts:150-151`, `RESYNCED`). The call was **redundant** | The call and its variable were removed from `use-login-controller.ts` (Retry is `live.reconnect('RETRY')`; a comment says who asks for the health answer). The assertion stays: it now holds the bridge's part. The change C17 no longer exists (its text is gone), so it is not counted. After the removal: the five test files green (102 tests), and the two changes around Retry and the starting gate (C08, C09) detected again on the final tree (part 4) |

Every detection names its failing test in the log, and each is a test of the mutated rule: for example
C01 "the password state is not cleared when the request is handed over" fails "the request goes out at
once …; the password state is empty while it is out"; C04 "a found session is handed off while a submit
of the page is out" fails "the Core ends the session between its answer and the hand-off"; L06 "a 429 is
shown as an outage" fails "row 2: a 429 is a limit whatever the transport reason says"; V01 "the health
answer is asked for on the simulator" fails "Simulated: the two strings of the simulator, as before"
(its `fetched` list is no longer empty); A07 "'Use Simulated mode' is offered on the simulator" fails
"Simulated, in a build that offers the choice: Retry only". No detection is a suite error.

Not mutated, and why: `pairingNotRead` (WS-7: the pairing slice is not read in Live mode; reading it would
change nothing on screen, because the Live card does not use it: a property of the code, held by reading);
the `isError` fallback of the strip (a health answer that failed AFTER one that succeeded: no test makes
the answer fail later); `fireImmediately` of the presentation follow-up (it matters only where the
follow-up is installed while an operator is signed in, which the Login page never is: F77-3); the reset
of `leaving` in `index.tsx` (the second path of the taken-back hand-off: section 20); `login.css` and
the i18n texts (the texts are held equal to the specification's by test M "the words").

## 16. Findings (P22)

| ID | Finding | Evidence | For |
|---|---|---|---|
| F77-1 | **One assertion of a W50 test pins the behaviour [CS] §5.4 tells this row to change**, and is red. One line fixes it | Section 13 | Controller: a slot for `live-runtime-startup.test.tsx:398` |
| F77-2 | **No mismatch between the Login page and the real server** in what was run: the session probe (401), the lockout question, the health answer with `ready`, a 401 with `details.attemptsRemaining` (4 after one failure), a 200 with the cookie, the new socket with `hello` and `snapshot`, the reload, the sign-out heard on the socket. The browser console held no error, no warning and no `live.*` report in any step | Section 12.3; `assets/55_lane_browser.json` (`console: []` in every step) | Controller |
| F77-3 | **The presentation follow-up is installed by the Login page only.** A page load that starts signed in (a reload inside the shell) never mounts the Login page, so a change of the server's setting made after that reload is not copied into the flag until the Login page is next shown; by then the replica is empty. The flag is in `sessionStorage`, so what was copied before the reload is still there. Smallest change, outside this row's paths: in `apps/core-web/src/routes/__root.tsx`, in the effect that attaches the query bridge (`:78`), call `followServerPresentationMode(live)` (idempotent per source; it could move to `lib/presentation-mode.ts` with it) | `live-adapter.ts:52`; `index.tsx:66-70`; test P "the server's setting is copied" signs in through the Login page | Controller, decision 4 |
| F77-4 | On the Live Login page two texts are the console's own constants, not Core data: the footer "v2.4.1" (`SOFTWARE_VERSION`, the demo's product version) and the brand lines. The Core server's version is in the strip (`dems-core-server 0.2.0`). Neither says "simulated"; a reader could take "v2.4.1" for the Core's version | `assets/55_login_live.png`; `index.tsx:193` | Controller: a wording question for the README or a later row. Not changed here ("the layout, the components and the motion of the page do not change", [CS] §5.5) |
| F77-5 | The fake transport refuses a REQUEST outside the contract (a username of 200 characters: `FakeTransportRequestError … username: too_big`) before any scripted answer. So "an over-long input is sent and the server answers 422" cannot be run end to end on the fake: the 422 is scripted for an input inside the contract, and the form's own bounds are shown by the pure test | First run of test S "422" at 21:04 | Authors of Live form tests (W64, W69, W75): the same will meet them |
| F77-6 | The health reader of the console is the global `fetch` (`fetchCoreHealth()`), not the typed client. A Live test of any row that reaches the Login page without stubbing `fetch` now makes one real request attempt to `http://127.0.0.1:5178/api/v1/health` (refused when no lane runs; answered by a lane's backend when one does). The Live test files of W50 and W54 that reach the Login page stub it | `live-adapter.ts:30-38`; `live-runtime-startup.test.tsx:94-102`; `live-shell-notices.test.tsx` (its `beforeEach`) | Authors of Live tests; W87's static test could require the stub |
| F77-7 | In jsdom the fake transport sets no cookie, so `document.cookie` in test S "success" proves only that the page writes none. The proof that the session cookie is not readable is the lane check | Section 12.4 | Controller: how AC-C-38's "web test" half is to be read |
| F77-8 | A type error outside this row's files at 21:00:30: `apps/core-web/src/test/live-shell-notices.test.tsx(407,39)` and `(408,40)`, TS7031 (W54's file, in flight). Re-checked at 21:13:14: `tsc -b` exit 0 | The two typecheck runs | None |
| F77-9 | Right after this row's lane check ended (no listener at 21:15:32), two listeners appeared on the lane's ports: `node` pid 24805 on 5178 and `chrome-headless-shell` pid 24814 on 9398. They are not this row's (its pids were 24240 and 24259, both stopped): another row took the lane lock. Not touched | `lsof` at about 21:16 | None |
| F77-10 | Each failed sign-in on a lane takes one of the console's five attempts of a 300 s window ([ID] §5). This check took one at 21:15:18; the server restarts its count at a restart (memory state), and the lane backend was stopped at 21:15:32 | Section 12.5 | The next lane user |
| F77-11 | W54's `useModeSwitch` and this row's `useLoginModeSwitch` are the same step twice | Section 8 | Controller, decision 5 |

## 17. Deviations from the plan and from the row's text

| ID | Deviation | Why |
|---|---|---|
| D-1 | **One test outside the row's paths is red**, by the row's own change | Section 13 |
| D-2 | The page root carries `data-core-mode` in BOTH modes, and the Live trust line `data-reachable`. On the simulator this is one added attribute (`SIMULATED`); nothing else of the simulator's DOM changed (the security key, the chips and the trust line are rendered by the same elements in the same order) | Tests and the lane driver read the mode from the page |
| D-3 | In Simulated mode three things are done another way with the same result: the two sign-in actions are consumed through `settle` (the simulator answers at once, so `ok` or `fail` run before `settle` returns, as the `try`/`catch` did); the accepted operator is looked up in the store at that moment instead of in the last rendered list; `finishHandOff` also checks a ref that is always true when it is called on the simulator | AC-C-53 needs one call-site shape; the two test files of the folder pass unchanged |
| D-4 | The Live disclosure shows each seeded operator's display name and initials beside the username, from the shared `OPERATORS` constant. [CS] WS-9 names "the three seeded usernames" | "No role chip or other server data": the names come from the client's constant, and no operation of the contract changes a name. Decision 3 |
| D-5 | The health answer is read with `fetchCoreHealth()` (the global `fetch`), not with `live.client.call('getServiceHealth')` ([LS] row 21) | W50's test harness scripts no answer for `getServiceHealth`, and an unscripted call on the fake transport is a recorded violation that fails `bed.dispose()`: every W50 test that passes the Login page in Live mode would turn red. `fetchCoreHealth()` is what the Stack Check page uses in Live mode and what [RT] §13.1 lists for it. F77-6 |
| D-6 | A 500 and an answer outside the contract are worded by the presenter's toast, not by the offline Alert ([CS] A1: "Transport error → the offline Alert") | "Core service unreachable at …" would be false for a server that answered. Decision 7 |
| D-7 | The Live arrival notice does not ask which route was shown before (the simulator's rule `previousTopLevel === '/_app'`) | `lastSessionEnd` is in memory only and says itself whether an operator was signed in |
| D-8 | The lane database was not reset before the check (the row's rule). The two lane pid files were emptied, not removed, as W50 left them | The row's rules |
| D-9 | This row's own new file `features/login/mode-switch.tsx`, created at 20:52, was split into `use-mode-switch.tsx` and `mode-selector.tsx` a minute later (a lint rule: a file exports components or hooks, not both) and the first version moved to `.cache/w55/`. It was this row's own, new and uncommitted; nothing else was moved | Stated for the record |
| D-10 | `masterplan/02_plan.md`, `status_tasks.md`, `decisions/decisions.md` and `implementation/99_implementation_report.md` were not written | The parallel-run rule of the brief |
| D-11 | No dry-run-verify-fix skill run as a separate step: the delivery path (tests, typecheck, lint) is section 14, run on the finished tree | The brief names the commands |

## 18. Decisions for the controller

| # | Decision | This row's choice | Alternative |
|--:|---|---|---|
| 1 | The red assertion of section 13 | Keep the page as [CS] §5.4 says; change line 398 of W50's test | Narrow the page to "after its own `SNAPSHOT_TIMEOUT`" (leaves [LS] rows 7 and 17 unserved on the Login page) |
| 2 | What "keeps the form filled" means after a 429 (LB-10) beside "the password state is empty once the request is sent" (AC-C-44) | Empty while the request is out; the 429 puts the typed password back | Keep the username only; the operator types the password again |
| 3 | The rows of the Live disclosure | Initials, display name and username from the constant; no chip | Usernames only |
| 4 | Where the presentation follow-up is installed (F77-3) | By the Login page | One line in the root route or the shell, so that a reload inside the shell is covered too |
| 5 | Two copies of the mode-change confirmation (F77-11) | The Login page keeps its own while W54 is not gated | After both rows are gated: the Login page imports `useModeSwitch` from `@/components/shell` and drops `use-mode-switch.tsx`; the test IDs are already the same |
| 6 | The hand-off that is taken back when the session ends before the page was left | Built (section 6) | Leave it to the route guard (the card then stays hidden until a reload) |
| 7 | A 500 on sign-in | The presenter's toast | The offline Alert, by the letter of A1 |
| 8 | A Core server that is starting blocks Sign In on the health answer, asked again every 2 s | As [CS] §3.5 says ("treated as unreachable") | Let the operator try and show the 503 of the attempt only |
| 9 | The offline Alert in Live mode keeps the existing words "Core service unreachable at 127.0.0.1:<port>." with the page's own address | The address is where the console reaches the Core server (the dev server) | A Live wording without an address |
| 10 | F77-4: the footer's "v2.4.1" on a Live page | Reported | An owner for the wording |

## 19. Rollback (not executed)

| Kind | Command or action |
|---|---|
| R-CO (the ten tracked files; none was changed by an earlier row: the pre-image patch against `acaff20`, `.cache/rollback/W55/W55.pre.patch`, is empty, and `.cache/rollback/W55/` holds a copy of each file as it was at 20:33) | `git checkout acaff20 -- apps/core-web/src/features/login packages/shared/src/i18n/en/login.ts` |
| R-NEW | Remove `apps/core-web/src/features/login/{login-live-model.ts,live-adapter.ts,use-mode-switch.tsx,mode-selector.tsx}`, `apps/core-web/src/test/live-login-{signin,page,model}.test.tsx`, this document, its `assets/55_*` and the progress file |
| Order | Both together (the changed files import the new ones). After it `npm run test -w @dems/core-web -- --maxWorkers=2` has no test of this row, and `live-runtime-startup.test.tsx:398` is green again without a change |
| Scratch | `.cache/w55/` (the baseline log, the lane scripts and their output, the mutation runner, the secret scan), `.cache/rollback/W55/`, `.locks/core-server.lane3.{log,vite.log}` and the two empty pid files. All git-ignored |

## 20. Limits of this evidence, and what was not done

- The lane check ran once, with one browser (headless Chromium 153). No second tab and no second
  browser: the found-session cases of section 6 are proven on the fake transport only.
- The lane check ran at 21:15. One production file changed after it: `use-login-controller.ts` at
  21:36:15, where the redundant call of section 15 was removed from Retry (two lines). Retry was not
  pressed on the lane, so what the browser ran there is the finished code in everything it exercised.
- The lockout (423) was not produced on the lane, as the row requires: its countdown is proven on the
  fake transport. Nor were a 429, a 422 or an outage produced on the lane.
- The mode switch was opened and cancelled on the lane, not confirmed (W50's lane check confirmed one).
- The session-restore hypothesis of WS-15 was not tested (section 12.2).
- The hand-off that is taken back has one test (the session ends inside the beat). The other path, a
  session that ends while the card's exit plays, has none: it needs the page to act inside 450 ms of
  real time. It is the same reset, reached from the store listener.
- "A sign-in can stay pending for up to 16 s" ([LS] row 31) is not reproduced with an owed sign-out: the
  page has no timer of its own for it, which is a reading of the code and the assertion of test S
  "success" after 6 s of fake time.
- The row's tests stub the health answer with the global `fetch` (F77-6); the contract check of the
  fake transport does not see it. Its schema is checked by the shared `fetchHealth` itself.

## 21. Follow-up: two granted changes (decision D128)

The controller's gate accepted the build (decision D128, its own run at 21:45) and ruled on the seven
decisions of section 18: (1) and (4) granted as changes outside the row's paths, made here; (2), (3),
(6) and (7) accepted as built; (5) the two copies of the mode-change confirmation are unified after
both rows are gated, not now. The deviations D-2, D-5 and D-6 are accepted; F77-4, F77-5, F77-6 and the
GC-22 note go to the web checkpoint. This section is the two granted changes and nothing else. No lane
run was needed and none was made. Copies of the four files as they were before the first edit of the
follow-up (21:47) are in `.cache/rollback/W55/followup/`.

### 21.1 Change 1: the one assertion of W50's test

`apps/core-web/src/test/live-runtime-startup.test.tsx` (the runtime row's test; nothing else in the file):

```
398c398,399
<     expect({ ...window.sessionStorage }).toEqual(before.session)
---
>     // The Login page hands off a session it did not submit (§5.4, W55), so the shell is really mounted here and writes its own intro marker: nothing about the session.
>     expect({ ...window.sessionStorage }).toEqual({ ...before.session, 'dems.shell.intro': '1' })
```

It stays a closed comparison: the whole `sessionStorage` equals the two keys of before plus the shell's
own marker, and any other key fails it. The file: 22 / 22.

### 21.2 Change 2: the root route installs the presentation follow-up (F77-3, WS-10)

`apps/core-web/src/routes/__root.tsx` (W50's file; W54 does not write it), two added lines, the effect
and the import it needs; nothing else in the file:

```
25a26
> import { followServerPresentationMode } from '@/features/login/live-adapter'
78a80
>   useEffect(() => (live ? followServerPresentationMode(live) : undefined), [live]) // WS-10 (W55, decision D128): on every route, for the lifetime of the root
```

**The one line was enough.** No provider and no order is involved: the function reads the Live source's
store and writes the tab's flag, and the effect stands beside the query bridge's. What had to change was
in the row's own folder:

| File (this row's folder) | Before | After |
|---|---|---|
| `features/login/live-adapter.ts:54-72` | `followServerPresentationMode(live): void`: one subscription per Live source for ever, guarded by a `WeakSet`; nothing could end it | `followServerPresentationMode(live): () => void`: it subscribes and RETURNS the function that ends the subscription. No `WeakSet`: the caller's effect owns the lifetime, so React's mount, clean-up, mount of a dev build leaves exactly one. `fireImmediately` stays: at the installation the setting of an operator who is already signed in is copied at once (the page load that starts inside the shell) |
| `features/login/index.tsx` | The Login page installed it in an effect of its own (`useWebLive()`, `followServerPresentationMode(live)`) | Removed, with its two imports: **exactly one place installs it**, the root route |
| `features/login/sim-adapter.ts`, the two header comments | Said the Login page keeps the flag in step | Say the root route does |

So the follow-up now lives as long as the root route (the page), on every route: `/login`, every page of
the shell, the two administration pages. On the simulator nothing is installed (`live` is `null`).

### 21.3 Tests

A new file, `apps/core-web/src/test/live-login-presentation.test.tsx` (5 tests), and one static test added
to `live-login-model.test.tsx` (25 tests now). The new file wraps the one export with a counter (the real
function runs; `vi.mock` with the original passed through), so "installed" and "ended" are counted where
the root calls them.

| What the controller asked for | Test | What it asserts |
|---|---|---|
| A page loaded directly inside the shell, without passing the Login page, follows the server's presentation mode | "a page load that starts inside the shell" > "follows the server's presentation mode without the Login page ever being shown" | A signed-in console loaded at `/stack-check` with the Core serving `presentationMode: true`: `page-login` was never in the document; the flag is `1` at the load; a `settings` delta to `false` writes `0`, back to `true` writes `1`; after the sign-out the Login page has `data-presentation="true"` and no disclosure; one installation in all, still one active (the Login page added none) |
| | "a setting that is off, with no flag in the tab, writes nothing at the load" | The flag key is absent after the load |
| It is installed once (no double subscription under `StrictMode`) | "installed once" > "under StrictMode the root installs, cleans up and installs again: ONE subscription is left, and one change is one write" | With the router in `StrictMode`: installed 2, ended 1, active 1; one change of the setting is exactly one `setItem` of the flag key, the next one exactly one more; after the root unmounts: active 0, and a later change of the setting (the Live source runs on) is NOT copied |
| | "without StrictMode: one installation for the lifetime of the root, whatever is navigated to" | One installation; after a navigation to `/dashboard` a change is copied; still one |
| Nothing on the simulator | "the simulator" | The Login page on a simulator: 0 installations, no flag |
| Exactly one place installs it | M "WS-10 (decision D128)" (static) | `followServerPresentationMode(` occurs once in `routes/__root.tsx`, in the effect that returns it; in the folder only in the file that defines it; the function's signature returns `() => void` |

The three presentation tests of `live-login-page.test.tsx` (sign in through the Login page; the copy at
the sign-in and on every change; no write for an equal value) pass unchanged: they now exercise the
root's installation.

### 21.4 Verification

The host: 1-minute load 9.54 at 21:50, 8.80 at 21:53, 7.84 at the start of the whole run (below 10, as
required). From the workspace root with no `cd` (`.cache/w55/gate_followup.sh`; the whole output is
`assets/55_followup_gate.log`):

```
load before the run: 7.84 9.31 8.96
## 2026-10-04 21:53:50 WIB $ npm run test -w @dems/core-web -- --maxWorkers=2 --reporter=default --reporter=json --outputFile.json=.cache/w55/web_followup.json
 Test Files  55 passed (55)
      Tests  758 passed (758)
exit=0
## per file, from the JSON report of that run
   55 files, 758 tests, 758 passed, 0 failed; runner success: true
   the new files of this row: 4 files, 77 tests, 77 passed
     src/test/live-login-model.test.tsx: 25 / 25
     src/test/live-login-page.test.tsx: 30 / 30
     src/test/live-login-presentation.test.tsx: 5 / 5
     src/test/live-login-signin.test.tsx: 17 / 17
   the test files of the folder that existed (CLG a): 2 files, 31 tests, 31 passed
     src/features/login/__tests__/login-model.test.tsx: 14 / 14
     src/features/login/__tests__/login-page.test.tsx: 17 / 17
   every file but the new ones of this row: 51 files, 681 tests, 681 passed

## 2026-10-04 21:54:54 WIB $ npm run typecheck -w @dems/core-web
exit=0
## 2026-10-04 21:55:04 WIB $ npm run lint -w @dems/core-web
(no finding, no warning)
exit=0

## CLG (a): $ git diff --stat acaff20 -- apps/core-web/src/features/login/__tests__ | wc -c
       0
## 2026-10-04 21:55:04 WIB listeners on the lane's ports (no lane run in this follow-up): $ lsof -nP -iTCP:4423 -iTCP:5178 -iTCP:9398 -sTCP:LISTEN
lsof exit 1 (1 with no output: no listener)
```

**No file of the run was red, so there is none to name with an owner.** The 51 files that are not this
row's (the 48 of the baseline and three of W54, which is writing `live-shell-*.test.tsx`) pass with all
681 tests. Before the whole run, at 21:50: the row's four files, the folder's two, and W50's start-up and
static test files, 8 files / 139 tests, exit 0.

Ledger: `@dems/core-web` 48 files / 598 tests before the row (20:34); 54 / 752 with one failure at the
hand-in (21:37); **55 / 758, all passed** now. This row: 4 files / 77 tests (71 at the hand-in; the
follow-up added one file with 5 tests and one static test).

### 21.5 Mutation check of the follow-up (M15, in memory)

The same runner (`assets/55_mutations_runner.py.txt`, updated; no file of the tree was changed). The
change I02 of section 15 (the Login page's own installation) is gone with that code. Five changes are
new, two of them in the root route's line. On the follow-up tree, from a green baseline of the six test
files (108 tests):

| Change | In | Detected by |
|---|---|---|
| G01: the root route does not install the follow-up | `routes/__root.tsx` | "follows the server's presentation mode without the Login page ever being shown" (and four more) |
| G02: the root route installs it and drops its clean-up | `routes/__root.tsx` | "under StrictMode … ONE subscription is left, and one change is one write" |
| V04: the setting is not copied at the installation | `live-adapter.ts` | "follows the server's presentation mode without the Login page ever being shown" (the flag at the load) |
| V05: no clean-up is returned | `live-adapter.ts` | Five tests of the new file (the root's unmount ends nothing) |
| V06: one call subscribes twice | `live-adapter.ts` | "under StrictMode …: one change is one write" |
| V01, V02, V03 (section 15), again on the changed file | `live-adapter.ts` | As before; V02 and V03 now also by the new file |
| I03, I05 (section 15), again on the changed file | `index.tsx` | As before |
| S02 (section 15), again (the file's comment changed) | `sim-adapter.ts` | As before |

```
## 2026-10-04 21:50:55 WIB baseline: the six test files of the row, no mutation
baseline exit=0 Test Files  6 passed (6) | Tests  108 passed (108) (17.9 s)
## 2026-10-04 21:52:47 WIB 10 mutations: 10 detected, 0 survived [], 0 not applied []
## 2026-10-04 21:53:35 WIB 1 mutations: 1 detected, 0 survived [], 0 not applied []
```

The row's table now holds 72 changes (68 of section 15, less I02, plus five). Of them, 11 ran on the
follow-up tree and are detected; the other 61 are in files the follow-up did not touch, and their
verdicts of section 15 stand. The whole lines are appended to `assets/55_mutations.log`.

### 21.6 What sections 1 to 20 say that no longer holds

| Section | Statement | Now |
|---|---|---|
| Front matter; 1 | Status needs-review; one failure in the web run | Complete; 55 files / 758 tests, exit 0 |
| 2 | `live-adapter.ts` `followServerPresentationMode` (`:52`); `index.tsx` "the presentation follow-up (`:66-70`)" | The function is at `:54` and returns its clean-up; `index.tsx` installs nothing (its later line references moved up by 9: the take-back `:115-119`, `:125`; `data-core-mode` `:156`; the ring `:142`) |
| 3, WS-10; 11, AC-C-47 | "with the limit F77-3" | No limit: a page load that starts inside the shell is covered (21.3) |
| 10 | "The only values the page writes to web storage are the tab's presentation flag …" | The flag is written by the root route's installation of the row's function; the Login page writes nothing but, through the runtime's `switchTo`, the mode key |
| 13 | The red assertion | Green, by change 1 |
| 15 | I02; "not mutated: `fireImmediately` of the presentation follow-up" | I02 is gone with its code; `fireImmediately` is the change V04, detected |
| 16, F77-1 and F77-3; 17, D-1; 18, decisions 1 and 4 | Open | Closed by the two granted changes |
| 19 | Rollback of ten tracked and seven new files | Section 21.7 adds the follow-up |

### 21.7 Rollback of the follow-up (not executed)

| File | Action |
|---|---|
| `apps/core-web/src/routes/__root.tsx` (tracked; W50 changed it before this row) | Remove the two lines of 21.2, or restore `.cache/rollback/W55/followup/__root.tsx.before` |
| `apps/core-web/src/test/live-runtime-startup.test.tsx` (W50's new file, not tracked) | Restore line 398 as 21.1 shows it, or the copy `.cache/rollback/W55/followup/live-runtime-startup.test.tsx.before`. It is green only while the Login page of section 6 is rolled back with it |
| `features/login/live-adapter.ts`, `features/login/index.tsx` | The copies `…/followup/live-adapter.ts.before`, `…/followup/index.tsx.before` (the row as handed in at 21:43); `sim-adapter.ts` differs in a comment only |
| `apps/core-web/src/test/live-login-presentation.test.tsx` | R-NEW: remove it; and the one static test "WS-10 (decision D128)" of `live-login-model.test.tsx` |
| Order | All together: the root imports the function, and the Login page no longer installs it |

### 21.8 Limits of the follow-up's evidence

- No lane run: the two changes are proven on the fake transport and by the static test. The lane check
  of section 12 ran the row as handed in, where the Login page installed the follow-up itself.
- The root route now imports from a feature folder (`@/features/login/live-adapter`). The function
  could move to `lib/presentation-mode.ts` (not a path of this row) when the web checkpoint tidies the
  layering; the import line is the only thing that would change in the root.
- "Installed once" is counted at the one export (calls and clean-ups) and held by the write count per
  change; the store's own subscriber list is not read.
