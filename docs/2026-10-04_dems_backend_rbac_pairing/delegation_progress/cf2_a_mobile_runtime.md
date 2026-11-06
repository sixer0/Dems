# CF2-A: mobile runtime (delegation progress, parallel run)

| Field | Value |
|---|---|
| Row | CF2-A (closing round CF2; D218, D227, D234; test depth D232/D233) |
| Agent | coder-execution |
| Time | 2026-10-06 20:39-22:10 WIB |
| Status | **needs-review** |
| Report | `gateway_check/13a_cf2_mobile_runtime.md` (assets `gateway_check/assets/13a_*`, 64 files, 24 MB) |
| Rollback | `.cache/rollback/CF2-A/` (18 copies, `SHA256SUMS`, `NEW_FILES.txt`) |

## Outcome per defect

| Defect | Result | Evidence |
|---|---|---|
| RF-PH-1 = RF-T-3 timer holds | Fixed in mechanism (3 causes: compounding stall-tolerant yields; the Live clock's hold after late-handled heartbeats; React queue delay). The holds of 5-21 s are gone. Max lag: P1 1.43 s and P3 2.37 s at load 6-7; V1 4.27 s at load 10 (right after mount). 0 backward steps. The rest is debug-build JS time | report §1 |
| RF-PH-2 stale monitor after an early web stop | Partly fixed. The ~71 s tail (compounded yields delaying resync and deadlines) is gone. The remaining window is the JS stall after the monitor's first render: 0.6 s (C2), 4.1 s (P2), 0.5 s (V2) | report §2 |
| RF-PH-3 = RF-T-4 empty frames | Ready -> monitor: 0/9 (was 7/18). Sealed -> Summary: the Summary is now drawn in place at the seal, but 1 empty frame remains at the later native route swap (9/9). The proposed fix is `animation: 'none'` for the Summary screen in `navigation/stacks.tsx` (CF2-B's path) | report §3 |
| RF-PH-4 Login emblem-only after idle sign-out | Fixed in mechanism: React-held rest values after the entrance. Jest worst-case model 6/6 fail before, pass after. 1 device idle expiry normal (1 of 1); the stalled variant could not be forced | report §4 |
| Reanimated SurfaceMountingManager warnings | Sources mapped: the C-4 Stepper (`components/composed/stepper.tsx:229, 284-285, 323`) in the in-place Finalizing copy, and HeroUI press-feedback views of the wizard's scan button. None can be removed in my paths without undoing the in-place hand-overs | report §5 |

## Files created / updated (apps/mobile/src)

**Updated**

- `runtime/stall-tolerant-timers.ts`
- `runtime/stall-tolerant-timers.test.ts`
- `runtime/testing/js-thread.ts`
- `runtime/sim-adapters.ts`
- `runtime/index.ts`
- `features/session-live/use-monitor.ts`
- `features/session-live/session-live.math.ts`
- `features/session-live/session-live-screen.tsx`
- `features/session-new/session-new-screen.tsx`
- `features/session-finalizing/session-finalizing-screen.tsx`
- `features/session-finalizing/session-finalizing-screen.test.tsx`
- `features/session-summary/session-summary-screen.tsx`
- `features/session-summary/summary-live-static.test.ts`
- `features/login/use-login-choreography.ts`

**Created**

- `runtime/core-clock.ts`
- `runtime/core-clock.test.ts`
- `features/session-live/monitor-handoff.ts`
- `features/session-live/elapsed-ticker.test.ts`
- `features/session-live/live-monitor-timer-core-clock.test.tsx`
- `features/session-live/monitor-handoff-in-place.test.tsx`
- `features/session-new/live-start-handoff-in-place.test.tsx`
- `features/session-summary/summary-handoff.ts`
- `features/session-summary/summary-handoff-in-place.test.tsx`
- `features/login/login-entrance-rest.test.tsx`

**Docs**

- `gateway_check/13a_cf2_mobile_runtime.md`
- `gateway_check/assets/13a_*` (64)
- this file

## Verification

- Full mobile suite, once: 181 suites / 1,931 tests passed.
- Typecheck exit 0.
- `eslint .` exit 0.
- 6/6 in-memory mutants caught.
- Fail-before / pass-after for every new behaviour (report §1.5, §3.4, §4.3).
- Evidence scan: 0 passwords, 0 token shapes.

## Decisions taken (for the controller's decision log)

1. **Stall-tolerant yields bounded by wall time** (`STALL_MAX_POSTPONE_MS = 1_000`) instead of a count. This keeps CF-M1's rule and removes the compounding.
2. **LIVE monitor timer from the Core clock.** It reads a runtime Core clock (the Live clock corrected by the best offset seen in a window), through a 250 ms external-store ticker. `packages/shared` `clock.ts` is not changed (not in this row's paths).
3. **In-place Summary at the seal**, which replaces the step-80 fallback "Evidence sealed / Opening the session summary…" card when no route sync is mounted. The step-80 test was updated.
4. **Login draws React-held resting values** once its entrance is over.

## Open items for the controller

- **RF-PH-3 residual:** `animation: 'none'` for the Summary screen in the session flow (`src/navigation/stacks.tsx`, CF2-B).
- **RF-PH-1 and RF-PH-2 residuals** are debug-build JS-thread time: measure on the release build (W98); consider a lighter first render of the monitor.
- **Stepper and kit lost-update exposure** (§5): React-held rest values in `components/composed/stepper.tsx` (owner to be assigned).
- **Test-depth note:** 9 recorded device runs (3 diagnostic) instead of 6, as each new cause had to be found; no repeated loops.
