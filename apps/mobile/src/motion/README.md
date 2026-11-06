# `apps/mobile/src/motion`

Up: [`src/`](../README.md)

## Purpose

The motion kit: shared motion tokens mapped to Reanimated, value and layout animation builders, the motion policy (full, reduced, slow; OS setting and in-app override), ambient loop registry, the haptics service (the only caller of `expo-haptics`), the glow layer, the `?debug=1` performance overlay and the watch over the UI animation runtime.

## Contents

| Entry | Role |
|---|---|
| [`testing/`](testing/) | Test beds, fakes and fixtures for the tests (no production code). |
| `builders.test.ts` | Test: Token → Reanimated mapping and builders. Numbers are compared with the shared tokens, so a token change flows through. |
| `builders.ts` | Motion builders. Two kinds: - **Value animations** (`animate*`) return what a shared value is assigned (`sv.value = animateSpring(1, 'gentle', m)`). |
| `debug-metrics.ts` | Measurement hooks for the `?debug=1` overlay. - `fpsFromWindow` |
| `debug-overlay.test.tsx` | Test: `?debug=1` overlay: hidden by default; shows UI / JS fps, meter frames per second, running loops and the policy once it is switched on. |
| `debug-overlay.tsx` | `?debug=1` performance overlay. Shows, once per second: UI-thread fps (`useFrameCallback`, the primary figure because `gfxinfo` may under-count Skia surfaces, H-MB-07), JS fps (`requestAnimationFrame`), meter frames ... |
| `glow-layer.test.tsx` | Test: GlowLayer: glow changes by cross-fading pre-rendered layers' opacity, never by animating a shadow. |
| `glow-layer.tsx` | GlowLayer. Glow is a STATE and is never animated as a shadow: this component pre-renders one absolutely positioned layer per level, each carrying that level's static `boxShadow`, and cross-fades their OPACITY. Put it ... |
| `haptics.test.ts` | Test: The §7.6 haptics map and the 400 ms coalescing. expo-haptics is the jest.setup.ts mock (jest.fn per call, real enums). |
| `haptics.ts` | Haptics service. This is the ONLY module that calls `expo-haptics`; everything else triggers a semantic event (`haptics.trigger('tabSelect')` or `useHaptics()`). |
| `index.ts` | Public surface of the motion kit (re-exports). |
| `log.ts` | Structured issue reporting of the motion kit into the runtime log sink. |
| `loops.ts` | Ambient loop registry (03_motion_spec P3, §9.4; 04_mobile_specs §7.8 "loops register with useMotionPolicy (the debug overlay lists them)"). |
| `motion-policy-provider.tsx` | MotionPolicyProvider. Feeds the motion store and applies the policy app-wide: - OS reduce motion: Reanimated's start-time value seeds the first render, then `AccessibilityInfo.isReduceMotionEnabled()` and the ... |
| `policy.test.tsx` | Test: OS reduce-motion or the in-app override → loops off and the kit's animation: 'disable-all'; plus the D43 `?motion=off` test switch, proof mode, persistence (merge into dems.mobile.prefs.v1) and the ... |
| `policy.ts` | Motion policy state. One module-level store, so the policy is readable from React (`useMotionPolicy`), from non-React code (the haptics service) and without a provider in unit tests (default: full motion, haptics on). |
| `prefs.ts` | Motion preferences persistence. The key is shared: it also holds presentation mode, the Core link source and the rail collapse flag, which other modules own. The motion kit therefore reads the whole object but writes ... |
| `tokens.ts` | Token → Reanimated mapping. Every number comes from the shared `motion` tokens. Nothing here re-declares a token value; the only local literals are spec values that are not tokens. The helpers are worklets, so they ... |
| `ui-runtime-watch.test.tsx` | Test: Tests "the policy once the animation runtime has stopped". |
| `ui-runtime-watch.ts` | Watch over the UI animation runtime: detects a stalled runtime and restarts once. |
| `use-motion-policy.ts` | Motion policy hooks. - `useMotionPolicy()` → `'full' |

## Main exports

- Public surface (`index.ts`): `EASING`, `FULL_MOTION`, `REDUCED_FADE_MS`, `REDUCED_MOTION`, `SLOW_MOTION`, `SPEC_LITERALS`, `ambientPeriodMs`, `durationMs`, `slowSpringTiming`, `springConfig`, `staggerDelay`, `timingConfig`, `animateAfter`, `animateBreath`, `animateFade`, `animatePulseOnce`, `animateRecPulse`, `animateRotation`, `animateShake`, `animateSpring`, `animateTiming`, `crossFadeIn`, `crossFadeOut`, `enterRise`, `exitUp`, `layoutTransition`, `listInsert`, `rowReveal`, `stackAnimation`, `INITIAL_MOTION_STATE`, `getMotionSettings`, `kitAnimation`, `motionStore`, `parseMotionLink`, `reducedReasons`, `resetMotionStateForTests`, `resolvePolicy`, `resolveSettings`, `resolveSlow`, `useAmbientLoop`, `useMotionPolicy`, `useMotionPreferences`, `useMotionSettings`, `useMotionState`, `useReducedReasons` and 37 more.
- Hooks: `useHaptics`, `useUiRuntimeWatch`, `useMotionState`, `useMotionPolicy`, `useMotionSettings`, `useReducedReasons`, `useAmbientLoop`, `useMotionPreferences`.
- Components: `MotionDebugOverlay`, `GlowLayer`, `MotionPolicyProvider`, `UiRuntimeBoundary`.

## Tests

6 test files sit beside the code in this folder (`*.test.ts`, `*.test.tsx`, jest with the `jest-expo` preset; setup in `apps/mobile/jest.setup.ts`).
Shared test beds and fixtures of this folder are in [`testing/`](testing/) (no production code).
Run: `npm test -w @dems/mobile` (all) or `npx jest <path>` inside `apps/mobile`.

## Related decisions

No entry of `decisions.md` (2026-11-05 team update audit) names this folder or its files.
