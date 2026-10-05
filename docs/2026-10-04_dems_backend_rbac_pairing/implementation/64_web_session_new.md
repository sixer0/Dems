---
task: 2026-10-04_dems_backend_rbac_pairing
row: W64 (step 86; provisional row 67)
agent: coder-execution
date: 2026-10-05
status: needs-review
gate: CLG (a)-(d) + the pending test with fake timers (AC-C-57, AC-C-58)
---

# W64: Web Start New Session in Live mode

Tier 2 log. Sites A3, A4, B-6, C-3, C-4, D-2, D-3 of `masterplan/04_client_integration_spec.md` §8
([CS]), the in-flight marker of the resume effect [CS:FC-7], AC-C-57 and AC-C-58. Work window:
20:19-20:40 (stream stalled), resumed 22:24-23:05. Paths are relative to
`/Users/gsp-budi/Documents/DEMS/`.

## 1. Result

| Item | Result | Evidence |
|---|---|---|
| SG: typecheck, lint of `@dems/core-web` | exit 0, exit 0, no warning (22:57) | `assets/64_gate_tc_lint.log` |
| SG: own tests | 3 new files, 45 tests, exit 0 | `assets/64_live_tests_run.log`, `assets/64_gate_web.log` |
| Whole web suite | **62 files / 855 tests, exit 0** (22:55:36-22:57:05); floor 62 / 853 (controller, 22:46) | `assets/64_gate_web.log` |
| Whole shared suite | **68 / 1,814 exit 0**; typecheck and lint exit 0 (22:57) | `assets/64_gate_shared.log` |
| CLG (a) | the folder's two test files: 2 files / 15 tests exit 0, absent from `git diff --stat acaff20`, hashes equal to the pre-images | `assets/64_gate_clg.log`, `assets/64_baseline_folder.log` |
| CLG (b) | one Live test per site, each with success, the refusal (403 by its example `notPermitted`, the denied toast naming the role) and an outage | section 4 |
| CLG (c) | no `useSimActions`, no `.actions` read in the folder's production files: `grep` exit 1, and a static test with its own negative control | `assets/64_gate_clg.log`; `live-session-new-pending.test.tsx` |
| CLG (d) | lane 1, 76 s + 31 s + 9 s, three screenshots of Live, one of Simulated; all listeners stopped | section 6 |
| Pending test (AC-C-57, AC-C-58) | 1 s answer: one request for three presses, no spinner at 300 ms, the in-button spinner at 500 ms, no element added outside; 50 ms answer: no spinner | section 4.3 |
| Mutation check (M15) | 24 mutations, 24 detected (3 after closing test gaps, all logged) | section 7 |

Status `needs-review` only for the decisions of section 11 (none blocks).

## 2. What was built

| File | What | Why |
|---|---|---|
| `apps/core-web/src/features/session-new/index.tsx:145-147` | `useCoreActions()` replaces `useSimActions()`; `useCoreMode()`; `useCoreErrorPresenter()` | Rule 1 and rule 2 of `gateway_check/08_cp_web_runtime.md` §8 |
| `index.tsx:183-192` | `createInFlight`, `precheckInFlight` (FC-7), one `usePendingControl()` per control that sends a command | A3 double submit; FC-7; LB-1 |
| `index.tsx:227-242` | The resume effect through `settle`; returns at once while `precheckInFlight` holds the session's ID; `done` clears it | B-6, FC-7 |
| `index.tsx:246-254` | `beginPrecheckOnce(id)`: the same marker for the pre-check of `createAndCheck` | D-3 never overlaps the resume effect |
| `index.tsx:258-291` | `createAndCheck`: `await` the create, the cancel and the second create (D-2), read the state after the awaited create (C-3), `await` the pre-check before step 2 (D-3); a Live 403 goes to the presenter (line 274); the catch hands the error to the presenter first | A3, C-3, D-2, D-3; CL-26; AC-C-48 |
| `index.tsx:294-310` | `scan`: LB-1 on the scan button, the field written in `ok` | A4 |
| `index.tsx:312-344` | acknowledge (`goTo(3)` in `ok`), retry (the acknowledgement reset in `ok`), each through `settle` and LB-1 | B-6 |
| `index.tsx:346-370` | `startNow`: the ID read before the call (C-4); toast and `/session` in `ok`; `startedHere` reset in `fail` | B-6, C-4 |
| `index.tsx:392-421` | `leave()`; `confirmCancel` with LB-1 on the dialog's confirm, leaving in `ok`, the dialog open on a refusal | B-6, LB-6 |
| `features/session-new/use-pending-control.ts:39-97` | LB-1 hook: in-flight flag, `aria-busy` on the control (line 64, through a ref), the kit's pending state after `LIVE_PENDING_REVEAL_MS` × the motion time scale; nothing at all when the command settled before `run` returned (line 86) | LB-1; Simulated mode unchanged |
| `features/session-new/sim-adapter.ts:29-50` | `scanCaseNumber(actions, readState, onRefused)`: no `.actions` on a `Sim`; a rejected Live answer goes to `onRefused` (the presenter), then the replica's next number | A4; CLG (c) |
| `features/session-new/log.ts:29-63` | Records go to the page's own log (`webErrorSink`), message a fixed sentence, context = caller's facts + the error's class, code, status, reason; stack frames without the first line | Mandatory persistent log; CPW1-8 discipline |
| `features/session-new/devices-step.tsx:89-90, 173-174` | Live only: a blocked `CORE` check gets the sentence of F69 (`sessionNew.live.coreLinkHint`); "Clear the fault" is left out when the core link is the only block | F69 asks this row to word the blocked pre-check clearly |
| `devices-step.tsx:197`, `info-step.tsx:156-159`, `ready-step.tsx:149`, `cancel-dialog.tsx:38` | `isPending` and the `Spinner` in place of the icon (Re-run, scan, Start); the Discard confirm gets the Spinner before its label | LB-1 "the spinner replaces the button's icon, so nothing moves" |
| `packages/shared/src/i18n/en/session-new.ts:190` | `sessionNew.live.coreLinkHint` (additive) | F69 wording |

Every new prop defaults to the value that renders the Simulated markup unchanged (`false`,
`undefined`); a test asserts the Simulated Devices step keeps its own wording.

## 3. Site by site

| Site | Simulated mode | Live mode |
|---|---|---|
| A3 `createSession` | as before; each awaited value is already there | awaited; "Creating session…" from the press (LB-2); 409 with a setup session seen before → D-2; 403 → the presenter's denied toast "Not permitted / Requires the Investigator role"; 401, 409 (E5), 422 → the existing toast per reason (F59: the server's 422 is shown, the form keeps its own bounds); outage → "Core server unreachable. Nothing was changed." |
| C-3 | unchanged | the state is read after the awaited create, so the replica holds the Core's session (CL-16); a session already in PRECHECK gets no pre-check |
| D-2 | unchanged | `cancel` awaited before the second create; a refused or failed cancel stops the sequence |
| D-3 | unchanged | step 2 opens only after the pre-check settled (answer and delta) |
| A4 `scanCaseNumber` | as before (a throw falls back silently) | LB-1 on the scan button; refusal or outage → the presenter, then the replica's next number |
| B-6 resume | as before | one request per session while in flight (StrictMode runs the effect twice on a mount at `?step=2`) |
| B-6 acknowledge, retry, start, cancel | as before | LB-1 per control; continuation in `ok`; the presenter first in `fail`; a refused cancel keeps the dialog open |
| C-4 | unchanged | the ID read before the call names the session in the toast |

## 4. Tests

### 4.1 Files

| File | Tests | What |
|---|---:|---|
| `apps/core-web/src/test/live-session-new-create.test.tsx` | 16 | A3 (with E5), C-3, D-2, D-3, A4 |
| `apps/core-web/src/test/live-session-new-precheck.test.tsx` | 16 | B-6 resume (FC-7), acknowledge, retry (and the F69 wording), start with C-4, cancel |
| `apps/core-web/src/test/live-session-new-pending.test.tsx` | 13 | AC-C-57, AC-C-58; LB-1 on Next (step 2), Re-run, Start, Discard; CLG (c) with its negative control; the Devices step in both modes |
| `apps/core-web/src/features/session-new/__tests__/live-session-new-bed.ts` | helper | W50's harness, a simulator standing for the Core's engine (`createCoreDriver`), the deltas of each command (`sessionOps`), `clearToasts()`, toast queries scoped to `[data-slot="toast"]`, the jsdom media stubs |

Every Live file carries the docblock page address `http://127.0.0.1:5178/` (rule 5), calls
`clearToasts()` (which also resets the presenter's coalescing) before and after each test, scripts
every request (the bed's `dispose()` fails on an unscripted one), and names each 403 by its example
`fake.example(op, 403, 'notPermitted')`. Health comes from the bed. Refusal and outage tests also
assert that the page's own fallback toast does NOT appear (the presenter words it, LB-5).

### 4.2 Site to test (AC-C-56)

| Site | Success | Refusal | Outage |
|---|---|---|---|
| A3 | `A3 … success: the create is sent once …` (two presses, one create) | `A3 … refusal: a 403 shows the denied toast …` | `A3 … outage: the offline toast of LB-6 …` |
| C-3 | `C-3 … success: the Core answers 200 for a session it already holds in PRECHECK …` | `C-3 … refusal …` | `C-3 … outage …` |
| D-2 | `D-2 … success: create 409, cancel, create, pre-check, in that order …` | `D-2 … refusal: the cancel is refused (403) …` | `D-2 … outage …` |
| D-3 | `D-3 … success: step 2 is shown only after the pre-check settled …` | `D-3 … refusal …` | `D-3 … outage …` |
| A4 | `A4 … success …` | `A4 … refusal …` (fallback number) | `A4 … outage …` |
| B-6 resume | `B-6 the resume effect … success: StrictMode runs the effect twice, ONE request …` | `… refusal …` | `… outage …` |
| B-6 acknowledge | `B-6 acknowledgePrecheckWarnings … success` | `… refusal` (no navigation to step 3 is even started) | `… outage` |
| B-6 retry | `B-6 retryPrecheck … success` | `… refusal` | `… outage` |
| B-6 start, C-4 | `B-6 startRecording and C-4 … success: the toast names the ID read before the call …` | `… refusal` | `… outage` |
| B-6 cancel | `B-6 cancel … success` | `… refusal: … the dialog stays open` | `… outage` |

### 4.3 The pending test (AC-C-57, AC-C-58)

The control is the scan button (A4: a second request would reserve a second case number). The
page's `setTimeout` is faked (`vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })`); the
answer is held on the fake transport and released at 1,000 ms.

| Step | Asserted |
|---|---|
| Two presses | one `scanCaseNumber` request; `aria-busy="true"` on the button; its markup unchanged |
| 300 ms | no `[data-slot="spinner"]` in the button, no `data-pending`, a third press sends nothing |
| 500 ms | the Spinner in the button, `data-pending="true"`, one child (the icon replaced), no element added outside the button (a `MutationObserver` on `body`) |
| 1,000 ms, the answer | the reserved number in the field, no Spinner, no `aria-busy`, still one request, still nothing added outside |
| 50 ms answer | the Spinner never appears (a `MutationObserver` inside the button), one request |
| A focused press | the only elements added outside are inside React Aria's visually hidden live announcer (1 px, absolute, clipped): finding F64-2 |

The same sequence runs on Next at step 2, Re-run, Start and the Discard confirm (outage released).

## 5. Verification (quoted)

```
$ npm run test -w @dems/core-web -- src/features/session-new      (baseline, before the first edit, 20:28)
 Test Files  2 passed (2)
      Tests  15 passed (15)
exit 0

$ npm run test -w @dems/core-web -- src/test/live-session-new- --reporter=verbose    (23:01, the final tree)
 Test Files  3 passed (3)
      Tests  45 passed (45)
exit 0          (every test name: assets/64_live_tests_run.log)

$ npm run test -w @dems/core-web -- --maxWorkers=2                (22:55:36)
 Test Files  62 passed (62)
      Tests  855 passed (855)
exit 0

$ npm run typecheck -w @dems/core-web      (22:57:12)  > tsc -b   exit 0
$ npm run lint -w @dems/core-web                       > oxlint   exit 0

$ npm run test -w @dems/shared -- --maxWorkers=2                  (22:57)
 Test Files  68 passed (68)
      Tests  1814 passed (1814)
exit 0          typecheck exit 0, lint exit 0

$ git diff --stat acaff20 -- apps/core-web/src/features/session-new/__tests__/session-new.test.tsx …/session-new-model.test.tsx
exit 0 (no output: both files unchanged)          hashes 1fef4f88…, 1a295f1d… = the pre-images

$ npm run test -w @dems/core-web -- src/features/session-new      (22:58:06, CLG a after the change)
 Test Files  2 passed (2)
      Tests  15 passed (15)
exit 0

$ grep -rnE "useSimActions|[A-Za-z_)\]]\.actions\b" apps/core-web/src/features/session-new --exclude-dir=__tests__ | grep -v "common\.actions\."
grep exit 1 (1: no match)

$ git status --porcelain -- apps/core-web/src/runtime apps/core-web/src/components/shell apps/core-web/src/routes apps/core-web/src/lib apps/core-web/vite.config.ts
(no lines: untouched)       W01's two files still print 9e8b97c8…, 71f6f033…
```

All load averages before a whole suite were below 10 (5.23 at 22:55, 5.48 at 22:57).

## 6. Lane check (CLG d)

Lane 1 only: backend `127.0.0.1:4421` on `dems_lane_1` (no reset; the paired phone `DEV-0001` and
every emulator untouched; the phone app not running, so the Core link is OFFLINE), Vite
`127.0.0.1:5176` in Live mode, headless Chromium 153 on DevTools `127.0.0.1:9396`; W50's lock
(`/usr/bin/lockf -k -t 900 .locks/core-server.lane1.lock …`) and pid files; the demo flag off.
PostgreSQL was only reached on 4432. Scripts: `assets/64_lane_run_lane.sh.txt`,
`assets/64_lane_cdp_driver.mjs.txt` (the sign-in through the form with the seeded SUPERVISOR read
from `packages/shared/src/sim/dataset.ts`; the password is never printed or written; a final pass
blanks it and any `ses_/dvc_/bio_` value from the JSON).

| Run | Window | Shows |
|---|---|---|
| 1 | 22:40:11-22:41:28 (76 s) | the whole Live sequence; its Simulated step stopped at the Simulated Login (F64-5) — kept as `64_lane_run_first.log`, `64_lane_browser_first.json` |
| 2 | 22:43:29-22:44:00 (31 s) | the same Live sequence, with the blocked Alert scrolled into view: `64_lane_run.log`, `64_lane_browser.json` |
| Simulated follow-up | 22:42:45-22:42:54 (9 s) | Vite and the browser only, no backend: `64_lane_run_simulated.log`, `64_lane_browser_simulated.json` |

What the browser recorded (run 2; method, path, status; no body):

| Step | Requests of the page | Facts |
|---|---|---|
| Sign-in through the form | `GET /api/v1/auth/session 401`, `GET /auth/status 200`, `GET /health 200`, `POST /auth/sign-in 200` | Dashboard shown |
| `/session/new` (`64_session_new_live.png`) | `GET /auth/session 200` | step 1, shell `data-core-mode=LIVE`, case number `maxLength` 17, subject name 120, Next disabled |
| Client-side bounds (`64_session_new_live_bounds.png`) | none | "Use the case format LP/YYYY/MMDD-NNNN." inline, Next disabled: nothing sent (F59) |
| Scan (A4) | `POST /api/v1/session/case-number 200` | the Core's reserved number in the field |
| Next (A3, D-3) | `POST /api/v1/session 201`, `POST /session/SES-20261005-0025/precheck 202` | step 2, `PRECHECK`, 8 of 8 checks, `CORE` = BLOCK |
| The Core's verdict (`64_session_new_live_core_refusal.png`, `…_top.png`) | — | Alert: "Recording is blocked. Resolve these checks before continuing: Core link offline." + "No paired tablet is connected to the Core server. Open the DEMS app on the paired tablet so that it connects, then re-run the checks."; Next disabled; no "unreachable" anywhere; LIVE indicator |
| Evidence only, NOT the page: a start of the session by `fetch` in the page's context | `POST /session/SES-20261005-0025/start 409` | `PRECHECK_BLOCKED`, "Start blocked: Core link offline" (F69 at the API) |
| Re-run (B-6) | `POST /session/…/precheck/retry 202` | the checks ran and blocked again |
| Cancel (B-6) | `POST /session/…/cancel 204` | "Session discarded.", Dashboard |
| Sign-out | `POST /auth/sign-out 204` | Login page |
| Simulated (`64_session_new_simulated.png`) | none to `/api/v1` | step 1, `data-core-mode=SIMULATED`, no `aria-busy`, no Live sentence |

Console: no error or warning in any step. Backend: every route as above; 0 credential-shaped values
and 0 error lines in its log. After each run `lsof` on 4421, 5176, 9396 printed nothing (exit 1).
`dems_lane_1` changes, both runs: `audit_log` 103 → 110 → 116, `auth_sessions` 3 → 4 → 5,
`events` 92 → 102 → 110, `health_snapshots` 13 → 14; every session created was cancelled; the
pairing rows unchanged (1 / 1).

## 7. Mutation check (M15)

`assets/64_mutations_runner.py.txt`, `assets/64_mutations_config.mts.txt` (W55's config, names
changed): one text replacement in one module, applied in memory by a transform plugin; a marker
file under `$TMPDIR` proves it ran; no file of the tree is written. Log: `assets/64_mutations.log`.

| Batch | Result |
|---|---|
| 22:47 P01-P08 | 6 detected; **P01** (FC-7 marker ignored) and **P07** (double submit) survived: the FC-7 test reached step 2 by a navigation, so StrictMode never ran the effect twice on mount; no test pressed Next twice. Tests fixed (mount at `?step=2`; two presses) |
| 22:50 P01, P07 again | 2 detected |
| 22:51 P09-P16 | 6 detected; **P10** (step 3 asked before the acknowledgement settled) survived, because the model's own `effectiveStep` refuses step 3 before ARMED. Test fixed (records every navigation the router starts) |
| 22:53 P10 again | detected |
| 22:53 H01-H05, S01, S02, D01, D02 | 9 detected |

24 of 24 detected. The static scan (CLG c) reads files on disk, which an in-memory mutation cannot
reach: its negative control is a test of its own (a property read is seen, an i18n key is not).

## 8. Contract gaps found

None. Every request of the page is an operation of the registry with the answers the page needs;
nothing is simulated in Live mode and no `SIM-GAP` or `CONTRACT-GAP-W64-<n>` marker was added.

## 9. Findings

| ID | Finding | Evidence | For |
|---|---|---|---|
| F64-1 | The kit's `Button` drops `aria-busy` (React Aria passes only `data-*`, `id` and a fixed list). This row writes the attribute on the button element through a ref; React never manages it there. Same root as W63's F63-2, another placement (section 11, DN-1) | `node_modules/react-aria/dist/private/utils/filterDOMProps.mjs`; `use-pending-control.ts:61-65`; mutation H04 | controller |
| F64-2 | When a FOCUSED button turns pending, React Aria prepends a visually hidden live announcer to `body` (1 px, absolute, clipped) and announces the pending state. It moves nothing; a pointer press in jsdom adds nothing at all. AC-C-58 holds in its intent (layout); the test states the exception explicitly | `react-aria/dist/private/live-announcer/LiveAnnouncer.mjs:44-70`; pending test "a focused press" | W87, W100 |
| F64-3 | A3's text keeps "the existing toast per reason" for a 403, AC-C-48 asks for the denied toast naming the role. Live mode follows AC-C-48 (the union reason `NOT_PERMITTED` goes to the presenter as `SimPermissionError(SESSION_START)`); Simulated keeps "Your role cannot start sessions." (unreachable there: the route guard) | `index.tsx:274` | DN-2 |
| F64-4 | F69 in a real browser: the Core accepts the create (201) and the pre-check (202); the pre-check ends BLOCK "Core link offline"; Next stays disabled, so the page never sends the start the Core would refuse (409 `PRECHECK_BLOCKED`, shown by a probe). The Core's verdict reaches the page as replicated state, worded by the Devices step; the presenter declines it by design (row 14 of `lib/core-errors.ts`). It is never shown as an outage | section 6 | W86 (README), W94 |
| F64-5 | On a lane, the Simulated Login refuses a sign-in while mock-core (4400, off limits) is unreachable (`use-login-controller.ts:132`, `coreBlocked`). The Simulated screenshot used the simulator's stored sign-in (`sessionStorage['dems.auth']`, operator ID and time, no credential), as W63's DV-2 (F63-3) | `64_lane_browser_first.json` step `simulated`; `64_lane_browser_simulated.json` | controller (known) |
| F64-6 | Page rows build their own LB-1 helper: this row's `use-pending-control.ts`, and in parallel `features/evidence/use-pending-action.ts` (W69). One shared hook outside the page folders would keep LB-1 identical everywhere | `git status` at 22:55 | DN-5 |
| F64-7 | FC-7's realistic trigger in this page is a mount at step 2 (a reload on step 2) under StrictMode, which runs the effect twice; a navigation from step 1 runs it once. The marker is also shared with `createAndCheck`, so a back/forward to `?step=2` while the create's pre-check is out cannot send a second one | mutation P01 history | W87 |
| F64-8 | The subject-type `ToggleButtonGroup` deselects on a second press of the selected type (existing behaviour, not changed here); the Live tests leave it when it is already chosen | `live-session-new-bed.ts` `fillForm` | info |
| F64-9 | At 22:26 one `npm run typecheck -w @dems/core-web` exited 2 with no `error TS` line captured; the next four runs exited 0. Another row's new test file (`live-dashboard-devices.test.tsx`, W63) was being written at that minute | section 5 | info |

## 10. Deviations

| ID | Deviation | Why / effect |
|---|---|---|
| DV-1 | Two read-only commands at 20:28 and 20:31 used `cd` (building the pre-image tar; dumping the contract examples), against "never `cd`" | Nothing was written outside `.cache/`; no further `cd` |
| DV-2 | The test helper is `features/session-new/__tests__/live-session-new-bed.ts`: inside the row's path `features/session-new/**`, not a `*.test.*` file, so Vitest does not collect it | `src/test/` grants only `live-session-new-*.test.tsx` |
| DV-3 | Logging: `log.ts` writes the page's own log (`webErrorSink`) in both modes, instead of the console in dev builds only; the message is a fixed sentence, not the error's text | Mandatory persistent log (D3/D4/D41(g): no client endpoint); invisible to the operator |
| DV-4 | In Simulated mode, a `SimPermissionError` in a `fail` branch (unreachable: the route guard keeps roles without SESSION_START out) is now worded by the presenter (the denied toast) before the page's generic toast | LB-5 and §6.2 put the presenter first in every `fail` branch; every reachable Simulated path is unchanged (CLG a green) |
| DV-5 | `createAndCheck` awaits each action in both modes (CL-26), so Simulated mode gets microtask turns between create, cancel and pre-check | No paint happens between microtasks; the folder's tests unchanged and green |
| DV-6 | The lane check ran the Live sequence twice (the second to bring the Alert into view), plus a 9 s Simulated follow-up; each Live run created and cancelled one session on `dems_lane_1` and reserved one case number; one start probe by `fetch` (not the page) for F69's evidence | Section 6 lists the row-count changes; nothing reset, no device touched |
| DV-7 | The busy mark is on the button (ref), not on a container as W63 did (D152 note) | DN-1 |

## 11. Decisions for the controller

| DN | Question | Default if not ruled |
|---|---|---|
| DN-1 | Keep `aria-busy` on the button through a ref (LB-1 literally: "the control is marked `aria-busy`"), or move it to the nearest container as W63 did (F63-2) | keep: the attribute is on the control, tested, and mutation H04 proves the tests see it |
| DN-2 | Accept F64-3: a Live 403 on create shows the presenter's denied toast; Simulated keeps its sentence | accept (AC-C-48) |
| DN-3 | Accept DV-4 (the presenter first in every `fail` branch, both modes) | accept (LB-5, §6.2) |
| DN-4 | Ledger after this row: web 62 files / 855 tests at 22:57 (other rows were adding files; Vitest listed 65 files at 22:58), shared 68 / 1,814 | record |
| DN-5 | F64-6: one shared LB-1 hook for every page row, in a slot outside the page folders | for W87 or a controller slot |
| DN-6 | `sessionNew.live.coreLinkHint` is the wording of F69 on the web; W86's README may quote it | note |

## 12. Rollback (not executed; class R-CO + R-NEW)

Pre-images: `.cache/rollback/W64/files/pre-images.tar`, hashes in
`.cache/rollback/W64/pre-image-hashes.txt`; every tracked file of the row was equal to `acaff20`
(and to `b90a3c6`) before the first edit.

```
git checkout acaff20 -- apps/core-web/src/features/session-new packages/shared/src/i18n/en/session-new.ts
rm apps/core-web/src/features/session-new/use-pending-control.ts \
   apps/core-web/src/features/session-new/__tests__/live-session-new-bed.ts \
   apps/core-web/src/test/live-session-new-create.test.tsx \
   apps/core-web/src/test/live-session-new-precheck.test.tsx \
   apps/core-web/src/test/live-session-new-pending.test.tsx
```

The lane changes in `dems_lane_1` (audit and event rows, two cancelled sessions, two sign-ins) are
append-only history and are not rolled back.

## 13. Limits of this evidence

- The pending test runs in jsdom with a pointer-free press; in a real browser a mouse press focuses
  the button, so F64-2's announcer appears there. Not measured on the lane (the answers came back
  well under the reveal time, so no spinner showed).
- The start, acknowledge and Session Monitor paths were not driven on the lane: with the Core link
  OFFLINE (F69) the pre-check blocks, so step 3 is unreachable there. They are covered on the fake
  transport only; W65 / W94 run a recording on a lane with the tablet.
- Live tests that end on another row's page (`/session`, `/dashboard`) answer that page's requests
  from the contract's examples (`answerAllFromExamples()` before the press) and count this row's
  operations explicitly, so the in-progress pages of W63 / W65 cannot fail this row's tests.
