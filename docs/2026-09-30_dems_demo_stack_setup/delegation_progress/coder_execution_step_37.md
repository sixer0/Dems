---
step: 37
agent: coder-execution
plan_row: 02_plan §4 W-08, part b
status: complete
started: 2026-10-01 03:14 WIB
finished: 2026-10-01 03:43 WIB
log: implementation/18_copy_in_items.md
---

# Step 37: Magic UI and Motion Primitives copy-in items (progress)

| Time (WIB) | Event |
|---|---|
| 03:14 | Inputs read: 02_structured row 37 and P1–P13; 01_specs §14.5 (items and where they are used); 03_motion_spec §1–§3, §5, §8–§10; implementation 04 (BorderBeam and SlidingNumber notes) and 17 (motion library API); D6, D49, D59. Existing `THIRD_PARTY_NOTICES.md` read (87 lines) |
| 03:16 | Fetched 13 registry items (all HTTP 200). All depend only on `motion` or nothing. Compared with the MIT repositories (`magicui@d7207e5`, `motion-primitives@120f64f`): 12 identical; TextScramble's registry copy lags fix #182, so the repository file was taken. Both licences re-fetched (identical to the notices) and reported as SPDX `MIT` by GitHub |
| 03:23 | Appended the step-37 section to `THIRD_PARTY_NOTICES.md` (87 → 120 lines; first 87 byte-identical, SHA-256 checked before the append), ahead of step 92 (order 29, 37, 92) |
| 03:24–03:29 | Wrote the 13 files under `components/ui` (headers plus `// DEMS:` marks): tokens, step-36 policy, ambient registry, registry keyframes → Motion |
| 03:30 | First gate. My files: 3 TypeScript errors, fixed (unused `React`, TS2590 on the TextShimmer ref). `tsc -b` then exited 2 with 22 errors, all in step 33's `packages/shared/src/api/{examples,openapi}.ts`, 0 in mine (P11). Scoped tsc over `components/ui`: exit 0 |
| 03:31 | oxlint: 10 warnings in my files (static-components, set-state-in-effect, no-unsafe-optional-chaining, refs during render). Fixed; 0 diagnostics |
| 03:33–03:36 | Test file `components/ui/__tests__/copy-in-items.test.tsx`. The AnimatedNumber tests were reworked: Motion paints text on real rAF, so only `setTimeout` is faked. 14/14 green. Mutation check M1–M4: 3, 1, 1 and 1 failures; files restored, `cmp` identical |
| 03:37 | Harness Vite on 127.0.0.1:5177 (lane B, D59), PID 8558. The first try, PID 8395, got sandbox EPERM and was re-run with a bypass (P10). Headless Chromium CDP 9338, PID 8762 |
| 03:38 | Browser pass: every ambient loop animates when granted; cap 5 → 4 (particles waits); `?motion=off` is static. **Bug D-9:** reduced AnimatedNumber stuck at `0` under StrictMode |
| 03:39 | D-9 fixed test-first (StrictMode regression test; reduced motion renders the final value as text). 15/15 green; lint 0; scoped tsc 0 |
| 03:40 | Browser re-run: reduced number `1,234` at 250 ms; all scenarios PASS; 4 screenshots saved to `implementation/assets/18_copy_in_*.png`. Stopped PIDs 8762 and 8558; ports 5177 and 9338 free; scratch profile deleted |
| 03:40:43 | Full gate: `tsc -b` exit 0 (0 errors); lint exit 0 (0 diagnostics / 92 files); tests 7 files / 79 tests exit 0 |
| 03:41 | AC-17: `3` and nothing found; all 13 items named in the notices; MS-01, MS-02 and MS-03 no matches. A first MS-03 run matched my own comment in `shine-border.tsx`; reworded. Final re-run 03:41:30: typecheck 0, lint 0, tests 79/79 |
| 03:43 | Log `implementation/18_copy_in_items.md` written. Status **complete** |

## Files written (row 37 paths only)

- `apps/core-web/src/components/ui/` (new):
  - `animated-number.tsx`, `text-effect.tsx`, `text-shimmer.tsx`, `text-scramble.tsx`, `transition-panel.tsx`, `animated-background.tsx`, `spotlight.tsx`
  - `animated-list.tsx`, `ripple.tsx`, `shine-border.tsx`, `orbiting-circles.tsx`, `animated-beam.tsx`, `particles.tsx`
- `apps/core-web/src/components/ui/__tests__/copy-in-items.test.tsx` (new)
- `THIRD_PARTY_NOTICES.md` (append only: section "Magic UI and Motion Primitives items (step 37)")
- `docs/…/implementation/18_copy_in_items.md` (new)
- `docs/…/implementation/assets/18_copy_in_ambient.png`, `18_copy_in_ambient_reduced.png`, `18_copy_in_content.png`, `18_copy_in_content_reduced.png` (new)
- `docs/…/delegation_progress/coder_execution_step_37.md` (this file)

**Not touched:** `border-beam.tsx` and `sliding-number.tsx` (empty git diff), `package.json`, the lockfile, `index.css`, `packages/shared/**`, `src/routes/**`, the shell and `src/motion/**`.

**Not written** (shared files under parallel isolation): `masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md`, `implementation/99_implementation_report.md`.

## For the controller

- **Row 37 acceptance: PASS.**
  - 13 new item files; BorderBeam and SlidingNumber untouched.
  - The notices name all 13 with source URL, licence, repository path and upstream SHA-256.
  - AC-17 finds nothing.
  - core-web typecheck and lint exit 0.
- **Decisions and drift** (full list in log §6):
  - D-1: the items are adapted, with every change marked `// DEMS:`;
  - D-2: the registry `@keyframes` became Motion, because the global CSS must not be touched;
  - D-3: TextScramble taken from the MIT repository;
  - D-4: `loopGroup` defaults;
  - D-5: one extra test file in `components/ui/__tests__/`;
  - D-6: page-level configuration values;
  - D-7: `background-position` animation kept;
  - D-8: loops restart their cycle after a pause;
  - D-9: a browser-found StrictMode bug, fixed.
- **Page steps.** Pass one shared `loopGroup` to the Dashboard Ripple and ShineBorder. Use `active` for the caller's conditions. Pass the M-C-23 values (log §3.1).
- **P11.** A transient `tsc -b` failure (22 errors) came only from step 33's `packages/shared/src/api` files. It was clean on re-run.
- **No blockers.** Nothing was installed and nothing was committed.
