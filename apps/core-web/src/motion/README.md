# apps/core-web/src/motion

Up: [src](../README.md)

## Purpose

The web motion library: the motion policy (full or reduced, normal or slow proof speed), motion variants and transitions built from the `motion` tokens of `@dems/shared/tokens`, the ambient-loop registry that caps looping animations per viewport, the glow layer, and the `?debug=1` overlay. `MotionPolicyProvider` is mounted once in `routes/__root.tsx`; components read everything through `useMotionPolicy()`. About 125 production files under `features/`, `components/`, `routes/` and `lib/` import from `src/motion`.

Policy rules (`policy.ts`):

- reduced when the OS asks for it (`prefers-reduced-motion: reduce`), when the in-app "Reduce motion" switch is on (`localStorage` key `dems.motion.reduced`), or when the URL carries `?motion=off`;
- slow (proof mode) when the URL carries `?motion=slow`: every duration, delay and stagger is multiplied by the proof factor (10);
- in reduced mode: opacity only, at most the `fast` duration, no stagger, ambient loops off.

## Files

| File | Role |
|---|---|
| [`__tests__/`](__tests__/) | Unit tests of this folder and a shared test helper (`helpers.ts`). |
| [`ambient-registry.ts`](ambient-registry.ts) | Ambient-loop registry (`createAmbientRegistry`): at most 4 loops run per viewport, page loops before shell loops, loops of one group share a slot, with an escalation reserve; the debug overlay reads its snapshot. |
| [`debug-metrics.ts`](debug-metrics.ts) | Counters behind the `?debug=1` overlay (`reportMeterFrame`, `drainMeterFrames`, `setDebugMetricsEnabled`); a plain counter, no React state. |
| [`debug-overlay-gate.tsx`](debug-overlay-gate.tsx) | `MotionDebugOverlayGate`: loads the overlay as its own chunk only when `?debug=1` is present, so it never ships in the entry chunk. |
| [`debug-overlay.tsx`](debug-overlay.tsx) | `MotionDebugOverlay`: shows fps, meter frame rates and the ambient snapshot over a 1 s sampling window. |
| [`glow-layer.tsx`](glow-layer.tsx) | `GlowLayer`: pre-rendered glow layers whose opacity moves (breathing glow), never an animated shadow. |
| [`glow.ts`](glow.ts) | Glow shadows per elevation level and tone, derived from the elevation tokens (`GLOW_LEVELS`, `glowShadow`). |
| [`index.ts`](index.ts) | The barrel the console imports (`src/motion`). |
| [`motion-policy-provider.tsx`](motion-policy-provider.tsx) | `MotionPolicyProvider`: resolves the policy from the OS, the stored override and `?motion=` / `?debug=`, and sets `data-motion`, `data-motion-speed` and `--motion-time-scale` on `<html>`. |
| [`motion.css`](motion.css) | CSS side of the policy: rules keyed on `data-motion`, `data-motion-speed`, `--motion-time-scale` and `data-ambient`. |
| [`policy.ts`](policy.ts) | Pure policy resolution (`resolveMotionPolicy`, `parseMotionQuery`, `parseDebugQuery`, `readReducedOverride`, `writeReducedOverride`, `REDUCED_MOTION_STORAGE_KEY`). |
| [`transitions.ts`](transitions.ts) | Token to Motion `Transition` converters (`tween`, `springTransition`, `cappedStagger`, `loopTransition`), scaled by the time scale. |
| [`use-ambient-loop.ts`](use-ambient-loop.ts) | `useAmbientLoop`: a loop runs only when the policy allows it, the caller enables it, the tab is visible, the element is on screen and the registry grants a slot; `useAmbientSnapshot`. |
| [`use-media-query.ts`](use-media-query.ts) | `useMediaQuery`: a live media-query match, so a change of the OS reduced-motion setting applies without a reload. |
| [`use-motion-policy.ts`](use-motion-policy.ts) | `useMotionPolicy` and `MotionPolicyContext`: the resolved policy, speed and motion kit; without a provider it returns a static full-motion value. |
| [`variants.ts`](variants.ts) | `buildMotionKit(policy, timeScale)`: one coherent set of variants, transitions, interactions and flags per policy, plus timing constants (`HELD_BEAT_MS`, `ROW_STAGGER_MS`, `HOVER_MS`, `REDUCED_METER_HZ` and others). |

## Main exports

`MotionPolicyProvider`, `useMotionPolicy`, `useAmbientLoop`, `useAmbientSnapshot`, `GlowLayer`, `glowShadow`, `MotionDebugOverlayGate`, `reportMeterFrame`, `useMediaQuery`, the policy helpers of `policy.ts`, the converters of `transitions.ts` and the kit and constants of `variants.ts` (all re-exported by `index.ts`).

## Core operations, state and shared modules

- No Core operation and no state slice: motion depends only on the browser (media queries, `localStorage`, URL search) and on tokens.
- Shared package modules: `@dems/shared/tokens` (`motion` tokens, elevation, ambient limits).
- Console folders used: [`../lib/utils.ts`](../lib/utils.ts) (`cn`, in `glow-layer.tsx`).

## Tests

- [`__tests__/`](__tests__/): `ambient.test.tsx`, `debug-overlay.test.tsx`, `glow-layer.test.tsx`, `motion-policy.test.tsx`, with `helpers.ts`.
- In [`../test/`](../test/README.md): `shell-motion.test.tsx` (provider at the root, route exit), `visual-audit-45b.test.tsx` (escalation reserve of the ambient registry).

## Related decisions

None found in decisions.md for this folder (D40 names an `animated-number.tsx` reduced-motion path in `components/ui`, not this folder).
