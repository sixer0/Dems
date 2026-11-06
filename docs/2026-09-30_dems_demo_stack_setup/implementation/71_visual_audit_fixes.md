---
task_id: 2026-09-30_dems_demo_stack_setup
step: 45b
decision: D96
date: 2026-10-01
agent: coder-execution
tier: 3
source: verification/07_visual_checkpoint.md (§0, §3, §4), verification/assets/45_measurements.json
status: complete
---

# Step 45b: visual-audit fixes (F45-01, 02, 04, 05, 06, 07, 08)

**Status: complete.** All 7 findings are fixed. F45-03 was not touched (it belongs to step 54).

Verification (D75 fast lane, plus the audit's own fps method):
- typecheck exit 0;
- lint (oxlint) exit 0;
- full core-web vitest (`--maxWorkers=2`): **404 passed, 5 failed**. All 5 failures come from step 54's in-flight simulator edits, not from this step (§4).

Windowed GPU Chrome (Chrome for Testing 153, ANGLE Metal Apple M5, page visible and focused, 1920×1080 override, 10 s rAF windows): **Dashboard and Devices hold 60 fps.**

## 1. Per-finding evidence (before is from audit 45; after is from `implementation/assets/45b_measurements.json`)

| # | Fix | Before | After | Screenshot |
|---|---|---|---|---|
| F45-01 (High) | New `components/media/live-decode-budget.ts`. Each page gets **one live decode slot**. A `feed` (SM L) always plays and holds the slot. Among tiles and thumbs, the last one hovered or keyboard-focused plays (sticky), else the first mounted. Feeds that are off-screen, in a hidden tab, NO SIGNAL, reduced-motion or `live={false}` make no claim. A tile without the slot keeps its frame under a faint 7.2 s light sweep (`camera-feed.css`, transform only, an `idle` ambient loop). `CameraFeed` exposes `data-decode="live\|standby\|off"`, and the `?debug=1` overlay gains a "videos N playing / M" row (`data-videos-playing`). Page props are unchanged | Dashboard idle **30.0 fps**, recording **30.0 fps**, two videos playing | Dashboard idle **60.0** (worst frame 18 ms), with Camera 2 hovered **60.0**, recording **59.9**, `fault-demo` **60.1**. Devices idle **60.0**, recording **60.1**. SM recording **60.0** (the feed stays live). Overlay reads `1/2` or `1/3` videos playing in every state | `45b_gpu_dashboard_idle.png`, `45b_gpu_dashboard_hover_cam2.png`, `45b_gpu_devices_idle.png` |
| F45-02 (Med) | `ambient-registry.ts` now has five priority tiers: `escalation` < `page` < `decor` < `shell` < `idle` (lower wins). The cap of 4 is unchanged. While degraded, SecureBeam asks with `escalation` (`secure-pill.tsx`). Hero Ken Burns and the procedural camera Ken Burns are `decor`. The standby sweep is `idle`. The debug overlay counts a suppressed `page` or `escalation` loop as a breach; a suppressed `decor`, `idle` or `shell` loop is by design | `fault-demo`: pill CRITICAL, `secure-beam` **paused**; 4 page loops | `fault-demo`: pill CRITICAL, beam **running and mounted**, 4/4 slots, breach `false`. Running: shell + `ring-rotate`, `ring-breath`, `rec-pulse`. Paused: `hero-ken-burns`. Idle and recording budgets are unchanged (shell + 3) | `45b_gpu_dashboard_faultdemo_debug.png` |
| F45-04 (Low) | `formatUtcOffset()` label added to: SM M Start Time (a separate no-wrap zone span that drops under the time when the cell is narrow, so the ellipsis never hides it); Evidence list column header; preview card; detail header; the metadata custody list; the integrity custody header; the signature note | M: "1 Oct 2026 09:15:45" (no zone); Evidence list and detail: 0 zone labels | M: "1 Oct 2026 09:52:40 UTC+07:00" at 1920 and at 1440, zone visible, no overflow, panel still fits. List header: "Evidence ID · Recorded UTC+07:00" (same 52 px header height at 1440). Preview and detail: "… – 09:46:31 UTC+07:00" | `45b_1920_sm_details_start_time.png`, `45b_1440_sm_details_start_time.png`, `45b_1920_evidence_list.png`, `45b_1440_evidence_list.png`, `45b_1920_evidence_detail_heading.png` |
| F45-05 (Low) | `session-monitor.css`, 1440 tier only: meter track 48 px, stack gap 4 px, readout line 20 px. The stack is now 72 px, which fits the 75.8 px meter area | Stack 96 px in a 75.8 px area: the peak line and bars started **4.1 px above** the name's bottom edge | 1440: meter top **6.1 px below** the name, stack 6.1 px inside the half. 1920 unchanged | `45b_1440_sm_audio_before_after.png` |
| F45-06 (Low) | New key `dashboard.systemRing.caption.CRITICAL_RECORDING`, "Recording continues. A critical fault needs attention.". `system-ring-panel.tsx` uses it when the state is CRITICAL and `ring.since !== null` (a recording is running) | "A critical fault blocks recording…" while recording | `fault-demo` 1920: "Recording continues. A critical fault needs attention." Idle + CRITICAL keeps "blocks recording" (unit test) | `45b_1920_dashboard_faultdemo_ring.png` |
| F45-07 (Low) | `dashboard.css`: the ring arc is hidden at the `sm` and `xs` shell tiers (below 1024 px) | 900×800: arc 929 px wide; `main` scrollWidth 976 > 900 | 900×800: arc `display:none`; scrollWidth **900 = 900**. 1200 (md): arc kept (382 px, inside its cell) | `45b_900_dashboard_tier.png`, `45b_1200_dashboard_tier.png` |
| F45-08 (Nit) | `sealed-today-panel.tsx`: removed `max-w-[9ch]` and set `whitespace-nowrap`. At the narrow-card container query (H at 1440) the decorative database ring is hidden, so the hourly chart keeps room for its 00–20 ticks | 3 lines at 1920 and 1440 | 1 line (15 px) at both. Dashboard still has no scroll (1000/1000, 828/828) | `45b_1920_dashboard_sealed_today.png`, `45b_1440_dashboard_sealed_today.png` |

## 2. Files

**New:**
- `apps/core-web/src/components/media/live-decode-budget.ts`
- `apps/core-web/src/components/media/camera-feed.css`
- `apps/core-web/src/components/media/__tests__/live-decode-budget.test.tsx` (6 tests)
- `apps/core-web/src/test/visual-audit-45b.test.tsx` (6 tests: F45-02 ×3, F45-04, F45-06 ×2)

**Modified:**
- `components/media/camera-feed.tsx`
- `components/media/index.ts` (exports)
- `motion/ambient-registry.ts`
- `motion/debug-overlay.tsx`
- `components/shell/secure-pill.tsx` (SecureBeam priority only)
- `features/dashboard/hero-panel.tsx` (one line: `decor`)
- `features/dashboard/system-ring-panel.tsx`
- `features/dashboard/sealed-today-panel.tsx`
- `features/dashboard/dashboard.css`
- `features/session-monitor/details-panel.tsx`
- `features/session-monitor/session-monitor.css`
- `features/evidence/{evidence-table,detail-page,preview-card,metadata-tab,integrity-tab}.tsx`
- `features/evidence/evidence.css`
- `packages/shared/src/i18n/en/dashboard.ts` (one key added)

**Not touched:** any `sim-adapter.ts`, `packages/shared/src/sim/**`, `components/shell/integrity-checks.ts`, `glow-ring.tsx`, `active-session-panel.tsx`, Devices files. No package or lock file, no commit.

**Collision check** (all targets are untracked, so `git diff --stat` is empty; mtime was the check, recorded in the scratchpad `mtimes_before.txt`):
- No target had changed since 06:58 before editing.
- Step 54 changed one comment line in `system-ring-panel.tsx` at 10:19, after my edit (09:59). Both edits are intact, and typecheck and tests pass on the merged file.
- Step 54 also added `['CRITICAL_RECORDING']` to the allowed caption keys in `packages/shared/test/i18n-vocabulary-sync.test.ts`. Its comment says "step 42", but the key is from step 45b. That shared test passes (48/48).

## 3. Commands

| Check | Command | Result |
|---|---|---|
| Typecheck | `cd apps/core-web && npx tsc -b` | exit 0 (final run about 10:20). A mid-session run showed 2 errors in `packages/shared/src/sim/{actions,maintenance}.ts` while step 54 was editing; gone on re-run |
| Lint | `../../node_modules/.bin/oxlint` | exit 0, no findings |
| Tests | `npx vitest run --maxWorkers=2` | 37 files / 409 tests: **404 passed, 5 failed** (§4). The 12 new tests pass |
| Shared i18n | `cd packages/shared && npx vitest run test/i18n-vocabulary-sync.test.ts test/i18n.test.ts` | 48/48 |
| GPU fps | scratchpad `step45b/gpu45b.mjs` (audit-45 method) | see §1 F45-01 and F45-02 |
| Layout probes | scratchpad `step45b/shots45b.mjs`, `probe-audio.mjs` (headless 1243) | see §1; 0 console errors or warnings |

## 4. Issues and hand-offs

| Item | Note | Owner |
|---|---|---|
| 5 failing tests, not caused by this step | Each failure points into the simulator, which step 54 is editing (16 `src/sim` files changed during this session):<br>• `evidence-integrity` line 55: the sim track SHA now equals the package SHA (the alignment);<br>• `devices-page` line 394: `deviceCommand` now needs `DEVICE_MANAGE` (`sim/maintenance.ts:206`);<br>• `network-time-page` lines 145 and 213: PoE reads "2/2 ports" (the D79 2-port ruling);<br>• `storage-page` line 244: the retention policy result changed.<br>None of these tests touches a file this step changed, apart from `integrity-tab.tsx`, and that test fails on a simulator-state assertion before rendering it | **54** (update the page tests with its sim changes) |
| New ambient tiers | `escalation`, `decor` and `idle` were added to `AmbientPriority`. `page` (the default) and `shell` behave exactly as before, so every existing caller is unchanged. 03_motion_spec §9.4 does not name the tiers yet | Controller: note it in the motion spec at the end pass |
| `secure-pill.tsx` edit | One option object (the SecureBeam priority). The file is outside the brief's F45-02 list but is the only place the beam declares its slot. `integrity-checks.ts` (step 54's hand-over) was not touched | — |
| O-1 (pre-existing, not fixed) | At 1440 on the SM, MIC 2's peak-hold layer (`absolute inset-0`, moved by `translateX(%)`) can reach past `main` at high peaks: `main` scrollWidth 1250 > 1224 in one sample. It is clipped by `overflow-x: hidden` and invisible, and it depends on the level (the audit sample read 1224). Fix: `overflow: hidden` on the meter track (`dbfs-meter.tsx`, step 39) | 39 or 58 |
| Evidence media tab | Plays one camera at a time (`media-tab.tsx:48`), so the decode budget needs no relay to 47 | — |
| Mobile | The new caption key is web-only for now. The mobile Dashboard does not read `systemRing.caption` | — |

## 5. Processes (P5)

- **mock-core:** acquired under `lockf -k .locks/mock-core.lock`. 4400 was free, so I started it (listener 95490) and wrote `.locks/mock-core.users/step-45b`.
  - Released as the last user: TERM to 95490. tsx watch respawned a child (14765), so I also stopped the chain (npm 95450 → 95467, tsx 95489 → 14765).
  - `.locks/mock-core.pid` removed; `.locks/mock-core.users/` empty.
- **Vite:** my own server on 127.0.0.1:5173, scratchpad config `vite.step45b.config.mjs` (`hmr: false`, `watch: null`, private cache). Restarted after each of my CSS edits, then stopped.
- **Untouched:** shared 5178 (no users), 5174/5175, and `[::1]:5173` (SMART WMS 3489).
- **Browsers:** each one was killed by its own script; throwaway profiles and the Vite cache were deleted.
- **After cleanup:** `lsof` shows neither 127.0.0.1:5173 nor 4400 listening.

---
*Generated: 2026-10-01 10:25 WIB*
