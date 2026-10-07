# FXR-M — post-review fix pass on `apps/mobile` (W93 findings)

**Row:** FXR-M (coder-execution) · **Date:** 2026-10-07 05:45-08:35 · **Narrative tier:** 2
**Status:** complete (jest proof). Device confirmation of the visual items is W94-W96's (§5).
**Source:** `verification/12_code_review_mobile.md` (W93-1..28), `decisions/decisions.md` D243 (ruling W93-11),
D208 / D235 / D236 / D203 (the patterns reused).

**Rules kept.** Writes only under `apps/mobile/**` (plus this file and `delegation_progress/fxr_m_mobile.md`). No
device work: no adb, no emulator, no Metro. No commit. No secret printed: the tests use the fake transport's
placeholder credential and assert it never reaches the log. `masterplan/02_plan.md`, `status_tasks.md` and
`delegation_progress_report.md` not edited (parallel run). Load checked before each heavy run (§4).

**Rollback.** `.cache/rollback/FXR-M/`: the pre-edit copy of every file this row changed, at its repo path.
`FXR-M.mobile.pre.sha256` (55 files, sha256 before the edit), `FXR-M.mobile.new_files.txt` (15 files this row
created), `FXR-M.mobile.files.txt` (all 70) and `FXR-M.mobile.post.sha256` (sha256 after). Restore = copy the
pre-copies back and delete the 15 new files. Note: the scratchpad is shared by the parallel rows; FXR-S briefly
ran this row's first helper and put `apps/core-server` copies in this folder (`SHA256SUMS.pre`), then removed
its own entries. What remains there is mobile only; the `FXR-M.mobile.*` lists are the authoritative ones.

---

## 1. Per finding

Mutation checks are in-memory: the fixed file is swapped for the mutant, the named test runs, the file is
restored (`trap`), and only "suite ran and a test failed" counts as CAUGHT. "Lost-update model" = every
`useAnimatedStyle` (and, for the Stepper, `useAnimatedProps`) keeps its first value forever, the worst case of
the device's dropped Reanimated updates (the FX-M2b / CF-M1 test model).

| # | Status | Where (file:line after the fix) | Test | Mutation result |
|---|---|---|---|---|
| W93-3 (rolling number, 11 users) | **Fixed** | `components/composed/rolling-number.tsx:164-259` (`useDrawnValue`, `SlideNumber`, `DigitColumn`: React holds each column's cell; the roll is an offset whose rest value is 0); `rolling-number.math.ts` `rollCells`, `rollsForward`; `features/session-live/timer-readout.tsx` is now a `RollingNumber` wrapper (`nextCell` kept) | `components/composed/rolling-number-drawn.test.tsx` (21 tests: clock 95 steps, stall jump 00:03:13->00:04:24, countdown down, decimal losing/regaining a column, percentage, shared-value input; both motion policies; `rollCells` table). `rolling-number.test.tsx` updated for React-held positions | Pre-fix `rolling-number.tsx`: **CAUGHT** (12 failed / 21) |
| W93-1 (bottom Recording bar) | **Fixed** | `runtime/recording-elapsed.ts` (new: the monitor's rule moved to the runtime; ONE shared ticker per Core clock + session); `components/composed/nav/live-mini-bar.tsx:61-63` reads `useRecordingElapsedSeconds`; Home `features/dashboard/use-home-data.ts:97-100` and hub `features/sessions/use-sessions-data.ts:139-142` take `max(store, ticker)` so all four timers agree (E2E-P-3, D201); monitor `use-monitor.ts` re-exports | `components/composed/nav/live-mini-bar-core-clock.test.tsx`: store clock held while the Core clock runs 6 s -> the bar follows (+6 s), Home equal in every commit, never backwards, columns drawn = label under the lost-update model; SIMULATED 25 s drawn correctly | Bar reads store only: **CAUGHT**. Home reads store only: **CAUGHT** |
| W93-12 (ticker dies on a throw) | **Fixed** | `runtime/recording-elapsed.ts:65-92` re-arms in `finally` (and logs a failed re-arm) | `features/session-live/elapsed-ticker.test.ts` "a tick that throws once…" (one `sessionLive.elapsedTick` record, value still reaches 6 s, one timer pending) | Re-arm only on success (pre-fix shape): **CAUGHT** |
| W93-2 (Audit row, Major) | **Fixed** | `features/audit/audit-row.tsx`: `card` has `ROW_CARD_BORDER` (1 dp in every state), `cardSelected`/`cardBroken` colour only; always-mounted `SelectionGlow` as last child (`audit-row-selected-<seq>`); card `testID audit-row-card-<seq>` | `features/audit/audit-row-deselect-drawn.test.tsx` (tablet landscape, lost-update model): row shape constant, card geometry constant except colour, glow 1/0 by React, deselected text opacity 1 | Border only when selected: **CAUGHT**. Glow mounted only when selected: **CAUGHT**. Pre-fix file: **CAUGHT** |
| W93-4 (Devices row) | **Fixed** | `features/devices/device-row.tsx`: `item` has `ROW_CARD_BORDER`, `itemSelected` colour/tint only; always-mounted `SelectionGlow`; wrap `testID device-row-wrap-<id>` | `features/devices/device-row-deselect-drawn.test.tsx` (MIC-02 then POE-SWITCH) | Border only when selected: **CAUGHT**. Glow mounted only when selected: **CAUGHT** |
| W93-24 (part) | **Fixed (cheap part)** | `SelectionGlow`/`ROW_CARD_BORDER` moved to `components/composed/selection-glow.tsx` (`features/evidence/selection-glow.tsx` re-exports; Sessions imports the kit). The cooldown updater side effect fixed in all five boundary copies (`componentDidUpdate` clears the interval; the updater is pure): `features/{devices,dashboard,storage}/panel-boundary.tsx`, `audit/audit-boundary.tsx`, `network-time/card-boundary.tsx` | Existing boundary suites (full run) | Not mutation-tested (purity nit; behaviour unchanged). `PanelBoundary` not merged into one component (out of the cheap scope) |
| W93-5 (export source line) | **Fixed** | `features/evidence/export-sheet.tsx:529-532`: `verifiedByCore` under PASS, `failedOnCore` under FAIL | `features/evidence/live-evidence-export.test.tsx` two W93-5 cases (FAIL never says "Verified by the Core"; PASS still does) | Pre-fix file: **CAUGHT** |
| W93-6 (Summary/Finalizing fade) | **Fixed** | `navigation/stacks.tsx:32-62`: `IN_PLACE_FLOW_ROUTES = ['finalizing', 'summary/[sessionId]']`, each `animation: 'none'`; the flow's other screens keep the fade. **Correction to W93's proposal:** the route file is `summary/[sessionId].tsx`; `summary/[id]` would match no route and Expo Router would ignore it | `navigation/__tests__/session-flow-in-place-routes.test.tsx` (options given to the stack; every name is a route file) | Pre-fix `stacks.tsx`: **CAUGHT**. Name `summary/[id]`: **CAUGHT** |
| W93-7 (Stepper rest values) | **Fixed** | `components/composed/stepper.tsx`: `useChangeOverlay` (FX-M2b); `ConnectorHalf` fill, `StepBadge` ring and check are React-held; fill / ring / check-draw / halo are overlays removed after their budget (+80 ms); `animate={false}` starts nothing (no overlay, no entering fade, Spinner `animation="disable-all"`). Passed from the in-place copies: `session-finalizing-screen.tsx` (`PipelineCard handover`) -> `finalization-pipeline.tsx` `animate`, and `session-summary-screen.tsx` `LifecycleCard animate={!handover}` | `components/composed/stepper-rest-values.test.tsx` (5 tests, lost-update model incl. `useAnimatedProps`): done step -> connector full, check drawn, ring moved; un-done connector empties; wizard left half; `animate={false}`; overlays exist while playing | Overlay never removed: **CAUGHT** (3 failed). `animate` ignored: **CAUGHT** |
| W93-8 (RF2-1 name wrap) | **Fixed** | `features/sessions/session-detail.tsx`: subject row `flexWrap: 'wrap'`; name `flexShrink: 0, maxWidth: '100%'` (`subjectName` style), chip wraps under | `features/sessions/session-detail-subject-chip.test.tsx` (styles of the rendered detail; Jest has no layout engine) | Pre-fix subject styles: **CAUGHT** |
| W93-9 ('Sealed' chip contrast) | **Fixed** | `session-detail.tsx`: hero chip on an opaque backplate `MEDIA_CHIP_PLATE = withAlpha(palette.black, 0.7)`, full radius (the Evidence hero's recipe, `evidence-detail.tsx:491`, which already had it) | same file, W93-9 case (alpha ≥ 0.7, absolute, full radius) | No backplate: **CAUGHT** |
| W93-11 (RULING D243) | **Fixed as ruled** | `features/rbac/use-role-gate.ts`: unknown role -> `hint = "Checking your permissions…"` (key `mobile.rbac.checking`, `i18n/en.mobile.ts`); the Home and Sessions Start buttons already show `hint` while disabled. `features/session-new/use-start-entry-guard.ts`: returns `'checking'` while the role is unknown; `app/(app)/session/new.tsx` renders the new `features/session-new/start-entry-checking.tsx` (spinner + reason), then applies the same `SESSION_START` gate | `features/rbac/role-gate-r2.test.tsx` W93-11 block (4 tests: Home and hub disabled with the reason; deep link waits then INVESTIGATOR -> wizard; TECHNICIAN -> Home with one refusal). `navigation/__tests__/routes.test.tsx` step-param test: its store now signs the operator in (the wizard waits otherwise) | No reason while unknown: **CAUGHT**. Deep link opens the wizard on an unknown role: **CAUGHT** |
| W93-13 (route error to console) | **Fixed** | `navigation/route-error-fallback.tsx` (moved out of `app/_layout.tsx`, which Jest cannot load): one `reportRuntimeIssue('error', 'app.routeError', error)` per error in `useEffect`, no render-time console call; `_layout.tsx` imports it | `navigation/__tests__/route-error-fallback.test.tsx` (two retries + countdowns: 1 record; the screen prints nothing; at most the runtime log's single mirror line) | Render-time `console.error` (pre-fix): **CAUGHT** |
| W93-14 (warn -> LogBox) | **Fixed** (cheap) | `navigation/log.ts`, `motion/log.ts` console sinks: `warn` -> `console.info`, only `error` -> `console.error` (DX-6) | `navigation/__tests__/log-warn-console.test.ts` | Pre-fix `navigation/log.ts`: **CAUGHT**. Pre-fix `motion/log.ts`: **CAUGHT** |
| W93-15 (command time-outs) | **Fixed as briefed (measure, never re-send)** | `runtime/sim-adapters.ts` `client.call`: a non-probe `TIMEOUT` writes one `info` record `live.client.commandTimeout` {operationId, elapsedMs, budgetMs, timerLateMs, verdict `js-starved` (> 1 s late) / `no-answer`}; the command is not sent again. The shared client's global timer itself is FXR-W's (W93's option) and was not touched | `runtime/probe-failure.test.ts` W93-15 cases (starved 12 s vs 8 s; one request each; probes get no such record) | Verdict removed: **CAUGHT**. Not measured: **CAUGHT** |
| W93-16 (secure-store budget) | **Fixed as briefed (measure + undo a late write)** | `runtime/sim-adapters.ts` `withinBudget` (now takes `now` and `onLate`): the budget record carries `elapsedAtBudgetMs` / `budgetFiredLateMs`; a write that settles after the budget logs `runtime.live.credentials.lateWrite` {late, ok, elapsedMs, budgetMs, deviceId}; if it landed after the registration was abandoned it is removed again. Budget values unchanged (4 s / shared 5 s): W98 sizes them from these records | `runtime/live-device.test.tsx` W93-16 case (a keystore write released 5.5 s in: refused NOT_AVAILABLE, late record ok:true, store empty, credential never in the log) | Late write not removed: **CAUGHT**. Late outcome forgotten: **CAUGHT** |
| W93-17 (flaky tests) + R16 | **Fixed** | `features/session-new/live-session-new-followups.test.tsx` (both `a confirmed cancel` cases) and `features/more/more-live.test.tsx` ("footer reads Core Live"): explicit `LOAD_TOLERANT_TIMEOUT_MS = 20_000`. One-toast titles now name the count: `storage-screen.test.tsx` and `network-time-screen.test.tsx` also ASSERT it (the drawn count of one toast does not grow on later ticks; haptic count 1 / 2); `live-core-errors.test.tsx`, `live-device.test.tsx` retitled (they already asserted the count) | the files themselves | Storage alert hook re-toasting every render: **CAUGHT** |
| W93-20, W93-21 | **Fixed** (cheap) | dead `elapsedSeconds` removed from `live-mini-bar.tsx` and `nav/index.ts`; the bar's and `rec-indicator.tsx`'s stale comments rewritten | typecheck + full suite | — |
| W93-22 | **Fixed** (cheap) | `navigation/root-navigator.tsx:107-111` reads `session.summaryAcknowledged` directly (helper removed) | existing pairing-gate / routes suites (full run) | — |
| W93-23 | **Fixed** (cheap) | `features/session-live/session-live-screen.tsx:150-156` `eventsById` `Map` (`useMemo`) | existing monitor suites (full run) | — |
| W93-25 | **Fixed** (cheap) | `features/evidence/evidence-model.ts:396-411`: `actorKnown` only on an exact-instant match | `live-evidence-stored-verification.test.tsx` new case (older entry -> not known) | Pre-fix file: **CAUGHT** |
| W93-28 (RF2-2, Info) | **Diagnostics added (no fix, as briefed)** | `runtime/session-diagnostics.ts` (new; mounted in `app/(app)/_layout.tsx`): 250 ms JS-lag sampler over ARMED..FINALIZING; one record `runtime.diag.sessionWindow` per session-state transition {from, to, sessionId, samples, lagMaxMs, lagOver500, lagOver1000, lagMaxAtMs, and in LIVE link, synced, resyncPending, revision, deltas, deltasDropped, deltasStale, resyncs, reconnects}. Written with the new quiet `reportDiagnostic` (`runtime/log.ts`: `write(record, { console: false })`): persisted in `dems.mobile.log.v1`, never printed | `runtime/session-diagnostics.test.tsx` (sampler on time / 1.5 s block; counters; a stopped recording writes the records, nothing printed; the quiet switch on an error record) | Quiet option ignored: **CAUGHT**. No transition record: **CAUGHT** |
| W93-10 (dark Login->Pair frame) | **Documented, not changed** | Not a contained change: drawing `PairingScreen` in place from the boot router means two live `PairingScreen` instances for a commit, and `use-pairing-flow.ts` runs effects on mount (`:159`, `:253`, `:278`), so the in-place copy could start pairing work twice; the boot router is also guarded by three pairing-gate suites. W93 itself asks for the W98 release-build measurement first | — | — |
| W93-18, W93-19, W93-26 (Nits) | **Not done** (beyond "cheap") | three hand-off marks into `createHandoffMark()`, three overlay hooks into `useTransientOverlay`, `onLayout` measuring for the bandwidth row. The Stepper's new `useChangeOverlay` is a fourth instance of the W93-19 pattern: worth folding together in a later refactor | — | — |
| W93-27 (Info) | Not in scope | TABLET row wording during an outage (hypothesis, not run) | — | — |

**Mutation total:** 33 mutants, 33 caught (W93-3 ×1, -1 ×2, -12 ×1, -2 ×3, -4 ×2, -5 ×1, -6 ×2, -7 ×2, -8 ×1, -9 ×1,
-11 ×2, -13 ×1, -14 ×2, -15 ×2, -16 ×2, R16 ×1, -25 ×1, -28 ×2). One early mutant run was invalid (a shell
quoting error broke the mutant file) and was redone with a quoted script; the runner then gained an INVALID
verdict for a suite that fails to run.

## 2. Decisions taken in this row

| # | Decision | Why |
|---|---|---|
| DEC-FXR-M-1 | Home's System Status timer and the hub timer also take the shared ticker (not only the bar) | W93-1 alone would have made the bar run ahead of Home under load in LIVE, breaking E2E-P-3 / D201 (two timers on one screen agree). One ticker per Core clock + session also keeps them in the same commit |
| DEC-FXR-M-2 | Timers and clocks roll forward only (`rollsForward`: duration, clock); other formats roll the shorter way (old `rollPlan` rule) | A timer jump after a stall rolling backwards would look like "time going back", the defect the operator reported |
| DEC-FXR-M-3 | The "Checking your permissions…" reason also shows on Install update while the role is unknown | One rule in `useRoleGate` for every gated control (the ruling's "one rule"); the copy is the ruling's sentence with the app's ellipsis character |
| DEC-FXR-M-4 | W93-13: the route error is one `error` record; the runtime log mirrors it to `console.error` once (DX-6: a route crash is an app fault). The screen prints nothing itself | The persistent record needs the message; the per-render repetition was the defect |
| DEC-FXR-M-5 | `summary/[sessionId]` instead of W93's `summary/[id]` | The real route file name (checked by the test) |
| DEC-FXR-M-6 | Count mode of `RollingNumber` left as it was | Its only user is the dev gallery; no product screen counts |

## 3. Suite ledger

| Check | Command | Result |
|---|---|---|
| Typecheck | `cd apps/mobile && npx tsc --noEmit; echo $?` | `tsc exit 0` (final tree) |
| Lint | `npx eslint . ; echo $?` | `eslint exit 0` (final tree; one hooks-rule error in my own test and two unused imports in `_layout.tsx` fixed on the way) |
| Full suite, run 1 (08:21, load 5.16) | `npx jest --maxWorkers=2` | **Invalid as a measure of this row**: 48 suites could not load (`ReferenceError: WEB_SESSION_REFUSED is not defined`, `packages/shared/src/api/identity.ts:464`, a half-saved FXR-W edit, file time 08:22; the constant exists in `operation-parts.ts:19` since). It also showed the 2 real failures of this row (the static rule "features use the runtime through its barrel": my direct `@/runtime/recording-elapsed` imports), fixed by exporting from `runtime/index.ts` |
| Full suite, run 2 (08:24, load 6.79; 11.34 at the end) | `npx jest --maxWorkers=2` | **189 / 191 suites, 1,980 / 1,985 tests pass** (4 min 28 s). Failures: `navigation/__tests__/routes.test.tsx` 1 test (the step-param test opened `/session/new` with no operator in the store: the wizard now waits, ruling W93-11 — test set-up fixed, see W93-11 row); `navigation/__tests__/chrome-lost-updates.test.tsx` 4 tests (the first timed out at 5 s at load ~11, the other three cascade on the unmounted renderer; alone it passes 4/4, first test 3.4 s) |
| The two failing suites, after the fix | `npx jest --maxWorkers=2 src/navigation/__tests__/routes.test.tsx src/navigation/__tests__/chrome-lost-updates.test.tsx` | 32 / 32 pass (load 7.48) |
| Load before heavy runs | `uptime` | 3.94 · 4.17 · 5.16 · 6.79 · 7.48 (never above 14; 12.94 / 11.34 were the end-of-run values after the full runs) |

Per-fix runs are quoted in §1 (each new test passed on the fixed tree before its mutation run).

**Residual (for the controller):** `chrome-lost-updates.test.tsx` "Sessions -> a session detail -> Evidence" has
no explicit timeout and takes ~3.4 s alone; it hit the 5 s default at load ~11. It is the same load-flake class as
W93-17 (D239) but was not one of the routed tests; this row did not change its budget.

## 4. What W94-W96 must confirm on a device

Relaunch the app first (a full new bundle), and judge clocks with `motion=full` (under `motion=off` clock seconds
hold at :00 by design, W93 R3).

1. **W93-3 / W93-1:** during a recording under host load, the bottom Recording bar, Home's System Status timer, the
   hub timer and the monitor show the same second, never step back, and no digit reverts after a stall (try a
   Hermes-inspector pause of 2-4 s as CF-M1 did). The Home header clock and System Time (with `motion=full`) never
   show a stale digit. LIVE: with the store clock held (load), the bar keeps moving.
2. **W93-2 / W93-4:** tablet Audit list and Devices list: select a row, then another; the first row stays drawn
   (no empty card), its border colour returns to transparent. Repeat while scrolling (FlashList recycling).
3. **W93-6:** stop a recording from the web: monitor -> Finalizing -> Summary with no empty frame at the Summary
   (frame capture, phone and tablet).
4. **W93-7:** during finalizing, no "Unable to find SurfaceMountingManager" burst in logcat at the hand-over; the
   pipeline ends with full connectors and drawn checks; the Summary lifecycle stepper is complete.
5. **W93-8 / W93-9:** tablet Sessions detail pane: "Retno Wulandari", "Siti Rahmawati" wrap between words (chip
   under the name); the 'Sealed' chip over the photo reads clearly.
6. **W93-11:** a cold start in LIVE, Home right after sign-in: Start Session disabled with "Checking your
   permissions…" until the snapshot, then enabled (Investigator) or "Requires the Investigator role" (Technician).
   A `demsdemo:///session/new` deep link before the snapshot shows the waiting screen, then the wizard or Home.
7. **W93-13 / W93-14:** no yellow LogBox bar from a navigation/motion `warn`; a forced route error shows one red
   entry, not one per second.
8. **W93-15 / W93-16 / W93-28 (W98, release build):** read `dems.mobile.log.v1` after the RF2-2 repeat (T2/T3 at
   load < 4): `runtime.diag.sessionWindow` (lag summary + socket counters per transition),
   `live.client.commandTimeout` (verdict), `runtime.live.credentials.*` (`elapsedAtBudgetMs`, `lateWrite`). None of
   these appear in Metro.

## 5. Files

Created (15): `components/composed/rolling-number-drawn.test.tsx`, `components/composed/selection-glow.tsx`,
`components/composed/stepper-rest-values.test.tsx`, `components/composed/nav/live-mini-bar-core-clock.test.tsx`,
`runtime/recording-elapsed.ts`, `runtime/session-diagnostics.ts`, `runtime/session-diagnostics.test.tsx`,
`features/audit/audit-row-deselect-drawn.test.tsx`, `features/devices/device-row-deselect-drawn.test.tsx`,
`features/sessions/session-detail-subject-chip.test.tsx`, `features/session-new/start-entry-checking.tsx`,
`navigation/route-error-fallback.tsx`, `navigation/__tests__/session-flow-in-place-routes.test.tsx`,
`navigation/__tests__/route-error-fallback.test.tsx`, `navigation/__tests__/log-warn-console.test.ts`
(all under `apps/mobile/src/`).

Modified (55): listed with their pre-edit sha256 in `.cache/rollback/FXR-M/FXR-M.mobile.pre.sha256`.

---

```
IMPLEMENTATION_COMPLETE: FXR-M — W93-1..9, -11..17, -20..25, -28 (diagnostics) fixed with jest proof; 33/33 mutants caught; W93-10 documented; W93-18/19/26/27 not done.
Report: docs/2026-10-04_dems_backend_rbac_pairing/gateway_check/15c_fxr_mobile.md
```
