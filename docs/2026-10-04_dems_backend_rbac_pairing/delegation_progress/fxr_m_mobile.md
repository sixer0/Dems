# FXR-M (apps/mobile post-review fix pass) — delegation progress

- **Agent:** coder-execution · **Row:** FXR-M · **Date:** 2026-10-07 05:45-08:35
- **Status:** complete (jest proof; device confirmation folded into W94-W96)
- **Report:** `gateway_check/15c_fxr_mobile.md`
- **Interruption:** a controller-side stream stall mid-run; resumed after checking `git status` and the rollback
  folder: all edits made before the stall were intact (W93-3, -1, -12, -2, -4, -5, -6, -7, -8, -9, -11).

## Milestones
1. W93-3 rolling number: React-held digit columns in the kit component; TimerReadout folded into it.
2. W93-1 / -12: the recording time moved to `runtime/recording-elapsed.ts` (one shared ticker); bar, Home, hub
   and monitor agree; the ticker survives a throwing tick.
3. W93-2 / -4: Audit and Devices rows: constant 1 dp border, always-mounted `SelectionGlow` (moved to the kit).
4. W93-5, -6, -7, -8, -9: export source line; `animation: 'none'` for `finalizing` and `summary/[sessionId]`;
   Stepper rest values held by React + `animate={false}` for the in-place copies; name wrap; chip backplate.
5. W93-11 ruling: "Checking your permissions…" on the gated buttons; the wizard deep link waits for the role.
6. W93-13 / -14: route error logged once persistently; nav/motion `warn` -> `console.info`.
7. W93-15 / -16: command time-outs measured (never re-sent); late keystore writes logged and undone after an
   abandon.
8. W93-17 + R16: explicit 20 s budgets on the two flaky tests; one-toast tests counted.
9. Cheap nits W93-20..25 (24 partly); W93-28 quiet session-window diagnostics for W98.
10. Gates: tsc 0, eslint 0, full suite run 2: 189/191 suites, 1,980/1,985 tests; both failing suites fixed or
    load-only and green on re-run (32/32). 33/33 mutants caught.

## Blockers
None. Full-suite run 1 was invalid (FXR-W's half-saved `packages/shared/src/api/identity.ts`, 48 suites could
not load); run 2 on the coherent tree is the ledger's.

## Decisions (row-level; for `decisions/decisions.md` by the controller)
DEC-FXR-M-1..6 in report §2 (shared ticker for Home/hub too; forward-only rolls for timers/clocks; the
"checking" reason on every gated control; route error mirrored once by the runtime log; `summary/[sessionId]`
instead of W93's `summary/[id]`; count mode untouched).

## Deferred / not done
W93-10 (documented: not contained), W93-18, W93-19, W93-26 (not cheap), W93-27 (Info). Residual: the
`chrome-lost-updates` first test has no explicit timeout (3.4 s alone, timed out at load ~11).

## Files
70 files under `apps/mobile/src/` (15 created, 55 modified): `.cache/rollback/FXR-M/FXR-M.mobile.files.txt`,
pre/post sha256 lists alongside. Docs: `gateway_check/15c_fxr_mobile.md`, this file.
