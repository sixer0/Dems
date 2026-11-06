---
step: 41
agent: coder-execution
plan_row: 02_plan §4 W-07, part b (app-level and shell motion)
status: complete
started: 2026-10-01 03:48 WIB
finished: 2026-10-01 04:31 WIB
log: implementation/21_shell_motion.md
---

# Step 41: App-level and shell motion (progress)

| Time (WIB) | Event |
|---|---|
| 03:48 | Inputs read: 02_structured row 41 and P1–P13; 03_motion_spec §1–§4, §5.4 (M-C-25), §8, §9, §10–§12; implementation 16 (REC-35-1), 17, 18 §3.1, 19; D41(d), D49, D53, D59, D60, D63 |
| 03:55 | H-M1 analysis from source: TanStack Router 1.170.40 `Outlet` follows `router.stores.ids`, and `setMatches` clears the old route's match store. So a keyed `AnimatePresence` cannot keep Login mounted. Motion's projection snapshots a `layoutId` node on unmount, so the flight itself can still be native |
| 04:05 | Wrote the shell motion modules (`route-view-transition.ts`, `shell-entrance.ts`, `shell-choreography.ts`, `shell-motion-context.ts`, `route-transition.tsx`, `exit-guard.tsx`) and the motion in top bar, sidebar, SECURE pill, bell, page header, emblem, bottom tabs, drawer and `shell.css`. `__root.tsx` now mounts `MotionPolicyProvider` and a root `LayoutGroup`; `router.tsx` gains `defaultViewTransition` |
| 04:12 | typecheck 0; lint needed 2 fixes (bell hook ref and immutability rules), then 0; existing suite 79/79 |
| 04:18 | `src/test/shell-motion.test.tsx`: 30/30 after 2 fixes (CSS read from disk because Vitest ignores `?raw` CSS; the heading is uppercase in i18n). H-M1 probe test passes: the exiting copy renders the new route, so the fallback is used |
| 04:20 | Browser run 1 (1920, Vite 5176) found DR-41-3: the wrapper was keyed on the pending location, so the view-transition snapshot was empty. Fixed by keying on the committed leaf match; retake OK |
| 04:24 | H-M1 trace in the scratch harness (Vite 5179): the shell emblem starts at Login's box [635, 318, 170] and settles at [20, 16, 48] in about 700 ms, continuously. Harness stopped |
| 04:25 | BorderBeam size set to the spec's 220 (DR-41-6); 1440 run; proof mode (`?motion=slow`, MS-10) captured |
| 04:26 | MS-02 grep matched my own test title; rephrased so it finds nothing. Six mutations each fail the suite (1 or 2 tests); all files restored with `cmp` identical |
| 04:28:40 | Final gate: typecheck 0, lint 0 (0 diagnostics in 100 files), test 8 files / 109 tests, MS-01, MS-02 and MS-03 greps exit 1 (no matches) |
| 04:29 | Final browser runs on the final code, 1920×1080 and 1440×900: 60.1–60.2 fps, 0 steady-state long tasks, shell uses 1/4 ambient slots, route exit plus enter about 870 ms, reduced motion static, sign-out reaches `/login` at about 325 ms, hand-off entrance confirmed. 26 screenshots in `implementation/assets/21_*.png` |
| 04:30 | All my processes stopped: Vite 25202/25220, 30020/30038, harness 27661, and the headless shells. Ports 5176 and 5179 free; scratch profiles deleted |
| 04:31 | Wrote `implementation/21_shell_motion.md` (Tier 3). Status **complete**. Decisions DR-41-1..21 are recorded there. No blockers |

## Files written (step 41)

- `apps/core-web/src/components/shell/` new files: `route-view-transition.ts`, `route-transition.tsx`, `shell-entrance.ts`, `shell-choreography.ts`, `shell-motion-context.ts`, `exit-guard.tsx`, `shared-layout-ids.ts`
- `apps/core-web/src/components/shell/` modified files: `app-layout.tsx`, `app-shell.tsx`, `top-bar.tsx`, `sidebar.tsx`, `secure-pill.tsx`, `notifications-bell.tsx`, `page-header.tsx`, `brand-emblem.tsx`, `bottom-tabs.tsx`, `nav-drawer.tsx`, `index.ts`, `shell.css`
- `apps/core-web/src/routes/__root.tsx` (provider mounting), `apps/core-web/src/router.tsx` (one option)
- `apps/core-web/src/test/shell-motion.test.tsx` (new)
- `docs/…/implementation/21_shell_motion.md`, `docs/…/implementation/assets/21_*.png` (26), this file
