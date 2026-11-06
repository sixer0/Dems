---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: W81 (plan step 103)
agent: coder-execution
date: 2026-10-06
status: complete
evidence_tier: 2
source_plan: masterplan/02_plan.md:755
---

# W81 — Web Paired Devices (new page)

Plan row W81 [CS:§10.3]: issue a pairing code with the digits, the QR and the countdown; cancel; list;
revoke with a reason. Rev 2: the code is dropped from memory on sign-out, on `session.ended` and on the
loss of `PAIRING_MANAGE` (PG-6a). Requirement IDs: Q8, TD-11, CA-10, AC-C-92..99, AC-C-106, AC-C-107,
SD-20, SD-23. Code is cited as `path:line` from `/Users/gsp-budi/Documents/DEMS/`; `[cmd]` marks a fact
read by a command of this row. No pairing code, password or other secret appears in this document: the
tests use the bed's marker constant `MARKER_CODE`, and the one code issued on lane 3 was never written
anywhere (section 5.3).

## 1. Result

| Gate item | Result | Evidence |
|---|---|---|
| SG: typecheck and lint of `@dems/core-web` | exit 0, exit 0, no warning | `assets/81_gate.log` (02:20) |
| SG: own tests | 5 files / 72 tests pass | `assets/81_gate.log` |
| Whole web suite | **93 files / 1,244 tests, exit 0** (floor 93 / 1,242 at 02:14, decision D176) | `assets/81_gate.log` (02:17:56–02:20:02, load 1.84) |
| `@dems/shared` | 68 / 1,814 exit 0; typecheck 0; lint 0 | `assets/81_gate.log` |
| CLG (a) existing tests | The folder had no tests. The three other rows' files this page made red (W54's `live-shell-admin`, W70's `live-devices-drawer`, W0's `live-pending-control`) are green unchanged after W0's harness change (D172); none of them was edited | sections 6.2, 8 |
| CLG (b) render tests per command | issue, cancel, revoke: success, the 403 by `notPermitted`, an outage, a 429 as a limit; the reads: 403 → Forbidden, outage → Error + Retry, 429 → limit | section 4 |
| AC-C-106 / AC-C-107 code-memory tests | storage, URL, query cache, error sink, console, sign-out, `session.ended`, permission loss, a second operator on the same page load | section 4.3 |
| CLG (c) | no `useSimActions`, no `.actions` read on a `Sim` | section 6.3 |
| CLG (d) lane 3 | one code issued (digits and QR masked before the screenshot), countdown, cancelled, list shown; 23 s; ports free after | section 5 |
| Mutation check (M15, in memory) | 27 of 28 detected; the survivor is equivalent | section 7 |

## 2. What was built

### 2.1 Files

| File | Lines | Role |
|---|--:|---|
| `apps/core-web/src/features/paired-devices/index.tsx` | 119 | The page (`PairedDevicesPage`, root `page-paired-devices`, W54's contract): Simulated → `LiveOnlyState` in the page's own grid (F76-12, `:43-47`); Live → header with the summary chip, the Forbidden state (`:67-79`) or the two panels (`:82-85`) |
| `.../model.ts` | 205 | Pure rules: the issue-panel state (`issuePanelState`, `:96`), the newest close reason in the replica (`closedReasonOf`, `:127`), the countdown (`:139-164`), filter, order, header counts, "last seen" (`:167-205`) |
| `.../code-memory.ts` | 167 | The ONE place the code lives: an entry per query client (`WeakMap`), the PG-6a subscription made with the code (`:82`) |
| `.../live-data.ts` | 148 | Operations 16 and 19 as queries under `CORE_QUERY_KEYS` (`:88`, `:103`), enabled only Live + signed in + link up + `PAIRING_MANAGE` (`:72`); operations 15, 17, 20 as calls that reject with the failed call (`:124-142`) |
| `.../issue-panel.tsx` | 356 | "Pair a device" (hero): Idle, Issuing, Active code known / not known, Redeemed, Expired, Closed, Cancelled elsewhere, Error |
| `.../code-display.tsx` | 119 | The digits (`TextScramble`, revealed once), the QR (`QRCodeSVG` with the answer's `qrPayload`, `:64`), the countdown with the hairline |
| `.../devices-panel.tsx` | 308 | "Devices": filter, kit `Table`, loading / empty / error, highlight of a new row, CONTRACT-GAP-W70-1 refresh (`:56-57`) |
| `.../revoke-dialog.tsx` | 160 | The revoke `AlertDialog` with a mandatory reason |
| `.../panel.tsx`, `.../choreography.ts`, `.../report.ts`, `.../paired-devices.css` | 108, 40, 26, 360 | Feature-local panel with error boundary (PG-7), enter beats (PG-9), the page reporter `createPageReporter('pair')` (`report.ts:13`), styles |
| `packages/shared/src/i18n/en/paired-devices.ts` | 121 | Additive: `summary`, `issue.*`, `devices.*`, `revoke.*`, `toasts.*`, `states.forbidden`, `states.toDashboard`; no existing key changed |
| `.../__tests__/pd-bed.tsx`, `model.test.ts`, `code-memory.test.ts`; `apps/core-web/src/test/live-paired-devices-{issue,list,memory}.test.tsx` | 278, 169, 101; 439, 427, 391 | Tests (section 4) |

No dependency was added: `qrcode.react` 4.2.0 was already in `apps/core-web/package.json` [cmd].

### 2.2 Where the code may live (AC-C-96, AC-C-106, AC-C-107; rule 4)

| Place | What this page does | Proven by |
|---|---|---|
| Memory | `holdCode` keeps the answer of operation 15 (`code-memory.ts:106`), keyed by the page load's query client; dropped by a new issue, "Cancel code", a redeem, a close, a replacement elsewhere and by the PG-6a clearing | `code-memory.test.ts`; memory file |
| Query cache | Never. The issue is no `useMutation` (the mutation cache stays empty); `['core','pairing-code']` holds operation 16's status, which has no code | "AC-C-96" (cache + mutation cache scanned) |
| Web storage, URL, clipboard | Never | "AC-C-96"; lane: `storageAndUrlHits: 0` |
| Toast, record, translation | Never: the digits are rendered as text by `CodeDigits` only; no toast on issue; records carry fixed sentences, codes by ID (`PCD-…`), lengths (`report.ts:1-10`) | "AC-C-107"; mutants M11–M13 |
| PG-6a | `onCoreQueriesCleared(queryClient, …)` is subscribed while anything is held (`code-memory.ts:82`) — also while the operator is on another page | "AC-C-106" five tests |

### 2.3 The issue-code panel (§10.3)

`issuePanelState` (`model.ts:96`), for a held code: (1) the registry holds a device paired with it →
Redeemed; (2) a status read AFTER the issue names another active code issued no earlier → Active, code
not known (`:102`); (3) the replica's newest `PAIRING_CODE_CLOSED` of it → Expired / Closed /
Cancelled elsewhere, or Idle for this page's own cancel; (4) its time over on the Live clock →
Expired; (5) otherwise Active, code known. Without a held code: Redeemed for 4 s, then the status
(unless it still names the code whose end this page knows, `:115`), then a kept outcome.

Rule (2)'s freshness count (`HeldCode.statusCount`, the cache's `dataUpdateCount` at the issue) and the
`endedHere` rule were added after the first test run: a status answer read BEFORE the issue (the
previous code still in the cache), or still naming a code that had just ended, overrode what the page
knew (two red tests, run 1; mutants M01, M08, M26 now detect a regression).

Issue and cancel are presses on `usePendingControl()` with `ref` on the pressed kit `Button`
(row W0 §15). Failures go to the presenter first (rule 2): a 403 shows the denied toast and the
control returns to Idle; a 429 is a limit, no Error state (LB-10); an outage, a time-out, a 500, a
refused origin show the presenter's toast AND the panel's Error state with a Retry on the shared
cooldown (`issue-panel.tsx:22-29`, `:106-122`); a time-out also re-reads the status (an issued code
then shows as "Active, code not known"). The QR receives the answer's `qrPayload` as it arrived
(`code-display.tsx:64`, level M, `boostLevel` off, 200 px, quiet zone 4). The countdown is minutes and
seconds in `SlidingNumber` on the Live clock (`useSim(s => s.clock.now)`), a hairline that shrinks with
`scaleX`, gold / amber from 60 s / red from 15 s with one halo per step; a screen reader gets
"Expires in m:ss" (`role="timer"`).

The digits are revealed once by `TextScramble`; the reveal is recorded at their first showing and
whether a mount scrambles is decided at mount, so a later mount (another page and back, a re-render
of the route) shows them at once (`code-display.tsx:27-50`).

### 2.4 The device list and the revoke dialog

Operation 19's raw `PairedDeviceList` under `CORE_QUERY_KEYS.pairedDevices` — the entry the Devices
drawer shares (D156 (3)); the list test asserts the cached value equals the answer. PAIRED first, then
newest `pairedAt`; filter All / Paired / Ended; columns of §10.3; a static online dot; "Last seen" every
30 s on the Live clock, without a request. A new row gets the gold highlight (an overlay's opacity,
`HIGHLIGHT_FADE_MS`); PAIRED → REVOKED plays one halo. CONTRACT-GAP-W70-1 (D156 (2)): a change of
`tabletLink.changedAt` re-reads the list through `deferEffectStart` (`devices-panel.tsx:50-59`).

Revoke: reason validated on submit with the page's own words (`validationBehavior="aria"`, so the
browser's empty-field check does not pre-empt it, `revoke-dialog.tsx:135`); 200 → the answer's device is
written into the entry, refetch, toast "{{id}} revoked"; 422 `INVALID_REASON` → the field's error; 422
`INVALID_INPUT` → "Describe it in other words" (CONTRACT-GAP-W32-2); 409 / 404 → info toast, close,
refetch; 403 → denied toast, close (PG-11); outage, time-out, 429 → the presenter's words, the dialog
stays with the reason (LB-6, LB-7, LB-10). The reason is never logged, only its length.

### 2.5 States (§10.1)

Live mode only (`pd-live-only`, inside `.pd-grid > .pd-state-cell`), Loading (three skeleton rows),
Empty, Error with Retry (`pd-error`, `pd-retry`), Forbidden (`pd-forbidden` with a link to the
Dashboard; one denied toast for both reads, `live-data.ts:74-84`), Offline (last data stays, "Revoke…"
and "Issue pairing code" disabled).

## 3. Requirement → test

| ID | Test (file → describe / it) |
|---|---|
| AC-C-92 | issue → "AC-C-92" (stub records `value` = answer's `qrPayload` = prefix + digits shown; real `QRCodeSVG` case) |
| AC-C-93 | issue → "AC-C-93" (61 → 60 → 15 → 1 → expired; `EXPIRED` row in the replica) |
| AC-C-94 | issue → "AC-C-94" (no second issue beside an active code; cancel → `POST …/code/cancel`, Idle, toast) |
| AC-C-95 | issue → "AC-C-95" (issuer name, "expires in 4:00", no digits; "Issue new code"); memory → "a reload does not" |
| AC-C-96 | memory → "AC-C-96" (storage, URL incl. every URL the fake saw, query + mutation cache) |
| AC-C-97 | issue → "AC-C-97" (Paired chip, device text, digits gone, new row highlighted, Idle after 4 s) |
| AC-C-98 | list → "AC-C-98" (seven tests) |
| AC-C-99 | list → "AC-C-99" (seven tests); issue → refused issue |
| AC-C-106 | memory → "AC-C-106" (sign-out with the cache state in the turn of the clearing; `session.ended`; without `PAIRING_MANAGE` before the guard leaves; without `USER_ADMIN`; the code held on another page and a second operator on the same page load) and D176's "no read after the sign-out" |
| AC-C-107 | memory → "AC-C-107" (marker password sign-in + issue + failures: no marker, no code, no `ses_`/`dvc_`/`bio_` in either sink or the console; a contract-violating answer leaves no digits in a sink) |
| AC-C-48 / LB-10 | the 403 by `notPermitted` and the 429 of every command and read |
| SD-23 | every memory test issues the marker and scans for it |

## 4. Tests (CLG (b))

`[cmd]` at 02:20 (`assets/81_gate.log`): `Test Files 5 passed (5)`, `Tests 72 passed (72)`.

| File | Tests |
|---|--:|
| `src/test/live-paired-devices-issue.test.tsx` | 20 |
| `src/test/live-paired-devices-list.test.tsx` | 20 |
| `src/test/live-paired-devices-memory.test.tsx` | 13 |
| `src/features/paired-devices/__tests__/model.test.ts` | 14 |
| `src/features/paired-devices/__tests__/code-memory.test.ts` | 5 |

Every Live file has the page address `http://127.0.0.1:5178/` in its docblock, empties the toast queue
between tests (`clearToasts()`), reads toasts under `[data-slot="toast"]`, names a 403 by
`fake.example(op, 403, 'notPermitted')`, and runs on W50's harness with a model of the Core's pairing
area (`pd-bed.tsx`: one active code, 300 s, a new issue replaces, revoke needs PAIRED and 5+
characters). The bed imports no fake transport itself (the static rule of
`live-runtime-static.test.tsx`). StrictMode: one request per read at mount, none of a command, one per
press ("pending and StrictMode").

## 5. Live check on lane 3 (CLG (d))

### 5.1 How

`assets/81_lane_try_lane3.sh.txt` waits for lane 3's lock (`lockf -t 240`; it was free at once) and runs
`assets/81_lane_run_lane.sh.txt` — W70's copy of W50/W55's lane script with lane 3 only, step 4
replaced. Backend `127.0.0.1:4423` on `dems_lane_3` (demo flag off, not reset), Vite `127.0.0.1:5178`,
HeadlessChrome/153.0.8010.12 over CDP at 1920×1080. The SUPERVISOR signed in through the form from the
seed constants (never printed). Run with the per-command sandbox bypass (ports, browser). Driver:
`assets/81_lane_cdp_driver.mjs.txt`.

### 5.2 What it showed (`assets/81_lane_browser_live.json`)

| Step | Screenshot | Facts |
|---|---|---|
| Paired Devices from the sidebar | `81_paired_devices_live_idle.png` | `shellMode LIVE`; panels issue + devices; state IDLE; list `empty` ("No device has been paired yet."); chip 0 / 0; `GET /api/v1/pairing/code 200`, `GET /api/v1/pairing/devices 200` |
| ONE code issued, digits and QR MASKED | `81_paired_devices_live_code_masked.png` | `POST /api/v1/pairing/code 201`; state `ACTIVE_KNOWN`, six digits shown (count only), QR present with its label; mask check `{ digitGroups: 2, transparent: true, qrHidden: true }` BEFORE the capture; countdown 300 s gold, three seconds later 297 s; "5 attempts left"; no issue button beside it; web storage and URL hold the code 0 times |
| Cancel | `81_paired_devices_live_cancelled.png` | `POST /api/v1/pairing/code/cancel 204`; state IDLE; toast "Pairing code cancelled"; then a page read of operation 16: `200`, `active: null` |
| Sign-out | — | `POST /api/v1/auth/sign-out 204`, Login shown |

### 5.3 The issued code, by count only

The driver read the six digits into one variable of its own process to count them afterwards and
never printed or wrote them. Counts of the digits and of `DEMS-PAIR:1:<digits>` in: the three
screenshots, `chrome.log`, `.locks/core-server.lane3.log`, `.locks/core-server.lane3.vite.log` and the
result JSON: **0 everywhere** (`codeScan` in `81_lane_browser_live.json`).

### 5.4 Stop and the lane database (quoted from `assets/81_lane_run.log`)

```
-- row counts that differ (before / after):
< audit head       seq 146; hash a5297ad6f76b93e7...
> audit head       seq 150; hash f177ab2443d647f3...
<   audit_log                146
<   auth_sessions            20
>   audit_log                150
>   auth_sessions            21
<   events                   110
>   events                   112
<   pairing_codes            0
>   pairing_codes            1
-- the backend's log: lines       48; lines with level error or fatal: 0
   6 "route":"/api/v1/pairing/code","status":200
   1 "route":"/api/v1/pairing/code","status":201
   1 "route":"/api/v1/pairing/code/cancel","status":204
   1 "route":"/api/v1/pairing/devices","status":200
== 01:42:52 stop what this check started
chrome stopped
vite: npm exit status 143
backend: npm exit status 0
== 01:42:52 listeners left on 4423, 5178, 9373 (expect none):
lsof exit 1 (1 with no output: no listener)
```

## 6. Verification (commands from the repository root; the last lines of their output)

### 6.1 Gate (`assets/81_gate.log`)

```
## 2026-10-06 02:17:56 WIB  2:17  2 users, load averages: 1.84 5.75 7.52
## $ npm run test -w @dems/core-web -- --maxWorkers=2
exit=0
      Tests  1244 passed (1244)
 Test Files  93 passed (93)
## 02:20:02 $ npm run test -w @dems/core-web -- --maxWorkers=2 src/features/paired-devices src/test/live-paired-devices
 Test Files  5 passed (5)
      Tests  72 passed (72)
exit=0
## 02:20:08 $ npm run typecheck -w @dems/core-web
exit=0
## 02:20:20 $ npm run lint -w @dems/core-web
exit=0
## 02:20:20 $ npm run test -w @dems/shared -- --maxWorkers=2
 Test Files  68 passed (68)
      Tests  1814 passed (1814)
exit=0
typecheck exit=0
lint exit=0
```

### 6.2 Reds on the way, and whose they were

| Time | Red | Cause | Owner / state |
|---|---|---|---|
| 01:44 (whole suite) | `live-shell-admin.test.tsx` 17, `live-devices-drawer.test.tsx` 1 | `FakeTransportUnscriptedError … GET /api/v1/pairing/code (getPairingCodeStatus)` from this page and `… GET /api/v1/rbac/matrix (getRoleMatrix)` from W77's, then an `afterEach` cascade (F81-2) | Fixed by W0's harness change (D172 (1), 01:53:13); both files green unchanged since |
| 01:44 | `live-pending-control.test.tsx:421` | W0's exact list of `usePendingControl()` callers; W75, W76, W77 and this row all follow §15 | Fixed by W0 (D172 (1)) |
| 01:57 (whole suite) | `live-paired-devices-issue.test.tsx` 1 (mine) | the refused-cancel test read scrambled digits once | Fixed in `code-display.tsx` (section 2.3) and the test asserts durable facts; 3 × 5 files green afterwards |
| 01:47 | typecheck `live-system-demo.test.tsx:408` | W76's file in flight | W76; gone by 02:20 |

Controller note D172 (2) — the drawer test: its red was ONLY the unscripted `getPairingCodeStatus`
(quoted above); the shared entry was never the cause. In-memory proof (M15) before W0's change landed:
with this row's two harness answers the drawer file was 13/13 and only W77's `getRoleMatrix` reds
remained; with W77's answer too, 53/53; the harness and the drawer test byte-equal before and after
(`assets/81_harness_proof.log`). After 01:53:13 the drawer test passes 13/13 unchanged (sha256
`37f79b0a…`).

### 6.3 CLG (c) and the write paths

```
## CLG (c), tight form
$ grep -rnE "useSimActions|\bsim\.actions\b|\bSim\b.*\.actions|SimContext" apps/core-web/src/features/paired-devices
grep exit 1 (1 = no hit)
```

The loose form (`\.actions\b`) hits only the i18n keys `common.actions.retry`/`retryIn` in three
files. No file of `runtime/**`, `lib/**`, `components/**`, `routes/**`, `vite.config.ts`, `main.tsx`,
`package.json` or the six protected test files was written by this row (their mtimes are all before
00:59, `[cmd]` stat at 01:48). `routeTree.gen.ts` was not hand-edited.

## 7. Mutation check (M15: in memory, the tree untouched)

W0's / W64's method: one text replacement in one module, applied by a Vite transform plugin
(`assets/81_mutations_config.mts.txt`, runner `81_mutations_runner.py.txt`, table
`81_mutations.json.txt`, log `81_mutations.log`); detected = Vitest exit ≠ 0; a marker proves the
mutant was applied; the SHA-256 of every mutated file is identical before and after each batch.

| Class | Mutants | Detected |
|---|---|--:|
| Panel model | M01 freshness count removed, M02 redeem not seen, M03 expiry 1 s late, M04 EXHAUSTED as EXPIRED, M05 own cancel as "elsewhere", M06 amber 1 s late, M07 PAIRED not first, M08 ended code's stale status | 8 / 8 |
| Code memory | M09 no PG-6a subscription, M10 one memory for all clients, M11 code into web storage | 3 / 3 |
| Issue panel | M12 answer into the query cache, M13 code into a record, M14 a 429 shows the Error state, M15 presenter skipped, M16 cancel keeps the memory, M26 freshness always true | 6 / 6 |
| Reads | M17 a 403 presented by both reads, M18 registry under a key of its own, M27 not gated on signed-in, M28 gated on nothing | 3 / 4 |
| List and dialog | M19 CONTRACT-GAP-W70-1 refresh removed, M20 no highlight, M21 outage closes the dialog, M22 no length check, M23 409 as generic | 5 / 5 |
| QR, page | M24 QR value altered, M25 Forbidden ignored | 2 / 2 |
| **Total** | | **27 / 28** |

M17 first SURVIVED: the toast queue on screen showed one toast for two identical `toast.danger` calls;
the forbidden test now counts the calls (F81-5) and M17 is detected. **M27 survives as equivalent**:
with the signed-in gate removed the permission gate still closes the reads at sign-out (session null →
`useCorePermission` false); M28 (both gates removed, F75-2's defect) is detected by D176's test. The
final-state re-run of M01–M26 (02:10–02:16) detected 26 / 26.

## 8. Contract gaps found

| ID | Where | What | Effect here |
|---|---|---|---|
| CONTRACT-GAP-W81-1 | `apps/core-server/src/modules/pairing/activity.ts:60-71` (`CodeCloseReason`), `codes.ts:42,53,86`, `redeem.ts:168` | The close reasons of `PAIRING_CODE_CLOSED` (`EXPIRED`, `EXHAUSTED`, `CANCELLED`) are server-local literals; `packages/shared/src` has no such vocabulary [cmd: `grep -rn EXHAUSTED packages/shared/src` → nothing] | The page duplicates the three values (`model.ts` `ClosedReason`) and ignores any other value. For W83: export the reasons from the shared contract |
| CONTRACT-GAP-W81-2 | `apps/core-server/src/modules/pairing/codes.ts:53` | A code REPLACED by a new issue is closed with the same reason `CANCELLED` as an explicit cancel | The row alone cannot tell "cancelled elsewhere" from "replaced elsewhere"; the page decides by a status read after the issue (rule 2 of section 2.3). For W83: a reason `REPLACED`, or the replacing code's ID in the details |
| CONTRACT-GAP-W70-1 (inherited) | `apps/core-server/src/realtime/hub.ts` | No `admin.changed DEVICES` when a paired device connects or disconnects | The same re-read on a tablet-link change as the drawer (D156 (2)) |

## 9. Findings

| ID | Finding | Evidence | For |
|---|---|---|---|
| F81-1 | `test/live-shell-admin.test.tsx:386` pins `pd-stub` inside the Live page, while W54's seam (§21.1 of `54_web_shell_admin_routes.md`) tells the page row to replace it | the test row `['/admin/devices', 'page-paired-devices', 'pd-stub', …]` | Deviation DV-1; decision DC-1 |
| F81-2 | In `live-shell-admin.test.tsx:183-193` the `afterEach` runs `bed?.dispose(); bed = undefined`: when `dispose()` throws (a fake-transport violation), `bed` stays set and every later test of the file fails in its own `afterEach`, static tests included — one unscripted request turned 17 tests red | 01:44 run, section 6.2 | W54 (assigning `undefined` before `dispose()` limits it to one test) |
| F81-3 | A page still on screen re-creates EMPTY `['core', …]` entries after the bridge's removal (its observers rebuild them on the next render, disabled, no data). AC-C-106's literal "no `['core', …]` entry" holds in the turn of the clearing, not after the next render | memory test: the cache is empty inside `onCoreQueriesCleared` and every later entry has `data` undefined and `dataUpdatedAt` 0 | Every administration page (W77 too); DC-3 |
| F81-4 | Under load the digits re-scrambled once after a refused cancel (the same element; no second issue, no remount was observed under tracing, not reproducible with tracing on) | 01:57 run; diagnosis logs `.cache/w81/logs/dbg_*.log` | Fixed robustly (section 2.3); root cause not pinned |
| F81-5 | The kit's toast queue on screen can show one toast for two identical calls: "one toast on screen" does not prove "one notice" | M17 first survived | Later rows' tests: count `toast.*` calls |
| F81-6 | The loss of `USER_ADMIN` alone also empties the memory (the bridge clears on either administration permission, `runtime/query-bridge.ts:59`): a supervisor who keeps `PAIRING_MANAGE` stays on the page and sees "Active, code not known" | memory test | As PG-6a states; noted |
| F81-7 | The D176 signed-in gate is redundant with the permission gate in every flow this row could build (M27 equivalent) | section 7 | Kept as defence in depth |

## 10. Deviations

| ID | Deviation | Why |
|---|---|---|
| DV-1 | The Live grid keeps W54's test ID `pd-stub` (`index.tsx:82`) | CLG (a) forbids changing `live-shell-admin.test.tsx`, which pins it as "the Live branch is on screen" (F81-1); the docblock says so |
| DV-2 | Device rows stagger by a CSS delay per row (`--pd-row-delay`, opacity and transform only), not by motion variants | The kit's table rows are no motion elements |
| DV-3 | The test bed and two unit test files live in `features/paired-devices/__tests__/` | The row's test pattern allows only `live-paired-devices-*.test.tsx` under `src/test/`; a shared helper there would run as a test file. The folder is inside the row's write path |
| DV-4 | Expired keeps the digits (dimmed 0.35) until a new issue, a close elsewhere or PG-6a | §10.3 says the digits and the QR dim |
| DV-5 | The lane driver read the issued digits into its own process memory | Required for the count-only scan of section 5.3; never written or printed |
| DV-6 | Temporary diagnostic lines were added to this row's own `code-display.tsx` and issue test during F81-4 and removed (pre-diagnosis copy `.cache/w81/code-display.before-debug.tsx`) | Diagnosis; no other file was touched |

## 11. Decisions for the controller

| # | Question | Default proposed |
|---|---|---|
| DC-1 | Rename `pd-stub` to e.g. `pd-layout` with a by-design change of the one row of `live-shell-admin.test.tsx:386` (L-5), or keep it | Rename at W83 / W88 together with `ur-stub` (W77 has the same pin) |
| DC-2 | F81-2: W54's `afterEach` cascade | W54's owner: set `bed = undefined` before `dispose()` |
| DC-3 | F81-3: word AC-C-106's cache clause as "no `['core', …]` entry holds data" (or test it in the turn of the clearing, as this row does) | Record the wording; no code change |
| DC-4 | CONTRACT-GAP-W81-1, -2 | To W83 with CONTRACT-GAP-W32-4 |
| DC-5 | Ledger | `@dems/core-web` +5 files / +72 tests (this row); `@dems/shared` +0 tests (i18n additive); the whole web suite at 02:20 is 93 / 1,244 — equal to the controller's floor of 02:24 (D178) |
| DC-6 | F81-5 for the remaining rows' briefs | "Count `toast.*` calls when the claim is one notice" |

## 12. State left in `dems_lane_3`

**Superseded by decision D178:** the System row ran its one allowed demo reset on lane 3 at 02:06:24,
which rebuilt `dems_lane_3` from the seed (epoch 18 → 19, one earlier chain in the lineage). This row's
check ran before it (01:42:29–01:42:52), so nothing this check wrote is in the lane's current state; its
rows survive only in the lineage of the earlier chain. This row did not reset anything itself and ran
no lane check after 02:06:24. What the check added at the time (quoted in section 5.4):

Four audit rows (seq 146 → 150; by the request log: a sign-in, `PAIRING_CODE_ISSUED`,
`PAIRING_CODE_CLOSED` for the cancel, a sign-out — the rows themselves were not read), one auth
session (signed out), one `pairing_codes` row (cancelled), two events. No active code (operation 16
answered `active: null`). No device was paired, revoked or unpaired on any lane. Lanes 1 and 2, ports
5173–5175, 4400, 5432 were not touched.

## 13. Rollback (not executed)

1. `cp -p .cache/rollback/W81/apps/core-web/src/features/paired-devices/index.tsx apps/core-web/src/features/paired-devices/index.tsx`
   and `cp -p .cache/rollback/W81/packages/shared/src/i18n/en/paired-devices.ts packages/shared/src/i18n/en/paired-devices.ts`
   (hashes in `.cache/rollback/W81/pre.sha256`).
2. Delete the new files: in `apps/core-web/src/features/paired-devices/` — `choreography.ts`,
   `code-display.tsx`, `code-memory.ts`, `devices-panel.tsx`, `issue-panel.tsx`, `live-data.ts`,
   `model.ts`, `panel.tsx`, `report.ts`, `revoke-dialog.tsx`, `paired-devices.css`, `__tests__/` (three
   files); `apps/core-web/src/test/live-paired-devices-{issue,list,memory}.test.tsx`.
3. Re-run `npm run test -w @dems/core-web -- --maxWorkers=2`, typecheck and lint. W0's harness answers
   (D172) are W0's and stay.

## 14. Files of this row

Production: the twelve files of section 2.1 under `apps/core-web/src/features/paired-devices/` and
`packages/shared/src/i18n/en/paired-devices.ts`. Tests: `features/paired-devices/__tests__/{pd-bed.tsx,
model.test.ts, code-memory.test.ts}`, `src/test/live-paired-devices-{issue,list,memory}.test.tsx`.
Documents: this file, `delegation_progress/coder_execution_step_103.md`. Assets (`implementation/assets/`):
`81_gate.log`, `81_harness_proof.log`, `81_harness_proof_config.mts.txt`, `81_mutations.log`,
`81_mutations_config.mts.txt`, `81_mutations_runner.py.txt`, `81_mutations.json.txt`, `81_lane_run.log`,
`81_lane_browser_live.json`, `81_lane_run_lane.sh.txt`, `81_lane_try_lane3.sh.txt`,
`81_lane_cdp_driver.mjs.txt`, `81_lane_driver_stdout.log`,
`81_paired_devices_live_{idle,code_masked,cancelled}.png`.
