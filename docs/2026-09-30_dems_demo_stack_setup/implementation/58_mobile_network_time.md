---
task_id: 2026-09-30_dems_demo_stack_setup
step: 86
plan_row: 05_mobile_plan §3 M-14 (part b)
date: 2026-10-01
agent: coder-execution
tier: 3
lane: FAST LANE (D75)
status: complete
decisions: D17, D28, D55, D66, D73, D75, D78, D86, D87, D100, D103
---

# Step 86: mobile Network & Time (`/network-time`, MB 9)

**Outcome: PASS (fast lane).** Row 86 is met:
- the MB 9 regions N1–N4 are present in MB order;
- every time on the screen is UTC+07:00 from the shared arithmetic formatters;
- the screen's tests pass;
- mobile typecheck, lint and jest (own suites) exit 0;
- the device check was done on dems_tablet (D100) and in phone portrait on dems_phone2.

| Check (D75) | Result |
|---|---|
| Own tests | `npx jest src/features/network-time --maxWorkers=2`: **2 suites, 14/14 passed** (model 8, screen 6) |
| Lint | `npx eslint src/features/network-time`: **exit 0** |
| Typecheck | `npx tsc --noEmit` (whole mobile app): **exit 0** at 10:15 and again at 10:19 WIB, after the last edit. Earlier runs were red only in other lanes' in-progress files (devices test setup, settings-prefs, `packages/shared/src/sim/actions.ts`; P11), never in network-time |
| T-M02 route row | `routes.test.tsx` "/network-time renders screen-<id>" passes. The suite's other red rows are other steps' stub-param rows and step 84's victory-native import (F86-1) |
| Device | dems_tablet landscape 2560×1600 (D100) and dems_phone2 portrait 1080×2424, Metro 8081, `?motion=off`. Sign-in through `__DEMS_DEBUG__.sim.actions.signInWithBiometric("OPR-001")` (D103); no credential typed. Results in §2 |

**Scope (P6).**
- Written: only `apps/mobile/src/features/network-time/**`, this log, `assets/mobile/86_*.png` and `delegation_progress/coder_execution_step_86.md`.
- Not touched: `packages/shared/**`, `src/app/**`, `src/navigation/**`, `src/components/**`, any `package.json`, the jest config.
- No install. Nothing committed.

## 1. Files (`apps/mobile/src/features/network-time/`)

| File | Role |
|---|---|
| `network-time-screen.tsx` | `SafeScreen id="network-time"`.<br>Header per class: back + title on phones; on tablets the title plus time and LAN chips.<br>Layouts: compact = Network, Time, System Time (MB 9 order); compact-landscape = Network \| Time + System Time; medium = System Time hero over Network \| Time; expanded = System Time \| Network \| Time.<br>Enter order (§7.3): system time, then time card, then network card (`enterRise`) |
| `network-status-card.tsx` | N2 rows:<br>• LAN Connection: Connected chip + chevron; the row opens the LAN sheet<br>• PoE Network: Active chip (Degraded when a port drops)<br>• Bandwidth: 12 bars plus a C-6 `slide` readout "12.4 Mbps" over "↑ 3.1 Mbps" |
| `bandwidth-bars.tsx` | 12 plain-View bars, 0…max scale with 15% headroom, animation off, 56–96 dp wide (DR-86-1) |
| `time-sync-card.tsx` | N3:<br>• GNSS / NTP row: GNSS icon inside the orbit, sync chip, "UTC+07:00" (`formatUtcOffset`)<br>• Last Sync (`formatDate` dateTime), Time Source ("GPS (GNSS Stratum-1)"), Server<br>• the tier row |
| `tier-row.tsx` | GNSS → NTP → RTC as 3 kit `Chip`s.<br>One gold indicator slides to the active tier on the `indicator` spring (first placement does not animate; reduced motion jumps).<br>One warning pulse per step down (`animatePulseOnce(…, SPEC_LITERALS.escalationPulseMs)`, explicit `totalMs`, F74-02) |
| `gnss-orbit.tsx` | Skia orbit on a fixed 48 dp canvas (no `onSize`). It is the screen's one ambient loop, `network-time-orbit`, and runs only while GNSS is locked. On loss it fades out over `slow`; under reduced motion the satellite is static |
| `system-time-card.tsx` | N4: clock ring icon, date in gold (`formatDate` weekdayDate), C-6 `slide` clock (Orbitron 32/40), chip "Synchronized" / "Free-running". It subscribes to the 1 Hz clock itself, so only this card re-renders each second |
| `lan-sheet.tsx`, `use-sheet-presence.tsx` | LAN detail `BottomSheet`: IP, network, 1 Gbps, gateway, PoE ports, 18.6 W of 60 W, tablet link. Data comes in as props. The presence hook is a copy of the step-79 pattern (D78) |
| `use-network-time.ts` | Flat `useSim` selectors (F74-13), all on the sim clock (F74-09). Under `?motion=off` (D43) the clock and bandwidth window step once per minute.<br>`useTimeEscalationKey` and `useNetworkTimeAlerts`: one toast per level change (GNSS lost → warning, RTC holdover → warning, restored → success), shared `networkTime.toast.*` copy, nothing on mount |
| `network-time-model.ts` | Pure rules, the same as the web model (implementation/29): tiers, tier states, levels and tones (both fallbacks warning, P7), LAN/PoE levels, bandwidth window, UTC+7 second-of-day |
| `card-boundary.tsx` | Per-card error boundary:<br>• the shared panel copy in place of the failed card<br>• the error to `reportRuntimeIssue` (`dems.mobile.log.v1`)<br>• Retry with 3 s, 6 s and 12 s cooldowns, at most 3 |
| `icon-tile.tsx` | 36 dp round tone tile for the row icons |
| `i18n.ts` | `features.network-time.*`: only what this screen alone says, in MB 9 wording. Network labels, tier names and states, sync states and toasts come from the shared `networkTime.*` keys |
| `network-time-model.test.ts` | 8 pure tests:<br>• hierarchy rules, tones, escalation<br>• LAN/PoE levels<br>• bandwidth padding, newest 12, held window, scale<br>• UTC+7 arithmetic against `formatClock` and across WIB midnight |
| `network-time-screen.test.tsx` | 6 tests over the real `/network-time` route:<br>(1) MB 9 regions in order, all N2/N3/N4 values; Last Sync, date and clock equal an independent UTC+07:00 computation; orbit loop registered (≤ 4); 0 missing keys<br>(2) bars stream at 1 Hz and equal the newest 12 samples<br>(3) GNSS loss → NTP → RTC → restore: tier moves, chips escalate, one toast each, orbit loop stops and resumes<br>(4) LAN sheet<br>(5) tablet portrait: panes + header chips<br>(6) tablet landscape: 3 panes |
| `testing/network-time-test-setup.ts`, `testing/network-time-harness.tsx` | Test-only: the gorhom mock, and the real route inside `AppProviders` with `createTestSim` |

## 2. Device check (D75: one capture; D100: tablet counts; D103: sign-in via the debug handle)

| Shot | What it shows |
|---|---|
| [86_dems_tablet_network_time.png](assets/mobile/86_dems_tablet_network_time.png) | Expanded layout: System Time \| Network Status \| Time Synchronization; header chips Synchronized / Connected; "Thu, 1 Oct 2026", clock 10:12:00 (minute-held under `?motion=off`); LAN Connected, PoE Active, 12 bars, 12.3 Mbps / ↑ 2.9 Mbps; GNSS / NTP Synchronized, UTC+07:00, Last Sync 1 Oct 2026 10:12:15, GPS (GNSS Stratum-1), 192.168.10.1; tier GNSS Active. uiautomator lists every `network-time-*` resource-id plus `pane-system-time`, `pane-network` and `pane-time` |
| [86_dems_tablet_gnss_loss.png](assets/mobile/86_dems_tablet_gnss_loss.png) | After `inject("GNSS_LOSS")` with the screen open: toast "GNSS signal lost / Time is now held by NTP (192.168.10.1)…"; header and sync chip "NTP fallback" (warning); Time Source "NTP Server (Stratum-3)"; indicator on NTP, GNSS "Signal lost"; System Time still "Synchronized" (NTP disciplines the clock) |
| [86_dems_tablet_gnss_restored.png](assets/mobile/86_dems_tablet_gnss_restored.png) | After `clearFault("GNSS_LOSS")`: back to Synchronized, GPS (GNSS Stratum-1), GNSS Active. Fault cleared, so the AVD state is unchanged |
| [86_dems_phone2_network_time_final.png](assets/mobile/86_dems_phone2_network_time_final.png) | **Phone portrait (the MB 9 class).** N1–N4 fit one screen in MB 9 order: back + "Network & Time"; Network Status (LAN Connected + chevron, PoE Active, 12 bars, 12.8 Mbps / ↑ 3.2 Mbps); Time Synchronization (GNSS / NTP Synchronized, UTC+07:00, 1 Oct 2026 10:17:24, GPS (GNSS Stratum-1), 192.168.10.1, tier GNSS Active with the static satellite dot, reduced motion); System Time (Synchronized chip in the header, "Thu, 1 Oct 2026" in gold, 10:17:00). The bottom bar highlights More (H-MB-01) |
| [86_dems_phone2_gnss_loss_final.png](assets/mobile/86_dems_phone2_gnss_loss_final.png) | Phone, GNSS loss: the warning toast, "NTP fallback" (warning) with a warning-tinted GNSS tile, "NTP Server (Stratum-3)", indicator on NTP, GNSS "Signal lost", System Time still Synchronized. [restored](assets/mobile/86_dems_phone2_gnss_restored_final.png) returns to GNSS |
| `86_dems_phone2_*_fixed.png` | The same captures at 10:15, kept as DR-86-2 evidence |

**Open item (deferred to the end pass, step 59).** In the phone captures the row labels "Bandwidth", "Last Sync", "Time Source" and "Server" are missing.
- Cause: my DR-86-2 fix set `flexGrow: 0` on `ListGroup.ItemContent`. The kit class `.list-group__item-content { flex: 1 }` makes Yoga resolve an `auto` basis to 0, so the slot had zero width.
- Fixed at 10:19: these label slots are now plain `View`s with `flexShrink: 0`, so the class does not apply.
- After the fix, jest, lint and typecheck pass.
- The confirming capture (run 9, 10:19–10:26) did not reach the screen: phone2 was loaded (about 12 s per uiautomator dump) and returned to Login after each debug sign-in until the 420 s cap.
- I stopped there because of the D103 time-box. **Step 59 should check that the four labels show on one line beside their values** (phone portrait and tablet 3-pane).

**Environment notes (P11).** Device runs 1–5 failed for environment reasons, not because of the screen:
- run 1 (dems_phone, 09:51): the demo-operator fill did not land and the fields were empty on submit;
- run 2 (09:58): Metro failed to bundle another lane's half-written `packages/shared/src/sim/maintenance.ts` (`./devices` was not there yet);
- runs 4–5 (dems_tablet): Gboard's one-time "Try out your stylus" sheet took the typed input, then Metro reloaded the app between fill and submit (other lanes were editing files, and auth is memory-only).

The debug-handle sign-in (D103) worked in runs 6, 7 and 8. Cold starts were not measured (D87). The yellow LogBox bar is the shared `demo-data` require-cycle warning, not this step. Every session went through `device-session.sh` (force-stop first, Metro 8081, quoted deep links). No emulator was killed or rebooted (D78), and the injected GNSS fault was cleared each time.

## 3. SIM-GAPs

None open for this step.
- SIM-GAP-W50-4 (bandwidth history empty at boot) was closed by step 54 during this run: the history is now back-filled with 120 points. The screen handles both cases: it pads from the left and never invents a point.
- No local `sim-adapter.ts` was needed.

## 4. Decisions and drift

| ID | Item |
|---|---|
| DR-86-1 | The spec's `victory-native` `CartesianChart` + `Bar` was replaced by 12 plain RN Views. victory-native imports `d3-scale`, which is ESM-only and outside the jest transform allowlist (jest config is not a P6 path). Every app-wide suite that loads `/network-time` (T-M02 routes, chrome, guard) failed to parse it. Twelve bars need no chart engine |
| DR-86-2 | Device finding (tablet 3-pane, card about 290 dp): the Bandwidth label wrapped one letter per line and the fact labels wrapped. Labels now sit in plain `View` slots (`flexShrink: 0`, one line); bars flex from 56 to 96 dp; values ellipsize. The first attempt (an override on `ListGroup.ItemContent`) gave zero-width labels on the phone; see the open item in §2 |
| DR-86-3 | The System Time chip sits in the card header instead of right of the clock (MB 9). The Orbitron clock is about 170 dp wide, so ring + clock + chip overflowed a phone card and a tablet pane |
| DR-86-4 | The tablet header (medium and expanded) has no back arrow, because the rail is the navigation. It shows the title plus the time and LAN status chips (§2.3 "Header") |
| DR-86-5 | Time Source wording follows MB 9 ("GPS (GNSS Stratum-1)", "NTP Server (Stratum-n)") in feature copy; the shared `networkTime.systemTime.sourceValue` (web) stays as it is. Tones and tier rules match the web exactly (DR-50-1: both fallbacks warning) |
| DR-86-6 | System Time chip: "Synchronized" while GNSS or NTP disciplines the clock (`time.locked`); "Free-running" (warning) on the RTC. The N3 chip is level-based ("NTP fallback" is a warning) |
| F86-1 (for the controller) | Step 84's `features/devices/health-chart.tsx` imports victory-native and breaks `chrome.test.tsx`, `guard.test.tsx` and `routes.test.tsx` the same way (d3-scale `export` parse error at `node_modules/d3-scale/src/index.js:1`). Fix: add `d3-.*\|internmap` to the jest transform allowlist (config owner), or a module mock in those suites |

**Blockers: none.**

---
*Generated: 2026-10-01 10:16 WIB*
*Last Updated: 2026-10-01 10:28 WIB*
