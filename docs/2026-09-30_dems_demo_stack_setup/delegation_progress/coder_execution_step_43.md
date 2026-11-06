---
step: 43
agent: coder-execution
plan_row: 02_plan §4 W-09 (Login page + hand-off into the shell)
status: complete
started: 2026-10-01 05:15 WIB
finished: 2026-10-01 06:41 WIB
log: implementation/23_page_login.md
lane: shared Vite 127.0.0.1:5178 (P14, D72)
---

# Step 43: Login page (progress)

| Time (WIB) | Event |
|---|---|
| 05:15–05:39 | Inputs read: 02_structured row 43; 01_specs §14.2, §14.6, §14.7 (dataset, auth.ts), §14.8, §14.10, §14.14 (AC-49, AC-50, AC-66, AC-70); 03_motion_spec §1–§4 (M-APP-01..03), §5 (M-C-01, M-C-13, M-C-16, M-C-22, M-C-23), M-PG-LOGIN, §7–§9, §11 (MS-07); research/04 §5.8, §7; implementation 10, 13 §2, 17, 18 §3.1, 19 §2, 20 §2.1, 21 §2–§3; decisions D28, D38, D41(d), D46, D48, D49, D61, D63, D65, D70, D71, D72; mockups DEMS-Mobile.png (Login screen: fields, gold Sign In, biometric row) and DEMS-Dashboard1.png (hero language, ring). Baseline: login stub `apps/core-web/src/features/login/index.tsx` (step 38), `packages/shared/src/i18n/en/login.ts` (step 34) |
| 05:40–05:58 | Wrote `features/login/**` (index, auth-card, brand-panel, device-strip, login-alert, login-emblem, login-model, login-choreography, login-motion, use-login-controller, use-login-tier, sim-adapter, report, login.css) and 5 additive keys in `en/login.ts` |
| 05:58 | Controller relay (review 40, D74): applied page rules R1 (primitive selectors), R7/m10 (BorderBeam one lap, registered in the page's accent slot), R8 (whole seconds in the lockout selector), R10 (SIM-GAP-W43-n in sim-adapter.ts). Ruling M8: created `apps/core-web/src/lib/presentation-mode.ts` (sessionStorage `dems.presentation.v1`, get/set, live hook with in-page notifier + storage events) |
| 06:02 | typecheck: 0 errors in my files (errors only in `features/evidence/**`, `features/devices/**`, steps 47/48 running: P11). oxlint on my files: 0 diagnostics (after dropping 2 manual memoisations). Existing route/shell tests: every Login path passes (AC-49 round trip, M-APP-01 hand-off entrance, M-APP-02 sign-out); 4 failures all on `/dashboard` (step 42 building its page now: P11) |
| 06:06 | Own tests: `__tests__/login-model.test.tsx` (14) + `__tests__/login-page.test.tsx` (17) = 31/31 |
| 06:08 | Joined the shared Vite 5178 under `.locks/vite.lock` (already running; users step-48, step-51) |
| 06:10 | Browser run 1 (1920) broke on "Inspected target navigated or closed": other agents' edits trigger Vite HMR reloads. The check page now gets an inert stand-in for Vite's HMR socket and a simulated Core heartbeat (mock-core accepts WS only from :5173) |
| 06:12–06:18 | Found DR-43-8: 17–19 fps at 1920. A per-loop probe showed the live CSS filter on the full-viewport still costs it (44 fps without it). Baked the grade once (`graded-still.ts`, CSS fallback kept): probe 60.0 fps with all loops, 0 long tasks. Added shell-chunk warm-up and target preload at success (DR-43-14) |
| 06:26–06:30 | Gates: typecheck 0, lint 0 (0 diagnostics / 273 files), login 31/31; six mutations each fail the suite, all restored `cmp`-identical; MS-01/02/03 greps clean. Full suite run 1: 9 failures, all in step 42/44/47 pages (P11) |
| 06:33–06:37 | Final browser runs: 1920 55.6 fps, 1440 59.3 fps, 0 long tasks, ambient 4/4 no breach, reduced 0 loops at 60 fps; hand-off 1,381 / 1,460 ms with the emblem starting at the Login box and settling at the top-bar slot; return flight continuous. Tier captures 1200/900/600. 31 screenshots `implementation/assets/23_*.png`. Released the Vite user entry (others remain; server left running); no headless shell left; scratch profiles deleted |
| 06:36–06:39 | Final gates after the last (CSS) edit: typecheck 0, lint 0, login 31/31; full suite run 2: 2 failures, both step 42/47 pages (P11) |
| 06:41 | Wrote `implementation/23_page_login.md` (Tier 3). Status **complete**. SIM-GAP-W43-1 (presentation mode → `@/lib/presentation-mode`, M8) and SIM-GAP-W43-2 (last sign-out reason) logged for step 54; hand-offs H-43-1..4 |

## Files written (step 43)

- `apps/core-web/src/features/login/`: `index.tsx`, `auth-card.tsx`, `brand-panel.tsx`, `device-strip.tsx`, `login-alert.tsx`, `login-emblem.tsx`, `login-model.ts`, `login-choreography.ts`, `login-motion.ts`, `use-login-controller.ts`, `use-login-tier.ts`, `graded-still.ts`, `sim-adapter.ts`, `report.ts`, `login.css`, `__tests__/login-model.test.tsx`, `__tests__/login-page.test.tsx` (the step-38 stub `index.tsx` replaced)
- `apps/core-web/src/lib/presentation-mode.ts` (new; ruling M8)
- `packages/shared/src/i18n/en/login.ts` (+10 keys, additive)
- `docs/…/implementation/23_page_login.md`, `docs/…/implementation/assets/23_*.png` (31), this file
