---
row: FX-M2 (E-fix, decision D201)
title: Mobile session, evidence and screen fixes from the E2E round
date: 2026-10-06
agent: coder-execution
status: complete in code and jest (FX-M2 + FX-M2b: 7 of 7); E2E-P-1 and E2E-T-2 await the device re-test (§B.5)
narrative_tier: 2
sources: decisions/decisions.md D199, D200, D201 (R2); test/07c_e2e_phone_lane1.md; test/07d_e2e_tablet_lane2.md
---

# 11d — E-fix FX-M2: mobile screens

## 1. Result

> **Update 12:40 (FX-M2b, after the path grant):** E2E-P-1 and E2E-P-3 are now fixed, and E2E-T-2's likely cause is fixed. The table below is FX-M2's state at its gate; see **§FX-M2b** at the end. The controller ratified R2 as built at the FX-M2 gate.

| # | Defect | State | What changed (in FX-M2's paths) | Proof |
|---|---|---|---|---|
| 1 | E2E-P-1 bottom-tab highlight stays on Sessions | **BLOCKED (path)** | Nothing. The cause is in `components/composed/nav/**` and `navigation/app-tabs.tsx`, which no row owns. Root-cause analysis and a proposed change are in §4.1 | — |
| 2 | E2E-P-2 Stack Check copy says "local mock-core" while Live | **Fixed** | `features/home/home-screen.tsx` | 4 tests; mutants P1, P2 detected |
| 3 | E2E-P-3 two Home timers 1 s apart | **BLOCKED (path)** | Nothing. One of the two timers is `components/composed/nav/live-mini-bar.tsx`. Cause and the one-line change are in §4.2 | — |
| 4 | E2E-P-4 = E2E-T-4 empty screen between Live and Finalizing; slow seal on the tablet | **Fixed (empty frame)**; seal lag **not caused by a poll** (§4.3) | `app/(app)/session/live.tsx`, `features/session-finalizing/session-finalizing-screen.tsx`, new `features/session-finalizing/handover.ts` | 4 tests; mutants H1–H3 detected |
| 5 | E2E-P-5 + O-2 (ruling R2) Start Session and Install update not role-gated | **Fixed** | new `features/rbac/use-role-gate.ts`, new `features/session-new/use-start-entry-guard.ts`, `features/dashboard/quick-actions.tsx`, `features/sessions/hub-top.tsx`, `app/(app)/session/new.tsx`, `features/settings/maintenance-section.tsx` | 15 new tests + 2 adjusted; mutants R1–R9 detected |
| 6 | E2E-T-2 Devices blank for over 4 minutes | **Screen hardened**; most likely cause is **outside the paths** (§4.4) | new `features/devices/panel-boundary.tsx`, `features/devices/devices-screen.tsx` | 4 tests; mutants B1–B3 detected |
| 7 | E2E-T-6 Metadata tab empty for Core-only evidence | **Fixed** | `features/evidence/metadata-tab.tsx`, `features/evidence/evidence-detail.tsx` | 4 tests; mutants M1–M4 detected |

Verification: typecheck exit 0; lint exit 0 (0 errors, 0 warnings); the full mobile suite passed once with **158 suites and 1,829 tests, exit 0, in 152 s**. The in-memory mutation run detected **21 of 21** mutants. No file was changed in the tree during that run (§5).

Rules held: no file outside FX-M2's paths was edited. The live stack, Metro and the emulators were not touched. No lock, PIN or fingerprint was handled. No commit was made. No file was deleted or renamed.

Rollback copies: `.cache/rollback/FX-M2/` holds 15 files and `SHA256SUMS.txt`. One of them, `app/(app)/session/finalizing.tsx`, was copied but in the end not edited.

## 2. Fixed defects

### 2.1 E2E-P-2 — the Stack Check copy follows the data source

- **What was found.** The proof card printed one fixed sentence: "Query, wired to the local mock-core over adb reverse." It is at `features/home/home-screen.tsx:157-159` in the rollback copy, and it never looked at the mode. Row W51 had already moved the card's Heartbeat and Service panels to the Live source (`use-health.ts:22-40`), but not this sentence. Evidence: capture `22_stack_check` shows "core-server v0.2.0 · api v1" and "Live" right beside the mock-core sentence (07c row 21).
- **The change.** `STACK_PROOF_SOURCE_LINE` (`home-screen.tsx:34-38`) maps each source to its own line. `HeroCard` reads `useCoreLink().source` (`:151`) and prints that line in a `stack-proof-source` Text (`:173-175`). The three lines are:
  - "Data source: Simulated. …"
  - "Data source: mock-core heartbeat. …"
  - "Data source: Live. Data, Heartbeat and Service come from the Core server over adb reverse."
- **Partition note.** D201 listed E2E-P-2 under FX-M1. The FX-M2 brief assigns it here, at `home-screen.tsx:159`, which is in FX-M2's paths. FX-M1's test `features/pairing/stack-check-service-name.test.tsx` covers line ~217 (the service name). That line was not changed, and the suite passes.
- **Tests.** New `features/home/stack-proof-source.test.tsx`, 4 tests:
  - LIVE: the line says Live and the Core server, and the mock-core sentence is gone from the screen.
  - HEARTBEAT and SIMULATED: each shows its own line.
  - The three lines differ, and the LIVE line never says "simulated".
  - The existing N-1 test `home-screen.test.tsx` is unchanged and green.
- **Mutation.** P1 (the old literal is back) and P2 (the line ignores the source) are both detected.
- **Residual risk.** The proof screen keeps literal English copy, as the rest of that file does. It has no i18n keys.

### 2.2 E2E-P-5 + O-2 — ruling R2: Start Session and Install update are role-gated

- **What was found.**
  - The Home quick action was always enabled (`quick-actions.tsx:60-76` in the rollback copy).
  - The Sessions hub Start was disabled only while a session was busy (`hub-top.tsx:143-170` in the rollback copy).
  - `/session/new` refused only busy states (`useSessionNewRedirect`, `navigation/session-guards.ts:18-38`).
  - The wizard reacted only to a permission lost while it was open, and only in LIVE (`session-new-screen.tsx:153-203`, `useCorePermission` going from true to false). This matches the observation in 07c E2E-P-5.
  - Install update never looked at MAINTENANCE (`maintenance-section.tsx:317-321` in the rollback copy).
  - Evidence:
    - Captures `80_…` to `83_sc4_phone_create_refused`.
    - lane1 server log: `POST /api/v1/session 403 operator:OPR-001` at 10:37:05 and 10:38:01 (D199).
    - O-2 is capture `18g_settings_system_maintenance`.
    - The Core refuses `startSoftwareUpdate` to SUPERVISOR and INVESTIGATOR: `apps/core-server/src/plugins/permission-guard/__tests__/decision.test.ts:107,132`.
    - The web locks both controls: `core-web/src/features/dashboard/active-session-panel.tsx:71,100-160` and `core-web/src/features/system/update-panel.tsx:16,86`.
- **The change.** It follows the existing mobile pattern used by device restart and archive: the control is disabled in place and a line says "Requires the X role".
  - **`features/rbac/use-role-gate.ts`** (new):
    - `roleGateFor(role, permission)` is pure. It returns allowed, known, locked, and the role the hint names (`requiredRoleFor` of `@/runtime`).
    - `useRoleGate(permission)` reads the role from the store (`useSim(selectRole)`). In Live mode that is the replica's `operators` slice, which the Core replaces with a role change's `session.updated` and delta. The gate therefore follows a role change without a new sign-in.
    - `locked` is true only when the role is known. While no role is known (Live mode before the first snapshot), the control is disabled with no hint line.
  - **Home quick action** (`quick-actions.tsx:66-69,81-86,109-113`): "Start Session" and "Continue setup" (`startsWizard`) are disabled and show the hint (`home-action-primary-locked`). The ways back to an active session (monitor, finalizing, recovery, summary) are not gated, because they open no session.
  - **Sessions hub** (`hub-top.tsx:152-176`): Start or Continue setup is disabled with the hint (`sessions-start-locked`). A busy session keeps its own reason, which takes priority.
  - **Every other entry** (`features/session-new/use-start-entry-guard.ts` and `app/(app)/session/new.tsx:15-17`): if the role is known and lacks SESSION_START, the route goes to `/home`. It shows one toast, "Not permitted" / "Requires the Investigator role", and writes one `info` log record (an expected state, never `console.warn`, per R6). Only the entry is decided here. A loss while the wizard is open stays the screen's own rule (§6.3, AC-C-50), so nothing navigates or toasts twice. The guard is off while the busy redirect applies.
  - **Install update** (`maintenance-section.tsx:267-268,327-346`): disabled with "Requires the Technician role" (`settings-update-install-locked`). This applies in both modes, to INVESTIGATOR and SUPERVISOR alike.
- **Tests.**
  - `features/rbac/role-gate-r2.test.tsx`, 14 tests, Simulated mode, real route files:
    - the pure table;
    - TECHNICIAN: Home Start locked and a press opens nothing;
    - INVESTIGATOR: the press opens the wizard;
    - a TECHNICIAN keeps "Return to live session";
    - hub locked for TECHNICIAN and open for SUPERVISOR;
    - deep link and later push of `/session/new` refused for TECHNICIAN (Home, one log record, no wizard); the INVESTIGATOR gets the wizard;
    - Install locked for INVESTIGATOR and SUPERVISOR, open for TECHNICIAN.
  - `features/rbac/live-role-gate-r2.test.tsx`, 1 test, LIVE source over the fake transport:
    - the Core changes the role INVESTIGATOR to TECHNICIAN to INVESTIGATOR (`session.updated` plus the `operators` delta);
    - Home Start, hub Start and Install update re-gate in place; the entry guard refuses for the TECHNICIAN;
    - no request reaches `createSession`; `signIn` is called exactly once.
  - Adjusted by design:
    - `settings/live-settings-sites.test.tsx`. The old "SUPERVISOR presses Install and gets the Core's 403" test is split in two. (a) R2: SUPERVISOR sees the control locked, and a press sends nothing. (b) The Core's 403 is still worded, for a TECHNICIAN whose role was lost on the Core.
    - `session-new/session-new-screen.test.tsx`. The old "TECHNICIAN opens the wizard, Next refused" test is split in two. (a) R2: the TECHNICIAN goes Home and nothing is created. (b) The operator changes while the wizard is open: the screen's create error still shows. This keeps that branch covered.
- **Mutation.** R1 to R9 are all detected:
  - each lock removed (Home, Home hint, hub, route guard, Install);
  - the gate frozen on its first role (not live);
  - an unknown role counted as locked;
  - the guard deciding on every render;
  - the wrong role named.
- **Residual risk.**
  - (a) The re-gate latency on the devices is that of the `operators` delta. The same path measured 0.51–0.77 s for device restart in SC4. The re-test round should measure it.
  - (b) A TECHNICIAN whose app resyncs to a setup session left by an investigator (§6.3) is bounced to Home with the toast, once per resync.
  - (c) The spec §6.3 table still lists the old mobile set. R2 is recorded as the amendment in D201, and the spec owner may fold it in.

### 2.3 E2E-P-4 = E2E-T-4 — no empty frame between Live and Finalizing

- **What was found (the empty frame).** When the state left RECORDING, `app/(app)/session/live.tsx` (lines 9-12 in the rollback copy) returned only `<Redirect href=…/session/finalizing>` (`navigation/session-guards.ts:40-44`).
  - Expo Router's `Redirect` renders nothing and navigates from a focus effect (`node_modules/expo-router/build/link/Redirect.js`). So the commit that removed the monitor drew nothing.
  - The Finalizing route then mounted, and its cards entered with `enterRise`, starting from opacity 0.
  - Capture `65_sc3_s3_phone_transition_frames_f27_f42`: f31 to f34 are black (device 10:28:56.765 to 57.939), and f35 to f38 fade the card in.
  - The tablet shows the same in `B17_stop_probe_*` and `R2_08_stop_probe_*`.
  - A stop made on the phone goes through the same route, so the fix covers both.
- **What was found (the lag).** No poll exists on the mobile path. Details are in §4.3.
- **The change.**
  - `live.tsx:16-27`: when the redirect target is `/session/finalizing`, the route renders `<SessionFinalizingScreen handover />` and the `<Redirect>` in the same commit. The monitor is replaced by the Finalizing card in its stopping state with no frame in between, and the route follows.
  - `session-finalizing-screen.tsx:68-82`: the in-place copy skips the enter motion (`enter={false}` reaches every card) and marks the session in `handover.ts`.
  - The Finalizing route's own copy then reads the mark and also appears without motion. This holds whether the redirect or the runtime's route sync puts it there, so swapping two identical screens shows no dip.
  - A deep link into `/session/finalizing` still enters as before, because the mark matches only the session that was handed over.
- **Tests.** New `features/session-live/live-stop-handover.test.tsx`, 4 tests. It uses the LIVE source and the REAL `/session/live` route, and records what every React commit drew, read in the Profiler commit callback.
  - For phonePortrait and tabletLandscape: after a stop made on another console (the engine stops and the delta is pushed), no commit is empty, and the first commit without the monitor draws the Finalizing card in place. The route reaches `/session/finalizing`, the hand-over is marked, and no request is sent between the push and the hand-over (no poll).
  - The in-place card shows "Ending recording and closing tracks…" and has no `entering` animation in its ancestors.
  - The mark matches only the session that was handed over.
  - `session-summary/summary-live-static.test.ts` gains the new file `session-finalizing/handover.ts` in its file list (no timer in it).
- **Mutation.** H1 (only the redirect, which brings back the empty frame), H2 (the in-place copy rises in) and H3 (no mark) are detected.
- **Residual risk.** The tablet's seal lag of 4.2–4.7 s is not explained by mobile code (§4.3). It should be re-measured in the re-test round at lower host load.

### 2.4 E2E-T-6 — the Metadata tab shows the Core record

- **What was found.** `features/evidence/metadata-tab.tsx:95-101` (rollback copy): with no bundled package the tab returned only "No DEMO package for this item: the manifest is not on this device."
  - In Live mode, `pkg` is non-null only for a `DEMO_PACKAGE` media reference (`evidence-detail.tsx:119-121`). So every item the Core recorded hit that branch.
  - The web prints the item's record as JSON, labelled "Core record" (`core-web/src/features/evidence/metadata-tab.tsx`, the `if (!pkg || !documents)` branch, line 109 when read at 12:10; FX-W is editing that file in parallel).
  - Evidence: `B27_tablet_evidence_metadata.png` compared with `B24_web_evidence_metadata.png` (07d A9).
- **The change.**
  - `evidenceRecordJson(item, { live, mediaStatus })` (`metadata-tab.tsx:82`) builds the web's record: the same keys in the same order, times in WIB ISO form.
  - Without a package, the tab shows one line saying why, then the record in a monospace box:
    - Live, operation 40 answered with no package: `evidence.live.noPackage`.
    - Live, still asking: `features.evidence.media.checking`.
    - Live, no answer: `evidence.live.mediaUnavailable` (it claims no absence, as the web wording in W83 ledger #95).
    - Simulated: the existing line.
  - The title is "Core record" in Live mode and "Simulated evidence record" in Simulated mode. These are shared i18n keys, so no evidence copy changed (the digest tests stay green).
  - `evidence-detail.tsx:274-281` passes the item, `live` and the media state. The LIVE idiom stays in `evidence-detail.tsx`, as the static test requires.
- **Tests.** New `features/evidence/live-evidence-metadata-record.test.tsx`, 4 tests, LIVE:
  - media NONE: "Core record" with the item's values and the web's keys in order; the tab's own words never claim a simulation;
  - operation 40 unanswered: the line "Media reference unavailable";
  - a DEMO_PACKAGE item keeps the bundled manifest;
  - pure labels per mode.
- **Mutation.** M1 (record never shown), M2 (the detail does not pass the item), M3 (unanswered reads as "no package") and M4 (the Live record labelled simulated) are detected.
- **Residual risk.** The record prints the Core's values verbatim, as the web does. If a Core record carries a value that names a simulation, it shows. The test engine's signature is `SIMULATED-SHA256`, which is data, not copy.

### 2.5 E2E-T-6's sibling E2E-T-5 (note label) is not FX-M2's

D201 lists E2E-T-5 under FX-M2, but the FX-M2 brief excludes "the session-timeline note-label lines (FX-C)". Nothing was changed for it.

## 3. E2E-T-2 — the Devices screen always shows loading, data or an error

- **What the screen's own code can and cannot do.** `features/devices/devices-screen.tsx`:
  - It sends no request and waits on no query, suspense or focus effect. Data come synchronously from the store (`useDeviceStatuses()` calls `useSim`, `use-devices-data.ts:14-17`).
  - The only gate is `!useRuntimeStatus().ready`, which shows the skeleton.
  - The one path that could leave nothing was an uncaught render error, because there was no boundary. It would have surfaced as an error, but there was no `devices.*` error record: `jserr_tablet_full.txt` holds only the CORE_OFFLINE pair at 09:52:29.
  - So the code in FX-M2's paths has no way to produce a pane that stays empty for 4 minutes. The most likely cause is in §4.4.
- **The change.** It hardens the screen as the brief asks.
  - New `features/devices/panel-boundary.tsx`, the Home/Storage copy (KI-08 pattern):
    - user feedback: the shared panel card;
    - a persistent `devices.panel.<name>` error record;
    - Retry rate-limited to 3/6/12 s with a countdown, at most 3 retries.
  - `devices-screen.tsx:66-70,80-82` wraps the list and the detail pane.
  - `devices-live-static.test.ts` adds the new file to the folder list and allows its UI cooldown timer (rule 7: it reads no Core time).
- **Tests.** New `features/devices/devices-states.test.tsx`, 4 tests:
  - loading: the runtime is not ready, so the header and skeleton show;
  - data: the three sections at once;
  - list error: the card shows, the error is logged, a failing Retry is disabled with "Retry in 3s", and after the cooldown Retry brings the data back;
  - tablet detail error: the list stays and the pane shows the card, which Retry clears.
- **Mutation.** B1 (no list boundary), B2 (no rate limit) and B3 (no detail boundary) are detected.
- **Residual risk.** The likely cause in §4.4 is not fixed by FX-M2, because it is outside the paths.

## 4. Analysis of what lies outside FX-M2's paths (blocked; for the controller)

### 4.1 E2E-P-1 — the highlight does not follow the tab (and the same split on the tablet rail)

- **What was found.** `90a_defect_e2e_p1_bottom_nav_crops.png`, row "Evidence": the **label** "Evidence" is gold. The Evidence **icon** is grey, the Sessions icon is gold, and the **pill** is still under Sessions. On Devices the pill moves, but the Sessions icon stays gold.
- **Why it matters.** In `components/composed/nav/nav-item.tsx` the label colour and both icon layers are driven by ONE shared value:
  - `progress` (`:43`);
  - `goldIcon` / `mutedIcon` opacity (`:49-50`) on `Animated.View`s (`:72-77`);
  - `labelColor` (`:51-53`) on an `Animated.Text` (`:85`).
  - The pill is a transform driven from `use-indicator.ts:46-60` (`x.set(…)`) into `bottom-tab-bar.tsx:37-42`.

  The label changed, so `progress` reached 1 for Evidence and 0 for Sessions. The **View opacity and transform** updates of that commit were not applied, but the **Text colour** update was. Later commits apply again: the Devices icon and pill move, while the Sessions icon keeps its stale opacity because its `progress` never changes again.
- **Hypothesis (unproven in jest; jest does not run the native UI thread).** UI-thread animated-prop updates on views are lost in the commit that switches tabs from a nested stack (a session detail on the phone; an Evidence detail with its More menu just closed on the tablet). The stack is react-native-reanimated 4.5.1 on RN 0.86.3 Fabric, under reduced motion `animateTiming` is `withTiming(x, {duration: 0})`, and the static flags are defaults (`FORCE_REACT_RENDER_FOR_SETTLED_ANIMATIONS: true`).
- **Proposed change.** For the owner of `components/composed/nav/**`:
  - Draw the **settled** state from React props, and use the animated style only for the transition. The gold layer's settled opacity, the label colour and the indicator's `left`/`top` would come from the `active` prop and `frame`; the transform would apply only while travelling. A lost UI-thread update can then never leave a wrong final state.
  - This needs a device check (motion off and on, phone bar and tablet rail).
  - Files: `nav-item.tsx`, `use-indicator.ts`, `bottom-tab-bar.tsx`, `nav-rail.tsx`.

### 4.2 E2E-P-3 — two timers, two time sources

- **What was found.**
  - Home's System Status timer is `useElapsedSeconds()`, which is `useSim(s => floor(selectElapsedMs(s) / 1000))` (`features/dashboard/use-home-data.ts:91-94`). That is the store clock, which in Live mode follows the Core (`packages/shared/src/live/source/clock.ts`).
  - The bottom "Recording" bar is `LiveMiniBar` (`components/composed/nav/live-mini-bar.tsx:57-64,79`). It uses `Date.now()` from its OWN 1 s `setInterval`, started when it mounts.
  - The two tick at unrelated phases and from different clocks (the device clock and the Core-offset clock). For part of each second they differ by 1 s: `36b` shows 00:04:32 and 00:04:31; frame `99f` at device 10:49:58.274 shows the same.
  - The monitor (`features/session-live/use-monitor.ts:79`) and the Sessions hub (`features/sessions/use-sessions-data.ts:134-136`) already read the store clock. Only the mini-bar does not.
- **Proposed change (one line, outside the paths).** In `live-mini-bar.tsx`, replace the interval with `const seconds = useSim(selectElapsedSeconds)` (`packages/shared/src/sim/selectors.ts:119`). Both timers then change in the same store publish.
- **Why Home cannot be changed instead.** Moving Home onto the mini-bar's interval would make Home disagree with the monitor and the hub.

### 4.3 E2E-T-4 — the stop and seal arrive late on the tablet: no poll on the mobile path

- **What was found.**
  - (1) The Finalizing screen reads only the store (`features/session-finalizing/use-finalizing.ts:29-56`). The store is fed by the Live source's socket deltas.
  - (2) The tablet's request log has no request between `POST …/start` at 10:36:58.870 and `POST …/summary/acknowledge` at 10:45:29.132. The stop at 10:41:32 and the seal at 10:41:39 fall in that gap (`t_tablet/jslog_tablet_full.txt`). The Core's log in that window shows only the web's `GET /session/current` at 10:41:41 (`core_log_lane2_window.txt:185-186`).
  - (3) The web reads the same session slice through the same shared Live source (`core-web/src/features/session-monitor/finalization-modal.tsx:56`) and showed SEALED at +0.11/+0.15 s.
  - (4) The tablet's progress lagged by a roughly **constant** amount through the whole pipeline. Finalizing showed 0 % at +3.5 s, 83 % at +10.2 s, and sealed at +11.0 s, against the Core's +6.9 s (07d B6). A single late poll would not look like that; socket messages processed late would.
- **Hypothesis (unproven).** The emulator's JS thread was starved at host load 22–24. E2E-T-1 documents the same thing: the Core answered the keep-alive in 28 ms, and the app timed out at 8 s.
- **Where it belongs.** The shared Live source (`packages/shared/src/live/**`) is outside FX-M2's paths. The measurement belongs to W98 performance.

### 4.4 E2E-T-2 — the most likely cause is the same lost update, on the tab content's fade

- **What was found.** `12_devices_blank_after_7min.png` shows the rail with the **"Devices" label gold**, the **Devices icon grey**, the **Evidence icon gold** and the **indicator box still on Evidence**. This is exactly the split of §4.1.
- **Why it matters.** The content pane's visibility is also a UI-thread animated opacity. `TabScreenFade` (`navigation/app-tabs.tsx:104-116`) creates a newly focused tab screen at `opacity 0` (`:106`) and animates it to 1 in an effect (`:110-111`).
  - If that update is lost in the same commit as the icon and indicator updates, the Devices screen stays mounted but invisible.
  - No animation is pending, so no frames are drawn. This matches the tester's frame counter frozen at 614.
  - The next tab switch (Storage) renders at once.
  - On the phone (E2E-P-1) the Evidence content was visible, which is consistent: a screen already visited keeps opacity 1 when both of its updates are lost.
  - The `uiautomator` dump listing no `screen-*` node is not proven to follow from this hypothesis.
- **Proposed change.** For the owner of `navigation/app-tabs.tsx`: start a focused tab screen at its settled opacity under reduced motion, or set the settled opacity as a React style once the fade ends, so a lost update cannot leave the pane invisible. Then verify on the tablet (Evidence detail, More menu, tap outside, rail Devices).

## 5. Ledger

### 5.1 Commands and results

| Check | Command (in `apps/mobile`) | Result |
|---|---|---|
| Targeted (new and adjusted) | `CI=1 npx jest --maxWorkers=2 --verbose` on the 6 new test files, the 3 adjusted ones and `summary-live-static` | **10 suites, 92 tests passed** (`assets/11d_fxm2_targeted.log`) |
| Typecheck | `npm run typecheck` | exit 0 (`assets/11d_fxm2_typecheck_lint.log`) |
| Lint | `npm run lint` | exit 0, no output: 0 errors, 0 warnings (same log) |
| Full suite (once) | `CI=1 npm run test -- --maxWorkers=2` | **158 suites passed, 1,829 tests passed, exit 0, 152 s**; load 4–10, no pause needed (`assets/11d_fxm2_full_suite.log`) |
| Mutations, in memory | `python3 .cache/fx_m2_mut/mutate.py control`, then `P R M H B` | control: 9 files, 74 tests, exit 0. **21 of 21 detected**: P1 and P2; R1 to R9; M1 to M4 (M2 re-run after a non-unique search text); H1 to H3; B1 to B3. The mutated files were identical in the tree before and after (`assets/11d_fxm2_mutations.log`, driver `assets/11d_fxm2_mutate.py.txt`, transformer `assets/11d_fxm2_mutating_transformer.cjs.txt`, config `assets/11d_fxm2_jest_mut_config.cjs.txt`) |

- The run included whatever FX-M1 had written at that moment.
- One pre-existing "not wrapped in act" warning comes from the untouched test "resumes a CREATE session" in `session-new-screen.test.tsx`. FX-M2's two tests emit none (checked one by one).

### 5.2 Files

**Production, edited (diff in `assets/11d_fxm2_changes.diff.txt`):**
- `apps/mobile/src/features/home/home-screen.tsx`
- `apps/mobile/src/features/dashboard/quick-actions.tsx`
- `apps/mobile/src/features/sessions/hub-top.tsx`
- `apps/mobile/src/app/(app)/session/new.tsx`
- `apps/mobile/src/features/settings/maintenance-section.tsx`
- `apps/mobile/src/app/(app)/session/live.tsx`
- `apps/mobile/src/features/session-finalizing/session-finalizing-screen.tsx`
- `apps/mobile/src/features/evidence/metadata-tab.tsx`
- `apps/mobile/src/features/evidence/evidence-detail.tsx`
- `apps/mobile/src/features/devices/devices-screen.tsx`

**Production, new:**
- `apps/mobile/src/features/rbac/use-role-gate.ts`
- `apps/mobile/src/features/session-new/use-start-entry-guard.ts`
- `apps/mobile/src/features/session-finalizing/handover.ts`
- `apps/mobile/src/features/devices/panel-boundary.tsx`

**Tests, new:**
- `apps/mobile/src/features/home/stack-proof-source.test.tsx`
- `apps/mobile/src/features/rbac/role-gate-r2.test.tsx`
- `apps/mobile/src/features/rbac/live-role-gate-r2.test.tsx`
- `apps/mobile/src/features/evidence/live-evidence-metadata-record.test.tsx`
- `apps/mobile/src/features/session-live/live-stop-handover.test.tsx`
- `apps/mobile/src/features/devices/devices-states.test.tsx`

**Tests, adjusted by design:**
- `apps/mobile/src/features/settings/live-settings-sites.test.tsx` (R2 lock for SUPERVISOR, 403 path kept)
- `apps/mobile/src/features/session-new/session-new-screen.test.tsx` (R2 entry, create-error path kept)
- `apps/mobile/src/features/devices/devices-live-static.test.ts` (new file and its UI timer)
- `apps/mobile/src/features/session-summary/summary-live-static.test.ts` (new file)

**Not touched:** every file outside FX-M2's paths, including `components/composed/nav/**`, `navigation/**`, `runtime/**`, `packages/**`, the i18n of `packages/shared`, and `apps/mobile/src/i18n/**` (no key was needed).

## 6. For the controller

1. **(Resolved by the grant: see §FX-M2b.)** A path grant or re-partition is needed for E2E-P-1 and E2E-P-3. The files are `apps/mobile/src/components/composed/nav/{nav-item.tsx,use-indicator.ts,bottom-tab-bar.tsx,nav-rail.tsx,live-mini-bar.tsx}`. `apps/mobile/src/navigation/app-tabs.tsx` (TabScreenFade) is also needed for E2E-T-2's likely cause. The proposed changes are in §4.1, §4.2 and §4.4. E2E-P-3 is a one-line change. E2E-P-1 and E2E-T-2 need checking on the devices.
2. **Decision to record (R2 as implemented):**
   - Start Session and Continue setup are disabled without SESSION_START on Home and the Sessions hub.
   - `/session/new` is refused at entry for a known role without SESSION_START: the route goes Home with a toast.
   - Install update is disabled without MAINTENANCE, which also locks it for SUPERVISOR.
   - The ways back to an active session are not gated.
3. **Decision to record (E2E-P-4):** the live route hands over to Finalizing in place, with no enter motion for the hand-over copies. The tablet seal lag is not caused by a poll in mobile code (§4.3). It goes to W98 with a re-measure in the re-test round.
4. **Partition notes:**
   - E2E-P-2 was done here, as the brief says, though D201 lists it under FX-M1.
   - E2E-T-5 (note label) was left to FX-C, as the brief says, though D201 lists it under FX-M2.
5. **Re-test round:** for each defect, the steps on the devices are the original reproduction steps in 07c and 07d. In addition: TECHNICIAN on the phone, Start locked on Home and the hub; INVESTIGATOR on the tablet, Install update locked; a role change on the web re-gates without a sign-in; a web stop shows Finalizing with no black frame; the Metadata tab of a Core-only item shows the Core record.

## FX-M2b — follow-up with the path grant (2026-10-06 12:11–12:40)

**Grant (controller, after FX-M1 finished):** `apps/mobile/src/components/composed/nav/**` and `apps/mobile/src/navigation/**`. The rules and rollback folder are unchanged. Nine more rollback copies were taken before the first edit: `nav-item.tsx`, `use-indicator.ts`, `bottom-tab-bar.tsx`, `nav-rail.tsx`, `live-mini-bar.tsx`, `index.ts`, `app-tabs.tsx` and `root-navigator.tsx`, all appended to `SHA256SUMS.txt`. All of them matched HEAD (`git status` showed no change before the edit).

**Status of FX-M2b:** items 1 to 4 are done in code and in jest. For E2E-P-1 and E2E-T-2, what only the devices can confirm is listed in §B.5.

### B.1 E2E-P-3 — the Recording bar reads the store's clock

- **Change.** `components/composed/nav/live-mini-bar.tsx:57-67,83`: the private `useElapsedSeconds(startedAtMs)` is removed. It sampled `Date.now()` on its own 1 s `setInterval`. It is replaced by `useRecordingSeconds()`, which returns `useSim(selectElapsedSeconds)`. That is the same store clock, and the same `floor((clock.now - startedAt) / 1000)`, that Home (`use-home-data.ts:92-94`), the monitor (`use-monitor.ts:79`) and the Sessions hub (`use-sessions-data.ts:134-136`) read. The pure `elapsedSeconds` export is kept.
- **Test.** New `components/composed/nav/live-mini-bar-clock.test.tsx`, 1 test. It renders Home with the bar over it, over a recording on the test simulator's manual clock (deliberately not the device clock). It runs 25 steps of 370 ms, which are not whole seconds. At every step Home's `home-status-timer` and the bar's `nav-mini-bar-timer` show the same value, and that value is the store's `selectElapsedSeconds`.
- **Mutation.** C1 (the old bar from the rollback copy) and C2 (the device clock against the session start) are detected.
- **Residual risk.** The bar now shows the store's time. In Live mode that is the Core's clock, the same as every other timer, so a device whose clock is off still agrees with itself.

### B.2 E2E-P-1 and E2E-T-2 — the settled state is drawn by React; motion is an overlay React removes

- **What the change removes.** Three places drew their FINAL state only through UI-thread animated styles:
  1. `nav-item.tsx`: the icon's gold and grey layers came from opacities of one shared value, and the label colour from an animated style.
  2. `use-indicator.ts`, `bottom-tab-bar.tsx`, `nav-rail.tsx`: the pill and rail card position came from a UI-thread transform.
  3. `navigation/app-tabs.tsx` `TabScreenFade`: a newly focused screen was created at `opacity 0` and faded in on the UI thread.

  When the updates of one commit were lost on the device, those views kept their old values. That is the 90a picture on the phone, and the 12_devices_blank picture on the tablet, including the screen mounted at opacity 0.
- **The change.**
  - **`NavItem`** (`nav-item.tsx`): the icon and label colours are plain React props of `active` (`NavItemFace`: gold or grey; stroke 2 or 1.75).
    - M-MB-01's 240 ms cross-fade is now `FadingFace`: a copy of the item in its PREVIOUS colours, laid exactly over it (same layout style, `absoluteFill`) and faded 1 to 0 on the UI thread.
    - `useColorFade` unmounts that copy on a React commit after `colorFadeBudgetMs` (240 ms, ×10 in proof mode, plus 60 ms), whether or not the fade ran.
    - Reduced motion draws no copy (a jump, as before). The copy is hidden from TalkBack and untouchable.
  - **The indicator** (`use-indicator.ts`, new `indicator-travel.tsx`, `bottom-tab-bar.tsx`, `nav-rail.tsx`): the settled pill, streak and rail card are plain views placed by React at the active item's frame (`settledBoxStyle`).
    - A trip (full motion, not the first placement) adds `IndicatorTravelLayer`: a travelling copy mounted at the old frame and moved with the `indicator` spring (proof mode `slowSpringTiming`).
    - The settled view is hidden, not moved, during the trip. `useIndicatorTrack` ends the trip on a React commit after `indicatorTravelBudgetMs` (600 ms; proof mode 6.4 s plus 100 ms).
    - Reduced motion never travels.
  - **`TabScreenFade`** (`app-tabs.tsx`): the content is ALWAYS drawn at full opacity by React.
    - M-APP-04's 160 ms cross-fade is a veil in the canvas colour (`palette.black`) laid over the newly focused screen and faded 1 to 0 on the UI thread (`FadeVeil`).
    - `useFocusVeil` unmounts it after `tabFadeBudgetMs` (`fast` plus 80 ms).
    - A lost update can keep the veil for that budget, about a quarter of a second, never longer. Before, the screen stayed invisible for minutes.
- **What jest can prove, and how.** New `navigation/__tests__/chrome-lost-updates.test.tsx`, 4 tests, on the real route tree (router harness: real `AppTabs`, `BottomTabBar`, `NavRail` and screens).
  - It **models the device defect at its worst**: `useAnimatedStyle` is mocked to keep the style of its first render forever, so no UI-thread update ever lands.
  - Visibility is computed the way a person sees it: the product of opacities up the tree, and 0 under `display: 'none'`.
  - Phone, E2E-P-1's steps (Sessions, a session detail, then Evidence, then Devices):
    - the visible icon and label of the active tab are gold and every other tab's are grey;
    - the one visible pill is centred on the active tab;
    - the switched-to screen has opacity 1 and no visible veil covers it.
  - Full motion: the fading copies, the travelling pill and the veil EXIST during the motion. Exactly one pill is visible during a trip. All of them are gone after their budgets.
  - Reduced motion (the testers' `motion=off`): correct at once, and no overlay is ever drawn.
  - Tablet, E2E-T-2's steps (Evidence detail, then rail Devices): the Devices screen has opacity 1 at once and after the budgets, Devices is gold and Evidence grey, and the rail card is on Devices.
  - The existing `chrome.test.tsx` (selection, haptics, rail, mini-bar, rotation without remount) is unchanged and green.
- **Mutation** (11 mutants, all detected).
  - **The old code back, in memory**:
    - N1: the old `NavItem`. The test fails on visible tints: gold where grey is expected, the 90a picture.
    - N2: the old track, bar and rail. The test fails on the visible pill at x ≠ 177 and the rail card at y ≠ 204: the indicator on the old tab.
    - N3: the old `TabScreenFade`. The test fails because the switched-to screen's effective opacity is 0, the invisible-but-mounted Devices screen of E2E-T-2.
  - **Each guarantee broken**:
    - N4, N5, N6: a trip, a fade or a veil never ends;
    - N7: the settled pill is shown during a trip;
    - N8, N9: reduced motion still fades or travels;
    - N10: the rail card stays hidden;
    - N11: the colours follow a one-shot first state.

### B.3 Stale comments in `navigation/root-navigator.tsx`

- **Change.** The header comment (formerly lines 23-30) said the guard "falls back to the anchor `/`" after a sign-out. It now says:
  - React Navigation keeps every route that is still allowed;
  - the fallback to `/` happens only when nothing is left underneath;
  - this navigator handles a public screen left on top after a SIGN-IN;
  - after a SIGN-OUT, `SignedOutLanding` (`src/runtime/signed-out-landing.tsx`, row FX-M1, E2E-S-1; decision DX-2, mounted by `src/app/_layout.tsx`) resets to `/`.
- **Proof that only comments changed.** The file with every comment removed is byte-identical to the rollback copy (`cmp`, checked at 12:26).

### B.4 Item 4 — the three `ReferenceError: Property 'OperatorRole' doesn't exist` lines

- **The log.** `.cache/manual/metro.log:643-645` has three lines, one per device: the three launch IDs `Lmuw2ph6m`, `Lmuw3xpu5` and `Lmuw4fcfk` reload together just before and just after. The lines carry no timestamp. They fall between `Live source ready` at 04:26:34Z (11:26:34 WIB, line 640) and the next one at 04:34:02Z (11:34:02 WIB, line 658).
- **FX-M2's files in that window:**
  - The only FX-M2 file that names `OperatorRole` is `features/rbac/use-role-gate.ts`. It was written ONCE at 11:30:25 (a single whole-file write; its mtime has not changed since).
  - It imports `type OperatorRole` (an inline `type` specifier) and uses it only in type positions (`:31`, `:35`). The app's own Babel transform of the file contains **no** `OperatorRole` identifier at all (output mentions: 0).
  - The only FX-M2 file that uses `OperatorRole` as a VALUE is `features/rbac/role-gate-r2.test.tsx`. That is a jest test with a value import, and it is not part of the Metro bundle.
  - No other FX-M2 file of that window (home-screen, quick-actions, hub-top, the entry guard, the route, maintenance-section) names `OperatorRole`. So none of FX-M2's edits can have produced the error.
- **The current tree is clean.**
  - `assets/11d_fxm2b_operator_role_check.log`: all 23 production files that name `OperatorRole` (mobile and `packages/shared`) were transformed with the app's Babel options, and every `OperatorRole` reference in the output that has no binding was listed. The result is **0**.
  - The check's control (`selftest` lines) shows it reports a planted half-edit (a value use under a type-only import, or under no import yet) and passes the finished forms.
  - Typecheck passes, and the full jest suite loads `runtime/core-errors.ts:85` (top-level `OperatorRole.INVESTIGATOR`) and `packages/shared/src/sim/session-machine.ts` without error.
- **Most likely source (a hypothesis, not proven: the Metro lines have no time).** In that window another row edited `packages/shared/src/sim/session-machine.ts` (FX-C, E2E-T-5). The diff against HEAD adds `noteLabel(role)` with VALUE uses `OperatorRole.SUPERVISOR`, `.INVESTIGATOR` and `.TECHNICIAN` (`:1122-1128`) plus the import `OperatorRole,` (`:65`). The file's last save was 11:34:13.
  - An intermediate save holding the uses before the import gives exactly this Hermes error during Fast Refresh. The selftest's second sample reproduces that.
  - The error did not recur after 11:34. The three devices reloaded (`Live source ready` at 04:34:02Z, 04:34:14Z, 04:35:14Z).
  - Verdict: a transient half-edit during Fast Refresh, not FX-M2's, and the tree is clean.

### B.5 What only the device re-test can confirm (for the controller's round on both emulators)

1. **The mechanism.** Jest proves that the final state is right even if EVERY UI-thread update of a switch is lost. That loss is the hypothesis behind 90a and 12_devices_blank. The devices must show that after the original steps the highlight follows the tab:
   - phone: Sessions, a session detail, Evidence, then Devices, then More, in motion off and on;
   - tablet: Evidence detail, More menu, tap outside, rail Devices;
   - the Devices content draws at once.
2. **The look of the motion.** Three things need eyes, not jest:
   - the fading copy lies exactly over the item (same layout box inside `PressableFeedback`), with no visible double icon or label;
   - the travelling pill or card hands over to the settled one without a visible jump (if the spring has not settled within 600 ms, the hand-over snaps the last pixels);
   - the 160 ms veil reads as the former content cross-fade.
3. **Under JS-thread starvation** (host load above 20), React's timers fire late, so a copy or veil can stay longer than its budget. It still ends; before, a lost update lasted until the next tab switch.
4. **The `uiautomator` observation** of E2E-T-2 (no `screen-*` node while blank) is not explained by the opacity hypothesis. After the fix the screen is never at opacity 0, so a recurrence of the blank pane on the device would point elsewhere (for example the screen container of `react-native-screens`). The re-test should capture `uiautomator` again if it happens.
5. **E2E-P-3.** The bar and the Home timer should match in every frame of a screen recording, because both change in one store publish.

### B.6 Ledger (FX-M2b)

| Check | Command (in `apps/mobile`) | Result |
|---|---|---|
| Targeted | `CI=1 npx jest --maxWorkers=2` on `live-mini-bar-clock`, `chrome-lost-updates`, `chrome`, the `navigation/**` and `components/composed/nav/**` suites, and the FX-M2 suites | **24 suites, 235 tests passed**, jest exit 0 (`assets/11d_fxm2b_targeted.log`) |
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | exit 0 (`assets/11d_fxm2b_typecheck_lint.log`, 12:35) |
| Lint | `npm run lint` | exit 0, no output (0 errors, 0 warnings) |
| Full suite, once | `CI=1 npm run test -- --maxWorkers=2` | **160 suites passed, 1,834 tests passed, exit 0, 157 s** (load 5–8, no pause). That is 2 suites and 5 tests more than FX-M2's run, exactly FX-M2b's new tests (`assets/11d_fxm2b_full_suite.log`) |
| Mutations, in memory | `python3 .cache/fx_m2_mut/mutate_b.py control C N` | control: 3 files, 23 tests, exit 0. **13 of 13 detected** (C1, C2, N1 to N11). The mutated files were identical in the tree before and after (`assets/11d_fxm2b_mutations.log`; driver `assets/11d_fxm2b_mutate.py.txt`; transformer, now multi-file, `assets/11d_fxm2b_mutating_transformer.cjs.txt`) |
| OperatorRole | `node .cache/fx_m2_mut/operator-role-check.cjs` and `operator-role-selftest.cjs` | 23 files, 0 unbound references; the control catches both half-edit forms (`assets/11d_fxm2b_operator_role_check.log`, scripts `…_check.cjs.txt`, `…_selftest.cjs.txt`) |

**Files (FX-M2b).**
- **Edited:**
  - `apps/mobile/src/components/composed/nav/live-mini-bar.tsx`
  - `apps/mobile/src/components/composed/nav/nav-item.tsx`
  - `apps/mobile/src/components/composed/nav/use-indicator.ts`
  - `apps/mobile/src/components/composed/nav/bottom-tab-bar.tsx`
  - `apps/mobile/src/components/composed/nav/nav-rail.tsx`
  - `apps/mobile/src/components/composed/nav/index.ts` (exports)
  - `apps/mobile/src/navigation/app-tabs.tsx`
  - `apps/mobile/src/navigation/root-navigator.tsx` (comments only)
- **New:**
  - `apps/mobile/src/components/composed/nav/indicator-travel.tsx`
  - tests `apps/mobile/src/components/composed/nav/live-mini-bar-clock.test.tsx` and `apps/mobile/src/navigation/__tests__/chrome-lost-updates.test.tsx`
- **Diff:** `assets/11d_fxm2b_changes.diff.txt`.
- **Not touched:** everything outside the two granted folders and FX-M2's own paths. `root-navigator.tsx` code is unchanged.

**For the controller:**
1. **Decision to record (E2E-P-1, E2E-T-2):** the nav chrome and the tab content draw their settled state with React props. The M-MB-01 and M-APP-04 motions are overlays that a React commit removes after a fixed budget (colour fade 300 ms, indicator trip 600 ms, content veil 240 ms; ×10 in proof mode). Reduced motion draws no overlay except the short content veil.
2. **Decision to record (E2E-P-3):** the Recording bar reads the store clock (`selectElapsedSeconds`).
3. **Item 4:** not FX-M2's. The tree is clean. The most likely source is a transient half-edit of `packages/shared/src/sim/session-machine.ts` (FX-C) during Fast Refresh. Nothing to fix.
4. **Re-test round:** §B.5.
