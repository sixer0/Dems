---
task_id: 2026-09-30_dems_demo_stack_setup
step: 48
plan_row: 02_plan §4 W-14 (Devices & Inputs page)
date: 2026-10-01
agent: coder-execution
tier: 3
lane: web, shared Vite 127.0.0.1:5178 (P14, D72)
status: complete
decisions: D28, D38, D41(d), D49, D50, D59, D61, D63, D64, D65, D70, D71, D72, D74 (review-40 relay)
---

# Step 48: Devices & Inputs page (`/devices`)

**Outcome: PASS.** Run 05:40–06:46 WIB. The row-48 check passes, and the headless-Chromium check at 1920×1080 and 1440×900 is recorded with screenshots (§4).

| Row-48 check | Result | Evidence |
|---|---|---|
| Render test asserts the page test ID and every panel test ID §14.5.4 lists, in the idle scenario | **PASS** | `renders the page test ID and every §14.5.4 panel test ID, with 0 missing i18n keys` ✓: `page-devices` plus `panel-cameras`, `panel-summary`, `panel-audio`, `panel-other`, `panel-front`, `panel-ports`. The device drawer (`device-drawer`) is asserted in a second test, with its three tabs |
| core-web typecheck, lint and test exit 0 | **PASS** | 06:42–06:44 WIB: `tsc -b` exit 0; oxlint exit 0 (0 diagnostics in the 20 feature files); vitest exit 0, `Test Files 26 passed (26)`, `Tests 320 passed (320)` |
| Browser check at 1920×1080 and 1440×900: fps, long tasks, ≤ 4 loops, reduced motion | **PASS, with the D70 caveat** | §4.2. 0 long tasks in every final run. At most 2 of 4 ambient slots granted. Reduced motion: 0 loops, 0 CSS animations, videos on their posters, 60.2 fps. With the two live videos playing, headless Chromium caps at 30 fps; with the same page and the videos replaced by the procedural feeds, it runs at 59.7–60.1 fps (media isolation, §4.2). AC-71 is measured in windowed Chrome with the GPU in step 58 (D70) |

**Scope (P6):**
- Writes stayed inside:
  - `apps/core-web/src/features/devices/**` (the step-38 stub replaced; the export `DevicesPage` and `data-testid="page-devices"` kept);
  - `packages/shared/src/i18n/en/devices.ts` (additive; every step-34 key and value kept);
  - `delegation_progress/coder_execution_step_48.md`, this log and nine `implementation/assets/27_*.png`.
- Not touched: `packages/shared/src/sim/**` (gaps are SIM-GAP-W48-1..5 with a local adapter), `package.json`, the lockfile, other features, the shell, routes, `index.css`.
- No `npm install`. Nothing committed. Shared tracking files (`masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md`) were not edited: parallel run.

## 1. Files

**`apps/core-web/src/features/devices/`** (all new except `index.tsx`, which replaces the stub):

| File | Lines | Role |
|---|---|---|
| `index.tsx` | 154 | `DevicesPage`: page header and banner, the 12-column grid of six panels, the device Drawer; page-level action handler (toasts, structured errors), Identify state, hero bloom timer |
| `panel.tsx` | 126 | `DevicesPanel` (kit `Card`, house header, M-PG-DEV beat, `GlowLayer`) and `DevicesErrorBoundary` (rate-limited retry, 3 s → 6 s → 12 s, max 3) |
| `camera-tile.tsx` | 113 | Lens tile: status dot, name, lens and track, recording-track chip, status chip, kebab; **CameraFeed** `tile` (live step-92 loop); format, PoE port, bitrate |
| `summary-cards.tsx` | 113 | Four kit `Card variant="secondary"` metric cards with MP **AnimatedNumber** (held beat), dot and state, detail line |
| `audio-input-card.tsx` | 205 | **DbfsMeter** `large` (vertical) beside a dBFS scale; peak-hold readout (4 Hz, DOM text); read-only gain (`Tooltip`, G13); 48 V phantom; clip latch with reset; recording track; ADC; calm NO SIGNAL / CLIP hints |
| `other-devices.tsx` | 171 | Read-only kit `ListBox`: PoE switch (book view), recording indicator with the "SEDANG MEREKAM" lamp, tablet control, GNSS receiver, TPM / Secure Element; tablet-offline `Alert` (S9) |
| `front-panel.tsx` | 113 | Front panel: LCD, five LEDs with `Tooltip`s, UP / DOWN / ENTER / BACK |
| `lcd-display.tsx` | 293 | The 800×480 local status display as an SVG on the real 800×480 grid; four pages (STATUS, NETWORK, STORAGE, DEVICE); 1 Hz |
| `port-map.tsx` | 126 | Rear-panel port map: `Chip` + link LED + `Tooltip` per connector, book order; ports open their device's drawer |
| `device-drawer.tsx` | 423 | Kit `Drawer` (right) with kit `Tabs`: Overview (per-device facts), Health, Log (kit `Table`, i18n-mapped rows) |
| `health-chart.tsx` | 134 | Recharts `LineChart`, first draw 700 ms, then 1 Hz updates without animation |
| `device-menu.tsx` | 115 | Kebab `Dropdown` (Details, Test signal, Identify, Restart) and the Identify ring |
| `devices-banner.tsx` | 73 | Header status banner (READY / RECORDING / ATTENTION / CRITICAL) |
| `status-chip.tsx` | 71 | `StatusChip` (M-C-10 label cross-fade, colour transition, one halo on escalation) and `StatusDot` |
| `model.ts` | 233 | Pure selectors returning primitives or flat records: device status codes, tones and severities, banner, summary, LCD pages, `formatTb` |
| `sim-adapter.ts` | 427 | SIM-GAP-W48-1..5 adapters (§3) |
| `motion.ts` | 92 | M-PG-DEV beats and stagger hooks, hero-bloom timing, `logDevicesError` |
| `context.ts` | 71 | Device actions, Identify and mic-sampler contexts |
| `labels.ts` | 97 | Device, kind and port names from i18n |
| `devices.css` | 1191 | Feature styles (`@layer components`; shell tiers; CSS loops carry `data-ambient`) |
| `__tests__/devices-page.test.tsx` | 423 | 17 tests (§4.1) |

**`packages/shared/src/i18n/en/devices.ts`** (307 lines): additive keys for the banner, status words, cameras, summary details, audio facts, other devices (GNSS, TPM, PoE book view), ports and tooltips, the front panel (LEDs, buttons, LCD pages), the drawer (kinds, fields, health metrics, log) and action toasts. The existing keys keep their values, including `other.recordingLamp` "SEDANG MEREKAM" and `other.recordingLampGloss`, which `test/i18n.test.ts` pins.

## 2. The page as built

**Layout** (research/04 §5.2; 12 columns at ≥ 1280 px, 8 at 1024–1279, 1 below; shell tiers from `data-shell-tier`):

```
[Header DEVICES & INPUTS | banner "All devices ready 9/9"]
[Camera Devices 8: Lens 1 | Lens 2 live tiles]   [Summary 4: 2×2 metric cards]
[Audio Inputs 8: MIC 1 | MIC 2 large meters]      [Other Devices 4: ListBox + tablet Alert]
[Front Panel 5: LCD 800×480 + 5 LEDs + buttons]   [Port Map 7: rear-panel connectors]
+ Device Drawer (Overview, Health, Log)
```

**Content by region** (§14.5.4 and the controller brief):

| Region | Built |
|---|---|
| Camera Devices | Dual-lens camera, VIDEO-01 / VIDEO-02 tiles through CameraFeed `tile` (live loops, media-in, hover lift, NO SIGNAL on a lens fault). Status chip READY / FAULT, recording-track chip (REC / DEGRADED / LOST) while recording, "1080p • 25 fps" on the feed, format with codec, PoE CAM 1, 9 Mbps. Kebab menu. The image opens the drawer |
| Summary | Cameras 2/2, Microphones 2/2, Other devices 5/5, Ports linked 7/7, each with a tone dot, state word and detail line |
| Audio Inputs | MIC 1 - Interviewer (Ch 1), MIC 2 - Subject (Ch 2): large vertical DbfsMeter (20 Hz transient, peak hold, CLIP latch chip, NO SIGNAL) beside a dBFS scale; peak hold readout; gain 32 dB read-only; 48 V ON; clip latch Clear or **Reset clip**; recording track; ADC 24-bit / 48 kHz |
| Other Devices | PoE Switch "1 active · 1 spare"; Recording Indicator (relay) with the lamp lit and breathing while recording; Tablet Control CONNECTED / OFFLINE with the "recording continues" `Alert`; GNSS Receiver "Locked · 11 satellites" or "No fix · time from NTP"; TPM 2.0 / Secure Element OK / FAILED |
| Front Panel | LCD pages STATUS (state word, REC timer while recording, session, inputs, time and source), NETWORK, STORAGE ("20% USED", "3.2 TB FREE OF 4.0 TB", estimate), DEVICE (ID, room, firmware, serial, TPM and Secure Boot). LEDs POWER / RECORD / NETWORK / STORAGE / FAULT. UP / DOWN cycle pages, BACK goes home, ENTER opens the front panel's drawer. Plate "DEMS EDGE CLIENT · Digital Evidence Recording Controller" |
| Port Map | AC INPUT, PoE CAM 1, PoE CAM 2/AUX (Spare), MGMT LAN, MIC IN 1, MIC IN 2, GNSS SMA, Relay I/O, SERVICE USB (Disabled), each with a link LED and a tooltip (for example "Dual-lens camera · 18.6 W of the 30 W port budget") |
| Drawer | Overview facts per device kind; Health line (link quality, signal level, PoE draw, relay, time offset, attestation, core temperature); Log of the device's audit rows |

**Motion (M-PG-DEV; §3, §5, §7–§9):**
- **Enter order:** cameras 80 ms (tile stagger 60 ms; CameraFeed media-in), metric cards 160, audio 240, other devices 320 (rows 60 ms), front panel 400, port map 460 (LEDs 40 ms apart).
- **Hero (R3):** the two large meters finish last. The audio panel's pre-rendered glow blooms once at 1,150 ms, after the last port LED.
- **Ambient loops (§9.4):** `rec-lamp` (the SEDANG MEREKAM lamp and the RECORD LED, `glowBreath`, while recording) and `port-leds` (port and NETWORK LED flicker, 1 Hz, 2 Hz while recording, ≤ 2 Hz). The live videos are media, not loops (D-39-2). The procedural fallback's push-in uses CameraFeed's own `camera-feeds` group. Both loops pause off-screen, in a hidden tab and under reduced motion (`useAmbientLoop`, motion.css).
- **Data moments:**
  - Chips escalate with one halo, then hold their colour (P7, R8).
  - The banner title cross-fades and escalates once.
  - The tablet `Alert` fades and slides 8 px in (240 ms).
  - The Drawer is the kit default; its Health line draws once.
  - Identify blinks a gold ring 3 times at 2 Hz.
- **Only opacity and transform animate.** The chip colour transitions (400 ms) are the M-C-10 exception. Glow changes are the opacity of pre-rendered layers.

**Error handling (coder-execution STEP 3):**
- Every simulator action (test signal, restart, clip reset) runs in try/catch: a friendly toast (layer 1), a structured dev-console record `logDevicesError` with level, source, message, stack, context and timestamp (layer 2; no client log endpoint exists, D41(g)), and the page keeps working (layer 3).
- Each panel and the drawer have their own error boundary with a rate-limited retry: 3 s, 6 s, 12 s, max 3, then "Reload the page".
- No personal data is logged: device IDs and action names only.

**Review-40 relay (D74) applied:**
- R1: no whole `selectSystemState` (the LCD selects `.state`).
- M1 and R1: every `useSim` selector returns primitives, flat records or store-owned references. The port map selects `link:activity` codes, not fresh objects.
- R8: 1 Hz UI through `useSimSecond`.
- R9: no new ID parser.
- R10: SIM-GAP-W48-n live in `sim-adapter.ts` (28 mentions in the folder).
- m4: the drawer Log maps `type`, `details.kind`, `details.command` and `details.state` to i18n; the simulator's English `message` is never shown.
- M3 and M5 do not apply: the page shows no keys or signatures and issues no session commands.

## 3. Simulator gaps (for step 54 or 91; local adapters in `sim-adapter.ts`)

| ID | Gap | Local handling | Suggested fix in `src/sim` |
|---|---|---|---|
| **SIM-GAP-W48-1** | The PoE model differs from the design book. The simulator has 4 PoE ports ("4/4 Ports Active", from mockup MB 7), camera lens 2 on `POE_CAM_2_AUX`, and 6.2 W per lens. The book has one dual-lens camera ("two logical video tracks", BOM B.01) on **PoE CAM 1** (up to 30 W) and **PoE CAM 2/AUX as the spare** ("0 W normal / reserve up to 30 W", §8), for 2 PoE ports on the rear panel (§4.2). The brief asks for "PoE switch 2 ports incl. spare" | `bookPoe()` and `rearPorts()`: PoE CAM 1 is up while either lens streams; CAM 2/AUX shows Spare; draw = `network.poe.drawW`; both tiles show PoE CAM 1 | Set `network.poe` to `totalPorts: 2` with the CAM 2/AUX spare, move lens 2 to `POE_CAM_1`, and keep a single-lens loss off the port link. **Until then the Dashboard and Network & Time pages may show "PoE 4/4" while Devices shows "1 active · 1 spare"** |
| SIM-GAP-W48-2 | The GNSS receiver and the TPM / SE are not device entries. `otherDevices` has 3 items, and `selectDeviceStats.otherTotal` is 3 against the page's 5 | Rows derived from `time` and `security`. Their menus offer Details and Identify only, because `deviceCommand` rejects unknown IDs | Add `GNSS` and `TPM` to `otherDevices` (derived in `derive.ts`) so `deviceCommand` and `selectDeviceById` know them |
| SIM-GAP-W48-3 | No front-panel model. The LCD Display Service exists as a service (§6.1 #14), but there is no LED or LCD state. The book leaves LED colours and blink patterns open (01_explore §3 A.34 "[Gap]") | `frontPanelLeds()` demo mapping. POWER: green, amber on POWER_FAIL. RECORD: red breathing while recording, amber while stopping or finalizing, red in FAULT. NETWORK: green activity, amber when the tablet is offline. STORAGE: green / amber / red. FAULT: off / amber / red from active alerts. LCD copy is i18n | Optional `frontPanel` slice (LED states, LCD page) if the mobile app or a physical twin needs it |
| SIM-GAP-W48-4 | No per-device health history (review 40 m3, known gap "48 per-device health series") | `healthSeries()` reads the simulator's own series: `network.bandwidth.history` (1 Hz) for the link quality of the lenses and the tablet and the PoE and relay time base; `time.history` for the GNSS offset; `health.series` for the core temperature. Fault `since` times drop points to 0 from the moment of the fault. Mic levels come from a page-level 1 s peak sampler (`MicLevelSampler`), fed transiently. Limitation: after a fault clears, earlier points read healthy again, because the simulator no longer holds the fault's time | A bounded per-device series (level or link quality) in the 1 Hz health subsystem |
| SIM-GAP-W48-5 | No IDENTIFY device command (research/04 §5.2 kebab "Identify (blink)") | UI-only: a gold ring blinks 3 times at 2 Hz plus a toast. No audit row | `DeviceCommand.IDENTIFY` with a DEVICE_COMMAND audit row |

**Note (not a gap in this page):** `deviceCommand` checks no permission. The page gates **Restart** on DEVICE_MANAGE (TECHNICIAN) and disables it while recording ("Requires the Technician role" / "Not available while recording"). Test signal stays open to every role, because it is harmless and simulated.

## 4. Verification (fresh)

### 4.1 Tests (`src/features/devices/__tests__/devices-page.test.tsx`, 17)

| Group | Tests |
|---|---|
| Idle scenario (row 48) | Page and 6 panel test IDs. Both lens tiles live through CameraFeed (`data-live="true"`, "1080p • 25 fps • H.264", "PoE CAM 1"). Two `large` meters with the exact `aria-label`s. Gain 32 dB and 48 V ON. Summary 2 / 2 / 5 / 7 of 7. Banner "All devices ready 9/9". PoE "1 active · 1 spare". Lamp unlit. Tablet CONNECTED, GNSS locked, TPM OK. 9 ports in book order, with spare and disabled. LCD `viewBox 0 0 800 480`. 5 LED states. **0 missing i18n keys** (AC-66). LCD page cycling with UP / DOWN / BACK, and the storage page text "20% USED" and "3.2 TB FREE OF 4.0 TB" |
| Drawer | Opens from the Camera 1 image with tabs Overview / Health / Log. Overview shows the model. Health metric is `linkQuality`. Log lists "Device command sent" and "Test signal (simulated)" (i18n-mapped). The GNSS row opens its drawer with the NTP server |
| Faults (P7) | MIC_NO_SIGNAL → NO SIGNAL hint, banner ATTENTION "1 device needs attention", MIC IN 1 link down. CAMERA_LOSS VIDEO-02 → FAULT tile with NO SIGNAL, lens 1 unaffected, PoE CAM 1 still up, banner CRITICAL, FAULT LED red. MIC_CLIP latch stays after `clearFault` until **Reset clip**. Tablet OFFLINE → `Alert`, chip OFFLINE, NETWORK LED amber, and the Alert leaves on reconnect |
| Recording | Lamp lit, RECORD LED `rec`, REC chips on both tracks, banner RECORDING, LCD "REC 00:18:4x" |
| Kebab | Test signal → audit DEVICE_COMMAND `{command: TEST_SIGNAL}` on MIC-02. Identify → ring. Restart disabled for INVESTIGATOR with "Requires the Technician role", and allowed for TECHNICIAN (audit RESTART) |
| Reduced motion | The lamp is `data-motion="reduced"` and `data-ambient="paused"` while lit |
| Adapters | Book PoE view through lens losses. LED mapping under STORAGE_LOW / FULL, recording, POWER_FAIL. Health series from `bandwidth.history`; TPM series; `MicLevelSampler` closes 1 s peaks (−12, then −40). `deviceLog` files GNSS, tablet, PoE command and relay rows. Banner and summary under TPM_FAILURE. Standalone render with `SimProvider` only |

**Runs:**

| Check | Command | Result |
|---|---|---|
| Feature tests | `npx vitest run src/features/devices --maxWorkers=2` (cwd `apps/core-web`) | `Tests 17 passed (17)`, twice in a row after the last edit |
| Mutation (not vacuous) | `panel-${id}` → `panelx-${id}` in `panel.tsx`; `cam1Link = true` in `sim-adapter.ts`; both restored (`cmp`: "restored identical") | `Tests 2 failed \| 15 passed (17)`: the row-48 render test and the book-PoE adapter test |
| core-web typecheck, run 1 (≈06:35, before the final browser run) | `npm run typecheck -w @dems/core-web` | exit 2. The only errors are in `src/features/evidence/index.tsx` (step 47) and `src/features/security-audit/__tests__/tmp-rac-cache.test.tsx` (step 51), both concurrent (P11). The error list names no `features/devices` file |
| core-web lint, run 1 | `npm run lint -w @dems/core-web` | exit 0 |
| core-web test, run 1 (≈06:36) | `npm test -w @dems/core-web -- --maxWorkers=2` | exit 1: `2 failed \| 317 passed`. The failures were `routes.test.tsx › accepts the evidence detail tabs` (step 47's page in flux) and `shell-motion.test.tsx › SECURE pill … BorderBeam`, which mounts `/dashboard` (step 42's page loops take the 4 slots). Both are concurrent (P11). The devices tests passed |
| **core-web typecheck, lint and test, run 2 (06:42–06:44)** | same three commands | **exit 0 / exit 0 / exit 0**. `Test Files 26 passed (26)`, `Tests 320 passed (320)` |
| Lint detail | `npx oxlint -f json src/features/devices` | `diagnostics 0`, 20 files |
| Shared i18n | `npx vitest run test/i18n.test.ts` (cwd `packages/shared`); `npm run typecheck -w @dems/shared`; `npm run lint -w @dems/shared` | 14/14; exit 0; exit 0 |
| MS-01 (AC-72) | `grep -rnE "animate=\{\{[^}]*(width\|height\|top\|left)" apps/core-web/src/features/devices` | exit 1 (none) |
| MS-02 | `grep -rn "box-shadow" …/devices --include='*.tsx' \| grep -E "animate\|transition"` | exit 1 (none) |
| MS-03 | `grep -rnE "will-change\|willChange" …/devices` | exit 1 (none) |
| CSS | `transition:` on box-shadow or layout properties in `devices.css`; `@keyframes` properties other than opacity | none; none |

### 4.2 Browser check (headless Chromium over CDP; shared Vite 127.0.0.1:5178)

**Method:**
- Playwright's `chrome-headless-shell` 1243, the same binary steps 36, 38, 39 and 41 used, driven by a scratch CDP script (`scratchpad/devices-check.mjs`; Node 26 global `WebSocket`, no package installed).
- `dems.auth` was seeded with OPR-001 (P4/P14), and the page was opened with `?debug=1`.
- Scenarios and faults were driven through the page's simulator, reached by a debug-only React-fiber lookup from `#root` (inspection only; no product hook added).
- fps: rAF count over 6 s after warm-up. Long tasks: `PerformanceObserver('longtask')` in the same window.
- Loops: the `?debug=1` overlay's `data-ambient-running` and granted list. Overflow: page `scrollWidth` versus `innerWidth` plus elements past the content edge.

**Final run (06:39–06:40 WIB, after the last code change):**

| Run | fps | Long tasks > 50 ms | Ambient slots granted (of 4) | Notes |
|---|---|---|---|---|
| Blank page baseline | 60.2 | 0 | — | Same browser |
| 1920×1080 idle | 30.1 | 0 | 1 (shell group: clock colon, secure dot, topo drift) | Port LEDs off-screen, so paused (R10). Page 1920 wide, `offRight 0`, main scroll 1420 / 1000 |
| 1920 idle, videos paused by script | 30.0 | 0 | — | CameraFeed resumes playback (its own policy), so this is not isolation; see the media isolation below |
| 1920×1080 recording | 30.0 | **0** | 2 (shell, `rec-lamp`) | 9 CSS animations. Banner "Recording in progress · every input is captured" |
| 1920×1080 faults (MIC 1 no signal, lens 2 lost, tablet offline) | 30.1 | 0 | 2 (shell with `secure-beam`, `rec-lamp`) | Banner "3 devices need attention · Camera 2: FAULT · +2 more"; lens-2 video paused on NO SIGNAL |
| 1440×900 idle | 30.2 | 0 | 1 | `innerWidth` 1440, main 1224 wide, no overflow |
| 1440×900 recording | 30.1 | 0 | 2 | — |
| **1440×900 reduced motion** (`prefers-reduced-motion: reduce`, recording) | **60.2** | 0 | **0** | `html[data-motion=reduced]`, **0 CSS animations**, both videos paused at 0 s (posters), lamp `data-motion=reduced` `data-ambient=paused` (steady on), meters at 10/s |
| Console | — | — | — | Only `ws://127.0.0.1:4400/ws` connection refused (mock-core not running off 5173, P4) and Motion's dev notice under reduced motion. No errors or React warnings. No P11 reloads in the final run |

**Media isolation (06:44 WIB, same browser, `Page.addScriptToEvaluateOnNewDocument` refusing `HTMLMediaElement.play`):**

| Variant | Feeds | fps | Long tasks |
|---|---|---|---|
| Idle, two live videos | `video:none`, `video:none` | 30.2 | 0 |
| Idle, videos refused, so procedural canvases (Ken Burns, grain, scanline) | `procedural:autoplay` ×2 | **59.7** | 0 |
| Recording, videos refused | `procedural:autoplay` ×2 | **60.1** | 0 |

**Reading:**
- The page holds 60 fps. The 30 fps is headless Chromium's software video path with two videos decoding at once. D70 reproduced it with two plain `<video>` tags and no page code.
- A CPU profile of the idle page (`Profiler`, 4 s) shows the main thread **94.6 % idle**.
- The tiles are the Camera Devices content, not small thumbnails, so they stay live (the brief: "VIDEO-01/VIDEO-02 live tiles"). AC-71 is measured in windowed Chrome with the GPU in step 58.
- An attempt to measure in the desktop app's Browser pane failed: the pane was hidden, so rAF was throttled and the script timed out. The tab was closed.

**Defects found in the browser and fixed:**

| ID | Finding | Fix | Proof |
|---|---|---|---|
| B-48-1 | While recording, **6 long tasks of 57–85 ms in 6 s**, one per second. Long-animation-frame attribution: `TimerHandler:setInterval → sim/engine.ts tick`. The CPU profile pointed at two **SlidingNumber** REC timers (the CameraFeed REC overlay on each tile) re-rendering synchronously inside the store update | The tiles pass `recordingSince={null}`. The recording state stays visible as the per-track REC chip, the lamp and the RECORD LED; the elapsed time belongs to Session Monitor | Re-profile: SlidingNumber inclusive time halved (only the shell clock left). Final runs: **0 long tasks** in recording at 1920 and 1440 |
| B-48-2 | Drawer header stacked vertically: the kit's `.drawer__header { flex-direction: column }` won because the feature rule did not set a direction | `flex-direction: row` plus right padding for the close button | `27_1920_drawer_health.png` |
| B-48-3 | Link-quality chart looked flat on a 0–100 axis | Domain 90–100. Recharts widens it to 0 when a fault drops a point | Same screenshot: the lens-loss drop at the fault time |
| B-48-4 | 1440: the camera meta format was truncated, and the audio facts wrapped "24-bit / 48 kHz" | Meta columns 1.5 / 1 / 0.8 with wrapping, pinned to the tile bottom; the ADC fact moves to the drawer at 1024–1599 px | `27_1440_idle.png` |
| B-48-5 | Summary cards were sparse (large empty areas) | Head row (icon and label), 38 px value, state, and a detail line (for example "Dual-lens DL-2 on PoE CAM 1", "1 spare · 1 disabled by default") | `27_1920_idle.png` |

**Screenshots** (`implementation/assets/`):
- `27_1920_idle.png` and `27_1440_idle.png`: idle;
- `27_1920_recording.png` and `27_1440_recording.png`: lamp lit, REC chips;
- `27_1920_faults.png`: calm faults (NO SIGNAL lens 2 and MIC 1, tablet Alert, banner CRITICAL);
- `27_1920_front_rear.png`: LCD "REC 00:19:01", LEDs, port LEDs;
- `27_1920_drawer_health.png`: Camera 2, link quality dropping at the fault;
- `27_1920_drawer_log.png`: "Fault raised · Camera signal lost";
- `27_1440_reduced.png`: reduced motion, overlay 0/4 loops, 60 fps.

**Visual check** (my captures against the Dashboard / AssetSample language):
- The warm L2 panels have bronze hairline glows, gold icons and tracked uppercase titles, as on D1 and SM.
- Tiles are inset L3 surfaces with status dots and soft chips, as on AS #10, #11 and #16.
- The header is the SM template with a right-side banner.
- The front and rear panels add an appliance "twin" in the same palette: an 800×480 LCD in JetBrains Mono, and LEDs and port lights with static glow.

## 5. Decisions, drift and notes

| ID | Kind | Item |
|---|---|---|
| DR-48-1 | drift (brief over spec) | §14.5.4 and MB 7 say "PoE Switch 4/4". The controller brief and the book say 2 ports including a spare. The page follows the brief (SIM-GAP-W48-1). **Cross-page inconsistency until step 54 aligns the simulator** |
| DR-48-2 | decision | The banner counts **9 devices**: 2 lenses, 2 mics, PoE switch, recording indicator, tablet, GNSS, TPM. research/04 §5.2 sketched "6/6" before the brief added GNSS and TPM. The front panel is the appliance itself and is not counted |
| DR-48-3 | decision (perf, B-48-1) | No REC timer overlay on the lens tiles. Recording is shown by the track chips, the lamp, the LED and the LCD timer (one 1 Hz SVG) |
| DR-48-4 | decision | Panel test IDs are `panel-{cameras,summary,audio,other,front,ports}`, plus `device-drawer`. §14.5.4 names the regions but gives no IDs; the front panel is the brief's addition |
| DR-48-5 | decision | Restart is gated on DEVICE_MANAGE and disabled while recording. Test signal is open to all roles (simulated, harmless) |
| DR-48-6 | decision | Mic labels are the i18n "MIC 1 - Interviewer (Ch 1)" (research/04 §5.2), not the simulator's `mic.name` "MIC 1 – Interviewer" that Session Monitor uses |
| DR-48-7 | decision (motion budget) | No banner-dot loop on this page. The page keeps its §9.4 budget (camera Ken Burns group, recording lamp, port LEDs) plus the shell loop. At most 2 slots were granted in every measured state |
| DR-48-8 | test harness | The feature test stubs `Element.prototype.getAnimations` (the kit Tabs indicator, React Aria SelectionIndicator, reads Web Animations, which jsdom lacks). It also waits up to 5 s for the lazily split route chunk (busy host, P9) |
| DR-48-9 | env | P14: shared Vite 127.0.0.1:5178 was already listening (started by step 51). I registered `step-48` under `.locks/vite.lock`, used it, and removed the entry at the end; steps 47 and 51 remain, so the server keeps running. The Browser pane tab I opened (tab-5) was closed. Each scratch Chrome (PIDs 98007 … 20069, one per run) was killed by its script and its profile deleted |
| DR-48-10 | note | The HealthChart recomputes from simulator state once per simulator second. Opening the drawer adds no 20 Hz work; the mic sampler runs page-wide through two transient subscriptions (no renders) |

**Relays:**

| To | Item |
|---|---|
| 54 (sim owner) | SIM-GAP-W48-1 (PoE: 2 ports, lens 2 on CAM 1, spare CAM 2/AUX), -2 (GNSS and TPM as devices), -4 (per-device series), -5 (IDENTIFY); optionally -3 |
| 42, 50 (Dashboard, Network & Time) | Until SIM-GAP-W48-1 closes, their "PoE 4/4" (from `network.poe`) disagrees with Devices "1 active · 1 spare". The controller may want one rule for all three |
| 58 (verification) | AC-71 on `/devices` in windowed Chrome with the GPU. Headless shows 30 fps with the two live tiles and 60 fps with procedural feeds (§4.2) |
| 45 (checkpoint audit) | The ambient budget and the reduced-motion behaviour are measured in §4.2 |

**Persistent issues:** none. **Blockers:** none.

---
*Generated: 2026-10-01 06:46 WIB*
