---
task_id: 2026-09-30_dems_demo_stack_setup
step: 49
plan_row: 02_plan §4 W-15 (Storage page)
date: 2026-10-01
agent: coder-execution
tier: 3
status: complete
decisions: D28, D41(d), D49, D61, D63, D70, D71, D72, D74 (review-40 relay)
---

# Step 49: Storage page (`/storage`)

**Outcome: PASS.** The row-49 cell is met. Command output is quoted in §4 and the browser measurements are in §5.

| Row-49 check | Result |
|---|---|
| Render test asserts the page and panel test IDs from §14.5.5 | `storage-page.test.tsx` asserts `page-storage`, the 8 panel IDs `storage-panel-{capacity, kpis, usage, sealed, volumes, activity, calculator, policy}`, the banner, 4 KPI cards and both volumes, with 0 missing i18n keys (AC-66) |
| Ring text 20% USED with "3.2 TB free of 4.0 TB" (AC-75, unit form) | The same test passes. `aria-valuetext` reads "20% used" and `aria-valuenow` is 20.1. After the sweep beat the centre reads `20%` / `USED` and the headline reads `3.2 TB free of 4.0 TB`. The legend reads Used 804 GB, Free 3.2 TB, Sealed Evidence 7 today, Pending 1 |
| core-web typecheck | `npm run typecheck -w @dems/core-web`: **exit 0** (06:29 and 06:37 WIB) |
| core-web lint | `npm run lint -w @dems/core-web`: **exit 0**. `oxlint -f json`: 0 diagnostics in 268 files; 0 in the 23 storage TypeScript files |
| core-web test | The storage tests pass **21/21**, and so do the 5 shell and route tests that mount `/storage` (26/26, §4.2). The full suite exits 1 **only** on tests of other steps' pages (`/dashboard`, `/session`, login, evidence, security-audit), all concurrent. P11 record in §4.3 |

**Scope.**
- Written: `apps/core-web/src/features/storage/**` (the stub replaced; export `StoragePage` and root `data-testid="page-storage"` kept, 19_app_shell.md §2), the namespace file `packages/shared/src/i18n/en/storage.ts` (additive), the two test files in the feature folder, this log, 15 screenshots `implementation/assets/28_*.png`, and `delegation_progress/coder_execution_step_49.md`.
- Not written: `packages/shared/src/sim/**` (two gaps logged, §3), `package.json` or the lockfile, the shell, routes or other features.
- No `npm install`, no `vite build`, nothing committed.
- Run window: 2026-10-01, 05:35–06:41 WIB.

## 1. Files

**Created or replaced (all under `apps/core-web/src/features/storage/`):**

| File | Lines | Role |
|---|---|---|
| `index.tsx` | 60 | `StoragePage`: `PageHeader` with the status banner, the 12-column grid, lazy chart panels (Recharts in its own chunk, Skeleton fallback), `useStorageAlerts()` |
| `panel.tsx` | 108 | `StoragePanel` (kit `Card`, the mockup panel header, M-PG-STOR beat) and `StoragePanelBoundary` (per-panel error boundary with the 3 s → 6 s → 12 s retry, at most 3) |
| `capacity-panel.tsx` | 220 | Capacity ring (kit `ProgressCircle`, gradient arc, scale and threshold ticks, glow halo), the free headline and the 4-row legend |
| `kpi-cards.tsx` | 161 | Write speed, session size, est. remaining, retention days (`Card variant="secondary"` × 4, AnimatedNumber) |
| `usage-chart.tsx` | 114 | Usage over 24 h (Recharts `AreaChart`, tooltip, one-shot draw) |
| `sealed-chart.tsx` | 120 | Sealed per hour (Recharts `BarChart`, current hour highlighted, `shape` instead of the deprecated `Cell`) |
| `chart-skeleton.tsx` | 24 | Chart panel frame with a kit `Skeleton` while the chart chunk loads (M-C-24) |
| `volumes-panel.tsx` | 140 | NVMe (system) and HDD (evidence): role, kit `ProgressBar`, SMART-like health, temperature sparkline |
| `sparkline.tsx`, `sparkline-path.ts` | 34, 26 | Plain-SVG streaming sparkline (no chart library, no animation) |
| `activity-panel.tsx` | 99 | Recent storage activity (`ScrollShadow`, edited MU `AnimatedListItem`, highlight on rows that arrive later) |
| `use-new-rows.ts` | 20 | IDs that arrived after mount (the M-C-07 highlight batch) |
| `retention-calculator.tsx` | 246 | §10.2 calculator: kit `NumberField` + `Slider` per input, formula strip, 5 result tiles, kit `Meter` |
| `policy-panel.tsx` | 101 | Threshold scale (LOW 85 %, FULL 98 %), the policy list, and the "Manage Storage" button |
| `manage-drawer.tsx` | 134 | Kit `Drawer`: `Select` retention policy, `Switch` auto-archive, the sealed-evidence `Alert`, Apply → `actions.setStoragePolicy` |
| `status-banner.tsx` | 51 | Header status banner (READY / LOW / FULL, free and remaining) |
| `use-storage-alerts.ts` | 42 | Escalation toast (LOW warning, FULL persistent danger) and the glow `pulseKey` counter |
| `choreography.ts` | 121 | M-PG-STOR beats, panel variants, `useDataReady` (R4 held beat), `useChartMotion` (mount-only chart animation) |
| `model.ts` | 241 | Pure maths: units, ring geometry, the §10.2 formula, chart view models, threshold tones |
| `sim-adapter.ts` | 144 | SIM-GAP-W49-1 and SIM-GAP-W49-2 (§3) |
| `log.ts` | 16 | Structured dev-console error record (no client log endpoint, D41(g)) |
| `storage.css` | 1,171 | Page styles in `@layer components` (grid, panels, ring, KPIs, charts, volumes, activity, calculator, policy, banner, drawer) |
| `__tests__/storage-page.test.tsx` | 249 | 8 router-level tests (§4.1) |
| `__tests__/storage-model.test.tsx` | 158 | 13 pure tests (§4.1) |

**Changed (shared namespace):** `packages/shared/src/i18n/en/storage.ts`, 205 lines.
- Additive only. All 34 step-34 keys keep their text; a few now go unused and are kept for other consumers: `calculator.bitrate`, `calculator.perHour`, `calculator.daysLeft_*`, `volumes.title`, `volumes.nvme`, `volumes.hdd`.
- New groups: `banner.detail`, `capacity.*`, `kpi.*`, `units.*`, `charts.*`, `volumes.*`, `activity.*`, `calculator.*`, `policy.*`, `toast.*` and `manage.*`.
- The shared i18n test (placeholders, plural pairs, no stray whitespace) passes 14/14.

## 2. The page as built (01_specs §14.5.5; 04 §5.3; MB 8; D1 F)

**Layout:**
- **≥ 1600:** a 12-column grid in four rows: capacity 5 | KPIs 7; usage 7 | sealed 5; volumes 6 | activity 6; calculator 8 | policy 4.
- **1280–1599:** the calculator and the policy each take a full row. Container queries turn the policy into a 3-column strip.
- **1024–1279:** 2 columns. **Below 1024:** 1 column.
- No horizontal overflow at 1920 or 1440 (§5).

| Region | Kit / item | Data | Notes |
|---|---|---|---|
| Header banner | `Card variant="secondary"`, `GlowLayer` | `selectStorage` (state, free, remaining) | "STORAGE READY · 3.2 TB free · about 389h 45m of recording left". The dot is steady (calm page); an escalation blooms once |
| Capacity ring + legend | `ProgressCircle` (large), `Chip`, MP AnimatedNumber | `selectStorage`, `selectEvidenceStats` | USED % (D28/Q1). Gold gradient arc; amber at LOW, red at FULL (stop colours transition 400 ms). Static scale ticks, with threshold ticks at the simulator's `STORAGE_LOW_PERCENT` 85 and `STORAGE_FULL_PERCENT` 98. Legend (D1 F / MB 8): Used 804 GB (gold), Free 3.2 TB, Sealed Evidence 7 "today" (violet, D28/Q4), Pending 1 (amber) |
| KPI cards | `Card variant="secondary"` × 4, AnimatedNumber | `storage.writeBytesPerSec`, `session.bytesWritten`, `estimatedRemainingMs`, `storagePolicy` | Write speed: 0.0 MB/s idle, 2.3 MB/s recording (8.2 GB/h). Session size: live while recording, otherwise "—". Est. remaining: free ÷ 8.2 GB/h, **389h 45m** at load, with "About 16 days of continuous recording" (04 §9 #17). Retention: 90 days |
| Usage over 24 h | Recharts `AreaChart` | `storage.history` (24 hourly points) | The area is GB written since the window start (+48–53 GB, depending on `now`); the tooltip gives the used GB at that hour. Draws once (900 ms), then streams without animation |
| Sealed per hour | Recharts `BarChart` | `selectSealedHourly` | Bronze → gold bars, rounded tops, no Y axis, current WIB hour in solid gold; "7 today" plus "View sealed →" (`/evidence?status=SEALED`) |
| Volumes & Health | `ProgressBar` × 2, `Chip`, `Sparkline` | `storage.volumes`, `health.*`, `lastWriteVerifiedAt`; SIM-GAP-W49-1 | Roles from design book §10.1 (01_explore §10). NVMe 212 GB of 2.0 TB (11 %); HDD 804 GB of 4.0 TB (20 %). SMART PASSED, temperature with a state chip and a 1 Hz sparkline, wear / media errors (NVMe), reallocated sectors / last write verified (HDD), power-on hours. A footnote labels the SMART values as derived demo values |
| Recent storage activity | `ScrollShadow`, MU `AnimatedListItem` | `events` filtered to storage (SIM-GAP-W49-2) | 10 newest rows (sealed, exported, archived, recording start/stop, autosave with segment size, write verified, policy change, storage faults). Dot tones: sealed violet, exported blue, warning amber, critical red. "View audit →" |
| Retention calculator | `NumberField` + `Slider` × 4, `Meter`, AnimatedNumber | local form | Inputs: video bitrate per camera, hours per day, retention days (follows the policy), overhead factor. Audio is fixed at 2.304 Mbps (2 × PCM 24-bit / 48 kHz, §10.3). The formula strip shows the live numbers. Tiles: total bitrate 18.3 Mbps, 8.24 GB/h, 32.9 GB/day, 388 h left, 97 days to full. Meter: 3.26 TB = 82 % of the 4.0 TB evidence volume (tone success, warning at 85 % or more, danger above 100 %), plus "covers about 110 days" or "Exceeds … by x TB" |
| Storage policy + Manage Storage | `Button` → `Drawer` (`Select`, `Switch`, `Alert`, `Button`) | `selectStoragePolicy`, `actions.setStoragePolicy` | Fill scale against LOW / FULL; retention, auto-archive, "Sealed evidence: Protected", what LOW and FULL do. Apply writes the simulator policy (audited STORAGE_POLICY_CHANGED); a success toast; on failure a friendly toast plus a structured log |

**Motion (M-PG-STOR; §8; §9):**
- **Enter order:**
  - the ring sweep (hero moment) starts 120 ms into the capacity panel's enter (`stroke-dashoffset` 900 ms `luxe`);
  - legend rows follow 60 ms apart;
  - KPI cards land 60 ms apart and tick after the held beat;
  - the area draws (900 ms) and the bars grow (700 ms);
  - the volume bars fill (700 ms);
  - the activity list, calculator and policy land on beats 560, 620 and 680 ms.
- **Ambient:** none from the page (a calm page). The debug overlay shows only the shell's slot (1/4).
- **Data moments:**
  - LOW and FULL morph the ring colour, pulse the ring glow and the banner glow once, and raise a toast (FULL persists).
  - A new storage event slides into the list with the 1.5 s gold highlight.
  - Session size and remaining time follow the 1 Hz step while recording.
- **Composite-only (§9.2):**
  - Kit progress fills (`ProgressBar`, `Meter`, the policy scale) are pinned at 100 % width and revealed with `scaleX`; the kit's `transition: width` is overridden.
  - The ring moves only `stroke-dashoffset` (SVG ≤ 400 px) and gradient `stop-color`.
  - No `box-shadow` animation (glow is `GlowLayer` opacity) and no `will-change`.
- **Reduced motion:** values are final at once (`useDataReady` returns true from the first render), there is no sweep (`transition: none`), charts have `isAnimationActive=false`, and list rows appear instantly.
- **Proof mode:** `?motion=slow` scales every beat and duration ×10 (the sweep takes 9,000 ms).

## 3. SIM-GAPs (for step 54; review 40 §6 R10 naming)

| ID | Gap | Local adapter (`sim-adapter.ts`) | Step 54 action |
|---|---|---|---|
| **SIM-GAP-W49-1** | No per-volume health. The simulator has one `health.storageTempC`, no SMART model, and no fault kind for EVT-17 "HDD SMART fault" or the FMEA "HDD write failure (I/O + SMART)". The diagnostics check only returns the text "SMART OK on both volumes" | `volumeHealth(state, volume)` derives it deterministically: HDD temperature = `storageTempC`; NVMe = max(HDD, CPU − 7 °C); SMART PASSED, or WARNING when the drive is HOT (evidence ≥ 60 °C, NVMe ≥ 80 °C, for example under FAN_STALL); wear 2 %, spare 100 %, media errors 0, reallocated / pending 0; power-on hours 2,184 plus sim runtime. `selectVolumeTemperatureSeries` gives the 1 Hz series. The UI footnote says the values are derived | Add `storage.volumes[].health` (smart, temperatureC, powerOnHours, wear/spare/mediaErrors or reallocated/pending), a `SMART_FAULT` fault kind (EVT-17), and per-volume temperature in `health.series` |
| **SIM-GAP-W49-2** | No storage-activity selector: `SimEvent` has no category (review 40 §4.4 caveat) | `selectStorageActivity(state, count)` filters by type (10 storage types, plus FAULT_RAISED / FAULT_CLEARED when `params.kind` is STORAGE_LOW or STORAGE_FULL), newest first, returning store-owned objects so `useSim` stays shallow-stable | Add `SimEvent.category` (or `selectStorageActivity`) and remove the adapter |

## 4. Verification (fresh; command output)

### 4.1 Storage tests

`npx vitest run src/features/storage --maxWorkers=2 --reporter=verbose` (cwd `apps/core-web`) gives `Test Files 2 passed (2)` / `Tests 21 passed (21)`:

| File | Tests |
|---|---|
| `storage-page.test.tsx` | (1) page, banner, 8 panels, 4 KPIs, 2 volumes, 0 missing keys. (2) **AC-75**: progressbar "Evidence storage used" has `aria-valuetext` "20% used"; the centre reads `20%` / `USED` and the headline `3.2 TB free of 4.0 TB` after the beat; the legend values. (3) Reduced motion: final values at first render, ring `transition: none`, dash offset = C × (1 − 0.201), `html[data-motion=reduced]`. (4) **AC-54 on screen**: est. remaining `389h 45m`, "at 8.2 GB per hour", 16 days; retention 90 days; idle write speed; no session. (5) Recording scenario: session size = `bytesWritten` of SES-…-0024 with "· live". (6) `inject('STORAGE_FULL')` → ring and chip FULL, banner "Storage full. Recording is blocked.", toast "Evidence storage is full", activity row "Fault raised · Storage full". (7) Calculator: 18.3 Mbps, 8.24 GB/h, 32.9 GB, "= 3.26 TB", meter "82% of the 4.0 TB evidence volume", "covers about 110 days"; at 8 h/day 65.9 GB and "Exceeds the evidence volume by 2.52 TB" (danger); Reset restores. (8) Manage Storage: Select "1 year" plus auto-archive off, then Apply → simulator policy `{YEAR_1, 365, false}`, last audit row STORAGE_POLICY_CHANGED, the toast, KPI 365 days, the policy list, calculator "× 365 days", first activity row "Storage policy changed · 365 days · auto-archive off" |
| `storage-model.test.tsx` | The §10.2 book example (2.304 Mbps audio; 18.304 Mbps; 8.2368 ≈ 8.2 GB/h), daily / required / coverage / tones, over-capacity (6,523.55 GB, 2.52 TB excess), capacity formatting, AC-54 (389 h 45 m), ring geometry and ticks, escalation rule, usage series (24 points, non-negative, 804 GB last), hour buckets, sparkline path, SIM-GAP-W49-1 health (and SMART WARNING when hot), SIM-GAP-W49-2 filter (storage fault in, camera fault out, stable references) |

**Mutation check (the tests are not vacuous).** Each file was backed up and restored; `cmp` confirms each is identical.

| Mutation | Result |
|---|---|
| M1: formula uses 3000 s instead of 3600 | 6 failed |
| M2: activity filter disabled | 1 failed |
| M3: escalation toast disabled | 1 failed |
| M4: ring centre shows the free % | 2 failed |
| M5: calculator ignores the policy | 1 failed |

### 4.2 Shell and route tests that mount `/storage`

`npx vitest run src/test/shell-motion.test.tsx src/test/routes.test.tsx src/features/storage -t "<storage cases>" --reporter=verbose` gives **26 passed**. Besides the 21 above:

| Test | Result |
|---|---|
| `routes.test.tsx` "/storage renders page-storage inside the shell" (AC-48) | ✓ |
| `routes.test.tsx` "shows the top bar and the Primary nav … at 1920 px" (renders `/storage`) | ✓ |
| `shell-motion.test.tsx` shell loops in full motion on `/storage` | ✓ |
| `shell-motion.test.tsx` shell loops in reduced motion on `/storage` | ✓ |
| `shell-motion.test.tsx` "moves the one nav-active card" from `/storage` | ✓ |

The second route test found two regressions during the run, both fixed:
- **Banner landmark.** The first draft used `<header>` for panel headers, and jsdom maps every `<header>` to the `banner` role, so `getByRole('banner')` found several. Panel and volume headers are now `<div>`s, which keeps one banner landmark.
- **Paint time.** The first draft imported Recharts into the page chunk, so on a loaded machine `/storage` missed the test's 1 s wait. The charts are now a lazy chunk (§6, DR-49-6).

### 4.3 Workspace gates and the P11 record

| Check | Command | Result |
|---|---|---|
| core-web typecheck | `npm run typecheck -w @dems/core-web` | 05:58: exit 2, errors **only** in `features/evidence/*` (step 47) and `features/devices/device-drawer.tsx` (step 48), both running then. **06:29 and 06:37: exit 0.** A scoped `tsc` over `features/storage` plus the typed `src/i18n.ts` exited 0 throughout |
| core-web lint | `npm run lint -w @dems/core-web` | exit 0; `oxlint -f json` 0 diagnostics in 268 files |
| core-web test (full) | `npm test -w @dems/core-web -- --maxWorkers=2` | 06:40: `Tests 4 failed \| 315 passed (319)`, exit 1. All 4 failures belong to concurrent steps: `routes.test.tsx` `/dashboard` and `/session` (pages of steps 42 and 44 miss the file's 1 s `findBy` wait at load ≈ 26–39) and `shell-motion.test.tsx` "marks <html>…" and "SECURE pill…" (both mount `/dashboard`). Earlier runs (06:20, 06:34) also failed only in step-43, 47 and 51 files (for example "Failed to resolve import ./evidence.css" while step 47 was writing). Every storage test passes in every run after 06:38 |
| shared i18n test | `npx vitest run test/i18n.test.ts` (cwd `packages/shared`) | 14/14 |
| shared typecheck | `npm run typecheck -w @dems/shared` | exit 0 |
| MS-01 (AC-72) | `grep -rnE "animate=\{\{[^}]*(width\|height\|top\|left)" apps/core-web/src/features/storage` | exit 1 (none) |
| MS-02 | `grep -rn "box-shadow" …/storage --include=*.tsx \| grep -E "animate\|transition"` | exit 1 (none) |
| MS-03 | `grep -rnE "will-change" …/storage` | exit 1 (none) |
| CSS transitions | `grep -n transition storage.css` | only `transform`, `stop-color` and the `--stor-fill-transition` (transform) values |

## 5. Browser check (headless Chromium, shared Vite 127.0.0.1:5178, P14)

**Method.**
- **Browser:** Playwright's cached `chrome-headless-shell` 1243 over CDP, driven by `scratchpad/cdp-storage.mjs` with Node's global `WebSocket` (no package installed).
- **Setup:** `sessionStorage` seeded with `dems.auth` = OPR-001 and `dems.shell.intro` = 1 (plain entrance); page at `/storage?debug=1`.
- **fps:** from an injected rAF counter over a 5 s window, cross-checked with the `?debug=1` overlay.
- **Long tasks:** from `PerformanceObserver('longtask')`, buffered.
- **Final run:** 06:27 WIB, after the last code change.

| Measurement | 1920×1080 | 1440×900 |
|---|---|---|
| fps (5 s window) / overlay average | 59.4 / 61 | 59.2 / 60 |
| Long tasks in the window (all, ms) | **0** (load: 68, 448, 90, 185, 76) | **0** (load: 325, 86, 142, 71) |
| Ambient running / requested (cap 4) | 1 / 1: `clock-colon, secure-dot, topo-drift` (shell); the page adds 0 | 1 / 1 (same) |
| Grid columns / nav width | 12 / 232 | 12 / 216 (AC-59 unchanged) |
| `main` and page horizontal overflow | 0 / 0 | 0 / 0 |
| AC-75 text | `20%` · `3.2 TB free of 4.0 TB` | same |
| Ring transition (full) | `stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)` | same |
| Reduced motion (emulated OS), after 350 ms | `20%`, `transition: none`, `html[data-motion=reduced]`; 59.8 fps; 0 long tasks in window; 0/0 loops; 8 `[data-motion=reduced]` shell elements | same (60 fps) |
| FULL data moment (STORAGE_LOW, then FULL, into the live sim) | — | ring and chip FULL, `99%`, "56 GB free of 4.0 TB", red banner, persistent toast, "Fault raised · Storage full" on top; 60 fps; 0 long tasks in the 3 s window after injection |
| Proof mode `?motion=slow` at 3.2 s | — | ring mid-sweep (`6%`, computed offset 90.6 of 100.5), transition 9,000 ms (MS-10 style) |
| Console | only Motion's dev "Reduced Motion enabled" notice under reduced motion; no errors, no exceptions | same |

The long tasks all fall at page load. They are dev-mode module evaluation plus the first render, and include the lazy chart chunk. The steady state has none. AC-71 is measured in windowed Chrome by step 58 (D70).

**Screenshots** (`implementation/assets/`):
- `28_1920_settled.png`, `28_1440_settled.png`: the settled page;
- `28_1920_enter_mid.png`, `28_1440_enter_mid.png`: mid-enter, ring counting;
- `28_1920_lower.png`, `28_1440_lower.png`: volumes, activity, calculator and policy (the 1440 strip layout);
- `28_1920_usage_tooltip.png`, `28_1440_usage_tooltip.png`: chart tooltip;
- `28_1920_manage_drawer.png`, `28_1440_manage_drawer.png`: the Manage Storage drawer;
- `28_1920_reduced.png`, `28_1440_reduced.png`: reduced motion;
- `28_1440_state_low.png`, `28_1440_state_full.png`: the threshold data moments;
- `28_1440_proof_slow_mid.png`: proof mode.

**Processes (P7, P14):**
- **Shared Vite:** already listening on 5178 (PID 95238 / node 95266, not mine). I registered `.locks/vite.users/step-49` under `lockf .locks/vite.lock` and removed it afterwards. Remaining users were step-43, 48 and 51, so the server was left running (P14: the last user stops it).
- **Chrome:** headless PIDs 99648, 2742 and 9493 (one per run) were stopped by the script; afterwards `ps -p` found none. Port 9349 is free and the scratch profile was deleted.
- **mock-core:** not used.

## 6. Decisions, drift and findings

| ID | Kind | Item |
|---|---|---|
| DR-49-1 | decision (brief) | A **Storage Policy** panel carries the LOW / FULL thresholds from the simulator and the "Manage Storage" button (04 §5.3 has only the button row). At ≥ 1600 the calculator is 8 columns and the policy 4. At 1280–1599 both take full rows, because 04 §5.3 gives the calculator 12 and it is cramped at 8. Container queries adapt the policy strip and stack the calculator when narrow |
| DR-49-2 | decision (dataviz) | "Usage over 24 h" plots **GB written since the window start** (an area with an honest zero baseline). Raw used GB on a zero-based axis is a flat line at about 800, and a non-zero baseline would misstate the area. The tooltip gives the used GB at each hour, and the header gives "+x GB in 24 h · 804.0 GB used now" |
| DR-49-3 | decision | The legend follows D1 F and MB 8: Sealed Evidence and Pending are **counts** (7 sealed today, labelled "today"; 1 RECORDED awaiting seal), not bytes. Colours: Used gold (the ring), Free track, Sealed violet (D28/Q4), Pending amber |
| DR-49-4 | decision (kit first, D6) | The ring is the kit `ProgressCircle`: its value and `valueLabel` carry the accessible truth at once, and the drawn arc sweeps by overriding `FillCircle` `strokeDashoffset` inline (M-C-03 "mount at 0, then the value"). A higher-specificity selector is needed because the kit's size variant pins the SVG to 28 px |
| DR-49-5 | decision (§9.2) | Kit `ProgressBar` and `Meter` animate `width` (`transition: width .3s`). Their fills are pinned at 100 % width (`!important`) and revealed with `transform: scaleX(var(--stor-fill))`, so the fill never animates a layout property |
| DR-49-6 | decision (performance) | The two chart panels are a lazy chunk (Recharts), prefetched when the page chunk evaluates, with a Skeleton fallback that keeps the panel frame and test ID. Result: the page paints without waiting for Recharts, and the step-38 route test (1 s wait) passes on `/storage` under load |
| DR-49-7 | decision | No ambient loop on the page (M-PG-STOR "Ambient: none"). The banner dot is steady; attention uses one-shot glow blooms only (R8) |
| DR-49-8 | decision | No `<header>` elements inside the page (one `banner` landmark; the route test asserts `getByRole('banner')`) |
| DR-49-9 | assumption A-49-1 | Calculator defaults the book leaves open: **4 recording hours per day** and **overhead × 1.10**. Both are labelled on screen as demo defaults. Audio is fixed at 2.304 Mbps (24-bit × 48 kHz × 2, §10.3). Retention days follow the simulator policy until the operator moves them; "Reset to book example" restores all four. The calculator uses the exact 8.2368 GB/h (shown as "8.24 GB/h"). The KPI and AC-54 use the simulator's rounded 8.2 GB/h, so the calculator's "388 h left" and the KPI's "389h 45m" differ by design, and each labels its rate |
| DR-49-10 | decision | Write speed shows the simulator's value: 0.0 MB/s idle, 2.3 MB/s recording (8.2 GB/h). The SM mockup's "120 MB/s" is not used (04 §9 #17) |
| DR-49-11 | decision (D74 relay) | Review 40 §6 applied. **R1:** `selectSystemState` is not used. **R8:** 1 Hz or slower UI (whole minutes, whole GB, the WIB hour and 0.1 GB steps inside the selectors; the 100 ms clock never re-renders the page). **R10:** the `SIM-GAP-W49-n` naming. **R9:** no ID-suffix parsing |
| DR-49-12 | decision (error handling) | Three layers: friendly toasts (policy apply failure; escalations), a structured dev-console record (`log.ts`: level, source, message, stack, context, timestamp; no PII), and per-panel boundaries with the rate-limited retry. Persistent logging is not possible: mock-core has no client log endpoint (D3/D4, D41(g)) |
| F-49-1 | finding (step 54 / review) | `setStoragePolicy` has no RBAC or sign-in check in the simulator, so any signed-in role can change retention. The page does not gate it either, to stay consistent with the contract. Suggest a permission (for example SUPERVISOR or TECHNICIAN) in step 54 |
| F-49-2 | finding (step 54) | STORAGE_LOW / STORAGE_FULL add `simulatedFillBytes` to the evidence volume, and the next 1 Hz step writes that into `storage.history`. The usage chart therefore spikes by about 3.1 TB during a FULL demo (see `28_1440_state_full.png`). It is data-true, but step 54 may want to keep the fault fill out of `history`, or flag the point |
| F-49-3 | finding (step 56 / controller) | Under the current parallel load (load average 19–39), `routes.test.tsx` and `shell-motion.test.tsx` use testing-library's 1 s default `findBy` for pages that now import heavy chunks, so `/dashboard` and `/session` flake. Step 56 may widen those waits, as this step did in its own test (`PAGE_WAIT` 10 s, suite timeout 30 s) |
| F-49-4 | note | `28_1440_state_full.png` shows the counters mid-flight 0.9 s after injection (the headline and legend springing from 560 GB to 56 GB). The banner, which is not animated, reads the exact 56.0 GB |

**Blockers: none.**

## 7. Parallel-run notes (P1–P14)

- **P1:** no install; no manifest or lockfile change.
- **P6:** wrote only the feature folder, the storage namespace file, the two feature tests, this log, the screenshots and the step progress file. `masterplan/02_plan.md`, `status_tasks.md` and `delegation_progress_report.md` belong to the controller during the parallel run and were not written.
- **P9:** vitest ran with `--maxWorkers=2`; no `vite build`.
- **P10:** a per-command sandbox bypass was used for the headless-Chrome launch, the port 5178 and 9349 connections, and the `ps` check.
- **P11:** see §4.3.
- **P14:** see §5.

---
*Generated: 2026-10-01 06:41 WIB*
