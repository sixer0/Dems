---
task_id: 2026-09-30_dems_demo_stack_setup
step: 50
plan_row: 02_plan §4 W-16 (Network & Time page)
date: 2026-10-01
agent: coder-execution
tier: 3
lane: FAST LANE (D75)
status: complete
decisions: D28, D41(d), D49, D61, D63, D70, D72, D74 (R1–R10), D75
---

# Step 50: Network & Time page (`/network-time`)

**Outcome: PASS (fast lane).** Row 50 is met. The only failing check is the full core-web typecheck, and it fails on another step's files (P11).

| Check (D75) | Result |
|---|---|
| Render test: page test ID, every §14.5.6 panel test ID, UTC+07:00 timestamps | `network-time-page.test.tsx` test 1 checks:<br>• `page-network-time` and the 6 IDs `network-time-panel-{system-time, hierarchy, network, domains, offset, log}`<br>• the clock, last sync and newest log row, each matched to an independent UTC+07:00 computation<br>• the zone chip `UTC+07:00`<br>• 0 missing i18n keys |
| Own tests | `npx vitest run src/features/network-time --maxWorkers=2`: **2 files, 8/8 passed**. The route test `/network-time renders page-network-time` (AC-48) also passes (9/9 in the 07:07 combined run) |
| core-web lint | `npm run lint -w @dems/core-web`: **exit 0**. Scoped `oxlint -f json`: 0 diagnostics in 17 files |
| core-web typecheck | 06:58: **exit 0** (the page complete). 07:07 and 09:15: exit 2, with all 3 errors in `features/system/{diagnostics,settings-panel}.tsx` (step 52, still in progress). A scoped `tsc` over the feature, `src/i18n.ts`, the route file and the test setup reports no error in network-time files (P11) |
| Shared | `packages/shared` i18n test 14/14; `npm run typecheck -w @dems/shared` exit 0 |
| Screenshot | `implementation/assets/29_1920_settled.png` (1920×1080, headless Chromium, shared Vite 5178, 07:06 WIB) |

**Scope (P6):**
- Written:
  - `apps/core-web/src/features/network-time/**` (the stub replaced; `NetworkTimePage` and `data-testid="page-network-time"` kept)
  - `packages/shared/src/i18n/en/network-time.ts` (additive: the step-34 keys are unchanged)
  - two test files
  - this log, the screenshot and the progress file
- Not touched: `packages/shared/src/sim/**`, `package.json`, the shell, routes and other features.
- No install, no `vite build`, nothing committed.

## 1. Files (`apps/core-web/src/features/network-time/`)

| File | Role |
|---|---|
| `index.tsx` | Page: `PageHeader` with banner, 12-column grid (5\|7, 6\|6, 6\|6), `useNetworkTimeAlerts()` |
| `panel.tsx` | Panel card with the M-PG-NET beat, plus a per-panel error boundary (retries at 3 s, 6 s and 12 s, at most 3) |
| `choreography.ts` | Panel beats 80 / 140 / 380 / 440 / 500 / 560 ms; `time-tier` layout ID (R5) |
| `status-banner.tsx` | "SYNCHRONIZED • CONNECTED" with source, stratum and IP; the worse half sets the tone; one glow bloom on escalation (R8) |
| `system-time-panel.tsx` | Clock hero:<br>• `HH:mm:ss` mono digits (MP **SlidingNumber**; plain under reduced motion) at 1 Hz via `selectClockSecond` (R8)<br>• WIB date and a 60-tick second track<br>• chips: `UTC+07:00` WIB zone, sync state<br>• time source and the §2.2 timestamp chain<br>• derived A/V-sync strip (§22.2) |
| `hierarchy-panel.tsx` | Left: the GNSS constellation (MU **OrbitingCircles**, two orbits, the hero moment). It turns only while locked and fades to "NO FIX" on loss.<br>Right: tiers GNSS → NTP → RTC with state chips; one `layoutId="time-tier"` highlight moves between them (a cross-fade under reduced motion).<br>Footer: lock, stratum, last sync ("· n s ago"), offset, server |
| `network-panel.tsx` | Rows:<br>• LAN connection (IP, LAN name, 1 Gbps, gateway)<br>• PoE: CAM 1 and CAM 2/AUX link LEDs, 4/4 ports, 18.6 W of 60 W budget (`scaleX` fill)<br>• bandwidth: streaming sparkline plus down/up Mbps<br>• tablet link, with the "recording continues on the Core" `Alert` when offline |
| `domains-panel.tsx` | Segmentation diagram (MU **AnimatedBeam**, one shared slot):<br>• Cameras ↔ Core ↔ Tablet<br>• Service and Export dashed or dotted until they carry traffic<br>• the forbidden Camera ↔ Tablet route crossed out as "No direct route"<br>• "Camera NIC · PoE" and "MGMT NIC" edge labels<br>Then the 4 §21.1 domain cards: VLAN, access, rule, state |
| `offset-panel.tsx`, `charts.tsx` | Offset history (Recharts `LineChart`, one colour per source, GNSS ±4 ms band, zero line) and the bandwidth sparkline. Both load as a lazy chunk (the DR-49-6 pattern) and always use `isAnimationActive={false}` (streaming, §9.3) |
| `events-panel.tsx` | Compact kit `Table` with the 8 newest network and time events (time, event plus detail, source). Rows from an earlier WIB day show their date |
| `use-network-time-alerts.ts` | Toasts:<br>• GNSS lost → NTP (warning)<br>• RTC holdover (warning)<br>• GNSS restored (success)<br>• tablet link lost (warning)<br>Also the escalation key for the glow blooms (P7, R8) |
| `model.ts` | Pure: tier state, time and network level, tones, offset series (coloured segments joined), formatting |
| `sim-adapter.ts` | SIM-GAP-W50-1…4 (§3) |
| `log.ts` | Structured dev-console error record (no client log endpoint, D41(g)) |
| `network-time.css` | Page styles (`nt-` prefix, `@layer components`). Only `transform` and `opacity` transitions, time-scaled for `?motion=slow` |
| `__tests__/network-time-page.test.tsx` | 4 router-level tests:<br>(1) render, panels, UTC+07:00 and 0 missing keys<br>(2) GNSS loss → NTP tier, orbit "NO FIX", banner and toast, FAULT row in the log; then the RTC fallback with "No time reference" and A/V DEGRADED; then the clear, with GNSS back and the "restored" toast<br>(3) tablet offline gives the Alert, Management Degraded and the toast; camera loss gives Camera Degraded, 3/4 ports and a degraded banner<br>(4) reduced motion: plain digits, `html[data-motion=reduced]`, and the offset and bandwidth charts render from history |
| `__tests__/network-time-model.test.tsx` | 4 pure tests: hierarchy rules, offset and formatting, W50-1 domain states (export window, update, tablet), W50-2 A/V sync, W50-3 filter (stable references, newest first) |

## 2. Browser check (one screenshot, D75)

- **Server:** shared Vite on 127.0.0.1:5178 was not listening at 07:01. I started it (`npx vite --port 5178 --strictPort --host 127.0.0.1`, PID 38918 / node 38942) under `lockf .locks/vite.lock` and registered `.locks/vite.users/step-50`.
- **Browser:** `chrome-headless-shell` 1243 over CDP (Node WebSocket, no package installed), viewport 1920×1080. `sessionStorage` was seeded with `dems.auth` = OPR-001 and `dems.shell.intro` = 1. The page loaded 60 s before capture so the charts had filled.
- **Probe at capture:**
  - page present, clock `07:06:39`, banner "Synchronized • Connected", active tier GNSS
  - offset chart 7 points, bandwidth 63 points, 4 log rows
  - horizontal overflow: page 0, `main` 0
  - ambient elements with `data-ambient="running"`: present (orbit carriers, beams, shell)
  - console: Vite and React DevTools notices only; no errors, no exceptions
- **Teardown:** I removed `step-50`. No users remained, so I stopped the server (P14, last user) and Chrome, and deleted the scratch profile. Ports 5178 and 9350 were free afterwards.
- **After the capture:** the only change was to time-scale the two CSS transition durations. Nothing visible changed.
- **Moved to the end pass (45/58, D75):** fps, long tasks, loop cap, reduced-motion browser run, 1440 layout.

## 3. SIM-GAPs (for step 54; `grep -rn SIM-GAP-W50 apps/core-web/src`)

| ID | Gap | Local adapter |
|---|---|---|
| SIM-GAP-W50-1 | `network.domains[]` is `{id, vlan, active}` only. There is no per-domain state or NIC, and SERVICE_UPDATE and EXPORT_TRANSFER never change | `domainState` derives the state:<br>• Camera: from the cameras (ACTIVE / DEGRADED / DOWN)<br>• Management: from the link and tablet link<br>• Service: UPDATING while `update.state` is RUNNING, otherwise RESTRICTED<br>• Export: TRANSFER for 20 s after the latest EVIDENCE_EXPORTED event, otherwise ON_DEMAND |
| SIM-GAP-W50-2 | No A/V-sync health (§22.2) | `selectAvSync`: HEALTHY when the time source is locked and disciplined and all tracks are delivering, otherwise DEGRADED. Labelled "Derived for the demo; the book leaves the A/V limits TBD" |
| SIM-GAP-W50-3 | No event category, so no network/time selector (as W49-2) | `selectNetworkTimeEvents` filters by type (TIME_SYNC, tablet/pairing, export, update, boot) and by fault kind (GNSS_LOSS, CAMERA_LOSS). It returns store-owned objects |
| SIM-GAP-W50-4 | `time.history` and `bandwidth.history` start empty on every boot (only `storage.history` is back-filled) | None. The panels show "Collecting samples" and never invent points. Step 54 may seed about 20 min of history |

## 4. Decisions and drift

| ID | Item |
|---|---|
| DR-50-1 | Both fallbacks (NTP and RTC) use the **warning** tone, matching the simulator's alert severity and the precheck (TIME RTC = WARN). The two are distinguished by text ("NTP fallback" / "RTC holdover") and by the tier highlight moving down (P7: calm escalation) |
| DR-50-2 | Page ambient loops: the orbit (`nt-orbit`) and the beams (`nt-beams`), one slot each, plus the shell slot, so 3 of 4. The bandwidth sparkline is 1 Hz data, not a registered loop. The banner dot and clock colons are steady: there is no third page loop |
| DR-50-3 | The A/V-sync strip shows only the book's qualitative facts (sample-synchronous CH1/CH2, common timeline, source metadata) plus a derived state. No A/V offset number is invented, because the book gives TBD |
| DR-50-4 | NIC labels appear only where the book or simulator supports them: Camera NIC = the PoE ports (Camera domain) and MGMT NIC = MGMT LAN. Service and Export show VLAN 30 and VLAN 40 without a NIC claim |
| DR-50-5 | The sparkline Y scale is `dataMin−1 … dataMax+1`, so the 1 Hz stream is visible; the exact Mbps values sit beside it. The offset chart keeps an honest scale: zero line plus a ±4 ms band |
| DR-50-6 | R1: `selectSystemState` is not used. Every `useSim` selector returns primitives, store-owned references or flat records of primitives (R8: 1 Hz or slower re-renders; the log's day key changes once per day) |

**Blockers: none.** P11: the core-web typecheck currently fails only in `features/system` (step 52, in progress).

---
*Generated: 2026-10-01 09:17 WIB*
