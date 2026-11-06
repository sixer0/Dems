# coder-execution — row M1 (mobile consolidation round 2; D157, D159)

Status: **complete**. 2026-10-05 23:51 to 2026-10-06 00:25 WIB. Report: `gateway_check/09b_m1_mobile_consolidation.md`.

| Item | What | Status | Time |
|---|---|---|---|
| 1 | Pending-press hook into `@/runtime` | done | 23:58-00:02 |
| 2 | Link notice seeded initial state (W66 F-1) | done | 00:02-00:07 |
| 3 | `BackGuardDialog` `busy` prop (W67 F-6) | done | 00:07-00:13 |
| 4 | Truthful LIVE copy in Start Session (W67 F-2) | done | 00:10-00:13 |
| 5 | Read-only: cold LIVE launch reached Stack Check (W67 F-3) | done (explained, no code change) | 00:14-00:16 |
| Final | Whole suite, typecheck, lint, mutation run, report | done | 00:16-00:25 |

Pre-images: `.cache/rollback/M1/` (`pre.sha256`, 9 files, 23:57). Test-file hashes before any edit:
`.cache/m1/tests-pre.sha256` (58 files).

## Log
- 23:51 inputs read (M0 report, D151/D157/D159, CP-M1 §4 answer 3, W67 F-1/F-2/F-3/F-6, W66 F-1/DN-1).
- 23:57 pre-images saved.
- 00:02 item 1 done: `runtime/use-pending-press.ts` (code body identical to W67's), barrel block + 2 header rows, W67 file is a one-line re-export, screen imports `@/runtime`; new `runtime/use-pending-press.test.tsx` (8). typecheck exit 0; eslint on the 5 files exit 0; session-new 6 suites + new 1 = 7 suites / 87 tests exit 0.
- 00:07 item 2 done: `initialOfflineNotice(link, banner)` in `link-notice.ts`; new `runtime/use-core-link-notice.ts` (`useCoreLinkNotice()` = M0 snippet + seeded first render); barrel: `initialOfflineNotice` added to M0's line + one block for the hook + module row + surface row now names the hook. Callers: W67 screen -> `useCoreLinkNotice()`; W66 chip keeps M0's snippet (its gated static test pins the text), first-render line seeded. Pair/Login unchanged (not needed; reported). New test 15. typecheck 0; eslint 0; 30 suites / 332 tests exit 0 (runtime link-notice*, more, dashboard, session-new, pairing, login).
- 00:09 item 3: `navigation/back-guard.tsx` `busy?: boolean` (leave button: accessibilityState busy, kit Spinner `back-guard-leave-spinner`, presses ignored; default unchanged); W67 passes `busy={cancelPress.pending}`; new `navigation/__tests__/back-guard-busy.test.tsx` (6). navigation + session-new 14 suites / 217 exit 0.
- 00:13 item 4: two feature-local Live keys (`features.session-new.live.speakToTest`, `.scanCaseNumber`), picked by `useCoreLink().source === 'LIVE'` in `device-previews.tsx` and `session-info-step.tsx`; shared strings untouched. New `live-session-new-followups.test.tsx` (6: cancel pending x3 on the real Live source, copy x3). 19 suites / 249 exit 0; eslint on 7 files exit 0.
- 00:16 item 5: `/` + any non-empty `?motion=` renders Stack Check by design (`src/app/index.tsx:15`, `navigation/params.ts:67-70`, AC-31); W67 attempt 1 launched `demsdemo:///?core=LIVE&motion=off`; without `motion` a paired phone gets `/login` (`root-navigator.tsx:97-110`). No code defect; device-procedure rule proposed.
- 00:16-00:18 mutation run (in memory, M15): control 7 files / 73 green; 30 of 31 detected (H12 `>=`→`>` equivalent on the 100 ms store clock); mutated files identical before/after.
- 00:18:50 whole suite 114 suites / 1,431 tests exit 0 (load 2.85); typecheck 0; lint 0; eslint JSON 496 files 0/0; baseline 72 vs acaff20: 0; W60 navigation tests vs b90a3c6: 0; 58 pre-hashed test files: 58 OK.
- 00:22 W78 line proven in memory: W78's 4 suites / 51 tests green with the copy re-exported; sanity stub fails 22/22; W78 file hash unchanged.
- 00:25 report and 7 assets written (`gateway_check/09b_m1_*`).
- Process slip: ~23:58 one read-only listing ended with `cd …/DEMS 2>/dev/null; true` (no effect; not repeated).

## Follow-up (decision D164) — complete, 00:29-00:56 (report: `gateway_check/09b_m1_mobile_consolidation.md` § "Follow-up (decision D164)")

| Item | What | Status | Time |
|---|---|---|---|
| F1 | W78's hook copy -> one-line re-export | done | 00:29-00:30 |
| F2 | One busy-state / in-button spinner helper | done | 00:30-00:34 |
| F3 | W78 LIVE health caption says "derived" (D160) | done | 00:34-00:38 |
| F4 | DN-4: `BackGuardDialog` busy at the press, spinner late | done | 00:38-00:41 |
| F5 | Defect: "Keep session" during an in-flight cancel | done (finding corrected) | 00:38-00:43 |
| Final | Whole suite, typecheck, lint, mutation run, report append | done | 00:43-00:56 |

Pre-images: `.cache/rollback/M1b/` (`pre.sha256`, 17 files, 00:29). All mobile test files hashed: `.cache/m1b/tests-pre.sha256` (142 files, 00:29).
- 00:30 F1: `features/devices/use-pending-press.ts` = the proven one line. typecheck 0; devices 4 suites + hook test = 5 / 59 exit 0.
- 00:34 F2: new `runtime/pending-control.tsx` (`busyState`, `PendingSpinner`; runtime, not the kit: §4.0 recipe set, baseline test); barrel block + 2 rows; W67 screen drops its two local copies, `devices-check-step.tsx` inline twin -> helper; W78 `device-detail`, `device-command-dialog`, `diagnostics-sheet` -> helper; `devices/busy-state.ts` one-line re-export. New `runtime/pending-control.test.tsx` (8). typecheck 0; 21 suites / 290 exit 0; eslint 0.
- 00:38 F3: value of `features.devices.live.samples_one/_other` -> "Derived on this device from the Core's data · …" (key count 11 and Simulated digest unchanged); `health-chart.tsx` header comment; W78's `live-devices-sites.test.tsx:368-369` regex updated by design (pre-image saved). New `live-devices-health-caption.test.tsx` (5). devices 5 suites / 56 exit 0; eslint 0.
- 00:39 F5 probe (scratch test, moved out of the tree to `.cache/m1b/m1b-probe-keep.test.tsx.txt` at 00:39): the reported defect does NOT reproduce — after "Keep session" + a confirmed cancel the wizard DOES leave for /home (a closure captured at the press); the real defect: "Keep session" is enabled and closes the dialog while the cancel is out (S3-1/LB-6).
- 00:41 F4: `BackGuardDialog` `busy` = from the press (busyState, presses ignored), new `pending` = the spinner, defaulting to `busy` (first form unchanged); uses the runtime helper; W67 passes `busy={cancelPress.busy} pending={cancelPress.pending}`; own tests extended (back-guard-busy +3; followups: busy at the press). 16 suites / 234 exit 0; eslint 0. Typecheck red at 00:40 only in W68's in-flight `features/session-live/session-live-screen.tsx` (4 errors), not mine.
- 00:42 F5: 3 Live reproductions in `live-session-new-followups.test.tsx` RED before (dialog gone after Keep: `Received: null`, 00:42:00), GREEN after (00:42:39): `BackGuardDialog` holds while `busy` (stay disabled + ignored, dismissal ignored), spread only while busy. 15 suites / 230 exit 0; eslint 0.
- 00:43-00:46 mutations (in memory): first pass 17/19 (C1 dead handler guard -> removed; C3 no dismissal test -> test added); group C again 9/9; final code 18/18; mutated files identical before/after.
- 00:46-00:48 whole run 1: 123 / 1,526, red W68 `live-session-live-sites` + W80 `live-audit-screen` (both rewritten mid-run; both PASS on re-check 00:48:55).
- 00:49-00:51 whole run 2: 127 / 1,564 (1,559 passed), red W68 `live-session-live-link` + W72 `live-sessions`; re-check 00:52: W72 PASS, W68 fails 2 tests; with the M1 seed reverted in memory the same 2 fail -> W68's.
- typecheck exit 2 at 00:49 and 00:54: one error in W72's `session-summary/testing/live-summary-bed.tsx`; 0 outside the parallel rows. lint exit 0; eslint JSON 515 files 0/0. Baseline 72: 0; W60 tests: 0; 142 pre-hashed test files: 139 OK + the 3 expected.
- 00:56 report section and 6 `09b_m1b_*` assets written.

## Follow-up 2 (D169) and 3 (D170) — complete, 01:25-01:55 (report: `gateway_check/09b_m1_mobile_consolidation.md` §§ "Follow-up 2", "Follow-up 3")

| Item | What | Status | Time |
|---|---|---|---|
| G1 | Reproduction on the Live source, red before | done | 01:25 |
| G2 | Fix in `runtime/session-route-sync.tsx` + helper `runtime/live-resync-watch.ts` | done | 01:26-01:38 |
| D170 | Banner after an outage (W68 F-1): reproduced on W68's bed + in isolation, fixed in `useConnectionBannerState` | done | 01:39-01:48 |
| Final | runtime tests, whole suite, typecheck, lint, mutations, report append (both) | done | 01:48-01:55 |

Pre-image: `.cache/rollback/M1c/` (1 file). Test files hashed: `.cache/m1c/tests-pre.sha256`.
- 01:25:44 G1 red before: the route sync opened `/session/summary/SES-20261001-0024` (X) instead of 0025 (Y).
- 01:26 W72's proposal (read the store at the signal) applied: STILL RED. Probe: at RESYNCED the store holds X and `getAuthSession` is in flight; after an outage the Live source confirms the session for the new socket (CPC1-35) and holds the snapshot; `adoptSession` applies it (`live-sim.ts:1416`) then `notifyLive` (`:1419`).
- 01:35 fix: `watchLiveResync` (public `link`/`session`/`socketStatus().connection`/`onLiveChange`) + the route sync's LIVE path waits for it and reads `selectActiveSessionInfo(store)`; the subscription keyed on [bus, sim] with `resync` through a ref (a probe showed the watch being re-created per render). GREEN: opens 0025.
- 01:36 test file 10 -> 11 tests (Live x3, watch x7, purity); runtime folder 22 suites / 300 exit 0; eslint 0. Mutations 10/11, R10 closed by a test, 11/11.
- Typecheck errors seen at 01:26/01:34 only in parallel rows' files (`features/session-recovery/recovery.model.test.ts`, `features/settings/maintenance-section.tsx`).
- 01:41 D170 reproduced on W68's bed (scratch probe, W68's bed imported read-only): with the wall-clock wait `for(resynced) | for(offline)`, banner offline while ONLINE/LIVE. Not on W66's bed (4 variants). In isolation: bus updater in a lower lane than the link render -> offline (2 of 6 schedulings). Hypothesis confirmed.
- 01:43 D170 fix: `kind` written only in render; bus and timer bump counters; hook exported for its test. W68's bed after: resynced. New `connection-banner-live.test.tsx` (9). Scratch probes moved to `.cache/m1c/`.
- 01:45-01:47 D170 mutations: B0 (old hook) red-before detected; 6/8 final (B6 equivalent, B7 not forceable).
- 01:49-01:51 whole suite 138 / 1,694 (1,692 passed); red only W82's `settings-live-static.test.ts` (rewritten 01:50:06), PASS on re-check 01:52:58. typecheck 0; lint 0, 532 files 0/0; baseline 0; W60 0; 161 pre-hashed test files unchanged.
- 01:55 report sections and 7 `09b_m1c_*` assets written.
