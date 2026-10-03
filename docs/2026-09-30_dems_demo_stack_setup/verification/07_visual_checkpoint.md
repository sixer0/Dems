---
task_id: 2026-09-30_dems_demo_stack_setup
step: 45
checkpoint: CP-2 (parallel audit, D71; non-gating)
plan_row: 02_plan §4 W-21 subset, run early (02_structured row 45)
audited_steps: 41 (shell + route transitions), 42 (Dashboard), 43 (Login), 44 (Session Monitor)
date: 2026-10-01
agent: verifier
tier: 2
status: complete
verdict: FAIL (1 high, 2 medium, 4 low, 1 nit; every finding routed to an owner; nothing blocks other pages per D71)
---

# Step 45 (CP-2): Visual and performance checkpoint

## 0. Verdict

**Status: complete. Verdict: FAIL.**

- Every check row 45 lists passes: AC-59, AC-60, AC-61, AC-70 on these pages, plus the first AC-71 reading on the Session Monitor.
- The FAILs come from the extra checks the controller asked for:
  - the D80 SECURE-beam starvation check;
  - the §9.1 frame-rate budget on the Dashboard, read in windowed GPU Chrome;
  - pill consistency while recording;
  - the UTC+07:00 label part of AC-74.

| # | Severity | Finding | Owner (expected correction in §4) |
|---|---|---|---|
| F45-01 | High | The Dashboard runs at **30 fps in windowed GPU Chrome** while its two camera-tile videos play. With the videos paused or hidden it runs at 60 fps. So the cause is the two videos, not headless compositing | **42** (consult 39; relay to 48 and 58) |
| F45-02 | Medium | **D80 confirmed for one state.** When the system is CRITICAL while recording (`fault-demo`), the Dashboard holds 4 page loops, so the shell's SECURE BorderBeam is paused while the pill is red | **42** (alternative fix: 41) |
| F45-03 | Medium | During RECORDING the SECURE pill reads "SECURE · All systems operational" even with active warnings (MIC clip, fan stall). At the same moment the SM banner says ATTENTION, the strip says "Clipping" and the bell shows 1 | **41** shell pill model (file from 38); 54 for the simulator selector |
| F45-04 | Low | AC-74 "every timestamp shows UTC+07:00": the SM panel M Start Time has no zone label, while Dashboard D shows one. The Evidence list and detail have none either | **44**; 47 (Evidence leg) |
| F45-05 | Low | At 1440 the SM audio meters' peak-hold line overlaps the "MIC 1 – Interviewer" label | **44** (or 39) |
| F45-06 | Low | The ring caption for CRITICAL-while-recording says "A critical fault blocks recording" while recording continues | **42** |
| F45-07 | Low | Below 1024 px (outside the 1920/1440 scope), panel A's hairline arc is 929 px wide and draws a stray arc across the hero | **42** |
| F45-08 | Nit | At 1920 and 1440, "Items sealed today" wraps onto 3 lines (one line in the mockup) | **42** |

**What passed, in short:**
- Shell sizes are exact at all four breakpoints.
- At 1920 and 1440, the Dashboard and SM have no layout scroll and their row heights are within tolerance.
- The SM timer advances 1/s, and its meters run at 40 frames/s per channel.
- End Session → SEALED took 7.4 s, and a violet Sealed row appears in /evidence.
- No ambient-loop breach in any measured state.
- Reduced motion is static on all three pages.
- The emblem flight is continuous (success → settled 1.18 s).
- The D76 hand-off stall did **not** reproduce at normal load: 16–17 ms between the last Login frame and the first shell frame.
- SM AC-71 first reading: **60.0 fps, 0 long tasks over 30 s** in windowed GPU Chrome (Apple M5 Metal).
- No console errors in any run.

## 1. Scope, sources and method (5W1H)

- **What:** a read-only visual and performance audit of Login (step 43), Dashboard (42) and Session Monitor (44), plus the shell and route transitions (41). Measured against:
  - `ui_design/DEMS-Dashboard1.png` and `ui_design/DEMS-SessionMonitor.png`;
  - `research/04_ui_design_analysis.md` §2–§3;
  - `masterplan/01_specs.md` §14.14 (AC-59…AC-75);
  - `masterplan/03_motion_spec.md` §3–§9;
  - decisions D70, D71, D76, D80 and D81.
- **Why:** CP-2 is the early W-21 subset (02_structured row 45). Since D71 it runs as a parallel audit that routes findings to page owners.
- **When:** 2026-10-01, 09:17–09:43 WIB. Load average 4.1–7.9 on 10 cores (much lower than during steps 42–44, which ran at 19–38).
- **Where:**
  - Vite on **127.0.0.1:5173**, which is why the mock-core CORS allowlist lets the Core link go live. Private config `scratchpad/step45/vite.step45.config.mjs` (the app config unchanged, a private `cacheDir`, `hmr: false`, `watch: null`).
  - mock-core on 127.0.0.1:4400, started under P5.
  - Ports 5174 and 5175 and `[::1]:5173` belong to SMART WMS (PID 3489) and were never touched.
- **How:**
  - Own CDP harness over Node's `WebSocket`: `scratchpad/step45/{cdp,audit,probe,gpu,gpu2}.mjs`.
  - Two browsers:
    - Playwright `chrome-headless-shell` 1243;
    - **windowed Chrome for Testing 153.0.8010.12** with a throwaway profile. Its WebGL renderer reported `ANGLE (Apple, ANGLE Metal Renderer: Apple M5)`; the page was `visible` and focused.
  - Sign-in: `sessionStorage['dems.auth']` was seeded with OPR-001 (P4), except in the Login runs, which signed in through the real form with `budi.santoso` / the demo password.
  - Scenarios and faults were driven through the page's own simulator, found through the React tree (inspection only; the repo was never written).
  - Measurements:
    - fps from a rAF counter, which is the AC-71 method;
    - long tasks from `PerformanceObserver('longtask')`;
    - loops from the `?debug=1` overlay's data attributes;
    - fit from `main.scrollHeight/clientHeight` and the document scroll size.
- **Raw results:** `verification/assets/45_measurements.json` (15 result sets). Screenshots: `verification/assets/45_*.png` (47 files).
- **Graft:** not used. No code change is under audit, so there is no blast radius to compute. The audited surfaces were enumerated directly from row 45.
- **Limitations:**
  - Every number comes from the **dev build**.
  - Headless fps is indicative only (D70).
  - The windowed run used a 1710×931 window at devicePixelRatio 2 (the screen is 1710×1112). A 1920×1080 CSS viewport was forced through `Emulation.setDeviceMetricsOverride`, and the native window size was also measured (same result, §3.3).
  - Step 58 still owns the production-build AC-71 and MS-07 confirmation.

## 2. Checks (PASS or FAIL, with the measurement)

### 2.1 Shell and route transitions (step 41)

| Check | Result | Evidence |
|---|---|---|
| **AC-59**: nav width / top-bar height | **PASS** | 1920×1080 **232 / 80**; 1440×900 **216 / 72**; 1200×800 **72 / 72**; 900×800 nav hidden, **0 / 64**, hamburger present. Target 232/80, 216/72, 72/72, Drawer (0)/64 (`result-shell-1920.ac59`) |
| Route transition forward (Dashboard → SM, M-APP-04) | **PASS** | View transition active 63–330 ms. New page keyed `/session/` at 163 ms (opacity 0, `translateY(12px)`). Enter starts at about 330 ms; opacity 1 with `transform: none` at **897 ms**. Cap: exit 160 + enter ≤ 900. Screenshot `45_1920_route_forward_settled.png` |
| Route transition back (`history.back()`, R7) | **PASS** | `data-direction="back"`, first frame `translateY(-12px)`, settled at **870 ms** |
| Shell loops on a page with no page loops (/evidence) | **PASS** | Overlay 1/4: `clock-colon, secure-dot, topo-drift` (one shared shell slot) |
| Core link live on 5173 | **PASS** | From the page, `fetch('http://127.0.0.1:4400/api/v1/health')` returned 200. On Login, `data-core-link="online"` and the strip reads "CORE LINK Online" |
| MS-01 (AC-72) / MS-02 / MS-03 static greps | **PASS** | MS-01: `grep -rnE "animate=\{\{[^}]*(width\|height\|top\|left)" apps/core-web/src` → exit 1. MS-02: the box-shadow + animate/transition grep → exit 1. MS-03: `will-change` only in the allowed places (`dashboard.css:263` and `login.css:62` for Ken Burns; `glow-ring.tsx:355` for the rotating ring group) |

### 2.2 Dashboard (step 42)

| Check | 1920×1080 | 1440×900 |
|---|---|---|
| **AC-60** panels A–J | **PASS** (10/10) | **PASS** (10/10) |
| **AC-60** no scroll (`main` scroll / client) | **PASS** 1000 / 1000; document 1080 = viewport | **PASS** 828 / 828 |
| **AC-60** row heights A / D / F / I (±8) | **PASS** 338.5 / 254.9 / 179.2 / 147.3 (target 340/256/180/148) | **PASS** 275.7 / 212.7 / 153.6 / 126.0 (target 280/216/156/128) |
| **AC-75** | **PASS** `aria-valuetext` "20% used, 3.2 TB free of 4.0 TB", `aria-valuenow` 20, visible "20% USED · 3.2 TB Free of 4.0 TB" | **PASS** (same) |
| Ambient ≤ 4 (MS-04), idle READY | **PASS** 4/4 granted, 5 requested, no breach: `ring-rotate, ring-breath, hero-ken-burns, ripple, shine-border` (ripple and shine share one slot); shell paused (§9.4 by design) | **PASS** (same) |
| Ambient, recording | **PASS** 4/4: shell + `rec-pulse` (ring arcs and REC chips) + `ring-rotate` + `hero-ken-burns` | **PASS** |
| D80, idle + FAN_STALL (ATTENTION) / + CAMERA_LOSS (CRITICAL) | **PASS**: the idle invitation yields, `secure-beam` runs (`beamMounted: true`). Loops `clock-colon, secure-dot, topo-drift, ring-rotate, ring-breath, hero-ken-burns, secure-beam` | **PASS** |
| D80, **CRITICAL while recording** (`fault-demo`) | **FAIL → F45-02**: pill CRITICAL, but `secure-beam` is paused. Loops `ring-rotate, ring-breath, hero-ken-burns, rec-pulse \| paused: clock-colon, secure-beam, secure-dot, topo-drift`. Screenshot `45_1920_dashboard_faultdemo_debug.png` | **FAIL** (same) |
| Pill while recording + MIC_CLIP / FAN_STALL | **FAIL → F45-03**: `SECURE · All systems operational`, beam paused. MIC 2 is `CLIP+latched`, the strip shows "Clipping", the bell shows 1. Screenshot `45_1920_dashboard_recording_micclip_debug.png` | **FAIL** (same) |
| fps / long tasks (headless, 8 s) | idle 30.1 / 0; recording 30.1 / 0 | 30.1 / 0; 30.0 / 0 |
| fps (windowed GPU Chrome, 10 s) | **FAIL → F45-01**: idle **30.0**, recording **30.0**, 0 long tasks | — (native 1710×931: 30.0) |
| Visual against DEMS-Dashboard1.png | **PASS** with notes F45-06/07/08: same grid, panels, copy, icons and colours. Documented deviations (20% USED; RBAC-disabled Export; simulator values; licensed photo) match step 42 §6. Screenshot `45_1920_dashboard_idle.png` | **PASS** (`45_1440_dashboard_idle.png`) |

### 2.3 Session Monitor (step 44)

| Check | 1920×1080 | 1440×900 |
|---|---|---|
| **AC-61** panels K–T, recording | **PASS** (10/10) | **PASS** |
| **AC-61** timer advances 1/s | **PASS** Duration 00:18:46 → :47 → :48 → :49 → :50 at 1 s steps over 4 s (sampled every 500 ms); the REC chip agrees | **PASS** (:46 → :50) |
| **AC-61** meter frames ≥ 15/s per channel (`?debug=1`) | **PASS** `AUDIO-01: 40, AUDIO-02: 40` | **PASS** 40 / 40 |
| No scroll | **PASS** 1000 / 1000 | **PASS** 828 / 828 |
| Ambient ≤ 4 | **PASS** 4/4: shell, `banner-dot`, `feed-frame-glow`, `rec-pulse`. Idle: 2 (shell, `ring-breath` mini) | **PASS** |
| D80 on SM (CRITICAL while recording) | **PASS**: `secure-beam` runs (3 page loops + shell). Banner "FAULT Recording continues • Camera signal lost". Screenshot `45_1920_sm_faultdemo_debug.png` | — |
| Pill while recording + MIC_CLIP | **FAIL → F45-03**: banner `ATTENTION / warning` "Recording continues • Microphone clipping", pill `SECURE`. Screenshot `45_1920_sm_micclip_pill.png` | **FAIL** (same) |
| **AC-71 first reading** (recording, 30 s after a 4 s warm-up) | **PASS (indicative)**: windowed GPU Chrome **60.0 fps, worst frame 18 ms, 0 long tasks**; headless 60.0 fps, 0 long tasks | headless 60.0 fps, 0 long tasks |
| **AC-63** End Session → SEALED, through the real UI | **PASS**: 1.7 s pointer hold opens the AlertDialog (mid-hold screenshot `45_1920_sm_end_hold_mid.png`); reason typed; confirm. Timeline: STOPPING at 68 ms, FINALIZING at 1,602 ms, **SEALED at 7,369 ms** (≤ 10 s). Modal: "Sealed 7.3 s after the recording ended", package `data-source="package"` (DEMO, Ed25519). `EV-20261001-0014` in /evidence with a **violet Sealed chip, `rgb(167, 139, 250)`**. Screenshots `45_1920_sm_sealed_stamp.png`, `45_1920_evidence_after_seal.png` | **PASS**: SEALED at 7,439 ms; same row and chip |
| Visual against DEMS-SessionMonitor.png | **PASS**: same grid (L 820×424, M 402×424, N 402×214 over O 402×194, P 1656×62, Q 681×367, R 541×204 over S 541×147, T 402×367), copy and states. Notes F45-04, F45-05 | **PASS** with F45-05 |

### 2.4 Login and the hand-off (step 43; M-APP-01, MS-07, D76)

| Check | 1920×1080 | 1440×900 |
|---|---|---|
| Idle, Core link live | **PASS** `data-state="idle"`, `data-core-link="online"`, grade `baked` | **PASS** |
| No scroll / overflow | **PASS** 1080/1080, width 1920 | **PASS** 900/900 |
| Ambient ≤ 4 | **PASS** 4/4: `ken-burns, particles, ring-rotate, ring-breath` (+ `border-beam-lap` in the shared accents slot) | **PASS** |
| fps / long tasks (headless, 6 s) | 58.9 / 0 | 59.4 / 0 |
| **MS-07** emblem flight | **PASS** last Login frame [197, 311, 170] → first shell frame [197, 311, 170] (same box, no jump) → settled [20, 16, 48]. Flight **717 ms**. Success → settled **1,184 ms** (≤ 1.8 s). Largest frame step 28 px. 0 frames with no emblem, 0 with both. Landed `/dashboard`, `data-entrance="handoff"` | **PASS** [166, 240, 160] → [20, 14, 44]. Flight 684 ms; total 1,167 ms; largest step 22 px |
| **D76** hand-off pause | **Not reproduced**: **17 ms** between the last Login frame and the first shell frame; largest frame gap in the whole hand-off 50 ms (was 264 ms under load 19–38) | **16 ms**; largest gap 50 ms |

### 2.5 Reduced motion (AC-70, MS-06), OS emulation `prefers-reduced-motion: reduce`, 1920

| Page | Result | Evidence |
|---|---|---|
| Dashboard | **PASS** | `html[data-motion=reduced]`; 0 `data-ambient="running"`, 12 paused, 24 `data-motion="reduced"` marks; 0 `data-layout-id`; 0 infinite running animations (`document.getAnimations()`); both videos paused; meters kept (10/s); 60.0 fps. Screenshot `45_1920_dashboard_reduced.png` |
| Session Monitor (recording) | **PASS** | 0 running, 7 paused, 19 marks; videos paused; meters kept (20/s overlay, 10 Hz per instance); 60.2 fps. Screenshot `45_1920_sm_reduced.png` |
| Login | **PASS** | 0 running, 6 paused, 9 marks, no layoutId; 60.2 fps. Screenshot `45_1920_login_reduced.png` |
| Login hand-off becomes a cross-fade | **PASS** (note O-4) | No flight: the shell emblem first appears at its slot [20, 16, 48]. The card, backdrop and wordmark fade 1 → 0.09 over about 140 ms. Then the top bar, nav and route fade 0 → 1 over about 180 ms with `transform: none` (`probe-handoff-reduced`) |

### 2.6 AC-74 (same session; client-side navigation, one simulator)

| Surface | Session ID / case / investigator | Zone label |
|---|---|---|
| Dashboard D | SES-20261001-0024 / LP/2026/1001-0007 / AKP Budi Santoso; Start Time "1 Oct 2026 09:15:45 **UTC+07:00**" | yes |
| SM panel M | the same three values; Start Time "1 Oct 2026 09:15:45" | **no → F45-04** (page: 1 zone label against 45 clock times) |
| Evidence list (during recording) | the active session is not listed (the item exists only after seal) | list rows: none |
| Evidence after seal | `EV-20261001-0014`, LP/2026/1001-0007, AKP Budi Santoso; the Session ID appears on the detail page (checked on EV-…-0013: "Session SES-20261001-0023") | detail: 0 zone labels → F45-04 (step 47) |

Result: **identity PASS, zone label FAIL (Low)**. The controller should rule whether the Evidence leg of AC-74 is read after seal (O-5).

### 2.7 Console

There were no `error` entries and no exceptions in any of the 15 headless sessions (the 2 windowed runs did not record console output). The only warnings were Motion's "You have Reduced Motion enabled…" notices during the emulated reduced runs (step-36 N-3).

## 3. Key evidence for the FAILs

### 3.1 F45-02: SECURE beam starved (D80)

- **Measured** (`probe-fault-demo`, 1920):
  - simulator: session `RECORDING`; faults `CAMERA_LOSS:VIDEO-02, MIC_CLIP:AUDIO-02, GNSS_LOSS:NTP`;
  - pill `CRITICAL`; beam `paused`, not mounted;
  - running elements: `glow-ring <svg ticks>`, `glow-ring <svg bracket-glow>`, `hero-media`, and `rec-indicator` in panel **D** ("REC 00:18:46").
- **Same state on /session:** beam `running`, mounted.
- **Mechanism:**
  1. When the state is not RECORDING, the ring breathes in a slot of its own (`components/composed/glow-ring.tsx:211-214`: the group is `rec-pulse` only while `recording`).
  2. Panel D's REC thumbnail still mounts a RecIndicator, which takes its own `rec-pulse` slot (`features/dashboard/active-session-panel.tsx:256-262` → `components/media/rec-indicator.tsx:43`).
  3. With hero Ken Burns, that makes 4 page slots.
  4. The registry ranks `page` above `shell` (`motion/ambient-registry.ts:51`, `:70-71`), and SecureBeam asks for `priority: 'shell'` (`components/shell/secure-pill.tsx:164`).
- **Contract broken:** D-42-11 says "a degraded system frees the slot for the shell's SECURE BorderBeam". It holds for idle (§2.2) but not for CRITICAL while recording.

### 3.2 F45-03: pill masks warnings while recording

- **Root cause in the simulator** (`packages/shared/src/sim/selectors.ts:249-253`): after the critical check, `RECORDING` wins over `ATTENTION`, so warnings never reach `state`.
- **The shell then maps RECORDING to SECURE** (`apps/core-web/src/components/shell/integrity-checks.ts:26-32`, "READY and RECORDING read as SECURE").
- **Result:**
  - idle + FAN_STALL → pill ATTENTION with the beam;
  - recording + FAN_STALL, or + MIC_CLIP → pill "SECURE · All systems operational".
- **Meanwhile the page shows:**
  - SM banner "ATTENTION Recording continues • Microphone clipping";
  - Dashboard strip "2 Microphones • Clipping";
  - bell badge 1;
  - G posture "1 active alert".

### 3.3 F45-01: Dashboard 30 fps in windowed GPU Chrome (controls)

`gpu2-result.json`, Dashboard idle, Chrome for Testing 153, Metal, page visible and focused, 6 s per row:

| Condition | fps | Worst frame |
|---|---|---|
| a. Native window 1710×931 @2x, everything running | **30.0** | 34 ms |
| b. 1920×1080 viewport override | **30.0** | 34 ms |
| c. b + both `<video>` paused | **60.0** | 18 ms |
| d. b + both `<video>` `display:none` | **60.1** | 18 ms |
| e. b + hero Ken Burns layer hidden (videos playing) | 30.1 | 34 ms |
| f. b + reduced motion (loops off, videos paused) | 60.1 | 18 ms |
| g. b again (4 loops, videos playing) | 30.0 | 34 ms |
| h. Session Monitor idle in the same window | 60.0 | 18 ms |

Also measured (`gpu-result.json`, same browser): Dashboard recording 30.0 fps; SM recording 60.0 fps for 10 s and for 30 s.

**Reading:**
- The cap follows the two concurrently playing camera-tile videos (`features/dashboard/devices-panel.tsx:169-176`, two `CameraFeed variant="tile"` with the default `live` = true).
- It does not follow the ambient loops or the hero.
- The SM, which plays one video, holds 60 fps. In `fault-demo`, Camera 2 is NO SIGNAL, so one video plays and the Dashboard overlay shows 61 fps.
- So D81's "headless 30 fps attributed to software compositor" (and D79's for Devices) is **not** the explanation in a real GPU window. D70's "30 fps with two videos" is the real limit, and it applies here too.

## 4. Routing: expected corrections (read-only audit; nothing was changed)

| Finding | Owner | Expected correction | Re-check |
|---|---|---|---|
| F45-01 | **42** (consult 39 for a component-level option) | Keep at most **one playing `<video>`** on the Dashboard at a time. For example, Camera 2's tile uses `live={false}` (poster), refreshed every few seconds or swapped with Camera 1 on hover or focus. Or the two tiles alternate live; or one shared decode (39). Keep the REC/NO SIGNAL states. Relay the same limit to **48** (Devices plays two videos; D79) and to **47** if the detail page plays VIDEO-01 and VIDEO-02 at once | Windowed GPU Chrome on 5173: Dashboard idle and recording ≥ 55 fps (step 58 on the production build) |
| F45-02 | **42** (alternative: **41**) | Page fix: while ATTENTION or CRITICAL, keep the Dashboard at ≤ 3 page slots. For example, pause the decorative hero Ken Burns while degraded, or put panel D's REC chip in the ring's slot even when the ring shows CRITICAL. Systemic alternative (41): `SecureBeam` acquires its slot with page priority while degraded, so an attention signal (R8, M-SH-05) outranks decoration on every page. The controller picks one | `fault-demo` on /dashboard: `secure-beam` running, ≤ 4 slots, no breach |
| F45-03 | **41** (shell pill model; `integrity-checks.ts` came from step 38) + **54** (simulator) | Derive the pill from flag severity, not from `systemStatus().state`: any CRITICAL flag → CRITICAL, any WARNING flag → ATTENTION, otherwise SECURE, whether or not a recording is running. Step 54 may expose `selectSystemSeverity` (or `systemStatus().severity`) so the ring keeps RECORDING while the pill and the G header read the severity | Recording + MIC_CLIP: pill ATTENTION and the beam runs. Re-check the Dashboard recording budget: 3 page slots + shell = 4 |
| F45-04 | **44**; **47** for the Evidence leg | SM M Start Time: append the zone as Dashboard D does (`` `${formatDate(…)} UTC${formatUtcOffset()}` ``, see `active-session-panel.tsx:72-74`; currently `details-panel.tsx:53`). Evidence list and detail timestamps: add the UTC+07:00 label (or a labelled column header). Controller rules on the Evidence leg during recording (O-5) | AC-74 browser check in step 58 |
| F45-05 | **44** (or 39) | At the 1440 density tier, give the meter its own row below the label, or cap the meter and peak-marker height, so the peak-hold line never crosses the label (`45_1440_sm_audio_label_overlap.png`) | 1440 SM screenshot |
| F45-06 | **42** | A recording-aware CRITICAL caption, for example "Recording continues. A critical fault needs attention." (`packages/shared/src/i18n/en/dashboard.ts:21` currently says "A critical fault blocks recording…") | `fault-demo` screenshot |
| F45-07 | **42** | Below the lg tier, hide panel A's decorative hairline-arc SVG or size it to its cell (at 900×800 it is 929 px wide; `main` scrollWidth 976 > clientWidth 900, clipped by `overflow-x: hidden`). Screenshot `45_900_dashboard_tier.png` | 900×800 and 1200×800 screenshots |
| F45-08 | **42** | Keep "Items sealed today" on one line at xl and lg (allow more width, or shorten to "Sealed today") | 1920 and 1440 screenshots |

## 5. Observations (no action, or for step 58)

- **O-1 (D76).** The 264–349 ms commit stall did not reproduce at load average about 7: 16–17 ms, and the largest frame gap was 50 ms. It was a load artefact of the dev build. Step 58 confirms it on the production build.
- **O-2 (M-APP-01, accepted DR-43-4).** The Login backdrop fades out before the Dashboard hero fades in. Mid hand-off (`45_1920_handoff_mid.png`), the content area is black for about 0.4 s while the emblem lands and the top bar drops in. This is not a cross-fade between the two photos. Flagged for step 58's MS-07 visual check.
- **O-3.** The top-bar clock has no zone label, and neither does the mockup. Whether AC-74's "every timestamp" includes the clock is a controller reading.
- **O-4.** The reduced-motion hand-off is a fade-out (about 140 ms) followed by a fade-in (about 180 ms), not one overlapping 240 ms cross-fade. There is no motion, so it is acceptable under DR-41-14.
- **O-5.** "Verify PASS on the detail Integrity tab" (AC-63) was not exercised here. Step 47 reports EV-0001 PASS 8/8. This goes to step 58. The Evidence list does not show a session that is still recording.
- **O-6.** At 1440, SM N's "GNSS (UTC+07:00)" truncates to "GNSS …" with a title tooltip (DR-44-10 density rule).
- **O-7.** In panel D's innerText, the RecIndicator SlidingNumber exposes its ten-glyph digit columns ("0 1 2 3 …"). Screen-reader exposure was not checked here; step 56 or 58 should confirm that those columns are `aria-hidden`, as the top-bar clock face is.

## 6. Processes (P5, P7) and write scope (P6)

- **mock-core (P5), run 1:**
  - Under `lockf -k .locks/mock-core.lock`: 4400 was not listening, so I started it (sh 53661 → npm exec 53663 → tsx 53684 → node 53686), recorded the listener PID 53686 in `.locks/mock-core.pid`, and touched `.locks/mock-core.users/step-45`.
  - Release under the same lock: my entry was the only one, so I stopped 53686/53684/53663/53661 and removed the PID file.
- **mock-core, run 2** (re-measure for O-4): the same procedure with listener 74265 (sh 74243 → 74245 → 74264). Stopped the same way.
- **Vite 127.0.0.1:5173:** npx 54006 / node 54024 (run 1), npx 74278 / node 74296 (run 2). Both stopped.
- **Browsers:** 15 `chrome-headless-shell` and 2 Chrome for Testing one-shots, each killed by its own script (`SIGKILL` in `finally`). Throwaway profiles and the private Vite cache were deleted afterwards.
- **After cleanup:**
  - `lsof -iTCP -sTCP:LISTEN` shows neither 127.0.0.1:5173 nor 4400 (only SMART WMS `[::1]:5173`, PID 3489, untouched);
  - `ps` shows none of my PIDs and no headless shell or Chrome for Testing;
  - `.locks/mock-core.users/` is empty.
- **Written:**
  - this file;
  - `verification/assets/45_*.png` (47) and `verification/assets/45_measurements.json`;
  - `delegation_progress/verifier_step_45.md`;
  - scratch scripts under the session scratchpad.
- **Not written:**
  - no code, configuration or `package.json`;
  - not `delegation_progress_report.md`, `status_tasks.md` or `masterplan/02_plan.md` (controller-owned during the parallel run, P8).

---
*Generated: 2026-10-01 09:45 WIB*
