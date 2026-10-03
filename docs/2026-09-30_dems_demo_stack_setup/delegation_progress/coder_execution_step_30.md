---
step: 30
agent: coder-execution
plan_row: 02_plan §4 W-01 part b and §6.1 (SCR-07)
status: complete
started: 2026-10-01 02:17 WIB
finished: 2026-10-01 02:25 WIB
log: implementation/11_token_pipeline.md
---

# Step 30: Token pipeline (progress)

| Time (WIB) | Event |
|---|---|
| 02:17 | Inputs read: 02_structured row 30 and P1–P12; 01_specs §2.7, §2.9, §14.9, AC-18 and AC-69; 03_motion_spec §2 and §5.5; 02_plan §6.1; D31, D37, D41(d), D42 |
| 02:17 | Baseline: `npm test -w @dems/shared` 4 files and 16 tests pass; `npm run typecheck -w @dems/shared` exit 0 |
| 02:17 | D31 rev 3 already in `tokens.ts` and `status-tones.ts` (checked, not re-applied). Step 27 is done (export `./theme/scalar.css` present) |
| 02:19 | `tokens.ts`: §2.3 NEW motion tokens; typography class list derived from `typography`, plus `TYPOGRAPHY_TW_MERGE_CLASS_GROUPS` (D41(d)). `status-tones.ts`: moved list removed |
| 02:20 | `gen-theme.ts`: third output `theme/scalar.css`; tests `theme.test.ts` (extended), `contrast.test.ts` (new, AC-69), `motion-tokens.test.ts` (new) |
| 02:20 | Contrast finding: the GET label on the gold-soft active sidebar fill was 3.70:1, so the active fill became `surface-tertiary` (4.55:1) |
| 02:21 | `npm run build -w @dems/shared` failed with `listen EPERM` on the tsx IPC pipe (sandbox, P10); passed with a per-command bypass. The in-sandbox alternative is `node --import tsx scripts/gen-theme.ts` |
| 02:21 | Row test 82/83: my own assertion matched a comment. Fixed; 83/83 |
| 02:22 | Full shared suite 6 files / 115 tests; typecheck and lint for shared and core-web exit 0; mobile typecheck exit 0; core-web test 1/1; AC-18 idempotent (shasums identical); CSS parses (lightningcss, css-tree); a mutation check turns 18 tests red |
| 02:25 | Log written. Status **complete** |

## Files written (row 30 paths only)

- `packages/shared/src/tokens/tokens.ts` (modified)
- `packages/shared/src/tokens/status-tones.ts` (modified; W-01 file scope per 02_plan §10)
- `packages/shared/scripts/gen-theme.ts` (modified)
- `packages/shared/theme/scalar.css` (new, generated)
- `packages/shared/test/theme.test.ts` (modified)
- `packages/shared/test/contrast.test.ts` (new)
- `packages/shared/test/motion-tokens.test.ts` (new)
- `docs/…/implementation/11_token_pipeline.md` (new)
- `docs/…/delegation_progress/coder_execution_step_30.md` (this file)

Not written, because they are shared files under parallel isolation: `masterplan/02_plan.md`, `status_tasks.md`, `delegation_progress_report.md`, `implementation/99_implementation_report.md`. The controller synthesises them.

## For the controller

- Drift DR-a (MINOR): the 03M §5.5 renderer motion selector binding is left to step 53. `scalar.css` ships the keyframes, the token timings and the reduced-motion switch.
- Drift DR-b (MINOR): Scalar's status-code colour map gives 3xx amber and 4xx red, where 04 §5.9 asks for 3xx blue and 4xx amber.
- Observation D-3 for steps 38 and 68: kit-internal tailwind-merge is not reached by the apps' `cn`. The tailwind-variants `defaultConfig` route is a hypothesis.
- Sandbox note D-5 (AC-18 in step 61).
- The motion-token API for step 69 is in log §3.
