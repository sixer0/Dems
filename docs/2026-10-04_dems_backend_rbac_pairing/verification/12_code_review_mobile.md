# W93 — Code review of `apps/mobile` (read-only)

**Reviewer:** senior-code-reviewer (plan row W93, AC-C-66) · **Date:** 2026-10-07 05:28-05:45 · **Narrative tier:** 2
**Status:** complete · **Verdict:** APPROVED WITH COMMENTS (0 Blocker, 2 Major, 15 Minor, 9 Nit, 2 Info)

**Scope.** `apps/mobile` with the uncommitted window since commit `057fc17` in focus: `git diff 057fc17 -- apps/mobile`
(86 tracked files, +1,705 / -427) plus 60 untracked files (new runtime modules `stall-tolerant-timers.ts`,
`core-clock.ts`, `ended-link.ts`, `probe-failure.ts`, `pairing-gate-snapshot.ts`, `signed-out-landing.tsx`; feature
files `monitor-handoff.ts`, `summary-handoff.ts`, `session-finalizing/handover.ts`, `timer-readout.tsx`,
`selection-glow.tsx`, `menu-item-text.tsx`, `panel-boundary.tsx`, `use-start-entry-guard.ts`, `rbac/use-role-gate.ts`,
`navigation/tab-root.ts`, `nav/indicator-travel.tsx`, and their tests). Every item routed to W93 in
`decisions/decisions.md` (D175, D180, D189, D203, D205, D208, D216, D217, D218, D235, D236, D237, D239) is answered in §3.

**Rules kept.** Read-only: nothing modified except this file and `delegation_progress/w93_review_mobile.md`. No
emulator, no server. Load checked before each heavy command (`uptime`: 3.53, 2.43, 3.58). No secret printed.
`masterplan/02_plan.md` was not edited (parallel run: the controller owns the shared trackers).

---

## 1. Fresh evidence

| Check | Command | Result |
|---|---|---|
| Typecheck | `cd apps/mobile && npx tsc --noEmit; echo $?` | `tsc exit 0` |
| Lint | `npx eslint . ; echo ${pipestatus[1]}` | `eslint exit 0` |
| The two W89 load-flaky tests, alone | `npx jest --maxWorkers=1 --verbose src/features/session-new/live-session-new-followups.test.tsx src/features/more/more-live.test.tsx` | 2 suites / 14 tests pass; the flaky ones took **341 ms** (`a confirmed cancel (delta-first)`, line 166) and **185 ms** (`the footer reads "Core Live"`, line 76) |
| Ownership (AC-C-66) | `git diff --stat acaff20` outside `apps/mobile` and `docs/`, cross-read with the mobile rows' own reports | See §5: PASS |
| Graft | `graft grep "function elapsedSeconds"` | 3 implementations; the `live-mini-bar.tsx:53` one has 0 in-edges (W93-20). `graft callers RollingNumber` finds no JSX edges (graft does not index JSX use), so consumer lists below come from `grep -rn '<RollingNumber'` |

---

## 2. Summary by domain

| Domain | Verdict | Issues |
|---|---|---|
| Code structure | CAUTION | W93-18, W93-19, W93-24 |
| Dependency impact | PASS | 0 (no consumer breaks; typecheck and lint clean; ownership PASS) |
| Duplication | CAUTION | W93-3, W93-18, W93-19, W93-20, W93-24 |
| Maintainability | CAUTION | W93-12, W93-13, W93-14, W93-17, W93-21, W93-22, W93-26 |
| Reference integrity / correctness | CAUTION | W93-1, W93-2, W93-4..W93-11, W93-15, W93-16, W93-23, W93-25 |

No Blocker. The two Majors are the same two defect mechanisms the closing-fix rounds already fixed elsewhere (D214
digit loss, RF-T-1 border change), still present in places the fix rounds did not own.

---

## 3. Routed items (confirmed / not confirmed, with the fix proposal)

| # | Routed item (source) | Status | Finding | Fix proposal (one line) |
|---|---|---|---|---|
| R1 | `animation: 'none'` for the Summary screen in `navigation/stacks.tsx` (D236) | **Confirmed** | W93-6 | `SessionFlowStack` gets `<Stack.Screen name="summary/[id]" options={{ animation: 'none' }} />` (and the same for `finalizing`) |
| R2 | React-held rest values for `components/composed/stepper.tsx:229,284-285,323` (D236) | **Confirmed** | W93-7 | React holds the fill, ring and check rest values; an `animate={false}` prop for the in-place copies |
| R3 | Home header clock and Network & Time System Time card hold seconds at :00 (D235 O-CF2-B-1, D237 O-RF2-2) | **Not confirmed as a defect: by design under `?motion=off`** | — | No code fix. Write it into the device-test brief (below) |
| R4 | Faded 'Sealed' chip on the Sessions detail image (D235 O-CF2-B-2) | **Confirmed; cause revised** | W93-9 | An opaque backplate behind chips laid over media |
| R5 | Other kit Cards whose border width changes with state (D235, the RF-T-1 mechanism) | **Confirmed: 1 Card, 1 list item** | W93-2 (Audit row, Major), W93-4 (Device row, Minor) | `ROW_CARD_BORDER` + `SelectionGlow` (move both to `components/composed`) |
| R6 | RF2-1 tablet Sessions detail pane breaks two-word subject names inside a word (D237) | **Confirmed in code** | W93-8 | The subject row wraps the chip, not the name |
| R7 | RF2-2 tablet web stop ~11 s in left 'Recording' up 3-7 s (D237) | **Not established in code**; narrowed | W93-28 (Info) | W98 diagnostics listed in W93-28 |
| R8 | Dark boot frame between Login and Pair on revoke; a cheaper first Pair render (D218) | **Confirmed (by reading)** | W93-10 | The boot router draws Pair in place (the D201 recipe), with no stack fade for that swap |
| R9 | Stale comments `navigation/root-navigator.tsx:23-30` (D203, D205) | **Not stale any more** (rewritten by FX-M2b, D208) | W93-22 for the stale helper at `:92-96` | — |
| R10 | Three wall-clock timeout risks (D203) | Secure-store budget: **confirmed residual** (W93-16). STALE under starvation: **mitigated** by `stall-tolerant-timers.ts`, residual bounded to about 1 s (no new finding; W98 measures it on a release build). Command timeouts: **confirmed residual** (W93-15) | W93-15, W93-16 | See the findings |
| R11 | O-CF-M2-1: export sheet source Alert says 'Verified by the Core' under a Core FAIL, `export-sheet.tsx:529` (D216) | **Confirmed** | W93-5 | `pass ? integrity.verifiedByCore : integrity.failedOnCore` |
| R12 | `devices/motion.ts` logging (W1 DC-6) | **Not in `apps/mobile`.** The file is `apps/core-web/src/features/devices/motion.ts` (web, W92). Its mobile counterpart exists | W93-13 (mobile analogue in `app/_layout.tsx:101-104`) | — |
| R13 | The two W89 flaky tests need explicit timeouts (D239) | **Confirmed** (no third `it` argument at either line) | W93-17 | `it(..., 20_000)` on both; root `npm test` with `--maxWorkers=50%` |
| R14 | The runtime's stall-tolerant timers and Core clock, for correctness (D218, D236) | **Correct as written**, one robustness gap | W93-12 | Re-arm the ticker in `finally` |
| R15 | M2 sweep §5 (D180 DN-6): L-1, D-1, F-1 | L-1 **closed** (`login-screen.tsx:64` reads `coreChipFor(controller.coreLink, controller.coreLook)`); F-1 **re-run, clean** (no link-down derivation in `features/settings/**`); D-1 **still open (Info)** | W93-27 | — |
| R16 | W87-F3: older "one toast" test titles without a call count (D189) | **Confirmed, 4 titles** in `storage-screen.test.tsx`, `network-time-screen.test.tsx`, `runtime/live-core-errors.test.tsx`, `runtime/live-device.test.tsx` | Folded into W93-17's fix pass (Nit) | Name the count in the title or assert `toHaveBeenCalledTimes(1)` |
| R17 | D217: header poster placeholder 'No DEMO media' on a failed media lookup; an optional dedicated Live sentence | **Not applicable to mobile.** CF-W is the web. Mobile's sentence `features/evidence/i18n.ts:67` ("No DEMO media for this item on this device.") is true in both modes | — | — |

**R3 evidence.** `features/dashboard/home-header.tsx:155`:
`useSim((s) => (testSwitch ? Math.floor(selectClockSecond(s) / 60) * 60 : selectClockSecond(s)))` with
`testSwitch = linkMotion === 'off'`. `features/network-time/use-network-time.ts:42-44`: `useDisplaySecond()` returns
`heldSecond(selectClockSecond(s), testSwitch)`. RF2 launched both devices with
`am start … -d 'demsdemo:///login?core=LIVE&motion=off'` (`test/11_final_check_cf2.md:51`). The D43/MA-12 test switch
holds both clocks at the minute on purpose, so uiautomator can reach idle. So the ":00" captures are the switch working
as designed. Brief fix: device-test briefs say "clock seconds are frozen at :00 under `motion=off`; judge clocks only
with `motion=full`".

---

## 4. Issues found

| # | Severity | Domain | File:Line | What | Why it matters | Fix direction |
|---|---|---|---|---|---|---|
| W93-1 | 🔴 Major | Correctness | `components/composed/nav/live-mini-bar.tsx:118-127` (timer), `:66-68` (`useRecordingSeconds` → `selectElapsedSeconds`) | The bottom Recording bar still draws the recording time with `RollingNumber mode="slide"`. D214 found that this component loses settled digit positions after a JS stall ("04:24 read 04:12", `timer-readout.tsx:5-24`). The bar also reads only the store clock, which CF2-A showed can hold for 5-21 s under load (RF-PH-1). CF2-A fixed both only for the monitor (`TimerReadout` + `createElapsedTicker`) | The same recording time can step backwards or freeze on every tab while recording. That is the exact defect the operator saw on the monitor. The bar is on screen whenever a session records outside the monitor | Draw the bar with `TimerReadout` (or with the folded `RollingNumber` of W93-3). Read the time through `useMonitorElapsedSeconds()`, moved to `@/runtime` or a shared hook so the bar does not import from a feature |
| W93-2 | 🔴 Major | Correctness (RF-T-1 family) | `features/audit/audit-row.tsx:75`, `:147-149` | A kit `Card` with `overflow: 'hidden'` gets `borderWidth: 1` only while `selected` (`cardSelected`) or `broken` (`cardBroken`), and none otherwise. This is the mechanism CF2-B proved on the device: a kit Card that drops its 1 dp border on deselection is left undrawn (`selection-glow.tsx:30-37`, D235) | On the tablet's Audit list (master-detail) a deselected or no-longer-broken row can draw as an empty card, exactly as Evidence and Sessions rows did before CF2-B. Not yet seen on a device. Rated Major because the same code shape produced a Medium device defect twice | `card: { ..., ...ROW_CARD_BORDER }`, `cardSelected: { borderColor: palette.gold }`, `cardBroken: { borderColor: palette.danger }`. Add the always-mounted `SelectionGlow` if the row has a glow. Prove it with a deselect-drawn test like `evidence-row-deselect-drawn.test.tsx` |
| W93-3 | 🟡 Minor | Duplication / correctness | `components/composed/rolling-number.tsx` (slide mode); consumers `features/dashboard/home-header.tsx:163`, `network-time/system-time-card.tsx:74`, `network-time/network-status-card.tsx:178`, `dashboard/system-status-card.tsx:209`, `sessions/hub-top.tsx:134`, `storage/capacity-card.tsx:79`, `dashboard/status-tiles.tsx:83`, `dashboard/recent-sessions.tsx:125`, `more/console-tiles.tsx:140`, `login/login-card.tsx:499`, `pairing/pairing-code-panel.tsx:248` | `TimerReadout` (`features/session-live/timer-readout.tsx`, 140 lines) re-implements `RollingNumber`'s slide columns ("the layout is the one of `RollingNumber`'s slide columns", `:31-32`) with React-held positions. The kit component keeps the D214 defect for its 11 other consumers | Clocks and counters elsewhere can show a stale digit after a JS stall (the Home header clock, System Time). There are two components to keep in step | Move the React-held column positioning into `RollingNumber` itself. `TimerReadout` then becomes `RollingNumber format="duration"`, and every consumer gets the fix |
| W93-4 | 🟡 Minor | Correctness (RF-T-1 family) | `features/devices/device-row.tsx:184`, `:192`, `:255` | A `ListGroup.Item` gets `borderWidth: 1` + background only when selected, and the `GlowLayer` is mounted only when selected. This is the pre-CF2-B Evidence pattern, though not on a kit `Card` | It is lower risk than W93-2 (no Surface shadow). CF2-B's device capture `13b_devices_rows_deselect_ok_untouched.png` shows device rows drawn after deselection. Kept as Minor because the shape matches the defect | Same recipe as W93-2: a constant border, colour-only change, and the always-mounted `SelectionGlow` |
| W93-5 | 🟡 Minor | Correctness (copy) | `features/evidence/export-sheet.tsx:529` | `Alert.Description` always reads `` `${t('features.evidence.integrity.verifiedByCore')} · …` `` even under `status="danger"` (FAIL). O-CF-M2-1 | Under a Core FAIL the sheet tells the investigator the item was "Verified by the Core", which contradicts the title above it and the Integrity tab (`CORE_HEADING_KEYS.FAIL`) | `t(pass ? 'features.evidence.integrity.verifiedByCore' : 'features.evidence.integrity.failedOnCore')` (the key exists, `evidence/i18n.ts:157`). Add a FAIL case to `live-evidence-export.test.tsx` |
| W93-6 | 🟡 Minor | UX / navigation | `navigation/stacks.tsx:36-48` | `SessionFlowStack` gives every screen `stackAnimation('tabs')` = `fade`. The finalizing → `summary/[id]` replace therefore fades between two identical screens (the in-place Summary, `session-finalizing-screen.tsx:107-109`). That is the 30-70 ms empty frame D236 and RF2 measured (5/6 phone, 2/3 tablet) | One visible blank frame at the most important moment of the flow, after CF2-A removed the others | `<Stack.Screen name="summary/[id]" options={{ animation: 'none' }} />` and `name="finalizing"` the same. Entering the flow from the tabs is unaffected: that motion belongs to `AppStack`'s `session` screen (`stacks.tsx:27`) |
| W93-7 | 🟡 Minor | Reanimated pitfall | `components/composed/stepper.tsx:217-229` (`ConnectorHalf` `fill`), `:260-285` (`StepBadge` `ring`/`halo`/`check`), `:321-323` (kit `Spinner`) | The rest values live only in shared values (scale, opacity, `strokeDashoffset`). CF2-A mapped the 12-tag "Unable to find SurfaceMountingManager" bursts to these views in the in-place Finalizing copy (`gateway_check/13a_cf2_mobile_runtime.md:255-290`) | Each in-place hand-off now mounts a Stepper and removes it within ~0.5 s. UI-thread updates target removed views (log noise of about 1,500 warnings per run), and a lost final value would leave a half-filled connector or a missing check: the RF-PH-4 class | React holds the rest value: `transform: [{ scaleX: filled ? 1 : 0 }]`, ring opacity `lit ? 1 : 0`, and the check drawn statically when `done`. The motion is an overlay removed after its budget (the FX-M2b pattern). Add `animate={false}` for in-place copies (`handover`) so they start no animation |
| W93-8 | 🟡 Minor | Layout (RF2-1) | `features/sessions/session-detail.tsx:196-201`, `:326-328` | The subject `Text` has `flexShrink: 1` in a `row` with the `SubjectTypeChip` and no `flexWrap`. Yoga may shrink it below its longest word, and Android then breaks inside the word ("Retno W / ulandari", "Siti Rahm / awati", `test/11_final_check_cf2.md:133`) | A misread name in the evidence record's detail pane | `subject: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', … }` with the name `flexShrink: 0, maxWidth: '100%'`, so the chip wraps under the name. Add a pane-width test with "Retno Wulandari" (`hub-pane-row-fit.test.tsx` style) |
| W93-9 | 🟡 Minor | Visual (O-CF2-B-2) | `features/sessions/session-detail.tsx:135-137`; recipe `packages/shared/src/tokens/status-tones.ts:46` (`bg-sealed-soft`) | The chip is not an unfinished fade. A pixel crop of `gateway_check/assets/13b_rft2_run2_sessions_panes.png` (2240-2480 x 200-300) shows solid violet text on a **translucent** soft background over the bright ceiling of the photo (detail chip background `(133,112,124)` vs list chip `(132,108,193)`). The hero chip has no `entering`; a lost fade would also dim the parent hero card, which the capture shows crisp | Low contrast on the status of the record, likely below AA on light images | Wrap chips laid over media in an opaque backplate (`backgroundColor: withAlpha(palette.black, 0.7)`, chip radius), or a solid recipe variant for overlays. Check the Evidence poster chips for the same |
| W93-10 | 🟡 Minor | UX (D218) | `app/index.tsx:15-19`, `navigation/root-navigator.tsx:125-136`, `features/pairing/pairing-screen.tsx:103`, `:131`, `:144` | On a revoke the guard removes `(auth)`, the stack falls back to `/`, and `BootRedirect` renders only `<Redirect href="/pair">`, which draws nothing. Then Pair mounts with an `auth` fade and its first render parses the topographic `SvgXml` (`TOPO_XML`) and rises its cards from opacity 0 (`enterRise`) | The dark frame between Login and Pair (D218), and a first Pair frame that costs SVG parsing and Reanimated setup on a starved debug build | Draw `PairingScreen` in place when `useBootHref()` is `/pair` (the D201 recipe: the screen in the same commit, the redirect after it), and skip the enter rise for that hand-off (a `pairing-handoff` mark like `monitor-handoff.ts`). Pre-rasterise the topo texture (`expo-image` of a bundled PNG) or defer it one frame. Measure on the W98 release build |
| W93-11 | 🟡 Minor | RBAC consistency | `features/dashboard/quick-actions.tsx:69`, `features/sessions/hub-top.tsx:155`, `features/settings/maintenance-section.tsx:268` vs `features/session-new/use-start-entry-guard.ts:33`; `features/rbac/use-role-gate.ts:35-39` | The buttons lock on `!gate.allowed`, so they are also disabled while the role is **unknown** (`known: false`, Live before the first snapshot), and `hint` is then `null`. The entry guard deliberately locks only on `gate.locked` (`known && !allowed`: "While no role is known yet the wizard is not refused: the Core decides"). Two rules for one permission | For that window a disabled Start Session shows no reason. The button and the deep link also disagree (the link opens the wizard, the button is dead) | Choose one rule and record it. Recommended: buttons use `gate.locked`, so an unknown role is not refused, matching the guard and "the Core decides". Otherwise show a neutral "Checking your role…" hint |
| W93-12 | 🟡 Minor | Timers (D218/D236 correctness) | `features/session-live/use-monitor.ts:130-144` | `createElapsedTicker`'s `tick` re-arms only on the success path. If `clock.now()` or a listener throws once, the `catch` logs and the ticker never runs again | The LIVE timer would silently fall back to the store clock: the hold-under-load defect RF-PH-1 returns for the rest of the session. The rest of the ticker is correct: monotonic, cleared on the last unsubscribe, plain timers, `msToNextSecond` floored at 50 ms | Re-arm in `finally` (when `listeners.size > 0`) and keep the error log. Add a test that throws once from `clock.now` |
| W93-13 | 🟡 Minor | Logging (mobile analogue of R12) | `app/_layout.tsx:101-104` | `RouteErrorFallback` calls `console.error('[mobile] route error', { message, stack })` **in render**. It repeats on every cooldown re-render (once a second during the 3/6/12 s countdown) and never reaches the persistent runtime log. The comment "No client-log endpoint exists … dev console only" is stale: `reportRuntimeIssue` exists | Repeated red LogBox entries, and a route crash missing from `dems.mobile.log.v1` (S73-9 asks for persistent logging) | `useEffect(() => reportRuntimeIssue('error', 'app.routeError', error), [error])` once per error. Drop the render-time console call (the runtime log mirrors `error` to `console.error` itself) |
| W93-14 | 🟡 Minor | Logging (DX-6 consistency) | `navigation/log.ts:26-27`, `motion/log.ts:27-28` (callers `navigation/tab-root.ts:59`, `app/+native-intent.tsx:32`) | These two logs still mirror `warn` to `console.warn`. DX-6 (D203) moved `runtime/log.ts:176` to `console.info` for `warn` because every `console.warn` becomes LogBox's "Open debugger to view warnings" bar | The tab-root fallback and a native-intent parse failure can still raise the yellow bar over the operator's screen (the F80 class) | The same rule in both files: `warn` → `console.info`, only `error` → `console.error` |
| W93-15 | 🟡 Minor | Wall-clock risk 3 (D203) | `packages/shared/src/client/core-client.ts:654-660` (global `setTimeout`), consumed at `runtime/sim-adapters.ts:447-448` | The typed client's 8 s budget (`LIVE_COMMAND_TIMEOUT_MS`) runs on the global timer, not the Live source's stall-tolerant `timers`. DX-4 re-checks probes once, but a **command** whose budget passes during a JS starvation reports `TIMEOUT` while the Core may have applied it (CL-6 says so) | Under starvation the operator sees "no answer" for a stop or marker that the next delta then shows as done. Bounded and accepted for the demo, but it is the last wall-clock deadline outside the stall rule | Shared-owner change (W91/W92): a `timers?: Pick<LiveSocketTimers,'setTimeout'|'clearTimeout'>` option on `CoreClientOptions`. Mobile passes `createStallTolerantTimers(...)`. Measure in W98 first; fix only if it reproduces on the release build |
| W93-16 | 🟡 Minor | Wall-clock risk 1 (D203) | `runtime/sim-adapters.ts:157` (`MOBILE_SECRETS_BUDGET_MS = 4_000`), `:549-557` (`devicePaired`), `:508-526` (`abandonRegistration`) | A keystore write slower than 4 s (a real slow write, which the stall rule does not cover) is judged failed. The registration is then unpaired and the stored value removed, even if the write later succeeds | The pairing code is single-use: a slow first keystore write on an emulator costs the operator a new code. The design is safe (no orphan credential), but the user pays | Raise both budgets together, keeping the order (for example 8 s here and 10 s for `LIVE_SECRETS_TIMEOUT_MS`), or log the late write's outcome (`late: true`, `ok`) so W98 can size it. Decide after the W98 measurement |
| W93-17 | 🟡 Minor | Test quality (D239) | `features/session-new/live-session-new-followups.test.tsx:166`; `features/more/more-live.test.tsx:76`; root `package.json:34` | Neither test has an explicit timeout. Alone they take 341 ms and 185 ms (§1). At load 16.7 they passed 5 s, a 15-25x slowdown, because root `npm test` gives each workspace's jest every core | The root gate flakes under load. Four "one toast" titles name no count (R16) | `it(title, fn, 20_000)` on both, as D239 rules. Consider `testTimeout: 15_000` in `jest.config.js` and `--maxWorkers=50%` for the root script. Retitle the 4 tests (R16) |
| W93-18 | 🟢 Nit | Duplication | `features/session-live/monitor-handoff.ts`, `features/session-summary/summary-handoff.ts`, `features/session-finalizing/handover.ts` | Three copies of the same module-level "one slot" mark (`let handedOff`, `mark…`, `is…`, `reset…ForTests`). None is ever cleared, so re-entering the same session's monitor from a Home banner also skips the rise (harmless) | Three places to change, three test resets | `createHandoffMark()` in `src/lib`, used three times |
| W93-19 | 🟢 Nit | Duplication | `components/composed/nav/nav-item.tsx:48-60` (`useColorFade`), `nav/use-indicator.ts:83-97` (trip), `navigation/app-tabs.tsx` (`useFocusVeil`) | Three hand-rolled "React-held final state + overlay with an id, removed after a budget" hooks (FX-M2b) | One pattern, three versions. The next fix round will write a fourth | `useTransientOverlay(trigger, budgetMs)` returning `{ id } \| null` |
| W93-20 | 🟢 Nit | Dead code / duplication / stale comment | `components/composed/nav/live-mini-bar.tsx:52-56` (+ re-export `nav/index.ts:4`), `:58-62`; `features/sessions/sessions-model.ts:306`; `features/session-live/session-live.math.ts:86` | `elapsedSeconds` in the mini bar is dead (`graft grep`: 0 in-edges; only the barrel re-exports it). Four elapsed-seconds implementations exist, counting the shared `selectElapsedSeconds`. The comment at `:58-62` says the store clock is "the one time source of … the monitor", which is untrue since CF2-A | Drift between timers that should agree | Delete the dead export. Keep `session-live.math.ts`'s helper (or the shared selector) as the one rule. Fix the comment along with W93-1 |
| W93-21 | 🟢 Nit | Stale comment | `features/session-live/rec-indicator.tsx:8-9` | "The timer is fed whole seconds from the simulator clock (S4)". In LIVE it is `max(store, Core clock ticker)` (`use-monitor.ts:93-105`) | Misleads the next maintainer about RF-PH-1 | One sentence pointing to `useMonitorElapsedSeconds` |
| W93-22 | 🟢 Nit | Stale helper (R9) | `navigation/root-navigator.tsx:92-96` | `summaryAcknowledgedOf` casts "if the runtime (step 73) adds it". `runtime/contract.ts:124` declares `summaryAcknowledged?: boolean` and `sim-runtime-provider.tsx:111` sets it | Dead indirection | Read `session.summaryAcknowledged` directly |
| W93-23 | 🟢 Nit | Performance | `features/session-live/session-live-screen.tsx:150-157` | `timelineItems(events).map(item => … events.find(e => e.id === item.id) …)` is O(n²) per monitor render | Small now. Grows with long sessions on the debug-build JS thread, which is the thread every residual of this round competes for | A `Map` by id built once per `events` (`useMemo`) |
| W93-24 | 🟢 Nit | Structure / consistency | `features/devices/panel-boundary.tsx` (third copy, after `dashboard/` and `storage/`), `:66-72`; `features/sessions/session-row.tsx` imports `@/features/evidence/selection-glow` | The boundary is copied "as P6: no shared component outside the screen folders", yet Sessions imports Evidence's `SelectionGlow` across features. The cooldown `setState` updater also calls `clearInterval` (a side effect in an updater, which StrictMode double-invokes) | Inconsistent application of P6; small purity slip | Move `PanelBoundary` and `SelectionGlow`/`ROW_CARD_BORDER` to `components/composed`. Clear the interval in `componentDidUpdate` |
| W93-25 | 🟢 Nit | Correctness (edge) | `features/evidence/evidence-model.ts:401-409` | When no custody entry matches the verification's `at`, `storedVerification` takes the newest entry of that action and still reports `actorKnown: true` | The "Last verification … · <actor>" line can name the operator of an older verification | `actorKnown: matched !== null`. Fall back to the "no actor" copy when there is no exact match |
| W93-26 | 🟢 Nit | Maintainability | `features/network-time/network-status-card.tsx:41-48` (`BANDWIDTH_ROW_METRICS`, `label: 72`, `readout: 84`) | The stacked/inline decision depends on hand-measured text widths | A copy change or a font change silently breaks the 314 dp threshold | Measure label and readout with `onLayout` (or `onTextLayout`) and compare with the row width |
| W93-27 | ℹ Info | Link wording (D-1, M2 §5) | `features/devices/devices-model.ts:103-104` | In LIVE the TABLET row still reads the replica's `tabletLink.state`, which by design does not move while this app's link is down | During an outage the row may read CONNECTED while the banner says the link is down (a hypothesis from the code; not run) | In LIVE, when `useCoreLinkNotice().offline`, word the row "Unknown — Core link down" |
| W93-28 | ℹ Info | Investigation (RF2-2) | stop path: socket delta → `live-socket-client.ts:970-994` (`handleDelta`) → store → `runtime/contract.ts:228` `useActiveSession` → `navigation/session-guards.ts:40-44` → `app/(app)/session/live.tsx:31-48`; SEALED → `runtime/session-route-sync.tsx:80` | Not established. See §6 | Medium per RF2; W98 measures | §6 lists the diagnostics |

---

## 5. Ownership (AC-C-66): no mobile row wrote outside `apps/mobile`

- `git diff --stat acaff20` outside `apps/mobile/` and `docs/`: `apps/core-server` (462 src + 107 test), `apps/core-web/src`
  (243), `packages/shared` (86 src + 46 test + `package.json`, `openapi/`, `scripts/`), `scripts/pg/*`, root
  `package.json`, `package-lock.json`, `README.md`.
- The mobile rows' own reports list no write outside `apps/mobile`. A grep for `packages/|apps/core-*|scripts/` paths
  in `delegation_progress/{fx_m1_mobile_link, fx_m2_mobile_screens, cf_m1_mobile_runtime, cf_m2_mobile_screens,
  cf2_a_mobile_runtime, cf2_b_mobile_screens, coder_execution_m0, m1, m2}.md` finds only mentions, never writes:
  - FX-M2: "most likely a transient half-edit of `packages/shared/src/sim/session-machine.ts` (FX-C)";
  - CF2-A: "`packages/shared` `clock.ts` is not changed (not in this row's paths)";
  - M0: "Not touched: … `packages/shared/**`, `apps/core-web/**`, `apps/core-server/**`".
- The shared symbols that mobile consumes in this window (`timelineTitleKey` in `packages/shared/src/sim/views.ts:342`,
  the `system.live.*` and `evidence.verify.last.*` keys) were added by the core row FX-C and the copy rounds D162/D177, per
  their decisions.
- **Verdict: PASS.** This rests on the rows' reports plus the diff. Git has no per-row authorship for uncommitted files, so
  this is the strongest attribution available.

---

## 6. RF2-2 investigation (tablet: web stop ~11 s in, 'Recording' held 3.2 / 6.7 s)

**What the evidence says** (`test/assets/retest3/tablet_session_runs.txt`, `device_js_logs_per_run.txt`):

| Run | Core stop -> Finalizing | Core seal -> device `routeSync` SEALED log | Monitor timer during the hold |
|---|---|---|---|
| T1 | 0.29 s | +0.30 s (22:41:46.552 -> 22:41:46.854) | — |
| T2 | 3.19 s | **+7.71 s** (22:48:48.816 -> 22:48:56.528) | held at 00:00:11 |
| T3 | 6.73 s | **+12.39 s** (22:51:10.839 -> 22:51:23.229) | held |

**What the code rules out or narrows:**

1. **The display path is not the cause.** The redirect is synchronous on `useActiveSession().state !== 'RECORDING'`
   (`session-guards.ts:40-44`), and the live route draws Finalizing in that same commit (`live.tsx:33-40`).
2. **A held digit means no React commit reached the screen.** Since CF2-A the LIVE timer is `max(store, ticker)`. The
   ticker is a plain 250 ms timer over `useSyncExternalStore` on the Core clock (`use-monitor.ts:93-159`), and the Core
   clock always advances with the local clock (`core-clock.ts:85-90`). A digit frozen for 3-7 s therefore means either
   the JS thread did not run that timer, or the UI thread did not present the commits. W93-12 is the only code path that
   stops the ticker while JS runs, and it would have logged `sessionLive.elapsedTick` as an `error`; the log shows none.
3. **The replica learnt both the stop and the seal late** (the SEALED log lags 7.7 / 12.4 s, the Finalizing steps
   "33 % complete" 6 s after the seal), with no socket close in the Core log, so there was no client restart (that path
   closes the socket, `live-socket-client.ts` `abandonConnection`).
4. Two candidates remain, and the code cannot decide between them without a measurement:
   - **(a)** The tablet's JS thread was blocked for seconds right after the stop: synchronous render work across the
     tablet's mounted multi-pane tabs (each `useSim` subscriber re-renders on the session change, plus the
     `RuntimeContext` contract memo at `sim-runtime-provider.tsx:447`), in a debug build. That would explain both the
     held digit and the late messages.
   - **(b)** Deltas were dropped (a revision gap, or deltas received while a resync was pending: `handleDelta`
     `counters.deltasDropped`) and the replacing `resync` waited on the 2.25 s spacing (`REALTIME_RESYNC_MIN_INTERVAL_MS`
     + guard, `pump()` `:712-721`) or the send budget (15 per 10 s, `LIVE_SOCKET_SEND_BUDGET`). That explains the late
     replica, but not on its own the held digit.

**Diagnostics for W98** (no fix proposed until one is measured):

- log `live.socketStatus()` counters (`deltas`, `deltasDropped`, `deltasStale`, `resyncs`, `resync`) at every
  `routeSync` transition;
- a 250 ms JS-lag sampler (`Date.now()` drift of a plain interval) in the runtime log for the session window;
- repeat T2/T3 on the **release** build at load < 4.

If (a) holds, W93-23 and a lighter tablet tree under the session flow (unmount or freeze the tabs while the session
stack is on top, e.g. `freezeOnBlur`/`react-freeze`, which expo-router supports) are the fix direction. If (b) holds,
the owner is the shared socket client (W91/W92).

---

## 7. Key challenges

1. **Fixes landed per screen, not per component.** D214 (digit loss) and RF-T-1 (border change) were each fixed in the
   screen that showed them on a device. The shared mechanism stayed in `RollingNumber`, the mini bar and the Audit row
   (W93-1, W93-2, W93-3). The next round should fix the kit component, then delete the screen-local copy.
2. **Three hand-off marks and three overlay hooks** are a pattern that deserves one implementation (W93-18, W93-19)
   before a fourth screen copies them.
3. **RBAC unknown-role rule.** "The Core decides while the role is unknown" is implemented for the deep link and not
   for the buttons (W93-11). It is a product decision and should be recorded either way.

## 8. Positive findings

- `stall-tolerant-timers.ts`: a precise, well-bounded rule (late > 250 ms yields 50 ms, wall-time cap 1 s, count cap 20).
  Cancellation works in every phase, the interval re-arms before its callback (so a self-clearing interval ends cleanly),
  and the header documents the measured failure that justifies it.
- `core-clock.ts`: a correct lower-bound estimator (the max offset over 1-2 windows only discards queue delay), monotonic,
  with no runaway past the true offset. It is cleanly separated from the stall-tolerant timers (plain timers for display).
- The FX-M2b principle (React holds the final state; animation is only a removable overlay) is applied consistently in
  nav, tabs and Login, and each file explains the device evidence behind it.
- `pairing-gate-snapshot.ts` + `+native-intent.tsx`: a minimal, owner-checked bridge for routing outside React. The
  cold-start case is reasoned explicitly.
- Hooks discipline: the early return in `SessionFinalizingScreen` (`:107-109`) comes after every hook, and render-phase
  state adjustments (`useStartEntryGuard`, `useIndicatorTrack`, `useColorFade`) use the sanctioned pattern.
- Typecheck and lint clean. Logging never records the stop reason's text, the URL or credentials (`use-monitor.ts:305`,
  `+native-intent.tsx` header, `withinBudget` logs the error name only).

## 9. Hand-built parts versus kit or library

None found without a recorded decision: `TimerReadout` (D214; see W93-3 for folding it back into the kit component),
`PanelBoundary` (step 77 / P6; `react-error-boundary` is not a dependency), and the stall-tolerant timers and Core clock
(D214/D236; no library covers the measured mechanism). The controls touched in this window use heroui-native (`Button`,
`Alert`, `Chip`, `Card`, `ListGroup`, `Spinner`, `PressableFeedback`) and expo-router's own `TabRouter`
(`resetOnFocus`, verified in `node_modules/expo-router/build/ui/TabRouter.js`).

## 10. Files reviewed

Runtime: `stall-tolerant-timers.ts`, `core-clock.ts`, `sim-adapters.ts` (diff + `:145-160`, `:314-345`, `:435-470`,
`:500-575`), `sim-runtime-provider.tsx` (diff, `:400-450`), `log.ts` (diff), `index.ts` (diff), `ended-link.ts`,
`probe-failure.ts`, `pairing-gate-snapshot.ts`, `signed-out-landing.tsx`, `contract.ts:120-240`,
`live-resync-watch.ts:1-60`. App and navigation: `app/_layout.tsx`, `app/index.tsx`, `app/pair.tsx`, `app/+native-intent.tsx`,
`app/(app)/session/live.tsx`, `new.tsx`, `_layout.tsx`, `navigation/root-navigator.tsx`, `stacks.tsx`, `session-guards.ts`,
`session-routes.ts`, `tab-root.ts`, `app-tabs.tsx` (diff), `log.ts`. Nav kit: `nav-item.tsx`, `use-indicator.ts`,
`indicator-travel.tsx`, `live-mini-bar.tsx`. Session flow: `use-monitor.ts`, `session-live-screen.tsx` (diff),
`session-live.math.ts`, `monitor-handoff.ts`, `rec-indicator.tsx`, `connection-banner.tsx`, `timer-readout.tsx` (header),
`live-feed.tsx` (diff), `session-finalizing-screen.tsx`, `handover.ts`, `summary-handoff.ts`, `session-summary-screen.tsx`
(diff). Features: `rbac/use-role-gate.ts`, `session-new/use-start-entry-guard.ts`, `dashboard/quick-actions.tsx`,
`dashboard/home-header.tsx`, `sessions/hub-top.tsx`, `sessions/session-detail.tsx`, `sessions/session-row.tsx` (diff),
`sessions/session-status-chip.tsx`, `sessions/sessions-screen.tsx` (diff), `settings/maintenance-section.tsx` (diff),
`evidence/export-sheet.tsx`, `evidence/live-integrity-tab.tsx`, `evidence/evidence-model.ts`, `evidence/selection-glow.tsx`,
`evidence/media-tab.tsx`, `evidence/i18n.ts`, `audit/audit-row.tsx`, `devices/device-row.tsx`, `devices/panel-boundary.tsx`,
`devices/devices-screen.tsx` (diff), `devices/devices-model.ts`, `network-time/system-time-card.tsx`,
`network-time/time-sync-card.tsx`, `network-time/use-network-time.ts`, `network-time/network-status-card.tsx` (diff),
`pairing/pairing-screen.tsx` (imports), `pairing/use-pairing-flow.ts`, `pairing/pairing-model.ts` (diff),
`login/use-login-choreography.ts` (diff), `login/login-screen.tsx`, `login/login-model.ts`; `components/composed/stepper.tsx`,
`components/kit/status-chip.tsx`, `components/media/brand-assets.ts`. Tests: `live-session-new-followups.test.tsx:155-200`,
`more-live.test.tsx:60-110`, `jest.config.js`. Shared (read-only, for tracing): `realtime/live-socket-client.ts:700-800,
930-1000`, `client/core-client.ts` (timeout), `tokens/status-tones.ts`, `sim/selectors.ts:48`, `api/constants.ts:70-74`.
Task docs: `masterplan/02_plan.md` (W93 row), `decisions/decisions.md` (D175, D180, D189, D203, D205, D208, D216, D217,
D218, D235, D236, D237, D239), `gateway_check/09c_m2_mobile_closing.md` §5, `gateway_check/13a_cf2_mobile_runtime.md` §5,
`gateway_check/13b_cf2_mobile_screens.md:144`, `test/11_final_check_cf2.md`, `test/assets/retest3/{tablet_session_runs,
device_js_logs_per_run}.txt`, `gateway_check/assets/13b_rft2_run2_sessions_panes.png`.

---

```
CODE_REVIEW_COMPLETE: APPROVED WITH COMMENTS - 28 items (0 Blocker, 2 Major, 15 Minor, 9 Nit, 2 Info)
Report: docs/2026-10-04_dems_backend_rbac_pairing/verification/12_code_review_mobile.md
```
