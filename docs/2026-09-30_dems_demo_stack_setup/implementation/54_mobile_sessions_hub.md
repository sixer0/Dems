---
task_id: 2026-09-30_dems_demo_stack_setup
step: 82
plan_row: 05_mobile_plan §3 M-11 part c
date: 2026-10-01
agent: coder-execution
lane: mobile, Metro 8087 (D85)
tier: 3
status: complete
decisions: D17, D28, D55, D61, D66, D73, D75, D78, D85, D100, D103, D105
---

# Step 82: mobile Sessions hub (M-11 part c, 04_mobile_specs §4.9)

**Outcome: PASS on the fast-lane gate (D75).**

| Check | Result | Evidence |
|---|---|---|
| Its test lists `sessionHistory` including an incomplete session | **PASS** | `sessions-screen.test.tsx` "lists the whole sessionHistory newest first, including the INCOMPLETE session": every history row is shown in order; SES-…-0016 carries the "Incomplete" chip |
| Own jest suites | **PASS** | 2 suites, 19 tests (§3) |
| Mobile typecheck | **exit 0, 0 errors (whole app, 10:1x)** | Earlier runs failed only in other lanes' in-progress files (P11, §3) |
| Lint | **exit 0** | `npx eslint src/features/sessions` |
| ONE phone-portrait device check (D75) | **PASS** | dems_phone and dems_phone2, §4: list, Incomplete filter, incomplete detail + Back, search, pull-to-refresh, recording state, RECORDING row → monitor. Screencaps `assets/mobile/82_dems_phone*_*.png` |
| Screencaps on both AVDs (row text) | phone only | D75 moves tablet layouts to the end pass (57, 59). The tablet panes are covered by jest (§3) |

Only `apps/mobile/src/features/sessions/**` was written in the app. Not touched: `packages/shared/**`, `src/app/**`, `src/navigation/**`, kit, any `package.json`, jest config. No npm install. Nothing committed. **No SIM-GAP:** the existing selectors (`selectSessionHistory`, `selectSessionHistoryById`, `selectPendingSummaryId`, `selectOperatorById`, `s.session`) cover the hub, so there is no `sim-adapter.ts`.

## 1. Files (`apps/mobile/src/features/sessions/`)

| File | Content |
|---|---|
| `sessions-screen.tsx` | `SessionsScreen({ selectedId })` (export, props and `SafeScreen id="sessions"` kept). Header (emblem + "Sessions"), then the active card, Start, `SearchField`, `TagGroup` and the `FlashList` rows with a gold `RefreshControl`. Compact: one column. Medium: `pane-list` 360 dp \| `pane-detail`. Expanded: `pane-filters` 280 dp (active card, Start, search, filters with counts) \| `pane-list` 40% \| `pane-detail` 60%. The selection is in `?selected=` |
| `session-detail-screen.tsx` | `SessionDetailScreen({ sessionId })` (stub contract kept, `SafeScreen id="session-detail"`) |
| `session-detail.tsx` | Detail body for the screen and the pane. Hero: evidence poster with a gradient, state chip, ID, time range, case and subject. Notice: summary pending, or INCOMPLETE with SYS-008 and the fault. `KeyValueList`. Hand-off buttons |
| `session-row.tsx` | Memoised row: poster (D50 join on the suffix, D61; live-loop poster + "Live" badge for the current session), ID (mono), date, subject, `SubjectTypeChip` (sim code), duration (live 1 Hz on the sim clock for the current session), state chip, "Summary pending" chip, chevron, glow e2 when selected |
| `hub-top.tsx` | Active-session `SectionCard`: REC dot, `RollingNumber` timer on the sim clock, ID, case, subject, "Return to monitor". Finalizing and fault variants. "Start New Session": "Continue session setup" during CREATE/PRECHECK/ARMED, disabled with a hint while busy |
| `session-status-chip.tsx` | RECORDING danger with a filled dot, SEALED violet with a lock (D28/Q4), INCOMPLETE amber, FAULT danger, FINALIZING info. The word comes from `common.enums.sessionState.*` |
| `rec-dot.tsx` | REC pulse (M-C-05, `recPulse` period). One ambient loop `sessions-rec`; it stops when unfocused, under reduced motion or with `?motion=off` |
| `sessions-model.ts` | Pure: rows (history + current session, no duplicate after the seal), filters (All, Sealed, Incomplete, Today in the WIB day), search (ID, case, subject, evidence ID), counts, chip recipes, the hand-off table, size, elapsed time, suffix |
| `use-sessions-data.ts` | `useSim` reads. They return flat tuples or state-held objects only (F74-13). Timers use `s.clock.now` (F74-09) |
| `use-hand-off.ts` | `useOpenSession`, `useSafePush`. A navigation error shows a toast and is written to the runtime log (`reportRuntimeIssue`, `dems.mobile.log.v1`) |
| `i18n.ts` | `sessionsEn` (`features.sessions.*`). Shared keys are reused for states, actions, faults, detail labels and subject terms |
| `sessions-screen.test.tsx`, `sessions-model.test.ts` | Tests (§3). Dataset counts (Today, subject term) are derived from the simulator, not hard-coded, so step 54's dataset edits do not break them |
| `testing/sessions-harness.tsx`, `testing/sessions-test-setup.ts` | Test-only. The real sessions routes run inside the real providers with `createTestSim`. Hand-off targets are stubs (P11) |

## 2. Behaviour (derived screen, 04 §1.4 and §4.9)

| Spec item | Implemented |
|---|---|
| Active-session card when recording (REC, timer, "Return to monitor") | Yes. It also shows while finalizing ("Open finalization") or after a fault ("Open recovery") |
| "Start New Session" | Yes (`/session/new?step=1`). It is disabled while a session is busy, matching the §3.5 guard |
| `SearchField`, then filters All / Sealed / Incomplete / Today | Yes. Today = the WIB day of the simulator clock |
| `FlashList` rows: ID mono, date, subject + chip, duration, state chip | Yes, plus a poster thumbnail (MB 5 row language) |
| Pull-to-refresh | Native `RefreshControl`: gold spinner on the warm surface. It lasts 700 ms on the simulator clock, then the rows re-stagger (M-C-11) and the footer shows "Updated hh:mm:ss" |
| Row hand-offs (brief) | RECORDING → `/session/live`. FINALIZING → `/session/finalizing`. FAULT → `/session/recovery`. Sealed with a pending summary → `/session/summary/<id>`. Sealed → `/evidence/<evidenceId>` on a phone and the detail pane on a tablet. INCOMPLETE → `/sessions/<id>` on a phone and the detail pane on a tablet |
| Tablet list/detail | Medium: list \| detail. Expanded: filters \| list \| detail (§2.4). "View in Evidence" in the pane opens `/evidence?selected=<id>` |

## 3. Verification (JS, fast lane)

| Check | Command | Result |
|---|---|---|
| Own suites | `npx jest src/features/sessions --maxWorkers=2` | **2 suites, 19 tests pass** (10 screen + 9 model). P11: at about 10:00 the same run failed to load (`Cannot find module './devices'` from step 54's mid-write `packages/shared/src/sim/maintenance.ts`). After the simulator settled (10:07) it passed 19/19 against step 54's new simulator |
| Typecheck | `npx tsc --noEmit` (apps/mobile) | **exit 0, 0 `error TS`** after 10:07. Earlier runs had 0 errors in `features/sessions` and failed only in other lanes' in-progress files (`audit/audit-entry-detail.tsx`, `devices/testing/devices-test-setup.ts`, `settings/settings-prefs.ts`, `pairing`, `storage`; P11) |
| Lint | `npx eslint src/features/sessions` | exit 0, no warnings |
| Greps (MA-20/21/22/25, D58) | `Haptics\.`, `Tersangka\|Saksi\|Lainnya`, hex colours, URLs, `onSize`, `useAudioChannel` in non-test files | 0 matches each |

What `sessions-screen.test.tsx` covers (real routes, real simulator, D61 dataset, 0 missing i18n keys per test):
1. the history list, newest first, with the INCOMPLETE row;
2. the four filters;
3. search by subject, case, session ID and evidence ID, the empty state and "Clear filters";
4. recording: the active card's timer advances on the sim clock, the RECORDING row is first, Start is disabled, a row tap opens `/session/live`;
5. the active card's CTA; POWER_FAIL → FAULT row → `/session/recovery`;
6. finalizing → SEALED: one row only, "Summary pending", tap → `/session/summary/<id>`;
7. phone: sealed → `/evidence/<id>`; incomplete → detail (SYS-008 notice), Back, recorded evidence;
8. tablet landscape: three panes, counts, pane selection with glow, "View in Evidence" → `/evidence?selected=`;
9. tablet portrait: deep-link hand-over to the pane;
10. pull-to-refresh on the simulator clock.

Known drift in another owner's test: step 70's `navigation/__tests__/routes.test.tsx` checks the `stub-param-*` ids of the stubs. For `/sessions` and `/sessions/<id>` the `screen-*` root still renders, but the stub param ids are gone. This is the same for `/evidence`, `/devices`, `/network-time` and `/session/new`. Step 57 extends T-M02 to the real screens.

## 4. Device check (dems_phone, D75)

**How the sessions ran:**
- Every session went through `apps/mobile/scripts/device-session.sh`, Metro lane **8087**, outside the sandbox (P10). The helper force-stopped the app first (D55).
- Deep links were quoted. `?motion=off` was used only for uiautomator.
- The installed APK is the step-72 build (`lastUpdateTime 2026-10-01 06:07:21`). No emulator was killed or rebooted (D78).
- Sign-in used the simulator's biometric action through the dev-only debug handle (`signInWithBiometric("OPR-001")`, D103). No credential was typed.
- Each session loaded the canonical `idle` scenario first and restored `idle` on exit, because the device simulator is shared with other lanes.
- Scratch scripts: `s82/phone*.sh` in the session scratchpad.

| # | AVD | Window | Captures and checks |
|---|---|---|---|
| 1 | dems_phone (emulator-5554) | 09:42:47–09:44:37 | `82_dems_phone_filter_incomplete.png`: the Incomplete chip shows exactly SES-20260930-0016, amber "Incomplete". `82_dems_phone_detail_incomplete.png`: detail with the Incomplete chip, the SYS-008 Alert ("Power failure … kept as evidence EV-20260930-0006"), key-values and investigator "AKP Budi Santoso". Hardware Back → `screen-sessions` (uiautomator). `82_dems_phone_search.png`: "Hendra" → 1 row, "1 session". Then Metro's inspector target dropped (09:44:06), so the recording part of this session did not run |
| 2 | dems_phone | 09:56:34–09:57:42 | `82_dems_phone_sessions.png`: MB 5-style list with the LogBox banner cleared. Header, Start (gold, dark label), search, filter chips, rows (poster, mono ID, date, subject, sim-code `SubjectTypeChip` → Tersangka/Saksi/Lainnya, mono duration, violet "Sealed" + lock, chevron). `82_dems_phone_refresh_pull.png`: the gold pull-to-refresh spinner on the warm surface. `82_dems_phone_refreshed.png`: after the refresh. The recording capture hit Metro's "Failed to compile", because step 54 was mid-write in `packages/shared/src/sim` (`maintenance.ts` imported `./devices` before that file existed). Kept as `82_dems_phone_p11_compile_error*.png` (P11) |
| 3 | dems_phone2 (emulator-5558, picked by `any`, D105) | 10:17:46–10:18:45 | After step 54 settled. `82_dems_phone2_recording.png`: active card with REC dot, "Recording", the sim-clock timer (00:18:52 at capture), ACTIVE SESSION SES-20261001-0024, LP/2026/1001-0007 + Tersangka, Ahmad Fauzi, "Return to monitor". Start is disabled with "A session is in progress…". The RECORDING row is first, with the "Live" badge, red "Recording" chip and a live red duration. The shell's live mini-bar is under the list. The fallback tap missed the row (uiautomator cannot idle with the 1 Hz timer): `82_dems_phone2_recording_tap_missed.png` |
| 4 | dems_phone (`any-phone`) | 10:19:33–10:20:15 | `82_dems_phone_recording_b.png` (same state). Tapping the RECORDING row (540, 1646 px) opened the Session Monitor ("Active Session SES-20261001-0024", REC 00:18:57): `82_dems_phone_rec_row_to_monitor.png`. **The brief's recording hand-off works on the device** |

**Logcat (`ReactNativeJS`) per session:**

| Session | E | W | crash | W texts |
|---|---|---|---|---|
| 1 | 0 | 11 | 0 | not captured |
| 2 | 0 | 1 | 0 | step 69's Reanimated reduced-motion notice |
| 3 | 0 | 4 | 0 | step 69's Reanimated reduced-motion notice; a require cycle in `packages/shared/src/demo-data/index.ts` ↔ `join.ts` |
| 4 | 0 | 4 | 0 | same as session 3 |

None of the warnings come from `features/sessions`. The runtime log has no `features.sessions.*` or error records.

Not checked on a device (moved to the end pass by D75):
- tablet panes (covered by jest tests 8 and 9);
- the pending-summary and FAULT hand-offs (jest tests 5 and 6);
- reduced motion, fps.

## 5. Decisions and drift

| ID | Kind | Note |
|---|---|---|
| DR-82-1 | drift (brief over spec) | §4.9 says a row opens `/sessions/[id]` (the Summary component). The brief's hand-offs win: monitor, summary when pending, evidence detail on phones when sealed. `/sessions/[id]` is this step's own detail (Home's Recent rows land there). It does not reuse step 80's `SessionSummaryScreen`, because that screen is a full `SafeScreen id="session-summary"` whose Back and Done go Home, and its parts are not exported |
| DR-82-2 | addition | FINALIZING (info) and FAULT (danger) chips and card variants, so an interrupted or finalizing current session never disappears from the hub. SEALED current sessions are listed once, from the history |
| DR-82-3 | addition | Thumbnails on the rows (MB 5 language) and a "Summary pending" chip |
| DR-82-4 | decision | Expanded = filters \| list \| detail (§2.4 "Sessions"). The filter pane shows counts ("Incomplete · 1") |
| DR-82-5 | decision | The refresh re-reads nothing (the simulator is live). It is a 700 ms sim-clock beat, a row re-reveal and an "Updated" stamp. Haptic selection on pull |
| DR-82-6 | note | No sheet is used, so the `use-sheet-presence` pattern was not needed |

## 6. Persistent issues

None that block. The jest message "did not exit one second after the test run" shows for single-test runs of the evidence and dashboard suites too, so it belongs to the environment, not this step.

## 7. Protocol notes

- **Controller messages applied:**
  - D100 / D105: the remaining capture used the first free AVD (`any`, `any-phone`). No emulator serial was hard-coded in session 3 or 4.
  - D103: sign-in went through the debug handle, and each session stayed under 1 minute once its lock was held.
- **Not written by this step:**
  - `masterplan/02_plan.md`: it has no per-step tracking table for rows 75–89;
  - `status_tasks.md` and `delegation_progress_report.md`: controller only, parallel run.
  - Progress: `delegation_progress/coder_execution_step_82.md`.
- **Processes (P7):** every Metro this step started (PIDs 75049, 88924, 12457, 15328) was stopped by the helper. No emulator was started or stopped. No `adb reverse` rule is left (the helper removes its own).

---
*Generated: 2026-10-01 10:22 WIB (final gate 10:21:24–10:21:51: jest 2 suites / 19 tests pass; tsc --noEmit exit 0, 0 errors; eslint src/features/sessions exit 0)*
