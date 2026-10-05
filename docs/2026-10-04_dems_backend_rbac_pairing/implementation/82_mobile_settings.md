---
task_id: 2026-10-04_dems_backend_rbac_pairing
row: W82 (plan step 104; provisional row 97)
agent: coder-execution
date: 2026-10-06
status: complete
source_plan: masterplan/02_plan.md (row `| W82 |`, gates SG and CLG)
---

# W82 — Mobile Settings in LIVE mode (sites S2-7, S5-7; the third segment; the biometric switch; demo controls), with CPM1-1 and CPM1-2

Tier 2. Code is cited as `path:line` relative to the repository root. No credential value, token,
password or pairing code appears in this file or its assets (the device log holds 0 credential lines;
the one match of the scan pattern is the scan's own label line, `assets/82_device_run.log:137`; the
test markers are assembled from parts in the test files).

## 1. Result at a glance

| Gate item | Result | Evidence |
|---|---|---|
| SG: typecheck and lint of `@dems/mobile` | exit 0; exit 0, eslint JSON **532 files, 0 errors, 0 warnings** (02:11–02:12) | §6.1, `assets/82_final_gate.log` |
| SG: whole suite at or above the floor (138 / 1,695, D175) | **138 suites / 1,695 tests, exit 0** (02:13:46–02:15:38). The first run (02:07) had one red file that is not this row's (§6.1) | §6.1 |
| CLG (a): the folder's existing tests pass and are absent from `git diff --stat acaff20` | the 3 existing test files (22 tests) pass and are byte-equal to `acaff20` | §6.2 |
| CLG (b): one Live test per named site — success, refusal (denied toast), outage | S2-7: 21 Live tests over five commands (incl. 429, 409, DEMO_DISABLED); S5-7: 2; AC-C-52: 4; StrictMode: 4 | §6.3 |
| CLG (b): the LIVE dialog, the sign-out, landing on `/pair` or `/login` (AC-C-31) | 8 tests on the app's **real route tree with the runtime's own data source**: SIMULATED→LIVE lands on `/pair` (no credential) and `/login` (credential); LIVE→SIMULATED and LIVE→HEARTBEAT sign out at the Core first | §6.4 |
| CLG (b): the biometric switch disabled in a biometric session, truthfully worded (AC-C-68, CPM1-1) | 7 tests, one of them a real fingerprint sign-in through the auth layer | §6.5 |
| CLG (b): demo controls only with `DEMS_DEMO_CONTROLS=1` and the permission; `DEMO_DISABLED` truthful | jest (AC-C-52, 4 + 6 tests); device: the panel is rendered on lane 1 with the flag on | §6.3, §7 |
| CLG (c): no `useSimActions`, no `.actions` read on a `Sim` | 0 and 0 (grep, and the folder's static test) | §6.6 |
| CLG (d): device check, one sitting, at most 10 minutes | phone, lane 1, **01:59:15–02:01:27 (2 min 12 s)**; 12 screencaps; one of 17 flow checks failed (the accordion did not expand, F82-1) | §7 |
| The release-gate test passes UNCHANGED with `settings-core-link-LIVE` disabled in a release build | `heartbeat-release-gate.test.tsx` byte-equal to `acaff20` (blob `6aa6db7e…`), 5 / 5 pass; LIVE disabled in a release build is pinned by W51's test and by this row's boundary test | §6.2, §6.4 |
| Selecting LIVE shows the dialog, signs out and lands on `/pair` or `/login` | jest §6.4 (both landings) and the device §7 (`/login`, paired as DEV-0001) | §6.4, §7 |
| Mutation check (in memory, rule M15) | first pass 31 / 35; the 4 survivors acted on (two dead guards removed, two tests added); the 13 mutants of the changed code re-run: **13 / 13**; mutated files identical before and after | §6.7 |
| Lock status | identical before (01:59:02) and after (02:02:01); ports 4421 and 8083 free; no reverse rule | §7.4 |

## 2. Inputs read

Plan row W82, the citation convention, section 11 (SG, CLG) of `masterplan/02_plan.md`; client spec
`[CS:§3.1, §3.2, §3.3, §3.4, §3.5]`, `[CS:§7.4]` (group `features/settings`), `[CS:§8.1 LB-1 to LB-10]`,
`[CS:§8.6 S2-7]`, `[CS:§8.7 S5-7]`, `[CS:§9.3 MB-1 to MB-8, MB-6a]`, `[CS:§9.5]`, AC-C-31, AC-C-52,
AC-C-68, AC-C-83, GC-12; `gateway_check/09_cp_mobile_runtime.md` CPM1-1, CPM1-2 and §4 answer 3 (the ten
rules); `gateway_check/09b_m1_mobile_consolidation.md` §8 with F.10 (D166); decisions D124 ruling 3, D158,
D164 DN-7, D175 (received during the row, §7.5); `implementation/51_mobile_runtime.md` §3.1, §4;
`implementation/56_mobile_sign_in.md` §3, §11 (the W82 seams); `implementation/66_mobile_home_more.md`
F-2 (not this row's); `implementation/78_mobile_devices.md` and `80_mobile_operator_audit.md` (the bed
and the device-driver patterns).

## 3. What was built

### 3.1 The Core link source across the LIVE boundary (§3.3, AC-C-31; CPM1-2)

New file `apps/mobile/src/features/settings/core-link-switch.tsx`:

| Part | Where | What |
|---|---|---|
| `useCoreLinkSwitch()` | `core-link-switch.tsx:56` | `request(next)` (`:65`): a change that does not cross the LIVE boundary is stored at once (`crossesLiveBoundary`, `settings-model.ts:90`), as before; otherwise the dialog opens |
| Confirm | `:73-95` | `press.run` (the runtime's `usePendingPress`) → `settle(() => actions.signOut('USER'), …)` (`:78`) of the CURRENT data source (`useCoreActions()`); in `done` the control is released, the dialog closes, one `info` record is written and `setCoreLinkSource(next)` (`:92`) stores the source. The runtime then swaps the data source and the navigator lands on `/pair` or `/login`; nothing here navigates |
| `CoreModeDialog` | `:118` | HeroUI Native `Dialog` with the web's shared sentences (`common.coreMode.switchTitle.*`, `switchBody`, `switchConfirm.*`); title and confirm by the target's data mode (`dataModeOf`, `settings-model.ts:95`: HEARTBEAT is SIMULATED data). While the sign-out is out it holds: a dismissal is ignored (`:122`), Cancel is disabled, the confirm carries `busyState(busy)` and shows `PendingSpinner` only when `pending` (S3-1, LB-1, 09b F.10) |
| The control | `preferences-section.tsx:32`, `:85`, `:130` | the segment calls `core.request`; the dialog sits outside the card stack (its root view must not add a gap between the cards) |
| The hint line (§9.5) | `preferences-section.tsx:73-77`; `i18n.ts:49-50` | debug builds: the existing hint and "Live uses the Core server on this computer through adb reverse. The tablet must be paired."; release builds: the existing release hint and "Live is a developer setup as well (adb reverse to the Core server)." (one `Description`, so the release-gate test's single match of "developer setup only" holds) |

Why the Core action and not the contract's `auth.signOut('USER')`: the contract returns nothing, so the
switch could not wait for the Core's answer, and stopping the Live source before the answer is exactly
CPM1-2. The auth layer's sign-out calls the same action (`apps/mobile/src/auth/live-auth-provider.tsx:410-418`,
`apps/mobile/src/auth/auth-provider.tsx:182-190`); what it adds is an in-memory notice for the Login
screen, which the runtime's rebuild of the auth layer drops anyway (DV-1).

### 3.2 The biometric switch (CPM1-1, MB-1, MB-6a (3), AC-C-68)

| Part | Where | What |
|---|---|---|
| The view | `settings-model.ts:181` (`biometricSwitchView`, new optional 5th input `BiometricSwitchLive`) | without the LIVE input exactly the step-88 view; with it: `changeBlocked` disables the switch whatever else holds; `noteKey` is the screen-lock sentence (`features.auth.biometric.screenLockNote`), the protected sentence only while the marker says `protected: true` (`mobile.biometric.identityNoteLiveProtected`, `apps/mobile/src/i18n/en.mobile.ts:62`), or the MB-1 sentence in a biometric session |
| The section | `security-section.tsx:39`, `:47-59`, `:64`, `:68` | LIVE reads `session.biometric.changeBlocked` and `.protected`; SIMULATED builds exactly the former description; a biometric session changes nothing even from a press that reaches the handler; a refused change in LIVE says "Biometric sign-in was not changed on this tablet. Try again." (the SIMULATED sentence "it applies until the app restarts" would be untrue there) |

### 3.3 Site S2-7 and the Demo controls (AC-C-52)

`maintenance-section.tsx`: `useSimCommand` (try/catch around a synchronous call) is replaced by
`useCoreCommand` (`:93`): `settle` in the callback form of B-10, the presenter first in LIVE, the
simulator's refused-transition warning, a generic danger toast, a runtime-log record on every failure.

| Use | Where | LIVE behaviour |
|---|---|---|
| Run diagnostics (op. 65) | `DiagnosticsCard`, `:155` | the sheet opens in `ok`; busy at once, spinner late; LIVE subtitle "Eight health checks on the Core, one after another." |
| Install update (op. 67) | `UpdateCard`, `:251` | the started toast in `ok` ("Installing v2.5.0"); a 409 is the simulator's warning; the chip reads **DEMO** in LIVE and one line says "The Core server runs a demonstration update: no software is installed." (`:303`; the Core's own description, `packages/shared/src/api/system.ts:180`) |
| Fault buttons (ops 73, 74, then 52) | `DemoControls`, `:333`; `DemoFaultButton`, `:517` | one pending state per button (keeps its `selected` state, adds `busy`); clearing MIC 2 clip sends the latch reset as the NEXT command in the clear's `ok` and releases the button when that one settled (`:348-381`) |
| Load, Reset (op. 72) | `:383-397` | the scenario chip and the toast in `ok`, i.e. once the snapshot of the new epoch is in (CL-18) |
| Recover (op. 33) | `:399-401` | the toast in `ok` |
| Who sees the panel | `:124-147`; `demoControlsAccess`, `settings-model.ts` | LIVE: only with DEMO_CONTROL (`useCorePermission`) and the session's `demoControls` (`useLiveSelector`); otherwise one line: "Your role does not include the demo controls." or "Demo controls are turned off on the Core server. They appear when it runs with its demo flag on." Presentation mode hides it in both modes, as before. LIVE note: "Demo only. Faults are injected on the Core server, and every connected console sees them." |

`DEMO_DISABLED` (the flag turned off after the sign-in) is worded by the runtime's presenter: "Demo
controls are turned off on the Core server" (`apps/mobile/src/runtime/core-errors.ts:119`).

### 3.4 Site S5-7: the role's permissions (Profile sheet)

`profile-sheet.tsx:30-69`, `settings-screen.tsx:40`, `:88`: the list stays the role's row of the shared
table (`permissionsOf`, as the spec says; the Core is seeded from it, and W16's three SUPERVISOR grants
show with their labels); the role is the signed-in operator's, so a role change the Core pushes re-lists
it. In LIVE the heading reads "Permissions" (not "Demo permissions") and the note "The Core server checks
every action against your role." (not "… follows the simulated Core"). The sheet is portalled, so LIVE
comes in as a prop.

### 3.5 Files

| File | Change |
|---|---|
| `apps/mobile/src/features/settings/core-link-switch.tsx` | new: the switch hook and the dialog (§3.1) |
| `apps/mobile/src/features/settings/preferences-section.tsx` | the segment through the switch; the dialog; the LIVE hint line (the body moved into a fragment, hence a whole-file re-indent in the diff) |
| `apps/mobile/src/features/settings/security-section.tsx` | CPM1-1 (§3.2) |
| `apps/mobile/src/features/settings/maintenance-section.tsx` | S2-7 and AC-C-52 (§3.3) |
| `apps/mobile/src/features/settings/settings-model.ts` | `crossesLiveBoundary`, `dataModeOf`, the LIVE input of `biometricSwitchView`, `demoControlsAccess` |
| `apps/mobile/src/features/settings/profile-sheet.tsx`, `settings-screen.tsx` | S5-7 wording in LIVE (§3.4) |
| `apps/mobile/src/features/settings/i18n.ts` | additive: `preferences.coreLinkHintLive*`, `live.*` (10 leaves); the 78 step-88 leaves unchanged (digest pinned, §6.6) |
| `apps/mobile/src/i18n/en.mobile.ts` | additive: `mobile.biometric.identityNoteLiveProtected` (granted key); `identityNote` unchanged |
| `apps/mobile/src/features/settings/live-settings-sites.test.tsx` | new, 24 tests (S2-7, S5-7, AC-C-52, StrictMode) |
| `apps/mobile/src/features/settings/live-settings-boundary.test.tsx` | new, 8 tests (AC-C-31, CPM1-2, release build) |
| `apps/mobile/src/features/settings/live-settings-biometric.test.tsx` | new, 7 tests (AC-C-68, CPM1-1) |
| `apps/mobile/src/features/settings/settings-live-model.test.ts` | new, 6 tests |
| `apps/mobile/src/features/settings/settings-live-static.test.ts` | new, 14 tests (CLG (c), rules 1–9, copy) |
| `apps/mobile/src/features/settings/testing/live-settings-bed.tsx`, `testing/settings-test-setup.ts` | new, test-only |

### 3.6 The ten mobile rules (09 §4 answer 3) and 09b §8 / F.10

| Rule | How it holds |
|---|---|
| 1 one way in | `useCoreActions()` + `settle` only (static test: `useCoreActions()` and `settle(` in exactly `core-link-switch.tsx` and `maintenance-section.tsx`) |
| 2 presenter first | `if (live && presentCoreError(error))` in both files; tests call `resetCoreErrorPresenterForTests()` in `beforeEach` (the bed's reset) |
| 3 no address, no network API | static test |
| 4 no credential | the marker's `protected` is read through `useAuthSession().biometric`; no secure-store import (static test) |
| 5 one LIVE idiom | `useCoreLink().source === 'LIVE'` in the four files that word LIVE; no `useCoreMode`, `useLive(`, `getCoreLinkSource` (static test) |
| 6 React Compiler | no ref read in render, no state set in an effect; lint 0 / 0 |
| 7 timers | none new (static test: only the two step-88 files that had them) |
| 8 chips and copy | the LIVE copy says nothing about a simulation (static + screen tests, and the device dumps: "texts that say simulat on this screen: none"); no SIM-GAP marker added |
| 9 do not touch | only `features/settings/**` and the granted key of `en.mobile.ts` were written |
| 10 ledger and pre-image | §6.1; pre-images in `.cache/rollback/W82/` (`pre.sha256`) |
| 09b F.10 | `usePendingPress`, `busyState`, `PendingSpinner` from `@/runtime`, no copy; the dialog of this row holds while busy |

## 4. CPM1-1 and CPM1-2: how each is closed

| Finding | Closed by | Proven by |
|---|---|---|
| **CPM1-1** — in LIVE the switch read "Simulated identity binding" and never read `session.biometric.changeBlocked` (AC-C-68 unmet) | `changeBlocked` and `protected` are inputs of `biometricSwitchView` (`settings-model.ts:181`); the description is worded on `marker.protected`: the screen-lock sentence while it is not `true`, the protected sentence only while it is `true`, the MB-1 sentence in a biometric session; the switch is disabled there and the handler changes nothing (`security-section.tsx:47-68`) | jest: `live-settings-biometric.test.tsx` (7: enrol = one op. 7; disable = op. 7 + both items deleted; outage = truthful toast; protected wording; **a real fingerprint session → disabled, MB-1 sentence, 0 requests even from the handler**; SIMULATED unchanged). Device: `82_b3_live_security.png` — "Fingerprint enrolled on this device. Biometric sign-in asks for this device's screen-lock check.", no "Simulated identity binding" |
| **CPM1-2** — crossing the LIVE boundary from the Settings segment signed nobody out and asked nothing | the §3.3 dialog; the sign-out of the current source BEFORE the source changes, the switch in `done` (`core-link-switch.tsx:73-95`) | jest on the real route tree: the simulator is signed out (`AUTH_SIGNED_OUT` written) and the app lands on `/pair` or `/login`; leaving LIVE sends `POST /auth/sign-out` once with the session's bearer, the dialog holds until the answer, the Core session is closed (`live-settings-boundary.test.tsx`). Device: `POST /api/v1/auth/sign-out 204 principal=operator` before `runtime.sim.hydrated` (`assets/82_device_run.log`) |
| CPM1-2 residual (not this row's, per the brief) | — | with the link down the Live sign-out ends the session here only (D80) and the debt is lost at the switch, so that Core session stays open until its idle expiry; pinned by the boundary test "the link down …" (`coreSession` still open, 0 sign-out requests). Owed-sign-out persistence on mobile → W100 with the web's |

## 5. Contract gaps found

| ID | Gap | Where | Effect here |
|---|---|---|---|
| CONTRACT-GAP-W82-1 | `runDiagnostics` has no `notPermitted` 403 example (every seeded role holds DIAGNOSTICS_RUN); its 403 examples are `BASIC_403_EXAMPLES` (first: `deviceRevoked`) | `packages/shared/src/api/system.ts:257-263` | the denial test builds the guard's refusal with `refusal(403, 'NOT_PERMITTED', …)` (`testing/live-settings-bed.tsx`, `notPermitted`), as W78 did; the same class as CONTRACT-GAP-W66-2 / W69-1 / W80-1 |

Nothing the screen needs in LIVE was missing from the Core: the demo flag reaches the client as
`session.demoControls` (`packages/shared/src/api/identity.ts:128`).

## 6. Verification

### 6.1 SG (`assets/82_final_gate.log`)

```
## 2026-10-06 02:07:53 WIB load averages: 3.57 8.46 8.37
## $ npm run test -w @dems/mobile -- --maxWorkers=2
exit=1
Test Suites: 1 failed, 137 passed, 138 total
Tests:       1 failed, 1694 passed, 1695 total
FAIL src/features/network-time/network-time-screen.test.tsx (10.914 s)      <- "Exceeded timeout of 5000 ms" (load)
## 02:11:42 the network-time folder alone: 3 suites / 23 tests PASS
## 02:11:58 $ npm run typecheck -w @dems/mobile      > tsc --noEmit      exit=0
## 02:12:05 $ npm run lint -w @dems/mobile                                exit=0
## 02:12:31 $ npm run lint -w @dems/mobile -- --max-warnings=0 --format json
exit=0
files 532, errors 0, warnings 0
## 2026-10-06 02:13:46 WIB load averages: 6.01 8.89 8.84 (second whole run, the re-check of network-time-screen)
## $ npm run test -w @dems/mobile -- --maxWorkers=2
exit=0
Test Suites: 138 passed, 138 total
Tests:       1695 passed, 1695 total
Time:        111.973 s
## 02:15:38
```

The red file of the first run, `apps/mobile/src/features/network-time/network-time-screen.test.tsx`, is a
step-86 baseline file in W79's folder (owner W79 / the network-time group), not touched by this row; it
timed out at jest's 5 s default under load and passed alone and in the second whole run (F82-4).

Ledger (L-1): before, 128 suites / 1,580 tests (the brief, 01:14); this row adds **5 suites / 59 tests**
(`live-settings-sites` 24, `live-settings-boundary` 8, `live-settings-biometric` 7,
`settings-live-model` 6, `settings-live-static` 14); after, 138 / 1,695 with the parallel rows' additions.
At 01:36 a typecheck error stood in W73's in-flight `live-recovery-sites.test.tsx` (gone by 01:50).

### 6.2 CLG (a) (`assets/82_clg_evidence.txt`)

```
## 01:59:23 $ git diff --stat acaff20 -- apps/mobile/src/features/settings apps/mobile/src/i18n/en.mobile.ts
 apps/mobile/src/features/settings/i18n.ts          |  31 ++
 .../src/features/settings/maintenance-section.tsx  | 323 +++++++++++++++------
 .../src/features/settings/preferences-section.tsx  | 183 ++++++------
 .../mobile/src/features/settings/profile-sheet.tsx |  15 +-
 .../src/features/settings/security-section.tsx     |  29 +-
 .../mobile/src/features/settings/settings-model.ts |  86 +++++-
 .../src/features/settings/settings-screen.tsx      |   4 +-
 apps/mobile/src/i18n/en.mobile.ts                  |  44 +++      (39 lines of earlier rows, 5 of this row)
settings-screen.test.tsx        acaff20=c758a29d… now=c758a29d… equal
settings-model.test.ts          acaff20=8b42a815… now=8b42a815… equal
heartbeat-release-gate.test.tsx acaff20=6aa6db7e… now=6aa6db7e… equal
git diff --numstat acaff20: i18n.ts 31 0, en.mobile.ts 44 0   (no existing line changed)
```

No existing test file is in the diff. The folder's three existing suites pass (5 + 6 + 11 = 22 tests,
`assets/82_folder_tests_verbose.txt`); W51's `runtime/live-settings.test.tsx` (2) passes and was not
touched.

### 6.3 CLG (b): sites S2-7 and S5-7, AC-C-52, StrictMode (`live-settings-sites.test.tsx`, 24 / 24)

On the app's real Live source over the contract-checked fake transport (`testing/live-settings-bed.tsx`:
paired device, a Live sign-in, the Core's engine a real simulator; deltas before or after the answer).

| Site / use | Success | Refusal (denied toast) | Outage | Also |
|---|---|---|---|---|
| S2-7 Run diagnostics (65) | sheet only after the answer; busy at once, no spinner at 300 ms, spinner at 600 ms; one request; Core wording | 403 NOT_PERMITTED (gap W82-1) | "Core server unreachable" / "Nothing was changed."; no retry | 429 = limit wording, never offline (LB-10) |
| S2-7 Install update (67) | TECHNICIAN: toast only after the 202; DEMO chip and line | SUPERVISOR: the Core's `notPermitted` example → "Not permitted" / "Requires the Technician role" | offline toast, state IDLE | 409 session open → the simulator's warning |
| S2-7 Fault buttons (73, 74, 52) | inject toast after the 204; clear → `clearFault` then `resetMicClip`, button busy until the second settled, latch reset | `loadScenario`'s `notPermitted` example | inject outage | `demoDisabled` example → "Demo controls are turned off on the Core server", released |
| S2-7 Load / Reset (72) | answer-first: toast and chip only after the new epoch's snapshot (CL-18) | (above) | — | Reset = `loadScenario(idle)` |
| S2-7 Recover (33) | toast after the 202, session leaves FAULT | — | — | — |
| S5-7 permissions | SUPERVISOR's 10 grants (W16's 3 labelled), LIVE heading and note; a pushed role change re-lists | display hint: no command (the Core enforces each call) | link down: list stays, no toast, no request | — |
| AC-C-52 | SUPERVISOR + flag: panel | INVESTIGATOR: no panel, one line, 0 demo requests | — | flag off: the flag line; a pushed role change takes the panel away |
| StrictMode (D158) | maintenance, security, preferences under `<StrictMode>`: 0 Settings commands at mount | — | — | one press = one request |

### 6.4 The LIVE boundary on the real route tree (`live-settings-boundary.test.tsx`, 8 / 8)

The test root is `src/app/_layout.tsx`'s nesting (`AppProviders` → `BootGate` → `RootNavigator`) over
every route file of `src/app`; the runtime builds its OWN data source from the preference (an injected
source would ignore it); only the transport is faked (`installFakeTransport`, the runner's clock).

| Case | Proven |
|---|---|
| SIMULATED → LIVE, no credential | dialog "Switch to Live mode?" with the shared sentence; nothing stored or sent before the confirm; after it: simulator signed out (`AUTH_SIGNED_OUT`), source LIVE stored, **`/pair`**, no Core sign-out |
| SIMULATED → LIVE, a credential the Core confirms | **`/login`** of LIVE mode; registration asked |
| Cancel; a dismissal of an idle dialog | nothing changes; still signed in; 0 requests |
| SIMULATED → HEARTBEAT | instant: no dialog, no sign-out |
| LIVE → SIMULATED, the answer held | the dialog holds (confirm busy, no spinner at once, Cancel disabled, Cancel and a dismissal ignored), spinner after 600 ms, **one** `POST /auth/sign-out` with the session's bearer and body `{ reason: 'USER' }`; source still LIVE until the 204; then SIMULATED **`/login`** |
| LIVE → HEARTBEAT | crosses the boundary too: dialog, sign-out at the Core, then `/login` with the mock-core link |
| LIVE → SIMULATED with the link down | lands on `/login` with 0 sign-out requests; the Core session stays open (CPM1-2 residual, W100) |
| Release build | `settings-core-link-LIVE` disabled, the release line shown; a press opens no dialog, signs nobody out, stores nothing |

### 6.5 The biometric switch (`live-settings-biometric.test.tsx`, 7 / 7)

As §4 row CPM1-1. The biometric session is a real one: an enrolment seeded as an earlier password session
left it, then `signInWithBiometric()` through the auth layer (the OS prompt is the jest mock) → operation 8
→ `session.method === 'BIOMETRIC'` → `changeBlocked`.

### 6.6 CLG (c) and the copy

```
useSimActions in production files: 0
.actions matches outside tests: security-section.tsx:120 and profile-sheet.tsx:72 `styles.actions` (step-88
StyleSheet keys), core-link-switch.tsx:130 'common.actions.cancel' (a quoted translation key) -> 0 Sim reads
KI-07 markers in the folder's production files: 2 x SIM-GAP-M88-1 (as at acaff20)
```

`settings-live-static.test.ts` (14) holds this and more: the production file list, the S2-7 and §3.3
shapes, the runtime's pending control and no copy, no address / network API / secure store / Live
source module, timers only in the two step-88 files, one LIVE idiom, the LIVE copy without "simulat", the
78 step-88 copy leaves byte-equal to `acaff20` (digest `a69eda8e…`, computed independently from
`git show acaff20:apps/mobile/src/features/settings/i18n.ts`).

### 6.7 Mutation check (rule M15: nothing in the tree was written; `assets/82_mutations_*.log`)

A jest transformer changes one production file in memory per mutant (`assets/82_mutating_transformer.cjs.txt`,
`82_mutate.py.txt`, `82_jest_mut_config.cjs.txt`); 8 behavioural test files per run (the static test is
left out).

```
first pass (01:54-02:03): 35 mutants over 7 files: 31 detected, 4 not detected
  W6  Cancel closes the dialog while busy (handler guard)       -> dead code behind the disabled Cancel: removed
  W11 a second confirm sends a second sign-out (handler guard)  -> dead code behind usePendingPress: removed
  S2  a biometric session may change biometric sign-in (guard)  -> kept; the test now reaches the handler
  S4  the SIMULATED description loses its period                -> new SIMULATED wording test
final re-run on the final code (02:03:52-02:07:15):
control (no mutation, 8 test files): exit=0 Tests: 69 passed, 69 total
## 13 detected, 0 not detected, 0 not applied, of 13       (W1-W11, S2, S4)
## the mutated files in the tree, before and after: identical
```

The first pass's batch 2 reports "CHANGED" for `core-link-switch.tsx`: that is this row's own removal of
the two dead guards during the run, not the tool; the final re-run covers that file.

## 7. Device check (CLG (d)) — phone, lane 1, ONE sitting

### 7.1 How it was run

| Item | Value |
|---|---|
| Locks | `lockf -k -t 300 .locks/core-server.lane1.lock` (acquired at once, 01:59:13), then `device-session.sh phone` (`METRO_PORT=8083`, `DEMS_CORE_HOST_PORT=4421`, `DEVICE_SESSION_MAX_SECONDS=600`) |
| Backend | `DEMS_DEMO_CONTROLS=1 DEMS_CORE_PORT=4421 npm run start:server` (an environment value the server reads, `apps/core-server/src/config.ts:37`) → `"port":4421,"database":"dems_lane_1","demoControls":true`; health ready; **no reset** |
| Mode changes | launched once with `demsdemo:///login?core=SIMULATED&motion=off`; both crossings of the LIVE boundary went through the Settings segment and its dialog; ended in SIMULATED |
| Login, Home | never dumped: W60's fixed coordinates; the app's biometric offer detected by its pixels and declined with "Not now" (twice) — never "Enable" |
| Dumps | Settings screens only (motion off), 20 s limit each, none timed out; `/sdcard/w82.xml` removed |
| Never pressed | a fault, a scenario, Load, Reset, Recover, Install, Run diagnostics, the biometric switch |
| Secret | the password typed into the app's own field from the dataset constant, never printed; credential lines: JS log 0, server log 0 |
| Scripts | `assets/82_run_w82.sh.txt`, `82_device_w82.sh.txt`, `82_device_flow.mts.txt`; log `assets/82_device_run.log` |

### 7.2 The run, as logged (abridged from `assets/82_device_run.log`)

```
-- 01:59:59 segments: SIMULATED [92,1436][355,1530] selected; HEARTBEAT [365,1436][852,1530]; LIVE [863,1436][1009,1530]
-- 01:59:59 hint: "… Live uses the Core server on this computer through adb reverse. The tablet must be paired."
-- 02:00:06 OK   the §3.3 dialog is open: "Switch to Live mode?" | "You will be signed out and the console reloads. …" | "Cancel" | "Switch to Live mode"
-- 02:00:10 OK   the Live source mounted after the confirm (runtime.live.ready)
-- 02:00:10 OK   the switch was logged (settings.coreLink.switch)
-- 02:00:10 OK   landed on the LIVE Login (GET /api/v1/auth/status 200 at its mount)
-- 02:00:10 OK   no Core sign-out for the SIMULATED -> LIVE switch (the simulator signed out locally)
-- 02:00:21 the app's sign-in: POST /api/v1/auth/sign-in 200            (andi.pratama, SUPERVISOR)
-- 02:00:35 OK   LIVE is the selected segment
-- 02:00:41 biometric switch: checked=false enabled=true
-- 02:00:41 biometric texts: "Fingerprint enrolled on this device. Biometric sign-in asks for this device's screen-lock check."
-- 02:00:41 OK   the LIVE wording of the switch;  OK   no "Simulated identity binding" in LIVE
-- 02:00:50 FAIL the Demo controls panel is shown (DEMO_CONTROL and the demo flag)   <- see F82-1
-- 02:00:50 maintenance texts: "Eight health checks on the Core, one after another." | "DEMO" | "The Core server runs a demonstration update: no software is installed." | "Install update" | "Demo controls" | "DEMO"
-- 02:00:50 texts that say "simulat" on this screen: none
-- 02:01:01 profile: "Role: Supervisor" | "Permissions" | "The Core server checks every action against your role."
-- 02:01:01 permission rows: SESSION_START, SESSION_NOTE, EVIDENCE_VIEW, DIAGNOSTICS_RUN, EVIDENCE_REVIEW, EVIDENCE_EXPORT, AUDIT_EXPORT, PAIRING_MANAGE, USER_ADMIN, DEMO_CONTROL
-- 02:01:14 OK   the §3.3 dialog is open: "Switch to Simulated mode?" | … | "Switch to Simulated mode"
-- 02:01:19 the Core's sign-out: POST /api/v1/auth/sign-out 204
-- 02:01:19 OK   the Core answered the sign-out (204) before the switch;  OK   the simulator mounted after it (runtime.sim.hydrated)
-- 02:01:25 OK   nothing more goes to the Core server in SIMULATED;  OK   credential/token lines in the JS log: 0
-- 02:01:26 OK   demo operations sent: 0;  OK   biometric enrolment requests: 0
-- prefs after: {"coreLinkSource":"SIMULATED"};  lock at end: isKeyguardShowing=false
== 02:01:27 3. backend requests during the session
      1 GET /api/v1/auth/session 401 principal=device
      2 GET /api/v1/auth/status 200 principal=device
      1 GET /api/v1/health 200 principal=null
      1 GET /api/v1/pairing/device 200 principal=device
      1 POST /api/v1/auth/sign-in 200 principal=device
      1 POST /api/v1/auth/sign-out 204 principal=operator
      1 POST /api/v1/auth/touch 200 principal=operator
-- demo operations in the server log (must be 0): 0
-- bearer/cookie/credential lines in the server log (must be 0): 0
```

`device-session` exit 1 is the flow's own verdict (one failed check of 17, F82-1); every lifecycle step
(Metro stop, reverse removal, backend stop) ran.

### 7.3 Screencaps (`assets/82_*.png`, 1080 × 2424)

| File | What it shows |
|---|---|
| `82_a1_simulated_login.png` | SIMULATED Login ("paired (simulated)") |
| `82_a2_simulated_after_signin_offer_check.png` | SIMULATED Home with the app's biometric offer (declined) |
| `82_a3_simulated_preferences.png` | **the three segments on the phone, none truncated** (GC-12), Simulated selected, the new hint line |
| `82_a4_dialog_to_live.png` | **the §3.3 dialog** "Switch to Live mode?" |
| `82_a5_live_login_after_switch.png` | **landed on the LIVE Login**: "Core online", "Core: DEMS-IR-01 • paired as DEV-0001", "Pairing details" |
| `82_b1_live_after_signin_offer_check.png` | LIVE Home "Core Live" with the offer ("asks for this device's screen-lock check"), declined |
| `82_b2_live_preferences.png` | Live selected |
| `82_b3_live_security.png` | **the biometric switch in LIVE**: "Fingerprint enrolled on this device. Biometric sign-in asks for this device's screen-lock check." |
| `82_b4_live_maintenance_demo.png` | LIVE System Maintenance: the Core's diagnostics subtitle, the update card with DEMO and its line, and the **Demo controls accordion rendered** (DEMO_CONTROL and the flag); collapsed (F82-1) |
| `82_b5_live_profile.png` | Profile sheet in LIVE: "Permissions", 10 grants, the Core's note |
| `82_c1_dialog_to_simulated.png` | **the §3.3 dialog** "Switch to Simulated mode?" |
| `82_c2_simulated_login_after_switch.png` | **landed on the SIMULATED Login** after the Core's sign-out (204) |

### 7.4 Lock status, ports (read-only; `assets/82_lock_status_before.txt`, `82_lock_status_after.txt`)

```
01:59:02 / 02:02:01 (identical; diff exit 0)
phone (emulator-5554): AVD dems2_phone, isKeyguardShowing=false, CredentialType=PIN, fingerprint count=1, lock screen disabled=unreadable
phone2 (emulator-5558): AVD dems2_phone2, isKeyguardShowing=false, CredentialType=NONE, fingerprint count=0, lock screen disabled=true
tablet (emulator-5556): AVD dems2_tablet, isKeyguardShowing=false, CredentialType=PIN, fingerprint count=1, lock screen disabled=unreadable
lsof 4421/8083 exit 1 (1 = none);  adb -s emulator-5554 reverse --list: (empty);  .locks/core-server.lane1.pid emptied
```

### 7.5 Controller note D175 (received after the sitting), checked against this driver

| Point | This row's driver |
|---|---|
| F73-2: the deep link loses `&motion=off` unless quoted for the device shell | the only URL with `&` went through `launch()`, which passes the device shell ONE string with the URL in single quotes (`adb shell "am start … -d '<url>' <app>"`, `assets/82_device_w82.sh.txt`, `launch()`); the later links (`/settings/...`) hold no `&` or `?`. `core=SIMULATED` took effect (prefs, `runtime.sim.hydrated`); that `motion=off` did is supported by every Settings dump going idle within its 20 s limit (hypothesis-level: Settings has no ambient loop) |
| F73-3: a password guard that waits for a Core sign-in never fires in SIMULATED | the SIMULATED sign-in waited on time only (6 s), never on a Core request; the LIVE one waited on `POST /auth/sign-in` |
| The pending Summary of SES-20261006-0028 on lane 1 | at 02:00 the LIVE sign-in landed on Home (`82_b1_…png`), not on a Summary; nothing was acknowledged |

## 8. Findings

| ID | Finding | Evidence | For |
|---|---|---|---|
| F82-1 | On the device the tap on the Demo controls trigger did not expand the accordion within 1.5 s; the accordion itself is rendered, which is AC-C-52's decision (with DEMO_CONTROL and the flag the panel shows; otherwise one line replaces it). The expanded LIVE panel (note, buttons, Load/Reset) is proven in jest only. Hypothesis: the tap landed during the screen's entering animation after the deep link; not re-run (ONE sitting). The accordion is step 88's, structurally unchanged | `82_b4_live_maintenance_demo.png`; `assets/82_device_run.log` 02:00:47–02:00:50 | DN-4 |
| F82-2 | CPM1-2 residual: with the link down, leaving LIVE ends the session locally and the owed sign-out is lost at the switch (mobile has no owed-sign-out storage) | boundary test "the link down …" | W100 (brief) |
| F82-3 | W76 (web, in flight) added shared `system.live.*` keys for the same words (install, started toast, diagnostics subtitle); this row uses its own `features.settings.live.*` so as not to depend on an ungated row (mobile subtitle = W78's "on the Core", the web's "on the Core server") | `packages/shared/src/i18n/en/system.ts` (uncommitted, W76) | DN-5 |
| F82-4 | First whole run: `network-time-screen.test.tsx` (W79's folder, step-86 baseline file) exceeded jest's 5 s under load; green alone (02:11) and in the second whole run (02:15) | §6.1 | W79 / controller (flake under load) |
| F82-5 | The software update in LIVE is the Core's demonstration (no software is installed), so the chip reads DEMO instead of SIMULATED and one line says so; Install reads "Install update" (the web's LIVE word) | `packages/shared/src/api/system.ts:180`; `82_b4_…png` | DN-7 |
| F82-6 | GC-12: on the phone (portrait, 1080 px) the three segments fit without truncation; no label was shortened. The tablet was not checked on a device in this row | `82_a3_…png`, segment bounds §7.2 | Info |
| F82-7 | The brief says the FIRST 403 example of every operation is `deviceRevoked`; for the five demo operations it is `notPermitted` (`DENIED_403`, `packages/shared/src/api/demo-controls.ts:280-285`). The tests always name the example, so either order works | — | Info |
| F82-8 | "Auto-lock: Fixed at 15 minutes by the demo policy. Other values need Core support." stays in LIVE: true for the Core too (15-minute idle rule, no operation to change it) | `security-section.tsx`; [SP:ID-P9] | Info |
| F82-9 | jest prints "did not exit one second after the test run" for the new Live files run alone (as F80-5 for W80's folder); the whole run exits 0 | §6.3 runs | Info |
| F82-10 | W66's F-2 (no app-wide connection banner on Home/More) is not addressed here: shell-level, not this folder | `implementation/66_mobile_home_more.md` F-2 | W100 |

## 9. Deviations

| # | Brief / spec | What was done | Why |
|--:|---|---|---|
| DV-1 | §3.3 step 2: "The contract's `signOut('USER')`" | The Core action `signOut('USER')` through `useCoreActions()` + `settle`, the same action the contract's sign-out calls | The contract returns nothing, so the switch could not wait for the Core's answer (CPM1-2). Lost: only the auth layer's in-memory notice for the next Login, which the runtime's rebuild drops anyway (DN-1) |
| DV-2 | Brief: SIMULATED looks exactly as before apart from the CPM1-1 wording | The §9.5 hint line about Live shows in debug builds in every mode (also SIMULATED), appended to the existing hint; a release build shows its own line | §9.5 requires the line under the control, and the third segment it explains is there in every mode of a debug build (W51). Release wording is this row's (DN-2) |
| DV-3 | Spec AC-C-52 wording "rendered … only with" | Without access the panel is replaced by one true line (not by nothing) | So the operator learns why (flag off vs role) |
| DV-4 | "Never `cd`" | Three slips early in the row (all before 01:36): a read-only `cd <repo>; git status`, a no-op subshell `(cd .cache/rollback/W82; true)` at the pre-image step, a failed `cd /dev/null`; and one `prettier --write` that reformatted `preferences-section.tsx` with default settings — restored from the pre-image within a minute and the edits re-applied | No effect on any file; all later commands use absolute paths and no formatter |
| DV-5 | "Keep every single command under about 8 minutes" | The mutation batches ran as one background chain of four python runs (each under 8 min, ~13 min in all); the device check as one background command (lane lock + a session capped at 600 s; the sitting took 2 min 12 s) | Non-blocking; each unit stayed within its own limit |
| DV-6 | — | LIVE copy for the update and diagnostics in `features.settings.live.*`, not W76's `system.live.*` | F82-3 |

## 10. Decisions for the controller

| ID | Decision | Recommendation |
|---|---|---|
| DN-1 | DV-1: the boundary switch signs out through the Core action and switches in `done` | Ratify (it is what closes CPM1-2) |
| DN-2 | DV-2: the Live hint line in every mode of a debug build; the release line "Live is a developer setup as well (adb reverse to the Core server)." | Ratify |
| DN-3 | The CPM1-2 residual (owed sign-out across the switch when the link is down) | W100, with the web's owed-sign-out storage (as briefed) |
| DN-4 | F82-1: accept the device evidence of AC-C-52's decision (panel rendered on lane 1 with the flag on) with the expansion proven in jest | Accept; if wanted, a one-tap re-sit (open the accordion, screencap) in W94's continuous device session |
| DN-5 | F82-3: point the mobile LIVE update/diagnostics copy at the shared `system.live.*` once W76 is gated (04 §9: web and mobile say the same thing) | Defer to W83 (copy alignment), one-line changes |
| DN-6 | CONTRACT-GAP-W82-1 | To W83 with CONTRACT-GAP-W66-2 / W69-1 / W80-1; probably "by design" |
| DN-7 | F82-5: DEMO chip and the one line on the LIVE update card | Ratify |

## 11. State left on the device and its lane

| Where | State |
|---|---|
| `dems2_phone` | Last mode SIMULATED through the Settings segment (prefs `{"coreLinkSource":"SIMULATED"}`), on the SIMULATED Login (the switch signed the simulator's operator out; earlier, the switch to LIVE signed out the simulated session); the app force-stopped by device-session. The biometric offer declined twice ("Not now"); no enrolment, no `setBiometricEnrollment` request. `/sdcard/w82.xml` removed. Keyguard, PIN and fingerprint untouched; lock status identical |
| `dems_lane_1` | DEV-0001 kept (`paired_devices 1`, `device_credentials 1` before and after); `audit_log` 237 → 241 (4 rows of the sitting: the device's connections, the sign-in, the sign-out; not itemised); the SUPERVISOR's session was **signed out at the Core** (204); no reset, no scenario, no fault, no demo operation (server log: 0 `/demo/` requests), no Summary acknowledged. The demo flag was on only for that backend process |
| Ports, locks | 4421 and 8083 free; `adb reverse --list` empty; Metro stopped by device-session; backend stopped; `.locks/core-server.lane1.pid` emptied. Lane 2, the tablet, `dems2_phone2`, 5432, 5173–5175, 4400 and lane 3 untouched |

## 12. Error handling and logging

Every failure path writes the persistent runtime log (`reportRuntimeIssue` → `dems.mobile.log.v1`):
`settings.coreLink.signOut` (warn when the presenter showed it, error otherwise) and an `info` record
`settings.coreLink.switch` with `{ from, to }` for every crossing; `settings.maintenance.runDiagnostics`,
`settings.maintenance.startSoftwareUpdate`, `settings.demo.inject` / `.clearFault` / `.reset` /
`.loadScenario` / `.recover` (warn for a presented or refused command, error otherwise);
`settings.security.setBiometric` (error). User feedback: the runtime's presenter in LIVE (denied, offline,
limit, DEMO_DISABLED), otherwise this screen's toast. Degradation: every control is released in `done`,
a refused diagnostics run keeps the sheet closed, the mode dialog holds until the Core answers and the
switch happens in every outcome (nobody stays signed in in the other mode). No credential, token,
username or password is logged.

## 13. Rollback (not executed)

Copy back the 10 pre-images of `.cache/rollback/W82/` (names are paths with `/` → `_`; `pre.sha256`),
except `apps_mobile_src_i18n_en.mobile.ts`: if another row has written `en.mobile.ts` since 01:26,
remove only this row's 5-line block (the comment and `identityNoteLiveProtected`, `en.mobile.ts:58-62`)
instead. Delete the new files: `features/settings/core-link-switch.tsx`, the five new test files and
`features/settings/testing/` (2 files). The folder returns to its `acaff20` state, and `en.mobile.ts` to
the earlier rows' state.

## 14. Assets (`implementation/assets/`)

`82_final_gate.log`, `82_clg_evidence.txt`, `82_folder_tests_verbose.txt`, `82_mutations_first_pass.log`,
`82_mutations_final.log`, `82_mutate.py.txt`, `82_mutating_transformer.cjs.txt`, `82_jest_mut_config.cjs.txt`,
`82_device_run.log`, `82_run_w82.sh.txt`, `82_device_w82.sh.txt`, `82_device_flow.mts.txt`,
`82_lock_status_before.txt`, `82_lock_status_after.txt`, `82_lane1_counts_before.txt`,
`82_lane1_counts_after.txt`, and the 12 screencaps of §7.3.
